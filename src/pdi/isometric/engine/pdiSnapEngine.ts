/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * CAD ISOMETRIC GRID & HIGH-PRECISION MAGNETIC ENGINE (P2-A)
 * Conforming to ASME / ANSI / DIN / ISO Standards
 * 100% Deterministic - Zero External API Dependency
 */

import { PdiVec3, pdiRound3, PDI_SNAP_TOL_PX } from "./pdiPrecision017P.ts";

export type PdiIsoOrientation = "NORTH_RIGHT" | "NORTH_LEFT" | "NORTH_UP";

export interface PdiSnapPoint {
  id: string;
  type: "PORT" | "ENDPOINT" | "MIDPOINT" | "BRANCH" | "VALVE_CENTER" | "FLANGE_FACE" | "GRID";
  pos: PdiVec3;
  screenPos: { x: number; y: number };
  nodeId?: string;
  segmentId?: string;
  portIndex?: number;
  label?: string;
  normal?: PdiVec3;
}

export interface PdiSnapResult {
  snapped: boolean;
  type: "PORT" | "ENDPOINT" | "MIDPOINT" | "BRANCH" | "VALVE_CENTER" | "FLANGE_FACE" | "GRID" | "ORTHO_AXIS" | "NONE";
  point: PdiVec3;
  screenPoint: { x: number; y: number };
  distPx: number;
  target?: PdiSnapPoint;
  guideAxis?: "X" | "Y" | "Z";
}

/**
 * Angles ISO Standard (30° isometric projection):
 * cos(30°) = √3 / 2 ≈ 0.8660254037844386
 * sin(30°) = 1 / 2 = 0.5
 */
export const ISO_COS_30 = Math.cos(Math.PI / 6);
export const ISO_SIN_30 = Math.sin(Math.PI / 6);

/**
 * Projette un point 3D réel (en mm métrologique) vers les coordonnées 2D écran (pixels).
 */
export function pdiProject3DToScreen(
  p: PdiVec3,
  scale = 1,
  origin: { x: number; y: number } = { x: 0, y: 0 }
): { x: number; y: number } {
  const sx = (p.x - p.y) * ISO_COS_30 * scale + origin.x;
  const sy = (p.x + p.y) * ISO_SIN_30 * scale - p.z * scale + origin.y;
  return { x: pdiRound3(sx), y: pdiRound3(sy) };
}

/**
 * Rétro-projette un point écran 2D vers un plan isométrique 3D z = constant (ou x/y).
 */
export function pdiUnprojectScreenTo3DPlane(
  screen: { x: number; y: number },
  targetZ = 0,
  scale = 1,
  origin: { x: number; y: number } = { x: 0, y: 0 }
): PdiVec3 {
  const dx = (screen.x - origin.x) / scale;
  const dy = (screen.y - origin.y + targetZ * scale) / scale;

  // (x - y) = dx / cos30
  // (x + y) = dy / sin30
  const u = dx / ISO_COS_30;
  const v = dy / ISO_SIN_30;

  const x = (u + v) / 2;
  const y = (v - u) / 2;

  return { x: pdiRound3(x), y: pdiRound3(y), z: pdiRound3(targetZ) };
}

/**
 * Calcul du point magnétique optimal (Snap) selon les tolérances ISO.
 */
export function pdiFindBestSnap(
  cursorScreen: { x: number; y: number },
  candidates: PdiSnapPoint[],
  opts: {
    zoom?: number;
    customTolerancePx?: number;
    activePlaneZ?: number;
    gridStepMm?: number;
    origin?: { x: number; y: number };
    orthoLock?: boolean;
    orthoAnchor?: PdiVec3;
  } = {}
): PdiSnapResult {
  const tol = opts.customTolerancePx || PDI_SNAP_TOL_PX.ENDPOINT;
  let bestCandidate: PdiSnapPoint | null = null;
  let minDistance = Infinity;

  // 1. Recherche parmi les points d'accrochage réels (ports, extrémités, vannes)
  for (const c of candidates) {
    const dist = Math.hypot(c.screenPos.x - cursorScreen.x, c.screenPos.y - cursorScreen.y);
    if (dist <= tol && dist < minDistance) {
      minDistance = dist;
      bestCandidate = c;
    }
  }

  if (bestCandidate) {
    return {
      snapped: true,
      type: bestCandidate.type,
      point: bestCandidate.pos,
      screenPoint: bestCandidate.screenPos,
      distPx: pdiRound3(minDistance),
      target: bestCandidate,
    };
  }

  // 2. Si verrouillage orthogonal actif (Shift / Ortho mode)
  if (opts.orthoLock && opts.orthoAnchor) {
    const anchor = opts.orthoAnchor;
    const anchorScreen = pdiProject3DToScreen(anchor, opts.zoom || 1, opts.origin);
    const deltaScreenX = cursorScreen.x - anchorScreen.x;
    const deltaScreenY = cursorScreen.y - anchorScreen.y;

    // Déterminer l'axe ISO le plus proche (X, Y ou Z)
    const rawPos = pdiUnprojectScreenTo3DPlane(cursorScreen, opts.activePlaneZ || 0, opts.zoom || 1, opts.origin);
    const dx = Math.abs(rawPos.x - anchor.x);
    const dy = Math.abs(rawPos.y - anchor.y);
    const dz = Math.abs(deltaScreenY); // Z est purement vertical à l'écran

    let guideAxis: "X" | "Y" | "Z" = "X";
    let orthoPos: PdiVec3 = { ...anchor };

    if (Math.abs(deltaScreenX) < 15 && Math.abs(deltaScreenY) > 20) {
      guideAxis = "Z";
      const zDiff = -deltaScreenY / (opts.zoom || 1);
      orthoPos = { x: anchor.x, y: anchor.y, z: pdiRound3(anchor.z + zDiff) };
    } else if (dx >= dy) {
      guideAxis = "X";
      orthoPos = { x: rawPos.x, y: anchor.y, z: anchor.z };
    } else {
      guideAxis = "Y";
      orthoPos = { x: anchor.x, y: rawPos.y, z: anchor.z };
    }

    const scr = pdiProject3DToScreen(orthoPos, opts.zoom || 1, opts.origin);
    return {
      snapped: true,
      type: "ORTHO_AXIS",
      point: orthoPos,
      screenPoint: scr,
      distPx: 0,
      guideAxis,
    };
  }

  // 3. Accrochage sur la grille millimétrique (Grid Snap)
  const gridStep = opts.gridStepMm || 50; // Pas de grille par défaut 50mm
  const planeZ = opts.activePlaneZ || 0;
  const raw3D = pdiUnprojectScreenTo3DPlane(cursorScreen, planeZ, opts.zoom || 1, opts.origin);

  const gridX = Math.round(raw3D.x / gridStep) * gridStep;
  const gridY = Math.round(raw3D.y / gridStep) * gridStep;
  const gridPoint: PdiVec3 = { x: pdiRound3(gridX), y: pdiRound3(gridY), z: planeZ };
  const gridScreen = pdiProject3DToScreen(gridPoint, opts.zoom || 1, opts.origin);

  const gridDist = Math.hypot(gridScreen.x - cursorScreen.x, gridScreen.y - cursorScreen.y);
  if (gridDist <= PDI_SNAP_TOL_PX.GRID) {
    return {
      snapped: true,
      type: "GRID",
      point: gridPoint,
      screenPoint: gridScreen,
      distPx: pdiRound3(gridDist),
    };
  }

  return {
    snapped: false,
    type: "NONE",
    point: raw3D,
    screenPoint: cursorScreen,
    distPx: 0,
  };
}
