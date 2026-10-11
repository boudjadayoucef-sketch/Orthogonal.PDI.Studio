/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE SELECTION ENGINE
 * Reference: COMPONENT-02 (Deterministic Component Candidate Selection)
 * 
 * Moteur déterministe de sélection de candidats composants basé exclusivement
 * sur COMPONENT-01 (IComponentSelectionEngine).
 */

import type {
  IComponentSelectionEngine,
} from "../types/componentSelectionTypes";
import type {
  ComponentCandidateSelectionInput,
  ComponentCandidateSelectionResult,
  ComponentCandidateSelectionTrace,
  IComponentCandidateSelectionEngine,
} from "../types/componentCandidateSelectionTypes";
import { validateComponentCandidateSelectionInput } from "../validators/componentCandidateSelectionValidator";

export class ComponentCandidateSelectionEngine
  implements IComponentCandidateSelectionEngine {
  private readonly componentSelectionEngine: IComponentSelectionEngine;

  constructor(componentSelectionEngine: IComponentSelectionEngine) {
    if (
      !componentSelectionEngine ||
      typeof componentSelectionEngine.select !== "function"
    ) {
      throw new Error(
        "ComponentCandidateSelectionEngine: componentSelectionEngine must be an explicit IComponentSelectionEngine instance."
      );
    }
    this.componentSelectionEngine = componentSelectionEngine;
  }

  public selectCandidate(
    input: ComponentCandidateSelectionInput
  ): ComponentCandidateSelectionResult {
    // 1. Validate input structure
    const val = validateComponentCandidateSelectionInput(input);
    if (!val.valid) {
      return {
        status: "INVALID",
        specificationId:
          typeof input?.specificationId === "string" ? input.specificationId : "",
        selectedCandidateId: undefined,
        evaluatedCandidateIds: [],
        eligibleCandidateIds: [],
        ineligibleCandidateIds: [],
        unverifiedCandidateIds: [],
        invalidCandidateIds: [],
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        traceByCandidate: [],
        message: `INVALID_INPUT: ${val.errors.join("; ")}`,
      };
    }

    // 2. Empty candidates array
    if (input.candidates.length === 0) {
      return {
        status: "NO_ELIGIBLE_CANDIDATE",
        specificationId: input.specificationId,
        selectedCandidateId: undefined,
        evaluatedCandidateIds: [],
        eligibleCandidateIds: [],
        ineligibleCandidateIds: [],
        unverifiedCandidateIds: [],
        invalidCandidateIds: [],
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        traceByCandidate: [],
        message: "NO_ELIGIBLE_CANDIDATE: Candidates list is empty.",
      };
    }

    // 3. Evaluate each candidate via COMPONENT-01
    const traces: ComponentCandidateSelectionTrace[] = [];
    const evaluatedSet = new Set<string>();
    const eligibleSet = new Set<string>();
    const ineligibleSet = new Set<string>();
    const unverifiedSet = new Set<string>();
    const invalidSet = new Set<string>();

    const matchedRuleSet = new Set<string>();
    const compatibilityRuleSet = new Set<string>();
    const evidenceSet = new Set<string>();

    for (const candidate of input.candidates) {
      const res = this.componentSelectionEngine.select(candidate, input.context);

      const candidateId = candidate.candidateId;
      evaluatedSet.add(candidateId);

      const trace: ComponentCandidateSelectionTrace = {
        candidateId,
        status: res.status,
        matchedRuleIds: (res.matchedRuleIds ?? []).slice().sort(),
        compatibilityRuleIds: (res.compatibilityRuleIds ?? []).slice().sort(),
        evidenceIds: (res.evidenceIds ?? []).slice().sort(),
        message: res.message ?? "",
      };
      traces.push(trace);

      for (const id of trace.matchedRuleIds) {
        matchedRuleSet.add(id);
      }
      for (const id of trace.compatibilityRuleIds) {
        compatibilityRuleSet.add(id);
      }
      for (const id of trace.evidenceIds) {
        evidenceSet.add(id);
      }

      if (res.status === "ELIGIBLE") {
        eligibleSet.add(candidateId);
      } else if (res.status === "INELIGIBLE") {
        ineligibleSet.add(candidateId);
      } else if (res.status === "UNVERIFIED") {
        unverifiedSet.add(candidateId);
      } else {
        invalidSet.add(candidateId);
      }
    }

    // 4. Sort all sets & traces for strict determinism
    const evaluatedCandidateIds = Array.from(evaluatedSet).sort();
    const eligibleCandidateIds = Array.from(eligibleSet).sort();
    const ineligibleCandidateIds = Array.from(ineligibleSet).sort();
    const unverifiedCandidateIds = Array.from(unverifiedSet).sort();
    const invalidCandidateIds = Array.from(invalidSet).sort();

    const matchedRuleIds = Array.from(matchedRuleSet).sort();
    const compatibilityRuleIds = Array.from(compatibilityRuleSet).sort();
    const evidenceIds = Array.from(evidenceSet).sort();

    const traceByCandidate = traces.sort((a, b) =>
      a.candidateId.localeCompare(b.candidateId)
    );

    // 5. Determine status and selectedCandidateId
    let status: "SELECTED" | "NO_ELIGIBLE_CANDIDATE" | "UNVERIFIED_CANDIDATES" | "INVALID";
    let selectedCandidateId: string | undefined = undefined;
    let message = "";

    if (eligibleCandidateIds.length === 1) {
      status = "SELECTED";
      selectedCandidateId = eligibleCandidateIds[0];
      message = `Selected candidate '${selectedCandidateId}' successfully.`;
    } else if (eligibleCandidateIds.length > 1) {
      status = "INVALID";
      selectedCandidateId = undefined;
      message = `MULTIPLE_ELIGIBLE_CANDIDATES: Found ${eligibleCandidateIds.length} eligible candidates (${eligibleCandidateIds.join(
        ", "
      )}). Selection must be strictly deterministic with exactly one eligible candidate.`;
    } else {
      selectedCandidateId = undefined;
      if (unverifiedCandidateIds.length > 0) {
        status = "UNVERIFIED_CANDIDATES";
        message = `UNVERIFIED_CANDIDATES: No eligible candidate found, but ${unverifiedCandidateIds.length} candidate(s) are unverified (${unverifiedCandidateIds.join(
          ", "
        )}).`;
      } else {
        status = "NO_ELIGIBLE_CANDIDATE";
        message = "NO_ELIGIBLE_CANDIDATE: No eligible candidates found.";
      }
    }

    return {
      status,
      specificationId: input.specificationId,
      selectedCandidateId,
      evaluatedCandidateIds,
      eligibleCandidateIds,
      ineligibleCandidateIds,
      unverifiedCandidateIds,
      invalidCandidateIds,
      matchedRuleIds,
      compatibilityRuleIds,
      evidenceIds,
      traceByCandidate,
      message,
    };
  }
}
