import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ActionValidationError,
  IdempotencyConflictError,
  MutationConflictError,
  ScopeAccessError,
  SpeciesMigrationRequiredError,
  commitStateMutation,
  readState,
  type MutationEnvelope,
} from "../src/persistence/state-store.ts";
import { currentSpeciesDataset } from "../src/resolver/species-resolver.ts";
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
    expect(retry.state.bulkCopies[speciesKey("Serpent")]).toMatchObject({
      count: 4,
      species: species("Serpent"),
    });
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
    ]?.count).toBe(7);
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
    expect(state.state.bulkCopies[speciesKey("Serpent")]?.count).toBe(3);
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
    expect(state.state.bulkCopies[speciesKey("Serpent")]?.count).toBe(1);
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

  it("rejects an unknown action type before creating mutation artifacts", async () => {
    const context = await seededContext();
    await expectRejectedWithoutArtifacts(context, {
      ...mutation("unknown-action", 0, 1),
      actions: [{ type: "DELETE_EVERYTHING" }],
    });
  });

  it("rejects missing required action fields before creating mutation artifacts", async () => {
    const context = await seededContext();
    await expectRejectedWithoutArtifacts(context, {
      ...mutation("missing-field", 0, 1),
      actions: [
        {
          type: "ADD_BULK_COPIES",
          species: species("Serpent"),
        },
      ],
    });
  });

  it("rejects wrong runtime field types before creating mutation artifacts", async () => {
    const context = await seededContext();
    await expectRejectedWithoutArtifacts(context, {
      ...mutation("wrong-type", 0, 1),
      expectedStateRevision: "0",
    });
  });

  it("rejects a foreign species dataset as an explicit migration case", async () => {
    const context = await seededContext();
    const envelope = mutation("foreign-dataset", 0, 1);
    const action = envelope.actions[0];
    if (action?.type !== "ADD_BULK_COPIES") throw new Error("Invalid fixture.");
    action.species = {
      ...action.species,
      dataset: {
        ...currentSpeciesDataset,
        dedicatedServerBuildId: "older-build",
      },
    };

    await expect(
      commitStateMutation(env.DB, context, "space-a", envelope, NOW),
    ).rejects.toBeInstanceOf(SpeciesMigrationRequiredError);
    expect((await readState(env.DB, context, "space-a")).stateRevision).toBe(0);
    expect(await tableCount("mutations")).toBe(0);
    expect(await tableCount("idempotency_receipts")).toBe(0);
  });

  it("fails closed when persisted species state belongs to another dataset", async () => {
    const context = await seededContext();
    const committed = await commitStateMutation(
      env.DB,
      context,
      "space-a",
      mutation("persisted-foreign-dataset", 0, 1),
      NOW,
    );
    const storedState = structuredClone(committed.state);
    const entry = storedState.bulkCopies[speciesKey("Serpent")];
    if (entry === undefined) throw new Error("Invalid fixture.");
    entry.species.dataset.dedicatedServerBuildId = "older-build";
    await env.DB.prepare(
      "UPDATE inventory_states SET state_json = ?1 WHERE user_id = ?2 AND play_space_id = ?3",
    )
      .bind(JSON.stringify(storedState), context.userId, "space-a")
      .run();

    await expect(readState(env.DB, context, "space-a")).rejects.toBeInstanceOf(
      SpeciesMigrationRequiredError,
    );
  });

  it("stores prototype-shaped note keys as ordinary own properties", async () => {
    const context = await seededContext();
    const envelope: MutationEnvelope = {
      mutationId: "mutation-prototype-note",
      traceId: "trace-prototype-note",
      idempotencyKey: "key-prototype-note",
      expectedStateRevision: 0,
      actions: [{ type: "SET_NOTE", key: "__proto__", value: "safe" }],
    };

    const result = await commitStateMutation(
      env.DB,
      context,
      "space-a",
      envelope,
      NOW,
    );
    expect(result.state.notes.__proto__).toBe("safe");
    expect(Object.hasOwn(result.state.notes, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(result.state.notes)).toBeNull();
    const persisted = await readState(env.DB, context, "space-a");
    expect(persisted.state.notes.__proto__).toBe("safe");
    expect(Object.hasOwn(persisted.state.notes, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(persisted.state.notes)).toBeNull();
    const retry = await commitStateMutation(
      env.DB,
      context,
      "space-a",
      envelope,
      NOW,
    );
    expect(retry.duplicate).toBe(true);
    expect(retry.state.notes.__proto__).toBe("safe");
    expect(Object.getPrototypeOf(retry.state.notes)).toBeNull();
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
    adapterKey: {
      namespace: "palworld.species.internal_name" as const,
      value,
    },
    dataset: { ...currentSpeciesDataset },
  };
}

function speciesKey(value: string): string {
  return `palworld.species.internal_name:${value}`;
}

async function expectRejectedWithoutArtifacts(
  context: Awaited<ReturnType<typeof seededContext>>,
  envelope: unknown,
): Promise<void> {
  await expect(
    commitStateMutation(env.DB, context, "space-a", envelope, NOW),
  ).rejects.toBeInstanceOf(ActionValidationError);
  const state = await readState(env.DB, context, "space-a");
  expect(state.stateRevision).toBe(0);
  expect(state.state).toEqual({ bulkCopies: {}, notes: {} });
  expect(await tableCount("mutations")).toBe(0);
  expect(await tableCount("idempotency_receipts")).toBe(0);
}
