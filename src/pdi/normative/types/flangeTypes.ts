/**
 * PDI NORMATIVE ENGINE — FLANGE TYPES
 * Reference: PATCH NORM-04 (Flange Engine)
 * 
 * Modèle typé et immuable pour les brides de tuyauterie (Flange Engine).
 * 
 * RÈGLE ARCHITECTURALE :
 * - Définit la structure de données permettant de modéliser et tracer
 *   les brides normatives selon ASME B16.5, ASME B16.47 et EN 1092-1.
 * - Séparation stricte entre les familles ASME (Class) et EN (PN).
 * - Aucune conversion automatique (Class ↔ PN, NPS ↔ DN), aucun calcul de contrainte
 *   ou de pression/température n'est réalisé dans ce socle.
 */

import type { ProductStandardId, StandardEdition } from "./normativeCoreTypes";

/**
 * Familles fonctionnelles de brides de tuyauterie.
 */
export type FlangeType =
  | "WELD_NECK"
  | "SLIP_ON"
  | "BLIND"
  | "SOCKET_WELD"
  | "THREADED"
  | "LAP_JOINT"
  | "ORIFICE"
  | "LONG_WELD_NECK"
  | "OTHER";

/**
 * Famille de standard normatif pour les brides.
 */
export type FlangeStandardFamily =
  | "ASME"
  | "EN";

/**
 * Système de classification de pression (Rating System).
 * ASME Class et EN PN sont rigoureusement distincts.
 */
export type FlangeRatingSystem =
  | "ASME_CLASS"
  | "EN_PN";

/**
 * Statut de traçabilité de la donnée source de la bride.
 */
export type FlangeSourceStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "LEGACY";

/**
 * Enregistrement dimensionnel normatif pour une bride de tuyauterie.
 * Modèle immuable et déterministe.
 */
export interface FlangeDimensionalRecord {
  /** Identifiant unique et immuable du record de bride (ex: "FLANGE_ASME_B16_5_WN_CL150_NPS_2") */
  readonly id: string;

  /** Identifiant typé du standard produit d'origine (ASME-B16.5, ASME-B16.47, EN-1092-1) */
  readonly standardId: ProductStandardId;

  /** Édition explicite du standard si vérifiée, sinon undefined */
  readonly standardEdition?: StandardEdition;

  /** Famille fonctionnelle de la bride (ex: WELD_NECK, BLIND, SLIP_ON, etc.) */
  readonly flangeType: FlangeType;

  /** Système de rating (ASME_CLASS pour B16.5/B16.47, EN_PN pour EN 1092-1) */
  readonly ratingSystem: FlangeRatingSystem;

  /** Désignation textuelle du rating déclaratif (ex: "Class 150", "PN16") */
  readonly rating?: string;

  /** Désignation nominale textuelle de taille (ex: "NPS 2", "DN 50") */
  readonly nominalSize?: string;

  /** Désignation NPS (ex: "2", "24", "48") */
  readonly nps?: string;

  /** Désignation DN (ex: 50, 600, 1200) */
  readonly dn?: number;

  /** Type de face de joint déclaratif (ex: "RF", "FF", "RTJ") */
  readonly facingType?: string;

  /** Référence textuelle de l'alésage (ex: "STD", "XS", "SCH 40") */
  readonly boreType?: string;

  // Emplacements dimensionnels optionnels (réservés aux données sources vérifiées, non inventées dans NORM-04)
  readonly outsideDiameterMm?: number;
  readonly flangeThicknessMm?: number;
  readonly boltCircleDiameterMm?: number;
  readonly boreDiameterMm?: number;
  readonly boltHoleDiameterMm?: number;
  readonly boltCount?: number;

  /** Statut de traçabilité et de vérification de la donnée */
  readonly sourceStatus: FlangeSourceStatus;

  /** Référence explicite de traçabilité de la source (obligatoire si VERIFIED ou LICENSED) */
  readonly sourceReference?: string;
}
