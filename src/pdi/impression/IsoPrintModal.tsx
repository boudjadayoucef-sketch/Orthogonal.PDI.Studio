/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * DIALOGUE D'IMPRESSION NORMALISÉ ISO 216 / ISO 7200 / ISO 5457 (PATCH 020F & EXPANSION PALIER 2C).
 * INCLUT : TUYAUTERIE, SUPPORTAGE MÉCANIQUE MSS SP-58, GÉNIE CIVIL & MODES TOUT/SÉLECTION/FENÊTRE.
 */

import React, { useState, useMemo } from "react";
import {
  Printer,
  Download,
  X,
  Settings2,
  FileText,
  Layers,
  Eye,
  CheckSquare,
  Crop,
  Maximize2,
  Table,
  Box,
  HardHat,
  Crosshair,
  RotateCcw,
  Flame,
} from "lucide-react";
import {
  IsoPaperFormat,
  IsoPrintConfig,
  DEFAULT_PRINT_CONFIG,
  ISO_SCALES,
  IsoPrintScope,
} from "./isoSheetStandards";
import { generateIsoDrawingSvg, BomRow } from "./isoSvgGenerator";
import {
  IsoNode,
  IsoSegment,
  IsoDimension,
  PipingJoint,
  DIAMETER_BY_DN,
} from "../isometric/types/isoGraphTypes";
import {
  PDI_STYLE_IMPRESSION_017L,
  pdiFeuilleImpression017L,
} from "./pdiImpression017L";
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
import { deriveSpoolsAndWelds, WeldSpoolResult } from "../welding/isoWeldSpoolEngine";

export interface IsoPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  wilaya?: string;
  pressDesign?: number;
  hydrotest?: number;
  nodes: IsoNode[];
  segments: IsoSegment[];
  dimensions: IsoDimension[];
  joints: PipingJoint[];
  bomRows: BomRow[];
  initialUnitSystem?: "metric" | "imperial";
  supports?: IsoPipingSupport[];
  cad2dEntities?: Cad2dEntity[];
  selectedNodeIds?: string[];
  selectedSegmentIds?: string[];
  selectedSupportId?: string | null;
  selectedCad2dIds?: string[];
  weldSpoolData?: WeldSpoolResult;
  initialWeldMapMode?: boolean;
}

export const IsoPrintModal: React.FC<IsoPrintModalProps> = ({
  isOpen,
  onClose,
  projectName,
  wilaya,
  pressDesign,
  hydrotest,
  nodes,
  segments,
  dimensions,
  joints,
  bomRows,
  initialUnitSystem,
  supports = [],
  cad2dEntities = [],
  selectedNodeIds = [],
  selectedSegmentIds = [],
  selectedSupportId = null,
  selectedCad2dIds = [],
  weldSpoolData,
  initialWeldMapMode = false,
}) => {
  const [config, setConfig] = useState<IsoPrintConfig>(() => ({
    ...DEFAULT_PRINT_CONFIG,
    documentTitle: initialWeldMapMode
      ? "PLAN DE SOUDAGE & CARNET DE SPOOLS (WELD MAP)"
      : projectName || "PLAN ISOMÉTRIQUE TUYAUTERIE INDUSTRIELLE",
    pressureDesign: pressDesign,
    hydrotestPressure: hydrotest,
    wilayaOrSite: wilaya || "SITE INDUSTRIEL",
    unitSystem: initialUnitSystem || "metric",
    printScope: "all",
    showSupports: true,
    showCivilEngineering: true,
    showSupportTable: true,
    weldMapMode: initialWeldMapMode,
    showSpoolColors: initialWeldMapMode,
    showWeldTable: initialWeldMapMode,
    showSpoolTable: initialWeldMapMode,
    windowZoomRatio: 1,
  }));

  const [activeTab, setActiveTab] = useState<"layout" | "metadata" | "layers" | "tables">("layout");

  // FILTRAGE STRICT DES ÉLÉMENTS EFFECTIFS SELON LE MODE D'IMPRESSION CHOISI
  const {
    effectiveNodes,
    effectiveSegments,
    effectiveSupports,
    effectiveCad2d,
    effectiveJoints,
    effectiveDimensions,
    effectiveBomRows,
    hasSelectionItems,
  } = useMemo(() => {
    if (config.printScope === "selection") {
      const selSegSet = new Set(selectedSegmentIds);
      const selNodeSet = new Set(selectedNodeIds);
      const selCad2dSet = new Set(selectedCad2dIds);

      // Si un segment est sélectionné, inclure obligatoirement ses nœuds d'extrémité
      segments.forEach((seg) => {
        if (selSegSet.has(seg.id)) {
          selNodeSet.add(seg.fromNodeId);
          selNodeSet.add(seg.toNodeId);
        }
      });

      // Si deux nœuds sont sélectionnés, inclure les segments qui les lient
      segments.forEach((seg) => {
        if (selNodeSet.has(seg.fromNodeId) && selNodeSet.has(seg.toNodeId)) {
          selSegSet.add(seg.id);
        }
      });

      const hasItems = selSegSet.size > 0 || selNodeSet.size > 0 || selectedSupportId !== null || selCad2dSet.size > 0;

      if (!hasItems) {
        // Aucune sélection dans le modèle : fallback gracieux
        return {
          effectiveNodes: nodes,
          effectiveSegments: segments,
          effectiveSupports: supports,
          effectiveCad2d: cad2dEntities,
          effectiveJoints: joints,
          effectiveDimensions: dimensions,
          effectiveBomRows: bomRows,
          hasSelectionItems: false,
        };
      }

      const effSegs = segments.filter((s) => selSegSet.has(s.id));
      const effNds = nodes.filter((n) => selNodeSet.has(n.id));
      const effSups = supports.filter(
        (sup) => sup.id === selectedSupportId || selSegSet.has(sup.segmentId)
      );
      const effGc = cad2dEntities.filter((c) => selCad2dSet.has(c.id));
      const effJts = joints.filter((j) => selNodeSet.has(j.nodeId));
      const effDims = dimensions.filter(
        (d) => selNodeSet.has(d.a.nodeId) || selNodeSet.has(d.b.nodeId)
      );

      // Re-calcul dynamique de la BOM selon la sélection
      const effBom: BomRow[] = [];
      let rIdx = 1;

      // Tuyauterie droite
      const pipesByDn: Record<number, { length: number; count: number; pn: string; mat: string }> = {};
      effSegs.forEach((seg) => {
        if (!pipesByDn[seg.dn]) {
          pipesByDn[seg.dn] = { length: 0, count: 0, pn: seg.pn || "PN100", mat: seg.material || "ASTM A106 Gr.B" };
        }
        pipesByDn[seg.dn].length += seg.length || 0;
        pipesByDn[seg.dn].count += 1;
      });

      Object.entries(pipesByDn).forEach(([dnStr, data]) => {
        const dn = Number(dnStr);
        const inch = DIAMETER_BY_DN[dn]?.inch || `DN${dn}`;
        effBom.push({
          index: rIdx++,
          designation: `Tube Acier Sans Soudure (${data.mat})`,
          dn,
          inch,
          qty: data.count,
          unit: "m",
          length: Number(data.length.toFixed(2)),
          reference: `TUBE-${inch}-${data.pn}`,
        });
      });

      // Équipements sur nœuds sélectionnés
      const equipCount: Record<string, { count: number; label: string; dn: number }> = {};
      effNds.forEach((n) => {
        if (n.equipmentType) {
          const key = `${n.equipmentType}_${n.dn || 150}`;
          if (!equipCount[key]) {
            equipCount[key] = { count: 0, label: n.name || n.equipmentType, dn: n.dn || 150 };
          }
          equipCount[key].count += 1;
        }
      });

      Object.values(equipCount).forEach((eq) => {
        const inch = DIAMETER_BY_DN[eq.dn]?.inch || `DN${eq.dn}`;
        effBom.push({
          index: rIdx++,
          designation: eq.label,
          dn: eq.dn,
          inch,
          qty: eq.count,
          unit: "U",
          length: 0,
          reference: `EQ-${inch}`,
        });
      });

      return {
        effectiveNodes: effNds,
        effectiveSegments: effSegs,
        effectiveSupports: effSups,
        effectiveCad2d: effGc,
        effectiveJoints: effJts,
        effectiveDimensions: effDims,
        effectiveBomRows: effBom.length > 0 ? effBom : bomRows,
        hasSelectionItems: true,
      };
    }

    // Mode "all" ou "window"
    return {
      effectiveNodes: nodes,
      effectiveSegments: segments,
      effectiveSupports: supports,
      effectiveCad2d: cad2dEntities,
      effectiveJoints: joints,
      effectiveDimensions: dimensions,
      effectiveBomRows: bomRows,
      hasSelectionItems: true,
    };
  }, [
    config.printScope,
    nodes,
    segments,
    supports,
    cad2dEntities,
    joints,
    dimensions,
    bomRows,
    selectedNodeIds,
    selectedSegmentIds,
    selectedSupportId,
    selectedCad2dIds,
  ]);

  // Quantitatifs Génie Civil calculés
  const civilMto = useMemo(() => {
    return computeCivilMto(effectiveSupports);
  }, [effectiveSupports]);

  // Données Spools & Soudures effectives (calcul automatique ou injecté)
  const effectiveWeldSpoolData = useMemo(() => {
    if (weldSpoolData) return weldSpoolData;
    return deriveSpoolsAndWelds(effectiveNodes, effectiveSegments);
  }, [weldSpoolData, effectiveNodes, effectiveSegments]);

  // Rendu vectoriel SVG de la planche en temps réel avec tous les composants
  const drawingResult = useMemo(() => {
    return generateIsoDrawingSvg(
      effectiveNodes,
      effectiveSegments,
      effectiveDimensions,
      effectiveJoints,
      effectiveBomRows,
      config,
      config.showSupports ? effectiveSupports : [],
      config.showCivilEngineering ? effectiveCad2d : [],
      effectiveWeldSpoolData
    );
  }, [
    effectiveNodes,
    effectiveSegments,
    effectiveDimensions,
    effectiveJoints,
    effectiveBomRows,
    config,
    effectiveSupports,
    effectiveCad2d,
    effectiveWeldSpoolData,
  ]);

  if (!isOpen) return null;

  /**
   * Lance l'impression papier ou l'export PDF via la boîte de dialogue native du navigateur
   */
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour afficher le module d'impression.");
      return;
    }

    const cssBase = pdiFeuilleImpression017L();
    const isLandscape = config.orientation === "landscape";
    const pageSize = `${config.format} ${isLandscape ? "landscape" : "portrait"}`;

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>${config.documentTitle} — ${config.documentNumber} [${config.format}]</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 0;
    }
    ${PDI_STYLE_IMPRESSION_017L}
    ${cssBase}
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
      color: #0f172a;
      overflow: hidden;
    }
    .print-sheet-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    .print-sheet-container svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="print-sheet-container">
    ${drawingResult.svgMarkup}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  /**
   * Télécharge directement le fichier SVG vectoriel pur de la planche
   */
  const handleDownloadSvg = () => {
    const blob = new Blob([drawingResult.svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = config.documentTitle.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    link.href = url;
    link.download = `${safeTitle}_${config.format}_${config.orientation}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
      <div className="w-[96vw] max-w-[1460px] h-[92vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* En-tête du dialogue */}
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/40 text-cyan-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-wide text-white uppercase">
                  Module d'Impression Normalisé ISO 216 / 7200 / 5457
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-900/60 border border-cyan-700/40 text-cyan-300">
                  Palier 2C · Tuyauterie + Mécanique + Génie Civil
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Génération vectorielle certifiée ORTHOGONAL - ENG avec calcul dynamique des métrés
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-zinc-200 transition-colors"
              title="Télécharger le plan en format SVG vectoriel haute définition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exporter SVG Vectoriel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg transition-colors"
              title="Ouvrir le menu d'impression / export PDF du navigateur"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer / Exporter PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps principal : Volet de configuration à gauche + Prévisualisation à droite */}
        <div className="flex-1 flex min-h-0">
          {/* Panneau de configuration latéral */}
          <div className="w-[390px] border-r border-zinc-800 flex flex-col bg-zinc-900/30 overflow-y-auto">
            {/* Onglets de paramétrage */}
            <div className="flex border-b border-zinc-800 px-2 pt-2 gap-1 bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setActiveTab("layout")}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "layout"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Mise en page</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("layers")}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "layers"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Calques</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tables")}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "tables"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Tableaux & MTO</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("metadata")}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "metadata"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Cartouche</span>
              </button>
            </div>

            {/* Contenu Onglet 1 : Mise en page */}
            {activeTab === "layout" && (
              <div className="p-4 space-y-4 text-xs">
                {/* 1. NOUVEAU SÉLECTEUR DE MODE D'IMPRESSION (TOUT / SÉLECTION / FENÊTRE) */}
                <div>
                  <label className="block text-zinc-300 font-bold mb-1.5 flex items-center justify-between">
                    <span>Mode de cadrage / Portée</span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {effectiveSegments.length} tubes · {effectiveSupports.length} supp · {effectiveCad2d.length} GC
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, printScope: "all" }))}
                      className={`px-2 py-2 rounded-lg font-bold text-center border transition-all flex flex-col items-center gap-1 ${
                        config.printScope === "all"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300 shadow"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Tout le dessin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, printScope: "selection" }))}
                      className={`px-2 py-2 rounded-lg font-bold text-center border transition-all flex flex-col items-center gap-1 ${
                        config.printScope === "selection"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300 shadow"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Sélection</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, printScope: "window" }))}
                      className={`px-2 py-2 rounded-lg font-bold text-center border transition-all flex flex-col items-center gap-1 ${
                        config.printScope === "window"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300 shadow"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Fenêtre</span>
                    </button>
                  </div>

                  {config.printScope === "selection" && !hasSelectionItems && (
                    <div className="mt-1.5 p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300">
                      ℹ Aucun élément sélectionné sur le canevas 3D. Le plan inclut l'ensemble du réseau.
                    </div>
                  )}

                  {config.printScope === "window" && (
                    <div className="mt-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-bold">Zoom de cadrage fenêtre</span>
                        <span className="text-cyan-400 font-mono font-bold">
                          {Math.round((config.windowZoomRatio || 1) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={config.windowZoomRatio || 1}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            windowZoomRatio: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Format de papier ISO 216 */}
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Format de planche (ISO 216)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["A5", "A4", "A3", "A2", "A1", "A0"] as IsoPaperFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, format: fmt }))}
                        className={`px-3 py-2 rounded-lg font-mono font-bold text-center border transition-all ${
                          config.format === fmt
                            ? "bg-cyan-950 border-cyan-500 text-cyan-300 shadow"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Dimensions : {drawingResult.widthMm} × {drawingResult.heightMm} mm
                  </div>
                </div>

                {/* Orientation */}
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Orientation</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, orientation: "landscape" }))}
                      className={`px-3 py-2 rounded-lg font-bold text-center border transition-all ${
                        config.orientation === "landscape"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Paysage (Standard ISO)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, orientation: "portrait" }))}
                      className={`px-3 py-2 rounded-lg font-bold text-center border transition-all ${
                        config.orientation === "portrait"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Portrait
                    </button>
                  </div>
                </div>

                {/* Échelle normalisée */}
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Échelle de représentation
                  </label>
                  <select
                    value={config.scale}
                    onChange={(e) => setConfig((prev) => ({ ...prev, scale: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    {ISO_SCALES.map((sc) => (
                      <option key={sc.value} value={sc.value}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Échelle effective appliquée : {drawingResult.scaleApplied}
                  </div>
                </div>

                {/* Centrage & Calage fin dans la zone graphique */}
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs">
                      <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Centrage dans la zone utile</span>
                    </div>
                    {((config.offsetX || 0) !== 0 || (config.offsetY || 0) !== 0) ? (
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, offsetX: 0, offsetY: 0 }))}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                        title="Rétablir le centrage automatique mathématique"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Réinitialiser</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Auto-centré
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Le tracé est automatiquement calculé et centré dans l'espace utile de la planche (dégagé du cartouche et des tableaux).
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                        <span>Axe X (horizontal)</span>
                        <span className="font-mono text-zinc-300">{config.offsetX || 0} mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offsetX: (prev.offsetX || 0) - 5 }))}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-mono"
                          title="Décaler de 5 mm vers la gauche"
                        >
                          -5
                        </button>
                        <input
                          type="number"
                          value={config.offsetX || 0}
                          onChange={(e) => setConfig((prev) => ({ ...prev, offsetX: Number(e.target.value) || 0 }))}
                          className="w-full text-center bg-zinc-950 border border-zinc-700 rounded py-0.5 text-xs font-mono text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offsetX: (prev.offsetX || 0) + 5 }))}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-mono"
                          title="Décaler de 5 mm vers la droite"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                        <span>Axe Y (vertical)</span>
                        <span className="font-mono text-zinc-300">{config.offsetY || 0} mm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offsetY: (prev.offsetY || 0) - 5 }))}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-mono"
                          title="Décaler de 5 mm vers le haut"
                        >
                          -5
                        </button>
                        <input
                          type="number"
                          value={config.offsetY || 0}
                          onChange={(e) => setConfig((prev) => ({ ...prev, offsetY: Number(e.target.value) || 0 }))}
                          className="w-full text-center bg-zinc-950 border border-zinc-700 rounded py-0.5 text-xs font-mono text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offsetY: (prev.offsetY || 0) + 5 }))}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-mono"
                          title="Décaler de 5 mm vers le bas"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Système d'Unités Bi-Système */}
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Système d'unités (ISO 80000 / IEEE SI 10)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, unitSystem: "metric" }))}
                      className={`px-2.5 py-2 rounded-lg font-bold text-left border transition-all ${
                        config.unitSystem !== "imperial"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-bold text-xs">Métrique (SI)</div>
                      <div className="text-[10px] text-zinc-400">m, mm, bar, kg, °C</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, unitSystem: "imperial" }))}
                      className={`px-2.5 py-2 rounded-lg font-bold text-left border transition-all ${
                        config.unitSystem === "imperial"
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-bold text-xs">Impérial / US</div>
                      <div className="text-[10px] text-zinc-400">ft-in, in, psi, lbs, °F</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Contenu Onglet 2 : Calques & Éléments inclus */}
            {activeTab === "layers" && (
              <div className="p-4 space-y-3.5 text-xs">
                <div className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                  Composants & Disciplines (Palier 2C)
                </div>

                {/* Calque Mécanique / Supports MSS SP-58 */}
                <label className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showSupports}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showSupports: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Supportage Mécanique (MSS SP-58)</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Patins (Type 35/39), pendards, boîtes à ressort et ancrages rigides ({supports.length} supports)
                    </div>
                  </div>
                </label>

                {/* Calque Génie Civil */}
                <label className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showCivilEngineering}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showCivilEngineering: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                      <HardHat className="w-3.5 h-3.5 text-amber-400" />
                      <span>Génie Civil & Fondations</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Massifs béton, semelles, dalles, profilés acier et axes de trame ({cad2dEntities.length} entités)
                    </div>
                  </div>
                </label>

                {/* Tableau Supports & Génie Civil */}
                <label className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showSupportTable}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showSupportTable: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tableau Supportage & MTO Génie Civil</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Tableau récapitulatif des tags de supports, platines acier et volumes de béton
                    </div>
                  </div>
                </label>

                {/* Nomenclature Matériel BOM */}
                <label className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showBomTable}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showBomTable: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-zinc-100">Nomenclature Matériel Tuyauterie (BOM)</div>
                    <div className="text-[11px] text-zinc-400">
                      Tableau des tronçons, vannes, raccords avec DN, quantités et longueurs
                    </div>
                  </div>
                </label>

                {/* Cotations */}
                <label className="flex items-center gap-2.5 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={config.showDimensions}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showDimensions: e.target.checked }))
                    }
                    className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-zinc-200">Cotations dimensionnelles</span>
                </label>

                {/* Mode Plan de Soudage & Carnet de Spools */}
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/60 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config.weldMapMode)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig((prev) => ({
                          ...prev,
                          weldMapMode: checked,
                          showWelds: true,
                          showSpoolColors: checked ? true : prev.showSpoolColors,
                          showWeldTable: checked ? true : prev.showWeldTable,
                          showSpoolTable: checked ? true : prev.showSpoolTable,
                          documentTitle: checked
                            ? "PLAN DE SOUDAGE & CARNET DE SPOOLS (WELD MAP)"
                            : (projectName || "PLAN ISOMÉTRIQUE TUYAUTERIE INDUSTRIELLE"),
                        }));
                      }}
                      className="mt-0.5 rounded border-amber-700 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mode Plan de Soudage & Carnet de Spools</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Active la symbologie atelier/chantier/golden, les repères Wxxx, et les tableaux de fabrication ASME B31.3
                      </div>
                    </div>
                  </label>

                  {config.weldMapMode && (
                    <div className="pl-6 space-y-1.5 pt-1 border-t border-amber-900/40 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(config.showSpoolColors)}
                          onChange={(e) => setConfig((prev) => ({ ...prev, showSpoolColors: e.target.checked }))}
                          className="rounded border-zinc-700 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Coloration différenciée par Spool (SP-01, SP-02...)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(config.showWeldTable)}
                          onChange={(e) => setConfig((prev) => ({ ...prev, showWeldTable: e.target.checked }))}
                          className="rounded border-zinc-700 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Tableau des soudures & CND (Weld Log ASME B31.3)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(config.showSpoolTable)}
                          onChange={(e) => setConfig((prev) => ({ ...prev, showSpoolTable: e.target.checked }))}
                          className="rounded border-zinc-700 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Carnet de spools (Spool Schedule & Gabarit 12m)</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Soudures */}
                <label className="flex items-center gap-2.5 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={config.showWelds}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showWelds: e.target.checked }))
                    }
                    className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-zinc-200">
                    Numéros et symboles de soudure (Wxxx)
                  </span>
                </label>

                {/* Étiquettes tuyaux */}
                <label className="flex items-center gap-2.5 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={config.showPipeLabels}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showPipeLabels: e.target.checked }))
                    }
                    className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-zinc-200">
                    Étiquettes des tuyaux (Diamètre / Longueur)
                  </span>
                </label>

                {/* Légende adaptative */}
                <label className="flex items-center gap-2.5 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={config.showAdaptiveLegend}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showAdaptiveLegend: e.target.checked }))
                    }
                    className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-zinc-200">Légende technique adaptative (ISO 7200)</span>
                </label>

                {/* Grille ISO 5457 */}
                <label className="flex items-center gap-2.5 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={config.showIso5457Grid}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showIso5457Grid: e.target.checked }))
                    }
                    className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-zinc-200">Cadre & Quadrillage ISO 5457</span>
                </label>
              </div>
            )}

            {/* Contenu Onglet 3 : Tableaux & Quantitatifs dynamiques */}
            {activeTab === "tables" && (
              <div className="p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                    Données générées pour l'impression
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 border border-cyan-800 text-cyan-300">
                    Mode : {config.printScope.toUpperCase()}
                  </span>
                </div>

                {/* Résumé Synthétique Génie Civil */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 space-y-2">
                  <div className="font-bold text-zinc-200 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-amber-400" />
                    <span>Métré Estimatif Génie Civil</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Béton coulé</div>
                      <div className="text-xs font-mono font-black text-cyan-400">
                        {civilMto.totalConcreteVolumeM3} m³
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Acier platines</div>
                      <div className="text-xs font-mono font-black text-emerald-400">
                        {civilMto.totalBasePlateWeightKg} kg
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Ancrages</div>
                      <div className="text-xs font-mono font-black text-amber-400">
                        {civilMto.totalAnchorsCount} u
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tableau Supports MSS SP-58 */}
                <div>
                  <div className="font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span>Supports Mécaniques inclus ({effectiveSupports.length})</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-lg">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-zinc-900 sticky top-0 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="p-1.5">Tag</th>
                          <th className="p-1.5 w-8 text-center">Sym</th>
                          <th className="p-1.5">Type MSS</th>
                          <th className="p-1.5">Platine</th>
                          <th className="p-1.5 text-right">Massif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {effectiveSupports.map((sup) => {
                          const def = MSS_SUPPORT_CATALOG[sup.type] || MSS_SUPPORT_CATALOG.mss_type_35;
                          return (
                            <tr key={sup.id} className="hover:bg-zinc-900/50">
                              <td className="p-1.5 font-bold text-cyan-400">{sup.tag}</td>
                              <td className="p-1.5 text-center">
                                <svg viewBox="-10 -10 20 20" className="w-5 h-5 inline-block overflow-visible">
                                  <g dangerouslySetInnerHTML={{ __html: getMssSupportVignetteSvg(sup.type, false) }} />
                                </svg>
                              </td>
                              <td className="p-1.5 text-zinc-300">MSS-{def.mssStandardNumber}</td>
                              <td className="p-1.5 text-zinc-400">
                                {sup.civilSpec.basePlateLengthMm}×{sup.civilSpec.basePlateWidthMm}
                              </td>
                              <td className="p-1.5 text-right text-emerald-400">
                                {sup.civilSpec.calculatedConcreteVolumeM3}m³
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tableau BOM Tuyauterie */}
                <div>
                  <div className="font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span>Nomenclature BOM ({effectiveBomRows.length} lignes)</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-lg">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-zinc-900 sticky top-0 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="p-1.5">RP</th>
                          <th className="p-1.5 w-8 text-center">Sym</th>
                          <th className="p-1.5">Désignation</th>
                          <th className="p-1.5">DN</th>
                          <th className="p-1.5 text-right">Qté/Long</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {effectiveBomRows.map((r) => (
                          <tr key={r.index} className="hover:bg-zinc-900/50">
                            <td className="p-1.5 font-bold text-cyan-400">{r.index}</td>
                            <td className="p-1.5 text-center">
                              <svg viewBox="-10 -10 20 20" className="w-5 h-5 inline-block overflow-visible">
                                <g dangerouslySetInnerHTML={{ __html: getComponentVignetteSvg(r.fittingType || r.designation, { isPrint: false }) }} />
                              </svg>
                            </td>
                            <td className="p-1.5 text-zinc-300 font-sans">{r.designation}</td>
                            <td className="p-1.5 text-zinc-400">DN{r.dn}</td>
                            <td className="p-1.5 text-right font-bold text-zinc-200">
                              {r.length > 0 ? `${r.length} m` : `${r.qty} u`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Synthèse et Tableau Spools & Soudures */}
                {effectiveWeldSpoolData && (
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-amber-300 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Plan de Soudage & Spools ({effectiveWeldSpoolData.spools.length} spools, {effectiveWeldSpoolData.welds.length} soudures)</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">
                        ASME B31.3
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                      <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                        <div className="text-zinc-500">Atelier</div>
                        <div className="font-mono font-bold text-cyan-400">{effectiveWeldSpoolData.summary.shopWelds}</div>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                        <div className="text-zinc-500">Chantier</div>
                        <div className="font-mono font-bold text-red-400">{effectiveWeldSpoolData.summary.fieldWelds}</div>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                        <div className="text-zinc-500">CND RT</div>
                        <div className="font-mono font-bold text-amber-400">{effectiveWeldSpoolData.summary.rtWelds}</div>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                        <div className="text-zinc-500">Linéaire</div>
                        <div className="font-mono font-bold text-purple-400">{effectiveWeldSpoolData.summary.totalCutLengthM.toFixed(1)}m</div>
                      </div>
                    </div>

                    {/* Tableau récapitulatif Spools */}
                    <div>
                      <div className="text-[11px] font-bold text-zinc-300 mb-1">Carnet des Spools</div>
                      <div className="max-h-32 overflow-y-auto border border-zinc-800 rounded bg-zinc-950/40">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="bg-zinc-900 text-zinc-400">
                            <tr>
                              <th className="p-1">Spool</th>
                              <th className="p-1">Long.</th>
                              <th className="p-1">Poids</th>
                              <th className="p-1 text-right">Gabarit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60">
                            {effectiveWeldSpoolData.spools.map((sp) => (
                              <tr key={sp.id}>
                                <td className="p-1 font-bold" style={{ color: sp.color }}>{sp.id}</td>
                                <td className="p-1 text-zinc-300">{sp.totalLengthM.toFixed(2)}m</td>
                                <td className="p-1 text-zinc-400">{Math.round(sp.estimatedWeightKg)}kg</td>
                                <td className={`p-1 text-right font-bold ${sp.isTransportable ? "text-emerald-400" : "text-red-400"}`}>
                                  {sp.isTransportable ? "≤12m" : ">12m"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contenu Onglet 4 : Métadonnées du Cartouche */}
            {activeTab === "metadata" && (
              <div className="p-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Titre du document</label>
                  <input
                    type="text"
                    value={config.documentTitle}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, documentTitle: e.target.value }))
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Numéro de plan</label>
                    <input
                      type="text"
                      value={config.documentNumber}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, documentNumber: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Indice de révision</label>
                    <input
                      type="text"
                      value={config.revision}
                      onChange={(e) => setConfig((prev) => ({ ...prev, revision: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Dessiné par</label>
                  <input
                    type="text"
                    value={config.drawnBy}
                    onChange={(e) => setConfig((prev) => ({ ...prev, drawnBy: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Vérifié par</label>
                    <input
                      type="text"
                      value={config.checkedBy}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, checkedBy: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Approuvé par</label>
                    <input
                      type="text"
                      value={config.approvedBy}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, approvedBy: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Pression service (bar)
                    </label>
                    <input
                      type="number"
                      value={config.pressureDesign || ""}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          pressureDesign: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Épreuve hydro (bar)
                    </label>
                    <input
                      type="number"
                      value={config.hydrotestPressure || ""}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          hydrotestPressure: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Fluide / Service</label>
                  <input
                    type="text"
                    value={config.serviceFluid || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, serviceFluid: e.target.value }))
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Zone de prévisualisation en direct (Aperçu SVG interactif) */}
          <div className="flex-1 bg-zinc-950 p-6 flex flex-col items-center justify-center overflow-auto relative">
            <div className="absolute top-3 left-4 flex items-center gap-3 text-[11px] font-bold text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-lg shadow-lg">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Aperçu WYSIWYG à l'échelle {drawingResult.scaleApplied}</span>
              </div>
              <span className="w-1 h-3 bg-zinc-700 rounded-full" />
              <div className="text-zinc-300">
                {effectiveSegments.length} tubes · {effectiveSupports.length} supports · {effectiveCad2d.length} GC
              </div>
            </div>

            {/* Cadre de la feuille simulée */}
            <div
              className="bg-white rounded shadow-2xl p-0.5 border border-zinc-400 max-w-full max-h-[78vh] flex items-center justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:block"
              style={{
                aspectRatio: `${drawingResult.widthMm} / ${drawingResult.heightMm}`,
              }}
              dangerouslySetInnerHTML={{ __html: drawingResult.svgMarkup }}
            />
          </div>
        </div>

        {/* Pied de dialogue */}
        <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-900/70 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Format conforme ISO 216 · Cartouche conforme ISO 7200 · Dessin conforme ISO 5457</span>
          </div>
          <div>Propulsé par ORTHOGONAL - ENG · Moteur PD&I v4.8d</div>
        </div>
      </div>
    </div>
  );
};
