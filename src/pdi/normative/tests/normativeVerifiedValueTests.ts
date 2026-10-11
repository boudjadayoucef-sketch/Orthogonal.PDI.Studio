/**
 * PDI NORMATIVE ENGINE — NORM-10 TESTS
 * Reference: NORM-10 (Evidence → Verified Value)
 *
 * New fixtures are synthetic only.
 *
 * NOTE:
 * The F01 regression test intentionally uses the existing legacy F01 fixture
 * contract to prove that NORM-10 does not modify designCodeEngine behavior.
 */

import type {
  NormativeEvidence,
  NormativeVerifiedValue,
} from "../types/normativeEvidenceTypes";
import {
  NormativeEvidenceRegistry,
} from "../registry/normativeEvidenceRegistry";
import {
  NormativeEvidenceResolver,
} from "../registry/normativeEvidenceResolver";
import {
  validateNormativeVerifiedValue,
} from "../validators/normativeVerifiedValueValidator";
import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import type { EngineeringCalculationInput } from "../types/designCodeTypes";

export function runNormativeVerifiedValueTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let success = true;
  let testsRun = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    testsRun++;
    if (!condition) {
      success = false;
      const msg = `FAIL: ${name}${detail ? ` (${detail})` : ""}`;
      results.push(`❌ ${msg}`);
      throw new Error(msg);
    }
    results.push(`✅ PASS: ${name}`);
  }

  const SYNTHETIC_STANDARD_ID = "SYNTHETIC_NORM10_STANDARD_001";
  const SYNTHETIC_EDITION_ID = "SYNTHETIC_NORM10_EDITION_001";
  const SYNTHETIC_CLAUSE = "SYNTHETIC_NORM10_CLAUSE_001";
  const SYNTHETIC_SOURCE = "SYNTHETIC_NORM10_SOURCE_001";
  const SYNTHETIC_VERIFIER = "SYNTHETIC_NORM10_VERIFIER_001";

  const registry = new NormativeEvidenceRegistry();
  const resolver = new NormativeEvidenceResolver(registry);

  const verifiedEvidence: NormativeEvidence = {
    evidenceId: "SYNTHETIC_NORM10_EVID_VERIFIED_001",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE,
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: SYNTHETIC_SOURCE,
    verificationStatus: "VERIFIED",
    verifiedBy: SYNTHETIC_VERIFIER,
    verifiedAt: "2026-09-22T00:00:00.000Z",
  };

  const secondVerifiedEvidence: NormativeEvidence = {
    evidenceId: "SYNTHETIC_NORM10_EVID_VERIFIED_002",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: "SYNTHETIC_NORM10_CLAUSE_002",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_NORM10_SOURCE_002",
    verificationStatus: "VERIFIED",
    verifiedBy: SYNTHETIC_VERIFIER,
    verifiedAt: "2026-09-22T00:00:00.000Z",
  };

  const unverifiedEvidence: NormativeEvidence = {
    evidenceId: "SYNTHETIC_NORM10_EVID_UNVERIFIED_001",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: "SYNTHETIC_NORM10_CLAUSE_003",
    sourceType: "MANUFACTURER_DATA",
    sourceReference: "SYNTHETIC_NORM10_SOURCE_PRELIMINARY",
    verificationStatus: "UNVERIFIED",
  };

  registry.register(verifiedEvidence);
  registry.register(secondVerifiedEvidence);
  registry.register(unverifiedEvidence);

  // TEST 1 — VERIFIED + VERIFIED evidence => accepted
  const value1: NormativeVerifiedValue<number> = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [verifiedEvidence.evidenceId],
    sourceReference: "SYNTHETIC_NORM10_VALUE_SOURCE",
  };

  const result1 = validateNormativeVerifiedValue(value1, resolver);
  assert(
    result1.valid && result1.verified,
    "TEST 1 — VERIFIED value with VERIFIED evidence is accepted",
  );

  // TEST 2 — UNVERIFIED remains UNVERIFIED
  const value2: NormativeVerifiedValue<number> = {
    value: 42.5,
    verificationStatus: "UNVERIFIED",
    evidenceIds: [],
  };

  const result2 = validateNormativeVerifiedValue(value2, resolver);
  assert(
    result2.valid && !result2.verified,
    "TEST 2 — UNVERIFIED value remains explicitly UNVERIFIED",
  );

  // TEST 3 — VERIFIED without evidence => rejected
  const value3 = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [],
  };

  const result3 = validateNormativeVerifiedValue(value3, resolver);
  assert(
    !result3.valid &&
      result3.errors.some((e) => e.code === "VERIFIED_REQUIRES_EVIDENCE"),
    "TEST 3 — VERIFIED without evidence is rejected",
  );

  // TEST 4 — missing evidence => rejected
  const value4 = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: ["SYNTHETIC_NORM10_EVID_DOES_NOT_EXIST"],
  };

  const result4 = validateNormativeVerifiedValue(value4, resolver);
  assert(
    !result4.valid &&
      result4.errors.some((e) => e.code === "VERIFIED_EVIDENCE_NOT_FOUND"),
    "TEST 4 — VERIFIED with missing evidence is rejected",
  );

  // TEST 5 — UNVERIFIED evidence => rejected
  const value5 = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [unverifiedEvidence.evidenceId],
  };

  const result5 = validateNormativeVerifiedValue(value5, resolver);
  assert(
    !result5.valid &&
      result5.errors.some((e) => e.code === "VERIFIED_EVIDENCE_UNVERIFIED"),
    "TEST 5 — VERIFIED with UNVERIFIED evidence is rejected",
  );

  // TEST 6 — one verified evidence => accepted
  const value6 = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [secondVerifiedEvidence.evidenceId],
  };

  const result6 = validateNormativeVerifiedValue(value6, resolver);
  assert(
    result6.valid && result6.verified,
    "TEST 6 — VERIFIED with a valid VERIFIED evidence is accepted",
  );

  // TEST 7a — multiple VERIFIED evidences => accepted
  const value7a = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [
      verifiedEvidence.evidenceId,
      secondVerifiedEvidence.evidenceId,
    ],
  };

  const result7a = validateNormativeVerifiedValue(value7a, resolver);
  assert(
    result7a.valid && result7a.verified,
    "TEST 7a — multiple VERIFIED evidences are accepted",
  );

  // TEST 7b — one UNVERIFIED evidence among verified => rejected
  const value7b = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [
      verifiedEvidence.evidenceId,
      unverifiedEvidence.evidenceId,
    ],
  };

  const result7b = validateNormativeVerifiedValue(value7b, resolver);
  assert(
    !result7b.valid &&
      result7b.errors.some((e) => e.code === "VERIFIED_EVIDENCE_UNVERIFIED"),
    "TEST 7b — one UNVERIFIED evidence blocks VERIFIED value",
  );

  // TEST 8 — empty evidenceIds + VERIFIED => rejected
  const value8 = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [],
  };

  const result8 = validateNormativeVerifiedValue(value8, resolver);
  assert(
    !result8.valid &&
      result8.errors.some((e) => e.code === "VERIFIED_REQUIRES_EVIDENCE"),
    "TEST 8 — empty evidenceIds block VERIFIED value",
  );

  // TEST 9 — heuristic token cannot create evidence
  const tokenValue = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: ["MAT_CS_SYNTHETIC", "CRMO", "CR_MO"],
  };

  const result9 = validateNormativeVerifiedValue(tokenValue, resolver);
  assert(
    !result9.valid &&
      result9.errors.every(
        (e) =>
          e.code === "VERIFIED_EVIDENCE_NOT_FOUND" ||
          e.code === "VERIFIED_EVIDENCE_INVALID",
      ),
    "TEST 9 — heuristic tokens never create or promote evidence",
  );

  // TEST 10 — invalid structural object
  const result10 = validateNormativeVerifiedValue(null, resolver);
  assert(
    !result10.valid &&
      result10.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST 10 — invalid raw object is rejected",
  );

  // TEST 11 — F01 fully evidenced input produces CALCULATED
  const f01Baseline: EngineeringCalculationInput = {
    evidenceItems: [
      {
        evidenceId: "SYNTHETIC_VV_EV_S_001",
        standardId: "SYNTHETIC_STANDARD" as any,
        editionId: "SYNTHETIC_EDITION",
        clauseReference: "SYNTHETIC_CLAUSE_S",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_S",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        evidenceId: "SYNTHETIC_VV_EV_E_002",
        standardId: "SYNTHETIC_STANDARD" as any,
        editionId: "SYNTHETIC_EDITION",
        clauseReference: "SYNTHETIC_CLAUSE_E",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_E",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        evidenceId: "SYNTHETIC_VV_EV_W_003",
        standardId: "SYNTHETIC_STANDARD" as any,
        editionId: "SYNTHETIC_EDITION",
        clauseReference: "SYNTHETIC_CLAUSE_W",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_W",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        evidenceId: "SYNTHETIC_VV_EV_Y_004",
        standardId: "SYNTHETIC_STANDARD" as any,
        editionId: "SYNTHETIC_EDITION",
        clauseReference: "SYNTHETIC_CLAUSE_Y",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_Y",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    designCodeId: "ASME-B31.3",
    standardEdition: { year: "2024" },
    calculationType: "PRESSURE_WALL_THICKNESS",
    unitSystem: "SI",
    pressure: 2.0,
    temperature: 100,
    outsideDiameterMm: 114.3,
    corrosionAllowanceMm: 1.5,
    diameterBasis: "OUTSIDE",
    componentType: "SEAMLESS",
    materialId: "SYNTHETIC_MATERIAL",
    allowableStressInput: {
      verifiedValue: {
        value: 138.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_VV_EV_S_001"],
      },
      value: 138.0,
      unit: "MPa",
      temperature: 100,
      materialReference: "ASTM A106 Grade B",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table A-1",
    },
    qualityFactorInput: {
      verifiedValue: {
        value: 1.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_VV_EV_E_002"],
      },
      factorValue: 1.0,
      productSpecification: "ASTM A106 Seamless",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table 302.3.4",
    },
    weldReductionFactorInput: {
      verifiedValue: {
        value: 1.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_VV_EV_W_003"],
      },
      factorValue: 1.0,
      branchId: "W-01",
      componentType: "SEAMLESS",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 para. 302.3.5(e)",
    },
    yCoefficientInput: {
      verifiedValue: {
        value: 0.4,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_VV_EV_Y_004"],
      },
      factorValue: 0.4,
      materialFamily: "FERRITIC",
      temperature: 100,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 304.1.1",
    },
  };

  const calcResult = executeEngineeringCalculation(f01Baseline);
  assert(
    calcResult.status === "CALCULATED" &&
      calcResult.value !== undefined &&
      calcResult.value > 0,
    "TEST 11 — F01 remains CALCULATED",
  );

  // TEST 12 — default NORM-09 registry remains empty
  // Use a fresh registry so this test is independent of local fixtures.
  const freshRegistry = new NormativeEvidenceRegistry();
  assert(
    freshRegistry.count() === 0,
    "TEST 12 — a fresh normative evidence registry is empty by default",
  );

  return { success, testsRun, results };
}
