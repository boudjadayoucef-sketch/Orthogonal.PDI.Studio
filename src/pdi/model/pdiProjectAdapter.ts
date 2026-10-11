/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * PROJECT, DOCUMENT & WORKSPACE ADAPTER
 * Reference: ARCH-04 / ARCH-04-FIX-01 (Removal of Fabricated Technical Defaults)
 *
 * Passerelle d'unification bidirectionnelle et sans effets de bord entre :
 * - ProjectContext (agrégat racine)
 * - PdiDocument (support métier opérationnel)
 * - PdiWorkspaceContext (contexte UI/présentation)
 * - IsoProjectFileV474 (persistance/export schemaVersion 4.7.4)
 * - PdiUniversalEntity (modèle métier transversal ARCH-03)
 * - Project (Module de gestion administrative legacy)
 *
 * RÈGLE ARCH-04-FIX-01 : ABSENCE DE DONNÉE TECHNIQUE = ABSENCE DE DONNÉE.
 * Aucune valeur de pression (ex: 40 bar), dimension ou norme n'est fabriquée par défaut
 * lorsqu'elle est absente de la source.
 */

import type {
  IsoNode,
  IsoSegment,
  PipingLine,
  IsoDimension,
  IsoPipingSupport,
  Cad2dLayer,
  Cad2dEntity,
  IsoProjectFileV474,
} from "../isometric/types/isoGraphTypes";
import type {
  PdiProjectId,
  PdiDocumentId,
  PdiWorkspaceId,
  PdiDocumentKind,
  PdiDocumentRef,
  PdiDocumentModel,
  PdiDocument,
  PdiProjectMetadata,
  PdiProjectNormativeRefs,
  PdiProjectContext,
  PdiWorkspaceEditorSettings,
  PdiWorkspaceContext,
  PdiProjectBundle,
} from "./pdiProjectContext";
import {
  PdiUniversalEntity,
} from "./pdiUniversalEntity";
import {
  nodeToUniversalEntity,
  segmentToUniversalEntity,
  fittingToUniversalEntity,
  supportToUniversalEntity,
  cad2dToUniversalEntity,
  applyUniversalEntityToGraph,
  UniversalGraphState,
} from "./pdiUniversalAdapter";
import type { PdiWorkspaceState } from "../workspace/types";
import type { Project as LegacyAdminProject } from "../../components/project-management/types";

function generateScopedId(prefix: string, seed?: string): string {
  if (seed && typeof seed === "string" && seed.trim().length > 0) {
    const cleanSeed = seed.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${prefix}_${cleanSeed}`;
  }
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

export function isValidStableId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0;
}

export function parseOptionalNumeric(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

export interface CreateProjectContextParams {
  readonly projectId?: string;
  readonly projectName?: string;
  readonly ownerUid?: string;
  readonly wilaya?: string;
  readonly pressDesign?: number;
  readonly unitSystem?: "metric" | "imperial";
  readonly revision?: string;
  readonly description?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly workspaceId?: string;
  readonly activeDocumentId?: string;
  readonly documents?: readonly PdiDocumentRef[];
  readonly normativeRefs?: PdiProjectNormativeRefs;
  readonly legacyAdminProjectId?: string;
  readonly engineeringDomain?: import("../engineering/types/engineeringDomainTypes").EngineeringDomainId;
}

export function createProjectContext(params?: CreateProjectContextParams): PdiProjectContext {
  const now = new Date().toISOString();
  const projectId = isValidStableId(params?.projectId)
    ? params!.projectId.trim()
    : generateScopedId("proj");
  const workspaceId = isValidStableId(params?.workspaceId)
    ? params!.workspaceId.trim()
    : generateScopedId("ws", projectId);
  const activeDocumentId = isValidStableId(params?.activeDocumentId)
    ? params!.activeDocumentId.trim()
    : generateScopedId("doc_iso", projectId);

  const defaultDocRef: PdiDocumentRef = {
    documentId: activeDocumentId,
    projectId,
    kind: "ISOMETRIC",
    title: params?.projectName ? `ISO - ${params.projectName}` : "Plan Isométrique Principal",
    revision: params?.revision || "A",
    createdAt: params?.createdAt || now,
    updatedAt: params?.updatedAt || now,
  };

  const documents = params?.documents && params.documents.length > 0
    ? params.documents
    : [defaultDocRef];

  const engineeringDomain = params?.engineeringDomain || "PIPING";

  return Object.freeze({
    projectId,
    projectName: params?.projectName || "Projet Isométrique PD&I",
    metadata: Object.freeze({
      ownerUid: params?.ownerUid || "",
      wilaya: params?.wilaya || "",
      pressDesign: parseOptionalNumeric(params?.pressDesign),
      unitSystem: params?.unitSystem === "imperial" ? "imperial" : "metric",
      revision: params?.revision || "A",
      description: params?.description,
      createdAt: params?.createdAt || now,
      updatedAt: params?.updatedAt || now,
      legacyAdminProjectId: params?.legacyAdminProjectId,
      engineeringDomain,
    }),
    workspaceId,
    activeDocumentId,
    documents: Object.freeze(documents.map((d) => Object.freeze({ ...d }))),
    normativeRefs: params?.normativeRefs ? Object.freeze({ ...params.normativeRefs }) : undefined,
    engineeringDomain,
  });
}

export interface CreateDocumentParams {
  readonly documentId?: string;
  readonly projectId: string;
  readonly kind?: PdiDocumentKind;
  readonly title?: string;
  readonly revision?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly model?: Partial<PdiDocumentModel>;
}

export function createEmptyDocumentModel(): PdiDocumentModel {
  return Object.freeze({
    lines: Object.freeze([]),
    nodes: Object.freeze([]),
    segments: Object.freeze([]),
    dimensions: Object.freeze([]),
    supports: Object.freeze([]),
    spools: Object.freeze([]),
    welds: Object.freeze([]),
    cad2d: Object.freeze({
      layers: Object.freeze([
        { id: "axes_tuyauterie", name: "Axes tuyauterie", color: "#9CA3AF", visible: true, locked: false },
        { id: "annotations", name: "Annotations", color: "#9CA3AF", visible: true, locked: false },
        { id: "import_cad", name: "Import CAD / fond plan", color: "#888888", visible: true, locked: false },
      ]),
      entities: Object.freeze([]),
    }),
  });
}

export function createDocument(params: CreateDocumentParams): PdiDocument {
  const now = new Date().toISOString();
  if (!isValidStableId(params.projectId)) {
    throw new Error("[ARCH-04] Document must belong to a valid projectId.");
  }

  const documentId = isValidStableId(params.documentId)
    ? params.documentId.trim()
    : generateScopedId("doc", params.projectId);

  const initialModel = createEmptyDocumentModel();
  const mergedModel: PdiDocumentModel = Object.freeze({
    lines: Object.freeze(params.model?.lines ? [...params.model.lines] : initialModel.lines),
    nodes: Object.freeze(params.model?.nodes ? [...params.model.nodes] : initialModel.nodes),
    segments: Object.freeze(params.model?.segments ? [...params.model.segments] : initialModel.segments),
    dimensions: Object.freeze(params.model?.dimensions ? [...params.model.dimensions] : initialModel.dimensions),
    supports: Object.freeze(params.model?.supports ? [...params.model.supports] : initialModel.supports),
    spools: Object.freeze(params.model?.spools ? [...params.model.spools] : initialModel.spools),
    welds: Object.freeze(params.model?.welds ? [...params.model.welds] : initialModel.welds),
    cad2d: Object.freeze({
      layers: Object.freeze(params.model?.cad2d?.layers ? [...params.model.cad2d.layers] : initialModel.cad2d.layers),
      entities: Object.freeze(params.model?.cad2d?.entities ? [...params.model.cad2d.entities] : initialModel.cad2d.entities),
    }),
  });

  return Object.freeze({
    documentId,
    projectId: params.projectId,
    kind: params.kind || "ISOMETRIC",
    title: params.title || "Nouveau document",
    revision: params.revision || "A",
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    model: mergedModel,
  });
}

export interface CreateWorkspaceContextParams {
  readonly workspaceId?: string;
  readonly projectId: string;
  readonly activeDocumentId: string;
  readonly mode?: "single_screen" | "dual_screen";
  readonly profile?: "conception" | "conception_3d" | "fabrication" | "inspection" | "bibliotheque" | "documentation" | "custom";
  readonly screen1View?: "iso" | "3d" | "spool" | "properties" | "library" | "bom" | "tree" | "documents";
  readonly screen2View?: "iso" | "3d" | "spool" | "properties" | "library" | "bom" | "tree" | "documents";
  readonly selection?: Partial<PdiWorkspaceContext["selection"]>;
  readonly displayPreferences?: Partial<PdiWorkspaceContext["displayPreferences"]>;
  readonly editorSettings?: Partial<PdiWorkspaceEditorSettings>;
}

export function createWorkspaceContext(params: CreateWorkspaceContextParams): PdiWorkspaceContext {
  if (!isValidStableId(params.projectId)) {
    throw new Error("[ARCH-04] Workspace must reference a valid projectId.");
  }
  if (!isValidStableId(params.activeDocumentId)) {
    throw new Error("[ARCH-04] Workspace must reference a valid activeDocumentId.");
  }

  const workspaceId = isValidStableId(params.workspaceId)
    ? params.workspaceId.trim()
    : generateScopedId("ws", params.projectId);

  return Object.freeze({
    workspaceId,
    projectId: params.projectId,
    activeDocumentId: params.activeDocumentId,
    mode: params.mode || "single_screen",
    profile: params.profile || "conception",
    screen1View: params.screen1View || "iso",
    screen2View: params.screen2View || "properties",
    selection: Object.freeze({
      selectedNodeId: params.selection?.selectedNodeId ?? null,
      selectedSegmentId: params.selection?.selectedSegmentId ?? null,
      selectedSupportId: params.selection?.selectedSupportId ?? null,
      selectedComponentId: params.selection?.selectedComponentId ?? null,
      selectedWeldId: params.selection?.selectedWeldId ?? null,
      selectedSpoolId: params.selection?.selectedSpoolId ?? null,
      selectedType: params.selection?.selectedType ?? null,
      timestamp: params.selection?.timestamp ?? Date.now(),
    }),
    displayPreferences: Object.freeze({
      theme: params.displayPreferences?.theme || "dark",
      showGrid: params.displayPreferences?.showGrid !== false,
      showDimensions: params.displayPreferences?.showDimensions !== false,
      showWelds: params.displayPreferences?.showWelds !== false,
      showSupports: params.displayPreferences?.showSupports !== false,
      showTags: params.displayPreferences?.showTags !== false,
      solidShadingMode: params.displayPreferences?.solidShadingMode,
    }),
    editorSettings: Object.freeze({
      showGrid: params.editorSettings?.showGrid !== false,
      showDimensions: params.editorSettings?.showDimensions !== false,
      showPipeLabels: params.editorSettings?.showPipeLabels !== false,
      showLabels: params.editorSettings?.showLabels !== false,
      showWelds: params.editorSettings?.showWelds !== false,
      isoSnapStep: Number(params.editorSettings?.isoSnapStep) || 0.5,
      viewport: Object.freeze({
        zoom: Number(params.editorSettings?.viewport?.zoom) || 1,
        panX: Number(params.editorSettings?.viewport?.panX) || 0,
        panY: Number(params.editorSettings?.viewport?.panY) || 0,
      }),
    }),
  });
}

export function createDefaultProjectBundle(params?: CreateProjectContextParams): PdiProjectBundle {
  const project = createProjectContext(params);
  const primaryDoc = createDocument({
    documentId: project.activeDocumentId,
    projectId: project.projectId,
    kind: "ISOMETRIC",
    title: `ISO - ${project.projectName}`,
    revision: project.metadata.revision,
    createdAt: project.metadata.createdAt,
    updatedAt: project.metadata.updatedAt,
  });

  const workspace = createWorkspaceContext({
    workspaceId: project.workspaceId,
    projectId: project.projectId,
    activeDocumentId: project.activeDocumentId,
  });

  const docsMap = new Map<PdiDocumentId, PdiDocument>();
  docsMap.set(primaryDoc.documentId, primaryDoc);

  return Object.freeze({
    project,
    documents: docsMap,
    workspace,
  });
}

/**
 * ARCH-04 / ARCH-04-FIX-01: Adapte un fichier historique ou snapshot IsoProjectFileV474 en bundle de projet unifié.
 * RÈGLE ARCHITECTURALE : Ne mute JAMAIS l'objet source et n'invente AUCUNE valeur technique par défaut.
 */
export function isoProjectFileV474ToProjectBundle(
  input: unknown,
  options?: { fallbackOwnerUid?: string; defaultDocumentId?: string; defaultWorkspaceId?: string }
): PdiProjectBundle {
  if (!input || typeof input !== "object") {
    throw new Error("[ARCH-04] Fichier projet vide ou invalide");
  }

  const raw = input as any;
  const rawProject = raw.project || {};
  const rawModel = raw.model || raw;
  const rawWorkspace = raw.workspace || raw.settings || {};

  const projectId = isValidStableId(rawProject.id)
    ? String(rawProject.id).trim()
    : generateScopedId("proj");

  const documentId = isValidStableId(rawProject.documentId)
    ? String(rawProject.documentId).trim()
    : isValidStableId(options?.defaultDocumentId)
      ? options!.defaultDocumentId!.trim()
      : generateScopedId("doc_iso", projectId);

  const workspaceId = isValidStableId(rawProject.workspaceId)
    ? String(rawProject.workspaceId).trim()
    : isValidStableId(options?.defaultWorkspaceId)
      ? options!.defaultWorkspaceId!.trim()
      : generateScopedId("ws", projectId);

  const now = new Date().toISOString();
  const createdAt = rawProject.createdAt ? String(rawProject.createdAt) : now;
  const updatedAt = rawProject.updatedAt ? String(rawProject.updatedAt) : now;
  const projectName = String(rawProject.name || "Projet isométrique");

  const lines: PipingLine[] = Array.isArray(rawModel.lines) ? rawModel.lines.map((l: any) => ({ ...l })) : [];
  const nodes: IsoNode[] = Array.isArray(rawModel.nodes) ? rawModel.nodes.map((n: any) => ({ ...n })) : [];
  const segments: IsoSegment[] = Array.isArray(rawModel.segments) ? rawModel.segments.map((s: any) => ({ ...s })) : [];
  const dimensions: IsoDimension[] = Array.isArray(rawModel.dimensions) ? rawModel.dimensions.map((d: any) => ({ ...d })) : [];
  const supports: IsoPipingSupport[] = Array.isArray(rawModel.supports) ? rawModel.supports.map((s: any) => ({ ...s })) : [];
  const spools: any[] = Array.isArray(rawModel.spools) ? rawModel.spools.map((sp: any) => ({ ...sp })) : [];
  const welds: any[] = Array.isArray(rawModel.welds) ? rawModel.welds.map((w: any) => ({ ...w })) : [];
  const cad2d = {
    layers: Array.isArray(rawModel.cad2d?.layers) ? rawModel.cad2d.layers.map((ly: any) => ({ ...ly })) : [
      { id: "axes_tuyauterie", name: "Axes tuyauterie", color: "#9CA3AF", visible: true, locked: false },
      { id: "annotations", name: "Annotations", color: "#9CA3AF", visible: true, locked: false },
      { id: "import_cad", name: "Import CAD / fond plan", color: "#888888", visible: true, locked: false },
    ],
    entities: Array.isArray(rawModel.cad2d?.entities) ? rawModel.cad2d.entities.map((e: any) => ({ ...e })) : [],
  };

  const project = createProjectContext({
    projectId,
    projectName,
    ownerUid: String(rawProject.ownerUid || options?.fallbackOwnerUid || ""),
    wilaya: String(rawProject.wilaya || ""),
    pressDesign: parseOptionalNumeric(rawProject.pressDesign),
    unitSystem: rawProject.unitSystem === "imperial" ? "imperial" : "metric",
    createdAt,
    updatedAt,
    workspaceId,
    activeDocumentId: documentId,
  });

  const document = createDocument({
    documentId,
    projectId,
    kind: "ISOMETRIC",
    title: `ISO - ${projectName}`,
    createdAt,
    updatedAt,
    model: {
      lines,
      nodes,
      segments,
      dimensions,
      supports,
      spools,
      welds,
      cad2d,
    },
  });

  const workspace = createWorkspaceContext({
    workspaceId,
    projectId,
    activeDocumentId: documentId,
    editorSettings: {
      showGrid: rawWorkspace.showGrid !== false,
      showDimensions: rawWorkspace.showDimensions !== false,
      showPipeLabels: rawWorkspace.showPipeLabels !== false,
      showLabels: rawWorkspace.showLabels !== false,
      showWelds: rawWorkspace.showWelds !== false,
      isoSnapStep: Number(rawWorkspace.isoSnapStep) || 0.5,
      viewport: {
        zoom: Number(rawWorkspace.viewport?.zoom) || 1,
        panX: Number(rawWorkspace.viewport?.panX) || 0,
        panY: Number(rawWorkspace.viewport?.panY) || 0,
      },
    },
  });

  const docsMap = new Map<PdiDocumentId, PdiDocument>();
  docsMap.set(document.documentId, document);

  return Object.freeze({
    project,
    documents: docsMap,
    workspace,
  });
}

/**
 * ARCH-04: Convertit un bundle unifié en IsoProjectFileV474 strictement valide.
 * RÈGLE : Conserve 100% de compatibilité avec schemaVersion 4.7.4 sans fabriquer de données techniques par défaut.
 */
export function projectBundleToIsoProjectFileV474(
  bundle: PdiProjectBundle,
  targetDocumentId?: string
): IsoProjectFileV474 {
  const docId = targetDocumentId || bundle.project.activeDocumentId;
  const doc = bundle.documents.get(docId) || Array.from(bundle.documents.values())[0];
  if (!doc) {
    throw new Error(`[ARCH-04] Document ${docId} introuvable dans le bundle projet.`);
  }

  const now = new Date().toISOString();
  return {
    schemaVersion: "4.7.4",
    exportedAt: now,
    project: {
      id: bundle.project.projectId,
      documentId: doc.documentId,
      workspaceId: bundle.workspace.workspaceId,
      ownerUid: bundle.project.metadata.ownerUid,
      name: bundle.project.projectName,
      wilaya: bundle.project.metadata.wilaya,
      pressDesign: parseOptionalNumeric(bundle.project.metadata.pressDesign),
      createdAt: bundle.project.metadata.createdAt,
      updatedAt: doc.updatedAt || bundle.project.metadata.updatedAt || now,
      unitSystem: bundle.project.metadata.unitSystem,
    },
    model: {
      lines: doc.model.lines.map((l) => ({ ...l })),
      nodes: doc.model.nodes.map((n) => ({ ...n })),
      segments: doc.model.segments.map((s) => ({ ...s })),
      dimensions: doc.model.dimensions.map((d) => ({ ...d })),
      supports: doc.model.supports.map((s) => ({ ...s })),
      spools: doc.model.spools.map((sp) => ({ ...sp })),
      welds: doc.model.welds.map((w) => ({ ...w })),
      cad2d: {
        layers: doc.model.cad2d.layers.map((ly) => ({ ...ly })),
        entities: doc.model.cad2d.entities.map((e) => ({ ...e })),
      },
    },
    workspace: {
      showGrid: bundle.workspace.editorSettings.showGrid,
      showDimensions: bundle.workspace.editorSettings.showDimensions,
      showPipeLabels: bundle.workspace.editorSettings.showPipeLabels,
      showLabels: bundle.workspace.editorSettings.showLabels,
      showWelds: bundle.workspace.editorSettings.showWelds,
      isoSnapStep: bundle.workspace.editorSettings.isoSnapStep,
      viewport: {
        zoom: bundle.workspace.editorSettings.viewport.zoom,
        panX: bundle.workspace.editorSettings.viewport.panX,
        panY: bundle.workspace.editorSettings.viewport.panY,
      },
    },
  };
}

export function serializeProjectBundleToV474Json(
  bundle: PdiProjectBundle,
  targetDocumentId?: string
): string {
  const file = projectBundleToIsoProjectFileV474(bundle, targetDocumentId);
  return JSON.stringify(file, null, 2);
}

export function deserializeProjectBundleFromV474Json(
  jsonString: string,
  options?: { fallbackOwnerUid?: string }
): PdiProjectBundle {
  const parsed = JSON.parse(jsonString);
  return isoProjectFileV474ToProjectBundle(parsed, options);
}

/**
 * ARCH-04 §7: Dérive les entités métier universelles (PdiUniversalEntity) depuis un document.
 * Unidirectionnel, sans duplication d'identifiants et sans invention de données techniques/normatives.
 */
export function deriveUniversalEntitiesFromDocument(
  document: PdiDocument,
  project?: PdiProjectContext
): readonly PdiUniversalEntity[] {
  const source = document.kind === "CAD_2D" ? "2D" : "ISOMETRIC";
  const projectId = project?.projectId || document.projectId;
  const options = { projectId, source };

  const entities: PdiUniversalEntity[] = [];

  // 1. Nœuds / Composants
  for (const node of document.model.nodes) {
    const linkedSegments = document.model.segments.filter(
      (s) => s.fromNodeId === node.id || s.toNodeId === node.id
    );
    entities.push(nodeToUniversalEntity(node, linkedSegments, options));
  }

  // 2. Tronçons / Pipes
  const nodeMap = new Map(document.model.nodes.map((n) => [n.id, n]));
  for (const segment of document.model.segments) {
    const fromNode = nodeMap.get(segment.fromNodeId);
    const toNode = nodeMap.get(segment.toNodeId);
    entities.push(segmentToUniversalEntity(segment, fromNode, toNode, options));

    // Fittings imbriqués dans le segment
    if (Array.isArray(segment.fittings)) {
      for (const fitting of segment.fittings) {
        entities.push(fittingToUniversalEntity(fitting, segment, options));
      }
    }
  }

  // 3. Supports MSS SP-58
  const segmentMap = new Map(document.model.segments.map((s) => [s.id, s]));
  for (const support of document.model.supports) {
    const parentSeg = segmentMap.get(support.segmentId);
    entities.push(supportToUniversalEntity(support, parentSeg, options));
  }

  // 4. Entités CAO 2D
  for (const cad of document.model.cad2d.entities) {
    entities.push(cad2dToUniversalEntity(cad, options));
  }

  return Object.freeze(entities);
}

/**
 * ARCH-04: Met à jour un document à partir d'une entité universelle modifiée de manière atomique.
 */
export function applyUniversalEntityToDocument(
  updatedEntity: PdiUniversalEntity,
  document: PdiDocument
): PdiDocument {
  const currentState: UniversalGraphState = {
    nodes: document.model.nodes.map((n) => ({ ...n })),
    segments: document.model.segments.map((s) => ({ ...s })),
    cad2dEntities: document.model.cad2d.entities.map((e) => ({ ...e })),
    supports: document.model.supports.map((sup) => ({ ...sup })),
  };

  const nextState = applyUniversalEntityToGraph(updatedEntity, currentState);
  const now = new Date().toISOString();

  return createDocument({
    documentId: document.documentId,
    projectId: document.projectId,
    kind: document.kind,
    title: document.title,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: now,
    model: {
      lines: document.model.lines,
      nodes: nextState.nodes,
      segments: nextState.segments,
      dimensions: document.model.dimensions,
      supports: nextState.supports,
      spools: document.model.spools,
      welds: document.model.welds,
      cad2d: {
        layers: document.model.cad2d.layers,
        entities: nextState.cad2dEntities,
      },
    },
  });
}

/**
 * Extrait l'état géométrique pour l'éditeur isométrique sans muter le document.
 */
export function extractEditorGraphFromDocument(document: PdiDocument): UniversalGraphState {
  return {
    nodes: document.model.nodes.map((n) => ({ ...n })),
    segments: document.model.segments.map((s) => ({ ...s })),
    cad2dEntities: document.model.cad2d.entities.map((e) => ({ ...e })),
    supports: document.model.supports.map((sup) => ({ ...sup })),
  };
}

/**
 * Met à jour le document à partir du graphe de l'éditeur sans muter le document précédent.
 */
export function updateDocumentFromEditorGraph(
  document: PdiDocument,
  graph: Partial<PdiDocumentModel>,
  updatedAt?: string
): PdiDocument {
  const now = updatedAt || new Date().toISOString();
  return createDocument({
    documentId: document.documentId,
    projectId: document.projectId,
    kind: document.kind,
    title: document.title,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: now,
    model: {
      lines: graph.lines || document.model.lines,
      nodes: graph.nodes || document.model.nodes,
      segments: graph.segments || document.model.segments,
      dimensions: graph.dimensions || document.model.dimensions,
      supports: graph.supports || document.model.supports,
      spools: graph.spools || document.model.spools,
      welds: graph.welds || document.model.welds,
      cad2d: graph.cad2d || document.model.cad2d,
    },
  });
}

/**
 * ARCH-04 §14 — Option B : Adapter explicite pour le module Project Management historique.
 * Permet de rattacher un projet de suivi administratif/foncier à un PdiProjectContext sans inventer de données.
 */
export function adaptLegacyAdminProjectToProjectContext(
  legacyProject: LegacyAdminProject,
  options?: { workspaceId?: string; activeDocumentId?: string }
): PdiProjectContext {
  const now = new Date().toISOString();
  const projectId = isValidStableId(legacyProject.id)
    ? legacyProject.id.trim()
    : generateScopedId("proj_legacy");
  const projectName = legacyProject.name || "Projet Canalisation Industrielle";

  return createProjectContext({
    projectId,
    projectName,
    ownerUid: legacyProject.createdByUid || legacyProject.chefDeProjetUid || "",
    wilaya: legacyProject.identity?.wilaya || "",
    pressDesign: parseOptionalNumeric(legacyProject.identity?.caracteristiques?.pression),
    unitSystem: "metric",
    createdAt: typeof legacyProject.createdAt === "string" ? legacyProject.createdAt : now,
    updatedAt: typeof legacyProject.updatedAt === "string" ? legacyProject.updatedAt : now,
    legacyAdminProjectId: legacyProject.id,
    workspaceId: options?.workspaceId,
    activeDocumentId: options?.activeDocumentId,
  });
}

/**
 * Produit un instantané PdiWorkspaceState pour le BroadcastChannel sans transformer le workspace en autorité métier.
 */
export function toWorkspaceChannelState(
  workspace: PdiWorkspaceContext,
  document: PdiDocument,
  project: PdiProjectContext,
  activeEntity?: PdiUniversalEntity | null
): PdiWorkspaceState {
  return {
    workspaceId: workspace.workspaceId,
    projectId: project.projectId,
    activeDocumentId: document.documentId,
    mode: workspace.mode,
    profile: workspace.profile,
    screen1View: workspace.screen1View,
    screen2View: workspace.screen2View,
    selection: { ...workspace.selection },
    activeEntity: activeEntity || null,
    modelSnapshot: {
      projectName: project.projectName,
      projectId: project.projectId,
      documentId: document.documentId,
      unitSystem: project.metadata.unitSystem,
      nodes: document.model.nodes.map((n) => ({ ...n })),
      segments: document.model.segments.map((s) => ({ ...s })),
      supports: document.model.supports.map((sup) => ({ ...sup })),
      welds: document.model.welds.map((w) => ({ ...w })),
      spools: document.model.spools.map((sp) => ({ ...sp })),
      bomRows: [],
      revision: project.metadata.revision,
      updatedAt: document.updatedAt,
    },
    displayPreferences: { ...workspace.displayPreferences },
    secondaryConnected: false,
    lastUpdateTimestamp: Date.now(),
  };
}

/**
 * Valide les invariants structurels d'un ProjectContext.
 */
export function validateProjectContext(project: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!project || typeof project !== "object") {
    return { valid: false, errors: ["ProjectContext must be a non-null object."] };
  }
  const raw = project as Partial<PdiProjectContext>;
  if (!isValidStableId(raw.projectId)) {
    errors.push("projectId is required and must be a non-empty string.");
  }
  if (typeof raw.projectName !== "string" || raw.projectName.trim().length === 0) {
    errors.push("projectName is required.");
  }
  if (!raw.metadata || typeof raw.metadata !== "object") {
    errors.push("metadata is required.");
  }
  if (!isValidStableId(raw.workspaceId)) {
    errors.push("workspaceId is required.");
  }
  if (!isValidStableId(raw.activeDocumentId)) {
    errors.push("activeDocumentId is required.");
  }
  if (!Array.isArray(raw.documents) || raw.documents.length === 0) {
    errors.push("documents must contain at least one document reference.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide les invariants structurels d'un PdiDocument.
 */
export function validateDocument(document: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!document || typeof document !== "object") {
    return { valid: false, errors: ["PdiDocument must be a non-null object."] };
  }
  const raw = document as Partial<PdiDocument>;
  if (!isValidStableId(raw.documentId)) {
    errors.push("documentId is required.");
  }
  if (!isValidStableId(raw.projectId)) {
    errors.push("projectId is required.");
  }
  if (!raw.kind || typeof raw.kind !== "string") {
    errors.push("kind is required.");
  }
  if (!raw.model || typeof raw.model !== "object") {
    errors.push("model is required.");
  } else {
    if (!Array.isArray(raw.model.nodes)) errors.push("model.nodes must be an array.");
    if (!Array.isArray(raw.model.segments)) errors.push("model.segments must be an array.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide les invariants structurels d'un PdiWorkspaceContext.
 */
export function validateWorkspaceContext(workspace: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!workspace || typeof workspace !== "object") {
    return { valid: false, errors: ["PdiWorkspaceContext must be a non-null object."] };
  }
  const raw = workspace as Partial<PdiWorkspaceContext>;
  if (!isValidStableId(raw.workspaceId)) {
    errors.push("workspaceId is required.");
  }
  if (!isValidStableId(raw.projectId)) {
    errors.push("projectId is required.");
  }
  if (!isValidStableId(raw.activeDocumentId)) {
    errors.push("activeDocumentId is required.");
  }
  if (!raw.selection || typeof raw.selection !== "object") {
    errors.push("selection state is required.");
  }
  if (!raw.editorSettings || typeof raw.editorSettings !== "object") {
    errors.push("editorSettings is required.");
  }

  return { valid: errors.length === 0, errors };
}
