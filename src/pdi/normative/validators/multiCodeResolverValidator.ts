/**
 * PDI NORMATIVE ENGINE — MULTI-CODE RESOLVER VALIDATOR
 * Reference: ARCH-09 (Multi-Code Resolver)
 *
 * Validateur strict et anti-heuristique du contexte de résolution multi-code.
 *
 * RÈGLES DE VALIDATION STRICTES (ARCH-09 §4) :
 * 1. Rejette tout contexte non-objet (null, primitif, tableau).
 * 2. Valide que `engineeringDomain`, s'il est fourni, est un `EngineeringDomainId` canonique
 *    ("PIPING" | "PIPELINE" | "PACKAGE" | "EQUIPMENT").
 * 3. Interdit formellement toute sélection ou déduction à partir d'un nom de client,
 *    d'une chaîne libre, d'une description ou d'un token heuristique.
 * 4. Valide `requestedCalculationType` et `unitSystem` via les type guards de NORM-08.
 * 5. Valide `requestedEdition` et `evidenceIds` sans inventer ni promouvoir de valeurs.
 */

import { isEngineeringDomainId } from "../../engineering/types/engineeringDomainTypes";
import { FORBIDDEN_HISTORICAL_CLIENT_PATTERNS } from "../../model/pdiIndustrialArchitectureAdapter";
import {
  isEngineeringCalculationType,
  isEngineeringUnitSystem,
  isRecordObject,
} from "./designCodeValidator";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";

export type MultiCodeResolverValidationErrorCode =
  | "INVALID_CONTEXT_OBJECT"
  | "INVALID_ENGINEERING_DOMAIN"
  | "INVALID_EXPLICIT_DESIGN_CODE_ID"
  | "INVALID_PIPING_SPEC_ID"
  | "INVALID_PROJECT_DESIGN_CODE_ID"
  | "INVALID_CANDIDATE_DESIGN_CODE_IDS"
  | "INVALID_REQUESTED_CALCULATION_TYPE"
  | "INVALID_UNIT_SYSTEM"
  | "INVALID_REQUESTED_EDITION"
  | "INVALID_EVIDENCE_IDS"
  | "DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT"
  | "DISALLOWED_CLIENT_NAME_INFLUENCE"
  | "DISALLOWED_TOKEN_HEURISTIC";

export interface MultiCodeResolverValidationError {
  readonly code: MultiCodeResolverValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface MultiCodeResolverValidationResult {
  readonly valid: boolean;
  readonly errors: readonly MultiCodeResolverValidationError[];
}

/**
 * Champs non structurés, textuels ou liés au client strictement interdits
 * dans un contexte de résolution de code de conception (ARCH-09 §4).
 */
export const FORBIDDEN_MULTI_CODE_HEURISTIC_FIELDS: readonly string[] = Object.freeze([
  "clientName",
  "client",
  "companyName",
  "organizationName",
  "customerName",
  "freeText",
  "freeTextHint",
  "heuristicHint",
  "queryText",
  "prompt",
  "naturalLanguageQuery",
  "descriptionHint",
  "projectDescription",
]);

/**
 * Motifs d'expressions libres ou d'heuristiques textuelles interdits dans un identifiant de code.
 */
function looksLikeFreeTextOrHeuristicCodeString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // Un identifiant de standard canonique ne contient pas d'espaces multiples ni de phrases
  if (/\s/.test(trimmed)) return true;
  // Vérifie les patterns clients historiques interdits
  for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

/**
 * Valide structurellement et sémantiquement un contexte `MultiCodeResolutionContext`.
 */
export function validateMultiCodeResolutionContext(
  raw: unknown
): MultiCodeResolverValidationResult {
  if (!isRecordObject(raw)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze([
        Object.freeze({
          code: "INVALID_CONTEXT_OBJECT",
          message: "Le contexte de résolution multi-code doit être un objet non-null et non-tableau.",
        }),
      ]),
    });
  }

  const errors: MultiCodeResolverValidationError[] = [];

  // 1. Détection de champs heuristiques, client ou texte libre interdits (ARCH-09 §4)
  for (const forbiddenField of FORBIDDEN_MULTI_CODE_HEURISTIC_FIELDS) {
    if (forbiddenField in raw && raw[forbiddenField] !== undefined && raw[forbiddenField] !== null) {
      const isClientField =
        forbiddenField === "clientName" ||
        forbiddenField === "client" ||
        forbiddenField === "companyName" ||
        forbiddenField === "organizationName" ||
        forbiddenField === "customerName";

      errors.push(
        Object.freeze({
          code: isClientField
            ? "DISALLOWED_CLIENT_NAME_INFLUENCE"
            : "DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT",
          field: forbiddenField,
          message: isClientField
            ? `Interdiction absolue (ARCH-09) : le champ client '${forbiddenField}' ne peut jamais intervenir dans la résolution d'un code de conception.`
            : `Interdiction absolue (ARCH-09) : le champ texte libre ou heuristique '${forbiddenField}' est interdit dans le resolver multi-code.`,
        })
      );
    }
  }

  // 2. Validation de engineeringDomain (ARCH-08)
  if ("engineeringDomain" in raw && raw.engineeringDomain !== undefined) {
    if (!isEngineeringDomainId(raw.engineeringDomain)) {
      errors.push(
        Object.freeze({
          code: "INVALID_ENGINEERING_DOMAIN",
          field: "engineeringDomain",
          message: `Domaine d'ingénierie invalide: '${String(raw.engineeringDomain)}'. Attendu: 'PIPING', 'PIPELINE', 'PACKAGE' ou 'EQUIPMENT'.`,
        })
      );
    }
  }

  // 3. Validation de explicitDesignCodeId
  if ("explicitDesignCodeId" in raw && raw.explicitDesignCodeId !== undefined) {
    if (typeof raw.explicitDesignCodeId !== "string" || raw.explicitDesignCodeId.trim().length === 0) {
      errors.push(
        Object.freeze({
          code: "INVALID_EXPLICIT_DESIGN_CODE_ID",
          field: "explicitDesignCodeId",
          message: "explicitDesignCodeId doit être une chaîne non vide.",
        })
      );
    } else {
      const trimmed = raw.explicitDesignCodeId.trim();
      if (isDisallowedTokenHeuristic(trimmed)) {
        errors.push(
          Object.freeze({
            code: "DISALLOWED_TOKEN_HEURISTIC",
            field: "explicitDesignCodeId",
            message: `Le token heuristique '${trimmed}' est interdit comme identifiant de code.`,
          })
        );
      } else if (looksLikeFreeTextOrHeuristicCodeString(trimmed)) {
        errors.push(
          Object.freeze({
            code: "DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT",
            field: "explicitDesignCodeId",
            message: `La valeur '${trimmed}' ressemble à une chaîne libre ou contient une identité client interdite. Seuls les identifiants structurés sont admis.`,
          })
        );
      }
    }
  }

  // 4. Validation de projectDefaultDesignCodeId
  if ("projectDefaultDesignCodeId" in raw && raw.projectDefaultDesignCodeId !== undefined) {
    if (
      typeof raw.projectDefaultDesignCodeId !== "string" ||
      raw.projectDefaultDesignCodeId.trim().length === 0
    ) {
      errors.push(
        Object.freeze({
          code: "INVALID_PROJECT_DESIGN_CODE_ID",
          field: "projectDefaultDesignCodeId",
          message: "projectDefaultDesignCodeId doit être une chaîne non vide.",
        })
      );
    } else {
      const trimmed = raw.projectDefaultDesignCodeId.trim();
      if (isDisallowedTokenHeuristic(trimmed)) {
        errors.push(
          Object.freeze({
            code: "DISALLOWED_TOKEN_HEURISTIC",
            field: "projectDefaultDesignCodeId",
            message: `Le token heuristique '${trimmed}' est interdit dans projectDefaultDesignCodeId.`,
          })
        );
      } else if (looksLikeFreeTextOrHeuristicCodeString(trimmed)) {
        errors.push(
          Object.freeze({
            code: "DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT",
            field: "projectDefaultDesignCodeId",
            message: `La valeur '${trimmed}' dans projectDefaultDesignCodeId est une chaîne libre ou un nom client interdit.`,
          })
        );
      }
    }
  }

  // 5. Validation de pipingSpecId
  if ("pipingSpecId" in raw && raw.pipingSpecId !== undefined) {
    if (typeof raw.pipingSpecId !== "string" || raw.pipingSpecId.trim().length === 0) {
      errors.push(
        Object.freeze({
          code: "INVALID_PIPING_SPEC_ID",
          field: "pipingSpecId",
          message: "pipingSpecId doit être une chaîne non vide.",
        })
      );
    } else {
      const trimmed = raw.pipingSpecId.trim();
      if (isDisallowedTokenHeuristic(trimmed)) {
        errors.push(
          Object.freeze({
            code: "DISALLOWED_TOKEN_HEURISTIC",
            field: "pipingSpecId",
            message: `Le token heuristique '${trimmed}' est interdit dans pipingSpecId.`,
          })
        );
      } else {
        for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
          if (pattern.test(trimmed)) {
            errors.push(
              Object.freeze({
                code: "DISALLOWED_CLIENT_NAME_INFLUENCE",
                field: "pipingSpecId",
                message: `pipingSpecId '${trimmed}' contient une référence client interdite.`,
              })
            );
            break;
          }
        }
      }
    }
  }

  // 6. Validation de candidateDesignCodeIds
  if ("candidateDesignCodeIds" in raw && raw.candidateDesignCodeIds !== undefined) {
    if (!Array.isArray(raw.candidateDesignCodeIds)) {
      errors.push(
        Object.freeze({
          code: "INVALID_CANDIDATE_DESIGN_CODE_IDS",
          field: "candidateDesignCodeIds",
          message: "candidateDesignCodeIds doit être un tableau de chaînes.",
        })
      );
    } else {
      for (const cid of raw.candidateDesignCodeIds) {
        if (typeof cid !== "string" || cid.trim().length === 0) {
          errors.push(
            Object.freeze({
              code: "INVALID_CANDIDATE_DESIGN_CODE_IDS",
              field: "candidateDesignCodeIds",
              message: "candidateDesignCodeIds ne peut contenir que des chaînes non vides.",
            })
          );
          break;
        }
        const trimmed = cid.trim();
        if (isDisallowedTokenHeuristic(trimmed)) {
          errors.push(
            Object.freeze({
              code: "DISALLOWED_TOKEN_HEURISTIC",
              field: "candidateDesignCodeIds",
              message: `Le token heuristique '${trimmed}' est interdit dans candidateDesignCodeIds.`,
            })
          );
        } else if (looksLikeFreeTextOrHeuristicCodeString(trimmed)) {
          errors.push(
            Object.freeze({
              code: "DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT",
              field: "candidateDesignCodeIds",
              message: `La valeur '${trimmed}' dans candidateDesignCodeIds est une chaîne libre ou client interdite.`,
            })
          );
        }
      }
    }
  }

  // 7. Validation de requestedCalculationType
  if ("requestedCalculationType" in raw && raw.requestedCalculationType !== undefined) {
    if (!isEngineeringCalculationType(raw.requestedCalculationType)) {
      errors.push(
        Object.freeze({
          code: "INVALID_REQUESTED_CALCULATION_TYPE",
          field: "requestedCalculationType",
          message: `Type de calcul invalide: '${String(raw.requestedCalculationType)}'.`,
        })
      );
    }
  }

  // 8. Validation de unitSystem
  if ("unitSystem" in raw && raw.unitSystem !== undefined) {
    if (!isEngineeringUnitSystem(raw.unitSystem)) {
      errors.push(
        Object.freeze({
          code: "INVALID_UNIT_SYSTEM",
          field: "unitSystem",
          message: `unitSystem invalide: '${String(raw.unitSystem)}'. Attendu: 'SI' ou 'US_CUSTOMARY'.`,
        })
      );
    }
  }

  // 9. Validation de requestedEdition
  if ("requestedEdition" in raw && raw.requestedEdition !== undefined) {
    if (!isRecordObject(raw.requestedEdition)) {
      errors.push(
        Object.freeze({
          code: "INVALID_REQUESTED_EDITION",
          field: "requestedEdition",
          message: "requestedEdition doit être un objet StandardEdition valide.",
        })
      );
    } else if (
      "year" in raw.requestedEdition &&
      raw.requestedEdition.year !== undefined &&
      (typeof raw.requestedEdition.year !== "string" ||
        !/^\d{4}$/.test(raw.requestedEdition.year.trim()))
    ) {
      errors.push(
        Object.freeze({
          code: "INVALID_REQUESTED_EDITION",
          field: "requestedEdition.year",
          message: "requestedEdition.year doit être une année à 4 chiffres (ex: '2024').",
        })
      );
    }
  }

  // 10. Validation de evidenceIds
  if ("evidenceIds" in raw && raw.evidenceIds !== undefined) {
    if (!Array.isArray(raw.evidenceIds)) {
      errors.push(
        Object.freeze({
          code: "INVALID_EVIDENCE_IDS",
          field: "evidenceIds",
          message: "evidenceIds doit être un tableau de chaînes.",
        })
      );
    } else {
      for (const eid of raw.evidenceIds) {
        if (typeof eid !== "string" || eid.trim().length === 0) {
          errors.push(
            Object.freeze({
              code: "INVALID_EVIDENCE_IDS",
              field: "evidenceIds",
              message: "evidenceIds ne doit contenir que des chaînes non vides.",
            })
          );
          break;
        }
        if (isDisallowedTokenHeuristic(eid.trim())) {
          errors.push(
            Object.freeze({
              code: "DISALLOWED_TOKEN_HEURISTIC",
              field: "evidenceIds",
              message: `Le token heuristique '${eid.trim()}' ne peut pas être utilisé comme evidenceId.`,
            })
          );
        }
      }
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}
