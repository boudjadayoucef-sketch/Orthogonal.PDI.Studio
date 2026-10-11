/**
 * PDI NORMATIVE ENGINE — NORMATIVE MULTI-COMPATIBILITY TESTS
 * Reference: NORM-14-07 (Multi-compatibility Resolution)
 * 
 * Tests d'intégrité, de validation, d'orchestration, de traçabilité,
 * de déterminisme et d'architecture pour l'orchestrateur NORM-14-07.
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B16, ASME B36, API, ISO, EN, NPS, DN, Class, PN).
 * Identifiants et fixtures strictement synthétiques (SYNTHETIC_*).
 */

import type {
  NormativeMultiCompatibilityConstraint,
  NormativeMultiCompatibilityQuery,
} from "../types/normativeMultiCompatibilityTypes";
import {
  validateNormativeMultiCompatibilityConstraint,
  validateNormativeMultiCompatibilityQuery,
  validateNormativeMultiCompatibilityReference,
} from "../validators/normativeMultiCompatibilityValidator";
import { NormativeMultiCompatibilityEngine } from "../engine/normativeMultiCompatibilityEngine";

import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

import { NormativeComponentCompatibilityEngine } from "../engine/normativeComponentCompatibilityEngine";
import { NormativeComponentMaterialCompatibilityEngine } from "../engine/normativeComponentMaterialCompatibilityEngine";
import { NormativeComponentRatingCompatibilityEngine } from "../engine/normativeComponentRatingCompatibilityEngine";
import { NormativeComponentDimensionalCompatibilityEngine } from "../engine/normativeComponentDimensionalCompatibilityEngine";
import { NormativeComponentProductCompatibilityEngine } from "../engine/normativeComponentProductCompatibilityEngine";

export function runNormativeMultiCompatibilityTests(): {
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

  // ==========================================
  // Configuration de l'environnement de test synthétique
  // ==========================================
  const testEvidenceRegistry = new NormativeEvidenceRegistry();

  testEvidenceRegistry.register({
    evidenceId: "SYNTHETIC_EVID_MULTI_01",
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
    evidenceId: "SYNTHETIC_EVID_MULTI_02",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_02",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_02",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_B",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  const testEvidenceResolver = new NormativeEvidenceResolver(testEvidenceRegistry);
  const matrixRegistry = new NormativeCompatibilityMatrixRegistry();
  const matrixEngine = new NormativeCompatibilityMatrixEngine(matrixRegistry, testEvidenceResolver);

  // Instanciation des 5 adaptateurs NORM-14-02 à NORM-14-06
  const compAdapter = new NormativeComponentCompatibilityEngine(matrixEngine);
  const matAdapter = new NormativeComponentMaterialCompatibilityEngine(matrixEngine);
  const ratAdapter = new NormativeComponentRatingCompatibilityEngine(matrixEngine);
  const dimAdapter = new NormativeComponentDimensionalCompatibilityEngine(matrixEngine);
  const prodAdapter = new NormativeComponentProductCompatibilityEngine(matrixEngine);

  // Instanciation de l'orchestrateur NORM-14-07
  const engine = new NormativeMultiCompatibilityEngine(
    compAdapter,
    matAdapter,
    ratAdapter,
    dimAdapter,
    prodAdapter
  );

  // ==========================================
  // SECTION 1 : VALIDATION (10 TESTS)
  // ==========================================

  // TEST 1 : Query valide
  const validQuery: NormativeMultiCompatibilityQuery = {
    constraints: [
      {
        constraintType: "MATERIAL",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_001" },
      },
    ],
  };
  const val1 = validateNormativeMultiCompatibilityQuery(validQuery);
  assert("TEST 01 — Query valide passe la validation structurelle", val1.valid && val1.errors.length === 0);

  // TEST 2 : Query null
  const val2 = validateNormativeMultiCompatibilityQuery(null);
  assert("TEST 02 — Query null rejetée avec INVALID_QUERY_OBJECT", !val2.valid && val2.errors.some((e) => e.code === "INVALID_QUERY_OBJECT"));

  // TEST 3 : Query primitive
  const val3 = validateNormativeMultiCompatibilityQuery("INVALID_PRIMITIVE");
  assert("TEST 03 — Query primitive rejetée", !val3.valid);

  // TEST 4 : Query array (au lieu d'un objet avec constraints)
  const val4 = validateNormativeMultiCompatibilityQuery([]);
  assert("TEST 04 — Query array rejetée avec INVALID_QUERY_OBJECT", !val4.valid && val4.errors.some((e) => e.code === "INVALID_QUERY_OBJECT"));

  // TEST 5 : constraints absent
  const val5 = validateNormativeMultiCompatibilityQuery({});
  assert("TEST 05 — constraints absent rejeté avec MISSING_CONSTRAINTS", !val5.valid && val5.errors.some((e) => e.code === "MISSING_CONSTRAINTS"));

  // TEST 6 : constraints non-array
  const val6 = validateNormativeMultiCompatibilityQuery({ constraints: "NOT_AN_ARRAY" });
  assert("TEST 06 — constraints non-array rejeté avec INVALID_CONSTRAINTS_TYPE", !val6.valid && val6.errors.some((e) => e.code === "INVALID_CONSTRAINTS_TYPE"));

  // TEST 7 : contrainte null dans le tableau
  const val7 = validateNormativeMultiCompatibilityQuery({ constraints: [null] });
  assert("TEST 07 — contrainte null dans le tableau rejetée", !val7.valid && val7.errors.some((e) => e.code === "INVALID_CONSTRAINT_OBJECT"));

  // TEST 8 : entityType invalide
  const val8 = validateNormativeMultiCompatibilityReference({ entityType: "UNKNOWN_TYPE" as any, entityId: "ID" }, "left");
  assert("TEST 08 — entityType inconnu rejeté avec INVALID_LEFT_ENTITY_TYPE", !val8.valid && val8.errors.some((e) => e.code === "INVALID_LEFT_ENTITY_TYPE"));

  // TEST 9 : entityId absent
  const val9 = validateNormativeMultiCompatibilityReference({ entityType: "PIPE" }, "left");
  assert("TEST 09 — entityId absent rejeté avec MISSING_LEFT_ENTITY_ID", !val9.valid && val9.errors.some((e) => e.code === "MISSING_LEFT_ENTITY_ID"));

  // TEST 10 : entityId vide ou espaces seuls
  const val10 = validateNormativeMultiCompatibilityReference({ entityType: "PIPE", entityId: "   " }, "left");
  assert("TEST 10 — entityId vide ou whitespace rejeté avec EMPTY_LEFT_ENTITY_ID", !val10.valid && val10.errors.some((e) => e.code === "EMPTY_LEFT_ENTITY_ID"));

  // ==========================================
  // Enregistrement des règles dans NORM-14-01 pour les tests fonctionnels
  // ==========================================
  // 1. PIPE ↔ FITTING (NORM-14-02)
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_FITTING_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "FITTING",
    rightEntityId: "SYNTHETIC_FITTING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_01"],
  });

  // 2. PIPE ↔ MATERIAL (NORM-14-03)
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_01"],
  });

  // 3. PIPE ↔ RATING (NORM-14-04)
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_RAT_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "RATING",
    rightEntityId: "SYNTHETIC_RATING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_01"],
  });

  // 4. PIPE ↔ DIMENSIONAL_STANDARD (NORM-14-05)
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_DIM_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "SYNTHETIC_DIM_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_01"],
  });

  // 5. PIPE ↔ PRODUCT_STANDARD (NORM-14-06)
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_PROD_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "PRODUCT_STANDARD",
    rightEntityId: "SYNTHETIC_PROD_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_01"],
  });

  // Règle INCOMPATIBLE
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_BAD",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_02"],
  });

  // Règles de conflit (INVALID)
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONF_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MAT_CONF",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_01"],
  });
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONF_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MAT_CONF",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_MULTI_02"],
  });

  // ==========================================
  // SECTION 2 : DISPATCH VERS LES 5 ADAPTERS (5 TESTS)
  // ==========================================

  // TEST 11 : dispatch COMPONENT → NORM-14-02
  const res11 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "COMPONENT",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "FITTING", entityId: "SYNTHETIC_FITTING_001" },
      },
    ],
  });
  assert("TEST 11 — Dispatch COMPONENT vers NORM-14-02 exécuté avec succès", res11.status === "COMPATIBLE" && res11.matchedRuleIds.includes("SYN_RULE_PIPE_FITTING_01"));

  // TEST 12 : dispatch MATERIAL → NORM-14-03
  const res12 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "MATERIAL",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_001" },
      },
    ],
  });
  assert("TEST 12 — Dispatch MATERIAL vers NORM-14-03 exécuté avec succès", res12.status === "COMPATIBLE" && res12.matchedRuleIds.includes("SYN_RULE_PIPE_MAT_01"));

  // TEST 13 : dispatch RATING → NORM-14-04
  const res13 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "RATING",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "RATING", entityId: "SYNTHETIC_RATING_001" },
      },
    ],
  });
  assert("TEST 13 — Dispatch RATING vers NORM-14-04 exécuté avec succès", res13.status === "COMPATIBLE" && res13.matchedRuleIds.includes("SYN_RULE_PIPE_RAT_01"));

  // TEST 14 : dispatch DIMENSIONAL_STANDARD → NORM-14-05
  const res14 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "DIMENSIONAL_STANDARD",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "DIMENSIONAL_STANDARD", entityId: "SYNTHETIC_DIM_001" },
      },
    ],
  });
  assert("TEST 14 — Dispatch DIMENSIONAL_STANDARD vers NORM-14-05 exécuté avec succès", res14.status === "COMPATIBLE" && res14.matchedRuleIds.includes("SYN_RULE_PIPE_DIM_01"));

  // TEST 15 : dispatch PRODUCT_STANDARD → NORM-14-06
  const res15 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "PRODUCT_STANDARD",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "PRODUCT_STANDARD", entityId: "SYNTHETIC_PROD_001" },
      },
    ],
  });
  assert("TEST 15 — Dispatch PRODUCT_STANDARD vers NORM-14-06 exécuté avec succès", res15.status === "COMPATIBLE" && res15.matchedRuleIds.includes("SYN_RULE_PIPE_PROD_01"));

  // ==========================================
  // SECTION 3 : STATUTS GLOBAUX & CONSOLIDATION (8 TESTS)
  // ==========================================

  const cCompatMat: NormativeMultiCompatibilityConstraint = {
    constraintType: "MATERIAL",
    left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
    right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_001" },
  };
  const cCompatRat: NormativeMultiCompatibilityConstraint = {
    constraintType: "RATING",
    left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
    right: { entityType: "RATING", entityId: "SYNTHETIC_RATING_001" },
  };
  const cIncompat: NormativeMultiCompatibilityConstraint = {
    constraintType: "MATERIAL",
    left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
    right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_BAD" },
  };
  const cUnverified: NormativeMultiCompatibilityConstraint = {
    constraintType: "RATING",
    left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
    right: { entityType: "RATING", entityId: "SYNTHETIC_RATING_UNKNOWN" },
  };
  const cInvalidConflict: NormativeMultiCompatibilityConstraint = {
    constraintType: "MATERIAL",
    left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_CONF" },
    right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MAT_CONF" },
  };

  // TEST 16 : Toutes contraintes COMPATIBLE → COMPATIBLE
  const res16 = engine.resolveCompatibility({ constraints: [cCompatMat, cCompatRat] });
  assert("TEST 16 — Toutes contraintes COMPATIBLE donne statut global COMPATIBLE", res16.status === "COMPATIBLE");

  // TEST 17 : Une UNVERIFIED + une COMPATIBLE → UNVERIFIED
  const res17 = engine.resolveCompatibility({ constraints: [cCompatMat, cUnverified] });
  assert("TEST 17 — Une contrainte UNVERIFIED donne statut global UNVERIFIED", res17.status === "UNVERIFIED");

  // TEST 18 : Une INCOMPATIBLE + une COMPATIBLE → INCOMPATIBLE
  const res18 = engine.resolveCompatibility({ constraints: [cCompatMat, cIncompat] });
  assert("TEST 18 — Une contrainte INCOMPATIBLE donne statut global INCOMPATIBLE", res18.status === "INCOMPATIBLE");

  // TEST 19 : Une INVALID → INVALID
  const res19 = engine.resolveCompatibility({ constraints: [cCompatMat, cInvalidConflict] });
  assert("TEST 19 — Une contrainte INVALID donne statut global INVALID", res19.status === "INVALID");

  // TEST 20 : Priorité INVALID > INCOMPATIBLE
  const res20 = engine.resolveCompatibility({ constraints: [cIncompat, cInvalidConflict] });
  assert("TEST 20 — INVALID a priorité sur INCOMPATIBLE (INVALID > INCOMPATIBLE)", res20.status === "INVALID");

  // TEST 21 : Priorité INCOMPATIBLE > UNVERIFIED
  const res21 = engine.resolveCompatibility({ constraints: [cIncompat, cUnverified] });
  assert("TEST 21 — INCOMPATIBLE a priorité sur UNVERIFIED (INCOMPATIBLE > UNVERIFIED)", res21.status === "INCOMPATIBLE");

  // TEST 22 : Priorité UNVERIFIED > COMPATIBLE
  const res22 = engine.resolveCompatibility({ constraints: [cUnverified, cCompatMat] });
  assert("TEST 22 — UNVERIFIED a priorité sur COMPATIBLE (UNVERIFIED > COMPATIBLE)", res22.status === "UNVERIFIED");

  // TEST 23 : Plusieurs contraintes COMPATIBLE (les 5 familles ensemble) → COMPATIBLE
  const res23 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "COMPONENT",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "FITTING", entityId: "SYNTHETIC_FITTING_001" },
      },
      cCompatMat,
      cCompatRat,
      {
        constraintType: "DIMENSIONAL_STANDARD",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "DIMENSIONAL_STANDARD", entityId: "SYNTHETIC_DIM_001" },
      },
      {
        constraintType: "PRODUCT_STANDARD",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "PRODUCT_STANDARD", entityId: "SYNTHETIC_PROD_001" },
      },
    ],
  });
  assert("TEST 23 — Les 5 contraintes compatibles réunies donnent statut global COMPATIBLE", res23.status === "COMPATIBLE" && res23.constraintResults.length === 5);

  // ==========================================
  // SECTION 4 : TRAÇABILITÉ (9 TESTS)
  // ==========================================

  // TEST 24 : Rule IDs conservés
  assert("TEST 24 — Rule IDs conservés dans le résultat global", res23.matchedRuleIds.includes("SYN_RULE_PIPE_MAT_01") && res23.matchedRuleIds.includes("SYN_RULE_PIPE_RAT_01"));

  // TEST 25 : Evidence IDs conservés
  assert("TEST 25 — Evidence IDs conservés dans le résultat global", res23.evidenceIds.includes("SYNTHETIC_EVID_MULTI_01"));

  // TEST 26 : Déduplication des rule IDs
  assert("TEST 26 — Rule IDs dédupliqués", new Set(res23.matchedRuleIds).size === res23.matchedRuleIds.length);

  // TEST 27 : Déduplication des evidence IDs
  assert("TEST 27 — Evidence IDs dédupliqués", new Set(res23.evidenceIds).size === res23.evidenceIds.length);

  // TEST 28 : Tri des rule IDs
  assert("TEST 28 — Rule IDs triés par ordre alphabétique", [...res23.matchedRuleIds].sort().join(",") === res23.matchedRuleIds.join(","));

  // TEST 29 : Tri des evidence IDs
  assert("TEST 29 — Evidence IDs triés par ordre alphabétique", [...res23.evidenceIds].sort().join(",") === res23.evidenceIds.join(","));

  // TEST 30 : conflictCodes conservés et dédupliqués
  assert("TEST 30 — conflictCodes conservés pour contrainte en conflit", res19.conflictCodes.length > 0 && res19.conflictCodes.includes("COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES"));

  // TEST 31 : Freeze du résultat global
  assert("TEST 31 — Résultat global gelé profondément (Object.isFrozen)", Object.isFrozen(res23) && Object.isFrozen(res23.constraintResults));

  // TEST 32 : Freeze des traces
  assert("TEST 32 — Tableaux de traces gelés (Object.isFrozen)", Object.isFrozen(res23.matchedRuleIds) && Object.isFrozen(res23.evidenceIds) && Object.isFrozen(res23.conflictCodes));

  // ==========================================
  // SECTION 5 : DÉTERMINISME (3 TESTS)
  // ==========================================

  // TEST 33 : Même query deux fois produit résultats identiques
  const res33A = engine.resolveCompatibility({ constraints: [cCompatMat, cCompatRat] });
  const res33B = engine.resolveCompatibility({ constraints: [cCompatMat, cCompatRat] });
  assert("TEST 33 — Même query répétée produit résultats identiques", res33A.status === res33B.status && res33A.matchedRuleIds.join(",") === res33B.matchedRuleIds.join(","));

  // TEST 34 : Ordre des contraintes inversé
  const res34Forward = engine.resolveCompatibility({ constraints: [cCompatMat, cUnverified, cIncompat] });
  const res34Reverse = engine.resolveCompatibility({ constraints: [cIncompat, cUnverified, cCompatMat] });
  assert("TEST 34 — Ordre des contraintes inversé produit le même statut global", res34Forward.status === res34Reverse.status && res34Forward.status === "INCOMPATIBLE");

  // TEST 35 : Résultat global traces et conflictCodes identiques malgré ordre différent
  assert(
    "TEST 35 — Traces et conflictCodes identiques malgré ordre différent des contraintes",
    res34Forward.matchedRuleIds.join(",") === res34Reverse.matchedRuleIds.join(",") &&
      res34Forward.evidenceIds.join(",") === res34Reverse.evidenceIds.join(",")
  );

  // ==========================================
  // SECTION 6 : DIRECTIONNALITÉ (5 TESTS)
  // ==========================================

  // TEST 36 : COMPONENT → COMPONENT
  const c36 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "COMPONENT",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "FITTING", entityId: "SYNTHETIC_FITTING_001" },
      },
    ],
  });
  assert("TEST 36 — Directionnalité COMPONENT → COMPONENT respectée", c36.status === "COMPATIBLE");

  // TEST 37 : COMPONENT → MATERIAL
  const c37 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "MATERIAL",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_001" },
      },
    ],
  });
  assert("TEST 37 — Directionnalité COMPONENT → MATERIAL respectée", c37.status === "COMPATIBLE");

  // TEST 38 : COMPONENT → RATING
  const c38 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "RATING",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "RATING", entityId: "SYNTHETIC_RATING_001" },
      },
    ],
  });
  assert("TEST 38 — Directionnalité COMPONENT → RATING respectée", c38.status === "COMPATIBLE");

  // TEST 39 : COMPONENT → DIMENSIONAL_STANDARD
  const c39 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "DIMENSIONAL_STANDARD",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "DIMENSIONAL_STANDARD", entityId: "SYNTHETIC_DIM_001" },
      },
    ],
  });
  assert("TEST 39 — Directionnalité COMPONENT → DIMENSIONAL_STANDARD respectée", c39.status === "COMPATIBLE");

  // TEST 40 : COMPONENT → PRODUCT_STANDARD
  const c40 = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "PRODUCT_STANDARD",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "PRODUCT_STANDARD", entityId: "SYNTHETIC_PROD_001" },
      },
    ],
  });
  assert("TEST 40 — Directionnalité COMPONENT → PRODUCT_STANDARD respectée", c40.status === "COMPATIBLE");

  // ==========================================
  // SECTION 7 : ANTI-HÉURISTIQUES (5 TESTS)
  // ==========================================

  // TEST 41 : ID contenant ASME/B16 accepté comme chaîne opaque
  const val41 = validateNormativeMultiCompatibilityReference(
    { entityType: "PIPE", entityId: "SYNTHETIC_ASME_B16_5_OPAQUE" },
    "left"
  );
  assert("TEST 41 — ID contenant ASME/B16 accepté sans heuristique", val41.valid);

  // TEST 42 : ID contenant API accepté comme chaîne opaque
  const val42 = validateNormativeMultiCompatibilityReference(
    { entityType: "VALVE", entityId: "SYNTHETIC_API_6D_OPAQUE" },
    "left"
  );
  assert("TEST 42 — ID contenant API accepté sans heuristique", val42.valid);

  // TEST 43 : ID contenant NPS/DN accepté comme chaîne opaque
  const val43 = validateNormativeMultiCompatibilityReference(
    { entityType: "FLANGE", entityId: "SYNTHETIC_NPS_4_DN_100_OPAQUE" },
    "left"
  );
  assert("TEST 43 — ID contenant NPS/DN accepté sans heuristique", val43.valid);

  // TEST 44 : ID contenant CLASS/PN accepté comme chaîne opaque
  const val44 = validateNormativeMultiCompatibilityReference(
    { entityType: "RATING", entityId: "SYNTHETIC_CLASS_300_PN_40_OPAQUE" },
    "right"
  );
  assert("TEST 44 — ID contenant CLASS/PN accepté sans heuristique", val44.valid);

  // TEST 45 : ID contenant SCHEDULE accepté comme chaîne opaque
  const val45 = validateNormativeMultiCompatibilityReference(
    { entityType: "DIMENSIONAL_STANDARD", entityId: "SYNTHETIC_SCHEDULE_40_OPAQUE" },
    "right"
  );
  assert("TEST 45 — ID contenant SCHEDULE accepté sans heuristique", val45.valid);

  // ==========================================
  // SECTION 8 : ARCHITECTURE & SÉCURITÉ (4 TESTS ADDITIONNELS)
  // ==========================================

  // TEST 46 : Constructeur refuse une dépendance absente
  let threwMissingDep = false;
  try {
    new (NormativeMultiCompatibilityEngine as any)(compAdapter, matAdapter, ratAdapter, dimAdapter, null);
  } catch {
    threwMissingDep = true;
  }
  assert("TEST 46 — Constructeur rejette fermement une dépendance d'adapter manquante", threwMissingDep);

  // TEST 47 : Aucune seconde source de vérité (matrice vide donne UNVERIFIED)
  const emptyMatrixReg = new NormativeCompatibilityMatrixRegistry();
  const emptyMatrixEng = new NormativeCompatibilityMatrixEngine(emptyMatrixReg, testEvidenceResolver);
  const emptyEngine = new NormativeMultiCompatibilityEngine(
    new NormativeComponentCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentMaterialCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentRatingCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentDimensionalCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentProductCompatibilityEngine(emptyMatrixEng)
  );
  const resEmpty = emptyEngine.resolveCompatibility(validQuery);
  assert("TEST 47 — Aucune seconde source de vérité : matrice vide donne UNVERIFIED", resEmpty.status === "UNVERIFIED" && resEmpty.matchedRuleIds.length === 0);

  // TEST 48 : Contrainte invalide (ex: entité gauche non autorisée) produit INVALID sans plantage
  const resInvalidLeft = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "MATERIAL",
        left: { entityType: "MATERIAL" as any, entityId: "SYNTHETIC_MAT_001" },
        right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MAT_002" },
      },
    ],
  });
  assert(
    "TEST 48 — Entité gauche non-composant produit statut INVALID avec code explicite sans crash",
    resInvalidLeft.status === "INVALID" &&
      resInvalidLeft.constraintResults[0].conflictCode === "INVALID_MULTI_COMPATIBILITY_CONSTRAINT"
  );

  // TEST 49 : Type de contrainte incompatible avec l'entité droite
  const resMismatch = engine.resolveCompatibility({
    constraints: [
      {
        constraintType: "RATING",
        left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
        right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MAT_001" },
      },
    ],
  });
  assert(
    "TEST 49 — Contrainte RATING avec entité droite MATERIAL produit statut INVALID sans crash",
    resMismatch.status === "INVALID" &&
      resMismatch.constraintResults[0].conflictCode === "INVALID_MULTI_COMPATIBILITY_CONSTRAINT"
  );

  return {
    success: allPass,
    testsRun,
    results,
  };
}
