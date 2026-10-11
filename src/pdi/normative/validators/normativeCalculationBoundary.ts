import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeVerifiedValue } from "../types/normativeEvidenceTypes";
import { resolveVerifiedNormativeValue } from "./normativeVerifiedValueValidator";

export interface NormativeCalculationBoundaryInput<T> {
  readonly name: string;
  readonly verifiedValue: NormativeVerifiedValue<T>;
}

export interface NormativeCalculationBoundaryResult<T> {
  readonly valid: boolean;
  readonly name: string;
  readonly value?: T;
  readonly verifiedValue?: NormativeVerifiedValue<T>;
  readonly error?: string;
}

export function resolveNormativeCalculationInput<T>(
  input: NormativeCalculationBoundaryInput<T>,
  evidenceResolver: NormativeEvidenceResolver,
): NormativeCalculationBoundaryResult<T> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, name: "", error: "INVALID_BOUNDARY_INPUT" };
  }
  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    return {
      valid: false,
      name: typeof input.name === "string" ? input.name : "",
      error: "INVALID_INPUT_NAME",
    };
  }
  if (!evidenceResolver) {
    return { valid: false, name: input.name, error: "MISSING_EVIDENCE_RESOLVER" };
  }

  const verifiedValue = resolveVerifiedNormativeValue<T>(
    input.verifiedValue,
    evidenceResolver,
  );

  if (!verifiedValue) {
    return {
      valid: false,
      name: input.name,
      error: "VERIFIED_VALUE_EVIDENCE_CHAIN_NOT_VERIFIED",
    };
  }

  return {
    valid: true,
    name: input.name,
    value: verifiedValue.value,
    verifiedValue,
  };
}

export function requireVerifiedNormativeCalculationInput<T>(
  input: NormativeCalculationBoundaryInput<T>,
  evidenceResolver: NormativeEvidenceResolver,
): T {
  const result = resolveNormativeCalculationInput(input, evidenceResolver);
  if (!result.valid || result.value === undefined) {
    throw new Error(
      `Normative calculation input rejected: ${result.name || "unknown"}: ${
        result.error || "INVALID"
      }`,
    );
  }
  return result.value;
}

export function resolvePressureDesignStress(
  input: NormativeCalculationBoundaryInput<number>,
  evidenceResolver: NormativeEvidenceResolver,
) {
  return resolveNormativeCalculationInput(input, evidenceResolver);
}

export function resolveWeldQualityFactor(
  input: NormativeCalculationBoundaryInput<number>,
  evidenceResolver: NormativeEvidenceResolver,
) {
  return resolveNormativeCalculationInput(input, evidenceResolver);
}

export function resolveWeldReductionFactor(
  input: NormativeCalculationBoundaryInput<number>,
  evidenceResolver: NormativeEvidenceResolver,
) {
  return resolveNormativeCalculationInput(input, evidenceResolver);
}

export function resolveYCoefficient(
  input: NormativeCalculationBoundaryInput<number>,
  evidenceResolver: NormativeEvidenceResolver,
) {
  return resolveNormativeCalculationInput(input, evidenceResolver);
}
