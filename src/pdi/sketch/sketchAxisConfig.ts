/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * CONFIGURATION DU MAPPING D'AXES ISOMÉTRIQUES & UTILITAIRES D'ANGLES
 * Isolé d'OpenCV pour éviter de forcer le téléchargement du module OpenCV (15 Mo)
 * au démarrage de l'application.
 */

export interface AxisMappingConfig {
  X: number[];
  Y: number[];
  Z: number[];
}

export const DEFAULT_AXIS_MAPPING: AxisMappingConfig = {
  X: [330, 150],
  Y: [210, 30],
  Z: [90, 270],
};

/**
 * Détermine l'axe 3D isométrique (X, Y ou Z) à partir de l'angle isométrique en degrés :
 * - 330° ou 150° (ou 30°/210°) -> axe X (aligné sur éditeur ISO Sud-Est / Nord-Ouest)
 * - 210° ou 30° (ou 150°/330°) -> axe Y (aligné sur éditeur ISO Sud-Ouest / Nord-Est)
 * - 90° ou 270°               -> axe Z (vertical par défaut)
 * Supporte une configuration de mapping d'axes personnalisée (trièdre interactif).
 */
export function isoAngleToAxis(
  angleDeg: number,
  mapping: AxisMappingConfig = DEFAULT_AXIS_MAPPING
): { axis: "X" | "Y" | "Z"; diff: number } {
  const a = ((angleDeg % 360) + 360) % 360;
  const families: { axis: "X" | "Y" | "Z"; angles: number[] }[] = [
    { axis: "X", angles: mapping.X || [330, 150] },
    { axis: "Y", angles: mapping.Y || [210, 30] },
    { axis: "Z", angles: mapping.Z || [90, 270] },
  ];
  let best: "X" | "Y" | "Z" = "X";
  let bestDiff = 999;
  for (const fam of families) {
    for (const targetAngle of fam.angles) {
      let diff = Math.abs(a - targetAngle);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        best = fam.axis;
      }
    }
  }
  return { axis: best, diff: bestDiff };
}
