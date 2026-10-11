/**
 * PDI NORMATIVE ENGINE — ISOMETRIC NORMATIVE BRIDGE CONTRACTS
 * Reference: ARCH-01 (Architectural Unification & Normative Bridge)
 *
 * Explicit boundary contracts between the Isometric Editor domain
 * (IsoNode / IsoSegment / IsoFitting / IsoPipingSupport / PdiUniversalEntity)
 * and the Normative Engine (SPEC-01, NORM-09, NORM-13, NORM-14).
 *
 * STRICT ARCHITECTURAL RULES (ARCH-01):
 * 1. Separation of concerns:
 *    - Editor State owns geometry, coordinates, rendering, and visual selection.
 *    - Normative Engine owns admissibility, specification resolution, compatibility,
 *      evidence verification, and traceability.
 * 2. Structured component types: reuses ComponentType ("PIPE" | "FITTING" | "FLANGE" | "VALVE")
 *    extended with "SUPPORT" for support entities.
 * 3. Official normative statuses only: "COMPATIBLE" | "INCOMPATIBLE" | "UNVERIFIED" | "INVALID".
 * 4. Full provenance traceability: EDITOR ENTITY -> RULE -> VERIFIED VALUE -> EVIDENCE -> SPEC / STANDARD / EDITION.
 * 5. Note on projection duplication (ARCH-00 / ARCH-01 Section 18):
 *    DUPLICATED PROJECTION LOGIC between `src/pdi/isometric/isoProjection.ts` and
 *    internal `isoProjectV4` / `isoUnprojectV4` in `IsometrieModuleV48d.tsx` is
 *    intentionally preserved untouched in ARCH-01 for a dedicated future cleanup phase.
 */

import type { ComponentType } from "../types/componentSelectionTypes";
import type { CompatibilityStatus } from "../types/normativeCompatibilityTypes";
import type { NormativeEvidence, NormativeVerifiedValue } from "../types/normativeEvidenceTypes";
import type { NormativeMultiCompatibilityQuery } from "../types/normativeMultiCompatibilityTypes";
import type { NormativeTraceabilityResult } from "../types/normativeEvidenceTraceabilityTypes";

/**
 * Structured component type used across the Isometric <-> Normative boundary.
 * Reuses the canonical `ComponentType` from COMPONENT-01 and adds `"SUPPORT"`.
 */
export type IsometricNormativeComponentType = ComponentType | "SUPPORT";

/**
 * Official normative decision status (reuses canonical CompatibilityStatus).
 */
export type IsometricNormativeStatus = CompatibilityStatus;

/**
 * Minimal, pure normative context extracted from an Isometric Editor entity.
 * Contains ONLY the fields required for normative evaluation (no geometry/UI state).
 */
export interface IsometricNormativeContext {
  readonly entityId: string;
  readonly componentType?: IsometricNormativeComponentType;
  readonly nominalSize?: string;
  readonly dimensionalStandard?: string;
  readonly productStandard?: string;
  readonly schedule?: string;
  readonly pressureRating?: string;
  readonly ratingSystem?: string;
  readonly materialId?: string;
  readonly connectionType?: string;
  readonly fittingType?: string;
  readonly valveType?: string;
  readonly pipingSpecId?: string;
  readonly designCodeId?: string;
  readonly evidenceIds?: readonly string[];
}

/**
 * Traceability link for a single resolved normative evidence item.
 * Connects RULE -> VERIFIED VALUE -> EVIDENCE -> STANDARD / EDITION / CLAUSE.
 */
export interface IsometricNormativeEvidenceTraceItem {
  readonly evidenceId: string;
  readonly standardId: string;
  readonly editionId: string;
  readonly clauseReference: string;
  readonly sourceType: string;
  readonly sourceReference: string;
  readonly verificationStatus: "VERIFIED" | "UNVERIFIED";
  readonly verifiedValues: readonly NormativeVerifiedValue<unknown>[];
}

/**
 * Complete audit trail for a normative decision on an editor entity.
 * Never fabricates trace entries if underlying evidence or rules do not exist.
 */
export interface IsometricNormativeTraceability {
  readonly entityId: string;
  readonly pipingSpecId?: string;
  readonly designCodeId?: string;
  readonly specRuleIds: readonly string[];
  readonly compatibilityRuleIds: readonly string[];
  readonly matchedRuleIds: readonly string[];
  readonly verifiedValues: readonly NormativeVerifiedValue<unknown>[];
  readonly evidenceIds: readonly string[];
  readonly evidenceChain: readonly IsometricNormativeEvidenceTraceItem[];
  readonly conflictCodes: readonly string[];
  readonly traceabilityLock: NormativeTraceabilityResult;
}

/**
 * Diagnostic snapshot comparing Legacy PMS (`pdiClassePression017K3`) with the
 * authoritative Normative Engine decision.
 * Legacy PMS is never allowed to act as an independent normative source of truth
 * or silently override the Normative Engine.
 */
export interface LegacyPmsComparisonSnapshot {
  readonly evaluated: boolean;
  readonly legacyExpectedPressureClass?: string;
  readonly legacyExpectedMaterial?: string;
  readonly legacyClassConformant?: boolean;
  readonly hasConflict: boolean;
  readonly conflictCode?: string;
  readonly message?: string;
}

/**
 * Output decision returned by the Isometric Normative Bridge for consumption by the Editor.
 */
export interface IsometricNormativeDecision {
  readonly entityId: string;
  readonly status: IsometricNormativeStatus;
  readonly ruleIds: readonly string[];
  readonly specRuleIds: readonly string[];
  readonly compatibilityRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly conflictCodes: readonly string[];
  readonly traceability: IsometricNormativeTraceability;
  readonly legacyPmsComparison?: LegacyPmsComparisonSnapshot;
  readonly message: string;
}

/**
 * Optional evaluation parameters passed when checking an editor entity or context.
 */
export interface IsometricNormativeEvaluationOptions {
  /** Optional multi-compatibility query (NORM-14-07 / NORM-14-08) */
  readonly multiCompatibilityQuery?: NormativeMultiCompatibilityQuery;
  /** Optional verified values to link into the traceability chain */
  readonly verifiedValues?: readonly NormativeVerifiedValue<unknown>[];
  /** Optional legacy project setup to detect any Legacy PMS vs Normative conflict */
  readonly legacyProjectSetup?: {
    readonly specs?: ReadonlyArray<{
      readonly code: string;
      readonly material: string;
      readonly pressureClass: string;
      readonly minDn?: number;
      readonly maxDn?: number;
    }>;
  };
}

/**
 * Public interface for the Isometric Normative Bridge.
 */
export interface IIsometricNormativeBridge {
  evaluateContext(
    context: IsometricNormativeContext,
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision;
}

/**
 * Helper to retrieve verified evidence objects for a list of evidence IDs.
 */
export type EvidenceRecordLookup = (evidenceId: string) => NormativeEvidence | undefined;
