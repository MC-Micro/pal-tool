import { readFile } from "node:fs/promises";

import { createBreedingEngine, triangularPairCount } from "../src/breeding.ts";
import type { GeneratedReference, PalValue } from "../src/types.ts";
import { buildReference, generatedReferencePath } from "./build-reference.ts";

interface ValidationCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

function byteLength(base64: string): number {
  return Buffer.from(base64, "base64").byteLength;
}

function findPalId(pals: readonly PalValue[], internalName: string): number {
  const id = pals.findIndex((pal) => pal.internal_name === internalName);
  if (id < 0) throw new Error(`Fixture pal is absent: ${internalName}`);
  return id;
}

function checkPair(
  reference: GeneratedReference,
  parentAInternal: string,
  parentBInternal: string,
  expectedChildInternal: string,
  expectedRule: string,
): ValidationCheck {
  const engine = createBreedingEngine(reference.pals, reference.canonical.specialCombinations);
  const parentAId = findPalId(reference.pals, parentAInternal);
  const parentBId = findPalId(reference.pals, parentBInternal);
  const expectedId = findPalId(reference.pals, expectedChildInternal);
  const result = engine.resolveBasePair(parentAId, parentBId);
  return {
    name: `${parentAInternal}+${parentBInternal}`,
    ok: result.childId === expectedId && result.rule === expectedRule,
    detail: `actual=${reference.pals[result.childId]?.internal_name ?? "UNKNOWN"}; rule=${result.rule}`,
  };
}

function validatePackedLengths(reference: GeneratedReference): ValidationCheck[] {
  const palCount = reference.pals.length;
  const pairCount = triangularPairCount(palCount);
  const adjacency = reference.carrierAdjacency;
  return [
    {
      name: "pair matrix count",
      ok: reference.pairMatrix.count === pairCount,
      detail: `${reference.pairMatrix.count}/${pairCount}`,
    },
    {
      name: "pair child byte length",
      ok: byteLength(reference.pairMatrix.childIdsBase64) === pairCount * 2,
    },
    {
      name: "pair rule byte length",
      ok: byteLength(reference.pairMatrix.ruleCodesBase64) === pairCount,
    },
    {
      name: "parents offsets byte length",
      ok: byteLength(reference.parentsByChild.offsetsBase64) === (palCount + 1) * 4,
    },
    {
      name: "parents ordinals byte length",
      ok:
        byteLength(reference.parentsByChild.pairOrdinalsBase64) ===
        reference.parentsByChild.entryCount * 4,
    },
    {
      name: "adjacency offsets byte length",
      ok: byteLength(adjacency.offsetsBase64) === (palCount + 1) * 4,
    },
    {
      name: "adjacency child byte length",
      ok: byteLength(adjacency.childIdsBase64) === adjacency.edgeCount * 2,
    },
    {
      name: "adjacency mate byte length",
      ok: byteLength(adjacency.mateIdsBase64) === adjacency.edgeCount * 2,
    },
    {
      name: "adjacency rule byte length",
      ok: byteLength(adjacency.ruleCodesBase64) === adjacency.edgeCount,
    },
    {
      name: "adjacency carrier gender byte length",
      ok: byteLength(adjacency.carrierGendersBase64) === adjacency.edgeCount,
    },
    {
      name: "adjacency mate gender byte length",
      ok: byteLength(adjacency.mateGendersBase64) === adjacency.edgeCount,
    },
  ];
}

async function main(): Promise<void> {
  const releaseMode = process.argv.includes("--release");
  const rebuilt = await buildReference();
  const rawGenerated = await readFile(generatedReferencePath, "utf8");
  const generated = JSON.parse(rawGenerated) as GeneratedReference;
  const deterministic = JSON.stringify(generated) === JSON.stringify(rebuilt);

  const checks: ValidationCheck[] = [
    {
      name: "generated reference matches deterministic rebuild",
      ok: deterministic,
    },
    {
      name: "canonical pal count",
      ok: generated.pals.length === 299 && generated.status.palCount === 299,
    },
    {
      name: "canonical special count",
      ok:
        generated.canonical.specialCombinations.length === 136 &&
        generated.status.specialCombinationCount === 136,
    },
    {
      name: "gender-specific override count",
      ok: generated.genderOverrides.length === 2 && generated.status.genderOverrideCount === 2,
    },
    checkPair(generated, "FairyDragon", "Serpent", "FairyDragon_Water", "special_combination"),
    checkPair(generated, "Anubis", "Deer_Ground", "KingAlpaca_Ice", "normal_formula"),
    checkPair(generated, "KingAlpaca_Ice", "Hedgehog", "FairyDragon", "normal_formula"),
    checkPair(generated, "Anubis", "Anubis", "Anubis", "same_species"),
    checkPair(generated, "WhiteMoth", "SheepBall", "SharkKid_Fire", "normal_formula"),
    ...validatePackedLengths(generated),
  ];

  const structuralOk = checks.every(({ ok }) => ok) && generated.validation.canonicalDataValid;
  const releaseOk = structuralOk && generated.validation.conflicts.length === 0;
  const ok = releaseMode ? releaseOk : structuralOk;
  const report = {
    ok,
    mode: releaseMode ? "release" : "structural",
    structuralOk,
    releaseOk,
    validationStatus: generated.status.validationStatus,
    dataHash: generated.dataHash,
    checks,
    unresolvedConflicts: generated.validation.conflicts,
    releaseBlocked: generated.validation.conflicts.some(({ blocking }) => blocking),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!ok) process.exitCode = 1;
}

await main();
