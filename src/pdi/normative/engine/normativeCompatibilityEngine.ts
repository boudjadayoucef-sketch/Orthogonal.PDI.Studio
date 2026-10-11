/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY ENGINE
 * Reference: NORM-13 (Normative Compatibility Matrix)
 * 
 * Moteur déterministe d'évaluation de la compatibilité normative.
 * RÈGLES DE FONCTIONNEMENT (NORM-13) :
 * 1. Étape 1 : Validation structurelle du contexte. Contexte invalide → INVALID.
 * 2. Étape 2 : Recherche des règles correspondant au contexte par matching dimensionnel strict.
 *    - Une règle ne correspond que si tous les critères non-undefined de la règle sont strictement égaux aux valeurs du contexte.
 *    - Aucun fuzzy matching, aucun ranking arbitraire, aucune conversion implicite (NPS↔DN, Class↔PN).
 * 3. Étape 3 : Résolution basée sur les preuves normatives (NORM-09 Evidence Resolver).
 *    - COMPATIBLE avec evidence VERIFIED → COMPATIBLE.
 *    - INCOMPATIBLE avec evidence VERIFIED → INCOMPATIBLE.
 *    - Règle sans evidence ou evidence UNVERIFIED/NOT_FOUND → UNVERIFIED.
 *    - Absence de règle correspondante → UNVERIFIED (l'absence de règle n'est JAMAIS une incompatibilité).
 *    - Une règle non vérifiée ne masque JAMAIS une règle vérifiée.
 */

import type {
  NormativeCompatibilityContext,
  NormativeCompatibilityResult,
  NormativeCompatibilityRule,
} from "../types/normativeCompatibilityTypes";
import type { INormativeCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import { defaultCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import type { INormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { validateNormativeCompatibilityContext } from "../validators/normativeCompatibilityValidator";

export interface INormativeCompatibilityEngine {
  evaluate(context: NormativeCompatibilityContext): NormativeCompatibilityResult;
}

const MATCH_FIELDS: readonly (keyof NormativeCompatibilityContext & keyof NormativeCompatibilityRule)[] = Object.freeze([
  "standardId",
  "editionId",
  "componentType",
  "connectionType",
  "nominalSize",
  "schedule",
  "pressureRating",
  "materialId",
  "materialForm",
  "designCodeId",
  "pipingSpecId",
]);

export class NormativeCompatibilityEngine implements INormativeCompatibilityEngine {
  constructor(
    private readonly registry: INormativeCompatibilityRegistry,
    private readonly evidenceResolver: INormativeEvidenceResolver
  ) {}

  /**
   * Évalue un contexte de caractéristiques industrielles par rapport aux règles de compatibilité enregistrées.
   */
  public evaluate(context: NormativeCompatibilityContext): NormativeCompatibilityResult {
    // ÉTAPE 1 : Validation du contexte
    const contextValidation = validateNormativeCompatibilityContext(context);
    if (!contextValidation.valid) {
      const errorMsg = contextValidation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      return {
        status: "INVALID",
        message: `INVALID_COMPATIBILITY_CONTEXT: ${errorMsg}`,
      };
    }

    // ÉTAPE 2 : Recherche des règles candidates
    const allRules = this.registry.list();
    const matchingRules = allRules.filter((rule) => this.doesRuleMatchContext(rule, context));

    if (matchingRules.length === 0) {
      return {
        status: "UNVERIFIED",
        message: "No matching compatibility rule found in registry.",
      };
    }

    // ÉTAPE 3 : Résolution déterministe avec vérification d'évidence
    // Structure interne pour stocker l'évaluation d'une règle
    interface EvaluatedRule {
      readonly rule: NormativeCompatibilityRule;
      readonly isEvidenceVerified: boolean;
      readonly evidenceIds: readonly string[];
    }

    const evaluatedRules: EvaluatedRule[] = matchingRules.map((rule) => {
      const eIds = rule.evidenceIds ?? [];
      let isVerified = false;

      if (eIds.length > 0) {
        const resolution = this.evidenceResolver.resolveEvidenceSet(eIds);
        isVerified = resolution.allVerified && resolution.totalRequested > 0;
      }

      return {
        rule,
        isEvidenceVerified: isVerified,
        evidenceIds: eIds,
      };
    });

    const verifiedCompatibleRules = evaluatedRules.filter(
      (er) => er.rule.status === "COMPATIBLE" && er.isEvidenceVerified
    );
    const verifiedIncompatibleRules = evaluatedRules.filter(
      (er) => er.rule.status === "INCOMPATIBLE" && er.isEvidenceVerified
    );

    const hasVerifiedCompatible = verifiedCompatibleRules.length > 0;
    const hasVerifiedIncompatible = verifiedIncompatibleRules.length > 0;

    // A. Conflit strict entre règles vérifiées contradictoires (COMPATIBLE vs INCOMPATIBLE)
    if (hasVerifiedCompatible && hasVerifiedIncompatible) {
      const compatRuleIds = verifiedCompatibleRules.map((r) => r.rule.ruleId).join(", ");
      const incompatRuleIds = verifiedIncompatibleRules.map((r) => r.rule.ruleId).join(", ");
      return {
        status: "INVALID",
        message: `NORMATIVE_RULE_CONFLICT: Detected contradictory VERIFIED rules matching the same context (Compatible: [${compatRuleIds}], Incompatible: [${incompatRuleIds}]).`,
      };
    }

    // B. Toutes les règles vérifiées sont INCOMPATIBLE
    if (hasVerifiedIncompatible) {
      const primaryIncompat = verifiedIncompatibleRules[0];
      const allIncompatRuleIds = verifiedIncompatibleRules
        .map((r) => r.rule.ruleId)
        .slice()
        .sort();
      const allIncompatEvIds = Array.from(
        new Set(verifiedIncompatibleRules.flatMap((r) => r.evidenceIds))
      ).sort();
      return {
        status: "INCOMPATIBLE",
        ruleId: primaryIncompat.rule.ruleId,
        matchedRule: primaryIncompat.rule,
        matchedRuleIds: allIncompatRuleIds,
        matchedRules: verifiedIncompatibleRules.map((r) => r.rule),
        evidenceIds: allIncompatEvIds,
        message: primaryIncompat.rule.description,
      };
    }

    // C. Toutes les règles vérifiées sont COMPATIBLE (une règle non vérifiée ne masque pas une règle vérifiée)
    if (hasVerifiedCompatible) {
      const primaryCompat = verifiedCompatibleRules[0];
      const allCompatRuleIds = verifiedCompatibleRules
        .map((r) => r.rule.ruleId)
        .slice()
        .sort();
      const allCompatEvIds = Array.from(
        new Set(verifiedCompatibleRules.flatMap((r) => r.evidenceIds))
      ).sort();
      return {
        status: "COMPATIBLE",
        ruleId: primaryCompat.rule.ruleId,
        matchedRule: primaryCompat.rule,
        matchedRuleIds: allCompatRuleIds,
        matchedRules: verifiedCompatibleRules.map((r) => r.rule),
        evidenceIds: allCompatEvIds,
        message: primaryCompat.rule.description,
      };
    }

    // D. Si des règles correspondent mais qu'aucune n'a de preuve vérifiée complète → UNVERIFIED
    const firstMatch = evaluatedRules[0];
    const allUnverifiedRuleIds = evaluatedRules
      .map((r) => r.rule.ruleId)
      .slice()
      .sort();
    const allUnverifiedEvIds = Array.from(
      new Set(evaluatedRules.flatMap((r) => r.evidenceIds))
    ).sort();
    return {
      status: "UNVERIFIED",
      ruleId: firstMatch.rule.ruleId,
      matchedRule: firstMatch.rule,
      matchedRuleIds: allUnverifiedRuleIds,
      matchedRules: evaluatedRules.map((r) => r.rule),
      evidenceIds: allUnverifiedEvIds,
      message: `Matching rule '${firstMatch.rule.ruleId}' lacks valid VERIFIED normative evidence.`,
    };
  }

  /**
   * Vérifie si tous les critères définis sur une règle correspondent exactement aux valeurs fournies dans le contexte.
   */
  private doesRuleMatchContext(
    rule: NormativeCompatibilityRule,
    context: NormativeCompatibilityContext
  ): boolean {
    for (const field of MATCH_FIELDS) {
      const ruleVal = rule[field];
      if (ruleVal !== undefined) {
        const ctxVal = context[field];
        if (ctxVal === undefined || ctxVal !== ruleVal) {
          return false;
        }
      }
    }
    return true;
  }
}
