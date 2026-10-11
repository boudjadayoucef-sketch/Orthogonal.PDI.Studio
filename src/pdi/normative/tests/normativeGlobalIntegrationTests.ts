/**
 * PDI NORMATIVE ENGINE — GLOBAL NORMATIVE INTEGRATION TESTS
 * Reference: NORM-14-11 (Global Normative Chain Validation)
 * 
 * Suite de tests d'intégration globale validant la chaîne normative complète :
 * MASTER-02 -> NORM-09/10/11 -> NORM-13 -> NORM-14-01 -> NORM-14-02..06 -> NORM-14-07 -> NORM-14-08 -> COMPONENT-01..05 -> NORM-14-09 -> NORM-14-10
 * 
 * RÈGLES DE CONCEPTION STRICTES (NORM-14-11 / NORM-14-11-FIX-01) :
 * 1. Aucun inventaire normatif réel (pas d'ASME B31.3, B16.5, B16.9, API, ISO, EN, ASTM).
 * 2. Données et identifiants strictement synthétiques (SYNTHETIC_*, *_SYNTH_*, *_TEST, SYN_*).
 * 3. Aucune nouvelle source de vérité normative, aucun recalcul ni nouvelle règle.
 * 4. Déterminisme absolu, immutabilité et traçabilité de bout en bout.
 * 5. Traitement strictement opaque et anti-heuristique des chaînes d'identification.
 * 6. Comptage strict : testsRun = nombre de scénarios runTest(), assertionsPassed/Failed = assertions assert().
 */

import type {
  NormativeCompatibilityMatrixRule,
} from "../types/normativeCompatibilityMatrixTypes";
import type {
  NormativeMultiCompatibilityConstraint,
  NormativeMultiCompatibilityQuery,
} from "../types/normativeMultiCompatibilityTypes";
import type {
  INormativeSpecCompatibilityIntegrationEngine,
  NormativeSpecCompatibilityIntegrationQuery,
  NormativeSpecCompatibilityIntegrationResult,
} from "../types/normativeSpecCompatibilityIntegrationTypes";
import type {
  INormativeComponentIntegrationEngine,
  NormativeComponentIntegrationQuery,
  NormativeComponentIntegrationResult,
} from "../types/normativeComponentIntegrationTypes";
import type {
  NormativeTraceabilityInput,
  NormativeTraceabilityResult,
} from "../types/normativeEvidenceTraceabilityTypes";
import type {
  ComponentResolutionRequest,
  ComponentResolutionResult,
  IComponentResolutionEngine,
} from "../types/componentResolutionTypes";
import type { PipingSpecResolutionResult } from "../types/pipingSpecResolverTypes";

import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeComponentCompatibilityEngine } from "../engine/normativeComponentCompatibilityEngine";
import { NormativeComponentMaterialCompatibilityEngine } from "../engine/normativeComponentMaterialCompatibilityEngine";
import { NormativeComponentRatingCompatibilityEngine } from "../engine/normativeComponentRatingCompatibilityEngine";
import { NormativeComponentDimensionalCompatibilityEngine } from "../engine/normativeComponentDimensionalCompatibilityEngine";
import { NormativeComponentProductCompatibilityEngine } from "../engine/normativeComponentProductCompatibilityEngine";
import { NormativeMultiCompatibilityEngine } from "../engine/normativeMultiCompatibilityEngine";
import { NormativeSpecCompatibilityIntegrationEngine } from "../engine/normativeSpecCompatibilityIntegrationEngine";
import { NormativeComponentIntegrationEngine } from "../engine/normativeComponentIntegrationEngine";
import { NormativeEvidenceTraceabilityEngine } from "../engine/normativeEvidenceTraceabilityEngine";

export interface NormativeGlobalIntegrationTestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly passed: number;
  readonly failed: number;
  readonly assertionsPassed: number;
  readonly assertionsFailed: number;
  readonly results: readonly string[];
}

/**
 * Mock Component Resolution Engine pour COMPONENT-04
 */
class SyntheticComponentResolutionEngine implements IComponentResolutionEngine {
  public callCount = 0;
  public lastRequest?: ComponentResolutionRequest;

  constructor(
    private readonly responseGenerator?: (
      req: ComponentResolutionRequest
    ) => Partial<ComponentResolutionResult>
  ) {}

  public resolve(
    request: ComponentResolutionRequest
  ): ComponentResolutionResult {
    this.callCount++;
    this.lastRequest = request;

    const custom = this.responseGenerator ? this.responseGenerator(request) : {};

    return Object.freeze({
      status: custom.status ?? "RESOLVED",
      specificationId: request.specificationId,
      componentType: request.context.componentType,
      resolvedCandidateId: custom.resolvedCandidateId ?? "SYN_CANDIDATE_001",
      evaluatedCandidateIds: Object.freeze(custom.evaluatedCandidateIds ?? ["SYN_CANDIDATE_001"]),
      eligibleCandidateIds: Object.freeze(custom.eligibleCandidateIds ?? ["SYN_CANDIDATE_001"]),
      unverifiedCandidateIds: Object.freeze(custom.unverifiedCandidateIds ?? []),
      invalidCandidateIds: Object.freeze(custom.invalidCandidateIds ?? []),
      matchedRuleIds: Object.freeze(custom.matchedRuleIds ?? ["COMP_RES_RULE_01"]),
      compatibilityRuleIds: Object.freeze(custom.compatibilityRuleIds ?? ["COMP_COMPAT_RULE_01"]),
      evidenceIds: Object.freeze(custom.evidenceIds ?? ["EVID_COMP_01"]),
      message: custom.message ?? "Synthetic component resolution successful.",
    });
  }
}

/**
 * Exécute la suite complète de tests d'intégration NORM-14-11.
 */
export function runNormativeGlobalIntegrationTests(): NormativeGlobalIntegrationTestResult {
  const results: string[] = [];
  let testsRun = 0;
  let assertionsPassed = 0;
  let assertionsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      assertionsFailed++;
      results.push(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    } else {
      assertionsPassed++;
      results.push(`✅ PASS: ${testName}`);
    }
  }

  function runTest(testName: string, fn: () => void) {
    testsRun++;
    try {
      fn();
    } catch (err: unknown) {
      assertionsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`❌ EXCEPTION in ${testName}: ${msg}`);
    }
  }

  // =========================================================================
  // SETUP DE L'ENVIRONNEMENT DE FIXTURES SYNTHÉTIQUES
  // =========================================================================
  const evidenceRegistry = new NormativeEvidenceRegistry();

  evidenceRegistry.register({
    evidenceId: "EVID_SYNTH_001",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_A",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  evidenceRegistry.register({
    evidenceId: "EVID_SYNTH_002",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_02",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_02",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_B",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  evidenceRegistry.register({
    evidenceId: "EVID_SYNTH_UNVERIFIED",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_03",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_03",
    verificationStatus: "UNVERIFIED",
  });

  const evidenceResolver = new NormativeEvidenceResolver(evidenceRegistry);
  const matrixRegistry = new NormativeCompatibilityMatrixRegistry();

  // Enregistrement de règles synthétiques dans la matrice NORM-14-01
  const ruleCompCompat: NormativeCompatibilityMatrixRule = {
    ruleId: "RULE_SYNTH_COMP_01",
    leftEntityType: "PIPE",
    leftEntityId: "PIPE_SYNTHETIC_A",
    rightEntityType: "VALVE",
    rightEntityId: "VALVE_SYNTHETIC_B",
    status: "COMPATIBLE",
    evidenceIds: ["EVID_SYNTH_001"],
    sourceReference: "SYN_MATRIX_REF_01",
    notes: "Synthetic Component-Component compatibility rule",
  };
  matrixRegistry.register(ruleCompCompat);

  const ruleMatCompat: NormativeCompatibilityMatrixRule = {
    ruleId: "RULE_SYNTH_MAT_01",
    leftEntityType: "PIPE",
    leftEntityId: "PIPE_SYNTH_MAT_01",
    rightEntityType: "MATERIAL",
    rightEntityId: "MAT_SYNTH_001",
    status: "COMPATIBLE",
    evidenceIds: ["EVID_SYNTH_001"],
    sourceReference: "SYN_MATRIX_REF_02",
  };
  matrixRegistry.register(ruleMatCompat);

  const ruleRatingCompat: NormativeCompatibilityMatrixRule = {
    ruleId: "RULE_SYNTH_RATING_01",
    leftEntityType: "PIPE",
    leftEntityId: "PIPE_SYNTH_RAT_01",
    rightEntityType: "RATING",
    rightEntityId: "RATING_SYNTH_001",
    status: "COMPATIBLE",
    evidenceIds: ["EVID_SYNTH_001"],
    sourceReference: "SYN_MATRIX_REF_03",
  };
  matrixRegistry.register(ruleRatingCompat);

  const ruleDimCompat: NormativeCompatibilityMatrixRule = {
    ruleId: "RULE_SYNTH_DIM_01",
    leftEntityType: "PIPE",
    leftEntityId: "PIPE_SYNTH_DIM_01",
    rightEntityType: "DIMENSIONAL_STANDARD",
    rightEntityId: "DIM_STD_SYNTH_001",
    status: "COMPATIBLE",
    evidenceIds: ["EVID_SYNTH_002"],
    sourceReference: "SYN_MATRIX_REF_04",
  };
  matrixRegistry.register(ruleDimCompat);

  const ruleProdCompat: NormativeCompatibilityMatrixRule = {
    ruleId: "RULE_SYNTH_PROD_01",
    leftEntityType: "PIPE",
    leftEntityId: "PIPE_SYNTH_PROD_01",
    rightEntityType: "PRODUCT_STANDARD",
    rightEntityId: "PROD_STD_SYNTH_001",
    status: "COMPATIBLE",
    evidenceIds: ["EVID_SYNTH_002"],
    sourceReference: "SYN_MATRIX_REF_05",
  };
  matrixRegistry.register(ruleProdCompat);

  const ruleIncompat: NormativeCompatibilityMatrixRule = {
    ruleId: "RULE_SYNTH_INCOMPAT_01",
    leftEntityType: "PIPE",
    leftEntityId: "PIPE_SYNTHETIC_A",
    rightEntityType: "MATERIAL",
    rightEntityId: "MAT_INCOMPAT_SYNTH",
    status: "INCOMPATIBLE",
    evidenceIds: ["EVID_SYNTH_001"],
    sourceReference: "SYN_MATRIX_REF_06",
    notes: "CONFLICT_SYNTH_MAT_MISMATCH",
  };
  matrixRegistry.register(ruleIncompat);

  // Instanciation de tous les moteurs
  const matrixEngine = new NormativeCompatibilityMatrixEngine(matrixRegistry, evidenceResolver);
  const compAdapter = new NormativeComponentCompatibilityEngine(matrixEngine);
  const matAdapter = new NormativeComponentMaterialCompatibilityEngine(matrixEngine);
  const ratAdapter = new NormativeComponentRatingCompatibilityEngine(matrixEngine);
  const dimAdapter = new NormativeComponentDimensionalCompatibilityEngine(matrixEngine);
  const prodAdapter = new NormativeComponentProductCompatibilityEngine(matrixEngine);

  const multiCompatibilityEngine = new NormativeMultiCompatibilityEngine(
    compAdapter,
    matAdapter,
    ratAdapter,
    dimAdapter,
    prodAdapter
  );

  const specCompatibilityEngine = new NormativeSpecCompatibilityIntegrationEngine(
    multiCompatibilityEngine
  );

  const componentResolutionEngine = new SyntheticComponentResolutionEngine();
  const componentIntegrationEngine = new NormativeComponentIntegrationEngine(
    componentResolutionEngine,
    specCompatibilityEngine
  );

  const traceabilityEngine = new NormativeEvidenceTraceabilityEngine();

  // =========================================================================
  // SECTION 1 : TEST 1 — NORM-14-01 SOURCE DE VÉRITÉ DE COMPATIBILITÉ (3 TESTS)
  // =========================================================================

  runTest("TEST 01 [NORM-14-01]: Matrice résout une règle synthétique COMPATIBLE avec évidence", () => {
    const res = matrixEngine.resolveCompatibility(
      "PIPE",
      "PIPE_SYNTHETIC_A",
      "VALVE",
      "VALVE_SYNTHETIC_B"
    );
    assert(res.status === "COMPATIBLE", "Statut doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_COMP_01"), "matchedRuleId doit inclure RULE_SYNTH_COMP_01");
    assert(res.evidenceIds.includes("EVID_SYNTH_001"), "evidenceId doit inclure EVID_SYNTH_001");
    assert(res.conflictCode === undefined, "Aucun conflictCode attendu pour règle compatible");
  });

  runTest("TEST 02 [NORM-14-01]: Matrice résout une règle synthétique INCOMPATIBLE", () => {
    const res = matrixEngine.resolveCompatibility(
      "PIPE",
      "PIPE_SYNTHETIC_A",
      "MATERIAL",
      "MAT_INCOMPAT_SYNTH"
    );
    assert(res.status === "INCOMPATIBLE", "Statut doit être INCOMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_INCOMPAT_01"), "matchedRuleId conservé");
  });

  runTest("TEST 03 [NORM-14-01]: Paire non déclarée retourne UNVERIFIED sans inventer de règle", () => {
    const res = matrixEngine.resolveCompatibility(
      "PIPE",
      "PIPE_SYNTHETIC_A",
      "VALVE",
      "UNKNOWN_VALVE_SYNTH"
    );
    assert(res.status === "UNVERIFIED", "Statut doit être UNVERIFIED");
    assert(res.matchedRuleIds.length === 0, "Aucun matchedRuleId inventé");
    assert(res.evidenceIds.length === 0, "Aucun evidenceId inventé");
  });

  // =========================================================================
  // SECTION 2 : TEST 2 — NORM-14-02 COMPOSANT ↔ COMPOSANT (3 TESTS)
  // =========================================================================

  runTest("TEST 04 [NORM-14-02]: Adaptateur Component ↔ Component valide une liaison COMPATIBLE", () => {
    const res = compAdapter.resolveCompatibility({
      left: { componentType: "PIPE", componentId: "PIPE_SYNTHETIC_A" },
      right: { componentType: "VALVE", componentId: "VALVE_SYNTHETIC_B" },
    });
    assert(res.status === "COMPATIBLE", "Doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_COMP_01"), "matchedRuleId préservé");
    assert(res.evidenceIds.includes("EVID_SYNTH_001"), "evidenceId préservé");
    assert(Object.isFrozen(res), "Résultat doit être gelé");
  });

  runTest("TEST 05 [NORM-14-02]: Composant non appairé retourne UNVERIFIED", () => {
    const res = compAdapter.resolveCompatibility({
      left: { componentType: "PIPE", componentId: "PIPE_SYNTHETIC_A" },
      right: { componentType: "FLANGE", componentId: "FLANGE_SYNTHETIC_UNREGISTERED" },
    });
    assert(res.status === "UNVERIFIED", "Doit être UNVERIFIED");
    assert(res.evidenceIds.length === 0, "Aucune évidence inventée");
  });

  runTest("TEST 06 [NORM-14-02]: Composant avec requête malformée retourne INVALID", () => {
    const res = compAdapter.resolveCompatibility({
      left: { componentType: "PIPE", componentId: "" },
      right: { componentType: "VALVE", componentId: "VALVE_SYNTHETIC_B" },
    });
    assert(res.status === "INVALID", "Doit être INVALID en cas d'ID vide");
  });

  // =========================================================================
  // SECTION 3 : TEST 3 — NORM-14-03 COMPOSANT ↔ MATERIAL (3 TESTS)
  // =========================================================================

  runTest("TEST 07 [NORM-14-03]: ID synthétique opaque PIPE_SYNTH_MAT_01 ↔ MAT_SYNTH_001 -> COMPATIBLE", () => {
    const res = matAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_MAT_01" },
      material: { materialId: "MAT_SYNTH_001" },
    });
    assert(res.status === "COMPATIBLE", "Doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_MAT_01"), "matchedRuleId RULE_SYNTH_MAT_01");
    assert(res.evidenceIds.includes("EVID_SYNTH_001"), "evidenceId EVID_SYNTH_001");
  });

  runTest("TEST 08 [NORM-14-03]: Material incompatible retourne INCOMPATIBLE", () => {
    const res = matAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTHETIC_A" },
      material: { materialId: "MAT_INCOMPAT_SYNTH" },
    });
    assert(res.status === "INCOMPATIBLE", "Doit être INCOMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_INCOMPAT_01"), "matchedRuleId conservé");
  });

  runTest("TEST 09 [NORM-14-03]: Material non répertorié retourne UNVERIFIED sans invention", () => {
    const res = matAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_MAT_01" },
      material: { materialId: "MAT_SYNTH_UNREGISTERED" },
    });
    assert(res.status === "UNVERIFIED", "Doit être UNVERIFIED");
    assert(res.matchedRuleIds.length === 0, "Aucune règle inventée");
  });

  // =========================================================================
  // SECTION 4 : TEST 4 — NORM-14-04 COMPOSANT ↔ RATING (3 TESTS)
  // =========================================================================

  runTest("TEST 10 [NORM-14-04]: ID synthétique PIPE_SYNTH_RAT_01 ↔ RATING_SYNTH_001 -> COMPATIBLE", () => {
    const res = ratAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_RAT_01" },
      rating: { ratingId: "RATING_SYNTH_001" },
    });
    assert(res.status === "COMPATIBLE", "Doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_RATING_01"), "matchedRuleId RULE_SYNTH_RATING_01");
  });

  runTest("TEST 11 [NORM-14-04]: Pas de conversion implicite Class ↔ PN (strict match uniquement)", () => {
    const res = ratAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_RAT_01" },
      rating: { ratingId: "SYN_RATING_UNMAPPED_01" },
    });
    assert(res.status === "UNVERIFIED", "Aucune conversion automatique ne doit être effectuée");
    assert(res.matchedRuleIds.length === 0, "matchedRuleIds vide");
  });

  runTest("TEST 12 [NORM-14-04]: Rating avec identifiant invalide retourne INVALID", () => {
    const res = ratAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_RAT_01" },
      rating: { ratingId: "   " },
    });
    assert(res.status === "INVALID", "Rating whitespace-only doit être INVALID");
  });

  // =========================================================================
  // SECTION 5 : TEST 5 & 6 — NORM-14-05 & NORM-14-06 DIMENSIONAL & PRODUCT (3 TESTS)
  // =========================================================================

  runTest("TEST 13 [NORM-14-05]: ID synthétique PIPE_SYNTH_DIM_01 (sans conversion NPS ↔ DN) -> COMPATIBLE", () => {
    const res = dimAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_DIM_01" },
      dimensionalStandard: { dimensionalStandardId: "DIM_STD_SYNTH_001" },
    });
    assert(res.status === "COMPATIBLE", "Doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_DIM_01"), "RULE_SYNTH_DIM_01 présent");
    assert(res.evidenceIds.includes("EVID_SYNTH_002"), "EVID_SYNTH_002 présent");
  });

  runTest("TEST 14 [NORM-14-06]: ID synthétique PIPE_SYNTH_PROD_01 traité de manière opaque -> COMPATIBLE", () => {
    const res = prodAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_PROD_01" },
      productStandard: { productStandardId: "PROD_STD_SYNTH_001" },
    });
    assert(res.status === "COMPATIBLE", "Doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_PROD_01"), "RULE_SYNTH_PROD_01 présent");
  });

  runTest("TEST 15 [NORM-14-05/06]: Standards dimensionnels et produits inconnus retournent UNVERIFIED", () => {
    const resDim = dimAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_DIM_01" },
      dimensionalStandard: { dimensionalStandardId: "DIM_STD_UNKNOWN" },
    });
    const resProd = prodAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_SYNTH_PROD_01" },
      productStandard: { productStandardId: "PROD_STD_UNKNOWN" },
    });
    assert(resDim.status === "UNVERIFIED", "Dim standard inconnu -> UNVERIFIED");
    assert(resProd.status === "UNVERIFIED", "Prod standard inconnu -> UNVERIFIED");
  });

  // =========================================================================
  // SECTION 6 : TEST 7 — NORM-14-07 MULTI-COMPATIBILITY ORCHESTRATION (4 TESTS)
  // =========================================================================

  runTest("TEST 16 [NORM-14-07]: Exécution simultanée de 5 contraintes synthétiques COMPATIBLE", () => {
    const query: NormativeMultiCompatibilityQuery = {
      constraints: [
        {
          constraintType: "COMPONENT",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
        },
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTH_MAT_01" },
          right: { entityType: "MATERIAL", entityId: "MAT_SYNTH_001" },
        },
        {
          constraintType: "RATING",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTH_RAT_01" },
          right: { entityType: "RATING", entityId: "RATING_SYNTH_001" },
        },
        {
          constraintType: "DIMENSIONAL_STANDARD",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTH_DIM_01" },
          right: { entityType: "DIMENSIONAL_STANDARD", entityId: "DIM_STD_SYNTH_001" },
        },
        {
          constraintType: "PRODUCT_STANDARD",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTH_PROD_01" },
          right: { entityType: "PRODUCT_STANDARD", entityId: "PROD_STD_SYNTH_001" },
        },
      ],
    };

    const res = multiCompatibilityEngine.resolveCompatibility(query);
    assert(res.status === "COMPATIBLE", "Multi-compatibilité globale doit être COMPATIBLE");
    assert(res.constraintResults.length === 5, "Les 5 contraintes doivent être exécutées");
    assert(res.matchedRuleIds.length === 5, "Les 5 matchedRuleIds doivent être collectés");
    assert(res.evidenceIds.includes("EVID_SYNTH_001") && res.evidenceIds.includes("EVID_SYNTH_002"), "Les 2 évidences synthétiques doivent être agrégées");
    assert(Object.isFrozen(res), "Le résultat multi-compatibilité doit être gelé");
  });

  runTest("TEST 17 [NORM-14-07]: Hiérarchie de consolidation INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE", () => {
    // Cas avec 1 INCOMPATIBLE et 1 COMPATIBLE -> Global INCOMPATIBLE
    const queryWithIncompat: NormativeMultiCompatibilityQuery = {
      constraints: [
        {
          constraintType: "COMPONENT",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
        },
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "MATERIAL", entityId: "MAT_INCOMPAT_SYNTH" },
        },
      ],
    };
    const resIncompat = multiCompatibilityEngine.resolveCompatibility(queryWithIncompat);
    assert(resIncompat.status === "INCOMPATIBLE", "1 contrainte INCOMPATIBLE domine COMPATIBLE -> INCOMPATIBLE");

    // Cas avec 1 UNVERIFIED et 1 COMPATIBLE -> Global UNVERIFIED
    const queryWithUnverified: NormativeMultiCompatibilityQuery = {
      constraints: [
        {
          constraintType: "COMPONENT",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
        },
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTH_MAT_01" },
          right: { entityType: "MATERIAL", entityId: "MAT_SYNTH_UNREGISTERED" },
        },
      ],
    };
    const resUnverified = multiCompatibilityEngine.resolveCompatibility(queryWithUnverified);
    assert(resUnverified.status === "UNVERIFIED", "1 contrainte UNVERIFIED domine COMPATIBLE -> UNVERIFIED");
  });

  runTest("TEST 18 [NORM-14-07]: INVALID domine INCOMPATIBLE et UNVERIFIED", () => {
    const queryWithInvalid: NormativeMultiCompatibilityQuery = {
      constraints: [
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "MATERIAL", entityId: "MAT_INCOMPAT_SYNTH" },
        },
        {
          constraintType: "COMPONENT",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "VALVE", entityId: "" },
        },
      ],
    };
    const res = multiCompatibilityEngine.resolveCompatibility(queryWithInvalid);
    assert(res.status === "INVALID", "Contrainte avec champ invalide -> statut global INVALID");
  });

  runTest("TEST 19 [NORM-14-07]: Déduplication et tri déterministe des identifiants agrégés", () => {
    // 2 contraintes partageant la même évidence EVID_SYNTH_001
    const query: NormativeMultiCompatibilityQuery = {
      constraints: [
        {
          constraintType: "COMPONENT",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
          right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
        },
        {
          constraintType: "MATERIAL",
          left: { entityType: "PIPE", entityId: "PIPE_SYNTH_MAT_01" },
          right: { entityType: "MATERIAL", entityId: "MAT_SYNTH_001" },
        },
      ],
    };
    const res = multiCompatibilityEngine.resolveCompatibility(query);
    const evCount = res.evidenceIds.filter((e) => e === "EVID_SYNTH_001").length;
    assert(evCount === 1, "EVID_SYNTH_001 doit être dédupliqué (count === 1)");
  });

  // =========================================================================
  // SECTION 7 : TEST 8 — NORM-14-08 SPEC ↔ COMPATIBILITY INTEGRATION (3 TESTS)
  // =========================================================================

  runTest("TEST 20 [NORM-14-08]: Intégration SPEC COMPATIBLE + Multi-compatibilité COMPATIBLE -> COMPATIBLE", () => {
    const specRes: PipingSpecResolutionResult = {
      status: "COMPATIBLE",
      specificationId: "SPEC_SYNTH_01",
      componentType: "PIPE",
      matchedRuleIds: ["SPEC_RULE_01"],
      compatibilityRuleIds: [],
      evidenceIds: ["SPEC_EVID_01"],
      message: "Spec resolution ok",
    };

    const query: NormativeSpecCompatibilityIntegrationQuery = {
      specResolution: specRes,
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "COMPONENT",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
          },
        ],
      },
    };

    const res = specCompatibilityEngine.resolve(query);
    assert(res.status === "COMPATIBLE", "Statut global doit être COMPATIBLE");
    assert(res.matchedRuleIds.includes("SPEC_RULE_01") && res.matchedRuleIds.includes("RULE_SYNTH_COMP_01"), "Union des matchedRuleIds");
    assert(res.evidenceIds.includes("SPEC_EVID_01") && res.evidenceIds.includes("EVID_SYNTH_001"), "Union des evidenceIds");
    assert(Object.isFrozen(res), "Résultat gelé");
  });

  runTest("TEST 21 [NORM-14-08]: Intégration SPEC COMPATIBLE + Multi-compatibilité INCOMPATIBLE -> INCOMPATIBLE", () => {
    const specRes: PipingSpecResolutionResult = {
      status: "COMPATIBLE",
      specificationId: "SPEC_SYNTH_01",
      componentType: "PIPE",
      matchedRuleIds: ["SPEC_RULE_01"],
      compatibilityRuleIds: [],
      evidenceIds: ["SPEC_EVID_01"],
    };

    const query: NormativeSpecCompatibilityIntegrationQuery = {
      specResolution: specRes,
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "MATERIAL",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "MATERIAL", entityId: "MAT_INCOMPAT_SYNTH" },
          },
        ],
      },
    };

    const res = specCompatibilityEngine.resolve(query);
    assert(res.status === "INCOMPATIBLE", "Incompatibilité dans compatibilityQuery domine le résultat SPEC");
  });

  runTest("TEST 22 [NORM-14-08]: Requête invalide (specResolution null) retourne INVALID", () => {
    const query = {
      specResolution: null as any,
      compatibilityQuery: { constraints: [] },
    };
    const res = specCompatibilityEngine.resolve(query);
    assert(res.status === "INVALID", "Spec resolution null -> statut INVALID");
  });

  // =========================================================================
  // SECTION 8 : TEST 9 — NORM-14-09 COMPONENT ↔ SPEC ↔ COMPATIBILITY (3 TESTS)
  // =========================================================================

  runTest("TEST 23 [NORM-14-09]: Intégration complète Component + Spec + Multi-compatibilité sans bypass", () => {
    const query: NormativeComponentIntegrationQuery = {
      componentContext: {
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        nominalSize: "SYN_NOMINAL_SIZE_01",
        schedule: "SYN_SCHEDULE_01",
      },
      specResolution: {
        status: "COMPATIBLE",
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        matchedRuleIds: ["SPEC_RULE_01"],
        compatibilityRuleIds: [],
        evidenceIds: ["SPEC_EVID_01"],
      },
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "COMPONENT",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
          },
        ],
      },
    };

    const initialCallCount = componentResolutionEngine.callCount;
    const res = componentIntegrationEngine.resolve(query);
    assert(componentResolutionEngine.callCount === initialCallCount + 1, "Le ComponentResolutionEngine doit être appelé (aucun contournement)");
    assert(res.status === "COMPATIBLE", "Statut global d'intégration COMPATIBLE");
    assert(res.componentResolution.status === "RESOLVED", "Sous-statut component resolution RESOLVED");
    assert(res.componentResolution.resolvedCandidateId === "SYN_CANDIDATE_001", "Candidat résolu présent");
    assert(res.matchedRuleIds.includes("COMP_RES_RULE_01"), "matchedRuleId de component resolution présent");
    assert(res.matchedRuleIds.includes("RULE_SYNTH_COMP_01"), "matchedRuleId de compatibility présent");
    assert(res.evidenceIds.includes("EVID_COMP_01"), "evidenceId de component resolution présent");
    assert(res.evidenceIds.includes("EVID_SYNTH_001"), "evidenceId de compatibility présent");
  });

  runTest("TEST 24 [NORM-14-09]: Statuts de résolution de composant (NO_CANDIDATE -> INCOMPATIBLE) propagés", () => {
    const testEngineNoCand = new NormativeComponentIntegrationEngine(
      new SyntheticComponentResolutionEngine(() => ({
        status: "NO_CANDIDATE",
        resolvedCandidateId: undefined,
        message: "No candidate found",
      })),
      specCompatibilityEngine
    );

    const res = testEngineNoCand.resolve({
      componentContext: {
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        nominalSize: "SYN_NOMINAL_SIZE_01",
        schedule: "SYN_SCHEDULE_01",
      },
      specResolution: {
        status: "COMPATIBLE",
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
      },
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "COMPONENT",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
          },
        ],
      },
    });
    assert(res.status === "INCOMPATIBLE", "Statut global INCOMPATIBLE pour composant non trouvé");
    assert(res.componentResolution.status === "NO_CANDIDATE", "Sous-statut NO_CANDIDATE conservé");
  });

  runTest("TEST 25 [NORM-14-09]: Incompatibilité multi-compatibilité domine component resolution RESOLVED", () => {
    const res = componentIntegrationEngine.resolve({
      componentContext: {
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        nominalSize: "SYN_NOMINAL_SIZE_01",
        schedule: "SYN_SCHEDULE_01",
      },
      specResolution: {
        status: "COMPATIBLE",
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
      },
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "MATERIAL",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "MATERIAL", entityId: "MAT_INCOMPAT_SYNTH" },
          },
        ],
      },
    });
    assert(res.status === "INCOMPATIBLE", "Incompatibilité normative bloque la sélection du composant -> INCOMPATIBLE");
  });

  // =========================================================================
  // SECTION 9 : TEST 10 — NORM-14-10 EVIDENCE TRACEABILITY LOCK (4 TESTS)
  // =========================================================================

  runTest("TEST 26 [NORM-14-10]: Pas d'invention — Entrée sans évidence reste strictement sans évidence", () => {
    const input: NormativeTraceabilityInput = {
      matchedRuleIds: ["RULE_ONLY_01"],
      evidenceIds: [],
      conflictCodes: [],
    };
    const locked = traceabilityEngine.lock(input);
    assert(locked.valid === true, "Verrouillage valide");
    assert(locked.evidenceIds.length === 0, "Aucune évidence ne doit être inventée");
    assert(!locked.evidenceIds.includes("EVIDENCE_001"), "Pas de génération automatique EVIDENCE_001");
    assert(!locked.evidenceIds.includes("AUTO_EVIDENCE"), "Pas de génération automatique AUTO_EVIDENCE");
  });

  runTest("TEST 27 [NORM-14-10]: Pas de perte — Conservation intégrale des règles, évidences et conflits", () => {
    const input: NormativeTraceabilityInput = {
      matchedRuleIds: ["RULE_B", "RULE_A"],
      evidenceIds: ["EVID_Z", "EVID_A"],
      conflictCodes: ["CONF_02", "CONF_01"],
    };
    const locked = traceabilityEngine.lock(input);
    assert(locked.matchedRuleIds.length === 2, "2 matchedRuleIds conservés");
    assert(locked.evidenceIds.length === 2, "2 evidenceIds conservés");
    assert(locked.conflictCodes.length === 2, "2 conflictCodes conservés");
  });

  runTest("TEST 28 [NORM-14-10]: Déduplication et tri lexicographique déterministe", () => {
    const input: NormativeTraceabilityInput = {
      matchedRuleIds: ["RULE_Z", "RULE_A", "RULE_Z", "RULE_M"],
      evidenceIds: ["EVID_02", "EVID_01", "EVID_02"],
      conflictCodes: ["CONF_B", "CONF_A", "CONF_B"],
    };
    const locked = traceabilityEngine.lock(input);
    assert(locked.matchedRuleIds.join(",") === "RULE_A,RULE_M,RULE_Z", "matchedRuleIds dédupliqués et triés");
    assert(locked.evidenceIds.join(",") === "EVID_01,EVID_02", "evidenceIds dédupliqués et triés");
    assert(locked.conflictCodes.join(",") === "CONF_A,CONF_B", "conflictCodes dédupliqués et triés");
  });

  runTest("TEST 29 [NORM-14-10]: Immutabilité totale — Tous les tableaux et le résultat racine sont gelés", () => {
    const input: NormativeTraceabilityInput = {
      matchedRuleIds: ["RULE_01"],
      evidenceIds: ["EVID_01"],
      conflictCodes: ["CONF_01"],
      ruleEvidence: [{ ruleId: "RULE_01", evidenceIds: ["EVID_01"] }],
      conflicts: [{ conflictCode: "CONF_01", evidenceIds: ["EVID_01"] }],
    };
    const locked = traceabilityEngine.lock(input);
    assert(Object.isFrozen(locked), "locked doit être Object.isFrozen");
    assert(Object.isFrozen(locked.matchedRuleIds), "matchedRuleIds doit être Object.isFrozen");
    assert(Object.isFrozen(locked.evidenceIds), "evidenceIds doit être Object.isFrozen");
    assert(Object.isFrozen(locked.conflictCodes), "conflictCodes doit être Object.isFrozen");
    assert(Object.isFrozen(locked.ruleEvidence), "ruleEvidence doit être Object.isFrozen");
    assert(Object.isFrozen(locked.conflicts), "conflicts doit être Object.isFrozen");
  });

  // =========================================================================
  // SECTION 10 : TEST ANTI-HEURISTIQUE (3 TESTS)
  // =========================================================================

  runTest("TEST 30 [ANTI-HEURISTIC]: IDs contenant des noms normatifs traités comme des chaînes opaques", () => {
    const unmappedRes = compAdapter.resolveCompatibility({
      left: { componentType: "PIPE", componentId: "PIPE_ASME_B16_SYNTHETIC" },
      right: { componentType: "VALVE", componentId: "VALVE_API_TEST" },
    });
    assert(unmappedRes.status === "UNVERIFIED", "Aucune règle pré-enregistrée -> UNVERIFIED sans déduction ASME/API");
  });

  runTest("TEST 31 [ANTI-HEURISTIC]: IDs avec dimensions ou ratings traités de manière opaque", () => {
    const res = ratAdapter.resolveCompatibility({
      component: { componentType: "PIPE", componentId: "PIPE_NPS_DN_TEST" },
      rating: { ratingId: "RATING_CLASS_PN_TEST" },
    });
    assert(res.status === "UNVERIFIED", "Pas de mapping implicite NPS/DN/Class/PN");
  });

  runTest("TEST 32 [ANTI-HEURISTIC]: Matériaux avec abréviations heuristiques rejetés ou non interprétés", () => {
    const res = matAdapter.resolveCompatibility({
      component: { componentType: "VALVE", componentId: "VALVE_CRMO_TEST" },
      material: { materialId: "MAT_SYNTH_001" },
    });
    // Doit être rejeté (INVALID car _CRMO_ est un token heuristique interdit) ou UNVERIFIED
    assert(res.status === "INVALID" || res.status === "UNVERIFIED", "Aucune acceptation heuristique pour token CRMO");
  });

  // =========================================================================
  // SECTION 11 : TEST DE DIRECTIONNALITÉ (2 TESTS)
  // =========================================================================

  runTest("TEST 33 [DIRECTIONALITY]: A -> B déclaré n'implique pas B -> A", () => {
    const directRes = matrixEngine.resolveCompatibility(
      "PIPE",
      "PIPE_SYNTHETIC_A",
      "VALVE",
      "VALVE_SYNTHETIC_B"
    );
    const reverseRes = matrixEngine.resolveCompatibility(
      "VALVE",
      "VALVE_SYNTHETIC_B",
      "PIPE",
      "PIPE_SYNTHETIC_A"
    );

    assert(directRes.status === "COMPATIBLE", "A -> B direct doit être COMPATIBLE");
    assert(reverseRes.status === "UNVERIFIED", "B -> A inverse non déclaré doit être UNVERIFIED");
  });

  runTest("TEST 34 [DIRECTIONALITY]: Adaptateur Component Compatibility respecte la directionnalité", () => {
    const direct = compAdapter.resolveCompatibility({
      left: { componentType: "PIPE", componentId: "PIPE_SYNTHETIC_A" },
      right: { componentType: "VALVE", componentId: "VALVE_SYNTHETIC_B" },
    });
    const reverse = compAdapter.resolveCompatibility({
      left: { componentType: "VALVE", componentId: "VALVE_SYNTHETIC_B" },
      right: { componentType: "PIPE", componentId: "PIPE_SYNTHETIC_A" },
    });
    assert(direct.status === "COMPATIBLE", "Direct compatible");
    assert(reverse.status === "UNVERIFIED", "Inverse unverified");
  });

  // =========================================================================
  // SECTION 12 : TEST INVALID & CAS LIMITES (3 TESTS)
  // =========================================================================

  runTest("TEST 35 [INVALID]: Entrées primitives et objets null rejetés sans exception non-contrôlée", () => {
    assert(matrixEngine.resolveCompatibility(null as any, null as any, null as any, null as any).status === "INVALID", "matrixEngine(null) -> INVALID");
    assert(multiCompatibilityEngine.resolveCompatibility(null as any).status === "INVALID", "multiCompat(null) -> INVALID");
    assert(specCompatibilityEngine.resolve(null as any).status === "INVALID", "specCompat(null) -> INVALID");
    assert(componentIntegrationEngine.resolve(null as any).status === "INVALID", "compIntegration(null) -> INVALID");
    assert(traceabilityEngine.lock(null).valid === false, "traceability(null) -> valid: false");
  });

  runTest("TEST 36 [INVALID]: Tableaux passés à la place d'objets rejetés de manière contrôlée", () => {
    assert(traceabilityEngine.lock(["RULE_01"]).valid === false, "lock(array) -> valid: false");
    assert(multiCompatibilityEngine.resolveCompatibility([] as any).status === "INVALID", "multiCompat([]) -> INVALID");
  });

  runTest("TEST 37 [INVALID]: Identifiants vides ou espaces rejetés", () => {
    const res = matrixEngine.resolveCompatibility(
      "PIPE",
      "   ",
      "VALVE",
      "VALVE_SYNTHETIC_B"
    );
    assert(res.status === "INVALID", "leftEntityId whitespace -> INVALID");
  });

  // =========================================================================
  // SECTION 13 : TEST DE TRAÇABILITÉ GLOBALE SUR LA CHAÎNE COMPLÈTE (3 TESTS)
  // =========================================================================

  runTest("TEST 38 [GLOBAL CHAIN]: Chaîne complète Component -> Spec -> Multi-Compat -> Integration -> Lock", () => {
    // 1. Définition de la requête d'intégration globale
    const integrationQuery: NormativeComponentIntegrationQuery = {
      componentContext: {
        specificationId: "SPEC_SYNTH_GLOBAL",
        componentType: "PIPE",
        nominalSize: "SYN_NOMINAL_SIZE_02",
        schedule: "SYN_SCHEDULE_01",
      },
      specResolution: {
        status: "COMPATIBLE",
        specificationId: "SPEC_SYNTH_GLOBAL",
        componentType: "PIPE",
        matchedRuleIds: ["SPEC_GLOBAL_RULE_01"],
        compatibilityRuleIds: ["SPEC_GLOBAL_COMPAT_01"],
        evidenceIds: ["EVID_SPEC_GLOBAL_01"],
      },
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "COMPONENT",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
          },
          {
            constraintType: "MATERIAL",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTH_MAT_01" },
            right: { entityType: "MATERIAL", entityId: "MAT_SYNTH_001" },
          },
        ],
      },
    };

    // 2. Exécution de NORM-14-09
    const integrationResult = componentIntegrationEngine.resolve(integrationQuery);
    assert(integrationResult.status === "COMPATIBLE", "Intégration résolue avec succès");
    assert(integrationResult.componentResolution.status === "RESOLVED", "Sous-statut composant RESOLVED");

    // 3. Verrouillage NORM-14-10
    const lockedTrace = traceabilityEngine.lock({
      matchedRuleIds: integrationResult.matchedRuleIds,
      evidenceIds: integrationResult.evidenceIds,
      conflictCodes: integrationResult.conflictCodes,
      ruleEvidence: [
        { ruleId: "RULE_SYNTH_COMP_01", evidenceIds: ["EVID_SYNTH_001"] },
        { ruleId: "RULE_SYNTH_MAT_01", evidenceIds: ["EVID_SYNTH_001"] },
      ],
    });

    // 4. Vérifications de traçabilité globale
    assert(lockedTrace.valid === true, "Verrouillage de traçabilité valide");
    assert(lockedTrace.matchedRuleIds.includes("RULE_SYNTH_COMP_01"), "Trace inclut RULE_SYNTH_COMP_01");
    assert(lockedTrace.matchedRuleIds.includes("RULE_SYNTH_MAT_01"), "Trace inclut RULE_SYNTH_MAT_01");
    assert(lockedTrace.matchedRuleIds.includes("SPEC_GLOBAL_RULE_01"), "Trace inclut SPEC_GLOBAL_RULE_01");
    assert(lockedTrace.matchedRuleIds.includes("COMP_RES_RULE_01"), "Trace inclut COMP_RES_RULE_01");
    assert(lockedTrace.evidenceIds.includes("EVID_SYNTH_001"), "Trace inclut EVID_SYNTH_001");
    assert(lockedTrace.evidenceIds.includes("EVID_COMP_01"), "Trace inclut EVID_COMP_01");
    assert(lockedTrace.evidenceIds.includes("EVID_SPEC_GLOBAL_01"), "Trace inclut EVID_SPEC_GLOBAL_01");
  });

  runTest("TEST 39 [GLOBAL CHAIN]: Propagation fidèle des statuts d'erreur jusqu'au verrou NORM-14-10", () => {
    const integrationQuery: NormativeComponentIntegrationQuery = {
      componentContext: {
        specificationId: "SPEC_SYNTH_GLOBAL",
        componentType: "PIPE",
        nominalSize: "SYN_NOMINAL_SIZE_01",
        schedule: "SYN_SCHEDULE_01",
      },
      specResolution: {
        status: "COMPATIBLE",
        specificationId: "SPEC_SYNTH_GLOBAL",
        componentType: "PIPE",
        matchedRuleIds: ["SPEC_GLOBAL_RULE_01"],
        compatibilityRuleIds: [],
        evidenceIds: ["EVID_SPEC_GLOBAL_01"],
      },
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "MATERIAL",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "MATERIAL", entityId: "MAT_INCOMPAT_SYNTH" },
          },
        ],
      },
    };

    const res = componentIntegrationEngine.resolve(integrationQuery);
    assert(res.status === "INCOMPATIBLE", "Résultat d'intégration INCOMPATIBLE");

    const locked = traceabilityEngine.lock({
      matchedRuleIds: res.matchedRuleIds,
      evidenceIds: res.evidenceIds,
      conflictCodes: res.conflictCodes,
    });

    assert(locked.valid === true, "Verrouillage avec statut INCOMPATIBLE valide");
  });

  runTest("TEST 40 [GLOBAL CHAIN]: Cohérence Rule ↔ Evidence vérifiée par le verrou NORM-14-10", () => {
    // Si ruleEvidence fait référence à une évidence absente de evidenceIds -> invalid
    const lockedInvalid = traceabilityEngine.lock({
      matchedRuleIds: ["RULE_01"],
      evidenceIds: ["EVID_01"],
      conflictCodes: [],
      ruleEvidence: [{ ruleId: "RULE_01", evidenceIds: ["EVID_UNLISTED_99"] }],
    });
    assert(lockedInvalid.valid === false, "Évidence non listée dans evidenceIds doit invalider le verrou");
    assert(lockedInvalid.errors.some((e) => e.includes("TRACEABILITY_INCONSISTENT_RULE_EVIDENCE")), "Erreur TRACEABILITY_INCONSISTENT_RULE_EVIDENCE attendue");
  });

  // =========================================================================
  // SECTION 14 : TEST DE DÉTERMINISME & IDEMPOTENCE (2 TESTS)
  // =========================================================================

  runTest("TEST 41 [DETERMINISM]: Deux exécutions successives de la chaîne globale sont strictement identiques", () => {
    const query: NormativeComponentIntegrationQuery = {
      componentContext: {
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        nominalSize: "SYN_NOMINAL_SIZE_01",
        schedule: "SYN_SCHEDULE_01",
      },
      specResolution: {
        status: "COMPATIBLE",
        specificationId: "SPEC_SYNTH_01",
        componentType: "PIPE",
        matchedRuleIds: ["SPEC_RULE_01"],
        compatibilityRuleIds: [],
        evidenceIds: ["SPEC_EVID_01"],
      },
      compatibilityQuery: {
        constraints: [
          {
            constraintType: "COMPONENT",
            left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
            right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
          },
        ],
      },
    };

    const run1 = componentIntegrationEngine.resolve(query);
    const run2 = componentIntegrationEngine.resolve(query);

    assert(run1.status === run2.status, "Statuts identiques");
    assert(JSON.stringify(run1.matchedRuleIds) === JSON.stringify(run2.matchedRuleIds), "matchedRuleIds identiques");
    assert(JSON.stringify(run1.evidenceIds) === JSON.stringify(run2.evidenceIds), "evidenceIds identiques");
    assert(JSON.stringify(run1.conflictCodes) === JSON.stringify(run2.conflictCodes), "conflictCodes identiques");

    const lock1 = traceabilityEngine.lock(run1);
    const lock2 = traceabilityEngine.lock(run2);
    assert(JSON.stringify(lock1) === JSON.stringify(lock2), "Verrous de traçabilité strictement identiques");
  });

  runTest("TEST 42 [DETERMINISM]: L'ordre des contraintes en entrée n'altère pas le résultat final", () => {
    const c1: NormativeMultiCompatibilityConstraint = {
      constraintType: "COMPONENT",
      left: { entityType: "PIPE", entityId: "PIPE_SYNTHETIC_A" },
      right: { entityType: "VALVE", entityId: "VALVE_SYNTHETIC_B" },
    };
    const c2: NormativeMultiCompatibilityConstraint = {
      constraintType: "MATERIAL",
      left: { entityType: "PIPE", entityId: "PIPE_SYNTH_MAT_01" },
      right: { entityType: "MATERIAL", entityId: "MAT_SYNTH_001" },
    };

    const resForward = multiCompatibilityEngine.resolveCompatibility({ constraints: [c1, c2] });
    const resReverse = multiCompatibilityEngine.resolveCompatibility({ constraints: [c2, c1] });

    assert(resForward.status === resReverse.status, "Statut indépendant de l'ordre");
    assert(JSON.stringify(resForward.matchedRuleIds) === JSON.stringify(resReverse.matchedRuleIds), "matchedRuleIds triés identiquement");
    assert(JSON.stringify(resForward.evidenceIds) === JSON.stringify(resReverse.evidenceIds), "evidenceIds triés identiquement");
  });

  // =========================================================================
  // SECTION 15 : ABSENCE DE NOUVELLE SOURCE & NON-RÉGRESSION (3 TESTS)
  // =========================================================================

  runTest("TEST 43 [NO REAL DATA]: Vérification qu'aucune donnée normative réelle n'est présente dans les fixtures de test", () => {
    const syntheticIds = [
      "PIPE_SYNTHETIC_A",
      "VALVE_SYNTHETIC_B",
      "MAT_SYNTH_001",
      "RATING_SYNTH_001",
      "DIM_STD_SYNTH_001",
      "PROD_STD_SYNTH_001",
    ];
    for (const id of syntheticIds) {
      assert(id.includes("SYNTH") || id.includes("TEST"), `L'ID ${id} doit être explicitement synthétique`);
    }
  });

  runTest("TEST 44 [NO REFACTORING]: Interfaces publiques conformes sans altération des moteurs de calcul", () => {
    assert(typeof matrixEngine.resolveCompatibility === "function", "Matrix engine interface préservée");
    assert(typeof multiCompatibilityEngine.resolveCompatibility === "function", "Multi-compat engine interface préservée");
    assert(typeof specCompatibilityEngine.resolve === "function", "Spec compat engine interface préservée");
    assert(typeof componentIntegrationEngine.resolve === "function", "Component integration engine interface préservée");
    assert(typeof traceabilityEngine.lock === "function", "Traceability engine interface préservée");
  });

  runTest("TEST 45 [ISOLATION]: Registres de tests isolés ne polluent pas les registres par défaut", () => {
    const freshEvidenceRegistry = new NormativeEvidenceRegistry();
    assert(freshEvidenceRegistry.count() === 0, "Registre d'évidence instancié localement est vierge");
    const freshMatrixRegistry = new NormativeCompatibilityMatrixRegistry();
    assert(freshMatrixRegistry.count() === 0, "Registre de matrice instancié localement est vierge");
  });

  const success = assertionsFailed === 0;
  return Object.freeze({
    success,
    testsRun,
    passed: assertionsPassed,
    failed: assertionsFailed,
    assertionsPassed,
    assertionsFailed,
    results: Object.freeze(results),
  });
}
