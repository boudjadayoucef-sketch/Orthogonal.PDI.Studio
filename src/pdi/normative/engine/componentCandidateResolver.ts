/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE RESOLVER
 * Reference: COMPONENT-03 (Component Candidate Registry & Resolver)
 * 
 * Résolveur déterministe de candidats composants.
 * Délègue l'admissibilité normative exclusivement à COMPONENT-02 (ComponentCandidateSelectionEngine).
 * Zéro ranking, zéro fuzzy matching, zéro promotion d'evidence, zéro conversion implicite.
 */

import type {
  ComponentCandidate,
  ComponentSelectionContext,
} from "../types/componentSelectionTypes";
import type {
  ComponentCandidateSelectionInput,
  IComponentCandidateSelectionEngine,
} from "../types/componentCandidateSelectionTypes";
import type {
  ComponentCandidateResolutionResult,
  ComponentCandidateResolutionStatus,
  IComponentCandidateRegistry,
  IComponentCandidateResolver,
} from "../types/componentCandidateRegistryTypes";
import { validateResolverContextCoherence } from "../validators/componentCandidateRegistryValidator";

export class ComponentCandidateResolver implements IComponentCandidateResolver {
  private readonly registry: IComponentCandidateRegistry;
  private readonly selectionEngine: IComponentCandidateSelectionEngine;

  constructor(
    registry: IComponentCandidateRegistry,
    selectionEngine: IComponentCandidateSelectionEngine
  ) {
    if (!registry || typeof registry.get !== "function") {
      throw new Error(
        "ComponentCandidateResolver: registry must be an explicit IComponentCandidateRegistry instance."
      );
    }
    if (!selectionEngine || typeof selectionEngine.selectCandidate !== "function") {
      throw new Error(
        "ComponentCandidateResolver: selectionEngine must be an explicit IComponentCandidateSelectionEngine instance."
      );
    }
    this.registry = registry;
    this.selectionEngine = selectionEngine;
  }

  /**
   * Résolution directe par candidateId exact.
   * Purement déterministe: pas de création automatique, pas de fuzzy matching.
   */
  public resolve(candidateId: string): ComponentCandidate | undefined {
    if (typeof candidateId !== "string" || candidateId.trim().length === 0) {
      return undefined;
    }
    return this.registry.get(candidateId);
  }

  /**
   * Résout un candidat composant en interrogeant le registre et en déléguant
   * l'évaluation d'admissibilité à COMPONENT-02.
   */
  public resolveBySpecification(
    specificationId: string,
    context: ComponentSelectionContext
  ): ComponentCandidateResolutionResult {
    // 1. Validation structurelle de cohérence du contexte
    const coherence = validateResolverContextCoherence(specificationId, context);
    if (!coherence.valid) {
      return {
        status: "INVALID",
        specificationId: typeof specificationId === "string" ? specificationId : "",
        componentType: context?.componentType ?? "PIPE",
        selectedCandidateId: undefined,
        candidateIds: [],
        candidates: [],
        evaluatedCandidateIds: [],
        eligibleCandidateIds: [],
        unverifiedCandidateIds: [],
        invalidCandidateIds: [],
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `INVALID_CONTEXT: ${coherence.errors.join("; ")}`,
      };
    }

    // 2. Récupération des candidats du registre et filtrage par componentType
    const allCandidates = this.registry.list();
    const matchingCandidates = allCandidates.filter(
      (c) => c.componentType === context.componentType
    );

    // 3. Aucun candidat disponible dans le registre pour ce componentType
    if (matchingCandidates.length === 0) {
      return {
        status: "NO_CANDIDATE",
        specificationId,
        componentType: context.componentType,
        selectedCandidateId: undefined,
        candidateIds: [],
        candidates: [],
        evaluatedCandidateIds: [],
        eligibleCandidateIds: [],
        unverifiedCandidateIds: [],
        invalidCandidateIds: [],
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `NO_CANDIDATE: No candidate found in registry with componentType '${context.componentType}'.`,
      };
    }

    // 4. Délégation stricte à COMPONENT-02
    const selectionInput: ComponentCandidateSelectionInput = {
      specificationId,
      componentType: context.componentType,
      candidates: matchingCandidates,
      context,
    };

    const selRes = this.selectionEngine.selectCandidate(selectionInput);

    // 5. Mapping univoque vers le résultat COMPONENT-03
    let status: ComponentCandidateResolutionStatus;
    let selectedCandidateId: string | undefined = undefined;
    let candidateIds: readonly string[] = [];
    let candidates: readonly ComponentCandidate[] = [];

    if (selRes.status === "SELECTED") {
      status = "RESOLVED";
      selectedCandidateId = selRes.selectedCandidateId;
      candidateIds = selectedCandidateId ? [selectedCandidateId] : [];
      if (selectedCandidateId) {
        const found = this.registry.get(selectedCandidateId);
        candidates = found ? [found] : [];
      }
    } else if (selRes.status === "UNVERIFIED_CANDIDATES") {
      status = "UNVERIFIED";
      selectedCandidateId = undefined;
      candidateIds = selRes.unverifiedCandidateIds;
      candidates = [];
    } else if (selRes.status === "NO_ELIGIBLE_CANDIDATE") {
      status = "NO_CANDIDATE";
      selectedCandidateId = undefined;
      candidateIds = [];
      candidates = [];
    } else if (
      selRes.status === "INVALID" &&
      (selRes.message.includes("MULTIPLE_ELIGIBLE_CANDIDATES") ||
        selRes.eligibleCandidateIds.length > 1)
    ) {
      status = "AMBIGUOUS";
      selectedCandidateId = undefined;
      candidateIds = selRes.eligibleCandidateIds;
      candidates = [];
    } else {
      status = "INVALID";
      selectedCandidateId = undefined;
      candidateIds = [];
      candidates = [];
    }

    const matchedRuleIds = (selRes.matchedRuleIds ?? []).slice().sort();
    const compatibilityRuleIds = (selRes.compatibilityRuleIds ?? []).slice().sort();
    const evidenceIds = (selRes.evidenceIds ?? []).slice().sort();

    return {
      status,
      specificationId,
      componentType: context.componentType,
      selectedCandidateId,
      candidateIds,
      candidates,
      evaluatedCandidateIds: selRes.evaluatedCandidateIds,
      eligibleCandidateIds: selRes.eligibleCandidateIds,
      unverifiedCandidateIds: selRes.unverifiedCandidateIds,
      invalidCandidateIds: selRes.invalidCandidateIds,
      matchedRuleIds,
      compatibilityRuleIds,
      evidenceIds,
      message: selRes.message,
    };
  }

  /**
   * Retourne la liste des candidats admissibles retenus (1 candidat si RESOLVED, vide sinon).
   */
  public resolveCandidates(
    specificationId: string,
    context: ComponentSelectionContext
  ): readonly ComponentCandidate[] {
    const res = this.resolveBySpecification(specificationId, context);
    return res.candidates ?? [];
  }
}
