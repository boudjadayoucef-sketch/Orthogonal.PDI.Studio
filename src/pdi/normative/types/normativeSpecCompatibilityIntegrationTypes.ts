/**
 * PDI NORMATIVE ENGINE — NORMATIVE SPEC ↔ COMPATIBILITY INTEGRATION TYPES
 * Reference: NORM-14-08 (Integration with SPEC-01)
 * 
 * Typed contracts for integrating Piping Specification resolution (SPEC-01)
 * with Multi-compatibility resolution (NORM-14-07).
 * 
 * STRICT COMPLIANCE RULES:
 * 1. Pure integration & orchestration layer: delegates exclusively to NORM-14-07 and consumes SPEC-01.
 * 2. NORM-14-01 remains the sole source of truth for compatibility rules.
 * 3. SPEC-01 remains the sole source of truth for piping spec rules.
 * 4. No new registry, no embedded matrix, no real normative data (no ASME, API, ISO, EN, NPS, DN, Class, PN).
 * 5. Full traceability: matchedRuleIds, evidenceIds, and conflictCodes are deduplicated, sorted, and frozen.
 * 6. Global consolidation priority: INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE.
 */

import type {
  PipingSpecResolutionResult,
} from "./pipingSpecResolverTypes";
import type {
  NormativeMultiCompatibilityQuery,
  NormativeMultiCompatibilityResult,
} from "./normativeMultiCompatibilityTypes";

export type NormativeSpecCompatibilityIntegrationStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeSpecCompatibilityIntegrationQuery {
  readonly specResolution: PipingSpecResolutionResult;
  readonly compatibilityQuery: NormativeMultiCompatibilityQuery;
}

export interface NormativeSpecCompatibilityIntegrationResult {
  readonly status: NormativeSpecCompatibilityIntegrationStatus;
  readonly specResolution: PipingSpecResolutionResult;
  readonly compatibilityResult: NormativeMultiCompatibilityResult;
  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly message: string;
  readonly conflictCodes: readonly string[];
}

export interface INormativeSpecCompatibilityIntegrationEngine {
  resolve(
    query: NormativeSpecCompatibilityIntegrationQuery
  ): NormativeSpecCompatibilityIntegrationResult;
}
