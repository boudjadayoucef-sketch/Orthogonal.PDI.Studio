/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ MATERIAL COMPATIBILITY VALIDATOR
 * Reference: NORM-14-03 (Component ↔ Material Compatibility)
 * 
 * Validateur structurel déterministe pour les requêtes de compatibilité Composant ↔ Matériau.
 * RÈGLES DE VALIDATION STRICTES :
 * 1. Rejet strict de null, undefined, primitives, arrays.
 * 2. componentType obligatoire et strictement membre de ("PIPE" | "FITTING" | "FLANGE" | "VALVE").
 * 3. componentId obligatoire, chaîne non vide (sans espaces seuls).
 * 4. materialId obligatoire, chaîne non vide (sans espaces seuls).
 * 5. Validation purement structurelle : aucun blocage ni interprétation sémantique/heuristique sur les identifiants.
 * 6. Les identifiants sont des chaînes opaques.
 */

import type {
  NormativeComponentMaterialCompatibilityQuery,
  NormativeComponentMaterialReference,
  NormativeMaterialCompatibilityComponentType,
  NormativeMaterialReference,
} from "../types/normativeComponentMaterialCompatibilityTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type ComponentMaterialCompatibilityValidationErrorCode =
  | "INVALID_QUERY_OBJECT"
  | "MISSING_COMPONENT_REFERENCE"
  | "INVALID_COMPONENT_REFERENCE"
  | "MISSING_COMPONENT_TYPE"
  | "INVALID_COMPONENT_TYPE"
  | "MISSING_COMPONENT_ID"
  | "EMPTY_COMPONENT_ID"
  | "INVALID_COMPONENT_ID_TYPE"
  | "MISSING_MATERIAL_REFERENCE"
  | "INVALID_MATERIAL_REFERENCE"
  | "MISSING_MATERIAL_ID"
  | "EMPTY_MATERIAL_ID"
  | "INVALID_MATERIAL_ID_TYPE";

export interface ComponentMaterialCompatibilityValidationError {
  readonly code: ComponentMaterialCompatibilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface ComponentMaterialCompatibilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ComponentMaterialCompatibilityValidationError[];
}

export const ALLOWED_MATERIAL_COMPATIBILITY_COMPONENT_TYPES: readonly NormativeMaterialCompatibilityComponentType[] =
  Object.freeze(["PIPE", "FITTING", "FLANGE", "VALVE"]);

/**
 * Valide une référence de composant pour la compatibilité matériau.
 */
export function validateNormativeComponentMaterialReference(
  raw: unknown,
  fieldName: string = "component"
): ComponentMaterialCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_COMPONENT_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentMaterialCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // componentType
  if (candidate.componentType === undefined || candidate.componentType === null) {
    errors.push({
      code: "MISSING_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' is required.`,
    });
  } else if (
    !ALLOWED_MATERIAL_COMPATIBILITY_COMPONENT_TYPES.includes(
      candidate.componentType as NormativeMaterialCompatibilityComponentType
    )
  ) {
    errors.push({
      code: "INVALID_COMPONENT_TYPE",
      field: `${fieldName}.componentType`,
      message: `Field '${fieldName}.componentType' must be one of [${ALLOWED_MATERIAL_COMPATIBILITY_COMPONENT_TYPES.join(
        ", "
      )}], got '${String(candidate.componentType)}'.`,
    });
  }

  // componentId
  if (candidate.componentId === undefined || candidate.componentId === null) {
    errors.push({
      code: "MISSING_COMPONENT_ID",
      field: `${fieldName}.componentId`,
      message: `Field '${fieldName}.componentId' is required.`,
    });
  } else if (typeof candidate.componentId !== "string") {
    errors.push({
      code: "INVALID_COMPONENT_ID_TYPE",
      field: `${fieldName}.componentId`,
      message: `Field '${fieldName}.componentId' must be a string, got ${typeof candidate.componentId}.`,
    });
  } else {
    const trimmed = candidate.componentId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_COMPONENT_ID",
        field: `${fieldName}.componentId`,
        message: `Field '${fieldName}.componentId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une référence de matériau.
 */
export function validateNormativeMaterialReference(
  raw: unknown,
  fieldName: string = "material"
): ComponentMaterialCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_MATERIAL_REFERENCE",
          field: fieldName,
          message: `Reference '${fieldName}' must be a non-null, non-array object.`,
        },
      ],
    };
  }

  const errors: ComponentMaterialCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // materialId
  if (candidate.materialId === undefined || candidate.materialId === null) {
    errors.push({
      code: "MISSING_MATERIAL_ID",
      field: `${fieldName}.materialId`,
      message: `Field '${fieldName}.materialId' is required.`,
    });
  } else if (typeof candidate.materialId !== "string") {
    errors.push({
      code: "INVALID_MATERIAL_ID_TYPE",
      field: `${fieldName}.materialId`,
      message: `Field '${fieldName}.materialId' must be a string, got ${typeof candidate.materialId}.`,
    });
  } else {
    const trimmed = candidate.materialId.trim();
    if (trimmed.length === 0) {
      errors.push({
        code: "EMPTY_MATERIAL_ID",
        field: `${fieldName}.materialId`,
        message: `Field '${fieldName}.materialId' cannot be empty or whitespace.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

/**
 * Valide une requête complète Component ↔ Material NormativeComponentMaterialCompatibilityQuery.
 */
export function validateNormativeComponentMaterialCompatibilityQuery(
  raw: unknown
): ComponentMaterialCompatibilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_QUERY_OBJECT",
          message: "NormativeComponentMaterialCompatibilityQuery must be a non-null, non-array object.",
        },
      ],
    };
  }

  const errors: ComponentMaterialCompatibilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // component
  if (candidate.component === undefined || candidate.component === null) {
    errors.push({
      code: "MISSING_COMPONENT_REFERENCE",
      field: "component",
      message: "Query field 'component' is required.",
    });
  } else {
    const compVal = validateNormativeComponentMaterialReference(candidate.component, "component");
    if (!compVal.valid) {
      errors.push(...compVal.errors);
    }
  }

  // material
  if (candidate.material === undefined || candidate.material === null) {
    errors.push({
      code: "MISSING_MATERIAL_REFERENCE",
      field: "material",
      message: "Query field 'material' is required.",
    });
  } else {
    const matVal = validateNormativeMaterialReference(candidate.material, "material");
    if (!matVal.valid) {
      errors.push(...matVal.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
