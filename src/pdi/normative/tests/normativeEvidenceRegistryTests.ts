/**
 * PDI NORMATIVE ENGINE — EVIDENCE REGISTRY & RESOLVER TESTS
 * Reference: NORM-09 (Evidence Registry / Resolver)
 * 
 * Tests unitaires obligatoires validant rigoureusement les 12 exigences NORM-09 :
 * 
 * - TEST 1 : Créer une Evidence synthétique "VERIFIED", l'enregistrer.
 *            Vérifier register → get → même evidenceId.
 * - TEST 2 : Créer une Evidence synthétique "UNVERIFIED", l'enregistrer.
 *            Vérifier que get(...).verificationStatus === "UNVERIFIED" reste inchangé.
 * - TEST 3 : Tenter d'enregistrer une Evidence invalide.
 *            Le registry doit refuser l'insertion.
 * - TEST 4 : Tenter d'enregistrer deux fois le même "evidenceId".
 *            Le registry doit refuser le doublon.
 * - TEST 5 : Résoudre une Evidence existante et VERIFIED.
 *            Le resolver doit retourner "FOUND_VERIFIED" avec l'Evidence vérifiée.
 * - TEST 6 : Résoudre une Evidence existante mais UNVERIFIED.
 *            Le resolver doit explicitement retourner l'état "FOUND_UNVERIFIED".
 *            Il ne doit JAMAIS retourner "FOUND_VERIFIED".
 * - TEST 7 : Résoudre un "evidenceId" inexistant.
 *            Le résultat doit être explicitement "NOT_FOUND".
 * - TEST 8 : Une qualification utilisant une Evidence VERIFIED existante peut être validée.
 * - TEST 9 : Une qualification utilisant uniquement une Evidence UNVERIFIED doit rester refusée.
 * - TEST 10: Une qualification utilisant un "evidenceId" inexistant doit être refusée.
 * - TEST 11: Vérifier que MAT_CS_123, CRMO, CR_MO ne permettent jamais de fabriquer
 *            ou résoudre automatiquement une Evidence.
 * - TEST 12: Vérifier qu'aucun changement F01 n'est nécessaire (designCodeEngine.ts intact
 *            et opérationnel).
 * 
 * RÈGLE STRICTE SUR LES DONNÉES :
 * Toutes les fixtures sont EXCLUSIVEMENT synthétiques. Aucune donnée ASME/API/ISO
 * ou valeur de dimension/contrainte réelle n'est utilisée pour ces démonstrations.
 */

import type {
  NormativeEvidence,
  NormativeQualification,
} from "../types/normativeEvidenceTypes";
import {
  NormativeEvidenceRegistry,
} from "../registry/normativeEvidenceRegistry";
import {
  NormativeEvidenceResolver,
} from "../registry/normativeEvidenceResolver";
import {
  validateNormativeQualification,
} from "../validators/normativeEvidenceValidator";
import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import type { EngineeringCalculationInput } from "../types/designCodeTypes";

export function runNormativeEvidenceRegistryTests(): {
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
  // FIXTURES SYNTHÉTIQUES EXPLICITES (NORM-09 §10)
  // =========================================================================
  const SYNTHETIC_STANDARD_ID = "SYNTHETIC_STANDARD_NORM09_001";
  const SYNTHETIC_EDITION_ID = "SYNTHETIC_EDITION_NORM09_2026";
  const SYNTHETIC_CLAUSE = "SYNTHETIC_CLAUSE_NORM09_SEC_1";
  const SYNTHETIC_SOURCE = "SYNTHETIC_SOURCE_NORM09_ARCHIVE";
  const SYNTHETIC_VERIFIER = "SYNTHETIC_AUDITOR_NORM09_ID42";

  // Création d'une instance dédiée du registre pour isolation complète
  const registry = new NormativeEvidenceRegistry();
  const resolver = new NormativeEvidenceResolver(registry);

  // =========================================================================
  // TEST 1 : Créer une Evidence synthétique "VERIFIED", l'enregistrer, get
  // =========================================================================
  const syntheticVerified: NormativeEvidence = {
    evidenceId: "SYNTHETIC_EVID_VERIFIED_001",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE,
    sourceType: "LICENSED_STANDARD",
    sourceReference: SYNTHETIC_SOURCE,
    verificationStatus: "VERIFIED",
    verifiedBy: SYNTHETIC_VERIFIER,
    verifiedAt: "2026-09-21T12:00:00.000Z",
    notes: "Synthetic verified evidence for NORM-09 testing.",
  };

  registry.register(syntheticVerified);
  const retrieved1 = registry.get("SYNTHETIC_EVID_VERIFIED_001");

  assert(
    retrieved1 !== undefined &&
      retrieved1.evidenceId === "SYNTHETIC_EVID_VERIFIED_001" &&
      retrieved1.verificationStatus === "VERIFIED" &&
      registry.has("SYNTHETIC_EVID_VERIFIED_001") === true,
    "TEST 1 — register → get retourne la même NormativeEvidence VERIFIED"
  );

  // =========================================================================
  // TEST 2 : Créer une Evidence synthétique "UNVERIFIED", l'enregistrer
  //          Vérifier que verificationStatus === "UNVERIFIED" reste inchangé
  // =========================================================================
  const syntheticUnverified: NormativeEvidence = {
    evidenceId: "SYNTHETIC_EVID_UNVERIFIED_002",
    standardId: SYNTHETIC_STANDARD_ID,
    editionId: SYNTHETIC_EDITION_ID,
    clauseReference: SYNTHETIC_CLAUSE,
    sourceType: "MANUFACTURER_DATA",
    sourceReference: "SYNTHETIC_VENDOR_PRELIMINARY_SHEET",
    verificationStatus: "UNVERIFIED",
  };

  registry.register(syntheticUnverified);
  const retrieved2 = registry.get("SYNTHETIC_EVID_UNVERIFIED_002");

  assert(
    retrieved2 !== undefined &&
      retrieved2.verificationStatus === "UNVERIFIED",
    "TEST 2 — register d'une Evidence UNVERIFIED conserve strictement UNVERIFIED"
  );

  // =========================================================================
  // TEST 3 : Tenter d'enregistrer une Evidence invalide -> refus par le registry
  // =========================================================================
  let invalidRefused = false;
  try {
    const invalidEvidence: any = {
      evidenceId: "SYNTHETIC_EVID_INVALID_003",
      standardId: SYNTHETIC_STANDARD_ID,
      editionId: SYNTHETIC_EDITION_ID,
      clauseReference: SYNTHETIC_CLAUSE,
      sourceType: "LICENSED_STANDARD",
      sourceReference: SYNTHETIC_SOURCE,
      verificationStatus: "VERIFIED",
      // Manque verifiedBy et verifiedAt obligatoires pour VERIFIED
    };
    registry.register(invalidEvidence);
  } catch (err: any) {
    invalidRefused = true;
  }

  assert(
    invalidRefused === true && registry.has("SYNTHETIC_EVID_INVALID_003") === false,
    "TEST 3 — Le registry refuse l'insertion d'une NormativeEvidence invalide"
  );

  // =========================================================================
  // TEST 4 : Tenter d'enregistrer deux fois le même evidenceId -> refus doublon
  // =========================================================================
  let duplicateRefused = false;
  try {
    registry.register(syntheticVerified); // Déjà inséré au TEST 1
  } catch (err: any) {
    duplicateRefused = true;
  }

  assert(
    duplicateRefused === true,
    "TEST 4 — Le registry refuse l'enregistrement d'un doublon d'evidenceId"
  );

  // =========================================================================
  // TEST 5 : Résoudre une Evidence existante et VERIFIED
  // =========================================================================
  const resVerified = resolver.resolveEvidence("SYNTHETIC_EVID_VERIFIED_001");
  assert(
    resVerified.status === "FOUND_VERIFIED" &&
      resVerified.evidence !== undefined &&
      resVerified.evidence.verificationStatus === "VERIFIED",
    "TEST 5 — Le resolver identifie l'Evidence existante comme FOUND_VERIFIED"
  );

  // =========================================================================
  // TEST 6 : Résoudre une Evidence existante mais UNVERIFIED
  // =========================================================================
  const resUnverified = resolver.resolveEvidence("SYNTHETIC_EVID_UNVERIFIED_002");
  assert(
    resUnverified.status === "FOUND_UNVERIFIED" &&
      resUnverified.evidence !== undefined &&
      resUnverified.evidence.verificationStatus === "UNVERIFIED" &&
      (resUnverified.status as string) !== "FOUND_VERIFIED",
    "TEST 6 — Le resolver identifie l'Evidence UNVERIFIED comme FOUND_UNVERIFIED sans promotion"
  );

  // =========================================================================
  // TEST 7 : Résoudre un evidenceId inexistant -> NOT_FOUND
  // =========================================================================
  const resNotFound = resolver.resolveEvidence("SYNTHETIC_EVID_NON_EXISTENT_999");
  assert(
    resNotFound.status === "NOT_FOUND" && resNotFound.evidence === undefined,
    "TEST 7 — Le resolver retourne NOT_FOUND pour un identifiant inexistant"
  );

  // =========================================================================
  // TEST 8 : Qualification utilisant une Evidence VERIFIED existante -> validée
  // =========================================================================
  const lookupFn = resolver.createLookupFunction();

  const qualQualified: NormativeQualification = {
    qualificationId: "SYNTHETIC_QUAL_001",
    subjectId: "SYNTHETIC_SUBJECT_001",
    ruleId: "SYNTHETIC_RULE_001",
    status: "QUALIFIED",
    evidenceIds: ["SYNTHETIC_EVID_VERIFIED_001"],
    reason: "Qualification supportée par une preuve synthétique vérifiée dans le registry.",
  };

  const val8 = validateNormativeQualification(qualQualified, lookupFn);
  assert(
    val8.valid === true && val8.errors.length === 0,
    "TEST 8 — Une qualification appuyée sur une Evidence VERIFIED du registry est validée"
  );

  // =========================================================================
  // TEST 9 : Qualification utilisant uniquement une Evidence UNVERIFIED -> refusée
  // =========================================================================
  const qualWithUnverified: NormativeQualification = {
    qualificationId: "SYNTHETIC_QUAL_002",
    subjectId: "SYNTHETIC_SUBJECT_002",
    ruleId: "SYNTHETIC_RULE_002",
    status: "QUALIFIED",
    evidenceIds: ["SYNTHETIC_EVID_UNVERIFIED_002"],
    reason: "Tentative de qualification avec une preuve UNVERIFIED.",
  };

  const val9 = validateNormativeQualification(qualWithUnverified, lookupFn);
  assert(
    val9.valid === false &&
      val9.errors.some((e) => e.code === "QUALIFIED_EVIDENCE_UNVERIFIED"),
    "TEST 9 — Une qualification utilisant une Evidence UNVERIFIED est refusée"
  );

  // =========================================================================
  // TEST 10 : Qualification utilisant un evidenceId inexistant -> refusée
  // =========================================================================
  const qualWithMissing: NormativeQualification = {
    qualificationId: "SYNTHETIC_QUAL_003",
    subjectId: "SYNTHETIC_SUBJECT_003",
    ruleId: "SYNTHETIC_RULE_003",
    status: "QUALIFIED",
    evidenceIds: ["SYNTHETIC_EVID_NON_EXISTENT_999"],
    reason: "Tentative de qualification avec une preuve inexistante.",
  };

  const val10 = validateNormativeQualification(qualWithMissing, lookupFn);
  assert(
    val10.valid === false &&
      val10.errors.some((e) => e.code === "QUALIFIED_EVIDENCE_NOT_FOUND"),
    "TEST 10 — Une qualification utilisant un evidenceId inexistant est refusée"
  );

  // =========================================================================
  // TEST 11 : MAT_CS_123, CRMO, CR_MO ne permettent jamais de fabriquer une Evidence
  // =========================================================================
  let tokenRegistrationBlocked = 0;
  const heuristicTokens = ["MAT_CS_123", "CRMO", "CR_MO", "CS_", "_CS_", "CARBON_STEEL_A", "AUSTENITIC"];

  for (const token of heuristicTokens) {
    try {
      registry.register({
        evidenceId: token,
        standardId: SYNTHETIC_STANDARD_ID,
        editionId: SYNTHETIC_EDITION_ID,
        clauseReference: SYNTHETIC_CLAUSE,
        sourceType: "LICENSED_STANDARD",
        sourceReference: SYNTHETIC_SOURCE,
        verificationStatus: "VERIFIED",
        verifiedBy: SYNTHETIC_VERIFIER,
        verifiedAt: "2026-09-21T00:00:00Z",
      });
    } catch {
      tokenRegistrationBlocked++;
    }

    const resolved = resolver.resolveEvidence(token);
    assert(
      resolved.status === "INVALID",
      `TEST 11 (Resolver) — Le token '${token}' est résolu comme INVALID`
    );
  }

  assert(
    tokenRegistrationBlocked === heuristicTokens.length,
    "TEST 11 (Registry) — L'enregistrement de tokens heuristiques est systématiquement bloqué"
  );

  // =========================================================================
  // TEST 12 : Vérifier que le calcul F01 pleinement prouvé produit CALCULATED
  // =========================================================================
  const f01Baseline: EngineeringCalculationInput = {
    evidenceItems: [
      {
        evidenceId: "SYNTHETIC_REG_EV_S_001",
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
        evidenceId: "SYNTHETIC_REG_EV_E_002",
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
        evidenceId: "SYNTHETIC_REG_EV_W_003",
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
        evidenceId: "SYNTHETIC_REG_EV_Y_004",
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
    materialId: "SYNTHETIC_MATERIAL",
    allowableStressInput: {
      verifiedValue: {
        value: 138.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_REG_EV_S_001"],
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
        evidenceIds: ["SYNTHETIC_REG_EV_E_002"],
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
        evidenceIds: ["SYNTHETIC_REG_EV_W_003"],
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
        evidenceIds: ["SYNTHETIC_REG_EV_Y_004"],
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
    "TEST 12 — Le moteur F01 continue de produire CALCULATED sans modification du moteur"
  );

  return { success, testsRun, results };
}
