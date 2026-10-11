/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * PALIER 019S+ (ÉTAPE 1/3) — MODÈLE CANONIQUE DES VOLUMES & SKIDS.
 *
 * Remplace l'état unique "une seule enveloppe rectangulaire par projet"
 * (envelopeX/Y/Z/Length/Width/Height dans IsometrieModuleV48d.tsx) par une
 * collection de volumes typés, à profil 2D libre (pas seulement un rectangle).
 *
 * Volontairement indépendant du moteur d'édition (isometric/) et du rendu
 * 3D (viewer3d/) : ce fichier ne décrit QUE la donnée. Il vit dans
 * src/pdi/model/ pour rester aligné avec la règle du canonical model
 * boundary (docs/PDI_FOUNDATION.md) pendant l'extraction hors du monolithe.
 *
 * Unités : mètres, repère monde (le même repère X/Y/Z que les IsoNode :
 * X/Y en plan, Z = élévation verticale).
 */

/** Point 2D en plan (X/Y monde), indépendant du type Cad2dPoint de l'éditeur. */
export interface PdiPoint2D {
  x: number;
  y: number;
}

/**
 * Nature du volume. Chaque nature pilote à la fois l'habillage 3D
 * (ossature métallique, dalle béton, etc.) et le sens d'extrusion par
 * défaut (vers le haut pour un skid/local, vers le bas pour une fosse).
 */
export type PdiVolumeKind =
  | "skid_metallique" // châssis métallique industriel (poutres/poteaux/caillebotis)
  | "local_technique" // chambre / local confiné en génie civil (dalles béton)
  | "fosse_fondation" // excavation / fondation en creux (extrusion vers le bas)
  | "vide_interieur"; // creux de passage à l'intérieur d'un volume existant (trémie, baie, passage mural)

/**
 * Ouverture / vide découpé dans le profil d'un volume : passage de
 * tuyauterie, porte, trémie. À ce stade (étapes 1-3), l'ouverture traverse
 * toute la hauteur d'extrusion du volume porteur — une ouverture bornée en
 * élévation (ex: fenêtre à mi-hauteur de paroi) demande une vraie CSG et
 * est prévue pour l'étape 4 (voir docs/architecture, "PATCH 019S+").
 */
export interface PdiOuverture {
  id: string;
  nomFr: string;
  /** Contour fermé de l'ouverture, en coordonnées monde (même repère que le volume porteur). */
  profil2D: PdiPoint2D[];
}

/** Type de fixation au point d'ancrage, aligné sur les commandes déjà déclarées dans le ruban (insertion.*). */
export type PdiTypeAncrage =
  | "support_fixe"
  | "support_glissant"
  | "support_guide"
  | "platine_ancrage";

/**
 * Point d'ancrage pour la tuyauterie sur la structure d'un volume (ex: une
 * traverse de skid). Un support de tuyauterie référence volumeId +
 * pointAncrageId plutôt que de flotter dans l'espace.
 */
export interface PdiPointAncrage {
  id: string;
  type: PdiTypeAncrage;
  /** Position monde (x, y, z) du point d'ancrage sur la structure. */
  position: { x: number; y: number; z: number };
  /** DN maximal supportable par cet ancrage, si pertinent. */
  dnMax?: number;
  notes?: string;
}

export interface PdiVolume {
  id: string;
  kind: PdiVolumeKind;
  nomFr: string;
  /**
   * Contour fermé en plan (coordonnées monde X/Y), premier point ≠ dernier
   * point (fermeture implicite). Minimum 3 points. Issu soit d'un preset
   * rectangulaire, soit d'une entité 2D CAO sélectionnée (voir
   * src/pdi/volume/pdiVolumeFromSketch.ts, étape 2).
   */
  profil2D: PdiPoint2D[];
  /** Élévation (Z monde) de la face de référence du volume (bas pour un skid/local, haut pour une fosse). */
  origineZ: number;
  /**
   * Hauteur d'extrusion signée : positive = extrusion vers le haut
   * (skid, local technique, vide intérieur dans une paroi montante),
   * négative = extrusion vers le bas (fosse / fondation en creux).
   */
  hauteurExtrusion: number;
  ouvertures: PdiOuverture[];
  pointsAncrage: PdiPointAncrage[];
  /** Préréglage d'origine (pour compatibilité avec les anciens presets rectangulaires). */
  presetOrigine?: string;
  actif: boolean;
}

/** Génère un identifiant de volume lisible et unique dans le contexte d'un projet. */
export function genererIdVolume(prefixe: string = "vol"): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Aire signée d'un polygone 2D (formule du lacet / shoelace). Positive si
 * le contour est orienté dans le sens trigonométrique (anti-horaire).
 */
export function aireSigneeProfil2D(points: PdiPoint2D[]): number {
  if (points.length < 3) return 0;
  let somme = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    somme += a.x * b.y - b.x * a.y;
  }
  return somme / 2;
}

/** Aire absolue (m²) d'un profil fermé. */
export function aireProfil2D(points: PdiPoint2D[]): number {
  return Math.abs(aireSigneeProfil2D(points));
}

/** Centroïde (barycentre des sommets, approximation suffisante pour l'étiquetage) d'un profil. */
export function centroideProfil2D(points: PdiPoint2D[]): PdiPoint2D {
  if (points.length === 0) return { x: 0, y: 0 };
  const somme = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: somme.x / points.length, y: somme.y / points.length };
}

/**
 * Validation minimale d'un profil candidat avant d'en faire un volume :
 * fermé (≥ 3 sommets distincts), aire non dégénérée. La détection
 * d'auto-intersection complète vit côté pont 2D→volume (elle réutilise
 * intersectSegments2D du moteur CAD existant plutôt que d'être dupliquée ici).
 */
export function validerProfilVolume(points: PdiPoint2D[]): { valide: boolean; raison?: string } {
  if (points.length < 3) {
    return { valide: false, raison: "Un volume requiert un contour fermé d'au moins 3 sommets." };
  }
  const aire = aireProfil2D(points);
  if (aire < 1e-4) {
    return { valide: false, raison: "Le contour est dégénéré (aire quasi nulle) : vérifiez que les points ne sont pas alignés." };
  }
  return { valide: true };
}

/** Volume approximatif extrudé (m³), sans déduction des ouvertures (approximation haute). */
export function volumeExtrudeM3(volume: PdiVolume): number {
  return aireProfil2D(volume.profil2D) * Math.abs(volume.hauteurExtrusion);
}

const PRESETS_RECTANGULAIRES: Record<
  string,
  { longueur: number; largeur: number; hauteur: number; x: number; y: number; z: number }
> = {
  skid_filtration: { longueur: 6.0, largeur: 4.0, hauteur: 3.0, x: -1.0, y: -1.0, z: 0.0 },
  local_compresseur: { longueur: 4.5, largeur: 3.0, hauteur: 2.5, x: -0.5, y: -0.5, z: 0.0 },
  chambre_vanne: { longueur: 3.0, largeur: 3.0, hauteur: 2.0, x: 0.0, y: 0.0, z: 0.0 },
  corridor_asme: { longueur: 10.0, largeur: 2.0, hauteur: 4.0, x: -2.0, y: -1.0, z: 0.0 },
};

/** Construit le profil rectangulaire d'un preset existant (compatibilité ascendante avec l'ancienne enveloppe unique). */
export function profilDepuisPresetRectangulaire(preset: keyof typeof PRESETS_RECTANGULAIRES | string): PdiPoint2D[] | null {
  const p = PRESETS_RECTANGULAIRES[preset];
  if (!p) return null;
  return [
    { x: p.x, y: p.y },
    { x: p.x + p.longueur, y: p.y },
    { x: p.x + p.longueur, y: p.y + p.largeur },
    { x: p.x, y: p.y + p.largeur },
  ];
}

export interface CreerVolumeParams {
  kind: PdiVolumeKind;
  nomFr: string;
  profil2D: PdiPoint2D[];
  origineZ?: number;
  hauteurExtrusion?: number;
  presetOrigine?: string;
}

/** Hauteur d'extrusion par défaut selon la nature du volume, si non précisée explicitement. */
function hauteurParDefaut(kind: PdiVolumeKind): number {
  switch (kind) {
    case "fosse_fondation":
      return -1.2; // creuse vers le bas
    case "vide_interieur":
      return 2.5; // traverse une paroi/un niveau standard
    case "local_technique":
      return 2.5;
    case "skid_metallique":
    default:
      return 3.0;
  }
}

/**
 * Fabrique un PdiVolume validé à partir d'un profil 2D. Lève une erreur
 * (plutôt que de retourner un objet invalide) si le contour est dégénéré :
 * l'appelant (le pont 2D→volume ou le panneau Volume) doit décider comment
 * réagir à une entrée utilisateur invalide.
 */
export function creerVolumeDepuisProfil(params: CreerVolumeParams): PdiVolume {
  const { valide, raison } = validerProfilVolume(params.profil2D);
  if (!valide) {
    throw new Error(raison || "Profil de volume invalide.");
  }
  const hauteur = params.hauteurExtrusion ?? hauteurParDefaut(params.kind);
  if (params.kind === "fosse_fondation" && hauteur > 0) {
    // Garde-fou : une fosse se creuse vers le bas, pas vers le haut.
    throw new Error("Une fosse / fondation doit avoir une hauteur d'extrusion négative (creuse vers le bas).");
  }
  return {
    id: genererIdVolume(params.kind === "fosse_fondation" ? "fosse" : params.kind === "vide_interieur" ? "vide" : "vol"),
    kind: params.kind,
    nomFr: params.nomFr,
    profil2D: params.profil2D,
    origineZ: params.origineZ ?? 0,
    hauteurExtrusion: hauteur,
    ouvertures: [],
    pointsAncrage: [],
    presetOrigine: params.presetOrigine,
    actif: true,
  };
}

/** Ajoute une ouverture (vide/trémie/passage) à un volume existant, sans muter l'original. */
export function ajouterOuverture(volume: PdiVolume, ouverture: Omit<PdiOuverture, "id">): PdiVolume {
  const { valide, raison } = validerProfilVolume(ouverture.profil2D);
  if (!valide) {
    throw new Error(`Ouverture invalide : ${raison}`);
  }
  return {
    ...volume,
    ouvertures: [...volume.ouvertures, { ...ouverture, id: genererIdVolume("ouv") }],
  };
}

/** Ajoute un point d'ancrage tuyauterie sur la structure du volume, sans muter l'original. */
export function ajouterPointAncrage(volume: PdiVolume, ancrage: Omit<PdiPointAncrage, "id">): PdiVolume {
  return {
    ...volume,
    pointsAncrage: [...volume.pointsAncrage, { ...ancrage, id: genererIdVolume("anc") }],
  };
}
