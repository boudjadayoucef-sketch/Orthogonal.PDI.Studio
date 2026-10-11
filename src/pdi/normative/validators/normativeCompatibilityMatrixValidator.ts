/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY MATRIX VALIDATOR
 * Reference: NORM-14-01 (Compatibility Matrix Foundation)
 * 
 * Validateur structurel déterministe pour les règles et requêtes de la matrice de compatibilité normative.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, primitives, arrays.
 * 2. ruleId obligatoire, non vide, sans token heuristique interdit.
 * 3. leftEntityType & rightEntityType obligatoires et strictement membres de NormativeCompatibilityEntityType.
 * 4. leftEntityId & rightEntityId obligatoires, non vides, sans token heuristique interdit.
 * 5. status obligatoire et membre de ("COMPATIBLE" | "INCOMPATIBLE" | "UNVERIFIED").
 * 6. evidenceIds (si fourni) : tableau de chaînes non vides, sans token heuristique, sans doublons.
 * 7. sourceReference & notes (si fournis) : chaînes non vides.
 * 8. Validation structurelle des requêtes de compatibilité (query).
 */

import type {
  NormativeCompatibilityEntityType,
  NormativeCompatibilityMatrixRule,
  NormativeCompatibilityMatrixRuleStatus,
} from "../types/normativeCompatibilityMatrixTypes";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";
import { isRecordObject } from "./pipeDimensionalValidator";

export type CompatibilityMatrixValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_RULE_ID"
  | "EMPTY_RULE_ID"
  | "INVALID_RULE_ID_TYPE"
  | "MISSING_LEFT_ENTITY_TYPE"
  | "INVALID_LEFT_ENTITY_TYPE"
  | "MISSING_LEFT_ENTITY_ID"
  | "EMPTY_LEFT_ENTITY_ID"
  | "INVALID_LEFT_ENTITY_ID_TYPE"
  | "MISSING_RIGHT_ENTITY_TYPE"
  | "INVALID_RIGHT_ENTITY_TYPE"
  | "MISSING_RIGHT_ENTITY_ID"
  | "EMPTY_RIGHT_ENTITY_ID"
  | "INVALID_RIGHT_ENTITY_ID_TYPE"
  | "MISSING_STATUS"
  | "INVALID_STATUS"
  | "INVALID_EVIDENCE_IDS_TYPE"
  | "INVALID_EVIDENCE_ID_ELEMENT"
  | "EMPTY_EVIDENCE_ID"
  | "DUPLICATE_EVIDENCE_ID"
  | "INVALID_FIELD_TYPE"
  | "EMPTY_FIELD_VALUE"
  | "DISALLOWED_TOKEN_HEURISTIC";

export interface CompatibilityMatrixValidationError {
  readonly code: CompatibilityMatrixValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface CompatibilityMatrixRuleValidationResult {
  readonly valid: boolean;
  readonly errors: readonly CompatibilityMatrixValidationError[];
}

export interface CompatibilityMatrixQueryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly CompatibilityMatrixValidationError[];
}

export const ALLOWED_COMPATIBILITY_ENTITY_TYPES: readonly NormativeCompatibilityEntityType[] = Object.freeze([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
  "MATERIAL",
  "RATING",
  "DIMENSIONAL_STANDARD",
  "PRODUCT_STANDARD",
]);

export const ALLOWED_COMPATIBILITY_RULE_STATUSES: readonly NormativeCompatibilityMatrixRuleStatus[] = Object.freeze([
  "COMPATIBLE",
  "INCOMPATIBLE",
  "UNVERIFIED",
]);

/**
 * Valide structurellement une instance de NormativeCompatibilityMatrixRule.
 */
export function validateNormativeCompatibilityMatrixRule(
  raw: unknown
): CompatibilityMatrixRuleValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "NormativeCompatibilityMatrixRule must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: CompatibilityMatrixValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // 1. ruleId
  if (candidate.ruleId === undefined || candidate.ruleId === null) {
    errors.push({
      code: "MISSING_RULE_ID",
      field: "ruleId",
      message: "Field 'ruleId' is required.",
    });
  } else if (typeof candidate.ruleId !== "string") {
    errors.push({
      code: "INVALID_RULE_ID_TYPE",
      field: "ruleId",
      message: `Field 'ruleId' must be a string, got ${typeof candidate.ruleId}.`,
    });
  } else {
    const trimmed = candidate.ruleId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_RULE_ID",
        field: "ruleId",
        message: "Field 'ruleId' cannot be empty or whitespace.",
      });
    } else if (isDisallowedTokenHeuristic(trimmed)) {
      errors.push({
        code: "DISALLOWED_TOKEN_HEURISTIC",
        field: "ruleId",
        message: `Field 'ruleId' contains disallowed heuristic token: '${trimmed}'.`,
      });
    }
  }

  // 2. leftEntityType
  if (candidate.leftEntityType === undefined || candidate.leftEntityType === null) {
    errors.push({
      code: "MISSING_LEFT_ENTITY_TYPE",
      field: "leftEntityType",
      message: "Field 'leftEntityType' is required.",
    });
  } else if (!ALLOWED_COMPATIBILITY_ENTITY_TYPES.includes(candidate.leftEntityType as NormativeCompatibilityEntityType)) {
    errors.push({
      code: "INVALID_LEFT_ENTITY_TYPE",
      field: "leftEntityType",
      message: `Field 'leftEntityType' must be one of [${ALLOWED_COMPATIBILITY_ENTITY_TYPES.join(", ")}], got '${String(candidate.leftEntityType)}'.`,
    });
  }

  // 3. leftEntityId
  if (candidate.leftEntityId === undefined || candidate.leftEntityId === null) {
    errors.push({
      code: "MISSING_LEFT_ENTITY_ID",
      field: "leftEntityId",
      message: "Field 'leftEntityId' is required.",
    });
  } else if (typeof candidate.leftEntityId !== "string") {
    errors.push({
      code: "INVALID_LEFT_ENTITY_ID_TYPE",
      field: "leftEntityId",
      message: `Field 'leftEntityId' must be a string, got ${typeof candidate.leftEntityId}.`,
    });
  } else {
    const trimmed = candidate.leftEntityId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_LEFT_ENTITY_ID",
        field: "leftEntityId",
        message: "Field 'leftEntityId' cannot be empty or whitespace.",
      });
    } else if (isDisallowedTokenHeuristic(trimmed)) {
      errors.push({
        code: "DISALLOWED_TOKEN_HEURISTIC",
        field: "leftEntityId",
        message: `Field 'leftEntityId' contains disallowed heuristic token: '${trimmed}'.`,
      });
    }
  }

  // 4. rightEntityType
  if (candidate.rightEntityType === undefined || candidate.rightEntityType === null) {
    errors.push({
      code: "MISSING_RIGHT_ENTITY_TYPE",
      field: "rightEntityType",
      message: "Field 'rightEntityType' is required.",
    });
  } else if (!ALLOWED_COMPATIBILITY_ENTITY_TYPES.includes(candidate.rightEntityType as NormativeCompatibilityEntityType)) {
    errors.push({
      code: "INVALID_RIGHT_ENTITY_TYPE",
      field: "rightEntityType",
      message: `Field 'rightEntityType' must be one of [${ALLOWED_COMPATIBILITY_ENTITY_TYPES.join(", ")}], got '${String(candidate.rightEntityType)}'.`,
    });
  }

  // 5. rightEntityId
  if (candidate.rightEntityId === undefined || candidate.rightEntityId === null) {
    errors.push({
      code: "MISSING_RIGHT_ENTITY_ID",
      field: "rightEntityId",
      message: "Field 'rightEntityId' is required.",
    });
  } else if (typeof candidate.rightEntityId !== "string") {
    errors.push({
      code: "INVALID_RIGHT_ENTITY_ID_TYPE",
      field: "rightEntityId",
      message: `Field 'rightEntityId' must be a string, got ${typeof candidate.rightEntityId}.`,
    });
  } else {
    const trimmed = candidate.rightEntityId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_RIGHT_ENTITY_ID",
        field: "rightEntityId",
        message: "Field 'rightEntityId' cannot be empty or whitespace.",
      });
    } else if (isDisallowedTokenHeuristic(trimmed)) {
      errors.push({
        code: "DISALLOWED_TOKEN_HEURISTIC",
        field: "rightEntityId",
        message: `Field 'rightEntityId' contains disallowed heuristic token: '${trimmed}'.`,
      });
    }
  }

  // 6. status
  if (candidate.status === undefined || candidate.status === null) {
    errors.push({
      code: "MISSING_STATUS",
      field: "status",
      message: "Field 'status' is required.",
    });
  } else if (!ALLOWED_COMPATIBILITY_RULE_STATUSES.includes(candidate.status as NormativeCompatibilityMatrixRuleStatus)) {
    errors.push({
      code: "INVALID_STATUS",
      field: "status",
      message: `Field 'status' must be one of [${ALLOWED_COMPATIBILITY_RULE_STATUSES.join(", ")}], got '${String(candidate.status)}'.`,
    });
  }

  // 7. evidenceIds (optional)
  if (candidate.evidenceIds !== undefined && candidate.evidenceIds !== null) {
    if (!Array.isArray(candidate.evidenceIds)) {
      errors.push({
        code: "INVALID_EVIDENCE_IDS_TYPE",
        field: "evidenceIds",
        message: `Field 'evidenceIds' must be an array of strings, got ${typeof candidate.evidenceIds}.`,
      });
    } else {
      const seenIds = new Set<string>();
      candidate.evidenceIds.forEach((item, index) => {
        if (typeof item !== "string") {
          errors.push({
            code: "INVALID_EVIDENCE_ID_ELEMENT",
            field: `evidenceIds[${index}]`,
            message: `Element at index ${index} in 'evidenceIds' must be a string.`,
          });
        } else {
          const trimmed = item.trim();
          if (trimmed.length === 0) {
            errors.push({
              code: "EMPTY_EVIDENCE_ID",
              field: `evidenceIds[${index}]`,
              message: `Element at index ${index} in 'evidenceIds' cannot be empty or whitespace.`,
            });
          } else if (isDisallowedTokenHeuristic(trimmed)) {
            errors.push({
              code: "DISALLOWED_TOKEN_HEURISTIC",
              field: `evidenceIds[${index}]`,
              message: `Evidence id at index ${index} contains disallowed heuristic token: '${trimmed}'.`,
            });
          } else if (seenIds.has(trimmed)) {
            errors.push({
              code: "DUPLICATE_EVIDENCE_ID",
              field: `evidenceIds[${index}]`,
              message: `Duplicate evidence id '${trimmed}' found in 'evidenceIds'.`,
            });
          } else {
            seenIds.add(trimmed);
          }
        }
      });
    }
  }

  // 8. sourceReference (optional)
  if (candidate.sourceReference !== undefined && candidate.sourceReference !== null) {
    if (typeof candidate.sourceReference !== "string") {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        field: "sourceReference",
        message: `Field 'sourceReference' must be a string, got ${typeof candidate.sourceReference}.`,
      });
    } else if (candidate.sourceReference.trim().length === 0) {
      errors.push({
        code: "EMPTY_FIELD_VALUE",
        field: "sourceReference",
        message: "Field 'sourceReference' cannot be empty or whitespace when specified.",
      });
    }
  }

  // 9. notes (optional)
  if (candidate.notes !== undefined && candidate.notes !== null) {
    if (typeof candidate.notes !== "string") {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        field: "notes",
        message: `Field 'notes' must be a string, got ${typeof candidate.notes}.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide les paramètres d'une requête de résolution de compatibilité.
 */
export function validateCompatibilityMatrixQuery(
  leftEntityType: unknown,
  leftEntityId: unknown,
  rightEntityType: unknown,
  rightEntityId: unknown
): CompatibilityMatrixQueryValidationResult {
  const errors: CompatibilityMatrixValidationError[] = [];

  // leftEntityType
  if (leftEntityType === undefined || leftEntityType === null) {
    errors.push({
      code: "MISSING_LEFT_ENTITY_TYPE",
      field: "leftEntityType",
      message: "Query parameter 'leftEntityType' is required.",
    });
  } else if (!ALLOWED_COMPATIBILITY_ENTITY_TYPES.includes(leftEntityType as NormativeCompatibilityEntityType)) {
    errors.push({
      code: "INVALID_LEFT_ENTITY_TYPE",
      field: "leftEntityType",
      message: `Query parameter 'leftEntityType' must be one of [${ALLOWED_COMPATIBILITY_ENTITY_TYPES.join(", ")}], got '${String(leftEntityType)}'.`,
    });
  }

  // leftEntityId
  if (leftEntityId === undefined || leftEntityId === null) {
    errors.push({
      code: "MISSING_LEFT_ENTITY_ID",
      field: "leftEntityId",
      message: "Query parameter 'leftEntityId' is required.",
    });
  } else if (typeof leftEntityId !== "string") {
    errors.push({
      code: "INVALID_LEFT_ENTITY_ID_TYPE",
      field: "leftEntityId",
      message: `Query parameter 'leftEntityId' must be a string, got ${typeof leftEntityId}.`,
    });
  } else {
    const trimmed = leftEntityId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_LEFT_ENTITY_ID",
        field: "leftEntityId",
        message: "Query parameter 'leftEntityId' cannot be empty or whitespace.",
      });
    } else if (isDisallowedTokenHeuristic(trimmed)) {
      errors.push({
        code: "DISALLOWED_TOKEN_HEURISTIC",
        field: "leftEntityId",
        message: `Query parameter 'leftEntityId' contains disallowed heuristic token: '${trimmed}'.`,
      });
    }
  }

  // rightEntityType
  if (rightEntityType === undefined || rightEntityType === null) {
    errors.push({
      code: "MISSING_RIGHT_ENTITY_TYPE",
      field: "rightEntityType",
      message: "Query parameter 'rightEntityType' is required.",
    });
  } else if (!ALLOWED_COMPATIBILITY_ENTITY_TYPES.includes(rightEntityType as NormativeCompatibilityEntityType)) {
    errors.push({
      code: "INVALID_RIGHT_ENTITY_TYPE",
      field: "rightEntityType",
      message: `Query parameter 'rightEntityType' must be one of [${ALLOWED_COMPATIBILITY_ENTITY_TYPES.join(", ")}], got '${String(rightEntityType)}'.`,
    });
  }

  // rightEntityId
  if (rightEntityId === undefined || rightEntityId === null) {
    errors.push({
      code: "MISSING_RIGHT_ENTITY_ID",
      field: "rightEntityId",
      message: "Query parameter 'rightEntityId' is required.",
    });
  } else if (typeof rightEntityId !== "string") {
    errors.push({
      code: "INVALID_RIGHT_ENTITY_ID_TYPE",
      field: "rightEntityId",
      message: `Query parameter 'rightEntityId' must be a string, got ${typeof rightEntityId}.`,
    });
  } else {
    const trimmed = rightEntityId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_RIGHT_ENTITY_ID",
        field: "rightEntityId",
        message: "Query parameter 'rightEntityId' cannot be empty or whitespace.",
      });
    } else if (isDisallowedTokenHeuristic(trimmed)) {
      errors.push({
        code: "DISALLOWED_TOKEN_HEURISTIC",
        field: "rightEntityId",
        message: `Query parameter 'rightEntityId' contains disallowed heuristic token: '${trimmed}'.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
