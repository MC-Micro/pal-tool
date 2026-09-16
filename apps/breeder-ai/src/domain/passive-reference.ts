import { z } from "zod";

export const PASSIVE_NAMESPACE = "palworld.passive.source_row" as const;

const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u, "must be a lowercase SHA-256 digest");

export const PassiveDatasetReferenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceSpaceSha256: sha256Schema,
  })
  .strict();

export type PassiveDatasetReference = z.infer<
  typeof PassiveDatasetReferenceSchema
>;

export const PassiveAdapterKeySchema = z
  .object({
    namespace: z.literal(PASSIVE_NAMESPACE),
    value: z.string().min(1).max(200),
  })
  .strict();

export type PassiveAdapterKey = z.infer<typeof PassiveAdapterKeySchema>;

export const PersistedPassiveReferenceSchema = z
  .object({
    adapterKey: PassiveAdapterKeySchema,
    dataset: PassiveDatasetReferenceSchema,
  })
  .strict();

export type PersistedPassiveReference = z.infer<
  typeof PersistedPassiveReferenceSchema
>;

const passiveNameReferenceSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("explicit_override"),
      field: z.literal("overrideNameTextId"),
      value: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      source: z.literal("observed_default_row_convention"),
      field: z.literal("sourceRow"),
      value: z.string().min(1).max(300),
    })
    .strict(),
]);

export const PassiveReferenceEntrySchema = z
  .object({
    sourceRow: z.string().min(1).max(200),
    nameReference: passiveNameReferenceSchema,
    nameEn: z.string().min(1).max(300),
    nameDe: z.string().min(1).max(300),
  })
  .strict();

export type PassiveReferenceEntry = z.infer<
  typeof PassiveReferenceEntrySchema
>;

export const PassiveReferenceArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    domain: z.literal("palworld.passive.reference_space"),
    adapterKeyNamespace: z.literal(PASSIVE_NAMESPACE),
    dataset: z
      .object({
        schemaVersion: z.literal(1),
        referenceSpaceSha256: sha256Schema,
        provenance: z
          .object({
            steamBuildId: z.string().min(1).max(100),
            technicalCandidateSha256: sha256Schema,
            sourceReviewSchemaVersion: z.literal(2),
            repository: z.literal("MC-Micro/pal-tool"),
            workflow: z.literal("Probe Pal Data Core"),
            workflowRunId: z.string().regex(/^\d+$/u),
            commitSha: z.string().regex(/^[a-f0-9]{40,64}$/u),
            artifactName: z.string().min(1).max(200),
            artifactId: z.string().regex(/^\d+$/u),
            artifactSha256: sha256Schema,
          })
          .strict(),
      })
      .strict(),
    entries: z.array(PassiveReferenceEntrySchema).min(1),
  })
  .strict()
  .superRefine((artifact, context) => {
    const expectedArtifactName =
      `pal-data-core-candidate-${artifact.dataset.provenance.steamBuildId}`;
    if (artifact.dataset.provenance.artifactName !== expectedArtifactName) {
      context.addIssue({
        code: "custom",
        path: ["dataset", "provenance", "artifactName"],
        message: "artifactName must match the provenanced Steam build",
      });
    }
  });

export type PassiveReferenceArtifact = z.infer<
  typeof PassiveReferenceArtifactSchema
>;

export function samePassiveDataset(
  left: PassiveDatasetReference,
  right: PassiveDatasetReference,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.referenceSpaceSha256 === right.referenceSpaceSha256
  );
}
