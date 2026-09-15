import assert from "node:assert/strict";
import test from "node:test";

import { passiveReferenceSpaceSha256 } from "../scripts/review-passive-candidate.mjs";
import {
  publishPassiveReference,
  validatePublishedPassiveReference,
} from "../scripts/publish-passive-reference.mjs";

const CANDIDATE_HASH = "a".repeat(64);
const ARTIFACT_HASH = "b".repeat(64);
const COMMIT_HASH = "c".repeat(40);

function entity(sourceRow, nameEn, nameDe) {
  return {
    sourceRow,
    nameReference: {
      source: "observed_default_row_convention",
      field: "sourceRow",
      value: `PASSIVE_${sourceRow}`,
    },
    nameEn,
    nameDe,
  };
}

function fixture() {
  const entities = [
    entity("ElementBoost_Normal_2_PAL", "Celestial Emperor", "Erleuchteter"),
    entity("Rare", "Lucky", "Außergewöhnlich"),
    entity("WorldTree_Sanity", "Hermit Sage", "Erleuchteter"),
  ];
  const referenceSpaceSha256 = passiveReferenceSpaceSha256({ schemaVersion: 2, entities });
  const counts = {
    technicalSourceRows: 8,
    coalescedTechnicalEntities: 4,
    displayableEntities: 3,
    nonDisplayableEntities: 1,
    technicalSourceConflicts: 0,
    relevantLocalizationConflicts: 0,
    displayableMissingNameReference: 0,
    displayableMissingNameEn: 0,
    displayableMissingNameDe: 0,
    ambiguousNamesEn: 0,
    ambiguousNamesDe: 1,
    overlayRecords: 2,
    overlayMapped: 2,
    overlayAmbiguous: 0,
    overlayMissing: 0,
    displayableEntitiesOutsideOverlay: 1,
  };
  return {
    review: {
      schemaVersion: 2,
      steamBuildId: "25247047",
      passiveDataset: {
        schemaVersion: 2,
        steamBuildId: "25247047",
        technicalCandidateSha256: CANDIDATE_HASH,
        referenceSpaceSha256,
      },
      identityAssessment: {
        candidateNamespace: "palworld.passive.source_row",
        candidateValueField: "sourceRow",
        status: "supported-within-candidate-awaiting-review",
      },
      counts,
      resolverReferenceSpace: { schemaVersion: 2, entities },
      gateFailures: [],
      ok: true,
    },
    approval: {
      schemaVersion: 1,
      adapterKeyNamespace: "palworld.passive.source_row",
      sourceReview: {
        schemaVersion: 2,
        steamBuildId: "25247047",
        technicalCandidateSha256: CANDIDATE_HASH,
        referenceSpaceSha256,
      },
      provenance: {
        repository: "MC-Micro/pal-tool",
        workflow: "Probe Pal Data Core",
        workflowRunId: "1",
        commitSha: COMMIT_HASH,
        artifactName: "pal-data-core-candidate-25247047",
        artifactId: "2",
        artifactSha256: ARTIFACT_HASH,
      },
      expectedCounts: { ...counts },
    },
  };
}

test("publishes a deterministic minimal reference artifact", () => {
  const { review, approval } = fixture();
  const first = publishPassiveReference(review, approval);
  const second = publishPassiveReference(structuredClone(review), structuredClone(approval));
  assert.deepEqual(second, first);
  assert.equal(first.entries.length, 3);
  assert.deepEqual(
    first.entries.map(({ sourceRow }) => sourceRow),
    ["ElementBoost_Normal_2_PAL", "Rare", "WorldTree_Sanity"],
  );
  assert.doesNotThrow(() => validatePublishedPassiveReference(first));
  assert.doesNotMatch(JSON.stringify(first), /rank|lottery|category|sourceOrdinal|raw/ui);
});

test("fails closed for an unsuccessful review", () => {
  const { review, approval } = fixture();
  review.ok = false;
  assert.throws(() => publishPassiveReference(review, approval), /successful review/u);
});

test("rejects mismatched approved provenance and counts", () => {
  const { review, approval } = fixture();
  approval.sourceReview.technicalCandidateSha256 = "d".repeat(64);
  assert.throws(() => publishPassiveReference(review, approval), /Technical candidate hash/u);

  const countMismatch = fixture();
  countMismatch.approval.expectedCounts.displayableEntities = 4;
  assert.throws(
    () => publishPassiveReference(countMismatch.review, countMismatch.approval),
    /expected entity counts/u,
  );
});

test("rejects a manipulated reference space", () => {
  const { review, approval } = fixture();
  review.resolverReferenceSpace.entities[0].nameEn = "Manipulated";
  assert.throws(() => publishPassiveReference(review, approval), /Calculated reference-space hash/u);
});

test("rejects unknown fields instead of publishing unreviewed semantics", () => {
  const { review, approval } = fixture();
  review.resolverReferenceSpace.entities[0].effect = "invented";
  assert.throws(
    () => publishPassiveReference(review, approval),
    /must contain exactly/u,
  );
});

test("rejects duplicate and case-colliding adapter keys", () => {
  const duplicate = fixture();
  duplicate.review.resolverReferenceSpace.entities[1] = structuredClone(
    duplicate.review.resolverReferenceSpace.entities[0],
  );
  duplicate.approval.sourceReview.referenceSpaceSha256 = passiveReferenceSpaceSha256(
    duplicate.review.resolverReferenceSpace,
  );
  duplicate.review.passiveDataset.referenceSpaceSha256 =
    duplicate.approval.sourceReview.referenceSpaceSha256;
  assert.throws(() => publishPassiveReference(duplicate.review, duplicate.approval), /Duplicate/u);

  const collision = fixture();
  collision.review.resolverReferenceSpace.entities[1] = entity(
    "elementboost_normal_2_pal",
    "Other",
    "Andere",
  );
  collision.approval.sourceReview.referenceSpaceSha256 = passiveReferenceSpaceSha256(
    collision.review.resolverReferenceSpace,
  );
  collision.review.passiveDataset.referenceSpaceSha256 =
    collision.approval.sourceReview.referenceSpaceSha256;
  assert.throws(() => publishPassiveReference(collision.review, collision.approval), /case collision/u);
});

test("a published artifact detects post-publication tampering", () => {
  const { review, approval } = fixture();
  const artifact = publishPassiveReference(review, approval);
  artifact.entries[0].nameDe = "Manipuliert";
  assert.throws(
    () => validatePublishedPassiveReference(artifact),
    /does not reproduce its reference-space hash/u,
  );
});
