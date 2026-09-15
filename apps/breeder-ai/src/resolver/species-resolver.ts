import manifestJson from "../../../../data/palworld-breeding/manifest.json";
import palValuesJson from "../../../../data/palworld-breeding/pal_values.json";

import {
  PersistedSpeciesReferenceSchema,
  SPECIES_NAMESPACE,
  SpeciesDatasetReferenceSchema,
  sameSpeciesDataset,
  type PersistedSpeciesReference,
  type SpeciesAdapterKey,
  type SpeciesDatasetReference,
} from "../domain/species-reference.ts";

interface PalValueRow {
  internal_name: string;
  name_de: string;
  name_en: string;
  is_variant: boolean;
  game_table_row: string;
}

interface CandidateEntry {
  species: SpeciesRecord;
  aliases: AliasEntry[];
}

interface AliasEntry {
  value: string;
  normalized: string;
  source: "internal_name" | "game_table_row" | "name_de" | "name_en";
}

export interface SpeciesRecord {
  adapterKey: SpeciesAdapterKey;
  nameDe: string;
  nameEn: string;
  isVariant: boolean;
  gameTableRow: string;
  dataset: SpeciesDatasetReference;
}

export interface SpeciesCandidate {
  species: SpeciesRecord;
  score: number;
  matchedAlias: string;
  aliasSource: AliasEntry["source"];
}

export type SpeciesResolution =
  | {
      status: "resolved";
      match: SpeciesCandidate;
      exact: true;
    }
  | {
      status: "ambiguous";
      candidates: SpeciesCandidate[];
      exact: true;
    }
  | {
      status: "candidates";
      candidates: SpeciesCandidate[];
      exact: false;
    }
  | {
      status: "not_found";
      candidates: [];
      exact: false;
    };

export type PersistedSpeciesResolution =
  | { status: "current"; species: SpeciesRecord }
  | { status: "migration_required"; currentDataset: SpeciesDatasetReference }
  | { status: "unknown_key"; currentDataset: SpeciesDatasetReference };

const rows = palValuesJson as PalValueRow[];

export const currentSpeciesDataset = speciesDatasetFromManifest(manifestJson);

export function speciesDatasetFromManifest(
  value: unknown,
): Readonly<SpeciesDatasetReference> {
  if (!isRecord(value) || !isRecord(value.patch_check)) {
    throw new Error("Breeding manifest does not have the required structure.");
  }
  if (!Array.isArray(value.sources)) {
    throw new Error("Breeding manifest sources must be an array.");
  }

  const canonicalSources = value.sources.filter(
    (source): source is Record<string, unknown> =>
      isRecord(source) && source.role === "canonical_primary_source",
  );
  if (canonicalSources.length !== 1) {
    throw new Error(
      "Breeding manifest must contain exactly one canonical_primary_source.",
    );
  }

  const canonicalSource = canonicalSources[0];
  const sha256 = canonicalSource?.sha256;
  if (!isRecord(sha256)) {
    throw new Error("Canonical breeding source does not expose hash metadata.");
  }

  const parsed = SpeciesDatasetReferenceSchema.safeParse({
    schemaVersion: value.schema_version,
    gameVersion: value.patch_check.checked_game_version,
    dedicatedServerBuildId: value.patch_check.checked_game_build,
    technicalSnapshotSha256: sha256.technical_snapshot,
  });
  if (!parsed.success) {
    throw new Error("Canonical breeding source fingerprint is invalid.", {
      cause: parsed.error,
    });
  }
  return Object.freeze(parsed.data);
}

export class SpeciesResolver {
  readonly count: number;

  readonly #byKey = new Map<string, CandidateEntry>();
  readonly #byNormalizedAlias = new Map<string, SpeciesCandidate[]>();

  constructor() {
    for (const row of rows) {
      const species: SpeciesRecord = {
        adapterKey: {
          namespace: SPECIES_NAMESPACE,
          value: row.internal_name,
        },
        nameDe: row.name_de,
        nameEn: row.name_en,
        isVariant: row.is_variant,
        gameTableRow: row.game_table_row,
        dataset: currentSpeciesDataset,
      };
      const aliases = deduplicateAliases([
        { value: row.internal_name, source: "internal_name" },
        { value: row.game_table_row, source: "game_table_row" },
        { value: row.name_de, source: "name_de" },
        { value: row.name_en, source: "name_en" },
      ]);
      const entry = { species, aliases };
      this.#byKey.set(row.internal_name, entry);

      for (const alias of aliases) {
        const candidates = this.#byNormalizedAlias.get(alias.normalized) ?? [];
        candidates.push({
          species,
          score: 1,
          matchedAlias: alias.value,
          aliasSource: alias.source,
        });
        this.#byNormalizedAlias.set(alias.normalized, candidates);
      }
    }
    this.count = this.#byKey.size;
  }

  resolve(query: string, limit = 5): SpeciesResolution {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return { status: "not_found", candidates: [], exact: false };
    }

    const direct = this.#byKey.get(trimmed);
    if (direct !== undefined) {
      return {
        status: "resolved",
        exact: true,
        match: {
          species: direct.species,
          score: 1,
          matchedAlias: trimmed,
          aliasSource: "internal_name",
        },
      };
    }

    const normalized = normalizeMention(trimmed);
    const exactCandidates = deduplicateCandidates(
      this.#byNormalizedAlias.get(normalized) ?? [],
    );
    if (exactCandidates.length === 1) {
      return {
        status: "resolved",
        exact: true,
        match: exactCandidates[0] as SpeciesCandidate,
      };
    }
    if (exactCandidates.length > 1) {
      return {
        status: "ambiguous",
        exact: true,
        candidates: exactCandidates,
      };
    }

    const bestBySpecies = new Map<string, SpeciesCandidate>();
    for (const entry of this.#byKey.values()) {
      for (const alias of entry.aliases) {
        const score = similarity(normalized, alias.normalized);
        if (score < fuzzyThreshold(normalized.length)) {
          continue;
        }
        const key = entry.species.adapterKey.value;
        const current = bestBySpecies.get(key);
        if (current === undefined || score > current.score) {
          bestBySpecies.set(key, {
            species: entry.species,
            score,
            matchedAlias: alias.value,
            aliasSource: alias.source,
          });
        }
      }
    }

    const candidates = [...bestBySpecies.values()]
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.species.adapterKey.value.localeCompare(
            right.species.adapterKey.value,
          ),
      )
      .slice(0, Math.max(1, Math.min(limit, 20)));

    return candidates.length === 0
      ? { status: "not_found", candidates: [], exact: false }
      : { status: "candidates", candidates, exact: false };
  }

  resolvePersisted(
    reference: PersistedSpeciesReference,
  ): PersistedSpeciesResolution {
    const parsed = PersistedSpeciesReferenceSchema.safeParse(reference);
    if (!parsed.success) {
      return { status: "unknown_key", currentDataset: currentSpeciesDataset };
    }
    if (!sameSpeciesDataset(parsed.data.dataset, currentSpeciesDataset)) {
      return {
        status: "migration_required",
        currentDataset: currentSpeciesDataset,
      };
    }
    const entry = this.#byKey.get(parsed.data.adapterKey.value);
    return entry === undefined
      ? { status: "unknown_key", currentDataset: currentSpeciesDataset }
      : { status: "current", species: entry.species };
  }
}

function deduplicateAliases(
  aliases: Array<{ value: string; source: AliasEntry["source"] }>,
): AliasEntry[] {
  const result = new Map<string, AliasEntry>();
  for (const alias of aliases) {
    const normalized = normalizeMention(alias.value);
    const identity = `${normalized}\u0000${alias.source}`;
    if (!result.has(identity)) {
      result.set(identity, { ...alias, normalized });
    }
  }
  return [...result.values()];
}

function deduplicateCandidates(candidates: SpeciesCandidate[]): SpeciesCandidate[] {
  const bySpecies = new Map<string, SpeciesCandidate>();
  for (const candidate of candidates) {
    if (!bySpecies.has(candidate.species.adapterKey.value)) {
      bySpecies.set(candidate.species.adapterKey.value, candidate);
    }
  }
  return [...bySpecies.values()].sort((left, right) =>
    left.species.adapterKey.value.localeCompare(right.species.adapterKey.value),
  );
}

function normalizeMention(value: string): string {
  return value
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function fuzzyThreshold(length: number): number {
  if (length <= 4) return 0.8;
  if (length <= 8) return 0.7;
  return 0.65;
}

function similarity(left: string, right: string): number {
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(left, right) / longest;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        (previous[rightIndex - 1] ?? 0) +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        (previous[rightIndex] ?? 0) + 1,
        (current[rightIndex - 1] ?? 0) + 1,
        substitution,
      );
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index] ?? 0;
    }
  }
  return previous[right.length] ?? longestFallback(left, right);
}

function longestFallback(left: string, right: string): number {
  return Math.max(left.length, right.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
