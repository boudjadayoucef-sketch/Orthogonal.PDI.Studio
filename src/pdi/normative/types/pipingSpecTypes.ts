/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION TYPES
 * Reference: PATCH NORM-07 (Piping Specification Engine / Spec Builder)
 * 
 * Modèle typé, déterministe et immuable pour les spécifications de tuyauterie (Piping Specs).
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Couche d'assemblage et de gouvernance des règles de tuyauterie (Pipes, Fittings, Flanges, Valves, Materials).
 * - Modèle purement descriptif et structurel.
 * - Aucun calcul d'épaisseur, de contrainte admissible, de pression, de température
 *   ni de conformité mécanique n'est autorisé dans ce patch.
 */

import type {
  DesignCodeId,
  ProductStandardId,
  DimensionalStandardId,
} from "./normativeCoreTypes";
import type { FittingType, FittingConnectionType } from "./fittingTypes";
import type { FlangeType, FlangeRatingSystem } from "./flangeTypes";
import type { ValveType, ValveConnectionType } from "./valveTypes";

/**
 * Statut de traçabilité de la spécification de tuyauterie.
 */
export type PipingSpecSourceStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "LEGACY";

/**
 * Règle de sélection et d'encadrement des tubes (Pipes).
 */
export interface PipingSpecPipeRule {
  /** Identifiant unique de la règle (optionnel) */
  readonly ruleId?: string;

  /** Standard dimensionnel obligatoire (ex: ASME-B36.10M, ASME-B36.19M) */
  readonly pipeDimensionalStandardId: DimensionalStandardId;

  /** Référence vers un identifiant matériau du Material Engine (optionnel) */
  readonly materialId?: string;

  /** Désignation déclarative de Schedule (ex: "STD", "XS", "SCH 40", "SCH 80") */
  readonly schedule?: string;

  /** Liste des tailles nominales couvertes (ex: ["2", "3", "4", "6"]) */
  readonly nominalSizes?: readonly string[];

  /** Statut de traçabilité de la règle */
  readonly sourceStatus: PipingSpecSourceStatus;

  /** Référence source documentaire */
  readonly sourceReference?: string;

  /** Identifiants de preuves normatives (NORM-09) */
  readonly evidenceIds?: readonly string[];
}

/**
 * Règle de sélection et d'encadrement des raccords de tuyauterie (Fittings).
 */
export interface PipingSpecFittingRule {
  /** Identifiant unique de la règle (optionnel) */
  readonly ruleId?: string;

  /** Standard produit obligatoire (ex: ASME-B16.9, ASME-B16.11) */
  readonly fittingStandardId: ProductStandardId;

  /** Types de raccords autorisés par la règle (ex: ELBOW_90, TEE_EQUAL) */
  readonly fittingTypes?: readonly FittingType[];

  /** Modes de raccordement autorisés (ex: BUTT_WELD, SOCKET_WELD) */
  readonly connectionTypes?: readonly FittingConnectionType[];

  /** Référence vers un matériau du Material Engine */
  readonly materialId?: string;

  /** Statut de traçabilité de la règle */
  readonly sourceStatus: PipingSpecSourceStatus;

  /** Référence source documentaire */
  readonly sourceReference?: string;

  /** Identifiants de preuves normatives (NORM-09) */
  readonly evidenceIds?: readonly string[];
}

/**
 * Règle de sélection et d'encadrement des brides (Flanges).
 */
export interface PipingSpecFlangeRule {
  /** Identifiant unique de la règle (optionnel) */
  readonly ruleId?: string;

  /** Standard produit de bride obligatoire (ex: ASME-B16.5, ASME-B16.47, EN-1092-1) */
  readonly flangeStandardId: ProductStandardId;

  /** Types de brides autorisés (ex: WELD_NECK, BLIND, SLIP_ON) */
  readonly flangeTypes?: readonly FlangeType[];

  /** Système de rating (ASME_CLASS ou EN_PN) — Aucune conversion automatique */
  readonly ratingSystem?: FlangeRatingSystem;

  /** Désignation textuelle de rating (ex: "Class 150", "Class 300", "PN16") */
  readonly rating?: string;

  /** Référence vers un matériau du Material Engine */
  readonly materialId?: string;

  /** Statut de traçabilité de la règle */
  readonly sourceStatus: PipingSpecSourceStatus;

  /** Référence source documentaire */
  readonly sourceReference?: string;

  /** Identifiants de preuves normatives (NORM-09) */
  readonly evidenceIds?: readonly string[];
}

/**
 * Règle de sélection et d'encadrement des vannes (Valves).
 */
export interface PipingSpecValveRule {
  /** Identifiant unique de la règle (optionnel) */
  readonly ruleId?: string;

  /** Standard produit de vanne (ex: API-6D, API-600, API-602, API-609) */
  readonly productStandardId?: ProductStandardId;

  /** Standard dimensionnel d'encombrement face-to-face (ex: ASME-B16.10) */
  readonly dimensionalStandardId?: DimensionalStandardId;

  /** Familles de vannes autorisées (ex: GATE, GLOBE, CHECK, BALL, BUTTERFLY) */
  readonly valveTypes?: readonly ValveType[];

  /** Modes de raccordement autorisés (ex: FLANGED, BUTT_WELD, WAFER) */
  readonly connectionTypes?: readonly ValveConnectionType[];

  /** Référence vers un matériau du Material Engine */
  readonly materialId?: string;

  /** Statut de traçabilité de la règle */
  readonly sourceStatus: PipingSpecSourceStatus;

  /** Référence source documentaire */
  readonly sourceReference?: string;

  /** Identifiants de preuves normatives (NORM-09) */
  readonly evidenceIds?: readonly string[];
}

/**
 * Spécification de tuyauterie (Piping Specification / Piping Class).
 * Modèle immuable et déterministe.
 */
export interface PipingSpecification {
  /** Identifiant unique et immuable de la spec (ex: "SPEC_CS150_ASME_B31_3_001") */
  readonly id: string;

  /** Code métier unique de la spec (ex: "CS150", "CS300", "SS150") */
  readonly code: string;

  /** Nom descriptif de la spec (ex: "Carbon Steel Class 150 Process Piping") */
  readonly name: string;

  /** Code de conception de référence (ex: "ASME-B31.3", "ASME-B31.4", "ASME-B31.8") */
  readonly designCodeId?: DesignCodeId;

  /** Classe de service / désignation industrielle (ex: "A1", "150#", "PN20") */
  readonly serviceClass?: string;

  /** Nature ou famille du fluide transporté (ex: "Hydrocarbons", "Water", "Steam") */
  readonly fluidService?: string;

  /** Références vers les matériaux autorisés dans le Material Engine */
  readonly materialReferenceIds: readonly string[];

  /** Règles de sélection pour les tubes */
  readonly pipeRules: readonly PipingSpecPipeRule[];

  /** Règles de sélection pour les raccords */
  readonly fittingRules: readonly PipingSpecFittingRule[];

  /** Règles de sélection pour les brides */
  readonly flangeRules: readonly PipingSpecFlangeRule[];

  /** Règles de sélection pour les vannes */
  readonly valveRules: readonly PipingSpecValveRule[];

  /** Statut de traçabilité de la spécification */
  readonly sourceStatus: PipingSpecSourceStatus;

  /** Référence source documentaire (obligatoire si VERIFIED ou LICENSED) */
  readonly sourceReference?: string;

  /** Identifiants de preuves normatives au niveau de la spec (NORM-09) */
  readonly evidenceIds?: readonly string[];
}
