/**
 * PDI NORMATIVE ENGINE — VALVE TYPES
 * Reference: PATCH NORM-05 (Valve Engine)
 * 
 * Modèle typé et immuable pour la robinetterie industrielle (Valve Engine).
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Distingue rigoureusement PRODUCT_STANDARD (API-6D, API-600, API-602, API-609)
 *   de DIMENSIONAL_STANDARD (ASME-B16.10 pour l'encombrement Face-to-Face / End-to-End).
 * - Modèle purement descriptif et normatif.
 * - Aucun calcul de débit (Cv/Kv), perte de charge, couple actionneur,
 *   pression/température ou mécanique matériau n'est autorisé.
 */

import type {
  ProductStandardId,
  DimensionalStandardId,
  StandardEdition,
} from "./normativeCoreTypes";

/**
 * Familles fonctionnelles de vannes de tuyauterie.
 */
export type ValveType =
  | "GATE"
  | "GLOBE"
  | "CHECK"
  | "BALL"
  | "BUTTERFLY"
  | "PLUG"
  | "NEEDLE"
  | "FLOATING_BALL"
  | "TRUNNION_BALL"
  | "OTHER";

/**
 * Type d'actionnement ou commande de la vanne (purement descriptif).
 */
export type ValveActuationType =
  | "MANUAL"
  | "GEAR"
  | "PNEUMATIC"
  | "ELECTRIC"
  | "HYDRAULIC"
  | "OTHER";

/**
 * Modes de raccordement des vannes à la tuyauterie.
 */
export type ValveConnectionType =
  | "FLANGED"
  | "BUTT_WELD"
  | "SOCKET_WELD"
  | "THREADED"
  | "WAFER"
  | "LUG"
  | "OTHER"
  | "UNKNOWN";

/**
 * Statut de traçabilité de la donnée source de la vanne.
 */
export type ValveSourceStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "LEGACY";

/**
 * Enregistrement normatif pour un composant de robinetterie industrielle.
 * Modèle immuable et déterministe.
 */
export interface ValveRecord {
  /** Identifiant unique et immuable du record de vanne (ex: "VALVE_API_600_GATE_FLANGED_NPS_6_CL300") */
  readonly id: string;

  /** Standard produit applicable (ex: API-6D, API-600, API-602, API-609) */
  readonly productStandardId?: ProductStandardId;

  /** Standard dimensionnel applicable pour l'encombrement face-à-face (ex: ASME-B16.10) */
  readonly dimensionalStandardId?: DimensionalStandardId;

  /** Édition explicite du standard si vérifiée, sinon undefined */
  readonly standardEdition?: StandardEdition;

  /** Famille fonctionnelle de la vanne (ex: GATE, GLOBE, CHECK, BALL, BUTTERFLY) */
  readonly valveType: ValveType;

  /** Mode de raccordement (ex: FLANGED, BUTT_WELD, WAFER, LUG) */
  readonly connectionType: ValveConnectionType;

  /** Type d'actionnement descriptif (ex: MANUAL, GEAR, PNEUMATIC) */
  readonly actuationType?: ValveActuationType;

  /** Désignation nominale textuelle de taille (ex: "NPS 2", "DN 50") */
  readonly nominalSize?: string;

  /** Désignation NPS (ex: "2", "6", "24") */
  readonly nps?: string;

  /** Désignation DN (ex: 50, 150, 600) */
  readonly dn?: number;

  /** Référence textuelle face-to-face déclarative (ex: "B16.10 Table 1 Column 2") */
  readonly faceToFaceReference?: string;

  /** Référence textuelle end-to-end déclarative (ex: "Short pattern", "Long pattern") */
  readonly endToEndReference?: string;

  // Emplacements dimensionnels optionnels (réservés aux données sources vérifiées, non inventées dans NORM-05)
  readonly faceToFaceMm?: number;
  readonly endToEndMm?: number;
  readonly overallHeightMm?: number;

  /** Système de classification de pression déclaratif (ex: "ASME_CLASS", "EN_PN") */
  readonly pressureRatingSystem?: string;

  /** Valeur de rating déclarative (ex: "Class 150", "Class 300", "PN16") */
  readonly pressureRating?: string;

  /** Référence normative matériau déclarative (ex: "ASTM A216 WCB") */
  readonly materialReference?: string;

  /** Statut de traçabilité de la donnée */
  readonly sourceStatus: ValveSourceStatus;

  /** Référence de traçabilité explicite (obligatoire si VERIFIED ou LICENSED) */
  readonly sourceReference?: string;
}
