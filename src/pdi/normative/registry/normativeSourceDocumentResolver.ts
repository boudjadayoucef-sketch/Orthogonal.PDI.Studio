/**
 * PDI NORMATIVE ENGINE — NORMATIVE SOURCE DOCUMENT RESOLVER
 * Reference: B31.3-01 (ASME B31.3 Normative Data Foundation)
 * 
 * Résolveur déterministe pour évaluer et vérifier les documents sources normatifs
 * nécessaires à l'ancrage documentaire de l'évidence.
 * 
 * RÈGLES STRICTES (B31.3-01) :
 * 1. Distingue explicitement :
 *    - FOUND_VERIFIED : Trouvé, valide, et status === "VERIFIED".
 *    - FOUND_UNVERIFIED : Trouvé mais status === "UNVERIFIED" (ne doit JAMAIS être promu).
 *    - NOT_FOUND : Aucun enregistrement trouvé pour ce documentId.
 *    - INVALID : Identifiant invalide, vide, ou token heuristique rejeté.
 * 2. Aucune heuristique, aucun pattern matching :
 *    - Ne déduit JAMAIS un document à partir d'un nom de matériau, token ou commentaire.
 * 3. Strictement déterministe et immuable.
 */

import type {
  NormativeSourceDocument,
  SourceDocumentResolutionResult,
  SourceDocumentSetResolutionResult,
} from "../types/normativeSourceDocumentTypes";
import type { INormativeSourceDocumentRegistry } from "./normativeSourceDocumentRegistry";
import { defaultSourceDocumentRegistry } from "./normativeSourceDocumentRegistry";
import { isDisallowedTokenHeuristic } from "../validators/normativeEvidenceValidator";
import { validateNormativeSourceDocument } from "../validators/normativeSourceDocumentValidator";

export interface INormativeSourceDocumentResolver {
  resolveDocument(documentId: string): SourceDocumentResolutionResult;
  resolveDocumentSet(
    documentIds: readonly string[]
  ): SourceDocumentSetResolutionResult;
  createLookupFunction(): (
    documentId: string
  ) => NormativeSourceDocument | undefined;
}

export class NormativeSourceDocumentResolver
  implements INormativeSourceDocumentResolver {
  constructor(
    private readonly registry: INormativeSourceDocumentRegistry = defaultSourceDocumentRegistry
  ) {}

  /**
   * Résout un document source individuel et caractérise son statut sans ambiguïté.
   */
  public resolveDocument(documentId: string): SourceDocumentResolutionResult {
    if (typeof documentId !== "string" || documentId.trim().length === 0) {
      return {
        documentId: String(documentId),
        status: "INVALID",
        message: "documentId must be a non-empty string.",
      };
    }

    const trimmed = documentId.trim();

    if (isDisallowedTokenHeuristic(trimmed)) {
      return {
        documentId: trimmed,
        status: "INVALID",
        message: `Token '${trimmed}' is a heuristic token and cannot be resolved as a source document.`,
      };
    }

    const document = this.registry.get(trimmed);
    if (!document) {
      return {
        documentId: trimmed,
        status: "NOT_FOUND",
        message: `Source document with id '${trimmed}' was not found in registry.`,
      };
    }

    // Double vérification structurelle
    const val = validateNormativeSourceDocument(document);
    if (!val.valid) {
      return {
        documentId: trimmed,
        status: "INVALID",
        document,
        message: `Source document with id '${trimmed}' is structurally invalid: ${val.errors
          .map((e) => e.message)
          .join("; ")}`,
      };
    }

    if (document.status === "VERIFIED") {
      return {
        documentId: trimmed,
        status: "FOUND_VERIFIED",
        document,
        message: "Source document found and confirmed as VERIFIED.",
      };
    }

    return {
      documentId: trimmed,
      status: "FOUND_UNVERIFIED",
      document,
      message:
        "Source document found but has UNVERIFIED status. Cannot support verified qualification.",
    };
  }

  /**
   * Résout un ensemble de documents sources et fournit un bilan consolidé.
   */
  public resolveDocumentSet(
    documentIds: readonly string[]
  ): SourceDocumentSetResolutionResult {
    if (!Array.isArray(documentIds)) {
      return {
        allFound: false,
        allVerified: false,
        valid: false,
        totalRequested: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        notFoundCount: 0,
        invalidCount: 1,
        results: [
          {
            documentId: "",
            status: "INVALID",
            message: "documentIds must be an array of strings.",
          },
        ],
      };
    }

    const results: SourceDocumentResolutionResult[] = [];
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let notFoundCount = 0;
    let invalidCount = 0;

    for (const did of documentIds) {
      const res = this.resolveDocument(did);
      results.push(res);

      switch (res.status) {
        case "FOUND_VERIFIED":
          verifiedCount++;
          break;
        case "FOUND_UNVERIFIED":
          unverifiedCount++;
          break;
        case "NOT_FOUND":
          notFoundCount++;
          break;
        case "INVALID":
          invalidCount++;
          break;
      }
    }

    const totalRequested = documentIds.length;
    const allFound =
      totalRequested > 0 && notFoundCount === 0 && invalidCount === 0;
    const allVerified = totalRequested > 0 && verifiedCount === totalRequested;
    const valid = invalidCount === 0;

    return {
      allFound,
      allVerified,
      valid,
      totalRequested,
      verifiedCount,
      unverifiedCount,
      notFoundCount,
      invalidCount,
      results: Object.freeze(results),
    };
  }

  /**
   * Crée une fonction de lookup prête à l'emploi.
   */
  public createLookupFunction(): (
    documentId: string
  ) => NormativeSourceDocument | undefined {
    return (documentId: string): NormativeSourceDocument | undefined => {
      const res = this.resolveDocument(documentId);
      if (res.status === "FOUND_VERIFIED" || res.status === "FOUND_UNVERIFIED") {
        return res.document;
      }
      return undefined;
    };
  }
}

/**
 * Instance singleton globale du résolveur de documents sources normatifs.
 */
export const defaultSourceDocumentResolver =
  new NormativeSourceDocumentResolver(defaultSourceDocumentRegistry);
