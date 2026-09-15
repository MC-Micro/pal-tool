import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const excluded = new Set([
  ".git",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);
const textExtensions = new Set([
  ".json",
  ".jsonc",
  ".md",
  ".sql",
  ".ts",
  ".yml",
  ".yaml",
]);
const secretFiles = [/^\.dev\.vars(?:\..+)?$/u, /^\.env(?:\..+)?$/u];
const forbiddenValues = [
  /CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/u,
  /CLOUDFLARE_ACCOUNT_ID\s*[:=]\s*["']?[a-fA-F0-9]{20,}/u,
  /BREEDING_READ_TOKEN\s*[:=]\s*["']?[a-fA-F0-9]{32,}/u,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/u,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/u,
];

const findings: string[] = [];
walk(root);
if (findings.length > 0) {
  throw new Error("Potential secret material detected in: " + findings.join(", "));
}
console.log("Breeder AI secret scan PASS");

function walk(directory: string): void {
  for (const entry of readdirSync(directory)) {
    if (excluded.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    const name = basename(path);
    if (
      !textExtensions.has(extname(name)) &&
      !secretFiles.some((pattern) => pattern.test(name))
    ) {
      continue;
    }
    if (
      secretFiles.some((pattern) => pattern.test(name)) ||
      forbiddenValues.some((pattern) => pattern.test(readFileSync(path, "utf8")))
    ) {
      findings.push(path);
    }
  }
}
