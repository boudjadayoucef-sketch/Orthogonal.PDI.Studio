/**
 * PDI NORMATIVE ENGINE — EVIDENCE & QUALIFICATION TYPES
 * Reference: MASTER-02 (Evidence Model Foundation)
 * 
 * Modèle typé et formel pour séparer de manière étanche :
 *   IDENTIFICATION
 *         ↓
 *   QUALIFICATION
 *         ↓
 *      EVIDENCE
 *         ↓
 *   VERIFIED VALUE
 *         ↓
 *    CALCULATION
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE (MASTER-02) :
 * - Aucun token, suffixe, préfixe ou chaîne libre (ex: MAT_CS_*, _CS_, CS_,
 *   CARBON_STEEL_, CRMO, CR_MO, AUSTENITIC) ne constitue une preuve normative.
 * - Une qualification dépend OBLIGATOIREMENT d'éléments d'évidence explicites et vérifiés.
 * - Distingue formellement raw value vs verified value via `NormativeVerifiedValue<T>`.
 * - Distingue formellement Standard vs Edition vs Evidence via `NormativeEdition` et `NormativeEvidence`.
 */

import type { StandardId } from "./normativeCoreTypes";

/**
 * Typologie des sources d'évidence normatives admises.
 */
export type NormativeEvidenceSourceType =
  | "LICENSED_STANDARD"
  | "VERIFIED_INTERNAL_REFERENCE"
  | "MANUFACTURER_DATA"
  | "LEGACY_REFERENCE";

/**
 * Statut de vérification d'une preuve normative.
 */
export type NormativeVerificationStatus =
  | "UNVERIFIED"
  | "VERIFIED";

/**
 * Contrat d'évidence normative auditable.
 */
export interface NormativeEvidence {
  readonly evidenceId: string;
  readonly standardId: StandardId;
  readonly editionId: string;
  readonly clauseReference: string;
  readonly sourceType: NormativeEvidenceSourceType;
  readonly sourceReference: string;
  readonly sourceDocumentId?: string;
  readonly verificationStatus: NormativeVerificationStatus;
  readonly verifiedBy?: string;
  readonly verifiedAt?: string;
  readonly checksum?: string;
  readonly notes?: string;
}

/**
 * Statut d'une édition normative au sein du référentiel.
 */
export type NormativeEditionStatus =
  | "CURRENT"
  | "SUPERSEDED"
  | "DRAFT";

/**
 * Contrat représentant explicitement une édition normative.
 * Ne transforme jamais "year" ou "revision" en preuve normative à eux seuls.
 */
export interface NormativeEdition {
  readonly id: string;
  readonly standardId: StandardId;
  readonly year: number;
  readonly revision?: string;
  readonly status: NormativeEditionStatus;
  readonly effectiveDate?: string;
  readonly sourceReference: string;
  readonly verificationStatus: NormativeVerificationStatus;
}

/**
 * Statut d'évaluation d'une qualification normative.
 */
export type QualificationStatus =
  | "UNVERIFIED"
  | "QUALIFIED"
  | "DISQUALIFIED";

/**
 * Qualification normative reliant un sujet et une règle à des éléments d'évidence explicites.
 */
export interface NormativeQualification {
  readonly qualificationId: string;
  readonly subjectId: string;
  readonly ruleId: string;
  readonly status: QualificationStatus;
  readonly evidenceIds: readonly string[];
  readonly reason?: string;
}

/**
 * Contrat typé pour une valeur normativement vérifiée.
 * Empêche formellement la confusion entre une valeur brute (raw value)
 * et une valeur vérifiée et tracée (verified value).
 */
export interface NormativeVerifiedValue<T> {
  readonly value: T;
  readonly verificationStatus: NormativeVerificationStatus;
  readonly evidenceIds: readonly string[];
  readonly sourceReference?: string;
}

/**
 * Statut de résolution d'une preuve normative (NORM-09).
 */
export type EvidenceResolutionStatus =
  | "FOUND_VERIFIED"
  | "FOUND_UNVERIFIED"
  | "NOT_FOUND"
  | "INVALID";

/**
 * Résultat de résolution d'une preuve normative individuelle (NORM-09).
 */
export interface EvidenceResolutionResult {
  readonly evidenceId: string;
  readonly status: EvidenceResolutionStatus;
  readonly evidence?: NormativeEvidence;
  readonly message?: string;
}

/**
 * Résultat de résolution pour un ensemble de preuves (NORM-09).
 */
export interface EvidenceSetResolutionResult {
  readonly allFound: boolean;
  readonly allVerified: boolean;
  readonly valid: boolean;
  readonly totalRequested: number;
  readonly verifiedCount: number;
  readonly unverifiedCount: number;
  readonly notFoundCount: number;
  readonly invalidCount: number;
  readonly results: readonly EvidenceResolutionResult[];
}

