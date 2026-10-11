import { describe, it, expect } from "vitest";
import { generateDxfFile } from "../serialization/dxfSerialization";
import { makeNode, makeEquipmentNode, makeFitting } from "../core/IsoTopologyGraph";
import type { IsoSegment } from "../types/isoGraphTypes";

describe("ARCH-14 — DXF Serialization & Export Engine", () => {
  it("generates valid DXF ASCII structure with entities for nodes, equipment, segments and fittings", () => {
    const n1 = makeNode("Start", 0, 0, 0, "entree_poste");
    const valve = makeEquipmentNode("vanne_passage_total", "V-101", 5, 0, 0, 150, 0);
    const n2 = makeNode("End", 10, 0, 0, "sortie_poste");

    const fitting = makeFitting("coude_90", 0.5, 150);

    const seg: IsoSegment = {
      id: "S1",
      fromNodeId: n1.id,
      toNodeId: valve.id,
      length: 5,
      dn: 150,
      pn: "PN40",
      schedule: "STD",
      material: "API 5L Gr.B",
      type: "straight",
      fittings: [fitting],
      lineId: "line_default",
    };

    const dxf = generateDxfFile([n1, valve, n2], [seg]);

    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("ENTITIES");
    expect(dxf).toContain("PIPING_LINES");
    expect(dxf).toContain("PIPING_FITTINGS");
    expect(dxf).toContain("PIPING_EQUIPMENTS");
    expect(dxf).toContain("PIPING_NODES");
    expect(dxf).toContain("EOF");
    expect(dxf).toContain("5000");
  });
});
