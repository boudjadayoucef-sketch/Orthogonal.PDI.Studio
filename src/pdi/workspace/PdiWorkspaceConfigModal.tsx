/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : MODALE DE CONFIGURATION DE L'ESPACE DE TRAVAIL, DOUBLE ÉCRAN & CAST SMART TV (017Q3)
 */

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  Monitor,
  Tv2,
  SplitSquareVertical,
  CheckCircle2,
  X,
  Sparkles,
  Sliders,
  Box,
  Flame,
  Layers,
  FileSpreadsheet,
  FolderTree,
  LayoutGrid,
  Spline,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye,
  Info,
  Laptop,
  Cast,
  QrCode,
  Copy,
  Check,
  Radio,
  Maximize,
  Smartphone,
} from "lucide-react";
import {
  PdiWorkspaceConfig,
  PdiWorkspaceMode,
  PdiWorkspaceProfileId,
  PdiWorkspaceViewId,
  PDI_WORKSPACE_PROFILES,
  PDI_WORKSPACE_VIEWS,
} from "./types";
import { detectPdiScreens, PdiScreenDetectionResult, calculateSecondaryWindowBounds } from "./pdiScreenDetection";
import { pdiWorkspaceBus } from "./pdiWorkspaceChannel";

interface PdiWorkspaceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PdiWorkspaceConfig;
  onSaveConfig: (newConfig: PdiWorkspaceConfig) => void;
  isSecondaryConnected: boolean;
  onOpenSecondaryWindow: (view: PdiWorkspaceViewId) => void;
  onCloseSecondaryWindow: () => void;
}

export const PdiWorkspaceConfigModal: React.FC<PdiWorkspaceConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  isSecondaryConnected,
  onOpenSecondaryWindow,
  onCloseSecondaryWindow,
}) => {
  const [activeModalTab, setActiveModalTab] = useState<"dual_screen" | "smart_tv">("dual_screen");
  const [localConfig, setLocalConfig] = useState<PdiWorkspaceConfig>(config);
  const [screenDetails, setScreenDetails] = useState<PdiScreenDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [castStatus, setCastStatus] = useState<string>("");

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Détection des écrans au montage de la modale
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setIsDetecting(true);
    detectPdiScreens()
      .then((res) => {
        if (mounted) {
          setScreenDetails(res);
          setIsDetecting(false);
        }
      })
      .catch(() => {
        if (mounted) setIsDetecting(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Génération du QR code dynamique pour la Smart TV
  const getTvBroadcastUrl = (viewId: PdiWorkspaceViewId) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?pdi_workspace=secondary&view=${viewId}&display=tv&kiosk=true`;
  };

  const currentTvUrl = getTvBroadcastUrl(localConfig.screen2View);

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(currentTvUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: "#00E5FF",
        light: "#090D14",
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.warn("Erreur génération QR Code:", err));
  }, [isOpen, currentTvUrl]);

  if (!isOpen) return null;

  const handleSelectProfile = (profileId: PdiWorkspaceProfileId) => {
    const profile = PDI_WORKSPACE_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;

    const updated: PdiWorkspaceConfig = {
      ...localConfig,
      profile: profileId,
      screen1View: profile.screen1View,
      screen2View: profile.screen2View,
    };
    setLocalConfig(updated);
    onSaveConfig(updated);
  };

  const handleModeChange = (mode: PdiWorkspaceMode) => {
    const updated: PdiWorkspaceConfig = {
      ...localConfig,
      mode,
    };
    setLocalConfig(updated);
    onSaveConfig(updated);

    if (mode === "single_screen") {
      onCloseSecondaryWindow();
    } else if (mode === "dual_screen" && !isSecondaryConnected) {
      onOpenSecondaryWindow(updated.screen2View);
    }
  };

  const handleScreen2ViewChange = (viewId: PdiWorkspaceViewId) => {
    const updated: PdiWorkspaceConfig = {
      ...localConfig,
      profile: "custom",
      screen2View: viewId,
    };
    setLocalConfig(updated);
    onSaveConfig(updated);

    if (isSecondaryConnected) {
      pdiWorkspaceBus.broadcastChangeView(viewId, "primary");
    }
  };

  const handleLaunchSecondary = () => {
    onOpenSecondaryWindow(localConfig.screen2View);
  };

  const handleCopyTvUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentTvUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const handleLaunchSecondaryForCast = () => {
    const tvCastUrl = `${window.location.origin}${window.location.pathname}?pdi_workspace=secondary&view=${localConfig.screen2View}&display=tv&kiosk=true&cast=true`;
    window.open(tvCastUrl, "pdi_tv_cast_window", "menubar=no,toolbar=no,location=no,status=no,resizable=yes");
    setCastStatus("Fenêtre Écran 2 prête ! Clic-droit sur ce nouvel onglet > « Caster... » pour afficher sur votre Chromecast.");
    setTimeout(() => setCastStatus(""), 8000);
  };

  const handleNativeCast = async () => {
    setCastStatus("Recherche d'écrans ou Smart TV compatibles...");
    try {
      // 1. Essai via Presentation API standard W3C (Chrome / Edge / Android)
      const nav = navigator as any;
      if (nav.presentation && nav.presentation.defaultRequest) {
        const connection = await nav.presentation.defaultRequest.start();
        setCastStatus("Projection sans fil connectée avec succès !");
        connection.addEventListener("close", () => {
          console.log("Cast connection closed, fallback to dedicated tab");
          handleLaunchSecondaryForCast();
        });
        return;
      }
      if (typeof (window as any).PresentationRequest !== "undefined") {
        const presentationRequest = new (window as any).PresentationRequest([currentTvUrl]);
        const connection = await presentationRequest.start();
        setCastStatus("Diffusion sur écran distant établie !");
        connection.addEventListener("close", () => {
          console.log("Cast connection closed, fallback to dedicated tab");
          handleLaunchSecondaryForCast();
        });
        return;
      }
    } catch (err: any) {
      console.log("Cast prompt notice:", err);
    }

    // 2. Si l'API native n'est pas acceptée directement, ouvrir la fenêtre secondaire optimisée TV
    handleLaunchSecondaryForCast();
  };

  return (
    <div className="pdi-modal-backdrop fixed inset-0 z-[100200] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#0D1117] border border-[#30363D] rounded-2xl shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header (Fixé en haut) */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
              <SplitSquareVertical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Espace de Travail &amp; Multi-Écran PD&amp;I
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  017Q3 Foundation
                </span>
                {isSecondaryConnected ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Écran 2 Connecté
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Écran 2 En attente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Un seul modèle géométrique centralisé • Affichage synchronisé bidirectionnel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Fermer la fenêtre (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Onglets de la Modale */}
        <div className="shrink-0 px-5 pt-3 bg-[#11161F] border-b border-[#30363D] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModalTab("dual_screen")}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold transition-all flex items-center gap-2 border-t border-x ${
              activeModalTab === "dual_screen"
                ? "bg-[#0D1117] text-cyan-300 border-[#30363D] border-b-transparent shadow-sm"
                : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span>Moniteur PC &amp; Double Écran</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab("smart_tv")}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold transition-all flex items-center gap-2 border-t border-x ${
              activeModalTab === "smart_tv"
                ? "bg-[#0D1117] text-purple-300 border-[#30363D] border-b-transparent shadow-sm"
                : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <Tv2 className="w-4 h-4 text-purple-400" />
            <span>Caster / Projeter sur Smart TV Android</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-950 text-purple-300 border border-purple-500/40">
              Sans Fil
            </span>
          </button>
        </div>

        {/* Contenu Déroulant (Scrollable avec max-h calculé) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5" style={{ maxHeight: "calc(86vh - 130px)" }}>

          {activeModalTab === "dual_screen" ? (
            <>
              {/* Section 1 : Mode d'affichage */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  1. Mode d'affichage principal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1 : Écran Unique */}
                  <button
                    type="button"
                    onClick={() => handleModeChange("single_screen")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      localConfig.mode === "single_screen"
                        ? "bg-[#161B22] border-cyan-500/80 shadow-md shadow-cyan-950/40 text-white"
                        : "bg-[#0D1117] border-[#30363D] hover:border-zinc-500 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${localConfig.mode === "single_screen" ? "bg-cyan-950 text-cyan-400" : "bg-zinc-800 text-zinc-400"}`}>
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm text-white">Mode 1 — Écran Unique</span>
                        {localConfig.mode === "single_screen" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Espace de travail classique intégré sur un seul moniteur (modales contextuelles et panneaux latéraux).
                      </p>
                    </div>
                  </button>

                  {/* Option 2 : Double Écran */}
                  <button
                    type="button"
                    onClick={() => handleModeChange("dual_screen")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      localConfig.mode === "dual_screen"
                        ? "bg-[#161B22] border-cyan-500/80 shadow-md shadow-cyan-950/40 text-white"
                        : "bg-[#0D1117] border-[#30363D] hover:border-zinc-500 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${localConfig.mode === "dual_screen" ? "bg-cyan-950 text-cyan-400" : "bg-zinc-800 text-zinc-400"}`}>
                      <Tv2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm text-white">Mode 2 — Double Écran Synchrone</span>
                        {localConfig.mode === "dual_screen" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Détache la 2e vue dans une fenêtre dédiée (3D, Spools, Propriétés, BOM) avec synchronisation temps réel.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 2 : Carte Interactive Écran 1 & Écran 2 */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  2. Disposition des écrans &amp; Vues associées
                </label>
                <div className="p-3.5 bg-[#161B22] border border-[#30363D] rounded-xl flex flex-col md:flex-row items-center gap-3">
                  
                  {/* Écran 1 */}
                  <div className="flex-1 w-full p-3 bg-[#0D1117] border border-[#30363D] rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" /> Écran 1 (Moniteur Principal)
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                        Verrouillé
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900/90 border border-cyan-500/20 flex items-center gap-2.5">
                      <Spline className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">Éditeur Isométrique ISO 30°</div>
                        <div className="text-[10px] text-zinc-400 truncate">Modélisation tuyauterie, nœuds &amp; cotations</div>
                      </div>
                    </div>
                  </div>

                  {/* Sync Connector */}
                  <div className="flex flex-col items-center justify-center text-zinc-500 shrink-0">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded-full border border-emerald-500/30">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Modèle Unique</span>
                    </div>
                    <div className="hidden md:flex items-center my-0.5 text-zinc-600">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Écran 2 */}
                  <div className="flex-1 w-full p-3 bg-[#0D1117] border border-[#30363D] rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tv2 className="w-3.5 h-3.5" /> Écran 2 (Moniteur Secondaire)
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold">
                        Détachable
                      </span>
                    </div>
                    
                    {/* Selecteur de vue pour l'écran 2 */}
                    <select
                      value={localConfig.screen2View}
                      onChange={(e) => handleScreen2ViewChange(e.target.value as PdiWorkspaceViewId)}
                      className="w-full bg-[#161B22] border border-[#30363D] text-white text-xs font-medium rounded-lg p-2 outline-none focus:border-cyan-500 transition cursor-pointer"
                    >
                      {PDI_WORKSPACE_VIEWS.filter((v) => v.id !== "iso").map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.labelFr} — {v.descriptionFr.slice(0, 36)}...
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* Section 3 : Profils Métier Prédéfinis */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  3. Profils d'espace de travail recommandés
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {PDI_WORKSPACE_PROFILES.map((p) => {
                    const isSelected = localConfig.profile === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProfile(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? "bg-[#161B22] border-cyan-500/80 shadow-sm text-white"
                            : "bg-[#0D1117] border-[#30363D] hover:border-zinc-600 text-zinc-300 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs truncate flex items-center gap-1.5">
                            {p.labelFr}
                          </span>
                          {p.badge && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                              {p.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {p.descriptionFr}
                        </p>
                        <div className="flex items-center gap-1.5 text-[9.5px] text-zinc-400 mt-0.5 pt-1 border-t border-[#30363D]/60 font-mono">
                          <span>Écran 2:</span>
                          <span className="text-cyan-300 font-bold uppercase">{p.screen2View}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 4 : Diagnostic matériel */}
              <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2.5">
                  <Laptop className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-zinc-300 text-[11px]">
                      Détection matériel : {screenDetails?.screenCount || 1} écran(s) identifié(s)
                      {screenDetails?.isExtended && " • Mode bureau étendu actif"}
                    </div>
                    <div className="text-[9.5px] text-zinc-500">
                      API : {screenDetails?.apiType || "Standard Web Window"} • Résolution : {screenDetails?.primaryScreen.width}×{screenDetails?.primaryScreen.height} px
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isDetecting}
                  onClick={() => {
                    setIsDetecting(true);
                    detectPdiScreens().then((r) => {
                      setScreenDetails(r);
                      setIsDetecting(false);
                    });
                  }}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10.5px] font-medium transition flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isDetecting ? "animate-spin" : ""}`} />
                  Re-détecter
                </button>
              </div>
            </>
          ) : (
            /* ONGLET 2 : PROJECTION ET CAST SUR SMART TV ANDROID */
            <div className="space-y-5">
              
              {/* Bannière explicative Smart TV */}
              <div className="p-4 bg-gradient-to-r from-purple-950/50 via-indigo-950/30 to-slate-900 border border-purple-500/40 rounded-xl flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-500/40 shrink-0">
                  <Tv2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Projection sans fil sur Smart TV &amp; Écran d'Atelier</span>
                    <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                      100% Compatible Android TV / Chromecast
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    Vous pouvez projeter en direct la vue 3D Solide, le carnet de Spools ou la BOM sur n'importe quel téléviseur connecté (Android TV, Google TV, Samsung Tizen, LG webOS, Chromecast ou navigateur TV) sans câble HDMI !
                  </p>
                </div>
              </div>

              {/* Sélection de la vue à projeter sur la TV */}
              <div className="p-4 bg-[#161B22] border border-[#30363D] rounded-xl space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-300">
                  Vue à diffuser sur votre Téléviseur Smart TV :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PDI_WORKSPACE_VIEWS.filter((v) => v.id !== "iso").map((v) => {
                    const isSelected = localConfig.screen2View === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleScreen2ViewChange(v.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/40"
                            : "bg-[#0D1117] border-[#30363D] text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white">{v.labelFr}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{v.descriptionFr}</div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Les 3 Méthodes de Projection vers la Smart TV */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Méthode A : QR Code pour Smart TV / Mobile */}
                <div className="p-4 bg-[#161B22] border border-[#30363D] rounded-xl flex flex-col items-center text-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <span>Option 1 : Flasher le QR Code sur la TV ou Mobile</span>
                  </div>
                  
                  {/* Image QR Code */}
                  <div className="p-2.5 bg-[#090D14] border border-cyan-500/30 rounded-xl shadow-inner flex items-center justify-center">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code Smart TV"
                        className="w-44 h-44 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-zinc-500 text-xs">
                        Génération du QR Code...
                      </div>
                    )}
                  </div>
                  <p className="text-[10.5px] text-zinc-400 max-w-xs">
                    Ouvrez la caméra de votre smartphone ou l'application navigateur de la Smart TV pour afficher instantanément la vue en plein écran.
                  </p>
                </div>

                {/* Méthode B : Cast / Clic Direct & URL */}
                <div className="p-4 bg-[#161B22] border border-[#30363D] rounded-xl flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300 mb-2">
                      <Cast className="w-4 h-4 text-purple-400" />
                      <span>Option 2 : Caster directement depuis votre navigateur</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Cliquez ci-dessous pour déclencher la diffusion sans fil vers votre Android TV / Chromecast ou ouvrir la fenêtre d'affichage plein écran TV.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleLaunchSecondaryForCast}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Cast className="w-4 h-4 text-white" />
                      <span>1. Ouvrir l'Écran 2 pour Caster sur Chromecast</span>
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center">
                      ✓ Recommandé : ouvre la vue 3D / Spools plein écran. Cliquez ensuite sur <strong className="text-zinc-200">Menu Chrome ⋮ &gt; Caster</strong> pour l'afficher sur votre TV en 60 FPS sans écran noir.
                    </p>

                    <button
                      type="button"
                      onClick={handleNativeCast}
                      className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Maximize className="w-3.5 h-3.5 text-purple-400" />
                      <span>2. Tenter la projection sans fil directe W3C</span>
                    </button>
                  </div>

                  {/* Champ URL TV à copier */}
                  <div className="pt-2 border-t border-zinc-800">
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                      URL directe pour navigateur Android TV (Chrome / TV Bro) :
                    </label>
                    <div className="flex items-center gap-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg p-1.5">
                      <input
                        type="text"
                        readOnly
                        value={currentTvUrl}
                        className="bg-transparent border-0 text-[10px] text-zinc-300 font-mono flex-1 outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyTvUrl}
                        className="px-2 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-500/40 text-[10px] font-bold transition flex items-center gap-1 shrink-0"
                        title="Copier le lien"
                      >
                        {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl ? "Copié !" : "Copier"}</span>
                      </button>
                    </div>
                  </div>

                  {castStatus && (
                    <div className="text-[10.5px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 p-2 rounded-lg text-center font-medium animate-pulse">
                      {castStatus}
                    </div>
                  )}
                </div>

              </div>

              {/* Guide pas à pas Android TV */}
              <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Guide rapide de connexion sur Smart TV Android / Google TV :</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px] text-zinc-400">
                  <div className="p-2 bg-[#0D1117] border border-zinc-800 rounded-lg">
                    <strong className="text-white block mb-0.5">1. Via Chromecast / Cast PC</strong>
                    Dans Google Chrome sur votre PC, faites Clic-droit &gt; « Caster... » et sélectionnez votre Smart TV.
                  </div>
                  <div className="p-2 bg-[#0D1117] border border-zinc-800 rounded-lg">
                    <strong className="text-white block mb-0.5">2. Via l'app TV Bro / Chrome TV</strong>
                    Ouvrez le navigateur sur votre Smart TV et scannez le QR Code ou collez l'adresse pour un affichage autonome.
                  </div>
                  <div className="p-2 bg-[#0D1117] border border-zinc-800 rounded-lg">
                    <strong className="text-white block mb-0.5">3. Synchronisation Live</strong>
                    Toute rotation 3D, sélection ou modification sur votre PC s'anime en direct sur le grand écran !
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer (Fixé en bas de la boîte, toujours accessible) */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-[#30363D] bg-[#161B22]">
          <div className="text-xs text-zinc-400">
            {isSecondaryConnected ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Écran secondaire actif &amp; synchronisé
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400">
                Sélectionnez votre vue et lancez la fenêtre ou la projection TV.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isSecondaryConnected ? (
              <button
                type="button"
                onClick={onCloseSecondaryWindow}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-500/30 transition"
              >
                Fermer l'Écran 2
              </button>
            ) : null}

            {activeModalTab === "dual_screen" ? (
              <button
                type="button"
                onClick={handleLaunchSecondary}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-950/50 transition flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                {isSecondaryConnected ? "Refocaliser l'Écran 2" : "Ouvrir l'Écran Secondaire"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNativeCast}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-950/50 transition flex items-center gap-2"
              >
                <Cast className="w-4 h-4" />
                <span>Caster sur Smart TV</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
