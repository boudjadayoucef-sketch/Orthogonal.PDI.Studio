/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COMPOSANT UI DÉDIÉ : CONTRÔLES DE VISIBILITÉ DU CANEVAS
 * ARCH-18 : Extraction des contrôles de visibilité du canevas
 */

import React from "react";

export type CanvasVisibilityLayerKey =
  | "grid"
  | "civilBackground"
  | "dimensions"
  | "pipeLabels"
  | "welds"
  | "spoolColoring"
  | "annotations";

export interface CanvasVisibilityState {
  grid: boolean;
  civilBackground: boolean;
  dimensions: boolean;
  pipeLabels: boolean;
  welds: boolean;
  spoolColoring: boolean;
  annotations: boolean;
}

export interface CanvasVisibilityActions {
  onToggleLayer: (layer: CanvasVisibilityLayerKey) => void;
}

export interface CanvasVisibilityControlsProps {
  visibility: CanvasVisibilityState;
  actions: CanvasVisibilityActions;
}

export function CanvasVisibilityControls18({
  visibility,
  actions,
}: CanvasVisibilityControlsProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("grid")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.grid ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
        }`}
        title="Afficher la grille (#)"
      >
        #
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("civilBackground")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.civilBackground
            ? "bg-cyan-600 text-white"
            : "bg-slate-800 text-slate-400"
        }`}
        title="Afficher le génie civil (GC)"
      >
        GC
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("dimensions")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.dimensions
            ? "bg-blue-600 text-white"
            : "bg-slate-800 text-slate-400"
        }`}
        title="Afficher les cotes (⇔)"
      >
        ⇔
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("pipeLabels")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.pipeLabels
            ? "bg-cyan-600 text-white"
            : "bg-slate-800 text-slate-400"
        }`}
        title="Labels des tuyauteries (PL)"
      >
        PL
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("welds")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.welds
            ? "bg-amber-600 text-white"
            : "bg-slate-800 text-slate-400"
        }`}
        title="Afficher les soudures Wxxx (W)"
      >
        W
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("spoolColoring")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.spoolColoring
            ? "bg-purple-600 text-white"
            : "bg-slate-800 text-slate-400"
        }`}
        title="Coloration par Spool (SP)"
      >
        SP
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleLayer("annotations")}
        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
          visibility.annotations
            ? "bg-indigo-600 text-white"
            : "bg-slate-800 text-slate-400"
        }`}
        title="Afficher les annotations (Aa)"
      >
        Aa
      </button>
    </>
  );
}

export default CanvasVisibilityControls18;
