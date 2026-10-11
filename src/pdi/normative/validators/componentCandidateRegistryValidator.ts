/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE REGISTRY VALIDATOR
 * Reference: COMPONENT-03 (Component Candidate Registry & Resolver)
 * 
 * Validateur structurel et de cohérence pour l'enregistrement et la résolution
 * de candidats composants. Réutilise exclusivement les validateurs existants de COMPONENT-01.
 */

import {
  validateComponentCandidate,
  validateComponentSelectionContext,
  type ComponentSelectionValidationResult,
} from "./componentSelectionValidator";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";
import type { ComponentSelectionContext } from "../types/componentSelectionTypes";

export { validateComponentCandidate, validateComponentSelectionContext };

/**
 * Valide la cohérence structurelle entre specificationId et ComponentSelectionContext
 * avant toute délégation au moteur COMPONENT-02.
 */
export function validateResolverContextCoherence(
  specificationId: unknown,
  context: unknown
): ComponentSelectionValidationResult {
  const errors: string[] = [];

  if (typeof specificationId !== "string" || specificationId.trim().length === 0) {
    errors.push("specificationId must be a non-empty string.");
  } else if (isDisallowedTokenHeuristic(specificationId)) {
    errors.push(
      `specificationId contains disallowed heuristic token '${specificationId}'.`
    );
  }

  const contextVal = validateComponentSelectionContext(context);
  if (!contextVal.valid) {
    errors.push(...contextVal.errors);
  } else {
    const typedContext = context as ComponentSelectionContext;
    if (typeof specificationId === "string" && typedContext.specificationId !== specificationId) {
      errors.push(
        `specificationId mismatch: context specifies '${typedContext.specificationId}' but resolver received '${specificationId}'.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
