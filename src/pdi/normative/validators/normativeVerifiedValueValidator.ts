/**
 * PDI NORMATIVE ENGINE — VERIFIED VALUE VALIDATOR
 * Reference: NORM-10 (Evidence → Verified Value)
 *
 * This module closes the chain:
 *   Evidence → Verified Value
 *
 * A VERIFIED value is accepted only when every referenced evidenceId
 * resolves through the NORM-09 resolver to a structurally valid VERIFIED
 * NormativeEvidence record.
 */

import type {
  NormativeVerifiedValue,
  NormativeVerificationStatus,
} from "../types/normativeEvidenceTypes";
import {
  NormativeEvidenceResolver,
} from "../registry/normativeEvidenceResolver";

export type VerifiedValueValidationErrorCode =
  | "INVALID_RECORD_OBJECT"
  | "MISSING_VALUE"
  | "INVALID_VERIFICATION_STATUS"
  | "INVALID_EVIDENCE_IDS"
  | "VERIFIED_REQUIRES_EVIDENCE"
  | "VERIFIED_EVIDENCE_NOT_FOUND"
  | "VERIFIED_EVIDENCE_UNVERIFIED"
  | "VERIFIED_EVIDENCE_INVALID"
  | "VALUE_VALIDATION_FAILED";

export interface VerifiedValueValidationError {
  readonly code: VerifiedValueValidationErrorCode;
  readonly field?: string;
  readonly evidenceId?: string;
  readonly message: string;
}

export interface VerifiedValueValidationResult {
  readonly valid: boolean;
  readonly verified: boolean;
  readonly errors: readonly VerifiedValueValidationError[];
}

/**
 * Structural + evidence-chain validation.
 *
 * IMPORTANT:
 * - UNVERIFIED values are allowed to remain UNVERIFIED.
 * - VERIFIED values require at least one evidenceId.
 * - Every evidenceId must resolve to FOUND_VERIFIED.
 * - No heuristic/token can promote a value to VERIFIED.
 */
export function validateNormativeVerifiedValue<T>(
  raw: unknown,
  evidenceResolver: NormativeEvidenceResolver,
  valueValidator?: (value: unknown) => boolean,
): VerifiedValueValidationResult {
  const errors: VerifiedValueValidationError[] = [];

  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return {
      valid: false,
      verified: false,
      errors: [
        {
          code: "INVALID_RECORD_OBJECT",
          message: "NormativeVerifiedValue must be a non-null, non-array object.",
        },
      ],
    };
  }

  const record = raw as Record<string, unknown>;

  if (!("value" in record)) {
    errors.push({
      code: "MISSING_VALUE",
      field: "value",
      message: "value is required.",
    });
  }

  const status = record.verificationStatus;
  if (status !== "UNVERIFIED" && status !== "VERIFIED") {
    errors.push({
      code: "INVALID_VERIFICATION_STATUS",
      field: "verificationStatus",
      message: "verificationStatus must be UNVERIFIED or VERIFIED.",
    });
  }

  const evidenceIds = record.evidenceIds;
  if (!Array.isArray(evidenceIds) || evidenceIds.some((id) => typeof id !== "string")) {
    errors.push({
      code: "INVALID_EVIDENCE_IDS",
      field: "evidenceIds",
      message: "evidenceIds must be an array of strings.",
    });
  }

  if (valueValidator && "value" in record && !valueValidator(record.value)) {
    errors.push({
      code: "VALUE_VALIDATION_FAILED",
      field: "value",
      message: "The supplied value failed the provided valueValidator.",
    });
  }

  if (status === "UNVERIFIED") {
    return {
      valid: errors.length === 0,
      verified: false,
      errors: Object.freeze(errors),
    };
  }

  if (status === "VERIFIED") {
    if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      errors.push({
        code: "VERIFIED_REQUIRES_EVIDENCE",
        field: "evidenceIds",
        message: "A VERIFIED value requires at least one evidenceId.",
      });
    } else {
      for (const evidenceId of evidenceIds) {
        const result = evidenceResolver.resolveEvidence(evidenceId);

        if (result.status === "NOT_FOUND") {
          errors.push({
            code: "VERIFIED_EVIDENCE_NOT_FOUND",
            field: "evidenceIds",
            evidenceId,
            message: `Evidence '${evidenceId}' was not found in the NORM-09 registry.`,
          });
        } else if (result.status === "FOUND_UNVERIFIED") {
          errors.push({
            code: "VERIFIED_EVIDENCE_UNVERIFIED",
            field: "evidenceIds",
            evidenceId,
            message: `Evidence '${evidenceId}' is UNVERIFIED and cannot support a VERIFIED value.`,
          });
        } else if (result.status === "INVALID") {
          errors.push({
            code: "VERIFIED_EVIDENCE_INVALID",
            field: "evidenceIds",
            evidenceId,
            message: `Evidence '${evidenceId}' is invalid and cannot support a VERIFIED value.`,
          });
        }
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    verified: valid && status === "VERIFIED",
    errors: Object.freeze(errors),
  };
}

/**
 * Explicit helper for a VERIFIED value.
 * The returned object is the original typed value only when the complete
 * evidence chain is valid; otherwise undefined.
 */
export function resolveVerifiedNormativeValue<T>(
  raw: unknown,
  evidenceResolver: NormativeEvidenceResolver,
  valueValidator?: (value: unknown) => boolean,
): NormativeVerifiedValue<T> | undefined {
  const result = validateNormativeVerifiedValue(
    raw,
    evidenceResolver,
    valueValidator,
  );

  if (!result.valid || !result.verified) {
    return undefined;
  }

  return raw as NormativeVerifiedValue<T>;
}
