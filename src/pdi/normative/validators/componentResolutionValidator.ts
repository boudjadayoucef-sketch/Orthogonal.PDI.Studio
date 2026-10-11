/**
 * PDI NORMATIVE ENGINE — COMPONENT RESOLUTION VALIDATOR
 * Reference: COMPONENT-04 (Component Resolution Orchestrator)
 * 
 * Validateur d'intégrité pour les demandes de résolution de composants.
 * Réutilise les validateurs de base de COMPONENT-01 et NORM-09 sans dupliquer de logique.
 */

import { isRecordObject } from "./pipeDimensionalValidator";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";
import {
  validateComponentSelectionContext,
  type ComponentSelectionValidationResult,
} from "./componentSelectionValidator";
import type { ComponentSelectionContext } from "../types/componentSelectionTypes";

/**
 * Valide structurellement une requête de résolution de composant.
 */
export function validateComponentResolutionRequest(
  raw: unknown
): ComponentSelectionValidationResult {
  const errors: string[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: ["Request must be a non-null, non-array object."],
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

  // context
  if (raw.context === undefined || raw.context === null) {
    errors.push("context is required.");
  } else {
    const contextValidation = validateComponentSelectionContext(raw.context);
    if (!contextValidation.valid) {
      errors.push(...contextValidation.errors);
    } else {
      const typedContext = raw.context as ComponentSelectionContext;
      if (
        typeof raw.specificationId === "string" &&
        typedContext.specificationId !== raw.specificationId
      ) {
        errors.push(
          `specificationId mismatch: request has '${raw.specificationId}' but context has '${typedContext.specificationId}'.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
