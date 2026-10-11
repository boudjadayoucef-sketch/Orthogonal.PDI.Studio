/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * SLEEK VERTICAL DROPDOWN & FLYOUT POPOVER MENU (GITHUB COPILOT / VS CODE MODEL).
 */

import React, { useState, useEffect, useRef } from "react";
import {
  pdiGroupesOnglet017M,
  pdiEntreesGroupe017M,
  PdiEntreeRuban017M,
  PDI_ONGLETS_RUBAN_017M,
} from "../engine/pdiRegistreCommandes.v1";
import {
  MousePointer2,
  Hand,
  Spline,
  CircleDot,
  GitFork,
  CornerDownRight,
  Anchor,
  Ruler,
  Slash,
  Square,
  Hexagon,
  Triangle,
  Circle,
  Disc3,
  Type,
  LayoutGrid,
  Trash2,
  Layers,
  SlidersHorizontal,
  FileCode,
  FolderOpen,
  Save,
  Printer,
  Download,
  Sparkles,
  Command,
  HelpCircle,
  Eye,
  AlignLeft,
  Box,
  Compass,
  ChevronRight,
  Settings,
  LogOut,
  Home,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  Clipboard,
  Files,
  CheckSquare,
  SquareDashed,
  RotateCw,
  FlipHorizontal,
  Move,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  ShieldCheck,
  FileSpreadsheet,
  Palette,
  Gauge,
  Tags,
  Layers2,
  Flame,
  Binary,
  Workflow,
  Wrench,
  Scale,
  ScissorsLineDashed,
  FoldHorizontal,
  SplitSquareVertical,
  Tv2,
  Monitor,
} from "lucide-react";

export interface IsoRibbonQuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
}

export interface IsoRibbonBarProps {
  collapsed: boolean;
  activeTab: string;
  anchorRef?: React.RefObject<HTMLElement> | null;
  anchorLeft?: number;
  resolveTarget: (entree: PdiEntreeRuban017M) => {
    label: string;
    hint?: string;
    disabled?: boolean;
    run: () => void;
  } | undefined;
  resolveTooltip: (entree: PdiEntreeRuban017M, hint?: string) => string;
  onExecute: (name: string) => void;
  onClose?: () => void;
  onSelectTab?: (tabId: string) => void;
  quickActions?: IsoRibbonQuickAction[];
  onOpenPalette?: () => void;
  onOpenShortcuts?: () => void;
}

export const getEntryIcon = (entree: PdiEntreeRuban017M): React.ReactNode => {
  const id = (entree?.id || "").toLowerCase();
  const nom = (entree?.nomFr || "").toLowerCase();

  if (id.includes("nouveau") || nom.includes("nouveau")) return <FileCode className="w-4 h-4 text-emerald-400" />;
  if (id.includes("accueil") || nom.includes("accueil")) return <Home className="w-4 h-4 text-blue-400" />;
  if (id.includes("landing")) return <Layers2 className="w-4 h-4 text-cyan-400" />;
  if (id.includes("ouvrir") || nom.includes("ouvrir")) return <FolderOpen className="w-4 h-4 text-amber-400" />;
  if (id.includes("sauver") || nom.includes("sauver")) return <Save className="w-4 h-4 text-blue-400" />;
  if (id.includes("planche") || id.includes("a3")) return <LayoutGrid className="w-4 h-4 text-indigo-400" />;
  if (id.includes("imprimer") || nom.includes("imprimer")) return <Printer className="w-4 h-4 text-zinc-300" />;
  if (id.includes("demo") || id.includes("exemple")) return <Sparkles className="w-4 h-4 text-amber-400" />;
  if (id.includes("reglages") || id.includes("setup")) return <Settings className="w-4 h-4 text-zinc-400" />;
  if (id.includes("deconnexion") || nom.includes("deconnexion")) return <LogOut className="w-4 h-4 text-red-400" />;

  if (id.includes("annuler") || nom.includes("annuler")) return <Undo2 className="w-4 h-4 text-amber-400" />;
  if (id.includes("retablir") || nom.includes("retablir")) return <Redo2 className="w-4 h-4 text-amber-400" />;
  if (id.includes("copier") || nom.includes("copier")) return <Copy className="w-4 h-4 text-cyan-400" />;
  if (id.includes("couper") || nom.includes("couper")) return <Scissors className="w-4 h-4 text-rose-400" />;
  if (id.includes("coller") || nom.includes("coller")) return <Clipboard className="w-4 h-4 text-emerald-400" />;
  if (id.includes("dupliquer") || nom.includes("dupliquer")) return <Files className="w-4 h-4 text-sky-400" />;
  if (id.includes("tout") || nom.includes("tout")) return <CheckSquare className="w-4 h-4 text-indigo-400" />;
  if (id.includes("deselectionner")) return <SquareDashed className="w-4 h-4 text-zinc-400" />;
  if (id.includes("supprimer") || id.includes("effacer")) return <Trash2 className="w-4 h-4 text-red-400" />;

  if (id.includes("deplacer") || nom.includes("deplacer")) return <Move className="w-4 h-4 text-cyan-400" />;
  if (id.includes("rotation") || nom.includes("rotation")) return <RotateCw className="w-4 h-4 text-violet-400" />;
  if (id.includes("miroir") || nom.includes("miroir")) return <FlipHorizontal className="w-4 h-4 text-pink-400" />;
  if (id.includes("echelle") || nom.includes("echelle")) return <Scale className="w-4 h-4 text-teal-400" />;
  if (id.includes("ajuster") || nom.includes("ajuster")) return <ScissorsLineDashed className="w-4 h-4 text-amber-400" />;
  if (id.includes("prolonger")) return <Slash className="w-4 h-4 text-emerald-400" />;
  if (id.includes("raccord") || id.includes("conge")) return <CornerDownRight className="w-4 h-4 text-sky-400" />;
  if (id.includes("chanfrein")) return <Triangle className="w-4 h-4 text-amber-300" />;
  if (id.includes("decaler")) return <FoldHorizontal className="w-4 h-4 text-indigo-300" />;

  if (id.includes("selection") || nom.includes("selection")) return <MousePointer2 className="w-4 h-4 text-blue-400" />;
  if (id.includes("main") || nom.includes("main")) return <Hand className="w-4 h-4 text-cyan-400" />;
  if (id.includes("noeud") || nom.includes("noeud")) return <CircleDot className="w-4 h-4 text-emerald-400" />;
  if (id.includes("tube") || nom.includes("tube")) return <Spline className="w-4 h-4 text-emerald-400" />;
  if (id.includes("coude") || nom.includes("coude")) return <CornerDownRight className="w-4 h-4 text-amber-400" />;
  if (id.includes("te") || nom.includes("te")) return <GitFork className="w-4 h-4 text-violet-400" />;

  if (id.includes("ligne") || nom.includes("ligne")) return <Slash className="w-4 h-4 text-cyan-400" />;
  if (id.includes("polyligne") || nom.includes("polyligne")) return <Spline className="w-4 h-4 text-cyan-400" />;
  if (id.includes("rectangle") || nom.includes("rectangle")) return <Square className="w-4 h-4 text-amber-400" />;
  if (id.includes("triangle") || nom.includes("triangle")) return <Triangle className="w-4 h-4 text-amber-400" />;
  if (id.includes("polygone") || nom.includes("polygone")) return <Hexagon className="w-4 h-4 text-cyan-300" />;
  if (id.includes("cercle") || nom.includes("cercle")) return <Circle className="w-4 h-4 text-sky-400" />;
  if (id.includes("arc") || nom.includes("arc")) return <Disc3 className="w-4 h-4 text-sky-300" />;
  if (id.includes("texte") || nom.includes("texte")) return <Type className="w-4 h-4 text-emerald-400" />;
  if (id.includes("hachure") || nom.includes("hachure")) return <LayoutGrid className="w-4 h-4 text-pink-400" />;

  if (id.includes("coter") || nom.includes("coter") || id.includes("cote")) return <Ruler className="w-4 h-4 text-blue-400" />;
  if (id.includes("support") || nom.includes("support")) return <Anchor className="w-4 h-4 text-indigo-400" />;
  if (id.includes("vanne") || nom.includes("vanne")) return <SlidersHorizontal className="w-4 h-4 text-teal-400" />;
  if (id.includes("biblio") || nom.includes("biblio")) return <Layers className="w-4 h-4 text-amber-400" />;

  if (id.includes("aligner") || nom.includes("aligner")) return <AlignLeft className="w-4 h-4 text-indigo-400" />;
  if (id.includes("controle") || id.includes("audit") || id.includes("validate")) return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
  if (id.includes("spec")) return <Binary className="w-4 h-4 text-cyan-400" />;

  if (id.includes("3d") || id.includes("orbite") || id.includes("vue")) return <Box className="w-4 h-4 text-purple-400" />;
  if (id.includes("bom") || id.includes("nomenclature")) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
  if (id.includes("tag") || nom.includes("tag")) return <Tags className="w-4 h-4 text-amber-400" />;
  if (id.includes("soudures") || id.includes("weld")) return <Flame className="w-4 h-4 text-orange-400" />;
  if (id.includes("pipelines")) return <Workflow className="w-4 h-4 text-cyan-400" />;

  if (id.includes("espacetravail") || id.includes("workspace") || id.includes("multiscreen") || nom.includes("espace de travail")) return <SplitSquareVertical className="w-4 h-4 text-cyan-400" />;
  if (id.includes("cast") || id.includes("tv") || nom.includes("tv") || nom.includes("projeter")) return <Tv2 className="w-4 h-4 text-purple-400" />;
  if (id.includes("zoomplus")) return <ZoomIn className="w-4 h-4 text-cyan-400" />;
  if (id.includes("zoommoins")) return <ZoomOut className="w-4 h-4 text-cyan-400" />;
  if (id.includes("ajuster")) return <Maximize2 className="w-4 h-4 text-blue-400" />;
  if (id.includes("grille")) return <Grid3X3 className="w-4 h-4 text-indigo-400" />;
  if (id.includes("palette")) return <Command className="w-4 h-4 text-cyan-400" />;
  if (id.includes("raccourcis")) return <HelpCircle className="w-4 h-4 text-amber-400" />;
  if (id.includes("couleur") || id.includes("style")) return <Palette className="w-4 h-4 text-pink-400" />;
  if (id.includes("perf")) return <Gauge className="w-4 h-4 text-emerald-400" />;

  return <Compass className="w-4 h-4 text-zinc-400" />;
};

/**
 * Dropdown Menu Item (Single Action)
 */
interface DropdownItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
  onClick: () => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({
  icon,
  label,
  shortcut,
  badge,
  disabled,
  danger,
  hint,
  onClick,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      title={hint}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-medium transition-all group select-none ${
        disabled
          ? "opacity-35 cursor-not-allowed text-zinc-500"
          : danger
          ? "text-red-400 hover:text-red-300 hover:bg-red-950/40 active:scale-[0.99]"
          : "text-zinc-200 hover:text-white hover:bg-[#161B22] active:scale-[0.99]"
      }`}
    >
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="ml-auto text-[10px] font-mono text-zinc-400 font-semibold shrink-0">
          {shortcut}
        </span>
      )}
      {badge && (
        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 shrink-0">
          {badge}
        </span>
      )}
    </button>
  );
};

/**
 * Dropdown Submenu Parent Item with Floating Flyout
 */
interface DropdownSubmenuProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  isOpen: boolean;
  onHover: () => void;
  onLeave: () => void;
  children: React.ReactNode;
}

const DropdownSubmenu: React.FC<DropdownSubmenuProps> = ({
  icon,
  label,
  subtitle,
  isOpen,
  onHover,
  onLeave,
  children,
}) => {
  return (
    <div
      className="relative"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-medium transition-all select-none group ${
          isOpen
            ? "bg-[#161B22] text-white"
            : "text-zinc-200 hover:text-white hover:bg-[#161B22]"
        }`}
      >
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block truncate">{label}</span>
          {subtitle && (
            <span className="block text-[10px] text-zinc-400 truncate -mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white shrink-0 ml-auto" />
      </button>

      {isOpen && (
        <div
          className="absolute left-[calc(100%+4px)] top-[-4px] z-[10035] w-64 p-1.5 bg-[#0D1117] border border-[#30363D] rounded-xl shadow-2xl shadow-black/95 text-white flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Main IsoRibbonBar component transformed into the sleek GitHub / VS Code vertical dropdown model
 */
export const IsoRibbonBar: React.FC<IsoRibbonBarProps> = ({
  collapsed,
  activeTab,
  anchorLeft,
  resolveTarget,
  resolveTooltip,
  onExecute,
  onClose,
  onSelectTab,
  quickActions,
  onOpenPalette,
  onOpenShortcuts,
}) => {
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const submenuTimeoutRef = useRef<number | null>(null);

  // Close on Escape
  useEffect(() => {
    if (collapsed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, onClose]);

  // Reset submenu when active tab changes
  useEffect(() => {
    setOpenSubmenuId(null);
  }, [activeTab]);

  if (collapsed) return null;

  const handleSubmenuHover = (id: string) => {
    if (submenuTimeoutRef.current) {
      window.clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    setOpenSubmenuId(id);
  };

  const handleSubmenuLeave = () => {
    submenuTimeoutRef.current = window.setTimeout(() => {
      setOpenSubmenuId(null);
    }, 150);
  };

  const renderSingleEntry = (entree: PdiEntreeRuban017M) => {
    const cible = resolveTarget(entree);
    const inactif = entree.etat === "grise" || !cible || !!cible.disabled;
    const libelle = entree.suivreLibelle && cible ? cible.label : entree.nomFr;
    const icon = getEntryIcon(entree);
    const hint = resolveTooltip(entree, cible ? cible.hint : undefined);

    return (
      <DropdownItem
        key={entree.id}
        icon={icon}
        label={libelle}
        shortcut={entree.raccourci}
        badge={entree.etat === "grise" ? "Bientôt" : undefined}
        disabled={inactif}
        danger={entree.id.includes("supprimer") || entree.id.includes("deconnexion")}
        hint={hint}
        onClick={() => {
          if (cible && !inactif) {
            cible.run();
            onExecute(entree.nomFr);
            onClose?.();
          }
        }}
      />
    );
  };

  // Build the content for each tab matching the photo 2 structure
  const renderTabDropdownContent = () => {
    switch (activeTab) {
      case "fichier": {
        const entreesNouveau = pdiEntreesGroupe017M("fichier", "Nouveau et ouverture");
        const entreesExemples = pdiEntreesGroupe017M("fichier", "Exemples");
        const entreesEnreg = pdiEntreesGroupe017M("fichier", "Enregistrement");
        const entreesImpression = pdiEntreesGroupe017M("fichier", "Impression et export");
        const entreesExport = pdiEntreesGroupe017M("fichier", "Export");
        const entreesSession = pdiEntreesGroupe017M("fichier", "Session");
        const entreesProjet = pdiEntreesGroupe017M("fichier", "Projet");

        return (
          <>
            {/* Primary actions */}
            {entreesNouveau.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Save actions */}
            {entreesEnreg.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu 1: Exemples & Démos */}
            <DropdownSubmenu
              icon={<Sparkles className="w-4 h-4 text-amber-400" />}
              label="Exemples & Démos..."
              isOpen={openSubmenuId === "fichier.exemples"}
              onHover={() => handleSubmenuHover("fichier.exemples")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Réseaux Préconfigurés
              </div>
              {entreesExemples.map(renderSingleEntry)}
            </DropdownSubmenu>

            {/* Flyout Submenu 2: Impression */}
            <DropdownSubmenu
              icon={<Printer className="w-4 h-4 text-zinc-300" />}
              label="Impression..."
              isOpen={openSubmenuId === "fichier.imprimer_menu"}
              onHover={() => handleSubmenuHover("fichier.imprimer_menu")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Impression & Planches
              </div>
              {entreesImpression.map(renderSingleEntry)}
            </DropdownSubmenu>

            {/* Flyout Submenu 2b: Export */}
            <DropdownSubmenu
              icon={<Download className="w-4 h-4 text-zinc-300" />}
              label="Export..."
              isOpen={openSubmenuId === "fichier.export"}
              onHover={() => handleSubmenuHover("fichier.export")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Formats d'exportation
              </div>
              {entreesExport.map(renderSingleEntry)}
            </DropdownSubmenu>

            {/* Flyout Submenu 3: Gestion de projet */}
            {entreesProjet.length > 0 && (
              <DropdownSubmenu
                icon={<Settings className="w-4 h-4 text-zinc-400" />}
                label="Projet & Sauvegardes..."
                isOpen={openSubmenuId === "fichier.projet"}
                onHover={() => handleSubmenuHover("fichier.projet")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Paramétrage
                </div>
                {entreesProjet.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Session actions */}
            {entreesSession.map(renderSingleEntry)}
          </>
        );
      }

      case "edition": {
        const entreesAnnul = pdiEntreesGroupe017M("edition", "Annulation");
        const entreesPresse = pdiEntreesGroupe017M("edition", "Presse-papiers");
        const entreesSelect = pdiEntreesGroupe017M("edition", "Selection");
        const entreesTrans = pdiEntreesGroupe017M("edition", "Transformer");
        const entreesGeom = pdiEntreesGroupe017M("edition", "Modifier la geometrie");
        const entreesGroupes = pdiEntreesGroupe017M("edition", "Groupes et blocs");

        return (
          <>
            {entreesAnnul.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {entreesPresse.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {entreesSelect.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu: Transformer & Modifier Géométrie */}
            {(entreesTrans.length > 0 || entreesGeom.length > 0) && (
              <DropdownSubmenu
                icon={<Move className="w-4 h-4 text-cyan-400" />}
                label="Modifier & Transformer..."
                isOpen={openSubmenuId === "edition.transformer"}
                onHover={() => handleSubmenuHover("edition.transformer")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Transformations CAD
                </div>
                {entreesTrans.map(renderSingleEntry)}
                {entreesGeom.length > 0 && (
                  <>
                    <div className="h-px bg-[#30363D]/80 my-1" />
                    {entreesGeom.map(renderSingleEntry)}
                  </>
                )}
              </DropdownSubmenu>
            )}

            {/* Flyout Submenu: Groupes et blocs */}
            {entreesGroupes.length > 0 && (
              <DropdownSubmenu
                icon={<Layers className="w-4 h-4 text-amber-400" />}
                label="Groupes & Blocs..."
                isOpen={openSubmenuId === "edition.groupes"}
                onHover={() => handleSubmenuHover("edition.groupes")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Assemblage
                </div>
                {entreesGroupes.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      case "dessin": {
        const entreesPointeurs = pdiEntreesGroupe017M("dessin", "Outils de pointage");
        const entreesTuyauterie = pdiEntreesGroupe017M("dessin", "Elements tuyauterie");
        const entrees2D = pdiEntreesGroupe017M("dessin", "Dessin 2D");

        return (
          <>
            {entreesPointeurs.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu 1: Tuyauterie 3D */}
            <DropdownSubmenu
              icon={<Spline className="w-4 h-4 text-emerald-400" />}
              label="Tuyauterie & Raccords 3D..."
              isOpen={openSubmenuId === "dessin.tuyauterie"}
              onHover={() => handleSubmenuHover("dessin.tuyauterie")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Composants Isométriques
              </div>
              {entreesTuyauterie.map(renderSingleEntry)}
            </DropdownSubmenu>

            {/* Flyout Submenu 2: Dessin 2D */}
            <DropdownSubmenu
              icon={<Square className="w-4 h-4 text-cyan-400" />}
              label="Formes 2D & Esquisse..."
              isOpen={openSubmenuId === "dessin.formes2d"}
              onHover={() => handleSubmenuHover("dessin.formes2d")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Objets Géométriques 2D
              </div>
              {entrees2D.map(renderSingleEntry)}
            </DropdownSubmenu>
          </>
        );
      }

      case "annoter": {
        const entreesCotation = pdiEntreesGroupe017M("annoter", "Cotation");
        const entreesEtiquettes = pdiEntreesGroupe017M("annoter", "Etiquettes");
        const entreesTextes = pdiEntreesGroupe017M("annoter", "Textes et reperes");

        return (
          <>
            {entreesCotation.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu: Étiquettes & Textes */}
            {(entreesEtiquettes.length > 0 || entreesTextes.length > 0) && (
              <DropdownSubmenu
                icon={<Tags className="w-4 h-4 text-amber-400" />}
                label="Repères & Habillage..."
                isOpen={openSubmenuId === "annoter.reperes"}
                onHover={() => handleSubmenuHover("annoter.reperes")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Annotations Normalisées
                </div>
                {entreesEtiquettes.map(renderSingleEntry)}
                {entreesTextes.length > 0 && (
                  <>
                    <div className="h-px bg-[#30363D]/80 my-1" />
                    {entreesTextes.map(renderSingleEntry)}
                  </>
                )}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      case "precision": {
        const entreesAlignement = pdiEntreesGroupe017M("precision", "Alignement");
        const entreesControle = pdiEntreesGroupe017M("precision", "Controle");
        const entreesVerif = pdiEntreesGroupe017M("precision", "Verification");

        return (
          <>
            {entreesControle.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu 1: Alignement */}
            <DropdownSubmenu
              icon={<AlignLeft className="w-4 h-4 text-indigo-400" />}
              label="Alignements & Redressement..."
              isOpen={openSubmenuId === "precision.align"}
              onHover={() => handleSubmenuHover("precision.align")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Axes & Tuyaux
              </div>
              {entreesAlignement.map(renderSingleEntry)}
            </DropdownSubmenu>

            {/* Flyout Submenu 2: Vérification de spec */}
            {entreesVerif.length > 0 && (
              <DropdownSubmenu
                icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                label="Audits & Spécifications..."
                isOpen={openSubmenuId === "precision.audit"}
                onHover={() => handleSubmenuHover("precision.audit")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Conformité Métier
                </div>
                {entreesVerif.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      case "insertion": {
        const entreesBiblio = pdiEntreesGroupe017M("insertion", "Bibliotheque");
        const entreesSupports = pdiEntreesGroupe017M("insertion", "Supports et massifs");
        const entreesImport = pdiEntreesGroupe017M("insertion", "Import");

        return (
          <>
            {entreesBiblio.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu 1: Supports & Massifs */}
            <DropdownSubmenu
              icon={<Anchor className="w-4 h-4 text-indigo-400" />}
              label="Supports & Massifs Béton..."
              isOpen={openSubmenuId === "insertion.supports"}
              onHover={() => handleSubmenuHover("insertion.supports")}
              onLeave={handleSubmenuLeave}
            >
              <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                Génie Civil & MSS SP-58
              </div>
              {entreesSupports.map(renderSingleEntry)}
            </DropdownSubmenu>

            {/* Flyout Submenu 2: Import */}
            {entreesImport.length > 0 && (
              <DropdownSubmenu
                icon={<Workflow className="w-4 h-4 text-cyan-400" />}
                label="Imports Spéciaux..."
                isOpen={openSubmenuId === "insertion.import"}
                onHover={() => handleSubmenuHover("insertion.import")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Intégration
                </div>
                {entreesImport.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      case "trois_d": {
        const entreesNav = pdiEntreesGroupe017M("trois_d", "Navigation");
        const entreesTuyauterie3D = pdiEntreesGroupe017M("trois_d", "Tuyauterie 3D");
        const entreesGC = pdiEntreesGroupe017M("trois_d", "Structure et genie civil");
        const entreesSupports3D = pdiEntreesGroupe017M("trois_d", "Supports");
        const entreesEquip = pdiEntreesGroupe017M("trois_d", "Equipements");
        const entreesRendu = pdiEntreesGroupe017M("trois_d", "Rendu");

        return (
          <>
            {entreesNav.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu 1: Tuyauterie & Raccords 3D */}
            {entreesTuyauterie3D.length > 0 && (
              <DropdownSubmenu
                icon={<Spline className="w-4 h-4 text-emerald-400" />}
                label="Tuyauterie Volumique 3D..."
                isOpen={openSubmenuId === "trois_d.tuyauterie"}
                onHover={() => handleSubmenuHover("trois_d.tuyauterie")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Tuyauterie 3D
                </div>
                {entreesTuyauterie3D.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}

            {/* Flyout Submenu 2: Structure et Génie civil */}
            {entreesGC.length > 0 && (
              <DropdownSubmenu
                icon={<Box className="w-4 h-4 text-purple-400" />}
                label="Charpente & Rack Tuyaux..."
                isOpen={openSubmenuId === "trois_d.gc"}
                onHover={() => handleSubmenuHover("trois_d.gc")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Structure Métallique
                </div>
                {entreesGC.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}

            {/* Flyout Submenu 3: Équipements */}
            {entreesEquip.length > 0 && (
              <DropdownSubmenu
                icon={<SlidersHorizontal className="w-4 h-4 text-teal-400" />}
                label="Équipements & Cuves..."
                isOpen={openSubmenuId === "trois_d.equip"}
                onHover={() => handleSubmenuHover("trois_d.equip")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Appareils Sous Pression
                </div>
                {entreesEquip.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}

            {/* Flyout Submenu 4: Rendu */}
            {entreesRendu.length > 0 && (
              <DropdownSubmenu
                icon={<Palette className="w-4 h-4 text-pink-400" />}
                label="Styles de rendu 3D..."
                isOpen={openSubmenuId === "trois_d.rendu"}
                onHover={() => handleSubmenuHover("trois_d.rendu")}
                onLeave={handleSubmenuLeave}
              >
                {entreesRendu.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      case "donnees": {
        const entreesNomenclature = pdiEntreesGroupe017M("donnees", "Nomenclature");
        const entreesTables = pdiEntreesGroupe017M("donnees", "Tables");
        const entreesTags = pdiEntreesGroupe017M("donnees", "Tags");
        const entreesLignes = pdiEntreesGroupe017M("donnees", "Lignes");
        const entreesQuantitatifs = pdiEntreesGroupe017M("donnees", "Quantitatifs");
        const entreesProduction = pdiEntreesGroupe017M("donnees", "Production");

        return (
          <>
            {entreesNomenclature.map(renderSingleEntry)}
            {entreesTables.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu 1: Tags & Numérotation */}
            {entreesTags.length > 0 && (
              <DropdownSubmenu
                icon={<Tags className="w-4 h-4 text-amber-400" />}
                label="Tags & Repérage Lignes..."
                isOpen={openSubmenuId === "donnees.tags"}
                onHover={() => handleSubmenuHover("donnees.tags")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Identification
                </div>
                {entreesTags.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}

            {/* Flyout Submenu 2: Line List & Spécifications */}
            {(entreesLignes.length > 0 || entreesQuantitatifs.length > 0) && (
              <DropdownSubmenu
                icon={<FileSpreadsheet className="w-4 h-4 text-cyan-400" />}
                label="Line List & Métré..."
                isOpen={openSubmenuId === "donnees.linelist"}
                onHover={() => handleSubmenuHover("donnees.linelist")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Données Industrielles
                </div>
                {entreesLignes.map(renderSingleEntry)}
                {entreesQuantitatifs.length > 0 && (
                  <>
                    <div className="h-px bg-[#30363D]/80 my-1" />
                    {entreesQuantitatifs.map(renderSingleEntry)}
                  </>
                )}
              </DropdownSubmenu>
            )}

            {/* Flyout Submenu 3: Production de plans */}
            {entreesProduction.length > 0 && (
              <DropdownSubmenu
                icon={<Printer className="w-4 h-4 text-zinc-300" />}
                label="Production Automatisée..."
                isOpen={openSubmenuId === "donnees.prod"}
                onHover={() => handleSubmenuHover("donnees.prod")}
                onLeave={handleSubmenuLeave}
              >
                {entreesProduction.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      case "volume": {
        const entreesConfig = pdiEntreesGroupe017M("volume", "Configuration");
        const entreesSkid = pdiEntreesGroupe017M("volume", "Définition du Skid");
        const entreesVisu = pdiEntreesGroupe017M("volume", "Visualisation");
        const entreesControle = pdiEntreesGroupe017M("volume", "Contrôle de Gabarit");

        return (
          <>
            {/* Configuration & Panneau principal */}
            {entreesConfig.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Extrusion et dimensionnement du Skid */}
            {entreesSkid.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Options d'affichage et visibilité */}
            {entreesVisu.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Validation et détection des dépassements */}
            {entreesControle.map(renderSingleEntry)}
          </>
        );
      }

      case "affichage": {
        const entreesZoom = pdiEntreesGroupe017M("affichage", "Zoom");
        const entreesReperes = pdiEntreesGroupe017M("affichage", "Reperes");
        const entreesApparence = pdiEntreesGroupe017M("affichage", "Apparence");
        const entreesOutils = pdiEntreesGroupe017M("affichage", "Outils");

        return (
          <>
            {/* Outils prioritaires : Espace de travail, Multi-écran & Cast TV */}
            {entreesOutils.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {entreesZoom.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {entreesReperes.map(renderSingleEntry)}

            <div className="h-px bg-[#30363D]/80 my-1" />

            {/* Flyout Submenu: Apparence & Calques */}
            {entreesApparence.length > 0 && (
              <DropdownSubmenu
                icon={<Palette className="w-4 h-4 text-pink-400" />}
                label="Apparence & Couleurs..."
                isOpen={openSubmenuId === "affichage.apparence"}
                onHover={() => handleSubmenuHover("affichage.apparence")}
                onLeave={handleSubmenuLeave}
              >
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400 border-b border-[#30363D] mb-1">
                  Styles Visuels
                </div>
                {entreesApparence.map(renderSingleEntry)}
              </DropdownSubmenu>
            )}
          </>
        );
      }

      default: {
        // Fallback generic listing
        const groupes = pdiGroupesOnglet017M(activeTab);
        return (
          <>
            {groupes.map((groupe, idx) => {
              const entrees = pdiEntreesGroupe017M(activeTab, groupe);
              return (
                <React.Fragment key={groupe}>
                  {idx > 0 && <div className="h-px bg-[#30363D]/80 my-1" />}
                  <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-zinc-400">
                    {groupe}
                  </div>
                  {entrees.map(renderSingleEntry)}
                </React.Fragment>
              );
            })}
          </>
        );
      }
    }
  };

  return (
    <>
      {/* Backdrop transparent pour cliquer en dehors et fermer immédiatement */}
      <div
        className="fixed inset-0 z-[10025] bg-black/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Vertical Dropdown Popover (modèle Photo 2) */}
      <div
        className="fixed top-[46px] z-[10030] w-64 p-1.5 bg-[#0D1117] border border-[#30363D] rounded-xl shadow-2xl shadow-black/95 text-white flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
        style={{
          left: typeof anchorLeft === "number" ? Math.max(12, Math.min(anchorLeft, window.innerWidth - 276)) : "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Menu ${activeTab}`}
      >
        {renderTabDropdownContent()}
      </div>
    </>
  );
};
