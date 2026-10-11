import React, { useState, useRef, useEffect } from "react";
import {
  Triangle,
  Square,
  Hexagon,
  Disc3,
  Slash,
  Spline,
  Circle,
  Type,
  Ruler,
  ChevronDown,
  Copy,
  Clipboard,
  Trash2,
  Layers,
  Sparkles,
} from "lucide-react";
import { TriangleType, ArcCreationMode } from "../engine/CadAutocadEngine";

export interface CadShapeToolbarProps {
  activeDraftTool: string | null;
  activeDraftSubType?: string;
  onStartRectangle: () => void;
  onStartTriangle: (subType: TriangleType) => void;
  onStartPolygon: (sides: number) => void;
  onStartArc: (mode: ArcCreationMode) => void;
  onStartSimpleTool: (tool: "line" | "polyline" | "circle" | "text" | "dimension") => void;
  onCopySelection: () => void;
  onStartPasteAtPoint: () => void;
  onDeleteSelection: () => void;
  hasSelection: boolean;
  className?: string;
}

export const CadShapeToolbar: React.FC<CadShapeToolbarProps> = ({
  activeDraftTool,
  activeDraftSubType,
  onStartRectangle,
  onStartTriangle,
  onStartPolygon,
  onStartArc,
  onStartSimpleTool,
  onCopySelection,
  onStartPasteAtPoint,
  onDeleteSelection,
  hasSelection,
  className = "",
}) => {
  const [triangleMenuOpen, setTriangleMenuOpen] = useState(false);
  const [polygonMenuOpen, setPolygonMenuOpen] = useState(false);
  const [arcMenuOpen, setArcMenuOpen] = useState(false);
  const [customSides, setCustomSides] = useState<number>(6);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setTriangleMenuOpen(false);
      setPolygonMenuOpen(false);
      setArcMenuOpen(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handlePointerDown = (openMenu: () => void) => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      openMenu();
    }, 400); // 400ms long-press trigger
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div
      className={`pdi-cad-shape-toolbar bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-1.5 shadow-2xl flex flex-wrap items-center gap-1 text-xs select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-2 py-1 bg-slate-900/80 rounded-xl border border-slate-800 text-cyan-400 font-mono text-[10px] font-black uppercase tracking-wider shrink-0">
        <Layers className="w-3.5 h-3.5 text-cyan-400" />
        <span>FORMES 2D CAD</span>
      </div>

      <div className="h-5 w-px bg-slate-800 mx-0.5" />

      {/* RECTANGLE AUTOCAD (2 steps length + width) */}
      <button
        type="button"
        onClick={() => onStartRectangle()}
        className={`px-2.5 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
          activeDraftTool === "rectangle"
            ? "bg-amber-600 text-white shadow-lg shadow-amber-900/40 ring-2 ring-amber-400"
            : "bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700/80"
        }`}
        title="Rectangle interactif style AutoCAD : 1er point -> Direction/Longueur L -> Direction/Largeur W"
      >
        <Square className="w-3.5 h-3.5 text-amber-400" />
        <span>RECTANGLE</span>
      </button>

      {/* TRIANGLE (With Long-Press & Dropdown for Equilateral, Right, Isosceles, 3 points) */}
      <div className="relative">
        <div className="flex items-center">
          <button
            type="button"
            onPointerDown={() => handlePointerDown(() => setTriangleMenuOpen(true))}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => {
              if (!isLongPressRef.current) {
                onStartTriangle("equilateral");
              }
            }}
            className={`px-2.5 py-1.5 rounded-l-xl font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDraftTool === "triangle"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-900/40 ring-2 ring-orange-400"
                : "bg-slate-900 hover:bg-slate-800 text-orange-300 border-y border-l border-slate-700/80"
            }`}
            title="Triangle : Clic simple pour Équilatéral, ou appui long pour choisir le type (Rectangle, Isocèle, 3 points)"
          >
            <Triangle className="w-3.5 h-3.5 text-orange-400" />
            <span>TRIANGLE</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTriangleMenuOpen((v) => !v);
              setPolygonMenuOpen(false);
              setArcMenuOpen(false);
            }}
            className={`px-1 py-1.5 rounded-r-xl border-y border-r border-slate-700/80 transition-colors cursor-pointer ${
              activeDraftTool === "triangle" ? "bg-orange-700 text-white" : "bg-slate-900 hover:bg-slate-800 text-orange-400"
            }`}
            title="Choisir le type de triangle (Appui long ou clic)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Triangle Sub-Menu */}
        {triangleMenuOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-60 bg-slate-900/98 backdrop-blur border border-orange-500/50 rounded-xl shadow-2xl overflow-hidden z-[10020] animate-in fade-in zoom-in-95 duration-150 p-1">
            <div className="px-2.5 py-1 text-[10px] font-mono font-bold text-orange-400 border-b border-slate-800 uppercase flex items-center justify-between">
              <span>Types de Triangle</span>
              <span className="text-[9px] text-slate-500">Appui long</span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  onStartTriangle("equilateral");
                  setTriangleMenuOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                  activeDraftSubType === "equilateral" ? "bg-orange-950 text-orange-200 border border-orange-700" : "hover:bg-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Triangle className="w-3.5 h-3.5 text-orange-400" />
                  <span>Triangle Équilatéral</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">3 côtés égaux</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onStartTriangle("rectangle");
                  setTriangleMenuOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                  activeDraftSubType === "rectangle" ? "bg-orange-950 text-orange-200 border border-orange-700" : "hover:bg-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-orange-400 text-sm">📐</span>
                  <span>Triangle Rectangle</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Angle droit 90°</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onStartTriangle("isocele");
                  setTriangleMenuOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                  activeDraftSubType === "isocele" ? "bg-orange-950 text-orange-200 border border-orange-700" : "hover:bg-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Triangle className="w-3.5 h-3.5 text-orange-400" />
                  <span>Triangle Isocèle</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">2 côtés égaux</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onStartTriangle("3pts");
                  setTriangleMenuOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                  activeDraftSubType === "3pts" ? "bg-orange-950 text-orange-200 border border-orange-700" : "hover:bg-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-orange-400">●●●</span>
                  <span>Triangle par 3 Points</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Libre</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POLYGON (With Long-Press & Sides count selection: 3 to 32) */}
      <div className="relative">
        <div className="flex items-center">
          <button
            type="button"
            onPointerDown={() => handlePointerDown(() => setPolygonMenuOpen(true))}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => {
              if (!isLongPressRef.current) {
                onStartPolygon(customSides || 6);
              }
            }}
            className={`px-2.5 py-1.5 rounded-l-xl font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDraftTool === "polygon"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40 ring-2 ring-purple-400"
                : "bg-slate-900 hover:bg-slate-800 text-purple-300 border-y border-l border-slate-700/80"
            }`}
            title="Polygone régulier : Clic pour 6 côtés (Hexagone) ou appui long pour choisir le nombre de côtés"
          >
            <Hexagon className="w-3.5 h-3.5 text-purple-400" />
            <span>POLYGONE ({customSides})</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPolygonMenuOpen((v) => !v);
              setTriangleMenuOpen(false);
              setArcMenuOpen(false);
            }}
            className={`px-1 py-1.5 rounded-r-xl border-y border-r border-slate-700/80 transition-colors cursor-pointer ${
              activeDraftTool === "polygon" ? "bg-purple-700 text-white" : "bg-slate-900 hover:bg-slate-800 text-purple-400"
            }`}
            title="Choisir le nombre de côtés du polygone"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Polygon Sides Sub-Menu */}
        {polygonMenuOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 bg-slate-900/98 backdrop-blur border border-purple-500/50 rounded-xl shadow-2xl overflow-hidden z-[10020] animate-in fade-in zoom-in-95 duration-150 p-2">
            <div className="px-1 py-1 text-[10px] font-mono font-bold text-purple-400 border-b border-slate-800 uppercase flex items-center justify-between mb-2">
              <span>Nombre de côtés</span>
              <span className="text-[9px] text-slate-500">3 à 32 côtés</span>
            </div>

            <div className="grid grid-cols-3 gap-1 mb-2">
              {[
                { sides: 3, label: "Triangle" },
                { sides: 4, label: "Carré" },
                { sides: 5, label: "Pentagone" },
                { sides: 6, label: "Hexagone" },
                { sides: 8, label: "Octogone" },
                { sides: 12, label: "Dodécagone" },
              ].map((item) => (
                <button
                  key={item.sides}
                  type="button"
                  onClick={() => {
                    setCustomSides(item.sides);
                    onStartPolygon(item.sides);
                    setPolygonMenuOpen(false);
                  }}
                  className={`p-1.5 rounded-lg text-center font-mono text-[11px] font-bold transition-colors ${
                    customSides === item.sides
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-purple-200 border border-slate-700"
                  }`}
                >
                  <div className="text-xs font-black">{item.sides}</div>
                  <div className="text-[8px] text-slate-400 truncate">{item.label}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <span className="text-[10px] font-mono text-slate-300 font-bold">Personnalisé :</span>
              <input
                type="number"
                min="3"
                max="32"
                value={customSides}
                onChange={(e) => setCustomSides(Math.max(3, Math.min(32, parseInt(e.target.value) || 3)))}
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-purple-300 font-mono text-center outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onStartPolygon(customSides);
                  setPolygonMenuOpen(false);
                }}
                className="flex-1 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold font-mono"
              >
                DESSINER
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ARC (With Long-Press & Dropdown for 3-Points or Center-Radius-Angle) */}
      <div className="relative">
        <div className="flex items-center">
          <button
            type="button"
            onPointerDown={() => handlePointerDown(() => setArcMenuOpen(true))}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => {
              if (!isLongPressRef.current) {
                onStartArc("3points");
              }
            }}
            className={`px-2.5 py-1.5 rounded-l-xl font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDraftTool === "arc"
                ? "bg-sky-600 text-white shadow-lg shadow-sky-900/40 ring-2 ring-sky-400"
                : "bg-slate-900 hover:bg-slate-800 text-sky-300 border-y border-l border-slate-700/80"
            }`}
            title="Arc de cercle : Clic pour Arc par 3 points, ou appui long pour mode Centre/Rayon/Angle"
          >
            <Disc3 className="w-3.5 h-3.5 text-sky-400" />
            <span>ARC</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setArcMenuOpen((v) => !v);
              setTriangleMenuOpen(false);
              setPolygonMenuOpen(false);
            }}
            className={`px-1 py-1.5 rounded-r-xl border-y border-r border-slate-700/80 transition-colors cursor-pointer ${
              activeDraftTool === "arc" ? "bg-sky-700 text-white" : "bg-slate-900 hover:bg-slate-800 text-sky-400"
            }`}
            title="Choisir la méthode de tracé de l'arc"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Arc Sub-Menu */}
        {arcMenuOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-60 bg-slate-900/98 backdrop-blur border border-sky-500/50 rounded-xl shadow-2xl overflow-hidden z-[10020] animate-in fade-in zoom-in-95 duration-150 p-1">
            <div className="px-2.5 py-1 text-[10px] font-mono font-bold text-sky-400 border-b border-slate-800 uppercase flex items-center justify-between">
              <span>Méthodes de Tracé d'Arc</span>
              <span className="text-[9px] text-slate-500">AutoCAD</span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  onStartArc("3points");
                  setArcMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between hover:bg-slate-800 text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Disc3 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Arc par 3 Points</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Départ, Passage, Fin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onStartArc("center_radius_angle");
                  setArcMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between hover:bg-slate-800 text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Circle className="w-3.5 h-3.5 text-sky-400" />
                  <span>Centre, Rayon &amp; Angle</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Rayon &amp; Ouverture</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LINE, POLYLINE, CIRCLE, TEXT */}
      <button
        type="button"
        onClick={() => onStartSimpleTool("line")}
        className={`px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 transition-colors ${
          activeDraftTool === "line" ? "bg-cyan-600 text-white" : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80"
        }`}
        title="Ligne 2D (L)"
      >
        <Slash className="w-3.5 h-3.5 text-slate-400" />
        <span>LIGNE</span>
      </button>

      <button
        type="button"
        onClick={() => onStartSimpleTool("polyline")}
        className={`px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 transition-colors ${
          activeDraftTool === "polyline" ? "bg-teal-600 text-white" : "bg-slate-900 hover:bg-slate-800 text-teal-300 border border-slate-700/80"
        }`}
        title="Polyligne continue (PL)"
      >
        <Spline className="w-3.5 h-3.5 text-teal-400" />
        <span>POLYLIGNE</span>
      </button>

      <button
        type="button"
        onClick={() => onStartSimpleTool("circle")}
        className={`px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 transition-colors ${
          activeDraftTool === "circle" ? "bg-yellow-600 text-white" : "bg-slate-900 hover:bg-slate-800 text-yellow-300 border border-slate-700/80"
        }`}
        title="Cercle (C)"
      >
        <Circle className="w-3.5 h-3.5 text-yellow-400" />
        <span>CERCLE</span>
      </button>

      <button
        type="button"
        onClick={() => onStartSimpleTool("text")}
        className={`px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 transition-colors ${
          activeDraftTool === "text" ? "bg-pink-600 text-white" : "bg-slate-900 hover:bg-slate-800 text-pink-300 border border-slate-700/80"
        }`}
        title="Texte et annotations (T)"
      >
        <Type className="w-3.5 h-3.5 text-pink-400" />
        <span>TEXTE</span>
      </button>

      <div className="h-5 w-px bg-slate-800 mx-0.5" />

      {/* QUICK CLIPBOARD & INTERACTION BUTTONS */}
      <button
        type="button"
        onClick={onCopySelection}
        disabled={!hasSelection}
        className="px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 bg-slate-900 hover:bg-cyan-950 disabled:opacity-40 disabled:hover:bg-slate-900 text-cyan-300 border border-slate-700/80 transition-colors"
        title="Copier la sélection dans le presse-papiers (Ctrl+C / Commande: copier)"
      >
        <Copy className="w-3.5 h-3.5 text-cyan-400" />
        <span>COPIER</span>
      </button>

      <button
        type="button"
        onClick={onStartPasteAtPoint}
        className="px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 bg-slate-900 hover:bg-emerald-950 text-emerald-300 border border-slate-700/80 transition-colors"
        title="Coller au point cliqué sur le plan (Ctrl+V / Commande: collez)"
      >
        <Clipboard className="w-3.5 h-3.5 text-emerald-400" />
        <span>COLLEZ (Clic)</span>
      </button>

      <button
        type="button"
        onClick={onDeleteSelection}
        disabled={!hasSelection}
        className="px-2 py-1.5 rounded-xl font-bold font-mono text-[11px] flex items-center gap-1 bg-slate-900 hover:bg-red-950 disabled:opacity-40 disabled:hover:bg-slate-900 text-red-400 border border-slate-700/80 transition-colors"
        title="Supprimer la sélection (Suppr / Commande: effacer)"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
        <span>EFFACER</span>
      </button>
    </div>
  );
};
