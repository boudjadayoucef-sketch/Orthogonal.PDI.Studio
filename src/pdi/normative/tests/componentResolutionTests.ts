/**
 * PDI NORMATIVE ENGINE — COMPONENT RESOLUTION TESTS
 * Reference: COMPONENT-04 (Component Resolution Orchestrator)
 * 
 * Suite de tests unitaires et d'intégration validant l'orchestrateur COMPONENT-04.
 * Couvre l'ensemble des 20 exigences de validation, délégation, non-promotion et déterminisme.
 */

import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { PipingSpecResolver } from "../engine/pipingSpecResolver";
import { ComponentSelectionEngine } from "../engine/componentSelectionEngine";
import { ComponentCandidateSelectionEngine } from "../engine/componentCandidateSelectionEngine";
import { ComponentCandidateRegistry } from "../registry/componentCandidateRegistry";
import { ComponentCandidateResolver } from "../engine/componentCandidateResolver";
import { ComponentResolutionEngine } from "../engine/componentResolutionEngine";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type {
  ComponentCandidate,
  ComponentSelectionContext,
  ComponentSelectionResult,
  IComponentSelectionEngine,
} from "../types/componentSelectionTypes";
import type { ComponentCandidateSelectionInput } from "../types/componentCandidateSelectionTypes";
import type {
  ComponentCandidateResolutionResult,
  IComponentCandidateResolver,
} from "../types/componentCandidateRegistryTypes";
import type { ComponentResolutionRequest } from "../types/componentResolutionTypes";

export interface Component04TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[COMPONENT-04 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Fake Resolver pour tests unitaires isolés de délégation COMPONENT-04.
 */
class FakeCandidateResolver implements IComponentCandidateResolver {
  private fakeResult: ComponentCandidateResolutionResult;

  constructor(fakeResult: ComponentCandidateResolutionResult) {
    this.fakeResult = fakeResult;
  }

  public setFakeResult(res: ComponentCandidateResolutionResult) {
    this.fakeResult = res;
  }

  public resolve(_candidateId: string): ComponentCandidate | undefined {
    return undefined;
  }

  public resolveBySpecification(
    _specificationId: string,
    _context: ComponentSelectionContext
  ): ComponentCandidateResolutionResult {
    return this.fakeResult;
  }

  public resolveCandidates(
    _specificationId: string,
    _context: ComponentSelectionContext
  ): readonly ComponentCandidate[] {
    return [];
  }
}

/**
 * Exécute les tests unitaires et d'intégration COMPONENT-04.
 */
export function runComponentResolutionTests(): Component04TestResult {
  const results: string[] = [];
  let testsRun = 0;

  function runTest(testName: string, testFn: () => void) {
    testsRun++;
    try {
      testFn();
      results.push(`✅ PASS: ${testName}`);
    } catch (err: any) {
      results.push(`❌ FAIL: ${testName} (${err?.message || err})`);
    }
  }

  // Contexte par défaut synthétique
  const defaultContext: ComponentSelectionContext = {
    specificationId: "SYNTHETIC_SPEC_01",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    dimensionalStandardId: "SYNTHETIC_STD_PIPE",
  };

  // Base fake result
  const baseFakeResult: ComponentCandidateResolutionResult = {
    status: "RESOLVED",
    specificationId: "SYNTHETIC_SPEC_01",
    componentType: "PIPE",
    selectedCandidateId: "SYNTHETIC_CAND_01",
    candidateIds: ["SYNTHETIC_CAND_01"],
    evaluatedCandidateIds: ["SYNTHETIC_CAND_01"],
    eligibleCandidateIds: ["SYNTHETIC_CAND_01"],
    unverifiedCandidateIds: [],
    invalidCandidateIds: [],
    matchedRuleIds: [],
    compatibilityRuleIds: [],
    evidenceIds: [],
    message: "Resolved successfully.",
  };

  // =========================================================================
  // TESTS 1–5 : VALIDATION STRUCTURELLE
  // =========================================================================

  // TEST 01: request valide
  runTest("TEST 01 — Request valide passe la validation", () => {
    const fakeResolver = new FakeCandidateResolver(baseFakeResult);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const req: ComponentResolutionRequest = {
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    };

    const res = engine.resolve(req);
    assert(res.status === "RESOLVED", `Expected RESOLVED, got '${res.status}'`);
    assert(res.resolvedCandidateId === "SYNTHETIC_CAND_01", "resolvedCandidateId mismatch");
  });

  // TEST 02: null rejeté -> INVALID
  runTest("TEST 02 — null request -> INVALID", () => {
    const fakeResolver = new FakeCandidateResolver(baseFakeResult);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve(null as any);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("INVALID_REQUEST"), "Expected INVALID_REQUEST message");
  });

  // TEST 03: primitive rejetée -> INVALID
  runTest("TEST 03 — primitive request -> INVALID", () => {
    const fakeResolver = new FakeCandidateResolver(baseFakeResult);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve("NOT_A_REQUEST" as any);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
  });

  // TEST 04: specificationId vide -> INVALID
  runTest("TEST 04 — specificationId vide -> INVALID", () => {
    const fakeResolver = new FakeCandidateResolver(baseFakeResult);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "   ",
      context: defaultContext,
    });
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("specificationId must be a non-empty string"), "Expected error detail");
  });

  // TEST 05: specificationId / context incohérents -> INVALID
  runTest("TEST 05 — specificationId / context incohérents -> INVALID", () => {
    const fakeResolver = new FakeCandidateResolver(baseFakeResult);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: {
        ...defaultContext,
        specificationId: "SYNTHETIC_SPEC_MISMATCH",
      },
    });
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("specificationId mismatch"), "Expected mismatch error message");
  });

  // =========================================================================
  // TESTS 6–10 : RÉSOLUTION SIMPLE (MAPPING STATUTS)
  // =========================================================================

  // TEST 06: COMPONENT-03 RESOLVED -> COMPONENT-04 RESOLVED
  runTest("TEST 06 — COMPONENT-03 RESOLVED -> COMPONENT-04 RESOLVED", () => {
    const fakeResolver = new FakeCandidateResolver(baseFakeResult);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "RESOLVED", "Status must be RESOLVED");
    assert(res.resolvedCandidateId === "SYNTHETIC_CAND_01", "resolvedCandidateId must match");
  });

  // TEST 07: COMPONENT-03 NO_CANDIDATE -> COMPONENT-04 NO_CANDIDATE
  runTest("TEST 07 — COMPONENT-03 NO_CANDIDATE -> COMPONENT-04 NO_CANDIDATE", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "NO_CANDIDATE",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined,
      candidateIds: [],
      evaluatedCandidateIds: [],
      eligibleCandidateIds: [],
      unverifiedCandidateIds: [],
      invalidCandidateIds: [],
      message: "No candidates available.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "NO_CANDIDATE", "Status must be NO_CANDIDATE");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must be undefined");
  });

  // TEST 08: COMPONENT-03 UNVERIFIED -> COMPONENT-04 UNVERIFIED
  runTest("TEST 08 — COMPONENT-03 UNVERIFIED -> COMPONENT-04 UNVERIFIED", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "UNVERIFIED",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined,
      candidateIds: ["SYNTHETIC_CAND_UNVERIFIED"],
      evaluatedCandidateIds: ["SYNTHETIC_CAND_UNVERIFIED"],
      eligibleCandidateIds: [],
      unverifiedCandidateIds: ["SYNTHETIC_CAND_UNVERIFIED"],
      invalidCandidateIds: [],
      message: "Unverified candidates present.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "UNVERIFIED", "Status must be UNVERIFIED");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must be undefined");
  });

  // TEST 09: COMPONENT-03 AMBIGUOUS -> COMPONENT-04 AMBIGUOUS
  runTest("TEST 09 — COMPONENT-03 AMBIGUOUS -> COMPONENT-04 AMBIGUOUS", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "AMBIGUOUS",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined,
      candidateIds: ["SYNTHETIC_CAND_A", "SYNTHETIC_CAND_B"],
      evaluatedCandidateIds: ["SYNTHETIC_CAND_A", "SYNTHETIC_CAND_B"],
      eligibleCandidateIds: ["SYNTHETIC_CAND_A", "SYNTHETIC_CAND_B"],
      unverifiedCandidateIds: [],
      invalidCandidateIds: [],
      message: "Multiple eligible candidates found.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "AMBIGUOUS", "Status must be AMBIGUOUS");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must be undefined");
  });

  // TEST 10: COMPONENT-03 INVALID -> COMPONENT-04 INVALID
  runTest("TEST 10 — COMPONENT-03 INVALID -> COMPONENT-04 INVALID", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "INVALID",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined,
      candidateIds: [],
      evaluatedCandidateIds: [],
      eligibleCandidateIds: [],
      unverifiedCandidateIds: [],
      invalidCandidateIds: [],
      message: "Invalid resolution request.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "INVALID", "Status must be INVALID");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must be undefined");
  });

  // =========================================================================
  // TESTS 11–14 : SÉCURITÉ DE RÉSOLUTION & NON-FALLBACK
  // =========================================================================

  // TEST 11: Aucun fallback si candidat absent
  runTest("TEST 11 — Aucun fallback (NO_CANDIDATE ne crée aucun candidat synthétique)", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "NO_CANDIDATE",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined,
      candidateIds: [],
      evaluatedCandidateIds: [],
      eligibleCandidateIds: [],
      unverifiedCandidateIds: [],
      invalidCandidateIds: [],
      message: "No candidates available.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "NO_CANDIDATE", "Status must remain NO_CANDIDATE");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must remain undefined");
  });

  // TEST 12: Aucun candidat arbitrairement choisi en cas d'ambiguïté
  runTest("TEST 12 — Aucun candidat arbitrairement choisi pour AMBIGUOUS", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "AMBIGUOUS",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined,
      candidateIds: ["SYNTHETIC_CAND_01", "SYNTHETIC_CAND_02"],
      evaluatedCandidateIds: ["SYNTHETIC_CAND_01", "SYNTHETIC_CAND_02"],
      eligibleCandidateIds: ["SYNTHETIC_CAND_01", "SYNTHETIC_CAND_02"],
      unverifiedCandidateIds: [],
      invalidCandidateIds: [],
      message: "Multiple eligible candidates.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "AMBIGUOUS", "Must preserve AMBIGUOUS");
    assert(res.resolvedCandidateId === undefined, "Must NOT pick first or default candidate");
  });

  // TEST 13: resolvedCandidateId obligatoire pour RESOLVED (anomalie -> INVALID)
  runTest("TEST 13 — resolvedCandidateId obligatoire pour RESOLVED (anomalie -> INVALID)", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "RESOLVED",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: undefined, // ANOMALIE
      candidateIds: [],
      evaluatedCandidateIds: [],
      eligibleCandidateIds: [],
      unverifiedCandidateIds: [],
      invalidCandidateIds: [],
      message: "Broken resolver state.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "INVALID", "Missing selectedCandidateId must convert to INVALID");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must remain undefined");
  });

  // TEST 14: Aucun changement de statut permettant de promouvoir UNVERIFIED vers RESOLVED
  runTest("TEST 14 — Aucun changement de statut : UNVERIFIED ne devient jamais RESOLVED", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "UNVERIFIED",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: "SYNTHETIC_CAND_UNVERIFIED", // tentative de promotion
      candidateIds: ["SYNTHETIC_CAND_UNVERIFIED"],
      evaluatedCandidateIds: ["SYNTHETIC_CAND_UNVERIFIED"],
      eligibleCandidateIds: [],
      unverifiedCandidateIds: ["SYNTHETIC_CAND_UNVERIFIED"],
      invalidCandidateIds: [],
      message: "Unverified candidate.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });
    assert(res.status === "UNVERIFIED", "Status must remain UNVERIFIED");
    assert(res.resolvedCandidateId === undefined, "resolvedCandidateId must be undefined for UNVERIFIED");
  });

  // =========================================================================
  // TESTS 15–17 : TRAÇABILITÉ EXHAUSTIVE ET TRIÉE
  // =========================================================================

  // TEST 15: Candidate IDs conservés et triés
  runTest("TEST 15 — Candidate IDs conservés et triés (evaluated, eligible, unverified, invalid)", () => {
    const fakeResolver = new FakeCandidateResolver({
      ...baseFakeResult,
      status: "RESOLVED",
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      selectedCandidateId: "SYNTHETIC_CAND_A",
      candidateIds: ["SYNTHETIC_CAND_A"],
      evaluatedCandidateIds: ["SYNTHETIC_CAND_Z", "SYNTHETIC_CAND_A"],
      eligibleCandidateIds: ["SYNTHETIC_CAND_A"],
      unverifiedCandidateIds: ["SYNTHETIC_CAND_U2", "SYNTHETIC_CAND_U1"],
      invalidCandidateIds: ["SYNTHETIC_CAND_I2", "SYNTHETIC_CAND_I1"],
      message: "Resolved with traces.",
    });
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });

    assert(res.evaluatedCandidateIds[0] === "SYNTHETIC_CAND_A", "evaluatedCandidateIds must be sorted");
    assert(res.evaluatedCandidateIds[1] === "SYNTHETIC_CAND_Z", "evaluatedCandidateIds must be sorted");
    assert(res.unverifiedCandidateIds[0] === "SYNTHETIC_CAND_U1", "unverifiedCandidateIds must be sorted");
    assert(res.invalidCandidateIds[0] === "SYNTHETIC_CAND_I1", "invalidCandidateIds must be sorted");
  });

  // TEST 16: Rule IDs conservés et triés
  runTest("TEST 16 — Rule IDs conservés et triés (matchedRuleIds, compatibilityRuleIds)", () => {
    const fakeResultWithRules: ComponentCandidateResolutionResult = {
      ...baseFakeResult,
      matchedRuleIds: ["SYNTHETIC_RULE_B", "SYNTHETIC_RULE_A"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_Z", "SYNTHETIC_COMPAT_A"],
    };
    const fakeResolver = new FakeCandidateResolver(fakeResultWithRules);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });

    assert(res.matchedRuleIds[0] === "SYNTHETIC_RULE_A", "matchedRuleIds must be sorted");
    assert(res.compatibilityRuleIds[0] === "SYNTHETIC_COMPAT_A", "compatibilityRuleIds must be sorted");
  });

  // TEST 17: Evidence IDs conservés et triés
  runTest("TEST 17 — Evidence IDs conservés et triés", () => {
    const fakeResultWithEv: ComponentCandidateResolutionResult = {
      ...baseFakeResult,
      evidenceIds: ["SYNTHETIC_EV_B", "SYNTHETIC_EV_A"],
    };
    const fakeResolver = new FakeCandidateResolver(fakeResultWithEv);
    const engine = new ComponentResolutionEngine(fakeResolver);

    const res = engine.resolve({
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    });

    assert(res.evidenceIds[0] === "SYNTHETIC_EV_A", "evidenceIds must be sorted");
    assert(res.evidenceIds[1] === "SYNTHETIC_EV_B", "evidenceIds must be sorted");
  });

  // =========================================================================
  // TESTS 18–20 : DÉTERMINISME ET NON-CONVERSION
  // =========================================================================

  // Intégration réelle COMPONENT-01 -> COMPONENT-02 -> COMPONENT-03 -> COMPONENT-04
  const evRegistry = new NormativeEvidenceRegistry();
  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_SPEC_01",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "DOC_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_COMPAT_01",
    standardId: "SYNTHETIC_STD_COMPAT" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_COMPAT",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "DOC_COMPAT",
    verificationStatus: "VERIFIED",
    verifiedBy: "AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });

  const evResolver = new NormativeEvidenceResolver(evRegistry);
  const compatRegistry = new NormativeCompatibilityRegistry();
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_SCH40",
    description: "SCH 40 pipe compat",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_01"],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evResolver);
  const syntheticPipingSpecs: PipingSpecification[] = [
    {
      id: "SYNTHETIC_SPEC_01",
      code: "SYN-SPEC-01",
      name: "Synthetic Spec 01",
      designCodeId: "SYNTHETIC_DESIGN_CODE_01" as any,
      materialReferenceIds: ["SYNTHETIC_MAT_A"],
      pipeRules: [
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_01",
          pipeDimensionalStandardId: "SYNTHETIC_STD_PIPE",
          nominalSizes: ["2"],
          schedule: "SCH 40",
          materialId: "SYNTHETIC_MAT_A",
          sourceStatus: "VERIFIED",
          evidenceIds: ["SYNTHETIC_EV_SPEC_01"],
        },
      ],
      fittingRules: [],
      flangeRules: [],
      valveRules: [],
      sourceStatus: "VERIFIED",
      evidenceIds: ["SYNTHETIC_EV_SPEC_01"],
    },
  ];

  const pipingSpecResolver = new PipingSpecResolver(syntheticPipingSpecs, compatEngine, evResolver);
  const selEngine = new ComponentSelectionEngine(pipingSpecResolver, evResolver);
  const candSelEngine = new ComponentCandidateSelectionEngine(selEngine);

  // TEST 18: Ordre inverse des candidats dans le registre -> résultat identique
  runTest("TEST 18 — Ordre inverse des candidats dans le registre -> résultat identique", () => {
    const candA: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_A",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const candB: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_B",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const reg1 = new ComponentCandidateRegistry();
    reg1.register(candA);
    reg1.register(candB);

    const reg2 = new ComponentCandidateRegistry();
    reg2.register(candB);
    reg2.register(candA);

    const orch1 = new ComponentResolutionEngine(new ComponentCandidateResolver(reg1, candSelEngine));
    const orch2 = new ComponentResolutionEngine(new ComponentCandidateResolver(reg2, candSelEngine));

    const req: ComponentResolutionRequest = {
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    };

    const res1 = orch1.resolve(req);
    const res2 = orch2.resolve(req);

    assert(res1.status === res2.status, "Status must match");
    assert(res1.status === "AMBIGUOUS", "Both must be AMBIGUOUS due to multiple eligible candidates");
    assert(
      JSON.stringify(res1.eligibleCandidateIds) === JSON.stringify(res2.eligibleCandidateIds),
      "eligibleCandidateIds must match identically"
    );
  });

  // TEST 19: Répétition de la même requête -> résultat identique (idempotence pure)
  runTest("TEST 19 — Répétition de la même requête -> résultat identique (idempotence)", () => {
    const reg = new ComponentCandidateRegistry();
    reg.register({
      candidateId: "SYNTHETIC_CAND_IDEM",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const orch = new ComponentResolutionEngine(new ComponentCandidateResolver(reg, candSelEngine));
    const req: ComponentResolutionRequest = {
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    };

    const first = orch.resolve(req);
    const second = orch.resolve(req);

    assert(first.status === second.status, "Status must match");
    assert(first.resolvedCandidateId === second.resolvedCandidateId, "resolvedCandidateId must match");
    assert(first.status === "RESOLVED", "Status must be RESOLVED");
  });

  // TEST 20: Aucune conversion implicite (NPS '2' vs 'DN 50' ne devient jamais RESOLVED)
  runTest("TEST 20 — Aucune conversion implicite (NPS '2' vs 'DN 50' ne devient jamais RESOLVED)", () => {
    const reg = new ComponentCandidateRegistry();
    reg.register({
      candidateId: "SYNTHETIC_CAND_DN",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "DN 50",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const orch = new ComponentResolutionEngine(new ComponentCandidateResolver(reg, candSelEngine));
    const req: ComponentResolutionRequest = {
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext, // context nominalSize: "2"
    };

    const res = orch.resolve(req);
    assert(res.status !== "RESOLVED", "Must NEVER resolve unmapped string differences");
  });

  // TEST 21: Constructeur rejette resolver null ou non conforme
  runTest("TEST 21 — Constructeur ComponentResolutionEngine rejette un resolver non conforme", () => {
    let failed = false;
    try {
      new ComponentResolutionEngine(null as any);
    } catch {
      failed = true;
    }
    assert(failed, "Must throw on null resolver");
  });

  // TEST 22: COMPONENT-05 — Traçabilité de bout en bout strictement typée (matchedRuleIds, compatibilityRuleIds, evidenceIds)
  runTest("TEST 22 (COMPONENT-05) — Traçabilité de bout en bout strictement typée", () => {
    const reg = new ComponentCandidateRegistry();
    reg.register({
      candidateId: "SYNTHETIC_CAND_TRACE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const orch = new ComponentResolutionEngine(new ComponentCandidateResolver(reg, candSelEngine));
    const req: ComponentResolutionRequest = {
      specificationId: "SYNTHETIC_SPEC_01",
      context: defaultContext,
    };

    const res = orch.resolve(req);
    assert(res.status === "RESOLVED", "Status must be RESOLVED");
    assert(res.resolvedCandidateId === "SYNTHETIC_CAND_TRACE", "Candidate must match");
    assert(Array.isArray(res.matchedRuleIds), "matchedRuleIds must be an array");
    assert(res.matchedRuleIds.length > 0, "matchedRuleIds must not be empty");
    assert(res.matchedRuleIds.includes("SYNTHETIC_SPEC_PIPE_RULE_01"), "matchedRuleIds must contain spec rule");
    assert(Array.isArray(res.compatibilityRuleIds), "compatibilityRuleIds must be an array");
    assert(res.compatibilityRuleIds.length > 0, "compatibilityRuleIds must not be empty");
    assert(res.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_SCH40"), "compatibilityRuleIds must contain compat rule");
    assert(Array.isArray(res.evidenceIds), "evidenceIds must be an array");
    assert(res.evidenceIds.length > 0, "evidenceIds must not be empty");
    assert(res.evidenceIds.includes("SYNTHETIC_EV_SPEC_01"), "evidenceIds must contain spec evidence");
  });

  // =========================================================================
  // TESTS COMPONENT-05-FIX-01 (TESTS 23 à 30)
  // =========================================================================

  class InstrumentedSelectionEngine implements IComponentSelectionEngine {
    public lastContextReceived?: ComponentSelectionContext;
    public customResponses = new Map<string, ComponentSelectionResult>();

    public select(
      candidate: ComponentCandidate,
      context: ComponentSelectionContext
    ): ComponentSelectionResult {
      this.lastContextReceived = context;
      const custom = this.customResponses.get(candidate.candidateId);
      if (custom) {
        return custom;
      }
      return {
        status: "ELIGIBLE",
        candidateId: candidate.candidateId,
        specificationId: context.specificationId,
        matchedRuleIds: [`SYNTHETIC_RULE_${candidate.candidateId}`],
        compatibilityRuleIds: [`SYNTHETIC_COMPAT_${candidate.candidateId}`],
        evidenceIds: [`SYNTHETIC_EV_${candidate.candidateId}`],
        message: "Default mock eligible",
      };
    }
  }

  // TEST 23 (FIX-01 TEST 01) — RESOLVED trace
  runTest("TEST 23 (FIX-01 TEST 01) — RESOLVED trace complet et typé", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const cand: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
    };
    mock.customResponses.set(cand.candidateId, {
      status: "ELIGIBLE",
      candidateId: cand.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_A"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_A"],
      evidenceIds: ["SYNTHETIC_EV_A"],
      message: "Eligible candidate",
    });

    const res = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand],
      context: defaultContext,
    });

    assert(res.status === "SELECTED", "status must be SELECTED");
    assert(res.selectedCandidateId === "SYNTHETIC_CAND_01", "selectedCandidateId mismatch");
    assert(res.matchedRuleIds.length > 0, "matchedRuleIds must not be empty");
    assert(res.compatibilityRuleIds.length > 0, "compatibilityRuleIds must not be empty");
    assert(res.evidenceIds.length > 0, "evidenceIds must not be empty");
  });

  // TEST 24 (FIX-01 TEST 02) — UNVERIFIED trace preservation
  runTest("TEST 24 (FIX-01 TEST 02) — UNVERIFIED trace preservation", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const cand: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_UNVERIF",
      componentType: "PIPE",
    };
    mock.customResponses.set(cand.candidateId, {
      status: "UNVERIFIED",
      candidateId: cand.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_U"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_U"],
      evidenceIds: ["SYNTHETIC_EV_U"],
      message: "Unverified candidate",
    });

    const res = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand],
      context: defaultContext,
    });

    assert(res.status === "UNVERIFIED_CANDIDATES", "status must be UNVERIFIED_CANDIDATES");
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
    assert(res.matchedRuleIds.includes("SYNTHETIC_RULE_U"), "matchedRuleIds must be preserved");
    assert(res.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_U"), "compatibilityRuleIds must be preserved");
    assert(res.evidenceIds.includes("SYNTHETIC_EV_U"), "evidenceIds must be preserved");
  });

  // TEST 25 (FIX-01 TEST 03) — AMBIGUOUS trace preservation
  runTest("TEST 25 (FIX-01 TEST 03) — AMBIGUOUS trace preservation", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const candA: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_A", componentType: "PIPE" };
    const candB: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_B", componentType: "PIPE" };

    mock.customResponses.set(candA.candidateId, {
      status: "ELIGIBLE",
      candidateId: candA.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_A"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_A"],
      evidenceIds: ["SYNTHETIC_EV_A"],
      message: "Eligible A",
    });
    mock.customResponses.set(candB.candidateId, {
      status: "ELIGIBLE",
      candidateId: candB.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_B"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_B"],
      evidenceIds: ["SYNTHETIC_EV_B"],
      message: "Eligible B",
    });

    const res = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candA, candB],
      context: defaultContext,
    });

    assert(res.status === "INVALID", "status must be INVALID for multiple eligible");
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
    assert(res.message.includes("MULTIPLE_ELIGIBLE_CANDIDATES"), "message must mention multiple eligible");
    assert(res.matchedRuleIds.length === 2, "matchedRuleIds must preserve both rules");
    assert(res.compatibilityRuleIds.length === 2, "compatibilityRuleIds must preserve both rules");
    assert(res.evidenceIds.length === 2, "evidenceIds must preserve both evidences");
  });

  // TEST 26 (FIX-01 TEST 04) — Union des traces sans doublons
  runTest("TEST 26 (FIX-01 TEST 04) — Union déterministe des traces sans doublons", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const candA: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_A", componentType: "PIPE" };
    const candB: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_B", componentType: "PIPE" };

    mock.customResponses.set(candA.candidateId, {
      status: "ELIGIBLE",
      candidateId: candA.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_SHARED", "SYNTHETIC_RULE_A"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_SHARED", "SYNTHETIC_COMPAT_A"],
      evidenceIds: ["SYNTHETIC_EV_SHARED", "SYNTHETIC_EV_A"],
      message: "Eligible A",
    });
    mock.customResponses.set(candB.candidateId, {
      status: "ELIGIBLE",
      candidateId: candB.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_B", "SYNTHETIC_RULE_SHARED"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_B", "SYNTHETIC_COMPAT_SHARED"],
      evidenceIds: ["SYNTHETIC_EV_B", "SYNTHETIC_EV_SHARED"],
      message: "Eligible B",
    });

    const res = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candA, candB],
      context: defaultContext,
    });

    assert(res.matchedRuleIds.length === 3, "matchedRuleIds must contain union of 3 unique items");
    assert(res.compatibilityRuleIds.length === 3, "compatibilityRuleIds must contain union of 3 unique items");
    assert(res.evidenceIds.length === 3, "evidenceIds must contain union of 3 unique items");
    assert(res.matchedRuleIds[0] === "SYNTHETIC_RULE_A", "matchedRuleIds must be sorted");
    assert(res.matchedRuleIds[1] === "SYNTHETIC_RULE_B", "matchedRuleIds must be sorted");
    assert(res.matchedRuleIds[2] === "SYNTHETIC_RULE_SHARED", "matchedRuleIds must be sorted");
  });

  // TEST 27 (FIX-01 TEST 05) — Déterminisme
  runTest("TEST 27 (FIX-01 TEST 05) — Déterminisme indépendant de l'ordre d'entrée", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const candA: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_A", componentType: "PIPE" };
    const candB: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_B", componentType: "PIPE" };

    mock.customResponses.set(candA.candidateId, {
      status: "INELIGIBLE",
      candidateId: candA.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_A"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_A"],
      evidenceIds: ["SYNTHETIC_EV_A"],
      message: "Ineligible A",
    });
    mock.customResponses.set(candB.candidateId, {
      status: "INELIGIBLE",
      candidateId: candB.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: ["SYNTHETIC_RULE_B"],
      compatibilityRuleIds: ["SYNTHETIC_COMPAT_B"],
      evidenceIds: ["SYNTHETIC_EV_B"],
      message: "Ineligible B",
    });

    const res1 = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candA, candB],
      context: defaultContext,
    });
    const res2 = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candB, candA],
      context: defaultContext,
    });

    assert(JSON.stringify(res1.matchedRuleIds) === JSON.stringify(res2.matchedRuleIds), "matchedRuleIds must be identical");
    assert(JSON.stringify(res1.compatibilityRuleIds) === JSON.stringify(res2.compatibilityRuleIds), "compatibilityRuleIds must be identical");
    assert(JSON.stringify(res1.evidenceIds) === JSON.stringify(res2.evidenceIds), "evidenceIds must be identical");
  });

  // TEST 28 (FIX-01 TEST 06) — Aucun changement de contexte transmis à COMPONENT-01
  runTest("TEST 28 (FIX-01 TEST 06) — Contexte original transmis intact à COMPONENT-01", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const candWithDiffSchedule: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_DIFF_SCH",
      componentType: "PIPE",
      schedule: "SYNTHETIC_CANDIDATE_SCHEDULE",
    };
    const contextWithOriginalSchedule: ComponentSelectionContext = {
      ...defaultContext,
      schedule: "SYNTHETIC_CONTEXT_SCHEDULE",
    };

    candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candWithDiffSchedule],
      context: contextWithOriginalSchedule,
    });

    assert(
      mock.lastContextReceived?.schedule === "SYNTHETIC_CONTEXT_SCHEDULE",
      "Context schedule passed to COMPONENT-01 must match input.context schedule exactly"
    );
    assert(
      mock.lastContextReceived?.schedule !== "SYNTHETIC_CANDIDATE_SCHEDULE",
      "Candidate schedule must NEVER overwrite context schedule"
    );
  });

  // TEST 29 (FIX-01 TEST 07) — Aucun ranking arbitraire
  runTest("TEST 29 (FIX-01 TEST 07) — Aucun ranking arbitraire si multiples éligibles", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const cand1: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_1", componentType: "PIPE" };
    const cand2: ComponentCandidate = { candidateId: "SYNTHETIC_CAND_2", componentType: "PIPE" };

    const res = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand1, cand2],
      context: defaultContext,
    });

    assert(res.status === "INVALID", "Must be INVALID");
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined (no ranking)");
  });

  // TEST 30 (FIX-01 TEST 08) — Aucun fallback evidence
  runTest("TEST 30 (FIX-01 TEST 08) — Aucun fallback evidence artificiel", () => {
    const mock = new InstrumentedSelectionEngine();
    const candEngine = new ComponentCandidateSelectionEngine(mock);
    const candWithEvidence: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_NO_FALLBACK",
      componentType: "PIPE",
      evidenceIds: ["SYNTHETIC_FALLBACK_EV_ID"],
    };

    mock.customResponses.set(candWithEvidence.candidateId, {
      status: "INELIGIBLE",
      candidateId: candWithEvidence.candidateId,
      specificationId: "SYNTHETIC_SPEC_01",
      matchedRuleIds: [],
      compatibilityRuleIds: [],
      evidenceIds: [],
      message: "No evaluated rules",
    });

    const res = candEngine.selectCandidate({
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candWithEvidence],
      context: defaultContext,
    });

    assert(res.evidenceIds.length === 0, "evidenceIds must remain empty and not fallback to candidate.evidenceIds");
    assert(!res.evidenceIds.includes("SYNTHETIC_FALLBACK_EV_ID"), "Must not promote candidate evidence");
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
