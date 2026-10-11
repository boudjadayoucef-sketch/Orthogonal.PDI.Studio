import { describe, it, expect } from "vitest";
import {
  FITTING_LABELS,
  FITTING_TYPES,
  JOINT_Connection_TYPES,
  DIAMETER_BY_DN,
  WALL_BY_SCHEDULE,
  ISO_GRAPH_LIMITS,
  type IsoNode,
  type IsoSegment,
  type PipingLine,
} from "../types/isoGraphTypes";
import {
  DEFAULT_LINE_ID,
  pdiUid,
  pdiClamp,
  pdiDia,
  EQUIPMENT_NODE_TYPES,
  isEquipmentNode,
  equipmentLabel,
  elbowAngle,
  defaultFreeNodePorts,
  makeNode,
  makeFitting,
  defaultEquipmentPorts,
  equipmentPortConnectionType,
  makeEquipmentNode,
  pointOnSegment,
  portByIndex,
  availablePortId,
  portWorldPosition,
  segmentEndpoints,
  rotateWorldPoint,
  downstreamNodeIds,
  inferJointType,
  isWeldableConnection,
  deriveProjectJoints,
  validateProjectGraph,
  normalizedGraphPorts,
  cloneSegmentBetween,
  migrateLegacyFittings,
  cumulativeData,
  reorderFittings,
  materialRows,
  getFittingSvgGraphic,
} from "../core/IsoTopologyGraph";

describe("ARCH-12 — First Safe Modular Extraction: IsoGraphTypes & IsoTopologyGraph", () => {
  it("exports authoritative isometric graph constants and limits", () => {
    expect(FITTING_TYPES).toContain("coude_90");
    expect(FITTING_TYPES).toContain("vanne_passage_total");
    expect(FITTING_LABELS.coude_90).toBe("Coude 90° Grand Rayon LR (1.5D)");
    expect(JOINT_Connection_TYPES).toContain("butt_weld");
    expect(JOINT_Connection_TYPES).toContain("flanged");
    expect(DIAMETER_BY_DN[150].od).toBe(168.3);
    expect(WALL_BY_SCHEDULE["STD"]).toBeDefined();
    expect(ISO_GRAPH_LIMITS.MAX_NODES).toBe(500);
    expect(ISO_GRAPH_LIMITS.MAX_SEGMENTS).toBe(500);
    expect(EQUIPMENT_NODE_TYPES.has("coude_90")).toBe(true);
    expect(pdiClamp(1.5, 0, 1)).toBe(1);
    expect(pdiDia(150).inch).toBe('6"');
    expect(pdiUid("test")).toMatch(/^test_/);
  });

  it("computes elbow angles accurately from fitting type", () => {
    expect(elbowAngle("coude_90")).toBe(90);
    expect(elbowAngle("coude_45")).toBe(45);
    expect(elbowAngle("coude_180")).toBe(180);
    expect(elbowAngle("te_egal")).toBe(0);
  });

  it("creates free and equipment nodes with normalized ports and connection types", () => {
    const freeNode = makeNode("N-1", 0, 0, 0, "entree_poste");
    expect(freeNode.name).toBe("N-1");
    expect(freeNode.ports).toHaveLength(6);
    expect(isEquipmentNode(freeNode)).toBe(false);

    const flangeNode = makeEquipmentNode("bride_wn", "B-101", 10, 0, 0, 150, 0);
    expect(isEquipmentNode(flangeNode)).toBe(true);
    expect(equipmentLabel(flangeNode)).toBe("B-101");
    expect(flangeNode.ports).toHaveLength(2);
    expect(equipmentPortConnectionType("bride_wn", 0)).toBe("butt_weld");
    expect(equipmentPortConnectionType("bride_wn", 1)).toBe("flanged");

    const teePorts = defaultEquipmentPorts("te_egal");
    expect(teePorts).toHaveLength(3);
    expect(teePorts[2].role).toBe("branch");
  });

  it("computes port world positions and segment endpoints with face offsets", () => {
    const n1 = makeNode("Start", 0, 0, 0, "entree_poste");
    const valve = makeEquipmentNode("vanne_passage_total", "V-101", 5, 0, 0, 150, 0);
    valve.length = 0.4;
    const n2 = makeNode("End", 10, 0, 0, "sortie_poste");

    const seg1: IsoSegment = {
      id: "S1",
      fromNodeId: n1.id,
      toNodeId: valve.id,
      fromPortId: n1.ports![1].id,
      toPortId: valve.ports![0].id,
      length: 5,
      dn: 150,
      pn: "PN40",
      schedule: "STD",
      material: "API 5L Gr.B",
      type: "straight",
      fittings: [],
      lineId: DEFAULT_LINE_ID,
    };

    const seg2: IsoSegment = {
      id: "S2",
      fromNodeId: valve.id,
      toNodeId: n2.id,
      fromPortId: valve.ports![1].id,
      toPortId: n2.ports![0].id,
      length: 5,
      dn: 150,
      pn: "PN40",
      schedule: "STD",
      material: "API 5L Gr.B",
      type: "straight",
      fittings: [],
      lineId: DEFAULT_LINE_ID,
    };

    const nodes = [n1, valve, n2];
    const segments = [seg1, seg2];

    const pInWorld = portWorldPosition(valve, valve.ports![0].id, nodes, segments);
    expect(pInWorld.x).toBeCloseTo(4.8, 3);
    expect(pInWorld.y).toBeCloseTo(0, 3);

    const endpoints = segmentEndpoints(seg1, nodes, segments);
    expect(endpoints).not.toBeNull();
    expect(endpoints!.from.x).toBeCloseTo(0, 3);
    expect(endpoints!.to.x).toBeCloseTo(4.8, 3);
  });

  it("rotates 3D points in XY plane around pivot and discovers downstream connected nodes", () => {
    const rotated = rotateWorldPoint(
      { x: 10, y: 0, z: 5 },
      { x: 0, y: 0, z: 0 },
      90
    );
    expect(rotated.x).toBeCloseTo(0, 5);
    expect(rotated.y).toBeCloseTo(10, 5);
    expect(rotated.z).toBe(5);

    const segments: IsoSegment[] = [
      { id: "S1", fromNodeId: "N1", toNodeId: "N2", length: 2, dn: 150, pn: "PN40", schedule: "STD", material: "CS", type: "straight", fittings: [] },
      { id: "S2", fromNodeId: "N2", toNodeId: "N3", length: 2, dn: 150, pn: "PN40", schedule: "STD", material: "CS", type: "straight", fittings: [] },
      { id: "S3", fromNodeId: "N3", toNodeId: "N4", length: 2, dn: 150, pn: "PN40", schedule: "STD", material: "CS", type: "straight", fittings: [] },
    ];
    const downstream = downstreamNodeIds("N3", segments, "S2");
    expect(downstream.has("N3")).toBe(true);
    expect(downstream.has("N4")).toBe(true);
    expect(downstream.has("N1")).toBe(false);
  });

  it("derives project joints and validates project graph rules deterministically", () => {
    const n1 = makeEquipmentNode("bride_wn", "FLG-1", 0, 0, 0, 150);
    const n2 = makeEquipmentNode("coude_90", "ELB-1", 3, 0, 0, 150);
    const n3 = makeNode("END-1", 3, 3, 0, "sortie_poste");

    const segments: IsoSegment[] = [
      {
        id: "S1",
        fromNodeId: n1.id,
        toNodeId: n2.id,
        fromPortId: n1.ports![1].id, // flanged
        toPortId: n2.ports![0].id, // butt_weld
        length: 3,
        dn: 150,
        pn: "PN40",
        schedule: "STD",
        material: "API 5L Gr.B",
        type: "straight",
        fittings: [],
        lineId: DEFAULT_LINE_ID,
      },
      {
        id: "S2",
        fromNodeId: n2.id,
        toNodeId: n3.id,
        fromPortId: n2.ports![1].id, // butt_weld
        toPortId: n3.ports![0].id,
        length: 3,
        dn: 150,
        pn: "PN40",
        schedule: "STD",
        material: "API 5L Gr.B",
        type: "straight",
        fittings: [],
        lineId: DEFAULT_LINE_ID,
      },
    ];

    const lines: PipingLine[] = [
      {
        id: DEFAULT_LINE_ID,
        lineNumber: "150-G-001",
        service: "GAZ NATUREL",
        dn: 150,
        schedule: "STD",
        material: "API 5L Gr.B",
        designPressure: 68,
        designTemperature: 50,
      },
    ];

    expect(inferJointType(n1, n1.ports![1].id)).toBe("flanged");
    expect(inferJointType(n2, n2.ports![0].id)).toBe("butt_weld");
    expect(isWeldableConnection("butt_weld")).toBe(true);
    expect(isWeldableConnection("flanged")).toBe(false);

    const joints = deriveProjectJoints([n1, n2, n3], segments);
    expect(joints).toHaveLength(4);
    expect(joints.some((j) => j.weldNumber === "W01")).toBe(true);

    const issues = validateProjectGraph([n1, n2, n3], segments, lines);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("detects topological errors such as zero-length segments and isolated equipment", () => {
    const n1 = makeNode("A", 0, 0, 0);
    const n2 = makeNode("B", 0, 0, 0);
    const isolated = makeEquipmentNode("vanne_passage_total", "VB-ISO", 5, 5, 0, 150);

    const segments: IsoSegment[] = [
      {
        id: "S-ZERO",
        fromNodeId: n1.id,
        toNodeId: n2.id,
        fromPortId: n1.ports![0].id,
        toPortId: n2.ports![0].id,
        length: 0,
        dn: 150,
        pn: "PN40",
        schedule: "STD",
        material: "CS",
        type: "straight",
        fittings: [],
        lineId: DEFAULT_LINE_ID,
      },
    ];
    const lines: PipingLine[] = [
      {
        id: DEFAULT_LINE_ID,
        lineNumber: "150-G-001",
        service: "GAZ",
        dn: 150,
        schedule: "STD",
        material: "CS",
        designPressure: 40,
        designTemperature: 40,
      },
    ];

    const issues = validateProjectGraph([n1, n2, isolated], segments, lines);
    expect(issues.some((i) => i.code === "ZERO_LENGTH")).toBe(true);
    expect(issues.some((i) => i.code === "ISOLATED_EQUIPMENT")).toBe(true);
  });

  it("migrates legacy fittings to topological nodes and computes cumulative distances and BOM material rows", () => {
    const n1 = makeNode("Start", 0, 0, 0, "entree_poste");
    const n2 = makeNode("End", 10, 0, 0, "sortie_poste");
    const legacyFit = makeFitting("vanne_passage_total", 0.5, 150);
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
      fittings: [legacyFit],
    };

    const migrated = migrateLegacyFittings([n1, n2], [seg]);
    expect(migrated.changed).toBe(true);
    expect(migrated.nodes).toHaveLength(3);
    expect(migrated.segments).toHaveLength(2);
    expect(migrated.segments[0].fittings).toHaveLength(0);

    const normalized = normalizedGraphPorts(migrated.nodes, migrated.segments);
    expect(pointOnSegment(n1, n2, 0.5)).toEqual({ x: 5, y: 0, z: 0 });
    expect(portByIndex(normalized.nodes[0], 0)).toBeDefined();
    expect(availablePortId(normalized.nodes[0], normalized.segments, 2)).toBeDefined();

    const cum = cumulativeData(normalized.nodes, normalized.segments);
    expect(cum.starts.get(n1.id)).toBe(0);
    expect(cum.starts.get(n2.id)).toBeCloseTo(10, 3);

    const rows = materialRows(normalized.nodes, normalized.segments);
    expect(rows.some((r) => r.fittingType === "vanne_passage_total")).toBe(true);
    expect(rows.filter((r) => r.fittingType === "pipe")).toHaveLength(2);

    const cloned = cloneSegmentBetween(normalized.segments[0], n1.id, n2.id, 4.25);
    expect(cloned.length).toBe(4.25);

    const f1 = makeFitting("coude_90", 0.2, 150);
    const f2 = makeFitting("te_egal", 0.8, 150);
    const reordered = reorderFittings([f1, f2], 0, 1);
    expect(reordered[0].id).toBe(f2.id);

    const svg = getFittingSvgGraphic("vanne_passage_total", false);
    expect(typeof svg).toBe("string");
    expect(svg.length).toBeGreaterThan(10);
  });
});
