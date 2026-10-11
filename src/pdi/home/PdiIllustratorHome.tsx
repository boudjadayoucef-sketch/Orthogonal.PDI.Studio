import React, { useState } from "react";
import {
  Box,
  Home,
  FolderOpen,
  Plus,
  Grid,
  HardDrive,
  FileCode,
  Code2,
  Printer,
  PenTool
} from "lucide-react";
import { GlowingEffect } from "@/src/components/ui/glowing-effect";

export interface PdiIllustratorHomeProps {
  onNewProject?: (template?: string) => void;
  onOpenProject?: () => void;
  onOpenModule?: (module: string) => void;
}

export interface ModuleCardItem {
  id: string;
  code: string;
  name: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
}

const MODULE_CARDS: ModuleCardItem[] = [
  {
    id: "isometric",
    code: "ISO",
    name: "ISO",
    title: "Dessin Isométrique 3D",
    description: "Moteur vectoriel 3D, routage tuyauterie, magnétisme DN et cotations automatiques.",
    icon: <Box className="h-5 w-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />,
    badge: "ISO",
  },
  {
    id: "drive",
    code: "DRV",
    name: "DRIVE",
    title: "Drive & Stockage Cloud",
    description: "Gestionnaire de projets, synchronisation Google Drive et bases de données.",
    icon: <HardDrive className="h-5 w-5 text-amber-400 group-hover:text-amber-300 transition-colors" />,
    badge: "DRIVE",
  },
  {
    id: "sketch",
    code: "CRQ",
    name: "CROQUIS",
    title: "Croquis & Spooling Atelier",
    description: "Éditeur de croquis rapides, tronçons d'atelier et spools de préfabrication.",
    icon: <PenTool className="h-5 w-5 text-purple-400 group-hover:text-purple-300 transition-colors" />,
    badge: "CROQUIS",
  },
  {
    id: "cad",
    code: "DX",
    name: "CAO",
    title: "Import CAO & DXF",
    description: "Importation et exportation DXF, conversion de plans CAO vers format PD&I.",
    icon: <FileCode className="h-5 w-5 text-blue-400 group-hover:text-blue-300 transition-colors" />,
    badge: "CAO",
  },
  {
    id: "json",
    code: "{}",
    name: "JSON",
    title: "Éditeur JSON Central",
    description: "Arbre de données centralisé, spécifications tuyauterie et validation modèle.",
    icon: <Code2 className="h-5 w-5 text-orange-400 group-hover:text-orange-300 transition-colors" />,
    badge: "JSON",
  },
  {
    id: "pdf",
    code: "PDF",
    name: "EXPORT",
    title: "Export & Carnet Spools",
    description: "Génération automatique des fiches de fabrication A3/A4 et nomenclatures (BOM).",
    icon: <Printer className="h-5 w-5 text-rose-400 group-hover:text-rose-300 transition-colors" />,
    badge: "EXPORT",
  },
];

export default function PdiIllustratorHome({
  onNewProject,
  onOpenProject,
  onOpenModule,
}: PdiIllustratorHomeProps) {
  const [activeTab, setActiveTab] = useState<"home" | "projects">("home");

  return (
    <div className="min-h-screen bg-[#000000] text-neutral-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Main Layout: Left Sidebar + Central Workarea */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-52 bg-[#08080a] border-r border-white/10 flex flex-col p-4 gap-4 shrink-0">
          {/* Nouveau Fichier Blue Pill Button */}
          <button
            onClick={() => onNewProject?.()}
            className="w-full bg-[#0078d4] hover:bg-[#006cbd] text-white font-semibold text-xs py-2 px-4 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Nouveau fichier
          </button>

          {/* Ouvrir Button */}
          <button
            onClick={() => onOpenProject?.()}
            className="w-full text-left text-neutral-300 hover:text-white text-xs py-1.5 px-3 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 font-medium"
          >
            <FolderOpen className="w-4 h-4 text-neutral-400" />
            Ouvrir
          </button>

          <hr className="border-white/10 my-1" />

          {/* Sidebar Menu Options */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("home")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "home"
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Home className="w-4 h-4" />
              Accueil
            </button>

            <button
              onClick={() => {
                setActiveTab("projects");
                onOpenModule?.("projects");
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "projects"
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Grid className="w-4 h-4" />
              Mes projets
            </button>
          </div>
        </aside>

        {/* Central Workarea */}
        <main className="flex-1 overflow-y-auto bg-[#000000] p-8 md:p-12 flex flex-col gap-8">
          {/* Welcome Header */}
          <div className="text-center md:text-left space-y-2 max-w-5xl mx-auto md:mx-0">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Quelle Isométrie allons-nous construire aujourd'hui ?
            </h1>
            <p className="text-neutral-400 text-sm font-medium">
              Sélectionner un module d'ingénierie PD&amp;I ci-dessous
            </p>
          </div>

          {/* Glowing Module Cards Grid */}
          <div className="max-w-6xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Modules &amp; Outils PD&amp;I
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {MODULE_CARDS.map((card) => (
                <div
                  key={card.id}
                  onClick={() => onOpenModule?.(card.id)}
                  className="group relative bg-[#09090b] hover:bg-[#111115] border border-white/10 hover:border-[#0078d4]/60 rounded-2xl p-5 flex flex-col justify-between min-h-[12.5rem] transition-all cursor-pointer shadow-lg"
                >
                  <GlowingEffect
                    spread={40}
                    glow={true}
                    disabled={false}
                    proximity={64}
                    inactiveZone={0.01}
                  />

                  <div className="relative flex flex-col justify-between h-full gap-4">
                    <div className="flex items-center justify-between">
                      <div className="w-fit rounded-xl border border-white/10 bg-white/5 p-2.5">
                        {card.icon}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-400">
                          {card.code}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase mt-0.5">
                          {card.name}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-neutral-400 text-xs leading-relaxed line-clamp-2 font-medium">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
