/**
 * PDI NORMATIVE ENGINE — NORMATIVE EVIDENCE RESOLVER
 * Reference: NORM-09 (Evidence Registry / Resolver)
 * 
 * Résolveur déterministe pour évaluer et vérifier les références d'évidence
 * nécessaires à la qualification normative (Qualification → Evidence).
 * 
 * RÈGLES STRICTES (NORM-09) :
 * 1. Distingue explicitement :
 *    - FOUND_VERIFIED : Trouvé, valide, et verificationStatus === "VERIFIED".
 *    - FOUND_UNVERIFIED : Trouvé mais verificationStatus === "UNVERIFIED" (ne doit JAMAIS être promu).
 *    - NOT_FOUND : Aucun enregistrement trouvé pour cet evidenceId.
 *    - INVALID : Identifiant invalide, vide, ou token heuristique rejeté.
 * 2. Aucune heuristique, aucun pattern matching :
 *    - Ne déduit JAMAIS une évidence à partir d'un nom de matériau ou token.
 * 3. Fournit une fonction de lookup prête pour `validateNormativeQualification`.
 */

import type {
  NormativeEvidence,
  EvidenceResolutionResult,
  EvidenceSetResolutionResult,
  EvidenceResolutionStatus,
} from "../types/normativeEvidenceTypes";
import type { INormativeEvidenceRegistry } from "./normativeEvidenceRegistry";
import { defaultEvidenceRegistry } from "./normativeEvidenceRegistry";
import {
  isDisallowedTokenHeuristic,
  validateNormativeEvidence,
} from "../validators/normativeEvidenceValidator";

export interface INormativeEvidenceResolver {
  resolveEvidence(evidenceId: string): EvidenceResolutionResult;
  resolveEvidenceSet(evidenceIds: readonly string[]): EvidenceSetResolutionResult;
  createLookupFunction(): (evidenceId: string) => NormativeEvidence | undefined;
}

export class NormativeEvidenceResolver implements INormativeEvidenceResolver {
  constructor(private readonly registry: INormativeEvidenceRegistry = defaultEvidenceRegistry) {}

  /**
   * Résout une évidence individuelle et caractérise son statut sans ambiguïté.
   */
  public resolveEvidence(evidenceId: string): EvidenceResolutionResult {
    if (typeof evidenceId !== "string" || evidenceId.trim().length === 0) {
      return {
        evidenceId: String(evidenceId),
        status: "INVALID",
        message: "evidenceId must be a non-empty string.",
      };
    }

    const trimmed = evidenceId.trim();

    if (isDisallowedTokenHeuristic(trimmed)) {
      return {
        evidenceId: trimmed,
        status: "INVALID",
        message: `Token '${trimmed}' is a heuristic token and cannot be resolved as a normative evidence.`,
      };
    }

    const evidence = this.registry.get(trimmed);
    if (!evidence) {
      return {
        evidenceId: trimmed,
        status: "NOT_FOUND",
        message: `Evidence with id '${trimmed}' was not found in registry.`,
      };
    }

    // Double vérification structurelle
    const val = validateNormativeEvidence(evidence);
    if (!val.valid) {
      return {
        evidenceId: trimmed,
        status: "INVALID",
        evidence,
        message: `Evidence with id '${trimmed}' is structurally invalid: ${val.errors.map((e) => e.message).join("; ")}`,
      };
    }

    if (evidence.verificationStatus === "VERIFIED") {
      return {
        evidenceId: trimmed,
        status: "FOUND_VERIFIED",
        evidence,
        message: "Evidence found and confirmed as VERIFIED.",
      };
    }

    return {
      evidenceId: trimmed,
      status: "FOUND_UNVERIFIED",
      evidence,
      message: "Evidence found but has UNVERIFIED status. Cannot support qualification.",
    };
  }

  /**
   * Résout un ensemble de preuves et fournit un bilan consolidé.
   */
  public resolveEvidenceSet(evidenceIds: readonly string[]): EvidenceSetResolutionResult {
    if (!Array.isArray(evidenceIds)) {
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
            evidenceId: "",
            status: "INVALID",
            message: "evidenceIds must be an array of strings.",
          },
        ],
      };
    }

    const results: EvidenceResolutionResult[] = [];
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let notFoundCount = 0;
    let invalidCount = 0;

    for (const eid of evidenceIds) {
      const res = this.resolveEvidence(eid);
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

    const totalRequested = evidenceIds.length;
    const allFound = totalRequested > 0 && notFoundCount === 0 && invalidCount === 0;
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
   * Crée une fonction de lookup compatible avec `validateNormativeQualification`.
   */
  public createLookupFunction(): (evidenceId: string) => NormativeEvidence | undefined {
    return (evidenceId: string): NormativeEvidence | undefined => {
      const res = this.resolveEvidence(evidenceId);
      if (res.status === "FOUND_VERIFIED" || res.status === "FOUND_UNVERIFIED") {
        return res.evidence;
      }
      return undefined;
    };
  }
}

/**
 * Instance singleton globale du résolveur d'évidence normative.
 */
export const defaultEvidenceResolver = new NormativeEvidenceResolver(defaultEvidenceRegistry);
