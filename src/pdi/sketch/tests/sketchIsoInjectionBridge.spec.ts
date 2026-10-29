/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-ISO-04-FIX-01 — UNIT & REGRESSION TEST SUITE:
 * PASSERELLE CROQUIS -> ISOMÉTRIQUE : DÉDUPLICATION, NORMALISATION ET COTES OCR
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import {
  useIsoInjection,
  consumePendingIsoPayload,
  prepareInjectedIsoGraph,
  clearProcessedTransferIds,
  isTransferProcessed,
  PDI_PENDING_INJECTION_KEY,
  PDI_ACTIVE_MODULE_KEY,
  EVENT_INJECT_ISO_GRAPH,
  EVENT_ACTIVE_MODULE_CHANGED,
  IsoInjectionPayload
} from "../../isometric/engine/useIsoInjection";
import { compileSketchToIsoModel } from "../sketchToJsonCompiler";
import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting
} from "../sketchRasterEngine";
import {
  DEMO_INITIAL_NODES,
  DEMO_INITIAL_SEGMENTS,
  DEMO_INITIAL_FITTINGS
} from "../demoSketchTemplate";

/**
 * Harness React 19 déterministe pour tester useIsoInjection dans Node/Vitest
 * sans dépendances externes lourdes tout en exécutant le vrai code de production.
 */
function renderReceiverHook(onCommit: (payload: any, sourceName?: string) => void) {
  let cleanupEffect: (() => void) | void;
  const dispatcher = {
    useRef: (init: any) => ({ current: init }),
    useEffect: (effect: () => (() => void) | void) => {
      cleanupEffect = effect();
    }
  };

  const internals =
    (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

  const prevDispatcher = internals?.H || internals?.ReactCurrentDispatcher?.current;
  if (internals) {
    if ("H" in internals) internals.H = dispatcher;
    else if (internals.ReactCurrentDispatcher) internals.ReactCurrentDispatcher.current = dispatcher;
  }

  try {
    useIsoInjection({ onCommit });
  } finally {
    if (internals) {
      if ("H" in internals) internals.H = prevDispatcher;
      else if (internals.ReactCurrentDispatcher) internals.ReactCurrentDispatcher.current = prevDispatcher;
    }
  }

  return {
    unmount: () => {
      if (typeof cleanupEffect === "function") cleanupEffect();
    }
  };
}

describe("SKETCH-ISO-04-FIX-01 : Passerelle Croquis -> Isométrique", () => {
  let storageStore: Record<string, string> = {};
  let originalWindow: any;
  let listeners: Record<string, ((e: any) => void)[]> = {};

  beforeEach(() => {
    clearProcessedTransferIds();
    storageStore = {};
    listeners = {};

    const mockStorage = {
      getItem: (key: string) => (key in storageStore ? storageStore[key] : null),
      setItem: (key: string, val: string) => {
        storageStore[key] = String(val);
      },
      removeItem: (key: string) => {
        delete storageStore[key];
      },
      clear: () => {
        for (const k of Object.keys(storageStore)) delete storageStore[k];
      }
    };

    const mockWindow = {
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      addEventListener: (event: string, cb: (e: any) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      },
      removeEventListener: (event: string, cb: (e: any) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }
      },
      dispatchEvent: (ev: any) => {
        const cbs = listeners[ev.type] || [];
        for (const cb of [...cbs]) {
          cb(ev);
        }
        return true;
      }
    };

    originalWindow = (global as any).window;
    (global as any).window = mockWindow;
  });

  const dispatchTestEvent = (type: string, detail?: any) => {
    (window as any).dispatchEvent({ type, detail });
  };

  afterEach(() => {
    (global as any).window = originalWindow;
    clearProcessedTransferIds();
  });

  // =========================================================================
  // OBJECTIF 1 / PARTIE A : IDEMPOTENCE ET DÉDUPLICATION STRICTE DU TRANSFERT
  // =========================================================================

  describe("A. Idempotence et déduplication de l'injection", () => {
    it("A1: Le même transferId reçu par le stockage puis par pdi:inject-iso-graph entraîne exactement un seul commit", () => {
      const transferId = "xfer_test_001";
      const payload: IsoInjectionPayload = {
        transferId,
        name: "L-100-PROC-01",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0, name: "N-1", type: "normal" }],
        segments: []
      };

      // 1. Écriture dans le storage (Canal Montage Initial / Storage)
      window.sessionStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));

      const commits: any[] = [];
      const onCommit = vi.fn((p) => commits.push(p));

      // Montage du récepteur : consommation du storage
      const hook = renderReceiverHook(onCommit);

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(isTransferProcessed(transferId)).toBe(true);

      // 2. Réception ultérieure de l'événement direct avec le même transferId
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, {
        data: payload,
        transferId,
        name: "L-100-PROC-01"
      });

      // Le double commit doit être strictement empêché !
      expect(onCommit).toHaveBeenCalledTimes(1);

      hook.unmount();
    });

    it("A2: Le même transfert ne provoque pas de deuxième commit si le récepteur est déjà monté", () => {
      const commits: any[] = [];
      const onCommit = vi.fn((p) => commits.push(p));

      // Récepteur déjà monté
      const hook = renderReceiverHook(onCommit);

      const transferId = "xfer_test_002";
      const payload: IsoInjectionPayload = {
        transferId,
        name: "L-200-HOT",
        nodes: [{ id: "n1", x: 10, y: 0, z: 0, name: "N-1", type: "normal" }],
        segments: []
      };

      // Premier événement direct reçu
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, { data: payload, transferId });

      expect(onCommit).toHaveBeenCalledTimes(1);

      // Deuxième événement direct avec le même transferId (ex: timeout de secours)
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, { data: payload, transferId });

      // Troisième alerte : active-module-changed
      dispatchTestEvent(EVENT_ACTIVE_MODULE_CHANGED, { activeModule: "isometric", transferId });

      expect(onCommit).toHaveBeenCalledTimes(1);

      hook.unmount();
    });

    it("A3: Le cas où le transfert commence avant le montage du récepteur est couvert", () => {
      const transferId = "xfer_test_003_pre";
      const payload: IsoInjectionPayload = {
        transferId,
        name: "L-300-PRE-MOUNT",
        nodes: [{ id: "n1", x: 5, y: 5, z: 0, name: "N-1", type: "normal" }],
        segments: []
      };

      // Écriture du storage avant montage
      window.localStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));
      window.sessionStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));

      const commits: any[] = [];
      const onCommit = vi.fn((p) => commits.push(p));

      // Le composant monte après
      const hook = renderReceiverHook(onCommit);

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(commits[0].name).toBe("L-300-PRE-MOUNT");
      expect(window.localStorage.getItem(PDI_PENDING_INJECTION_KEY)).toBeNull();
      expect(window.sessionStorage.getItem(PDI_PENDING_INJECTION_KEY)).toBeNull();

      hook.unmount();
    });

    it("A4: Un nouveau transferId permet un nouveau commit, même pour un graphe identique", () => {
      const commits: any[] = [];
      const onCommit = vi.fn((p) => commits.push(p));
      const hook = renderReceiverHook(onCommit);

      const graphData = {
        name: "L-400-RETRANSFER",
        nodes: [{ id: "n1", x: 100, y: 100, z: 0, name: "N-1", type: "normal" }],
        segments: []
      };

      // Transfert 1
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, {
        data: { ...graphData, transferId: "xfer_first" },
        transferId: "xfer_first"
      });
      expect(onCommit).toHaveBeenCalledTimes(1);

      // Transfert 2 volontaire de l'utilisateur avec un nouveau transferId
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, {
        data: { ...graphData, transferId: "xfer_second" },
        transferId: "xfer_second"
      });
      expect(onCommit).toHaveBeenCalledTimes(2);

      hook.unmount();
    });

    it("A5: Les clés pdi.pending_iso_injection sont supprimées correctement et synchroniquement après consommation", () => {
      const payload: IsoInjectionPayload = {
        transferId: "xfer_clean",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0, name: "N-1", type: "normal" }]
      };
      window.localStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));
      window.sessionStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));

      const consumed = consumePendingIsoPayload();
      expect(consumed).not.toBeNull();
      expect(consumed?.transferId).toBe("xfer_clean");
      expect(window.localStorage.getItem(PDI_PENDING_INJECTION_KEY)).toBeNull();
      expect(window.sessionStorage.getItem(PDI_PENDING_INJECTION_KEY)).toBeNull();
    });

    it("A6: Un payload vide ou invalide ne provoque pas de commit", () => {
      const onCommit = vi.fn();
      const hook = renderReceiverHook(onCommit);

      // 1. JSON corrompu dans storage
      window.localStorage.setItem(PDI_PENDING_INJECTION_KEY, "{corrupt_json: true");
      const bad = consumePendingIsoPayload();
      expect(bad).toBeNull();
      expect(onCommit).not.toHaveBeenCalled();

      // 2. Payload sans nœuds
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, {
        data: { name: "EMPTY", nodes: [] },
        transferId: "xfer_empty"
      });
      expect(onCommit).not.toHaveBeenCalled();

      // 3. Payload non objet ou null
      dispatchTestEvent(EVENT_INJECT_ISO_GRAPH, { data: null });
      expect(onCommit).not.toHaveBeenCalled();

      hook.unmount();
    });
  });

  // =========================================================================
  // OBJECTIF 2 / PARTIE B : NORMALISATION DU GRAPHE AVANT COMMIT
  // =========================================================================

  describe("B. Normalisation du graphe avant commit", () => {
    it("B1: Injection avec des fittings en ligne : segmente les tronçons et crée des nœuds équipements", () => {
      const rawPayload: IsoInjectionPayload = {
        name: "L-INLINE-FITTINGS",
        nodes: [
          { id: "n1", x: 0, y: 0, z: 0, name: "N-1", type: "normal" },
          { id: "n2", x: 2, y: 0, z: 0, name: "N-2", type: "normal" }
        ],
        segments: [
          {
            id: "s1",
            fromNodeId: "n1",
            toNodeId: "n2",
            length: 2,
            dn: 150,
            type: "straight",
            material: "Acier API 5L Gr. B",
            pressureClass: "Class 300",
            fittings: [
              {
                id: "fit_v1",
                type: "vanne_passage_total",
                label: "V-101",
                localPosition: 0.5,
                cumulativePosition: 1,
                dn: 150
              }
            ]
          }
        ]
      };

      const prepared = prepareInjectedIsoGraph(rawPayload);

      // Le fitting en ligne doit avoir été migré vers un nœud équipement intermédiaire (3 nœuds au total)
      expect(prepared.nodes.length).toBe(3);
      const eqNode = prepared.nodes.find((n) => n.equipmentType === "vanne_passage_total");
      expect(eqNode).toBeDefined();
      expect(eqNode?.equipmentLabel).toBe("V-101");
      expect(eqNode?.dn).toBe(150);

      // Le tronçon initial doit avoir été divisé en 2 sous-tronçons avec fittings vides
      expect(prepared.segments.length).toBe(2);
      for (const seg of prepared.segments) {
        expect(seg.fittings).toEqual([]);
        expect(seg.fromPortId).toBeDefined();
        expect(seg.toPortId).toBeDefined();
      }
    });

    it("B2: Injection avec des équipements rattachés à des nœuds : préserve type, label, tag, DN, PN et material", () => {
      const rawPayload: IsoInjectionPayload = {
        name: "L-EQUIPMENT-NODE",
        nodes: [
          {
            id: "n_valve",
            name: "V-200",
            x: 0,
            y: 0,
            z: 0,
            type: "normal",
            equipmentType: "vanne_soupape",
            equipmentLabel: "SOUPAPE SV-200",
            tag: "SV-200",
            dn: 100,
            pn: "Class 600",
            material: "Inox 316L"
          }
        ],
        segments: []
      };

      const prepared = prepareInjectedIsoGraph(rawPayload);
      expect(prepared.nodes.length).toBe(1);
      const n = prepared.nodes[0];
      expect(n.equipmentType).toBe("vanne_soupape");
      expect(n.equipmentLabel).toBe("SOUPAPE SV-200");
      expect(n.tag).toBe("SV-200");
      expect(n.dn).toBe(100);
      expect(n.pn).toBe("Class 600");
      expect(n.material).toBe("Inox 316L");
      // Des ports d'équipement doivent être automatiquement initialisés
      expect(n.ports).toBeDefined();
      expect(n.ports!.length).toBeGreaterThanOrEqual(2);
    });

    it("B3: Injection avec des équipements autonomes (standalone)", () => {
      const rawPayload: IsoInjectionPayload = {
        name: "L-STANDALONE-EQ",
        nodes: [
          {
            id: "n_standalone",
            name: "POMPE P-101",
            x: 1,
            y: 2,
            z: 0,
            type: "normal",
            equipmentType: "poste_sectionnement",
            equipmentLabel: "POMPE P-101"
          }
        ],
        segments: []
      };

      const prepared = prepareInjectedIsoGraph(rawPayload);
      expect(prepared.nodes.length).toBe(1);
      expect(prepared.nodes[0].id).toBe("n_standalone");
      expect(prepared.nodes[0].equipmentType).toBe("poste_sectionnement");
      expect(prepared.nodes[0].ports?.length).toBeGreaterThanOrEqual(2);
    });

    it("B4: Injection lorsque le graphe entrant et le graphe courant ont le même nombre de segments", () => {
      // Cas où le graphe entrant a 1 segment et le précédent avait 1 segment
      const rawPayload: IsoInjectionPayload = {
        name: "L-SAME-SEGMENT-COUNT",
        nodes: [
          { id: "a", x: 0, y: 0, z: 0, name: "A", type: "normal" },
          { id: "b", x: 1, y: 0, z: 0, name: "B", type: "normal" }
        ],
        segments: [
          {
            id: "s_ab",
            fromNodeId: "a",
            toNodeId: "b",
            length: 1,
            dn: 150,
            type: "straight",
            material: "Acier API 5L Gr. B",
            pressureClass: "Class 300",
            fittings: []
          }
        ]
      };

      const prepared = prepareInjectedIsoGraph(rawPayload);
      expect(prepared.segments.length).toBe(1);
      // Tous les ports doivent être normalisés immédiatement sans attendre un changement de segments.length
      expect(prepared.segments[0].fromPortId).toBeDefined();
      expect(prepared.segments[0].toPortId).toBeDefined();
      expect(prepared.nodes[0].ports?.length).toBeGreaterThan(0);
      expect(prepared.nodes[1].ports?.length).toBeGreaterThan(0);
    });

    it("B5: Présence de ports valides et réorientation des coudes", () => {
      const rawPayload: IsoInjectionPayload = {
        name: "L-ELBOWS",
        nodes: [
          { id: "n1", x: 0, y: 0, z: 0, name: "N1", type: "normal" },
          { id: "n2_elbow", x: 2, y: 0, z: 0, name: "N2", type: "normal", equipmentType: "coude_90" },
          { id: "n3", x: 2, y: 2, z: 0, name: "N3", type: "normal" }
        ],
        segments: [
          { id: "s1", fromNodeId: "n1", toNodeId: "n2_elbow", length: 2, dn: 150, type: "straight", material: "Acier", pressureClass: "Class 300", fittings: [] },
          { id: "s2", fromNodeId: "n2_elbow", toNodeId: "n3", length: 2, dn: 150, type: "straight", material: "Acier", pressureClass: "Class 300", fittings: [] }
        ]
      };

      const prepared = prepareInjectedIsoGraph(rawPayload);
      const elbowNode = prepared.nodes.find((n) => n.id === "n2_elbow");
      expect(elbowNode?.ports).toBeDefined();
      expect(elbowNode?.ports?.length).toBe(2);

      // Les segments doivent être reliés aux ports du coude
      const s1 = prepared.segments.find((s) => s.id === "s1");
      const s2 = prepared.segments.find((s) => s.id === "s2");
      expect(s1?.toPortId).toBeDefined();
      expect(s2?.fromPortId).toBeDefined();
    });

    it("B6: Conservation des lignes et dimensions transmises sans écrasement par défaut", () => {
      const customLine = {
        id: "line_custom_99",
        lineNumber: "L-CUSTOM-99",
        service: "PETROLE",
        dn: 200,
        nps: '8"',
        material: "Inox 304L",
        pressureClass: "Class 600",
        color: "#10B981"
      };

      const customDim = {
        id: "dim_custom_1",
        type: "distance" as const,
        a: { kind: "node" as const, nodeId: "n1" },
        b: { kind: "node" as const, nodeId: "n2" },
        label: "2000 mm",
        unit: "mm" as const
      };

      const rawPayload: IsoInjectionPayload = {
        name: "L-CUSTOM-DATA",
        nodes: [
          { id: "n1", x: 0, y: 0, z: 0, name: "N1", type: "normal" },
          { id: "n2", x: 2, y: 0, z: 0, name: "N2", type: "normal" }
        ],
        segments: [
          { id: "s1", fromNodeId: "n1", toNodeId: "n2", lineId: "line_custom_99", length: 2, dn: 200, type: "straight", material: "Inox 304L", pressureClass: "Class 600", fittings: [] }
        ],
        lines: [customLine],
        dimensions: [customDim]
      };

      const prepared = prepareInjectedIsoGraph(rawPayload);
      expect(prepared.lines.some((l) => l.id === "line_custom_99" && l.service === "PETROLE")).toBe(true);
      expect(prepared.dimensions.length).toBe(1);
      expect(prepared.dimensions[0].label).toBe("2000 mm");
    });

    it("B7: Plusieurs équipements affectés au même nœud : aucune perte silencieuse non signalée", () => {
      // Croquis avec deux fittings assignés au même nœud n_shared
      const nodes: SketchVectorNode[] = [
        { id: "n_shared", x: 100, y: 100, elevation: 0 }
      ];
      const segments: SketchVectorSegment[] = [];
      const fittings: SketchVectorFitting[] = [
        { id: "fit_1", nodeId: "n_shared", type: "valve", label: "V-101" },
        { id: "fit_2", nodeId: "n_shared", type: "flange", label: "BR-01" }
      ];

      const compiled = compileSketchToIsoModel({
        nodes,
        segments,
        fittings,
        calibrationScale: 0.25,
        title: "TEST-MULTI-EQ"
      });

      expect(compiled.nodes.length).toBe(1);
      const node = compiled.nodes[0];
      // Le label doit combiner les deux équipements
      expect(node.equipmentLabel).toContain("V-101");
      expect(node.equipmentLabel).toContain("BR-01");
      // Les notes doivent tracer le cumul
      expect(node.notes).toContain("Équipements multiples");
      // Les métadonnées doivent contenir un avertissement explicite
      expect(compiled.metadata.warnings).toBeDefined();
      expect(compiled.metadata.warnings?.some((w) => w.includes("multi-équipements"))).toBe(true);
    });
  });

  // =========================================================================
  // OBJECTIF 3 / PARTIE C : PRÉSERVATION DES COTES OCR SANS INVENTION GÉOMÉTRIQUE
  // =========================================================================

  describe("C. Préservation des cotes OCR sans géométrie inventée", () => {
    it("C1: Une annotation OCR valide conserve son texte, sa valeur millimétrique et sa provenance après compilation et transfert", () => {
      const ocrDims = [
        { text: "1250 mm (DN150)", valueMm: 1250 },
        { text: "800 mm", valueMm: 800 }
      ];

      const compiled = compileSketchToIsoModel({
        nodes: DEMO_INITIAL_NODES,
        segments: DEMO_INITIAL_SEGMENTS,
        fittings: DEMO_INITIAL_FITTINGS,
        calibrationScale: 0.25,
        title: "TEST-OCR-PRESERVE",
        ocrDimensions: ocrDims,
        transferId: "xfer_ocr_001"
      });

      // 1. Présence des annotations OCR dans le modèle compilé
      expect(compiled.ocrAnnotations).toBeDefined();
      expect(compiled.ocrAnnotations?.length).toBe(2);
      expect(compiled.ocrAnnotations?.[0].text).toBe("1250 mm (DN150)");
      expect(compiled.ocrAnnotations?.[0].valueMm).toBe(1250);
      expect(compiled.ocrAnnotations?.[0].source).toBe("ocr");

      // 2. Présence dans les métadonnées pour traçabilité de session
      expect(compiled.metadata.ocrDimensions).toBeDefined();
      expect(compiled.metadata.ocrDimensions?.length).toBe(2);

      // 3. Après préparation d'injection, la liste OCR reste intacte
      const prepared = prepareInjectedIsoGraph(compiled);
      expect(prepared.ocrAnnotations?.length).toBe(2);
      expect(prepared.ocrAnnotations?.[0].source).toBe("ocr");
    });

    it("C2: Les dimensions géométriques calculées restent distinctes des annotations OCR", () => {
      const ocrDims = [{ text: "999 mm (OCR)", valueMm: 999 }];

      const compiled = compileSketchToIsoModel({
        nodes: DEMO_INITIAL_NODES,
        segments: DEMO_INITIAL_SEGMENTS,
        fittings: DEMO_INITIAL_FITTINGS,
        calibrationScale: 0.25,
        title: "TEST-DISTINCT-DIMS",
        ocrDimensions: ocrDims
      });

      // Les dimensions du modèle isométrique doivent correspondre STRICTEMENT aux tronçons géométriques réels
      expect(compiled.dimensions.length).toBe(DEMO_INITIAL_SEGMENTS.length);
      for (const dim of compiled.dimensions) {
        expect(dim.type).toBe("distance");
        expect(dim.a.kind).toBe("node");
        expect(dim.b.kind).toBe("node");
        // Aucune dimension géométrique ne doit être polluée par la cote OCR 999
        expect(dim.label).not.toBe("999 mm (OCR)");
      }
    });

    it("C3: Une annotation OCR ne provoque pas la création artificielle d'une géométrie ou de points d'extrémité", () => {
      const ocrDims = [
        { text: "FAKE-LINE 5000 mm", valueMm: 5000 },
        { text: "GHOST-SEGMENT 3000 mm", valueMm: 3000 }
      ];

      const compiled = compileSketchToIsoModel({
        nodes: DEMO_INITIAL_NODES,
        segments: DEMO_INITIAL_SEGMENTS,
        fittings: DEMO_INITIAL_FITTINGS,
        calibrationScale: 0.25,
        title: "TEST-NO-FAKE-GEOM",
        ocrDimensions: ocrDims
      });

      // Le nombre de nœuds et de segments dans compiled doit être strictement identique aux entrées réelles
      expect(compiled.nodes.length).toBe(DEMO_INITIAL_NODES.length);
      expect(compiled.segments.length).toBe(DEMO_INITIAL_SEGMENTS.length);
      expect(compiled.metadata.totalPipesCount).toBe(DEMO_INITIAL_SEGMENTS.length);

      // Aucun nœud fictif créé pour porter la cote OCR
      const nodeLabels = compiled.nodes.map((n) => n.name);
      expect(nodeLabels.some((l) => l.includes("FAKE-LINE"))).toBe(false);
      expect(nodeLabels.some((l) => l.includes("GHOST-SEGMENT"))).toBe(false);
    });
  });
});
