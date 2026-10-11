/**
 * PDI NORMATIVE ENGINE — MATERIAL VALIDATOR
 * Reference: PATCH NORM-06 (Material Engine)
 * 
 * Validateur d'intégrité structurelle et normativité pour `MaterialRecord`.
 * 
 * RÈGLE ARCHITECTURALE :
 * - Distingue la validation d'un record complet (validateCompleteMaterialRecord)
 *   de la validation d'un record partiel (validatePartialMaterialRecord).
 * - Exige impérativement que `standardId` appartienne à `MATERIAL_STANDARD`
 *   (refuse PRODUCT_STANDARD, DIMENSIONAL_STANDARD et DESIGN_CODE).
 * - Sécurité de typage strict à la frontière d'exécution (record: unknown).
 * - N'effectue AUCUN calcul de contrainte admissible ni d'interpolation thermique.
 */

import type {
  MaterialRecord,
  MaterialCategory,
  MaterialProductForm,
  MaterialSourceStatus,
} from "../types/materialTypes";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { isRecordObject } from "./pipeDimensionalValidator";

/**
 * Structure de retour standard pour le résultat de validation de matériau.
 */
export interface MaterialValidationError {
  readonly code: string;
  readonly field: keyof MaterialRecord | string;
  readonly message: string;
}

export interface MaterialValidationResult {
  readonly valid: boolean;
  readonly errors: readonly MaterialValidationError[];
}

export const VALID_MATERIAL_CATEGORIES: readonly MaterialCategory[] = Object.freeze([
  "CARBON_STEEL",
  "LOW_ALLOY_STEEL",
  "STAINLESS_STEEL",
  "DUPLEX_STAINLESS_STEEL",
  "NICKEL_ALLOY",
  "OTHER",
]);

export const VALID_MATERIAL_PRODUCT_FORMS: readonly MaterialProductForm[] = Object.freeze([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
  "PLATE",
  "FORGING",
  "BAR",
  "OTHER",
]);

export const VALID_MATERIAL_SOURCE_STATUSES: readonly MaterialSourceStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "LEGACY",
]);

const VALID_MATERIAL_CATEGORIES_SET = new Set<string>(VALID_MATERIAL_CATEGORIES);
const VALID_MATERIAL_PRODUCT_FORMS_SET = new Set<string>(VALID_MATERIAL_PRODUCT_FORMS);
const VALID_SOURCE_STATUSES_SET = new Set<string>(VALID_MATERIAL_SOURCE_STATUSES);

/**
 * Valide les règles conditionnelles et sémantiques communes sur un objet record de matériau.
 * Fonctionne directement sur Record<string, unknown> sans contournement any.
 */
function validateMaterialRecordRules(
  record: Record<string, unknown>
): MaterialValidationResult {
  const errors: MaterialValidationError[] = [];

  // 1. Validation du standardId si présent
  if (record.standardId !== undefined) {
    if (typeof record.standardId !== "string" || record.standardId.trim() === "") {
      errors.push({
        code: "INVALID_STANDARD_ID",
        field: "standardId",
        message: "Le standardId doit être une chaîne non vide.",
      });
    } else {
      const standardObj = PDI_STANDARDS_REGISTRY[record.standardId];
      if (!standardObj) {
        errors.push({
          code: "INVALID_STANDARD_ID",
          field: "standardId",
          message: `Le standard matériau ${record.standardId} n'est pas enregistré dans le registre NORM-01.`,
        });
      } else if (standardObj.standardType !== "MATERIAL_STANDARD") {
        errors.push({
          code: "STANDARD_IS_NOT_MATERIAL_STANDARD",
          field: "standardId",
          message: `Le standard ${record.standardId} est de type ${standardObj.standardType}. Le Material Engine exige un standard de type 'MATERIAL_STANDARD' (ex: API-5L).`,
        });
      }
    }
  }

  // 2. Designation
  if (record.designation !== undefined) {
    if (typeof record.designation !== "string" || record.designation.trim() === "") {
      errors.push({
        code: "EMPTY_DESIGNATION",
        field: "designation",
        message: "La désignation du matériau ne peut pas être une chaîne vide.",
      });
    }
  }

  // 3. Grade
  if (record.grade !== undefined) {
    if (typeof record.grade !== "string" || record.grade.trim() === "") {
      errors.push({
        code: "EMPTY_GRADE",
        field: "grade",
        message: "Le grade / nuance ne peut pas être une chaîne vide si fournie.",
      });
    }
  }

  // 4. Specification Reference
  if (record.specificationReference !== undefined) {
    if (typeof record.specificationReference !== "string" || record.specificationReference.trim() === "") {
      errors.push({
        code: "EMPTY_SPECIFICATION_REFERENCE",
        field: "specificationReference",
        message: "La référence de spécification ne peut pas être une chaîne vide si fournie.",
      });
    }
  }

  // 5. Material Category
  if (record.materialCategory !== undefined) {
    if (
      typeof record.materialCategory !== "string" ||
      !VALID_MATERIAL_CATEGORIES_SET.has(record.materialCategory)
    ) {
      errors.push({
        code: "INVALID_MATERIAL_CATEGORY",
        field: "materialCategory",
        message: `La catégorie de matériau '${String(record.materialCategory)}' n'est pas valide.`,
      });
    }
  }

  // 6. Product Form
  if (record.productForm !== undefined) {
    if (
      typeof record.productForm !== "string" ||
      !VALID_MATERIAL_PRODUCT_FORMS_SET.has(record.productForm)
    ) {
      errors.push({
        code: "INVALID_MATERIAL_PRODUCT_FORM",
        field: "productForm",
        message: `La forme de produit '${String(record.productForm)}' n'est pas valide.`,
      });
    }
  }

  // 7. Source Status & Traceability
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
        message: `Les enregistrements de matériau '${record.sourceStatus}' exigent une référence source (sourceReference) non vide.`,
      });
    }
  }

  // 8. Contrôle d'intégrité des propriétés mécaniques déclarées (valeurs positives strictes)
  if (record.yieldStrengthMPa !== undefined) {
    if (typeof record.yieldStrengthMPa !== "number" || isNaN(record.yieldStrengthMPa) || record.yieldStrengthMPa <= 0) {
      errors.push({
        code: "INVALID_YIELD_STRENGTH",
        field: "yieldStrengthMPa",
        message: "La limite d'élasticité yieldStrengthMPa doit être un nombre strictement positif (> 0).",
      });
    }
  }

  if (record.tensileStrengthMPa !== undefined) {
    if (typeof record.tensileStrengthMPa !== "number" || isNaN(record.tensileStrengthMPa) || record.tensileStrengthMPa <= 0) {
      errors.push({
        code: "INVALID_TENSILE_STRENGTH",
        field: "tensileStrengthMPa",
        message: "La résistance à la traction tensileStrengthMPa doit être un nombre strictement positif (> 0).",
      });
    }
  }

  if (record.densityKgM3 !== undefined) {
    if (typeof record.densityKgM3 !== "number" || isNaN(record.densityKgM3) || record.densityKgM3 <= 0) {
      errors.push({
        code: "INVALID_DENSITY",
        field: "densityKgM3",
        message: "La masse volumique densityKgM3 doit être un nombre strictement positif (> 0).",
      });
    }
  }

  if (record.elasticModulusGPa !== undefined) {
    if (typeof record.elasticModulusGPa !== "number" || isNaN(record.elasticModulusGPa) || record.elasticModulusGPa <= 0) {
      errors.push({
        code: "INVALID_ELASTIC_MODULUS",
        field: "elasticModulusGPa",
        message: "Le module d'Young elasticModulusGPa doit être un nombre strictement positif (> 0).",
      });
    }
  }

  if (record.poissonRatio !== undefined) {
    if (typeof record.poissonRatio !== "number" || isNaN(record.poissonRatio) || record.poissonRatio <= 0) {
      errors.push({
        code: "INVALID_POISSON_RATIO",
        field: "poissonRatio",
        message: "Le coefficient de Poisson poissonRatio doit être un nombre strictement positif (> 0).",
      });
    }
  }

  if (record.thermalExpansionCoefficient !== undefined) {
    if (typeof record.thermalExpansionCoefficient !== "number" || isNaN(record.thermalExpansionCoefficient) || record.thermalExpansionCoefficient <= 0) {
      errors.push({
        code: "INVALID_THERMAL_EXPANSION",
        field: "thermalExpansionCoefficient",
        message: "Le coefficient de dilatation thermique thermalExpansionCoefficient doit être un nombre strictement positif (> 0).",
      });
    }
  }

  if (record.allowableStressMPa !== undefined) {
    if (typeof record.allowableStressMPa !== "number" || isNaN(record.allowableStressMPa) || record.allowableStressMPa <= 0) {
      errors.push({
        code: "INVALID_ALLOWABLE_STRESS",
        field: "allowableStressMPa",
        message: "La contrainte admissible allowableStressMPa doit être un nombre strictement positif (> 0).",
      });
    }
  }

  // 9. Validation d'un set de propriétés imbriqué si présent
  if (record.properties !== undefined) {
    if (!isRecordObject(record.properties)) {
      errors.push({
        code: "INVALID_PROPERTIES_OBJECT",
        field: "properties",
        message: "L'ensemble de propriétés (properties) doit être un objet.",
      });
    } else {
      const p = record.properties;
      if (p.yieldStrengthMPa !== undefined && (typeof p.yieldStrengthMPa !== "number" || p.yieldStrengthMPa <= 0)) {
        errors.push({
          code: "INVALID_YIELD_STRENGTH",
          field: "properties.yieldStrengthMPa",
          message: "properties.yieldStrengthMPa doit être strictement positif (> 0).",
        });
      }
      if (p.tensileStrengthMPa !== undefined && (typeof p.tensileStrengthMPa !== "number" || p.tensileStrengthMPa <= 0)) {
        errors.push({
          code: "INVALID_TENSILE_STRENGTH",
          field: "properties.tensileStrengthMPa",
          message: "properties.tensileStrengthMPa doit être strictement positif (> 0).",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un enregistrement partiel (Partial<MaterialRecord> ou inconnu).
 * L'entrée {} est un état partiel valide.
 * Toute entrée non-objet (null, undefined, string, number, array, boolean) produit INVALID_RECORD_OBJECT.
 */
export function validatePartialMaterialRecord(
  record: unknown
): MaterialValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement partiel de matériau doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  return validateMaterialRecordRules(record);
}

/**
 * Valide un enregistrement complet (MaterialRecord).
 * Entrée typée en `unknown` pour garantir la sécurité de typage strict à la frontière runtime.
 * Exige impérativement : id, standardId, designation, sourceStatus.
 */
export function validateCompleteMaterialRecord(
  record: unknown
): MaterialValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement complet de matériau doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: MaterialValidationError[] = [];

  // Field: id
  if (record.id === undefined || record.id === null) {
    errors.push({
      code: "MISSING_RECORD_ID",
      field: "id",
      message: "L'identifiant du matériau (id) est obligatoire pour un record complet.",
    });
  } else if (typeof record.id !== "string" || record.id.trim() === "") {
    errors.push({
      code: "EMPTY_RECORD_ID",
      field: "id",
      message: "L'identifiant du matériau (id) ne peut pas être une chaîne vide.",
    });
  }

  // Field: standardId
  if (record.standardId === undefined || record.standardId === null) {
    errors.push({
      code: "MISSING_STANDARD_ID",
      field: "standardId",
      message: "Le standard matériau (standardId) est obligatoire pour un record complet.",
    });
  }

  // Field: designation
  if (record.designation === undefined || record.designation === null) {
    errors.push({
      code: "MISSING_DESIGNATION",
      field: "designation",
      message: "La désignation du matériau (designation) est obligatoire pour un record complet.",
    });
  } else if (typeof record.designation !== "string" || record.designation.trim() === "") {
    errors.push({
      code: "EMPTY_DESIGNATION",
      field: "designation",
      message: "La désignation du matériau (designation) ne peut pas être une chaîne vide.",
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
  const rulesResult = validateMaterialRecordRules(record);

  const combinedErrors = [...errors, ...rulesResult.errors];

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
  };
}

/**
 * Alias de compatibilité pour la validation de matériaux.
 */
export const validateMaterialRecord = validatePartialMaterialRecord;
