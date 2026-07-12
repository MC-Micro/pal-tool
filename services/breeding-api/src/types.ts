export type Gender = "ANY" | "FEMALE" | "MALE";

export interface PalValue {
  internal_name: string;
  name_de: string;
  name_en: string;
  paldex_no: number;
  is_variant: boolean;
  combi_rank: number;
  rarity: number;
  ignore_combi: boolean;
  combi_duplicate_priority: number;
  internal_index: number;
  game_table_row: string;
}

export interface SpecialCombination {
  row_id: string;
  parent_a_internal: string;
  parent_a_de: string;
  parent_a_en: string;
  parent_b_internal: string;
  parent_b_de: string;
  parent_b_en: string;
  child_internal: string;
  child_de: string;
  child_en: string;
  parent_a_gender: Gender;
  parent_b_gender: Gender;
}

export interface DecisionRule {
  order: number;
  rule: string;
  description_de: string;
  formula?: string;
  confidence?: string;
}

export interface VerifiedEquidistantRankTest {
  parents: string[];
  target_rank: number;
  candidates: string[];
  winner: string;
  reason: string;
}

export interface BreedingRulesFile {
  schema_version: number;
  generated_at_utc: string;
  game_reference: string;
  decision_order: DecisionRule[];
  verified_equidistant_rank_tests: VerifiedEquidistantRankTest[];
  important_notes: string[];
}

export interface ManifestSource {
  repository: string;
  commit: string;
  path?: string;
  paths?: string[];
  database_version?: string;
  sha256: string | Record<string, string>;
  used_for: string[];
}

export interface CanonicalManifest {
  schema_version: number;
  generated_at_utc: string;
  sources: ManifestSource[];
  counts: Record<string, number>;
  validation: Record<string, unknown[]>;
}

export const RULE_CODE = {
  same_species: 1,
  special_combination: 2,
  normal_formula: 3,
} as const;

export type RuleName = keyof typeof RULE_CODE;
export type RuleCode = (typeof RULE_CODE)[RuleName];

export interface ResolvedPair {
  kind: "resolved";
  rule: RuleName;
  ruleCode: RuleCode;
  parentAId: number;
  parentBId: number;
  childId: number;
  rowId?: string;
  targetRank?: number;
  rankDistance?: number;
  parentRarityAverage?: number;
  nearestCandidateIds?: number[];
  appliedTieBreaks?: string[];
}

export interface GenderAlternative {
  rowId: string;
  parentAId: number;
  parentAGender: Gender;
  parentBId: number;
  parentBGender: Gender;
  childId: number;
}

export interface UnresolvedGenderPair {
  kind: "unresolved_gender";
  parentAId: number;
  parentBId: number;
  alternatives: GenderAlternative[];
  fallback: ResolvedPair;
}

export type PairResolution = ResolvedPair | UnresolvedGenderPair;

export interface PreparedSpecialCombination extends SpecialCombination {
  parentAId: number;
  parentBId: number;
  childId: number;
}

export interface BreedingEngine {
  pals: readonly PalValue[];
  aliases: Readonly<Record<string, readonly number[]>>;
  resolveName(name: string): readonly number[];
  resolveBasePair(parentAId: number, parentBId: number): ResolvedPair;
  resolvePair(
    parentAId: number,
    parentBId: number,
    parentAGender?: Gender,
    parentBGender?: Gender,
  ): PairResolution;
  getSpecials(parentAId: number, parentBId: number): readonly PreparedSpecialCombination[];
}

export interface SourceFileHash {
  path: string;
  sha256: string;
  bytes: number;
}

export interface PackedPairMatrix {
  count: number;
  layout: "upper-triangular-row-major-including-diagonal";
  childEncoding: "uint16-le-base64";
  ruleEncoding: "uint8-base64";
  childIdsBase64: string;
  ruleCodesBase64: string;
  ruleLegend: Record<RuleName, RuleCode>;
}

export interface PackedParentsIndex {
  entryCount: number;
  offsetsEncoding: "uint32-le-base64";
  pairOrdinalsEncoding: "uint32-le-base64";
  offsetsBase64: string;
  pairOrdinalsBase64: string;
  excludesGenderSpecificBasePairs: true;
}

export interface GenderOverride {
  pairOrdinal: number;
  rowId: string;
  parentAId: number;
  parentAGender: Gender;
  parentBId: number;
  parentBGender: Gender;
  childId: number;
}

export interface PackedCarrierAdjacency {
  edgeCount: number;
  semantics: "all-directed-parent-pair-outcomes";
  offsetsEncoding: "uint32-le-base64";
  idEncoding: "uint16-le-base64";
  ruleEncoding: "uint8-base64";
  genderEncoding: "uint8-base64";
  genderLegend: Record<Gender, number>;
  offsetsBase64: string;
  childIdsBase64: string;
  mateIdsBase64: string;
  ruleCodesBase64: string;
  carrierGendersBase64: string;
  mateGendersBase64: string;
}

export interface AssignmentConflict {
  code: string;
  description: string;
  parents: string[];
  expected: string;
  canonicalActual: string;
  canonicalReason: string;
  scope?: Record<string, unknown>;
  blocking: true;
}

export interface ReferenceValidation {
  ok: boolean;
  canonicalDataValid: boolean;
  assignmentExpectationsValid: boolean;
  status: "valid" | "needs_review";
  conflicts: AssignmentConflict[];
  implementationNotes: string[];
  sourceValidation: Record<string, unknown[]>;
}

export interface ReferenceStatus {
  ok: boolean;
  apiSchemaVersion: number;
  breedingReferenceSchemaVersion: number;
  gameReference: string;
  generatedAtUtc: string;
  dataHash: string;
  palCount: number;
  eligiblePalCount: number;
  specialCombinationCount: number;
  pairCount: number;
  genderOverrideCount: number;
  parentsIndexEntryCount: number;
  carrierAdjacencyEdgeCount: number;
  validationStatus: "valid" | "needs_review";
  knownPatchCheckStatus: "current" | "needs_review" | "unknown";
}

export interface GeneratedReference {
  schemaVersion: number;
  generatedAtUtc: string;
  dataHash: string;
  sourceFiles: SourceFileHash[];
  canonical: {
    rules: BreedingRulesFile;
    specialCombinations: SpecialCombination[];
    manifest: CanonicalManifest;
  };
  pals: PalValue[];
  aliases: Record<string, number[]>;
  pairMatrix: PackedPairMatrix;
  genderOverrides: GenderOverride[];
  parentsByChild: PackedParentsIndex;
  carrierAdjacency: PackedCarrierAdjacency;
  status: ReferenceStatus;
  validation: ReferenceValidation;
}
