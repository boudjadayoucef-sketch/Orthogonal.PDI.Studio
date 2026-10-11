/**
 * PDI ENGINEERING PLATFORM — ASME B31.8 GAS PIPELINE ENGINEERING & CALCULATION READINESS TYPES (ARCH-11)
 * Reference: ARCH-11 (ASME B31.8 — Gas Pipeline Engineering & Calculation Readiness)
 *
 * Modèle typé, déterministe et immuable préparant l'intégration d'un contexte d'ingénierie
 * de pipeline gaz (ASME B31.8) avec le Pipeline Engineering Model (ARCH-10), le Multi-Code
 * Resolver (ARCH-09) et le moteur de calcul normatif (NORM-08).
 *
 * SÉPARATION STRICTE DES 6 ÉTAPES (ARCH-11 §1) :
 * 1. Engineering domain identification (`EngineeringDomainId` === `"PIPELINE"`, fluide gaz).
 * 2. Code and edition identification (`resolvedDesignCodeId` === `"ASME-B31.8"`, édition `2022`).
 * 3. Normative evidence and verification status (`NormativeSourceDocument`, `NormativeEvidence`, `UNVERIFIED` vs `VERIFIED`).
 * 4. Calculation qualification (`DesignCodeNormativeQualificationStatus`: `NOT_QUALIFIED` / `UNVERIFIED` / `QUALIFIED`).
 * 5. Calculation availability (`CalculationCapabilityAvailabilityStatus`: `NOT_IMPLEMENTED` / `AVAILABLE`, `isUsableForCalculation`).
 * 6. Numerical execution and result validation (`executeEngineeringCalculation` — bloqué tant que l'étape 4/5 n'est pas qualifiée et disponible).
 *
 * RÈGLES DE SÉCURITÉ NORMATIVE (ARCH-11 §3.A, §3.B, §3.C) :
 * - N'invente aucune formule, équation, clause, coefficient (F, E, T), limite ou critère d'acceptation ASME B31.8.
 * - Maintient les calculs ASME B31.8 explicitement à `NOT_IMPLEMENTED` en l'absence de source normative vérifiée.
 * - Ne déduit jamais le code applicable à partir d'un nom de client, d'un titre de projet, d'un libellé matériau ou d'une licence commerciale.
 * - Interdit toute substitution inter-codes entre `ASME-B31.3`, `ASME-B31.8` et `ASME-B31.12`.
 */

import type { EngineeringDomainId } from "../../engineering/types/engineeringDomainTypes";
import type {
  PipelineFluidCategory,
  PipelineSegment,
  PipelineServiceFluidDeclaration,
  PipelineSystem,
} from "../../engineering/types/pipelineEngineeringModelTypes";
import type {
  DesignCodeId,
  NormativeStandard,
  StandardEdition,
} from "./normativeCoreTypes";
import type {
  CalculationStatus,
  DesignCodeSupportStatus,
  EngineeringCalculationInput,
  EngineeringCalculationResult,
  EngineeringCalculationType,
  EngineeringUnitSystem,
} from "./designCodeTypes";
import type {
  CalculationCapabilityAvailabilityStatus,
  DesignCodeEditionEvidenceReport,
  DesignCodeNormativeQualificationStatus,
  MultiCodeResolutionResult,
  MultiCodeResolutionStatus,
} from "./multiCodeResolverTypes";
import type { NormativeVerificationStatus } from "./normativeEvidenceTypes";

/**
 * Identifiant canonique du code de conception ASME B31.8 dans PDI_STANDARDS_REGISTRY.
 */
export const ASME_B31_8_DESIGN_CODE_ID = "ASME-B31.8" as const;

/**
 * Identifiant du document source normatif de référence ASME B31.8-2022
 * tel qu'enregistré dans UPCOMING_NORMATIVE_SOURCE_DOCUMENTS (statut actuel: UNVERIFIED).
 */
export const ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID = "DOC-ASME-B31.8-2022" as const;

/**
 * Classification de compatibilité du service fluide déclaré sur le pipeline
 * vis-à-vis d'un contexte d'ingénierie gaz ASME B31.8.
 * - GAS_SERVICE_DECLARED : fluide explicitement déclaré `NATURAL_GAS` (compatible).
 * - HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION : fluide `HYDROGEN` ou `NATURAL_GAS_HYDROGEN_BLEND`
 *   (ne déclenche ni qualification B31.8 automatique ni calcul B31.12).
 * - NON_GAS_FLUID_MISMATCH : fluide liquide ou non-gaz (`LIQUID_HYDROCARBON`, `WATER`, etc.) incompatible avec un pipeline de gaz B31.8.
 * - UNDECLARED_SERVICE : aucun service fluide structuré n'est déclaré sur le tronçon ni sur le système.
 */
export type B31_8GasServiceReadinessStatus =
  | "GAS_SERVICE_DECLARED"
  | "HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION"
  | "NON_GAS_FLUID_MISMATCH"
  | "UNDECLARED_SERVICE";

/**
 * Statut global d'évaluation de préparation (Readiness) d'un contexte pipeline ASME B31.8.
 * - READY_FOR_CALCULATION : les étapes 1 à 5 sont intégralement validées, qualifiées et disponibles.
 * - BLOCKED_CALCULATION_NOT_IMPLEMENTED : le domaine et le code ASME B31.8 sont identifiés (Étapes 1 & 2),
 *   mais le calcul demandé est `NOT_IMPLEMENTED` / non qualifié (Étapes 3, 4, 5).
 * - BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE : l'édition ou les preuves normatives requises sont `UNVERIFIED`.
 * - BLOCKED_CODE_RESOLUTION : le Multi-Code Resolver n'a pas résolu `ASME-B31.8` (`AMBIGUOUS`, `INSUFFICIENT_DATA`, `UNSUPPORTED_CODE`, ou autre code résolu).
 * - BLOCKED_DOMAIN_OR_MODEL_INVALID : le `PipelineSystem` ou le `PipelineSegment` est structurellement invalide,
 *   n'appartient pas au domaine `PIPELINE`, ou présente un fluide incompatible.
 * - INVALID_READINESS_REQUEST : la requête d'évaluation est malformée ou contient des champs heuristiques/clients/licences interdits.
 */
export type B31_8PipelineReadinessStatus =
  | "READY_FOR_CALCULATION"
  | "BLOCKED_CALCULATION_NOT_IMPLEMENTED"
  | "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE"
  | "BLOCKED_CODE_RESOLUTION"
  | "BLOCKED_DOMAIN_OR_MODEL_INVALID"
  | "INVALID_READINESS_REQUEST";

/**
 * Entrée structurée pour évaluer la préparation (Readiness) d'un système ou tronçon
 * de pipeline gaz vis-à-vis d'ASME B31.8 (ARCH-11).
 *
 * INTERDICTIONS STRICTES (ARCH-11 §3.A) :
 * - Aucun champ `clientName`, `projectTitle`, `materialLabel`, `commercialLicense`, `licenseTier`, etc.
 *   ne peut être utilisé pour déduire le code applicable.
 */
export interface B31_8PipelineReadinessRequest {
  /** Système de pipeline structuré issu d'ARCH-10 */
  readonly system: PipelineSystem;
  /** Identifiant optionnel d'un tronçon spécifique du système à évaluer */
  readonly segmentId?: string;
  /** Identifiant explicite du code de conception (sinon résolu via traceabilityRefs du tronçon/système) */
  readonly explicitDesignCodeId?: DesignCodeId;
  /** Spécification de tuyauterie optionnelle */
  readonly pipingSpecId?: string;
  /** Code par défaut du projet optionnel */
  readonly projectDefaultDesignCodeId?: DesignCodeId;
  /** Édition normative demandée (ex: { year: "2022" }) */
  readonly requestedEdition?: StandardEdition;
  /** Type de calcul d'ingénierie envisagé (ex: "PRESSURE_WALL_THICKNESS", "HOOP_STRESS", "ALLOWABLE_PRESSURE") */
  readonly requestedCalculationType?: EngineeringCalculationType;
  /** Système d'unités envisagé ("SI" | "US_CUSTOMARY") */
  readonly unitSystem?: EngineeringUnitSystem;
  /** Identifiants de preuves normatives explicites */
  readonly evidenceIds?: readonly string[];
}

/**
 * Étape 1 : Identification du domaine d'ingénierie et du contexte gaz du modèle Pipeline.
 */
export interface B31_8Stage1DomainIdentificationReport {
  readonly domainIdentified: boolean;
  readonly engineeringDomain?: EngineeringDomainId;
  readonly systemId?: string;
  readonly segmentId?: string;
  readonly modelStructurallyValid: boolean;
  readonly effectiveService?: PipelineServiceFluidDeclaration;
  readonly effectiveFluidCategory?: PipelineFluidCategory;
  readonly gasServiceStatus: B31_8GasServiceReadinessStatus;
  readonly declaredClassLocation?: 1 | 2 | 3 | 4;
  readonly declaredDesignFactorF?: number;
}

/**
 * Étape 2 : Identification du code de conception et de l'édition via Multi-Code Resolver.
 */
export interface B31_8Stage2CodeAndEditionIdentificationReport {
  readonly resolutionStatus: MultiCodeResolutionStatus;
  readonly isB31_8Resolved: boolean;
  readonly resolvedDesignCodeId?: DesignCodeId;
  readonly resolvedStandard?: NormativeStandard;
  readonly identifiedEdition?: StandardEdition;
  readonly crossCodeSubstitutionAttempted: boolean;
  readonly multiCodeResolution: MultiCodeResolutionResult;
}

/**
 * Étape 3 : Statut des preuves normatives et du document source ASME B31.8.
 */
export interface B31_8Stage3NormativeEvidenceReport {
  readonly editionEvidenceReport: DesignCodeEditionEvidenceReport;
  readonly referenceSourceDocumentId: string;
  readonly referenceSourceDocumentStatus: NormativeVerificationStatus | "NOT_FOUND";
  readonly isAuthoritativeSourceVerified: boolean;
  readonly isEditionEvidenceVerified: boolean;
}

/**
 * Étape 4 : Statut de qualification normative des règles/formules de calcul ASME B31.8.
 */
export interface B31_8Stage4CalculationQualificationReport {
  readonly qualificationStatus: DesignCodeNormativeQualificationStatus;
  readonly isCalculationQualified: boolean;
  readonly qualifiedFormulaCount: number;
}

/**
 * Étape 5 : Disponibilité réelle de la capacité de calcul dans DESIGN_CODE_CALCULATION_REGISTRY.
 */
export interface B31_8Stage5CalculationAvailabilityReport {
  readonly codeSupportStatus?: DesignCodeSupportStatus;
  readonly requestedCalculationType?: EngineeringCalculationType;
  readonly availabilityStatus: CalculationCapabilityAvailabilityStatus;
  readonly supportedCalculationTypes: readonly EngineeringCalculationType[];
  readonly isCalculationAvailable: boolean;
}

/**
 * Étape 6 : Garde d'exécution numérique (Numerical Execution Gate).
 */
export interface B31_8Stage6NumericalExecutionGateReport {
  readonly canExecuteNumericalCalculation: boolean;
  readonly executionPerformed: false;
  readonly blockedReasonCode?: string;
  readonly blockedReasonMessage?: string;
}

/**
 * Résultat complet, immuable et auditable de l'évaluation des 6 étapes ARCH-11 pour ASME B31.8.
 */
export interface B31_8PipelineReadinessResult {
  readonly status: B31_8PipelineReadinessStatus;
  readonly stage1DomainIdentification: B31_8Stage1DomainIdentificationReport;
  readonly stage2CodeIdentification: B31_8Stage2CodeAndEditionIdentificationReport;
  readonly stage3NormativeEvidence: B31_8Stage3NormativeEvidenceReport;
  readonly stage4CalculationQualification: B31_8Stage4CalculationQualificationReport;
  readonly stage5CalculationAvailability: B31_8Stage5CalculationAvailabilityReport;
  readonly stage6NumericalExecutionGate: B31_8Stage6NumericalExecutionGateReport;
  readonly diagnosticCodes: readonly string[];
  readonly messages: readonly string[];
}

/**
 * Résultat de l'exécution contrôlée d'un calcul sur un pipeline ASME B31.8 (Étape 6).
 * Combine le rapport de préparation en 6 étapes et le résultat d'exécution (ou de blocage `NOT_IMPLEMENTED` / `INVALID_INPUT`).
 */
export interface B31_8GuardedCalculationExecutionResult {
  readonly readiness: B31_8PipelineReadinessResult;
  readonly calculationExecuted: boolean;
  readonly calculationResult: EngineeringCalculationResult;
}

export type {
  CalculationStatus,
  EngineeringCalculationInput,
  EngineeringCalculationResult,
  PipelineSegment,
  PipelineSystem,
};
