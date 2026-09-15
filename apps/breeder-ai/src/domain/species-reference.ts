import { z } from "zod";

export const SPECIES_NAMESPACE = "palworld.species.internal_name" as const;

const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u, "must be a lowercase SHA-256 digest");

export const SpeciesDatasetReferenceSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    gameVersion: z.string().min(1).max(100),
    dedicatedServerBuildId: z.string().min(1).max(100),
    technicalSnapshotSha256: sha256Schema,
  })
  .strict();

export type SpeciesDatasetReference = z.infer<
  typeof SpeciesDatasetReferenceSchema
>;

export const SpeciesAdapterKeySchema = z
  .object({
    namespace: z.literal(SPECIES_NAMESPACE),
    value: z.string().min(1).max(200),
  })
  .strict();

export type SpeciesAdapterKey = z.infer<typeof SpeciesAdapterKeySchema>;

export const PersistedSpeciesReferenceSchema = z
  .object({
    adapterKey: SpeciesAdapterKeySchema,
    dataset: SpeciesDatasetReferenceSchema,
  })
  .strict();

export type PersistedSpeciesReference = z.infer<
  typeof PersistedSpeciesReferenceSchema
>;

export function sameSpeciesDataset(
  left: SpeciesDatasetReference,
  right: SpeciesDatasetReference,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.gameVersion === right.gameVersion &&
    left.dedicatedServerBuildId === right.dedicatedServerBuildId &&
    left.technicalSnapshotSha256 === right.technicalSnapshotSha256
  );
}
