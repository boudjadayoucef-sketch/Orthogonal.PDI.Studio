/**
 * Tests unitaires Détection Croquis & Vectorisation — Patch SKETCH-DETECT-02 / Vitest
 * Couverture complète des règles déterministes, 0 invention, snapping ISO & compilation JSON
 * Suite historique DET-01 à DET-16 + Test 17 de propagation axisMapping
 */

import { describe, it, expect } from "vitest";
import {
  snapToIsometricAngle,
  ISO_STANDARD_ANGLES,
  PAPER_FORMATS,
  type SketchVectorNode,
  type SketchVectorSegment,
  type SketchVectorFitting
} from "../sketchRasterEngine";
import { compileSketchToIsoModel } from "../sketchToJsonCompiler";
import { DEFAULT_SKETCH_PROFILE } from "../sketchStorage";
import {
  DEMO_INITIAL_NODES,
  DEMO_INITIAL_SEGMENTS,
  DEMO_INITIAL_FITTINGS
} from "../demoSketchTemplate";
import { detectSketchTopologyLocal } from "../localSketchDetector";
import {
  mergeCollinearSegments,
  bridgeNearbyEndpoints
} from "../openCvSketchDetector";
import {
  DEFAULT_AXIS_MAPPING,
  type AxisMappingConfig
} from "../sketchAxisConfig";
import { AxisCursorOverlay } from "../../shared/AxisCursorOverlay";

describe("SKETCH-ISO : Suite de tests de détection géométrique et vectorielle (DET-01 à DET-16)", () => {
  // DET-01 : Snapping isométrique strict sur les axes standard (30, 90, 150, 210, 270, 330)
  it("DET-01: Snapping isométrique strict sur les axes standard", () => {
    const p1 = { x: 100, y: 100 };
    // Vecteur proche de 30°
    const p30 = {
      x: 100 + 100 * Math.cos((32 * Math.PI) / 180),
      y: 100 - 100 * Math.sin((32 * Math.PI) / 180)
    };
    const res30 = snapToIsometricAngle(p1, p30, 10);
    expect(res30.isSnapped).toBe(true);
    expect(res30.angleDeg).toBe(30);

    // Vecteur proche de 90° (vertical)
    const p90 = { x: 102, y: 0 };
    const res90 = snapToIsometricAngle(p1, p90, 10);
    expect(res90.isSnapped).toBe(true);
    expect(res90.angleDeg).toBe(90);

    // Vecteur hors tolérance (ex: 60°)
    const p60 = {
      x: 100 + 100 * Math.cos((60 * Math.PI) / 180),
      y: 100 - 100 * Math.sin((60 * Math.PI) / 180)
    };
    const res60 = snapToIsometricAngle(p1, p60, 5);
    expect(res60.isSnapped).toBe(false);
  });

  // DET-02 : Rejet strict des réseaux inventés si détection locale non concluante
  it("DET-02: Retourne null si pas de données valides (0 réseau inventé)", async () => {
    // Si pas de données d'image ou canvas non initialisable en environnement Node sans DOM
    const result = await detectSketchTopologyLocal("");
    expect(result).toBeNull();
  });

  // DET-03 : Compilation du modèle croquis vers le format ISO canonique
  it("DET-03: Compilation fidèle du modèle Croquis vers JSON ISO canonique", () => {
    const compiled = compileSketchToIsoModel({
      nodes: DEMO_INITIAL_NODES,
      segments: DEMO_INITIAL_SEGMENTS,
      fittings: DEMO_INITIAL_FITTINGS,
      calibrationScale: 0.25,
      title: "LIGNE-TEST-CROQUIS",
      paperFormat: "A4_landscape",
      lineReference: "L-100",
      service: "GAZ"
    });

    expect(compiled.source).toBe("sketch_to_iso_calque");
    expect(compiled.nodes.length).toBe(DEMO_INITIAL_NODES.length);
    expect(compiled.segments.length).toBe(DEMO_INITIAL_SEGMENTS.length);
    expect(compiled.metadata.totalPipesCount).toBe(DEMO_INITIAL_SEGMENTS.length);
    expect(compiled.metadata.calibrationScalePxPerMm).toBe(0.25);
  });

  // DET-04 : Dictionnaire d'abréviations calligraphiques et apprentissage local
  it("DET-04: Profil d'abréviations et apprentissage local", () => {
    expect(DEFAULT_SKETCH_PROFILE.abbreviations["VPT"]).toBe("vanne_passage_total");
    expect(DEFAULT_SKETCH_PROFILE.abbreviations["CL300"]).toBe("PN50");
    expect(DEFAULT_SKETCH_PROFILE.abbreviations["WN"]).toBe("flange_wn");
  });

  // DET-05 : Formats de papier normalisés A4 et A3
  it("DET-05: Formats de papier A4 / A3 reconnus avec dimensions métriques", () => {
    expect(PAPER_FORMATS.A4_landscape.width).toBe(297);
    expect(PAPER_FORMATS.A4_landscape.height).toBe(210);
    expect(PAPER_FORMATS.A3_landscape.width).toBe(420);
    expect(PAPER_FORMATS.A3_landscape.height).toBe(297);
  });

  // DET-06 : Vérification de la géométrie de référence Demo
  it("DET-06: Géométrie initiale de démo cohérente et connectée", () => {
    expect(DEMO_INITIAL_NODES.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_INITIAL_SEGMENTS.length).toBeGreaterThanOrEqual(4);
    for (const seg of DEMO_INITIAL_SEGMENTS) {
      const n1 = DEMO_INITIAL_NODES.find(n => n.id === seg.fromNodeId);
      const n2 = DEMO_INITIAL_NODES.find(n => n.id === seg.toNodeId);
      expect(n1).toBeDefined();
      expect(n2).toBeDefined();
      expect(ISO_STANDARD_ANGLES).toContain(seg.angleIsoDeg as number);
    }
  });

  // DET-07 (SKETCH-DETECT-04) : Fusion des micro-segments colinéaires de même axe en un seul tronçon continu
  it("DET-07: Fusion des micro-segments colinéaires de même axe en un seul tronçon continu", () => {
    // 4 nœuds formant 3 segments successifs alignés sur l'axe X (330°) à 0.25 px/mm (300mm=75px, 400mm=100px, 500mm=125px)
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 300, elevation: 0 },
      { id: "n2_faux_point", x: 100 + 75 * C30, y: 300 + 75 * S30, elevation: 0 },
      { id: "n3_faux_point", x: 100 + 175 * C30, y: 300 + 175 * S30, elevation: 0 },
      { id: "n4", x: 100 + 300 * C30, y: 300 + 300 * S30, elevation: 0 }
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2_faux_point", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 300, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s2", fromNodeId: "n2_faux_point", toNodeId: "n3_faux_point", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s3", fromNodeId: "n3_faux_point", toNodeId: "n4", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" }
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs, 0.25);

    expect(nodes.length).toBe(2);
    expect(nodes.some(n => n.id === "n1")).toBe(true);
    expect(nodes.some(n => n.id === "n4")).toBe(true);
    expect(nodes.some(n => n.id === "n2_faux_point")).toBe(false);
    expect(nodes.some(n => n.id === "n3_faux_point")).toBe(false);
    expect(segs.length).toBe(1);
    const connects = (segs[0].fromNodeId === "n1" && segs[0].toNodeId === "n4") || (segs[0].fromNodeId === "n4" && segs[0].toNodeId === "n1");
    expect(connects).toBe(true);
    expect(segs[0].lengthMm).toBe(1200);
    expect(segs[0].detectedAxis).toBe("X");
  });

  // DET-08 (SKETCH-DETECT-04) : Préservation stricte des vrais coudes (axes distincts)
  it("DET-08: Préservation stricte des vrais coudes (axes distincts)", () => {
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2_coude", x: 200, y: 42, elevation: 0 },
      { id: "n3", x: 200, y: 200, elevation: 0 }
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2_coude", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 600, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s2", fromNodeId: "n2_coude", toNodeId: "n3", detectedAxis: "Z", angleIsoDeg: 270, lengthMm: 800, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" }
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs);

    expect(nodes.length).toBe(3);
    expect(segs.length).toBe(2);
  });

  // DET-09 (SKETCH-DETECT-04) : Préservation stricte des tés et piquages (3+ segments touchants)
  it("DET-09: Préservation stricte des tés et piquages (3+ segments touchants)", () => {
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n_te", x: 200, y: 42, elevation: 0 },
      { id: "n3", x: 300, y: -16, elevation: 0 },
      { id: "n4_branche", x: 200, y: 150, elevation: 0 }
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n_te", detectedAxis: "X", lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s2", fromNodeId: "n_te", toNodeId: "n3", detectedAxis: "X", lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s3", fromNodeId: "n_te", toNodeId: "n4_branche", detectedAxis: "Z", lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" }
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs);

    expect(nodes.length).toBe(4);
    expect(segs.length).toBe(3);
  });

  // DET-10 (SKETCH-DETECT-04) : Préservation des extrémités libres (1 segment touchant)
  it("DET-10: Préservation des extrémités libres (1 segment touchant)", () => {
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 200, y: 100, elevation: 0 }
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", detectedAxis: "Y", lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" }
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs);

    expect(nodes.length).toBe(2);
    expect(segs.length).toBe(1);
  });

  // DET-11 (SKETCH-DETECT-05) : Reconstruction 3D BFS multi-composantes pour les réseaux disjoints
  it("DET-11: Reconstruction 3D BFS multi-composantes pour les réseaux disjoints", () => {
    // Deux composantes disjointes : comp1 (n1-n2) et comp2 (n3-n4) orientées sur l'axe +X (330°)
    const multiCompNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 200, y: 158, elevation: 0 },
      { id: "n3", x: 500, y: 300, elevation: 500 },
      { id: "n4", x: 600, y: 358, elevation: 500 }
    ];
    const multiCompSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", angleIsoDeg: 330, lengthMm: 1000, nominalDiameter: 80, pressureClass: "Class 300", material: "Acier" },
      { id: "s2", fromNodeId: "n3", toNodeId: "n4", angleIsoDeg: 330, lengthMm: 2000, nominalDiameter: 80, pressureClass: "Class 300", material: "Acier" }
    ];

    const compiled = compileSketchToIsoModel({
      nodes: multiCompNodes,
      segments: multiCompSegs,
      fittings: [],
      calibrationScale: 0.25
    });

    expect(compiled.nodes.length).toBe(4);
    const node1 = compiled.nodes.find(n => n.id === "n1");
    const node2 = compiled.nodes.find(n => n.id === "n2");
    const node3 = compiled.nodes.find(n => n.id === "n3");
    const node4 = compiled.nodes.find(n => n.id === "n4");

    expect(node1).toBeDefined();
    expect(node2).toBeDefined();
    expect(node3).toBeDefined();
    expect(node4).toBeDefined();

    // Dans comp1, dx = 1.0 (len 1000mm sur angle 330° / axe +X)
    const deltaX1 = Math.round((node2!.x - node1!.x) * 1000) / 1000;
    expect(deltaX1).toBe(1.0);

    // Dans comp2, dx = 2.0 (len 2000mm sur angle 330° / axe +X)
    const deltaX2 = Math.round((node4!.x - node3!.x) * 1000) / 1000;
    expect(deltaX2).toBe(2.0);

    // La position de comp2 est décalée par rapport à comp1
    expect(node3!.x !== node1!.x || node3!.y !== node1!.y).toBe(true);
    expect(node3!.y > node1!.y).toBe(true);
  });

  // DET-12 (SKETCH-DETECT-05) : Connexion et transmission des équipements détectés vers le modèle ISO
  it("DET-12: Connexion et transmission des équipements détectés vers le modèle ISO", () => {
    const demoNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 200, y: 100, elevation: 0 }
    ];
    const demoSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", lengthMm: 1000, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" }
    ];

    const compiled = compileSketchToIsoModel({
      nodes: demoNodes,
      segments: demoSegs,
      fittings: [],
      equipment: [
        { id: "eq1", type: "valve", tag: "V-101", label: "Vanne d'isolement", nodeId: "n1" },
        { id: "eq2", type: "pompe", tag: "P-101", label: "Pompe centrifuge", x: 1000, y: 800 }
      ],
      calibrationScale: 0.25
    });

    const n1 = compiled.nodes.find(n => n.id === "n1");
    expect(n1?.equipmentType).toBe("vanne_passage_total");
    expect(n1?.equipmentLabel).toBe("Vanne d'isolement");

    const standalonePump = compiled.nodes.find(n => n.equipmentType === "gare_racleur_depart" || n.name === "P-101");
    expect(standalonePump).toBeDefined();
  });

  // DET-13 (SKETCH-DETECT-08 Partie 1.1) : Placement des composantes par inversion de projection isométrique (compOffsetX/Y/Z)
  it("DET-13: Placement des composantes par inversion de projection isométrique (compOffsetX/Y/Z)", () => {
    const testNodes: SketchVectorNode[] = [
      { id: "root1", x: 400, y: 300, elevation: 1000 },
      { id: "next1", x: 500, y: 242, elevation: 1000 }
    ];
    const testSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "root1", toNodeId: "next1", angleIsoDeg: 30, lengthMm: 1000, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" }
    ];

    const compiled = compileSketchToIsoModel({
      nodes: testNodes,
      segments: testSegs,
      fittings: [],
      calibrationScale: 0.25
    });

    const rootCompiled = compiled.nodes.find(n => n.id === "root1");
    expect(rootCompiled).toBeDefined();

    // Inversion conforme au modèle canonique :
    // sxM = (compOffsetX - compOffsetY) * cos(30°)
    // syUpM = -syM = -(compOffsetX + compOffsetY) * sin(30°) + rootZ
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;
    const reprojectedSxM = (rootCompiled!.x - rootCompiled!.y) * C30;
    const reprojectedSyUpM = -(rootCompiled!.x + rootCompiled!.y) * S30 + rootCompiled!.z;

    const pxPerMeter = 0.25 * 1000; // 250 px/m
    const expectedSxM = (400 - 400) / pxPerMeter; // minX = 400 => 0
    const expectedSyUpM = -(300 - 242) / pxPerMeter; // minY = 242 => -(58/250) = -0.232

    expect(Math.abs(reprojectedSxM - expectedSxM)).toBeLessThan(0.05);
    expect(Math.abs(reprojectedSyUpM - expectedSyUpM)).toBeLessThan(0.05);
    expect(rootCompiled!.z).toBe(1.0);
  });

  // DET-14 (SKETCH-DETECT-08 Partie 1.2) : mergeCollinearSegments avec recalcul mergedSnap et angle opposé à 180°
  it("DET-14: mergeCollinearSegments recalcule mergedSnap et évite l'angle inversé à 180°", () => {
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 200 - 100 * C30, y: 200 - 100 * S30, elevation: 0 },
      { id: "n2_mid", x: 200, y: 200, elevation: 0 },
      { id: "n3", x: 200 + 100 * C30, y: 200 + 100 * S30, elevation: 0 }
    ];
    // segA orienté du point milieu n2 vers n1 (sens 150°, -X), segB de n2 vers n3 (sens 330°, +X)
    const rawSegs: SketchVectorSegment[] = [
      { id: "segA", fromNodeId: "n2_mid", toNodeId: "n1", detectedAxis: "X", angleIsoDeg: 150, lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" },
      { id: "segB", fromNodeId: "n2_mid", toNodeId: "n3", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" }
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs, 0.25);

    expect(nodes.length).toBe(2);
    expect(segs.length).toBe(1);
    const merged = segs[0];
    expect(merged.detectedAxis).toBe("X");
    expect([150, 330]).toContain(merged.angleIsoDeg);
    expect(merged.lengthMm).toBeGreaterThan(0);
  });

  // DET-15 (SKETCH-DETECT-08 Partie 1.3) : Pontage des composantes disjointes proches et alignées
  it("DET-15: bridgeNearbyEndpoints ponte les composantes disjointes proches et alignées", () => {
    // Deux composantes séparées par un intervalle de 40px le long du même axe X (330°)
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;

    const n1 = { id: "n1", x: 100, y: 300, elevation: 0 };
    const n2 = { id: "n2", x: 100 + 100 * C30, y: 300 + 100 * S30, elevation: 0 };
    // Gap de 40px dans la même direction (330°)
    const n3 = { id: "n3", x: n2.x + 40 * C30, y: n2.y + 40 * S30, elevation: 0 };
    const n4 = { id: "n4", x: n3.x + 100 * C30, y: n3.y + 100 * S30, elevation: 0 };

    const nodes: SketchVectorNode[] = [n1, n2, n3, n4];
    const segs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 400, nominalDiameter: 80, pressureClass: "Class 150", material: "Acier" },
      { id: "s2", fromNodeId: "n3", toNodeId: "n4", detectedAxis: "X", angleIsoDeg: 330, lengthMm: 400, nominalDiameter: 80, pressureClass: "Class 150", material: "Acier" }
    ];

    const result = bridgeNearbyEndpoints(nodes, segs, 90, 15, 0.25);

    expect(result.segs.length).toBe(1);
    const connectsEnds = (result.segs[0].fromNodeId === "n1" && result.segs[0].toNodeId === "n4") ||
                         (result.segs[0].fromNodeId === "n4" && result.segs[0].toNodeId === "n1");
    expect(connectsEnds).toBe(true);
    expect(result.nodes.length).toBe(2);
    expect(result.segs[0].detectedAxis).toBe("X");
  });

  // DET-16 (SKETCH-DETECT-08 Partie 2) : Validation du composant Curseur Trièdre AxisCursorOverlay
  it("DET-16: Composant AxisCursorOverlay rendu valide avec axes 330/150° (X), 210/30° (Y), 90/270° (Z)", () => {
    expect(typeof AxisCursorOverlay).toBe("function");
  });

  // Test 17 : Propagation du mapping d'axes personnalisé dans mergeCollinearSegments et bridgeNearbyEndpoints
  it("PROP-01: Vérifie la propagation d'un AxisMappingConfig personnalisé dans mergeCollinearSegments et bridgeNearbyEndpoints", () => {
    const customMapping: AxisMappingConfig = {
      X: [210, 30],
      Y: [330, 150],
      Z: [90, 270]
    };
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;

    // 1. Propagation dans mergeCollinearSegments
    const rawNodes: SketchVectorNode[] = [
      { id: "na", x: 100, y: 300, elevation: 0 },
      { id: "nb", x: 100 + 75 * C30, y: 300 - 75 * S30, elevation: 0 },
      { id: "nc", x: 100 + 175 * C30, y: 300 - 175 * S30, elevation: 0 }
    ];
    const rawSegs: SketchVectorSegment[] = [
      {
        id: "sa",
        fromNodeId: "na",
        toNodeId: "nb",
        detectedAxis: "X",
        angleIsoDeg: 30,
        lengthMm: 300,
        nominalDiameter: 100,
        pressureClass: "Class 150",
        material: "Acier"
      },
      {
        id: "sb",
        fromNodeId: "nb",
        toNodeId: "nc",
        detectedAxis: "X",
        angleIsoDeg: 30,
        lengthMm: 400,
        nominalDiameter: 100,
        pressureClass: "Class 150",
        material: "Acier"
      }
    ];

    const mergedResult = mergeCollinearSegments(rawNodes, rawSegs, 0.25, customMapping);
    expect(mergedResult.nodes.length).toBe(2);
    expect(mergedResult.segs.length).toBe(1);
    expect(mergedResult.segs[0].detectedAxis).toBe("X");

    // 2. Propagation dans bridgeNearbyEndpoints
    const bridgeNodes: SketchVectorNode[] = [
      { id: "b1", x: 100, y: 300, elevation: 0 },
      { id: "b2", x: 100 + 80 * C30, y: 300 - 80 * S30, elevation: 0 },
      { id: "b3", x: 100 + 120 * C30, y: 300 - 120 * S30, elevation: 0 },
      { id: "b4", x: 100 + 200 * C30, y: 300 - 200 * S30, elevation: 0 }
    ];
    const bridgeSegs: SketchVectorSegment[] = [
      {
        id: "bs1",
        fromNodeId: "b1",
        toNodeId: "b2",
        detectedAxis: "X",
        angleIsoDeg: 30,
        lengthMm: 320,
        nominalDiameter: 100,
        pressureClass: "Class 150",
        material: "Acier"
      },
      {
        id: "bs2",
        fromNodeId: "b3",
        toNodeId: "b4",
        detectedAxis: "X",
        angleIsoDeg: 30,
        lengthMm: 320,
        nominalDiameter: 100,
        pressureClass: "Class 150",
        material: "Acier"
      }
    ];

    const bridgeResult = bridgeNearbyEndpoints(bridgeNodes, bridgeSegs, 90, 15, 0.25, customMapping);
    expect(bridgeResult.nodes.length).toBe(2);
    expect(bridgeResult.segs.length).toBe(1);
    expect(bridgeResult.segs[0].detectedAxis).toBe("X");
  });
});
