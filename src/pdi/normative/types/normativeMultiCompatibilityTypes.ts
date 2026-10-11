/**
 * PDI NORMATIVE ENGINE — NORMATIVE MULTI-COMPATIBILITY TYPES
 * Reference: NORM-14-07 (Multi-compatibility Resolution)
 * 
 * Typed contracts for orchestrating multiple normative compatibility constraints
 * across adapters: NORM-14-02, NORM-14-03, NORM-14-04, NORM-14-05, NORM-14-06.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. Pure orchestrator: delegates exclusively to existing adapters.
 * 2. No real normative data (no ASME, API, ISO, EN, NPS, DN, Class, PN).
 * 3. No fuzzy matching, no ranking, no conversions, no evidence promotion.
 * 4. Exact matching and strict directionality.
 * 5. Full traceability: matchedRuleIds, evidenceIds, and conflictCodes are deduplicated, sorted, and frozen.
 * 6. Global status priority: INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE.
 */

export type NormativeMultiCompatibilityConstraintType =
  | "COMPONENT"
  | "MATERIAL"
  | "RATING"
  | "DIMENSIONAL_STANDARD"
  | "PRODUCT_STANDARD";

export type NormativeMultiCompatibilityEntityType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE"
  | "MATERIAL"
  | "RATING"
  | "DIMENSIONAL_STANDARD"
  | "PRODUCT_STANDARD";

export interface NormativeMultiCompatibilityReference {
  readonly entityType: NormativeMultiCompatibilityEntityType;
  readonly entityId: string;
}

export interface NormativeMultiCompatibilityConstraint {
  readonly constraintType: NormativeMultiCompatibilityConstraintType;
  readonly left: NormativeMultiCompatibilityReference;
  readonly right: NormativeMultiCompatibilityReference;
}

export interface NormativeMultiCompatibilityQuery {
  readonly constraints: readonly NormativeMultiCompatibilityConstraint[];
}

export type NormativeMultiCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeMultiCompatibilityConstraintResult {
  readonly constraint: NormativeMultiCompatibilityConstraint;
  readonly status: NormativeMultiCompatibilityStatus;
  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly message: string;
  readonly conflictCode?: string;
}

export interface NormativeMultiCompatibilityResult {
  readonly status: NormativeMultiCompatibilityStatus;
  readonly constraintResults: readonly NormativeMultiCompatibilityConstraintResult[];
  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly message: string;
  readonly conflictCodes: readonly string[];
}

export interface INormativeMultiCompatibilityEngine {
  resolveCompatibility(
    query: NormativeMultiCompatibilityQuery
  ): NormativeMultiCompatibilityResult;
}
