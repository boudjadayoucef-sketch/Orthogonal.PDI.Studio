/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COMPOSANT UI DÉDIÉ : CONTRÔLES DU CANEVAS (ZOOM ARRIÈRE, ZOOM AVANT, DÉSÉLECTION, RECENTRAGE)
 * ARCH-16 : Safe Canvas Toolbar Controls Extraction
 */

import React from "react";
import { ZoomOut, ZoomIn, RefreshCw } from "lucide-react";

export interface PdiCanvasToolbarControls16Props {
  onZoomOut: () => void;
  onZoomIn: () => void;
  onClearSelection: () => void;
  onResetView: () => void;
  className?: string;
}

export function PdiCanvasToolbarControls16({
  onZoomOut,
  onZoomIn,
  onClearSelection,
  onResetView,
  className,
}: PdiCanvasToolbarControls16Props) {
  return (
    <div
      className={
        className ??
        "flex shrink-0 items-center gap-0.5 border border-slate-800 rounded-lg p-0.5 bg-slate-950"
      }
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
        title="Zoom arrière (-)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
        title="Zoom avant (+)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 hover:text-white"
        title="Désélectionner tout"
      >
        ×
      </button>
      <button
        type="button"
        onClick={onResetView}
        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-cyan-300 hover:text-white"
        title="Recentrer et ajuster la vue (Touche 0 / Fit)"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default PdiCanvasToolbarControls16;
