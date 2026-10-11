// PATCH 017P3 : reperes d axes, rayon de noeud et convention de metre.
// Les directions ecran sont derivees de la projection isometrique du moteur :
//   ecran.x = (x - y) * cos * scale ; ecran.y = (x + y) * sin * scale - z * scale
// Ce module sera reutilise par l orbite 3D (jalon 018) : meme base de triedre.

export type PdiAxisKey017P3 = "X" | "Y" | "Z";

export type PdiAxisDir017P3 = {
  key: PdiAxisKey017P3;
  sx: number;
  sy: number;
  color: string;
  legende: string;
};

export const PDI_AXIS_COLORS_017P3: Record<PdiAxisKey017P3, string> = {
  X: "#f87171", // Red (East / West)
  Y: "#4ade80", // Green (North / South)
  Z: "#60a5fa", // Blue (Elevation +EL / -EL)
};

export const pdiIsoAxisDirs017P3 = (cos: number, sin: number): PdiAxisDir017P3[] => [
  { key: "X", sx: cos, sy: sin, color: PDI_AXIS_COLORS_017P3.X, legende: "Est (E) / Ouest (W)" },
  { key: "Y", sx: -cos, sy: sin, color: PDI_AXIS_COLORS_017P3.Y, legende: "Nord (N) / Sud (S)" },
  { key: "Z", sx: 0, sy: -1, color: PDI_AXIS_COLORS_017P3.Z, legende: "Élévation (+EL / -EL)" },
];

// Rayon du cercle de noeud : suit le zoom mais reste lisible.
export const PDI_NODE_RADIUS_MIN_017P3 = 2;
export const PDI_NODE_RADIUS_MAX_017P3 = 7;

export const pdiNodeRadius017P3 = (zoom: number, isSel?: boolean, isHov?: boolean) => {
  const base = isSel ? 5 : isHov ? 4.2 : 3.5;
  const z = Math.max(0.1, Number.isFinite(zoom) ? zoom : 1);
  const scaled = base * Math.sqrt(z);
  const borne = Math.min(PDI_NODE_RADIUS_MAX_017P3, Math.max(PDI_NODE_RADIUS_MIN_017P3, scaled));
  return Number(borne.toFixed(2));
};

// Regle metier ISO : un changement de direction est un POINT, pas une piece.
// Seuls les vrais composants (equipement, te) ont une cote centre-a-face.
export const pdiNodeHasFaceOffset017P3 = (
  node: { equipmentType?: string | null; type?: string } | null | undefined,
) => Boolean(node && (node.equipmentType || node.type === "tee"));

export const PDI_METRE_CONVENTION_017P3 =
  "Metre centre a centre (noeuds) et centre a face (composants)";
