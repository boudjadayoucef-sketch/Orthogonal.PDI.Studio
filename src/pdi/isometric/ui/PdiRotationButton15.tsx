/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COMPOSANT UI DÉDIÉ : BOUTON ET MENU DE ROTATION RAPIDE (±15°, ±45°, ±90°, FLIP)
 * ARCH-15 : Modularisation et décharge de IsometrieModuleV48d.tsx
 */

import React, { useState, useRef } from "react";
import { RotateCw, RotateCcw, ChevronDown } from "lucide-react";

export interface PdiRotationButton15Props {
  onRotate: (angle: number) => void;
  onFlip?: () => void;
}

export function PdiRotationButton15({
  onRotate,
  onFlip,
}: PdiRotationButton15Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [defaultAngle, setDefaultAngle] = useState(15);
  const longPressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);
  const isPointerDownRef = useRef(false);

  const handlePointerDown = () => {
    isPointerDownRef.current = true;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setMenuOpen(true);
    }, 350);
  };

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressRef.current && !menuOpen) {
      onRotate(defaultAngle);
    }
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="relative inline-block w-full">
      <div className="flex items-center gap-1 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-1 shadow-md">
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs transition-all cursor-pointer shadow active:scale-95"
          title="Clic court = Rotation 15° | Appui prolongé = Choix +15° ou -15°"
        >
          <RotateCw className={`w-3.5 h-3.5 ${defaultAngle < 0 ? "scale-x-[-1]" : ""}`} />
          <span>Rotation {defaultAngle > 0 ? `+${defaultAngle}°` : `${defaultAngle}°`}</span>
          <span className="text-[8px] bg-white/20 px-1 py-0.5 rounded font-mono font-normal">Appui prolongé</span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          title="Menu de choix de rotation"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-full bg-slate-900 border-2 border-cyan-500/80 rounded-xl p-2 shadow-2xl space-y-1 backdrop-blur-md">
          <div className="text-[10px] font-black text-cyan-300 uppercase tracking-wider px-2 py-1 border-b border-slate-800 flex justify-between items-center">
            <span>Choix de la rotation</span>
            <button type="button" onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setDefaultAngle(15);
                onRotate(15);
                setMenuOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-black transition-all cursor-pointer ${
                defaultAngle === 15
                  ? "bg-emerald-600/90 text-white border-emerald-400"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-300" />
              <span>+15° Horaire</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDefaultAngle(-15);
                onRotate(-15);
                setMenuOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-black transition-all cursor-pointer ${
                defaultAngle === -15
                  ? "bg-amber-600/90 text-white border-amber-400"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              <span>−15° Anti-horaire</span>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[10px] pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => { onRotate(45); setMenuOpen(false); }}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              +45°
            </button>
            <button
              type="button"
              onClick={() => { onRotate(-45); setMenuOpen(false); }}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              −45°
            </button>
            <button
              type="button"
              onClick={() => { onRotate(90); setMenuOpen(false); }}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              +90°
            </button>
            <button
              type="button"
              onClick={() => { onRotate(-90); setMenuOpen(false); }}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              −90°
            </button>
          </div>
          {onFlip && (
            <button
              type="button"
              onClick={() => { onFlip(); setMenuOpen(false); }}
              className="w-full py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 text-xs font-black text-center transition-all mt-1 cursor-pointer"
            >
              Inverser / Miroir (F)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PdiRotationButton15;
