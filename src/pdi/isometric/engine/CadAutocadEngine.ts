// =========================================================================
// PD&I - AutoCAD Engine & Shape Math
// Triangle, Polygon, Arc, Rectangle & AutoCAD Command System
// =========================================================================

export type TriangleType = "equilateral" | "rectangle" | "isocele" | "scalene" | "3pts";
export type ArcCreationMode = "3points" | "center_radius_angle" | "start_end_radius";

export interface Cad2dPoint {
  x: number;
  y: number;
}

/** Distance euclidienne entre 2 points 2D */
export function cadDist(a: Cad2dPoint, b: Cad2dPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle d'un vecteur (A -> B) en degrés [-180, 180] */
export function cadAngleDeg(a: Cad2dPoint, b: Cad2dPoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Rotation d'un point autour d'un pivot en degrés */
export function cadRotatePoint(point: Cad2dPoint, pivot: Cad2dPoint, angleDeg: number): Cad2dPoint {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: Number((pivot.x + dx * cos - dy * sin).toFixed(3)),
    y: Number((pivot.y + dx * sin + dy * cos).toFixed(3)),
  };
}

/**
 * Génère un triangle équilatéral à partir de 2 points (base ou centre/sommet)
 */
export function buildEquilateralTriangle(p1: Cad2dPoint, p2: Cad2dPoint): Cad2dPoint[] {
  const len = cadDist(p1, p2);
  if (len < 0.001) return [p1, { x: p1.x + 2, y: p1.y }, { x: p1.x + 1, y: p1.y + Math.sqrt(3) }, p1];
  const p3 = cadRotatePoint(p2, p1, 60);
  return [p1, p2, p3, p1];
}

/**
 * Génère un triangle rectangle
 * P1 = sommet de l'angle droit
 * P2 = direction de la base (longueur)
 * P3 = direction ou hauteur de la perpendiculaire
 */
export function buildRightTriangle(p1: Cad2dPoint, p2: Cad2dPoint, height: number = 0, mousePoint?: Cad2dPoint): Cad2dPoint[] {
  const baseLen = cadDist(p1, p2);
  if (baseLen < 0.001) {
    const h = height || 2;
    return [p1, { x: p1.x + 2, y: p1.y }, { x: p1.x, y: p1.y + h }, p1];
  }
  const ux = (p2.x - p1.x) / baseLen;
  const uy = (p2.y - p1.y) / baseLen;
  // Vecteur normal perpendiculaire
  let nx = -uy;
  let ny = ux;
  if (mousePoint) {
    const dot = (mousePoint.x - p1.x) * nx + (mousePoint.y - p1.y) * ny;
    if (dot < 0) {
      nx = -nx;
      ny = -ny;
    }
  }
  const h = Math.abs(height) > 0.001 ? Math.abs(height) : (mousePoint ? Math.max(0.2, Math.abs((mousePoint.x - p1.x) * nx + (mousePoint.y - p1.y) * ny)) : baseLen * 0.75);
  const p3: Cad2dPoint = {
    x: Number((p1.x + nx * h).toFixed(3)),
    y: Number((p1.y + ny * h).toFixed(3)),
  };
  return [p1, p2, p3, p1];
}

/**
 * Génère un triangle isocèle (2 côtés égaux)
 * P1, P2 = base
 * P3 = sommet au milieu de la base élevé perpendiculairement
 */
export function buildIsoscelesTriangle(p1: Cad2dPoint, p2: Cad2dPoint, height: number = 0, mousePoint?: Cad2dPoint): Cad2dPoint[] {
  const baseLen = cadDist(p1, p2);
  if (baseLen < 0.001) {
    const h = height || 2;
    return [p1, { x: p1.x + 2, y: p1.y }, { x: p1.x + 1, y: p1.y + h }, p1];
  }
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const ux = (p2.x - p1.x) / baseLen;
  const uy = (p2.y - p1.y) / baseLen;
  let nx = -uy;
  let ny = ux;
  if (mousePoint) {
    const dot = (mousePoint.x - mx) * nx + (mousePoint.y - my) * ny;
    if (dot < 0) {
      nx = -nx;
      ny = -ny;
    }
  }
  const h = Math.abs(height) > 0.001 ? Math.abs(height) : (mousePoint ? Math.max(0.2, Math.abs((mousePoint.x - mx) * nx + (mousePoint.y - my) * ny)) : baseLen * 0.86);
  const p3: Cad2dPoint = {
    x: Number((mx + nx * h).toFixed(3)),
    y: Number((my + ny * h).toFixed(3)),
  };
  return [p1, p2, p3, p1];
}

/**
 * Génère un polygone régulier à N côtés (3 = triangle, 4 = carré, 5 = pentagone, 6 = hexagone, 8 = octogone...)
 */
export function buildRegularPolygon(center: Cad2dPoint, radiusPoint: Cad2dPoint, sides: number = 6): Cad2dPoint[] {
  const n = Math.max(3, Math.min(32, Math.round(sides || 6)));
  const radius = cadDist(center, radiusPoint);
  if (radius < 0.001) {
    const defaultR = 1.5;
    const pts: Cad2dPoint[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      pts.push({
        x: Number((center.x + defaultR * Math.cos(angle)).toFixed(3)),
        y: Number((center.y + defaultR * Math.sin(angle)).toFixed(3)),
      });
    }
    pts.push(pts[0]);
    return pts;
  }
  const startAngle = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x);
  const pts: Cad2dPoint[] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / n;
    pts.push({
      x: Number((center.x + radius * Math.cos(angle)).toFixed(3)),
      y: Number((center.y + radius * Math.sin(angle)).toFixed(3)),
    });
  }
  pts.push(pts[0]); // Fermeture de la polyligne
  return pts;
}

/**
 * Génère un rectangle façon AutoCAD :
 * 1er point cliqué (P1)
 * 2ème point ou direction souris pour Côté 1 (Longueur L)
 * 3ème point ou direction souris pour Côté 2 (Largeur W)
 */
export function buildAutocadRectangle(
  p1: Cad2dPoint,
  dirPoint1: Cad2dPoint,
  length: number = 0,
  dirPoint2?: Cad2dPoint,
  width: number = 0
): { points: Cad2dPoint[]; p1: Cad2dPoint; p2: Cad2dPoint; p3: Cad2dPoint; p4: Cad2dPoint; length: number; width: number } {
  const rawDist1 = cadDist(p1, dirPoint1);
  const actualLength = length > 0.001 ? length : Math.max(0.1, rawDist1 || 2);
  let ux = 1;
  let uy = 0;
  if (rawDist1 > 0.001) {
    ux = (dirPoint1.x - p1.x) / rawDist1;
    uy = (dirPoint1.y - p1.y) / rawDist1;
  }
  const p2: Cad2dPoint = {
    x: Number((p1.x + ux * actualLength).toFixed(3)),
    y: Number((p1.y + uy * actualLength).toFixed(3)),
  };

  // Direction normale pour le 2ème côté
  let nx = -uy;
  let ny = ux;
  if (dirPoint2) {
    const dot = (dirPoint2.x - p1.x) * nx + (dirPoint2.y - p1.y) * ny;
    if (dot < 0) {
      nx = -nx;
      ny = -ny;
    }
  }

  let actualWidth = 0;
  if (width > 0.001) {
    actualWidth = width;
  } else if (dirPoint2) {
    actualWidth = Math.max(0.1, Math.abs((dirPoint2.x - p1.x) * nx + (dirPoint2.y - p1.y) * ny));
  } else {
    actualWidth = Math.max(0.1, actualLength * 0.6);
  }

  const p3: Cad2dPoint = {
    x: Number((p2.x + nx * actualWidth).toFixed(3)),
    y: Number((p2.y + ny * actualWidth).toFixed(3)),
  };
  const p4: Cad2dPoint = {
    x: Number((p1.x + nx * actualWidth).toFixed(3)),
    y: Number((p1.y + ny * actualWidth).toFixed(3)),
  };

  return {
    points: [p1, p2, p3, p4, p1],
    p1,
    p2,
    p3,
    p4,
    length: Number(actualLength.toFixed(3)),
    width: Number(actualWidth.toFixed(3)),
  };
}

/**
 * Calcule le centre, le rayon et les angles de départ/fin d'un arc passant par 3 points (P1 -> P2 -> P3)
 */
export function calculate3PointArc(
  p1: Cad2dPoint,
  p2: Cad2dPoint,
  p3: Cad2dPoint
): { center: Cad2dPoint; radius: number; startAngle: number; endAngle: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-6) {
    // Points colinéaires
    return null;
  }
  const p1Sq = p1.x * p1.x + p1.y * p1.y;
  const p2Sq = p2.x * p2.x + p2.y * p2.y;
  const p3Sq = p3.x * p3.x + p3.y * p3.y;

  const cx = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
  const cy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;
  const center: Cad2dPoint = { x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)) };
  const radius = Number(cadDist(center, p1).toFixed(3));

  let startAngle = (Math.atan2(p1.y - cy, p1.x - cx) * 180) / Math.PI;
  let midAngle = (Math.atan2(p2.y - cy, p2.x - cx) * 180) / Math.PI;
  let endAngle = (Math.atan2(p3.y - cy, p3.x - cx) * 180) / Math.PI;

  if (startAngle < 0) startAngle += 360;
  if (midAngle < 0) midAngle += 360;
  if (endAngle < 0) endAngle += 360;

  return {
    center,
    radius,
    startAngle: Number(startAngle.toFixed(1)),
    endAngle: Number(endAngle.toFixed(1)),
  };
}

// =========================================================================
// Système de commandes AutoCAD (French & English Aliases)
// =========================================================================

export interface CadCommandItem {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  category: "Dessin 2D" | "Tuyauterie" | "Édition" | "Affichage" | "Données" | "Direct";
  shortcut?: string;
  icon: string;
}

export const AUTOCAD_COMMANDS: CadCommandItem[] = [
  // PROJET & DÉMONSTRATION INDUSTRIELLE
  {
    id: "demo",
    name: "DEMO",
    aliases: ["EXEMPLE", "COMPLEXE", "SAMPLE", "PROJET_DEMO"],
    description: "Charge la démo industrielle complète (Réseau 3D, By-Pass, Raccords, Supports MSS SP-58, GC, Cotations)",
    category: "Tuyauterie",
    shortcut: "DEMO",
    icon: "Sparkles",
  },
  // ÉDITION & PRESSE-PAPIERS
  {
    id: "copy",
    name: "COPIER",
    aliases: ["CO", "CP", "COPY", "COPIE"],
    description: "Copie les nœuds, tronçons ou objets 2D sélectionnés",
    category: "Édition",
    shortcut: "Ctrl+C",
    icon: "Copy",
  },
  {
    id: "paste",
    name: "COLLER",
    aliases: ["PA", "PASTE", "COLLEZ", "COLL", "INSERER"],
    description: "Colle le presse-papiers avec choix du point par clic souris",
    category: "Édition",
    shortcut: "Ctrl+V",
    icon: "Clipboard",
  },
  {
    id: "move",
    name: "DEPLACER",
    aliases: ["M", "MOVE", "DEPLACE", "TRANSLATION"],
    description: "Déplace la sélection d'un point de base vers une cible au clic",
    category: "Édition",
    shortcut: "M",
    icon: "Move",
  },
  {
    id: "align",
    name: "ALIGN",
    aliases: ["AL", "ALIGNER", "ALIGNEMENT"],
    description: "Aligne les nœuds ou tronçons sélectionnés selon l'axe X (ou Y/Z)",
    category: "Édition",
    shortcut: "AL",
    icon: "AlignHorizontalJustifyCenter",
  },
  {
    id: "ax",
    name: "ALIGNER_X",
    aliases: ["AX", "ALIGNX"],
    description: "Aligne les éléments sélectionnés sur l'axe X",
    category: "Édition",
    shortcut: "AX",
    icon: "AlignHorizontalJustifyCenter",
  },
  {
    id: "ay",
    name: "ALIGNER_Y",
    aliases: ["AY", "ALIGNY"],
    description: "Aligne les éléments sélectionnés sur l'axe Y",
    category: "Édition",
    shortcut: "AY",
    icon: "AlignVerticalJustifyCenter",
  },
  {
    id: "az",
    name: "ALIGNER_Z",
    aliases: ["AZ", "ALIGNZ"],
    description: "Aligne les éléments sélectionnés sur l'axe Z (élévation)",
    category: "Édition",
    shortcut: "AZ",
    icon: "ArrowUpDown",
  },
  {
    id: "parallel",
    name: "PARALLELE",
    aliases: ["PAR", "PARALLEL", "//"],
    description: "Rend les tronçons sélectionnés parallèles au tronçon de référence",
    category: "Édition",
    shortcut: "//",
    icon: "Equal",
  },
  {
    id: "delete",
    name: "EFFACER",
    aliases: ["E", "DEL", "DELETE", "SUPPRIMER", "SUPPR", "ERASE"],
    description: "Supprime les éléments sélectionnés du plan",
    category: "Édition",
    shortcut: "Suppr",
    icon: "Trash2",
  },
  {
    id: "duplicate",
    name: "DUPLIQUER",
    aliases: ["DUP", "DUPLICATE", "CLONER"],
    description: "Duplique immédiatement la sélection avec un décalage",
    category: "Édition",
    shortcut: "Ctrl+D",
    icon: "CopyPlus",
  },
  {
    id: "rotate",
    name: "ROTATION",
    aliases: ["RO", "ROTATE", "TOURNER", "PIVOTER"],
    description: "Fait pivoter les éléments sélectionnés (+15°, +45°, +90°)",
    category: "Édition",
    shortcut: "R",
    icon: "RotateCw",
  },
  {
    id: "mirror",
    name: "MIROIR",
    aliases: ["MI", "MIRROR", "SYMETRIE"],
    description: "Applique une symétrie miroir horizontale sur la sélection",
    category: "Édition",
    shortcut: "Alt+M",
    icon: "ArrowRightLeft",
  },
  {
    id: "scale",
    name: "ECHELLE",
    aliases: ["SC", "SCALE", "ECHELLE", "AGRANDIR"],
    description: "Modifie l'échelle des éléments sélectionnés (facteur numérique ou référence)",
    category: "Édition",
    shortcut: "SC",
    icon: "Maximize2",
  },
  {
    id: "trim",
    name: "AJUSTER",
    aliases: ["TR", "TRIM", "AJUSTER", "COUPER"],
    description: "Ajuste et découpe un segment ou tube à l'intersection avec une frontière",
    category: "Édition",
    shortcut: "TR",
    icon: "Scissors",
  },
  {
    id: "extend",
    name: "PROLONGER",
    aliases: ["EX", "EXTEND", "PROLONGER"],
    description: "Prolonge un segment ou tube jusqu'à une arête de référence",
    category: "Édition",
    shortcut: "EX",
    icon: "ArrowUpRight",
  },
  {
    id: "offset",
    name: "DECALER",
    aliases: ["O", "OFFSET", "DECALER", "PARALLELE"],
    description: "Crée une ligne parallèle ou un cercle concentrique à distance spécifiée",
    category: "Édition",
    shortcut: "O",
    icon: "Copy",
  },
  {
    id: "fillet",
    name: "RACCORD",
    aliases: ["F", "FILLET", "RACCORD", "CONGE"],
    description: "Raccorde deux segments par un arc tangentiel de rayon défini",
    category: "Édition",
    shortcut: "F",
    icon: "CornerDownRight",
  },
  {
    id: "chamfer",
    name: "CHANFREIN",
    aliases: ["CHA", "CHAMFER", "CHANFREIN"],
    description: "Raccorde deux arêtes par un biseau / chanfrein",
    category: "Édition",
    shortcut: "CHA",
    icon: "Slash",
  },
  {
    id: "hatch",
    name: "HACHURE",
    aliases: ["H", "HATCH", "HACHURE", "MOTIF"],
    description: "Applique un motif de hachure normalisé (ANSI31, ANSI32, DOTS) sur un contour fermé",
    category: "Dessin 2D",
    shortcut: "H",
    icon: "Grid",
  },
  {
    id: "undo",
    name: "ANNULER",
    aliases: ["U", "UNDO", "RETOUR"],
    description: "Annule la dernière action",
    category: "Édition",
    shortcut: "Ctrl+Z",
    icon: "Undo2",
  },
  {
    id: "redo",
    name: "RETABLIR",
    aliases: ["REDO", "RE", "AVANCER"],
    description: "Rétablit l'action précédemment annulée",
    category: "Édition",
    shortcut: "Ctrl+Y",
    icon: "Redo2",
  },

  // DESSIN 2D & GÉOMÉTRIE
  {
    id: "rectangle",
    name: "RECTANGLE",
    aliases: ["REC", "RECT", "RECTANGLE", "CARRE", "BOX"],
    description: "Dessine un rectangle interactif (Point 1 -> Longueur -> Largeur)",
    category: "Dessin 2D",
    shortcut: "REC",
    icon: "Square",
  },
  {
    id: "triangle",
    name: "TRIANGLE",
    aliases: ["TRI", "TRIA", "TRIANGLE", "DELTA"],
    description: "Dessine un triangle (équilatéral, rectangle, isocèle, 3 points)",
    category: "Dessin 2D",
    shortcut: "TRI",
    icon: "Triangle",
  },
  {
    id: "polygon",
    name: "POLYGONE",
    aliases: ["POL", "POLYGON", "POLYGONE", "PENTAGONE", "HEXAGONE", "OCTOGONE"],
    description: "Dessine un polygone régulier avec choix du nombre de côtés (3 à 32)",
    category: "Dessin 2D",
    shortcut: "POL",
    icon: "Hexagon",
  },
  {
    id: "line",
    name: "LIGNE",
    aliases: ["L", "LINE", "LIGNE", "DROITE"],
    description: "Dessine une ligne 2D entre deux points",
    category: "Dessin 2D",
    shortcut: "L",
    icon: "Slash",
  },
  {
    id: "polyline",
    name: "POLYLIGNE",
    aliases: ["PL", "PLINE", "POLYLINE", "POLYLIGNE"],
    description: "Dessine une polyligne continue multi-sommets",
    category: "Dessin 2D",
    shortcut: "PL",
    icon: "Spline",
  },
  {
    id: "circle",
    name: "CERCLE",
    aliases: ["C", "CIRCLE", "CERCLE", "ROND"],
    description: "Dessine un cercle à partir du centre et du rayon",
    category: "Dessin 2D",
    shortcut: "C",
    icon: "Circle",
  },
  {
    id: "arc",
    name: "ARC",
    aliases: ["A", "ARC", "ARCCERCLE"],
    description: "Dessine un arc de cercle (par 3 points ou Centre-Rayon-Angle)",
    category: "Dessin 2D",
    shortcut: "A",
    icon: "Disc3",
  },
  {
    id: "text",
    name: "TEXTE",
    aliases: ["TXT", "DT", "TEXT", "TEXTE", "ANNOTATION", "LABEL"],
    description: "Place un texte ou une annotation 2D sur le plan",
    category: "Dessin 2D",
    shortcut: "DT",
    icon: "Type",
  },
  {
    id: "dimension",
    name: "COTATION",
    aliases: ["DIM", "D", "COTATION", "COTE", "MESURE", "DIST"],
    description: "Place une cotation dimensionnelle entre 2 points/ancres",
    category: "Dessin 2D",
    shortcut: "DIM",
    icon: "Ruler",
  },

  // TUYAUTERIE & PIPING
  {
    id: "pipe",
    name: "TUBE",
    aliases: ["T", "TUBE", "PIPE", "TRONCON", "TUYAU", "RELIER", "CONNECT"],
    description: "Dessine un tronçon de tuyauterie isométrique",
    category: "Tuyauterie",
    shortcut: "T",
    icon: "Spline",
  },
  {
    id: "node",
    name: "NOEUD",
    aliases: ["N", "NODE", "NOEUD", "POINT"],
    description: "Crée un nœud ou point de connexion",
    category: "Tuyauterie",
    shortcut: "N",
    icon: "CircleDot",
  },
  {
    id: "tee",
    name: "TE",
    aliases: ["TE", "TEE", "DERIVATION", "PIQUAGE"],
    description: "Insère une dérivation Té sur la tuyauterie",
    category: "Tuyauterie",
    shortcut: "E",
    icon: "GitFork",
  },
  {
    id: "elbow",
    name: "COUDE",
    aliases: ["COUDE", "ELBOW", "BEND"],
    description: "Insère un coude 90°, 45° ou 30°",
    category: "Tuyauterie",
    shortcut: "C",
    icon: "CornerDownRight",
  },
  {
    id: "valve",
    name: "VANNE",
    aliases: ["VANNE", "VALVE", "ROBINET"],
    description: "Insère une vanne de sectionnement ou régulation",
    category: "Tuyauterie",
    shortcut: "V",
    icon: "Flame",
  },

  // AFFICHAGE & DONNÉES
  {
    id: "zoom_all",
    name: "ZOOM",
    aliases: ["Z", "ZOOM", "ETENDUE", "FIT", "RECENTRER"],
    description: "Recentre et ajuste la vue à l'ensemble du dessin (Zoom Tout)",
    category: "Affichage",
    shortcut: "0 / F",
    icon: "Maximize2",
  },
  {
    id: "grid",
    name: "GRILLE",
    aliases: ["G", "GRID", "GRILLE"],
    description: "Affiche ou masque la grille isométrique et le repère",
    category: "Affichage",
    shortcut: "G",
    icon: "LayoutGrid",
  },
  {
    id: "bom",
    name: "BOM",
    aliases: ["BOM", "METRE", "NOMENCLATURE", "MATERIEL", "LISTE"],
    description: "Ouvre la nomenclature des matériels et longueurs de tubes",
    category: "Données",
    shortcut: "BOM",
    icon: "FileText",
  },
  {
    id: "properties",
    name: "PROPRIETES",
    aliases: ["PR", "PROPS", "PROPRIETES", "PROPERTIES"],
    description: "Ouvre le panneau d'inspection des propriétés de l'élément",
    category: "Données",
    shortcut: "P",
    icon: "SlidersHorizontal",
  },
  {
    id: "colorbyservice",
    name: "COULEURSERVICE",
    aliases: ["CBS", "COLORBYSERVICE", "COULEUR_PAR_SERVICE"],
    description: "Active/désactive la coloration des tronçons par service/fluide",
    category: "Affichage",
    shortcut: "CBS",
    icon: "Eye",
  },
  // PATCH 017C : les commandes PD&I etaient executables mais absentes du
  // catalogue, donc invisibles dans l autocompletion de la ligne de commande.
  {
    id: "projectsetup",
    name: "PROJECTSETUP",
    aliases: ["PS", "PROJECTSETUP", "SETUP", "PROJET"],
    description: "Ouvre Project Setup PD&I : projet, formats de tag, services, specs",
    category: "Données",
    shortcut: "PS",
    icon: "SlidersHorizontal",
  },
  {
    id: "tagformat",
    name: "TAGFORMAT",
    aliases: ["TF", "TAGFORMAT", "FORMATTAG"],
    description: "Affiche et modifie le format de tag actif (Tag_Ligne_Standard)",
    category: "Données",
    shortcut: "TF",
    icon: "Type",
  },
  {
    id: "tag",
    name: "TAG",
    aliases: ["TAG", "BALISE", "REPERE"],
    description: "Tague la selection : TAG [service] [spec], ex TAG HC CS300",
    category: "Données",
    shortcut: "TAG",
    icon: "Type",
  },
  {
    id: "service",
    name: "SERVICE",
    aliases: ["SERVICE", "FLUIDE"],
    description: "Affecte le service/fluide a la selection, ex SERVICE HC",
    category: "Données",
    shortcut: "SERVICE",
    icon: "Disc3",
  },
  {
    id: "spec",
    name: "SPEC",
    aliases: ["SPEC", "CLASSE", "SPECIFICATION"],
    description: "Affecte la spec tuyauterie a la selection, ex SPEC CS300",
    category: "Données",
    shortcut: "SPEC",
    icon: "Square",
  },
  {
    id: "autotag",
    name: "AUTOTAG",
    aliases: ["AUTOTAG", "TAGALL", "TAGTOUT"],
    description: "Tague automatiquement tous les troncons du plan",
    category: "Données",
    shortcut: "AUTOTAG",
    icon: "Check",
  },
  {
    id: "props",
    name: "PROPS",
    aliases: ["PROPS", "PR", "PROPRIETES", "PROPRIETE", "PROPERTIES"],
    description: "Ouvre l inspecteur de proprietes de l element selectionne",
    category: "Affichage",
    shortcut: "PR",
    icon: "Info",
  },
  {
    id: "tagdisplay",
    name: "TAGDISPLAY",
    aliases: ["TAGDISPLAY", "TD", "AFFICHETAG", "TAGON"],
    description: "Affiche ou masque les tags directement sur le plan (ON/OFF)",
    category: "Affichage",
    shortcut: "TD",
    icon: "Type",
  },
  {
    id: "renumber",
    name: "RENUMBER",
    aliases: ["RENUMBER", "RN", "RENUMEROTER"],
    description: "Renumerote les tags en serie par service, ex RENUMBER HC 10",
    category: "Données",
    shortcut: "RN",
    icon: "Ruler",
  },
  {
    id: "datamanager",
    name: "DATAMANAGER",
    aliases: ["DATAMANAGER", "DM", "DONNEES", "TABLEAU"],
    description: "Vue tabulaire de tous les elements tagges (base du BOM)",
    category: "Données",
    shortcut: "DM",
    icon: "FileText",
  },
  {
    id: "hide",
    name: "HIDE",
    aliases: ["HIDE", "MASQUER", "PLEINECRAN"],
    description: "Masque la ligne de commande pour maximiser le plan de travail",
    category: "Affichage",
    shortcut: "HIDE",
    icon: "Maximize2",
  },
  {
    id: "epaisseur",
    name: "EPAISSEUR",
    aliases: ["LW", "EPAISSEUR", "LINEWEIGHT"],
    description: "Regle l epaisseur graphique globale, ex EPAISSEUR 1.5",
    category: "Affichage",
    shortcut: "LW",
    icon: "Slash",
  },
  {
    id: "couleur",
    name: "COULEUR",
    aliases: ["COLOR", "COULEUR", "COL"],
    description: "Couleur active : cyan, rouge, vert, jaune, blanc, gris ou #RRGGBB",
    category: "Affichage",
    shortcut: "COLOR",
    icon: "Circle",
  },
  {
    id: "style",
    name: "STYLE",
    aliases: ["STYLE", "APPARENCE"],
    description: "Affiche le style graphique actif du plan de travail",
    category: "Affichage",
    shortcut: "STYLE",
    icon: "SlidersHorizontal",
  },
  {
    id: "raccourcis",
    name: "RACCOURCIS",
    aliases: ["SHORTCUTS", "RACCOURCIS", "RACCOURCI"],
    description: "Active ou desactive les raccourcis clavier a une touche",
    category: "Affichage",
    shortcut: "?",
    icon: "LayoutGrid",
  },
  // PATCH 017I : sauvegarde et restauration explicites.
  {
    id: "save",
    name: "SAUVER",
    aliases: ["SAVE", "SAUVER", "SAUVEGARDER", "QSAVE", "SV"],
    description: "Force une sauvegarde locale immediate du projet actif",
    category: "Données",
    shortcut: "Ctrl+S",
    icon: "Save",
  },
  {
    id: "restore",
    name: "RESTAURER",
    aliases: ["RESTORE", "RESTAURER", "RECUPERER", "RECOVER"],
    description: "Ouvre la derniere sauvegarde locale pour restauration",
    category: "Données",
    shortcut: "RESTORE",
    icon: "History",
  },
  // PATCH 017I2 : mesure du cache de projection.
  {
    id: "perf",
    name: "PERF",
    aliases: ["PERF", "PERFORMANCE", "DIAG", "STATS"],
    description: "Affiche l etat du cache de projection et le cout du dernier calcul",
    category: "Affichage",
    shortcut: "PERF",
    icon: "Activity",
  },
  // ESPACE DE TRAVAIL & MULTI-ÉCRAN (017Q3)
  {
    id: "workspace",
    name: "WORKSPACE",
    aliases: [
      "WORK",
      "WOR",
      "WS",
      "WSPACE",
      "ESPACETRAVAIL",
      "ESPACE",
      "MULTISCREEN",
      "MULTI_ECRAN",
      "MULTIECRAN",
      "DOUBLEECRAN",
      "DOUBLE_ECRAN",
      "DOUBLE ECRAN",
      "DOUBLE",
      "ECRAN",
      "ECRANS",
      "ECRAN2",
      "DEUXIEMEECRAN",
      "2EMEECRAN",
      "DUALSCREEN",
      "MONITEUR",
      "MONITEURS",
      "DISPLAYS",
      "SCREEN2",
      "SECONDECRAN",
      "SECOND_SCREEN",
    ],
    description: "Configuration de l'espace de travail et multi-écran synchronisé (3D, Spools, BOM, Inspecteur)",
    category: "Affichage",
    shortcut: "WS",
    icon: "SplitSquareVertical",
  },
  // CASTER / PROJETER SUR SMART TV (017Q3)
  {
    id: "casttv",
    name: "CASTTV",
    aliases: [
      "CAST",
      "CASTER",
      "TV",
      "SMARTTV",
      "PROJETER",
      "PROJECTION",
      "CHROMECAST",
      "AIRPLAY",
      "MIRACAST",
      "SCREENCAST",
      "ANDROIDTV",
      "TELE",
      "TELEVISION",
    ],
    description: "Caster et projeter la vue 3D ou Spools sur Smart TV Android / Chromecast sans fil",
    category: "Affichage",
    shortcut: "TV",
    icon: "Tv2",
  },
];

/**
 * Recherche intelligente de commandes AutoCAD par mot-clé / alias
 */
// PATCH 017C : normalisation (accents, casse) et classement par pertinence.
const pdiNormalizeCmd = (value: string): string =>
  !value || typeof value !== "string"
    ? ""
    : value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9?]/g, "")
        .toUpperCase();

export function searchCadCommands(query: string): CadCommandItem[] {
  const clean = pdiNormalizeCmd(query);
  if (!clean) return AUTOCAD_COMMANDS.slice(0, 12);
  const scored: Array<{ cmd: CadCommandItem; score: number }> = [];
  AUTOCAD_COMMANDS.forEach((cmd) => {
    const name = pdiNormalizeCmd(cmd.name);
    const id = pdiNormalizeCmd(cmd.id);
    const aliases = cmd.aliases.map(pdiNormalizeCmd);
    const description = pdiNormalizeCmd(cmd.description);
    let score = -1;
    if (name === clean || aliases.includes(clean) || id === clean) score = 100;
    else if (name.startsWith(clean) || id.startsWith(clean)) score = 80;
    else if (aliases.some((a) => a.startsWith(clean))) score = 70;
    else if (name.includes(clean) || id.includes(clean)) score = 50;
    else if (aliases.some((a) => a.includes(clean))) score = 40;
    else if (description.includes(clean)) score = 20;
    if (score >= 0) scored.push({ cmd, score });
  });
  return scored
    .sort((a, b) => (b.score - a.score) || a.cmd.name.localeCompare(b.cmd.name))
    .map((entry) => entry.cmd);
}


// PATCH 014 — Plant 3D / AutoCAD command registry for PD&I.
// Ces commandes servent à la ligne de commande type AutoCAD, au futur passage 3D,
// et aux exports BOM. Les commandes non encore natives sont déclarées en mode prepared.
export type PdiCommandReadiness = "implemented" | "prepared" | "future_3d" | "bom_export";
export type PdiCommandDomain =
  | "piping_3d"
  | "equipment_nozzle"
  | "supports"
  | "structure"
  | "iso_ortho"
  | "project_data"
  | "edit"
  | "clipboard"
  | "navigation_3d"
  | "bom";

export interface PdiPlant3dCommandRow {
  id: string;
  command: string;
  aliases: string[];
  domain: PdiCommandDomain;
  description: string;
  readiness: PdiCommandReadiness;
  pdiAction: string;
  bomCategory?: "pipe" | "fitting" | "valve" | "equipment" | "support" | "structure" | "weld" | "document";
  future3dEntity?: "pipeRoute" | "connector" | "spec" | "equipment" | "nozzle" | "support" | "steel" | "ortho" | "iso" | "project" | "view";
}

export const PDI_PLANT3D_COMMAND_TABLE: PdiPlant3dCommandRow[] = [
  { id:"plantpipeadd", command:"PLANTPIPEADD", aliases:["PPA","PIPEADD","ROUTEPIPE","TUBE3D"], domain:"piping_3d", description:"Route une ligne de tuyauterie et insère des composants", readiness:"future_3d", pdiAction:"Préparer routage tuyauterie 3D depuis graph ISO", bomCategory:"pipe", future3dEntity:"pipeRoute" },
  { id:"plantconnect", command:"PLANTCONNECT", aliases:["CONNECT","CONNEXION","PCONNECT"], domain:"piping_3d", description:"Force la connexion automatique entre deux composants", readiness:"prepared", pdiAction:"Connecter ports/nœuds sélectionnés", future3dEntity:"connector" },
  { id:"plantspecviewer", command:"PLANTSPECVIEWER", aliases:["SV","SPEC","SPECVIEWER"], domain:"piping_3d", description:"Ouvre le visualiseur de spécifications", readiness:"prepared", pdiAction:"Ouvrir/futur panneau Spec PD&I", future3dEntity:"spec" },
  { id:"plantspecupdatecheck", command:"PLANTSPECUPDATECHECK", aliases:["SPECUPDATE","CHECKSPEC"], domain:"piping_3d", description:"Vérifie et applique les mises à jour de classe Spec", readiness:"prepared", pdiAction:"Contrôler cohérence DN/spec du projet", future3dEntity:"spec" },
  { id:"plantconvertline", command:"PLANTCONVERTLINE", aliases:["PCL","CONVERTLINE","CONVERTIRLIGNE"], domain:"piping_3d", description:"Convertit une ligne/polyligne 3D en tuyauterie", readiness:"future_3d", pdiAction:"Convertir entités 2D/3D en segments PD&I", bomCategory:"pipe", future3dEntity:"pipeRoute" },
  { id:"plantfittingmove", command:"PLANTFITTINGMOVE", aliases:["FITTINGMOVE","MOVEFITTING","DEPLACERRACCORD"], domain:"piping_3d", description:"Déplace un raccord le long d'un segment", readiness:"implemented", pdiAction:"Déplacer équipement sur tube", bomCategory:"fitting", future3dEntity:"connector" },
  { id:"plantflipfitting", command:"PLANTFLIPFITTING", aliases:["FLIPFITTING","FLIP","RETOURNERRACCORD"], domain:"piping_3d", description:"Aligne ou retourne un raccord inséré", readiness:"implemented", pdiAction:"Miroir/retourner équipement sélectionné", bomCategory:"fitting", future3dEntity:"connector" },

  { id:"plantequipmentcreate", command:"PLANTEQUIPMENTCREATE", aliases:["PEC","EQUIPMENT","EQUIPEMENT"], domain:"equipment_nozzle", description:"Crée équipements standards", readiness:"future_3d", pdiAction:"Créer équipement intelligent PD&I", bomCategory:"equipment", future3dEntity:"equipment" },
  { id:"plantequipmentconvert", command:"PLANTEQUIPMENTCONVERT", aliases:["PECONV","CONVERTEQUIPMENT"], domain:"equipment_nozzle", description:"Convertit un solide 3D en équipement intelligent", readiness:"future_3d", pdiAction:"Convertir volume/bloc en équipement", bomCategory:"equipment", future3dEntity:"equipment" },
  { id:"plantnozzleadd", command:"PLANTNOZZLEADD", aliases:["NOZZLE","PIQUAGE","AJOUTPIQUAGE"], domain:"equipment_nozzle", description:"Ajoute/modifie un piquage sur équipement", readiness:"future_3d", pdiAction:"Créer port/piquage sur équipement", bomCategory:"fitting", future3dEntity:"nozzle" },

  { id:"plantsupportadd", command:"PLANTSUPPORTADD", aliases:["PSA","SUPPORT","SUPPORTADD"], domain:"supports", description:"Insère un support de tuyauterie", readiness:"future_3d", pdiAction:"Ajouter support attaché au tube", bomCategory:"support", future3dEntity:"support" },
  { id:"plantsupportconvert", command:"PLANTSUPPORTCONVERT", aliases:["SUPPORTCONVERT"], domain:"supports", description:"Convertit bloc/solide en support intelligent", readiness:"future_3d", pdiAction:"Convertir objet en support", bomCategory:"support", future3dEntity:"support" },

  { id:"plantsteelmember", command:"PLANTSTEELMEMBER", aliases:["STEELMEMBER","PROFILE","PROFIL"], domain:"structure", description:"Crée profilé métallique standard", readiness:"future_3d", pdiAction:"Préparer profilé structure", bomCategory:"structure", future3dEntity:"steel" },
  { id:"plantsteelplate", command:"PLANTSTEELPLATE", aliases:["STEELPLATE","PLATE","TOLE"], domain:"structure", description:"Crée plaque/tôle", readiness:"future_3d", pdiAction:"Préparer plaque structure", bomCategory:"structure", future3dEntity:"steel" },
  { id:"plantsteelfooting", command:"PLANTSTEELFOOTING", aliases:["FOOTING","FONDATION"], domain:"structure", description:"Dessine fondation béton", readiness:"future_3d", pdiAction:"Préparer fondation", bomCategory:"structure", future3dEntity:"steel" },
  { id:"plantsteelstair", command:"PLANTSTEELSTAIR", aliases:["STAIR","ESCALIER"], domain:"structure", description:"Génère escalier industriel", readiness:"future_3d", pdiAction:"Préparer escalier", bomCategory:"structure", future3dEntity:"steel" },
  { id:"plantsteelrack", command:"PLANTSTEELRACK", aliases:["RACK","ECHELLE"], domain:"structure", description:"Dessine échelles/crinolines", readiness:"future_3d", pdiAction:"Préparer rack/échelle", bomCategory:"structure", future3dEntity:"steel" },
  { id:"plantsteelhandrail", command:"PLANTSTEELHANDRAIL", aliases:["HANDRAIL","GARDECORPS"], domain:"structure", description:"Crée garde-corps", readiness:"future_3d", pdiAction:"Préparer garde-corps", bomCategory:"structure", future3dEntity:"steel" },
  { id:"plantsteelrail", command:"PLANTSTEELRAIL", aliases:["RAIL","LISSE"], domain:"structure", description:"Édite lisses/poteaux garde-corps", readiness:"future_3d", pdiAction:"Éditer garde-corps", bomCategory:"structure", future3dEntity:"steel" },

  { id:"plantorthocreate", command:"PLANTORTHOCREATE", aliases:["ORTHO","ORTHOCREATE"], domain:"iso_ortho", description:"Crée vue plane/élévation depuis modèle 3D", readiness:"future_3d", pdiAction:"Préparer vue ortho", bomCategory:"document", future3dEntity:"ortho" },
  { id:"plantorthoupdate", command:"PLANTORTHOUPDATE", aliases:["ORTHOUPDATE"], domain:"iso_ortho", description:"Met à jour vue orthogonale", readiness:"future_3d", pdiAction:"Mettre à jour vue ortho", future3dEntity:"ortho" },
  { id:"plantisoview", command:"PLANTISOVIEW", aliases:["ISOVIEW","ISO"], domain:"iso_ortho", description:"Ouvre gestionnaire de plans isométriques", readiness:"implemented", pdiAction:"Ouvrir module ISO", bomCategory:"document", future3dEntity:"iso" },
  { id:"plantisoproduction", command:"PLANTISOPRODUCTION", aliases:["ISOPROD","PRODUCTIONISO"], domain:"iso_ortho", description:"Génère dessins ISO fabrication", readiness:"bom_export", pdiAction:"Préparer export ISO + BOM", bomCategory:"document", future3dEntity:"iso" },
  { id:"plantisoquick", command:"PLANTISOQUICK", aliases:["ISOQUICK","QUICKISO"], domain:"iso_ortho", description:"Crée plan ISO de test", readiness:"implemented", pdiAction:"Basculer mode planche ISO", bomCategory:"document", future3dEntity:"iso" },

  { id:"projectmanager", command:"PROJECTMANAGER", aliases:["PM","PROJET"], domain:"project_data", description:"Affiche gestionnaire de projets", readiness:"prepared", pdiAction:"Ouvrir projets PD&I", future3dEntity:"project" },
  { id:"datamanager", command:"DATAMANAGER", aliases:["DM","DATA","DONNEES"], domain:"project_data", description:"Ouvre gestionnaire données/attributs", readiness:"bom_export", pdiAction:"Ouvrir propriétés + table BOM", bomCategory:"document", future3dEntity:"project" },
  { id:"plantaudit", command:"PLANTAUDIT", aliases:["AUDIT","REPAIR"], domain:"project_data", description:"Répare erreurs modèle/base", readiness:"prepared", pdiAction:"Audit graph/ports/soudures", future3dEntity:"project" },
  { id:"compressproject", command:"COMPRESSPROJECT", aliases:["COMPRESS","OPTIMISER"], domain:"project_data", description:"Compresse caches projet", readiness:"prepared", pdiAction:"Optimiser projet local", future3dEntity:"project" },
  { id:"auditproject", command:"AUDITPROJECT", aliases:["AUDITPROJET"], domain:"project_data", description:"Vérifie intégrité projet", readiness:"prepared", pdiAction:"Audit complet projet", future3dEntity:"project" },
  { id:"plantvalidate", command:"PLANTVALIDATE", aliases:["VALIDATE","VALIDER"], domain:"project_data", description:"Valide P&ID / modèle 3D", readiness:"prepared", pdiAction:"Valider cohérence graphe/BOM", future3dEntity:"project" },

  { id:"move", command:"MOVE", aliases:["M","DEPLACER","MOVE"], domain:"edit", description:"Déplace les objets sélectionnés", readiness:"implemented", pdiAction:"Commande guidée déplacement" },
  { id:"copy", command:"COPY", aliases:["CO","CP","COPIE","COPY"], domain:"edit", description:"Copie les objets sélectionnés", readiness:"implemented", pdiAction:"Commande guidée copie" },
  { id:"scale", command:"SCALE", aliases:["SC","ECHELLE"], domain:"edit", description:"Change échelle objets", readiness:"implemented", pdiAction:"Échelle sélection" },
  { id:"rotate", command:"ROTATE", aliases:["RO","ROTATION"], domain:"edit", description:"Rotation autour point base", readiness:"implemented", pdiAction:"Rotation sélection" },
  { id:"erase", command:"ERASE", aliases:["E","EFFACER","DELETE","SUPPR"], domain:"edit", description:"Efface/Supprime", readiness:"implemented", pdiAction:"Supprimer sélection" },
  { id:"explode", command:"EXPLODE", aliases:["X","EXPLOSER"], domain:"edit", description:"Décompose objet composite", readiness:"prepared", pdiAction:"Préparer décomposition groupe" },
  { id:"mirror", command:"MIRROR", aliases:["MI","MIROIR"], domain:"edit", description:"Symétrie miroir", readiness:"implemented", pdiAction:"Miroir sélection" },
  { id:"stretch", command:"STRETCH", aliases:["S","ETIRER"], domain:"edit", description:"Étire objets", readiness:"prepared", pdiAction:"Préparer stretch sélection" },
  { id:"trim", command:"TRIM", aliases:["TR","AJUSTER","COUPER"], domain:"edit", description:"Ajuste/coupe objets", readiness:"implemented", pdiAction:"Ajuster segment / frontière" },
  { id:"extend", command:"EXTEND", aliases:["EX","PROLONGER"], domain:"edit", description:"Prolonge objets", readiness:"implemented", pdiAction:"Prolonger vers limite" },
  { id:"fillet", command:"FILLET", aliases:["F","RACCORD","CONGE"], domain:"edit", description:"Raccorde avec arc/congé", readiness:"implemented", pdiAction:"Raccord d'angle ou coude", bomCategory:"fitting" },
  { id:"chamfer", command:"CHAMFER", aliases:["CHA","CHANFREIN"], domain:"edit", description:"Biseauter arêtes", readiness:"implemented", pdiAction:"Chanfrein d'angle" },
  { id:"offset", command:"OFFSET", aliases:["O","DECALER"], domain:"edit", description:"Crée parallèles/concentriques", readiness:"implemented", pdiAction:"Décaler parallèle / concentrique" },
  { id:"array", command:"ARRAY", aliases:["AR","RESEAU"], domain:"edit", description:"Copies multiples en réseau", readiness:"prepared", pdiAction:"Préparer array" },

  { id:"copyclip", command:"COPYCLIP", aliases:["CTRL+C","COPIERCLIP"], domain:"clipboard", description:"Copie sélection presse-papiers", readiness:"implemented", pdiAction:"Copier sélection" },
  { id:"copybase", command:"COPYBASE", aliases:["CTRL+SHIFT+C","COPIERBASE"], domain:"clipboard", description:"Copie avec point de base", readiness:"implemented", pdiAction:"Copie guidée point base" },
  { id:"pasteclip", command:"PASTECLIP", aliases:["CTRL+V","COLLER"], domain:"clipboard", description:"Colle presse-papiers", readiness:"implemented", pdiAction:"Coller au clic" },
  { id:"pasteorig", command:"PASTEORIG", aliases:["COLLERORIG"], domain:"clipboard", description:"Colle aux coordonnées origine", readiness:"prepared", pdiAction:"Coller coordonnées origine" },
  { id:"pasteblock", command:"PASTEBLOCK", aliases:["CTRL+SHIFT+V","COLLERBLOC"], domain:"clipboard", description:"Colle comme bloc", readiness:"prepared", pdiAction:"Créer groupe/bloc" },
  { id:"cutclip", command:"CUTCLIP", aliases:["CTRL+X","COUPER"], domain:"clipboard", description:"Coupe vers presse-papiers", readiness:"implemented", pdiAction:"Copier puis supprimer" },

  { id:"zoom", command:"ZOOM", aliases:["Z","ZOOM"], domain:"navigation_3d", description:"Zoom vue courante", readiness:"implemented", pdiAction:"Zoom/recentrage", future3dEntity:"view" },
  { id:"pan", command:"PAN", aliases:["P","PANORAMIQUE","MAIN"], domain:"navigation_3d", description:"Déplace la vue", readiness:"implemented", pdiAction:"Mode main/pan", future3dEntity:"view" },
  { id:"3dorbit", command:"3DORBIT", aliases:["3DO","ORBIT","ORBITE3D"], domain:"navigation_3d", description:"Pivoter autour modèle 3D", readiness:"future_3d", pdiAction:"Préparer orbite 3D", future3dEntity:"view" },
  { id:"vpoint", command:"VPOINT", aliases:["VUE3D","POINTVUE"], domain:"navigation_3d", description:"Direction visualisation 3D", readiness:"future_3d", pdiAction:"Préparer vues 3D", future3dEntity:"view" },
  { id:"regen", command:"REGEN", aliases:["RE","ACTUALISER"], domain:"navigation_3d", description:"Régénère dessin", readiness:"implemented", pdiAction:"Recalcul graphe/BOM/vue", future3dEntity:"view" },

  { id:"bom", command:"BOM", aliases:["BOM","METRE","NOMENCLATURE","MATERIEL","LISTE"], domain:"bom", description:"Ouvre/prépare nomenclature et métré", readiness:"bom_export", pdiAction:"Ouvrir tableau BOM/export", bomCategory:"document" },
];

export const PDI_BOM_EXPORT_COLUMNS = [
  "itemNo", "category", "lineNumber", "service", "spec", "dn", "nps", "description",
  "material", "rating", "schedule", "quantity", "unit", "lengthM", "weightKg",
  "weldCount", "tag", "fromNode", "toNode", "sourceCommand", "future3dEntity"
] as const;
