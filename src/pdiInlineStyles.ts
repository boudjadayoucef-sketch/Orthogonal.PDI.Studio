// PATCH 017H : feuilles de styles embarquees dans le bundle JavaScript.
//
// Contexte : sur la plateforme d hebergement, les requetes vers
// /assets/*.css repondent 403 (Forbidden) alors que les bundles .js du meme
// dossier sont servis normalement. Le navigateur ignorait donc silencieusement
// la feuille de styles et l application basculait sur l affichage de secours
// 017D (html.pdi-no-tailwind + bandeau orange).
//
// Solution : importer chaque CSS avec le suffixe Vite "?inline". Vite renvoie
// alors le CSS compile (Tailwind inclus) sous forme de chaine de caracteres
// integree au bundle JS. On l injecte dans une balise <style> au demarrage.
// Consequence : plus aucun fichier .css n est demande au serveur.
// PATCH 017H2 : l ordre des imports ne pilote plus la cascade ; c est l ordre
// du tableau PDI_INLINE_SHEETS ci-dessous qui fait foi (Tailwind en dernier).
import baseCss from "./index.css?inline";
import precisionCss from "./pdiIsoPrecisionUx.css?inline";
import leafletCss from "leaflet/dist/leaflet.css?inline";

type PdiInlineSheet = { id: string; css: string };

// PATCH 017H2 : ordre de cascade identique a la chaine de build d origine.
// Les feuilles maison d abord, Tailwind (index.css) EN DERNIER, sinon les
// regles maison ecrasent les utilitaires (z-index, hauteurs, overflow) et la
// barre de commandes / le dock ONGLETS passent devant les modales.
const PDI_INLINE_SHEETS: PdiInlineSheet[] = [
  { id: "pdi-inline-precision-017h", css: precisionCss },
  { id: "pdi-inline-leaflet-017h", css: leafletCss },
  { id: "pdi-inline-base-017h", css: baseCss },
];

/** Injecte un CSS deja embarque. Retourne true si une balise a ete creee. */
export function pdiInjectInlineCss(id: string, css: string): boolean {
  try {
    if (!css || typeof css !== "string") return false;
    if (document.getElementById(id)) return false;
    const style = document.createElement("style");
    style.id = id;
    style.setAttribute("data-pdi-inline-css", "017H");
    style.textContent = css;
    document.head.appendChild(style);
    return true;
  } catch {
    return false;
  }
}

/** Injecte toutes les feuilles du projet et desactive l affichage de secours. */
export function pdiInstallInlineStyles(): number {
  let count = 0;
  let bytes = 0;
  PDI_INLINE_SHEETS.forEach((sheet) => {
    if (pdiInjectInlineCss(sheet.id, sheet.css)) {
      count += 1;
      bytes += sheet.css.length;
    }
  });
  if (count > 0) {
    try {
      document.documentElement.classList.remove("pdi-no-tailwind");
      const alertBar = document.getElementById("pdi-style-alert");
      if (alertBar) alertBar.remove();
    } catch {}
  }
  console.info(
    "[PD&I 017H] Feuilles de styles embarquees : " + count + " (" + bytes + " octets)"
  );
  return count;
}

pdiInstallInlineStyles();
