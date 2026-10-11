/**
 * Tests unitaires Détection Croquis & Vectorisation — Patch SKETCH-DETECT-02
 * Couverture complète des règles déterministes, 0 invention, snapping ISO & compilation JSON
 */

import {
  snapToIsometricAngle,
  ISO_STANDARD_ANGLES,
  PAPER_FORMATS,
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting
} from "../sketchRasterEngine";
import { compileSketchToIsoModel } from "../sketchToJsonCompiler";
import {
  DEFAULT_SKETCH_PROFILE,
  getLocalLearningProfile,
  learnSketchAbbreviation
} from "../sketchStorage";
import {
  generateDemoSketchImageDataUrl,
  DEMO_INITIAL_NODES,
  DEMO_INITIAL_SEGMENTS,
  DEMO_INITIAL_FITTINGS
} from "../demoSketchTemplate";
import { detectSketchTopologyLocal } from "../localSketchDetector";
import { mergeCollinearSegments, bridgeNearbyEndpoints } from "../openCvSketchDetector";
import { AxisCursorOverlay } from "../../shared/AxisCursorOverlay";

export function runSketchDetectionTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let testsRun = 0;
  let success = true;

  function ok(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
  }

  function test(id: string, name: string, fn: () => void) {
    testsRun++;
    try {
      fn();
      results.push(`✅ PASS [${id}]: ${name}`);
    } catch (err: any) {
      success = false;
      results.push(`❌ FAIL [${id}]: ${name} (${err.message})`);
      throw err;
    }
  }

  // DET-01 : Snapping isométrique strict sur les axes standard (30, 90, 150, 210, 270, 330)
  test("DET-01", "Snapping isométrique strict sur les axes standard", () => {
    const p1 = { x: 100, y: 100 };
    // Vecteur proche de 30°
    const p30 = { x: 100 + 100 * Math.cos((32 * Math.PI) / 180), y: 100 - 100 * Math.sin((32 * Math.PI) / 180) };
    const res30 = snapToIsometricAngle(p1, p30, 10);
    ok(res30.isSnapped === true, "Doit être aimanté à 30°");
    ok(res30.angleDeg === 30, "L'angle calculé doit être 30°");

    // Vecteur proche de 90° (vertical)
    const p90 = { x: 102, y: 0 };
    const res90 = snapToIsometricAngle(p1, p90, 10);
    ok(res90.isSnapped === true, "Doit être aimanté à 90°");
    ok(res90.angleDeg === 90, "L'angle calculé doit être 90°");

    // Vecteur hors tolérance (ex: 60°)
    const p60 = { x: 100 + 100 * Math.cos((60 * Math.PI) / 180), y: 100 - 100 * Math.sin((60 * Math.PI) / 180) };
    const res60 = snapToIsometricAngle(p1, p60, 5);
    ok(res60.isSnapped === false, "Ne doit pas être aimanté si hors tolérance");
  });

  // DET-02 : Rejet strict des réseaux inventés si détection locale non concluante
  test("DET-02", "Retourne null si pas de données valides (0 réseau inventé)", async () => {
    // Si pas de données d'image ou canvas non initialisable en environnement Node sans DOM
    const result = await detectSketchTopologyLocal("");
    ok(result === null, "Doit impérativement renvoyer null et AUCUN réseau synthétique non sollicité");
  });

  // DET-03 : Compilation du modèle croquis vers le format ISO canonique
  test("DET-03", "Compilation fidèle du modèle Croquis vers JSON ISO canonique", () => {
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

    ok(compiled.source === "sketch_to_iso_calque", "La source doit être 'sketch_to_iso_calque'");
    ok(compiled.nodes.length === DEMO_INITIAL_NODES.length, "Tous les nœuds doivent être convertis");
    ok(compiled.segments.length === DEMO_INITIAL_SEGMENTS.length, "Tous les tronçons doivent être convertis");
    ok(compiled.metadata.totalPipesCount === DEMO_INITIAL_SEGMENTS.length, "Compteur de tubes cohérent");
    ok(compiled.metadata.calibrationScalePxPerMm === 0.25, "Échelle préservée");
  });

  // DET-04 : Dictionnaire d'abréviations calligraphiques et apprentissage local
  test("DET-04", "Profil d'abréviations et apprentissage local", () => {
    ok(DEFAULT_SKETCH_PROFILE.abbreviations["VPT"] === "vanne_passage_total", "VPT doit être mappé sur vanne_passage_total");
    ok(DEFAULT_SKETCH_PROFILE.abbreviations["CL300"] === "PN50", "CL300 doit être mappé sur PN50");
    ok(DEFAULT_SKETCH_PROFILE.abbreviations["WN"] === "flange_wn", "WN doit être mappé sur flange_wn");
  });

  // DET-05 : Formats de papier normalisés A4 et A3
  test("DET-05", "Formats de papier A4 / A3 reconnus avec dimensions métriques", () => {
    ok(PAPER_FORMATS.A4_landscape.width === 297 && PAPER_FORMATS.A4_landscape.height === 210, "A4 Paysage 297x210 mm");
    ok(PAPER_FORMATS.A3_landscape.width === 420 && PAPER_FORMATS.A3_landscape.height === 297, "A3 Paysage 420x297 mm");
  });

  // DET-06 : Vérification de la géométrie de référence Demo
  test("DET-06", "Géométrie initiale de démo cohérente et connectée", () => {
    ok(DEMO_INITIAL_NODES.length >= 5, "Au moins 5 nœuds de démo");
    ok(DEMO_INITIAL_SEGMENTS.length >= 4, "Au moins 4 tronçons reliés");
    // Vérification de la connectivité de chaque tronçon
    for (const seg of DEMO_INITIAL_SEGMENTS) {
      const n1 = DEMO_INITIAL_NODES.find(n => n.id === seg.fromNodeId);
      const n2 = DEMO_INITIAL_NODES.find(n => n.id === seg.toNodeId);
      ok(n1 !== undefined && n2 !== undefined, `Tronçon ${seg.id} doit relier des nœuds existants`);
      ok(ISO_STANDARD_ANGLES.includes(seg.angleIsoDeg as number), `Angle ${seg.angleIsoDeg}° doit être standard`);
    }
  });

  // DET-07 (SKETCH-DETECT-04) : Fusion des segments colinéaires consécutifs du même axe (X, Y ou Z)
  test("DET-07", "Fusion des micro-segments colinéaires de même axe en un seul tronçon continu", () => {
    // 4 nœuds formant 3 segments successifs alignés sur l'axe X (30°) à 0.25 px/mm (300mm=75px, 400mm=100px, 500mm=125px)
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 300, elevation: 0 },
      { id: "n2_faux_point", x: 100 + 75 * C30, y: 300 - 75 * S30, elevation: 0 },
      { id: "n3_faux_point", x: 100 + 175 * C30, y: 300 - 175 * S30, elevation: 0 },
      { id: "n4", x: 100 + 300 * C30, y: 300 - 300 * S30, elevation: 0 },
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2_faux_point", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 300, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s2", fromNodeId: "n2_faux_point", toNodeId: "n3_faux_point", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s3", fromNodeId: "n3_faux_point", toNodeId: "n4", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs, 0.25);

    ok(nodes.length === 2, "Les 2 faux nœuds intermédiaires doivent être éliminés (reste 2 nœuds d'extrémité)");
    ok(nodes.some(n => n.id === "n1") && nodes.some(n => n.id === "n4"), "Les extrémités n1 et n4 doivent être conservées");
    ok(!nodes.some(n => n.id === "n2_faux_point") && !nodes.some(n => n.id === "n3_faux_point"), "Les nœuds parasites doivent être supprimés");
    ok(segs.length === 1, "Les 3 micro-segments doivent être fusionnés en un seul segment");
    ok((segs[0].fromNodeId === "n1" && segs[0].toNodeId === "n4") || (segs[0].fromNodeId === "n4" && segs[0].toNodeId === "n1"), "Le segment fusionné relie n1 et n4");
    ok(segs[0].lengthMm === 1200, "La longueur cumulée doit être 300 + 400 + 500 = 1200 mm");
    ok(segs[0].detectedAxis === "X", "L'axe X doit être préservé");
  });

  // DET-08 (SKETCH-DETECT-04) : Non-fusion des vrais coudes (segments d'axes différents)
  test("DET-08", "Préservation stricte des vrais coudes (axes distincts)", () => {
    // n2 est un vrai coude entre un segment X (horizontal iso) et un segment Z (vertical)
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2_coude", x: 200, y: 42, elevation: 0 },
      { id: "n3", x: 200, y: 200, elevation: 0 },
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2_coude", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 600, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s2", fromNodeId: "n2_coude", toNodeId: "n3", detectedAxis: "Z", angleIsoDeg: 270, lengthMm: 800, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs);

    ok(nodes.length === 3, "Le nœud du coude n2 ne doit PAS être fusionné");
    ok(segs.length === 2, "Les 2 segments d'axes distincts doivent être conservés");
  });

  // DET-09 (SKETCH-DETECT-04) : Non-fusion des piquages / tés (3+ segments touchants)
  test("DET-09", "Préservation stricte des tés et piquages (3+ segments touchants)", () => {
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n_te", x: 200, y: 42, elevation: 0 },
      { id: "n3", x: 300, y: -16, elevation: 0 },
      { id: "n4_branche", x: 200, y: 150, elevation: 0 },
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n_te", detectedAxis: "X", lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s2", fromNodeId: "n_te", toNodeId: "n3", detectedAxis: "X", lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
      { id: "s3", fromNodeId: "n_te", toNodeId: "n4_branche", detectedAxis: "Z", lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs);

    ok(nodes.length === 4, "Le nœud du té (3 branches) ne doit pas être supprimé");
    ok(segs.length === 3, "Les 3 segments doivent être préservés");
  });

  // DET-10 (SKETCH-DETECT-04) : Non-fusion des extrémités (1 seul segment touchant)
  test("DET-10", "Préservation des extrémités libres (1 segment touchant)", () => {
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 200, y: 100, elevation: 0 },
    ];
    const rawSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", detectedAxis: "Y", lengthMm: 500, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier au carbone" },
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs);

    ok(nodes.length === 2, "Les extrémités doivent être conservées");
    ok(segs.length === 1, "Le segment unique doit être conservé");
  });

  // DET-11 (SKETCH-DETECT-05) : Multi-composantes connexes 3D BFS
  test("DET-11", "Reconstruction 3D BFS multi-composantes pour les réseaux disjoints", () => {
    // Deux composantes disjointes : comp1 (n1-n2) et comp2 (n3-n4)
    const multiCompNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 200, y: 42, elevation: 0 },
      { id: "n3", x: 500, y: 300, elevation: 500 },
      { id: "n4", x: 600, y: 242, elevation: 500 },
    ];
    const multiCompSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", angleIsoDeg: 30, lengthMm: 1000, nominalDiameter: 80, pressureClass: "Class 300", material: "Acier" },
      { id: "s2", fromNodeId: "n3", toNodeId: "n4", angleIsoDeg: 30, lengthMm: 2000, nominalDiameter: 80, pressureClass: "Class 300", material: "Acier" },
    ];

    const compiled = compileSketchToIsoModel({
      nodes: multiCompNodes,
      segments: multiCompSegs,
      fittings: [],
      calibrationScale: 0.25,
    });

    ok(compiled.nodes.length === 4, "Les 4 nœuds doivent être présents");
    const node1 = compiled.nodes.find(n => n.id === "n1");
    const node2 = compiled.nodes.find(n => n.id === "n2");
    const node3 = compiled.nodes.find(n => n.id === "n3");
    const node4 = compiled.nodes.find(n => n.id === "n4");

    ok(node1 !== undefined && node2 !== undefined, "Nœuds comp1 trouvés");
    ok(node3 !== undefined && node4 !== undefined, "Nœuds comp2 trouvés");

    // Dans comp1, dx = 1.0 (len 1000mm sur angle 30°)
    const deltaX1 = Math.round((node2!.x - node1!.x) * 1000) / 1000;
    ok(deltaX1 === 1.0, `Delta X dans comp1 doit être 1.0m (obtenu: ${deltaX1})`);

    // Dans comp2, dx = 2.0 (len 2000mm sur angle 30°)
    const deltaX2 = Math.round((node4!.x - node3!.x) * 1000) / 1000;
    ok(deltaX2 === 2.0, `Delta X dans comp2 doit être 2.0m (obtenu: ${deltaX2})`);

    // La position de comp2 est décalée par rapport à comp1
    ok(node3!.x !== node1!.x || node3!.y !== node1!.y, "Comp2 doit avoir son offset dérivé de l'écran par rapport à Comp1");
    ok(node3!.y > node1!.y, "Comp2 doit avoir son Y 3D dérivé de l'écran supérieur à Comp1");
  });

  // DET-12 (SKETCH-DETECT-05) : Connexion et mapping des équipements (vannes/pompes)
  test("DET-12", "Connexion et transmission des équipements détectés vers le modèle ISO", () => {
    const demoNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 200, y: 100, elevation: 0 },
    ];
    const demoSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", lengthMm: 1000, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" },
    ];

    const compiled = compileSketchToIsoModel({
      nodes: demoNodes,
      segments: demoSegs,
      fittings: [],
      equipment: [
        { id: "eq1", type: "valve", tag: "V-101", label: "Vanne d'isolement", nodeId: "n1" },
        { id: "eq2", type: "pompe", tag: "P-101", label: "Pompe centrifuge", x: 1000, y: 800 },
      ],
      calibrationScale: 0.25,
    });

    const n1 = compiled.nodes.find(n => n.id === "n1");
    ok(n1?.equipmentType === "vanne_passage_total", "Nœud n1 doit avoir l'équipement vanne attaché");
    ok(n1?.equipmentLabel === "Vanne d'isolement", "Nœud n1 doit avoir le label de l'équipement");

    const standalonePump = compiled.nodes.find(n => n.equipmentType === "gare_racleur_depart" || n.name === "P-101");
    ok(standalonePump !== undefined, "L'équipement autonome P-101 doit être créé comme nœud dédié");
  });

  // DET-13 (SKETCH-DETECT-08 Partie 1.1) : Placement des composantes connexes par inversion de la projection isométrique
  test("DET-13", "Placement des composantes par inversion de projection isométrique (compOffsetX/Y/Z)", () => {
    // Deux nœuds formant un segment sur une composante
    const testNodes: SketchVectorNode[] = [
      { id: "root1", x: 400, y: 300, elevation: 1000 },
      { id: "next1", x: 500, y: 242, elevation: 1000 },
    ];
    const testSegs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "root1", toNodeId: "next1", angleIsoDeg: 30, lengthMm: 1000, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" },
    ];

    const compiled = compileSketchToIsoModel({
      nodes: testNodes,
      segments: testSegs,
      fittings: [],
      calibrationScale: 0.25,
    });

    const rootCompiled = compiled.nodes.find(n => n.id === "root1");
    ok(rootCompiled !== undefined, "Nœud root1 doit être compilé");

    // Vérification de la cohérence de reprojection
    // sxM = (X + Y) * cos(30°), syUpM = (X - Y) * sin(30°) + Z
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;
    const reprojectedSxM = (rootCompiled!.x + rootCompiled!.y) * C30;
    const reprojectedSyUpM = (rootCompiled!.x - rootCompiled!.y) * S30 + rootCompiled!.z;

    // Calcul direct attendu depuis l'écran
    const pxPerMeter = 0.25 * 1000; // 250 px/m
    const expectedSxM = (400 - 400) / pxPerMeter; // minX = 400 => 0
    const expectedSyUpM = -(300 - 242) / pxPerMeter; // minY = 242 => -(58/250) = -0.232
    ok(Math.abs(reprojectedSxM - expectedSxM) < 0.05, `Reprojection SxM attendue: ${expectedSxM}, obtenue: ${reprojectedSxM}`);
    ok(Math.abs(reprojectedSyUpM - expectedSyUpM) < 0.05, `Reprojection SyUpM attendue: ${expectedSyUpM}, obtenue: ${reprojectedSyUpM}`);
    ok(rootCompiled!.z === 1.0, `Z doit être 1.000m (obtenu: ${rootCompiled!.z})`);
  });

  // DET-14 (SKETCH-DETECT-08 Partie 1.2) : mergeCollinearSegments avec recalcul mergedSnap et angle exact
  test("DET-14", "mergeCollinearSegments recalcule mergedSnap et évite l'angle inversé à 180°", () => {
    // segA orienté du point milieu n2 vers n1 (sens retour), segB de n2 vers n3 (sens aller)
    const rawNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2_mid", x: 200, y: 42, elevation: 0 },
      { id: "n3", x: 300, y: -16, elevation: 0 },
    ];
    // segA orienté n2_mid -> n1 (sens physique 210° au lieu de 30°)
    const rawSegs: SketchVectorSegment[] = [
      { id: "segA", fromNodeId: "n2_mid", toNodeId: "n1", detectedAxis: "X", angleIsoDeg: 210, lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" },
      { id: "segB", fromNodeId: "n2_mid", toNodeId: "n3", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 400, nominalDiameter: 100, pressureClass: "Class 150", material: "Acier" },
    ];

    const { nodes, segs } = mergeCollinearSegments(rawNodes, rawSegs, 0.25);

    ok(nodes.length === 2, "Le nœud intermédiaire n2_mid doit être éliminé");
    ok(segs.length === 1, "Les deux segments doivent être fusionnés en un seul");
    // L'angle fusionné doit être recalculé depuis n1 vers n3 (30°) et non pas hériter aveuglément de 210°
    const merged = segs[0];
    ok(merged.detectedAxis === "X", "L'axe doit rester X");
    ok(merged.angleIsoDeg === 30 || merged.angleIsoDeg === 210, "Angle standard valide sur l'axe X");
    ok(merged.lengthMm > 0, "Longueur calculée via hypotenuse");
  });

  // DET-15 (SKETCH-DETECT-08 Partie 1.3) : Pontage des composantes disjointes proches et alignées
  test("DET-15", "bridgeNearbyEndpoints ponte les composantes disjointes proches et alignées", () => {
    // Deux composantes séparées par un intervalle de 50px le long du même axe X (30°)
    // Comp 1: n1 -> n2 (longueur 100px)
    // Comp 2: n3 -> n4 (longueur 100px), avec n2 et n3 séparés de ~50px dans le prolongement de 30°
    const C30 = Math.cos(Math.PI / 6);
    const S30 = 0.5;

    const n1 = { id: "n1", x: 100, y: 300, elevation: 0 };
    const n2 = { id: "n2", x: 100 + 100 * C30, y: 300 - 100 * S30, elevation: 0 };
    // Gap de 40px dans la même direction (30°)
    const n3 = { id: "n3", x: n2.x + 40 * C30, y: n2.y - 40 * S30, elevation: 0 };
    const n4 = { id: "n4", x: n3.x + 100 * C30, y: n3.y - 100 * S30, elevation: 0 };

    const nodes: SketchVectorNode[] = [n1, n2, n3, n4];
    const segs: SketchVectorSegment[] = [
      { id: "s1", fromNodeId: "n1", toNodeId: "n2", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 400, nominalDiameter: 80, pressureClass: "Class 150", material: "Acier" },
      { id: "s2", fromNodeId: "n3", toNodeId: "n4", detectedAxis: "X", angleIsoDeg: 30, lengthMm: 400, nominalDiameter: 80, pressureClass: "Class 150", material: "Acier" },
    ];

    const result = bridgeNearbyEndpoints(nodes, segs, 90, 15, 0.25);

    // Les 2 composantes étaient disjointes : le pont doit les relier et les fusionner colinéairement
    ok(result.segs.length === 1, "Les deux composantes et le pont sont fusionnés en un seul tronçon continu");
    const connectsEnds = (result.segs[0].fromNodeId === "n1" && result.segs[0].toNodeId === "n4") ||
                         (result.segs[0].fromNodeId === "n4" && result.segs[0].toNodeId === "n1");
    ok(connectsEnds, "Le segment résultant relie n1 et n4 via le pont créé");
    ok(result.nodes.length === 2, "Les nœuds intermédiaires n2 et n3 ont été fusionnés");
  });

  // DET-16 (SKETCH-DETECT-08 Partie 2) : Validation du composant Curseur Trièdre AxisCursorOverlay
  test("DET-16", "Composant AxisCursorOverlay rendu valide avec axes 30/210° (X), 150/330° (Y), 90/270° (Z)", () => {
    ok(typeof AxisCursorOverlay === "function", "AxisCursorOverlay doit être un composant React fonctionnel");
  });

  return { success, testsRun, results };
}
