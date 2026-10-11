/**
 * PDI NORMATIVE ENGINE — COMPONENT SELECTION ENGINE
 * Reference: COMPONENT-01 (Component Selection Engine)
 * 
 * Moteur déterministe de sélection des composants logiciels et industriels
 * fondé exclusivement sur SPEC-01 (PipingSpecResolver), NORM-13 (NormativeCompatibilityEngine)
 * et NORM-09 (EvidenceResolver).
 */

import type {
  ComponentCandidate,
  ComponentSelectionContext,
  ComponentSelectionResult,
  IComponentSelectionEngine,
} from "../types/componentSelectionTypes";
import type { IPipingSpecResolver, PipingSpecResolutionContext } from "../types/pipingSpecResolverTypes";
import type { INormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import {
  validateComponentCandidate,
  validateComponentSelectionContext,
} from "../validators/componentSelectionValidator";

export class ComponentSelectionEngine implements IComponentSelectionEngine {
  private readonly pipingSpecResolver: IPipingSpecResolver;
  private readonly evidenceResolver: INormativeEvidenceResolver;

  constructor(
    pipingSpecResolver: IPipingSpecResolver,
    evidenceResolver: INormativeEvidenceResolver
  ) {
    if (!pipingSpecResolver || typeof pipingSpecResolver.resolve !== "function") {
      throw new Error(
        "ComponentSelectionEngine: pipingSpecResolver must be an explicit IPipingSpecResolver instance."
      );
    }
    this.pipingSpecResolver = pipingSpecResolver;

    if (!evidenceResolver || typeof evidenceResolver.resolveEvidenceSet !== "function") {
      throw new Error(
        "ComponentSelectionEngine: evidenceResolver must be an explicit INormativeEvidenceResolver instance."
      );
    }
    this.evidenceResolver = evidenceResolver;
  }

  public select(
    candidate: ComponentCandidate,
    context: ComponentSelectionContext
  ): ComponentSelectionResult {
    // 1. Validate candidate
    const candValidation = validateComponentCandidate(candidate);
    if (!candValidation.valid) {
      return {
        status: "INVALID",
        candidateId: typeof candidate?.candidateId === "string" ? candidate.candidateId : "",
        specificationId: typeof context?.specificationId === "string" ? context.specificationId : "",
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `INVALID_CANDIDATE: ${candValidation.errors.join("; ")}`,
      };
    }

    // 2. Validate context
    const ctxValidation = validateComponentSelectionContext(context);
    if (!ctxValidation.valid) {
      return {
        status: "INVALID",
        candidateId: candidate.candidateId,
        specificationId: typeof context?.specificationId === "string" ? context.specificationId : "",
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `INVALID_CONTEXT: ${ctxValidation.errors.join("; ")}`,
      };
    }

    // 3. Check candidate ↔ context coherence (Section 8)
    if (candidate.componentType !== context.componentType) {
      return {
        status: "INVALID",
        candidateId: candidate.candidateId,
        specificationId: context.specificationId,
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `COHERENCE_MISMATCH: candidate componentType '${candidate.componentType}' does not match context componentType '${context.componentType}'.`,
      };
    }

    const checkFields: Array<keyof ComponentSelectionContext> = [
      "nominalSize",
      "schedule",
      "materialId",
      "connectionType",
      "productStandardId",
      "dimensionalStandardId",
      "ratingSystem",
      "ratingValue",
      "fittingType",
      "valveType",
      "materialForm",
    ];

    for (const field of checkFields) {
      const candVal = candidate[field as keyof ComponentCandidate];
      const ctxVal = context[field];
      if (candVal !== undefined && ctxVal !== undefined && candVal !== ctxVal) {
        return {
          status: "INVALID",
          candidateId: candidate.candidateId,
          specificationId: context.specificationId,
          matchedRuleIds: [],
          compatibilityRuleIds: [],
          evidenceIds: [],
          message: `COHERENCE_MISMATCH: candidate ${field} '${candVal}' does not match context ${field} '${ctxVal}'.`,
        };
      }
    }

    // 4. Build SPEC-01 resolution context
    const specContext: PipingSpecResolutionContext = {
      specificationId: context.specificationId,
      componentType: context.componentType,
      nominalSize: candidate.nominalSize ?? context.nominalSize,
      schedule: candidate.schedule ?? context.schedule,
      materialId: candidate.materialId ?? context.materialId,
      fittingType: candidate.fittingType ?? context.fittingType,
      connectionType: candidate.connectionType ?? context.connectionType,
      dimensionalStandardId: candidate.dimensionalStandardId ?? context.dimensionalStandardId,
      productStandardId: candidate.productStandardId ?? context.productStandardId,
      ratingSystem: candidate.ratingSystem ?? context.ratingSystem,
      ratingValue: candidate.ratingValue ?? context.ratingValue,
    };

    // 5. Call PipingSpecResolver
    const specResult = this.pipingSpecResolver.resolve(specContext);

    // 6. Map specResult status
    let mappedStatus: "ELIGIBLE" | "INELIGIBLE" | "UNVERIFIED" | "INVALID";
    if (specResult.status === "COMPATIBLE") {
      mappedStatus = "ELIGIBLE";
    } else if (specResult.status === "INCOMPATIBLE") {
      mappedStatus = "INELIGIBLE";
    } else if (specResult.status === "UNVERIFIED") {
      mappedStatus = "UNVERIFIED";
    } else {
      mappedStatus = "INVALID";
    }

    // 7. Check candidate's OWN evidence if present
    const candidateEvidenceIds = candidate.evidenceIds ? candidate.evidenceIds.slice().sort() : [];
    if (candidateEvidenceIds.length > 0) {
      const candEvidenceRes = this.evidenceResolver.resolveEvidenceSet(candidateEvidenceIds);
      if (!candEvidenceRes.allVerified || candEvidenceRes.totalRequested === 0) {
        if (mappedStatus === "ELIGIBLE") {
          mappedStatus = "UNVERIFIED";
        }
      }
    }

    // Sort & deduplicate IDs
    const matchedRuleIds = (specResult.matchedRuleIds ?? []).slice().sort();
    const compatibilityRuleIds = (specResult.compatibilityRuleIds ?? []).slice().sort();

    // Aggregated evidenceIds: combine specResult evidence with verified candidate evidence (if candidate evidence is verified)
    let aggregatedEvidenceIds: string[] = [];
    if (mappedStatus === "ELIGIBLE" || mappedStatus === "UNVERIFIED") {
      const combined = new Set<string>();
      for (const evId of specResult.evidenceIds ?? []) {
        combined.add(evId);
      }
      if (candidateEvidenceIds.length > 0) {
        const candEvidenceRes = this.evidenceResolver.resolveEvidenceSet(candidateEvidenceIds);
        if (candEvidenceRes.allVerified) {
          for (const evId of candidateEvidenceIds) {
            combined.add(evId);
          }
        }
      }
      aggregatedEvidenceIds = Array.from(combined).sort();
    }

    return {
      status: mappedStatus,
      candidateId: candidate.candidateId,
      specificationId: context.specificationId,
      matchedRuleIds,
      compatibilityRuleIds,
      evidenceIds: aggregatedEvidenceIds,
      message: specResult.message ?? `Component selection result: ${mappedStatus}`,
    };
  }
}
