/**
 * PDI NORMATIVE ENGINE — CORE TYPES
 * Reference: PATCH NORM-01
 * 
 * Fondations de domaine pour l'identification, la classification
 * et les métadonnées des normes industrielles.
 * 
 * RÈGLE ARCHITECTURALE :
 * Aucun calcul, aucune dimension, aucune conversion, aucune règle de conformité
 * n'est implémentée dans ce fichier. Ce sont uniquement des types déclaratifs purs.
 */

/**
 * Organismes de normalisation reconnus par le référentiel PDI.
 * Ne pas réduire ou fusionner ASME en ANSI, ni assimiler DIN à EN.
 */
export type NormativeOrganization =
  | "ASME"
  | "API"
  | "ISO"
  | "EN"
  | "DIN";

/**
 * Nature fonctionnelle du standard dans l'architecture d'ingénierie.
 * Sépare formellement les codes de conception, les standards produit,
 * les standards dimensionnels et les standards métallurgiques/matériaux.
 */
export type NormativeStandardType =
  | "DESIGN_CODE"
  | "PRODUCT_STANDARD"
  | "DIMENSIONAL_STANDARD"
  | "MATERIAL_STANDARD";

/**
 * Domaine technique d'application du standard dans l'écosystème de piping.
 */
export type NormativeDomain =
  | "PIPING"
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE"
  | "MATERIAL"
  | "PIPELINE"
  | "INDUSTRIAL_PIPING";

/**
 * Statut d'une référence normative dans le registre PDI.
 * Décrit l'état de la fiche au sein du logiciel (sans portée juridique).
 */
export type NormativeStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "WITHDRAWN"
  | "DRAFT"
  | "UNVERIFIED";

/**
 * Identifiants fortement typés pour les familles de standards.
 * Permet d'éviter la sur-ingénierie tout en garantissant un typage strict.
 */
export type StandardId = string;
export type DesignCodeId = StandardId;
export type ProductStandardId = StandardId;
export type DimensionalStandardId = StandardId;
export type MaterialStandardId = StandardId;

/**
 * Représentation explicite de l'édition / millésime d'une norme.
 * L'année d'édition ne doit JAMAIS être présumée ou inventée.
 */
export interface StandardEdition {
  readonly year?: string;
  readonly revision?: string;
  readonly effectiveDate?: string;
  readonly supersedes?: string;
  readonly notes?: string;
}

/**
 * Fiche d'identité d'un standard industriel dans le registre normatif.
 * Modèle immuable et déterministe.
 */
export interface NormativeStandard {
  readonly id: StandardId;
  readonly organization: NormativeOrganization;
  readonly code: string;
  readonly title: string;
  readonly domain: NormativeDomain;
  readonly standardType: NormativeStandardType;
  readonly status: NormativeStatus;
  readonly edition?: StandardEdition;
  readonly editionId?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Référence conceptuelle vers un code de conception pour les futurs calculs.
 * Ne contient aucune règle ni formule de calcul à ce stade.
 */
export interface DesignCodeReference {
  readonly designCodeId: DesignCodeId;
  readonly edition?: StandardEdition;
  readonly editionId?: string;
  readonly clauseReference?: string;
  readonly evidenceIds?: readonly string[];
}
