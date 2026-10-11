/**
 * PDI NORMATIVE ENGINE — PIPE DIMENSIONAL TYPES
 * Reference: PATCH NORM-02
 * 
 * Modèle dimensionnel typé pour les tubes (Pipe Dimensional Engine).
 * 
 * RÈGLE ARCHITECTURALE :
 * - Ce fichier définit la structure de données permettant de stocker et tracer
 *   les dimensions normatives de tubes issues de standards vérifiés (ASME B36.10M / B36.19M).
 * - Aucune conversion automatique (NPS ↔ DN), aucune formule de déduction (Barlow, thickness)
 *   et aucune propriété mécanique ne doit être exécutée ou calculée ici.
 */

import type { DimensionalStandardId, StandardEdition } from "./normativeCoreTypes";

/**
 * Procédé de fabrication du tube (sans déduction automatique par le schedule).
 */
export type PipeType =
  | "WELDED"
  | "SEAMLESS"
  | "WELDED_OR_SEAMLESS"
  | "UNKNOWN";

/**
 * Statut de traçabilité de la donnée dimensionnelle source.
 */
export type PipeSourceStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "LEGACY";

/**
 * Enregistrement dimensionnel normatif pour un tube.
 * Représente fidèlement et sans conversion implicite une entrée issue d'une norme produit/dimensionnelle.
 */
export interface PipeDimensionalRecord {
  /** Identifiant unique et immuable du record dimensionnel (ex: "PIPE_ASME_B36_10M_NPS_2_SCH40") */
  readonly id: string;

  /** Identifiant typé du standard normatif d'origine (ex: "ASME-B36.10M" ou "ASME-B36.19M") */
  readonly standardId: DimensionalStandardId;

  /** Édition explicite du standard si vérifiée, sinon undefined */
  readonly standardEdition?: StandardEdition;

  /** Désignation nominale textuelle source (ex: "2 in", "NPS 2", "DN 50") */
  readonly nominalSize?: string;

  /** Désignation NPS source (ex: "1/2", "2", "6", "24") - Donnée source indépendante */
  readonly nps?: string;

  /** Désignation DN source (ex: 15, 50, 150, 600) - Donnée source indépendante */
  readonly dn?: number;

  /** Diamètre extérieur réel en millimètres (SI) issu du standard */
  readonly outsideDiameterMm?: number;

  /** Épaisseur de paroi nominale en millimètres (SI) issue du standard */
  readonly wallThicknessMm?: number;

  /** Identifiant de Schedule déclaratif (ex: "SCH 5S", "SCH 10", "SCH 40", "SCH 80", "STD", "XS") */
  readonly schedule?: string;

  /** Type / procédé de fabrication du tube */
  readonly pipeType?: PipeType;

  /** Référence textuelle vers la spécification matériau source (ex: "ASTM A106", "API 5L") */
  readonly materialReference?: string;

  /** Système d'unités de référence du record */
  readonly unitSystem: "SI" | "US_CUSTOMARY";

  /** Statut de traçabilité et de vérification de la donnée */
  readonly sourceStatus: PipeSourceStatus;

  /** Référence explicite de traçabilité de la source (obligatoire si VERIFIED ou LICENSED) */
  readonly sourceReference?: string;
}
