/**
 * PDI NORMATIVE ENGINE — NORMATIVE EVIDENCE REGISTRY
 * Reference: NORM-09 (Evidence Registry / Resolver)
 * 
 * Registre déterministe, auditable et contrôlé pour le stockage
 * et la consultation des éléments d'évidence normative (NormativeEvidence).
 * 
 * RÈGLES ARCHITECTURALES STRICTES (NORM-09) :
 * 1. Validation structurelle préalable obligatoire :
 *    - Toute Evidence insérée doit être rigoureusement validée par `validateNormativeEvidence`.
 *    - Une Evidence invalide est STRICTEMENT rejetée avec une exception explicite.
 * 2. Contrôle d'unicité et non-mutation :
 *    - L'identifiant `evidenceId` ne doit jamais être vide.
 *    - Doublon interdit : enregistrer deux fois le même `evidenceId` est formellement rejeté.
 *    - Aucune modification silencieuse d'une Evidence déjà enregistrée.
 * 3. Préservation inviolable des statuts :
 *    - Ne transforme JAMAIS "UNVERIFIED" en "VERIFIED".
 * 4. Interdiction absolue des tokens heuristiques :
 *    - Aucun token heuristique (MAT_CS_*, _CS_, CS_, CRMO, etc.) ne peut servir d'evidenceId.
 * 5. Aucun remplissage avec de fausses données :
 *    - Le registre est initialement VIDE.
 *    - Aucune donnée normative ASME/API/ISO n'est inventée ou injectée par défaut.
 */

import type { NormativeEvidence } from "../types/normativeEvidenceTypes";
import {
  validateNormativeEvidence,
  isDisallowedTokenHeuristic,
} from "../validators/normativeEvidenceValidator";

/**
 * Interface du registre d'évidence normative.
 */
export interface INormativeEvidenceRegistry {
  register(evidence: NormativeEvidence): void;
  get(evidenceId: string): NormativeEvidence | undefined;
  has(evidenceId: string): boolean;
  list(): readonly NormativeEvidence[];
  clear(): void;
  count(): number;
}

/**
 * Implémentation déterministe en mémoire du registre d'évidence normative.
 */
export class NormativeEvidenceRegistry implements INormativeEvidenceRegistry {
  private readonly store = new Map<string, NormativeEvidence>();

  /**
   * Enregistre une NormativeEvidence après validation stricte.
   * 
   * @throws Error si l'évidence est invalide, si l'id est vide, si un token heuristique est utilisé,
   * ou si un doublon d'evidenceId est détecté.
   */
  public register(evidence: NormativeEvidence): void {
    if (!evidence || typeof evidence !== "object") {
      throw new Error("EVIDENCE_REGISTRY_ERROR: Cannot register null or non-object evidence.");
    }

    const eid = evidence.evidenceId;
    if (typeof eid !== "string" || eid.trim().length === 0) {
      throw new Error("EVIDENCE_REGISTRY_ERROR: evidenceId must be a non-empty string.");
    }

    if (isDisallowedTokenHeuristic(eid)) {
      throw new Error(
        `EVIDENCE_REGISTRY_ERROR: Token '${eid}' is an identifier/heuristic and cannot be used as an evidenceId.`
      );
    }

    if (this.store.has(eid)) {
      throw new Error(
        `EVIDENCE_REGISTRY_ERROR: Duplicate evidenceId '${eid}' is strictly prohibited. An evidence record cannot be overwritten.`
      );
    }

    // Validation structurelle complète selon le validateur MASTER-02
    const validation = validateNormativeEvidence(evidence);
    if (!validation.valid) {
      const errorDetails = validation.errors.map((e) => `[${e.code}] ${e.message}`).join("; ");
      throw new Error(
        `EVIDENCE_REGISTRY_ERROR: Refused invalid evidence '${eid}'. Structural errors: ${errorDetails}`
      );
    }

    // Stockage immuable (copie superficielle gelée)
    this.store.set(eid, Object.freeze({ ...evidence }));
  }

  /**
   * Récupère une NormativeEvidence par son identifiant.
   */
  public get(evidenceId: string): NormativeEvidence | undefined {
    if (typeof evidenceId !== "string" || evidenceId.trim().length === 0) {
      return undefined;
    }
    return this.store.get(evidenceId.trim());
  }

  /**
   * Vérifie la présence d'une Evidence dans le registre.
   */
  public has(evidenceId: string): boolean {
    if (typeof evidenceId !== "string" || evidenceId.trim().length === 0) {
      return false;
    }
    return this.store.has(evidenceId.trim());
  }

  /**
   * Liste l'ensemble des NormativeEvidence enregistrées.
   */
  public list(): readonly NormativeEvidence[] {
    return Object.freeze(Array.from(this.store.values()));
  }

  /**
   * Retourne le nombre d'éléments enregistrés.
   */
  public count(): number {
    return this.store.size;
  }

  /**
   * Réinitialise le contenu du registre (essentiellement pour l'isolation des tests unitaires).
   */
  public clear(): void {
    this.store.clear();
  }
}

/**
 * Instance singleton globale du registre d'évidences normatives PDI.
 * Initialement VIDE (aucune donnée normative inventée).
 */
export const defaultEvidenceRegistry = new NormativeEvidenceRegistry();
