/**
 * PDI ISOMETRIC ENGINE — USE ISO INJECTION HOOK
 * Reference: PATCH SKETCH-ISO-01
 *
 * Hook d'écoute et de consommation du payload d'injection croquis -> ISO.
 *
 * TRIPLE MÉCANISME DE DÉTECTION :
 * 1. Canal Temps Réel : écoute de l'événement personnalisé "pdi:inject-iso-graph".
 * 2. Canal Montage Initial : vérification du localStorage/sessionStorage au montage (`useEffect` avec `[]`).
 * 3. Canal Changement de Module Actif : écoute de l'événement personnalisé "pdi:active-module-changed"
 *    qui se déclenche lorsque le module ISO redevient actif (même si le composant n'a jamais été démonté).
 *
 * RÈGLE D'IDEMPOTENCE ABSOLUE :
 * - Le payload est consommé et supprimé de `localStorage` ET `sessionStorage` dès sa première lecture.
 * - Si le payload est vide ou si `nodes.length === 0`, aucune consommation ni erreur.
 * - Si le module actif n'est pas "isometric", aucune consommation sur "pdi:active-module-changed".
 */

import { useEffect, useRef } from "react";

export interface IsoInjectionPayload {
  name?: string;
  nodes?: any[];
  segments?: any[];
  lines?: any[];
  dimensions?: any[];
  cad2d?: {
    entities?: any[];
    layers?: any[];
  };
  supports?: any[];
  workspace?: {
    showDimensions?: boolean;
    showGrid?: boolean;
    showPipeLabels?: boolean;
    showWelds?: boolean;
  };
  open3d?: boolean;
  updatedAt?: string;
}

export interface UseIsoInjectionOptions {
  onCommit: (payload: IsoInjectionPayload, sourceName?: string) => void;
}

export const PDI_PENDING_INJECTION_KEY = "pdi.pending_iso_injection";
export const PDI_ACTIVE_MODULE_KEY = "pdi.activeModule.v1";
export const EVENT_INJECT_ISO_GRAPH = "pdi:inject-iso-graph";
export const EVENT_ACTIVE_MODULE_CHANGED = "pdi:active-module-changed";

/**
 * Lit, valide et nettoie immédiatement le storage en attente d'injection.
 * Retourne le payload valide ou `null`.
 */
export function consumePendingIsoPayload(): IsoInjectionPayload | null {
  try {
    if (typeof window === "undefined") return null;

    const pendingRaw =
      window.sessionStorage.getItem(PDI_PENDING_INJECTION_KEY) ||
      window.localStorage.getItem(PDI_PENDING_INJECTION_KEY);

    if (!pendingRaw) return null;

    // Suppression immédiate pour garantir l'idempotence
    try {
      window.sessionStorage.removeItem(PDI_PENDING_INJECTION_KEY);
      window.localStorage.removeItem(PDI_PENDING_INJECTION_KEY);
    } catch {}

    const payload = JSON.parse(pendingRaw);

    // Validation structurelle : doit contenir un tableau `nodes` avec au moins 1 nœud
    if (payload && Array.isArray(payload.nodes) && payload.nodes.length > 0) {
      return payload as IsoInjectionPayload;
    }

    return null;
  } catch (err) {
    console.warn("[useIsoInjection] Error parsing pending ISO payload:", err);
    return null;
  }
}

/**
 * Hook d'injection de graphe isométrique vers l'éditeur ISO.
 */
export function useIsoInjection({ onCommit }: UseIsoInjectionOptions): void {
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    // Fonction centrale de traitement d'un payload
    const processPayload = (payload: IsoInjectionPayload | null, sourceName?: string) => {
      if (!payload) return;
      if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) return;
      onCommitRef.current(payload, sourceName);
    };

    // Canal 1 & Canal 2 (Montage initial)
    const initialPayload = consumePendingIsoPayload();
    if (initialPayload) {
      processPayload(initialPayload, initialPayload.name);
    }

    // Canal 1 (Événement temps réel)
    const onCustomInject = (e: Event) => {
      const customEv = e as CustomEvent<{
        data: any;
        name?: string;
        projectId?: string;
        open3d?: boolean;
      }>;
      if (customEv.detail && customEv.detail.data) {
        // En cas d'événement temps réel direct, consommer également tout résidu dans le storage
        try {
          window.sessionStorage.removeItem(PDI_PENDING_INJECTION_KEY);
          window.localStorage.removeItem(PDI_PENDING_INJECTION_KEY);
        } catch {}

        processPayload(customEv.detail.data, customEv.detail.name);
      }
    };

    // Canal 3 (Module ISO redevient actif sans remontage du composant)
    const onActiveModuleChanged = (e: Event) => {
      try {
        const customEv = e as CustomEvent<{ activeModule?: string }>;
        const activeModule =
          customEv.detail?.activeModule ||
          window.localStorage.getItem(PDI_ACTIVE_MODULE_KEY);

        // N'intervenir que si le module actif est "isometric"
        if (activeModule !== "isometric") {
          return;
        }

        const pending = consumePendingIsoPayload();
        if (pending) {
          processPayload(pending, pending.name);
        }
      } catch (err) {
        console.warn("[useIsoInjection] active-module-changed handler error:", err);
      }
    };

    window.addEventListener(EVENT_INJECT_ISO_GRAPH, onCustomInject as EventListener);
    window.addEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged as EventListener);

    return () => {
      window.removeEventListener(EVENT_INJECT_ISO_GRAPH, onCustomInject as EventListener);
      window.removeEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged as EventListener);
    };
  }, []);
}
