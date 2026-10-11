/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY VALIDATOR
 * Reference: NORM-13 (Normative Compatibility Matrix)
 * 
 * Validateur structurel déterministe pour les règles et contextes de compatibilité normative.
 * RÈGLES DE VALIDATION :
 * 1. Rejet strict de null, primitives, arrays.
 * 2. ruleId obligatoire, non vide, sans token heuristique interdit.
 * 3. description obligatoire, non vide.
 * 4. status valide ("COMPATIBLE" | "INCOMPATIBLE" | "UNVERIFIED" | "INVALID").
 * 5. evidenceIds (si fourni) : tableau de chaînes non vides sans token heuristique interdit.
 * 6. Tous les champs textuels optionnels doivent être des chaînes non vides et exempts de tokens interdits.
 * 7. Aucune inférence ou logique implicite.
 */

import type {
  CompatibilityStatus,
  NormativeCompatibilityRule,
  NormativeCompatibilityContext,
} from "../types/normativeCompatibilityTypes";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";
import { isRecordObject } from "./pipeDimensionalValidator";

export type CompatibilityRuleValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_RULE_ID"
  | "EMPTY_RULE_ID"
  | "INVALID_RULE_ID_TYPE"
  | "MISSING_DESCRIPTION"
  | "EMPTY_DESCRIPTION"
  | "INVALID_DESCRIPTION_TYPE"
  | "MISSING_STATUS"
  | "INVALID_STATUS"
  | "INVALID_EVIDENCE_IDS_TYPE"
  | "INVALID_EVIDENCE_ID_ELEMENT"
  | "EMPTY_EVIDENCE_ID"
  | "INVALID_FIELD_TYPE"
  | "EMPTY_FIELD_VALUE"
  | "DISALLOWED_TOKEN_HEURISTIC";

export interface CompatibilityRuleValidationError {
  readonly code: CompatibilityRuleValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface CompatibilityRuleValidationResult {
  readonly valid: boolean;
  readonly errors: readonly CompatibilityRuleValidationError[];
}

export type CompatibilityContextValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "INVALID_FIELD_TYPE"
  | "EMPTY_FIELD_VALUE"
  | "INVALID_EVIDENCE_IDS_TYPE"
  | "INVALID_EVIDENCE_ID_ELEMENT"
  | "EMPTY_EVIDENCE_ID"
  | "INVALID_NUMERIC_VALUE"
  | "DISALLOWED_TOKEN_HEURISTIC";

export interface CompatibilityContextValidationError {
  readonly code: CompatibilityContextValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface CompatibilityContextValidationResult {
  readonly valid: boolean;
  readonly errors: readonly CompatibilityContextValidationError[];
}

const VALID_COMPATIBILITY_STATUSES: readonly CompatibilityStatus[] = Object.freeze([
  "COMPATIBLE",
  "INCOMPATIBLE",
  "UNVERIFIED",
  "INVALID",
]);

const OPTIONAL_STRING_FIELDS: readonly (keyof NormativeCompatibilityRule)[] = Object.freeze([
  "standardId",
  "editionId",
  "componentType",
  "connectionType",
  "nominalSize",
  "schedule",
  "pressureRating",
  "materialId",
  "materialForm",
  "designCodeId",
  "pipingSpecId",
  "sourceReference",
]);

/**
 * Valide structurellement une instance de NormativeCompatibilityRule.
 */
export function validateNormativeCompatibilityRule(
  raw: unknown
): CompatibilityRuleValidationResult {
  const errors: CompatibilityRuleValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Compatibility rule must be a non-null, non-array object.",
        },
      ],
    };
  }

  // 1. ruleId
  if (raw.ruleId === undefined || raw.ruleId === null) {
    errors.push({
      code: "MISSING_RULE_ID",
      field: "ruleId",
      message: "ruleId is required.",
    });
  } else if (typeof raw.ruleId !== "string") {
    errors.push({
      code: "INVALID_RULE_ID_TYPE",
      field: "ruleId",
      message: "ruleId must be a string.",
    });
  } else if (raw.ruleId.trim().length === 0) {
    errors.push({
      code: "EMPTY_RULE_ID",
      field: "ruleId",
      message: "ruleId cannot be empty or whitespace.",
    });
  } else if (isDisallowedTokenHeuristic(raw.ruleId)) {
    errors.push({
      code: "DISALLOWED_TOKEN_HEURISTIC",
      field: "ruleId",
      message: `ruleId '${raw.ruleId}' contains a disallowed heuristic token pattern.`,
    });
  }

  // 2. description
  if (raw.description === undefined || raw.description === null) {
    errors.push({
      code: "MISSING_DESCRIPTION",
      field: "description",
      message: "description is required.",
    });
  } else if (typeof raw.description !== "string") {
    errors.push({
      code: "INVALID_DESCRIPTION_TYPE",
      field: "description",
      message: "description must be a string.",
    });
  } else if (raw.description.trim().length === 0) {
    errors.push({
      code: "EMPTY_DESCRIPTION",
      field: "description",
      message: "description cannot be empty.",
    });
  }

  // 3. status
  if (raw.status === undefined || raw.status === null) {
    errors.push({
      code: "MISSING_STATUS",
      field: "status",
      message: "status is required.",
    });
  } else if (!VALID_COMPATIBILITY_STATUSES.includes(raw.status as CompatibilityStatus)) {
    errors.push({
      code: "INVALID_STATUS",
      field: "status",
      message: `status '${String(raw.status)}' is invalid. Must be one of: ${VALID_COMPATIBILITY_STATUSES.join(", ")}.`,
    });
  }

  // 4. evidenceIds
  if (raw.evidenceIds !== undefined && raw.evidenceIds !== null) {
    if (!Array.isArray(raw.evidenceIds)) {
      errors.push({
        code: "INVALID_EVIDENCE_IDS_TYPE",
        field: "evidenceIds",
        message: "evidenceIds must be an array of strings if provided.",
      });
    } else {
      raw.evidenceIds.forEach((item: unknown, index: number) => {
        if (typeof item !== "string") {
          errors.push({
            code: "INVALID_EVIDENCE_ID_ELEMENT",
            field: `evidenceIds[${index}]`,
            message: `evidenceId at index ${index} must be a string.`,
          });
        } else if (item.trim().length === 0) {
          errors.push({
            code: "EMPTY_EVIDENCE_ID",
            field: `evidenceIds[${index}]`,
            message: `evidenceId at index ${index} cannot be empty.`,
          });
        } else if (isDisallowedTokenHeuristic(item)) {
          errors.push({
            code: "DISALLOWED_TOKEN_HEURISTIC",
            field: `evidenceIds[${index}]`,
            message: `evidenceId '${item}' contains a disallowed heuristic token pattern.`,
          });
        }
      });
    }
  }

  // 5. Optional string fields validation
  for (const field of OPTIONAL_STRING_FIELDS) {
    const val = raw[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "string") {
        errors.push({
          code: "INVALID_FIELD_TYPE",
          field: String(field),
          message: `${String(field)} must be a string if provided.`,
        });
      } else if (val.trim().length === 0) {
        errors.push({
          code: "EMPTY_FIELD_VALUE",
          field: String(field),
          message: `${String(field)} cannot be an empty string if provided.`,
        });
      } else if (isDisallowedTokenHeuristic(val)) {
        errors.push({
          code: "DISALLOWED_TOKEN_HEURISTIC",
          field: String(field),
          message: `${String(field)} '${val}' contains a disallowed heuristic token pattern.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide structurellement une instance de NormativeCompatibilityContext.
 */
export function validateNormativeCompatibilityContext(
  raw: unknown
): CompatibilityContextValidationResult {
  const errors: CompatibilityContextValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Compatibility context must be a non-null, non-array object.",
        },
      ],
    };
  }

  const contextStringFields: readonly (keyof NormativeCompatibilityContext)[] = [
    "standardId",
    "editionId",
    "componentType",
    "connectionType",
    "nominalSize",
    "schedule",
    "pressureRating",
    "materialId",
    "materialForm",
    "designCodeId",
    "pipingSpecId",
  ];

  for (const field of contextStringFields) {
    const val = raw[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "string") {
        errors.push({
          code: "INVALID_FIELD_TYPE",
          field: String(field),
          message: `${String(field)} must be a string if provided.`,
        });
      } else if (val.trim().length === 0) {
        errors.push({
          code: "EMPTY_FIELD_VALUE",
          field: String(field),
          message: `${String(field)} cannot be an empty string if provided.`,
        });
      } else if (isDisallowedTokenHeuristic(val)) {
        errors.push({
          code: "DISALLOWED_TOKEN_HEURISTIC",
          field: String(field),
          message: `${String(field)} '${val}' contains a disallowed heuristic token pattern.`,
        });
      }
    }
  }

  // Numeric fields
  const numericFields: readonly (keyof NormativeCompatibilityContext)[] = [
    "temperatureC",
    "pressureBar",
  ];

  for (const field of numericFields) {
    const val = raw[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "number" || !Number.isFinite(val)) {
        errors.push({
          code: "INVALID_NUMERIC_VALUE",
          field: String(field),
          message: `${String(field)} must be a finite number if provided.`,
        });
      }
    }
  }

  // evidenceIds
  if (raw.evidenceIds !== undefined && raw.evidenceIds !== null) {
    if (!Array.isArray(raw.evidenceIds)) {
      errors.push({
        code: "INVALID_EVIDENCE_IDS_TYPE",
        field: "evidenceIds",
        message: "evidenceIds must be an array of strings if provided.",
      });
    } else {
      raw.evidenceIds.forEach((item: unknown, index: number) => {
        if (typeof item !== "string") {
          errors.push({
            code: "INVALID_EVIDENCE_ID_ELEMENT",
            field: `evidenceIds[${index}]`,
            message: `evidenceId at index ${index} must be a string.`,
          });
        } else if (item.trim().length === 0) {
          errors.push({
            code: "EMPTY_EVIDENCE_ID",
            field: `evidenceIds[${index}]`,
            message: `evidenceId at index ${index} cannot be empty.`,
          });
        } else if (isDisallowedTokenHeuristic(item)) {
          errors.push({
            code: "DISALLOWED_TOKEN_HEURISTIC",
            field: `evidenceIds[${index}]`,
            message: `evidenceId '${item}' contains a disallowed heuristic token pattern.`,
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
