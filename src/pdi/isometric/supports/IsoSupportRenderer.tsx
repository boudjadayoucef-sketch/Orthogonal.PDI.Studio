/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * PALIER 2C : COMPOSANT VECTORIEL DE RENDU DES SUPPORTS INDUSTRIELS MSS SP-58 / SP-69
 */

import React from "react";
import { IsoPipingSupport, MSS_SUPPORT_CATALOG } from "./pdiMssSupportEngine";

interface IsoSupportRendererProps {
  supports: IsoPipingSupport[];
  selectedSupportId: string | null;
  onSelectSupport: (id: string, e: React.MouseEvent) => void;
  onPointerDownSupport?: (id: string, e: React.PointerEvent<any>) => void;
  projectFn: (x: number, y: number, z: number) => { x: number; y: number };
  zoom: number;
}

export const IsoSupportRenderer: React.FC<IsoSupportRendererProps> = ({
  supports,
  selectedSupportId,
  onSelectSupport,
  onPointerDownSupport,
  projectFn,
  zoom,
}) => {
  return (
    <g id="iso-mss-supports-layer" className="iso-supports-group">
      {supports.map((sup, idx) => {
        const pt = projectFn(sup.worldPos.x, sup.worldPos.y, sup.worldPos.z);
        const isSelected = selectedSupportId === sup.id;
        const def = MSS_SUPPORT_CATALOG[sup.type] || MSS_SUPPORT_CATALOG.mss_type_35;
        const scale = Math.max(0.8, Math.min(1.4, zoom));

        // Rendu spécifique selon la géométrie du symbole MSS - Aéré à distance du dessin
        const isHigh = sup.type === "mss_type_1" || sup.type === "mss_type_51";
        const isLow = sup.type === "mss_type_39" || sup.type === "mss_type_57";
        const offsetX = 30;
        const offsetY = isHigh ? -34 : isLow ? 30 : (idx % 2 === 0 ? -30 : 30);
        const chipWidth = sup.tag.length * 5.6 + 34;

        return (
          <g
            key={sup.id}
            id={`support-${sup.id}`}
            data-iso-object="true"
            data-iso-support="true"
            data-support-id={sup.id}
            transform={`translate(${pt.x}, ${pt.y}) scale(${scale})`}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSupport(sup.id, e);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (onPointerDownSupport) {
                onPointerDownSupport(sup.id, e);
              }
            }}
          >
            {/* Zone de clic compacte et ultra-précise */}
            <circle cx="0" cy="0" r="10" fill="transparent" />

            {/* HALO DE SÉLECTION COMPACT ET PRÉCIS */}
            {isSelected && (
              <circle
                cx="0"
                cy="0"
                r="11"
                fill="#f59e0b"
                fillOpacity="0.25"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            )}

            {/* SYMBOLE MSS SELON LE TYPE */}
            {sup.type === "mss_type_57" && (
              /* POINT FIXE / ANCHOR (Croix rigide + hachures d'ancrage) */
              <g>
                <rect x="-10" y="-10" width="20" height="20" fill="#0f172a" stroke={isSelected ? "#f59e0b" : "#ef4444"} strokeWidth="2" rx="2" />
                <line x1="-7" y1="-7" x2="7" y2="7" stroke={isSelected ? "#f59e0b" : "#ef4444"} strokeWidth="1.8" />
                <line x1="-7" y1="7" x2="7" y2="-7" stroke={isSelected ? "#f59e0b" : "#ef4444"} strokeWidth="1.8" />
                {/* Repère sol */}
                <line x1="-12" y1="12" x2="12" y2="12" stroke="#64748b" strokeWidth="2" />
                <line x1="-10" y1="12" x2="-14" y2="17" stroke="#64748b" strokeWidth="1.2" />
                <line x1="-2" y1="12" x2="-6" y2="17" stroke="#64748b" strokeWidth="1.2" />
                <line x1="6" y1="12" x2="2" y2="17" stroke="#64748b" strokeWidth="1.2" />
              </g>
            )}

            {sup.type === "mss_type_35" && (
              /* GUIDE COULISSANT (Glissière + Flèches axiales) */
              <g>
                <rect x="-11" y="-5" width="22" height="10" fill="#0f172a" stroke={isSelected ? "#f59e0b" : "#38bdf8"} strokeWidth="1.8" rx="2" />
                <line x1="-11" y1="0" x2="11" y2="0" stroke={isSelected ? "#f59e0b" : "#38bdf8"} strokeWidth="1.5" />
                <path d="M-8 -3 L-11 0 L-8 3" fill="none" stroke={isSelected ? "#f59e0b" : "#38bdf8"} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 -3 L11 0 L8 3" fill="none" stroke={isSelected ? "#f59e0b" : "#38bdf8"} strokeWidth="1.5" strokeLinecap="round" />
                {/* Patte de guidage vertical vers le bas */}
                <line x1="0" y1="5" x2="0" y2="14" stroke={isSelected ? "#f59e0b" : "#38bdf8"} strokeWidth="1.8" />
                <line x1="-7" y1="14" x2="7" y2="14" stroke="#64748b" strokeWidth="2" />
              </g>
            )}

            {sup.type === "mss_type_1" && (
              /* PENDARD SIMPLE (Tige verticale + triangle d'attache) */
              <g>
                <line x1="0" y1="0" x2="0" y2="-18" stroke={isSelected ? "#f59e0b" : "#10b981"} strokeWidth="1.8" />
                <circle cx="0" cy="0" r="4" fill="#0f172a" stroke={isSelected ? "#f59e0b" : "#10b981"} strokeWidth="1.8" />
                {/* Attache structure plafond */}
                <path d="M-6 -18 L6 -18 L0 -24 Z" fill={isSelected ? "#f59e0b" : "#10b981"} />
                <line x1="-10" y1="-24" x2="10" y2="-24" stroke="#64748b" strokeWidth="2" />
              </g>
            )}

            {sup.type === "mss_type_39" && (
              /* PATIN SOUDÉ / SHOE (Té inversé sous la génératrice) */
              <g>
                <circle cx="0" cy="0" r="3.5" fill={isSelected ? "#f59e0b" : "#a855f7"} />
                <line x1="0" y1="3.5" x2="0" y2="12" stroke={isSelected ? "#f59e0b" : "#a855f7"} strokeWidth="2.2" />
                <line x1="-9" y1="12" x2="9" y2="12" stroke={isSelected ? "#f59e0b" : "#a855f7"} strokeWidth="2.5" />
                {/* Support charpente / béton */}
                <line x1="-12" y1="15" x2="12" y2="15" stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 2" />
              </g>
            )}

            {sup.type === "mss_type_51" && (
              /* SUPPORT À RESSORT / VARIABLE SPRING (Boîte avec ressort hélicoïdal) */
              <g>
                <rect x="-7" y="-20" width="14" height="15" fill="#0f172a" stroke={isSelected ? "#f59e0b" : "#f97316"} strokeWidth="1.8" rx="2" />
                {/* Spirale de ressort */}
                <path d="M-4 -17 L4 -14 L-4 -11 L4 -8 L0 -5" fill="none" stroke={isSelected ? "#f59e0b" : "#f97316"} strokeWidth="1.4" />
                <line x1="0" y1="-5" x2="0" y2="0" stroke={isSelected ? "#f59e0b" : "#f97316"} strokeWidth="1.8" />
                <circle cx="0" cy="0" r="3.5" fill="#0f172a" stroke={isSelected ? "#f59e0b" : "#f97316"} strokeWidth="1.5" />
                <line x1="-8" y1="-20" x2="8" y2="-20" stroke="#64748b" strokeWidth="2" />
              </g>
            )}

            {(sup.type === "mss_type_8" || sup.type === "mss_type_26") && (
              /* COLLIER CLAMP */
              <g>
                <circle cx="0" cy="0" r="6.5" fill="none" stroke={isSelected ? "#f59e0b" : "#ec4899"} strokeWidth="2" />
                <line x1="-10" y1="0" x2="-6.5" y2="0" stroke={isSelected ? "#f59e0b" : "#ec4899"} strokeWidth="2" />
                <line x1="6.5" y1="0" x2="10" y2="0" stroke={isSelected ? "#f59e0b" : "#ec4899"} strokeWidth="2" />
                <circle cx="-9" cy="0" r="1.5" fill="#f59e0b" />
                <circle cx="9" cy="0" r="1.5" fill="#f59e0b" />
              </g>
            )}

            {/* ÉTIQUETTE DU SUPPORT (TAG ET TYPE MSS) - Puce compacte et aérée */}
            <g transform={`translate(${offsetX}, ${offsetY})`} pointerEvents="none">
              <line x1={-offsetX * 0.7} y1={-offsetY * 0.7} x2="0" y2="0" stroke="#475569" strokeWidth="0.8" strokeDasharray="2 2" />
              <rect
                x="0"
                y="-9"
                width={chipWidth}
                height="12"
                rx="2.5"
                fill="#020617"
                fillOpacity="0.94"
                stroke={isSelected ? "#f59e0b" : "#334155"}
                strokeWidth="0.9"
              />
              <text
                x="3.5"
                y="0"
                fill={isSelected ? "#fde68a" : "#e2e8f0"}
                fontSize="7.5"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {sup.tag} <tspan fill="#94a3b8">[{def.mssStandardNumber}]</tspan>
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
};
