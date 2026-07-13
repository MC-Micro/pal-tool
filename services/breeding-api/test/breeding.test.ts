import { describe, expect, it } from "vitest";

import referenceJson from "../generated/reference.json";
import {
  createBreedingEngine,
  normalizePalName,
  triangularPairFromOrdinal,
  triangularPairOrdinal,
} from "../src/breeding.ts";
import type {
  GeneratedReference,
  Gender,
  PalValue,
  SpecialCombination,
} from "../src/types.ts";

const reference = referenceJson as GeneratedReference;
const engine = createBreedingEngine(reference.pals, reference.canonical.specialCombinations);

function id(internalName: string): number {
  const result = reference.pals.findIndex((pal) => pal.internal_name === internalName);
  if (result < 0) throw new Error(`Missing fixture pal ${internalName}`);
  return result;
}

function internalName(childId: number): string {
  const pal = reference.pals[childId];
  if (pal === undefined) throw new Error(`Unknown child id ${childId}`);
  return pal.internal_name;
}

function aliasId(name: string): number {
  const ids = engine.resolveName(name);
  if (ids.length !== 1 || ids[0] === undefined) throw new Error(`Ambiguous fixture alias ${name}`);
  return ids[0];
}

function decodeUint16(base64: string): Uint16Array {
  const bytes = Buffer.from(base64, "base64");
  const copy = Uint8Array.from(bytes);
  return new Uint16Array(copy.buffer);
}

function syntheticPal(internalName: string, combiRank: number, internalIndex: number): PalValue {
  return {
    internal_name: internalName,
    name_de: internalName,
    name_en: internalName,
    paldex_no: internalIndex,
    is_variant: false,
    combi_rank: combiRank,
    rarity: 1,
    ignore_combi: false,
    combi_duplicate_priority: combiRank * 100,
    internal_index: internalIndex,
    game_table_row: internalName,
  };
}

function oneSidedSpecialFixture(specialRank = 250): {
  pals: PalValue[];
  specials: SpecialCombination[];
} {
  const pals = [
    syntheticPal("ParentA", 100, 1),
    syntheticPal("ParentB", 300, 2),
    syntheticPal("FormulaChild", 210, 3),
    syntheticPal("SpecialChild", specialRank, 4),
  ];
  const specials: SpecialCombination[] = [
    {
      row_id: "synthetic-one-sided",
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
  return { pals, specials };
}

describe("canonical breeding engine", () => {
  it.each([
    ["FairyDragon", "Serpent", "FairyDragon_Water", "special_combination"],
    ["Anubis", "Deer_Ground", "OniGhostGirl", "normal_formula"],
    ["KingAlpaca_Ice", "Hedgehog", "FairyDragon", "normal_formula"],
    ["Anubis", "Anubis", "Anubis", "same_species"],
    ["SharkKid_Fire", "SharkKid_Fire", "SharkKid_Fire", "same_species"],
    ["SharkKid", "FlameBambi", "SharkKid_Fire", "special_combination"],
    ["WhiteMoth", "SheepBall", "Serpent", "normal_formula"],
  ])("resolves %s + %s canonically", (left, right, child, rule) => {
    const result = engine.resolveBasePair(id(left), id(right));
    expect(internalName(result.childId)).toBe(child);
    expect(result.rule).toBe(rule);
  });

  it("does not use sparse internal_index values as dense ids", () => {
    expect(reference.pals.some((pal, denseId) => pal.internal_index !== denseId)).toBe(true);
    expect(new Set(reference.pals.map((pal) => pal.internal_index)).size).toBe(reference.pals.length);
  });

  it.each([
    ["Braloha", "Dynamoff", "Quivern"],
    ["Shaolong", "Helzephyr Lux", "Dualith"],
    ["Braloha", "Jetragon", "Silvegis"],
  ])("matches the independent rarity tie-break fixture %s + %s", (left, right, expected) => {
    const result = engine.resolveBasePair(aliasId(left), aliasId(right));
    expect(reference.pals[result.childId]?.name_en).toBe(expected);
  });

  it("selects the higher CombiRank for the fully equal Lunaris/Grintale cross-rank tie", () => {
    const result = engine.resolveBasePair(id("Mutant"), id("NaughtyCat"));
    expect(internalName(result.childId)).toBe("CaptainPenguin");
    expect(result.targetRank).toBe(2065);
    expect(result.nearestCandidateIds?.map(internalName)).toEqual([
      "GrassPanda",
      "CaptainPenguin",
    ]);
    expect(result.appliedTieBreaks).toContain(
      "equidistant_equal_rarity_higher_combi_rank",
    );
  });

  it("never uses paldex numbers as breeding values or tie-breakers", () => {
    const changedPaldex = reference.pals.map((pal, index) => ({
      ...pal,
      paldex_no: 100_000 - index,
    }));
    const independent = createBreedingEngine(
      changedPaldex,
      reference.canonical.specialCombinations,
    );
    const result = independent.resolveBasePair(id("Mutant"), id("NaughtyCat"));
    expect(changedPaldex[result.childId]?.internal_name).toBe("CaptainPenguin");
  });

  it("resolves the duplicate rank 2950 to non-variant Gumoss", () => {
    const result = engine.resolveBasePair(id("SheepBall"), id("Hedgehog_Ice"));
    expect(internalName(result.childId)).toBe("PlantSlime");
    expect(result.appliedTieBreaks).toContain("same_rank_duplicate_resolution");
  });

  it("resolves every direct special row in both parent orders", () => {
    for (const row of reference.canonical.specialCombinations) {
      const parentA = id(row.parent_a_internal);
      const parentB = id(row.parent_b_internal);
      const child = id(row.child_internal);
      const forward = engine.resolvePair(parentA, parentB, row.parent_a_gender, row.parent_b_gender);
      const reverse = engine.resolvePair(parentB, parentA, row.parent_b_gender, row.parent_a_gender);
      expect(forward.kind).toBe("resolved");
      expect(reverse.kind).toBe("resolved");
      if (forward.kind === "resolved") expect(forward.childId).toBe(child);
      if (reverse.kind === "resolved") expect(reverse.childId).toBe(child);
    }
  });

  it("normalizes aliases without guessing ambiguous Gumoss", () => {
    expect(normalizePalName("  Elphidran-Aqua ")).toBe("elphidranaqua");
    const gumoss = engine.resolveName("Gumoss");
    expect(gumoss.map((palId) => internalName(palId))).toEqual(["PlantSlime", "PlantSlime_Flower"]);
  });

  it("honors both gender-specific Katress/Wixen outcomes and reversed parent order", () => {
    const katress = id("CatMage");
    const wixen = id("FoxMage");
    const cases: Array<[number, number, Gender, Gender, string]> = [
      [katress, wixen, "FEMALE", "MALE", "CatMage_Fire"],
      [katress, wixen, "MALE", "FEMALE", "FoxMage_Dark"],
      [wixen, katress, "MALE", "FEMALE", "CatMage_Fire"],
      [wixen, katress, "FEMALE", "MALE", "FoxMage_Dark"],
    ];
    for (const [parentA, parentB, genderA, genderB, child] of cases) {
      const result = engine.resolvePair(parentA, parentB, genderA, genderB);
      expect(result.kind).toBe("resolved");
      if (result.kind === "resolved") expect(internalName(result.childId)).toBe(child);
    }
    expect(engine.resolvePair(katress, wixen).kind).toBe("unresolved_gender");
    expect(() => engine.resolvePair(katress, wixen, "MALE", "MALE")).toThrow(RangeError);
  });

  it("resolves both real orientations and falls back to the formula for a one-sided special", () => {
    const { pals, specials } = oneSidedSpecialFixture();
    const synthetic = createBreedingEngine(pals, specials);

    const special = synthetic.resolvePair(0, 1, "FEMALE", "MALE");
    expect(special).toMatchObject({
      kind: "resolved",
      rule: "special_combination",
      childId: 3,
      rowId: "synthetic-one-sided",
    });

    const formula = synthetic.resolvePair(0, 1, "MALE", "FEMALE");
    expect(formula).toMatchObject({ kind: "resolved", rule: "normal_formula", childId: 2 });

    const reversedSpecial = synthetic.resolvePair(1, 0, "MALE", "FEMALE");
    expect(reversedSpecial).toMatchObject({
      kind: "resolved",
      rule: "special_combination",
      childId: 3,
    });
    const reversedFormula = synthetic.resolvePair(1, 0, "FEMALE", "MALE");
    expect(reversedFormula).toMatchObject({
      kind: "resolved",
      rule: "normal_formula",
      childId: 2,
    });
  });

  it("returns two structured outcomes for ANY when the real orientations differ", () => {
    const { pals, specials } = oneSidedSpecialFixture();
    const synthetic = createBreedingEngine(pals, specials);
    const result = synthetic.resolvePair(0, 1);

    expect(result.kind).toBe("unresolved_gender");
    if (result.kind !== "unresolved_gender") return;
    expect(result.alternatives).toEqual([
      expect.objectContaining({
        parentAGender: "MALE",
        parentBGender: "FEMALE",
        childId: 2,
        rule: "normal_formula",
        ruleCode: 3,
      }),
      expect.objectContaining({
        parentAGender: "FEMALE",
        parentBGender: "MALE",
        childId: 3,
        rule: "special_combination",
        ruleCode: 2,
        rowId: "synthetic-one-sided",
      }),
    ]);
    expect(result.alternatives[0]).not.toHaveProperty("rowId");

    expect(synthetic.resolvePair(0, 1, "ANY", "MALE")).toMatchObject({
      kind: "resolved",
      rule: "special_combination",
      childId: 3,
    });
    expect(synthetic.resolvePair(0, 1, "ANY", "FEMALE")).toMatchObject({
      kind: "resolved",
      rule: "normal_formula",
      childId: 2,
    });
  });

  it("collapses ANY only when both real orientations have the same complete outcome", () => {
    const { pals } = oneSidedSpecialFixture();
    const synthetic = createBreedingEngine(pals, []);
    expect(synthetic.resolvePair(0, 1)).toMatchObject({
      kind: "resolved",
      rule: "normal_formula",
      childId: 2,
    });
  });

  it("applies same-species identity before explicit gender compatibility", () => {
    const { pals } = oneSidedSpecialFixture();
    const synthetic = createBreedingEngine(pals, []);
    expect(synthetic.resolvePair(0, 0, "MALE", "MALE")).toMatchObject({
      kind: "resolved",
      rule: "same_species",
      childId: 0,
    });
  });

  it("excludes special-only children from the formula by default but supports legacy impact reports", () => {
    const { pals, specials } = oneSidedSpecialFixture(200);
    const current = createBreedingEngine(pals, specials);
    const legacy = createBreedingEngine(pals, specials, {
      excludeSpecialChildrenFromFormula: false,
    });

    expect(current.resolveBasePair(0, 1)).toMatchObject({
      rule: "normal_formula",
      childId: 2,
    });
    expect(legacy.resolveBasePair(0, 1)).toMatchObject({
      rule: "normal_formula",
      childId: 3,
    });
  });

  it("round-trips every triangular pair ordinal", () => {
    for (let ordinal = 0; ordinal < reference.pairMatrix.count; ordinal += 1) {
      const [left, right] = triangularPairFromOrdinal(ordinal, reference.pals.length);
      expect(triangularPairOrdinal(left, right, reference.pals.length)).toBe(ordinal);
    }
  });

  it("matches all 44,850 precomputed base pair children", () => {
    const children = decodeUint16(reference.pairMatrix.childIdsBase64);
    expect(children.length).toBe(44_850);
    for (let left = 0; left < reference.pals.length; left += 1) {
      for (let right = left; right < reference.pals.length; right += 1) {
        const ordinal = triangularPairOrdinal(left, right, reference.pals.length);
        expect(children[ordinal]).toBe(engine.resolveBasePair(left, right).childId);
      }
    }
  });
});
