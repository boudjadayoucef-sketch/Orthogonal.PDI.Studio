/**
 * PDI NORMATIVE ENGINE — ASME B31.3 NORMATIVE DATA SET TYPES
 * Reference: B31.3-01 (ASME B31.3 Normative Data Foundation)
 * 
 * Définition des structures typées pour les futurs ensembles de données normatives B31.3.
 * 
 * RÈGLE FONDAMENTALE (B31.3-01) :
 * - AUCUNE valeur numérique ASME (contraintes, coefficients Y, contraintes admissibles, tableaux)
 *   ne doit être inventée ou injectée sans source documentaire vérifiée.
 * - Ce fichier définit uniquement les contrats structurels de typage.
 */

export interface B31_3NormativeDataSet {
  readonly standardId: string;
  readonly editionId: string;
  readonly sourceDocumentId: string;
  readonly status: "UNVERIFIED" | "VERIFIED";
}
