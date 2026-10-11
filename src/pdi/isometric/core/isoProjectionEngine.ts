/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * ARCH-13-FIX-02: FREE CAMERA MODEL-CENTER Z CORRECTION.
 */

export const PDI_ISO_ANGLE_017I2 = Math.PI / 6;
export const PDI_ISO_COS_017I2 = Math.cos(PDI_ISO_ANGLE_017I2);
export const PDI_ISO_SIN_017I2 = Math.sin(PDI_ISO_ANGLE_017I2);

export interface ProjectionAxes {
  dx_x: number;
  dy_x: number;
  dx_y: number;
  dy_y: number;
  dx_z: number;
  dy_z: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface WorldPoint3D {
  x: number;
  y: number;
  z: number;
}

export function getProjectionAxes(
  mode: string = "iso",
  yaw: number = -Math.PI / 4,
  pitch: number = Math.PI / 6
): ProjectionAxes {
  if (mode === "iso") {
    return {
      dx_x: PDI_ISO_COS_017I2,
      dy_x: PDI_ISO_SIN_017I2,
      dx_y: -PDI_ISO_COS_017I2,
      dy_y: PDI_ISO_SIN_017I2,
      dx_z: 0,
      dy_z: -1
    };
  }
  if (mode === "top") {
    return {
      dx_x: 1,
      dy_x: 0,
      dx_y: 0,
      dy_y: 1,
      dx_z: 0,
      dy_z: 0
    };
  }
  if (mode === "front") {
    return {
      dx_x: 1,
      dy_x: 0,
      dx_y: 0,
      dy_y: 0,
      dx_z: 0,
      dy_z: -1
    };
  }
  if (mode === "side") {
    return {
      dx_x: 0,
      dy_x: 0,
      dx_y: 1,
      dy_y: 0,
      dx_z: 0,
      dy_z: -1
    };
  }

  // "free" mode: standard orthographic projection from yaw & pitch
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  return {
    dx_x: cosY,
    dy_x: sinY * sinP,
    dx_y: -sinY,
    dy_y: cosY * sinP,
    dx_z: 0,
    dy_z: -cosP
  };
}

export function isoProjectV4(
  x: number,
  y: number,
  z: number = 0,
  zoom: number = 1,
  panX: number = 0,
  panY: number = 0,
  mode?: string,
  yaw?: number,
  pitch?: number,
  modelCenter?: WorldPoint3D,
  globalViewMode: string = "iso",
  globalYaw: number = -Math.PI / 4,
  globalPitch: number = Math.PI / 6,
  globalModelCenter: WorldPoint3D = { x: 0, y: 0, z: 0 }
): ScreenPoint {
  const safeX = typeof x === "number" && !isNaN(x) ? x : 0;
  const safeY = typeof y === "number" && !isNaN(y) ? y : 0;
  const safeZ = typeof z === "number" && !isNaN(z) ? z : 0;
  const scale = 28 * zoom;
  const currentMode = mode ?? globalViewMode;
  const currentYaw = yaw ?? globalYaw;
  const currentPitch = pitch ?? globalPitch;
  const axes = getProjectionAxes(currentMode, currentYaw, currentPitch);

  let rx = safeX;
  let ry = safeY;
  let rz = safeZ;
  const center = modelCenter ?? globalModelCenter;
  if (currentMode === "free") {
    rx = safeX - (center.x || 0);
    ry = safeY - (center.y || 0);
    rz = safeZ - (center.z || 0);
  }

  return {
    x: 310 + panX + (rx * axes.dx_x + ry * axes.dx_y + rz * axes.dx_z) * scale,
    y: 210 + panY + (rx * axes.dy_x + ry * axes.dy_y + rz * axes.dy_z) * scale
  };
}

export function isoUnprojectV4(
  sx: number,
  sy: number,
  zoom: number = 1,
  panX: number = 0,
  panY: number = 0,
  targetZ: number = 0,
  mode?: string,
  globalViewMode: string = "iso",
  yaw?: number,
  pitch?: number,
  globalYaw: number = -Math.PI / 4,
  globalPitch: number = Math.PI / 6,
  modelCenter?: WorldPoint3D,
  globalModelCenter: WorldPoint3D = { x: 0, y: 0, z: 0 }
): WorldPoint3D {
  const scale = Math.max(1, 28 * zoom);
  const currentMode = mode ?? globalViewMode;
  const currentYaw = yaw ?? globalYaw;
  const currentPitch = pitch ?? globalPitch;
  const center = modelCenter ?? globalModelCenter;

  if (currentMode === "top") {
    return {
      x: (sx - 310 - panX) / scale,
      y: (sy - 210 - panY) / scale,
      z: targetZ
    };
  }
  if (currentMode === "front") {
    return {
      x: (sx - 310 - panX) / scale,
      y: 0,
      z: -(sy - 210 - panY) / scale
    };
  }
  if (currentMode === "side") {
    return {
      x: 0,
      y: (sx - 310 - panX) / scale,
      z: -(sy - 210 - panY) / scale
    };
  }

  // ISO or FREE mode
  const axes = getProjectionAxes(currentMode, currentYaw, currentPitch);
  const relZ = currentMode === "free" ? targetZ - (center.z || 0) : targetZ;
  const U = (sx - 310 - panX) / scale - relZ * axes.dx_z;
  const V = (sy - 210 - panY) / scale - relZ * axes.dy_z;

  const det = axes.dx_x * axes.dy_y - axes.dx_y * axes.dy_x;
  let rx = 0;
  let ry = 0;

  if (Math.abs(det) > 1e-4) {
    rx = (U * axes.dy_y - V * axes.dx_y) / det;
    ry = (V * axes.dx_x - U * axes.dy_x) / det;
  } else {
    // Fallback to standard ISO unprojection math
    const u = (sx - 310 - panX) / (PDI_ISO_COS_017I2 * scale);
    const v = (sy + relZ * scale - 210 - panY) / (PDI_ISO_SIN_017I2 * scale);
    rx = (u + v) / 2;
    ry = (v - u) / 2;
  }

  if (currentMode === "free") {
    return {
      x: rx + (center.x || 0),
      y: ry + (center.y || 0),
      z: targetZ
    };
  }

  return { x: rx, y: ry, z: targetZ };
}
