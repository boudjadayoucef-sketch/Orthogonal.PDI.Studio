/**
 * PDI NORMATIVE ENGINE — COMPONENT SELECTION ENGINE TESTS
 * Reference: COMPONENT-01 (Component Selection Engine)
 * 
 * Suite de tests unitaires et d'intégration déterministes validant COMPONENT-01.
 * Couvre l'ensemble des 20 exigences de sélection, traçabilité et non-conversion.
 */

import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { PipingSpecResolver } from "../engine/pipingSpecResolver";
import { ComponentSelectionEngine } from "../engine/componentSelectionEngine";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { ComponentCandidate, ComponentSelectionContext } from "../types/componentSelectionTypes";

export interface Component01TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[COMPONENT-01 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Exécute les tests unitaires et d'intégration COMPONENT-01.
 */
export function runComponentSelectionTests(): Component01TestResult {
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

  // Initialisation des fixtures synthétiques pour COMPONENT-01
  const evRegistry = new NormativeEvidenceRegistry();
  
  // Evidences VERIFIED
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
    evidenceId: "SYNTHETIC_EV_COMPAT_RULE_02",
    standardId: "SYNTHETIC_STD_COMPAT" as any,
    editionId: "SYNTHETIC_ED_2026",
    clauseReference: "CLAUSE_COMPAT_2",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_COMPAT_RULE_02",
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

  // Evidence UNVERIFIED
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

  // Registre de compatibilité NORM-13 synthétique
  const compatRegistry = new NormativeCompatibilityRegistry();
  
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_PIPE_01",
    description: "Synthetic pipe rule 01",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
  });

  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_PIPE_EQ_02",
    description: "Synthetic pipe rule 02",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_02"],
  });

  // Règle de compatibilité explicitement INCOMPATIBLE
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_PIPE_INCOMPATIBLE",
    description: "Synthetic pipe rule incompatible",
    standardId: "SYNTHETIC_STD_PIPE" as any,
    componentType: "PIPE",
    nominalSize: "3",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_A",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
  });

  // Règle de compatibilité sans preuves
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_NO_EVIDENCE",
    description: "Synthetic pipe rule no evidence",
    standardId: "SYNTHETIC_STD_NO_EV" as any,
    componentType: "PIPE",
    nominalSize: "4",
    schedule: "SCH 80",
    materialId: "SYNTHETIC_MAT_B",
    status: "COMPATIBLE",
    evidenceIds: [],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evResolver);

  // Piping Specifications synthétiques
  const syntheticPipingSpecs: PipingSpecification[] = [
    {
      id: "SYNTHETIC_SPEC_01",
      code: "SYN-SPEC-01",
      name: "Synthetic Piping Specification 01",
      designCodeId: "ASME-B31.3",
      materialReferenceIds: ["SYNTHETIC_MAT_A", "SYNTHETIC_MAT_B"],
      pipeRules: [
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_01",
          pipeDimensionalStandardId: "SYNTHETIC_STD_PIPE",
          nominalSizes: ["2", "3", "4"],
          schedule: "SCH 40",
          materialId: "SYNTHETIC_MAT_A",
          sourceStatus: "VERIFIED",
          evidenceIds: ["SYNTHETIC_EV_SPEC_RULE_01"],
        },
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_NO_EV",
          pipeDimensionalStandardId: "SYNTHETIC_STD_NO_EV",
          nominalSizes: ["4"],
          schedule: "SCH 80",
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
    {
      id: "SYNTHETIC_SPEC_02_INCOMPATIBLE",
      code: "SYN-SPEC-02",
      name: "Synthetic Piping Spec Incompatible",
      designCodeId: "ASME-B31.3",
      materialReferenceIds: ["SYNTHETIC_MAT_A"],
      pipeRules: [
        {
          ruleId: "SYNTHETIC_SPEC_PIPE_RULE_INCOMPATIBLE",
          pipeDimensionalStandardId: "SYNTHETIC_STD_PIPE",
          nominalSizes: ["3"],
          schedule: "SCH 40",
          materialId: "SYNTHETIC_MAT_A",
          sourceStatus: "VERIFIED",
          evidenceIds: ["SYNTHETIC_EV_SPEC_RULE_01"],
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

  // TEST 1: Candidat PIPE cohérent avec Spec Rule VERIFIED + Compatibility Rule VERIFIED -> ELIGIBLE
  runTest("TEST 01 — Candidat PIPE cohérent avec Spec Rule & Compat Rule VERIFIED -> ELIGIBLE", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_PIPE_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "ELIGIBLE", `Expected ELIGIBLE, got '${res.status}' (${res.message})`);
    assert(res.candidateId === "SYNTHETIC_COMPONENT_PIPE_01", "candidateId mismatch");
    assert(res.specificationId === "SYNTHETIC_SPEC_01", "specificationId mismatch");
    assert(res.matchedRuleIds.includes("SYNTHETIC_SPEC_PIPE_RULE_01"), "matchedRuleIds missing SPEC rule");
    assert(res.compatibilityRuleIds.length > 0, "compatibilityRuleIds empty");
    assert(res.evidenceIds.length > 0, "evidenceIds empty");
  });

  // TEST 2: Candidat explicitement incompatible avec une règle VERIFIED -> INELIGIBLE
  runTest("TEST 02 — Candidat explicitement incompatible avec une règle VERIFIED -> INELIGIBLE", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_PIPE_02",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "3",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_02_INCOMPATIBLE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "3",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INELIGIBLE", `Expected INELIGIBLE, got '${res.status}' (${res.message})`);
  });

  // TEST 3: Piping Spec Rule sans evidence VERIFIED -> UNVERIFIED
  runTest("TEST 03 — Piping Spec Rule sans evidence VERIFIED -> UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_PIPE_NO_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}' (${res.message})`);
  });

  // TEST 4: Compatibility Rule sans evidence VERIFIED -> UNVERIFIED
  runTest("TEST 04 — Compatibility Rule sans evidence VERIFIED -> UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_PIPE_COMPAT_NO_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}' (${res.message})`);
  });

  // TEST 5: Aucune Compatibility Rule -> UNVERIFIED
  runTest("TEST 05 — Aucune Compatibility Rule -> UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_PIPE_UNKNOWN_SIZE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "99",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "99",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "UNVERIFIED" || res.status === "INELIGIBLE", `Expected UNVERIFIED/INELIGIBLE, got '${res.status}'`);
  });

  // TEST 6: Piping Spec Resolver retourne INVALID -> INVALID
  runTest("TEST 06 — Piping Spec Resolver retourne INVALID (Spec introuvable) -> INVALID", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_PIPE_MISSING_SPEC",
      componentType: "PIPE",
      nominalSize: "2",
    };
    const context: ComponentSelectionContext = {
      specificationId: "NON_EXISTENT_SPEC",
      componentType: "PIPE",
      nominalSize: "2",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
  });

  // TEST 7: candidate.componentType !== context.componentType -> INVALID
  runTest("TEST 07 — candidate.componentType !== context.componentType -> INVALID", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_MISMATCH_TYPE",
      componentType: "VALVE",
      nominalSize: "2",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
  });

  // TEST 8: candidate.materialId !== context.materialId -> INVALID
  runTest("TEST 08 — candidate.materialId !== context.materialId -> INVALID", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_MISMATCH_MAT",
      componentType: "PIPE",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      materialId: "SYNTHETIC_MAT_B",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
  });

  // TEST 9: candidate.nominalSize !== context.nominalSize -> INVALID
  runTest("TEST 09 — candidate.nominalSize !== context.nominalSize -> INVALID", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_MISMATCH_SIZE",
      componentType: "PIPE",
      nominalSize: "2",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "3",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
  });

  // TEST 10: candidate.schedule !== context.schedule -> INVALID
  runTest("TEST 10 — candidate.schedule !== context.schedule -> INVALID", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_MISMATCH_SCHED",
      componentType: "PIPE",
      schedule: "SCH 40",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      schedule: "SCH 80",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
  });

  // TEST 11: Aucune conversion NPS/DN -> UNVERIFIED ou INVALID (jamais ELIGIBLE)
  runTest("TEST 11 — Aucune conversion NPS/DN (nominalSize '2' vs 'DN 50') -> INVALID / UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_NPS_DN",
      componentType: "PIPE",
      nominalSize: "DN 50",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID" || res.status === "UNVERIFIED", `Expected INVALID or UNVERIFIED, got '${res.status}'`);
    assert(res.status !== "ELIGIBLE", "Must NEVER return ELIGIBLE for unmapped NPS/DN string differences");
  });

  // TEST 12: Aucune conversion Class/PN -> UNVERIFIED ou INVALID (jamais ELIGIBLE)
  runTest("TEST 12 — Aucune conversion Class/PN ('Class 150' vs 'PN 16') -> INVALID / UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_CLASS_PN",
      componentType: "FLANGE",
      ratingValue: "PN 16",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "FLANGE",
      ratingValue: "Class 150",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "INVALID" || res.status === "UNVERIFIED", `Expected INVALID or UNVERIFIED, got '${res.status}'`);
    assert(res.status !== "ELIGIBLE", "Must NEVER return ELIGIBLE for unmapped Class/PN string differences");
  });

  // TEST 13: Candidate evidence présente mais Spec Rule sans evidence -> Candidate evidence ne qualifie PAS la Spec Rule -> UNVERIFIED
  runTest("TEST 13 — Candidate evidence présente mais Spec Rule sans evidence -> UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_CAND_EV_SPEC_NO_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}' (${res.message})`);
  });

  // TEST 14: Candidate evidence présente mais Compatibility Rule sans evidence -> UNVERIFIED
  runTest("TEST 14 — Candidate evidence présente mais Compatibility Rule sans evidence -> UNVERIFIED", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_CAND_EV_COMPAT_NO_EV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_NO_EV",
      nominalSize: "4",
      schedule: "SCH 80",
      materialId: "SYNTHETIC_MAT_B",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "UNVERIFIED", `Expected UNVERIFIED, got '${res.status}' (${res.message})`);
  });

  // TEST 15: Deux règles NORM-13 équivalentes VERIFIED -> ELIGIBLE, compatibilityRuleIds contient les deux IDs triés
  runTest("TEST 15 — Deux règles NORM-13 équivalentes VERIFIED -> ELIGIBLE & compatibilityRuleIds triés", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_MULTI_COMPAT",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.status === "ELIGIBLE", `Expected ELIGIBLE, got '${res.status}' (${res.message})`);
    assert(
      res.compatibilityRuleIds.length === 2 &&
      res.compatibilityRuleIds[0] === "SYNTHETIC_COMPAT_RULE_PIPE_01" &&
      res.compatibilityRuleIds[1] === "SYNTHETIC_COMPAT_RULE_PIPE_EQ_02",
      `Expected sorted compatibilityRuleIds, got: ${JSON.stringify(res.compatibilityRuleIds)}`
    );
  });

  // TEST 16: Deux règles NORM-13 contradictoires VERIFIED -> INVALID avec NORMATIVE_RULE_CONFLICT
  runTest("TEST 16 — Deux règles NORM-13 contradictoires VERIFIED -> INVALID avec NORMATIVE_RULE_CONFLICT", () => {
    const conflictRegistry = new NormativeCompatibilityRegistry();
    conflictRegistry.register({
      ruleId: "SYNTHETIC_COMPAT_CONFLICT_A",
      description: "Conflict A",
      standardId: "SYNTHETIC_STD_PIPE" as any,
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      status: "COMPATIBLE",
      evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
    });
    conflictRegistry.register({
      ruleId: "SYNTHETIC_COMPAT_CONFLICT_B",
      description: "Conflict B",
      standardId: "SYNTHETIC_STD_PIPE" as any,
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      status: "INCOMPATIBLE",
      evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_02"],
    });

    const conflictEngine = new NormativeCompatibilityEngine(conflictRegistry, evResolver);
    const conflictSpecResolver = new PipingSpecResolver(syntheticPipingSpecs, conflictEngine, evResolver);
    const conflictSelectionEngine = new ComponentSelectionEngine(conflictSpecResolver, evResolver);

    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_CONFLICT",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = conflictSelectionEngine.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
    assert(res.message.includes("NORMATIVE_RULE_CONFLICT"), "Expected message to contain NORMATIVE_RULE_CONFLICT");
  });

  // TEST 17: Même conflit avec ordre inverse -> Résultat identique INVALID, aucun ordre du registre
  runTest("TEST 17 — Même conflit avec ordre d'enregistrement inverse -> Résultat identique INVALID", () => {
    const conflictRegistryRev = new NormativeCompatibilityRegistry();
    conflictRegistryRev.register({
      ruleId: "SYNTHETIC_COMPAT_CONFLICT_B",
      description: "Conflict B",
      standardId: "SYNTHETIC_STD_PIPE" as any,
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      status: "INCOMPATIBLE",
      evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_02"],
    });
    conflictRegistryRev.register({
      ruleId: "SYNTHETIC_COMPAT_CONFLICT_A",
      description: "Conflict A",
      standardId: "SYNTHETIC_STD_PIPE" as any,
      componentType: "PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      status: "COMPATIBLE",
      evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01"],
    });

    const conflictEngineRev = new NormativeCompatibilityEngine(conflictRegistryRev, evResolver);
    const conflictSpecResolverRev = new PipingSpecResolver(syntheticPipingSpecs, conflictEngineRev, evResolver);
    const conflictSelectionEngineRev = new ComponentSelectionEngine(conflictSpecResolverRev, evResolver);

    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_CONFLICT_REV",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = conflictSelectionEngineRev.select(candidate, context);
    assert(res.status === "INVALID", `Expected INVALID, got '${res.status}' (${res.message})`);
    assert(res.message.includes("NORMATIVE_RULE_CONFLICT"), "Expected message to contain NORMATIVE_RULE_CONFLICT");
  });

  // TEST 18: Toutes les traces conservées (matchedRuleIds, compatibilityRuleIds, evidenceIds)
  runTest("TEST 18 — Conservations intégrale des traces (matchedRuleIds, compatibilityRuleIds, evidenceIds)", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_TRACE",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      evidenceIds: ["SYNTHETIC_EV_CANDIDATE_VERIFIED"],
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = selectionEngine.select(candidate, context);
    assert(res.matchedRuleIds.length > 0, "matchedRuleIds must be populated");
    assert(res.compatibilityRuleIds.length > 0, "compatibilityRuleIds must be populated");
    assert(res.evidenceIds.includes("SYNTHETIC_EV_SPEC_RULE_01"), "evidenceIds missing spec rule evidence");
    assert(res.evidenceIds.includes("SYNTHETIC_EV_COMPAT_RULE_01"), "evidenceIds missing compat rule evidence");
    assert(res.evidenceIds.includes("SYNTHETIC_EV_CANDIDATE_VERIFIED"), "evidenceIds missing verified candidate evidence");
  });

  // TEST 19: Les IDs retournés sont triés et dédupliqués
  runTest("TEST 19 — Les IDs retournés sont triés et dédupliqués", () => {
    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_SORT_DEDUP",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
      evidenceIds: ["SYNTHETIC_EV_COMPAT_RULE_01", "SYNTHETIC_EV_SPEC_RULE_01"],
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      dimensionalStandardId: "SYNTHETIC_STD_PIPE",
      nominalSize: "2",
      schedule: "SCH 40",
      materialId: "SYNTHETIC_MAT_A",
    };

    const res = selectionEngine.select(candidate, context);
    const isSorted = (arr: readonly string[]) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i - 1] > arr[i]) return false;
      }
      return true;
    };
    const isUnique = (arr: readonly string[]) => new Set(arr).size === arr.length;

    assert(isSorted(res.matchedRuleIds), "matchedRuleIds must be sorted");
    assert(isUnique(res.matchedRuleIds), "matchedRuleIds must be unique");
    assert(isSorted(res.compatibilityRuleIds), "compatibilityRuleIds must be sorted");
    assert(isUnique(res.compatibilityRuleIds), "compatibilityRuleIds must be unique");
    assert(isSorted(res.evidenceIds), "evidenceIds must be sorted");
    assert(isUnique(res.evidenceIds), "evidenceIds must be unique");
  });

  // TEST 20: Registry/Resolver vide -> UNVERIFIED
  runTest("TEST 20 — Registry/Resolver vide -> UNVERIFIED", () => {
    const emptyEvRegistry = new NormativeEvidenceRegistry();
    const emptyEvResolver = new NormativeEvidenceResolver(emptyEvRegistry);
    const emptyCompatRegistry = new NormativeCompatibilityRegistry();
    const emptyCompatEngine = new NormativeCompatibilityEngine(emptyCompatRegistry, emptyEvResolver);
    const emptySpecResolver = new PipingSpecResolver([], emptyCompatEngine, emptyEvResolver);
    const emptySelectionEngine = new ComponentSelectionEngine(emptySpecResolver, emptyEvResolver);

    const candidate: ComponentCandidate = {
      candidateId: "SYNTHETIC_COMPONENT_EMPTY_ENGINE",
      componentType: "PIPE",
      nominalSize: "2",
    };
    const context: ComponentSelectionContext = {
      specificationId: "SYNTHETIC_SPEC_01",
      componentType: "PIPE",
      nominalSize: "2",
    };

    const res = emptySelectionEngine.select(candidate, context);
    assert(res.status === "UNVERIFIED" || res.status === "INVALID", `Expected UNVERIFIED/INVALID, got '${res.status}'`);
    assert(res.status !== "ELIGIBLE", "Must NEVER return ELIGIBLE when registry is empty");
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
