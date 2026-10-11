/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * PROJECT, DOCUMENT & WORKSPACE CONTEXT CONTRACT
 * Reference: ARCH-04 (Project / Workspace / Data Unification)
 *
 * ARCHITECTURE CIBLE & SOURCE DE VÉRITÉ :
 * 1. ProjectContext: Agrégat racine industriel (projectId, projectName, metadata, documents, activeWorkspaceId)
 * 2. DocumentContext: Support d'ingénierie et de délivrables (documentId, projectId, kind, model)
 * 3. WorkspaceContext: Contexte d'affichage, de navigation et de sélection (workspaceId, layout, selection, viewport)
 *    -> RÈGLE ABSOLUE : Le Workspace ne devient JAMAIS source de vérité des données métier.
 * 4. UniversalEntity: Identité métier transversale (PdiUniversalEntity, ARCH-03 locked)
 * 5. NormativeEngine: Seule autorité normative (NORM-01..NORM-14, ARCH-01/02 locked)
 * 6. IsoProjectFileV474: Format de sérialisation et de persistance (schemaVersion: "4.7.4")
 */

import type {
  IsoNode,
  IsoSegment,
  PipingLine,
  IsoDimension,
  IsoPipingSupport,
  Cad2dLayer,
  Cad2dEntity,
} from "../isometric/types/isoGraphTypes";
import type { PdiSpoolEntry, PdiWeldEntry } from "../welding/isoWeldSpoolEngine";
import type {
  PdiWorkspaceMode,
  PdiWorkspaceProfileId,
  PdiWorkspaceViewId,
  PdiWorkspaceSelectionState,
  PdiWorkspaceDisplayPreferences,
} from "../workspace/types";
import type { EngineeringDomainId } from "../engineering/types/engineeringDomainTypes";

export type PdiProjectId = string;
export type PdiDocumentId = string;
export type PdiWorkspaceId = string;
export type PdiEntityId = string;

/**
 * Types de documents d'ingénierie rattachés à un projet PD&I.
 */
export type PdiDocumentKind =
  | "ISOMETRIC"
  | "CAD_2D"
  | "VIEW_3D"
  | "DELIVERABLE";

/**
 * Référence légère vers un document appartenant à un projet.
 */
export interface PdiDocumentRef {
  readonly documentId: PdiDocumentId;
  readonly projectId: PdiProjectId;
  readonly kind: PdiDocumentKind;
  readonly title: string;
  readonly revision?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Modèle opérationnel d'un document isométrique / CAO.
 * Contient le graphe géométrique et topologique de travail.
 */
export interface PdiDocumentModel {
  readonly lines: readonly PipingLine[];
  readonly nodes: readonly IsoNode[];
  readonly segments: readonly IsoSegment[];
  readonly dimensions: readonly IsoDimension[];
  readonly supports: readonly IsoPipingSupport[];
  readonly spools: readonly PdiSpoolEntry[];
  readonly welds: readonly PdiWeldEntry[];
  readonly cad2d: {
    readonly layers: readonly Cad2dLayer[];
    readonly entities: readonly Cad2dEntity[];
  };
}

/**
 * Entité Document complète (ARCH-04 §9).
 */
export interface PdiDocument extends PdiDocumentRef {
  readonly model: PdiDocumentModel;
}

/**
 * Références normatives projet (déclaratives uniquement, jamais d'auto-certification).
 */
export interface PdiProjectNormativeRefs {
  readonly defaultPipingSpecId?: string;
  readonly defaultDesignCodeId?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Métadonnées industrielles du projet PD&I.
 */
export interface PdiProjectMetadata {
  readonly ownerUid: string;
  readonly wilaya: string;
  readonly pressDesign?: number;
  readonly unitSystem: "metric" | "imperial";
  readonly revision?: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly legacyAdminProjectId?: string;
  /** Domaine d'ingénierie principal du projet (ARCH-08: PIPING, PIPELINE, PACKAGE, EQUIPMENT) */
  readonly engineeringDomain?: EngineeringDomainId;
}

/**
 * Contexte Projet racine (ARCH-04 §4).
 * Agrégat racine possédant l'identité globale, les documents et la référence workspace.
 */
export interface PdiProjectContext {
  readonly projectId: PdiProjectId;
  readonly projectName: string;
  readonly metadata: PdiProjectMetadata;
  readonly workspaceId: PdiWorkspaceId;
  readonly activeDocumentId: PdiDocumentId;
  readonly documents: readonly PdiDocumentRef[];
  readonly normativeRefs?: PdiProjectNormativeRefs;
  /** Domaine d'ingénierie actif (ARCH-08: PIPING, PIPELINE, PACKAGE, EQUIPMENT) */
  readonly engineeringDomain?: EngineeringDomainId;
}

/**
 * Configuration de la vue et des outils de dessin dans l'éditeur.
 */
export interface PdiViewportState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export interface PdiWorkspaceEditorSettings {
  readonly showGrid: boolean;
  readonly showDimensions: boolean;
  readonly showPipeLabels: boolean;
  readonly showLabels: boolean;
  readonly showWelds: boolean;
  readonly isoSnapStep: number;
  readonly viewport: PdiViewportState;
}

/**
 * Contexte Workspace (ARCH-04 §5).
 * Représente l'état d'affichage, d'écrans, de sélection et d'interface utilisateur.
 * N'est JAMAIS source de vérité des données métier ou normatives.
 */
export interface PdiWorkspaceContext {
  readonly workspaceId: PdiWorkspaceId;
  readonly projectId: PdiProjectId;
  readonly activeDocumentId: PdiDocumentId;
  readonly mode: PdiWorkspaceMode;
  readonly profile: PdiWorkspaceProfileId;
  readonly screen1View: PdiWorkspaceViewId;
  readonly screen2View: PdiWorkspaceViewId;
  readonly selection: Readonly<PdiWorkspaceSelectionState>;
  readonly displayPreferences: Readonly<PdiWorkspaceDisplayPreferences>;
  readonly editorSettings: Readonly<PdiWorkspaceEditorSettings>;
}

/**
 * Bundle unifié complet liant Project, Documents et Workspace.
 */
export interface PdiProjectBundle {
  readonly project: PdiProjectContext;
  readonly documents: ReadonlyMap<PdiDocumentId, PdiDocument>;
  readonly workspace: PdiWorkspaceContext;
}
