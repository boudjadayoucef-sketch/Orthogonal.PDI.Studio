// PATCH 017P9 : SOURCE UNIQUE DES ANOMALIES DU RESEAU PD&I.
//
// Ce fichier est le SEUL endroit du projet ou une regle d anomalie est ecrite.
// Avant le 017P9, deux jeux de regles coexistaient sans se connaitre :
//   (a) validateProjectGraph (IsometrieModuleV48d.tsx) : 7 codes structurels,
//       affiches par le bandeau haut, le panneau Controle du reseau et la
//       barre d etat.
//   (b) le volet Anomalies du 017F2 : 4 regles recalculees dans le JSX, que le
//       jeu (a) ignorait totalement. D ou "2 erreur(s)" en haut et
//       "ANOMALIES 0" juste a cote.
//
// pdiUnifyAnomalies017P9 prend la liste du jeu (a) et y ajoute les regles du
// jeu (b), sans doublon. Resultat : 11 codes, une seule liste, quatre points
// d affichage servis par la meme verite.
//
// Regle : toute regle d anomalie nouvelle s ajoute ICI, et nulle part ailleurs.

export type PdiSeverite017P9 = "error" | "warning";

export interface PdiAnomalie017P9 {
  id: string;
  severity: PdiSeverite017P9;
  code: string;
  message: string;
  entityId?: string;
}

// Vues minimales des entites. On ne reimporte pas IsoNode / IsoSegment depuis
// IsometrieModuleV48d.tsx pour ne pas creer de dependance circulaire.
export interface PdiNoeudVu017P9 {
  id: string;
  name?: string;
  type?: string;
  equipmentType?: string;
}

export interface PdiTronconVu017P9 {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  dn?: number;
  length?: number;
  tag?: string;
  spec?: string;
}

// Les 11 codes. Les 7 premiers viennent de validateProjectGraph, les 4 derniers
// du volet Anomalies du 017F2.
export const PDI_ANOMALIE_CODES_017P9 = [
  "MISSING_NODE",
  "MISSING_PORT",
  "MISSING_LINE",
  "ZERO_LENGTH",
  "PORT_CAPACITY",
  "DN_MISMATCH",
  "ISOLATED_EQUIPMENT",
  "SEGMENT_UNTAGGED",
  "NODE_ISOLATED",
  "TEE_INCOMPLETE",
  "SPEC_DN_VIOLATION",
];

// Libelle court, pour le volet lateral ou la place manque.
export const PDI_ANOMALIE_LIBELLES_017P9: Record<string, string> = {
  MISSING_NODE: "Noeud absent",
  MISSING_PORT: "Port invalide",
  MISSING_LINE: "Ligne de tuyauterie absente",
  ZERO_LENGTH: "Longueur nulle",
  PORT_CAPACITY: "Port surcharge",
  DN_MISMATCH: "DN incoherent",
  ISOLATED_EQUIPMENT: "Equipement non raccorde",
  SEGMENT_UNTAGGED: "Troncon non tagge",
  NODE_ISOLATED: "Noeud isole",
  TEE_INCOMPLETE: "Te incomplet",
  SPEC_DN_VIOLATION: "DN hors spec",
};

export function pdiAnomalieLibelle017P9(issue: PdiAnomalie017P9): string {
  return PDI_ANOMALIE_LIBELLES_017P9[issue.code] || issue.code;
}

// Le volet Anomalies a besoin de savoir s il doit selectionner un noeud ou un
// troncon quand l utilisateur clique la ligne.
export function pdiAnomalieKind017P9(
  issue: PdiAnomalie017P9,
  nodes: PdiNoeudVu017P9[],
): "node" | "segment" {
  const cible = issue.entityId || issue.id;
  return nodes.some((n) => n.id === cible) ? "node" : "segment";
}

/**
 * Union des deux jeux de regles.
 *
 * @param base      liste produite par validateProjectGraph (jeu a)
 * @param nodes     noeuds du projet
 * @param segments  troncons du projet
 * @param specAutorise  rappel fourni par l appelant : (codeSpec, dn) => boolean.
 *                  Passe en parametre pour que ce module reste sans dependance.
 */
export function pdiUnifyAnomalies017P9(
  base: PdiAnomalie017P9[],
  nodes: PdiNoeudVu017P9[],
  segments: PdiTronconVu017P9[],
  specAutorise?: (codeSpec: string, dn: number) => boolean,
): PdiAnomalie017P9[] {
  const issues: PdiAnomalie017P9[] = base.slice();

  const cleDe = (a: PdiAnomalie017P9) => a.code + "|" + (a.entityId || a.id);
  const vues = new Set(issues.map(cleDe));
  const ajoute = (a: PdiAnomalie017P9) => {
    const cle = cleDe(a);
    if (!vues.has(cle)) {
      vues.add(cle);
      issues.push(a);
    }
  };

  // Deja signale par le jeu (a) : on ne redit pas la meme chose autrement.
  const longueurDejaVue = new Set(
    base.filter((i) => i.code === "ZERO_LENGTH").map((i) => i.entityId || i.id),
  );
  const equipementDejaIsole = new Set(
    base.filter((i) => i.code === "ISOLATED_EQUIPMENT").map((i) => i.entityId || i.id),
  );

  // Nombre de raccordements par noeud, calcule une seule fois.
  const raccordements = new Map<string, number>();
  for (const seg of segments) {
    raccordements.set(seg.fromNodeId, (raccordements.get(seg.fromNodeId) || 0) + 1);
    raccordements.set(seg.toNodeId, (raccordements.get(seg.toNodeId) || 0) + 1);
  }

  for (const seg of segments) {
    // Regle volet 1 : troncon sans tag industriel.
    if (!seg.tag) {
      ajoute({
        id: "untagged_" + seg.id,
        severity: "warning",
        code: "SEGMENT_UNTAGGED",
        message: "Troncon " + seg.id + " : aucun tag industriel",
        entityId: seg.id,
      });
    }

    // Complement du jeu (a) : validateProjectGraph teste length <= 0.001, ce qui
    // laisse passer une longueur non renseignee (NaN). On comble le trou sous le
    // code existant plutot que d en inventer un nouveau.
    const longueur = Number(seg.length);
    if (!(longueur > 0) && !longueurDejaVue.has(seg.id)) {
      ajoute({
        id: "length_nr_" + seg.id,
        severity: "error",
        code: "ZERO_LENGTH",
        message: "Troncon " + seg.id + " : longueur non renseignee",
        entityId: seg.id,
      });
    }

    // Regle volet 2 : DN hors de la spec affectee au troncon.
    if (seg.spec && typeof specAutorise === "function" && !specAutorise(seg.spec, Number(seg.dn))) {
      ajoute({
        id: "spec_" + seg.id,
        severity: "error",
        code: "SPEC_DN_VIOLATION",
        message: "Troncon " + seg.id + " : DN" + String(seg.dn) + " hors spec " + seg.spec,
        entityId: seg.id,
      });
    }
  }

  for (const node of nodes) {
    const relies = raccordements.get(node.id) || 0;

    // Regle volet 3 : noeud isole. Le jeu (a) ne signalait que les equipements ;
    // le volet signalait tous les noeuds. On garde la portee large, sans
    // doublonner ce que le jeu (a) a deja dit.
    if (relies === 0) {
      if (!equipementDejaIsole.has(node.id)) {
        ajoute({
          id: "isole_" + node.id,
          severity: "warning",
          code: "NODE_ISOLATED",
          message: (node.name || node.id) + " n est raccorde a aucun troncon",
          entityId: node.id,
        });
      }
      continue;
    }

    // Regle volet 4 : te a moins de trois branches.
    if (node.type === "tee" && relies < 3) {
      ajoute({
        id: "te_" + node.id,
        severity: "warning",
        code: "TEE_INCOMPLETE",
        message: (node.name || node.id) + " : te incomplet (" + String(relies) + " branche(s))",
        entityId: node.id,
      });
    }
  }

  return issues;
}
