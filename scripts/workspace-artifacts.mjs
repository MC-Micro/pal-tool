#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
} from "node:fs";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { inflateRawSync } from "node:zlib";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
export const DEFAULT_REGISTRY_PATH = "workspace-artifacts.json";
export const LOCAL_ARTIFACT_ROOT = "LOCAL_ARTIFACTS/artifacts";
const RECEIPT_NAME = ".workspace-artifact-receipt.json";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const DECIMAL_PATTERN = /^\d+$/u;
const PROFILE_PATTERN = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/u;
const MAX_ZIP_ENTRIES = 2_000;
const MAX_ZIP_ENTRY_BYTES = 512 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 1024 * 1024 * 1024;

const EXIT_CODES = Object.freeze({
  ready: 0,
  artifact_fetched: 0,
  artifact_prepared: 0,
  artifact_missing: 2,
  artifact_auth_required: 3,
  artifact_unavailable: 4,
  artifact_digest_mismatch: 5,
  artifact_provenance_mismatch: 6,
  artifact_extract_incomplete: 7,
  workspace_dirty: 8,
  workspace_revision_mismatch: 9,
  registry_invalid: 10,
});

export class WorkspaceArtifactError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = "WorkspaceArtifactError";
    this.status = status;
    this.details = details;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failRegistry(message, details = {}) {
  throw new WorkspaceArtifactError("registry_invalid", message, details);
}

function requireExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort(compareOrdinal);
  const expected = [...expectedKeys].sort(compareOrdinal);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failRegistry(`${label} must contain exactly: ${expected.join(", ")}.`);
  }
}

function requireRecord(value, label) {
  if (!isRecord(value)) failRegistry(`${label} must be an object.`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    failRegistry(`${label} must be a non-empty string.`);
  }
  return value;
}

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeSha256(value, label, status = "registry_invalid") {
  const fail = (message) => {
    throw new WorkspaceArtifactError(status, message);
  };
  if (typeof value !== "string") fail(`${label} must be a SHA-256 string.`);
  const normalized = value.startsWith("sha256:") ? value.slice(7) : value;
  if (!SHA256_PATTERN.test(normalized)) {
    fail(`${label} must be a lowercase SHA-256 digest.`);
  }
  return normalized;
}

function safeRepositoryPath(repositoryRoot, relativePath, label) {
  validateRelativePath(relativePath, label);
  const absolute = resolve(repositoryRoot, ...relativePath.split("/"));
  const difference = relative(repositoryRoot, absolute);
  if (difference.startsWith(`..${sep}`) || difference === ".." || isAbsolute(difference)) {
    failRegistry(`${label} resolves outside the repository.`);
  }
  return absolute;
}

function validateRelativePath(value, label) {
  requireString(value, label);
  if (value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[A-Za-z]:/u.test(value)) {
    failRegistry(`${label} must be a portable relative path.`);
  }
  const segments = value.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.endsWith(".") ||
        segment.endsWith(" ") ||
        segment.includes(":"),
    )
  ) {
    failRegistry(`${label} contains an unsafe path segment.`);
  }
  for (const segment of segments) {
    const stem = segment.split(".")[0]?.toUpperCase();
    if (stem && /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem)) {
      failRegistry(`${label} contains a Windows-reserved path segment.`);
    }
  }
  return value;
}

function decodeJsonPointer(document, pointer, label, status = "registry_invalid") {
  const fail = (message) => {
    throw new WorkspaceArtifactError(status, message);
  };
  if (pointer === "") return document;
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    fail(`${label} must be a JSON Pointer.`);
  }
  let current = document;
  for (const encoded of pointer.slice(1).split("/")) {
    const token = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isRecord(current) && !Array.isArray(current)) {
      fail(`${label} does not resolve.`);
    }
    if (!Object.hasOwn(current, token)) fail(`${label} does not resolve.`);
    current = current[token];
  }
  return current;
}

function validateExpectedSpec(value, label) {
  const expected = requireRecord(value, label);
  const keys = Object.keys(expected);
  if (keys.length !== 1 || !["literal", "provenanceField"].includes(keys[0])) {
    failRegistry(`${label} must contain exactly literal or provenanceField.`);
  }
  if (keys[0] === "provenanceField") {
    requireString(expected.provenanceField, `${label}.provenanceField`);
  }
  return expected;
}

function validateRegistry(registry) {
  requireRecord(registry, "registry");
  requireExactKeys(registry, ["schemaVersion", "profiles"], "registry");
  if (registry.schemaVersion !== 1) failRegistry("registry.schemaVersion must be 1.");
  const profiles = requireRecord(registry.profiles, "registry.profiles");
  if (Object.keys(profiles).length === 0) failRegistry("registry.profiles must not be empty.");

  for (const [profileName, profileValue] of Object.entries(profiles)) {
    if (!PROFILE_PATTERN.test(profileName)) failRegistry(`Invalid profile name: ${profileName}.`);
    const profile = requireRecord(profileValue, `profile ${profileName}`);
    requireExactKeys(
      profile,
      ["description", "localDirectory", "provenanceSources", "expectedFiles", "contentChecks"],
      `profile ${profileName}`,
    );
    requireString(profile.description, `profile ${profileName}.description`);
    if (!PROFILE_PATTERN.test(profile.localDirectory)) {
      failRegistry(`profile ${profileName}.localDirectory must be a safe slug.`);
    }
    if (!Array.isArray(profile.provenanceSources) || profile.provenanceSources.length === 0) {
      failRegistry(`profile ${profileName}.provenanceSources must be a non-empty array.`);
    }
    for (const [index, sourceValue] of profile.provenanceSources.entries()) {
      const label = `profile ${profileName}.provenanceSources[${index}]`;
      const source = requireRecord(sourceValue, label);
      if (source.type === "json") {
        requireExactKeys(source, ["type", "path", "map"], label);
        validateRelativePath(source.path, `${label}.path`);
        const map = requireRecord(source.map, `${label}.map`);
        if (Object.keys(map).length === 0) failRegistry(`${label}.map must not be empty.`);
        for (const [field, pointer] of Object.entries(map)) {
          requireString(field, `${label}.map field`);
          requireString(pointer, `${label}.map.${field}`);
          if (!pointer.startsWith("/")) failRegistry(`${label}.map.${field} must be a JSON Pointer.`);
        }
      } else if (source.type === "inline") {
        requireExactKeys(source, ["type", "values"], label);
        const values = requireRecord(source.values, `${label}.values`);
        if (Object.keys(values).length === 0) failRegistry(`${label}.values must not be empty.`);
      } else {
        failRegistry(`${label}.type is unsupported.`);
      }
    }

    if (!Array.isArray(profile.expectedFiles) || profile.expectedFiles.length === 0) {
      failRegistry(`profile ${profileName}.expectedFiles must be a non-empty array.`);
    }
    const foldedFiles = new Set();
    for (const [index, file] of profile.expectedFiles.entries()) {
      validateRelativePath(file, `profile ${profileName}.expectedFiles[${index}]`);
      const folded = file.toLowerCase();
      if (foldedFiles.has(folded)) failRegistry(`profile ${profileName} has duplicate expected files.`);
      foldedFiles.add(folded);
    }

    if (!Array.isArray(profile.contentChecks)) {
      failRegistry(`profile ${profileName}.contentChecks must be an array.`);
    }
    for (const [index, checkValue] of profile.contentChecks.entries()) {
      const label = `profile ${profileName}.contentChecks[${index}]`;
      const check = requireRecord(checkValue, label);
      if (check.type === "sha256") {
        requireExactKeys(check, ["type", "path", "expected"], label);
      } else if (check.type === "json_equals") {
        requireExactKeys(check, ["type", "path", "pointer", "expected"], label);
        requireString(check.pointer, `${label}.pointer`);
        if (!check.pointer.startsWith("/")) failRegistry(`${label}.pointer must be a JSON Pointer.`);
      } else {
        failRegistry(`${label}.type is unsupported.`);
      }
      validateRelativePath(check.path, `${label}.path`);
      if (!profile.expectedFiles.includes(check.path)) {
        failRegistry(`${label}.path must be listed in expectedFiles.`);
      }
      validateExpectedSpec(check.expected, `${label}.expected`);
    }
  }
  return registry;
}

export async function loadRegistry({
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  registryPath = DEFAULT_REGISTRY_PATH,
} = {}) {
  const absolutePath = safeRepositoryPath(repositoryRoot, registryPath, "registryPath");
  let parsed;
  try {
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw new WorkspaceArtifactError("registry_invalid", `Cannot read registry: ${registryPath}.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  return validateRegistry(parsed);
}

async function resolveProvenance(profileName, profile, repositoryRoot) {
  const provenance = Object.create(null);
  const fieldSources = new Map();
  const defineField = (field, value, sourceLabel) => {
    requireString(field, `${sourceLabel} field`);
    if (Object.hasOwn(provenance, field)) {
      if (!isDeepStrictEqual(provenance[field], value)) {
        failRegistry(`Conflicting provenance field ${field}.`, {
          firstSource: fieldSources.get(field),
          conflictingSource: sourceLabel,
        });
      }
      return;
    }
    provenance[field] = value;
    fieldSources.set(field, sourceLabel);
  };
  for (const [index, source] of profile.provenanceSources.entries()) {
    const sourceLabel = `profile ${profileName}.provenanceSources[${index}]`;
    if (source.type === "inline") {
      for (const [field, value] of Object.entries(source.values)) {
        defineField(field, value, sourceLabel);
      }
      continue;
    }
    const sourcePath = safeRepositoryPath(
      repositoryRoot,
      source.path,
      `${sourceLabel}.path`,
    );
    let document;
    try {
      document = JSON.parse(await readFile(sourcePath, "utf8"));
    } catch (error) {
      throw new WorkspaceArtifactError(
        "registry_invalid",
        `Cannot read provenance source: ${source.path}.`,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
    for (const [field, pointer] of Object.entries(source.map)) {
      defineField(
        field,
        decodeJsonPointer(document, pointer, `${source.path}${pointer}`),
        `${sourceLabel} (${source.path}${pointer})`,
      );
    }
  }

  const requiredStrings = [
    "repository",
    "workflow",
    "workflowRunId",
    "repositoryHead",
    "artifactName",
    "artifactId",
    "artifactSha256",
  ];
  for (const field of requiredStrings) requireString(provenance[field], `provenance.${field}`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(provenance.repository)) {
    failRegistry("provenance.repository must be an owner/repository pair.");
  }
  if (!DECIMAL_PATTERN.test(provenance.workflowRunId) || !DECIMAL_PATTERN.test(provenance.artifactId)) {
    failRegistry("provenance workflowRunId and artifactId must be decimal strings.");
  }
  if (!GIT_SHA_PATTERN.test(provenance.repositoryHead)) {
    failRegistry("provenance.repositoryHead must be a lowercase Git object id.");
  }
  provenance.artifactSha256 = normalizeSha256(
    provenance.artifactSha256,
    "provenance.artifactSha256",
  );
  for (const field of ["technicalCandidateSha256", "referenceSpaceSha256"]) {
    if (provenance[field] !== undefined) {
      provenance[field] = normalizeSha256(provenance[field], `provenance.${field}`);
    }
  }
  return Object.freeze(provenance);
}

export async function loadProfileContext(
  profileName,
  {
    repositoryRoot = DEFAULT_REPOSITORY_ROOT,
    registryPath = DEFAULT_REGISTRY_PATH,
  } = {},
) {
  if (typeof profileName !== "string" || !PROFILE_PATTERN.test(profileName)) {
    throw new WorkspaceArtifactError("registry_invalid", `Invalid artifact profile: ${profileName}.`);
  }
  const registry = await loadRegistry({ repositoryRoot, registryPath });
  const profile = registry.profiles[profileName];
  if (profile === undefined) {
    throw new WorkspaceArtifactError("registry_invalid", `Unknown artifact profile: ${profileName}.`, {
      availableProfiles: Object.keys(registry.profiles).sort(compareOrdinal),
    });
  }
  const provenance = await resolveProvenance(profileName, profile, repositoryRoot);
  const artifactRoot = safeRepositoryPath(repositoryRoot, LOCAL_ARTIFACT_ROOT, "local artifact root");
  const preparedDirectory = join(artifactRoot, profile.localDirectory);
  const zipPath = join(artifactRoot, `${profile.localDirectory}.zip`);
  return {
    profileName,
    profile,
    provenance,
    repositoryRoot,
    registryPath,
    artifactRoot,
    preparedDirectory,
    zipPath,
    receiptPath: join(preparedDirectory, RECEIPT_NAME),
  };
}

function runGit(repositoryRoot, args) {
  return spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function normalizeRemoteUrl(value) {
  return value
    .trim()
    .replace(/^git@github\.com:/u, "https://github.com/")
    .replace(/\.git$/u, "")
    .replace(/\/$/u, "");
}

export function inspectWorkspace(context, { allowDirty = false } = {}) {
  const headResult = runGit(context.repositoryRoot, ["rev-parse", "HEAD"]);
  const rootResult = runGit(context.repositoryRoot, ["rev-parse", "--show-toplevel"]);
  const statusResult = runGit(context.repositoryRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const remoteResult = runGit(context.repositoryRoot, ["remote", "get-url", "origin"]);
  const trackedSources = [
    context.registryPath,
    ...context.profile.provenanceSources
      .filter((source) => source.type === "json")
      .map((source) => source.path),
  ];
  const trackedResult = runGit(context.repositoryRoot, [
    "ls-files",
    "--error-unmatch",
    "--",
    ...[...new Set(trackedSources)],
  ]);
  if (
    headResult.status !== 0 ||
    rootResult.status !== 0 ||
    statusResult.status !== 0 ||
    remoteResult.status !== 0 ||
    trackedResult.status !== 0
  ) {
    return {
      status: "workspace_revision_mismatch",
      message: "Git workspace state could not be verified.",
    };
  }
  const head = headResult.stdout.trim();
  const dirty = statusResult.stdout.trim().length > 0;
  const expectedRemote = `https://github.com/${context.provenance.repository}`;
  const remote = normalizeRemoteUrl(remoteResult.stdout);
  const workspaceRoot = resolve(rootResult.stdout.trim());
  if (remote !== expectedRemote || relative(resolve(context.repositoryRoot), workspaceRoot) !== "") {
    return {
      status: "workspace_revision_mismatch",
      message: "Workspace repository root or origin does not match the pinned repository.",
      head,
      remote,
      expectedRemote,
    };
  }
  if (dirty && !allowDirty) {
    return {
      status: "workspace_dirty",
      message: "Workspace has tracked or unignored changes; use --allow-dirty only for deliberate local work.",
      head,
    };
  }
  return {
    status: "ready",
    head,
    dirty,
    remote,
    artifactProducerHead: context.provenance.repositoryHead,
  };
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function expectedValue(spec, provenance, label) {
  if (Object.hasOwn(spec, "literal")) return spec.literal;
  const field = spec.provenanceField;
  if (!Object.hasOwn(provenance, field)) {
    failRegistry(`${label} references missing provenance field ${field}.`);
  }
  return provenance[field];
}

async function listRegularFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(current, entry.name);
    const relativePath = relative(root, absolute).split(sep).join("/");
    if (entry.isSymbolicLink()) {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        `Extracted artifact contains a symbolic link: ${relativePath}.`,
      );
    }
    if (entry.isDirectory()) files.push(...(await listRegularFiles(root, absolute)));
    else if (entry.isFile()) files.push(relativePath);
    else {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        `Extracted artifact contains an unsupported entry: ${relativePath}.`,
      );
    }
  }
  return files.sort(compareOrdinal);
}

async function validateExtractedContent(context, directory, { allowReceipt = false } = {}) {
  const actualFiles = await listRegularFiles(directory);
  const expectedFiles = [...context.profile.expectedFiles].sort(compareOrdinal);
  const allowedFiles = allowReceipt
    ? [...expectedFiles, RECEIPT_NAME].sort(compareOrdinal)
    : expectedFiles;
  if (JSON.stringify(actualFiles) !== JSON.stringify(allowedFiles)) {
    throw new WorkspaceArtifactError(
      "artifact_extract_incomplete",
      "Extracted artifact file set does not match the profile.",
      { expectedFiles: allowedFiles, actualFiles },
    );
  }

  for (const [index, check] of context.profile.contentChecks.entries()) {
    const filePath = safeExtractedPath(directory, check.path);
    const expected = expectedValue(check.expected, context.provenance, `contentChecks[${index}]`);
    if (check.type === "sha256") {
      const actual = await sha256File(filePath);
      if (actual !== expected) {
        throw new WorkspaceArtifactError(
          "artifact_provenance_mismatch",
          `SHA-256 mismatch for ${check.path}.`,
          { expected, actual },
        );
      }
      continue;
    }
    let document;
    try {
      document = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      throw new WorkspaceArtifactError(
        "artifact_provenance_mismatch",
        `Cannot parse ${check.path} for provenance validation.`,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
    const actual = decodeJsonPointer(
      document,
      check.pointer,
      `${check.path}${check.pointer}`,
      "artifact_provenance_mismatch",
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new WorkspaceArtifactError(
        "artifact_provenance_mismatch",
        `Provenance mismatch at ${check.path}${check.pointer}.`,
        { expected, actual },
      );
    }
  }

  const receipts = [];
  for (const file of expectedFiles) {
    const filePath = safeExtractedPath(directory, file);
    const fileStat = await stat(filePath);
    receipts.push({ path: file, size: fileStat.size, sha256: await sha256File(filePath) });
  }
  return receipts;
}

function safeExtractedPath(root, relativePath) {
  validateRelativePath(relativePath, "artifact file path");
  const absolute = resolve(root, ...relativePath.split("/"));
  const difference = relative(root, absolute);
  if (difference.startsWith(`..${sep}`) || difference === ".." || isAbsolute(difference)) {
    throw new WorkspaceArtifactError(
      "artifact_extract_incomplete",
      `Artifact path escapes extraction root: ${relativePath}.`,
    );
  }
  return absolute;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function inspectPreparedArtifact(context) {
  const directoryExists = await pathExists(context.preparedDirectory);
  const zipExists = await pathExists(context.zipPath);
  if (!directoryExists) {
    if (!zipExists) {
      return {
        status: "artifact_missing",
        message: "The exact artifact is not prepared and no manual ZIP is present.",
        manualZipPath: context.zipPath,
      };
    }
    const actualDigest = await sha256File(context.zipPath);
    if (actualDigest !== context.provenance.artifactSha256) {
      return {
        status: "artifact_digest_mismatch",
        message: "The local artifact ZIP does not match the pinned SHA-256 digest.",
        expected: context.provenance.artifactSha256,
        actual: actualDigest,
      };
    }
    return {
      status: "artifact_extract_incomplete",
      message: "A verified local ZIP is present but has not been prepared.",
      manualZipPath: context.zipPath,
    };
  }

  if (!(await pathExists(context.receiptPath))) {
    return {
      status: "artifact_extract_incomplete",
      message: "Prepared directory exists without a verification receipt.",
    };
  }
  let receipt;
  try {
    receipt = JSON.parse(await readFile(context.receiptPath, "utf8"));
  } catch (error) {
    return {
      status: "artifact_provenance_mismatch",
      message: "Artifact verification receipt is unreadable.",
      cause: error instanceof Error ? error.message : String(error),
    };
  }
  if (
    !isRecord(receipt) ||
    receipt.schemaVersion !== 1 ||
    receipt.profile !== context.profileName ||
    !sameJson(receipt.provenance, context.provenance) ||
    !Array.isArray(receipt.files)
  ) {
    return {
      status: "artifact_provenance_mismatch",
      message: "Artifact verification receipt does not match the pinned profile.",
    };
  }
  try {
    const files = await validateExtractedContent(context, context.preparedDirectory, {
      allowReceipt: true,
    });
    if (!sameJson(files, receipt.files)) {
      return {
        status: "artifact_provenance_mismatch",
        message: "Prepared artifact files no longer match their verification receipt.",
      };
    }
  } catch (error) {
    if (error instanceof WorkspaceArtifactError) {
      return { status: error.status, message: error.message, ...error.details };
    }
    throw error;
  }
  return {
    status: "ready",
    message: "Exact artifact is present, verified, and complete.",
    preparedDirectory: context.preparedDirectory,
  };
}

export async function checkProfile(
  profileName,
  {
    repositoryRoot = DEFAULT_REPOSITORY_ROOT,
    registryPath = DEFAULT_REGISTRY_PATH,
    allowDirty = false,
  } = {},
) {
  const context = await loadProfileContext(profileName, { repositoryRoot, registryPath });
  const workspace = inspectWorkspace(context, { allowDirty });
  const artifact = await inspectPreparedArtifact(context);
  const status = workspace.status !== "ready" ? workspace.status : artifact.status;
  return {
    status,
    profile: profileName,
    description: context.profile.description,
    workspace,
    artifact,
    pinnedArtifact: publicProvenance(context.provenance),
    remediation: remediationFor(status, context),
  };
}

function remediationFor(status, context) {
  if (status === "artifact_missing") {
    return `Run prepare ${context.profileName}, or place the exact ZIP at ${context.zipPath} and run prepare again.`;
  }
  if (status === "artifact_auth_required") {
    return `Authenticate GitHub CLI or set GH_TOKEN securely, or place the exact ZIP at ${context.zipPath}.`;
  }
  if (status === "artifact_extract_incomplete") {
    return `Run prepare ${context.profileName}; remove an incomplete prepared directory only after reviewing its exact path.`;
  }
  if (status === "artifact_digest_mismatch") {
    return "Remove the incorrect local ZIP after verifying its exact path; never substitute another artifact.";
  }
  if (status === "artifact_unavailable") {
    return `Obtain the exact pinned artifact manually if still available; do not use latest or another run.`;
  }
  return null;
}

function publicProvenance(provenance) {
  return {
    repository: provenance.repository,
    workflow: provenance.workflow,
    workflowRunId: provenance.workflowRunId,
    repositoryHead: provenance.repositoryHead,
    artifactName: provenance.artifactName,
    artifactId: provenance.artifactId,
    artifactSha256: provenance.artifactSha256,
    steamBuildId: provenance.steamBuildId,
    technicalCandidateSha256: provenance.technicalCandidateSha256,
    referenceSpaceSha256: provenance.referenceSpaceSha256,
  };
}

async function defaultTokenProvider({ env = process.env, spawn = spawnSync } = {}) {
  if (typeof env.GH_TOKEN === "string" && env.GH_TOKEN.length > 0) return env.GH_TOKEN;
  if (typeof env.GITHUB_TOKEN === "string" && env.GITHUB_TOKEN.length > 0) return env.GITHUB_TOKEN;
  const result = spawn("gh", ["auth", "token"], {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status === 0 && typeof result.stdout === "string" && result.stdout.trim().length > 0) {
    return result.stdout.trim();
  }
  return null;
}

function githubStatusError(response, operation) {
  if (response.status === 401 || response.status === 403) {
    return new WorkspaceArtifactError(
      "artifact_auth_required",
      `GitHub authentication is required to ${operation}.`,
    );
  }
  if (response.status === 404 || response.status === 410) {
    return new WorkspaceArtifactError(
      "artifact_unavailable",
      `The exact pinned GitHub artifact is unavailable or expired during ${operation}.`,
    );
  }
  return new WorkspaceArtifactError(
    "artifact_unavailable",
    `GitHub returned HTTP ${response.status} during ${operation}.`,
  );
}

async function fetchJson(url, { token, fetchImpl, operation }) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "pal-tool-workspace-artifacts",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (error) {
    throw new WorkspaceArtifactError("artifact_unavailable", `GitHub request failed during ${operation}.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!response.ok) throw githubStatusError(response, operation);
  try {
    return await response.json();
  } catch {
    throw new WorkspaceArtifactError(
      "artifact_unavailable",
      `GitHub returned invalid metadata during ${operation}.`,
    );
  }
}

export async function downloadGitHubArtifact(
  context,
  destinationPath,
  {
    fetchImpl = globalThis.fetch,
    tokenProvider = defaultTokenProvider,
  } = {},
) {
  const token = await tokenProvider();
  if (!token) {
    throw new WorkspaceArtifactError(
      "artifact_auth_required",
      "No secure GitHub authentication is available for the exact artifact download.",
    );
  }
  if (typeof fetchImpl !== "function") {
    throw new WorkspaceArtifactError("artifact_unavailable", "This Node.js runtime has no fetch implementation.");
  }
  const base = `https://api.github.com/repos/${context.provenance.repository}`;
  const run = await fetchJson(`${base}/actions/runs/${context.provenance.workflowRunId}`, {
    token,
    fetchImpl,
    operation: "verify workflow run provenance",
  });
  if (
    String(run.id) !== context.provenance.workflowRunId ||
    run.name !== context.provenance.workflow ||
    run.head_sha !== context.provenance.repositoryHead ||
    run.repository?.full_name !== context.provenance.repository ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  ) {
    throw new WorkspaceArtifactError(
      "artifact_provenance_mismatch",
      "GitHub workflow run metadata does not match the pinned provenance.",
    );
  }

  const artifact = await fetchJson(`${base}/actions/artifacts/${context.provenance.artifactId}`, {
    token,
    fetchImpl,
    operation: "verify artifact provenance",
  });
  if (
    String(artifact.id) !== context.provenance.artifactId ||
    artifact.name !== context.provenance.artifactName ||
    (artifact.workflow_run?.id !== undefined &&
      String(artifact.workflow_run.id) !== context.provenance.workflowRunId) ||
    (artifact.workflow_run?.head_sha !== undefined &&
      artifact.workflow_run.head_sha !== context.provenance.repositoryHead)
  ) {
    throw new WorkspaceArtifactError(
      "artifact_provenance_mismatch",
      "GitHub artifact metadata does not match the pinned provenance.",
    );
  }
  if (artifact.expired === true || (artifact.expires_at && Date.parse(artifact.expires_at) <= Date.now())) {
    throw new WorkspaceArtifactError(
      "artifact_unavailable",
      "The exact pinned GitHub artifact has expired.",
      { expiresAt: artifact.expires_at ?? null },
    );
  }
  if (artifact.digest !== undefined) {
    const apiDigest = normalizeSha256(
      artifact.digest,
      "GitHub artifact digest",
      "artifact_provenance_mismatch",
    );
    if (apiDigest !== context.provenance.artifactSha256) {
      throw new WorkspaceArtifactError(
        "artifact_provenance_mismatch",
        "GitHub artifact metadata digest does not match the pinned provenance.",
      );
    }
  }

  let response;
  try {
    response = await fetchImpl(`${base}/actions/artifacts/${context.provenance.artifactId}/zip`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "pal-tool-workspace-artifacts",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "follow",
    });
  } catch (error) {
    throw new WorkspaceArtifactError("artifact_unavailable", "GitHub artifact download failed.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!response.ok) throw githubStatusError(response, "download exact artifact archive");
  if (!response.body) {
    throw new WorkspaceArtifactError("artifact_unavailable", "GitHub artifact download returned no body.");
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath, { flags: "wx" }));
}

function requireWorkspaceReady(workspace) {
  if (workspace.status !== "ready") {
    throw new WorkspaceArtifactError(workspace.status, workspace.message, workspace);
  }
}

async function ensureVerifiedZip(context) {
  if (!(await pathExists(context.zipPath))) return false;
  const actual = await sha256File(context.zipPath);
  if (actual !== context.provenance.artifactSha256) {
    throw new WorkspaceArtifactError(
      "artifact_digest_mismatch",
      "The local artifact ZIP does not match the pinned SHA-256 digest.",
      { expected: context.provenance.artifactSha256, actual },
    );
  }
  return true;
}

export async function fetchProfile(
  profileName,
  {
    repositoryRoot = DEFAULT_REPOSITORY_ROOT,
    registryPath = DEFAULT_REGISTRY_PATH,
    allowDirty = false,
    downloader = downloadGitHubArtifact,
  } = {},
) {
  const context = await loadProfileContext(profileName, { repositoryRoot, registryPath });
  requireWorkspaceReady(inspectWorkspace(context, { allowDirty }));
  const prepared = await inspectPreparedArtifact(context);
  if (prepared.status === "ready") {
    return { status: "ready", profile: profileName, reused: true, ...prepared };
  }
  await mkdir(context.artifactRoot, { recursive: true });
  if (await ensureVerifiedZip(context)) {
    return {
      status: "artifact_fetched",
      profile: profileName,
      reused: true,
      zipPath: context.zipPath,
      artifactSha256: context.provenance.artifactSha256,
    };
  }

  const temporary = `${context.zipPath}.tmp-${randomUUID()}`;
  try {
    await downloader(context, temporary);
    const actual = await sha256File(temporary);
    if (actual !== context.provenance.artifactSha256) {
      throw new WorkspaceArtifactError(
        "artifact_digest_mismatch",
        "Downloaded artifact ZIP does not match the pinned SHA-256 digest.",
        { expected: context.provenance.artifactSha256, actual },
      );
    }
    await rename(temporary, context.zipPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return {
    status: "artifact_fetched",
    profile: profileName,
    reused: false,
    zipPath: context.zipPath,
    artifactSha256: context.provenance.artifactSha256,
  };
}

export async function prepareProfile(
  profileName,
  options = {},
) {
  const {
    repositoryRoot = DEFAULT_REPOSITORY_ROOT,
    registryPath = DEFAULT_REGISTRY_PATH,
    allowDirty = false,
    downloader = downloadGitHubArtifact,
  } = options;
  const context = await loadProfileContext(profileName, { repositoryRoot, registryPath });
  requireWorkspaceReady(inspectWorkspace(context, { allowDirty }));
  const current = await inspectPreparedArtifact(context);
  if (current.status === "ready") {
    return { status: "ready", profile: profileName, reused: true, ...current };
  }
  if (await pathExists(context.preparedDirectory)) {
    throw new WorkspaceArtifactError(
      current.status,
      `${current.message} Refusing to overwrite the existing prepared directory.`,
      current,
    );
  }
  if (!(await ensureVerifiedZip(context))) {
    await fetchProfile(profileName, {
      repositoryRoot,
      registryPath,
      allowDirty,
      downloader,
    });
  }

  const temporaryDirectory = join(
    context.artifactRoot,
    `.${context.profile.localDirectory}.tmp-${randomUUID()}`,
  );
  try {
    await mkdir(temporaryDirectory, { recursive: false });
    await extractZipSecurely(context.zipPath, temporaryDirectory);
    const files = await validateExtractedContent(context, temporaryDirectory);
    const receipt = {
      schemaVersion: 1,
      profile: profileName,
      provenance: context.provenance,
      files,
    };
    await writeFile(
      join(temporaryDirectory, RECEIPT_NAME),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { flag: "wx" },
    );
    await rename(temporaryDirectory, context.preparedDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
  return {
    status: "artifact_prepared",
    profile: profileName,
    reused: false,
    preparedDirectory: context.preparedDirectory,
    artifactSha256: context.provenance.artifactSha256,
  };
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function decodeZipName(buffer) {
  const value = buffer.toString("utf8");
  if (value.includes("�")) {
    throw new WorkspaceArtifactError(
      "artifact_extract_incomplete",
      "ZIP contains a non-UTF-8 entry name.",
    );
  }
  return value;
}

function validateZipEntryName(name) {
  const directory = name.endsWith("/");
  const path = directory ? name.slice(0, -1) : name;
  try {
    validateRelativePath(path, `ZIP entry ${name}`);
  } catch (error) {
    if (error instanceof WorkspaceArtifactError) {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        `ZIP contains an unsafe entry path: ${name}.`,
      );
    }
    throw error;
  }
  return { path, directory };
}

export async function extractZipSecurely(zipPath, destinationDirectory) {
  const buffer = await readFile(zipPath);
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP end-of-directory record is missing.");
  }
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    throw new WorkspaceArtifactError(
      "artifact_extract_incomplete",
      "Multi-disk and ZIP64 archives are not supported by the safe extractor.",
    );
  }
  if (entryCount > MAX_ZIP_ENTRIES || centralOffset + centralSize > eocd) {
    throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP central directory is invalid.");
  }

  const entries = [];
  const foldedNames = new Set();
  let offset = centralOffset;
  let totalSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP central directory entry is invalid.");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > buffer.length) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP entry metadata is truncated.");
    }
    if ((flags & 0x1) !== 0 || ![0, 8].includes(method)) {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        "Encrypted or unsupported ZIP entries are not accepted.",
      );
    }
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0xf000) === 0xa000) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP symbolic links are not accepted.");
    }
    const name = decodeZipName(buffer.subarray(offset + 46, offset + 46 + nameLength));
    const validated = validateZipEntryName(name);
    const folded = validated.path.toLowerCase();
    if (foldedNames.has(folded)) {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        `ZIP contains a duplicate or case-colliding path: ${name}.`,
      );
    }
    foldedNames.add(folded);
    if (uncompressedSize > MAX_ZIP_ENTRY_BYTES) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", `ZIP entry is too large: ${name}.`);
    }
    totalSize += uncompressedSize;
    if (totalSize > MAX_ZIP_TOTAL_BYTES) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP expands beyond the safety limit.");
    }
    entries.push({
      name,
      path: validated.path,
      directory: validated.directory,
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = end;
  }
  if (offset !== centralOffset + centralSize) {
    throw new WorkspaceArtifactError("artifact_extract_incomplete", "ZIP central directory size mismatch.");
  }

  for (const entry of entries) {
    const outputPath = safeExtractedPath(destinationDirectory, entry.path);
    if (entry.directory) {
      await mkdir(outputPath, { recursive: true });
      continue;
    }
    if (
      entry.localOffset + 30 > buffer.length ||
      buffer.readUInt32LE(entry.localOffset) !== 0x04034b50
    ) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", `ZIP local header is invalid: ${entry.name}.`);
    }
    const localNameLength = buffer.readUInt16LE(entry.localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(entry.localOffset + 28);
    const localNameStart = entry.localOffset + 30;
    const localName = decodeZipName(buffer.subarray(localNameStart, localNameStart + localNameLength));
    if (localName !== entry.name) {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        `ZIP local/central name mismatch: ${entry.name}.`,
      );
    }
    const dataStart = localNameStart + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > buffer.length) {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", `ZIP data is truncated: ${entry.name}.`);
    }
    const compressed = buffer.subarray(dataStart, dataEnd);
    let content;
    try {
      content = entry.method === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, {
            maxOutputLength: Math.max(1, Math.min(entry.uncompressedSize, MAX_ZIP_ENTRY_BYTES)),
          });
    } catch {
      throw new WorkspaceArtifactError("artifact_extract_incomplete", `ZIP inflation failed: ${entry.name}.`);
    }
    if (content.length !== entry.uncompressedSize || crc32(content) !== entry.crc) {
      throw new WorkspaceArtifactError(
        "artifact_extract_incomplete",
        `ZIP size or CRC validation failed: ${entry.name}.`,
      );
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, { flag: "wx" });
  }
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseCli(argv) {
  const [command, profileName, ...rest] = argv;
  const options = { allowDirty: false, registryPath: DEFAULT_REGISTRY_PATH };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--allow-dirty") options.allowDirty = true;
    else if (argument === "--registry") {
      const value = rest[index + 1];
      if (!value) throw new WorkspaceArtifactError("registry_invalid", "--registry requires a path.");
      options.registryPath = value;
      index += 1;
    } else {
      throw new WorkspaceArtifactError("registry_invalid", `Unknown argument: ${argument}.`);
    }
  }
  return { command, profileName, options };
}

async function runCli() {
  let parsed;
  try {
    parsed = parseCli(process.argv.slice(2));
    if (parsed.command === "list") {
      const registry = await loadRegistry({ registryPath: parsed.options.registryPath });
      console.log(JSON.stringify({
        status: "ready",
        profiles: Object.entries(registry.profiles)
          .sort(([left], [right]) => compareOrdinal(left, right))
          .map(([name, profile]) => ({ name, description: profile.description })),
      }, null, 2));
      return;
    }
    if (!parsed.profileName || !["check", "fetch", "prepare"].includes(parsed.command)) {
      throw new WorkspaceArtifactError(
        "registry_invalid",
        "Usage: node scripts/workspace-artifacts.mjs list | check|fetch|prepare PROFILE [--allow-dirty] [--registry PATH]",
      );
    }
    let result;
    if (parsed.command === "check") result = await checkProfile(parsed.profileName, parsed.options);
    else if (parsed.command === "fetch") result = await fetchProfile(parsed.profileName, parsed.options);
    else result = await prepareProfile(parsed.profileName, parsed.options);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = EXIT_CODES[result.status] ?? 1;
  } catch (error) {
    const known = error instanceof WorkspaceArtifactError;
    const result = {
      status: known ? error.status : "artifact_unavailable",
      message: error instanceof Error ? error.message : String(error),
      ...(known ? error.details : {}),
    };
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = EXIT_CODES[result.status] ?? 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runCli();
}
