/**
 * PDI NORMATIVE ENGINE — NORMATIVE EVIDENCE TRACEABILITY ENGINE
 * Reference: NORM-14-10 (Evidence / Traceability Lock)
 * 
 * Moteur de verrouillage et de contrôle de traçabilité normative.
 * 
 * RÈGLES DE CONCEPTION STRICTES (NORM-14-10) :
 * 1. Audit de provenance pur : ne recalcule rien, n'appelle aucun moteur de compatibilité.
 * 2. Aucune invention d'évidence : si evidenceIds est vide, il reste vide. Aucun ID auto-généré.
 * 3. Aucune perte d'évidence : toute evidence reçue est conservée.
 * 4. Aucune promotion : aucun passage d'UNVERIFIED à VERIFIED ou missing à assumed.
 * 5. Aucune fabrication de matchedRuleId : les IDs sont strictement opaques et non-déduits.
 * 6. Aucune fabrication de conflictCode : les codes de conflits proviennent exclusivement des couches sources.
 * 7. Immutabilité totale : Object.freeze() appliqué à toutes les collections et au résultat racine.
 * 8. Déterminisme absolu : déduplication et tri lexicographique systématique.
 * 9. Validation de cohérence de provenance Rule ↔ Evidence et Conflict ↔ Evidence.
 */

import type {
  INormativeEvidenceTraceabilityEngine,
  NormativeTraceabilityConflict,
  NormativeTraceabilityInput,
  NormativeTraceabilityResult,
  NormativeTraceabilityRuleEvidence,
} from "../types/normativeEvidenceTraceabilityTypes";
import { validateTraceabilityInput } from "../validators/normativeEvidenceTraceabilityValidator";
import { isRecordObject } from "../validators/pipeDimensionalValidator";

export class NormativeEvidenceTraceabilityEngine
  implements INormativeEvidenceTraceabilityEngine
{
  /**
   * Verrouille et audite la traçabilité normative d'un résultat.
   */
  public lock(rawInput: unknown): NormativeTraceabilityResult {
    const validation = validateTraceabilityInput(rawInput);

    if (!validation.valid) {
      const candidate = isRecordObject(rawInput) ? rawInput : {};

      const rawRuleIds = Array.isArray(candidate.matchedRuleIds)
        ? candidate.matchedRuleIds.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0
          )
        : [];
      const rawEvidIds = Array.isArray(candidate.evidenceIds)
        ? candidate.evidenceIds.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0
          )
        : [];
      const rawConfCodes = Array.isArray(candidate.conflictCodes)
        ? candidate.conflictCodes.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0
          )
        : [];

      return Object.freeze({
        valid: false,
        matchedRuleIds: Object.freeze(Array.from(new Set(rawRuleIds)).sort()),
        evidenceIds: Object.freeze(Array.from(new Set(rawEvidIds)).sort()),
        conflictCodes: Object.freeze(Array.from(new Set(rawConfCodes)).sort()),
        ruleEvidence: Object.freeze([]),
        conflicts: Object.freeze([]),
        errors: Object.freeze(
          validation.errors.map((e) => `[${e.code}] ${e.message}`)
        ),
      });
    }

    const input = rawInput as NormativeTraceabilityInput;

    // 1. Déduplication et tri lexicographique des matchedRuleIds
    const matchedRuleIds = Object.freeze(
      Array.from(new Set(input.matchedRuleIds || [])).sort()
    );

    // 2. Déduplication et tri lexicographique des evidenceIds
    const evidenceIds = Object.freeze(
      Array.from(new Set(input.evidenceIds || [])).sort()
    );

    // 3. Déduplication et tri lexicographique des conflictCodes
    const conflictCodes = Object.freeze(
      Array.from(new Set(input.conflictCodes || [])).sort()
    );

    // 4. Normalisation, déduplication et tri de ruleEvidence
    const ruleEvidenceMap = new Map<string, Set<string>>();
    if (Array.isArray(input.ruleEvidence)) {
      for (const re of input.ruleEvidence) {
        if (!ruleEvidenceMap.has(re.ruleId)) {
          ruleEvidenceMap.set(re.ruleId, new Set<string>());
        }
        const set = ruleEvidenceMap.get(re.ruleId)!;
        for (const eid of re.evidenceIds || []) {
          set.add(eid);
        }
      }
    }

    const sortedRuleEvidence: NormativeTraceabilityRuleEvidence[] = Array.from(
      ruleEvidenceMap.entries()
    )
      .map(([ruleId, eSet]) =>
        Object.freeze({
          ruleId,
          evidenceIds: Object.freeze(Array.from(eSet).sort()),
        })
      )
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId));

    // 5. Normalisation, déduplication et tri de conflicts
    const conflictMap = new Map<string, Set<string>>();
    if (Array.isArray(input.conflicts)) {
      for (const c of input.conflicts) {
        if (!conflictMap.has(c.conflictCode)) {
          conflictMap.set(c.conflictCode, new Set<string>());
        }
        const set = conflictMap.get(c.conflictCode)!;
        for (const eid of c.evidenceIds || []) {
          set.add(eid);
        }
      }
    }

    const sortedConflicts: NormativeTraceabilityConflict[] = Array.from(
      conflictMap.entries()
    )
      .map(([conflictCode, eSet]) =>
        Object.freeze({
          conflictCode,
          evidenceIds: Object.freeze(Array.from(eSet).sort()),
        })
      )
      .sort((a, b) => a.conflictCode.localeCompare(b.conflictCode));

    return Object.freeze({
      valid: true,
      matchedRuleIds,
      evidenceIds,
      conflictCodes,
      ruleEvidence: Object.freeze(sortedRuleEvidence),
      conflicts: Object.freeze(sortedConflicts),
      errors: Object.freeze([]),
    });
  }
}
