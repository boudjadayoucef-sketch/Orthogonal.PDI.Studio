/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE SELECTION VALIDATOR
 * Reference: COMPONENT-02 (Deterministic Component Candidate Selection)
 * 
 * Validateur d'intégrité structurelle pour ComponentCandidateSelectionInput.
 */

import { isRecordObject } from "./pipeDimensionalValidator";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";
import {
  validateComponentCandidate,
  validateComponentSelectionContext,
} from "./componentSelectionValidator";
import type { ComponentType } from "../types/componentSelectionTypes";

const VALID_COMPONENT_TYPES: readonly ComponentType[] = Object.freeze([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
]);

export interface ComponentCandidateSelectionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly duplicateIdsFound: boolean;
}

/**
 * Valide structurellement l'entrée d'une demande de sélection de candidat composant.
 */
export function validateComponentCandidateSelectionInput(
  raw: unknown
): ComponentCandidateSelectionValidationResult {
  const errors: string[] = [];
  let duplicateIdsFound = false;

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: ["Input must be a non-null, non-array object."],
      duplicateIdsFound: false,
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

  // context validation
  if (raw.context === undefined || raw.context === null) {
    errors.push("context is required.");
  } else {
    const ctxVal = validateComponentSelectionContext(raw.context);
    if (!ctxVal.valid) {
      for (const err of ctxVal.errors) {
        errors.push(`context validation error: ${err}`);
      }
    } else if (isRecordObject(raw.context)) {
      if (
        typeof raw.specificationId === "string" &&
        raw.context.specificationId !== raw.specificationId
      ) {
        errors.push(
          `specificationId mismatch: input specificationId '${raw.specificationId}' does not match context specificationId '${raw.context.specificationId}'.`
        );
      }
      if (
        typeof raw.componentType === "string" &&
        raw.context.componentType !== raw.componentType
      ) {
        errors.push(
          `componentType mismatch: input componentType '${raw.componentType}' does not match context componentType '${raw.context.componentType}'.`
        );
      }
    }
  }

  // candidates array validation
  if (raw.candidates === undefined || raw.candidates === null) {
    errors.push("candidates is required.");
  } else if (!Array.isArray(raw.candidates)) {
    errors.push("candidates must be an array.");
  } else {
    const seenIds = new Set<string>();
    for (let i = 0; i < raw.candidates.length; i++) {
      const cand = raw.candidates[i];
      if (!isRecordObject(cand)) {
        errors.push(`candidates[${i}] must be a non-null, non-array object.`);
        continue;
      }

      // Check candidate structure
      const candVal = validateComponentCandidate(cand);
      if (!candVal.valid) {
        for (const err of candVal.errors) {
          errors.push(`candidates[${i}] error: ${err}`);
        }
      }

      // Check duplicate candidateId
      if (typeof cand.candidateId === "string" && cand.candidateId.trim().length > 0) {
        const id = cand.candidateId.trim();
        if (seenIds.has(id)) {
          duplicateIdsFound = true;
          errors.push(
            `DUPLICATE_CANDIDATE_ID: candidateId '${id}' appears multiple times in candidates list.`
          );
        } else {
          seenIds.add(id);
        }
      }

      // Component type mismatch
      if (
        typeof raw.componentType === "string" &&
        typeof cand.componentType === "string" &&
        cand.componentType !== raw.componentType
      ) {
        errors.push(
          `candidates[${i}] componentType '${cand.componentType}' does not match input componentType '${raw.componentType}'.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    duplicateIdsFound,
  };
}
