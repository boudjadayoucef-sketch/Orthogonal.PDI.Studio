/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : CATALOGUE INDUSTRIEL STANDARD INTERNATIONAL (ASME / API / ISO / EN)
 * Référentiels : ASME B16.9, ASME B16.5, ASME B16.34, ASME B16.10, API 5L, API 6D, API 600, MSS SP-97, EN 10253.
 * 100% Déterministe - Zéro Dépendance API Externe
 */

import type { IsoFittingType, JointConnectionType } from "../isometric/types/isoGraphTypes";

export type TcCategory =
  | "Tés & Piquages"
  | "Coudes & Cintres"
  | "Réductions & Fonds"
  | "Robinetterie Industrielle"
  | "Brides & Raccordements"
  | "Instrumentation & Ligne";

export interface TcDimensionEntry {
  dn: number;
  nps: string;
  odMm: number;
  centerToEndMm?: number;
  faceToFaceMm?: number;
  lengthMm?: number;
  heightMm?: number;
  thicknessMm?: number;
  weightKg: number;
}

export interface TcComponentDefinition {
  id: IsoFittingType;
  code: string;
  labelFr: string;
  labelEn: string;
  shortName: string;
  category: TcCategory;
  standard: string;
  brand?: string;
  materialDefault: string;
  connectionDefault: JointConnectionType;
  pressureClasses: string[];
  dimensions: TcDimensionEntry[];
}

/**
 * Catalogue International Standardisé de Tuyauterie Industrielle & Hydrocarbures
 */
export const PDI_INTERNATIONAL_PIPING_CATALOG: Record<IsoFittingType, TcComponentDefinition> = {
  // ==========================================
  // TÉS & PIQUAGES (ASME B16.9 / MSS SP-97)
  // ==========================================
  te_egal: {
    id: "te_egal",
    code: "TC-TEE-EQ",
    labelFr: "Té égal BW ASME B16.9",
    labelEn: "Equal Straight Tee Buttweld",
    shortName: "Té égal",
    category: "Tés & Piquages",
    standard: "ASME B16.9 / EN 10253-2",
    materialDefault: "ASTM A234 WPB / WPL6",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 40", "Sch 80", "Sch 160", "XXS"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, centerToEndMm: 64, weightKg: 1.5 },
      { dn: 80, nps: "3\"", odMm: 88.9, centerToEndMm: 86, weightKg: 3.2 },
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 105, weightKg: 5.6 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 143, weightKg: 13.8 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 178, weightKg: 24.9 },
      { dn: 250, nps: "10\"", odMm: 273.0, centerToEndMm: 216, weightKg: 42.0 },
      { dn: 300, nps: "12\"", odMm: 323.9, centerToEndMm: 254, weightKg: 61.5 },
      { dn: 400, nps: "16\"", odMm: 406.4, centerToEndMm: 305, weightKg: 102.0 },
    ],
  },
  te_reduit: {
    id: "te_reduit",
    code: "TC-TEE-RED",
    labelFr: "Té réduit BW ASME B16.9",
    labelEn: "Reducing Tee Buttweld",
    shortName: "Té réduit",
    category: "Tés & Piquages",
    standard: "ASME B16.9 / EN 10253-2",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 40", "Sch 80", "Sch 160"],
    dimensions: [
      { dn: 80, nps: "3\"x2\"", odMm: 88.9, centerToEndMm: 86, weightKg: 2.9 },
      { dn: 100, nps: "4\"x3\"", odMm: 114.3, centerToEndMm: 105, weightKg: 5.1 },
      { dn: 150, nps: "6\"x4\"", odMm: 168.3, centerToEndMm: 143, weightKg: 12.4 },
      { dn: 200, nps: "8\"x6\"", odMm: 219.1, centerToEndMm: 178, weightKg: 22.8 },
      { dn: 250, nps: "10\"x8\"", odMm: 273.0, centerToEndMm: 216, weightKg: 39.5 },
      { dn: 300, nps: "12\"x8\"", odMm: 323.9, centerToEndMm: 254, weightKg: 57.0 },
    ],
  },
  te_barre: {
    id: "te_barre",
    code: "TC-TEE-SCR",
    labelFr: "Té barré raclable (Scraper / Barred Tee)",
    labelEn: "Barred Tee for Pigging",
    shortName: "Té barré",
    category: "Tés & Piquages",
    standard: "ASME B16.9 / API 6D Spec",
    materialDefault: "ASTM A234 WPB / WPHY-52",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 150", "Class 300", "Class 600", "Class 900"],
    dimensions: [
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 143, weightKg: 16.5 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 178, weightKg: 29.8 },
      { dn: 250, nps: "10\"", odMm: 273.0, centerToEndMm: 216, weightKg: 49.0 },
      { dn: 300, nps: "12\"", odMm: 323.9, centerToEndMm: 254, weightKg: 72.0 },
    ],
  },
  croix: {
    id: "croix",
    code: "TC-CROSS",
    labelFr: "Croix 4 voies BW ASME B16.9",
    labelEn: "Cross Buttweld",
    shortName: "Croix",
    category: "Tés & Piquages",
    standard: "ASME B16.9",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 80"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, centerToEndMm: 64, weightKg: 1.9 },
      { dn: 80, nps: "3\"", odMm: 88.9, centerToEndMm: 86, weightKg: 4.1 },
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 105, weightKg: 7.2 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 143, weightKg: 17.5 },
    ],
  },
  weldolet: {
    id: "weldolet",
    code: "TC-OLET-W",
    labelFr: "Piquage renforcé soudé Weldolet MSS SP-97",
    labelEn: "Weldolet Branch Outlet",
    shortName: "Weldolet",
    category: "Tés & Piquages",
    standard: "MSS SP-97 / ASME B31.3",
    materialDefault: "ASTM A105N / A350 LF2",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 160"],
    dimensions: [
      { dn: 25, nps: "1\"", odMm: 33.4, heightMm: 38, weightKg: 0.6 },
      { dn: 50, nps: "2\"", odMm: 60.3, heightMm: 51, weightKg: 1.4 },
      { dn: 80, nps: "3\"", odMm: 88.9, heightMm: 60, weightKg: 2.7 },
      { dn: 100, nps: "4\"", odMm: 114.3, heightMm: 70, weightKg: 4.5 },
    ],
  },
  threadolet: {
    id: "threadolet",
    code: "TC-OLET-TH",
    labelFr: "Piquage renforcé taraudé NPT Threadolet MSS SP-97",
    labelEn: "Threadolet Branch Outlet",
    shortName: "Threadolet",
    category: "Tés & Piquages",
    standard: "MSS SP-97 / ASME B1.20.1",
    materialDefault: "ASTM A105N",
    connectionDefault: "threaded",
    pressureClasses: ["3000#", "6000#"],
    dimensions: [
      { dn: 15, nps: "1/2\"", odMm: 21.3, heightMm: 32, weightKg: 0.4 },
      { dn: 25, nps: "1\"", odMm: 33.4, heightMm: 38, weightKg: 0.7 },
      { dn: 50, nps: "2\"", odMm: 60.3, heightMm: 52, weightKg: 1.6 },
    ],
  },
  sockolet: {
    id: "sockolet",
    code: "TC-OLET-SW",
    labelFr: "Piquage renforcé à emboîtement Sockolet MSS SP-97",
    labelEn: "Sockolet Branch Outlet",
    shortName: "Sockolet",
    category: "Tés & Piquages",
    standard: "MSS SP-97 / ASME B16.11",
    materialDefault: "ASTM A105N",
    connectionDefault: "socket_weld",
    pressureClasses: ["3000#", "6000#"],
    dimensions: [
      { dn: 15, nps: "1/2\"", odMm: 21.3, heightMm: 32, weightKg: 0.4 },
      { dn: 25, nps: "1\"", odMm: 33.4, heightMm: 38, weightKg: 0.7 },
      { dn: 50, nps: "2\"", odMm: 60.3, heightMm: 52, weightKg: 1.5 },
    ],
  },
  piquage: {
    id: "piquage",
    code: "TC-STUB-IN",
    labelFr: "Piquage direct tube sur tube avec renfort",
    labelEn: "Direct Pipe-to-Pipe Branch",
    shortName: "Piquage",
    category: "Tés & Piquages",
    standard: "ASME B31.3 / ASME B31.8",
    materialDefault: "Tube de ligne",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, weightKg: 0.8 },
      { dn: 100, nps: "4\"", odMm: 114.3, weightKg: 2.1 },
    ],
  },

  // ==========================================
  // COUDES & CINTRES (ASME B16.9 / DIN 2605)
  // ==========================================
  coude_90: {
    id: "coude_90",
    code: "TC-ELB-90-LR",
    labelFr: "Coude 90° Grand Rayon LR (R=1.5D) ASME B16.9",
    labelEn: "90° Long Radius Elbow Buttweld",
    shortName: "Coude 90° LR",
    category: "Coudes & Cintres",
    standard: "ASME B16.9 / EN 10253-2",
    materialDefault: "ASTM A234 WPB / WPL6",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 40", "Sch 80", "Sch 160", "XXS"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, centerToEndMm: 76, weightKg: 0.9 },
      { dn: 80, nps: "3\"", odMm: 88.9, centerToEndMm: 114, weightKg: 2.1 },
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 152, weightKg: 3.9 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 229, weightKg: 10.3 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 305, weightKg: 20.8 },
      { dn: 250, nps: "10\"", odMm: 273.0, centerToEndMm: 381, weightKg: 36.5 },
      { dn: 300, nps: "12\"", odMm: 323.9, centerToEndMm: 457, weightKg: 56.2 },
      { dn: 400, nps: "16\"", odMm: 406.4, centerToEndMm: 610, weightKg: 112.0 },
    ],
  },
  coude_90_sr: {
    id: "coude_90_sr",
    code: "TC-ELB-90-SR",
    labelFr: "Coude 90° Court Rayon SR (R=1.0D) ASME B16.9",
    labelEn: "90° Short Radius Elbow Buttweld",
    shortName: "Coude 90° SR",
    category: "Coudes & Cintres",
    standard: "ASME B16.9",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 80"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, centerToEndMm: 51, weightKg: 0.7 },
      { dn: 80, nps: "3\"", odMm: 88.9, centerToEndMm: 76, weightKg: 1.5 },
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 102, weightKg: 2.8 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 152, weightKg: 7.6 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 203, weightKg: 15.2 },
    ],
  },
  coude_45: {
    id: "coude_45",
    code: "TC-ELB-45-LR",
    labelFr: "Coude 45° Grand Rayon LR ASME B16.9",
    labelEn: "45° Long Radius Elbow Buttweld",
    shortName: "Coude 45°",
    category: "Coudes & Cintres",
    standard: "ASME B16.9 / EN 10253-2",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 40", "Sch 80"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, centerToEndMm: 35, weightKg: 0.5 },
      { dn: 80, nps: "3\"", odMm: 88.9, centerToEndMm: 51, weightKg: 1.1 },
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 64, weightKg: 2.0 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 95, weightKg: 5.2 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 127, weightKg: 10.4 },
    ],
  },
  coude_30: {
    id: "coude_30",
    code: "TC-ELB-30",
    labelFr: "Coude 30° sur mesure usiné",
    labelEn: "30° Miter / Cut Elbow",
    shortName: "Coude 30°",
    category: "Coudes & Cintres",
    standard: "ASME B16.9 ajusté",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS"],
    dimensions: [
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 48, weightKg: 1.7 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 72, weightKg: 4.4 },
    ],
  },
  coude_22_5: {
    id: "coude_22_5",
    code: "TC-ELB-22",
    labelFr: "Coude 22,5° sur mesure usiné",
    labelEn: "22.5° Elbow",
    shortName: "Coude 22.5°",
    category: "Coudes & Cintres",
    standard: "ASME B16.9 ajusté",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS"],
    dimensions: [
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 38, weightKg: 1.5 },
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 56, weightKg: 3.8 },
    ],
  },
  coude_3d: {
    id: "coude_3d",
    code: "TC-BEND-3D",
    labelFr: "Coude cintré grand rayon 3D (R=3D) induction",
    labelEn: "3D Induction Bend",
    shortName: "Cintre 3D",
    category: "Coudes & Cintres",
    standard: "ASME B16.49 / ISO 15590-1",
    materialDefault: "API 5L Gr B / X52",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 300", "Class 600", "Class 900"],
    dimensions: [
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 457, weightKg: 21.0 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 610, weightKg: 42.0 },
      { dn: 300, nps: "12\"", odMm: 323.9, centerToEndMm: 914, weightKg: 115.0 },
    ],
  },
  coude_5d: {
    id: "coude_5d",
    code: "TC-BEND-5D",
    labelFr: "Coude cintré raclable 5D (R=5D) induction",
    labelEn: "5D Pigging Induction Bend",
    shortName: "Cintre 5D",
    category: "Coudes & Cintres",
    standard: "ASME B16.49 / ISO 15590-1",
    materialDefault: "API 5L Gr B / X60",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 300", "Class 600", "Class 900"],
    dimensions: [
      { dn: 150, nps: "6\"", odMm: 168.3, centerToEndMm: 762, weightKg: 35.0 },
      { dn: 200, nps: "8\"", odMm: 219.1, centerToEndMm: 1016, weightKg: 69.0 },
      { dn: 300, nps: "12\"", odMm: 323.9, centerToEndMm: 1524, weightKg: 190.0 },
    ],
  },
  coude_180: {
    id: "coude_180",
    code: "TC-RET-180",
    labelFr: "Retour 180° Long Radius ASME B16.9",
    labelEn: "180° Return Bend",
    shortName: "Retour 180°",
    category: "Coudes & Cintres",
    standard: "ASME B16.9",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, centerToEndMm: 152, weightKg: 1.9 },
      { dn: 80, nps: "3\"", odMm: 88.9, centerToEndMm: 228, weightKg: 4.6 },
      { dn: 100, nps: "4\"", odMm: 114.3, centerToEndMm: 304, weightKg: 8.5 },
    ],
  },

  // ==========================================
  // RÉDUCTIONS & FONDS (ASME B16.9)
  // ==========================================
  reduction_concentrique: {
    id: "reduction_concentrique",
    code: "TC-RED-CONC",
    labelFr: "Réduction concentrique BW ASME B16.9",
    labelEn: "Concentric Reducer Buttweld",
    shortName: "Réd. conc.",
    category: "Réductions & Fonds",
    standard: "ASME B16.9 / EN 10253-2",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 40", "Sch 80"],
    dimensions: [
      { dn: 80, nps: "3\"x2\"", odMm: 88.9, lengthMm: 89, weightKg: 1.1 },
      { dn: 100, nps: "4\"x3\"", odMm: 114.3, lengthMm: 102, weightKg: 1.8 },
      { dn: 150, nps: "6\"x4\"", odMm: 168.3, lengthMm: 140, weightKg: 4.8 },
      { dn: 200, nps: "8\"x6\"", odMm: 219.1, lengthMm: 152, weightKg: 7.9 },
      { dn: 250, nps: "10\"x8\"", odMm: 273.0, lengthMm: 178, weightKg: 13.5 },
      { dn: 300, nps: "12\"x10\"", odMm: 323.9, lengthMm: 203, weightKg: 20.5 },
    ],
  },
  reduction_excentrique: {
    id: "reduction_excentrique",
    code: "TC-RED-EXC",
    labelFr: "Réduction excentrique BW ASME B16.9 (Plat bas / haut)",
    labelEn: "Eccentric Reducer Buttweld (FOB/FOT)",
    shortName: "Réd. exc.",
    category: "Réductions & Fonds",
    standard: "ASME B16.9 / EN 10253-2",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 40", "Sch 80"],
    dimensions: [
      { dn: 80, nps: "3\"x2\"", odMm: 88.9, lengthMm: 89, weightKg: 1.1 },
      { dn: 100, nps: "4\"x3\"", odMm: 114.3, lengthMm: 102, weightKg: 1.8 },
      { dn: 150, nps: "6\"x4\"", odMm: 168.3, lengthMm: 140, weightKg: 4.9 },
      { dn: 200, nps: "8\"x6\"", odMm: 219.1, lengthMm: 152, weightKg: 8.2 },
      { dn: 250, nps: "10\"x8\"", odMm: 273.0, lengthMm: 178, weightKg: 14.1 },
    ],
  },
  fond_bombe: {
    id: "fond_bombe",
    code: "TC-CAP-ELLIP",
    labelFr: "Fond bombé / Cap elliptique ASME B16.9",
    labelEn: "Elliptical End Cap Buttweld",
    shortName: "Fond bombé",
    category: "Réductions & Fonds",
    standard: "ASME B16.9",
    materialDefault: "ASTM A234 WPB",
    connectionDefault: "butt_weld",
    pressureClasses: ["STD", "XS", "Sch 80"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 60.3, lengthMm: 38, weightKg: 0.5 },
      { dn: 80, nps: "3\"", odMm: 88.9, lengthMm: 51, weightKg: 1.2 },
      { dn: 100, nps: "4\"", odMm: 114.3, lengthMm: 64, weightKg: 2.1 },
      { dn: 150, nps: "6\"", odMm: 168.3, lengthMm: 89, weightKg: 5.3 },
      { dn: 200, nps: "8\"", odMm: 219.1, lengthMm: 102, weightKg: 9.8 },
    ],
  },

  // ==========================================
  // BRIDES & RACCORDEMENTS (ASME B16.5 / B16.47)
  // ==========================================
  bride_wn: {
    id: "bride_wn",
    code: "TC-FLG-WN",
    labelFr: "Bride à collerette à souder WN ASME B16.5 RF/RTJ",
    labelEn: "Welding Neck Flange RF/RTJ",
    shortName: "Bride WN",
    category: "Brides & Raccordements",
    standard: "ASME B16.5 / EN 1092-1 Type 11",
    materialDefault: "ASTM A105N / A350 LF2",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 150", "Class 300", "Class 600", "Class 900", "Class 1500"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, lengthMm: 63.5, thicknessMm: 19.1, weightKg: 3.2 },
      { dn: 80, nps: "3\"", odMm: 190.5, lengthMm: 69.9, thicknessMm: 23.9, weightKg: 5.5 },
      { dn: 100, nps: "4\"", odMm: 228.6, lengthMm: 76.2, thicknessMm: 23.9, weightKg: 8.0 },
      { dn: 150, nps: "6\"", odMm: 279.4, lengthMm: 88.9, thicknessMm: 25.4, weightKg: 12.0 },
      { dn: 200, nps: "8\"", odMm: 342.9, lengthMm: 101.6, thicknessMm: 28.4, weightKg: 20.5 },
      { dn: 250, nps: "10\"", odMm: 406.4, lengthMm: 101.6, thicknessMm: 30.2, weightKg: 27.5 },
      { dn: 300, nps: "12\"", odMm: 482.6, lengthMm: 114.3, thicknessMm: 31.8, weightKg: 40.0 },
    ],
  },
  bride_so: {
    id: "bride_so",
    code: "TC-FLG-SO",
    labelFr: "Bride plate à emmancher SO Slip-On ASME B16.5",
    labelEn: "Slip-On Flange RF",
    shortName: "Bride SO",
    category: "Brides & Raccordements",
    standard: "ASME B16.5 / EN 1092-1 Type 12",
    materialDefault: "ASTM A105N",
    connectionDefault: "fillet_weld",
    pressureClasses: ["Class 150", "Class 300"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, lengthMm: 25.4, weightKg: 2.3 },
      { dn: 80, nps: "3\"", odMm: 190.5, lengthMm: 30.2, weightKg: 4.1 },
      { dn: 100, nps: "4\"", odMm: 228.6, lengthMm: 33.3, weightKg: 6.2 },
      { dn: 150, nps: "6\"", odMm: 279.4, lengthMm: 39.6, weightKg: 9.8 },
    ],
  },
  bride_pleine: {
    id: "bride_pleine",
    code: "TC-FLG-BLIND",
    labelFr: "Bride pleine / obturatrice Blind Flange ASME B16.5",
    labelEn: "Blind Flange RF/RTJ",
    shortName: "Bride pleine",
    category: "Brides & Raccordements",
    standard: "ASME B16.5",
    materialDefault: "ASTM A105N / A350 LF2",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300", "Class 600", "Class 900"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, thicknessMm: 19.1, weightKg: 2.6 },
      { dn: 80, nps: "3\"", odMm: 190.5, thicknessMm: 23.9, weightKg: 5.1 },
      { dn: 100, nps: "4\"", odMm: 228.6, thicknessMm: 23.9, weightKg: 7.9 },
      { dn: 150, nps: "6\"", odMm: 279.4, thicknessMm: 25.4, weightKg: 13.5 },
      { dn: 200, nps: "8\"", odMm: 342.9, thicknessMm: 28.4, weightKg: 23.0 },
    ],
  },
  bride_sw: {
    id: "bride_sw",
    code: "TC-FLG-SW",
    labelFr: "Bride à emboîtement Socket Weld ASME B16.5",
    labelEn: "Socket Weld Flange",
    shortName: "Bride SW",
    category: "Brides & Raccordements",
    standard: "ASME B16.5",
    materialDefault: "ASTM A105N",
    connectionDefault: "socket_weld",
    pressureClasses: ["Class 150", "Class 300", "Class 600"],
    dimensions: [
      { dn: 25, nps: "1\"", odMm: 108.0, lengthMm: 38.1, weightKg: 1.4 },
      { dn: 50, nps: "2\"", odMm: 152.4, lengthMm: 44.5, weightKg: 3.1 },
    ],
  },
  bride_lap_joint: {
    id: "bride_lap_joint",
    code: "TC-FLG-LJ",
    labelFr: "Bride tournante Lap Joint avec collet rabattu",
    labelEn: "Lap Joint Flange with Stub End",
    shortName: "Bride tournante",
    category: "Brides & Raccordements",
    standard: "ASME B16.5",
    materialDefault: "ASTM A105N / Collet A234",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, lengthMm: 25.4, weightKg: 2.4 },
      { dn: 100, nps: "4\"", odMm: 228.6, lengthMm: 33.3, weightKg: 6.4 },
    ],
  },
  joint: {
    id: "joint",
    code: "TC-GSK-SP",
    labelFr: "Joint spiralé graphite/inox avec anneau de centrage",
    labelEn: "Spiral Wound Gasket RF",
    shortName: "Joint spiralé",
    category: "Brides & Raccordements",
    standard: "ASME B16.20 / EN 1514-2",
    materialDefault: "Inox 316L / Graphite expansé",
    connectionDefault: "mechanical",
    pressureClasses: ["Class 150", "Class 300", "Class 600", "Class 900"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 104.8, thicknessMm: 4.5, weightKg: 0.15 },
      { dn: 100, nps: "4\"", odMm: 174.6, thicknessMm: 4.5, weightKg: 0.35 },
      { dn: 150, nps: "6\"", odMm: 222.3, thicknessMm: 4.5, weightKg: 0.55 },
    ],
  },
  jmi: {
    id: "jmi",
    code: "TC-JMI-CATH",
    labelFr: "Joint Monobloc Isolant diélectrique (JMI) protection cathodique",
    labelEn: "Monolithic Insulating Joint",
    shortName: "Joint JMI",
    category: "Brides & Raccordements",
    standard: "NACE SP0286 / ASME B31.8",
    materialDefault: "Acier forgé + Résine époxy haute rigidité",
    connectionDefault: "butt_weld",
    pressureClasses: ["PN16", "PN25", "Class 150", "Class 300", "Class 600"],
    dimensions: [
      { dn: 100, nps: "4\"", odMm: 114.3, lengthMm: 400, weightKg: 28.0 },
      { dn: 150, nps: "6\"", odMm: 168.3, lengthMm: 450, weightKg: 45.0 },
      { dn: 200, nps: "8\"", odMm: 219.1, lengthMm: 500, weightKg: 78.0 },
    ],
  },
  diaphragme: {
    id: "diaphragme",
    code: "TC-ORF-MTR",
    labelFr: "Organe déprimogène / Diaphragme de mesure débit ASME MFC-3M",
    labelEn: "Orifice Plate & Flanges Assembly",
    shortName: "Diaphragme",
    category: "Brides & Raccordements",
    standard: "ASME MFC-3M / ISO 5167",
    materialDefault: "Inox 316L / Brides A105",
    connectionDefault: "flanged",
    pressureClasses: ["Class 300", "Class 600"],
    dimensions: [
      { dn: 80, nps: "3\"", odMm: 190.5, lengthMm: 180, weightKg: 18.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, lengthMm: 200, weightKg: 26.0 },
      { dn: 150, nps: "6\"", odMm: 279.4, lengthMm: 220, weightKg: 38.0 },
    ],
  },

  // ==========================================
  // ROBINETTERIE INDUSTRIELLE (ASME B16.34 / API 6D / API 600)
  // ==========================================
  vanne_passage_total: {
    id: "vanne_passage_total",
    code: "TC-VLV-FP",
    labelFr: "Vanne à boisseau passage intégral API 6D",
    labelEn: "Full Bore Ball Valve API 6D",
    shortName: "Vanne pass. intégral",
    category: "Robinetterie Industrielle",
    standard: "API 6D / ASME B16.34",
    materialDefault: "ASTM A216 WCB / A350 LF2",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300", "Class 600"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, faceToFaceMm: 178, weightKg: 14.0 },
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 203, weightKg: 26.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 229, weightKg: 42.0 },
      { dn: 150, nps: "6\"", odMm: 279.4, faceToFaceMm: 267, weightKg: 85.0 },
      { dn: 200, nps: "8\"", odMm: 342.9, faceToFaceMm: 292, weightKg: 145.0 },
      { dn: 250, nps: "10\"", odMm: 406.4, faceToFaceMm: 330, weightKg: 235.0 },
      { dn: 300, nps: "12\"", odMm: 482.6, faceToFaceMm: 356, weightKg: 350.0 },
    ],
  },
  vanne_opercule: {
    id: "vanne_opercule",
    code: "TC-VLV-GATE",
    labelFr: "Vanne à opercule (Gate Valve) API 600 / ASME B16.34",
    labelEn: "Cast Steel Gate Valve Bolted Bonnet",
    shortName: "Vanne opercule",
    category: "Robinetterie Industrielle",
    standard: "API 600 / ASME B16.34 / B16.10",
    materialDefault: "ASTM A216 WCB (Trim 8 Stellite)",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300", "Class 600"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, faceToFaceMm: 178, weightKg: 19.0 },
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 203, weightKg: 31.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 229, weightKg: 49.0 },
      { dn: 150, nps: "6\"", odMm: 279.4, faceToFaceMm: 267, weightKg: 78.0 },
      { dn: 200, nps: "8\"", odMm: 342.9, faceToFaceMm: 292, weightKg: 135.0 },
      { dn: 250, nps: "10\"", odMm: 406.4, faceToFaceMm: 330, weightKg: 215.0 },
    ],
  },
  vanne_soupape: {
    id: "vanne_soupape",
    code: "TC-VLV-GLOBE",
    labelFr: "Vanne à soupape de réglage (Globe Valve) ASME B16.34",
    labelEn: "Globe Valve for Throttling",
    shortName: "Vanne soupape",
    category: "Robinetterie Industrielle",
    standard: "ASME B16.34 / BS 1873 / B16.10",
    materialDefault: "ASTM A216 WCB",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300", "Class 600"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, faceToFaceMm: 203, weightKg: 22.0 },
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 241, weightKg: 38.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 292, weightKg: 62.0 },
      { dn: 150, nps: "6\"", odMm: 279.4, faceToFaceMm: 356, weightKg: 110.0 },
    ],
  },
  vanne_boisseau: {
    id: "vanne_boisseau",
    code: "TC-VLV-BALL",
    labelFr: "Vanne à boisseau sphérique standard API 6D",
    labelEn: "Floating Ball Valve",
    shortName: "Vanne boisseau",
    category: "Robinetterie Industrielle",
    standard: "API 6D / ISO 14313",
    materialDefault: "ASTM A216 WCB / Inox 316",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, faceToFaceMm: 178, weightKg: 12.0 },
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 203, weightKg: 22.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 229, weightKg: 36.0 },
    ],
  },
  vanne_papillon: {
    id: "vanne_papillon",
    code: "TC-VLV-BFLY",
    labelFr: "Vanne papillon à double excentration type Lug API 609",
    labelEn: "High Performance Butterfly Valve Lug",
    shortName: "Vanne papillon",
    category: "Robinetterie Industrielle",
    standard: "API 609 / ASME B16.34",
    materialDefault: "Corps WCB / Disque CF8M / Siège PTFE",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300"],
    dimensions: [
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 48, weightKg: 8.5 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 54, weightKg: 11.5 },
      { dn: 150, nps: "6\"", odMm: 279.4, faceToFaceMm: 57, weightKg: 17.0 },
      { dn: 200, nps: "8\"", odMm: 342.9, faceToFaceMm: 64, weightKg: 28.0 },
      { dn: 250, nps: "10\"", odMm: 406.4, faceToFaceMm: 71, weightKg: 42.0 },
    ],
  },
  clapet: {
    id: "clapet",
    code: "TC-CHK-SWING",
    labelFr: "Clapet anti-retour à battant Swing Check ASME B16.34",
    labelEn: "Swing Check Valve Bolted Cover",
    shortName: "Clapet battant",
    category: "Robinetterie Industrielle",
    standard: "ASME B16.34 / BS 1868 / B16.10",
    materialDefault: "ASTM A216 WCB",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150", "Class 300", "Class 600"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, faceToFaceMm: 203, weightKg: 16.0 },
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 241, weightKg: 27.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 292, weightKg: 42.0 },
      { dn: 150, nps: "6\"", odMm: 279.4, faceToFaceMm: 356, weightKg: 78.0 },
      { dn: 200, nps: "8\"", odMm: 342.9, faceToFaceMm: 495, weightKg: 140.0 },
    ],
  },
  clapet_bille: {
    id: "clapet_bille",
    code: "TC-CHK-BALL",
    labelFr: "Clapet anti-retour à bille / piston pour gaz et fluide chargé",
    labelEn: "Ball / Piston Check Valve",
    shortName: "Clapet bille",
    category: "Robinetterie Industrielle",
    standard: "API 6D / ASME B16.34",
    materialDefault: "ASTM A105 / A216 WCB",
    connectionDefault: "flanged",
    pressureClasses: ["Class 300", "Class 600"],
    dimensions: [
      { dn: 50, nps: "2\"", odMm: 152.4, faceToFaceMm: 216, weightKg: 18.0 },
      { dn: 80, nps: "3\"", odMm: 190.5, faceToFaceMm: 283, weightKg: 32.0 },
      { dn: 100, nps: "4\"", odMm: 228.6, faceToFaceMm: 305, weightKg: 52.0 },
    ],
  },
  soupape: {
    id: "soupape",
    code: "TC-VLV-PSV",
    labelFr: "Soupape de sûreté à ressort (PSV) échappement d'angle API 526",
    labelEn: "Pressure Safety Relief Valve (PSV)",
    shortName: "Soupape PSV",
    category: "Robinetterie Industrielle",
    standard: "API 526 / ASME Section VIII",
    materialDefault: "Corps WCB / Ressort inox revêtu",
    connectionDefault: "flanged",
    pressureClasses: ["Class 150x150", "Class 300x150", "Class 600x150"],
    dimensions: [
      { dn: 50, nps: "2\"x3\"", odMm: 152.4, centerToEndMm: 124, weightKg: 28.0 },
      { dn: 80, nps: "3\"x4\"", odMm: 190.5, centerToEndMm: 156, weightKg: 46.0 },
      { dn: 100, nps: "4\"x6\"", odMm: 228.6, centerToEndMm: 181, weightKg: 78.0 },
    ],
  },
  robinet_pointeau: {
    id: "robinet_pointeau",
    code: "TC-VLV-NEEDLE",
    labelFr: "Robinet pointeau d'isolement instrumentation forgé 6000#",
    labelEn: "High Pressure Needle Valve",
    shortName: "Robinet pointeau",
    category: "Robinetterie Industrielle",
    standard: "MSS SP-99 / ASME B16.34",
    materialDefault: "Inox 316L / Monel",
    connectionDefault: "threaded",
    pressureClasses: ["3000#", "6000#"],
    dimensions: [
      { dn: 15, nps: "1/2\"", odMm: 21.3, faceToFaceMm: 68, weightKg: 0.9 },
      { dn: 20, nps: "3/4\"", odMm: 26.7, faceToFaceMm: 76, weightKg: 1.3 },
    ],
  },

  // ==========================================
  // INSTRUMENTATION & LIGNE
  // ==========================================
  purge: {
    id: "purge",
    code: "TC-DRAIN",
    labelFr: "Purge manuelle basse avec vanne d'isolement et bouchon",
    labelEn: "Low Point Drain Assembly",
    shortName: "Purge basse",
    category: "Instrumentation & Ligne",
    standard: "Spécification Chantier Gaz",
    materialDefault: "A105N / A106 Gr B",
    connectionDefault: "threaded",
    pressureClasses: ["3000#", "6000#"],
    dimensions: [
      { dn: 20, nps: "3/4\"", odMm: 26.7, lengthMm: 150, weightKg: 3.2 },
      { dn: 25, nps: "1\"", odMm: 33.4, lengthMm: 180, weightKg: 4.5 },
    ],
  },
  event: {
    id: "event",
    code: "TC-VENT",
    labelFr: "Évent haut d'aération avec vanne d'isolement",
    labelEn: "High Point Vent Assembly",
    shortName: "Évent haut",
    category: "Instrumentation & Ligne",
    standard: "Spécification Chantier Gaz",
    materialDefault: "A105N / A106 Gr B",
    connectionDefault: "threaded",
    pressureClasses: ["3000#", "6000#"],
    dimensions: [
      { dn: 20, nps: "3/4\"", odMm: 26.7, lengthMm: 150, weightKg: 3.2 },
      { dn: 25, nps: "1\"", odMm: 33.4, lengthMm: 180, weightKg: 4.5 },
    ],
  },
  manometre: {
    id: "manometre",
    code: "TC-INST-PI",
    labelFr: "Manomètre de pression avec robinet d'isolement",
    labelEn: "Pressure Gauge Indicator (PI)",
    shortName: "Manomètre",
    category: "Instrumentation & Ligne",
    standard: "EN 837-1 / ASME B40.100",
    materialDefault: "Boîtier inox 304 / Raccord 316L",
    connectionDefault: "threaded",
    pressureClasses: ["0-100 bar", "0-160 bar"],
    dimensions: [
      { dn: 15, nps: "1/2\" G", odMm: 100, heightMm: 160, weightKg: 1.8 },
    ],
  },
  prise_pression: {
    id: "prise_pression",
    code: "TC-INST-TAP",
    labelFr: "Prise de pression avec manchon et vanne d'échantillonnage",
    labelEn: "Pressure Tapping Point",
    shortName: "Prise pression",
    category: "Instrumentation & Ligne",
    standard: "ASME B16.11",
    materialDefault: "A105N",
    connectionDefault: "threaded",
    pressureClasses: ["3000#", "6000#"],
    dimensions: [
      { dn: 15, nps: "1/2\"", odMm: 21.3, heightMm: 120, weightKg: 1.4 },
    ],
  },
  poste_sectionnement: {
    id: "poste_sectionnement",
    code: "TC-STN-SECT",
    labelFr: "Poste de sectionnement de ligne pipeline",
    labelEn: "Mainline Block Valve Station (MLV)",
    shortName: "Poste sectionnement",
    category: "Instrumentation & Ligne",
    standard: "ASME B31.8 / ISO 13623",
    materialDefault: "Ensemble soudé & bridé",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 600", "Class 900"],
    dimensions: [
      { dn: 300, nps: "12\"", odMm: 323.9, lengthMm: 2400, weightKg: 1200 },
    ],
  },
  poste_coupure: {
    id: "poste_coupure",
    code: "TC-STN-ESD",
    labelFr: "Poste de coupure automatique d'urgence (ESD / ROV)",
    labelEn: "Emergency Shutdown Valve Station (ESD)",
    shortName: "Poste coupure ESD",
    category: "Instrumentation & Ligne",
    standard: "IEC 61508 SIL-3 / API 6D",
    materialDefault: "Actionneur pneumatique / gaz sur huile",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 600"],
    dimensions: [
      { dn: 200, nps: "8\"", odMm: 219.1, lengthMm: 1800, weightKg: 850 },
    ],
  },
  poste_detente: {
    id: "poste_detente",
    code: "TC-STN-PRMS",
    labelFr: "Poste de détente et comptage gaz (PRMS)",
    labelEn: "Pressure Regulating & Metering Station",
    shortName: "Poste détente PRMS",
    category: "Instrumentation & Ligne",
    standard: "EN 12186 / ASME B31.8",
    materialDefault: "Régulateur pilote + Filtres cartouches",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 300 / Class 150"],
    dimensions: [
      { dn: 150, nps: "6\"", odMm: 168.3, lengthMm: 3200, weightKg: 1650 },
    ],
  },
  gare_racleur_depart: {
    id: "gare_racleur_depart",
    code: "TC-PIG-LNCH",
    labelFr: "Gare de racleurs départ (Pig Launcher) avec fermeture rapide",
    labelEn: "Scraper Pig Launcher Barrel",
    shortName: "Gare départ racleur",
    category: "Instrumentation & Ligne",
    standard: "ASME Section VIII Div 1 / API 6D",
    materialDefault: "A516 Gr 70 / A105 / Fermeture rapide",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 600", "Class 900"],
    dimensions: [
      { dn: 300, nps: "12\"/16\"", odMm: 406.4, lengthMm: 3800, weightKg: 2400 },
    ],
  },
  gare_racleur_arrivee: {
    id: "gare_racleur_arrivee",
    code: "TC-PIG-RECV",
    labelFr: "Gare de racleurs arrivée (Pig Receiver) avec vanne de purge",
    labelEn: "Scraper Pig Receiver Barrel",
    shortName: "Gare arrivée racleur",
    category: "Instrumentation & Ligne",
    standard: "ASME Section VIII Div 1 / API 6D",
    materialDefault: "A516 Gr 70 / A105",
    connectionDefault: "butt_weld",
    pressureClasses: ["Class 600", "Class 900"],
    dimensions: [
      { dn: 300, nps: "12\"/16\"", odMm: 406.4, lengthMm: 4200, weightKg: 2600 },
    ],
  },
};

/** Alias de compatibilité ascendante */
export const TROUVAY_CAUVIN_CATALOG = PDI_INTERNATIONAL_PIPING_CATALOG;

/**
 * Générateur de symbologie vectorielle normalisée pure (SVG path)
 * pour affichage en vignette dans :
 * 1. Les colonnes BOM / Matériel de la planche d'impression
 * 2. Les colonnes Supports & Génie Civil
 * 3. L'inspecteur et la bibliothèque de composants
 */
export function getComponentVignetteSvg(
  type: IsoFittingType | string,
  options?: { isPrint?: boolean; strokeWidth?: number }
): string {
  const isPrint = options?.isPrint ?? true;
  const sw = options?.strokeWidth ?? 1.2;

  // Couleurs adaptées
  const cValve = isPrint ? "#0284c7" : "#38bdf8";
  const cBend = isPrint ? "#d97706" : "#f59e0b";
  const cTee = isPrint ? "#16a34a" : "#22c55e";
  const cFlange = isPrint ? "#b45309" : "#fbbf24";
  const cReducer = isPrint ? "#475569" : "#94a3b8";
  const cSafety = isPrint ? "#dc2626" : "#ef4444";
  const cInst = isPrint ? "#0891b2" : "#06b6d4";
  const cStation = isPrint ? "#7c3aed" : "#a855f7";
  const fillDark = isPrint ? "#ffffff" : "#0f172a";

  switch (type) {
    // ---- TÉS & PIQUAGES ----
    case "te_egal":
      return `<path d="M -7 0 H 7 M 0 0 V -7" stroke="${cTee}" stroke-width="${sw * 1.5}" stroke-linecap="round"/>` +
             `<circle cx="0" cy="-7" r="1.5" fill="${cTee}"/>`;
    case "te_reduit":
      return `<path d="M -7 0 H 7 M 0 0 V -6" stroke="${cTee}" stroke-width="${sw * 1.5}" stroke-linecap="round"/>` +
             `<circle cx="0" cy="-6" r="1.2" fill="${cTee}"/>` +
             `<line x1="0" y1="-2" x2="3" y2="-2" stroke="${cTee}" stroke-width="${sw * 0.8}"/>`;
    case "te_barre":
      return `<path d="M -7 0 H 7 M 0 0 V -7" stroke="${cTee}" stroke-width="${sw * 1.5}" stroke-linecap="round"/>` +
             `<line x1="-3" y1="-3.5" x2="3" y2="-3.5" stroke="${cTee}" stroke-width="${sw * 0.9}"/>` +
             `<line x1="-2" y1="-5.5" x2="2" y2="-5.5" stroke="${cTee}" stroke-width="${sw * 0.9}"/>`;
    case "croix":
      return `<path d="M -7 0 H 7 M 0 -7 V 7" stroke="${cTee}" stroke-width="${sw * 1.4}" stroke-linecap="round"/>` +
             `<circle cx="0" cy="0" r="1.5" fill="${cTee}"/>`;
    case "weldolet":
      return `<path d="M -7 3 H 7 M 0 3 V -5" stroke="${cTee}" stroke-width="${sw}" stroke-linecap="round"/>` +
             `<polygon points="-3,3 3,3 2,-3 -2,-3" fill="${cTee}" fill-opacity="0.3" stroke="${cTee}" stroke-width="${sw * 0.8}"/>`;
    case "threadolet":
    case "sockolet":
      return `<path d="M -7 3 H 7 M 0 3 V -5" stroke="${cTee}" stroke-width="${sw}" stroke-linecap="round"/>` +
             `<rect x="-2.5" y="-3" width="5" height="5" fill="${cTee}" fill-opacity="0.3" stroke="${cTee}" stroke-width="${sw * 0.8}"/>`;
    case "piquage":
      return `<path d="M -7 0 H 7 M 0 0 V -7" stroke="${cTee}" stroke-width="${sw * 1.2}"/>`;

    // ---- COUDES & CINTRES ----
    case "coude_90":
      return `<path d="M -6 6 Q -6 -6 6 -6" stroke="${cBend}" stroke-width="${sw * 1.8}" fill="none" stroke-linecap="round"/>`;
    case "coude_90_sr":
      return `<path d="M -5 5 Q -5 -5 5 -5" stroke="${cBend}" stroke-width="${sw * 1.8}" fill="none" stroke-linecap="round"/>` +
             `<text x="0" y="5" font-size="3.5" font-weight="bold" fill="${cBend}" text-anchor="middle">SR</text>`;
    case "coude_45":
      return `<path d="M -6 5 L 0 5 L 5 -3" stroke="${cBend}" stroke-width="${sw * 1.8}" fill="none" stroke-linecap="round"/>`;
    case "coude_30":
    case "coude_22_5":
      return `<path d="M -6 4 L 0 4 L 5 0" stroke="${cBend}" stroke-width="${sw * 1.8}" fill="none" stroke-linecap="round"/>`;
    case "coude_3d":
    case "coude_5d":
      return `<path d="M -7 7 Q -7 -7 7 -7" stroke="${cBend}" stroke-width="${sw * 1.8}" fill="none" stroke-linecap="round"/>` +
             `<text x="0" y="4" font-size="3" font-weight="bold" fill="${cBend}" text-anchor="middle">${type === "coude_3d" ? "3D" : "5D"}</text>`;
    case "coude_180":
      return `<path d="M -4 6 V -2 A 4 4 0 0 1 4 -2 V 6" stroke="${cBend}" stroke-width="${sw * 1.8}" fill="none" stroke-linecap="round"/>`;

    // ---- RÉDUCTIONS & FONDS ----
    case "reduction_concentrique":
      return `<polygon points="-6,-5 6,-2 6,2 -6,5" fill="${isPrint ? "#e2e8f0" : "#1e293b"}" stroke="${cReducer}" stroke-width="${sw}"/>` +
             `<line x1="-6" y1="0" x2="6" y2="0" stroke="${cReducer}" stroke-width="${sw * 0.7}" stroke-dasharray="1 1"/>`;
    case "reduction_excentrique":
      return `<polygon points="-6,-5 6,-1 6,4 -6,4" fill="${isPrint ? "#e2e8f0" : "#1e293b"}" stroke="${cReducer}" stroke-width="${sw}"/>` +
             `<line x1="-6" y1="4" x2="6" y2="4" stroke="${cReducer}" stroke-width="${sw * 1.2}"/>`; // Plat bas marqué
    case "fond_bombe":
      return `<line x1="-5" y1="0" x2="1" y2="0" stroke="${cReducer}" stroke-width="${sw * 1.5}"/>` +
             `<path d="M 1 -5 Q 6 0 1 5 Z" fill="${isPrint ? "#e2e8f0" : "#1e293b"}" stroke="${cReducer}" stroke-width="${sw}"/>`;

    // ---- BRIDES & JOINTS ----
    case "bride_wn":
      return `<line x1="-6" y1="0" x2="-2" y2="0" stroke="${cFlange}" stroke-width="${sw * 1.4}"/>` +
             `<polygon points="-2,-2 1,-5 1,5 -2,2" fill="${cFlange}" stroke="${cFlange}" stroke-width="${sw * 0.6}"/>` +
             `<line x1="2" y1="-6" x2="2" y2="6" stroke="${cFlange}" stroke-width="${sw * 1.8}"/>`;
    case "bride_so":
      return `<line x1="-5" y1="0" x2="1" y2="0" stroke="${cFlange}" stroke-width="${sw * 1.4}"/>` +
             `<rect x="1" y="-5" width="2.5" height="10" fill="${cFlange}" stroke="${cFlange}" stroke-width="${sw * 0.6}"/>`;
    case "bride_pleine":
      return `<line x1="-6" y1="0" x2="0" y2="0" stroke="${cFlange}" stroke-width="${sw * 1.4}"/>` +
             `<line x1="0" y1="-6" x2="0" y2="6" stroke="${cFlange}" stroke-width="${sw * 2.2}"/>` +
             `<line x1="-2" y1="-6" x2="0" y2="-6" stroke="${cFlange}" stroke-width="${sw}"/>` +
             `<line x1="-2" y1="6" x2="0" y2="6" stroke="${cFlange}" stroke-width="${sw}"/>`;
    case "bride_sw":
    case "bride_lap_joint":
      return `<line x1="-5" y1="0" x2="1" y2="0" stroke="${cFlange}" stroke-width="${sw * 1.4}"/>` +
             `<line x1="1" y1="-5.5" x2="1" y2="5.5" stroke="${cFlange}" stroke-width="${sw * 2}"/>`;
    case "joint":
      return `<line x1="-2" y1="-6" x2="-2" y2="6" stroke="${cFlange}" stroke-width="${sw * 1.8}"/>` +
             `<line x1="2" y1="-6" x2="2" y2="6" stroke="${cFlange}" stroke-width="${sw * 1.8}"/>` +
             `<line x1="-2" y1="0" x2="2" y2="0" stroke="${cFlange}" stroke-width="${sw * 1.2}"/>`;
    case "jmi":
      return `<line x1="-3.5" y1="-6.5" x2="-3.5" y2="6.5" stroke="${cFlange}" stroke-width="${sw * 2}"/>` +
             `<line x1="3.5" y1="-6.5" x2="3.5" y2="6.5" stroke="${cFlange}" stroke-width="${sw * 2}"/>` +
             `<rect x="-2" y="-4" width="4" height="8" fill="#eab308" stroke="#ca8a04" stroke-width="0.5"/>` +
             `<line x1="-2" y1="-2" x2="2" y2="2" stroke="#ffffff" stroke-width="0.7"/>`;
    case "diaphragme":
      return `<line x1="-6" y1="0" x2="6" y2="0" stroke="${cFlange}" stroke-width="${sw * 1.2}"/>` +
             `<line x1="0" y1="-7" x2="0" y2="7" stroke="${cFlange}" stroke-width="${sw * 1.8}"/>` +
             `<circle cx="0" cy="0" r="1.5" fill="${fillDark}" stroke="${cFlange}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="-2" y1="-7" x2="-2" y2="-9" stroke="${cInst}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="2" y1="-7" x2="2" y2="-9" stroke="${cInst}" stroke-width="${sw * 0.8}"/>`;

    // ---- ROBINETTERIE INDUSTRIELLE ----
    case "vanne_passage_total":
    case "vanne_boisseau":
      return `<polygon points="-7,-4.5 0,0 -7,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<polygon points="7,-4.5 0,0 7,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<circle cx="0" cy="0" r="2" fill="${fillDark}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="0" y1="0" x2="0" y2="-7" stroke="${cValve}" stroke-width="${sw}"/>` +
             `<line x1="-3.5" y1="-7" x2="3.5" y2="-7" stroke="${cValve}" stroke-width="${sw * 1.2}"/>`;
    case "vanne_opercule":
      return `<polygon points="-7,-4.5 0,0 -7,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<polygon points="7,-4.5 0,0 7,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="0" y1="0" x2="0" y2="-8" stroke="${cValve}" stroke-width="${sw}"/>` +
             `<circle cx="0" cy="-8" r="2.5" fill="none" stroke="${cValve}" stroke-width="${sw}"/>`; // Volant rond
    case "vanne_soupape":
      return `<polygon points="-7,-4.5 0,0 -7,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<polygon points="7,-4.5 0,0 7,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<circle cx="0" cy="0" r="1.5" fill="${cValve}"/>` +
             `<line x1="0" y1="0" x2="0" y2="-8" stroke="${cValve}" stroke-width="${sw}"/>` +
             `<ellipse cx="0" cy="-8" rx="3.5" ry="1.2" fill="none" stroke="${cValve}" stroke-width="${sw}"/>`;
    case "vanne_papillon":
      return `<line x1="-7" y1="0" x2="7" y2="0" stroke="${cValve}" stroke-width="${sw * 1.2}"/>` +
             `<circle cx="0" cy="0" r="5" fill="none" stroke="${cValve}" stroke-width="${sw}"/>` +
             `<line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke="${cValve}" stroke-width="${sw * 1.8}"/>` +
             `<line x1="0" y1="-5" x2="0" y2="-8" stroke="${cValve}" stroke-width="${sw}"/>` +
             `<line x1="0" y1="-8" x2="4" y2="-8" stroke="${cValve}" stroke-width="${sw * 1.2}"/>`;
    case "clapet":
      return `<polygon points="-6,-4.5 2,0 -6,4.5" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="3" y1="-5.5" x2="3" y2="5.5" stroke="${cValve}" stroke-width="${sw * 1.8}"/>` +
             `<circle cx="3" cy="-4" r="1" fill="${cValve}"/>`;
    case "clapet_bille":
      return `<line x1="-7" y1="0" x2="-2" y2="0" stroke="${cValve}" stroke-width="${sw * 1.2}"/>` +
             `<line x1="2" y1="0" x2="7" y2="0" stroke="${cValve}" stroke-width="${sw * 1.2}"/>` +
             `<circle cx="0" cy="0" r="3.5" fill="none" stroke="${cValve}" stroke-width="${sw}"/>` +
             `<circle cx="0.5" cy="0" r="2" fill="${cValve}"/>`;
    case "soupape":
      return `<path d="M -5 0 H 5 M 0 0 V -5 M -3 -5 H 3" stroke="${cSafety}" stroke-width="${sw * 1.2}"/>` +
             `<rect x="-2" y="-9" width="4" height="4" fill="${cSafety}" fill-opacity="0.2" stroke="${cSafety}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="2" y1="-7" x2="6" y2="-7" stroke="${cSafety}" stroke-width="${sw * 1.2}"/>` +
             `<path d="M 6 -8.5 L 8 -7 L 6 -5.5 Z" fill="${cSafety}"/>`; // Buse d'échappement
    case "robinet_pointeau":
      return `<polygon points="-5,-3 0,0 -5,3" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<polygon points="5,-3 0,0 5,3" fill="${cValve}" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="0" y1="0" x2="0" y2="-7" stroke="${cValve}" stroke-width="${sw * 0.8}"/>` +
             `<line x1="-2" y1="-7" x2="2" y2="-7" stroke="${cValve}" stroke-width="${sw * 1.2}"/>`;

    // ---- INSTRUMENTATION & POSTES ----
    case "purge":
    case "event":
      return `<line x1="0" y1="0" x2="0" y2="-6" stroke="${cInst}" stroke-width="${sw * 1.2}"/>` +
             `<line x1="-2.5" y1="-6" x2="2.5" y2="-6" stroke="${cInst}" stroke-width="${sw * 1.2}"/>` +
             `<line x1="0" y1="-6" x2="0" y2="-9" stroke="${cInst}" stroke-width="${sw}"/>` +
             `<circle cx="0" cy="-9" r="1.2" fill="${cInst}"/>`;
    case "manometre":
      return `<line x1="0" y1="0" x2="0" y2="-5" stroke="${cInst}" stroke-width="${sw * 1.2}"/>` +
             `<circle cx="0" cy="-9" r="4" fill="${fillDark}" stroke="${cInst}" stroke-width="${sw * 1.2}"/>` +
             `<line x1="0" y1="-9" x2="2" y2="-11.5" stroke="${cInst}" stroke-width="${sw * 1.2}"/>`;
    case "prise_pression":
      return `<line x1="0" y1="0" x2="0" y2="-6" stroke="${cInst}" stroke-width="${sw * 1.2}"/>` +
             `<rect x="-2" y="-8" width="4" height="2" fill="${cInst}" stroke="${cInst}" stroke-width="0.5"/>`;
    case "poste_sectionnement":
    case "poste_coupure":
    case "poste_detente":
      return `<rect x="-7" y="-5" width="14" height="10" rx="1.5" fill="${isPrint ? "#f5f3ff" : "#1e1b4b"}" stroke="${cStation}" stroke-width="${sw}"/>` +
             `<line x1="-7" y1="0" x2="7" y2="0" stroke="${cStation}" stroke-width="${sw * 0.8}"/>` +
             `<circle cx="0" cy="0" r="2.5" fill="${cStation}"/>`;
    case "gare_racleur_depart":
    case "gare_racleur_arrivee":
      return `<rect x="-8" y="-4.5" width="16" height="9" rx="1.5" fill="${isPrint ? "#fdf4ff" : "#2e1065"}" stroke="${cStation}" stroke-width="${sw}"/>` +
             `<line x1="4" y1="-4.5" x2="4" y2="4.5" stroke="${cStation}" stroke-width="${sw * 1.5}"/>` +
             `<line x1="-8" y1="0" x2="-4" y2="0" stroke="${cStation}" stroke-width="${sw * 1.2}"/>`;

    // ---- GÉNIE CIVIL & INFRASTRUCTURES ----
    case "massif_beton_gc":
      return `<rect x="-7" y="-5" width="14" height="10" fill="${isPrint ? "#f1f5f9" : "#1e293b"}" stroke="#10b981" stroke-width="${sw * 1.2}"/>` +
             `<line x1="-7" y1="-5" x2="7" y2="5" stroke="#10b981" stroke-width="${sw * 0.7}" stroke-dasharray="2 1.5"/>` +
             `<line x1="-7" y1="5" x2="7" y2="-5" stroke="#10b981" stroke-width="${sw * 0.7}" stroke-dasharray="2 1.5"/>`;

    case "butee_ancrage_gc":
      return `<polygon points="-7,5 7,5 4,-5 -4,-5" fill="${isPrint ? "#ecfdf5" : "#064e3b"}" stroke="#10b981" stroke-width="${sw * 1.2}"/>` +
             `<line x1="-5" y1="5" x2="-3" y2="7" stroke="#10b981" stroke-width="${sw}"/>` +
             `<line x1="0" y1="5" x2="2" y2="7" stroke="#10b981" stroke-width="${sw}"/>` +
             `<line x1="5" y1="5" x2="7" y2="7" stroke="#10b981" stroke-width="${sw}"/>`;

    case "traversee_murale_gc":
      return `<rect x="-3" y="-7" width="6" height="14" fill="${isPrint ? "#f8fafc" : "#334155"}" stroke="#10b981" stroke-width="${sw * 1.2}"/>` +
             `<line x1="-7" y1="0" x2="7" y2="0" stroke="#06b6d4" stroke-width="${sw * 1.8}"/>` +
             `<circle cx="-3" cy="0" r="1.5" fill="#10b981"/>` +
             `<circle cx="3" cy="0" r="1.5" fill="#10b981"/>`;

    case "caniveau_beton_gc":
      return `<path d="M -7 -6 V 4 H 7 V -6" fill="${isPrint ? "#f1f5f9" : "#1e293b"}" stroke="#10b981" stroke-width="${sw * 1.3}"/>` +
             `<line x1="-8" y1="-6" x2="8" y2="-6" stroke="#10b981" stroke-width="${sw * 1.6}"/>` +
             `<circle cx="0" cy="0" r="2" fill="none" stroke="#06b6d4" stroke-width="${sw}"/>`;

    case "fourreau_route_gc":
      return `<rect x="-7" y="-4" width="14" height="8" rx="2" fill="none" stroke="#f59e0b" stroke-width="${sw * 1.4}"/>` +
             `<line x1="-7" y1="0" x2="7" y2="0" stroke="#06b6d4" stroke-width="${sw * 1.6}"/>` +
             `<line x1="-7" y1="-6" x2="7" y2="-6" stroke="#94a3b8" stroke-width="${sw}" stroke-dasharray="3 2"/>`;

    case "regard_vanne_gc":
      return `<rect x="-6" y="-6" width="12" height="12" fill="${isPrint ? "#f8fafc" : "#1e293b"}" stroke="#10b981" stroke-width="${sw * 1.4}"/>` +
             `<circle cx="0" cy="0" r="3" fill="none" stroke="#10b981" stroke-width="${sw}"/>` +
             `<line x1="0" y1="-3" x2="0" y2="3" stroke="#10b981" stroke-width="${sw}"/>` +
             `<line x1="-3" y1="0" x2="3" y2="0" stroke="#10b981" stroke-width="${sw}"/>`;

    case "portique_rack_gc":
      return `<line x1="-6" y1="6" x2="-6" y2="-4" stroke="#10b981" stroke-width="${sw * 1.5}"/>` +
             `<line x1="6" y1="6" x2="6" y2="-4" stroke="#10b981" stroke-width="${sw * 1.5}"/>` +
             `<line x1="-7" y1="-4" x2="7" y2="-4" stroke="#10b981" stroke-width="${sw * 2}"/>` +
             `<circle cx="0" cy="-4" r="1.5" fill="#06b6d4"/>`;

    case "cloture_securite_gc":
      return `<line x1="-7" y1="4" x2="7" y2="4" stroke="#10b981" stroke-width="${sw * 1.6}"/>` +
             `<line x1="-5" y1="4" x2="-5" y2="-5" stroke="#94a3b8" stroke-width="${sw}"/>` +
             `<line x1="0" y1="4" x2="0" y2="-5" stroke="#94a3b8" stroke-width="${sw}"/>` +
             `<line x1="5" y1="4" x2="5" y2="-5" stroke="#94a3b8" stroke-width="${sw}"/>` +
             `<line x1="-7" y1="-5" x2="7" y2="-5" stroke="#94a3b8" stroke-width="${sw * 0.8}" stroke-dasharray="2 2"/>`;

    default:
      // Tronçon de tube standard par défaut
      return `<line x1="-7" y1="-2" x2="7" y2="-2" stroke="#64748b" stroke-width="${sw}"/>` +
             `<line x1="-7" y1="2" x2="7" y2="2" stroke="#64748b" stroke-width="${sw}"/>` +
             `<line x1="0" y1="-2" x2="0" y2="2" stroke="#94a3b8" stroke-width="${sw * 0.8}" stroke-dasharray="1 1"/>`;
  }
}

/**
 * Symbologie normalisée des supports mécaniques MSS SP-58
 */
export function getMssSupportVignetteSvg(
  type: string,
  isPrint: boolean = true
): string {
  const cSup = isPrint ? "#0891b2" : "#22d3ee";
  const cSteel = isPrint ? "#334155" : "#94a3b8";
  const sw = 1.2;

  switch (type) {
    case "mss_type_35": // Guide avec patin coulissant
      return `<line x1="-7" y1="0" x2="7" y2="0" stroke="${cSteel}" stroke-width="${sw * 1.5}"/>` +
             `<rect x="-4" y="0" width="8" height="3" fill="${cSup}" fill-opacity="0.3" stroke="${cSup}" stroke-width="${sw}"/>` +
             `<line x1="-5" y1="-2" x2="-5" y2="5" stroke="${cSup}" stroke-width="${sw * 1.5}"/>` +
             `<line x1="5" y1="-2" x2="5" y2="5" stroke="${cSup}" stroke-width="${sw * 1.5}"/>` +
             `<line x1="-7" y1="5" x2="7" y2="5" stroke="${cSteel}" stroke-width="${sw * 1.8}"/>`;

    case "mss_type_57": // Point fixe / Ancrage rigide
      return `<line x1="-7" y1="0" x2="7" y2="0" stroke="${cSteel}" stroke-width="${sw * 1.5}"/>` +
             `<polygon points="-4,0 4,0 2,5 -2,5" fill="${cSup}" stroke="${cSup}" stroke-width="${sw}"/>` +
             `<line x1="-6" y1="5" x2="6" y2="5" stroke="${cSteel}" stroke-width="${sw * 2}"/>` +
             `<line x1="-4" y1="7" x2="-2" y2="5" stroke="${cSteel}" stroke-width="0.8"/>` +
             `<line x1="0" y1="7" x2="2" y2="5" stroke="${cSteel}" stroke-width="0.8"/>` +
             `<line x1="4" y1="7" x2="6" y2="5" stroke="${cSteel}" stroke-width="0.8"/>`;

    case "mss_type_1": // Pendard réglable
      return `<line x1="-7" y1="3" x2="7" y2="3" stroke="${cSteel}" stroke-width="${sw * 1.5}"/>` +
             `<path d="M -4 3 C -4 7 4 7 4 3" fill="none" stroke="${cSup}" stroke-width="${sw * 1.4}"/>` +
             `<line x1="0" y1="3" x2="0" y2="-6" stroke="${cSup}" stroke-width="${sw * 1.2}"/>` +
             `<circle cx="0" cy="-6" r="1.5" fill="none" stroke="${cSup}" stroke-width="${sw}"/>` +
             `<line x1="-4" y1="-7.5" x2="4" y2="-7.5" stroke="${cSteel}" stroke-width="${sw * 1.6}"/>`;

    case "mss_type_51": // Boîte à ressort (Spring hanger)
      return `<line x1="-7" y1="4" x2="7" y2="4" stroke="${cSteel}" stroke-width="${sw * 1.5}"/>` +
             `<rect x="-3.5" y="-5" width="7" height="9" fill="${cSup}" fill-opacity="0.2" stroke="${cSup}" stroke-width="${sw}"/>` +
             `<path d="M -2 -3 L 2 -1.5 L -2 0 L 2 1.5 L -2 3" fill="none" stroke="${cSup}" stroke-width="${sw}"/>` +
             `<line x1="0" y1="-5" x2="0" y2="-8" stroke="${cSup}" stroke-width="${sw}"/>`;

    case "mss_type_8":
    case "mss_type_26": // Collier de serrage
    default:
      return `<circle cx="0" cy="0" r="4.5" fill="none" stroke="${cSup}" stroke-width="${sw * 1.4}"/>` +
             `<line x1="-6" y1="0" x2="6" y2="0" stroke="${cSup}" stroke-width="${sw}"/>` +
             `<line x1="0" y1="4.5" x2="0" y2="8" stroke="${cSteel}" stroke-width="${sw * 1.5}"/>` +
             `<line x1="-4" y1="8" x2="4" y2="8" stroke="${cSteel}" stroke-width="${sw * 1.8}"/>`;
  }
}

/**
 * Symbologie normalisée de Génie Civil (Fondation béton + ancrage)
 */
export function getCivilMassifVignetteSvg(isPrint: boolean = true): string {
  const cConcrete = isPrint ? "#94a3b8" : "#64748b";
  const cRebar = isPrint ? "#0e7490" : "#06b6d4";
  const cPlate = isPrint ? "#0f172a" : "#cbd5e1";

  return `<line x1="-7" y1="-5" x2="7" y2="-5" stroke="${cPlate}" stroke-width="2.2"/>` +
         `<rect x="-6" y="-3.5" width="12" height="10.5" fill="${isPrint ? "#f8fafc" : "#1e293b"}" stroke="${cConcrete}" stroke-width="1.2"/>` +
         `<path d="M -3.5 -5 V 3 Q -3.5 5 -1.5 5" fill="none" stroke="${cRebar}" stroke-width="1"/>` +
         `<path d="M 3.5 -5 V 3 Q 3.5 5 5.5 5" fill="none" stroke="${cRebar}" stroke-width="1"/>` +
         `<circle cx="-2" cy="0" r="0.6" fill="${cConcrete}"/>` +
         `<circle cx="2" cy="2" r="0.6" fill="${cConcrete}"/>` +
         `<circle cx="0" cy="-1" r="0.6" fill="${cConcrete}"/>`;
}
