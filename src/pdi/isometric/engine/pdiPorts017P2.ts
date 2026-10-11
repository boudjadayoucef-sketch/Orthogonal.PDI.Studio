// PATCH 017P2 - reorientation geometrique des ports et des coudes.
// Fonctions pures : zero React, zero API, calcul local (R7).

export type PdiPortLike = { id: string; index: number; role?: string; dx: number; dy: number; dz: number };

export type PdiNodeLike = {
  id: string;
  x: number;
  y: number;
  z: number;
  rotation?: number;
  bendDirection?: 1 | -1;
  equipmentType?: string;
  ports?: PdiPortLike[];
};

export type PdiSegmentLike = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPortId?: string;
  toPortId?: string;
};

// Catalogue normalise ASME B16.9 / EN 10253 : un coude ne prend pas un angle arbitraire.
export const PDI_ELBOW_CATALOG: Array<{ type: string; angle: number }> = [
  { type: "coude_90", angle: 90 },
  { type: "coude_45", angle: 45 },
  { type: "coude_30", angle: 30 },
  { type: "coude_22_5", angle: 22.5 },
];

export const PDI_ELBOW_RESIDUAL_MAX_DEG = 5;

const r3 = (v: number) => Number((Number.isFinite(v) ? v : 0).toFixed(3));
const DEG = 180 / Math.PI;

// La tolerance d accrochage est exprimee en pixels ecran ; le SVG travaille
// dans un viewBox fixe. On convertit pour que 14 px restent 14 px reels.
export const pdiTolViewBox = (tolPx: number, elementWidthPx: number, viewBoxWidth = 620) => {
  if (!elementWidthPx || elementWidthPx <= 0) return tolPx;
  return (tolPx * viewBoxWidth) / elementWidthPx;
};

export const pdiUnitDir = (
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const n = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / n, y: dy / n, z: dz / n };
};

// Adapte un coude a la geometrie : on deduit rotation et sens de coude des
// deux voisins reels, puis on retient l angle normalise le plus proche.
export const pdiFitElbow = (
  dirA: { x: number; y: number; z: number },
  dirB: { x: number; y: number; z: number },
) => {
  const rot = Math.atan2(dirA.y, dirA.x) * DEG - 180;
  let sweep = Math.atan2(dirB.y, dirB.x) * DEG - rot;
  while (sweep > 180) sweep -= 360;
  while (sweep <= -180) sweep += 360;
  const bendDirection: 1 | -1 = sweep >= 0 ? 1 : -1;
  const magnitude = Math.abs(sweep);
  let best = PDI_ELBOW_CATALOG[0];
  for (const cand of PDI_ELBOW_CATALOG) {
    if (Math.abs(cand.angle - magnitude) < Math.abs(best.angle - magnitude)) best = cand;
  }
  return {
    equipmentType: best.type,
    rotation: r3(((rot % 360) + 360) % 360),
    bendDirection,
    residualDeg: r3(Math.abs(best.angle - magnitude)),
  };
};

// Reoriente les faces referencees par un troncon vers le voisin reel.
// Les ports de piquage (role branch) et les equipements non coudes sont
// preserves : leur orientation est un choix metier, pas une consequence.
export const pdiReorientPorts = <N extends PdiNodeLike, S extends PdiSegmentLike>(
  nodes: N[],
  segments: S[],
  opts: { adaptElbows?: boolean } = {},
) => {
  const adaptElbows = opts.adaptElbows !== false;
  const byId = new Map<string, N>();
  for (const n of nodes) byId.set(n.id, n);
  const links = new Map<string, Array<{ portId?: string; otherId: string }>>();
  const push = (id: string, link: { portId?: string; otherId: string }) => {
    const cur = links.get(id);
    if (cur) cur.push(link);
    else links.set(id, [link]);
  };
  for (const s of segments) {
    if (!byId.has(s.fromNodeId) || !byId.has(s.toNodeId)) continue;
    push(s.fromNodeId, { portId: s.fromPortId, otherId: s.toNodeId });
    push(s.toNodeId, { portId: s.toPortId, otherId: s.fromNodeId });
  }
  const elbowTypes = new Set(PDI_ELBOW_CATALOG.map((c) => c.type));
  const warnings: string[] = [];
  let changed = 0;
  const next = nodes.map((node) => {
    const ls = links.get(node.id) || [];
    if (!ls.length) return node;
    if (node.equipmentType && elbowTypes.has(node.equipmentType)) {
      if (!adaptElbows || ls.length !== 2) return node;
      const a = byId.get(ls[0].otherId);
      const b = byId.get(ls[1].otherId);
      if (!a || !b) return node;
      const fit = pdiFitElbow(pdiUnitDir(node, a), pdiUnitDir(node, b));
      if (fit.residualDeg > PDI_ELBOW_RESIDUAL_MAX_DEG) {
        warnings.push(node.id + ' : geometrie a ' + fit.residualDeg + ' deg du coude normalise ' + fit.equipmentType);
      }
      const sameBend = (node.bendDirection || 1) === fit.bendDirection;
      if (node.equipmentType === fit.equipmentType && r3(node.rotation || 0) === fit.rotation && sameBend) return node;
      changed += 1;
      return { ...node, equipmentType: fit.equipmentType, rotation: fit.rotation, bendDirection: fit.bendDirection } as unknown as N;
    }
    if (node.equipmentType) return node;
    if (!node.ports || !node.ports.length) return node;
    const angle = ((node.rotation || 0) * Math.PI) / 180;
    const c = Math.cos(-angle);
    const s = Math.sin(-angle);
    let touched = false;
    const ports = node.ports.map((port) => {
      const link = ls.find((l) => l.portId === port.id);
      if (!link || port.role === "branch") return port;
      const other = byId.get(link.otherId);
      if (!other) return port;
      const d = pdiUnitDir(node, other);
      const dx = r3(d.x * c - d.y * s);
      const dy = r3(d.x * s + d.y * c);
      const dz = r3(d.z);
      if (dx === r3(port.dx) && dy === r3(port.dy) && dz === r3(port.dz)) return port;
      touched = true;
      return { ...port, dx, dy, dz };
    });
    if (!touched) return node;
    changed += 1;
    return { ...node, ports } as unknown as N;
  });
  return { nodes: changed ? next : nodes, changed, warnings };
};

// Controle de coherence : une face qui ne pointe pas vers son voisin.
export const pdiAuditPorts = <N extends PdiNodeLike, S extends PdiSegmentLike>(
  nodes: N[],
  segments: S[],
  minDot = 0.9,
) => {
  const byId = new Map<string, N>();
  for (const n of nodes) byId.set(n.id, n);
  for (const s of segments) {
    const a = byId.get(s.fromNodeId);
    const b = byId.get(s.toNodeId);
    if (!a || !b) continue;
    const port = (a.ports || []).find((p) => p.id === s.fromPortId);
    if (!port || port.role === "branch") continue;
    const angle = ((a.rotation || 0) * Math.PI) / 180;
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const wx = port.dx * c - port.dy * sn;
    const wy = port.dx * sn + port.dy * c;
    const n1 = Math.hypot(wx, wy, port.dz) || 1;
    const d = pdiUnitDir(a, b);
    const dot = (wx / n1) * d.x + (wy / n1) * d.y + (port.dz / n1) * d.z;
    if (dot < minDot) return s.id + ' : face non orientee vers le voisin';
  }
  return null;
};
