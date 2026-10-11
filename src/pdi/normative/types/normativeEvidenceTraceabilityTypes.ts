/**
 * PDI NORMATIVE ENGINE — NORMATIVE EVIDENCE TRACEABILITY TYPES
 * Reference: NORM-14-10 (Evidence / Traceability Lock)
 * 
 * Verrouillage définitif de la traçabilité normative sur toute la chaîne :
 * COMPONENT-01..05 → NORM-14-09 → NORM-14-08 → NORM-14-07 → NORM-14-01
 * 
 * RÈGLES ARCHITECTURALES STRICTES (NORM-14-10) :
 * 1. Couche de contrôle et de verrouillage de traçabilité uniquement (Audit de provenance).
 * 2. Ne devient PAS une nouvelle source normative.
 * 3. Aucune invention d'évidence (No invention).
 * 4. Aucune perte d'évidence existante (No loss).
 * 5. Aucune promotion d'évidence (UNVERIFIED ne devient jamais VERIFIED, No promotion).
 * 6. Aucune fabrication de matchedRuleId (No fabrication).
 * 7. Aucune fabrication de conflictCode (No fabrication).
 * 8. Validation stricte de cohérence Rule ↔ Evidence et Conflict ↔ Evidence.
 * 9. Normalisation déterministe : déduplication, tri lexicographique et gel profond (Object.freeze).
 * 10. Les identifiants sont strictement opaques (string non-vide).
 */

export interface NormativeTraceabilityInput {
  readonly matchedRuleIds?: readonly string[] | null;
  readonly evidenceIds?: readonly string[] | null;
  readonly conflictCodes?: readonly string[] | null;
  readonly ruleEvidence?: readonly NormativeTraceabilityRuleEvidence[] | null;
  readonly conflicts?: readonly NormativeTraceabilityConflict[] | null;
}

export interface NormativeTraceabilityRuleEvidence {
  readonly ruleId: string;
  readonly evidenceIds: readonly string[];
}

export interface NormativeTraceabilityConflict {
  readonly conflictCode: string;
  readonly evidenceIds: readonly string[];
}

export interface NormativeTraceabilityResult {
  readonly valid: boolean;
  readonly matchedRuleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly conflictCodes: readonly string[];
  readonly ruleEvidence: readonly NormativeTraceabilityRuleEvidence[];
  readonly conflicts: readonly NormativeTraceabilityConflict[];
  readonly errors: readonly string[];
}

export interface INormativeEvidenceTraceabilityEngine {
  lock(input: unknown): NormativeTraceabilityResult;
}
