/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION VALIDATOR
 * Reference: PATCH NORM-07 (Piping Specification Engine / Spec Builder)
 * 
 * Validateur d'intégrité structurelle, normative et de cohérence des spécifications de tuyauterie.
 * 
 * RÈGLE ARCHITECTURALE :
 * - Distingue la validation d'une spec complète (validateCompletePipingSpecification)
 *   de la validation d'une spec partielle (validatePartialPipingSpecification).
 * - Sépare strictement et valide les types de standards :
 *   - designCodeId -> DESIGN_CODE (ASME-B31.3, etc.)
 *   - pipeDimensionalStandardId -> DIMENSIONAL_STANDARD (ASME-B36.10M, etc.)
 *   - fittingStandardId -> PRODUCT_STANDARD (ASME-B16.9, etc.)
 *   - flangeStandardId -> PRODUCT_STANDARD (ASME-B16.5, etc.)
 *   - valve.productStandardId -> PRODUCT_STANDARD (API-600, etc.)
 *   - valve.dimensionalStandardId -> DIMENSIONAL_STANDARD (ASME-B16.10, etc.)
 * - Exige la sécurité de typage strict à la frontière d'exécution (record: unknown).
 * - N'effectue AUCUN calcul mécanique, hydraulique ou d'épaisseur.
 */

import type {
  PipingSpecification,
  PipingSpecSourceStatus,
} from "../types/pipingSpecTypes";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { isRecordObject } from "./pipeDimensionalValidator";
import { VALID_FITTING_TYPES, VALID_CONNECTION_TYPES as VALID_FITTING_CONNECTION_TYPES } from "./fittingValidator";
import { VALID_FLANGE_TYPES, VALID_RATING_SYSTEMS as VALID_FLANGE_RATING_SYSTEMS } from "./flangeValidator";
import { VALID_VALVE_TYPES, VALID_VALVE_CONNECTION_TYPES } from "./valveValidator";

export interface PipingSpecValidationError {
  readonly code: string;
  readonly field: keyof PipingSpecification | string;
  readonly message: string;
}

export interface PipingSpecValidationResult {
  readonly valid: boolean;
  readonly errors: readonly PipingSpecValidationError[];
}

export const VALID_PIPING_SPEC_SOURCE_STATUSES: readonly PipingSpecSourceStatus[] = Object.freeze([
  "VERIFIED",
  "LICENSED",
  "UNVERIFIED",
  "LEGACY",
]);

const VALID_SPEC_SOURCE_STATUSES_SET = new Set<string>(VALID_PIPING_SPEC_SOURCE_STATUSES);
const VALID_FITTING_TYPES_SET = new Set<string>(VALID_FITTING_TYPES);
const VALID_FITTING_CONN_TYPES_SET = new Set<string>(VALID_FITTING_CONNECTION_TYPES);
const VALID_FLANGE_TYPES_SET = new Set<string>(VALID_FLANGE_TYPES);
const VALID_FLANGE_RATING_SYSTEMS_SET = new Set<string>(VALID_FLANGE_RATING_SYSTEMS);
const VALID_VALVE_TYPES_SET = new Set<string>(VALID_VALVE_TYPES);
const VALID_VALVE_CONN_TYPES_SET = new Set<string>(VALID_VALVE_CONNECTION_TYPES);

/**
 * Valide les règles sémantiques et de classification normative partagées.
 * Fonctionne directement sur Record<string, unknown> sans contournement any.
 */
function validatePipingSpecRules(
  record: Record<string, unknown>
): PipingSpecValidationResult {
  const errors: PipingSpecValidationError[] = [];

  // 1. Code
  if (record.code !== undefined) {
    if (typeof record.code !== "string" || record.code.trim() === "") {
      errors.push({
        code: "EMPTY_SPEC_CODE",
        field: "code",
        message: "Le code de la spécification de tuyauterie ne peut pas être une chaîne vide.",
      });
    }
  }

  // 2. Name
  if (record.name !== undefined) {
    if (typeof record.name !== "string" || record.name.trim() === "") {
      errors.push({
        code: "EMPTY_SPEC_NAME",
        field: "name",
        message: "Le nom de la spécification de tuyauterie ne peut pas être une chaîne vide.",
      });
    }
  }

  // 3. Design Code
  if (record.designCodeId !== undefined) {
    if (typeof record.designCodeId !== "string" || record.designCodeId.trim() === "") {
      errors.push({
        code: "INVALID_DESIGN_CODE_ID",
        field: "designCodeId",
        message: "Le designCodeId doit être une chaîne non vide.",
      });
    } else {
      const standardObj = PDI_STANDARDS_REGISTRY[record.designCodeId];
      if (!standardObj) {
        errors.push({
          code: "INVALID_STANDARD_ID",
          field: "designCodeId",
          message: `Le code de conception ${record.designCodeId} n'est pas enregistré dans le registre NORM-01.`,
        });
      } else if (standardObj.standardType !== "DESIGN_CODE") {
        errors.push({
          code: "STANDARD_IS_NOT_DESIGN_CODE",
          field: "designCodeId",
          message: `Le standard ${record.designCodeId} est de type ${standardObj.standardType}. designCodeId exige un standard de type 'DESIGN_CODE' (ex: ASME-B31.3).`,
        });
      }
    }
  }

  // 4. Source Status & Traceability au niveau de la spec
  if (record.sourceStatus !== undefined) {
    if (
      typeof record.sourceStatus !== "string" ||
      !VALID_SPEC_SOURCE_STATUSES_SET.has(record.sourceStatus)
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
        message: `Les spécifications de tuyauterie '${record.sourceStatus}' exigent une référence source (sourceReference) non vide.`,
      });
    }
  }

  // 4b. Material Reference Ids au niveau de la spec
  if (record.materialReferenceIds !== undefined) {
    if (!Array.isArray(record.materialReferenceIds)) {
      errors.push({
        code: "INVALID_ARRAY",
        field: "materialReferenceIds",
        message: "materialReferenceIds doit être un tableau de références matériaux.",
      });
      errors.push({
        code: "INVALID_MATERIAL_REFERENCE",
        field: "materialReferenceIds",
        message: "materialReferenceIds doit être un tableau.",
      });
    } else {
      record.materialReferenceIds.forEach((matId, mIdx) => {
        if (typeof matId !== "string" || matId.trim() === "") {
          errors.push({
            code: "INVALID_MATERIAL_REFERENCE",
            field: `materialReferenceIds[${mIdx}]`,
            message: `La référence matériau à l'index ${mIdx} doit être une chaîne non vide.`,
          });
        }
      });
    }
  }

  // 5. Pipe Rules
  if (record.pipeRules !== undefined) {
    if (!Array.isArray(record.pipeRules)) {
      errors.push({
        code: "INVALID_ARRAY",
        field: "pipeRules",
        message: "pipeRules doit être un tableau de règles de tubes.",
      });
      errors.push({
        code: "INVALID_PIPE_RULES",
        field: "pipeRules",
        message: "pipeRules doit être un tableau de règles de tubes.",
      });
    } else {
      record.pipeRules.forEach((rule, index) => {
        if (!isRecordObject(rule)) {
          errors.push({
            code: "INVALID_PIPE_RULE_OBJECT",
            field: `pipeRules[${index}]`,
            message: "Chaque règle de tube doit être un objet.",
          });
          errors.push({
            code: "INVALID_PIPE_RULE",
            field: `pipeRules[${index}]`,
            message: "Chaque règle de tube doit être un objet.",
          });
          return;
        }

        // Champ obligatoire : pipeDimensionalStandardId
        if (rule.pipeDimensionalStandardId === undefined || rule.pipeDimensionalStandardId === null) {
          errors.push({
            code: "MISSING_PIPE_STANDARD",
            field: `pipeRules[${index}].pipeDimensionalStandardId`,
            message: "pipeDimensionalStandardId est obligatoire pour une règle de tube.",
          });
          errors.push({
            code: "INVALID_PIPE_RULE",
            field: `pipeRules[${index}].pipeDimensionalStandardId`,
            message: "Standard dimensionnel manquant.",
          });
        } else if (typeof rule.pipeDimensionalStandardId !== "string" || rule.pipeDimensionalStandardId.trim() === "") {
          errors.push({
            code: "INVALID_STANDARD_ID",
            field: `pipeRules[${index}].pipeDimensionalStandardId`,
            message: "pipeDimensionalStandardId doit être une chaîne non vide.",
          });
        } else {
          const std = PDI_STANDARDS_REGISTRY[rule.pipeDimensionalStandardId];
          if (!std) {
            errors.push({
              code: "INVALID_STANDARD_ID",
              field: `pipeRules[${index}].pipeDimensionalStandardId`,
              message: `Le standard ${rule.pipeDimensionalStandardId} n'est pas enregistré.`,
            });
          } else if (std.standardType !== "DIMENSIONAL_STANDARD") {
            errors.push({
              code: "STANDARD_IS_NOT_DIMENSIONAL_STANDARD",
              field: `pipeRules[${index}].pipeDimensionalStandardId`,
              message: `Le standard ${rule.pipeDimensionalStandardId} est de type ${std.standardType}. pipeDimensionalStandardId exige un DIMENSIONAL_STANDARD (ex: ASME-B36.10M).`,
            });
          }
        }

        // Champ obligatoire : sourceStatus
        if (rule.sourceStatus === undefined || rule.sourceStatus === null) {
          errors.push({
            code: "MISSING_SOURCE_STATUS",
            field: `pipeRules[${index}].sourceStatus`,
            message: "sourceStatus est obligatoire pour une règle de tube.",
          });
          errors.push({
            code: "INVALID_PIPE_RULE",
            field: `pipeRules[${index}].sourceStatus`,
            message: "sourceStatus manquant pour la règle de tube.",
          });
        } else if (typeof rule.sourceStatus !== "string" || !VALID_SPEC_SOURCE_STATUSES_SET.has(rule.sourceStatus)) {
          errors.push({
            code: "INVALID_SOURCE_STATUS",
            field: `pipeRules[${index}].sourceStatus`,
            message: `Le statut de source '${String(rule.sourceStatus)}' n'est pas valide.`,
          });
        } else if (
          (rule.sourceStatus === "VERIFIED" || rule.sourceStatus === "LICENSED") &&
          (!rule.sourceReference || typeof rule.sourceReference !== "string" || rule.sourceReference.trim() === "")
        ) {
          errors.push({
            code: rule.sourceStatus === "VERIFIED" ? "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE" : "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE",
            field: `pipeRules[${index}].sourceReference`,
            message: `La règle de tube ${rule.sourceStatus} exige une référence source.`,
          });
        }

        // Optionnel : nominalSizes
        if (rule.nominalSizes !== undefined) {
          if (!Array.isArray(rule.nominalSizes)) {
            errors.push({
              code: "INVALID_ARRAY",
              field: `pipeRules[${index}].nominalSizes`,
              message: "nominalSizes doit être un tableau de tailles nominales.",
            });
            errors.push({
              code: "INVALID_PIPE_RULE",
              field: `pipeRules[${index}].nominalSizes`,
              message: "nominalSizes doit être un tableau.",
            });
          } else {
            rule.nominalSizes.forEach((ns, nsIdx) => {
              if (typeof ns !== "string" || ns.trim() === "") {
                errors.push({
                  code: "INVALID_PIPE_RULE",
                  field: `pipeRules[${index}].nominalSizes[${nsIdx}]`,
                  message: `La taille nominale à l'index ${nsIdx} doit être une chaîne non vide.`,
                });
              }
            });
          }
        }

        // Optionnel : schedule
        if (rule.schedule !== undefined) {
          if (typeof rule.schedule !== "string" || rule.schedule.trim() === "") {
            errors.push({
              code: "INVALID_PIPE_RULE",
              field: `pipeRules[${index}].schedule`,
              message: "schedule doit être une chaîne non vide.",
            });
          }
        }

        // Optionnel : materialId
        if (rule.materialId !== undefined) {
          if (typeof rule.materialId !== "string" || rule.materialId.trim() === "") {
            errors.push({
              code: "INVALID_MATERIAL_REFERENCE",
              field: `pipeRules[${index}].materialId`,
              message: "materialId doit être une chaîne non vide.",
            });
          }
        }
      });
    }
  }

  // 6. Fitting Rules
  if (record.fittingRules !== undefined) {
    if (!Array.isArray(record.fittingRules)) {
      errors.push({
        code: "INVALID_ARRAY",
        field: "fittingRules",
        message: "fittingRules doit être un tableau de règles de raccords.",
      });
      errors.push({
        code: "INVALID_FITTING_RULES",
        field: "fittingRules",
        message: "fittingRules doit être un tableau de règles de raccords.",
      });
    } else {
      record.fittingRules.forEach((rule, index) => {
        if (!isRecordObject(rule)) {
          errors.push({
            code: "INVALID_FITTING_RULE_OBJECT",
            field: `fittingRules[${index}]`,
            message: "Chaque règle de raccord doit être un objet.",
          });
          errors.push({
            code: "INVALID_FITTING_RULE",
            field: `fittingRules[${index}]`,
            message: "Chaque règle de raccord doit être un objet.",
          });
          return;
        }

        // Champ obligatoire : fittingStandardId
        if (rule.fittingStandardId === undefined || rule.fittingStandardId === null) {
          errors.push({
            code: "MISSING_FITTING_STANDARD",
            field: `fittingRules[${index}].fittingStandardId`,
            message: "fittingStandardId est obligatoire pour une règle de raccord.",
          });
          errors.push({
            code: "INVALID_FITTING_RULE",
            field: `fittingRules[${index}].fittingStandardId`,
            message: "Standard de raccord manquant.",
          });
        } else if (typeof rule.fittingStandardId !== "string" || rule.fittingStandardId.trim() === "") {
          errors.push({
            code: "INVALID_STANDARD_ID",
            field: `fittingRules[${index}].fittingStandardId`,
            message: "fittingStandardId doit être une chaîne non vide.",
          });
        } else {
          const std = PDI_STANDARDS_REGISTRY[rule.fittingStandardId];
          if (!std) {
            errors.push({
              code: "INVALID_STANDARD_ID",
              field: `fittingRules[${index}].fittingStandardId`,
              message: `Le standard ${rule.fittingStandardId} n'est pas enregistré.`,
            });
          } else if (std.standardType !== "PRODUCT_STANDARD") {
            errors.push({
              code: "STANDARD_IS_NOT_PRODUCT_STANDARD",
              field: `fittingRules[${index}].fittingStandardId`,
              message: `Le standard ${rule.fittingStandardId} est de type ${std.standardType}. fittingStandardId exige un PRODUCT_STANDARD (ex: ASME-B16.9).`,
            });
          }
        }

        // Champ obligatoire : sourceStatus
        if (rule.sourceStatus === undefined || rule.sourceStatus === null) {
          errors.push({
            code: "MISSING_SOURCE_STATUS",
            field: `fittingRules[${index}].sourceStatus`,
            message: "sourceStatus est obligatoire pour une règle de raccord.",
          });
          errors.push({
            code: "INVALID_FITTING_RULE",
            field: `fittingRules[${index}].sourceStatus`,
            message: "sourceStatus manquant pour la règle de raccord.",
          });
        } else if (typeof rule.sourceStatus !== "string" || !VALID_SPEC_SOURCE_STATUSES_SET.has(rule.sourceStatus)) {
          errors.push({
            code: "INVALID_SOURCE_STATUS",
            field: `fittingRules[${index}].sourceStatus`,
            message: `Le statut de source '${String(rule.sourceStatus)}' n'est pas valide.`,
          });
        } else if (
          (rule.sourceStatus === "VERIFIED" || rule.sourceStatus === "LICENSED") &&
          (!rule.sourceReference || typeof rule.sourceReference !== "string" || rule.sourceReference.trim() === "")
        ) {
          errors.push({
            code: rule.sourceStatus === "VERIFIED" ? "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE" : "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE",
            field: `fittingRules[${index}].sourceReference`,
            message: `La règle de raccord ${rule.sourceStatus} exige une référence source.`,
          });
        }

        // Optionnel : fittingTypes
        if (rule.fittingTypes !== undefined) {
          if (!Array.isArray(rule.fittingTypes)) {
            errors.push({
              code: "INVALID_ARRAY",
              field: `fittingRules[${index}].fittingTypes`,
              message: "fittingTypes doit être un tableau.",
            });
            errors.push({
              code: "INVALID_FITTING_TYPES",
              field: `fittingRules[${index}].fittingTypes`,
              message: "fittingTypes doit être un tableau.",
            });
          } else {
            rule.fittingTypes.forEach((ft) => {
              if (typeof ft !== "string" || !VALID_FITTING_TYPES_SET.has(ft)) {
                errors.push({
                  code: "INVALID_FITTING_TYPE",
                  field: `fittingRules[${index}].fittingTypes`,
                  message: `Type de raccord invalide : ${String(ft)}`,
                });
                errors.push({
                  code: "INVALID_FITTING_TYPES",
                  field: `fittingRules[${index}].fittingTypes`,
                  message: `Type de raccord invalide : ${String(ft)}`,
                });
              }
            });
          }
        }

        // Optionnel : connectionTypes
        if (rule.connectionTypes !== undefined) {
          if (!Array.isArray(rule.connectionTypes)) {
            errors.push({
              code: "INVALID_ARRAY",
              field: `fittingRules[${index}].connectionTypes`,
              message: "connectionTypes doit être un tableau.",
            });
            errors.push({
              code: "INVALID_FITTING_CONNECTION_TYPES",
              field: `fittingRules[${index}].connectionTypes`,
              message: "connectionTypes doit être un tableau.",
            });
          } else {
            rule.connectionTypes.forEach((ct) => {
              if (typeof ct !== "string" || !VALID_FITTING_CONN_TYPES_SET.has(ct)) {
                errors.push({
                  code: "INVALID_CONNECTION_TYPE",
                  field: `fittingRules[${index}].connectionTypes`,
                  message: `Type de raccordement invalide : ${String(ct)}`,
                });
                errors.push({
                  code: "INVALID_FITTING_CONNECTION_TYPES",
                  field: `fittingRules[${index}].connectionTypes`,
                  message: `Type de raccordement invalide : ${String(ct)}`,
                });
              }
            });
          }
        }

        // Optionnel : materialId
        if (rule.materialId !== undefined) {
          if (typeof rule.materialId !== "string" || rule.materialId.trim() === "") {
            errors.push({
              code: "INVALID_MATERIAL_REFERENCE",
              field: `fittingRules[${index}].materialId`,
              message: "materialId doit être une chaîne non vide.",
            });
          }
        }
      });
    }
  }

  // 7. Flange Rules
  if (record.flangeRules !== undefined) {
    if (!Array.isArray(record.flangeRules)) {
      errors.push({
        code: "INVALID_ARRAY",
        field: "flangeRules",
        message: "flangeRules doit être un tableau de règles de brides.",
      });
      errors.push({
        code: "INVALID_FLANGE_RULES",
        field: "flangeRules",
        message: "flangeRules doit être un tableau de règles de brides.",
      });
    } else {
      record.flangeRules.forEach((rule, index) => {
        if (!isRecordObject(rule)) {
          errors.push({
            code: "INVALID_FLANGE_RULE_OBJECT",
            field: `flangeRules[${index}]`,
            message: "Chaque règle de bride doit être un objet.",
          });
          errors.push({
            code: "INVALID_FLANGE_RULE",
            field: `flangeRules[${index}]`,
            message: "Chaque règle de bride doit être un objet.",
          });
          return;
        }

        // Champ obligatoire : flangeStandardId
        if (rule.flangeStandardId === undefined || rule.flangeStandardId === null) {
          errors.push({
            code: "MISSING_FLANGE_STANDARD",
            field: `flangeRules[${index}].flangeStandardId`,
            message: "flangeStandardId est obligatoire pour une règle de bride.",
          });
          errors.push({
            code: "INVALID_FLANGE_RULE",
            field: `flangeRules[${index}].flangeStandardId`,
            message: "Standard de bride manquant.",
          });
        } else if (typeof rule.flangeStandardId !== "string" || rule.flangeStandardId.trim() === "") {
          errors.push({
            code: "INVALID_STANDARD_ID",
            field: `flangeRules[${index}].flangeStandardId`,
            message: "flangeStandardId doit être une chaîne non vide.",
          });
        } else {
          const std = PDI_STANDARDS_REGISTRY[rule.flangeStandardId];
          if (!std) {
            errors.push({
              code: "INVALID_STANDARD_ID",
              field: `flangeRules[${index}].flangeStandardId`,
              message: `Le standard ${rule.flangeStandardId} n'est pas enregistré.`,
            });
          } else if (std.standardType !== "PRODUCT_STANDARD") {
            errors.push({
              code: "STANDARD_IS_NOT_PRODUCT_STANDARD",
              field: `flangeRules[${index}].flangeStandardId`,
              message: `Le standard ${rule.flangeStandardId} est de type ${std.standardType}. flangeStandardId exige un PRODUCT_STANDARD (ex: ASME-B16.5).`,
            });
          }
        }

        // Champ obligatoire : sourceStatus
        if (rule.sourceStatus === undefined || rule.sourceStatus === null) {
          errors.push({
            code: "MISSING_SOURCE_STATUS",
            field: `flangeRules[${index}].sourceStatus`,
            message: "sourceStatus est obligatoire pour une règle de bride.",
          });
          errors.push({
            code: "INVALID_FLANGE_RULE",
            field: `flangeRules[${index}].sourceStatus`,
            message: "sourceStatus manquant pour la règle de bride.",
          });
        } else if (typeof rule.sourceStatus !== "string" || !VALID_SPEC_SOURCE_STATUSES_SET.has(rule.sourceStatus)) {
          errors.push({
            code: "INVALID_SOURCE_STATUS",
            field: `flangeRules[${index}].sourceStatus`,
            message: `Le statut de source '${String(rule.sourceStatus)}' n'est pas valide.`,
          });
        } else if (
          (rule.sourceStatus === "VERIFIED" || rule.sourceStatus === "LICENSED") &&
          (!rule.sourceReference || typeof rule.sourceReference !== "string" || rule.sourceReference.trim() === "")
        ) {
          errors.push({
            code: rule.sourceStatus === "VERIFIED" ? "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE" : "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE",
            field: `flangeRules[${index}].sourceReference`,
            message: `La règle de bride ${rule.sourceStatus} exige une référence source.`,
          });
        }

        // Optionnel : ratingSystem (avec validation stricte et cohérence)
        if (rule.ratingSystem !== undefined) {
          if (typeof rule.ratingSystem !== "string" || !VALID_FLANGE_RATING_SYSTEMS_SET.has(rule.ratingSystem)) {
            errors.push({
              code: "INVALID_RATING_SYSTEM",
              field: `flangeRules[${index}].ratingSystem`,
              message: `Système de rating bride invalide : ${String(rule.ratingSystem)}`,
            });
          } else {
            // Cohérence avec le standard
            if (
              (rule.flangeStandardId === "ASME-B16.5" || rule.flangeStandardId === "ASME-B16.47") &&
              rule.ratingSystem !== "ASME_CLASS"
            ) {
              errors.push({
                code: "INVALID_RATING_SYSTEM",
                field: `flangeRules[${index}].ratingSystem`,
                message: `Le standard ${rule.flangeStandardId} exige le ratingSystem 'ASME_CLASS'.`,
              });
            } else if (rule.flangeStandardId === "EN-1092-1" && rule.ratingSystem !== "EN_PN") {
              errors.push({
                code: "INVALID_RATING_SYSTEM",
                field: `flangeRules[${index}].ratingSystem`,
                message: "Le standard EN-1092-1 exige le ratingSystem 'EN_PN'.",
              });
            }
          }
        }

        // Optionnel : rating
        if (rule.rating !== undefined) {
          if (typeof rule.rating !== "string" || rule.rating.trim() === "") {
            errors.push({
              code: "INVALID_FLANGE_RULE",
              field: `flangeRules[${index}].rating`,
              message: "rating doit être une chaîne non vide.",
            });
          }
        }

        // Optionnel : flangeTypes
        if (rule.flangeTypes !== undefined) {
          if (!Array.isArray(rule.flangeTypes)) {
            errors.push({
              code: "INVALID_ARRAY",
              field: `flangeRules[${index}].flangeTypes`,
              message: "flangeTypes doit être un tableau.",
            });
            errors.push({
              code: "INVALID_FLANGE_TYPES",
              field: `flangeRules[${index}].flangeTypes`,
              message: "flangeTypes doit être un tableau.",
            });
          } else {
            rule.flangeTypes.forEach((flt) => {
              if (typeof flt !== "string" || !VALID_FLANGE_TYPES_SET.has(flt)) {
                errors.push({
                  code: "INVALID_FLANGE_TYPE",
                  field: `flangeRules[${index}].flangeTypes`,
                  message: `Type de bride invalide : ${String(flt)}`,
                });
                errors.push({
                  code: "INVALID_FLANGE_TYPES",
                  field: `flangeRules[${index}].flangeTypes`,
                  message: `Type de bride invalide : ${String(flt)}`,
                });
              }
            });
          }
        }

        // Optionnel : materialId
        if (rule.materialId !== undefined) {
          if (typeof rule.materialId !== "string" || rule.materialId.trim() === "") {
            errors.push({
              code: "INVALID_MATERIAL_REFERENCE",
              field: `flangeRules[${index}].materialId`,
              message: "materialId doit être une chaîne non vide.",
            });
          }
        }
      });
    }
  }

  // 8. Valve Rules
  if (record.valveRules !== undefined) {
    if (!Array.isArray(record.valveRules)) {
      errors.push({
        code: "INVALID_ARRAY",
        field: "valveRules",
        message: "valveRules doit être un tableau de règles de vannes.",
      });
      errors.push({
        code: "INVALID_VALVE_RULES",
        field: "valveRules",
        message: "valveRules doit être un tableau de règles de vannes.",
      });
    } else {
      record.valveRules.forEach((rule, index) => {
        if (!isRecordObject(rule)) {
          errors.push({
            code: "INVALID_VALVE_RULE_OBJECT",
            field: `valveRules[${index}]`,
            message: "Chaque règle de vanne doit être un objet.",
          });
          errors.push({
            code: "INVALID_VALVE_RULE",
            field: `valveRules[${index}]`,
            message: "Chaque règle de vanne doit être un objet.",
          });
          return;
        }

        // Standard obligatoire : au moins productStandardId OU dimensionalStandardId
        if (rule.productStandardId === undefined && rule.dimensionalStandardId === undefined) {
          errors.push({
            code: "MISSING_VALVE_STANDARD",
            field: `valveRules[${index}]`,
            message: "Une règle de vanne doit comporter au moins un productStandardId ou un dimensionalStandardId.",
          });
          errors.push({
            code: "INVALID_VALVE_RULE",
            field: `valveRules[${index}]`,
            message: "Standard de vanne manquant.",
          });
        }

        // Validation productStandardId si fourni
        if (rule.productStandardId !== undefined) {
          if (typeof rule.productStandardId !== "string" || rule.productStandardId.trim() === "") {
            errors.push({
              code: "INVALID_STANDARD_ID",
              field: `valveRules[${index}].productStandardId`,
              message: "productStandardId doit être une chaîne non vide.",
            });
          } else {
            const std = PDI_STANDARDS_REGISTRY[rule.productStandardId];
            if (!std) {
              errors.push({
                code: "INVALID_STANDARD_ID",
                field: `valveRules[${index}].productStandardId`,
                message: `Le standard ${rule.productStandardId} n'est pas enregistré.`,
              });
            } else if (std.standardType !== "PRODUCT_STANDARD") {
              errors.push({
                code: "STANDARD_IS_NOT_PRODUCT_STANDARD",
                field: `valveRules[${index}].productStandardId`,
                message: `Le standard ${rule.productStandardId} est de type ${std.standardType}. productStandardId exige un PRODUCT_STANDARD (ex: API-600).`,
              });
            }
          }
        }

        // Validation dimensionalStandardId si fourni
        if (rule.dimensionalStandardId !== undefined) {
          if (typeof rule.dimensionalStandardId !== "string" || rule.dimensionalStandardId.trim() === "") {
            errors.push({
              code: "INVALID_STANDARD_ID",
              field: `valveRules[${index}].dimensionalStandardId`,
              message: "dimensionalStandardId doit être une chaîne non vide.",
            });
          } else {
            const std = PDI_STANDARDS_REGISTRY[rule.dimensionalStandardId];
            if (!std) {
              errors.push({
                code: "INVALID_STANDARD_ID",
                field: `valveRules[${index}].dimensionalStandardId`,
                message: `Le standard ${rule.dimensionalStandardId} n'est pas enregistré.`,
              });
            } else if (std.standardType !== "DIMENSIONAL_STANDARD") {
              errors.push({
                code: "STANDARD_IS_NOT_DIMENSIONAL_STANDARD",
                field: `valveRules[${index}].dimensionalStandardId`,
                message: `Le standard ${rule.dimensionalStandardId} est de type ${std.standardType}. dimensionalStandardId exige un DIMENSIONAL_STANDARD (ex: ASME-B16.10).`,
              });
            }
          }
        }

        // Champ obligatoire : sourceStatus
        if (rule.sourceStatus === undefined || rule.sourceStatus === null) {
          errors.push({
            code: "MISSING_SOURCE_STATUS",
            field: `valveRules[${index}].sourceStatus`,
            message: "sourceStatus est obligatoire pour une règle de vanne.",
          });
          errors.push({
            code: "INVALID_VALVE_RULE",
            field: `valveRules[${index}].sourceStatus`,
            message: "sourceStatus manquant pour la règle de vanne.",
          });
        } else if (typeof rule.sourceStatus !== "string" || !VALID_SPEC_SOURCE_STATUSES_SET.has(rule.sourceStatus)) {
          errors.push({
            code: "INVALID_SOURCE_STATUS",
            field: `valveRules[${index}].sourceStatus`,
            message: `Le statut de source '${String(rule.sourceStatus)}' n'est pas valide.`,
          });
        } else if (
          (rule.sourceStatus === "VERIFIED" || rule.sourceStatus === "LICENSED") &&
          (!rule.sourceReference || typeof rule.sourceReference !== "string" || rule.sourceReference.trim() === "")
        ) {
          errors.push({
            code: rule.sourceStatus === "VERIFIED" ? "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE" : "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE",
            field: `valveRules[${index}].sourceReference`,
            message: `La règle de vanne ${rule.sourceStatus} exige une référence source.`,
          });
        }

        // Optionnel : valveTypes
        if (rule.valveTypes !== undefined) {
          if (!Array.isArray(rule.valveTypes)) {
            errors.push({
              code: "INVALID_ARRAY",
              field: `valveRules[${index}].valveTypes`,
              message: "valveTypes doit être un tableau.",
            });
            errors.push({
              code: "INVALID_VALVE_TYPES",
              field: `valveRules[${index}].valveTypes`,
              message: "valveTypes doit être un tableau.",
            });
          } else {
            rule.valveTypes.forEach((vt) => {
              if (typeof vt !== "string" || !VALID_VALVE_TYPES_SET.has(vt)) {
                errors.push({
                  code: "INVALID_VALVE_TYPE",
                  field: `valveRules[${index}].valveTypes`,
                  message: `Famille de vanne invalide : ${String(vt)}`,
                });
                errors.push({
                  code: "INVALID_VALVE_TYPES",
                  field: `valveRules[${index}].valveTypes`,
                  message: `Famille de vanne invalide : ${String(vt)}`,
                });
              }
            });
          }
        }

        // Optionnel : connectionTypes
        if (rule.connectionTypes !== undefined) {
          if (!Array.isArray(rule.connectionTypes)) {
            errors.push({
              code: "INVALID_ARRAY",
              field: `valveRules[${index}].connectionTypes`,
              message: "connectionTypes doit être un tableau.",
            });
            errors.push({
              code: "INVALID_VALVE_CONNECTION_TYPES",
              field: `valveRules[${index}].connectionTypes`,
              message: "connectionTypes doit être un tableau.",
            });
          } else {
            rule.connectionTypes.forEach((vct) => {
              if (typeof vct !== "string" || !VALID_VALVE_CONN_TYPES_SET.has(vct)) {
                errors.push({
                  code: "INVALID_CONNECTION_TYPE",
                  field: `valveRules[${index}].connectionTypes`,
                  message: `Raccordement de vanne invalide : ${String(vct)}`,
                });
                errors.push({
                  code: "INVALID_VALVE_CONNECTION_TYPES",
                  field: `valveRules[${index}].connectionTypes`,
                  message: `Raccordement de vanne invalide : ${String(vct)}`,
                });
              }
            });
          }
        }

        // Optionnel : materialId
        if (rule.materialId !== undefined) {
          if (typeof rule.materialId !== "string" || rule.materialId.trim() === "") {
            errors.push({
              code: "INVALID_MATERIAL_REFERENCE",
              field: `valveRules[${index}].materialId`,
              message: "materialId doit être une chaîne non vide.",
            });
          }
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide une spécification partielle (Partial<PipingSpecification> ou inconnu).
 * L'entrée {} est un état partiel valide.
 * Toute entrée non-objet produit INVALID_RECORD_OBJECT.
 */
export function validatePartialPipingSpecification(
  record: unknown
): PipingSpecValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement partiel de spécification doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  return validatePipingSpecRules(record);
}

/**
 * Valide une spécification complète (PipingSpecification).
 * Entrée typée en `unknown` pour garantir la sécurité de typage strict à la frontière runtime.
 * Exige impérativement : id, code, name, sourceStatus.
 */
export function validateCompletePipingSpecification(
  record: unknown
): PipingSpecValidationResult {
  if (!isRecordObject(record)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          field: "record",
          message: "L'enregistrement complet de spécification doit être un objet non-null et non-tableau.",
        },
      ],
    };
  }

  const errors: PipingSpecValidationError[] = [];

  // Field: id
  if (record.id === undefined || record.id === null) {
    errors.push({
      code: "MISSING_RECORD_ID",
      field: "id",
      message: "L'identifiant de la spécification (id) est obligatoire pour un record complet.",
    });
  } else if (typeof record.id !== "string" || record.id.trim() === "") {
    errors.push({
      code: "EMPTY_RECORD_ID",
      field: "id",
      message: "L'identifiant de la spécification (id) ne peut pas être une chaîne vide.",
    });
  }

  // Field: code
  if (record.code === undefined || record.code === null) {
    errors.push({
      code: "MISSING_SPEC_CODE",
      field: "code",
      message: "Le code métier de la spécification (code) est obligatoire pour un record complet.",
    });
  } else if (typeof record.code !== "string" || record.code.trim() === "") {
    errors.push({
      code: "EMPTY_SPEC_CODE",
      field: "code",
      message: "Le code métier de la spécification (code) ne peut pas être une chaîne vide.",
    });
  }

  // Field: name
  if (record.name === undefined || record.name === null) {
    errors.push({
      code: "MISSING_SPEC_NAME",
      field: "name",
      message: "Le nom descriptif de la spécification (name) est obligatoire pour un record complet.",
    });
  } else if (typeof record.name !== "string" || record.name.trim() === "") {
    errors.push({
      code: "EMPTY_SPEC_NAME",
      field: "name",
      message: "Le nom descriptif de la spécification (name) ne peut pas être une chaîne vide.",
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

  // Collections structurelles obligatoires pour un record complet (doivent être des tableaux, potentiellement vides)
  if (record.materialReferenceIds === undefined || record.materialReferenceIds === null) {
    errors.push({
      code: "MISSING_MATERIAL_REFERENCES",
      field: "materialReferenceIds",
      message: "materialReferenceIds est obligatoire pour un record complet.",
    });
  } else if (!Array.isArray(record.materialReferenceIds)) {
    errors.push({
      code: "INVALID_ARRAY",
      field: "materialReferenceIds",
      message: "materialReferenceIds doit être un tableau.",
    });
  }

  if (record.pipeRules === undefined || record.pipeRules === null) {
    errors.push({
      code: "MISSING_PIPE_RULES",
      field: "pipeRules",
      message: "pipeRules est obligatoire pour un record complet.",
    });
  } else if (!Array.isArray(record.pipeRules)) {
    errors.push({
      code: "INVALID_ARRAY",
      field: "pipeRules",
      message: "pipeRules doit être un tableau.",
    });
  }

  if (record.fittingRules === undefined || record.fittingRules === null) {
    errors.push({
      code: "MISSING_FITTING_RULES",
      field: "fittingRules",
      message: "fittingRules est obligatoire pour un record complet.",
    });
  } else if (!Array.isArray(record.fittingRules)) {
    errors.push({
      code: "INVALID_ARRAY",
      field: "fittingRules",
      message: "fittingRules doit être un tableau.",
    });
  }

  if (record.flangeRules === undefined || record.flangeRules === null) {
    errors.push({
      code: "MISSING_FLANGE_RULES",
      field: "flangeRules",
      message: "flangeRules est obligatoire pour un record complet.",
    });
  } else if (!Array.isArray(record.flangeRules)) {
    errors.push({
      code: "INVALID_ARRAY",
      field: "flangeRules",
      message: "flangeRules doit être un tableau.",
    });
  }

  if (record.valveRules === undefined || record.valveRules === null) {
    errors.push({
      code: "MISSING_VALVE_RULES",
      field: "valveRules",
      message: "valveRules est obligatoire pour un record complet.",
    });
  } else if (!Array.isArray(record.valveRules)) {
    errors.push({
      code: "INVALID_ARRAY",
      field: "valveRules",
      message: "valveRules doit être un tableau.",
    });
  }

  // Évaluation des règles partagées sans cast
  const rulesResult = validatePipingSpecRules(record);

  const combinedErrors = [...errors, ...rulesResult.errors];

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
  };
}

/**
 * Valide l'unicité des codes et identifiants dans une collection de spécifications.
 */
export function validatePipingSpecRegistryUniqueness(
  specs: readonly unknown[]
): PipingSpecValidationResult {
  const errors: PipingSpecValidationError[] = [];
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();

  specs.forEach((item, index) => {
    if (isRecordObject(item)) {
      if (typeof item.id === "string") {
        if (seenIds.has(item.id)) {
          errors.push({
            code: "DUPLICATE_SPEC_ID",
            field: `specs[${index}].id`,
            message: `L'identifiant de spécification '${item.id}' est dupliqué.`,
          });
        }
        seenIds.add(item.id);
      }

      if (typeof item.code === "string") {
        if (seenCodes.has(item.code)) {
          errors.push({
            code: "DUPLICATE_SPEC_CODE",
            field: `specs[${index}].code`,
            message: `Le code de spécification '${item.code}' est dupliqué.`,
          });
        }
        seenCodes.add(item.code);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Alias de compatibilité pour la validation de spécification.
 */
export const validatePipingSpecification = validatePartialPipingSpecification;
