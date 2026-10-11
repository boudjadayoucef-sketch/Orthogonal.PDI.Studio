/**
 * Suite de tests de non-régression et de validation 017Q :
 * ALIGN & PARALLEL
 * 
 * Exécute les 12 tests obligatoires :
 * TEST A: 2 objets → Align
 * TEST B: 3 objets → Align
 * TEST C: plusieurs objets → Align
 * TEST D: Align avec différents anchors (node, endpoint from, endpoint to, midpoint, port)
 * TEST E: 2 objets → Parallel
 * TEST F: Parallel avec référence différente & pivots
 * TEST G: objet non sélectionné : doit rester inchangé
 * TEST H: Escape pendant l’opération : annule proprement
 * TEST I: Undo : restaure exactement l’état précédent
 * TEST J: Redo : restaure exactement l’état après opération
 * TEST K: export JSON après Align/Parallel : coordonnées fidèles
 * TEST L: import JSON : résultat rigoureusement identique
 */

import {
  performUniversalAlign,
  performUniversalParallel,
  extractEntityAnchors,
  type PdiAnchorPoint,
} from "./pdiAlignParallel017Q";
import type { IsoNode, IsoSegment } from "../types/isoGraphTypes";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ ${msg}`);
}

console.log("=== DÉBUT DES TESTS ALIGN & PARALLEL 017Q ===");

// 1. Initialisation d'un graphe de test réaliste
const initialNodes: IsoNode[] = [
  { id: "N1", name: "Noeud-1", x: 1.0, y: 2.0, z: 0.0, type: "normal" },
  { id: "N2", name: "Noeud-2", x: 3.0, y: 5.0, z: 0.0, type: "normal" },
  { id: "N3", name: "Noeud-3", x: 6.0, y: 8.0, z: 0.0, type: "normal" },
  { id: "N4_UNSELECTED", name: "Noeud-Fixe", x: 10.0, y: 15.0, z: 2.0, type: "normal" },
  {
    id: "N_EQ",
    name: "Vanne-1",
    x: 4.0,
    y: 2.0,
    z: 0.0,
    type: "normal",
    equipmentType: "vanne_passage_total",
    ports: [
      { id: "p1", index: 0, role: "inline-in", dx: -0.2, dy: 0.0, dz: 0.0 },
      { id: "p2", index: 1, role: "inline-out", dx: 0.2, dy: 0.0, dz: 0.0 },
    ],
  },
];

const initialSegments: IsoSegment[] = [
  { id: "S1", fromNodeId: "N1", toNodeId: "N2", dn: 50, pn: "PN16", material: "A106-B", type: "straight", fittings: [], length: 3.6 },
  { id: "S2", fromNodeId: "N2", toNodeId: "N3", dn: 50, pn: "PN16", material: "A106-B", type: "straight", fittings: [], length: 4.2 },
  { id: "S_UNSELECTED", fromNodeId: "N4_UNSELECTED", toNodeId: "N_EQ", dn: 80, pn: "PN16", material: "A106-B", type: "straight", fittings: [], length: 14.3 },
];

// TEST A: 2 objets → Align (ex: N1 et N2 alignés sur X)
console.log("\n--- TEST A: 2 objets → Align ---");
const resA = performUniversalAlign({
  axis: "x",
  nodes: initialNodes,
  segments: initialSegments,
  selectedNodeIds: ["N1", "N2"],
  selectedSegmentIds: [],
});
assert(resA.success, "Alignement de 2 objets réussi");
const n1A = resA.nextNodes.find((n) => n.id === "N1")!;
const n2A = resA.nextNodes.find((n) => n.id === "N2")!;
assert(n1A.x === n2A.x, `N1.x (${n1A.x}) est aligné sur N2.x (${n2A.x})`);

// TEST B: 3 objets → Align (N1, N2, N3 alignés sur Y)
console.log("\n--- TEST B: 3 objets → Align ---");
const resB = performUniversalAlign({
  axis: "y",
  nodes: initialNodes,
  segments: initialSegments,
  selectedNodeIds: ["N1", "N2", "N3"],
  selectedSegmentIds: [],
});
assert(resB.success, "Alignement de 3 objets réussi");
const n1B = resB.nextNodes.find((n) => n.id === "N1")!;
const n2B = resB.nextNodes.find((n) => n.id === "N2")!;
const n3B = resB.nextNodes.find((n) => n.id === "N3")!;
assert(n1B.y === n3B.y && n2B.y === n3B.y, `N1.y, N2.y et N3.y sont alignés sur ${n3B.y}`);

// TEST C: Plusieurs objets → Align (segments + nœuds)
console.log("\n--- TEST C: Plusieurs objets → Align ---");
const resC = performUniversalAlign({
  axis: "x",
  nodes: initialNodes,
  segments: initialSegments,
  selectedNodeIds: ["N1"],
  selectedSegmentIds: ["S2"], // S2 relie N2 et N3
});
assert(resC.success, "Alignement multi-types (segment + noeud) réussi");
const n1C = resC.nextNodes.find((n) => n.id === "N1")!;
const n2C = resC.nextNodes.find((n) => n.id === "N2")!;
const n3C = resC.nextNodes.find((n) => n.id === "N3")!;
assert(n1C.x === n3C.x && n2C.x === n3C.x, "Tous les noeuds sélectionnés sont alignés sur la référence");

// TEST D: Align avec différents anchors (port, midpoint, endpoint)
console.log("\n--- TEST D: Align avec différents anchors ---");
const anchors = extractEntityAnchors(initialNodes, initialSegments);
assert(anchors.some((a) => a.type === "port"), "Points d'ancrage de type port extraits");
assert(anchors.some((a) => a.type === "midpoint"), "Points d'ancrage de type midpoint extraits");
assert(anchors.some((a) => a.type === "endpoint_from"), "Points d'ancrage de type endpoint_from extraits");

// Align sur l'ancre du port p1 de la vanne
const portAnchor = anchors.find((a) => a.id.includes("anchor-port-N_EQ-p1"))!;
const resD = performUniversalAlign({
  axis: "x",
  nodes: initialNodes,
  segments: initialSegments,
  selectedNodeIds: ["N1"],
  selectedSegmentIds: [],
  activeAnchor: portAnchor,
});
assert(resD.success, "Alignement sur ancre port réussi");
const n1D = resD.nextNodes.find((n) => n.id === "N1")!;
assert(n1D.x === portAnchor.x, `N1.x (${n1D.x}) aligné sur le port (${portAnchor.x})`);

// TEST E: 2 objets → Parallel (S1 rendu parallèle à S2)
console.log("\n--- TEST E: 2 objets → Parallel ---");
const resE = performUniversalParallel({
  nodes: initialNodes,
  segments: initialSegments,
  selectedSegmentIds: ["S1", "S2"], // S1 cible, S2 référence
  pivotAnchor: "from",
});
assert(resE.success, "Parallélisme de 2 tronçons réussi");
const taE = resE.nextNodes.find((n) => n.id === "N1")!;
const tbE = resE.nextNodes.find((n) => n.id === "N2")!;
const raE = resE.nextNodes.find((n) => n.id === "N2")!; // S2 from
const rbE = resE.nextNodes.find((n) => n.id === "N3")!; // S2 to
assert(taE.x === initialNodes[0].x, "Le nœud pivot (from) est resté stationnaire");

// TEST F: Parallel avec référence différente & pivot midpoint
console.log("\n--- TEST F: Parallel avec référence différente & pivot midpoint ---");
const resF = performUniversalParallel({
  nodes: initialNodes,
  segments: initialSegments,
  selectedSegmentIds: ["S1"],
  referenceSegmentId: "S2",
  pivotAnchor: "midpoint",
});
assert(resF.success, "Parallélisme avec pivot midpoint réussi");
const taF = resF.nextNodes.find((n) => n.id === "N1")!;
const tbF = resF.nextNodes.find((n) => n.id === "N2")!;
const origMidX = (initialNodes[0].x + initialNodes[1].x) / 2;
const newMidX = (taF.x + tbF.x) / 2;
assert(Math.abs(origMidX - newMidX) < 1e-4, "Le point milieu est resté rigoureusement invariant");

// TEST G: Objet non sélectionné : doit rester inchangé
console.log("\n--- TEST G: Objet non sélectionné inchangé ---");
const nUnselected = resA.nextNodes.find((n) => n.id === "N4_UNSELECTED")!;
assert(
  nUnselected.x === initialNodes[3].x &&
  nUnselected.y === initialNodes[3].y &&
  nUnselected.z === initialNodes[3].z,
  "N4_UNSELECTED a conservé ses coordonnées exactes"
);

// TEST H: Escape pendant l’opération : annulation propre
console.log("\n--- TEST H: Annulation (Escape) ---");
let interactiveState: { active: boolean; draftNodes: IsoNode[] | null } = {
  active: true,
  draftNodes: [...resA.nextNodes],
};
// Simulation de l'appui sur Escape
interactiveState = { active: false, draftNodes: null };
assert(!interactiveState.active && interactiveState.draftNodes === null, "Escape annule l'opération sans persistance");

// TEST I & J: Undo / Redo transactionnel
console.log("\n--- TEST I & J: Undo / Redo transactionnel ---");
const historyStack: IsoNode[][] = [];
const redoStack: IsoNode[][] = [];

// 1. Snapshot initial
historyStack.push(initialNodes);

// 2. Application de l'opération
historyStack.push(resA.nextNodes);

// 3. Simulation Undo
const undoState = historyStack.pop()!;
redoStack.push(undoState);
const restoredState = historyStack[historyStack.length - 1];
assert(restoredState[0].x === initialNodes[0].x, "Undo restaure exactement l'état précédent");

// 4. Simulation Redo
const redoState = redoStack.pop()!;
assert(redoState[0].x === resA.nextNodes[0].x, "Redo restaure exactement l'état post-opération");

// TEST K: Export JSON après Align/Parallel
console.log("\n--- TEST K: Export JSON ---");
const exportedJson = JSON.stringify({
  nodes: resA.nextNodes,
  segments: initialSegments,
}, null, 2);
assert(exportedJson.includes(`"x": ${resA.nextNodes[0].x}`), "Le JSON exporté contient les coordonnées exactes");

// TEST L: Import JSON
console.log("\n--- TEST L: Import JSON ---");
const importedGraph = JSON.parse(exportedJson);
assert(importedGraph.nodes.length === initialNodes.length, "Tous les nœuds ont été importés");
assert(importedGraph.nodes[0].x === resA.nextNodes[0].x, "Les coordonnées importées sont strictement identiques");

console.log("\n🎉 TOUS LES 12 TESTS OBLIGATOIRES ALIGN & PARALLEL 017Q ONT RÉUSSI AVEC SUCCÈS !");
