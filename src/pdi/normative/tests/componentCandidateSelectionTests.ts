/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE SELECTION TESTS
 * Reference: COMPONENT-02 (Deterministic Component Candidate Selection)
 * 
 * Suite de tests unitaires et d'intégration déterministes validant COMPONENT-02.
 * Couvre l'ensemble des 20 exigences de sélection, non-ranking, détection de conflits et traçabilité.
 */

import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { PipingSpecResolver } from "../engine/pipingSpecResolver";
import { ComponentSelectionEngine } from "../engine/componentSelectionEngine";
import { ComponentCandidateSelectionEngine } from "../engine/componentCandidateSelectionEngine";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { ComponentCandidate, ComponentSelectionContext } from "../types/componentSelectionTypes";
import type { ComponentCandidateSelectionInput } from "../types/componentCandidateSelectionTypes";

export interface Component02TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[COMPONENT-02 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Exécute les tests unitaires et d'intégration COMPONENT-02.
 */
export function runComponentCandidateSelectionTests(): Component02TestResult {
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

  // Initialisation des enregistrements synthétiques pour COMPONENT-02
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

  // Règle de compatibilité pour SCH 40
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

  // Règle de compatibilité alternative pour SCH 40 (permet un 2e candidat eligible)
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

  // Règle de compatibilité explicitement INCOMPATIBLE pour SCH 80
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

  // Règle sans preuves
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_NO_EV",
    description: "Synthetic pipe compatibility no evidence",
    standardId: "SYNTHETIC_STD_NO_EV" as any,
    componentType: "PIPE",
    nominalSize: "4",
    schedule: "SCH 160",
    materialId: "SYNTHETIC_MAT_B",
    status: "COMPATIBLE",
    evidenceIds: [],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evResolver);

  const syntheticPipingSpecs: PipingSpecification[] = [
    {
      id: "SYNTHETIC_SPEC_01",
      code: "SYN-SPEC-01",
      name: "Synthetic Piping Spec 01",
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
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_SCH80",
          pipeDimensionalStandardId: "SYNTHETIC_STD_PIPE",
          nominalSizes: ["2"],
          schedule: "SCH 80",
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

  // TEST 01: Un seul candidat ELIGIBLE -> SELECTED
  runTest("TEST 01 — Un seul candidat ELIGIBLE -> status SELECTED & selectedCandidateId défini", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candidate],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "SELECTED", `Expected SELECTED, got '${res.status}' (${res.message})`);
    assert(res.selectedCandidateId === "SYNTHETIC_CAND_01", `Expected SYNTHETIC_CAND_01, got '${res.selectedCandidateId}'`);
    assert(res.eligibleCandidateIds.length === 1, "eligibleCandidateIds length mismatch");
  });

  // TEST 02: Deux candidats (A = ELIGIBLE, B = INELIGIBLE) -> SELECTED A
  runTest("TEST 02 — Deux candidats (A = ELIGIBLE, B = INELIGIBLE) -> SELECTED A", () => {
    const candA: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_A_ELIGIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const candB: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_B_INELIGIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_A",
    };

    const contextFlexible: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      materialId: "SYNTHETIC_MAT_A",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candA, candB],
      context: contextFlexible,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "SELECTED", `Expected SELECTED, got '${res.status}' (${res.message})`);
    assert(res.selectedCandidateId === "SYNTHETIC_CAND_A_ELIGIBLE", "selectedCandidateId mismatch");
    assert(res.ineligibleCandidateIds.includes("SYNTHETIC_CAND_B_INELIGIBLE"), "ineligibleCandidateIds missing candB");
  });

  // TEST 03: Aucun ELIGIBLE, un candidat UNVERIFIED -> UNVERIFIED_CANDIDATES
  runTest("TEST 03 — Aucun ELIGIBLE, un candidat UNVERIFIED -> UNVERIFIED_CANDIDATES", () => {
    const candUnverified: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_UNVERIFIED",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    };

    const contextNoEv: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candUnverified],
      context: contextNoEv,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "UNVERIFIED_CANDIDATES", `Expected UNVERIFIED_CANDIDATES, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 04: Tous les candidats INELIGIBLE -> NO_ELIGIBLE_CANDIDATE
  runTest("TEST 04 — Tous les candidats INELIGIBLE -> NO_ELIGIBLE_CANDIDATE", () => {
    const candIneligible: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_INELIGIBLE_ONLY",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_A",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candIneligible],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "NO_ELIGIBLE_CANDIDATE", `Expected NO_ELIGIBLE_CANDIDATE, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 05: Tous les candidats INVALID -> NO_ELIGIBLE_CANDIDATE avec trace des invalides
  runTest("TEST 05 — Tous les candidats INVALID -> NO_ELIGIBLE_CANDIDATE avec trace des invalides", () => {
    const candInvalid: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_INVALID",
      componentType: "PIPE",
      nominalSize: "999_MISMATCH",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candInvalid],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "NO_ELIGIBLE_CANDIDATE", `Expected NO_ELIGIBLE_CANDIDATE, got '${res.status}'`);
    assert(res.invalidCandidateIds.includes("SYNTHETIC_CAND_INVALID"), "invalidCandidateIds missing candidate");
    assert(res.traceByCandidate.length === 1, "traceByCandidate missing trace");
  });

  // TEST 06: Deux candidats ELIGIBLE -> INVALID avec MULTIPLE_ELIGIBLE_CANDIDATES
  runTest("TEST 06 — Deux candidats ELIGIBLE -> INVALID avec MULTIPLE_ELIGIBLE_CANDIDATES", () => {
    const cand1: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ELIGIBLE_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const cand2: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ELIGIBLE_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const contextAnyStd: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand1, cand2],
      context: contextAnyStd,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("MULTIPLE_ELIGIBLE_CANDIDATES"), "Message missing MULTIPLE_ELIGIBLE_CANDIDATES");
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 07: Deux candidats ELIGIBLE avec ordre inversé -> Résultat identique INVALID / MULTIPLE_ELIGIBLE_CANDIDATES
  runTest("TEST 07 — Deux candidats ELIGIBLE avec ordre inversé -> Résultat identique INVALID", () => {
    const cand1: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ELIGIBLE_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const cand2: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ELIGIBLE_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const contextAnyStd: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const inputRev: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand2, cand1],
      context: contextAnyStd,
    };

    const res = candidateSelectionEngine.selectCandidate(inputRev);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("MULTIPLE_ELIGIBLE_CANDIDATES"), "Message missing MULTIPLE_ELIGIBLE_CANDIDATES");
  });

  // TEST 08: Duplicate candidateId -> INVALID avec DUPLICATE_CANDIDATE_ID
  runTest("TEST 08 — Duplicate candidateId -> INVALID avec DUPLICATE_CANDIDATE_ID", () => {
    const cand1: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_DUPLICATE",
      componentType: "PIPE",
      nominalSize: "2",
    };
    const cand2: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_DUPLICATE",
      componentType: "PIPE",
      nominalSize: "2",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand1, cand2],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("DUPLICATE_CANDIDATE_ID"), "Message missing DUPLICATE_CANDIDATE_ID");
  });

  // TEST 09: Liste de candidats vide -> NO_ELIGIBLE_CANDIDATE
  runTest("TEST 09 — Liste de candidats vide -> NO_ELIGIBLE_CANDIDATE", () => {
    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "NO_ELIGIBLE_CANDIDATE", `Expected NO_ELIGIBLE_CANDIDATE, got '${res.status}'`);
    assert(res.traceByCandidate.length === 0, "traceByCandidate must be empty");
  });

  // TEST 10: null input -> INVALID avec INVALID_INPUT
  runTest("TEST 10 — null input -> INVALID avec INVALID_INPUT", () => {
    const res = candidateSelectionEngine.selectCandidate(null as any);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
    assert(res.message.includes("INVALID_INPUT"), "Message missing INVALID_INPUT");
  });

  // TEST 11: Candidate non-object -> INVALID
  runTest("TEST 11 — Candidate non-object -> INVALID", () => {
    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: ["NOT_AN_OBJECT" as any],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}'`);
  });

  // TEST 12: Candidate avec UNVERIFIED evidence via COMPONENT-01 -> ne doit jamais devenir SELECTED
  runTest("TEST 12 — Candidate avec UNVERIFIED evidence via COMPONENT-01 -> UNVERIFIED_CANDIDATES", () => {
    const candUnverifiedEv: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_UNVERIFIED_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      evidenceIds: ["SYNTHETIC_EV_UNVERIFIED_01"],
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candUnverifiedEv],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "UNVERIFIED_CANDIDATES", `Expected UNVERIFIED_CANDIDATES, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 13: Candidate avec evidence propre VERIFIED mais SPEC-01 UNVERIFIED -> UNVERIFIED_CANDIDATES
  runTest("TEST 13 — Candidate avec evidence propre VERIFIED mais SPEC-01 UNVERIFIED -> UNVERIFIED_CANDIDATES", () => {
    const candVerifiedEv: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_VERIFIED_EV_SPEC_NO_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    };

    const contextNoEv: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candVerifiedEv],
      context: contextNoEv,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "UNVERIFIED_CANDIDATES", `Expected UNVERIFIED_CANDIDATES, got '${res.status}'`);
    assert(res.selectedCandidateId === undefined, "selectedCandidateId must be undefined");
  });

  // TEST 14: Candidate avec evidence propre VERIFIED mais NORM-13 UNVERIFIED -> UNVERIFIED_CANDIDATES
  runTest("TEST 14 — Candidate avec evidence propre VERIFIED mais NORM-13 UNVERIFIED -> UNVERIFIED_CANDIDATES", () => {
    const candVerifiedEv: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_VERIFIED_EV_COMPAT_NO_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    };

    const contextNoEv: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 160",
      materialId: "SYNTHETIC_MAT_B",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candVerifiedEv],
      context: contextNoEv,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "UNVERIFIED_CANDIDATES", `Expected UNVERIFIED_CANDIDATES, got '${res.status}'`);
  });

  // TEST 15: Un candidat ELIGIBLE + plusieurs candidats INELIGIBLE -> SELECTED + toutes les traces conservées
  runTest("TEST 15 — Un candidat ELIGIBLE + plusieurs candidats INELIGIBLE -> SELECTED + traces conservées", () => {
    const candEligible: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ELIGIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const candInelig1: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_INELIG_1",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_A",
    };
    const candInelig2: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_INELIG_2",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_A",
    };

    const contextFlexible: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      materialId: "SYNTHETIC_MAT_A",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candInelig1, candEligible, candInelig2],
      context: contextFlexible,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "SELECTED", `Expected SELECTED, got '${res.status}'`);
    assert(res.selectedCandidateId === "SYNTHETIC_CAND_ELIGIBLE", "selectedCandidateId mismatch");
    assert(res.traceByCandidate.length === 3, "traceByCandidate length must be 3");
    assert(res.ineligibleCandidateIds.length === 2, "ineligibleCandidateIds length must be 2");
  });

  // TEST 16: Un candidat ELIGIBLE + un candidat INVALID -> SELECTED + l'INVALID reste dans invalidCandidateIds
  runTest("TEST 16 — Un candidat ELIGIBLE + un candidat INVALID -> SELECTED + INVALID dans invalidCandidateIds", () => {
    const candEligible: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ELIGIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const candInvalid: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_INVALID_PROP",
      componentType: "PIPE",
      nominalSize: "999_MISMATCH",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candEligible, candInvalid],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    assert(res.status === "SELECTED", `Expected SELECTED, got '${res.status}'`);
    assert(res.selectedCandidateId === "SYNTHETIC_CAND_ELIGIBLE", "selectedCandidateId mismatch");
    assert(res.invalidCandidateIds.includes("SYNTHETIC_CAND_INVALID_PROP"), "invalidCandidateIds missing candInvalid");
  });

  // TEST 17: Trace complète du candidat sélectionné conservée
  runTest("TEST 17 — Trace complète du candidat sélectionné (matchedRuleIds, compatibilityRuleIds, evidenceIds) conservée", () => {
    const candEligible: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_TRACE_FULL",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candEligible],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    const trace = res.traceByCandidate.find((t) => t.candidateId === "SYNTHETIC_CAND_TRACE_FULL");
    assert(trace !== undefined, "Trace missing for selected candidate");
    assert(trace!.status === "ELIGIBLE", "Trace status must be ELIGIBLE");
    assert(trace!.matchedRuleIds.length > 0, "Trace matchedRuleIds empty");
    assert(trace!.compatibilityRuleIds.length > 0, "Trace compatibilityRuleIds empty");
    assert(trace!.evidenceIds.length > 0, "Trace evidenceIds empty");
  });

  // TEST 18: IDs de sortie triés et uniques
  runTest("TEST 18 — IDs de sortie triés et uniques", () => {
    const cand1: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_Z",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const cand2: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_A",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_A",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [cand1, cand2],
      context: defaultContext,
    };

    const res = candidateSelectionEngine.selectCandidate(input);
    const isSorted = (arr: readonly string[]) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i - 1] > arr[i]) return false;
      }
      return true;
    };
    const isUnique = (arr: readonly string[]) => new Set(arr).size === arr.length;

    assert(isSorted(res.evaluatedCandidateIds), "evaluatedCandidateIds must be sorted");
    assert(isUnique(res.evaluatedCandidateIds), "evaluatedCandidateIds must be unique");
    assert(isSorted(res.eligibleCandidateIds), "eligibleCandidateIds must be sorted");
    assert(isUnique(res.eligibleCandidateIds), "eligibleCandidateIds must be unique");
    assert(isSorted(res.ineligibleCandidateIds), "ineligibleCandidateIds must be sorted");
    assert(isUnique(res.ineligibleCandidateIds), "ineligibleCandidateIds must be unique");
  });

  // TEST 19: Registry/Evidence vide -> aucun candidat ne devient SELECTED
  runTest("TEST 19 — Registry/Evidence vide -> aucun candidat ne devient SELECTED", () => {
    const emptyEvRegistry = new NormativeEvidenceRegistry();
    const emptyEvResolver = new NormativeEvidenceResolver(emptyEvRegistry);
    const emptyCompatRegistry = new NormativeCompatibilityRegistry();
    const emptyCompatEngine = new NormativeCompatibilityEngine(emptyCompatRegistry, emptyEvResolver);
    const emptySpecResolver = new PipingSpecResolver([], emptyCompatEngine, emptyEvResolver);
    const emptySelectionEngine = new ComponentSelectionEngine(emptySpecResolver, emptyEvResolver);
    const emptyCandEngine = new ComponentCandidateSelectionEngine(emptySelectionEngine);

    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_EMPTY_REG",
      componentType: "PIPE",
      nominalSize: "2",
    };

    const input: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candidate],
      context: defaultContext,
    };

    const res = emptyCandEngine.selectCandidate(input);
    assert(res.status !== "SELECTED", "Must NEVER return SELECTED when registry is empty");
  });

  // TEST 20: Aucun ranking implicite -> deux candidats ELIGIBLE identiques sauf candidateId et ordre inversé -> INVALID dans les deux cas
  runTest("TEST 20 — Aucun ranking implicite -> deux candidats ELIGIBLE identiques -> INVALID dans tous les ordres", () => {
    const candA: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ID_A",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const candB: ComponentCandidate = {
      candidateId: "SYNTHETIC_CAND_ID_B",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE_ALT",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const contextAnyStd: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const inputOrder1: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candA, candB],
      context: contextAnyStd,
    };

    const inputOrder2: ComponentCandidateSelectionInput = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      candidates: [candB, candA],
      context: contextAnyStd,
    };

    const res1 = candidateSelectionEngine.selectCandidate(inputOrder1);
    const res2 = candidateSelectionEngine.selectCandidate(inputOrder2);

    assert(res1.status === "INVALID", `Order 1 expected INVALID, got '${res1.status}'`);
    assert(res2.status === "INVALID", `Order 2 expected INVALID, got '${res2.status}'`);
    assert(res1.message.includes("MULTIPLE_ELIGIBLE_CANDIDATES"), "Order 1 missing MULTIPLE_ELIGIBLE_CANDIDATES");
    assert(res2.message.includes("MULTIPLE_ELIGIBLE_CANDIDATES"), "Order 2 missing MULTIPLE_ELIGIBLE_CANDIDATES");
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
