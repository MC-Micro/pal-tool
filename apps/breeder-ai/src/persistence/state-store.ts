import type { AuthContext } from "../auth/contracts.ts";
import {
  canonicalJson,
  sha256Hex,
  type JsonValue,
} from "../shared/canonical-json.ts";

export interface SpeciesAdapterKey {
  namespace: "palworld.species.internal_name";
  value: string;
}

export interface Phase0State {
  bulkCopies: Record<string, number>;
  notes: Record<string, string>;
}

export type Phase0Action =
  | {
      type: "ADD_BULK_COPIES";
      species: SpeciesAdapterKey;
      amount: number;
    }
  | {
      type: "SET_NOTE";
      key: string;
      value: string;
    };

export interface MutationEnvelope {
  mutationId: string;
  traceId: string;
  idempotencyKey: string;
  expectedStateRevision: number;
  actions: Phase0Action[];
}

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
  envelope: MutationEnvelope,
  now: string,
): Promise<CommitResult> {
  validateEnvelope(envelope);

  const normalizedPayload = canonicalJson({
    mutationId: envelope.mutationId,
    expectedStateRevision: envelope.expectedStateRevision,
    actions: envelope.actions,
  } as unknown as JsonValue);
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

function validateEnvelope(envelope: MutationEnvelope): void {
  for (const [name, value] of [
    ["mutation_id", envelope.mutationId],
    ["trace_id", envelope.traceId],
    ["idempotency_key", envelope.idempotencyKey],
  ] as const) {
    if (value.trim().length === 0) {
      throw new ActionValidationError(`${name} must not be empty.`);
    }
  }
  if (envelope.traceId === envelope.idempotencyKey) {
    throw new ActionValidationError("trace_id must differ from idempotency_key.");
  }
  if (
    !Number.isSafeInteger(envelope.expectedStateRevision) ||
    envelope.expectedStateRevision < 0
  ) {
    throw new ActionValidationError(
      "expected_state_revision must be a non-negative safe integer.",
    );
  }
  if (envelope.actions.length === 0) {
    throw new ActionValidationError("An action group must not be empty.");
  }
}

function applyActions(
  input: Phase0State,
  actions: Phase0Action[],
): Phase0State {
  const state: Phase0State = {
    bulkCopies: { ...input.bulkCopies },
    notes: { ...input.notes },
  };

  for (const action of actions) {
    switch (action.type) {
      case "ADD_BULK_COPIES": {
        if (
          action.species.namespace !== "palworld.species.internal_name" ||
          action.species.value.trim().length === 0
        ) {
          throw new ActionValidationError("A qualified species adapter key is required.");
        }
        if (!Number.isSafeInteger(action.amount) || action.amount <= 0) {
          throw new ActionValidationError(
            "ADD_BULK_COPIES requires a positive safe integer amount.",
          );
        }
        const key = `${action.species.namespace}:${action.species.value}`;
        const next = (state.bulkCopies[key] ?? 0) + action.amount;
        if (!Number.isSafeInteger(next)) {
          throw new ActionValidationError("Bulk copy count exceeds safe integer range.");
        }
        state.bulkCopies[key] = next;
        break;
      }
      case "SET_NOTE": {
        const key = action.key.trim();
        if (key.length === 0 || key.length > 100) {
          throw new ActionValidationError(
            "SET_NOTE key must contain between 1 and 100 characters.",
          );
        }
        if (action.value.length > 1_000) {
          throw new ActionValidationError(
            "SET_NOTE value must not exceed 1000 characters.",
          );
        }
        state.notes[key] = action.value;
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

  const parsed = JSON.parse(receipt.result_json) as Omit<CommitResult, "duplicate">;
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
    state: JSON.parse(row.state_json) as Phase0State,
  };
}
