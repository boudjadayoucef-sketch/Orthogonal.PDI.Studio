/**
 * PDI NORMATIVE ENGINE — MATERIAL REGISTRY
 * Reference: PATCH NORM-06 (Material Engine)
 * 
 * Registre central, déterministe et immuable des matériaux normatifs de tuyauterie.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Aucune propriété mécanique inventée (yield, tensile, allowable stress) par l'IA.
 * - En l'absence de données sources vérifiées ou licenciées,
 *   ce registre contient exactement 0 enregistrement.
 */

import type {
  MaterialRecord,
  MaterialCategory,
  MaterialProductForm,
} from "../types/materialTypes";
import type { MaterialStandardId } from "../types/normativeCoreTypes";

/**
 * Registre immuable des enregistrements de matériaux.
 * Initialisé à 0 enregistrement conformément aux directives NORM-06.
 */
export const MATERIAL_REGISTRY: readonly MaterialRecord[] = Object.freeze([]);

/**
 * Recherche un matériau par son identifiant unique.
 */
export function getMaterialById(id: string): MaterialRecord | undefined {
  return MATERIAL_REGISTRY.find((record) => record.id === id);
}

/**
 * Recherche les matériaux associés à un standard matériau donné (ex: API-5L).
 */
export function getMaterialsByStandard(standardId: MaterialStandardId): readonly MaterialRecord[] {
  return MATERIAL_REGISTRY.filter((record) => record.standardId === standardId);
}

/**
 * Recherche les matériaux par grade ou nuance (ex: "X52", "X65").
 */
export function getMaterialsByGrade(grade: string): readonly MaterialRecord[] {
  return MATERIAL_REGISTRY.filter((record) => record.grade === grade);
}

/**
 * Recherche les matériaux par famille métallurgique (ex: CARBON_STEEL, STAINLESS_STEEL).
 */
export function getMaterialsByCategory(category: MaterialCategory): readonly MaterialRecord[] {
  return MATERIAL_REGISTRY.filter((record) => record.materialCategory === category);
}

/**
 * Recherche les matériaux par forme de produit (PIPE, FORGING, FITTING, etc.).
 */
export function getMaterialsByProductForm(productForm: MaterialProductForm): readonly MaterialRecord[] {
  return MATERIAL_REGISTRY.filter((record) => record.productForm === productForm);
}

/**
 * Retourne la liste complète de tous les matériaux enregistrés.
 */
export function getAllMaterials(): readonly MaterialRecord[] {
  return MATERIAL_REGISTRY;
}
