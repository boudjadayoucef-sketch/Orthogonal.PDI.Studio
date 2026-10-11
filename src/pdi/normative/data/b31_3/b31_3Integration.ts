/**
 * PDI NORMATIVE ENGINE — ASME B31.3 CONTROLLED INTEGRATION BOUNDARY
 * Reference: B31.3-04 (Controlled Normative Integration Boundary)
 * 
 * Frontière d'intégration contrôlée reliant de bout en bout :
 *   B31.3 SourceDocument (FOUND_VERIFIED)
 *             ↓
 *      B31.3 Evidence (FOUND_VERIFIED)
 *             ↓
 *    B31.3 Qualification (QUALIFIED)
 *             ↓
 *  B31_3NormativeDataRecord (VERIFIED)
 *             ↓
 *   NormativeVerifiedValue<T> (VERIFIED)
 *             ↓
 *   NormativeCalculationBoundary (F01 / future calculations)
 * 
 * RÈGLES ARCHITECTURALES STRICTES (B31.3-04) :
 * 1. AUCUNE INVENTION NORMATIVE :
 *    - Aucune valeur numérique ASME B31.3 n'est inventée, déduite, extrapolée ou supposée.
 * 2. RESPECT INVIOLABLE DU PIPELINE DE TRAÇABILITÉ :
 *    - Ne contourne JAMAIS EvidenceRegistry, EvidenceResolver, VerifiedValueValidator ou CalculationBoundary.
 * 3. ÉTANCHÉITÉ DES STATUTS :
 *    - Une donnée UNVERIFIED ne traverse JAMAIS le CalculationBoundary comme valeur vérifiée.
 *    - Aucun token heuristique n'est admis.
 * 4. PURETÉ ET DÉTERMINISME :
 *    - Fonctions pures et immuables.
 */

import type {
  B31_3IntegrationRequest,
  B31_3IntegrationResult,
  B31_3IntegrationStatus,
  B31_3F01ResolutionResult,
} from "./b31_3DataTypes";
import type {
  NormativeStressInput,
  NormativeQualityFactorInput,
  NormativeWeldReductionFactorInput,
  NormativeYCoefficientInput,
} from "../../types/designCodeTypes";
import type { NormativeEvidence } from "../../types/normativeEvidenceTypes";
import type { IB31_3DataResolver } from "./b31_3DataResolver";
import { defaultB31_3DataResolver } from "./b31_3DataResolver";
import type { INormativeSourceDocumentResolver } from "../../registry/normativeSourceDocumentResolver";
import { defaultSourceDocumentResolver } from "../../registry/normativeSourceDocumentResolver";
import {
  defaultEvidenceResolver,
  NormativeEvidenceResolver,
} from "../../registry/normativeEvidenceResolver";
import { isDisallowedTokenHeuristic } from "../../validators/normativeEvidenceValidator";
import { validateB31_3DataRecordGovernance } from "./b31_3DataValidator";
import { validateNormativeVerifiedValue } from "../../validators/normativeVerifiedValueValidator";
import type { NormativeVerifiedValue } from "../../types/normativeEvidenceTypes";
import {
  resolveNormativeCalculationInput,
  type NormativeCalculationBoundaryInput,
  type NormativeCalculationBoundaryResult,
} from "../../validators/normativeCalculationBoundary";

export interface B31_3IntegrationOptions {
  readonly dataResolver?: IB31_3DataResolver;
  readonly sourceDocResolver?: INormativeSourceDocumentResolver;
  readonly evidenceResolver?: NormativeEvidenceResolver;
}

export interface B31_3CalculationBoundaryIntegrationResult<T> {
  readonly integrationResult: B31_3IntegrationResult<T>;
  readonly boundaryInput?: NormativeCalculationBoundaryInput<T>;
  readonly boundaryResult: NormativeCalculationBoundaryResult<T>;
}

/**
 * Intègre une donnée B31.3 en vérifiant la chaîne de traçabilité complète
 * et en construisant une NormativeVerifiedValue<T> qualifiée pour la frontière de calcul.
 */
export function integrateB31_3Data<T = unknown>(
  request: B31_3IntegrationRequest,
  options?: B31_3IntegrationOptions
): B31_3IntegrationResult<T> {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return {
      status: "INVALID",
      dataId: "",
      message: "Integration request must be a valid non-null object.",
    };
  }

  const rawDataId = request.dataId;
  if (typeof rawDataId !== "string" || rawDataId.trim().length === 0) {
    return {
      status: "INVALID",
      dataId: String(rawDataId ?? ""),
      message: "dataId must be a non-empty string.",
    };
  }

  const dataId = rawDataId.trim();

  // Contrôle des tokens heuristiques interdits
  if (isDisallowedTokenHeuristic(dataId)) {
    return {
      status: "INVALID",
      dataId,
      message: `Token '${dataId}' is a heuristic/identifier and cannot be resolved as normative data.`,
    };
  }

  const dataResolver = options?.dataResolver ?? defaultB31_3DataResolver;
  const sourceDocResolver =
    options?.sourceDocResolver ?? defaultSourceDocumentResolver;
  const evidenceResolver =
    options?.evidenceResolver ?? defaultEvidenceResolver;

  // 1. Résolution de l'enregistrement dans le registre de données B31.3
  const dataRes = dataResolver.resolveData<T>(dataId);

  if (dataRes.status === "NOT_FOUND") {
    return {
      status: "NOT_FOUND",
      dataId,
      message: `Normative data record with id '${dataId}' was not found in B31.3 registry.`,
    };
  }

  if (dataRes.status === "INVALID" || !dataRes.record) {
    return {
      status: "INVALID",
      dataId,
      message:
        dataRes.message ??
        `Normative data record '${dataId}' is structurally invalid.`,
    };
  }

  const record = dataRes.record;

  // 2. Validation de gouvernance stricte (SourceDocument + Evidence)
  const govValidation = validateB31_3DataRecordGovernance(
    record,
    sourceDocResolver,
    evidenceResolver
  );

  if (!govValidation.valid) {
    return {
      status: "INVALID",
      dataId,
      message: `Governance validation failed for data record '${dataId}': ${govValidation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ")}`,
    };
  }

  // 3. Traitement selon le statut (UNVERIFIED vs VERIFIED)
  if (record.status === "UNVERIFIED") {
    const unverifiedValue: NormativeVerifiedValue<T> = Object.freeze({
      value: record.value,
      verificationStatus: "UNVERIFIED",
      evidenceIds: Object.freeze([record.evidenceId]),
      sourceReference: `${record.standardId} ${record.editionId} §${record.clauseReference}`,
    });

    return {
      status: "UNVERIFIED",
      dataId,
      value: record.value,
      standardId: record.standardId,
      editionId: record.editionId,
      sourceDocumentId: record.sourceDocumentId,
      evidenceId: record.evidenceId,
      clauseReference: record.clauseReference,
      verifiedValue: unverifiedValue,
      message: `Normative data record '${dataId}' has UNVERIFIED status and cannot be used as verified calculation baseline.`,
    };
  }

  // Statut VERIFIED : Vérifier la validité de la preuve documentaire
  const docRes = sourceDocResolver.resolveDocument(record.sourceDocumentId);
  const evRes = evidenceResolver.resolveEvidence(record.evidenceId);

  if (
    docRes.status !== "FOUND_VERIFIED" ||
    evRes.status !== "FOUND_VERIFIED"
  ) {
    return {
      status: "UNVERIFIED",
      dataId,
      value: record.value,
      standardId: record.standardId,
      editionId: record.editionId,
      sourceDocumentId: record.sourceDocumentId,
      evidenceId: record.evidenceId,
      clauseReference: record.clauseReference,
      message: `Normative data record '${dataId}' references unverified source document or evidence chain.`,
    };
  }

  // 4. Construction de la NormativeVerifiedValue<T> certifiée
  const verifiedValue: NormativeVerifiedValue<T> = Object.freeze({
    value: record.value,
    verificationStatus: "VERIFIED",
    evidenceIds: Object.freeze([record.evidenceId]),
    sourceReference: `${record.standardId} ${record.editionId} §${record.clauseReference}`,
  });

  // Validation finale avec le validateur canonique de NormativeVerifiedValue
  const vvValidation = validateNormativeVerifiedValue<T>(
    verifiedValue,
    evidenceResolver
  );

  if (!vvValidation.valid || !vvValidation.verified) {
    return {
      status: "INVALID",
      dataId,
      message: `NormativeVerifiedValue validation rejected: ${vvValidation.errors
        .map((e) => e.message)
        .join("; ")}`,
    };
  }

  return {
    status: "RESOLVED_VERIFIED",
    dataId,
    value: record.value,
    standardId: record.standardId,
    editionId: record.editionId,
    sourceDocumentId: record.sourceDocumentId,
    evidenceId: record.evidenceId,
    clauseReference: record.clauseReference,
    verifiedValue,
    message: "B31.3 data record successfully resolved and verified for normative calculations.",
  };
}

/**
 * Crée un input prêt pour la frontière de calcul (NormativeCalculationBoundary)
 * à partir d'une requête B31.3.
 */
export function createB31_3CalculationBoundaryInput<T = unknown>(
  name: string,
  request: B31_3IntegrationRequest,
  options?: B31_3IntegrationOptions
): {
  boundaryInput?: NormativeCalculationBoundaryInput<T>;
  integrationResult: B31_3IntegrationResult<T>;
} {
  const integrationResult = integrateB31_3Data<T>(request, options);

  if (
    integrationResult.status === "RESOLVED_VERIFIED" &&
    integrationResult.verifiedValue
  ) {
    return {
      integrationResult,
      boundaryInput: {
        name,
        verifiedValue: integrationResult.verifiedValue,
      },
    };
  }

  return {
    integrationResult,
    boundaryInput: undefined,
  };
}

/**
 * Résout une donnée B31.3 directement à travers la frontière de calcul (NormativeCalculationBoundary).
 * Si la donnée n'est pas vérifiée, la frontière rejette l'évaluation de façon étanche.
 */
export function resolveB31_3ToCalculationBoundary<T = unknown>(
  name: string,
  request: B31_3IntegrationRequest,
  options?: B31_3IntegrationOptions
): B31_3CalculationBoundaryIntegrationResult<T> {
  const { boundaryInput, integrationResult } =
    createB31_3CalculationBoundaryInput<T>(name, request, options);

  const evidenceResolver =
    options?.evidenceResolver ?? defaultEvidenceResolver;

  if (!boundaryInput) {
    return {
      integrationResult,
      boundaryInput: undefined,
      boundaryResult: {
        valid: false,
        name,
        error:
          integrationResult.status === "NOT_FOUND"
            ? "DATA_NOT_FOUND"
            : integrationResult.status === "UNVERIFIED"
            ? "DATA_UNVERIFIED"
            : "DATA_INVALID",
      },
    };
  }

  const boundaryResult = resolveNormativeCalculationInput<T>(
    boundaryInput,
    evidenceResolver
  );

  return {
    integrationResult,
    boundaryInput,
    boundaryResult,
  };
}

/**
 * Raccorde une donnée B31.3 vérifiée vers la frontière de calcul F01.
 * Si la donnée n'est pas vérifiée, la valeur n'est jamais transmise comme valeur qualifiée.
 */
export function resolveB31_3ForF01<T = number>(
  name: string,
  request: B31_3IntegrationRequest,
  options?: B31_3IntegrationOptions
): B31_3F01ResolutionResult<T> {
  const boundaryCheck = resolveB31_3ToCalculationBoundary<T>(
    name,
    request,
    options
  );

  const integrationResult = boundaryCheck.integrationResult;

  if (
    integrationResult.status === "RESOLVED_VERIFIED" &&
    boundaryCheck.boundaryResult.valid &&
    integrationResult.verifiedValue
  ) {
    return {
      status: "RESOLVED_VERIFIED",
      integrationResult,
      verifiedValue: integrationResult.verifiedValue,
      message:
        "B31.3 verified data successfully qualified and resolved across calculation boundary for F01.",
    };
  }

  return {
    status: integrationResult.status,
    integrationResult,
    verifiedValue: undefined,
    message: integrationResult.message,
  };
}

/**
 * Prépare un NormativeStressInput pour F01 à partir d'une requête B31.3.
 */
export function createB31_3F01StressInput(
  request: B31_3IntegrationRequest,
  context: {
    materialReference: string;
    temperature: number;
    unit?: string;
  },
  options?: B31_3IntegrationOptions
): {
  stressInput?: NormativeStressInput;
  evidence?: NormativeEvidence;
  status: B31_3IntegrationStatus;
  message: string;
} {
  const resolution = resolveB31_3ForF01<number>("S", request, options);

  if (resolution.status === "RESOLVED_VERIFIED" && resolution.verifiedValue) {
    const evidenceResolver =
      options?.evidenceResolver ?? defaultEvidenceResolver;
    const evRes = evidenceResolver.resolveEvidence(
      resolution.integrationResult.evidenceId!
    );

    return {
      status: "RESOLVED_VERIFIED",
      stressInput: Object.freeze({
        verifiedValue: resolution.verifiedValue,
        value: resolution.verifiedValue.value,
        unit: context.unit ?? "MPa",
        materialReference: context.materialReference,
        temperature: context.temperature,
        sourceReference: resolution.verifiedValue.sourceReference,
        qualificationStatus: "VERIFIED" as const,
        evidenceIds: resolution.verifiedValue.evidenceIds,
      }),
      evidence: evRes.evidence,
      message:
        "NormativeStressInput successfully qualified from B31.3 verified data.",
    };
  }

  return {
    status: resolution.status,
    stressInput: undefined,
    evidence: undefined,
    message: resolution.message,
  };
}

/**
 * Prépare un NormativeQualityFactorInput pour F01 à partir d'une requête B31.3.
 */
export function createB31_3F01QualityFactorInput(
  request: B31_3IntegrationRequest,
  context?: {
    productSpecification?: string;
    jointType?: string;
  },
  options?: B31_3IntegrationOptions
): {
  qualityFactorInput?: NormativeQualityFactorInput;
  evidence?: NormativeEvidence;
  status: B31_3IntegrationStatus;
  message: string;
} {
  const resolution = resolveB31_3ForF01<number>("E", request, options);

  if (resolution.status === "RESOLVED_VERIFIED" && resolution.verifiedValue) {
    const evidenceResolver =
      options?.evidenceResolver ?? defaultEvidenceResolver;
    const evRes = evidenceResolver.resolveEvidence(
      resolution.integrationResult.evidenceId!
    );

    return {
      status: "RESOLVED_VERIFIED",
      qualityFactorInput: Object.freeze({
        verifiedValue: resolution.verifiedValue,
        factorValue: resolution.verifiedValue.value,
        productSpecification:
          context?.productSpecification ?? "B31.3-VERIFIED-SPEC",
        jointType: context?.jointType,
        sourceReference: resolution.verifiedValue.sourceReference,
        qualificationStatus: "VERIFIED" as const,
        evidenceIds: resolution.verifiedValue.evidenceIds,
      }),
      evidence: evRes.evidence,
      message:
        "NormativeQualityFactorInput successfully qualified from B31.3 verified data.",
    };
  }

  return {
    status: resolution.status,
    qualityFactorInput: undefined,
    evidence: undefined,
    message: resolution.message,
  };
}

/**
 * Prépare un NormativeWeldReductionFactorInput pour F01 à partir d'une requête B31.3.
 */
export function createB31_3F01WeldReductionFactorInput(
  request: B31_3IntegrationRequest,
  context?: {
    branchId?: string;
    componentType?: "SEAMLESS" | "WELDED";
    materialFamily?: "FERRITIC" | "AUSTENITIC" | "OTHER";
    temperature?: number;
    designTemperature?: number;
    hasQualifiedContextGrid?: boolean;
  },
  options?: B31_3IntegrationOptions
): {
  weldReductionFactorInput?: NormativeWeldReductionFactorInput;
  evidence?: NormativeEvidence;
  status: B31_3IntegrationStatus;
  message: string;
} {
  const resolution = resolveB31_3ForF01<number>("W", request, options);

  if (resolution.status === "RESOLVED_VERIFIED" && resolution.verifiedValue) {
    const evidenceResolver =
      options?.evidenceResolver ?? defaultEvidenceResolver;
    const evRes = evidenceResolver.resolveEvidence(
      resolution.integrationResult.evidenceId!
    );

    return {
      status: "RESOLVED_VERIFIED",
      weldReductionFactorInput: Object.freeze({
        verifiedValue: resolution.verifiedValue,
        factorValue: resolution.verifiedValue.value,
        branchId: context?.branchId ?? "W-01",
        componentType: context?.componentType ?? "SEAMLESS",
        materialFamily: context?.materialFamily,
        temperature: context?.temperature,
        designTemperature: context?.designTemperature ?? context?.temperature,
        hasQualifiedContextGrid: context?.hasQualifiedContextGrid,
        sourceReference: resolution.verifiedValue.sourceReference,
        qualificationStatus: "VERIFIED" as const,
        evidenceIds: resolution.verifiedValue.evidenceIds,
      }),
      evidence: evRes.evidence,
      message:
        "NormativeWeldReductionFactorInput successfully qualified from B31.3 verified data.",
    };
  }

  return {
    status: resolution.status,
    weldReductionFactorInput: undefined,
    evidence: undefined,
    message: resolution.message,
  };
}

/**
 * Prépare un NormativeYCoefficientInput pour F01 à partir d'une requête B31.3.
 */
export function createB31_3F01YCoefficientInput(
  request: B31_3IntegrationRequest,
  context?: {
    materialFamily?: string;
    temperature?: number;
  },
  options?: B31_3IntegrationOptions
): {
  yCoefficientInput?: NormativeYCoefficientInput;
  evidence?: NormativeEvidence;
  status: B31_3IntegrationStatus;
  message: string;
} {
  const resolution = resolveB31_3ForF01<number>("Y", request, options);

  if (resolution.status === "RESOLVED_VERIFIED" && resolution.verifiedValue) {
    const evidenceResolver =
      options?.evidenceResolver ?? defaultEvidenceResolver;
    const evRes = evidenceResolver.resolveEvidence(
      resolution.integrationResult.evidenceId!
    );

    return {
      status: "RESOLVED_VERIFIED",
      yCoefficientInput: Object.freeze({
        verifiedValue: resolution.verifiedValue,
        factorValue: resolution.verifiedValue.value,
        materialFamily: context?.materialFamily ?? "FERRITIC",
        temperature: context?.temperature ?? 100,
        sourceReference: resolution.verifiedValue.sourceReference,
        qualificationStatus: "VERIFIED" as const,
        evidenceIds: resolution.verifiedValue.evidenceIds,
      }),
      evidence: evRes.evidence,
      message:
        "NormativeYCoefficientInput successfully qualified from B31.3 verified data.",
    };
  }

  return {
    status: resolution.status,
    yCoefficientInput: undefined,
    evidence: undefined,
    message: resolution.message,
  };
}

/**
 * Classe de service d'intégration B31.3.
 */
export class B31_3Integration {
  constructor(
    private readonly dataResolver: IB31_3DataResolver = defaultB31_3DataResolver,
    private readonly sourceDocResolver: INormativeSourceDocumentResolver = defaultSourceDocumentResolver,
    private readonly evidenceResolver: NormativeEvidenceResolver = defaultEvidenceResolver
  ) {}

  public integrate<T = unknown>(
    request: B31_3IntegrationRequest
  ): B31_3IntegrationResult<T> {
    return integrateB31_3Data<T>(request, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public createCalculationInput<T = unknown>(
    name: string,
    request: B31_3IntegrationRequest
  ): {
    boundaryInput?: NormativeCalculationBoundaryInput<T>;
    integrationResult: B31_3IntegrationResult<T>;
  } {
    return createB31_3CalculationBoundaryInput<T>(name, request, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public resolveToCalculationBoundary<T = unknown>(
    name: string,
    request: B31_3IntegrationRequest
  ): B31_3CalculationBoundaryIntegrationResult<T> {
    return resolveB31_3ToCalculationBoundary<T>(name, request, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public resolveForF01<T = number>(
    name: string,
    request: B31_3IntegrationRequest
  ): B31_3F01ResolutionResult<T> {
    return resolveB31_3ForF01<T>(name, request, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public createF01StressInput(
    request: B31_3IntegrationRequest,
    context: {
      materialReference: string;
      temperature: number;
      unit?: string;
    }
  ) {
    return createB31_3F01StressInput(request, context, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public createF01QualityFactorInput(
    request: B31_3IntegrationRequest,
    context?: {
      productSpecification?: string;
      jointType?: string;
    }
  ) {
    return createB31_3F01QualityFactorInput(request, context, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public createF01WeldReductionFactorInput(
    request: B31_3IntegrationRequest,
    context?: {
      branchId?: string;
      componentType?: "SEAMLESS" | "WELDED";
      materialFamily?: "FERRITIC" | "AUSTENITIC" | "OTHER";
      temperature?: number;
      designTemperature?: number;
      hasQualifiedContextGrid?: boolean;
    }
  ) {
    return createB31_3F01WeldReductionFactorInput(request, context, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }

  public createF01YCoefficientInput(
    request: B31_3IntegrationRequest,
    context?: {
      materialFamily?: string;
      temperature?: number;
    }
  ) {
    return createB31_3F01YCoefficientInput(request, context, {
      dataResolver: this.dataResolver,
      sourceDocResolver: this.sourceDocResolver,
      evidenceResolver: this.evidenceResolver,
    });
  }
}

/**
 * Instance par défaut de la frontière d'intégration B31.3.
 */
export const defaultB31_3Integration = new B31_3Integration();
