/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COMPOSANT DE RECADRAGE MANUEL D'IMAGE AVANT DÉTECTION (SKETCH-CROP-TOOL)
 * 
 * Permet à l'utilisateur d'isoler la zone de dessin isométrique d'un croquis
 * et d'exclure les cartouches, tableaux de nomenclature (BOM) ou hachures parasites.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Crop, Check, RefreshCw, Layers, ShieldCheck, ZoomIn, ZoomOut } from "lucide-react";

interface SketchCropToolProps {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  onCropConfirmed: (croppedDataUrl: string, croppedWidth: number, croppedHeight: number) => void;
  onSkipCrop: () => void;
  onCancel?: () => void;
}

export const SketchCropTool: React.FC<SketchCropToolProps> = ({
  imageDataUrl,
  imageWidth,
  imageHeight,
  onCropConfirmed,
  onSkipCrop,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Cadrage en pourcentage relatif [0..1]
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.05,
    y: 0.05,
    w: 0.60, // Par défaut, isole les ~60% gauche (zone de dessin)
    h: 0.88,
  });

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; crop: typeof cropBox } | null>(null);

  // Charger l'image HTML
  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageObj(img);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Conversion coordonnées client -> [0..1] relatif
  const getRelativeCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    const coords = getRelativeCoords(e);
    setDragStart({ x: coords.x, y: coords.y, crop: { ...cropBox } });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeHandle || !dragStart) return;
      const coords = getRelativeCoords(e);
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;

      let { x, y, w, h } = dragStart.crop;

      const minSize = 0.1; // Taille minimale 10%

      switch (activeHandle) {
        case "nw":
          x = Math.max(0, Math.min(dragStart.crop.x + dragStart.crop.w - minSize, dragStart.crop.x + dx));
          y = Math.max(0, Math.min(dragStart.crop.y + dragStart.crop.h - minSize, dragStart.crop.y + dy));
          w = dragStart.crop.x + dragStart.crop.w - x;
          h = dragStart.crop.y + dragStart.crop.h - y;
          break;
        case "ne":
          y = Math.max(0, Math.min(dragStart.crop.y + dragStart.crop.h - minSize, dragStart.crop.y + dy));
          w = Math.max(minSize, Math.min(1 - dragStart.crop.x, dragStart.crop.w + dx));
          h = dragStart.crop.y + dragStart.crop.h - y;
          break;
        case "sw":
          x = Math.max(0, Math.min(dragStart.crop.x + dragStart.crop.w - minSize, dragStart.crop.x + dx));
          w = dragStart.crop.x + dragStart.crop.w - x;
          h = Math.max(minSize, Math.min(1 - dragStart.crop.y, dragStart.crop.h + dy));
          break;
        case "se":
          w = Math.max(minSize, Math.min(1 - dragStart.crop.x, dragStart.crop.w + dx));
          h = Math.max(minSize, Math.min(1 - dragStart.crop.y, dragStart.crop.h + dy));
          break;
        case "move":
          x = Math.max(0, Math.min(1 - w, dragStart.crop.x + dx));
          y = Math.max(0, Math.min(1 - h, dragStart.crop.y + dy));
          break;
      }

      setCropBox({ x, y, w, h });
    };

    const handleMouseUp = () => {
      setActiveHandle(null);
      setDragStart(null);
    };

    if (activeHandle) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeHandle, dragStart, getRelativeCoords]);

  // Validation du cadrage et extraction canvas
  const handleConfirmCrop = () => {
    if (!imageObj) {
      onSkipCrop();
      return;
    }

    const naturalWidth = imageObj.naturalWidth || imageWidth || 1188;
    const naturalHeight = imageObj.naturalHeight || imageHeight || 840;

    const sx = Math.round(cropBox.x * naturalWidth);
    const sy = Math.round(cropBox.y * naturalHeight);
    const sw = Math.round(cropBox.w * naturalWidth);
    const sh = Math.round(cropBox.h * naturalHeight);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      onSkipCrop();
      return;
    }

    ctx.drawImage(imageObj, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedDataUrl = canvas.toDataURL("image/png");

    onCropConfirmed(croppedDataUrl, sw, sh);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-6 max-w-4xl mx-auto my-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20">
            <Crop className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Recadrage Manuel du Croquis
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                Étape 1/2
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Ajustez le cadre pour isoler le dessin isométrique et exclure la nomenclature BOM ou le cartouche.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCropBox({ x: 0, y: 0, w: 0.58, h: 0.9 })}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            title="Préréglage Zone Dessin (Gauche)"
          >
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <span>Zone Dessin (Gauche)</span>
          </button>
        </div>
      </div>

      {/* Visual Crop Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[480px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 select-none flex items-center justify-center"
      >
        {imageObj ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={imageDataUrl}
              alt="Aperçu croquis"
              className="max-w-full max-h-full object-contain pointer-events-none"
            />

            {/* Overlay sombre extérieur */}
            <div
              className="absolute inset-0 bg-slate-950/70 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%,
                  0% 0%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%,
                  ${cropBox.x * 100}% ${(cropBox.y + cropBox.h) * 100}%,
                  ${(cropBox.x + cropBox.w) * 100}% ${(cropBox.y + cropBox.h) * 100}%,
                  ${(cropBox.x + cropBox.w) * 100}% ${cropBox.y * 100}%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%
                )`,
              }}
            />

            {/* Boîte de cadrage active */}
            <div
              onMouseDown={(e) => handleMouseDown(e, "move")}
              className="absolute border-2 border-orange-500 bg-orange-500/10 cursor-move shadow-lg flex flex-col justify-between"
              style={{
                left: `${cropBox.x * 100}%`,
                top: `${cropBox.y * 100}%`,
                width: `${cropBox.w * 100}%`,
                height: `${cropBox.h * 100}%`,
              }}
            >
              {/* Grille Isométrique légère */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-orange-500/20">
                <div className="border-r border-b border-orange-500/20" />
                <div className="border-r border-b border-orange-500/20" />
                <div className="border-b border-orange-500/20" />
                <div className="border-r border-b border-orange-500/20" />
                <div className="border-r border-b border-orange-500/20" />
                <div className="border-b border-orange-500/20" />
              </div>

              {/* Tag indicateur */}
              <div className="absolute top-2 left-2 bg-slate-900/90 text-orange-400 text-[10px] font-mono px-2 py-0.5 rounded border border-orange-500/30 pointer-events-none font-bold">
                ZONE ACTIVE D'ANALYSE
              </div>

              {/* Handles d'angle */}
              <div
                onMouseDown={(e) => handleMouseDown(e, "nw")}
                className="absolute -top-2 -left-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, "ne")}
                className="absolute -top-2 -right-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, "sw")}
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, "se")}
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Chargement de l'image...</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-4">
        <button
          onClick={onSkipCrop}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
        >
          Utiliser l'image entière (Sans cadrage)
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-bold transition-all border border-slate-800 cursor-pointer"
            >
              Annuler
            </button>
          )}
          <button
            onClick={handleConfirmCrop}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-extrabold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Valider le cadrage et détecter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
