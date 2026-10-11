// PATCH 017L - feuille de style d impression sans dependance externe
//
// Avant : les fenetres d impression telechargeaient Tailwind 2.2.19 chez
// cdn.jsdelivr.net. Trois problemes : dependance a un tiers dans le chemin
// d impression, derive de version (2.2.19 contre la version de l application),
// et impression impossible hors ligne - bloquant pour la cible desktop.
//
// Apres : la fenetre reutilise la feuille de style DEJA CHARGEE par
// l application. Meme version, aucun telechargement, fonctionne hors ligne.

/**
 * Concatene les regles CSS du document courant.
 * Les feuilles d origine externe levent une SecurityError a la lecture de
 * cssRules : elles sont ignorees sans casser la collecte.
 */
export function pdiFeuilleImpression017L(): string {
  const morceaux: string[] = [];
  const feuilles = Array.from(document.styleSheets || []);
  for (const feuille of feuilles) {
    try {
      const regles = (feuille as CSSStyleSheet).cssRules;
      if (!regles) continue;
      for (let i = 0; i < regles.length; i++) morceaux.push(regles[i].cssText);
    } catch {
      // feuille inaccessible (origine differente) : ignoree volontairement
    }
  }
  return morceaux.join("\n");
}

/** Style de base applique en plus, commun a toutes les impressions. */
export const PDI_STYLE_IMPRESSION_017L = [
  "@media print { .pdi-no-print { display: none !important; } }",
  "body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
].join("\n");
