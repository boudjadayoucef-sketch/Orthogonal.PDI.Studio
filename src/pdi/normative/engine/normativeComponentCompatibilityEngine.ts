/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT COMPATIBILITY ENGINE
 * Reference: NORM-14-02 (Component Compatibility Adapter)
 * 
 * Adapter typé Component ↔ Component au-dessus de la matrice générique NORM-14-01.
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Délégation exclusive à INormativeCompatibilityMatrixEngine : aucune duplication de logique de matching.
 * 2. Restriction aux entités composant : ("PIPE" | "FITTING" | "FLANGE" | "VALVE").
 * 3. Validation structurelle préalable de la requête (left et right).
 * 4. Préservation stricte de la directionnalité : query.left -> query.right.
 * 5. Mapping déterministe et direct des statuts (COMPATIBLE, INCOMPATIBLE, UNVERIFIED, INVALID).
 * 6. Traçabilité complète et immuabilité : matchedRuleIds et evidenceIds dédupliqués, triés et gelés.
 * 7. Aucun fuzzy matching, aucun ranking, aucune conversion automatique, aucune promotion d'évidence.
 */

import type {
  INormativeComponentCompatibilityEngine,
  NormativeComponentCompatibilityQuery,
  NormativeComponentCompatibilityResult,
} from "../types/normativeComponentCompatibilityTypes";
import type { INormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { validateNormativeComponentCompatibilityQuery } from "../validators/normativeComponentCompatibilityValidator";

export class NormativeComponentCompatibilityEngine implements INormativeComponentCompatibilityEngine {
  constructor(
    private readonly matrixEngine: INormativeCompatibilityMatrixEngine
  ) {
    if (!matrixEngine || typeof matrixEngine.resolveCompatibility !== "function") {
      throw new Error(
        "COMPONENT_COMPATIBILITY_ADAPTER_ERROR: A valid INormativeCompatibilityMatrixEngine instance must be injected."
      );
    }
  }

  /**
   * Évalue la compatibilité normative entre deux composants de tuyauterie.
   * Délègue directement à INormativeCompatibilityMatrixEngine et mappe le résultat vers le contrat NORM-14-02.
   */
  public resolveCompatibility(
    query: NormativeComponentCompatibilityQuery
  ): NormativeComponentCompatibilityResult {
    // 1. Validation de la requête
    const validation = validateNormativeComponentCompatibilityQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      const fallbackLeft = (query && typeof query === "object" && "left" in query && query.left)
        ? Object.freeze({ ...query.left })
        : Object.freeze({ componentType: "PIPE" as const, componentId: "" });

      const fallbackRight = (query && typeof query === "object" && "right" in query && query.right)
        ? Object.freeze({ ...query.right })
        : Object.freeze({ componentType: "PIPE" as const, componentId: "" });

      return Object.freeze({
        status: "INVALID",
        left: fallbackLeft,
        right: fallbackRight,
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_COMPONENT_COMPATIBILITY_QUERY: ${errorMsg}`,
      });
    }

    // 2. Délégation directe à NORM-14-01
    const matrixResult = this.matrixEngine.resolveCompatibility(
      query.left.componentType,
      query.left.componentId,
      query.right.componentType,
      query.right.componentId
    );

    // 3. Mapping déterministe vers le contrat NORM-14-02
    const sortedMatchedRuleIds = Array.from(new Set(matrixResult.matchedRuleIds)).sort();
    const sortedEvidenceIds = Array.from(new Set(matrixResult.evidenceIds)).sort();

    return Object.freeze({
      status: matrixResult.status,
      left: Object.freeze({
        componentType: query.left.componentType,
        componentId: query.left.componentId,
      }),
      right: Object.freeze({
        componentType: query.right.componentType,
        componentId: query.right.componentId,
      }),
      matchedRuleIds: Object.freeze(sortedMatchedRuleIds),
      evidenceIds: Object.freeze(sortedEvidenceIds),
      message: matrixResult.message,
      conflictCode: matrixResult.conflictCode,
    });
  }
}

/**
 * Alias conforme à l'architecture cible spécifiée dans NORM-14-02.
 */
export { NormativeComponentCompatibilityEngine as ComponentCompatibilityAdapter };
