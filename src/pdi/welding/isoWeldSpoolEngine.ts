// Moteur industriel de gestion du Plan de Soudage (Weld Map) & Carnet de Spools
// Conforme aux standards ASME B31.3 / EN 13480 / Spécifications Pétrole & Gaz

import { IsoNode, IsoSegment, PipingLine, JointConnectionType } from "../isometric/types/isoGraphTypes";
import { TROUVAY_CAUVIN_CATALOG } from "../catalog/trouvayCauvinCatalog";

export type PdiWeldLocation = "shop" | "field" | "golden";
export type PdiWeldType = "BW" | "SW" | "FW" | "OL";
export type PdiNdtStatus = "pending" | "accepted" | "rejected" | "repaired";

export interface PdiWeldEntry {
  id: string;
  weldNumber: string; // Ex: W01, W02...
  spoolId: string;    // Ex: SP-01
  location: PdiWeldLocation; // shop (Atelier) | field (Chantier) | golden (Soudure d'Or Tie-in)
  weldType: PdiWeldType;     // BW (Bout à bout) | SW (Emboîtement) | FW (Angle) | OL (Piquage)
  dn: number;
  nps: string;
  schedule: string;
  thicknessMm: number;
  material: string;
  wpsNumber: string;        // Ex: WPS-PDI-141/111
  wpsRef: string;           // Alias pour compatibilité ISO
  process: string;          // Ex: 141 (TIG), 141+111 (TIG+SMAW)
  welderId: string;         // Ex: WLD-01
  date: string;
  cndRequired: {
    vt: boolean; // Examen Visuel 100%
    rt: boolean; // Radiographie (10%, 20%, 100%)
    ut: boolean; // Ultrasons
    pt: boolean; // Ressuage / Magnétoscopie
    pwht: boolean; // Traitement thermique après soudage
  };
  ndtRequired: string;      // Alias format texte CND (ex: "RT 20% + VT")
  ndtStatus: PdiNdtStatus;
  segmentId: string;
  nodeId: string;
  portId: string;
  worldPos: { x: number; y: number; z: number };
  x: number;
  y: number;
  z: number;
}

export interface PdiSpoolEntry {
  id: string;             // Ex: SP-01
  label: string;          // Ex: Spool SP-01
  lineId: string;
  color: string;          // Couleur visuelle distincte
  segmentIds: string[];
  nodeIds: string[];
  shopWeldIds: string[];
  fieldWeldIds: string[]; // Soudures de raccordement / fermeture
  totalLengthM: number;
  estimatedWeightKg: number;
  boundingBoxM: {
    dx: number;
    dy: number;
    dz: number;
    maxDimM: number;
  };
  boundingSize: {
    dx: number;
    dy: number;
    dz: number;
    maxDimM: number;
  };
  transportable: boolean; // true si maxDimM <= 12m (Gabarit routier standard)
  isTransportable: boolean;
  status: "etude" | "prefabrication" | "cnd_valide" | "peinture" | "expedie" | "pose";
}

export interface WeldSpoolSummaryStats {
  totalWelds: number;
  shopWelds: number;
  fieldWelds: number;
  goldenWelds: number;
  rtWelds: number;
  totalSpools: number;
  totalWeightKg: number;
  totalPipingWeightKg: number;
  totalLinearM: number;
  totalCutLengthM: number;
  conformityRate: number;
}

export interface WeldSpoolResult {
  welds: PdiWeldEntry[];
  spools: PdiSpoolEntry[];
  stats: {
    totalWelds: number;
    shopWeldsCount: number;
    fieldWeldsCount: number;
    goldenWeldsCount: number;
    totalSpools: number;
    totalWeightKg: number;
    totalLengthM: number;
    transportConformityPct: number;
    rtControlRatePct: number;
  };
  summary: WeldSpoolSummaryStats;
}

// Palette de couleurs industrielles contrastées pour repérage visuel des spools
export const PDI_SPOOL_PALETTE = [
  "#2563eb", // Bleu royal
  "#10b981", // Émeraude
  "#f59e0b", // Ambre
  "#8b5cf6", // Violet
  "#ec4899", // Rose
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#84cc16", // Lime
];

// Estimation rapide épaisseur selon DN et Schedule standard
export function getStdSchedule(dn: number): { schedule: string; thicknessMm: number } {
  if (dn <= 25) return { schedule: "Sch 40S", thicknessMm: 3.38 };
  if (dn <= 50) return { schedule: "Sch 40", thicknessMm: 3.91 };
  if (dn <= 80) return { schedule: "Sch 40", thicknessMm: 5.49 };
  if (dn <= 100) return { schedule: "Sch 40", thicknessMm: 6.02 };
  if (dn <= 150) return { schedule: "Sch 40", thicknessMm: 7.11 };
  if (dn <= 200) return { schedule: "Sch 40", thicknessMm: 8.18 };
  if (dn <= 250) return { schedule: "Sch 40", thicknessMm: 9.27 };
  if (dn <= 300) return { schedule: "Sch 40", thicknessMm: 10.31 };
  if (dn <= 400) return { schedule: "Sch 40", thicknessMm: 12.7 };
  return { schedule: "Sch 40", thicknessMm: 12.7 };
}

// Convertisseur DN vers NPS string
export function dnToNps(dn: number): string {
  switch (dn) {
    case 15: return '1/2"';
    case 20: return '3/4"';
    case 25: return '1"';
    case 32: return '1" 1/4';
    case 40: return '1" 1/2';
    case 50: return '2"';
    case 65: return '2" 1/2';
    case 80: return '3"';
    case 100: return '4"';
    case 125: return '5"';
    case 150: return '6"';
    case 200: return '8"';
    case 250: return '10"';
    case 300: return '12"';
    case 350: return '14"';
    case 400: return '16"';
    case 450: return '18"';
    case 500: return '20"';
    case 600: return '24"';
    default: return `${dn}mm`;
  }
}

// Détection type de soudure selon type de raccord
export function inferWeldType(connectionType: JointConnectionType, dn: number): PdiWeldType {
  if (connectionType === "socket_weld" || (dn <= 40 && connectionType === "fillet_weld")) {
    return "SW";
  }
  if (connectionType === "fillet_weld") {
    return "FW";
  }
  return "BW";
}

/**
 * Moteur principal de calcul et de partitionnement en Spools & Carnet de Soudage
 */
export function deriveSpoolsAndWelds(
  nodes: IsoNode[],
  segments: IsoSegment[],
  lines: PipingLine[] = [],
  weldOverrides: Record<string, Partial<PdiWeldEntry>> = {}
): WeldSpoolResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const segMap = new Map(segments.map((s) => [s.id, s]));

  // 1. DÉTECTION DES SOUDURES PHYSIQUES
  // On regroupe les connexions par position géographique / nœud pour éviter les doublons
  interface RawJointCandidate {
    key: string;
    segId: string;
    endpoint: "from" | "to";
    nodeId: string;
    portId: string;
    pos: { x: number; y: number; z: number };
    dn: number;
    material: string;
    connectionType: JointConnectionType;
  }

  const rawCandidates: RawJointCandidate[] = [];

  for (const seg of segments) {
    for (const ep of ["from", "to"] as const) {
      const nodeId = ep === "from" ? seg.fromNodeId : seg.toNodeId;
      const portId = ep === "from" ? seg.fromPortId : seg.toPortId;
      const node = nodeMap.get(nodeId);
      if (!node || !portId) continue;

      // Calcul position spatiale exacte du port
      const port = node.ports?.find((p) => p.id === portId);
      let px = node.x;
      let py = node.y;
      let pz = node.z;
      const hasFaceOffset = Boolean(node.equipmentType || node.type === "tee");
      if (port && hasFaceOffset) {
        const otherNodeId = ep === "from" ? seg.toNodeId : seg.fromNodeId;
        const otherNode = nodeMap.get(otherNodeId);
        if (otherNode) {
          const dx = otherNode.x - node.x;
          const dy = otherNode.y - node.y;
          const dz = otherNode.z - node.z;
          const len = Math.hypot(dx, dy, dz);
          if (len > 1e-4) {
            const half = Math.min(Math.max(0.08, (node.length || 0.4) / 2), len * 0.45);
            px = node.x + (dx / len) * half;
            py = node.y + (dy / len) * half;
            pz = node.z + (dz / len) * half;
          }
        }
      }

      // Filtrage : Un nœud d'extrémité libre (1 seul tronçon connecté) sans composant terminal ne constitue pas une soudure
      const nodeTouching = segments.filter(
        (s) => s.fromNodeId === nodeId || s.toNodeId === nodeId
      );
      const isTerminalFitting =
        Boolean(node.equipmentType) ||
        node.type === "entree_poste" ||
        node.type === "sortie_poste" ||
        node.type === "gare_depart" ||
        node.type === "gare_arrivee" ||
        node.type === "tee";

      if (nodeTouching.length < 2 && !isTerminalFitting) {
        continue;
      }

      const connType: JointConnectionType = port?.connectionType || "butt_weld";
      const isWeldable =
        connType === "butt_weld" || connType === "socket_weld" || connType === "fillet_weld";

      if (isWeldable) {
        // Clé unique basée sur l'emplacement géographique arrondi au mm
        const locKey = `${px.toFixed(3)}_${py.toFixed(3)}_${pz.toFixed(3)}`;
        rawCandidates.push({
          key: locKey,
          segId: seg.id,
          endpoint: ep,
          nodeId,
          portId,
          pos: { x: px, y: py, z: pz },
          dn: seg.dn || node.dn || 100,
          material: seg.material || (node as any).material || node.spec || "ASTM A106 Gr.B",
          connectionType: connType,
        });
      }
    }
  }

  // Regroupement par position physique : une seule soudure par jonction physique
  const groupedWeldLocs = new Map<string, RawJointCandidate[]>();
  for (const cand of rawCandidates) {
    const list = groupedWeldLocs.get(cand.key) || [];
    list.push(cand);
    groupedWeldLocs.set(cand.key, list);
  }

  let weldCounter = 1;
  const welds: PdiWeldEntry[] = [];

  // Création des entités de soudure (1 seule soudure par joint physique)
  for (const [key, cands] of groupedWeldLocs.entries()) {
    // Préférer le candidat rattaché à un équipement/té s'il existe pour une indexation précise
    const primary = cands.find((c) => {
      const n = nodeMap.get(c.nodeId);
      return Boolean(n?.equipmentType || n?.type === "tee");
    }) || cands[0];

    const weldId = `W_${primary.nodeId}_${primary.portId}`;
    const override = weldOverrides[weldId] || {};

    const dn = primary.dn;
    const stdSch = getStdSchedule(dn);
    const weldType = inferWeldType(primary.connectionType, dn);

    // Détermination par défaut : si raccordement équipement terminal ou vanne = field, sinon shop
    const node = nodeMap.get(primary.nodeId);
    const isTerminalOrEquip =
      node?.equipmentType ||
      node?.type === "entree_poste" ||
      node?.type === "sortie_poste" ||
      node?.type === "gare_depart" ||
      node?.type === "gare_arrivee";

    const defaultLoc: PdiWeldLocation = isTerminalOrEquip ? "field" : "shop";
    const location: PdiWeldLocation = override.location || defaultLoc;

    const wNum = override.weldNumber || `W${String(weldCounter++).padStart(2, "0")}`;

    // CND par défaut selon B31.3
    const isHeavyOrCritical = dn >= 200 || primary.material.includes("316") || primary.material.includes("A333");
    const rtDefault = location === "golden" ? true : isHeavyOrCritical || location === "field";

    const finalWps = override.wpsNumber || (weldType === "SW" ? "WPS-SW-02" : "WPS-B31.3-BW-141/111");

    welds.push({
      id: weldId,
      weldNumber: wNum,
      spoolId: override.spoolId || "SP-01",
      location,
      weldType: override.weldType || weldType,
      dn,
      nps: dnToNps(dn),
      schedule: override.schedule || stdSch.schedule,
      thicknessMm: override.thicknessMm ?? stdSch.thicknessMm,
      material: override.material || primary.material,
      wpsNumber: finalWps,
      process: override.process || (dn <= 50 ? "141 (GTAW / TIG)" : "141 + 111 (TIG + EE)"),
      welderId: override.welderId || `SND-${(weldCounter % 4) + 1}`,
      date: override.date || "2026-09-05",
      cndRequired: override.cndRequired || {
        vt: true,
        rt: rtDefault,
        ut: dn >= 150,
        pt: weldType === "SW",
        pwht: stdSch.thicknessMm >= 19,
      },
      wpsRef: finalWps,
      ndtRequired: rtDefault ? "RT 20% + VT" : "VT 100%",
      ndtStatus: override.ndtStatus || "accepted",
      segmentId: primary.segId,
      nodeId: primary.nodeId,
      portId: primary.portId,
      worldPos: primary.pos,
      x: primary.pos.x,
      y: primary.pos.y,
      z: primary.pos.z,
    });
  }

  // 2. PARTITIONNEMENT EN SPOOLS
  // Deux segments appartiennent au même Spool si ils sont reliés par un nœud dont TOUTES les soudures sont "shop".
  // Les soudures "field" ou les liaisons à brides créent une coupure de Spool.
  const fieldWeldNodeIds = new Set<string>();
  for (const w of welds) {
    if (w.location === "field" || w.location === "golden") {
      fieldWeldNodeIds.add(w.nodeId);
    }
  }

  // Détection des liaisons à brides (coupures mécaniques)
  const flangedNodeIds = new Set<string>();
  for (const n of nodes) {
    if (n.ports?.some((p) => p.connectionType === "flanged")) {
      flangedNodeIds.add(n.id);
    }
  }

  // Graphe d'adjacence des segments
  const segAdj = new Map<string, Set<string>>();
  for (const s of segments) {
    segAdj.set(s.id, new Set());
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];

      // Vérifier si s1 et s2 partagent un nœud commun
      const commonNodeId =
        s1.fromNodeId === s2.fromNodeId ||
        s1.fromNodeId === s2.toNodeId
          ? s1.fromNodeId
          : s1.toNodeId === s2.fromNodeId || s1.toNodeId === s2.toNodeId
          ? s1.toNodeId
          : null;

      if (commonNodeId) {
        // Coupure de Spool si le nœud est une soudure chantier ou une bride,
        // ou si les tronçons ont des affectations de spool explicites différentes ou dissociées ("NONE")
        const hasSpoolConflict = (Boolean(s1.spoolNumber || s2.spoolNumber) && s1.spoolNumber !== s2.spoolNumber) ||
                                 s1.spoolNumber === "NONE" || s2.spoolNumber === "NONE";
        const isBoundary = fieldWeldNodeIds.has(commonNodeId) || flangedNodeIds.has(commonNodeId) || hasSpoolConflict;
        if (!isBoundary) {
          segAdj.get(s1.id)?.add(s2.id);
          segAdj.get(s2.id)?.add(s1.id);
        }
      }
    }
  }

  // Composantes connexes (Spools)
  const visitedSegs = new Set<string>();
  const spoolGroups: string[][] = [];

  for (const s of segments) {
    if (visitedSegs.has(s.id)) continue;
    const group: string[] = [];
    const queue: string[] = [s.id];
    visitedSegs.add(s.id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      group.push(curr);

      const neighbors = segAdj.get(curr) || new Set();
      for (const nbr of neighbors) {
        if (!visitedSegs.has(nbr)) {
          visitedSegs.add(nbr);
          queue.push(nbr);
        }
      }
    }
    spoolGroups.push(group);
  }

  // Si aucun segment n'est présent mais qu'il y a des nœuds
  if (spoolGroups.length === 0 && segments.length === 0 && nodes.length > 0) {
    spoolGroups.push([]);
  }

  // 3. CONSTRUCTION DES OBJETS SPOOLS DÉTAILLÉS
  const spools: PdiSpoolEntry[] = [];
  let spoolIdx = 1;

  for (const groupSegIds of spoolGroups) {
    const spoolSegs = groupSegIds.map((id) => segMap.get(id)!).filter(Boolean);
    const explicitSpoolId = spoolSegs.find((s) => s.spoolNumber && s.spoolNumber !== "NONE")?.spoolNumber;
    const spoolId = explicitSpoolId || `SP-${String(spoolIdx).padStart(2, "0")}`;
    const color = PDI_SPOOL_PALETTE[(spoolIdx - 1) % PDI_SPOOL_PALETTE.length];
    spoolIdx++;

    const spoolNodeIdSet = new Set<string>();
    for (const s of spoolSegs) {
      spoolNodeIdSet.add(s.fromNodeId);
      spoolNodeIdSet.add(s.toNodeId);
    }
    const spoolNodes = Array.from(spoolNodeIdSet)
      .map((id) => nodeMap.get(id)!)
      .filter(Boolean);

    // Calcul longueur cumulée
    let totalLengthM = 0;
    for (const s of spoolSegs) {
      totalLengthM += s.length || 0;
    }

    // Calcul Poids estimé (Tubes + Raccords Standards Internationaux ASME / API)
    let estimatedWeightKg = 0;
    for (const s of spoolSegs) {
      // Poids tube acier approx = (DN / 10) * 2.5 kg/m
      const tubeKgPerM = Math.max(2, (s.dn / 25) * 4.2);
      estimatedWeightKg += (s.length || 0) * tubeKgPerM;
      for (const f of s.fittings) {
        const cat = TROUVAY_CAUVIN_CATALOG[f.type];
        const dim = cat?.dimensions.find((d) => d.dn === s.dn);
        estimatedWeightKg += dim?.weightKg || 3.5;
      }
    }

    // Calcul Encombrement 3D (Bounding Box pour transport)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    if (spoolNodes.length > 0) {
      for (const n of spoolNodes) {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
        minZ = Math.min(minZ, n.z);
        maxZ = Math.max(maxZ, n.z);
      }
    } else {
      minX = maxX = minY = maxY = minZ = maxZ = 0;
    }

    const dx = Math.abs(maxX - minX);
    const dy = Math.abs(maxY - minY);
    const dz = Math.abs(maxZ - minZ);
    const maxDimM = Math.max(dx, dy, dz, totalLengthM);

    // Gabarit standard transport routier : semi-remorque max 12.0 m
    const transportable = maxDimM <= 12.0;

    // Association des soudures appartenant à ce spool
    const shopWeldIds: string[] = [];
    const fieldWeldIds: string[] = [];

    for (const w of welds) {
      const touchesSpool = spoolNodeIdSet.has(w.nodeId) || groupSegIds.includes(w.segmentId);
      if (touchesSpool) {
        if (w.location === "shop") {
          shopWeldIds.push(w.id);
          w.spoolId = spoolId; // Réassigne la soudure d'atelier à son spool
        } else {
          fieldWeldIds.push(w.id);
        }
      }
    }

    spools.push({
      id: spoolId,
      label: `Spool ${spoolId}`,
      lineId: spoolSegs[0]?.lineId || "L101",
      color,
      segmentIds: groupSegIds,
      nodeIds: Array.from(spoolNodeIdSet),
      shopWeldIds,
      fieldWeldIds,
      totalLengthM: Number(totalLengthM.toFixed(2)),
      estimatedWeightKg: Math.round(estimatedWeightKg),
      boundingBoxM: {
        dx: Number(dx.toFixed(2)),
        dy: Number(dy.toFixed(2)),
        dz: Number(dz.toFixed(2)),
        maxDimM: Number(maxDimM.toFixed(2)),
      },
      boundingSize: {
        dx: Number(dx.toFixed(2)),
        dy: Number(dy.toFixed(2)),
        dz: Number(dz.toFixed(2)),
        maxDimM: Number(maxDimM.toFixed(2)),
      },
      transportable,
      isTransportable: transportable,
      status: "prefabrication",
    });
  }

  // 4. STATISTIQUES GLOBALES
  const shopCount = welds.filter((w) => w.location === "shop").length;
  const fieldCount = welds.filter((w) => w.location === "field").length;
  const goldenCount = welds.filter((w) => w.location === "golden").length;
  const rtCount = welds.filter((w) => w.cndRequired.rt).length;
  const transportableSpools = spools.filter((s) => s.transportable).length;

  const totalLength = spools.reduce((acc, s) => acc + s.totalLengthM, 0);
  const totalWeight = spools.reduce((acc, s) => acc + s.estimatedWeightKg, 0);

  const stats = {
    totalWelds: welds.length,
    shopWeldsCount: shopCount,
    fieldWeldsCount: fieldCount,
    goldenWeldsCount: goldenCount,
    totalSpools: spools.length,
    totalWeightKg: Math.round(totalWeight),
    totalLengthM: Number(totalLength.toFixed(2)),
    transportConformityPct: spools.length ? Math.round((transportableSpools / spools.length) * 100) : 100,
    rtControlRatePct: welds.length ? Math.round((rtCount / welds.length) * 100) : 0,
  };

  const summary = {
    totalWelds: welds.length,
    shopWelds: shopCount,
    fieldWelds: fieldCount,
    goldenWelds: goldenCount,
    rtWelds: rtCount,
    totalSpools: spools.length,
    totalWeightKg: Math.round(totalWeight),
    totalPipingWeightKg: Math.round(totalWeight),
    totalLinearM: Number(totalLength.toFixed(2)),
    totalCutLengthM: Number(totalLength.toFixed(2)),
    conformityRate: stats.transportConformityPct,
  };

  return {
    welds,
    spools,
    stats,
    summary,
  };
}

/**
 * Export CSV normalisé du Cahier de Soudage (Weld Log / Dossier Constructeur)
 */
export function exportWeldLogCsv(welds: PdiWeldEntry[]): string {
  const headers = [
    "Repere_Soudure",
    "Spool_ID",
    "Localisation",
    "Type_Soudure",
    "DN",
    "NPS",
    "Schedule",
    "Epaisseur_mm",
    "Nuance_Materiau",
    "Fiche_WPS",
    "Procede",
    "Soudeur_ID",
    "VT_Visuel",
    "RT_Radio",
    "UT_Ultrasons",
    "PT_Ressuage",
    "Statut_CND",
  ];

  const rows = welds.map((w) => [
    w.weldNumber,
    w.spoolId,
    w.location === "shop" ? "Atelier" : w.location === "field" ? "Chantier" : "Soudure_Or",
    w.weldType,
    w.dn,
    w.nps,
    w.schedule,
    w.thicknessMm,
    `"${w.material}"`,
    w.wpsNumber,
    w.process,
    w.welderId,
    w.cndRequired.vt ? "100%" : "-",
    w.cndRequired.rt ? "OUI" : "NON",
    w.cndRequired.ut ? "OUI" : "NON",
    w.cndRequired.pt ? "OUI" : "NON",
    w.ndtStatus.toUpperCase(),
  ]);

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
}

/**
 * Export CSV normalisé du Carnet de Spools (Spool Schedule)
 */
export function exportSpoolScheduleCsv(spools: PdiSpoolEntry[]): string {
  const headers = [
    "Spool_ID",
    "Designation",
    "Ligne_Piping",
    "Nb_Troncons",
    "Longueur_Totale_m",
    "Poids_Estime_kg",
    "Encombrement_X_m",
    "Encombrement_Y_m",
    "Encombrement_Z_m",
    "Dim_Max_m",
    "Gabarit_Routier_12m",
    "Soudures_Atelier",
    "Soudures_Chantier",
    "Statut",
  ];

  const rows = spools.map((s) => [
    s.id,
    s.label,
    s.lineId,
    s.segmentIds.length,
    s.totalLengthM,
    s.estimatedWeightKg,
    s.boundingBoxM.dx,
    s.boundingBoxM.dy,
    s.boundingBoxM.dz,
    s.boundingBoxM.maxDimM,
    s.transportable ? "CONFORME (<=12m)" : "HORS-GABARIT (>12m)",
    s.shopWeldIds.length,
    s.fieldWeldIds.length,
    s.status.toUpperCase(),
  ]);

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
}

/**
 * Rendu SVG vectoriel du symbole de soudure normalisé pour la planche d'impression
 */
export function getWeldMarkerSvg(weld: PdiWeldEntry, sizeMm: number = 3.2): string {
  const r = sizeMm / 2;
  if (weld.location === "shop") {
    // Atelier : Cercle plein vert foncé / bleu pétrole
    return `<g class="pdi-weld-marker" data-weld-id="${weld.id}">
      <circle r="${r.toFixed(2)}" fill="#ffffff" stroke="#0284c7" stroke-width="0.5"/>
      <circle r="${(r * 0.45).toFixed(2)}" fill="#0284c7"/>
    </g>`;
  } else if (weld.location === "golden") {
    // Soudure d'Or (Golden Weld / Tie-in) : Étoile dorée / double cercle
    return `<g class="pdi-weld-marker" data-weld-id="${weld.id}">
      <circle r="${(r * 1.25).toFixed(2)}" fill="#fef3c7" stroke="#d97706" stroke-width="0.6"/>
      <polygon points="0,-${r} ${r * 0.6},0 0,${r} -${r * 0.6},0" fill="#d97706"/>
    </g>`;
  } else {
    // Chantier (Field Weld) : Losange avec drapeau de montage
    const d = r * 1.15;
    return `<g class="pdi-weld-marker" data-weld-id="${weld.id}">
      <polygon points="0,-${d.toFixed(2)} ${d.toFixed(2)},0 0,${d.toFixed(2)} -${d.toFixed(2)},0" fill="#fee2e2" stroke="#dc2626" stroke-width="0.5"/>
      <line x1="0" y1="-${d.toFixed(2)}" x2="${(d * 1.5).toFixed(2)}" y2="-${(d * 2.2).toFixed(2)}" stroke="#dc2626" stroke-width="0.4"/>
      <polygon points="${(d * 1.5).toFixed(2)},-${(d * 2.2).toFixed(2)} ${(d * 2.4).toFixed(2)},-${(d * 1.8).toFixed(2)} ${(d * 1.5).toFixed(2)},-${(d * 1.4).toFixed(2)}" fill="#dc2626"/>
    </g>`;
  }
}
