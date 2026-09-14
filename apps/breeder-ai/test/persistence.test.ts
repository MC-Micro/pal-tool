import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ActionValidationError,
  IdempotencyConflictError,
  MutationConflictError,
  ScopeAccessError,
  commitStateMutation,
  readState,
  type MutationEnvelope,
} from "../src/persistence/state-store.ts";
import {
  resetDatabase,
  seedUser,
  tableCount,
} from "./helpers/database.ts";

const NOW = "2026-09-14T13:00:00.000Z";

describe("D1 revision, idempotency, and atomic commit spike", () => {
  beforeEach(resetDatabase);

  it("returns the committed receipt after a lost-response retry", async () => {
    const context = await seededContext();
    const envelope = mutation("lost-response", 0, 4);

    const committed = await commitStateMutation(
      env.DB,
      context,
      "space-a",
      envelope,
      NOW,
    );
    const retry = await commitStateMutation(
      env.DB,
      context,
      "space-a",
      envelope,
      NOW,
    );

    expect(committed.duplicate).toBe(false);
    expect(retry).toEqual({ ...committed, duplicate: true });
    expect(retry.stateRevision).toBe(1);
    expect(retry.state.bulkCopies[speciesKey("Serpent")]).toBe(4);
    expect(await tableCount("mutations")).toBe(1);
    expect(await tableCount("idempotency_receipts")).toBe(1);
  });

  it("deduplicates an ordinary duplicate retry before checking its stale revision", async () => {
    const context = await seededContext();
    const envelope = mutation("duplicate", 0, 2);
    await commitStateMutation(env.DB, context, "space-a", envelope, NOW);

    const retry = await commitStateMutation(
      env.DB,
      context,
      "space-a",
      envelope,
      "2026-09-14T13:01:00.000Z",
    );

    expect(retry.duplicate).toBe(true);
    expect(retry.beforeRevision).toBe(0);
    expect(retry.stateRevision).toBe(1);
  });

  it("converges parallel same-key/same-payload requests on exactly one commit", async () => {
    const context = await seededContext();
    const envelope = mutation("parallel", 0, 7);

    const results = await Promise.all([
      commitStateMutation(env.DB, context, "space-a", envelope, NOW),
      commitStateMutation(env.DB, context, "space-a", envelope, NOW),
    ]);

    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(1);
    expect((await readState(env.DB, context, "space-a")).state.bulkCopies[
      speciesKey("Serpent")
    ]).toBe(7);
    expect(await tableCount("mutations")).toBe(1);
    expect(await tableCount("idempotency_receipts")).toBe(1);
  });

  it("hard-conflicts same-key/different-payload without a second commit", async () => {
    const context = await seededContext();
    await commitStateMutation(
      env.DB,
      context,
      "space-a",
      mutation("same-key", 0, 3),
      NOW,
    );

    await expect(
      commitStateMutation(
        env.DB,
        context,
        "space-a",
        mutation("same-key", 1, 9),
        NOW,
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    const state = await readState(env.DB, context, "space-a");
    expect(state.stateRevision).toBe(1);
    expect(state.state.bulkCopies[speciesKey("Serpent")]).toBe(3);
    expect(await tableCount("mutations")).toBe(1);
  });

  it("rejects a revision conflict without last-write-wins or partial artifacts", async () => {
    const context = await seededContext();
    await commitStateMutation(
      env.DB,
      context,
      "space-a",
      mutation("first", 0, 1),
      NOW,
    );

    await expect(
      commitStateMutation(
        env.DB,
        context,
        "space-a",
        mutation("stale", 0, 10),
        NOW,
      ),
    ).rejects.toMatchObject({
      actualRevision: 1,
    });
    expect(await tableCount("mutations")).toBe(1);
    expect(await tableCount("idempotency_receipts")).toBe(1);
  });

  it("rolls back a whole action group when any action is invalid", async () => {
    const context = await seededContext();
    const envelope: MutationEnvelope = {
      mutationId: "mutation-invalid-group",
      traceId: "trace-invalid-group",
      idempotencyKey: "key-invalid-group",
      expectedStateRevision: 0,
      actions: [
        {
          type: "ADD_BULK_COPIES",
          species: species("Serpent"),
          amount: 2,
        },
        {
          type: "ADD_BULK_COPIES",
          species: species("FairyDragon"),
          amount: 0,
        },
      ],
    };

    await expect(
      commitStateMutation(env.DB, context, "space-a", envelope, NOW),
    ).rejects.toBeInstanceOf(ActionValidationError);
    expect((await readState(env.DB, context, "space-a")).stateRevision).toBe(0);
    expect(await tableCount("mutations")).toBe(0);
    expect(await tableCount("idempotency_receipts")).toBe(0);
  });

  it("rolls back receipt, state, and revision when a later batch statement fails", async () => {
    const context = await seededContext();
    const existing = mutation("existing", 0, 1);
    await commitStateMutation(env.DB, context, "space-a", existing, NOW);

    const collidingMutationId: MutationEnvelope = {
      ...mutation("collision", 1, 5),
      mutationId: existing.mutationId,
    };
    await expect(
      commitStateMutation(
        env.DB,
        context,
        "space-a",
        collidingMutationId,
        NOW,
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);

    const state = await readState(env.DB, context, "space-a");
    expect(state.stateRevision).toBe(1);
    expect(state.state.bulkCopies[speciesKey("Serpent")]).toBe(1);
    expect(await tableCount("mutations")).toBe(1);
    expect(await tableCount("idempotency_receipts")).toBe(1);
  });

  it("enforces both user and play-space isolation for reads and writes", async () => {
    const contextA = await seededContext();
    const contextB = await seedUser({
      userId: "user-b",
      authIdentityId: "identity-b",
      provider: "test-provider",
      issuer: "https://issuer-b.example.test",
      subject: "subject-b",
      playSpaceIds: ["space-b"],
    });

    await expect(readState(env.DB, contextA, "space-b")).rejects.toBeInstanceOf(
      ScopeAccessError,
    );
    await expect(
      commitStateMutation(
        env.DB,
        contextA,
        "space-b",
        mutation("cross-tenant", 0, 99),
        NOW,
      ),
    ).rejects.toBeInstanceOf(ScopeAccessError);

    await commitStateMutation(
      env.DB,
      contextA,
      "space-a-2",
      mutation("space-two", 0, 2),
      NOW,
    );
    expect((await readState(env.DB, contextA, "space-a")).stateRevision).toBe(0);
    expect((await readState(env.DB, contextA, "space-a-2")).stateRevision).toBe(1);
    expect((await readState(env.DB, contextB, "space-b")).stateRevision).toBe(0);
  });

  it("rejects trace_id reuse as idempotency_key", async () => {
    const context = await seededContext();
    const envelope = mutation("separate-ids", 0, 1);
    envelope.traceId = envelope.idempotencyKey;

    await expect(
      commitStateMutation(env.DB, context, "space-a", envelope, NOW),
    ).rejects.toBeInstanceOf(ActionValidationError);
  });
});

async function seededContext() {
  return seedUser({
    userId: "user-a",
    authIdentityId: "identity-a",
    provider: "test-provider",
    issuer: "https://issuer-a.example.test",
    subject: "subject-a",
    playSpaceIds: ["space-a", "space-a-2"],
  });
}

function mutation(
  suffix: string,
  expectedStateRevision: number,
  amount: number,
): MutationEnvelope {
  return {
    mutationId: `mutation-${suffix}`,
    traceId: `trace-${suffix}`,
    idempotencyKey: `key-${suffix}`,
    expectedStateRevision,
    actions: [
      {
        type: "ADD_BULK_COPIES",
        species: species("Serpent"),
        amount,
      },
    ],
  };
}

function species(value: string) {
  return {
    namespace: "palworld.species.internal_name" as const,
    value,
  };
}

function speciesKey(value: string): string {
  return `palworld.species.internal_name:${value}`;
}
