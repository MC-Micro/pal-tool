import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createBreedingEngine,
  triangularPairCount,
  triangularPairOrdinal,
} from "../src/breeding.ts";
import {
  RULE_CODE,
  type AssignmentConflict,
  type BreedingRulesFile,
  type CanonicalManifest,
  type Gender,
  type GenderOverride,
  type GeneratedReference,
  type PalValue,
  type ResolvedPair,
  type SourceFileHash,
  type SpecialCombination,
} from "../src/types.ts";

const API_SCHEMA_VERSION = 2;
const REFERENCE_SCHEMA_VERSION = 2;
const SOURCE_PATHS = [
  "data/palworld-breeding/breeding_rules.json",
  "data/palworld-breeding/special_combinations.json",
  "data/palworld-breeding/pal_values.json",
  "data/palworld-breeding/manifest.json",
] as const;
const REQUIRED_DECISION_ORDER = [
  "same_species_identity_override",
  "unique_combo_override",
  "eligible_candidate_pool",
  "rounded_average",
  "nearest_combi_rank",
  "equidistant_different_ranks_parent_rarity_average",
  "equidistant_rarity_lower_rarity",
  "equidistant_equal_rarity_higher_combi_rank",
  "same_rank_duplicate_resolution",
] as const;
const GENDER_CODE: Record<Gender, number> = { ANY: 0, MALE: 1, FEMALE: 2 };
const IMPLEMENTATION_NOTES = [
  "Direct Palworld 1.0 egg tests on 2026-07-13 resolved both former release blockers: special children are excluded from normal-formula candidates, and fully equal cross-rank ties select the higher CombiRank.",
  "Same-species identity remains the first rule, including for species that are otherwise direct-special children.",
  "Palworld.gg is documented only as a non-authoritative manual cross-check and is never queried by the build or Worker.",
] as const;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const apiDirectory = resolve(scriptDirectory, "..");
export const repositoryRoot = resolve(apiDirectory, "..", "..");
export const generatedReferencePath = resolve(apiDirectory, "generated", "reference.json");
export const specialChildImpactPath = resolve(
  apiDirectory,
  "generated",
  "special-child-impact.json",
);

export interface CanonicalInputs {
  rules: BreedingRulesFile;
  specials: SpecialCombination[];
  pals: PalValue[];
  manifest: CanonicalManifest;
  sourceFiles: SourceFileHash[];
  sourceDataHash: string;
}

interface PairOutcome {
  childId: number;
  ruleCode: number;
  carrierGender: Gender;
  mateGender: Gender;
}

interface CarrierWitness extends PairOutcome {
  mateId: number;
}

export interface SpecialChildImpactChange {
  pairOrdinal: number;
  parentAInternal: string;
  parentBInternal: string;
  previousChildInternal: string;
  currentChildInternal: string;
  affectedSpecialChildSpecies: string[];
  pairItselfSpecial: boolean;
  knownRouteLabels: string[];
}

export interface SpecialChildImpactReport {
  schemaVersion: 1;
  sourceDataHash: string;
  contentHash: string;
  pairCount: number;
  changedPairCount: number;
  legacyEligibleChildCount: number;
  currentEligibleChildCount: number;
  specialChildSpeciesCount: number;
  excludedEligibleSpecialChildCount: number;
  affectedSpecialChildSpecies: string[];
  knownPairChecks: Array<{
    label: string;
    parentAInternal: string;
    parentBInternal: string;
    previousChildInternal: string;
    currentChildInternal: string;
    changed: boolean;
  }>;
  changes: SpecialChildImpactChange[];
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeSourceDataHash(sourceFiles: readonly SourceFileHash[]): string {
  return sha256(
    JSON.stringify(sourceFiles.map(({ path, sha256: hash, bytes }) => [path, hash, bytes])),
  );
}

function normalizeSourceText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function packUint8(values: readonly number[]): string {
  const buffer = Buffer.allocUnsafe(values.length);
  values.forEach((value, index) => buffer.writeUInt8(value, index));
  return buffer.toString("base64");
}

function packUint16(values: readonly number[]): string {
  const buffer = Buffer.allocUnsafe(values.length * 2);
  values.forEach((value, index) => buffer.writeUInt16LE(value, index * 2));
  return buffer.toString("base64");
}

function packUint32(values: readonly number[]): string {
  const buffer = Buffer.allocUnsafe(values.length * 4);
  values.forEach((value, index) => buffer.writeUInt32LE(value, index * 4));
  return buffer.toString("base64");
}

function requireArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be a top-level array`);
  return value as T[];
}

function requireObject<T>(value: unknown, name: string): T {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a top-level object`);
  }
  return value as T;
}

async function readCanonicalInputs(): Promise<CanonicalInputs> {
  const rawFiles = await Promise.all(
    SOURCE_PATHS.map(async (path) => {
      const raw = normalizeSourceText(await readFile(resolve(repositoryRoot, path), "utf8"));
      return { path, raw, sha256: sha256(raw), bytes: Buffer.byteLength(raw, "utf8") };
    }),
  );
  const parsed = rawFiles.map(({ raw }) => JSON.parse(raw) as unknown);
  const rules = requireObject<BreedingRulesFile>(parsed[0], SOURCE_PATHS[0]);
  const specials = requireArray<SpecialCombination>(parsed[1], SOURCE_PATHS[1]);
  const pals = requireArray<PalValue>(parsed[2], SOURCE_PATHS[2]);
  const manifest = requireObject<CanonicalManifest>(parsed[3], SOURCE_PATHS[3]);
  const sourceFiles = rawFiles.map(({ path, sha256: hash, bytes }) => ({ path, sha256: hash, bytes }));
  const sourceDataHash = computeSourceDataHash(sourceFiles);
  return { rules, specials, pals, manifest, sourceFiles, sourceDataHash };
}

export function validateCanonicalInputs(inputs: CanonicalInputs): void {
  const { rules, specials, pals, manifest } = inputs;
  const requireString = (value: unknown, field: string): void => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  };
  const requireInteger = (value: unknown, field: string, minimum = 0): void => {
    if (!Number.isSafeInteger(value) || (value as number) < minimum) {
      throw new TypeError(`${field} must be an integer >= ${minimum}`);
    }
  };
  requireInteger(rules.schema_version, "rules.schema_version", 1);
  requireString(rules.generated_at_utc, "rules.generated_at_utc");
  requireString(rules.game_reference, "rules.game_reference");
  if (!Array.isArray(rules.decision_order)) throw new TypeError("rules.decision_order must be an array");
  for (const [index, rule] of rules.decision_order.entries()) {
    requireInteger(rule.order, `rules.decision_order[${index}].order`, 1);
    requireString(rule.rule, `rules.decision_order[${index}].rule`);
    requireString(rule.description_de, `rules.decision_order[${index}].description_de`);
    if (rule.formula !== undefined && typeof rule.formula !== "string") {
      throw new TypeError(`rules.decision_order[${index}].formula must be a string`);
    }
  }
  requireInteger(manifest.schema_version, "manifest.schema_version", 1);
  requireString(manifest.generated_at_utc, "manifest.generated_at_utc");
  if (manifest.counts === null || typeof manifest.counts !== "object") {
    throw new TypeError("manifest.counts must be an object");
  }
  for (const [key, value] of Object.entries(manifest.counts)) {
    requireInteger(value, `manifest.counts.${key}`);
  }
  if (manifest.validation === null || typeof manifest.validation !== "object") {
    throw new TypeError("manifest.validation must be an object");
  }
  for (const [key, value] of Object.entries(manifest.validation)) {
    if (!Array.isArray(value)) throw new TypeError(`manifest.validation.${key} must be an array`);
  }
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new TypeError("manifest.sources must be a non-empty array");
  }
  for (const [index, source] of manifest.sources.entries()) {
    requireString(source.repository, `manifest.sources[${index}].repository`);
    requireString(source.commit, `manifest.sources[${index}].commit`);
    if (!Array.isArray(source.used_for)) {
      throw new TypeError(`manifest.sources[${index}].used_for must be an array`);
    }
  }
  if (rules.schema_version !== manifest.schema_version) {
    throw new Error(`Schema mismatch: rules=${rules.schema_version}, manifest=${manifest.schema_version}`);
  }
  if (rules.generated_at_utc !== manifest.generated_at_utc) {
    throw new Error("Rules and manifest generation timestamps differ");
  }
  if (manifest.counts.pal_values !== pals.length) {
    throw new Error(`Manifest pal count ${manifest.counts.pal_values} != ${pals.length}`);
  }
  if (manifest.counts.cross_species_special_combinations !== specials.length) {
    throw new Error(
      `Manifest special count ${manifest.counts.cross_species_special_combinations} != ${specials.length}`,
    );
  }
  const actualOrder = rules.decision_order.map(({ rule }) => rule);
  if (JSON.stringify(actualOrder) !== JSON.stringify(REQUIRED_DECISION_ORDER)) {
    throw new Error(`Unsupported canonical decision order: ${actualOrder.join(",")}`);
  }

  const internalNames = new Set<string>();
  const internalIndexes = new Set<number>();
  for (const [index, pal] of pals.entries()) {
    for (const [field, value] of [
      ["internal_name", pal.internal_name],
      ["name_de", pal.name_de],
      ["name_en", pal.name_en],
      ["game_table_row", pal.game_table_row],
    ] as const) {
      requireString(value, `pals[${index}].${field}`);
    }
    requireInteger(pal.paldex_no, `pals[${index}].paldex_no`);
    requireInteger(pal.combi_rank, `pals[${index}].combi_rank`, 1);
    requireInteger(pal.rarity, `pals[${index}].rarity`);
    requireInteger(pal.combi_duplicate_priority, `pals[${index}].combi_duplicate_priority`);
    requireInteger(pal.internal_index, `pals[${index}].internal_index`, 1);
    if (typeof pal.is_variant !== "boolean") {
      throw new TypeError(`pals[${index}].is_variant must be a boolean`);
    }
    if (typeof pal.ignore_combi !== "boolean") {
      throw new TypeError(`pals[${index}].ignore_combi must be a boolean`);
    }
    if (internalNames.has(pal.internal_name)) throw new Error(`Duplicate internal_name: ${pal.internal_name}`);
    if (internalIndexes.has(pal.internal_index)) {
      throw new Error(`Duplicate internal_index: ${pal.internal_index}`);
    }
    if (!Number.isSafeInteger(pal.combi_rank) || pal.combi_rank <= 0) {
      throw new Error(`Invalid combi_rank for ${pal.internal_name}: ${pal.combi_rank}`);
    }
    internalNames.add(pal.internal_name);
    internalIndexes.add(pal.internal_index);
  }
  if (manifest.counts.ranks_not_divisible_by_10 === 0) {
    const invalid = pals.find((pal) => pal.combi_rank % 10 !== 0);
    if (invalid !== undefined) throw new Error(`Rank is not divisible by 10: ${invalid.internal_name}`);
  }

  const rowIds = new Set<string>();
  for (const [index, row] of specials.entries()) {
    for (const [field, value] of [
      ["row_id", row.row_id],
      ["parent_a_internal", row.parent_a_internal],
      ["parent_a_de", row.parent_a_de],
      ["parent_a_en", row.parent_a_en],
      ["parent_b_internal", row.parent_b_internal],
      ["parent_b_de", row.parent_b_de],
      ["parent_b_en", row.parent_b_en],
      ["child_internal", row.child_internal],
      ["child_de", row.child_de],
      ["child_en", row.child_en],
    ] as const) {
      requireString(value, `specials[${index}].${field}`);
    }
    for (const [field, value] of [
      ["parent_a_gender", row.parent_a_gender],
      ["parent_b_gender", row.parent_b_gender],
    ] as const) {
      if (value !== "ANY" && value !== "MALE" && value !== "FEMALE") {
        throw new TypeError(`specials[${index}].${field} has invalid gender ${String(value)}`);
      }
    }
    if (rowIds.has(row.row_id)) throw new Error(`Duplicate special row_id: ${row.row_id}`);
    for (const internalName of [row.parent_a_internal, row.parent_b_internal, row.child_internal]) {
      if (!internalNames.has(internalName)) {
        throw new Error(`Special row ${row.row_id} references unknown pal ${internalName}`);
      }
    }
    rowIds.add(row.row_id);
  }

  const specialChildren = new Set(specials.map(({ child_internal }) => child_internal));
  const normalFormulaEligible = pals.filter(
    (pal) =>
      pal.combi_rank > 0 &&
      !pal.ignore_combi &&
      !specialChildren.has(pal.internal_name),
  );
  const excludedEligibleSpecialChildren = pals.filter(
    (pal) =>
      pal.combi_rank > 0 &&
      !pal.ignore_combi &&
      specialChildren.has(pal.internal_name),
  );
  const expectedCounts: Record<string, number> = {
    unique_special_child_species: specialChildren.size,
    normal_formula_eligible_children: normalFormulaEligible.length,
    eligible_special_child_species_excluded_from_normal_formula:
      excludedEligibleSpecialChildren.length,
    unordered_species_pairs_including_same_species: triangularPairCount(pals.length),
  };
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (manifest.counts[key] !== expected) {
      throw new Error(`Manifest count ${key}=${String(manifest.counts[key])}; expected ${expected}`);
    }
  }

  const patchCheck = manifest.patch_check;
  if (patchCheck === undefined) throw new Error("manifest.patch_check is required");
  if (patchCheck.status !== "current" && patchCheck.status !== "needs_review" && patchCheck.status !== "unknown") {
    throw new TypeError(`manifest.patch_check.status is invalid: ${String(patchCheck.status)}`);
  }
  requireString(patchCheck.checked_game_version, "manifest.patch_check.checked_game_version");
  requireString(patchCheck.checked_on, "manifest.patch_check.checked_on");
  if (patchCheck.checked_game_build !== null && typeof patchCheck.checked_game_build !== "string") {
    throw new TypeError("manifest.patch_check.checked_game_build must be a string or null");
  }
  if (typeof patchCheck.build_verified !== "boolean") {
    throw new TypeError("manifest.patch_check.build_verified must be a boolean");
  }
  if (typeof patchCheck.requires_recheck_after_newer_patch !== "boolean") {
    throw new TypeError(
      "manifest.patch_check.requires_recheck_after_newer_patch must be a boolean",
    );
  }
  if (!Array.isArray(patchCheck.evidence) || patchCheck.evidence.length < 2) {
    throw new TypeError("manifest.patch_check.evidence must contain the direct in-game tests");
  }
}

function findUniquePalId(pals: readonly PalValue[], internalName: string): number {
  const id = pals.findIndex((pal) => pal.internal_name === internalName);
  if (id < 0) throw new Error(`Required fixture pal is missing: ${internalName}`);
  return id;
}

function buildAssignmentConflicts(
  pals: readonly PalValue[],
  specials: readonly SpecialCombination[],
  resolveBasePair: (parentAId: number, parentBId: number) => ResolvedPair,
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];
  const sibelyxId = findUniquePalId(pals, "WhiteMoth");
  const lamballId = findUniquePalId(pals, "SheepBall");
  const surfentId = findUniquePalId(pals, "Serpent");
  const sibelyxActual = resolveBasePair(sibelyxId, lamballId);
  const specialChildNames = new Set(specials.map(({ child_internal }) => child_internal));
  if (sibelyxActual.childId !== surfentId || !specialChildNames.has("SharkKid_Fire")) {
    const actualPal = pals[sibelyxActual.childId];
    conflicts.push({
      code: "SIBELYX_LAMBALL_ASSIGNMENT_CONFLICT",
      description:
        "The direct Palworld 1.0 egg test requires Sibelyx + Lamball to yield Surfent under the global special-child exclusion rule.",
      parents: ["Sibelyx", "Lamball"],
      expected: "Surfent; Gobfin Ignis excluded from normal formula candidates",
      canonicalActual: actualPal?.name_en ?? `unknown child id ${sibelyxActual.childId}`,
      canonicalReason: `target=${sibelyxActual.targetRank}; special_child_set_contains_gobfin_ignis=${String(specialChildNames.has("SharkKid_Fire"))}`,
      blocking: true,
    });
  }

  const equalTieParentAId = findUniquePalId(pals, "Mutant");
  const equalTieParentBId = findUniquePalId(pals, "NaughtyCat");
  const penkingId = findUniquePalId(pals, "CaptainPenguin");
  const equalTieActual = resolveBasePair(equalTieParentAId, equalTieParentBId);
  const equalTieChild = pals[equalTieActual.childId];
  if (equalTieChild === undefined) throw new Error("Equal-rarity fixture child lookup failed");
  if (
    equalTieActual.childId !== penkingId ||
    !equalTieActual.appliedTieBreaks?.includes(
      "equidistant_equal_rarity_higher_combi_rank",
    )
  ) {
    conflicts.push({
      code: "UNDOCUMENTED_EQUAL_RARITY_SOURCE_ORDER_FALLBACK",
      description:
        "The direct Palworld 1.0 egg test requires the canonical higher-CombiRank rule for the fully equal cross-rank tie.",
      parents: ["Lunaris", "Grintale"],
      expected: "Penking via equidistant_equal_rarity_higher_combi_rank",
      canonicalActual: equalTieChild.name_en,
      canonicalReason: `target=${equalTieActual.targetRank}; applied=${equalTieActual.appliedTieBreaks?.join(",") ?? "none"}`,
      blocking: true,
    });
  }

  return conflicts;
}

function compareGenderOverrides(left: GenderOverride, right: GenderOverride): number {
  return (
    left.pairOrdinal - right.pairOrdinal ||
    GENDER_CODE[left.parentAGender] - GENDER_CODE[right.parentAGender] ||
    GENDER_CODE[left.parentBGender] - GENDER_CODE[right.parentBGender] ||
    left.ruleCode - right.ruleCode ||
    left.childId - right.childId ||
    (left.rowId ?? "").localeCompare(right.rowId ?? "", "en")
  );
}

function compareWitness(left: CarrierWitness, right: CarrierWitness): number {
  return (
    left.mateId - right.mateId ||
    left.ruleCode - right.ruleCode ||
    GENDER_CODE[left.carrierGender] - GENDER_CODE[right.carrierGender] ||
    GENDER_CODE[left.mateGender] - GENDER_CODE[right.mateGender]
  );
}

export function buildPackedData(
  pals: readonly PalValue[],
  engine: ReturnType<typeof createBreedingEngine>,
): Pick<GeneratedReference, "pairMatrix" | "genderOverrides" | "parentsByChild" | "carrierAdjacency"> {
  const palCount = pals.length;
  const pairCount = triangularPairCount(palCount);
  const childIds = new Array<number>(pairCount);
  const ruleCodes = new Array<number>(pairCount);
  const reverseLists = Array.from({ length: palCount }, () => [] as number[]);
  const genderOverrides: GenderOverride[] = [];
  const genderPairOrdinals = new Set<number>();

  for (let parentAId = 0; parentAId < palCount; parentAId += 1) {
    for (let parentBId = parentAId; parentBId < palCount; parentBId += 1) {
      const ordinal = triangularPairOrdinal(parentAId, parentBId, palCount);
      const result = engine.resolveBasePair(parentAId, parentBId);
      childIds[ordinal] = result.childId;
      ruleCodes[ordinal] = result.ruleCode;

      const rows = engine.getSpecials(parentAId, parentBId);
      const hasUniversal = rows.some(
        (row) => row.parent_a_gender === "ANY" && row.parent_b_gender === "ANY",
      );
      const genderRows = rows.filter(
        (row) => row.parent_a_gender !== "ANY" || row.parent_b_gender !== "ANY",
      );
      if (!hasUniversal && genderRows.length > 0) {
        const oriented = engine.resolvePair(parentAId, parentBId, "ANY", "ANY");
        if (oriented.kind === "resolved") {
          childIds[ordinal] = oriented.childId;
          ruleCodes[ordinal] = oriented.ruleCode;
          const reverse = reverseLists[oriented.childId];
          if (reverse === undefined) throw new Error(`Invalid reverse child id ${oriented.childId}`);
          reverse.push(ordinal);
        } else {
          genderPairOrdinals.add(ordinal);
          for (const alternative of oriented.alternatives) {
            genderOverrides.push({
              pairOrdinal: ordinal,
              parentAId,
              parentAGender: alternative.parentAGender,
              parentBId,
              parentBGender: alternative.parentBGender,
              childId: alternative.childId,
              ruleCode: alternative.ruleCode,
              ...(alternative.rowId === undefined ? {} : { rowId: alternative.rowId }),
            });
          }
        }
      } else {
        const reverse = reverseLists[result.childId];
        if (reverse === undefined) throw new Error(`Invalid reverse child id ${result.childId}`);
        reverse.push(ordinal);
      }
    }
  }
  genderOverrides.sort(compareGenderOverrides);

  const reverseOffsets: number[] = [0];
  const reverseOrdinals: number[] = [];
  for (const list of reverseLists) {
    list.sort((left, right) => left - right);
    reverseOrdinals.push(...list);
    reverseOffsets.push(reverseOrdinals.length);
  }

  const adjacencyOffsets: number[] = [0];
  const adjacencyChildren: number[] = [];
  const adjacencyMates: number[] = [];
  const adjacencyRules: number[] = [];
  const adjacencyCarrierGenders: number[] = [];
  const adjacencyMateGenders: number[] = [];

  for (let carrierId = 0; carrierId < palCount; carrierId += 1) {
    const witnesses: CarrierWitness[] = [];
    for (let mateId = 0; mateId < palCount; mateId += 1) {
      const lower = Math.min(carrierId, mateId);
      const upper = Math.max(carrierId, mateId);
      const ordinal = triangularPairOrdinal(lower, upper, palCount);
      const outcomes: PairOutcome[] = [];

      if (genderPairOrdinals.has(ordinal)) {
        for (const override of genderOverrides) {
          if (override.pairOrdinal !== ordinal) continue;
          const carrierIsLower = carrierId === lower;
          outcomes.push({
            childId: override.childId,
            ruleCode: override.ruleCode,
            carrierGender: carrierIsLower ? override.parentAGender : override.parentBGender,
            mateGender: carrierIsLower ? override.parentBGender : override.parentAGender,
          });
        }
      } else {
        const childId = childIds[ordinal];
        const ruleCode = ruleCodes[ordinal];
        if (childId === undefined || ruleCode === undefined) {
          throw new Error(`Pair matrix has a hole at ordinal ${ordinal}`);
        }
        outcomes.push({ childId, ruleCode, carrierGender: "ANY", mateGender: "ANY" });
      }

      for (const outcome of outcomes) {
        witnesses.push({ ...outcome, mateId });
      }
    }

    const sorted = witnesses.sort(
      (left, right) => compareWitness(left, right) || left.childId - right.childId,
    );
    for (const witness of sorted) {
      adjacencyChildren.push(witness.childId);
      adjacencyMates.push(witness.mateId);
      adjacencyRules.push(witness.ruleCode);
      adjacencyCarrierGenders.push(GENDER_CODE[witness.carrierGender]);
      adjacencyMateGenders.push(GENDER_CODE[witness.mateGender]);
    }
    adjacencyOffsets.push(adjacencyChildren.length);
  }

  return {
    pairMatrix: {
      count: pairCount,
      layout: "upper-triangular-row-major-including-diagonal",
      childEncoding: "uint16-le-base64",
      ruleEncoding: "uint8-base64",
      childIdsBase64: packUint16(childIds),
      ruleCodesBase64: packUint8(ruleCodes),
      ruleLegend: { ...RULE_CODE },
    },
    genderOverrides,
    parentsByChild: {
      entryCount: reverseOrdinals.length,
      offsetsEncoding: "uint32-le-base64",
      pairOrdinalsEncoding: "uint32-le-base64",
      offsetsBase64: packUint32(reverseOffsets),
      pairOrdinalsBase64: packUint32(reverseOrdinals),
      excludesGenderSpecificBasePairs: true,
    },
    carrierAdjacency: {
      edgeCount: adjacencyChildren.length,
      semantics: "all-directed-parent-pair-outcomes",
      offsetsEncoding: "uint32-le-base64",
      idEncoding: "uint16-le-base64",
      ruleEncoding: "uint8-base64",
      genderEncoding: "uint8-base64",
      genderLegend: { ...GENDER_CODE },
      offsetsBase64: packUint32(adjacencyOffsets),
      childIdsBase64: packUint16(adjacencyChildren),
      mateIdsBase64: packUint16(adjacencyMates),
      ruleCodesBase64: packUint8(adjacencyRules),
      carrierGendersBase64: packUint8(adjacencyCarrierGenders),
      mateGendersBase64: packUint8(adjacencyMateGenders),
    },
  };
}

const KNOWN_IMPACT_PAIRS = [
  ["Sibelyx + Lamball", "WhiteMoth", "SheepBall"],
  ["Lunaris + Grintale", "Mutant", "NaughtyCat"],
  ["Anubis + Eikthyrdeer Terra", "Anubis", "Deer_Ground"],
  ["Anubis + Panthalus", "Anubis", "KingWhale"],
  ["Kingpaca Cryst + Jolthog", "KingAlpaca_Ice", "Hedgehog"],
  ["Dualith Noct + Jolthog", "GrassGolem_Dark", "Hedgehog"],
  ["Elphidran + Surfent", "FairyDragon", "Serpent"],
] as const;

export function computeSpecialChildImpactContentHash(
  report: Omit<SpecialChildImpactReport, "contentHash">,
): string {
  return sha256(JSON.stringify(report));
}

export function buildSpecialChildImpact(
  inputs: CanonicalInputs,
): SpecialChildImpactReport {
  const legacy = createBreedingEngine(inputs.pals, inputs.specials, {
    excludeSpecialChildrenFromFormula: false,
  });
  const current = createBreedingEngine(inputs.pals, inputs.specials);
  const specialChildren = new Set(
    inputs.specials.map(({ child_internal }) => child_internal),
  );
  const pairLabels = new Map<string, string[]>();
  const keyFor = (left: string, right: string): string =>
    left.localeCompare(right, "en") <= 0 ? `${left}|${right}` : `${right}|${left}`;
  for (const [label, left, right] of KNOWN_IMPACT_PAIRS) {
    const labels = pairLabels.get(keyFor(left, right)) ?? [];
    labels.push(label);
    pairLabels.set(keyFor(left, right), labels);
  }

  const changes: SpecialChildImpactChange[] = [];
  const affectedSpecialChildren = new Set<string>();
  for (let parentAId = 0; parentAId < inputs.pals.length; parentAId += 1) {
    for (let parentBId = parentAId; parentBId < inputs.pals.length; parentBId += 1) {
      const before = legacy.resolveBasePair(parentAId, parentBId);
      const after = current.resolveBasePair(parentAId, parentBId);
      if (before.childId === after.childId) continue;
      const parentA = inputs.pals[parentAId];
      const parentB = inputs.pals[parentBId];
      const previousChild = inputs.pals[before.childId];
      const currentChild = inputs.pals[after.childId];
      if (
        parentA === undefined ||
        parentB === undefined ||
        previousChild === undefined ||
        currentChild === undefined
      ) {
        throw new Error("Impact analysis resolved an unknown Pal id");
      }
      const affected = [previousChild, currentChild]
        .filter(({ internal_name }) => specialChildren.has(internal_name))
        .map(({ internal_name }) => internal_name)
        .sort((left, right) => left.localeCompare(right, "en"));
      for (const internalName of affected) affectedSpecialChildren.add(internalName);
      changes.push({
        pairOrdinal: triangularPairOrdinal(parentAId, parentBId, inputs.pals.length),
        parentAInternal: parentA.internal_name,
        parentBInternal: parentB.internal_name,
        previousChildInternal: previousChild.internal_name,
        currentChildInternal: currentChild.internal_name,
        affectedSpecialChildSpecies: affected,
        pairItselfSpecial:
          before.rule === "special_combination" || after.rule === "special_combination",
        knownRouteLabels: pairLabels.get(keyFor(parentA.internal_name, parentB.internal_name)) ?? [],
      });
    }
  }

  const palId = (internalName: string): number => findUniquePalId(inputs.pals, internalName);
  const knownPairChecks = KNOWN_IMPACT_PAIRS.map(([label, left, right]) => {
    const before = legacy.resolveBasePair(palId(left), palId(right));
    const after = current.resolveBasePair(palId(left), palId(right));
    const previousChild = inputs.pals[before.childId];
    const currentChild = inputs.pals[after.childId];
    if (previousChild === undefined || currentChild === undefined) {
      throw new Error(`Known impact pair ${label} resolved an unknown child`);
    }
    return {
      label,
      parentAInternal: left,
      parentBInternal: right,
      previousChildInternal: previousChild.internal_name,
      currentChildInternal: currentChild.internal_name,
      changed: before.childId !== after.childId,
    };
  });
  const legacyEligibleChildCount = inputs.pals.filter(
    (pal) => pal.combi_rank > 0 && !pal.ignore_combi,
  ).length;
  const currentEligibleChildCount = inputs.pals.filter(
    (pal) =>
      pal.combi_rank > 0 &&
      !pal.ignore_combi &&
      !specialChildren.has(pal.internal_name),
  ).length;
  const excludedEligibleSpecialChildCount = legacyEligibleChildCount - currentEligibleChildCount;
  const withoutHash: Omit<SpecialChildImpactReport, "contentHash"> = {
    schemaVersion: 1,
    sourceDataHash: inputs.sourceDataHash,
    pairCount: triangularPairCount(inputs.pals.length),
    changedPairCount: changes.length,
    legacyEligibleChildCount,
    currentEligibleChildCount,
    specialChildSpeciesCount: specialChildren.size,
    excludedEligibleSpecialChildCount,
    affectedSpecialChildSpecies: [...affectedSpecialChildren].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
    knownPairChecks,
    changes,
  };
  return {
    ...withoutHash,
    contentHash: computeSpecialChildImpactContentHash(withoutHash),
  };
}

function canonicalDataIsValid(manifest: CanonicalManifest): boolean {
  const blockingKeys = [
    "missing_game_table_rows",
    "fallback_game_table_rows",
    "palcalc_rank_mismatches",
    "palcalc_rarity_mismatches",
    "palcalc_priority_mismatches",
    "pst_rank_mismatches",
    "pst_rarity_mismatches",
    "pst_ignore_mismatches",
    "filtered_game_special_combinations",
    "filtered_pst_special_combinations",
    "special_resolution_mismatches",
    "ranks_not_divisible_by_10",
  ];
  return blockingKeys.every((key) => (manifest.validation[key]?.length ?? 0) === 0);
}

export async function buildReference(): Promise<GeneratedReference> {
  const inputs = await readCanonicalInputs();
  validateCanonicalInputs(inputs);
  const engine = createBreedingEngine(inputs.pals, inputs.specials);
  const packed = buildPackedData(inputs.pals, engine);
  const impact = buildSpecialChildImpact(inputs);
  if (inputs.manifest.counts.pair_results_changed_by_special_child_rule !== impact.changedPairCount) {
    throw new Error(
      `Manifest pair impact count ${String(inputs.manifest.counts.pair_results_changed_by_special_child_rule)} != ${impact.changedPairCount}`,
    );
  }
  const conflicts = buildAssignmentConflicts(inputs.pals, inputs.specials, (parentAId, parentBId) =>
    engine.resolveBasePair(parentAId, parentBId),
  );
  const canonicalValid = canonicalDataIsValid(inputs.manifest);
  const valid = canonicalValid && conflicts.length === 0;
  const specialChildren = new Set(inputs.specials.map(({ child_internal }) => child_internal));
  const eligiblePalCount = inputs.pals.filter(
    (pal) =>
      pal.combi_rank > 0 &&
      !pal.ignore_combi &&
      !specialChildren.has(pal.internal_name),
  ).length;

  const reference: GeneratedReference = {
    schemaVersion: REFERENCE_SCHEMA_VERSION,
    generatedAtUtc: inputs.manifest.generated_at_utc,
    sourceDataHash: inputs.sourceDataHash,
    generatedArtifactHash: "",
    sourceFiles: inputs.sourceFiles,
    canonical: {
      rules: inputs.rules,
      specialCombinations: inputs.specials,
      manifest: inputs.manifest,
    },
    pals: inputs.pals,
    aliases: Object.fromEntries(
      Object.entries(engine.aliases).map(([alias, ids]) => [alias, [...ids]]),
    ),
    ...packed,
    specialChildImpact: {
      path: "generated/special-child-impact.json",
      sha256: impact.contentHash,
      pairCount: impact.pairCount,
      changedPairCount: impact.changedPairCount,
      legacyEligibleChildCount: impact.legacyEligibleChildCount,
      currentEligibleChildCount: impact.currentEligibleChildCount,
      specialChildSpeciesCount: impact.specialChildSpeciesCount,
    },
    status: {
      ok: valid,
      apiSchemaVersion: API_SCHEMA_VERSION,
      breedingReferenceSchemaVersion: inputs.rules.schema_version,
      gameReference: inputs.rules.game_reference,
      generatedAtUtc: inputs.manifest.generated_at_utc,
      sourceDataHash: inputs.sourceDataHash,
      generatedArtifactHash: "",
      palCount: inputs.pals.length,
      eligiblePalCount,
      specialCombinationCount: inputs.specials.length,
      specialChildSpeciesCount: specialChildren.size,
      pairCount: packed.pairMatrix.count,
      genderOverrideCount: packed.genderOverrides.length,
      parentsIndexEntryCount: packed.parentsByChild.entryCount,
      carrierAdjacencyEdgeCount: packed.carrierAdjacency.edgeCount,
      validationStatus: valid ? "valid" : "needs_review",
      patchCheck: inputs.manifest.patch_check,
    },
    validation: {
      ok: valid,
      canonicalDataValid: canonicalValid,
      assignmentExpectationsValid: conflicts.length === 0,
      status: valid ? "valid" : "needs_review",
      conflicts,
      implementationNotes: [...IMPLEMENTATION_NOTES],
      sourceValidation: inputs.manifest.validation,
    },
  };
  const generatedArtifactHash = computeGeneratedArtifactHash(reference);
  reference.generatedArtifactHash = generatedArtifactHash;
  reference.status.generatedArtifactHash = generatedArtifactHash;
  return reference;
}

export function computeGeneratedArtifactHash(reference: GeneratedReference): string {
  const payload = structuredClone(reference);
  Reflect.deleteProperty(payload, "generatedArtifactHash");
  Reflect.deleteProperty(payload.status, "generatedArtifactHash");
  return sha256(JSON.stringify(payload));
}

export async function writeGeneratedReference(): Promise<GeneratedReference> {
  const reference = await buildReference();
  const inputs = await readCanonicalInputs();
  validateCanonicalInputs(inputs);
  const impact = buildSpecialChildImpact(inputs);
  if (impact.contentHash !== reference.specialChildImpact.sha256) {
    throw new Error("Special-child impact hash changed between deterministic builds");
  }
  await mkdir(dirname(generatedReferencePath), { recursive: true });
  await writeFile(generatedReferencePath, `${JSON.stringify(reference)}\n`, "utf8");
  await writeFile(specialChildImpactPath, `${JSON.stringify(impact)}\n`, "utf8");
  return reference;
}

async function main(): Promise<void> {
  const reference = await writeGeneratedReference();
  process.stdout.write(
    `${JSON.stringify({
      output: generatedReferencePath,
      impactOutput: specialChildImpactPath,
      schemaVersion: reference.schemaVersion,
      sourceDataHash: reference.sourceDataHash,
      generatedArtifactHash: reference.generatedArtifactHash,
      palCount: reference.status.palCount,
      pairCount: reference.status.pairCount,
      validationStatus: reference.status.validationStatus,
      conflicts: reference.validation.conflicts.map(({ code }) => code),
    })}\n`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  await main();
}
