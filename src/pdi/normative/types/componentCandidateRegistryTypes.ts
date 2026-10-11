/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE REGISTRY TYPES
 * Reference: COMPONENT-03 (Component Candidate Registry & Resolver)
 * 
 * Définitions de types pour le registre en mémoire et le résolveur déterministe
 * de candidats composants, construits sur COMPONENT-01 et COMPONENT-02.
 */

import type {
  ComponentCandidate,
  ComponentSelectionContext,
  ComponentType,
} from "./componentSelectionTypes";

/**
 * Interface du registre déterministe en mémoire pour les candidats composants.
 */
export interface IComponentCandidateRegistry {
  /**
   * Enregistre un candidat composant après validation structurelle.
   * Lève une erreur si candidateId est dupliqué ou si le candidat est invalide.
   */
  register(candidate: ComponentCandidate): void;

  /**
   * Récupère un candidat par son candidateId exact.
   */
  get(candidateId: string): ComponentCandidate | undefined;

  /**
   * Vérifie la présence d'un candidat par son candidateId exact.
   */
  has(candidateId: string): boolean;

  /**
   * Liste immuable de tous les candidats enregistrés.
   */
  list(): readonly ComponentCandidate[];

  /**
   * Nombre de candidats enregistrés.
   */
  count(): number;

  /**
   * Vide l'intégralité du registre.
   */
  clear(): void;
}

/**
 * Statuts possibles pour la résolution d'un candidat par spécification.
 */
export type ComponentCandidateResolutionStatus =
  | "RESOLVED"
  | "NO_CANDIDATE"
  | "UNVERIFIED"
  | "AMBIGUOUS"
  | "INVALID";

/**
 * Résultat déterministe et auditable de la résolution de candidats par spécification.
 */
export interface ComponentCandidateResolutionResult {
  readonly status: ComponentCandidateResolutionStatus;
  readonly specificationId: string;
  readonly componentType: ComponentType;
  readonly selectedCandidateId?: string;
  readonly candidateIds: readonly string[];
  readonly candidates?: readonly ComponentCandidate[];
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
 * Interface du résolveur déterministe de candidats composants.
 */
export interface IComponentCandidateResolver {
  /**
   * Résolution directe par candidateId.
   */
  resolve(candidateId: string): ComponentCandidate | undefined;

  /**
   * Résolution déterministe par spécification et contexte d'ingénierie via COMPONENT-02.
   */
  resolveBySpecification(
    specificationId: string,
    context: ComponentSelectionContext
  ): ComponentCandidateResolutionResult;

  /**
   * Retourne la liste des candidats retenus (exactement 1 si RESOLVED, vide sinon).
   */
  resolveCandidates(
    specificationId: string,
    context: ComponentSelectionContext
  ): readonly ComponentCandidate[];
}
