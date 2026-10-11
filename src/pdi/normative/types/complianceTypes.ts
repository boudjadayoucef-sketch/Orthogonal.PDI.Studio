/**
 * PDI NORMATIVE ENGINE — COMPLIANCE TYPES
 * Reference: PATCH NORM-01
 * 
 * Vocabulaire et structures de données déclaratives pour les futurs
 * résultats de conformité normative.
 * 
 * RÈGLE ARCHITECTURALE :
 * Aucune règle de validation, aucun algorithme de contrôle et aucun seuil
 * n'est implémenté ici. Ce fichier formalise exclusivement la signature des résultats futurs.
 */

import type { StandardId, StandardEdition } from "./normativeCoreTypes";

/**
 * Statut d'évaluation de conformité délivré par le futur Compliance Engine.
 */
export type ComplianceStatus =
  | "COMPLIANT"
  | "WARNING"
  | "NON_COMPLIANT"
  | "UNVERIFIED";

/**
 * Niveau de sévérité d'un écart ou avertissement de conformité.
 */
export type ComplianceSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

/**
 * Structure de résultat d'un contrôle de conformité.
 * Prévue pour fournir une traçabilité rigoureuse :
 * Standard -> Édition -> Règle -> Référence -> Composant -> Écart constaté.
 */
export interface ComplianceResult {
  readonly status: ComplianceStatus;
  readonly standardId?: StandardId;
  readonly edition?: StandardEdition;
  readonly editionId?: string;
  readonly ruleId?: string;
  readonly qualificationId?: string;
  readonly clauseReference?: string;
  readonly componentId?: string;
  readonly message: string;
  readonly severity: ComplianceSeverity;
  readonly actualValue?: string | number;
  readonly expectedValue?: string | number;
  readonly timestamp?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Rapport consolidé de conformité pour une ligne ou un projet complet.
 */
export interface ComplianceSummaryReport {
  readonly overallStatus: ComplianceStatus;
  readonly totalChecks: number;
  readonly compliantCount: number;
  readonly warningCount: number;
  readonly nonCompliantCount: number;
  readonly unverifiedCount: number;
  readonly results: readonly ComplianceResult[];
}
