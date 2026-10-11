// PATCH 017P10 : REGLES DE VALIDATION DE SAISIE PD&I.
//
// Le 017P9 a unifie les anomalies du MODELE (11 codes, un seul module).
// Restait un cinquieme point de verite que personne n avait vu : le validateur
// des champs du volet Proprietes, qui avait ses propres regles, ses propres
// messages, et surtout aucun moyen de s effacer.
//
// Ce module porte les regles de SAISIE. Elles sont distinctes des anomalies du
// modele, et c est voulu :
//   - pdiAnomalies017P9 decrit un etat du modele qui est faux ;
//   - pdiSaisie017P10 empeche une frappe clavier de rendre le modele faux.
// Mais elles ne doivent plus se contredire a l ecran, ni rester affichees
// apres correction.
//
// Regle : tout message de refus de saisie s ecrit ICI, nulle part ailleurs, et
// dit toujours trois choses : quel champ, pourquoi, ce qui a ete conserve.

// Longueur minimale d un troncon saisissable au clavier, en metres.
// Valeur reprise du plancher historique de setSegmentLength (0,05 m = 50 mm).
export const PDI_LONGUEUR_MIN_017P10 = 0.05;

export interface PdiControleSaisie017P10 {
  ok: boolean;
  valeur: number;
  message?: string;
}

function refus(message: string): PdiControleSaisie017P10 {
  return { ok: false, valeur: 0, message: message };
}

/**
 * Controle de la longueur saisie au clavier.
 *
 * Avant le 017P10, saisir 0 donnait 0,05 sans explication, parce que
 * "Number(0) || 0.05" vaut 0.05. On refuse desormais, et on dit pourquoi.
 */
export function pdiValiderLongueur017P10(valeur: unknown): PdiControleSaisie017P10 {
  const n = Number(valeur);
  if (!Number.isFinite(n)) {
    return refus(
      "Longueur refusee : saisissez un nombre, en metres. " +
      "La longueur precedente est conservee.",
    );
  }
  if (n <= 0) {
    return refus(
      "Longueur refusee : un troncon de longueur nulle ou negative n existe pas. " +
      "La longueur precedente est conservee.",
    );
  }
  if (n < PDI_LONGUEUR_MIN_017P10) {
    return refus(
      "Longueur refusee : minimum " + PDI_LONGUEUR_MIN_017P10.toFixed(2) + " m (" +
      String(Math.round(PDI_LONGUEUR_MIN_017P10 * 1000)) + " mm). " +
      "La longueur precedente est conservee.",
    );
  }
  return { ok: true, valeur: n };
}

/**
 * Controle du diametre saisi au clavier.
 *
 * Vider le champ pour le retaper envoyait 0, donc un refus immediat en pleine
 * frappe. Le message nomme maintenant le bon champ et annonce ce qui est garde.
 */
export function pdiValiderDn017P10(valeur: unknown): PdiControleSaisie017P10 {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n <= 0) {
    return refus(
      "DN refuse : le diametre doit etre un nombre superieur a 0. " +
      "Le diametre precedent est conserve.",
    );
  }
  return { ok: true, valeur: Math.round(n) };
}

/**
 * Message a afficher quand l accrochage a modifie la valeur saisie.
 * Retourne une chaine vide s il n y a rien a signaler : l appelant peut donc
 * transmettre le resultat tel quel.
 */
export function pdiEcartAccrochage017P10(demandee: number, obtenue: number): string {
  if (!Number.isFinite(demandee) || !Number.isFinite(obtenue)) return "";
  if (Math.abs(obtenue - demandee) <= 0.001) return "";
  return (
    "Longueur saisie " + demandee.toFixed(3) + " m, appliquee " +
    obtenue.toFixed(3) + " m apres accrochage."
  );
}
