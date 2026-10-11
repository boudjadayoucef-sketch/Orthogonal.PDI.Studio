/**
 * PDI NORMATIVE ENGINE — PIPE DIMENSIONAL REGISTRY
 * Reference: PATCH NORM-02
 * 
 * Registre dimensionnel centralisé, immuable et déterministe pour les tubes.
 * 
 * RÈGLE FONDAMENTALE (NORM-02) :
 * - Ce registre définit la structure et le contenant dimensionnel des tubes.
 * - Aucune donnée dimensionnelle n'est inventée, devinée, approximée ou déduite par formule.
 * - Les enregistrements présents proviennent exclusivement de références normatives traçables.
 * - Si aucune donnée licenciée/vérifiée n'est chargée, le registre reste déterministe et strict.
 */

import type { PipeDimensionalRecord } from "../types/pipeDimensionalTypes";
import type { DimensionalStandardId } from "../types/normativeCoreTypes";

/**
 * Registre dimensionnel des tubes PDI.
 * Conteneur déterministe et immuable de fiches `PipeDimensionalRecord`.
 */
export const PIPE_DIMENSIONAL_REGISTRY: readonly PipeDimensionalRecord[] = Object.freeze([
  // Note: NORM-02 établit l'architecture et le modèle dimensionnel sans fabriquer
  // de tables dimensionnelles non vérifiées / non licenciées.
]);

/**
 * Récupère un enregistrement dimensionnel de tube par son identifiant unique.
 */
export function getPipeDimensionalRecordById(id: string): PipeDimensionalRecord | undefined {
  return PIPE_DIMENSIONAL_REGISTRY.find((r) => r.id === id);
}

/**
 * Recherche les enregistrements dimensionnels rattachés à un standard donné.
 */
export function getPipeDimensionsByStandard(standardId: DimensionalStandardId): readonly PipeDimensionalRecord[] {
  return PIPE_DIMENSIONAL_REGISTRY.filter((r) => r.standardId === standardId);
}

/**
 * Recherche d'enregistrements dimensionnels par NPS et Schedule (sans conversion explicite ni implicite).
 */
export function getPipeDimensionsByNpsAndSchedule(
  standardId: DimensionalStandardId,
  nps: string,
  schedule: string
): readonly PipeDimensionalRecord[] {
  return PIPE_DIMENSIONAL_REGISTRY.filter(
    (r) => r.standardId === standardId && r.nps === nps && r.schedule === schedule
  );
}

/**
 * Recherche d'enregistrements dimensionnels par DN et Schedule (sans conversion explicite ni implicite).
 */
export function getPipeDimensionsByDnAndSchedule(
  standardId: DimensionalStandardId,
  dn: number,
  schedule: string
): readonly PipeDimensionalRecord[] {
  return PIPE_DIMENSIONAL_REGISTRY.filter(
    (r) => r.standardId === standardId && r.dn === dn && r.schedule === schedule
  );
}
