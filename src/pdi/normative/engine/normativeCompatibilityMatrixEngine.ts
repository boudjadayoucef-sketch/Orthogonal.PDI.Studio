/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY MATRIX ENGINE
 * Reference: NORM-14-01 (Compatibility Matrix Foundation)
 * 
 * Moteur déterministe d'évaluation de la matrice de compatibilité normative.
 * RÈGLES DE FONCTIONNEMENT (NORM-14-01) :
 * 1. Validation de la requête (query) : Paramètres invalides → INVALID.
 * 2. Matching exact strict sur le quadruplet (leftEntityType, leftEntityId, rightEntityType, rightEntityId).
 *    - Aucun fuzzy matching, aucun ranking arbitraire, aucune conversion implicite.
 *    - Respect strict de la directionnalité : A ↔ B n'implique pas B ↔ A sans règle explicite.
 * 3. Résolution basée sur la chaîne d'évidence normative (NORM-09 Evidence Resolver) :
 *    - COMPATIBLE avec evidence VERIFIED → COMPATIBLE.
 *    - INCOMPATIBLE avec evidence VERIFIED → INCOMPATIBLE.
 *    - Règle sans evidence ou evidence UNVERIFIED/NOT_FOUND → non qualifiée de VERIFIED.
 *    - sourceReference seul ne confère JAMAIS le statut VERIFIED.
 * 4. Gestion stricte des conflits et précédence :
 *    - Conflit entre règles vérifiées (COMPATIBLE vs INCOMPATIBLE) → INVALID avec code de conflit explicite.
 *    - Règle vérifiée face à règle UNVERIFIED → La règle vérifiée est déterminante.
 *    - Uniquement des règles non vérifiées → UNVERIFIED.
 *    - Aucune règle correspondante → UNVERIFIED (et non INCOMPATIBLE).
 * 5. Traçabilité & Déterminisme :
 *    - matchedRuleIds et evidenceIds dédupliqués, triés et gelés.
 *    - Indépendance stricte vis-à-vis de l'ordre d'insertion des règles.
 */

import type {
  NormativeCompatibilityEntityType,
  NormativeCompatibilityMatrixResult,
  NormativeCompatibilityMatrixRule,
} from "../types/normativeCompatibilityMatrixTypes";
import type { INormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { defaultCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import type { INormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { validateCompatibilityMatrixQuery } from "../validators/normativeCompatibilityMatrixValidator";

export interface INormativeCompatibilityMatrixEngine {
  resolveCompatibility(
    leftEntityType: NormativeCompatibilityEntityType,
    leftEntityId: string,
    rightEntityType: NormativeCompatibilityEntityType,
    rightEntityId: string
  ): NormativeCompatibilityMatrixResult;
}

interface EvaluatedMatrixRule {
  readonly rule: NormativeCompatibilityMatrixRule;
  readonly isVerified: boolean;
  readonly evidenceIds: readonly string[];
}

export class NormativeCompatibilityMatrixEngine implements INormativeCompatibilityMatrixEngine {
  constructor(
    private readonly registry: INormativeCompatibilityMatrixRegistry = defaultCompatibilityMatrixRegistry,
    private readonly evidenceResolver: INormativeEvidenceResolver = new NormativeEvidenceResolver()
  ) {}

  /**
   * Évalue la compatibilité normative entre deux entités industrielles.
   */
  public resolveCompatibility(
    leftEntityType: NormativeCompatibilityEntityType,
    leftEntityId: string,
    rightEntityType: NormativeCompatibilityEntityType,
    rightEntityId: string
  ): NormativeCompatibilityMatrixResult {
    // 1. Validation de la requête
    const queryValidation = validateCompatibilityMatrixQuery(
      leftEntityType,
      leftEntityId,
      rightEntityType,
      rightEntityId
    );

    if (!queryValidation.valid) {
      const errorMsg = queryValidation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      return Object.freeze({
        status: "INVALID",
        leftEntityType,
        leftEntityId,
        rightEntityType,
        rightEntityId,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_COMPATIBILITY_QUERY: ${errorMsg}`,
      });
    }

    // 2. Recherche des règles candidates par matching exact strict
    const allRules = this.registry.list();
    const matchingRules = allRules.filter(
      (rule) =>
        rule.leftEntityType === leftEntityType &&
        rule.leftEntityId === leftEntityId &&
        rule.rightEntityType === rightEntityType &&
        rule.rightEntityId === rightEntityId
    );

    // Cas 4 : Aucune règle correspondante → UNVERIFIED
    if (matchingRules.length === 0) {
      return Object.freeze({
        status: "UNVERIFIED",
        leftEntityType,
        leftEntityId,
        rightEntityType,
        rightEntityId,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `No compatibility rule found for ${leftEntityType}:${leftEntityId} -> ${rightEntityType}:${rightEntityId}.`,
      });
    }

    // 3. Évaluation de la chaîne d'évidence pour chaque règle correspondante
    const evaluatedRules: EvaluatedMatrixRule[] = matchingRules.map((rule) => {
      const eIds = rule.evidenceIds ?? [];
      let isVerified = false;

      // Une règle déclarée 'UNVERIFIED' ne peut jamais être vérifiée
      if (rule.status !== "UNVERIFIED" && eIds.length > 0) {
        const resolution = this.evidenceResolver.resolveEvidenceSet(eIds);
        isVerified = resolution.allVerified && resolution.totalRequested > 0;
      }

      return {
        rule,
        isVerified,
        evidenceIds: eIds,
      };
    });

    const verifiedCompatible = evaluatedRules
      .filter((er) => er.rule.status === "COMPATIBLE" && er.isVerified)
      .map((er) => er.rule);

    const verifiedIncompatible = evaluatedRules
      .filter((er) => er.rule.status === "INCOMPATIBLE" && er.isVerified)
      .map((er) => er.rule);

    // Trier les règles de façon stable par ruleId pour un déterminisme absolu
    verifiedCompatible.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    verifiedIncompatible.sort((a, b) => a.ruleId.localeCompare(b.ruleId));

    const hasVerifiedCompatible = verifiedCompatible.length > 0;
    const hasVerifiedIncompatible = verifiedIncompatible.length > 0;

    // Cas 1 : Conflit strict entre règles vérifiées contradictoires (COMPATIBLE vs INCOMPATIBLE)
    if (hasVerifiedCompatible && hasVerifiedIncompatible) {
      const compatIds = verifiedCompatible.map((r) => r.ruleId).sort();
      const incompatIds = verifiedIncompatible.map((r) => r.ruleId).sort();
      const allMatchedIds = Array.from(new Set(matchingRules.map((r) => r.ruleId))).sort();
      const allEvidenceIds = Array.from(
        new Set(matchingRules.flatMap((r) => r.evidenceIds ?? []))
      ).sort();

      return Object.freeze({
        status: "INVALID",
        leftEntityType,
        leftEntityId,
        rightEntityType,
        rightEntityId,
        matchedRuleIds: Object.freeze(allMatchedIds),
        evidenceIds: Object.freeze(allEvidenceIds),
        conflictCode: "COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES",
        message: `NORMATIVE_RULE_CONFLICT: Contradictory VERIFIED rules found for ${leftEntityType}:${leftEntityId} -> ${rightEntityType}:${rightEntityId} (Compatible: [${compatIds.join(", ")}], Incompatible: [${incompatIds.join(", ")}]).`,
        matchedRules: Object.freeze(matchingRules),
      });
    }

    // Cas 2A : Au moins une règle vérifiée INCOMPATIBLE (la règle vérifiée est déterminante)
    if (hasVerifiedIncompatible) {
      const primaryIncompat = verifiedIncompatible[0];
      const matchedRuleIds = Array.from(new Set(verifiedIncompatible.map((r) => r.ruleId))).sort();
      const evidenceIds = Array.from(
        new Set(verifiedIncompatible.flatMap((r) => r.evidenceIds ?? []))
      ).sort();

      return Object.freeze({
        status: "INCOMPATIBLE",
        leftEntityType,
        leftEntityId,
        rightEntityType,
        rightEntityId,
        matchedRuleIds: Object.freeze(matchedRuleIds),
        evidenceIds: Object.freeze(evidenceIds),
        matchedRule: primaryIncompat,
        matchedRules: Object.freeze(verifiedIncompatible),
        message: primaryIncompat.notes ?? `Verified INCOMPATIBLE normative rule matched (${primaryIncompat.ruleId}).`,
      });
    }

    // Cas 2B : Au moins une règle vérifiée COMPATIBLE (la règle vérifiée est déterminante)
    if (hasVerifiedCompatible) {
      const primaryCompat = verifiedCompatible[0];
      const matchedRuleIds = Array.from(new Set(verifiedCompatible.map((r) => r.ruleId))).sort();
      const evidenceIds = Array.from(
        new Set(verifiedCompatible.flatMap((r) => r.evidenceIds ?? []))
      ).sort();

      return Object.freeze({
        status: "COMPATIBLE",
        leftEntityType,
        leftEntityId,
        rightEntityType,
        rightEntityId,
        matchedRuleIds: Object.freeze(matchedRuleIds),
        evidenceIds: Object.freeze(evidenceIds),
        matchedRule: primaryCompat,
        matchedRules: Object.freeze(verifiedCompatible),
        message: primaryCompat.notes ?? `Verified COMPATIBLE normative rule matched (${primaryCompat.ruleId}).`,
      });
    }

    // Cas 3 : Uniquement des règles non vérifiées (UNVERIFIED ou sans preuve normative vérifiée)
    const allMatchedIds = Array.from(new Set(matchingRules.map((r) => r.ruleId))).sort();
    const allEvidenceIds = Array.from(
      new Set(matchingRules.flatMap((r) => r.evidenceIds ?? []))
    ).sort();
    const primaryMatch = matchingRules[0];

    return Object.freeze({
      status: "UNVERIFIED",
      leftEntityType,
      leftEntityId,
      rightEntityType,
      rightEntityId,
      matchedRuleIds: Object.freeze(allMatchedIds),
      evidenceIds: Object.freeze(allEvidenceIds),
      matchedRule: primaryMatch,
      matchedRules: Object.freeze(matchingRules),
      message: `Matching rule(s) [${allMatchedIds.join(", ")}] lack valid VERIFIED normative evidence.`,
    });
  }
}
