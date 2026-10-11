/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT COMPATIBILITY TYPES
 * Reference: NORM-14-02 (Component Compatibility Adapter)
 * 
 * Typed adapter contracts for piping component families:
 * PIPE, FITTING, FLANGE, VALVE
 * Built strictly on top of NORM-14-01 NormativeCompatibilityMatrixEngine.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. No real normative data (no ASME, API, ISO, EN, ASTM real values).
 * 2. No fuzzy matching, no ranking, no automatic unit/standard conversion.
 * 3. Exact matching and strict directionality (A -> B does not imply B -> A).
 * 4. Full traceability: matchedRuleIds and evidenceIds are deduplicated, sorted, and frozen.
 */

export type NormativeComponentType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE";

export interface NormativeComponentReference {
  readonly componentType: NormativeComponentType;
  readonly componentId: string;
}

export interface NormativeComponentCompatibilityQuery {
  readonly left: NormativeComponentReference;
  readonly right: NormativeComponentReference;
}

export type NormativeComponentCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeComponentCompatibilityResult {
  readonly status: NormativeComponentCompatibilityStatus;

  readonly left: NormativeComponentReference;
  readonly right: NormativeComponentReference;

  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];

  readonly message?: string;
  readonly conflictCode?: string;
}

export interface INormativeComponentCompatibilityEngine {
  resolveCompatibility(
    query: NormativeComponentCompatibilityQuery
  ): NormativeComponentCompatibilityResult;
}
