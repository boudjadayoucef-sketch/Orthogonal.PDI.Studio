/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ DIMENSIONAL STANDARD COMPATIBILITY TYPES
 * Reference: NORM-14-05 (Component ↔ Dimensional Standard Compatibility)
 * 
 * Typed adapter contracts for Component ↔ Dimensional Standard compatibility:
 * Component (PIPE | FITTING | FLANGE | VALVE) ↔ Dimensional Standard (DIMENSIONAL_STANDARD)
 * Built strictly on top of NORM-14-01 NormativeCompatibilityMatrixEngine.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. No real normative data (no ASME B16, ASME B36, NPS, DN, Schedules, wall thicknesses).
 * 2. No fuzzy matching, no ranking, no automatic NPS ↔ DN or schedule conversions.
 * 3. Exact matching and strict directionality (COMPONENT -> DIMENSIONAL_STANDARD).
 * 4. Full traceability: matchedRuleIds and evidenceIds are deduplicated, sorted, and frozen.
 * 5. No second source of truth: delegates directly to INormativeCompatibilityMatrixEngine.
 */

export type NormativeDimensionalCompatibilityComponentType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE";

export interface NormativeComponentDimensionalReference {
  readonly componentType: NormativeDimensionalCompatibilityComponentType;
  readonly componentId: string;
}

export interface NormativeDimensionalStandardReference {
  readonly dimensionalStandardId: string;
}

export interface NormativeComponentDimensionalCompatibilityQuery {
  readonly component: NormativeComponentDimensionalReference;
  readonly dimensionalStandard: NormativeDimensionalStandardReference;
}

export type NormativeComponentDimensionalCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeComponentDimensionalCompatibilityResult {
  readonly status: NormativeComponentDimensionalCompatibilityStatus;

  readonly component: NormativeComponentDimensionalReference;

  readonly dimensionalStandard: NormativeDimensionalStandardReference;

  readonly matchedRuleIds: readonly string[];

  readonly evidenceIds: readonly string[];

  readonly message: string;

  readonly conflictCode?: string;
}

export interface INormativeComponentDimensionalCompatibilityEngine {
  resolveCompatibility(
    query: NormativeComponentDimensionalCompatibilityQuery
  ): NormativeComponentDimensionalCompatibilityResult;
}
