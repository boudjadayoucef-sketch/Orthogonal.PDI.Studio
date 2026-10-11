/**
 * PDI NORMATIVE ENGINE — VALVE REGISTRY
 * Reference: PATCH NORM-05 (Valve Engine)
 * 
 * Registre central, déterministe et immuable des composants de robinetterie industrielle.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Aucune donnée dimensionnelle (Face-to-Face, End-to-End) non vérifiée ne doit être inventée ou calculée.
 * - En l'absence de données sources vérifiées ou licenciées,
 *   ce registre contient exactement 0 enregistrement.
 */

import type {
  ValveRecord,
  ValveType,
  ValveConnectionType,
} from "../types/valveTypes";
import type {
  ProductStandardId,
  DimensionalStandardId,
} from "../types/normativeCoreTypes";

/**
 * Registre immuable des enregistrements de vannes.
 * Initialisé à 0 enregistrement conformément aux directives NORM-05.
 */
export const VALVE_REGISTRY: readonly ValveRecord[] = Object.freeze([]);

/**
 * Recherche une vanne par son identifiant unique.
 */
export function getValveById(id: string): ValveRecord | undefined {
  return VALVE_REGISTRY.find((record) => record.id === id);
}

/**
 * Recherche les vannes associées à un standard produit donné (ex: API-6D, API-600, API-602, API-609).
 */
export function getValvesByProductStandard(standardId: ProductStandardId): readonly ValveRecord[] {
  return VALVE_REGISTRY.filter((record) => record.productStandardId === standardId);
}

/**
 * Recherche les vannes associées à un standard dimensionnel donné (ex: ASME-B16.10).
 */
export function getValvesByDimensionalStandard(standardId: DimensionalStandardId): readonly ValveRecord[] {
  return VALVE_REGISTRY.filter((record) => record.dimensionalStandardId === standardId);
}

/**
 * Recherche les vannes par famille fonctionnelle (GATE, GLOBE, CHECK, BALL, BUTTERFLY, etc.).
 */
export function getValvesByType(type: ValveType): readonly ValveRecord[] {
  return VALVE_REGISTRY.filter((record) => record.valveType === type);
}

/**
 * Recherche les vannes par type de raccordement (FLANGED, BUTT_WELD, WAFER, etc.).
 */
export function getValvesByConnectionType(connectionType: ValveConnectionType): readonly ValveRecord[] {
  return VALVE_REGISTRY.filter((record) => record.connectionType === connectionType);
}

/**
 * Retourne la liste complète de toutes les vannes enregistrées.
 */
export function getAllValves(): readonly ValveRecord[] {
  return VALVE_REGISTRY;
}
