/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ PRODUCT STANDARD COMPATIBILITY TYPES
 * Reference: NORM-14-06 (Component ↔ Product Standard Compatibility)
 * 
 * Typed adapter contracts for Component ↔ Product Standard compatibility:
 * Component (PIPE | FITTING | FLANGE | VALVE) ↔ Product Standard (PRODUCT_STANDARD)
 * Built strictly on top of NORM-14-01 NormativeCompatibilityMatrixEngine.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. No real normative data (no ASME B16, ASME B36, API, ISO, EN, NPS, DN, Class, PN).
 * 2. No fuzzy matching, no ranking, no automatic conversions.
 * 3. Exact matching and strict directionality (COMPONENT -> PRODUCT_STANDARD).
 * 4. Full traceability: matchedRuleIds and evidenceIds are deduplicated, sorted, and frozen.
 * 5. No second source of truth: delegates directly to INormativeCompatibilityMatrixEngine.
 */

export type NormativeProductCompatibilityComponentType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE";

export interface NormativeComponentProductReference {
  readonly componentType: NormativeProductCompatibilityComponentType;
  readonly componentId: string;
}

export interface NormativeProductStandardReference {
  readonly productStandardId: string;
}

export interface NormativeComponentProductCompatibilityQuery {
  readonly component: NormativeComponentProductReference;
  readonly productStandard: NormativeProductStandardReference;
}

export type NormativeComponentProductCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeComponentProductCompatibilityResult {
  readonly status: NormativeComponentProductCompatibilityStatus;

  readonly component: NormativeComponentProductReference;

  readonly productStandard: NormativeProductStandardReference;

  readonly matchedRuleIds: readonly string[];

  readonly evidenceIds: readonly string[];

  readonly message: string;

  readonly conflictCode?: string;
}

export interface INormativeComponentProductCompatibilityEngine {
  resolveCompatibility(
    query: NormativeComponentProductCompatibilityQuery
  ): NormativeComponentProductCompatibilityResult;
}
