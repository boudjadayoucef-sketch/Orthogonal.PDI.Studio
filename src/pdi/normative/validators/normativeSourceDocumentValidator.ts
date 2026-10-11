/**
 * PDI NORMATIVE ENGINE — NORMATIVE SOURCE DOCUMENT VALIDATOR
 * Reference: B31.3-01 (ASME B31.3 Normative Data Foundation)
 * 
 * Validateur d'intégrité structurelle des documents sources normatifs (NormativeSourceDocument).
 * 
 * RÈGLES DE VALIDATION STRICTES (B31.3-01) :
 * 1. documentId obligatoire (non vide)
 * 2. title obligatoire (non vide)
 * 3. standardId obligatoire (non vide)
 * 4. editionId obligatoire (non vide)
 * 5. documentReference obligatoire (non vide)
 * 6. status valide ("UNVERIFIED" | "VERIFIED")
 * 7. Si status === "VERIFIED", verifiedBy et verifiedAt sont obligatoires et non vides.
 * 8. verifiedAt doit être une date valide.
 * 9. Les tokens heuristiques (MAT_CS_*, _CS_, etc.) sont formellement rejetés.
 */

import type {
  NormativeSourceDocument,
  NormativeSourceDocumentStatus,
} from "../types/normativeSourceDocumentTypes";
import { isRecordObject } from "./pipeDimensionalValidator";
import { isDisallowedTokenHeuristic } from "./normativeEvidenceValidator";

export type SourceDocumentValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_DOCUMENT_ID"
  | "EMPTY_DOCUMENT_ID"
  | "TOKEN_HEURISTIC_DISALLOWED"
  | "MISSING_TITLE"
  | "EMPTY_TITLE"
  | "MISSING_STANDARD_ID"
  | "EMPTY_STANDARD_ID"
  | "MISSING_EDITION_ID"
  | "EMPTY_EDITION_ID"
  | "MISSING_DOCUMENT_REFERENCE"
  | "EMPTY_DOCUMENT_REFERENCE"
  | "MISSING_STATUS"
  | "INVALID_STATUS"
  | "VERIFIED_DOCUMENT_REQUIRES_VERIFIED_BY"
  | "VERIFIED_DOCUMENT_REQUIRES_VERIFIED_AT"
  | "INVALID_VERIFIED_AT_DATE"
  | "INVALID_PUBLISHER"
  | "INVALID_CHECKSUM"
  | "INVALID_NOTES";

export interface SourceDocumentValidationError {
  readonly code: SourceDocumentValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface SourceDocumentValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SourceDocumentValidationError[];
}

const VALID_STATUSES: readonly NormativeSourceDocumentStatus[] = Object.freeze([
  "UNVERIFIED",
  "VERIFIED",
]);

/**
 * Valide structurellement une instance de NormativeSourceDocument.
 */
export function validateNormativeSourceDocument(raw: unknown): SourceDocumentValidationResult {
  const errors: SourceDocumentValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Source document must be a non-null, non-array object.",
        },
      ],
    };
  }

  // documentId
  if (raw.documentId === undefined || raw.documentId === null) {
    errors.push({
      code: "MISSING_DOCUMENT_ID",
      field: "documentId",
      message: "documentId is required.",
    });
  } else if (typeof raw.documentId !== "string" || raw.documentId.trim().length === 0) {
    errors.push({
      code: "EMPTY_DOCUMENT_ID",
      field: "documentId",
      message: "documentId must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.documentId)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "documentId",
      message: `Token '${raw.documentId}' is an identifier/heuristic and cannot be used as a documentId.`,
    });
  }

  // title
  if (raw.title === undefined || raw.title === null) {
    errors.push({
      code: "MISSING_TITLE",
      field: "title",
      message: "title is required.",
    });
  } else if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
    errors.push({
      code: "EMPTY_TITLE",
      field: "title",
      message: "title must be a non-empty string.",
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

  // documentReference
  if (raw.documentReference === undefined || raw.documentReference === null) {
    errors.push({
      code: "MISSING_DOCUMENT_REFERENCE",
      field: "documentReference",
      message: "documentReference is required.",
    });
  } else if (typeof raw.documentReference !== "string" || raw.documentReference.trim().length === 0) {
    errors.push({
      code: "EMPTY_DOCUMENT_REFERENCE",
      field: "documentReference",
      message: "documentReference must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.documentReference)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "documentReference",
      message: `Token '${raw.documentReference}' is an informal heuristic and cannot serve as a documentReference.`,
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
    !VALID_STATUSES.includes(raw.status as NormativeSourceDocumentStatus)
  ) {
    errors.push({
      code: "INVALID_STATUS",
      field: "status",
      message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
    });
  } else if (raw.status === "VERIFIED") {
    // verifiedBy & verifiedAt obligatoires pour VERIFIED
    if (
      raw.verifiedBy === undefined ||
      raw.verifiedBy === null ||
      typeof raw.verifiedBy !== "string" ||
      raw.verifiedBy.trim().length === 0
    ) {
      errors.push({
        code: "VERIFIED_DOCUMENT_REQUIRES_VERIFIED_BY",
        field: "verifiedBy",
        message: "verifiedBy is required when status is 'VERIFIED'.",
      });
    }

    if (
      raw.verifiedAt === undefined ||
      raw.verifiedAt === null ||
      typeof raw.verifiedAt !== "string" ||
      raw.verifiedAt.trim().length === 0
    ) {
      errors.push({
        code: "VERIFIED_DOCUMENT_REQUIRES_VERIFIED_AT",
        field: "verifiedAt",
        message: "verifiedAt is required when status is 'VERIFIED'.",
      });
    } else {
      const parsedTime = Date.parse(raw.verifiedAt);
      if (Number.isNaN(parsedTime)) {
        errors.push({
          code: "INVALID_VERIFIED_AT_DATE",
          field: "verifiedAt",
          message: "verifiedAt must be a valid date string (e.g. ISO 8601).",
        });
      }
    }
  }

  // publisher (optionnel)
  if (raw.publisher !== undefined && typeof raw.publisher !== "string") {
    errors.push({
      code: "INVALID_PUBLISHER",
      field: "publisher",
      message: "publisher must be a string if defined.",
    });
  }

  // checksum (optionnel)
  if (raw.checksum !== undefined && typeof raw.checksum !== "string") {
    errors.push({
      code: "INVALID_CHECKSUM",
      field: "checksum",
      message: "checksum must be a string if defined.",
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
