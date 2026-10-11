/**
 * PDI NORMATIVE ENGINE & UNIVERSAL MODEL — ARCH-03 TEST SUITE
 * Reference: ARCH-03 (Universal Model — Transversal Business Model)
 *
 * Dedicated test suite verifying that `PdiUniversalEntity` serves as the
 * transversal business model for PD&I across 2D CAD, Isometric Editor, 3D Viewer,
 * BOM/MTO, Welding/Spools, and the Normative Engine.
 *
 * Mandatory ARCH-03 Tests:
 *  - TEST 01: Universal Entity structurelle valide
 *  - TEST 02: Identité stable
 *  - TEST 03: Adapter IsoNode -> Universal
 *  - TEST 04: Adapter IsoSegment -> Universal
 *  - TEST 05: Aucune mutation de IsoNode
 *  - TEST 06: Aucune mutation de IsoSegment
 *  - TEST 07: Même entité conserve son identité entre représentation graphique et Universal Model
 *  - TEST 08: Les propriétés métier sont conservées (DN, PN, Matériau, Schedule, PMS, Service, Tag)
 *  - TEST 09: Les références normatives ne sont pas inventées
 *  - TEST 10: Universal Model ne peut pas promouvoir une décision normative
 *  - TEST 11: Normative Engine reste l'autorité
 *  - TEST 12: Traceability conservée
 *  - TEST 13: BOM/MTO peut référencer l'identité universelle
 *  - TEST 14: Weld/Spool peut référencer l'identité universelle
 *  - TEST 15: 3D conserve l'identité universelle
 *  - TEST 16: Aucune boucle de synchronisation (déterminisme et idempotence)
 *  - TEST 17: Aucun second Universal Model
 *  - TEST 18: Aucun second moteur normatif
 *  - TEST 19: Non-régression complète de la suite ARCH-01
 *  - TEST 20: Non-régression complète de la suite ARCH-02
 */

import {
  PdiUniversalEntity,
  UniversalEntityCategory,
  UniversalEntitySource,
} from "../../model/pdiUniversalEntity";
import {
  nodeToUniversalEntity,
  segmentToUniversalEntity,
  fittingToUniversalEntity,
  supportToUniversalEntity,
  cad2dToUniversalEntity,
  universalEntityToNode,
  universalEntityToSegment,
  isUniversalEntity,
  validateUniversalEntity,
  cloneUniversalEntity,
  applyUniversalEntityToGraph,
} from "../../model/pdiUniversalAdapter";
import type {
  IsoNode,
  IsoSegment,
  IsoFitting,
  Cad2dEntity,
} from "../../isometric/types/isoGraphTypes";
import type { IsoPipingSupport } from "../../isometric/supports/pdiMssSupportEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { NormativeEvidenceTraceabilityEngine } from "../engine/normativeEvidenceTraceabilityEngine";
import {
  adaptUniversalEntityToNormativeContext,
  adaptIsoNodeToNormativeContext,
} from "../integration/isometricNormativeAdapter";
import { IsometricNormativeBridge } from "../integration/isometricNormativeBridge";
import { runArch01IsometricNormativeBridgeTests } from "./arch01IsometricNormativeBridgeTests";
import { runArch02PmsAuthorityUnificationTests } from "./arch02PmsAuthorityUnificationTests";
import type { PipingSpecification } from "../types/pipingSpecTypes";

export interface Arch03TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-03 ASSERTION FAILED] ${message}`);
  }
}

export function runArch03UniversalModelTests(): Arch03TestResult {
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
  // FIXTURES NORMATIVES SYNTHÉTIQUES
  // =========================================================================
  const evRegistry = new NormativeEvidenceRegistry();
  evRegistry.register({
    evidenceId: "SYN_EV_ARCH03_01",
    standardId: "SYN_STD_SPEC_01" as any,
    editionId: "SYN_EDITION_2026",
    clauseReference: "CLAUSE_ARCH03",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_ARCH03",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR",
    verifiedAt: "2026-03-01T00:00:00.000Z",
  });

  const evidenceResolver = new NormativeEvidenceResolver(evRegistry);
  const compatRegistry = new NormativeCompatibilityRegistry();

  compatRegistry.register({
    ruleId: "SYN_ARCH03_RULE_COMPAT_OK",
    description: "Synthetic rule for ARCH-03",
    componentType: "VALVE",
    nominalSize: "SYN_SIZE_DN100",
    pressureRating: "SYN_CLASS_300",
    materialId: "SYN_MAT_CARBON_01",
    pipingSpecId: "SYN_SPEC_ARCH03",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EV_ARCH03_01"],
  });

  const compatEngine = new NormativeCompatibilityEngine(compatRegistry, evidenceResolver);

  const verifiedPipingSpec: PipingSpecification = {
    id: "SYN_SPEC_ARCH03",
    code: "SYN_SPEC_ARCH03",
    name: "Verified Piping Specification ARCH-03",
    designCodeId: "SYN_DESIGN_CODE_01" as any,
    materialReferenceIds: ["SYN_MAT_CARBON_01"],
    pipeRules: [
      {
        ruleId: "SYN_SPEC_PIPE_RULE_ARCH03",
        pipeDimensionalStandardId: "SYN_DIM_STD_01" as any,
        materialId: "SYN_MAT_CARBON_01",
        nominalSizes: ["SYN_SIZE_DN100"],
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH03_01"],
      },
    ],
    fittingRules: [],
    flangeRules: [],
    valveRules: [
      {
        ruleId: "SYN_SPEC_VALVE_RULE_ARCH03",
        productStandardId: "SYN_VALVE_STD_01" as any,
        materialId: "SYN_MAT_CARBON_01",
        sourceStatus: "VERIFIED",
        evidenceIds: ["SYN_EV_ARCH03_01"],
      },
    ],
    sourceStatus: "VERIFIED",
    evidenceIds: ["SYN_EV_ARCH03_01"],
  };

  const bridge = new IsometricNormativeBridge({
    specLookup: [verifiedPipingSpec],
    compatibilityEngine: compatEngine,
    evidenceResolver,
    traceabilityEngine: new NormativeEvidenceTraceabilityEngine(),
  });

  // =========================================================================
  // TEST 01: Universal Entity structurelle valide
  // =========================================================================
  runTest("TEST 01 [ARCH-03]: Universal Entity structurelle valide", () => {
    const node: IsoNode = {
      id: "N_TEST_VALID",
      name: "Vanne Test",
      x: 10,
      y: 20,
      z: 5,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 100,
      pn: "Class 300",
      material: "ASTM A106 Gr. B",
      spec: "CS300",
    };

    const ue = nodeToUniversalEntity(node);
    assert(isUniversalEntity(ue), "isUniversalEntity doit retourner true");
    const validation = validateUniversalEntity(ue);
    assert(validation.valid === true, `validateUniversalEntity doit être valide: ${validation.errors.join(", ")}`);
    assert(ue.identity.category === "valve", `Catégorie attendue valve, reçu ${ue.identity.category}`);
  });

  // =========================================================================
  // TEST 02: Identité stable
  // =========================================================================
  runTest("TEST 02 [ARCH-03]: Identité stable (entityId conservé et déterministe)", () => {
    const segment: IsoSegment = {
      id: "SEG_STABLE_ID_123",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 150,
      pn: "Class 150",
      material: "Acier API 5L X52",
      length: 12.5,
      type: "straight",
      fittings: [],
    };

    const ue1 = segmentToUniversalEntity(segment);
    const ue2 = segmentToUniversalEntity(segment);

    assert(ue1.identity.id === "SEG_STABLE_ID_123", "Identity ID conservé");
    assert(ue1.identity.id === ue2.identity.id, "L'identité doit être déterministe");
    assert(ue1.identity.category === "pipe", "Catégorie pipe");
  });

  // =========================================================================
  // TEST 03: Adapter IsoNode -> Universal
  // =========================================================================
  runTest("TEST 03 [ARCH-03]: Adapter IsoNode -> Universal", () => {
    const node: IsoNode = {
      id: "NODE_ELBOW_01",
      name: "Coude 90 LR",
      x: 1.5,
      y: 2.5,
      z: 3.5,
      type: "normal",
      equipmentType: "coude_90",
      dn: 80,
      pn: "Class 300",
      material: "ASTM A234 WPB",
      spec: "CS300",
      rotation: 90,
      ports: [
        { id: "p1", index: 0, role: "inline-in", connectionType: "butt_weld", dx: 0, dy: 0, dz: 0 },
        { id: "p2", index: 1, role: "inline-out", connectionType: "butt_weld", dx: 0, dy: 0, dz: 0 },
      ],
    };

    const ue = nodeToUniversalEntity(node, [], { projectId: "PROJ_ALPHA", source: "ISOMETRIC" });
    assert(ue.identity.id === "NODE_ELBOW_01", "ID respecté");
    assert(ue.identity.category === "fitting", "Catégorie coude -> fitting");
    assert(ue.geometry.x === 1.5 && ue.geometry.y === 2.5 && ue.geometry.z === 3.5, "Géométrie respectée");
    assert(ue.identity.projectId === "PROJ_ALPHA", "projectId conservé");
    assert(ue.identity.source === "ISOMETRIC", "source conservée");
    assert(ue.connection.ports.length === 2, "Ports conservés");
  });

  // =========================================================================
  // TEST 04: Adapter IsoSegment -> Universal
  // =========================================================================
  runTest("TEST 04 [ARCH-03]: Adapter IsoSegment -> Universal", () => {
    const segment: IsoSegment = {
      id: "SEG_PIPE_01",
      fromNodeId: "NODE_A",
      toNodeId: "NODE_B",
      dn: 200,
      pn: "Class 600",
      material: "Acier API 5L X65",
      length: 25.4,
      type: "riser",
      fittings: [],
      spec: "CS600",
      lineId: "LINE_101",
    };

    const ue = segmentToUniversalEntity(segment, undefined, undefined, { projectId: "PROJ_ALPHA" });
    assert(ue.identity.id === "SEG_PIPE_01", "ID respecté");
    assert(ue.identity.category === "pipe", "Catégorie pipe");
    assert(ue.connection.fromEntityId === "NODE_A", "fromNodeId mappé");
    assert(ue.connection.toEntityId === "NODE_B", "toNodeId mappé");
    assert(ue.tag.lineId === "LINE_101", "lineId conservé");
    assert(ue.geometry.length === 25.4, "Longueur conservée");
  });

  // =========================================================================
  // TEST 05: Aucune mutation de IsoNode
  // =========================================================================
  runTest("TEST 05 [ARCH-03]: Aucune mutation de IsoNode", () => {
    const originalNode: IsoNode = Object.freeze({
      id: "NODE_FROZEN",
      name: "Frozen Node",
      x: 10,
      y: 20,
      z: 30,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 100,
      pn: "Class 150",
      material: "Acier Carbone",
      spec: "CS150",
    });

    const snapBefore = JSON.stringify(originalNode);
    const ue = nodeToUniversalEntity(originalNode);
    const snapAfter = JSON.stringify(originalNode);

    assert(snapBefore === snapAfter, "IsoNode source ne doit subir aucune mutation");
    assert(ue.identity.id === "NODE_FROZEN", "Conversion réussie");
  });

  // =========================================================================
  // TEST 06: Aucune mutation de IsoSegment
  // =========================================================================
  runTest("TEST 06 [ARCH-03]: Aucune mutation de IsoSegment", () => {
    const originalSegment: IsoSegment = Object.freeze({
      id: "SEG_FROZEN",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 50,
      pn: "Class 150",
      material: "Inox 316L",
      length: 8.2,
      type: "straight",
      fittings: Object.freeze([]) as any,
    });

    const snapBefore = JSON.stringify(originalSegment);
    const ue = segmentToUniversalEntity(originalSegment);
    const snapAfter = JSON.stringify(originalSegment);

    assert(snapBefore === snapAfter, "IsoSegment source ne doit subir aucune mutation");
    assert(ue.identity.id === "SEG_FROZEN", "Conversion réussie");
  });

  // =========================================================================
  // TEST 07: Même entité conserve son identité (Roundtrip)
  // =========================================================================
  runTest("TEST 07 [ARCH-03]: Même entité conserve son identité entre graphe et Universal Model", () => {
    const node: IsoNode = {
      id: "NODE_ROUNDTRIP",
      name: "Robinet à soupape",
      x: 12.345,
      y: 67.89,
      z: 10,
      type: "normal",
      equipmentType: "vanne_soupape",
      dn: 50,
      pn: "Class 300",
      material: "ASTM A105",
      spec: "CS300",
      tag: "V-301",
    };

    const ue = nodeToUniversalEntity(node);
    const backToNode = universalEntityToNode(ue);

    assert(backToNode.id === node.id, "ID conservé au roundtrip");
    assert(backToNode.dn === node.dn, "DN conservé au roundtrip");
    assert(backToNode.pn === node.pn, "PN conservé au roundtrip");
    assert(backToNode.tag === node.tag, "Tag conservé au roundtrip");
  });

  // =========================================================================
  // TEST 08: Les propriétés métier sont conservées
  // =========================================================================
  runTest("TEST 08 [ARCH-03]: Les propriétés métier sont conservées (DN, PN, Matériau, Schedule, PMS, Service, Tag)", () => {
    const segment: IsoSegment = {
      id: "SEG_PROPS",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "Class 300",
      material: "ASTM A106 Gr. B",
      length: 15,
      type: "straight",
      fittings: [],
      spec: "CS300-PROC",
      lineId: "01-PL-100-300",
      service: "GAS",
    };

    const ue = segmentToUniversalEntity(segment);
    assert(ue.dn.dn === 100, "DN conservé");
    assert(ue.pn.rating === "Class 300", "PN conservé");
    assert(ue.material.grade === "ASTM A106 Gr. B", "Matériau conservé");
    assert(ue.spec.pmsCode === "CS300-PROC", "PMS Code conservé");
    assert(ue.service.code === "GAS", "Service conservé");
    assert(ue.tag.lineId === "01-PL-100-300", "LineId conservé");
  });

  // =========================================================================
  // TEST 09: Les références normatives ne sont pas inventées
  // =========================================================================
  runTest("TEST 09 [ARCH-03]: Les références normatives ne sont pas inventées", () => {
    const node: IsoNode = {
      id: "NODE_NO_SPEC",
      name: "Noeud neutre",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 50,
    };

    const ue = nodeToUniversalEntity(node);
    assert(ue.normative?.evidenceIds === undefined, "Aucun evidenceId inventé");
    const normCtx = adaptUniversalEntityToNormativeContext(ue);
    assert(normCtx.evidenceIds === undefined, "Normative Context evidenceIds reste undefined");
  });

  // =========================================================================
  // TEST 10: Universal Model ne peut pas promouvoir une décision normative
  // =========================================================================
  runTest("TEST 10 [ARCH-03]: Universal Model ne peut pas promouvoir une décision normative", () => {
    const ue: PdiUniversalEntity = {
      identity: {
        id: "UE_UNVERIFIED",
        type: "vanne_passage_total",
        category: "valve",
        name: "Vanne Unverified",
        labelFr: "Vanne",
      },
      geometry: { x: 0, y: 0, z: 0 },
      connection: { ports: [], connectionType: "inline" },
      dn: { dn: 100, unit: "mm" },
      pn: { rating: "SYN_CLASS_300" },
      material: { grade: "SYN_MAT_CARBON_01" },
      service: { code: "PROC" },
      spec: { pmsCode: "UNREGISTERED_SPEC" },
      tag: { fullTag: "V-UNV" },
      fabrication: { location: "shop" },
      documentation: {},
      specific: {},
    };

    const dec = bridge.checkUniversalEntity(ue);
    assert(dec.status !== "COMPATIBLE", "Universal Model ne doit JAMAIS s'auto-déclarer COMPATIBLE");
    assert(dec.status === "UNVERIFIED", `Attendu UNVERIFIED pour spec non enregistrée, reçu ${dec.status}`);
  });

  // =========================================================================
  // TEST 11: Normative Engine reste la seule autorité
  // =========================================================================
  runTest("TEST 11 [ARCH-03]: Normative Engine reste la seule autorité", () => {
    const ueValid: PdiUniversalEntity = {
      identity: {
        id: "UE_COMPATIBLE",
        type: "vanne_passage_total",
        category: "valve",
        name: "Vanne Compatible",
        labelFr: "Vanne",
      },
      geometry: { x: 0, y: 0, z: 0 },
      connection: { ports: [], connectionType: "inline" },
      dn: { dn: 100, unit: "mm" },
      pn: { rating: "SYN_CLASS_300" },
      material: { grade: "SYN_MAT_CARBON_01" },
      service: { code: "PROC" },
      spec: { pmsCode: "SYN_SPEC_ARCH03" },
      tag: { fullTag: "V-101" },
      fabrication: { location: "shop" },
      documentation: {},
      specific: {
        valve: { flowType: "passage_total" },
      },
      normative: {
        nominalSize: "SYN_SIZE_DN100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const dec = bridge.checkUniversalEntity(ueValid);
    assert(dec.status === "COMPATIBLE", `Attendu COMPATIBLE de la part du moteur normatif, reçu ${dec.status}`);
    assert(dec.ruleIds.includes("SYN_ARCH03_RULE_COMPAT_OK"), "Règle normative tracée");
  });

  // =========================================================================
  // TEST 12: Traceability conservée
  // =========================================================================
  runTest("TEST 12 [ARCH-03]: Traceability conservée et verrouillée", () => {
    const ue: PdiUniversalEntity = {
      identity: {
        id: "UE_TRACE",
        type: "vanne_passage_total",
        category: "valve",
        name: "Vanne Trace",
        labelFr: "Vanne",
      },
      geometry: { x: 0, y: 0, z: 0 },
      connection: { ports: [], connectionType: "inline" },
      dn: { dn: 100, unit: "mm" },
      pn: { rating: "SYN_CLASS_300" },
      material: { grade: "SYN_MAT_CARBON_01" },
      service: { code: "PROC" },
      spec: { pmsCode: "SYN_SPEC_ARCH03" },
      tag: { fullTag: "V-TRACE" },
      fabrication: { location: "shop" },
      documentation: {},
      specific: {},
      normative: {
        nominalSize: "SYN_SIZE_DN100",
        productStandard: "SYN_VALVE_STD_01",
      },
    };

    const dec = bridge.checkUniversalEntity(ue);
    assert(dec.traceability.entityId === "UE_TRACE", "EntityId de traçabilité respecté");
    assert(dec.traceability.evidenceIds.includes("SYN_EV_ARCH03_01"), "Evidence Id tracé");
    assert(dec.traceability.traceabilityLock.valid === true, "Verrou de traçabilité valide");
  });

  // =========================================================================
  // TEST 13: BOM/MTO peut référencer l'identité universelle
  // =========================================================================
  runTest("TEST 13 [ARCH-03]: BOM/MTO peut référencer l'identité universelle", () => {
    const segment: IsoSegment = {
      id: "SEG_BOM_01",
      fromNodeId: "N1",
      toNodeId: "N2",
      dn: 100,
      pn: "Class 150",
      material: "Acier API 5L Gr. B",
      length: 10,
      type: "straight",
      fittings: [],
    };

    const ue = segmentToUniversalEntity(segment);
    // BOM extraction pattern from Universal Entity
    const bomItem = {
      entityId: ue.identity.id,
      category: ue.identity.category,
      designation: ue.identity.labelFr,
      dn: ue.dn.dn,
      rating: ue.pn.rating,
      material: ue.material.grade,
      quantity: 1,
      totalLength: ue.geometry.length,
    };

    assert(bomItem.entityId === "SEG_BOM_01", "BOM référence l'id universel");
    assert(bomItem.category === "pipe", "BOM catégorisé pipe");
    assert(bomItem.totalLength === 10, "BOM métré correct");
  });

  // =========================================================================
  // TEST 14: Weld/Spool peut référencer l'identité universelle
  // =========================================================================
  runTest("TEST 14 [ARCH-03]: Weld/Spool peut référencer l'identité universelle", () => {
    const node: IsoNode = {
      id: "NODE_SPOOL_WELD",
      name: "Soudure Chantier",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "poste_sectionnement",
      dn: 100,
    };

    const ue = nodeToUniversalEntity(node, [], {
      relationships: {
        spoolId: "SP-01",
        weldIds: ["W-01", "W-02"],
      },
    });

    assert(ue.relationships?.spoolId === "SP-01", "Spool ID rattaché à l'entité");
    assert(ue.relationships?.weldIds?.includes("W-01"), "Weld ID rattaché");
  });

  // =========================================================================
  // TEST 15: 3D conserve l'identité universelle
  // =========================================================================
  runTest("TEST 15 [ARCH-03]: 3D conserve l'identité universelle", () => {
    const node: IsoNode = {
      id: "NODE_3D_VIEW",
      name: "Bride WN 3D",
      x: 5.5,
      y: 10.2,
      z: 3.1,
      rotation: 45,
      type: "normal",
      equipmentType: "bride_wn",
      dn: 150,
    };

    const ue = nodeToUniversalEntity(node);
    // 3D Scene mapping verification
    const sceneObjectProps = {
      uuid: ue.identity.id,
      position: [ue.geometry.x, ue.geometry.y, ue.geometry.z],
      rotationY: ue.geometry.rotation,
      entityType: ue.identity.type,
      category: ue.identity.category,
    };

    assert(sceneObjectProps.uuid === "NODE_3D_VIEW", "3D utilise l'id universel");
    assert(sceneObjectProps.position[0] === 5.5, "Position X 3D fidèle");
    assert(sceneObjectProps.position[1] === 10.2, "Position Y 3D fidèle");
    assert(sceneObjectProps.position[2] === 3.1, "Position Z 3D fidèle");
  });

  // =========================================================================
  // TEST 16: Aucune boucle de synchronisation (Idempotence & Déterminisme)
  // =========================================================================
  runTest("TEST 16 [ARCH-03]: Aucune boucle de synchronisation (Idempotence et Déterminisme)", () => {
    const node: IsoNode = {
      id: "NODE_SYNC_TEST",
      name: "Vanne Test Sync",
      x: 1,
      y: 2,
      z: 3,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 50,
      pn: "Class 150",
      material: "Acier API 5L X52",
      spec: "CS150",
    };

    const ue1 = nodeToUniversalEntity(node);
    const convertedNode = universalEntityToNode(ue1);
    const ue2 = nodeToUniversalEntity(convertedNode);

    assert(ue1.identity.id === ue2.identity.id, "ID invariant après cycle");
    assert(ue1.geometry.x === ue2.geometry.x, "Géométrie X invariante");
    assert(ue1.geometry.y === ue2.geometry.y, "Géométrie Y invariante");
    assert(ue1.geometry.z === ue2.geometry.z, "Géométrie Z invariante");
    assert(ue1.dn.dn === ue2.dn.dn, "DN invariant");
    assert(ue1.pn.rating === ue2.pn.rating, "PN invariant");
  });

  // =========================================================================
  // TEST 17: Aucun second Universal Model
  // =========================================================================
  runTest("TEST 17 [ARCH-03]: Aucun second Universal Model", () => {
    const cloned = cloneUniversalEntity(nodeToUniversalEntity({ id: "N_TEST", name: "T", x: 0, y: 0, z: 0, type: "normal" }));
    assert(isUniversalEntity(cloned), "Le contrat unique PdiUniversalEntity est respecté");
  });

  // =========================================================================
  // TEST 18: Aucun second moteur normatif
  // =========================================================================
  runTest("TEST 18 [ARCH-03]: Aucun second moteur normatif", () => {
    const ue: PdiUniversalEntity = {
      identity: { id: "UE_NO_PARALLEL_NORM", type: "pipe", category: "pipe", name: "Tube", labelFr: "Tube" },
      geometry: { x: 0, y: 0, z: 0 },
      connection: { ports: [], connectionType: "butt_weld" },
      dn: { dn: 50, unit: "mm" },
      pn: { rating: "Class 150" },
      material: { grade: "Acier Carbone" },
      service: { code: "PROC" },
      spec: { pmsCode: "UNVERIFIED_PMS" },
      tag: { fullTag: "T-01" },
      fabrication: { location: "shop" },
      documentation: {},
      specific: {},
    };

    // L'adaptation ne fabrique aucun statut normatif
    const ctx = adaptUniversalEntityToNormativeContext(ue);
    assert((ctx as any).status === undefined, "Universal Model ne produit pas de statut normatif autonome");
  });

  // =========================================================================
  // TEST 19: Non-régression complète ARCH-01
  // =========================================================================
  runTest("TEST 19 [ARCH-03]: Non-régression complète de la suite ARCH-01", () => {
    const arch01Res = runArch01IsometricNormativeBridgeTests();
    assert(arch01Res.success === true, `Suite ARCH-01 échouée (${arch01Res.testsFailed} échecs)`);
    assert(arch01Res.testsRun >= 15, `Suite ARCH-01 doit exécuter au moins 15 tests (exécuté ${arch01Res.testsRun})`);
  });

  // =========================================================================
  // TEST 20: Non-régression complète ARCH-02
  // =========================================================================
  runTest("TEST 20 [ARCH-03]: Non-régression complète de la suite ARCH-02", () => {
    const arch02Res = runArch02PmsAuthorityUnificationTests();
    assert(arch02Res.success === true, `Suite ARCH-02 échouée (${arch02Res.testsFailed} échecs)`);
    assert(arch02Res.testsRun >= 20, `Suite ARCH-02 doit exécuter au moins 20 tests (exécuté ${arch02Res.testsRun})`);
  });

  // =========================================================================
  // TEST 21 [ARCH-03-FIX-01]: Suppression des valeurs inventées pour IsoNode
  // =========================================================================
  runTest("TEST 21 [ARCH-03-FIX-01]: IsoNode sans métadonnées techniques ne crée aucune valeur par défaut inventée", () => {
    const bareNode: IsoNode = {
      id: "NODE_BARE_TEST",
      name: "Point géométrique pur",
      x: 5,
      y: 10,
      z: 15,
      type: "normal",
    };

    const ue = nodeToUniversalEntity(bareNode);
    assert(ue.pn.rating === undefined, `pn.rating doit être undefined (pas 'Class 150'), reçu: ${ue.pn.rating}`);
    assert(ue.material.grade === undefined, `material.grade doit être undefined (pas 'Acier API 5L X52'), reçu: ${ue.material.grade}`);
    assert(ue.material.schedule === undefined, `material.schedule doit être undefined (pas 'SCH 40 / STD'), reçu: ${ue.material.schedule}`);
    assert(ue.material.wallThicknessMm === undefined, `wallThicknessMm doit être undefined (pas 6.35), reçu: ${ue.material.wallThicknessMm}`);
    assert(ue.pn.designPressureBar === undefined, `designPressureBar doit être undefined (pas 16), reçu: ${ue.pn.designPressureBar}`);
    assert(ue.pn.operatingPressureBar === undefined, `operatingPressureBar doit être undefined (pas 10), reçu: ${ue.pn.operatingPressureBar}`);
    assert(ue.spec.pmsCode === undefined, `pmsCode doit être undefined (pas 'PMS-01'), reçu: ${ue.spec.pmsCode}`);
    assert(ue.documentation.manufacturer === undefined, `manufacturer doit être undefined, reçu: ${ue.documentation.manufacturer}`);
    assert(ue.dn.dn === undefined, `dn.dn doit être undefined quand absent, reçu: ${ue.dn.dn}`);
    assert(ue.normative?.pipingSpecId === undefined, `normative.pipingSpecId doit être undefined`);
    assert(ue.normative?.materialId === undefined, `normative.materialId doit être undefined`);
  });

  // =========================================================================
  // TEST 22 [ARCH-03-FIX-01]: Suppression des valeurs inventées pour IsoSegment
  // =========================================================================
  runTest("TEST 22 [ARCH-03-FIX-01]: IsoSegment sans données techniques ne crée aucune valeur par défaut inventée", () => {
    const bareSegment: IsoSegment = {
      id: "SEG_BARE_TEST",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      length: 5.0,
      dn: undefined as unknown as number,
      pn: undefined as unknown as string,
      material: undefined as unknown as string,
      fittings: [],
    };

    const ue = segmentToUniversalEntity(bareSegment);
    assert(ue.pn.rating === undefined, `pn.rating doit être undefined (pas 'Class 150'), reçu: ${ue.pn.rating}`);
    assert(ue.material.grade === undefined, `material.grade doit être undefined (pas 'Acier API 5L X52'), reçu: ${ue.material.grade}`);
    assert(ue.material.schedule === undefined, `material.schedule doit être undefined, reçu: ${ue.material.schedule}`);
    assert(ue.material.wallThicknessMm === undefined, `wallThicknessMm doit être undefined, reçu: ${ue.material.wallThicknessMm}`);
    assert(ue.spec.pmsCode === undefined, `pmsCode doit être undefined (pas 'PMS-01'), reçu: ${ue.spec.pmsCode}`);
    assert(ue.documentation.manufacturer === undefined, `manufacturer ne doit pas être 'Vallourec / Mannesmann', reçu: ${ue.documentation.manufacturer}`);
    assert(ue.specific.pipe?.insulationThicknessMm === undefined, `insulationThicknessMm ne doit pas être 30, reçu: ${ue.specific.pipe?.insulationThicknessMm}`);
  });

  // =========================================================================
  // TEST 23 [ARCH-03-FIX-01]: Suppression des valeurs inventées pour IsoFitting
  // =========================================================================
  runTest("TEST 23 [ARCH-03-FIX-01]: IsoFitting sans métadonnées ne crée aucune valeur par défaut inventée", () => {
    const bareFitting: IsoFitting = {
      id: "FIT_BARE_TEST",
      type: "vanne_passage_total",
      label: "Vanne",
      length: 0.2,
      localPosition: 0.5,
      cumulativePosition: 0.5,
      orientation: 0,
    };
    const bareSeg: IsoSegment = {
      id: "SEG_P",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      dn: 0,
      pn: "",
      material: "",
      length: 1,
      fittings: [],
    };

    const ue = fittingToUniversalEntity(bareFitting, bareSeg);
    assert(ue.pn.rating === undefined, `pn.rating doit être undefined, reçu: ${ue.pn.rating}`);
    assert(ue.material.grade === undefined, `material.grade doit être undefined, reçu: ${ue.material.grade}`);
    assert(ue.spec.pmsCode === undefined, `spec.pmsCode doit être undefined, reçu: ${ue.spec.pmsCode}`);
    assert(ue.specific.valve?.flowType === undefined, `valve.flowType doit être undefined`);
    assert(ue.specific.valve?.actuatorType === undefined, `valve.actuatorType doit être undefined`);
  });

  // =========================================================================
  // TEST 24 [ARCH-03-FIX-01]: Suppression des valeurs inventées pour Cad2dEntity
  // =========================================================================
  runTest("TEST 24 [ARCH-03-FIX-01]: Cad2dEntity ne génère pas de pseudo-matière ou pseudo-spec inventée", () => {
    const bareCad: Cad2dEntity = {
      id: "CAD_BARE_TEST",
      type: "line",
      layerId: "LAYER_0",
      color: "#ffffff",
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    };

    const ue = cad2dToUniversalEntity(bareCad);
    assert(ue.material.grade === undefined, `Cad material ne doit pas être 'Standard CAD', reçu: ${ue.material.grade}`);
    assert(ue.spec.pmsCode === undefined, `Cad spec ne doit pas être 'CAD-2D', reçu: ${ue.spec.pmsCode}`);
    assert(ue.pn.rating === undefined, `Cad pn ne doit pas être 'N/A', reçu: ${ue.pn.rating}`);
    assert(ue.dn.dn === undefined, `Cad dn ne doit pas être 0 par défaut, reçu: ${ue.dn.dn}`);
    assert(ue.service.code === undefined, `Cad service ne doit pas être 'DRAFT', reçu: ${ue.service.code}`);
  });

  // =========================================================================
  // TEST 25 [ARCH-03-FIX-01]: Suppression des valeurs inventées pour IsoPipingSupport
  // =========================================================================
  runTest("TEST 25 [ARCH-03-FIX-01]: IsoPipingSupport ne génère pas de fabricants ou charges inventées", () => {
    const bareSupport: IsoPipingSupport = {
      id: "SUP_BARE_TEST",
      tag: "S-01",
      segmentId: "SEG_1",
      tRatio: 0.5,
      distanceFromFromNodeM: 2.0,
      worldPos: { x: 1, y: 2, z: 3 },
      elevationZ: 3,
      type: "mss_type_35",
      orientationAngleDeg: 0,
      civilSpec: undefined as unknown as any,
    };

    const ue = supportToUniversalEntity(bareSupport);
    assert(ue.material.grade === undefined, `Support material ne doit pas être inventé, reçu: ${ue.material.grade}`);
    assert(ue.pn.rating === undefined, `Support pn ne doit pas être 'MSS SP-58', reçu: ${ue.pn.rating}`);
    assert(ue.spec.pmsCode === undefined, `Support spec ne doit pas être 'MSS-SP-58', reçu: ${ue.spec.pmsCode}`);
    assert(ue.documentation.manufacturer === undefined, `Support manufacturer ne doit pas être inventé, reçu: ${ue.documentation.manufacturer}`);
    assert(ue.specific.support?.loadCapacityKn === undefined, `Support loadCapacityKn ne doit pas être 15 par défaut, reçu: ${ue.specific.support?.loadCapacityKn}`);
  });

  // =========================================================================
  // TEST 26 [ARCH-03-FIX-02]: TEST A — DN présent, NPS absent
  // =========================================================================
  runTest("TEST 26 [ARCH-03-FIX-02]: TEST A — DN présent (100), NPS absent -> NPS/inch = undefined (pas de '4\"')", () => {
    const node: IsoNode = {
      id: "N_DN100_NO_NPS",
      name: "Node DN100",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 100,
    };
    const seg: IsoSegment = {
      id: "S_DN100_NO_NPS",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      length: 1,
      dn: 100,
      pn: "Class 150",
      material: "A106",
      fittings: [],
    };

    const ueNode = nodeToUniversalEntity(node);
    assert(ueNode.dn.dn === 100, "DN 100 transporté");
    assert(ueNode.dn.inch === undefined, `NPS/inch doit être strictement undefined, reçu: ${ueNode.dn.inch}`);

    const ueSeg = segmentToUniversalEntity(seg);
    assert(ueSeg.dn.dn === 100, "DN 100 transporté");
    assert(ueSeg.dn.inch === undefined, `NPS/inch doit être strictement undefined, reçu: ${ueSeg.dn.inch}`);
  });

  // =========================================================================
  // TEST 27 [ARCH-03-FIX-02]: TEST B — DN présent, OD absent
  // =========================================================================
  runTest("TEST 27 [ARCH-03-FIX-02]: TEST B — DN présent (100), OD absent -> outerDiameterMm = undefined", () => {
    const node: IsoNode = {
      id: "N_DN100_NO_OD",
      name: "Node DN100",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 100,
    };
    const seg: IsoSegment = {
      id: "S_DN100_NO_OD",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      length: 1,
      dn: 100,
      pn: "Class 150",
      material: "A106",
      fittings: [],
    };

    const ueNode = nodeToUniversalEntity(node);
    assert(ueNode.dn.outerDiameterMm === undefined, `outerDiameterMm doit être strictement undefined, reçu: ${ueNode.dn.outerDiameterMm}`);

    const ueSeg = segmentToUniversalEntity(seg);
    assert(ueSeg.dn.outerDiameterMm === undefined, `outerDiameterMm doit être strictement undefined, reçu: ${ueSeg.dn.outerDiameterMm}`);
  });

  // =========================================================================
  // TEST 28 [ARCH-03-FIX-02]: TEST C — DN ne produit jamais NPS (25, 50, 100, 150, 200, 300)
  // =========================================================================
  runTest("TEST 28 [ARCH-03-FIX-02]: TEST C — DN ne produit jamais NPS (vérification multi-diamètres 25, 50, 100, 150, 200, 300)", () => {
    const dns = [25, 50, 100, 150, 200, 300];
    for (const dn of dns) {
      const node: IsoNode = {
        id: `N_MULTI_${dn}`,
        name: `Node ${dn}`,
        x: 0,
        y: 0,
        z: 0,
        type: "normal",
        dn,
      };
      const seg: IsoSegment = {
        id: `S_MULTI_${dn}`,
        fromNodeId: "N1",
        toNodeId: "N2",
        type: "straight",
        length: 2,
        dn,
        pn: "PN16",
        material: "P235GH",
        fittings: [],
      };

      const ueNode = nodeToUniversalEntity(node);
      assert(ueNode.dn.inch === undefined, `DN ${dn} pour node ne doit pas produire de NPS, reçu: ${ueNode.dn.inch}`);

      const ueSeg = segmentToUniversalEntity(seg);
      assert(ueSeg.dn.inch === undefined, `DN ${dn} pour segment ne doit pas produire de NPS, reçu: ${ueSeg.dn.inch}`);
    }
  });

  // =========================================================================
  // TEST 29 [ARCH-03-FIX-02]: TEST D — DN ne produit jamais OD (25, 50, 100, 150, 200, 300)
  // =========================================================================
  runTest("TEST 29 [ARCH-03-FIX-02]: TEST D — DN ne produit jamais OD (vérification multi-diamètres 25, 50, 100, 150, 200, 300)", () => {
    const dns = [25, 50, 100, 150, 200, 300];
    for (const dn of dns) {
      const node: IsoNode = {
        id: `N_MULTI_OD_${dn}`,
        name: `Node ${dn}`,
        x: 0,
        y: 0,
        z: 0,
        type: "normal",
        dn,
      };
      const seg: IsoSegment = {
        id: `S_MULTI_OD_${dn}`,
        fromNodeId: "N1",
        toNodeId: "N2",
        type: "straight",
        length: 2,
        dn,
        pn: "PN16",
        material: "P235GH",
        fittings: [],
      };

      const ueNode = nodeToUniversalEntity(node);
      assert(ueNode.dn.outerDiameterMm === undefined, `DN ${dn} pour node ne doit pas produire d'OD, reçu: ${ueNode.dn.outerDiameterMm}`);

      const ueSeg = segmentToUniversalEntity(seg);
      assert(ueSeg.dn.outerDiameterMm === undefined, `DN ${dn} pour segment ne doit pas produire d'OD, reçu: ${ueSeg.dn.outerDiameterMm}`);
    }
  });

  // =========================================================================
  // TEST 30 [ARCH-03-FIX-02]: TEST E — NPS explicite conservé fidèlement
  // =========================================================================
  runTest("TEST 30 [ARCH-03-FIX-02]: TEST E — NPS explicite conservé fidèlement sans modification", () => {
    const rawNode: IsoNode & { inch?: string; nps?: string } = {
      id: "N_EXPLICIT_NPS",
      name: "Node with explicit NPS",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 100,
      inch: '4"',
    };
    const rawSeg: IsoSegment & { nps?: string } = {
      id: "S_EXPLICIT_NPS",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      length: 1,
      dn: 50,
      pn: "Class 300",
      material: "A106",
      fittings: [],
      nps: '2"',
    };

    const ueNode = nodeToUniversalEntity(rawNode);
    assert(ueNode.dn.inch === '4"', `NPS explicite node '4"' doit être conservé, reçu: ${ueNode.dn.inch}`);

    const ueSeg = segmentToUniversalEntity(rawSeg);
    assert(ueSeg.dn.inch === '2"', `NPS explicite segment '2"' doit être conservé, reçu: ${ueSeg.dn.inch}`);
  });

  // =========================================================================
  // TEST 31 [ARCH-03-FIX-02]: TEST F — OD explicite conservé fidèlement
  // =========================================================================
  runTest("TEST 31 [ARCH-03-FIX-02]: TEST F — OD explicite conservé fidèlement sans modification", () => {
    const rawNode: IsoNode & { outerDiameterMm?: number } = {
      id: "N_EXPLICIT_OD",
      name: "Node with explicit OD",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 100,
      outerDiameterMm: 114.3,
    };
    const rawSeg: IsoSegment & { od?: number } = {
      id: "S_EXPLICIT_OD",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      length: 1,
      dn: 50,
      pn: "Class 300",
      material: "A106",
      fittings: [],
      od: 60.3,
    };

    const ueNode = nodeToUniversalEntity(rawNode);
    assert(ueNode.dn.outerDiameterMm === 114.3, `OD explicite node 114.3 doit être conservé, reçu: ${ueNode.dn.outerDiameterMm}`);

    const ueSeg = segmentToUniversalEntity(rawSeg);
    assert(ueSeg.dn.outerDiameterMm === 60.3, `OD explicite segment 60.3 doit être conservé, reçu: ${ueSeg.dn.outerDiameterMm}`);
  });

  // =========================================================================
  // TEST 32 [ARCH-03-FIX-02]: TEST G — Aucun calcul dimensionnel implicite
  // =========================================================================
  runTest("TEST 32 [ARCH-03-FIX-02]: TEST G — Source avec uniquement DN ne produit aucun calcul implicite (NPS, OD, wallThickness, schedule)", () => {
    const bareDnNode: IsoNode = {
      id: "N_BARE_DN",
      name: "Bare DN Node",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 80,
    };

    const ue = nodeToUniversalEntity(bareDnNode);
    assert(ue.dn.dn === 80, "DN transporté");
    assert(ue.dn.inch === undefined, "inch undefined");
    assert(ue.dn.outerDiameterMm === undefined, "outerDiameterMm undefined");
    assert(ue.material.schedule === undefined, "schedule undefined");
    assert(ue.material.wallThicknessMm === undefined, "wallThicknessMm undefined");
    assert(ue.pn.rating === undefined, "pn rating undefined");
    assert(ue.normative?.nominalSize === undefined, "normative nominalSize undefined (pas de déduction String(dn))");
  });

  // =========================================================================
  // TEST 33 [ARCH-03-FIX-02]: TEST H — Aucun evidence fabriqué
  // =========================================================================
  runTest("TEST 33 [ARCH-03-FIX-02]: TEST H — Aucune evidenceId ou date de vérification fabriquée", () => {
    const node: IsoNode = {
      id: "N_NO_EVIDENCE",
      name: "Node",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 100,
    };

    const ue = nodeToUniversalEntity(node);
    assert(ue.normative?.evidenceIds === undefined, "evidenceIds reste undefined");
    assert((ue.normative as any)?.verifiedAt === undefined, "verifiedAt reste undefined");
    assert((ue.normative as any)?.verifiedBy === undefined, "verifiedBy reste undefined");
  });

  // =========================================================================
  // TEST 34 [ARCH-03-FIX-02]: TEST I — Immutabilité des entités sources
  // =========================================================================
  runTest("TEST 34 [ARCH-03-FIX-02]: TEST I — L'adapter ne mute pas les objets IsoNode et IsoSegment", () => {
    const originalNode: IsoNode = Object.freeze({
      id: "NODE_IMMUTABLE",
      name: "Immutable Node",
      x: 10,
      y: 20,
      z: 30,
      type: "normal",
      dn: 100,
    });
    const originalSegment: IsoSegment = Object.freeze({
      id: "SEG_IMMUTABLE",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      length: 5,
      dn: 100,
      pn: "Class 150",
      material: "A106",
      fittings: Object.freeze([]) as any,
    });

    const snapNodeBefore = JSON.stringify(originalNode);
    const snapSegBefore = JSON.stringify(originalSegment);

    const ueNode = nodeToUniversalEntity(originalNode);
    const ueSeg = segmentToUniversalEntity(originalSegment);

    assert(JSON.stringify(originalNode) === snapNodeBefore, "IsoNode n'a pas été muté");
    assert(JSON.stringify(originalSegment) === snapSegBefore, "IsoSegment n'a pas été muté");
    assert(ueNode.dn.inch === undefined, "ueNode.dn.inch est undefined");
    assert(ueSeg.dn.inch === undefined, "ueSeg.dn.inch est undefined");
  });

  return Object.freeze({
    success: testsFailed === 0 && testsRun >= 34,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
