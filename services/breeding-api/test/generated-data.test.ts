import { describe, expect, it } from "vitest";

import referenceJson from "../generated/reference.json";
import { triangularPairFromOrdinal } from "../src/breeding.ts";
import { getCarrierEdges, getChildrenForPair, getParentEntries } from "../src/reference.ts";
import { RULE_CODE, type GeneratedReference } from "../src/types.ts";
import {
  buildReference,
  validateCanonicalInputs,
  type CanonicalInputs,
} from "../scripts/build-reference.ts";

const reference = referenceJson as GeneratedReference;

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
    expect(reference.dataHash).toBe("febbf5f9fb594040d027724d20c9a475aea466f8d5b7ab1d6faa304a1257e26f");
  });

  it("rejects typed schema drift before generation", () => {
    const invalid: CanonicalInputs = structuredClone({
      rules: reference.canonical.rules,
      specials: reference.canonical.specialCombinations,
      pals: reference.pals,
      manifest: reference.canonical.manifest,
      sourceFiles: reference.sourceFiles,
      dataHash: reference.dataHash,
    });
    const firstPal = invalid.pals[0];
    if (firstPal === undefined) throw new Error("Missing first Pal fixture");
    Reflect.set(firstPal, "ignore_combi", "false");
    expect(() => validateCanonicalInputs(invalid)).toThrow("ignore_combi must be a boolean");
  });

  it("contains all canonical records and the documented blocking conflict", () => {
    expect(reference.status.palCount).toBe(299);
    expect(reference.status.specialCombinationCount).toBe(136);
    expect(reference.status.validationStatus).toBe("needs_review");
    expect(reference.validation.conflicts.map(({ code }) => code)).toContain(
      "SIBELYX_LAMBALL_ASSIGNMENT_CONFLICT",
    );
    const scope = reference.validation.conflicts.find(
      ({ code }) => code === "SIBELYX_LAMBALL_ASSIGNMENT_CONFLICT",
    )?.scope;
    expect(scope).toMatchObject({
      eligible_special_child_species: 77,
      potentially_affected_unordered_pairs: 13_785,
    });
  });

  it("keeps every normal-formula child eligible", () => {
    const children = decodeUint16(reference.pairMatrix.childIdsBase64);
    const rules = decodeUint8(reference.pairMatrix.ruleCodesBase64);
    for (let ordinal = 0; ordinal < children.length; ordinal += 1) {
      if (rules[ordinal] !== RULE_CODE.normal_formula) continue;
      const child = reference.pals[children[ordinal] ?? -1];
      expect(child?.combi_rank).toBeGreaterThan(0);
      expect(child?.ignore_combi).toBe(false);
    }
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
});
