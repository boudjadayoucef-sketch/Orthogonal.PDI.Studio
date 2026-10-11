/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO ENGINE — INTERACTIVE ISOMETRIC AXIS TRIAD (TRIÈDRE D'ORIENTATION)
 * Reference: PATCH SKETCH-DETECT-07 (Partie 2)
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { AxisMappingConfig, DEFAULT_AXIS_MAPPING } from "./openCvSketchDetector";

export interface SketchAxisTriadProps {
  axisMapping: AxisMappingConfig;
  onAxisMappingChange: (mapping: AxisMappingConfig) => void;
  containerWidth?: number;
  containerHeight?: number;
}

const ISO_ANGLES = [30, 90, 150, 210, 270, 330];

export const SketchAxisTriad: React.FC<SketchAxisTriadProps> = ({
  axisMapping,
  onAxisMappingChange,
  containerWidth = 800,
  containerHeight = 600
}) => {
  // Position of the triad origin on the screen (in pixels relative to overlay)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 90, y: 90 });
  const [isDraggingOrigin, setIsDraggingOrigin] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({
    x: 0,
    y: 0,
    posX: 90,
    posY: 90
  });

  const [activeAxisDrag, setActiveAxisDrag] = useState<"X" | "Y" | "Z" | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Primary angles for X, Y, Z (Alignés sur l'éditeur ISO : X=330°, Y=210°, Z=90°)
  const primaryX = axisMapping.X?.[0] ?? 330;
  const primaryY = axisMapping.Y?.[0] ?? 210;
  const primaryZ = axisMapping.Z?.[0] ?? 90;

  // Triad arrow length in px
  const triadRadius = 45;

  // Handle origin drag
  const handleOriginMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingOrigin(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y
    };
  };

  // Convert mathematical angle (deg) to screen vector (dx, dy)
  // In screen coords, Y goes DOWN, so math angle θ is:
  // dx = cos(θ), dy = -sin(θ)
  const angleToScreenCoords = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: r * Math.cos(rad),
      y: -r * Math.sin(rad)
    };
  };

  // Snap any screen vector angle back to the nearest isometric angle
  const snapToNearestIsoAngle = (dx: number, dy: number): number => {
    // Screen coords to math angle (dy is inverted)
    let mathDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    mathDeg = ((mathDeg % 360) + 360) % 360;

    let bestAngle = ISO_ANGLES[0];
    let minDiff = 999;
    for (const target of ISO_ANGLES) {
      let diff = Math.abs(mathDeg - target);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        bestAngle = target;
      }
    }
    return bestAngle;
  };

  // Handle Axis Arrow rotation drag
  const handleAxisMouseDown = (axis: "X" | "Y" | "Z", e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveAxisDrag(axis);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isDraggingOrigin) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPos({
          x: Math.max(50, Math.min(containerWidth - 50, dragStartRef.current.posX + dx)),
          y: Math.max(50, Math.min(containerHeight - 50, dragStartRef.current.posY + dy))
        });
      } else if (activeAxisDrag) {
        // Calculate angle from triad origin to mouse
        const triadContainer = document.getElementById("pdi-sketch-triad-root");
        if (!triadContainer) return;
        const rect = triadContainer.getBoundingClientRect();
        const originScreenX = rect.left + 55;
        const originScreenY = rect.top + 55;
        const dx = e.clientX - originScreenX;
        const dy = e.clientY - originScreenY;

        const snapped = snapToNearestIsoAngle(dx, dy);

        if (activeAxisDrag === "X") {
          onAxisMappingChange({
            ...axisMapping,
            X: [snapped, (snapped + 180) % 360]
          });
        } else if (activeAxisDrag === "Y") {
          onAxisMappingChange({
            ...axisMapping,
            Y: [snapped, (snapped + 180) % 360]
          });
        } else if (activeAxisDrag === "Z") {
          onAxisMappingChange({
            ...axisMapping,
            Z: [snapped, (snapped + 180) % 360]
          });
        }
      }
    };

    const handleWindowMouseUp = () => {
      setIsDraggingOrigin(false);
      setActiveAxisDrag(null);
    };

    if (isDraggingOrigin || activeAxisDrag) {
      window.addEventListener("mousemove", handleWindowMouseMove);
      window.addEventListener("mouseup", handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDraggingOrigin, activeAxisDrag, axisMapping, onAxisMappingChange, containerWidth, containerHeight]);

  const coordsX = angleToScreenCoords(primaryX, triadRadius);
  const coordsY = angleToScreenCoords(primaryY, triadRadius);
  const coordsZ = angleToScreenCoords(primaryZ, triadRadius);

  const isDefault =
    primaryX === 30 &&
    primaryY === 150 &&
    primaryZ === 90;

  return (
    <div
      id="pdi-sketch-triad-root"
      style={{
        position: "absolute",
        top: pos.y - 55,
        left: pos.x - 55,
        width: 110,
        height: 110,
        zIndex: 25,
        pointerEvents: "auto",
        userSelect: "none"
      }}
      title="Trièdre interactif d'orientation des axes 3D (Déplacez le centre ou tournez les flèches)"
    >
      {/* Background card disc */}
      <div
        style={{
          position: "relative",
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(15, 23, 42, 0.92) 0%, rgba(10, 15, 28, 0.96) 100%)",
          border: isDefault ? "1.5px solid rgba(56, 189, 248, 0.4)" : "2px solid #F59E0B",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6), inset 0 0 12px rgba(56, 189, 248, 0.15)",
          backdropFilter: "blur(6px)"
        }}
      >
        {/* SVG Triad Graphic */}
        <svg
          width="110"
          height="110"
          viewBox="-55 -55 110 110"
          style={{ overflow: "visible" }}
        >
          {/* Subtle 6-axis isometric guide lines */}
          {ISO_ANGLES.map((ang) => {
            const pt = angleToScreenCoords(ang, 48);
            return (
              <line
                key={ang}
                x1={0}
                y1={0}
                x2={pt.x}
                y2={pt.y}
                stroke="rgba(148, 163, 184, 0.18)"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            );
          })}

          {/* AXIS X ARROW (Red) */}
          <line
            x1={0}
            y1={0}
            x2={coordsX.x}
            y2={coordsX.y}
            stroke="#EF4444"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx={coordsX.x}
            cy={coordsX.y}
            r={6}
            fill="#EF4444"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            style={{ cursor: "grab" }}
            onMouseDown={(e) => handleAxisMouseDown("X", e)}
          />
          <text
            x={coordsX.x * 1.25}
            y={coordsX.y * 1.25 + 4}
            fill="#FCA5A5"
            fontSize="11"
            fontWeight="900"
            textAnchor="middle"
            pointerEvents="none"
          >
            X
          </text>

          {/* AXIS Y ARROW (Green) */}
          <line
            x1={0}
            y1={0}
            x2={coordsY.x}
            y2={coordsY.y}
            stroke="#10B981"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx={coordsY.x}
            cy={coordsY.y}
            r={6}
            fill="#10B981"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            style={{ cursor: "grab" }}
            onMouseDown={(e) => handleAxisMouseDown("Y", e)}
          />
          <text
            x={coordsY.x * 1.25}
            y={coordsY.y * 1.25 + 4}
            fill="#6EE7B7"
            fontSize="11"
            fontWeight="900"
            textAnchor="middle"
            pointerEvents="none"
          >
            Y
          </text>

          {/* AXIS Z ARROW (Cyan / Sky Blue) */}
          <line
            x1={0}
            y1={0}
            x2={coordsZ.x}
            y2={coordsZ.y}
            stroke="#0284C7"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx={coordsZ.x}
            cy={coordsZ.y}
            r={6}
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            style={{ cursor: "grab" }}
            onMouseDown={(e) => handleAxisMouseDown("Z", e)}
          />
          <text
            x={coordsZ.x * 1.25}
            y={coordsZ.y * 1.25 + 4}
            fill="#7DD3FC"
            fontSize="11"
            fontWeight="900"
            textAnchor="middle"
            pointerEvents="none"
          >
            Z
          </text>

          {/* Central Origin Node (Draggable) */}
          <circle
            cx={0}
            cy={0}
            r={7}
            fill="#F8FAFC"
            stroke="#0284C7"
            strokeWidth={2}
            style={{ cursor: isDraggingOrigin ? "grabbing" : "grab" }}
            onMouseDown={handleOriginMouseDown}
          />
        </svg>

        {/* Floating Quick Reset Badge */}
        {!isDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAxisMappingChange(DEFAULT_AXIS_MAPPING);
            }}
            title="Réinitialiser l'orientation des axes isométriques par défaut"
            style={{
              position: "absolute",
              bottom: -20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#F59E0B",
              color: "#0F172A",
              border: "none",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 9,
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
            }}
          >
            ↺ Défaut
          </button>
        )}
      </div>
    </div>
  );
};
