import { describe, it, expect } from "vitest";
import { generateDxfFile } from "../serialization/dxfSerialization";
import { makeNode, makeFitting } from "../core/IsoTopologyGraph";
import { type IsoSegment } from "../types/isoGraphTypes";
import { migrateProjectFileV474 } from "../engine/IsometrieModuleV48d";
import { generateIsoDrawingSvg } from "../../impression/isoSvgGenerator";
import { type IsoPrintConfig } from "../../impression/isoSheetStandards";

describe("ARCH-14-FIX-01 — Import/Export Reliability Tests", () => {
  it("verifies basic DXF serialization entities and structure", () => {
    const n1 = makeNode("Start", 0, 0, 0);
    const n2 = makeNode("End", 10, 0, 0);
    const seg: IsoSegment = {
      id: "S1",
      fromNodeId: n1.id,
      toNodeId: n2.id,
      length: 10,
      dn: 150,
      pn: "PN40",
      schedule: "STD",
      material: "API 5L Gr.B",
      type: "straight",
      fittings: [makeFitting("coude_90", 0.5, 150)],
      lineId: "line_default",
    };
    const dxf = generateDxfFile([n1, n2], [seg]);
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("PIPING_LINES");
    expect(dxf).toContain("PIPING_FITTINGS");
  });

  it("verifies JSON project file migration structure", () => {
    const mockJson = {
      schemaVersion: "4.7.4",
      project: { id: "p1", name: "test", ownerUid: "u1" },
      model: { nodes: [], segments: [], lines: [] }
    };
    const migrated = migrateProjectFileV474(mockJson, "u1");
    expect(migrated.schemaVersion).toBe("4.7.4");
  });

  it("verifies SVG generation basics", () => {
    const nodes: any[] = [];
    const segments: any[] = [];
    const config: IsoPrintConfig = {
      format: "A3" as const,
      orientation: "landscape" as const,
      scale: "1:20",
      showCartoucheIso7200: true,
      showAdaptiveLegend: true,
      showIso5457Grid: true,
      showWatermarkFootprint: true,
      showBomTable: true,
      showDimensions: true,
      showWelds: true,
      showPipeLabels: true,
      documentTitle: "Test Title",
      documentNumber: "DOC-001",
      revision: "A",
      drawnBy: "User",
      checkedBy: "User",
      approvedBy: "Approver",
      pageNumber: 1,
      totalPages: 1,
      printScope: "all",
      showSupports: false,
      showCivilEngineering: false,
      showSupportTable: false,
    };
    const result = generateIsoDrawingSvg(nodes, segments, [], [], [], config);
    expect(result.svgMarkup).toContain("<svg");
    expect(result.svgMarkup).toContain("</svg>");
  });
});
