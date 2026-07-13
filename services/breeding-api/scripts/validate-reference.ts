import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createBreedingEngine, triangularPairCount } from "../src/breeding.ts";
import type { GeneratedReference, PalValue } from "../src/types.ts";
import {
  buildReference,
  computeGeneratedArtifactHash,
  computeSpecialChildImpactContentHash,
  generatedReferencePath,
  repositoryRoot,
  specialChildImpactPath,
  type SpecialChildImpactReport,
} from "./build-reference.ts";

interface ValidationCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

interface AnubisRouteAnalysis {
  schema_version: number;
  canonical_rules_schema_version: number;
  canonical_manifest_schema_version: number;
  canonical_counts: {
    normal_formula_candidate_pool_after_special_child_exclusion: number;
    effective_pair_results_changed_by_special_child_exclusion: number;
  };
  direct_two_stage_search: {
    blank_first_mate_species_checked: number;
    direct_two_step_to_elphidran_count: number;
    direct_two_step_to_surfent_count: number;
    direct_two_step_to_elphidran_aqua_count: number;
  };
  known_pair_checks: Array<{
    parents: string[];
    child: string;
  }>;
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
  const rawImpact = await readFile(specialChildImpactPath, "utf8");
  const rawAnubisAnalysis = await readFile(
    resolve(repositoryRoot, "data/palworld-breeding/analysis/anubis_jolthog_route.json"),
    "utf8",
  );
  const generated = JSON.parse(rawGenerated) as GeneratedReference;
  const impact = JSON.parse(rawImpact) as SpecialChildImpactReport;
  const anubisAnalysis = JSON.parse(rawAnubisAnalysis) as AnubisRouteAnalysis;
  const impactContent = structuredClone(impact);
  Reflect.deleteProperty(impactContent, "contentHash");
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
      name: "normal formula eligible child count",
      ok: generated.status.eligiblePalCount === 184,
      detail: String(generated.status.eligiblePalCount),
    },
    {
      name: "special child species count",
      ok: generated.status.specialChildSpeciesCount === 90,
      detail: String(generated.status.specialChildSpeciesCount),
    },
    {
      name: "gender-specific override count",
      ok: generated.genderOverrides.length === 2 && generated.status.genderOverrideCount === 2,
    },
    checkPair(generated, "FairyDragon", "Serpent", "FairyDragon_Water", "special_combination"),
    checkPair(generated, "Anubis", "Deer_Ground", "OniGhostGirl", "normal_formula"),
    checkPair(generated, "KingAlpaca_Ice", "Hedgehog", "FairyDragon", "normal_formula"),
    checkPair(generated, "Anubis", "Anubis", "Anubis", "same_species"),
    checkPair(generated, "WhiteMoth", "SheepBall", "Serpent", "normal_formula"),
    checkPair(generated, "Mutant", "NaughtyCat", "CaptainPenguin", "normal_formula"),
    {
      name: "generated artifact hash is reproducible without self-reference",
      ok: computeGeneratedArtifactHash(generated) === generated.generatedArtifactHash,
    },
    {
      name: "source and generated hashes are separately named",
      ok:
        generated.sourceDataHash.length === 64 &&
        generated.generatedArtifactHash.length === 64 &&
        generated.sourceDataHash !== generated.generatedArtifactHash,
    },
    {
      name: "special-child impact report",
      ok:
        impact.pairCount === 44_850 &&
        impact.changedPairCount === 13_785 &&
        impact.contentHash === generated.specialChildImpact.sha256 &&
        impact.contentHash ===
          computeSpecialChildImpactContentHash(impactContent),
      detail: `${impact.changedPairCount}/${impact.pairCount}`,
    },
    {
      name: "patch check is version-scoped and current",
      ok:
        generated.status.patchCheck.status === "current" &&
        generated.status.patchCheck.checked_game_version === "1.0" &&
        generated.status.patchCheck.checked_on === "2026-07-13" &&
        generated.status.patchCheck.build_verified === false &&
        generated.status.patchCheck.requires_recheck_after_newer_patch,
    },
    {
      name: "Anubis/Jolthog analysis matches schema-4 policy",
      ok:
        anubisAnalysis.schema_version === 2 &&
        anubisAnalysis.canonical_rules_schema_version === 4 &&
        anubisAnalysis.canonical_manifest_schema_version === 4 &&
        anubisAnalysis.canonical_counts
          .normal_formula_candidate_pool_after_special_child_exclusion === 184 &&
        anubisAnalysis.canonical_counts
          .effective_pair_results_changed_by_special_child_exclusion === 13_785 &&
        anubisAnalysis.direct_two_stage_search.blank_first_mate_species_checked === 299 &&
        anubisAnalysis.direct_two_stage_search.direct_two_step_to_elphidran_count === 0 &&
        anubisAnalysis.direct_two_stage_search.direct_two_step_to_surfent_count === 0 &&
        anubisAnalysis.direct_two_stage_search.direct_two_step_to_elphidran_aqua_count === 0,
    },
    {
      name: "Anubis/Jolthog analysis records corrected known pairs",
      ok:
        anubisAnalysis.known_pair_checks.some(
          ({ parents, child }) =>
            parents.join("+") === "Anubis+Deer_Ground" && child === "OniGhostGirl",
        ) &&
        anubisAnalysis.known_pair_checks.some(
          ({ parents, child }) =>
            parents.join("+") === "WhiteMoth+SheepBall" && child === "Serpent",
        ),
    },
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
    sourceDataHash: generated.sourceDataHash,
    generatedArtifactHash: generated.generatedArtifactHash,
    checks,
    unresolvedConflicts: generated.validation.conflicts,
    releaseBlocked: generated.validation.conflicts.some(({ blocking }) => blocking),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!ok) process.exitCode = 1;
}

await main();
