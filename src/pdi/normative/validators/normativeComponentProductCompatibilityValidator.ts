/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ PRODUCT STANDARD COMPATIBILITY VALIDATOR
 * Reference: NORM-14-06 (Component ↔ Product Standard Compatibility)
 * 
 * Validateur structurel déterministe pour les requêtes de compatibilité Composant ↔ Standard Produit.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. componentType obligatoire et strictement membre de ("PIPE" | "FITTING" | "FLANGE" | "VALVE").
 * 3. componentId obligatoire, chaîne non vide (sans espaces seuls).
 * 4. productStandardId obligatoire, chaîne non vide (sans espaces seuls).
 * 5. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 6. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeComponentProductCompatibilityQuery,
  NormativeComponentProductReference,
  NormativeProductCompatibilityComponentType,
  NormativeProductStandardReference,
} from "../types/normativeComponentProductCompatibilityTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type ComponentProductCompatibilityValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_COMPONENT_REFERENCE"
  | "INVALID_COMPONENT_REFERENCE"
  | "MISSING_COMPONENT_TYPE"
  | "INVALID_COMPONENT_TYPE"
  | "MISSING_COMPONENT_ID"
  | "EMPTY_COMPONENT_ID"
  | "INVALID_COMPONENT_ID_TYPE"
  | "MISSING_PRODUCT_STANDARD_REFERENCE"
  | "INVALID_PRODUCT_STANDARD_REFERENCE"
  | "MISSING_PRODUCT_STANDARD_ID"
  | "EMPTY_PRODUCT_STANDARD_ID"
  | "INVALID_PRODUCT_STANDARD_ID_TYPE";

export interface ComponentProductCompatibilityValidationError {
  readonly code: ComponentProductCompatibilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface ComponentProductCompatibilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ComponentProductCompatibilityValidationError[];
}

export const ALLOWED_PRODUCT_COMPATIBILITY_COMPONENT_TYPES: readonly NormativeProductCompatibilityComponentType[] =
  Object.freeze(["PIPE", "FITTING", "FLANGE", "VALVE"]);

/**
 * Valide une référence de composant pour la compatibilité standard produit.
 */
export function validateNormativeComponentProductReference(
  raw: unknown,
  fieldName: string = "component"
): ComponentProductCompatibilityValidationResult {
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

  const errors: ComponentProductCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (
    !ALLOWED_PRODUCT_COMPATIBILITY_COMPONENT_TYPES.includes(
      candidate.componentType as NormativeProductCompatibilityComponentType
    )
  ) {
    errors.push({
      code: "INVALID_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be one of [${ALLOWED_PRODUCT_COMPATIBILITY_COMPONENT_TYPES.join(
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
 * Valide une référence de standard produit.
 */
export function validateNormativeProductStandardReference(
  raw: unknown,
  fieldName: string = "productStandard"
): ComponentProductCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_PRODUCT_STANDARD_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentProductCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // productStandardId
  if (candidate.productStandardId === undefined || candidate.productStandardId === null) {
    errors.push({
      code: "MISSING_PRODUCT_STANDARD_ID",
      field: `${fieldName}.productStandardId`,
      message: `Field '${fieldName}.productStandardId' is required.`,
    });
  } else if (typeof candidate.productStandardId !== "string") {
    errors.push({
      code: "INVALID_PRODUCT_STANDARD_ID_TYPE",
      field: `${fieldName}.productStandardId`,
      message: `Field '${fieldName}.productStandardId' must be a string, got ${typeof candidate.productStandardId}.`,
    });
  } else {
    const trimmed = candidate.productStandardId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_PRODUCT_STANDARD_ID",
        field: `${fieldName}.productStandardId`,
        message: `Field '${fieldName}.productStandardId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une requête complète Component ↔ Product Standard NormativeComponentProductCompatibilityQuery.
 */
export function validateNormativeComponentProductCompatibilityQuery(
  raw: unknown
): ComponentProductCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeComponentProductCompatibilityQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: ComponentProductCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // component
  if (candidate.component === undefined || candidate.component === null) {
    errors.push({
      code: "MISSING_COMPONENT_REFERENCE",
      field: "component",
      message: "Query field 'component' is required.",
    });
  } else {
    const compVal = validateNormativeComponentProductReference(candidate.component, "component");
    if (!compVal.valid) {
      errors.push(...compVal.errors);
    }
  }

  // productStandard
  if (candidate.productStandard === undefined || candidate.productStandard === null) {
    errors.push({
      code: "MISSING_PRODUCT_STANDARD_REFERENCE",
      field: "productStandard",
      message: "Query field 'productStandard' is required.",
    });
  } else {
    const prodVal = validateNormativeProductStandardReference(candidate.productStandard, "productStandard");
    if (!prodVal.valid) {
      errors.push(...prodVal.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
