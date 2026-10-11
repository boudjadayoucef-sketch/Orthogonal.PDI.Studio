import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import type { EngineeringCalculationInput } from "../types/designCodeTypes";

const evidenceItems = Object.freeze([
  {
    evidenceId: "SYNTHETIC_NORM12_A",
    standardId: "SYNTHETIC_STANDARD_NORM12" as any,
    editionId: "SYNTHETIC_EDITION_NORM12",
    clauseReference: "SYNTHETIC_CLAUSE_A",
    sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
    sourceReference: "SYNTHETIC_SOURCE_A",
    verificationStatus: "VERIFIED" as const,
    verifiedBy: "SYSTEM_VALIDATOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    evidenceId: "SYNTHETIC_NORM12_B",
    standardId: "SYNTHETIC_STANDARD_NORM12" as any,
    editionId: "SYNTHETIC_EDITION_NORM12",
    clauseReference: "SYNTHETIC_CLAUSE_B",
    sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
    sourceReference: "SYNTHETIC_SOURCE_B",
    verificationStatus: "VERIFIED" as const,
    verifiedBy: "SYSTEM_VALIDATOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  },
]);

const base: EngineeringCalculationInput = {
  designCodeId: "ASME-B31.3",
  standardEdition: { year: "2024" },
  calculationType: "PRESSURE_WALL_THICKNESS",
  unitSystem: "SI",
  pressure: 2,
  temperature: 100,
  outsideDiameterMm: 114.3,
  corrosionAllowanceMm: 1.5,
  diameterBasis: "OUTSIDE",
  componentType: "SEAMLESS",
  materialId: "SYNTHETIC_MATERIAL_NORM12",
  evidenceItems,
  allowableStressInput: {
    value: 138,
    unit: "MPa",
    temperature: 100,
    materialReference: "SYNTHETIC_MATERIAL_NORM12",
    qualificationStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_SOURCE_A",
    verifiedValue: { value: 138, verificationStatus: "VERIFIED", evidenceIds: ["SYNTHETIC_NORM12_A"] },
  },
  qualityFactorInput: {
    factorValue: 1,
    productSpecification: "SYNTHETIC_PRODUCT",
    qualificationStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_SOURCE_A",
    verifiedValue: { value: 1, verificationStatus: "VERIFIED", evidenceIds: ["SYNTHETIC_NORM12_A"] },
  },
  weldReductionFactorInput: {
    factorValue: 1,
    branchId: "W-01",
    componentType: "SEAMLESS",
    qualificationStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_SOURCE_B",
    verifiedValue: { value: 1, verificationStatus: "VERIFIED", evidenceIds: ["SYNTHETIC_NORM12_B"] },
  },
  yCoefficientInput: {
    factorValue: 0.4,
    materialFamily: "FERRITIC",
    temperature: 100,
    qualificationStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_SOURCE_A",
    verifiedValue: { value: 0.4, verificationStatus: "VERIFIED", evidenceIds: ["SYNTHETIC_NORM12_A"] },
  },
};

function assert(c: boolean, m: string) {
  if (!c) throw new Error(`NORM-12 FAILED: ${m}`);
}

export function runNormativeCalculationIntegrationTests() {
  let testsRun = 0;

  testsRun++;
  assert(
    executeEngineeringCalculation(base).status === "CALCULATED",
    "fully evidenced F01 input must calculate",
  );

  testsRun++;
  assert(
    executeEngineeringCalculation({
      ...base,
      allowableStressInput: { ...base.allowableStressInput!, verifiedValue: undefined },
    }).status === "UNVERIFIED",
    "raw S without Verified Value must be blocked",
  );

  testsRun++;
  assert(
    executeEngineeringCalculation({
      ...base,
      qualityFactorInput: {
        ...base.qualityFactorInput!,
        verifiedValue: { value: 1, verificationStatus: "UNVERIFIED", evidenceIds: ["SYNTHETIC_NORM12_A"] },
      },
    }).status === "UNVERIFIED",
    "UNVERIFIED E must be blocked",
  );

  testsRun++;
  assert(
    executeEngineeringCalculation({
      ...base,
      yCoefficientInput: {
        ...base.yCoefficientInput!,
        verifiedValue: { value: 0.4, verificationStatus: "VERIFIED", evidenceIds: ["SYNTHETIC_NORM12_MISSING"] },
      },
    }).status === "UNVERIFIED",
    "missing Y evidence must be blocked",
  );

  testsRun++;
  assert(
    executeEngineeringCalculation({
      ...base,
      allowableStressInput: {
        ...base.allowableStressInput!,
        verifiedValue: { value: 139, verificationStatus: "VERIFIED", evidenceIds: ["SYNTHETIC_NORM12_A"] },
      },
    }).status === "UNVERIFIED",
    "Verified Value differing from raw factor value must be blocked",
  );

  return { success: true, testsRun };
}
