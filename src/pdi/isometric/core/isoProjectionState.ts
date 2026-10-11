/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * ARCH-13: ISOMETRIC PROJECTION STATE MANAGEMENT.
 */

export interface WorldPoint3D {
  x: number;
  y: number;
  z: number;
}

export const isoState = {
  viewMode: "iso",
  yaw: -Math.PI / 4,
  pitch: Math.PI / 6,
  modelCenter: { x: 0, y: 0, z: 0 } as WorldPoint3D
};
