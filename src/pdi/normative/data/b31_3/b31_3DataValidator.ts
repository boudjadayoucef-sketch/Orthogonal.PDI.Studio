/**
 * PDI NORMATIVE ENGINE — ASME B31.3 DATA VALIDATOR
 * Reference: B31.3-02 (Controlled Normative Data Ingestion)
 * 
 * Validateur d'intégrité structurelle et de gouvernance de la chaîne de traçabilité
 * pour les données normatives ASME B31.3.
 * 
 * RÈGLES DE VALIDATION STRICTES (B31.3-02) :
 * 1. Validation structurelle :
 *    - dataId obligatoire, non vide, sans token heuristique.
 *    - standardId obligatoire, non vide.
 *    - editionId obligatoire, non vide.
 *    - sourceDocumentId obligatoire, non vide, sans token heuristique.
 *    - evidenceId obligatoire, non vide, sans token heuristique.
 *    - clauseReference obligatoire, non vide.
 *    - dataType obligatoire, non vide.
 *    - value obligatoire (non undefined).
 *    - status valide ("UNVERIFIED" | "VERIFIED").
 * 2. Validation de la chaîne de traçabilité documentaire (Gouvernance) :
 *    - Un record avec status "VERIFIED" ne peut être valide que si :
 *        a) sourceDocumentId résout vers un document avec status "FOUND_VERIFIED".
 *        b) evidenceId résout vers une évidence avec status "FOUND_VERIFIED".
 *        c) L'évidence référence de façon cohérente le document source (si spécifié).
 *    - Toute rupture de la chaîne documentaire interdit le statut "VERIFIED".
 */

import type {
  B31_3NormativeDataRecord,
  B31_3DataStatus,
} from "../../types/b31_3DataTypes";
import type { INormativeSourceDocumentResolver } from "../../registry/normativeSourceDocumentResolver";
import type { INormativeEvidenceResolver } from "../../registry/normativeEvidenceResolver";
import { isRecordObject } from "../../validators/pipeDimensionalValidator";
import { isDisallowedTokenHeuristic } from "../../validators/normativeEvidenceValidator";

export type B31_3DataValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_DATA_ID"
  | "EMPTY_DATA_ID"
  | "TOKEN_HEURISTIC_DISALLOWED"
  | "MISSING_STANDARD_ID"
  | "EMPTY_STANDARD_ID"
  | "MISSING_EDITION_ID"
  | "EMPTY_EDITION_ID"
  | "MISSING_SOURCE_DOCUMENT_ID"
  | "EMPTY_SOURCE_DOCUMENT_ID"
  | "MISSING_EVIDENCE_ID"
  | "EMPTY_EVIDENCE_ID"
  | "MISSING_CLAUSE_REFERENCE"
  | "EMPTY_CLAUSE_REFERENCE"
  | "MISSING_DATA_TYPE"
  | "EMPTY_DATA_TYPE"
  | "MISSING_VALUE"
  | "MISSING_STATUS"
  | "INVALID_STATUS"
  | "INVALID_UNIT"
  | "INVALID_NOTES"
  | "VERIFIED_RECORD_SOURCE_DOCUMENT_NOT_FOUND"
  | "VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED"
  | "VERIFIED_RECORD_SOURCE_DOCUMENT_STANDARD_MISMATCH"
  | "VERIFIED_RECORD_SOURCE_DOCUMENT_EDITION_MISMATCH"
  | "VERIFIED_RECORD_EVIDENCE_NOT_FOUND"
  | "VERIFIED_RECORD_EVIDENCE_UNVERIFIED"
  | "VERIFIED_RECORD_STANDARD_MISMATCH"
  | "VERIFIED_RECORD_EDITION_MISMATCH"
  | "VERIFIED_RECORD_EVIDENCE_DOCUMENT_MISMATCH";

export interface B31_3DataValidationError {
  readonly code: B31_3DataValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface B31_3DataValidationResult {
  readonly valid: boolean;
  readonly errors: readonly B31_3DataValidationError[];
}

const VALID_STATUSES: readonly B31_3DataStatus[] = Object.freeze([
  "UNVERIFIED",
  "VERIFIED",
]);

/**
 * Valide structurellement un enregistrement B31_3NormativeDataRecord.
 */
export function validateB31_3DataRecordStructure(
  raw: unknown
): B31_3DataValidationResult {
  const errors: B31_3DataValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Data record must be a non-null, non-array object.",
        },
      ],
    };
  }

  // dataId
  if (raw.dataId === undefined || raw.dataId === null) {
    errors.push({
      code: "MISSING_DATA_ID",
      field: "dataId",
      message: "dataId is required.",
    });
  } else if (typeof raw.dataId !== "string" || raw.dataId.trim().length === 0) {
    errors.push({
      code: "EMPTY_DATA_ID",
      field: "dataId",
      message: "dataId must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.dataId)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "dataId",
      message: `Token '${raw.dataId}' is an identifier/heuristic and cannot be used as a dataId.`,
    });
  }

  // standardId
  if (raw.standardId === undefined || raw.standardId === null) {
    errors.push({
      code: "MISSING_STANDARD_ID",
      field: "standardId",
      message: "standardId is required.",
    });
  } else if (typeof raw.standardId !== "string" || raw.standardId.trim().length === 0) {
    errors.push({
      code: "EMPTY_STANDARD_ID",
      field: "standardId",
      message: "standardId must be a non-empty string.",
    });
  }

  // editionId
  if (raw.editionId === undefined || raw.editionId === null) {
    errors.push({
      code: "MISSING_EDITION_ID",
      field: "editionId",
      message: "editionId is required.",
    });
  } else if (typeof raw.editionId !== "string" || raw.editionId.trim().length === 0) {
    errors.push({
      code: "EMPTY_EDITION_ID",
      field: "editionId",
      message: "editionId must be a non-empty string.",
    });
  }

  // sourceDocumentId
  if (raw.sourceDocumentId === undefined || raw.sourceDocumentId === null) {
    errors.push({
      code: "MISSING_SOURCE_DOCUMENT_ID",
      field: "sourceDocumentId",
      message: "sourceDocumentId is required.",
    });
  } else if (
    typeof raw.sourceDocumentId !== "string" ||
    raw.sourceDocumentId.trim().length === 0
  ) {
    errors.push({
      code: "EMPTY_SOURCE_DOCUMENT_ID",
      field: "sourceDocumentId",
      message: "sourceDocumentId must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.sourceDocumentId)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "sourceDocumentId",
      message: `Token '${raw.sourceDocumentId}' is an identifier/heuristic and cannot be used as a sourceDocumentId.`,
    });
  }

  // evidenceId
  if (raw.evidenceId === undefined || raw.evidenceId === null) {
    errors.push({
      code: "MISSING_EVIDENCE_ID",
      field: "evidenceId",
      message: "evidenceId is required.",
    });
  } else if (
    typeof raw.evidenceId !== "string" ||
    raw.evidenceId.trim().length === 0
  ) {
    errors.push({
      code: "EMPTY_EVIDENCE_ID",
      field: "evidenceId",
      message: "evidenceId must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.evidenceId)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "evidenceId",
      message: `Token '${raw.evidenceId}' is an identifier/heuristic and cannot be used as an evidenceId.`,
    });
  }

  // clauseReference
  if (raw.clauseReference === undefined || raw.clauseReference === null) {
    errors.push({
      code: "MISSING_CLAUSE_REFERENCE",
      field: "clauseReference",
      message: "clauseReference is required.",
    });
  } else if (
    typeof raw.clauseReference !== "string" ||
    raw.clauseReference.trim().length === 0
  ) {
    errors.push({
      code: "EMPTY_CLAUSE_REFERENCE",
      field: "clauseReference",
      message: "clauseReference must be a non-empty string.",
    });
  }

  // dataType
  if (raw.dataType === undefined || raw.dataType === null) {
    errors.push({
      code: "MISSING_DATA_TYPE",
      field: "dataType",
      message: "dataType is required.",
    });
  } else if (typeof raw.dataType !== "string" || raw.dataType.trim().length === 0) {
    errors.push({
      code: "EMPTY_DATA_TYPE",
      field: "dataType",
      message: "dataType must be a non-empty string.",
    });
  }

  // value
  if (raw.value === undefined) {
    errors.push({
      code: "MISSING_VALUE",
      field: "value",
      message: "value is required and cannot be undefined.",
    });
  }

  // status
  if (raw.status === undefined || raw.status === null) {
    errors.push({
      code: "MISSING_STATUS",
      field: "status",
      message: "status is required.",
    });
  } else if (
    typeof raw.status !== "string" ||
    !VALID_STATUSES.includes(raw.status as B31_3DataStatus)
  ) {
    errors.push({
      code: "INVALID_STATUS",
      field: "status",
      message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
    });
  }

  // unit (optionnel)
  if (raw.unit !== undefined && typeof raw.unit !== "string") {
    errors.push({
      code: "INVALID_UNIT",
      field: "unit",
      message: "unit must be a string if defined.",
    });
  }

  // notes (optionnel)
  if (raw.notes !== undefined && typeof raw.notes !== "string") {
    errors.push({
      code: "INVALID_NOTES",
      field: "notes",
      message: "notes must be a string if defined.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide la gouvernance et la chaîne de traçabilité complète d'un record B31.3.
 * Si le record est "VERIFIED", vérifie que le document source et l'évidence sont tous deux FOUND_VERIFIED.
 */
export function validateB31_3DataRecordGovernance(
  record: B31_3NormativeDataRecord<unknown>,
  sourceDocResolver: INormativeSourceDocumentResolver,
  evidenceResolver: INormativeEvidenceResolver
): B31_3DataValidationResult {
  const structRes = validateB31_3DataRecordStructure(record);
  if (!structRes.valid) {
    return structRes;
  }

  const errors: B31_3DataValidationError[] = [];

  if (record.status === "VERIFIED") {
    // 1. Vérifier le document source
    const docRes = sourceDocResolver.resolveDocument(record.sourceDocumentId);
    if (docRes.status === "NOT_FOUND") {
      errors.push({
        code: "VERIFIED_RECORD_SOURCE_DOCUMENT_NOT_FOUND",
        field: "sourceDocumentId",
        message: `VERIFIED record '${record.dataId}' requires source document '${record.sourceDocumentId}', but it was not found in registry.`,
      });
    } else if (docRes.status !== "FOUND_VERIFIED") {
      errors.push({
        code: "VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED",
        field: "sourceDocumentId",
        message: `VERIFIED record '${record.dataId}' references source document '${record.sourceDocumentId}' which is not VERIFIED (status: ${docRes.status}).`,
      });
    } else if (docRes.document) {
      if (docRes.document.standardId !== record.standardId) {
        errors.push({
          code: "VERIFIED_RECORD_SOURCE_DOCUMENT_STANDARD_MISMATCH",
          field: "standardId",
          message: `Record standardId '${record.standardId}' does not match source document standardId '${docRes.document.standardId}'.`,
        });
      }

      if (docRes.document.editionId !== record.editionId) {
        errors.push({
          code: "VERIFIED_RECORD_SOURCE_DOCUMENT_EDITION_MISMATCH",
          field: "editionId",
          message: `Record editionId '${record.editionId}' does not match source document editionId '${docRes.document.editionId}'.`,
        });
      }
    }

    // 2. Vérifier l'évidence
    const evRes = evidenceResolver.resolveEvidence(record.evidenceId);
    if (evRes.status === "NOT_FOUND") {
      errors.push({
        code: "VERIFIED_RECORD_EVIDENCE_NOT_FOUND",
        field: "evidenceId",
        message: `VERIFIED record '${record.dataId}' requires evidence '${record.evidenceId}', but it was not found in registry.`,
      });
    } else if (evRes.status !== "FOUND_VERIFIED") {
      errors.push({
        code: "VERIFIED_RECORD_EVIDENCE_UNVERIFIED",
        field: "evidenceId",
        message: `VERIFIED record '${record.dataId}' references evidence '${record.evidenceId}' which is not VERIFIED (status: ${evRes.status}).`,
      });
    } else if (evRes.evidence) {
      // 3. Contrôle de cohérence standardId & editionId (Section 9)
      if (evRes.evidence.standardId !== record.standardId) {
        errors.push({
          code: "VERIFIED_RECORD_STANDARD_MISMATCH",
          field: "standardId",
          message: `Record standardId '${record.standardId}' does not match evidence standardId '${evRes.evidence.standardId}'.`,
        });
      }

      if (evRes.evidence.editionId !== record.editionId) {
        errors.push({
          code: "VERIFIED_RECORD_EDITION_MISMATCH",
          field: "editionId",
          message: `Record editionId '${record.editionId}' does not match evidence editionId '${evRes.evidence.editionId}'.`,
        });
      }

      if (
        evRes.evidence.sourceDocumentId !== undefined &&
        evRes.evidence.sourceDocumentId !== record.sourceDocumentId
      ) {
        errors.push({
          code: "VERIFIED_RECORD_EVIDENCE_DOCUMENT_MISMATCH",
          field: "sourceDocumentId",
          message: `Evidence '${record.evidenceId}' is bound to sourceDocumentId '${evRes.evidence.sourceDocumentId}' which differs from record sourceDocumentId '${record.sourceDocumentId}'.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
