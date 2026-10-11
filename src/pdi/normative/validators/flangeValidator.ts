/**
 * PDI NORMATIVE ENGINE — FLANGE VALIDATOR
 * Reference: PATCH NORM-04 (Flange Engine)
 * 
 * Validateur d'intégrité structurelle et normativité pour `FlangeDimensionalRecord`.
 * 
 * RÈGLE ARCHITECTURALE :
 * - Distingue la validation d'un record complet (validateCompleteFlangeRecord)
 *   de la validation d'un record partiel (validatePartialFlangeRecord).
 * - Exige la sécurité de typage strict à la frontière d'exécution (record: unknown).
 * - Sépare strictement les systèmes de rating ASME (ASME_CLASS) et EN (EN_PN).
 * - N'effectue AUCUNE conversion automatique (Class ↔ PN, NPS ↔ DN) et aucun calcul.
 */

import type {
  FlangeDimensionalRecord,
  FlangeType,
  FlangeRatingSystem,
  FlangeSourceStatus,
} from "../types/flangeTypes";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { isRecordObject } from "./pipeDimensionalValidator";

/**
 * Structure de retour standard pour le résultat de validation de bride.
 */
export interface FlangeValidationError {
  readonly code: string;
  readonly field: keyof FlangeDimensionalRecord | string;
  readonly message: string;
}

export interface FlangeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly FlangeValidationError[];
}

export const VALID_FLANGE_TYPES: readonly FlangeType[] = Object.freeze([
  "WELD_NECK",
  "SLIP_ON",
  "BLIND",
  "SOCKET_WELD",
  "THREADED",
  "LAP_JOINT",
  "ORIFICE",
  "LONG_WELD_NECK",
  "OTHER",
]);

export const VALID_RATING_SYSTEMS: readonly FlangeRatingSystem[] = Object.freeze([
  "ASME_CLASS",
  "EN_PN",
]);

export const VALID_FLANGE_SOURCE_STATUSES: readonly FlangeSourceStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "LEGACY",
]);

const VALID_FLANGE_TYPES_SET = new Set<string>(VALID_FLANGE_TYPES);
const VALID_RATING_SYSTEMS_SET = new Set<string>(VALID_RATING_SYSTEMS);
const VALID_SOURCE_STATUSES_SET = new Set<string>(VALID_FLANGE_SOURCE_STATUSES);

/**
 * Valide les règles conditionnelles et sémantiques communes sur un objet record de bride.
 * Fonctionne directement sur Record<string, unknown> de manière type-safe.
 */
function validateFlangeRecordRules(
  record: Record<string, unknown>
): FlangeValidationResult {
  const errors: FlangeValidationError[] = [];

  // 1. Validation du standardId si présent
  let standardObj: (typeof PDI_STANDARDS_REGISTRY)[string] | undefined;
  if (record.standardId !== undefined) {
    if (typeof record.standardId !== "string" || record.standardId.trim() === "") {
      errors.push({
        code: "INVALID_STANDARD_ID",
        field: "standardId",
        message: "Le standardId doit être une chaîne non vide.",
      });
    } else {
      standardObj = PDI_STANDARDS_REGISTRY[record.standardId];
      if (!standardObj) {
        errors.push({
          code: "INVALID_STANDARD_ID",
          field: "standardId",
          message: `Le standard ${record.standardId} n'est pas enregistré dans le registre NORM-01.`,
        });
      } else if (standardObj.standardType !== "PRODUCT_STANDARD") {
        errors.push({
          code: "STANDARD_IS_NOT_PRODUCT_STANDARD",
          field: "standardId",
          message: `Le standard ${record.standardId} est de type ${standardObj.standardType}. Les brides requièrent un PRODUCT_STANDARD (ex: ASME-B16.5, ASME-B16.47, EN-1092-1).`,
        });
      }
    }
  }

  // 2. Flange Type
  if (record.flangeType !== undefined) {
    if (
      typeof record.flangeType !== "string" ||
      !VALID_FLANGE_TYPES_SET.has(record.flangeType)
    ) {
      errors.push({
        code: "INVALID_FLANGE_TYPE",
        field: "flangeType",
        message: `La famille de bride '${String(record.flangeType)}' n'est pas valide.`,
      });
    }
  }

  // 3. Rating System
  if (record.ratingSystem !== undefined) {
    if (
      typeof record.ratingSystem !== "string" ||
      !VALID_RATING_SYSTEMS_SET.has(record.ratingSystem)
    ) {
      errors.push({
        code: "INVALID_RATING_SYSTEM",
        field: "ratingSystem",
        message: `Le système de rating '${String(record.ratingSystem)}' n'est pas valide (doit être ASME_CLASS ou EN_PN).`,
      });
    }
  }

  // 4. Cohérence Standard Family vs Rating System
  if (standardObj && record.ratingSystem !== undefined) {
    if (record.standardId === "ASME-B16.5" || record.standardId === "ASME-B16.47") {
      if (record.ratingSystem !== "ASME_CLASS") {
        errors.push({
          code: "INCOMPATIBLE_RATING_SYSTEM",
          field: "ratingSystem",
          message: `Le standard ${record.standardId} est de famille ASME et exige le système de rating 'ASME_CLASS'. Le rating '${String(record.ratingSystem)}' est interdit.`,
        });
      }
    } else if (record.standardId === "EN-1092-1") {
      if (record.ratingSystem !== "EN_PN") {
        errors.push({
          code: "INCOMPATIBLE_RATING_SYSTEM",
          field: "ratingSystem",
          message: `Le standard ${record.standardId} est de famille EN et exige le système de rating 'EN_PN'. Le rating '${String(record.ratingSystem)}' est interdit.`,
        });
      }
    }
  }

  // 5. Cohérence du Rating (valeur textuelle déclarative)
  if (record.rating !== undefined) {
    if (typeof record.rating !== "string" || record.rating.trim() === "") {
      errors.push({
        code: "EMPTY_RATING",
        field: "rating",
        message: "La désignation du rating ne peut pas être une chaîne vide si fournie.",
      });
    } else if (record.ratingSystem !== undefined) {
      const trimmedRating = record.rating.trim();
      if (record.ratingSystem === "ASME_CLASS") {
        if (/^PN\b/i.test(trimmedRating) || /\bPN\d+/i.test(trimmedRating)) {
          errors.push({
            code: "INCOMPATIBLE_RATING_VALUE",
            field: "rating",
            message: `Une bride sous ratingSystem 'ASME_CLASS' ne peut pas recevoir une valeur PN ('${trimmedRating}').`,
          });
        }
      } else if (record.ratingSystem === "EN_PN") {
        if (/^Class\b/i.test(trimmedRating) || /\bClass\s*\d+/i.test(trimmedRating)) {
          errors.push({
            code: "INCOMPATIBLE_RATING_VALUE",
            field: "rating",
            message: `Une bride sous ratingSystem 'EN_PN' ne peut pas recevoir une valeur Class ('${trimmedRating}').`,
          });
        }
      }
    }
  }

  // 6. Source Status & Traceability
  if (record.sourceStatus !== undefined) {
    if (
      typeof record.sourceStatus !== "string" ||
      !VALID_SOURCE_STATUSES_SET.has(record.sourceStatus)
    ) {
      errors.push({
        code: "INVALID_SOURCE_STATUS",
        field: "sourceStatus",
        message: `Le statut de source '${String(record.sourceStatus)}' n'est pas valide.`,
      });
    } else if (
      (record.sourceStatus === "VERIFIED" || record.sourceStatus === "LICENSED") &&
      (!record.sourceReference || typeof record.sourceReference !== "string" || record.sourceReference.trim() === "")
    ) {
      const code =
        record.sourceStatus === "VERIFIED"
          ? "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"
          : "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE";
      errors.push({
        code,
        field: "sourceReference",
        message: `Les brides avec le statut '${record.sourceStatus}' exigent une référence source (sourceReference) non vide.`,
      });
    }
  }

  // 7. NPS
  if (record.nps !== undefined) {
    if (typeof record.nps !== "string" || record.nps.trim() === "") {
      errors.push({
        code: "EMPTY_NPS",
        field: "nps",
        message: "La désignation NPS ne peut pas être une chaîne vide.",
      });
    }
  }

  // 8. DN
  if (record.dn !== undefined) {
    if (typeof record.dn !== "number" || isNaN(record.dn) || record.dn <= 0) {
      errors.push({
        code: "INVALID_DN",
        field: "dn",
        message: "Le diamètre nominal dn doit être un nombre strictement positif (> 0).",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un enregistrement partiel (Partial<FlangeDimensionalRecord> ou inconnu).
 * L'entrée {} est un état partiel valide.
 * Toute entrée non-objet (null, undefined, string, number, array, boolean) produit INVALID_RECORD_OBJECT.
 */
export function validatePartialFlangeRecord(
  record: unknown
): FlangeValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement partiel doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  return validateFlangeRecordRules(record);
}

/**
 * Valide un enregistrement complet (FlangeDimensionalRecord).
 * Entrée typée en `unknown` pour garantir la sécurité de typage strict à la frontière runtime.
 * Exige impérativement la présence et la validité des champs de base : id, standardId, flangeType, ratingSystem, sourceStatus.
 */
export function validateCompleteFlangeRecord(
  record: unknown
): FlangeValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement complet doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: FlangeValidationError[] = [];

  // Field: id
  if (record.id === undefined || record.id === null) {
    errors.push({
      code: "MISSING_RECORD_ID",
      field: "id",
      message: "L'identifiant de la bride (id) est obligatoire pour un record complet.",
    });
  } else if (typeof record.id !== "string" || record.id.trim() === "") {
    errors.push({
      code: "EMPTY_RECORD_ID",
      field: "id",
      message: "L'identifiant de la bride (id) ne peut pas être une chaîne vide.",
    });
  }

  // Field: standardId
  if (record.standardId === undefined || record.standardId === null) {
    errors.push({
      code: "MISSING_STANDARD_ID",
      field: "standardId",
      message: "Le standard d'origine (standardId) est obligatoire pour un record complet.",
    });
  }

  // Field: flangeType
  if (record.flangeType === undefined || record.flangeType === null) {
    errors.push({
      code: "MISSING_FLANGE_TYPE",
      field: "flangeType",
      message: "La famille de bride (flangeType) est obligatoire pour un record complet.",
    });
  }

  // Field: ratingSystem
  if (record.ratingSystem === undefined || record.ratingSystem === null) {
    errors.push({
      code: "MISSING_RATING_SYSTEM",
      field: "ratingSystem",
      message: "Le système de rating (ratingSystem) est obligatoire pour un record complet.",
    });
  }

  // Field: sourceStatus
  if (record.sourceStatus === undefined || record.sourceStatus === null) {
    errors.push({
      code: "MISSING_SOURCE_STATUS",
      field: "sourceStatus",
      message: "Le statut de source (sourceStatus) est obligatoire pour un record complet.",
    });
  }

  // Évaluation des règles partagées sans cast de type inutile
  const rulesResult = validateFlangeRecordRules(record);

  const combinedErrors = [...errors, ...rulesResult.errors];

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
  };
}

/**
 * Alias de compatibilité pour la validation de brides.
 */
export const validateFlangeRecord = validatePartialFlangeRecord;
