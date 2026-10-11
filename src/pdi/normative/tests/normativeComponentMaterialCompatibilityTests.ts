/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ MATERIAL COMPATIBILITY TESTS
 * Reference: NORM-14-03 (Component ↔ Material Compatibility)
 * 
 * Tests d'intégrité, de conformité, de traçabilité et de déterminisme
 * pour l'adapter Component ↔ Material (PIPE, FITTING, FLANGE, VALVE ↔ MATERIAL).
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B31.3, B16, API, ISO, EN, ASTM).
 * Identifiants et fixtures strictement synthétiques (SYNTHETIC_*).
 */

import type {
  NormativeComponentMaterialCompatibilityQuery,
} from "../types/normativeComponentMaterialCompatibilityTypes";
import {
  validateNormativeComponentMaterialReference,
  validateNormativeMaterialReference,
  validateNormativeComponentMaterialCompatibilityQuery,
} from "../validators/normativeComponentMaterialCompatibilityValidator";
import { NormativeComponentMaterialCompatibilityEngine } from "../engine/normativeComponentMaterialCompatibilityEngine";
import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

export function runNormativeComponentMaterialCompatibilityTests(): {
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
    evidenceId: "SYNTHETIC_EVIDENCE_MAT_01",
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
    evidenceId: "SYNTHETIC_EVIDENCE_MAT_02",
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
  const engine = new NormativeComponentMaterialCompatibilityEngine(matrixEngine);

  // ==========================================
  // SECTION 1 : VALIDATION (10 TESTS)
  // ==========================================

  // TEST 1 : Requête valide
  const validQuery: NormativeComponentMaterialCompatibilityQuery = {
    component: {
      componentType: "PIPE",
      componentId: "SYNTHETIC_PIPE_001",
    },
    material: {
      materialId: "SYNTHETIC_MATERIAL_001",
    },
  };
  const val1 = validateNormativeComponentMaterialCompatibilityQuery(validQuery);
  assert("TEST 01 — Requête valide passe la validation structurelle", val1.valid && val1.errors.length === 0);

  // TEST 2 : Requête null
  const val2 = validateNormativeComponentMaterialCompatibilityQuery(null);
  assert(
    "TEST 02 — Requête null rejetée avec INVALID_QUERY_OBJECT",
    !val2.valid && val2.errors.some((e) => e.code === "INVALID_QUERY_OBJECT")
  );

  // TEST 3 : Requête primitive
  const val3Num = validateNormativeComponentMaterialCompatibilityQuery(42);
  const val3Str = validateNormativeComponentMaterialCompatibilityQuery("INVALID_QUERY");
  assert("TEST 03 — Requête primitive rejetée", !val3Num.valid && !val3Str.valid);

  // TEST 4 : Composant absent
  const val4 = validateNormativeComponentMaterialCompatibilityQuery({
    material: { materialId: "SYNTHETIC_MATERIAL_001" },
  });
  assert(
    "TEST 04 — Composant absent rejeté avec MISSING_COMPONENT_REFERENCE",
    !val4.valid && val4.errors.some((e) => e.code === "MISSING_COMPONENT_REFERENCE")
  );

  // TEST 5 : Matériau absent
  const val5 = validateNormativeComponentMaterialCompatibilityQuery({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  assert(
    "TEST 05 — Matériau absent rejeté avec MISSING_MATERIAL_REFERENCE",
    !val5.valid && val5.errors.some((e) => e.code === "MISSING_MATERIAL_REFERENCE")
  );

  // TEST 6 : Type composant invalide
  const val6 = validateNormativeComponentMaterialReference({
    componentType: "GASKET" as any,
    componentId: "SYNTHETIC_GASKET_001",
  });
  assert(
    "TEST 06 — Type composant invalide rejeté avec INVALID_COMPONENT_TYPE",
    !val6.valid && val6.errors.some((e) => e.code === "INVALID_COMPONENT_TYPE")
  );

  // TEST 7 : componentId vide ou espaces seuls
  const val7Empty = validateNormativeComponentMaterialReference({
    componentType: "PIPE",
    componentId: "",
  });
  const val7Ws = validateNormativeComponentMaterialReference({
    componentType: "PIPE",
    componentId: "   ",
  });
  assert(
    "TEST 07 — componentId vide ou espaces seuls rejeté avec EMPTY_COMPONENT_ID",
    !val7Empty.valid && !val7Ws.valid && val7Empty.errors.some((e) => e.code === "EMPTY_COMPONENT_ID")
  );

  // TEST 8 : materialId vide ou espaces seuls
  const val8Empty = validateNormativeMaterialReference({ materialId: "" });
  const val8Ws = validateNormativeMaterialReference({ materialId: "   " });
  assert(
    "TEST 08 — materialId vide ou espaces seuls rejeté avec EMPTY_MATERIAL_ID",
    !val8Empty.valid && !val8Ws.valid && val8Empty.errors.some((e) => e.code === "EMPTY_MATERIAL_ID")
  );

  // TEST 9 : componentId non-string
  const val9 = validateNormativeComponentMaterialReference({
    componentType: "PIPE",
    componentId: 12345 as any,
  });
  assert(
    "TEST 09 — componentId non-string rejeté avec INVALID_COMPONENT_ID_TYPE",
    !val9.valid && val9.errors.some((e) => e.code === "INVALID_COMPONENT_ID_TYPE")
  );

  // TEST 10 : materialId non-string
  const val10 = validateNormativeMaterialReference({
    materialId: { id: "MAT" } as any,
  });
  assert(
    "TEST 10 — materialId non-string rejeté avec INVALID_MATERIAL_ID_TYPE",
    !val10.valid && val10.errors.some((e) => e.code === "INVALID_MATERIAL_ID_TYPE")
  );

  // ==========================================
  // SECTION 2 : RÉSOLUTION PAR FAMILLE DE COMPOSANT (4 TESTS)
  // ==========================================

  // Enregistrement de règles synthétiques vérifiées pour les 4 familles
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FITTING_MAT_01",
    leftEntityType: "FITTING",
    leftEntityId: "SYNTHETIC_FITTING_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FLANGE_MAT_01",
    leftEntityType: "FLANGE",
    leftEntityId: "SYNTHETIC_FLANGE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_VALVE_MAT_01",
    leftEntityType: "VALVE",
    leftEntityId: "SYNTHETIC_VALVE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_01"],
  });

  // TEST 11 : PIPE + MATERIAL
  const res11 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_001" },
  });
  assert("TEST 11 — Résolution PIPE + MATERIAL → COMPATIBLE", res11.status === "COMPATIBLE");

  // TEST 12 : FITTING + MATERIAL
  const res12 = engine.resolveCompatibility({
    component: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_001" },
  });
  assert("TEST 12 — Résolution FITTING + MATERIAL → COMPATIBLE", res12.status === "COMPATIBLE");

  // TEST 13 : FLANGE + MATERIAL
  const res13 = engine.resolveCompatibility({
    component: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_001" },
  });
  assert("TEST 13 — Résolution FLANGE + MATERIAL → COMPATIBLE", res13.status === "COMPATIBLE");

  // TEST 14 : VALVE + MATERIAL
  const res14 = engine.resolveCompatibility({
    component: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_001" },
  });
  assert("TEST 14 — Résolution VALVE + MATERIAL → COMPATIBLE", res14.status === "COMPATIBLE");

  // ==========================================
  // SECTION 3 : STATUTS & RÈGLES NORMATIVES (5 TESTS)
  // ==========================================

  // Règle INCOMPATIBLE vérifiée
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_INCOMPAT",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_02"],
    notes: "Incompatible synthetic material pair",
  });

  // TEST 15 : Règle COMPATIBLE
  assert("TEST 15 — Statut COMPATIBLE respecté", res11.status === "COMPATIBLE");

  // TEST 16 : Règle INCOMPATIBLE
  const res16 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_INCOMPAT" },
  });
  assert(
    "TEST 16 — Statut INCOMPATIBLE respecté pour paire incompatible vérifiée",
    res16.status === "INCOMPATIBLE" && res16.matchedRuleIds.includes("SYN_RULE_PIPE_MAT_INCOMPAT")
  );

  // TEST 17 : Aucune règle correspondante → UNVERIFIED (et non INCOMPATIBLE)
  const res17 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_UNKNOWN" },
  });
  assert(
    "TEST 17 — Absence de règle retourne UNVERIFIED et NON INCOMPATIBLE",
    res17.status === "UNVERIFIED" && res17.matchedRuleIds.length === 0
  );

  // Règle avec évidence UNVERIFIED
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_UNVERIFIED_EVID",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_002",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_002",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_UNVERIFIED"],
  });

  // TEST 18 : Règle non vérifiée → UNVERIFIED
  const res18 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_002" },
    material: { materialId: "SYNTHETIC_MATERIAL_002" },
  });
  assert("TEST 18 — Règle sans évidence vérifiée retourne UNVERIFIED", res18.status === "UNVERIFIED");

  // Conflit entre deux règles vérifiées contradictoires (COMPATIBLE vs INCOMPATIBLE)
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MAT_CONF",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_01"],
  });
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MAT_CONF",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_MAT_02"],
  });

  // TEST 19 : Conflit de règles vérifiées → INVALID avec conflictCode
  const res19 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_CONF" },
    material: { materialId: "SYNTHETIC_MAT_CONF" },
  });
  assert(
    "TEST 19 — Conflit de règles vérifiées retourne INVALID avec code de conflit explicite",
    res19.status === "INVALID" &&
      res19.conflictCode === "COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES"
  );

  // ==========================================
  // SECTION 4 : TRAÇABILITÉ (4 TESTS)
  // ==========================================

  // TEST 20 : matchedRuleIds conservés
  assert(
    "TEST 20 — matchedRuleIds exactement préservés depuis NORM-14-01",
    res11.matchedRuleIds.length === 1 && res11.matchedRuleIds[0] === "SYN_RULE_PIPE_MAT_01"
  );

  // TEST 21 : evidenceIds conservés
  assert(
    "TEST 21 — evidenceIds exactement préservés depuis NORM-14-01",
    res11.evidenceIds.length === 1 && res11.evidenceIds[0] === "SYNTHETIC_EVIDENCE_MAT_01"
  );

  // TEST 22 : Déduplication des identifiants de trace
  assert(
    "TEST 22 — matchedRuleIds et evidenceIds dédupliqués",
    new Set(res19.matchedRuleIds).size === res19.matchedRuleIds.length &&
      new Set(res19.evidenceIds).size === res19.evidenceIds.length
  );

  // TEST 23 : Ordre déterministe et trié
  assert(
    "TEST 23 — matchedRuleIds et evidenceIds triés par ordre alphabétique stable",
    [...res19.matchedRuleIds].sort().join(",") === res19.matchedRuleIds.join(",") &&
      [...res19.evidenceIds].sort().join(",") === res19.evidenceIds.join(",")
  );

  // ==========================================
  // SECTION 5 : DIRECTIONNALITÉ STRICTE (2 TESTS)
  // ==========================================

  // TEST 24 : COMPONENT → MATERIAL résolu avec succès
  assert("TEST 24 — COMPONENT → MATERIAL résolu conformément à la règle", res11.status === "COMPATIBLE");

  // TEST 25 : Ne pas inverser automatiquement MATERIAL → COMPONENT
  // Dans NORM-14-01, il n'existe pas de règle leftEntity = "MATERIAL", rightEntity = "PIPE"
  const matrixResultInverse = matrixEngine.resolveCompatibility(
    "MATERIAL",
    "SYNTHETIC_MATERIAL_001",
    "PIPE",
    "SYNTHETIC_PIPE_001"
  );
  assert(
    "TEST 25 — Directionnalité stricte : relation inverse MATERIAL → COMPONENT reste UNVERIFIED sans règle explicite",
    matrixResultInverse.status === "UNVERIFIED"
  );

  // ==========================================
  // SECTION 6 : ANTI-HÉURISTIQUE & IDENTIFIANTS OPAQUES (3 TESTS)
  // ==========================================

  // TEST 26 : PIPE_MAT_CS_A106 accepté comme identifiant structurellement valide
  const valComp26 = validateNormativeComponentMaterialReference({
    componentType: "PIPE",
    componentId: "PIPE_MAT_CS_A106",
  });
  assert("TEST 26 — PIPE_MAT_CS_A106 accepté comme identifiant valide sans heuristique", valComp26.valid);

  // TEST 27 : VALVE_CRMO_TEST accepté comme identifiant structurellement valide
  const valComp27 = validateNormativeComponentMaterialReference({
    componentType: "VALVE",
    componentId: "VALVE_CRMO_TEST",
  });
  assert("TEST 27 — VALVE_CRMO_TEST accepté comme identifiant valide sans heuristique", valComp27.valid);

  // TEST 28 : SYNTHETIC_STAINLESS_001 accepté comme identifiant matériau structurellement valide
  const valMat28 = validateNormativeMaterialReference({
    materialId: "SYNTHETIC_STAINLESS_001",
  });
  assert("TEST 28 — SYNTHETIC_STAINLESS_001 accepté comme identifiant matériau valide sans heuristique", valMat28.valid);

  // ==========================================
  // SECTION 7 : ARCHITECTURE & SÉCURITÉ (4 TESTS)
  // ==========================================

  // TEST 29 : Injection obligatoire du moteur NORM-14-01 dans le constructeur
  let threwOnMissingEngine = false;
  try {
    new (NormativeComponentMaterialCompatibilityEngine as any)(null);
  } catch {
    threwOnMissingEngine = true;
  }
  assert("TEST 29 — Constructeur rejette formellement l'absence d'instance NORM-14-01", threwOnMissingEngine);

  // TEST 30 : Absence de second registre de règles (utilise strictement le registre NORM-14-01 injecté)
  const emptyMatrixRegistry = new NormativeCompatibilityMatrixRegistry();
  const emptyMatrixEngine = new NormativeCompatibilityMatrixEngine(emptyMatrixRegistry, testEvidenceResolver);
  const emptyAdapter = new NormativeComponentMaterialCompatibilityEngine(emptyMatrixEngine);
  const resEmpty = emptyAdapter.resolveCompatibility(validQuery);
  assert(
    "TEST 30 — Absence de second registre : un moteur NORM-14-01 vide produit UNVERIFIED sans règles inventées",
    resEmpty.status === "UNVERIFIED" && resEmpty.matchedRuleIds.length === 0
  );

  // TEST 31 : Immuabilité absolue du résultat (deep freeze)
  assert(
    "TEST 31 — Résultat retourné gelé en profondeur (Object.isFrozen)",
    Object.isFrozen(res11) &&
      Object.isFrozen(res11.component) &&
      Object.isFrozen(res11.material) &&
      Object.isFrozen(res11.matchedRuleIds) &&
      Object.isFrozen(res11.evidenceIds)
  );

  // TEST 32 : Déterminisme absolu de l'évaluation
  const res11Bis = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    material: { materialId: "SYNTHETIC_MATERIAL_001" },
  });
  assert(
    "TEST 32 — Déterminisme : deux évaluations identiques produisent des résultats identiques",
    res11.status === res11Bis.status &&
      res11.matchedRuleIds.join(",") === res11Bis.matchedRuleIds.join(",") &&
      res11.evidenceIds.join(",") === res11Bis.evidenceIds.join(",")
  );

  return {
    success: allPass,
    testsRun,
    results,
  };
}
