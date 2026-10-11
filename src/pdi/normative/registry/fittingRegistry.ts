/**
 * PDI NORMATIVE ENGINE — FITTING DIMENSIONAL REGISTRY
 * Reference: PATCH NORM-03
 * 
 * Registre central, déterministe et immuable des raccords dimensionnels.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Aucune donnée dimensionnelle non vérifiée ne doit être générée ou calculée mécaniquement.
 * - En l'absence de données sources dimensionnelles vérifiées ou licenciées,
 *   ce registre contient exactement 0 enregistrement.
 */

import type { FittingDimensionalRecord, FittingType } from "../types/fittingTypes";
import type { ProductStandardId } from "../types/normativeCoreTypes";

/**
 * Registre immuable des enregistrements dimensionnels de raccords.
 * Initialisé à 0 enregistrement conformément aux directives NORM-03.
 */
export const FITTING_DIMENSIONAL_REGISTRY: readonly FittingDimensionalRecord[] = Object.freeze([]);

/**
 * Recherche un raccord par son identifiant unique.
 */
export function getFittingById(id: string): FittingDimensionalRecord | undefined {
  return FITTING_DIMENSIONAL_REGISTRY.find((record) => record.id === id);
}

/**
 * Recherche les raccords associés à un standard produit donné (ex: ASME-B16.9, ASME-B16.11).
 */
export function getFittingsByStandard(standardId: ProductStandardId): readonly FittingDimensionalRecord[] {
  return FITTING_DIMENSIONAL_REGISTRY.filter((record) => record.standardId === standardId);
}

/**
 * Recherche les raccords par famille de raccord (ex: ELBOW, TEE, REDUCER).
 */
export function getFittingsByType(type: FittingType): readonly FittingDimensionalRecord[] {
  return FITTING_DIMENSIONAL_REGISTRY.filter((record) => record.fittingType === type);
}

/**
 * Retourne la liste complète de tous les raccords enregistrés.
 */
export function getAllFittings(): readonly FittingDimensionalRecord[] {
  return FITTING_DIMENSIONAL_REGISTRY;
}
