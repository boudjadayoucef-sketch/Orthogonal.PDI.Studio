/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION REGISTRY
 * Reference: PATCH NORM-07 (Piping Specification Engine / Spec Builder)
 * 
 * Registre central, déterministe et immuable des spécifications de tuyauterie.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Aucune spécification inventée en production (pas de CS150/CS300 d'exemple dans ce registre).
 * - En l'absence de spécifications réelles vérifiées ou licenciées,
 *   ce registre contient exactement 0 enregistrement.
 */

import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { DesignCodeId } from "../types/normativeCoreTypes";

/**
 * Registre immuable des spécifications de tuyauterie.
 * Initialisé à 0 enregistrement conformément aux directives NORM-07.
 */
export const PIPING_SPEC_REGISTRY: readonly PipingSpecification[] = Object.freeze([]);

/**
 * Recherche une spécification par son identifiant unique.
 */
export function getPipingSpecById(id: string): PipingSpecification | undefined {
  return PIPING_SPEC_REGISTRY.find((spec) => spec.id === id);
}

/**
 * Recherche une spécification par son code métier unique (ex: "CS150").
 */
export function getPipingSpecByCode(code: string): PipingSpecification | undefined {
  return PIPING_SPEC_REGISTRY.find((spec) => spec.code === code);
}

/**
 * Recherche les spécifications associées à un code de conception donné (ex: "ASME-B31.3").
 */
export function getPipingSpecsByDesignCode(designCodeId: DesignCodeId): readonly PipingSpecification[] {
  return PIPING_SPEC_REGISTRY.filter((spec) => spec.designCodeId === designCodeId);
}

/**
 * Recherche les spécifications autorisant un identifiant matériau donné.
 */
export function getPipingSpecsByMaterial(materialId: string): readonly PipingSpecification[] {
  return PIPING_SPEC_REGISTRY.filter((spec) =>
    spec.materialReferenceIds.includes(materialId) ||
    spec.pipeRules.some((r) => r.materialId === materialId) ||
    spec.fittingRules.some((r) => r.materialId === materialId) ||
    spec.flangeRules.some((r) => r.materialId === materialId) ||
    spec.valveRules.some((r) => r.materialId === materialId)
  );
}

/**
 * Retourne la liste complète des spécifications enregistrées.
 */
export function getAllPipingSpecs(): readonly PipingSpecification[] {
  return PIPING_SPEC_REGISTRY;
}
