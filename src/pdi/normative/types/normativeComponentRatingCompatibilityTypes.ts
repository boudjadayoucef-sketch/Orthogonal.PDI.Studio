/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ RATING COMPATIBILITY TYPES
 * Reference: NORM-14-04 (Component ↔ Rating / Pressure Rating Compatibility)
 * 
 * Typed adapter contracts for Component ↔ Rating compatibility:
 * Component (PIPE | FITTING | FLANGE | VALVE) ↔ Rating (RATING)
 * Built strictly on top of NORM-14-01 NormativeCompatibilityMatrixEngine.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. No real normative data (no ASME Class, PN, pressure bar/MPa, temperatures).
 * 2. No fuzzy matching, no ranking, no automatic Class ↔ PN conversion.
 * 3. Exact matching and strict directionality (COMPONENT -> RATING).
 * 4. Full traceability: matchedRuleIds and evidenceIds are deduplicated, sorted, and frozen.
 * 5. No second source of truth: delegates directly to INormativeCompatibilityMatrixEngine.
 */

export type NormativeRatingCompatibilityComponentType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE";

export interface NormativeComponentRatingReference {
  readonly componentType: NormativeRatingCompatibilityComponentType;
  readonly componentId: string;
}

export interface NormativeRatingReference {
  readonly ratingId: string;
}

export interface NormativeComponentRatingCompatibilityQuery {
  readonly component: NormativeComponentRatingReference;
  readonly rating: NormativeRatingReference;
}

export type NormativeComponentRatingCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeComponentRatingCompatibilityResult {
  readonly status: NormativeComponentRatingCompatibilityStatus;

  readonly component: NormativeComponentRatingReference;

  readonly rating: NormativeRatingReference;

  readonly matchedRuleIds: readonly string[];

  readonly evidenceIds: readonly string[];

  readonly message: string;

  readonly conflictCode?: string;
}

export interface INormativeComponentRatingCompatibilityEngine {
  resolveCompatibility(
    query: NormativeComponentRatingCompatibilityQuery
  ): NormativeComponentRatingCompatibilityResult;
}
