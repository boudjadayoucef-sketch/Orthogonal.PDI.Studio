/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ PRODUCT STANDARD COMPATIBILITY ENGINE
 * Reference: NORM-14-06 (Component ↔ Product Standard Compatibility)
 * 
 * Adapter typé Component ↔ Product Standard au-dessus de la matrice générique NORM-14-01.
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Délégation exclusive à INormativeCompatibilityMatrixEngine : aucune deuxième source de vérité, aucune règle codée en dur.
 * 2. Mapping strict :
 *    - leftEntity : type = (PIPE | FITTING | FLANGE | VALVE), id = component.componentId
 *    - rightEntity : type = "PRODUCT_STANDARD", id = productStandard.productStandardId
 * 3. Directionnalité stricte : COMPONENT -> PRODUCT_STANDARD (ne teste pas automatiquement PRODUCT_STANDARD -> COMPONENT).
 * 4. Validation structurelle préalable de la requête.
 * 5. Préservation absolue de la traçabilité : matchedRuleIds et evidenceIds dédupliqués, triés et gelés.
 * 6. Statuts : COMPATIBLE | INCOMPATIBLE | UNVERIFIED | INVALID.
 * 7. Aucune interprétation sémantique, aucune conversion automatique standard ou dimensions.
 */

import type {
  INormativeComponentProductCompatibilityEngine,
  NormativeComponentProductCompatibilityQuery,
  NormativeComponentProductCompatibilityResult,
} from "../types/normativeComponentProductCompatibilityTypes";
import type { INormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { validateNormativeComponentProductCompatibilityQuery } from "../validators/normativeComponentProductCompatibilityValidator";

export class NormativeComponentProductCompatibilityEngine
  implements INormativeComponentProductCompatibilityEngine
{
  constructor(
    private readonly matrixEngine: INormativeCompatibilityMatrixEngine
  ) {
    if (!matrixEngine || typeof matrixEngine.resolveCompatibility !== "function") {
      throw new Error(
        "COMPONENT_PRODUCT_COMPATIBILITY_ADAPTER_ERROR: A valid INormativeCompatibilityMatrixEngine instance must be injected."
      );
    }
  }

  /**
   * Évalue la compatibilité normative entre un composant industriel et un standard produit.
   * Délègue directement à INormativeCompatibilityMatrixEngine avec leftEntityType = component.componentType et rightEntityType = "PRODUCT_STANDARD".
   */
  public resolveCompatibility(
    query: NormativeComponentProductCompatibilityQuery
  ): NormativeComponentProductCompatibilityResult {
    // 1. Validation structurelle de la requête
    const validation = validateNormativeComponentProductCompatibilityQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      const fallbackComponent =
        query && typeof query === "object" && "component" in query && query.component
          ? Object.freeze({ ...query.component })
          : Object.freeze({ componentType: "PIPE" as const, componentId: "" });

      const fallbackProductStandard =
        query && typeof query === "object" && "productStandard" in query && query.productStandard
          ? Object.freeze({ ...query.productStandard })
          : Object.freeze({ productStandardId: "" });

      return Object.freeze({
        status: "INVALID",
        component: fallbackComponent,
        productStandard: fallbackProductStandard,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_COMPONENT_PRODUCT_COMPATIBILITY_QUERY: ${errorMsg}`,
      });
    }

    // 2. Délégation directe à NORM-14-01 (direction COMPONENT -> PRODUCT_STANDARD)
    const matrixResult = this.matrixEngine.resolveCompatibility(
      query.component.componentType,
      query.component.componentId,
      "PRODUCT_STANDARD",
      query.productStandard.productStandardId
    );

    // 3. Mapping déterministe et gelé vers le contrat NORM-14-06
    const sortedMatchedRuleIds = Array.from(new Set(matrixResult.matchedRuleIds)).sort();
    const sortedEvidenceIds = Array.from(new Set(matrixResult.evidenceIds)).sort();

    return Object.freeze({
      status: matrixResult.status,
      component: Object.freeze({
        componentType: query.component.componentType,
        componentId: query.component.componentId,
      }),
      productStandard: Object.freeze({
        productStandardId: query.productStandard.productStandardId,
      }),
      matchedRuleIds: Object.freeze(sortedMatchedRuleIds),
      evidenceIds: Object.freeze(sortedEvidenceIds),
      message: matrixResult.message ?? `Resolution complete with status ${matrixResult.status}.`,
      conflictCode: matrixResult.conflictCode,
    });
  }
}
