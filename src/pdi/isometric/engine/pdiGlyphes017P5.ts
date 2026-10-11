// Echelle des glyphes de fittings, derivee de la position reelle des ports.
// Corrige le decrochage du glyphe au zoom (PATCH 017P5).

// Demi-taille nominale des glyphes de getFittingSvgGraphic, en unites SVG.
export const PDI_GLYPHE_DEMI_NOMINALE_017P5 = 7;

// Bornes de securite : lisible au dezoom, non explosif au zoom extreme.
export const PDI_GLYPHE_SCALE_MIN_017P5 = 0.9;
export const PDI_GLYPHE_SCALE_MAX_017P5 = 40;

export type PdiGlyphPort017P5 = { sx: number; sy: number };

// Retourne le facteur d echelle du glyphe pour que sa demi-taille
// nominale couvre la distance ecran moyenne centre -> ports.
export function pdiGlyphScale017P5(
  ports: PdiGlyphPort017P5[] | null | undefined,
  defaut: number = 1.3,
): number {
  if (!ports || ports.length === 0) return defaut;
  let somme = 0;
  let nb = 0;
  for (const port of ports) {
    const d = Math.hypot(Number(port.sx) || 0, Number(port.sy) || 0);
    if (d > 0.01) {
      somme += d;
      nb += 1;
    }
  }
  if (nb === 0) return defaut;
  const brut = somme / nb / PDI_GLYPHE_DEMI_NOMINALE_017P5;
  const borne = Math.min(
    PDI_GLYPHE_SCALE_MAX_017P5,
    Math.max(PDI_GLYPHE_SCALE_MIN_017P5, brut),
  );
  return Number(borne.toFixed(3));
}
