/**
 * PDI NORMATIVE ENGINE — NORMATIVE EVIDENCE TRACEABILITY VALIDATOR
 * Reference: NORM-14-10 (Evidence / Traceability Lock)
 * 
 * Validateur structurel et d'audit de provenance pour la traçabilité normative.
 * RÈGLES DE VALIDATION STRICTES (NORM-14-10) :
 * 1. Rejet strict de null, undefined, primitives, arrays comme objet d'entrée.
 * 2. Tous les identifiants (ruleId, evidenceId, conflictCode) doivent être des chaînes non-vides opaques.
 * 3. Rejet des IDs non-strings ou chaînes vides (espaces inclus).
 * 4. Validation de la cohérence de provenance Rule ↔ Evidence : toute evidence associée à une règle doit être déclarée.
 * 5. Validation de la cohérence de provenance Conflict ↔ Evidence : toute evidence associée à un conflit doit être déclarée.
 * 6. Validation des références croisées : toute règle dans ruleEvidence doit appartenir aux matchedRuleIds déclarés.
 * 7. Validation des références croisées : tout conflit dans conflicts doit appartenir aux conflictCodes déclarés.
 * 8. Validation purement structurelle et d'audit : aucun calcul sémantique, aucun accès aux tables normatives.
 */

import { isRecordObject } from "./pipeDimensionalValidator";

export type TraceabilityValidationErrorCode =
  | "TRACEABILITY_INVALID_INPUT"
  | "TRACEABILITY_NON_STRING_RULE_ID"
  | "TRACEABILITY_EMPTY_RULE_ID"
  | "TRACEABILITY_NON_STRING_EVIDENCE_ID"
  | "TRACEABILITY_EMPTY_EVIDENCE_ID"
  | "TRACEABILITY_NON_STRING_CONFLICT_CODE"
  | "TRACEABILITY_EMPTY_CONFLICT_CODE"
  | "TRACEABILITY_INVALID_RULE_EVIDENCE_STRUCTURE"
  | "TRACEABILITY_INVALID_CONFLICT_STRUCTURE"
  | "TRACEABILITY_INVALID_RULE_REFERENCE"
  | "TRACEABILITY_INVALID_EVIDENCE_REFERENCE"
  | "TRACEABILITY_INVALID_CONFLICT_REFERENCE"
  | "TRACEABILITY_INCONSISTENT_RULE_EVIDENCE"
  | "TRACEABILITY_INCONSISTENT_CONFLICT_EVIDENCE";

export interface TraceabilityValidationError {
  readonly code: TraceabilityValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface TraceabilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly TraceabilityValidationError[];
}

/**
 * Valide structurellement et sémantiquement les traces de provenance d'un résultat normatif.
 */
export function validateTraceabilityInput(raw: unknown): TraceabilityValidationResult {
  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: Object.freeze([
        {
          code: "TRACEABILITY_INVALID_INPUT",
          field: "input",
          message: "Traceability input must be a non-null, non-array object.",
        },
      ]),
    };
  }

  const errors: TraceabilityValidationError[] = [];
  const candidate = raw as Record<string, unknown>;

  // 1. Validation de matchedRuleIds
  const declaredRuleIds = new Set<string>();
  if (candidate.matchedRuleIds !== undefined && candidate.matchedRuleIds !== null) {
    if (!Array.isArray(candidate.matchedRuleIds)) {
      errors.push({
        code: "TRACEABILITY_INVALID_INPUT",
        field: "matchedRuleIds",
        message: "Field 'matchedRuleIds' must be an array.",
      });
    } else {
      for (let i = 0; i < candidate.matchedRuleIds.length; i++) {
        const item = candidate.matchedRuleIds[i];
        if (typeof item !== "string") {
          errors.push({
            code: "TRACEABILITY_NON_STRING_RULE_ID",
            field: `matchedRuleIds[${i}]`,
            message: `Rule ID at index ${i} must be a string, got ${typeof item}.`,
          });
        } else if (item.trim().length === 0) {
          errors.push({
            code: "TRACEABILITY_EMPTY_RULE_ID",
            field: `matchedRuleIds[${i}]`,
            message: `Rule ID at index ${i} must not be empty.`,
          });
        } else {
          declaredRuleIds.add(item);
        }
      }
    }
  }

  // 2. Validation de evidenceIds
  const declaredEvidenceIds = new Set<string>();
  if (candidate.evidenceIds !== undefined && candidate.evidenceIds !== null) {
    if (!Array.isArray(candidate.evidenceIds)) {
      errors.push({
        code: "TRACEABILITY_INVALID_INPUT",
        field: "evidenceIds",
        message: "Field 'evidenceIds' must be an array.",
      });
    } else {
      for (let i = 0; i < candidate.evidenceIds.length; i++) {
        const item = candidate.evidenceIds[i];
        if (typeof item !== "string") {
          errors.push({
            code: "TRACEABILITY_NON_STRING_EVIDENCE_ID",
            field: `evidenceIds[${i}]`,
            message: `Evidence ID at index ${i} must be a string, got ${typeof item}.`,
          });
        } else if (item.trim().length === 0) {
          errors.push({
            code: "TRACEABILITY_EMPTY_EVIDENCE_ID",
            field: `evidenceIds[${i}]`,
            message: `Evidence ID at index ${i} must not be empty.`,
          });
        } else {
          declaredEvidenceIds.add(item);
        }
      }
    }
  }

  // 3. Validation de conflictCodes
  const declaredConflictCodes = new Set<string>();
  if (candidate.conflictCodes !== undefined && candidate.conflictCodes !== null) {
    if (!Array.isArray(candidate.conflictCodes)) {
      errors.push({
        code: "TRACEABILITY_INVALID_INPUT",
        field: "conflictCodes",
        message: "Field 'conflictCodes' must be an array.",
      });
    } else {
      for (let i = 0; i < candidate.conflictCodes.length; i++) {
        const item = candidate.conflictCodes[i];
        if (typeof item !== "string") {
          errors.push({
            code: "TRACEABILITY_NON_STRING_CONFLICT_CODE",
            field: `conflictCodes[${i}]`,
            message: `Conflict code at index ${i} must be a string, got ${typeof item}.`,
          });
        } else if (item.trim().length === 0) {
          errors.push({
            code: "TRACEABILITY_EMPTY_CONFLICT_CODE",
            field: `conflictCodes[${i}]`,
            message: `Conflict code at index ${i} must not be empty.`,
          });
        } else {
          declaredConflictCodes.add(item);
        }
      }
    }
  }

  // 4. Validation de ruleEvidence (Rule ↔ Evidence provenance)
  if (candidate.ruleEvidence !== undefined && candidate.ruleEvidence !== null) {
    if (!Array.isArray(candidate.ruleEvidence)) {
      errors.push({
        code: "TRACEABILITY_INVALID_RULE_EVIDENCE_STRUCTURE",
        field: "ruleEvidence",
        message: "Field 'ruleEvidence' must be an array.",
      });
    } else {
      for (let i = 0; i < candidate.ruleEvidence.length; i++) {
        const item = candidate.ruleEvidence[i];
        if (!isRecordObject(item)) {
          errors.push({
            code: "TRACEABILITY_INVALID_RULE_EVIDENCE_STRUCTURE",
            field: `ruleEvidence[${i}]`,
            message: `Entry at ruleEvidence[${i}] must be an object.`,
          });
          continue;
        }

        // ruleId
        if (item.ruleId === undefined || item.ruleId === null) {
          errors.push({
            code: "TRACEABILITY_EMPTY_RULE_ID",
            field: `ruleEvidence[${i}].ruleId`,
            message: `Field 'ruleId' at ruleEvidence[${i}] is required.`,
          });
        } else if (typeof item.ruleId !== "string") {
          errors.push({
            code: "TRACEABILITY_NON_STRING_RULE_ID",
            field: `ruleEvidence[${i}].ruleId`,
            message: `Field 'ruleId' at ruleEvidence[${i}] must be a string.`,
          });
        } else if (item.ruleId.trim().length === 0) {
          errors.push({
            code: "TRACEABILITY_EMPTY_RULE_ID",
            field: `ruleEvidence[${i}].ruleId`,
            message: `Field 'ruleId' at ruleEvidence[${i}] must not be empty.`,
          });
        } else if (
          candidate.matchedRuleIds !== undefined &&
          candidate.matchedRuleIds !== null &&
          !declaredRuleIds.has(item.ruleId)
        ) {
          errors.push({
            code: "TRACEABILITY_INVALID_RULE_REFERENCE",
            field: `ruleEvidence[${i}].ruleId`,
            message: `Rule ID '${item.ruleId}' in ruleEvidence is not present in matchedRuleIds.`,
          });
        }

        // evidenceIds for this rule
        if (item.evidenceIds === undefined || item.evidenceIds === null || !Array.isArray(item.evidenceIds)) {
          errors.push({
            code: "TRACEABILITY_INVALID_RULE_EVIDENCE_STRUCTURE",
            field: `ruleEvidence[${i}].evidenceIds`,
            message: `Field 'evidenceIds' at ruleEvidence[${i}] must be an array.`,
          });
        } else {
          for (let j = 0; j < item.evidenceIds.length; j++) {
            const eid = item.evidenceIds[j];
            if (typeof eid !== "string") {
              errors.push({
                code: "TRACEABILITY_NON_STRING_EVIDENCE_ID",
                field: `ruleEvidence[${i}].evidenceIds[${j}]`,
                message: `Evidence ID at ruleEvidence[${i}].evidenceIds[${j}] must be a string.`,
              });
            } else if (eid.trim().length === 0) {
              errors.push({
                code: "TRACEABILITY_EMPTY_EVIDENCE_ID",
                field: `ruleEvidence[${i}].evidenceIds[${j}]`,
                message: `Evidence ID at ruleEvidence[${i}].evidenceIds[${j}] must not be empty.`,
              });
            } else if (
              candidate.evidenceIds !== undefined &&
              candidate.evidenceIds !== null &&
              !declaredEvidenceIds.has(eid)
            ) {
              errors.push({
                code: "TRACEABILITY_INCONSISTENT_RULE_EVIDENCE",
                field: `ruleEvidence[${i}].evidenceIds[${j}]`,
                message: `Evidence ID '${eid}' associated with rule '${String(
                  item.ruleId
                )}' is not present in declared evidenceIds.`,
              });
            }
          }
        }
      }
    }
  }

  // 5. Validation de conflicts (Conflict ↔ Evidence provenance)
  if (candidate.conflicts !== undefined && candidate.conflicts !== null) {
    if (!Array.isArray(candidate.conflicts)) {
      errors.push({
        code: "TRACEABILITY_INVALID_CONFLICT_STRUCTURE",
        field: "conflicts",
        message: "Field 'conflicts' must be an array.",
      });
    } else {
      for (let i = 0; i < candidate.conflicts.length; i++) {
        const item = candidate.conflicts[i];
        if (!isRecordObject(item)) {
          errors.push({
            code: "TRACEABILITY_INVALID_CONFLICT_STRUCTURE",
            field: `conflicts[${i}]`,
            message: `Entry at conflicts[${i}] must be an object.`,
          });
          continue;
        }

        // conflictCode
        if (item.conflictCode === undefined || item.conflictCode === null) {
          errors.push({
            code: "TRACEABILITY_EMPTY_CONFLICT_CODE",
            field: `conflicts[${i}].conflictCode`,
            message: `Field 'conflictCode' at conflicts[${i}] is required.`,
          });
        } else if (typeof item.conflictCode !== "string") {
          errors.push({
            code: "TRACEABILITY_NON_STRING_CONFLICT_CODE",
            field: `conflicts[${i}].conflictCode`,
            message: `Field 'conflictCode' at conflicts[${i}] must be a string.`,
          });
        } else if (item.conflictCode.trim().length === 0) {
          errors.push({
            code: "TRACEABILITY_EMPTY_CONFLICT_CODE",
            field: `conflicts[${i}].conflictCode`,
            message: `Field 'conflictCode' at conflicts[${i}] must not be empty.`,
          });
        } else if (
          candidate.conflictCodes !== undefined &&
          candidate.conflictCodes !== null &&
          !declaredConflictCodes.has(item.conflictCode)
        ) {
          errors.push({
            code: "TRACEABILITY_INVALID_CONFLICT_REFERENCE",
            field: `conflicts[${i}].conflictCode`,
            message: `Conflict code '${item.conflictCode}' in conflicts is not present in conflictCodes.`,
          });
        }

        // evidenceIds for this conflict
        if (item.evidenceIds === undefined || item.evidenceIds === null || !Array.isArray(item.evidenceIds)) {
          errors.push({
            code: "TRACEABILITY_INVALID_CONFLICT_STRUCTURE",
            field: `conflicts[${i}].evidenceIds`,
            message: `Field 'evidenceIds' at conflicts[${i}] must be an array.`,
          });
        } else {
          for (let j = 0; j < item.evidenceIds.length; j++) {
            const eid = item.evidenceIds[j];
            if (typeof eid !== "string") {
              errors.push({
                code: "TRACEABILITY_NON_STRING_EVIDENCE_ID",
                field: `conflicts[${i}].evidenceIds[${j}]`,
                message: `Evidence ID at conflicts[${i}].evidenceIds[${j}] must be a string.`,
              });
            } else if (eid.trim().length === 0) {
              errors.push({
                code: "TRACEABILITY_EMPTY_EVIDENCE_ID",
                field: `conflicts[${i}].evidenceIds[${j}]`,
                message: `Evidence ID at conflicts[${i}].evidenceIds[${j}] must not be empty.`,
              });
            } else if (
              candidate.evidenceIds !== undefined &&
              candidate.evidenceIds !== null &&
              !declaredEvidenceIds.has(eid)
            ) {
              errors.push({
                code: "TRACEABILITY_INCONSISTENT_CONFLICT_EVIDENCE",
                field: `conflicts[${i}].evidenceIds[${j}]`,
                message: `Evidence ID '${eid}' associated with conflict '${String(
                  item.conflictCode
                )}' is not present in declared evidenceIds.`,
              });
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
