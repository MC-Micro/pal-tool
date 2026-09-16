import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  validatePublishedPassiveReferenceAgainstApproval,
} from "../scripts/publish-passive-reference.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const artifact = JSON.parse(
  readFileSync(resolve(repositoryRoot, "data/palworld-core/passives.json"), "utf8"),
);
const approval = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "data/palworld-core/passives.approval.json"),
    "utf8",
  ),
);

test("validates the checked-in canonical reference against its explicit approval", () => {
  assert.doesNotThrow(() =>
    validatePublishedPassiveReferenceAgainstApproval(artifact, approval),
  );
  assert.equal(artifact.entries.length, 115);
  assert.equal(artifact.dataset.referenceSpaceSha256, approval.sourceReview.referenceSpaceSha256);
});

test("contains unique case-safe source rows and no technical balance fields", () => {
  const sourceRows = artifact.entries.map(({ sourceRow }) => sourceRow);
  assert.equal(new Set(sourceRows).size, 115);
  assert.equal(new Set(sourceRows.map((value) => value.toLowerCase())).size, 115);
  for (const entry of artifact.entries) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "nameDe",
      "nameEn",
      "nameReference",
      "sourceRow",
    ]);
    assert.deepEqual(Object.keys(entry.nameReference).sort(), [
      "field",
      "source",
      "value",
    ]);
  }
});

test("preserves the official German Erleuchteter ambiguity", () => {
  assert.deepEqual(
    artifact.entries
      .filter(({ nameDe }) => nameDe === "Erleuchteter")
      .map(({ sourceRow, nameEn, nameDe }) => ({ sourceRow, nameEn, nameDe })),
    [
      {
        sourceRow: "ElementBoost_Normal_2_PAL",
        nameEn: "Celestial Emperor",
        nameDe: "Erleuchteter",
      },
      {
        sourceRow: "WorldTree_Sanity",
        nameEn: "Hermit Sage",
        nameDe: "Erleuchteter",
      },
    ],
  );
});
