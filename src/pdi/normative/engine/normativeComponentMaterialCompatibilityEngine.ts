/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT ↔ MATERIAL COMPATIBILITY ENGINE
 * Reference: NORM-14-03 (Component ↔ Material Compatibility)
 * 
 * Adapter typé Component ↔ Material au-dessus de la matrice générique NORM-14-01.
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Délégation exclusive à INormativeCompatibilityMatrixEngine : aucune deuxième source de vérité, aucune règle codée en dur.
 * 2. Mapping strict :
 *    - leftEntity : type = (PIPE | FITTING | FLANGE | VALVE), id = component.componentId
 *    - rightEntity : type = "MATERIAL", id = material.materialId
 * 3. Directionnalité stricte : COMPONENT -> MATERIAL (ne teste pas automatiquement MATERIAL -> COMPONENT).
 * 4. Validation structurelle préalable de la requête.
 * 5. Préservation absolue de la traçabilité : matchedRuleIds et evidenceIds dédupliqués, triés et gelés.
 * 6. Statuts : COMPATIBLE | INCOMPATIBLE | UNVERIFIED | INVALID.
 * 7. Aucune interprétation sémantique, aucune conversion automatique de grade/catégorie de matériau.
 */

import type {
  INormativeComponentMaterialCompatibilityEngine,
  NormativeComponentMaterialCompatibilityQuery,
  NormativeComponentMaterialCompatibilityResult,
} from "../types/normativeComponentMaterialCompatibilityTypes";
import type { INormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { validateNormativeComponentMaterialCompatibilityQuery } from "../validators/normativeComponentMaterialCompatibilityValidator";

export class NormativeComponentMaterialCompatibilityEngine
  implements INormativeComponentMaterialCompatibilityEngine
{
  constructor(
    private readonly matrixEngine: INormativeCompatibilityMatrixEngine
  ) {
    if (!matrixEngine || typeof matrixEngine.resolveCompatibility !== "function") {
      throw new Error(
        "COMPONENT_MATERIAL_COMPATIBILITY_ADAPTER_ERROR: A valid INormativeCompatibilityMatrixEngine instance must be injected."
      );
    }
  }

  /**
   * Évalue la compatibilité normative entre un composant industriel et un matériau.
   * Délègue directement à INormativeCompatibilityMatrixEngine avec leftEntityType = component.componentType et rightEntityType = "MATERIAL".
   */
  public resolveCompatibility(
    query: NormativeComponentMaterialCompatibilityQuery
  ): NormativeComponentMaterialCompatibilityResult {
    // 1. Validation structurelle de la requête
    const validation = validateNormativeComponentMaterialCompatibilityQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      const fallbackComponent =
        query && typeof query === "object" && "component" in query && query.component
          ? Object.freeze({ ...query.component })
          : Object.freeze({ componentType: "PIPE" as const, componentId: "" });

      const fallbackMaterial =
        query && typeof query === "object" && "material" in query && query.material
          ? Object.freeze({ ...query.material })
          : Object.freeze({ materialId: "" });

      return Object.freeze({
        status: "INVALID",
        component: fallbackComponent,
        material: fallbackMaterial,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_COMPONENT_MATERIAL_COMPATIBILITY_QUERY: ${errorMsg}`,
      });
    }

    // 2. Délégation directe à NORM-14-01 (direction COMPONENT -> MATERIAL)
    const matrixResult = this.matrixEngine.resolveCompatibility(
      query.component.componentType,
      query.component.componentId,
      "MATERIAL",
      query.material.materialId
    );

    // 3. Mapping déterministe et gelé vers le contrat NORM-14-03
    const sortedMatchedRuleIds = Array.from(new Set(matrixResult.matchedRuleIds)).sort();
    const sortedEvidenceIds = Array.from(new Set(matrixResult.evidenceIds)).sort();

    return Object.freeze({
      status: matrixResult.status,
      component: Object.freeze({
        componentType: query.component.componentType,
        componentId: query.component.componentId,
      }),
      material: Object.freeze({
        materialId: query.material.materialId,
      }),
      matchedRuleIds: Object.freeze(sortedMatchedRuleIds),
      evidenceIds: Object.freeze(sortedEvidenceIds),
      message: matrixResult.message ?? `Resolution complete with status ${matrixResult.status}.`,
      conflictCode: matrixResult.conflictCode,
    });
  }
}
