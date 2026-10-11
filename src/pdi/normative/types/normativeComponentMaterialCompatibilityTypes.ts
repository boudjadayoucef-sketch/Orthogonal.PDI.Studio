/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ MATERIAL COMPATIBILITY TYPES
 * Reference: NORM-14-03 (Component ↔ Material Compatibility)
 * 
 * Typed adapter contracts for Component ↔ Material compatibility:
 * Component (PIPE | FITTING | FLANGE | VALVE) ↔ Material (MATERIAL)
 * Built strictly on top of NORM-14-01 NormativeCompatibilityMatrixEngine.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. No real normative data (no ASME, API, ISO, EN, ASTM real values).
 * 2. No fuzzy matching, no ranking, no automatic material grade/category conversion.
 * 3. Exact matching and strict directionality (COMPONENT -> MATERIAL).
 * 4. Full traceability: matchedRuleIds and evidenceIds are deduplicated, sorted, and frozen.
 * 5. No second source of truth: delegates directly to INormativeCompatibilityMatrixEngine.
 */

export type NormativeMaterialCompatibilityComponentType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE";

export interface NormativeComponentMaterialReference {
  readonly componentType: NormativeMaterialCompatibilityComponentType;
  readonly componentId: string;
}

export interface NormativeMaterialReference {
  readonly materialId: string;
}

export interface NormativeComponentMaterialCompatibilityQuery {
  readonly component: NormativeComponentMaterialReference;
  readonly material: NormativeMaterialReference;
}

export type NormativeComponentMaterialCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeComponentMaterialCompatibilityResult {
  readonly status: NormativeComponentMaterialCompatibilityStatus;

  readonly component: NormativeComponentMaterialReference;

  readonly material: NormativeMaterialReference;

  readonly matchedRuleIds: readonly string[];

  readonly evidenceIds: readonly string[];

  readonly message: string;

  readonly conflictCode?: string;
}

export interface INormativeComponentMaterialCompatibilityEngine {
  resolveCompatibility(
    query: NormativeComponentMaterialCompatibilityQuery
  ): NormativeComponentMaterialCompatibilityResult;
}
