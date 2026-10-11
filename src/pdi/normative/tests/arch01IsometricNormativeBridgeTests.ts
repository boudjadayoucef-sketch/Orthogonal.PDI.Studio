/**
 * PDI NORMATIVE ENGINE — ARCH-01 ISOMETRIC NORMATIVE BRIDGE TESTS
 * Reference: ARCH-01 (Architectural Unification & Normative Bridge)
 *
 * Dedicated test suite verifying the explicit architectural bridge between
 * the Isometric Editor (IsoNode / IsoSegment / IsoFitting / PdiUniversalEntity)
 * and the Normative Engine (PipingSpecResolver, NormativeCompatibilityEngine,
 * NormativeEvidenceResolver, NormativeEvidenceTraceabilityEngine).
 *
 * Covers mandatory ARCH-01 scenarios (Tests 1 through 15+):
 *  - Test 1:  IsoNode properly structured -> accurate IsometricNormativeContext
 *  - Test 2:  Missing material -> UNVERIFIED
 *  - Test 3:  Missing pressure rating -> UNVERIFIED
 *  - Test 4:  Missing or unregistered Piping Spec -> UNVERIFIED
 *  - Test 5:  Present Piping Spec + VERIFIED rule + VERIFIED compatibility -> COMPATIBLE
 *  - Test 6:  UNVERIFIED Piping Spec + independent VERIFIED compatibility -> must NOT produce COMPATIBLE
 *  - Test 7:  INCOMPATIBLE compatibility rule -> INCOMPATIBLE
 *  - Test 8:  Contradictory VERIFIED rules (Conflict) -> INVALID
 *  - Test 9:  NPS/DN mismatch -> no automatic conversion
 *  - Test 10: Class/PN mismatch -> no automatic conversion
 *  - Test 11: Missing evidence -> UNVERIFIED
 *  - Test 12: UNVERIFIED evidence -> UNVERIFIED
 *  - Test 13: Full provenance traceability preserved (ENTITY -> RULE -> VERIFIED VALUE -> EVIDENCE -> SPEC / STANDARD / EDITION / CLAUSE)
 *  - Test 14: Source IsoNode / IsoSegment object remains strictly unmodified (immutability)
 *  - Test 15: Legacy PMS (`pdiClassePression017K3`) never acts as a second independent normative authority and conflicts are surfaced
 */

import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { NormativeEvidenceTraceabilityEngine } from "../engine/normativeEvidenceTraceabilityEngine";
import {
  adaptIsoNodeToNormativeContext,
  adaptIsoSegmentToNormativeContext,
} from "../integration/isometricNormativeAdapter";
import { IsometricNormativeBridge } from "../integration/isometricNormativeBridge";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { NormativeVerifiedValue } from "../types/normativeEvidenceTypes";
import type { IsoNode, IsoSegment } from "../../isometric/types/isoGraphTypes";

export interface Arch01BridgeTestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-01 ASSERTION FAILED] ${message}`);
  }
}

export function runArch01IsometricNormativeBridgeTests(): Arch01BridgeTestResult {
  const results: string[] = [];
  const failures: string[] = [];
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  function runTest(testName: string, fn: () => void): void {
    testsRun++;
    try {
      fn();
      testsPassed++;
      results.push(`[PASS] ${testName}`);
    } catch (err: unknown) {
      testsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`[FAIL] ${testName} — ${msg}`);
      failures.push(`${testName}: ${msg}`);
    }
  }

  // =========================================================================
  // SYNTHETIC FIXTURE SETUP (ISOLATED REGISTRIES, NO REAL NORMATIVE DATA)
  // =========================================================================
  const evRegistry = new NormativeEvidenceRegistry();

  evRegistry.register({
    evidenceId: "SYN_EV_ARCH01_SPEC_RULE_01",
    standardId: "SYN_STD_PIPING_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "SYN_CLAUSE_302_1",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_SPEC_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_01",
    verifiedAt: "2026-01-15T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYN_EV_ARCH01_COMPAT_RULE_01",
    standardId: "SYN_STD_COMPAT_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "SYN_CLAUSE_404_2",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_COMPAT_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_01",
    verifiedAt: "2026-01-15T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYN_EV_ARCH01_UNVERIFIED_01",
    standardId: "SYN_STD_PIPING_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "SYN_CLAUSE_DRAFT_99",
    sourceType: "LEGACY_REFERENCE",
    sourceReference: "SYN_DOC_DRAFT_99",
    verificationStatus: "UNVERIFIED",
  });

  const evidenceResolver = new NormativeEvidenceResolver(evRegistry);
  const compatRegistry = new NormativeCompatibilityRegistry();

  // Verified COMPATIBLE rule for SYN_SPEC_VERIFIED_01
  compatRegistry.register({
    ruleId: "SYN_COMPAT_RULE_OK_01",
    description: "Synthetic verified compatible rule for VALVE in SYN_SPEC_VERIFIED_01",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_100",
    pressureRating: "SYN_RATING_300",
    materialId: "SYN_MAT_ALLOY_A",
    pipingSpecId: "SYN_SPEC_VERIFIED_01",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH01_COMPAT_RULE_01"],
  });

  // Independent global COMPATIBLE rule (not tied to a verified spec rule) for Test 6
  compatRegistry.register({
    ruleId: "SYN_COMPAT_RULE_GLOBAL_INDEPENDENT",
    description: "Synthetic global compatibility rule",
    componentType: "PIPE",
    nominalSize: "SYN_SIZE_100",
    pressureRating: "SYN_RATING_150",
    materialId: "SYN_MAT_ALLOY_A",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH01_COMPAT_RULE_01"],
  });

  // Verified INCOMPATIBLE rule for Test 7
  compatRegistry.register({
    ruleId: "SYN_COMPAT_RULE_INCOMPAT_01",
    description: "Synthetic verified incompatible rule for forbidden rating/material pair",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_100",
    pressureRating: "SYN_RATING_FORBIDDEN",
    materialId: "SYN_MAT_ALLOY_A",
    pipingSpecId: "SYN_SPEC_VERIFIED_01",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH01_COMPAT_RULE_01"],
  });

  // Contradictory VERIFIED rules (COMPATIBLE + INCOMPATIBLE on same context) for Test 8
  compatRegistry.register({
    ruleId: "SYN_COMPAT_RULE_CONFLICT_POS",
    description: "Synthetic conflicting rule positive",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_CONFLICT",
    pressureRating: "SYN_RATING_300",
    materialId: "SYN_MAT_ALLOY_A",
    pipingSpecId: "SYN_SPEC_VERIFIED_01",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH01_COMPAT_RULE_01"],
  });

  compatRegistry.register({
    ruleId: "SYN_COMPAT_RULE_CONFLICT_NEG",
    description: "Synthetic conflicting rule negative",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_CONFLICT",
    pressureRating: "SYN_RATING_300",
    materialId: "SYN_MAT_ALLOY_A",
    pipingSpecId: "SYN_SPEC_VERIFIED_01",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH01_COMPAT_RULE_01"],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evidenceResolver);

  const syntheticVerifiedSpec: PipingSpecification = {
    id: "SYN_SPEC_VERIFIED_01",
    code: "SYN_SPEC_VERIFIED_01",
    name: "Synthetic Verified Specification 01",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_ALLOY_A"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_01",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_ALLOY_A",
        schedule: "SYN_SCH_01",
        nominalSizes: ["SYN_SIZE_100"],
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH01_SPEC_RULE_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [
      {
        ruleId: "SYN_SPEC_FLANGE_RULE_01",
        flangeStandardId: "SYN_FLANGE_STD_01" as any,
        materialId: "SYN_MAT_ALLOY_A",
        ratingSystem: "SYN_SYSTEM_A" as any,
        rating: "SYN_RATING_300",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH01_SPEC_RULE_01"],
      },
    ],
    valveRules: [
      {
        ruleId: "SYN_SPEC_VALVE_RULE_01",
        productStandardId: "SYN_VALVE_STD_01" as any,
        materialId: "SYN_MAT_ALLOY_A",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH01_SPEC_RULE_01"],
      },
    ],
    sourceStatus: "VERIFIED",
    evidenceIds: ["SYN_EV_ARCH01_SPEC_RULE_01"],
  };

  const syntheticUnverifiedRuleSpec: PipingSpecification = {
    id: "SYN_SPEC_UNVERIFIED_RULE_01",
    code: "SYN_SPEC_UNVERIFIED_RULE_01",
    name: "Synthetic Spec With Unverified Rule",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_ALLOY_A"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_UNVERIFIED",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_ALLOY_A",
        nominalSizes: ["SYN_SIZE_100"],
        sourceStatus: "UNVERIFIED",
        evidenceIds: ["SYN_EV_ARCH01_UNVERIFIED_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  const syntheticMissingEvidenceSpec: PipingSpecification = {
    id: "SYN_SPEC_NO_EVIDENCE_01",
    code: "SYN_SPEC_NO_EVIDENCE_01",
    name: "Synthetic Spec With Missing Rule Evidence",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_ALLOY_A"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_NO_EV",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_ALLOY_A",
        nominalSizes: ["SYN_SIZE_100"],
        sourceStatus: "VERIFIED",
        evidenceIds: [],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  const syntheticUnverifiedEvidenceSpec: PipingSpecification = {
    id: "SYN_SPEC_UNVERIFIED_EV_01",
    code: "SYN_SPEC_UNVERIFIED_EV_01",
    name: "Synthetic Spec With Unverified Evidence Record",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_ALLOY_A"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_UNV_EV",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_ALLOY_A",
        nominalSizes: ["SYN_SIZE_100"],
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH01_UNVERIFIED_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "VERIFIED",
  };

  const bridge = new IsometricNormativeBridge({
    specLookup: [
      syntheticVerifiedSpec,
      syntheticUnverifiedRuleSpec,
      syntheticMissingEvidenceSpec,
      syntheticUnverifiedEvidenceSpec,
    ],
    compatibilityEngine: compatEngine,
    evidenceResolver,
    traceabilityEngine: new NormativeEvidenceTraceabilityEngine(),
  });

  // =========================================================================
  // TEST 1: IsoNode correctement structuré → contexte normatif correct
  // =========================================================================
  runTest("TEST 1 [ARCH-01]: IsoNode correctement structuré → contexte normatif correct", () => {
    const node: IsoNode = {
      id: "NODE_VALVE_01",
      name: "Vanne Test",
      x: 10,
      y: 20,
      z: 5,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 100,
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      schedule: "SYN_SCH_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
        dimensionalStandard: "SYN_DIM_STD_01",
        productStandard: "SYN_VALVE_STD_01",
        connectionType: "SYN_CONN_BW",
      },
    };

    const ctx = adaptIsoNodeToNormativeContext(node);
    assert(ctx.entityId === "NODE_VALVE_01", "entityId doit correspondre à node.id");
    assert(ctx.componentType === "VALVE", "componentType doit être résolu en VALVE");
    assert(ctx.nominalSize === "SYN_SIZE_100", "nominalSize doit être extrait sans conversion");
    assert(ctx.pressureRating === "SYN_RATING_300", "pressureRating doit correspondre à node.pn");
    assert(ctx.materialId === "SYN_MAT_ALLOY_A", "materialId doit correspondre à node.material");
    assert(ctx.pipingSpecId === "SYN_SPEC_VERIFIED_01", "pipingSpecId doit correspondre à node.spec");
    assert(ctx.schedule === "SYN_SCH_01", "schedule doit correspondre à node.schedule");
    assert(ctx.dimensionalStandard === "SYN_DIM_STD_01", "dimensionalStandard doit être extrait");
    assert(ctx.productStandard === "SYN_VALVE_STD_01", "productStandard doit être extrait");
    assert(ctx.connectionType === "SYN_CONN_BW", "connectionType doit être extrait");
    assert(!("x" in ctx) && !("y" in ctx) && !("z" in ctx), "La géométrie ne doit pas polluer le contexte normatif");
  });

  // =========================================================================
  // TEST 2: Matériau absent → UNVERIFIED
  // =========================================================================
  runTest("TEST 2 [ARCH-01]: Matériau absent → UNVERIFIED", () => {
    const node: IsoNode = {
      id: "NODE_NO_MATERIAL",
      name: "Vanne Sans Matériau",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decision = bridge.checkNode(node);
    assert(decision.status === "UNVERIFIED", `Attendu UNVERIFIED, reçu ${decision.status}`);
    assert(decision.message.includes("MISSING_MATERIAL"), "Le diagnostic doit indiquer MISSING_MATERIAL");
  });

  // =========================================================================
  // TEST 3: Rating absent → UNVERIFIED
  // =========================================================================
  runTest("TEST 3 [ARCH-01]: Rating absent → UNVERIFIED", () => {
    const node: IsoNode = {
      id: "NODE_NO_RATING",
      name: "Vanne Sans Rating",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decision = bridge.checkNode(node);
    assert(decision.status === "UNVERIFIED", `Attendu UNVERIFIED, reçu ${decision.status}`);
    assert(decision.message.includes("MISSING_PRESSURE_RATING"), "Le diagnostic doit indiquer MISSING_PRESSURE_RATING");
  });

  // =========================================================================
  // TEST 4: Piping Spec absente → UNVERIFIED
  // =========================================================================
  runTest("TEST 4 [ARCH-01]: Piping Spec absente ou inconnue → UNVERIFIED", () => {
    const nodeNoSpec: IsoNode = {
      id: "NODE_NO_SPEC",
      name: "Vanne Sans Spec",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decisionAbsent = bridge.checkNode(nodeNoSpec);
    assert(decisionAbsent.status === "UNVERIFIED", `Attendu UNVERIFIED quand spec absente, reçu ${decisionAbsent.status}`);
    assert(decisionAbsent.message.includes("MISSING_PIPING_SPEC"), "Le diagnostic doit indiquer MISSING_PIPING_SPEC");

    const nodeUnknownSpec: IsoNode = {
      ...nodeNoSpec,
      id: "NODE_UNKNOWN_SPEC",
      spec: "SYN_SPEC_DOES_NOT_EXIST",
    };

    const decisionUnknown = bridge.checkNode(nodeUnknownSpec);
    assert(decisionUnknown.status === "UNVERIFIED", `Attendu UNVERIFIED quand spec inconnue, reçu ${decisionUnknown.status}`);
    assert(decisionUnknown.message.includes("PIPING_SPEC_NOT_FOUND"), "Le diagnostic doit indiquer PIPING_SPEC_NOT_FOUND");
  });

  // =========================================================================
  // TEST 5: Piping Spec présente + règle vérifiée + compatibility VERIFIED → COMPATIBLE
  // =========================================================================
  runTest("TEST 5 [ARCH-01]: Piping Spec présente + règle vérifiée + compatibility VERIFIED → COMPATIBLE", () => {
    const node: IsoNode = {
      id: "NODE_COMPATIBLE_01",
      name: "Vanne Compatible",
      x: 1,
      y: 2,
      z: 3,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const decision = bridge.checkNode(node);
    assert(decision.status === "COMPATIBLE", `Attendu COMPATIBLE, reçu ${decision.status} (${decision.message})`);
    assert(decision.specRuleIds.includes("SYN_SPEC_VALVE_RULE_01"), "specRuleIds doit contenir SYN_SPEC_VALVE_RULE_01");
    assert(decision.compatibilityRuleIds.includes("SYN_COMPAT_RULE_OK_01"), "compatibilityRuleIds doit contenir SYN_COMPAT_RULE_OK_01");
    assert(decision.evidenceIds.includes("SYN_EV_ARCH01_SPEC_RULE_01"), "evidenceIds doit contenir SYN_EV_ARCH01_SPEC_RULE_01");
    assert(decision.evidenceIds.includes("SYN_EV_ARCH01_COMPAT_RULE_01"), "evidenceIds doit contenir SYN_EV_ARCH01_COMPAT_RULE_01");
  });

  // =========================================================================
  // TEST 6: Piping Spec non vérifiée + compatibility indépendante VERIFIED → ne doit PAS produire COMPATIBLE
  // =========================================================================
  runTest("TEST 6 [ARCH-01]: Piping Spec non vérifiée + compatibility indépendante VERIFIED → UNVERIFIED", () => {
    const segment: IsoSegment = {
      id: "SEG_UNVERIFIED_SPEC_RULE",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "SYN_RATING_150",
      material: "SYN_MAT_ALLOY_A",
      length: 5,
      type: "straight",
      fittings: [],
      spec: "SYN_SPEC_UNVERIFIED_RULE_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
        dimensionalStandard: "SYN_DIM_STD_01",
      },
    };

    const decision = bridge.checkSegment(segment);
    assert(decision.status !== "COMPATIBLE", "Ne doit JAMAIS produire COMPATIBLE si la règle Piping Spec est non vérifiée");
    assert(decision.status === "UNVERIFIED", `Attendu UNVERIFIED, reçu ${decision.status}`);
  });

  // =========================================================================
  // TEST 7: Compatibility INCOMPATIBLE → INCOMPATIBLE
  // =========================================================================
  runTest("TEST 7 [ARCH-01]: Compatibility INCOMPATIBLE → INCOMPATIBLE", () => {
    const node: IsoNode = {
      id: "NODE_INCOMPATIBLE_01",
      name: "Vanne Incompatible",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_FORBIDDEN",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decision = bridge.checkNode(node);
    assert(decision.status === "INCOMPATIBLE", `Attendu INCOMPATIBLE, reçu ${decision.status}`);
    assert(decision.compatibilityRuleIds.includes("SYN_COMPAT_RULE_INCOMPAT_01"), "Doit tracer la règle incompatible");
  });

  // =========================================================================
  // TEST 8: Conflit VERIFIED → INVALID
  // =========================================================================
  runTest("TEST 8 [ARCH-01]: Conflit entre règles VERIFIED contradictoires → INVALID", () => {
    const node: IsoNode = {
      id: "NODE_CONFLICT_01",
      name: "Vanne Conflit",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_CONFLICT",
      },
    };

    const decision = bridge.checkNode(node);
    assert(decision.status === "INVALID", `Attendu INVALID sur conflit vérifié, reçu ${decision.status}`);
    assert(decision.conflictCodes.includes("NORMATIVE_RULE_CONFLICT"), "Doit contenir le code NORMATIVE_RULE_CONFLICT");
  });

  // =========================================================================
  // TEST 9: NPS/DN incompatible → pas de conversion automatique
  // =========================================================================
  runTest("TEST 9 [ARCH-01]: NPS/DN incompatible → aucune conversion automatique", () => {
    // La spec autorise uniquement "SYN_SIZE_100", on passe "SYN_NPS_4"
    const segment: IsoSegment = {
      id: "SEG_NPS_DN_MISMATCH",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      length: 2,
      type: "straight",
      fittings: [],
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_NPS_4",
      },
    };

    const ctx = adaptIsoSegmentToNormativeContext(segment);
    assert(ctx.nominalSize === "SYN_NPS_4", "L'adapter doit préserver la chaîne exacte sans conversion");

    const decision = bridge.checkSegment(segment);
    assert(decision.status === "INCOMPATIBLE", `Attendu INCOMPATIBLE sur mismatch NPS/DN sans conversion, reçu ${decision.status}`);
    assert(decision.conflictCodes.includes("NOMINAL_SIZE_MISMATCH"), "Doit signaler NOMINAL_SIZE_MISMATCH");
  });

  // =========================================================================
  // TEST 10: Class/PN incompatible → pas de conversion automatique
  // =========================================================================
  runTest("TEST 10 [ARCH-01]: Class/PN incompatible → aucune conversion automatique", () => {
    // La règle de bride de SYN_SPEC_VERIFIED_01 exige rating = "SYN_RATING_300"
    // On fournit "SYN_PN_50"
    const flangeNode: IsoNode = {
      id: "NODE_FLANGE_CLASS_PN_MISMATCH",
      name: "Bride PN au lieu de Class",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "bride_wn",
      pn: "SYN_PN_50",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const ctx = adaptIsoNodeToNormativeContext(flangeNode);
    assert(ctx.pressureRating === "SYN_PN_50", "L'adapter ne doit jamais convertir PN en Class");

    const decision = bridge.checkNode(flangeNode);
    assert(decision.status === "INCOMPATIBLE", `Attendu INCOMPATIBLE sur mismatch Class/PN, reçu ${decision.status}`);
    assert(decision.conflictCodes.includes("RATING_VALUE_MISMATCH"), "Doit signaler RATING_VALUE_MISMATCH");
  });

  // =========================================================================
  // TEST 11: Evidence absente → UNVERIFIED
  // =========================================================================
  runTest("TEST 11 [ARCH-01]: Evidence absente → UNVERIFIED", () => {
    const segment: IsoSegment = {
      id: "SEG_NO_EVIDENCE",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "SYN_RATING_150",
      material: "SYN_MAT_ALLOY_A",
      length: 3,
      type: "straight",
      fittings: [],
      spec: "SYN_SPEC_NO_EVIDENCE_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decision = bridge.checkSegment(segment);
    assert(decision.status === "UNVERIFIED", `Attendu UNVERIFIED quand evidence absente, reçu ${decision.status}`);
  });

  // =========================================================================
  // TEST 12: Evidence UNVERIFIED → UNVERIFIED
  // =========================================================================
  runTest("TEST 12 [ARCH-01]: Evidence UNVERIFIED → UNVERIFIED", () => {
    const segment: IsoSegment = {
      id: "SEG_UNVERIFIED_EVIDENCE",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "SYN_RATING_150",
      material: "SYN_MAT_ALLOY_A",
      length: 3,
      type: "straight",
      fittings: [],
      spec: "SYN_SPEC_UNVERIFIED_EV_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decision = bridge.checkSegment(segment);
    assert(decision.status === "UNVERIFIED", `Attendu UNVERIFIED quand evidence est UNVERIFIED, reçu ${decision.status}`);
  });

  // =========================================================================
  // TEST 13: Traceability conservée (ENTITY -> RULE -> VERIFIED VALUE -> EVIDENCE -> SPEC / STANDARD / EDITION / CLAUSE)
  // =========================================================================
  runTest("TEST 13 [ARCH-01]: Traceability complète conservée de l'entité jusqu'à la clause normative", () => {
    const node: IsoNode = {
      id: "NODE_TRACE_01",
      name: "Vanne Traçable",
      x: 4,
      y: 5,
      z: 6,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const verifiedValues: NormativeVerifiedValue<number>[] = [
      {
        value: 300,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH01_SPEC_RULE_01"],
        sourceReference: "SYN_VV_ALLOWABLE_01",
      },
    ];

    const decision = bridge.checkNode(node, { verifiedValues });
    assert(decision.status === "COMPATIBLE", "Décision doit être COMPATIBLE");
    assert(decision.traceability.entityId === "NODE_TRACE_01", "Traceability entityId conservé");
    assert(decision.traceability.pipingSpecId === "SYN_SPEC_VERIFIED_01", "Traceability pipingSpecId conservé");
    assert(decision.traceability.designCodeId === "SYN_DESIGN_CODE_01", "Traceability designCodeId conservé");
    assert(decision.traceability.specRuleIds.includes("SYN_SPEC_VALVE_RULE_01"), "Spec rule tracée");
    assert(decision.traceability.compatibilityRuleIds.includes("SYN_COMPAT_RULE_OK_01"), "Compatibility rule tracée");
    assert(decision.traceability.verifiedValues.length === 1, "VerifiedValue tracée");
    assert(decision.traceability.verifiedValues[0].value === 300, "Valeur vérifiée conservée");
    assert(decision.traceability.evidenceChain.length === 2, "2 enregistrements d'évidence dans la chaîne");
    const specEvItem = decision.traceability.evidenceChain.find(
      (item) => item.evidenceId === "SYN_EV_ARCH01_SPEC_RULE_01"
    );
    assert(specEvItem !== undefined, "L'item d'évidence SYN_EV_ARCH01_SPEC_RULE_01 doit être présent");
    assert(specEvItem!.standardId === "SYN_STD_PIPING_01", "Standard tracé");
    assert(specEvItem!.editionId === "SYN_EDITION_2026", "Edition tracée");
    assert(specEvItem!.clauseReference === "SYN_CLAUSE_302_1", "Clause tracée");
    assert(specEvItem!.verifiedValues.length === 1, "VerifiedValue rattachée à son évidence");
    assert(decision.traceability.traceabilityLock.valid === true, "Le verrou NORM-14-10 doit être valide");
  });

  // =========================================================================
  // TEST 14: Aucune modification de l'objet IsoNode source
  // =========================================================================
  runTest("TEST 14 [ARCH-01]: Aucune modification de l'objet IsoNode source (Immutabilité stricte)", () => {
    const sourceNode: IsoNode = Object.freeze({
      id: "NODE_IMMUTABLE_01",
      name: "Vanne Immuable",
      x: 12.5,
      y: -4.2,
      z: 1.8,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 100,
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: Object.freeze({
        nominalSize: "SYN_SIZE_100",
      }),
    });

    const snapshotBefore = JSON.stringify(sourceNode);
    const decision = bridge.checkNode(sourceNode);
    const snapshotAfter = JSON.stringify(sourceNode);

    assert(snapshotBefore === snapshotAfter, "L'objet IsoNode source ne doit subir aucune mutation");
    assert(decision.status === "COMPATIBLE", "L'évaluation sur objet gelé doit réussir");
  });

  // =========================================================================
  // TEST 15: Legacy PMS ne devient pas une seconde décision normative indépendante
  // =========================================================================
  runTest("TEST 15 [ARCH-01]: Legacy PMS ne devient pas une seconde décision normative indépendante et signale les conflits", () => {
    const legacySetup = {
      specs: [
        {
          code: "SYN_SPEC_VERIFIED_01",
          material: "SYN_MAT_ALLOY_A",
          pressureClass: "SYN_RATING_300",
          minDn: 15,
          maxDn: 600,
        },
      ],
    };

    // Cas A : Le moteur normatif retourne UNVERIFIED (ex: matériau absent sur le nœud),
    // même si la classe correspond au Legacy PMS -> ne doit JAMAIS devenir COMPATIBLE
    const unverifiedNode: IsoNode = {
      id: "NODE_LEGACY_NO_PROMOTE",
      name: "Vanne Non Vérifiée",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decUnverified = bridge.checkNode(unverifiedNode, { legacyProjectSetup: legacySetup });
    assert(decUnverified.status === "UNVERIFIED", "Legacy PMS ne doit jamais promouvoir UNVERIFIED en COMPATIBLE");

    // Cas B : Le moteur normatif retourne COMPATIBLE, mais le Legacy PMS attend une autre classe ("SYN_RATING_150")
    // -> Décision normative COMPATIBLE conservée, conflit explicite LEGACY_PMS_NORMATIVE_CONFLICT détecté
    const conflictingLegacySetup = {
      specs: [
        {
          code: "SYN_SPEC_VERIFIED_01",
          material: "SYN_MAT_ALLOY_A",
          pressureClass: "SYN_RATING_150",
          minDn: 15,
          maxDn: 600,
        },
      ],
    };

    const compatibleNode: IsoNode = {
      id: "NODE_LEGACY_CONFLICT",
      name: "Vanne Conflit Legacy",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_RATING_300",
      material: "SYN_MAT_ALLOY_A",
      spec: "SYN_SPEC_VERIFIED_01",
      specificProps: {
        nominalSize: "SYN_SIZE_100",
      },
    };

    const decConflict = bridge.checkNode(compatibleNode, {
      legacyProjectSetup: conflictingLegacySetup,
    });
    assert(decConflict.status === "COMPATIBLE", `Attendu COMPATIBLE (Normative Authority) sur conflit Legacy/Normatif, reçu ${decConflict.status}`);
    assert(
      decConflict.conflictCodes.includes("LEGACY_PMS_NORMATIVE_CONFLICT"),
      "Doit inclure LEGACY_PMS_NORMATIVE_CONFLICT dans conflictCodes"
    );
    assert(
      decConflict.legacyPmsComparison?.hasConflict === true,
      "legacyPmsComparison.hasConflict doit être true"
    );
  });

  return Object.freeze({
    success: testsFailed === 0 && testsRun >= 15,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
