/**
 * PDI NORMATIVE ENGINE — ASME B31.3 DATA & INTEGRATION TYPES
 * Reference: B31.3-04 (Controlled Normative Integration Boundary)
 * 
 * Définit les contrats typés d'intégration entre le modèle de données B31.3
 * et la frontière de calcul normative (Calculation Boundary).
 * 
 * RÈGLE ARCHITECTURALE FONDAMENTALE (B31.3-04) :
 * - Aucune invention de valeur normative.
 * - Respect strict de la chaîne de traçabilité :
 *     SourceDocument → Evidence → Qualification → B31_3NormativeDataRecord → NormativeVerifiedValue → CalculationBoundary
 */

export * from "../../types/b31_3DataTypes";

import type { NormativeVerifiedValue } from "../../types/normativeEvidenceTypes";

/**
 * Requête d'intégration pour une donnée B31.3.
 */
export interface B31_3IntegrationRequest {
  readonly dataId: string;
}

/**
 * Statuts possibles de l'intégration d'une donnée B31.3.
 */
export type B31_3IntegrationStatus =
  | "RESOLVED_VERIFIED"
  | "UNVERIFIED"
  | "NOT_FOUND"
  | "INVALID";

/**
 * Résultat typé de l'intégration d'une donnée B31.3.
 */
export interface B31_3IntegrationResult<T = unknown> {
  readonly status: B31_3IntegrationStatus;
  readonly dataId: string;
  readonly value?: T;
  readonly standardId?: string;
  readonly editionId?: string;
  readonly sourceDocumentId?: string;
  readonly evidenceId?: string;
  readonly clauseReference?: string;
  readonly verifiedValue?: NormativeVerifiedValue<T>;
  readonly message: string;
}

/**
 * Résultat de raccordement d'une donnée B31.3 vers le moteur de calcul F01.
 */
export interface B31_3F01ResolutionResult<T = number> {
  readonly status: B31_3IntegrationStatus;
  readonly integrationResult: B31_3IntegrationResult<T>;
  readonly verifiedValue?: NormativeVerifiedValue<T>;
  readonly message: string;
}

