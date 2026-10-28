/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO ENGINE — STEP 2: MATHEMATICAL RASTER & ISOMETRIC PROJECTION HELPERS
 */

export interface SketchPoint2D {
  x: number;
  y: number;
}

export interface SketchVectorNode {
  id: string;
  x: number;
  y: number;
  elevation: number; // Z coord in mm
  label?: string;
  equipmentType?: string;
  equipmentLabel?: string;
  dn?: number;
  isLocked?: boolean;
}

export interface SketchVectorSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  nominalDiameter: number; // DN (ex: 150)
  pressureClass: string; // PN / Class (ex: "Class 300")
  material: string;
  lengthMm?: number;
  isManualLength?: boolean; // true if length was explicitly set/overridden by the user
  angleIsoDeg?: number; // 30, 90, 150, 210, 270, 330
  detectedAxis?: "X" | "Y" | "Z";
}

export type SketchFittingType =
  | "valve"
  | "check_valve"
  | "flange"
  | "elbow_90"
  | "elbow_45"
  | "tee"
  | "reducer"
  | "instrument"
  | "support"
  | "ballon_horizontal"
  | "ballon_vertical"
  | "pompe"
  | "echangeur"
  | string;

export interface SketchVectorFitting {
  id: string;
  nodeId?: string;
  segmentId?: string;
  type: SketchFittingType;
  label?: string;
  nominalDiameter?: number;
}

export interface SketchVectorEquipment {
  id: string;
  type: "ballon_horizontal" | "ballon_vertical" | "pompe" | "echangeur" | string;
  tag: string;
  label: string;
  nodeId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type PaperFormat = "A4_landscape" | "A4_portrait" | "A3_landscape" | "A3_portrait";

export interface PaperDimensionsMm {
  width: number;
  height: number;
  label: string;
}

export const PAPER_FORMATS: Record<PaperFormat, PaperDimensionsMm> = {
  A4_landscape: { width: 297, height: 210, label: "A4 Paysage (297 × 210 mm)" },
  A4_portrait: { width: 210, height: 297, label: "A4 Portrait (210 × 297 mm)" },
  A3_landscape: { width: 420, height: 297, label: "A3 Paysage (420 × 297 mm)" },
  A3_portrait: { width: 297, height: 420, label: "A3 Portrait (297 × 420 mm)" }
};

/**
 * Standard isometric angles in degrees (aligned with isoProjectV4 & DEFAULT_AXIS_MAPPING):
 * 330° (+X / South-East, dx > 0, dy > 0 on screen)
 * 150° (-X / North-West, dx < 0, dy < 0 on screen)
 * 210° (+Y / South-West, dx < 0, dy > 0 on screen)
 * 30°  (-Y / North-East, dx > 0, dy < 0 on screen)
 * 90°  (+Z / Up,         dx = 0, dy < 0 on screen)
 * 270° (-Z / Down,       dx = 0, dy > 0 on screen)
 */
export const ISO_STANDARD_ANGLES = [30, 90, 150, 210, 270, 330];

/**
 * Snap an arbitrary 2D vector (dx, dy) to the nearest standard isometric angle if within tolerance
 */
export function snapToIsometricAngle(
  p1: SketchPoint2D,
  p2: SketchPoint2D,
  toleranceDeg = 12
): { snappedPoint: SketchPoint2D; angleDeg: number; isSnapped: boolean } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y; // note: screen Y is inverted
  const distance = Math.hypot(dx, dy);

  if (distance < 2) {
    return { snappedPoint: p2, angleDeg: 0, isSnapped: false };
  }

  // Math.atan2 with inverted screen Y (cartesian angle from 0 to 360)
  let angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;

  let minDiff = 360;
  let closestIsoAngle = angle;

  for (const isoAngle of ISO_STANDARD_ANGLES) {
    let diff = Math.abs(angle - isoAngle);
    if (diff > 180) diff = 360 - diff;

    if (diff < minDiff) {
      minDiff = diff;
      closestIsoAngle = isoAngle;
    }
  }

  if (minDiff <= toleranceDeg) {
    const rad = (closestIsoAngle * Math.PI) / 180;
    const snappedDx = distance * Math.cos(rad);
    const snappedDy = -distance * Math.sin(rad);

    return {
      snappedPoint: { x: p1.x + snappedDx, y: p1.y + snappedDy },
      angleDeg: closestIsoAngle,
      isSnapped: true
    };
  }

  return { snappedPoint: p2, angleDeg: Math.round(angle), isSnapped: false };
}

/**
 * Image processing: Binarization / Contrast enhancement on HTML5 Canvas
 */
export function applyImageFilters(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  options: {
    contrastThreshold: number; // 0..255 (0 = pas de filtre, >0 = binarisation seuillée)
    brightness: number; // -100..100
    invert: boolean;
    opacity: number; // 0..1
  }
) {
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;

  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.globalAlpha = options.opacity;
  ctx.drawImage(sourceCanvas, 0, 0);

  if (options.contrastThreshold <= 0 && options.brightness === 0 && !options.invert) {
    return; // Pas de manipulation directe des pixels
  }

  const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  const d = imgData.data;
  const threshold = options.contrastThreshold;
  const brightnessOffset = (options.brightness / 100) * 255;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] + brightnessOffset;
    let g = d[i + 1] + brightnessOffset;
    let b = d[i + 2] + brightnessOffset;

    // Luminance perçue
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    if (threshold > 0) {
      // Binarisation nette du trait d'encre
      gray = gray < threshold ? 0 : 255;
    }

    if (options.invert) {
      gray = 255 - gray;
    }

    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Calculates the real-world length in millimeters for a segment between two points
 * given a valid calibration scale in px/mm.
 * Formula: lengthMm = Math.round(Math.hypot(x2 - x1, y2 - y1) / calibrationScale)
 * Returns undefined if calibrationScale is non-positive or invalid.
 */
export function calculateSegmentLengthMm(
  n1: { x: number; y: number },
  n2: { x: number; y: number },
  calibrationScale: number
): number | undefined {
  if (
    typeof calibrationScale !== "number" ||
    isNaN(calibrationScale) ||
    !isFinite(calibrationScale) ||
    calibrationScale <= 0
  ) {
    return undefined;
  }
  const distPx = Math.hypot(n2.x - n1.x, n2.y - n1.y);
  return Math.round(distPx / calibrationScale);
}

/**
 * Helper to determine whether a segment length is manual (explicitly edited by user)
 * or automatic (derived from coordinates).
 * Defaults to false for legacy objects without isManualLength.
 */
export function isSegmentManualLength(seg: SketchVectorSegment): boolean {
  return seg.isManualLength === true;
}

/**
 * Synchronizes segment lengths after one or more nodes are moved.
 * - Updates automatic segments (isManualLength !== true) connected to moved nodes.
 * - Preserves manual segments (isManualLength === true).
 * - Leaves untouched segments that are not connected to any moved node.
 */
export function syncSegmentsOnNodeMove(
  segments: SketchVectorSegment[],
  nodes: SketchVectorNode[],
  movedNodeIds: string[] | Set<string>,
  calibrationScale: number
): SketchVectorSegment[] {
  const movedSet = movedNodeIds instanceof Set ? movedNodeIds : new Set(movedNodeIds);
  if (movedSet.size === 0) return segments;

  const nodeMap = new Map<string, SketchVectorNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  return segments.map((seg) => {
    // Only update segments connected to at least one moved node
    const isConnected = movedSet.has(seg.fromNodeId) || movedSet.has(seg.toNodeId);
    if (!isConnected) {
      return seg;
    }

    // Preserve manual lengths
    if (seg.isManualLength === true) {
      return seg;
    }

    // Automatic segment: recompute length if nodes and scale are valid
    const n1 = nodeMap.get(seg.fromNodeId);
    const n2 = nodeMap.get(seg.toNodeId);
    if (n1 && n2 && calibrationScale > 0) {
      const newLenMm = calculateSegmentLengthMm(n1, n2, calibrationScale);
      if (newLenMm !== undefined) {
        return {
          ...seg,
          lengthMm: newLenMm,
          isManualLength: false
        };
      }
    }

    return seg;
  });
}

/**
 * Synchronizes segment lengths after calibration scale changes.
 * - Updates all automatic segments (isManualLength !== true).
 * - Preserves manual segments (isManualLength === true).
 */
export function syncSegmentsOnCalibrationChange(
  segments: SketchVectorSegment[],
  nodes: SketchVectorNode[],
  newCalibrationScale: number
): SketchVectorSegment[] {
  if (
    typeof newCalibrationScale !== "number" ||
    isNaN(newCalibrationScale) ||
    !isFinite(newCalibrationScale) ||
    newCalibrationScale <= 0
  ) {
    return segments;
  }

  const nodeMap = new Map<string, SketchVectorNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  return segments.map((seg) => {
    // Preserve manual lengths
    if (seg.isManualLength === true) {
      return seg;
    }

    const n1 = nodeMap.get(seg.fromNodeId);
    const n2 = nodeMap.get(seg.toNodeId);
    if (n1 && n2) {
      const newLenMm = calculateSegmentLengthMm(n1, n2, newCalibrationScale);
      if (newLenMm !== undefined) {
        return {
          ...seg,
          lengthMm: newLenMm,
          isManualLength: false
        };
      }
    }

    return seg;
  });
}

