/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * TECHNICAL WORKFLOW ADAPTER: P&ID → PIPING → ISOMÉTRIQUE
 * Reference: ARCH-05 / ARCH-05-FIX-01 (Removal of Fabricated Technical Values)
 *
 * Passerelle fonctionnelle immuable et déterministe assurant les transitions
 * et les flux de données entre les 4 niveaux :
 * - Niveau 1: PROCESS (P&ID)
 * - Niveau 2: PIPING DESIGN
 * - Niveau 3: GEOMETRY & ISOMETRIC
 * - Niveau 4: NORMATIVE REFERENCES
 *
 * RÈGLES ABSOLUES ARCH-05 / FIX-01 :
 * - ABSENCE DE DONNÉE TECHNIQUE = ABSENCE DE DONNÉE (undefined).
 * - Ne jamais remplacer une absence par 0, "", "N/A" ou une valeur arbitraire.
 * - Pression opératoire (Process) ≠ Pression de calcul (Piping Design) sans déclaration explicite.
 * - DN seul ne crée ni NPS, ni OD, ni Schedule, ni WallThickness.
 * - Le Workflow n'auto-certifie jamais la conformité (statut normatif réservé à NORM-01..14).
 * - Immutabilité totale des objets sources.
 * - Identifiants déterministes sans Math.random() ni Date.now().
 */

import type {
  PdiTechnicalWorkflowContext,
  PdiTechnicalWorkflowState,
  PdiProcessInputReference,
  PdiProcessLineInput,
  PdiPipingDesignReference,
  PdiPipingLineDesign,
  PdiIsometricDocumentReference,
  PdiWorkflowTransition,
} from "./pdiTechnicalWorkflow";
import type {
  PdiDocument,
  PdiDocumentModel,
  PdiProjectNormativeRefs,
} from "./pdiProjectContext";
import type { PipingLine } from "../isometric/types/isoGraphTypes";
import { isValidStableId, parseOptionalNumeric } from "./pdiProjectAdapter";
import { deriveUniversalEntitiesFromDocument } from "./pdiProjectAdapter";
import type { PdiUniversalEntity } from "./pdiUniversalEntity";

/**
 * Générateur d'identifiant déterministe et reproductible (ARCH-05 §6 / FIX-03).
 * Requiert obligatoirement un seed explicite et valide. Aucun usage de _default, Math.random() ou Date.now().
 */
export function generateWorkflowScopedId(prefix: string, seed: string): string {
  if (typeof seed === "string" && seed.trim().length > 0) {
    const cleanSeed = seed.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${prefix}_${cleanSeed}`;
  }
  throw new Error(`[ARCH-05] Explicit and non-empty seed is required to generate scoped ID with prefix '${prefix}'.`);
}

export interface CreateWorkflowParams {
  readonly workflowId?: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly initialState?: PdiTechnicalWorkflowState;
  readonly isRestoration?: boolean;
  readonly processInput?: PdiProcessInputReference;
  readonly pipingDesign?: PdiPipingDesignReference;
  readonly isometricDocument?: PdiIsometricDocumentReference;
  readonly universalEntityIds?: readonly string[];
  readonly normativeRefs?: PdiProjectNormativeRefs;
  readonly actorUid?: string;
  readonly notes?: string;
}

/**
 * Crée un contexte de workflow technique unifié (ARCH-05 §8 & §14).
 * Empêche le saut arbitraire d'états lors d'une initialisation standard.
 */
export function createTechnicalWorkflowContext(params: CreateWorkflowParams): PdiTechnicalWorkflowContext {
  if (!isValidStableId(params.projectId)) {
    throw new Error("[ARCH-05] Technical workflow requires a valid projectId.");
  }
  if (!isValidStableId(params.documentId)) {
    throw new Error("[ARCH-05] Technical workflow requires a valid documentId.");
  }

  const now = new Date().toISOString();
  const workflowId = isValidStableId(params.workflowId)
    ? params.workflowId.trim()
    : generateWorkflowScopedId("wf", `${params.projectId.trim()}_${params.documentId.trim()}`);

  const requestedState = params.initialState || "DRAFT";

  // ARCH-05 §7: Vérification de l'état initial pour éviter le contournement arbitraire
  const standardInitialStates: PdiTechnicalWorkflowState[] = [
    "DRAFT",
    "PROCESS_DEFINED",
    "PIPING_DESIGN_STARTED",
  ];

  if (!params.isRestoration && !standardInitialStates.includes(requestedState)) {
    throw new Error(
      `[ARCH-05] Cannot initialize new workflow directly in state '${requestedState}'. Use standard starting states or pass isRestoration: true for imported documents.`
    );
  }

  const trigger = params.isRestoration ? "WORKFLOW_RESTORED" : "WORKFLOW_INITIALIZATION";

  const initialTransition: PdiWorkflowTransition = Object.freeze({
    fromState: "DRAFT",
    toState: requestedState,
    timestamp: now,
    trigger,
    actorUid: params.actorUid,
    notes: params.notes || (params.isRestoration ? "Restored from existing document snapshot" : "Initial workflow creation"),
  });

  return Object.freeze({
    workflowId,
    projectId: params.projectId.trim(),
    documentId: params.documentId.trim(),
    state: requestedState,
    processInput: params.processInput ? Object.freeze({ ...params.processInput }) : undefined,
    pipingDesign: params.pipingDesign ? Object.freeze({ ...params.pipingDesign }) : undefined,
    isometricDocument: params.isometricDocument ? Object.freeze({ ...params.isometricDocument }) : undefined,
    universalEntityIds: Object.freeze(params.universalEntityIds ? [...params.universalEntityIds] : []),
    normativeRefs: params.normativeRefs ? Object.freeze({ ...params.normativeRefs }) : undefined,
    transitions: Object.freeze([initialTransition]),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Matrice ordonnée des transitions d'états de workflow autorisées.
 */
const ALLOWED_WORKFLOW_TRANSITIONS: Readonly<Record<PdiTechnicalWorkflowState, readonly PdiTechnicalWorkflowState[]>> = {
  DRAFT: ["PROCESS_DEFINED", "PIPING_DESIGN_STARTED"],
  PROCESS_DEFINED: ["PIPING_DESIGN_STARTED", "DRAFT"],
  PIPING_DESIGN_STARTED: ["PIPING_DESIGN_COMPLETE", "DRAFT"],
  PIPING_DESIGN_COMPLETE: ["ISO_GENERATED", "PIPING_DESIGN_STARTED"],
  ISO_GENERATED: ["NORMATIVE_REVIEW", "PIPING_DESIGN_COMPLETE"],
  NORMATIVE_REVIEW: ["READY_FOR_DELIVERABLE", "PIPING_DESIGN_COMPLETE", "ISO_GENERATED"],
  READY_FOR_DELIVERABLE: ["DRAFT", "NORMATIVE_REVIEW"],
};

/**
 * Valide si une transition d'état de workflow est permise.
 */
export function isValidWorkflowTransition(
  fromState: PdiTechnicalWorkflowState,
  toState: PdiTechnicalWorkflowState
): boolean {
  if (fromState === toState) return true;
  const allowed = ALLOWED_WORKFLOW_TRANSITIONS[fromState];
  return Boolean(allowed && allowed.includes(toState));
}

/**
 * Exécute une transition d'état de workflow immuable avec traçabilité.
 */
export function transitionTechnicalWorkflow(
  workflow: PdiTechnicalWorkflowContext,
  targetState: PdiTechnicalWorkflowState,
  options?: {
    readonly trigger?: string;
    readonly actorUid?: string;
    readonly notes?: string;
    readonly force?: boolean;
  }
): PdiTechnicalWorkflowContext {
  if (!options?.force && !isValidWorkflowTransition(workflow.state, targetState)) {
    throw new Error(`[ARCH-05] Invalid workflow transition from ${workflow.state} to ${targetState}.`);
  }

  const now = new Date().toISOString();
  const transition: PdiWorkflowTransition = Object.freeze({
    fromState: workflow.state,
    toState: targetState,
    timestamp: now,
    trigger: options?.trigger || "STATE_TRANSITION",
    actorUid: options?.actorUid,
    notes: options?.notes,
  });

  return Object.freeze({
    ...workflow,
    state: targetState,
    transitions: Object.freeze([...workflow.transitions, transition]),
    updatedAt: now,
  });
}

export interface AdaptProcessToPipingOptions {
  readonly designId?: string;
  readonly authorUid?: string;
  readonly defaultDesignCodeId?: string;
  readonly defaultPipingSpecId?: string;
}

/**
 * Niveau 1 (Process) → Niveau 2 (Piping Design)
 * ARCH-05 §10 : Mappe les données de ligne procédé vers la conception tuyauterie sans inventer de données.
 * 
 * RÈGLE CRITIQUE (FIX-01) :
 * - `operatingPressureBar` n'est JAMAIS copié silencieusement en `designPressureBar`.
 * - `operatingTemperatureC` n'est JAMAIS copié silencieusement en `designTemperatureC`.
 * - Si `designPressureBar` est explicitement présent dans les conditions procédé, il est transporté.
 * - Le matériau n'est JAMAIS déduit du fluide.
 * - Aucune valeur absente n'est remplacée par 0 ou "".
 */
export function adaptProcessInputToPipingDesign(
  processInput: PdiProcessInputReference,
  options?: AdaptProcessToPipingOptions
): PdiPipingDesignReference {
  const now = new Date().toISOString();
  const designId = isValidStableId(options?.designId)
    ? options!.designId.trim()
    : generateWorkflowScopedId("des", processInput.sourceId);

  const pipingLines: PdiPipingLineDesign[] = processInput.lines.map((pLine) => {
    if (!isValidStableId(pLine.processLineId)) {
      throw new Error("[ARCH-05] Each process line must provide a valid, non-empty processLineId.");
    }
    const pipingLineId = generateWorkflowScopedId("pipe_line", pLine.processLineId);
    
    // Transport strict sans fabrication de données
    const designPressure = parseOptionalNumeric(pLine.conditions?.designPressureBar);
    const designTemperature = parseOptionalNumeric(pLine.conditions?.designTemperatureC);
    const nominalDiameter = parseOptionalNumeric(pLine.nominalDiameterMm);

    const service = typeof pLine.service === "string" && pLine.service.trim().length > 0
      ? pLine.service.trim()
      : undefined;

    const pipingSpecId = typeof pLine.pmsReference === "string" && pLine.pmsReference.trim().length > 0
      ? pLine.pmsReference.trim()
      : typeof options?.defaultPipingSpecId === "string" && options.defaultPipingSpecId.trim().length > 0
      ? options.defaultPipingSpecId.trim()
      : undefined;

    const designCodeId = typeof options?.defaultDesignCodeId === "string" && options.defaultDesignCodeId.trim().length > 0
      ? options.defaultDesignCodeId.trim()
      : undefined;

    const tag = typeof pLine.lineNumber === "string" && pLine.lineNumber.trim().length > 0
      ? pLine.lineNumber.trim()
      : undefined;

    return Object.freeze({
      pipingLineId,
      tag,
      service,
      sourceProcessLineId: pLine.processLineId,
      designPressureBar: designPressure,
      designTemperatureC: designTemperature,
      nominalDiameterMm: nominalDiameter,
      nominalDiameterInch: undefined, // ARCH-03-FIX-02 : Jamais de conversion automatique DN -> NPS
      pipingSpecId,
      materialGrade: undefined, // Jamais déduit silencieusement
      designCodeId,
      components: Object.freeze([]),
    });
  });

  return Object.freeze({
    designId,
    authorUid: options?.authorUid,
    lines: Object.freeze(pipingLines),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Niveau 2 (Piping Design) → Niveau 3 (Isometric Document Model)
 * ARCH-05 §11 & FIX-02 : Synchronise les lignes de conception tuyauterie dans le modèle de document isométrique
 * sans altérer les géométries existantes, SANS fabriquer de données (0, "", LINE_N, etc.) et sans type casts.
 */
export function adaptPipingDesignToIsometricModel(
  pipingDesign: PdiPipingDesignReference,
  baseModel?: Partial<PdiDocumentModel>
): PdiDocumentModel {
  const existingLines = baseModel?.lines ? [...baseModel.lines] : [];
  const lineMap = new Map<string, PipingLine>();

  existingLines.forEach((l) => lineMap.set(l.id, { ...l }));

  pipingDesign.lines.forEach((pLine) => {
    const existing = lineMap.get(pLine.pipingLineId);

    const safeService = typeof pLine.service === "string" && pLine.service.trim().length > 0
      ? pLine.service.trim()
      : undefined;

    const safeMaterial = typeof pLine.materialGrade === "string" && pLine.materialGrade.trim().length > 0
      ? pLine.materialGrade.trim()
      : undefined;

    const safePressureClass = typeof pLine.pipingSpecId === "string" && pLine.pipingSpecId.trim().length > 0
      ? pLine.pipingSpecId.trim()
      : undefined;

    const safeNps = typeof pLine.nominalDiameterInch === "string" && pLine.nominalDiameterInch.trim().length > 0
      ? pLine.nominalDiameterInch.trim()
      : undefined;

    const safeDn = parseOptionalNumeric(pLine.nominalDiameterMm);
    const safeDesignPressure = parseOptionalNumeric(pLine.designPressureBar);
    const safeDesignTemperature = parseOptionalNumeric(pLine.designTemperatureC);

    if (existing) {
      lineMap.set(pLine.pipingLineId, {
        ...existing,
        lineNumber: pLine.tag !== undefined ? pLine.tag : existing.lineNumber,
        service: safeService !== undefined ? safeService : existing.service,
        material: safeMaterial !== undefined ? safeMaterial : existing.material,
        dn: safeDn !== undefined ? safeDn : existing.dn,
        nps: safeNps !== undefined ? safeNps : existing.nps,
        pressureClass: safePressureClass !== undefined ? safePressureClass : existing.pressureClass,
        designPressure: safeDesignPressure !== undefined ? safeDesignPressure : existing.designPressure,
        designTemperature: safeDesignTemperature !== undefined ? safeDesignTemperature : existing.designTemperature,
      });
    } else {
      lineMap.set(pLine.pipingLineId, {
        id: pLine.pipingLineId,
        lineNumber: pLine.tag,
        service: safeService,
        dn: safeDn,
        nps: safeNps,
        material: safeMaterial,
        pressureClass: safePressureClass,
        designPressure: safeDesignPressure,
        designTemperature: safeDesignTemperature,
        color: undefined,
      });
    }
  });

  return Object.freeze({
    lines: Object.freeze(Array.from(lineMap.values())),
    nodes: Object.freeze(baseModel?.nodes ? [...baseModel.nodes] : []),
    segments: Object.freeze(baseModel?.segments ? [...baseModel.segments] : []),
    dimensions: Object.freeze(baseModel?.dimensions ? [...baseModel.dimensions] : []),
    supports: Object.freeze(baseModel?.supports ? [...baseModel.supports] : []),
    spools: Object.freeze(baseModel?.spools ? [...baseModel.spools] : []),
    welds: Object.freeze(baseModel?.welds ? [...baseModel.welds] : []),
    cad2d: Object.freeze(
      baseModel?.cad2d
        ? {
            layers: Object.freeze([...baseModel.cad2d.layers]),
            entities: Object.freeze([...baseModel.cad2d.entities]),
          }
        : {
            layers: Object.freeze([
              { id: "axes_tuyauterie", name: "Axes tuyauterie", color: "#9CA3AF", visible: true, locked: false },
              { id: "annotations", name: "Annotations", color: "#9CA3AF", visible: true, locked: false },
              { id: "import_cad", name: "Import CAD / fond plan", color: "#888888", visible: true, locked: false },
            ]),
            entities: Object.freeze([]),
          }
    ),
  });
}

/**
 * Niveau 3 (Isometric Document) → Référence Workflow Isométrique
 */
export function adaptIsometricDocumentToWorkflowReference(
  document: PdiDocument
): PdiIsometricDocumentReference {
  const lineIds = document.model.lines.map((l) => l.id);
  const nodeCount = document.model.nodes.length;
  const segmentCount = document.model.segments.length;
  const hasCad2dLayers = document.model.cad2d.layers.length > 0;
  const has3dCoordinates = document.model.nodes.some(
    (n) => n.x !== 0 || n.y !== 0 || (n.z !== undefined && n.z !== 0)
  );

  return Object.freeze({
    documentId: document.documentId,
    projectId: document.projectId,
    revision: document.revision || "A",
    lineIds: Object.freeze(lineIds),
    nodeCount,
    segmentCount,
    hasCad2dLayers,
    has3dCoordinates,
    generatedAt: document.updatedAt || new Date().toISOString(),
  });
}

/**
 * Niveau 3 (Document) → PdiUniversalEntity[] (Universal Business Model)
 * Intègre la dérivation ARCH-03 sans réplication ni calcul implicite.
 */
export function deriveUniversalEntitiesFromWorkflow(
  workflow: PdiTechnicalWorkflowContext,
  document: PdiDocument
): readonly PdiUniversalEntity[] {
  if (workflow.documentId !== document.documentId) {
    throw new Error(`[ARCH-05] Document ${document.documentId} does not match workflow document ${workflow.documentId}.`);
  }
  return deriveUniversalEntitiesFromDocument(document);
}

/**
 * Validation structurelle d'un PdiTechnicalWorkflowContext.
 */
export function validateTechnicalWorkflowContext(workflow: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!workflow || typeof workflow !== "object") {
    return { valid: false, errors: ["Workflow context must be a non-null object."] };
  }

  const wf = workflow as Record<string, any>;
  if (!isValidStableId(wf.workflowId)) {
    errors.push("Missing or empty workflowId.");
  }
  if (!isValidStableId(wf.projectId)) {
    errors.push("Missing or empty projectId.");
  }
  if (!isValidStableId(wf.documentId)) {
    errors.push("Missing or empty documentId.");
  }

  const validStates: PdiTechnicalWorkflowState[] = [
    "DRAFT",
    "PROCESS_DEFINED",
    "PIPING_DESIGN_STARTED",
    "PIPING_DESIGN_COMPLETE",
    "ISO_GENERATED",
    "NORMATIVE_REVIEW",
    "READY_FOR_DELIVERABLE",
  ];

  if (!validStates.includes(wf.state)) {
    errors.push(`Invalid workflow state: ${wf.state}.`);
  }

  if (!Array.isArray(wf.transitions)) {
    errors.push("Workflow transitions must be an array.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
