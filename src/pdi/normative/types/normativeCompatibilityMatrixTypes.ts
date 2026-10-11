/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY MATRIX TYPES
 * Reference: NORM-14-01 (Compatibility Matrix Foundation)
 * 
 * Generic, deterministic foundation for normative compatibility between industrial components.
 * Target architecture:
 * SourceDocument → Evidence → Qualification → VerifiedValue → Compatibility Rule → Piping Specification → Component Resolution
 * 
 * STRICT COMPLIANCE RULES:
 * 1. No real normative data (no ASME, API, ISO, EN, ASTM real tables/dimensions/ratings).
 * 2. No fuzzy matching, no partial matching, no ranking, no automatic conversion.
 * 3. Exact matching on (leftEntityType, leftEntityId, rightEntityType, rightEntityId).
 * 4. Explicit directional handling (A -> B does not imply B -> A).
 * 5. Full auditability and traceability: matchedRuleIds and evidenceIds are deduplicated, sorted, and frozen.
 */

export type NormativeCompatibilityEntityType =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE"
  | "MATERIAL"
  | "RATING"
  | "DIMENSIONAL_STANDARD"
  | "PRODUCT_STANDARD";

export type NormativeCompatibilityMatrixRuleStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED";

export type NormativeCompatibilityMatrixResolutionStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeCompatibilityMatrixRule {
  readonly ruleId: string;

  readonly leftEntityType: NormativeCompatibilityEntityType;
  readonly leftEntityId: string;

  readonly rightEntityType: NormativeCompatibilityEntityType;
  readonly rightEntityId: string;

  readonly status: NormativeCompatibilityMatrixRuleStatus;

  readonly evidenceIds?: readonly string[];

  readonly sourceReference?: string;

  readonly notes?: string;
}

export interface NormativeCompatibilityMatrixResult {
  readonly status: NormativeCompatibilityMatrixResolutionStatus;

  readonly leftEntityType: NormativeCompatibilityEntityType;
  readonly leftEntityId: string;

  readonly rightEntityType: NormativeCompatibilityEntityType;
  readonly rightEntityId: string;

  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];

  readonly message?: string;
  readonly conflictCode?: string;

  readonly matchedRule?: NormativeCompatibilityMatrixRule;
  readonly matchedRules?: readonly NormativeCompatibilityMatrixRule[];
}
