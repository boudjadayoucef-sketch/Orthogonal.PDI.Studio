/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * PALIER 2B (019B) - 2D CAD TRANSACTIONAL MODIFY ENGINE.
 * 
 * Functions for TRIM, EXTEND, OFFSET, FILLET, SCALE, and HATCH.
 * Pure mathematical, deterministic algorithms with no DOM dependency.
 */

import { Cad2dPoint, cadDist, cadRotatePoint } from "../isometric/engine/CadAutocadEngine";
import { Cad2dEntity, IsoNode, IsoSegment } from "../isometric/types/isoGraphTypes";

export interface LineSegment2D {
  p1: Cad2dPoint;
  p2: Cad2dPoint;
}

/**
 * Calcul d'intersection entre deux segments finis [P1, P2] et [P3, P4].
 * Retourne le point d'intersection I et les paramètres t, u in [0, 1] si les segments se croisent.
 */
export function intersectSegments2D(
  p1: Cad2dPoint,
  p2: Cad2dPoint,
  p3: Cad2dPoint,
  p4: Cad2dPoint,
  tol: number = 1e-6
): { point: Cad2dPoint; t: number; u: number } | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < tol) {
    // Parallèles ou colinéaires
    return null;
  }

  const dx31 = p3.x - p1.x;
  const dy31 = p3.y - p1.y;

  const t = (dx31 * dy2 - dy31 * dx2) / det;
  const u = (dx31 * dy1 - dy31 * dx1) / det;

  if (t >= -tol && t <= 1 + tol && u >= -tol && u <= 1 + tol) {
    return {
      point: {
        x: Number((p1.x + t * dx1).toFixed(4)),
        y: Number((p1.y + t * dy1).toFixed(4)),
      },
      t: Math.max(0, Math.min(1, t)),
      u: Math.max(0, Math.min(1, u)),
    };
  }

  return null;
}

/**
 * Intersection entre une droite infinie (P1->P2) et un rayon semi-infini partant de RayOrigin dans la direction RayDir.
 * Utile pour la commande EXTEND (Prolonger).
 */
export function intersectRayWithSegment(
  rayOrigin: Cad2dPoint,
  rayDir: Cad2dPoint, // vecteur unitaire ou orienté
  p3: Cad2dPoint,
  p4: Cad2dPoint,
  tol: number = 1e-6
): { point: Cad2dPoint; dist: number } | null {
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const det = rayDir.x * dy2 - rayDir.y * dx2;
  if (Math.abs(det) < tol) return null;

  const dx31 = p3.x - rayOrigin.x;
  const dy31 = p3.y - rayOrigin.y;

  const tRay = (dx31 * dy2 - dy31 * dx2) / det;
  const uSeg = (dx31 * rayDir.y - dy31 * rayDir.x) / det;

  // tRay > 0 (devant le rayon), uSeg in [0, 1] (sur le segment frontière)
  if (tRay > tol && uSeg >= -tol && uSeg <= 1 + tol) {
    return {
      point: {
        x: Number((rayOrigin.x + tRay * rayDir.x).toFixed(4)),
        y: Number((rayOrigin.y + tRay * rayDir.y).toFixed(4)),
      },
      dist: tRay,
    };
  }

  return null;
}

/**
 * Commande TRIM (Ajuster) sur un segment 2D :
 * Détecte les intersections avec la frontière ou les arêtes sécantes,
 * et tronque la partie la plus proche du point cliqué.
 */
export function cad2dTrimLine(
  targetLine: LineSegment2D,
  cutterSegments: LineSegment2D[],
  pickPoint: Cad2dPoint
): LineSegment2D[] | null {
  const intersections: { point: Cad2dPoint; t: number }[] = [];

  for (const cutter of cutterSegments) {
    const inter = intersectSegments2D(targetLine.p1, targetLine.p2, cutter.p1, cutter.p2);
    if (inter && inter.t > 0.001 && inter.t < 0.999) {
      // Évite les doublons
      if (!intersections.some((x) => Math.hypot(x.point.x - inter.point.x, x.point.y - inter.point.y) < 0.01)) {
        intersections.push(inter);
      }
    }
  }

  if (intersections.length === 0) return null;

  // Trier les intersections selon t croissant
  intersections.sort((a, b) => a.t - b.t);

  // Découper le segment en sous-intervalles
  const splitPoints: Cad2dPoint[] = [targetLine.p1, ...intersections.map((x) => x.point), targetLine.p2];
  const subSegments: LineSegment2D[] = [];

  for (let i = 0; i < splitPoints.length - 1; i++) {
    subSegments.push({ p1: splitPoints[i], p2: splitPoints[i + 1] });
  }

  // Trouver le sous-segment le plus proche du point de clic (celui à supprimer selon AutoCAD standard)
  let closestIndex = 0;
  let minDist = Infinity;

  subSegments.forEach((seg, idx) => {
    const midX = (seg.p1.x + seg.p2.x) / 2;
    const midY = (seg.p1.y + seg.p2.y) / 2;
    const d = Math.hypot(midX - pickPoint.x, midY - pickPoint.y);
    if (d < minDist) {
      minDist = d;
      closestIndex = idx;
    }
  });

  // Conserver tous les sous-segments SAUF celui cliqué
  const keptSegments = subSegments.filter((_, idx) => idx !== closestIndex);
  return keptSegments.length > 0 ? keptSegments : null;
}

/**
 * Commande EXTEND (Prolonger) sur un segment 2D :
 * Projette l'extrémité la plus proche du clic vers l'arête frontière la plus proche.
 */
export function cad2dExtendLine(
  targetLine: LineSegment2D,
  boundarySegments: LineSegment2D[],
  pickPoint: Cad2dPoint
): { updatedLine: LineSegment2D; extendedEnd: "p1" | "p2" } | null {
  const d1 = Math.hypot(targetLine.p1.x - pickPoint.x, targetLine.p1.y - pickPoint.y);
  const d2 = Math.hypot(targetLine.p2.x - pickPoint.x, targetLine.p2.y - pickPoint.y);

  const extendEnd: "p1" | "p2" = d1 < d2 ? "p1" : "p2";
  const origin = extendEnd === "p1" ? targetLine.p1 : targetLine.p2;
  const otherEnd = extendEnd === "p1" ? targetLine.p2 : targetLine.p1;

  // Vecteur orienté vers l'extérieur du segment
  const dx = origin.x - otherEnd.x;
  const dy = origin.y - otherEnd.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null;

  const dir: Cad2dPoint = { x: dx / len, y: dy / len };

  let closestIntersection: Cad2dPoint | null = null;
  let minIntersectionDist = Infinity;

  for (const b of boundarySegments) {
    // Ne pas tester contre soi-même
    if (
      (Math.hypot(b.p1.x - targetLine.p1.x, b.p1.y - targetLine.p1.y) < 0.001 &&
        Math.hypot(b.p2.x - targetLine.p2.x, b.p2.y - targetLine.p2.y) < 0.001) ||
      (Math.hypot(b.p1.x - targetLine.p2.x, b.p1.y - targetLine.p2.y) < 0.001 &&
        Math.hypot(b.p2.x - targetLine.p1.x, b.p2.y - targetLine.p1.y) < 0.001)
    ) {
      continue;
    }

    const hit = intersectRayWithSegment(origin, dir, b.p1, b.p2);
    if (hit && hit.dist < minIntersectionDist) {
      minIntersectionDist = hit.dist;
      closestIntersection = hit.point;
    }
  }

  if (!closestIntersection) return null;

  const updatedLine: LineSegment2D =
    extendEnd === "p1"
      ? { p1: closestIntersection, p2: targetLine.p2 }
      : { p1: targetLine.p1, p2: closestIntersection };

  return { updatedLine, extendedEnd: extendEnd };
}

/**
 * Commande OFFSET (Décaler) :
 * Calcule un segment parallèle décalé de la distance spécifiée du côté du point de clic.
 */
export function cad2dOffsetLine(
  p1: Cad2dPoint,
  p2: Cad2dPoint,
  distance: number,
  sidePoint: Cad2dPoint
): LineSegment2D {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);

  if (len < 0.001) {
    return { p1: { ...p1 }, p2: { ...p2 } };
  }

  // Normale unitaire (rotation de 90° antihoraire : [-dy, dx])
  const nx = -dy / len;
  const ny = dx / len;

  // Calcul du produit scalaire pour savoir de quel côté se trouve sidePoint
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const toSideX = sidePoint.x - midX;
  const toSideY = sidePoint.y - midY;
  const dot = toSideX * nx + toSideY * ny;

  const sign = dot >= 0 ? 1 : -1;
  const shiftX = nx * distance * sign;
  const shiftY = ny * distance * sign;

  return {
    p1: {
      x: Number((p1.x + shiftX).toFixed(4)),
      y: Number((p1.y + shiftY).toFixed(4)),
    },
    p2: {
      x: Number((p2.x + shiftX).toFixed(4)),
      y: Number((p2.y + shiftY).toFixed(4)),
    },
  };
}

/**
 * Décalage concentrique pour un cercle :
 * Crée un cercle concentrique avec rayon agrandi ou réduit selon sidePoint.
 */
export function cad2dOffsetCircle(
  center: Cad2dPoint,
  radius: number,
  distance: number,
  sidePoint: Cad2dPoint
): { center: Cad2dPoint; radius: number } {
  const dMouse = cadDist(center, sidePoint);
  const isOutside = dMouse >= radius;
  const nextRadius = isOutside ? radius + distance : Math.max(0.05, radius - distance);

  return {
    center: { ...center },
    radius: Number(nextRadius.toFixed(4)),
  };
}

/**
 * Décalage d'un polygone fermé (Rectangle, Triangle, Polygone régulier) :
 * Homothétie ou expansion parallèle des sommets depuis le centre de gravité.
 */
export function cad2dOffsetPolygon(
  points: Cad2dPoint[],
  distance: number,
  sidePoint: Cad2dPoint
): Cad2dPoint[] {
  if (points.length < 3) return points;

  // Calcul du centroïde
  let cx = 0;
  let cy = 0;
  const n = points.length;
  for (const pt of points) {
    cx += pt.x;
    cy += pt.y;
  }
  cx /= n;
  cy /= n;
  const centroid: Cad2dPoint = { x: cx, y: cy };

  const dSide = cadDist(centroid, sidePoint);
  // Distance moyenne des sommets au centroïde
  let avgRadius = 0;
  for (const pt of points) {
    avgRadius += cadDist(centroid, pt);
  }
  avgRadius /= n;

  const isOutside = dSide >= avgRadius;
  const scale = isOutside ? (avgRadius + distance) / avgRadius : Math.max(0.1, (avgRadius - distance) / avgRadius);

  return points.map((p) => ({
    x: Number((centroid.x + (p.x - centroid.x) * scale).toFixed(4)),
    y: Number((centroid.y + (p.y - centroid.y) * scale).toFixed(4)),
  }));
}

/**
 * Commande FILLET (Raccord / Congé) :
 * Raccorde deux segments avec un arc circulaire tangent de rayon R.
 * Retourne les deux segments tronqués et l'arc de congé tangent.
 */
export function cad2dFilletLines(
  seg1: LineSegment2D,
  seg2: LineSegment2D,
  radius: number
): {
  trimmedSeg1: LineSegment2D;
  trimmedSeg2: LineSegment2D;
  arc: { center: Cad2dPoint; radius: number; startAngle: number; endAngle: number };
} | null {
  // Trouver l'intersection théorique des deux droites
  const dx1 = seg1.p2.x - seg1.p1.x;
  const dy1 = seg1.p2.y - seg1.p1.y;
  const dx2 = seg2.p2.x - seg2.p1.x;
  const dy2 = seg2.p2.y - seg2.p1.y;

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-5) {
    // Droites parallèles, pas de raccord angulaire
    return null;
  }

  const dx31 = seg2.p1.x - seg1.p1.x;
  const dy31 = seg2.p1.y - seg1.p1.y;

  const t1 = (dx31 * dy2 - dy31 * dx2) / det;
  const intersection: Cad2dPoint = {
    x: seg1.p1.x + t1 * dx1,
    y: seg1.p1.y + t1 * dy1,
  };

  // Vecteurs unitaires partant du sommet d'intersection vers les extrémités distantes
  const v1 = {
    x: (Math.hypot(seg1.p1.x - intersection.x, seg1.p1.y - intersection.y) > 0.01 ? seg1.p1.x : seg1.p2.x) - intersection.x,
    y: (Math.hypot(seg1.p1.x - intersection.x, seg1.p1.y - intersection.y) > 0.01 ? seg1.p1.y : seg1.p2.y) - intersection.y,
  };
  const lenV1 = Math.hypot(v1.x, v1.y);
  if (lenV1 < 0.001) return null;
  const u1: Cad2dPoint = { x: v1.x / lenV1, y: v1.y / lenV1 };

  const v2 = {
    x: (Math.hypot(seg2.p1.x - intersection.x, seg2.p1.y - intersection.y) > 0.01 ? seg2.p1.x : seg2.p2.x) - intersection.x,
    y: (Math.hypot(seg2.p1.x - intersection.x, seg2.p1.y - intersection.y) > 0.01 ? seg2.p1.y : seg2.p2.y) - intersection.y,
  };
  const lenV2 = Math.hypot(v2.x, v2.y);
  if (lenV2 < 0.001) return null;
  const u2: Cad2dPoint = { x: v2.x / lenV2, y: v2.y / lenV2 };

  // Angle alpha entre u1 et u2
  const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
  const alpha = Math.acos(dot); // radians
  if (alpha < 0.01 || alpha > Math.PI - 0.01) return null;

  // Distance du sommet au point de tangence T = R / tan(alpha / 2)
  const dTan = radius / Math.tan(alpha / 2);

  // Points de tangence
  const tPt1: Cad2dPoint = {
    x: Number((intersection.x + u1.x * dTan).toFixed(4)),
    y: Number((intersection.y + u1.y * dTan).toFixed(4)),
  };
  const tPt2: Cad2dPoint = {
    x: Number((intersection.x + u2.x * dTan).toFixed(4)),
    y: Number((intersection.y + u2.y * dTan).toFixed(4)),
  };

  // Centre de l'arc : intersection des normales aux points de tangence
  // Normale à u1 orientée vers l'intérieur
  const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
  const lenBi = Math.hypot(bisector.x, bisector.y);
  if (lenBi < 0.001) return null;
  const uBi = { x: bisector.x / lenBi, y: bisector.y / lenBi };

  const distCenter = radius / Math.sin(alpha / 2);
  const arcCenter: Cad2dPoint = {
    x: Number((intersection.x + uBi.x * distCenter).toFixed(4)),
    y: Number((intersection.y + uBi.y * distCenter).toFixed(4)),
  };

  const startAngle = (Math.atan2(tPt1.y - arcCenter.y, tPt1.x - arcCenter.x) * 180) / Math.PI;
  const endAngle = (Math.atan2(tPt2.y - arcCenter.y, tPt2.x - arcCenter.x) * 180) / Math.PI;

  const far1 = Math.hypot(seg1.p1.x - intersection.x, seg1.p1.y - intersection.y) > 0.01 ? seg1.p1 : seg1.p2;
  const far2 = Math.hypot(seg2.p1.x - intersection.x, seg2.p1.y - intersection.y) > 0.01 ? seg2.p1 : seg2.p2;

  return {
    trimmedSeg1: { p1: far1, p2: tPt1 },
    trimmedSeg2: { p1: far2, p2: tPt2 },
    arc: {
      center: arcCenter,
      radius,
      startAngle: Number(startAngle.toFixed(2)),
      endAngle: Number(endAngle.toFixed(2)),
    },
  };
}

/**
 * Commande SCALE (Échelle) :
 * Homothétie vectorielle d'une entité 2D par rapport à un point de base.
 */
export function cad2dScaleEntity(
  entity: Cad2dEntity,
  basePoint: Cad2dPoint,
  factor: number
): Cad2dEntity {
  if (factor <= 0) factor = 1;

  const next = { ...entity };

  if (next.points && next.points.length > 0) {
    next.points = next.points.map((p) => ({
      x: Number((basePoint.x + (p.x - basePoint.x) * factor).toFixed(4)),
      y: Number((basePoint.y + (p.y - basePoint.y) * factor).toFixed(4)),
    }));
  }

  if (next.center) {
    next.center = {
      x: Number((basePoint.x + (next.center.x - basePoint.x) * factor).toFixed(4)),
      y: Number((basePoint.y + (next.center.y - basePoint.y) * factor).toFixed(4)),
    };
  }

  if (next.radius) {
    next.radius = Number((next.radius * factor).toFixed(4));
  }

  if (next.length) {
    next.length = Number((next.length * factor).toFixed(4));
  }

  if (next.width) {
    next.width = Number((next.width * factor).toFixed(4));
  }

  if (next.height) {
    next.height = Number((next.height * factor).toFixed(4));
  }

  if (next.fontSize) {
    next.fontSize = Math.round(next.fontSize * factor);
  }

  return next;
}

/**
 * Homothétie d'un ensemble de nœuds de tuyauterie ISO.
 */
export function cad2dScaleNodes(
  nodes: IsoNode[],
  selectedNodeIds: string[],
  basePoint: Cad2dPoint,
  factor: number,
  snapStep: number = 0.05
): IsoNode[] {
  const ids = new Set(selectedNodeIds);
  return nodes.map((node) => {
    if (!ids.has(node.id)) return node;
    const nextX = basePoint.x + (node.x - basePoint.x) * factor;
    const nextY = basePoint.y + (node.y - basePoint.y) * factor;
    return {
      ...node,
      x: Number((Math.round(nextX / snapStep) * snapStep).toFixed(3)),
      y: Number((Math.round(nextY / snapStep) * snapStep).toFixed(3)),
    };
  });
}
