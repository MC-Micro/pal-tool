#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { passiveReferenceSpaceSha256 } from "./review-passive-candidate.mjs";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const PASSIVE_NAMESPACE = "palworld.passive.source_row";

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  throw new TypeError(message);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object.`);
  return value;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort(compareOrdinal);
  const wanted = [...expected].sort(compareOrdinal);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} must contain exactly: ${wanted.join(", ")}.`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireCommitSha(value, label) {
  if (typeof value !== "string" || !COMMIT_SHA_PATTERN.test(value)) {
    fail(`${label} must be a lowercase 40- or 64-character Git object id.`);
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer.`);
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validatePassivePublicationApproval(value) {
  const approval = requireRecord(value, "approval");
  requireExactKeys(
    approval,
    ["schemaVersion", "adapterKeyNamespace", "sourceReview", "provenance", "expectedCounts"],
    "approval",
  );
  if (approval.schemaVersion !== 1) fail("approval.schemaVersion must be 1.");
  if (approval.adapterKeyNamespace !== PASSIVE_NAMESPACE) {
    fail(`approval.adapterKeyNamespace must be ${PASSIVE_NAMESPACE}.`);
  }

  const sourceReview = requireRecord(approval.sourceReview, "approval.sourceReview");
  requireExactKeys(
    sourceReview,
    ["schemaVersion", "steamBuildId", "technicalCandidateSha256", "referenceSpaceSha256"],
    "approval.sourceReview",
  );
  if (sourceReview.schemaVersion !== 2) fail("approval.sourceReview.schemaVersion must be 2.");
  requireString(sourceReview.steamBuildId, "approval.sourceReview.steamBuildId");
  requireSha256(sourceReview.technicalCandidateSha256, "approval.sourceReview.technicalCandidateSha256");
  requireSha256(sourceReview.referenceSpaceSha256, "approval.sourceReview.referenceSpaceSha256");

  const provenance = requireRecord(approval.provenance, "approval.provenance");
  requireExactKeys(
    provenance,
    ["repository", "workflow", "workflowRunId", "commitSha", "artifactName", "artifactId", "artifactSha256"],
    "approval.provenance",
  );
  for (const key of ["repository", "workflow", "workflowRunId", "artifactName", "artifactId"]) {
    requireString(provenance[key], `approval.provenance.${key}`);
  }
  if (provenance.repository !== "MC-Micro/pal-tool") {
    fail("approval.provenance.repository must be MC-Micro/pal-tool.");
  }
  if (provenance.workflow !== "Probe Pal Data Core") {
    fail("approval.provenance.workflow must be Probe Pal Data Core.");
  }
  if (!/^\d+$/u.test(provenance.workflowRunId) || !/^\d+$/u.test(provenance.artifactId)) {
    fail("approval provenance run and artifact ids must be decimal strings.");
  }
  if (provenance.artifactName !== `pal-data-core-candidate-${sourceReview.steamBuildId}`) {
    fail("approval artifact name does not match the reviewed Steam build.");
  }
  requireCommitSha(provenance.commitSha, "approval.provenance.commitSha");
  requireSha256(provenance.artifactSha256, "approval.provenance.artifactSha256");

  const expectedCounts = requireRecord(approval.expectedCounts, "approval.expectedCounts");
  const countKeys = [
    "technicalSourceRows",
    "coalescedTechnicalEntities",
    "displayableEntities",
    "nonDisplayableEntities",
    "technicalSourceConflicts",
    "relevantLocalizationConflicts",
    "displayableMissingNameReference",
    "displayableMissingNameEn",
    "displayableMissingNameDe",
    "ambiguousNamesEn",
    "ambiguousNamesDe",
    "overlayRecords",
    "overlayMapped",
    "overlayAmbiguous",
    "overlayMissing",
    "displayableEntitiesOutsideOverlay",
  ];
  requireExactKeys(expectedCounts, countKeys, "approval.expectedCounts");
  for (const key of countKeys) {
    requireNonNegativeInteger(expectedCounts[key], `approval.expectedCounts.${key}`);
  }
  if (
    expectedCounts.displayableEntities + expectedCounts.nonDisplayableEntities !==
    expectedCounts.coalescedTechnicalEntities
  ) {
    fail("approval expected entity counts do not partition the technical entities.");
  }
  if (
    expectedCounts.overlayMapped + expectedCounts.overlayAmbiguous + expectedCounts.overlayMissing !==
    expectedCounts.overlayRecords
  ) {
    fail("approval expected overlay counts do not partition the overlay records.");
  }
  if (expectedCounts.displayableEntitiesOutsideOverlay > expectedCounts.displayableEntities) {
    fail("approval outside-overlay count exceeds the displayable entity count.");
  }
  return approval;
}

function validateNameReference(value, sourceRow, label) {
  const reference = requireRecord(value, label);
  requireExactKeys(reference, ["source", "field", "value"], label);
  requireString(reference.value, `${label}.value`);
  if (reference.source === "explicit_override") {
    if (reference.field !== "overrideNameTextId") {
      fail(`${label}.field must be overrideNameTextId for an explicit override.`);
    }
  } else if (reference.source === "observed_default_row_convention") {
    if (reference.field !== "sourceRow" || reference.value !== `PASSIVE_${sourceRow}`) {
      fail(`${label} does not match the observed PASSIVE_sourceRow convention.`);
    }
  } else {
    fail(`${label}.source is unsupported.`);
  }
  return {
    source: reference.source,
    field: reference.field,
    value: reference.value,
  };
}

function validateReferenceEntities(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  const entries = value.map((item, index) => {
    const entityLabel = `${label}[${index}]`;
    const entity = requireRecord(item, entityLabel);
    requireExactKeys(entity, ["sourceRow", "nameReference", "nameEn", "nameDe"], entityLabel);
    const sourceRow = requireString(entity.sourceRow, `${entityLabel}.sourceRow`);
    return {
      sourceRow,
      nameReference: validateNameReference(entity.nameReference, sourceRow, `${entityLabel}.nameReference`),
      nameEn: requireString(entity.nameEn, `${entityLabel}.nameEn`),
      nameDe: requireString(entity.nameDe, `${entityLabel}.nameDe`),
    };
  });

  const exact = new Set();
  const folded = new Map();
  for (const entry of entries) {
    if (exact.has(entry.sourceRow)) fail(`Duplicate passive sourceRow: ${entry.sourceRow}.`);
    exact.add(entry.sourceRow);
    const normalized = entry.sourceRow.toLowerCase();
    const previous = folded.get(normalized);
    if (previous !== undefined) {
      fail(`Passive sourceRow case collision: ${previous} / ${entry.sourceRow}.`);
    }
    folded.set(normalized, entry.sourceRow);
  }
  return entries;
}

function requireReviewMatch(actual, expected, label) {
  if (!sameJson(actual, expected)) {
    fail(`${label} does not match the approved value.`);
  }
}

export function publishPassiveReference(reviewValue, approvalValue) {
  const approval = validatePassivePublicationApproval(approvalValue);
  const review = requireRecord(reviewValue, "review");
  if (review.schemaVersion !== approval.sourceReview.schemaVersion) {
    fail("Review schema does not match the approval.");
  }
  if (review.ok !== true) fail("Passive publication requires a successful review.");
  if (!Array.isArray(review.gateFailures) || review.gateFailures.length !== 0) {
    fail("Passive publication requires an empty gateFailures array.");
  }

  const assessment = requireRecord(review.identityAssessment, "review.identityAssessment");
  if (
    assessment.candidateNamespace !== approval.adapterKeyNamespace ||
    assessment.candidateValueField !== "sourceRow" ||
    assessment.status !== "supported-within-candidate-awaiting-review"
  ) {
    fail("Review identity assessment is not publishable.");
  }

  const passiveDataset = requireRecord(review.passiveDataset, "review.passiveDataset");
  requireReviewMatch(review.steamBuildId, approval.sourceReview.steamBuildId, "Review steamBuildId");
  requireReviewMatch(passiveDataset.schemaVersion, approval.sourceReview.schemaVersion, "Review dataset schema");
  requireReviewMatch(
    passiveDataset.steamBuildId,
    approval.sourceReview.steamBuildId,
    "Review dataset steamBuildId",
  );
  requireReviewMatch(
    passiveDataset.technicalCandidateSha256,
    approval.sourceReview.technicalCandidateSha256,
    "Technical candidate hash",
  );
  requireReviewMatch(
    passiveDataset.referenceSpaceSha256,
    approval.sourceReview.referenceSpaceSha256,
    "Reference-space hash",
  );

  const counts = requireRecord(review.counts, "review.counts");
  for (const [key, expected] of Object.entries(approval.expectedCounts)) {
    requireReviewMatch(counts[key], expected, `Review count ${key}`);
  }

  const referenceSpace = requireRecord(review.resolverReferenceSpace, "review.resolverReferenceSpace");
  requireExactKeys(referenceSpace, ["schemaVersion", "entities"], "review.resolverReferenceSpace");
  if (referenceSpace.schemaVersion !== approval.sourceReview.schemaVersion) {
    fail("Resolver reference-space schema does not match the approval.");
  }
  const entries = validateReferenceEntities(
    referenceSpace.entities,
    "review.resolverReferenceSpace.entities",
  );
  if (entries.length !== approval.expectedCounts.displayableEntities) {
    fail("Published entity count does not match the approved displayable count.");
  }
  const calculatedReferenceHash = passiveReferenceSpaceSha256({
    schemaVersion: referenceSpace.schemaVersion,
    entities: entries,
  });
  requireReviewMatch(
    calculatedReferenceHash,
    approval.sourceReview.referenceSpaceSha256,
    "Calculated reference-space hash",
  );

  return {
    schemaVersion: 1,
    domain: "palworld.passive.reference_space",
    adapterKeyNamespace: approval.adapterKeyNamespace,
    dataset: {
      schemaVersion: 1,
      referenceSpaceSha256: approval.sourceReview.referenceSpaceSha256,
      provenance: {
        steamBuildId: approval.sourceReview.steamBuildId,
        technicalCandidateSha256: approval.sourceReview.technicalCandidateSha256,
        sourceReviewSchemaVersion: approval.sourceReview.schemaVersion,
        ...approval.provenance,
      },
    },
    entries: entries.toSorted((left, right) => compareOrdinal(left.sourceRow, right.sourceRow)),
  };
}

export function validatePublishedPassiveReference(value) {
  const artifact = requireRecord(value, "artifact");
  requireExactKeys(
    artifact,
    ["schemaVersion", "domain", "adapterKeyNamespace", "dataset", "entries"],
    "artifact",
  );
  if (artifact.schemaVersion !== 1 || artifact.domain !== "palworld.passive.reference_space") {
    fail("Unsupported canonical passive artifact schema or domain.");
  }
  if (artifact.adapterKeyNamespace !== PASSIVE_NAMESPACE) {
    fail(`artifact.adapterKeyNamespace must be ${PASSIVE_NAMESPACE}.`);
  }
  const dataset = requireRecord(artifact.dataset, "artifact.dataset");
  requireExactKeys(dataset, ["schemaVersion", "referenceSpaceSha256", "provenance"], "artifact.dataset");
  if (dataset.schemaVersion !== 1) fail("artifact.dataset.schemaVersion must be 1.");
  requireSha256(dataset.referenceSpaceSha256, "artifact.dataset.referenceSpaceSha256");
  const provenance = requireRecord(dataset.provenance, "artifact.dataset.provenance");
  requireExactKeys(
    provenance,
    [
      "steamBuildId",
      "technicalCandidateSha256",
      "sourceReviewSchemaVersion",
      "repository",
      "workflow",
      "workflowRunId",
      "commitSha",
      "artifactName",
      "artifactId",
      "artifactSha256",
    ],
    "artifact.dataset.provenance",
  );
  requireString(provenance.steamBuildId, "artifact.dataset.provenance.steamBuildId");
  requireSha256(
    provenance.technicalCandidateSha256,
    "artifact.dataset.provenance.technicalCandidateSha256",
  );
  if (provenance.sourceReviewSchemaVersion !== 2) {
    fail("artifact.dataset.provenance.sourceReviewSchemaVersion must be 2.");
  }
  if (provenance.repository !== "MC-Micro/pal-tool" || provenance.workflow !== "Probe Pal Data Core") {
    fail("Canonical passive artifact provenance is not from the approved repository workflow.");
  }
  if (!/^\d+$/u.test(provenance.workflowRunId) || !/^\d+$/u.test(provenance.artifactId)) {
    fail("Canonical passive artifact provenance ids must be decimal strings.");
  }
  requireCommitSha(provenance.commitSha, "artifact.dataset.provenance.commitSha");
  requireSha256(provenance.artifactSha256, "artifact.dataset.provenance.artifactSha256");
  if (provenance.artifactName !== `pal-data-core-candidate-${provenance.steamBuildId}`) {
    fail("Canonical passive artifact name does not match its Steam build provenance.");
  }
  const entries = validateReferenceEntities(artifact.entries, "artifact.entries");
  const sorted = entries.toSorted((left, right) => compareOrdinal(left.sourceRow, right.sourceRow));
  if (!sameJson(entries, sorted)) fail("artifact.entries must be sorted by sourceRow ordinally.");
  const calculated = passiveReferenceSpaceSha256({ schemaVersion: 2, entities: entries });
  if (calculated !== dataset.referenceSpaceSha256) {
    fail("Canonical passive artifact does not reproduce its reference-space hash.");
  }
  return artifact;
}

async function runCli() {
  const [, , reviewPath, approvalPath, outputPath] = process.argv;
  if (!reviewPath || !approvalPath || !outputPath) {
    console.error("Usage: node publish-passive-reference.mjs REVIEW APPROVAL OUTPUT");
    process.exitCode = 1;
    return;
  }
  const review = JSON.parse(await readFile(resolve(reviewPath), "utf8"));
  const approval = JSON.parse(await readFile(resolve(approvalPath), "utf8"));
  const artifact = publishPassiveReference(review, approval);
  validatePublishedPassiveReference(artifact);
  await writeFile(resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({
    output: resolve(outputPath),
    entries: artifact.entries.length,
    referenceSpaceSha256: artifact.dataset.referenceSpaceSha256,
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runCli();
}
