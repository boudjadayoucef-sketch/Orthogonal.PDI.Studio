/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY MATRIX REGISTRY
 * Reference: NORM-14-01 (Compatibility Matrix Foundation)
 * 
 * Registre déterministe en mémoire pour les règles de la matrice de compatibilité normative.
 * RÈGLES D'INTÉGRITÉ STRICTES :
 * 1. Registre strictement vide au démarrage (aucun seed ni données normatives réelles préchargées).
 * 2. Validation structurelle obligatoire avant toute insertion.
 * 3. Identifiants ruleId strictement uniques (aucun écrasement silencieux).
 * 4. Rejet strict des tokens heuristiques interdits.
 * 5. list() déterministe et trié de manière stable (par ruleId alphabétique).
 * 6. Stockage immuable et copies gelées.
 */

import type {
  NormativeCompatibilityMatrixRule,
} from "../types/normativeCompatibilityMatrixTypes";
import { validateNormativeCompatibilityMatrixRule } from "../validators/normativeCompatibilityMatrixValidator";

export interface INormativeCompatibilityMatrixRegistry {
  register(rule: NormativeCompatibilityMatrixRule): {
    success: boolean;
    error?: string;
  };

  get(ruleId: string): NormativeCompatibilityMatrixRule | undefined;

  has(ruleId: string): boolean;

  list(): readonly NormativeCompatibilityMatrixRule[];

  count(): number;

  clear(): void;
}

/**
 * Matrice normative de compatibilité de production (initialement vide et gelée).
 * Conforme au principe absolu de non-invention normative.
 */
export const NORMATIVE_COMPATIBILITY_MATRIX: readonly NormativeCompatibilityMatrixRule[] = Object.freeze([]);

export class NormativeCompatibilityMatrixRegistry implements INormativeCompatibilityMatrixRegistry {
  private readonly rules = new Map<string, NormativeCompatibilityMatrixRule>();

  constructor() {
    // Registre strictement vide à l'initialisation
  }

  /**
   * Enregistre une nouvelle règle de compatibilité après validation structurelle complète.
   */
  public register(rule: NormativeCompatibilityMatrixRule): {
    success: boolean;
    error?: string;
  } {
    const validation = validateNormativeCompatibilityMatrixRule(rule);
    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      return {
        success: false,
        error: `COMPATIBILITY_MATRIX_REGISTRY_VALIDATION_ERROR: Refused invalid rule. ${errorMsg}`,
      };
    }

    if (this.rules.has(rule.ruleId)) {
      return {
        success: false,
        error: `COMPATIBILITY_MATRIX_REGISTRY_DUPLICATE: Rule with ruleId '${rule.ruleId}' is already registered. Overwrite is disallowed.`,
      };
    }

    // Freeze rule deeply to ensure immutability
    const frozenRule: NormativeCompatibilityMatrixRule = Object.freeze({
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
  public get(ruleId: string): NormativeCompatibilityMatrixRule | undefined {
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
   * Retourne la liste immuable de toutes les règles enregistrées,
   * triée de manière stable par ruleId pour un déterminisme absolu.
   */
  public list(): readonly NormativeCompatibilityMatrixRule[] {
    const all = Array.from(this.rules.values());
    all.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    return Object.freeze(all);
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
export const defaultCompatibilityMatrixRegistry = new NormativeCompatibilityMatrixRegistry();
