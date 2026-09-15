import { z } from "zod";

import type { AuthContext } from "../auth/contracts.ts";
import {
  PersistedSpeciesReferenceSchema,
  type PersistedSpeciesReference,
  type SpeciesDatasetReference,
} from "../domain/species-reference.ts";
import {
  SpeciesResolver,
} from "../resolver/species-resolver.ts";
import {
  canonicalJson,
  sha256Hex,
  type JsonValue,
} from "../shared/canonical-json.ts";

export interface BulkCopiesEntry {
  species: PersistedSpeciesReference;
  count: number;
}

export interface Phase0State {
  bulkCopies: Record<string, BulkCopiesEntry>;
  notes: Record<string, string>;
}

const identifierSchema = z.string().trim().min(1).max(200);

const AddBulkCopiesActionSchema = z
  .object({
    type: z.literal("ADD_BULK_COPIES"),
    species: PersistedSpeciesReferenceSchema,
    amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

const SetNoteActionSchema = z
  .object({
    type: z.literal("SET_NOTE"),
    key: z.string().trim().min(1).max(100),
    value: z.string().max(1_000),
  })
  .strict();

export const Phase0ActionSchema = z.discriminatedUnion("type", [
  AddBulkCopiesActionSchema,
  SetNoteActionSchema,
]);

export type Phase0Action = z.infer<typeof Phase0ActionSchema>;

export const MutationEnvelopeSchema = z
  .object({
    mutationId: identifierSchema,
    traceId: identifierSchema,
    idempotencyKey: identifierSchema,
    expectedStateRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    actions: z.array(Phase0ActionSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.traceId === value.idempotencyKey) {
      context.addIssue({
        code: "custom",
        path: ["traceId"],
        message: "trace_id must differ from idempotency_key.",
      });
    }
  });

export type MutationEnvelope = z.infer<typeof MutationEnvelopeSchema>;

const BulkCopiesEntrySchema = z
  .object({
    species: PersistedSpeciesReferenceSchema,
    count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

const NoteRecordSchema = z.custom<Record<string, string>>(
  (value) =>
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string"),
  "notes must be a string record",
);

const Phase0StateSchema = z
  .object({
    bulkCopies: z.record(z.string(), BulkCopiesEntrySchema),
    notes: NoteRecordSchema,
  })
  .strict();

const receiptResultSchema = z
  .object({
    userId: z.string(),
    playSpaceId: z.string(),
    mutationId: z.string(),
    traceId: z.string(),
    idempotencyKey: z.string(),
    beforeRevision: z.number().int().nonnegative(),
    stateRevision: z.number().int().nonnegative(),
    state: Phase0StateSchema,
  })
  .strict();

const speciesResolver = new SpeciesResolver();

export interface StateSnapshot {
  userId: string;
  playSpaceId: string;
  stateRevision: number;
  state: Phase0State;
}

export interface CommitResult extends StateSnapshot {
  mutationId: string;
  traceId: string;
  idempotencyKey: string;
  beforeRevision: number;
  duplicate: boolean;
}

interface StateRow {
  user_id: string;
  play_space_id: string;
  state_revision: number;
  state_json: string;
}

interface ReceiptRow {
  mutation_id: string;
  trace_id: string;
  idempotency_key: string;
  payload_hash: string;
  normalized_payload: string;
  before_revision: number;
  after_revision: number;
  result_json: string;
}

interface MutationIdRow {
  mutation_id: string;
}

export class ScopeAccessError extends Error {
  constructor() {
    super("The authenticated user does not own the requested play space.");
    this.name = "ScopeAccessError";
  }
}

export class ActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionValidationError";
  }
}

export class SpeciesMigrationRequiredError extends Error {
  readonly currentDataset: SpeciesDatasetReference;

  constructor(currentDataset: SpeciesDatasetReference) {
    super(
      "The persisted species reference belongs to another dataset and requires an explicit migration.",
    );
    this.name = "SpeciesMigrationRequiredError";
    this.currentDataset = currentDataset;
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key is already bound to a different payload.");
    this.name = "IdempotencyConflictError";
  }
}

export class RevisionConflictError extends Error {
  readonly actualRevision: number;

  constructor(actualRevision: number) {
    super(`Expected state revision does not match revision ${actualRevision}.`);
    this.name = "RevisionConflictError";
    this.actualRevision = actualRevision;
  }
}

export class MutationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MutationConflictError";
  }
}

export async function readState(
  db: D1Database,
  context: AuthContext,
  playSpaceId: string,
): Promise<StateSnapshot> {
  const row = await db
    .prepare(
      `SELECT state.user_id, state.play_space_id,
              state.state_revision, state.state_json
       FROM inventory_states AS state
       INNER JOIN play_spaces AS space
         ON space.owner_user_id = state.user_id
        AND space.play_space_id = state.play_space_id
       WHERE state.user_id = ?1
         AND state.play_space_id = ?2
         AND space.status = 'active'`,
    )
    .bind(context.userId, playSpaceId)
    .first<StateRow>();

  if (row === null) {
    throw new ScopeAccessError();
  }

  return snapshotFromRow(row);
}

export async function commitStateMutation(
  db: D1Database,
  context: AuthContext,
  playSpaceId: string,
  untrustedEnvelope: unknown,
  now: string,
): Promise<CommitResult> {
  const envelope = validateEnvelope(untrustedEnvelope);

  const normalizedPayload = canonicalJson({
    mutationId: envelope.mutationId,
    expectedStateRevision: envelope.expectedStateRevision,
    actions: envelope.actions,
  });
  const payloadHash = await sha256Hex(normalizedPayload);

  const existingReceipt = await readReceipt(
    db,
    context.userId,
    playSpaceId,
    envelope.idempotencyKey,
  );
  if (existingReceipt !== null) {
    return resultFromReceipt(existingReceipt, normalizedPayload, payloadHash, true);
  }

  const before = await readState(db, context, playSpaceId);
  if (before.stateRevision !== envelope.expectedStateRevision) {
    throw new RevisionConflictError(before.stateRevision);
  }

  const afterState = applyActions(before.state, envelope.actions);
  const afterRevision = before.stateRevision + 1;
  const storedResult = {
    userId: context.userId,
    playSpaceId,
    mutationId: envelope.mutationId,
    traceId: envelope.traceId,
    idempotencyKey: envelope.idempotencyKey,
    beforeRevision: before.stateRevision,
    stateRevision: afterRevision,
    state: afterState,
  } satisfies Omit<CommitResult, "duplicate">;
  const resultJson = canonicalJson(storedResult as unknown as JsonValue);
  const stateJson = canonicalJson(afterState as unknown as JsonValue);

  let batchError: unknown;
  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO idempotency_receipts (
             user_id, play_space_id, idempotency_key, mutation_id, trace_id,
             payload_hash, normalized_payload, before_revision, after_revision,
             result_json, created_at
           )
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
           FROM inventory_states
           WHERE user_id = ?1
             AND play_space_id = ?2
             AND state_revision = ?8
           ON CONFLICT(user_id, play_space_id, idempotency_key) DO NOTHING
           RETURNING mutation_id`,
        )
        .bind(
          context.userId,
          playSpaceId,
          envelope.idempotencyKey,
          envelope.mutationId,
          envelope.traceId,
          payloadHash,
          normalizedPayload,
          before.stateRevision,
          afterRevision,
          resultJson,
          now,
        ),
      db
        .prepare(
          `UPDATE inventory_states
           SET state_revision = ?1, state_json = ?2, updated_at = ?3
           WHERE user_id = ?4
             AND play_space_id = ?5
             AND state_revision = ?6
             AND EXISTS (
               SELECT 1 FROM idempotency_receipts
               WHERE user_id = ?4
                 AND play_space_id = ?5
                 AND idempotency_key = ?7
                 AND mutation_id = ?8
                 AND payload_hash = ?9
             )`,
        )
        .bind(
          afterRevision,
          stateJson,
          now,
          context.userId,
          playSpaceId,
          before.stateRevision,
          envelope.idempotencyKey,
          envelope.mutationId,
          payloadHash,
        ),
      db
        .prepare(
          `INSERT INTO mutations (
             mutation_id, user_id, play_space_id, trace_id, idempotency_key,
             action_type, target_type, target_id, before_revision,
             after_revision, normalized_payload, created_at
           )
           SELECT ?1, ?2, ?3, ?4, ?5,
                  'PHASE0_STATE_ACTION_GROUP', 'play_space_state', ?3,
                  ?6, ?7, ?8, ?9
           WHERE EXISTS (
             SELECT 1 FROM idempotency_receipts
             WHERE user_id = ?2
               AND play_space_id = ?3
               AND idempotency_key = ?5
               AND mutation_id = ?1
               AND payload_hash = ?10
           )`,
        )
        .bind(
          envelope.mutationId,
          context.userId,
          playSpaceId,
          envelope.traceId,
          envelope.idempotencyKey,
          before.stateRevision,
          afterRevision,
          normalizedPayload,
          now,
          payloadHash,
        ),
    ]);

    if ((results[0]?.results.length ?? 0) === 1) {
      return { ...storedResult, duplicate: false };
    }
  } catch (error) {
    batchError = error;
  }

  const racedReceipt = await readReceipt(
    db,
    context.userId,
    playSpaceId,
    envelope.idempotencyKey,
  );
  if (racedReceipt !== null) {
    return resultFromReceipt(racedReceipt, normalizedPayload, payloadHash, true);
  }

  const current = await readState(db, context, playSpaceId);
  if (current.stateRevision !== envelope.expectedStateRevision) {
    throw new RevisionConflictError(current.stateRevision);
  }

  const conflictingMutation = await db
    .prepare("SELECT mutation_id FROM mutations WHERE mutation_id = ?1")
    .bind(envelope.mutationId)
    .first<MutationIdRow>();
  if (conflictingMutation !== null) {
    throw new MutationConflictError(
      "The mutation_id is already bound to another committed mutation.",
    );
  }

  if (batchError !== undefined) {
    throw batchError instanceof Error
      ? batchError
      : new Error("The D1 batch failed with a non-Error value.", {
          cause: batchError,
        });
  }
  throw new MutationConflictError("The mutation could not claim a commit receipt.");
}

function validateEnvelope(envelope: unknown): MutationEnvelope {
  const parsed = MutationEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "envelope"}: ${issue.message}`)
      .join("; ");
    throw new ActionValidationError(`Invalid mutation envelope: ${details}`);
  }
  return parsed.data;
}

function applyActions(
  input: Phase0State,
  actions: Phase0Action[],
): Phase0State {
  const state = cloneState(input);

  for (const action of actions) {
    switch (action.type) {
      case "ADD_BULK_COPIES": {
        const resolution = speciesResolver.resolvePersisted(action.species);
        if (resolution.status === "migration_required") {
          throw new SpeciesMigrationRequiredError(resolution.currentDataset);
        }
        if (resolution.status === "unknown_key") {
          throw new ActionValidationError(
            "ADD_BULK_COPIES references an unknown canonical species key.",
          );
        }
        const key = speciesStorageKey(action.species);
        const next = (state.bulkCopies[key]?.count ?? 0) + action.amount;
        if (!Number.isSafeInteger(next)) {
          throw new ActionValidationError("Bulk copy count exceeds safe integer range.");
        }
        state.bulkCopies[key] = {
          species: action.species,
          count: next,
        };
        break;
      }
      case "SET_NOTE": {
        state.notes[action.key] = action.value;
        break;
      }
    }
  }

  return state;
}

async function readReceipt(
  db: D1Database,
  userId: string,
  playSpaceId: string,
  idempotencyKey: string,
): Promise<ReceiptRow | null> {
  return db
    .prepare(
      `SELECT mutation_id, trace_id, idempotency_key, payload_hash,
              normalized_payload, before_revision, after_revision, result_json
       FROM idempotency_receipts
       WHERE user_id = ?1 AND play_space_id = ?2 AND idempotency_key = ?3`,
    )
    .bind(userId, playSpaceId, idempotencyKey)
    .first<ReceiptRow>();
}

function resultFromReceipt(
  receipt: ReceiptRow,
  normalizedPayload: string,
  payloadHash: string,
  duplicate: boolean,
): CommitResult {
  if (
    receipt.payload_hash !== payloadHash ||
    receipt.normalized_payload !== normalizedPayload
  ) {
    throw new IdempotencyConflictError();
  }

  const receiptResult = receiptResultSchema.safeParse(
    JSON.parse(receipt.result_json) as unknown,
  );
  if (!receiptResult.success) {
    throw new Error("Committed idempotency receipt has an invalid result schema.", {
      cause: receiptResult.error,
    });
  }
  const parsed = {
    ...receiptResult.data,
    state: normalizeState(receiptResult.data.state),
  };
  if (
    parsed.mutationId !== receipt.mutation_id ||
    parsed.traceId !== receipt.trace_id ||
    parsed.idempotencyKey !== receipt.idempotency_key ||
    parsed.beforeRevision !== receipt.before_revision ||
    parsed.stateRevision !== receipt.after_revision
  ) {
    throw new Error("Committed idempotency receipt is internally inconsistent.");
  }
  return { ...parsed, duplicate };
}

function snapshotFromRow(row: StateRow): StateSnapshot {
  return {
    userId: row.user_id,
    playSpaceId: row.play_space_id,
    stateRevision: row.state_revision,
    state: normalizeState(JSON.parse(row.state_json) as unknown),
  };
}

function normalizeState(value: unknown): Phase0State {
  const parsed = Phase0StateSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Persisted Phase-0 state has an invalid schema.", {
      cause: parsed.error,
    });
  }

  const state = emptyState();
  for (const [key, entry] of Object.entries(parsed.data.bulkCopies)) {
    const resolution = speciesResolver.resolvePersisted(entry.species);
    if (resolution.status === "migration_required") {
      throw new SpeciesMigrationRequiredError(resolution.currentDataset);
    }
    if (
      resolution.status === "unknown_key" ||
      key !== speciesStorageKey(entry.species)
    ) {
      throw new Error("Persisted Phase-0 state contains an invalid species reference.");
    }
    state.bulkCopies[key] = entry;
  }
  for (const [key, note] of Object.entries(parsed.data.notes)) {
    state.notes[key] = note;
  }
  return state;
}

function cloneState(input: Phase0State): Phase0State {
  const state = emptyState();
  for (const [key, entry] of Object.entries(input.bulkCopies)) {
    state.bulkCopies[key] = {
      species: entry.species,
      count: entry.count,
    };
  }
  for (const [key, value] of Object.entries(input.notes)) {
    state.notes[key] = value;
  }
  return state;
}

function emptyState(): Phase0State {
  return {
    bulkCopies: Object.create(null) as Record<string, BulkCopiesEntry>,
    notes: Object.create(null) as Record<string, string>,
  };
}

function speciesStorageKey(reference: PersistedSpeciesReference): string {
  return `${reference.adapterKey.namespace}:${reference.adapterKey.value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
