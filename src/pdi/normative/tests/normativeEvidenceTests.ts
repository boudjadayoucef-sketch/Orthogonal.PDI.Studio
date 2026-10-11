/**
 * PDI NORMATIVE ENGINE — EVIDENCE MODEL UNIT TESTS
 * Reference: MASTER-02 (Evidence Model Foundation)
 * 
 * Tests unitaires validant l'ensemble des 10 exigences strictes MASTER-02 :
 * 
 * - TEST 1 : Une "NormativeEvidence" structurellement valide peut être créée.
 * - TEST 2 : Une Evidence avec `verificationStatus: "UNVERIFIED"` reste "UNVERIFIED".
 * - TEST 3 : Une Evidence "VERIFIED" doit respecter les contraintes structurelles nécessaires (verifiedBy, verifiedAt obligatoires).
 * - TEST 4 : Une "NormativeQualification" sans evidence exploitable ne doit pas devenir "QUALIFIED".
 * - TEST 5 : Une qualification qui référence uniquement une Evidence "UNVERIFIED" ne doit pas devenir "QUALIFIED".
 * - TEST 6 : Une qualification qui référence les Evidence nécessaires et "VERIFIED" peut être "QUALIFIED".
 * - TEST 7 : Un identifiant `MAT_CS_123` ne doit jamais être considéré comme une Evidence.
 * - TEST 8 : Le cas F01 actuel insuffisamment documenté doit rester "UNVERIFIED" et ne doit pas devenir automatiquement "CALCULATED".
 * - TEST 9 : Une fonctionnalité F01 actuellement "CALCULATED" ne doit pas être cassée uniquement parce que le nouveau modèle d'Evidence existe.
 * - TEST 10: Une fonctionnalité actuellement "UNVERIFIED" ne doit pas devenir "CALCULATED" simplement parce que les nouveaux types ont été ajoutés.
 * 
 * Tests complémentaires :
 * - Contrat NormativeEdition et validation.
 * - Contrat NormativeVerifiedValue<T>.
 * - Rejet des tokens heuristiques (_CS_, CS_, CRMO, CR_MO, etc.) comme preuves.
 */

import type {
  NormativeEvidence,
  NormativeEdition,
  NormativeQualification,
  NormativeVerifiedValue,
} from "../types/normativeEvidenceTypes";
import {
  validateNormativeEvidence,
  validateNormativeEdition,
  validateNormativeQualification,
  validateNormativeVerifiedValue,
  isDisallowedTokenHeuristic,
} from "../validators/normativeEvidenceValidator";
import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import type { EngineeringCalculationInput } from "../types/designCodeTypes";

export function runNormativeEvidenceTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let success = true;
  let testsRun = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    testsRun++;
    if (!condition) {
      success = false;
      const msg = `❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`;
      results.push(msg);
      throw new Error(msg);
    } else {
      results.push(`✅ PASS: ${testName}`);
    }
  }

  // =========================================================================
  // CONSTANTES SYNTHÉTIQUES EXPLICITES POUR LES TESTS (MASTER-02-FIX-01)
  // Ces fixtures sont strictement synthétiques et ne prétendent en aucun cas
  // représenter une véritable preuve ou édition normative réelle.
  // =========================================================================
  const SYNTHETIC_STANDARD_ID = "SYNTHETIC_STANDARD_STD_001";
  const SYNTHETIC_EDITION_ID = "SYNTHETIC_EDITION_2026_REV_A";
  const SYNTHETIC_CLAUSE_REF = "SYNTHETIC_CLAUSE_SECTION_4_ITEM_2";
  const SYNTHETIC_SOURCE_REF = "SYNTHETIC_LICENSED_DOCUMENT_ARCHIVE_REF_999";
  const SYNTHETIC_VERIFIER_NAME = "SYNTHETIC_QUALIFIED_AUDITOR_SIG_77";

  // =========================================================================
  // TEST 1 : Une "NormativeEvidence" structurellement valide peut être créée
  // =========================================================================
  const validVerifiedEvidence: NormativeEvidence = {
    evidenceId: "SYNTHETIC_EVID_RECORD_VALID_001",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE_REF,
    sourceType: "LICENSED_STANDARD",
    sourceReference: SYNTHETIC_SOURCE_REF,
    verificationStatus: "VERIFIED",
    verifiedBy: SYNTHETIC_VERIFIER_NAME,
    verifiedAt: "2026-09-21T10:00:00.000Z",
    checksum: "sha256-syntheticchecksum1234567890",
    notes: "Preuve synthétique pour validation unitaire du modèle Evidence.",
  };
  const val1 = validateNormativeEvidence(validVerifiedEvidence);
  assert(
    val1.valid === true && val1.errors.length === 0,
    "TEST 1 — Une NormativeEvidence structurellement valide peut être créée et validée"
  );

  // =========================================================================
  // TEST 2 : Une Evidence verificationStatus: "UNVERIFIED" reste "UNVERIFIED"
  // =========================================================================
  const unverifiedEvidence: NormativeEvidence = {
    evidenceId: "SYNTHETIC_EVID_RECORD_UNVERIFIED_002",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: "SYNTHETIC_EDITION_DRAFT_2026",
    clauseReference: "SYNTHETIC_PENDING_CLAUSE_PRELIMINARY",
    sourceType: "MANUFACTURER_DATA",
    sourceReference: "SYNTHETIC_VENDOR_PRELIMINARY_CATALOG_UNAUDITED",
    verificationStatus: "UNVERIFIED",
  };
  const val2 = validateNormativeEvidence(unverifiedEvidence);
  assert(
    val2.valid === true && unverifiedEvidence.verificationStatus === "UNVERIFIED",
    "TEST 2 — Une Evidence verificationStatus: 'UNVERIFIED' reste 'UNVERIFIED' et valide structurellement"
  );

  // =========================================================================
  // TEST 3 : Une Evidence "VERIFIED" doit respecter les contraintes structurelles (verifiedBy & verifiedAt)
  // =========================================================================
  const invalidVerifiedEvidenceMissingBy = {
    evidenceId: "SYNTHETIC_EVID_BAD_NO_VERIFIER",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE_REF,
    sourceType: "LICENSED_STANDARD",
    sourceReference: SYNTHETIC_SOURCE_REF,
    verificationStatus: "VERIFIED",
    // verifiedBy et verifiedAt absents
  };
  const val3a = validateNormativeEvidence(invalidVerifiedEvidenceMissingBy);
  assert(
    val3a.valid === false &&
      val3a.errors.some((e) => e.code === "VERIFIED_EVIDENCE_REQUIRES_VERIFIED_BY") &&
      val3a.errors.some((e) => e.code === "VERIFIED_EVIDENCE_REQUIRES_VERIFIED_AT"),
    "TEST 3 — Une Evidence 'VERIFIED' sans verifiedBy/verifiedAt est rejetée"
  );

  const invalidVerifiedEvidenceBadDate = {
    evidenceId: "SYNTHETIC_EVID_BAD_INVALID_DATE",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE_REF,
    sourceType: "LICENSED_STANDARD",
    sourceReference: SYNTHETIC_SOURCE_REF,
    verificationStatus: "VERIFIED",
    verifiedBy: SYNTHETIC_VERIFIER_NAME,
    verifiedAt: "not-a-valid-date-string",
  };
  const val3b = validateNormativeEvidence(invalidVerifiedEvidenceBadDate);
  assert(
    val3b.valid === false &&
      val3b.errors.some((e) => e.code === "INVALID_VERIFIED_AT_DATE"),
    "TEST 3b — Une Evidence 'VERIFIED' avec date invalide est rejetée"
  );

  // =========================================================================
  // TEST 4 : Une "NormativeQualification" sans evidence exploitable ne doit pas devenir "QUALIFIED"
  // =========================================================================
  const qualificationWithoutEvidence: NormativeQualification = {
    qualificationId: "SYNTHETIC_QUAL_NO_EVID_001",
    subjectId: "SYNTHETIC_SUBJECT_RULE_TARGET",
    ruleId: "SYNTHETIC_RULE_EVAL_SPEC_001",
    status: "QUALIFIED",
    evidenceIds: [], // Liste vide
    reason: "Tentative d'affirmation de statut QUALIFIED sans preuve",
  };
  const val4 = validateNormativeQualification(qualificationWithoutEvidence);
  assert(
    val4.valid === false &&
      val4.errors.some((e) => e.code === "QUALIFIED_REQUIRES_EVIDENCE_IDS"),
    "TEST 4 — Une NormativeQualification sans evidenceIds ne peut pas être 'QUALIFIED'"
  );

  // =========================================================================
  // TEST 5 : Une qualification qui référence uniquement une Evidence "UNVERIFIED" ne doit pas devenir "QUALIFIED"
  // =========================================================================
  const evidenceStore = new Map<string, NormativeEvidence>([
    [validVerifiedEvidence.evidenceId, validVerifiedEvidence],
    [unverifiedEvidence.evidenceId, unverifiedEvidence],
  ]);

  const qualificationReferencingUnverified: NormativeQualification = {
    qualificationId: "SYNTHETIC_QUAL_UNVERIFIED_EVID_002",
    subjectId: "SYNTHETIC_SUBJECT_RULE_TARGET",
    ruleId: "SYNTHETIC_RULE_EVAL_SPEC_001",
    status: "QUALIFIED",
    evidenceIds: [unverifiedEvidence.evidenceId],
    reason: "Tentative de qualification basée sur preuve UNVERIFIED",
  };
  const val5 = validateNormativeQualification(
    qualificationReferencingUnverified,
    (id) => evidenceStore.get(id)
  );
  assert(
    val5.valid === false &&
      val5.errors.some((e) => e.code === "QUALIFIED_EVIDENCE_UNVERIFIED"),
    "TEST 5 — Une qualification référençant une Evidence 'UNVERIFIED' ne peut pas être 'QUALIFIED'"
  );

  // =========================================================================
  // TEST 6 : Une qualification qui référence les Evidence nécessaires et "VERIFIED" peut être "QUALIFIED"
  // =========================================================================
  const qualificationFullyVerified: NormativeQualification = {
    qualificationId: "SYNTHETIC_QUAL_FULLY_VERIFIED_003",
    subjectId: "SYNTHETIC_SUBJECT_RULE_TARGET",
    ruleId: "SYNTHETIC_RULE_EVAL_SPEC_001",
    status: "QUALIFIED",
    evidenceIds: [validVerifiedEvidence.evidenceId],
    reason: "Qualification synthétique supportée par une preuve vérifiée et auditable",
  };
  const val6 = validateNormativeQualification(
    qualificationFullyVerified,
    (id) => evidenceStore.get(id)
  );
  assert(
    val6.valid === true && val6.errors.length === 0,
    "TEST 6 — Une qualification référençant des Evidence 'VERIFIED' valides est admise comme 'QUALIFIED'"
  );

  // =========================================================================
  // TEST 7 : Un identifiant MAT_CS_123 ne doit jamais être considéré comme une Evidence
  // =========================================================================
  assert(
    isDisallowedTokenHeuristic("MAT_CS_123") === true &&
      isDisallowedTokenHeuristic("_CS_") === true &&
      isDisallowedTokenHeuristic("CS_") === true &&
      isDisallowedTokenHeuristic("CARBON_STEEL_") === true &&
      isDisallowedTokenHeuristic("CRMO") === true &&
      isDisallowedTokenHeuristic("CR_MO") === true &&
      isDisallowedTokenHeuristic("CRMO_P22") === true &&
      isDisallowedTokenHeuristic("AUSTENITIC") === true,
    "TEST 7a — Les motifs heuristiques de tokens sont formellement reconnus comme interdits"
  );

  const heuristicTokenEvidenceAttempt = {
    evidenceId: "MAT_CS_123", // Tentative d'utiliser un token heuristique comme evidenceId
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE_REF,
    sourceType: "LICENSED_STANDARD",
    sourceReference: SYNTHETIC_SOURCE_REF,
    verificationStatus: "VERIFIED",
    verifiedBy: SYNTHETIC_VERIFIER_NAME,
    verifiedAt: "2026-09-21T00:00:00Z",
  };
  const val7a = validateNormativeEvidence(heuristicTokenEvidenceAttempt);
  assert(
    val7a.valid === false &&
      val7a.errors.some((e) => e.code === "TOKEN_HEURISTIC_DISALLOWED"),
    "TEST 7b — MAT_CS_123 utilisé comme evidenceId est strictement rejeté"
  );

  const qualificationUsingHeuristicToken = {
    qualificationId: "SYNTHETIC_QUAL_HEURISTIC_REJECT",
    subjectId: "SYNTHETIC_SUBJECT_TARGET",
    ruleId: "SYNTHETIC_RULE_TARGET",
    status: "QUALIFIED",
    evidenceIds: ["MAT_CS_123"],
  };
  const val7b = validateNormativeQualification(qualificationUsingHeuristicToken);
  assert(
    val7b.valid === false &&
      val7b.errors.some(
        (e) => e.code === "DISALLOWED_TOKEN_HEURISTIC_USED_AS_EVIDENCE"
      ),
    "TEST 7c — MAT_CS_123 utilisé comme élément dans evidenceIds est strictement rejeté"
  );

  // =========================================================================
  // TEST 8 : Le cas F01 actuel insuffisamment documenté doit rester UNVERIFIED
  // =========================================================================
  const f01Baseline: EngineeringCalculationInput = {
    evidenceItems: [
      {
        evidenceId: "SYNTHETIC_NORM_EV_S_001",
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
        evidenceId: "SYNTHETIC_NORM_EV_E_002",
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
        evidenceId: "SYNTHETIC_NORM_EV_W_003",
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
        evidenceId: "SYNTHETIC_NORM_EV_Y_004",
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
    pressure: 2.0, // MPa
    temperature: 100, // °C
    outsideDiameterMm: 114.3, // mm
    corrosionAllowanceMm: 1.5,
    diameterBasis: "OUTSIDE",
    componentType: "SEAMLESS",
    materialId: "SYNTHETIC_MATERIAL_NORM",
    allowableStressInput: {
      verifiedValue: {
        value: 138.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_NORM_EV_S_001"],
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
        evidenceIds: ["SYNTHETIC_NORM_EV_E_002"],
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
        evidenceIds: ["SYNTHETIC_NORM_EV_W_003"],
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
        evidenceIds: ["SYNTHETIC_NORM_EV_Y_004"],
      },
      factorValue: 0.4,
      materialFamily: "FERRITIC",
      temperature: 100,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 304.1.1",
    },
  };

  // Sans température ou avec W non documenté (W-05 sans données suffisantes), le résultat reste UNVERIFIED
  const rF01_Undocumented = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-05", // W-05 non documenté
      sourceReference: "Preliminary note",
    },
  });
  assert(
    rF01_Undocumented.status === "UNVERIFIED",
    "TEST 8 — Le cas F01 insuffisamment documenté reste strictement UNVERIFIED"
  );

  // =========================================================================
  // TEST 9 : Une fonctionnalité F01 actuellement "CALCULATED" ne doit pas être cassée
  // =========================================================================
  const rF01_SeamlessCalculated = executeEngineeringCalculation(f01Baseline);
  assert(
    rF01_SeamlessCalculated.status === "CALCULATED" &&
      rF01_SeamlessCalculated.value !== undefined &&
      rF01_SeamlessCalculated.value > 0,
    "TEST 9 — Le calcul F01 qualifié (SEAMLESS W-01) produit toujours CALCULATED"
  );

  // =========================================================================
  // TEST 10 : Une fonctionnalité actuellement "UNVERIFIED" ne doit pas devenir "CALCULATED"
  // =========================================================================
  const rF01_W06_Unverified = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    temperature: 100,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "WELDED",
      materialGroup: "CRMO",
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_W06_Unverified.status === "UNVERIFIED" &&
      rF01_W06_Unverified.resolvedFactors?.W?.valueVerified === false,
    "TEST 10 — La branche W-06 non formellement qualifiée par NORM-06 reste strictement UNVERIFIED"
  );

  // =========================================================================
  // TESTS SUPPLÉMENTAIRES : NormativeEdition & NormativeVerifiedValue
  // =========================================================================
  const validEdition: NormativeEdition = {
    id: SYNTHETIC_EDITION_ID,
    standardId: SYNTHETIC_STANDARD_ID,
    year: 2026,
    status: "CURRENT",
    sourceReference: SYNTHETIC_SOURCE_REF,
    verificationStatus: "VERIFIED",
  };
  const valEdition = validateNormativeEdition(validEdition);
  assert(
    valEdition.valid === true,
    "TEST EXTRA 1 — NormativeEdition valide est confirmée"
  );

  const invalidEditionBadYear = {
    id: "SYNTHETIC_EDITION_BAD_YEAR",
    standardId: SYNTHETIC_STANDARD_ID,
    year: 1750, // Année hors domaine
    status: "CURRENT",
    sourceReference: "SYNTHETIC_REF_OUT_OF_BOUNDS",
    verificationStatus: "VERIFIED",
  };
  const valEditionBad = validateNormativeEdition(invalidEditionBadYear);
  assert(
    valEditionBad.valid === false &&
      valEditionBad.errors.some((e) => e.code === "INVALID_YEAR"),
    "TEST EXTRA 2 — NormativeEdition avec année invalide est rejetée"
  );

  const verifiedValueContract: NormativeVerifiedValue<number> = {
    value: 42.5, // Valeur synthétique pour démonstration unitaire
    verificationStatus: "VERIFIED",
    evidenceIds: [validVerifiedEvidence.evidenceId],
    sourceReference: SYNTHETIC_SOURCE_REF,
  };
  assert(
    validateNormativeVerifiedValue(verifiedValueContract, (v) => typeof v === "number" && v > 0),
    "TEST EXTRA 3 — NormativeVerifiedValue<T> validée"
  );

  const unverifiedValueWithoutEvidence: NormativeVerifiedValue<number> = {
    value: 42.5,
    verificationStatus: "VERIFIED",
    evidenceIds: [], // Invalide : VERIFIED sans evidenceIds
  };
  assert(
    validateNormativeVerifiedValue(unverifiedValueWithoutEvidence) === false,
    "TEST EXTRA 4 — NormativeVerifiedValue déclarée 'VERIFIED' sans evidenceIds est rejetée"
  );

  return { success, testsRun, results };
}
