/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * TECHNICAL WORKFLOW CONTRACT: P&ID → PIPING → ISOMÉTRIQUE
 * Reference: ARCH-05 (Technical Workflow Architecture)
 *
 * ARCHITECTURE CIBLE & SÉPARATION DES RESPONSABILITÉS EN 4 NIVEAUX :
 * 
 * 1. NIVEAU 1 — PROCESS (Besoin procédé P&ID)
 *    - Décrit le fluide, les conditions de service/opérationnelles, les tenants et aboutissants.
 *    - RÈGLE : Ne devient JAMAIS automatiquement des données de calcul ou de dimensionnement tuyauterie.
 * 
 * 2. NIVEAU 2 — PIPING DESIGN (Conception mécanique tuyauterie)
 *    - Ligne de tuyauterie, conditions de calcul (design conditions), spécifications matière et classes de pression.
 *    - RÈGLE : Ne copie pas silencieusement les données procédé sans assignation explicite.
 * 
 * 3. NIVEAU 3 — GEOMETRY & ROUTING (Graphe isométrique, 2D, 3D)
 *    - Graphe topologique (IsoNode, IsoSegment, supports, soudures, spools, cartouche).
 *    - RÈGLE : La géométrie est une représentation/délivrable, JAMAIS l'autorité normative.
 * 
 * 4. NIVEAU 4 — NORMATIVE & COMPLIANCE (Moteur normatif NORM-01..14)
 *    - Seule autorité normative pour la vérification, qualification et compatibilité.
 *    - RÈGLE : Le workflow RÉFÉRENCE les règles normatives mais ne s'auto-certifie JAMAIS.
 * 
 * RÈGLE FONDAMENTALE : ABSENCE DE DONNÉE TECHNIQUE = ABSENCE DE DONNÉE (undefined).
 */

import type {
  PdiProjectId,
  PdiDocumentId,
  PdiEntityId,
  PdiProjectNormativeRefs,
} from "./pdiProjectContext";

/**
 * États séquentiels du cycle de vie d'un workflow technique d'ingénierie (ARCH-05 §14).
 * IMPORTANT : Ces états sont des étapes de workflow et ne doivent JAMAIS être confondus
 * avec les statuts normatifs (COMPATIBLE, QUALIFIED, VERIFIED, CALCULATED).
 */
export type PdiTechnicalWorkflowState =
  | "DRAFT"
  | "PROCESS_DEFINED"
  | "PIPING_DESIGN_STARTED"
  | "PIPING_DESIGN_COMPLETE"
  | "ISO_GENERATED"
  | "NORMATIVE_REVIEW"
  | "READY_FOR_DELIVERABLE";

/**
 * Type de source procédé initiale.
 */
export type PdiProcessSourceType = "PID" | "PROCESS_LINE" | "PROCESS_DATA" | "MANUAL_INPUT";

/**
 * NIVEAU 1 — Données d'entrée procédé (P&ID).
 * Représente le besoin procédé sans hypothèse de conception tuyauterie.
 */
export interface PdiProcessConditions {
  readonly operatingPressureBar?: number;
  readonly operatingTemperatureC?: number;
  readonly designPressureBar?: number;
  readonly designTemperatureC?: number;
  readonly flowRateM3h?: number;
  readonly fluidPhase?: "gas" | "liquid" | "two_phase" | "steam";
}

export interface PdiProcessLineInput {
  readonly processLineId: string;
  readonly lineNumber?: string;
  readonly service?: string;
  readonly fluid?: string;
  readonly fromEquipment?: string;
  readonly toEquipment?: string;
  readonly conditions?: PdiProcessConditions;
  readonly nominalDiameterMm?: number;
  readonly pmsReference?: string;
  readonly notes?: string;
}

export interface PdiProcessInputReference {
  readonly sourceId: string;
  readonly sourceType: PdiProcessSourceType;
  readonly documentNumber?: string;
  readonly revision?: string;
  readonly lines: readonly PdiProcessLineInput[];
  readonly importedAt?: string;
}

/**
 * NIVEAU 2 — Données de conception tuyauterie (Piping Design).
 */
export interface PdiPipingComponentDesign {
  readonly componentId: string;
  readonly componentType: string;
  readonly nominalSizeMm?: number;
  readonly ratingClass?: string;
  readonly materialGrade?: string;
  readonly standardId?: string;
  readonly sequenceIndex: number;
}

export interface PdiPipingLineDesign {
  readonly pipingLineId: string;
  readonly tag?: string;
  readonly service?: string;
  readonly sourceProcessLineId?: string;
  readonly designPressureBar?: number;
  readonly designTemperatureC?: number;
  readonly nominalDiameterMm?: number;
  readonly nominalDiameterInch?: string;
  readonly pipingSpecId?: string;
  readonly materialGrade?: string;
  readonly designCodeId?: string;
  readonly components: readonly PdiPipingComponentDesign[];
}

export interface PdiPipingDesignReference {
  readonly designId: string;
  readonly authorUid?: string;
  readonly lines: readonly PdiPipingLineDesign[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * NIVEAU 3 — Référence au document isométrique / géométrique.
 */
export interface PdiIsometricDocumentReference {
  readonly documentId: PdiDocumentId;
  readonly projectId: PdiProjectId;
  readonly revision: string;
  readonly lineIds: readonly string[];
  readonly nodeCount: number;
  readonly segmentCount: number;
  readonly hasCad2dLayers: boolean;
  readonly has3dCoordinates: boolean;
  readonly generatedAt: string;
}

/**
 * Enregistrement de transition d'état de workflow pour traçabilité complète.
 */
export interface PdiWorkflowTransition {
  readonly fromState: PdiTechnicalWorkflowState;
  readonly toState: PdiTechnicalWorkflowState;
  readonly timestamp: string;
  readonly trigger: string;
  readonly actorUid?: string;
  readonly notes?: string;
}

/**
 * Contexte de Workflow Technique Unifié (ARCH-05 §8).
 * Coordonne les niveaux Process, Piping, Isométrique et Normatif sans les fusionner.
 */
export interface PdiTechnicalWorkflowContext {
  readonly workflowId: string;
  readonly projectId: PdiProjectId;
  readonly documentId: PdiDocumentId;
  readonly state: PdiTechnicalWorkflowState;
  readonly processInput?: PdiProcessInputReference;
  readonly pipingDesign?: PdiPipingDesignReference;
  readonly isometricDocument?: PdiIsometricDocumentReference;
  readonly universalEntityIds: readonly PdiEntityId[];
  readonly normativeRefs?: PdiProjectNormativeRefs;
  readonly transitions: readonly PdiWorkflowTransition[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
