/**
 * PDI NORMATIVE ENGINE — ASME B31.3 NORMATIVE DATA TYPES
 * Reference: B31.3-02 (Controlled Normative Data Ingestion)
 * 
 * Modèle formel et typé pour la représentation et l'ingestion contrôlée
 * des données normatives ASME B31.3.
 * 
 * RÈGLE ARCHITECTURALE FONDAMENTALE (B31.3-02) :
 * - Aucune valeur numérique ASME B31.3 n'est inventée ou inférée.
 * - Tout record normatif doit être ancré de manière continue dans la chaîne de preuve :
 *     NormativeSourceDocument (FOUND_VERIFIED)
 *               ↓
 *      NormativeEvidence (FOUND_VERIFIED)
 *               ↓
 *     NormativeQualification (QUALIFIED)
 *               ↓
 *     B31_3NormativeDataRecord<T> (VERIFIED)
 *               ↓
 *          Calculation
 */

/**
 * Statut de vérification d'un enregistrement de données B31.3.
 */
export type B31_3DataStatus =
  | "UNVERIFIED"
  | "VERIFIED";

/**
 * Contrat générique représentant un enregistrement de donnée normative B31.3.
 */
export interface B31_3NormativeDataRecord<T = unknown> {
  readonly dataId: string;
  readonly standardId: string;
  readonly editionId: string;
  readonly sourceDocumentId: string;
  readonly evidenceId: string;
  readonly clauseReference: string;
  readonly dataType: string;
  readonly value: T;
  readonly unit?: string;
  readonly status: B31_3DataStatus;
  readonly notes?: string;
}

/**
 * Statut de résolution d'une donnée B31.3.
 */
export type B31_3DataResolutionStatus =
  | "FOUND_VERIFIED"
  | "FOUND_UNVERIFIED"
  | "NOT_FOUND"
  | "INVALID";

/**
 * Résultat de résolution d'un enregistrement de donnée individuel.
 */
export interface B31_3DataResolutionResult<T = unknown> {
  readonly dataId: string;
  readonly status: B31_3DataResolutionStatus;
  readonly record?: B31_3NormativeDataRecord<T>;
  readonly message?: string;
}

/**
 * Résultat de résolution pour un ensemble d'enregistrements de données B31.3.
 */
export interface B31_3DataSetResolutionResult<T = unknown> {
  readonly allFound: boolean;
  readonly allVerified: boolean;
  readonly valid: boolean;
  readonly totalRequested: number;
  readonly verifiedCount: number;
  readonly unverifiedCount: number;
  readonly notFoundCount: number;
  readonly invalidCount: number;
  readonly results: readonly B31_3DataResolutionResult<T>[];
}
