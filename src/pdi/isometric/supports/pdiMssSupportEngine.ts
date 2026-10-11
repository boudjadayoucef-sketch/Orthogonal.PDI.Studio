/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * PALIER 2C : MOTEUR DE SUPPORTS NORMALISÉS MSS SP-58 / SP-69 & QUANTITATIFS GÉNIE CIVIL
 */

import { IsoNode, IsoSegment } from "../types/isoGraphTypes";

export type MssSupportCode =
  | "mss_type_1"   // Pendard simple réglable (Rod Hanger)
  | "mss_type_8"   // Collier vertical pour colonne montante (Riser Clamp)
  | "mss_type_26"  // Collier 3 boulons pour tuyauterie haute température (3-Bolt Clamp)
  | "mss_type_35"  // Guide coulissant transversal & axial (Pipe Slide and Guide)
  | "mss_type_39"  // Patin soudé / supportage isolé (Steel Pipe Shoe)
  | "mss_type_51"  // Boîte à ressort variable (Variable Spring Hanger)
  | "mss_type_57"; // Point fixe rigide / Ancrage intégral (Welded / Bolted Anchor)

export interface MssSupportDefinition {
  code: MssSupportCode;
  mssStandardNumber: number;
  labelFr: string;
  labelEn: string;
  category: "rigide" | "guide" | "elastique" | "pendard" | "point_fixe";
  restraints: {
    fx: boolean; // Reprise axiale / translation X
    fy: boolean; // Reprise transversale / translation Y
    fz: boolean; // Reprise verticale / gravitation Z
    mx: boolean; // Moment de torsion
    my: boolean; // Moment de flexion
    mz: boolean; // Moment de flexion
  };
  symbolShape: "anchor_cross" | "guide_slider" | "rod_triangle" | "shoe_tee" | "spring_box" | "clamp_ring";
  defaultWeightKg: number;
}

export const MSS_SUPPORT_CATALOG: Record<MssSupportCode, MssSupportDefinition> = {
  mss_type_1: {
    code: "mss_type_1",
    mssStandardNumber: 1,
    labelFr: "Pendard simple réglable à tige",
    labelEn: "Adjustable Steel Band / Rod Hanger",
    category: "pendard",
    restraints: { fx: false, fy: false, fz: true, mx: false, my: false, mz: false },
    symbolShape: "rod_triangle",
    defaultWeightKg: 4.8,
  },
  mss_type_8: {
    code: "mss_type_8",
    mssStandardNumber: 8,
    labelFr: "Collier de colonne montante",
    labelEn: "Extension Pipe / Riser Clamp",
    category: "rigide",
    restraints: { fx: false, fy: false, fz: true, mx: false, my: false, mz: false },
    symbolShape: "clamp_ring",
    defaultWeightKg: 8.5,
  },
  mss_type_26: {
    code: "mss_type_26",
    mssStandardNumber: 26,
    labelFr: "Collier 3 boulons haute température",
    labelEn: "Three Bolt Pipe Clamp",
    category: "rigide",
    restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false },
    symbolShape: "clamp_ring",
    defaultWeightKg: 12.0,
  },
  mss_type_35: {
    code: "mss_type_35",
    mssStandardNumber: 35,
    labelFr: "Guide coulissant (Guide & Slide)",
    labelEn: "Pipe Slide and Guide Plate",
    category: "guide",
    restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false },
    symbolShape: "guide_slider",
    defaultWeightKg: 16.5,
  },
  mss_type_39: {
    code: "mss_type_39",
    mssStandardNumber: 39,
    labelFr: "Patin soudé isolé (Shoe)",
    labelEn: "Fabricated Steel Pipe Shoe",
    category: "rigide",
    restraints: { fx: false, fy: false, fz: true, mx: false, my: false, mz: false },
    symbolShape: "shoe_tee",
    defaultWeightKg: 14.2,
  },
  mss_type_51: {
    code: "mss_type_51",
    mssStandardNumber: 51,
    labelFr: "Support à ressort variable",
    labelEn: "Variable Spring Hanger / Canister",
    category: "elastique",
    restraints: { fx: false, fy: false, fz: true, mx: false, my: false, mz: false },
    symbolShape: "spring_box",
    defaultWeightKg: 28.0,
  },
  mss_type_57: {
    code: "mss_type_57",
    mssStandardNumber: 57,
    labelFr: "Point fixe rigide (Anchor)",
    labelEn: "Integral Welded / Bolted Pipe Anchor",
    category: "point_fixe",
    restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
    symbolShape: "anchor_cross",
    defaultWeightKg: 35.0,
  },
};

/**
 * Données de Génie Civil associées à une platine d'ancrage et un massif béton
 */
export interface CivilEngineeringSpec {
  // Platine métallique
  basePlateLengthMm: number;    // Longueur platine (ex: 250 mm)
  basePlateWidthMm: number;     // Largeur platine (ex: 200 mm)
  basePlateThicknessMm: number; // Épaisseur platine (ex: 15 mm)
  steelGrade: "S235JR" | "S275JR" | "S355JR" | "AISI 304" | "AISI 316";
  calculatedPlateWeightKg: number; // Masse acier volumique 7850 kg/m³

  // Ancrages béton (EN 1992-4 / ACI 318)
  anchorType: "mechanical_expansion" | "chemical_threaded_rod" | "cast_in_place_j_bolt";
  anchorDiameter: "M10" | "M12" | "M16" | "M20" | "M24" | "M30";
  anchorCount: number;          // 2 ou 4 goujons
  anchorEmbedmentDepthMm: number; // Profondeur d'ancrage h_ef (ex: 120 mm)

  // Massif / Dé de fondation béton
  foundationType: "dalle_existante" | "massif_isole" | "corbeau_ba" | "structure_metallique";
  foundationLengthM: number;    // Longueur (ex: 0.6 m)
  foundationWidthM: number;     // Largeur (ex: 0.6 m)
  foundationHeightM: number;    // Hauteur (ex: 0.5 m)
  calculatedConcreteVolumeM3: number; // Volume béton m³
  concreteGrade: "C20/25" | "C25/30" | "C30/37";
}

/**
 * Instance concrète d'un support placé dans le graphe
 */
export interface IsoPipingSupport {
  id: string;
  tag: string;                  // ex: "SUP-101", "FIX-01", "GDE-02"
  type: MssSupportCode;
  segmentId: string;            // Tronçon porteur
  tRatio: number;               // Position normalisée le long du segment [0.0 - 1.0]
  distanceFromFromNodeM: number; // Distance métrique depuis le nœud d'origine
  worldPos: { x: number; y: number; z: number }; // Coordonnées 3D réelles calculées
  elevationZ: number;
  orientationAngleDeg: number;  // Rotation par rapport à la normale du tube (0° = vertical bas)
  comments?: string;
  civilSpec: CivilEngineeringSpec;
  customLoads?: { fx?: number; fy?: number; fz?: number };
}

/**
 * Calcul du poids de la platine acier selon la nuance et les dimensions (masse volumique standard = 7850 kg/m³)
 */
export function calculateBasePlateWeight(lengthMm: number, widthMm: number, thicknessMm: number): number {
  const volM3 = (lengthMm / 1000) * (widthMm / 1000) * (thicknessMm / 1000);
  return Number((volM3 * 7850).toFixed(2));
}

/**
 * Calcul du volume de béton du massif
 */
export function calculateConcreteVolume(lengthM: number, widthM: number, heightM: number): number {
  return Number((lengthM * widthM * heightM).toFixed(3));
}

/**
 * Générateur de spécification Génie Civil par défaut selon le DN de la ligne de tuyauterie
 */
export function createDefaultCivilSpecForDn(dn: number): CivilEngineeringSpec {
  let lengthMm = 200;
  let widthMm = 150;
  let thicknessMm = 12;
  let anchorDia: "M10" | "M12" | "M16" | "M20" | "M24" | "M30" = "M12";
  let anchorCount = 4;
  let embedmentDepthMm = 100;

  let fLengthM = 0.5;
  let fWidthM = 0.5;
  let fHeightM = 0.4;

  if (dn >= 300) {
    lengthMm = 450;
    widthMm = 350;
    thicknessMm = 25;
    anchorDia = "M24";
    embedmentDepthMm = 200;
    fLengthM = 1.0;
    fWidthM = 0.9;
    fHeightM = 0.8;
  } else if (dn >= 200) {
    lengthMm = 350;
    widthMm = 280;
    thicknessMm = 20;
    anchorDia = "M20";
    embedmentDepthMm = 160;
    fLengthM = 0.8;
    fWidthM = 0.7;
    fHeightM = 0.6;
  } else if (dn >= 100) {
    lengthMm = 280;
    widthMm = 220;
    thicknessMm = 15;
    anchorDia = "M16";
    embedmentDepthMm = 130;
    fLengthM = 0.6;
    fWidthM = 0.6;
    fHeightM = 0.5;
  }

  return {
    basePlateLengthMm: lengthMm,
    basePlateWidthMm: widthMm,
    basePlateThicknessMm: thicknessMm,
    steelGrade: "S235JR",
    calculatedPlateWeightKg: calculateBasePlateWeight(lengthMm, widthMm, thicknessMm),

    anchorType: "chemical_threaded_rod",
    anchorDiameter: anchorDia,
    anchorCount: anchorCount,
    anchorEmbedmentDepthMm: embedmentDepthMm,

    foundationType: "massif_isole",
    foundationLengthM: fLengthM,
    foundationWidthM: fWidthM,
    foundationHeightM: fHeightM,
    calculatedConcreteVolumeM3: calculateConcreteVolume(fLengthM, fWidthM, fHeightM),
    concreteGrade: "C25/30",
  };
}

/**
 * PORTÉES MAXIMALES ADMISSIBLES ENTRE SUPPORTS (MAXIMUM SPAN)
 * Référence : ASME B31.3 Tableau 321.1.3 & ASME B31.1 Tableau 121.5
 * Basé sur une flèche limite de 2.5 mm et des contraintes admissibles acier carbone standard.
 */
export interface SpanSpec {
  dn: number;
  npsInch: string;
  maxSpanWaterM: number; // Tuyauterie remplie d'eau / liquide (densité 1000 kg/m³)
  maxSpanGasM: number;   // Tuyauterie vapeur / gaz / air (charge allégée)
}

export const ASME_B31_3_MAX_SPANS: Record<number, SpanSpec> = {
  15:  { dn: 15,  npsInch: '1/2"',  maxSpanWaterM: 2.1, maxSpanGasM: 2.7 },
  20:  { dn: 20,  npsInch: '3/4"',  maxSpanWaterM: 2.4, maxSpanGasM: 3.0 },
  25:  { dn: 25,  npsInch: '1"',    maxSpanWaterM: 2.7, maxSpanGasM: 3.4 },
  32:  { dn: 32,  npsInch: '1"1/4', maxSpanWaterM: 3.0, maxSpanGasM: 3.8 },
  40:  { dn: 40,  npsInch: '1"1/2', maxSpanWaterM: 3.3, maxSpanGasM: 4.2 },
  50:  { dn: 50,  npsInch: '2"',    maxSpanWaterM: 3.6, maxSpanGasM: 4.6 },
  65:  { dn: 65,  npsInch: '2"1/2', maxSpanWaterM: 4.0, maxSpanGasM: 5.2 },
  80:  { dn: 80,  npsInch: '3"',    maxSpanWaterM: 4.5, maxSpanGasM: 5.8 },
  100: { dn: 100, npsInch: '4"',    maxSpanWaterM: 5.2, maxSpanGasM: 6.7 },
  125: { dn: 125, npsInch: '5"',    maxSpanWaterM: 5.8, maxSpanGasM: 7.4 },
  150: { dn: 150, npsInch: '6"',    maxSpanWaterM: 6.3, maxSpanGasM: 8.2 },
  200: { dn: 200, npsInch: '8"',    maxSpanWaterM: 7.3, maxSpanGasM: 9.5 },
  250: { dn: 250, npsInch: '10"',   maxSpanWaterM: 8.2, maxSpanGasM: 10.7 },
  300: { dn: 300, npsInch: '12"',   maxSpanWaterM: 9.1, maxSpanGasM: 11.9 },
  350: { dn: 350, npsInch: '14"',   maxSpanWaterM: 9.8, maxSpanGasM: 12.8 },
  400: { dn: 400, npsInch: '16"',   maxSpanWaterM: 10.5, maxSpanGasM: 13.7 },
  450: { dn: 450, npsInch: '18"',   maxSpanWaterM: 11.2, maxSpanGasM: 14.6 },
  500: { dn: 500, npsInch: '20"',   maxSpanWaterM: 11.8, maxSpanGasM: 15.5 },
  600: { dn: 600, npsInch: '24"',   maxSpanWaterM: 12.8, maxSpanGasM: 16.8 },
};

export function getMaxSpanForDn(dn: number, fluidType: "water" | "gas" = "water"): number {
  const spec = ASME_B31_3_MAX_SPANS[dn] || ASME_B31_3_MAX_SPANS[150];
  return fluidType === "gas" ? spec.maxSpanGasM : spec.maxSpanWaterM;
}

export interface SpanVerificationResult {
  segmentId: string;
  segmentLengthM: number;
  dn: number;
  supportCount: number;
  maxSpanAdmissibleM: number;
  longestSpanFoundM: number;
  status: "ok" | "warning" | "exceeded";
  message: string;
}

/**
 * Vérification des portées maximales pour chaque tronçon de tuyauterie
 */
export function verifyPipingSpans(
  segments: IsoSegment[],
  supports: IsoPipingSupport[],
  fluidType: "water" | "gas" = "water"
): SpanVerificationResult[] {
  return segments.map((seg) => {
    const segSupports = supports
      .filter((s) => s.segmentId === seg.id)
      .sort((a, b) => a.tRatio - b.tRatio);

    const maxAdmissible = getMaxSpanForDn(seg.dn, fluidType);
    let longestSpan = 0;

    if (segSupports.length === 0) {
      longestSpan = seg.length;
    } else {
      // Du nœud de départ au 1er support
      const firstSpan = segSupports[0].distanceFromFromNodeM;
      // Entre supports consécutifs
      let maxBetween = 0;
      for (let i = 0; i < segSupports.length - 1; i++) {
        const dist = segSupports[i + 1].distanceFromFromNodeM - segSupports[i].distanceFromFromNodeM;
        if (dist > maxBetween) maxBetween = dist;
      }
      // Du dernier support au nœud de fin
      const lastSpan = seg.length - segSupports[segSupports.length - 1].distanceFromFromNodeM;

      longestSpan = Math.max(firstSpan, maxBetween, lastSpan);
    }

    let status: "ok" | "warning" | "exceeded" = "ok";
    let msg = `Portée max conforme (${longestSpan.toFixed(2)} m ≤ ${maxAdmissible.toFixed(2)} m)`;

    if (longestSpan > maxAdmissible) {
      status = "exceeded";
      msg = `Portée NON conforme (${longestSpan.toFixed(2)} m > ${maxAdmissible.toFixed(2)} m max selon ASME B31.3 Table 321.1.3)`;
    } else if (longestSpan > maxAdmissible * 0.9) {
      status = "warning";
      msg = `Portée proche de la limite (${longestSpan.toFixed(2)} m ~ ${maxAdmissible.toFixed(2)} m)`;
    }

    return {
      segmentId: seg.id,
      segmentLengthM: seg.length,
      dn: seg.dn,
      supportCount: segSupports.length,
      maxSpanAdmissibleM: maxAdmissible,
      longestSpanFoundM: longestSpan,
      status,
      message: msg,
    };
  });
}

/**
 * Calcul du métré cumulatif Génie Civil pour l'ensemble des supports du réseau
 */
export interface CivilMtoSummary {
  totalSupportsCount: number;
  byTypeCount: Record<MssSupportCode, number>;
  totalBasePlateWeightKg: number;
  totalConcreteVolumeM3: number;
  totalAnchorsCount: number;
  anchorsByDiameter: Record<string, number>;
}

export function computeCivilMto(supports: IsoPipingSupport[]): CivilMtoSummary {
  const byType: Record<MssSupportCode, number> = {
    mss_type_1: 0,
    mss_type_8: 0,
    mss_type_26: 0,
    mss_type_35: 0,
    mss_type_39: 0,
    mss_type_51: 0,
    mss_type_57: 0,
  };

  let totalPlateWeight = 0;
  let totalConcrete = 0;
  let totalAnchors = 0;
  const anchorsByDia: Record<string, number> = {};

  for (const sup of supports) {
    byType[sup.type] = (byType[sup.type] || 0) + 1;
    totalPlateWeight += sup.civilSpec.calculatedPlateWeightKg;
    totalConcrete += sup.civilSpec.calculatedConcreteVolumeM3;
    totalAnchors += sup.civilSpec.anchorCount;

    const diaKey = sup.civilSpec.anchorDiameter;
    anchorsByDia[diaKey] = (anchorsByDia[diaKey] || 0) + sup.civilSpec.anchorCount;
  }

  return {
    totalSupportsCount: supports.length,
    byTypeCount: byType,
    totalBasePlateWeightKg: Number(totalPlateWeight.toFixed(1)),
    totalConcreteVolumeM3: Number(totalConcrete.toFixed(2)),
    totalAnchorsCount: totalAnchors,
    anchorsByDiameter: anchorsByDia,
  };
}

/**
 * Projette un clic écran sur un segment pour insérer un support
 */
export function projectSupportOnSegment(
  segment: IsoSegment,
  fromNode: IsoNode,
  toNode: IsoNode,
  clickWorldPos: { x: number; y: number },
  requestedType: MssSupportCode = "mss_type_35",
  existingCount: number = 0
): IsoPipingSupport {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const dz = (toNode.z || 0) - (fromNode.z || 0);
  const segDistSq = dx * dx + dy * dy;

  let t = 0.5;
  if (segDistSq > 0.0001) {
    const cdx = clickWorldPos.x - fromNode.x;
    const cdy = clickWorldPos.y - fromNode.y;
    t = Math.max(0.05, Math.min(0.95, (cdx * dx + cdy * dy) / segDistSq));
  }

  const worldX = Number((fromNode.x + t * dx).toFixed(3));
  const worldY = Number((fromNode.y + t * dy).toFixed(3));
  const worldZ = Number(((fromNode.z || 0) + t * dz).toFixed(3));

  const distanceM = Number((t * segment.length).toFixed(3));
  const def = MSS_SUPPORT_CATALOG[requestedType];
  const prefix = def.category === "point_fixe" ? "FIX" : def.category === "guide" ? "GDE" : def.category === "pendard" ? "PEN" : "SUP";
  const tag = `${prefix}-${String(existingCount + 1).padStart(2, "0")}`;

  return {
    id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tag,
    type: requestedType,
    segmentId: segment.id,
    tRatio: t,
    distanceFromFromNodeM: distanceM,
    worldPos: { x: worldX, y: worldY, z: worldZ },
    elevationZ: worldZ,
    orientationAngleDeg: 0,
    civilSpec: createDefaultCivilSpecForDn(segment.dn),
  };
}
