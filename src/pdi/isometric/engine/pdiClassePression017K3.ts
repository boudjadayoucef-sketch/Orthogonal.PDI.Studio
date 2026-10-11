/**
 * @deprecated DEPRECATED PMS HELPER — NON-NORMATIVE (Reference: ARCH-02).
 * 
 * Ce module est un reliquat historique conservé UNIQUEMENT pour initialiser les listes
 * déroulantes de l'UI (valeurs par défaut de formulaire).
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE (ARCH-02) :
 * - Ce fichier N'EST PAS une autorité normative.
 * - L'unique autorité normative est le Normative Engine (`src/pdi/normative/`).
 * - Ce fichier ne peut jamais autoriser une décision normative COMPATIBLE.
 */
// PATCH 017K3 : la classe de pression est une propriete de la SPEC.
//
// POURQUOI CE FICHIER EXISTE (HISTORIQUE) :
// Le formulaire de creation de troncon proposait "Class 600" en dur, alors
// que la spec active du projet etait CS150, donc Class 150. Les deux ne
// peuvent pas etre vrais en meme temps, et c est la spec qui fait foi.
//
// STATUT ACTUEL (ARCH-02) :
// Ce module est déprécié au profit du moteur normatif officiel (`src/pdi/normative/`).
// Il est encapsulé par `LegacyPmsAdapter` et ne peut en aucun cas supplanter
// les vérifications ASME B31.3 / B16.5 / B16.9 de la chaîne normative.

import { PDI_DEFAULT_SPECS, pdiFindSpec } from "./pdiTagging";
import type { PdiProjectSetup } from "./pdiTagging";

/** @deprecated Liste descriptive pour menus déroulants UI. */
export const PDI_CLASSES_B165_017K3: string[] = [
  "Class 150",
  "Class 300",
  "Class 400",
  "Class 600",
  "Class 900",
  "Class 1500",
  "Class 2500",
];

/**
 * Designations PN (EN 1092-1 / DIN / ISO), pour les specs métriques et non métalliques.
 */
export const PDI_DESIGNATIONS_PN_017K3: string[] = ["PN10", "PN16", "PN25", "PN40", "PN63", "PN100", "PN160", "PN250", "PN400"];

/** Classe de repli quand aucun projet n est encore charge. */
export const PDI_CLASSE_PAR_DEFAUT_017K3: string =
  PDI_DEFAULT_SPECS[0]?.pressureClass ?? "Class 150";

/** Materiau de repli, lu dans la meme spec que la classe. */
export const PDI_MATERIAU_PAR_DEFAUT_017K3: string =
  PDI_DEFAULT_SPECS[0]?.material ?? "Acier carbone";

/** Spec active du projet : celle qui est explicitement demandee, sinon la premiere declaree. */
function specActive017K3(setup?: PdiProjectSetup, code?: string) {
  if (!setup) return undefined;
  if (code) {
    const trouvee = pdiFindSpec(setup, code);
    if (trouvee) return trouvee;
  }
  return setup.specs && setup.specs.length > 0 ? setup.specs[0] : undefined;
}

/** Classe de pression imposee par la spec du projet. */
export function pdiClasseDeSpec017K3(
  setup?: PdiProjectSetup,
  code?: string,
): string {
  const spec = specActive017K3(setup, code);
  return spec?.pressureClass || PDI_CLASSE_PAR_DEFAUT_017K3;
}

/** Materiau impose par la spec du projet. */
export function pdiMateriauDeSpec017K3(
  setup?: PdiProjectSetup,
  code?: string,
): string {
  const spec = specActive017K3(setup, code);
  return spec?.material || PDI_MATERIAU_PAR_DEFAUT_017K3;
}

/** Vrai si la classe choisie est bien celle de la spec. */
export function pdiClasseConforme017K3(
  classe: string,
  setup?: PdiProjectSetup,
  code?: string,
): boolean {
  return classe === pdiClasseDeSpec017K3(setup, code);
}

/**
 * Message de derogation. On n interdit pas : un projet reel comporte des
 * ruptures de spec. On rend la derogation visible au lieu de la subir.
 */
export function pdiMessageDerogation017K3(
  classe: string,
  attendue: string,
): string {
  return (
    "Classe " +
    classe +
    " differente de la spec du projet (" +
    attendue +
    "). La specification de tuyauterie fixe la classe de la ligne : la classe " +
    "se determine a partir de la pression et de la temperature de calcul " +
    "(table pression-temperature ASME B16.5). Verifiez la rupture de spec."
  );
}
