/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION RESOLVER VALIDATOR
 * Reference: SPEC-01 (Piping Specification Resolver)
 * 
 * Validateur d'intégrité à l'exécution pour le contexte de résolution d'une Piping Spec.
 */

import { isRecordObject } from "./pipeDimensionalValidator";
import type { PipingSpecResolutionContext } from "../types/pipingSpecResolverTypes";

export interface PipingSpecResolutionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const DISALLOWED_HEURISTIC_TOKENS = Object.freeze([
  "approx",
  "approximately",
  "estimated",
  "maybe",
  "guess",
  "auto_converted",
  "inferred",
]);

/**
 * Détecte les termes heuristiques ou approximatifs interdits dans les valeurs textuelles.
 */
function containsForbiddenHeuristicToken(val: string): boolean {
  const lower = val.toLowerCase();
  return DISALLOWED_HEURISTIC_TOKENS.some((token) => lower.includes(token));
}

/**
 * Valide structurellement et sémantiquement un contexte de résolution Piping Spec.
 */
export function validatePipingSpecResolutionContext(
  raw: unknown
): PipingSpecResolutionValidationResult {
  const errors: string[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: ["Resolution context must be a non-null, non-array plain object."],
    };
  }

  // 1. specificationId (obligatoire)
  if (typeof raw.specificationId !== "string" || raw.specificationId.trim() === "") {
    errors.push("specificationId is mandatory and must be a non-empty string.");
  } else if (containsForbiddenHeuristicToken(raw.specificationId)) {
    errors.push(`specificationId contains forbidden heuristic token: '${raw.specificationId}'`);
  }

  // 2. componentType (obligatoire)
  if (typeof raw.componentType !== "string" || raw.componentType.trim() === "") {
    errors.push("componentType is mandatory and must be a non-empty string.");
  } else if (containsForbiddenHeuristicToken(raw.componentType)) {
    errors.push(`componentType contains forbidden heuristic token: '${raw.componentType}'`);
  }

  // 3. nominalSize (optionnel mais doit être string valide sans heuristique)
  if (raw.nominalSize !== undefined) {
    if (typeof raw.nominalSize !== "string" || raw.nominalSize.trim() === "") {
      errors.push("nominalSize, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.nominalSize)) {
      errors.push(`nominalSize contains forbidden heuristic token: '${raw.nominalSize}'`);
    }
  }

  // 4. schedule (optionnel)
  if (raw.schedule !== undefined) {
    if (typeof raw.schedule !== "string" || raw.schedule.trim() === "") {
      errors.push("schedule, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.schedule)) {
      errors.push(`schedule contains forbidden heuristic token: '${raw.schedule}'`);
    }
  }

  // 5. materialId (optionnel)
  if (raw.materialId !== undefined) {
    if (typeof raw.materialId !== "string" || raw.materialId.trim() === "") {
      errors.push("materialId, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.materialId)) {
      errors.push(`materialId contains forbidden heuristic token: '${raw.materialId}'`);
    }
  }

  // 6. fittingType (optionnel)
  if (raw.fittingType !== undefined) {
    if (typeof raw.fittingType !== "string" || raw.fittingType.trim() === "") {
      errors.push("fittingType, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.fittingType)) {
      errors.push(`fittingType contains forbidden heuristic token: '${raw.fittingType}'`);
    }
  }

  // 7. connectionType (optionnel)
  if (raw.connectionType !== undefined) {
    if (typeof raw.connectionType !== "string" || raw.connectionType.trim() === "") {
      errors.push("connectionType, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.connectionType)) {
      errors.push(`connectionType contains forbidden heuristic token: '${raw.connectionType}'`);
    }
  }

  // 8. dimensionalStandardId (optionnel)
  if (raw.dimensionalStandardId !== undefined) {
    if (typeof raw.dimensionalStandardId !== "string" || raw.dimensionalStandardId.trim() === "") {
      errors.push("dimensionalStandardId, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.dimensionalStandardId)) {
      errors.push(`dimensionalStandardId contains forbidden heuristic token: '${raw.dimensionalStandardId}'`);
    }
  }

  // 9. productStandardId (optionnel)
  if (raw.productStandardId !== undefined) {
    if (typeof raw.productStandardId !== "string" || raw.productStandardId.trim() === "") {
      errors.push("productStandardId, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.productStandardId)) {
      errors.push(`productStandardId contains forbidden heuristic token: '${raw.productStandardId}'`);
    }
  }

  // 10. ratingSystem (optionnel)
  if (raw.ratingSystem !== undefined) {
    if (typeof raw.ratingSystem !== "string" || raw.ratingSystem.trim() === "") {
      errors.push("ratingSystem, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.ratingSystem)) {
      errors.push(`ratingSystem contains forbidden heuristic token: '${raw.ratingSystem}'`);
    }
  }

  // 11. ratingValue (optionnel)
  if (raw.ratingValue !== undefined) {
    if (typeof raw.ratingValue !== "string" || raw.ratingValue.trim() === "") {
      errors.push("ratingValue, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.ratingValue)) {
      errors.push(`ratingValue contains forbidden heuristic token: '${raw.ratingValue}'`);
    }
  }

  // 12. designCodeId (optionnel)
  if (raw.designCodeId !== undefined) {
    if (typeof raw.designCodeId !== "string" || raw.designCodeId.trim() === "") {
      errors.push("designCodeId, if provided, must be a non-empty string.");
    } else if (containsForbiddenHeuristicToken(raw.designCodeId)) {
      errors.push(`designCodeId contains forbidden heuristic token: '${raw.designCodeId}'`);
    }
  }

  // 13. evidenceIds (optionnel mais doit être un array de strings non vides)
  if (raw.evidenceIds !== undefined) {
    if (!Array.isArray(raw.evidenceIds)) {
      errors.push("evidenceIds, if provided, must be an array of strings.");
    } else {
      for (let i = 0; i < raw.evidenceIds.length; i++) {
        const ev = raw.evidenceIds[i];
        if (typeof ev !== "string" || ev.trim() === "") {
          errors.push(`evidenceIds[${i}] must be a non-empty string.`);
        } else if (containsForbiddenHeuristicToken(ev)) {
          errors.push(`evidenceIds[${i}] contains forbidden heuristic token: '${ev}'`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
