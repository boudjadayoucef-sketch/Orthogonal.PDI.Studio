import React, { useEffect, useRef, useState } from 'react';
import { Box, Activity, Layers, RotateCw, ZoomIn, ZoomOut, Compass, Sparkles, CheckCircle2 } from 'lucide-react';

interface NetworkAnimationProps {
  className?: string;
  onEnterApp?: () => void;
}

export const NetworkAnimation: React.FC<NetworkAnimationProps> = ({ className, onEnterApp }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [activeSegment, setActiveSegment] = useState<string | null>("SPL-01");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let rotation = angle;

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);

    // 3D Isometric Pipe Nodes
    const nodes = [
      { id: "N1", x: -180, y: -80, z: -40, type: "flange", label: "Bride WN 6\" CL300" },
      { id: "N2", x: -80, y: -80, z: -40, type: "valve", label: "Vanne à Opercule 6\"" },
      { id: "N3", x: 40, y: -80, z: -40, type: "elbow", label: "Coude 90° LR" },
      { id: "N4", x: 40, y: 60, z: -40, type: "tee", label: "Té Égal 6\"" },
      { id: "N5", x: 160, y: 60, z: -40, type: "reducer", label: "Réduction 6\"x4\"" },
      { id: "N6", x: 160, y: 60, z: 80, type: "elbow", label: "Coude 90° Z+" },
      { id: "N7", x: -40, y: 60, z: 80, type: "flange", label: "Bride Aveugle 4\"" },
      { id: "N8", x: 40, y: 180, z: -40, type: "valve", label: "Vanne de Purge 2\"" },
    ];

    const edges = [
      { from: 0, to: 1, spool: "SPL-01", dn: "6\"", mat: "API 5L X52" },
      { from: 1, to: 2, spool: "SPL-01", dn: "6\"", mat: "API 5L X52" },
      { from: 2, to: 3, spool: "SPL-02", dn: "6\"", mat: "API 5L X52" },
      { from: 3, to: 4, spool: "SPL-02", dn: "6\"", mat: "API 5L X52" },
      { from: 4, to: 5, spool: "SPL-03", dn: "4\"", mat: "A106 Gr.B" },
      { from: 5, to: 6, spool: "SPL-03", dn: "4\"", mat: "A106 Gr.B" },
      { from: 3, to: 7, spool: "SPL-04", dn: "2\"", mat: "A106 Gr.B" },
    ];

    let pulseOffset = 0;

    const render = () => {
      if (autoRotate) {
        rotation += 0.005;
      }
      pulseOffset = (pulseOffset + 1.5) % 100;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2 + 30;

      ctx.clearRect(0, 0, w, h);

      // Background Cyber Isometric Grid
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.05)';
      ctx.lineWidth = 1;

      const gridSize = 60 * zoom;
      for (let i = -10; i <= 10; i++) {
        // Iso grid line 30 deg
        ctx.beginPath();
        ctx.moveTo(cx + i * gridSize * Math.cos(Math.PI / 6), cy + i * gridSize * Math.sin(Math.PI / 6) - 200);
        ctx.lineTo(cx + i * gridSize * Math.cos(Math.PI / 6) - 500, cy + i * gridSize * Math.sin(Math.PI / 6) + 300);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - i * gridSize * Math.cos(Math.PI / 6), cy + i * gridSize * Math.sin(Math.PI / 6) - 200);
        ctx.lineTo(cx - i * gridSize * Math.cos(Math.PI / 6) + 500, cy + i * gridSize * Math.sin(Math.PI / 6) + 300);
        ctx.stroke();
      }

      // Project 3D to 2D Isometric Projection
      const project = (x: number, y: number, z: number) => {
        const rad = rotation;
        const rx = x * Math.cos(rad) - z * Math.sin(rad);
        const rz = x * Math.sin(rad) + z * Math.cos(rad);
        const ry = y;

        // Isometric conversion matrix
        const isoX = (rx - ry) * Math.cos(Math.PI / 6) * zoom;
        const isoY = (rx + ry) * Math.sin(Math.PI / 6) * zoom - rz * 0.8 * zoom;

        return { x: cx + isoX, y: cy + isoY, depth: rz };
      };

      const projectedNodes = nodes.map(n => ({ ...project(n.x, n.y, n.z), orig: n }));

      // Draw Edges (Pipes)
      edges.forEach((e) => {
        const p1 = projectedNodes[e.from];
        const p2 = projectedNodes[e.to];
        const isSelected = activeSegment === e.spool;

        // Pipe Shadow
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y + 15);
        ctx.lineTo(p2.x, p2.y + 15);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 12 * zoom;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main Pipe Tube Body
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isSelected ? '#f97316' : '#334155';
        ctx.lineWidth = 10 * zoom;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Inner Pipe Core Glow
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isSelected ? '#fdba74' : '#0ea5e9';
        ctx.lineWidth = 4 * zoom;
        ctx.stroke();

        // Animated Fluid Flow Particles inside pipe
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const steps = 4;
        for (let i = 0; i < steps; i++) {
          const t = ((pulseOffset / 100) + (i / steps)) % 1;
          const px = p1.x + dx * t;
          const py = p1.y + dy * t;

          ctx.beginPath();
          ctx.arc(px, py, 3 * zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = isSelected ? '#f97316' : '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Spool Callout Label at midpoint
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2 - 12;

        ctx.fillStyle = isSelected ? 'rgba(249, 115, 22, 0.9)' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isSelected ? '#f97316' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mx - 24, my - 10, 48, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.spool, mx, my);
      });

      // Draw Nodes (Components & Valves)
      projectedNodes.forEach((pn) => {
        const { x, y, orig } = pn;

        if (orig.type === 'valve') {
          // Gate Valve Handwheel & Body
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(x, y - 12 * zoom, 8 * zoom, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 12 * zoom);
          ctx.stroke();

          ctx.fillStyle = '#ea580c';
          ctx.beginPath();
          ctx.arc(x, y, 7 * zoom, 0, Math.PI * 2);
          ctx.fill();
        } else if (orig.type === 'flange') {
          // Flange Pair
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(x - 4 * zoom, y - 8 * zoom, 8 * zoom, 16 * zoom, 2);
          ctx.fill();
        } else {
          // Welded Joint Dot
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(x, y, 4 * zoom, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pulse ring around node
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, (8 + (pulseOffset % 12)) * zoom, 0, Math.PI * 2);
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [autoRotate, angle, zoom, activeSegment]);

  return (
    <div className={`relative w-full h-[500px] sm:h-[560px] lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-orange-500/30 bg-[#070a12] group ${className || ''}`}>
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent pointer-events-none" />

      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Overlay Title Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg pointer-events-auto">
          <Box className="w-4 h-4 text-orange-400 animate-pulse" />
          <div>
            <span className="text-xs font-bold text-white block leading-tight">Moteur Isométrique 3D PD&I</span>
            <span className="text-[10px] text-slate-400 font-mono">Modélisation & Spooling temps réel</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2.5 rounded-xl border transition-all ${
              autoRotate
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm'
                : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
            title="Rotation Automatique"
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setZoom(Math.min(zoom + 0.15, 1.8))}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
            title="Zoom Avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(Math.max(zoom - 0.15, 0.6))}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
            title="Zoom Arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Spool Selectors */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 pointer-events-auto">
        {["SPL-01", "SPL-02", "SPL-03", "SPL-04"].map((spool) => (
          <button
            key={spool}
            onClick={() => setActiveSegment(spool)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeSegment === spool
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-400'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {spool}
          </button>
        ))}
      </div>

      {/* Live Technical Specs Panel */}
      <div className="absolute bottom-4 right-4 hidden sm:flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-[11px] text-slate-300 shadow-xl pointer-events-auto max-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-0.5">
          <span className="font-bold text-orange-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3" /> Télémétrie Ligne
          </span>
          <span className="text-[9px] font-mono bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">VALIDE</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-slate-500">Pression :</span>
          <span className="text-white font-bold">72.4 bar</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-slate-500">Diamètre :</span>
          <span className="text-white font-bold">DN 150 (6")</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-slate-500">Norme :</span>
          <span className="text-white font-bold">ASME B31.3</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-slate-500">Matériau :</span>
          <span className="text-white font-bold">API 5L X52</span>
        </div>
      </div>
    </div>
  );
};


