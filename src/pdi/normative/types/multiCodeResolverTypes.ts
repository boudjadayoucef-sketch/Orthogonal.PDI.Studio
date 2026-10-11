/**
 * PDI NORMATIVE ENGINE — MULTI-CODE RESOLVER TYPES
 * Reference: ARCH-09 (Multi-Code Resolver)
 *
 * Modèle typé, explicite, immuable et déterministe pour la résolution multi-code
 * d'un code de conception (Design Code) à partir d'un domaine d'ingénierie,
 * d'un contexte projet ou d'une spécification de tuyauterie.
 *
 * RÈGLES ARCHITECTURALES ABSOLUES (ARCH-09) :
 * 1. Séparation étanche des 5 niveaux :
 *    (1) Identification du code de conception applicable (CANDIDATE -> RESOLVED).
 *    (2) Vérification de l'édition normative et de ses preuves (NormativeEvidence).
 *    (3) Qualification normative des formules et clauses.
 *    (4) Disponibilité réelle de la capacité de calcul dans le moteur.
 *    (5) Exécution effective d'un calcul (réservée exclusivement à executeEngineeringCalculation).
 * 2. Zéro heuristique :
 *    - Ne résout JAMAIS un code à partir d'un nom de client, d'une chaîne libre,
 *      d'un token heuristique ou d'une déduction implicite.
 * 3. Refus strict d'arbitrage silencieux :
 *    - Si plusieurs codes candidats sont identifiés sans sélection explicite ou
 *      sans accord unanime des sources structurées -> AMBIGUOUS.
 * 4. Préservation inviolable des statuts du registre de calcul (NORM-08).
 */

import type { EngineeringDomainId } from "../../engineering/types/engineeringDomainTypes";
import type {
  DesignCodeId,
  NormativeStandard,
  StandardEdition,
} from "./normativeCoreTypes";
import type {
  DesignCodeFormulaReference,
  DesignCodeSupportStatus,
  EngineeringCalculationType,
  EngineeringUnitSystem,
} from "./designCodeTypes";
import type {
  EvidenceSetResolutionResult,
  NormativeVerificationStatus,
} from "./normativeEvidenceTypes";

/**
 * Décision explicite de résolution multi-code (ARCH-09 §4).
 * - RESOLVED : Un code de conception unique, valide et de type DESIGN_CODE a été identifié sans conflit.
 * - AMBIGUOUS : Plusieurs codes candidats non départagés ou contradictoires ont été identifiés.
 * - INSUFFICIENT_DATA : Les données structurées fournies ne permettent pas d'identifier un code unique.
 * - UNSUPPORTED_CODE : Le code identifié est inconnu du référentiel, n'est pas un DESIGN_CODE,
 *                      ou est incompatible avec le domaine d'ingénierie déclaré.
 * - INVALID_CONTEXT : Le contexte fourni est malformé, contient des valeurs invalides ou des tokens heuristiques.
 */
export type MultiCodeResolutionStatus =
  | "RESOLVED"
  | "AMBIGUOUS"
  | "INSUFFICIENT_DATA"
  | "UNSUPPORTED_CODE"
  | "INVALID_CONTEXT";

/**
 * Source structurée et vérifiable d'où provient l'identification du code.
 */
export type DesignCodeResolutionSource =
  | "EXPLICIT_DESIGN_CODE"
  | "PIPING_SPECIFICATION"
  | "PROJECT_NORMATIVE_REF"
  | "DOMAIN_SINGLE_REGISTERED_CANDIDATE"
  | "NONE";

/**
 * Statut de vérification de l'édition et de ses preuves normatives (Étape 2).
 * Une édition présente dans un registre sans preuve NormativeEvidence VERIFIED reste UNVERIFIED.
 */
export type DesignCodeEditionVerificationStatus =
  | "VERIFIED"
  | "UNVERIFIED"
  | "MISSING_EDITION";

/**
 * Statut de qualification normative du code et de ses références de formules (Étape 3).
 */
export type DesignCodeNormativeQualificationStatus =
  | "QUALIFIED"
  | "PARTIALLY_QUALIFIED"
  | "UNVERIFIED"
  | "NOT_QUALIFIED";

/**
 * Statut de disponibilité réelle d'une capacité de calcul dans le moteur (Étape 4).
 */
export type CalculationCapabilityAvailabilityStatus =
  | "AVAILABLE"
  | "UNVERIFIED_UNIT_SYSTEM"
  | "EDITION_MISMATCH"
  | "FORMULA_UNVERIFIED"
  | "NOT_IMPLEMENTED"
  | "NOT_EVALUATED"
  | "CODE_NOT_RESOLVED";

/**
 * Contexte d'entrée structuré pour le resolver multi-code (ARCH-09 §4).
 * Noter que les champs informels (clientName, freeTextNotes, etc.) sont
 * explicitement inspectés par le validateur afin d'interdire toute sélection heuristique.
 */
export interface MultiCodeResolutionContext {
  /** Domaine d'ingénierie issu d'ARCH-08 ("PIPING" | "PIPELINE" | "PACKAGE" | "EQUIPMENT") */
  readonly engineeringDomain?: EngineeringDomainId;

  /** Identifiant explicite du code de conception demandé */
  readonly explicitDesignCodeId?: DesignCodeId;

  /** Identifiant d'une spécification de tuyauterie (résolue via registre ou lookup structuré) */
  readonly pipingSpecId?: string;

  /** Référence normative déclarée au niveau du projet (PdiProjectContext.normativeRefs.defaultDesignCodeId) */
  readonly projectDefaultDesignCodeId?: DesignCodeId;

  /** Liste explicite de codes candidats restreints par un contexte amont */
  readonly candidateDesignCodeIds?: readonly DesignCodeId[];

  /** Édition normative explicitement demandée (ex: { year: "2024" }) */
  readonly requestedEdition?: StandardEdition;

  /** Capacité de calcul d'ingénierie demandée (ex: "PRESSURE_WALL_THICKNESS") */
  readonly requestedCalculationType?: EngineeringCalculationType;

  /** Système d'unités demandé pour vérifier le contrat d'unité de la formule */
  readonly unitSystem?: EngineeringUnitSystem;

  /** Identifiants de preuves normatives (NormativeEvidence) associées au contexte */
  readonly evidenceIds?: readonly string[];

  /**
   * Si true (défaut: true lorsque engineeringDomain est fourni), exige que le code résolu
   * soit déclaré parmi les références applicables du domaine d'ingénierie.
   */
  readonly enforceDomainCompatibility?: boolean;
}

/**
 * Trace d'évaluation d'un code candidat individuel lors de la résolution.
 */
export interface DesignCodeCandidateTrace {
  readonly codeId: string;
  readonly isRegisteredStandard: boolean;
  readonly isDesignCodeType: boolean;
  readonly isRegisteredInCalculationEngine: boolean;
  readonly isDeclaredInDomain: boolean;
  readonly implementationStatus?: DesignCodeSupportStatus;
  readonly sources: readonly DesignCodeResolutionSource[];
  readonly rejectionReason?: string;
}

/**
 * Rapport détaillé sur l'édition et les preuves normatives associées (Étape 2).
 */
export interface DesignCodeEditionEvidenceReport {
  readonly effectiveEdition?: StandardEdition;
  readonly standardRegistryEdition?: StandardEdition;
  readonly formulaEditions: readonly StandardEdition[];
  readonly editionVerificationStatus: DesignCodeEditionVerificationStatus;
  readonly evidenceIds: readonly string[];
  readonly verifiedEvidenceIds: readonly string[];
  readonly evidenceResolution?: EvidenceSetResolutionResult;
}

/**
 * Rapport de disponibilité réelle de calcul pour le code identifié (Étape 4).
 */
export interface DesignCodeCalculationAvailabilityReport {
  readonly requestedCalculationType?: EngineeringCalculationType;
  readonly requestedUnitSystem?: EngineeringUnitSystem;
  readonly codeSupportStatus?: DesignCodeSupportStatus;
  readonly supportedCalculationTypes: readonly EngineeringCalculationType[];
  readonly availabilityStatus: CalculationCapabilityAvailabilityStatus;
  /** Indique sans ambiguïté si le code identifié est utilisable pour la capacité de calcul demandée */
  readonly isUsableForRequestedCalculation: boolean;
  readonly matchedFormulaReference?: DesignCodeFormulaReference;
  readonly qualificationStatus: DesignCodeNormativeQualificationStatus;
  readonly reasons: readonly string[];
}

/**
 * Résultat immuable, déterministe et auditable du Multi-Code Resolver (ARCH-09 §4).
 */
export interface MultiCodeResolutionResult {
  /** Décision explicite de résolution */
  readonly status: MultiCodeResolutionStatus;

  /** Domaine d'ingénierie évalué (si fourni) */
  readonly engineeringDomain?: EngineeringDomainId;

  /** Code de conception résolu (uniquement si status === "RESOLVED") */
  readonly resolvedDesignCodeId?: DesignCodeId;

  /** Fiche normative issue de PDI_STANDARDS_REGISTRY (si résolu) */
  readonly resolvedStandard?: NormativeStandard;

  /** Source structurée ayant permis la résolution */
  readonly resolutionSource: DesignCodeResolutionSource;

  /** Statut réel d'implémentation dans DESIGN_CODE_CALCULATION_REGISTRY (PARTIAL, NOT_IMPLEMENTED, etc.) */
  readonly implementationStatus?: DesignCodeSupportStatus;

  /** Indique clairement si le code résolu est utilisable pour la capacité de calcul demandée */
  readonly isUsableForCalculation: boolean;

  /** Liste triée et dédupliquée des codes candidats évalués */
  readonly candidateCodeIds: readonly DesignCodeId[];

  /** Liste triée des codes candidats valides en compétition (ex: en cas d'AMBIGUOUS) */
  readonly competingValidCodeIds: readonly DesignCodeId[];

  /** Traces détaillées de chaque candidat évalué */
  readonly candidateTraces: readonly DesignCodeCandidateTrace[];

  /** Rapport sur l'édition et les preuves (Étape 2) */
  readonly editionReport: DesignCodeEditionEvidenceReport;

  /** Rapport sur la qualification normative et la disponibilité de calcul (Étapes 3 & 4) */
  readonly calculationAvailability: DesignCodeCalculationAvailabilityReport;

  /** Codes de diagnostic ou de conflit explicites */
  readonly diagnosticCodes: readonly string[];

  /** Messages d'audit explicites */
  readonly messages: readonly string[];
}
