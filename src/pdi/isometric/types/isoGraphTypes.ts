/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * UNAUTHORIZED COPYING, REVERSE ENGINEERING OR DISTRIBUTION IS STRICTLY PROHIBITED.
 */

import { TriangleType, ArcCreationMode } from "./../engine/CadAutocadEngine";
import type { IsoPipingSupport } from "../supports/pdiMssSupportEngine";
import type { PdiSpoolEntry, PdiWeldEntry } from "../../welding/isoWeldSpoolEngine";

export type { IsoPipingSupport };

export type IsoNodeType =
  | "normal" | "entree_poste" | "sortie_poste"
  | "piquage" | "gare_depart" | "gare_arrivee" | "tee";

export type IsoFittingType =
  | "te_egal" | "te_reduit" | "te_barre" | "croix" | "weldolet" | "threadolet" | "sockolet"
  | "reduction_concentrique" | "reduction_excentrique" | "fond_bombe"
  | "coude_90" | "coude_90_sr" | "coude_45" | "coude_30" | "coude_22_5" | "coude_3d" | "coude_5d" | "coude_180"
  | "bride_wn" | "bride_so" | "bride_pleine" | "bride_sw" | "bride_lap_joint" | "joint" | "jmi" | "diaphragme"
  | "vanne_passage_total" | "vanne_opercule" | "vanne_soupape" | "vanne_boisseau" | "vanne_papillon"
  | "clapet" | "clapet_bille" | "soupape" | "robinet_pointeau"
  | "purge" | "event" | "manometre" | "prise_pression" | "piquage"
  | "poste_sectionnement" | "poste_coupure" | "poste_detente"
  | "gare_racleur_depart" | "gare_racleur_arrivee";

export type IsoEquipmentType = IsoFittingType;
export type IsoPortRole = "inline-in" | "inline-out" | "branch" | "aux";
export type JointConnectionType = "butt_weld" | "socket_weld" | "fillet_weld" | "flanged" | "threaded" | "mechanical" | "unknown";
export const JOINT_Connection_TYPES: JointConnectionType[] = [
  "butt_weld",
  "socket_weld",
  "fillet_weld",
  "flanged",
  "threaded",
  "mechanical",
  "unknown",
];

export interface IsoPort {
  id: string;
  index: number;
  role: IsoPortRole;
  dx: number;
  dy: number;
  dz: number;
  connectedSegmentIds?: string[];
  connectionType?: JointConnectionType;
  endPreparation?: "bevel" | "plain" | "socket" | "flange_face";
}

export interface IsoNode {
  id: string;
  branchAngle?: number;
  name: string;
  x: number;
  y: number;
  z: number;
  type: IsoNodeType;
  equipmentType?: IsoEquipmentType;
  equipmentLabel?: string;
  dn?: number;
  reducedDn?: number;
  reference?: string;
  manufacturer?: string;
  rotation?: number;
  mirrored?: boolean;
  bendDirection?: 1 | -1;
  length?: number;
  ports?: IsoPort[];
  lineId?: string;
  tag?: string;
  tagFormatName?: string;
  service?: string;
  spec?: string;
  tagNumber?: number;
  pn?: string;
  material?: string;
  schedule?: string;
  wallThicknessMm?: number;
  designPressureBar?: number;
  operatingPressureBar?: number;
  designTemperatureC?: number;
  operatingTemperatureC?: number;
  spoolNumber?: string;
  fabricationLocation?: "shop" | "field" | "golden";
  notes?: string;
  flowType?: "passage_total" | "passage_reduit" | "egal";
  actuatorType?: "manuel_volant" | "manuel_levier" | "pneumatique" | "motorise_electrique" | "hydraulique";
  seatType?: "metal_metal" | "ptfe" | "stellite";
  faceToFaceMm?: number;
  flowCoefficientKv?: number;
  fireSafe?: boolean;
  teeType?: "egal" | "reduit" | "barre_raclable" | "croix" | "weldolet" | "sockolet" | "threadolet";
  runDn?: number;
  branchDn?: number;
  runLengthMm?: number;
  branchHeightMm?: number;
  elbowAngle?: number;
  elbowRadiusType?: "1.5D_LR" | "1.0D_SR" | "3D" | "5D";
  elbowRadiusMm?: number;
  flangeType?: "WN" | "SO" | "BL" | "SW" | "LJ" | "Threaded";
  flangeFacing?: "RF" | "FF" | "RTJ";
  specificProps?: any;
}

export interface IsoFitting {
  id: string;
  type: IsoFittingType;
  label: string;
  localPosition: number;
  cumulativePosition: number;
  dn?: number;
  reference?: string;
  manufacturer?: string;
  orientation?: number;
  length?: number;
  pn?: string;
  material?: string;
  schedule?: string;
  notes?: string;
  specificProps?: any;
}

export interface IsoSegment {
  id: string;
  fromNodeId: string;
  fromPortId?: string;
  toNodeId: string;
  toPortId?: string;
  dn: number;
  pn: string;
  material: string;
  length: number;
  type: "straight" | "riser" | "branch";
  fittings: IsoFitting[];
  color?: string;
  sourceName?: string;
  lineId?: string;
  tag?: string;
  tagFormatName?: string;
  service?: string;
  spec?: string;
  tagNumber?: number;
  pressureClass?: string;
  insulation?: boolean;
  lineFunction?: string;
  reducedDn?: number;
  schedule?: string;
  wallThicknessMm?: number;
  designPressureBar?: number;
  operatingPressureBar?: number;
  designTemperatureC?: number;
  operatingTemperatureC?: number;
  spoolNumber?: string;
  fabricationLocation?: "shop" | "field" | "golden";
  notes?: string;
  slopePercent?: number;
  slopeDirection?: "up" | "down";
  insulationThicknessMm?: number;
  insulationType?: string;
  specificProps?: any;
}

export interface PipingLine {
  id: string;
  lineNumber?: string;
  service?: string;
  dn?: number;
  nps?: string;
  material?: string;
  pressureClass?: string;
  schedule?: string;
  designPressure?: number;
  designTemperature?: number;
  color?: string;
}

export type Cad2dEntityType = "line" | "polyline" | "circle" | "arc" | "triangle" | "polygon" | "rectangle" | "text";
export type Cad2dPoint = { x: number; y: number };
export type Cad2dEntity = {
  id: string;
  type: Cad2dEntityType;
  layerId: string;
  color: string;
  subType?: string;
  sides?: number;
  length?: number;
  width?: number;
  height?: number;
  closed?: boolean;
  fill?: string;
  fillOpacity?: number;
  hatchPattern?: "none" | "ansi31" | "ansi32" | "solid" | "dots";
  hatchScale?: number;
  lineWeight?: number;
  lineType?: "continuous" | "dashed" | "center" | "hidden";
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
  points?: Cad2dPoint[];
  center?: Cad2dPoint;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  rotation?: number;
  metadata?: {
    intent?: "draft" | "pipe_axis" | "equipment" | "annotation" | "dimension";
    dn?: number;
    elevationZ?: number;
    catalogRef?: string;
    source?: string;
    length?: number;
    width?: number;
    sides?: number;
    radius?: number;
    subType?: string;
    [key: string]: any;
  };
};

export interface CadDraftSession {
  tool: Cad2dEntityType | "paste_target" | "move_target";
  subType?: TriangleType | ArcCreationMode;
  sides?: number;
  length?: number;
  width?: number;
  height?: number;
  radius?: number;
  angle?: number;
  step: number;
  points: Cad2dPoint[];
  center?: Cad2dPoint;
  currentLengthInput: string;
  currentWidthInput: string;
  currentAngleInput: string;
  currentRadiusInput: string;
  mouseWorld: Cad2dPoint;
}

export type Cad2dLayer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
};

export interface PipingJoint {
  id: string;
  segmentId: string;
  endpoint: "from" | "to";
  nodeId: string;
  portId: string;
  lineId: string;
  connectionType: JointConnectionType;
  weldNumber?: string;
  location?: "shop" | "field";
}

export interface GraphIssue {
  id: string;
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
}

export type IsoDimensionAnchor = {
  kind: "node" | "port" | "cad2d";
  nodeId?: string;
  portId?: string;
  entityId?: string;
  pointType?: string;
  pointIndex?: number;
};

export interface IsoDimension {
  id: string;
  type: "distance" | "deltaX" | "deltaY" | "deltaZ";
  a: IsoDimensionAnchor;
  b: IsoDimensionAnchor;
  label?: string;
  offset?: { x: number; y: number };
  unit: "m" | "mm" | "ft-in" | "in";
  locked?: boolean;
}

export interface IsoProjectFileV474 {
  schemaVersion: "4.7.4";
  exportedAt: string;
  project: {
    id: string;
    documentId?: string;
    workspaceId?: string;
    ownerUid: string;
    name: string;
    wilaya: string;
    pressDesign?: number;
    createdAt: string;
    updatedAt: string;
    unitSystem?: "metric" | "imperial";
  };
  model: {
    lines: PipingLine[];
    nodes: IsoNode[];
    segments: IsoSegment[];
    dimensions?: IsoDimension[];
    supports?: IsoPipingSupport[];
    spools?: PdiSpoolEntry[];
    welds?: PdiWeldEntry[];
    cad2d?: {
      layers: Cad2dLayer[];
      entities: Cad2dEntity[];
    };
  };
  workspace: {
    showGrid: boolean;
    showDimensions: boolean;
    showPipeLabels: boolean;
    showLabels: boolean;
    showWelds: boolean;
    isoSnapStep: number;
    viewport: { zoom: number; panX: number; panY: number };
  };
}

export const DIAMETERS = [
  [25, '1"', 33.7, 2.41], [50, '2"', 60.3, 5.44], [80, '3"', 88.9, 11.3],
  [100, '4"', 114.3, 16.1], [125, '5"', 139.7, 21.8], [150, '6"', 168.3, 28.3],
  [200, '8"', 219.1, 42.6], [250, '10"', 273, 60.5], [300, '12"', 323.9, 73.8],
  [350, '14"', 355.6, 81], [400, '16"', 406.4, 97.8], [450, '18"', 457.2, 117],
  [500, '20"', 508, 135], [550, '22"', 559, 155], [600, '24"', 610, 178],
  [650, '26"', 660.4, 190], [700, '28"', 711.2, 215]
] as const;

export type DiameterSpec = {
  dn: number;
  inch: string;
  od: number;
  weight: number;
};

export const DIAMETER_BY_DN: Record<number, DiameterSpec> =
  Object.fromEntries(DIAMETERS.map(([dn, inch, od, weight]) =>
    [dn, { dn, inch, od, weight }]
  ));

export const FITTING_LABELS: Record<IsoFittingType, string> = {
  // Tés et piquages
  te_egal: "Té égal ASME B16.9",
  te_reduit: "Té réduit ASME B16.9",
  te_barre: "Té barré raclable",
  croix: "Croix 4 voies ASME B16.9",
  weldolet: "Piquage soudé Weldolet MSS SP-97",
  threadolet: "Piquage taraudé Threadolet MSS SP-97",
  sockolet: "Piquage emboîté Sockolet MSS SP-97",
  piquage: "Piquage direct tube/tube",
  // Réductions et fonds
  reduction_concentrique: "Réduction concentrique ASME B16.9",
  reduction_excentrique: "Réduction excentrique ASME B16.9",
  fond_bombe: "Fond bombé / Cap elliptique ASME B16.9",
  // Coudes et cintres
  coude_90: "Coude 90° Grand Rayon LR (1.5D)",
  coude_90_sr: "Coude 90° Court Rayon SR (1.0D)",
  coude_45: "Coude 45° Grand Rayon",
  coude_30: "Coude 30° usiné",
  coude_22_5: "Coude 22,5° usiné",
  coude_3d: "Coude cintré 3D (R=3D)",
  coude_5d: "Coude cintré 5D raclable (R=5D)",
  coude_180: "Retour 180° Long Radius",
  // Brides et raccordements
  bride_wn: "Bride à collerette WN ASME B16.5",
  bride_so: "Bride plate à emmancher SO",
  bride_pleine: "Bride pleine Blind ASME B16.5",
  bride_sw: "Bride à emboîtement SW",
  bride_lap_joint: "Bride tournante Lap Joint",
  joint: "Joint spiralé RF ASME B16.20",
  jmi: "Joint monobloc isolant JMI",
  diaphragme: "Diaphragme de mesure ASME MFC-3M",
  // Robinetterie industrielle
  vanne_passage_total: "Vanne passage intégral API 6D",
  vanne_opercule: "Vanne à opercule (Gate) API 600",
  vanne_soupape: "Vanne à soupape de réglage (Globe)",
  vanne_boisseau: "Vanne à boisseau sphérique API 6D",
  vanne_papillon: "Vanne papillon type Lug API 609",
  clapet: "Clapet anti-retour battant ASME B16.34",
  clapet_bille: "Clapet anti-retour à bille API 6D",
  soupape: "Soupape de sécurité PSV API 526",
  robinet_pointeau: "Robinet pointeau forgé 6000#",
  // Instrumentation et ligne
  purge: "Purge manuelle basse avec vanne",
  event: "Évent d'aération haut avec vanne",
  manometre: "Manomètre de pression PI",
  prise_pression: "Prise de pression instrumentation",
  // Postes et gares de raclage
  poste_sectionnement: "Poste de sectionnement de ligne",
  poste_coupure: "Poste de coupure d'urgence ESD",
  poste_detente: "Poste de détente et régulation",
  gare_racleur_depart: "Gare de racleur départ (Launcher)",
  gare_racleur_arrivee: "Gare de racleur arrivée (Receiver)"
};

export const FITTING_TYPES = Object.keys(FITTING_LABELS) as IsoFittingType[];

export const WALL_BY_SCHEDULE: Record<string, number> = {
  "STD": 5.54,
  "XS": 7.82,
  "XXS": 11.1,
  "SCH40": 5.54,
  "SCH80": 8.18,
};

export const ISO_GRAPH_LIMITS = {
  MAX_NODES: 500,
  MAX_SEGMENTS: 500,
};

