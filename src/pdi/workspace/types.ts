/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * 
 * MODULE : ESPACE DE TRAVAIL MULTI-ÉCRAN (017Q3 — MULTI-SCREEN FOUNDATION)
 * ARCHITECTURE : UN SEUL MODÈLE PD&I + PLUSIEURS VUES SYNCHRONISÉES.
 */

import { PdiUniversalEntity } from "../model/pdiUniversalEntity";

/** Identifiants des vues détachables dans le workspace */
export type PdiWorkspaceViewId =
  | "iso"
  | "3d"
  | "spool"
  | "properties"
  | "library"
  | "bom"
  | "tree"
  | "documents";

/** Profils prédéfinis d'espace de travail */
export type PdiWorkspaceProfileId =
  | "conception"
  | "conception_3d"
  | "fabrication"
  | "inspection"
  | "bibliotheque"
  | "documentation"
  | "custom";

/** Mode d'affichage de l'espace de travail */
export type PdiWorkspaceMode = "single_screen" | "dual_screen";

/** Définition d'un profil d'espace de travail */
export interface PdiWorkspaceProfileDef {
  id: PdiWorkspaceProfileId;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  screen1View: PdiWorkspaceViewId;
  screen2View: PdiWorkspaceViewId;
  icon: string;
  badge?: string;
}

/** Métadonnées sur les vues disponibles */
export interface PdiWorkspaceViewMeta {
  id: PdiWorkspaceViewId;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  iconName: string;
  category: "editor" | "spatial" | "fabrication" | "data" | "meta";
}

/** État de sélection synchronisé entre toutes les vues */
export interface PdiWorkspaceSelectionState {
  selectedNodeId: string | null;
  selectedSegmentId: string | null;
  selectedSupportId: string | null;
  selectedComponentId: string | null;
  selectedWeldId: string | null;
  selectedSpoolId: string | null;
  selectedType: string | null;
  timestamp: number;
}

/** Instantané géométrique et métier du modèle central (lecture seule pour le bus multi-écran, ARCH-04) */
export interface PdiWorkspaceModelSnapshot {
  projectName: string;
  projectId?: string;
  documentId?: string;
  unitSystem: "metric" | "imperial";
  nodes: any[];
  segments: any[];
  supports: any[];
  welds: any[];
  spools: any[];
  bomRows: any[];
  revision?: string;
  updatedAt: string;
}

/** Préférences d'affichage de la vue */
export interface PdiWorkspaceDisplayPreferences {
  theme: "dark" | "light" | "blueprint";
  showGrid: boolean;
  showDimensions: boolean;
  showWelds: boolean;
  showSupports: boolean;
  showTags: boolean;
  solidShadingMode?: string;
}

/**
 * État complet du Workspace PD&I (ARCH-04).
 * RÈGLE ARCHITECTURALE ARCH-04 : Le Workspace est le contexte d'édition/présentation,
 * jamais la source de vérité des données métier ou normatives.
 */
export interface PdiWorkspaceState {
  workspaceId?: string;
  projectId?: string;
  activeDocumentId?: string;
  mode: PdiWorkspaceMode;
  profile: PdiWorkspaceProfileId;
  screen1View: PdiWorkspaceViewId;
  screen2View: PdiWorkspaceViewId;
  selection: PdiWorkspaceSelectionState;
  activeEntity: PdiUniversalEntity | null;
  modelSnapshot: PdiWorkspaceModelSnapshot;
  displayPreferences: PdiWorkspaceDisplayPreferences;
  secondaryConnected: boolean;
  lastUpdateTimestamp: number;
}

/** Configuration utilisateur de l'espace de travail */
export interface PdiWorkspaceConfig {
  mode: PdiWorkspaceMode;
  profile: PdiWorkspaceProfileId;
  screen1View: PdiWorkspaceViewId;
  screen2View: PdiWorkspaceViewId;
  syncSelection: boolean;
  syncModel: boolean;
  syncCamera: boolean;
  autoOpenSecondaryWindow: boolean;
}

/** Messages transitant sur le BroadcastChannel inter-fenêtres */
export type PdiWorkspaceSyncMessage =
  | {
      type: "PDI_WS_HELLO_PRIMARY";
      timestamp: number;
      state: PdiWorkspaceState;
    }
  | {
      type: "PDI_WS_HELLO_SECONDARY";
      timestamp: number;
      requestedView?: PdiWorkspaceViewId;
    }
  | {
      type: "PDI_WS_STATE_SYNC";
      timestamp: number;
      state: PdiWorkspaceState;
      sender: "primary" | "secondary";
    }
  | {
      type: "PDI_WS_SELECTION_CHANGE";
      timestamp: number;
      selection: PdiWorkspaceSelectionState;
      activeEntity: PdiUniversalEntity | null;
      sender: "primary" | "secondary";
    }
  | {
      type: "PDI_WS_MODEL_UPDATE";
      timestamp: number;
      modelSnapshot: PdiWorkspaceModelSnapshot;
      sender: "primary" | "secondary";
    }
  | {
      type: "PDI_WS_CHANGE_VIEW";
      timestamp: number;
      screen2View: PdiWorkspaceViewId;
      sender: "primary" | "secondary";
    }
  | {
      type: "PDI_WS_ENTITY_MODIFY";
      timestamp: number;
      entity: PdiUniversalEntity;
      sender: "secondary";
    }
  | {
      type: "PDI_WS_PING";
      timestamp: number;
      sender: "primary" | "secondary";
    }
  | {
      type: "PDI_WS_PONG";
      timestamp: number;
      sender: "primary" | "secondary";
    }
  | {
      type: "PDI_WS_CLOSE_SECONDARY";
      timestamp: number;
      reason?: string;
    };

/** Registre des profils prédéfinis */
export const PDI_WORKSPACE_PROFILES: PdiWorkspaceProfileDef[] = [
  {
    id: "conception",
    labelFr: "Conception & Propriétés",
    labelEn: "Design & Properties",
    descriptionFr: "Écran 1 = Éditeur ISO 30°, Écran 2 = Inspecteur universel de propriétés et composants",
    screen1View: "iso",
    screen2View: "properties",
    icon: "Sliders",
    badge: "Populaire",
  },
  {
    id: "conception_3d",
    labelFr: "Conception 3D Solide",
    labelEn: "3D Solid Design",
    descriptionFr: "Écran 1 = Éditeur ISO 30°, Écran 2 = Visionneuse 3D solide temps-réel avec orbite",
    screen1View: "iso",
    screen2View: "3d",
    icon: "Box",
    badge: "Recommandé",
  },
  {
    id: "fabrication",
    labelFr: "Fabrication & Spools",
    labelEn: "Spool & Fabrication",
    descriptionFr: "Écran 1 = Éditeur ISO 30°, Écran 2 = Carnet de spools, soudures et traçabilité atelier",
    screen1View: "iso",
    screen2View: "spool",
    icon: "Flame",
    badge: "Atelier",
  },
  {
    id: "inspection",
    labelFr: "Inspection & Structure",
    labelEn: "Inspection & Tree",
    descriptionFr: "Écran 1 = Éditeur ISO 30°, Écran 2 = Arbre complet du projet et contrôles qualité",
    screen1View: "iso",
    screen2View: "tree",
    icon: "FolderTree",
  },
  {
    id: "bibliotheque",
    labelFr: "Bibliothèque Composants",
    labelEn: "Component Library",
    descriptionFr: "Écran 1 = Éditeur ISO 30°, Écran 2 = Catalogue vannes, raccords, brides et supports MSS",
    screen1View: "iso",
    screen2View: "library",
    icon: "Layers",
  },
  {
    id: "documentation",
    labelFr: "Documentation & Métré",
    labelEn: "Documentation & BOM",
    descriptionFr: "Écran 1 = Éditeur ISO 30°, Écran 2 = Nomenclature BOM industrielle, métré et planches",
    screen1View: "iso",
    screen2View: "bom",
    icon: "FileSpreadsheet",
  },
  {
    id: "custom",
    labelFr: "Personnalisé (Custom)",
    labelEn: "Custom Workspace",
    descriptionFr: "Combinaison libre des vues selon vos besoins d'ingénierie",
    screen1View: "iso",
    screen2View: "3d",
    icon: "Sparkles",
  },
];

/** Registre des vues d'espace de travail */
export const PDI_WORKSPACE_VIEWS: PdiWorkspaceViewMeta[] = [
  {
    id: "iso",
    labelFr: "Éditeur ISO 30°",
    labelEn: "ISO 30° Editor",
    descriptionFr: "Espace de dessin vectoriel et modélisation isométrique 3D",
    iconName: "Spline",
    category: "editor",
  },
  {
    id: "3d",
    labelFr: "Vue 3D Solide",
    labelEn: "3D Solid View",
    descriptionFr: "Rendu volumique WebGL temps-réel, orbite libre et visualisation solide",
    iconName: "Box",
    category: "spatial",
  },
  {
    id: "spool",
    labelFr: "Carnet de Spools & Soudures",
    labelEn: "Spool & Weld Schedule",
    descriptionFr: "Découpage préfabrication, numérotation des spools et suivi CND",
    iconName: "Flame",
    category: "fabrication",
  },
  {
    id: "properties",
    labelFr: "Inspecteur de Propriétés",
    labelEn: "Property Inspector",
    descriptionFr: "Édition technique détaillée de l'entité sélectionnée (DN, PN, matériau, tag)",
    iconName: "Sliders",
    category: "data",
  },
  {
    id: "library",
    labelFr: "Bibliothèque & Catalogue",
    labelEn: "Catalog & Library",
    descriptionFr: "Catalogue de composants industriels normalisés ASME / ISO / DIN",
    iconName: "Layers",
    category: "data",
  },
  {
    id: "bom",
    labelFr: "BOM & Nomenclature",
    labelEn: "BOM & Bill of Materials",
    descriptionFr: "Métré automatique, liste des tubes, raccords, brides et robinetterie",
    iconName: "FileSpreadsheet",
    category: "data",
  },
  {
    id: "tree",
    labelFr: "Arbre du Projet",
    labelEn: "Project Hierarchy Tree",
    descriptionFr: "Structure arborescente des lignes, tronçons, piquages et équipements",
    iconName: "FolderTree",
    category: "meta",
  },
  {
    id: "documents",
    labelFr: "Documents & Planches A3",
    labelEn: "Drawing Sheets & Exports",
    descriptionFr: "Aperçu des planches d'impression normalisées avec cartouche",
    iconName: "LayoutGrid",
    category: "meta",
  },
];
