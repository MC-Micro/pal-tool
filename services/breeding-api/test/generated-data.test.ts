import { describe, expect, it } from "vitest";

import referenceJson from "../generated/reference.json";
import impactJson from "../generated/special-child-impact.json";
import {
  createBreedingEngine,
  triangularPairFromOrdinal,
  triangularPairOrdinal,
} from "../src/breeding.ts";
import { getCarrierEdges, getChildrenForPair, getParentEntries } from "../src/reference.ts";
import {
  RULE_CODE,
  type GeneratedReference,
  type PalValue,
  type SpecialCombination,
} from "../src/types.ts";
import {
  buildPackedData,
  buildReference,
  computeGeneratedArtifactHash,
  computeSpecialChildImpactContentHash,
  computeSourceDataHash,
  validateCanonicalInputs,
  type CanonicalInputs,
  type SpecialChildImpactReport,
} from "../scripts/build-reference.ts";

const reference = referenceJson as GeneratedReference;
const impact = impactJson as SpecialChildImpactReport;

function decodeUint32(base64: string): Uint32Array {
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  return new Uint32Array(bytes.buffer);
}

function decodeUint16(base64: string): Uint16Array {
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  return new Uint16Array(bytes.buffer);
}

function decodeUint8(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

describe("generated reference", () => {
  it("is deterministic for identical canonical inputs", async () => {
    await expect(buildReference()).resolves.toEqual(reference);
    expect(reference.sourceDataHash).toBe(
      "77901fb00c984e360f563049f2e7f3dc64a6b2d764e77f3c32a737ef4bc82121",
    );
    expect(computeGeneratedArtifactHash(reference)).toBe(reference.generatedArtifactHash);
  });

  it("rejects typed schema drift before generation", () => {
    const invalid: CanonicalInputs = structuredClone({
      rules: reference.canonical.rules,
      specials: reference.canonical.specialCombinations,
      pals: reference.pals,
      manifest: reference.canonical.manifest,
      sourceFiles: reference.sourceFiles,
      sourceDataHash: reference.sourceDataHash,
    });
    const firstPal = invalid.pals[0];
    if (firstPal === undefined) throw new Error("Missing first Pal fixture");
    Reflect.set(firstPal, "ignore_combi", "false");
    expect(() => validateCanonicalInputs(invalid)).toThrow("ignore_combi must be a boolean");
  });

  it("contains all canonical records with both former conflicts resolved", () => {
    expect(reference.status.palCount).toBe(299);
    expect(reference.status.specialCombinationCount).toBe(136);
    expect(reference.status.validationStatus).toBe("valid");
    expect(reference.status.eligiblePalCount).toBe(184);
    expect(reference.status.specialChildSpeciesCount).toBe(90);
    expect(reference.validation.conflicts).toEqual([]);
    expect(reference.specialChildImpact).toMatchObject({
      pairCount: 44_850,
      changedPairCount: 13_785,
      legacyEligibleChildCount: 261,
      currentEligibleChildCount: 184,
      specialChildSpeciesCount: 90,
    });
  });

  it("keeps every normal-formula child eligible and excludes every special child", () => {
    const children = decodeUint16(reference.pairMatrix.childIdsBase64);
    const rules = decodeUint8(reference.pairMatrix.ruleCodesBase64);
    const specialChildren = new Set(
      reference.canonical.specialCombinations.map(({ child_internal }) => child_internal),
    );
    for (let ordinal = 0; ordinal < children.length; ordinal += 1) {
      if (rules[ordinal] !== RULE_CODE.normal_formula) continue;
      const child = reference.pals[children[ordinal] ?? -1];
      expect(child?.combi_rank).toBeGreaterThan(0);
      expect(child?.ignore_combi).toBe(false);
      expect(specialChildren.has(child?.internal_name ?? "")).toBe(false);
    }
  });

  it("separates source and generated hashes without self-reference", () => {
    expect(reference.sourceDataHash).not.toBe(reference.generatedArtifactHash);
    expect(computeSourceDataHash(reference.sourceFiles)).toBe(reference.sourceDataHash);
    expect(computeGeneratedArtifactHash(reference)).toBe(reference.generatedArtifactHash);

    const sourceFiles = structuredClone(reference.sourceFiles);
    const first = sourceFiles[0];
    if (first === undefined) throw new Error("Missing source hash fixture");
    first.bytes += 1;
    expect(computeSourceDataHash(sourceFiles)).not.toBe(reference.sourceDataHash);

    const altered = structuredClone(reference);
    altered.status.parentsIndexEntryCount += 1;
    expect(computeGeneratedArtifactHash(altered)).not.toBe(reference.generatedArtifactHash);
  });

  it("publishes the complete deterministic special-child impact report", () => {
    expect(impact.sourceDataHash).toBe(reference.sourceDataHash);
    expect(impact.contentHash).toBe(reference.specialChildImpact.sha256);
    expect(impact.changes).toHaveLength(13_785);
    const content = structuredClone(impact);
    Reflect.deleteProperty(content, "contentHash");
    expect(computeSpecialChildImpactContentHash(content)).toBe(impact.contentHash);
    expect(impact.affectedSpecialChildSpecies).toContain("SharkKid_Fire");
    expect(
      impact.knownPairChecks.find(({ label }) => label === "Sibelyx + Lamball"),
    ).toMatchObject({
      previousChildInternal: "SharkKid_Fire",
      currentChildInternal: "Serpent",
      changed: true,
    });
  });

  it("keeps the packed reverse index consistent with the forward matrix", () => {
    const children = decodeUint16(reference.pairMatrix.childIdsBase64);
    const offsets = decodeUint32(reference.parentsByChild.offsetsBase64);
    const ordinals = decodeUint32(reference.parentsByChild.pairOrdinalsBase64);
    for (let childId = 0; childId < reference.pals.length; childId += 1) {
      const start = offsets[childId];
      const end = offsets[childId + 1];
      expect(start).toBeDefined();
      expect(end).toBeDefined();
      for (let cursor = start ?? 0; cursor < (end ?? 0); cursor += 1) {
        const ordinal = ordinals[cursor];
        expect(ordinal).toBeDefined();
        expect(children[ordinal ?? -1]).toBe(childId);
        const [left, right] = triangularPairFromOrdinal(ordinal ?? -1, reference.pals.length);
        expect(left).toBeLessThanOrEqual(right);
      }
    }
  });

  it("covers every directed carrier/mate outcome without collapsing alternative mates", () => {
    let expectedEdgeCount = 0;
    for (let carrierId = 0; carrierId < reference.pals.length; carrierId += 1) {
      const expected = reference.pals.flatMap((_pal, mateId) =>
        getChildrenForPair(carrierId, mateId).map(
          (edge) =>
            `${edge.mateId}|${edge.childId}|${edge.carrierGender}|${edge.mateGender}|${edge.rule}|${edge.rowId ?? ""}`,
        ),
      );
      const actual = getCarrierEdges(carrierId).map(
        (edge) =>
          `${edge.mateId}|${edge.childId}|${edge.carrierGender}|${edge.mateGender}|${edge.rule}|${edge.rowId ?? ""}`,
      );
      expectedEdgeCount += expected.length;
      expect(new Set(actual)).toEqual(new Set(expected));
      expect(actual).toHaveLength(expected.length);
    }
    expect(reference.carrierAdjacency.semantics).toBe("all-directed-parent-pair-outcomes");
    expect(reference.carrierAdjacency.edgeCount).toBe(expectedEdgeCount);
  });

  it("covers every unordered pair outcome in the reverse index", () => {
    const expected = new Set<string>();
    for (let parentAId = 0; parentAId < reference.pals.length; parentAId += 1) {
      for (let parentBId = parentAId; parentBId < reference.pals.length; parentBId += 1) {
        for (const edge of getChildrenForPair(parentAId, parentBId)) {
          expected.add(
            `${parentAId}|${parentBId}|${edge.carrierGender}|${edge.mateGender}|${edge.childId}|${edge.rule}|${edge.rowId ?? ""}`,
          );
        }
      }
    }

    const actual = new Set<string>();
    for (let childId = 0; childId < reference.pals.length; childId += 1) {
      for (const entry of getParentEntries(childId)) {
        actual.add(
          `${entry.parentAId}|${entry.parentBId}|${entry.parentAGender}|${entry.parentBGender}|${entry.childId}|${entry.rule}|${entry.rowId ?? ""}`,
        );
      }
    }
    expect(actual).toEqual(expected);
  });

  it("contains no secret-like deployment values", () => {
    const serialized = JSON.stringify(reference);
    expect(serialized).not.toContain("CLOUDFLARE_API_TOKEN=");
    expect(serialized).not.toContain("CLOUDFLARE_ACCOUNT_ID=");
    expect(serialized).not.toContain("BREEDING_READ_TOKEN=");
  });

  it("indexes both orientations when only one gender direction is special", () => {
    const syntheticPals: PalValue[] = [
      ["ParentA", 100],
      ["ParentB", 300],
      ["FormulaChild", 200],
      ["SpecialChild", 250],
    ].map(([internalName, rank], index) => ({
      internal_name: String(internalName),
      name_de: String(internalName),
      name_en: String(internalName),
      paldex_no: index + 1,
      is_variant: false,
      combi_rank: Number(rank),
      rarity: 1,
      ignore_combi: false,
      combi_duplicate_priority: 0,
      internal_index: index + 1,
      game_table_row: String(internalName),
    }));
    const syntheticSpecials: SpecialCombination[] = [
      {
        row_id: "synthetic-one-way",
        parent_a_internal: "ParentA",
        parent_a_de: "ParentA",
        parent_a_en: "ParentA",
        parent_b_internal: "ParentB",
        parent_b_de: "ParentB",
        parent_b_en: "ParentB",
        child_internal: "SpecialChild",
        child_de: "SpecialChild",
        child_en: "SpecialChild",
        parent_a_gender: "FEMALE",
        parent_b_gender: "MALE",
      },
    ];
    const engine = createBreedingEngine(syntheticPals, syntheticSpecials);
    const packed = buildPackedData(syntheticPals, engine);
    const ordinal = triangularPairOrdinal(0, 1, syntheticPals.length);
    const outcomes = packed.genderOverrides
      .filter(({ pairOrdinal }) => pairOrdinal === ordinal)
      .map(({ parentAGender, parentBGender, childId, ruleCode, rowId }) => ({
        parentAGender,
        parentBGender,
        childId,
        ruleCode,
        rowId: rowId ?? null,
      }));
    expect(outcomes).toEqual([
      {
        parentAGender: "MALE",
        parentBGender: "FEMALE",
        childId: 2,
        ruleCode: RULE_CODE.normal_formula,
        rowId: null,
      },
      {
        parentAGender: "FEMALE",
        parentBGender: "MALE",
        childId: 3,
        ruleCode: RULE_CODE.special_combination,
        rowId: "synthetic-one-way",
      },
    ]);

    const matrixChildren = decodeUint16(packed.pairMatrix.childIdsBase64);
    expect(matrixChildren[ordinal]).toBe(2);
    const reverseOrdinals = decodeUint32(packed.parentsByChild.pairOrdinalsBase64);
    expect([...reverseOrdinals]).not.toContain(ordinal);

    const adjacencyOffsets = decodeUint32(packed.carrierAdjacency.offsetsBase64);
    const adjacencyChildren = decodeUint16(packed.carrierAdjacency.childIdsBase64);
    const adjacencyMates = decodeUint16(packed.carrierAdjacency.mateIdsBase64);
    const adjacencyRules = decodeUint8(packed.carrierAdjacency.ruleCodesBase64);
    const carrierGenders = decodeUint8(packed.carrierAdjacency.carrierGendersBase64);
    const mateGenders = decodeUint8(packed.carrierAdjacency.mateGendersBase64);
    const start = adjacencyOffsets[0] ?? 0;
    const end = adjacencyOffsets[1] ?? 0;
    const carrierOutcomes = [];
    for (let cursor = start; cursor < end; cursor += 1) {
      if (adjacencyMates[cursor] !== 1) continue;
      carrierOutcomes.push({
        childId: adjacencyChildren[cursor],
        ruleCode: adjacencyRules[cursor],
        carrierGender: carrierGenders[cursor],
        mateGender: mateGenders[cursor],
      });
    }
    expect(carrierOutcomes).toEqual([
      {
        childId: 3,
        ruleCode: RULE_CODE.special_combination,
        carrierGender: 2,
        mateGender: 1,
      },
      {
        childId: 2,
        ruleCode: RULE_CODE.normal_formula,
        carrierGender: 1,
        mateGender: 2,
      },
    ]);
  });
});
