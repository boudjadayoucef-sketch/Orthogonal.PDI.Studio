/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE REGISTRY & RESOLVER TESTS
 * Reference: COMPONENT-03 (Component Candidate Registry & Resolver)
 * 
 * Suite de tests unitaires et d'intégration validant le registre en mémoire
 * et le résolveur de candidats composants.
 * Couvre l'ensemble des exigences (24+ tests, non-contamination, déterminisme, non-conversion).
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
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { ComponentCandidate, ComponentSelectionContext } from "../types/componentSelectionTypes";

export interface Component03TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[COMPONENT-03 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Exécute l'ensemble des tests COMPONENT-03.
 */
export function runComponentCandidateRegistryTests(): Component03TestResult {
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

  // Initialisation de l'infrastructure normative synthétique
  const evRegistry = new NormativeEvidenceRegistry();

  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_SPEC_RULE_01",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_PIPE_SPEC",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_SPEC_RULE_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_COMPAT_RULE_01",
    standardId: "SYNTHETIC_STD_COMPAT" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_COMPAT",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_COMPAT_RULE_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_CANDIDATE_VERIFIED",
    standardId: "SYNTHETIC_STD_CAND" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_CAND",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_CAND_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_UNVERIFIED_01",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_UNVERIFIED",
    sourceType: "LEGACY_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_UNVERIFIED",
    verificationStatus: "UNVERIFIED",
  });

  const evResolver = new NormativeEvidenceResolver(evRegistry);
  const compatRegistry = new NormativeCompatibilityRegistry();

  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_SCH40",
    description: "Synthetic pipe compatibility SCH 40",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
  });

  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_SCH40_ALT",
    description: "Synthetic pipe compatibility SCH 40 Alt",
    standardId: "SYNTHETIC_STD_PIPE_ALT" as any,
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
  });

  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_SCH80_INCOMPATIBLE",
    description: "Synthetic pipe compatibility SCH 80 Incompatible",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 80",
    materialId: "SYNTHETIC_MAT_A",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evResolver);

  const syntheticPipingSpecs: PipingSpecification[] = [
    {
      id: "SYNTHETIC_SPEC_01",
      code: "SYN-SPEC-01",
      name: "Synthetic Piping Spec 01",
      designCodeId: "ASME-B31.3",
      materialReferenceIds: ["SYNTHETIC_MAT_A", "SYNTHETIC_MAT_B"],
      pipeRules: [
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_SCH40",
          pipeDimensionalStandardId: "SYNTHETIC_STD_PIPE",
          nominalSizes: ["2", "3"],
          schedule: "SCH 40",
          materialId: "SYNTHETIC_MAT_A",
          sourceStatus: "VERIFIED",
          evidenceIds: ["SYNTHETIC_EV_SPEC_RULE_01"],
        },
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_SCH40_ALT",
          pipeDimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
          nominalSizes: ["2", "3"],
          schedule: "SCH 40",
          materialId: "SYNTHETIC_MAT_A",
          sourceStatus: "VERIFIED",
          evidenceIds: ["SYNTHETIC_EV_SPEC_RULE_01"],
        },
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_NO_EV",
          pipeDimensionalStandardId: "SYNTHETIC_STD_NO_EV",
          nominalSizes: ["4"],
          schedule: "SCH 160",
          materialId: "SYNTHETIC_MAT_B",
          sourceStatus: "VERIFIED",
          evidenceIds: [],
        },
      ],
      fittingRules: [],
      flangeRules: [],
      valveRules: [],
      sourceStatus: "VERIFIED",
      evidenceIds: ["SYNTHETIC_EV_SPEC_RULE_01"],
    },
  ];

  const pipingSpecResolver = new PipingSpecResolver(syntheticPipingSpecs, compatEngine, evResolver);
  const selectionEngine = new ComponentSelectionEngine(pipingSpecResolver, evResolver);
  const candidateSelectionEngine = new ComponentCandidateSelectionEngine(selectionEngine);

  const defaultContext: ComponentSelectionContext = {
    specificationId: "SYNTHETIC_SPEC_01",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    dimensionalStandardId: "SYNTHETIC_STD_PIPE",
  };

  // =========================================================================
  // TESTS REGISTRY (1 à 14)
  // =========================================================================

  // TEST 01: Registre vide au démarrage
  runTest("TEST 01 — Registre vide au démarrage (count === 0, list vide)", () => {
    const registry = new ComponentCandidateRegistry();
    assert(registry.count() === 0, "Initial count must be 0");
    assert(registry.list().length === 0, "Initial list must be empty");
  });

  // TEST 02: Register d'un candidat synthétique valide
  runTest("TEST 02 — Register d'un candidat synthétique valide", () => {
    const registry = new ComponentCandidateRegistry();
    const cand: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    registry.register(cand);
    assert(registry.count() === 1, "Count must be 1 after registration");
    assert(registry.has("SYNTHETIC_CAND_01"), "has() must return true for registered candidate");
  });

  // TEST 03: get par candidateId
  runTest("TEST 03 — get par candidateId", () => {
    const registry = new ComponentCandidateRegistry();
    const cand: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
      nominalSize: "2",
    };
    registry.register(cand);
    const retrieved = registry.get("SYNTHETIC_CAND_01");
    assert(retrieved !== undefined, "Retrieved candidate must not be undefined");
    assert(retrieved?.candidateId === "SYNTHETIC_CAND_01", "Retrieved candidateId mismatch");
  });

  // TEST 04: has par candidateId
  runTest("TEST 04 — has par candidateId (vrai si présent, faux sinon)", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
      nominalSize: "2",
    });
    assert(registry.has("SYNTHETIC_CAND_01") === true, "has() must return true for existing ID");
    assert(registry.has("SYNTHETIC_CAND_UNKNOWN") === false, "has() must return false for unknown ID");
  });

  // TEST 05: unknown ID -> undefined
  runTest("TEST 05 — unknown ID -> undefined", () => {
    const registry = new ComponentCandidateRegistry();
    assert(registry.get("SYNTHETIC_UNKNOWN") === undefined, "get() unknown must return undefined");
  });

  // TEST 06: duplicate candidateId rejeté
  runTest("TEST 06 — duplicate candidateId rejeté avec DUPLICATE_CANDIDATE_ID", () => {
    const registry = new ComponentCandidateRegistry();
    const cand: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_DUP",
      componentType: "PIPE",
      nominalSize: "2",
    };
    registry.register(cand);

    let failed = false;
    try {
      registry.register(cand);
    } catch (err: any) {
      failed = true;
      assert(
        err.message.includes("DUPLICATE_CANDIDATE_ID"),
        `Error must contain DUPLICATE_CANDIDATE_ID, got: ${err.message}`
      );
    }
    assert(failed, "Registering duplicate candidateId must throw an error");
    assert(registry.count() === 1, "Count must remain 1 after duplicate rejection");
  });

  // TEST 07: invalid candidate rejeté
  runTest("TEST 07 — invalid candidate rejeté (componentType invalide)", () => {
    const registry = new ComponentCandidateRegistry();
    let failed = false;
    try {
      registry.register({
        candidateId: "SYNTHETIC_CAND_BAD_TYPE",
        componentType: "UNKNOWN_TYPE" as any,
      });
    } catch (err: any) {
      failed = true;
      assert(err.message.includes("INVALID_CANDIDATE"), "Error must contain INVALID_CANDIDATE");
    }
    assert(failed, "Invalid candidate must throw");
  });

  // TEST 08: null rejeté
  runTest("TEST 08 — null rejeté", () => {
    const registry = new ComponentCandidateRegistry();
    let failed = false;
    try {
      registry.register(null as any);
    } catch (err: any) {
      failed = true;
    }
    assert(failed, "Registering null must throw");
  });

  // TEST 09: primitive rejetée
  runTest("TEST 09 — primitive rejetée", () => {
    const registry = new ComponentCandidateRegistry();
    let failed = false;
    try {
      registry.register("NOT_A_CANDIDATE" as any);
    } catch (err: any) {
      failed = true;
    }
    assert(failed, "Registering primitive string must throw");
  });

  // TEST 10: array rejeté
  runTest("TEST 10 — array rejeté", () => {
    const registry = new ComponentCandidateRegistry();
    let failed = false;
    try {
      registry.register([] as any);
    } catch (err: any) {
      failed = true;
    }
    assert(failed, "Registering array must throw");
  });

  // TEST 11: list() déterministe
  runTest("TEST 11 — list() déterministe (triée par candidateId)", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({ candidateId: "SYNTHETIC_CAND_Z", componentType: "PIPE" });
    registry.register({ candidateId: "SYNTHETIC_CAND_A", componentType: "PIPE" });
    registry.register({ candidateId: "SYNTHETIC_CAND_M", componentType: "PIPE" });

    const list = registry.list();
    assert(list.length === 3, "List length must be 3");
    assert(list[0].candidateId === "SYNTHETIC_CAND_A", "First must be A");
    assert(list[1].candidateId === "SYNTHETIC_CAND_M", "Second must be M");
    assert(list[2].candidateId === "SYNTHETIC_CAND_Z", "Third must be Z");
  });

  // TEST 12: list() non mutable de l'extérieur
  runTest("TEST 12 — list() non mutable de l'extérieur", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({ candidateId: "SYNTHETIC_CAND_01", componentType: "PIPE" });
    const list = registry.list() as any;

    let mutationFailed = false;
    try {
      list.push({ candidateId: "MUTATED_CAND", componentType: "PIPE" });
    } catch {
      mutationFailed = true;
    }
    // Soit le push lève une exception (frozen), soit il n'altère pas le registre interne
    assert(
      mutationFailed || registry.count() === 1,
      "External mutation must not alter internal registry"
    );
    assert(registry.count() === 1, "Count must remain 1");
    assert(!registry.has("MUTATED_CAND"), "Mutated candidate must not exist in registry");
  });

  // TEST 13: clear()
  runTest("TEST 13 — clear() vide les éléments", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({ candidateId: "SYNTHETIC_CAND_01", componentType: "PIPE" });
    registry.register({ candidateId: "SYNTHETIC_CAND_02", componentType: "PIPE" });
    assert(registry.count() === 2, "Count before clear must be 2");
    registry.clear();
    assert(registry.count() === 0, "Count after clear must be 0");
  });

  // TEST 14: clear() puis count = 0 et has = false
  runTest("TEST 14 — clear() puis count = 0 et has(...) = false", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({ candidateId: "SYNTHETIC_CAND_01", componentType: "PIPE" });
    registry.clear();
    assert(registry.count() === 0, "Count must be 0");
    assert(registry.has("SYNTHETIC_CAND_01") === false, "has() must return false after clear");
  });

  // =========================================================================
  // TESTS RESOLVER (15 à 24)
  // =========================================================================

  // TEST 15: resolve ID existant
  runTest("TEST 15 — resolve ID existant", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
      nominalSize: "2",
    });
    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const resolved = resolver.resolve("SYNTHETIC_CAND_01");
    assert(resolved !== undefined, "resolve() must return candidate");
    assert(resolved?.candidateId === "SYNTHETIC_CAND_01", "candidateId mismatch");
  });

  // TEST 16: resolve ID inexistant
  runTest("TEST 16 — resolve ID inexistant -> undefined", () => {
    const registry = new ComponentCandidateRegistry();
    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const resolved = resolver.resolve("SYNTHETIC_NON_EXISTENT");
    assert(resolved === undefined, "resolve() unknown ID must return undefined");
  });

  // TEST 17: resolveBySpecification avec un candidat ELIGIBLE
  runTest("TEST 17 — resolveBySpecification avec un candidat ELIGIBLE -> RESOLVED", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_ELIGIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(res.status === "RESOLVED", `Expected RESOLVED, got '${res.status}' (${res.message})`);
    assert(res.selectedCandidateId === "SYNTHETIC_CAND_ELIGIBLE", "selectedCandidateId mismatch");
    assert(res.candidateIds.length === 1, "candidateIds length mismatch");
    assert(res.candidates?.length === 1, "candidates array length mismatch");
    assert(res.candidates?.[0].candidateId === "SYNTHETIC_CAND_ELIGIBLE", "candidate mismatch");
    assert(Array.isArray(res.matchedRuleIds), "matchedRuleIds must be an array");
    assert(res.matchedRuleIds.length > 0, "matchedRuleIds must be populated");
    assert(Array.isArray(res.compatibilityRuleIds), "compatibilityRuleIds must be an array");
    assert(res.compatibilityRuleIds.length > 0, "compatibilityRuleIds must be populated");
    assert(Array.isArray(res.evidenceIds), "evidenceIds must be an array");
    assert(res.evidenceIds.length > 0, "evidenceIds must be populated");
  });

  // TEST 18: resolveBySpecification avec candidat INELIGIBLE
  runTest("TEST 18 — resolveBySpecification avec candidat INELIGIBLE -> NO_CANDIDATE", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_INELIGIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_A",
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(res.status === "NO_CANDIDATE", `Expected NO_CANDIDATE, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
    assert(res.candidateIds.length === 0, "candidateIds must be empty");
  });

  // TEST 19: resolveBySpecification avec candidat UNVERIFIED
  runTest("TEST 19 — resolveBySpecification avec candidat UNVERIFIED -> UNVERIFIED", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_UNVERIFIED",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    });

    const contextNoEv: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    };

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", contextNoEv);

    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 20: aucun candidat dans le registre
  runTest("TEST 20 — aucun candidat -> NO_CANDIDATE", () => {
    const registry = new ComponentCandidateRegistry();
    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(res.status === "NO_CANDIDATE", `Expected NO_CANDIDATE, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 21: plusieurs candidats ELIGIBLE -> AMBIGUOUS
  runTest("TEST 21 — plusieurs candidats ELIGIBLE -> AMBIGUOUS", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_ELIG_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });
    registry.register({
      candidateId: "SYNTHETIC_CAND_ELIG_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const contextAnyStd: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", contextAnyStd);

    assert(res.status === "AMBIGUOUS", `Expected AMBIGUOUS, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined for AMBIGUOUS");
    assert(res.candidateIds.length === 2, "candidateIds must list the ambiguous candidates");
    assert(Array.isArray(res.matchedRuleIds), "matchedRuleIds must be an array");
    assert(res.matchedRuleIds.length > 0, "matchedRuleIds must be preserved for AMBIGUOUS");
    assert(Array.isArray(res.compatibilityRuleIds), "compatibilityRuleIds must be an array");
    assert(res.compatibilityRuleIds.length > 0, "compatibilityRuleIds must be preserved for AMBIGUOUS");
    assert(Array.isArray(res.evidenceIds), "evidenceIds must be an array");
    assert(res.evidenceIds.length > 0, "evidenceIds must be preserved for AMBIGUOUS");
  });

  // TEST 22: ordre inverse des candidats -> même résultat (déterminisme)
  runTest("TEST 22 — ordre inverse des candidats -> même résultat AMBIGUOUS", () => {
    const reg1 = new ComponentCandidateRegistry();
    reg1.register({
      candidateId: "SYNTHETIC_CAND_ELIG_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });
    reg1.register({
      candidateId: "SYNTHETIC_CAND_ELIG_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const reg2 = new ComponentCandidateRegistry();
    reg2.register({
      candidateId: "SYNTHETIC_CAND_ELIG_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });
    reg2.register({
      candidateId: "SYNTHETIC_CAND_ELIG_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const contextAnyStd: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res1 = new ComponentCandidateResolver(reg1, candidateSelectionEngine).resolveBySpecification(
      "SYNTHETIC_SPEC_01",
      contextAnyStd
    );
    const res2 = new ComponentCandidateResolver(reg2, candidateSelectionEngine).resolveBySpecification(
      "SYNTHETIC_SPEC_01",
      contextAnyStd
    );

    assert(res1.status === res2.status, "Status must match regardless of registration order");
    assert(res1.status === "AMBIGUOUS", "Both must be AMBIGUOUS");
  });

  // TEST 23: aucune création automatique de candidat
  runTest("TEST 23 — aucune création automatique de candidat", () => {
    const registry = new ComponentCandidateRegistry();
    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const resolved = resolver.resolve("SYNTHETIC_NON_EXISTENT_ID");
    assert(resolved === undefined, "Must return undefined without creating candidate");
    assert(registry.count() === 0, "Registry must remain strictly empty");
  });

  // TEST 24: aucune conversion NPS/DN ou Class/PN
  runTest("TEST 24 — aucune conversion NPS/DN ou Class/PN (nominalSize 'DN 50' vs '2')", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_DN50",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "DN 50",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(res.status !== "RESOLVED", "Must NEVER return RESOLVED for unconverted string differences");
  });

  // =========================================================================
  // TESTS DE NON-CONTAMINATION & DE COHÉRENCE (25 à 28)
  // =========================================================================

  // TEST 25: Test A — Une evidence de candidat VERIFIED ne transforme pas une règle SPEC sans evidence en règle vérifiée
  runTest("TEST 25 (Test A) — Evidence de candidat VERIFIED ne promeut pas une règle SPEC sans evidence", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_VERIFIED_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    });

    const contextNoEv: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    };

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", contextNoEv);

    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}'`);
    assert(res.status !== "RESOLVED", "Must NEVER promote unverified spec rule to RESOLVED");
  });

  // TEST 26: Test B — Un candidat UNVERIFIED ne peut jamais être renvoyé comme RESOLVED
  runTest("TEST 26 (Test B) — Un candidat UNVERIFIED ne peut jamais être renvoyé comme RESOLVED", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_UNVERIFIED_EVID",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      evidenceIds: ["SYNTHETIC_EV_UNVERIFIED_01"],
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(res.status !== "RESOLVED", "UNVERIFIED candidate must NEVER be returned as RESOLVED");
    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}'`);
  });

  // TEST 27: Contexte incohérent (specificationId mismatch) -> INVALID
  runTest("TEST 27 — Contexte incohérent (specificationId mismatch) -> INVALID", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
      nominalSize: "2",
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const mismatchContext: ComponentSelectionContext = {
      ...defaultContext,
      specificationId: "OTHER_SPEC",
    };

    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", mismatchContext);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("specificationId mismatch"), "Message must explain mismatch");
  });

  // TEST 28: Filtrage par componentType : seuls les candidats du type demandé sont évalués
  runTest("TEST 28 — Filtrage par componentType : candidats d'un autre type ignorés", () => {
    const registry = new ComponentCandidateRegistry();
    // Un candidat VALVE alors que le contexte demande PIPE
    registry.register({
      candidateId: "SYNTHETIC_CAND_VALVE",
      componentType: "VALVE",
      nominalSize: "2",
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(res.status === "NO_CANDIDATE", `Expected NO_CANDIDATE, got '${res.status}'`);
    assert(res.evaluatedCandidateIds.length === 0, "Non-matching candidate types must not be evaluated");
  });

  // TEST 29 (FIX-01): Conservation de la trace pour les candidats évalués en cas de MULTIPLE_ELIGIBLE_CANDIDATES
  runTest("TEST 29 (FIX-01) — Union des traces conservée dans ComponentCandidateResolver en cas d'ambiguïté", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_AMBIG_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });
    registry.register({
      candidateId: "SYNTHETIC_CAND_AMBIG_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const contextAnyStd: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", contextAnyStd);

    assert(res.status === "AMBIGUOUS", "Expected AMBIGUOUS");
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
    assert(res.matchedRuleIds.length >= 2, "matchedRuleIds must contain union of rules from both candidates");
    assert(res.compatibilityRuleIds.length >= 2, "compatibilityRuleIds must contain union of compat rules");
    assert(res.evidenceIds.length >= 2, "evidenceIds must contain union of evidence");
  });

  // TEST 30 (FIX-01): Déterminisme strict de l'union des traces
  runTest("TEST 30 (FIX-01) — Déterminisme strict des collections de traces dédupliquées", () => {
    const registry = new ComponentCandidateRegistry();
    registry.register({
      candidateId: "SYNTHETIC_CAND_DET_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    });

    const resolver = new ComponentCandidateResolver(registry, candidateSelectionEngine);
    const res1 = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);
    const res2 = resolver.resolveBySpecification("SYNTHETIC_SPEC_01", defaultContext);

    assert(JSON.stringify(res1.matchedRuleIds) === JSON.stringify(res2.matchedRuleIds), "matchedRuleIds must be identical");
    assert(JSON.stringify(res1.compatibilityRuleIds) === JSON.stringify(res2.compatibilityRuleIds), "compatibilityRuleIds must be identical");
    assert(JSON.stringify(res1.evidenceIds) === JSON.stringify(res2.evidenceIds), "evidenceIds must be identical");
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
