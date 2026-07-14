import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const excluded = new Set(["node_modules", ".wrangler", "coverage", ".git"]);
const textExtensions = new Set([".ts", ".js", ".json", ".jsonc", ".md", ".yml", ".yaml", ".txt"]);
const secretBearingDotfilePatterns = [/^\.env(?:\..+)?$/, /^\.dev\.vars(?:\..+)?$/];
const forbidden = [
  /CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/,
  /CLOUDFLARE_ACCOUNT_ID\s*[:=]\s*["']?[a-fA-F0-9]{20,}/,
  /BREEDING_READ_TOKEN\s*[:=]\s*["']?[a-fA-F0-9]{32,}/,
];

export function isScannableTextFile(path: string): boolean {
  const name = basename(path);
  return textExtensions.has(extname(name)) || secretBearingDotfilePatterns.some((pattern) => pattern.test(name));
}

export function findPotentialSecretFiles(rootDirectory: string): string[] {
  const findings: string[] = [];

  function walk(directory: string): void {
    for (const entry of readdirSync(directory)) {
      if (excluded.has(entry)) continue;
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!isScannableTextFile(path)) continue;
      const content = readFileSync(path, "utf8");
      if (forbidden.some((pattern) => pattern.test(content))) findings.push(path);
    }
  }

  walk(rootDirectory);
  return findings;
}

export function runSecretScan(rootDirectory = defaultRoot): void {
  const findings = findPotentialSecretFiles(rootDirectory);
  if (findings.length > 0) {
    throw new Error(`Potential committed secret values detected in: ${findings.join(", ")}`);
  }
  console.log("Secret scan PASS");
}

const entrypoint = process.argv[1];
if (entrypoint && resolve(entrypoint) === resolve(fileURLToPath(import.meta.url))) {
  runSecretScan();
}
