/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * ARCH-14: DXF SERIALIZATION & EXPORT ENGINE.
 */

import type { IsoNode, IsoSegment } from "../types/isoGraphTypes";
import { equipmentLabel } from "../core/IsoTopologyGraph";

export function generateDxfFile(nodesList: IsoNode[], segmentsList: IsoSegment[]): string {
  let dxf = `  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n  0\nSECTION\n  2\nTABLES\n  0\nENDSEC\n  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC\n  0\nSECTION\n  2\nENTITIES\n`;

  // 1. Export Segments and Segment-based Fittings
  segmentsList.forEach((seg: any) => {
    const nodeA = nodesList.find(n => n.id === seg.fromNodeId);
    const nodeB = nodesList.find(n => n.id === seg.toNodeId);
    if (nodeA && nodeB) {
      const x1 = (nodeA.x || 0) * 1000;
      const y1 = (nodeA.y || 0) * 1000;
      const z1 = (nodeA.z || 0) * 1000;
      const x2 = (nodeB.x || 0) * 1000;
      const y2 = (nodeB.y || 0) * 1000;
      const z2 = (nodeB.z || 0) * 1000;

      // Export segment line
      dxf += `  0\nLINE\n  8\nPIPING_LINES\n`;
      dxf += ` 10\n${x1}\n 20\n${y1}\n 30\n${z1}\n`;
      dxf += ` 11\n${x2}\n 21\n${y2}\n 31\n${z2}\n`;

      // Export segment fittings (instruments, valves, flanges etc.)
      if (seg.fittings && Array.isArray(seg.fittings)) {
        seg.fittings.forEach((f: any) => {
          const t = typeof f.localPosition === "number" ? f.localPosition : 0.5;
          const fx = x1 + (x2 - x1) * t;
          const fy = y1 + (y2 - y1) * t;
          const fz = z1 + (z2 - z1) * t;

          // POINT representing the instrument/fitting
          dxf += `  0\nPOINT\n  8\nPIPING_FITTINGS\n`;
          dxf += ` 10\n${fx}\n 20\n${fy}\n 30\n${fz}\n`;

          // TEXT label for the instrument/fitting
          const labelText = f.label || f.type || "Accessoire";
          dxf += `  0\nTEXT\n  8\nPIPING_FITTINGS_LABELS\n`;
          dxf += ` 10\n${fx + 100}\n 20\n${fy + 100}\n 30\n${fz}\n`;
          dxf += ` 40\n120\n  1\n${labelText}\n`;
        });
      }
    }
  });

  // 2. Export Nodes and Node-based Equipment
  nodesList.forEach((node: any) => {
    const x = (node.x || 0) * 1000;
    const y = (node.y || 0) * 1000;
    const z = (node.z || 0) * 1000;

    if (node.equipmentType) {
      // Equipment/Instrument Node
      dxf += `  0\nPOINT\n  8\nPIPING_EQUIPMENTS\n`;
      dxf += ` 10\n${x}\n 20\n${y}\n 30\n${z}\n`;

      const equipLabel = equipmentLabel(node);
      const tagPart = node.tag ? ` [${node.tag}]` : "";
      const fullLabel = `${equipLabel}${tagPart}`;

      dxf += `  0\nTEXT\n  8\nPIPING_EQUIPMENTS_LABELS\n`;
      dxf += ` 10\n${x + 100}\n 20\n${y + 100}\n 30\n${z}\n`;
      dxf += ` 40\n150\n  1\n${fullLabel}\n`;
    } else {
      // Normal Node
      dxf += `  0\nPOINT\n  8\nPIPING_NODES\n`;
      dxf += ` 10\n${x}\n 20\n${y}\n 30\n${z}\n`;

      const nodeLabelText = node.name || "Noeud";
      dxf += `  0\nTEXT\n  8\nPIPING_NODES_LABELS\n`;
      dxf += ` 10\n${x + 100}\n 20\n${y + 100}\n 30\n${z}\n`;
      dxf += ` 40\n100\n  1\n${nodeLabelText}\n`;
    }
  });

  dxf += `  0\nENDSEC\n  0\nEOF\n`;
  return dxf;
}
