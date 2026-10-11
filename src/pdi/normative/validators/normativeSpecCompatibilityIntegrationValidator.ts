/**
 * PDI NORMATIVE ENGINE — NORMATIVE SPEC ↔ COMPATIBILITY INTEGRATION VALIDATOR
 * Reference: NORM-14-08 (Integration with SPEC-01)
 * 
 * Validateur structurel déterministe pour les requêtes d'intégration Spec ↔ Compatibilité.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. specResolution obligatoire, objet structuré valide issu de SPEC-01.
 * 3. compatibilityQuery obligatoire, objet structuré valide issu de NORM-14-07.
 * 4. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 5. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeSpecCompatibilityIntegrationQuery,
} from "../types/normativeSpecCompatibilityIntegrationTypes";
import { isRecordObject } from "./pipeDimensionalValidator";
import { validateNormativeMultiCompatibilityQuery } from "./normativeMultiCompatibilityValidator";

export type SpecCompatibilityIntegrationValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_SPEC_RESOLUTION"
  | "INVALID_SPEC_RESOLUTION"
  | "MISSING_SPEC_STATUS"
  | "INVALID_SPEC_STATUS"
  | "MISSING_SPEC_ID"
  | "EMPTY_SPEC_ID"
  | "INVALID_SPEC_ID_TYPE"
  | "MISSING_SPEC_COMPONENT_TYPE"
  | "EMPTY_SPEC_COMPONENT_TYPE"
  | "INVALID_SPEC_COMPONENT_TYPE"
  | "MISSING_COMPATIBILITY_QUERY"
  | "INVALID_COMPATIBILITY_QUERY";

export interface SpecCompatibilityIntegrationValidationError {
  readonly code: SpecCompatibilityIntegrationValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface SpecCompatibilityIntegrationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SpecCompatibilityIntegrationValidationError[];
}

export const ALLOWED_SPEC_RESOLUTION_STATUSES = Object.freeze([
  "COMPATIBLE",
  "INCOMPATIBLE",
  "UNVERIFIED",
  "INVALID",
]);

/**
 * Valide structurellement la résolution SPEC-01 passée en entrée.
 */
export function validateSpecResolutionResult(
  raw: unknown,
  fieldName: string = "specResolution"
): SpecCompatibilityIntegrationValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_SPEC_RESOLUTION",
          field: fieldName,
          message: `Field '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: SpecCompatibilityIntegrationValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // status
  if (candidate.status === undefined || candidate.status === null) {
    errors.push({
      code: "MISSING_SPEC_STATUS",
      field: `${fieldName}.status`,
      message: `Field '${fieldName}.status' is required.`,
    });
  } else if (typeof candidate.status !== "string" || !ALLOWED_SPEC_RESOLUTION_STATUSES.includes(candidate.status)) {
    errors.push({
      code: "INVALID_SPEC_STATUS",
      field: `${fieldName}.status`,
      message: `Field '${fieldName}.status' must be one of [${ALLOWED_SPEC_RESOLUTION_STATUSES.join(
        ", "
      )}], got '${String(candidate.status)}'.`,
    });
  }

  // specificationId
  if (candidate.specificationId === undefined || candidate.specificationId === null) {
    errors.push({
      code: "MISSING_SPEC_ID",
      field: `${fieldName}.specificationId`,
      message: `Field '${fieldName}.specificationId' is required.`,
    });
  } else if (typeof candidate.specificationId !== "string") {
    errors.push({
      code: "INVALID_SPEC_ID_TYPE",
      field: `${fieldName}.specificationId`,
      message: `Field '${fieldName}.specificationId' must be a string, got ${typeof candidate.specificationId}.`,
    });
  } else if (candidate.specificationId.trim().length === 0) {
    errors.push({
      code: "EMPTY_SPEC_ID",
      field: `${fieldName}.specificationId`,
      message: `Field '${fieldName}.specificationId' cannot be empty or whitespace.`,
    });
  }

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_SPEC_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (typeof candidate.componentType !== "string") {
    errors.push({
      code: "INVALID_SPEC_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be a string, got ${typeof candidate.componentType}.`,
    });
  } else if (candidate.componentType.trim().length === 0) {
    errors.push({
      code: "EMPTY_SPEC_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' cannot be empty or whitespace.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide structurellement la requête globale NormativeSpecCompatibilityIntegrationQuery.
 */
export function validateNormativeSpecCompatibilityIntegrationQuery(
  raw: unknown
): SpecCompatibilityIntegrationValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeSpecCompatibilityIntegrationQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: SpecCompatibilityIntegrationValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // specResolution
  if (candidate.specResolution === undefined || candidate.specResolution === null) {
    errors.push({
      code: "MISSING_SPEC_RESOLUTION",
      field: "specResolution",
      message: "Query field 'specResolution' is required.",
    });
  } else {
    const specVal = validateSpecResolutionResult(candidate.specResolution, "specResolution");
    if (!specVal.valid) {
      errors.push(...specVal.errors);
    }
  }

  // compatibilityQuery
  if (candidate.compatibilityQuery === undefined || candidate.compatibilityQuery === null) {
    errors.push({
      code: "MISSING_COMPATIBILITY_QUERY",
      field: "compatibilityQuery",
      message: "Query field 'compatibilityQuery' is required.",
    });
  } else {
    const compatVal = validateNormativeMultiCompatibilityQuery(candidate.compatibilityQuery);
    if (!compatVal.valid) {
      errors.push(
        ...compatVal.errors.map((e) => ({
          code: "INVALID_COMPATIBILITY_QUERY" as const,
          field: `compatibilityQuery.${e.field ?? ""}`,
          message: `[${e.code}] ${e.message}`,
        }))
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
