/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT INTEGRATION VALIDATOR
 * Reference: NORM-14-09 (Integration with COMPONENT-01 → COMPONENT-05)
 * 
 * Validateur structurel déterministe pour les requêtes d'intégration Composant ↔ Spec / Compatibilité.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. componentContext obligatoire, objet structuré valide issu de COMPONENT-01.
 * 3. specResolution obligatoire, objet structuré valide issu de SPEC-01.
 * 4. compatibilityQuery obligatoire, objet structuré valide issu de NORM-14-07.
 * 5. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 6. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeComponentIntegrationQuery,
} from "../types/normativeComponentIntegrationTypes";
import type { ComponentResolutionStatus } from "../types/componentResolutionTypes";
import { isRecordObject } from "./pipeDimensionalValidator";
import { validateSpecResolutionResult } from "./normativeSpecCompatibilityIntegrationValidator";
import { validateNormativeMultiCompatibilityQuery } from "./normativeMultiCompatibilityValidator";

export type ComponentIntegrationValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_COMPONENT_CONTEXT"
  | "INVALID_COMPONENT_CONTEXT"
  | "MISSING_CONTEXT_SPEC_ID"
  | "EMPTY_CONTEXT_SPEC_ID"
  | "INVALID_CONTEXT_SPEC_ID_TYPE"
  | "MISSING_CONTEXT_COMPONENT_TYPE"
  | "EMPTY_CONTEXT_COMPONENT_TYPE"
  | "INVALID_CONTEXT_COMPONENT_TYPE"
  | "MISSING_SPEC_RESOLUTION"
  | "INVALID_SPEC_RESOLUTION"
  | "MISSING_COMPATIBILITY_QUERY"
  | "INVALID_COMPATIBILITY_QUERY";

export interface ComponentIntegrationValidationError {
  readonly code: ComponentIntegrationValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface ComponentIntegrationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ComponentIntegrationValidationError[];
}

export const ALLOWED_COMPONENT_TYPES = Object.freeze([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
]);

export const ALLOWED_COMPONENT_RESOLUTION_STATUSES: readonly ComponentResolutionStatus[] =
  Object.freeze([
    "RESOLVED",
    "NO_CANDIDATE",
    "UNVERIFIED",
    "AMBIGUOUS",
    "INVALID",
  ]);

/**
 * Valide structurellement le contexte de sélection de composant.
 */
export function validateComponentSelectionContext(
  raw: unknown,
  fieldName: string = "componentContext"
): ComponentIntegrationValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_COMPONENT_CONTEXT",
          field: fieldName,
          message: `Field '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentIntegrationValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // specificationId
  if (candidate.specificationId === undefined || candidate.specificationId === null) {
    errors.push({
      code: "MISSING_CONTEXT_SPEC_ID",
      field: `${fieldName}.specificationId`,
      message: `Field '${fieldName}.specificationId' is required.`,
    });
  } else if (typeof candidate.specificationId !== "string") {
    errors.push({
      code: "INVALID_CONTEXT_SPEC_ID_TYPE",
      field: `${fieldName}.specificationId`,
      message: `Field '${fieldName}.specificationId' must be a string.`,
    });
  } else if (candidate.specificationId.trim().length === 0) {
    errors.push({
      code: "EMPTY_CONTEXT_SPEC_ID",
      field: `${fieldName}.specificationId`,
      message: `Field '${fieldName}.specificationId' must not be empty.`,
    });
  }

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_CONTEXT_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (typeof candidate.componentType !== "string") {
    errors.push({
      code: "INVALID_CONTEXT_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be a string.`,
    });
  } else if (candidate.componentType.trim().length === 0) {
    errors.push({
      code: "EMPTY_CONTEXT_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must not be empty.`,
    });
  } else if (!ALLOWED_COMPONENT_TYPES.includes(candidate.componentType)) {
    errors.push({
      code: "INVALID_CONTEXT_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be one of [${ALLOWED_COMPONENT_TYPES.join(
        ", "
      )}], got '${String(candidate.componentType)}'.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide structurellement la requête complète d'intégration NORM-14-09.
 */
export function validateNormativeComponentIntegrationQuery(
  raw: unknown
): ComponentIntegrationValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          field: "query",
          message: "Query must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: ComponentIntegrationValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // 1. componentContext
  if (candidate.componentContext === undefined || candidate.componentContext === null) {
    errors.push({
      code: "MISSING_COMPONENT_CONTEXT",
      field: "componentContext",
      message: "Field 'componentContext' is required.",
    });
  } else {
    const ctxVal = validateComponentSelectionContext(
      candidate.componentContext,
      "componentContext"
    );
    if (!ctxVal.valid) {
      errors.push(...ctxVal.errors);
    }
  }

  // 2. specResolution
  if (candidate.specResolution === undefined || candidate.specResolution === null) {
    errors.push({
      code: "MISSING_SPEC_RESOLUTION",
      field: "specResolution",
      message: "Field 'specResolution' is required.",
    });
  } else {
    const specVal = validateSpecResolutionResult(
      candidate.specResolution,
      "specResolution"
    );
    if (!specVal.valid) {
      for (const err of specVal.errors) {
        errors.push({
          code: "INVALID_SPEC_RESOLUTION",
          field: err.field,
          message: err.message,
        });
      }
    }
  }

  // 3. compatibilityQuery
  if (candidate.compatibilityQuery === undefined || candidate.compatibilityQuery === null) {
    errors.push({
      code: "MISSING_COMPATIBILITY_QUERY",
      field: "compatibilityQuery",
      message: "Field 'compatibilityQuery' is required.",
    });
  } else {
    const compatVal = validateNormativeMultiCompatibilityQuery(
      candidate.compatibilityQuery as any
    );
    if (!compatVal.valid) {
      for (const err of compatVal.errors) {
        errors.push({
          code: "INVALID_COMPATIBILITY_QUERY",
          field: err.field,
          message: err.message,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
