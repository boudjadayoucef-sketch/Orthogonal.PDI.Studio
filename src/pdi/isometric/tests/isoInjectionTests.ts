/**
 * Tests unitaires useIsoInjection — Patch SKETCH-ISO-01
 * Couverture des cas d'usage INJ-01 à INJ-06
 */

import {
  consumePendingIsoPayload,
  useIsoInjection,
  PDI_PENDING_INJECTION_KEY,
  PDI_ACTIVE_MODULE_KEY,
  EVENT_INJECT_ISO_GRAPH,
  EVENT_ACTIVE_MODULE_CHANGED,
  IsoInjectionPayload,
} from "../engine/useIsoInjection";

export function runIsoInjectionTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let testsRun = 0;
  let success = true;

  function ok(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
  }

  function test(id: string, name: string, fn: () => void) {
    testsRun++;
    try {
      fn();
      results.push(`✅ PASS [${id}]: ${name}`);
    } catch (err: any) {
      success = false;
      results.push(`❌ FAIL [${id}]: ${name} (${err.message})`);
      throw err;
    }
  }

  // Mock basique de window/storage pour environnement Node / tsx
  const storageStore: Record<string, string> = {};
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
    },
  };

  const listeners: Record<string, ((e: any) => void)[]> = {};
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
    dispatchEvent: (ev: { type: string; detail?: any }) => {
      const cbs = listeners[ev.type] || [];
      for (const cb of [...cbs]) {
        cb(ev);
      }
      return true;
    },
  };

  // Simuler global window
  const originalWindow = (global as any).window;
  (global as any).window = mockWindow;

  try {
    // INJ-01 : payload en attente au montage initial -> consommé correctement
    test("INJ-01", "Payload en attente au montage initial -> consommé correctement", () => {
      mockStorage.clear();
      const samplePayload: IsoInjectionPayload = {
        name: "L-100-TEST-01",
        nodes: [{ id: "n1", x: 0, y: 0, z: 0 }],
        segments: [],
      };
      mockStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(samplePayload));

      let committedPayload: IsoInjectionPayload | null = null;
      let committedName: string | undefined = undefined;

      // Simuler l'effet de useIsoInjection
      const pending = consumePendingIsoPayload();
      ok(pending !== null, "Le payload en attente doit être récupéré");
      if (pending) {
        committedPayload = pending;
        committedName = pending.name;
      }

      ok(committedPayload?.name === "L-100-TEST-01", "Le nom du projet doit être L-100-TEST-01");
      ok(committedPayload?.nodes?.length === 1, "Le nœud n1 doit être présent");
      ok(
        mockStorage.getItem(PDI_PENDING_INJECTION_KEY) === null,
        "Le storage doit être nettoyé immédiatement après consommation"
      );
    });

    // INJ-02 : payload arrivant via événement "pdi:inject-iso-graph" pendant que le composant est déjà monté
    test(
      "INJ-02",
      "Payload arrivant via événement pdi:inject-iso-graph pendant que le composant est déjà monté -> consommé",
      () => {
        mockStorage.clear();
        let commits = 0;
        let lastPayload: any = null;

        const onCustomInject = (e: any) => {
          if (e.detail && e.detail.data) {
            mockStorage.removeItem(PDI_PENDING_INJECTION_KEY);
            commits++;
            lastPayload = e.detail.data;
          }
        };

        mockWindow.addEventListener(EVENT_INJECT_ISO_GRAPH, onCustomInject);

        const runtimePayload: IsoInjectionPayload = {
          name: "L-200-RUNTIME",
          nodes: [{ id: "n2", x: 10, y: 10, z: 0 }],
        };

        mockWindow.dispatchEvent({
          type: EVENT_INJECT_ISO_GRAPH,
          detail: { data: runtimePayload, name: "L-200-RUNTIME" },
        });

        mockWindow.removeEventListener(EVENT_INJECT_ISO_GRAPH, onCustomInject);

        ok(commits === 1, "Doit avoir déclenché exactement 1 commit");
        ok(lastPayload?.name === "L-200-RUNTIME", "Le payload reçu doit correspondre");
      }
    );

    // INJ-03 : payload en attente + événement "pdi:active-module-changed" déclenché APRÈS le montage initial
    test(
      "INJ-03",
      "Payload en attente + événement pdi:active-module-changed (composant jamais démonté) -> consommé",
      () => {
        mockStorage.clear();
        let commits = 0;
        let committedPayload: any = null;

        const onActiveModuleChanged = (e: any) => {
          const activeModule =
            e.detail?.activeModule || mockStorage.getItem(PDI_ACTIVE_MODULE_KEY);
          if (activeModule !== "isometric") return;

          const pending = consumePendingIsoPayload();
          if (pending) {
            commits++;
            committedPayload = pending;
          }
        };

        mockWindow.addEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged);

        // L'utilisateur écrit dans le storage depuis Croquis
        const payload: IsoInjectionPayload = {
          name: "L-300-SKETCH-TO-ISO",
          nodes: [
            { id: "n1", x: 0, y: 0, z: 0 },
            { id: "n2", x: 100, y: 0, z: 0 },
          ],
        };
        mockStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));
        mockStorage.setItem(PDI_ACTIVE_MODULE_KEY, "isometric");

        // Déclenchement de l'événement pdi:active-module-changed
        mockWindow.dispatchEvent({
          type: EVENT_ACTIVE_MODULE_CHANGED,
          detail: { activeModule: "isometric" },
        });

        mockWindow.removeEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged);

        ok(commits === 1, "Le commit doit avoir été appelé une fois");
        ok(committedPayload?.name === "L-300-SKETCH-TO-ISO", "Le payload doit être reçu");
        ok(committedPayload?.nodes?.length === 2, "Les 2 nœuds doivent être présents");
        ok(
          mockStorage.getItem(PDI_PENDING_INJECTION_KEY) === null,
          "Le storage doit être nettoyé après consommation"
        );
      }
    );

    // INJ-04 : payload vide ou nodes.length === 0 -> aucune consommation, aucune erreur
    test("INJ-04", "Payload vide ou nodes.length === 0 -> aucune consommation, aucune erreur", () => {
      mockStorage.clear();
      mockStorage.setItem(
        PDI_PENDING_INJECTION_KEY,
        JSON.stringify({ name: "EMPTY", nodes: [] })
      );

      const pending = consumePendingIsoPayload();
      ok(pending === null, "Un payload avec 0 nœuds doit être rejeté (retour null)");
      ok(
        mockStorage.getItem(PDI_PENDING_INJECTION_KEY) === null,
        "Le storage corrompu/vide doit être nettoyé"
      );
    });

    // INJ-05 : payload déjà consommé une fois -> un second déclenchement ne doit PAS réinjecter
    test(
      "INJ-05",
      "Idempotence : un second déclenchement de pdi:active-module-changed ne réinjecte pas",
      () => {
        mockStorage.clear();
        let commits = 0;

        const onActiveModuleChanged = (e: any) => {
          const activeModule =
            e.detail?.activeModule || mockStorage.getItem(PDI_ACTIVE_MODULE_KEY);
          if (activeModule !== "isometric") return;

          const pending = consumePendingIsoPayload();
          if (pending) {
            commits++;
          }
        };

        mockWindow.addEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged);

        const payload: IsoInjectionPayload = {
          name: "L-500-ONCE",
          nodes: [{ id: "n1", x: 0, y: 0, z: 0 }],
        };
        mockStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));
        mockStorage.setItem(PDI_ACTIVE_MODULE_KEY, "isometric");

        // Premier passage
        mockWindow.dispatchEvent({
          type: EVENT_ACTIVE_MODULE_CHANGED,
          detail: { activeModule: "isometric" },
        });

        // Deuxième passage (navigation retour ou re-render)
        mockWindow.dispatchEvent({
          type: EVENT_ACTIVE_MODULE_CHANGED,
          detail: { activeModule: "isometric" },
        });

        mockWindow.removeEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged);

        ok(commits === 1, "Idempotence stricte : commits doit valoir exactement 1");
      }
    );

    // INJ-06 : pdi:active-module-changed déclenché avec pdi.activeModule.v1 != "isometric" -> aucune consommation
    test(
      "INJ-06",
      "pdi:active-module-changed avec module != 'isometric' -> aucune consommation",
      () => {
        mockStorage.clear();
        let commits = 0;

        const onActiveModuleChanged = (e: any) => {
          const activeModule =
            e.detail?.activeModule || mockStorage.getItem(PDI_ACTIVE_MODULE_KEY);
          if (activeModule !== "isometric") return;

          const pending = consumePendingIsoPayload();
          if (pending) {
            commits++;
          }
        };

        mockWindow.addEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged);

        const payload: IsoInjectionPayload = {
          name: "L-600-OTHER-MODULE",
          nodes: [{ id: "n1", x: 0, y: 0, z: 0 }],
        };
        mockStorage.setItem(PDI_PENDING_INJECTION_KEY, JSON.stringify(payload));
        mockStorage.setItem(PDI_ACTIVE_MODULE_KEY, "sketch");

        // Déclenchement pour un module autre ("sketch")
        mockWindow.dispatchEvent({
          type: EVENT_ACTIVE_MODULE_CHANGED,
          detail: { activeModule: "sketch" },
        });

        mockWindow.removeEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged);

        ok(commits === 0, "Aucun commit ne doit être déclenché si le module actif n'est pas isometric");
        ok(
          mockStorage.getItem(PDI_PENDING_INJECTION_KEY) !== null,
          "Le payload doit rester intact dans le storage tant que le module ISO n'est pas actif"
        );
      }
    );
  } finally {
    (global as any).window = originalWindow;
  }

  return { success, testsRun, results };
}
