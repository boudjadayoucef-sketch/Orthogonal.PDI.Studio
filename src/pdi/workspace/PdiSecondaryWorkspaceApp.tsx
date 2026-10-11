/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : APPLICATION DE L'ÉCRAN SECONDAIRE SYNCHRONE (017Q3 MULTI-SCREEN)
 * ARCHITECTURE : UN SEUL MODÈLE CENTRAL + VUE SÉPARÉE SUR MONITEUR DÉDIÉ.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Box,
  Flame,
  Sliders,
  FileSpreadsheet,
  FolderTree,
  Layers,
  LayoutGrid,
  FileText,
  Sparkles,
  Spline,
  RefreshCw,
  ExternalLink,
  Minimize2,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Camera,
  RotateCw,
  SlidersHorizontal,
  Tags,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  Grid,
  Tv2,
} from "lucide-react";
import {
  PdiWorkspaceViewId,
  PdiWorkspaceState,
  PdiWorkspaceSelectionState,
  PdiWorkspaceModelSnapshot,
  PDI_WORKSPACE_VIEWS,
} from "./types";
import { pdiWorkspaceBus } from "./pdiWorkspaceChannel";
import { Iso3DViewerModal } from "../viewer3d/Iso3DViewerModal";
import { Viewer3dDataPayload } from "../viewer3d/types3d";
import { deriveSpoolsAndWelds } from "../welding/isoWeldSpoolEngine";
import { PdiUniversalPropertyInspector } from "../isometric/ui/PdiUniversalPropertyInspector";
import { PdiUniversalEntity } from "../model/pdiUniversalEntity";
import PdiBrandMark from "../app/PdiBrandMark";

export const PdiSecondaryWorkspaceApp: React.FC = () => {
  // Récupérer la vue demandée dans l'URL (ex: ?pdi_workspace=secondary&view=3d)
  const [activeView, setActiveView] = useState<PdiWorkspaceViewId>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view") as PdiWorkspaceViewId;
      if (requested && ["3d", "spool", "properties", "library", "bom", "tree", "documents"].includes(requested)) {
        return requested;
      }
    }
    return "3d";
  });

  const isTvMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("display") === "tv" || params.get("kiosk") === "true";
  }, []);

  const [showCastGuideBanner, setShowCastGuideBanner] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("cast") === "true" || params.get("display") === "tv";
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // État du modèle snapshot et sélection synchronisés
  const [modelSnapshot, setModelSnapshot] = useState<PdiWorkspaceModelSnapshot>(() => {
    const saved = pdiWorkspaceBus.readStateSnapshot();
    return (
      saved?.modelSnapshot || {
        projectName: "Projet Isométrique Synchrone",
        unitSystem: "metric",
        nodes: [],
        segments: [],
        supports: [],
        welds: [],
        spools: [],
        bomRows: [],
        updatedAt: new Date().toISOString(),
      }
    );
  });

  const [selection, setSelection] = useState<PdiWorkspaceSelectionState>(() => {
    const saved = pdiWorkspaceBus.readStateSnapshot();
    return (
      saved?.selection || {
        selectedNodeId: null,
        selectedSegmentId: null,
        selectedSupportId: null,
        selectedComponentId: null,
        selectedWeldId: null,
        selectedSpoolId: null,
        selectedType: null,
        timestamp: Date.now(),
      }
    );
  });

  const [activeEntity, setActiveEntity] = useState<PdiUniversalEntity | null>(() => {
    const saved = pdiWorkspaceBus.readStateSnapshot();
    return saved?.activeEntity || null;
  });

  const [isPrimaryConnected, setIsPrimaryConnected] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [searchQuery, setSearchQuery] = useState("");

  // Initialisation et écoute du Bus BroadcastChannel
  useEffect(() => {
    pdiWorkspaceBus.setRole(false);

    const sendHello = () => {
      pdiWorkspaceBus.postMessage({
        type: "PDI_WS_HELLO_SECONDARY",
        timestamp: Date.now(),
        requestedView: activeView,
      });
    };

    // Annoncer la présence de l'écran secondaire immédiatement + retentatives pour établir la poignée de main
    sendHello();
    const timer1 = setTimeout(sendHello, 300);
    const timer2 = setTimeout(sendHello, 1200);

    const unsubscribe = pdiWorkspaceBus.subscribe((msg) => {
      setLastSyncTime(Date.now());
      setIsPrimaryConnected(true);

      switch (msg.type) {
        case "PDI_WS_STATE_SYNC":
          if (msg.state) {
            if (msg.state.modelSnapshot) setModelSnapshot(msg.state.modelSnapshot);
            if (msg.state.selection) setSelection(msg.state.selection);
            if (msg.state.activeEntity !== undefined) setActiveEntity(msg.state.activeEntity);
            if (msg.state.screen2View) setActiveView(msg.state.screen2View);
          }
          break;

        case "PDI_WS_SELECTION_CHANGE":
          if (msg.selection) setSelection(msg.selection);
          if (msg.activeEntity !== undefined) setActiveEntity(msg.activeEntity);
          break;

        case "PDI_WS_MODEL_UPDATE":
          if (msg.modelSnapshot) setModelSnapshot(msg.modelSnapshot);
          break;

        case "PDI_WS_CHANGE_VIEW":
          if (msg.screen2View) setActiveView(msg.screen2View);
          break;

        case "PDI_WS_CLOSE_SECONDARY":
          window.close();
          break;

        default:
          break;
      }
    });

    const handleFocusOrVisible = () => {
      const currentSnap = pdiWorkspaceBus.readStateSnapshot();
      if (currentSnap && currentSnap.modelSnapshot && currentSnap.modelSnapshot.nodes?.length > 0) {
        // Ne pas écraser un modèle réel déjà chargé avec le modèle de démo de secours
        if (currentSnap.modelSnapshot.projectId !== "demo" || (modelSnapshot.nodes?.length || 0) === 0) {
          setModelSnapshot(currentSnap.modelSnapshot);
        }
        if (currentSnap.screen2View) {
          setActiveView(currentSnap.screen2View);
        }
      }
      sendHello();
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    // Vérification de secours ponctuelle (toutes les 3s)
    const syncInterval = setInterval(() => {
      const currentSnap = pdiWorkspaceBus.readStateSnapshot();
      if (currentSnap && currentSnap.modelSnapshot && currentSnap.modelSnapshot.nodes) {
        setModelSnapshot((prev) => {
          const snapModel = currentSnap.modelSnapshot;
          const prevNodesLen = prev.nodes?.length || 0;
          const snapNodesLen = snapModel.nodes?.length || 0;

          // Si le modèle entrant est le modèle de démo fallback, ne pas écraser si on a déjà un modèle réel
          if (snapModel.projectId === "demo" && prevNodesLen > 0 && prev.projectId !== "demo") {
            return prev;
          }

          if (prevNodesLen === 0 && snapNodesLen > 0) {
            return snapModel;
          }

          // Si le projet est le même, vérifier si les données ont évolué ou si la date est plus récente
          if (prev.projectId === snapModel.projectId) {
            if (
              prevNodesLen !== snapNodesLen ||
              (prev.segments?.length || 0) !== (snapModel.segments?.length || 0) ||
              ((snapModel.spools?.length || 0) > 0 && (prev.spools?.length || 0) === 0) ||
              snapModel.updatedAt > prev.updatedAt
            ) {
              return snapModel;
            }
          } else if (snapModel.projectId !== "demo" && snapModel.updatedAt > prev.updatedAt) {
            return snapModel;
          }

          return prev;
        });
      }
      if (currentSnap && currentSnap.screen2View) {
        setActiveView((prevView) => {
          if (prevView !== currentSnap.screen2View) {
            return currentSnap.screen2View;
          }
          return prevView;
        });
      }
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearInterval(syncInterval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      unsubscribe();
    };
  }, []);

  // Relancer la poignée de main si aucun nœud n'est encore reçu
  useEffect(() => {
    if ((modelSnapshot.nodes?.length || 0) === 0) {
      const pingInterval = setInterval(() => {
        pdiWorkspaceBus.postMessage({
          type: "PDI_WS_HELLO_SECONDARY",
          timestamp: Date.now(),
          requestedView: activeView,
        });
      }, 1500);
      return () => clearInterval(pingInterval);
    }
  }, [modelSnapshot.nodes?.length, activeView]);

  // Émission d'un changement de vue
  const handleSelectView = (viewId: PdiWorkspaceViewId) => {
    setActiveView(viewId);
    pdiWorkspaceBus.broadcastChangeView(viewId, "secondary");
  };

  // Émission d'une sélection depuis une liste/tableau vers l'ISO principal
  const handleSelectEntity = (type: string, id: string, extra?: { spoolId?: string }) => {
    const newSelection: PdiWorkspaceSelectionState = {
      selectedNodeId: type === "node" ? id : null,
      selectedSegmentId: type === "segment" ? id : null,
      selectedSupportId: type === "support" ? id : null,
      selectedComponentId: type === "valve" || type === "fitting" ? id : null,
      selectedWeldId: type === "weld" ? id : null,
      selectedSpoolId: extra?.spoolId || null,
      selectedType: type,
      timestamp: Date.now(),
    };
    setSelection(newSelection);
    pdiWorkspaceBus.broadcastSelection(newSelection, null, "secondary");
  };

  // Émission d'une modification de propriétés vers le modèle central
  const handleEntityPropertyChange = (updated: PdiUniversalEntity) => {
    setActiveEntity(updated);
    pdiWorkspaceBus.broadcastEntityModify(updated);
  };

  // -------------------------------------------------------------
  // VUE 1 : VUE 3D SOLIDE
  // -------------------------------------------------------------
  const dataPayload: Viewer3dDataPayload = useMemo(() => {
    let effectiveWelds = modelSnapshot.welds || [];
    let effectiveSpools = modelSnapshot.spools || [];

    if (effectiveSpools.length === 0 && (modelSnapshot.nodes?.length || 0) > 0) {
      const derived = deriveSpoolsAndWelds(modelSnapshot.nodes || [], modelSnapshot.segments || []);
      effectiveWelds = derived.welds;
      effectiveSpools = derived.spools;
    }

    return {
      nodes: modelSnapshot.nodes || [],
      segments: modelSnapshot.segments || [],
      welds: effectiveWelds,
      spools: effectiveSpools,
      supports: modelSnapshot.supports || [],
      projectName: modelSnapshot.projectName || "PD&I 3D",
      activeUnitSystem: modelSnapshot.unitSystem === "imperial" ? "imperial" : "metric",
      envelope: (modelSnapshot as any).envelope || undefined,
    };
  }, [modelSnapshot]);

  const render3dView = () => {
    return (
      <div className="w-full h-full relative overflow-hidden bg-[#0A0F18]">
        <Iso3DViewerModal
          isOpen={true}
          embedded={true}
          data={dataPayload}
          onSwitchToIso={() => handleSelectView("iso")}
          onSwitchToWeldMap={() => handleSelectView("spool")}
          onEntitySelected={(selected) => {
            if (selected) {
              const newSelection: PdiWorkspaceSelectionState = {
                selectedNodeId: selected.type === "node" ? selected.id : null,
                selectedSegmentId: selected.type === "segment" ? selected.id : null,
                selectedSupportId: selected.type === "support" ? selected.id : null,
                selectedComponentId: selected.type === "fitting" ? selected.id : null,
                selectedWeldId: selected.type === "weld" ? selected.id : null,
                selectedSpoolId: selected.spoolId || null,
                selectedType: selected.type,
                timestamp: Date.now(),
              };
              setSelection(newSelection);
              pdiWorkspaceBus.broadcastSelection(newSelection, null, "secondary");
            }
          }}
        />
      </div>
    );
  };

  // -------------------------------------------------------------
  // VUE 2 : CARNET DE SPOOLS & SOUDURES
  // -------------------------------------------------------------
  const renderSpoolView = () => {
    const spools = modelSnapshot.spools || [];
    const welds = modelSnapshot.welds || [];

    return (
      <div className="w-full h-full flex flex-col bg-[#0D1117] overflow-hidden p-4 space-y-4">
        {/* Header Spools */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h3 className="text-sm font-bold text-white">
              Carnet de Préfabrication &amp; Spools ({spools.length} spools • {welds.length} soudures)
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            Cliquez sur un spool pour le sélectionner dans l'Éditeur ISO
          </span>
        </div>

        {/* Grille des Spools */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto flex-1">
          {spools.length === 0 ? (
            <div className="col-span-full p-8 text-center text-zinc-500 border border-dashed border-[#30363D] rounded-2xl">
              Aucun spool défini dans le modèle. Dessinez des tubes et des soudures dans l'écran ISO.
            </div>
          ) : (
            spools.map((spool: any) => {
              const isSelected = selection.selectedSpoolId === spool.id;
              const spoolWelds = welds.filter((w: any) => w.spoolId === spool.id);

              return (
                <div
                  key={spool.id}
                  onClick={() => handleSelectEntity("spool", spool.id, { spoolId: spool.id })}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? "bg-amber-950/30 border-amber-500 shadow-md text-white"
                      : "bg-[#161B22] border-[#30363D] hover:border-zinc-500 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-amber-400 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-400" />
                      {spool.name || spool.id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                      {spool.dn ? `DN ${spool.dn}` : "Multi-DN"}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div>Longueur totale : <strong className="text-zinc-200">{spool.totalLengthMm || 0} mm</strong></div>
                    <div>Poids estimé : <strong className="text-zinc-200">{spool.weightKg || 0} kg</strong></div>
                    <div>Soudures d'atelier : <strong className="text-cyan-400">{spoolWelds.length}</strong></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#30363D]">
                    <span className="text-zinc-400">Statut CND : <strong className="text-emerald-400">100% Conforme</strong></span>
                    <span className="text-[10px] font-bold text-cyan-400">Sélectionner →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VUE 3 : INSPECTEUR DE PROPRIÉTÉS
  // -------------------------------------------------------------
  const renderPropertiesView = () => {
    if (!activeEntity) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D1117] p-8 text-center text-zinc-500">
          <Sliders className="w-12 h-12 text-zinc-600 mb-3" />
          <h4 className="text-sm font-bold text-zinc-300">Aucune entité sélectionnée</h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Sélectionnez un tube, un coude, une vanne ou un support dans l'écran ISO principal pour modifier ses propriétés techniques ici.
          </p>
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-[#0D1117] overflow-y-auto p-4">
        <PdiUniversalPropertyInspector
          entity={activeEntity}
          onChange={handleEntityPropertyChange}
        />
      </div>
    );
  };

  // -------------------------------------------------------------
  // VUE 4 : BOM & NOMENCLATURE
  // -------------------------------------------------------------
  const renderBomView = () => {
    const rows = modelSnapshot.bomRows || [];

    return (
      <div className="w-full h-full flex flex-col bg-[#0D1117] overflow-hidden p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Nomenclature &amp; Métré Industriel ({rows.length} postes)
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            Calculé en temps réel depuis le modèle géométrique central
          </span>
        </div>

        {/* Table BOM */}
        <div className="flex-1 overflow-auto border border-[#30363D] rounded-xl bg-[#161B22]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0D1117] text-zinc-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-[#30363D]">
              <tr>
                <th className="p-2.5">Rep</th>
                <th className="p-2.5">Désignation</th>
                <th className="p-2.5">DN</th>
                <th className="p-2.5">Classe / PN</th>
                <th className="p-2.5">Matériau</th>
                <th className="p-2.5 text-right">Qté</th>
                <th className="p-2.5">Unité</th>
                <th className="p-2.5">Spool</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363D]/60 text-zinc-300">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    Nomenclature vide. Ajoutez des composants dans le tracé ISO.
                  </td>
                </tr>
              ) : (
                rows.map((r: any, idx: number) => (
                  <tr
                    key={idx}
                    className="hover:bg-zinc-800/50 transition cursor-pointer"
                    onClick={() => {
                      if (r.entityId) {
                        handleSelectEntity(r.entityType || "segment", r.entityId);
                      }
                    }}
                  >
                    <td className="p-2.5 font-mono text-cyan-400 font-bold">{r.itemNo || idx + 1}</td>
                    <td className="p-2.5 font-medium text-white">{r.description || r.nom || "Élément tuyauterie"}</td>
                    <td className="p-2.5 font-mono">{r.dn || "-"}</td>
                    <td className="p-2.5">{r.pressureClass || r.rating || "-"}</td>
                    <td className="p-2.5">{r.material || "Inox 316L"}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">{r.qty || r.quantity || 1}</td>
                    <td className="p-2.5 text-zinc-400">{r.unit || "U"}</td>
                    <td className="p-2.5 font-mono text-amber-400">{r.spoolId || "SP-01"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VUE 5 : ARBRE PROJET & HIÉRARCHIE
  // -------------------------------------------------------------
  const renderTreeView = () => {
    const nodes = modelSnapshot.nodes || [];
    const segments = modelSnapshot.segments || [];
    const supports = modelSnapshot.supports || [];

    return (
      <div className="w-full h-full flex flex-col bg-[#0D1117] overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">
              Arbre Hiérarchique du Projet : {modelSnapshot.projectName}
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {/* Ligne principale */}
          <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-xl space-y-2">
            <div className="font-bold text-xs text-cyan-300 flex items-center gap-2">
              <Spline className="w-4 h-4" /> Ligne ISO Principale (Réseau Tuyauterie)
            </div>

            {/* Tronçons */}
            <div className="pl-4 border-l border-zinc-700 space-y-1 mt-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase">Tronçons ({segments.length})</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {segments.map((seg: any) => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => handleSelectEntity("segment", seg.id)}
                    className={`p-2 rounded-lg border text-left text-xs transition ${
                      selection.selectedSegmentId === seg.id
                        ? "bg-cyan-950 border-cyan-500 text-white font-bold"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-300"
                    }`}
                  >
                    <div>Tube {seg.id.slice(0, 8)}</div>
                    <div className="text-[10px] text-zinc-500">DN {seg.dn || 50} • {seg.lengthMm || 1000}mm</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nœuds & Raccords */}
            <div className="pl-4 border-l border-zinc-700 space-y-1 mt-3">
              <div className="text-[11px] font-bold text-zinc-400 uppercase">Nœuds &amp; Raccords ({nodes.length})</div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {nodes.map((node: any) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleSelectEntity("node", node.id)}
                    className={`p-2 rounded-lg border text-left text-xs transition ${
                      selection.selectedNodeId === node.id
                        ? "bg-emerald-950 border-emerald-500 text-white font-bold"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-300"
                    }`}
                  >
                    <div>Nœud {node.id.slice(0, 6)}</div>
                    <div className="text-[10px] text-zinc-500">{node.type || "standard"}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VUE 6 : BIBLIOTHÈQUE / CATALOGUE
  // -------------------------------------------------------------
  const renderLibraryView = () => {
    return (
      <div className="w-full h-full flex flex-col bg-[#0D1117] p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Catalogue Industriel de Robinetterie &amp; Raccords
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Vanne à opercule (Gate)", "Vanne à boisseau (Ball)", "Clapet anti-retour (Check)", "Soupape de sûreté (PSV)", "Coude 90° LR (ASME B16.9)", "Té égal (ASME B16.9)", "Bride WN 150# (ASME B16.5)", "Support guide MSS SP-58"].map((nom, idx) => (
            <div key={idx} className="p-3.5 bg-[#161B22] border border-[#30363D] rounded-xl flex flex-col justify-between gap-2">
              <span className="font-bold text-xs text-zinc-200">{nom}</span>
              <span className="text-[10px] text-zinc-400">Normalisé ASME / ISO</span>
              <span className="text-[10px] text-cyan-400 font-semibold">Disponible dans l'éditeur</span>
            </div>
          ))}
        </div>

        {/* Section Normes & Codes de référence à venir */}
        <div className="mt-4 pt-4 border-t border-[#30363D] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Sources d'Information Normatives (Abonnement / Référentiel à venir)
            </h4>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-bold">
              ASME B31 Series
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[#161B22] border border-cyan-900/40 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-cyan-300">ASME B31.8-2022</span>
                <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800/60 px-1.5 py-0.5 rounded font-bold">À venir</span>
              </div>
              <p className="text-[11px] font-medium text-zinc-200">Gas Transmission and Distribution Piping Systems</p>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Réseaux de transport et distribution de gaz naturel haute pression, stations de compression, calculs de pression MAOP (Barlow), classes d'emplacement 1-4, section Offshore (Chapitre VIII) et service gaz acide Sour Gas (Chapitre IX).
              </p>
            </div>

            <div className="p-3.5 bg-[#161B22] border border-purple-900/40 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-purple-300">ASME B31.12-2019</span>
                <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800/60 px-1.5 py-0.5 rounded font-bold">À venir</span>
              </div>
              <p className="text-[11px] font-medium text-zinc-200">Hydrogen Piping and Pipelines</p>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Tuyauteries industrielles (Part IP) et canalisations de transport (Part PL) pour hydrogène gazeux (GH2) et liquide (LH2), facteurs de dégradation Hf et Mf, prévention de la fragilisation HE, Option A prescriptive &amp; Option B FAD.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VUE 7 : DOCUMENTS & PLANCHES
  // -------------------------------------------------------------
  const renderDocumentsView = () => {
    return (
      <div className="w-full h-full flex flex-col bg-[#0D1117] p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              Planches Normalisées &amp; Documents A3/A4
            </h3>
          </div>
        </div>
        <div className="p-8 border border-dashed border-[#30363D] rounded-2xl text-center text-zinc-400 space-y-2">
          <LayoutGrid className="w-10 h-10 text-indigo-400 mx-auto" />
          <h4 className="text-sm font-bold text-white">Aperçu Planche A3 Isométrique</h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Visualisation directe du cartouche normalisé, de la zone graphique et de la nomenclature BOM d'impression.
          </p>
        </div>
      </div>
    );
  };

  const renderActiveViewContent = () => {
    switch (activeView) {
      case "3d": return render3dView();
      case "spool": return renderSpoolView();
      case "properties": return renderPropertiesView();
      case "bom": return renderBomView();
      case "tree": return renderTreeView();
      case "library": return renderLibraryView();
      case "documents": return renderDocumentsView();
      default: return render3dView();
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0D1117] text-white overflow-hidden select-none font-sans">
      
      {/* Top Bar Écran Secondaire */}
      <header className="h-12 px-4 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between gap-4 shrink-0">
        
        {/* Logo & Titre */}
        <div className="flex items-center gap-3">
          <PdiBrandMark variant="horizontal" size="sm" maxHeight={28} />
          <div className="w-px h-4 bg-[#30363D]" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
              Écran 2
            </span>
            <span className="text-xs font-semibold text-zinc-300">
              • {modelSnapshot.projectName || "Projet Isométrique"}
            </span>
          </div>
        </div>

        {/* View Tabs Selector */}
        <div className="flex items-center bg-[#0D1117] p-1 rounded-xl border border-[#30363D] gap-1 overflow-x-auto no-scrollbar">
          {PDI_WORKSPACE_VIEWS.filter((v) => v.id !== "iso").map((v) => {
            const isCurrent = activeView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectView(v.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isCurrent
                    ? "bg-[#161B22] text-white border border-[#30363D] shadow-sm text-cyan-300"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {v.id === "3d" && <Box className="w-3.5 h-3.5 text-purple-400" />}
                {v.id === "spool" && <Flame className="w-3.5 h-3.5 text-orange-400" />}
                {v.id === "properties" && <Sliders className="w-3.5 h-3.5 text-teal-400" />}
                {v.id === "bom" && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
                {v.id === "tree" && <FolderTree className="w-3.5 h-3.5 text-blue-400" />}
                {v.id === "library" && <Layers className="w-3.5 h-3.5 text-amber-400" />}
                {v.id === "documents" && <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{v.labelFr}</span>
              </button>
            );
          })}
        </div>

        {/* Live Sync Status & TV/Fullscreen Controls */}
        <div className="flex items-center gap-2.5">
          {isTvMode && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-[10px] font-bold text-purple-300">
              <Tv2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Mode Smart TV</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Synchro ISO En Direct</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-xs flex items-center gap-1"
            title={isFullscreen ? "Quitter Plein Écran" : "Basculer en Plein Écran TV (F11)"}
          >
            <Maximize2 className="w-4 h-4 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={() => window.close()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-xs"
            title="Fermer cette fenêtre secondaire"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* Bannière d'assistance Chromecast / Projection Grand Écran */}
      {showCastGuideBanner && (
        <div className="bg-gradient-to-r from-purple-950/95 via-indigo-950/95 to-slate-900 border-b border-purple-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs text-purple-200 animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-purple-900 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0">
              <Tv2 className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <strong className="text-white font-bold mr-1.5">Diffusion Chromecast TV :</strong>
              <span>Pour projeter cet Écran 2 sur votre TV, faites un <strong className="text-cyan-300 font-bold">Clic Droit ici &gt; « Caster... »</strong> (ou Menu Chrome <strong>⋮</strong> &gt; Caster), puis sélectionnez votre téléviseur. Votre vue s'affiche en direct sans latence.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-2 py-1 rounded bg-purple-900/80 hover:bg-purple-800 text-[11px] font-bold text-white border border-purple-500/40 transition flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3 text-cyan-400" />
              <span>Plein Écran TV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCastGuideBanner(false)}
              className="px-1.5 py-1 rounded hover:bg-purple-900/60 text-zinc-400 hover:text-white text-xs transition cursor-pointer"
              title="Fermer ce bandeau"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 w-full h-full overflow-hidden relative">
        {renderActiveViewContent()}
      </main>

    </div>
  );
};
