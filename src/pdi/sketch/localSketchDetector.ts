/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * MOTEUR DE DÉTECTION ALGORITHMIQUE LOCAL & OCR CALIBRÉ — 100% AUTONOME (0 API, 0 IA EXTERNE)
 * Analyse matricielle, morphologie mathématique, reconnaissance OCR de cotes et vectorisation isométrique.
 */

import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  SketchVectorEquipment
} from "./sketchRasterEngine";
import { detectSketchTopologyOpenCv } from "./openCvSketchDetector";

export interface LocalDetectionResult {
  detectedTitle: string;
  service: string;
  lineReference: string;
  drawingNumber?: string;
  nominalDiameter?: number;
  calibrationScale?: number;
  summary: string;
  ocrDimensions?: Array<{ text: string; valueMm: number }>;
  nodes: SketchVectorNode[];
  segments: SketchVectorSegment[];
  fittings: SketchVectorFitting[];
  equipment: SketchVectorEquipment[];
  lowConfidence?: boolean;
}

/**
 * Analyse 100% locale, déterministe et autonome d'une image de tuyauterie / croquis via OpenCV.js.
 * Ne fait aucun appel réseau, aucune requête API, aucun modèle externe.
 * Retourne null si la détection est incertaine (AUCUN réseau inventé).
 */
export async function detectSketchTopologyLocal(
  imageDataUrl: string,
  canvasWidth = 1188,
  canvasHeight = 840
): Promise<LocalDetectionResult | null> {
  try {
    const openCvResult = await detectSketchTopologyOpenCv(
      imageDataUrl,
      canvasWidth,
      canvasHeight
    );
    if (openCvResult && openCvResult.nodes.length >= 2 && openCvResult.segments.length >= 1) {
      return openCvResult;
    }
  } catch (err) {
    console.warn("[Local Sketch Detector] OpenCV detection notice :", err);
  }

  // Si OpenCV n'a pas pu extraire un graphe avec une confiance suffisante :
  // On ne génère JAMAIS de réseau inventé silencieux.
  return null;
}
