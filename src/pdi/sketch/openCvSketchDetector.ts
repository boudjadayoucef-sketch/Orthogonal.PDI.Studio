/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * DÉTECTION DE TOPOLOGIE CROQUIS 100% LOCALE PAR OPENCV.JS & TESSERACT.JS
 * 
 * Pipeline de vision par ordinateur classique (offline, 0 API, 0 IA Cloud) :
 * 1. Niveaux de gris (cv.cvtColor)
 * 2. Réduction de bruit gaussienne (cv.GaussianBlur)
 * 3. Binarisation adaptative (cv.adaptiveThreshold)
 * 4. Squelettisation morphologique (Amincissement Zhang-Suen 1px)
 * 5. Détection de segments par transformée de Hough probabiliste (cv.HoughLinesP)
 * 6. Détection de symboles ronds (cv.HoughCircles)
 * 7. Fusion en graphe topologique (nœuds, arêtes, connexions)
 * 8. Snapping isométrique strict (snapToIsometricAngle)
 * 9. OCR local des cotes (Tesseract.js avec whitelist restreinte)
 * 10. Critère de confiance strict : retourne NULL si la confiance est insuffisante (AUCUN réseau inventé)
 */

import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  SketchVectorEquipment,
  snapToIsometricAngle,
  SketchPoint2D,
  ISO_STANDARD_ANGLES
} from "./sketchRasterEngine";
import type { LocalDetectionResult } from "./localSketchDetector";

export interface AxisMappingConfig {
  X: number[];
  Y: number[];
  Z: number[];
}

export const DEFAULT_AXIS_MAPPING: AxisMappingConfig = {
  X: [330, 150],
  Y: [210, 30],
  Z: [90, 270],
};

/**
 * Détermine l'axe 3D isométrique (X, Y ou Z) à partir de l'angle isométrique en degrés :
 * - 330° ou 150° (ou 30°/210°) -> axe X (aligné sur éditeur ISO Sud-Est / Nord-Ouest)
 * - 210° ou 30° (ou 150°/330°) -> axe Y (aligné sur éditeur ISO Sud-Ouest / Nord-Est)
 * - 90° ou 270°               -> axe Z (vertical par défaut)
 * Supporte une configuration de mapping d'axes personnalisée (trièdre interactif).
 */
export function isoAngleToAxis(
  angleDeg: number,
  mapping: AxisMappingConfig = DEFAULT_AXIS_MAPPING
): { axis: "X" | "Y" | "Z"; diff: number } {
  let a = ((angleDeg % 360) + 360) % 360;
  const families: { axis: "X" | "Y" | "Z"; angles: number[] }[] = [
    { axis: "X", angles: mapping.X || [330, 150] },
    { axis: "Y", angles: mapping.Y || [210, 30] },
    { axis: "Z", angles: mapping.Z || [90, 270] },
  ];
  let best: "X" | "Y" | "Z" = "X";
  let bestDiff = 999;
  for (const fam of families) {
    for (const target of fam.angles) {
      let diff = Math.abs(a - target);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        best = fam.axis;
      }
    }
  }
  return { axis: best, diff: bestDiff };
}

// Cache singleton pour l'instance WebAssembly d'OpenCV
let openCvInstance: any = null;
let openCvLoadingPromise: Promise<any> | null = null;

/**
 * Chargeur asynchrone (Lazy loading) d'OpenCV.js
 */
export async function getOpenCv(): Promise<any> {
  if (openCvInstance && openCvInstance.Mat) {
    return openCvInstance;
  }

  if (openCvLoadingPromise) {
    return openCvLoadingPromise;
  }

  openCvLoadingPromise = (async () => {
    try {
      const cvModule = await import("@techstark/opencv-js");
      const readyCv = await (cvModule.default || cvModule);
      openCvInstance = readyCv;
      return readyCv;
    } catch (err) {
      console.error("[OpenCV Loader] Impossible d'initialiser OpenCV.js :", err);
      openCvLoadingPromise = null;
      throw err;
    }
  })();

  return openCvLoadingPromise;
}

/**
 * Ancien filtre de densité de hachures (SKETCH-DETECT-02)
 * Remplacé dans SKETCH-DETECT-03 par le filtrage par taille de composante connexe
 * (connectedComponentsWithStats avec MIN_BBOX_DIM = 40px)
 */
/*
function filterHatchingDensity(
  binary: Uint8Array,
  width: number,
  height: number,
  windowSize = 20,
  maxRatio = 0.60
): Uint8Array {
  const filtered = new Uint8Array(binary);
  const winPixels = windowSize * windowSize;
  const maxActive = winPixels * maxRatio;
  const step = Math.max(10, Math.floor(windowSize / 2));

  for (let y = 0; y <= height - windowSize; y += step) {
    for (let x = 0; x <= width - windowSize; x += step) {
      let activeCount = 0;
      for (let wy = 0; wy < windowSize; wy++) {
        const rowOffset = (y + wy) * width + x;
        for (let wx = 0; wx < windowSize; wx++) {
          if (binary[rowOffset + wx] === 255) {
            activeCount++;
          }
        }
      }

      if (activeCount > maxActive) {
        // Effacer la fenêtre trop dense (hachure / bloc de cartouche)
        for (let wy = 0; wy < windowSize; wy++) {
          const rowOffset = (y + wy) * width + x;
          for (let wx = 0; wx < windowSize; wx++) {
            filtered[rowOffset + wx] = 0;
          }
        }
      }
    }
  }

  return filtered;
}
*/

function zhangSuenThinning(
  binary: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const skeleton = new Uint8Array(binary);
  let changing = true;
  const toRemove: number[] = [];

  const getPixel = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return skeleton[y * width + x] === 255 ? 1 : 0;
  };

  while (changing) {
    changing = false;

    // Étape 1
    toRemove.length = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (skeleton[idx] !== 255) continue;

        const p2 = getPixel(x, y - 1);
        const p3 = getPixel(x + 1, y - 1);
        const p4 = getPixel(x + 1, y);
        const p5 = getPixel(x + 1, y + 1);
        const p6 = getPixel(x, y + 1);
        const p7 = getPixel(x - 1, y + 1);
        const p8 = getPixel(x - 1, y);
        const p9 = getPixel(x - 1, y - 1);

        const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (neighbors < 2 || neighbors > 6) continue;

        // Nombre de transitions 0 -> 1
        const transitions =
          (p2 === 0 && p3 === 1 ? 1 : 0) +
          (p3 === 0 && p4 === 1 ? 1 : 0) +
          (p4 === 0 && p5 === 1 ? 1 : 0) +
          (p5 === 0 && p6 === 1 ? 1 : 0) +
          (p6 === 0 && p7 === 1 ? 1 : 0) +
          (p7 === 0 && p8 === 1 ? 1 : 0) +
          (p8 === 0 && p9 === 1 ? 1 : 0) +
          (p9 === 0 && p2 === 1 ? 1 : 0);

        if (transitions !== 1) continue;

        if (p2 * p4 * p6 !== 0) continue;
        if (p4 * p6 * p8 !== 0) continue;

        toRemove.push(idx);
      }
    }

    if (toRemove.length > 0) {
      changing = true;
      for (const idx of toRemove) {
        skeleton[idx] = 0;
      }
    }

    // Étape 2
    toRemove.length = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (skeleton[idx] !== 255) continue;

        const p2 = getPixel(x, y - 1);
        const p3 = getPixel(x + 1, y - 1);
        const p4 = getPixel(x + 1, y);
        const p5 = getPixel(x + 1, y + 1);
        const p6 = getPixel(x, y + 1);
        const p7 = getPixel(x - 1, y + 1);
        const p8 = getPixel(x - 1, y);
        const p9 = getPixel(x - 1, y - 1);

        const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (neighbors < 2 || neighbors > 6) continue;

        const transitions =
          (p2 === 0 && p3 === 1 ? 1 : 0) +
          (p3 === 0 && p4 === 1 ? 1 : 0) +
          (p4 === 0 && p5 === 1 ? 1 : 0) +
          (p5 === 0 && p6 === 1 ? 1 : 0) +
          (p6 === 0 && p7 === 1 ? 1 : 0) +
          (p7 === 0 && p8 === 1 ? 1 : 0) +
          (p8 === 0 && p9 === 1 ? 1 : 0) +
          (p9 === 0 && p2 === 1 ? 1 : 0);

        if (transitions !== 1) continue;

        if (p2 * p4 * p8 !== 0) continue;
        if (p2 * p6 * p8 !== 0) continue;

        toRemove.push(idx);
      }
    }

    if (toRemove.length > 0) {
      changing = true;
      for (const idx of toRemove) {
        skeleton[idx] = 0;
      }
    }
  }

  return skeleton;
}

/**
 * OCR localisé via Tesseract.js pour extraire les cotes métriques (mm) et DN
 */
async function extractDimensionsWithOcr(
  canvas: HTMLCanvasElement
): Promise<Array<{ text: string; valueMm: number }>> {
  const ocrResults: Array<{ text: string; valueMm: number }> = [];

  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789DNdnMm.- ",
    });

    const ret = await worker.recognize(canvas);
    await worker.terminate();

    const text = ret.data.text;
    const matches = text.match(/\b\d{2,5}\b/g) || [];

    const seenValues = new Set<number>();
    for (const m of matches) {
      const val = parseInt(m, 10);
      if (val >= 25 && val <= 25000 && !seenValues.has(val)) {
        seenValues.add(val);
        ocrResults.push({
          text: `${val} mm`,
          valueMm: val,
        });
      }
    }
  } catch (err) {
    console.warn("[Tesseract OCR] Analyse OCR ignorée ou non disponible :", err);
  }

  return ocrResults;
}

/**
 * Fusionne de manière itérative les segments colinéaires consécutifs du même axe isométrique (X, Y ou Z)
 * connectés par un nœud intermédiaire à exactement 2 segments touchants.
 * Élimine les faux nœuds intermédiaires parasites ("faux points de soudure") issus de HoughLinesP (SKETCH-DETECT-04).
 */
export function mergeCollinearSegments(
  nodes: SketchVectorNode[],
  segs: SketchVectorSegment[],
  calibrationScale?: number
): { nodes: SketchVectorNode[]; segs: SketchVectorSegment[] } {
  let merged = true;
  let workingNodes = [...nodes];
  let workingSegs = [...segs];

  while (merged) {
    merged = false;

    for (const node of workingNodes) {
      const touching = workingSegs.filter(
        (s) => s.fromNodeId === node.id || s.toNodeId === node.id
      );

      if (touching.length !== 2) continue;

      // PRÉSERVATION : Ne jamais fusionner un nœud portant un équipement ou un repère explicite
      if (
        node.equipmentType ||
        (node.label && !node.label.startsWith("N-"))
      ) {
        continue;
      }

      const [segA, segB] = touching;
      if (!segA.detectedAxis || segA.detectedAxis !== segB.detectedAxis) continue;

      // Les deux segments sont du même axe et se rejoignent à ce
      // nœud avec exactement 2 segments touchants : ce n'est pas un
      // point d'intérêt réel, fusionner en un seul tronçon.
      const otherAId = segA.fromNodeId === node.id ? segA.toNodeId : segA.fromNodeId;
      const otherBId = segB.fromNodeId === node.id ? segB.toNodeId : segB.fromNodeId;

      // Éviter de fusionner si cela créerait une boucle sur lui-même
      if (otherAId === otherBId) continue;

      const nA = workingNodes.find((n) => n.id === otherAId);
      const nB = workingNodes.find((n) => n.id === otherBId);
      if (!nA || !nB) continue;

      const v1x = node.x - nA.x, v1y = node.y - nA.y;
      const v2x = nB.x - node.x, v2y = nB.y - node.y;
      if (v1x * v2x + v1y * v2y <= 0) continue;

      const mergedSnap = snapToIsometricAngle({ x: nA.x, y: nA.y }, { x: nB.x, y: nB.y }, 25);
      const mergedSeg: SketchVectorSegment = {
        ...segA,
        id: segA.id,
        fromNodeId: otherAId,
        toNodeId: otherBId,
        angleIsoDeg: mergedSnap.angleDeg,
        detectedAxis: isoAngleToAxis(mergedSnap.angleDeg).axis,
        lengthMm: Math.round(Math.hypot(nB.x - nA.x, nB.y - nA.y) / (calibrationScale || 0.25)),
      };

      workingSegs = workingSegs
        .filter((s) => s.id !== segA.id && s.id !== segB.id)
        .concat(mergedSeg);
      workingNodes = workingNodes.filter((n) => n.id !== node.id);

      merged = true;
      break; // recommencer la boucle for sur la liste mise à jour
    }
  }

  return { nodes: workingNodes, segs: workingSegs };
}

/**
 * Pontage des composantes connexes disjointes proches et alignées (SKETCH-DETECT-08).
 * Détecte les extrémités libres (degré 1) séparées par un faible intervalle dans le
 * prolongement approximatif de leur direction, et insère un segment pont.
 */
export function bridgeNearbyEndpoints(
  nodes: SketchVectorNode[],
  segs: SketchVectorSegment[],
  maxGapPx: number = 90,
  maxAngleDeviationDeg: number = 15,
  calibrationScale?: number
): { nodes: SketchVectorNode[]; segs: SketchVectorSegment[] } {
  // 1. Calculer le degré de chaque nœud.
  const nodeDegrees = new Map<string, number>();
  for (const node of nodes) {
    nodeDegrees.set(node.id, 0);
  }
  for (const seg of segs) {
    nodeDegrees.set(seg.fromNodeId, (nodeDegrees.get(seg.fromNodeId) || 0) + 1);
    nodeDegrees.set(seg.toNodeId, (nodeDegrees.get(seg.toNodeId) || 0) + 1);
  }

  // 2. Pour chaque nœud de degré 1, déterminer la direction de son unique segment (voisin -> extrémité).
  interface EndpointInfo {
    node: SketchVectorNode;
    neighbor: SketchVectorNode;
    seg: SketchVectorSegment;
    dirAngleRad: number;
  }
  const endpoints: EndpointInfo[] = [];

  for (const node of nodes) {
    if (nodeDegrees.get(node.id) === 1) {
      const touchingSeg = segs.find(
        (s) => s.fromNodeId === node.id || s.toNodeId === node.id
      );
      if (!touchingSeg) continue;

      const neighborId =
        touchingSeg.fromNodeId === node.id
          ? touchingSeg.toNodeId
          : touchingSeg.fromNodeId;
      const neighborNode = nodes.find((n) => n.id === neighborId);
      if (!neighborNode) continue;

      const vx = node.x - neighborNode.x;
      const vy = node.y - neighborNode.y;
      const dirAngleRad = Math.atan2(vy, vx);

      endpoints.push({
        node,
        neighbor: neighborNode,
        seg: touchingSeg,
        dirAngleRad,
      });
    }
  }

  // Union-Find pour suivre les composantes connexes
  const parent = new Map<string, string>();
  for (const node of nodes) {
    parent.set(node.id, node.id);
  }
  const findRoot = (id: string): string => {
    const p = parent.get(id);
    if (!p || p === id) return id;
    const root = findRoot(p);
    parent.set(id, root);
    return root;
  };
  const unionSets = (id1: string, id2: string): boolean => {
    const r1 = findRoot(id1);
    const r2 = findRoot(id2);
    if (r1 !== r2) {
      parent.set(r1, r2);
      return true;
    }
    return false;
  };

  // Initialiser les composantes avec les segments actuels
  for (const seg of segs) {
    unionSets(seg.fromNodeId, seg.toNodeId);
  }

  // 3. Chercher les nœuds candidats à une distance <= maxGapPx et dans le prolongement approximatif
  interface CandidateBridge {
    ep: EndpointInfo;
    candNode: SketchVectorNode;
    dist: number;
    snapAngleDeg: number;
  }
  const candidateBridges: CandidateBridge[] = [];

  for (const ep of endpoints) {
    for (const candNode of nodes) {
      if (candNode.id === ep.node.id || candNode.id === ep.neighbor.id) continue;

      const dx = candNode.x - ep.node.x;
      const dy = candNode.y - ep.node.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0 && dist <= maxGapPx) {
        const candAngleRad = Math.atan2(dy, dx);
        let diffDeg = Math.abs(((candAngleRad - ep.dirAngleRad) * 180) / Math.PI);
        while (diffDeg > 180) diffDeg = Math.abs(diffDeg - 360);

        if (diffDeg <= maxAngleDeviationDeg) {
          const snap = snapToIsometricAngle(
            { x: ep.node.x, y: ep.node.y },
            { x: candNode.x, y: candNode.y },
            25
          );
          candidateBridges.push({
            ep,
            candNode,
            dist,
            snapAngleDeg: snap.angleDeg,
          });
        }
      }
    }
  }

  // 4. Trier les candidats par distance croissante.
  candidateBridges.sort((a, b) => a.dist - b.dist);

  // 5. Pour chaque candidat, si les deux nœuds n'appartiennent pas déjà à la même composante connexe, créer un segment "pont"
  const workingSegs = [...segs];
  let bridgeIdx = 1;

  for (const cb of candidateBridges) {
    if (findRoot(cb.ep.node.id) !== findRoot(cb.candNode.id)) {
      unionSets(cb.ep.node.id, cb.candNode.id);

      const lengthMm = Math.round(cb.dist / (calibrationScale || 0.25));
      const bridgeSeg: SketchVectorSegment = {
        id: `bridge_${cb.ep.node.id}_${cb.candNode.id}_${bridgeIdx++}`,
        fromNodeId: cb.ep.node.id,
        toNodeId: cb.candNode.id,
        angleIsoDeg: cb.snapAngleDeg,
        detectedAxis: isoAngleToAxis(cb.snapAngleDeg).axis,
        lengthMm: lengthMm > 0 ? lengthMm : 100,
        nominalDiameter: cb.ep.seg.nominalDiameter || 100,
        pressureClass: cb.ep.seg.pressureClass || "Class 150",
        material: cb.ep.seg.material || "Acier au carbone",
      };

      workingSegs.push(bridgeSeg);
    }
  }

  // 6. Ré-appeler mergeCollinearSegments sur le résultat pour fusionner les ponts avec leurs voisins de même axe si pertinent.
  // 7. Retourner { nodes, segs }.
  return mergeCollinearSegments(nodes, workingSegs, calibrationScale);
}

/**
 * Détection de topologie par OpenCV.js (WebAssembly, 100% local)
 * Retourne LocalDetectionResult si la confiance est satisfaisante, ou null si échec/faible confiance.
 */
export async function detectSketchTopologyOpenCv(
  imageDataUrl: string,
  canvasWidth = 1188,
  canvasHeight = 840
): Promise<LocalDetectionResult | null> {
  if (typeof window === "undefined" || typeof Image === "undefined" || !imageDataUrl) {
    return null;
  }

  const cv = await getOpenCv();

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      // Préparation du canvas d'échantillonnage
      const sampleW = Math.min(canvasWidth, 1200);
      const sampleH = Math.min(canvasHeight, 850);

      const offscreen = document.createElement("canvas");
      offscreen.width = sampleW;
      offscreen.height = sampleH;
      const ctx = offscreen.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, sampleW, sampleH);
      const imgData = ctx.getImageData(0, 0, sampleW, sampleH);

      let srcMat: any = null;
      let rgbMat: any = null;
      let hsvMat: any = null;
      let lowBlack: any = null;
      let highBlack: any = null;
      let blackMask: any = null;
      let dilateKernel: any = null;
      let dilated: any = null;
      let labels: any = null;
      let stats: any = null;
      let centroids: any = null;
      let cleanedMat: any = null;
      let grayMat: any = null;
      let blurMat: any = null;
      let linesMat: any = null;
      let circlesMat: any = null;
      let skeletonMat: any = null;

      try {
        // Matrice source RGBA
        srcMat = cv.matFromImageData(imgData);

        // =========================================================================
        // PIPELINE SKETCH-DETECT-03 : ISOLATION TUYAUTERIE PAR COULEUR + MORPHOLOGIE
        // =========================================================================
        // 1. Conversion en HSV (au lieu de niveaux de gris directs)
        rgbMat = new cv.Mat();
        cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);
        hsvMat = new cv.Mat();
        cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);

        // 2. Masque isolant les traits noirs/gris foncés de la tuyauterie, en excluant les teintes colorées (cotes bleues, annotations rouges)
        lowBlack = new cv.Mat(sampleH, sampleW, hsvMat.type(), [0, 0, 0, 0]);
        highBlack = new cv.Mat(sampleH, sampleW, hsvMat.type(), [180, 90, 110, 255]);
        blackMask = new cv.Mat();
        cv.inRange(hsvMat, lowBlack, highBlack, blackMask);

        // 3. Dilatation pour reconnecter les traits fragmentés par la compression JPEG
        dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(4, 4));
        dilated = new cv.Mat();
        cv.dilate(blackMask, dilated, dilateKernel, new cv.Point(-1, -1), 1);

        // 4. Filtrage par taille de composante connexe (distingue la tuyauterie continue du texte/bruit)
        labels = new cv.Mat();
        stats = new cv.Mat();
        centroids = new cv.Mat();
        const numLabels = cv.connectedComponentsWithStats(dilated, labels, stats, centroids, 8, cv.CV_32S);
        const MIN_BBOX_DIM = 40; // px — calibré et validé visuellement
        cleanedMat = new cv.Mat.zeros(sampleH, sampleW, cv.CV_8UC1);
        for (let i = 1; i < numLabels; i++) {
          const w = stats.intAt(i, cv.CC_STAT_WIDTH);
          const h = stats.intAt(i, cv.CC_STAT_HEIGHT);
          if (w >= MIN_BBOX_DIM || h >= MIN_BBOX_DIM) {
            for (let y = 0; y < sampleH; y++) {
              for (let x = 0; x < sampleW; x++) {
                if (labels.intAt(y, x) === i) cleanedMat.ucharPtr(y, x)[0] = 255;
              }
            }
          }
        }

        // 5. Squelettisation morphologique par amincissement de Zhang-Suen sur cleanedMat
        skeletonMat = new cv.Mat(sampleH, sampleW, cv.CV_8UC1);
        const binaryBuffer = cleanedMat.data;
        const skeletonBuffer = zhangSuenThinning(binaryBuffer, sampleW, sampleH);
        skeletonMat.data.set(skeletonBuffer);

        // 6. Détection de segments par transformée de Hough probabiliste (HoughLinesP)
        linesMat = new cv.Mat();
        cv.HoughLinesP(skeletonMat, linesMat, 1, Math.PI / 180, 20, 32, 12);

        // Détection des symboles ronds (vannes, brides, piquages)
        grayMat = new cv.Mat();
        blurMat = new cv.Mat();
        circlesMat = new cv.Mat();
        cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(grayMat, blurMat, new cv.Size(3, 3), 0);
        try {
          cv.HoughCircles(
            blurMat,
            circlesMat,
            cv.HOUGH_GRADIENT,
            1.2,
            25,
            50,
            28,
            6,
            45
          );
        } catch (circleErr) {
          console.warn("[OpenCV Circles] HoughCircles pass skipped:", circleErr);
        }

        // Extraction et filtrage des lignes brutes
        interface RawLine {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          length: number;
          angleDeg: number;
          isIsoAligned: boolean;
        }

        const rawLines: RawLine[] = [];
        // CORRECTIF BUG BINDING @techstark/opencv-js 5.0.0-release.1 :
        // linesMat.rows ne reflète pas le nombre réel de segments après
        // HoughLinesP (reste bloqué à 1). data32S.length / 4 donne le compte
        // réel (4 valeurs x1,y1,x2,y2 par segment). Confirmé par test direct.
        const numLines = linesMat.data32S ? linesMat.data32S.length / 4 : linesMat.rows;

        for (let i = 0; i < numLines; i++) {
          const x1 = linesMat.data32S[i * 4];
          const y1 = linesMat.data32S[i * 4 + 1];
          const x2 = linesMat.data32S[i * 4 + 2];
          const y2 = linesMat.data32S[i * 4 + 3];

          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);

          if (len < 15) continue; // Ignorer le micro-bruit

          const snap = snapToIsometricAngle({ x: x1, y: y1 }, { x: x2, y: y2 }, 22);

          rawLines.push({
            x1,
            y1,
            x2,
            y2,
            length: len,
            angleDeg: snap.angleDeg,
            isIsoAligned: snap.isSnapped,
          });
        }

        // =========================================================================
        // PARTIE C — CRITÈRES DE CONFIANCE STRICTS (PONDÉRATION PAR LONGUEUR)
        // =========================================================================
        // Seuil 1: Au moins 2 segments détectés
        // Seuil 2: Au moins 35% de la longueur cumulée alignée sur un angle isométrique
        // Si ces critères ne sont pas remplis, la détection est considérée non fiable -> return null.
        const totalLength = rawLines.reduce((acc, l) => acc + l.length, 0);
        const isoAlignedLength = rawLines
          .filter((l) => l.isIsoAligned)
          .reduce((acc, l) => acc + l.length, 0);
        const isoRatio = totalLength > 0 ? isoAlignedLength / totalLength : 0;

        if (rawLines.length < 2 || (rawLines.length >= 3 && isoRatio < 0.35)) {
          console.warn(
            `[OpenCV Sketch Detector] Confiance insuffisante : ${rawLines.length} segments, ratio isométrique pondéré ${(isoRatio * 100).toFixed(1)}%. Bascule en pointage manuel assisté.`
          );
          resolve(null);
          return;
        }

        // g) Construction du graphe topologique (Nœuds & Tronçons)
        const clusterTolerancePx = 20; // Rayon de regroupement des extrémités
        const detectedNodes: SketchVectorNode[] = [];
        const detectedSegs: SketchVectorSegment[] = [];
        const detectedFittings: SketchVectorFitting[] = [];
        const detectedEquip: SketchVectorEquipment[] = [];

        // Helper pour trouver ou créer un nœud
        const getOrCreateNode = (pt: SketchPoint2D): SketchVectorNode => {
          let closest: SketchVectorNode | null = null;
          let minDist = clusterTolerancePx;

          for (const n of detectedNodes) {
            const d = Math.hypot(n.x - pt.x, n.y - pt.y);
            if (d < minDist) {
              minDist = d;
              closest = n;
            }
          }

          if (closest) {
            return closest;
          }

          const newNode: SketchVectorNode = {
            id: `node_${detectedNodes.length + 1}`,
            x: Math.round(pt.x),
            y: Math.round(pt.y),
            elevation: 0,
            label: `N-${detectedNodes.length + 1}`,
            dn: 80,
          };
          detectedNodes.push(newNode);
          return newNode;
        };

        // Traiter les lignes filtrées pour créer les segments
        const processedPairs = new Set<string>();

        for (const line of rawLines) {
          const n1 = getOrCreateNode({ x: line.x1, y: line.y1 });
          const n2 = getOrCreateNode({ x: line.x2, y: line.y2 });

          if (n1.id === n2.id) continue;

          const pairKey1 = `${n1.id}_${n2.id}`;
          const pairKey2 = `${n2.id}_${n1.id}`;

          if (processedPairs.has(pairKey1) || processedPairs.has(pairKey2)) {
            continue;
          }
          processedPairs.add(pairKey1);
          processedPairs.add(pairKey2);

          const snap = snapToIsometricAngle(n1, n2, 25);
          const { axis } = isoAngleToAxis(snap.angleDeg);
          const segId = `seg_${detectedSegs.length + 1}`;
          const distPx = Math.hypot(n2.x - n1.x, n2.y - n1.y);

          detectedSegs.push({
            id: segId,
            fromNodeId: n1.id,
            toNodeId: n2.id,
            nominalDiameter: 80,
            pressureClass: "Class 300",
            material: "Acier ASTM A106 Gr. B",
            lengthMm: Math.round(distPx / 0.25),
            angleIsoDeg: snap.angleDeg,
            detectedAxis: axis,
          });
        }

        // =========================================================================
        // PARTIE 3 — DÉDUCTION DE L'AXE 3D RÉEL ET PROPAGATION DE L'ÉLÉVATION Z
        // =========================================================================
        const nodeElevations = new Map<string, number>();
        const visitedElev = new Set<string>();

        for (const startNode of detectedNodes) {
          if (visitedElev.has(startNode.id)) continue;
          nodeElevations.set(startNode.id, startNode.elevation || 0);
          visitedElev.add(startNode.id);
          const queue = [startNode.id];

          while (queue.length > 0) {
            const currId = queue.shift()!;
            const currElev = nodeElevations.get(currId)!;

            const connected = detectedSegs.filter(
              (s) => s.fromNodeId === currId || s.toNodeId === currId
            );

            for (const seg of connected) {
              const isForward = seg.fromNodeId === currId;
              const nextId = isForward ? seg.toNodeId : seg.fromNodeId;

              if (!visitedElev.has(nextId)) {
                visitedElev.add(nextId);
                queue.push(nextId);

                let nextElev = currElev;
                if (seg.detectedAxis === "Z") {
                  const fromN = detectedNodes.find((n) => n.id === currId);
                  const nextN = detectedNodes.find((n) => n.id === nextId);
                  const lenMm = seg.lengthMm || 0;
                  // Dans l'image écran, y2 < y1 correspond à une montée vers le haut (donc +Z)
                  if (fromN && nextN) {
                    const isGoingUp = nextN.y < fromN.y;
                    nextElev = isGoingUp ? currElev + lenMm : currElev - lenMm;
                  }
                }
                nodeElevations.set(nextId, nextElev);
              }
            }
          }
        }

        // Mettre à jour l'élévation des nœuds
        for (const node of detectedNodes) {
          if (nodeElevations.has(node.id)) {
            node.elevation = nodeElevations.get(node.id)!;
          }
        }

        // =========================================================================
        // PARTIE 3.5 — FUSION DES SEGMENTS COLINÉAIRES (PATCH SKETCH-DETECT-04)
        // =========================================================================
        const { nodes: colNodes, segs: colSegs } = mergeCollinearSegments(
          detectedNodes,
          detectedSegs
        );

        // =========================================================================
        // PARTIE 3.6 — PONTAGE DES COMPOSANTES DISJOINTES PROCHES ET ALIGNÉES (SKETCH-DETECT-08)
        // =========================================================================
        const { nodes: fusedNodes, segs: fusedSegs } = bridgeNearbyEndpoints(
          colNodes,
          colSegs,
          90,
          15
        );

        // =========================================================================
        // PARTIE 4 — DÉTECTION ET INSERTION DE COUDES (validé hors-ligne)
        // =========================================================================
        for (const node of fusedNodes) {
          const touchingSegs = fusedSegs.filter(
            (s) => s.fromNodeId === node.id || s.toNodeId === node.id
          );

          if (touchingSegs.length === 2) {
            const axes = new Set(touchingSegs.map((s) => s.detectedAxis).filter(Boolean));
            if (axes.size >= 2) {
              // Deux segments d'axes distincts se rencontrent : c'est un coude !
              const seg1 = touchingSegs[0];
              const seg2 = touchingSegs[1];

              const other1 = fusedNodes.find(
                (n) => n.id === (seg1.fromNodeId === node.id ? seg1.toNodeId : seg1.fromNodeId)
              );
              const other2 = fusedNodes.find(
                (n) => n.id === (seg2.fromNodeId === node.id ? seg2.toNodeId : seg2.fromNodeId)
              );

              let is45 = false;
              if (other1 && other2) {
                const v1x = other1.x - node.x;
                const v1y = other1.y - node.y;
                const v2x = other2.x - node.x;
                const v2y = other2.y - node.y;
                const len1 = Math.hypot(v1x, v1y);
                const len2 = Math.hypot(v2x, v2y);
                if (len1 > 0 && len2 > 0) {
                  const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
                  const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
                  if (Math.abs(angleDeg - 135) <= 15 || Math.abs(angleDeg - 45) <= 15) {
                    is45 = true;
                  }
                }
              }

              const elbowType = is45 ? "coude_45" : "coude_90";
              const elbowLabel = `C-${detectedFittings.length + 1}`;

              node.equipmentType = elbowType;
              node.equipmentLabel = elbowLabel;

              detectedFittings.push({
                id: `fit_elbow_${detectedFittings.length + 1}`,
                nodeId: node.id,
                type: elbowType,
                label: elbowLabel,
                nominalDiameter: 80,
              });
            }
          }
        }

        // Vérification post-graphe : si moins de 2 nœuds ou 1 segment, échec explicite
        if (fusedNodes.length < 2 || fusedSegs.length === 0) {
          console.warn("[OpenCV Sketch Detector] Graphe incomplet après clustering. Bascule manuelle.");
          resolve(null);
          return;
        }

        // Traitement des cercles détectés pour les vannes/brides
        if (circlesMat && circlesMat.cols > 0) {
          for (let i = 0; i < Math.min(circlesMat.cols, 8); i++) {
            const cx = circlesMat.data32F[i * 3];
            const cy = circlesMat.data32F[i * 3 + 1];
            const radius = circlesMat.data32F[i * 3 + 2];

            // Trouver le segment ou nœud le plus proche
            let nearestSeg: SketchVectorSegment | null = null;
            let minSegDist = 30;

            for (const seg of fusedSegs) {
              const sn1 = fusedNodes.find((n) => n.id === seg.fromNodeId);
              const sn2 = fusedNodes.find((n) => n.id === seg.toNodeId);
              if (!sn1 || !sn2) continue;

              const midX = (sn1.x + sn2.x) / 2;
              const midY = (sn1.y + sn2.y) / 2;
              const dist = Math.hypot(midX - cx, midY - cy);

              if (dist < minSegDist) {
                minSegDist = dist;
                nearestSeg = seg;
              }
            }

            if (nearestSeg) {
              detectedFittings.push({
                id: `fit_v_${detectedFittings.length + 1}`,
                segmentId: nearestSeg.id,
                type: radius > 22 ? "ballon_horizontal" : "valve",
                label: `V-${100 + detectedFittings.length + 1}`,
                nominalDiameter: 80,
              });
            }
          }
        }

        // h) OCR des cotes millimétriques via Tesseract.js
        const ocrDimensions = await extractDimensionsWithOcr(offscreen);

        // Calcul du facteur de calibrage précis à partir des cotes OCR
        let calculatedScale = 0.25;
        if (ocrDimensions.length > 0) {
          const totalMm = ocrDimensions.reduce((acc, d) => acc + d.valueMm, 0);
          const totalSegPx = fusedSegs.reduce((acc, s) => {
            const n1 = fusedNodes.find((n) => n.id === s.fromNodeId);
            const n2 = fusedNodes.find((n) => n.id === s.toNodeId);
            return acc + (n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : 0);
          }, 0);

          if (totalSegPx > 40 && totalMm > 0) {
            calculatedScale = Number((totalSegPx / totalMm).toFixed(4));
          }
        }

        const result: LocalDetectionResult = {
          detectedTitle: "CROQUIS TOPOLOGIE EXTRAITE (OPENCV.JS)",
          service: "TUYAUTERIE INDUSTRIELLE",
          lineReference: `LIGNE DN80 (${fusedSegs.length} TRONÇONS)`,
          drawingNumber: "SK-LOCAL-01",
          nominalDiameter: 80,
          calibrationScale: calculatedScale,
          summary: `Extraction OpenCV.js réussie : ${fusedNodes.length} nœuds, ${fusedSegs.length} tronçons détectés, ${detectedFittings.length} symbole(s) identifié(s). Échelle calculée : ${calculatedScale} px/mm.`,
          ocrDimensions,
          nodes: fusedNodes,
          segments: fusedSegs,
          fittings: detectedFittings,
          equipment: detectedEquip,
        };

        resolve(result);
      } catch (procErr) {
        console.error("[OpenCV Sketch Detector] Erreur lors du traitement d'image :", procErr);
        resolve(null);
      } finally {
        // Nettoyage impératif de la mémoire WebAssembly OpenCV
        if (srcMat) srcMat.delete();
        if (rgbMat) rgbMat.delete();
        if (hsvMat) hsvMat.delete();
        if (lowBlack) lowBlack.delete();
        if (highBlack) highBlack.delete();
        if (blackMask) blackMask.delete();
        if (dilateKernel) dilateKernel.delete();
        if (dilated) dilated.delete();
        if (labels) labels.delete();
        if (stats) stats.delete();
        if (centroids) centroids.delete();
        if (cleanedMat) cleanedMat.delete();
        if (grayMat) grayMat.delete();
        if (blurMat) blurMat.delete();
        if (linesMat) linesMat.delete();
        if (circlesMat) circlesMat.delete();
        if (skeletonMat) skeletonMat.delete();
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageDataUrl;
  });
}
