/**
 * PDI NORMATIVE ENGINE — ASME B31.3 F01 CALCULATION INTEGRATION TESTS
 * Reference: B31.3-06 (Controlled F01 Calculation Integration)
 * 
 * Suite de tests validant le raccordement étanche et contrôlé :
 *   B31.3 Data Resolver
 *           ↓
 *   B31.3 Integration
 *           ↓
 *   NormativeVerifiedValue<T>
 *           ↓
 *   NormativeCalculationBoundary (resolveNormativeCalculationInput)
 *           ↓
 *   F01 Design Code Calculation (executeEngineeringCalculation)
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE (B31.3-06) :
 * - AUCUNE invention normative : B31_3_VERIFIED_DATA reste vide.
 * - Aucune formule F01 modifiée, aucun garde-fou supprimé.
 * - Les tests utilisent EXCLUSIVEMENT des fixtures synthétiques (`SYNTHETIC_*`).
 */

import {
  NormativeSourceDocumentRegistry,
} from "../registry/normativeSourceDocumentRegistry";
import {
  NormativeSourceDocumentResolver,
} from "../registry/normativeSourceDocumentResolver";
import {
  NormativeEvidenceRegistry,
} from "../registry/normativeEvidenceRegistry";
import {
  NormativeEvidenceResolver,
} from "../registry/normativeEvidenceResolver";
import {
  B31_3DataRegistry,
} from "../data/b31_3/b31_3DataRegistry";
import {
  B31_3DataResolver,
} from "../data/b31_3/b31_3DataResolver";
import { B31_3_VERIFIED_DATA } from "../data/b31_3/b31_3VerifiedData";
import type {
  B31_3NormativeDataRecord,
} from "../types/b31_3DataTypes";
import type {
  NormativeSourceDocument,
} from "../types/normativeSourceDocumentTypes";
import type {
  NormativeEvidence,
  NormativeVerifiedValue,
} from "../types/normativeEvidenceTypes";
import {
  integrateB31_3Data,
  resolveB31_3ToCalculationBoundary,
  resolveB31_3ForF01,
  createB31_3F01StressInput,
  createB31_3F01QualityFactorInput,
  createB31_3F01WeldReductionFactorInput,
  createB31_3F01YCoefficientInput,
  B31_3Integration,
} from "../data/b31_3/b31_3Integration";
import {
  resolveNormativeCalculationInput,
  resolvePressureDesignStress,
  resolveWeldQualityFactor,
  resolveWeldReductionFactor,
  resolveYCoefficient,
} from "../validators/normativeCalculationBoundary";
import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import type { EngineeringCalculationInput } from "../types/designCodeTypes";

export interface B31_3F01TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[B31.3-06 ASSERTION FAILED] ${message}`);
  }
}

export function runB31_3F01IntegrationTests(): B31_3F01TestResult {
  const results: string[] = [];
  let testsRun = 0;

  function runTest(description: string, fn: () => void): void {
    testsRun++;
    try {
      fn();
      results.push(`✅ PASS ${testsRun}: ${description}`);
    } catch (err: any) {
      results.push(`❌ FAIL ${testsRun}: ${description} -> ${err.message}`);
      throw err;
    }
  }

  // Constantes synthétiques
  const STD = "SYNTHETIC_STANDARD_B313_F01";
  const EDT = "SYNTHETIC_EDITION_2026";
  const DOC_ID = "SYNTHETIC_DOC_F01_001";
  const EV_STRESS = "SYNTHETIC_EV_STRESS_001";
  const EV_E = "SYNTHETIC_EV_E_002";
  const EV_W = "SYNTHETIC_EV_W_003";
  const EV_Y = "SYNTHETIC_EV_Y_004";
  const EV_UNVERIFIED = "SYNTHETIC_EV_UNVERIFIED_999";

  const DATA_ID_S = "SYNTHETIC_DATA_S_001";
  const DATA_ID_E = "SYNTHETIC_DATA_E_002";
  const DATA_ID_W = "SYNTHETIC_DATA_W_003";
  const DATA_ID_Y = "SYNTHETIC_DATA_Y_004";
  const DATA_ID_UNVERIFIED = "SYNTHETIC_DATA_UNVERIFIED_999";

  function createTestEnvironment() {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);

    // Document source vérifié
    const docVerified: NormativeSourceDocument = {
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic ASME B31.3 Specification for F01 Testing",
      publisher: "SYNTHETIC_ASME",
      documentReference: "SYNTHETIC-B313-DOC-F01",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_F01",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    };
    docReg.register(docVerified);

    // Évidences vérifiées pour S, E, W, Y
    const evStress: NormativeEvidence = {
      evidenceId: EV_STRESS,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-REF-STRESS",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_F01",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    };
    evReg.register(evStress);

    const evE: NormativeEvidence = {
      evidenceId: EV_E,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table 302.3.4",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-REF-E",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_F01",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    };
    evReg.register(evE);

    const evW: NormativeEvidence = {
      evidenceId: EV_W,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table 302.3.5",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-REF-W",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_F01",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    };
    evReg.register(evW);

    const evY: NormativeEvidence = {
      evidenceId: EV_Y,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table 304.1.1-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-REF-Y",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_F01",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    };
    evReg.register(evY);

    // Évidence non vérifiée
    const evUnverified: NormativeEvidence = {
      evidenceId: EV_UNVERIFIED,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table Unverified",
      sourceType: "LEGACY_REFERENCE",
      sourceReference: "SYNTHETIC-REF-LEGACY",
      verificationStatus: "UNVERIFIED",
    };
    evReg.register(evUnverified);

    // Données B31.3 vérifiées
    const recordS: B31_3NormativeDataRecord<number> = {
      dataId: DATA_ID_S,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_STRESS,
      clauseReference: "Table A-1",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      unit: "MPa",
      status: "VERIFIED",
    };
    dataReg.register(recordS);

    const recordE: B31_3NormativeDataRecord<number> = {
      dataId: DATA_ID_E,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_E,
      clauseReference: "Table 302.3.4",
      dataType: "QUALITY_FACTOR",
      value: 1.0,
      status: "VERIFIED",
    };
    dataReg.register(recordE);

    const recordW: B31_3NormativeDataRecord<number> = {
      dataId: DATA_ID_W,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_W,
      clauseReference: "Table 302.3.5",
      dataType: "WELD_REDUCTION_FACTOR",
      value: 1.0,
      status: "VERIFIED",
    };
    dataReg.register(recordW);

    const recordY: B31_3NormativeDataRecord<number> = {
      dataId: DATA_ID_Y,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_Y,
      clauseReference: "Table 304.1.1-1",
      dataType: "Y_COEFFICIENT",
      value: 0.4,
      status: "VERIFIED",
    };
    dataReg.register(recordY);

    // Donnée B31.3 non vérifiée
    const recordUnverified: B31_3NormativeDataRecord<number> = {
      dataId: DATA_ID_UNVERIFIED,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_UNVERIFIED,
      clauseReference: "Table Unverified",
      dataType: "ALLOWABLE_STRESS",
      value: 99.9,
      unit: "MPa",
      status: "UNVERIFIED",
    };
    dataReg.register(recordUnverified);

    const options = {
      dataResolver: dataRes,
      sourceDocResolver: docRes,
      evidenceResolver: evRes,
    };

    return {
      docReg,
      docRes,
      evReg,
      evRes,
      dataReg,
      dataRes,
      options,
      evStress,
      evE,
      evW,
      evY,
    };
  }

  // =========================================================================
  // TEST 1 — VERIFIED VALUE ACCEPTÉE
  // =========================================================================
  runTest("Test 1: Verified value acceptée à travers la frontière de calcul", () => {
    const env = createTestEnvironment();

    const resolution = resolveB31_3ForF01("S", { dataId: DATA_ID_S }, env.options);
    assert(resolution.status === "RESOLVED_VERIFIED", `Expected RESOLVED_VERIFIED, got ${resolution.status}`);
    assert(resolution.verifiedValue !== undefined, "verifiedValue must be defined");
    assert(resolution.verifiedValue?.verificationStatus === "VERIFIED", "Status must be VERIFIED");
    assert(resolution.verifiedValue?.value === 137.9, "Value must be 137.9");

    const boundaryResult = resolvePressureDesignStress(
      { name: "S", verifiedValue: resolution.verifiedValue! },
      env.evRes
    );
    assert(boundaryResult.valid === true, "Boundary result must be valid");
    assert(boundaryResult.value === 137.9, "Value across boundary must be 137.9");
  });

  // =========================================================================
  // TEST 2 — RAW NUMBER REFUSÉ
  // =========================================================================
  runTest("Test 2: Raw number (value: 42) refusé comme preuve normative", () => {
    const env = createTestEnvironment();

    // Construction d'un objet non vérifié / sans preuve
    const rawNumberInput = {
      name: "S",
      verifiedValue: {
        value: 42,
        verificationStatus: "UNVERIFIED" as const,
        evidenceIds: [],
      },
    };

    const boundaryResult = resolveNormativeCalculationInput(rawNumberInput, env.evRes);
    assert(!boundaryResult.valid, "Raw unverified number must be rejected by calculation boundary");
    assert(
      boundaryResult.error === "VERIFIED_VALUE_EVIDENCE_CHAIN_NOT_VERIFIED",
      `Expected chain error, got ${boundaryResult.error}`
    );
  });

  // =========================================================================
  // TEST 3 — UNVERIFIED REFUSÉ
  // =========================================================================
  runTest("Test 3: Donnée B31.3 UNVERIFIED refusée pour le calcul F01", () => {
    const env = createTestEnvironment();

    const resolution = resolveB31_3ForF01("S", { dataId: DATA_ID_UNVERIFIED }, env.options);
    assert(resolution.status === "UNVERIFIED", `Expected UNVERIFIED, got ${resolution.status}`);
    assert(resolution.verifiedValue === undefined, "verifiedValue must NOT be granted for UNVERIFIED record");

    const stressInputResult = createB31_3F01StressInput(
      { dataId: DATA_ID_UNVERIFIED },
      { materialReference: "SYNTH_MAT", temperature: 100 },
      env.options
    );
    assert(stressInputResult.status === "UNVERIFIED", "createB31_3F01StressInput must report UNVERIFIED");
    assert(stressInputResult.stressInput === undefined, "stressInput must be undefined for UNVERIFIED record");
  });

  // =========================================================================
  // TEST 4 — EVIDENCE ABSENTE REFUSÉE
  // =========================================================================
  runTest("Test 4: Donnée sans Evidence VERIFIED bloquée", () => {
    const env = createTestEnvironment();

    const isolatedDataResolver = {
      resolveData: <T = unknown>() => ({
        dataId: "SYNTH_DATA_MISSING_EV",
        status: "FOUND_VERIFIED" as const,
        record: {
          dataId: "SYNTH_DATA_MISSING_EV",
          standardId: STD,
          editionId: EDT,
          sourceDocumentId: DOC_ID,
          evidenceId: "NON_EXISTENT_EVIDENCE_ID",
          clauseReference: "Table A-1",
          dataType: "ALLOWABLE_STRESS",
          value: 100 as unknown as T,
          status: "VERIFIED" as const,
        },
      }),
      resolveDataSet: () => ({} as any),
      createLookupFunction: () => (() => undefined),
    };

    const resolution = resolveB31_3ForF01(
      "S",
      { dataId: "SYNTH_DATA_MISSING_EV" },
      { ...env.options, dataResolver: isolatedDataResolver }
    );

    assert(resolution.status === "INVALID", `Expected INVALID for missing evidence, got ${resolution.status}`);
    assert(resolution.verifiedValue === undefined, "verifiedValue must be undefined when evidence is missing");
  });

  // =========================================================================
  // TEST 5 — SOURCE DOCUMENT NON VÉRIFIÉ REFUSÉ
  // =========================================================================
  runTest("Test 5: SourceDocument non vérifié bloqué", () => {
    const env = createTestEnvironment();

    const isolatedDocReg = new NormativeSourceDocumentRegistry();
    isolatedDocReg.register({
      documentId: "UNVERIFIED_DOC_ID",
      standardId: STD,
      editionId: EDT,
      title: "Unverified Doc",
      documentReference: "REF",
      status: "UNVERIFIED",
    });
    const isolatedDocRes = new NormativeSourceDocumentResolver(isolatedDocReg);

    const isolatedDataResolver = {
      resolveData: <T = unknown>() => ({
        dataId: "SYNTH_DATA_UNVERIFIED_DOC",
        status: "FOUND_VERIFIED" as const,
        record: {
          dataId: "SYNTH_DATA_UNVERIFIED_DOC",
          standardId: STD,
          editionId: EDT,
          sourceDocumentId: "UNVERIFIED_DOC_ID",
          evidenceId: EV_STRESS,
          clauseReference: "Table A-1",
          dataType: "ALLOWABLE_STRESS",
          value: 100 as unknown as T,
          status: "VERIFIED" as const,
        },
      }),
      resolveDataSet: () => ({} as any),
      createLookupFunction: () => (() => undefined),
    };

    const resolution = resolveB31_3ForF01(
      "S",
      { dataId: "SYNTH_DATA_UNVERIFIED_DOC" },
      { ...env.options, dataResolver: isolatedDataResolver, sourceDocResolver: isolatedDocRes }
    );

    assert(resolution.status === "INVALID", "Unverified source document must block verification");
    assert(resolution.verifiedValue === undefined, "verifiedValue must be undefined");
  });

  // =========================================================================
  // TEST 6 — MISMATCH STANDARD BLOQUÉ
  // =========================================================================
  runTest("Test 6: Mismatch standard bloqué", () => {
    const env = createTestEnvironment();

    const isolatedDataResolver = {
      resolveData: <T = unknown>() => ({
        dataId: "SYNTH_DATA_MISMATCH_STD",
        status: "FOUND_VERIFIED" as const,
        record: {
          dataId: "SYNTH_DATA_MISMATCH_STD",
          standardId: "OTHER_NON_B313_STANDARD",
          editionId: EDT,
          sourceDocumentId: DOC_ID,
          evidenceId: EV_STRESS,
          clauseReference: "Table A-1",
          dataType: "ALLOWABLE_STRESS",
          value: 100 as unknown as T,
          status: "VERIFIED" as const,
        },
      }),
      resolveDataSet: () => ({} as any),
      createLookupFunction: () => (() => undefined),
    };

    const resolution = resolveB31_3ForF01(
      "S",
      { dataId: "SYNTH_DATA_MISMATCH_STD" },
      { ...env.options, dataResolver: isolatedDataResolver }
    );

    assert(resolution.status === "INVALID", "Standard mismatch must be rejected with INVALID");
    assert(resolution.verifiedValue === undefined, "No verifiedValue on standard mismatch");
  });

  // =========================================================================
  // TEST 7 — MISMATCH ÉDITION BLOQUÉ
  // =========================================================================
  runTest("Test 7: Mismatch édition bloqué", () => {
    const env = createTestEnvironment();

    const isolatedDataResolver = {
      resolveData: <T = unknown>() => ({
        dataId: "SYNTH_DATA_MISMATCH_EDT",
        status: "FOUND_VERIFIED" as const,
        record: {
          dataId: "SYNTH_DATA_MISMATCH_EDT",
          standardId: STD,
          editionId: "WRONG_EDITION_2099",
          sourceDocumentId: DOC_ID,
          evidenceId: EV_STRESS,
          clauseReference: "Table A-1",
          dataType: "ALLOWABLE_STRESS",
          value: 100 as unknown as T,
          status: "VERIFIED" as const,
        },
      }),
      resolveDataSet: () => ({} as any),
      createLookupFunction: () => (() => undefined),
    };

    const resolution = resolveB31_3ForF01(
      "S",
      { dataId: "SYNTH_DATA_MISMATCH_EDT" },
      { ...env.options, dataResolver: isolatedDataResolver }
    );

    assert(resolution.status === "INVALID", "Edition mismatch must be rejected with INVALID");
    assert(resolution.verifiedValue === undefined, "No verifiedValue on edition mismatch");
  });

  // =========================================================================
  // TEST 8 — EVIDENCE IDS CONSERVÉS
  // =========================================================================
  runTest("Test 8: evidenceIds strictement conservés dans le résultat", () => {
    const env = createTestEnvironment();

    const resolution = resolveB31_3ForF01("S", { dataId: DATA_ID_S }, env.options);
    assert(resolution.status === "RESOLVED_VERIFIED", "Status must be RESOLVED_VERIFIED");
    assert(resolution.verifiedValue?.evidenceIds.length === 1, "Must contain exactly 1 evidenceId");
    assert(resolution.verifiedValue?.evidenceIds[0] === EV_STRESS, `Must contain ${EV_STRESS}`);

    const stressInput = createB31_3F01StressInput(
      { dataId: DATA_ID_S },
      { materialReference: "SYNTH_MAT", temperature: 100 },
      env.options
    );
    assert(stressInput.stressInput?.evidenceIds?.includes(EV_STRESS) === true, "evidenceIds preserved in stressInput");
  });

  // =========================================================================
  // TEST 9 — REGISTRE B31.3 VIDE
  // =========================================================================
  runTest("Test 9: Registre de production B31_3_VERIFIED_DATA vide et aucun input F01 produit", () => {
    assert(Array.isArray(B31_3_VERIFIED_DATA), "Must be an array");
    assert(Object.isFrozen(B31_3_VERIFIED_DATA), "Must be frozen");
    assert(B31_3_VERIFIED_DATA.length === 0, "B31_3_VERIFIED_DATA must have length 0");

    // Tentative de résolution sur le registre par défaut (vide)
    const emptyRes = resolveB31_3ForF01("S", { dataId: "ANY_DATA_ID" });
    assert(emptyRes.status === "NOT_FOUND", "Empty production registry must return NOT_FOUND");
    assert(emptyRes.verifiedValue === undefined, "No verifiedValue can be fabricated from empty registry");

    const defaultStressInput = createB31_3F01StressInput(
      { dataId: "ANY_DATA_ID" },
      { materialReference: "A106", temperature: 100 }
    );
    assert(defaultStressInput.status === "NOT_FOUND", "Stress input creation must return NOT_FOUND");
    assert(defaultStressInput.stressInput === undefined, "No stressInput fabricated");
  });

  // =========================================================================
  // TEST 10 — AUCUNE PROMOTION DE STATUT
  // =========================================================================
  runTest("Test 10: Aucune promotion UNVERIFIED → VERIFIED par simple présence de métadonnées", () => {
    const env = createTestEnvironment();

    const resolution = resolveB31_3ForF01("S", { dataId: DATA_ID_UNVERIFIED }, env.options);
    assert(resolution.status === "UNVERIFIED", "Status must remain strictly UNVERIFIED");
    assert(resolution.verifiedValue === undefined, "UNVERIFIED record cannot produce verifiedValue");
  });

  // =========================================================================
  // TEST 11 — AUCUNE CONVERSION D'UNITÉ
  // =========================================================================
  runTest("Test 11: Aucune conversion automatique d'unité", () => {
    const env = createTestEnvironment();

    const resolution = resolveB31_3ForF01("S", { dataId: DATA_ID_S }, env.options);
    assert(resolution.verifiedValue?.value === 137.9, "Value must remain exactly 137.9 without conversion");

    const stressInput = createB31_3F01StressInput(
      { dataId: DATA_ID_S },
      { materialReference: "SYNTH_MAT", temperature: 100, unit: "MPa" },
      env.options
    );
    assert(stressInput.stressInput?.value === 137.9, "Value in stressInput must remain exactly 137.9");
    assert(stressInput.stressInput?.unit === "MPa", "Unit must remain MPa");
  });

  // =========================================================================
  // TEST 12 — DÉTERMINISME
  // =========================================================================
  runTest("Test 12: Déterminisme strict — deux résolutions identiques produisent des résultats identiques", () => {
    const env = createTestEnvironment();

    const res1 = resolveB31_3ForF01("S", { dataId: DATA_ID_S }, env.options);
    const res2 = resolveB31_3ForF01("S", { dataId: DATA_ID_S }, env.options);

    assert(res1.status === res2.status, "Status must match");
    assert(res1.verifiedValue?.value === res2.verifiedValue?.value, "Value must match");
    assert(res1.verifiedValue?.verificationStatus === res2.verifiedValue?.verificationStatus, "VerificationStatus must match");
    assert(res1.verifiedValue?.sourceReference === res2.verifiedValue?.sourceReference, "SourceReference must match");
    assert(
      JSON.stringify(res1.verifiedValue?.evidenceIds) === JSON.stringify(res2.verifiedValue?.evidenceIds),
      "EvidenceIds must match"
    );
  });

  // =========================================================================
  // TEST 13 — EXÉCUTION F01 DE BOUT EN BOUT (CALCULATED)
  // =========================================================================
  runTest("Test 13: Exécution F01 complète avec inputs B31.3 synthétiques 100% vérifiés → CALCULATED", () => {
    const env = createTestEnvironment();

    const sResult = createB31_3F01StressInput(
      { dataId: DATA_ID_S },
      { materialReference: "SYNTH_CARBON_STEEL", temperature: 100 },
      env.options
    );
    const eResult = createB31_3F01QualityFactorInput(
      { dataId: DATA_ID_E },
      { productSpecification: "SYNTH_SPEC" },
      env.options
    );
    const wResult = createB31_3F01WeldReductionFactorInput(
      { dataId: DATA_ID_W },
      { branchId: "W-01", componentType: "SEAMLESS", temperature: 100 },
      env.options
    );
    const yResult = createB31_3F01YCoefficientInput(
      { dataId: DATA_ID_Y },
      { materialFamily: "FERRITIC", temperature: 100 },
      env.options
    );

    assert(sResult.status === "RESOLVED_VERIFIED", "S must be RESOLVED_VERIFIED");
    assert(eResult.status === "RESOLVED_VERIFIED", "E must be RESOLVED_VERIFIED");
    assert(wResult.status === "RESOLVED_VERIFIED", "W must be RESOLVED_VERIFIED");
    assert(yResult.status === "RESOLVED_VERIFIED", "Y must be RESOLVED_VERIFIED");

    const calculationInput: EngineeringCalculationInput = {
      designCodeId: "ASME-B31.3",
      standardEdition: { year: "2024" },
      calculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "SI",
      pressure: 2.0, // 2 MPa
      temperature: 100, // 100 °C
      outsideDiameterMm: 114.3, // 114.3 mm
      corrosionAllowanceMm: 1.5,
      diameterBasis: "OUTSIDE",
      componentType: "SEAMLESS",
      materialFamily: "FERRITIC",
      materialId: "SYNTH_CARBON_STEEL",
      allowableStressInput: sResult.stressInput,
      qualityFactorInput: eResult.qualityFactorInput,
      weldReductionFactorInput: wResult.weldReductionFactorInput,
      yCoefficientInput: yResult.yCoefficientInput,
      evidenceItems: [
        env.evStress,
        env.evE,
        env.evW,
        env.evY,
      ],
    };

    const calcResult = executeEngineeringCalculation(calculationInput);

    assert(calcResult.status === "CALCULATED", `Expected CALCULATED, got ${calcResult.status}: ${calcResult.errors.join("; ")}`);
    assert(typeof calcResult.value === "number" && calcResult.value > 0, "Calculated t must be positive number");
    assert(typeof calcResult.minimumRequiredThicknessMm === "number" && calcResult.minimumRequiredThicknessMm > calcResult.value, "tm must exceed t (t + c)");
    assert(calcResult.resolvedFactors?.S?.valueVerified === true, "S factor must be valueVerified");
    assert(calcResult.resolvedFactors?.E?.valueVerified === true, "E factor must be valueVerified");
    assert(calcResult.resolvedFactors?.W?.valueVerified === true, "W factor must be valueVerified");
    assert(calcResult.resolvedFactors?.Y?.valueVerified === true, "Y factor must be valueVerified");
  });

  // =========================================================================
  // TEST 14 — EXÉCUTION F01 AVEC FACTEUR NON VÉRIFIÉ (UNVERIFIED)
  // =========================================================================
  runTest("Test 14: Exécution F01 avec un facteur B31.3 non vérifié → UNVERIFIED", () => {
    const env = createTestEnvironment();

    const calculationInput: EngineeringCalculationInput = {
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
      materialFamily: "FERRITIC",
      materialId: "SYNTH_CARBON_STEEL",
      allowableStressInput: {
        value: 137.9,
        // verifiedValue intentionally omitted to simulate raw/unverified input
      },
      qualityFactorInput: {
        factorValue: 1.0,
      },
      weldReductionFactorInput: {
        factorValue: 1.0,
      },
      yCoefficientInput: {
        factorValue: 0.4,
      },
      evidenceItems: [],
    };

    const calcResult = executeEngineeringCalculation(calculationInput);
    assert(calcResult.status === "UNVERIFIED", `Expected UNVERIFIED, got ${calcResult.status}`);
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}

/**
 * PDI NORMATIVE ENGINE — ASME B31.3-07 FINAL AUDIT & RELEASE LOCK SUITE
 * Reference: B31.3-07 (Final Audit & Release Lock)
 * 
 * Exécute l'audit final et le verrouillage de conformité sur l'ensemble de la chaîne :
 * SourceDocument → Evidence → Qualification → VerifiedValue → CalculationBoundary → F01.
 */
export function runB31_3_07AuditTests(): B31_3F01TestResult {
  const results: string[] = [];
  let testsRun = 0;

  function runAudit(checkName: string, fn: () => void): void {
    testsRun++;
    try {
      fn();
      results.push(`✅ AUDIT PASS ${testsRun}: ${checkName}`);
    } catch (err: any) {
      results.push(`❌ AUDIT FAIL ${testsRun}: ${checkName} -> ${err.message}`);
      throw err;
    }
  }

  // 1. Audit B31_3_VERIFIED_DATA
  runAudit("Audit 1: Production registry B31_3_VERIFIED_DATA is empty and frozen", () => {
    assert(Array.isArray(B31_3_VERIFIED_DATA), "Must be an array");
    assert(Object.isFrozen(B31_3_VERIFIED_DATA), "Must be frozen");
    assert(B31_3_VERIFIED_DATA.length === 0, "B31_3_VERIFIED_DATA length must be 0");
  });

  // 2. Audit Anti-Invention
  runAudit("Audit 2: Anti-invention check — no invented normative data in production registry", () => {
    for (const item of B31_3_VERIFIED_DATA) {
      assert(!item.dataId.startsWith("SYNTHETIC_"), "No synthetic data in production");
      assert(!item.dataId.startsWith("TEST_"), "No test data in production");
      assert(!item.dataId.startsWith("FAKE_"), "No fake data in production");
    }
  });

  // 3. Audit SourceDocument Chain
  runAudit("Audit 3: SourceDocument chain integrity enforced", () => {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);

    // Document non présent dans le registre
    evReg.register({
      evidenceId: "EV_AUDIT_01",
      standardId: "STD_AUDIT",
      editionId: "2026",
      sourceDocumentId: "MISSING_DOC_01",
      clauseReference: "Clause 1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    let caught = false;
    try {
      dataReg.register({
        dataId: "DATA_AUDIT_01",
        standardId: "STD_AUDIT",
        editionId: "2026",
        sourceDocumentId: "MISSING_DOC_01",
        evidenceId: "EV_AUDIT_01",
        clauseReference: "Clause 1",
        dataType: "STRESS",
        value: 100,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must block VERIFIED record when SourceDocument is absent");
  });

  // 4. Audit Evidence Chain
  runAudit("Audit 4: Evidence chain integrity enforced", () => {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);

    docReg.register({
      documentId: "DOC_AUDIT_02",
      standardId: "STD_AUDIT",
      editionId: "2026",
      title: "Doc",
      documentReference: "REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    // Evidence non présente dans le registre
    let caught = false;
    try {
      dataReg.register({
        dataId: "DATA_AUDIT_02",
        standardId: "STD_AUDIT",
        editionId: "2026",
        sourceDocumentId: "DOC_AUDIT_02",
        evidenceId: "MISSING_EV_02",
        clauseReference: "Clause 2",
        dataType: "STRESS",
        value: 100,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must block VERIFIED record when Evidence is absent");
  });

  // 5. Audit VerifiedValue Boundary
  runAudit("Audit 5: VerifiedValue boundary — only complete evidence chain produces valid NormativeVerifiedValue", () => {
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);

    const invalidValue: NormativeVerifiedValue<number> = {
      value: 150,
      verificationStatus: "VERIFIED",
      evidenceIds: ["NON_EXISTENT_EV"],
    };

    const boundaryRes = resolveNormativeCalculationInput({ name: "S", verifiedValue: invalidValue }, evRes);
    assert(!boundaryRes.valid, "Calculation boundary must reject NormativeVerifiedValue with unresolvable evidence");
  });

  // 6. Audit Calculation Boundary (No Raw Bypass)
  runAudit("Audit 6: Calculation boundary blocks raw numeric bypass", () => {
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);

    const rawInput = {
      name: "S",
      verifiedValue: {
        value: 120,
        verificationStatus: "UNVERIFIED" as const,
        evidenceIds: [],
      },
    };

    const resS = resolvePressureDesignStress(rawInput, evRes);
    assert(!resS.valid, "resolvePressureDesignStress must reject raw unverified input");

    const resE = resolveWeldQualityFactor({ name: "E", verifiedValue: rawInput.verifiedValue }, evRes);
    assert(!resE.valid, "resolveWeldQualityFactor must reject raw unverified input");

    const resW = resolveWeldReductionFactor({ name: "W", verifiedValue: rawInput.verifiedValue }, evRes);
    assert(!resW.valid, "resolveWeldReductionFactor must reject raw unverified input");

    const resY = resolveYCoefficient({ name: "Y", verifiedValue: rawInput.verifiedValue }, evRes);
    assert(!resY.valid, "resolveYCoefficient must reject raw unverified input");
  });

  // 7. Audit F01 Integrity
  runAudit("Audit 7: F01 formula and safety guardrail integrity verified", () => {
    // Exécution avec inputs valides vérifiés pour confirmer que F01 fonctionne
    const calculationInput: EngineeringCalculationInput = {
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
      materialFamily: "FERRITIC",
      materialId: "SYNTH_MATERIAL",
      allowableStressInput: {
        value: 137.9,
        materialReference: "SYNTH_MATERIAL",
        temperature: 100,
        unit: "MPa",
        sourceReference: "SYNTH_REF",
        qualificationStatus: "VERIFIED",
        verifiedValue: { value: 137.9, verificationStatus: "VERIFIED", evidenceIds: ["EV_F01_AUDIT"] },
      },
      qualityFactorInput: {
        factorValue: 1.0,
        productSpecification: "SYNTH_SPEC",
        sourceReference: "SYNTH_REF",
        qualificationStatus: "VERIFIED",
        verifiedValue: { value: 1.0, verificationStatus: "VERIFIED", evidenceIds: ["EV_F01_AUDIT"] },
      },
      weldReductionFactorInput: {
        factorValue: 1.0,
        branchId: "W-01",
        componentType: "SEAMLESS",
        sourceReference: "SYNTH_REF",
        qualificationStatus: "VERIFIED",
        verifiedValue: { value: 1.0, verificationStatus: "VERIFIED", evidenceIds: ["EV_F01_AUDIT"] },
      },
      yCoefficientInput: {
        factorValue: 0.4,
        materialFamily: "FERRITIC",
        temperature: 100,
        sourceReference: "SYNTH_REF",
        qualificationStatus: "VERIFIED",
        verifiedValue: { value: 0.4, verificationStatus: "VERIFIED", evidenceIds: ["EV_F01_AUDIT"] },
      },
      evidenceItems: [
        {
          evidenceId: "EV_F01_AUDIT",
          standardId: "ASME-B31.3",
          editionId: "2024",
          clauseReference: "Clause",
          sourceType: "VERIFIED_INTERNAL_REFERENCE",
          sourceReference: "REF",
          verificationStatus: "VERIFIED",
          verifiedBy: "AUDITOR",
          verifiedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    const result = executeEngineeringCalculation(calculationInput);
    assert(result.status === "CALCULATED", "F01 must calculate when fully verified");
    assert(typeof result.value === "number" && result.value > 0, "Calculated thickness must be positive");
    assert(
      result.minimumRequiredThicknessMm === result.value! + 1.5,
      "tm must equal t + c exactly"
    );

    // Guardrail test: P / (S * E) > 0.385 must trigger OUT_OF_SCOPE / specialized design required
    const highPressureInput: EngineeringCalculationInput = {
      ...calculationInput,
      pressure: 60.0, // 60 / (137.9 * 1.0) = 0.435 > 0.385
    };
    const guardrailResult = executeEngineeringCalculation(highPressureInput);
    assert(
      guardrailResult.status === "UNVERIFIED" || guardrailResult.status === "OUT_OF_SCOPE",
      "P/(S*E) > 0.385 guardrail must block standard Eq 3a calculation"
    );
  });

  // 8. Audit No Status Promotion
  runAudit("Audit 8: Status promotion impossible — UNVERIFIED never promoted to VERIFIED", () => {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);

    docReg.register({
      documentId: "DOC_UNVERIFIED",
      standardId: "STD",
      editionId: "EDT",
      title: "Doc",
      documentReference: "REF",
      status: "UNVERIFIED",
    });

    evReg.register({
      evidenceId: "EV_UNVERIFIED",
      standardId: "STD",
      editionId: "EDT",
      clauseReference: "C",
      sourceType: "LEGACY_REFERENCE",
      sourceReference: "REF",
      verificationStatus: "UNVERIFIED",
    });

    dataReg.register({
      dataId: "DATA_UNVERIFIED",
      standardId: "STD",
      editionId: "EDT",
      sourceDocumentId: "DOC_UNVERIFIED",
      evidenceId: "EV_UNVERIFIED",
      clauseReference: "C",
      dataType: "STRESS",
      value: 100,
      status: "UNVERIFIED",
    });

    const res = integrateB31_3Data(
      { dataId: "DATA_UNVERIFIED" },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );
    assert(res.status === "UNVERIFIED", "Status must remain UNVERIFIED");
    assert(res.verifiedValue?.verificationStatus === "UNVERIFIED", "verifiedValue status must remain UNVERIFIED");
  });

  // 9. Audit No Silent Unit Conversion
  runAudit("Audit 9: No silent unit conversion", () => {
    const rawValue = 137.9;
    const rawUnit = "MPa";

    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);

    docReg.register({
      documentId: "DOC_UNIT",
      standardId: "STD",
      editionId: "EDT",
      title: "Doc",
      documentReference: "REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: "EV_UNIT",
      standardId: "STD",
      editionId: "EDT",
      sourceDocumentId: "DOC_UNIT",
      clauseReference: "C",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: "DATA_UNIT",
      standardId: "STD",
      editionId: "EDT",
      sourceDocumentId: "DOC_UNIT",
      evidenceId: "EV_UNIT",
      clauseReference: "C",
      dataType: "STRESS",
      value: rawValue,
      unit: rawUnit,
      status: "VERIFIED",
    });

    const res = integrateB31_3Data<number>(
      { dataId: "DATA_UNIT" },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );
    assert(res.value === rawValue, "Value must remain exactly rawValue without conversion");
    assert(res.verifiedValue?.value === rawValue, "VerifiedValue value must match rawValue");
  });

  // 10. Audit Determinism & Immutability
  runAudit("Audit 10: Determinism — repeat executions return identical results without side effects", () => {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);

    docReg.register({
      documentId: "DOC_DET",
      standardId: "STD",
      editionId: "EDT",
      title: "Doc",
      documentReference: "REF",
      status: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: "EV_DET",
      standardId: "STD",
      editionId: "EDT",
      sourceDocumentId: "DOC_DET",
      clauseReference: "C",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: "DATA_DET",
      standardId: "STD",
      editionId: "EDT",
      sourceDocumentId: "DOC_DET",
      evidenceId: "EV_DET",
      clauseReference: "C",
      dataType: "STRESS",
      value: 125,
      status: "VERIFIED",
    });

    const run1 = integrateB31_3Data(
      { dataId: "DATA_DET" },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );
    const run2 = integrateB31_3Data(
      { dataId: "DATA_DET" },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );

    assert(JSON.stringify(run1) === JSON.stringify(run2), "Sequential runs must be bitwise identical");
  });

  // 11. Audit Full Traceability
  runAudit("Audit 11: Full traceability chain preserved from SourceDocument to calculation input", () => {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);

    docReg.register({
      documentId: "DOC_TRACE",
      standardId: "ASME-B31.3",
      editionId: "2024",
      title: "Trace Doc",
      documentReference: "ASME B31.3 2024",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_TRACE",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: "EV_TRACE",
      standardId: "ASME-B31.3",
      editionId: "2024",
      sourceDocumentId: "DOC_TRACE",
      clauseReference: "Table A-1 §302.3",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "TABLE_A1_REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_TRACE",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: "DATA_TRACE",
      standardId: "ASME-B31.3",
      editionId: "2024",
      sourceDocumentId: "DOC_TRACE",
      evidenceId: "EV_TRACE",
      clauseReference: "Table A-1 §302.3",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      unit: "MPa",
      status: "VERIFIED",
    });

    const intRes = integrateB31_3Data(
      { dataId: "DATA_TRACE" },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );

    assert(intRes.dataId === "DATA_TRACE", "dataId preserved");
    assert(intRes.standardId === "ASME-B31.3", "standardId preserved");
    assert(intRes.editionId === "2024", "editionId preserved");
    assert(intRes.sourceDocumentId === "DOC_TRACE", "sourceDocumentId preserved");
    assert(intRes.evidenceId === "EV_TRACE", "evidenceId preserved");
    assert(intRes.clauseReference === "Table A-1 §302.3", "clauseReference preserved");
  });

  const success = results.every((r) => r.startsWith("✅ AUDIT PASS"));

  return {
    success,
    testsRun,
    results,
  };
}

