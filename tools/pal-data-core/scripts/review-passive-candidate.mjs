#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
}

function validateTables(tables, label, validateRow) {
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new TypeError(`${label} must contain at least one source table.`);
  }
  for (const [tableIndex, table] of tables.entries()) {
    if (!isRecord(table)) throw new TypeError(`${label}[${tableIndex}] must be an object.`);
    requireString(table.packagePath, `${label}[${tableIndex}].packagePath`);
    if (!Number.isInteger(table.rowCount) || table.rowCount < 0) {
      throw new TypeError(`${label}[${tableIndex}].rowCount must be a non-negative integer.`);
    }
    if (!Array.isArray(table.rows) || table.rows.length !== table.rowCount) {
      throw new TypeError(`${label}[${tableIndex}].rows must match rowCount.`);
    }
    for (const [rowIndex, row] of table.rows.entries()) {
      validateRow(row, `${label}[${tableIndex}].rows[${rowIndex}]`);
    }
  }
}

function validateTechnicalRow(row, label) {
  if (!isRecord(row)) throw new TypeError(`${label} must be an object.`);
  requireString(row.sourceRow, `${label}.sourceRow`);
  if (!Number.isInteger(row.sourceOrdinal) || row.sourceOrdinal < 0) {
    throw new TypeError(`${label}.sourceOrdinal must be a non-negative integer.`);
  }
  if (!Number.isInteger(row.rank)) {
    throw new TypeError(`${label}.rank must be an integer.`);
  }
  if (!Number.isInteger(row.lotteryWeight)) {
    throw new TypeError(`${label}.lotteryWeight must be an integer.`);
  }
  requireString(row.category, `${label}.category`, { allowEmpty: true });
  requireString(row.overrideNameTextId, `${label}.overrideNameTextId`, { allowEmpty: true });
  if (!Array.isArray(row.presentFields) || row.presentFields.some((field) => typeof field !== "string" || field.length === 0)) {
    throw new TypeError(`${label}.presentFields must be an array of non-empty strings.`);
  }
}

function validateTextRow(row, label) {
  if (!isRecord(row)) throw new TypeError(`${label} must be an object.`);
  requireString(row.sourceRow, `${label}.sourceRow`);
  if (!Number.isInteger(row.sourceOrdinal) || row.sourceOrdinal < 0) {
    throw new TypeError(`${label}.sourceOrdinal must be a non-negative integer.`);
  }
  requireString(row.text, `${label}.text`, { allowEmpty: true });
}

export function validatePassiveCandidate(candidate) {
  if (!isRecord(candidate)) throw new TypeError("Passive candidate must be an object.");
  if (candidate.schemaVersion !== 2) {
    throw new TypeError(`Unsupported passive candidate schema ${String(candidate.schemaVersion)}.`);
  }
  requireString(candidate.steamBuildId, "steamBuildId");
  validateTables(candidate.passiveTables, "passiveTables", validateTechnicalRow);
  validateTables(candidate.passiveNamesEn, "passiveNamesEn", validateTextRow);
  validateTables(candidate.passiveNamesDe, "passiveNamesDe", validateTextRow);
  return candidate;
}

function stable(value, omittedKeys = new Set()) {
  if (Array.isArray(value)) return value.map((child) => stable(child, omittedKeys));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !omittedKeys.has(key))
        .sort(([left], [right]) => compareOrdinal(left, right))
        .map(([key, child]) => [key, stable(child, omittedKeys)]),
    );
  }
  return value;
}

export function passiveReferenceSpaceSha256(referenceSpace) {
  return createHash("sha256")
    .update(JSON.stringify(stable(referenceSpace)))
    .digest("hex");
}

function rowContent(row) {
  return stable(row, new Set(["sourceRow", "sourceOrdinal"]));
}

function coalesceTechnical(tables) {
  const grouped = new Map();
  for (const table of tables) {
    for (const row of table.rows) {
      const entries = grouped.get(row.sourceRow) ?? [];
      entries.push({ packagePath: table.packagePath, row });
      grouped.set(row.sourceRow, entries);
    }
  }

  const entities = [];
  const conflicts = [];
  for (const sourceRow of [...grouped.keys()].sort(compareOrdinal)) {
    const entries = grouped.get(sourceRow).toSorted((left, right) =>
      compareOrdinal(left.packagePath, right.packagePath),
    );
    const representations = new Set(
      entries.map(({ row }) => JSON.stringify(rowContent(row))),
    );
    if (representations.size > 1) {
      conflicts.push({
        kind: "passive-main-common-content-conflict",
        sourceRow,
        entries: entries.map(({ packagePath, row }) => ({
          packagePath,
          sourceOrdinal: row.sourceOrdinal,
          content: rowContent(row),
        })),
      });
      continue;
    }
    entities.push({
      sourceRow,
      sources: entries.map(({ packagePath, row }) => ({
        packagePath,
        sourceOrdinal: row.sourceOrdinal,
      })),
      raw: rowContent(entries[0].row),
    });
  }
  return { entities, conflicts };
}

function coalesceText(tables, language) {
  const grouped = new Map();
  for (const table of tables) {
    for (const row of table.rows) {
      const entries = grouped.get(row.sourceRow) ?? [];
      entries.push({ packagePath: table.packagePath, row });
      grouped.set(row.sourceRow, entries);
    }
  }

  const rows = new Map();
  const conflicts = [];
  for (const sourceRow of [...grouped.keys()].sort(compareOrdinal)) {
    const entries = grouped.get(sourceRow).toSorted((left, right) =>
      compareOrdinal(left.packagePath, right.packagePath),
    );
    const texts = new Set(entries.map(({ row }) => row.text));
    if (texts.size > 1) {
      conflicts.push({
        kind: `passive-name-${language}-content-conflict`,
        sourceRow,
        entries: entries.map(({ packagePath, row }) => ({
          packagePath,
          sourceOrdinal: row.sourceOrdinal,
          text: row.text,
        })),
      });
      continue;
    }
    rows.set(sourceRow, entries[0].row.text);
  }
  return { rows, conflicts };
}

function usableNameReference(value) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.toLowerCase() !== "none" ? trimmed : null;
}

function enumValue(value) {
  const text = String(value ?? "");
  return text.includes("::") ? text.slice(text.lastIndexOf("::") + 2) : text;
}

function isDisplayable(entity) {
  return enumValue(entity.raw.category) === "SortDisplayable";
}

function localizationKeyExists(localized, key) {
  return localized.rows.has(key) || localized.conflicts.some((conflict) => conflict.sourceRow === key);
}

function resolveNameReference(entity, localizedEn, localizedDe) {
  const explicit = usableNameReference(entity.raw.overrideNameTextId);
  if (explicit !== null) {
    return {
      source: "explicit_override",
      field: "overrideNameTextId",
      value: explicit,
    };
  }

  const observedDefault = `PASSIVE_${entity.sourceRow}`;
  if (
    localizationKeyExists(localizedEn, observedDefault) ||
    localizationKeyExists(localizedDe, observedDefault)
  ) {
    return {
      source: "observed_default_row_convention",
      field: "sourceRow",
      value: observedDefault,
    };
  }
  return null;
}

function indexByDisplayName(entities, field) {
  const index = new Map();
  for (const entity of entities) {
    const name = entity[field];
    if (name === null || name.length === 0) continue;
    const sourceRows = index.get(name) ?? [];
    sourceRows.push(entity.sourceRow);
    index.set(name, sourceRows);
  }
  for (const sourceRows of index.values()) sourceRows.sort(compareOrdinal);
  return index;
}

function ambiguousNames(index, language) {
  return [...index.entries()]
    .filter(([, sourceRows]) => sourceRows.length > 1)
    .sort(([left], [right]) => compareOrdinal(left, right))
    .map(([name, sourceRows]) => ({ language, name, sourceRows }));
}

export function parsePassiveOverlay(source) {
  const prefix = "window.PALWORLD_PASSIVES_DATA = ";
  const trimmed = source.trim();
  if (!trimmed.startsWith(prefix) || !trimmed.endsWith(";")) {
    throw new TypeError("Historical passive overlay does not have the expected data assignment shape.");
  }
  const overlay = JSON.parse(trimmed.slice(prefix.length, -1));
  if (!isRecord(overlay) || !Array.isArray(overlay.passives)) {
    throw new TypeError("Historical passive overlay does not contain a passives array.");
  }
  for (const [index, passive] of overlay.passives.entries()) {
    if (!isRecord(passive)) throw new TypeError(`overlay.passives[${index}] must be an object.`);
    requireString(passive.en, `overlay.passives[${index}].en`);
    requireString(passive.de, `overlay.passives[${index}].de`);
  }
  return overlay;
}

function reviewOverlay(overlay, namesEn, namesDe) {
  const mapped = [];
  const ambiguous = [];
  const missing = [];
  for (const passive of overlay.passives) {
    const enMatches = namesEn.get(passive.en) ?? [];
    const deMatches = namesDe.get(passive.de) ?? [];
    const trace = { recordNumber: passive.nr ?? null, nameEn: passive.en, nameDe: passive.de };
    const deMatchSet = new Set(deMatches);
    const agreeingMatches = enMatches.filter((sourceRow) => deMatchSet.has(sourceRow));
    if (agreeingMatches.length === 1) {
      mapped.push({ ...trace, sourceRow: agreeingMatches[0] });
      continue;
    }
    const candidates = [...new Set([...enMatches, ...deMatches])].sort(compareOrdinal);
    if (agreeingMatches.length > 1 || (enMatches.length > 0 && deMatches.length > 0)) {
      ambiguous.push({
        ...trace,
        enMatches,
        deMatches,
        agreeingMatches,
        candidateSourceRows: candidates,
      });
    } else {
      missing.push({
        ...trace,
        reason:
          candidates.length === 0
            ? "no-exact-official-name-match"
            : "no-agreeing-bilingual-exact-match",
        candidateSourceRows: candidates,
      });
    }
  }
  return {
    source: "apps/passives-pwa/data-passives.js editorial overlay",
    policy: "Only agreeing exact EN and DE matches map. nr, array position, rank, sourceOrdinal, and fuzzy similarity are never identity.",
    count: overlay.passives.length,
    mapped,
    ambiguous,
    missing,
  };
}

export function buildPassiveReview(candidateValue, overlay, candidateSha256) {
  const candidate = validatePassiveCandidate(candidateValue);
  if (!SHA256_PATTERN.test(candidateSha256)) {
    throw new TypeError("candidateSha256 must be a lowercase SHA-256 digest.");
  }

  const technical = coalesceTechnical(candidate.passiveTables);
  const localizedEn = coalesceText(candidate.passiveNamesEn, "en");
  const localizedDe = coalesceText(candidate.passiveNamesDe, "de");
  const entities = technical.entities.map((entity) => {
    const nameReference = resolveNameReference(entity, localizedEn, localizedDe);
    return {
      ...entity,
      nameReference,
      nameEn: nameReference === null ? null : localizedEn.rows.get(nameReference.value) ?? null,
      nameDe: nameReference === null ? null : localizedDe.rows.get(nameReference.value) ?? null,
    };
  });

  const displayableEntities = entities.filter(isDisplayable);
  const nonDisplayableEntities = entities.filter((entity) => !isDisplayable(entity));
  const namesEn = indexByDisplayName(displayableEntities, "nameEn");
  const namesDe = indexByDisplayName(displayableEntities, "nameDe");
  const missingNameReference = displayableEntities
    .filter(({ nameReference }) => nameReference === null)
    .map(({ sourceRow }) => sourceRow);
  const missingNameEn = displayableEntities
    .filter(({ nameReference, nameEn }) => nameReference !== null && nameEn === null)
    .map(({ sourceRow, nameReference }) => ({ sourceRow, nameReference: nameReference.value }));
  const missingNameDe = displayableEntities
    .filter(({ nameReference, nameDe }) => nameReference !== null && nameDe === null)
    .map(({ sourceRow, nameReference }) => ({ sourceRow, nameReference: nameReference.value }));
  const nameAmbiguitiesEn = ambiguousNames(namesEn, "en");
  const nameAmbiguitiesDe = ambiguousNames(namesDe, "de");
  const allLocalizationConflicts = [
    ...localizedEn.conflicts,
    ...localizedDe.conflicts,
  ];
  const relevantNameKeys = new Set(
    displayableEntities
      .map(({ nameReference }) => nameReference?.value)
      .filter((value) => value !== undefined),
  );
  const relevantLocalizationConflicts = allLocalizationConflicts.filter(({ sourceRow }) =>
    relevantNameKeys.has(sourceRow),
  );
  const sourceConflicts = [
    ...technical.conflicts,
    ...relevantLocalizationConflicts,
  ];
  const overlayReview = reviewOverlay(overlay, namesEn, namesDe);
  const mappedSourceRows = new Set(overlayReview.mapped.map(({ sourceRow }) => sourceRow));
  const displayableEntitiesOutsideOverlay = displayableEntities
    .filter(({ sourceRow }) => !mappedSourceRows.has(sourceRow))
    .map(({ sourceRow, nameEn, nameDe }) => ({ sourceRow, nameEn, nameDe }));
  const referenceSpace = {
    schemaVersion: 2,
    entities: displayableEntities.map(({ sourceRow, nameReference, nameEn, nameDe }) => ({
      sourceRow,
      nameReference,
      nameEn,
      nameDe,
    })),
  };
  const referenceSpaceReady =
    sourceConflicts.length === 0 &&
    missingNameReference.length === 0 &&
    missingNameEn.length === 0 &&
    missingNameDe.length === 0;
  const referenceSpaceSha256 = referenceSpaceReady
    ? passiveReferenceSpaceSha256(referenceSpace)
    : null;
  const gateFailures = [];
  if (technical.conflicts.length > 0) gateFailures.push("technical-source-conflicts");
  if (relevantLocalizationConflicts.length > 0) gateFailures.push("relevant-localization-conflicts");
  if (missingNameReference.length > 0) gateFailures.push("displayable-name-reference-missing");
  if (missingNameEn.length > 0) gateFailures.push("displayable-en-name-missing");
  if (missingNameDe.length > 0) gateFailures.push("displayable-de-name-missing");
  if (overlayReview.missing.length > 0) gateFailures.push("overlay-mapping-missing");
  if (overlayReview.ambiguous.length > 0) gateFailures.push("overlay-mapping-ambiguous");
  if (overlayReview.mapped.length !== overlayReview.count) gateFailures.push("overlay-not-fully-mapped");

  return {
    schemaVersion: 2,
    steamBuildId: candidate.steamBuildId,
    passiveDataset: {
      schemaVersion: 2,
      steamBuildId: candidate.steamBuildId,
      technicalCandidateSha256: candidateSha256,
      referenceSpaceSha256,
    },
    identityAssessment: {
      candidateNamespace: "palworld.passive.source_row",
      candidateValueField: "sourceRow",
      status: gateFailures.length === 0
        ? "supported-within-candidate-awaiting-review"
        : "blocked-by-review-gate",
      note: "The review reports candidate evidence only. Publication and persisted-key use require explicit review of a current official build artifact.",
    },
    counts: {
      technicalSourceRows: candidate.passiveTables.reduce((sum, table) => sum + table.rowCount, 0),
      coalescedTechnicalEntities: entities.length,
      displayableEntities: displayableEntities.length,
      nonDisplayableEntities: nonDisplayableEntities.length,
      sourceConflicts: sourceConflicts.length,
      technicalSourceConflicts: technical.conflicts.length,
      relevantLocalizationConflicts: relevantLocalizationConflicts.length,
      allLocalizationConflicts: allLocalizationConflicts.length,
      displayableMissingNameReference: missingNameReference.length,
      displayableMissingNameEn: missingNameEn.length,
      displayableMissingNameDe: missingNameDe.length,
      ambiguousNamesEn: nameAmbiguitiesEn.length,
      ambiguousNamesDe: nameAmbiguitiesDe.length,
      overlayRecords: overlayReview.count,
      overlayMapped: overlayReview.mapped.length,
      overlayAmbiguous: overlayReview.ambiguous.length,
      overlayMissing: overlayReview.missing.length,
      displayableEntitiesOutsideOverlay: displayableEntitiesOutsideOverlay.length,
    },
    entities,
    resolverReferenceSpace: referenceSpace,
    sourceConflicts,
    technicalSourceConflicts: technical.conflicts,
    relevantLocalizationConflicts,
    allLocalizationConflicts,
    displayableMissingNameReference: missingNameReference,
    displayableMissingNameEn: missingNameEn,
    displayableMissingNameDe: missingNameDe,
    nameAmbiguitiesEn,
    nameAmbiguitiesDe,
    overlay: overlayReview,
    displayableEntitiesOutsideOverlay,
    gateFailures,
    ok: gateFailures.length === 0,
  };
}

async function runCli() {
  const [, , candidatePath, overlayPath, outputPath] = process.argv;
  if (!candidatePath || !overlayPath || !outputPath) {
    console.error("Usage: node review-passive-candidate.mjs CANDIDATE DATA_PASSIVES OUTPUT");
    process.exitCode = 1;
    return;
  }
  const candidateBytes = await readFile(resolve(candidatePath));
  const candidate = JSON.parse(candidateBytes.toString("utf8"));
  const overlay = parsePassiveOverlay(await readFile(resolve(overlayPath), "utf8"));
  const candidateSha256 = createHash("sha256").update(candidateBytes).digest("hex");
  const report = buildPassiveReview(candidate, overlay, candidateSha256);
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: resolve(outputPath), ...report.counts, ok: report.ok }));
  process.exitCode = report.ok ? 0 : 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runCli();
}
