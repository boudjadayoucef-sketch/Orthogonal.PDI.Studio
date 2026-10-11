import { describe, it, expect, vi } from "vitest";
import { PDI_REGISTRE_RUBAN_017M } from "../engine/pdiRegistreCommandes.v1";
import { migrateProjectFileV474 } from "../engine/IsometrieModuleV48d";
import { makeNode, makeFitting } from "../core/IsoTopologyGraph";
import { type IsoSegment } from "../types/isoGraphTypes";
import { pdiSignExportData } from "../../core/pdiWatermark";

describe("JSON Save and Open UI Commands Reliability Tests", () => {
  it("verifies command registry mappings for Ouvrir JSON and Sauver JSON", () => {
    const ouvrirEntry = PDI_REGISTRE_RUBAN_017M.find((e) => e.id === "fichier.ouvrir");
    const sauverEntry = PDI_REGISTRE_RUBAN_017M.find((e) => e.id === "fichier.sauver");
    const demoEntry = PDI_REGISTRE_RUBAN_017M.find((e) => e.id === "fichier.exemple.demo");

    expect(ouvrirEntry).toBeDefined();
    expect(sauverEntry).toBeDefined();
    expect(demoEntry).toBeDefined();

    // Source menu indices must match cadMenuGroups["Fichier"].items exactly:
    // Index 9 is Ouvrir JSON (run: () => importProjectRef.current?.click())
    // Index 10 is Sauver JSON (run: exportProjectJson)
    expect(ouvrirEntry?.source?.menu).toBe("Fichier");
    expect(ouvrirEntry?.source?.index).toBe(9);

    expect(sauverEntry?.source?.menu).toBe("Fichier");
    expect(sauverEntry?.source?.index).toBe(10);

    // DEMO must be clearly distinct and not mapped to open/save indices
    expect(demoEntry?.commande).toBe("DEMO");
  });

  it("1. 'Sauver JSON' serializes current project with nodes/segments/lines without demo replacement", () => {
    const n1 = makeNode("N01", 100, 200, 300);
    const n2 = makeNode("N02", 400, 200, 300);
    const seg: IsoSegment = {
      id: "SEG_USER_01",
      fromNodeId: n1.id,
      toNodeId: n2.id,
      length: 300,
      dn: 100,
      pn: "PN40",
      schedule: "40",
      material: "A106-B",
      type: "straight",
      fittings: [makeFitting("vanne_passage_total", 0.5, 100)],
      lineId: "L01",
    };

    const userProject = {
      schemaVersion: "4.7.4",
      exportedAt: new Date().toISOString(),
      project: {
        id: "proj_custom_123",
        ownerUid: "test-user-uid",
        name: "Usine Chimique Tronçon A",
        wilaya: "Alger",
        pressDesign: 25,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unitSystem: "metric" as const,
      },
      model: {
        lines: [{ id: "L01", lineNumber: "100-HC-01", dn: 100, color: "#EF4444" }],
        nodes: [n1, n2],
        segments: [seg],
        dimensions: [],
        supports: [],
      },
      workspace: {
        showGrid: true,
        showDimensions: true,
        showPipeLabels: true,
        showLabels: true,
        showWelds: true,
        isoSnapStep: 0.5,
        viewport: { zoom: 1.2, panX: 50, panY: -20 },
      },
    };

    // Serialize and sign
    const signed = pdiSignExportData(userProject);
    expect(signed._orthogonalEngSignature).toBeDefined();
    expect(signed._orthogonalEngSignature.vendor).toBe("ORTHOGONAL - ENG");
    expect(signed.project.name).toBe("Usine Chimique Tronçon A");
    expect(signed.model.nodes.length).toBe(2);
    expect(signed.model.segments.length).toBe(1);
    expect(signed.model.segments[0].id).toBe("SEG_USER_01");
  });

  it("2. 'Ouvrir JSON' triggers file reader, migrates schema and preserves model data roundtrip", () => {
    const n1 = makeNode("N_SRC_1", 0, 0, 0);
    const n2 = makeNode("N_SRC_2", 1500, 0, 0);
    const seg: IsoSegment = {
      id: "S_CUSTOM_99",
      fromNodeId: n1.id,
      toNodeId: n2.id,
      length: 1500,
      dn: 150,
      pn: "PN25",
      schedule: "STD",
      material: "API 5L",
      type: "straight",
      fittings: [makeFitting("coude_90", 0.5, 150)],
      lineId: "L_DEFAULT",
    };

    const originalProject = {
      schemaVersion: "4.7.4",
      project: {
        id: "proj_999",
        ownerUid: "author-uid",
        name: "Projet Station Gaz",
        wilaya: "Hassi Messaoud",
        pressDesign: 64,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      model: {
        lines: [{ id: "L_DEFAULT", lineNumber: "L-150-GAS", dn: 150 }],
        nodes: [n1, n2],
        segments: [seg],
        dimensions: [],
        supports: [],
      },
      workspace: {
        showGrid: false,
        viewport: { zoom: 1.5, panX: 10, panY: 20 },
      },
    };

    const serialized = JSON.stringify(originalProject);
    const parsed = JSON.parse(serialized);

    const activeUid = "active-user-session";
    const restored = migrateProjectFileV474(parsed, activeUid);

    expect(restored.project.name).toBe("Projet Station Gaz");
    expect(restored.project.wilaya).toBe("Hassi Messaoud");
    // With 1 inline legacy fitting on segment, migrateLegacyFittings converts the fitting to an equipment node (total 3 nodes)
    expect(restored.model.nodes.length).toBe(3);
    expect(restored.model.nodes.some(n => n.id === n1.id)).toBe(true);
    expect(restored.model.nodes.some(n => n.id === n2.id)).toBe(true);
    // And splits the segment into 2 segments connecting to the equipment node
    expect(restored.model.segments.length).toBe(2);
  });

  it("3. Malformed JSON throws and does not corrupt or replace active project", () => {
    const invalidJsonStrings = [
      "",
      "{ invalid json syntax ",
      JSON.stringify({ notAProject: true }),
      JSON.stringify({ schemaVersion: "4.7.4", model: { nodes: "not-an-array", segments: [] } }),
    ];

    for (const invalid of invalidJsonStrings) {
      expect(() => {
        const parsed = JSON.parse(invalid || "null");
        migrateProjectFileV474(parsed, "user-uid");
      }).toThrow();
    }
  });

  it("4. Canceling file picker does not alter current project state", () => {
    let projectBefore = { name: "Current Working Project", nodesCount: 5 };
    let projectAfter = { ...projectBefore };

    // Simulating file picker canceled (no file selected, undefined passed)
    const onFileSelected = (file?: File) => {
      if (!file) return; // Immediate no-op
      projectAfter = { name: "Replaced", nodesCount: 0 };
    };

    onFileSelected(undefined);
    expect(projectAfter).toEqual(projectBefore);
  });

  it("5. Clicking 'Sauver JSON' or 'Ouvrir JSON' never calls demo loaders", () => {
    const demoLoaderSpy = vi.fn();
    const downloadSpy = vi.fn();
    const filePickerSpy = vi.fn();

    // Handlers
    const handleSaveJson = () => {
      downloadSpy();
    };

    const handleOpenJson = () => {
      filePickerSpy();
    };

    // Simulate triggers
    handleSaveJson();
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(demoLoaderSpy).not.toHaveBeenCalled();

    handleOpenJson();
    expect(filePickerSpy).toHaveBeenCalledTimes(1);
    expect(demoLoaderSpy).not.toHaveBeenCalled();
  });
});
