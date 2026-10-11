/**
 * PDI NORMATIVE ENGINE — NORMATIVE MULTI-COMPATIBILITY ENGINE
 * Reference: NORM-14-07 (Multi-compatibility Resolution)
 * 
 * Orchestrateur déterministe pour l'évaluation multi-contraintes de compatibilité normative.
 * RÈGLES DE CONCEPTION STRICTES :
 * 1. Orchestrateur pur : délègue exclusivement aux adaptateurs existants (NORM-14-02 à NORM-14-06).
 * 2. Aucune seconde source de vérité, aucune règle codée en dur, aucun second registre.
 * 3. Directionnalité stricte (pas d'inversion automatique).
 * 4. Validation structurelle préalable de la requête et des contraintes.
 * 5. Préservation absolue de la traçabilité : union, déduplication, tri et gel des matchedRuleIds, evidenceIds et conflictCodes.
 * 6. Calcul déterministe du statut global : INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE.
 * 7. Aucune interprétation sémantique, aucun fuzzy matching, aucun ranking, aucune promotion d'évidence.
 */

import type {
  INormativeMultiCompatibilityEngine,
  NormativeMultiCompatibilityConstraint,
  NormativeMultiCompatibilityConstraintResult,
  NormativeMultiCompatibilityQuery,
  NormativeMultiCompatibilityResult,
  NormativeMultiCompatibilityStatus,
} from "../types/normativeMultiCompatibilityTypes";
import type { INormativeComponentCompatibilityEngine } from "../types/normativeComponentCompatibilityTypes";
import type { INormativeComponentMaterialCompatibilityEngine } from "../types/normativeComponentMaterialCompatibilityTypes";
import type { INormativeComponentRatingCompatibilityEngine } from "../types/normativeComponentRatingCompatibilityTypes";
import type { INormativeComponentDimensionalCompatibilityEngine } from "../types/normativeComponentDimensionalCompatibilityTypes";
import type { INormativeComponentProductCompatibilityEngine } from "../types/normativeComponentProductCompatibilityTypes";
import {
  ALLOWED_COMPONENT_ENTITY_TYPES,
  validateNormativeMultiCompatibilityQuery,
} from "../validators/normativeMultiCompatibilityValidator";

export class NormativeMultiCompatibilityEngine
  implements INormativeMultiCompatibilityEngine
{
  constructor(
    private readonly componentEngine: INormativeComponentCompatibilityEngine,
    private readonly materialEngine: INormativeComponentMaterialCompatibilityEngine,
    private readonly ratingEngine: INormativeComponentRatingCompatibilityEngine,
    private readonly dimensionalEngine: INormativeComponentDimensionalCompatibilityEngine,
    private readonly productEngine: INormativeComponentProductCompatibilityEngine
  ) {
    if (
      !componentEngine ||
      typeof componentEngine.resolveCompatibility !== "function" ||
      !materialEngine ||
      typeof materialEngine.resolveCompatibility !== "function" ||
      !ratingEngine ||
      typeof ratingEngine.resolveCompatibility !== "function" ||
      !dimensionalEngine ||
      typeof dimensionalEngine.resolveCompatibility !== "function" ||
      !productEngine ||
      typeof productEngine.resolveCompatibility !== "function"
    ) {
      throw new Error(
        "MULTI_COMPATIBILITY_ENGINE_ERROR: All adapter engines (component, material, rating, dimensional, product) must be injected and implement resolveCompatibility."
      );
    }
  }

  /**
   * Évalue simultanément un ensemble de contraintes normatives pour un composant industriel.
   * Consolide le statut global selon l'ordre strict de priorité : INVALID > INCOMPATIBLE > UNVERIFIED > COMPATIBLE.
   */
  public resolveCompatibility(
    query: NormativeMultiCompatibilityQuery
  ): NormativeMultiCompatibilityResult {
    // 1. Validation structurelle préalable de la requête globale
    const validation = validateNormativeMultiCompatibilityQuery(query);

    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");

      return Object.freeze({
        status: "INVALID",
        constraintResults: Object.freeze([]),
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `INVALID_MULTI_COMPATIBILITY_QUERY: ${errorMsg}`,
        conflictCodes: Object.freeze(["INVALID_MULTI_COMPATIBILITY_QUERY"]),
      });
    }

    // 2. Traitement de chaque contrainte via son adapter respectif
    const constraintResults: NormativeMultiCompatibilityConstraintResult[] = [];
    const allRuleIds: string[] = [];
    const allEvidenceIds: string[] = [];
    const allConflictCodes: string[] = [];

    for (const constraint of query.constraints) {
      const cr = this.resolveSingleConstraint(constraint);
      constraintResults.push(cr);

      allRuleIds.push(...cr.matchedRuleIds);
      allEvidenceIds.push(...cr.evidenceIds);
      if (cr.conflictCode) {
        allConflictCodes.push(cr.conflictCode);
      }
    }

    // 3. Calcul déterministe du statut global
    let globalStatus: NormativeMultiCompatibilityStatus = "COMPATIBLE";
    if (constraintResults.some((r) => r.status === "INVALID")) {
      globalStatus = "INVALID";
    } else if (constraintResults.some((r) => r.status === "INCOMPATIBLE")) {
      globalStatus = "INCOMPATIBLE";
    } else if (constraintResults.some((r) => r.status === "UNVERIFIED")) {
      globalStatus = "UNVERIFIED";
    } else {
      globalStatus = "COMPATIBLE";
    }

    // 4. Traçabilité globale : union, déduplication et tri alphabétique
    const sortedMatchedRuleIds = Object.freeze(Array.from(new Set(allRuleIds)).sort());
    const sortedEvidenceIds = Object.freeze(Array.from(new Set(allEvidenceIds)).sort());
    const sortedConflictCodes = Object.freeze(Array.from(new Set(allConflictCodes)).sort());

    return Object.freeze({
      status: globalStatus,
      constraintResults: Object.freeze(constraintResults),
      matchedRuleIds: sortedMatchedRuleIds,
      evidenceIds: sortedEvidenceIds,
      message: `Multi-compatibility resolution completed with status '${globalStatus}' across ${constraintResults.length} constraint(s).`,
      conflictCodes: sortedConflictCodes,
    });
  }

  /**
   * Résout une contrainte individuelle en déléguant à l'adapter typé compétent.
   */
  private resolveSingleConstraint(
    constraint: NormativeMultiCompatibilityConstraint
  ): NormativeMultiCompatibilityConstraintResult {
    // Vérification de l'entité gauche : doit être une famille de composants autorisée
    if (!ALLOWED_COMPONENT_ENTITY_TYPES.includes(constraint.left.entityType)) {
      return Object.freeze({
        constraint: Object.freeze({ ...constraint }),
        status: "INVALID",
        matchedRuleIds: Object.freeze([]),
        evidenceIds: Object.freeze([]),
        message: `Left entity type '${constraint.left.entityType}' is not an authorized component family (PIPE, FITTING, FLANGE, VALVE).`,
        conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
      });
    }

    const leftCompType = constraint.left.entityType as "PIPE" | "FITTING" | "FLANGE" | "VALVE";

    switch (constraint.constraintType) {
      case "COMPONENT": {
        if (!ALLOWED_COMPONENT_ENTITY_TYPES.includes(constraint.right.entityType)) {
          return Object.freeze({
            constraint: Object.freeze({ ...constraint }),
            status: "INVALID",
            matchedRuleIds: Object.freeze([]),
            evidenceIds: Object.freeze([]),
            message: `Right entity type '${constraint.right.entityType}' for COMPONENT constraint must be an authorized component family.`,
            conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
          });
        }

        const res = this.componentEngine.resolveCompatibility({
          left: {
            componentType: leftCompType,
            componentId: constraint.left.entityId,
          },
          right: {
            componentType: constraint.right.entityType as "PIPE" | "FITTING" | "FLANGE" | "VALVE",
            componentId: constraint.right.entityId,
          },
        });

        return Object.freeze({
          constraint: Object.freeze({ ...constraint }),
          status: res.status,
          matchedRuleIds: Object.freeze(Array.from(new Set(res.matchedRuleIds)).sort()),
          evidenceIds: Object.freeze(Array.from(new Set(res.evidenceIds)).sort()),
          message: res.message ?? `Component compatibility resolved with status '${res.status}'.`,
          conflictCode: res.conflictCode,
        });
      }

      case "MATERIAL": {
        if (constraint.right.entityType !== "MATERIAL") {
          return Object.freeze({
            constraint: Object.freeze({ ...constraint }),
            status: "INVALID",
            matchedRuleIds: Object.freeze([]),
            evidenceIds: Object.freeze([]),
            message: `Right entity type '${constraint.right.entityType}' for MATERIAL constraint must be 'MATERIAL'.`,
            conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
          });
        }

        const res = this.materialEngine.resolveCompatibility({
          component: {
            componentType: leftCompType,
            componentId: constraint.left.entityId,
          },
          material: {
            materialId: constraint.right.entityId,
          },
        });

        return Object.freeze({
          constraint: Object.freeze({ ...constraint }),
          status: res.status,
          matchedRuleIds: Object.freeze(Array.from(new Set(res.matchedRuleIds)).sort()),
          evidenceIds: Object.freeze(Array.from(new Set(res.evidenceIds)).sort()),
          message: res.message ?? `Material compatibility resolved with status '${res.status}'.`,
          conflictCode: res.conflictCode,
        });
      }

      case "RATING": {
        if (constraint.right.entityType !== "RATING") {
          return Object.freeze({
            constraint: Object.freeze({ ...constraint }),
            status: "INVALID",
            matchedRuleIds: Object.freeze([]),
            evidenceIds: Object.freeze([]),
            message: `Right entity type '${constraint.right.entityType}' for RATING constraint must be 'RATING'.`,
            conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
          });
        }

        const res = this.ratingEngine.resolveCompatibility({
          component: {
            componentType: leftCompType,
            componentId: constraint.left.entityId,
          },
          rating: {
            ratingId: constraint.right.entityId,
          },
        });

        return Object.freeze({
          constraint: Object.freeze({ ...constraint }),
          status: res.status,
          matchedRuleIds: Object.freeze(Array.from(new Set(res.matchedRuleIds)).sort()),
          evidenceIds: Object.freeze(Array.from(new Set(res.evidenceIds)).sort()),
          message: res.message ?? `Rating compatibility resolved with status '${res.status}'.`,
          conflictCode: res.conflictCode,
        });
      }

      case "DIMENSIONAL_STANDARD": {
        if (constraint.right.entityType !== "DIMENSIONAL_STANDARD") {
          return Object.freeze({
            constraint: Object.freeze({ ...constraint }),
            status: "INVALID",
            matchedRuleIds: Object.freeze([]),
            evidenceIds: Object.freeze([]),
            message: `Right entity type '${constraint.right.entityType}' for DIMENSIONAL_STANDARD constraint must be 'DIMENSIONAL_STANDARD'.`,
            conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
          });
        }

        const res = this.dimensionalEngine.resolveCompatibility({
          component: {
            componentType: leftCompType,
            componentId: constraint.left.entityId,
          },
          dimensionalStandard: {
            dimensionalStandardId: constraint.right.entityId,
          },
        });

        return Object.freeze({
          constraint: Object.freeze({ ...constraint }),
          status: res.status,
          matchedRuleIds: Object.freeze(Array.from(new Set(res.matchedRuleIds)).sort()),
          evidenceIds: Object.freeze(Array.from(new Set(res.evidenceIds)).sort()),
          message: res.message ?? `Dimensional standard compatibility resolved with status '${res.status}'.`,
          conflictCode: res.conflictCode,
        });
      }

      case "PRODUCT_STANDARD": {
        if (constraint.right.entityType !== "PRODUCT_STANDARD") {
          return Object.freeze({
            constraint: Object.freeze({ ...constraint }),
            status: "INVALID",
            matchedRuleIds: Object.freeze([]),
            evidenceIds: Object.freeze([]),
            message: `Right entity type '${constraint.right.entityType}' for PRODUCT_STANDARD constraint must be 'PRODUCT_STANDARD'.`,
            conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
          });
        }

        const res = this.productEngine.resolveCompatibility({
          component: {
            componentType: leftCompType,
            componentId: constraint.left.entityId,
          },
          productStandard: {
            productStandardId: constraint.right.entityId,
          },
        });

        return Object.freeze({
          constraint: Object.freeze({ ...constraint }),
          status: res.status,
          matchedRuleIds: Object.freeze(Array.from(new Set(res.matchedRuleIds)).sort()),
          evidenceIds: Object.freeze(Array.from(new Set(res.evidenceIds)).sort()),
          message: res.message ?? `Product standard compatibility resolved with status '${res.status}'.`,
          conflictCode: res.conflictCode,
        });
      }

      default: {
        return Object.freeze({
          constraint: Object.freeze({ ...constraint }),
          status: "INVALID",
          matchedRuleIds: Object.freeze([]),
          evidenceIds: Object.freeze([]),
          message: `Unknown constraint type '${String((constraint as any).constraintType)}'.`,
          conflictCode: "INVALID_MULTI_COMPATIBILITY_CONSTRAINT",
        });
      }
    }
  }
}
