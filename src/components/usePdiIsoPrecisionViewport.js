import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook durable pour précision canvas CAO :
 * - getBoundingClientRect()
 * - screenToWorld / worldToScreen
 * - zoom centré curseur
 * - pan
 * - devicePixelRatio
 */
export function usePdiIsoPrecisionViewport(canvasRef, options = {}) {
  const minZoom = options.minZoom ?? 0.25;
  const maxZoom = options.maxZoom ?? 4;
  const initialZoom = options.initialZoom ?? 1;

  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursorWorld, setCursorWorld] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ zoom: initialZoom, pan: { x: 0, y: 0 }, isPanning: false, last: { x: 0, y: 0 } });

  useEffect(() => {
    stateRef.current.zoom = zoom;
    stateRef.current.pan = pan;
  }, [zoom, pan]);

  const clamp = useCallback((v, min, max) => Math.max(min, Math.min(max, v)), []);

  const resizeCanvasForDpr = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const parent = canvas.parentElement || canvas;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    }
    return { canvas, ctx, rect, dpr };
  }, [canvasRef]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const s = stateRef.current;
    return { x: (sx - s.pan.x) / s.zoom, y: (sy - s.pan.y) / s.zoom };
  }, [canvasRef]);

  const worldToScreen = useCallback((x, y) => {
    const s = stateRef.current;
    return { x: x * s.zoom + s.pan.x, y: y * s.zoom + s.pan.y };
  }, []);

  const snapPoint = useCallback((point, step = 25) => ({
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  }), []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const s = stateRef.current;
    const before = { x: (mx - s.pan.x) / s.zoom, y: (my - s.pan.y) / s.zoom };
    const nextZoom = clamp(s.zoom * (event.deltaY > 0 ? 0.92 : 1.08), minZoom, maxZoom);
    const nextPan = { x: mx - before.x * nextZoom, y: my - before.y * nextZoom };
    stateRef.current.zoom = nextZoom;
    stateRef.current.pan = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, [canvasRef, clamp, minZoom, maxZoom]);

  const handlePointerMove = useCallback((event) => {
    const s = stateRef.current;
    if (s.isPanning) {
      const dx = event.clientX - s.last.x;
      const dy = event.clientY - s.last.y;
      const nextPan = { x: s.pan.x + dx, y: s.pan.y + dy };
      s.pan = nextPan;
      s.last = { x: event.clientX, y: event.clientY };
      setPan(nextPan);
      return;
    }
    setCursorWorld(screenToWorld(event.clientX, event.clientY));
  }, [screenToWorld]);

  const startPan = useCallback((event) => {
    stateRef.current.isPanning = true;
    stateRef.current.last = { x: event.clientX, y: event.clientY };
  }, []);

  const stopPan = useCallback(() => {
    stateRef.current.isPanning = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [canvasRef, handleWheel]);

  useEffect(() => {
    resizeCanvasForDpr();
    window.addEventListener("resize", resizeCanvasForDpr);
    return () => window.removeEventListener("resize", resizeCanvasForDpr);
  }, [resizeCanvasForDpr]);

  return { zoom, pan, cursorWorld, setZoom, setPan, resizeCanvasForDpr, screenToWorld, worldToScreen, snapPoint, handleWheel, handlePointerMove, startPan, stopPan };
}
