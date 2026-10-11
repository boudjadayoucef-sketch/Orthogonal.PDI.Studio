/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT INTEGRATION TYPES
 * Reference: NORM-14-09 (Integration with COMPONENT-01 → COMPONENT-05)
 * 
 * Typed contracts for integrating Component selection/resolution (COMPONENT-01..05)
 * with Piping Specification integration (NORM-14-08) and Multi-compatibility (NORM-14-07).
 * 
 * STRICT ARCHITECTURAL RULES:
 * 1. Pure integration & orchestration layer: delegates exclusively to NORM-14-08 and COMPONENT-01..05.
 * 2. NORM-14-01 remains the sole source of truth for compatibility rules.
 * 3. SPEC-01 remains the sole source of truth for piping spec rules.
 * 4. COMPONENT-01..05 remain the sources of truth for component resolution contracts.
 * 5. No new registry, no embedded matrix, no real normative data (no ASME, API, ISO, EN, NPS, DN, Class, PN).
 * 6. Global consolidation priority: INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE.
 * 7. Full traceability: matchedRuleIds, evidenceIds, and conflictCodes are deduplicated, sorted, and frozen.
 */

import type {
  ComponentSelectionContext,
} from "./componentSelectionTypes";
import type {
  ComponentResolutionResult,
} from "./componentResolutionTypes";
import type {
  PipingSpecResolutionResult,
} from "./pipingSpecResolverTypes";
import type {
  NormativeMultiCompatibilityQuery,
} from "./normativeMultiCompatibilityTypes";
import type {
  NormativeSpecCompatibilityIntegrationResult,
} from "./normativeSpecCompatibilityIntegrationTypes";

export type NormativeComponentIntegrationStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeComponentIntegrationQuery {
  readonly componentContext: ComponentSelectionContext;
  readonly compatibilityQuery: NormativeMultiCompatibilityQuery;
  readonly specResolution: PipingSpecResolutionResult;
}

export interface NormativeComponentIntegrationResult {
  readonly status: NormativeComponentIntegrationStatus;
  readonly componentResolution: ComponentResolutionResult;
  readonly specCompatibilityResult: NormativeSpecCompatibilityIntegrationResult;
  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly conflictCodes: readonly string[];
  readonly message: string;
}

export interface INormativeComponentIntegrationEngine {
  resolve(
    query: NormativeComponentIntegrationQuery
  ): NormativeComponentIntegrationResult;
}
