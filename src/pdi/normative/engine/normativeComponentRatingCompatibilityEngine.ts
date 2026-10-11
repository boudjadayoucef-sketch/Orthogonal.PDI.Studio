/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ RATING COMPATIBILITY ENGINE
 * Reference: NORM-14-04 (Component ↔ Rating / Pressure Rating Compatibility)
 * 
 * Adapter typé Component ↔ Rating au-dessus de la matrice générique NORM-14-01.
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Délégation exclusive à INormativeCompatibilityMatrixEngine : aucune deuxième source de vérité, aucune règle codée en dur.
 * 2. Mapping strict :
 *    - leftEntity : type = (PIPE | FITTING | FLANGE | VALVE), id = component.componentId
 *    - rightEntity : type = "RATING", id = rating.ratingId
 * 3. Directionnalité stricte : COMPONENT -> RATING (ne teste pas automatiquement RATING -> COMPONENT).
 * 4. Validation structurelle préalable de la requête.
 * 5. Préservation absolue de la traçabilité : matchedRuleIds et evidenceIds dédupliqués, triés et gelés.
 * 6. Statuts : COMPATIBLE | INCOMPATIBLE | UNVERIFIED | INVALID.
 * 7. Aucune interprétation sémantique, aucune conversion automatique Class ↔ PN ou de pression.
 */

import type {
  INormativeComponentRatingCompatibilityEngine,
  NormativeComponentRatingCompatibilityQuery,
  NormativeComponentRatingCompatibilityResult,
} from "../types/normativeComponentRatingCompatibilityTypes";
import type { INormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { validateNormativeComponentRatingCompatibilityQuery } from "../validators/normativeComponentRatingCompatibilityValidator";

export class NormativeComponentRatingCompatibilityEngine
  implements INormativeComponentRatingCompatibilityEngine
{
  constructor(
    private readonly matrixEngine: INormativeCompatibilityMatrixEngine
  ) {
    if (!matrixEngine || typeof matrixEngine.resolveCompatibility !== "function") {
      throw new Error(
        "COMPONENT_RATING_COMPATIBILITY_ADAPTER_ERROR: A valid INormativeCompatibilityMatrixEngine instance must be injected."
      );
    }
  }

  /**
   * Évalue la compatibilité normative entre un composant industriel et un rating de pression.
   * Délègue directement à INormativeCompatibilityMatrixEngine avec leftEntityType = component.componentType et rightEntityType = "RATING".
   */
  public resolveCompatibility(
    query: NormativeComponentRatingCompatibilityQuery
  ): NormativeComponentRatingCompatibilityResult {
    // 1. Validation structurelle de la requête
    const validation = validateNormativeComponentRatingCompatibilityQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      const fallbackComponent =
        query && typeof query === "object" && "component" in query && query.component
          ? Object.freeze({ ...query.component })
          : Object.freeze({ componentType: "PIPE" as const, componentId: "" });

      const fallbackRating =
        query && typeof query === "object" && "rating" in query && query.rating
          ? Object.freeze({ ...query.rating })
          : Object.freeze({ ratingId: "" });

      return Object.freeze({
        status: "INVALID",
        component: fallbackComponent,
        rating: fallbackRating,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_COMPONENT_RATING_COMPATIBILITY_QUERY: ${errorMsg}`,
      });
    }

    // 2. Délégation directe à NORM-14-01 (direction COMPONENT -> RATING)
    const matrixResult = this.matrixEngine.resolveCompatibility(
      query.component.componentType,
      query.component.componentId,
      "RATING",
      query.rating.ratingId
    );

    // 3. Mapping déterministe et gelé vers le contrat NORM-14-04
    const sortedMatchedRuleIds = Array.from(new Set(matrixResult.matchedRuleIds)).sort();
    const sortedEvidenceIds = Array.from(new Set(matrixResult.evidenceIds)).sort();

    return Object.freeze({
      status: matrixResult.status,
      component: Object.freeze({
        componentType: query.component.componentType,
        componentId: query.component.componentId,
      }),
      rating: Object.freeze({
        ratingId: query.rating.ratingId,
      }),
      matchedRuleIds: Object.freeze(sortedMatchedRuleIds),
      evidenceIds: Object.freeze(sortedEvidenceIds),
      message: matrixResult.message ?? `Resolution complete with status ${matrixResult.status}.`,
      conflictCode: matrixResult.conflictCode,
    });
  }
}
