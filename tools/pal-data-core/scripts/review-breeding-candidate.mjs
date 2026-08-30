#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

function usage() {
  console.error(
    "Usage: node review-breeding-candidate.mjs SNAPSHOT PAL_VALUES SPECIALS OUTPUT",
  );
  process.exit(1);
}

const [, , snapshotPath, palValuesPath, specialsPath, outputPath] = process.argv;
if (!snapshotPath || !palValuesPath || !specialsPath || !outputPath) usage();

const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const snapshotBytes = await readFile(resolve(snapshotPath));
const snapshot = JSON.parse(snapshotBytes.toString("utf8"));
const canonicalPals = await readJson(palValuesPath);
const canonicalSpecials = await readJson(specialsPath);

if (![1, 2].includes(snapshot.schemaVersion) || !snapshot.steamBuildId) {
  throw new Error("Unsupported or incomplete technical snapshot.");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceOrdinal")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

function coalesce(tables, kind) {
  const grouped = new Map();
  for (const table of tables) {
    for (const row of table.rows) {
      const entries = grouped.get(row.sourceRow) ?? [];
      entries.push({ packagePath: table.packagePath, row });
      grouped.set(row.sourceRow, entries);
    }
  }

  const conflicts = [];
  const rows = new Map();
  for (const [sourceRow, entries] of grouped) {
    const representations = new Set(entries.map(({ row }) => JSON.stringify(stable(row))));
    if (representations.size > 1) {
      conflicts.push({ kind, sourceRow, packagePaths: entries.map(({ packagePath }) => packagePath) });
      continue;
    }
    rows.set(sourceRow, entries[0].row);
  }
  return { rows, conflicts };
}

function enumValue(value) {
  const text = String(value ?? "");
  return text.includes("::") ? text.slice(text.lastIndexOf("::") + 2) : text;
}

function gender(value) {
  const normalized = enumValue(value).toUpperCase();
  if (normalized.endsWith("MALE") && !normalized.endsWith("FEMALE")) return "MALE";
  if (normalized.endsWith("FEMALE")) return "FEMALE";
  return "ANY";
}

function orientedSpecialKey(parentA, genderA, parentB, genderB, child) {
  const left = `${parentA}|${genderA}`;
  const right = `${parentB}|${genderB}`;
  return left <= right ? `${left}||${right}=>${child}` : `${right}||${left}=>${child}`;
}

const pals = coalesce(snapshot.palTables, "pal-source-conflict");
const breeding = coalesce(snapshot.breedingTables, "breeding-source-conflict");
const namesEn = coalesce(snapshot.palNamesEn, "pal-name-en-source-conflict");
const namesDe = coalesce(snapshot.palNamesDe, "pal-name-de-source-conflict");
const namesEnByLowercase = new Map(
  [...namesEn.rows].map(([key, value]) => [key.toLowerCase(), value.text]),
);
const namesDeByLowercase = new Map(
  [...namesDe.rows].map(([key, value]) => [key.toLowerCase(), value.text]),
);
const sourceConflicts = [
  ...pals.conflicts,
  ...breeding.conflicts,
  ...namesEn.conflicts,
  ...namesDe.conflicts,
];

const palMismatches = [];
for (const canonical of canonicalPals) {
  const row = pals.rows.get(canonical.game_table_row);
  if (!row) {
    palMismatches.push({ internalName: canonical.internal_name, field: "game_table_row", expected: canonical.game_table_row, actual: null });
    continue;
  }
  const overrideName = row.overrideNameTextId && row.overrideNameTextId !== "None"
    ? row.overrideNameTextId
    : null;
  const officialNameKey = overrideName ?? `PAL_NAME_${enumValue(row.tribe)}`;
  for (const [field, expected, actual] of [
    ["combi_rank", canonical.combi_rank, row.combiRank],
    ["rarity", canonical.rarity, row.rarity],
    ["ignore_combi", canonical.ignore_combi, row.ignoreCombi],
    ["combi_duplicate_priority", canonical.combi_duplicate_priority, row.combiDuplicatePriority],
    ["paldex_no", canonical.paldex_no, row.zukanIndex >= 0 ? row.zukanIndex : null],
    ["name_en", canonical.name_en, namesEnByLowercase.get(officialNameKey.toLowerCase()) ?? null],
    ["name_de", canonical.name_de, namesDeByLowercase.get(officialNameKey.toLowerCase()) ?? null],
  ]) {
    if (expected !== actual) palMismatches.push({ internalName: canonical.internal_name, field, expected, actual });
  }
}

const released = new Set(canonicalPals.map(({ internal_name }) => internal_name));
const releasedByLowercase = new Map(
  [...released].map((internalName) => [internalName.toLowerCase(), internalName]),
);
const releasedId = (value) => {
  const raw = enumValue(value);
  return releasedByLowercase.get(raw.toLowerCase()) ?? raw;
};
const candidateSpecials = [];
for (const [sourceRow, row] of breeding.rows) {
  const parentA = releasedId(row.parentTribeA);
  const parentB = releasedId(row.parentTribeB);
  const child = releasedId(row.childCharacterId);
  if (parentA === parentB || !released.has(parentA) || !released.has(parentB) || !released.has(child)) continue;
  candidateSpecials.push({
    sourceRow,
    key: orientedSpecialKey(parentA, gender(row.parentGenderA), parentB, gender(row.parentGenderB), child),
  });
}

const canonicalSpecialKeys = new Map(
  canonicalSpecials.map((row) => [
    orientedSpecialKey(
      row.parent_a_internal,
      row.parent_a_gender,
      row.parent_b_internal,
      row.parent_b_gender,
      row.child_internal,
    ),
    row.row_id,
  ]),
);
const candidateSpecialKeys = new Map(candidateSpecials.map(({ key, sourceRow }) => [key, sourceRow]));
const missingCanonicalSpecials = [...canonicalSpecialKeys]
  .filter(([key]) => !candidateSpecialKeys.has(key))
  .map(([key, rowId]) => ({ key, rowId }));
const newCandidateSpecials = [...candidateSpecialKeys]
  .filter(([key]) => !canonicalSpecialKeys.has(key))
  .map(([key, sourceRow]) => ({ key, sourceRow }));

const report = {
  schemaVersion: 1,
  steamBuildId: snapshot.steamBuildId,
  technicalSnapshotSchemaVersion: snapshot.schemaVersion,
  technicalSnapshotSha256: createHash("sha256").update(snapshotBytes).digest("hex"),
  releasedFilter: {
    source: "existing-reviewed-canonical-membership",
    count: released.size,
    note: "Membership is a product filter, not a substitute for the full Technical Core.",
  },
  counts: {
    technicalPalRows: pals.rows.size,
    reviewedCanonicalPals: canonicalPals.length,
    technicalBreedingRows: breeding.rows.size,
    reviewedCanonicalSpecials: canonicalSpecials.length,
    candidateCrossSpeciesSpecials: candidateSpecials.length,
  },
  sourceConflicts,
  palMismatches,
  missingCanonicalSpecials,
  newCandidateSpecials,
  ok:
    sourceConflicts.length === 0 &&
    palMismatches.length === 0 &&
    missingCanonicalSpecials.length === 0 &&
    newCandidateSpecials.length === 0,
};

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: resolve(outputPath), ...report.counts, ok: report.ok }));
process.exitCode = report.ok ? 0 : 2;
