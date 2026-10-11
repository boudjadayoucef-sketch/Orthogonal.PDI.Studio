/**
 * PDI NORMATIVE ENGINE — FITTING TYPES
 * Reference: PATCH NORM-03
 * 
 * Modèle typé et immuable pour les raccords de tuyauterie (Fittings Engine).
 * 
 * RÈGLE ARCHITECTURALE :
 * - Ce fichier définit la structure de données permettant de stocker et tracer
 *   les raccords industriels normatifs issus de standards vérifiés (ASME B16.9 / B16.11).
 * - Aucune conversion automatique (NPS ↔ DN), aucun calcul géométrique (Radius = 1.5D)
 *   et aucun calcul de pression/rating ne doit être exécuté ou calculé ici.
 */

import type { ProductStandardId, StandardEdition } from "./normativeCoreTypes";

/**
 * Familles fonctionnelles de raccords de tuyauterie.
 */
export type FittingType =
  | "ELBOW"
  | "TEE"
  | "REDUCER"
  | "CAP"
  | "CROSS"
  | "COUPLING"
  | "UNION"
  | "SOCKET_WELD_FITTING"
  | "THREADED_FITTING"
  | "OTHER";

/**
 * Modes de raccordement des raccords.
 */
export type FittingConnectionType =
  | "BUTT_WELD"
  | "SOCKET_WELD"
  | "THREADED"
  | "UNKNOWN";

/**
 * Statut de traçabilité de la donnée source du raccord.
 */
export type FittingSourceStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "LEGACY";

/**
 * Enregistrement dimensionnel normatif pour un raccord.
 * Modèle immuable et déterministe.
 */
export interface FittingDimensionalRecord {
  /** Identifiant unique et immuable du record de raccord (ex: "FITTING_ASME_B16_9_ELBOW_90_NPS_2") */
  readonly id: string;

  /** Identifiant typé du standard produit d'origine (ex: "ASME-B16.9" ou "ASME-B16.11") */
  readonly standardId: ProductStandardId;

  /** Édition explicite du standard si vérifiée, sinon undefined */
  readonly standardEdition?: StandardEdition;

  /** Famille du raccord (ex: ELBOW, TEE, REDUCER, etc.) */
  readonly fittingType: FittingType;

  /** Mode de raccordement (ex: BUTT_WELD, SOCKET_WELD, THREADED) */
  readonly connectionType: FittingConnectionType;

  /** Désignation nominale textuelle de l'extrémité principale (ex: "2 in", "NPS 2", "DN 50") */
  readonly nominalSize?: string;

  /** Désignation NPS de l'extrémité principale (ex: "2", "6", "24") */
  readonly nps?: string;

  /** Désignation DN de l'extrémité principale (ex: 50, 150, 600) */
  readonly dn?: number;

  /** Désignation nominale textuelle de la seconde extrémité (ex: pour un réducteur ou té réduit) */
  readonly endSize2?: string;

  /** Désignation NPS de la seconde extrémité (ex: "1 1/2", "4") */
  readonly endNps2?: string;

  /** Désignation DN de la seconde extrémité (ex: 40, 100) */
  readonly endDn2?: number;

  /** Angle explicite en degrés si applicable (ex: 45, 90) - Déclaratif source */
  readonly angleDeg?: number;

  /** Classe de rayon déclarative si applicable (ex: "LR", "SR", "3D") */
  readonly radiusClass?: string;

  /** Statut de traçabilité et de vérification de la donnée */
  readonly sourceStatus: FittingSourceStatus;

  /** Référence explicite de traçabilité de la source (obligatoire si VERIFIED ou LICENSED) */
  readonly sourceReference?: string;
}
