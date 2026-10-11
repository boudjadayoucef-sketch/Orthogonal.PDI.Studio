/**
 * PDI NORMATIVE ENGINE — NORMATIVE SPEC ↔ COMPATIBILITY INTEGRATION ENGINE
 * Reference: NORM-14-08 (Integration with SPEC-01)
 * 
 * Moteur d'intégration déterministe reliant la résolution de spécification (SPEC-01)
 * et la résolution multi-compatibilité (NORM-14-07).
 * 
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Orchestration & intégration pures : délègue la compatibilité à NORM-14-07 sans la recalculer.
 * 2. NORM-14-01 reste l'unique source de vérité pour la compatibilité normative.
 * 3. SPEC-01 reste l'unique source de vérité pour les règles de Piping Spec.
 * 4. Aucune deuxième source de vérité, aucune règle codée en dur, aucun second registre.
 * 5. Directionnalité stricte (pas d'inversion automatique).
 * 6. Préservation absolue de la traçabilité : union, déduplication, tri et gel des matchedRuleIds, evidenceIds et conflictCodes.
 * 7. Consolidation des statuts : INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE.
 * 8. Aucune promotion d'évidence, aucun fuzzy matching, aucun ranking.
 */

import type {
  INormativeSpecCompatibilityIntegrationEngine,
  NormativeSpecCompatibilityIntegrationQuery,
  NormativeSpecCompatibilityIntegrationResult,
  NormativeSpecCompatibilityIntegrationStatus,
} from "../types/normativeSpecCompatibilityIntegrationTypes";
import type { INormativeMultiCompatibilityEngine } from "../types/normativeMultiCompatibilityTypes";
import { validateNormativeSpecCompatibilityIntegrationQuery } from "../validators/normativeSpecCompatibilityIntegrationValidator";

export class NormativeSpecCompatibilityIntegrationEngine
  implements INormativeSpecCompatibilityIntegrationEngine
{
  constructor(
    private readonly multiCompatibilityEngine: INormativeMultiCompatibilityEngine
  ) {
    if (
      !multiCompatibilityEngine ||
      typeof multiCompatibilityEngine.resolveCompatibility !== "function"
    ) {
      throw new Error(
        "SPEC_COMPATIBILITY_INTEGRATION_ENGINE_ERROR: A valid INormativeMultiCompatibilityEngine instance must be injected."
      );
    }
  }

  /**
   * Résout l'intégration contrôlée entre une résolution SPEC-01 et un ensemble de contraintes multi-compatibilité NORM-14-07.
   */
  public resolve(
    query: NormativeSpecCompatibilityIntegrationQuery
  ): NormativeSpecCompatibilityIntegrationResult {
    // 1. Validation structurelle de la requête
    const validation = validateNormativeSpecCompatibilityIntegrationQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      const fallbackSpec =
        query && typeof query === "object" && "specResolution" in query && query.specResolution
          ? Object.freeze({ ...query.specResolution })
          : Object.freeze({
              status: "INVALID" as const,
              specificationId: "",
              componentType: "",
              matchedRuleIds: Object.freeze([]),
              compatibilityRuleIds: Object.freeze([]),
              evidenceIds: Object.freeze([]),
            });

      const fallbackCompatibilityResult = Object.freeze({
        status: "INVALID" as const,
        constraintResults: Object.freeze([]),
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: "Query validation failed.",
        conflictCodes: Object.freeze(["INVALID_SPEC_COMPATIBILITY_INTEGRATION_QUERY"]),
      });

      return Object.freeze({
        status: "INVALID",
        specResolution: fallbackSpec,
        compatibilityResult: fallbackCompatibilityResult,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_SPEC_COMPATIBILITY_INTEGRATION_QUERY: ${errorMsg}`,
        conflictCodes: Object.freeze(["INVALID_SPEC_COMPATIBILITY_INTEGRATION_QUERY"]),
      });
    }

    // 2. Délégation exclusive de la compatibilité à NORM-14-07
    const compatibilityResult = this.multiCompatibilityEngine.resolveCompatibility(
      query.compatibilityQuery
    );

    // 3. Consolidation déterministe des statuts : INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE
    const specStatus = query.specResolution.status;
    const compatStatus = compatibilityResult.status;

    let finalStatus: NormativeSpecCompatibilityIntegrationStatus = "COMPATIBLE";

    if (specStatus === "INVALID" || compatStatus === "INVALID") {
      finalStatus = "INVALID";
    } else if (specStatus === "INCOMPATIBLE" || compatStatus === "INCOMPATIBLE") {
      finalStatus = "INCOMPATIBLE";
    } else if (specStatus === "UNVERIFIED" || compatStatus === "UNVERIFIED") {
      finalStatus = "UNVERIFIED";
    } else {
      finalStatus = "COMPATIBLE";
    }

    // 4. Traçabilité globale intégrée : union des règles, évidences et conflits
    const allRuleIds: string[] = [
      ...(query.specResolution.matchedRuleIds || []),
      ...(query.specResolution.compatibilityRuleIds || []),
      ...compatibilityResult.matchedRuleIds,
    ];

    const allEvidenceIds: string[] = [
      ...(query.specResolution.evidenceIds || []),
      ...compatibilityResult.evidenceIds,
    ];

    const allConflictCodes: string[] = [...compatibilityResult.conflictCodes];

    const sortedMatchedRuleIds = Object.freeze(Array.from(new Set(allRuleIds)).sort());
    const sortedEvidenceIds = Object.freeze(Array.from(new Set(allEvidenceIds)).sort());
    const sortedConflictCodes = Object.freeze(Array.from(new Set(allConflictCodes)).sort());

    const message = `Spec resolution '${specStatus}' integrated with compatibility '${compatStatus}' -> Consolidated status '${finalStatus}'.`;

    return Object.freeze({
      status: finalStatus,
      specResolution: Object.freeze({ ...query.specResolution }),
      compatibilityResult,
      matchedRuleIds: sortedMatchedRuleIds,
      evidenceIds: sortedEvidenceIds,
      message,
      conflictCodes: sortedConflictCodes,
    });
  }
}
