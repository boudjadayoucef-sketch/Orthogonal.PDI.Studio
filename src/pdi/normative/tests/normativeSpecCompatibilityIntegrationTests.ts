/**
 * PDI NORMATIVE ENGINE — NORMATIVE SPEC ↔ COMPATIBILITY INTEGRATION TESTS
 * Reference: NORM-14-08 (Integration with SPEC-01)
 * 
 * Tests d'intégrité, de validation, de délégation, de traçabilité,
 * de déterminisme et d'architecture pour l'intégration NORM-14-08.
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B16, ASME B36, API, ISO, EN, NPS, DN, Class, PN).
 * Identifiants et fixtures strictement synthétiques (SYNTHETIC_*).
 */

import type {
  NormativeSpecCompatibilityIntegrationQuery,
} from "../types/normativeSpecCompatibilityIntegrationTypes";
import type { PipingSpecResolutionResult } from "../types/pipingSpecResolverTypes";
import {
  validateNormativeSpecCompatibilityIntegrationQuery,
  validateSpecResolutionResult,
} from "../validators/normativeSpecCompatibilityIntegrationValidator";
import { NormativeSpecCompatibilityIntegrationEngine } from "../engine/normativeSpecCompatibilityIntegrationEngine";

import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

import { NormativeComponentCompatibilityEngine } from "../engine/normativeComponentCompatibilityEngine";
import { NormativeComponentMaterialCompatibilityEngine } from "../engine/normativeComponentMaterialCompatibilityEngine";
import { NormativeComponentRatingCompatibilityEngine } from "../engine/normativeComponentRatingCompatibilityEngine";
import { NormativeComponentDimensionalCompatibilityEngine } from "../engine/normativeComponentDimensionalCompatibilityEngine";
import { NormativeComponentProductCompatibilityEngine } from "../engine/normativeComponentProductCompatibilityEngine";
import { NormativeMultiCompatibilityEngine } from "../engine/normativeMultiCompatibilityEngine";

export function runNormativeSpecCompatibilityIntegrationTests(): {
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
    evidenceId: "SYNTHETIC_EVID_SPEC_01",
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
    evidenceId: "SYNTHETIC_EVID_SPEC_02",
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
  const multiEngine = new NormativeMultiCompatibilityEngine(
    compAdapter,
    matAdapter,
    ratAdapter,
    dimAdapter,
    prodAdapter
  );

  // Instanciation du moteur d'intégration NORM-14-08
  const integrationEngine = new NormativeSpecCompatibilityIntegrationEngine(multiEngine);

  // Enregistrement de règles de test dans la matrice NORM-14-01
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_SPEC_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_SPEC_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_MAT_SPEC_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MATERIAL_INCOMPAT",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_SPEC_02"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_CONF_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MAT_CONF",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_SPEC_01"],
  });
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONF_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_CONF",
    rightEntityType: "MATERIAL",
    rightEntityId: "SYNTHETIC_MAT_CONF",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EVID_SPEC_02"],
  });

  // Fixture SPEC-01 valide et compatible
  const validSpecRes: PipingSpecResolutionResult = {
    status: "COMPATIBLE",
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    matchedRuleIds: ["SPEC_RULE_001"],
    compatibilityRuleIds: ["COMPAT_RULE_001"],
    evidenceIds: ["SPEC_EVID_001"],
    message: "Spec resolution verified compatible.",
  };

  // ==========================================
  // SECTION 1 : VALIDATION (10 TESTS)
  // ==========================================

  // TEST 1 : Query valide
  const validQuery: NormativeSpecCompatibilityIntegrationQuery = {
    specResolution: validSpecRes,
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
          right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_001" },
        },
      ],
    },
  };
  const val1 = validateNormativeSpecCompatibilityIntegrationQuery(validQuery);
  assert("TEST 01 — Requête d'intégration valide passe la validation structurelle", val1.valid && val1.errors.length === 0);

  // TEST 2 : Query null
  const val2 = validateNormativeSpecCompatibilityIntegrationQuery(null);
  assert("TEST 02 — Requête null rejetée avec INVALID_QUERY_OBJECT", !val2.valid && val2.errors.some((e) => e.code === "INVALID_QUERY_OBJECT"));

  // TEST 3 : Query undefined
  const val3 = validateNormativeSpecCompatibilityIntegrationQuery(undefined);
  assert("TEST 03 — Requête undefined rejetée avec INVALID_QUERY_OBJECT", !val3.valid && val3.errors.some((e) => e.code === "INVALID_QUERY_OBJECT"));

  // TEST 4 : Query primitive
  const val4 = validateNormativeSpecCompatibilityIntegrationQuery("INVALID_PRIMITIVE");
  assert("TEST 04 — Requête primitive rejetée", !val4.valid);

  // TEST 5 : Query array
  const val5 = validateNormativeSpecCompatibilityIntegrationQuery([validQuery]);
  assert("TEST 05 — Requête sous forme de tableau rejetée avec INVALID_QUERY_OBJECT", !val5.valid && val5.errors.some((e) => e.code === "INVALID_QUERY_OBJECT"));

  // TEST 6 : specResolution absente
  const val6 = validateNormativeSpecCompatibilityIntegrationQuery({
    compatibilityQuery: validQuery.compatibilityQuery,
  });
  assert("TEST 06 — specResolution absente rejetée avec MISSING_SPEC_RESOLUTION", !val6.valid && val6.errors.some((e) => e.code === "MISSING_SPEC_RESOLUTION"));

  // TEST 7 : compatibilityQuery absente
  const val7 = validateNormativeSpecCompatibilityIntegrationQuery({
    specResolution: validSpecRes,
  });
  assert("TEST 07 — compatibilityQuery absente rejetée avec MISSING_COMPATIBILITY_QUERY", !val7.valid && val7.errors.some((e) => e.code === "MISSING_COMPATIBILITY_QUERY"));

  // TEST 8 : compatibilityQuery invalide (ex: constraints non-tableau)
  const val8 = validateNormativeSpecCompatibilityIntegrationQuery({
    specResolution: validSpecRes,
    compatibilityQuery: { constraints: "NOT_AN_ARRAY" as any },
  });
  assert("TEST 08 — compatibilityQuery invalide rejetée avec INVALID_COMPATIBILITY_QUERY", !val8.valid && val8.errors.some((e) => e.code === "INVALID_COMPATIBILITY_QUERY"));

  // TEST 9 : contrainte invalide à l'intérieur de compatibilityQuery
  const val9 = validateNormativeSpecCompatibilityIntegrationQuery({
    specResolution: validSpecRes,
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "INVALID_TYPE" as any,
          left: { entityType: "PIPE", entityId: "P1" },
          right: { entityType: "MATERIAL", entityId: "M1" },
        },
      ],
    },
  });
  assert("TEST 09 — Contrainte interne invalide rejetée avec INVALID_COMPATIBILITY_QUERY", !val9.valid && val9.errors.some((e) => e.code === "INVALID_COMPATIBILITY_QUERY"));

  // TEST 10 : IDs opaques acceptés structurellement dans specResolution
  const valSpec10 = validateSpecResolutionResult({
    status: "COMPATIBLE",
    specificationId: "SPEC_ASME_B16_5_OPAQUE",
    componentType: "PIPE_CS_A106",
  });
  assert("TEST 10 — Identifiants opaques acceptés dans specResolution sans interprétation", valSpec10.valid);

  // ==========================================
  // SECTION 2 : DEPENDENCY INJECTION & ARCHITECTURE (5 TESTS)
  // ==========================================

  // TEST 11 : Moteur NORM-14-07 injecté obligatoire dans le constructeur
  let threwMissing = false;
  try {
    new (NormativeSpecCompatibilityIntegrationEngine as any)(null);
  } catch {
    threwMissing = true;
  }
  assert("TEST 11 — Constructeur rejette formellement l'absence d'instance NORM-14-07", threwMissing);

  // TEST 12 : Absence d'instanciation interne silencieuse (constructeur ne tolère pas un objet sans resolveCompatibility)
  let threwInvalidEngine = false;
  try {
    new (NormativeSpecCompatibilityIntegrationEngine as any)({ resolveSomethingElse: () => {} });
  } catch {
    threwInvalidEngine = true;
  }
  assert("TEST 12 — Constructeur vérifie que le moteur injecté expose resolveCompatibility", threwInvalidEngine);

  // TEST 13 : Appel vérifiable au moteur injecté (délégation constatée)
  let calledInjected = false;
  const mockEngine: any = {
    resolveCompatibility: (q: any) => {
      calledInjected = true;
      return multiEngine.resolveCompatibility(q);
    },
  };
  const testEngineWithMock = new NormativeSpecCompatibilityIntegrationEngine(mockEngine);
  testEngineWithMock.resolve(validQuery);
  assert("TEST 13 — Résolution délègue obligatoirement au moteur NORM-14-07 injecté", calledInjected);

  // TEST 14 : Aucun accès direct ou contournement de NORM-14-07
  const res14 = integrationEngine.resolve(validQuery);
  assert("TEST 14 — Résultat contient un compatibilityResult complet produit par NORM-14-07", res14.compatibilityResult !== undefined && res14.compatibilityResult.status === "COMPATIBLE");

  // TEST 15 : Aucun second registry interne (moteur vide produit UNVERIFIED sans données inventées)
  const emptyMatrixReg = new NormativeCompatibilityMatrixRegistry();
  const emptyMatrixEng = new NormativeCompatibilityMatrixEngine(emptyMatrixReg, testEvidenceResolver);
  const emptyMulti = new NormativeMultiCompatibilityEngine(
    new NormativeComponentCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentMaterialCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentRatingCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentDimensionalCompatibilityEngine(emptyMatrixEng),
    new NormativeComponentProductCompatibilityEngine(emptyMatrixEng)
  );
  const emptyIntegration = new NormativeSpecCompatibilityIntegrationEngine(emptyMulti);
  const resEmpty = emptyIntegration.resolve(validQuery);
  assert("TEST 15 — Aucun second registry : matrice vide délègue et retourne UNVERIFIED", resEmpty.status === "UNVERIFIED");

  // ==========================================
  // SECTION 3 : SPEC INTEGRATION (8 TESTS)
  // ==========================================

  // TEST 16 : SPEC valide (COMPATIBLE) + compatibility COMPATIBLE → COMPATIBLE
  const res16 = integrationEngine.resolve(validQuery);
  assert("TEST 16 — SPEC COMPATIBLE + compatibility COMPATIBLE → COMPATIBLE", res16.status === "COMPATIBLE");

  // TEST 17 : SPEC valide (COMPATIBLE) + compatibility INCOMPATIBLE → INCOMPATIBLE
  const res17 = integrationEngine.resolve({
    specResolution: validSpecRes,
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
          right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_INCOMPAT" },
        },
      ],
    },
  });
  assert("TEST 17 — SPEC COMPATIBLE + compatibility INCOMPATIBLE → INCOMPATIBLE", res17.status === "INCOMPATIBLE");

  // TEST 18 : SPEC valide (COMPATIBLE) + compatibility UNVERIFIED → UNVERIFIED
  const res18 = integrationEngine.resolve({
    specResolution: validSpecRes,
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
          right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_UNKNOWN" },
        },
      ],
    },
  });
  assert("TEST 18 — SPEC COMPATIBLE + compatibility UNVERIFIED → UNVERIFIED", res18.status === "UNVERIFIED");

  // TEST 19 : SPEC INVALID + compatibility COMPATIBLE → INVALID
  const res19 = integrationEngine.resolve({
    specResolution: { ...validSpecRes, status: "INVALID" },
    compatibilityQuery: validQuery.compatibilityQuery,
  });
  assert("TEST 19 — SPEC INVALID + compatibility COMPATIBLE → INVALID", res19.status === "INVALID");

  // TEST 20 : SPEC UNVERIFIED + compatibility COMPATIBLE → UNVERIFIED
  const res20 = integrationEngine.resolve({
    specResolution: { ...validSpecRes, status: "UNVERIFIED" },
    compatibilityQuery: validQuery.compatibilityQuery,
  });
  assert("TEST 20 — SPEC UNVERIFIED + compatibility COMPATIBLE → UNVERIFIED", res20.status === "UNVERIFIED");

  // TEST 21 : SPEC status et résolution exactement conservés dans le résultat
  assert(
    "TEST 21 — specResolution conservée intacte dans le résultat final",
    res16.specResolution.specificationId === validSpecRes.specificationId &&
      res16.specResolution.status === validSpecRes.status
  );

  // TEST 22 : Aucune promotion SPEC (SPEC UNVERIFIED ne devient jamais COMPATIBLE)
  assert("TEST 22 — Aucune promotion SPEC : UNVERIFIED reste non compatible", res20.status !== "COMPATIBLE");

  // TEST 23 : Aucune perte d'information SPEC (règles et évidences de specResolution préservées)
  assert(
    "TEST 23 — Règles et évidences de specResolution préservées dans les traces",
    res16.matchedRuleIds.includes("SPEC_RULE_001") &&
      res16.matchedRuleIds.includes("COMPAT_RULE_001") &&
      res16.evidenceIds.includes("SPEC_EVID_001")
  );

  // ==========================================
  // SECTION 4 : CONSOLIDATION DES STATUTS (10 TESTS)
  // ==========================================

  // TEST 24 : Consolidation INVALID
  assert("TEST 24 — Statut consolidé INVALID lorsque SPEC ou COMPAT est INVALID", res19.status === "INVALID");

  // TEST 25 : Consolidation INCOMPATIBLE
  assert("TEST 25 — Statut consolidé INCOMPATIBLE respecté", res17.status === "INCOMPATIBLE");

  // TEST 26 : Consolidation UNVERIFIED
  assert("TEST 26 — Statut consolidé UNVERIFIED respecté", res18.status === "UNVERIFIED");

  // TEST 27 : Consolidation COMPATIBLE
  assert("TEST 27 — Statut consolidé COMPATIBLE respecté", res16.status === "COMPATIBLE");

  // TEST 28 : Priorité INVALID > INCOMPATIBLE
  const res28 = integrationEngine.resolve({
    specResolution: { ...validSpecRes, status: "INVALID" },
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
          right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_INCOMPAT" },
        },
      ],
    },
  });
  assert("TEST 28 — Priorité INVALID > INCOMPATIBLE vérifiée", res28.status === "INVALID");

  // TEST 29 : Priorité INCOMPATIBLE > UNVERIFIED
  const res29 = integrationEngine.resolve({
    specResolution: { ...validSpecRes, status: "INCOMPATIBLE" },
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_001" },
          right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MATERIAL_UNKNOWN" },
        },
      ],
    },
  });
  assert("TEST 29 — Priorité INCOMPATIBLE > UNVERIFIED vérifiée", res29.status === "INCOMPATIBLE");

  // TEST 30 : Priorité UNVERIFIED > COMPATIBLE
  assert("TEST 30 — Priorité UNVERIFIED > COMPATIBLE vérifiée", res18.status === "UNVERIFIED" && res20.status === "UNVERIFIED");

  // TEST 31 : Statut COMPATIBLE uniquement si SPEC et Compatibilité sont tous les deux COMPATIBLE
  assert(
    "TEST 31 — Statut COMPATIBLE uniquement si les deux dimensions sont compatibles",
    res16.status === "COMPATIBLE" && res17.status !== "COMPATIBLE" && res18.status !== "COMPATIBLE" && res19.status !== "COMPATIBLE"
  );

  // TEST 32 : Propagation des codes de conflit de compatibilité
  const res32Conflict = integrationEngine.resolve({
    specResolution: validSpecRes,
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "SYNTHETIC_PIPE_CONF" },
          right: { entityType: "MATERIAL", entityId: "SYNTHETIC_MAT_CONF" },
        },
      ],
    },
  });
  assert(
    "TEST 32 — Codes de conflit de NORM-14-07 propagés dans conflictCodes",
    res32Conflict.status === "INVALID" &&
      res32Conflict.conflictCodes.includes("COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES")
  );

  // TEST 33 : Statut consolidé déterministe
  const res33A = integrationEngine.resolve(validQuery);
  const res33B = integrationEngine.resolve(validQuery);
  assert("TEST 33 — Déterminisme : deux évaluations successives identiques", res33A.status === res33B.status && res33A.matchedRuleIds.join(",") === res33B.matchedRuleIds.join(","));

  // ==========================================
  // SECTION 5 : TRACEABILITY (7 TESTS)
  // ==========================================

  // TEST 34 : matchedRuleIds conservés (union SPEC + compatibility)
  assert(
    "TEST 34 — matchedRuleIds inclut les règles de SPEC-01 et NORM-14-07",
    res16.matchedRuleIds.includes("SPEC_RULE_001") &&
      res16.matchedRuleIds.includes("SYN_RULE_PIPE_MAT_SPEC_01")
  );

  // TEST 35 : evidenceIds conservés (union SPEC + compatibility)
  assert(
    "TEST 35 — evidenceIds inclut les preuves de SPEC-01 et NORM-14-07",
    res16.evidenceIds.includes("SPEC_EVID_001") &&
      res16.evidenceIds.includes("SYNTHETIC_EVID_SPEC_01")
  );

  // TEST 36 : conflictCodes conservés
  assert("TEST 36 — conflictCodes conservés et accessibles", Array.isArray(res32Conflict.conflictCodes));

  // TEST 37 : Déduplication de matchedRuleIds et evidenceIds
  assert(
    "TEST 37 — Déduplication exacte de matchedRuleIds et evidenceIds",
    new Set(res16.matchedRuleIds).size === res16.matchedRuleIds.length &&
      new Set(res16.evidenceIds).size === res16.evidenceIds.length
  );

  // TEST 38 : Tri déterministe par ordre alphabétique
  assert(
    "TEST 38 — Tri alphabétique des traces",
    [...res16.matchedRuleIds].sort().join(",") === res16.matchedRuleIds.join(",") &&
      [...res16.evidenceIds].sort().join(",") === res16.evidenceIds.join(",")
  );

  // TEST 39 : Freeze du résultat et des traces
  assert(
    "TEST 39 — Immuabilité : résultat et traces gelés avec Object.isFrozen",
    Object.isFrozen(res16) &&
      Object.isFrozen(res16.matchedRuleIds) &&
      Object.isFrozen(res16.evidenceIds) &&
      Object.isFrozen(res16.conflictCodes)
  );

  // TEST 40 : Aucune evidence inventée
  assert(
    "TEST 40 — Aucune evidence inventée : uniquement celles de SPEC et Matrix",
    res16.evidenceIds.every((id) => id === "SPEC_EVID_001" || id === "SYNTHETIC_EVID_SPEC_01")
  );

  // ==========================================
  // SECTION 6 : DIRECTIONNALITÉ (3 TESTS)
  // ==========================================

  // TEST 41 : Direction conservée lors de la transmission à NORM-14-07
  assert(
    "TEST 41 — Direction COMPONENT → MATERIAL transmise sans altération",
    res16.compatibilityResult.constraintResults[0].constraint.left.entityType === "PIPE" &&
      res16.compatibilityResult.constraintResults[0].constraint.right.entityType === "MATERIAL"
  );

  // TEST 42 : Aucune inversion automatique de contrainte
  assert("TEST 42 — Pas d'inversion automatique en MATERIAL → PIPE", res16.compatibilityResult.constraintResults[0].constraint.left.entityId === "SYNTHETIC_PIPE_001");

  // TEST 43 : Contraintes transmises fidèlement
  assert("TEST 43 — Type de contrainte conservé intact (MATERIAL)", res16.compatibilityResult.constraintResults[0].constraint.constraintType === "MATERIAL");

  // ==========================================
  // SECTION 7 : ANTI-HÉURISTIQUE (2 TESTS)
  // ==========================================

  // TEST 44 : IDs contenant ASME/B16/API/NPS/DN/CLASS/PN acceptés comme simples chaînes opaques
  const val44 = validateNormativeSpecCompatibilityIntegrationQuery({
    specResolution: {
      status: "COMPATIBLE",
      specificationId: "SPEC_ASME_B31_3_NPS_CLASS_150",
      componentType: "VALVE_API_6D_PN_16",
    },
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "RATING",
          left: { entityType: "VALVE", entityId: "VALVE_ASME_B16_34" },
          right: { entityType: "RATING", entityId: "RATING_CLASS_300" },
        },
      ],
    },
  });
  assert("TEST 44 — Tokens normatifs acceptés comme identifiants opaques sans heuristique", val44.valid);

  // TEST 45 : IDs contenant CS/CRMO/A106 acceptés comme simples chaînes opaques
  const val45 = validateNormativeSpecCompatibilityIntegrationQuery({
    specResolution: {
      status: "COMPATIBLE",
      specificationId: "SPEC_MAT_CS_A106_TEST",
      componentType: "PIPE_CRMO_TEST",
    },
    compatibilityQuery: {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "PIPE_CS_A106_OPAQUE" },
          right: { entityType: "MATERIAL", entityId: "MAT_CRMO_OPAQUE" },
        },
      ],
    },
  });
  assert("TEST 45 — Tokens matériaux acceptés comme identifiants opaques sans heuristique", val45.valid);

  return {
    success: allPass,
    testsRun,
    results,
  };
}
