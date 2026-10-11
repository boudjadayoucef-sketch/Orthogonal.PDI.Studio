/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT INTEGRATION TESTS
 * Reference: NORM-14-09 (Integration with COMPONENT-01 → COMPONENT-05)
 * 
 * Tests d'intégrité, de conformité, d'injection, de traçabilité et de déterminisme
 * pour l'intégration Composant ↔ Spec / Compatibilité.
 * Minimum 50 tests requis.
 */

import { NormativeComponentIntegrationEngine } from "../engine/normativeComponentIntegrationEngine";
import { validateNormativeComponentIntegrationQuery } from "../validators/normativeComponentIntegrationValidator";
import type {
  INormativeSpecCompatibilityIntegrationEngine,
  NormativeSpecCompatibilityIntegrationQuery,
  NormativeSpecCompatibilityIntegrationResult,
} from "../types/normativeSpecCompatibilityIntegrationTypes";
import type {
  ComponentResolutionRequest,
  ComponentResolutionResult,
  IComponentResolutionEngine,
} from "../types/componentResolutionTypes";
import type {
  NormativeComponentIntegrationQuery,
} from "../types/normativeComponentIntegrationTypes";
import type {
  NormativeMultiCompatibilityQuery,
} from "../types/normativeMultiCompatibilityTypes";
import type {
  PipingSpecResolutionResult,
} from "../types/pipingSpecResolverTypes";

// Mock helper pour NORM-14-08
class MockSpecCompatibilityIntegrationEngine
  implements INormativeSpecCompatibilityIntegrationEngine
{
  public callCount = 0;
  public lastQuery?: NormativeSpecCompatibilityIntegrationQuery;

  constructor(
    private readonly defaultResult?: Partial<NormativeSpecCompatibilityIntegrationResult>
  ) {}

  public resolve(
    query: NormativeSpecCompatibilityIntegrationQuery
  ): NormativeSpecCompatibilityIntegrationResult {
    this.callCount++;
    this.lastQuery = query;

    return Object.freeze({
      status: this.defaultResult?.status ?? "COMPATIBLE",
      specResolution: Object.freeze({ ...query.specResolution }),
      compatibilityResult: Object.freeze({
        status: this.defaultResult?.status ?? "COMPATIBLE",
        constraintResults: Object.freeze([]),
        matchedRuleIds: Object.freeze(this.defaultResult?.matchedRuleIds ?? ["SPEC_COMPAT_RULE_01"]),
        evidenceIds: Object.freeze(this.defaultResult?.evidenceIds ?? ["SPEC_COMPAT_EVID_01"]),
        conflictCodes: Object.freeze(this.defaultResult?.conflictCodes ?? []),
        message: "Mock spec compatibility resolved.",
      }),
      matchedRuleIds: Object.freeze(this.defaultResult?.matchedRuleIds ?? ["SPEC_COMPAT_RULE_01"]),
      evidenceIds: Object.freeze(this.defaultResult?.evidenceIds ?? ["SPEC_COMPAT_EVID_01"]),
      conflictCodes: Object.freeze(this.defaultResult?.conflictCodes ?? []),
      message: "Mock spec compatibility resolved.",
    });
  }
}

// Mock helper pour COMPONENT-04
class MockComponentResolutionEngine implements IComponentResolutionEngine {
  public callCount = 0;
  public lastRequest?: ComponentResolutionRequest;

  constructor(
    private readonly defaultResult?: Partial<ComponentResolutionResult>
  ) {}

  public resolve(request: ComponentResolutionRequest): ComponentResolutionResult {
    this.callCount++;
    this.lastRequest = request;

    return Object.freeze({
      status: this.defaultResult?.status ?? "RESOLVED",
      specificationId: request.specificationId,
      componentType: request.context.componentType,
      resolvedCandidateId: this.defaultResult?.resolvedCandidateId ?? "SYN_CANDIDATE_001",
      evaluatedCandidateIds: Object.freeze(["SYN_CANDIDATE_001"]),
      eligibleCandidateIds: Object.freeze(["SYN_CANDIDATE_001"]),
      unverifiedCandidateIds: Object.freeze([]),
      invalidCandidateIds: Object.freeze([]),
      matchedRuleIds: Object.freeze(this.defaultResult?.matchedRuleIds ?? ["COMP_RULE_01"]),
      compatibilityRuleIds: Object.freeze(this.defaultResult?.compatibilityRuleIds ?? []),
      evidenceIds: Object.freeze(this.defaultResult?.evidenceIds ?? ["COMP_EVID_01"]),
      message: "Mock component resolved.",
    });
  }
}

// Générateur de requête valide synthétique
function createValidQuery(
  overrides?: Partial<NormativeComponentIntegrationQuery>
): NormativeComponentIntegrationQuery {
  const specResolution: PipingSpecResolutionResult = {
    status: "COMPATIBLE",
    specificationId: "SYN_SPEC_001",
    componentType: "PIPE",
    matchedRuleIds: ["SPEC_RULE_A"],
    compatibilityRuleIds: ["SPEC_RULE_B"],
    evidenceIds: ["SPEC_EVID_A"],
  };

  const compatibilityQuery: NormativeMultiCompatibilityQuery = {
    constraints: [
      {
        constraintType: "COMPONENT",
        left: {
          entityType: "PIPE",
          entityId: "SYN_PIPE_001",
        },
        right: {
          entityType: "VALVE",
          entityId: "SYN_VALVE_001",
        },
      },
    ],
  };

  return {
    componentContext: {
      specificationId: "SYN_SPEC_001",
      componentType: "PIPE",
      nominalSize: "SYN_SIZE_100",
      materialId: "SYN_MAT_001",
    },
    specResolution,
    compatibilityQuery,
    ...overrides,
  };
}

export function runNormativeComponentIntegrationTests(): {
  total: number;
  passed: number;
  failed: number;
  results: string[];
} {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      results.push(`FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      results.push(`PASS: ${name}`);
    } catch (e: any) {
      // already recorded in assert
    }
  }

  // =========================================================================
  // SECTION 1: VALIDATION STRUCTURELLE (1 à 10)
  // =========================================================================

  runTest("TEST 01: Requête valide acceptée", () => {
    const q = createValidQuery();
    const v = validateNormativeComponentIntegrationQuery(q);
    assert(v.valid, "Requête valide doit être acceptée.");
    assert(v.errors.length === 0, "Aucune erreur.");
  });

  runTest("TEST 02: Rejet de null", () => {
    const v = validateNormativeComponentIntegrationQuery(null);
    assert(!v.valid, "null doit être rejeté.");
    assert(v.errors.some((e) => e.code === "INVALID_QUERY_OBJECT"), "Code d'erreur attendu.");
  });

  runTest("TEST 03: Rejet de undefined", () => {
    const v = validateNormativeComponentIntegrationQuery(undefined);
    assert(!v.valid, "undefined doit être rejeté.");
  });

  runTest("TEST 04: Rejet de primitive string/number", () => {
    const v1 = validateNormativeComponentIntegrationQuery("not_an_object");
    const v2 = validateNormativeComponentIntegrationQuery(12345);
    assert(!v1.valid && !v2.valid, "Primitives doivent être rejetées.");
  });

  runTest("TEST 05: Rejet de tableau", () => {
    const v = validateNormativeComponentIntegrationQuery([createValidQuery()]);
    assert(!v.valid, "Tableau doit être rejeté.");
  });

  runTest("TEST 06: componentContext absent rejeté", () => {
    const q = createValidQuery();
    delete (q as any).componentContext;
    const v = validateNormativeComponentIntegrationQuery(q);
    assert(!v.valid, "componentContext absent doit être rejeté.");
    assert(v.errors.some((e) => e.code === "MISSING_COMPONENT_CONTEXT"), "Code attendu.");
  });

  runTest("TEST 07: specResolution absente rejetée", () => {
    const q = createValidQuery();
    delete (q as any).specResolution;
    const v = validateNormativeComponentIntegrationQuery(q);
    assert(!v.valid, "specResolution absente doit être rejetée.");
    assert(v.errors.some((e) => e.code === "MISSING_SPEC_RESOLUTION"), "Code attendu.");
  });

  runTest("TEST 08: compatibilityQuery absente rejetée", () => {
    const q = createValidQuery();
    delete (q as any).compatibilityQuery;
    const v = validateNormativeComponentIntegrationQuery(q);
    assert(!v.valid, "compatibilityQuery absente doit être rejetée.");
    assert(v.errors.some((e) => e.code === "MISSING_COMPATIBILITY_QUERY"), "Code attendu.");
  });

  runTest("TEST 09: Structure component invalide rejetée", () => {
    const q = createValidQuery({
      componentContext: {
        specificationId: "",
        componentType: "INVALID_TYPE" as any,
      },
    });
    const v = validateNormativeComponentIntegrationQuery(q);
    assert(!v.valid, "Type de composant invalide doit être rejeté.");
    assert(v.errors.some((e) => e.code === "EMPTY_CONTEXT_SPEC_ID"), "Empty specId code.");
  });

  runTest("TEST 10: Identifiants opaques acceptés sans heuristiques", () => {
    const q = createValidQuery({
      componentContext: {
        specificationId: "COMP_ASME_B16_TEST",
        componentType: "VALVE",
        nominalSize: "DIM_NPS_DN_TEST",
        materialId: "VALVE_CRMO_TEST",
      },
    });
    const v = validateNormativeComponentIntegrationQuery(q);
    assert(v.valid, "Identifiants opaques contenant des tokens normatifs doivent être acceptés.");
  });

  // =========================================================================
  // SECTION 2: DEPENDENCY INJECTION & CONSTRUCTOR VALIDATION (11 à 15)
  // =========================================================================

  runTest("TEST 11: Moteurs injectés correctement (IComponentResolutionEngine, INormativeSpecCompatibilityIntegrationEngine)", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    assert(engine !== null, "Moteur instancié.");
  });

  runTest("TEST 12: Injection obligatoire - rejet si componentEngine null ou invalide", () => {
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    let threw = false;
    try {
      new (NormativeComponentIntegrationEngine as any)(null, mockSpec);
    } catch {
      threw = true;
    }
    assert(threw, "Doit lever une exception si componentEngine est absent.");

    let threwInvalid = false;
    try {
      new (NormativeComponentIntegrationEngine as any)({} as any, mockSpec);
    } catch {
      threwInvalid = true;
    }
    assert(threwInvalid, "Doit lever une exception si componentEngine.resolve n'est pas une fonction.");
  });

  runTest("TEST 13: Injection obligatoire - rejet si specCompatibilityEngine null ou invalide", () => {
    const mockComp = new MockComponentResolutionEngine();
    let threw = false;
    try {
      new (NormativeComponentIntegrationEngine as any)(mockComp, null);
    } catch {
      threw = true;
    }
    assert(threw, "Doit lever une exception si specCompatibilityEngine est absent.");

    let threwInvalid = false;
    try {
      new (NormativeComponentIntegrationEngine as any)(mockComp, {} as any);
    } catch {
      threwInvalid = true;
    }
    assert(threwInvalid, "Doit lever une exception si specCompatibilityEngine.resolve n'est pas une fonction.");
  });

  runTest("TEST 14: Les moteurs injectés sont appelés exactement une fois par resolve()", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery();
    engine.resolve(q);
    assert(mockComp.callCount === 1, "componentEngine appelé exactement 1 fois.");
    assert(mockSpec.callCount === 1, "specCompatibilityEngine appelé exactement 1 fois.");
  });

  runTest("TEST 15: Aucun registre ou matrice interne instancié dans NORM-14-09", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    assert(!(engine as any).registry, "Aucun registre interne.");
    assert(!(engine as any).matrixRegistry, "Aucune matrice interne.");
  });

  // =========================================================================
  // SECTION 3: COMPONENT INTEGRATION & STATUS MAPPING (16 à 25)
  // =========================================================================

  runTest("TEST 16: Statut RESOLVED mappé vers COMPATIBLE", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "COMPATIBLE", "Statut consolidé COMPATIBLE.");
    assert(res.componentResolution.status === "RESOLVED", "Statut composant préservé.");
  });

  runTest("TEST 17: Statut NO_CANDIDATE mappé vers INCOMPATIBLE avec code de conflit", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "NO_CANDIDATE" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INCOMPATIBLE", "NO_CANDIDATE donne INCOMPATIBLE.");
    assert(res.componentResolution.status === "NO_CANDIDATE", "Statut NO_CANDIDATE conservé.");
    assert(res.conflictCodes.includes("COMPONENT_NO_CANDIDATE"), "Code COMPONENT_NO_CANDIDATE émis.");
  });

  runTest("TEST 18: Statut UNVERIFIED mappé vers UNVERIFIED", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "UNVERIFIED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "UNVERIFIED", "Statut consolidé UNVERIFIED.");
  });

  runTest("TEST 19: Statut AMBIGUOUS mappé vers UNVERIFIED", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "AMBIGUOUS" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "UNVERIFIED", "AMBIGUOUS donne UNVERIFIED.");
  });

  runTest("TEST 20: Statut INVALID mappé vers INVALID", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "INVALID" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INVALID", "INVALID donne INVALID.");
  });

  runTest("TEST 21: Conservation stricte du résultat COMPONENT sans modification", () => {
    const mockComp = new MockComponentResolutionEngine({
      status: "RESOLVED",
      resolvedCandidateId: "SYN_CAND_999",
      matchedRuleIds: ["RULE_X"],
    });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.componentResolution.resolvedCandidateId === "SYN_CAND_999", "CandidateId conservé.");
    assert(res.componentResolution.matchedRuleIds.includes("RULE_X"), "Règles conservées.");
    assert(Object.isFrozen(res.componentResolution), "Résultat composant immuable.");
  });

  runTest("TEST 22: Aucune promotion artificielle du statut composant", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "UNVERIFIED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "UNVERIFIED", "UNVERIFIED ne doit pas être promu COMPATIBLE.");
  });

  runTest("TEST 23: Paramètres transmis fidèlement au moteur COMPONENT", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery({
      componentContext: {
        specificationId: "SPEC_TEST_CTX",
        componentType: "FLANGE",
        nominalSize: "150",
      },
    });
    engine.resolve(q);
    assert(mockComp.lastRequest?.specificationId === "SPEC_TEST_CTX", "SpecificationId transmis.");
    assert(mockComp.lastRequest?.context.componentType === "FLANGE", "ComponentType transmis.");
  });

  runTest("TEST 24: Pas de bypass caller pour componentResolution", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "NO_CANDIDATE" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery();
    // Même si un caller tente d'injecter componentResolution dans l'objet query:
    (q as any).componentResolution = { status: "RESOLVED" };
    const res = engine.resolve(q);
    assert(res.status === "INCOMPATIBLE", "Le moteur COMPONENT réel doit être utilisé, bypass ignoré/interdit.");
    assert(mockComp.callCount === 1, "Moteur COMPONENT appelé.");
  });

  runTest("TEST 25: Déterminisme strict (même entrée -> même sortie)", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery();
    const res1 = engine.resolve(q);
    const res2 = engine.resolve(q);
    assert(res1.status === res2.status, "Statuts identiques.");
    assert(JSON.stringify(res1) === JSON.stringify(res2), "JSON identique.");
  });

  // =========================================================================
  // SECTION 4: SPEC / NORM-14-08 INTEGRATION (26 à 35)
  // =========================================================================

  runTest("TEST 26: SPEC / NORM-14-08 compatible", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "COMPATIBLE", "Consolidé COMPATIBLE.");
  });

  runTest("TEST 27: SPEC / NORM-14-08 incompatible", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "INCOMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INCOMPATIBLE", "Consolidé INCOMPATIBLE.");
  });

  runTest("TEST 28: SPEC / NORM-14-08 unverified", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "UNVERIFIED" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "UNVERIFIED", "Consolidé UNVERIFIED.");
  });

  runTest("TEST 29: SPEC / NORM-14-08 invalid", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "INVALID" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INVALID", "Consolidé INVALID.");
  });

  runTest("TEST 30: Délégation exacte des paramètres à NORM-14-08", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery();
    engine.resolve(q);
    assert(mockSpec.lastQuery?.specResolution === q.specResolution, "specResolution transmis exactement.");
    assert(mockSpec.lastQuery?.compatibilityQuery === q.compatibilityQuery, "compatibilityQuery transmis exactement.");
  });

  runTest("TEST 31: Aucune modification de SPEC-01", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery();
    const res = engine.resolve(q);
    assert(res.specCompatibilityResult.specResolution.specificationId === "SYN_SPEC_001", "SPEC-01 inchangé.");
  });

  runTest("TEST 32: Aucune promotion SPEC-01", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "UNVERIFIED" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "UNVERIFIED", "Pas de promotion.");
  });

  runTest("TEST 33: Conservation des traces SPEC-01", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      matchedRuleIds: ["SPEC_TRACE_01", "SPEC_TRACE_02"],
      evidenceIds: ["SPEC_EVID_TRACE_01"],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.matchedRuleIds.includes("SPEC_TRACE_01"), "Traces de règles SPEC conservées.");
    assert(res.evidenceIds.includes("SPEC_EVID_TRACE_01"), "Traces d'évidence SPEC conservées.");
  });

  runTest("TEST 34: Propagation des codes de conflit SPEC / NORM-14-08", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      status: "INCOMPATIBLE",
      conflictCodes: ["RATING_MISMATCH", "MATERIAL_DISCREPANCY"],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.conflictCodes.includes("RATING_MISMATCH"), "Conflit rating propagé.");
    assert(res.conflictCodes.includes("MATERIAL_DISCREPANCY"), "Conflit matériau propagé.");
  });

  runTest("TEST 35: Résultat intégré SPEC déterministe", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const q = createValidQuery();
    const r1 = engine.resolve(q);
    const r2 = engine.resolve(q);
    assert(r1.specCompatibilityResult.status === r2.specCompatibilityResult.status, "Déterminisme specCompat.");
  });

  // =========================================================================
  // SECTION 5: CONSOLIDATION DES STATUTS (36 à 45)
  // =========================================================================

  runTest("TEST 36: Consolidation finale INVALID (spec INVALID, comp RESOLVED)", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "INVALID" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INVALID", "INVALID gagne.");
  });

  runTest("TEST 37: Consolidation finale INVALID (comp INVALID, spec COMPATIBLE)", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "INVALID" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INVALID", "INVALID composant gagne.");
  });

  runTest("TEST 38: Consolidation finale INCOMPATIBLE (spec INCOMPATIBLE, comp RESOLVED)", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "INCOMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INCOMPATIBLE", "INCOMPATIBLE gagne sur COMPATIBLE.");
  });

  runTest("TEST 39: Consolidation finale INCOMPATIBLE (comp NO_CANDIDATE, spec COMPATIBLE)", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "NO_CANDIDATE" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INCOMPATIBLE", "NO_CANDIDATE gagne sur COMPATIBLE.");
  });

  runTest("TEST 40: Priorité INVALID > INCOMPATIBLE", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "INVALID" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "INCOMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INVALID", "INVALID a priorité sur INCOMPATIBLE.");
  });

  runTest("TEST 41: Priorité INCOMPATIBLE > UNVERIFIED", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "NO_CANDIDATE" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "UNVERIFIED" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "INCOMPATIBLE", "INCOMPATIBLE a priorité sur UNVERIFIED.");
  });

  runTest("TEST 42: Priorité UNVERIFIED > COMPATIBLE", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "UNVERIFIED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "UNVERIFIED", "UNVERIFIED a priorité sur COMPATIBLE.");
  });

  runTest("TEST 43: Statut COMPATIBLE uniquement si COMPONENT et SPEC/Compatibilité sont valides", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "COMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.status === "COMPATIBLE", "Seule combinaison donnant COMPATIBLE.");
  });

  runTest("TEST 44: Conflit COMPONENT_NO_CANDIDATE propagé dans conflictCodes", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "NO_CANDIDATE" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.conflictCodes.includes("COMPONENT_NO_CANDIDATE"), "Conflit NO_CANDIDATE présent.");
  });

  runTest("TEST 45: Ordre de consolidation déterministe", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "UNVERIFIED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({ status: "INCOMPATIBLE" });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res1 = engine.resolve(createValidQuery());
    const res2 = engine.resolve(createValidQuery());
    assert(res1.status === "INCOMPATIBLE" && res2.status === "INCOMPATIBLE", "Ordre immuable.");
  });

  // =========================================================================
  // SECTION 6: TRACEABILITY & IMMUTABILITY (46 à 50)
  // =========================================================================

  runTest("TEST 46: matchedRuleIds contient l'union de COMPONENT et SPEC/Compat", () => {
    const mockComp = new MockComponentResolutionEngine({
      matchedRuleIds: ["RULE_C", "RULE_A"],
      compatibilityRuleIds: ["RULE_D"],
    });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      matchedRuleIds: ["RULE_B", "RULE_A"],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.matchedRuleIds.includes("RULE_A"), "RULE_A présent.");
    assert(res.matchedRuleIds.includes("RULE_B"), "RULE_B présent.");
    assert(res.matchedRuleIds.includes("RULE_C"), "RULE_C présent.");
    assert(res.matchedRuleIds.includes("RULE_D"), "RULE_D présent.");
  });

  runTest("TEST 47: evidenceIds contient l'union sans perte", () => {
    const mockComp = new MockComponentResolutionEngine({
      evidenceIds: ["EVID_1"],
    });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      evidenceIds: ["EVID_2"],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.evidenceIds.includes("EVID_1") && res.evidenceIds.includes("EVID_2"), "Évidences conservées.");
  });

  runTest("TEST 48: conflictCodes consolidés", () => {
    const mockComp = new MockComponentResolutionEngine({ status: "RESOLVED" });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      conflictCodes: ["CONFLICT_Y", "CONFLICT_X"],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.conflictCodes.includes("CONFLICT_X") && res.conflictCodes.includes("CONFLICT_Y"), "Conflits conservés.");
  });

  runTest("TEST 49: Déduplication, tri alphabétique et freeze des traces", () => {
    const mockComp = new MockComponentResolutionEngine({
      matchedRuleIds: ["R_Z", "R_A"],
      evidenceIds: ["E_Z", "E_B"],
    });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      matchedRuleIds: ["R_A"],
      evidenceIds: ["E_B"],
      conflictCodes: ["C_B", "C_A"],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());

    // Déduplication & Tri
    assert(JSON.stringify(res.matchedRuleIds) === JSON.stringify(["R_A", "R_Z"]), "Règles triées et uniques.");
    assert(JSON.stringify(res.evidenceIds) === JSON.stringify(["E_B", "E_Z"]), "Évidences triées et uniques.");
    assert(JSON.stringify(res.conflictCodes) === JSON.stringify(["C_A", "C_B"]), "Conflits triés et uniques.");

    // Immutabilité (freeze)
    assert(Object.isFrozen(res.matchedRuleIds), "matchedRuleIds gelé.");
    assert(Object.isFrozen(res.evidenceIds), "evidenceIds gelé.");
    assert(Object.isFrozen(res.conflictCodes), "conflictCodes gelé.");
    assert(Object.isFrozen(res), "Résultat global gelé.");
  });

  runTest("TEST 50: Aucune évidence inventée (0 fabrication)", () => {
    const mockComp = new MockComponentResolutionEngine({
      evidenceIds: [],
    });
    const mockSpec = new MockSpecCompatibilityIntegrationEngine({
      evidenceIds: [],
    });
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(res.evidenceIds.length === 0, "Aucune fausse évidence créée.");
  });

  // =========================================================================
  // SECTION 7: ANTI-HEURISTIQUES & EDGE CASES (51 à 55)
  // =========================================================================

  runTest("TEST 51: Anti-heuristiques — IDs avec tokens normatifs", () => {
    const q = createValidQuery({
      componentContext: {
        specificationId: "COMP_ASME_B16_TEST",
        componentType: "PIPE",
        materialId: "PIPE_CS_TEST",
        ratingValue: "RATING_CLASS_TEST",
        nominalSize: "DIM_NPS_DN_TEST",
        productStandardId: "PRODUCT_API_TEST",
      },
    });
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(q);
    assert(res.status === "COMPATIBLE", "Tokens opaques traités sans parsing sémantique.");
  });

  runTest("TEST 52: Support de tous les types de composants (PIPE, FITTING, FLANGE, VALVE)", () => {
    const types = ["PIPE", "FITTING", "FLANGE", "VALVE"] as const;
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    for (const t of types) {
      const q = createValidQuery({
        componentContext: {
          specificationId: "SPEC_ALL_TYPES",
          componentType: t,
        },
      });
      const res = engine.resolve(q);
      assert(res.componentResolution.componentType === t, `Type ${t} supporté.`);
    }
  });

  runTest("TEST 53: Résultat d'erreur structurelle conforme et immuable", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve({} as any);
    assert(res.status === "INVALID", "Requête vide donne INVALID.");
    assert(res.conflictCodes.includes("INVALID_COMPONENT_INTEGRATION_QUERY"), "Code de conflit requis.");
    assert(Object.isFrozen(res), "Résultat d'erreur gelé.");
  });

  runTest("TEST 54: Immutabilité globale du contrat retourné", () => {
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(createValidQuery());
    assert(Object.isFrozen(res), "Résultat racine gelé.");
    assert(Object.isFrozen(res.componentResolution), "componentResolution gelé.");
    assert(Object.isFrozen(res.matchedRuleIds), "matchedRuleIds gelé.");
    assert(Object.isFrozen(res.evidenceIds), "evidenceIds gelé.");
    assert(Object.isFrozen(res.conflictCodes), "conflictCodes gelé.");
  });

  runTest("TEST 55: Absence de données normatives réelles codées en dur", () => {
    const q = createValidQuery({
      componentContext: {
        specificationId: "CUSTOM_RANDOM_SPEC_42",
        componentType: "VALVE",
        nominalSize: "CUSTOM_SIZE_999",
      },
    });
    const mockComp = new MockComponentResolutionEngine();
    const mockSpec = new MockSpecCompatibilityIntegrationEngine();
    const engine = new NormativeComponentIntegrationEngine(mockComp, mockSpec);
    const res = engine.resolve(q);
    assert(res.status === "COMPATIBLE", "Zéro blocage sur identifiant arbitraire.");
  });

  return {
    total: passed + failed,
    passed,
    failed,
    results,
  };
}
