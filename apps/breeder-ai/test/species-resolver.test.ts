import { describe, expect, it } from "vitest";

import {
  SpeciesResolver,
  currentSpeciesDataset,
  speciesDatasetFromManifest,
} from "../src/resolver/species-resolver.ts";

describe("species resolver and durable crosswalk", () => {
  const resolver = new SpeciesResolver();

  it("indexes all 299 canonical species without transport indexes", () => {
    expect(resolver.count).toBe(299);
    const resolved = resolver.resolve("Elphidran Aqua");
    expect(resolved.status).toBe("resolved");
    if (resolved.status !== "resolved") return;

    expect(resolved.match.species).toMatchObject({
      adapterKey: {
        namespace: "palworld.species.internal_name",
        value: "FairyDragon_Water",
      },
      isVariant: true,
    });
    expect(JSON.stringify(resolved.match.species)).not.toMatch(
      /paldex|internal_index|sourceOrdinal|"id"/i,
    );
  });

  it("maps German and English localized aliases to the same adapter key", () => {
    const german = resolver.resolve("Vulmag");
    const english = resolver.resolve("Wixen");
    expect(german.status).toBe("resolved");
    expect(english.status).toBe("resolved");
    if (german.status !== "resolved" || english.status !== "resolved") return;

    expect(german.match.species.adapterKey.value).toBe("FoxMage");
    expect(english.match.species.adapterKey.value).toBe("FoxMage");
  });

  it("normalizes diacritics and punctuation without changing identity", () => {
    const resolved = resolver.resolve("DAEMONENAUGE");
    expect(resolved.status).toBe("resolved");
    if (resolved.status !== "resolved") return;
    expect(resolved.match.species.adapterKey.value).toBe(
      "YakushimaBoss001_Small",
    );
  });

  it("returns every exact candidate for a genuinely ambiguous display name", () => {
    const resolved = resolver.resolve("Gumoss");
    expect(resolved.status).toBe("ambiguous");
    if (resolved.status !== "ambiguous") return;
    expect(
      resolved.candidates.map((candidate) => candidate.species.adapterKey.value),
    ).toEqual(["PlantSlime", "PlantSlime_Flower"]);
  });

  it("returns fuzzy candidates but never upgrades them to a guessed match", () => {
    const resolved = resolver.resolve("Elphidrn Aqu");
    expect(resolved.status).toBe("candidates");
    if (resolved.status !== "candidates") return;
    expect(resolved.exact).toBe(false);
    expect(resolved.candidates[0]?.species.adapterKey.value).toBe(
      "FairyDragon_Water",
    );
  });

  it("returns not_found for an unsupported entity", () => {
    expect(resolver.resolve("Definitely Not A Pal")).toEqual({
      status: "not_found",
      candidates: [],
      exact: false,
    });
  });

  it("binds persisted references to the manifest version and hash", () => {
    const result = resolver.resolvePersisted({
      adapterKey: {
        namespace: "palworld.species.internal_name",
        value: "Serpent",
      },
      dataset: currentSpeciesDataset,
    });
    expect(result.status).toBe("current");
    expect(currentSpeciesDataset).toMatchObject({
      schemaVersion: 5,
      gameVersion: "1.0.3",
      dedicatedServerBuildId: "24575149",
      technicalSnapshotSha256:
        "78b598e7a4745f11061411ed0c976fac4e06d21ee9d9bb3002a0e90324b827cc",
    });
  });

  it("requires an explicit migration for another dataset and never fuzzy-migrates a key", () => {
    const oldDataset = {
      ...currentSpeciesDataset,
      dedicatedServerBuildId: "older-build",
    };
    expect(
      resolver.resolvePersisted({
        adapterKey: {
          namespace: "palworld.species.internal_name",
          value: "Serpent",
        },
        dataset: oldDataset,
      }).status,
    ).toBe("migration_required");
    expect(
      resolver.resolvePersisted({
        adapterKey: {
          namespace: "palworld.species.internal_name",
          value: "Serpnt",
        },
        dataset: currentSpeciesDataset,
      }).status,
    ).toBe("unknown_key");
  });

  it("selects the technical snapshot by canonical source role, not array position", () => {
    const dataset = speciesDatasetFromManifest({
      schema_version: 7,
      patch_check: {
        checked_game_version: "test-version",
        checked_game_build: "test-build",
      },
      sources: [
        {
          role: "historical_cross_check",
          sha256: {
            technical_snapshot: "f".repeat(64),
          },
        },
        {
          role: "canonical_primary_source",
          sha256: {
            technical_snapshot: "a".repeat(64),
          },
        },
      ],
    });

    expect(dataset.technicalSnapshotSha256).toBe("a".repeat(64));
  });

  it("fails closed for a missing, duplicate, or malformed canonical source", () => {
    const manifest = {
      schema_version: 7,
      patch_check: {
        checked_game_version: "test-version",
        checked_game_build: "test-build",
      },
      sources: [] as unknown[],
    };

    expect(() => speciesDatasetFromManifest(manifest)).toThrow(
      /exactly one canonical_primary_source/u,
    );
    manifest.sources = [canonicalSource("a".repeat(64)), canonicalSource("b".repeat(64))];
    expect(() => speciesDatasetFromManifest(manifest)).toThrow(
      /exactly one canonical_primary_source/u,
    );
    manifest.sources = [canonicalSource("not-a-sha256")];
    expect(() => speciesDatasetFromManifest(manifest)).toThrow(
      /fingerprint is invalid/u,
    );
  });
});

function canonicalSource(technicalSnapshot: string): Record<string, unknown> {
  return {
    role: "canonical_primary_source",
    sha256: { technical_snapshot: technicalSnapshot },
  };
}
