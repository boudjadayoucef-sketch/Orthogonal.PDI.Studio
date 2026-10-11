/**
 * PDI NORMATIVE ENGINE — EVIDENCE & QUALIFICATION VALIDATOR
 * Reference: MASTER-02 (Evidence Model Foundation)
 * 
 * Validateur d'intégrité structurelle et de relation Qualification → Evidence.
 * 
 * RÈGLES DE VALIDATION STRICTES (MASTER-02) :
 * 1. Validation structurelle d'une NormativeEvidence :
 *    - evidenceId obligatoire (non vide)
 *    - standardId obligatoire (non vide)
 *    - editionId obligatoire (non vide)
 *    - clauseReference obligatoire (non vide)
 *    - sourceReference obligatoire (non vide)
 *    - sourceType valide ("LICENSED_STANDARD" | "VERIFIED_INTERNAL_REFERENCE" | "MANUFACTURER_DATA" | "LEGACY_REFERENCE")
 *    - verificationStatus valide ("UNVERIFIED" | "VERIFIED")
 *    - Si verificationStatus === "VERIFIED", verifiedBy et verifiedAt sont obligatoires et non vides.
 * 
 * 2. Validation structurelle d'une NormativeEdition :
 *    - id obligatoire (non vide)
 *    - standardId obligatoire (non vide)
 *    - year nombre entier valide (> 1800)
 *    - status valide ("CURRENT" | "SUPERSEDED" | "DRAFT")
 *    - sourceReference obligatoire (non vide)
 *    - verificationStatus valide ("UNVERIFIED" | "VERIFIED")
 * 
 * 3. Validation de Qualification & relation Qualification → Evidence :
 *    - qualificationId, subjectId, ruleId obligatoires (non vide)
 *    - status valide ("UNVERIFIED" | "QUALIFIED" | "DISQUALIFIED")
 *    - evidenceIds tableau de chaînes (non vide pour être QUALIFIED)
 *    - RÈGLE SÉCURITÉ ABSOLUE : Une qualification ne peut JAMAIS être QUALIFIED sans au moins une
 *      Evidence exploitable, valide et dont verificationStatus === "VERIFIED".
 *    - RÈGLE SÉCURITÉ TOKENS : Les identifiants ou chaînes contenant des motifs heuristiques
 *      (ex: MAT_CS_*, _CS_, CS_, CARBON_STEEL_, CRMO, CR_MO, AUSTENITIC) ne constituent JAMAIS
 *      une preuve normative.
 */

import type {
  NormativeEvidence,
  NormativeEvidenceSourceType,
  NormativeVerificationStatus,
  NormativeEdition,
  NormativeEditionStatus,
  NormativeQualification,
  QualificationStatus,
  NormativeVerifiedValue,
} from "../types/normativeEvidenceTypes";
import { isRecordObject } from "./pipeDimensionalValidator";

export type EvidenceValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_EVIDENCE_ID"
  | "EMPTY_EVIDENCE_ID"
  | "MISSING_STANDARD_ID"
  | "EMPTY_STANDARD_ID"
  | "MISSING_EDITION_ID"
  | "EMPTY_EDITION_ID"
  | "MISSING_CLAUSE_REFERENCE"
  | "EMPTY_CLAUSE_REFERENCE"
  | "MISSING_SOURCE_TYPE"
  | "INVALID_SOURCE_TYPE"
  | "MISSING_SOURCE_REFERENCE"
  | "EMPTY_SOURCE_REFERENCE"
  | "MISSING_VERIFICATION_STATUS"
  | "INVALID_VERIFICATION_STATUS"
  | "VERIFIED_EVIDENCE_REQUIRES_VERIFIED_BY"
  | "VERIFIED_EVIDENCE_REQUIRES_VERIFIED_AT"
  | "INVALID_VERIFIED_AT_DATE"
  | "TOKEN_HEURISTIC_DISALLOWED";

export interface EvidenceValidationError {
  readonly code: EvidenceValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface EvidenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly EvidenceValidationError[];
}

export type EditionValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_EDITION_ID"
  | "EMPTY_EDITION_ID"
  | "MISSING_STANDARD_ID"
  | "EMPTY_STANDARD_ID"
  | "INVALID_YEAR"
  | "MISSING_EDITION_STATUS"
  | "INVALID_EDITION_STATUS"
  | "MISSING_SOURCE_REFERENCE"
  | "EMPTY_SOURCE_REFERENCE"
  | "MISSING_VERIFICATION_STATUS"
  | "INVALID_VERIFICATION_STATUS";

export interface EditionValidationError {
  readonly code: EditionValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface EditionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly EditionValidationError[];
}

export type QualificationValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_QUALIFICATION_ID"
  | "EMPTY_QUALIFICATION_ID"
  | "MISSING_SUBJECT_ID"
  | "EMPTY_SUBJECT_ID"
  | "MISSING_RULE_ID"
  | "EMPTY_RULE_ID"
  | "MISSING_STATUS"
  | "INVALID_STATUS"
  | "INVALID_EVIDENCE_IDS"
  | "QUALIFIED_REQUIRES_EVIDENCE_IDS"
  | "QUALIFIED_EVIDENCE_NOT_FOUND"
  | "QUALIFIED_EVIDENCE_UNVERIFIED"
  | "DISALLOWED_TOKEN_HEURISTIC_USED_AS_EVIDENCE";

export interface QualificationValidationError {
  readonly code: QualificationValidationErrorCode;
  readonly field?: string;
  readonly message: string;
}

export interface QualificationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly QualificationValidationError[];
}

const VALID_SOURCE_TYPES: readonly NormativeEvidenceSourceType[] = Object.freeze([
  "LICENSED_STANDARD",
  "VERIFIED_INTERNAL_REFERENCE",
  "MANUFACTURER_DATA",
  "LEGACY_REFERENCE",
]);

const VALID_VERIFICATION_STATUSES: readonly NormativeVerificationStatus[] = Object.freeze([
  "UNVERIFIED",
  "VERIFIED",
]);

const VALID_EDITION_STATUSES: readonly NormativeEditionStatus[] = Object.freeze([
  "CURRENT",
  "SUPERSEDED",
  "DRAFT",
]);

const VALID_QUALIFICATION_STATUSES: readonly QualificationStatus[] = Object.freeze([
  "UNVERIFIED",
  "QUALIFIED",
  "DISQUALIFIED",
]);

/**
 * Liste des tokens heuristiques strictement interdits comme source de preuve normative (MASTER-02 §9).
 */
const FORBIDDEN_TOKEN_PATTERNS: readonly RegExp[] = Object.freeze([
  /^MAT_CS_/i,
  /_CS_/i,
  /^CS_/i,
  /^CARBON_STEEL_/i,
  /^CRMO$/i,
  /^CR_MO$/i,
  /^CRMO_/i,
  /^CR_MO_/i,
  /^AUSTENITIC$/i,
]);

/**
 * Vérifie si un identifiant ou texte correspond à un motif de token heuristique interdit.
 */
export function isDisallowedTokenHeuristic(identifier: string): boolean {
  if (typeof identifier !== "string") return false;
  const trimmed = identifier.trim();
  return FORBIDDEN_TOKEN_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Valide structurellement une instance de NormativeEvidence.
 */
export function validateNormativeEvidence(raw: unknown): EvidenceValidationResult {
  const errors: EvidenceValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Evidence must be a non-null, non-array object.",
        },
      ],
    };
  }

  // evidenceId
  if (raw.evidenceId === undefined || raw.evidenceId === null) {
    errors.push({
      code: "MISSING_EVIDENCE_ID",
      field: "evidenceId",
      message: "evidenceId is required.",
    });
  } else if (typeof raw.evidenceId !== "string" || raw.evidenceId.trim().length === 0) {
    errors.push({
      code: "EMPTY_EVIDENCE_ID",
      field: "evidenceId",
      message: "evidenceId must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.evidenceId)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "evidenceId",
      message: `Token '${raw.evidenceId}' is an identifier/heuristic and cannot be used as a normative evidenceId.`,
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

  // clauseReference
  if (raw.clauseReference === undefined || raw.clauseReference === null) {
    errors.push({
      code: "MISSING_CLAUSE_REFERENCE",
      field: "clauseReference",
      message: "clauseReference is required.",
    });
  } else if (typeof raw.clauseReference !== "string" || raw.clauseReference.trim().length === 0) {
    errors.push({
      code: "EMPTY_CLAUSE_REFERENCE",
      field: "clauseReference",
      message: "clauseReference must be a non-empty string.",
    });
  }

  // sourceType
  if (raw.sourceType === undefined || raw.sourceType === null) {
    errors.push({
      code: "MISSING_SOURCE_TYPE",
      field: "sourceType",
      message: "sourceType is required.",
    });
  } else if (
    typeof raw.sourceType !== "string" ||
    !VALID_SOURCE_TYPES.includes(raw.sourceType as NormativeEvidenceSourceType)
  ) {
    errors.push({
      code: "INVALID_SOURCE_TYPE",
      field: "sourceType",
      message: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}.`,
    });
  }

  // sourceReference
  if (raw.sourceReference === undefined || raw.sourceReference === null) {
    errors.push({
      code: "MISSING_SOURCE_REFERENCE",
      field: "sourceReference",
      message: "sourceReference is required.",
    });
  } else if (typeof raw.sourceReference !== "string" || raw.sourceReference.trim().length === 0) {
    errors.push({
      code: "EMPTY_SOURCE_REFERENCE",
      field: "sourceReference",
      message: "sourceReference must be a non-empty string.",
    });
  } else if (isDisallowedTokenHeuristic(raw.sourceReference)) {
    errors.push({
      code: "TOKEN_HEURISTIC_DISALLOWED",
      field: "sourceReference",
      message: `Token '${raw.sourceReference}' is an informal heuristic and cannot serve as a normative sourceReference.`,
    });
  }

  // verificationStatus
  if (raw.verificationStatus === undefined || raw.verificationStatus === null) {
    errors.push({
      code: "MISSING_VERIFICATION_STATUS",
      field: "verificationStatus",
      message: "verificationStatus is required.",
    });
  } else if (
    typeof raw.verificationStatus !== "string" ||
    !VALID_VERIFICATION_STATUSES.includes(raw.verificationStatus as NormativeVerificationStatus)
  ) {
    errors.push({
      code: "INVALID_VERIFICATION_STATUS",
      field: "verificationStatus",
      message: `verificationStatus must be one of: ${VALID_VERIFICATION_STATUSES.join(", ")}.`,
    });
  } else if (raw.verificationStatus === "VERIFIED") {
    // verifiedBy & verifiedAt obligatoires pour VERIFIED
    if (
      raw.verifiedBy === undefined ||
      raw.verifiedBy === null ||
      typeof raw.verifiedBy !== "string" ||
      raw.verifiedBy.trim().length === 0
    ) {
      errors.push({
        code: "VERIFIED_EVIDENCE_REQUIRES_VERIFIED_BY",
        field: "verifiedBy",
        message: "verifiedBy is required when verificationStatus is 'VERIFIED'.",
      });
    }

    if (
      raw.verifiedAt === undefined ||
      raw.verifiedAt === null ||
      typeof raw.verifiedAt !== "string" ||
      raw.verifiedAt.trim().length === 0
    ) {
      errors.push({
        code: "VERIFIED_EVIDENCE_REQUIRES_VERIFIED_AT",
        field: "verifiedAt",
        message: "verifiedAt is required when verificationStatus is 'VERIFIED'.",
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

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide structurellement une instance de NormativeEdition.
 */
export function validateNormativeEdition(raw: unknown): EditionValidationResult {
  const errors: EditionValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Edition must be a non-null, non-array object.",
        },
      ],
    };
  }

  // id
  if (raw.id === undefined || raw.id === null) {
    errors.push({
      code: "MISSING_EDITION_ID",
      field: "id",
      message: "id is required.",
    });
  } else if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    errors.push({
      code: "EMPTY_EDITION_ID",
      field: "id",
      message: "id must be a non-empty string.",
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

  // year
  if (
    raw.year === undefined ||
    raw.year === null ||
    typeof raw.year !== "number" ||
    !Number.isInteger(raw.year) ||
    raw.year < 1800 ||
    raw.year > 2100
  ) {
    errors.push({
      code: "INVALID_YEAR",
      field: "year",
      message: "year must be an integer year between 1800 and 2100.",
    });
  }

  // status
  if (raw.status === undefined || raw.status === null) {
    errors.push({
      code: "MISSING_EDITION_STATUS",
      field: "status",
      message: "status is required.",
    });
  } else if (
    typeof raw.status !== "string" ||
    !VALID_EDITION_STATUSES.includes(raw.status as NormativeEditionStatus)
  ) {
    errors.push({
      code: "INVALID_EDITION_STATUS",
      field: "status",
      message: `status must be one of: ${VALID_EDITION_STATUSES.join(", ")}.`,
    });
  }

  // sourceReference
  if (raw.sourceReference === undefined || raw.sourceReference === null) {
    errors.push({
      code: "MISSING_SOURCE_REFERENCE",
      field: "sourceReference",
      message: "sourceReference is required.",
    });
  } else if (typeof raw.sourceReference !== "string" || raw.sourceReference.trim().length === 0) {
    errors.push({
      code: "EMPTY_SOURCE_REFERENCE",
      field: "sourceReference",
      message: "sourceReference must be a non-empty string.",
    });
  }

  // verificationStatus
  if (raw.verificationStatus === undefined || raw.verificationStatus === null) {
    errors.push({
      code: "MISSING_VERIFICATION_STATUS",
      field: "verificationStatus",
      message: "verificationStatus is required.",
    });
  } else if (
    typeof raw.verificationStatus !== "string" ||
    !VALID_VERIFICATION_STATUSES.includes(raw.verificationStatus as NormativeVerificationStatus)
  ) {
    errors.push({
      code: "INVALID_VERIFICATION_STATUS",
      field: "verificationStatus",
      message: `verificationStatus must be one of: ${VALID_VERIFICATION_STATUSES.join(", ")}.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide une NormativeQualification en vérifiant ses contraintes structurelles
 * et, de manière optionnelle ou complète, la résolution de ses `evidenceIds`
 * auprès d'un registre ou catalogue d'évidence.
 * 
 * RÈGLE FONDAMENTALE (MASTER-02 §8) :
 * Une qualification avec status === "QUALIFIED" :
 * - DOIT avoir `evidenceIds` non vide.
 * - Ne doit contenir aucun token heuristique (ex: MAT_CS_*, _CS_, etc.) dans ses evidenceIds ou reason.
 * - Si un résolveur d'évidence ou une map est fourni :
 *   TOUTES les évidences référencées doivent exister, être structurellement valides,
 *   et posséder `verificationStatus === "VERIFIED"`.
 *   Si une seule évidence est introuvable ou UNVERIFIED, la qualification NE PEUT PAS être validée comme QUALIFIED.
 */
export function validateNormativeQualification(
  raw: unknown,
  evidenceLookup?: (evidenceId: string) => NormativeEvidence | undefined
): QualificationValidationResult {
  const errors: QualificationValidationError[] = [];

  if (!isRecordObject(raw)) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "Qualification must be a non-null, non-array object.",
        },
      ],
    };
  }

  // qualificationId
  if (raw.qualificationId === undefined || raw.qualificationId === null) {
    errors.push({
      code: "MISSING_QUALIFICATION_ID",
      field: "qualificationId",
      message: "qualificationId is required.",
    });
  } else if (typeof raw.qualificationId !== "string" || raw.qualificationId.trim().length === 0) {
    errors.push({
      code: "EMPTY_QUALIFICATION_ID",
      field: "qualificationId",
      message: "qualificationId must be a non-empty string.",
    });
  }

  // subjectId
  if (raw.subjectId === undefined || raw.subjectId === null) {
    errors.push({
      code: "MISSING_SUBJECT_ID",
      field: "subjectId",
      message: "subjectId is required.",
    });
  } else if (typeof raw.subjectId !== "string" || raw.subjectId.trim().length === 0) {
    errors.push({
      code: "EMPTY_SUBJECT_ID",
      field: "subjectId",
      message: "subjectId must be a non-empty string.",
    });
  }

  // ruleId
  if (raw.ruleId === undefined || raw.ruleId === null) {
    errors.push({
      code: "MISSING_RULE_ID",
      field: "ruleId",
      message: "ruleId is required.",
    });
  } else if (typeof raw.ruleId !== "string" || raw.ruleId.trim().length === 0) {
    errors.push({
      code: "EMPTY_RULE_ID",
      field: "ruleId",
      message: "ruleId must be a non-empty string.",
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
    !VALID_QUALIFICATION_STATUSES.includes(raw.status as QualificationStatus)
  ) {
    errors.push({
      code: "INVALID_STATUS",
      field: "status",
      message: `status must be one of: ${VALID_QUALIFICATION_STATUSES.join(", ")}.`,
    });
  }

  // evidenceIds
  if (!Array.isArray(raw.evidenceIds)) {
    errors.push({
      code: "INVALID_EVIDENCE_IDS",
      field: "evidenceIds",
      message: "evidenceIds must be an array of strings.",
    });
  } else {
    // Vérification de chaque id
    for (const eid of raw.evidenceIds) {
      if (typeof eid !== "string" || eid.trim().length === 0) {
        errors.push({
          code: "INVALID_EVIDENCE_IDS",
          field: "evidenceIds",
          message: "evidenceIds contains empty or non-string elements.",
        });
        break;
      }
      if (isDisallowedTokenHeuristic(eid)) {
        errors.push({
          code: "DISALLOWED_TOKEN_HEURISTIC_USED_AS_EVIDENCE",
          field: "evidenceIds",
          message: `Heuristic token '${eid}' was used in evidenceIds, which is strictly prohibited.`,
        });
      }
    }

    // Si status === "QUALIFIED", evidenceIds ne peut pas être vide
    if (raw.status === "QUALIFIED") {
      if (raw.evidenceIds.length === 0) {
        errors.push({
          code: "QUALIFIED_REQUIRES_EVIDENCE_IDS",
          field: "evidenceIds",
          message: "A qualification cannot have status 'QUALIFIED' without at least one evidenceId.",
        });
      }

      // Si un lookup est fourni, valider chaque preuve
      if (evidenceLookup) {
        for (const eid of raw.evidenceIds) {
          if (typeof eid !== "string") continue;
          const found = evidenceLookup(eid);
          if (!found) {
            errors.push({
              code: "QUALIFIED_EVIDENCE_NOT_FOUND",
              field: "evidenceIds",
              message: `Referenced evidence '${eid}' was not found in evidence repository.`,
            });
            continue;
          }

          const evValidation = validateNormativeEvidence(found);
          if (!evValidation.valid) {
            errors.push({
              code: "QUALIFIED_EVIDENCE_UNVERIFIED",
              field: "evidenceIds",
              message: `Referenced evidence '${eid}' is structurally invalid: ${evValidation.errors.map((e) => e.message).join("; ")}`,
            });
          } else if (found.verificationStatus !== "VERIFIED") {
            errors.push({
              code: "QUALIFIED_EVIDENCE_UNVERIFIED",
              field: "evidenceIds",
              message: `Referenced evidence '${eid}' has verificationStatus '${found.verificationStatus}', which cannot support 'QUALIFIED'.`,
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide une instance de NormativeVerifiedValue<T>.
 */
export function validateNormativeVerifiedValue<T>(
  raw: unknown,
  valueValidator?: (val: unknown) => boolean
): boolean {
  if (!isRecordObject(raw)) return false;
  if (!VALID_VERIFICATION_STATUSES.includes(raw.verificationStatus as NormativeVerificationStatus)) {
    return false;
  }
  if (!Array.isArray(raw.evidenceIds)) return false;
  if (raw.verificationStatus === "VERIFIED" && raw.evidenceIds.length === 0) {
    return false;
  }
  if (valueValidator && !valueValidator(raw.value)) {
    return false;
  }
  return true;
}
