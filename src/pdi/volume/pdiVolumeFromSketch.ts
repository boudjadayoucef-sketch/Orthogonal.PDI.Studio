/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * PALIER 019S+ (ÉTAPE 2/3) — PONT DESSIN 2D CAO → VOLUME.
 *
 * Chaînon manquant identifié au diagnostic : le moteur 2D CAO
 * (src/pdi/cad2d, entités Cad2dEntity du ruban "Dessin") et le panneau
 * "Volume & Skid" ne se parlaient pas. Ce module convertit une entité 2D
 * fermée (rectangle, polygone, polyligne bouclée, cercle) en profil
 * PdiPoint2D consommable par pdiVolumeModel.creerVolumeDepuisProfil,
 * débloquant des volumes de forme libre (L, T, coins coupés...) au lieu du
 * seul pavé droit existant.
 *
 * Commande ruban prévue pour l'intégration dans IsometrieModuleV48d.tsx :
 * "VOLUME_FROM_SKETCH" — sélectionner une entité 2D fermée puis appeler
 * creerVolumeDepuisEntite2D(entiteSelectionnee, { kind, nomFr }).
 */

import { intersectSegments2D } from "../cad2d/cad2dModifyEngine";
import { Cad2dEntity, Cad2dPoint } from "../isometric/types/isoGraphTypes";
import {
  CreerVolumeParams,
  PdiPoint2D,
  PdiVolume,
  creerVolumeDepuisProfil,
} from "../model/pdiVolumeModel";

const SEGMENTS_PAR_CERCLE = 32;

function versPdiPoint2D(p: Cad2dPoint): PdiPoint2D {
  return { x: p.x, y: p.y };
}

/**
 * Extrait un contour fermé exploitable d'une entité 2D CAO, quel que soit
 * son type d'origine. Retourne null si l'entité ne peut pas servir de
 * profil de volume (ligne ouverte, texte, hachure, polyligne non bouclée...).
 */
export function extraireProfilDepuisEntite2D(entite: Cad2dEntity): PdiPoint2D[] | null {
  switch (entite.type) {
    case "rectangle": {
      if (entite.points && entite.points.length >= 4) {
        return entite.points.slice(0, 4).map(versPdiPoint2D);
      }
      if (entite.center && entite.width != null && entite.height != null) {
        const { x: cx, y: cy } = entite.center;
        const hw = entite.width / 2;
        const hh = entite.height / 2;
        return [
          { x: cx - hw, y: cy - hh },
          { x: cx + hw, y: cy - hh },
          { x: cx + hw, y: cy + hh },
          { x: cx - hw, y: cy + hh },
        ];
      }
      return null;
    }

    case "polygon": {
      if (!entite.points || entite.points.length < 3) return null;
      return entite.points.map(versPdiPoint2D);
    }

    case "polyline": {
      if (!entite.points || entite.points.length < 3) return null;
      if (entite.closed === false) return null; // une polyligne ouverte ne définit pas un volume
      return entite.points.map(versPdiPoint2D);
    }

    case "triangle": {
      if (!entite.points || entite.points.length < 3) return null;
      return entite.points.slice(0, 3).map(versPdiPoint2D);
    }

    case "circle": {
      if (!entite.center || !entite.radius) return null;
      const { x: cx, y: cy } = entite.center;
      const r = entite.radius;
      const pts: PdiPoint2D[] = [];
      for (let i = 0; i < SEGMENTS_PAR_CERCLE; i++) {
        const theta = (2 * Math.PI * i) / SEGMENTS_PAR_CERCLE;
        pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
      }
      return pts;
    }

    default:
      // "line", "arc", "text", "hatch", etc. : pas de contour fermé exploitable tel quel.
      return null;
  }
}

/**
 * Détecte une auto-intersection grossière du contour (arêtes non
 * consécutives qui se croisent). Réutilise intersectSegments2D du moteur
 * CAD existant plutôt que de dupliquer la géométrie d'intersection.
 * Suffisant pour rejeter un polygone "en nœud papillon" avant extrusion ;
 * ne remplace pas une triangulation robuste complète.
 */
export function profilAutoIntersecte(points: PdiPoint2D[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Ignore l'arête elle-même et les deux arêtes adjacentes (qui partagent un sommet).
      if (j === i || j === (i + 1) % n || (j + 1) % n === i) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      const inter = intersectSegments2D(a1, a2, b1, b2);
      if (inter) return true;
    }
  }
  return false;
}

export interface CreerVolumeDepuisEntiteOptions {
  kind: CreerVolumeParams["kind"];
  nomFr: string;
  origineZ?: number;
  hauteurExtrusion?: number;
}

export type ResultatCreationVolume =
  | { ok: true; volume: PdiVolume }
  | { ok: false; erreur: string };

/**
 * Point d'entrée unique du pont 2D → volume. Valide l'entité (contour
 * fermé, non auto-intersecté) avant de déléguer la construction du volume
 * au modèle canonique.
 */
export function creerVolumeDepuisEntite2D(
  entite: Cad2dEntity,
  options: CreerVolumeDepuisEntiteOptions
): ResultatCreationVolume {
  const profil = extraireProfilDepuisEntite2D(entite);
  if (!profil) {
    return {
      ok: false,
      erreur:
        "Cette entité ne définit pas de contour fermé exploitable (seuls rectangle, polygone, triangle, cercle et polyligne bouclée peuvent devenir un volume).",
    };
  }
  if (profilAutoIntersecte(profil)) {
    return { ok: false, erreur: "Le contour se croise lui-même : corrigez le dessin 2D avant extrusion." };
  }
  try {
    const volume = creerVolumeDepuisProfil({
      kind: options.kind,
      nomFr: options.nomFr,
      profil2D: profil,
      origineZ: options.origineZ,
      hauteurExtrusion: options.hauteurExtrusion,
    });
    return { ok: true, volume };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}
