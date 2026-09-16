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
    rank: 1,
    lotteryWeight: 1,
    category: "EPalPassiveCategory::SortDisplayable",
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
    schemaVersion: 2,
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
  assert.equal(report.identityAssessment.status, "blocked-by-review-gate");
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
  assert.equal(report.counts.displayableMissingNameReference, 1);
  assert.equal(report.counts.displayableMissingNameDe, 1);
  const unnamed = report.entities.find(({ sourceRow }) => sourceRow === "Passive_B");
  assert.equal(unnamed.nameReference, null);
  assert.equal(unnamed.nameEn, null);
  assert.equal(unnamed.nameDe, null);
});

test("uses the observed PASSIVE_sourceRow convention only when localization proves it", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Rare", 0, "None")],
      commonRows: [],
      namesEn: [text("PASSIVE_Rare", 0, "Lucky")],
      namesDe: [text("PASSIVE_Rare", 0, "Außergewöhnlich")],
    }),
    overlay([]),
    HASH,
  );
  assert.equal(report.ok, true);
  assert.deepEqual(report.entities[0].nameReference, {
    source: "observed_default_row_convention",
    field: "sourceRow",
    value: "PASSIVE_Rare",
  });
  assert.equal(report.entities[0].nameEn, "Lucky");
  assert.equal(report.entities[0].nameDe, "Außergewöhnlich");
});

test("prefers an explicit override over an available default row convention", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Rare", 0, "CUSTOM_RARE")],
      commonRows: [],
      namesEn: [text("CUSTOM_RARE", 0, "Lucky Override"), text("PASSIVE_Rare", 1, "Lucky")],
      namesDe: [text("CUSTOM_RARE", 0, "Außergewöhnlich Override"), text("PASSIVE_Rare", 1, "Außergewöhnlich")],
    }),
    overlay([]),
    HASH,
  );
  assert.deepEqual(report.entities[0].nameReference, {
    source: "explicit_override",
    field: "overrideNameTextId",
    value: "CUSTOM_RARE",
  });
  assert.equal(report.entities[0].nameEn, "Lucky Override");
  assert.equal(report.entities[0].nameDe, "Außergewöhnlich Override");
});

test("does not derive a default reference when no official localization key exists", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [passive("Unknown_Row", 0, "None")],
      commonRows: [],
      namesEn: [text("UNRELATED", 0, "Unrelated")],
      namesDe: [text("UNRELATED", 0, "Nicht verwandt")],
    }),
    overlay([]),
    HASH,
  );
  assert.equal(report.entities[0].nameReference, null);
  assert.equal(report.counts.displayableMissingNameReference, 1);
  assert.equal(report.ok, false);
});

test("does not let an unnamed non-displayable entity block the resolver gate", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [
        passive("Internal_Runtime", 0, "None", {
          category: "EPalPassiveCategory::SortNotDisplayable",
        }),
      ],
      commonRows: [],
      namesEn: [],
      namesDe: [],
    }),
    overlay([]),
    HASH,
  );
  assert.equal(report.counts.displayableEntities, 0);
  assert.equal(report.counts.nonDisplayableEntities, 1);
  assert.equal(report.counts.displayableMissingNameReference, 0);
  assert.equal(report.ok, true);
});

test("blocks relevant localization conflicts but only reports unrelated ones", () => {
  const relevant = candidate();
  relevant.passiveNamesEn.push(
    table("Pal/Content/L10N/en/SkillNames_Conflict", [
      text("PASSIVE_NAME_A", 50, "Different Swift"),
    ]),
  );
  const relevantReport = buildPassiveReview(relevant, overlay([]), HASH);
  assert.equal(relevantReport.counts.relevantLocalizationConflicts, 1);
  assert.equal(relevantReport.ok, false);

  const unrelated = candidate();
  unrelated.passiveNamesEn[0].rows.push(text("UNRELATED", 10, "First"));
  unrelated.passiveNamesEn[0].rowCount += 1;
  unrelated.passiveNamesEn.push(
    table("Pal/Content/L10N/en/SkillNames_Conflict", [text("UNRELATED", 50, "Second")]),
  );
  const unrelatedReport = buildPassiveReview(unrelated, overlay([]), HASH);
  assert.equal(unrelatedReport.counts.allLocalizationConflicts, 1);
  assert.equal(unrelatedReport.counts.relevantLocalizationConflicts, 0);
  assert.equal(unrelatedReport.ok, true);
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
  assert.deepEqual(report.nameAmbiguitiesEn, [
    { language: "en", name: "Shared", sourceRows: ["Passive_A", "Passive_B"] },
  ]);
  assert.deepEqual(report.nameAmbiguitiesDe, [
    { language: "de", name: "Gemeinsam", sourceRows: ["Passive_A", "Passive_B"] },
  ]);
});

test("keeps German ambiguity while bilingual overlay evidence selects one row", () => {
  const report = buildPassiveReview(
    candidate({
      mainRows: [
        passive("ElementBoost_Normal_2_PAL", 0, "None"),
        passive("WorldTree_Sanity", 1, "None"),
      ],
      commonRows: [],
      namesEn: [
        text("PASSIVE_ElementBoost_Normal_2_PAL", 0, "Celestial Emperor"),
        text("PASSIVE_WorldTree_Sanity", 1, "Hermit Sage"),
      ],
      namesDe: [
        text("PASSIVE_ElementBoost_Normal_2_PAL", 0, "Erleuchteter"),
        text("PASSIVE_WorldTree_Sanity", 1, "Erleuchteter"),
      ],
    }),
    overlay([{ nr: 42, en: "Celestial Emperor", de: "Erleuchteter" }]),
    HASH,
  );
  assert.equal(report.nameAmbiguitiesEn.length, 0);
  assert.deepEqual(report.nameAmbiguitiesDe, [
    {
      language: "de",
      name: "Erleuchteter",
      sourceRows: ["ElementBoost_Normal_2_PAL", "WorldTree_Sanity"],
    },
  ]);
  assert.deepEqual(report.overlay.mapped, [
    {
      recordNumber: 42,
      nameEn: "Celestial Emperor",
      nameDe: "Erleuchteter",
      sourceRow: "ElementBoost_Normal_2_PAL",
    },
  ]);
  assert.equal(report.ok, true);
});

test("keeps rank numeric but excludes balance fields from the resolver fingerprint", () => {
  const first = buildPassiveReview(
    candidate({
      mainRows: [passive("Rare", 0, "None", { rank: 4, lotteryWeight: 1 })],
      commonRows: [],
      namesEn: [text("PASSIVE_Rare", 0, "Lucky")],
      namesDe: [text("PASSIVE_Rare", 0, "Außergewöhnlich")],
    }),
    overlay([]),
    HASH,
  );
  const balanced = buildPassiveReview(
    candidate({
      mainRows: [passive("Rare", 0, "None", { rank: 1, lotteryWeight: 999 })],
      commonRows: [],
      namesEn: [text("PASSIVE_Rare", 0, "Lucky")],
      namesDe: [text("PASSIVE_Rare", 0, "Außergewöhnlich")],
    }),
    overlay([]),
    "b".repeat(64),
  );
  assert.equal(first.entities[0].raw.rank, 4);
  assert.equal(balanced.entities[0].raw.rank, 1);
  assert.equal(
    first.passiveDataset.referenceSpaceSha256,
    balanced.passiveDataset.referenceSpaceSha256,
  );
});

test("fails the review gate when the historical overlay does not fully map", () => {
  const report = buildPassiveReview(
    candidate(),
    overlay([{ nr: 1, en: "Unknown", de: "Unbekannt" }]),
    HASH,
  );
  assert.equal(report.ok, false);
  assert.ok(report.gateFailures.includes("overlay-mapping-missing"));
  assert.ok(report.gateFailures.includes("overlay-not-fully-mapped"));
});

test("reports technical, resolver, overlay, ambiguity, and outside-overlay counts separately", () => {
  const rows = [
    passive("Rare", 0, "None", { rank: 4 }),
    passive("MoveSpeed_up_3", 1, "None", { rank: 4 }),
    passive("New_Displayable", 2, "None", { rank: 1 }),
    passive("Internal_Runtime", 3, "None", {
      category: "EPalPassiveCategory::SortNotDisplayable",
    }),
  ];
  const report = buildPassiveReview(
    candidate({
      mainRows: rows,
      commonRows: rows.map((row, index) => ({ ...row, sourceOrdinal: 100 + index })),
      namesEn: [
        text("PASSIVE_Rare", 0, "Lucky"),
        text("PASSIVE_MoveSpeed_up_3", 1, "Swift"),
        text("PASSIVE_New_Displayable", 2, "New"),
      ],
      namesDe: [
        text("PASSIVE_Rare", 0, "Außergewöhnlich"),
        text("PASSIVE_MoveSpeed_up_3", 1, "Blitzschnell"),
        text("PASSIVE_New_Displayable", 2, "Neu"),
      ],
    }),
    overlay([
      { nr: 1, en: "Lucky", de: "Außergewöhnlich" },
      { nr: 2, en: "Swift", de: "Blitzschnell" },
    ]),
    HASH,
  );
  assert.deepEqual(report.counts, {
    technicalSourceRows: 8,
    coalescedTechnicalEntities: 4,
    displayableEntities: 3,
    nonDisplayableEntities: 1,
    sourceConflicts: 0,
    technicalSourceConflicts: 0,
    relevantLocalizationConflicts: 0,
    allLocalizationConflicts: 0,
    displayableMissingNameReference: 0,
    displayableMissingNameEn: 0,
    displayableMissingNameDe: 0,
    ambiguousNamesEn: 0,
    ambiguousNamesDe: 0,
    overlayRecords: 2,
    overlayMapped: 2,
    overlayAmbiguous: 0,
    overlayMissing: 0,
    displayableEntitiesOutsideOverlay: 1,
  });
  assert.equal(report.ok, true);
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
  assert.throws(() => validatePassiveCandidate(malformed), /lotteryWeight must be an integer/u);

  const stringRank = candidate();
  stringRank.passiveTables[0].rows[0].rank = "1";
  assert.throws(() => validatePassiveCandidate(stringRank), /rank must be an integer/u);
});
