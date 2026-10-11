/**
 * PDI NORMATIVE ENGINE — ASME B31.3 DATA REGISTRY
 * Reference: B31.3-02 (Controlled Normative Data Ingestion)
 * 
 * Registre déterministe, auditable et contrôlé pour le stockage
 * et la consultation des enregistrements de données normatives ASME B31.3.
 * 
 * RÈGLES ARCHITECTURALES STRICTES (B31.3-02) :
 * 1. Validation de gouvernance préalable obligatoire :
 *    - Tout record inséré doit être structurellement valide.
 *    - Tout record marqué "VERIFIED" exige impérativement que son document source
 *      ET son évidence associée soient tous deux résolus avec le statut "FOUND_VERIFIED".
 *    - Si un document source ou une évidence est absent ou non vérifié,
 *      le statut "VERIFIED" est formellement REJETÉ.
 * 2. Contrôle d'unicité et non-mutation :
 *    - L'identifiant `dataId` ne doit jamais être vide.
 *    - Doublon interdit : enregistrer deux fois le même `dataId` est formellement rejeté.
 *    - Aucune modification silencieuse d'une donnée déjà enregistrée.
 * 3. Préservation inviolable des statuts :
 *    - Ne transforme JAMAIS "UNVERIFIED" en "VERIFIED".
 * 4. Interdiction absolue des tokens heuristiques :
 *    - Aucun token heuristique (MAT_CS_*, _CS_, CS_, CRMO, etc.) ne peut servir de dataId.
 * 5. Registre initialement VIDE :
 *    - Aucune donnée ou constante ASME inventée n'est injectée par défaut.
 */

import type { B31_3NormativeDataRecord } from "../../types/b31_3DataTypes";
import type { INormativeSourceDocumentResolver } from "../../registry/normativeSourceDocumentResolver";
import type { INormativeEvidenceResolver } from "../../registry/normativeEvidenceResolver";
import { defaultSourceDocumentResolver } from "../../registry/normativeSourceDocumentResolver";
import { defaultEvidenceResolver } from "../../registry/normativeEvidenceResolver";
import {
  validateB31_3DataRecordGovernance,
} from "./b31_3DataValidator";
import { isDisallowedTokenHeuristic } from "../../validators/normativeEvidenceValidator";

/**
 * Interface du registre de données normatives B31.3.
 */
export interface IB31_3DataRegistry {
  register<T = unknown>(record: B31_3NormativeDataRecord<T>): void;
  get<T = unknown>(dataId: string): B31_3NormativeDataRecord<T> | undefined;
  has(dataId: string): boolean;
  list(): readonly B31_3NormativeDataRecord<unknown>[];
  clear(): void;
  count(): number;
}

/**
 * Implémentation déterministe en mémoire du registre de données B31.3.
 */
export class B31_3DataRegistry implements IB31_3DataRegistry {
  private readonly store = new Map<string, B31_3NormativeDataRecord<unknown>>();

  constructor(
    private readonly sourceDocResolver: INormativeSourceDocumentResolver = defaultSourceDocumentResolver,
    private readonly evidenceResolver: INormativeEvidenceResolver = defaultEvidenceResolver
  ) {}

  /**
   * Enregistre un B31_3NormativeDataRecord après validation complète de gouvernance.
   * 
   * @throws Error si le record est invalide, si l'id est vide, si un token heuristique est utilisé,
   * si un doublon de dataId est détecté, ou si un record VERIFIED a une chaîne de traçabilité incomplète.
   */
  public register<T = unknown>(record: B31_3NormativeDataRecord<T>): void {
    if (!record || typeof record !== "object") {
      throw new Error(
        "B31_3_DATA_REGISTRY_ERROR: Cannot register null or non-object record."
      );
    }

    const did = record.dataId;
    if (typeof did !== "string" || did.trim().length === 0) {
      throw new Error(
        "B31_3_DATA_REGISTRY_ERROR: dataId must be a non-empty string."
      );
    }

    if (isDisallowedTokenHeuristic(did)) {
      throw new Error(
        `B31_3_DATA_REGISTRY_ERROR: Token '${did}' is an identifier/heuristic and cannot be used as a dataId.`
      );
    }

    if (this.store.has(did)) {
      throw new Error(
        `B31_3_DATA_REGISTRY_ERROR: Duplicate dataId '${did}' is strictly prohibited. A normative data record cannot be overwritten.`
      );
    }

    // Validation structurelle et de gouvernance (vérification de la chaîne SourceDoc → Evidence → Record)
    const validation = validateB31_3DataRecordGovernance(
      record as B31_3NormativeDataRecord<unknown>,
      this.sourceDocResolver,
      this.evidenceResolver
    );

    if (!validation.valid) {
      const errorDetails = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      throw new Error(
        `B31_3_DATA_REGISTRY_ERROR: Refused invalid data record '${did}'. Errors: ${errorDetails}`
      );
    }

    // Stockage immuable (copie superficielle gelée)
    this.store.set(did, Object.freeze({ ...record }) as B31_3NormativeDataRecord<unknown>);
  }

  /**
   * Récupère un enregistrement de données B31.3 par son identifiant.
   */
  public get<T = unknown>(dataId: string): B31_3NormativeDataRecord<T> | undefined {
    if (typeof dataId !== "string" || dataId.trim().length === 0) {
      return undefined;
    }
    return this.store.get(dataId.trim()) as B31_3NormativeDataRecord<T> | undefined;
  }

  /**
   * Vérifie la présence d'un enregistrement dans le registre.
   */
  public has(dataId: string): boolean {
    if (typeof dataId !== "string" || dataId.trim().length === 0) {
      return false;
    }
    return this.store.has(dataId.trim());
  }

  /**
   * Liste l'ensemble des enregistrements B31.3 enregistrés (triés alphabétiquement par dataId pour strict déterminisme).
   */
  public list(): readonly B31_3NormativeDataRecord<unknown>[] {
    const items = Array.from(this.store.values()).sort((a, b) =>
      a.dataId.localeCompare(b.dataId)
    );
    return Object.freeze(items);
  }

  /**
   * Retourne le nombre d'éléments enregistrés.
   */
  public count(): number {
    return this.store.size;
  }

  /**
   * Réinitialise le contenu du registre.
   */
  public clear(): void {
    this.store.clear();
  }
}

/**
 * Instance singleton globale du registre de données B31.3.
 * Initialement VIDE (aucune donnée normative inventée).
 */
export const defaultB31_3DataRegistry = new B31_3DataRegistry();
