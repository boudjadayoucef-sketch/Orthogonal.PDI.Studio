/**
 * PDI NORMATIVE ENGINE — COMPONENT RESOLUTION TYPES
 * Reference: COMPONENT-04 (Component Resolution Orchestrator)
 * 
 * Types pour l'orchestrateur de résolution de composant, reliant la spécification de tuyauterie,
 * le registre de candidats et le résolveur de candidats (COMPONENT-03).
 */

import type {
  ComponentSelectionContext,
  ComponentType,
} from "./componentSelectionTypes";

/**
 * Demande formelle de résolution d'un composant pour une ligne ou une spécification.
 */
export interface ComponentResolutionRequest {
  readonly specificationId: string;
  readonly context: ComponentSelectionContext;
}

/**
 * Statuts possibles pour le résultat d'orchestration de résolution de composant.
 */
export type ComponentResolutionStatus =
  | "RESOLVED"
  | "NO_CANDIDATE"
  | "UNVERIFIED"
  | "AMBIGUOUS"
  | "INVALID";

/**
 * Résultat déterministe, auditable et traçable de la résolution d'un composant.
 */
export interface ComponentResolutionResult {
  readonly status: ComponentResolutionStatus;

  readonly specificationId: string;
  readonly componentType: ComponentType;

  readonly resolvedCandidateId?: string;

  readonly evaluatedCandidateIds: readonly string[];
  readonly eligibleCandidateIds: readonly string[];
  readonly unverifiedCandidateIds: readonly string[];
  readonly invalidCandidateIds: readonly string[];

  readonly matchedRuleIds: readonly string[];
  readonly compatibilityRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];

  readonly message: string;
}

/**
 * Interface du moteur d'orchestration de résolution de composant (COMPONENT-04).
 */
export interface IComponentResolutionEngine {
  resolve(request: ComponentResolutionRequest): ComponentResolutionResult;
}
