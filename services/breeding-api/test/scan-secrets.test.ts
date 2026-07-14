import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findPotentialSecretFiles, isScannableTextFile } from "../scripts/scan-secrets.ts";

const tempDirectories: string[] = [];

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "pal-tool-secret-scan-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("secret scan file coverage", () => {
  it("treats environment and Wrangler secret dotfiles as scannable text", () => {
    expect(isScannableTextFile(".env")).toBe(true);
    expect(isScannableTextFile(".env.local")).toBe(true);
    expect(isScannableTextFile(".dev.vars")).toBe(true);
    expect(isScannableTextFile(".dev.vars.production")).toBe(true);
    expect(isScannableTextFile("image.png")).toBe(false);
  });

  it("detects synthetic secret-shaped values in dotfiles", () => {
    const directory = createTempDirectory();
    writeFileSync(join(directory, ".env.local"), `BREEDING_READ_TOKEN=${"a".repeat(32)}\n`, "utf8");
    writeFileSync(join(directory, ".dev.vars"), `CLOUDFLARE_ACCOUNT_ID=${"b".repeat(32)}\n`, "utf8");

    const findings = findPotentialSecretFiles(directory).map((path) => basename(path)).sort();

    expect(findings).toEqual([".dev.vars", ".env.local"]);
  });

  it("continues to skip excluded dependency directories", () => {
    const directory = createTempDirectory();
    const dependencyDirectory = join(directory, "node_modules", "fixture");
    mkdirSync(dependencyDirectory, { recursive: true });
    writeFileSync(
      join(dependencyDirectory, ".env"),
      `CLOUDFLARE_API_TOKEN=${"c".repeat(24)}\n`,
      "utf8",
    );

    expect(findPotentialSecretFiles(directory)).toEqual([]);
  });
});
