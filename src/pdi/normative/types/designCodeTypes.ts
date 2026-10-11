/**
 * PDI NORMATIVE ENGINE — DESIGN CODE TYPES
 * Reference: PATCH NORM-08 (Design Code Engine / Engineering Calculation Foundation)
 * 
 * Modèle typé, déterministe et immuable pour l'exécution et la traçabilité
 * des calculs d'ingénierie selon les codes de conception.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - NORM-08 ne contient AUCUNE formule inventée, constante inventée, coefficient inventé,
 *   ou facteur de sécurité inventé.
 * - Tout calcul doit être traçable, déterministe et sourcé.
 * - En l'absence de formule vérifiée/licenciée complète avec domaine de validité documenté,
 *   le statut DOIT être NOT_IMPLEMENTED ou UNVERIFIED.
 * - AUCUN statut COMPLIANT n'est émis ici (réservé exclusivement à NORM-09).
 */

import type {
  DesignCodeId,
  StandardEdition,
} from "./normativeCoreTypes";
import type {
  NormativeEvidence,
  NormativeEvidenceSourceType,
  NormativeVerifiedValue,
} from "./normativeEvidenceTypes";

/**
 * Codes de conception initiaux enregistrés dans NORM-01.
 */
export type SupportedDesignCodeId =
  | "ASME-B31.3"
  | "ASME-B31.4"
  | "ASME-B31.8"
  | "ASME-B31.12"
  | "EN-13480"
  | "ISO-13623";

/**
 * Statut de support d'un code de conception dans le moteur.
 */
export type DesignCodeSupportStatus =
  | "SUPPORTED"
  | "PARTIAL"
  | "UNVERIFIED"
  | "NOT_IMPLEMENTED";

/**
 * Vocabulaire typé pour les types de calculs d'ingénierie.
 */
export type EngineeringCalculationType =
  | "PRESSURE_WALL_THICKNESS"
  | "ALLOWABLE_PRESSURE"
  | "HOOP_STRESS"
  | "TEST_PRESSURE"
  | "OTHER";

/**
 * Statut d'exécution et de qualification d'un calcul d'ingénierie.
 * Note: COMPLIANT est strictement interdit dans NORM-08.
 */
export type CalculationStatus =
  | "CALCULATED"
  | "UNVERIFIED"
  | "NOT_IMPLEMENTED"
  | "INVALID_INPUT"
  | "OUT_OF_SCOPE";

/**
 * Système d'unités explicite pour les calculs d'ingénierie.
 */
export type EngineeringUnitSystem = "SI" | "US_CUSTOMARY";

/**
 * Statut de qualification et de licence d'une formule normative.
 */
export type DesignCodeFormulaStatus =
  | "VERIFIED"
  | "LICENSED"
  | "UNVERIFIED"
  | "NOT_IMPLEMENTED";

/**
 * Contrat d'unités explicite attendu par une formule normative.
 */
export interface FormulaUnitContract {
  readonly unitSystem?: EngineeringUnitSystem;
  readonly pressureUnit?: string;
  readonly diameterUnit?: string;
  readonly thicknessUnit?: string;
  readonly temperatureUnit?: string;
  readonly stressUnit?: string;
  readonly outputUnit?: string;
}

/**
 * Régime ou domaine géométrique/physique d'une formule.
 */
export type FormulaRegime = "THIN_WALL" | "THICK_WALL" | "HIGH_TEMP" | "ALL";

/**
 * Domaine de validité et limites d'utilisation d'une formule.
 */
export interface FormulaDomain {
  readonly regime?: FormulaRegime;
  readonly minimumPressure?: number;
  readonly maximumPressure?: number;
  readonly minimumTemperature?: number;
  readonly maximumTemperature?: number;
  readonly minimumDiameterMm?: number;
  readonly maximumDiameterMm?: number;
  readonly minimumThicknessMm?: number;
  readonly maximumThicknessMm?: number;
  readonly applicableDesignCodes?: readonly DesignCodeId[];
}

/**
 * Traçabilité et statut d'une formule normative.
 */
export interface DesignCodeFormulaReference {
  readonly id: string;
  readonly designCodeId: DesignCodeId;
  readonly standardEdition?: StandardEdition;
  readonly calculationType?: EngineeringCalculationType;
  readonly clauseReference?: string;
  readonly sourceReference?: string;
  readonly status: DesignCodeFormulaStatus;
  readonly domain?: FormulaDomain;
  readonly units?: FormulaUnitContract;
}

/**
 * Décision d'interface PDI pour l'arbitrage de la base dimensionnelle.
 * Non issue d'une prescription textuelle ASME, mais nécessaire pour
 * sélectionner de façon déterministe entre Eq. (3a) et Eq. (3b).
 */
export type DiameterBasis = "OUTSIDE" | "INSIDE";

/**
 * Métadonnées de qualification et traçabilité pour la contrainte admissible S.
 */
export interface NormativeStressInput {
  readonly verifiedValue?: NormativeVerifiedValue<number>;
  readonly value: number;
  readonly unit?: string;
  readonly materialReference?: string;
  readonly temperature?: number;
  readonly sourceReference?: string;
  readonly qualificationStatus?: DesignCodeFormulaStatus;
  readonly evidenceIds?: readonly string[];
}

/**
 * Métadonnées de qualification et traçabilité pour le facteur de joint E.
 */
export interface NormativeQualityFactorInput {
  readonly verifiedValue?: NormativeVerifiedValue<number>;
  readonly factorValue: number;
  readonly productSpecification?: string;
  readonly jointType?: string;
  readonly examinationLevel?: string;
  readonly applicableTable?: string;
  readonly sourceReference?: string;
  readonly qualificationStatus?: DesignCodeFormulaStatus;
  readonly selectionContext?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Identifiants stricts des branches du facteur de réduction de soudure W.
 * Conforme à ASME B31.3 Table 302.3.5-1 et rapport de qualification F01.
 */
export type WeldReductionBranchId =
  | "W-01"
  | "W-02"
  | "W-03"
  | "W-04"
  | "W-05"
  | "W-06"
  | "W-07"
  | "W-08"
  | "W-09";

/**
 * Métadonnées de qualification et traçabilité pour le facteur de réduction W.
 */
export interface NormativeWeldReductionFactorInput {
  readonly verifiedValue?: NormativeVerifiedValue<number>;
  readonly branchId?: WeldReductionBranchId | string;
  readonly factorValue: number;
  readonly materialGroup?: string;
  readonly designTemperature?: number;
  readonly temperature?: number;
  readonly isCreepRegime?: boolean;
  readonly componentType?: "SEAMLESS" | "WELDED";
  readonly materialFamily?: "FERRITIC" | "AUSTENITIC" | "OTHER";
  readonly serviceHours?: number;
  readonly applicability?: string;
  readonly sourceReference?: string;
  readonly qualificationStatus?: DesignCodeFormulaStatus;
  readonly selectionContext?: string;
  readonly hasQualifiedContextGrid?: boolean;
  readonly evidenceIds?: readonly string[];
}

/**
 * Métadonnées de qualification et traçabilité pour le coefficient Y.
 */
export interface NormativeYCoefficientInput {
  readonly verifiedValue?: NormativeVerifiedValue<number>;
  readonly factorValue: number;
  readonly materialFamily?: string;
  readonly temperature?: number;
  readonly applicableRegime?: string;
  readonly sourceReference?: string;
  readonly qualificationStatus?: DesignCodeFormulaStatus;
  readonly branchId?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Facteur normatif résolu et tracé dans le résultat de calcul.
 */
export interface ResolvedNormativeFactor {
  readonly name: string;
  readonly value: number;
  readonly contractVerified: boolean;
  readonly valueVerified: boolean;
  readonly sourceReference?: string;
  readonly clauseReference?: string;
  readonly notes?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Paramètres d'entrée pour un calcul d'ingénierie selon code de conception.
 */
export interface EngineeringCalculationInput {
  readonly designCodeId: DesignCodeId;
  readonly calculationType: EngineeringCalculationType;
  readonly standardEdition?: StandardEdition;

  readonly pressure?: number;
  readonly temperature?: number;

  readonly outsideDiameterMm?: number;
  readonly insideDiameterMm?: number;
  readonly wallThicknessMm?: number;
  readonly diameterBasis?: DiameterBasis;

  readonly materialId?: string;
  readonly allowableStressMpa?: number;
  readonly allowableStressInput?: NormativeStressInput;

  readonly corrosionAllowanceMm?: number;

  readonly weldJointFactor?: number;
  readonly qualityFactorInput?: NormativeQualityFactorInput;

  readonly weldReductionFactor?: number;
  readonly weldReductionFactorInput?: NormativeWeldReductionFactorInput;

  readonly yCoefficient?: number;
  readonly yCoefficientInput?: NormativeYCoefficientInput;

  readonly componentType?: "SEAMLESS" | "WELDED";
  readonly materialFamily?: "FERRITIC" | "AUSTENITIC" | "OTHER";

  readonly designFactor?: number;

  readonly unitSystem: EngineeringUnitSystem;

  readonly evidenceIds?: readonly string[];
  readonly evidenceItems?: readonly NormativeEvidence[];
}

/**
 * Contexte de calcul (optionnel, pour l'ancrage projet et spécification).
 */
export interface EngineeringCalculationContext {
  readonly projectId?: string;
  readonly pipingSpecificationId?: string;
  readonly designCodeId: DesignCodeId;
  readonly standardEdition?: StandardEdition;
  readonly materialId?: string;
  readonly unitSystem: EngineeringUnitSystem;
}

/**
 * Résultat immuable, auditable et traçable d'un calcul d'ingénierie.
 */
export interface EngineeringCalculationResult {
  readonly status: CalculationStatus;
  readonly calculationType: EngineeringCalculationType;
  readonly designCodeId: DesignCodeId;
  readonly standardEdition?: StandardEdition;

  readonly formulaId?: string;
  readonly clauseReference?: string;
  readonly sourceReference?: string;
  readonly diameterBasis?: DiameterBasis;

  readonly value?: number;
  readonly minimumRequiredThicknessMm?: number;
  readonly unit?: string;

  readonly inputs: Readonly<Record<string, number | string | undefined>>;
  readonly resolvedFactors?: Readonly<Record<string, ResolvedNormativeFactor>>;

  readonly formulaReference?: DesignCodeFormulaReference;
  readonly domain?: FormulaDomain;

  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly evidenceIds?: readonly string[];
}

/**
 * Fiche d'enregistrement d'un code de conception dans le registre de calcul.
 */
export interface DesignCodeRegistryEntry {
  readonly id: DesignCodeId;
  readonly status: DesignCodeSupportStatus;
  readonly supportedCalculationTypes: readonly EngineeringCalculationType[];
  readonly formulaReferences: readonly DesignCodeFormulaReference[];
}
