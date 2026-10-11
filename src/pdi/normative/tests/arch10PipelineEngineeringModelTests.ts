/**
 * PDI ENGINEERING PLATFORM — ARCH-10 PIPELINE ENGINEERING MODEL TEST SUITE
 * Reference: ARCH-10 (Pipeline Engineering Model)
 *
 * Suite complète de validation déterministe pour ARCH-10 :
 * 1. Création et validation d'un système de pipeline valide (PipelineSystem).
 * 2. Création et validation d'un tronçon valide (PipelineSegment) avec unités explicites.
 * 3. Validation d'un réseau comportant plusieurs nœuds et tronçons (linéaire, embranchement, boucle, nœud isolé).
 * 4. Rejet des identifiants dupliqués (nœuds dupliqués, tronçons dupliqués, collision nœud/tronçon).
 * 5. Rejet d'une référence à un nœud inexistant (startNodeId / endNodeId inconnu).
 * 6. Rejet d'une référence à un tronçon inexistant ou incohérent (connectedSegmentIds).
 * 7. Rejet d'une relation inter-systèmes incohérente (node.systemId !== system.id, segment.systemId !== system.id).
 * 8. Rejet des longueurs négatives ou nulles, des valeurs numériques non finies (NaN, Infinity) et des unités absentes.
 * 9. Traitement explicite des champs facultatifs et des données non vérifiées (DECLARED_UNVERIFIED).
 * 10. Vérification que les objets d'entrée ne sont jamais modifiés par le validateur.
 * 11. Vérification qu'un matériau ou un fluide déclaré (GN, H2, GN/H2, hydrocarbures) n'est jamais automatiquement qualifié.
 * 12. Non-régression du registre de domaines (ARCH-08) et du Multi-Code Resolver (ARCH-09).
 * 13. Vérification qu'aucun calcul B31.8, B31.12, B31.4 ou ISO-13623 n'est déclaré disponible par cette implémentation.
 * 14. Séparation stricte des couches (rejet des champs commerciaux/prix et des identités de clients historiques).
 * 15. Compatibilité non destructive avec PdiUniversalEntity sans création de PipelineUniversalEntity.
 */

import {
  createPipelineNode,
  createPipelineSegment,
  createPipelineSystem,
  getIncidentSegmentsForNode,
  resolveEffectiveSegmentService,
  attachPipelineSegmentToUniversalEntity,
} from "../../engineering/model/pipelineEngineeringModel";
import {
  validatePipelineNode,
  validatePipelineSegment,
  validatePipelineSystem,
} from "../../engineering/validators/pipelineEngineeringModelValidator";
import type {
  PipelineNode,
  PipelineSegment,
  PipelineSystem,
} from "../../engineering/types/pipelineEngineeringModelTypes";
import {
  defaultEngineeringDomainRegistry,
  PIPELINE_DOMAIN_DESCRIPTOR,
  PIPING_DOMAIN_DESCRIPTOR,
  validateDomainBoundary,
  detectDuplicateUniversalModelAntiPattern,
  getDomainAttributes,
} from "../../engineering";
import type { PipelineDomainAttributes } from "../../engineering";
import type { PdiUniversalEntity } from "../../model/pdiUniversalEntity";
import {
  DESIGN_CODE_CALCULATION_REGISTRY,
  getDesignCodeCalculationEntry,
} from "../registry/designCodeRegistry";
import { resolveApplicableDesignCode } from "../engine/multiCodeResolver";
import { runArch08MultiDomainArchitectureTests } from "./arch08MultiDomainArchitectureTests";
import { runArch09MultiCodeResolverTests } from "./arch09MultiCodeResolverTests";

export interface Arch10TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-10 ASSERTION FAILED] ${message}`);
  }
}

export function runArch10PipelineEngineeringModelTests(): Arch10TestResult {
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
  // TEST 01 : CRÉATION ET VALIDATION D'UN SYSTÈME DE PIPELINE VALIDE
  // =========================================================================
  runTest("TEST 01 [ARCH-10]: Création et validation d'un PipelineSystem valide", () => {
    const n1 = createPipelineNode({
      id: "NODE-KP000",
      systemId: "SYS-PIPE-01",
      name: "Terminal Départ KP 0.000",
      kind: "TERMINAL_INLET",
      stationPoint: { value: 0, unit: "km" },
      coordinates: { x: 0, y: 0, z: 120, elevation: 120, unit: "m" },
      connectedSegmentIds: ["SEG-001"],
    });

    const n2 = createPipelineNode({
      id: "NODE-KP025",
      systemId: "SYS-PIPE-01",
      name: "Terminal Arrivée KP 25.500",
      kind: "TERMINAL_OUTLET",
      stationPoint: { value: 25.5, unit: "km" },
      coordinates: { x: 25500, y: 400, z: 145, elevation: 145, unit: "m" },
      connectedSegmentIds: ["SEG-001"],
    });

    const s1 = createPipelineSegment({
      id: "SEG-001",
      systemId: "SYS-PIPE-01",
      name: "Tronçon Principal KP 0 - KP 25.5",
      startNodeId: "NODE-KP000",
      endNodeId: "NODE-KP025",
      length: { value: 25.5, unit: "km" },
      dimensions: {
        nominalDiameter: { value: 600, unit: "mm" },
        outerDiameter: { value: 610, unit: "mm" },
        wallThickness: { value: 12.7, unit: "mm" },
      },
      material: {
        materialId: "MAT_API_5L_X65_PSL2",
        standardCode: "API-5L",
        grade: "X65",
        designation: "API 5L X65 PSL2",
      },
      flowDirection: "START_TO_END",
      domainAttributes: {
        kilometerPointStart: 0,
        kilometerPointEnd: 25.5,
        burialDepthMeters: 1.2,
        classLocation: 1,
        crossingType: "open_trench",
      },
    });

    const system = createPipelineSystem({
      id: "SYS-PIPE-01",
      name: "Réseau Transport Gaz Principal Section Nord",
      projectId: "PRJ-2026-001",
      service: {
        fluidCategory: "NATURAL_GAS",
        serviceCode: "NG-HP",
        phase: "GAS",
        designPressure: { value: 85, unit: "bar" },
        operatingPressure: { value: 70, unit: "bar" },
        designTemperature: { value: 60, unit: "C" },
      },
      nodes: [n1, n2],
      segments: [s1],
      traceabilityRefs: {
        designCodeRef: "ASME-B31.8",
        sourceDocumentIds: ["DOC-BASIS-01"],
        evidenceIds: ["EVID-ROUTE-01"],
      },
    });

    const validation = validatePipelineSystem(system);
    assert(validation.valid === true, `Validation attendue valide, erreurs: ${JSON.stringify(validation.errors)}`);
    assert(validation.structuralValidationState === "STRUCTURALLY_VALID", "État attendu STRUCTURALLY_VALID");
    assert(validation.errors.length === 0, "Aucune erreur attendue");
    assert(validation.topologySummary.nodeCount === 2, "2 nœuds attendus");
    assert(validation.topologySummary.segmentCount === 1, "1 tronçon attendu");
    assert(validation.topologySummary.isolatedNodeIds.length === 0, "Aucun nœud isolé");
    assert(validation.topologySummary.connectedComponentCount === 1, "1 composante connexe");
    assert(validation.topologySummary.hasLoops === false, "Aucune boucle");
    assert(validation.normativeQualificationPerformed === false, "Aucune qualification normative effectuée");
    assert(validation.calculationExecuted === false, "Aucun calcul exécuté");
    assert(Object.isFrozen(system), "PipelineSystem doit être gelé");
    assert(Object.isFrozen(validation), "PipelineSystemValidationResult doit être gelé");
  });

  // =========================================================================
  // TEST 02 : CRÉATION ET VALIDATION D'UN TRONÇON VALIDE AVEC UNITÉS EXPLICITES
  // =========================================================================
  runTest("TEST 02 [ARCH-10]: Création et validation d'un PipelineSegment valide sans conversion implicite d'unités", () => {
    const segImperial = createPipelineSegment({
      id: "SEG-IMP-01",
      systemId: "SYS-IMP",
      name: "24-inch Liquid Hydrocarbon Segment",
      startNodeId: "N-START",
      endNodeId: "N-END",
      length: { value: 12.4, unit: "mi" },
      dimensions: {
        nominalDiameter: { value: 24, unit: "in" },
        outerDiameter: { value: 24, unit: "in" },
        wallThickness: { value: 0.5, unit: "in" },
        corrosionAllowance: { value: 0.0625, unit: "in" },
        schedule: "STD",
      },
      service: {
        fluidCategory: "LIQUID_HYDROCARBON",
        phase: "LIQUID",
        designPressure: { value: 1480, unit: "psi" },
        designTemperature: { value: 120, unit: "F" },
      },
    });

    const segErrors = validatePipelineSegment(segImperial, "SYS-IMP");
    assert(segErrors.length === 0, `Aucune erreur attendue sur le tronçon impérial: ${JSON.stringify(segErrors)}`);
    // Vérification qu'aucune conversion silencieuse vers mm, m ou bar n'a eu lieu
    assert(segImperial.length?.value === 12.4 && segImperial.length?.unit === "mi", "Longueur conservée en miles");
    assert(
      segImperial.dimensions?.outerDiameter?.value === 24 &&
        segImperial.dimensions?.outerDiameter?.unit === "in",
      "Diamètre conservé en pouces"
    );
    assert(
      segImperial.service?.designPressure?.value === 1480 &&
        segImperial.service?.designPressure?.unit === "psi",
      "Pression conservée en psi"
    );
  });

  // =========================================================================
  // TEST 03 : VALIDATION D'UN RÉSEAU MULTI-NŒUDS ET MULTI-TRONÇONS (BRANCHES, BOUCLES, NŒUD ISOLÉ)
  // =========================================================================
  runTest("TEST 03 [ARCH-10]: Validation d'un réseau complexe (embranchement, boucle maillée, nœud isolé autorisé)", () => {
    const sysId = "SYS-NET-03";
    const nodes: PipelineNode[] = [
      createPipelineNode({ id: "N1", systemId: sysId, name: "Inlet Station", kind: "TERMINAL_INLET" }),
      createPipelineNode({ id: "N2", systemId: sysId, name: "Block Valve Station 1", kind: "BLOCK_VALVE_STATION" }),
      createPipelineNode({ id: "N3", systemId: sysId, name: "Junction Tee", kind: "JUNCTION" }),
      createPipelineNode({ id: "N4", systemId: sysId, name: "Delivery Station A", kind: "METERING_REGULATING_STATION" }),
      createPipelineNode({ id: "N5-ISOLATED", systemId: sysId, name: "Future Tie-In Node", kind: "TRANSITION_POINT" }),
    ];

    // S1: N1->N2, S2: N2->N3, S3: N3->N4, S4 (loop): N2->N4
    const segments: PipelineSegment[] = [
      createPipelineSegment({ id: "S1", systemId: sysId, name: "Seg 1", startNodeId: "N1", endNodeId: "N2", length: { value: 5000, unit: "m" } }),
      createPipelineSegment({ id: "S2", systemId: sysId, name: "Seg 2", startNodeId: "N2", endNodeId: "N3", length: { value: 8200, unit: "m" } }),
      createPipelineSegment({ id: "S3", systemId: sysId, name: "Seg 3", startNodeId: "N3", endNodeId: "N4", length: { value: 3100, unit: "m" } }),
      createPipelineSegment({ id: "S4", systemId: sysId, name: "Seg 4 Parallel Loop", startNodeId: "N2", endNodeId: "N4", length: { value: 10500, unit: "m" } }),
    ];

    const system = createPipelineSystem({
      id: sysId,
      name: "Looped Transmission Network with Future Tie-In",
      nodes,
      segments,
    });

    const res = validatePipelineSystem(system);
    assert(res.valid === true, "Une topologie avec boucle et nœud de piquage futur isolé est structurellement valide");
    assert(res.topologySummary.nodeCount === 5, "5 nœuds");
    assert(res.topologySummary.segmentCount === 4, "4 tronçons");
    assert(res.topologySummary.hasLoops === true, "Boucle détectée (N2-N3-N4-N2)");
    assert(
      res.topologySummary.isolatedNodeIds.length === 1 &&
        res.topologySummary.isolatedNodeIds[0] === "N5-ISOLATED",
      "N5-ISOLATED identifié comme nœud isolé"
    );
    assert(res.topologySummary.connectedComponentCount === 2, "2 composantes connexes (réseau principal + nœud isolé)");
    assert(
      res.topologyNotices.some((n) => n.code === "ISOLATED_NODE_DETECTED"),
      "Notice ISOLATED_NODE_DETECTED émise"
    );
    assert(
      res.topologyNotices.some((n) => n.code === "LOOP_TOPOLOGY_DETECTED"),
      "Notice LOOP_TOPOLOGY_DETECTED émise"
    );
    assert(
      res.topologyNotices.some((n) => n.code === "DISCONNECTED_SUBNETWORKS_DETECTED"),
      "Notice DISCONNECTED_SUBNETWORKS_DETECTED émise"
    );

    const incidentN2 = getIncidentSegmentsForNode(system, "N2");
    assert(incidentN2.length === 3, "N2 est connecté à S1, S2 et S4");
  });

  // =========================================================================
  // TEST 04 : REJET DES IDENTIFIANTS DUPLIQUÉS
  // =========================================================================
  runTest("TEST 04 [ARCH-10]: Rejet des identifiants dupliqués (nœuds, tronçons et collision nœud/tronçon)", () => {
    const sysId = "SYS-DUP";
    const systemDupNodes = createPipelineSystem({
      id: sysId,
      name: "System Duplicate Ids",
      nodes: [
        createPipelineNode({ id: "DUP-N1", systemId: sysId, name: "Node A" }),
        createPipelineNode({ id: "DUP-N1", systemId: sysId, name: "Node B Duplicate" }),
        createPipelineNode({ id: "N2", systemId: sysId, name: "Node 2" }),
      ],
      segments: [
        createPipelineSegment({ id: "DUP-S1", systemId: sysId, name: "Seg A", startNodeId: "DUP-N1", endNodeId: "N2" }),
        createPipelineSegment({ id: "DUP-S1", systemId: sysId, name: "Seg B Duplicate", startNodeId: "DUP-N1", endNodeId: "N2" }),
        createPipelineSegment({ id: "N2", systemId: sysId, name: "Seg colliding with Node ID", startNodeId: "DUP-N1", endNodeId: "N2" }),
      ],
    });

    const res = validatePipelineSystem(systemDupNodes);
    assert(res.valid === false, "Le système contenant des IDs dupliqués doit être invalide");
    assert(res.structuralValidationState === "STRUCTURALLY_INVALID", "État STRUCTURALLY_INVALID attendu");
    assert(
      res.errors.some((e) => e.code === "DUPLICATE_NODE_ID" && e.entityId === "DUP-N1"),
      "Erreur DUPLICATE_NODE_ID attendue pour DUP-N1"
    );
    assert(
      res.errors.some((e) => e.code === "DUPLICATE_SEGMENT_ID" && e.entityId === "DUP-S1"),
      "Erreur DUPLICATE_SEGMENT_ID attendue pour DUP-S1"
    );
    assert(
      res.errors.some((e) => e.code === "DUPLICATE_SEGMENT_ID" && e.entityId === "N2"),
      "Collision d'ID entre nœud et tronçon détectée"
    );
  });

  // =========================================================================
  // TEST 05 : REJET D'UNE RÉFÉRENCE À UN NŒUD INEXISTANT
  // =========================================================================
  runTest("TEST 05 [ARCH-10]: Rejet d'un tronçon référençant un nœud de départ ou d'arrivée inexistant", () => {
    const sysId = "SYS-MISSING-NODE";
    const system = createPipelineSystem({
      id: sysId,
      name: "System With Missing Node Refs",
      nodes: [createPipelineNode({ id: "N-KNOWN", systemId: sysId, name: "Known Node" })],
      segments: [
        createPipelineSegment({
          id: "S-BAD-START",
          systemId: sysId,
          name: "Bad Start Node Segment",
          startNodeId: "N-GHOST-START",
          endNodeId: "N-KNOWN",
        }),
        createPipelineSegment({
          id: "S-BAD-END",
          systemId: sysId,
          name: "Bad End Node Segment",
          startNodeId: "N-KNOWN",
          endNodeId: "N-GHOST-END",
        }),
      ],
    });

    const res = validatePipelineSystem(system);
    assert(res.valid === false, "Doit rejeter les références de nœuds inexistants");
    assert(
      res.errors.some(
        (e) => e.code === "SEGMENT_REFERENCES_UNKNOWN_START_NODE" && e.entityId === "S-BAD-START"
      ),
      "SEGMENT_REFERENCES_UNKNOWN_START_NODE attendu"
    );
    assert(
      res.errors.some(
        (e) => e.code === "SEGMENT_REFERENCES_UNKNOWN_END_NODE" && e.entityId === "S-BAD-END"
      ),
      "SEGMENT_REFERENCES_UNKNOWN_END_NODE attendu"
    );
  });

  // =========================================================================
  // TEST 06 : REJET D'UNE RÉFÉRENCE À UN TRONÇON INEXISTANT OU D'UNE INCIDENCE INCOHÉRENTE
  // =========================================================================
  runTest("TEST 06 [ARCH-10]: Rejet d'une référence à un tronçon inexistant et d'une incohérence nœud <-> tronçon", () => {
    const sysId = "SYS-BAD-SEG-REF";
    const system = createPipelineSystem({
      id: sysId,
      name: "System With Bad Segment Refs",
      nodes: [
        createPipelineNode({
          id: "N1",
          systemId: sysId,
          name: "Node 1",
          connectedSegmentIds: ["S1", "S-NON-EXISTENT"],
        }),
        createPipelineNode({
          id: "N2",
          systemId: sysId,
          name: "Node 2",
          // Omet S1 alors que S1 est connecté à N2
          connectedSegmentIds: [],
        }),
        createPipelineNode({
          id: "N3",
          systemId: sysId,
          name: "Node 3",
          // Prétend être connecté à S1 alors que S1 relie N1 à N2
          connectedSegmentIds: ["S1"],
        }),
      ],
      segments: [
        createPipelineSegment({
          id: "S1",
          systemId: sysId,
          name: "Segment 1-2",
          startNodeId: "N1",
          endNodeId: "N2",
        }),
      ],
    });

    const res = validatePipelineSystem(system);
    assert(res.valid === false, "Doit rejeter les références de tronçons inexistantes ou incohérentes");
    assert(
      res.errors.some((e) => e.code === "NODE_REFERENCES_UNKNOWN_SEGMENT" && e.entityId === "N1"),
      "NODE_REFERENCES_UNKNOWN_SEGMENT attendu pour N1 -> S-NON-EXISTENT"
    );
    assert(
      res.errors.some((e) => e.code === "NODE_SEGMENT_INCIDENCE_MISMATCH" && e.entityId === "N2"),
      "NODE_SEGMENT_INCIDENCE_MISMATCH attendu pour N2 (S1 omis de connectedSegmentIds)"
    );
    assert(
      res.errors.some((e) => e.code === "NODE_SEGMENT_INCIDENCE_MISMATCH" && e.entityId === "N3"),
      "NODE_SEGMENT_INCIDENCE_MISMATCH attendu pour N3 (S1 non incident à N3)"
    );
  });

  // =========================================================================
  // TEST 07 : REJET D'UNE RELATION INTER-SYSTÈMES INCOHÉRENTE ET D'UNE AUTO-BOUCLE DE TRONÇON
  // =========================================================================
  runTest("TEST 07 [ARCH-10]: Rejet des relations inter-systèmes incohérentes et d'un tronçon auto-bouclé", () => {
    const system = createPipelineSystem({
      id: "SYS-ALPHA",
      name: "System Alpha",
      nodes: [
        createPipelineNode({ id: "N1", systemId: "SYS-ALPHA", name: "Node Alpha 1" }),
        createPipelineNode({ id: "N2", systemId: "SYS-BETA-FOREIGN", name: "Node Beta Foreign" }),
      ],
      segments: [
        createPipelineSegment({
          id: "S-FOREIGN",
          systemId: "SYS-GAMMA-FOREIGN",
          name: "Foreign Segment",
          startNodeId: "N1",
          endNodeId: "N2",
        }),
        createPipelineSegment({
          id: "S-SELF-LOOP",
          systemId: "SYS-ALPHA",
          name: "Self Loop Segment",
          startNodeId: "N1",
          endNodeId: "N1",
        }),
      ],
    });

    const res = validatePipelineSystem(system);
    assert(res.valid === false, "Doit rejeter les incohérences inter-systèmes et auto-boucles");
    assert(
      res.errors.some((e) => e.code === "NODE_SYSTEM_ID_MISMATCH" && e.entityId === "N2"),
      "NODE_SYSTEM_ID_MISMATCH attendu pour N2"
    );
    assert(
      res.errors.some((e) => e.code === "SEGMENT_SYSTEM_ID_MISMATCH" && e.entityId === "S-FOREIGN"),
      "SEGMENT_SYSTEM_ID_MISMATCH attendu pour S-FOREIGN"
    );
    assert(
      res.errors.some((e) => e.code === "SEGMENT_SELF_LOOP_NOT_ALLOWED" && e.entityId === "S-SELF-LOOP"),
      "SEGMENT_SELF_LOOP_NOT_ALLOWED attendu pour S-SELF-LOOP"
    );
  });

  // =========================================================================
  // TEST 08 : REJET DES LONGUEURS NÉGATIVES/NULLES, VALEURS NON FINIES ET UNITÉS ABSENTES
  // =========================================================================
  runTest("TEST 08 [ARCH-10]: Rejet des longueurs négatives ou nulles, de NaN/Infinity et des grandeurs sans unité explicite", () => {
    const sysId = "SYS-PHYS";
    const badSystem: PipelineSystem = {
      id: sysId,
      name: "Invalid Physical Values System",
      engineeringDomain: "PIPELINE",
      nodes: [
        {
          id: "N1",
          systemId: sysId,
          name: "Node 1",
          coordinates: { x: Number.NaN, y: 100, unit: "m" },
        },
        {
          id: "N2",
          systemId: sysId,
          name: "Node 2",
          stationPoint: { value: Number.POSITIVE_INFINITY, unit: "km" },
        },
      ],
      segments: [
        {
          id: "S-NEG-LEN",
          systemId: sysId,
          name: "Negative Length Segment",
          startNodeId: "N1",
          endNodeId: "N2",
          length: { value: -150, unit: "m" },
          dimensions: {
            outerDiameter: { value: 500, unit: "mm" },
            // 2 * 300 >= 500 -> incohérence géométrique
            wallThickness: { value: 300, unit: "mm" },
          },
        },
        {
          id: "S-ZERO-LEN-NO-UNIT",
          systemId: sysId,
          name: "Zero Length and Missing Unit Segment",
          startNodeId: "N1",
          endNodeId: "N2",
          length: { value: 0, unit: "" as unknown as "m" },
          dimensions: {
            nominalDiameter: { value: Number.NaN, unit: "mm" },
          },
        },
      ],
    };

    const res = validatePipelineSystem(badSystem);
    assert(res.valid === false, "Doit rejeter les valeurs physiques invalides");
    assert(
      res.errors.some((e) => e.code === "NEGATIVE_OR_ZERO_SEGMENT_LENGTH" && e.entityId === "S-NEG-LEN"),
      "NEGATIVE_OR_ZERO_SEGMENT_LENGTH attendu pour longueur -150"
    );
    assert(
      res.errors.some(
        (e) => e.code === "NEGATIVE_OR_ZERO_SEGMENT_LENGTH" && e.entityId === "S-ZERO-LEN-NO-UNIT"
      ),
      "NEGATIVE_OR_ZERO_SEGMENT_LENGTH attendu pour longueur 0"
    );
    assert(
      res.errors.some((e) => e.code === "MISSING_EXPLICIT_PHYSICAL_UNIT" && e.entityId === "S-ZERO-LEN-NO-UNIT"),
      "MISSING_EXPLICIT_PHYSICAL_UNIT attendu pour unité vide"
    );
    assert(
      res.errors.some((e) => e.code === "NON_FINITE_NUMERIC_VALUE" && e.entityId === "N1"),
      "NON_FINITE_NUMERIC_VALUE attendu pour coordinates.x = NaN"
    );
    assert(
      res.errors.some((e) => e.code === "NON_FINITE_NUMERIC_VALUE" && e.entityId === "N2"),
      "NON_FINITE_NUMERIC_VALUE attendu pour stationPoint.value = Infinity"
    );
    assert(
      res.errors.some((e) => e.code === "INVALID_PHYSICAL_QUANTITY" && e.entityId === "S-NEG-LEN"),
      "INVALID_PHYSICAL_QUANTITY attendu lorsque 2 * wallThickness >= outerDiameter"
    );
  });

  // =========================================================================
  // TEST 09 : TRAITEMENT EXPLICITE DES CHAMPS FACULTATIFS ET DES DONNÉES NON VÉRIFIÉES
  // =========================================================================
  runTest("TEST 09 [ARCH-10]: Traitement explicite des champs facultatifs sans valeurs par défaut arbitraires et maintien de DECLARED_UNVERIFIED", () => {
    const n1 = createPipelineNode({ id: "N-MIN-1", systemId: "SYS-MIN", name: "Minimal Node 1" });
    const n2 = createPipelineNode({ id: "N-MIN-2", systemId: "SYS-MIN", name: "Minimal Node 2" });
    const sMin = createPipelineSegment({
      id: "S-MIN-1",
      systemId: "SYS-MIN",
      name: "Minimal Segment Without Optional Physical Fields",
      startNodeId: "N-MIN-1",
      endNodeId: "N-MIN-2",
    });

    const sysMin = createPipelineSystem({
      id: "SYS-MIN",
      name: "Hydrogen Conversion Project Phase 1", // Le nom mentionne Hydrogen, mais aucun fluide ne doit être déduit !
      nodes: [n1, n2],
      segments: [sMin],
    });

    const res = validatePipelineSystem(sysMin);
    assert(res.valid === true, "Un système minimal sans champs facultatifs doit être structurellement valide");

    // Vérification qu'aucune valeur physique par défaut arbitraire n'a été inventée
    assert(sMin.length === undefined, "Aucune longueur par défaut ne doit être inventée");
    assert(sMin.dimensions === undefined, "Aucune dimension par défaut ne doit être inventée");
    assert(sMin.material === undefined, "Aucun matériau par défaut ne doit être inventé");
    assert(sMin.service === undefined, "Aucun service par défaut ne doit être inventé sur le tronçon");
    assert(
      sysMin.service === undefined,
      "Le fluide ne doit JAMAIS être déduit à partir du nom du système ('Hydrogen Conversion Project Phase 1')"
    );
    assert(
      resolveEffectiveSegmentService(sysMin, sMin) === undefined,
      "resolveEffectiveSegmentService doit retourner undefined si aucun fluide n'est déclaré"
    );
  });

  // =========================================================================
  // TEST 10 : NON-MUTATION DES OBJETS D'ENTRÉE PAR LE VALIDATEUR
  // =========================================================================
  runTest("TEST 10 [ARCH-10]: Le validateur ne modifie ni ne répare silencieusement les objets reçus en entrée", () => {
    const mutableRawInput = {
      id: "SYS-MUT-CHECK",
      name: "System Mutation Check",
      engineeringDomain: "PIPELINE" as const,
      service: {
        fluidCategory: "NATURAL_GAS_HYDROGEN_BLEND" as const,
        hydrogenMoleFractionPercent: 20,
      },
      nodes: [
        { id: "N1", systemId: "SYS-MUT-CHECK", name: "Node 1" },
        { id: "N2", systemId: "SYS-MUT-CHECK", name: "Node 2" },
      ],
      segments: [
        {
          id: "S1",
          systemId: "SYS-MUT-CHECK",
          name: "Segment 1",
          startNodeId: "N1",
          endNodeId: "N-UNKNOWN-ON-PURPOSE",
          length: { value: -42, unit: "m" as const },
        },
      ],
    };

    const snapshotBefore = JSON.stringify(mutableRawInput);
    const validationResult = validatePipelineSystem(mutableRawInput);
    const snapshotAfter = JSON.stringify(mutableRawInput);

    assert(validationResult.valid === false, "L'entrée invalide doit être rejetée");
    assert(
      snapshotBefore === snapshotAfter,
      "L'objet passé à validatePipelineSystem ne doit subir aucune mutation"
    );
  });

  // =========================================================================
  // TEST 11 : DISTINCTION DES FLUIDES (GN, H2, GN/H2, LIQUIDES) ET ABSENCE DE QUALIFICATION AUTOMATIQUE MATÉRIAU/H2
  // =========================================================================
  runTest("TEST 11 [ARCH-10]: Distinction stricte GN / H2 / GN-H2 / Hydrocarbures et interdiction de qualification automatique matériau ou compatibilité H2", () => {
    const sysId = "SYS-FLUIDS";
    const n1 = createPipelineNode({ id: "N1", systemId: sysId, name: "N1" });
    const n2 = createPipelineNode({ id: "N2", systemId: sysId, name: "N2" });
    const n3 = createPipelineNode({ id: "N3", systemId: sysId, name: "N3" });
    const n4 = createPipelineNode({ id: "N4", systemId: sysId, name: "N4" });

    const segNG = createPipelineSegment({
      id: "SEG-NG",
      systemId: sysId,
      name: "Natural Gas Segment",
      startNodeId: "N1",
      endNodeId: "N2",
      service: { fluidCategory: "NATURAL_GAS", phase: "GAS" },
      material: { standardCode: "API-5L", grade: "X60" },
    });

    const segH2 = createPipelineSegment({
      id: "SEG-H2",
      systemId: sysId,
      name: "Pure Hydrogen Segment",
      startNodeId: "N2",
      endNodeId: "N3",
      service: { fluidCategory: "HYDROGEN", phase: "GAS", hydrogenMoleFractionPercent: 100 },
      material: { materialId: "MAT_API_5L_X52_H2_CANDIDATE", standardCode: "API-5L", grade: "X52" },
    });

    const segBlend = createPipelineSegment({
      id: "SEG-BLEND",
      systemId: sysId,
      name: "NG/H2 Blend 15% Segment",
      startNodeId: "N3",
      endNodeId: "N4",
      service: {
        fluidCategory: "NATURAL_GAS_HYDROGEN_BLEND",
        phase: "GAS",
        hydrogenMoleFractionPercent: 15,
      },
      material: { standardCode: "API-5L", grade: "X65" },
    });

    // Vérification des statuts non qualifiés / non vérifiés sur les objets créés
    assert(segNG.service?.fluidCategory === "NATURAL_GAS", "Catégorie NATURAL_GAS distincte");
    assert(segH2.service?.fluidCategory === "HYDROGEN", "Catégorie HYDROGEN distincte");
    assert(
      segBlend.service?.fluidCategory === "NATURAL_GAS_HYDROGEN_BLEND",
      "Catégorie NATURAL_GAS_HYDROGEN_BLEND distincte"
    );
    assert(
      segH2.service?.verificationState === "DECLARED_UNVERIFIED",
      "Le service H2 reste strictement DECLARED_UNVERIFIED"
    );
    assert(
      segH2.material?.normativeQualificationStatus === "NOT_EVALUATED_IN_ENGINEERING_MODEL",
      "Le matériau X52 n'est PAS qualifié normativement par sa déclaration"
    );
    assert(
      segH2.material?.fluidCompatibilityStatus === "NOT_EVALUATED_IN_ENGINEERING_MODEL",
      "Le matériau X52 (même nommé H2_CANDIDATE) n'est PAS déclaré compatible H2"
    );

    const validSys = createPipelineSystem({
      id: sysId,
      name: "Multi-Fluid Segments System",
      nodes: [n1, n2, n3, n4],
      segments: [segNG, segH2, segBlend],
    });
    assert(validatePipelineSystem(validSys).valid === true, "Système multi-fluides valide");

    // Rejet d'un mélange NATURAL_GAS_HYDROGEN_BLEND avec fraction H2 invalide (0% ou 100% ou >100%)
    const invalidBlendSeg = {
      ...segBlend,
      service: {
        fluidCategory: "NATURAL_GAS_HYDROGEN_BLEND" as const,
        hydrogenMoleFractionPercent: 0,
      },
    };
    const blendErrors = validatePipelineSegment(invalidBlendSeg, sysId);
    assert(
      blendErrors.some((e) => e.code === "INVALID_HYDROGEN_BLEND_FRACTION"),
      "Un mélange GN/H2 avec 0% H2 doit être rejeté avec INVALID_HYDROGEN_BLEND_FRACTION"
    );

    // Rejet d'une revendication illégale de compatibilité H2 ou de qualification automatique sur le matériau
    const forgedQualifiedSeg = {
      ...segH2,
      material: {
        standardCode: "API-5L",
        grade: "X52",
        isHydrogenCompatible: true,
      },
    };
    const forgedErrors = validatePipelineSegment(forgedQualifiedSeg, sysId);
    assert(
      forgedErrors.some((e) => e.code === "DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION"),
      "Toute revendication isHydrogenCompatible: true dans le modèle métier doit être rejetée"
    );

    // Rejet d'une revendication illégale verificationState: "VERIFIED" sur le service
    const forgedVerifiedServiceSeg = {
      ...segH2,
      service: {
        fluidCategory: "HYDROGEN",
        verificationState: "VERIFIED",
      },
    };
    const forgedServiceErrors = validatePipelineSegment(forgedVerifiedServiceSeg, sysId);
    assert(
      forgedServiceErrors.some((e) => e.code === "DISALLOWED_AUTOMATIC_VERIFICATION_CLAIM"),
      "Toute revendication verificationState: 'VERIFIED' dans le modèle métier doit être rejetée"
    );
  });

  // =========================================================================
  // TEST 12 : NON-RÉGRESSION DU REGISTRE DE DOMAINES (ARCH-08) ET DU MULTI-CODE RESOLVER (ARCH-09)
  // =========================================================================
  runTest("TEST 12 [ARCH-10]: Non-régression complète de EngineeringDomainRegistry (ARCH-08) et MultiCodeResolver (ARCH-09)", () => {
    // 1. Distinction PIPELINE vs PIPING dans le registre de domaines
    const pipelineDomain = defaultEngineeringDomainRegistry.getDomain("PIPELINE");
    const pipingDomain = defaultEngineeringDomainRegistry.getDomain("PIPING");
    assert(pipelineDomain !== undefined && pipelineDomain.id === "PIPELINE", "Domaine PIPELINE présent");
    assert(pipingDomain !== undefined && pipingDomain.id === "PIPING", "Domaine PIPING présent");
    assert(
      PIPELINE_DOMAIN_DESCRIPTOR.capabilities.includes("ALIGNMENT") &&
        PIPELINE_DOMAIN_DESCRIPTOR.capabilities.includes("STATIONS") &&
        !PIPELINE_DOMAIN_DESCRIPTOR.capabilities.includes("SPOOL"),
      "PIPELINE possède ALIGNMENT et STATIONS mais pas SPOOL"
    );
    assert(
      PIPING_DOMAIN_DESCRIPTOR.capabilities.includes("ISOMETRIC") &&
        PIPING_DOMAIN_DESCRIPTOR.capabilities.includes("SPOOL"),
      "PIPING conserve ISOMETRIC et SPOOL"
    );

    // 2. Un PipelineSystem déclaré avec engineeringDomain: "PIPING" est rejeté par validatePipelineSystem
    const wrongDomainSys = {
      id: "SYS-WRONG-DOM",
      name: "Wrong Domain System",
      engineeringDomain: "PIPING",
      nodes: [],
      segments: [],
    };
    const wrongDomRes = validatePipelineSystem(wrongDomainSys);
    assert(wrongDomRes.valid === false, "PipelineSystem avec domaine PIPING doit être rejeté");
    assert(
      wrongDomRes.errors.some((e) => e.code === "INVALID_ENGINEERING_DOMAIN"),
      "INVALID_ENGINEERING_DOMAIN attendu"
    );

    // 3. Exécution des suites ARCH-08 et ARCH-09
    const arch08 = runArch08MultiDomainArchitectureTests();
    assert(arch08.success === true, `ARCH-08 doit rester 100% PASS: ${arch08.failures.join("; ")}`);

    const arch09 = runArch09MultiCodeResolverTests();
    assert(arch09.success === true, `ARCH-09 doit rester 100% PASS: ${arch09.failures.join("; ")}`);
  });

  // =========================================================================
  // TEST 13 : AUCUN CALCUL B31.8, B31.12, B31.4 OU ISO-13623 N'EST DÉCLARÉ DISPONIBLE
  // =========================================================================
  runTest("TEST 13 [ARCH-10]: Aucun calcul B31.8, B31.12, B31.4 ou ISO-13623 n'est déclaré disponible (statut NOT_IMPLEMENTED intact)", () => {
    const pipelineCodes = ["ASME-B31.4", "ASME-B31.8", "ASME-B31.12", "ISO-13623"] as const;

    for (const codeId of pipelineCodes) {
      const calcEntry = getDesignCodeCalculationEntry(codeId);
      assert(calcEntry !== undefined, `${codeId} doit exister dans DESIGN_CODE_CALCULATION_REGISTRY`);
      assert(
        calcEntry!.status === "NOT_IMPLEMENTED",
        `${codeId} doit impérativement rester NOT_IMPLEMENTED (actuel: ${calcEntry!.status})`
      );
      assert(
        calcEntry!.supportedCalculationTypes.length === 0,
        `${codeId} ne doit supporter aucun calcul`
      );

      const resolution = resolveApplicableDesignCode({
        engineeringDomain: "PIPELINE",
        explicitDesignCodeId: codeId,
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
        unitSystem: "SI",
      });

      assert(resolution.status === "RESOLVED", `${codeId} reste identifiable par MultiCodeResolver`);
      assert(
        resolution.implementationStatus === "NOT_IMPLEMENTED",
        `implementationStatus de ${codeId} via MultiCodeResolver doit rester NOT_IMPLEMENTED`
      );
      assert(
        resolution.isUsableForCalculation === false,
        `isUsableForCalculation pour ${codeId} doit rester strictement false`
      );
    }

    assert(Object.isFrozen(DESIGN_CODE_CALCULATION_REGISTRY), "DESIGN_CODE_CALCULATION_REGISTRY reste gelé");
  });

  // =========================================================================
  // TEST 14 : ISOLATION DES COUCHES (REJET DES CHAMPS COMMERCIAUX ET IDENTITÉS CLIENTS)
  // =========================================================================
  runTest("TEST 14 [ARCH-10]: Isolation stricte Couche A (Engineering) vs Couche C (Commercial) et Couche D (Client)", () => {
    const contaminatedSystem = {
      id: "SYS-CONTAMINATED",
      name: "Pipeline Network",
      engineeringDomain: "PIPELINE",
      unitPrice: 450000,
      currencyCode: "EUR",
      nodes: [
        {
          id: "N1",
          systemId: "SYS-CONTAMINATED",
          name: "Poste Sonelgaz Nord",
        },
      ],
      segments: [],
    };

    const res = validatePipelineSystem(contaminatedSystem);
    assert(res.valid === false, "Doit rejeter un système contaminé par des prix ou un nom client historique");
    assert(
      res.errors.some((e) => e.code === "DISALLOWED_COMMERCIAL_FIELD_IN_ENGINEERING_MODEL"),
      "DISALLOWED_COMMERCIAL_FIELD_IN_ENGINEERING_MODEL attendu"
    );
    assert(
      res.errors.some((e) => e.code === "DISALLOWED_CLIENT_IDENTITY_IN_ENGINEERING_MODEL"),
      "DISALLOWED_CLIENT_IDENTITY_IN_ENGINEERING_MODEL attendu"
    );
  });

  // =========================================================================
  // TEST 15 : INTEROPÉRABILITÉ AVEC PdiUniversalEntity SANS MODÈLE UNIVERSEL CONCURRENT
  // =========================================================================
  runTest("TEST 15 [ARCH-10]: Projection non destructive sur PdiUniversalEntity et absence de PipelineUniversalEntity", () => {
    assert(
      detectDuplicateUniversalModelAntiPattern("PipelineUniversalEntity") === true,
      "PipelineUniversalEntity reste détecté comme anti-pattern interdit"
    );

    const baseEntity: PdiUniversalEntity = {
      identity: {
        id: "ENT-PIPE-SEG-01",
        type: "pipeline_segment",
        category: "pipe",
        name: "Tronçon KP 0 - KP 10",
        labelFr: "Tronçon KP 0 - KP 10",
      },
      geometry: { x: 0, y: 0, z: 0, length: 10000 },
      connection: { ports: [], connectionType: "butt_weld" },
      dn: { dn: 600, outerDiameterMm: 610, unit: "mm" },
      pn: { designPressureBar: 85, operatingPressureBar: 70 },
      material: { grade: "X65", standard: "API-5L", wallThicknessMm: 12.7 },
      service: { code: "NG", description: "Natural Gas" },
      spec: {},
      tag: { lineId: "SYS-PIPE-01" },
      fabrication: { location: "field", weldType: "butt_weld" },
      documentation: {},
      specific: {},
    };

    const segment = createPipelineSegment({
      id: "SEG-01",
      systemId: "SYS-PIPE-01",
      name: "Tronçon KP 0 - KP 10",
      startNodeId: "N1",
      endNodeId: "N2",
      universalEntityId: baseEntity.identity.id,
      domainAttributes: {
        kilometerPointStart: 0,
        kilometerPointEnd: 10,
        burialDepthMeters: 1.5,
        classLocation: 2,
        crossingType: "hdd",
      },
    });

    const enrichedEntity = attachPipelineSegmentToUniversalEntity(baseEntity, segment);
    const extracted = getDomainAttributes<PipelineDomainAttributes>(enrichedEntity, "PIPELINE");

    assert(extracted !== undefined, "Les attributs PIPELINE doivent être attachés à PdiUniversalEntity");
    assert(extracted?.kilometerPointStart === 0 && extracted?.kilometerPointEnd === 10, "KP conservés");
    assert(extracted?.classLocation === 2, "classLocation conservée");
    assert(extracted?.crossingType === "hdd", "crossingType conservé");

    const boundaryCheck = validateDomainBoundary("PIPELINE", enrichedEntity);
    assert(boundaryCheck.valid === true, "L'entité universelle enrichie respecte la frontière de domaine PIPELINE");
  });

  // =========================================================================
  // TEST 16 : [FIX-01] IMMUTABILITÉ PROFONDE DE createPipelineSystem()
  // =========================================================================
  runTest("TEST 16 [ARCH-10-FIX-01 / FIX-01]: Immutabilité profonde de createPipelineSystem() vis-à-vis des objets enfants et structures imbriquées", () => {
    const rawConnectedSegments = ["SEG-IMM-01"];
    const rawNodeDocs = ["DOC-NODE-01"];
    const rawNodeCoords = { x: 10, y: 20, z: 5, elevation: 5, unit: "m" as const };
    const rawNodeStation = { value: 0, unit: "km" as const };

    const mutableNode1: PipelineNode = {
      id: "N-IMM-1",
      systemId: "SYS-IMM",
      name: "Mutable Node 1",
      kind: "TERMINAL_INLET",
      connectedSegmentIds: rawConnectedSegments,
      stationPoint: rawNodeStation,
      coordinates: rawNodeCoords,
      traceabilityRefs: {
        sourceDocumentIds: rawNodeDocs,
      },
    };

    const mutableNode2: PipelineNode = {
      id: "N-IMM-2",
      systemId: "SYS-IMM",
      name: "Mutable Node 2",
      kind: "TERMINAL_OUTLET",
    };

    const rawSegLength = { value: 1200, unit: "m" as const };
    const rawOuterDiameter = { value: 406.4, unit: "mm" as const };
    const rawWallThickness = { value: 9.5, unit: "mm" as const };
    const rawSegDims = {
      outerDiameter: rawOuterDiameter,
      wallThickness: rawWallThickness,
      schedule: "STD",
    };
    const rawSegMaterial = {
      materialId: "MAT-X60",
      standardCode: "API-5L",
      grade: "X60",
    };
    const rawSegPressure = { value: 70, unit: "bar" as const };
    const rawSegService = {
      fluidCategory: "NATURAL_GAS" as const,
      designPressure: rawSegPressure,
    };
    const rawDomainAttrs = {
      kilometerPointStart: 0,
      kilometerPointEnd: 1.2,
      classLocation: 1 as const,
    };
    const rawSegDocs = ["DOC-SEG-01"];

    const mutableSeg1: PipelineSegment = {
      id: "SEG-IMM-01",
      systemId: "SYS-IMM",
      name: "Mutable Segment 1",
      startNodeId: "N-IMM-1",
      endNodeId: "N-IMM-2",
      length: rawSegLength,
      dimensions: rawSegDims,
      material: rawSegMaterial,
      service: rawSegService,
      domainAttributes: rawDomainAttrs,
      traceabilityRefs: {
        sourceDocumentIds: rawSegDocs,
      },
    };

    const rawNodesArray = [mutableNode1, mutableNode2];
    const rawSegmentsArray = [mutableSeg1];
    const rawSysPressure = { value: 80, unit: "bar" as const };
    const rawSysDocs = ["DOC-SYS-01"];

    const inputSnapshotBefore = JSON.stringify({
      nodes: rawNodesArray,
      segments: rawSegmentsArray,
      sysPressure: rawSysPressure,
      sysDocs: rawSysDocs,
    });

    const builtSystem = createPipelineSystem({
      id: "SYS-IMM",
      name: "Immutable System Test",
      service: {
        fluidCategory: "NATURAL_GAS",
        designPressure: rawSysPressure,
      },
      nodes: rawNodesArray,
      segments: rawSegmentsArray,
      traceabilityRefs: {
        sourceDocumentIds: rawSysDocs,
      },
    });

    // 1. Vérifier que createPipelineSystem n'a pas muté ni gelé les objets d'entrée
    const inputSnapshotAfterBuild = JSON.stringify({
      nodes: rawNodesArray,
      segments: rawSegmentsArray,
      sysPressure: rawSysPressure,
      sysDocs: rawSysDocs,
    });
    assert(
      inputSnapshotBefore === inputSnapshotAfterBuild,
      "createPipelineSystem ne doit pas modifier les objets d'entrée"
    );
    assert(!Object.isFrozen(mutableNode1), "L'objet d'entrée mutableNode1 ne doit pas être gelé sur place");
    assert(!Object.isFrozen(mutableSeg1), "L'objet d'entrée mutableSeg1 ne doit pas être gelé sur place");

    // 2. Modifier agressivement tous les objets et tableaux d'origine après construction
    (mutableNode1 as { name: string }).name = "CORRUPTED NODE NAME";
    rawConnectedSegments.push("SEG-CORRUPTED");
    rawNodeDocs.push("DOC-CORRUPTED");
    rawNodeCoords.x = 999999;
    rawNodeStation.value = 999;
    rawNodesArray.pop();

    (mutableSeg1 as { name: string }).name = "CORRUPTED SEGMENT NAME";
    rawSegLength.value = -500;
    rawOuterDiameter.value = 9999;
    rawSegDims.schedule = "XXS-CORRUPTED";
    rawSegMaterial.grade = "CORRUPTED-GRADE";
    rawSegPressure.value = 9999;
    rawDomainAttrs.kilometerPointEnd = 9999;
    rawSegDocs.push("DOC-SEG-CORRUPTED");
    rawSegmentsArray.pop();

    rawSysPressure.value = 9999;
    rawSysDocs.push("DOC-SYS-CORRUPTED");

    // 3. Prouver que le système construit est intégralement intact
    assert(builtSystem.nodes.length === 2, "Le tableau nodes du système construit reste à 2 éléments");
    assert(builtSystem.nodes[0] !== mutableNode1, "Le nœud stocké est un clone distinct de l'entrée");
    assert(builtSystem.nodes[0].name === "Mutable Node 1", "Le nom du nœud construit n'est pas affecté");
    assert(
      builtSystem.nodes[0].connectedSegmentIds?.length === 1 &&
        builtSystem.nodes[0].connectedSegmentIds[0] === "SEG-IMM-01",
      "connectedSegmentIds du nœud construit n'est pas affecté"
    );
    assert(builtSystem.nodes[0].coordinates?.x === 10, "coordinates.x du nœud construit n'est pas affecté");
    assert(builtSystem.nodes[0].stationPoint?.value === 0, "stationPoint du nœud construit n'est pas affecté");
    assert(
      builtSystem.nodes[0].traceabilityRefs?.sourceDocumentIds?.length === 1,
      "sourceDocumentIds du nœud construit n'est pas affecté"
    );

    assert(builtSystem.segments.length === 1, "Le tableau segments du système construit reste à 1 élément");
    assert(builtSystem.segments[0] !== mutableSeg1, "Le tronçon stocké est un clone distinct de l'entrée");
    assert(builtSystem.segments[0].name === "Mutable Segment 1", "Le nom du tronçon construit n'est pas affecté");
    assert(builtSystem.segments[0].length?.value === 1200, "length.value du tronçon construit n'est pas affecté");
    assert(
      builtSystem.segments[0].dimensions?.outerDiameter?.value === 406.4,
      "outerDiameter.value du tronçon construit n'est pas affecté"
    );
    assert(
      builtSystem.segments[0].dimensions?.schedule === "STD",
      "dimensions.schedule du tronçon construit n'est pas affecté"
    );
    assert(builtSystem.segments[0].material?.grade === "X60", "material.grade du tronçon construit n'est pas affecté");
    assert(
      builtSystem.segments[0].service?.designPressure?.value === 70,
      "service.designPressure du tronçon construit n'est pas affecté"
    );
    assert(
      builtSystem.segments[0].domainAttributes?.kilometerPointEnd === 1.2,
      "domainAttributes.kilometerPointEnd du tronçon construit n'est pas affecté"
    );
    assert(
      builtSystem.segments[0].traceabilityRefs?.sourceDocumentIds?.length === 1,
      "traceabilityRefs.sourceDocumentIds du tronçon construit n'est pas affecté"
    );
    assert(builtSystem.service?.designPressure?.value === 80, "service.designPressure du système n'est pas affecté");
    assert(
      builtSystem.traceabilityRefs?.sourceDocumentIds?.length === 1,
      "traceabilityRefs.sourceDocumentIds du système n'est pas affecté"
    );

    // 4. Vérifier que toutes les structures retournées sont gelées (Object.isFrozen) contre les mutations directes
    assert(Object.isFrozen(builtSystem), "builtSystem gelé");
    assert(Object.isFrozen(builtSystem.nodes), "builtSystem.nodes gelé");
    assert(Object.isFrozen(builtSystem.nodes[0]), "builtSystem.nodes[0] gelé");
    assert(Object.isFrozen(builtSystem.nodes[0].connectedSegmentIds), "connectedSegmentIds gelé");
    assert(Object.isFrozen(builtSystem.nodes[0].coordinates), "coordinates gelé");
    assert(Object.isFrozen(builtSystem.nodes[0].stationPoint), "stationPoint gelé");
    assert(Object.isFrozen(builtSystem.nodes[0].traceabilityRefs), "node.traceabilityRefs gelé");
    assert(
      Object.isFrozen(builtSystem.nodes[0].traceabilityRefs?.sourceDocumentIds),
      "node.traceabilityRefs.sourceDocumentIds gelé"
    );
    assert(Object.isFrozen(builtSystem.segments), "builtSystem.segments gelé");
    assert(Object.isFrozen(builtSystem.segments[0]), "builtSystem.segments[0] gelé");
    assert(Object.isFrozen(builtSystem.segments[0].length), "segment.length gelé");
    assert(Object.isFrozen(builtSystem.segments[0].dimensions), "segment.dimensions gelé");
    assert(Object.isFrozen(builtSystem.segments[0].dimensions?.outerDiameter), "outerDiameter gelé");
    assert(Object.isFrozen(builtSystem.segments[0].material), "segment.material gelé");
    assert(Object.isFrozen(builtSystem.segments[0].service), "segment.service gelé");
    assert(Object.isFrozen(builtSystem.segments[0].service?.designPressure), "segment.service.designPressure gelé");
    assert(Object.isFrozen(builtSystem.segments[0].domainAttributes), "segment.domainAttributes gelé");
    assert(Object.isFrozen(builtSystem.segments[0].traceabilityRefs), "segment.traceabilityRefs gelé");
    assert(
      Object.isFrozen(builtSystem.segments[0].traceabilityRefs?.sourceDocumentIds),
      "segment.traceabilityRefs.sourceDocumentIds gelé"
    );
  });

  // =========================================================================
  // TEST 17 : [FIX-02 & FIX-03] COHÉRENCE STRICTE DES DÉCLARATIONS DE FLUIDES ET DOUBLONS connectedSegmentIds
  // =========================================================================
  runTest("TEST 17 [ARCH-10-FIX-01 / FIX-02 & FIX-03]: Cohérence stricte fluidCategory vs hydrogenMoleFractionPercent et rejet des doublons dans connectedSegmentIds", () => {
    const sysId = "SYS-FIX02-03";

    // 1. NATURAL_GAS_HYDROGEN_BLEND sans hydrogenMoleFractionPercent -> REJET
    const blendMissingFractionSeg = createPipelineSegment({
      id: "S-BLEND-MISSING-H2",
      systemId: sysId,
      name: "Blend Missing H2 Fraction",
      startNodeId: "N1",
      endNodeId: "N2",
      service: {
        fluidCategory: "NATURAL_GAS_HYDROGEN_BLEND",
      },
    });
    const errBlendMissing = validatePipelineSegment(blendMissingFractionSeg, sysId);
    assert(
      errBlendMissing.some((e) => e.code === "INVALID_HYDROGEN_BLEND_FRACTION"),
      "NATURAL_GAS_HYDROGEN_BLEND sans hydrogenMoleFractionPercent doit être rejeté"
    );

    // 2. HYDROGEN avec hydrogenMoleFractionPercent < 100 (ex: 20%) -> REJET
    const h2WithLowFractionSeg = createPipelineSegment({
      id: "S-H2-LOW-FRAC",
      systemId: sysId,
      name: "Hydrogen With 20% Fraction",
      startNodeId: "N1",
      endNodeId: "N2",
      service: {
        fluidCategory: "HYDROGEN",
        hydrogenMoleFractionPercent: 20,
      },
    });
    const errH2Low = validatePipelineSegment(h2WithLowFractionSeg, sysId);
    assert(
      errH2Low.some((e) => e.code === "INVALID_HYDROGEN_BLEND_FRACTION"),
      "HYDROGEN avec hydrogenMoleFractionPercent < 100 doit être rejeté"
    );

    // 3. HYDROGEN avec hydrogenMoleFractionPercent === 100 ou omis -> VALIDE
    const h2ValidSeg = createPipelineSegment({
      id: "S-H2-VALID",
      systemId: sysId,
      name: "Pure Hydrogen Valid",
      startNodeId: "N1",
      endNodeId: "N2",
      service: {
        fluidCategory: "HYDROGEN",
        hydrogenMoleFractionPercent: 100,
      },
    });
    assert(validatePipelineSegment(h2ValidSeg, sysId).length === 0, "HYDROGEN avec 100% H2 est valide");

    // 4. LIQUID_HYDROCARBON, WATER, CO2 avec hydrogenMoleFractionPercent > 0 -> REJET
    for (const nonH2Category of ["LIQUID_HYDROCARBON", "WATER", "CO2"] as const) {
      const badNonH2Seg = createPipelineSegment({
        id: `S-BAD-${nonH2Category}`,
        systemId: sysId,
        name: `Bad ${nonH2Category} With H2`,
        startNodeId: "N1",
        endNodeId: "N2",
        service: {
          fluidCategory: nonH2Category,
          hydrogenMoleFractionPercent: 5,
        },
      });
      const errs = validatePipelineSegment(badNonH2Seg, sysId);
      assert(
        errs.some((e) => e.code === "INVALID_HYDROGEN_BLEND_FRACTION"),
        `${nonH2Category} avec hydrogenMoleFractionPercent > 0 doit être rejeté`
      );
    }

    // 5. [FIX-03] Nœud avec connectedSegmentIds contenant des doublons ["S1", "S1"] -> REJET
    const nodeWithDupSegRefs = createPipelineNode({
      id: "N1",
      systemId: sysId,
      name: "Node With Duplicate Segment Refs",
      connectedSegmentIds: ["S1", "S1"],
    });
    const nodeDupErrs = validatePipelineNode(nodeWithDupSegRefs, sysId);
    assert(
      nodeDupErrs.some(
        (e) => e.code === "NODE_SEGMENT_INCIDENCE_MISMATCH" && e.entityId === "N1"
      ),
      "validatePipelineNode doit rejeter les doublons dans connectedSegmentIds"
    );

    const sysWithDupNodeSegRefs = createPipelineSystem({
      id: sysId,
      name: "System With Duplicate Node ConnectedSegmentIds",
      nodes: [
        nodeWithDupSegRefs,
        createPipelineNode({ id: "N2", systemId: sysId, name: "Node 2", connectedSegmentIds: ["S1"] }),
      ],
      segments: [
        createPipelineSegment({
          id: "S1",
          systemId: sysId,
          name: "Segment 1",
          startNodeId: "N1",
          endNodeId: "N2",
        }),
      ],
    });
    const sysRes = validatePipelineSystem(sysWithDupNodeSegRefs);
    assert(sysRes.valid === false, "Le système contenant des doublons dans connectedSegmentIds doit être invalide");
    assert(
      sysRes.errors.some(
        (e) => e.code === "NODE_SEGMENT_INCIDENCE_MISMATCH" && e.entityId === "N1"
      ),
      "validatePipelineSystem doit signaler NODE_SEGMENT_INCIDENCE_MISMATCH sur N1"
    );
  });

  return Object.freeze({
    success: testsFailed === 0,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
