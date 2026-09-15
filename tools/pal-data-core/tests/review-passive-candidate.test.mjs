import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPassiveReview,
  parsePassiveOverlay,
  validatePassiveCandidate,
} from "../scripts/review-passive-candidate.mjs";

const HASH = "a".repeat(64);
const MAIN = "Pal/Content/Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main";
const COMMON = `${MAIN}_Common`;

function passive(sourceRow, sourceOrdinal, overrideNameTextId, overrides = {}) {
  return {
    sourceRow,
    sourceOrdinal,
    rank: "EPalPassiveSkillRank::Rank1",
    lotteryWeight: 1,
    category: "EPalPassiveSkillCategory::Normal",
    overrideNameTextId,
    presentFields: ["Category", "LotteryWeight", "OverrideNameTextId", "Rank"],
    ...overrides,
  };
}

function text(sourceRow, sourceOrdinal, value) {
  return { sourceRow, sourceOrdinal, text: value };
}

function table(packagePath, rows) {
  return { packagePath, rowCount: rows.length, rows };
}

function candidate({
  mainRows = [passive("Passive_A", 7, "PASSIVE_NAME_A")],
  commonRows = [passive("Passive_A", 91, "PASSIVE_NAME_A")],
  namesEn = [text("PASSIVE_NAME_A", 3, "Swift")],
  namesDe = [text("PASSIVE_NAME_A", 4, "Blitzschnell")],
} = {}) {
  return {
    schemaVersion: 1,
    steamBuildId: "25247047",
    passiveTables: [table(MAIN, mainRows), table(COMMON, commonRows)],
    passiveNamesEn: [table("Pal/Content/L10N/en/SkillNames", namesEn)],
    passiveNamesDe: [table("Pal/Content/L10N/de/SkillNames", namesDe)],
  };
}

function overlay(passives) {
  return { passives };
}

test("produces deterministic review output for identical candidates", () => {
  const input = candidate();
  const first = buildPassiveReview(input, overlay([]), HASH);
  const second = buildPassiveReview(structuredClone(input), overlay([]), HASH);
  assert.deepEqual(second, first);
});

test("coalesces identical Main/Common entities without treating ordinals as identity", () => {
  const report = buildPassiveReview(candidate(), overlay([]), HASH);
  assert.equal(report.ok, true);
  assert.equal(report.counts.technicalSourceRows, 2);
  assert.equal(report.counts.coalescedTechnicalEntities, 1);
  assert.deepEqual(report.entities[0].sources, [
    { packagePath: MAIN, sourceOrdinal: 7 },
    { packagePath: COMMON, sourceOrdinal: 91 },
  ]);

  const reordered = candidate({
    mainRows: [passive("Passive_A", 700, "PASSIVE_NAME_A")],
    commonRows: [passive("Passive_A", 900, "PASSIVE_NAME_A")],
  });
  const reorderedReport = buildPassiveReview(reordered, overlay([]), "b".repeat(64));
  assert.equal(
    reorderedReport.passiveDataset.referenceSpaceSha256,
    report.passiveDataset.referenceSpaceSha256,
  );
  assert.notEqual(
    reorderedReport.passiveDataset.technicalCandidateSha256,
    report.passiveDataset.technicalCandidateSha256,
  );
});

test("fails closed on contradictory Main/Common content", () => {
  const report = buildPassiveReview(
    candidate({ commonRows: [passive("Passive_A", 91, "PASSIVE_NAME_A", { lotteryWeight: 2 })] }),
    overlay([]),
    HASH,
  );
  assert.equal(report.ok, false);
  assert.equal(report.counts.sourceConflicts, 1);
  assert.equal(report.identityAssessment.status, "blocked-by-source-conflict");
  assert.equal(report.passiveDataset.referenceSpaceSha256, null);
  assert.equal(report.entities.length, 0);
});

test("does not coalesce an absent field with a matching fallback value", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Passive_A", 7, "PASSIVE_NAME_A", { lotteryWeight: 0 })],
      commonRows: [
        passive("Passive_A", 91, "PASSIVE_NAME_A", {
          lotteryWeight: 0,
          presentFields: ["Category", "OverrideNameTextId", "Rank"],
        }),
      ],
    }),
    overlay([]),
    HASH,
  );
  assert.equal(report.ok, false);
  assert.equal(report.sourceConflicts[0].kind, "passive-main-common-content-conflict");
});

test("surfaces missing localizations and never invents a name reference", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Passive_A", 0, "PASSIVE_NAME_A"), passive("Passive_B", 1, "")],
      commonRows: [],
      namesEn: [text("PASSIVE_NAME_A", 0, "Swift")],
      namesDe: [],
    }),
    overlay([]),
    HASH,
  );
  assert.equal(report.counts.missingNameReference, 1);
  assert.equal(report.counts.missingNameDe, 1);
  const unnamed = report.entities.find(({ sourceRow }) => sourceRow === "Passive_B");
  assert.equal(unnamed.nameReference, null);
  assert.equal(unnamed.nameEn, null);
  assert.equal(unnamed.nameDe, null);
});

test("surfaces genuine official display-name ambiguity", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Passive_A", 0, "NAME_A"), passive("Passive_B", 1, "NAME_B")],
      commonRows: [],
      namesEn: [text("NAME_A", 0, "Shared"), text("NAME_B", 1, "Shared")],
      namesDe: [text("NAME_A", 0, "Gemeinsam"), text("NAME_B", 1, "Gemeinsam")],
    }),
    overlay([]),
    HASH,
  );
  assert.deepEqual(report.nameAmbiguities, [
    { language: "en", name: "Shared", sourceRows: ["Passive_A", "Passive_B"] },
    { language: "de", name: "Gemeinsam", sourceRows: ["Passive_A", "Passive_B"] },
  ]);
});

test("maps overlay records only through agreeing exact bilingual names", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Passive_A", 0, "NAME_A"), passive("Passive_B", 1, "NAME_B")],
      commonRows: [],
      namesEn: [text("NAME_A", 0, "Swift"), text("NAME_B", 1, "Runner")],
      namesDe: [text("NAME_A", 0, "Blitzschnell"), text("NAME_B", 1, "Läufer")],
    }),
    overlay([
      { nr: 999, en: "Swift", de: "Blitzschnell", rank: 4 },
      { nr: 1000, en: "Swif", de: "Blitzschnell", rank: 4 },
      { nr: 1001, en: "Unknown", de: "Unbekannt", rank: 1 },
      { nr: 1002, en: "Swift", de: "Läufer", rank: 4 },
    ]),
    HASH,
  );
  assert.deepEqual(report.overlay.mapped, [
    { recordNumber: 999, nameEn: "Swift", nameDe: "Blitzschnell", sourceRow: "Passive_A" },
  ]);
  assert.equal(report.overlay.missing.length, 2);
  assert.equal(report.overlay.ambiguous.length, 1);
  assert.equal(report.overlay.mapped[0].sourceRow, "Passive_A");
  assert.notEqual(report.overlay.mapped[0].sourceRow, String(report.overlay.mapped[0].recordNumber));
});

test("parses the historical overlay as data without executing it", () => {
  assert.deepEqual(
    parsePassiveOverlay('window.PALWORLD_PASSIVES_DATA = {"passives":[{"nr":1,"en":"Swift","de":"Blitzschnell"}]};'),
    { passives: [{ nr: 1, en: "Swift", de: "Blitzschnell" }] },
  );
  assert.throws(() => parsePassiveOverlay("alert('not data')"), /expected data assignment shape/u);
});

test("rejects malformed technical candidates before review", () => {
  const malformed = candidate();
  malformed.passiveTables[0].rows[0].lotteryWeight = "1";
  assert.throws(() => validatePassiveCandidate(malformed), /lotteryWeight must be a finite number/u);
});
