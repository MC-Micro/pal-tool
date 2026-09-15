import passiveArtifactJson from "../../../../data/palworld-core/passives.json";

import {
  PASSIVE_NAMESPACE,
  PassiveReferenceArtifactSchema,
  PersistedPassiveReferenceSchema,
  samePassiveDataset,
  type PassiveAdapterKey,
  type PassiveDatasetReference,
  type PassiveReferenceArtifact,
} from "../domain/passive-reference.ts";

type AliasSource = "name_en" | "name_de";

interface AliasEntry {
  value: string;
  normalized: string;
  source: AliasSource;
}

interface IndexedPassive {
  passive: PassiveRecord;
  aliases: AliasEntry[];
}

export interface PassiveRecord {
  adapterKey: PassiveAdapterKey;
  nameReference: PassiveReferenceArtifact["entries"][number]["nameReference"];
  nameEn: string;
  nameDe: string;
  dataset: PassiveDatasetReference;
}

export interface PassiveCandidate {
  passive: PassiveRecord;
  score: number;
  matchedAlias: string;
  aliasSource: AliasSource | "adapter_key";
}

export type PassiveResolution =
  | { status: "resolved"; match: PassiveCandidate; exact: true }
  | { status: "ambiguous"; candidates: PassiveCandidate[]; exact: true }
  | { status: "candidates"; candidates: PassiveCandidate[]; exact: false }
  | { status: "not_found"; candidates: []; exact: false };

export type PersistedPassiveResolution =
  | { status: "current"; passive: PassiveRecord }
  | { status: "migration_required"; currentDataset: PassiveDatasetReference }
  | { status: "unknown_key"; currentDataset: PassiveDatasetReference };

export class PassiveResolver {
  readonly count: number;
  readonly currentDataset: Readonly<PassiveDatasetReference>;
  readonly provenance: PassiveReferenceArtifact["dataset"]["provenance"];

  readonly #byKey = new Map<string, IndexedPassive>();
  readonly #byNormalizedName = new Map<string, PassiveCandidate[]>();

  constructor(artifactValue: unknown) {
    const parsed = PassiveReferenceArtifactSchema.safeParse(artifactValue);
    if (!parsed.success) {
      throw new Error("Canonical passive reference artifact is invalid.", {
        cause: parsed.error,
      });
    }
    const artifact = parsed.data;
    this.currentDataset = Object.freeze({
      schemaVersion: artifact.dataset.schemaVersion,
      referenceSpaceSha256: artifact.dataset.referenceSpaceSha256,
    });
    this.provenance = Object.freeze({ ...artifact.dataset.provenance });

    let previousSourceRow: string | undefined;
    const caseFolded = new Map<string, string>();
    for (const entry of artifact.entries) {
      if (
        previousSourceRow !== undefined &&
        compareOrdinal(previousSourceRow, entry.sourceRow) >= 0
      ) {
        throw new Error("Canonical passive entries must be unique and ordinally sorted.");
      }
      previousSourceRow = entry.sourceRow;
      const folded = entry.sourceRow.toLowerCase();
      const previousCase = caseFolded.get(folded);
      if (previousCase !== undefined) {
        throw new Error(
          `Canonical passive sourceRow case collision: ${previousCase} / ${entry.sourceRow}.`,
        );
      }
      caseFolded.set(folded, entry.sourceRow);

      if (
        entry.nameReference.source === "observed_default_row_convention" &&
        entry.nameReference.value !== `PASSIVE_${entry.sourceRow}`
      ) {
        throw new Error(
          `Canonical passive default name reference does not match sourceRow ${entry.sourceRow}.`,
        );
      }

      const passive: PassiveRecord = Object.freeze({
        adapterKey: Object.freeze({
          namespace: PASSIVE_NAMESPACE,
          value: entry.sourceRow,
        }),
        nameReference: Object.freeze({ ...entry.nameReference }),
        nameEn: entry.nameEn,
        nameDe: entry.nameDe,
        dataset: this.currentDataset,
      });
      const aliases = deduplicateAliases([
        { value: entry.nameEn, source: "name_en" },
        { value: entry.nameDe, source: "name_de" },
      ]);
      const indexed = { passive, aliases };
      this.#byKey.set(entry.sourceRow, indexed);
      for (const alias of aliases) {
        const candidates = this.#byNormalizedName.get(alias.normalized) ?? [];
        candidates.push({
          passive,
          score: 1,
          matchedAlias: alias.value,
          aliasSource: alias.source,
        });
        this.#byNormalizedName.set(alias.normalized, candidates);
      }
    }
    for (const candidates of this.#byNormalizedName.values()) {
      candidates.sort(compareCandidates);
    }
    this.count = this.#byKey.size;
  }

  resolve(query: string, limit = 5): PassiveResolution {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return { status: "not_found", candidates: [], exact: false };
    }

    const serializedPrefix = `${PASSIVE_NAMESPACE}:`;
    if (trimmed.startsWith(serializedPrefix)) {
      const sourceRow = trimmed.slice(serializedPrefix.length);
      return this.#resolveTechnicalKey(sourceRow, trimmed);
    }
    const direct = this.#byKey.get(trimmed);
    if (direct !== undefined) {
      return resolvedAdapterKey(direct.passive, trimmed);
    }

    const normalized = normalizeMention(trimmed);
    if (normalized.length === 0) {
      return { status: "not_found", candidates: [], exact: false };
    }
    const exactCandidates = deduplicateCandidates(
      this.#byNormalizedName.get(normalized) ?? [],
    );
    if (exactCandidates.length === 1) {
      return {
        status: "resolved",
        exact: true,
        match: exactCandidates[0] as PassiveCandidate,
      };
    }
    if (exactCandidates.length > 1) {
      return { status: "ambiguous", exact: true, candidates: exactCandidates };
    }

    const bestByPassive = new Map<string, PassiveCandidate>();
    for (const indexed of this.#byKey.values()) {
      for (const alias of indexed.aliases) {
        const score = similarity(normalized, alias.normalized);
        if (score < fuzzyThreshold(normalized.length)) continue;
        const key = indexed.passive.adapterKey.value;
        const current = bestByPassive.get(key);
        if (
          current === undefined ||
          score > current.score ||
          (score === current.score && compareOrdinal(alias.value, current.matchedAlias) < 0)
        ) {
          bestByPassive.set(key, {
            passive: indexed.passive,
            score,
            matchedAlias: alias.value,
            aliasSource: alias.source,
          });
        }
      }
    }
    const candidates = [...bestByPassive.values()]
      .sort(compareCandidates)
      .slice(0, Math.max(1, Math.min(limit, 20)));
    return candidates.length === 0
      ? { status: "not_found", candidates: [], exact: false }
      : { status: "candidates", candidates, exact: false };
  }

  resolvePersisted(reference: unknown): PersistedPassiveResolution {
    const parsed = PersistedPassiveReferenceSchema.safeParse(reference);
    if (!parsed.success) {
      return { status: "unknown_key", currentDataset: this.currentDataset };
    }
    if (!samePassiveDataset(parsed.data.dataset, this.currentDataset)) {
      return {
        status: "migration_required",
        currentDataset: this.currentDataset,
      };
    }
    const indexed = this.#byKey.get(parsed.data.adapterKey.value);
    return indexed === undefined
      ? { status: "unknown_key", currentDataset: this.currentDataset }
      : { status: "current", passive: indexed.passive };
  }

  #resolveTechnicalKey(sourceRow: string, matchedAlias: string): PassiveResolution {
    const indexed = this.#byKey.get(sourceRow);
    return indexed === undefined
      ? { status: "not_found", candidates: [], exact: false }
      : resolvedAdapterKey(indexed.passive, matchedAlias);
  }
}

export const currentPassiveResolver = new PassiveResolver(passiveArtifactJson);
export const currentPassiveDataset = currentPassiveResolver.currentDataset;

function resolvedAdapterKey(passive: PassiveRecord, matchedAlias: string): PassiveResolution {
  return {
    status: "resolved",
    exact: true,
    match: {
      passive,
      score: 1,
      matchedAlias,
      aliasSource: "adapter_key",
    },
  };
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCandidates(left: PassiveCandidate, right: PassiveCandidate): number {
  return (
    right.score - left.score ||
    compareOrdinal(left.passive.adapterKey.value, right.passive.adapterKey.value) ||
    compareOrdinal(left.matchedAlias, right.matchedAlias)
  );
}

function deduplicateAliases(
  aliases: Array<{ value: string; source: AliasSource }>,
): AliasEntry[] {
  const result = new Map<string, AliasEntry>();
  for (const alias of aliases) {
    const normalized = normalizeMention(alias.value);
    const identity = `${normalized}\u0000${alias.source}`;
    if (!result.has(identity)) result.set(identity, { ...alias, normalized });
  }
  return [...result.values()];
}

function deduplicateCandidates(candidates: PassiveCandidate[]): PassiveCandidate[] {
  const byPassive = new Map<string, PassiveCandidate>();
  for (const candidate of candidates) {
    const key = candidate.passive.adapterKey.value;
    const previous = byPassive.get(key);
    if (
      previous === undefined ||
      compareOrdinal(candidate.matchedAlias, previous.matchedAlias) < 0
    ) {
      byPassive.set(key, candidate);
    }
  }
  return [...byPassive.values()].sort(compareCandidates);
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
  return previous[right.length] ?? Math.max(left.length, right.length);
}
