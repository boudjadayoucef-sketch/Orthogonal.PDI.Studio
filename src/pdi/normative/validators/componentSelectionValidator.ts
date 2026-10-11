/**
 * PDI NORMATIVE ENGINE — COMPONENT SELECTION VALIDATOR
 * Reference: COMPONENT-01 (Component Selection Engine)
 * 
 * Validateur d'intégrité structurelle et de cohérence pour ComponentCandidate
 * et ComponentSelectionContext.
 */

import { isRecordObject } from "./pipeDimensionalValidator";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";
import type {
  ComponentType,
} from "../types/componentSelectionTypes";

const VALID_COMPONENT_TYPES: readonly ComponentType[] = Object.freeze([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
]);

export interface ComponentSelectionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Valide structurellement un candidat composant.
 */
export function validateComponentCandidate(
  raw: unknown
): ComponentSelectionValidationResult {
  const errors: string[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: ["Candidate must be a non-null, non-array object."],
    };
  }

  // candidateId
  if (raw.candidateId === undefined || raw.candidateId === null) {
    errors.push("candidateId is required.");
  } else if (typeof raw.candidateId !== "string" || raw.candidateId.trim().length === 0) {
    errors.push("candidateId must be a non-empty string.");
  } else if (isDisallowedTokenHeuristic(raw.candidateId)) {
    errors.push(`candidateId contains disallowed heuristic token '${raw.candidateId}'.`);
  }

  // componentType
  if (raw.componentType === undefined || raw.componentType === null) {
    errors.push("componentType is required.");
  } else if (
    typeof raw.componentType !== "string" ||
    !VALID_COMPONENT_TYPES.includes(raw.componentType as ComponentType)
  ) {
    errors.push(
      `componentType must be one of: ${VALID_COMPONENT_TYPES.join(", ")}.`
    );
  }

  // String fields if present
  const stringFields = [
    "productStandardId",
    "dimensionalStandardId",
    "fittingType",
    "valveType",
    "connectionType",
    "nominalSize",
    "schedule",
    "ratingSystem",
    "ratingValue",
    "materialId",
    "materialForm",
    "sourceReference",
  ];

  for (const field of stringFields) {
    const val = raw[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "string" || val.trim().length === 0) {
        errors.push(`${field} must be a non-empty string when provided.`);
      } else if (isDisallowedTokenHeuristic(val)) {
        errors.push(`${field} contains disallowed heuristic token '${val}'.`);
      }
    }
  }

  // evidenceIds
  if (raw.evidenceIds !== undefined && raw.evidenceIds !== null) {
    if (!Array.isArray(raw.evidenceIds)) {
      errors.push("evidenceIds must be an array of strings when provided.");
    } else {
      for (const eid of raw.evidenceIds) {
        if (typeof eid !== "string" || eid.trim().length === 0) {
          errors.push("evidenceIds contains empty or non-string elements.");
          break;
        }
        if (isDisallowedTokenHeuristic(eid)) {
          errors.push(`evidenceIds contains disallowed heuristic token '${eid}'.`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide structurellement un contexte de sélection de composant.
 */
export function validateComponentSelectionContext(
  raw: unknown
): ComponentSelectionValidationResult {
  const errors: string[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: ["Context must be a non-null, non-array object."],
    };
  }

  // specificationId
  if (raw.specificationId === undefined || raw.specificationId === null) {
    errors.push("specificationId is required.");
  } else if (
    typeof raw.specificationId !== "string" ||
    raw.specificationId.trim().length === 0
  ) {
    errors.push("specificationId must be a non-empty string.");
  } else if (isDisallowedTokenHeuristic(raw.specificationId)) {
    errors.push(
      `specificationId contains disallowed heuristic token '${raw.specificationId}'.`
    );
  }

  // componentType
  if (raw.componentType === undefined || raw.componentType === null) {
    errors.push("componentType is required.");
  } else if (
    typeof raw.componentType !== "string" ||
    !VALID_COMPONENT_TYPES.includes(raw.componentType as ComponentType)
  ) {
    errors.push(
      `componentType must be one of: ${VALID_COMPONENT_TYPES.join(", ")}.`
    );
  }

  // String fields if present
  const stringFields = [
    "productStandardId",
    "dimensionalStandardId",
    "fittingType",
    "valveType",
    "connectionType",
    "nominalSize",
    "schedule",
    "ratingSystem",
    "ratingValue",
    "materialId",
    "materialForm",
  ];

  for (const field of stringFields) {
    const val = raw[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "string" || val.trim().length === 0) {
        errors.push(`${field} must be a non-empty string when provided.`);
      } else if (isDisallowedTokenHeuristic(val)) {
        errors.push(`${field} contains disallowed heuristic token '${val}'.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
