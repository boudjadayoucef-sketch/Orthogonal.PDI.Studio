/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * MODULE D'IMPRESSION PROFESSIONNEL ISO 216 / ISO 5457 / ISO 7200 (PATCH 020F).
 */

import { IsoNode, IsoSegment, PipingJoint } from "../isometric/types/isoGraphTypes";
import { pdiCompanyName, pdiStandardsNote, pdiDocumentPrefix } from "../branding/pdiBranding";
import { PDI_ENGINE_IDENTITY } from "../core/pdiWatermark";

export type IsoPaperFormat = "A5" | "A4" | "A3" | "A2" | "A1" | "A0";
export type IsoOrientation = "landscape" | "portrait";

export interface IsoPaperDimension {
  widthMm: number;
  heightMm: number;
  bindingMarginMm: number;
  outerMarginMm: number;
  columnsCount: number;
  rowsCount: number;
}

/**
 * Dimensions normalisées ISO 216 (en millimètres)
 */
export const ISO_216_PAPERS: Record<IsoPaperFormat, { width: number; height: number }> = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
};

/**
 * Retourne les dimensions d'une feuille selon son format et son orientation
 */
export function getIsoPaperDimensions(
  format: IsoPaperFormat,
  orientation: IsoOrientation
): IsoPaperDimension {
  const spec = ISO_216_PAPERS[format];
  const isLandscape = orientation === "landscape";
  const widthMm = isLandscape ? Math.max(spec.width, spec.height) : Math.min(spec.width, spec.height);
  const heightMm = isLandscape ? Math.min(spec.width, spec.height) : Math.max(spec.width, spec.height);

  // Marge de reliure normalisée ISO 5457 (20 mm à gauche pour reliure classeur, 10 mm sinon)
  const bindingMarginMm = format === "A5" || format === "A4" ? 15 : 20;
  const outerMarginMm = format === "A5" || format === "A4" ? 5 : 10;

  // Découpage en zones de repérage alphanumérique ISO 5457 (A..H, 1..12)
  const columnsCount = format === "A0" || format === "A1" ? 12 : format === "A2" ? 8 : 6;
  const rowsCount = format === "A0" || format === "A1" ? 8 : format === "A2" ? 6 : 4;

  return {
    widthMm,
    heightMm,
    bindingMarginMm,
    outerMarginMm,
    columnsCount,
    rowsCount,
  };
}

export const ISO_SCALES = [
  { value: "fit", label: "Ajuster à la feuille (NTS)" },
  { value: "1:1", label: "1:1 (Grandeur réelle)" },
  { value: "1:2", label: "1:2" },
  { value: "1:5", label: "1:5" },
  { value: "1:10", label: "1:10" },
  { value: "1:20", label: "1:20" },
  { value: "1:25", label: "1:25" },
  { value: "1:50", label: "1:50" },
  { value: "1:100", label: "1:100" },
  { value: "1:200", label: "1:200" },
] as const;

export interface IsoPrintConfig {
  format: IsoPaperFormat;
  orientation: IsoOrientation;
  scale: string;
  showCartoucheIso7200: boolean;
  showAdaptiveLegend: boolean;
  showIso5457Grid: boolean;
  showWatermarkFootprint: boolean;
  showBomTable: boolean;
  showDimensions: boolean;
  showWelds: boolean;
  showPipeLabels: boolean;
  documentTitle: string;
  documentNumber: string;
  revision: string;
  drawnBy: string;
  checkedBy: string;
  approvedBy: string;
  pageNumber: number;
  totalPages: number;
  serviceFluid?: string;
  pressureDesign?: number;
  hydrotestPressure?: number;
  wilayaOrSite?: string;
  unitSystem?: "metric" | "imperial";
  printScope: "all" | "selection" | "window";
  showSupports: boolean;
  showCivilEngineering: boolean;
  showSupportTable: boolean;
  weldMapMode?: boolean;
  showSpoolColors?: boolean;
  showWeldTable?: boolean;
  showSpoolTable?: boolean;
  windowZoomRatio?: number;
  offsetX?: number; // Décalage manuel horizontal en mm (défaut: 0)
  offsetY?: number; // Décalage manuel vertical en mm (défaut: 0)
}

export type IsoPrintScope = "all" | "selection" | "window";

export const DEFAULT_PRINT_CONFIG: IsoPrintConfig = {
  format: "A3",
  orientation: "landscape",
  scale: "fit",
  unitSystem: "metric",
  printScope: "all",
  offsetX: 0,
  offsetY: 0,
  showCartoucheIso7200: true,
  showAdaptiveLegend: true,
  showIso5457Grid: true,
  showWatermarkFootprint: true,
  showBomTable: true,
  showSupports: true,
  showCivilEngineering: true,
  showSupportTable: true,
  showDimensions: true,
  showWelds: true,
  showPipeLabels: true,
  weldMapMode: false,
  showSpoolColors: false,
  showWeldTable: false,
  showSpoolTable: false,
  windowZoomRatio: 1,
  documentTitle: "PLAN ISOMÉTRIQUE TUYAUTERIE INDUSTRIELLE",
  documentNumber: "PDI-ISO-001",
  revision: "0",
  drawnBy: "ORTHOGONAL - ENG",
  checkedBy: "DIRECTION TECHNIQUE",
  approvedBy: "CHEF DE PROJET",
  pageNumber: 1,
  totalPages: 1,
  serviceFluid: "GAZ NATUREL HP",
  pressureDesign: 75,
  hydrotestPressure: 112.5,
  wilayaOrSite: "SITE INDUSTRIEL",
};

export interface AdaptiveLegendItem {
  key: string;
  label: string;
  color: string;
  type: "line" | "node" | "symbol" | "weld";
  svgIconMarkup: string;
}

/**
 * Analyse le projet et extrait UNIQUEMENT les composants réels pour la légende
 */
export function buildAdaptiveLegend(
  nodes: IsoNode[],
  segments: IsoSegment[],
  joints: PipingJoint[],
  supports?: any[],
  cad2dEntities?: any[]
): AdaptiveLegendItem[] {
  const items: AdaptiveLegendItem[] = [];
  const addedKeys = new Set<string>();

  // 1. Tubes selon classe ou PN
  let hasStandardPipe = false;
  let hasHpPipe = false;
  segments.forEach((s) => {
    if (s.pressureClass?.includes("600") || s.pressureClass?.includes("900") || s.pn?.includes("600")) {
      hasHpPipe = true;
    } else {
      hasStandardPipe = true;
    }
  });

  if (hasStandardPipe) {
    items.push({
      key: "pipe_standard",
      label: "Tuyauterie process standard (PN16 / PN40 / Cl.150)",
      color: "#0284c7",
      type: "line",
      svgIconMarkup: `<line x1="0" y1="5" x2="20" y2="5" stroke="#0284c7" stroke-width="2.5"/>`,
    });
  }
  if (hasHpPipe) {
    items.push({
      key: "pipe_hp",
      label: "Tuyauterie Haute Pression (Class 600 / 900)",
      color: "#d97706",
      type: "line",
      svgIconMarkup: `<line x1="0" y1="5" x2="20" y2="5" stroke="#d97706" stroke-width="3"/>`,
    });
  }

  // 2. Équipements réels
  nodes.forEach((n) => {
    if (n.equipmentType && !addedKeys.has(n.equipmentType)) {
      addedKeys.add(n.equipmentType);
      const eq = n.equipmentType;
      let label = n.equipmentLabel || eq;
      let icon = "";

      if (eq.includes("vanne")) {
        label = "Robinetterie / Vanne d'isolement";
        icon = `<path d="M 2 2 L 10 7 L 2 12 Z M 18 2 L 10 7 L 18 12 Z" fill="#0284c7" stroke="#0284c7"/><line x1="10" y1="7" x2="10" y2="0" stroke="#0284c7" stroke-width="1.5"/><line x1="6" y1="0" x2="14" y2="0" stroke="#0284c7" stroke-width="1.5"/>`;
      } else if (eq.startsWith("coude")) {
        label = "Coude standard à souder (BW)";
        icon = `<path d="M 3 11 Q 3 3 11 3" stroke="#d97706" stroke-width="2.5" fill="none"/>`;
      } else if (eq.startsWith("bride") || eq === "joint") {
        label = "Raccordement à bride / Joint d'étanchéité";
        icon = `<line x1="8" y1="1" x2="8" y2="13" stroke="#b45309" stroke-width="2"/><line x1="12" y1="1" x2="12" y2="13" stroke="#b45309" stroke-width="2"/>`;
      } else if (eq === "jmi") {
        label = "Joint Monobloc Isolant (JMI)";
        icon = `<line x1="7" y1="1" x2="7" y2="13" stroke="#b45309" stroke-width="2"/><line x1="13" y1="1" x2="13" y2="13" stroke="#b45309" stroke-width="2"/><circle cx="10" cy="7" r="1.5" fill="#0284c7"/>`;
      } else if (eq === "te_egal" || eq === "te_reduit" || eq === "piquage") {
        label = "Té droit / Piquage de dérivation";
        icon = `<path d="M 3 7 H 17 M 10 7 V 1" stroke="#16a34a" stroke-width="2.2" fill="none"/><circle cx="10" cy="1" r="1.5" fill="#16a34a"/>`;
      } else if (eq === "clapet") {
        label = "Clapet anti-retour";
        icon = `<path d="M 3 2 L 11 7 L 3 12 Z" fill="#0284c7" stroke="#0284c7"/><line x1="12" y1="2" x2="12" y2="12" stroke="#0284c7" stroke-width="2"/>`;
      } else if (eq === "soupape") {
        label = "Soupape de décharge / Sécurité";
        icon = `<path d="M 4 10 H 16 M 10 10 V 2 M 7 2 H 13" stroke="#dc2626" stroke-width="2" fill="none"/>`;
      } else if (eq === "manometre" || eq === "prise_pression") {
        label = "Instrumentation / Prise de pression";
        icon = `<circle cx="10" cy="5" r="4" fill="#fff" stroke="#0284c7" stroke-width="1.2"/><line x1="10" y1="9" x2="10" y2="14" stroke="#0284c7" stroke-width="1.5"/>`;
      } else {
        label = n.name || "Composant tubulaire";
        icon = `<rect x="5" y="3" width="10" height="8" rx="1.5" fill="#0284c7"/>`;
      }

      items.push({
        key: `equip_${eq}`,
        label,
        color: "#0284c7",
        type: "symbol",
        svgIconMarkup: icon,
      });
    }
  });

  // 3. Soudures réelles
  const hasShopWelds = joints.some((j) => j.location === "shop" && j.weldNumber);
  const hasFieldWelds = joints.some((j) => j.location === "field" && j.weldNumber);
  if (hasShopWelds || joints.some((j) => j.weldNumber)) {
    items.push({
      key: "weld_shop",
      label: "Soudure d'atelier (Atelier / Shop weld)",
      color: "#b45309",
      type: "weld",
      svgIconMarkup: `<circle cx="10" cy="7" r="3.5" fill="#fff" stroke="#b45309" stroke-width="1.5"/><text x="10" y="9.5" text-anchor="middle" font-size="5" font-weight="900" fill="#b45309">W</text>`,
    });
  }
  if (hasFieldWelds) {
    items.push({
      key: "weld_field",
      label: "Soudure de chantier (Chantier / Field weld)",
      color: "#dc2626",
      type: "weld",
      svgIconMarkup: `<circle cx="10" cy="7" r="3.5" fill="#dc2626" stroke="#dc2626" stroke-width="1.5"/><text x="10" y="9.5" text-anchor="middle" font-size="5" font-weight="900" fill="#fff">FW</text>`,
    });
  }

  // 4. Bornes d'entrée / sortie de poste
  if (nodes.some((n) => n.type === "entree_poste")) {
    items.push({
      key: "node_entree",
      label: "Limite de batterie / Entrée de poste",
      color: "#16a34a",
      type: "node",
      svgIconMarkup: `<circle cx="10" cy="7" r="4.5" fill="#16a34a"/>`,
    });
  }
  if (nodes.some((n) => n.type === "sortie_poste")) {
    items.push({
      key: "node_sortie",
      label: "Limite de batterie / Sortie de poste",
      color: "#dc2626",
      type: "node",
      svgIconMarkup: `<circle cx="10" cy="7" r="4.5" fill="#dc2626"/>`,
    });
  }

  // 5. Supportage Industriel MSS SP-58 (Mécanique)
  if (supports && supports.length > 0) {
    items.push({
      key: "meca_support",
      label: "Supportage Mécanique MSS SP-58 (Patin / Pendard / Guide / Ancrage)",
      color: "#0891b2",
      type: "symbol",
      svgIconMarkup: `<rect x="5" y="4" width="10" height="4" fill="#0891b2" rx="1"/><line x1="10" y1="8" x2="10" y2="13" stroke="#0891b2" stroke-width="1.8"/><line x1="6" y1="13" x2="14" y2="13" stroke="#64748b" stroke-width="1.5"/>`,
    });
  }

  // 6. Génie Civil & Structures Béton / Acier
  if (cad2dEntities && cad2dEntities.length > 0) {
    items.push({
      key: "gc_structure",
      label: "Génie Civil (Massifs béton, Semelles & Profilés acier)",
      color: "#64748b",
      type: "symbol",
      svgIconMarkup: `<rect x="4" y="3" width="12" height="8" fill="#e2e8f0" stroke="#64748b" stroke-width="1.2" rx="1"/><line x1="4" y1="7" x2="16" y2="7" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="2,1"/>`,
    });
  }

  return items;
}
