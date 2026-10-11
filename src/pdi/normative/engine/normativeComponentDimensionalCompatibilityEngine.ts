/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ DIMENSIONAL STANDARD COMPATIBILITY ENGINE
 * Reference: NORM-14-05 (Component ↔ Dimensional Standard Compatibility)
 * 
 * Adapter typé Component ↔ Dimensional Standard au-dessus de la matrice générique NORM-14-01.
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Délégation exclusive à INormativeCompatibilityMatrixEngine : aucune deuxième source de vérité, aucune règle codée en dur.
 * 2. Mapping strict :
 *    - leftEntity : type = (PIPE | FITTING | FLANGE | VALVE), id = component.componentId
 *    - rightEntity : type = "DIMENSIONAL_STANDARD", id = dimensionalStandard.dimensionalStandardId
 * 3. Directionnalité stricte : COMPONENT -> DIMENSIONAL_STANDARD (ne teste pas automatiquement DIMENSIONAL_STANDARD -> COMPONENT).
 * 4. Validation structurelle préalable de la requête.
 * 5. Préservation absolue de la traçabilité : matchedRuleIds et evidenceIds dédupliqués, triés et gelés.
 * 6. Statuts : COMPATIBLE | INCOMPATIBLE | UNVERIFIED | INVALID.
 * 7. Aucune interprétation sémantique, aucune conversion automatique NPS ↔ DN, schedule ou épaisseur.
 */

import type {
  INormativeComponentDimensionalCompatibilityEngine,
  NormativeComponentDimensionalCompatibilityQuery,
  NormativeComponentDimensionalCompatibilityResult,
} from "../types/normativeComponentDimensionalCompatibilityTypes";
import type { INormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { validateNormativeComponentDimensionalCompatibilityQuery } from "../validators/normativeComponentDimensionalCompatibilityValidator";

export class NormativeComponentDimensionalCompatibilityEngine
  implements INormativeComponentDimensionalCompatibilityEngine
{
  constructor(
    private readonly matrixEngine: INormativeCompatibilityMatrixEngine
  ) {
    if (!matrixEngine || typeof matrixEngine.resolveCompatibility !== "function") {
      throw new Error(
        "COMPONENT_DIMENSIONAL_COMPATIBILITY_ADAPTER_ERROR: A valid INormativeCompatibilityMatrixEngine instance must be injected."
      );
    }
  }

  /**
   * Évalue la compatibilité normative entre un composant industriel et un standard dimensionnel.
   * Délègue directement à INormativeCompatibilityMatrixEngine avec leftEntityType = component.componentType et rightEntityType = "DIMENSIONAL_STANDARD".
   */
  public resolveCompatibility(
    query: NormativeComponentDimensionalCompatibilityQuery
  ): NormativeComponentDimensionalCompatibilityResult {
    // 1. Validation structurelle de la requête
    const validation = validateNormativeComponentDimensionalCompatibilityQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      const fallbackComponent =
        query && typeof query === "object" && "component" in query && query.component
          ? Object.freeze({ ...query.component })
          : Object.freeze({ componentType: "PIPE" as const, componentId: "" });

      const fallbackDimensionalStandard =
        query && typeof query === "object" && "dimensionalStandard" in query && query.dimensionalStandard
          ? Object.freeze({ ...query.dimensionalStandard })
          : Object.freeze({ dimensionalStandardId: "" });

      return Object.freeze({
        status: "INVALID",
        component: fallbackComponent,
        dimensionalStandard: fallbackDimensionalStandard,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_COMPONENT_DIMENSIONAL_COMPATIBILITY_QUERY: ${errorMsg}`,
      });
    }

    // 2. Délégation directe à NORM-14-01 (direction COMPONENT -> DIMENSIONAL_STANDARD)
    const matrixResult = this.matrixEngine.resolveCompatibility(
      query.component.componentType,
      query.component.componentId,
      "DIMENSIONAL_STANDARD",
      query.dimensionalStandard.dimensionalStandardId
    );

    // 3. Mapping déterministe et gelé vers le contrat NORM-14-05
    const sortedMatchedRuleIds = Array.from(new Set(matrixResult.matchedRuleIds)).sort();
    const sortedEvidenceIds = Array.from(new Set(matrixResult.evidenceIds)).sort();

    return Object.freeze({
      status: matrixResult.status,
      component: Object.freeze({
        componentType: query.component.componentType,
        componentId: query.component.componentId,
      }),
      dimensionalStandard: Object.freeze({
        dimensionalStandardId: query.dimensionalStandard.dimensionalStandardId,
      }),
      matchedRuleIds: Object.freeze(sortedMatchedRuleIds),
      evidenceIds: Object.freeze(sortedEvidenceIds),
      message: matrixResult.message ?? `Resolution complete with status ${matrixResult.status}.`,
      conflictCode: matrixResult.conflictCode,
    });
  }
}
