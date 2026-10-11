/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY MATRIX TYPES
 * Reference: NORM-13 (Normative Compatibility Matrix)
 * 
 * Définitions de types pour l'infrastructure générique de compatibilité normative.
 * Cette infrastructure permet d'évaluer de manière déterministe si une combinaison
 * de caractéristiques industrielles est COMPATIBLE, INCOMPATIBLE, UNVERIFIED ou INVALID.
 */

export type CompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INVALID";

export interface NormativeCompatibilityContext {
  readonly standardId?: string;
  readonly editionId?: string;

  readonly componentType?: string;
  readonly connectionType?: string;

  readonly nominalSize?: string;
  readonly schedule?: string;
  readonly pressureRating?: string;

  readonly materialId?: string;
  readonly materialForm?: string;

  readonly temperatureC?: number;
  readonly pressureBar?: number;

  readonly designCodeId?: string;
  readonly pipingSpecId?: string;

  readonly evidenceIds?: readonly string[];
}

export interface NormativeCompatibilityRule {
  readonly ruleId: string;

  readonly description: string;

  readonly standardId?: string;
  readonly editionId?: string;

  readonly componentType?: string;
  readonly connectionType?: string;

  readonly nominalSize?: string;
  readonly schedule?: string;
  readonly pressureRating?: string;

  readonly materialId?: string;
  readonly materialForm?: string;

  readonly designCodeId?: string;
  readonly pipingSpecId?: string;

  readonly status: CompatibilityStatus;

  readonly evidenceIds?: readonly string[];

  readonly sourceReference?: string;
}

export interface NormativeCompatibilityResult {
  readonly status: CompatibilityStatus;

  readonly ruleId?: string;

  readonly matchedRuleIds?: readonly string[];

  readonly message?: string;

  readonly matchedRule?: NormativeCompatibilityRule;

  readonly matchedRules?: readonly NormativeCompatibilityRule[];

  readonly evidenceIds?: readonly string[];
}
