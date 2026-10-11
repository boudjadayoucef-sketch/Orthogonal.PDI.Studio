/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY REGISTRY
 * Reference: NORM-13 (Normative Compatibility Matrix)
 * 
 * Registre déterministe en mémoire pour les règles de compatibilité normative.
 * RÈGLES D'INTÉGRITÉ STRICTES :
 * 1. Registre vide au démarrage (aucun seed ni données normatives préchargées).
 * 2. Validation structurelle obligatoire avant toute insertion.
 * 3. Identifiants ruleId strictement uniques (aucun écrasement silencieux).
 * 4. Rejet strict des tokens heuristiques interdits.
 * 5. Aucun classement arbitraire (retourne les règles dans leur ordre d'insertion déterministe).
 */

import type {
  NormativeCompatibilityRule,
} from "../types/normativeCompatibilityTypes";
import { validateNormativeCompatibilityRule } from "../validators/normativeCompatibilityValidator";

export interface INormativeCompatibilityRegistry {
  register(rule: NormativeCompatibilityRule): {
    success: boolean;
    error?: string;
  };

  get(ruleId: string): NormativeCompatibilityRule | undefined;

  has(ruleId: string): boolean;

  list(): readonly NormativeCompatibilityRule[];

  count(): number;

  clear(): void;
}

export class NormativeCompatibilityRegistry implements INormativeCompatibilityRegistry {
  private readonly rules = new Map<string, NormativeCompatibilityRule>();

  constructor() {
    // Registre strictement vide à l'initialisation
  }

  /**
   * Enregistre une nouvelle règle de compatibilité après validation structurelle complète.
   */
  public register(rule: NormativeCompatibilityRule): {
    success: boolean;
    error?: string;
  } {
    const validation = validateNormativeCompatibilityRule(rule);
    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      return {
        success: false,
        error: `COMPATIBILITY_REGISTRY_VALIDATION_ERROR: Refused invalid rule. ${errorMsg}`,
      };
    }

    if (this.rules.has(rule.ruleId)) {
      return {
        success: false,
        error: `COMPATIBILITY_REGISTRY_DUPLICATE: Rule with ruleId '${rule.ruleId}' is already registered. Overwrite is disallowed.`,
      };
    }

    // Freeze rule deeply to ensure immutability
    const frozenRule: NormativeCompatibilityRule = Object.freeze({
      ...rule,
      evidenceIds: rule.evidenceIds ? Object.freeze([...rule.evidenceIds]) : undefined,
    });

    this.rules.set(rule.ruleId, frozenRule);

    return {
      success: true,
    };
  }

  /**
   * Récupère une règle par son ruleId.
   */
  public get(ruleId: string): NormativeCompatibilityRule | undefined {
    if (typeof ruleId !== "string") return undefined;
    return this.rules.get(ruleId);
  }

  /**
   * Vérifie la présence d'une règle par son ruleId.
   */
  public has(ruleId: string): boolean {
    if (typeof ruleId !== "string") return false;
    return this.rules.has(ruleId);
  }

  /**
   * Retourne la liste immuable de toutes les règles enregistrées dans l'ordre d'insertion.
   */
  public list(): readonly NormativeCompatibilityRule[] {
    return Object.freeze(Array.from(this.rules.values()));
  }

  /**
   * Retourne le nombre de règles enregistrées.
   */
  public count(): number {
    return this.rules.size;
  }

  /**
   * Vide complètement le registre.
   */
  public clear(): void {
    this.rules.clear();
  }
}

/**
 * Instance globale par défaut (vide à l'initialisation).
 */
export const defaultCompatibilityRegistry = new NormativeCompatibilityRegistry();
