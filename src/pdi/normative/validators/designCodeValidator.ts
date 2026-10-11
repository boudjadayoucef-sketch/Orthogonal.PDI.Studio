/**
 * PDI NORMATIVE ENGINE — DESIGN CODE VALIDATOR
 * Reference: PATCH NORM-08 (Design Code Engine / Engineering Calculation Foundation)
 * 
 * Validateur strict d'intégrité structurelle et normative des paramètres de calcul.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Distingue formellement `validateCompleteEngineeringCalculationInput` de
 *   `validatePartialEngineeringCalculationInput`.
 * - Rejette tout record non-objet (`INVALID_RECORD_OBJECT`).
 * - Valide rigoureusement le standard de calcul : doit appartenir à `PDI_STANDARDS_REGISTRY`
 *   ET être de type `DESIGN_CODE` (sinon `DESIGN_CODE_NOT_SUPPORTED` ou `STANDARD_IS_NOT_DESIGN_CODE`).
 * - Vérifie les domaines physiques :
 *   - pressure <= 0 -> INVALID_PRESSURE
 *   - diameter <= 0 -> INVALID_DIAMETER
 *   - thickness <= 0 -> INVALID_THICKNESS
 *   - corrosionAllowance < 0 -> INVALID_CORROSION_ALLOWANCE
 *   - NaN / Infinity -> INVALID_INPUT_VALUE
 * - Pas de complétion silencieuse de variables d'ingénierie (E, c, F, S).
 */

import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { isRecordObject } from "./pipeDimensionalValidator";
export { isRecordObject };
import type {
  DesignCodeFormulaReference,
  DesignCodeFormulaStatus,
  EngineeringCalculationInput,
  EngineeringCalculationType,
  EngineeringUnitSystem,
} from "../types/designCodeTypes";

export type DesignCodeValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_REQUIRED_INPUT"
  | "INVALID_DESIGN_CODE_ID"
  | "DESIGN_CODE_NOT_FOUND"
  | "DESIGN_CODE_NOT_SUPPORTED"
  | "STANDARD_IS_NOT_DESIGN_CODE"
  | "INVALID_CALCULATION_TYPE"
  | "MISSING_CALCULATION_TYPE"
  | "INVALID_UNIT_SYSTEM"
  | "MISSING_UNIT_SYSTEM"
  | "INVALID_INPUT_VALUE"
  | "INVALID_PRESSURE"
  | "INVALID_TEMPERATURE"
  | "INVALID_DIAMETER"
  | "INVALID_THICKNESS"
  | "INVALID_CORROSION_ALLOWANCE"
  | "INVALID_COEFFICIENT"
  | "MATERIAL_REFERENCE_REQUIRED"
  | "PIPE_DIMENSION_REFERENCE_REQUIRED"
  | "EDITION_REQUIRED"
  | "FORMULA_NOT_IMPLEMENTED"
  | "FORMULA_SOURCE_UNVERIFIED"
  | "CALCULATION_OUT_OF_SCOPE"
  | "INVALID_FORMULA_REFERENCE"
  | "FORMULA_CLAUSE_REQUIRED"
  | "FORMULA_SOURCE_REQUIRED"
  | "FORMULA_NOT_QUALIFIED"
  | "CALCULATION_TYPE_NOT_SUPPORTED"
  | "FORMULA_DESIGN_CODE_MISMATCH"
  | "INVALID_FORMULA_STATUS"
  | "DIAMETER_BASIS_REQUIRED"
  | "SPECIAL_CONSIDERATION_REQUIRED"
  | "INVALID_DENOMINATOR"
  | "UNIT_CONTRACT_UNVERIFIED"
  | "W_CONDITIONAL_CONTEXT_REQUIRED"
  | "BRANCH_BLOCKED";

export interface DesignCodeValidationError {
  readonly code: DesignCodeValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface DesignCodeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly DesignCodeValidationError[];
}

export const VALID_CALCULATION_TYPES: readonly EngineeringCalculationType[] = Object.freeze([
  "PRESSURE_WALL_THICKNESS",
  "ALLOWABLE_PRESSURE",
  "HOOP_STRESS",
  "TEST_PRESSURE",
  "OTHER",
]);

export const VALID_UNIT_SYSTEMS: readonly EngineeringUnitSystem[] = Object.freeze([
  "SI",
  "US_CUSTOMARY",
]);

export const VALID_FORMULA_STATUSES: readonly DesignCodeFormulaStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "NOT_IMPLEMENTED",
]);

/**
 * Type guard déterministe pour EngineeringCalculationType.
 * Garantit qu'aucun cast artificiel (as EngineeringCalculationType) n'est nécessaire.
 */
export function isEngineeringCalculationType(
  value: unknown
): value is EngineeringCalculationType {
  return (
    typeof value === "string" &&
    (value === "PRESSURE_WALL_THICKNESS" ||
      value === "ALLOWABLE_PRESSURE" ||
      value === "HOOP_STRESS" ||
      value === "TEST_PRESSURE" ||
      value === "OTHER")
  );
}

/**
 * Type guard déterministe pour EngineeringUnitSystem.
 * Rejette toute valeur inconnue sans cast artificiel.
 */
export function isEngineeringUnitSystem(
  value: unknown
): value is EngineeringUnitSystem {
  return typeof value === "string" && (value === "SI" || value === "US_CUSTOMARY");
}

/**
 * Type guard déterministe pour DesignCodeFormulaStatus.
 */
export function isDesignCodeFormulaStatus(
  value: unknown
): value is DesignCodeFormulaStatus {
  return (
    typeof value === "string" &&
    (value === "VERIFIED" ||
      value === "LICENSED" ||
      value === "UNVERIFIED" ||
      value === "NOT_IMPLEMENTED")
  );
}

/**
 * Valide les aspects sémantiques et physiques communs sur un Record non typé.
 */
function validateSharedCalculationInput(
  raw: Record<string, unknown>,
  errors: DesignCodeValidationError[]
): void {
  // 1. Validation de designCodeId
  if ("designCodeId" in raw && raw.designCodeId !== undefined) {
    if (typeof raw.designCodeId !== "string" || raw.designCodeId.trim().length === 0) {
      errors.push({
        code: "INVALID_DESIGN_CODE_ID",
        field: "designCodeId",
        message: "designCodeId doit être une chaîne non vide.",
      });
    } else {
      const codeId = raw.designCodeId.trim();
      const standard = PDI_STANDARDS_REGISTRY[codeId];
      if (!standard) {
        errors.push({
          code: "DESIGN_CODE_NOT_FOUND",
          field: "designCodeId",
          message: `Le code de conception '${codeId}' est introuvable dans PDI_STANDARDS_REGISTRY.`,
        });
      } else if (standard.standardType !== "DESIGN_CODE") {
        errors.push({
          code: "STANDARD_IS_NOT_DESIGN_CODE",
          field: "designCodeId",
          message: `Le standard '${codeId}' est de type '${standard.standardType}', pas un 'DESIGN_CODE'.`,
        });
      }
    }
  }

  // 2. Validation de calculationType via type guard strict (sans cast)
  if ("calculationType" in raw && raw.calculationType !== undefined) {
    if (!isEngineeringCalculationType(raw.calculationType)) {
      errors.push({
        code: "INVALID_CALCULATION_TYPE",
        field: "calculationType",
        message: `calculationType invalide: '${String(raw.calculationType)}'. Attendu: ${VALID_CALCULATION_TYPES.join(", ")}.`,
      });
    }
  }

  // 3. Validation de unitSystem via type guard strict (sans cast)
  if ("unitSystem" in raw && raw.unitSystem !== undefined) {
    if (!isEngineeringUnitSystem(raw.unitSystem)) {
      errors.push({
        code: "INVALID_UNIT_SYSTEM",
        field: "unitSystem",
        message: `unitSystem invalide: '${String(raw.unitSystem)}'. Attendu: 'SI' ou 'US_CUSTOMARY'.`,
      });
    }
  }

  // 4. Validation des grandeurs physiques (pression, dimensions, température, coefficients)
  if ("pressure" in raw && raw.pressure !== undefined && raw.pressure !== null) {
    if (typeof raw.pressure !== "number" || !Number.isFinite(raw.pressure)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "pressure",
        message: "La pression doit être un nombre fini.",
      });
    } else if (raw.pressure <= 0) {
      errors.push({
        code: "INVALID_PRESSURE",
        field: "pressure",
        message: "La pression de calcul doit être strictement positive (> 0).",
      });
    }
  }

  if ("outsideDiameterMm" in raw && raw.outsideDiameterMm !== undefined && raw.outsideDiameterMm !== null) {
    if (typeof raw.outsideDiameterMm !== "number" || !Number.isFinite(raw.outsideDiameterMm)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "outsideDiameterMm",
        message: "Le diamètre extérieur doit être un nombre fini.",
      });
    } else if (raw.outsideDiameterMm <= 0) {
      errors.push({
        code: "INVALID_DIAMETER",
        field: "outsideDiameterMm",
        message: "Le diamètre extérieur doit être strictement positif (> 0).",
      });
    }
  }

  if ("insideDiameterMm" in raw && raw.insideDiameterMm !== undefined && raw.insideDiameterMm !== null) {
    if (typeof raw.insideDiameterMm !== "number" || !Number.isFinite(raw.insideDiameterMm)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "insideDiameterMm",
        message: "Le diamètre intérieur doit être un nombre fini.",
      });
    } else if (raw.insideDiameterMm <= 0) {
      errors.push({
        code: "INVALID_DIAMETER",
        field: "insideDiameterMm",
        message: "Le diamètre intérieur doit être strictement positif (> 0).",
      });
    }
  }

  if ("diameterBasis" in raw && raw.diameterBasis !== undefined && raw.diameterBasis !== null) {
    if (raw.diameterBasis !== "OUTSIDE" && raw.diameterBasis !== "INSIDE") {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "diameterBasis",
        message: "diameterBasis doit être 'OUTSIDE' ou 'INSIDE'.",
      });
    }
  }

  if ("weldReductionFactor" in raw && raw.weldReductionFactor !== undefined && raw.weldReductionFactor !== null) {
    if (typeof raw.weldReductionFactor !== "number" || !Number.isFinite(raw.weldReductionFactor)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "weldReductionFactor",
        message: "Le facteur W doit être un nombre fini.",
      });
    } else if (raw.weldReductionFactor <= 0 || raw.weldReductionFactor > 1.0) {
      errors.push({
        code: "INVALID_COEFFICIENT",
        field: "weldReductionFactor",
        message: "Le facteur W doit être dans ]0, 1.0].",
      });
    }
  }

  if ("yCoefficient" in raw && raw.yCoefficient !== undefined && raw.yCoefficient !== null) {
    if (typeof raw.yCoefficient !== "number" || !Number.isFinite(raw.yCoefficient)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "yCoefficient",
        message: "Le coefficient Y doit être un nombre fini.",
      });
    } else if (raw.yCoefficient < 0 || raw.yCoefficient > 0.7) {
      errors.push({
        code: "INVALID_COEFFICIENT",
        field: "yCoefficient",
        message: "Le coefficient Y doit être dans [0.0, 0.7].",
      });
    }
  }

  if ("wallThicknessMm" in raw && raw.wallThicknessMm !== undefined && raw.wallThicknessMm !== null) {
    if (typeof raw.wallThicknessMm !== "number" || !Number.isFinite(raw.wallThicknessMm)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "wallThicknessMm",
        message: "L'épaisseur de paroi doit être un nombre fini.",
      });
    } else if (raw.wallThicknessMm <= 0) {
      errors.push({
        code: "INVALID_THICKNESS",
        field: "wallThicknessMm",
        message: "L'épaisseur de paroi doit être strictement positive (> 0).",
      });
    }
  }

  if ("corrosionAllowanceMm" in raw && raw.corrosionAllowanceMm !== undefined && raw.corrosionAllowanceMm !== null) {
    if (typeof raw.corrosionAllowanceMm !== "number" || !Number.isFinite(raw.corrosionAllowanceMm)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "corrosionAllowanceMm",
        message: "La surépaisseur de corrosion doit être un nombre fini.",
      });
    } else if (raw.corrosionAllowanceMm < 0) {
      errors.push({
        code: "INVALID_CORROSION_ALLOWANCE",
        field: "corrosionAllowanceMm",
        message: "La surépaisseur de corrosion ne peut pas être négative (>= 0).",
      });
    }
  }

  if ("temperature" in raw && raw.temperature !== undefined && raw.temperature !== null) {
    if (typeof raw.temperature !== "number" || !Number.isFinite(raw.temperature)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "temperature",
        message: "La température doit être un nombre fini.",
      });
    }
  }

  if ("allowableStressMpa" in raw && raw.allowableStressMpa !== undefined && raw.allowableStressMpa !== null) {
    if (typeof raw.allowableStressMpa !== "number" || !Number.isFinite(raw.allowableStressMpa)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "allowableStressMpa",
        message: "La contrainte admissible doit être un nombre fini.",
      });
    } else if (raw.allowableStressMpa <= 0) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "allowableStressMpa",
        message: "La contrainte admissible doit être strictement positive (> 0).",
      });
    }
  }

  if ("weldJointFactor" in raw && raw.weldJointFactor !== undefined && raw.weldJointFactor !== null) {
    if (typeof raw.weldJointFactor !== "number" || !Number.isFinite(raw.weldJointFactor)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "weldJointFactor",
        message: "Le coefficient de joint soudé (E) doit être un nombre fini.",
      });
    } else if (raw.weldJointFactor <= 0 || raw.weldJointFactor > 1.0) {
      errors.push({
        code: "INVALID_COEFFICIENT",
        field: "weldJointFactor",
        message: "Le coefficient de joint soudé (E) doit être compris dans l'intervalle ]0, 1.0].",
      });
    }
  }

  if ("designFactor" in raw && raw.designFactor !== undefined && raw.designFactor !== null) {
    if (typeof raw.designFactor !== "number" || !Number.isFinite(raw.designFactor)) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "designFactor",
        message: "Le facteur de conception (F) doit être un nombre fini.",
      });
    } else if (raw.designFactor <= 0 || raw.designFactor > 1.0) {
      errors.push({
        code: "INVALID_COEFFICIENT",
        field: "designFactor",
        message: "Le facteur de conception (F) doit être compris dans l'intervalle ]0, 1.0].",
      });
    }
  }

  if ("materialId" in raw && raw.materialId !== undefined && raw.materialId !== null) {
    if (typeof raw.materialId !== "string" || raw.materialId.trim().length === 0) {
      errors.push({
        code: "INVALID_INPUT_VALUE",
        field: "materialId",
        message: "materialId doit être une chaîne non vide lorsqu'il est renseigné.",
      });
    }
  }
}

/**
 * Valide un enregistrement partiel d'entrée de calcul (Partial<EngineeringCalculationInput>).
 * Permet {} comme état initial de construction, mais rejette tout ce qui n'est pas un objet.
 */
export function validatePartialEngineeringCalculationInput(
  record: unknown
): DesignCodeValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "L'entrée de calcul partiel doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: DesignCodeValidationError[] = [];
  validateSharedCalculationInput(record, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un enregistrement complet d'entrée de calcul selon le calcul spécifique demandé.
 * Exige strictement les paramètres requis pour le calcul choisi.
 */
export function validateCompleteEngineeringCalculationInput(
  record: unknown
): DesignCodeValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "L'entrée de calcul doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: DesignCodeValidationError[] = [];

  // Vérification de base des champs obligatoires universels
  if (!("designCodeId" in record) || record.designCodeId === undefined || record.designCodeId === null) {
    errors.push({
      code: "MISSING_REQUIRED_INPUT",
      field: "designCodeId",
      message: "designCodeId est obligatoire pour une entrée de calcul complète.",
    });
  }

  if (!("calculationType" in record) || record.calculationType === undefined || record.calculationType === null) {
    errors.push({
      code: "MISSING_CALCULATION_TYPE",
      field: "calculationType",
      message: "calculationType est obligatoire pour une entrée de calcul complète.",
    });
  }

  if (!("unitSystem" in record) || record.unitSystem === undefined || record.unitSystem === null) {
    errors.push({
      code: "MISSING_UNIT_SYSTEM",
      field: "unitSystem",
      message: "unitSystem est obligatoire pour une entrée de calcul complète.",
    });
  }

  // Évaluation des contraintes partagées
  validateSharedCalculationInput(record, errors);

  // Exigences contextuelles spécifiques selon le type de calcul
  const calcType = isEngineeringCalculationType(record.calculationType)
    ? record.calculationType
    : undefined;

  if (calcType === "PRESSURE_WALL_THICKNESS") {
    if (record.pressure === undefined || record.pressure === null) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "pressure",
        message: "pressure est obligatoire pour le calcul de l'épaisseur sous pression (PRESSURE_WALL_THICKNESS).",
      });
    }
    const hasOutside = record.outsideDiameterMm !== undefined && record.outsideDiameterMm !== null;
    const hasInside = "insideDiameterMm" in record && record.insideDiameterMm !== undefined && record.insideDiameterMm !== null;

    if (!hasOutside && !hasInside) {
      errors.push({
        code: "PIPE_DIMENSION_REFERENCE_REQUIRED",
        field: "outsideDiameterMm",
        message: "outsideDiameterMm ou insideDiameterMm est obligatoire pour le calcul de l'épaisseur sous pression.",
      });
    } else if (hasOutside && hasInside && (!("diameterBasis" in record) || record.diameterBasis === undefined || record.diameterBasis === null)) {
      errors.push({
        code: "DIAMETER_BASIS_REQUIRED",
        field: "diameterBasis",
        message: "Les deux diamètres (extérieur et intérieur) sont fournis sans 'diameterBasis'. Il est interdit d'appliquer un choix implicite : déclarer explicitement diameterBasis ('OUTSIDE' ou 'INSIDE').",
      });
    } else if (record.diameterBasis === "INSIDE" && !hasInside) {
      errors.push({
        code: "PIPE_DIMENSION_REFERENCE_REQUIRED",
        field: "insideDiameterMm",
        message: "diameterBasis est fixé à 'INSIDE' mais insideDiameterMm n'est pas fourni.",
      });
    } else if (record.diameterBasis === "OUTSIDE" && !hasOutside) {
      errors.push({
        code: "PIPE_DIMENSION_REFERENCE_REQUIRED",
        field: "outsideDiameterMm",
        message: "diameterBasis est fixé à 'OUTSIDE' mais outsideDiameterMm n'est pas fourni.",
      });
    }
    if (record.corrosionAllowanceMm === undefined || record.corrosionAllowanceMm === null) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "corrosionAllowanceMm",
        message: "corrosionAllowanceMm est obligatoire pour le calcul de l'épaisseur sous pression (aucune valeur implicite).",
      });
    }
    const hasE =
      (record.weldJointFactor !== undefined && record.weldJointFactor !== null) ||
      (isRecordObject(record.qualityFactorInput) &&
        typeof (record.qualityFactorInput as Record<string, unknown>).factorValue === "number");
    if (!hasE) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "weldJointFactor",
        message: "weldJointFactor ou qualityFactorInput est obligatoire (aucun coefficient E implicite).",
      });
    }
    const hasS =
      (record.materialId !== undefined && record.materialId !== null) ||
      (record.allowableStressMpa !== undefined && record.allowableStressMpa !== null) ||
      (isRecordObject(record.allowableStressInput) &&
        typeof (record.allowableStressInput as Record<string, unknown>).value === "number");
    if (!hasS) {
      errors.push({
        code: "MATERIAL_REFERENCE_REQUIRED",
        field: "materialId",
        message: "materialId, allowableStressMpa ou allowableStressInput est requis pour le calcul d'épaisseur.",
      });
    }
  } else if (calcType === "ALLOWABLE_PRESSURE") {
    if (record.outsideDiameterMm === undefined || record.outsideDiameterMm === null) {
      errors.push({
        code: "PIPE_DIMENSION_REFERENCE_REQUIRED",
        field: "outsideDiameterMm",
        message: "outsideDiameterMm est obligatoire pour le calcul de pression admissible.",
      });
    }
    if (record.wallThicknessMm === undefined || record.wallThicknessMm === null) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "wallThicknessMm",
        message: "wallThicknessMm est obligatoire pour le calcul de pression admissible.",
      });
    }
  } else if (calcType === "HOOP_STRESS") {
    if (record.pressure === undefined || record.pressure === null) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "pressure",
        message: "pressure est obligatoire pour le calcul de contrainte circonférentielle (HOOP_STRESS).",
      });
    }
    if (record.outsideDiameterMm === undefined || record.outsideDiameterMm === null) {
      errors.push({
        code: "PIPE_DIMENSION_REFERENCE_REQUIRED",
        field: "outsideDiameterMm",
        message: "outsideDiameterMm est obligatoire pour le calcul de contrainte circonférentielle.",
      });
    }
    if (record.wallThicknessMm === undefined || record.wallThicknessMm === null) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "wallThicknessMm",
        message: "wallThicknessMm est obligatoire pour le calcul de contrainte circonférentielle.",
      });
    }
  } else if (calcType === "TEST_PRESSURE") {
    if (record.pressure === undefined || record.pressure === null) {
      errors.push({
        code: "MISSING_REQUIRED_INPUT",
        field: "pressure",
        message: "pressure est obligatoire pour le calcul de pression d'épreuve (TEST_PRESSURE).",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide une référence de formule normative.
 * RÈGLE DE QUALIFICATION (Section 11, R1-05 à R1-10) :
 * - id : chaîne non vide déterministe.
 * - designCodeId : doit être un code de conception valide et répertorié de type DESIGN_CODE.
 * - status : VERIFIED, LICENSED, UNVERIFIED ou NOT_IMPLEMENTED.
 * - Si status === "VERIFIED" ou "LICENSED" :
 *   clauseReference ET sourceReference sont strictement obligatoires (chaînes non vides).
 */
export function validateDesignCodeFormulaReference(
  record: unknown
): DesignCodeValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "La référence de formule doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: DesignCodeValidationError[] = [];

  // 1. Validation de l'id
  if (!("id" in record) || typeof record.id !== "string" || record.id.trim().length === 0) {
    errors.push({
      code: "INVALID_FORMULA_REFERENCE",
      field: "id",
      message: "L'identifiant de formule (id) doit être une chaîne non vide.",
    });
  }

  // 2. Validation du designCodeId
  if (
    !("designCodeId" in record) ||
    typeof record.designCodeId !== "string" ||
    record.designCodeId.trim().length === 0
  ) {
    errors.push({
      code: "INVALID_DESIGN_CODE_ID",
      field: "designCodeId",
      message: "designCodeId doit être renseigné et être une chaîne non vide.",
    });
  } else {
    const codeId = record.designCodeId.trim();
    const standard = PDI_STANDARDS_REGISTRY[codeId];
    if (!standard) {
      errors.push({
        code: "DESIGN_CODE_NOT_FOUND",
        field: "designCodeId",
        message: `Le code de conception '${codeId}' est introuvable dans PDI_STANDARDS_REGISTRY.`,
      });
    } else if (standard.standardType !== "DESIGN_CODE") {
      errors.push({
        code: "FORMULA_DESIGN_CODE_MISMATCH",
        field: "designCodeId",
        message: `Le standard '${codeId}' n'est pas un code de conception (type: ${standard.standardType}).`,
      });
    }
  }

  // 3. Validation du statut de formule
  if (!("status" in record) || !isDesignCodeFormulaStatus(record.status)) {
    errors.push({
      code: "INVALID_FORMULA_STATUS",
      field: "status",
      message: `Statut de formule invalide. Attendu: 'VERIFIED', 'LICENSED', 'UNVERIFIED' ou 'NOT_IMPLEMENTED'.`,
    });
  } else {
    // 4. Règles de qualification (Section 11) :
    // Une formule ne peut être VERIFIED ou LICENSED que si clauseReference et sourceReference sont non vides
    if (record.status === "VERIFIED" || record.status === "LICENSED") {
      const hasClause =
        "clauseReference" in record &&
        typeof record.clauseReference === "string" &&
        record.clauseReference.trim().length > 0;
      if (!hasClause) {
        errors.push({
          code: "FORMULA_CLAUSE_REQUIRED",
          field: "clauseReference",
          message: `Une formule ${record.status} requiert une clauseReference non vide.`,
        });
      }

      const hasSource =
        "sourceReference" in record &&
        typeof record.sourceReference === "string" &&
        record.sourceReference.trim().length > 0;
      if (!hasSource) {
        errors.push({
          code: "FORMULA_SOURCE_REQUIRED",
          field: "sourceReference",
          message: `Une formule ${record.status} requiert une sourceReference non vide.`,
        });
      }

      if (!hasClause || !hasSource) {
        errors.push({
          code: "FORMULA_NOT_QUALIFIED",
          message: `Formule non qualifiée: ni clause ni source ne peuvent être omises pour le statut ${record.status}.`,
        });
      }
    }
  }

  // 5. Validation optionnelle de calculationType si présent
  if ("calculationType" in record && record.calculationType !== undefined) {
    if (!isEngineeringCalculationType(record.calculationType)) {
      errors.push({
        code: "INVALID_CALCULATION_TYPE",
        field: "calculationType",
        message: `calculationType invalide dans la formule: '${String(record.calculationType)}'.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Vérifie si une formule satisfait toutes les exigences de qualification (VERIFIED ou LICENSED avec clause et source).
 * Une formule NOT_IMPLEMENTED ou UNVERIFIED retourne systématiquement false.
 */
export function isFormulaQualified(
  formula: unknown
): formula is DesignCodeFormulaReference {
  if (!isRecordObject(formula)) return false;
  const validation = validateDesignCodeFormulaReference(formula);
  if (!validation.valid) return false;
  return formula.status === "VERIFIED" || formula.status === "LICENSED";
}
