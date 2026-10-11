/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * UNIVERSAL CAO ENTITY MODEL & PROPERTY CONTRACT
 * 
 * Arborescence normalisée universelle pour tout objet CAO / Tuyauterie industrielle :
 * ├─ identité (id, type, categorie, nom/label, dateCreation)
 * ├─ géométrie (position x, y, z, rotation, longueur, boundingBox, dimensions 2D/3D)
 * ├─ connexion (ports, extrémités amont/aval, nœuds liés, type raccordement)
 * ├─ DN (diamètre nominal principal, DN réduit/dérivé, diamètre extérieur, unité)
 * ├─ PN (classe de pression PN/Class ANSI, pression de service, pression de calcul)
 * ├─ matériau (nuance métallurgique, grade ASTM/EN, code matériau, densité)
 * ├─ service (code fluide, description procédé, température service, état)
 * ├─ spec (spécification tuyauterie PMS, classe tuyauterie, révision)
 * ├─ tag (repère équipement KKS/ISA, numéro de ligne, repère cartouche)
 * ├─ fabrication (numéro de spool, localisation atelier/chantier, NDT, type soudure)
 * └─ documentation (référence catalogue, fabricant, fiche technique, P&ID, remarques)
 * 
 * + Propriétés spécifiques par type (Vanne, Té, Coude, Bride, Tube, Support, Dessin 2D...)
 */

export type UniversalEntityCategory =
  | "pipe"           // Tube / Tronçon
  | "valve"          // Vanne / Robinetterie
  | "fitting"        // Raccord tubulaire (coude, té, réduction, etc.)
  | "flange"         // Bride
  | "node"           // Nœud / Point d'inflexion / Extrémité
  | "support"        // Supportage MSS SP-58
  | "cad2d"          // Dessin géométrique 2D (ligne, cercle, polygone, texte...)
  | "dimension"      // Cotation métrique ou impériale
  | "equipment";     // Équipement majeur (cuve, pompe, sas, échangeur...)

/**
 * Origine / source opérationnelle de l'entité dans l'application (ARCH-03 §6).
 */
export type UniversalEntitySource =
  | "2D"
  | "ISOMETRIC"
  | "3D"
  | "IMPORT"
  | "CATALOG"
  | "PROJECT";

export interface UniversalIdentity {
  id: string;
  type: string;
  category: UniversalEntityCategory;
  name: string;
  labelFr: string;
  description?: string;
  projectId?: string;
  source?: UniversalEntitySource | string;
  createdAt?: string;
  locked?: boolean;
}

export interface UniversalGeometry {
  x: number;
  y: number;
  z: number;
  rotation?: number;       // en degrés (0 - 360)
  elevation?: number;      // altimétrie Z relative au sol (m)
  length?: number;         // longueur réelle en mètres
  width?: number;          // largeur si applicable
  height?: number;         // hauteur si applicable
  radius?: number;         // rayon si cercle/arc/polygone
  branchAngle?: number;    // angle de dérivation (ex: 45°, 90°)
  mirrored?: boolean;      // inversion miroir
  bendDirection?: 1 | -1;  // sens de coude
  points?: Array<{ x: number; y: number; z?: number }>; // sommets polygone / polyligne
}

export interface UniversalPortConnection {
  portId: string;
  index: number;
  role: "in" | "out" | "branch" | "aux";
  connectionType?: "butt_weld" | "socket_weld" | "flanged" | "threaded" | "mechanical";
  connectedToEntityId?: string;
  connectedToPortId?: string;
  endPreparation?: "bevel" | "plain" | "socket" | "flange_face";
}

export interface UniversalConnection {
  fromEntityId?: string;
  toEntityId?: string;
  fromPortId?: string;
  toPortId?: string;
  connectedSegmentIds?: string[];
  ports: UniversalPortConnection[];
  connectionType: "butt_weld" | "socket_weld" | "flanged" | "threaded" | "mechanical" | "inline";
}

export interface UniversalDn {
  dn?: number;              // Diamètre nominal principal (ex: 50, 100, 200...)
  inch?: string;           // NPS correspondant (ex: 2", 4", 8"...)
  outerDiameterMm?: number;// Diamètre extérieur réel (OD en mm)
  reducedDn?: number;      // DN réduit pour té réduit, piquage ou réduction
  reducedInch?: string;    // NPS réduit
  unit?: "mm" | "in";
  _isDefault?: boolean;
}

export interface UniversalPn {
  rating?: string;          // Class 150, Class 300, Class 600, PN16, PN25, PN40, PN64...
  designPressureBar?: number; // Pression de calcul (bar)
  operatingPressureBar?: number; // Pression de service (bar)
  testPressureBar?: number;     // Pression d'épreuve hydrostatique (bar)
  _isDefault?: boolean;
}

export interface UniversalMaterial {
  grade?: string;           // Nuance (ex: "Acier API 5L X52", "Inox 316L", "ASTM A106 Gr. B")
  standard?: string;       // Norme matière (ASTM, EN 10216, API)
  schedule?: string;       // Schedule / Épaisseur (SCH 10, 40, 80, 160, STD, XS, XXS)
  wallThicknessMm?: number;// Épaisseur de paroi réelle (mm)
  density?: number;        // Masse volumique kg/m³
  linearWeightKgM?: number;// Masse linéique (kg/m)
  _isDefault?: boolean;
}

export interface UniversalService {
  code?: string;            // Code fluide (ex: GN, H2, STEAM, AIR, COND, OIL)
  description?: string;    // Libellé (ex: "Gaz Naturel Haute Pression")
  designTemperatureC?: number; // Température de calcul (°C)
  operatingTemperatureC?: number; // Température de service (°C)
  hazardous?: boolean;
  _isDefault?: boolean;
}

export interface UniversalSpec {
  pmsCode?: string;         // Code PMS Piping Material Spec (ex: "CS-600-01", "SS-150")
  classRating?: string;
  revision?: string;
  corrosionAllowanceMm?: number; // Surépaisseur de corrosion (mm)
  _isDefault?: boolean;
}

export interface UniversalTag {
  fullTag?: string;         // Repère complet (ex: "01-V-102", "SP-02-P-04", "TE-301")
  lineId?: string;         // Identifiant de la ligne mère
  equipmentTag?: string;   // Repère équipement parent
  kks?: string;            // Code KKS normalisé
  sheetNumber?: string;    // N° de planche ISO
  _isDefault?: boolean;
}

export interface UniversalFabrication {
  spoolNumber?: string;    // N° de spool (ex: "SP-01", "SP-02")
  location?: "shop" | "field" | "golden"; // Atelier / Chantier / Soudure d'or
  weldType?: "butt_weld" | "socket_weld" | "fillet" | "flange";
  weldNumber?: string;     // Repère soudure (ex: "W-01")
  ndtRequirement?: "VT" | "RT" | "PT" | "UT" | "100% RT";
  heatNumber?: string;     // Numéro de coulée métallurgique
}

export interface UniversalDocumentation {
  catalogRef?: string;     // Référence fournisseur / catalogue
  manufacturer?: string;   // Fabricant (ex: "Cameron", "Velan", "Vallourec", "KSB")
  modelNumber?: string;    // Référence modèle
  pidRef?: string;         // N° plan P&ID de référence
  datasheetRef?: string;   // Référence fiche technique
  notes?: string;          // Remarques de chantier ou d'ingénierie
}

/**
 * Propriétés spécifiques selon le type d'équipement ou d'objet
 */
export interface SpecificProperties {
  // Pour Vanne (Gate, Globe, Ball, Butterfly, Check...)
  valve?: {
    flowType?: "passage_total" | "passage_reduit" | "egal";
    actuatorType?: "manuel_volant" | "manuel_levier" | "pneumatique" | "motorise_electrique" | "hydraulique";
    seatType?: "metal_metal" | "ptfe" | "stellite";
    faceToFaceMm?: number;
    flowCoefficientKv?: number;
    fireSafe?: boolean;
  };
  // Pour Té & Piquage
  tee?: {
    teeType?: "egal" | "reduit" | "barre_raclable" | "croix" | "weldolet" | "sockolet" | "threadolet";
    runDn?: number;
    branchDn?: number;
    branchAngle?: number;
    runLengthMm?: number;
    branchHeightMm?: number;
  };
  // Pour Coude
  elbow?: {
    angle?: 90 | 45 | 30 | 22.5 | 180;
    radiusType?: "1.5D_LR" | "1.0D_SR" | "3D" | "5D";
    radiusMm?: number;
    tangentLengthMm?: number;
  };
  // Pour Bride
  flange?: {
    flangeType?: "WN" | "SO" | "BL" | "SW" | "LJ" | "Threaded";
    facing?: "RF" | "FF" | "RTJ";
    gasketType?: "spiral_wound" | "klingersil" | "rtj_soft_iron";
    boltHoles?: number;
  };
  // Pour Tube / Tronçon
  pipe?: {
    type?: "straight" | "riser" | "branch";
    insulation?: boolean;
    insulationThicknessMm?: number;
    insulationType?: string;
    slopePercent?: number;
    slopeDirection?: "up" | "down";
    color?: string;
  };
  // Pour Supportage MSS SP-58
  support?: {
    mssType?: string;
    loadCapacityKn?: number;
    clampingType?: string;
    concretePad?: boolean;
  };
  // Pour Dessin CAO 2D
  cad2d?: {
    layerId?: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeDash?: "continuous" | "dashed" | "center" | "hidden";
    fillColor?: string;
    fillOpacity?: number;
    hatchPattern?: "none" | "ansi31" | "ansi32" | "solid" | "dots";
    fontSize?: number;
    fontFamily?: string;
    textValue?: string;
  };
}

/**
 * Références normatives transversales associées à l'entité (ARCH-03 §9, §10).
 * Ces champs permettent d'alimenter le moteur normatif sans jamais se substituer à lui.
 */
export interface UniversalNormativeRef {
  readonly pipingSpecId?: string;
  readonly designCodeId?: string;
  readonly materialId?: string;
  readonly pressureRating?: string;
  readonly nominalSize?: string;
  readonly schedule?: string;
  readonly dimensionalStandard?: string;
  readonly productStandard?: string;
  readonly connectionType?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Relations transversales de l'entité métier (ARCH-03 §16).
 */
export interface UniversalRelationships {
  readonly parentEntityId?: string;
  readonly childEntityIds?: readonly string[];
  readonly connectedEntityIds?: readonly string[];
  readonly lineId?: string;
  readonly spoolId?: string;
  readonly weldIds?: readonly string[];
  readonly equipmentId?: string;
}

/**
 * L'Entité Universelle PD&I : Contrat complet consolidé
 */
export interface PdiUniversalEntity {
  identity: UniversalIdentity;
  geometry: UniversalGeometry;
  connection: UniversalConnection;
  dn: UniversalDn;
  pn: UniversalPn;
  material: UniversalMaterial;
  service: UniversalService;
  spec: UniversalSpec;
  tag: UniversalTag;
  fabrication: UniversalFabrication;
  documentation: UniversalDocumentation;
  specific: SpecificProperties;
  normative?: UniversalNormativeRef;
  relationships?: UniversalRelationships;
  /** Attributs de domaines d'ingénierie (ARCH-08: PIPELINE, PIPING, PACKAGE, EQUIPMENT) */
  domainAttributes?: Record<string, unknown>;
}

/**
 * Diamètres standardisés industriels ASME B36.10M
 */
export const INDUSTRIAL_STANDARD_DNS: Array<{ dn: number; inch: string; od: number }> = [
  { dn: 15, inch: '1/2"', od: 21.3 },
  { dn: 20, inch: '3/4"', od: 26.9 },
  { dn: 25, inch: '1"', od: 33.7 },
  { dn: 32, inch: '1"1/4', od: 42.4 },
  { dn: 40, inch: '1"1/2', od: 48.3 },
  { dn: 50, inch: '2"', od: 60.3 },
  { dn: 65, inch: '2"1/2', od: 76.1 },
  { dn: 80, inch: '3"', od: 88.9 },
  { dn: 100, inch: '4"', od: 114.3 },
  { dn: 125, inch: '5"', od: 139.7 },
  { dn: 150, inch: '6"', od: 168.3 },
  { dn: 200, inch: '8"', od: 219.1 },
  { dn: 250, inch: '10"', od: 273.0 },
  { dn: 300, inch: '12"', od: 323.9 },
  { dn: 350, inch: '14"', od: 355.6 },
  { dn: 400, inch: '16"', od: 406.4 },
  { dn: 450, inch: '18"', od: 457.2 },
  { dn: 500, inch: '20"', od: 508.0 },
  { dn: 600, inch: '24"', od: 610.0 },
  { dn: 700, inch: '28"', od: 711.2 },
  { dn: 800, inch: '32"', od: 813.0 },
  { dn: 900, inch: '36"', od: 914.0 },
  { dn: 1000, inch: '40"', od: 1016.0 },
];

export const STANDARD_PRESSURE_CLASSES: string[] = [
  "Class 150",
  "Class 300",
  "Class 600",
  "Class 900",
  "Class 1500",
  "Class 2500",
  "PN 10",
  "PN 16",
  "PN 25",
  "PN 40",
  "PN 64",
  "PN 100",
  "PN 160",
  "PN 250",
  "PN 400",
];

export const STANDARD_MATERIALS: string[] = [
  "Acier API 5L Gr. B",
  "Acier API 5L X52",
  "Acier API 5L X60",
  "Acier API 5L X65",
  "Acier API 5L X70",
  "ASTM A106 Gr. B (Carbone sans soudure)",
  "ASTM A333 Gr. 6 (Basse température)",
  "ASTM A312 TP304/304L (Inox)",
  "ASTM A312 TP316/316L (Inox résistant acides)",
  "ASTM A335 P11 (Acier allié)",
  "ASTM A335 P22 (Acier allié)",
  "ASTM A335 P91 (Haute température)",
  "Duplex UNS S31803 / 2205",
  "Super Duplex UNS S32750 / 2507",
  "PEHD 100 (Polyéthylène haute densité)",
  "Inconel 625",
  "Titane Gr. 2",
];

export const STANDARD_SCHEDULES: string[] = [
  "SCH 10",
  "SCH 20",
  "SCH 30",
  "SCH 40 / STD",
  "SCH 60",
  "SCH 80 / XS",
  "SCH 100",
  "SCH 120",
  "SCH 140",
  "SCH 160",
  "XXS",
];
