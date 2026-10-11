/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : BUS DE SYNCHRONISATION MULTI-FENÊTRE TEMPS-RÉEL (017Q3)
 * ARCHITECTURE : UN SEUL MODÈLE PD&I + VUES DISTRIBUÉES VIA BROADCASTCHANNEL.
 */

import {
  PdiWorkspaceState,
  PdiWorkspaceSyncMessage,
  PdiWorkspaceSelectionState,
  PdiWorkspaceModelSnapshot,
  PdiWorkspaceViewId,
  PdiWorkspaceConfig,
} from "./types";
import { PdiUniversalEntity } from "../model/pdiUniversalEntity";
import { generateComplexIndustrialIsoDemo } from "../isometric/demo/pdiComplexIsoDemo";
import { deriveSpoolsAndWelds } from "../welding/isoWeldSpoolEngine";

const BROADCAST_CHANNEL_NAME = "pdi_workspace_bus_v1";
const LOCAL_STORAGE_SNAPSHOT_KEY = "pdi.workspace.state.snapshot.v1";
const LOCAL_STORAGE_CONFIG_KEY = "pdi.workspace.config.v1";

export type WorkspaceMessageListener = (msg: PdiWorkspaceSyncMessage) => void;

class PdiWorkspaceBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<WorkspaceMessageListener> = new Set();
  private isPrimaryWindow: boolean = true;
  private secondaryWindowRef: Window | null = null;
  private heartbeatTimer: number | null = null;
  private lastPongTimestamp: number = 0;
  private secondaryConnected: boolean = false;
  private onConnectionChangeCallbacks: Set<(connected: boolean) => void> = new Set();

  constructor() {
    this.initChannel();
  }

  private initChannel() {
    if (typeof window === "undefined") return;

    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
        this.channel.onmessageerror = (err) => {
          console.warn("[PDI Multi-Screen Bus] Erreur message BroadcastChannel:", err);
        };
      }
      
      // Écouter les messages inter-fenêtres directs (window.postMessage)
      window.addEventListener("message", (e) => {
        if (e.data && typeof e.data === "object" && e.data.type && typeof e.data.type === "string" && e.data.type.startsWith("PDI_WS_")) {
          this.handleIncomingMessage(e.data);
        }
      });

      // Toujours écouter aussi les évènements localStorage pour compatibilité maximale
      window.addEventListener("storage", (e) => {
        if (e.key === "pdi.workspace.bus.event" && e.newValue) {
          try {
            const msg = JSON.parse(e.newValue);
            this.handleIncomingMessage(msg);
          } catch {}
        }
      });
    } catch (e) {
      console.warn("[PDI Multi-Screen Bus] Initialisation BroadcastChannel:", e);
    }
  }

  public setRole(isPrimary: boolean) {
    this.isPrimaryWindow = isPrimary;
    if (isPrimary) {
      this.startPrimaryHeartbeat();
    }
  }

  public isPrimary(): boolean {
    return this.isPrimaryWindow;
  }

  public isSecondaryWindowConnected(): boolean {
    return this.secondaryConnected;
  }

  public subscribe(listener: WorkspaceMessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.onConnectionChangeCallbacks.add(cb);
    return () => {
      this.onConnectionChangeCallbacks.delete(cb);
    };
  }

  private notifyConnectionChange(connected: boolean) {
    if (this.secondaryConnected !== connected) {
      this.secondaryConnected = connected;
      this.onConnectionChangeCallbacks.forEach((cb) => {
        try { cb(connected); } catch {}
      });
    }
  }

  private handleIncomingMessage(msg: PdiWorkspaceSyncMessage) {
    if (!msg || !msg.type) return;

    // Gestion du protocole de présence
    if (msg.type === "PDI_WS_PING") {
      this.postMessage({
        type: "PDI_WS_PONG",
        timestamp: Date.now(),
        sender: this.isPrimaryWindow ? "primary" : "secondary",
      });
      if (this.isPrimaryWindow && msg.sender === "secondary") {
        this.lastPongTimestamp = Date.now();
        this.notifyConnectionChange(true);
      }
    } else if (msg.type === "PDI_WS_PONG") {
      if (this.isPrimaryWindow && msg.sender === "secondary") {
        this.lastPongTimestamp = Date.now();
        this.notifyConnectionChange(true);
      }
    } else if (msg.type === "PDI_WS_HELLO_SECONDARY") {
      if (this.isPrimaryWindow) {
        this.lastPongTimestamp = Date.now();
        this.notifyConnectionChange(true);
      }
    } else if (msg.type === "PDI_WS_CLOSE_SECONDARY") {
      if (this.isPrimaryWindow) {
        this.notifyConnectionChange(false);
      }
    }

    // Transmettre aux abonnés
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error("[PDI Multi-Screen Bus] Erreur listener:", err);
      }
    });
  }

  public postMessage(msg: PdiWorkspaceSyncMessage) {
    try {
      if (this.channel) {
        this.channel.postMessage(msg);
      }
      if (typeof window !== "undefined") {
        if (window.opener && !window.opener.closed) {
          try { window.opener.postMessage(msg, "*"); } catch {}
        }
        if (this.secondaryWindowRef && !this.secondaryWindowRef.closed) {
          try { this.secondaryWindowRef.postMessage(msg, "*"); } catch {}
        }
        const payload = JSON.stringify({ ...msg, _ts: Date.now() + "_" + Math.random().toString(36).substring(2, 7) });
        window.localStorage.setItem("pdi.workspace.bus.event", payload);
      }
    } catch (e) {
      console.warn("[PDI Multi-Screen Bus] Échec postMessage:", e);
    }
  }

  /**
   * Sauvegarde un instantané d'état pour chargement instantané au boot de la 2e fenêtre
   */
  public saveStateSnapshot(state: PdiWorkspaceState) {
    if (typeof window === "undefined") return;
    try {
      const incomingNodes = state.modelSnapshot?.nodes?.length || 0;
      if (incomingNodes === 0) {
        // Anti-écrasement : si le modèle entrant est vide, vérifier si un snapshot avec nœuds existe déjà
        const existingRaw = window.localStorage.getItem(LOCAL_STORAGE_SNAPSHOT_KEY);
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw) as PdiWorkspaceState;
            if (existing?.modelSnapshot?.nodes && existing.modelSnapshot.nodes.length > 0) {
              // Conserver le modèle existant avec ses nœuds, ne mettre à jour que la vue/sélection
              existing.screen2View = state.screen2View || existing.screen2View;
              existing.selection = state.selection || existing.selection;
              existing.lastUpdateTimestamp = Date.now();
              window.localStorage.setItem(LOCAL_STORAGE_SNAPSHOT_KEY, JSON.stringify(existing));
              return;
            }
          } catch {}
        }
      }
      window.localStorage.setItem(LOCAL_STORAGE_SNAPSHOT_KEY, JSON.stringify(state));
    } catch {}
  }

  public readStateSnapshot(): PdiWorkspaceState | null {
    if (typeof window === "undefined") return null;
    try {
      // 1. Essayer d'abord la clé officielle du bus
      const raw = window.localStorage.getItem(LOCAL_STORAGE_SNAPSHOT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PdiWorkspaceState;
          if (parsed?.modelSnapshot?.nodes && parsed.modelSnapshot.nodes.length > 0) {
            if ((!parsed.modelSnapshot.spools || parsed.modelSnapshot.spools.length === 0) && parsed.modelSnapshot.nodes.length > 0) {
              const derived = deriveSpoolsAndWelds(parsed.modelSnapshot.nodes, parsed.modelSnapshot.segments || []);
              parsed.modelSnapshot.spools = derived.spools;
              parsed.modelSnapshot.welds = derived.welds;
            }
            return parsed;
          }
        } catch {}
      }
      
      // 2. Scanner les clés de stockage Isométrie locales en cherchant d'abord le projet actif, puis par date la plus récente
      let activeProjectId = "";
      try {
        const activeTabId = window.localStorage.getItem("pdi.activeTab.v1");
        const rawTabs = window.localStorage.getItem("pdi.workspace.tabs.v1");
        if (activeTabId && rawTabs) {
          const tabs = JSON.parse(rawTabs);
          const activeTab = tabs.find((t: any) => t.id === activeTabId);
          if (activeTab?.projectId) activeProjectId = activeTab.projectId;
        }
      } catch {}

      const candidateSnaps: { snap: PdiWorkspaceState; updatedAt: string; isMatchingActive: boolean }[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith("isometrie.autosave.") || key === "isometrie.autosave.v474.current") &&
          key.endsWith(".current")
        ) {
          const autoRaw = window.localStorage.getItem(key);
          if (autoRaw) {
            try {
              const autoData = JSON.parse(autoRaw);
              const modelNodes = autoData?.model?.nodes || autoData?.nodes || [];
              const modelSegments = autoData?.model?.segments || autoData?.segments || [];
              const modelSupports = autoData?.model?.supports || autoData?.supports || [];

              if (Array.isArray(modelNodes) && modelNodes.length > 0) {
                const rawSpools = autoData?.model?.spools || autoData?.spools;
                const rawWelds = autoData?.model?.welds || autoData?.welds;
                let effectiveSpools = Array.isArray(rawSpools) && rawSpools.length > 0 ? rawSpools : [];
                let effectiveWelds = Array.isArray(rawWelds) && rawWelds.length > 0 ? rawWelds : [];

                if (effectiveSpools.length === 0) {
                  const derived = deriveSpoolsAndWelds(modelNodes, modelSegments);
                  effectiveSpools = derived.spools;
                  effectiveWelds = derived.welds;
                }

                const projId = autoData.project?.id || "default";
                const isMatchingActive = Boolean(activeProjectId && projId === activeProjectId);
                const updatedAt = autoData.exportedAt || autoData.project?.updatedAt || "1970-01-01T00:00:00.000Z";

                const constructedSnap: PdiWorkspaceState = {
                  mode: "dual_screen",
                  profile: "conception_3d",
                  screen1View: "iso",
                  screen2View: "3d",
                  selection: {
                    selectedNodeId: null,
                    selectedSegmentId: null,
                    selectedSupportId: null,
                    selectedComponentId: null,
                    selectedWeldId: null,
                    selectedSpoolId: null,
                    selectedType: null,
                    timestamp: Date.now(),
                  },
                  activeEntity: null,
                  modelSnapshot: {
                    projectName: autoData.project?.name || "Projet Isométrique Synchrone",
                    projectId: projId,
                    unitSystem: autoData.project?.unitSystem === "imperial" ? "imperial" : "metric",
                    nodes: modelNodes,
                    segments: modelSegments,
                    supports: modelSupports,
                    welds: effectiveWelds,
                    spools: effectiveSpools,
                    bomRows: [],
                    updatedAt,
                  },
                  displayPreferences: {
                    theme: "dark",
                    showGrid: true,
                    showDimensions: true,
                    showWelds: true,
                    showSupports: true,
                    showTags: true,
                  },
                  secondaryConnected: true,
                  lastUpdateTimestamp: Date.now(),
                };

                candidateSnaps.push({ snap: constructedSnap, updatedAt, isMatchingActive });
              }
            } catch {}
          }
        }
      }

      if (candidateSnaps.length > 0) {
        // Trier : d'abord le projet actif s'il y a correspondance, puis par date la plus récente
        candidateSnaps.sort((a, b) => {
          if (a.isMatchingActive && !b.isMatchingActive) return -1;
          if (!a.isMatchingActive && b.isMatchingActive) return 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        });
        return candidateSnaps[0].snap;
      }

      // 3. Fallback garanti : Modèle Isométrique de Démo Industrielle Complexe si aucune donnée n'est trouvée
      const demo = generateComplexIndustrialIsoDemo();
      const derived = deriveSpoolsAndWelds(demo.nodes, demo.segments);
      const demoSnap: PdiWorkspaceState = {
        mode: "dual_screen",
        profile: "conception_3d",
        screen1View: "iso",
        screen2View: "3d",
        selection: {
          selectedNodeId: null,
          selectedSegmentId: null,
          selectedSupportId: null,
          selectedComponentId: null,
          selectedWeldId: null,
          selectedSpoolId: null,
          selectedType: null,
          timestamp: Date.now(),
        },
        activeEntity: null,
        modelSnapshot: {
          projectName: "Projet Isométrique Synchrone (Démo)",
          projectId: "demo",
          unitSystem: "metric",
          nodes: demo.nodes,
          segments: demo.segments,
          supports: demo.supports,
          welds: derived.welds,
          spools: derived.spools,
          bomRows: [],
          updatedAt: "demo_static_v1",
        },
        displayPreferences: {
          theme: "dark",
          showGrid: true,
          showDimensions: true,
          showWelds: true,
          showSupports: true,
          showTags: true,
        },
        secondaryConnected: true,
        lastUpdateTimestamp: Date.now(),
      };
      window.localStorage.setItem(LOCAL_STORAGE_SNAPSHOT_KEY, JSON.stringify(demoSnap));
      return demoSnap;
    } catch {
      return null;
    }
  }

  public saveConfig(config: PdiWorkspaceConfig) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch {}
  }

  public readConfig(): PdiWorkspaceConfig | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Diffusion de la sélection active (ISO <-> 3D / Spool / Propriétés)
   */
  public broadcastSelection(
    selection: PdiWorkspaceSelectionState,
    activeEntity: PdiUniversalEntity | null,
    sender: "primary" | "secondary" = "primary"
  ) {
    this.postMessage({
      type: "PDI_WS_SELECTION_CHANGE",
      timestamp: Date.now(),
      selection,
      activeEntity,
      sender,
    });
  }

  /**
   * Diffusion d'une mise à jour du modèle central
   */
  public broadcastModelUpdate(
    modelSnapshot: PdiWorkspaceModelSnapshot,
    sender: "primary" | "secondary" = "primary"
  ) {
    if (typeof window !== "undefined") {
      try {
        let snap = this.readStateSnapshot();
        if (!snap) {
          snap = {
            mode: "dual_screen",
            profile: "conception_3d",
            screen1View: "iso",
            screen2View: "3d",
            selection: {
              selectedNodeId: null,
              selectedSegmentId: null,
              selectedSupportId: null,
              selectedComponentId: null,
              selectedWeldId: null,
              selectedSpoolId: null,
              selectedType: null,
              timestamp: Date.now(),
            },
            activeEntity: null,
            modelSnapshot,
            displayPreferences: {
              theme: "dark",
              showGrid: true,
              showDimensions: true,
              showWelds: true,
              showSupports: true,
              showTags: true,
            },
            secondaryConnected: true,
            lastUpdateTimestamp: Date.now(),
          };
        } else {
          snap.modelSnapshot = modelSnapshot;
          snap.lastUpdateTimestamp = Date.now();
        }
        this.saveStateSnapshot(snap);
      } catch {}
    }
    this.postMessage({
      type: "PDI_WS_MODEL_UPDATE",
      timestamp: Date.now(),
      modelSnapshot,
      sender,
    });
  }

  /**
   * Diffusion d'un changement de vue sur l'écran secondaire
   */
  public broadcastChangeView(
    screen2View: PdiWorkspaceViewId,
    sender: "primary" | "secondary" = "primary"
  ) {
    if (typeof window !== "undefined") {
      try {
        let snap = this.readStateSnapshot();
        if (snap) {
          snap.screen2View = screen2View;
          snap.lastUpdateTimestamp = Date.now();
          this.saveStateSnapshot(snap);
        }
      } catch {}
    }
    this.postMessage({
      type: "PDI_WS_CHANGE_VIEW",
      timestamp: Date.now(),
      screen2View,
      sender,
    });
  }

  /**
   * Envoi d'une modification d'entité depuis l'inspecteur secondaire vers le modèle central
   */
  public broadcastEntityModify(entity: PdiUniversalEntity) {
    this.postMessage({
      type: "PDI_WS_ENTITY_MODIFY",
      timestamp: Date.now(),
      entity,
      sender: "secondary",
    });
  }

  /**
   * Demande de synchronisation d'état complet
   */
  public broadcastFullState(state: PdiWorkspaceState, sender: "primary" | "secondary" = "primary") {
    this.saveStateSnapshot(state);
    this.postMessage({
      type: "PDI_WS_STATE_SYNC",
      timestamp: Date.now(),
      state,
      sender,
    });
  }

  /**
   * Ouverture de la fenêtre secondaire avec la vue spécifiée
   */
  public openSecondaryWindow(
    view: PdiWorkspaceViewId = "3d",
    bounds?: { left: number; top: number; width: number; height: number }
  ): Window | null {
    if (typeof window === "undefined") return null;

    const width = bounds?.width || 1280;
    const height = bounds?.height || 850;
    const left = bounds?.left ?? (window.screen.availWidth ? window.screen.availWidth + 20 : window.screenX + 50);
    const top = bounds?.top ?? 0;

    const url = `${window.location.origin}${window.location.pathname}?pdi_workspace=secondary&view=${view}`;
    const windowFeatures = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;

    try {
      // Fermer l'éventuelle référence existante
      if (this.secondaryWindowRef && !this.secondaryWindowRef.closed) {
        this.secondaryWindowRef.focus();
        this.broadcastChangeView(view, "primary");
        return this.secondaryWindowRef;
      }

      const win = window.open(url, "pdi_secondary_workspace_window", windowFeatures);
      this.secondaryWindowRef = win;

      if (win) {
        win.focus();
        this.notifyConnectionChange(true);
      }
      return win;
    } catch (err) {
      console.warn("[PDI Multi-Screen Bus] Impossible d'ouvrir la fenêtre secondaire:", err);
      return null;
    }
  }

  /**
   * Ferme proprement la fenêtre secondaire et revient en écran unique
   */
  public closeSecondaryWindow() {
    this.postMessage({
      type: "PDI_WS_CLOSE_SECONDARY",
      timestamp: Date.now(),
      reason: "switch_to_single_screen",
    });

    if (this.secondaryWindowRef && !this.secondaryWindowRef.closed) {
      try {
        this.secondaryWindowRef.close();
      } catch {}
    }
    this.secondaryWindowRef = null;
    this.notifyConnectionChange(false);
  }

  private startPrimaryHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (this.secondaryConnected) {
        // Ping
        this.postMessage({
          type: "PDI_WS_PING",
          timestamp: Date.now(),
          sender: "primary",
        });

        // Détection de déconnexion si pas de pong depuis 7 secondes
        if (this.lastPongTimestamp > 0 && Date.now() - this.lastPongTimestamp > 7000) {
          this.notifyConnectionChange(false);
        }
      }
    }, 3000);
  }

  public destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
    this.onConnectionChangeCallbacks.clear();
  }
}

// Instance Singleton pour l'application
export const pdiWorkspaceBus = new PdiWorkspaceBus();
