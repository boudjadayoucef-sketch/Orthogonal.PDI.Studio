/**
 * PDI NORMATIVE ENGINE — NORMATIVE SOURCE DOCUMENT REGISTRY
 * Reference: B31.3-01 (ASME B31.3 Normative Data Foundation)
 * 
 * Registre déterministe, auditable et contrôlé pour le stockage
 * et la consultation des documents sources normatifs (NormativeSourceDocument).
 * 
 * RÈGLES ARCHITECTURALES STRICTES (B31.3-01) :
 * 1. Validation structurelle préalable obligatoire :
 *    - Tout document inséré doit être rigoureusement validé par `validateNormativeSourceDocument`.
 *    - Un document invalide est STRICTEMENT rejeté avec une exception explicite.
 * 2. Contrôle d'unicité et non-mutation :
 *    - L'identifiant `documentId` ne doit jamais être vide.
 *    - Doublon interdit : enregistrer deux fois le même `documentId` est formellement rejeté.
 *    - Aucune modification silencieuse d'un document déjà enregistré.
 * 3. Préservation inviolable des statuts :
 *    - Ne transforme JAMAIS "UNVERIFIED" en "VERIFIED".
 * 4. Interdiction absolue des tokens heuristiques :
 *    - Aucun token heuristique (MAT_CS_*, _CS_, CS_, CRMO, etc.) ne peut servir de documentId.
 * 5. Registre initialement VIDE :
 *    - Aucune donnée ou document ASME/API/ISO n'est inventé ou injecté par défaut.
 */

import type { NormativeSourceDocument } from "../types/normativeSourceDocumentTypes";
import {
  validateNormativeSourceDocument,
} from "../validators/normativeSourceDocumentValidator";
import { isDisallowedTokenHeuristic } from "../validators/normativeEvidenceValidator";

/**
 * Interface du registre des documents sources normatifs.
 */
export interface INormativeSourceDocumentRegistry {
  register(document: NormativeSourceDocument): void;
  get(documentId: string): NormativeSourceDocument | undefined;
  has(documentId: string): boolean;
  list(): readonly NormativeSourceDocument[];
  clear(): void;
  count(): number;
}

/**
 * Implémentation déterministe en mémoire du registre de documents sources normatifs.
 */
export class NormativeSourceDocumentRegistry
  implements INormativeSourceDocumentRegistry {
  private readonly store = new Map<string, NormativeSourceDocument>();

  /**
   * Enregistre un NormativeSourceDocument après validation stricte.
   * 
   * @throws Error si le document est invalide, si l'id est vide, si un token heuristique est utilisé,
   * ou si un doublon de documentId est détecté.
   */
  public register(document: NormativeSourceDocument): void {
    if (!document || typeof document !== "object") {
      throw new Error(
        "SOURCE_DOCUMENT_REGISTRY_ERROR: Cannot register null or non-object document."
      );
    }

    const did = document.documentId;
    if (typeof did !== "string" || did.trim().length === 0) {
      throw new Error(
        "SOURCE_DOCUMENT_REGISTRY_ERROR: documentId must be a non-empty string."
      );
    }

    if (isDisallowedTokenHeuristic(did)) {
      throw new Error(
        `SOURCE_DOCUMENT_REGISTRY_ERROR: Token '${did}' is an identifier/heuristic and cannot be used as a documentId.`
      );
    }

    if (this.store.has(did)) {
      throw new Error(
        `SOURCE_DOCUMENT_REGISTRY_ERROR: Duplicate documentId '${did}' is strictly prohibited. A source document cannot be overwritten.`
      );
    }

    // Validation structurelle complète
    const validation = validateNormativeSourceDocument(document);
    if (!validation.valid) {
      const errorDetails = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      throw new Error(
        `SOURCE_DOCUMENT_REGISTRY_ERROR: Refused invalid source document '${did}'. Structural errors: ${errorDetails}`
      );
    }

    // Stockage immuable (copie superficielle gelée)
    this.store.set(did, Object.freeze({ ...document }));
  }

  /**
   * Récupère un document source normatif par son identifiant.
   */
  public get(documentId: string): NormativeSourceDocument | undefined {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      return undefined;
    }
    return this.store.get(documentId.trim());
  }

  /**
   * Vérifie la présence d'un document source dans le registre.
   */
  public has(documentId: string): boolean {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      return false;
    }
    return this.store.has(documentId.trim());
  }

  /**
   * Liste l'ensemble des documents sources normatifs enregistrés (triés alphabétiquement pour strict déterminisme).
   */
  public list(): readonly NormativeSourceDocument[] {
    const items = Array.from(this.store.values()).sort((a, b) =>
      a.documentId.localeCompare(b.documentId)
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
 * Instance singleton globale du registre de documents sources normatifs PDI.
 * Initialement VIDE (aucune donnée normative inventée).
 */
export const defaultSourceDocumentRegistry =
  new NormativeSourceDocumentRegistry();

/**
 * Documents sources normatifs officiels de référence enregistrés comme sources à venir (Roadmap bibliothèque).
 */
export const UPCOMING_NORMATIVE_SOURCE_DOCUMENTS: readonly NormativeSourceDocument[] = Object.freeze([
  Object.freeze({
    documentId: "DOC-ASME-B31.8-2022",
    title: "ASME B31.8-2022: Gas Transmission and Distribution Piping Systems",
    publisher: "The American Society of Mechanical Engineers (ASME)",
    standardId: "ASME-B31.8",
    editionId: "2022",
    documentReference: "ASME B31.8-2022 (Revision of ASME B31.8-2020), ISBN 978-0-7918-7542-1, Date of Issuance: December 22, 2022",
    status: "UNVERIFIED" as const,
    notes: "Source de référence pour réseaux de transport et distribution gaz haute pression, classes d'emplacement (1-4), calculs MAOP, épreuves hydrostatiques/pneumatiques et service gaz acide (Sour Gas Ch. IX).",
  }),
  Object.freeze({
    documentId: "DOC-ASME-B31.12-2019",
    title: "ASME B31.12-2019: Hydrogen Piping and Pipelines",
    publisher: "The American Society of Mechanical Engineers (ASME)",
    standardId: "ASME-B31.12",
    editionId: "2019",
    documentReference: "ASME B31.12-2019 (Revision of ASME B31.12-2014), ISBN 978-0-7918-7304-5, Date of Issuance: December 20, 2019",
    status: "UNVERIFIED" as const,
    notes: "Source de référence pour tuyauteries industrielles (Part IP) et pipelines de transport (Part PL) d'hydrogène gazeux (GH2) et liquide (LH2), facteurs de dégradation matériau Hf/Mf et contrôle de fragilisation HE.",
  }),
]);

/**
 * Retourne la liste des documents sources normatifs référencés à venir.
 */
export function getUpcomingNormativeSourceDocuments(): readonly NormativeSourceDocument[] {
  return UPCOMING_NORMATIVE_SOURCE_DOCUMENTS;
}

