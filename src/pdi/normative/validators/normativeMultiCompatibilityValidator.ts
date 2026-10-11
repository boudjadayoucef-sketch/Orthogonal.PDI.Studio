/**
 * PDI NORMATIVE ENGINE — NORMATIVE MULTI-COMPATIBILITY VALIDATOR
 * Reference: NORM-14-07 (Multi-compatibility Resolution)
 * 
 * Validateur structurel déterministe pour les requêtes multi-contraintes de compatibilité.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. constraints obligatoire, tableau non vide.
 * 3. Chaque contrainte doit avoir constraintType, left et right valides.
 * 4. entityId obligatoire, chaîne non vide (sans espaces seuls).
 * 5. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 6. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeMultiCompatibilityConstraint,
  NormativeMultiCompatibilityConstraintType,
  NormativeMultiCompatibilityEntityType,
  NormativeMultiCompatibilityQuery,
  NormativeMultiCompatibilityReference,
} from "../types/normativeMultiCompatibilityTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type MultiCompatibilityValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_CONSTRAINTS"
  | "INVALID_CONSTRAINTS_TYPE"
  | "EMPTY_CONSTRAINTS_ARRAY"
  | "INVALID_CONSTRAINT_OBJECT"
  | "MISSING_CONSTRAINT_TYPE"
  | "INVALID_CONSTRAINT_TYPE"
  | "MISSING_LEFT_REFERENCE"
  | "INVALID_LEFT_REFERENCE"
  | "MISSING_LEFT_ENTITY_TYPE"
  | "INVALID_LEFT_ENTITY_TYPE"
  | "MISSING_LEFT_ENTITY_ID"
  | "EMPTY_LEFT_ENTITY_ID"
  | "INVALID_LEFT_ENTITY_ID_TYPE"
  | "MISSING_RIGHT_REFERENCE"
  | "INVALID_RIGHT_REFERENCE"
  | "MISSING_RIGHT_ENTITY_TYPE"
  | "INVALID_RIGHT_ENTITY_TYPE"
  | "MISSING_RIGHT_ENTITY_ID"
  | "EMPTY_RIGHT_ENTITY_ID"
  | "INVALID_RIGHT_ENTITY_ID_TYPE";

export interface MultiCompatibilityValidationError {
  readonly code: MultiCompatibilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface MultiCompatibilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly MultiCompatibilityValidationError[];
}

export const ALLOWED_MULTI_COMPATIBILITY_CONSTRAINT_TYPES: readonly NormativeMultiCompatibilityConstraintType[] =
  Object.freeze([
    "COMPONENT",
    "MATERIAL",
    "RATING",
    "DIMENSIONAL_STANDARD",
    "PRODUCT_STANDARD",
  ]);

export const ALLOWED_MULTI_COMPATIBILITY_ENTITY_TYPES: readonly NormativeMultiCompatibilityEntityType[] =
  Object.freeze([
    "PIPE",
    "FITTING",
    "FLANGE",
    "VALVE",
    "MATERIAL",
    "RATING",
    "DIMENSIONAL_STANDARD",
    "PRODUCT_STANDARD",
  ]);

export const ALLOWED_COMPONENT_ENTITY_TYPES: readonly NormativeMultiCompatibilityEntityType[] =
  Object.freeze(["PIPE", "FITTING", "FLANGE", "VALVE"]);

/**
 * Valide une référence d'entité multi-compatibilité.
 */
export function validateNormativeMultiCompatibilityReference(
  raw: unknown,
  fieldName: string
): MultiCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: fieldName.startsWith("left") ? "INVALID_LEFT_REFERENCE" : "INVALID_RIGHT_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: MultiCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // entityType
  if (candidate.entityType === undefined || candidate.entityType === null) {
    errors.push({
      code: fieldName.startsWith("left") ? "MISSING_LEFT_ENTITY_TYPE" : "MISSING_RIGHT_ENTITY_TYPE",
      field: `${fieldName}.entityType`,
      message: `Field '${fieldName}.entityType' is required.`,
    });
  } else if (
    !ALLOWED_MULTI_COMPATIBILITY_ENTITY_TYPES.includes(
      candidate.entityType as NormativeMultiCompatibilityEntityType
    )
  ) {
    errors.push({
      code: fieldName.startsWith("left") ? "INVALID_LEFT_ENTITY_TYPE" : "INVALID_RIGHT_ENTITY_TYPE",
      field: `${fieldName}.entityType`,
      message: `Field '${fieldName}.entityType' must be one of [${ALLOWED_MULTI_COMPATIBILITY_ENTITY_TYPES.join(
        ", "
      )}], got '${String(candidate.entityType)}'.`,
    });
  }

  // entityId
  if (candidate.entityId === undefined || candidate.entityId === null) {
    errors.push({
      code: fieldName.startsWith("left") ? "MISSING_LEFT_ENTITY_ID" : "MISSING_RIGHT_ENTITY_ID",
      field: `${fieldName}.entityId`,
      message: `Field '${fieldName}.entityId' is required.`,
    });
  } else if (typeof candidate.entityId !== "string") {
    errors.push({
      code: fieldName.startsWith("left") ? "INVALID_LEFT_ENTITY_ID_TYPE" : "INVALID_RIGHT_ENTITY_ID_TYPE",
      field: `${fieldName}.entityId`,
      message: `Field '${fieldName}.entityId' must be a string, got ${typeof candidate.entityId}.`,
    });
  } else {
    const trimmed = candidate.entityId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: fieldName.startsWith("left") ? "EMPTY_LEFT_ENTITY_ID" : "EMPTY_RIGHT_ENTITY_ID",
        field: `${fieldName}.entityId`,
        message: `Field '${fieldName}.entityId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une contrainte individuelle de multi-compatibilité.
 */
export function validateNormativeMultiCompatibilityConstraint(
  raw: unknown,
  index?: number
): MultiCompatibilityValidationResult {
  const prefix = index !== undefined ? `constraints[${index}]` : "constraint";

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_CONSTRAINT_OBJECT",
          field: prefix,
          message: `Constraint '${prefix}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: MultiCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // constraintType
  if (candidate.constraintType === undefined || candidate.constraintType === null) {
    errors.push({
      code: "MISSING_CONSTRAINT_TYPE",
      field: `${prefix}.constraintType`,
      message: `Field '${prefix}.constraintType' is required.`,
    });
  } else if (
    !ALLOWED_MULTI_COMPATIBILITY_CONSTRAINT_TYPES.includes(
      candidate.constraintType as NormativeMultiCompatibilityConstraintType
    )
  ) {
    errors.push({
      code: "INVALID_CONSTRAINT_TYPE",
      field: `${prefix}.constraintType`,
      message: `Field '${prefix}.constraintType' must be one of [${ALLOWED_MULTI_COMPATIBILITY_CONSTRAINT_TYPES.join(
        ", "
      )}], got '${String(candidate.constraintType)}'.`,
    });
  }

  // left
  if (candidate.left === undefined || candidate.left === null) {
    errors.push({
      code: "MISSING_LEFT_REFERENCE",
      field: `${prefix}.left`,
      message: `Field '${prefix}.left' is required.`,
    });
  } else {
    const leftVal = validateNormativeMultiCompatibilityReference(candidate.left, `${prefix}.left`);
    if (!leftVal.valid) {
      errors.push(...leftVal.errors);
    }
  }

  // right
  if (candidate.right === undefined || candidate.right === null) {
    errors.push({
      code: "MISSING_RIGHT_REFERENCE",
      field: `${prefix}.right`,
      message: `Field '${prefix}.right' is required.`,
    });
  } else {
    const rightVal = validateNormativeMultiCompatibilityReference(candidate.right, `${prefix}.right`);
    if (!rightVal.valid) {
      errors.push(...rightVal.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une requête globale NormativeMultiCompatibilityQuery.
 */
export function validateNormativeMultiCompatibilityQuery(
  raw: unknown
): MultiCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeMultiCompatibilityQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: MultiCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // constraints
  if (candidate.constraints === undefined || candidate.constraints === null) {
    errors.push({
      code: "MISSING_CONSTRAINTS",
      field: "constraints",
      message: "Query field 'constraints' is required.",
    });
  } else if (!Array.isArray(candidate.constraints)) {
    errors.push({
      code: "INVALID_CONSTRAINTS_TYPE",
      field: "constraints",
      message: "Query field 'constraints' must be an array.",
    });
  } else if (candidate.constraints.length === 0) {
    errors.push({
      code: "EMPTY_CONSTRAINTS_ARRAY",
      field: "constraints",
      message: "Query field 'constraints' cannot be empty.",
    });
  } else {
    candidate.constraints.forEach((constraint, idx) => {
      const constraintVal = validateNormativeMultiCompatibilityConstraint(constraint, idx);
      if (!constraintVal.valid) {
        errors.push(...constraintVal.errors);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
