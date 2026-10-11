// PATCH 017L - porte des droits centrale
//
// Avance du 023. Un seul point de decision pour savoir si un module est
// accessible, au lieu de conditions dispersees. Aujourd hui la porte laisse
// tout passer sauf ce qui est explicitement desactive : elle ne change donc
// aucun comportement existant. Le 023 y branchera les licences.

export type PdiModule017L =
  | "iso"
  | "bom"
  | "impression"
  | "croquis"
  | "vision"
  | "genie_civil"
  | "pack_regional";

/** Modules desactives par defaut. Le pack regional est isole, jamais efface (R22). */
const DESACTIVES_PAR_DEFAUT: PdiModule017L[] = ["pack_regional", "vision"];

const CLE_STOCKAGE = "pdi.droits.v1";

function lireDerogations(): Record<string, boolean> {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    return brut ? (JSON.parse(brut) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Le module est-il accessible ?
 * Regle : autorise, sauf desactivation par defaut non levee explicitement.
 */
export function pdiCan(module: PdiModule017L): boolean {
  const derogations = lireDerogations();
  if (Object.prototype.hasOwnProperty.call(derogations, module)) {
    return derogations[module] === true;
  }
  return !DESACTIVES_PAR_DEFAUT.includes(module);
}

/** Active ou desactive un module pour ce poste. */
export function pdiSetCan017L(module: PdiModule017L, actif: boolean): void {
  try {
    const d = lireDerogations();
    d[module] = actif;
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(d));
  } catch {
    // stockage indisponible : la porte retombe sur les valeurs par defaut
  }
}

/** Liste des modules actuellement ouverts, pour affichage de diagnostic. */
export function pdiModulesOuverts017L(): PdiModule017L[] {
  const tous: PdiModule017L[] = [
    "iso", "bom", "impression", "croquis", "vision", "genie_civil", "pack_regional",
  ];
  return tous.filter(pdiCan);
}
