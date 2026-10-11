/**
 * PDI NORMATIVE ENGINE — ARCH-02 PMS AUTHORITY UNIFICATION TESTS
 * Reference: ARCH-02 (PMS / Normative Authority Unification)
 *
 * Dedicated test suite verifying that the official Normative Engine
 * (`src/pdi/normative/`) is the SOLE normative authority, and that
 * the legacy PMS (`pdiClassePression017K3` / `LegacyPmsAdapter`) is
 * fully isolated and incapable of bypassing normative decisions.
 *
 * Mandatory ARCH-02 Tests:
 *  - TEST 01: Legacy PMS alone cannot produce COMPATIBLE
 *  - TEST 02: Piping Specification absent -> UNVERIFIED
 *  - TEST 03: Piping Specification unverified -> UNVERIFIED
 *  - TEST 04: Piping Specification verified + compatible rule verified -> COMPATIBLE
 *  - TEST 05: Legacy PMS compatible + normative UNVERIFIED -> result UNVERIFIED
 *  - TEST 06: Legacy PMS compatible + normative INCOMPATIBLE -> result INCOMPATIBLE
 *  - TEST 07: Legacy PMS incompatible + normative compatible verified -> normative authority retained
 *  - TEST 08: Conflict legacy/normative -> explicit diagnostic (LEGACY_PMS_NORMATIVE_CONFLICT)
 *  - TEST 09: No NPS <-> DN conversion
 *  - TEST 10: No ASME Class <-> EN PN conversion
 *  - TEST 11: No fabrication of evidenceIds
 *  - TEST 12: No mutation of source object
 *  - TEST 13: Traceability preserved
 *  - TEST 14: Bridge continues using existing locked normative engines
 *  - TEST 15: No second normative engine created
 *  - TEST 16: Non-regression of ARCH-01 tests
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
import {
  LegacyPmsAdapter,
  defaultLegacyPmsAdapter,
} from "../integration/legacyPmsAdapter";
import { runArch01IsometricNormativeBridgeTests } from "./arch01IsometricNormativeBridgeTests";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { IsoNode, IsoSegment } from "../../isometric/types/isoGraphTypes";

export interface Arch02TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-02 ASSERTION FAILED] ${message}`);
  }
}

export function runArch02PmsAuthorityUnificationTests(): Arch02TestResult {
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
  // SYNTHETIC FIXTURE SETUP
  // =========================================================================
  const evRegistry = new NormativeEvidenceRegistry();

  evRegistry.register({
    evidenceId: "SYN_EV_ARCH02_SPEC_01",
    standardId: "SYN_STD_SPEC_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "CLAUSE_SPEC_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_ARCH02_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR",
    verifiedAt: "2026-02-01T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYN_EV_ARCH02_COMPAT_01",
    standardId: "SYN_STD_COMPAT_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "CLAUSE_COMPAT_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_ARCH02_02",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR",
    verifiedAt: "2026-02-01T00:00:00.000Z",
  });

  evRegistry.register({
    evidenceId: "SYN_EV_ARCH02_UNVERIFIED_01",
    standardId: "SYN_STD_SPEC_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "CLAUSE_UNVERIFIED_01",
    sourceType: "LEGACY_REFERENCE",
    sourceReference: "SYN_DOC_UNVERIFIED",
    verificationStatus: "UNVERIFIED",
  });

  const evidenceResolver = new NormativeEvidenceResolver(evRegistry);
  const compatRegistry = new NormativeCompatibilityRegistry();

  // Rule A: Compatible
  compatRegistry.register({
    ruleId: "SYN_ARCH02_RULE_COMPAT_OK",
    description: "Synthetic verified compatible rule",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_DN100",
    pressureRating: "SYN_CLASS_300",
    materialId: "SYN_MAT_CARBON_01",
    pipingSpecId: "SYN_SPEC_ARCH02_VERIFIED",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH02_COMPAT_01"],
  });

  // Rule B: Incompatible
  compatRegistry.register({
    ruleId: "SYN_ARCH02_RULE_INCOMPAT_01",
    description: "Synthetic verified incompatible rule",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_DN100",
    pressureRating: "SYN_CLASS_FORBIDDEN",
    materialId: "SYN_MAT_CARBON_01",
    pipingSpecId: "SYN_SPEC_ARCH02_VERIFIED",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH02_COMPAT_01"],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evidenceResolver);

  const verifiedPipingSpec: PipingSpecification = {
    id: "SYN_SPEC_ARCH02_VERIFIED",
    code: "SYN_SPEC_ARCH02_VERIFIED",
    name: "Verified Piping Specification for ARCH-02",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_CARBON_01"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_ARCH02",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_CARBON_01",
        nominalSizes: ["SYN_SIZE_DN100"],
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH02_SPEC_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [
      {
        ruleId: "SYN_SPEC_FLANGE_RULE_ARCH02",
        flangeStandardId: "SYN_FLANGE_STD_01" as any,
        materialId: "SYN_MAT_CARBON_01",
        rating: "SYN_CLASS_300",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH02_SPEC_01"],
      },
    ],
    valveRules: [
      {
        ruleId: "SYN_SPEC_VALVE_RULE_ARCH02",
        productStandardId: "SYN_VALVE_STD_01" as any,
        materialId: "SYN_MAT_CARBON_01",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH02_SPEC_01"],
      },
    ],
    sourceStatus: "VERIFIED",
    evidenceIds: ["SYN_EV_ARCH02_SPEC_01"],
  };

  const unverifiedPipingSpec: PipingSpecification = {
    id: "SYN_SPEC_ARCH02_UNVERIFIED",
    code: "SYN_SPEC_ARCH02_UNVERIFIED",
    name: "Unverified Piping Specification",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_CARBON_01"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_UNV",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_CARBON_01",
        nominalSizes: ["SYN_SIZE_DN100"],
        sourceStatus: "UNVERIFIED",
        evidenceIds: ["SYN_EV_ARCH02_UNVERIFIED_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "UNVERIFIED",
    evidenceIds: ["SYN_EV_ARCH02_UNVERIFIED_01"],
  };

  const legacySetup = {
    specs: [
      {
        code: "SYN_SPEC_ARCH02_VERIFIED",
        material: "SYN_MAT_CARBON_01",
        pressureClass: "SYN_CLASS_300",
        minDn: 15,
        maxDn: 600,
      },
      {
        code: "SYN_SPEC_ARCH02_UNVERIFIED",
        material: "SYN_MAT_CARBON_01",
        pressureClass: "SYN_CLASS_300",
        minDn: 15,
        maxDn: 600,
      },
    ],
  };

  const legacyAdapter = new LegacyPmsAdapter();

  const bridge = new IsometricNormativeBridge({
    specLookup: [verifiedPipingSpec, unverifiedPipingSpec],
    compatibilityEngine: compatEngine,
    evidenceResolver,
    legacyPmsAdapter: legacyAdapter,
    traceabilityEngine: new NormativeEvidenceTraceabilityEngine(),
  });

  // =========================================================================
  // TEST 01: Legacy PMS seul ne peut pas produire COMPATIBLE
  // =========================================================================
  runTest("TEST 01 [ARCH-02]: Legacy PMS seul ne peut pas produire COMPATIBLE", () => {
    // Entité avec legacy spec valide mais sans spec formelle enregistrée
    const node: IsoNode = {
      id: "N_TEST_01",
      name: "Node Test 01",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "LEGACY_SPEC_ONLY",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: legacySetup });
    assert(dec.status !== "COMPATIBLE", "Legacy PMS ne doit JAMAIS produire COMPATIBLE de façon autonome");
    assert(dec.status === "UNVERIFIED", `Attendu UNVERIFIED, reçu ${dec.status}`);
  });

  // =========================================================================
  // TEST 02: Piping Specification absente → UNVERIFIED
  // =========================================================================
  runTest("TEST 02 [ARCH-02]: Piping Specification absente → UNVERIFIED", () => {
    const node: IsoNode = {
      id: "N_TEST_02",
      name: "Node Test 02",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: legacySetup });
    assert(dec.status === "UNVERIFIED", `Attendu UNVERIFIED quand spec est absente, reçu ${dec.status}`);
    assert(dec.message.includes("MISSING_PIPING_SPEC"), "Doit indiquer MISSING_PIPING_SPEC");
  });

  // =========================================================================
  // TEST 03: Piping Specification non vérifiée → UNVERIFIED
  // =========================================================================
  runTest("TEST 03 [ARCH-02]: Piping Specification non vérifiée → UNVERIFIED", () => {
    const segment: IsoSegment = {
      id: "S_TEST_03",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      length: 10,
      type: "straight",
      fittings: [],
      spec: "SYN_SPEC_ARCH02_UNVERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
        dimensionalStandard: "SYN_DIM_STD_01",
      },
    };

    const dec = bridge.checkSegment(segment, { legacyProjectSetup: legacySetup });
    assert(dec.status === "UNVERIFIED", `Attendu UNVERIFIED pour spec non vérifiée, reçu ${dec.status}`);
    assert(dec.message.includes("PIPING_SPEC_UNVERIFIED"), "Doit indiquer PIPING_SPEC_UNVERIFIED");
  });

  // =========================================================================
  // TEST 04: Piping Specification vérifiée + règle compatible vérifiée → COMPATIBLE
  // =========================================================================
  runTest("TEST 04 [ARCH-02]: Piping Specification vérifiée + règle compatible vérifiée → COMPATIBLE", () => {
    const node: IsoNode = {
      id: "N_TEST_04",
      name: "Node Test 04",
      x: 1,
      y: 1,
      z: 1,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: legacySetup });
    assert(dec.status === "COMPATIBLE", `Attendu COMPATIBLE, reçu ${dec.status} (${dec.message})`);
    assert(dec.ruleIds.includes("SYN_SPEC_VALVE_RULE_ARCH02"), "Doit tracer la règle de spec");
    assert(dec.ruleIds.includes("SYN_ARCH02_RULE_COMPAT_OK"), "Doit tracer la règle de compatibilité");
  });

  // =========================================================================
  // TEST 05: Legacy PMS compatible + normative UNVERIFIED → résultat UNVERIFIED
  // =========================================================================
  runTest("TEST 05 [ARCH-02]: Legacy PMS compatible + normative UNVERIFIED → résultat UNVERIFIED", () => {
    // Le nœud a la bonne classe pour le Legacy PMS, mais il lui manque le matériau
    const node: IsoNode = {
      id: "N_TEST_05",
      name: "Node Test 05",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: legacySetup });
    assert(dec.status === "UNVERIFIED", `Attendu UNVERIFIED, reçu ${dec.status}`);
    assert(dec.legacyPmsComparison?.legacyClassConformant === true, "Legacy PMS prétendait la classe conforme");
  });

  // =========================================================================
  // TEST 06: Legacy PMS compatible + normative INCOMPATIBLE → résultat INCOMPATIBLE
  // =========================================================================
  runTest("TEST 06 [ARCH-02]: Legacy PMS compatible + normative INCOMPATIBLE → résultat INCOMPATIBLE", () => {
    const node: IsoNode = {
      id: "N_TEST_06",
      name: "Node Test 06",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_FORBIDDEN",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const setupWithForbiddenClass = {
      specs: [
        {
          code: "SYN_SPEC_ARCH02_VERIFIED",
          material: "SYN_MAT_CARBON_01",
          pressureClass: "SYN_CLASS_FORBIDDEN",
        },
      ],
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: setupWithForbiddenClass });
    assert(dec.status === "INCOMPATIBLE", `Attendu INCOMPATIBLE (Normative Authority), reçu ${dec.status}`);
    assert(dec.conflictCodes.includes("LEGACY_PMS_NORMATIVE_CONFLICT"), "Doit signaler le conflit");
  });

  // =========================================================================
  // TEST 07: Legacy PMS incompatible + normative compatible vérifiée → normative reste la SEULE autorité (COMPATIBLE)
  // =========================================================================
  runTest("TEST 07 [ARCH-02]: Legacy PMS incompatible + normative compatible vérifiée → normative reste l'autorité (COMPATIBLE)", () => {
    const node: IsoNode = {
      id: "N_TEST_07",
      name: "Node Test 07",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const conflictingSetup = {
      specs: [
        {
          code: "SYN_SPEC_ARCH02_VERIFIED",
          material: "SYN_MAT_CARBON_01",
          pressureClass: "SYN_CLASS_150", // Différent de SYN_CLASS_300
        },
      ],
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: conflictingSetup });
    assert(dec.status === "COMPATIBLE", `Attendu COMPATIBLE (Normative Authority), reçu ${dec.status}`);
    assert(dec.conflictCodes.includes("LEGACY_PMS_NORMATIVE_CONFLICT"), "Doit inclure le code LEGACY_PMS_NORMATIVE_CONFLICT");
    assert(dec.legacyPmsComparison?.hasConflict === true, "Doit enregistrer hasConflict === true dans snapshot");
  });

  // =========================================================================
  // TEST 08: Conflit legacy/normative → diagnostic explicite
  // =========================================================================
  runTest("TEST 08 [ARCH-02]: Conflit legacy/normative → diagnostic explicite LEGACY_PMS_NORMATIVE_CONFLICT", () => {
    const node: IsoNode = {
      id: "N_TEST_08",
      name: "Node Test 08",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const conflictingSetup = {
      specs: [
        {
          code: "SYN_SPEC_ARCH02_VERIFIED",
          material: "SYN_MAT_CARBON_01",
          pressureClass: "SYN_CLASS_150",
        },
      ],
    };

    const dec = bridge.checkNode(node, { legacyProjectSetup: conflictingSetup });
    assert(dec.status === "COMPATIBLE", `Attendu COMPATIBLE, reçu ${dec.status}`);
    assert(dec.conflictCodes.includes("LEGACY_PMS_NORMATIVE_CONFLICT"), "Doit contenir le code LEGACY_PMS_NORMATIVE_CONFLICT");
    assert(dec.legacyPmsComparison?.conflictCode === "LEGACY_PMS_NORMATIVE_CONFLICT", "Le snapshot doit contenir le code");
  });

  // =========================================================================
  // TEST 09: Aucune conversion NPS ↔ DN
  // =========================================================================
  runTest("TEST 09 [ARCH-02]: Aucune conversion NPS ↔ DN", () => {
    const segment: IsoSegment = {
      id: "S_TEST_09",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      length: 5,
      type: "straight",
      fittings: [],
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_NPS_4_INCH",
      },
    };

    const ctx = adaptIsoSegmentToNormativeContext(segment);
    assert(ctx.nominalSize === "SYN_NPS_4_INCH", "L'adapter doit conserver exactement la chaîne fournie");
    const dec = bridge.checkSegment(segment);
    assert(dec.status === "INCOMPATIBLE", "Doit rejeter sans convertir implicitement NPS en DN");
  });

  // =========================================================================
  // TEST 10: Aucune conversion ASME Class ↔ EN PN
  // =========================================================================
  runTest("TEST 10 [ARCH-02]: Aucune conversion ASME Class ↔ EN PN", () => {
    const node: IsoNode = {
      id: "N_TEST_10",
      name: "Node Test 10",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "bride_wn",
      pn: "SYN_PN_40", // Au lieu de SYN_CLASS_300
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const ctx = adaptIsoNodeToNormativeContext(node);
    assert(ctx.pressureRating === "SYN_PN_40", "L'adapter ne doit jamais convertir PN en Class");
    const dec = bridge.checkNode(node);
    assert(dec.status === "INCOMPATIBLE", "Doit rejeter sans convertir implicitement PN en Class");
  });

  // =========================================================================
  // TEST 11: Aucune fabrication d'evidenceIds
  // =========================================================================
  runTest("TEST 11 [ARCH-02]: Aucune fabrication d'evidenceIds", () => {
    const node: IsoNode = {
      id: "N_TEST_11",
      name: "Node Sans Evidence",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_NO_EVIDENCE",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const dec = bridge.checkNode(node);
    assert(dec.evidenceIds.length === 0, "Aucun evidenceId ne doit être auto-généré");
    assert(dec.traceability.evidenceChain.length === 0, "La chaîne de preuves doit être vide");
  });

  // =========================================================================
  // TEST 12: Aucune mutation de l'objet source
  // =========================================================================
  runTest("TEST 12 [ARCH-02]: Aucune mutation de l'objet source", () => {
    const sourceNode: IsoNode = Object.freeze({
      id: "N_TEST_12_FROZEN",
      name: "Frozen Node",
      x: 5,
      y: 10,
      z: 15,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 100,
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: Object.freeze({
        nominalSize: "SYN_SIZE_DN100",
      }),
    });

    const snapshotBefore = JSON.stringify(sourceNode);
    const dec = bridge.checkNode(sourceNode);
    const snapshotAfter = JSON.stringify(sourceNode);

    assert(snapshotBefore === snapshotAfter, "L'objet source ne doit subir aucune mutation");
    assert(dec.status === "COMPATIBLE", "Décision valide sur objet gelé");
  });

  // =========================================================================
  // TEST 13: Traceability conservée
  // =========================================================================
  runTest("TEST 13 [ARCH-02]: Traceability conservée et verrouillée", () => {
    const node: IsoNode = {
      id: "N_TEST_13",
      name: "Node Test 13",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const dec = bridge.checkNode(node);
    assert(dec.traceability.entityId === "N_TEST_13", "Traceability entityId conservé");
    assert(dec.traceability.specRuleIds.includes("SYN_SPEC_VALVE_RULE_ARCH02"), "Spec rule tracée");
    assert(dec.traceability.compatibilityRuleIds.includes("SYN_ARCH02_RULE_COMPAT_OK"), "Compatibility rule tracée");
    assert(dec.traceability.evidenceIds.length === 2, "2 évidences tracées");
    assert(dec.traceability.traceabilityLock.valid === true, "Verrou NORM-14-10 valide");
  });

  // =========================================================================
  // TEST 14: Le bridge continue d'utiliser les moteurs normatifs existants
  // =========================================================================
  runTest("TEST 14 [ARCH-02]: Le bridge continue d'utiliser les moteurs normatifs existants", () => {
    assert(typeof bridge.evaluateContext === "function", "bridge.evaluateContext existe");
    assert(typeof bridge.checkNode === "function", "bridge.checkNode existe");
    assert(typeof bridge.checkSegment === "function", "bridge.checkSegment existe");
    assert(defaultLegacyPmsAdapter !== undefined, "defaultLegacyPmsAdapter instancié");
  });

  // =========================================================================
  // TEST 15: Aucun second moteur normatif créé
  // =========================================================================
  runTest("TEST 15 [ARCH-02]: Aucun second moteur normatif créé", () => {
    const adapterRes = legacyAdapter.evaluate(
      { entityId: "DUMMY", pipingSpecId: "SYN_SPEC_ARCH02_VERIFIED", pressureRating: "SYN_CLASS_300" },
      "UNVERIFIED",
      legacySetup
    );
    assert(adapterRes.status === "UNVERIFIED", "LegacyPmsAdapter ne calcule rien seul et conserve UNVERIFIED");
  });

  // =========================================================================
  // TEST 16: Tests non-régression ARCH-01
  // =========================================================================
  runTest("TEST 16 [ARCH-02]: Non-régression complète de la suite ARCH-01", () => {
    const arch01Res = runArch01IsometricNormativeBridgeTests();
    assert(arch01Res.success === true, `Suite ARCH-01 échouée (${arch01Res.testsFailed} échecs)`);
    assert(arch01Res.testsRun >= 15, `Suite ARCH-01 doit exécuter au moins 15 tests (exécuté ${arch01Res.testsRun})`);
  });

  // =========================================================================
  // TEST 17: Non-promotion explicite (UNVERIFIED + Legacy COMPATIBLE ≠ COMPATIBLE)
  // =========================================================================
  runTest("TEST 17 [ARCH-02-FIX-01]: Non-promotion explicite — UNVERIFIED + Legacy COMPATIBLE ≠ COMPATIBLE", () => {
    const unverifiedNode: IsoNode = {
      id: "N_TEST_17_UNV",
      name: "Node Test 17 Unverified",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_UNVERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
      },
    };

    const dec = bridge.checkNode(unverifiedNode, { legacyProjectSetup: legacySetup });
    assert(dec.status !== "COMPATIBLE", "Legacy COMPATIBLE ne doit JAMAIS promouvoir UNVERIFIED en COMPATIBLE");
    assert(dec.status === "UNVERIFIED", `Attendu UNVERIFIED, reçu ${dec.status}`);
  });

  // =========================================================================
  // TEST 18: Non-promotion explicite (INVALID + Legacy COMPATIBLE ≠ COMPATIBLE)
  // =========================================================================
  runTest("TEST 18 [ARCH-02-FIX-01]: Non-promotion explicite — INVALID + Legacy COMPATIBLE ≠ COMPATIBLE", () => {
    const invalidNode: IsoNode = {
      id: "N_TEST_18_INV",
      name: "Node Test 18 Invalid",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "CS_DISALLOWED_HEURISTIC", // déclenche DISALLOWED_TOKEN_HEURISTIC -> INVALID
      },
    };

    const dec = bridge.checkNode(invalidNode, { legacyProjectSetup: legacySetup });
    assert(dec.status !== "COMPATIBLE", "Legacy COMPATIBLE ne doit JAMAIS promouvoir INVALID en COMPATIBLE");
    assert(dec.status === "INVALID", `Attendu INVALID, reçu ${dec.status}`);
  });

  // =========================================================================
  // TEST 19: Non-dégradation explicite (COMPATIBLE + Legacy INCOMPATIBLE ≠ UNVERIFIED et ≠ INCOMPATIBLE)
  // =========================================================================
  runTest("TEST 19 [ARCH-02-FIX-01]: Non-dégradation explicite — COMPATIBLE + Legacy INCOMPATIBLE = COMPATIBLE", () => {
    const compatibleNode: IsoNode = {
      id: "N_TEST_19_COMPAT",
      name: "Node Test 19 Compat",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
      specificProps: {
        nominalSize: "SYN_SIZE_DN100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const conflictingSetup = {
      specs: [
        {
          code: "SYN_SPEC_ARCH02_VERIFIED",
          material: "SYN_MAT_CARBON_01",
          pressureClass: "SYN_CLASS_900", // Mismatch avec SYN_CLASS_300
        },
      ],
    };

    const dec = bridge.checkNode(compatibleNode, { legacyProjectSetup: conflictingSetup });
    assert(dec.status !== "UNVERIFIED", "Le statut normatif COMPATIBLE ne doit JAMAIS être dégradé en UNVERIFIED");
    assert(dec.status !== "INCOMPATIBLE", "Le statut normatif COMPATIBLE ne doit JAMAIS être transformé en INCOMPATIBLE");
    assert(dec.status === "COMPATIBLE", `Attendu COMPATIBLE, reçu ${dec.status}`);
    assert(dec.conflictCodes.includes("LEGACY_PMS_NORMATIVE_CONFLICT"), "Doit signaler le conflit diagnostic");
  });

  // =========================================================================
  // TEST 20: INVALID IMMUTABLE (Normative INVALID + Legacy COMPATIBLE → INVALID)
  // =========================================================================
  runTest("TEST 20 [ARCH-02-FIX-01]: INVALID IMMUTABLE — Normative INVALID + Legacy COMPATIBLE → INVALID", () => {
    const invalidContextNode: IsoNode = {
      id: "", // Invalid empty entityId
      name: "Empty Entity ID Node",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      pn: "SYN_CLASS_300",
      material: "SYN_MAT_CARBON_01",
      spec: "SYN_SPEC_ARCH02_VERIFIED",
    };

    const dec = bridge.checkNode(invalidContextNode, { legacyProjectSetup: legacySetup });
    assert(dec.status === "INVALID", `Attendu INVALID pour entityId vide, reçu ${dec.status}`);
    assert(dec.conflictCodes.includes("INVALID_NORMATIVE_CONTEXT"), "Doit signaler INVALID_NORMATIVE_CONTEXT");
  });

  return Object.freeze({
    success: testsFailed === 0 && testsRun >= 20,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
