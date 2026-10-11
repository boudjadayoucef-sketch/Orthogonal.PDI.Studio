/**
 * PDI NORMATIVE ENGINE — VALVE VALIDATOR
 * Reference: PATCH NORM-05 (Valve Engine)
 * 
 * Validateur d'intégrité structurelle et normativité pour `ValveRecord`.
 * 
 * RÈGLE ARCHITECTURALE :
 * - Distingue la validation d'un record complet (validateCompleteValveRecord)
 *   de la validation d'un record partiel (validatePartialValveRecord).
 * - Sépare strictement les rôles des standards :
 *   - PRODUCT_STANDARD (API-6D, API-600, API-602, API-609)
 *   - DIMENSIONAL_STANDARD (ASME-B16.10)
 * - Exige la sécurité de typage strict à la frontière d'exécution (record: unknown).
 * - N'effectue AUCUN calcul de débit, de perte de charge, de couple, ni de conversion Class ↔ PN.
 */

import type {
  ValveRecord,
  ValveType,
  ValveConnectionType,
  ValveActuationType,
  ValveSourceStatus,
} from "../types/valveTypes";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { isRecordObject } from "./pipeDimensionalValidator";

/**
 * Structure de retour standard pour le résultat de validation de vanne.
 */
export interface ValveValidationError {
  readonly code: string;
  readonly field: keyof ValveRecord | string;
  readonly message: string;
}

export interface ValveValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValveValidationError[];
}

export const VALID_VALVE_TYPES: readonly ValveType[] = Object.freeze([
  "GATE",
  "GLOBE",
  "CHECK",
  "BALL",
  "BUTTERFLY",
  "PLUG",
  "NEEDLE",
  "FLOATING_BALL",
  "TRUNNION_BALL",
  "OTHER",
]);

export const VALID_VALVE_CONNECTION_TYPES: readonly ValveConnectionType[] = Object.freeze([
  "FLANGED",
  "BUTT_WELD",
  "SOCKET_WELD",
  "THREADED",
  "WAFER",
  "LUG",
  "OTHER",
  "UNKNOWN",
]);

export const VALID_VALVE_ACTUATION_TYPES: readonly ValveActuationType[] = Object.freeze([
  "MANUAL",
  "GEAR",
  "PNEUMATIC",
  "ELECTRIC",
  "HYDRAULIC",
  "OTHER",
]);

export const VALID_VALVE_SOURCE_STATUSES: readonly ValveSourceStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "LEGACY",
]);

const VALID_VALVE_TYPES_SET = new Set<string>(VALID_VALVE_TYPES);
const VALID_VALVE_CONNECTION_TYPES_SET = new Set<string>(VALID_VALVE_CONNECTION_TYPES);
const VALID_VALVE_ACTUATION_TYPES_SET = new Set<string>(VALID_VALVE_ACTUATION_TYPES);
const VALID_SOURCE_STATUSES_SET = new Set<string>(VALID_VALVE_SOURCE_STATUSES);

/**
 * Valide les règles conditionnelles et sémantiques communes sur un objet record de vanne.
 * Fonctionne directement sur Record<string, unknown> sans contournement any.
 */
function validateValveRecordRules(
  record: Record<string, unknown>
): ValveValidationResult {
  const errors: ValveValidationError[] = [];

  // 1. Validation du productStandardId si présent
  if (record.productStandardId !== undefined) {
    if (typeof record.productStandardId !== "string" || record.productStandardId.trim() === "") {
      errors.push({
        code: "INVALID_STANDARD_ID",
        field: "productStandardId",
        message: "Le productStandardId doit être une chaîne non vide.",
      });
    } else {
      const standardObj = PDI_STANDARDS_REGISTRY[record.productStandardId];
      if (!standardObj) {
        errors.push({
          code: "INVALID_STANDARD_ID",
          field: "productStandardId",
          message: `Le standard produit ${record.productStandardId} n'est pas enregistré dans le registre NORM-01.`,
        });
      } else if (standardObj.standardType !== "PRODUCT_STANDARD") {
        errors.push({
          code: "STANDARD_IS_NOT_PRODUCT_STANDARD",
          field: "productStandardId",
          message: `Le standard ${record.productStandardId} est de type ${standardObj.standardType}. productStandardId exige un PRODUCT_STANDARD (ex: API-6D, API-600, API-602, API-609).`,
        });
      }
    }
  }

  // 2. Validation du dimensionalStandardId si présent
  if (record.dimensionalStandardId !== undefined) {
    if (typeof record.dimensionalStandardId !== "string" || record.dimensionalStandardId.trim() === "") {
      errors.push({
        code: "INVALID_STANDARD_ID",
        field: "dimensionalStandardId",
        message: "Le dimensionalStandardId doit être une chaîne non vide.",
      });
    } else {
      const standardObj = PDI_STANDARDS_REGISTRY[record.dimensionalStandardId];
      if (!standardObj) {
        errors.push({
          code: "INVALID_STANDARD_ID",
          field: "dimensionalStandardId",
          message: `Le standard dimensionnel ${record.dimensionalStandardId} n'est pas enregistré dans le registre NORM-01.`,
        });
      } else if (standardObj.standardType !== "DIMENSIONAL_STANDARD") {
        errors.push({
          code: "STANDARD_IS_NOT_DIMENSIONAL_STANDARD",
          field: "dimensionalStandardId",
          message: `Le standard ${record.dimensionalStandardId} est de type ${standardObj.standardType}. dimensionalStandardId exige un DIMENSIONAL_STANDARD (ex: ASME-B16.10).`,
        });
      }
    }
  }

  // 3. Valve Type
  if (record.valveType !== undefined) {
    if (
      typeof record.valveType !== "string" ||
      !VALID_VALVE_TYPES_SET.has(record.valveType)
    ) {
      errors.push({
        code: "INVALID_VALVE_TYPE",
        field: "valveType",
        message: `La famille de vanne '${String(record.valveType)}' n'est pas valide.`,
      });
    }
  }

  // 4. Connection Type
  if (record.connectionType !== undefined) {
    if (
      typeof record.connectionType !== "string" ||
      !VALID_VALVE_CONNECTION_TYPES_SET.has(record.connectionType)
    ) {
      errors.push({
        code: "INVALID_CONNECTION_TYPE",
        field: "connectionType",
        message: `Le type de raccordement '${String(record.connectionType)}' n'est pas valide.`,
      });
    }
  }

  // 5. Actuation Type
  if (record.actuationType !== undefined) {
    if (
      typeof record.actuationType !== "string" ||
      !VALID_VALVE_ACTUATION_TYPES_SET.has(record.actuationType)
    ) {
      errors.push({
        code: "INVALID_ACTUATION_TYPE",
        field: "actuationType",
        message: `Le mode d'actionnement '${String(record.actuationType)}' n'est pas valide.`,
      });
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
        message: `Les enregistrements de vannes '${record.sourceStatus}' exigent une référence source (sourceReference) non vide.`,
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
 * Valide un enregistrement partiel (Partial<ValveRecord> ou inconnu).
 * L'entrée {} est un état partiel valide.
 * Toute entrée non-objet (null, undefined, string, number, array, boolean) produit INVALID_RECORD_OBJECT.
 */
export function validatePartialValveRecord(
  record: unknown
): ValveValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement partiel de vanne doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  return validateValveRecordRules(record);
}

/**
 * Valide un enregistrement complet (ValveRecord).
 * Entrée typée en `unknown` pour garantir la sécurité de typage strict à la frontière runtime.
 * Exige impérativement : id, valveType, connectionType, sourceStatus,
 * et au moins un standard de référence (productStandardId ou dimensionalStandardId).
 */
export function validateCompleteValveRecord(
  record: unknown
): ValveValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement complet de vanne doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: ValveValidationError[] = [];

  // Field: id
  if (record.id === undefined || record.id === null) {
    errors.push({
      code: "MISSING_RECORD_ID",
      field: "id",
      message: "L'identifiant de la vanne (id) est obligatoire pour un record complet.",
    });
  } else if (typeof record.id !== "string" || record.id.trim() === "") {
    errors.push({
      code: "EMPTY_RECORD_ID",
      field: "id",
      message: "L'identifiant de la vanne (id) ne peut pas être une chaîne vide.",
    });
  }

  // Au moins un standard (produit ou dimensionnel) obligatoire
  const hasProductStandard =
    record.productStandardId !== undefined && record.productStandardId !== null;
  const hasDimensionalStandard =
    record.dimensionalStandardId !== undefined && record.dimensionalStandardId !== null;

  if (!hasProductStandard && !hasDimensionalStandard) {
    errors.push({
      code: "MISSING_STANDARD_REFERENCE",
      field: "standard",
      message: "Au moins un productStandardId ou un dimensionalStandardId doit être spécifié pour un record complet.",
    });
  }

  // Field: valveType
  if (record.valveType === undefined || record.valveType === null) {
    errors.push({
      code: "MISSING_VALVE_TYPE",
      field: "valveType",
      message: "La famille de vanne (valveType) est obligatoire pour un record complet.",
    });
  }

  // Field: connectionType
  if (record.connectionType === undefined || record.connectionType === null) {
    errors.push({
      code: "MISSING_CONNECTION_TYPE",
      field: "connectionType",
      message: "Le mode de raccordement (connectionType) est obligatoire pour un record complet.",
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

  // Évaluation des règles partagées sans cast
  const rulesResult = validateValveRecordRules(record);

  const combinedErrors = [...errors, ...rulesResult.errors];

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
  };
}

/**
 * Alias de compatibilité pour la validation de vannes.
 */
export const validateValveRecord = validatePartialValveRecord;
