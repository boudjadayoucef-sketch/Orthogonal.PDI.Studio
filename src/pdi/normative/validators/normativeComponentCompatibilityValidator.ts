/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT COMPATIBILITY VALIDATOR
 * Reference: NORM-14-02 (Component Compatibility Adapter)
 * 
 * Validateur structurel déterministe pour les références et requêtes de compatibilité composant-à-composant.
 * RÈGLES DE VALIDATION :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. componentType obligatoire et strictement restreint à ("PIPE" | "FITTING" | "FLANGE" | "VALVE").
 * 3. componentId obligatoire, non vide, sans espaces seuls, sans token heuristique interdit.
 * 4. Requête complète obligatoire (left et right).
 * 5. Aucune altération, conversion ou normalisation des identifiants.
 */

import type {
  NormativeComponentCompatibilityQuery,
  NormativeComponentReference,
  NormativeComponentType,
} from "../types/normativeComponentCompatibilityTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type ComponentCompatibilityValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_LEFT_REFERENCE"
  | "INVALID_LEFT_REFERENCE"
  | "MISSING_RIGHT_REFERENCE"
  | "INVALID_RIGHT_REFERENCE"
  | "MISSING_COMPONENT_TYPE"
  | "INVALID_COMPONENT_TYPE"
  | "MISSING_COMPONENT_ID"
  | "EMPTY_COMPONENT_ID"
  | "INVALID_COMPONENT_ID_TYPE";

export interface ComponentCompatibilityValidationError {
  readonly code: ComponentCompatibilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface ComponentCompatibilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ComponentCompatibilityValidationError[];
}

export const ALLOWED_COMPONENT_TYPES: readonly NormativeComponentType[] = Object.freeze([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
]);

/**
 * Valide une référence de composant individuel.
 */
export function validateNormativeComponentReference(
  raw: unknown,
  fieldName: string = "component"
): ComponentCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (!ALLOWED_COMPONENT_TYPES.includes(candidate.componentType as NormativeComponentType)) {
    errors.push({
      code: "INVALID_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be one of [${ALLOWED_COMPONENT_TYPES.join(", ")}], got '${String(candidate.componentType)}'.`,
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
 * Valide une requête complète de compatibilité composant NormativeComponentCompatibilityQuery.
 */
export function validateNormativeComponentCompatibilityQuery(
  raw: unknown
): ComponentCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeComponentCompatibilityQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: ComponentCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // left
  if (candidate.left === undefined || candidate.left === null) {
    errors.push({
      code: "MISSING_LEFT_REFERENCE",
      field: "left",
      message: "Query field 'left' is required.",
    });
  } else {
    const leftVal = validateNormativeComponentReference(candidate.left, "left");
    if (!leftVal.valid) {
      errors.push(...leftVal.errors);
    }
  }

  // right
  if (candidate.right === undefined || candidate.right === null) {
    errors.push({
      code: "MISSING_RIGHT_REFERENCE",
      field: "right",
      message: "Query field 'right' is required.",
    });
  } else {
    const rightVal = validateNormativeComponentReference(candidate.right, "right");
    if (!rightVal.valid) {
      errors.push(...rightVal.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
