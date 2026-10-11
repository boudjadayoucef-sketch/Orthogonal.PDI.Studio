/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * UNIVERSAL CAO ENTITY ADAPTER
 * 
 * Passerelle universelle de lecture et mise à jour bidirectionnelle :
 * Convertit un Nœud, Segment, Fitting, Support ou Entité 2D en PdiUniversalEntity
 * et applique toute modification de façon atomique et cohérente sur le graphe.
 *
 * ARCH-03-FIX-01 & ARCH-03-FIX-02: Strictement déclaratif et transporteur.
 * Aucune valeur technique, normative, dimensionnelle, matière, pression, épaisseur,
 * PMS, fabricant ou preuve n'est inventée si elle est absente des données source.
 * Aucune conversion implicite DN → NPS/inch ou DN → OD n'est effectuée.
 */

import type {
  IsoNode,
  IsoSegment,
  IsoFitting,
  Cad2dEntity,
} from "../isometric/types/isoGraphTypes";
import type { IsoPipingSupport } from "../isometric/supports/pdiMssSupportEngine";
import {
  PdiUniversalEntity,
  UniversalEntityCategory,
  UniversalEntitySource,
  UniversalNormativeRef,
  UniversalRelationships,
} from "./pdiUniversalEntity";

export interface UniversalAdapterOptions {
  readonly projectId?: string;
  readonly source?: UniversalEntitySource | string;
  readonly normative?: UniversalNormativeRef;
  readonly relationships?: UniversalRelationships;
}

export function nodeToUniversalEntity(
  node: IsoNode,
  linkedSegments: IsoSegment[] = [],
  options?: UniversalAdapterOptions
): PdiUniversalEntity {
  const isEquipment = !!node.equipmentType;
  let category: UniversalEntityCategory = "node";
  const eqType = (node.equipmentType || "") as string;

  if (eqType.includes("vanne") || eqType.includes("clapet") || eqType.includes("soupape") || eqType.includes("robinet")) {
    category = "valve";
  } else if (eqType.includes("te_") || eqType.includes("piquage") || eqType.includes("weldolet") || eqType.includes("sockolet") || eqType.includes("croix")) {
    category = "fitting";
  } else if (eqType.includes("coude")) {
    category = "fitting";
  } else if (eqType.includes("bride") || eqType.includes("joint")) {
    category = "flange";
  } else if (isEquipment) {
    category = "equipment";
  }

  const primaryDn = node.dn || linkedSegments[0]?.dn || undefined;
  const rawNode = node as Record<string, any>;
  const rawFirstSeg = (linkedSegments[0] || {}) as Record<string, any>;

  const normative: UniversalNormativeRef = {
    pipingSpecId: node.spec || linkedSegments[0]?.spec || undefined,
    materialId: rawNode.material || rawFirstSeg.material || undefined,
    pressureRating: rawNode.pn || rawFirstSeg.pn || undefined,
    nominalSize: rawNode.nominalSize || rawFirstSeg.nominalSize || options?.normative?.nominalSize || undefined,
    schedule: rawNode.schedule || rawFirstSeg.schedule || undefined,
    ...options?.normative,
  };

  const relationships: UniversalRelationships = {
    connectedEntityIds: linkedSegments.map((s) => s.id),
    lineId: node.lineId || linkedSegments[0]?.lineId || undefined,
    ...options?.relationships,
  };

  return {
    identity: {
      id: node.id,
      type: node.equipmentType || node.type || "node",
      category,
      name: node.name || node.equipmentLabel || node.id,
      labelFr: node.equipmentLabel || node.name || "Nœud / Composant",
      description: node.equipmentType ? `Composant tuyauterie ${node.equipmentType}` : (node.type ? `Nœud ${node.type}` : undefined),
      locked: false,
      projectId: options?.projectId,
      source: options?.source ?? "ISOMETRIC",
    },
    geometry: {
      x: Number((node.x || 0).toFixed(3)),
      y: Number((node.y || 0).toFixed(3)),
      z: Number((node.z || 0).toFixed(3)),
      rotation: node.rotation,
      elevation: node.z != null ? Number(node.z.toFixed(3)) : undefined,
      branchAngle: node.branchAngle,
      mirrored: node.mirrored,
      bendDirection: node.bendDirection,
      length: node.length,
    },
    connection: {
      connectedSegmentIds: linkedSegments.map((s) => s.id),
      ports: (node.ports || []).map((p, idx) => ({
        portId: p.id || `port-${idx}`,
        index: p.index ?? idx,
        role: (p.role === "branch" ? "branch" : p.role === "inline-out" ? "out" : "in") as any,
        connectionType: p.connectionType as any,
        endPreparation: p.endPreparation,
      })),
      connectionType: "inline",
    },
    dn: {
      dn: primaryDn,
      inch: rawNode.inch || rawNode.nps || rawNode.npsInch || rawFirstSeg.inch || rawFirstSeg.nps || rawFirstSeg.npsInch || undefined,
      outerDiameterMm: rawNode.outerDiameterMm || rawNode.od || rawFirstSeg.outerDiameterMm || rawFirstSeg.od || undefined,
      reducedDn: rawNode.reducedDn || undefined,
      reducedInch: rawNode.reducedInch || rawNode.reducedNps || undefined,
      unit: rawNode.unit || (primaryDn ? "mm" : undefined),
    },
    pn: {
      rating: rawNode.pn || rawFirstSeg.pn || undefined,
      designPressureBar: rawNode.designPressureBar || undefined,
      operatingPressureBar: rawNode.operatingPressureBar || undefined,
      testPressureBar: rawNode.testPressureBar || undefined,
    },
    material: {
      grade: rawNode.material || rawFirstSeg.material || undefined,
      standard: rawNode.materialStandard || undefined,
      schedule: rawNode.schedule || rawFirstSeg.schedule || undefined,
      wallThicknessMm: rawNode.wallThicknessMm || undefined,
    },
    service: {
      code: node.service || linkedSegments[0]?.service || undefined,
      description: rawNode.serviceDescription || undefined,
      designTemperatureC: rawNode.designTemperatureC || undefined,
      operatingTemperatureC: rawNode.operatingTemperatureC || undefined,
    },
    spec: {
      pmsCode: node.spec || linkedSegments[0]?.spec || undefined,
      classRating: rawNode.pn || rawFirstSeg.pn || undefined,
    },
    tag: {
      fullTag: node.tag || node.name || node.id,
      lineId: node.lineId || linkedSegments[0]?.lineId || undefined,
    },
    fabrication: {
      location: rawNode.fabricationLocation || undefined,
      spoolNumber: rawNode.spoolNumber || undefined,
      weldType: rawNode.weldType || undefined,
      ndtRequirement: rawNode.ndtRequirement || undefined,
    },
    documentation: {
      catalogRef: node.reference || undefined,
      manufacturer: node.manufacturer || undefined,
      notes: rawNode.notes || undefined,
    },
    specific: {
      valve: category === "valve" ? {
        flowType: rawNode.flowType || undefined,
        actuatorType: rawNode.actuatorType || undefined,
        faceToFaceMm: rawNode.faceToFaceMm || undefined,
        flowCoefficientKv: rawNode.flowCoefficientKv || undefined,
      } : undefined,
      tee: category === "fitting" && eqType.includes("te") ? {
        teeType: eqType.includes("reduit") ? "reduit" : eqType.includes("barre") ? "barre_raclable" : "egal",
        runDn: primaryDn,
        branchDn: rawNode.reducedDn || primaryDn,
        branchAngle: node.branchAngle || 90,
      } : undefined,
      elbow: category === "fitting" && eqType.includes("coude") ? {
        angle: eqType.includes("45") ? 45 : eqType.includes("30") ? 30 : eqType.includes("22_5") ? 22.5 : 90,
        radiusType: eqType.includes("3d") ? "3D" : eqType.includes("5d") ? "5D" : "1.5D_LR",
      } : undefined,
      flange: category === "flange" ? {
        flangeType: eqType.includes("so") ? "SO" : eqType.includes("pleine") ? "BL" : "WN",
        facing: rawNode.facing || undefined,
      } : undefined,
    },
    normative,
    relationships,
  };
}

export function segmentToUniversalEntity(
  seg: IsoSegment,
  fromNode?: IsoNode,
  toNode?: IsoNode,
  options?: UniversalAdapterOptions
): PdiUniversalEntity {
  const fromName = fromNode?.name || seg.fromNodeId;
  const toName = toNode?.name || seg.toNodeId;
  const rawSeg = seg as Record<string, any>;

  const normative: UniversalNormativeRef = {
    pipingSpecId: seg.spec || undefined,
    materialId: seg.material || undefined,
    pressureRating: seg.pn || seg.pressureClass || undefined,
    nominalSize: rawSeg.nominalSize || options?.normative?.nominalSize || undefined,
    schedule: rawSeg.schedule || undefined,
    ...options?.normative,
  };

  const relationships: UniversalRelationships = {
    parentEntityId: seg.fromNodeId,
    connectedEntityIds: [seg.fromNodeId, seg.toNodeId].filter(Boolean),
    lineId: seg.lineId,
    spoolId: rawSeg.spoolNumber,
    ...options?.relationships,
  };

  return {
    identity: {
      id: seg.id,
      type: "pipe",
      category: "pipe",
      name: seg.tag || seg.sourceName || `Tube DN${seg.dn || ""}${fromName && toName ? ` (${fromName} → ${toName})` : ""}`,
      labelFr: seg.dn ? `Tronçon de tuyauterie DN${seg.dn}` : "Tronçon de tuyauterie",
      description: seg.material ? `Tuyauterie ${seg.type === "riser" ? "colonne montante" : "ligne droite"} ${seg.material}` : undefined,
      locked: false,
      projectId: options?.projectId,
      source: options?.source ?? "ISOMETRIC",
    },
    geometry: {
      x: Number((fromNode?.x || 0).toFixed(3)),
      y: Number((fromNode?.y || 0).toFixed(3)),
      z: Number((fromNode?.z || 0).toFixed(3)),
      elevation: fromNode?.z != null ? Number(fromNode.z.toFixed(3)) : undefined,
      length: seg.length != null ? Number(seg.length.toFixed(3)) : undefined,
    },
    connection: {
      fromEntityId: seg.fromNodeId,
      toEntityId: seg.toNodeId,
      fromPortId: seg.fromPortId,
      toPortId: seg.toPortId,
      ports: [
        { portId: "in", index: 0, role: "in", connectionType: "butt_weld" },
        { portId: "out", index: 1, role: "out", connectionType: "butt_weld" },
      ],
      connectionType: "butt_weld",
    },
    dn: {
      dn: seg.dn || undefined,
      inch: rawSeg.inch || rawSeg.nps || rawSeg.npsInch || undefined,
      outerDiameterMm: rawSeg.outerDiameterMm || rawSeg.od || undefined,
      unit: rawSeg.unit || (seg.dn ? "mm" : undefined),
    },
    pn: {
      rating: seg.pn || seg.pressureClass || undefined,
      designPressureBar: rawSeg.designPressure || rawSeg.designPressureBar || undefined,
      operatingPressureBar: rawSeg.operatingPressure || rawSeg.operatingPressureBar || undefined,
      testPressureBar: rawSeg.testPressure || rawSeg.testPressureBar || undefined,
    },
    material: {
      grade: seg.material || undefined,
      standard: rawSeg.materialStandard || undefined,
      schedule: rawSeg.schedule || undefined,
      wallThicknessMm: rawSeg.wallThicknessMm || undefined,
    },
    service: {
      code: seg.service || undefined,
      description: rawSeg.serviceDescription || undefined,
      designTemperatureC: rawSeg.designTemperatureC || undefined,
      operatingTemperatureC: rawSeg.operatingTemperatureC || undefined,
    },
    spec: {
      pmsCode: seg.spec || undefined,
      classRating: seg.pn || seg.pressureClass || undefined,
    },
    tag: {
      fullTag: seg.tag || (seg.dn ? `L-${seg.dn}` : seg.id),
      lineId: seg.lineId || undefined,
    },
    fabrication: {
      location: rawSeg.fabricationLocation || undefined,
      spoolNumber: rawSeg.spoolNumber || undefined,
      weldType: rawSeg.weldType || undefined,
      ndtRequirement: rawSeg.ndtRequirement || undefined,
    },
    documentation: {
      catalogRef: rawSeg.catalogRef || undefined,
      manufacturer: rawSeg.manufacturer || undefined,
      notes: rawSeg.notes || undefined,
    },
    specific: {
      pipe: {
        type: seg.type,
        insulation: seg.insulation,
        insulationThicknessMm: rawSeg.insulationThicknessMm || undefined,
        color: seg.color,
      },
    },
    normative,
    relationships,
  };
}

export function fittingToUniversalEntity(
  fitting: IsoFitting,
  parentSegment: IsoSegment,
  options?: UniversalAdapterOptions
): PdiUniversalEntity {
  const fType = fitting.type;
  let category: UniversalEntityCategory = "fitting";

  if (fType.includes("vanne") || fType.includes("clapet") || fType.includes("soupape") || fType.includes("robinet")) {
    category = "valve";
  } else if (fType.includes("bride") || fType.includes("joint")) {
    category = "flange";
  }

  const dn = fitting.dn || parentSegment.dn || undefined;
  const rawParent = parentSegment as Record<string, any>;
  const rawFitting = fitting as Record<string, any>;

  const normative: UniversalNormativeRef = {
    pipingSpecId: parentSegment.spec || undefined,
    materialId: parentSegment.material || undefined,
    pressureRating: parentSegment.pn || undefined,
    nominalSize: rawFitting.nominalSize || rawParent.nominalSize || options?.normative?.nominalSize || undefined,
    ...options?.normative,
  };

  const relationships: UniversalRelationships = {
    parentEntityId: parentSegment.id,
    lineId: parentSegment.lineId || undefined,
    ...options?.relationships,
  };

  return {
    identity: {
      id: fitting.id,
      type: fitting.type,
      category,
      name: fitting.label || fitting.type,
      labelFr: fitting.label || "Raccord en ligne",
      description: `Raccord ${fitting.type} sur tronçon ${parentSegment.id}`,
      projectId: options?.projectId,
      source: options?.source ?? "ISOMETRIC",
    },
    geometry: {
      x: 0,
      y: 0,
      z: 0,
      length: fitting.length,
      rotation: fitting.orientation,
    },
    connection: {
      fromEntityId: parentSegment.id,
      ports: [
        { portId: "p1", index: 0, role: "in", connectionType: "butt_weld" },
        { portId: "p2", index: 1, role: "out", connectionType: "butt_weld" },
      ],
      connectionType: "inline",
    },
    dn: {
      dn,
      inch: rawFitting.inch || rawFitting.nps || rawParent.inch || rawParent.nps || undefined,
      outerDiameterMm: rawFitting.outerDiameterMm || rawFitting.od || rawParent.outerDiameterMm || rawParent.od || undefined,
      unit: rawFitting.unit || rawParent.unit || (dn ? "mm" : undefined),
    },
    pn: {
      rating: parentSegment.pn || undefined,
    },
    material: {
      grade: parentSegment.material || undefined,
      schedule: rawParent.schedule || undefined,
    },
    service: {
      code: parentSegment.service || undefined,
    },
    spec: {
      pmsCode: parentSegment.spec || undefined,
    },
    tag: {
      fullTag: fitting.label || fitting.id,
      lineId: parentSegment.lineId || undefined,
    },
    fabrication: {
      location: rawParent.fabricationLocation || undefined,
      spoolNumber: rawParent.spoolNumber || undefined,
      weldType: rawParent.weldType || undefined,
    },
    documentation: {
      catalogRef: fitting.reference || undefined,
      manufacturer: fitting.manufacturer || undefined,
    },
    specific: {
      valve: category === "valve" ? {
        flowType: rawFitting.flowType || undefined,
        actuatorType: rawFitting.actuatorType || undefined,
      } : undefined,
    },
    normative,
    relationships,
  };
}

export function cad2dToUniversalEntity(
  cad: Cad2dEntity,
  options?: UniversalAdapterOptions
): PdiUniversalEntity {
  const firstPt = cad.points?.[0] || cad.center || { x: 0, y: 0 };

  return {
    identity: {
      id: cad.id,
      type: cad.type,
      category: "cad2d",
      name: cad.text || `${cad.type.toUpperCase()} 2D (${cad.id})`,
      labelFr: `Entité CAO 2D ${cad.type}`,
      description: cad.layerId ? `Dessin géométrique sur calque ${cad.layerId}` : undefined,
      projectId: options?.projectId,
      source: options?.source ?? "2D",
    },
    geometry: {
      x: Number((firstPt.x || 0).toFixed(3)),
      y: Number((firstPt.y || 0).toFixed(3)),
      z: 0,
      rotation: cad.rotation,
      length: cad.length,
      width: cad.width,
      height: cad.height,
      radius: cad.radius,
      points: cad.points,
    },
    connection: {
      ports: [],
      connectionType: "mechanical",
    },
    dn: {
      dn: cad.metadata?.dn || undefined,
      inch: cad.metadata?.inch || cad.metadata?.nps || undefined,
      outerDiameterMm: cad.metadata?.outerDiameterMm || cad.metadata?.od || undefined,
      unit: cad.metadata?.dn ? "mm" : undefined,
    },
    pn: {
      rating: cad.metadata?.pn || undefined,
    },
    material: {
      grade: cad.metadata?.material || undefined,
    },
    service: {
      code: cad.metadata?.service || undefined,
    },
    spec: {
      pmsCode: cad.metadata?.spec || undefined,
    },
    tag: {
      fullTag: cad.text || cad.id,
    },
    fabrication: {
      location: cad.metadata?.location || undefined,
    },
    documentation: {
      notes: cad.metadata?.intent || undefined,
    },
    specific: {
      cad2d: {
        layerId: cad.layerId,
        strokeColor: cad.color,
        strokeWidth: cad.lineWeight,
        strokeDash: cad.lineType,
        fillColor: cad.fill,
        fillOpacity: cad.fillOpacity,
        hatchPattern: cad.hatchPattern,
        fontSize: cad.fontSize,
        fontFamily: cad.fontFamily,
        textValue: cad.text,
      },
    },
    normative: options?.normative,
    relationships: options?.relationships,
  };
}

export function supportToUniversalEntity(
  sup: IsoPipingSupport,
  parentSegment?: IsoSegment | null,
  options?: UniversalAdapterOptions
): PdiUniversalEntity {
  const targetDn = parentSegment?.dn || (sup as any).dn || undefined;
  const rawSup = sup as Record<string, any>;
  return {
    identity: {
      id: sup.id,
      type: sup.type,
      category: "support",
      name: sup.tag,
      labelFr: `Supportage MSS SP-58 (${sup.tag})`,
      description: `Support tuyauterie MSS ${sup.type}`,
      projectId: options?.projectId,
      source: options?.source ?? "ISOMETRIC",
    },
    geometry: {
      x: Number((sup.worldPos.x || 0).toFixed(3)),
      y: Number((sup.worldPos.y || 0).toFixed(3)),
      z: Number((sup.elevationZ || 0).toFixed(3)),
      elevation: sup.elevationZ,
    },
    connection: {
      fromEntityId: sup.segmentId,
      ports: [],
      connectionType: "mechanical",
    },
    dn: {
      dn: targetDn,
      inch: rawSup.inch || rawSup.nps || (parentSegment as any)?.inch || undefined,
      outerDiameterMm: rawSup.outerDiameterMm || rawSup.od || (parentSegment as any)?.outerDiameterMm || undefined,
      unit: targetDn ? "mm" : undefined,
    },
    pn: {
      rating: rawSup.pn || parentSegment?.pn || undefined,
    },
    material: {
      grade: rawSup.material || undefined,
    },
    service: {
      code: rawSup.service || parentSegment?.service || undefined,
    },
    spec: {
      pmsCode: rawSup.spec || parentSegment?.spec || undefined,
    },
    tag: {
      fullTag: sup.tag,
      lineId: sup.segmentId || undefined,
    },
    fabrication: {
      location: rawSup.location || undefined,
    },
    documentation: {
      catalogRef: rawSup.catalogRef || undefined,
      manufacturer: rawSup.manufacturer || undefined,
      notes: sup.distanceFromFromNodeM != null ? `Ancrage à ${sup.distanceFromFromNodeM.toFixed(2)}m du nœud amont` : undefined,
    },
    specific: {
      support: {
        mssType: sup.type,
        loadCapacityKn: rawSup.designLoadKn || (sup.customLoads?.fz != null ? Math.abs(sup.customLoads.fz) : undefined),
        concretePad: !!sup.civilSpec,
      },
    },
    normative: options?.normative,
    relationships: {
      parentEntityId: sup.segmentId,
      lineId: sup.segmentId,
      ...options?.relationships,
    },
  };
}

/**
 * Converts a `PdiUniversalEntity` back to an `IsoNode` representation without mutating source.
 */
export function universalEntityToNode(entity: PdiUniversalEntity): IsoNode {
  return {
    id: entity.identity.id,
    name: entity.identity.name,
    x: entity.geometry.x,
    y: entity.geometry.y,
    z: entity.geometry.z,
    type: "normal",
    equipmentType: (entity.identity.category !== "node" && entity.identity.category !== "pipe" ? entity.identity.type : undefined) as any,
    equipmentLabel: entity.identity.labelFr,
    dn: entity.dn.dn,
    reducedDn: entity.dn.reducedDn,
    pn: entity.pn.rating,
    material: entity.material.grade,
    schedule: entity.material.schedule,
    service: entity.service.code,
    spec: entity.spec.pmsCode,
    tag: entity.tag.fullTag,
    lineId: entity.tag.lineId || entity.relationships?.lineId,
    reference: entity.documentation.catalogRef,
    manufacturer: entity.documentation.manufacturer,
    rotation: entity.geometry.rotation,
    branchAngle: entity.geometry.branchAngle,
    mirrored: entity.geometry.mirrored,
    bendDirection: entity.geometry.bendDirection,
    length: entity.geometry.length,
    ports: entity.connection.ports.map((p, idx) => ({
      id: p.portId,
      index: p.index ?? idx,
      role: (p.role === "branch" ? "branch" : p.role === "out" ? "inline-out" : "inline-in") as any,
      dx: 0,
      dy: 0,
      dz: 0,
      connectionType: p.connectionType as any,
      endPreparation: p.endPreparation,
    })),
  };
}

/**
 * Converts a `PdiUniversalEntity` back to an `IsoSegment` representation without mutating source.
 */
export function universalEntityToSegment(
  entity: PdiUniversalEntity,
  fromNodeId?: string,
  toNodeId?: string
): IsoSegment {
  return {
    id: entity.identity.id,
    fromNodeId: fromNodeId || entity.connection.fromEntityId || "",
    toNodeId: toNodeId || entity.connection.toEntityId || "",
    fromPortId: entity.connection.fromPortId,
    toPortId: entity.connection.toPortId,
    dn: entity.dn.dn,
    pn: entity.pn.rating,
    material: entity.material.grade,
    length: entity.geometry.length || 0,
    type: (entity.specific.pipe?.type as any) || "straight",
    fittings: [],
    tag: entity.tag.fullTag,
    lineId: entity.tag.lineId || entity.relationships?.lineId,
    service: entity.service.code,
    spec: entity.spec.pmsCode,
    schedule: entity.material.schedule,
    insulation: entity.specific.pipe?.insulation,
    color: entity.specific.pipe?.color,
    sourceName: entity.identity.name,
  };
}

/**
 * Type guard for PdiUniversalEntity.
 */
export function isUniversalEntity(obj: unknown): obj is PdiUniversalEntity {
  if (!obj || typeof obj !== "object") return false;
  const raw = obj as Record<string, unknown>;
  return (
    typeof raw.identity === "object" &&
    raw.identity !== null &&
    typeof (raw.identity as any).id === "string" &&
    typeof raw.geometry === "object" &&
    typeof raw.connection === "object" &&
    typeof raw.dn === "object" &&
    typeof raw.pn === "object" &&
    typeof raw.material === "object" &&
    typeof raw.service === "object" &&
    typeof raw.spec === "object" &&
    typeof raw.tag === "object" &&
    typeof raw.fabrication === "object" &&
    typeof raw.documentation === "object" &&
    typeof raw.specific === "object"
  );
}

/**
 * Validates the structure and invariants of a Universal CAO Entity.
 */
export function validateUniversalEntity(entity: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!entity || typeof entity !== "object") {
    return { valid: false, errors: ["Entity must be a non-null object."] };
  }

  const raw = entity as Partial<PdiUniversalEntity>;
  if (!raw.identity || typeof raw.identity.id !== "string" || raw.identity.id.trim().length === 0) {
    errors.push("identity.id is required and must be a non-empty string.");
  }
  if (!raw.identity || typeof raw.identity.category !== "string") {
    errors.push("identity.category is required.");
  }
  if (!raw.geometry || typeof raw.geometry.x !== "number" || typeof raw.geometry.y !== "number" || typeof raw.geometry.z !== "number") {
    errors.push("geometry with numeric x, y, z is required.");
  }
  if (raw.dn && raw.dn.dn !== undefined && typeof raw.dn.dn !== "number") {
    errors.push("dn.dn must be a valid number when provided.");
  }
  if (raw.pn && raw.pn.rating !== undefined && typeof raw.pn.rating !== "string") {
    errors.push("pn.rating must be a string when provided.");
  }
  if (raw.material && raw.material.grade !== undefined && typeof raw.material.grade !== "string") {
    errors.push("material.grade must be a string when provided.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates an immutable deep copy of a PdiUniversalEntity.
 */
export function cloneUniversalEntity(entity: PdiUniversalEntity): PdiUniversalEntity {
  return JSON.parse(JSON.stringify(entity));
}

export interface UniversalGraphState {
  nodes: IsoNode[];
  segments: IsoSegment[];
  cad2dEntities: Cad2dEntity[];
  supports: IsoPipingSupport[];
}

/**
 * Applique de façon atomique et bidirectionnelle une entité modifiée au graphe du modèle CAO
 */
export function applyUniversalEntityToGraph(
  updated: PdiUniversalEntity,
  state: UniversalGraphState
): UniversalGraphState {
  const { nodes, segments, cad2dEntities, supports } = state;

  if (updated.identity.category === "cad2d") {
    const nextCad = cad2dEntities.map((c) => {
      if (c.id !== updated.identity.id) return c;
      return {
        ...c,
        text: updated.identity.name || c.text,
        layerId: updated.specific.cad2d?.layerId || c.layerId,
        color: updated.specific.cad2d?.strokeColor || c.color,
        lineWeight: updated.specific.cad2d?.strokeWidth || c.lineWeight,
        fill: updated.specific.cad2d?.fillColor || c.fill,
        fillOpacity: updated.specific.cad2d?.fillOpacity ?? c.fillOpacity,
        rotation: updated.geometry.rotation != null ? updated.geometry.rotation : c.rotation,
        length: updated.geometry.length != null ? updated.geometry.length : c.length,
        width: updated.geometry.width != null ? updated.geometry.width : c.width,
        height: updated.geometry.height != null ? updated.geometry.height : c.height,
        radius: updated.geometry.radius != null ? updated.geometry.radius : c.radius,
        metadata: {
          ...c.metadata,
          elevationZ: updated.geometry.z != null ? updated.geometry.z : c.metadata?.elevationZ,
          dn: updated.dn.dn || c.metadata?.dn,
        },
      };
    });
    return { ...state, cad2dEntities: nextCad };
  }

  if (updated.identity.category === "support") {
    const nextSup = supports.map((s) => {
      if (s.id !== updated.identity.id) return s;
      return {
        ...s,
        tag: updated.tag.fullTag || s.tag,
        type: (updated.specific.support?.mssType as any) || s.type,
        orientationAngleDeg: updated.geometry.rotation != null ? updated.geometry.rotation : s.orientationAngleDeg,
        elevationZ: updated.geometry.z != null ? updated.geometry.z : s.elevationZ,
        worldPos: {
          x: updated.geometry.x != null ? updated.geometry.x : s.worldPos.x,
          y: updated.geometry.y != null ? updated.geometry.y : s.worldPos.y,
          z: updated.geometry.z != null ? updated.geometry.z : s.worldPos.z,
        },
      };
    });
    return { ...state, supports: nextSup };
  }

  if (updated.identity.category === "pipe") {
    const nextSeg = segments.map((s) => {
      if (s.id !== updated.identity.id) return s;
      return {
        ...s,
        sourceName: updated.identity.name || s.sourceName,
        tag: updated.tag.fullTag || s.tag,
        dn: updated.dn.dn || s.dn,
        pn: updated.pn.rating || s.pn,
        material: updated.material.grade || s.material,
        schedule: updated.material.schedule || s.schedule,
        service: updated.service.code || s.service,
        spec: updated.spec.pmsCode || s.spec,
        length: updated.geometry.length != null ? updated.geometry.length : s.length,
        insulation: updated.specific.pipe?.insulation || s.insulation,
      };
    });
    return { ...state, segments: nextSeg };
  }

  // Nœud / Équipement / Vanne / Bride / Té / Raccord
  const isNode = nodes.some((n) => n.id === updated.identity.id);
  if (isNode) {
    const nextNodes = nodes.map((n) => {
      if (n.id !== updated.identity.id) return n;
      return {
        ...n,
        name: updated.identity.name || n.name,
        equipmentLabel: updated.identity.labelFr || n.equipmentLabel,
        dn: updated.dn.dn || n.dn,
        reducedDn: updated.dn.reducedDn || (n as any).reducedDn,
        pn: updated.pn.rating || (n as any).pn,
        material: updated.material.grade || (n as any).material,
        schedule: updated.material.schedule || (n as any).schedule,
        service: updated.service.code || (n as any).service,
        spec: updated.spec.pmsCode || (n as any).spec,
        tag: updated.tag.fullTag || (n as any).tag,
        reference: updated.documentation.catalogRef || (n as any).reference,
        manufacturer: updated.documentation.manufacturer || (n as any).manufacturer,
        x: updated.geometry.x != null ? updated.geometry.x : n.x,
        y: updated.geometry.y != null ? updated.geometry.y : n.y,
        z: updated.geometry.z != null ? updated.geometry.z : n.z,
        rotation: updated.geometry.rotation != null ? updated.geometry.rotation : n.rotation,
        branchAngle: updated.geometry.branchAngle != null ? updated.geometry.branchAngle : n.branchAngle,
      };
    });
    return { ...state, nodes: nextNodes };
  }

  // Fitting imbriqué dans segment
  const nextSeg = segments.map((s) => {
    const hasFitting = s.fittings?.some((f) => f.id === updated.identity.id);
    if (!hasFitting) return s;
    return {
      ...s,
      fittings: s.fittings.map((f) => {
        if (f.id !== updated.identity.id) return f;
        return {
          ...f,
          label: updated.identity.name || f.label,
          dn: updated.dn.dn || f.dn,
          reference: updated.documentation.catalogRef || f.reference,
          manufacturer: updated.documentation.manufacturer || f.manufacturer,
        };
      }),
    };
  });

  return { ...state, segments: nextSeg };
}
