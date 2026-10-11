/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ RATING COMPATIBILITY TESTS
 * Reference: NORM-14-04 (Component ↔ Rating / Pressure Rating Compatibility)
 * 
 * Tests d'intégrité, de conformité, de traçabilité et de déterminisme
 * pour l'adapter Component ↔ Rating (PIPE, FITTING, FLANGE, VALVE ↔ RATING).
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B16.5, Class 150/300/600, PN16/40, ISO, EN).
 * Identifiants et fixtures strictement synthétiques (SYNTHETIC_*).
 */

import type {
  NormativeComponentRatingCompatibilityQuery,
} from "../types/normativeComponentRatingCompatibilityTypes";
import {
  validateNormativeComponentRatingReference,
  validateNormativeRatingReference,
  validateNormativeComponentRatingCompatibilityQuery,
} from "../validators/normativeComponentRatingCompatibilityValidator";
import { NormativeComponentRatingCompatibilityEngine } from "../engine/normativeComponentRatingCompatibilityEngine";
import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

export function runNormativeComponentRatingCompatibilityTests(): {
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
    evidenceId: "SYNTHETIC_EVIDENCE_RAT_01",
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
    evidenceId: "SYNTHETIC_EVIDENCE_RAT_02",
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
  const engine = new NormativeComponentRatingCompatibilityEngine(matrixEngine);

  // ==========================================
  // SECTION 1 : VALIDATION (10 TESTS)
  // ==========================================

  // TEST 1 : Requête valide
  const validQuery: NormativeComponentRatingCompatibilityQuery = {
    component: {
      componentType: "PIPE",
      componentId: "SYNTHETIC_PIPE_001",
    },
    rating: {
      ratingId: "SYNTHETIC_RATING_001",
    },
  };
  const val1 = validateNormativeComponentRatingCompatibilityQuery(validQuery);
  assert("TEST 01 — Requête valide passe la validation structurelle", val1.valid && val1.errors.length === 0);

  // TEST 2 : Requête null
  const val2 = validateNormativeComponentRatingCompatibilityQuery(null);
  assert(
    "TEST 02 — Requête null rejetée avec INVALID_QUERY_OBJECT",
    !val2.valid && val2.errors.some((e) => e.code === "INVALID_QUERY_OBJECT")
  );

  // TEST 3 : Requête primitive
  const val3Num = validateNormativeComponentRatingCompatibilityQuery(42);
  const val3Str = validateNormativeComponentRatingCompatibilityQuery("INVALID_QUERY");
  assert("TEST 03 — Requête primitive rejetée", !val3Num.valid && !val3Str.valid);

  // TEST 4 : Composant absent
  const val4 = validateNormativeComponentRatingCompatibilityQuery({
    rating: { ratingId: "SYNTHETIC_RATING_001" },
  });
  assert(
    "TEST 04 — Composant absent rejeté avec MISSING_COMPONENT_REFERENCE",
    !val4.valid && val4.errors.some((e) => e.code === "MISSING_COMPONENT_REFERENCE")
  );

  // TEST 5 : Rating absent
  const val5 = validateNormativeComponentRatingCompatibilityQuery({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  assert(
    "TEST 05 — Rating absent rejeté avec MISSING_RATING_REFERENCE",
    !val5.valid && val5.errors.some((e) => e.code === "MISSING_RATING_REFERENCE")
  );

  // TEST 6 : Type composant invalide
  const val6 = validateNormativeComponentRatingReference({
    componentType: "GASKET" as any,
    componentId: "SYNTHETIC_GASKET_001",
  });
  assert(
    "TEST 06 — Type composant invalide rejeté avec INVALID_COMPONENT_TYPE",
    !val6.valid && val6.errors.some((e) => e.code === "INVALID_COMPONENT_TYPE")
  );

  // TEST 7 : componentId vide ou espaces seuls
  const val7Empty = validateNormativeComponentRatingReference({
    componentType: "PIPE",
    componentId: "",
  });
  const val7Ws = validateNormativeComponentRatingReference({
    componentType: "PIPE",
    componentId: "   ",
  });
  assert(
    "TEST 07 — componentId vide ou espaces seuls rejeté avec EMPTY_COMPONENT_ID",
    !val7Empty.valid && !val7Ws.valid && val7Empty.errors.some((e) => e.code === "EMPTY_COMPONENT_ID")
  );

  // TEST 8 : ratingId vide ou espaces seuls
  const val8Empty = validateNormativeRatingReference({ ratingId: "" });
  const val8Ws = validateNormativeRatingReference({ ratingId: "   " });
  assert(
    "TEST 08 — ratingId vide ou espaces seuls rejeté avec EMPTY_RATING_ID",
    !val8Empty.valid && !val8Ws.valid && val8Empty.errors.some((e) => e.code === "EMPTY_RATING_ID")
  );

  // TEST 9 : componentId non-string
  const val9 = validateNormativeComponentRatingReference({
    componentType: "PIPE",
    componentId: 12345 as any,
  });
  assert(
    "TEST 09 — componentId non-string rejeté avec INVALID_COMPONENT_ID_TYPE",
    !val9.valid && val9.errors.some((e) => e.code === "INVALID_COMPONENT_ID_TYPE")
  );

  // TEST 10 : ratingId non-string
  const val10 = validateNormativeRatingReference({
    ratingId: { id: "RAT" } as any,
  });
  assert(
    "TEST 10 — ratingId non-string rejeté avec INVALID_RATING_ID_TYPE",
    !val10.valid && val10.errors.some((e) => e.code === "INVALID_RATING_ID_TYPE")
  );

  // ==========================================
  // SECTION 2 : RÉSOLUTION PAR FAMILLE DE COMPOSANT (4 TESTS)
  // ==========================================

  // Enregistrement de règles synthétiques vérifiées pour les 4 familles
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_RAT_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FITTING_RAT_01",
    leftEntityType: "FITTING",
    leftEntityId: "SYNTHETIC_FITTING_001",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FLANGE_RAT_01",
    leftEntityType: "FLANGE",
    leftEntityId: "SYNTHETIC_FLANGE_001",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_VALVE_RAT_01",
    leftEntityType: "VALVE",
    leftEntityId: "SYNTHETIC_VALVE_001",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_01"],
  });

  // TEST 11 : PIPE + RATING
  const res11 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    rating: { ratingId: "SYNTHETIC_RATING_001" },
  });
  assert("TEST 11 — Résolution PIPE + RATING → COMPATIBLE", res11.status === "COMPATIBLE");

  // TEST 12 : FITTING + RATING
  const res12 = engine.resolveCompatibility({
    component: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
    rating: { ratingId: "SYNTHETIC_RATING_001" },
  });
  assert("TEST 12 — Résolution FITTING + RATING → COMPATIBLE", res12.status === "COMPATIBLE");

  // TEST 13 : FLANGE + RATING
  const res13 = engine.resolveCompatibility({
    component: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_001" },
    rating: { ratingId: "SYNTHETIC_RATING_001" },
  });
  assert("TEST 13 — Résolution FLANGE + RATING → COMPATIBLE", res13.status === "COMPATIBLE");

  // TEST 14 : VALVE + RATING
  const res14 = engine.resolveCompatibility({
    component: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_001" },
    rating: { ratingId: "SYNTHETIC_RATING_001" },
  });
  assert("TEST 14 — Résolution VALVE + RATING → COMPATIBLE", res14.status === "COMPATIBLE");

  // ==========================================
  // SECTION 3 : STATUTS & RÈGLES NORMATIVES (5 TESTS)
  // ==========================================

  // Règle INCOMPATIBLE vérifiée
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_RAT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_INCOMPAT",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_02"],
    notes: "Incompatible synthetic rating pair",
  });

  // TEST 15 : Règle COMPATIBLE
  assert("TEST 15 — Statut COMPATIBLE respecté", res11.status === "COMPATIBLE");

  // TEST 16 : Règle INCOMPATIBLE
  const res16 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    rating: { ratingId: "SYNTHETIC_RATING_INCOMPAT" },
  });
  assert(
    "TEST 16 — Statut INCOMPATIBLE respecté pour paire incompatible vérifiée",
    res16.status === "INCOMPATIBLE" && res16.matchedRuleIds.includes("SYN_RULE_PIPE_RAT_INCOMPAT")
  );

  // TEST 17 : Aucune règle correspondante → UNVERIFIED (et non INCOMPATIBLE)
  const res17 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    rating: { ratingId: "SYNTHETIC_RATING_UNKNOWN" },
  });
  assert(
    "TEST 17 — Absence de règle retourne UNVERIFIED et NON INCOMPATIBLE",
    res17.status === "UNVERIFIED" && res17.matchedRuleIds.length === 0
  );

  // Règle avec évidence UNVERIFIED
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_RAT_UNVERIFIED_EVID",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_002",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_002",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_UNVERIFIED"],
  });

  // TEST 18 : Règle non vérifiée → UNVERIFIED
  const res18 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_002" },
    rating: { ratingId: "SYNTHETIC_RATING_002" },
  });
  assert("TEST 18 — Règle sans évidence vérifiée retourne UNVERIFIED", res18.status === "UNVERIFIED");

  // Conflit entre deux règles vérifiées contradictoires (COMPATIBLE vs INCOMPATIBLE)
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RAT_CONF",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_01"],
  });
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RAT_CONF",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVIDENCE_RAT_02"],
  });

  // TEST 19 : Conflit de règles vérifiées → INVALID avec conflictCode
  const res19 = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_CONF" },
    rating: { ratingId: "SYNTHETIC_RAT_CONF" },
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
    res11.matchedRuleIds.length === 1 && res11.matchedRuleIds[0] === "SYN_RULE_PIPE_RAT_01"
  );

  // TEST 21 : evidenceIds conservés
  assert(
    "TEST 21 — evidenceIds exactement préservés depuis NORM-14-01",
    res11.evidenceIds.length === 1 && res11.evidenceIds[0] === "SYNTHETIC_EVIDENCE_RAT_01"
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

  // TEST 24 : COMPONENT → RATING résolu avec succès
  assert("TEST 24 — COMPONENT → RATING résolu conformément à la règle", res11.status === "COMPATIBLE");

  // TEST 25 : Ne pas inverser automatiquement RATING → COMPONENT
  // Dans NORM-14-01, il n'existe pas de règle leftEntity = "RATING", rightEntity = "PIPE"
  const matrixResultInverse = matrixEngine.resolveCompatibility(
    "RATING",
    "SYNTHETIC_RATING_001",
    "PIPE",
    "SYNTHETIC_PIPE_001"
  );
  assert(
    "TEST 25 — Directionnalité stricte : relation inverse RATING → COMPONENT reste UNVERIFIED sans règle explicite",
    matrixResultInverse.status === "UNVERIFIED"
  );

  // ==========================================
  // SECTION 6 : ANTI-HÉURISTIQUE & IDENTIFIANTS OPAQUES (4 TESTS)
  // ==========================================

  // TEST 26 : SYNTHETIC_CLASS_150 accepté comme identifiant structurellement valide et opaque
  const valRat26 = validateNormativeRatingReference({
    ratingId: "SYNTHETIC_CLASS_150",
  });
  assert("TEST 26 — SYNTHETIC_CLASS_150 accepté comme identifiant valide sans heuristique", valRat26.valid);

  // TEST 27 : SYNTHETIC_PN_16 accepté comme identifiant structurellement valide et opaque
  const valRat27 = validateNormativeRatingReference({
    ratingId: "SYNTHETIC_PN_16",
  });
  assert("TEST 27 — SYNTHETIC_PN_16 accepté comme identifiant valide sans heuristique", valRat27.valid);

  // TEST 28 : SYNTHETIC_PRESSURE_300 accepté comme identifiant rating valide sans heuristique
  const valRat28 = validateNormativeRatingReference({
    ratingId: "SYNTHETIC_PRESSURE_300",
  });
  assert("TEST 28 — SYNTHETIC_PRESSURE_300 accepté comme identifiant rating valide sans heuristique", valRat28.valid);

  // TEST 29 : SYNTHETIC_VALVE_CLASS_TEST accepté comme identifiant composant valide sans heuristique
  const valComp29 = validateNormativeComponentRatingReference({
    componentType: "VALVE",
    componentId: "SYNTHETIC_VALVE_CLASS_TEST",
  });
  assert("TEST 29 — SYNTHETIC_VALVE_CLASS_TEST accepté comme identifiant valide sans heuristique", valComp29.valid);

  // ==========================================
  // SECTION 7 : ARCHITECTURE & SÉCURITÉ (7 TESTS)
  // ==========================================

  // TEST 30 : Injection obligatoire du moteur NORM-14-01 dans le constructeur
  let threwOnMissingEngine = false;
  try {
    new (NormativeComponentRatingCompatibilityEngine as any)(null);
  } catch {
    threwOnMissingEngine = true;
  }
  assert("TEST 30 — Constructeur rejette formellement l'absence d'instance NORM-14-01", threwOnMissingEngine);

  // TEST 31 : Absence de second registre de règles (utilise strictement le registre NORM-14-01 injecté)
  const emptyMatrixRegistry = new NormativeCompatibilityMatrixRegistry();
  const emptyMatrixEngine = new NormativeCompatibilityMatrixEngine(emptyMatrixRegistry, testEvidenceResolver);
  const emptyAdapter = new NormativeComponentRatingCompatibilityEngine(emptyMatrixEngine);
  const resEmpty = emptyAdapter.resolveCompatibility(validQuery);
  assert(
    "TEST 31 — Absence de second registre : un moteur NORM-14-01 vide produit UNVERIFIED sans règles inventées",
    resEmpty.status === "UNVERIFIED" && resEmpty.matchedRuleIds.length === 0
  );

  // TEST 32 : Immuabilité absolue du résultat (deep freeze)
  assert(
    "TEST 32 — Résultat retourné gelé en profondeur (Object.isFrozen)",
    Object.isFrozen(res11) &&
      Object.isFrozen(res11.component) &&
      Object.isFrozen(res11.rating) &&
      Object.isFrozen(res11.matchedRuleIds) &&
      Object.isFrozen(res11.evidenceIds)
  );

  // TEST 33 : Déterminisme absolu de l'évaluation
  const res11Bis = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    rating: { ratingId: "SYNTHETIC_RATING_001" },
  });
  assert(
    "TEST 33 — Déterminisme : deux évaluations identiques produisent des résultats identiques",
    res11.status === res11Bis.status &&
      res11.matchedRuleIds.join(",") === res11Bis.matchedRuleIds.join(",") &&
      res11.evidenceIds.join(",") === res11Bis.evidenceIds.join(",")
  );

  // TEST 34 : Propagation exacte du conflictCode
  assert(
    "TEST 34 — conflictCode correctement propagé depuis NORM-14-01",
    res19.conflictCode === "COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES"
  );

  // TEST 35 : Aucune conversion Class/PN (absence de règle explicite = UNVERIFIED même avec noms évoquant des classes)
  const resNoConversion = engine.resolveCompatibility({
    component: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_CLASS_150" },
    rating: { ratingId: "SYNTHETIC_RATING_PN_16" },
  });
  assert(
    "TEST 35 — Aucune conversion implicite Class ↔ PN : résultat UNVERIFIED sans règle explicite",
    resNoConversion.status === "UNVERIFIED"
  );

  // TEST 36 : Aucun fallback en cas de requête invalide
  const resInvalidQuery = engine.resolveCompatibility({
    component: { componentType: "INVALID_COMP" as any, componentId: "" },
    rating: { ratingId: "" },
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
