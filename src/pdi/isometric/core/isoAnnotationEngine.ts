/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * ARCH-19: EXTRACTION DU MOTEUR D'ANNOTATIONS ISOMÉTRIQUES.
 *
 * Moteur algorithmique déterministe d'évitement de collisions et de placement
 * d'annotations pour l'éditeur isométrique et les rendus de planche.
 */

import {
  IsoNode,
  IsoSegment,
  PipingJoint,
} from "../types/isoGraphTypes";
import {
  portWorldPosition,
  segmentEndpoints,
  equipmentLabel,
} from "./IsoTopologyGraph";
import { isoProjectV4 } from "./isoProjectionEngine";

/**
 * Troncature déterministe des libellés d'annotations isométriques.
 * Si la chaîne dépasse maxLength, insère une ellipse ('…') à la position maxLength - 1.
 */
export const compactIsoLabel = (value: string, maxLength: number = 30): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

/**
 * Rectangle d'annotation positionné sur le plan de projection 2D.
 */
export interface IsoAnnotationPlacement {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

/**
 * Paramètres de viewport requis pour la projection des coordonnées d'annotations.
 */
export interface IsoAnnotationViewport {
  zoom: number;
  panX: number;
  panY: number;
  viewMode?: string;
  yaw?: number;
  pitch?: number;
}

/**
 * Calcule l'agencement optimal des étiquettes (noeuds, équipements, soudures, segments)
 * avec évitement de collisions et pondération de distance d'ancrage.
 */
export function buildIsoAnnotationLayout(
  nodes: readonly IsoNode[],
  segments: readonly IsoSegment[],
  joints: readonly PipingJoint[],
  viewport: IsoAnnotationViewport
): Map<string, IsoAnnotationPlacement> {
  const result = new Map<string, IsoAnnotationPlacement>();
  const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];

  const overlaps = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ) =>
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 3 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 3;

  const add = (
    id: string,
    anchorX: number,
    anchorY: number,
    width: number,
    height: number,
    candidates: Array<{ x: number; y: number }>
  ) => {
    const scoreCandidate = (candidate: { x: number; y: number }) => {
      const current = { ...candidate, width, height };
      const overlapPenalty = occupied.reduce((score, box) => {
        const overlapX = Math.max(0, (current.width + box.width) / 2 - Math.abs(current.x - box.x));
        const overlapY = Math.max(0, (current.height + box.height) / 2 - Math.abs(current.y - box.y));
        return score + overlapX * overlapY;
      }, 0);
      return overlapPenalty + Math.hypot(candidate.x - anchorX, candidate.y - anchorY) * 0.03;
    };

    const chosen =
      candidates.find((candidate) => !occupied.some((box) => overlaps({ ...candidate, width, height }, box))) ||
      [...candidates].sort((a, b) => scoreCandidate(a) - scoreCandidate(b))[0] || { x: anchorX, y: anchorY };

    const placement: IsoAnnotationPlacement = { id, x: chosen.x, y: chosen.y, anchorX, anchorY, width, height };
    occupied.push(placement);
    result.set(id, placement);
  };

  const project = (point: { x: number; y: number; z?: number }) =>
    isoProjectV4(
      point.x,
      point.y,
      point.z || 0,
      viewport.zoom,
      viewport.panX,
      viewport.panY,
      viewport.viewMode,
      viewport.yaw,
      viewport.pitch
    );

  // 1. Réserver le cœur des équipements avant de placer les textes
  nodes.forEach((node) => {
    const p = project(node);
    occupied.push({
      x: p.x,
      y: p.y,
      width: node.equipmentType ? 38 : 18,
      height: node.equipmentType ? 38 : 18,
    });
  });

  // 2. Placer les soudures identifiées
  joints
    .filter((joint) => joint.weldNumber)
    .sort((a, b) => (a.weldNumber || "").localeCompare(b.weldNumber || ""))
    .forEach((joint, index) => {
      const node = nodes.find((item) => item.id === joint.nodeId);
      if (!node) return;
      const anchor = project(portWorldPosition(node, joint.portId, nodes as IsoNode[], segments as IsoSegment[]));
      const center = project(node);
      const dx = anchor.x - center.x;
      const dy = anchor.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      add(`weld:${joint.id}`, anchor.x, anchor.y, 34, 11, [
        { x: anchor.x + ux * 18 + px * 8, y: anchor.y + uy * 18 + py * 8 },
        { x: anchor.x + ux * 18 - px * 8, y: anchor.y + uy * 18 - py * 8 },
        { x: anchor.x + px * (18 + (index % 2) * 8), y: anchor.y + py * (18 + (index % 2) * 8) },
        { x: anchor.x - px * (18 + (index % 2) * 8), y: anchor.y - py * (18 + (index % 2) * 8) },
      ]);
    });

  // 3. Placer les étiquettes de nœuds / équipements
  nodes.forEach((node, index) => {
    const anchor = project(node);
    const text = compactIsoLabel(node.equipmentType ? equipmentLabel(node) : node.name, 30);
    const labelWidth = Math.min(172, Math.max(38, text.length * 5.3 + 14));
    const nearDistance = Math.max(42, labelWidth / 2 + 24);
    const candidates: Array<{ x: number; y: number }> = [];
    [nearDistance, nearDistance + 24, nearDistance + 48, nearDistance + 76].forEach((radius, ring) => {
      const phase = ((index % 4) * Math.PI) / 8 + (ring * Math.PI) / 10;
      for (let step = 0; step < 8; step++) {
        const angle = phase + (step * Math.PI) / 4;
        candidates.push({
          x: anchor.x + Math.cos(angle) * radius,
          y: anchor.y + Math.sin(angle) * Math.max(24, radius * 0.55),
        });
      }
    });
    add(`node:${node.id}`, anchor.x, anchor.y, labelWidth, 18, candidates);
  });

  // 4. Placer les étiquettes de segments de tuyauterie
  segments.forEach((segment) => {
    const endpoints = segmentEndpoints(segment, nodes as IsoNode[], segments as IsoSegment[]);
    if (!endpoints) return;
    const a = project(endpoints.from);
    const b = project(endpoints.to);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const width = 138;
    const ux = dx / len;
    const uy = dy / len;
    const candidates: Array<{ x: number; y: number }> = [];
    [22, 38, 56, 78].forEach((offset, ring) => {
      candidates.push({ x: mx + px * offset, y: my + py * offset });
      candidates.push({ x: mx - px * offset, y: my - py * offset });
      candidates.push({ x: mx + ux * (32 + ring * 18) + px * offset, y: my + uy * (32 + ring * 18) + py * offset });
      candidates.push({ x: mx - ux * (32 + ring * 18) - px * offset, y: my - uy * (32 + ring * 18) - py * offset });
    });
    add(`segment:${segment.id}`, mx, my, width, 20, candidates);
  });

  return result;
}
