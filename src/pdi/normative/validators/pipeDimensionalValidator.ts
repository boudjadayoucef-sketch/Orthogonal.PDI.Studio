/**
 * PDI NORMATIVE ENGINE — PIPE DIMENSIONAL VALIDATOR
 * Reference: PATCH NORM-02-R1.1 (Complete Record Validation — Type Safety)
 * 
 * Validateur d'intégrité structurelle pour `PipeDimensionalRecord`.
 * 
 * RÈGLE FONDAMENTALE (NORM-02-R1.1) :
 * - Distingue explicitement la validation d'un record complet (validateCompletePipeDimensionalRecord)
 *   de la validation d'un record partiel (validatePartialPipeDimensionalRecord).
 * - Garantit la sécurité de typage strict à la frontière d'exécution (record: unknown).
 * - Ne calcule PAS de conformité normative ASME/DIN/ISO (pas de Barlow, pas de calcul d'épaisseur).
 * - N'effectue AUCUNE conversion automatique (ex: NPS ↔ DN, Schedule → épaisseur).
 */

import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import type { PipeDimensionalRecord, PipeType, PipeSourceStatus } from "../types/pipeDimensionalTypes";

/**
 * Codes d'erreur fortement typés pour la traçabilité et la validation NORM-02-R1.1.
 */
export type PipeDimensionalValidationErrorCode =
  | "MISSING_RECORD_ID"
  | "EMPTY_RECORD_ID"
  | "MISSING_STANDARD_ID"
  | "MISSING_UNIT_SYSTEM"
  | "MISSING_SOURCE_STATUS"
  | "INVALID_UNIT_SYSTEM"
  | "INVALID_SOURCE_STATUS"
  | "INVALID_STANDARD_ID"
  | "STANDARD_IS_NOT_DIMENSIONAL"
  | "MISSING_SOURCE_REFERENCE"
  | "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"
  | "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"
  | "INVALID_DN"
  | "INVALID_OUTSIDE_DIAMETER"
  | "INVALID_WALL_THICKNESS"
  | "EMPTY_NPS"
  | "EMPTY_SCHEDULE"
  | "INVALID_PIPE_TYPE";

export interface PipeDimensionalValidationError {
  readonly code: PipeDimensionalValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface PipeDimensionalValidationResult {
  readonly valid: boolean;
  readonly errors: readonly PipeDimensionalValidationError[];
}

const VALID_PIPE_TYPES: readonly PipeType[] = Object.freeze([
  "WELDED",
  "SEAMLESS",
  "WELDED_OR_SEAMLESS",
  "UNKNOWN",
]);

const VALID_SOURCE_STATUSES: readonly PipeSourceStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "LEGACY",
]);

/**
 * Type Guard pour vérifier qu'une valeur d'entrée inconnue est un objet non-null et non-tableau.
 */
export function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Valide un enregistrement partiel (Partial<PipeDimensionalRecord>).
 * Valide uniquement les champs présents sans exiger la présence des champs obligatoires du record complet.
 */
export function validatePartialPipeDimensionalRecord(
  record: Partial<PipeDimensionalRecord>
): PipeDimensionalValidationResult {
  const errors: PipeDimensionalValidationError[] = [];

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { valid: true, errors: [] };
  }

  // Traçabilité de la source si sourceStatus est présent
  if (record.sourceStatus === "VERIFIED") {
    if (!record.sourceReference || record.sourceReference.trim().length === 0) {
      errors.push({
        code: "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE",
        field: "sourceReference",
        message: "Un enregistrement VERIFIED requiert obligatoirement une référence de source non vide.",
      });
      errors.push({
        code: "MISSING_SOURCE_REFERENCE",
        field: "sourceReference",
        message: "Référence source manquante.",
      });
    }
  } else if (record.sourceStatus === "LICENSED") {
    if (!record.sourceReference || record.sourceReference.trim().length === 0) {
      errors.push({
        code: "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE",
        field: "sourceReference",
        message: "Un enregistrement LICENSED requiert obligatoirement une référence de licence/source non vide.",
      });
      errors.push({
        code: "MISSING_SOURCE_REFERENCE",
        field: "sourceReference",
        message: "Référence source manquante.",
      });
    }
  }

  // standardId & Classification
  if (record.standardId) {
    const standard = PDI_STANDARDS_REGISTRY[record.standardId];
    if (!standard) {
      errors.push({
        code: "INVALID_STANDARD_ID",
        field: "standardId",
        message: `Le standard ${record.standardId} n'est pas enregistré dans le registre normatif NORM-01.`,
      });
    } else if (standard.standardType !== "DIMENSIONAL_STANDARD") {
      errors.push({
        code: "STANDARD_IS_NOT_DIMENSIONAL",
        field: "standardId",
        message: `Le standard ${record.standardId} (${standard.standardType}) n'est pas un standard dimensionnel (DIMENSIONAL_STANDARD).`,
      });
    }
  }

  // Outside Diameter
  if (record.outsideDiameterMm !== undefined) {
    if (typeof record.outsideDiameterMm !== "number" || isNaN(record.outsideDiameterMm) || record.outsideDiameterMm <= 0) {
      errors.push({
        code: "INVALID_OUTSIDE_DIAMETER",
        field: "outsideDiameterMm",
        message: "Le diamètre extérieur (outsideDiameterMm) doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // Wall Thickness
  if (record.wallThicknessMm !== undefined) {
    if (typeof record.wallThicknessMm !== "number" || isNaN(record.wallThicknessMm) || record.wallThicknessMm <= 0) {
      errors.push({
        code: "INVALID_WALL_THICKNESS",
        field: "wallThicknessMm",
        message: "L'épaisseur de paroi (wallThicknessMm) doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // DN
  if (record.dn !== undefined) {
    if (typeof record.dn !== "number" || isNaN(record.dn) || record.dn <= 0) {
      errors.push({
        code: "INVALID_DN",
        field: "dn",
        message: "Le diamètre nominal DN (dn) doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // NPS
  if (record.nps !== undefined) {
    if (typeof record.nps !== "string" || record.nps.trim().length === 0) {
      errors.push({
        code: "EMPTY_NPS",
        field: "nps",
        message: "La désignation NPS (nps) ne peut pas être une chaîne vide.",
      });
    }
  }

  // Schedule
  if (record.schedule !== undefined) {
    if (typeof record.schedule !== "string" || record.schedule.trim().length === 0) {
      errors.push({
        code: "EMPTY_SCHEDULE",
        field: "schedule",
        message: "Le Schedule déclaratif (schedule) ne peut pas être une chaîne vide.",
      });
    }
  }

  // Pipe Type
  if (record.pipeType !== undefined) {
    if (typeof record.pipeType !== "string" || !VALID_PIPE_TYPES.includes(record.pipeType as PipeType)) {
      errors.push({
        code: "INVALID_PIPE_TYPE",
        field: "pipeType",
        message: `Le procédé de fabrication (pipeType) '${record.pipeType}' n'appartient pas au vocabulaire valide (WELDED, SEAMLESS, WELDED_OR_SEAMLESS, UNKNOWN).`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un enregistrement complet (PipeDimensionalRecord).
 * Entrée typée en `unknown` pour garantir la sécurité de typage strict sans contournement `any`.
 * Exige impérativement la présence et la validité des champs de base : id, standardId, unitSystem, sourceStatus.
 */
export function validateCompletePipeDimensionalRecord(
  record: unknown
): PipeDimensionalValidationResult {
  const errors: PipeDimensionalValidationError[] = [];

  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        { code: "MISSING_RECORD_ID", field: "id", message: "L'identifiant de record (id) est nul ou absent (entrée non-objet)." },
        { code: "MISSING_STANDARD_ID", field: "standardId", message: "Le standardId est nul ou absent (entrée non-objet)." },
        { code: "MISSING_UNIT_SYSTEM", field: "unitSystem", message: "Le système d'unités est nul ou absent (entrée non-objet)." },
        { code: "MISSING_SOURCE_STATUS", field: "sourceStatus", message: "Le statut de source est nul ou absent (entrée non-objet)." },
      ],
    };
  }

  // REQUIRED 01: id
  if (record.id === undefined || record.id === null) {
    errors.push({
      code: "MISSING_RECORD_ID",
      field: "id",
      message: "L'identifiant de record (id) est obligatoire pour un record complet.",
    });
  } else if (typeof record.id !== "string" || record.id.trim().length === 0) {
    errors.push({
      code: "EMPTY_RECORD_ID",
      field: "id",
      message: "L'identifiant de record (id) ne peut pas être une chaîne vide.",
    });
  }

  // REQUIRED 02: standardId
  if (!record.standardId) {
    errors.push({
      code: "MISSING_STANDARD_ID",
      field: "standardId",
      message: "Le standard (standardId) est obligatoire pour un record complet.",
    });
  }

  // REQUIRED 03: unitSystem
  if (!record.unitSystem) {
    errors.push({
      code: "MISSING_UNIT_SYSTEM",
      field: "unitSystem",
      message: "Le système d'unités (unitSystem) est obligatoire pour un record complet.",
    });
  } else if (record.unitSystem !== "SI" && record.unitSystem !== "US_CUSTOMARY") {
    errors.push({
      code: "INVALID_UNIT_SYSTEM",
      field: "unitSystem",
      message: "Le système d'unités doit être 'SI' ou 'US_CUSTOMARY'.",
    });
  }

  // REQUIRED 04: sourceStatus
  if (!record.sourceStatus) {
    errors.push({
      code: "MISSING_SOURCE_STATUS",
      field: "sourceStatus",
      message: "Le statut de source (sourceStatus) est obligatoire pour un record complet.",
    });
  } else if (typeof record.sourceStatus !== "string" || !VALID_SOURCE_STATUSES.includes(record.sourceStatus as PipeSourceStatus)) {
    errors.push({
      code: "INVALID_SOURCE_STATUS",
      field: "sourceStatus",
      message: "Le statut de source doit être VERIFIED, LICENSED, UNVERIFIED ou LEGACY.",
    });
  }

  // Déléguer aux règles conditionnelles de manière sûre
  const partialResult = validatePartialPipeDimensionalRecord(record as Partial<PipeDimensionalRecord>);

  const combinedErrors = [...errors, ...partialResult.errors];

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
  };
}

/**
 * Alias de compatibilité.
 */
export const validatePipeDimensionalRecord = validatePartialPipeDimensionalRecord;


