/**
 * PDI NORMATIVE ENGINE — FITTING VALIDATOR
 * Reference: PATCH NORM-03
 * 
 * Validateur d'intégrité structurelle et normativité pour `FittingDimensionalRecord`.
 * 
 * RÈGLE ARCHITECTURALE :
 * - Distingue la validation d'un record complet (validateCompleteFittingRecord)
 *   de la validation d'un record partiel (validatePartialFittingRecord).
 * - Exige la sécurité de typage strict à la frontière d'exécution (record: unknown).
 * - Vérifie l'appartenance du standardId aux standards produits (PRODUCT_STANDARD).
 * - N'effectue AUCUNE conversion automatique (ex: NPS ↔ DN) ni aucun calcul de rayon/OD.
 */

import type {
  FittingDimensionalRecord,
  FittingType,
  FittingConnectionType,
  FittingSourceStatus,
} from "../types/fittingTypes";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { isRecordObject } from "./pipeDimensionalValidator";

/**
 * Structure de retour standard pour le résultat de validation de raccord.
 */
export interface FittingValidationError {
  readonly code: string;
  readonly field: keyof FittingDimensionalRecord | string;
  readonly message: string;
}

export interface FittingValidationResult {
  readonly valid: boolean;
  readonly errors: readonly FittingValidationError[];
}

export const VALID_FITTING_TYPES: readonly FittingType[] = Object.freeze([
  "ELBOW",
  "TEE",
  "REDUCER",
  "CAP",
  "CROSS",
  "COUPLING",
  "UNION",
  "SOCKET_WELD_FITTING",
  "THREADED_FITTING",
  "OTHER",
]);

export const VALID_CONNECTION_TYPES: readonly FittingConnectionType[] = Object.freeze([
  "BUTT_WELD",
  "SOCKET_WELD",
  "THREADED",
  "UNKNOWN",
]);

export const VALID_SOURCE_STATUSES: readonly FittingSourceStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "LEGACY",
]);

const VALID_FITTING_TYPES_SET = new Set<string>(VALID_FITTING_TYPES);
const VALID_CONNECTION_TYPES_SET = new Set<string>(VALID_CONNECTION_TYPES);
const VALID_SOURCE_STATUSES_SET = new Set<string>(VALID_SOURCE_STATUSES);

// isRecordObject is imported from ./pipeDimensionalValidator

/**
 * Valide les règles conditionnelles et sémantiques communes sur un objet record.
 * Fonctionne directement sur Record<string, unknown> sans aucun cast dangereux.
 */
function validateFittingRecordRules(
  record: Record<string, unknown>
): FittingValidationResult {
  const errors: FittingValidationError[] = [];

  // Verification du standard (standardId) si présent
  if (record.standardId !== undefined) {
    if (typeof record.standardId !== "string" || record.standardId.trim() === "") {
      errors.push({
        code: "INVALID_STANDARD_ID",
        field: "standardId",
        message: "Le standardId doit être une chaîne non vide.",
      });
    } else {
      const normStandard = PDI_STANDARDS_REGISTRY[record.standardId];
      if (!normStandard) {
        errors.push({
          code: "INVALID_STANDARD_ID",
          field: "standardId",
          message: `Le standard ${record.standardId} n'est pas enregistré dans le registre NORM-01.`,
        });
      } else if (normStandard.standardType !== "PRODUCT_STANDARD") {
        errors.push({
          code: "STANDARD_IS_NOT_PRODUCT_STANDARD",
          field: "standardId",
          message: `Le standard ${record.standardId} est de type ${normStandard.standardType}. Les raccords requièrent un PRODUCT_STANDARD (ex: ASME-B16.9, ASME-B16.11).`,
        });
      }
    }
  }

  // Fitting Type
  if (record.fittingType !== undefined) {
    if (
      typeof record.fittingType !== "string" ||
      !VALID_FITTING_TYPES_SET.has(record.fittingType)
    ) {
      errors.push({
        code: "INVALID_FITTING_TYPE",
        field: "fittingType",
        message: `La famille de raccord '${String(record.fittingType)}' n'est pas valide.`,
      });
    }
  }

  // Connection Type
  if (record.connectionType !== undefined) {
    if (
      typeof record.connectionType !== "string" ||
      !VALID_CONNECTION_TYPES_SET.has(record.connectionType)
    ) {
      errors.push({
        code: "INVALID_CONNECTION_TYPE",
        field: "connectionType",
        message: `Le type de raccordement '${String(record.connectionType)}' n'est pas valide.`,
      });
    }
  }

  // Source Status & Traceability
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
        message: `Les raccords avec le statut '${record.sourceStatus}' exigent une référence source (sourceReference) non vide.`,
      });
    }
  }

  // DN (extrémité 1)
  if (record.dn !== undefined) {
    if (typeof record.dn !== "number" || isNaN(record.dn) || record.dn <= 0) {
      errors.push({
        code: "INVALID_DN",
        field: "dn",
        message: "Le diamètre nominal dn doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // endDn2 (extrémité 2)
  if (record.endDn2 !== undefined) {
    if (typeof record.endDn2 !== "number" || isNaN(record.endDn2) || record.endDn2 <= 0) {
      errors.push({
        code: "INVALID_END_DN2",
        field: "endDn2",
        message: "Le diamètre nominal de l'extrémité 2 (endDn2) doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // NPS (extrémité 1)
  if (record.nps !== undefined) {
    if (typeof record.nps !== "string" || record.nps.trim() === "") {
      errors.push({
        code: "EMPTY_NPS",
        field: "nps",
        message: "La désignation NPS ne peut pas être une chaîne vide.",
      });
    }
  }

  // endNps2 (extrémité 2)
  if (record.endNps2 !== undefined) {
    if (typeof record.endNps2 !== "string" || record.endNps2.trim() === "") {
      errors.push({
        code: "EMPTY_END_NPS2",
        field: "endNps2",
        message: "La désignation endNps2 ne peut pas être une chaîne vide.",
      });
    }
  }

  // Angle Degrés
  if (record.angleDeg !== undefined) {
    if (typeof record.angleDeg !== "number" || isNaN(record.angleDeg) || record.angleDeg <= 0) {
      errors.push({
        code: "INVALID_ANGLE_DEG",
        field: "angleDeg",
        message: "L'angle du raccord (angleDeg) doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // Radius Class
  if (record.radiusClass !== undefined) {
    if (typeof record.radiusClass !== "string" || record.radiusClass.trim() === "") {
      errors.push({
        code: "EMPTY_RADIUS_CLASS",
        field: "radiusClass",
        message: "La classe de rayon (radiusClass) ne peut pas être une chaîne vide si renseignée.",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un enregistrement partiel (Partial<FittingDimensionalRecord> ou inconnu).
 * L'entrée {} est un état partiel valide.
 * Toute entrée non objet (null, undefined, string, number, array, boolean) produit INVALID_RECORD_OBJECT.
 */
export function validatePartialFittingRecord(
  record: unknown
): FittingValidationResult {
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

  return validateFittingRecordRules(record);
}

/**
 * Valide un enregistrement complet (FittingDimensionalRecord).
 * Entrée typée en `unknown` pour garantir la sécurité de typage strict à la frontière runtime.
 * Exige impérativement la présence et la validité des champs de base : id, standardId, fittingType, connectionType, sourceStatus.
 */
export function validateCompleteFittingRecord(
  record: unknown
): FittingValidationResult {
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

  const errors: FittingValidationError[] = [];

  // Field: id
  if (record.id === undefined || record.id === null) {
    errors.push({
      code: "MISSING_RECORD_ID",
      field: "id",
      message: "L'identifiant du raccord (id) est obligatoire pour un record complet.",
    });
  } else if (typeof record.id !== "string" || record.id.trim() === "") {
    errors.push({
      code: "EMPTY_RECORD_ID",
      field: "id",
      message: "L'identifiant du raccord (id) ne peut pas être une chaîne vide.",
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

  // Field: fittingType
  if (record.fittingType === undefined || record.fittingType === null) {
    errors.push({
      code: "MISSING_FITTING_TYPE",
      field: "fittingType",
      message: "La famille de raccord (fittingType) est obligatoire pour un record complet.",
    });
  }

  // Field: connectionType
  if (record.connectionType === undefined || record.connectionType === null) {
    errors.push({
      code: "MISSING_CONNECTION_TYPE",
      field: "connectionType",
      message: "Le type de raccordement (connectionType) est obligatoire pour un record complet.",
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
  const rulesResult = validateFittingRecordRules(record);

  const combinedErrors = [...errors, ...rulesResult.errors];

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
  };
}

/**
 * Alias de compatibilité pour la validation de raccords.
 */
export const validateFittingRecord = validatePartialFittingRecord;
