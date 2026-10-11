/**
 * PDI NORMATIVE ENGINE — NORMATIVE SOURCE DOCUMENT TYPES
 * Reference: B31.3-01 (ASME B31.3 Normative Data Foundation)
 * 
 * Modèle formel et typé pour la représentation des sources documentaires normatives.
 * 
 * RÈGLE ARCHITECTURALE FONDAMENTALE (B31.3-01) :
 * - NormativeSourceDocument décrit la source documentaire officielle (norme, recueil, licence, addenda).
 * - Il ne constitue PAS automatiquement une preuve (NormativeEvidence) d'une valeur particulière.
 * - Le statut "UNVERIFIED" ne doit JAMAIS être transformé en "VERIFIED" sans audit formel.
 * 
 * Chaîne de traçabilité :
 *   SourceDocument
 *         ↓
 *      Evidence
 *         ↓
 *   Qualification
 *         ↓
 *   VerifiedValue
 *         ↓
 *    Calculation
 */

/**
 * Statut de vérification d'un document source normatif.
 */
export type NormativeSourceDocumentStatus =
  | "UNVERIFIED"
  | "VERIFIED";

/**
 * Contrat représentant un document source normatif officiel.
 */
export interface NormativeSourceDocument {
  readonly documentId: string;
  readonly title: string;
  readonly publisher?: string;
  readonly standardId: string;
  readonly editionId: string;
  readonly documentReference: string;
  readonly status: NormativeSourceDocumentStatus;
  readonly verifiedBy?: string;
  readonly verifiedAt?: string;
  readonly checksum?: string;
  readonly notes?: string;
}

/**
 * Statut de résolution d'un document source normatif.
 */
export type SourceDocumentResolutionStatus =
  | "FOUND_VERIFIED"
  | "FOUND_UNVERIFIED"
  | "NOT_FOUND"
  | "INVALID";

/**
 * Résultat de résolution d'un document source individuel.
 */
export interface SourceDocumentResolutionResult {
  readonly documentId: string;
  readonly status: SourceDocumentResolutionStatus;
  readonly document?: NormativeSourceDocument;
  readonly message?: string;
}

/**
 * Résultat de résolution pour un ensemble de documents sources.
 */
export interface SourceDocumentSetResolutionResult {
  readonly allFound: boolean;
  readonly allVerified: boolean;
  readonly valid: boolean;
  readonly totalRequested: number;
  readonly verifiedCount: number;
  readonly unverifiedCount: number;
  readonly notFoundCount: number;
  readonly invalidCount: number;
  readonly results: readonly SourceDocumentResolutionResult[];
}
