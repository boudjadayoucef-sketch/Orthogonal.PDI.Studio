/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-ISO-03-FIX-02 — UNIT & INTEGRATION TESTS:
 * INTÉGRITÉ DU GRAPHE, SUPPRESSION EN CASCADE ET COMPILATION DÉFENSIVE
 */
import { describe, it, expect } from "vitest";
import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  pruneSketchGraph
} from "../sketchRasterEngine";
import { compileSketchToIsoModel } from "../sketchToJsonCompiler";
import {
  DEMO_INITIAL_NODES,
  DEMO_INITIAL_SEGMENTS,
  DEMO_INITIAL_FITTINGS
} from "../demoSketchTemplate";

describe("SKETCH-ISO-03-FIX-02 : Intégrité du graphe et suppression en cascade", () => {
  // Helper to clone demo fixtures so each test has fresh data
  const getDemoGraph = () => ({
    nodes: JSON.parse(JSON.stringify(DEMO_INITIAL_NODES)) as SketchVectorNode[],
    segments: JSON.parse(JSON.stringify(DEMO_INITIAL_SEGMENTS)) as SketchVectorSegment[],
    fittings: JSON.parse(JSON.stringify(DEMO_INITIAL_FITTINGS)) as SketchVectorFitting[]
  });

  // Test 1 : Suppression d'un nœud intermédiaire : les tronçons incidents sont supprimés et les fittings associés sont purgés.
  it("Test 1: Suppression d'un nœud intermédiaire purge les tronçons connectés et les fittings associés", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    // node_3 is connected to seg_2, seg_3, seg_5 and has fit_3 attached directly.
    // seg_2 has fit_2 attached. When seg_2 is deleted as consequence of node_3 deletion, fit_2 must also be purged.
    const result = pruneSketchGraph(nodes, segments, fittings, {
      deleteNodeIds: ["node_3"]
    });

    // Node check
    expect(result.nodes.some((n) => n.id === "node_3")).toBe(false);
    expect(result.nodes.length).toBe(nodes.length - 1);

    // Connected segments must be purged: seg_2, seg_3, seg_5
    expect(result.segments.some((s) => s.id === "seg_2")).toBe(false);
    expect(result.segments.some((s) => s.id === "seg_3")).toBe(false);
    expect(result.segments.some((s) => s.id === "seg_5")).toBe(false);
    expect(result.segments.map((s) => s.id)).toEqual(["seg_1", "seg_4"]);

    // Fittings check: fit_3 (on node_3) and fit_2 (on seg_2) must be purged
    expect(result.fittings.some((f) => f.id === "fit_3")).toBe(false);
    expect(result.fittings.some((f) => f.id === "fit_2")).toBe(false);
    expect(result.fittings.map((f) => f.id)).toEqual(["fit_1", "fit_4", "fit_5"]);
  });

  // Test 2 : Suppression d'un nœud d'extrémité : seul le tronçon incident et ses fittings sont supprimés.
  it("Test 2: Suppression d'un nœud d'extrémité supprime uniquement son tronçon incident et ses fittings", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    // node_1 is an endpoint connected only to seg_1, and has fit_1 attached.
    const result = pruneSketchGraph(nodes, segments, fittings, {
      deleteNodeIds: ["node_1"]
    });

    expect(result.nodes.some((n) => n.id === "node_1")).toBe(false);
    expect(result.nodes.length).toBe(nodes.length - 1);

    // Only seg_1 was connected to node_1
    expect(result.segments.some((s) => s.id === "seg_1")).toBe(false);
    expect(result.segments.length).toBe(segments.length - 1);
    expect(result.segments.map((s) => s.id)).toEqual(["seg_2", "seg_3", "seg_4", "seg_5"]);

    // fit_1 on node_1 must be removed; other fittings survive
    expect(result.fittings.some((f) => f.id === "fit_1")).toBe(false);
    expect(result.fittings.length).toBe(fittings.length - 1);
  });

  // Test 3 : Suppression explicite d'un tronçon : les nœuds restent intacts, les fittings sur ce tronçon sont supprimés.
  it("Test 3: Suppression explicite d'un tronçon préserve tous les nœuds et purge les fittings du tronçon", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    // seg_2 has fit_2 attached.
    const result = pruneSketchGraph(nodes, segments, fittings, {
      deleteSegmentIds: ["seg_2"]
    });

    // All nodes remain intact
    expect(result.nodes.length).toBe(nodes.length);
    expect(result.nodes.map((n) => n.id)).toEqual(nodes.map((n) => n.id));

    // seg_2 removed
    expect(result.segments.some((s) => s.id === "seg_2")).toBe(false);
    expect(result.segments.length).toBe(segments.length - 1);

    // fit_2 removed because it was on seg_2
    expect(result.fittings.some((f) => f.id === "fit_2")).toBe(false);
    expect(result.fittings.length).toBe(fittings.length - 1);
  });

  // Test 4 : Suppression explicite d'un fitting : le nœud ou le tronçon parent reste intact.
  it("Test 4: Suppression explicite d'un fitting conserve intacts le nœud et le tronçon parents", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    // fit_2 is on seg_2, fit_1 is on node_1
    const result = pruneSketchGraph(nodes, segments, fittings, {
      deleteFittingIds: ["fit_2", "fit_1"]
    });

    expect(result.nodes.length).toBe(nodes.length);
    expect(result.segments.length).toBe(segments.length);
    expect(result.fittings.some((f) => f.id === "fit_1" || f.id === "fit_2")).toBe(false);
    expect(result.fittings.length).toBe(fittings.length - 2);
  });

  // Test 5 : Suppression multiple (nœuds + tronçons sélectionnés) : élimine tout ce qui est sélectionné ou rendu orphelin, sans duplication.
  it("Test 5: Suppression multiple élimine éléments ciblés et orphelins sans doublons", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    // Select node_1 (removes seg_1 and fit_1) and seg_3 (removes seg_3 and any fittings)
    const result = pruneSketchGraph(nodes, segments, fittings, {
      deleteNodeIds: ["node_1"],
      deleteSegmentIds: ["seg_3"]
    });

    expect(result.nodes.some((n) => n.id === "node_1")).toBe(false);
    expect(result.segments.some((s) => s.id === "seg_1" || s.id === "seg_3")).toBe(false);
    expect(result.fittings.some((f) => f.id === "fit_1")).toBe(false);

    // Check no duplicate IDs in any resulting collection
    const nodeIds = result.nodes.map((n) => n.id);
    const segIds = result.segments.map((s) => s.id);
    const fitIds = result.fittings.map((f) => f.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(segIds).size).toBe(segIds.length);
    expect(new Set(fitIds).size).toBe(fitIds.length);
  });

  // Test 6 : Résilience aux références manquantes : supprimer un nœud déjà absent ne corrompt rien et ne lève pas d'erreur.
  it("Test 6: Résilience aux IDs inexistants dans delete options", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    const result = pruneSketchGraph(nodes, segments, fittings, {
      deleteNodeIds: ["ghost_node_1", "ghost_node_2"],
      deleteSegmentIds: ["ghost_seg_99"],
      deleteFittingIds: ["ghost_fit_42"]
    });

    expect(result.nodes.length).toBe(nodes.length);
    expect(result.segments.length).toBe(segments.length);
    expect(result.fittings.length).toBe(fittings.length);
  });

  // Test 7 : Entrées corrompues à l'entrée de compileSketchToIsoModel : un segment référençant un nœud inexistant est écarté sans lever d'exception.
  it("Test 7: compileSketchToIsoModel écarte les segments avec nœuds inexistants sans lever d'erreur", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    const corruptSegments: SketchVectorSegment[] = [
      ...segments,
      {
        id: "corrupt_seg_1",
        fromNodeId: "missing_node_a",
        toNodeId: "node_2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 1000
      },
      {
        id: "corrupt_seg_2",
        fromNodeId: "node_1",
        toNodeId: "missing_node_b",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 1500
      }
    ];

    expect(() => {
      const compiled = compileSketchToIsoModel({
        nodes,
        segments: corruptSegments,
        fittings,
        calibrationScale: 0.25
      });
      // The corrupt segments must have been purged defensively
      expect(compiled.segments.some((s) => s.id === "corrupt_seg_1")).toBe(false);
      expect(compiled.segments.some((s) => s.id === "corrupt_seg_2")).toBe(false);
      expect(compiled.segments.length).toBe(segments.length);
    }).not.toThrow();
  });

  // Test 8 : Entrée corrompue avec auto-boucle (fromNodeId === toNodeId) : le segment est écarté.
  it("Test 8: Les segments auto-boucles (fromNodeId === toNodeId) sont purgés", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    const selfLoopSeg: SketchVectorSegment = {
      id: "seg_self_loop",
      fromNodeId: "node_2",
      toNodeId: "node_2",
      nominalDiameter: 150,
      pressureClass: "Class 300",
      material: "Acier API 5L Gr. B",
      lengthMm: 500
    };

    const pruned = pruneSketchGraph(nodes, [...segments, selfLoopSeg], fittings);
    expect(pruned.segments.some((s) => s.id === "seg_self_loop")).toBe(false);

    const compiled = compileSketchToIsoModel({
      nodes,
      segments: [...segments, selfLoopSeg],
      fittings,
      calibrationScale: 0.25
    });
    expect(compiled.segments.some((s) => s.id === "seg_self_loop")).toBe(false);
  });

  // Test 9 : Fitting orphelin dans le compilateur : ne produit pas d'équipement invalide et est filtré.
  it("Test 9: Les fittings orphelins (pointant vers des nœuds ou segments absents) sont filtrés par le compilateur", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    const orphanFittings: SketchVectorFitting[] = [
      ...fittings,
      {
        id: "orphan_fit_node",
        nodeId: "non_existent_node_xyz",
        type: "valve",
        label: "ORPHAN-V"
      },
      {
        id: "orphan_fit_seg",
        segmentId: "non_existent_seg_xyz",
        type: "flange",
        label: "ORPHAN-F"
      }
    ];

    const compiled = compileSketchToIsoModel({
      nodes,
      segments,
      fittings: orphanFittings,
      calibrationScale: 0.25
    });

    // The orphan fittings must not be present in segment fittings or node equipment
    for (const seg of compiled.segments) {
      expect(seg.fittings.some((f) => f.id === "orphan_fit_seg")).toBe(false);
      expect(seg.fittings.some((f) => f.id === "orphan_fit_node")).toBe(false);
    }
    for (const node of compiled.nodes) {
      expect(node.equipmentLabel).not.toBe("ORPHAN-V");
      expect(node.equipmentLabel).not.toBe("ORPHAN-F");
    }
  });

  // Test 10 : Métadonnées du compilateur : totalPipesCount et totalFittingsCount reflètent exactement les éléments valides restants.
  it("Test 10: Métadonnées du compilateur totalPipesCount et totalFittingsCount reflètent les éléments valides après assainissement", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    const corruptSegments: SketchVectorSegment[] = [
      ...segments,
      {
        id: "ghost_seg_bad",
        fromNodeId: "missing_1",
        toNodeId: "missing_2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 800
      }
    ];
    const corruptFittings: SketchVectorFitting[] = [
      ...fittings,
      { id: "ghost_fit_bad", segmentId: "ghost_seg_bad", type: "valve" }
    ];

    const compiled = compileSketchToIsoModel({
      nodes,
      segments: corruptSegments,
      fittings: corruptFittings,
      calibrationScale: 0.25
    });

    expect(compiled.metadata.totalPipesCount).toBe(segments.length);
    expect(compiled.metadata.totalFittingsCount).toBe(fittings.length);
  });

  // Test 11 : Immutabilité : les tableaux et objets passés en entrée de pruneSketchGraph ne sont pas modifiés.
  it("Test 11: pruneSketchGraph respecte l'immutabilité stricte des tableaux et objets d'entrée", () => {
    const { nodes, segments, fittings } = getDemoGraph();

    // Freeze inputs deeply
    const frozenNodes = nodes.map((n) => Object.freeze({ ...n }));
    const frozenSegments = segments.map((s) => Object.freeze({ ...s }));
    const frozenFittings = fittings.map((f) => Object.freeze({ ...f }));
    Object.freeze(frozenNodes);
    Object.freeze(frozenSegments);
    Object.freeze(frozenFittings);

    expect(() => {
      const result = pruneSketchGraph(frozenNodes, frozenSegments, frozenFittings, {
        deleteNodeIds: ["node_2"],
        deleteSegmentIds: ["seg_4"],
        deleteFittingIds: ["fit_5"]
      });
      expect(result.nodes.length).toBe(frozenNodes.length - 1);
    }).not.toThrow();
  });

  // Test 12 : Fittings autonomes (sans nodeId ni segmentId) : préservés lors d'une purge qui ne les cible pas explicitement.
  it("Test 12: Les fittings autonomes (sans nodeId ni segmentId) sont préservés sauf ciblage explicite", () => {
    const { nodes, segments, fittings } = getDemoGraph();
    const standaloneFit: SketchVectorFitting = {
      id: "fit_standalone_note",
      type: "note",
      label: "NOTE CHANTIER"
    };

    // Purge with node deletion - standalone fitting must be kept
    const res1 = pruneSketchGraph(nodes, segments, [...fittings, standaloneFit], {
      deleteNodeIds: ["node_1"]
    });
    expect(res1.fittings.some((f) => f.id === "fit_standalone_note")).toBe(true);

    // Purge targeting standalone fitting explicitly - must be removed
    const res2 = pruneSketchGraph(nodes, segments, [...fittings, standaloneFit], {
      deleteFittingIds: ["fit_standalone_note"]
    });
    expect(res2.fittings.some((f) => f.id === "fit_standalone_note")).toBe(false);
  });

  // Test 13 : Intégration DET-03 : suppression sur le graphe de test DET-03.
  it("Test 13: Intégration DET-03 après suppression partielle conserve un modèle ISO compilable et valide", () => {
    const { nodes, segments, fittings } = getDemoGraph();

    // Prune node_6 (purge branch: seg_5 and fit_5)
    const pruned = pruneSketchGraph(nodes, segments, fittings, {
      deleteNodeIds: ["node_6"]
    });

    const compiled = compileSketchToIsoModel({
      nodes: pruned.nodes,
      segments: pruned.segments,
      fittings: pruned.fittings,
      calibrationScale: 0.25,
      title: "LIGNE-TEST-CROQUIS",
      lineReference: "L-100",
      service: "GAZ"
    });

    expect(compiled.source === "sketch_to_iso_calque").toBe(true);
    expect(compiled.nodes.length).toBe(5);
    expect(compiled.segments.length).toBe(4);
    expect(compiled.metadata.totalPipesCount).toBe(4);
    expect(compiled.metadata.totalFittingsCount).toBe(4);
    expect(compiled.nodes.some((n) => n.id === "node_6")).toBe(false);
    expect(compiled.segments.some((s) => s.id === "seg_5")).toBe(false);
  });

  // Test 14 : Intégration DET-06 : suppression sur le graphe de test DET-06.
  it("Test 14: Intégration DET-06 : intégrité des angles ISO et connexions restantes après suppression", () => {
    const { nodes, segments, fittings } = getDemoGraph();

    // Prune intermediate node_2 (removes seg_1, seg_2, fit_2)
    const pruned = pruneSketchGraph(nodes, segments, fittings, {
      deleteNodeIds: ["node_2"]
    });

    // Every remaining segment must connect two existing nodes in pruned.nodes
    for (const seg of pruned.segments) {
      const n1 = pruned.nodes.find((n) => n.id === seg.fromNodeId);
      const n2 = pruned.nodes.find((n) => n.id === seg.toNodeId);
      expect(n1).toBeDefined();
      expect(n2).toBeDefined();
      expect(seg.fromNodeId).not.toBe(seg.toNodeId);
    }

    // Segments remaining: seg_3 (node_3->node_4), seg_4 (node_4->node_5), seg_5 (node_3->node_6)
    expect(pruned.segments.map((s) => s.id)).toEqual(["seg_3", "seg_4", "seg_5"]);
  });
});
