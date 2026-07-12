import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const serviceRoot = fileURLToPath(new URL("..", import.meta.url));
const referencePath = fileURLToPath(new URL("../generated/reference.json", import.meta.url));

function hashReference(): string {
  return createHash("sha256").update(readFileSync(referencePath)).digest("hex");
}

const first = spawnSync(process.execPath, ["--import", "tsx", "scripts/build-reference.ts"], {
  cwd: serviceRoot,
  encoding: "utf8",
});
if (first.status !== 0) {
  process.stderr.write(first.stderr);
  process.exit(first.status ?? 1);
}
const firstHash = hashReference();

const second = spawnSync(process.execPath, ["--import", "tsx", "scripts/build-reference.ts"], {
  cwd: serviceRoot,
  encoding: "utf8",
});
if (second.status !== 0) {
  process.stderr.write(second.stderr);
  process.exit(second.status ?? 1);
}
const secondHash = hashReference();

if (firstHash !== secondHash) {
  throw new Error(`Non-deterministic build: ${firstHash} != ${secondHash}`);
}

console.log(`Deterministic build PASS (${firstHash})`);
