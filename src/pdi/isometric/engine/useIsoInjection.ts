/**
 * PDI ISOMETRIC ENGINE — USE ISO INJECTION HOOK
 * Reference: PATCH SKETCH-ISO-01 / SKETCH-ISO-04-FIX-01
 *
 * Hook d'écoute, de déduplication et de préparation du payload d'injection croquis -> ISO.
 *
 * TRIPLE MÉCANISME DE DÉTECTION :
 * 1. Canal Temps Réel : écoute de l'événement personnalisé "pdi:inject-iso-graph".
 * 2. Canal Montage Initial : vérification du localStorage/sessionStorage au montage (`useEffect` avec `[]`).
 * 3. Canal Changement de Module Actif : écoute de l'événement personnalisé "pdi:active-module-changed"
 *    qui se déclenche lorsque le module ISO redevient actif (même si le composant n'a jamais été démonté).
 *
 * RÈGLE D'IDEMPOTENCE STRICTE (SKETCH-ISO-04-FIX-01) :
 * - Un `transferId` unique est généré par l'émetteur pour chaque opération de transfert.
 * - Le récepteur déduplique via un registre global `processedTransferIds` : le même `transferId`
 *   reçu par storage ou événement direct ne déclenche qu'un seul commit.
 * - Un nouveau `transferId` permet immédiatement un nouveau commit (même pour un graphe identique).
 * - Le payload est consommé et supprimé de `localStorage` ET `sessionStorage` dès sa première lecture.
 * - Préparation et normalisation systématiques du graphe avant `onCommit` via `prepareInjectedIsoGraph`.
 */

import { useEffect, useRef } from "react";
import {
  IsoNode,
  IsoSegment,
  IsoFitting,
  IsoPort,
  PipingLine,
  IsoDimension
} from "../types/isoGraphTypes";
import {
  migrateLegacyFittings,
  normalizedGraphPorts,
  defaultEquipmentPorts,
  defaultFreeNodePorts,
  DEFAULT_LINE_ID
} from "../core/IsoTopologyGraph";
import { pdiReorientPorts } from "./pdiPorts017P2";

export interface IsoInjectionPayload {
  transferId?: string;
  name?: string;
  nodes?: any[];
  segments?: any[];
  lines?: any[];
  dimensions?: any[];
  ocrAnnotations?: Array<{ text: string; valueMm: number; source: "ocr" }>;
  metadata?: {
    ocrDimensions?: Array<{ text: string; valueMm: number; source: "ocr" }>;
    warnings?: string[];
    [key: string]: any;
  };
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

export interface PreparedIsoGraph extends IsoInjectionPayload {
  nodes: IsoNode[];
  segments: IsoSegment[];
  lines: PipingLine[];
  dimensions: IsoDimension[];
  cad2d?: {
    entities?: any[];
    layers?: any[];
  };
  supports?: any[];
  ocrAnnotations?: Array<{ text: string; valueMm: number; source: "ocr" }>;
  warnings?: string[];
}

export interface UseIsoInjectionOptions {
  onCommit: (payload: PreparedIsoGraph, sourceName?: string) => void;
}

export const PDI_PENDING_INJECTION_KEY = "pdi.pending_iso_injection";
export const PDI_ACTIVE_MODULE_KEY = "pdi.activeModule.v1";
export const EVENT_INJECT_ISO_GRAPH = "pdi:inject-iso-graph";
export const EVENT_ACTIVE_MODULE_CHANGED = "pdi:active-module-changed";

// Registre des identifiants de transferts traités (succès validé) et en cours de traitement
const processedTransferIds = new Set<string>();
const inProgressTransferIds = new Set<string>();

/**
 * Réinitialise les registres de transferts (utilisé principalement pour les tests).
 */
export function clearProcessedTransferIds(): void {
  processedTransferIds.clear();
  inProgressTransferIds.clear();
}

/**
 * Vérifie si un transfert a déjà été consommé et validé avec succès.
 */
export function isTransferProcessed(transferId: string): boolean {
  return processedTransferIds.has(transferId);
}

/**
 * Vérifie si un transfert est actuellement en cours d'exécution (anti-réentrance).
 */
export function isTransferInProgress(transferId: string): boolean {
  return inProgressTransferIds.has(transferId);
}

/**
 * Prépare et normalise un graphe injecté avant commit :
 * - Initialise et valide les ports de chaque nœud (équipements ou nœuds libres).
 * - Migre les raccords en ligne (inline fittings) en nœuds équipements si des segments en contiennent.
 * - Normalise les ports du graphe (`normalizedGraphPorts`) pour garantir la cohérence des liaisons.
 * - Réoriente les faces de coudes vers leurs voisins réels (`pdiReorientPorts`).
 * - Préserve les lignes de tuyauterie ou fournit une ligne par défaut valide.
 * - Préserve les dimensions géométriques valides et les annotations OCR distinctes.
 * - Conserve l'intégralité des attributs d'équipement (tag, type, label, dn, pn, material, notes).
 */
export function prepareInjectedIsoGraph(payload: IsoInjectionPayload): PreparedIsoGraph {
  const rawNodes: IsoNode[] = Array.isArray(payload.nodes) ? payload.nodes : [];
  const rawSegments: IsoSegment[] = Array.isArray(payload.segments) ? payload.segments : [];
  const warnings: string[] = Array.isArray(payload.metadata?.warnings)
    ? [...payload.metadata.warnings]
    : [];

  // 1. Initialiser les ports des nœuds s'ils ne sont pas déjà définis
  const initialNodes: IsoNode[] = rawNodes.map((node) => {
    let ports = node.ports;
    if (!ports || !Array.isArray(ports) || ports.length === 0) {
      ports = node.equipmentType
        ? defaultEquipmentPorts(node.equipmentType)
        : defaultFreeNodePorts();
    }
    return {
      ...node,
      ports
    };
  });

  // 2. Migration des raccords en ligne (inline fittings) vers des nœuds d'équipement
  const hasInlineFittings = rawSegments.some(
    (s) => Array.isArray(s.fittings) && s.fittings.length > 0
  );
  const migrated = hasInlineFittings
    ? migrateLegacyFittings(initialNodes, rawSegments)
    : { nodes: initialNodes, segments: rawSegments, changed: false };

  // 3. Normalisation des ports et assignation des ports manquants
  const normalized = normalizedGraphPorts(migrated.nodes, migrated.segments);

  // 4. Réorientation des coudes 90° et 45° selon leurs voisins réels
  const reoriented = pdiReorientPorts(normalized.nodes, normalized.segments, {
    adaptElbows: true
  });
  const reorientedNodes = reoriented.nodes;
  if (reoriented.warnings?.length) {
    warnings.push(...reoriented.warnings);
  }

  // 5. Gestion et préservation des lignes de tuyauterie
  const fallbackLine: PipingLine = {
    id: DEFAULT_LINE_ID,
    lineNumber: "L-100",
    service: "PROC",
    dn: 150,
    nps: '6"',
    material: "Acier API 5L Gr. B",
    pressureClass: "Class 300",
    color: "#0284C7"
  };

  let sourceLines: PipingLine[] = Array.isArray(payload.lines) && payload.lines.length > 0
    ? payload.lines.map((line) => ({ ...line }))
    : [fallbackLine];

  // S'assurer que toute ligne référencée par un tronçon existe dans `lines`
  for (const seg of normalized.segments) {
    const lid = seg.lineId || DEFAULT_LINE_ID;
    if (!sourceLines.some((line) => line.id === lid)) {
      sourceLines.push({
        ...fallbackLine,
        id: lid,
        lineNumber: lid
      });
    }
  }

  // 6. Gestion des dimensions : ne conserver que celles dont les ancrages existent
  const validNodeIds = new Set(reorientedNodes.map((n) => n.id));
  const validDimensions: IsoDimension[] = Array.isArray(payload.dimensions)
    ? payload.dimensions
        .filter((dim) => {
          if (!dim) return false;
          const aOk = dim.a?.kind !== "node" || !dim.a?.nodeId || validNodeIds.has(dim.a.nodeId);
          const bOk = dim.b?.kind !== "node" || !dim.b?.nodeId || validNodeIds.has(dim.b.nodeId);
          return aOk && bOk;
        })
        .map((dim) => ({
          id: dim.id || `dim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: dim.type || "distance",
          a: dim.a,
          b: dim.b,
          label: dim.label,
          offset: dim.offset || { x: 0, y: -20 },
          unit: dim.unit || "mm",
          locked: dim.locked ?? false
        }))
    : [];

  // 7. Cotes OCR : strictement conservées sans fabrication artificielle de nœuds ou de géométrie
  const ocrAnnotations = Array.isArray(payload.ocrAnnotations)
    ? payload.ocrAnnotations.map((item) => ({
        text: String(item.text ?? ""),
        valueMm: Number(item.valueMm) || 0,
        source: "ocr" as const
      }))
    : (Array.isArray(payload.metadata?.ocrDimensions)
        ? payload.metadata.ocrDimensions.map((item: any) => ({
            text: String(item.text ?? ""),
            valueMm: Number(item.valueMm) || 0,
            source: "ocr" as const
          }))
        : []);

  return {
    ...payload,
    nodes: reorientedNodes,
    segments: normalized.segments,
    lines: sourceLines,
    dimensions: validDimensions,
    ocrAnnotations: ocrAnnotations.length > 0 ? ocrAnnotations : undefined,
    cad2d: payload.cad2d,
    supports: payload.supports || [],
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

interface StorageReadResult {
  raw: string | null;
  payload: IsoInjectionPayload | null;
  isCorrupt: boolean;
}

function readAndValidateStorage(storage: Storage | null | undefined): StorageReadResult {
  if (!storage) {
    return { raw: null, payload: null, isCorrupt: false };
  }
  let raw: string | null = null;
  try {
    raw = storage.getItem(PDI_PENDING_INJECTION_KEY);
  } catch {
    return { raw: null, payload: null, isCorrupt: false };
  }

  if (!raw) {
    return { raw: null, payload: null, isCorrupt: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.nodes) &&
      parsed.nodes.length > 0
    ) {
      return { raw, payload: parsed as IsoInjectionPayload, isCorrupt: false };
    }
    return { raw, payload: null, isCorrupt: true };
  } catch {
    return { raw, payload: null, isCorrupt: true };
  }
}

/**
 * Lit, valide et nettoie le storage en attente d'injection (Correction B).
 * - Lecture indépendante de sessionStorage et localStorage.
 * - Priorité à sessionStorage si les deux contiennent un payload valide.
 * - Isolation complète des pannes de lecture/JSON/suppression.
 * - Nettoyage des payloads corrompus sans masquer les payloads valides.
 * - Retourne le payload valide ou `null`.
 */
export function consumePendingIsoPayload(): IsoInjectionPayload | null {
  try {
    if (typeof window === "undefined") return null;

    let sessionResult: StorageReadResult = { raw: null, payload: null, isCorrupt: false };
    let localResult: StorageReadResult = { raw: null, payload: null, isCorrupt: false };

    // 1. Lecture indépendante de sessionStorage
    try {
      if (window.sessionStorage) {
        sessionResult = readAndValidateStorage(window.sessionStorage);
      }
    } catch {
      // sessionStorage inaccessible ou désactivé
    }

    // 2. Lecture indépendante de localStorage
    try {
      if (window.localStorage) {
        localResult = readAndValidateStorage(window.localStorage);
      }
    } catch {
      // localStorage inaccessible ou désactivé
    }

    // Purge des entrées corrompues identifiées
    if (sessionResult.isCorrupt) {
      try {
        window.sessionStorage?.removeItem(PDI_PENDING_INJECTION_KEY);
      } catch {}
    }
    if (localResult.isCorrupt) {
      try {
        window.localStorage?.removeItem(PDI_PENDING_INJECTION_KEY);
      } catch {}
    }

    // 3. Arbitrage avec priorité stricte : sessionStorage > localStorage
    if (sessionResult.payload) {
      try {
        window.sessionStorage?.removeItem(PDI_PENDING_INJECTION_KEY);
      } catch {}
      // Si localStorage contenait un résidu, le purger également
      if (localResult.raw) {
        try {
          window.localStorage?.removeItem(PDI_PENDING_INJECTION_KEY);
        } catch {}
      }
      return sessionResult.payload;
    }

    if (localResult.payload) {
      try {
        window.localStorage?.removeItem(PDI_PENDING_INJECTION_KEY);
      } catch {}
      return localResult.payload;
    }

    return null;
  } catch (err) {
    console.warn("[useIsoInjection] Error consuming pending ISO payload:", err);
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
    // Fonction centrale de traitement, déduplication et préparation d'un payload
    const processPayload = (payload: IsoInjectionPayload | null, sourceName?: string) => {
      if (!payload || typeof payload !== "object") return;
      if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) return;

      const transferId = payload.transferId;
      if (transferId) {
        // Déduplication stricte et protection anti-réentrance
        if (processedTransferIds.has(transferId) || inProgressTransferIds.has(transferId)) {
          return;
        }
        inProgressTransferIds.add(transferId);
      }

      try {
        // Préparation et normalisation complète du graphe avant tout commit
        const prepared = prepareInjectedIsoGraph(payload);
        if (!prepared.nodes || prepared.nodes.length === 0) {
          return;
        }

        // Commit du graphe normalisé vers le consommateur (IsometrieModuleV48d)
        // Note architecturale : si onCommit lève une exception après mutation partielle de l'état
        // externe, un rollback transactionnel automatique n'est pas possible au niveau du hook,
        // mais le transferId reste non-validé et inProgress est purgé dans le `finally` pour permettre
        // une reprise / réessai.
        onCommitRef.current(prepared, sourceName || prepared.name);

        // Validation du transfert uniquement après succès réel du commit
        if (transferId) {
          processedTransferIds.add(transferId);
        }
      } finally {
        if (transferId) {
          inProgressTransferIds.delete(transferId);
        }
      }
    };

    // Canal 1 & Canal 2 (Montage initial)
    const initialPayload = consumePendingIsoPayload();
    if (initialPayload) {
      processPayload(initialPayload, initialPayload.name);
    }

    // Canal 1 (Événement temps réel direct)
    const onCustomInject = (e: Event) => {
      const customEv = e as CustomEvent<{
        data: any;
        name?: string;
        projectId?: string;
        open3d?: boolean;
        transferId?: string;
      }>;

      if (customEv.detail && customEv.detail.data) {
        // Nettoyage synchrone de tout résidu éventuel dans le stockage
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(PDI_PENDING_INJECTION_KEY);
            window.localStorage.removeItem(PDI_PENDING_INJECTION_KEY);
          }
        } catch {}

        const rawData = customEv.detail.data;
        const resolvedTransferId =
          customEv.detail.transferId || rawData.transferId;

        const payloadToProcess: IsoInjectionPayload = {
          ...rawData,
          transferId: resolvedTransferId || rawData.transferId
        };

        processPayload(payloadToProcess, customEv.detail.name || rawData.name);
      }
    };

    // Canal 3 (Module ISO redevient actif sans remontage du composant)
    const onActiveModuleChanged = (e: Event) => {
      try {
        if (typeof window === "undefined") return;

        const customEv = e as CustomEvent<{ activeModule?: string; transferId?: string }>;
        const activeModule =
          customEv.detail?.activeModule ||
          window.localStorage.getItem(PDI_ACTIVE_MODULE_KEY);

        // N'intervenir que si le module actif est "isometric"
        if (activeModule !== "isometric") {
          return;
        }

        const pending = consumePendingIsoPayload();
        if (pending) {
          if (customEv.detail?.transferId && !pending.transferId) {
            pending.transferId = customEv.detail.transferId;
          }
          processPayload(pending, pending.name);
        }
      } catch (err) {
        console.warn("[useIsoInjection] active-module-changed handler error:", err);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(EVENT_INJECT_ISO_GRAPH, onCustomInject as EventListener);
      window.addEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged as EventListener);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(EVENT_INJECT_ISO_GRAPH, onCustomInject as EventListener);
        window.removeEventListener(EVENT_ACTIVE_MODULE_CHANGED, onActiveModuleChanged as EventListener);
      }
    };
  }, []);
}
