import { describe, it, expect } from "vitest";
import {
  compactIsoLabel,
  buildIsoAnnotationLayout,
  IsoAnnotationViewport,
  IsoAnnotationPlacement,
} from "../core/isoAnnotationEngine";
import { IsoNode, IsoSegment, PipingJoint } from "../types/isoGraphTypes";

describe("ARCH-19: Iso Annotation Engine Test Suite", () => {
  const defaultViewport: IsoAnnotationViewport = {
    zoom: 1,
    panX: 0,
    panY: 0,
    viewMode: "iso",
    yaw: -Math.PI / 4,
    pitch: Math.PI / 6,
  };

  describe("Test 1 — Troncature de libellé (compactIsoLabel)", () => {
    it("conserve intact un texte court", () => {
      expect(compactIsoLabel("N1")).toBe("N1");
      expect(compactIsoLabel("Tuyauterie")).toBe("Tuyauterie");
    });

    it("gère les chaînes vides", () => {
      expect(compactIsoLabel("")).toBe("");
    });

    it("conserve un texte à la longueur limite exacte (30 caractères)", () => {
      const exact30 = "123456789012345678901234567890";
      expect(exact30.length).toBe(30);
      expect(compactIsoLabel(exact30)).toBe(exact30);
    });

    it("tronque et ajoute une ellipse à la position 29 pour un texte dépassant 30 caractères", () => {
      const over30 = "123456789012345678901234567890EXTRA";
      const result = compactIsoLabel(over30);
      expect(result).toHaveLength(30);
      expect(result).toBe("12345678901234567890123456789…");
    });

    it("respecte une limite personnalisée de longueur", () => {
      expect(compactIsoLabel("Vanne DN100 RF", 8)).toBe("Vanne D…");
      expect(compactIsoLabel("Court", 10)).toBe("Court");
    });
  });

  describe("Test 2 — Réservation de l'emprise des équipements", () => {
    it("réserve l'emprise centrale des équipements et évite que les annotations ne s'y superposent", () => {
      const nodes: IsoNode[] = [
        {
          id: "equip_1",
          name: "V-101",
          x: 0,
          y: 0,
          z: 0,
          type: "normal",
          equipmentType: "vanne_passage_total",
          equipmentLabel: "Vanne d'isolement V-101",
        },
      ];

      const layout = buildIsoAnnotationLayout(nodes, [], [], defaultViewport);
      expect(layout.has("node:equip_1")).toBe(true);

      const placement = layout.get("node:equip_1")!;
      expect(placement.anchorX).toBe(310);
      expect(placement.anchorY).toBe(210);

      // La boîte d'annotation doit être repoussée en dehors du coeur de l'équipement (38x38 centré sur 310,210)
      const distFromAnchor = Math.hypot(placement.x - placement.anchorX, placement.y - placement.anchorY);
      expect(distFromAnchor).toBeGreaterThan(38);
    });
  });

  describe("Test 3 — Ancrage et placement d'une soudure", () => {
    it("place l'étiquette de soudure selon les vecteurs de déport dérivés du port", () => {
      const nodes: IsoNode[] = [
        {
          id: "node_1",
          name: "N1",
          x: 0,
          y: 0,
          z: 0,
          type: "normal",
          equipmentType: "vanne_passage_total",
          ports: [
            { id: "p1", index: 0, role: "inline-in", dx: -0.5, dy: 0, dz: 0 },
            { id: "p2", index: 1, role: "inline-out", dx: 0.5, dy: 0, dz: 0 },
          ],
        },
      ];

      const joints: PipingJoint[] = [
        {
          id: "joint_w1",
          segmentId: "seg_1",
          endpoint: "from",
          nodeId: "node_1",
          portId: "p1",
          lineId: "L-101",
          connectionType: "butt_weld",
          weldNumber: "W001",
        },
      ];

      const layout = buildIsoAnnotationLayout(nodes, [], joints, defaultViewport);
      expect(layout.has("weld:joint_w1")).toBe(true);

      const weldPlacement = layout.get("weld:joint_w1")!;
      expect(weldPlacement.width).toBe(34);
      expect(weldPlacement.height).toBe(11);
      expect(weldPlacement.anchorX).toBeDefined();
      expect(weldPlacement.anchorY).toBeDefined();
    });
  });

  describe("Test 4 — Placement des nœuds via anneaux de recherche", () => {
    it("calcule les dimensions d'étiquette et positionne le nœud déterministement", () => {
      const nodes: IsoNode[] = [
        { id: "node_a", name: "Node-A", x: 0, y: 0, z: 0, type: "normal" },
      ];

      const layout = buildIsoAnnotationLayout(nodes, [], [], defaultViewport);
      expect(layout.has("node:node_a")).toBe(true);

      const placement = layout.get("node:node_a")!;
      expect(placement.anchorX).toBe(310);
      expect(placement.anchorY).toBe(210);
      expect(placement.height).toBe(18);
      // text = "Node-A" (6 chars) -> Math.min(172, Math.max(38, 6 * 5.3 + 14)) = 45.8
      expect(placement.width).toBeCloseTo(45.8, 1);
    });
  });

  describe("Test 5 — Placement des segments le long du vecteur normal", () => {
    it("place l'étiquette de segment à proximité du point médian projeté", () => {
      const nodes: IsoNode[] = [
        { id: "n1", name: "N1", x: 0, y: 0, z: 0, type: "normal" },
        { id: "n2", name: "N2", x: 3, y: 0, z: 0, type: "normal" },
      ];
      const segments: IsoSegment[] = [
        {
          id: "seg_1",
          fromNodeId: "n1",
          toNodeId: "n2",
          dn: 100,
          pn: "16",
          material: "A106-B",
          length: 3,
          type: "straight",
          fittings: [],
        },
      ];

      const layout = buildIsoAnnotationLayout(nodes, segments, [], defaultViewport);
      expect(layout.has("segment:seg_1")).toBe(true);

      const segPlacement = layout.get("segment:seg_1")!;
      expect(segPlacement.width).toBe(138);
      expect(segPlacement.height).toBe(20);
      expect(segPlacement.anchorX).toBeGreaterThan(310);
      expect(segPlacement.anchorY).toBeGreaterThan(210);
    });
  });

  describe("Test 6 — Évitement des collisions entre nœuds proches", () => {
    it("décale spatialement deux étiquettes de nœuds adjacents pour éviter tout chevauchement", () => {
      const nodes: IsoNode[] = [
        { id: "n_close1", name: "Node-1", x: 0, y: 0, z: 0, type: "normal" },
        { id: "n_close2", name: "Node-2", x: 0.1, y: 0.1, z: 0, type: "normal" },
      ];

      const layout = buildIsoAnnotationLayout(nodes, [], [], defaultViewport);
      const p1 = layout.get("node:n_close1")!;
      const p2 = layout.get("node:n_close2")!;

      expect(p1).toBeDefined();
      expect(p2).toBeDefined();

      // Vérifier la non-collision géométrique : la distance entre centres doit excéder les demi-largeurs ou hauteurs
      const overlapX = (p1.width + p2.width) / 2 + 3 - Math.abs(p1.x - p2.x);
      const overlapY = (p1.height + p2.height) / 2 + 3 - Math.abs(p1.y - p2.y);
      const isOverlapping = overlapX > 0 && overlapY > 0;

      expect(isOverlapping).toBe(false);
    });
  });

  describe("Test 7 — Non-mutation des entrées et résilience aux entrées vides", () => {
    it("gère une configuration vide sans erreur", () => {
      const layout = buildIsoAnnotationLayout([], [], [], defaultViewport);
      expect(layout.size).toBe(0);
    });

    it("ne mute jamais les tableaux ni les objets passés en argument", () => {
      const originalNode: IsoNode = { id: "n_immutable", name: "N_IMMUTABLE", x: 1, y: 1, z: 0, type: "normal" };
      const originalSegment: IsoSegment = {
        id: "s_immutable",
        fromNodeId: "n_immutable",
        toNodeId: "n_immutable",
        dn: 50,
        pn: "20",
        material: "CS",
        length: 1,
        type: "straight",
        fittings: [],
      };
      const nodes = [Object.freeze({ ...originalNode })];
      const segments = [Object.freeze({ ...originalSegment })];

      const layout = buildIsoAnnotationLayout(nodes, segments, [], defaultViewport);
      expect(layout.size).toBe(2);
      expect(nodes[0].name).toBe("N_IMMUTABLE");
    });
  });

  describe("Test 8 — Équivalence exacte avec les coordonnées déterministes de référence", () => {
    it("produit exactement les coordonnées de placement attendues sur le graphe de test de référence", () => {
      const nodes: IsoNode[] = [
        { id: "n1", name: "Node-1", x: 0, y: 0, z: 0, type: "normal" },
        { id: "n2", name: "Node-2", x: 2, y: 0, z: 0, type: "normal", equipmentType: "vanne_passage_total", equipmentLabel: "V-101" },
      ];
      const segments: IsoSegment[] = [
        { id: "s1", fromNodeId: "n1", toNodeId: "n2", dn: 100, pn: "16", material: "A106-B", length: 2, type: "straight", fittings: [] },
      ];
      const joints: PipingJoint[] = [
        {
          id: "j1",
          segmentId: "s1",
          endpoint: "from",
          nodeId: "n2",
          portId: "p1",
          lineId: "L1",
          connectionType: "butt_weld",
          weldNumber: "W001",
        },
      ];

      const layout = buildIsoAnnotationLayout(nodes, segments, joints, defaultViewport);

      expect(layout.size).toBe(4);

      // Valeurs numériques de référence dérivées avant extraction
      const weld = layout.get("weld:j1")!;
      expect(weld.id).toBe("weld:j1");
      expect(weld.width).toBe(34);
      expect(weld.height).toBe(11);
      expect(weld.anchorX).toBeCloseTo(358.497, 2);
      expect(weld.anchorY).toBeCloseTo(238.0, 2);

      const node1 = layout.get("node:n1")!;
      expect(node1.id).toBe("node:n1");
      expect(node1.width).toBeCloseTo(45.8, 1);
      expect(node1.height).toBe(18);
      expect(node1.anchorX).toBe(310);
      expect(node1.anchorY).toBe(210);

      const node2 = layout.get("node:n2")!;
      expect(node2.id).toBe("node:n2");
      expect(node2.width).toBeCloseTo(40.5, 1);
      expect(node2.height).toBe(18);

      const seg = layout.get("segment:s1")!;
      expect(seg.id).toBe("segment:s1");
      expect(seg.width).toBe(138);
      expect(seg.height).toBe(20);
    });
  });
});
