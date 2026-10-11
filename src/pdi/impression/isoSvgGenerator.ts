/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * GÉNÉRATEUR VECTORIEL DE PLANCHES NORMALISÉES ISO (PATCH 020F).
 * VERSION ÉTENDUE : TUYAUTERIE, MÉCANIQUE (MSS SP-58), GÉNIE CIVIL & TABLES DYNAMIQUES.
 */

import {
  IsoNode,
  IsoSegment,
  IsoDimension,
  PipingJoint,
  DIAMETER_BY_DN,
} from "../isometric/types/isoGraphTypes";
import {
  IsoPrintConfig,
  getIsoPaperDimensions,
  buildAdaptiveLegend,
} from "./isoSheetStandards";
import {
  segmentEndpoints,
  portWorldPosition,
  elbowAngle,
  equipmentLabel,
} from "../isometric/core/IsoTopologyGraph";
import { pdiCompanyName, pdiStandardsNote } from "../branding/pdiBranding";
import { PDI_ENGINE_IDENTITY, PDI_WATERMARK_SIGNATURE } from "../core/pdiWatermark";
import { formatLength, formatPressure } from "../units/pdiUnitSystem";
import {
  IsoPipingSupport,
  MSS_SUPPORT_CATALOG,
  computeCivilMto,
} from "../isometric/supports/pdiMssSupportEngine";
import {
  getComponentVignetteSvg,
  getMssSupportVignetteSvg,
} from "../catalog/trouvayCauvinCatalog";
import type { Cad2dEntity } from "../isometric/engine/IsometrieModuleV48d";
import { WeldSpoolResult, getWeldMarkerSvg } from "../welding/isoWeldSpoolEngine";

const PDI_ISO_ANGLE = Math.PI / 6;
const PDI_ISO_COS = Math.cos(PDI_ISO_ANGLE);
const PDI_ISO_SIN = Math.sin(PDI_ISO_ANGLE);

export interface BomRow {
  index: number;
  designation: string;
  dn: number;
  inch: string;
  qty: number;
  unit: string;
  length: number;
  reference: string;
  fittingType?: string;
}

/**
 * Projette les coordonnées mondiales 3D vers le plan 2D isométrique centré
 */
export function isoProjectPrint(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  scale: number
): { x: number; y: number } {
  return {
    x: cx + (x - y) * PDI_ISO_COS * scale,
    y: cy + (x + y) * PDI_ISO_SIN * scale - z * scale,
  };
}

/**
 * Calcule l'emprise englobante du modèle 3D projeté (tuyauterie + mécanique + génie civil)
 */
function computeBoundingBox(
  nodes: IsoNode[],
  segments: IsoSegment[],
  dimensions: IsoDimension[] = [],
  supports: IsoPipingSupport[] = [],
  cad2dEntities: Cad2dEntity[] = [],
  includeSupports: boolean = true,
  includeCivil: boolean = true
): { minX: number; maxX: number; minY: number; maxY: number; centerX: number; centerY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const pushPoint = (rawX: number, rawY: number) => {
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
    if (rawX < minX) minX = rawX;
    if (rawX > maxX) maxX = rawX;
    if (rawY < minY) minY = rawY;
    if (rawY > maxY) maxY = rawY;
  };

  // 1. Nœuds de tuyauterie et équipements
  nodes.forEach((n) => {
    const rawX = (n.x - n.y) * PDI_ISO_COS;
    const rawY = (n.x + n.y) * PDI_ISO_SIN - (n.z || 0);
    pushPoint(rawX, rawY);

    // Si l'équipement a une dimension physique propre (ex. sas racleur, échangeur, ballon)
    if (n.length && n.length > 0) {
      const half = n.length / 2;
      const angleRad = ((n.rotation || 0) * Math.PI) / 180;
      const dx = Math.cos(angleRad) * half;
      const dy = Math.sin(angleRad) * half;
      pushPoint((n.x + dx - (n.y + dy)) * PDI_ISO_COS, (n.x + dx + (n.y + dy)) * PDI_ISO_SIN - (n.z || 0));
      pushPoint((n.x - dx - (n.y - dy)) * PDI_ISO_COS, (n.x - dx + (n.y - dy)) * PDI_ISO_SIN - (n.z || 0));
    }
  });

  // 1b. Segments de tuyauterie (extrémités réelles après découpe des raccords)
  segments.forEach((seg) => {
    const fromNode = nodes.find((n) => n.id === seg.fromNodeId);
    const toNode = nodes.find((n) => n.id === seg.toNodeId);
    if (!fromNode || !toNode) return;
    const endpoints = segmentEndpoints(seg, nodes);
    const p1 = endpoints ? endpoints.from : fromNode;
    const p2 = endpoints ? endpoints.to : toNode;
    pushPoint((p1.x - p1.y) * PDI_ISO_COS, (p1.x + p1.y) * PDI_ISO_SIN - (p1.z || 0));
    pushPoint((p2.x - p2.y) * PDI_ISO_COS, (p2.x + p2.y) * PDI_ISO_SIN - (p2.z || 0));
  });

  // 1c. Cotes & Dimensions
  if (dimensions && dimensions.length > 0) {
    dimensions.forEach((dim) => {
      const a = nodes.find((n) => n.id === dim.a.nodeId);
      const b = nodes.find((n) => n.id === dim.b.nodeId);
      if (!a || !b) return;
      pushPoint((a.x - a.y) * PDI_ISO_COS, (a.x + a.y) * PDI_ISO_SIN - (a.z || 0));
      pushPoint((b.x - b.y) * PDI_ISO_COS, (b.x + b.y) * PDI_ISO_SIN - (b.z || 0));
    });
  }

  // 2. Supports tuyauterie
  if (includeSupports && supports.length > 0) {
    supports.forEach((sup) => {
      const wp = sup.worldPos;
      const rawX = (wp.x - wp.y) * PDI_ISO_COS;
      const rawY = (wp.x + wp.y) * PDI_ISO_SIN - (wp.z || 0);
      pushPoint(rawX, rawY);
      // Retombée réaliste du sabot/massif sous le support en mètres (0.25 m)
      pushPoint(rawX, rawY + 0.25);
    });
  }

  // 3. Éléments de Génie Civil CAD 2D visibles
  if (includeCivil && cad2dEntities.length > 0) {
    cad2dEntities.forEach((ent) => {
      if (ent.visible === false) return;
      const z = ent.metadata?.elevationZ || 0;
      if (ent.points && ent.points.length > 0) {
        ent.points.forEach((pt) => {
          const rawX = (pt.x - pt.y) * PDI_ISO_COS;
          const rawY = (pt.x + pt.y) * PDI_ISO_SIN - z;
          pushPoint(rawX, rawY);
        });
      } else if (ent.center) {
        const r = ent.radius || 0.5;
        const rawX = (ent.center.x - ent.center.y) * PDI_ISO_COS;
        const rawY = (ent.center.x + ent.center.y) * PDI_ISO_SIN - z;
        pushPoint(rawX - r, rawY - r);
        pushPoint(rawX + r, rawY + r);
      }
    });
  }

  if (minX === Infinity) {
    return { minX: 0, maxX: 10, minY: 0, maxY: 10, centerX: 5, centerY: 5 };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Génère le SVG complet et certifié de la planche normalisée
 */
export function generateIsoDrawingSvg(
  nodes: IsoNode[],
  segments: IsoSegment[],
  dimensions: IsoDimension[],
  joints: PipingJoint[],
  bomRows: BomRow[],
  config: IsoPrintConfig,
  supports: IsoPipingSupport[] = [],
  cad2dEntities: Cad2dEntity[] = [],
  weldSpoolData?: WeldSpoolResult
): {
  svgMarkup: string;
  widthMm: number;
  heightMm: number;
  scaleApplied: string;
} {
  const paper = getIsoPaperDimensions(config.format, config.orientation);
  const W = paper.widthMm;
  const H = paper.heightMm;

  // Marges ISO 5457
  const leftM = paper.bindingMarginMm;
  const rightM = paper.outerMarginMm;
  const topM = paper.outerMarginMm;
  const bottomM = paper.outerMarginMm;

  const innerW = W - leftM - rightM;
  const innerH = H - topM - bottomM;

  // Cartouche ISO 7200 dimensions (standard normalisé)
  const cartoucheW = Math.min(185, innerW * 0.46);
  const cartoucheH = Math.min(56, innerH * 0.32);
  const cartoucheX = leftM + innerW - cartoucheW;
  const cartoucheY = topM + innerH - cartoucheH;

  // Détection réelle et stricte des tableaux latéraux actifs
  const actualHasLegend = Boolean(config.showAdaptiveLegend);
  const actualHasBom = Boolean(config.showBomTable && bomRows.length > 0);
  const actualHasSupports = Boolean(config.showSupportTable && supports.length > 0);
  const actualHasWeldTable = Boolean(config.showWeldTable && weldSpoolData && weldSpoolData.welds.length > 0);
  const actualHasSpoolTable = Boolean(config.showSpoolTable && weldSpoolData && weldSpoolData.spools.length > 0);
  const hasSideContent = actualHasLegend || actualHasBom || actualHasSupports || actualHasWeldTable || actualHasSpoolTable;

  // Colonne latérale pour légendes & tableaux (largeur adaptative)
  const sideColW = hasSideContent ? Math.min(130, Math.max(80, innerW * 0.30)) : 0;
  const sideColX = leftM + 4;

  const legendW = sideColW;
  const legendX = sideColX;
  const legendY = topM + 4;

  // Nomenclature BOM dimensions
  const bomW = sideColW;
  const bomX = sideColX;
  const legendHeightCalc = actualHasLegend ? 48 : 0;
  const bomY = legendY + legendHeightCalc;

  // Zone graphique utile pour le tracé isométrique (centrage parfait et dégagement des en-têtes et cartouches)
  const drawAreaLeft = hasSideContent ? leftM + sideColW + 10 : leftM + 12;
  const compassClearance = 36;
  const drawAreaRight = leftM + innerW - (config.showIso5457Grid ? compassClearance : 14);
  const drawAreaTop = topM + 18; // Dégagement propre sous le titre du plan
  const drawAreaBottom = config.showCartoucheIso7200 ? (cartoucheY - 6) : (topM + innerH - 10);

  const drawAreaX = drawAreaLeft;
  const drawAreaY = drawAreaTop;
  const drawAreaW = Math.max(40, drawAreaRight - drawAreaLeft);
  const drawAreaH = Math.max(40, drawAreaBottom - drawAreaTop);

  // Calcul d'échelle isométrique sur l'espace utile garanti
  const bbox = computeBoundingBox(
    nodes,
    segments,
    dimensions,
    supports,
    cad2dEntities,
    config.showSupports,
    config.showCivilEngineering
  );
  const rawModelW = Math.max(0.2, bbox.maxX - bbox.minX);
  const rawModelH = Math.max(0.2, bbox.maxY - bbox.minY);

  let scaleMm = 1;
  let scaleAppliedLabel = config.scale;

  if (config.scale === "fit") {
    const scaleX = (drawAreaW * 0.82) / rawModelW;
    const scaleY = (drawAreaH * 0.82) / rawModelH;
    let baseScale = Math.max(0.01, Math.min(scaleX, scaleY));
    if (config.printScope === "window" && config.windowZoomRatio) {
      baseScale *= config.windowZoomRatio;
    }
    scaleMm = baseScale;
    scaleAppliedLabel = config.printScope === "window" ? `Zoom ${(config.windowZoomRatio || 1) * 100}%` : "Ajustée (NTS)";
  } else {
    const parts = config.scale.split(":");
    if (parts.length === 2 && Number(parts[1]) > 0) {
      const ratio = Number(parts[0]) / Number(parts[1]);
      scaleMm = 1000 * ratio;
    } else {
      scaleMm = 10;
    }
    if (config.printScope === "window" && config.windowZoomRatio) {
      scaleMm *= config.windowZoomRatio;
    }
  }

  // Centrage absolu du modèle dans la zone graphique disponible + décalage manuel d'ajustement si nécessaire
  const zoneCenterX = drawAreaX + drawAreaW / 2;
  const zoneCenterY = drawAreaY + drawAreaH / 2;
  const manualOffsetX = config.offsetX || 0;
  const manualOffsetY = config.offsetY || 0;

  const modelCenterIsoX = zoneCenterX - bbox.centerX * scaleMm + manualOffsetX;
  const modelCenterIsoY = zoneCenterY - bbox.centerY * scaleMm + manualOffsetY;

  let svgContent = "";

  // 1. FOND DE PLANCHE BLANC
  svgContent += `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`;

  // 2. CADRE NORMALISÉ ISO 5457 (DOUBLE CADRE + GRILLE ALPHANUMÉRIQUE)
  if (config.showIso5457Grid) {
    svgContent += `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#64748b" stroke-width="0.35" stroke-dasharray="2,2"/>`;
    svgContent += `<rect x="${leftM}" y="${topM}" width="${innerW}" height="${innerH}" fill="none" stroke="#0f172a" stroke-width="0.7"/>`;

    const midX = W / 2;
    const midY = H / 2;
    svgContent += `<polygon points="${midX - 2.5},${topM - 5} ${midX + 2.5},${topM - 5} ${midX},${topM}" fill="#0f172a"/>`;
    svgContent += `<polygon points="${midX - 2.5},${topM + innerH + 5} ${midX + 2.5},${topM + innerH + 5} ${midX},${topM + innerH}" fill="#0f172a"/>`;
    svgContent += `<polygon points="${leftM - 5},${midY - 2.5} ${leftM - 5},${midY + 2.5} ${leftM},${midY}" fill="#0f172a"/>`;
    svgContent += `<polygon points="${leftM + innerW + 5},${midY - 2.5} ${leftM + innerW + 5},${midY + 2.5} ${leftM + innerW},${midY}" fill="#0f172a"/>`;

    const colStep = innerW / paper.columnsCount;
    for (let c = 0; c < paper.columnsCount; c++) {
      const x = leftM + c * colStep;
      svgContent += `<line x1="${x}" y1="${topM}" x2="${x}" y2="${topM - 3}" stroke="#0f172a" stroke-width="0.4"/>`;
      svgContent += `<line x1="${x}" y1="${topM + innerH}" x2="${x}" y2="${topM + innerH + 3}" stroke="#0f172a" stroke-width="0.4"/>`;
      svgContent += `<text x="${x + colStep / 2}" y="${topM - 1}" text-anchor="middle" font-size="2.2" font-family="monospace" font-weight="bold" fill="#0f172a">${c + 1}</text>`;
      svgContent += `<text x="${x + colStep / 2}" y="${topM + innerH + 3}" text-anchor="middle" font-size="2.2" font-family="monospace" font-weight="bold" fill="#0f172a">${c + 1}</text>`;
    }

    const rowStep = innerH / paper.rowsCount;
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    for (let r = 0; r < paper.rowsCount; r++) {
      const y = topM + r * rowStep;
      const letter = letters[r] || "Z";
      svgContent += `<line x1="${leftM}" y1="${y}" x2="${leftM - 3}" y2="${y}" stroke="#0f172a" stroke-width="0.4"/>`;
      svgContent += `<line x1="${leftM + innerW}" y1="${y}" x2="${leftM + innerW + 3}" y2="${y}" stroke="#0f172a" stroke-width="0.4"/>`;
      svgContent += `<text x="${leftM - 1.5}" y="${y + rowStep / 2 + 0.8}" text-anchor="middle" font-size="2.2" font-family="monospace" font-weight="bold" fill="#0f172a">${letter}</text>`;
      svgContent += `<text x="${leftM + innerW + 2}" y="${y + rowStep / 2 + 0.8}" text-anchor="middle" font-size="2.2" font-family="monospace" font-weight="bold" fill="#0f172a">${letter}</text>`;
    }
  }

  // 3. ROSE DES VENTS ISOMÉTRIQUE
  const compassX = leftM + innerW - 24;
  const compassY = topM + 24;
  svgContent += `<g transform="translate(${compassX}, ${compassY})">
    <circle r="9" fill="#f8fafc" stroke="#0f172a" stroke-width="0.5"/>
    <line x1="0" y1="0" x2="6.5" y2="-3.75" stroke="#dc2626" stroke-width="1" stroke-linecap="round"/>
    <polygon points="6.5,-3.75 4.5,-5 5,-2" fill="#dc2626"/>
    <text x="7.5" y="-4.5" font-size="2.6" font-family="sans-serif" font-weight="bold" fill="#dc2626">N</text>
    <line x1="0" y1="0" x2="-6.5" y2="3.75" stroke="#64748b" stroke-width="0.6"/>
    <line x1="0" y1="0" x2="6.5" y2="3.75" stroke="#64748b" stroke-width="0.6"/>
    <line x1="0" y1="0" x2="-6.5" y2="-3.75" stroke="#64748b" stroke-width="0.6"/>
    <text x="-8" y="5" font-size="2" font-family="sans-serif" fill="#64748b">S</text>
    <text x="7.5" y="5" font-size="2" font-family="sans-serif" fill="#64748b">E</text>
    <text x="-8" y="-4" font-size="2" font-family="sans-serif" fill="#64748b">O</text>
    <text x="0" y="12" font-size="1.8" text-anchor="middle" font-weight="bold" fill="#475569">AXE ISO 30°</text>
  </g>`;

  // 4. TITRE DU PLAN EN HAUT DE PAGE (AVEC INDICATION DU MODE D'IMPRESSION)
  const modeLabel = config.printScope === "selection"
    ? " · MODE SÉLECTION RESTREINTE"
    : config.printScope === "window"
    ? " · MODE CADRAGE FENÊTRE"
    : " · VUE GLOBALE ÉTENDUE";

  svgContent += `<g transform="translate(${drawAreaX + drawAreaW / 2}, ${topM + 7})">
    <text text-anchor="middle" font-size="3.8" font-family="sans-serif" font-weight="bold" fill="#0f172a">${config.documentTitle}</text>
    <text text-anchor="middle" y="3.2" font-size="2" font-family="sans-serif" fill="#64748b">${config.wilayaOrSite || "INSTALLATION INDUSTRIELLE"} · SERVICE : ${config.serviceFluid || "PROCESS"}${modeLabel}</text>
  </g>`;

  // 5. RENDU DU GÉNIE CIVIL (SOUS-COUCHE INFÉRIEURE : MASSIFS, SEMELLES, PROFILÉS ET AXES)
  if (config.showCivilEngineering && cad2dEntities.length > 0) {
    svgContent += `<g id="pdi-civil-engineering-layer">`;
    cad2dEntities.forEach((ent) => {
      const z = ent.metadata?.elevationZ || 0;
      const isMassif = ent.type === "rectangle" || ent.type === "polygon" || ent.metadata?.intent === "equipment";
      const isAxis = ent.lineType === "center" || ent.metadata?.intent === "pipe_axis";

      if ((ent.type === "rectangle" || ent.type === "polygon") && ent.points && ent.points.length >= 3) {
        // Projection des sommets en isométrie
        const ptsIso = ent.points.map((pt) =>
          isoProjectPrint(pt.x, pt.y, z, modelCenterIsoX, modelCenterIsoY, scaleMm)
        );
        const polyPointsStr = ptsIso.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

        // Face supérieure du massif béton
        svgContent += `<polygon points="${polyPointsStr}" fill="#e2e8f0" stroke="#64748b" stroke-width="0.6"/>`;

        // Donnons du relief 3D aux massifs béton en dessinant les faces descendantes vers le radier
        const heightDrop = Math.max(3, (ent.height || ent.metadata?.height || 0.4) * scaleMm * 0.8);
        if (ptsIso.length >= 4) {
          // Face avant-gauche
          svgContent += `<polygon points="${ptsIso[1].x.toFixed(2)},${ptsIso[1].y.toFixed(2)} ${ptsIso[2].x.toFixed(2)},${ptsIso[2].y.toFixed(2)} ${ptsIso[2].x.toFixed(2)},${(ptsIso[2].y + heightDrop).toFixed(2)} ${ptsIso[1].x.toFixed(2)},${(ptsIso[1].y + heightDrop).toFixed(2)}" fill="#cbd5e1" stroke="#64748b" stroke-width="0.5"/>`;
          // Face avant-droite
          svgContent += `<polygon points="${ptsIso[2].x.toFixed(2)},${ptsIso[2].y.toFixed(2)} ${ptsIso[3].x.toFixed(2)},${ptsIso[3].y.toFixed(2)} ${ptsIso[3].x.toFixed(2)},${(ptsIso[3].y + heightDrop).toFixed(2)} ${ptsIso[2].x.toFixed(2)},${(ptsIso[2].y + heightDrop).toFixed(2)}" fill="#94a3b8" stroke="#64748b" stroke-width="0.5"/>`;
        }

        // Hachures symboliques béton
        if (ptsIso[0]) {
          svgContent += `<text x="${ptsIso[0].x.toFixed(2)}" y="${(ptsIso[0].y - 1.5).toFixed(2)}" font-size="1.6" font-family="monospace" font-weight="bold" fill="#475569">${ent.text || "MASSIF BÉTON"}</text>`;
        }
      } else if (ent.type === "line" && ent.points && ent.points.length >= 2) {
        const p1 = isoProjectPrint(ent.points[0].x, ent.points[0].y, z, modelCenterIsoX, modelCenterIsoY, scaleMm);
        const p2 = isoProjectPrint(ent.points[1].x, ent.points[1].y, z, modelCenterIsoX, modelCenterIsoY, scaleMm);
        const strokeDash = isAxis ? ' stroke-dasharray="3,1,1,1"' : "";
        const strokeColor = isAxis ? "#94a3b8" : "#475569";
        const strokeW = isAxis ? "0.35" : "0.7";
        svgContent += `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${strokeColor}" stroke-width="${strokeW}"${strokeDash}/>`;
      } else if (ent.type === "circle" && ent.center) {
        const p = isoProjectPrint(ent.center.x, ent.center.y, z, modelCenterIsoX, modelCenterIsoY, scaleMm);
        const rx = (ent.radius || 5) * scaleMm * PDI_ISO_COS;
        const ry = (ent.radius || 5) * scaleMm * PDI_ISO_SIN;
        svgContent += `<ellipse cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="#e2e8f0" stroke="#64748b" stroke-width="0.6"/>`;
      } else if (ent.type === "text" && ent.points && ent.points.length > 0) {
        const p = isoProjectPrint(ent.points[0].x, ent.points[0].y, z, modelCenterIsoX, modelCenterIsoY, scaleMm);
        svgContent += `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" font-size="1.8" font-family="sans-serif" font-weight="bold" fill="#475569">${ent.text || ""}</text>`;
      }
    });
    svgContent += `</g>`;
  }

  // 6. TRACÉ ISOMÉTRIQUE TUYAUTERIE & ROBINETTERIE
  svgContent += `<g id="pdi-piping-iso-model">`;

  // Tronçons de tuyauterie
  segments.forEach((seg) => {
    const fromNode = nodes.find((n) => n.id === seg.fromNodeId);
    const toNode = nodes.find((n) => n.id === seg.toNodeId);
    if (!fromNode || !toNode) return;

    const endpoints = segmentEndpoints(seg, nodes);
    const p1 = endpoints
      ? isoProjectPrint(endpoints.from.x, endpoints.from.y, endpoints.from.z, modelCenterIsoX, modelCenterIsoY, scaleMm)
      : isoProjectPrint(fromNode.x, fromNode.y, fromNode.z, modelCenterIsoX, modelCenterIsoY, scaleMm);
    const p2 = endpoints
      ? isoProjectPrint(endpoints.to.x, endpoints.to.y, endpoints.to.z, modelCenterIsoX, modelCenterIsoY, scaleMm)
      : isoProjectPrint(toNode.x, toNode.y, toNode.z, modelCenterIsoX, modelCenterIsoY, scaleMm);

    const spool = weldSpoolData?.spools.find((sp) => sp.segmentIds.includes(seg.id));
    const isHp = seg.pressureClass?.includes("600") || seg.pn?.includes("600");
    const stroke = config.showSpoolColors && spool ? spool.color : isHp ? "#d97706" : "#0284c7";
    const strokeWidth = Math.max(0.8, Math.min(2.5, seg.dn / 150));

    // Ligne principale du tube
    svgContent += `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round"/>`;

    // Pastille / Tag de Spool centré sur le tronçon si le mode Spool est actif
    if (config.showSpoolColors && spool) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      svgContent += `<g transform="translate(${mx.toFixed(2)}, ${(my - 2.8).toFixed(2)})">
        <rect x="-6" y="-1.8" width="12" height="3.6" rx="0.8" fill="#ffffff" stroke="${spool.color}" stroke-width="0.35"/>
        <text x="0" y="0.7" text-anchor="middle" font-size="1.6" font-family="monospace" font-weight="bold" fill="${spool.color}">${spool.id}</text>
      </g>`;
    }

    // Éléments & Raccords intermédiaires placés sur le tronçon (seg.fittings)
    if (seg.fittings && seg.fittings.length > 0) {
      seg.fittings.forEach((fit) => {
        const t = Math.max(0.08, Math.min(0.92, fit.localPosition || 0.5));
        const fx = p1.x + (p2.x - p1.x) * t;
        const fy = p1.y + (p2.y - p1.y) * t;

        if (fit.type.includes("vanne")) {
          svgContent += `<g transform="translate(${fx.toFixed(2)}, ${fy.toFixed(2)}) scale(0.65)">
            <path d="M -5 -3 L 0 0 L -5 3 Z" fill="${stroke}" stroke="${stroke}" stroke-width="0.6"/>
            <path d="M 5 -3 L 0 0 L 5 3 Z" fill="${stroke}" stroke="${stroke}" stroke-width="0.6"/>
            <line x1="0" y1="0" x2="0" y2="-4" stroke="${stroke}" stroke-width="0.8"/>
            <line x1="-2" y1="-4" x2="2" y2="-4" stroke="${stroke}" stroke-width="0.8"/>
          </g>`;
        } else if (fit.type === "clapet") {
          svgContent += `<g transform="translate(${fx.toFixed(2)}, ${fy.toFixed(2)}) scale(0.65)">
            <path d="M -4 -3 L 3 0 L -4 3 Z" fill="${stroke}" stroke="${stroke}"/>
            <line x1="4" y1="-3.5" x2="4" y2="3.5" stroke="${stroke}" stroke-width="0.8"/>
          </g>`;
        } else if (fit.type.startsWith("bride") || fit.type === "jmi") {
          svgContent += `<g transform="translate(${fx.toFixed(2)}, ${fy.toFixed(2)})">
            <line x1="-1.2" y1="-3" x2="-1.2" y2="3" stroke="#b45309" stroke-width="0.8"/>
            <line x1="1.2" y1="-3" x2="1.2" y2="3" stroke="#b45309" stroke-width="0.8"/>
          </g>`;
        } else {
          svgContent += `<circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="1.4" fill="${stroke}"/>`;
        }
      });
    }

    // Étiquette du tronçon
    if (config.showPipeLabels) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const diaInch = DIAMETER_BY_DN[seg.dn]?.inch || `DN${seg.dn}`;
      const lengthStr = formatLength(seg.length, config.unitSystem || "metric");
      const lbl = `${diaInch} · L=${lengthStr}`;
      svgContent += `<g transform="translate(${mx.toFixed(2)}, ${(my - 2.5).toFixed(2)})">
        <rect x="-14" y="-2" width="28" height="4" rx="0.8" fill="#ffffff" stroke="#94a3b8" stroke-width="0.3"/>
        <text x="0" y="0.8" text-anchor="middle" font-size="1.8" font-family="sans-serif" font-weight="bold" fill="#0f172a">${lbl}</text>
      </g>`;
    }
  });

  // Nœuds et Équipements de tuyauterie
  nodes.forEach((n) => {
    const p = isoProjectPrint(n.x, n.y, n.z, modelCenterIsoX, modelCenterIsoY, scaleMm);

    if (n.equipmentType) {
      const eq = n.equipmentType;
      if (eq.includes("vanne")) {
        svgContent += `<g transform="translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) scale(0.68)">
          <path d="M -5 -3 L 0 0 L -5 3 Z" fill="#0284c7" stroke="#0284c7" stroke-width="0.6"/>
          <path d="M 5 -3 L 0 0 L 5 3 Z" fill="#0284c7" stroke="#0284c7" stroke-width="0.6"/>
          <line x1="0" y1="0" x2="0" y2="-4" stroke="#0284c7" stroke-width="0.8"/>
          <line x1="-2.5" y1="-4" x2="2.5" y2="-4" stroke="#0284c7" stroke-width="0.8"/>
        </g>`;
      } else if (eq.startsWith("coude")) {
        // Tracé d'un coude avec arc géométrique
        svgContent += `<g transform="translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})">
          <circle r="2" fill="#ffffff" stroke="#d97706" stroke-width="0.9"/>
          <path d="M -1.4 1.4 Q 0 0 1.4 -1.4" stroke="#d97706" stroke-width="0.8" fill="none"/>
        </g>`;
      } else if (eq.startsWith("bride") || eq === "joint" || eq === "jmi") {
        svgContent += `<g transform="translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})">
          <line x1="-1.2" y1="-3" x2="-1.2" y2="3" stroke="#b45309" stroke-width="0.8"/>
          <line x1="1.2" y1="-3" x2="1.2" y2="3" stroke="#b45309" stroke-width="0.8"/>
        </g>`;
      } else if (eq === "te_egal" || eq === "te_reduit" || eq === "piquage") {
        svgContent += `<g transform="translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})">
          <circle r="2.2" fill="#16a34a" fill-opacity="0.2" stroke="#16a34a" stroke-width="0.8"/>
          <line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="#16a34a" stroke-width="1"/>
          <line x1="0" y1="0" x2="0" y2="-2.5" stroke="#16a34a" stroke-width="1"/>
        </g>`;
      } else {
        svgContent += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.5" fill="#0284c7"/>`;
      }

      // Libellé de l'équipement
      const label = equipmentLabel(n);
      svgContent += `<text x="${(p.x + 3).toFixed(2)}" y="${(p.y - 1).toFixed(2)}" font-size="2" font-family="sans-serif" font-weight="bold" fill="#0f172a">${label}</text>`;
    } else if (n.type === "entree_poste") {
      svgContent += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.2" fill="#16a34a"/>
      <text x="${(p.x + 3).toFixed(2)}" y="${(p.y + 0.8).toFixed(2)}" font-size="2.2" font-family="sans-serif" font-weight="bold" fill="#16a34a">ENTRÉE ${n.name}</text>`;
    } else if (n.type === "sortie_poste") {
      svgContent += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.2" fill="#dc2626"/>
      <text x="${(p.x + 3).toFixed(2)}" y="${(p.y + 0.8).toFixed(2)}" font-size="2.2" font-family="sans-serif" font-weight="bold" fill="#dc2626">SORTIE ${n.name}</text>`;
    } else {
      svgContent += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.2" fill="#475569"/>
      <text x="${(p.x + 2).toFixed(2)}" y="${(p.y - 1).toFixed(2)}" font-size="1.8" font-family="sans-serif" fill="#64748b">${n.name}</text>`;
    }
  });

  // 7. RENDU MÉCANIQUE : SUPPORTS TUYAUTERIE MSS SP-58
  if (config.showSupports && supports.length > 0) {
    svgContent += `<g id="pdi-mss-supports-layer">`;
    supports.forEach((sup, sIdx) => {
      const wp = sup.worldPos;
      const pt = isoProjectPrint(wp.x, wp.y, wp.z, modelCenterIsoX, modelCenterIsoY, scaleMm);
      const def = MSS_SUPPORT_CATALOG[sup.type] || MSS_SUPPORT_CATALOG.mss_type_35;

      // Dessin du symbole mécanique selon le type MSS SP-58
      if (sup.type === "mss_type_57") {
        // Point fixe rigide / Ancrage intégral (Croix + Ancrage au sol)
        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          <rect x="-3" y="-3" width="6" height="6" fill="#0f172a" stroke="#dc2626" stroke-width="0.6" rx="0.5"/>
          <line x1="-2.2" y1="-2.2" x2="2.2" y2="2.2" stroke="#dc2626" stroke-width="0.5"/>
          <line x1="-2.2" y1="2.2" x2="2.2" y2="-2.2" stroke="#dc2626" stroke-width="0.5"/>
          <line x1="-4" y1="3.5" x2="4" y2="3.5" stroke="#64748b" stroke-width="0.6"/>
          <line x1="-3" y1="3.5" x2="-4" y2="5" stroke="#64748b" stroke-width="0.4"/>
          <line x1="0" y1="3.5" x2="-1" y2="5" stroke="#64748b" stroke-width="0.4"/>
          <line x1="3" y1="3.5" x2="2" y2="5" stroke="#64748b" stroke-width="0.4"/>
        </g>`;
      } else if (sup.type === "mss_type_35") {
        // Guide coulissant transversal & axial (Boîtier glissière + patte vers massif)
        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          <rect x="-3.5" y="-1.5" width="7" height="3" fill="#ffffff" stroke="#0891b2" stroke-width="0.6" rx="0.5"/>
          <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#0891b2" stroke-width="0.5"/>
          <line x1="0" y1="1.5" x2="0" y2="4.5" stroke="#0891b2" stroke-width="0.6"/>
          <line x1="-2.5" y1="4.5" x2="2.5" y2="4.5" stroke="#64748b" stroke-width="0.7"/>
        </g>`;
      } else if (sup.type === "mss_type_1") {
        // Pendard réglable à tige
        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          <circle cx="0" cy="0" r="1.2" fill="#ffffff" stroke="#16a34a" stroke-width="0.6"/>
          <line x1="0" y1="0" x2="0" y2="-6" stroke="#16a34a" stroke-width="0.6"/>
          <polygon points="-2,-6 2,-6 0,-8" fill="#16a34a"/>
          <line x1="-3.5" y1="-8" x2="3.5" y2="-8" stroke="#64748b" stroke-width="0.6"/>
        </g>`;
      } else if (sup.type === "mss_type_39") {
        // Patin soudé (Shoe)
        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          <circle cx="0" cy="0" r="1.1" fill="#9333ea"/>
          <line x1="0" y1="1" x2="0" y2="4" stroke="#9333ea" stroke-width="0.7"/>
          <line x1="-3" y1="4" x2="3" y2="4" stroke="#9333ea" stroke-width="0.8"/>
          <line x1="-4" y1="5" x2="4" y2="5" stroke="#64748b" stroke-width="0.5" stroke-dasharray="1,1"/>
        </g>`;
      } else if (sup.type === "mss_type_51") {
        // Boîte à ressort
        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          <rect x="-2.5" y="-7" width="5" height="5" fill="#ffffff" stroke="#f97316" stroke-width="0.6" rx="0.5"/>
          <path d="M -1.5 -6 L 1.5 -5 L -1.5 -4 L 1.5 -3 L 0 -2" fill="none" stroke="#f97316" stroke-width="0.5"/>
          <line x1="0" y1="-2" x2="0" y2="0" stroke="#f97316" stroke-width="0.6"/>
        </g>`;
      } else {
        // Collier standard
        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          <circle cx="0" cy="0" r="2.2" fill="none" stroke="#db2777" stroke-width="0.6"/>
          <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#db2777" stroke-width="0.6"/>
        </g>`;
      }

      // Étiquette cartouche du support avec repère officiel MSS
      const offY = sIdx % 2 === 0 ? -6.5 : 7.5;
      const chipW = sup.tag.length * 1.8 + 14;
      svgContent += `<g transform="translate(${(pt.x + 4).toFixed(2)}, ${(pt.y + offY).toFixed(2)})">
        <line x1="-3" y1="${(-offY * 0.7).toFixed(2)}" x2="0" y2="0" stroke="#64748b" stroke-width="0.3" stroke-dasharray="1,1"/>
        <rect x="0" y="-2" width="${chipW}" height="4" rx="0.8" fill="#ffffff" stroke="#0891b2" stroke-width="0.4"/>
        <text x="1.5" y="0.8" font-size="1.8" font-family="monospace" font-weight="bold" fill="#0891b2">${sup.tag}</text>
        <text x="${chipW - 1.5}" y="0.8" text-anchor="end" font-size="1.5" font-family="sans-serif" fill="#64748b">MSS-${def.mssStandardNumber}</text>
      </g>`;
    });
    svgContent += `</g>`;
  }

  // 8. SOUDURES ET REPÈRES (PLAN DE SOUDAGE / WELD MAP)
  if (config.showWelds) {
    if (weldSpoolData && weldSpoolData.welds.length > 0) {
      weldSpoolData.welds.forEach((weld) => {
        const pt = isoProjectPrint(weld.worldPos.x, weld.worldPos.y, weld.worldPos.z, modelCenterIsoX, modelCenterIsoY, scaleMm);
        const markerSvg = getWeldMarkerSvg(weld, 3.2);
        const isField = weld.location === "field";
        const isGolden = weld.location === "golden";
        const color = isField ? "#dc2626" : isGolden ? "#d97706" : "#0284c7";
        const locBadge = isField ? "W-F" : isGolden ? "OR" : "W-S";

        svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
          ${markerSvg}
          <line x1="0" y1="-2" x2="3" y2="-5" stroke="${color}" stroke-width="0.3"/>
          <rect x="3" y="-7.2" width="13" height="4.2" rx="0.8" fill="#ffffff" stroke="${color}" stroke-width="0.35"/>
          <text x="4" y="-4.2" font-size="2" font-family="monospace" font-weight="bold" fill="${color}">${weld.weldNumber}</text>
          <text x="15" y="-4.2" text-anchor="end" font-size="1.4" font-family="sans-serif" font-weight="bold" fill="#64748b">${locBadge}</text>
        </g>`;
      });
    } else {
      joints
        .filter((j) => j.weldNumber)
        .forEach((joint) => {
          const node = nodes.find((n) => n.id === joint.nodeId);
          if (!node) return;
          const wPos = portWorldPosition(node, joint.portId);
          const pt = isoProjectPrint(wPos.x, wPos.y, wPos.z, modelCenterIsoX, modelCenterIsoY, scaleMm);
          const isField = joint.location === "field";
          const color = isField ? "#dc2626" : "#0284c7";

          svgContent += `<g transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">
            <circle r="1.6" fill="#ffffff" stroke="${color}" stroke-width="0.5"/>
            <line x1="0" y1="-1.6" x2="2.5" y2="-4" stroke="${color}" stroke-width="0.3"/>
            <text x="3" y="-3.5" font-size="1.8" font-family="monospace" font-weight="bold" fill="${color}">${joint.weldNumber}</text>
          </g>`;
        });
    }
  }

  // 9. COTATIONS NORMALISÉES
  if (config.showDimensions) {
    dimensions.forEach((dim) => {
      const aNode = nodes.find((n) => n.id === dim.a.nodeId);
      const bNode = nodes.find((n) => n.id === dim.b.nodeId);
      if (!aNode || !bNode) return;

      const p1 = isoProjectPrint(aNode.x, aNode.y, aNode.z, modelCenterIsoX, modelCenterIsoY, scaleMm);
      const p2 = isoProjectPrint(bNode.x, bNode.y, bNode.z, modelCenterIsoX, modelCenterIsoY, scaleMm);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;

      const dist = Math.hypot(bNode.x - aNode.x, bNode.y - aNode.y, bNode.z - aNode.z);
      const label = dim.label || (dim.unit === "mm" ? `${Math.round(dist * 1000)} mm` : `${dist.toFixed(2)} m`);

      svgContent += `<g>
        <line x1="${p1.x.toFixed(2)}" y1="${(p1.y - 4).toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${(p2.y - 4).toFixed(2)}" stroke="#0891b2" stroke-width="0.4" stroke-dasharray="1,1"/>
        <line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p1.x.toFixed(2)}" y2="${(p1.y - 4.5).toFixed(2)}" stroke="#94a3b8" stroke-width="0.25"/>
        <line x1="${p2.x.toFixed(2)}" y1="${p2.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${(p2.y - 4.5).toFixed(2)}" stroke="#94a3b8" stroke-width="0.25"/>
        <rect x="${(mx - 8).toFixed(2)}" y="${(my - 5.5).toFixed(2)}" width="16" height="3" rx="0.6" fill="#ffffff" stroke="#0891b2" stroke-width="0.3"/>
        <text x="${mx.toFixed(2)}" y="${(my - 3.4).toFixed(2)}" text-anchor="middle" font-size="1.8" font-family="sans-serif" font-weight="bold" fill="#0891b2">${label}</text>
      </g>`;
    });
  }

  svgContent += `</g>`; // Fin de pdi-piping-iso-model

  // 10. LÉGENDE ADAPTATIVE (SEULEMENT COMPOSANTS RÉELS + MÉCANIQUE + GC)
  if (config.showAdaptiveLegend) {
    const legendItems = buildAdaptiveLegend(
      nodes,
      segments,
      joints,
      config.showSupports ? supports : [],
      config.showCivilEngineering ? cad2dEntities : []
    );
    const lHeight = Math.min(48, 7 + legendItems.length * 4.8);

    svgContent += `<g transform="translate(${legendX}, ${legendY})">
      <rect x="0" y="0" width="${legendW}" height="${lHeight}" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5"/>
      <rect x="0" y="0" width="${legendW}" height="4.5" rx="1.5" fill="#e2e8f0"/>
      <text x="4" y="3.2" font-size="2.1" font-family="sans-serif" font-weight="bold" fill="#0f172a">LÉGENDE TECHNIQUE ADAPTATIVE (ISO 7200)</text>`;

    legendItems.slice(0, 8).forEach((item, idx) => {
      const iy = 7.5 + idx * 4.8;
      svgContent += `<g transform="translate(4, ${iy})">
        <g transform="scale(0.35)">${item.svgIconMarkup}</g>
        <text x="12" y="2.8" font-size="1.8" font-family="sans-serif" fill="#334155">${item.label.slice(0, 32)}</text>
      </g>`;
    });

    svgContent += `</g>`;
  }

  // 11. NOMENCLATURE DU MATÉRIEL (BOM TUYAUTERIE)
  let nextTableY = bomY;
  if (config.showBomTable && bomRows.length > 0) {
    const tableRows = bomRows.slice(0, 9);
    const bomHeight = Math.min(65, 8 + tableRows.length * 3.8);
    nextTableY = bomY + bomHeight + 4;

    svgContent += `<g transform="translate(${bomX}, ${bomY})">
      <rect x="0" y="0" width="${bomW}" height="${bomHeight}" rx="1.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
      <rect x="0" y="0" width="${bomW}" height="4.2" rx="1.5" fill="#0284c7"/>
      <text x="4" y="3" font-size="2" font-family="sans-serif" font-weight="bold" fill="#ffffff">NOMENCLATURE DU MATÉRIEL (BOM TUYAUTERIE)</text>
      <text x="${bomW - 4}" y="3" text-anchor="end" font-size="1.7" font-family="sans-serif" fill="#e0f2fe">${bomRows.length} repères</text>`;

    // En-tête
    svgContent += `<g transform="translate(0, 4.2)" font-size="1.6" font-family="sans-serif" font-weight="bold" fill="#475569">
      <rect x="0" y="0" width="${bomW}" height="3.2" fill="#f1f5f9"/>
      <text x="2.5" y="2.2">RP</text>
      <text x="8" y="2.2">SYM</text>
      <text x="18" y="2.2">DÉSIGNATION</text>
      <text x="${bomW - 32}" y="2.2">DN</text>
      <text x="${bomW - 18}" y="2.2">QTÉ</text>
      <text x="${bomW - 4}" y="2.2" text-anchor="end">LONG.</text>
    </g>`;

    // Lignes
    tableRows.forEach((r, idx) => {
      const ry = 7.4 + idx * 3.8;
      const bg = idx % 2 === 1 ? ' fill="#f8fafc"' : "";
      const symbolSvg = getComponentVignetteSvg(r.fittingType || r.designation, { isPrint: true });
      svgContent += `<g transform="translate(0, ${ry})">
        <rect x="0" y="0" width="${bomW}" height="3.8"${bg}/>
        <line x1="0" y1="3.8" x2="${bomW}" y2="3.8" stroke="#f1f5f9" stroke-width="0.25"/>
        <text x="2.5" y="2.7" font-size="1.6" font-weight="bold" fill="#0284c7">${r.index}</text>
        <g transform="translate(11, 1.9) scale(0.22)">${symbolSvg}</g>
        <text x="18" y="2.7" font-size="1.5" fill="#1e293b">${r.designation.slice(0, 22)}</text>
        <text x="${bomW - 32}" y="2.7" font-size="1.6" fill="#475569">DN${r.dn}</text>
        <text x="${bomW - 18}" y="2.7" font-size="1.6" font-weight="bold" fill="#0f172a">${r.qty}</text>
        <text x="${bomW - 4}" y="2.7" text-anchor="end" font-size="1.6" fill="#475569">${r.length > 0 ? formatLength(r.length, config.unitSystem || "metric") : "-"}</text>
      </g>`;
    });

    svgContent += `</g>`;
  }

  // 12. NOUVEAU TABLEAU MÉCANIQUE : SUPPORTS MSS SP-58 & GÉNIE CIVIL
  if (config.showSupportTable && supports.length > 0) {
    const civilMto = computeCivilMto(supports);
    const supRows = supports.slice(0, 7);
    const tableH = Math.min(innerH - nextTableY - 4, 8 + supRows.length * 3.8 + 6);

    if (tableH > 16) {
      svgContent += `<g transform="translate(${sideColX}, ${nextTableY})">
        <rect x="0" y="0" width="${sideColW}" height="${tableH}" rx="1.5" fill="#ffffff" stroke="#0891b2" stroke-width="0.5"/>
        <rect x="0" y="0" width="${sideColW}" height="4.2" rx="1.5" fill="#0e7490"/>
        <text x="4" y="3" font-size="2" font-family="sans-serif" font-weight="bold" fill="#ffffff">SUPPORTS MSS SP-58 & GÉNIE CIVIL</text>
        <text x="${sideColW - 4}" y="3" text-anchor="end" font-size="1.6" font-family="sans-serif" fill="#cffafe">${supports.length} supp.</text>`;

      // En-tête colonnes supports
      svgContent += `<g transform="translate(0, 4.2)" font-size="1.6" font-family="sans-serif" font-weight="bold" fill="#475569">
        <rect x="0" y="0" width="${sideColW}" height="3.2" fill="#ecfeff"/>
        <text x="2.5" y="2.2">TAG</text>
        <text x="12" y="2.2">SYM</text>
        <text x="22" y="2.2">TYPE MSS</text>
        <text x="${sideColW - 45}" y="2.2">PLATINE</text>
        <text x="${sideColW - 4}" y="2.2" text-anchor="end">MASSIF</text>
      </g>`;

      supRows.forEach((s, idx) => {
        const ry = 7.4 + idx * 3.8;
        const bg = idx % 2 === 1 ? ' fill="#f0fdfa"' : "";
        const def = MSS_SUPPORT_CATALOG[s.type] || MSS_SUPPORT_CATALOG.mss_type_35;
        const plateStr = `${s.civilSpec.basePlateLengthMm}x${s.civilSpec.basePlateWidthMm}`;
        const concStr = `${s.civilSpec.calculatedConcreteVolumeM3}m³`;
        const supportSvg = getMssSupportVignetteSvg(s.type, true);

        svgContent += `<g transform="translate(0, ${ry})">
          <rect x="0" y="0" width="${sideColW}" height="3.8"${bg}/>
          <line x1="0" y1="3.8" x2="${sideColW}" y2="3.8" stroke="#e0f2fe" stroke-width="0.25"/>
          <text x="2.5" y="2.7" font-size="1.5" font-weight="bold" fill="#0891b2">${s.tag}</text>
          <g transform="translate(15, 1.9) scale(0.22)">${supportSvg}</g>
          <text x="22" y="2.7" font-size="1.4" fill="#1e293b">MSS-${def.mssStandardNumber} (${def.labelFr.slice(0, 10)})</text>
          <text x="${sideColW - 45}" y="2.7" font-size="1.5" fill="#475569">${plateStr}</text>
          <text x="${sideColW - 4}" y="2.7" text-anchor="end" font-size="1.5" font-weight="bold" fill="#0e7490">${concStr}</text>
        </g>`;
      });

      // Synthèse métré GC en pied de tableau
      const footerY = tableH - 4.5;
      svgContent += `<rect x="0" y="${footerY}" width="${sideColW}" height="4.5" fill="#f8fafc" stroke-top="#cbd5e1"/>
        <text x="4" y="${footerY + 3}" font-size="1.6" font-family="sans-serif" font-weight="bold" fill="#334155">
          MTO GC : Béton ${civilMto.totalConcreteVolumeM3} m³ · Acier ${civilMto.totalBasePlateWeightKg} kg · ${civilMto.totalAnchorsCount} ancrages
        </text>`;

      svgContent += `</g>`;
      nextTableY += tableH + 4;
    }
  }

  // 12b. TABLEAU DES SOUDURES / WELD LOG (ASME B31.3)
  if (config.showWeldTable && weldSpoolData && weldSpoolData.welds.length > 0) {
    const weldRows = weldSpoolData.welds.slice(0, 8);
    const weldTableH = Math.min(innerH - nextTableY - 4, 8 + weldRows.length * 3.8 + 5);

    if (weldTableH > 16) {
      svgContent += `<g transform="translate(${sideColX}, ${nextTableY})">
        <rect x="0" y="0" width="${sideColW}" height="${weldTableH}" rx="1.5" fill="#ffffff" stroke="#b45309" stroke-width="0.5"/>
        <rect x="0" y="0" width="${sideColW}" height="4.2" rx="1.5" fill="#b45309"/>
        <text x="4" y="3" font-size="2" font-family="sans-serif" font-weight="bold" fill="#ffffff">PLAN DE SOUDAGE / WELD MAP (ASME B31.3)</text>
        <text x="${sideColW - 4}" y="3" text-anchor="end" font-size="1.6" font-family="sans-serif" fill="#fef3c7">${weldSpoolData.welds.length} soudures</text>`;

      // En-tête
      svgContent += `<g transform="translate(0, 4.2)" font-size="1.5" font-family="sans-serif" font-weight="bold" fill="#475569">
        <rect x="0" y="0" width="${sideColW}" height="3.2" fill="#fffbeb"/>
        <text x="2.5" y="2.2">REP.</text>
        <text x="13" y="2.2">SPOOL</text>
        <text x="28" y="2.2">LOC.</text>
        <text x="42" y="2.2">DN</text>
        <text x="${sideColW - 32}" y="2.2">WPS</text>
        <text x="${sideColW - 4}" y="2.2" text-anchor="end">CND VT/RT</text>
      </g>`;

      weldRows.forEach((w, idx) => {
        const ry = 7.4 + idx * 3.8;
        const bg = idx % 2 === 1 ? ' fill="#fefce8"' : "";
        const isField = w.location === "field";
        const isGolden = w.location === "golden";
        const locColor = isField ? "#dc2626" : isGolden ? "#d97706" : "#0284c7";
        const locTxt = isField ? "Chantier" : isGolden ? "Golden" : "Atelier";

        svgContent += `<g transform="translate(0, ${ry})">
          <rect x="0" y="0" width="${sideColW}" height="3.8"${bg}/>
          <line x1="0" y1="3.8" x2="${sideColW}" y2="3.8" stroke="#fef08a" stroke-width="0.25"/>
          <text x="2.5" y="2.7" font-size="1.5" font-weight="bold" fill="${locColor}">${w.weldNumber}</text>
          <text x="13" y="2.7" font-size="1.4" font-family="monospace" fill="#334155">${w.spoolId || "-"}</text>
          <text x="28" y="2.7" font-size="1.4" font-weight="bold" fill="${locColor}">${locTxt}</text>
          <text x="42" y="2.7" font-size="1.4" fill="#475569">DN${w.dn}</text>
          <text x="${sideColW - 32}" y="2.7" font-size="1.3" font-family="monospace" fill="#64748b">${w.wpsRef}</text>
          <text x="${sideColW - 4}" y="2.7" text-anchor="end" font-size="1.4" font-weight="bold" fill="#0f766e">${w.ndtRequired.slice(0, 10)}</text>
        </g>`;
      });

      const wFooterY = weldTableH - 4;
      svgContent += `<rect x="0" y="${wFooterY}" width="${sideColW}" height="4" fill="#fffbeb" stroke-top="#fde68a"/>
        <text x="4" y="${wFooterY + 2.7}" font-size="1.5" font-family="sans-serif" font-weight="bold" fill="#78350f">
          Atelier : ${weldSpoolData.summary.shopWelds} · Chantier : ${weldSpoolData.summary.fieldWelds} · NDT RT : ${weldSpoolData.summary.rtWelds}
        </text>`;

      svgContent += `</g>`;
      nextTableY += weldTableH + 4;
    }
  }

  // 12c. CARNET DE SPOOLS / SPOOL SCHEDULE
  if (config.showSpoolTable && weldSpoolData && weldSpoolData.spools.length > 0) {
    const spoolRows = weldSpoolData.spools.slice(0, 6);
    const spoolTableH = Math.min(innerH - nextTableY - 4, 8 + spoolRows.length * 3.8 + 5);

    if (spoolTableH > 16) {
      svgContent += `<g transform="translate(${sideColX}, ${nextTableY})">
        <rect x="0" y="0" width="${sideColW}" height="${spoolTableH}" rx="1.5" fill="#ffffff" stroke="#7c3aed" stroke-width="0.5"/>
        <rect x="0" y="0" width="${sideColW}" height="4.2" rx="1.5" fill="#7c3aed"/>
        <text x="4" y="3" font-size="2" font-family="sans-serif" font-weight="bold" fill="#ffffff">CARNET DE SPOOLS / SPOOL SCHEDULE</text>
        <text x="${sideColW - 4}" y="3" text-anchor="end" font-size="1.6" font-family="sans-serif" fill="#ede9fe">${weldSpoolData.spools.length} spools</text>`;

      // En-tête
      svgContent += `<g transform="translate(0, 4.2)" font-size="1.5" font-family="sans-serif" font-weight="bold" fill="#475569">
        <rect x="0" y="0" width="${sideColW}" height="3.2" fill="#faf5ff"/>
        <text x="2.5" y="2.2">SPOOL</text>
        <text x="18" y="2.2">LONG. (m)</text>
        <text x="36" y="2.2">POIDS</text>
        <text x="${sideColW - 32}" y="2.2">ENCOMBR.</text>
        <text x="${sideColW - 4}" y="2.2" text-anchor="end">GABARIT</text>
      </g>`;

      spoolRows.forEach((sp, idx) => {
        const ry = 7.4 + idx * 3.8;
        const bg = idx % 2 === 1 ? ' fill="#f5f3ff"' : "";
        const lgStr = `${sp.totalLengthM.toFixed(2)} m`;
        const weightStr = `${Math.round(sp.estimatedWeightKg)} kg`;
        const encStr = `${sp.boundingSize.dx.toFixed(1)}x${sp.boundingSize.dy.toFixed(1)}`;
        const gabaritColor = sp.isTransportable ? "#16a34a" : "#dc2626";
        const gabaritTxt = sp.isTransportable ? "≤12m OK" : ">12m CONVOI";

        svgContent += `<g transform="translate(0, ${ry})">
          <rect x="0" y="0" width="${sideColW}" height="3.8"${bg}/>
          <line x1="0" y1="3.8" x2="${sideColW}" y2="3.8" stroke="#e9d5ff" stroke-width="0.25"/>
          <text x="2.5" y="2.7" font-size="1.5" font-weight="bold" fill="${sp.color}">${sp.id}</text>
          <text x="18" y="2.7" font-size="1.4" fill="#334155">${lgStr}</text>
          <text x="36" y="2.7" font-size="1.4" fill="#475569">${weightStr}</text>
          <text x="${sideColW - 32}" y="2.7" font-size="1.3" font-family="monospace" fill="#64748b">${encStr}</text>
          <text x="${sideColW - 4}" y="2.7" text-anchor="end" font-size="1.4" font-weight="bold" fill="${gabaritColor}">${gabaritTxt}</text>
        </g>`;
      });

      const spFooterY = spoolTableH - 4;
      svgContent += `<rect x="0" y="${spFooterY}" width="${sideColW}" height="4" fill="#faf5ff" stroke-top="#ddd6fe"/>
        <text x="4" y="${spFooterY + 2.7}" font-size="1.5" font-family="sans-serif" font-weight="bold" fill="#5b21b6">
          Linéaire total : ${weldSpoolData.summary.totalCutLengthM.toFixed(1)} m · Poids : ${Math.round(weldSpoolData.summary.totalPipingWeightKg)} kg
        </text>`;

      svgContent += `</g>`;
      nextTableY += spoolTableH + 4;
    }
  }

  // 13. CARTOUCHE TECHNIQUE CONFORME ISO 7200
  if (config.showCartoucheIso7200) {
    const compName = pdiCompanyName();
    const stdNote = pdiStandardsNote();
    const pressureDesignFormatted = formatPressure(config.pressureDesign || 75, config.unitSystem || "metric");
    const hydrotestFormatted = formatPressure(config.hydrotestPressure || 112.5, config.unitSystem || "metric");

    svgContent += `<g id="iso-7200-title-block" transform="translate(${cartoucheX}, ${cartoucheY})">
      <rect x="0" y="0" width="${cartoucheW}" height="${cartoucheH}" fill="#ffffff" stroke="#0f172a" stroke-width="0.7"/>

      <!-- Bloc supérieur : Titre et Organisation -->
      <line x1="0" y1="14" x2="${cartoucheW}" y2="14" stroke="#0f172a" stroke-width="0.4"/>
      <line x1="${cartoucheW * 0.5}" y1="0" x2="${cartoucheW * 0.5}" y2="14" stroke="#0f172a" stroke-width="0.4"/>

      <!-- Logo & Société -->
      <text x="3" y="4.5" font-size="2.2" font-family="sans-serif" font-weight="bold" fill="#64748b">PROPRIÉTAIRE DU PLAN / ORGANISME</text>
      <text x="3" y="9.5" font-size="4" font-family="sans-serif" font-weight="900" fill="#0f172a">${compName}</text>
      <text x="3" y="12.5" font-size="1.8" font-family="sans-serif" fill="#64748b">${config.wilayaOrSite || "INSTALLATION GAZ"}</text>

      <!-- Titre principal du document -->
      <text x="${cartoucheW * 0.5 + 3}" y="4.5" font-size="2.2" font-family="sans-serif" font-weight="bold" fill="#64748b">TITRE DU DOCUMENT (ISO 7200)</text>
      <text x="${cartoucheW * 0.5 + 3}" y="9.5" font-size="3.6" font-family="sans-serif" font-weight="bold" fill="#0284c7">${config.documentTitle.slice(0, 32)}</text>
      <text x="${cartoucheW * 0.5 + 3}" y="12.5" font-size="1.8" font-family="sans-serif" fill="#64748b">RÉF : ${config.documentNumber} · INDICE ${config.revision}</text>

      <!-- Bloc intermédiaire : Approbations & Intervenants -->
      <line x1="0" y1="28" x2="${cartoucheW}" y2="28" stroke="#0f172a" stroke-width="0.4"/>
      <line x1="${cartoucheW * 0.33}" y1="14" x2="${cartoucheW * 0.33}" y2="28" stroke="#0f172a" stroke-width="0.3"/>
      <line x1="${cartoucheW * 0.66}" y1="14" x2="${cartoucheW * 0.66}" y2="28" stroke="#0f172a" stroke-width="0.3"/>

      <!-- Dessiné -->
      <text x="3" y="17.5" font-size="1.8" font-family="sans-serif" fill="#64748b">DESSINÉ PAR :</text>
      <text x="3" y="22" font-size="2.4" font-family="sans-serif" font-weight="bold" fill="#0f172a">${config.drawnBy}</text>
      <text x="3" y="26" font-size="1.6" font-family="sans-serif" fill="#64748b">${new Date().toISOString().slice(0, 10)}</text>

      <!-- Vérifié -->
      <text x="${cartoucheW * 0.33 + 3}" y="17.5" font-size="1.8" font-family="sans-serif" fill="#64748b">VÉRIFIÉ PAR :</text>
      <text x="${cartoucheW * 0.33 + 3}" y="22" font-size="2.4" font-family="sans-serif" font-weight="bold" fill="#0f172a">${config.checkedBy}</text>
      <text x="${cartoucheW * 0.33 + 3}" y="26" font-size="1.6" font-family="sans-serif" fill="#64748b">CONFORME CAO</text>

      <!-- Approuvé -->
      <text x="${cartoucheW * 0.66 + 3}" y="17.5" font-size="1.8" font-family="sans-serif" fill="#64748b">APPROUVÉ PAR :</text>
      <text x="${cartoucheW * 0.66 + 3}" y="22" font-size="2.4" font-family="sans-serif" font-weight="bold" fill="#0f172a">${config.approvedBy}</text>
      <text x="${cartoucheW * 0.66 + 3}" y="26" font-size="1.6" font-family="sans-serif" fill="#16a34a">BON POUR EXÉCUTION</text>

      <!-- Bloc Données Spécifications Process -->
      <line x1="0" y1="42" x2="${cartoucheW}" y2="42" stroke="#0f172a" stroke-width="0.4"/>
      <line x1="${cartoucheW * 0.25}" y1="28" x2="${cartoucheW * 0.25}" y2="42" stroke="#0f172a" stroke-width="0.3"/>
      <line x1="${cartoucheW * 0.5}" y1="28" x2="${cartoucheW * 0.5}" y2="42" stroke="#0f172a" stroke-width="0.3"/>
      <line x1="${cartoucheW * 0.75}" y1="28" x2="${cartoucheW * 0.75}" y2="42" stroke="#0f172a" stroke-width="0.3"/>

      <!-- Données process -->
      <text x="3" y="32" font-size="1.8" font-family="sans-serif" fill="#64748b">PRESSION SERVICE</text>
      <text x="3" y="38" font-size="2.8" font-family="sans-serif" font-weight="bold" fill="#0284c7">${pressureDesignFormatted}</text>

      <text x="${cartoucheW * 0.25 + 3}" y="32" font-size="1.8" font-family="sans-serif" fill="#64748b">ÉPREUVE HYDRO</text>
      <text x="${cartoucheW * 0.25 + 3}" y="38" font-size="2.8" font-family="sans-serif" font-weight="bold" fill="#dc2626">${hydrotestFormatted}</text>

      <text x="${cartoucheW * 0.5 + 3}" y="32" font-size="1.8" font-family="sans-serif" fill="#64748b">ÉCHELLE PLANCHE</text>
      <text x="${cartoucheW * 0.5 + 3}" y="38" font-size="2.6" font-family="sans-serif" font-weight="bold" fill="#0f172a">${scaleAppliedLabel}</text>

      <text x="${cartoucheW * 0.75 + 3}" y="32" font-size="1.8" font-family="sans-serif" fill="#64748b">FORMAT FEUILLE</text>
      <text x="${cartoucheW * 0.75 + 3}" y="38" font-size="3" font-family="sans-serif" font-weight="bold" fill="#0f172a">${config.format} ${config.orientation === "landscape" ? "PAYSAGE" : "PORTRAIT"}</text>

      <!-- Pied du cartouche : Normes et signature logicielle -->
      <rect x="0" y="42" width="${cartoucheW}" height="${cartoucheH - 42}" fill="#f8fafc"/>
      <text x="3" y="47" font-size="1.8" font-family="sans-serif" fill="#475569">NORMES : ${stdNote}</text>
      <text x="3" y="51" font-size="1.6" font-family="sans-serif" fill="#94a3b8">FOLIO ${config.pageNumber} SUR ${config.totalPages} · SYSTÈME DE GESTION CAO INDUSTRIEL CONFORME ISO 7200 / ISO 5457</text>
      <text x="${cartoucheW - 3}" y="49" text-anchor="end" font-size="2.2" font-family="sans-serif" font-weight="bold" fill="#0f172a">${PDI_ENGINE_IDENTITY.vendor}</text>
    </g>`;
  }

  // 14. WATERMARK EN PIED DE PLANCHE
  if (config.showWatermarkFootprint) {
    const wmX = leftM + 5;
    const wmY = topM + innerH - 2.5;
    svgContent += `<text x="${wmX}" y="${wmY}" font-size="1.8" font-family="sans-serif" font-weight="bold" fill="#94a3b8">
      POWERED BY ${PDI_ENGINE_IDENTITY.vendor} · ${PDI_ENGINE_IDENTITY.product} v${PDI_ENGINE_IDENTITY.version} · ${PDI_ENGINE_IDENTITY.copyright} [${PDI_WATERMARK_SIGNATURE}]
    </text>`;
  }

  const rawSvgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="display:block; width:100%; height:100%; background:#ffffff;">
    ${svgContent}
  </svg>`;

  const svgMarkup = rawSvgMarkup.replace(/&(?!(amp|lt|gt|quot|apos|#\d+);)/g, "&amp;");

  return {
    svgMarkup,
    widthMm: W,
    heightMm: H,
    scaleApplied: scaleAppliedLabel,
  };
}
