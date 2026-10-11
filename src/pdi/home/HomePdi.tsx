import React, { useState } from "react";
import {
  Box,
  Layers,
  FileCode,
  HardDrive,
  PenTool,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Zap,
  Activity,
  Cpu,
  Compass,
  FolderOpen,
  Plus,
  Play,
  KeyRound,
  LogIn,
  Users,
  Globe,
  Lock
} from "lucide-react";
import pdiLogo from "../../assets/images/pdi-logo-horizontal.png";
import isoPiping3D from "../../assets/images/pdi_iso_piping_3d_1787006532562.jpg";
import valve3D from "../../assets/images/pdi_valve_3d_1787006543831.jpg";
import plantScan3D from "../../assets/images/pdi_plant_scan_3d_1787006555680.jpg";
import cadSpool3D from "../../assets/images/pdi_cad_spool_3d_1787006567003.jpg";
import { NetworkAnimation } from "../../components/NetworkAnimation";
import PdiInfoModals, { ModalType } from "../modals/PdiInfoModals";

export interface HomePdiProps {
  onEnterModule?: (moduleId: string) => void;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onLoginRequest?: (role?: string) => void;
  userEmail?: string;
  isLoggedIn?: boolean;
}

export const HomePdi: React.FC<HomePdiProps> = ({
  onEnterModule,
  onNewProject,
  onOpenProject,
  onLoginRequest,
  userEmail,
  isLoggedIn = false,
}) => {
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);
  const [infoModal, setInfoModal] = useState<ModalType>(null);

  const featureTabs = [
    {
      id: "isometric",
      title: "Dessinateur Isométrique 3D",
      subtitle: "Moteur vectoriel CAD & magnétisme DN automatique",
      description:
        "Tracez vos lignes de tuyauteries industrielles avec assistance automatique aux angles normalisés (90°, 45°, 30°), insertion instantanée des brides, vannes, tés et piquages.",
      image: isoPiping3D,
      badge: "ISO 3D Engine",
      stats: ["Magnétisme 3D", "Cotation auto", "BOM instantané"],
    },
    {
      id: "sketch",
      title: "Croquis & Spooling Atelier",
      subtitle: "Préfabrication des tronçons et fiches de soudure",
      description:
        "Découpez vos isométries en spools de transport et de fabrication d'atelier. Générez les fiches de tronçons avec calcul des longueurs développées et positionnement des soudures atelier / chantier.",
      image: cadSpool3D,
      badge: "Spool & Atelier",
      stats: ["ISO to Spool", "Traçabilité soudure", "Export PDF A4/A3"],
    },
    {
      id: "cad",
      title: "Import & CAO DXF Vectorielle",
      subtitle: "Compatibilité AutoCAD, DXF 2D/3D et modèles unifilaires",
      description:
        "Importez directement vos plans CAO pour les convertir en modèle isométrique vectoriel intelligent ou exportez vos fiches techniques au format DXF industriel universel.",
      image: plantScan3D,
      badge: "DXF Universal",
      stats: ["AutoCAD DXF", "Layers normalisés", "Export vectoriel"],
    },
    {
      id: "drive",
      title: "Drive & Cloud Workspace",
      subtitle: "Synchronisation Cloud collaborative & base de données",
      description:
        "Sauvegardez vos projets, gérez vos affaires et vos cartouches d'ingénierie en toute sécurité. Synchronisation automatique avec PostgreSQL Cloud SQL et Google Drive.",
      image: valve3D,
      badge: "Cloud Drive",
      stats: ["Multi-projets", "PostgreSQL Cloud", "Google Drive Sync"],
    },
  ];

  return (
    <div className="min-h-screen bg-[#060608] text-neutral-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Ambient Top Glow (Black & Orange) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Modern Navigation Header */}
      <header className="relative z-20 border-b border-white/10 bg-[#09090c]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <img src={pdiLogo} alt="PD&I" className="h-8 object-contain drop-shadow" />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-black tracking-widest text-white uppercase">
                Home PD&I
              </span>
              <span className="text-[10px] text-orange-400 font-mono tracking-tight">
                Pipeline Design & Isometrics
              </span>
            </div>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Plateforme Industrielle v1.0
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onLoginRequest?.("login")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5 text-orange-400" />
            <span>Connexion</span>
          </button>

          <button
            onClick={() => onLoginRequest?.("register")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Essai 30 Jours</span>
          </button>
        </div>
      </header>

      {/* Hero Section with 3D Isometric Pipeline Canvas */}
      <section className="relative z-10 px-6 py-12 md:py-16 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Hero Text & Actions */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30 w-fit shadow-sm">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            Ingénierie & Tuyauterie Industrielle 3D
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Conception Isométrique & Spooling{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                Haute Précision
              </span>
            </h1>
            <p className="text-neutral-300 text-sm md:text-base leading-relaxed max-w-xl">
              Dessinez vos plans isométriques, générez automatiquement les spools de préfabrication,
              les nomenclatures matérielles (BOM) et exportez en DXF / PDF aux normes ASME & EN.
            </p>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                if (isLoggedIn) {
                  onEnterModule?.("isometric");
                } else {
                  onLoginRequest?.("login");
                }
              }}
              className="group flex flex-col p-4 rounded-xl bg-gradient-to-br from-orange-500/20 via-orange-950/30 to-black border border-orange-500/40 hover:border-orange-400 transition-all text-left shadow-lg shadow-orange-500/5 hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <Box className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/30">
                  MODULE ISO
                </span>
              </div>
              <span className="text-sm font-bold text-white group-hover:text-orange-300 transition-colors">
                Dessin Isométrique 3D
              </span>
              <span className="text-xs text-neutral-400 mt-1">
                Routage tuyauterie, vannes, brides, coudes et magnétisme DN.
              </span>
            </button>

            <button
              onClick={() => {
                if (isLoggedIn) {
                  onEnterModule?.("sketch");
                } else {
                  onLoginRequest?.("login");
                }
              }}
              className="group flex flex-col p-4 rounded-xl bg-gradient-to-br from-neutral-900/80 via-neutral-900/50 to-black border border-white/10 hover:border-orange-400/50 transition-all text-left shadow-md hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-white/10 text-neutral-300 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <PenTool className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold text-neutral-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  CROQUIS & SPOOLS
                </span>
              </div>
              <span className="text-sm font-bold text-white group-hover:text-orange-300 transition-colors">
                Croquis & Spooling Atelier
              </span>
              <span className="text-xs text-neutral-400 mt-1">
                Tronçons de fabrication, calcul des longueurs et carnet de soudure.
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onLoginRequest?.("login")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
            >
              <KeyRound className="w-4 h-4" />
              Se Connecter à l'Espace PD&amp;I
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onLoginRequest?.("register")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-orange-400" />
              Essai Gratuit 30 Jours
            </button>
          </div>
        </div>

        {/* Right Column: Globe Terrestre 3D Network Animation */}
        <div className="lg:col-span-6 relative flex flex-col items-center w-full">
          <NetworkAnimation className="w-full h-[480px] sm:h-[540px] lg:h-[580px]" />
        </div>
      </section>

      {/* Feature Explorer Showcase (Black & Orange Cards) */}
      <section className="relative z-10 px-6 py-12 max-w-7xl mx-auto w-full border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
              Suite Logicielle PD&I
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Tous les modules d'ingénierie intégrés
            </h2>
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap gap-2">
            {featureTabs.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveFeatureTab(idx)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFeatureTab === idx
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>
        </div>

        {/* Active Feature Showcase Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-[#0c0c10] via-[#09090c] to-black border border-white/10 shadow-2xl">
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {featureTabs[activeFeatureTab].badge}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                {featureTabs[activeFeatureTab].title}
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {featureTabs[activeFeatureTab].description}
              </p>

              <div className="space-y-2 pt-2">
                {featureTabs[activeFeatureTab].stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-neutral-300 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>{stat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (isLoggedIn) {
                  onEnterModule?.(featureTabs[activeFeatureTab].id);
                } else {
                  onLoginRequest?.();
                }
              }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all"
            >
              {isLoggedIn ? `Ouvrir ${featureTabs[activeFeatureTab].title}` : `Connexion requise pour ${featureTabs[activeFeatureTab].title}`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:col-span-7 relative h-64 sm:h-80 md:h-96 rounded-xl overflow-hidden border border-white/10 shadow-inner group">
            <img
              src={featureTabs[activeFeatureTab].image}
              alt={featureTabs[activeFeatureTab].title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white font-mono bg-black/70 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
              <span className="text-orange-400 font-bold">PD&I CAD ENGINE</span>
              <span className="text-neutral-400">Prêt pour exécution</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (4 Offers: Étudiant, Starter, Pro, Entreprise with Monthly & Annual Prices) */}
      <section id="pricing" className="relative z-10 px-6 py-16 max-w-7xl mx-auto w-full border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-mono font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Tarification & Abonnements PD&I
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tarification Simple & Transparente
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Choisissez la formule adaptée à vos besoins d'ingénierie et de spooling 3D.
            Tarifs clairs sans frais cachés, résiliables à tout moment.
          </p>
        </div>

        {/* 4 Offer Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {/* OFFER 1: ÉTUDIANT */}
          <div className="flex flex-col justify-between p-6 rounded-2xl bg-[#090b11] border border-white/10 hover:border-orange-500/40 transition-all shadow-xl group">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">Étudiant</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Pour étudiants, formations académiques et projets d'école.
                </p>
              </div>

              {/* Price display: Monthly & Annual */}
              <div className="py-3 border-y border-white/5 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">1 500 DZD</span>
                  <span className="text-xs text-neutral-400 font-medium">/ mois</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Tarif Annuel : 12 000 DZD / an <span className="text-neutral-500 font-normal">(1 000 DZD/mois)</span>
                </div>
              </div>

              <button
                onClick={() => onLoginRequest?.("register")}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all text-center"
              >
                Choisir l'Offre Étudiant
              </button>

              <div className="space-y-2.5 pt-2 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>1 Licence Utilisateur Académique</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>5 Projets Isométriques 3D</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Export PDF Standard</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Accès Moteur ISO ASME B31.3</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Support Communauté & FAQ</span>
                </div>
              </div>

              {/* Plus Divider Line like in Screenshot 3 */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <span className="relative z-10 px-2 bg-[#090b11] text-neutral-500 text-xs font-bold">+</span>
              </div>

              <div className="space-y-2 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>Rapports d'Étude Académiques</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>Espace de Travail Cloud Local</span>
                </div>
              </div>
            </div>
          </div>

          {/* OFFER 2: STARTER */}
          <div className="flex flex-col justify-between p-6 rounded-2xl bg-[#090b11] border border-white/10 hover:border-orange-500/40 transition-all shadow-xl group">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">Starter</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Pour dessinateurs, projeteurs indépendants et petits ateliers.
                </p>
              </div>

              {/* Price display: Monthly & Annual */}
              <div className="py-3 border-y border-white/5 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">4 900 DZD</span>
                  <span className="text-xs text-neutral-400 font-medium">/ mois</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Tarif Annuel : 39 000 DZD / an <span className="text-neutral-500 font-normal">(3 250 DZD/mois)</span>
                </div>
              </div>

              <button
                onClick={() => onLoginRequest?.("register")}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all text-center"
              >
                Activer l'Offre Starter
              </button>

              <div className="space-y-2.5 pt-2 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Projets Isométriques Illimités</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Croquis & Spooling Atelier</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Import CAO & Conversion DXF</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Carnets de Soudure & Tronçons</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Support Technique Email (24h)</span>
                </div>
              </div>

              {/* Plus Divider Line */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <span className="relative z-10 px-2 bg-[#090b11] text-neutral-500 text-xs font-bold">+</span>
              </div>

              <div className="space-y-2 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>Stockage Cloud 10 Go</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>Exportation DXF & PDF HD</span>
                </div>
              </div>
            </div>
          </div>

          {/* OFFER 3: PRO (POPULAR BADGE) */}
          <div className="relative flex flex-col justify-between p-6 rounded-2xl bg-gradient-to-b from-[#0d1222] via-[#090c17] to-black border-2 border-orange-500/60 shadow-2xl shadow-orange-500/10 group">
            {/* Badge "Populaire" */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Populaire
              </span>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center justify-between">
                  <span>Pro</span>
                  <span className="text-xs font-mono text-orange-400">Recommandé</span>
                </h3>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Pour bureaux d'études, ingénieurs et équipes de tuyauterie.
                </p>
              </div>

              {/* Price display: Monthly & Annual */}
              <div className="py-3 border-y border-white/10 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">9 900 DZD</span>
                  <span className="text-xs text-neutral-400 font-medium">/ mois</span>
                </div>
                <div className="text-[11px] font-mono text-orange-400 font-bold">
                  Tarif Annuel : 79 000 DZD / an <span className="text-neutral-400 font-normal">(6 580 DZD/mois)</span>
                </div>
              </div>

              <button
                onClick={() => onLoginRequest?.("register")}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all text-center"
              >
                Essai Gratuit Pro 30 Jours
              </button>

              <div className="space-y-2.5 pt-2 text-xs text-neutral-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="font-semibold text-white">Tout le contenu Starter +</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Multi-Écrans & Synchro Broadcast</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Moteur 3D WebGL Haute Performance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Drive Cloud Sync (100 Go)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Support Prioritaire Téléphone & Email (2h)</span>
                </div>
              </div>

              {/* Plus Divider Line */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-orange-500/30" /></div>
                <span className="relative z-10 px-2 bg-[#090c17] text-orange-400 text-xs font-bold">+</span>
              </div>

              <div className="space-y-2 text-xs text-cyan-300 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                  <span>Integrations CAO Sur Mesure</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  <span>Team Collaboration Multi-Postes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  <span>Advanced Security & Cloud SQL</span>
                </div>
              </div>
            </div>
          </div>

          {/* OFFER 4: ENTREPRISE */}
          <div className="flex flex-col justify-between p-6 rounded-2xl bg-[#090b11] border border-white/10 hover:border-orange-500/40 transition-all shadow-xl group">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">Entreprise</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Pour grands comptes industriels, usines, EPC et flottes.
                </p>
              </div>

              {/* Price display: Monthly & Annual */}
              <div className="py-3 border-y border-white/5 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">29 900 DZD</span>
                  <span className="text-xs text-neutral-400 font-medium">/ mois</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Tarif Annuel : Sur Devis <span className="text-neutral-500 font-normal">(Licence Site / Flotte)</span>
                </div>
              </div>

              <button
                onClick={() => onLoginRequest?.("register")}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all text-center"
              >
                Contacter l'Équipe Entreprise
              </button>

              <div className="space-y-2.5 pt-2 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white">Tout le contenu Pro +</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Accès Multi-Utilisateurs & Flotte</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Base SQL Cloud Sécurisée Dédiée</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Carnets de Soudure & Spools Personnalisés</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Support Dédié 24/7 & Manager Dédié</span>
                </div>
              </div>

              {/* Plus Divider Line */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <span className="relative z-10 px-2 bg-[#090b11] text-neutral-500 text-xs font-bold">+</span>
              </div>

              <div className="space-y-2 text-xs text-cyan-300 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>SSO & SAML Authentification</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>Audit Logs & Traçabilité Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>SLA Guarantee 99.9% Disponibilité</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer matching Screenshot 1 layout with columns + preserving Output Tables for Legal, Tech Ref & Payment Terms */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050507] px-6 py-12 text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          {/* Main Footer Layout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
            {/* Left Column: Brand & Logo */}
            <div className="md:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <img src={pdiLogo} alt="PD&I Studio" className="h-8 object-contain drop-shadow" />
                <div>
                  <span className="text-base font-extrabold text-white block tracking-tight">PD&I Studio</span>
                  <span className="text-[11px] text-neutral-400 font-mono">Pipeline Design & Isometrics</span>
                </div>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
                Plateforme d'ingénierie tuyauterie industrielle aux normes ASME B31.3 / EN 13480.
                Modélisation 3D, spools de préfabrication et carnets de soudure.
              </p>

              <div className="text-[11px] text-neutral-500 font-mono pt-2">
                © copyright PD&I Studio 2026. Tous droits réservés.
              </div>
            </div>

            {/* Column 1: Pages / Navigation */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider text-orange-400">Pages</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">Tous les Produits</a>
                </li>
                <li>
                  <button onClick={() => { if(isLoggedIn) onEnterModule?.("isometric"); else onLoginRequest?.(); }} className="hover:text-white transition-colors text-left">
                    Dessin Isométrique 3D
                  </button>
                </li>
                <li>
                  <button onClick={() => { if(isLoggedIn) onEnterModule?.("sketch"); else onLoginRequest?.(); }} className="hover:text-white transition-colors text-left">
                    Croquis & Spooling Atelier
                  </button>
                </li>
                <li>
                  <button onClick={() => { if(isLoggedIn) onEnterModule?.("cad"); else onLoginRequest?.(); }} className="hover:text-white transition-colors text-left">
                    Import CAO & DXF
                  </button>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">Tarification & Offres</a>
                </li>
              </ul>
            </div>

            {/* Column 2: Legal & Modal Output Tables (Triggers exact same Modals for Legal, Tech Ref & Payment terms) */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider text-orange-400">Légal & Normes</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => setInfoModal("legal")}
                    className="hover:text-orange-300 text-orange-400 underline transition-colors text-left font-medium"
                  >
                    Mentions Légales & Confidentialité
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setInfoModal("tech_ref")}
                    className="hover:text-white underline transition-colors text-left"
                  >
                    Références Techniques & Normes ASME
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setInfoModal("payment_terms")}
                    className="hover:text-white underline transition-colors text-left"
                  >
                    Modalités de Paiement & Sécurité
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setInfoModal("legal")}
                    className="hover:text-white transition-colors text-left"
                  >
                    Protection des Données (RGPD)
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Mon Compte / Inscription */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider text-orange-400">Mon Compte</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => onLoginRequest?.("register")}
                    className="hover:text-white transition-colors text-left font-semibold text-neutral-200"
                  >
                    S'inscrire (Essai 30 Jours)
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLoginRequest?.("login")}
                    className="hover:text-white transition-colors text-left"
                  >
                    Connexion Utilisateur
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLoginRequest?.("forgot")}
                    className="hover:text-white transition-colors text-left text-neutral-400"
                  >
                    Mot de Passe Oublié
                  </button>
                </li>
              </ul>

              {/* Security Badge */}
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Conforme RGPD & Chiffrement SSL/TLS
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Security & Standards Summary Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" /> Conforme RGPD & Loi 18-07
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-400 font-mono">
                <Lock className="w-3.5 h-3.5" /> Chiffrement TLS 1.3 / AES-256
              </span>
              <span>•</span>
              <span className="text-orange-400 font-mono">
                Normes ASME B31.3 / EN 13480
              </span>
            </div>

            <div className="text-neutral-400 font-mono text-[10px]">
              PD&I Engine v48.0 • Cloud SQL & Storage Sovereign
            </div>
          </div>
        </div>

        {/* Render Info Modals when requested (preserves exact same modal output content for Legal, Tech Ref & Payment Terms) */}
        <PdiInfoModals
          activeModal={infoModal}
          onClose={() => setInfoModal(null)}
          userCountryCode="DZ"
        />
      </footer>
    </div>
  );
};

export default HomePdi;
