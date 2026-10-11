/**
 * PDI NORMATIVE ENGINE — COMPONENT SELECTION TYPES
 * Reference: COMPONENT-01 (Component Selection Engine)
 * 
 * Définitions de types pour la couche d'infrastructure de sélection des composants
 * basée sur Piping Specification (SPEC-01), Compatibilité Normative (NORM-13) et Evidence (NORM-09).
 */

import type { IPipingSpecResolver } from "./pipingSpecResolverTypes";

/**
 * Interface alias pour compatibilité d'injection.
 */
export type INormativePipingSpecResolver = IPipingSpecResolver;

/**
 * Familles de composants supportées.
 */
export type ComponentType = "PIPE" | "FITTING" | "FLANGE" | "VALVE";

/**
 * Candidat composant à évaluer.
 */
export interface ComponentCandidate {
  readonly candidateId: string;
  readonly componentType: ComponentType;
  readonly productStandardId?: string;
  readonly dimensionalStandardId?: string;
  readonly fittingType?: string;
  readonly valveType?: string;
  readonly connectionType?: string;
  readonly nominalSize?: string;
  readonly schedule?: string;
  readonly ratingSystem?: string;
  readonly ratingValue?: string;
  readonly materialId?: string;
  readonly materialForm?: string;
  readonly evidenceIds?: readonly string[];
  readonly sourceReference?: string;
}

/**
 * Contexte de sélection imposé par le besoin d'ingénierie ou la ligne.
 */
export interface ComponentSelectionContext {
  readonly specificationId: string;
  readonly componentType: ComponentType;
  readonly productStandardId?: string;
  readonly dimensionalStandardId?: string;
  readonly fittingType?: string;
  readonly valveType?: string;
  readonly connectionType?: string;
  readonly nominalSize?: string;
  readonly schedule?: string;
  readonly ratingSystem?: string;
  readonly ratingValue?: string;
  readonly materialId?: string;
  readonly materialForm?: string;
}

/**
 * Statuts d'admissibilité d'un composant candidat.
 */
export type ComponentSelectionStatus =
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "UNVERIFIED"
  | "INVALID";

/**
 * Résultat déterministe et auditable de la sélection de composant.
 */
export interface ComponentSelectionResult {
  readonly status: ComponentSelectionStatus;
  readonly candidateId: string;
  readonly specificationId: string;
  readonly matchedRuleIds: readonly string[];
  readonly compatibilityRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly message: string;
}

/**
 * Interface publique du moteur de sélection de composants.
 */
export interface IComponentSelectionEngine {
  select(
    candidate: ComponentCandidate,
    context: ComponentSelectionContext
  ): ComponentSelectionResult;
}
