/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * TOPOLOGY & GRAPH MATHEMATICS CORE MODULE.
 */

import {
  IsoNode,
  IsoNodeType,
  IsoSegment,
  IsoPort,
  IsoFitting,
  IsoFittingType,
  JointConnectionType,
  PipingJoint,
  GraphIssue,
  PipingLine,
  DIAMETER_BY_DN,
  FITTING_LABELS,
  FITTING_TYPES,
} from "../types/isoGraphTypes";
import { pdiNodeHasFaceOffset017P3 } from "../engine/pdiAxes017P3";
import {
  TROUVAY_CAUVIN_CATALOG,
  getComponentVignetteSvg,
} from "../../catalog/trouvayCauvinCatalog";

export const DEFAULT_LINE_ID = "line_default";

export const pdiUid = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const pdiClamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const pdiDia = (dn: number) =>
  DIAMETER_BY_DN[dn] || DIAMETER_BY_DN[150];

export const EQUIPMENT_NODE_TYPES = new Set<IsoFittingType>(FITTING_TYPES);

export const isEquipmentNode = (n: IsoNode): boolean => !!n.equipmentType;

export function equipmentLabel(n: IsoNode): string {
  return n.equipmentLabel || (n.equipmentType ? FITTING_LABELS[n.equipmentType] : n.name);
}

export function elbowAngle(type: IsoFittingType): number {
  if (type === "coude_90" || type === "coude_90_sr" || type === "coude_3d" || type === "coude_5d") return 90;
  if (type === "coude_45") return 45;
  if (type === "coude_30") return 30;
  if (type === "coude_22_5") return 22.5;
  if (type === "coude_180") return 180;
  return 0;
}

export function defaultFreeNodePorts(): IsoPort[] {
  return [
    { id: pdiUid("port"), index: 0, role: "aux", dx: -1, dy: 0, dz: 0 },
    { id: pdiUid("port"), index: 1, role: "aux", dx: 1, dy: 0, dz: 0 },
    { id: pdiUid("port"), index: 2, role: "aux", dx: 0, dy: -1, dz: 0 },
    { id: pdiUid("port"), index: 3, role: "aux", dx: 0, dy: 1, dz: 0 },
    { id: pdiUid("port"), index: 4, role: "aux", dx: 0, dy: 0, dz: 1 },
    { id: pdiUid("port"), index: 5, role: "aux", dx: 0, dy: 0, dz: -1 },
  ];
}

export const makeNode = (
  name: string,
  x: number,
  y: number,
  z: number,
  type: IsoNodeType = "normal"
): IsoNode => ({
  id: pdiUid("node"),
  name,
  x,
  y,
  z,
  type,
  ports: defaultFreeNodePorts(),
});

export const makeFitting = (
  type: IsoFittingType,
  localPosition: number,
  dn: number
): IsoFitting => ({
  id: pdiUid("fit"),
  type,
  label: FITTING_LABELS[type],
  localPosition: pdiClamp(localPosition, 0, 1),
  cumulativePosition: 0,
  dn,
  orientation: 0,
  length: type.startsWith("coude") ? 0.25 : 0.2,
});

export function defaultEquipmentPorts(type: IsoFittingType): IsoPort[] {
  const bend = elbowAngle(type);
  if (bend) {
    const a = (bend * Math.PI) / 180;
    return [
      { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 1, role: "inline-out", dx: Math.cos(a), dy: Math.sin(a), dz: 0 },
    ];
  }
  if (type === "croix") {
    return [
      { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 1, role: "inline-out", dx: 1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 2, role: "branch", dx: 0, dy: -1, dz: 0 },
      { id: pdiUid("port"), index: 3, role: "branch", dx: 0, dy: 1, dz: 0 },
    ];
  }
  if (
    type === "te_egal" ||
    type === "te_reduit" ||
    type === "te_barre" ||
    type === "piquage" ||
    type === "weldolet" ||
    type === "threadolet" ||
    type === "sockolet"
  ) {
    return [
      { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 1, role: "inline-out", dx: 1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 2, role: "branch", dx: 0, dy: -1, dz: 0 },
    ];
  }
  if (type === "bride_pleine" || type === "fond_bombe") {
    return [
      { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
    ];
  }
  if (type === "jmi" || type.startsWith("bride") || type === "joint" || type === "diaphragme") {
    return [
      { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 1, role: "inline-out", dx: 1, dy: 0, dz: 0 },
    ];
  }
  if (
    type === "manometre" ||
    type === "prise_pression" ||
    type === "purge" ||
    type === "event" ||
    type === "soupape" ||
    type === "robinet_pointeau"
  ) {
    return [
      { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 1, role: "inline-out", dx: 1, dy: 0, dz: 0 },
      { id: pdiUid("port"), index: 2, role: "aux", dx: 0, dy: -1, dz: 0 },
    ];
  }
  return [
    { id: pdiUid("port"), index: 0, role: "inline-in", dx: -1, dy: 0, dz: 0 },
    { id: pdiUid("port"), index: 1, role: "inline-out", dx: 1, dy: 0, dz: 0 },
  ];
}

export function equipmentPortConnectionType(type: IsoFittingType, index: number): JointConnectionType {
  if (type === "bride_wn") return index === 0 ? "butt_weld" : "flanged";
  if (type === "bride_so") return index === 0 ? "fillet_weld" : "flanged";
  if (type === "bride_sw") return index === 0 ? "socket_weld" : "flanged";
  if (type === "bride_lap_joint") return index === 0 ? "butt_weld" : "flanged";
  if (type === "bride_pleine") return "flanged";
  if (type === "joint" || type === "jmi") return "mechanical";
  if (type === "threadolet" || type === "robinet_pointeau") return index === 0 ? "butt_weld" : "threaded";
  if (type === "sockolet") return index === 0 ? "butt_weld" : "socket_weld";
  if (
    (type === "manometre" || type === "prise_pression" || type === "purge" || type === "event") &&
    index === 2
  ) {
    return "threaded";
  }
  return "butt_weld";
}

export function makeEquipmentNode(
  type: IsoFittingType,
  name: string,
  x: number,
  y: number,
  z: number,
  dn: number,
  rotation = 0
): IsoNode {
  return {
    id: pdiUid("equip"),
    name,
    x,
    y,
    z,
    type: type === "te_egal" || type === "te_reduit" || type === "piquage" ? "tee" : "normal",
    equipmentType: type,
    equipmentLabel: name,
    dn,
    rotation,
    ports: defaultEquipmentPorts(type).map((port) => ({
      ...port,
      connectionType: equipmentPortConnectionType(type, port.index),
      endPreparation:
        equipmentPortConnectionType(type, port.index) === "flanged" ? "flange_face" : "bevel",
    })),
  };
}

export function pointOnSegment(a: IsoNode, b: IsoNode, t: number) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function portByIndex(node: IsoNode | undefined, index: number) {
  return node?.ports?.find((p) => p.index === index);
}

export function availablePortId(node: IsoNode | undefined, segments: IsoSegment[], preferred: number) {
  if (!node?.ports?.length) return undefined;
  const used = new Set(
    segments.flatMap((s) => [s.fromPortId, s.toPortId].filter((id): id is string => !!id))
  );
  return (
    node.ports.find((p) => p.index === preferred && !used.has(p.id))?.id ||
    node.ports.find((p) => !used.has(p.id))?.id ||
    node.ports.find((p) => p.index === preferred)?.id ||
    node.ports[0]?.id
  );
}

export function portWorldPosition(
  node: IsoNode,
  portId?: string,
  nodes: IsoNode[] = [],
  segments: IsoSegment[] = []
) {
  const port = node.ports?.find((p) => p.id === portId);
  if (!port) return { x: node.x, y: node.y, z: node.z };
  if (!pdiNodeHasFaceOffset017P3(node)) return { x: node.x, y: node.y, z: node.z };

  const half = Math.max(0.08, (node.length || 0.4) / 2);

  // 1. Raccordement direct : si ce port est explicitement raccordé à un tronçon du réseau
  if (segments && segments.length > 0 && nodes && nodes.length > 0) {
    const connSeg = segments.find(
      (s) =>
        (s.fromNodeId === node.id &&
          (s.fromPortId === port.id ||
            (!s.fromPortId && (port.index === 1 || port.role === "inline-out")))) ||
        (s.toNodeId === node.id &&
          (s.toPortId === port.id ||
            (!s.toPortId && (port.index === 0 || port.role === "inline-in"))))
    );
    if (connSeg) {
      const otherId = connSeg.fromNodeId === node.id ? connSeg.toNodeId : connSeg.fromNodeId;
      const otherNode = nodes.find((n) => n.id === otherId);
      if (otherNode) {
        const dx = otherNode.x - node.x;
        const dy = otherNode.y - node.y;
        const dz = otherNode.z - node.z;
        const len = Math.hypot(dx, dy, dz);
        if (len > 1e-4) {
          const effHalf = Math.min(half, len * 0.45);
          return {
            x: node.x + (dx / len) * effHalf,
            y: node.y + (dy / len) * effHalf,
            z: node.z + (dz / len) * effHalf,
          };
        }
      }
    }

    // 2. Raccordement indirect : déduction géométrique basée sur les tronçons adjacents
    const connSegs = segments.filter((s) => s.fromNodeId === node.id || s.toNodeId === node.id);
    if (connSegs.length > 0) {
      const isInline =
        port.index === 0 ||
        port.index === 1 ||
        port.role === "inline-in" ||
        port.role === "inline-out";
      if (isInline) {
        const otherPortIndex = port.index === 0 ? 1 : 0;
        const otherPort = node.ports?.find((p) => p.index === otherPortIndex);
        const otherSeg = otherPort
          ? segments.find(
              (s) =>
                (s.fromNodeId === node.id && s.fromPortId === otherPort.id) ||
                (s.toNodeId === node.id && s.toPortId === otherPort.id)
            )
          : null;

        if (otherSeg) {
          const otherNodeId = otherSeg.fromNodeId === node.id ? otherSeg.toNodeId : otherSeg.fromNodeId;
          const otherNode = nodes.find((n) => n.id === otherNodeId);
          if (otherNode) {
            const dx = otherNode.x - node.x;
            const dy = otherNode.y - node.y;
            const dz = otherNode.z - node.z;
            const len = Math.hypot(dx, dy, dz);
            if (len > 1e-4) {
              const effHalf = Math.min(half, len * 0.45);
              return {
                x: node.x - (dx / len) * effHalf,
                y: node.y - (dy / len) * effHalf,
                z: node.z - (dz / len) * effHalf,
              };
            }
          }
        } else {
          const s0 = connSegs[0];
          const otherId = s0.fromNodeId === node.id ? s0.toNodeId : s0.fromNodeId;
          const otherNode = nodes.find((n) => n.id === otherId);
          if (otherNode) {
            const dx = otherNode.x - node.x;
            const dy = otherNode.y - node.y;
            const dz = otherNode.z - node.z;
            const len = Math.hypot(dx, dy, dz);
            if (len > 1e-4) {
              const effHalf = Math.min(half, len * 0.45);
              const isToMe = s0.toNodeId === node.id;
              const sign = isToMe ? (port.index === 0 ? 1 : -1) : port.index === 1 ? 1 : -1;
              return {
                x: node.x + sign * (dx / len) * effHalf,
                y: node.y + sign * (dy / len) * effHalf,
                z: node.z + sign * (dz / len) * effHalf,
              };
            }
          }
        }
      }
    }
  }

  // 3. Fallback géométrique par orientation du composant (ports autonomes ou non raccordés)
  let portDx = port.dx,
    portDy = port.dy,
    portDz = port.dz || 0;
  const bend = node.equipmentType ? elbowAngle(node.equipmentType) : 0;
  if (bend && port.index === 0) {
    portDx = -1;
    portDy = 0;
  }
  if (bend && port.index === 1) {
    const portAngle = ((bend * (node.bendDirection || 1)) * Math.PI) / 180;
    portDx = Math.cos(portAngle);
    portDy = Math.sin(portAngle);
  }

  // Dérivation pour tout composant avec piquage ou branche (Tés, croix, soupapes, purges, instruments)
  const isTee =
    node.type === "tee" ||
    (node.equipmentType && (node.equipmentType.startsWith("te_") || node.equipmentType === "piquage"));
  const hasBranch = isTee || port.role === "branch" || port.role === "aux" || port.index >= 2;
  if (hasBranch && (port.index === 2 || port.index === 3 || port.role === "branch" || port.role === "aux")) {
    const defaultBranchAngle = port.index === 2 ? -90 : 90;
    const branchAngle = node.branchAngle !== undefined ? node.branchAngle : defaultBranchAngle;
    const rad = (branchAngle * Math.PI) / 180;
    portDx = Math.cos(rad);
    portDy = Math.sin(rad);
  }

  // Si le composant est inséré sur un tronçon, l'orientation de base dérive du tronçon réel
  let nodeAngleDeg = node.rotation || 0;
  if (segments && segments.length > 0 && nodes && nodes.length > 0) {
    const connSegs = segments.filter((s) => s.fromNodeId === node.id || s.toNodeId === node.id);
    if (connSegs.length > 0) {
      const sIn = connSegs.find((s) => s.toNodeId === node.id);
      const sOut = connSegs.find((s) => s.fromNodeId === node.id);
      if (sIn && sOut) {
        const nIn = nodes.find((item) => item.id === sIn.fromNodeId);
        const nOut = nodes.find((item) => item.id === sOut.toNodeId);
        if (nIn && nOut) {
          nodeAngleDeg = (Math.atan2(nOut.y - nIn.y, nOut.x - nIn.x) * 180) / Math.PI;
        }
      } else {
        const s0 = connSegs[0];
        const otherId = s0.fromNodeId === node.id ? s0.toNodeId : s0.fromNodeId;
        const other = nodes.find((item) => item.id === otherId);
        if (other) {
          if (s0.toNodeId === node.id) {
            nodeAngleDeg = (Math.atan2(node.y - other.y, node.x - other.x) * 180) / Math.PI;
          } else {
            nodeAngleDeg = (Math.atan2(other.y - node.y, other.x - node.x) * 180) / Math.PI;
          }
        }
      }
    }
  }

  const angle = (nodeAngleDeg * Math.PI) / 180;
  const c = Math.cos(angle),
    sin = Math.sin(angle);
  return {
    x: node.x + (portDx * c - portDy * sin) * half,
    y: node.y + (portDx * sin + portDy * c) * half,
    z: node.z + portDz * half,
  };
}

export function segmentEndpoints(
  segment: IsoSegment,
  nodes: IsoNode[],
  segments: IsoSegment[] = []
) {
  const fromNode = nodes.find((n) => n.id === segment.fromNodeId);
  const toNode = nodes.find((n) => n.id === segment.toNodeId);
  if (!fromNode || !toNode) return null;

  // Contexte de raccordement : si segments est vide, le segment en cours EST le contexte
  const activeSegments = segments && segments.length > 0 ? segments : [segment];

  let fromPos = { x: fromNode.x, y: fromNode.y, z: fromNode.z };
  if (segment.fromPortId && fromNode.ports?.some((p) => p.id === segment.fromPortId)) {
    fromPos = portWorldPosition(fromNode, segment.fromPortId, nodes, activeSegments);
  } else if (pdiNodeHasFaceOffset017P3(fromNode)) {
    const pOut =
      fromNode.ports?.find((p) => p.index === 1 || p.role === "inline-out") || fromNode.ports?.[0];
    if (pOut) {
      fromPos = portWorldPosition(fromNode, pOut.id, nodes, activeSegments);
    } else {
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dz = toNode.z - fromNode.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const dir = { x: dx / len, y: dy / len, z: dz / len };
      const halfFrom = Math.min(Math.max(0.08, (fromNode.length || 0.4) / 2), len * 0.45);
      fromPos = {
        x: fromNode.x + dir.x * halfFrom,
        y: fromNode.y + dir.y * halfFrom,
        z: fromNode.z + dir.z * halfFrom,
      };
    }
  }

  let toPos = { x: toNode.x, y: toNode.y, z: toNode.z };
  if (segment.toPortId && toNode.ports?.some((p) => p.id === segment.toPortId)) {
    toPos = portWorldPosition(toNode, segment.toPortId, nodes, activeSegments);
  } else if (pdiNodeHasFaceOffset017P3(toNode)) {
    const pIn =
      toNode.ports?.find((p) => p.index === 0 || p.role === "inline-in") || toNode.ports?.[0];
    if (pIn) {
      toPos = portWorldPosition(toNode, pIn.id, nodes, activeSegments);
    } else {
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dz = toNode.z - fromNode.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const dir = { x: dx / len, y: dy / len, z: dz / len };
      const halfTo = Math.min(Math.max(0.08, (toNode.length || 0.4) / 2), len * 0.45);
      toPos = {
        x: toNode.x - dir.x * halfTo,
        y: toNode.y - dir.y * halfTo,
        z: toNode.z - dir.z * halfTo,
      };
    }
  }

  return {
    fromNode,
    toNode,
    from: fromPos,
    to: toPos,
  };
}

export function rotateWorldPoint(
  point: { x: number; y: number; z: number },
  pivot: { x: number; y: number; z: number },
  angleDeg: number
) {
  const a = (angleDeg * Math.PI) / 180,
    c = Math.cos(a),
    ss = Math.sin(a),
    dx = point.x - pivot.x,
    dy = point.y - pivot.y;
  return { x: pivot.x + dx * c - dy * ss, y: pivot.y + dx * ss + dy * c, z: point.z };
}

export function downstreamNodeIds(
  startId: string,
  segments: IsoSegment[],
  excludedSegmentId: string
): Set<string> {
  const found = new Set<string>([startId]),
    queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const seg of segments) {
      if (seg.id === excludedSegmentId || seg.fromNodeId !== id || found.has(seg.toNodeId)) continue;
      found.add(seg.toNodeId);
      queue.push(seg.toNodeId);
    }
  }
  return found;
}

export function inferJointType(node: IsoNode | undefined, portId?: string): JointConnectionType {
  const explicit = node?.ports?.find((port) => port.id === portId)?.connectionType;
  if (explicit) return explicit;
  const type = node?.equipmentType;
  if (!type) return "unknown";
  return equipmentPortConnectionType(type, node?.ports?.find((port) => port.id === portId)?.index || 0);
}

export const isWeldableConnection = (type: JointConnectionType) =>
  type === "butt_weld" || type === "socket_weld" || type === "fillet_weld";

export function deriveProjectJoints(nodes: IsoNode[], segments: IsoSegment[]): PipingJoint[] {
  let weldIndex = 1;
  const joints: PipingJoint[] = [];
  const portWeldNumberMap = new Map<string, string>();
  for (const seg of segments) {
    for (const endpoint of ["from", "to"] as const) {
      const nodeId = endpoint === "from" ? seg.fromNodeId : seg.toNodeId;
      const portId = endpoint === "from" ? seg.fromPortId : seg.toPortId;
      if (!portId) continue;
      const connectionType = inferJointType(
        nodes.find((n) => n.id === nodeId),
        portId
      );
      const weldable = isWeldableConnection(connectionType);
      let wNum: string | undefined = undefined;
      if (weldable) {
        const jointKey = `${nodeId}_${portId}`;
        if (!portWeldNumberMap.has(jointKey)) {
          portWeldNumberMap.set(jointKey, `W${String(weldIndex++).padStart(2, "0")}`);
        }
        wNum = portWeldNumberMap.get(jointKey);
      }
      joints.push({
        id: `joint_${seg.id}_${endpoint}`,
        segmentId: seg.id,
        endpoint,
        nodeId,
        portId,
        lineId: seg.lineId || DEFAULT_LINE_ID,
        connectionType,
        weldNumber: wNum,
        location: weldable ? "shop" : undefined,
      });
    }
  }
  return joints;
}

export function validateProjectGraph(
  nodes: IsoNode[],
  segments: IsoSegment[],
  lines: PipingLine[]
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const lineIds = new Set(lines.map((l) => l.id));
  const portUsage = new Map<string, number>();

  for (const seg of segments) {
    const from = nodeById.get(seg.fromNodeId),
      to = nodeById.get(seg.toNodeId);
    if (!from)
      issues.push({
        id: `missing_from_${seg.id}`,
        severity: "error",
        code: "MISSING_NODE",
        message: `Tronçon ${seg.id}: nœud origine absent`,
        entityId: seg.id,
      });
    if (!to)
      issues.push({
        id: `missing_to_${seg.id}`,
        severity: "error",
        code: "MISSING_NODE",
        message: `Tronçon ${seg.id}: nœud destination absent`,
        entityId: seg.id,
      });
    if (!seg.fromPortId || !from?.ports?.some((p) => p.id === seg.fromPortId))
      issues.push({
        id: `from_port_${seg.id}`,
        severity: "error",
        code: "MISSING_PORT",
        message: `Tronçon ${seg.id}: port origine invalide`,
        entityId: seg.id,
      });
    if (!seg.toPortId || !to?.ports?.some((p) => p.id === seg.toPortId))
      issues.push({
        id: `to_port_${seg.id}`,
        severity: "error",
        code: "MISSING_PORT",
        message: `Tronçon ${seg.id}: port destination invalide`,
        entityId: seg.id,
      });
    if (seg.fromPortId) portUsage.set(seg.fromPortId, (portUsage.get(seg.fromPortId) || 0) + 1);
    if (seg.toPortId) portUsage.set(seg.toPortId, (portUsage.get(seg.toPortId) || 0) + 1);
    if (!lineIds.has(seg.lineId || DEFAULT_LINE_ID))
      issues.push({
        id: `line_${seg.id}`,
        severity: "error",
        code: "MISSING_LINE",
        message: `Tronçon ${seg.id}: ligne de tuyauterie absente`,
        entityId: seg.id,
      });
    if (seg.length <= 0.001)
      issues.push({
        id: `length_${seg.id}`,
        severity: "error",
        code: "ZERO_LENGTH",
        message: `Tronçon ${seg.id}: longueur nulle`,
        entityId: seg.id,
      });
    if (from?.dn && from.dn !== seg.dn)
      issues.push({
        id: `dn_from_${seg.id}`,
        severity: "warning",
        code: "DN_MISMATCH",
        message: `DN différent entre ${from.name} et le tronçon`,
        entityId: seg.id,
      });
    if (to?.dn && to.dn !== seg.dn)
      issues.push({
        id: `dn_to_${seg.id}`,
        severity: "warning",
        code: "DN_MISMATCH",
        message: `DN différent entre ${to.name} et le tronçon`,
        entityId: seg.id,
      });
  }

  for (const [portId, count] of portUsage) {
    if (count > 1)
      issues.push({
        id: `port_capacity_${portId}`,
        severity: "error",
        code: "PORT_CAPACITY",
        message: `Port ${portId} connecté ${count} fois`,
        entityId: portId,
      });
  }

  for (const node of nodes) {
    if (
      node.equipmentType &&
      !segments.some((s) => s.fromNodeId === node.id || s.toNodeId === node.id)
    ) {
      issues.push({
        id: `isolated_${node.id}`,
        severity: "warning",
        code: "ISOLATED_EQUIPMENT",
        message: `${equipmentLabel(node)} n’est raccordé à aucun tronçon`,
        entityId: node.id,
      });
    }
  }

  return issues;
}

export function normalizedGraphPorts(nodes: IsoNode[], segments: IsoSegment[]) {
  let changed = false;
  const nextNodes = nodes.map((n) => {
    if (n.ports?.length) return n;
    changed = true;
    return { ...n, ports: defaultFreeNodePorts() };
  });
  const nodeMap = new Map(nextNodes.map((n) => [n.id, n]));
  const used = new Set<string>();
  const choose = (node: IsoNode | undefined, preferred: number) => {
    if (!node?.ports?.length) return undefined;
    const wanted =
      node.ports.find((p) => p.index === preferred && !used.has(p.id)) ||
      node.ports.find((p) => !used.has(p.id)) ||
      node.ports[preferred] ||
      node.ports[0];
    if (wanted) used.add(wanted.id);
    return wanted?.id;
  };
  const nextSegments = segments.map((seg) => {
    let fromPortId = seg.fromPortId,
      toPortId = seg.toPortId;
    const fromNode = nodeMap.get(seg.fromNodeId);
    if (fromPortId && fromNode && !fromNode.ports?.some((p) => p.id === fromPortId)) {
      fromPortId = undefined;
      changed = true;
    }
    const toNode = nodeMap.get(seg.toNodeId);
    if (toPortId && toNode && !toNode.ports?.some((p) => p.id === toPortId)) {
      toPortId = undefined;
      changed = true;
    }

    if (!fromPortId) {
      fromPortId = choose(fromNode, 1);
      changed = true;
    } else used.add(fromPortId);
    if (!toPortId) {
      toPortId = choose(toNode, 0);
      changed = true;
    } else used.add(toPortId);
    const lineId = seg.lineId || DEFAULT_LINE_ID;
    if (!seg.lineId) changed = true;
    return fromPortId === seg.fromPortId &&
      toPortId === seg.toPortId &&
      lineId === seg.lineId
      ? seg
      : { ...seg, fromPortId, toPortId, lineId };
  });
  return { nodes: nextNodes, segments: nextSegments, changed };
}

export function cloneSegmentBetween(
  s: IsoSegment,
  fromNodeId: string,
  toNodeId: string,
  length: number,
  type?: IsoSegment["type"]
): IsoSegment {
  return {
    ...s,
    id: pdiUid("seg"),
    fromNodeId,
    toNodeId,
    length: Number(Math.max(0.05, length).toFixed(3)),
    type: type || s.type,
    fittings: [],
  };
}

export function migrateLegacyFittings(nodes: IsoNode[], segments: IsoSegment[]) {
  let changed = false;
  const nextNodes = [...nodes];
  const nextSegments: IsoSegment[] = [];
  for (const s of segments) {
    if (!s.fittings.length) {
      nextSegments.push({ ...s });
      continue;
    }
    changed = true;
    const a = nextNodes.find((n) => n.id === s.fromNodeId);
    const b = nextNodes.find((n) => n.id === s.toNodeId);
    if (!a || !b) {
      nextSegments.push({ ...s, fittings: [] });
      continue;
    }
    let previousId = a.id;
    let previousPoint = { x: a.x, y: a.y, z: a.z };
    const ordered = [...s.fittings].sort((x, y) => x.localPosition - y.localPosition);
    for (const f of ordered) {
      const p = pointOnSegment(a, b, pdiClamp(f.localPosition, 0, 1));
      const n = makeEquipmentNode(
        f.type,
        f.label || FITTING_LABELS[f.type],
        p.x,
        p.y,
        p.z,
        f.dn || s.dn,
        f.orientation || 0
      );
      n.reference = f.reference;
      n.manufacturer = f.manufacturer;
      n.length = f.length;
      nextNodes.push(n);
      const len = Math.hypot(
        p.x - previousPoint.x,
        p.y - previousPoint.y,
        p.z - previousPoint.z
      );
      const previousNode = nextNodes.find((x) => x.id === previousId);
      nextSegments.push({
        ...cloneSegmentBetween(s, previousId, n.id, len, previousId === a.id ? s.type : "straight"),
        fromPortId: previousId === a.id ? s.fromPortId : portByIndex(previousNode, 1)?.id,
        toPortId: portByIndex(n, 0)?.id,
      });
      previousId = n.id;
      previousPoint = p;
    }
    const lastLen = Math.hypot(
      b.x - previousPoint.x,
      b.y - previousPoint.y,
      b.z - previousPoint.z
    );
    const previousNode = nextNodes.find((x) => x.id === previousId);
    nextSegments.push({
      ...cloneSegmentBetween(s, previousId, b.id, lastLen),
      fromPortId: portByIndex(previousNode, 1)?.id,
      toPortId: s.toPortId,
    });
  }
  return { nodes: nextNodes, segments: nextSegments, changed };
}

export function cumulativeData(nodes: IsoNode[], segments: IsoSegment[]) {
  const starts = new Map<string, number>();
  const fittings = new Map<string, number>();
  const root = nodes.find((n) => n.type === "entree_poste")?.id || nodes[0]?.id;
  if (!root) return { starts, fittings };
  starts.set(root, 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of segments) {
      const start = starts.get(s.fromNodeId);
      if (start === undefined) continue;
      const end = start + s.length;
      if (!starts.has(s.toNodeId)) {
        starts.set(s.toNodeId, end);
        changed = true;
      }
    }
  }
  for (const s of segments) {
    const start = starts.get(s.fromNodeId) ?? 0;
    for (const f of s.fittings)
      fittings.set(f.id, start + s.length * pdiClamp(f.localPosition, 0, 1));
  }
  for (const n of nodes.filter((n) => n.equipmentType))
    fittings.set(n.id, starts.get(n.id) ?? 0);
  return { starts, fittings };
}

export function reorderFittings(list: IsoFitting[], fromIndex: number, toIndex: number): IsoFitting[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length)
    return list;
  const copy = [...list];
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

export function materialRows(nodes: IsoNode[], segments: IsoSegment[]) {
  const rows: Array<{
    designation: string;
    dn: number;
    inch: string;
    qty: number;
    unit: string;
    length: number;
    source: string;
    fittingType?: string;
  }> = [];
  for (const n of nodes.filter((x) => x.equipmentType)) {
    const catalogItem = TROUVAY_CAUVIN_CATALOG[n.equipmentType!];
    rows.push({
      designation: equipmentLabel(n),
      dn: n.dn || 150,
      inch: pdiDia(n.dn || 150).inch,
      qty: 1,
      unit: "u",
      length: n.length || 0,
      source:
        n.reference ||
        (catalogItem
          ? `${catalogItem.standard} - ${catalogItem.brand}`
          : "Standard International ASME / API"),
      fittingType: n.equipmentType,
    });
  }
  for (const s of segments) {
    rows.push({
      designation: `Tube ${s.material}`,
      dn: s.dn,
      inch: pdiDia(s.dn).inch,
      qty: 1,
      unit: "tronçon",
      length: s.length,
      source: "Standard International ASTM A106 Gr.B / API 5L",
      fittingType: "pipe",
    });
    for (const f of s.fittings) {
      const catalogItem = TROUVAY_CAUVIN_CATALOG[f.type];
      rows.push({
        designation: f.label,
        dn: f.dn || s.dn,
        inch: pdiDia(f.dn || s.dn).inch,
        qty: 1,
        unit: "u",
        length: 0,
        source:
          f.reference ||
          (catalogItem
            ? `${catalogItem.standard} - ${catalogItem.brand}`
            : "Standard International ASME / API"),
        fittingType: f.type,
      });
    }
  }
  return rows;
}

export function getFittingSvgGraphic(type: IsoFittingType, isPrint: boolean = false) {
  return getComponentVignetteSvg(type, { isPrint });
}

