/**
 * PDI NORMATIVE ENGINE — MATERIAL TYPES
 * Reference: PATCH NORM-06 (Material Engine)
 * 
 * Modèle typé et immuable pour les matériaux de tuyauterie (Material Engine).
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Distingue formellement MATERIAL STANDARD (API-5L) ≠ MATERIAL GRADE (X52, X65) ≠
 *   MATERIAL SPECIFICATION (ASTM A106) ≠ MATERIAL PROPERTY (Yield, Tensile) ≠ DESIGN CODE (B31.3).
 * - Modèle purement déclaratif et normatif.
 * - Aucun calcul de contrainte admissible, de pression de calcul, d'épaisseur,
 *   ni d'interpolation de propriétés en fonction de la température n'est autorisé.
 */

import type {
  MaterialStandardId,
  StandardEdition,
} from "./normativeCoreTypes";

/**
 * Familles métallurgiques de matériaux.
 */
export type MaterialCategory =
  | "CARBON_STEEL"
  | "LOW_ALLOY_STEEL"
  | "STAINLESS_STEEL"
  | "DUPLEX_STAINLESS_STEEL"
  | "NICKEL_ALLOY"
  | "OTHER";

/**
 * Forme de produit métallurgique / composant associé.
 */
export type MaterialProductForm =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE"
  | "PLATE"
  | "FORGING"
  | "BAR"
  | "OTHER";

/**
 * Statut de traçabilité de la donnée source du matériau.
 */
export type MaterialSourceStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "LEGACY";

/**
 * Ensemble structuré de propriétés mécaniques et physiques.
 * Reste purement déclaratif (aucune valeur inventée).
 */
export interface MaterialPropertySet {
  readonly sourceStatus: MaterialSourceStatus;
  readonly sourceReference?: string;

  readonly yieldStrengthMPa?: number;
  readonly tensileStrengthMPa?: number;
  readonly densityKgM3?: number;
  readonly elasticModulusGPa?: number;
  readonly poissonRatio?: number;
  readonly thermalExpansionCoefficient?: number;
  readonly allowableStressMPa?: number;
}

/**
 * Point de propriété dépendant de la température (structure déclarative future).
 * Aucune interpolation ou extrapolation n'est effectuée.
 */
export interface TemperaturePropertyPoint {
  readonly temperatureC: number;
  readonly value: number;
}

/**
 * Enregistrement normatif pour un matériau de tuyauterie.
 * Modèle immuable et déterministe.
 */
export interface MaterialRecord {
  /** Identifiant unique et immuable du record de matériau (ex: "MAT_API_5L_X65_PSL2") */
  readonly id: string;

  /** Standard matériau normatif obligatoire (ex: "API-5L") */
  readonly standardId: MaterialStandardId;

  /** Édition explicite du standard si vérifiée, sinon undefined */
  readonly standardEdition?: StandardEdition;

  /** Désignation textuelle complète déclarative (ex: "API 5L X65", "ASTM A106 Grade B") */
  readonly designation: string;

  /** Nuance / Grade déclaratif (ex: "X65", "B", "316L") */
  readonly grade?: string;

  /** Famille métallurgique (ex: CARBON_STEEL, STAINLESS_STEEL) */
  readonly materialCategory?: MaterialCategory;

  /** Forme de produit descriptive (ex: PIPE, FORGING, FITTING) */
  readonly productForm?: MaterialProductForm;

  /** Référence normative de spécification (ex: "PSL 2", "Type S") */
  readonly specificationReference?: string;

  // Propriétés mécaniques optionnelles déclaratives (non inventées dans NORM-06)
  readonly yieldStrengthMPa?: number;
  readonly tensileStrengthMPa?: number;
  readonly densityKgM3?: number;
  readonly elasticModulusGPa?: number;
  readonly poissonRatio?: number;
  readonly thermalExpansionCoefficient?: number;
  readonly allowableStressMPa?: number;

  /** Jeu de propriétés secondaires ou versionnées */
  readonly properties?: MaterialPropertySet;

  /** Statut de traçabilité de la donnée */
  readonly sourceStatus: MaterialSourceStatus;

  /** Référence de traçabilité explicite (obligatoire si VERIFIED ou LICENSED) */
  readonly sourceReference?: string;
}
