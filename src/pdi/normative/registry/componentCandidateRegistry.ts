/**
 * PDI NORMATIVE ENGINE — COMPONENT CANDIDATE REGISTRY
 * Reference: COMPONENT-03 (Component Candidate Registry & Resolver)
 * 
 * Registre déterministe en mémoire pour candidats composants.
 * Sans singleton, sans données préchargées, sans fallback, protégé contre mutation externe.
 */

import type { ComponentCandidate } from "../types/componentSelectionTypes";
import type { IComponentCandidateRegistry } from "../types/componentCandidateRegistryTypes";
import { validateComponentCandidate } from "../validators/componentCandidateRegistryValidator";

export class ComponentCandidateRegistry implements IComponentCandidateRegistry {
  private readonly candidates: Map<string, ComponentCandidate> = new Map();

  /**
   * Enregistre un candidat composant.
   * Valide structurellement le candidat et interdit strictement les doublons d'ID.
   */
  public register(candidate: ComponentCandidate): void {
    const validation = validateComponentCandidate(candidate);
    if (!validation.valid) {
      throw new Error(
        `INVALID_CANDIDATE: Candidate validation failed: ${validation.errors.join("; ")}`
      );
    }

    if (this.candidates.has(candidate.candidateId)) {
      throw new Error(
        `DUPLICATE_CANDIDATE_ID: Candidate with ID '${candidate.candidateId}' already exists in registry.`
      );
    }

    // Clone et protection contre les mutations ultérieures
    const candidateCopy: ComponentCandidate = Object.freeze({
      ...candidate,
      evidenceIds: candidate.evidenceIds ? Object.freeze([...candidate.evidenceIds]) : undefined,
    });

    this.candidates.set(candidate.candidateId, candidateCopy);
  }

  /**
   * Récupère un candidat par son identifiant unique exact.
   */
  public get(candidateId: string): ComponentCandidate | undefined {
    if (typeof candidateId !== "string" || candidateId.trim().length === 0) {
      return undefined;
    }
    const cand = this.candidates.get(candidateId);
    if (!cand) return undefined;
    return Object.freeze({
      ...cand,
      evidenceIds: cand.evidenceIds ? Object.freeze([...cand.evidenceIds]) : undefined,
    });
  }

  /**
   * Vérifie si un candidat existe dans le registre.
   */
  public has(candidateId: string): boolean {
    if (typeof candidateId !== "string" || candidateId.trim().length === 0) {
      return false;
    }
    return this.candidates.has(candidateId);
  }

  /**
   * Retourne la liste immuable de tous les candidats enregistrés, triée par candidateId pour strict déterminisme.
   */
  public list(): readonly ComponentCandidate[] {
    const sorted = Array.from(this.candidates.values()).sort((a, b) =>
      a.candidateId.localeCompare(b.candidateId)
    );
    const frozenList = sorted.map((cand) =>
      Object.freeze({
        ...cand,
        evidenceIds: cand.evidenceIds ? Object.freeze([...cand.evidenceIds]) : undefined,
      })
    );
    return Object.freeze(frozenList);
  }

  /**
   * Nombre de candidats enregistrés.
   */
  public count(): number {
    return this.candidates.size;
  }

  /**
   * Vide l'intégralité du registre.
   */
  public clear(): void {
    this.candidates.clear();
  }
}
