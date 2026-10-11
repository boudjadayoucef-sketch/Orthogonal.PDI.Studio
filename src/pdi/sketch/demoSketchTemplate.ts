/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * DEMO CROQUIS ISOMÉTRIQUE SCAN A4 DE RÉFÉRENCE
 */
import { SketchVectorNode, SketchVectorSegment, SketchVectorFitting } from "./sketchRasterEngine";

// Generates a mock scan of an engineering sketch on grid paper for instant testing
export function generateDemoSketchImageDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1188;
  canvas.height = 840;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Grid background
  ctx.fillStyle = "#F8F6F0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Isometric light grid
  ctx.strokeStyle = "rgba(180, 190, 200, 0.4)";
  ctx.lineWidth = 0.8;
  const step = 35;
  for (let x = -canvas.height * 2; x < canvas.width * 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height * 1.732, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - canvas.height * 1.732, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Draw hand-drawn look piping sketch
  ctx.strokeStyle = "#1E293B";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Segment 1 (From Entry to Valve)
  ctx.beginPath();
  ctx.moveTo(180, 520);
  ctx.lineTo(420, 380);
  ctx.lineTo(720, 380);
  ctx.lineTo(920, 260);
  ctx.lineTo(920, 120);
  ctx.stroke();

  // Branch
  ctx.beginPath();
  ctx.moveTo(720, 380);
  ctx.lineTo(720, 560);
  ctx.stroke();

  // Valve symbol drawn by hand
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.fillText("DN150 - CL300", 250, 430);
  ctx.fillText("V-101 (VPT)", 540, 360);
  ctx.fillText("COUDE 90°", 880, 290);
  ctx.fillText("BRIDE WN", 130, 545);
  ctx.fillText("PURGE 1/2\"", 730, 580);

  // Border & Title block
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("ORTHOGONAL - ENG · CROQUIS RELEVÉ CHANTIER N°04 · ZONE UNIT-02", 50, 60);

  return canvas.toDataURL("image/png");
}

export const DEMO_INITIAL_NODES: SketchVectorNode[] = [
  { id: "node_1", x: 180, y: 520, elevation: 0, dn: 150, equipmentType: "bride_wn", equipmentLabel: "BR-01 (WN 300#)", label: "ENTRÉE BRIDE" },
  { id: "node_2", x: 420, y: 380, elevation: 0, dn: 150, equipmentType: "vanne_passage_total", equipmentLabel: "V-101", label: "VANNE V-101" },
  { id: "node_3", x: 720, y: 380, elevation: 0, dn: 150, equipmentType: "te_egal", equipmentLabel: "TE-01", label: "TÉ ÉGAL" },
  { id: "node_4", x: 920, y: 260, elevation: 0, dn: 150, equipmentType: "coude_90", equipmentLabel: "COUDE 90°", label: "COUDE 90°" },
  { id: "node_5", x: 920, y: 120, elevation: 1200, dn: 150, equipmentType: "poste_sectionnement", equipmentLabel: "BALLON V-201", label: "BALLON V-201" },
  { id: "node_6", x: 720, y: 560, elevation: -600, dn: 80, equipmentType: "purge", equipmentLabel: "PURGE 1/2\"", label: "PURGE 1/2\"" }
];

export const DEMO_INITIAL_SEGMENTS: SketchVectorSegment[] = [
  {
    id: "seg_1",
    fromNodeId: "node_1",
    toNodeId: "node_2",
    nominalDiameter: 150,
    pressureClass: "Class 300",
    material: "Acier API 5L Gr. B",
    lengthMm: 1250,
    angleIsoDeg: 30
  },
  {
    id: "seg_2",
    fromNodeId: "node_2",
    toNodeId: "node_3",
    nominalDiameter: 150,
    pressureClass: "Class 300",
    material: "Acier API 5L Gr. B",
    lengthMm: 1800,
    angleIsoDeg: 30
  },
  {
    id: "seg_3",
    fromNodeId: "node_3",
    toNodeId: "node_4",
    nominalDiameter: 150,
    pressureClass: "Class 300",
    material: "Acier API 5L Gr. B",
    lengthMm: 1100,
    angleIsoDeg: 30
  },
  {
    id: "seg_4",
    fromNodeId: "node_4",
    toNodeId: "node_5",
    nominalDiameter: 150,
    pressureClass: "Class 300",
    material: "Acier API 5L Gr. B",
    lengthMm: 1200,
    angleIsoDeg: 90
  },
  {
    id: "seg_5",
    fromNodeId: "node_3",
    toNodeId: "node_6",
    nominalDiameter: 80,
    pressureClass: "Class 300",
    material: "Acier API 5L Gr. B",
    lengthMm: 600,
    angleIsoDeg: 270
  }
];

export const DEMO_INITIAL_FITTINGS: SketchVectorFitting[] = [
  { id: "fit_1", nodeId: "node_1", type: "flange", label: "BR-01", nominalDiameter: 150 },
  { id: "fit_2", segmentId: "seg_2", type: "valve", label: "V-101", nominalDiameter: 150 },
  { id: "fit_3", nodeId: "node_3", type: "tee", label: "TE-01", nominalDiameter: 150 },
  { id: "fit_4", nodeId: "node_4", type: "elbow_90", label: "C90-01", nominalDiameter: 150 },
  { id: "fit_5", nodeId: "node_6", type: "instrument", label: "PI-202", nominalDiameter: 80 }
];
