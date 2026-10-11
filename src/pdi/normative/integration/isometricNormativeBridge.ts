/**
 * PDI NORMATIVE ENGINE — ISOMETRIC NORMATIVE BRIDGE
 * Reference: ARCH-01 (Architectural Unification & Normative Bridge)
 *
 * Explicit orchestration bridge connecting the Isometric Editor domain
 * (via `IsometricNormativeAdapter` and `IsometricNormativeContext`) to the
 * authoritative Normative Engine (`PipingSpecResolver`, `NormativeCompatibilityEngine`,
 * `NormativeEvidenceResolver`, `NormativeSpecCompatibilityIntegrationEngine`,
 * and `NormativeEvidenceTraceabilityEngine`).
 *
 * ARCHITECTURAL GUARANTEES (ARCH-01):
 * 1. Reuses existing locked normative engines without creating any parallel engine.
 * 2. Strict conservatism: missing `pipingSpecId`, missing `materialId`, missing `pressureRating`,
 *    missing `nominalSize`, or unregistered/unverified `PipingSpecification` always yields `UNVERIFIED`.
 * 3. Global compatibility rules never bypass a missing or unverified Piping Specification.
 * 4. Preserves complete provenance traceability:
 *    EDITOR ENTITY -> RULE -> VERIFIED VALUE -> EVIDENCE -> SPEC / STANDARD / EDITION / CLAUSE.
 * 5. Legacy PMS (`pdiClassePression017K3`) is never allowed to become a second independent
 *    normative authority or silently override the Normative Engine. Contradictions are
 *    explicitly surfaced via `LEGACY_PMS_NORMATIVE_CONFLICT`.
 */

import type {
  IsoNode,
  IsoSegment,
  IsoFitting,
} from "../../isometric/types/isoGraphTypes";
import type { IsoPipingSupport } from "../../isometric/supports/pdiMssSupportEngine";
import type { PdiUniversalEntity } from "../../model/pdiUniversalEntity";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type {
  IPipingSpecResolver,
  PipingSpecLookupFunction,
  PipingSpecResolutionContext,
} from "../types/pipingSpecResolverTypes";
import type { INormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { NormativeCompatibilityEngine } from "../engine/normativeCompatibilityEngine";
import { defaultCompatibilityRegistry } from "../registry/normativeCompatibilityRegistry";
import type { INormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { defaultEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { getPipingSpecById, getPipingSpecByCode } from "../registry/pipingSpecRegistry";
import { PipingSpecResolver } from "../engine/pipingSpecResolver";
import type { INormativeSpecCompatibilityIntegrationEngine } from "../types/normativeSpecCompatibilityIntegrationTypes";
import type { INormativeEvidenceTraceabilityEngine } from "../types/normativeEvidenceTraceabilityTypes";
import { NormativeEvidenceTraceabilityEngine } from "../engine/normativeEvidenceTraceabilityEngine";
import { isDisallowedTokenHeuristic } from "../validators/normativeEvidenceValidator";
import { validatePipingSpecResolutionContext } from "../validators/pipingSpecResolverValidator";
import {
  ILegacyPmsAdapter,
  defaultLegacyPmsAdapter,
} from "./legacyPmsAdapter";
import {
  adaptIsoNodeToNormativeContext,
  adaptIsoSegmentToNormativeContext,
  adaptIsoFittingToNormativeContext,
  adaptIsoSupportToNormativeContext,
  adaptUniversalEntityToNormativeContext,
} from "./isometricNormativeAdapter";
import type {
  IIsometricNormativeBridge,
  IsometricNormativeContext,
  IsometricNormativeDecision,
  IsometricNormativeEvaluationOptions,
  IsometricNormativeEvidenceTraceItem,
  IsometricNormativeStatus,
  IsometricNormativeTraceability,
  LegacyPmsComparisonSnapshot,
} from "./isometricNormativeContext";

export interface IsometricNormativeBridgeConfig {
  readonly specLookup?: PipingSpecLookupFunction | readonly PipingSpecification[];
  readonly pipingSpecResolver?: IPipingSpecResolver;
  readonly compatibilityEngine?: INormativeCompatibilityEngine;
  readonly evidenceResolver?: INormativeEvidenceResolver;
  readonly specCompatibilityIntegrationEngine?: INormativeSpecCompatibilityIntegrationEngine;
  readonly traceabilityEngine?: INormativeEvidenceTraceabilityEngine;
  readonly legacyPmsAdapter?: ILegacyPmsAdapter;
}

const VALID_SPEC_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
]);

function extractDiagnosticCode(message?: string): string | undefined {
  if (!message || typeof message !== "string") return undefined;
  const match = /^([A-Z0-9_]+):/.exec(message.trim());
  return match ? match[1] : undefined;
}

export class IsometricNormativeBridge implements IIsometricNormativeBridge {
  private readonly lookupSpec: PipingSpecLookupFunction;
  private readonly pipingSpecResolver: IPipingSpecResolver;
  private readonly compatibilityEngine: INormativeCompatibilityEngine;
  private readonly evidenceResolver: INormativeEvidenceResolver;
  private readonly specCompatibilityIntegrationEngine?: INormativeSpecCompatibilityIntegrationEngine;
  private readonly traceabilityEngine: INormativeEvidenceTraceabilityEngine;
  private readonly legacyPmsAdapter: ILegacyPmsAdapter;

  constructor(config: IsometricNormativeBridgeConfig = {}) {
    if (typeof config.specLookup === "function") {
      this.lookupSpec = config.specLookup;
    } else if (Array.isArray(config.specLookup)) {
      const specs = config.specLookup;
      this.lookupSpec = (id: string) =>
        specs.find((s) => s.id === id || s.code === id);
    } else {
      this.lookupSpec = (id: string) =>
        getPipingSpecById(id) ?? getPipingSpecByCode(id);
    }

    this.evidenceResolver =
      config.evidenceResolver ?? new NormativeEvidenceResolver(defaultEvidenceRegistry);

    this.compatibilityEngine =
      config.compatibilityEngine ??
      new NormativeCompatibilityEngine(defaultCompatibilityRegistry, this.evidenceResolver);

    this.pipingSpecResolver =
      config.pipingSpecResolver ??
      new PipingSpecResolver(this.lookupSpec, this.compatibilityEngine, this.evidenceResolver);

    this.specCompatibilityIntegrationEngine = config.specCompatibilityIntegrationEngine;

    this.traceabilityEngine =
      config.traceabilityEngine ?? new NormativeEvidenceTraceabilityEngine();

    this.legacyPmsAdapter = config.legacyPmsAdapter ?? defaultLegacyPmsAdapter;
  }

  /**
   * Evaluates a normalized `IsometricNormativeContext` through the full normative chain:
   * PIPING SPEC -> NORMATIVE COMPATIBILITY -> EVIDENCE / TRACEABILITY -> DECISION.
   */
  public evaluateContext(
    context: IsometricNormativeContext,
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision {
    // 1. Structural check on context object and entityId
    if (
      !context ||
      typeof context !== "object" ||
      typeof context.entityId !== "string" ||
      context.entityId.trim().length === 0
    ) {
      return this.buildDecision({
        entityId: context && typeof context === "object" && typeof context.entityId === "string" ? context.entityId : "",
        status: "INVALID",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: ["INVALID_NORMATIVE_CONTEXT"],
        message: "INVALID_NORMATIVE_CONTEXT: Context must be a valid object with a non-empty entityId.",
        context,
        options,
      });
    }

    // 2. Check for disallowed heuristic tokens across string fields
    const fieldsToCheck: Array<[string, string | undefined]> = [
      ["entityId", context.entityId],
      ["pipingSpecId", context.pipingSpecId],
      ["materialId", context.materialId],
      ["pressureRating", context.pressureRating],
      ["nominalSize", context.nominalSize],
      ["schedule", context.schedule],
      ["dimensionalStandard", context.dimensionalStandard],
      ["productStandard", context.productStandard],
      ["connectionType", context.connectionType],
      ["fittingType", context.fittingType],
      ["valveType", context.valveType],
      ["designCodeId", context.designCodeId],
    ];

    for (const [fieldName, fieldVal] of fieldsToCheck) {
      if (fieldVal !== undefined && isDisallowedTokenHeuristic(fieldVal)) {
        return this.buildDecision({
          entityId: context.entityId,
          status: "INVALID",
          specRuleIds: [],
          compatibilityRuleIds: [],
          evidenceIds: [],
          conflictCodes: ["DISALLOWED_TOKEN_HEURISTIC"],
          message: `DISALLOWED_TOKEN_HEURISTIC: Field '${fieldName}' contains disallowed heuristic token '${fieldVal}'.`,
          context,
          options,
        });
      }
    }

    // 3. Conservatism rules for missing mandatory normative fields (ARCH-01 Sections 7, 8, 9, 12)
    if (!context.componentType) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: "MISSING_COMPONENT_TYPE: Structured componentType is absent; defaulting conservatively to UNVERIFIED.",
        context,
        options,
      });
    }

    if (!VALID_SPEC_COMPONENT_TYPES.has(context.componentType)) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: `UNVERIFIED_COMPONENT_FAMILY: Component type '${context.componentType}' has no piping specification rule family.`,
        context,
        options,
      });
    }

    if (!context.pipingSpecId || context.pipingSpecId.trim().length === 0) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: "MISSING_PIPING_SPEC: pipingSpecId is absent; global compatibility rules cannot bypass a missing Piping Specification.",
        context,
        options,
      });
    }

    if (!context.materialId || context.materialId.trim().length === 0) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: "MISSING_MATERIAL: materialId is absent; normative decision is conservatively UNVERIFIED.",
        context,
        options,
      });
    }

    if (!context.pressureRating || context.pressureRating.trim().length === 0) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: "MISSING_PRESSURE_RATING: pressureRating is absent; normative decision is conservatively UNVERIFIED.",
        context,
        options,
      });
    }

    if (!context.nominalSize || context.nominalSize.trim().length === 0) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: "MISSING_NOMINAL_SIZE: nominalSize is absent; normative decision is conservatively UNVERIFIED.",
        context,
        options,
      });
    }

    // 4. Explicit evidence check when context.evidenceIds is provided on the context
    if (context.evidenceIds !== undefined) {
      if (context.evidenceIds.length === 0) {
        return this.buildDecision({
          entityId: context.entityId,
          status: "UNVERIFIED",
          specRuleIds: [],
          compatibilityRuleIds: [],
          evidenceIds: [],
          conflictCodes: [],
          message: "MISSING_EVIDENCE: Explicit context evidenceIds list is empty.",
          context,
          options,
        });
      }

      const contextEvResolution = this.evidenceResolver.resolveEvidenceSet(context.evidenceIds);
      if (!contextEvResolution.allVerified || contextEvResolution.totalRequested === 0) {
        return this.buildDecision({
          entityId: context.entityId,
          status: "UNVERIFIED",
          specRuleIds: [],
          compatibilityRuleIds: [],
          evidenceIds: [...context.evidenceIds].sort(),
          conflictCodes: [],
          message: "UNVERIFIED_EVIDENCE: One or more context evidenceIds are missing or UNVERIFIED.",
          context,
          options,
        });
      }
    }

    // 5. Piping Specification lookup & verification status check (ARCH-01 Section 9)
    const spec = this.lookupSpec(context.pipingSpecId);
    if (!spec) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: `PIPING_SPEC_NOT_FOUND: Piping Specification '${context.pipingSpecId}' was not found in the normative registry.`,
        context,
        options,
      });
    }

    if (spec.sourceStatus !== "VERIFIED") {
      return this.buildDecision({
        entityId: context.entityId,
        status: "UNVERIFIED",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: [],
        message: `PIPING_SPEC_UNVERIFIED: Piping Specification '${spec.id}' has sourceStatus '${spec.sourceStatus}' and cannot produce COMPATIBLE decisions.`,
        context,
        options,
      });
    }

    if (spec.evidenceIds && spec.evidenceIds.length > 0) {
      const specEvResolution = this.evidenceResolver.resolveEvidenceSet(spec.evidenceIds);
      if (!specEvResolution.allVerified) {
        return this.buildDecision({
          entityId: context.entityId,
          status: "UNVERIFIED",
          specRuleIds: [],
          compatibilityRuleIds: [],
          evidenceIds: [...spec.evidenceIds].sort(),
          conflictCodes: [],
          message: `PIPING_SPEC_EVIDENCE_UNVERIFIED: Piping Specification '${spec.id}' references unverified or missing evidence.`,
          context,
          options,
        });
      }
    }

    // 6. Delegate to PipingSpecResolver (SPEC-01 -> NORM-13 -> NORM-09)
    const resolutionContext: PipingSpecResolutionContext = {
      specificationId: spec.id,
      componentType: context.componentType,
      nominalSize: context.nominalSize,
      schedule: context.schedule,
      materialId: context.materialId,
      fittingType: context.fittingType,
      connectionType: context.connectionType,
      dimensionalStandardId: context.dimensionalStandard,
      productStandardId: context.productStandard,
      ratingSystem: context.ratingSystem,
      ratingValue: context.pressureRating,
      designCodeId: context.designCodeId,
      evidenceIds: context.evidenceIds,
    };

    const contextValidation = validatePipingSpecResolutionContext(resolutionContext);
    if (!contextValidation.valid) {
      return this.buildDecision({
        entityId: context.entityId,
        status: "INVALID",
        specRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        conflictCodes: ["INVALID_PIPING_SPEC_CONTEXT"],
        message: `INVALID_PIPING_SPEC_CONTEXT: ${contextValidation.errors.join("; ")}`,
        context,
        options,
      });
    }

    const specResolution = this.pipingSpecResolver.resolve(resolutionContext);

    let finalStatus: IsometricNormativeStatus = specResolution.status;
    const specRuleIds = [...(specResolution.matchedRuleIds ?? [])];
    const compatibilityRuleIds = [...(specResolution.compatibilityRuleIds ?? [])];
    const evidenceIds = [...(specResolution.evidenceIds ?? [])];
    const conflictCodes: string[] = [];
    let message = specResolution.message ?? `Resolved status '${specResolution.status}' for specification '${spec.id}'.`;

    const diagCode = extractDiagnosticCode(specResolution.message);
    if (finalStatus === "INVALID") {
      conflictCodes.push(diagCode ?? "NORMATIVE_RULE_CONFLICT");
    } else if (finalStatus === "INCOMPATIBLE" && diagCode) {
      conflictCodes.push(diagCode);
    }

    // 7. Optional Multi-Compatibility Integration (NORM-14-08)
    if (options?.multiCompatibilityQuery && this.specCompatibilityIntegrationEngine) {
      const multiIntegration = this.specCompatibilityIntegrationEngine.resolve({
        specResolution,
        compatibilityQuery: options.multiCompatibilityQuery,
      });
      finalStatus = multiIntegration.status;
      for (const rId of multiIntegration.compatibilityResult.matchedRuleIds) {
        compatibilityRuleIds.push(rId);
      }
      for (const eId of multiIntegration.evidenceIds) {
        evidenceIds.push(eId);
      }
      for (const cCode of multiIntegration.conflictCodes) {
        conflictCodes.push(cCode);
      }
      message = multiIntegration.message;
    }

    return this.buildDecision({
      entityId: context.entityId,
      status: finalStatus,
      specRuleIds,
      compatibilityRuleIds,
      evidenceIds,
      conflictCodes,
      message,
      context,
      spec,
      options,
    });
  }

  /**
   * Adapts and evaluates an `IsoNode` without mutating the source node.
   */
  public checkNode(
    node: IsoNode | (Partial<IsoNode> & Record<string, unknown>),
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision {
    const context = adaptIsoNodeToNormativeContext(node);
    return this.evaluateContext(context, options);
  }

  /**
   * Adapts and evaluates an `IsoSegment` without mutating the source segment.
   */
  public checkSegment(
    segment: IsoSegment | (Partial<IsoSegment> & Record<string, unknown>),
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision {
    const context = adaptIsoSegmentToNormativeContext(segment);
    return this.evaluateContext(context, options);
  }

  /**
   * Adapts and evaluates an `IsoFitting` without mutating the source fitting.
   */
  public checkFitting(
    fitting: IsoFitting | (Partial<IsoFitting> & Record<string, unknown>),
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision {
    const context = adaptIsoFittingToNormativeContext(fitting);
    return this.evaluateContext(context, options);
  }

  /**
   * Adapts and evaluates an `IsoPipingSupport` without mutating the source support.
   */
  public checkSupport(
    support: IsoPipingSupport | (Partial<IsoPipingSupport> & Record<string, unknown>),
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision {
    const context = adaptIsoSupportToNormativeContext(support);
    return this.evaluateContext(context, options);
  }

  /**
   * Adapts and evaluates a `PdiUniversalEntity` without mutating the source entity.
   */
  public checkUniversalEntity(
    entity: PdiUniversalEntity,
    options?: IsometricNormativeEvaluationOptions
  ): IsometricNormativeDecision {
    const context = adaptUniversalEntityToNormativeContext(entity);
    return this.evaluateContext(context, options);
  }

  /**
   * Evaluates Legacy PMS presets via `ILegacyPmsAdapter` and detects any conflict
   * with the authoritative Normative Engine decision (ARCH-01 & ARCH-02).
   */
  private evaluateLegacyPms(
    context: IsometricNormativeContext,
    normativeStatus: IsometricNormativeStatus,
    legacySetup?: IsometricNormativeEvaluationOptions["legacyProjectSetup"]
  ): {
    status: IsometricNormativeStatus;
    snapshot?: LegacyPmsComparisonSnapshot;
    conflictCode?: string;
  } {
    return this.legacyPmsAdapter.evaluate(context, normativeStatus, legacySetup);
  }

  /**
   * Builds and freezes the final `IsometricNormativeDecision` and its provenance traceability.
   */
  private buildDecision(params: {
    entityId: string;
    status: IsometricNormativeStatus;
    specRuleIds: readonly string[];
    compatibilityRuleIds: readonly string[];
    evidenceIds: readonly string[];
    conflictCodes: readonly string[];
    message: string;
    context: IsometricNormativeContext;
    spec?: PipingSpecification;
    options?: IsometricNormativeEvaluationOptions;
  }): IsometricNormativeDecision {
    const legacyEvaluation = this.evaluateLegacyPms(
      params.context,
      params.status,
      params.options?.legacyProjectSetup
    );

    // ARCH-02-FIX-01: Normative Engine is the SOLE authority for final status.
    // Legacy PMS provides comparison snapshot / conflict codes only, NEVER altering the decision status.
    const finalStatus = params.status;
    const allConflictCodes = [...params.conflictCodes];
    if (legacyEvaluation.conflictCode) {
      allConflictCodes.push(legacyEvaluation.conflictCode);
    }

    const sortedSpecRuleIds = Object.freeze(Array.from(new Set(params.specRuleIds)).sort());
    const sortedCompatRuleIds = Object.freeze(Array.from(new Set(params.compatibilityRuleIds)).sort());
    const sortedRuleIds = Object.freeze(
      Array.from(new Set([...sortedSpecRuleIds, ...sortedCompatRuleIds])).sort()
    );
    const sortedEvidenceIds =
      finalStatus === "INVALID"
        ? Object.freeze([] as string[])
        : Object.freeze(Array.from(new Set(params.evidenceIds)).sort());
    const sortedConflictCodes = Object.freeze(Array.from(new Set(allConflictCodes)).sort());

    // Build evidence chain from resolved evidence records without fabricating any data
    const verifiedValues = params.options?.verifiedValues ?? [];
    const evidenceChainItems: IsometricNormativeEvidenceTraceItem[] = [];
    const matchedVerifiedValues: typeof verifiedValues[number][] = [];

    for (const evId of sortedEvidenceIds) {
      const resolved = this.evidenceResolver.resolveEvidence(evId);
      if (resolved.evidence) {
        const linkedValues = verifiedValues.filter(
          (vv) =>
            vv.verificationStatus === "VERIFIED" &&
            Array.isArray(vv.evidenceIds) &&
            vv.evidenceIds.includes(resolved.evidence!.evidenceId)
        );
        for (const lv of linkedValues) {
          if (!matchedVerifiedValues.includes(lv)) {
            matchedVerifiedValues.push(Object.freeze({ ...lv }));
          }
        }
        evidenceChainItems.push(
          Object.freeze({
            evidenceId: resolved.evidence.evidenceId,
            standardId: String(resolved.evidence.standardId),
            editionId: resolved.evidence.editionId,
            clauseReference: resolved.evidence.clauseReference,
            sourceType: resolved.evidence.sourceType,
            sourceReference: resolved.evidence.sourceReference,
            verificationStatus: resolved.evidence.verificationStatus,
            verifiedValues: Object.freeze(linkedValues.map((v) => Object.freeze({ ...v }))),
          })
        );
      }
    }

    const traceabilityLock = this.traceabilityEngine.lock({
      matchedRuleIds: sortedRuleIds,
      evidenceIds: sortedEvidenceIds,
      conflictCodes: sortedConflictCodes,
    });

    const traceability: IsometricNormativeTraceability = Object.freeze({
      entityId: params.entityId,
      ...(params.spec?.id ?? params.context.pipingSpecId
        ? { pipingSpecId: params.spec?.id ?? params.context.pipingSpecId }
        : {}),
      ...(params.spec?.designCodeId ?? params.context.designCodeId
        ? { designCodeId: String(params.spec?.designCodeId ?? params.context.designCodeId) }
        : {}),
      specRuleIds: sortedSpecRuleIds,
      compatibilityRuleIds: sortedCompatRuleIds,
      matchedRuleIds: traceabilityLock.matchedRuleIds,
      verifiedValues: Object.freeze(matchedVerifiedValues),
      evidenceIds: traceabilityLock.evidenceIds,
      evidenceChain: Object.freeze(evidenceChainItems),
      conflictCodes: traceabilityLock.conflictCodes,
      traceabilityLock,
    });

    const finalMessage =
      legacyEvaluation.snapshot?.hasConflict && legacyEvaluation.snapshot.message
        ? `${params.message} | ${legacyEvaluation.snapshot.message}`
        : params.message;

    return Object.freeze({
      entityId: params.entityId,
      status: finalStatus,
      ruleIds: traceabilityLock.matchedRuleIds,
      specRuleIds: sortedSpecRuleIds,
      compatibilityRuleIds: sortedCompatRuleIds,
      evidenceIds: traceabilityLock.evidenceIds,
      conflictCodes: traceabilityLock.conflictCodes,
      traceability,
      ...(legacyEvaluation.snapshot ? { legacyPmsComparison: legacyEvaluation.snapshot } : {}),
      message: finalMessage,
    });
  }
}

/**
 * Default singleton bridge instance wired to the default normative registries.
 */
export const defaultIsometricNormativeBridge = new IsometricNormativeBridge();
