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

// Registre des identifiants de transferts déjà traités pour garantir l'idempotence absolue
const processedTransferIds = new Set<string>();

/**
 * Réinitialise le registre des transferts traités (utilisé principalement pour les tests).
 */
export function clearProcessedTransferIds(): void {
  processedTransferIds.clear();
}

/**
 * Vérifie si un transfert a déjà été consommé et validé.
 */
export function isTransferProcessed(transferId: string): boolean {
  return processedTransferIds.has(transferId);
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

    // Suppression immédiate et synchrone pour garantir l'idempotence au niveau du stockage
    try {
      window.sessionStorage.removeItem(PDI_PENDING_INJECTION_KEY);
      window.localStorage.removeItem(PDI_PENDING_INJECTION_KEY);
    } catch {}

    const payload = JSON.parse(pendingRaw);

    // Validation structurelle : doit être un objet non vide contenant au moins 1 nœud
    if (payload && typeof payload === "object" && Array.isArray(payload.nodes) && payload.nodes.length > 0) {
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
    // Fonction centrale de traitement, déduplication et préparation d'un payload
    const processPayload = (payload: IsoInjectionPayload | null, sourceName?: string) => {
      if (!payload || typeof payload !== "object") return;
      if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) return;

      const transferId = payload.transferId;
      if (transferId) {
        // Déduplication stricte par identifiant stable de transfert
        if (processedTransferIds.has(transferId)) {
          return;
        }
        processedTransferIds.add(transferId);
      }

      // Préparation et normalisation complète du graphe avant tout commit
      const prepared = prepareInjectedIsoGraph(payload);
      onCommitRef.current(prepared, sourceName || prepared.name);
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
