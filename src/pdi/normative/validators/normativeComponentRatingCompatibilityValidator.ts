/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ RATING COMPATIBILITY VALIDATOR
 * Reference: NORM-14-04 (Component ↔ Rating / Pressure Rating Compatibility)
 * 
 * Validateur structurel déterministe pour les requêtes de compatibilité Composant ↔ Rating.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. componentType obligatoire et strictement membre de ("PIPE" | "FITTING" | "FLANGE" | "VALVE").
 * 3. componentId obligatoire, chaîne non vide (sans espaces seuls).
 * 4. ratingId obligatoire, chaîne non vide (sans espaces seuls).
 * 5. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 6. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeComponentRatingCompatibilityQuery,
  NormativeComponentRatingReference,
  NormativeRatingCompatibilityComponentType,
  NormativeRatingReference,
} from "../types/normativeComponentRatingCompatibilityTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type ComponentRatingCompatibilityValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_COMPONENT_REFERENCE"
  | "INVALID_COMPONENT_REFERENCE"
  | "MISSING_COMPONENT_TYPE"
  | "INVALID_COMPONENT_TYPE"
  | "MISSING_COMPONENT_ID"
  | "EMPTY_COMPONENT_ID"
  | "INVALID_COMPONENT_ID_TYPE"
  | "MISSING_RATING_REFERENCE"
  | "INVALID_RATING_REFERENCE"
  | "MISSING_RATING_ID"
  | "EMPTY_RATING_ID"
  | "INVALID_RATING_ID_TYPE";

export interface ComponentRatingCompatibilityValidationError {
  readonly code: ComponentRatingCompatibilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface ComponentRatingCompatibilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ComponentRatingCompatibilityValidationError[];
}

export const ALLOWED_RATING_COMPATIBILITY_COMPONENT_TYPES: readonly NormativeRatingCompatibilityComponentType[] =
  Object.freeze(["PIPE", "FITTING", "FLANGE", "VALVE"]);

/**
 * Valide une référence de composant pour la compatibilité rating.
 */
export function validateNormativeComponentRatingReference(
  raw: unknown,
  fieldName: string = "component"
): ComponentRatingCompatibilityValidationResult {
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

  const errors: ComponentRatingCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (
    !ALLOWED_RATING_COMPATIBILITY_COMPONENT_TYPES.includes(
      candidate.componentType as NormativeRatingCompatibilityComponentType
    )
  ) {
    errors.push({
      code: "INVALID_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be one of [${ALLOWED_RATING_COMPATIBILITY_COMPONENT_TYPES.join(
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
 * Valide une référence de rating.
 */
export function validateNormativeRatingReference(
  raw: unknown,
  fieldName: string = "rating"
): ComponentRatingCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RATING_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentRatingCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // ratingId
  if (candidate.ratingId === undefined || candidate.ratingId === null) {
    errors.push({
      code: "MISSING_RATING_ID",
      field: `${fieldName}.ratingId`,
      message: `Field '${fieldName}.ratingId' is required.`,
    });
  } else if (typeof candidate.ratingId !== "string") {
    errors.push({
      code: "INVALID_RATING_ID_TYPE",
      field: `${fieldName}.ratingId`,
      message: `Field '${fieldName}.ratingId' must be a string, got ${typeof candidate.ratingId}.`,
    });
  } else {
    const trimmed = candidate.ratingId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_RATING_ID",
        field: `${fieldName}.ratingId`,
        message: `Field '${fieldName}.ratingId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une requête complète Component ↔ Rating NormativeComponentRatingCompatibilityQuery.
 */
export function validateNormativeComponentRatingCompatibilityQuery(
  raw: unknown
): ComponentRatingCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeComponentRatingCompatibilityQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: ComponentRatingCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // component
  if (candidate.component === undefined || candidate.component === null) {
    errors.push({
      code: "MISSING_COMPONENT_REFERENCE",
      field: "component",
      message: "Query field 'component' is required.",
    });
  } else {
    const compVal = validateNormativeComponentRatingReference(candidate.component, "component");
    if (!compVal.valid) {
      errors.push(...compVal.errors);
    }
  }

  // rating
  if (candidate.rating === undefined || candidate.rating === null) {
    errors.push({
      code: "MISSING_RATING_REFERENCE",
      field: "rating",
      message: "Query field 'rating' is required.",
    });
  } else {
    const ratingVal = validateNormativeRatingReference(candidate.rating, "rating");
    if (!ratingVal.valid) {
      errors.push(...ratingVal.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
