/**
 * PDI NORMATIVE ENGINE — FLANGE DIMENSIONAL REGISTRY
 * Reference: PATCH NORM-04 (Flange Engine)
 * 
 * Registre central, déterministe et immuable des brides dimensionnelles.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Aucune donnée dimensionnelle non vérifiée ne doit être générée ou calculée mécaniquement.
 * - En l'absence de données sources dimensionnelles vérifiées ou licenciées,
 *   ce registre contient exactement 0 enregistrement.
 */

import type {
  FlangeDimensionalRecord,
  FlangeType,
  FlangeRatingSystem,
} from "../types/flangeTypes";
import type { ProductStandardId } from "../types/normativeCoreTypes";

/**
 * Registre immuable des enregistrements dimensionnels de brides.
 * Initialisé à 0 enregistrement conformément aux directives NORM-04.
 */
export const FLANGE_DIMENSIONAL_REGISTRY: readonly FlangeDimensionalRecord[] = Object.freeze([]);

/**
 * Recherche une bride par son identifiant unique.
 */
export function getFlangeById(id: string): FlangeDimensionalRecord | undefined {
  return FLANGE_DIMENSIONAL_REGISTRY.find((record) => record.id === id);
}

/**
 * Recherche les brides associées à un standard produit donné (ex: ASME-B16.5, ASME-B16.47, EN-1092-1).
 */
export function getFlangesByStandard(standardId: ProductStandardId): readonly FlangeDimensionalRecord[] {
  return FLANGE_DIMENSIONAL_REGISTRY.filter((record) => record.standardId === standardId);
}

/**
 * Recherche les brides par famille de bride (ex: WELD_NECK, BLIND, SLIP_ON).
 */
export function getFlangesByType(type: FlangeType): readonly FlangeDimensionalRecord[] {
  return FLANGE_DIMENSIONAL_REGISTRY.filter((record) => record.flangeType === type);
}

/**
 * Recherche les brides par système de rating (ASME_CLASS, EN_PN).
 */
export function getFlangesByRatingSystem(ratingSystem: FlangeRatingSystem): readonly FlangeDimensionalRecord[] {
  return FLANGE_DIMENSIONAL_REGISTRY.filter((record) => record.ratingSystem === ratingSystem);
}

/**
 * Retourne la liste complète de toutes les brides enregistrées.
 */
export function getAllFlanges(): readonly FlangeDimensionalRecord[] {
  return FLANGE_DIMENSIONAL_REGISTRY;
}
