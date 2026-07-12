import {
  ApiError,
  booleanParameter,
  integerParameter,
  jsonResponse,
  optionalSingleParameter,
  requiredSingleParameter,
} from "./http.ts";
import {
  getBasePair,
  getCarrierEdges,
  getChildrenForPair,
  getGenderOverrides,
  getPal,
  getParentEntries,
  getReference,
  getSpecialRow,
  getUniversalSpecialRow,
  pairOrdinal,
  resolveName,
  resolvePair,
  type CarrierEdge,
  type ParentIndexEntry,
} from "./reference.ts";
import type { Gender, PalValue, ResolvedPair, RuleName } from "./types.ts";

const reference = getReference();
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const GENDER_ORDER: Record<Gender, number> = { ANY: 0, MALE: 1, FEMALE: 2 };

interface RouteContext {
  request: Request;
  url: URL;
  head: boolean;
}

interface RoutePredecessor {
  fromId: number;
  edge: CarrierEdge;
}

function palIdentity(id: number): Record<string, unknown> {
  const pal = getPal(id);
  return {
    id,
    internal_name: pal.internal_name,
    name_de: pal.name_de,
    name_en: pal.name_en,
    variant: pal.is_variant,
  };
}

function palDetails(id: number): Record<string, unknown> {
  const pal = getPal(id);
  return {
    ...palIdentity(id),
    paldex_no: pal.paldex_no,
    combi_rank: pal.combi_rank,
    rarity: pal.rarity,
    ignore_combi: pal.ignore_combi,
    combi_duplicate_priority: pal.combi_duplicate_priority,
    internal_index: pal.internal_index,
    game_table_row: pal.game_table_row,
  };
}

function uniquePalId(rawName: string, parameter: string): number {
  const ids = resolveName(rawName);
  if (ids.length === 0) {
    throw new ApiError(404, "PAL_NOT_FOUND", `No Pal matches query parameter ${parameter}.`, {
      input: rawName,
    });
  }
  if (ids.length > 1) {
    throw new ApiError(409, "AMBIGUOUS_PAL_NAME", `Multiple Pals match ${parameter}.`, {
      input: rawName,
      candidates: ids.map(palIdentity),
    });
  }
  const id = ids[0];
  if (id === undefined) throw new Error("Name resolution returned an empty result");
  return id;
}

function genderParameter(url: URL, name: string, defaultValue: Gender = "ANY"): Gender {
  const raw = optionalSingleParameter(url, name);
  if (raw === undefined) return defaultValue;
  const gender = raw.toUpperCase();
  if (gender === "ANY" || gender === "MALE" || gender === "FEMALE") return gender;
  throw new ApiError(400, "INVALID_GENDER", `${name} must be MALE, FEMALE, or ANY.`);
}

function detailsParameter(url: URL): "compact" | "full" {
  const value = optionalSingleParameter(url, "detail") ?? "compact";
  if (value === "compact" || value === "full") return value;
  throw new ApiError(400, "INVALID_PARAMETER", "detail must be compact or full.");
}

function sourceReference(): Record<string, unknown> {
  return {
    data_hash: reference.dataHash,
    generated_at_utc: reference.generatedAtUtc,
    game_reference: reference.status.gameReference,
    schema_version: reference.schemaVersion,
  };
}

function specialBody(
  rowId: string | undefined,
  parentAId?: number,
  parentBId?: number,
): Record<string, unknown> | null {
  if (rowId === undefined) return null;
  const row = getSpecialRow(rowId);
  if (row === undefined) throw new Error(`Generated reference lacks special row ${rowId}`);
  let parentAGender = row.parent_a_gender;
  let parentBGender = row.parent_b_gender;
  if (parentAId !== undefined && parentBId !== undefined) {
    const parentAInternal = getPal(parentAId).internal_name;
    const parentBInternal = getPal(parentBId).internal_name;
    if (
      row.parent_a_internal === parentBInternal &&
      row.parent_b_internal === parentAInternal
    ) {
      parentAGender = row.parent_b_gender;
      parentBGender = row.parent_a_gender;
    }
  }
  return {
    row_id: row.row_id,
    parent_a_gender: parentAGender,
    parent_b_gender: parentBGender,
    child_internal: row.child_internal,
  };
}

function resolvedPairBody(result: ResolvedPair): Record<string, unknown> {
  return {
    result_child: palIdentity(result.childId),
    applied_rule: result.rule,
    same_species_override: result.rule === "same_species",
    special_combination: specialBody(result.rowId, result.parentAId, result.parentBId),
    calculated_target_rank: result.targetRank ?? null,
    rank_distance: result.rankDistance ?? null,
    parent_rarity_average: result.parentRarityAverage ?? null,
    nearest_candidates: (result.nearestCandidateIds ?? []).map(palIdentity),
    applied_tie_breaks: result.appliedTieBreaks ?? [],
  };
}

function calculationForEntry(entry: ParentIndexEntry): Record<string, unknown> | null {
  if (entry.rule === "special_combination") {
    return specialBody(entry.rowId, entry.parentAId, entry.parentBId);
  }
  if (entry.rule === "same_species") return null;
  const result = getBasePair(entry.parentAId, entry.parentBId);
  return {
    target_rank: result.targetRank,
    rank_distance: result.rankDistance,
    parent_rarity_average: result.parentRarityAverage,
    nearest_candidates: (result.nearestCandidateIds ?? []).map(palIdentity),
    applied_tie_breaks: result.appliedTieBreaks ?? [],
  };
}

function page<T>(items: readonly T[], offset: number, limit: number): Record<string, unknown> {
  const results = items.slice(offset, offset + limit);
  const nextOffset = offset + results.length;
  return {
    total: items.length,
    offset,
    limit,
    next_offset: nextOffset < items.length ? nextOffset : null,
    results,
  };
}

async function statusRoute(context: RouteContext): Promise<Response> {
  const sourceCommits = reference.canonical.manifest.sources.map(({ repository, commit }) => ({
    repository,
    commit,
  }));
  const generatedAt = Date.parse(reference.status.generatedAtUtc);
  const referenceAgeDays = Number.isFinite(generatedAt)
    ? Math.max(0, Math.floor((Date.now() - generatedAt) / 86_400_000))
    : null;
  return jsonResponse(
    {
      ok: reference.status.ok,
      api_schema_version: reference.status.apiSchemaVersion,
      breeding_reference_schema_version: reference.status.breedingReferenceSchemaVersion,
      game_reference: reference.status.gameReference,
      source_commit: sourceCommits[0]?.commit ?? null,
      source_commits: sourceCommits,
      generated_at_utc: reference.status.generatedAtUtc,
      reference_age_days: referenceAgeDays,
      data_hash: reference.status.dataHash,
      pal_count: reference.status.palCount,
      eligible_pal_count: reference.status.eligiblePalCount,
      special_combination_count: reference.status.specialCombinationCount,
      pair_count: reference.status.pairCount,
      gender_override_count: reference.status.genderOverrideCount,
      validation_status: reference.status.validationStatus,
      known_patch_check_status: reference.status.knownPatchCheckStatus,
      endpoints: [
        "status",
        "pal",
        "pair",
        "parents",
        "children",
        "route",
        "reference",
        "validate",
      ],
    },
    {
      request: context.request,
      head: context.head,
      dataHash: reference.dataHash,
      cacheControl: "private, max-age=60, must-revalidate",
    },
  );
}

async function palRoute(context: RouteContext): Promise<Response> {
  const name = requiredSingleParameter(context.url, "name");
  const id = uniquePalId(name, "name");
  return jsonResponse(
    { ok: true, pal: palDetails(id), source_reference: sourceReference() },
    {
      request: context.request,
      head: context.head,
      dataHash: reference.dataHash,
    },
  );
}

async function pairRoute(context: RouteContext): Promise<Response> {
  const parentAId = uniquePalId(requiredSingleParameter(context.url, "parent_a"), "parent_a");
  const parentBId = uniquePalId(requiredSingleParameter(context.url, "parent_b"), "parent_b");
  const parentAGender = genderParameter(context.url, "gender_a");
  const parentBGender = genderParameter(context.url, "gender_b");
  if (
    parentAGender !== "ANY" &&
    parentBGender !== "ANY" &&
    parentAGender === parentBGender
  ) {
    throw new ApiError(
      400,
      "INCOMPATIBLE_GENDERS",
      "Palworld breeding requires one MALE and one FEMALE parent.",
    );
  }
  const result = resolvePair(parentAId, parentBId, parentAGender, parentBGender);

  const common = {
    ok: true,
    normalized_parent_a: palIdentity(parentAId),
    normalized_parent_b: palIdentity(parentBId),
    supplied_genders: { parent_a: parentAGender, parent_b: parentBGender },
    reference_id: reference.dataHash,
    data_hash: reference.dataHash,
  };

  const body =
    result.kind === "resolved"
      ? { ...common, resolution: "resolved", ...resolvedPairBody(result) }
      : {
          ...common,
          resolution: "unresolved_gender",
          applied_rule: "unresolved_gender",
          result_child: null,
          alternatives: result.alternatives.map((alternative) => ({
            row_id: alternative.rowId,
            parent_a: palIdentity(alternative.parentAId),
            parent_a_gender: alternative.parentAGender,
            parent_b: palIdentity(alternative.parentBId),
            parent_b_gender: alternative.parentBGender,
            child: palIdentity(alternative.childId),
          })),
          fallback_if_no_gender_rule_matches: resolvedPairBody(result.fallback),
        };

  return jsonResponse(body, {
    request: context.request,
    head: context.head,
    dataHash: reference.dataHash,
  });
}

function entryMatchesFixedParent(
  entry: ParentIndexEntry,
  fixedParentId: number | undefined,
  fixedGender: Gender,
): boolean {
  if (fixedParentId === undefined) return true;
  const matches: Gender[] = [];
  if (entry.parentAId === fixedParentId) matches.push(entry.parentAGender);
  if (entry.parentBId === fixedParentId) matches.push(entry.parentBGender);
  return matches.some((required) => fixedGender === "ANY" || required === "ANY" || required === fixedGender);
}

async function parentsRoute(context: RouteContext): Promise<Response> {
  const childId = uniquePalId(requiredSingleParameter(context.url, "child"), "child");
  const fixedParentName = optionalSingleParameter(context.url, "parent");
  const fixedParentId =
    fixedParentName === undefined ? undefined : uniquePalId(fixedParentName, "parent");
  const rawGender = optionalSingleParameter(context.url, "gender");
  if (rawGender !== undefined && fixedParentId === undefined) {
    throw new ApiError(400, "INVALID_PARAMETER", "gender requires the parent filter.");
  }
  const fixedGender = rawGender === undefined ? "ANY" : genderParameter(context.url, "gender");
  const specialOnly = booleanParameter(context.url, "special_only");
  const detail = detailsParameter(context.url);
  const offset = integerParameter(context.url, "offset", 0, 0, 1_000_000);
  const limit = integerParameter(
    context.url,
    "max_results",
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );

  const filteredEntries = getParentEntries(childId)
    .filter((entry) => entryMatchesFixedParent(entry, fixedParentId, fixedGender))
    .filter((entry) => specialOnly === undefined || (entry.rule === "special_combination") === specialOnly)
    .sort(
      (left, right) =>
        left.parentAId - right.parentAId ||
        left.parentBId - right.parentBId ||
        GENDER_ORDER[left.parentAGender] - GENDER_ORDER[right.parentAGender] ||
        GENDER_ORDER[left.parentBGender] - GENDER_ORDER[right.parentBGender] ||
        (left.rowId ?? "").localeCompare(right.rowId ?? "", "en"),
    );
  const selectedEntries = filteredEntries
    .slice(offset, offset + limit)
    .map((entry) => ({
      parent_a: palIdentity(entry.parentAId),
      parent_b: palIdentity(entry.parentBId),
      parent_a_gender: entry.parentAGender,
      parent_b_gender: entry.parentBGender,
      rule: entry.rule,
      special_combination_row_id: entry.rowId ?? null,
      ...(detail === "full" ? { calculation: calculationForEntry(entry) } : {}),
    }));
  const nextOffset = offset + selectedEntries.length;

  return jsonResponse(
    {
      ok: true,
      child: palIdentity(childId),
      total: filteredEntries.length,
      offset,
      limit,
      next_offset: nextOffset < filteredEntries.length ? nextOffset : null,
      results: selectedEntries,
      reference_id: reference.dataHash,
    },
    { request: context.request, head: context.head, dataHash: reference.dataHash },
  );
}

function compareChildren(left: CarrierEdge, right: CarrierEdge): number {
  return (
    left.mateId - right.mateId ||
    left.childId - right.childId ||
    GENDER_ORDER[left.carrierGender] - GENDER_ORDER[right.carrierGender] ||
    GENDER_ORDER[left.mateGender] - GENDER_ORDER[right.mateGender] ||
    (left.rowId ?? "").localeCompare(right.rowId ?? "", "en")
  );
}

async function childrenRoute(context: RouteContext): Promise<Response> {
  const parentId = uniquePalId(requiredSingleParameter(context.url, "parent"), "parent");
  const secondParentName = optionalSingleParameter(context.url, "second_parent");
  const secondParentId =
    secondParentName === undefined
      ? undefined
      : uniquePalId(secondParentName, "second_parent");
  const childName = optionalSingleParameter(context.url, "child");
  const childId = childName === undefined ? undefined : uniquePalId(childName, "child");
  const offset = integerParameter(context.url, "offset", 0, 0, 1_000_000);
  const limit = integerParameter(
    context.url,
    "max_results",
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );

  const mateIds = secondParentId === undefined ? reference.pals.map((_pal, id) => id) : [secondParentId];
  const entries = mateIds
    .flatMap((mateId) => getChildrenForPair(parentId, mateId))
    .filter((entry) => childId === undefined || entry.childId === childId)
    .sort(compareChildren)
    .map((entry) => ({
      parent: palIdentity(entry.carrierId),
      parent_gender: entry.carrierGender,
      second_parent: palIdentity(entry.mateId),
      second_parent_gender: entry.mateGender,
      child: palIdentity(entry.childId),
      rule: entry.rule,
      special_combination_row_id: entry.rowId ?? null,
    }));

  return jsonResponse(
    {
      ok: true,
      parent: palIdentity(parentId),
      ...page(entries, offset, limit),
      reference_id: reference.dataHash,
    },
    { request: context.request, head: context.head, dataHash: reference.dataHash },
  );
}

function routeStep(edge: CarrierEdge): Record<string, unknown> {
  return {
    carrier: palIdentity(edge.carrierId),
    carrier_gender: edge.carrierGender,
    second_parent: palIdentity(edge.mateId),
    second_parent_gender: edge.mateGender,
    child: palIdentity(edge.childId),
    rule: edge.rule,
    special_combination_row_id: edge.rowId ?? null,
  };
}

function shortestRoutes(
  sourceId: number,
  targetId: number,
  maxGenerations: number,
  maxAlternatives: number,
): { paths: CarrierEdge[][]; minimumGenerations: number | null; truncated: boolean } {
  if (sourceId === targetId) return { paths: [[]], minimumGenerations: 0, truncated: false };

  const distances = new Int16Array(reference.pals.length);
  distances.fill(-1);
  distances[sourceId] = 0;
  const predecessors = Array.from(
    { length: reference.pals.length },
    () => [] as RoutePredecessor[],
  );
  const queue: number[] = [sourceId];
  let queueIndex = 0;
  let targetDistance: number | null = null;

  while (queueIndex < queue.length) {
    const currentId = queue[queueIndex];
    queueIndex += 1;
    if (currentId === undefined) break;
    const currentDistance = distances[currentId];
    if (currentDistance === undefined) throw new Error("Route distance is missing");
    if (currentDistance < 0 || currentDistance >= maxGenerations) continue;
    if (targetDistance !== null && currentDistance >= targetDistance) continue;

    for (const edge of getCarrierEdges(currentId)) {
      if (edge.childId === currentId) continue;
      const nextDistance = currentDistance + 1;
      const knownDistance = distances[edge.childId];
      const predecessor = { fromId: currentId, edge };

      if (knownDistance === -1) {
        distances[edge.childId] = nextDistance;
        predecessors[edge.childId]?.push(predecessor);
        queue.push(edge.childId);
        if (edge.childId === targetId) targetDistance = nextDistance;
      } else if (knownDistance === nextDistance) {
        predecessors[edge.childId]?.push(predecessor);
      }
    }
  }

  const minimumGenerations = distances[targetId];
  if (minimumGenerations === undefined) throw new Error("Target route distance is missing");
  if (minimumGenerations < 0 || minimumGenerations > maxGenerations) {
    return { paths: [], minimumGenerations: null, truncated: false };
  }

  const paths: CarrierEdge[][] = [];
  let truncated = false;
  const reverseSteps: CarrierEdge[] = [];

  const collect = (nodeId: number): void => {
    if (paths.length >= maxAlternatives) {
      truncated = true;
      return;
    }
    if (nodeId === sourceId) {
      paths.push([...reverseSteps].reverse());
      return;
    }
    for (const predecessor of predecessors[nodeId] ?? []) {
      reverseSteps.push(predecessor.edge);
      collect(predecessor.fromId);
      reverseSteps.pop();
      if (truncated) return;
    }
  };
  collect(targetId);
  return { paths, minimumGenerations, truncated };
}

async function routeRoute(context: RouteContext): Promise<Response> {
  const carrierId = uniquePalId(requiredSingleParameter(context.url, "carrier"), "carrier");
  const targetId = uniquePalId(requiredSingleParameter(context.url, "target"), "target");
  const maxGenerations = integerParameter(context.url, "max_generations", 4, 0, 8);
  const maxAlternatives = integerParameter(context.url, "max_alternatives", 10, 1, 25);
  const result = shortestRoutes(carrierId, targetId, maxGenerations, maxAlternatives);

  return jsonResponse(
    {
      ok: true,
      found: result.paths.length > 0,
      species_route_only: true,
      carrier: palIdentity(carrierId),
      target: palIdentity(targetId),
      generation_count: result.minimumGenerations,
      max_generations: maxGenerations,
      truncated: result.truncated,
      routes: result.paths.map((steps) => ({
        generation_count: steps.length,
        steps: steps.map(routeStep),
      })),
      limitation:
        "Species-only routes do not model inventory, passive inheritance odds, unwanted passives, IVs, egg cost, or offspring gender availability.",
      reference_id: reference.dataHash,
    },
    { request: context.request, head: context.head, dataHash: reference.dataHash },
  );
}

async function referenceRoute(context: RouteContext): Promise<Response> {
  return jsonResponse(
    {
      ok: reference.validation.ok,
      schema_version: reference.schemaVersion,
      generated_at_utc: reference.generatedAtUtc,
      data_hash: reference.dataHash,
      source_files: reference.sourceFiles,
      status: reference.status,
      rules: reference.canonical.rules,
      pals: reference.pals,
      aliases: reference.aliases,
      special_combinations: reference.canonical.specialCombinations,
      manifest: reference.canonical.manifest,
    },
    {
      request: context.request,
      head: context.head,
      dataHash: reference.dataHash,
      cacheControl: "private, max-age=3600, must-revalidate",
    },
  );
}

function sourceWarningCount(): number {
  return Object.values(reference.validation.sourceValidation).filter((values) => values.length > 0)
    .length;
}

async function validateRoute(context: RouteContext): Promise<Response> {
  return jsonResponse(
    {
      ok: reference.validation.ok,
      release_blocked: !reference.validation.ok,
      validation_status: reference.validation.status,
      checked_pal_count: reference.status.palCount,
      checked_special_combination_count: reference.status.specialCombinationCount,
      checked_pair_count: reference.status.pairCount,
      error_count: reference.validation.conflicts.length,
      warning_count: sourceWarningCount(),
      source_hashes: reference.sourceFiles,
      generated_hash: reference.dataHash,
      test_fixture_status: reference.validation.assignmentExpectationsValid ? "passed" : "failed",
      canonical_data_valid: reference.validation.canonicalDataValid,
      implementation_notes: reference.validation.implementationNotes,
      unresolved_conflicts: reference.validation.conflicts,
    },
    {
      request: context.request,
      head: context.head,
      dataHash: reference.dataHash,
      cacheControl: "private, max-age=60, must-revalidate",
    },
  );
}

export async function routeApiRequest(
  endpoint: string,
  request: Request,
  head: boolean,
): Promise<Response> {
  const context = { request, url: new URL(request.url), head };
  switch (endpoint) {
    case "status":
      return statusRoute(context);
    case "pal":
      return palRoute(context);
    case "pair":
      return pairRoute(context);
    case "parents":
      return parentsRoute(context);
    case "children":
      return childrenRoute(context);
    case "route":
      return routeRoute(context);
    case "reference":
      return referenceRoute(context);
    case "validate":
      return validateRoute(context);
    default:
      throw new ApiError(404, "ENDPOINT_NOT_FOUND", "The requested API endpoint does not exist.");
  }
}

export function inspectPackedPair(parentA: PalValue, parentB: PalValue): Record<string, unknown> {
  const parentAId = reference.pals.indexOf(parentA);
  const parentBId = reference.pals.indexOf(parentB);
  if (parentAId < 0 || parentBId < 0) throw new Error("Pal is not part of the generated reference");
  const ordinal = pairOrdinal(parentAId, parentBId);
  return {
    ordinal,
    universal_special: getUniversalSpecialRow(ordinal)?.row_id ?? null,
    gender_overrides: getGenderOverrides(ordinal).map(({ rowId }) => rowId),
  };
}

export function isRuleName(value: string): value is RuleName {
  return value === "same_species" || value === "special_combination" || value === "normal_formula";
}
