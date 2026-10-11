/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ DIMENSIONAL STANDARD COMPATIBILITY VALIDATOR
 * Reference: NORM-14-05 (Component ↔ Dimensional Standard Compatibility)
 * 
 * Validateur structurel déterministe pour les requêtes de compatibilité Composant ↔ Standard Dimensionnel.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. componentType obligatoire et strictement membre de ("PIPE" | "FITTING" | "FLANGE" | "VALVE").
 * 3. componentId obligatoire, chaîne non vide (sans espaces seuls).
 * 4. dimensionalStandardId obligatoire, chaîne non vide (sans espaces seuls).
 * 5. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 6. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeComponentDimensionalCompatibilityQuery,
  NormativeComponentDimensionalReference,
  NormativeDimensionalCompatibilityComponentType,
  NormativeDimensionalStandardReference,
} from "../types/normativeComponentDimensionalCompatibilityTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type ComponentDimensionalCompatibilityValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_COMPONENT_REFERENCE"
  | "INVALID_COMPONENT_REFERENCE"
  | "MISSING_COMPONENT_TYPE"
  | "INVALID_COMPONENT_TYPE"
  | "MISSING_COMPONENT_ID"
  | "EMPTY_COMPONENT_ID"
  | "INVALID_COMPONENT_ID_TYPE"
  | "MISSING_DIMENSIONAL_STANDARD_REFERENCE"
  | "INVALID_DIMENSIONAL_STANDARD_REFERENCE"
  | "MISSING_DIMENSIONAL_STANDARD_ID"
  | "EMPTY_DIMENSIONAL_STANDARD_ID"
  | "INVALID_DIMENSIONAL_STANDARD_ID_TYPE";

export interface ComponentDimensionalCompatibilityValidationError {
  readonly code: ComponentDimensionalCompatibilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface ComponentDimensionalCompatibilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ComponentDimensionalCompatibilityValidationError[];
}

export const ALLOWED_DIMENSIONAL_COMPATIBILITY_COMPONENT_TYPES: readonly NormativeDimensionalCompatibilityComponentType[] =
  Object.freeze(["PIPE", "FITTING", "FLANGE", "VALVE"]);

/**
 * Valide une référence de composant pour la compatibilité standard dimensionnel.
 */
export function validateNormativeComponentDimensionalReference(
  raw: unknown,
  fieldName: string = "component"
): ComponentDimensionalCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_COMPONENT_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentDimensionalCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (
    !ALLOWED_DIMENSIONAL_COMPATIBILITY_COMPONENT_TYPES.includes(
      candidate.componentType as NormativeDimensionalCompatibilityComponentType
    )
  ) {
    errors.push({
      code: "INVALID_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be one of [${ALLOWED_DIMENSIONAL_COMPATIBILITY_COMPONENT_TYPES.join(
        ", "
      )}], got '${String(candidate.componentType)}'.`,
    });
  }

  // componentId
  if (candidate.componentId === undefined || candidate.componentId === null) {
    errors.push({
      code: "MISSING_COMPONENT_ID",
      field: `${fieldName}.componentId`,
      message: `Field '${fieldName}.componentId' is required.`,
    });
  } else if (typeof candidate.componentId !== "string") {
    errors.push({
      code: "INVALID_COMPONENT_ID_TYPE",
      field: `${fieldName}.componentId`,
      message: `Field '${fieldName}.componentId' must be a string, got ${typeof candidate.componentId}.`,
    });
  } else {
    const trimmed = candidate.componentId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_COMPONENT_ID",
        field: `${fieldName}.componentId`,
        message: `Field '${fieldName}.componentId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une référence de standard dimensionnel.
 */
export function validateNormativeDimensionalStandardReference(
  raw: unknown,
  fieldName: string = "dimensionalStandard"
): ComponentDimensionalCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_DIMENSIONAL_STANDARD_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentDimensionalCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // dimensionalStandardId
  if (candidate.dimensionalStandardId === undefined || candidate.dimensionalStandardId === null) {
    errors.push({
      code: "MISSING_DIMENSIONAL_STANDARD_ID",
      field: `${fieldName}.dimensionalStandardId`,
      message: `Field '${fieldName}.dimensionalStandardId' is required.`,
    });
  } else if (typeof candidate.dimensionalStandardId !== "string") {
    errors.push({
      code: "INVALID_DIMENSIONAL_STANDARD_ID_TYPE",
      field: `${fieldName}.dimensionalStandardId`,
      message: `Field '${fieldName}.dimensionalStandardId' must be a string, got ${typeof candidate.dimensionalStandardId}.`,
    });
  } else {
    const trimmed = candidate.dimensionalStandardId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_DIMENSIONAL_STANDARD_ID",
        field: `${fieldName}.dimensionalStandardId`,
        message: `Field '${fieldName}.dimensionalStandardId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une requête complète Component ↔ Dimensional Standard NormativeComponentDimensionalCompatibilityQuery.
 */
export function validateNormativeComponentDimensionalCompatibilityQuery(
  raw: unknown
): ComponentDimensionalCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeComponentDimensionalCompatibilityQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: ComponentDimensionalCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // component
  if (candidate.component === undefined || candidate.component === null) {
    errors.push({
      code: "MISSING_COMPONENT_REFERENCE",
      field: "component",
      message: "Query field 'component' is required.",
    });
  } else {
    const compVal = validateNormativeComponentDimensionalReference(candidate.component, "component");
    if (!compVal.valid) {
      errors.push(...compVal.errors);
    }
  }

  // dimensionalStandard
  if (candidate.dimensionalStandard === undefined || candidate.dimensionalStandard === null) {
    errors.push({
      code: "MISSING_DIMENSIONAL_STANDARD_REFERENCE",
      field: "dimensionalStandard",
      message: "Query field 'dimensionalStandard' is required.",
    });
  } else {
    const dimVal = validateNormativeDimensionalStandardReference(candidate.dimensionalStandard, "dimensionalStandard");
    if (!dimVal.valid) {
      errors.push(...dimVal.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
