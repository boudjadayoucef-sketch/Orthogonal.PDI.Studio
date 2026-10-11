/**
 * ISO 30° Deterministic Mathematical Projection
 * Shared standard for PD&I ISO Professional Workspace
 */

export interface WorldPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface ScreenPoint2D {
  x: number;
  y: number;
}

export interface IsoViewport {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Standard Axonometric Isometric 30° projection
 * ISO standard:
 * X (East/Right)  -> +cos(30°), +sin(30°)
 * Y (North/Depth) -> -cos(30°), +sin(30°)
 * Z (Elevation)   -> 0, -1 (Upwards on screen)
 */
export const ISO_COS30 = Math.cos(Math.PI / 6); // ~0.8660254
export const ISO_SIN30 = Math.sin(Math.PI / 6); // 0.5
export const ISO_SCALE = 70; // 70px per meter at zoom 1.0

export function isoProject(
  x: number,
  y: number,
  z: number,
  zoom: number = 1,
  panX: number = 0,
  panY: number = 0
): ScreenPoint2D {
  const sx = (x - y) * ISO_COS30 * ISO_SCALE;
  const sy = ((x + y) * ISO_SIN30 - z) * ISO_SCALE;
  return {
    x: sx * zoom + panX,
    y: sy * zoom + panY,
  };
}

export function isoUnproject(
  screenX: number,
  screenY: number,
  zPlane: number = 0,
  zoom: number = 1,
  panX: number = 0,
  panY: number = 0
): WorldPoint3D {
  const unscaledX = (screenX - panX) / zoom;
  const unscaledY = (screenY - panY) / zoom;

  const sx = unscaledX / ISO_SCALE;
  const sy = unscaledY / ISO_SCALE + zPlane;

  // sx = (x - y) * cos30  => (x - y) = sx / cos30
  // sy = (x + y) * sin30  => (x + y) = sy / sin30
  const u = sx / ISO_COS30;
  const v = sy / ISO_SIN30;

  const x = (u + v) / 2;
  const y = (v - u) / 2;

  return { x, y, z: zPlane };
}

export function snapToIsoAxis(
  start: WorldPoint3D,
  current: WorldPoint3D
): WorldPoint3D {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const dz = current.z - start.z;

  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const adz = Math.abs(dz);

  // Constrain to dominant axis (ortho ISO X, Y or Z)
  if (adz >= adx && adz >= ady) {
    return { x: start.x, y: start.y, z: current.z };
  } else if (adx >= ady) {
    return { x: current.x, y: start.y, z: start.z };
  } else {
    return { x: start.x, y: current.y, z: start.z };
  }
}
