/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ DIMENSIONAL STANDARD COMPATIBILITY TESTS
 * Reference: NORM-14-05 (Component ↔ Dimensional Standard Compatibility)
 * 
 * Tests d'intégrité, de conformité, de traçabilité et de déterminisme
 * pour l'adapter Component ↔ Dimensional Standard (PIPE, FITTING, FLANGE, VALVE ↔ DIMENSIONAL_STANDARD).
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B16, ASME B36, NPS, DN, Schedules, wall thicknesses).
 * Identifiants et fixtures strictement synthétiques (SYNTHETIC_*).
 */

import type {
  NormativeComponentDimensionalCompatibilityQuery,
} from "../types/normativeComponentDimensionalCompatibilityTypes";
import {
  validateNormativeComponentDimensionalReference,
  validateNormativeDimensionalStandardReference,
  validateNormativeComponentDimensionalCompatibilityQuery,
} from "../validators/normativeComponentDimensionalCompatibilityValidator";
import { NormativeComponentDimensionalCompatibilityEngine } from "../engine/normativeComponentDimensionalCompatibilityEngine";
import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

export function runNormativeComponentDimensionalCompatibilityTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let testsRun = 0;
  let allPass = true;

  function assert(name: string, condition: boolean, details?: string): void {
    testsRun++;
    if (condition) {
      results.push(`✅ PASS: ${name}`);
    } else {
      allPass = false;
      results.push(`❌ FAIL: ${name} — ${details ?? "Assertion failed"}`);
    }
  }

  // Configuration de l'environnement de test synthétique
  const testEvidenceRegistry = new NormativeEvidenceRegistry();

  testEvidenceRegistry.register({
    evidenceId: "SYNTHETIC_EVIDENCE_001",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_A",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  testEvidenceRegistry.register({
    evidenceId: "SYNTHETIC_EVIDENCE_002",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_02",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_02",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_B",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  testEvidenceRegistry.register({
    evidenceId: "SYNTHETIC_EVIDENCE_UNVERIFIED",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_03",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_03",
    verificationStatus: "UNVERIFIED",
  });

  const testEvidenceResolver = new NormativeEvidenceResolver(testEvidenceRegistry);
  const matrixRegistry = new NormativeCompatibilityMatrixRegistry();
  const matrixEngine = new NormativeCompatibilityMatrixEngine(matrixRegistry, testEvidenceResolver);
  const engine = new NormativeComponentDimensionalCompatibilityEngine(matrixEngine);

  // ==========================================
  // SECTION 1 : VALIDATION (10 TESTS)
  // ==========================================

  // TEST 1 : Requête valide
  const validQuery: NormativeComponentDimensionalCompatibilityQuery = {
    component: {
      componentType: "PIPE",
      componentId: "SYNTHETIC_PIPE_001",
    },
    dimensionalStandard: {
      dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001",
    },
  };
  const val1 = validateNormativeComponentDimensionalCompatibilityQuery(validQuery);
  assert("TEST 01 — Requête valide passe la validation structurelle", val1.valid && val1.errors.length === 0);

  // TEST 2 : Requête null
  const val2 = validateNormativeComponentDimensionalCompatibilityQuery(null);
  assert(
    "TEST 02 — Requête null rejetée avec INVALID_QUERY_OBJECT",
    !val2.valid && val2.errors.some((e) => e.code === "INVALID_QUERY_OBJECT")
  );

  // TEST 3 : Requête primitive
  const val3Num = validateNormativeComponentDimensionalCompatibilityQuery(42);
  const val3Str = validateNormativeComponentDimensionalCompatibilityQuery("INVALID_QUERY");
  assert("TEST 03 — Requête primitive rejetée", !val3Num.valid && !val3Str.valid);

  // TEST 4 : Composant absent
  const val4 = validateNormativeComponentDimensionalCompatibilityQuery({
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001" },
  });
  assert(
    "TEST 04 — Composant absent rejeté avec MISSING_COMPONENT_REFERENCE",
    !val4.valid && val4.errors.some((e) => e.code === "MISSING_COMPONENT_REFERENCE")
  );

  // TEST 5 : Dimensional standard absent
  const val5 = validateNormativeComponentDimensionalCompatibilityQuery({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  assert(
    "TEST 05 — Dimensional standard absent rejeté avec MISSING_DIMENSIONAL_STANDARD_REFERENCE",
    !val5.valid && val5.errors.some((e) => e.code === "MISSING_DIMENSIONAL_STANDARD_REFERENCE")
  );

  // TEST 6 : Type composant invalide
  const val6 = validateNormativeComponentDimensionalReference({
    componentType: "GASKET" as any,
    componentId: "SYNTHETIC_GASKET_001",
  });
  assert(
    "TEST 06 — Type composant invalide rejeté avec INVALID_COMPONENT_TYPE",
    !val6.valid && val6.errors.some((e) => e.code === "INVALID_COMPONENT_TYPE")
  );

  // TEST 7 : componentId absent
  const val7Absent = validateNormativeComponentDimensionalReference({
    componentType: "PIPE",
  });
  assert(
    "TEST 07 — componentId absent rejeté avec MISSING_COMPONENT_ID",
    !val7Absent.valid && val7Absent.errors.some((e) => e.code === "MISSING_COMPONENT_ID")
  );

  // TEST 8 : componentId non-string
  const val8 = validateNormativeComponentDimensionalReference({
    componentType: "PIPE",
    componentId: 12345 as any,
  });
  assert(
    "TEST 08 — componentId non-string rejeté avec INVALID_COMPONENT_ID_TYPE",
    !val8.valid && val8.errors.some((e) => e.code === "INVALID_COMPONENT_ID_TYPE")
  );

  // TEST 9 : dimensionalStandardId absent
  const val9Absent = validateNormativeDimensionalStandardReference({});
  assert(
    "TEST 09 — dimensionalStandardId absent rejeté avec MISSING_DIMENSIONAL_STANDARD_ID",
    !val9Absent.valid && val9Absent.errors.some((e) => e.code === "MISSING_DIMENSIONAL_STANDARD_ID")
  );

  // TEST 10 : dimensionalStandardId non-string ou vide
  const val10NonStr = validateNormativeDimensionalStandardReference({
    dimensionalStandardId: { id: "STD" } as any,
  });
  const val10Empty = validateNormativeDimensionalStandardReference({
    dimensionalStandardId: "   ",
  });
  assert(
    "TEST 10 — dimensionalStandardId non-string ou vide rejeté",
    !val10NonStr.valid &&
      !val10Empty.valid &&
      val10NonStr.errors.some((e) => e.code === "INVALID_DIMENSIONAL_STANDARD_ID_TYPE") &&
      val10Empty.errors.some((e) => e.code === "EMPTY_DIMENSIONAL_STANDARD_ID")
  );

  // ==========================================
  // SECTION 2 : FAMILLES (4 TESTS)
  // ==========================================

  // Enregistrement de règles synthétiques vérifiées pour les 4 familles
  matrixRegistry.register({
    ruleId: "SYNTHETIC_RULE_001",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_STANDARD_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_001"],
  });

  matrixRegistry.register({
    ruleId: "SYNTHETIC_RULE_FITTING_DIM_01",
    leftEntityType: "FITTING",
    leftEntityId: "SYNTHETIC_FITTING_001",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_STANDARD_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_001"],
  });

  matrixRegistry.register({
    ruleId: "SYNTHETIC_RULE_FLANGE_DIM_01",
    leftEntityType: "FLANGE",
    leftEntityId: "SYNTHETIC_FLANGE_001",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_STANDARD_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_001"],
  });

  matrixRegistry.register({
    ruleId: "SYNTHETIC_RULE_VALVE_DIM_01",
    leftEntityType: "VALVE",
    leftEntityId: "SYNTHETIC_VALVE_001",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_STANDARD_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_001"],
  });

  // TEST 11 : PIPE + DIMENSIONAL_STANDARD
  const res11 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001" },
  });
  assert("TEST 11 — Résolution PIPE + DIMENSIONAL_STANDARD → COMPATIBLE", res11.status === "COMPATIBLE");

  // TEST 12 : FITTING + DIMENSIONAL_STANDARD
  const res12 = engine.resolveCompatibility({
    component: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001" },
  });
  assert("TEST 12 — Résolution FITTING + DIMENSIONAL_STANDARD → COMPATIBLE", res12.status === "COMPATIBLE");

  // TEST 13 : FLANGE + DIMENSIONAL_STANDARD
  const res13 = engine.resolveCompatibility({
    component: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001" },
  });
  assert("TEST 13 — Résolution FLANGE + DIMENSIONAL_STANDARD → COMPATIBLE", res13.status === "COMPATIBLE");

  // TEST 14 : VALVE + DIMENSIONAL_STANDARD
  const res14 = engine.resolveCompatibility({
    component: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001" },
  });
  assert("TEST 14 — Résolution VALVE + DIMENSIONAL_STANDARD → COMPATIBLE", res14.status === "COMPATIBLE");

  // ==========================================
  // SECTION 3 : STATUTS (4 TESTS)
  // ==========================================

  // TEST 15 : Statut COMPATIBLE
  assert("TEST 15 — Statut COMPATIBLE respecté", res11.status === "COMPATIBLE");

  // Règle INCOMPATIBLE vérifiée
  matrixRegistry.register({
    ruleId: "SYNTHETIC_RULE_002",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_STANDARD_002",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_002"],
    notes: "Incompatible synthetic dimensional standard pair",
  });

  // TEST 16 : Statut INCOMPATIBLE
  const res16 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_002" },
  });
  assert(
    "TEST 16 — Statut INCOMPATIBLE respecté pour paire incompatible vérifiée",
    res16.status === "INCOMPATIBLE" && res16.matchedRuleIds.includes("SYNTHETIC_RULE_002")
  );

  // TEST 17 : Statut UNVERIFIED (absence de règle)
  const res17 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_UNKNOWN" },
  });
  assert(
    "TEST 17 — Absence de règle retourne UNVERIFIED et NON INCOMPATIBLE",
    res17.status === "UNVERIFIED" && res17.matchedRuleIds.length === 0
  );

  // Conflit entre deux règles vérifiées contradictoires (COMPATIBLE vs INCOMPATIBLE)
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_CONF",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_001"],
  });
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_CONF",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_002"],
  });

  // TEST 18 : Statut INVALID (conflit de règles vérifiées)
  const res18 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_CONF" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_CONF" },
  });
  assert(
    "TEST 18 — Conflit de règles vérifiées retourne INVALID",
    res18.status === "INVALID"
  );

  // ==========================================
  // SECTION 4 : TRAÇABILITÉ (5 TESTS)
  // ==========================================

  // TEST 19 : matchedRuleIds conservés
  assert(
    "TEST 19 — matchedRuleIds exactement préservés depuis NORM-14-01",
    res11.matchedRuleIds.length === 1 && res11.matchedRuleIds[0] === "SYNTHETIC_RULE_001"
  );

  // TEST 20 : evidenceIds conservés
  assert(
    "TEST 20 — evidenceIds exactement préservés depuis NORM-14-01",
    res11.evidenceIds.length === 1 && res11.evidenceIds[0] === "SYNTHETIC_EVIDENCE_001"
  );

  // TEST 21 : Déduplication des traces
  assert(
    "TEST 21 — matchedRuleIds et evidenceIds dédupliqués",
    new Set(res18.matchedRuleIds).size === res18.matchedRuleIds.length &&
      new Set(res18.evidenceIds).size === res18.evidenceIds.length
  );

  // TEST 22 : Tri déterministe
  assert(
    "TEST 22 — matchedRuleIds et evidenceIds triés par ordre alphabétique stable",
    [...res18.matchedRuleIds].sort().join(",") === res18.matchedRuleIds.join(",") &&
      [...res18.evidenceIds].sort().join(",") === res18.evidenceIds.join(",")
  );

  // TEST 23 : conflictCode conservé
  assert(
    "TEST 23 — conflictCode correctement propagé depuis NORM-14-01",
    res18.conflictCode === "COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES"
  );

  // ==========================================
  // SECTION 5 : DIRECTIONNALITÉ (2 TESTS)
  // ==========================================

  // TEST 24 : COMPONENT → DIMENSIONAL_STANDARD
  assert("TEST 24 — COMPONENT → DIMENSIONAL_STANDARD résolu conformément à la règle", res11.status === "COMPATIBLE");

  // TEST 25 : Absence de résolution inverse automatique
  const matrixResultInverse = matrixEngine.resolveCompatibility(
    "DIMENSIONAL_STANDARD",
    "SYNTHETIC_DIM_STANDARD_001",
    "PIPE",
    "SYNTHETIC_PIPE_001"
  );
  assert(
    "TEST 25 — Directionnalité stricte : relation inverse DIMENSIONAL_STANDARD → COMPONENT reste UNVERIFIED sans règle explicite",
    matrixResultInverse.status === "UNVERIFIED"
  );

  // ==========================================
  // SECTION 6 : ANTI-HÉURISTIQUES (5 TESTS)
  // ==========================================

  // TEST 26 : Identifiant contenant B36 accepté comme simple chaîne opaque
  const val26 = validateNormativeDimensionalStandardReference({
    dimensionalStandardId: "SYNTHETIC_B36_IDENTIFIER",
  });
  assert("TEST 26 — Identifiant contenant B36 accepté comme identifiant opaque", val26.valid);

  // TEST 27 : Identifiant contenant NPS accepté comme simple chaîne opaque
  const val27 = validateNormativeComponentDimensionalReference({
    componentType: "PIPE",
    componentId: "SYNTHETIC_NPS_IDENTIFIER",
  });
  assert("TEST 27 — Identifiant contenant NPS accepté comme identifiant opaque", val27.valid);

  // TEST 28 : Identifiant contenant DN accepté comme simple chaîne opaque
  const val28 = validateNormativeComponentDimensionalReference({
    componentType: "VALVE",
    componentId: "SYNTHETIC_DN_IDENTIFIER",
  });
  assert("TEST 28 — Identifiant contenant DN accepté comme identifiant opaque", val28.valid);

  // TEST 29 : Identifiant contenant SCHEDULE accepté comme simple chaîne opaque
  const val29 = validateNormativeDimensionalStandardReference({
    dimensionalStandardId: "SYNTHETIC_SCHEDULE_IDENTIFIER",
  });
  assert("TEST 29 — Identifiant contenant SCHEDULE accepté comme identifiant opaque", val29.valid);

  // TEST 30 : Identifiant opaque contenant plusieurs tokens
  const val30 = validateNormativeComponentDimensionalReference({
    componentType: "FLANGE",
    componentId: "SYNTHETIC_B16_5_NPS_150_CS_A106_COMPOSITE",
  });
  assert("TEST 30 — Identifiant multi-tokens accepté sans interprétation normative", val30.valid);

  // ==========================================
  // SECTION 7 : ARCHITECTURE (6 TESTS)
  // ==========================================

  // TEST 31 : Injection obligatoire du Matrix Engine
  let threwOnMissingEngine = false;
  try {
    new (NormativeComponentDimensionalCompatibilityEngine as any)(null);
  } catch {
    threwOnMissingEngine = true;
  }
  assert("TEST 31 — Constructeur rejette formellement l'absence d'instance NORM-14-01", threwOnMissingEngine);

  // TEST 32 : Aucune seconde source de vérité
  const emptyMatrixRegistry = new NormativeCompatibilityMatrixRegistry();
  const emptyMatrixEngine = new NormativeCompatibilityMatrixEngine(emptyMatrixRegistry, testEvidenceResolver);
  const emptyAdapter = new NormativeComponentDimensionalCompatibilityEngine(emptyMatrixEngine);
  const resEmpty = emptyAdapter.resolveCompatibility(validQuery);
  assert(
    "TEST 32 — Aucune seconde source de vérité : matrice vide retourne UNVERIFIED sans règles inventées",
    resEmpty.status === "UNVERIFIED" && resEmpty.matchedRuleIds.length === 0
  );

  // TEST 33 : Résultat profondément immuable
  assert(
    "TEST 33 — Résultat retourné gelé en profondeur (Object.isFrozen)",
    Object.isFrozen(res11) &&
      Object.isFrozen(res11.component) &&
      Object.isFrozen(res11.dimensionalStandard) &&
      Object.isFrozen(res11.matchedRuleIds) &&
      Object.isFrozen(res11.evidenceIds)
  );

  // TEST 34 : Déterminisme absolu
  const res11Bis = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DIM_STANDARD_001" },
  });
  assert(
    "TEST 34 — Déterminisme : deux évaluations identiques produisent des résultats identiques",
    res11.status === res11Bis.status &&
      res11.matchedRuleIds.join(",") === res11Bis.matchedRuleIds.join(",") &&
      res11.evidenceIds.join(",") === res11Bis.evidenceIds.join(",")
  );

  // TEST 35 : Absence de conversion dimensionnelle
  const resNoConversion = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_NPS_4_PIPE" },
    dimensionalStandard: { dimensionalStandardId: "SYNTHETIC_DN_100_STD" },
  });
  assert(
    "TEST 35 — Aucune conversion NPS/DN implicite : résultat UNVERIFIED sans règle explicite",
    resNoConversion.status === "UNVERIFIED"
  );

  // TEST 36 : Absence de fallback ou de promotion
  const resInvalidQuery = engine.resolveCompatibility({
    component: { componentType: "UNKNOWN_TYPE" as any, componentId: "" },
    dimensionalStandard: { dimensionalStandardId: "" },
  });
  assert(
    "TEST 36 — Requête invalide retourne INVALID sans fallback silencieux",
    resInvalidQuery.status === "INVALID" && resInvalidQuery.matchedRuleIds.length === 0
  );

  return {
    success: allPass,
    testsRun,
    results,
  };
}
