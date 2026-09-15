import { describe, expect, it } from "vitest";

import {
  PASSIVE_NAMESPACE,
  type PassiveReferenceArtifact,
} from "../src/domain/passive-reference.ts";
import {
  PassiveResolver,
  currentPassiveDataset,
  currentPassiveResolver,
} from "../src/resolver/passive-resolver.ts";

const REFERENCE_HASH = "a".repeat(64);

function artifact(
  entries: PassiveReferenceArtifact["entries"] = defaultEntries(),
  overrides: { referenceSpaceSha256?: string; steamBuildId?: string } = {},
): PassiveReferenceArtifact {
  const steamBuildId = overrides.steamBuildId ?? "25247047";
  return {
    schemaVersion: 1,
    domain: "palworld.passive.reference_space",
    adapterKeyNamespace: PASSIVE_NAMESPACE,
    dataset: {
      schemaVersion: 1,
      referenceSpaceSha256: overrides.referenceSpaceSha256 ?? REFERENCE_HASH,
      provenance: {
        steamBuildId,
        technicalCandidateSha256: "b".repeat(64),
        sourceReviewSchemaVersion: 2,
        repository: "MC-Micro/pal-tool",
        workflow: "Probe Pal Data Core",
        workflowRunId: "34975314764",
        commitSha: "e28b6148f47ec2179f63de8c104664be8f31df73",
        artifactName: `pal-data-core-candidate-${steamBuildId}`,
        artifactId: "10399160981",
        artifactSha256: "c".repeat(64),
      },
    },
    entries,
  };
}

function entry(sourceRow: string, nameEn: string, nameDe: string) {
  return {
    sourceRow,
    nameReference: {
      source: "observed_default_row_convention" as const,
      field: "sourceRow" as const,
      value: `PASSIVE_${sourceRow}`,
    },
    nameEn,
    nameDe,
  };
}

function defaultEntries(): PassiveReferenceArtifact["entries"] {
  return [
    entry("ElementBoost_Normal_2_PAL", "Celestial Emperor", "Erleuchteter"),
    entry("MoveSpeed_up_3", "Swift", "Blitzschnell"),
    entry("Rare", "Lucky", "Außergewöhnlich"),
    entry("WorldTree_Sanity", "Hermit Sage", "Erleuchteter"),
  ];
}

describe("passive resolver", () => {
  it("indexes the 115 officially published current-build passives", () => {
    expect(currentPassiveResolver.count).toBe(115);
    expect(currentPassiveDataset).toEqual({
      schemaVersion: 1,
      referenceSpaceSha256:
        "5050fc82e7b14dad5ebb06de6aa3f5fbafbd8d168aae525b4b4fa05214efeb4b",
    });
    expect(currentPassiveResolver.provenance).toMatchObject({
      steamBuildId: "25247047",
      workflowRunId: "34975314764",
      commitSha: "e28b6148f47ec2179f63de8c104664be8f31df73",
      artifactId: "10399160981",
    });
  });

  it("resolves the canonical current-build examples", () => {
    const lucky = currentPassiveResolver.resolve("Lucky");
    const swift = currentPassiveResolver.resolve("Blitzschnell");
    expect(lucky.status).toBe("resolved");
    expect(swift.status).toBe("resolved");
    if (lucky.status !== "resolved" || swift.status !== "resolved") return;
    expect(lucky.match.passive.adapterKey.value).toBe("Rare");
    expect(swift.match.passive.adapterKey.value).toBe("MoveSpeed_up_3");
  });

  it("keeps Erleuchteter ambiguous in the canonical current-build dataset", () => {
    const result = currentPassiveResolver.resolve("Erleuchteter");
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.candidates.map(({ passive }) => passive.adapterKey.value)).toEqual([
      "ElementBoost_Normal_2_PAL",
      "WorldTree_Sanity",
    ]);
  });

  it("resolves only exact published technical adapter keys", () => {
    const resolver = new PassiveResolver(artifact());
    const serialized = resolver.resolve(`${PASSIVE_NAMESPACE}:Rare`);
    const internal = resolver.resolve("Rare");
    expect(serialized.status).toBe("resolved");
    expect(internal.status).toBe("resolved");
    if (serialized.status !== "resolved") return;
    expect(serialized.match).toMatchObject({
      aliasSource: "adapter_key",
      passive: {
        adapterKey: { namespace: PASSIVE_NAMESPACE, value: "Rare" },
        nameEn: "Lucky",
        nameDe: "Außergewöhnlich",
      },
    });
    expect(resolver.resolve(`${PASSIVE_NAMESPACE}:ATK_up_PartnerSkill_1`).status).toBe(
      "not_found",
    );
    expect(resolver.resolve("ATK_up_PartnerSkill_1").status).toBe("not_found");
  });

  it("resolves unique exact English and German names with explicit normalization", () => {
    const resolver = new PassiveResolver(artifact());
    expect(resolver.resolve("Swift").status).toBe("resolved");
    const german = resolver.resolve("  AUSSERGEWÖHNLICH!! ");
    expect(german.status).toBe("resolved");
    if (german.status !== "resolved") return;
    expect(german.match.passive.adapterKey.value).toBe("Rare");
  });

  it("preserves the real German Erleuchteter ambiguity deterministically", () => {
    const result = new PassiveResolver(artifact()).resolve("Erleuchteter");
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.candidates.map(({ passive }) => passive.adapterKey.value)).toEqual([
      "ElementBoost_Normal_2_PAL",
      "WorldTree_Sanity",
    ]);
    expect(result.candidates.map(({ passive }) => passive.nameEn)).toEqual([
      "Celestial Emperor",
      "Hermit Sage",
    ]);
  });

  it("returns fuzzy candidates but never an authoritative resolution", () => {
    const result = new PassiveResolver(artifact()).resolve("Celestal Emperr");
    expect(result.status).toBe("candidates");
    if (result.status !== "candidates") return;
    expect(result.exact).toBe(false);
    expect(result.candidates[0]?.passive.adapterKey.value).toBe(
      "ElementBoost_Normal_2_PAL",
    );
  });

  it("returns not_found and never fuzzy-migrates an unknown serialized key", () => {
    const resolver = new PassiveResolver(artifact());
    expect(resolver.resolve("Definitely Not A Passive")).toEqual({
      status: "not_found",
      candidates: [],
      exact: false,
    });
    expect(resolver.resolve(`${PASSIVE_NAMESPACE}:Rar`)).toEqual({
      status: "not_found",
      candidates: [],
      exact: false,
    });
  });

  it("accepts only a known key in the same passive reference space", () => {
    const resolver = new PassiveResolver(artifact());
    const reference = {
      adapterKey: { namespace: PASSIVE_NAMESPACE, value: "Rare" },
      dataset: resolver.currentDataset,
    };
    expect(resolver.resolvePersisted(reference).status).toBe("current");
    expect(
      resolver.resolvePersisted({
        ...reference,
        adapterKey: { namespace: PASSIVE_NAMESPACE, value: "Lucky" },
      }).status,
    ).toBe("unknown_key");
    expect(
      resolver.resolvePersisted({
        ...reference,
        adapterKey: { namespace: PASSIVE_NAMESPACE, value: 42 },
      }).status,
    ).toBe("unknown_key");
  });

  it("requires migration for another reference space before considering the key", () => {
    const resolver = new PassiveResolver(artifact());
    const foreignDataset = {
      ...resolver.currentDataset,
      referenceSpaceSha256: "d".repeat(64),
    };
    expect(
      resolver.resolvePersisted({
        adapterKey: { namespace: PASSIVE_NAMESPACE, value: "Rare" },
        dataset: foreignDataset,
      }).status,
    ).toBe("migration_required");
    expect(
      resolver.resolvePersisted({
        adapterKey: { namespace: PASSIVE_NAMESPACE, value: "Unknown" },
        dataset: foreignDataset,
      }).status,
    ).toBe("migration_required");
  });

  it("treats Steam build id as provenance rather than dataset identity", () => {
    const current = new PassiveResolver(artifact());
    const sameSpaceNewBuild = new PassiveResolver(
      artifact(defaultEntries(), { steamBuildId: "future-build" }),
    );
    expect(sameSpaceNewBuild.currentDataset).toEqual(current.currentDataset);
    expect(sameSpaceNewBuild.provenance.steamBuildId).toBe("future-build");
  });

  it("rejects unsorted, duplicate, case-colliding, or malformed canonical entries", () => {
    const unsorted = [...defaultEntries()].reverse();
    expect(
      () => new PassiveResolver(artifact(unsorted)),
    ).toThrow(/ordinally sorted/u);
    expect(
      () =>
        new PassiveResolver(
          artifact([
            entry("Rare", "Lucky", "Außergewöhnlich"),
            entry("rare", "Other", "Andere"),
          ]),
        ),
    ).toThrow(/case collision/u);
    const malformed = artifact();
    const first = malformed.entries[0];
    if (first === undefined) throw new Error("Fixture must contain an entry.");
    first.nameReference.value = "WRONG";
    expect(() => new PassiveResolver(malformed)).toThrow(/does not match sourceRow/u);

    const mismatchedProvenance = artifact();
    mismatchedProvenance.dataset.provenance.artifactName =
      "pal-data-core-candidate-wrong-build";
    expect(() => new PassiveResolver(mismatchedProvenance)).toThrow(
      /Canonical passive reference artifact is invalid/u,
    );
  });
});
