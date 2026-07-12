import { describe, expect, it } from "vitest";

import referenceJson from "../generated/reference.json";
import {
  createBreedingEngine,
  normalizePalName,
  triangularPairFromOrdinal,
  triangularPairOrdinal,
} from "../src/breeding.ts";
import type { GeneratedReference, Gender } from "../src/types.ts";

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

describe("canonical breeding engine", () => {
  it.each([
    ["FairyDragon", "Serpent", "FairyDragon_Water", "special_combination"],
    ["Anubis", "Deer_Ground", "KingAlpaca_Ice", "normal_formula"],
    ["KingAlpaca_Ice", "Hedgehog", "FairyDragon", "normal_formula"],
    ["Anubis", "Anubis", "Anubis", "same_species"],
    ["WhiteMoth", "SheepBall", "SharkKid_Fire", "normal_formula"],
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
