/**
 * PDI NORMATIVE ENGINE — COMPONENT RESOLUTION ENGINE
 * Reference: COMPONENT-04 (Component Resolution Orchestrator)
 * 
 * Orchestrateur déterministe de résolution de composants.
 * Délègue l'intégralité de la résolution normative à COMPONENT-03 (IComponentCandidateResolver).
 * Zéro logique normative parallèle, zéro catalogue direct, zéro ranking arbitraire.
 */

import type {
  ComponentResolutionRequest,
  ComponentResolutionResult,
  ComponentResolutionStatus,
  IComponentResolutionEngine,
} from "../types/componentResolutionTypes";
import type { IComponentCandidateResolver } from "../types/componentCandidateRegistryTypes";
import { validateComponentResolutionRequest } from "../validators/componentResolutionValidator";

export class ComponentResolutionEngine implements IComponentResolutionEngine {
  private readonly candidateResolver: IComponentCandidateResolver;

  constructor(candidateResolver: IComponentCandidateResolver) {
    if (
      !candidateResolver ||
      typeof candidateResolver.resolveBySpecification !== "function"
    ) {
      throw new Error(
        "ComponentResolutionEngine: candidateResolver must be an explicit IComponentCandidateResolver instance."
      );
    }
    this.candidateResolver = candidateResolver;
  }

  /**
   * Orchestre la résolution d'un composant pour une spécification et un contexte donnés.
   */
  public resolve(
    request: ComponentResolutionRequest
  ): ComponentResolutionResult {
    // 1. Validation de la requête
    const val = validateComponentResolutionRequest(request);
    if (!val.valid) {
      return {
        status: "INVALID",
        specificationId:
          typeof request?.specificationId === "string"
            ? request.specificationId
            : "",
        componentType: request?.context?.componentType ?? "PIPE",
        resolvedCandidateId: undefined,
        evaluatedCandidateIds: [],
        eligibleCandidateIds: [],
        unverifiedCandidateIds: [],
        invalidCandidateIds: [],
        matchedRuleIds: [],
        compatibilityRuleIds: [],
        evidenceIds: [],
        message: `INVALID_REQUEST: ${val.errors.join("; ")}`,
      };
    }

    // 2. Délégation exclusive à COMPONENT-03
    const resolverRes = this.candidateResolver.resolveBySpecification(
      request.specificationId,
      request.context
    );

    // 3. Mapping strict des statuts et sécurité d'admissibilité
    let status: ComponentResolutionStatus;
    let resolvedCandidateId: string | undefined = undefined;
    let message = resolverRes.message ?? "";

    if (resolverRes.status === "RESOLVED") {
      if (
        typeof resolverRes.selectedCandidateId === "string" &&
        resolverRes.selectedCandidateId.trim().length > 0
      ) {
        status = "RESOLVED";
        resolvedCandidateId = resolverRes.selectedCandidateId;
      } else {
        // Règle 10: RESOLVED sans selectedCandidateId est formellement interdit
        status = "INVALID";
        resolvedCandidateId = undefined;
        message = `INVALID_RESOLUTION: Resolver returned RESOLVED without a valid selectedCandidateId.`;
      }
    } else if (resolverRes.status === "NO_CANDIDATE") {
      status = "NO_CANDIDATE";
      resolvedCandidateId = undefined;
    } else if (resolverRes.status === "UNVERIFIED") {
      status = "UNVERIFIED";
      resolvedCandidateId = undefined;
    } else if (resolverRes.status === "AMBIGUOUS") {
      // Règle 11: Ambiguïté préservée, aucun candidat arbitrairement sélectionné
      status = "AMBIGUOUS";
      resolvedCandidateId = undefined;
    } else {
      status = "INVALID";
      resolvedCandidateId = undefined;
    }

    // 4. Extraction et tri déterministe des identifiants et des traces normatives
    const evaluatedCandidateIds = [
      ...(resolverRes.evaluatedCandidateIds ?? []),
    ].sort();
    const eligibleCandidateIds = [
      ...(resolverRes.eligibleCandidateIds ?? []),
    ].sort();
    const unverifiedCandidateIds = [
      ...(resolverRes.unverifiedCandidateIds ?? []),
    ].sort();
    const invalidCandidateIds = [
      ...(resolverRes.invalidCandidateIds ?? []),
    ].sort();

    const matchedRuleIds = [...(resolverRes.matchedRuleIds ?? [])].sort();
    const compatibilityRuleIds = [
      ...(resolverRes.compatibilityRuleIds ?? []),
    ].sort();
    const evidenceIds = [...(resolverRes.evidenceIds ?? [])].sort();

    return {
      status,
      specificationId: request.specificationId,
      componentType: request.context.componentType,
      resolvedCandidateId,
      evaluatedCandidateIds,
      eligibleCandidateIds,
      unverifiedCandidateIds,
      invalidCandidateIds,
      matchedRuleIds,
      compatibilityRuleIds,
      evidenceIds,
      message,
    };
  }
}
