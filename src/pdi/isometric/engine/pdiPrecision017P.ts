// PATCH 017P - Precision geometrique PD&I.
// Helpers purs, sans React ni acces reseau (regle R7 : zero API).
// Tolerances d accroche exprimees en PIXELS ECRAN : elles restent
// constantes quel que soit le zoom (100 % comme 284 %).

export type PdiVec3 = { x: number; y: number; z: number };

export const PDI_SNAP_TOL_PX = {
  PORT: 14,
  ENDPOINT: 14,
  MIDPOINT: 12,
  GRID: 10,
};

// Priorite d accroche, du plus fort au plus faible.
export const PDI_SNAP_PRIORITY = ["PORT", "ENDPOINT", "MIDPOINT", "AXIS", "GRID"];

// Arrondi 3 decimales EN SORTIE seulement (millimetre).
export const pdiRound3 = (v: number) => Number((Number.isFinite(v) ? v : 0).toFixed(3));

export const pdiSnapValue = (v: number, step: number) =>
  step > 0 ? pdiRound3(Math.round(v / step) * step) : pdiRound3(v);

// Les 6 directions isometriques du repere modele.
export const PDI_ISO_DIRECTIONS: Array<PdiVec3 & { label: string }> = [
  { x: 1, y: 0, z: 0, label: "X+" },
  { x: -1, y: 0, z: 0, label: "X-" },
  { x: 0, y: 1, z: 0, label: "Y+" },
  { x: 0, y: -1, z: 0, label: "Y-" },
  { x: 0, y: 0, z: 1, label: "Z+" },
  { x: 0, y: 0, z: -1, label: "Z-" },
];

// Ramene un vecteur quelconque sur l axe ISO le plus proche.
export const pdiSnapDirectionIso = (v: PdiVec3) => {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  const u = { x: v.x / n, y: v.y / n, z: v.z / n };
  let best = PDI_ISO_DIRECTIONS[0];
  let bestDot = -Infinity;
  for (const d of PDI_ISO_DIRECTIONS) {
    const dot = u.x * d.x + u.y * d.y + u.z * d.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = d;
    }
  }
  return best;
};

// Verrouillage angulaire : 15 / 30 / 45 / 90 selon le pas demande.
export const pdiSnapAngleDeg = (angle: number, step = 15) => {
  const s = step > 0 ? step : 15;
  const a = Math.round(angle / s) * s;
  return ((a % 360) + 360) % 360;
};

type PdiQaNode = { id: string; name?: string; x: number; y: number; z?: number };
type PdiQaSegment = { id: string; fromNodeId: string; toNodeId: string };

// QA : deux noeuds confondus interdisent la validation d une commande.
export const pdiFindCoincidentNodes = (nodes: PdiQaNode[], eps = 0.001) => {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
      if (d <= eps) {
        return (a.name || a.id) + " et " + (b.name || b.id) + " sont confondus";
      }
    }
  }
  return null;
};

// QA globale : noeuds confondus + tubes de longueur nulle + tubes orphelins.
export const pdiAuditGraph = (nodes: PdiQaNode[], segments: PdiQaSegment[]) => {
  const issues: string[] = [];
  const dup = pdiFindCoincidentNodes(nodes, 0.001);
  if (dup) issues.push(dup);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let zero = 0;
  let orphan = 0;
  for (const s of segments) {
    const a = byId.get(s.fromNodeId);
    const b = byId.get(s.toNodeId);
    if (!a || !b) {
      orphan += 1;
      continue;
    }
    if (Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)) <= 0.001) zero += 1;
  }
  if (zero) issues.push(zero + " tube(s) de longueur nulle");
  if (orphan) issues.push(orphan + " tube(s) orphelin(s)");
  return issues.length ? issues.join(" - ") : null;
};
