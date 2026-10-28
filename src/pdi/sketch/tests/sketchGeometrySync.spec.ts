/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-ISO-03-FIX-01 — UNIT & INTEGRATION TESTS:
 * SYNCHRONISATION GÉOMÉTRIE <-> LONGUEURS APRÈS MODIFICATION OU RECALIBRATION
 */
import { describe, it, expect } from "vitest";
import {
  SketchVectorNode,
  SketchVectorSegment,
  calculateSegmentLengthMm,
  syncSegmentsOnNodeMove,
  syncSegmentsOnCalibrationChange,
  isSegmentManualLength,
  applyNodeDragDelta
} from "../sketchRasterEngine";
import { compileSketchToIsoModel } from "../sketchToJsonCompiler";
import { resolveSegmentDisplayLengthMm } from "../SketchReviewTable";

describe("SKETCH-ISO-03-FIX-01 : Synchronisation des longueurs géométriques", () => {
  // Test 1 : Un tronçon automatique dont la longueur change après déplacement d'un nœud
  it("Test 1: Un tronçon automatique met à jour sa longueur après déplacement d'un nœud", () => {
    const initialNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 350, y: 100, elevation: 0 } // distance = 250px
    ];
    const initialSegs: SketchVectorSegment[] = [
      {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 1000, // 250px / 0.25 px/mm = 1000mm
        isManualLength: false
      }
    ];

    const calibrationScale = 0.25; // 0.25 px/mm

    // Déplacement de n2 de (350, 100) vers (600, 100) -> nouvelle distance = 500px -> 2000mm
    const updatedNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 600, y: 100, elevation: 0 }
    ];

    const synced = syncSegmentsOnNodeMove(initialSegs, updatedNodes, ["n2"], calibrationScale);

    expect(synced).toHaveLength(1);
    expect(synced[0].lengthMm).toBe(2000); // 500px / 0.25 px/mm = 2000mm
    expect(synced[0].isManualLength).toBe(false);
  });

  // Test 2 : Un déplacement qui modifie plusieurs tronçons connectés
  it("Test 2: Le déplacement d'un nœud commun actualise tous les tronçons connectés", () => {
    // Étoile / Té avec nœud central n_mid
    const nodes: SketchVectorNode[] = [
      { id: "n_mid", x: 200, y: 200, elevation: 0 },
      { id: "n_left", x: 100, y: 200, elevation: 0 },  // distance = 100px -> 400mm à 0.25 px/mm
      { id: "n_right", x: 400, y: 200, elevation: 0 }, // distance = 200px -> 800mm à 0.25 px/mm
      { id: "n_other", x: 10, y: 10, elevation: 0 },
      { id: "n_far", x: 110, y: 10, elevation: 0 }    // distance = 100px -> tronçon non connecté
    ];

    const segments: SketchVectorSegment[] = [
      {
        id: "s_left",
        fromNodeId: "n_left",
        toNodeId: "n_mid",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 400,
        isManualLength: false
      },
      {
        id: "s_right",
        fromNodeId: "n_mid",
        toNodeId: "n_right",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 800,
        isManualLength: false
      },
      {
        id: "s_unrelated",
        fromNodeId: "n_other",
        toNodeId: "n_far",
        nominalDiameter: 100,
        pressureClass: "Class 150",
        material: "Acier",
        lengthMm: 400,
        isManualLength: false
      }
    ];

    const calibrationScale = 0.25;

    // Déplacement de n_mid de (200, 200) vers (250, 200)
    // Nouvelle distance n_left <-> n_mid : 150px -> 600mm
    // Nouvelle distance n_mid <-> n_right : 150px -> 600mm
    const movedNodes: SketchVectorNode[] = nodes.map((n) =>
      n.id === "n_mid" ? { ...n, x: 250 } : n
    );

    const synced = syncSegmentsOnNodeMove(segments, movedNodes, ["n_mid"], calibrationScale);

    const segLeft = synced.find((s) => s.id === "s_left")!;
    const segRight = synced.find((s) => s.id === "s_right")!;
    const segUnrelated = synced.find((s) => s.id === "s_unrelated")!;

    expect(segLeft.lengthMm).toBe(600); // 150px / 0.25 = 600mm
    expect(segRight.lengthMm).toBe(600); // 150px / 0.25 = 600mm
    expect(segUnrelated.lengthMm).toBe(400); // Tronçon indépendant non modifié
  });

  // Test 3 : Une recalibration qui modifie la longueur automatique
  it("Test 3: Une recalibration modifie toutes les longueurs automatiques à partir de la nouvelle échelle", () => {
    const nodes: SketchVectorNode[] = [
      { id: "n1", x: 0, y: 0, elevation: 0 },
      { id: "n2", x: 500, y: 0, elevation: 0 } // distance = 500px
    ];
    const segments: SketchVectorSegment[] = [
      {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 2000, // Initialement 500px / 0.25 px/mm = 2000mm
        isManualLength: false
      }
    ];

    // Nouvelle échelle : 0.50 px/mm (deux fois plus dense)
    const newCalibrationScale = 0.5;
    const synced = syncSegmentsOnCalibrationChange(segments, nodes, newCalibrationScale);

    expect(synced[0].lengthMm).toBe(1000); // 500px / 0.50 px/mm = 1000mm
    expect(synced[0].isManualLength).toBe(false);
  });

  // Test 4 : Une longueur manuelle qui reste inchangée après déplacement
  it("Test 4: Une longueur saisie manuellement reste inchangée après déplacement d'un nœud", () => {
    const nodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 300, y: 100, elevation: 0 }
    ];
    const segments: SketchVectorSegment[] = [
      {
        id: "s_manual",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 3500, // Longueur explicite saisie par l'ingénieur
        isManualLength: true
      }
    ];

    const calibrationScale = 0.25;

    // Déplacement de n2 vers x=900 (variation géométrique majeure)
    const updatedNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 900, y: 100, elevation: 0 }
    ];

    const synced = syncSegmentsOnNodeMove(segments, updatedNodes, ["n2"], calibrationScale);

    expect(synced[0].lengthMm).toBe(3500); // Strictement préservé
    expect(synced[0].isManualLength).toBe(true);
  });

  // Test 5 : Une longueur manuelle qui reste inchangée après recalibration
  it("Test 5: Une longueur saisie manuellement reste inchangée après recalibration", () => {
    const nodes: SketchVectorNode[] = [
      { id: "n1", x: 0, y: 0, elevation: 0 },
      { id: "n2", x: 500, y: 0, elevation: 0 }
    ];
    const segments: SketchVectorSegment[] = [
      {
        id: "s_manual",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 4200, // Saisie manuelle verrouillée
        isManualLength: true
      },
      {
        id: "s_auto",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 2000,
        isManualLength: false
      }
    ];

    const newScale = 1.0; // 1.0 px/mm (500px -> 500mm en auto)
    const synced = syncSegmentsOnCalibrationChange(segments, nodes, newScale);

    const manualSeg = synced.find((s) => s.id === "s_manual")!;
    const autoSeg = synced.find((s) => s.id === "s_auto")!;

    expect(manualSeg.lengthMm).toBe(4200); // Intacte
    expect(manualSeg.isManualLength).toBe(true);
    expect(autoSeg.lengthMm).toBe(500); // Recalculée (500 / 1.0)
    expect(autoSeg.isManualLength).toBe(false);
  });

  // Test 6 : L’affichage dans le tableau de la valeur correcte et actualisée
  it("Test 6: calculateSegmentLengthMm fournit la longueur exacte affichée pour le canevas et le tableau", () => {
    const n1 = { x: 50, y: 100 };
    const n2 = { x: 250, y: 100 }; // 200px
    const scale = 0.25;

    const len = calculateSegmentLengthMm(n1, n2, scale);
    expect(len).toBe(800); // 200 / 0.25 = 800 mm

    // Repli si calibration invalide (<= 0 ou NaN)
    expect(calculateSegmentLengthMm(n1, n2, 0)).toBeUndefined();
    expect(calculateSegmentLengthMm(n1, n2, -0.5)).toBeUndefined();
    expect(calculateSegmentLengthMm(n1, n2, NaN)).toBeUndefined();
  });

  // Test 7 : La compilation qui utilise la longueur cohérente avec le contrat défini
  it("Test 7: compileSketchToIsoModel utilise la longueur géométrique à jour pour un tronçon auto et préserve la manuelle", () => {
    const nodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 350, y: 100, elevation: 0 }, // 250px -> 1.0m à 250 px/m (0.25 px/mm)
      { id: "n3", x: 350, y: 600, elevation: 0 }  // 500px -> 2.0m à 250 px/m
    ];

    const segments: SketchVectorSegment[] = [
      {
        id: "seg_auto",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 9999, // Ancienne valeur obsolète
        isManualLength: false // Marqué comme automatique -> compilateur doit recalculer depuis coordonnées
      },
      {
        id: "seg_manual",
        fromNodeId: "n2",
        toNodeId: "n3",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 5000, // 5000mm = 5.0m manuel (alors que dist géométrique = 2.0m)
        isManualLength: true
      }
    ];

    const compiled = compileSketchToIsoModel({
      nodes,
      segments,
      fittings: [],
      calibrationScale: 0.25 // pxPerMeter = 250 px/m
    });

    const compiledAuto = compiled.segments.find((s) => s.id === "seg_auto")!;
    const compiledManual = compiled.segments.find((s) => s.id === "seg_manual")!;

    // Le tronçon auto utilise les coordonnées réelles (250px / 250 px/m = 1.0 m) et non l'ancienne valeur obsolète 9999
    expect(compiledAuto.length).toBe(1.0);

    // Le tronçon manuel utilise fidèlement la valeur manuelle saisie (5000 mm = 5.0 m)
    expect(compiledManual.length).toBe(5.0);
  });

  // Test 8 : Compatibilité avec les anciens objets qui ne possèdent pas de marqueur automatique/manuelle
  it("Test 8: Compatibilité avec les objets historiques sans marqueur isManualLength", () => {
    const legacySeg: SketchVectorSegment = {
      id: "legacy_seg_1",
      fromNodeId: "n1",
      toNodeId: "n2",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "Acier",
      lengthMm: 1250 // Sans propriété isManualLength définie
    };

    // 1. isSegmentManualLength considère les anciens objets comme non manuels par défaut
    expect(isSegmentManualLength(legacySeg)).toBe(false);

    // 2. compileSketchToIsoModel préserve la longueur explicite existante d'un objet historique
    const nodes: SketchVectorNode[] = [
      { id: "n1", x: 0, y: 0, elevation: 0 },
      { id: "n2", x: 100, y: 0, elevation: 0 }
    ];

    const compiled = compileSketchToIsoModel({
      nodes,
      segments: [legacySeg],
      fittings: [],
      calibrationScale: 0.25
    });

    expect(compiled.segments[0].length).toBe(1.25); // 1250mm / 1000 = 1.25m

    // 3. Lorsqu'un ancien objet subit un déplacement dans l'UI, il s'actualise correctement sans crasher
    const movedNodes: SketchVectorNode[] = [
      { id: "n1", x: 0, y: 0, elevation: 0 },
      { id: "n2", x: 500, y: 0, elevation: 0 } // 500px -> 2000mm à 0.25 px/mm
    ];

    const synced = syncSegmentsOnNodeMove([legacySeg], movedNodes, ["n2"], 0.25);
    expect(synced[0].lengthMm).toBe(2000);
    expect(synced[0].isManualLength).toBe(false);
  });

  describe("Micro-fix 1 : Synchronisation du déplacement et élimination de closure obsolète", () => {
    it("applyNodeDragDelta calcule avec précision la position finale sans altérer les nœuds non sélectionnés", () => {
      const nodes: SketchVectorNode[] = [
        { id: "n1", x: 100, y: 100, elevation: 0 },
        { id: "n2", x: 200, y: 150, elevation: 0 }
      ];
      const startPositions = new Map<string, { x: number; y: number }>();
      startPositions.set("n1", { x: 100, y: 100 });

      const moved = applyNodeDragDelta(nodes, new Set(["n1"]), startPositions, 50, -30);
      expect(moved[0].x).toBe(150);
      expect(moved[0].y).toBe(70);
      expect(moved[1].x).toBe(200); // Intact
      expect(moved[1].y).toBe(150);
    });

    it("la synchronisation des tronçons s'exécute sur l'état final déplacé sans régression lors du relâchement", () => {
      const initialNodes: SketchVectorNode[] = [
        { id: "n1", x: 0, y: 0, elevation: 0 },
        { id: "n2", x: 100, y: 0, elevation: 0 } // dist = 100px -> 400mm à 0.25
      ];
      const segments: SketchVectorSegment[] = [
        {
          id: "s1",
          fromNodeId: "n1",
          toNodeId: "n2",
          nominalDiameter: 150,
          pressureClass: "Class 300",
          material: "Acier API 5L Gr. B",
          lengthMm: 400,
          isManualLength: false
        }
      ];

      const startPositions = new Map<string, { x: number; y: number }>();
      startPositions.set("n2", { x: 100, y: 0 });

      // Déplacement final avec delta dx=200 -> nouvelle position n2 à x=300 -> dist = 300px -> 1200mm
      const finalNodes = applyNodeDragDelta(initialNodes, new Set(["n2"]), startPositions, 200, 0);
      const synced = syncSegmentsOnNodeMove(segments, finalNodes, new Set(["n2"]), 0.25);

      expect(synced[0].lengthMm).toBe(1200);

      // Simulation du bug évité : si un recalcul utilisait par erreur les anciens `initialNodes` capturés par closure,
      // la longueur serait faussement écrasée à 400. La suppression du recalcul obsolète garantit que 1200 est conservé.
      expect(synced[0].lengthMm).not.toBe(400);
    });
  });

  describe("Micro-fix 2 : Priorité d'affichage dans la table de révision (resolveSegmentDisplayLengthMm)", () => {
    const testNodes: SketchVectorNode[] = [
      { id: "n1", x: 0, y: 0, elevation: 0 },
      { id: "n2", x: 300, y: 0, elevation: 0 } // distance = 300px -> autoLengthMm = 1200mm à 0.25 px/mm
    ];

    it("priorise la longueur géométrique calculée (autoLengthMm) sur une valeur historique périmée pour un tronçon auto", () => {
      const staleAutoSeg: SketchVectorSegment = {
        id: "s_auto_stale",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 9999, // Valeur historique périmée
        isManualLength: false
      };

      // Doit afficher 1200mm (calcul géométrique 300 / 0.25) et ignorer la valeur périmée 9999
      const displayed = resolveSegmentDisplayLengthMm(staleAutoSeg, testNodes, 0.25);
      expect(displayed).toBe(1200);
    });

    it("priorise également la longueur géométrique pour un tronçon hérité sans marqueur isManualLength", () => {
      const legacySeg: SketchVectorSegment = {
        id: "s_legacy",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 8888 // Valeur historique
      };

      const displayed = resolveSegmentDisplayLengthMm(legacySeg, testNodes, 0.25);
      expect(displayed).toBe(1200);
    });

    it("affiche fidèlement la longueur manuelle saisie pour un tronçon avec isManualLength: true", () => {
      const manualSeg: SketchVectorSegment = {
        id: "s_manual",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 4500, // Saisie manuelle utilisateur
        isManualLength: true
      };

      // Doit afficher 4500mm même si la géométrie donne 1200mm
      const displayed = resolveSegmentDisplayLengthMm(manualSeg, testNodes, 0.25);
      expect(displayed).toBe(4500);
    });

    it("se replie sur seg.lengthMm si l'échelle est invalide ou non calibrée (<= 0)", () => {
      const seg: SketchVectorSegment = {
        id: "s_fallback",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L Gr. B",
        lengthMm: 600,
        isManualLength: false
      };

      expect(resolveSegmentDisplayLengthMm(seg, testNodes, 0)).toBe(600);
      expect(resolveSegmentDisplayLengthMm(seg, testNodes, -1)).toBe(600);
    });
  });
});

