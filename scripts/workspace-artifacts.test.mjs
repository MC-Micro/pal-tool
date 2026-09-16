import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import {
  WorkspaceArtifactError,
  checkProfile,
  crc32,
  downloadGitHubArtifact,
  extractZipSecurely,
  fetchProfile,
  loadProfileContext,
  loadRegistry,
  prepareProfile,
  sha256File,
} from "./workspace-artifacts.mjs";

const EXPECTED_REPOSITORY = "MC-Micro/pal-tool";
const EXPECTED_REMOTE = `https://github.com/${EXPECTED_REPOSITORY}.git`;
const PROFILE = "approved-evidence";
const CANDIDATE_PATH = "passive-candidate-a.json";
const REVIEW_PATH = "passive-review.json";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content ?? "", "utf8");
    const checksum = crc32(content);
    const method = entry.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(content) : content;
    const declaredUncompressedSize = entry.declaredUncompressedSize ?? content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(declaredUncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declaredUncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function createFixture({
  omitReview = false,
  mutateReview = (value) => value,
  producerNotAncestor = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "pal-tool-artifacts-"));
  await writeFile(join(root, ".gitignore"), "/LOCAL_ARTIFACTS/\n");
  await writeFile(join(root, "seed.txt"), "fixture\n");
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "user.name", "Workspace Artifact Test");
  git(root, "remote", "add", "origin", EXPECTED_REMOTE);
  git(root, "add", ".gitignore", "seed.txt");
  git(root, "commit", "-m", "test: seed fixture");
  let producerHead = git(root, "rev-parse", "HEAD");
  if (producerNotAncestor) {
    git(root, "switch", "--create", "artifact-producer");
    await writeFile(join(root, "producer-evidence.txt"), "historical producer\n");
    git(root, "add", "producer-evidence.txt");
    git(root, "commit", "-m", "test: create historical artifact producer");
    producerHead = git(root, "rev-parse", "HEAD");
    git(root, "switch", "main");
  }

  const candidate = Buffer.from('{"passives":[{"internalName":"TestPassive"}]}\n');
  const candidateSha256 = sha256(candidate);
  const referenceSpaceSha256 = "b".repeat(64);
  const reviewDocument = mutateReview({
    schemaVersion: 2,
    steamBuildId: "25247047",
    passiveDataset: {
      technicalCandidateSha256: candidateSha256,
      referenceSpaceSha256,
    },
    ok: true,
  });
  const review = Buffer.from(`${JSON.stringify(reviewDocument)}\n`);
  const entries = [{ name: CANDIDATE_PATH, content: candidate }];
  if (!omitReview) entries.push({ name: REVIEW_PATH, content: review });
  const zip = makeZip(entries);
  const artifactSha256 = sha256(zip);

  const baseValues = {
    repository: EXPECTED_REPOSITORY,
    workflow: "Probe Pal Data Core",
    workflowRunId: "34975314764",
    repositoryHead: producerHead,
    artifactName: "pal-data-core-probe-25247047",
    artifactId: "10399160981",
    artifactSha256,
    steamBuildId: "25247047",
    sourceReviewSchemaVersion: 2,
    technicalCandidateSha256: candidateSha256,
    referenceSpaceSha256,
  };
  const profile = (localDirectory, values) => ({
    description: `Fixture profile ${localDirectory}.`,
    localDirectory,
    provenanceSources: [{ type: "inline", values }],
    expectedFiles: [CANDIDATE_PATH, REVIEW_PATH],
    contentChecks: [
      {
        type: "sha256",
        path: CANDIDATE_PATH,
        expected: { provenanceField: "technicalCandidateSha256" },
      },
      {
        type: "json_equals",
        path: REVIEW_PATH,
        pointer: "/schemaVersion",
        expected: { provenanceField: "sourceReviewSchemaVersion" },
      },
      {
        type: "json_equals",
        path: REVIEW_PATH,
        pointer: "/passiveDataset/referenceSpaceSha256",
        expected: { provenanceField: "referenceSpaceSha256" },
      },
      {
        type: "json_equals",
        path: REVIEW_PATH,
        pointer: "/ok",
        expected: { literal: true },
      },
    ],
  });
  const registry = {
    schemaVersion: 1,
    profiles: {
      [PROFILE]: profile(PROFILE, baseValues),
      "later-same-build": profile("later-same-build", {
        ...baseValues,
        workflowRunId: "34984667636",
        artifactId: "10402842001",
        artifactSha256: "c".repeat(64),
      }),
      "changed-candidate-same-artifact": profile("changed-candidate-same-artifact", {
        ...baseValues,
        technicalCandidateSha256: "d".repeat(64),
      }),
      "changed-reference-same-artifact": profile("changed-reference-same-artifact", {
        ...baseValues,
        referenceSpaceSha256: "e".repeat(64),
      }),
      "conflicting-approval": {
        ...profile("conflicting-approval", baseValues),
        provenanceSources: [
          {
            type: "json",
            path: "approval.json",
            map: Object.fromEntries(
              Object.keys(baseValues).map((field) => [field, `/${field}`]),
            ),
          },
          { type: "inline", values: { workflowRunId: "99999999999" } },
        ],
      },
      "prototype-field": profile("prototype-field", {
        ...baseValues,
        ["__proto__"]: "prototype-safe",
        constructor: "constructor-safe",
      }),
    },
  };
  await writeFile(join(root, "approval.json"), `${JSON.stringify(baseValues, null, 2)}\n`);
  await writeFile(join(root, "workspace-artifacts.json"), `${JSON.stringify(registry, null, 2)}\n`);
  git(root, "add", "approval.json", "workspace-artifacts.json");
  git(root, "commit", "-m", "test: add artifact registry");
  return { root, zip, baseValues, candidateSha256, referenceSpaceSha256 };
}

async function removeFixture(fixture) {
  await rm(fixture.root, { recursive: true, force: true });
}

async function placeZip(fixture, profile = PROFILE, zip = fixture.zip) {
  const context = await loadProfileContext(profile, { repositoryRoot: fixture.root });
  await mkdir(dirname(context.zipPath), { recursive: true });
  await writeFile(context.zipPath, zip);
  return context;
}

async function expectStatus(promise, status) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof WorkspaceArtifactError);
    assert.equal(error.status, status);
    return true;
  });
}

test("the production registry resolves approval provenance without duplicating it", async () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const registry = await loadRegistry({ repositoryRoot: root });
  assert.deepEqual(Object.keys(registry.profiles).sort(), [
    "pal-data-core-resolver-head-evidence",
    "passive-reference-approved-schema2",
  ]);
  const approved = await loadProfileContext("passive-reference-approved-schema2", {
    repositoryRoot: root,
  });
  const approval = JSON.parse(
    await readFile(new URL("../data/palworld-core/passives.approval.json", import.meta.url), "utf8"),
  );
  assert.equal(approved.provenance.workflowRunId, approval.provenance.workflowRunId);
  assert.equal(approved.provenance.artifactId, approval.provenance.artifactId);
  assert.equal(approved.provenance.artifactSha256, approval.provenance.artifactSha256);
});

test("unknown profiles and incomplete registries fail closed", async () => {
  const fixture = await createFixture();
  try {
    await expectStatus(
      loadProfileContext("does-not-exist", { repositoryRoot: fixture.root }),
      "registry_invalid",
    );
    await writeFile(
      join(fixture.root, "invalid.json"),
      '{"schemaVersion":1,"profiles":{},"unexpected":true}\n',
    );
    await expectStatus(
      loadRegistry({ repositoryRoot: fixture.root, registryPath: "invalid.json" }),
      "registry_invalid",
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("a pinned manual ZIP prepares once and is then reused without downloading", async () => {
  const fixture = await createFixture();
  try {
    await placeZip(fixture);
    let downloads = 0;
    const downloader = async () => { downloads += 1; };
    const first = await prepareProfile(PROFILE, { repositoryRoot: fixture.root, downloader });
    assert.equal(first.status, "artifact_prepared");
    assert.equal(first.reused, false);
    const second = await prepareProfile(PROFILE, { repositoryRoot: fixture.root, downloader });
    assert.equal(second.status, "ready");
    assert.equal(second.reused, true);
    const fetched = await fetchProfile(PROFILE, { repositoryRoot: fixture.root, downloader });
    assert.equal(fetched.status, "ready");
    assert.equal(fetched.reused, true);
    assert.equal(downloads, 0);
    const checked = await checkProfile(PROFILE, { repositoryRoot: fixture.root });
    assert.equal(checked.status, "ready");
  } finally {
    await removeFixture(fixture);
  }
});

test("a wrong local ZIP digest is rejected without download fallback", async () => {
  const fixture = await createFixture();
  try {
    await placeZip(fixture, PROFILE, Buffer.from("not the pinned archive"));
    let downloads = 0;
    await expectStatus(
      fetchProfile(PROFILE, {
        repositoryRoot: fixture.root,
        downloader: async () => { downloads += 1; },
      }),
      "artifact_digest_mismatch",
    );
    assert.equal(downloads, 0);
  } finally {
    await removeFixture(fixture);
  }
});

test("missing authentication fails before any GitHub data request", async () => {
  const fixture = await createFixture();
  try {
    const context = await loadProfileContext(PROFILE, { repositoryRoot: fixture.root });
    let requests = 0;
    await expectStatus(
      downloadGitHubArtifact(context, join(fixture.root, "download.zip"), {
        tokenProvider: async () => null,
        fetchImpl: async () => { requests += 1; },
      }),
      "artifact_auth_required",
    );
    assert.equal(requests, 0);
  } finally {
    await removeFixture(fixture);
  }
});

test("GitHub download requests only the exact run, artifact metadata, and artifact ZIP", async () => {
  const fixture = await createFixture();
  try {
    const context = await loadProfileContext(PROFILE, { repositoryRoot: fixture.root });
    const urls = [];
    const responses = [
      {
        id: Number(context.provenance.workflowRunId),
        name: context.provenance.workflow,
        head_sha: context.provenance.repositoryHead,
        repository: { full_name: context.provenance.repository },
        status: "completed",
        conclusion: "success",
      },
      {
        id: Number(context.provenance.artifactId),
        name: context.provenance.artifactName,
        expired: false,
        digest: `sha256:${context.provenance.artifactSha256}`,
        workflow_run: {
          id: Number(context.provenance.workflowRunId),
          head_sha: context.provenance.repositoryHead,
        },
      },
    ];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      if (responses.length > 0) return new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      return new Response(fixture.zip, { status: 200 });
    };
    const destination = join(fixture.root, "download.zip");
    await downloadGitHubArtifact(context, destination, {
      tokenProvider: async () => "test-token-never-printed",
      fetchImpl,
    });
    const base = `https://api.github.com/repos/${EXPECTED_REPOSITORY}`;
    assert.deepEqual(urls, [
      `${base}/actions/runs/${context.provenance.workflowRunId}`,
      `${base}/actions/artifacts/${context.provenance.artifactId}`,
      `${base}/actions/artifacts/${context.provenance.artifactId}/zip`,
    ]);
    assert.equal(await sha256File(destination), context.provenance.artifactSha256);
    assert.equal(urls.some((url) => /latest|artifacts\?/.test(url)), false);
  } finally {
    await removeFixture(fixture);
  }
});

test("a completed failed run is rejected before artifact metadata is requested", async () => {
  const fixture = await createFixture();
  try {
    const context = await loadProfileContext(PROFILE, { repositoryRoot: fixture.root });
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({
        id: Number(context.provenance.workflowRunId),
        name: context.provenance.workflow,
        head_sha: context.provenance.repositoryHead,
        repository: { full_name: context.provenance.repository },
        status: "completed",
        conclusion: "failure",
      }), { status: 200 });
    };
    await expectStatus(
      downloadGitHubArtifact(context, join(fixture.root, "download.zip"), {
        tokenProvider: async () => "test-token-never-printed",
        fetchImpl,
      }),
      "artifact_provenance_mismatch",
    );
    assert.deepEqual(urls, [
      `https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${context.provenance.workflowRunId}`,
    ]);
  } finally {
    await removeFixture(fixture);
  }
});

test("an in-progress run is rejected before artifact metadata is requested", async () => {
  const fixture = await createFixture();
  try {
    const context = await loadProfileContext(PROFILE, { repositoryRoot: fixture.root });
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({
        id: Number(context.provenance.workflowRunId),
        name: context.provenance.workflow,
        head_sha: context.provenance.repositoryHead,
        repository: { full_name: context.provenance.repository },
        status: "in_progress",
        conclusion: null,
      }), { status: 200 });
    };
    await expectStatus(
      downloadGitHubArtifact(context, join(fixture.root, "download.zip"), {
        tokenProvider: async () => "test-token-never-printed",
        fetchImpl,
      }),
      "artifact_provenance_mismatch",
    );
    assert.deepEqual(urls, [
      `https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${context.provenance.workflowRunId}`,
    ]);
  } finally {
    await removeFixture(fixture);
  }
});

test("an expired exact artifact stops without requesting a replacement or ZIP", async () => {
  const fixture = await createFixture();
  try {
    const context = await loadProfileContext(PROFILE, { repositoryRoot: fixture.root });
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      if (urls.length === 1) return new Response(JSON.stringify({
        id: Number(context.provenance.workflowRunId),
        name: context.provenance.workflow,
        head_sha: context.provenance.repositoryHead,
        repository: { full_name: context.provenance.repository },
        status: "completed",
        conclusion: "success",
      }), { status: 200 });
      return new Response(JSON.stringify({
        id: Number(context.provenance.artifactId),
        name: context.provenance.artifactName,
        expired: true,
      }), { status: 200 });
    };
    await expectStatus(
      downloadGitHubArtifact(context, join(fixture.root, "download.zip"), {
        tokenProvider: async () => "test-token-never-printed",
        fetchImpl,
      }),
      "artifact_unavailable",
    );
    assert.equal(urls.length, 2);
    assert.equal(urls.some((url) => /latest|artifacts\?/.test(url)), false);
  } finally {
    await removeFixture(fixture);
  }
});

test("an incomplete but correctly pinned archive is rejected and not published", async () => {
  const fixture = await createFixture({ omitReview: true });
  try {
    const context = await placeZip(fixture);
    await expectStatus(
      prepareProfile(PROFILE, { repositoryRoot: fixture.root }),
      "artifact_extract_incomplete",
    );
    await assert.rejects(readFile(context.receiptPath), { code: "ENOENT" });
  } finally {
    await removeFixture(fixture);
  }
});

test("missing required JSON provenance is classified as an artifact mismatch", async () => {
  const fixture = await createFixture({
    mutateReview: (review) => {
      const { ok: _removed, ...withoutOk } = review;
      return withoutOk;
    },
  });
  try {
    await placeZip(fixture);
    await expectStatus(
      prepareProfile(PROFILE, { repositoryRoot: fixture.root }),
      "artifact_provenance_mismatch",
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("the extractor rejects path traversal without writing outside its target", async () => {
  const root = await mkdtemp(join(tmpdir(), "pal-tool-zip-slip-"));
  try {
    const zipPath = join(root, "traversal.zip");
    const destination = join(root, "prepared");
    const outside = join(root, "outside.txt");
    await writeFile(zipPath, makeZip([{ name: "../outside.txt", content: "escape" }]));
    await mkdir(destination);
    await expectStatus(extractZipSecurely(zipPath, destination), "artifact_extract_incomplete");
    await assert.rejects(readFile(outside), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("workspace dirt is a primary preflight gate while artifact state remains visible", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.root, "untracked.txt"), "dirty\n");
    const checked = await checkProfile(PROFILE, { repositoryRoot: fixture.root });
    assert.equal(checked.status, "workspace_dirty");
    assert.equal(checked.workspace.status, "workspace_dirty");
    assert.equal(checked.artifact.status, "artifact_missing");
  } finally {
    await removeFixture(fixture);
  }
});

test("a clean workspace remains valid when the historical producer is not its ancestor", async () => {
  const fixture = await createFixture({ producerNotAncestor: true });
  try {
    assert.throws(() => git(
      fixture.root,
      "merge-base",
      "--is-ancestor",
      fixture.baseValues.repositoryHead,
      "HEAD",
    ));
    const checked = await checkProfile(PROFILE, { repositoryRoot: fixture.root });
    assert.equal(checked.workspace.status, "ready");
    assert.equal(checked.workspace.artifactProducerHead, fixture.baseValues.repositoryHead);
    assert.equal(checked.status, "artifact_missing");
  } finally {
    await removeFixture(fixture);
  }
});

test("a later source cannot silently overwrite approval provenance", async () => {
  const fixture = await createFixture();
  try {
    await expectStatus(
      loadProfileContext("conflicting-approval", { repositoryRoot: fixture.root }),
      "registry_invalid",
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("prototype-named provenance fields remain inert own properties", async () => {
  const fixture = await createFixture();
  try {
    const context = await loadProfileContext("prototype-field", { repositoryRoot: fixture.root });
    assert.equal(Object.getPrototypeOf(context.provenance), null);
    assert.equal(Object.hasOwn(context.provenance, "__proto__"), true);
    assert.equal(context.provenance.__proto__, "prototype-safe");
    assert.equal(context.provenance.constructor, "constructor-safe");
    assert.equal(Object.prototype["prototype-safe"], undefined);
  } finally {
    await removeFixture(fixture);
  }
});

test("same-build evidence remains operationally distinct from publication approval", async () => {
  const fixture = await createFixture();
  try {
    const approved = await loadProfileContext(PROFILE, { repositoryRoot: fixture.root });
    const later = await loadProfileContext("later-same-build", { repositoryRoot: fixture.root });
    assert.equal(approved.provenance.steamBuildId, later.provenance.steamBuildId);
    assert.equal(
      approved.provenance.technicalCandidateSha256,
      later.provenance.technicalCandidateSha256,
    );
    assert.equal(approved.provenance.referenceSpaceSha256, later.provenance.referenceSpaceSha256);
    assert.notEqual(approved.provenance.workflowRunId, later.provenance.workflowRunId);
    assert.notEqual(approved.provenance.artifactId, later.provenance.artifactId);
    assert.notEqual(approved.provenance.artifactSha256, later.provenance.artifactSha256);
  } finally {
    await removeFixture(fixture);
  }
});

test("technical archive, candidate, and reference-space identities are independent gates", async () => {
  const fixture = await createFixture();
  try {
    await placeZip(fixture, "changed-candidate-same-artifact");
    await expectStatus(
      prepareProfile("changed-candidate-same-artifact", { repositoryRoot: fixture.root }),
      "artifact_provenance_mismatch",
    );
    await placeZip(fixture, "changed-reference-same-artifact");
    await expectStatus(
      prepareProfile("changed-reference-same-artifact", { repositoryRoot: fixture.root }),
      "artifact_provenance_mismatch",
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("deflate output is bounded by the declared uncompressed size", async () => {
  const root = await mkdtemp(join(tmpdir(), "pal-tool-deflate-limit-"));
  try {
    const zipPath = join(root, "underdeclared.zip");
    const destination = join(root, "prepared");
    await writeFile(zipPath, makeZip([{
      name: "underdeclared.txt",
      content: Buffer.alloc(1024 * 1024, "A"),
      method: 8,
      declaredUncompressedSize: 16,
    }]));
    await mkdir(destination);
    await expectStatus(extractZipSecurely(zipPath, destination), "artifact_extract_incomplete");
    await assert.rejects(readFile(join(destination, "underdeclared.txt")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LOCAL_ARTIFACTS is ignored by the repository-wide tracked rule", () => {
  const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const ignored = git(repositoryRoot, "check-ignore", "LOCAL_ARTIFACTS/artifacts/example.zip");
  assert.equal(ignored.replaceAll("\\", "/"), "LOCAL_ARTIFACTS/artifacts/example.zip");
});
