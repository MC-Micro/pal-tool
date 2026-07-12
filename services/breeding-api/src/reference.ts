import generatedReferenceJson from "../generated/reference.json";

import { createBreedingEngine, triangularPairFromOrdinal, triangularPairOrdinal } from "./breeding.ts";
import {
  RULE_CODE,
  type GeneratedReference,
  type Gender,
  type GenderOverride,
  type PairResolution,
  type PalValue,
  type ResolvedPair,
  type RuleCode,
  type RuleName,
  type SpecialCombination,
} from "./types.ts";

const reference = generatedReferenceJson as unknown as GeneratedReference;

function decodeBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeUint8(base64: string): Uint8Array {
  return decodeBytes(base64);
}

function decodeUint16Le(base64: string): Uint16Array {
  const bytes = decodeBytes(base64);
  if (bytes.byteLength % 2 !== 0) throw new Error("Packed uint16 data has an invalid byte length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Uint16Array(bytes.byteLength / 2);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = view.getUint16(index * 2, true);
  }
  return values;
}

function decodeUint32Le(base64: string): Uint32Array {
  const bytes = decodeBytes(base64);
  if (bytes.byteLength % 4 !== 0) throw new Error("Packed uint32 data has an invalid byte length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Uint32Array(bytes.byteLength / 4);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = view.getUint32(index * 4, true);
  }
  return values;
}

function requiredPal(id: number): PalValue {
  const pal = reference.pals[id];
  if (pal === undefined) throw new RangeError(`Unknown packed pal id: ${id}`);
  return pal;
}

const engine = createBreedingEngine(reference.pals, reference.canonical.specialCombinations);
const pairChildren = decodeUint16Le(reference.pairMatrix.childIdsBase64);
const pairRules = decodeUint8(reference.pairMatrix.ruleCodesBase64);
const parentsOffsets = decodeUint32Le(reference.parentsByChild.offsetsBase64);
const parentOrdinals = decodeUint32Le(reference.parentsByChild.pairOrdinalsBase64);
const adjacencyOffsets = decodeUint32Le(reference.carrierAdjacency.offsetsBase64);
const adjacencyChildren = decodeUint16Le(reference.carrierAdjacency.childIdsBase64);
const adjacencyMates = decodeUint16Le(reference.carrierAdjacency.mateIdsBase64);
const adjacencyRules = decodeUint8(reference.carrierAdjacency.ruleCodesBase64);
const adjacencyCarrierGenders = decodeUint8(reference.carrierAdjacency.carrierGendersBase64);
const adjacencyMateGenders = decodeUint8(reference.carrierAdjacency.mateGendersBase64);

const genderByCode = new Map<number, Gender>(
  Object.entries(reference.carrierAdjacency.genderLegend).map(([gender, code]) => [
    code,
    gender as Gender,
  ]),
);

const internalIds = new Map(reference.pals.map((pal, id) => [pal.internal_name, id]));
const specialRowsById = new Map(
  reference.canonical.specialCombinations.map((row) => [row.row_id, row]),
);
const universalSpecialByOrdinal = new Map<number, SpecialCombination>();
const genderOverridesByOrdinal = new Map<number, GenderOverride[]>();

for (const row of reference.canonical.specialCombinations) {
  if (row.parent_a_gender !== "ANY" || row.parent_b_gender !== "ANY") continue;
  const parentAId = internalIds.get(row.parent_a_internal);
  const parentBId = internalIds.get(row.parent_b_internal);
  if (parentAId === undefined || parentBId === undefined) {
    throw new Error(`Special row ${row.row_id} references an unknown parent`);
  }
  universalSpecialByOrdinal.set(
    triangularPairOrdinal(parentAId, parentBId, reference.pals.length),
    row,
  );
}

for (const override of reference.genderOverrides) {
  const rows = genderOverridesByOrdinal.get(override.pairOrdinal) ?? [];
  rows.push(override);
  genderOverridesByOrdinal.set(override.pairOrdinal, rows);
}

function assertPackedReference(): void {
  const palCount = reference.pals.length;
  if (palCount !== reference.status.palCount) throw new Error("Packed status pal count mismatch");
  if (pairChildren.length !== reference.pairMatrix.count || pairRules.length !== pairChildren.length) {
    throw new Error("Packed pair matrix length mismatch");
  }
  if (parentsOffsets.length !== palCount + 1) throw new Error("Packed parents offset length mismatch");
  if (parentOrdinals.length !== reference.parentsByChild.entryCount) {
    throw new Error("Packed parents entry count mismatch");
  }
  if (adjacencyOffsets.length !== palCount + 1) {
    throw new Error("Packed adjacency offset length mismatch");
  }
  const edgeCount = reference.carrierAdjacency.edgeCount;
  for (const values of [
    adjacencyChildren,
    adjacencyMates,
    adjacencyRules,
    adjacencyCarrierGenders,
    adjacencyMateGenders,
  ]) {
    if (values.length !== edgeCount) throw new Error("Packed adjacency edge count mismatch");
  }
}

assertPackedReference();

export interface ParentIndexEntry {
  pairOrdinal: number;
  parentAId: number;
  parentBId: number;
  parentAGender: Gender;
  parentBGender: Gender;
  childId: number;
  rule: RuleName;
  rowId?: string;
}

export interface CarrierEdge {
  carrierId: number;
  mateId: number;
  childId: number;
  rule: RuleName;
  carrierGender: Gender;
  mateGender: Gender;
  rowId?: string;
}

export function ruleNameFromCode(code: number): RuleName {
  if (code === RULE_CODE.same_species) return "same_species";
  if (code === RULE_CODE.special_combination) return "special_combination";
  if (code === RULE_CODE.normal_formula) return "normal_formula";
  throw new Error(`Unknown packed rule code: ${code}`);
}

export function getReference(): GeneratedReference {
  return reference;
}

export function getPal(id: number): PalValue {
  return requiredPal(id);
}

export function resolveName(name: string): readonly number[] {
  return engine.resolveName(name);
}

export function pairOrdinal(parentAId: number, parentBId: number): number {
  return triangularPairOrdinal(parentAId, parentBId, reference.pals.length);
}

export function getBasePair(parentAId: number, parentBId: number): ResolvedPair {
  const ordinal = pairOrdinal(parentAId, parentBId);
  const childId = pairChildren[ordinal];
  const ruleCode = pairRules[ordinal];
  if (childId === undefined || ruleCode === undefined) throw new Error(`Packed pair ${ordinal} is missing`);

  const detailed = engine.resolveBasePair(parentAId, parentBId);
  if (detailed.childId !== childId || detailed.ruleCode !== ruleCode) {
    throw new Error(`Packed pair ${ordinal} disagrees with the canonical resolver`);
  }
  return detailed;
}

export function resolvePair(
  parentAId: number,
  parentBId: number,
  parentAGender: Gender,
  parentBGender: Gender,
): PairResolution {
  const resolution = engine.resolvePair(parentAId, parentBId, parentAGender, parentBGender);
  if (resolution.kind === "resolved" && resolution.rule !== "special_combination") {
    const packed = getBasePair(parentAId, parentBId);
    if (resolution.childId !== packed.childId || resolution.ruleCode !== packed.ruleCode) {
      throw new Error("Gender-independent resolution disagrees with the packed pair matrix");
    }
  }
  return resolution;
}

export function getUniversalSpecialRow(pair: number): SpecialCombination | undefined {
  return universalSpecialByOrdinal.get(pair);
}

export function getSpecialRow(rowId: string): SpecialCombination | undefined {
  return specialRowsById.get(rowId);
}

export function getGenderOverrides(pair: number): readonly GenderOverride[] {
  return genderOverridesByOrdinal.get(pair) ?? [];
}

export function getParentEntries(childId: number): ParentIndexEntry[] {
  requiredPal(childId);
  const start = parentsOffsets[childId];
  const end = parentsOffsets[childId + 1];
  if (start === undefined || end === undefined) throw new Error("Packed parent offsets are missing");
  const entries: ParentIndexEntry[] = [];

  for (let index = start; index < end; index += 1) {
    const ordinal = parentOrdinals[index];
    if (ordinal === undefined) throw new Error("Packed parent ordinal is missing");
    const [parentAId, parentBId] = triangularPairFromOrdinal(ordinal, reference.pals.length);
    const packedChildId = pairChildren[ordinal];
    const packedRule = pairRules[ordinal];
    if (packedChildId !== childId || packedRule === undefined) {
      throw new Error(`Reverse parent index disagrees at pair ${ordinal}`);
    }
    const row = universalSpecialByOrdinal.get(ordinal);
    entries.push({
      pairOrdinal: ordinal,
      parentAId,
      parentBId,
      parentAGender: "ANY",
      parentBGender: "ANY",
      childId,
      rule: ruleNameFromCode(packedRule),
      ...(row === undefined ? {} : { rowId: row.row_id }),
    });
  }

  for (const override of reference.genderOverrides) {
    if (override.childId !== childId) continue;
    entries.push({
      pairOrdinal: override.pairOrdinal,
      parentAId: override.parentAId,
      parentBId: override.parentBId,
      parentAGender: override.parentAGender,
      parentBGender: override.parentBGender,
      childId,
      rule: "special_combination",
      rowId: override.rowId,
    });
  }

  return entries;
}

function rowIdForEdge(edge: Omit<CarrierEdge, "rowId">): string | undefined {
  if (edge.rule !== "special_combination") return undefined;
  const ordinal = pairOrdinal(edge.carrierId, edge.mateId);
  const universal = universalSpecialByOrdinal.get(ordinal);
  if (universal !== undefined) return universal.row_id;

  const carrierIsLower = edge.carrierId <= edge.mateId;
  return getGenderOverrides(ordinal).find((override) => {
    const carrierGender = carrierIsLower ? override.parentAGender : override.parentBGender;
    const mateGender = carrierIsLower ? override.parentBGender : override.parentAGender;
    return (
      override.childId === edge.childId &&
      carrierGender === edge.carrierGender &&
      mateGender === edge.mateGender
    );
  })?.rowId;
}

export function getCarrierEdges(carrierId: number): CarrierEdge[] {
  requiredPal(carrierId);
  const start = adjacencyOffsets[carrierId];
  const end = adjacencyOffsets[carrierId + 1];
  if (start === undefined || end === undefined) throw new Error("Packed adjacency offsets are missing");
  const edges: CarrierEdge[] = [];

  for (let index = start; index < end; index += 1) {
    const childId = adjacencyChildren[index];
    const mateId = adjacencyMates[index];
    const ruleCode = adjacencyRules[index];
    const carrierGenderCode = adjacencyCarrierGenders[index];
    const mateGenderCode = adjacencyMateGenders[index];
    if (
      childId === undefined ||
      mateId === undefined ||
      ruleCode === undefined ||
      carrierGenderCode === undefined ||
      mateGenderCode === undefined
    ) {
      throw new Error("Packed adjacency edge is incomplete");
    }
    const carrierGender = genderByCode.get(carrierGenderCode);
    const mateGender = genderByCode.get(mateGenderCode);
    if (carrierGender === undefined || mateGender === undefined) {
      throw new Error("Packed adjacency contains an unknown gender code");
    }
    const edge = {
      carrierId,
      mateId,
      childId,
      rule: ruleNameFromCode(ruleCode),
      carrierGender,
      mateGender,
    } satisfies Omit<CarrierEdge, "rowId">;
    const rowId = rowIdForEdge(edge);
    edges.push({ ...edge, ...(rowId === undefined ? {} : { rowId }) });
  }
  return edges;
}

export function getChildrenForPair(parentAId: number, parentBId: number): CarrierEdge[] {
  const ordinal = pairOrdinal(parentAId, parentBId);
  const overrides = getGenderOverrides(ordinal);
  if (overrides.length === 0) {
    const base = getBasePair(parentAId, parentBId);
    const row = getUniversalSpecialRow(ordinal);
    return [
      {
        carrierId: parentAId,
        mateId: parentBId,
        childId: base.childId,
        rule: base.rule,
        carrierGender: "ANY",
        mateGender: "ANY",
        ...(row === undefined ? {} : { rowId: row.row_id }),
      },
    ];
  }

  const parentAIsLower = parentAId <= parentBId;
  return overrides.map((override) => ({
    carrierId: parentAId,
    mateId: parentBId,
    childId: override.childId,
    rule: "special_combination",
    carrierGender: parentAIsLower ? override.parentAGender : override.parentBGender,
    mateGender: parentAIsLower ? override.parentBGender : override.parentAGender,
    rowId: override.rowId,
  }));
}

export function isRuleCode(value: number): value is RuleCode {
  return Object.values(RULE_CODE).includes(value as RuleCode);
}
