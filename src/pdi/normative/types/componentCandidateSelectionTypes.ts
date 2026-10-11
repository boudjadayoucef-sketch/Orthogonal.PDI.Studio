/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE SELECTION TYPES
 * Reference: COMPONENT-02 (Deterministic Component Candidate Selection)
 * 
 * Définitions de types pour la sélection déterministe de candidats composants
 * basée exclusivement sur COMPONENT-01 (ComponentSelectionEngine).
 */

import type {
  ComponentCandidate,
  ComponentSelectionContext,
  ComponentType,
} from "./componentSelectionTypes";

/**
 * Entrée pour la sélection d'un candidat composant parmi un ensemble.
 */
export interface ComponentCandidateSelectionInput {
  readonly specificationId: string;
  readonly componentType: ComponentType;
  readonly candidates: readonly ComponentCandidate[];
  readonly context: ComponentSelectionContext;
}

/**
 * Statuts possibles pour le résultat global de la sélection de candidats.
 */
export type ComponentCandidateSelectionStatus =
  | "SELECTED"
  | "NO_ELIGIBLE_CANDIDATE"
  | "UNVERIFIED_CANDIDATES"
  | "INVALID";

/**
 * Trace d'évaluation détaillée pour un candidat individuel.
 */
export interface ComponentCandidateSelectionTrace {
  readonly candidateId: string;
  readonly status: "ELIGIBLE" | "INELIGIBLE" | "UNVERIFIED" | "INVALID";
  readonly matchedRuleIds: readonly string[];
  readonly compatibilityRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly message: string;
}

/**
 * Résultat déterministe de la sélection de candidats composants.
 */
export interface ComponentCandidateSelectionResult {
  readonly status: ComponentCandidateSelectionStatus;
  readonly specificationId: string;
  readonly selectedCandidateId?: string;
  readonly evaluatedCandidateIds: readonly string[];
  readonly eligibleCandidateIds: readonly string[];
  readonly ineligibleCandidateIds: readonly string[];
  readonly unverifiedCandidateIds: readonly string[];
  readonly invalidCandidateIds: readonly string[];
  readonly matchedRuleIds: readonly string[];
  readonly compatibilityRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly traceByCandidate: readonly ComponentCandidateSelectionTrace[];
  readonly message: string;
}

/**
 * Interface du moteur de sélection de candidats composants (COMPONENT-02).
 */
export interface IComponentCandidateSelectionEngine {
  selectCandidate(
    input: ComponentCandidateSelectionInput
  ): ComponentCandidateSelectionResult;
}
