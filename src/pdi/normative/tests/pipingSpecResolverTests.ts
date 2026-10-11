/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION RESOLVER TESTS
 * Reference: SPEC-01, SPEC-01-FIX-01, SPEC-01-FIX-02
 * 
 * Suite de tests unitaires et d'intégration pour le Piping Specification Resolver.
 * Couvre :
 * 1. L'autorité des règles Piping Spec (SPEC-01-FIX-01)
 * 2. La traçabilité des preuves (NORM-09)
 * 3. La précédence stricte des matériaux de composant
 * 4. L'isolation stricte des preuves de la règle (SPEC-01-FIX-02 FIX 01)
 * 5. La gestion déterministe des règles multiples et détection de conflits (SPEC-01-FIX-02 FIX 02)
 */

import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { PipingSpecResolver } from "../engine/pipingSpecResolver";
import type { PipingSpecification } from "../types/pipingSpecTypes";

export interface Spec01TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[SPEC-01 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Exécute l'ensemble des tests SPEC-01, SPEC-01-FIX-01 et SPEC-01-FIX-02.
 */
export function runPipingSpecResolverTests(): Spec01TestResult {
  const results: string[] = [];
  let testsRun = 0;

  // 1. Initialisation des registres synthétiques de preuves
  const evRegistry = new NormativeEvidenceRegistry();
  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_SPEC01_VERIFIED_01",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_SPEC_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_SPEC01_VERIFIED_02",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_SPEC_02",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_02",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_SPEC_EVIDENCE",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_SPEC_GLOBAL",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_SPEC",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_RULE_EVIDENCE",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_RULE_A",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_RULE_A",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_RULE_EVIDENCE_A",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_RULE_A",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_RULE_A",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_RULE_EVIDENCE_B",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_RULE_B",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_RULE_B",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  evRegistry.register({
    evidenceId: "SYNTHETIC_EV_SPEC01_UNVERIFIED_01",
    standardId: "SYNTHETIC_STANDARD_SPEC01" as any,
    editionId: "SYNTHETIC_EDITION_2026",
    clauseReference: "CLAUSE_SPEC_03",
    sourceType: "LEGACY_REFERENCE",
    sourceReference: "SYNTHETIC_DOC_REF_03",
    verificationStatus: "UNVERIFIED",
  });

  const evidenceResolver = new NormativeEvidenceResolver(evRegistry);
  const compatRegistry = new NormativeCompatibilityRegistry();

  // Compat 1 : Règle tuyau compatible
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_PIPE_OK",
    description: "Synthetic pipe compatibility rule",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat 1b : Règle tuyau compatible générique
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_PIPE_GENERIC",
    description: "Synthetic generic pipe compatibility rule",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat 1c : Règle tuyau synthétique pour FIX-02
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_FIX02",
    description: "Synthetic pipe compatibility rule for FIX-02",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_SPEC_EVIDENCE"],
  });

  // Compat FIX-03 Test 1 : Règle tuyau INCOMPATIBLE pour NPS 10 SCH 40
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_INCOMPAT_FIX03",
    description: "Synthetic pipe compatibility rule marked INCOMPATIBLE for FIX-03 Test 1",
    componentType: "PIPE",
    nominalSize: "10",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat FIX-03 Test 4 : Règle tuyau avec preuve non vérifiée
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_PIPE_UNVERIFIED_EV_FIX03",
    description: "Synthetic pipe compatibility rule with unverified evidence for FIX-03",
    componentType: "PIPE",
    nominalSize: "8",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_UNVERIFIED_01"],
  });

  // Compat FIX-03 Test 5 : Règles contradictoires (COMPATIBLE vs INCOMPATIBLE sur NPS 3)
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_CONFLICT_COMPAT_FIX03",
    description: "Synthetic conflicting compatible rule on NPS 3",
    componentType: "PIPE",
    nominalSize: "3",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_CONFLICT_INCOMPAT_FIX03",
    description: "Synthetic conflicting incompatible rule on NPS 3",
    componentType: "PIPE",
    nominalSize: "3",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_02"],
  });

  // Compat FIX-03 Test 6 : Deux règles équivalentes compatibles sur NPS 4
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_EQUIV_A_FIX03",
    description: "Synthetic equivalent compatible rule A on NPS 4",
    componentType: "PIPE",
    nominalSize: "4",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
  });
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_EQUIV_B_FIX03",
    description: "Synthetic equivalent compatible rule B on NPS 4",
    componentType: "PIPE",
    nominalSize: "4",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
  });

  // Compat 2 : Règle incompatible explicite
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_INCOMPAT",
    description: "Synthetic incompatible rule",
    componentType: "PIPE",
    nominalSize: "10",
    schedule: "SCH 160",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat 3 : Règle fitting
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_FITTING",
    description: "Synthetic fitting rule",
    componentType: "FITTING",
    connectionType: "BUTT_WELD",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat 4 : Règle flange
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_FLANGE",
    description: "Synthetic flange rule",
    componentType: "FLANGE",
    pressureRating: "Class 150",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat 5 : Règle valve
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_VALVE",
    description: "Synthetic valve rule",
    componentType: "VALVE",
    connectionType: "FLANGED",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  // Compat 6 : Règle avec preuve UNVERIFIED
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_UNVERIFIED_EV",
    description: "Rule with unverified evidence",
    componentType: "SYNTHETIC_SPECIAL",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_UNVERIFIED_01"],
  });

  // Compat 7 : Règle avec preuve inexistante
  compatRegistry.register({
    ruleId: "SYNTHETIC_COMPAT_RULE_MISSING_EV",
    description: "Rule with missing evidence",
    componentType: "SYNTHETIC_MISSING",
    status: "COMPATIBLE",
    evidenceIds: ["NON_EXISTENT_EV_999"],
  });

  // Compat 8 : Règle sans conversion NPS/DN
  compatRegistry.register({
    ruleId: "SYNTHETIC_RULE_EXACT_NPS_2",
    description: "Rule requiring exact NPS 2 string",
    componentType: "SYNTHETIC_EXACT",
    nominalSize: "NPS 2",
    pressureRating: "Class 150",
    status: "COMPATIBLE",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evidenceResolver);

  // Spécification standard 001
  const syntheticSpec: PipingSpecification = {
    id: "SYNTHETIC_SPEC_001",
    code: "SYNTH_CS150",
    name: "Synthetic Carbon Steel Class 150 Spec",
    designCodeId: "ASME-B31.3",
    serviceClass: "CLASS_150_PROCESS",
    fluidService: "SYNTHETIC_PROCESS_FLUID",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL", "SYNTHETIC_MAT_STAINLESS_STEEL"],
    pipeRules: [
      {
        ruleId: "SPEC_PIPE_RULE_01",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2", "3", "4", "6", "8", "10"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        sourceReference: "SYNTHETIC_SPEC_DOC_P01",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
      },
    ],
    fittingRules: [
      {
        ruleId: "SPEC_FITTING_RULE_01",
        fittingStandardId: "ASME-B16.9",
        fittingTypes: ["ELBOW", "TEE", "REDUCER"],
        connectionTypes: ["BUTT_WELD"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
      },
    ],
    flangeRules: [
      {
        ruleId: "SPEC_FLANGE_RULE_01",
        flangeStandardId: "ASME-B16.5",
        flangeTypes: ["WELD_NECK", "BLIND"],
        ratingSystem: "ASME_CLASS",
        rating: "Class 150",
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
      },
    ],
    valveRules: [
      {
        ruleId: "SPEC_VALVE_RULE_01",
        productStandardId: "API-600",
        dimensionalStandardId: "ASME-B16.10",
        valveTypes: ["GATE", "GLOBE", "CHECK"],
        connectionTypes: ["FLANGED"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
      },
    ],
    sourceStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_MASTER_SPEC_DOC",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  };

  const syntheticSpecEmptyRules: PipingSpecification = {
    id: "SYNTHETIC_SPEC_EMPTY_RULES",
    code: "SYNTH_EMPTY",
    name: "Synthetic Empty Rules Spec",
    materialReferenceIds: [],
    pipeRules: [],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "UNVERIFIED",
  };

  const syntheticSpecUnverifiedRule: PipingSpecification = {
    id: "SYNTHETIC_SPEC_UNVERIFIED_RULE",
    code: "SYNTH_UNVERIF",
    name: "Synthetic Spec with Unverified Rule",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SPEC_PIPE_RULE_UNVERIF",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "UNVERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_UNVERIFIED_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "UNVERIFIED",
  };

  const syntheticSpecMissingEvidenceRule: PipingSpecification = {
    id: "SYNTHETIC_SPEC_MISSING_EV_RULE",
    code: "SYNTH_MISSING_EV",
    name: "Synthetic Spec with Missing Evidence Rule",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SPEC_PIPE_RULE_MISSING_EV",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["NON_EXISTENT_EV_999"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_DOC",
  };

  const syntheticSpecConflictingRules: PipingSpecification = {
    id: "SYNTHETIC_SPEC_CONFLICT_RULES",
    code: "SYNTH_CONFLICT",
    name: "Synthetic Spec with Conflicting Rules",
    materialReferenceIds: ["SYNTHETIC_MAT_A", "SYNTHETIC_MAT_B"],
    pipeRules: [
      {
        ruleId: "RULE_CONFLICT_A",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_A",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
      },
      {
        ruleId: "RULE_CONFLICT_B",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_B",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_02"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_DOC",
  };

  const syntheticSpecConflictingRulesReversed: PipingSpecification = {
    id: "SYNTHETIC_SPEC_CONFLICT_RULES_REV",
    code: "SYNTH_CONFLICT_REV",
    name: "Synthetic Spec with Conflicting Rules Reversed",
    materialReferenceIds: ["SYNTHETIC_MAT_A", "SYNTHETIC_MAT_B"],
    pipeRules: [
      {
        ruleId: "RULE_CONFLICT_B",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_B",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_02"],
      },
      {
        ruleId: "RULE_CONFLICT_A",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_A",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
    sourceReference: "SYNTHETIC_DOC",
  };

  // Fixtures spécifiques pour SPEC-01-FIX-02
  // Fixture FIX-02 Test 1: Spec avec verified evidence mais Rule SANS evidenceIds
  const specFix02NoRuleEvidence: PipingSpecification = {
    id: "SPEC_FIX02_NO_RULE_EVIDENCE",
    code: "SPEC_FIX02_01",
    name: "Spec with spec-level evidence but pipe rule without evidence",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_RULE_NO_EV",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: undefined, // PAS DE PREUVES SUR LA REGLE
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
    evidenceIds: ["SYNTHETIC_SPEC_EVIDENCE"], // Preuve au niveau de la spec
  };

  // Fixture FIX-02 Test 2: Rule avec sa propre evidenceIds vérifiée
  const specFix02WithRuleEvidence: PipingSpecification = {
    id: "SPEC_FIX02_WITH_RULE_EVIDENCE",
    code: "SPEC_FIX02_02",
    name: "Spec with verified pipe rule evidence",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_RULE_OK",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
    evidenceIds: ["SYNTHETIC_SPEC_EVIDENCE"],
  };

  // Fixture FIX-02 Test 3: Rule avec preuve inexistante
  const specFix02MissingRuleEvidence: PipingSpecification = {
    id: "SPEC_FIX02_MISSING_RULE_EVIDENCE",
    code: "SPEC_FIX02_03",
    name: "Spec with missing rule evidence",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_RULE_MISSING",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_MISSING_EVIDENCE"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Test 4: Deux règles strictement équivalentes
  const specFix02EquivalentRules: PipingSpecification = {
    id: "SPEC_FIX02_EQUIVALENT_RULES",
    code: "SPEC_FIX02_04",
    name: "Spec with equivalent pipe rules",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_RULE_A",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
      {
        ruleId: "SYNTHETIC_PIPE_RULE_B",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Test 6: Inversion d'ordre des règles équivalentes
  const specFix02EquivalentRulesReversed: PipingSpecification = {
    id: "SPEC_FIX02_EQUIVALENT_RULES_REV",
    code: "SPEC_FIX02_06",
    name: "Spec with equivalent pipe rules reversed",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_RULE_B",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
      },
      {
        ruleId: "SYNTHETIC_PIPE_RULE_A",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Test 5: Deux règles contradictoires sur schedule (SCH 40 vs SCH 80)
  const specFix02ConflictingSchedule: PipingSpecification = {
    id: "SPEC_FIX02_CONFLICT_SCHEDULE",
    code: "SPEC_FIX02_05",
    name: "Spec with conflicting schedule rules",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_RULE_SCH40",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
      {
        ruleId: "SYNTHETIC_PIPE_RULE_SCH80",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 80",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Test 8: Deux règles contradictoires sur dimensional standard
  const specFix02ConflictingDimStd: PipingSpecification = {
    id: "SPEC_FIX02_CONFLICT_DIMSTD",
    code: "SPEC_FIX02_08",
    name: "Spec with conflicting dimensional standard rules",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "SYNTHETIC_PIPE_DIM_A",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
      {
        ruleId: "SYNTHETIC_PIPE_DIM_B",
        pipeDimensionalStandardId: "ASME-B36.19M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Test 44: Deux règles équivalentes mais l'une sans preuve
  const specFix02MultiOneUnverified: PipingSpecification = {
    id: "SPEC_FIX02_MULTI_ONE_UNVERIFIED",
    code: "SPEC_FIX02_44",
    name: "Spec with 2 equivalent rules where one lacks evidence",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [
      {
        ruleId: "RULE_WITH_EV",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
      {
        ruleId: "RULE_WITHOUT_EV",
        pipeDimensionalStandardId: "ASME-B36.10M",
        schedule: "SCH 40",
        nominalSizes: ["2"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: undefined,
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Flange Conflicting Rating
  const specFix02FlangeConflictRating: PipingSpecification = {
    id: "SPEC_FIX02_FLANGE_CONFLICT_RATING",
    code: "SPEC_FIX02_FL_RATING",
    name: "Spec with conflicting flange rating rules",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [],
    fittingRules: [],
    flangeRules: [
      {
        ruleId: "FLANGE_RATING_150",
        flangeStandardId: "ASME-B16.5",
        ratingSystem: "ASME_CLASS",
        rating: "Class 150",
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
      {
        ruleId: "FLANGE_RATING_300",
        flangeStandardId: "ASME-B16.5",
        ratingSystem: "ASME_CLASS",
        rating: "Class 300",
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
      },
    ],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  // Fixture FIX-02 Valve Conflicting Standard
  const specFix02ValveConflictStandard: PipingSpecification = {
    id: "SPEC_FIX02_VALVE_CONFLICT_STD",
    code: "SPEC_FIX02_V_STD",
    name: "Spec with conflicting valve product standard rules",
    materialReferenceIds: ["SYNTHETIC_MAT_CARBON_STEEL"],
    pipeRules: [],
    fittingRules: [],
    flangeRules: [],
    valveRules: [
      {
        ruleId: "VALVE_STD_API600",
        productStandardId: "API-600",
        dimensionalStandardId: "ASME-B16.10",
        valveTypes: ["GATE"],
        connectionTypes: ["FLANGED"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_A"],
      },
      {
        ruleId: "VALVE_STD_API6D",
        productStandardId: "API-6D",
        dimensionalStandardId: "ASME-B16.10",
        valveTypes: ["GATE"],
        connectionTypes: ["FLANGED"],
        materialId: "SYNTHETIC_MAT_CARBON_STEEL",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_RULE_EVIDENCE_B"],
      },
    ],
    sourceStatus: "VERIFIED",
  };

  const specsMap = new Map<string, PipingSpecification>([
    ["SYNTHETIC_SPEC_001", syntheticSpec],
    ["SYNTHETIC_SPEC_EMPTY_RULES", syntheticSpecEmptyRules],
    ["SYNTHETIC_SPEC_UNVERIFIED_RULE", syntheticSpecUnverifiedRule],
    ["SYNTHETIC_SPEC_MISSING_EV_RULE", syntheticSpecMissingEvidenceRule],
    ["SYNTHETIC_SPEC_CONFLICT_RULES", syntheticSpecConflictingRules],
    ["SYNTHETIC_SPEC_CONFLICT_RULES_REV", syntheticSpecConflictingRulesReversed],
    ["SPEC_FIX02_NO_RULE_EVIDENCE", specFix02NoRuleEvidence],
    ["SPEC_FIX02_WITH_RULE_EVIDENCE", specFix02WithRuleEvidence],
    ["SPEC_FIX02_MISSING_RULE_EVIDENCE", specFix02MissingRuleEvidence],
    ["SPEC_FIX02_EQUIVALENT_RULES", specFix02EquivalentRules],
    ["SPEC_FIX02_EQUIVALENT_RULES_REV", specFix02EquivalentRulesReversed],
    ["SPEC_FIX02_CONFLICT_SCHEDULE", specFix02ConflictingSchedule],
    ["SPEC_FIX02_CONFLICT_DIMSTD", specFix02ConflictingDimStd],
    ["SPEC_FIX02_MULTI_ONE_UNVERIFIED", specFix02MultiOneUnverified],
    ["SPEC_FIX02_FLANGE_CONFLICT_RATING", specFix02FlangeConflictRating],
    ["SPEC_FIX02_VALVE_CONFLICT_STD", specFix02ValveConflictStandard],
  ]);

  const specLookup = (id: string): PipingSpecification | undefined => specsMap.get(id);

  const resolver = new PipingSpecResolver(specLookup, compatEngine, evidenceResolver);

  // =========================================================================
  // TESTS SPEC-01 DE BASE (1 à 20)
  // =========================================================================
  testsRun++;
  const res1 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res1.status === "COMPATIBLE", `TEST 1: expected COMPATIBLE, got ${res1.status}`);
  assert(res1.matchedRuleIds.includes("SPEC_PIPE_RULE_01"), "TEST 1: spec ruleId mismatch");
  assert(res1.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_RULE_PIPE_OK"), "TEST 1: compat ruleId mismatch");
  results.push("✅ PASS: TEST 1 — Contexte valide + règle compatible → COMPATIBLE");

  testsRun++;
  const res2 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "10",
    schedule: "SCH 160",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res2.status === "INCOMPATIBLE", `TEST 2: expected INCOMPATIBLE, got ${res2.status}`);
  results.push("✅ PASS: TEST 2 — Contexte valide + règle incompatible → INCOMPATIBLE");

  testsRun++;
  const res3 = resolver.resolve({
    specificationId: "NON_EXISTENT_SPEC_999",
    componentType: "PIPE",
  });
  assert(res3.status === "INVALID", `TEST 3: expected INVALID for missing spec, got ${res3.status}`);
  results.push("✅ PASS: TEST 3 — Spécification inexistante → INVALID");

  testsRun++;
  const res4 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_EMPTY_RULES",
    componentType: "SYNTHETIC_UNKNOWN_COMPONENT",
  });
  assert(res4.status === "UNVERIFIED", `TEST 4: expected UNVERIFIED for unmatched component, got ${res4.status}`);
  results.push("✅ PASS: TEST 4 — Aucune règle correspondante → UNVERIFIED");

  testsRun++;
  const res5 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res5.status === "COMPATIBLE", `TEST 5: authorized material must resolve successfully, got ${res5.status}`);
  results.push("✅ PASS: TEST 5 — Matériau autorisé par la spécification validé");

  testsRun++;
  const res6 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    materialId: "SYNTHETIC_UNAUTHORIZED_TITANIUM",
  });
  assert(res6.status === "INCOMPATIBLE", `TEST 6: expected INCOMPATIBLE for unauthorized material, got ${res6.status}`);
  results.push("✅ PASS: TEST 6 — Matériau absent de la spécification → INCOMPATIBLE");

  testsRun++;
  const res7 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FITTING",
    productStandardId: "ASME-B16.9",
    fittingType: "ELBOW",
    connectionType: "BUTT_WELD",
  });
  assert(res7.status === "COMPATIBLE", `TEST 7: expected COMPATIBLE for valid fitting, got ${res7.status}`);
  results.push("✅ PASS: TEST 7 — Fitting rule applicable validée");

  testsRun++;
  const res8 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FLANGE",
    productStandardId: "ASME-B16.5",
    ratingSystem: "ASME_CLASS",
    ratingValue: "Class 150",
  });
  assert(res8.status === "COMPATIBLE", `TEST 8: expected COMPATIBLE for valid flange, got ${res8.status}`);
  results.push("✅ PASS: TEST 8 — Flange rule applicable validée");

  testsRun++;
  const res9 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "VALVE",
    productStandardId: "API-600",
    dimensionalStandardId: "ASME-B16.10",
    connectionType: "FLANGED",
  });
  assert(res9.status === "COMPATIBLE", `TEST 9: expected COMPATIBLE for valid valve, got ${res9.status}`);
  results.push("✅ PASS: TEST 9 — Valve rule applicable validée");

  testsRun++;
  const res10 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    dimensionalStandardId: "ASME-B36.10M",
    nominalSize: "2",
    schedule: "SCH 40",
  });
  assert(res10.status === "COMPATIBLE", `TEST 10: expected COMPATIBLE for valid pipe, got ${res10.status}`);
  results.push("✅ PASS: TEST 10 — Pipe rule applicable validée");

  testsRun++;
  const res11 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "48",
    dimensionalStandardId: "ASME-B36.10M",
  });
  assert(res11.status === "INCOMPATIBLE", `TEST 11: expected INCOMPATIBLE for unsupported size, got ${res11.status}`);
  results.push("✅ PASS: TEST 11 — Nominal size non couvert par la spécification → INCOMPATIBLE");

  testsRun++;
  const res12 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    schedule: "SCH 10",
    dimensionalStandardId: "ASME-B36.10M",
  });
  assert(res12.status === "INCOMPATIBLE", `TEST 12: expected INCOMPATIBLE for mismatch schedule, got ${res12.status}`);
  results.push("✅ PASS: TEST 12 — Schedule non autorisé dans la spécification → INCOMPATIBLE");

  testsRun++;
  const res13 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FITTING",
    productStandardId: "ASME-B16.9",
    connectionType: "SOCKET_WELD",
  });
  assert(res13.status === "INCOMPATIBLE", `TEST 13: expected INCOMPATIBLE for connection mismatch, got ${res13.status}`);
  results.push("✅ PASS: TEST 13 — Connection type mismatch → INCOMPATIBLE");

  testsRun++;
  const res14 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FITTING",
    productStandardId: "ASME-B16.11",
  });
  assert(res14.status === "INCOMPATIBLE", `TEST 14: expected INCOMPATIBLE for product standard mismatch, got ${res14.status}`);
  results.push("✅ PASS: TEST 14 — Product standard mismatch → INCOMPATIBLE");

  testsRun++;
  const res15 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    dimensionalStandardId: "ASME-B36.19M",
  });
  assert(res15.status === "INCOMPATIBLE", `TEST 15: expected INCOMPATIBLE for dimensional std mismatch, got ${res15.status}`);
  results.push("✅ PASS: TEST 15 — Dimensional standard mismatch → INCOMPATIBLE");

  testsRun++;
  const res16 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FLANGE",
    productStandardId: "ASME-B16.5",
    ratingSystem: "EN_PN",
  });
  assert(res16.status === "INCOMPATIBLE", `TEST 16: expected INCOMPATIBLE for rating system mismatch, got ${res16.status}`);
  results.push("✅ PASS: TEST 16 — Rating system mismatch → INCOMPATIBLE");

  testsRun++;
  const res17 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_VERIFIED_01"],
  });
  assert(res17.status === "COMPATIBLE", `TEST 17: expected COMPATIBLE with verified evidence, got ${res17.status}`);
  results.push("✅ PASS: TEST 17 — Evidence VERIFIED correctement résolue → COMPATIBLE");

  testsRun++;
  const res18 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "SYNTHETIC_SPECIAL",
    evidenceIds: ["SYNTHETIC_EV_SPEC01_UNVERIFIED_01"],
  });
  assert(res18.status === "UNVERIFIED", `TEST 18: expected UNVERIFIED for unverified evidence, got ${res18.status}`);
  results.push("✅ PASS: TEST 18 — Evidence UNVERIFIED → UNVERIFIED");

  testsRun++;
  const res19 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "SYNTHETIC_MISSING",
    evidenceIds: ["NON_EXISTENT_EV_999"],
  });
  assert(res19.status === "UNVERIFIED", `TEST 19: expected UNVERIFIED for missing evidence, got ${res19.status}`);
  results.push("✅ PASS: TEST 19 — Evidence inexistante → UNVERIFIED");

  testsRun++;
  const res20a = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "SYNTHETIC_EXACT",
    nominalSize: "DN 50",
    ratingValue: "Class 150",
  });
  assert(res20a.status === "UNVERIFIED", `TEST 20a: expected UNVERIFIED without implicit conversion, got ${res20a.status}`);

  const res20b = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "SYNTHETIC_EXACT",
    nominalSize: "NPS 2",
    ratingValue: "PN 20",
  });
  assert(res20b.status === "UNVERIFIED", `TEST 20b: expected UNVERIFIED without implicit conversion, got ${res20b.status}`);
  results.push("✅ PASS: TEST 20 — Aucune conversion implicite (NPS != DN, Class != PN)");

  // =========================================================================
  // TESTS SPEC-01-FIX-01 (21 à 30)
  // =========================================================================
  testsRun++;
  const res21 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_UNVERIFIED_RULE",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    res21.status === "UNVERIFIED",
    `TEST 21 (FIX-01): UNVERIFIED spec rule must NEVER produce COMPATIBLE, got ${res21.status}`
  );
  results.push("✅ PASS: TEST 21 (FIX-01-1) — Règle Spec UNVERIFIED + compatibilité VERIFIED → UNVERIFIED");

  testsRun++;
  const res22 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res22.status === "COMPATIBLE", `TEST 22 (FIX-01): expected COMPATIBLE, got ${res22.status}`);
  results.push("✅ PASS: TEST 22 (FIX-01-2) — Règle Spec VERIFIED + compatibilité VERIFIED → COMPATIBLE");

  testsRun++;
  const res23 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_STAINLESS_STEEL",
  });
  assert(
    res23.status === "INCOMPATIBLE",
    `TEST 23 (FIX-01): component rule material restriction must override global spec list, expected INCOMPATIBLE, got ${res23.status}`
  );
  results.push("✅ PASS: TEST 23 (FIX-01-3) — Matériau globalement listé mais interdit par component rule → INCOMPATIBLE");

  testsRun++;
  const res24 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res24.status === "COMPATIBLE", `TEST 24 (FIX-01): expected COMPATIBLE, got ${res24.status}`);
  results.push("✅ PASS: TEST 24 (FIX-01-4) — Matériau autorisé globalement ET par component rule → COMPATIBLE");

  testsRun++;
  const res25 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_UNVERIFIED_RULE",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res25.status === "UNVERIFIED", `TEST 25 (FIX-01): expected UNVERIFIED, got ${res25.status}`);
  results.push("✅ PASS: TEST 25 (FIX-01-5) — Règle de composant sans preuve vérifiée → UNVERIFIED");

  testsRun++;
  const res26 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_MISSING_EV_RULE",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(res26.status === "UNVERIFIED", `TEST 26 (FIX-01): expected UNVERIFIED for missing evidence ID, got ${res26.status}`);
  results.push("✅ PASS: TEST 26 (FIX-01-6) — Règle de composant avec evidence ID inexistante → UNVERIFIED");

  testsRun++;
  const res27 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_CONFLICT_RULES",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
  });
  assert(res27.status === "INVALID", `TEST 27 (FIX-01): contradictory rules must yield INVALID, got ${res27.status}`);
  assert(
    res27.message !== undefined && res27.message.includes("NORMATIVE_RULE_CONFLICT"),
    "TEST 27 (FIX-01): message must explain conflict"
  );
  results.push("✅ PASS: TEST 27 (FIX-01-7) — Deux règles contradictoires applicables → INVALID avec diagnostic explicite");

  testsRun++;
  const res28 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_CONFLICT_RULES_REV",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
  });
  assert(
    res28.status === "INVALID",
    `TEST 28 (FIX-01): order inversion must maintain INVALID, got ${res28.status}`
  );
  results.push("✅ PASS: TEST 28 (FIX-01-8) — Ordre inversé des règles contradictoires → INVALID (indépendance prouvée)");

  testsRun++;
  const res29 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_EMPTY_RULES",
    componentType: "PIPE",
  });
  assert(res29.status === "UNVERIFIED", `TEST 29 (FIX-01): expected UNVERIFIED for 0 rules, got ${res29.status}`);
  results.push("✅ PASS: TEST 29 (FIX-01-9) — Aucune règle applicable → UNVERIFIED");

  testsRun++;
  const pipeOk = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  }).status === "COMPATIBLE";

  const fittingOk = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FITTING",
    productStandardId: "ASME-B16.9",
    fittingType: "ELBOW",
    connectionType: "BUTT_WELD",
  }).status === "COMPATIBLE";

  const flangeOk = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "FLANGE",
    productStandardId: "ASME-B16.5",
    ratingSystem: "ASME_CLASS",
    ratingValue: "Class 150",
  }).status === "COMPATIBLE";

  const valveOk = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "VALVE",
    productStandardId: "API-600",
    dimensionalStandardId: "ASME-B16.10",
    connectionType: "FLANGED",
  }).status === "COMPATIBLE";

  assert(pipeOk && fittingOk && flangeOk && valveOk, "TEST 30: all 4 component families must resolve cleanly");
  results.push("✅ PASS: TEST 30 (FIX-01-10) — Non-régression validée sur les 4 familles (PIPE, FITTING, FLANGE, VALVE)");

  // =========================================================================
  // TESTS SPÉCIFIQUES SPEC-01-FIX-02 (TESTS OBLIGATOIRES 1 à 10)
  // =========================================================================

  // TEST OBLIGATOIRE 1 & TEST 10 : Rule sans evidenceIds même si Spec a une preuve VERIFIED -> UNVERIFIED
  testsRun++;
  const resFix02T1 = resolver.resolve({
    specificationId: "SPEC_FIX02_NO_RULE_EVIDENCE",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02T1.status === "UNVERIFIED",
    `SPEC-01-FIX-02 TEST 1: Rule sans evidenceIds doit être UNVERIFIED, même si spec a VERIFIED evidence. Reçu: ${resFix02T1.status}`
  );
  assert(
    resFix02T1.status !== "COMPATIBLE",
    `SPEC-01-FIX-02 TEST 1: Interdit d'obtenir COMPATIBLE sans preuve sur la règle.`
  );
  results.push("✅ PASS: FIX-02 TEST 1 — Rule sans evidenceIds → UNVERIFIED (aucun héritage implicite de spec.evidenceIds)");

  // TEST OBLIGATOIRE 2 & TEST 9 : Rule avec evidenceIds VERIFIED -> COMPATIBLE
  testsRun++;
  const resFix02T2 = resolver.resolve({
    specificationId: "SPEC_FIX02_WITH_RULE_EVIDENCE",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02T2.status === "COMPATIBLE",
    `SPEC-01-FIX-02 TEST 2: Rule avec evidenceIds VERIFIED doit être COMPATIBLE. Reçu: ${resFix02T2.status}`
  );
  assert(
    resFix02T2.matchedRuleIds.includes("SYNTHETIC_PIPE_RULE_OK"),
    "SPEC-01-FIX-02 TEST 2: matchedRuleIds doit contenir SYNTHETIC_PIPE_RULE_OK"
  );
  assert(
    resFix02T2.evidenceIds.includes("SYNTHETIC_RULE_EVIDENCE"),
    "SPEC-01-FIX-02 TEST 2: evidenceIds doit contenir SYNTHETIC_RULE_EVIDENCE"
  );
  results.push("✅ PASS: FIX-02 TEST 2 / TEST 9 — Rule avec evidenceIds VERIFIED → COMPATIBLE (chemin nominal)");

  // TEST OBLIGATOIRE 3 : Rule avec evidenceIds mais evidence absente -> UNVERIFIED
  testsRun++;
  const resFix02T3 = resolver.resolve({
    specificationId: "SPEC_FIX02_MISSING_RULE_EVIDENCE",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02T3.status === "UNVERIFIED",
    `SPEC-01-FIX-02 TEST 3: Rule avec preuve inexistante doit être UNVERIFIED. Reçu: ${resFix02T3.status}`
  );
  results.push("✅ PASS: FIX-02 TEST 3 — Rule avec evidence absente du registre → UNVERIFIED");

  // TEST OBLIGATOIRE 4 : Deux règles équivalentes (RULE_A, RULE_B) -> pas de sélection par ordre, matchedRuleIds contient les deux
  testsRun++;
  const resFix02T4 = resolver.resolve({
    specificationId: "SPEC_FIX02_EQUIVALENT_RULES",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02T4.status === "COMPATIBLE",
    `SPEC-01-FIX-02 TEST 4: Deux règles équivalentes avec preuves vérifiées doivent être COMPATIBLE. Reçu: ${resFix02T4.status}`
  );
  assert(
    resFix02T4.matchedRuleIds.includes("SYNTHETIC_PIPE_RULE_A") &&
    resFix02T4.matchedRuleIds.includes("SYNTHETIC_PIPE_RULE_B"),
    `SPEC-01-FIX-02 TEST 4: matchedRuleIds doit contenir les deux règles [A, B]. Reçu: ${JSON.stringify(resFix02T4.matchedRuleIds)}`
  );
  assert(
    resFix02T4.evidenceIds.includes("SYNTHETIC_RULE_EVIDENCE_A") &&
    resFix02T4.evidenceIds.includes("SYNTHETIC_RULE_EVIDENCE_B"),
    `SPEC-01-FIX-02 TEST 4: evidenceIds doit agréger les preuves des deux règles. Reçu: ${JSON.stringify(resFix02T4.evidenceIds)}`
  );
  results.push("✅ PASS: FIX-02 TEST 4 — Deux règles équivalentes → conservation des deux ruleIds et agrégation des preuves");

  // TEST OBLIGATOIRE 5 : Deux règles contradictoires sur schedule (SCH 40 vs SCH 80) -> INVALID
  testsRun++;
  const resFix02T5 = resolver.resolve({
    specificationId: "SPEC_FIX02_CONFLICT_SCHEDULE",
    componentType: "PIPE",
    nominalSize: "2",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    // Contexte ambigu : pas de schedule spécifié
  });
  assert(
    resFix02T5.status === "INVALID",
    `SPEC-01-FIX-02 TEST 5: Contradiction sur schedule en contexte ambigu doit être INVALID. Reçu: ${resFix02T5.status}`
  );
  assert(
    resFix02T5.message !== undefined && resFix02T5.message.includes("NORMATIVE_RULE_CONFLICT"),
    `SPEC-01-FIX-02 TEST 5: Message doit indiquer NORMATIVE_RULE_CONFLICT. Reçu: ${resFix02T5.message}`
  );
  results.push("✅ PASS: FIX-02 TEST 5 — Deux règles contradictoires sur schedule (SCH 40 vs SCH 80) → INVALID");

  // TEST OBLIGATOIRE 6 : Inversion de l'ordre [RULE_A, RULE_B] vs [RULE_B, RULE_A] -> résultat strictement identique
  testsRun++;
  const resFix02T6a = resolver.resolve({
    specificationId: "SPEC_FIX02_EQUIVALENT_RULES",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  const resFix02T6b = resolver.resolve({
    specificationId: "SPEC_FIX02_EQUIVALENT_RULES_REV",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02T6a.status === resFix02T6b.status,
    `SPEC-01-FIX-02 TEST 6: Status doit être identique (${resFix02T6a.status} vs ${resFix02T6b.status})`
  );
  assert(
    JSON.stringify(resFix02T6a.matchedRuleIds) === JSON.stringify(resFix02T6b.matchedRuleIds),
    `SPEC-01-FIX-02 TEST 6: matchedRuleIds normalisés doivent être identiques (${JSON.stringify(resFix02T6a.matchedRuleIds)} vs ${JSON.stringify(resFix02T6b.matchedRuleIds)})`
  );
  assert(
    JSON.stringify(resFix02T6a.evidenceIds) === JSON.stringify(resFix02T6b.evidenceIds),
    `SPEC-01-FIX-02 TEST 6: evidenceIds normalisés doivent être identiques (${JSON.stringify(resFix02T6a.evidenceIds)} vs ${JSON.stringify(resFix02T6b.evidenceIds)})`
  );
  results.push("✅ PASS: FIX-02 TEST 6 — Invariance stricte par rapport à l'ordre des règles [A, B] vs [B, A]");

  // TEST OBLIGATOIRE 7 : Deux règles contradictoires sur matériau -> INVALID
  testsRun++;
  const resFix02T7 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_CONFLICT_RULES",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
  });
  assert(
    resFix02T7.status === "INVALID",
    `SPEC-01-FIX-02 TEST 7: Contradiction sur matériau doit être INVALID, non COMPATIBLE. Reçu: ${resFix02T7.status}`
  );
  assert(
    resFix02T7.message !== undefined && resFix02T7.message.includes("NORMATIVE_RULE_CONFLICT"),
    `SPEC-01-FIX-02 TEST 7: Message doit indiquer NORMATIVE_RULE_CONFLICT. Reçu: ${resFix02T7.message}`
  );
  results.push("✅ PASS: FIX-02 TEST 7 — Deux règles contradictoires sur matériau → INVALID");

  // TEST OBLIGATOIRE 8 : Deux règles contradictoires sur standard dimensionnel ou produit -> INVALID
  testsRun++;
  const resFix02T8 = resolver.resolve({
    specificationId: "SPEC_FIX02_CONFLICT_DIMSTD",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
    // Contexte ambigu sans dimensionalStandardId
  });
  assert(
    resFix02T8.status === "INVALID",
    `SPEC-01-FIX-02 TEST 8: Contradiction sur standard dimensionnel doit être INVALID. Reçu: ${resFix02T8.status}`
  );
  results.push("✅ PASS: FIX-02 TEST 8 — Deux règles contradictoires sur standard dimensionnel/produit → INVALID");

  // TEST 41 : Conflit sur rating de bride (ASME Class 150 vs Class 300) -> INVALID
  testsRun++;
  const resFix02FlangeConflict = resolver.resolve({
    specificationId: "SPEC_FIX02_FLANGE_CONFLICT_RATING",
    componentType: "FLANGE",
    productStandardId: "ASME-B16.5",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02FlangeConflict.status === "INVALID",
    `SPEC-01-FIX-02 TEST 41: Conflit rating de bride doit être INVALID. Reçu: ${resFix02FlangeConflict.status}`
  );
  results.push("✅ PASS: FIX-02 TEST 41 — Conflit de rating sur règles Brides → INVALID");

  // TEST 42 : Conflit sur standard produit de vanne (API-600 vs API-6D) -> INVALID
  testsRun++;
  const resFix02ValveConflict = resolver.resolve({
    specificationId: "SPEC_FIX02_VALVE_CONFLICT_STD",
    componentType: "VALVE",
    dimensionalStandardId: "ASME-B16.10",
    connectionType: "FLANGED",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02ValveConflict.status === "INVALID",
    `SPEC-01-FIX-02 TEST 42: Conflit standard produit vanne doit être INVALID. Reçu: ${resFix02ValveConflict.status}`
  );
  results.push("✅ PASS: FIX-02 TEST 42 — Conflit de standard produit sur règles Vannes → INVALID");

  // TEST 43 : Règles multiples équivalentes où une règle manque de preuve -> UNVERIFIED (A ne qualifie pas B)
  testsRun++;
  const resFix02OneUnverified = resolver.resolve({
    specificationId: "SPEC_FIX02_MULTI_ONE_UNVERIFIED",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix02OneUnverified.status === "UNVERIFIED",
    `SPEC-01-FIX-02 TEST 43: Une preuve de Rule A ne doit pas qualifier Rule B. Reçu: ${resFix02OneUnverified.status}`
  );
  results.push("✅ PASS: FIX-02 TEST 43 — Règles multiples dont une sans preuve → UNVERIFIED (isolation stricte inter-règles)");

  // =========================================================================
  // TESTS SPEC-01-FIX-03 (LIAISON DETERMINISTE SPEC RULE -> COMPAT RULE -> EVIDENCE)
  // =========================================================================

  // FIX-03 TEST 1 : Piping Spec Rule VERIFIED + Compatibility Rule VERIFIED mais incompatible -> INCOMPATIBLE avec traçabilité
  testsRun++;
  const resFix03T1 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "10",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix03T1.status === "INCOMPATIBLE",
    `SPEC-01-FIX-03 TEST 1: expected INCOMPATIBLE, got ${resFix03T1.status}`
  );
  assert(
    resFix03T1.matchedRuleIds.includes("SPEC_PIPE_RULE_01"),
    `SPEC-01-FIX-03 TEST 1: matchedRuleIds doit contenir la règle spec SPEC_PIPE_RULE_01. Reçu: ${JSON.stringify(resFix03T1.matchedRuleIds)}`
  );
  assert(
    resFix03T1.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_PIPE_INCOMPAT_FIX03"),
    `SPEC-01-FIX-03 TEST 1: compatibilityRuleIds doit tracer SYNTHETIC_COMPAT_PIPE_INCOMPAT_FIX03. Reçu: ${JSON.stringify(resFix03T1.compatibilityRuleIds)}`
  );
  results.push("✅ PASS: FIX-03 TEST 1 — Spec Rule VERIFIED + Compat Rule INCOMPATIBLE → INCOMPATIBLE avec traçabilité explicite");

  // FIX-03 TEST 2 : Piping Spec Rule VERIFIED + Compatibility Rule VERIFIED cohérente -> COMPATIBLE avec traçabilité 2 niveaux
  testsRun++;
  const resFix03T2 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "2",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix03T2.status === "COMPATIBLE",
    `SPEC-01-FIX-03 TEST 2: expected COMPATIBLE, got ${resFix03T2.status}`
  );
  assert(
    resFix03T2.matchedRuleIds.includes("SPEC_PIPE_RULE_01"),
    `SPEC-01-FIX-03 TEST 2: matchedRuleIds doit contenir SPEC_PIPE_RULE_01. Reçu: ${JSON.stringify(resFix03T2.matchedRuleIds)}`
  );
  assert(
    resFix03T2.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_RULE_PIPE_OK"),
    `SPEC-01-FIX-03 TEST 2: compatibilityRuleIds doit contenir SYNTHETIC_COMPAT_RULE_PIPE_OK. Reçu: ${JSON.stringify(resFix03T2.compatibilityRuleIds)}`
  );
  assert(
    resFix03T2.evidenceIds.includes("SYNTHETIC_EV_SPEC01_VERIFIED_01"),
    `SPEC-01-FIX-03 TEST 2: evidenceIds doit agréger les preuves des deux niveaux. Reçu: ${JSON.stringify(resFix03T2.evidenceIds)}`
  );
  results.push("✅ PASS: FIX-03 TEST 2 — Spec Rule VERIFIED + Compat Rule VERIFIED cohérente → COMPATIBLE (traçabilité matchedRuleIds / compatibilityRuleIds / evidenceIds)");

  // FIX-03 TEST 3 : Piping Spec Rule VERIFIED mais aucune Compatibility Rule applicable -> UNVERIFIED
  testsRun++;
  const resFix03T3 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "6",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix03T3.status === "UNVERIFIED",
    `SPEC-01-FIX-03 TEST 3: expected UNVERIFIED for missing compat rule, got ${resFix03T3.status}`
  );
  assert(
    resFix03T3.matchedRuleIds.includes("SPEC_PIPE_RULE_01"),
    `SPEC-01-FIX-03 TEST 3: matchedRuleIds doit contenir la règle spec. Reçu: ${JSON.stringify(resFix03T3.matchedRuleIds)}`
  );
  assert(
    resFix03T3.compatibilityRuleIds.length === 0,
    `SPEC-01-FIX-03 TEST 3: compatibilityRuleIds doit être vide. Reçu: ${JSON.stringify(resFix03T3.compatibilityRuleIds)}`
  );
  results.push("✅ PASS: FIX-03 TEST 3 — Spec Rule VERIFIED mais absence de Compat Rule → UNVERIFIED");

  // FIX-03 TEST 4 : Piping Spec Rule VERIFIED mais Compatibility Rule applicable UNVERIFIED -> UNVERIFIED
  testsRun++;
  const resFix03T4 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "8",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix03T4.status === "UNVERIFIED",
    `SPEC-01-FIX-03 TEST 4: expected UNVERIFIED for unverified compat rule evidence, got ${resFix03T4.status}`
  );
  assert(
    resFix03T4.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_PIPE_UNVERIFIED_EV_FIX03"),
    `SPEC-01-FIX-03 TEST 4: compatibilityRuleIds doit tracer la règle non vérifiée. Reçu: ${JSON.stringify(resFix03T4.compatibilityRuleIds)}`
  );
  results.push("✅ PASS: FIX-03 TEST 4 — Spec Rule VERIFIED mais Compat Rule UNVERIFIED → UNVERIFIED");

  // FIX-03 TEST 5 : Deux Compatibility Rules applicables contradictoires (COMPATIBLE vs INCOMPATIBLE) -> INVALID avec NORMATIVE_RULE_CONFLICT
  testsRun++;
  const resFix03T5 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "3",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix03T5.status === "INVALID",
    `SPEC-01-FIX-03 TEST 5: Contradiction entre règles de compatibilité doit être INVALID. Reçu: ${resFix03T5.status}`
  );
  assert(
    resFix03T5.message !== undefined && resFix03T5.message.includes("NORMATIVE_RULE_CONFLICT"),
    `SPEC-01-FIX-03 TEST 5: message doit contenir NORMATIVE_RULE_CONFLICT. Reçu: ${resFix03T5.message}`
  );
  results.push("✅ PASS: FIX-03 TEST 5 — Deux Compat Rules contradictoires → INVALID avec diagnostic NORMATIVE_RULE_CONFLICT");

  // FIX-03 TEST 6 : Deux Compatibility Rules applicables équivalentes -> COMPATIBLE avec compatibilityRuleIds = [A, B] (trié)
  testsRun++;
  const resFix03T6 = resolver.resolve({
    specificationId: "SYNTHETIC_SPEC_001",
    componentType: "PIPE",
    nominalSize: "4",
    schedule: "SCH 40",
    dimensionalStandardId: "ASME-B36.10M",
    materialId: "SYNTHETIC_MAT_CARBON_STEEL",
  });
  assert(
    resFix03T6.status === "COMPATIBLE",
    `SPEC-01-FIX-03 TEST 6: Deux règles compat équivalentes doivent donner COMPATIBLE. Reçu: ${resFix03T6.status}`
  );
  assert(
    resFix03T6.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_EQUIV_A_FIX03") &&
    resFix03T6.compatibilityRuleIds.includes("SYNTHETIC_COMPAT_EQUIV_B_FIX03"),
    `SPEC-01-FIX-03 TEST 6: compatibilityRuleIds doit contenir [A, B]. Reçu: ${JSON.stringify(resFix03T6.compatibilityRuleIds)}`
  );
  assert(
    resFix03T6.compatibilityRuleIds[0] === "SYNTHETIC_COMPAT_EQUIV_A_FIX03" &&
    resFix03T6.compatibilityRuleIds[1] === "SYNTHETIC_COMPAT_EQUIV_B_FIX03",
    `SPEC-01-FIX-03 TEST 6: compatibilityRuleIds doit être trié par ordre alphabétique. Reçu: ${JSON.stringify(resFix03T6.compatibilityRuleIds)}`
  );
  assert(
    resFix03T6.evidenceIds.includes("SYNTHETIC_RULE_EVIDENCE_A") &&
    resFix03T6.evidenceIds.includes("SYNTHETIC_RULE_EVIDENCE_B"),
    `SPEC-01-FIX-03 TEST 6: evidenceIds doit agréger les preuves vérifiées. Reçu: ${JSON.stringify(resFix03T6.evidenceIds)}`
  );
  results.push("✅ PASS: FIX-03 TEST 6 — Deux Compat Rules équivalentes → COMPATIBLE avec compatibilityRuleIds = [A, B] trié");

  return {
    success: true,
    testsRun,
    results,
  };
}
