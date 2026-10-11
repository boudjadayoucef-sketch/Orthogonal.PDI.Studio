/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO ENGINE — STEP 4: CANONICAL JSON COMPILER & TOPOLOGY MAPPER
 */
import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  SketchVectorEquipment
} from "./sketchRasterEngine";
import {
  isoAngleToAxis,
  AxisMappingConfig,
  DEFAULT_AXIS_MAPPING
} from "./openCvSketchDetector";
import {
  IsoNode,
  IsoSegment,
  IsoFitting,
  IsoFittingType,
  PipingLine,
  IsoDimension
} from "../isometric/types/isoGraphTypes";

export interface CompiledIsoModel {
  version: string;
  generatedAt: string;
  source: "sketch_to_iso_calque";
  metadata: {
    title: string;
    paperFormat: string;
    calibrationScalePxPerMm: number;
    totalPipesCount: number;
    totalFittingsCount: number;
    lineReference: string;
    service: string;
  };
  lines: PipingLine[];
  nodes: IsoNode[];
  segments: IsoSegment[];
  dimensions: IsoDimension[];
}

// Convert sketch fitting type to official IsoFittingType
export function mapSketchFittingTypeToIso(type: string): IsoFittingType {
  switch (type) {
    case "valve":
    case "vanne":
    case "vanne_passage_total":
      return "vanne_passage_total";
    case "vanne_opercule":
      return "vanne_opercule";
    case "vanne_soupape":
      return "vanne_soupape";
    case "vanne_boisseau":
      return "vanne_boisseau";
    case "vanne_papillon":
      return "vanne_papillon";
    case "check_valve":
    case "clapet":
    case "clapet_bille":
      return "clapet";
    case "flange":
    case "bride":
    case "bride_wn":
      return "bride_wn";
    case "bride_so":
      return "bride_so";
    case "bride_pleine":
      return "bride_pleine";
    case "elbow_90":
    case "coude_90":
      return "coude_90";
    case "elbow_45":
    case "coude_45":
      return "coude_45";
    case "tee":
    case "te_egal":
      return "te_egal";
    case "te_reduit":
      return "te_reduit";
    case "reducer":
    case "reduction_concentrique":
      return "reduction_concentrique";
    case "reduction_excentrique":
      return "reduction_excentrique";
    case "instrument":
    case "manometre":
      return "manometre";
    case "support":
    case "purge":
      return "purge";
    case "soupape":
      return "soupape";
    case "robinet_pointeau":
      return "robinet_pointeau";
    case "ballon_horizontal":
    case "vessel_horizontal":
      return "poste_sectionnement";
    case "ballon_vertical":
    case "vessel_vertical":
      return "poste_detente";
    case "pompe":
    case "pompe_centrifuge":
      return "gare_racleur_depart";
    case "echangeur":
      return "poste_coupure";
    default:
      return "vanne_passage_total";
  }
}

/**
 * Compiles sketch vector data into standard PD&I Iso JSON model.
 */
export function compileSketchToIsoModel(params: {
  nodes: SketchVectorNode[];
  segments: SketchVectorSegment[];
  fittings: SketchVectorFitting[];
  equipment?: SketchVectorEquipment[];
  calibrationScale: number; // px per mm
  title?: string;
  paperFormat?: string;
  lineReference?: string;
  service?: string;
  axisMapping?: AxisMappingConfig;
}): CompiledIsoModel {
  const {
    nodes,
    segments,
    fittings,
    equipment = [],
    calibrationScale,
    title = "Ligne Extraite de Croquis",
    paperFormat = "A4_LANDSCAPE",
    lineReference = "L-SKETCH-01",
    service = "PROC-CHIM",
    axisMapping = DEFAULT_AXIS_MAPPING
  } = params;

  const scale = calibrationScale > 0 ? calibrationScale : 1;
  const lineId = `line_${Date.now()}`;

  // 1. Create Default Piping Line
  const defaultLine: PipingLine = {
    id: lineId,
    lineNumber: lineReference,
    service: service,
    dn: segments[0]?.nominalDiameter || 150,
    nps: `${Math.round((segments[0]?.nominalDiameter || 150) / 25.4)}"`,
    material: segments[0]?.material || "Acier API 5L Gr. B",
    pressureClass: segments[0]?.pressureClass || "Class 300",
    color: "#0284C7"
  };

  // 2. Map Nodes (Convert pixel coordinates to isometric world coordinate system in meters)
  // In the PD&I isometric engine, 1 world unit = 1 meter, and projection scale is 28 px/m * zoom.
  // Standard sketch canvas coordinates (typically 0-1200px) are mapped to meters (~0-10m).
  const minX = nodes.length > 0 ? Math.min(...nodes.map((n) => n.x)) : 0;
  const minY = nodes.length > 0 ? Math.min(...nodes.map((n) => n.y)) : 0;

  // Conversion factor from sketch px to world meters:
  // Default calibration scale is ~0.25 px/mm = 250 px/m, or if uncalibrated, 100 px ≈ 1 m.
  const pxPerMeter = scale > 0 ? (scale >= 1 ? scale : scale * 1000) : 100;

  // 2. Map Nodes using multi-component isometric 3D pipe routing
  // Convert sketch segments and angles to true 3D orthogonal coordinates (in meters)
  const nodeCoords3D = new Map<string, { x: number; y: number; z: number }>();

  if (nodes.length > 0) {
    // Build adjacency list for connected components exploration
    const adj = new Map<
      string,
      Array<{ nextId: string; seg: SketchVectorSegment; isForward: boolean }>
    >();
    for (const node of nodes) {
      adj.set(node.id, []);
    }
    for (const seg of segments) {
      if (adj.has(seg.fromNodeId)) {
        adj.get(seg.fromNodeId)!.push({ nextId: seg.toNodeId, seg, isForward: true });
      }
      if (adj.has(seg.toNodeId)) {
        adj.get(seg.toNodeId)!.push({ nextId: seg.fromNodeId, seg, isForward: false });
      }
    }

    const visitedNodes = new Set<string>();

    // Traverse every connected component separately to maintain geometric 3D consistency
    for (const rootNode of nodes) {
      if (visitedNodes.has(rootNode.id)) continue;

      const outgoing = adj.get(rootNode.id) || [];
      if (outgoing.length === 0) {
        // Isolated node without segments
        visitedNodes.add(rootNode.id);
        nodeCoords3D.set(rootNode.id, {
          x: Number(((rootNode.x - minX) / pxPerMeter).toFixed(3)),
          y: Number(((rootNode.y - minY) / pxPerMeter).toFixed(3)),
          z: Number(((rootNode.elevation || 0) / 1000).toFixed(3))
        });
        continue;
      }

      // New connected component found
      // Local origin of this component is initialized with its screen-space offset in meters
      const C30 = Math.cos(Math.PI / 6);
      const S30 = 0.5; // sin(30°)
      const rootZ = Number(((rootNode.elevation || 0) / 1000).toFixed(3));
      const sxM = (rootNode.x - minX) / pxPerMeter;
      const syM = (rootNode.y - minY) / pxPerMeter; // Y écran positif vers le bas (aligné sur isoProjectV4)
      const compOffsetX = Number((0.5 * (sxM / C30 + (syM + rootZ) / S30)).toFixed(3));
      const compOffsetY = Number((0.5 * ((syM + rootZ) / S30 - sxM / C30)).toFixed(3));
      const compOffsetZ = rootZ;

      visitedNodes.add(rootNode.id);
      nodeCoords3D.set(rootNode.id, {
        x: compOffsetX,
        y: compOffsetY,
        z: compOffsetZ
      });

      // BFS propagation along segments within this connected component
      const queue = [rootNode.id];

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currCoord = nodeCoords3D.get(currId)!;
        const edges = adj.get(currId) || [];

        for (const { nextId, seg, isForward } of edges) {
          if (!visitedNodes.has(nextId)) {
            visitedNodes.add(nextId);
            queue.push(nextId);

            const fromN = nodes.find((n) => n.id === currId);
            const nextN = nodes.find((n) => n.id === nextId);

            const lenM = seg.lengthMm
              ? seg.lengthMm / 1000
              : (fromN && nextN ? Math.hypot(nextN.x - fromN.x, nextN.y - fromN.y) / pxPerMeter : 1.0);

            const ang = seg.angleIsoDeg !== undefined
              ? (isForward ? seg.angleIsoDeg : (seg.angleIsoDeg + 180) % 360)
              : 330;

            const { axis } = isoAngleToAxis(ang, axisMapping);
            let dx = 0, dy = 0, dz = 0;

            // Détermination du sens (+ ou -) selon la direction principale de l'axe dans le mapping
            const primary = axisMapping[axis]?.[0] ?? (axis === "X" ? 330 : axis === "Y" ? 210 : 90);
            let diff = Math.abs(ang - primary);
            if (diff > 180) diff = 360 - diff;
            const sign = diff < 60 ? 1 : -1;

            if (axis === "Z") {
              dz = sign * lenM;
            } else if (axis === "X") {
              dx = sign * lenM;
            } else {
              // axis === "Y"
              dy = sign * lenM;
            }

            const targetZ = currCoord.z + dz;

            nodeCoords3D.set(nextId, {
              x: Number((currCoord.x + dx).toFixed(3)),
              y: Number((currCoord.y + dy).toFixed(3)),
              z: Number(targetZ.toFixed(3))
            });
          }
        }
      }
    }
  }

  // Map equipment items: attach to existing nodes or create standalone equipment nodes
  const additionalNodes: IsoNode[] = [];
  const assignedEquipmentMap = new Map<string, SketchVectorEquipment>();

  if (Array.isArray(equipment) && equipment.length > 0) {
    for (const eq of equipment) {
      if (eq.nodeId && nodes.some((n) => n.id === eq.nodeId)) {
        assignedEquipmentMap.set(eq.nodeId, eq);
      } else if (eq.x !== undefined && eq.y !== undefined) {
        // Find closest node within 30px
        let nearestNode: SketchVectorNode | null = null;
        let minDist = 30;
        for (const n of nodes) {
          const d = Math.hypot(n.x - eq.x, n.y - eq.y);
          if (d < minDist) {
            minDist = d;
            nearestNode = n;
          }
        }

        if (nearestNode) {
          assignedEquipmentMap.set(nearestNode.id, eq);
        } else {
          // Dedicated node for standalone equipment
          const eqNodeId = eq.id || `eq_node_${additionalNodes.length + 1}`;
          additionalNodes.push({
            id: eqNodeId,
            name: eq.tag || eq.label || `EQ-${additionalNodes.length + 1}`,
            x: Number(((eq.x - minX) / pxPerMeter).toFixed(3)),
            y: Number(((eq.y - minY) / pxPerMeter).toFixed(3)),
            z: 0,
            type: "normal",
            dn: segments[0]?.nominalDiameter || 150,
            equipmentType: mapSketchFittingTypeToIso(eq.type),
            equipmentLabel: eq.label || eq.tag || eq.type,
            tag: eq.tag,
            material: defaultLine.material,
            pn: defaultLine.pressureClass,
            lineId: lineId
          });
        }
      }
    }
  }

  const isoNodes: IsoNode[] = nodes.map((node, index) => {
    // Check if node is an elbow or tee based on connectivity
    const connectedSegs = segments.filter(
      (s) => s.fromNodeId === node.id || s.toNodeId === node.id
    );

    let nodeType: IsoNode["type"] = "normal";
    if (connectedSegs.length >= 3) {
      nodeType = "tee";
    }

    // Check if any fitting or equipment is assigned directly to this node
    const nodeFitting = fittings.find((f) => f.nodeId === node.id);
    const nodeEq = assignedEquipmentMap.get(node.id);

    const coords = nodeCoords3D.get(node.id) || {
      x: Number(((node.x - minX) / pxPerMeter).toFixed(3)),
      y: Number(((node.y - minY) / pxPerMeter).toFixed(3)),
      z: Number(((node.elevation || 0) / 1000).toFixed(3))
    };

    let eqType = nodeFitting
      ? mapSketchFittingTypeToIso(nodeFitting.type)
      : nodeEq
      ? mapSketchFittingTypeToIso(nodeEq.type)
      : node.equipmentType
      ? mapSketchFittingTypeToIso(node.equipmentType)
      : undefined;

    if (nodeType === "tee" && !eqType) {
      eqType = "te_egal";
    }

    if (!eqType && connectedSegs.length === 2) {
      const seg1 = connectedSegs[0];
      const seg2 = connectedSegs[1];
      const ang1 = seg1.angleIsoDeg ?? 0;
      const ang2 = seg2.angleIsoDeg ?? 0;
      const diff = Math.abs(ang1 - ang2) % 180;
      if (diff > 15 && diff < 165) {
        eqType = "coude_90";
      }
    }

    const eqLabel =
      nodeFitting?.label ||
      nodeEq?.label ||
      nodeEq?.tag ||
      node.equipmentLabel ||
      (node.equipmentType ? node.label || node.equipmentType : undefined);

    return {
      id: node.id,
      name: `N-${index + 1}`,
      x: coords.x,
      y: coords.y,
      z: coords.z,
      type: nodeType,
      dn: node.dn || segments[0]?.nominalDiameter || 150,
      equipmentType: eqType,
      equipmentLabel: eqLabel,
      tag: nodeEq?.tag,
      material: defaultLine.material,
      pn: defaultLine.pressureClass,
      lineId: lineId
    };
  });

  const allIsoNodes = [...isoNodes, ...additionalNodes];

  // 3. Map Segments (Pipes) and attach inline fittings
  const dimensions: CompiledIsoModel["dimensions"] = [];

  const isoSegments: IsoSegment[] = segments.map((seg, index) => {
    const fromN = nodes.find((n) => n.id === seg.fromNodeId);
    const toN = nodes.find((n) => n.id === seg.toNodeId);

    let computedLength = seg.lengthMm ? seg.lengthMm / 1000 : 0;
    if (!computedLength && fromN && toN) {
      const distPx = Math.hypot(toN.x - fromN.x, toN.y - fromN.y);
      computedLength = Number((distPx / pxPerMeter).toFixed(3));
    }
    if (!computedLength || computedLength <= 0) computedLength = 1.0;

    // Find fittings attached to this segment
    const segFittings = fittings.filter((f) => f.segmentId === seg.id);
    const mappedFittings: IsoFitting[] = segFittings.map((fit, fitIdx) => {
      return {
        id: fit.id,
        type: mapSketchFittingTypeToIso(fit.type),
        label: fit.label || `ACC-${index + 1}.${fitIdx + 1}`,
        localPosition: 0.5,
        cumulativePosition: Number((computedLength * 0.5).toFixed(3)),
        dn: fit.nominalDiameter || seg.nominalDiameter || 150,
        pn: seg.pressureClass || defaultLine.pressureClass,
        material: seg.material || defaultLine.material
      };
    });

    // Add dimension annotation conforming to IsoDimension
    if (fromN && toN) {
      const displayMm = Math.round(computedLength * 1000);
      dimensions.push({
        id: `dim_${seg.id}`,
        type: "distance",
        a: { kind: "node", nodeId: seg.fromNodeId },
        b: { kind: "node", nodeId: seg.toNodeId },
        unit: "mm",
        label: `${displayMm}`,
        offset: { x: 0, y: -20 },
        locked: false
      });
    }

    return {
      id: seg.id,
      fromNodeId: seg.fromNodeId,
      toNodeId: seg.toNodeId,
      dn: seg.nominalDiameter || 150,
      pn: seg.pressureClass || "Class 300",
      material: seg.material || "Acier API 5L Gr. B",
      length: computedLength,
      type: "straight",
      lineId: lineId,
      fittings: mappedFittings
    };
  });

  return {
    version: "PD&I-ISO-4.8d",
    generatedAt: new Date().toISOString(),
    source: "sketch_to_iso_calque",
    metadata: {
      title,
      paperFormat,
      calibrationScalePxPerMm: scale,
      totalPipesCount: isoSegments.length,
      totalFittingsCount:
        fittings.length + (Array.isArray(equipment) ? equipment.length : 0),
      lineReference,
      service
    },
    lines: [defaultLine],
    nodes: allIsoNodes,
    segments: isoSegments,
    dimensions
  };
}
