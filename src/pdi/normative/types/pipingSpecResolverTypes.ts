/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION RESOLVER TYPES
 * Reference: SPEC-01 (Piping Specification Resolver)
 * 
 * Définitions de types pour la couche d'orchestration et de résolution
 * entre les spécifications de tuyauterie (Piping Specs) et la matrice de compatibilité (NORM-13).
 */

import type {
  CompatibilityStatus,
} from "./normativeCompatibilityTypes";
import type {
  PipingSpecification,
} from "./pipingSpecTypes";

export type PipingSpecResolutionStatus = CompatibilityStatus;

/**
 * Contexte d'entrée pour la résolution d'admissibilité d'un composant dans une Piping Spec.
 */
export interface PipingSpecResolutionContext {
  /** Identifiant de la spécification de tuyauterie ciblée */
  readonly specificationId: string;

  /** Famille de composant (ex: "PIPE", "FITTING", "FLANGE", "VALVE") */
  readonly componentType: string;

  /** Taille nominale (ex: "2", "3", "DN 50", "NPS 2") */
  readonly nominalSize?: string;

  /** Désignation déclarative de Schedule (ex: "SCH 40", "STD", "SCH 80", "XS") */
  readonly schedule?: string;

  /** Identifiant du matériau (ex: "ASTM-A106-B") */
  readonly materialId?: string;

  /** Sous-type de raccord (ex: "ELBOW_90", "TEE_EQUAL", "CONCENTRIC_REDUCER") */
  readonly fittingType?: string;

  /** Mode de raccordement (ex: "BUTT_WELD", "SOCKET_WELD", "THREADED", "FLANGED") */
  readonly connectionType?: string;

  /** Standard dimensionnel (ex: "ASME-B36.10M", "ASME-B16.10") */
  readonly dimensionalStandardId?: string;

  /** Standard produit (ex: "ASME-B16.9", "ASME-B16.5", "API-600") */
  readonly productStandardId?: string;

  /** Système de rating (ex: "ASME_CLASS", "EN_PN") */
  readonly ratingSystem?: string;

  /** Valeur de rating (ex: "Class 150", "Class 300", "PN 16", "PN 40") */
  readonly ratingValue?: string;

  /** Code de conception de référence (ex: "ASME-B31.3") */
  readonly designCodeId?: string;

  /** Liste d'identifiants de preuves normatives (NORM-09) */
  readonly evidenceIds?: readonly string[];
}

/**
 * Résultat déterministe et auditable de la résolution d'une Piping Spec.
 */
export interface PipingSpecResolutionResult {
  /** Statut d'admissibilité résolu */
  readonly status: PipingSpecResolutionStatus;

  /** Identifiant de la spécification évaluée */
  readonly specificationId: string;

  /** Famille de composant évaluée */
  readonly componentType: string;

  /** Identifiants des règles Piping Spec ayant correspondu */
  readonly matchedRuleIds: readonly string[];

  /** Identifiants des règles de compatibilité (NORM-13) ayant correspondu */
  readonly compatibilityRuleIds: readonly string[];

  /** Identifiants des preuves normatives auditées */
  readonly evidenceIds: readonly string[];

  /** Message explicatif ou diagnostic de résolution */
  readonly message?: string;
}

/**
 * Interface publique du résolveur de spécification de tuyauterie.
 */
export interface IPipingSpecResolver {
  resolve(context: PipingSpecResolutionContext): PipingSpecResolutionResult;
}

/**
 * Fonction ou abstraction de recherche d'une spécification de tuyauterie.
 */
export type PipingSpecLookupFunction = (specificationId: string) => PipingSpecification | undefined;
