/**
 * PDI NORMATIVE ENGINE — ASME B31.3 CONTROLLED INTEGRATION BOUNDARY TESTS
 * Reference: B31.3-04 (Controlled Normative Integration Boundary)
 * 
 * Suite de tests validant la première frontière d'intégration contrôlée entre :
 *   B31.3 SourceDocument
 *           ↓
 *   B31.3 Evidence
 *           ↓
 *   B31.3 Qualification
 *           ↓
 *   B31.3 Verified Data
 *           ↓
 *   NormativeVerifiedValue<T>
 *           ↓
 *   NormativeCalculationBoundary
 * 
 * RÈGLE FONDAMENTALE (B31.3-04) :
 * - Utilisation EXCLUSIVE de fixtures synthétiques (`SYNTHETIC_*`).
 * - AUCUNE valeur normative réelle ou inventée n'est utilisée.
 * - `B31_3_VERIFIED_DATA` reste vide.
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
  type IB31_3DataResolver,
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
} from "../types/normativeEvidenceTypes";
import {
  integrateB31_3Data,
  createB31_3CalculationBoundaryInput,
  resolveB31_3ToCalculationBoundary,
  B31_3Integration,
} from "../data/b31_3/b31_3Integration";
import {
  resolveNormativeCalculationInput,
  requireVerifiedNormativeCalculationInput,
  resolvePressureDesignStress,
  resolveWeldQualityFactor,
  resolveYCoefficient,
} from "../validators/normativeCalculationBoundary";

export interface B31_3IntegrationTestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[B31.3-04 ASSERTION FAILED] ${message}`);
  }
}

export function runB31_3IntegrationTests(): B31_3IntegrationTestResult {
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

  // Identifiants synthétiques
  const SYNTH_STD = "SYNTHETIC_STANDARD_B313_04";
  const SYNTH_EDT = "SYNTHETIC_EDITION_2026";
  const SYNTH_DOC_ID = "SYNTHETIC_DOC_B313_04_001";
  const SYNTH_EV_ID_A = "SYNTHETIC_EV_B313_04_001";
  const SYNTH_EV_ID_B = "SYNTHETIC_EV_B313_04_002";
  const SYNTH_EV_UNVERIFIED_ID = "SYNTHETIC_EV_UNVERIFIED_04";
  const SYNTH_DATA_ID_VERIFIED = "SYNTHETIC_DATA_RECORD_VERIFIED_001";
  const SYNTH_DATA_ID_STRESS = "SYNTHETIC_DATA_RECORD_STRESS_002";
  const SYNTH_DATA_ID_UNVERIFIED = "SYNTHETIC_DATA_RECORD_UNVERIFIED_003";

  // Configuration de l'environnement de test synthétique
  const docReg = new NormativeSourceDocumentRegistry();
  const docRes = new NormativeSourceDocumentResolver(docReg);
  const evReg = new NormativeEvidenceRegistry();
  const evRes = new NormativeEvidenceResolver(evReg);
  const dataReg = new B31_3DataRegistry(docRes, evRes);
  const dataRes = new B31_3DataResolver(dataReg);

  const integrationOptions = {
    dataResolver: dataRes,
    sourceDocResolver: docRes,
    evidenceResolver: evRes,
  };

  const integrationService = new B31_3Integration(dataRes, docRes, evRes);

  // Fixture SourceDocument VERIFIED
  const synthDocVerified: NormativeSourceDocument = {
    documentId: SYNTH_DOC_ID,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    title: "Synthetic Test Normative Standard Specification",
    publisher: "SYNTHETIC_PUBLISHER",
    documentReference: "SYNTHETIC_REF_DOC_001",
    status: "VERIFIED",
    verifiedBy: "SYNTHETIC_INSPECTOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  };
  docReg.register(synthDocVerified);

  // Fixture Evidence VERIFIED
  const synthEvVerifiedA: NormativeEvidence = {
    evidenceId: SYNTH_EV_ID_A,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    sourceDocumentId: SYNTH_DOC_ID,
    clauseReference: "Table S-1",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_REF_EV_A",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_INSPECTOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  };
  evReg.register(synthEvVerifiedA);

  const synthEvVerifiedB: NormativeEvidence = {
    evidenceId: SYNTH_EV_ID_B,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    sourceDocumentId: SYNTH_DOC_ID,
    clauseReference: "Para 304.1.2",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_REF_EV_B",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_INSPECTOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  };
  evReg.register(synthEvVerifiedB);

  // Fixture Evidence UNVERIFIED
  const synthEvUnverified: NormativeEvidence = {
    evidenceId: SYNTH_EV_UNVERIFIED_ID,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    sourceDocumentId: SYNTH_DOC_ID,
    clauseReference: "Para 302.3.2",
    sourceType: "LEGACY_REFERENCE",
    sourceReference: "SYNTHETIC_REF_UNVERIFIED",
    verificationStatus: "UNVERIFIED",
  };
  evReg.register(synthEvUnverified);

  // Fixture DataRecord VERIFIED (Allowable stress)
  const synthRecordStress: B31_3NormativeDataRecord<number> = {
    dataId: SYNTH_DATA_ID_STRESS,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    sourceDocumentId: SYNTH_DOC_ID,
    evidenceId: SYNTH_EV_ID_A,
    clauseReference: "Table S-1",
    dataType: "ALLOWABLE_STRESS",
    value: 137.9,
    unit: "MPa",
    status: "VERIFIED",
  };
  dataReg.register(synthRecordStress);

  // Fixture DataRecord VERIFIED (Y coefficient)
  const synthRecordY: B31_3NormativeDataRecord<number> = {
    dataId: SYNTH_DATA_ID_VERIFIED,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    sourceDocumentId: SYNTH_DOC_ID,
    evidenceId: SYNTH_EV_ID_B,
    clauseReference: "Para 304.1.2",
    dataType: "Y_COEFFICIENT",
    value: 0.4,
    status: "VERIFIED",
  };
  dataReg.register(synthRecordY);

  // Fixture DataRecord UNVERIFIED
  const synthRecordUnverified: B31_3NormativeDataRecord<number> = {
    dataId: SYNTH_DATA_ID_UNVERIFIED,
    standardId: SYNTH_STD,
    editionId: SYNTH_EDT,
    sourceDocumentId: SYNTH_DOC_ID,
    evidenceId: SYNTH_EV_UNVERIFIED_ID,
    clauseReference: "Para 302.3.2",
    dataType: "QUALITY_FACTOR",
    value: 0.85,
    status: "UNVERIFIED",
  };
  dataReg.register(synthRecordUnverified);

  // =========================================================================
  // SECTION 1 : NON-INVENTION NORMATIVE & B31_3_VERIFIED_DATA
  // =========================================================================

  runTest("TEST 1: B31_3_VERIFIED_DATA est strictement vide et gelé (non-invention)", () => {
    assert(Array.isArray(B31_3_VERIFIED_DATA), "B31_3_VERIFIED_DATA must be an array");
    assert(Object.isFrozen(B31_3_VERIFIED_DATA), "B31_3_VERIFIED_DATA must be frozen");
    assert(B31_3_VERIFIED_DATA.length === 0, "B31_3_VERIFIED_DATA must be empty (length 0)");
  });

  // =========================================================================
  // SECTION 2 : CAS 1 — DONNÉE VÉRIFIÉE (RESOLVED_VERIFIED)
  // =========================================================================

  runTest("TEST 2: integrateB31_3Data résout avec succès un record vérifié (RESOLVED_VERIFIED)", () => {
    const res = integrateB31_3Data<number>(
      { dataId: SYNTH_DATA_ID_STRESS },
      integrationOptions
    );

    assert(res.status === "RESOLVED_VERIFIED", `Expected RESOLVED_VERIFIED but got ${res.status}`);
    assert(res.dataId === SYNTH_DATA_ID_STRESS, "dataId must match");
    assert(res.value === 137.9, "value must be 137.9");
    assert(res.standardId === SYNTH_STD, "standardId must match");
    assert(res.editionId === SYNTH_EDT, "editionId must match");
    assert(res.sourceDocumentId === SYNTH_DOC_ID, "sourceDocumentId must match");
    assert(res.evidenceId === SYNTH_EV_ID_A, "evidenceId must match");
    assert(res.clauseReference === "Table S-1", "clauseReference must match");
    assert(res.verifiedValue !== undefined, "verifiedValue must be defined");
    assert(res.verifiedValue?.verificationStatus === "VERIFIED", "verifiedValue status must be VERIFIED");
    assert(res.verifiedValue?.value === 137.9, "verifiedValue value must match");
    assert(res.verifiedValue?.evidenceIds.includes(SYNTH_EV_ID_A) === true, "evidenceIds must include evidence");
  });

  runTest("TEST 3: Traçabilité complète et formatage de la référence source", () => {
    const res = integrateB31_3Data<number>(
      { dataId: SYNTH_DATA_ID_VERIFIED },
      integrationOptions
    );

    assert(res.status === "RESOLVED_VERIFIED", "Expected RESOLVED_VERIFIED");
    assert(res.value === 0.4, "value must match");
    assert(
      res.verifiedValue?.sourceReference?.includes(SYNTH_STD) === true,
      "sourceReference must contain standardId"
    );
    assert(
      res.verifiedValue?.sourceReference?.includes("Para 304.1.2") === true,
      "sourceReference must contain clause"
    );
  });

  // =========================================================================
  // SECTION 3 : FRONTIÈRE DE CALCUL (CALCULATION BOUNDARY)
  // =========================================================================

  runTest("TEST 4: createB31_3CalculationBoundaryInput prépare un input valide pour le boundary", () => {
    const { boundaryInput, integrationResult } = createB31_3CalculationBoundaryInput<number>(
      "allowableStress",
      { dataId: SYNTH_DATA_ID_STRESS },
      integrationOptions
    );

    assert(integrationResult.status === "RESOLVED_VERIFIED", "Status must be RESOLVED_VERIFIED");
    assert(boundaryInput !== undefined, "boundaryInput must be defined");
    assert(boundaryInput?.name === "allowableStress", "boundaryInput name must match");
    assert(boundaryInput?.verifiedValue.value === 137.9, "boundaryInput value must match");
    assert(boundaryInput?.verifiedValue.verificationStatus === "VERIFIED", "boundaryInput status must be VERIFIED");
  });

  runTest("TEST 5: resolveB31_3ToCalculationBoundary évalue avec succès une donnée vérifiée", () => {
    const calcResult = resolveB31_3ToCalculationBoundary<number>(
      "designStress",
      { dataId: SYNTH_DATA_ID_STRESS },
      integrationOptions
    );

    assert(calcResult.integrationResult.status === "RESOLVED_VERIFIED", "Integration status must be RESOLVED_VERIFIED");
    assert(calcResult.boundaryResult.valid === true, "Boundary result must be valid");
    assert(calcResult.boundaryResult.value === 137.9, "Boundary result value must match 137.9");
    assert(calcResult.boundaryResult.error === undefined, "Boundary result error must be undefined");
  });

  runTest("TEST 6: Évaluation via les helpers spécifiques de calculation boundary (resolvePressureDesignStress)", () => {
    const { boundaryInput } = createB31_3CalculationBoundaryInput<number>(
      "S",
      { dataId: SYNTH_DATA_ID_STRESS },
      integrationOptions
    );

    assert(boundaryInput !== undefined, "boundaryInput must be defined");
    const stressResult = resolvePressureDesignStress(boundaryInput!, evRes);
    assert(stressResult.valid === true, "stressResult must be valid");
    assert(stressResult.value === 137.9, "stressResult value must be 137.9");
  });

  runTest("TEST 7: Évaluation via requireVerifiedNormativeCalculationInput", () => {
    const { boundaryInput } = createB31_3CalculationBoundaryInput<number>(
      "Y",
      { dataId: SYNTH_DATA_ID_VERIFIED },
      integrationOptions
    );

    assert(boundaryInput !== undefined, "boundaryInput must be defined");
    const yVal = requireVerifiedNormativeCalculationInput(boundaryInput!, evRes);
    assert(yVal === 0.4, `Expected 0.4, got ${yVal}`);
  });

  // =========================================================================
  // SECTION 4 : CAS 2 — DONNÉE NON VÉRIFIÉE (UNVERIFIED)
  // =========================================================================

  runTest("TEST 8: Record avec statut UNVERIFIED renvoie UNVERIFIED et ne franchit pas le boundary", () => {
    const res = integrateB31_3Data<number>(
      { dataId: SYNTH_DATA_ID_UNVERIFIED },
      integrationOptions
    );

    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got ${res.status}`);
    assert(res.dataId === SYNTH_DATA_ID_UNVERIFIED, "dataId must match");
    assert(res.verifiedValue?.verificationStatus === "UNVERIFIED", "verifiedValue must be UNVERIFIED");

    // Tentative de passage de la frontière de calcul
    const boundaryCheck = resolveB31_3ToCalculationBoundary<number>(
      "qualityFactor",
      { dataId: SYNTH_DATA_ID_UNVERIFIED },
      integrationOptions
    );

    assert(boundaryCheck.boundaryResult.valid === false, "UNVERIFIED data must be rejected by calculation boundary");
    assert(boundaryCheck.boundaryInput === undefined, "boundaryInput must be undefined for UNVERIFIED data");
  });

  runTest("TEST 9: requireVerifiedNormativeCalculationInput lève une exception sur donnée UNVERIFIED", () => {
    const res = integrateB31_3Data<number>(
      { dataId: SYNTH_DATA_ID_UNVERIFIED },
      integrationOptions
    );

    assert(res.verifiedValue !== undefined, "verifiedValue present as unverified container");
    let caught = false;
    try {
      requireVerifiedNormativeCalculationInput(
        { name: "E", verifiedValue: res.verifiedValue! },
        evRes
      );
    } catch {
      caught = true;
    }
    assert(caught, "Must throw on UNVERIFIED value in requireVerifiedNormativeCalculationInput");
  });

  // =========================================================================
  // SECTION 5 : CAS 3 — DONNÉE INTROUVABLE (NOT_FOUND)
  // =========================================================================

  runTest("TEST 10: dataId inexistant renvoie NOT_FOUND", () => {
    const res = integrateB31_3Data<number>(
      { dataId: "SYNTHETIC_DATA_RECORD_NON_EXISTENT" },
      integrationOptions
    );

    assert(res.status === "NOT_FOUND", `Expected NOT_FOUND, got ${res.status}`);
    assert(res.value === undefined, "value must be undefined");
    assert(res.verifiedValue === undefined, "verifiedValue must be undefined");
    assert(res.message.includes("not found"), "message must indicate not found");

    const boundaryCheck = resolveB31_3ToCalculationBoundary<number>(
      "missing",
      { dataId: "SYNTHETIC_DATA_RECORD_NON_EXISTENT" },
      integrationOptions
    );
    assert(boundaryCheck.boundaryResult.valid === false, "NOT_FOUND must fail boundary");
    assert(boundaryCheck.boundaryResult.error === "DATA_NOT_FOUND", "Error must be DATA_NOT_FOUND");
  });

  // =========================================================================
  // SECTION 6 : CAS 4 — REQUÊTE ET DONNÉE INVALIDES (INVALID)
  // =========================================================================

  runTest("TEST 11: dataId vide renvoie INVALID", () => {
    const res1 = integrateB31_3Data({ dataId: "" }, integrationOptions);
    assert(res1.status === "INVALID", "Empty dataId must return INVALID");

    const res2 = integrateB31_3Data({ dataId: "   " }, integrationOptions);
    assert(res2.status === "INVALID", "Whitespace dataId must return INVALID");
  });

  runTest("TEST 12: Token heuristique interdit renvoie INVALID", () => {
    const tokens = ["MAT_CS_A106", "_CS_", "CS_PIPE", "CARBON_STEEL_01", "CRMO", "AUSTENITIC"];
    for (const tok of tokens) {
      const res = integrateB31_3Data({ dataId: tok }, integrationOptions);
      assert(res.status === "INVALID", `Heuristic token '${tok}' must return INVALID`);
      assert(res.value === undefined, "value must be undefined for heuristic token");
    }
  });

  runTest("TEST 13: Requête null ou non-objet renvoie INVALID", () => {
    const resNull = integrateB31_3Data(null as any, integrationOptions);
    assert(resNull.status === "INVALID", "null request must return INVALID");

    const resArr = integrateB31_3Data([] as any, integrationOptions);
    assert(resArr.status === "INVALID", "Array request must return INVALID");
  });

  // =========================================================================
  // SECTION 7 : VALIDATION DE RUPTURE DE GOUVERNANCE
  // =========================================================================

  runTest("TEST 14: Donnée VERIFIED avec SourceDocument orphelin renvoie INVALID", () => {
    // Créer un registre isolé avec record pointant vers doc inexistant
    const isolatedDocReg = new NormativeSourceDocumentRegistry();
    const isolatedDocRes = new NormativeSourceDocumentResolver(isolatedDocReg);
    const isolatedEvReg = new NormativeEvidenceRegistry();
    const isolatedEvRes = new NormativeEvidenceResolver(isolatedEvReg);

    // Enregistrer l'évidence mais PAS le document source
    isolatedEvReg.register({
      evidenceId: "SYNTH_EV_ISOLATED_01",
      standardId: SYNTH_STD,
      editionId: SYNTH_EDT,
      clauseReference: "Para 304.1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "SYNTHETIC_AUDITOR",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    });

    // Mock direct d'un résolveur contenant un record non conforme
    const mockDataResolver: IB31_3DataResolver = {
      resolveData: <T = unknown>() => ({
        dataId: "SYNTH_CORRUPT_RECORD",
        status: "FOUND_VERIFIED" as const,
        record: {
          dataId: "SYNTH_CORRUPT_RECORD",
          standardId: SYNTH_STD,
          editionId: SYNTH_EDT,
          sourceDocumentId: "NON_EXISTENT_DOC",
          evidenceId: "SYNTH_EV_ISOLATED_01",
          clauseReference: "Para 304.1",
          dataType: "PRESSURE",
          value: 10 as unknown as T,
          status: "VERIFIED" as const,
        },
      }),
      resolveDataSet: () => ({} as any),
      createLookupFunction: () => (() => undefined),
    };

    const res = integrateB31_3Data(
      { dataId: "SYNTH_CORRUPT_RECORD" },
      {
        dataResolver: mockDataResolver,
        sourceDocResolver: isolatedDocRes,
        evidenceResolver: isolatedEvRes,
      }
    );

    assert(res.status === "INVALID", `Expected INVALID for missing source document, got ${res.status}`);
  });

  runTest("TEST 15: Donnée VERIFIED avec mismatch standardId/editionId renvoie INVALID", () => {
    const mockDataResolver: IB31_3DataResolver = {
      resolveData: <T = unknown>() => ({
        dataId: "SYNTH_MISMATCH_RECORD",
        status: "FOUND_VERIFIED" as const,
        record: {
          dataId: "SYNTH_MISMATCH_RECORD",
          standardId: "DIFFERENT_STANDARD",
          editionId: SYNTH_EDT,
          sourceDocumentId: SYNTH_DOC_ID,
          evidenceId: SYNTH_EV_ID_A,
          clauseReference: "Table S-1",
          dataType: "ALLOWABLE_STRESS",
          value: 100 as unknown as T,
          status: "VERIFIED" as const,
        },
      }),
      resolveDataSet: () => ({} as any),
      createLookupFunction: () => (() => undefined),
    };

    const res = integrateB31_3Data(
      { dataId: "SYNTH_MISMATCH_RECORD" },
      { ...integrationOptions, dataResolver: mockDataResolver }
    );

    assert(res.status === "INVALID", "Mismatch standardId must return INVALID");
  });

  // =========================================================================
  // SECTION 8 : SERVICE B31_3Integration & ÉQUIVALENCE
  // =========================================================================

  runTest("TEST 16: Classe B31_3Integration équivalente aux fonctions fonctionnelles", () => {
    const resClass = integrationService.integrate<number>({ dataId: SYNTH_DATA_ID_STRESS });
    const resFunc = integrateB31_3Data<number>({ dataId: SYNTH_DATA_ID_STRESS }, integrationOptions);

    assert(resClass.status === resFunc.status, "Status must match");
    assert(resClass.value === resFunc.value, "Value must match");
    assert(resClass.dataId === resFunc.dataId, "dataId must match");

    const boundaryClass = integrationService.resolveToCalculationBoundary<number>(
      "stress",
      { dataId: SYNTH_DATA_ID_STRESS }
    );
    assert(boundaryClass.boundaryResult.valid === true, "Class boundary evaluation must be valid");
    assert(boundaryClass.boundaryResult.value === 137.9, "Class boundary evaluation value must match");
  });

  runTest("TEST 17: Immuabilité et pureté — les résultats retournés sont gelés et reproductibles", () => {
    const res1 = integrateB31_3Data<number>({ dataId: SYNTH_DATA_ID_STRESS }, integrationOptions);
    const res2 = integrateB31_3Data<number>({ dataId: SYNTH_DATA_ID_STRESS }, integrationOptions);

    assert(res1.status === res2.status, "Status must be identical across calls");
    assert(res1.value === res2.value, "Value must be identical across calls");
    assert(res1.verifiedValue?.verificationStatus === res2.verifiedValue?.verificationStatus, "Verified status must be identical");
  });

  // =========================================================================
  // SECTION 9 : INTÉGRATION AVEC LE PIPELINE DE CALCUL (F01 / DESIGN CODE)
  // =========================================================================

  runTest("TEST 18: Frontière de calcul de bout en bout — validation de conformité stricte", () => {
    // Intégrer la contrainte admissible S et le coefficient Y
    const stressInt = integrateB31_3Data<number>({ dataId: SYNTH_DATA_ID_STRESS }, integrationOptions);
    const yInt = integrateB31_3Data<number>({ dataId: SYNTH_DATA_ID_VERIFIED }, integrationOptions);

    assert(stressInt.status === "RESOLVED_VERIFIED", "Stress integration must be RESOLVED_VERIFIED");
    assert(yInt.status === "RESOLVED_VERIFIED", "Y integration must be RESOLVED_VERIFIED");

    // Vérifier que les deux valeurs traversent la frontière
    const sBoundary = resolvePressureDesignStress(
      { name: "S", verifiedValue: stressInt.verifiedValue! },
      evRes
    );
    const yBoundary = resolveYCoefficient(
      { name: "Y", verifiedValue: yInt.verifiedValue! },
      evRes
    );

    assert(sBoundary.valid === true && sBoundary.value === 137.9, "S must resolve through boundary");
    assert(yBoundary.valid === true && yBoundary.value === 0.4, "Y must resolve through boundary");
  });

  runTest("TEST 19: Helpers de frontière (resolveWeldQualityFactor) rejettent une donnée non qualifiée", () => {
    const unverifiedInt = integrateB31_3Data<number>(
      { dataId: SYNTH_DATA_ID_UNVERIFIED },
      integrationOptions
    );

    assert(unverifiedInt.status === "UNVERIFIED", "Must be UNVERIFIED");
    const qBoundary = resolveWeldQualityFactor(
      { name: "E", verifiedValue: unverifiedInt.verifiedValue! },
      evRes
    );

    assert(qBoundary.valid === false, "Calculation boundary must reject UNVERIFIED quality factor");
    assert(
      qBoundary.error === "VERIFIED_VALUE_EVIDENCE_CHAIN_NOT_VERIFIED",
      `Expected chain error, got ${qBoundary.error}`
    );
  });

  runTest("TEST 20: Tentative d'enregistrement d'un record VERIFIED avec évidence UNVERIFIED rejetée par gouvernance", () => {
    const corruptRecord: B31_3NormativeDataRecord<number> = {
      dataId: "SYNTH_ATTEMPT_UNVERIFIED_EVIDENCE",
      standardId: SYNTH_STD,
      editionId: SYNTH_EDT,
      sourceDocumentId: SYNTH_DOC_ID,
      evidenceId: SYNTH_EV_UNVERIFIED_ID,
      clauseReference: "Para 302",
      dataType: "STRESS",
      value: 120,
      status: "VERIFIED",
    };

    let caught = false;
    try {
      dataReg.register(corruptRecord);
    } catch {
      caught = true;
    }
    assert(caught, "B31_3DataRegistry must refuse registration of VERIFIED record with UNVERIFIED evidence");
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}

/**
 * PDI NORMATIVE ENGINE — ASME B31.3-05 FIRST VERIFIED NORMATIVE DATA TESTS
 * Reference: B31.3-05 (First Verified Normative Data / Controlled Boundary)
 *
 * Exécute les 12 tests obligatoires définis dans la spécification B31.3-05 Section 9.
 */
export function runB31_3_05Tests(): B31_3IntegrationTestResult {
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

  // Constantes synthétiques isolées
  const STD = "SYNTHETIC_ASME_B31_3";
  const EDT = "SYNTHETIC_2022";
  const DOC_ID = "SYNTHETIC_DOC_B313_05";
  const EV_ID = "SYNTHETIC_EV_B313_05";
  const DATA_ID = "SYNTHETIC_DATA_B313_05_001";

  // Factory d'environnement isolé
  function createEnv() {
    const docReg = new NormativeSourceDocumentRegistry();
    const docRes = new NormativeSourceDocumentResolver(docReg);
    const evReg = new NormativeEvidenceRegistry();
    const evRes = new NormativeEvidenceResolver(evReg);
    const dataReg = new B31_3DataRegistry(docRes, evRes);
    const dataRes = new B31_3DataResolver(dataReg);
    return { docReg, docRes, evReg, evRes, dataReg, dataRes };
  }

  // TEST 1: Donnée VERIFIED avec chaîne complète cohérente
  runTest("Test 1: Donnée VERIFIED avec chaîne complète cohérente", () => {
    const { docReg, docRes, evReg, evRes, dataReg, dataRes } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Test Document",
      publisher: "SYNTHETIC_ASME",
      documentReference: "SYNTHETIC-DOC-REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-EV-REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: DATA_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_ID,
      clauseReference: "Table A-1",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      unit: "MPa",
      status: "VERIFIED",
    });

    const res = integrateB31_3Data<number>(
      { dataId: DATA_ID },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );

    assert(res.status === "RESOLVED_VERIFIED", `Expected RESOLVED_VERIFIED, got ${res.status}`);
    assert(res.value === 137.9, "Value must be 137.9");
    assert(res.verifiedValue?.verificationStatus === "VERIFIED", "Status must be VERIFIED");
  });

  // TEST 2: Donnée VERIFIED sans SourceDocument VERIFIED → rejet
  runTest("Test 2: Donnée VERIFIED sans SourceDocument VERIFIED → rejet", () => {
    const { docReg, evReg, dataReg } = createEnv();

    // Source document est UNVERIFIED
    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Unverified Document",
      publisher: "SYNTHETIC_ASME",
      documentReference: "SYNTHETIC-DOC-REF",
      status: "UNVERIFIED",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-EV-REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    let caught = false;
    try {
      dataReg.register({
        dataId: DATA_ID,
        standardId: STD,
        editionId: EDT,
        sourceDocumentId: DOC_ID,
        evidenceId: EV_ID,
        clauseReference: "Table A-1",
        dataType: "ALLOWABLE_STRESS",
        value: 137.9,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must reject VERIFIED record when SourceDocument is not verified");
  });

  // TEST 3: Donnée VERIFIED sans Evidence VERIFIED → rejet
  runTest("Test 3: Donnée VERIFIED sans Evidence VERIFIED → rejet", () => {
    const { docReg, evReg, dataReg } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Test Document",
      publisher: "SYNTHETIC_ASME",
      documentReference: "SYNTHETIC-DOC-REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    // Evidence est UNVERIFIED
    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "LEGACY_REFERENCE",
      sourceReference: "SYNTHETIC-EV-REF",
      verificationStatus: "UNVERIFIED",
    });

    let caught = false;
    try {
      dataReg.register({
        dataId: DATA_ID,
        standardId: STD,
        editionId: EDT,
        sourceDocumentId: DOC_ID,
        evidenceId: EV_ID,
        clauseReference: "Table A-1",
        dataType: "ALLOWABLE_STRESS",
        value: 137.9,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must reject VERIFIED record when Evidence is not verified");
  });

  // TEST 4: Mismatch standard → rejet
  runTest("Test 4: Mismatch standard → rejet", () => {
    const { docReg, evReg, dataReg } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Test Document",
      documentReference: "SYNTHETIC-DOC-REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-EV-REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    let caught = false;
    try {
      dataReg.register({
        dataId: DATA_ID,
        standardId: "OTHER_STANDARD",
        editionId: EDT,
        sourceDocumentId: DOC_ID,
        evidenceId: EV_ID,
        clauseReference: "Table A-1",
        dataType: "ALLOWABLE_STRESS",
        value: 137.9,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must reject record with standardId mismatch");
  });

  // TEST 5: Mismatch édition → rejet
  runTest("Test 5: Mismatch édition → rejet", () => {
    const { docReg, evReg, dataReg } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Test Document",
      documentReference: "SYNTHETIC-DOC-REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-EV-REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    let caught = false;
    try {
      dataReg.register({
        dataId: DATA_ID,
        standardId: STD,
        editionId: "OTHER_EDITION_2099",
        sourceDocumentId: DOC_ID,
        evidenceId: EV_ID,
        clauseReference: "Table A-1",
        dataType: "ALLOWABLE_STRESS",
        value: 137.9,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must reject record with editionId mismatch");
  });

  // TEST 6: Mismatch SourceDocument → rejet
  runTest("Test 6: Mismatch SourceDocument → rejet", () => {
    const { docReg, evReg, dataReg } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Test Document",
      documentReference: "SYNTHETIC-DOC-REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    docReg.register({
      documentId: "OTHER_DOC_ID",
      standardId: STD,
      editionId: EDT,
      title: "Other Document",
      documentReference: "OTHER-DOC-REF",
      status: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID, // Bound to DOC_ID
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "SYNTHETIC-EV-REF",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_1",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    let caught = false;
    try {
      dataReg.register({
        dataId: DATA_ID,
        standardId: STD,
        editionId: EDT,
        sourceDocumentId: "OTHER_DOC_ID", // Mismatch with evidence's sourceDocumentId
        evidenceId: EV_ID,
        clauseReference: "Table A-1",
        dataType: "ALLOWABLE_STRESS",
        value: 137.9,
        status: "VERIFIED",
      });
    } catch {
      caught = true;
    }
    assert(caught, "Registry must reject record with sourceDocumentId mismatch between record and evidence");
  });

  // TEST 7: Donnée UNVERIFIED → jamais promue
  runTest("Test 7: Donnée UNVERIFIED → jamais promue", () => {
    const { docReg, docRes, evReg, evRes, dataReg, dataRes } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Synthetic Document",
      documentReference: "DOC-REF",
      status: "UNVERIFIED",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      clauseReference: "Table A-1",
      sourceType: "LEGACY_REFERENCE",
      sourceReference: "LEGACY-REF",
      verificationStatus: "UNVERIFIED",
    });

    dataReg.register({
      dataId: DATA_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_ID,
      clauseReference: "Table A-1",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      status: "UNVERIFIED",
      notes: "Looks like a valid ASME value",
    });

    const resolveRes = dataRes.resolveData(DATA_ID);
    assert(resolveRes.status === "FOUND_UNVERIFIED", "Status must remain FOUND_UNVERIFIED");

    const intRes = integrateB31_3Data(
      { dataId: DATA_ID },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );
    assert(intRes.status === "UNVERIFIED", "Integration status must remain UNVERIFIED");
    assert(intRes.verifiedValue?.verificationStatus === "UNVERIFIED", "Must never be promoted to VERIFIED");
  });

  // TEST 8: Registry vide → comportement correct
  runTest("Test 8: Registry vide → comportement correct", () => {
    const { dataReg, dataRes, docRes, evRes } = createEnv();

    assert(dataReg.count() === 0, "Empty registry count must be 0");
    assert(dataReg.list().length === 0, "Empty registry list must have length 0");
    assert(dataReg.get("NON_EXISTENT") === undefined, "get on empty registry must return undefined");
    assert(dataReg.has("NON_EXISTENT") === false, "has on empty registry must return false");

    const res = dataRes.resolveData("NON_EXISTENT");
    assert(res.status === "NOT_FOUND", "resolveData on empty registry must return NOT_FOUND");

    const intRes = integrateB31_3Data(
      { dataId: "NON_EXISTENT" },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );
    assert(intRes.status === "NOT_FOUND", "integrateB31_3Data on empty registry must return NOT_FOUND");

    assert(Array.isArray(B31_3_VERIFIED_DATA) && B31_3_VERIFIED_DATA.length === 0, "B31_3_VERIFIED_DATA is empty");
  });

  // TEST 9: Résolution exacte par dataId
  runTest("Test 9: Résolution exacte par dataId", () => {
    const { docReg, evReg, dataReg, dataRes } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Doc",
      documentReference: "Ref",
      status: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Clause",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "Ref",
      verificationStatus: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: "EXACT_DATA_ID_001",
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_ID,
      clauseReference: "Clause",
      dataType: "STRESS",
      value: 100,
      status: "VERIFIED",
    });

    // Exact match
    assert(dataRes.resolveData("EXACT_DATA_ID_001").status === "FOUND_VERIFIED", "Exact match succeeds");

    // Case difference fails
    assert(dataRes.resolveData("exact_data_id_001").status === "NOT_FOUND", "Case difference must not match");

    // Substring fails
    assert(dataRes.resolveData("EXACT_DATA_ID").status === "NOT_FOUND", "Substring must not match");

    // Partial prefix / suffix fails
    assert(dataRes.resolveData("EXACT_DATA_ID_001_EXTRA").status === "NOT_FOUND", "Superstring must not match");
  });

  // TEST 10: Trace complète conservée
  runTest("Test 10: Trace complète conservée", () => {
    const { docReg, docRes, evReg, evRes, dataReg, dataRes } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Doc",
      documentReference: "Ref",
      status: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1 §302",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "Ref",
      verificationStatus: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: DATA_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_ID,
      clauseReference: "Table A-1 §302",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      unit: "MPa",
      notes: "Traceability test",
      status: "VERIFIED",
    });

    const intRes = integrateB31_3Data<number>(
      { dataId: DATA_ID },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );

    assert(intRes.status === "RESOLVED_VERIFIED", "Status must be RESOLVED_VERIFIED");
    assert(intRes.dataId === DATA_ID, "dataId preserved");
    assert(intRes.standardId === STD, "standardId preserved");
    assert(intRes.editionId === EDT, "editionId preserved");
    assert(intRes.sourceDocumentId === DOC_ID, "sourceDocumentId preserved");
    assert(intRes.evidenceId === EV_ID, "evidenceId preserved");
    assert(intRes.clauseReference === "Table A-1 §302", "clauseReference preserved");
    assert(intRes.value === 137.9, "value preserved");
    assert(intRes.verifiedValue?.sourceReference?.includes(STD) === true, "sourceReference contains standardId");
    assert(intRes.verifiedValue?.sourceReference?.includes(EDT) === true, "sourceReference contains editionId");
  });

  // TEST 11: Aucune conversion d'unité
  runTest("Test 11: Aucune conversion d'unité", () => {
    const { docReg, docRes, evReg, evRes, dataReg, dataRes } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Doc",
      documentReference: "Ref",
      status: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Table A-1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "Ref",
      verificationStatus: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    const originalValue = 137.9;
    const originalUnit = "MPa";

    dataReg.register({
      dataId: DATA_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_ID,
      clauseReference: "Table A-1",
      dataType: "ALLOWABLE_STRESS",
      value: originalValue,
      unit: originalUnit,
      status: "VERIFIED",
    });

    const record = dataReg.get<number>(DATA_ID);
    assert(record?.value === originalValue, "Value must not be converted in registry");
    assert(record?.unit === originalUnit, "Unit must not be changed in registry");

    const resolved = dataRes.resolveData<number>(DATA_ID);
    assert(resolved.record?.value === originalValue, "Value must not be converted in resolver");
    assert(resolved.record?.unit === originalUnit, "Unit must not be changed in resolver");

    const integrated = integrateB31_3Data<number>(
      { dataId: DATA_ID },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );
    assert(integrated.value === originalValue, "Value must not be converted in integration");
    assert(integrated.verifiedValue?.value === originalValue, "Value must not be converted in verifiedValue");
  });

  // TEST 12: Déterminisme de résolution
  runTest("Test 12: Déterminisme de résolution", () => {
    const { docReg, docRes, evReg, evRes, dataReg, dataRes } = createEnv();

    docReg.register({
      documentId: DOC_ID,
      standardId: STD,
      editionId: EDT,
      title: "Doc",
      documentReference: "Ref",
      status: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    evReg.register({
      evidenceId: EV_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      clauseReference: "Clause",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "Ref",
      verificationStatus: "VERIFIED",
      verifiedBy: "V",
      verifiedAt: "2026-01-01T00:00:00Z",
    });

    dataReg.register({
      dataId: DATA_ID,
      standardId: STD,
      editionId: EDT,
      sourceDocumentId: DOC_ID,
      evidenceId: EV_ID,
      clauseReference: "Clause",
      dataType: "STRESS",
      value: 200,
      status: "VERIFIED",
    });

    // 10 résolutions consécutives
    const firstRes = integrateB31_3Data<number>(
      { dataId: DATA_ID },
      { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
    );

    for (let i = 0; i < 10; i++) {
      const nthRes = integrateB31_3Data<number>(
        { dataId: DATA_ID },
        { dataResolver: dataRes, sourceDocResolver: docRes, evidenceResolver: evRes }
      );
      assert(nthRes.status === firstRes.status, `Iteration ${i}: status must match`);
      assert(nthRes.value === firstRes.value, `Iteration ${i}: value must match`);
      assert(nthRes.verifiedValue?.verificationStatus === firstRes.verifiedValue?.verificationStatus, `Iteration ${i}: verifiedStatus must match`);
      assert(nthRes.verifiedValue?.sourceReference === firstRes.verifiedValue?.sourceReference, `Iteration ${i}: sourceReference must match`);
    }
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
