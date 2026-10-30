/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-ISO-04-FIX-02 — UNIT & INTEGRATION TEST SUITE:
 * CLÔTURE DES DÉFAUTS RÉSIDUELS SKETCH -> ISO
 *
 * Suites testées :
 * A1-A6 : Déduplication et reprise après échec (useIsoInjection)
 * B1-B7 : Indépendance et tolérance aux pannes des stockages (consumePendingIsoPayload)
 * C1-C6 : Résolution géométrique et placement des accessoires (resolveFittingPlacementTarget, projectPointOnSegment)
 * D1-D6 : Retour MANUELLE vers AUTO (resetSegmentToAutoLength, ReviewTable, syncs et compilation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import {
  useIsoInjection,
  consumePendingIsoPayload,
  clearProcessedTransferIds,
  isTransferProcessed,
  isTransferInProgress,
  PDI_PENDING_INJECTION_KEY,
  IsoInjectionPayload,
  EVENT_INJECT_ISO_GRAPH
} from "../../isometric/engine/useIsoInjection";
import {
  SketchPoint2D,
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  projectPointOnSegment,
  resolveFittingPlacementTarget,
  resetSegmentToAutoLength,
  syncSegmentsOnNodeMove,
  syncSegmentsOnCalibrationChange
} from "../sketchRasterEngine";
import { resolveSegmentDisplayLengthMm } from "../SketchReviewTable";
import { compileSketchToIsoModel } from "../sketchToJsonCompiler";

/**
 * Harness React 19 déterministe pour tester useIsoInjection dans Node/Vitest
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

describe("SKETCH-ISO-04-FIX-02 : Clôture des défauts résiduels SKETCH -> ISO", () => {
  let originalWindow: any;

  beforeEach(() => {
    clearProcessedTransferIds();
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
    clearProcessedTransferIds();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SUITE A : DÉDUPLICATION ET REPRISE APRÈS ÉCHEC (useIsoInjection)
  // =========================================================================
  describe("Correction A : Déduplication et reprise après échec", () => {
    it("A1: Un échec pendant onCommit ne verrouille pas définitivement le transferId et autorise le réessai", () => {
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const mockWindow: any = {
        addEventListener: (event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((f) => f !== cb);
          }
        },
        sessionStorage: { getItem: () => null, removeItem: () => {} },
        localStorage: { getItem: () => null, removeItem: () => {} }
      };
      global.window = mockWindow;

      let callCount = 0;
      let shouldThrow = true;
      const onCommitMock = vi.fn((_payload: any) => {
        callCount++;
        if (shouldThrow) {
          throw new Error("Simulation: Consumer commit failure!");
        }
      });

      renderReceiverHook(onCommitMock);

      const payload: IsoInjectionPayload = {
        transferId: "tx-retry-01",
        name: "Test Retry",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0 }],
        segments: []
      };

      // 1er envoi : échoue
      expect(() => {
        listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
          cb({ detail: { data: payload, transferId: "tx-retry-01" } });
        });
      }).toThrow("Simulation: Consumer commit failure!");

      expect(callCount).toBe(1);
      // Le transfert ne doit PAS être marqué comme traité puisqu'il a échoué
      expect(isTransferProcessed("tx-retry-01")).toBe(false);
      expect(isTransferInProgress("tx-retry-01")).toBe(false);

      // 2e envoi : cette fois le consommateur réussit
      shouldThrow = false;
      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({ detail: { data: payload, transferId: "tx-retry-01" } });
      });

      expect(callCount).toBe(2);
      expect(isTransferProcessed("tx-retry-01")).toBe(true);
      expect(isTransferInProgress("tx-retry-01")).toBe(false);
    });

    it("A2: Bloque l'exécution concurrente / réentrante pour le même transferId", () => {
      let dispatchConcurrentCall: (() => void) | null = null;
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const mockWindow: any = {
        addEventListener: (event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((f) => f !== cb);
          }
        },
        sessionStorage: { getItem: () => null, removeItem: () => {} },
        localStorage: { getItem: () => null, removeItem: () => {} }
      };
      global.window = mockWindow;

      let commitCalls = 0;
      const onCommitMock = vi.fn(() => {
        commitCalls++;
        expect(isTransferInProgress("tx-concurrent-01")).toBe(true);
        // Tente un appel réentrant avec le même transferId
        if (dispatchConcurrentCall) {
          dispatchConcurrentCall();
        }
      });

      renderReceiverHook(onCommitMock);

      const payload: IsoInjectionPayload = {
        transferId: "tx-concurrent-01",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0 }],
        segments: []
      };

      dispatchConcurrentCall = () => {
        listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
          cb({ detail: { data: payload, transferId: "tx-concurrent-01" } });
        });
      };

      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({ detail: { data: payload, transferId: "tx-concurrent-01" } });
      });

      // Le commit réentrant doit avoir été bloqué
      expect(commitCalls).toBe(1);
      expect(isTransferProcessed("tx-concurrent-01")).toBe(true);
      expect(isTransferInProgress("tx-concurrent-01")).toBe(false);
    });

    it("A3: Un commit réussi marque le transferId comme traité et empêche une double injection future", () => {
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const mockWindow: any = {
        addEventListener: (event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((f) => f !== cb);
          }
        },
        sessionStorage: { getItem: () => null, removeItem: () => {} },
        localStorage: { getItem: () => null, removeItem: () => {} }
      };
      global.window = mockWindow;

      const onCommitMock = vi.fn();
      renderReceiverHook(onCommitMock);

      const payload: IsoInjectionPayload = {
        transferId: "tx-success-01",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0 }],
        segments: []
      };

      // 1er envoi
      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({ detail: { data: payload, transferId: "tx-success-01" } });
      });

      expect(onCommitMock).toHaveBeenCalledTimes(1);
      expect(isTransferProcessed("tx-success-01")).toBe(true);

      // 2e envoi avec le même transferId
      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({ detail: { data: payload, transferId: "tx-success-01" } });
      });

      expect(onCommitMock).toHaveBeenCalledTimes(1);
    });

    it("A4: Un payload vide ou sans nœuds ne déclenche aucun commit et ne verrouille pas le transferId", () => {
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const mockWindow: any = {
        addEventListener: (event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: () => {},
        sessionStorage: { getItem: () => null, removeItem: () => {} },
        localStorage: { getItem: () => null, removeItem: () => {} }
      };
      global.window = mockWindow;

      const onCommitMock = vi.fn();
      renderReceiverHook(onCommitMock);

      // Payload sans nœuds
      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({ detail: { data: { transferId: "tx-invalid-01", nodes: [] } } });
      });

      expect(onCommitMock).not.toHaveBeenCalled();
      expect(isTransferProcessed("tx-invalid-01")).toBe(false);
      expect(isTransferInProgress("tx-invalid-01")).toBe(false);
    });

    it("A5: isTransferInProgress retourne true uniquement pendant l'exécution", () => {
      let inspectedInside = false;
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const mockWindow: any = {
        addEventListener: (event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: () => {},
        sessionStorage: { getItem: () => null, removeItem: () => {} },
        localStorage: { getItem: () => null, removeItem: () => {} }
      };
      global.window = mockWindow;

      const onCommitMock = vi.fn(() => {
        inspectedInside = isTransferInProgress("tx-inspect-01");
      });

      renderReceiverHook(onCommitMock);

      expect(isTransferInProgress("tx-inspect-01")).toBe(false);

      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({
          detail: {
            data: {
              transferId: "tx-inspect-01",
              nodes: [{ id: "n1", x: 0, y: 0, z: 0 }]
            }
          }
        });
      });

      expect(inspectedInside).toBe(true);
      expect(isTransferInProgress("tx-inspect-01")).toBe(false);
    });

    it("A6: clearProcessedTransferIds réinitialise processedTransferIds et inProgressTransferIds", () => {
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const mockWindow: any = {
        addEventListener: (event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: () => {},
        sessionStorage: { getItem: () => null, removeItem: () => {} },
        localStorage: { getItem: () => null, removeItem: () => {} }
      };
      global.window = mockWindow;

      const onCommitMock = vi.fn();
      renderReceiverHook(onCommitMock);

      listeners[EVENT_INJECT_ISO_GRAPH]?.forEach((cb) => {
        cb({
          detail: {
            data: {
              transferId: "tx-clear-01",
              nodes: [{ id: "n1", x: 0, y: 0, z: 0 }]
            }
          }
        });
      });

      expect(isTransferProcessed("tx-clear-01")).toBe(true);

      clearProcessedTransferIds();

      expect(isTransferProcessed("tx-clear-01")).toBe(false);
      expect(isTransferInProgress("tx-clear-01")).toBe(false);
    });
  });

  // =========================================================================
  // SUITE B : INDÉPENDANCE DES STOCKAGES (consumePendingIsoPayload)
  // =========================================================================
  describe("Correction B : Indépendance des stockages", () => {
    it("B1: sessionStorage corrompu (JSON invalide) et localStorage valide -> retourne localStorage et nettoie sessionStorage", () => {
      let sessionRemoved = false;
      let localRemoved = false;

      const validLocalPayload: IsoInjectionPayload = {
        transferId: "tx-local-valid",
        name: "From LocalStorage",
        nodes: [{ id: "n1", x: 10, y: 20, z: 0 }],
        segments: []
      };

      global.window = {
        sessionStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? "{corrupt-invalid-json" : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) sessionRemoved = true;
          }
        },
        localStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? JSON.stringify(validLocalPayload) : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) localRemoved = true;
          }
        }
      } as any;

      const consumed = consumePendingIsoPayload();

      expect(consumed).not.toBeNull();
      expect(consumed?.transferId).toBe("tx-local-valid");
      expect(sessionRemoved).toBe(true); // Purge de l'entrée corrompue
      expect(localRemoved).toBe(true); // Purge de l'entrée valide consommée
    });

    it("B2: sessionStorage valide et localStorage corrompu -> retourne sessionStorage et nettoie localStorage", () => {
      let sessionRemoved = false;
      let localRemoved = false;

      const validSessionPayload: IsoInjectionPayload = {
        transferId: "tx-session-valid",
        name: "From SessionStorage",
        nodes: [{ id: "n1", x: 30, y: 40, z: 0 }],
        segments: []
      };

      global.window = {
        sessionStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? JSON.stringify(validSessionPayload) : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) sessionRemoved = true;
          }
        },
        localStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? "not a valid json" : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) localRemoved = true;
          }
        }
      } as any;

      const consumed = consumePendingIsoPayload();

      expect(consumed).not.toBeNull();
      expect(consumed?.transferId).toBe("tx-session-valid");
      expect(sessionRemoved).toBe(true);
      expect(localRemoved).toBe(true);
    });

    it("B3: Les deux stockages valides -> priorité absolue à sessionStorage et purge des deux", () => {
      let sessionRemoved = false;
      let localRemoved = false;

      const sessionPayload: IsoInjectionPayload = {
        transferId: "tx-session-prio",
        name: "Session Priority",
        nodes: [{ id: "n_sess", x: 1, y: 1, z: 0 }]
      };
      const localPayload: IsoInjectionPayload = {
        transferId: "tx-local-old",
        name: "Local Stale",
        nodes: [{ id: "n_loc", x: 2, y: 2, z: 0 }]
      };

      global.window = {
        sessionStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? JSON.stringify(sessionPayload) : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) sessionRemoved = true;
          }
        },
        localStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? JSON.stringify(localPayload) : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) localRemoved = true;
          }
        }
      } as any;

      const consumed = consumePendingIsoPayload();

      expect(consumed).not.toBeNull();
      expect(consumed?.transferId).toBe("tx-session-prio");
      expect(sessionRemoved).toBe(true);
      expect(localRemoved).toBe(true);
    });

    it("B4: Les deux stockages invalides / vides / sans nœuds -> retourne null et nettoie les entrées corrompues", () => {
      let sessionRemoved = false;
      let localRemoved = false;

      global.window = {
        sessionStorage: {
          getItem: () => JSON.stringify({ transferId: "empty-1", nodes: [] }),
          removeItem: () => {
            sessionRemoved = true;
          }
        },
        localStorage: {
          getItem: () => "invalid json {{",
          removeItem: () => {
            localRemoved = true;
          }
        }
      } as any;

      const consumed = consumePendingIsoPayload();

      expect(consumed).toBeNull();
      expect(sessionRemoved).toBe(true);
      expect(localRemoved).toBe(true);
    });

    it("B5: Panne de lecture sur sessionStorage (getItem lève SecurityError) -> localStorage est quand même lu et consommé", () => {
      let localRemoved = false;
      const validPayload: IsoInjectionPayload = {
        transferId: "tx-resilient",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0 }]
      };

      global.window = {
        sessionStorage: {
          getItem: () => {
            throw new Error("SecurityError: Blocked storage access in iframe");
          },
          removeItem: () => {}
        },
        localStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? JSON.stringify(validPayload) : null),
          removeItem: (key: string) => {
            if (key === PDI_PENDING_INJECTION_KEY) localRemoved = true;
          }
        }
      } as any;

      const consumed = consumePendingIsoPayload();

      expect(consumed).not.toBeNull();
      expect(consumed?.transferId).toBe("tx-resilient");
      expect(localRemoved).toBe(true);
    });

    it("B6: Panne de suppression (removeItem lève une exception) -> le payload valide en mémoire est quand même retourné", () => {
      const validPayload: IsoInjectionPayload = {
        transferId: "tx-remove-err",
        nodes: [{ id: "n1", x: 5, y: 5, z: 0 }]
      };

      global.window = {
        sessionStorage: {
          getItem: (key: string) => (key === PDI_PENDING_INJECTION_KEY ? JSON.stringify(validPayload) : null),
          removeItem: () => {
            throw new Error("QuotaExceededError or StorageLock on removeItem");
          }
        },
        localStorage: {
          getItem: () => null,
          removeItem: () => {}
        }
      } as any;

      const consumed = consumePendingIsoPayload();

      expect(consumed).not.toBeNull();
      expect(consumed?.transferId).toBe("tx-remove-err");
    });

    it("B7: Stockages indisponibles (window undefined ou null) -> retourne null en toute sécurité", () => {
      global.window = undefined as any;
      expect(consumePendingIsoPayload()).toBeNull();
    });
  });

  // =========================================================================
  // SUITE C : PLACEMENT GÉOMÉTRIQUE DES ACCESSOIRES
  // =========================================================================
  describe("Correction C : Placement géométrique des accessoires", () => {
    const nodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 300, y: 100, elevation: 0 },
      { id: "n3", x: 300, y: 300, elevation: 0 }
    ];

    const segments: SketchVectorSegment[] = [
      {
        id: "seg_h",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L"
      },
      {
        id: "seg_v",
        fromNodeId: "n2",
        toNodeId: "n3",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L"
      }
    ];

    it("C1: Priorité 1 Nœud : un point proche d'un nœud (<= 18px) s'ancre au nœud, même s'il est proche d'un tronçon incident", () => {
      // Proche de n1 (105, 103) -> distance = hypot(5, 3) = ~5.83px <= 18px
      const pt: SketchPoint2D = { x: 105, y: 103 };
      const target = resolveFittingPlacementTarget(pt, nodes, segments, {
        nodeTolerancePx: 18,
        segmentTolerancePx: 18
      });

      expect(target.targetType).toBe("node");
      expect(target.nodeId).toBe("n1");
      expect(target.segmentId).toBeUndefined();
    });

    it("C2: Priorité 2 Tronçon : un point hors tolérance des nœuds mais à portée d'un tronçon s'ancre au tronçon avec projection bornée t in [0, 1]", () => {
      // Au milieu de seg_h (x=200, y=106) -> distance à n1=100px, distance à n2=100px (hors tolérance 18px)
      // Distance orthogonale à seg_h (ligne y=100 entre x=100 et 300) = 6px <= 18px
      const pt: SketchPoint2D = { x: 200, y: 106 };
      const target = resolveFittingPlacementTarget(pt, nodes, segments, {
        nodeTolerancePx: 18,
        segmentTolerancePx: 18
      });

      expect(target.targetType).toBe("segment");
      expect(target.segmentId).toBe("seg_h");
      expect(target.nodeId).toBeUndefined();
      expect(target.t).toBeCloseTo(0.5, 2);
      expect(target.projectionPoint?.x).toBe(200);
      expect(target.projectionPoint?.y).toBe(100);
      expect(target.distancePx).toBe(6);
    });

    it("C3: Clic entre deux tronçons : sélectionne le tronçon le plus proche", () => {
      // seg_h à y=100, seg_v à x=300
      // Point (280, 104) : distance à seg_h = 4px, distance à seg_v = 20px
      // Distance à n2 (300, 100) = hypot(20, 4) = 20.39px > 18px (donc nœud exclu)
      const pt: SketchPoint2D = { x: 280, y: 104 };
      const target = resolveFittingPlacementTarget(pt, nodes, segments, {
        nodeTolerancePx: 18,
        segmentTolerancePx: 18
      });

      expect(target.targetType).toBe("segment");
      expect(target.segmentId).toBe("seg_h");
    });

    it("C4: Clic au-delà des extrémités du tronçon : la distance au point borné t in {0, 1} est respectée et rejette si > tolérance", () => {
      // Point à gauche de n1 (x=70, y=100) : aligné sur seg_h mais au-delà de n1 (t_raw = -0.15)
      // Projection bornée t=0 (n1=(100, 100)), distance à n1 = 30px > 18px
      const pt: SketchPoint2D = { x: 70, y: 100 };
      const target = resolveFittingPlacementTarget(pt, nodes, segments, {
        nodeTolerancePx: 18,
        segmentTolerancePx: 18
      });

      expect(target.targetType).toBe("none");
    });

    it("C5: Priorité 3 Vide : un clic dans le vide (hors tolérance de tout nœud ou tronçon) retourne targetType: 'none'", () => {
      // Point perdu (500, 500)
      const pt: SketchPoint2D = { x: 500, y: 500 };
      const target = resolveFittingPlacementTarget(pt, nodes, segments, {
        nodeTolerancePx: 18,
        segmentTolerancePx: 18
      });

      expect(target.targetType).toBe("none");
      expect(target.nodeId).toBeUndefined();
      expect(target.segmentId).toBeUndefined();
    });

    it("C6: Tronçon dégénéré (A == B) ou nœuds manquants : géré sans division par zéro ni crash", () => {
      const degenNodes: SketchVectorNode[] = [
        { id: "nA", x: 100, y: 100, elevation: 0 },
        { id: "nB", x: 100, y: 100, elevation: 0 } // coordonnées identiques
      ];
      const degenSegments: SketchVectorSegment[] = [
        {
          id: "seg_degen",
          fromNodeId: "nA",
          toNodeId: "nB",
          nominalDiameter: 150,
          pressureClass: "Class 300",
          material: "Acier"
        },
        {
          id: "seg_missing_nodes",
          fromNodeId: "missing_1",
          toNodeId: "missing_2",
          nominalDiameter: 150,
          pressureClass: "Class 300",
          material: "Acier"
        }
      ];

      // Test projectPointOnSegment avec A == B
      const proj = projectPointOnSegment({ x: 110, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 100 });
      expect(proj.t).toBe(0);
      expect(proj.distancePx).toBe(10);

      // Test resolveFittingPlacementTarget
      const target = resolveFittingPlacementTarget({ x: 200, y: 200 }, degenNodes, degenSegments);
      expect(target.targetType).toBe("none");
    });
  });

  // =========================================================================
  // SUITE D : RETOUR MANUELLE VERS AUTO
  // =========================================================================
  describe("Correction D : Retour MANUELLE vers AUTO", () => {
    const calibrationScale = 0.25; // 0.25 px / mm -> 1px = 4mm
    const sampleNodes: SketchVectorNode[] = [
      { id: "n1", x: 100, y: 100, elevation: 0 },
      { id: "n2", x: 350, y: 100, elevation: 0 } // dist = 250px -> autoLength = 1000mm
    ];

    it("D1: resetSegmentToAutoLength réinitialise isManualLength à false et recalcule lengthMm depuis la géométrie", () => {
      const manualSeg: SketchVectorSegment = {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 9999, // Longueur forcée manuelle
        isManualLength: true
      };

      const reset = resetSegmentToAutoLength(manualSeg, sampleNodes, calibrationScale);

      expect(reset.isManualLength).toBe(false);
      expect(reset.lengthMm).toBe(1000); // 250px / 0.25 = 1000mm
    });

    it("D2: resolveSegmentDisplayLengthMm reflète immédiatement la longueur recalculée après remise en AUTO", () => {
      const manualSeg: SketchVectorSegment = {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 9999,
        isManualLength: true
      };

      // Avant remise en AUTO : affiche 9999
      expect(resolveSegmentDisplayLengthMm(manualSeg, sampleNodes, calibrationScale)).toBe(9999);

      // Remise en AUTO
      const reset = resetSegmentToAutoLength(manualSeg, sampleNodes, calibrationScale);

      // Après remise en AUTO : affiche 1000
      expect(resolveSegmentDisplayLengthMm(reset, sampleNodes, calibrationScale)).toBe(1000);
    });

    it("D3: Un déplacement ultérieur de nœud via syncSegmentsOnNodeMove met à jour le tronçon redevenu AUTO", () => {
      const manualSeg: SketchVectorSegment = {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 9999,
        isManualLength: true
      };

      const reset = resetSegmentToAutoLength(manualSeg, sampleNodes, calibrationScale);
      expect(reset.lengthMm).toBe(1000);

      // Déplacement de n2 à (600, 100) -> distance = 500px -> autoLength = 2000mm
      const movedNodes: SketchVectorNode[] = [
        { id: "n1", x: 100, y: 100, elevation: 0 },
        { id: "n2", x: 600, y: 100, elevation: 0 }
      ];

      const synced = syncSegmentsOnNodeMove([reset], movedNodes, ["n2"], calibrationScale);

      expect(synced[0].lengthMm).toBe(2000);
      expect(synced[0].isManualLength).toBe(false);
    });

    it("D4: Un changement d'échelle ultérieur via syncSegmentsOnCalibrationChange met à jour le tronçon redevenu AUTO", () => {
      const manualSeg: SketchVectorSegment = {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 9999,
        isManualLength: true
      };

      const reset = resetSegmentToAutoLength(manualSeg, sampleNodes, calibrationScale);

      // Nouvelle échelle : 0.5 px/mm (au lieu de 0.25) -> 250px / 0.5 = 500mm
      const synced = syncSegmentsOnCalibrationChange([reset], sampleNodes, 0.5);

      expect(synced[0].lengthMm).toBe(500);
      expect(synced[0].isManualLength).toBe(false);
    });

    it("D5: La compilation finale compileSketchToIsoModel intègre la nouvelle longueur recalculée", () => {
      const manualSeg: SketchVectorSegment = {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 9999,
        isManualLength: true
      };

      // Réinitialisation en AUTO
      const reset = resetSegmentToAutoLength(manualSeg, sampleNodes, calibrationScale);

      const compiled = compileSketchToIsoModel({
        nodes: sampleNodes,
        segments: [reset],
        fittings: [],
        calibrationScale,
        lineReference: "L-100"
      });

      expect(compiled.segments).toHaveLength(1);
      // En unité modèle isométrique (mètres), 1000mm = 1.0m (alors que le segment manuel valait 9.999m)
      expect(compiled.segments[0].length).toBe(1);
      expect(compiled.dimensions[0].label).toBe("1000");
    });

    it("D6: Les autres tronçons manuels restent intacts et préservés lorsqu'un tronçon est remis en AUTO", () => {
      const seg1: SketchVectorSegment = {
        id: "s1",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 5000,
        isManualLength: true
      };
      const seg2: SketchVectorSegment = {
        id: "s2",
        fromNodeId: "n1",
        toNodeId: "n2",
        nominalDiameter: 150,
        pressureClass: "Class 300",
        material: "Acier API 5L",
        lengthMm: 8888,
        isManualLength: true
      };

      // On réinitialise uniquement s1
      const resetS1 = resetSegmentToAutoLength(seg1, sampleNodes, calibrationScale);

      const segmentsList = [resetS1, seg2];

      // seg1 est en AUTO avec 1000mm
      expect(segmentsList[0].isManualLength).toBe(false);
      expect(segmentsList[0].lengthMm).toBe(1000);

      // seg2 reste MANUELLE avec 8888mm
      expect(segmentsList[1].isManualLength).toBe(true);
      expect(segmentsList[1].lengthMm).toBe(8888);
    });
  });
});
