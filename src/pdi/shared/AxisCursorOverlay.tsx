/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SHARED COMPONENT — CURSEUR TRIÈDRE D'AXES ISOMÉTRIQUES (SKETCH-DETECT-08 / PARTIE 2)
 *
 * Petit trièdre mobile (3 segments convergeant vers un point) :
 * - Famille 30° / 210° (Axe X)  : #EF4444 (Rouge)
 * - Famille 150° / 330° (Axe Y) : #10B981 (Vert)
 * - Famille 90° / 270° (Axe Z)  : #3B82F6 (Bleu)
 * S'affiche à la position courante (x, y) lorsqu'un déplacement (drag) est en cours.
 */
import React from "react";

export interface AxisCursorOverlayProps {
  x: number;
  y: number;
  size?: number;
  inSvg?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AxisCursorOverlay: React.FC<AxisCursorOverlayProps> = ({
  x,
  y,
  size = 32,
  inSvg = false,
  className,
  style,
}) => {
  const C30 = Math.cos(Math.PI / 6); // ~0.866
  const S30 = Math.sin(Math.PI / 6); // 0.5

  // Coordonnées écran (Y vers le bas) — Aligné sur la projection isométrique de l'éditeur
  // X+ (aligné sur l'éditeur ISO : vers le bas-droite)
  const xX = size * C30;
  const yX = size * S30;

  // Y+ (aligné sur l'éditeur ISO : vers le bas-gauche)
  const xY = -size * C30;
  const yY = size * S30;

  // Z+ (Vertical haut)
  const xZ = 0;
  const yZ = -size;

  // Prolongements négatifs (dashed)
  const oppLen = size * 0.45;
  const oppXX = -oppLen * C30;
  const oppYX = -oppLen * S30;
  const oppXY = oppLen * C30;
  const oppYY = -oppLen * S30;
  const oppXZ = 0;
  const oppYZ = oppLen;

  const triadContent = (
    <>
      {/* Prolongements négatifs en pointillés */}
      <line
        x1={0}
        y1={0}
        x2={oppXX}
        y2={oppYX}
        stroke="#EF4444"
        strokeWidth={1.5}
        strokeDasharray="2,2"
        opacity={0.5}
      />
      <line
        x1={0}
        y1={0}
        x2={oppXY}
        y2={oppYY}
        stroke="#10B981"
        strokeWidth={1.5}
        strokeDasharray="2,2"
        opacity={0.5}
      />
      <line
        x1={0}
        y1={0}
        x2={oppXZ}
        y2={oppYZ}
        stroke="#3B82F6"
        strokeWidth={1.5}
        strokeDasharray="2,2"
        opacity={0.5}
      />

      {/* Segments principaux d'axes */}
      {/* Axe X (30°) - Rouge */}
      <line
        x1={0}
        y1={0}
        x2={xX}
        y2={yX}
        stroke="#EF4444"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={xX} cy={yX} r={3} fill="#EF4444" />
      <text
        x={xX + 6}
        y={yX + 3}
        fill="#EF4444"
        fontSize={10}
        fontWeight={800}
        pointerEvents="none"
      >
        X
      </text>

      {/* Axe Y (150°) - Vert */}
      <line
        x1={0}
        y1={0}
        x2={xY}
        y2={yY}
        stroke="#10B981"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={xY} cy={yY} r={3} fill="#10B981" />
      <text
        x={xY - 11}
        y={yY + 3}
        fill="#10B981"
        fontSize={10}
        fontWeight={800}
        pointerEvents="none"
      >
        Y
      </text>

      {/* Axe Z (90°) - Bleu */}
      <line
        x1={0}
        y1={0}
        x2={xZ}
        y2={yZ}
        stroke="#3B82F6"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={xZ} cy={yZ} r={3} fill="#3B82F6" />
      <text
        x={xZ + 4}
        y={yZ - 4}
        fill="#3B82F6"
        fontSize={10}
        fontWeight={800}
        pointerEvents="none"
      >
        Z
      </text>

      {/* Point central / pivot */}
      <circle
        cx={0}
        cy={0}
        r={3.5}
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth={1.5}
      />
    </>
  );

  if (inSvg) {
    return (
      <g
        transform={`translate(${x}, ${y})`}
        pointerEvents="none"
        className={className}
        style={style}
      >
        {triadContent}
      </g>
    );
  }

  return (
    <svg
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 1,
        height: 1,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 9999,
        ...style,
      }}
      className={className}
    >
      <g pointerEvents="none">{triadContent}</g>
    </svg>
  );
};
