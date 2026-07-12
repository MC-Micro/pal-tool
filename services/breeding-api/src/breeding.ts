import {
  RULE_CODE,
  type BreedingEngine,
  type Gender,
  type GenderAlternative,
  type PalValue,
  type PreparedSpecialCombination,
  type ResolvedPair,
  type SpecialCombination,
} from "./types.ts";

const COMBINING_MARKS = /\p{M}+/gu;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function normalizePalName(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(NON_ALPHANUMERIC, "");
}

export function triangularPairCount(palCount: number): number {
  if (!Number.isSafeInteger(palCount) || palCount < 0) {
    throw new RangeError(`Invalid pal count: ${palCount}`);
  }
  return (palCount * (palCount + 1)) / 2;
}

export function triangularPairOrdinal(parentAId: number, parentBId: number, palCount: number): number {
  assertPalId(parentAId, palCount);
  assertPalId(parentBId, palCount);
  const lower = Math.min(parentAId, parentBId);
  const upper = Math.max(parentAId, parentBId);
  const rowOffset = lower * palCount - (lower * (lower - 1)) / 2;
  return rowOffset + (upper - lower);
}

export function triangularPairFromOrdinal(ordinal: number, palCount: number): [number, number] {
  const count = triangularPairCount(palCount);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= count) {
    throw new RangeError(`Invalid pair ordinal: ${ordinal}`);
  }

  let row = 0;
  let rowOffset = 0;
  while (ordinal >= rowOffset + palCount - row) {
    rowOffset += palCount - row;
    row += 1;
  }
  return [row, row + ordinal - rowOffset];
}

function assertPalId(id: number, palCount: number): void {
  if (!Number.isSafeInteger(id) || id < 0 || id >= palCount) {
    throw new RangeError(`Invalid pal id ${id}; expected 0..${palCount - 1}`);
  }
}

function pairKey(parentAId: number, parentBId: number): string {
  return parentAId <= parentBId ? `${parentAId}:${parentBId}` : `${parentBId}:${parentAId}`;
}

function compareRowIds(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right, "en");
}

export function buildAliasMap(pals: readonly PalValue[]): Record<string, number[]> {
  const aliases = new Map<string, Set<number>>();
  pals.forEach((pal, id) => {
    const values = [pal.internal_name, pal.game_table_row, pal.name_de, pal.name_en];
    for (const value of values) {
      const normalized = normalizePalName(value);
      if (normalized.length === 0) continue;
      const ids = aliases.get(normalized) ?? new Set<number>();
      ids.add(id);
      aliases.set(normalized, ids);
    }
  });

  return Object.fromEntries(
    [...aliases.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([alias, ids]) => [alias, [...ids].sort((left, right) => left - right)]),
  );
}

function resolveSameRankDuplicate(candidates: readonly PalValue[], pals: readonly PalValue[]): PalValue {
  if (candidates.length === 0) throw new Error("Cannot resolve an empty candidate list");
  const ranks = new Set(candidates.map((candidate) => candidate.combi_rank));
  if (ranks.size !== 1) {
    const names = candidates.map((candidate) => candidate.internal_name).join(", ");
    throw new Error(`Undocumented cross-rank tie remains after rarity rules: ${names}`);
  }

  const sorted = [...candidates].sort((left, right) => {
    if (left.combi_duplicate_priority !== right.combi_duplicate_priority) {
      return right.combi_duplicate_priority - left.combi_duplicate_priority;
    }
    if (left.is_variant !== right.is_variant) return left.is_variant ? 1 : -1;
    return left.internal_index - right.internal_index;
  });
  const winner = sorted[0];
  if (winner === undefined || !pals.includes(winner)) {
    throw new Error("Same-rank resolution produced an unknown candidate");
  }
  return winner;
}

function resolveFormula(
  pals: readonly PalValue[],
  eligible: readonly PalValue[],
  palIds: ReadonlyMap<PalValue, number>,
  parentAId: number,
  parentBId: number,
): ResolvedPair {
  const parentA = pals[parentAId];
  const parentB = pals[parentBId];
  if (parentA === undefined || parentB === undefined) throw new Error("Parent id not found");

  const targetRank = Math.floor((parentA.combi_rank + parentB.combi_rank + 1) / 2);
  let rankDistance = Number.POSITIVE_INFINITY;
  for (const candidate of eligible) {
    rankDistance = Math.min(rankDistance, Math.abs(candidate.combi_rank - targetRank));
  }

  let candidates = eligible.filter(
    (candidate) => Math.abs(candidate.combi_rank - targetRank) === rankDistance,
  );
  const nearestCandidateIds = candidates.map((candidate) => {
    const id = palIds.get(candidate);
    if (id === undefined) throw new Error(`Candidate ${candidate.internal_name} lacks an id`);
    return id;
  });
  const appliedTieBreaks: string[] = [];
  const nearestRanks = new Set(candidates.map((candidate) => candidate.combi_rank));
  const parentRarityAverage = (parentA.rarity + parentB.rarity) / 2;

  if (nearestRanks.size > 1) {
    const rarityDistance = Math.min(
      ...candidates.map((candidate) => Math.abs(candidate.rarity - parentRarityAverage)),
    );
    candidates = candidates.filter(
      (candidate) => Math.abs(candidate.rarity - parentRarityAverage) === rarityDistance,
    );
    appliedTieBreaks.push("equidistant_different_ranks_parent_rarity_average");

    if (candidates.length > 1) {
      const lowerRarity = Math.min(...candidates.map((candidate) => candidate.rarity));
      candidates = candidates.filter((candidate) => candidate.rarity === lowerRarity);
      appliedTieBreaks.push("equidistant_rarity_lower_rarity");
    }

    const remainingRanks = new Set(candidates.map((candidate) => candidate.combi_rank));
    if (remainingRanks.size > 1) {
      // breeding_rules.json does not name this final equal-rarity case. The pinned
      // PalworldSaveTools generator listed in manifest.json examines the upper
      // bisect neighbor first and retains it when rank distance and rarity are
      // both identical, which is equivalent to selecting the higher rank.
      const higherRank = Math.max(...candidates.map((candidate) => candidate.combi_rank));
      candidates = candidates.filter((candidate) => candidate.combi_rank === higherRank);
      appliedTieBreaks.push("equidistant_equal_rarity_higher_combi_rank_source_order");
    }
  }

  if (candidates.length > 1) appliedTieBreaks.push("same_rank_duplicate_resolution");
  const winner = resolveSameRankDuplicate(candidates, pals);
  const childId = palIds.get(winner);
  if (childId === undefined) throw new Error(`Winner ${winner.internal_name} lacks an id`);

  return {
    kind: "resolved",
    rule: "normal_formula",
    ruleCode: RULE_CODE.normal_formula,
    parentAId,
    parentBId,
    childId,
    targetRank,
    rankDistance,
    parentRarityAverage,
    nearestCandidateIds,
    appliedTieBreaks,
  };
}

function orientAlternative(
  row: PreparedSpecialCombination,
  requestedParentAId: number,
  requestedParentBId: number,
): GenderAlternative {
  if (row.parentAId === requestedParentAId && row.parentBId === requestedParentBId) {
    return {
      rowId: row.row_id,
      parentAId: requestedParentAId,
      parentAGender: row.parent_a_gender,
      parentBId: requestedParentBId,
      parentBGender: row.parent_b_gender,
      childId: row.childId,
    };
  }
  return {
    rowId: row.row_id,
    parentAId: requestedParentAId,
    parentAGender: row.parent_b_gender,
    parentBId: requestedParentBId,
    parentBGender: row.parent_a_gender,
    childId: row.childId,
  };
}

function genderCompatible(supplied: Gender, required: Gender): boolean {
  return supplied === "ANY" || required === "ANY" || supplied === required;
}

export function createBreedingEngine(
  pals: readonly PalValue[],
  specialCombinations: readonly SpecialCombination[],
): BreedingEngine {
  if (pals.length === 0) throw new Error("At least one pal is required");

  const internalIds = new Map<string, number>();
  const palIds = new Map<PalValue, number>();
  pals.forEach((pal, id) => {
    if (internalIds.has(pal.internal_name)) {
      throw new Error(`Duplicate internal pal name: ${pal.internal_name}`);
    }
    internalIds.set(pal.internal_name, id);
    palIds.set(pal, id);
  });

  const eligible = pals.filter((pal) => pal.combi_rank > 0 && !pal.ignore_combi);
  if (eligible.length === 0) throw new Error("Normal breeding has no eligible child candidates");
  const aliases = buildAliasMap(pals);
  const specialsByPair = new Map<string, PreparedSpecialCombination[]>();

  for (const row of specialCombinations) {
    const parentAId = internalIds.get(row.parent_a_internal);
    const parentBId = internalIds.get(row.parent_b_internal);
    const childId = internalIds.get(row.child_internal);
    if (parentAId === undefined || parentBId === undefined || childId === undefined) {
      throw new Error(`Special combination ${row.row_id} references an unknown pal`);
    }
    const prepared: PreparedSpecialCombination = { ...row, parentAId, parentBId, childId };
    const key = pairKey(parentAId, parentBId);
    const rows = specialsByPair.get(key) ?? [];
    rows.push(prepared);
    specialsByPair.set(key, rows);
  }

  for (const rows of specialsByPair.values()) {
    rows.sort((left, right) => compareRowIds(left.row_id, right.row_id));
  }

  const getSpecials = (parentAId: number, parentBId: number): readonly PreparedSpecialCombination[] => {
    assertPalId(parentAId, pals.length);
    assertPalId(parentBId, pals.length);
    return specialsByPair.get(pairKey(parentAId, parentBId)) ?? [];
  };

  const resolveBasePair = (parentAId: number, parentBId: number): ResolvedPair => {
    assertPalId(parentAId, pals.length);
    assertPalId(parentBId, pals.length);
    if (parentAId === parentBId) {
      return {
        kind: "resolved",
        rule: "same_species",
        ruleCode: RULE_CODE.same_species,
        parentAId,
        parentBId,
        childId: parentAId,
      };
    }

    const universal = getSpecials(parentAId, parentBId).filter(
      (row) => row.parent_a_gender === "ANY" && row.parent_b_gender === "ANY",
    );
    if (universal.length > 1) {
      throw new Error(`Multiple universal special combinations exist for ${pairKey(parentAId, parentBId)}`);
    }
    const row = universal[0];
    if (row !== undefined) {
      return {
        kind: "resolved",
        rule: "special_combination",
        ruleCode: RULE_CODE.special_combination,
        parentAId,
        parentBId,
        childId: row.childId,
        rowId: row.row_id,
      };
    }
    return resolveFormula(pals, eligible, palIds, parentAId, parentBId);
  };

  return {
    pals,
    aliases,
    resolveName(name: string): readonly number[] {
      return aliases[normalizePalName(name)] ?? [];
    },
    resolveBasePair,
    resolvePair(
      parentAId: number,
      parentBId: number,
      parentAGender: Gender = "ANY",
      parentBGender: Gender = "ANY",
    ) {
      if (
        parentAGender !== "ANY" &&
        parentBGender !== "ANY" &&
        parentAGender === parentBGender
      ) {
        throw new RangeError("Palworld breeding requires opposite parent genders");
      }
      const fallback = resolveBasePair(parentAId, parentBId);
      if (fallback.rule === "same_species" || fallback.rule === "special_combination") return fallback;

      const genderRows = getSpecials(parentAId, parentBId).filter(
        (row) => row.parent_a_gender !== "ANY" || row.parent_b_gender !== "ANY",
      );
      if (genderRows.length === 0) return fallback;

      const alternatives = genderRows
        .map((row) => orientAlternative(row, parentAId, parentBId))
        .filter(
          (alternative) =>
            genderCompatible(parentAGender, alternative.parentAGender) &&
            genderCompatible(parentBGender, alternative.parentBGender),
        );

      if (parentAGender === "ANY" || parentBGender === "ANY") {
        if (alternatives.length === 0) return fallback;
        return { kind: "unresolved_gender", parentAId, parentBId, alternatives, fallback };
      }

      const matched = alternatives.filter(
        (alternative) =>
          alternative.parentAGender === parentAGender && alternative.parentBGender === parentBGender,
      );
      if (matched.length === 0) return fallback;
      const childIds = new Set(matched.map((alternative) => alternative.childId));
      if (childIds.size !== 1) {
        throw new Error(`Gender-specific special rows disagree for ${pairKey(parentAId, parentBId)}`);
      }
      const match = matched[0];
      if (match === undefined) return fallback;
      return {
        kind: "resolved",
        rule: "special_combination",
        ruleCode: RULE_CODE.special_combination,
        parentAId,
        parentBId,
        childId: match.childId,
        rowId: match.rowId,
      };
    },
    getSpecials,
  };
}
