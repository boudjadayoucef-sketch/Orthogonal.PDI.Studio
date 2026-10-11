/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION RESOLVER
 * Reference: SPEC-01, SPEC-01-FIX-01, SPEC-01-FIX-02
 * 
 * Moteur déterministe d'orchestration et de résolution d'admissibilité
 * d'un composant au sein d'une spécification de tuyauterie (Piping Spec).
 * 
 * RÈGLES ARCHITECTURALES (SPEC-01-FIX-02) :
 * 1. Isolation stricte des preuves de la règle (Fix 01) :
 *    - Pour qualifier une règle de composant, utiliser EXCLUSIVEMENT rule.evidenceIds.
 *    - spec.evidenceIds n'est PAS un fallback pour la règle.
 *    - Une règle sans evidenceIds ou avec des preuves non vérifiées reste UNVERIFIED (jamais COMPATIBLE).
 * 2. Gestion déterministe des règles multiples (Fix 02) :
 *    - Aucune sélection arbitraire par ordre de tableau (pas de matching[0] prioritaire).
 *    - Si matching.length === 1 : évaluation unitaire.
 *    - Si matching.length > 1 et règles équivalentes : conservation de tous les ruleIds (triés),
 *      agrégation des evidenceIds et vérification individuelle de chaque règle.
 *    - Si matching.length > 1 et règles contradictoires : INVALID avec diagnostic NORMATIVE_RULE_CONFLICT.
 * 3. Précédence stricte du matériau de composant.
 * 4. Délégation déterministe à NORM-13 (NormativeCompatibilityEngine).
 * 5. Aucune conversion automatique (NPS != DN, Class != PN), aucun score, aucun fuzzy matching.
 */

import type {
  IPipingSpecResolver,
  PipingSpecResolutionContext,
  PipingSpecResolutionResult,
  PipingSpecLookupFunction,
} from "../types/pipingSpecResolverTypes";
import type {
  PipingSpecification,
  PipingSpecPipeRule,
  PipingSpecFittingRule,
  PipingSpecFlangeRule,
  PipingSpecValveRule,
} from "../types/pipingSpecTypes";
import type {
  INormativeCompatibilityEngine,
} from "./normativeCompatibilityEngine";
import type {
  INormativeEvidenceResolver,
} from "../registry/normativeEvidenceResolver";
import type {
  NormativeCompatibilityContext,
} from "../types/normativeCompatibilityTypes";
import { validatePipingSpecResolutionContext } from "../validators/pipingSpecResolverValidator";

type GenericSpecRule =
  | PipingSpecPipeRule
  | PipingSpecFittingRule
  | PipingSpecFlangeRule
  | PipingSpecValveRule;

export class PipingSpecResolver implements IPipingSpecResolver {
  private readonly lookupSpec: PipingSpecLookupFunction;
  private readonly compatibilityEngine: INormativeCompatibilityEngine;
  private readonly evidenceResolver: INormativeEvidenceResolver;

  constructor(
    specLookup: PipingSpecLookupFunction | readonly PipingSpecification[],
    compatibilityEngine: INormativeCompatibilityEngine,
    evidenceResolver: INormativeEvidenceResolver
  ) {
    if (typeof specLookup === "function") {
      this.lookupSpec = specLookup;
    } else if (Array.isArray(specLookup)) {
      const specs = specLookup;
      this.lookupSpec = (id: string) => specs.find((s) => s.id === id);
    } else {
      throw new Error(
        "PipingSpecResolver: specLookup must be a lookup function or a readonly array of PipingSpecification."
      );
    }

    if (!compatibilityEngine || typeof compatibilityEngine.evaluate !== "function") {
      throw new Error(
        "PipingSpecResolver: compatibilityEngine must be an explicit INormativeCompatibilityEngine instance."
      );
    }
    this.compatibilityEngine = compatibilityEngine;

    if (!evidenceResolver || typeof evidenceResolver.resolveEvidenceSet !== "function") {
      throw new Error(
        "PipingSpecResolver: evidenceResolver must be an explicit INormativeEvidenceResolver instance."
      );
    }
    this.evidenceResolver = evidenceResolver;
  }

  /**
   * Résout l'admissibilité d'un composant au regard de la spécification de tuyauterie et des règles de compatibilité.
   */
  public resolve(context: PipingSpecResolutionContext): PipingSpecResolutionResult {
    // 1. Validation structurelle et sémantique du contexte
    const validation = validatePipingSpecResolutionContext(context);
    if (!validation.valid) {
      return {
        status: "INVALID",
        specificationId: typeof context?.specificationId === "string" ? context.specificationId : "",
        componentType: typeof context?.componentType === "string" ? context.componentType : "",
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `INVALID_CONTEXT: ${validation.errors.join("; ")}`,
      };
    }

    // 2. Résolution de la spécification de tuyauterie
    const spec = this.lookupSpec(context.specificationId);
    if (!spec) {
      return {
        status: "INVALID",
        specificationId: context.specificationId,
        componentType: context.componentType,
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `SPEC_NOT_FOUND: Specification with id '${context.specificationId}' was not found.`,
      };
    }

    // 3. Vérification de la borne supérieure des matériaux au niveau de la spec (Fix 02 / Fix 03)
    if (context.materialId) {
      if (
        spec.materialReferenceIds.length > 0 &&
        !spec.materialReferenceIds.includes(context.materialId)
      ) {
        return {
          status: "INCOMPATIBLE",
          specificationId: spec.id,
          componentType: context.componentType,
          matchedRuleIds: [],
          compatibilityRuleIds: [],
          evidenceIds: [],
          message: `MATERIAL_NOT_AUTHORIZED: Material '${context.materialId}' is not authorized in specification '${spec.id}'.`,
        };
      }
    }

    // 4. Identification et évaluation des règles de composant dans la Piping Specification
    const upperType = context.componentType.toUpperCase();
    const evaluation = this.evaluatePipingSpecRules(spec, upperType, context);

    if (evaluation.status !== "ADMISSIBLE") {
      return {
        status: evaluation.status,
        specificationId: spec.id,
        componentType: context.componentType,
        matchedRuleIds: evaluation.matchedRuleIds,
        compatibilityRuleIds: [],
        evidenceIds: evaluation.evidenceIds,
        message: evaluation.message,
      };
    }

    const ruleEvidenceIds = evaluation.evidenceIds;
    const specMatchedRuleIds = evaluation.matchedRuleIds;
    const matchedSpecRule = evaluation.matchedRule;

    // 5. Délégation déterministe à NORM-13 (NormativeCompatibilityEngine)
    // Extraction des contraintes de la règle Piping Spec pour garantir la relation explicite et déterministe
    const standardId =
      context.productStandardId ||
      context.dimensionalStandardId ||
      (matchedSpecRule as any)?.productStandardId ||
      (matchedSpecRule as any)?.dimensionalStandardId ||
      (matchedSpecRule as any)?.pipeDimensionalStandardId ||
      (matchedSpecRule as any)?.fittingStandardId ||
      (matchedSpecRule as any)?.flangeStandardId;

    const connectionType =
      context.connectionType ||
      ((matchedSpecRule as any)?.connectionTypes?.length === 1
        ? (matchedSpecRule as any).connectionTypes[0]
        : undefined);

    const schedule =
      context.schedule ||
      (matchedSpecRule as any)?.schedule;

    const pressureRating =
      context.ratingValue ||
      (matchedSpecRule as any)?.rating;

    const materialId =
      context.materialId ||
      (matchedSpecRule as any)?.materialId ||
      (spec.materialReferenceIds.length === 1 ? spec.materialReferenceIds[0] : undefined);

    const compatContext: NormativeCompatibilityContext = {
      standardId: standardId as any,
      componentType: context.componentType,
      connectionType: connectionType as any,
      nominalSize: context.nominalSize,
      schedule: schedule,
      pressureRating: pressureRating,
      materialId: materialId,
      designCodeId: (context.designCodeId || spec.designCodeId) as any,
      pipingSpecId: spec.id,
      evidenceIds: ruleEvidenceIds,
    };

    const compatDecision = this.compatibilityEngine.evaluate(compatContext);

    // Extraction des règles de compatibilité NORM-13 (Fix 03)
    const compatibilityRuleIds = (
      compatDecision.matchedRuleIds ??
      (compatDecision.ruleId ? [compatDecision.ruleId] : [])
    )
      .slice()
      .sort();

    // Agrégation déterministe des preuves vérifiées des deux niveaux (Piping Spec + NORM-13)
    const finalEvidenceIds =
      compatDecision.status === "INVALID"
        ? []
        : Array.from(
            new Set([
              ...ruleEvidenceIds,
              ...(compatDecision.evidenceIds ?? []),
            ])
          ).sort();

    return {
      status: compatDecision.status,
      specificationId: spec.id,
      componentType: context.componentType,
      matchedRuleIds: specMatchedRuleIds,
      compatibilityRuleIds: compatibilityRuleIds,
      evidenceIds: finalEvidenceIds,
      message: compatDecision.message,
    };
  }

  /**
   * Évalue les règles d'une spécification pour un composant donné.
   */
  private evaluatePipingSpecRules(
    spec: PipingSpecification,
    upperType: string,
    context: PipingSpecResolutionContext
  ): {
    status: "ADMISSIBLE" | "INCOMPATIBLE" | "UNVERIFIED" | "INVALID";
    matchedRule: GenericSpecRule;
    matchedRuleIds: string[];
    evidenceIds: string[];
    message?: string;
  } {
    if (upperType === "PIPE") {
      if (spec.pipeRules.length === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `NO_PIPE_RULES: Specification '${spec.id}' defines 0 pipe rules.`,
        };
      }

      return this.matchPipeRules(spec, context);
    }

    if (upperType === "FITTING") {
      if (spec.fittingRules.length === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `NO_FITTING_RULES: Specification '${spec.id}' defines 0 fitting rules.`,
        };
      }

      return this.matchFittingRules(spec, context);
    }

    if (upperType === "FLANGE") {
      if (spec.flangeRules.length === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `NO_FLANGE_RULES: Specification '${spec.id}' defines 0 flange rules.`,
        };
      }

      return this.matchFlangeRules(spec, context);
    }

    if (upperType === "VALVE") {
      if (spec.valveRules.length === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `NO_VALVE_RULES: Specification '${spec.id}' defines 0 valve rules.`,
        };
      }

      return this.matchValveRules(spec, context);
    }

    // Composant sans famille standard
    return {
      status: "UNVERIFIED",
      matchedRule: {} as any,
      matchedRuleIds: [],
      evidenceIds: [],
      message: `UNKNOWN_COMPONENT_FAMILY: Family '${upperType}' has no dedicated rule set in specification '${spec.id}'.`,
    };
  }

  private matchPipeRules(
    spec: PipingSpecification,
    context: PipingSpecResolutionContext
  ) {
    const candidates = spec.pipeRules;

    // Vérification stricte des incompatibilités structurelles
    if (context.dimensionalStandardId) {
      const hasDim = candidates.some(
        (r) => r.pipeDimensionalStandardId === context.dimensionalStandardId
      );
      if (!hasDim) {
        return {
          status: "INCOMPATIBLE" as const,
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `DIMENSIONAL_STANDARD_MISMATCH: Pipe dimensional standard '${context.dimensionalStandardId}' is not authorized in specification '${spec.id}'.`,
        };
      }
    }

    if (context.schedule) {
      const rulesWithSched = candidates.filter((r) => r.schedule !== undefined);
      if (rulesWithSched.length > 0) {
        const hasSched = rulesWithSched.some((r) => r.schedule === context.schedule);
        if (!hasSched) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `SCHEDULE_MISMATCH: Schedule '${context.schedule}' is not authorized for pipes in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.nominalSize) {
      const rulesWithSizes = candidates.filter(
        (r) => r.nominalSizes && r.nominalSizes.length > 0
      );
      if (rulesWithSizes.length > 0) {
        const hasSize = rulesWithSizes.some((r) => r.nominalSizes!.includes(context.nominalSize!));
        if (!hasSize) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `NOMINAL_SIZE_MISMATCH: Nominal size '${context.nominalSize}' is not covered for pipes in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.materialId) {
      const rulesWithMat = candidates.filter((r) => r.materialId !== undefined);
      if (rulesWithMat.length > 0) {
        const hasMat = rulesWithMat.some((r) => r.materialId === context.materialId);
        if (!hasMat) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `MATERIAL_MISMATCH: Material '${context.materialId}' is not authorized by pipe rules in specification '${spec.id}'.`,
          };
        }
      }
    }

    // Filtrer les règles correspondant au contexte
    const matching = candidates.filter((rule) => {
      if (
        context.dimensionalStandardId &&
        rule.pipeDimensionalStandardId !== context.dimensionalStandardId
      ) {
        return false;
      }
      if (context.schedule && rule.schedule && rule.schedule !== context.schedule) {
        return false;
      }
      if (
        context.nominalSize &&
        rule.nominalSizes &&
        !rule.nominalSizes.includes(context.nominalSize)
      ) {
        return false;
      }
      if (context.materialId && rule.materialId && rule.materialId !== context.materialId) {
        return false;
      }
      return true;
    });

    return this.resolveRuleCandidates(
      spec,
      matching,
      "pipe",
      this.arePipeRulesEquivalent.bind(this)
    );
  }

  private matchFittingRules(
    spec: PipingSpecification,
    context: PipingSpecResolutionContext
  ) {
    const candidates = spec.fittingRules;

    if (context.productStandardId) {
      const hasProd = candidates.some((r) => r.fittingStandardId === context.productStandardId);
      if (!hasProd) {
        return {
          status: "INCOMPATIBLE" as const,
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `PRODUCT_STANDARD_MISMATCH: Fitting product standard '${context.productStandardId}' is not authorized in specification '${spec.id}'.`,
        };
      }
    }

    if (context.fittingType) {
      const rulesWithTypes = candidates.filter(
        (r) => r.fittingTypes && r.fittingTypes.length > 0
      );
      if (rulesWithTypes.length > 0) {
        const hasType = rulesWithTypes.some((r) =>
          r.fittingTypes!.includes(context.fittingType as any)
        );
        if (!hasType) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `FITTING_TYPE_MISMATCH: Fitting type '${context.fittingType}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.connectionType) {
      const rulesWithConn = candidates.filter(
        (r) => r.connectionTypes && r.connectionTypes.length > 0
      );
      if (rulesWithConn.length > 0) {
        const hasConn = rulesWithConn.some((r) =>
          r.connectionTypes!.includes(context.connectionType as any)
        );
        if (!hasConn) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `CONNECTION_TYPE_MISMATCH: Fitting connection type '${context.connectionType}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.materialId) {
      const rulesWithMat = candidates.filter((r) => r.materialId !== undefined);
      if (rulesWithMat.length > 0) {
        const hasMat = rulesWithMat.some((r) => r.materialId === context.materialId);
        if (!hasMat) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `MATERIAL_MISMATCH: Material '${context.materialId}' is not authorized by fitting rules in specification '${spec.id}'.`,
          };
        }
      }
    }

    const matching = candidates.filter((rule) => {
      if (context.productStandardId && rule.fittingStandardId !== context.productStandardId) {
        return false;
      }
      if (
        context.fittingType &&
        rule.fittingTypes &&
        !rule.fittingTypes.includes(context.fittingType as any)
      ) {
        return false;
      }
      if (
        context.connectionType &&
        rule.connectionTypes &&
        !rule.connectionTypes.includes(context.connectionType as any)
      ) {
        return false;
      }
      if (context.materialId && rule.materialId && rule.materialId !== context.materialId) {
        return false;
      }
      return true;
    });

    return this.resolveRuleCandidates(
      spec,
      matching,
      "fitting",
      this.areFittingRulesEquivalent.bind(this)
    );
  }

  private matchFlangeRules(
    spec: PipingSpecification,
    context: PipingSpecResolutionContext
  ) {
    const candidates = spec.flangeRules;

    if (context.productStandardId) {
      const hasProd = candidates.some((r) => r.flangeStandardId === context.productStandardId);
      if (!hasProd) {
        return {
          status: "INCOMPATIBLE" as const,
          matchedRule: {} as any,
          matchedRuleIds: [],
          evidenceIds: [],
          message: `PRODUCT_STANDARD_MISMATCH: Flange product standard '${context.productStandardId}' is not authorized in specification '${spec.id}'.`,
        };
      }
    }

    if (context.ratingSystem) {
      const rulesWithRatingSys = candidates.filter((r) => r.ratingSystem !== undefined);
      if (rulesWithRatingSys.length > 0) {
        const hasRatingSys = rulesWithRatingSys.some((r) => r.ratingSystem === context.ratingSystem);
        if (!hasRatingSys) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `RATING_SYSTEM_MISMATCH: Flange rating system '${context.ratingSystem}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.ratingValue) {
      const rulesWithRating = candidates.filter((r) => r.rating !== undefined);
      if (rulesWithRating.length > 0) {
        const hasRating = rulesWithRating.some((r) => r.rating === context.ratingValue);
        if (!hasRating) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `RATING_VALUE_MISMATCH: Flange rating '${context.ratingValue}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.materialId) {
      const rulesWithMat = candidates.filter((r) => r.materialId !== undefined);
      if (rulesWithMat.length > 0) {
        const hasMat = rulesWithMat.some((r) => r.materialId === context.materialId);
        if (!hasMat) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `MATERIAL_MISMATCH: Material '${context.materialId}' is not authorized by flange rules in specification '${spec.id}'.`,
          };
        }
      }
    }

    const matching = candidates.filter((rule) => {
      if (context.productStandardId && rule.flangeStandardId !== context.productStandardId) {
        return false;
      }
      if (context.ratingSystem && rule.ratingSystem && rule.ratingSystem !== context.ratingSystem) {
        return false;
      }
      if (context.ratingValue && rule.rating && rule.rating !== context.ratingValue) {
        return false;
      }
      if (context.materialId && rule.materialId && rule.materialId !== context.materialId) {
        return false;
      }
      return true;
    });

    return this.resolveRuleCandidates(
      spec,
      matching,
      "flange",
      this.areFlangeRulesEquivalent.bind(this)
    );
  }

  private matchValveRules(
    spec: PipingSpecification,
    context: PipingSpecResolutionContext
  ) {
    const candidates = spec.valveRules;

    if (context.productStandardId) {
      const rulesWithProd = candidates.filter((r) => r.productStandardId !== undefined);
      if (rulesWithProd.length > 0) {
        const hasProd = rulesWithProd.some((r) => r.productStandardId === context.productStandardId);
        if (!hasProd) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `PRODUCT_STANDARD_MISMATCH: Valve product standard '${context.productStandardId}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.dimensionalStandardId) {
      const rulesWithDim = candidates.filter((r) => r.dimensionalStandardId !== undefined);
      if (rulesWithDim.length > 0) {
        const hasDim = rulesWithDim.some(
          (r) => r.dimensionalStandardId === context.dimensionalStandardId
        );
        if (!hasDim) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `DIMENSIONAL_STANDARD_MISMATCH: Valve dimensional standard '${context.dimensionalStandardId}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.connectionType) {
      const rulesWithConn = candidates.filter(
        (r) => r.connectionTypes && r.connectionTypes.length > 0
      );
      if (rulesWithConn.length > 0) {
        const hasConn = rulesWithConn.some((r) =>
          r.connectionTypes!.includes(context.connectionType as any)
        );
        if (!hasConn) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `CONNECTION_TYPE_MISMATCH: Valve connection type '${context.connectionType}' is not authorized in specification '${spec.id}'.`,
          };
        }
      }
    }

    if (context.materialId) {
      const rulesWithMat = candidates.filter((r) => r.materialId !== undefined);
      if (rulesWithMat.length > 0) {
        const hasMat = rulesWithMat.some((r) => r.materialId === context.materialId);
        if (!hasMat) {
          return {
            status: "INCOMPATIBLE" as const,
            matchedRule: {} as any,
            matchedRuleIds: [],
            evidenceIds: [],
            message: `MATERIAL_MISMATCH: Material '${context.materialId}' is not authorized by valve rules in specification '${spec.id}'.`,
          };
        }
      }
    }

    const matching = candidates.filter((rule) => {
      if (
        context.productStandardId &&
        rule.productStandardId &&
        rule.productStandardId !== context.productStandardId
      ) {
        return false;
      }
      if (
        context.dimensionalStandardId &&
        rule.dimensionalStandardId &&
        rule.dimensionalStandardId !== context.dimensionalStandardId
      ) {
        return false;
      }
      if (
        context.connectionType &&
        rule.connectionTypes &&
        !rule.connectionTypes.includes(context.connectionType as any)
      ) {
        return false;
      }
      if (context.materialId && rule.materialId && rule.materialId !== context.materialId) {
        return false;
      }
      return true;
    });

    return this.resolveRuleCandidates(
      spec,
      matching,
      "valve",
      this.areValveRulesEquivalent.bind(this)
    );
  }

  /**
   * Helper d'égalité ensembliste pour les tableaux immuables.
   */
  private areArraySetsEqual(
    a?: readonly string[] | readonly any[],
    b?: readonly string[] | readonly any[]
  ): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    const sortedA = [...a].map(String).sort();
    const sortedB = [...b].map(String).sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }

  private arePipeRulesEquivalent(a: PipingSpecPipeRule, b: PipingSpecPipeRule): boolean {
    if (a.pipeDimensionalStandardId !== b.pipeDimensionalStandardId) return false;
    if (a.materialId !== b.materialId) return false;
    if (a.schedule !== b.schedule) return false;
    return this.areArraySetsEqual(a.nominalSizes, b.nominalSizes);
  }

  private areFittingRulesEquivalent(a: PipingSpecFittingRule, b: PipingSpecFittingRule): boolean {
    if (a.fittingStandardId !== b.fittingStandardId) return false;
    if (a.materialId !== b.materialId) return false;
    if (!this.areArraySetsEqual(a.fittingTypes, b.fittingTypes)) return false;
    return this.areArraySetsEqual(a.connectionTypes, b.connectionTypes);
  }

  private areFlangeRulesEquivalent(a: PipingSpecFlangeRule, b: PipingSpecFlangeRule): boolean {
    if (a.flangeStandardId !== b.flangeStandardId) return false;
    if (a.materialId !== b.materialId) return false;
    if (a.ratingSystem !== b.ratingSystem) return false;
    if (a.rating !== b.rating) return false;
    return this.areArraySetsEqual(a.flangeTypes, b.flangeTypes);
  }

  private areValveRulesEquivalent(a: PipingSpecValveRule, b: PipingSpecValveRule): boolean {
    if (a.productStandardId !== b.productStandardId) return false;
    if (a.dimensionalStandardId !== b.dimensionalStandardId) return false;
    if (a.materialId !== b.materialId) return false;
    if (!this.areArraySetsEqual(a.valveTypes, b.valveTypes)) return false;
    return this.areArraySetsEqual(a.connectionTypes, b.connectionTypes);
  }

  /**
   * Résout une liste de règles candidates de façon déterministe avec détection de conflits.
   * FIX-02 : Aucun ordre de tableau arbitraire.
   * FIX-01 : Isolation stricte des preuves de la règle (pas d'héritage implicite de spec.evidenceIds).
   */
  private resolveRuleCandidates<T extends GenericSpecRule>(
    spec: PipingSpecification,
    matching: readonly T[],
    familyName: string,
    areEquivalentFn: (a: T, b: T) => boolean
  ): {
    status: "ADMISSIBLE" | "INCOMPATIBLE" | "UNVERIFIED" | "INVALID";
    matchedRule: GenericSpecRule;
    matchedRuleIds: string[];
    evidenceIds: string[];
    message?: string;
  } {
    // 0 match -> UNVERIFIED
    if (matching.length === 0) {
      return {
        status: "UNVERIFIED",
        matchedRule: {} as any,
        matchedRuleIds: [],
        evidenceIds: [],
        message: `NO_MATCHING_RULE: No ${familyName} rule in specification '${spec.id}' matched the exact context.`,
      };
    }

    // 1 match -> Evaluation unitaire
    if (matching.length === 1) {
      const rule = matching[0];
      const ruleId = rule.ruleId ? [rule.ruleId] : [];
      const ruleEvidenceIds = (rule.evidenceIds ?? []).slice().sort();

      // Vérification de l'autorité normative de la règle (Fix 01)
      if (rule.sourceStatus !== "VERIFIED") {
        return {
          status: "UNVERIFIED",
          matchedRule: rule,
          matchedRuleIds: ruleId,
          evidenceIds: ruleEvidenceIds,
          message: `PIPING_SPEC_RULE_UNVERIFIED: Matched ${familyName} rule in specification '${spec.id}' has sourceStatus '${rule.sourceStatus}'.`,
        };
      }

      // Résolution formelle des preuves de la règle via NORM-09 (Fix 01)
      if (ruleEvidenceIds.length === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: rule,
          matchedRuleIds: ruleId,
          evidenceIds: [],
          message: `PIPING_SPEC_RULE_LACKS_EVIDENCE: Matched ${familyName} rule in specification '${spec.id}' has no associated normative evidence.`,
        };
      }

      const evidenceResolution = this.evidenceResolver.resolveEvidenceSet(ruleEvidenceIds);
      if (!evidenceResolution.allVerified || evidenceResolution.totalRequested === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: rule,
          matchedRuleIds: ruleId,
          evidenceIds: ruleEvidenceIds,
          message: `PIPING_SPEC_EVIDENCE_NOT_VERIFIED: Normative evidence for matched ${familyName} rule in specification '${spec.id}' is unverified or missing.`,
        };
      }

      return {
        status: "ADMISSIBLE",
        matchedRule: rule,
        matchedRuleIds: ruleId,
        evidenceIds: ruleEvidenceIds,
      };
    }

    // matching.length > 1 : Analyse de conflits et équivalence
    const allMatchedRuleIds = matching
      .map((r) => r.ruleId ?? "UNNAMED_RULE")
      .slice()
      .sort();

    // Vérifier si toutes les règles en lice sont strictement équivalentes
    const firstRule = matching[0];
    const allEquivalent = matching.every((r) => areEquivalentFn(firstRule, r));

    if (!allEquivalent) {
      return {
        status: "INVALID",
        matchedRule: {} as any,
        matchedRuleIds: allMatchedRuleIds,
        evidenceIds: [],
        message: `NORMATIVE_RULE_CONFLICT: Detected contradictory ${familyName} rules in specification '${spec.id}'.`,
      };
    }

    // Toutes les règles sont strictement équivalentes (CAS 1).
    // Vérification individuelle de chaque règle pour ses preuves et son statut :
    // "Une preuve de Rule A ne doit jamais qualifier Rule B"
    const aggregatedEvidenceIdsSet = new Set<string>();

    for (const rule of matching) {
      if (rule.sourceStatus !== "VERIFIED") {
        return {
          status: "UNVERIFIED",
          matchedRule: rule,
          matchedRuleIds: allMatchedRuleIds,
          evidenceIds: Array.from(aggregatedEvidenceIdsSet).sort(),
          message: `PIPING_SPEC_RULE_UNVERIFIED: Matched ${familyName} rule '${rule.ruleId ?? "UNNAMED"}' in specification '${spec.id}' has sourceStatus '${rule.sourceStatus}'.`,
        };
      }

      const ruleEvidenceIds = rule.evidenceIds ?? [];
      if (ruleEvidenceIds.length === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: rule,
          matchedRuleIds: allMatchedRuleIds,
          evidenceIds: Array.from(aggregatedEvidenceIdsSet).sort(),
          message: `PIPING_SPEC_RULE_LACKS_EVIDENCE: Matched ${familyName} rule '${rule.ruleId ?? "UNNAMED"}' in specification '${spec.id}' has no associated normative evidence.`,
        };
      }

      const resolution = this.evidenceResolver.resolveEvidenceSet(ruleEvidenceIds);
      if (!resolution.allVerified || resolution.totalRequested === 0) {
        return {
          status: "UNVERIFIED",
          matchedRule: rule,
          matchedRuleIds: allMatchedRuleIds,
          evidenceIds: Array.from(aggregatedEvidenceIdsSet).sort(),
          message: `PIPING_SPEC_EVIDENCE_NOT_VERIFIED: Normative evidence for matched ${familyName} rule '${rule.ruleId ?? "UNNAMED"}' in specification '${spec.id}' is unverified or missing.`,
        };
      }

      for (const evId of ruleEvidenceIds) {
        aggregatedEvidenceIdsSet.add(evId);
      }
    }

    const sortedEvidenceIds = Array.from(aggregatedEvidenceIdsSet).sort();

    return {
      status: "ADMISSIBLE",
      matchedRule: firstRule,
      matchedRuleIds: allMatchedRuleIds,
      evidenceIds: sortedEvidenceIds,
    };
  }
}

