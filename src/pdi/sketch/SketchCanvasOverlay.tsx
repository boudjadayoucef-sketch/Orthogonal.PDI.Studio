/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO ENGINE — STEP 2: DUAL-LAYER INTERACTIVE CALQUE CANVAS (A4/A3)
 * Reference: PATCH SKETCH-DETECT-07 (Multi-selection, Clipboard, Triad, Coordinated 3D Mapping)
 */
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  SketchPoint2D,
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  PaperFormat,
  PAPER_FORMATS,
  snapToIsometricAngle,
  applyImageFilters
} from "./sketchRasterEngine";
import { SketchAxisTriad } from "./SketchAxisTriad";
import { AxisMappingConfig, DEFAULT_AXIS_MAPPING } from "./openCvSketchDetector";
import { AxisCursorOverlay } from "../shared/AxisCursorOverlay";

export interface SketchCanvasOverlayProps {
  imageBlob?: Blob | null;
  imageDataUrl: string | null;
  imageDimensions: { width: number; height: number };
  format: PaperFormat;
  opacity: number; // 0 à 100
  contrastThreshold: number; // 0 à 255
  brightness: number; // -100 à 100
  invert: boolean;
  rotationDeg: number;
  snapAngleToleranceDeg: number;
  nodes: SketchVectorNode[];
  segments: SketchVectorSegment[];
  fittings: SketchVectorFitting[];
  calibrationScale: number; // px par mm
  activeTool: "select" | "pipe" | "fitting" | "calibrate" | "erase" | "pan";
  selectedFittingType: SketchVectorFitting["type"];
  recenterTrigger?: number;
  isDetectingAI?: boolean;
  axisCursorEnabled?: boolean;
  axisMapping?: AxisMappingConfig;
  onAxisMappingChange?: (mapping: AxisMappingConfig) => void;
  onNodesChange: (nodes: SketchVectorNode[]) => void;
  onSegmentsChange: (segments: SketchVectorSegment[]) => void;
  onFittingsChange: (fittings: SketchVectorFitting[]) => void;
  onCalibrationChange: (newScale: number) => void;
}

interface SketchClipboardData {
  nodes: SketchVectorNode[];
  segments: SketchVectorSegment[];
  fittings: SketchVectorFitting[];
}

export const SketchCanvasOverlay: React.FC<SketchCanvasOverlayProps> = ({
  imageDataUrl,
  imageDimensions,
  format,
  opacity,
  contrastThreshold,
  brightness,
  invert,
  rotationDeg,
  snapAngleToleranceDeg,
  nodes,
  segments,
  fittings,
  calibrationScale,
  activeTool,
  selectedFittingType,
  recenterTrigger,
  isDetectingAI = false,
  axisCursorEnabled = false,
  axisMapping = DEFAULT_AXIS_MAPPING,
  onAxisMappingChange,
  onNodesChange,
  onSegmentsChange,
  onFittingsChange,
  onCalibrationChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const vectorCanvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-Selection State (Partie 3)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(new Set());

  // Rectangle / Marquee Selection State
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState<SketchPoint2D | null>(null);
  const [boxSelectCurrent, setBoxSelectCurrent] = useState<SketchPoint2D | null>(null);

  // Node Dragging in Select mode
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const dragNodeStartPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragMouseStartRef = useRef<SketchPoint2D>({ x: 0, y: 0 });

  // Drawing state
  const [pipeStartNodeId, setPipeStartNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<SketchPoint2D | null>(null);
  const [calibrateP1, setCalibrateP1] = useState<SketchPoint2D | null>(null);
  const [calibrateP2, setCalibrateP2] = useState<SketchPoint2D | null>(null);

  // Clipboard Reference
  const clipboardRef = useRef<SketchClipboardData | null>(null);
  const isHoveredRef = useRef(false);

  // Offscreen source image for fast rendering
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  // Recenter function
  const handleRecenter = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const targetW = imageDimensions.width || 1200;
    const targetH = imageDimensions.height || 850;

    const scaleX = (cw - 60) / targetW;
    const scaleY = (ch - 60) / targetH;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 2.5);

    const newPanX = (cw - targetW * newZoom) / 2;
    const newPanY = (ch - targetH * newZoom) / 2;

    setZoom(newZoom);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  }, [imageDimensions]);

  // Trigger recenter when recenterTrigger changes
  useEffect(() => {
    if (recenterTrigger !== undefined && recenterTrigger > 0) {
      handleRecenter();
    }
  }, [recenterTrigger, handleRecenter]);

  // Load image when url changes
  useEffect(() => {
    if (!imageDataUrl) {
      sourceImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      sourceImageRef.current = img;
      renderBackground();
      setTimeout(handleRecenter, 50);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, handleRecenter]);

  // Render background image with filters
  const renderBackground = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;
    const ctx = bgCanvas.getContext("2d");
    if (!ctx) return;

    const targetW = imageDimensions.width || 1200;
    const targetH = imageDimensions.height || 850;

    bgCanvas.width = targetW;
    bgCanvas.height = targetH;

    ctx.clearRect(0, 0, targetW, targetH);

    // Draw paper outline & grid
    ctx.fillStyle = "#FDFBF7";
    ctx.fillRect(0, 0, targetW, targetH);

    // Grid lines (5mm / ~20px grid)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = 0; x < targetW; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, targetH);
      ctx.stroke();
    }
    for (let y = 0; y < targetH; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(targetW, y);
      ctx.stroke();
    }

    // Draw image if available
    if (sourceImageRef.current) {
      ctx.save();
      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(sourceImageRef.current, 0, 0, targetW, targetH);
      ctx.restore();

      // Apply pixel-level contrast, brightness, invert filters
      if (contrastThreshold > 0 || brightness !== 0 || invert) {
        try {
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const d = imgData.data;
          const brightnessOffset = (brightness / 100) * 255;
          for (let i = 0; i < d.length; i += 4) {
            let r = d[i] + brightnessOffset;
            let g = d[i + 1] + brightnessOffset;
            let b = d[i + 2] + brightnessOffset;
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            if (contrastThreshold > 0) {
              gray = gray < contrastThreshold ? 0 : 255;
            }
            if (invert) {
              gray = 255 - gray;
            }
            d[i] = gray;
            d[i + 1] = gray;
            d[i + 2] = gray;
          }
          ctx.putImageData(imgData, 0, 0);
        } catch {
          // ignore any cross-origin security restriction
        }
      }
    }
  }, [imageDimensions, format, opacity, contrastThreshold, brightness, invert]);

  useEffect(() => {
    renderBackground();
  }, [renderBackground]);

  // Render vector overlay (Pipes, Nodes, Fittings, Snapping Guides, Marquee selection)
  const renderVectorOverlay = useCallback(() => {
    const vCanvas = vectorCanvasRef.current;
    if (!vCanvas) return;
    const ctx = vCanvas.getContext("2d");
    if (!ctx) return;

    const targetW = imageDimensions.width || 1200;
    const targetH = imageDimensions.height || 850;

    vCanvas.width = targetW;
    vCanvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);

    // Draw Segments (Pipes)
    segments.forEach((seg) => {
      const n1 = nodes.find((n) => n.id === seg.fromNodeId);
      const n2 = nodes.find((n) => n.id === seg.toNodeId);
      if (!n1 || !n2) return;

      const isSegSelected =
        selectedSegmentIds.has(seg.id) ||
        (selectedNodeIds.has(seg.fromNodeId) && selectedNodeIds.has(seg.toNodeId));

      if (isSegSelected) {
        // Selection glowing halo
        ctx.save();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.strokeStyle = isSegSelected ? "#38BDF8" : "#0284C7";
      ctx.lineWidth = isSegSelected ? 3.5 : 3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();

      // Pipe text annotation (DN / length)
      const midX = (n1.x + n2.x) / 2;
      const midY = (n1.y + n2.y) / 2;
      ctx.fillStyle = isSegSelected ? "#0284C7" : "#0369A1";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      const lengthMm =
        seg.lengthMm ||
        (calibrationScale > 0
          ? Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y) / calibrationScale)
          : null);
      const label = `DN${seg.nominalDiameter || 150}${lengthMm ? ` • ${lengthMm}mm` : ""}`;
      ctx.fillText(label, midX, midY - 6);
    });

    // Draw Active Pipe Drawing guide if active
    if (activeTool === "pipe" && pipeStartNodeId && mousePos) {
      const startNode = nodes.find((n) => n.id === pipeStartNodeId);
      if (startNode) {
        const snap = snapToIsometricAngle(startNode, mousePos, snapAngleToleranceDeg);
        ctx.strokeStyle = snap.isSnapped ? "#10B981" : "#EF4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        ctx.moveTo(startNode.x, startNode.y);
        ctx.lineTo(snap.snappedPoint.x, snap.snappedPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Angle indicator
        ctx.fillStyle = snap.isSnapped ? "#059669" : "#DC2626";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillText(
          `${snap.angleDeg}° ${snap.isSnapped ? "✓ (ISO)" : "⚠"}`,
          snap.snappedPoint.x + 10,
          snap.snappedPoint.y - 10
        );
      }
    }

    // Draw Equipment Bodies (Ballons, Pompes, Cuves)
    nodes.forEach((n) => {
      if (n.equipmentType) {
        const isEqSelected = selectedNodeIds.has(n.id);
        const eqLabel = n.equipmentLabel || n.label || n.equipmentType.toUpperCase();

        if (n.equipmentType.includes("ballon_horizontal") || n.equipmentType.includes("vessel_horizontal")) {
          const bw = 96;
          const bh = 42;
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.fillStyle = isEqSelected ? "rgba(56, 189, 248, 0.35)" : "rgba(2, 132, 199, 0.22)";
          ctx.strokeStyle = isEqSelected ? "#38BDF8" : "#0284C7";
          ctx.lineWidth = isEqSelected ? 2.5 : 2;

          ctx.beginPath();
          ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 18);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-bw / 2 + 18, -bh / 2);
          ctx.lineTo(-bw / 2 + 18, bh / 2);
          ctx.moveTo(bw / 2 - 18, -bh / 2);
          ctx.lineTo(bw / 2 - 18, bh / 2);
          ctx.stroke();

          ctx.fillStyle = "#0F172A";
          ctx.font = "bold 10px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(eqLabel, 0, 3);
          ctx.restore();
        } else if (n.equipmentType.includes("ballon_vertical") || n.equipmentType.includes("vessel_vertical")) {
          const bw = 44;
          const bh = 96;
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.fillStyle = isEqSelected ? "rgba(56, 189, 248, 0.35)" : "rgba(2, 132, 199, 0.22)";
          ctx.strokeStyle = isEqSelected ? "#38BDF8" : "#0284C7";
          ctx.lineWidth = isEqSelected ? 2.5 : 2;

          ctx.beginPath();
          ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 18);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#0F172A";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(eqLabel, 0, 3);
          ctx.restore();
        } else if (n.equipmentType.includes("pompe") || n.equipmentType.includes("pump")) {
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.fillStyle = isEqSelected ? "rgba(56, 189, 248, 0.35)" : "rgba(217, 119, 6, 0.22)";
          ctx.strokeStyle = isEqSelected ? "#38BDF8" : "#D97706";
          ctx.lineWidth = 2;

          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(14, -12);
          ctx.lineTo(24, -20);
          ctx.stroke();

          ctx.fillStyle = "#78350F";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(eqLabel, 0, 28);
          ctx.restore();
        }
      }
    });

    // Draw Nodes (Partie 3: Distinct Selection Halo & Multi-Selection)
    nodes.forEach((n) => {
      const isSelected = selectedNodeIds.has(n.id);
      const isStart = pipeStartNodeId === n.id;

      if (isSelected) {
        // Prominent Selection Halo (inspired by IsometrieModuleV48d)
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
        ctx.fill();
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = isStart ? "#10B981" : isSelected ? "#38BDF8" : "#1E293B";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(n.x, n.y, isSelected || isStart ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Fittings (Valves, flanges, check valves, etc.)
    fittings.forEach((fit) => {
      let posX = 0;
      let posY = 0;

      if (fit.nodeId) {
        const n = nodes.find((node) => node.id === fit.nodeId);
        if (n) {
          posX = n.x;
          posY = n.y;
        }
      } else if (fit.segmentId) {
        const seg = segments.find((s) => s.id === fit.segmentId);
        if (seg) {
          const n1 = nodes.find((n) => n.id === seg.fromNodeId);
          const n2 = nodes.find((n) => n.id === seg.toNodeId);
          if (n1 && n2) {
            posX = (n1.x + n2.x) / 2;
            posY = (n1.y + n2.y) / 2;
          }
        }
      }

      if (posX && posY) {
        const isValve = fit.type.includes("valve") || fit.type.includes("vanne");
        const isFlange = fit.type.includes("flange") || fit.type.includes("bride");

        ctx.save();
        ctx.translate(posX, posY);

        if (isValve) {
          ctx.fillStyle = "#E11D48";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.moveTo(-9, -6);
          ctx.lineTo(0, 0);
          ctx.lineTo(-9, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(9, -6);
          ctx.lineTo(0, 0);
          ctx.lineTo(9, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -9);
          ctx.moveTo(-4, -9);
          ctx.lineTo(4, -9);
          ctx.stroke();

          ctx.fillStyle = "#9F1239";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(fit.label || "VANNE", 0, 15);
        } else if (isFlange) {
          ctx.strokeStyle = "#059669";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-3, -8);
          ctx.lineTo(-3, 8);
          ctx.moveTo(3, -8);
          ctx.lineTo(3, 8);
          ctx.stroke();

          ctx.fillStyle = "#065F46";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(fit.label || "BRIDE", 0, 17);
        } else {
          ctx.fillStyle = "#8B5CF6";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#5B21B6";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(fit.label || fit.type.toUpperCase().slice(0, 4), 0, 15);
        }

        ctx.restore();
      }
    });

    // Draw Calibration line if in progress
    if (activeTool === "calibrate" && calibrateP1 && (calibrateP2 || mousePos)) {
      const pEnd = calibrateP2 || mousePos!;
      ctx.strokeStyle = "#8B5CF6";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(calibrateP1.x, calibrateP1.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const distPx = Math.round(Math.hypot(pEnd.x - calibrateP1.x, pEnd.y - calibrateP1.y));
      ctx.fillStyle = "#6D28D9";
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.fillText(`📏 ${distPx} px`, (calibrateP1.x + pEnd.x) / 2, (calibrateP1.y + pEnd.y) / 2 - 8);
    }

    // Draw Marquee Box Selection Rectangle (Partie 3)
    if (isBoxSelecting && boxSelectStart && boxSelectCurrent) {
      const minX = Math.min(boxSelectStart.x, boxSelectCurrent.x);
      const maxX = Math.max(boxSelectStart.x, boxSelectCurrent.x);
      const minY = Math.min(boxSelectStart.y, boxSelectCurrent.y);
      const maxY = Math.max(boxSelectStart.y, boxSelectCurrent.y);
      const w = maxX - minX;
      const h = maxY - minY;

      ctx.save();
      ctx.fillStyle = "rgba(14, 165, 233, 0.14)";
      ctx.fillRect(minX, minY, w, h);

      ctx.strokeStyle = "#0284C7";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(minX, minY, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [
    imageDimensions,
    nodes,
    segments,
    fittings,
    selectedNodeIds,
    selectedSegmentIds,
    activeTool,
    pipeStartNodeId,
    mousePos,
    snapAngleToleranceDeg,
    calibrationScale,
    calibrateP1,
    calibrateP2,
    isBoxSelecting,
    boxSelectStart,
    boxSelectCurrent
  ]);

  useEffect(() => {
    renderVectorOverlay();
  }, [renderVectorOverlay]);

  // Screen to Canvas coordinate conversion
  const getCanvasCoords = (e: React.MouseEvent): SketchPoint2D => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    };
  };

  // Find nearest node within snap distance
  const findNearestNode = (pt: SketchPoint2D, maxDistPx = 15): SketchVectorNode | null => {
    let nearest: SketchVectorNode | null = null;
    let minDist = maxDistPx;
    for (const n of nodes) {
      const d = Math.hypot(n.x - pt.x, n.y - pt.y);
      if (d < minDist) {
        minDist = d;
        nearest = n;
      }
    }
    return nearest;
  };

  // =========================================================================
  // PARTIE 3 — CLIPBOARD OPERATIONS: COPIER / COLLER / SUPPRIMER
  // =========================================================================

  // Copier (Ctrl+C)
  const copySelection = useCallback(() => {
    if (selectedNodeIds.size === 0) return false;
    const copiedNodes = nodes.filter((n) => selectedNodeIds.has(n.id));
    const copiedSegs = segments.filter(
      (s) => selectedNodeIds.has(s.fromNodeId) && selectedNodeIds.has(s.toNodeId)
    );
    const copiedNodeIdSet = new Set(copiedNodes.map((n) => n.id));
    const copiedSegIdSet = new Set(copiedSegs.map((s) => s.id));
    const copiedFittings = fittings.filter(
      (f) =>
        (f.nodeId && copiedNodeIdSet.has(f.nodeId)) ||
        (f.segmentId && copiedSegIdSet.has(f.segmentId))
    );

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(copiedNodes)),
      segments: JSON.parse(JSON.stringify(copiedSegs)),
      fittings: JSON.parse(JSON.stringify(copiedFittings))
    };
    return true;
  }, [nodes, segments, fittings, selectedNodeIds]);

  // Coller (Ctrl+V)
  const pasteSelection = useCallback(
    (targetPoint?: SketchPoint2D) => {
      if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return false;

      const buffer = clipboardRef.current;
      let dx = 35;
      let dy = 35;

      if (targetPoint && buffer.nodes.length > 0) {
        const minX = Math.min(...buffer.nodes.map((n) => n.x));
        const minY = Math.min(...buffer.nodes.map((n) => n.y));
        dx = targetPoint.x - minX;
        dy = targetPoint.y - minY;
      }

      const idMap = new Map<string, string>();
      const newNodes: SketchVectorNode[] = buffer.nodes.map((n) => {
        const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          x: Math.round(n.x + dx),
          y: Math.round(n.y + dy)
        };
      });

      const segIdMap = new Map<string, string>();
      const newSegments: SketchVectorSegment[] = buffer.segments
        .filter((s) => idMap.has(s.fromNodeId) && idMap.has(s.toNodeId))
        .map((s) => {
          const newSegId = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          segIdMap.set(s.id, newSegId);
          return {
            ...s,
            id: newSegId,
            fromNodeId: idMap.get(s.fromNodeId)!,
            toNodeId: idMap.get(s.toNodeId)!
          };
        });

      const newFittings: SketchVectorFitting[] = buffer.fittings
        .filter(
          (f) =>
            (f.nodeId && idMap.has(f.nodeId)) ||
            (f.segmentId && segIdMap.has(f.segmentId))
        )
        .map((f) => ({
          ...f,
          id: `fit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          nodeId: f.nodeId ? idMap.get(f.nodeId) : undefined,
          segmentId: f.segmentId ? segIdMap.get(f.segmentId) : undefined
        }));

      onNodesChange([...nodes, ...newNodes]);
      onSegmentsChange([...segments, ...newSegments]);
      if (newFittings.length > 0) {
        onFittingsChange([...fittings, ...newFittings]);
      }

      setSelectedNodeIds(new Set(newNodes.map((n) => n.id)));
      setSelectedSegmentIds(new Set(newSegments.map((s) => s.id)));
      return true;
    },
    [nodes, segments, fittings, onNodesChange, onSegmentsChange, onFittingsChange]
  );

  // Supprimer (Delete / Backspace)
  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.size === 0 && selectedSegmentIds.size === 0) return false;

    const remainingNodes = nodes.filter((n) => !selectedNodeIds.has(n.id));
    const remainingSegments = segments.filter(
      (s) =>
        !selectedSegmentIds.has(s.id) &&
        !selectedNodeIds.has(s.fromNodeId) &&
        !selectedNodeIds.has(s.toNodeId)
    );
    const remainingNodeIds = new Set(remainingNodes.map((n) => n.id));
    const remainingSegIds = new Set(remainingSegments.map((s) => s.id));
    const remainingFittings = fittings.filter(
      (f) =>
        (!f.nodeId || remainingNodeIds.has(f.nodeId)) &&
        (!f.segmentId || remainingSegIds.has(f.segmentId))
    );

    onNodesChange(remainingNodes);
    onSegmentsChange(remainingSegments);
    onFittingsChange(remainingFittings);
    setSelectedNodeIds(new Set());
    setSelectedSegmentIds(new Set());
    return true;
  }, [
    nodes,
    segments,
    fittings,
    selectedNodeIds,
    selectedSegmentIds,
    onNodesChange,
    onSegmentsChange,
    onFittingsChange
  ]);

  // Keyboard Shortcuts Listener for Copy / Paste / Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if focused or hovering canvas, and not editing input fields
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") {
        return;
      }

      if (!isHoveredRef.current && document.activeElement !== containerRef.current) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        copySelection();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        pasteSelection(mousePos || undefined);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [copySelection, pasteSelection, deleteSelection, mousePos]);

  // Handle Canvas Click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning) return;
    const pt = getCanvasCoords(e);

    // TOOL: PIPE DRAWING
    if (activeTool === "pipe") {
      const clickedNode = findNearestNode(pt);

      if (!pipeStartNodeId) {
        // Start new pipe
        if (clickedNode) {
          setPipeStartNodeId(clickedNode.id);
        } else {
          const newNode: SketchVectorNode = {
            id: `node_${Date.now()}`,
            x: Math.round(pt.x),
            y: Math.round(pt.y),
            elevation: 0
          };
          onNodesChange([...nodes, newNode]);
          setPipeStartNodeId(newNode.id);
        }
      } else {
        // Finish pipe segment
        const startNode = nodes.find((n) => n.id === pipeStartNodeId);
        if (!startNode) {
          setPipeStartNodeId(null);
          return;
        }

        const snap = snapToIsometricAngle(startNode, pt, snapAngleToleranceDeg);
        let endNode = clickedNode;

        if (!endNode) {
          endNode = {
            id: `node_${Date.now()}`,
            x: Math.round(snap.snappedPoint.x),
            y: Math.round(snap.snappedPoint.y),
            elevation: 0
          };
          onNodesChange([...nodes, endNode]);
        }

        if (endNode.id !== startNode.id) {
          const newSeg: SketchVectorSegment = {
            id: `seg_${Date.now()}`,
            fromNodeId: startNode.id,
            toNodeId: endNode.id,
            nominalDiameter: 150,
            pressureClass: "Class 300",
            material: "Acier API 5L Gr. B",
            angleIsoDeg: snap.angleDeg
          };
          onSegmentsChange([...segments, newSeg]);
        }

        setPipeStartNodeId(endNode.id);
      }
      return;
    }

    // TOOL: FITTING
    if (activeTool === "fitting") {
      const clickedNode = findNearestNode(pt);
      const newFit: SketchVectorFitting = {
        id: `fit_${Date.now()}`,
        nodeId: clickedNode?.id,
        type: selectedFittingType,
        nominalDiameter: 150
      };
      onFittingsChange([...fittings, newFit]);
      return;
    }

    // TOOL: CALIBRATE SCALE
    if (activeTool === "calibrate") {
      if (!calibrateP1) {
        setCalibrateP1(pt);
      } else {
        setCalibrateP2(pt);
        const distPx = Math.hypot(pt.x - calibrateP1.x, pt.y - calibrateP1.y);
        const userMmStr = window.prompt(
          `Longueur réelle mesurée pour cette ligne (${Math.round(distPx)} pixels) en millimètres :`,
          "1000"
        );
        if (userMmStr && !isNaN(Number(userMmStr)) && Number(userMmStr) > 0) {
          const scale = distPx / Number(userMmStr);
          onCalibrationChange(scale);
        }
        setCalibrateP1(null);
        setCalibrateP2(null);
      }
      return;
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
      return;
    }

    const pt = getCanvasCoords(e);
    setMousePos(pt);

    // Box Marquee Selection update
    if (isBoxSelecting && boxSelectStart) {
      setBoxSelectCurrent(pt);
      return;
    }

    // Node dragging in select mode (Multi-node support)
    if (isDraggingNode && selectedNodeIds.size > 0 && activeTool === "select") {
      const dx = Math.round(pt.x - dragMouseStartRef.current.x);
      const dy = Math.round(pt.y - dragMouseStartRef.current.y);

      onNodesChange(
        nodes.map((n) => {
          if (selectedNodeIds.has(n.id)) {
            const startPos = dragNodeStartPosRef.current.get(n.id);
            if (startPos) {
              return {
                ...n,
                x: Math.round(startPos.x + dx),
                y: Math.round(startPos.y + dy)
              };
            }
          }
          return n;
        })
      );
    }
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "pan" && e.button === 0) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y
      };
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y
      };
      return;
    }

    if (activeTool === "select" && e.button === 0) {
      const pt = getCanvasCoords(e);
      const clickedNode = findNearestNode(pt);

      if (clickedNode) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Toggle node in selection
          const next = new Set(selectedNodeIds);
          if (next.has(clickedNode.id)) {
            next.delete(clickedNode.id);
          } else {
            next.add(clickedNode.id);
          }
          setSelectedNodeIds(next);
        } else {
          // If clicked node is not in selection, select only this one
          if (!selectedNodeIds.has(clickedNode.id)) {
            setSelectedNodeIds(new Set([clickedNode.id]));
          }
        }

        // Initialize drag coordinates for all selected nodes
        const startMap = new Map<string, { x: number; y: number }>();
        nodes.forEach((n) => {
          if (selectedNodeIds.has(n.id) || n.id === clickedNode.id) {
            startMap.set(n.id, { x: n.x, y: n.y });
          }
        });
        dragNodeStartPosRef.current = startMap;
        dragMouseStartRef.current = pt;
        setIsDraggingNode(true);
      } else {
        // Clicked on empty canvas -> Start Marquee Box Selection
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedNodeIds(new Set());
          setSelectedSegmentIds(new Set());
        }
        setIsBoxSelecting(true);
        setBoxSelectStart(pt);
        setBoxSelectCurrent(pt);
      }
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    if (isBoxSelecting && boxSelectStart && boxSelectCurrent) {
      const minX = Math.min(boxSelectStart.x, boxSelectCurrent.x);
      const maxX = Math.max(boxSelectStart.x, boxSelectCurrent.x);
      const minY = Math.min(boxSelectStart.y, boxSelectCurrent.y);
      const maxY = Math.max(boxSelectStart.y, boxSelectCurrent.y);

      if (Math.hypot(maxX - minX, maxY - minY) > 6) {
        // Enclose nodes within selection box
        const enclosedNodes = nodes.filter(
          (n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY
        );
        const newSet = new Set(selectedNodeIds);
        enclosedNodes.forEach((n) => newSet.add(n.id));
        setSelectedNodeIds(newSet);
      }

      setIsBoxSelecting(false);
      setBoxSelectStart(null);
      setBoxSelectCurrent(null);
    }

    setIsPanning(false);
    setIsDraggingNode(false);
  };

  // Zoom with wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.min(Math.max(z * zoomFactor, 0.2), 6));
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        setIsPanning(false);
        setIsDraggingNode(false);
        setIsBoxSelecting(false);
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleCanvasClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setPipeStartNodeId(null);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 520,
        backgroundColor: "#0B1120",
        overflow: "hidden",
        cursor: isPanning
          ? "grabbing"
          : activeTool === "pan"
          ? "grab"
          : activeTool === "pipe"
          ? "crosshair"
          : activeTool === "select"
          ? "default"
          : "default",
        userSelect: "none",
        outline: "none"
      }}
    >
      {/* PARTIE 2: TRIÈDRE D'ORIENTATION DES AXES INTERACTIF */}
      {onAxisMappingChange && (
        <SketchAxisTriad
          axisMapping={axisMapping}
          onAxisMappingChange={onAxisMappingChange}
          containerWidth={containerRef.current?.clientWidth || 800}
          containerHeight={containerRef.current?.clientHeight || 600}
        />
      )}

      {/* Zoom / Pan Container */}
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotationDeg}deg)`
        }}
      >
        {/* Layer 0: Background Canvas (Sketch image with filters) */}
        <canvas
          ref={bgCanvasRef}
          style={{
            display: "block",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            borderRadius: 4
          }}
        />

        {/* Layer 1: Vector Overlay Canvas (Nodes, Pipes, Snap Guides) */}
        <canvas
          ref={vectorCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none"
          }}
        />

        {/* Curseur Trièdre pendant le déplacement d'un élément (SKETCH-DETECT-08 / PARTIE 2) */}
        {axisCursorEnabled && isDraggingNode && mousePos && (
          <AxisCursorOverlay x={mousePos.x} y={mousePos.y} />
        )}
      </div>

      {/* Indicateur d'analyse locale en cours (0 API, 0 IA) */}
      {isDetectingAI && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(14, 116, 144, 0.95), rgba(15, 23, 42, 0.95))",
            backdropFilter: "blur(12px)",
            border: "1px solid #38BDF8",
            borderRadius: 10,
            padding: "10px 20px",
            color: "#F8FAFC",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 30,
            boxShadow: "0 10px 30px rgba(2, 132, 199, 0.4)",
            maxWidth: "92%"
          }}
        >
          <span style={{ fontSize: 18 }}>⚡</span>
          <span>
            <strong style={{ color: "#38BDF8" }}>Moteur Local Autonome (0 API, 0 IA) :</strong> Analyse matricielle déterministe en cours... Reconnaissance du matériel (ballons, pompes, vannes) et tracé du réseau.
          </span>
        </div>
      )}

      {/* Floating Canvas Info & Quick Actions HUD */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          background: "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(8px)",
          border: "1px solid #334155",
          borderRadius: 8,
          padding: "6px 12px",
          color: "#94A3B8",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 15,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRecenter();
          }}
          title="Recentrer et adapter le scan à l'écran"
          style={{
            background: "#0284C7",
            border: "none",
            borderRadius: 5,
            color: "#FFFFFF",
            padding: "3px 8px",
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <span>🎯 Recentrer</span>
        </button>

        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)" }} />

        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span>Échelle: {calibrationScale > 0 ? `${calibrationScale.toFixed(2)} px/mm` : "Non étalonné"}</span>
        <span>Nœuds: {nodes.length}</span>
        <span>Tronçons: {segments.length}</span>

        {selectedNodeIds.size > 0 && (
          <>
            <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)" }} />
            <span style={{ color: "#38BDF8", fontWeight: 700 }}>
              Sélection : {selectedNodeIds.size} nœud(s)
            </span>
            <button
              type="button"
              onClick={copySelection}
              title="Copier les éléments sélectionnés (Ctrl+C)"
              style={{
                background: "rgba(56, 189, 248, 0.2)",
                border: "1px solid #38BDF8",
                borderRadius: 4,
                color: "#38BDF8",
                padding: "2px 6px",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              📋 Copier
            </button>
            <button
              type="button"
              onClick={deleteSelection}
              title="Supprimer la sélection (Delete / Backspace)"
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #EF4444",
                borderRadius: 4,
                color: "#FCA5A5",
                padding: "2px 6px",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🗑️ Suppr
            </button>
          </>
        )}

        {pipeStartNodeId && (
          <span style={{ color: "#10B981", fontWeight: 700 }}>
            ● Traçage en cours (Clic droit pour clore)
          </span>
        )}
      </div>
    </div>
  );
};
