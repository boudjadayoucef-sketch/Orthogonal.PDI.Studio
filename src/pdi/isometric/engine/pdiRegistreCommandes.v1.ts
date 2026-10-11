// PATCH 017M : REGISTRE UNIQUE DES COMMANDES PD&I.
//
// Point de verite unique du ruban. Avant ce fichier, trois sources decrivaient
// les commandes sans se parler :
//   - 47 entrees de menu ecrites a la main dans IsometrieModuleV48d.tsx ;
//   - AUTOCAD_COMMANDS (46 commandes) dans CadAutocadEngine.ts ;
//   - PDI_PLANT3D_COMMAND_TABLE (56 commandes) dans le meme fichier.
// Une commande pouvait donc etre tapable sans etre cliquable, ou l inverse.
//
// REGLE : le ruban n affiche QUE ce qui est declare ici. Pour ajouter une
// commande au ruban, on ajoute une entree dans ce tableau. Nulle part ailleurs.
//
// COMMENT LES ACTIONS SONT RETROUVEES
// Les 47 actions existantes ne sont PAS reecrites ici : elles vivent dans le
// moteur sous forme de fermetures qui capturent l etat React, et les deplacer
// dans un module serait long et risque. Chaque entree les designe donc par
// source = { menu, index } : le titre du groupe de menu historique et le rang de
// l entree. Le moteur resout ce couple et reutilise l action telle quelle.
// C est volontairement conservateur : le code qui fonctionne n est pas touche.
//
// ETAT DES ENTREES
//   "actif" : l action existe et repond.
//   "grise" : la commande est declaree, visible, non cliquable, et son
//             infobulle annonce le jalon qui l activera. On montre la feuille
//             de route au lieu de la cacher.

export type PdiOngletRuban017M =
  | "fichier"
  | "edition"
  | "dessin"
  | "annoter"
  | "precision"
  | "volume"
  | "insertion"
  | "trois_d"
  | "donnees"
  | "affichage";

export type PdiEtatCommande017M = "actif" | "grise";

export type PdiPorteeCommande017M =
  | "projet"
  | "selection"
  | "vue"
  | "document"
  | "session";

export interface PdiSourceAction017M {
  /** Titre exact du groupe de menu historique dans le moteur. */
  menu: string;
  /** Rang de l entree dans ce groupe, a partir de 0. */
  index: number;
}

export interface PdiEntreeRuban017M {
  id: string;
  nomFr: string;
  nomEn: string;
  aliases: string[];
  icone: string;
  raccourci?: string;
  onglet: PdiOngletRuban017M;
  groupe: string;
  ordre: number;
  portee: PdiPorteeCommande017M;
  etat: PdiEtatCommande017M;
  source?: PdiSourceAction017M;
  /** Pour les bascules : afficher le libelle vivant plutot que nomFr. */
  suivreLibelle?: boolean;
  /** Pour les grisees : jalon qui activera la commande. */
  jalon?: string;
  /**
   * PATCH 017M2 : commande equivalente au clavier. Quand ce champ est
   * renseigne, le ruban appelle executeCadCommand(commande) : le bouton
   * emprunte exactement le chemin de la ligne de commande. Une seule voie
   * d execution, donc aucune divergence possible (regle R8).
   */
  commande?: string;
}

export const PDI_ONGLETS_RUBAN_017M: Array<{
  id: PdiOngletRuban017M;
  nomFr: string;
  nomEn: string;
}> = [
  { id: "fichier", nomFr: "Fichier", nomEn: "File" },
  { id: "edition", nomFr: "Edition", nomEn: "Edit" },
  { id: "dessin", nomFr: "Dessin", nomEn: "Draw" },
  { id: "annoter", nomFr: "Annoter", nomEn: "Annotate" },
  { id: "precision", nomFr: "Precision", nomEn: "Precision" },
  { id: "volume", nomFr: "Volume & Skid", nomEn: "Volume & Skid" },
  { id: "insertion", nomFr: "Insertion", nomEn: "Insert" },
  { id: "trois_d", nomFr: "3D", nomEn: "3D" },
  { id: "donnees", nomFr: "Donnees", nomEn: "Data" },
  { id: "affichage", nomFr: "Affichage", nomEn: "View" },
];

/** Invite de la ligne de commande, alignee sur le vocabulaire tuyauterie. */
export const PDI_INVITE_COMMANDE_017M =
  "Tapez une commande (ex: TUBE, TE, COUDE, COTER, ALIGNER, BOM...)";

export const PDI_REGISTRE_RUBAN_017M: PdiEntreeRuban017M[] = [
  // ================= 1. FICHIER =================
  { id:"fichier.nouveau", nomFr:"Nouveau projet", nomEn:"New project", aliases:["NOUVEAU","NEW"], icone:"\u2726", onglet:"fichier", groupe:"Nouveau et ouverture", ordre:1, portee:"projet", etat:"actif", source:{menu:"Fichier",index:0} },
  { id:"fichier.accueil", nomFr:"Accueil", nomEn:"Home", aliases:["ACCUEIL","HOME"], icone:"\u2302", onglet:"fichier", groupe:"Nouveau et ouverture", ordre:2, portee:"session", etat:"actif", source:{menu:"Fichier",index:1} },
  { id:"fichier.landing", nomFr:"Presentation", nomEn:"Landing", aliases:["LANDING"], icone:"\u25c8", onglet:"fichier", groupe:"Nouveau et ouverture", ordre:3, portee:"session", etat:"actif", source:{menu:"Fichier",index:2} },
  { id:"fichier.ouvrir", nomFr:"Ouvrir JSON", nomEn:"Open JSON", aliases:["OUVRIR","OPEN","IMPORT"], icone:"\u{1F4C2}", raccourci:"Ctrl+O", onglet:"fichier", groupe:"Nouveau et ouverture", ordre:4, portee:"projet", etat:"actif", source:{menu:"Fichier",index:9} },
  { id:"fichier.exemple.demo", nomFr:"Démo 3D Complète", nomEn:"Complete 3D Demo", aliases:["DEMO","COMPLEXE","SAMPLE","PROJET_DEMO"], icone:"✨", onglet:"fichier", groupe:"Exemples", ordre:1, portee:"projet", etat:"actif", commande:"DEMO" },
  { id:"fichier.exemple.poste", nomFr:"Exemple poste", nomEn:"Station sample", aliases:["EXEMPLEPOSTE"], icone:"\u25a6", onglet:"fichier", groupe:"Exemples", ordre:2, portee:"projet", etat:"actif", source:{menu:"Fichier",index:4} },
  { id:"fichier.exemple.gare", nomFr:"Exemple gare racleur", nomEn:"Pig trap sample", aliases:["EXEMPLEGARE"], icone:"\u25a7", onglet:"fichier", groupe:"Exemples", ordre:3, portee:"projet", etat:"actif", source:{menu:"Fichier",index:5} },
  { id:"fichier.exemple.chambre", nomFr:"Démo Chambre Technique", nomEn:"Technical Chamber Demo", aliases:["DEMO_CT","CHAMBRE"], icone:"🏠", onglet:"fichier", groupe:"Exemples", ordre:4, portee:"projet", etat:"actif", commande:"DEMO_CT" },
  { id:"fichier.exemple.skid", nomFr:"Démo Skid de Filtration", nomEn:"Filtration Skid Demo", aliases:["DEMO_SKID","SKID_DEMO"], icone:"⚙️", onglet:"fichier", groupe:"Exemples", ordre:5, portee:"projet", etat:"actif", commande:"DEMO_SKID" },
  { id:"fichier.sauver", nomFr:"Sauver JSON", nomEn:"Save JSON", aliases:["SAUVER","SAVE","EXPORT"], icone:"\u{1F4BE}", raccourci:"Ctrl+S", onglet:"fichier", groupe:"Enregistrement", ordre:1, portee:"projet", etat:"actif", source:{menu:"Fichier",index:10} },
  { id:"fichier.planche", nomFr:"Planche ISO A3", nomEn:"ISO sheet A3", aliases:["PLANCHE","A3","PLANTISOVIEW","PLANTISOQUICK","ISOVIEW"], icone:"\u25a4", raccourci:"A3", onglet:"fichier", groupe:"Impression et export", ordre:1, portee:"document", etat:"actif", source:{menu:"Impression",index:0} },
  { id:"fichier.imprimer", nomFr:"Imprimer", nomEn:"Print", aliases:["IMPRIMER","PRINT","PLOT"], icone:"\u2399", raccourci:"P", onglet:"fichier", groupe:"Impression et export", ordre:2, portee:"document", etat:"actif", source:{menu:"Impression",index:1} },
  { id:"fichier.export.pdf", nomFr:"Export PDF", nomEn:"Export PDF", aliases:["PDF","EXPORTPDF"], icone:"\u{1F5CE}", onglet:"fichier", groupe:"Export", ordre:1, portee:"document", etat:"actif" },
  { id:"fichier.export.dxf", nomFr:"Export DXF", nomEn:"Export DXF", aliases:["DXF","EXPORTDXF"], icone:"\u25f1", onglet:"fichier", groupe:"Export", ordre:2, portee:"document", etat:"actif" },
  { id:"fichier.export.png", nomFr:"Export PNG", nomEn:"Export PNG", aliases:["PNG","EXPORTPNG"], icone:"🖼️", onglet:"fichier", groupe:"Export", ordre:3, portee:"document", etat:"actif" },
  { id:"fichier.export.jpeg", nomFr:"Export JPEG", nomEn:"Export JPEG", aliases:["JPEG","EXPORTJPEG","JPG"], icone:"🖼️", onglet:"fichier", groupe:"Export", ordre:4, portee:"document", etat:"actif" },
  { id:"fichier.export.svg", nomFr:"Export SVG", nomEn:"Export SVG", aliases:["SVG","EXPORTSVG"], icone:"⚡", onglet:"fichier", groupe:"Export", ordre:5, portee:"document", etat:"actif" },
  { id:"fichier.deconnexion", nomFr:"Deconnexion", nomEn:"Sign out", aliases:["DECONNEXION","LOGOUT"], icone:"\u238b", onglet:"fichier", groupe:"Session", ordre:1, portee:"session", etat:"actif", source:{menu:"Fichier",index:11} },

  // ================= 2. EDITION =================
  { id:"edition.annuler", nomFr:"Annuler", nomEn:"Undo", aliases:["ANNULER","UNDO","U"], icone:"\u21b6", raccourci:"Ctrl+Z", onglet:"edition", groupe:"Annulation", ordre:1, portee:"projet", etat:"actif", source:{menu:"\u00c9dition",index:0} },
  { id:"edition.retablir", nomFr:"Retablir", nomEn:"Redo", aliases:["RETABLIR","REDO"], icone:"\u21b7", raccourci:"Ctrl+Y", onglet:"edition", groupe:"Annulation", ordre:2, portee:"projet", etat:"actif", source:{menu:"\u00c9dition",index:1} },
  { id:"edition.copier", nomFr:"Copier", nomEn:"Copy", aliases:["CO","CP","COPY","COPIER","COPYCLIP","COPYBASE"], icone:"\u29c9", raccourci:"Ctrl+C", onglet:"edition", groupe:"Presse-papiers", ordre:1, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:2} },
  { id:"edition.couper", nomFr:"Couper", nomEn:"Cut", aliases:["COUPER","CUT","CUTCLIP"], icone:"\u2702", raccourci:"Ctrl+X", onglet:"edition", groupe:"Presse-papiers", ordre:2, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:3} },
  { id:"edition.coller", nomFr:"Coller", nomEn:"Paste", aliases:["PA","PASTE","COLLER","PASTECLIP","PASTEBLOCK","PASTEORIG"], icone:"\u{1F4CB}", raccourci:"Ctrl+V", onglet:"edition", groupe:"Presse-papiers", ordre:3, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:4} },
  { id:"edition.dupliquer", nomFr:"Dupliquer", nomEn:"Duplicate", aliases:["DUPLIQUER","DUP"], icone:"\u29c9", raccourci:"Ctrl+D", onglet:"edition", groupe:"Presse-papiers", ordre:4, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:5} },
  { id:"edition.tout", nomFr:"Tout selectionner", nomEn:"Select all", aliases:["TOUT","SELECTALL"], icone:"\u2b1a", raccourci:"Ctrl+A", onglet:"edition", groupe:"Selection", ordre:1, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:6} },
  { id:"edition.deselectionner", nomFr:"Deselectionner", nomEn:"Deselect", aliases:["DESELECT"], icone:"\u2b1c", raccourci:"Esc", onglet:"edition", groupe:"Selection", ordre:2, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:8} },
  { id:"edition.supprimer", nomFr:"Supprimer", nomEn:"Delete", aliases:["SUPPR","DELETE","E"], icone:"\u{1F5D1}", raccourci:"Suppr", onglet:"edition", groupe:"Selection", ordre:3, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:7} },
  { id:"edition.grouper", nomFr:"Grouper", nomEn:"Group", aliases:["GROUPER","GROUP","G"], icone:"\u25f0", raccourci:"Ctrl+G", onglet:"edition", groupe:"Groupes et blocs", ordre:1, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:9} },
  { id:"edition.associer", nomFr:"Associer", nomEn:"Associate", aliases:["ASSOCIER","ASSOC","SPOOL"], icone:"\u26ad", raccourci:"Ctrl+G", onglet:"edition", groupe:"Groupes et blocs", ordre:2, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:9} },
  { id:"edition.dissocier", nomFr:"Dissocier", nomEn:"Dissociate", aliases:["DISSOCIER","DISSOC","UNGROUP","DEGROUPER"], icone:"\u26ae", raccourci:"Ctrl+Shift+G", onglet:"edition", groupe:"Groupes et blocs", ordre:3, portee:"selection", etat:"actif", source:{menu:"\u00c9dition",index:10} },
  { id:"edition.bloc", nomFr:"Bloc", nomEn:"Block", aliases:["BLOC","BLOCK","B"], icone:"\u25a3", onglet:"edition", groupe:"Groupes et blocs", ordre:4, portee:"selection", etat:"grise", jalon:"017Q1 - blocs paramétriques" },

  // ================= 3. DESSIN =================
  { id:"dessin.selection", nomFr:"Selection", nomEn:"Select", aliases:["SELECTION","SELECT"], icone:"\u2196", raccourci:"V", onglet:"dessin", groupe:"Outils de pointage", ordre:1, portee:"vue", etat:"actif", source:{menu:"Dessin",index:0} },
  { id:"dessin.main", nomFr:"Main / Pan", nomEn:"Pan", aliases:["MAIN","PAN","P"], icone:"\u270b", raccourci:"H", onglet:"dessin", groupe:"Outils de pointage", ordre:2, portee:"vue", etat:"actif", source:{menu:"Dessin",index:1} },
  { id:"dessin.noeud", nomFr:"Noeud", nomEn:"Node", aliases:["NOEUD","NODE","POINT"], icone:"\u25cf", raccourci:"N", onglet:"dessin", groupe:"Elements tuyauterie", ordre:1, portee:"projet", etat:"actif", source:{menu:"Dessin",index:2} },
  { id:"dessin.tube", nomFr:"Tube", nomEn:"Pipe", aliases:["TUBE","PIPE","TRONCON"], icone:"\u2571", raccourci:"T", onglet:"dessin", groupe:"Elements tuyauterie", ordre:2, portee:"projet", etat:"actif", source:{menu:"Dessin",index:3} },
  { id:"dessin.te", nomFr:"Te de derivation", nomEn:"Branch tee", aliases:["TE","TEE","PIQUAGE"], icone:"\u22a5", raccourci:"E", onglet:"dessin", groupe:"Elements tuyauterie", ordre:3, portee:"projet", etat:"actif", source:{menu:"Dessin",index:4} },
  { id:"dessin.coude", nomFr:"Coude 90", nomEn:"Elbow 90", aliases:["COUDE","ELBOW"], icone:"\u2229", raccourci:"C", onglet:"dessin", groupe:"Elements tuyauterie", ordre:4, portee:"projet", etat:"actif", source:{menu:"Dessin",index:5} },

  // ================= 4. ANNOTER =================
  { id:"annoter.coter", nomFr:"Coter", nomEn:"Dimension", aliases:["COTER","DIM","COTATION"], icone:"\u2194", raccourci:"M", onglet:"annoter", groupe:"Cotation", ordre:1, portee:"document", etat:"actif", source:{menu:"Cotation",index:0} },
  { id:"annoter.cotes.voir", nomFr:"Afficher cotations", nomEn:"Show dimensions", aliases:["COTES"], icone:"\u{1F441}", raccourci:"D", onglet:"annoter", groupe:"Cotation", ordre:2, portee:"vue", etat:"actif", source:{menu:"Cotation",index:1}, suivreLibelle:true },
  { id:"annoter.cote.suppr", nomFr:"Supprimer derniere cote", nomEn:"Delete last dimension", aliases:["SUPPRCOTE"], icone:"\u232b", onglet:"annoter", groupe:"Cotation", ordre:3, portee:"document", etat:"actif", source:{menu:"Cotation",index:2} },
  { id:"annoter.pipelines", nomFr:"Afficher pipelines", nomEn:"Show pipelines", aliases:["PIPELINES"], icone:"\u{1F3F7}", onglet:"annoter", groupe:"Etiquettes", ordre:1, portee:"vue", etat:"actif", source:{menu:"Affichage",index:4}, suivreLibelle:true },
  { id:"annoter.soudures", nomFr:"Afficher soudures", nomEn:"Show welds", aliases:["SOUDURES","WELDS"], icone:"\u2b24", onglet:"annoter", groupe:"Etiquettes", ordre:2, portee:"vue", etat:"actif", source:{menu:"Affichage",index:5}, suivreLibelle:true },
  { id:"annoter.texte", nomFr:"Texte", nomEn:"Text", aliases:["TEXTE","TEXT","DTEXT"], icone:"Aa", onglet:"annoter", groupe:"Textes et reperes", ordre:1, portee:"document", etat:"grise", jalon:"019B - annotation et habillage" },
  { id:"annoter.repere", nomFr:"Repere", nomEn:"Leader", aliases:["REPERE","LEADER"], icone:"\u2197", onglet:"annoter", groupe:"Textes et reperes", ordre:2, portee:"document", etat:"grise", jalon:"019B - annotation et habillage" },

  // ================= 5. PRECISION =================
  { id:"precision.aligner", nomFr:"Aligner", nomEn:"Align", aliases:["ALIGN","AL","ALIGNER","ALIGNEMENT"], icone:"📐", raccourci:"AL", onglet:"precision", groupe:"Alignement", ordre:1, portee:"selection", etat:"actif", source:{menu:"Alignement",index:0} },
  { id:"precision.parallele", nomFr:"Rendre parallele", nomEn:"Make parallel", aliases:["PARALLELE","PARALLEL","//"], icone:"∥", raccourci:"//", onglet:"precision", groupe:"Alignement", ordre:2, portee:"selection", etat:"actif", source:{menu:"Alignement",index:1} },
  { id:"precision.alignerx", nomFr:"Aligner X", nomEn:"Align X", aliases:["AX","ALIGNERX","ALIGNX"], icone:"X", raccourci:"AX", onglet:"precision", groupe:"Alignement", ordre:3, portee:"selection", etat:"actif", source:{menu:"Alignement",index:2} },
  { id:"precision.alignery", nomFr:"Aligner Y", nomEn:"Align Y", aliases:["AY","ALIGNERY","ALIGNY"], icone:"Y", raccourci:"AY", onglet:"precision", groupe:"Alignement", ordre:4, portee:"selection", etat:"actif", source:{menu:"Alignement",index:3} },
  { id:"precision.alignerz", nomFr:"Aligner Z", nomEn:"Align Z", aliases:["AZ","ALIGNERZ","ALIGNZ"], icone:"Z", raccourci:"AZ", onglet:"precision", groupe:"Alignement", ordre:5, portee:"selection", etat:"actif", source:{menu:"Alignement",index:4} },
  { id:"precision.eqsurtube", nomFr:"Equipement sur tube", nomEn:"Fitting on pipe", aliases:["AT","EQSURTUBE","ALIGNERTUBE"], icone:"⦸", raccourci:"AT", onglet:"precision", groupe:"Alignement", ordre:6, portee:"selection", etat:"actif", source:{menu:"Alignement",index:5} },
  { id:"precision.redresser", nomFr:"Redresser ISO", nomEn:"Straighten ISO", aliases:["REDRESSER","ISO","STRAIGHTEN"], icone:"⬡", raccourci:"ISO", onglet:"precision", groupe:"Alignement", ordre:7, portee:"selection", etat:"actif", source:{menu:"Alignement",index:6} },
  { id:"precision.controle", nomFr:"Controle reseau", nomEn:"Network check", aliases:["CONTROLE","AUDIT","VALIDATE"], icone:"✓", onglet:"precision", groupe:"Controle", ordre:8, portee:"projet", etat:"actif", source:{menu:"Outils",index:1} },

  // ================= 5B. VOLUME & ENVELOPPE EXTRUDÉE =================
  { id:"volume.panneau", nomFr:"Panneau Volume", nomEn:"Volume Panel", aliases:["VOLUME","ENVELOPPE","SKID","CADRAGE"], icone:"⚙️", onglet:"volume", groupe:"Configuration", ordre:1, portee:"vue", etat:"actif", commande:"VOLUME_PANEL" },
  { id:"volume.extruder", nomFr:"Extruder Volume", nomEn:"Extrude Volume", aliases:["EXTRUDER","EXTRUDE","EXT"], icone:"⧉", onglet:"volume", groupe:"Définition du Skid", ordre:2, portee:"projet", etat:"actif", commande:"VOLUME_EXTRUDE" },
  { id:"volume.toggle", nomFr:"Masquer/Afficher", nomEn:"Toggle Volume", aliases:["VTOGGLE","MASQUER_VOLUME","GABARIT"], icone:"👁️", onglet:"volume", groupe:"Visualisation", ordre:3, portee:"vue", etat:"actif", commande:"VOLUME_TOGGLE" },
  { id:"volume.check", nomFr:"Vérifier Confinement", nomEn:"Check Confinement", aliases:["VCHECK","CONFINEMENT"], icone:"🛡️", onglet:"volume", groupe:"Contrôle de Gabarit", ordre:4, portee:"projet", etat:"actif", commande:"VOLUME_CHECK" },

  // ================= 6. INSERTION =================
  { id:"insertion.bibliotheque", nomFr:"Bibliotheque", nomEn:"Library", aliases:["BIBLIO","LIBRARY"], icone:"\u29c9", onglet:"insertion", groupe:"Bibliotheque", ordre:1, portee:"vue", etat:"actif", source:{menu:"Insertion",index:0}, suivreLibelle:true },
  { id:"insertion.vanne", nomFr:"Vanne", nomEn:"Valve", aliases:["VANNE","VALVE"], icone:"\u25c6", onglet:"insertion", groupe:"Bibliotheque", ordre:2, portee:"projet", etat:"actif", source:{menu:"Insertion",index:1} },
  { id:"insertion.supportfixe", nomFr:"Support fixe", nomEn:"Fixed support", aliases:["SUPPORTFIXE","PSA"], icone:"\u22a5", onglet:"insertion", groupe:"Supports et massifs", ordre:1, portee:"projet", etat:"grise", jalon:"019S+ - supports et genie civil" },
  { id:"insertion.supportglissant", nomFr:"Support glissant", nomEn:"Sliding support", aliases:["SUPPORTGLISSANT"], icone:"\u2913", onglet:"insertion", groupe:"Supports et massifs", ordre:2, portee:"projet", etat:"grise", jalon:"019S+ - supports et genie civil" },
  { id:"insertion.supportguide", nomFr:"Support guide", nomEn:"Guide support", aliases:["SUPPORTGUIDE"], icone:"\u21d5", onglet:"insertion", groupe:"Supports et massifs", ordre:3, portee:"projet", etat:"grise", jalon:"019S+ - supports et genie civil" },
  { id:"insertion.massif", nomFr:"Massif beton", nomEn:"Concrete plinth", aliases:["MASSIF"], icone:"\u25ac", onglet:"insertion", groupe:"Supports et massifs", ordre:4, portee:"projet", etat:"grise", jalon:"019S+ - EN 1992-1-1, EN 206" },
  { id:"insertion.platine", nomFr:"Platine et ancrage", nomEn:"Base plate", aliases:["PLATINE","TIGEANCRAGE"], icone:"\u229e", onglet:"insertion", groupe:"Supports et massifs", ordre:5, portee:"projet", etat:"grise", jalon:"019S+ - EN 1992-4, ASTM F1554" },
  { id:"insertion.sketch", nomFr:"Import Sketch-to-ISO", nomEn:"Sketch-to-ISO import", aliases:["SKETCH"], icone:"\u270e", onglet:"insertion", groupe:"Import", ordre:1, portee:"projet", etat:"grise", jalon:"R23 - depot separe, interface JSON SchemaGraph" },

  // ================= 7. 3D =================
  { id:"trois_d.vue", nomFr:"Vue 3D", nomEn:"3D view", aliases:["VUE3D","3D"], icone:"\u25f0", onglet:"trois_d", groupe:"Navigation", ordre:1, portee:"vue", etat:"grise", jalon:"019C - passage volumique" },
  { id:"trois_d.profile", nomFr:"Profile metallique", nomEn:"Steel member", aliases:["PROFIL","STEELMEMBER","PLANTSTEELMEMBER"], icone:"\u2b12", onglet:"trois_d", groupe:"Structure et genie civil", ordre:1, portee:"projet", etat:"grise", jalon:"019S+ - Eurocode 3, AISC 360" },
  { id:"trois_d.dalle", nomFr:"Dalle et fondation", nomEn:"Slab and footing", aliases:["DALLE","FOOTING"], icone:"\u25a4", onglet:"trois_d", groupe:"Structure et genie civil", ordre:2, portee:"projet", etat:"grise", jalon:"019S+ - EN 1992-1-1, ACI 318" },
  { id:"trois_d.gardecorps", nomFr:"Garde-corps et escalier", nomEn:"Handrail and stair", aliases:["GARDECORPS","ESCALIER","PLANTSTEELHANDRAIL"], icone:"\u2591", onglet:"trois_d", groupe:"Structure et genie civil", ordre:3, portee:"projet", etat:"grise", jalon:"019S+ - ASCE 7, RPA 99 v2003" },
  { id:"trois_d.rendu", nomFr:"Rendu", nomEn:"Render", aliases:["RENDU","RENDER"], icone:"\u25d1", onglet:"trois_d", groupe:"Rendu", ordre:1, portee:"document", etat:"grise", jalon:"018G - rendu et presentation" },

  // ================= 8. DONNEES =================
  { id:"donnees.bom", nomFr:"BOM / Nomenclature", nomEn:"BOM", aliases:["BOM","NOMENCLATURE"], icone:"\u{1F4CB}", raccourci:"BOM", onglet:"donnees", groupe:"Nomenclature", ordre:1, portee:"projet", etat:"actif", source:{menu:"Outils",index:0} },
  { id:"donnees.linelist", nomFr:"Line List", nomEn:"Line list", aliases:["LINELIST","LIGNES"], icone:"\u2263", onglet:"donnees", groupe:"Lignes", ordre:1, portee:"projet", etat:"grise", jalon:"018 - Line List et regles metier" },
  { id:"donnees.catalogue", nomFr:"Catalogue", nomEn:"Catalog", aliases:["CATALOGUE","SPEC"], icone:"\u2637", onglet:"donnees", groupe:"Lignes", ordre:2, portee:"projet", etat:"grise", jalon:"018 - catalogue et specs" },
  { id:"donnees.metre", nomFr:"Metre", nomEn:"Take-off", aliases:["METRE","TAKEOFF"], icone:"\u{1F4CF}", onglet:"donnees", groupe:"Quantitatifs", ordre:1, portee:"projet", etat:"grise", jalon:"020 - metre et quantitatifs" },
  { id:"donnees.bomgc", nomFr:"BOM genie civil", nomEn:"Civil BOM", aliases:["BOMGC"], icone:"\u25a5", onglet:"donnees", groupe:"Quantitatifs", ordre:2, portee:"projet", etat:"grise", jalon:"019S+ - quantitatifs genie civil" },

  // ================= 9. AFFICHAGE =================
  { id:"affichage.espacetravail", nomFr:"Espace de travail / Multi-ecran", nomEn:"Workspace / Multi-screen", aliases:["ESPACETRAVAIL","WORKSPACE","MULTISCREEN","DOUBLEECRAN","ECRAN2","MONITEUR","DUALSCREEN","DISPLAYS"], icone:"\u229e", raccourci:"Alt+W", onglet:"affichage", groupe:"Espace de travail", ordre:0, portee:"session", etat:"actif", commande:"WORKSPACE" },
  { id:"affichage.zoomplus", nomFr:"Zoom +", nomEn:"Zoom in", aliases:["ZOOM+"], icone:"\u2295", raccourci:"+", onglet:"affichage", groupe:"Zoom", ordre:1, portee:"vue", etat:"actif", source:{menu:"Affichage",index:0} },
  { id:"affichage.zoommoins", nomFr:"Zoom -", nomEn:"Zoom out", aliases:["ZOOM-"], icone:"\u2296", raccourci:"-", onglet:"affichage", groupe:"Zoom", ordre:2, portee:"vue", etat:"actif", source:{menu:"Affichage",index:1} },
  { id:"affichage.ajuster", nomFr:"Ajuster", nomEn:"Zoom fit", aliases:["AJUSTER","FIT","ZOOM","REGEN","ZOOM_ALL"], icone:"\u26f6", raccourci:"0", onglet:"affichage", groupe:"Zoom", ordre:3, portee:"vue", etat:"actif", source:{menu:"Affichage",index:2} },
  { id:"affichage.grille", nomFr:"Afficher grille", nomEn:"Show grid", aliases:["GRILLE","GRID"], icone:"\u25a6", raccourci:"G", onglet:"affichage", groupe:"Reperes", ordre:1, portee:"vue", etat:"actif", source:{menu:"Affichage",index:3}, suivreLibelle:true },
  { id:"affichage.palette", nomFr:"Palette commandes", nomEn:"Command palette", aliases:["PALETTE"], icone:"\u2318", raccourci:"Ctrl+K", onglet:"affichage", groupe:"Outils", ordre:1, portee:"session", etat:"actif", source:{menu:"Outils",index:2} },
  { id:"affichage.raccourcis", nomFr:"Raccourcis clavier", nomEn:"Keyboard shortcuts", aliases:["RACCOURCIS"], icone:"?", raccourci:"?", onglet:"affichage", groupe:"Outils", ordre:2, portee:"session", etat:"actif", source:{menu:"Outils",index:3} },

  // ==================================================
  // PATCH 017M2 : les commandes des deux tables du moteur.
  // etat "actif" = verifie comme agissant dans
  // executeCadCommand. etat "grise" = declaree mais le code
  // ne fait qu annoncer la commande : pas de bouton actif.
  // ==================================================
  // ---- onglet fichier ----
  { id:"fichier.reglages", nomFr:"Reglages du projet", nomEn:"Project setup", aliases:["PROJECTSETUP","PS","SETUP","PROJET"], icone:"\u2692", onglet:"fichier", groupe:"Projet", ordre:51, portee:"projet", etat:"actif", commande:"PROJECTSETUP" },
  { id:"fichier.restaurer", nomFr:"Restaurer une sauvegarde", nomEn:"Restore", aliases:["RESTAURER","RESTORE"], icone:"\u21ba", onglet:"fichier", groupe:"Enregistrement", ordre:51, portee:"projet", etat:"actif", commande:"RESTAURER" },
  { id:"fichier.gestionprojets", nomFr:"Gestion des projets", nomEn:"Project manager", aliases:["PROJECTMANAGER"], icone:"\u2263", onglet:"fichier", groupe:"Projet", ordre:52, portee:"session", etat:"actif", commande:"PROJECTMANAGER" },
  { id:"fichier.compacter", nomFr:"Compacter le projet", nomEn:"Compress project", aliases:["COMPRESSPROJECT"], icone:"\u2b0c", onglet:"fichier", groupe:"Projet", ordre:53, portee:"projet", etat:"grise", jalon:"018" },
  // ---- onglet edition ----
  { id:"edition.deplacer", nomFr:"Deplacer", nomEn:"Move", aliases:["DEPLACER","MOVE","M","TRANSLATION","DEPLACE"], icone:"\u2725", onglet:"edition", groupe:"Transformer", ordre:51, portee:"selection", etat:"actif", commande:"DEPLACER" },
  { id:"edition.rotation", nomFr:"Rotation", nomEn:"Rotate", aliases:["ROTATION","ROTATE","RO","TOURNER"], icone:"\u21bb", onglet:"edition", groupe:"Transformer", ordre:52, portee:"selection", etat:"actif", commande:"ROTATION" },
  { id:"edition.miroir", nomFr:"Miroir", nomEn:"Mirror", aliases:["MIROIR","MIRROR","MI"], icone:"\u21c4", onglet:"edition", groupe:"Transformer", ordre:53, portee:"selection", etat:"actif", commande:"MIROIR" },
  { id:"edition.effacer", nomFr:"Effacer", nomEn:"Erase", aliases:["EFFACER","ERASE","E"], icone:"\u2327", onglet:"edition", groupe:"Transformer", ordre:54, portee:"selection", etat:"actif", commande:"EFFACER" },
  { id:"edition.echelle", nomFr:"Echelle", nomEn:"Scale", aliases:["SCALE","ECHELLE","SC"], icone:"\u2921", onglet:"edition", groupe:"Modifier la geometrie", ordre:51, portee:"selection", etat:"actif", commande:"ECHELLE" },
  { id:"edition.ajuster2d", nomFr:"Ajuster", nomEn:"Trim", aliases:["TRIM","AJUSTER","TR","COUPER"], icone:"\u2702", onglet:"edition", groupe:"Modifier la geometrie", ordre:52, portee:"selection", etat:"actif", commande:"AJUSTER" },
  { id:"edition.prolonger", nomFr:"Prolonger", nomEn:"Extend", aliases:["EXTEND","PROLONGER","EX"], icone:"\u27f6", onglet:"edition", groupe:"Modifier la geometrie", ordre:53, portee:"selection", etat:"actif", commande:"PROLONGER" },
  { id:"edition.raccord", nomFr:"Raccord", nomEn:"Fillet", aliases:["FILLET","RACCORD","F","CONGE"], icone:"\u25e0", onglet:"edition", groupe:"Modifier la geometrie", ordre:54, portee:"selection", etat:"actif", commande:"RACCORD" },
  { id:"edition.chanfrein", nomFr:"Chanfrein", nomEn:"Chamfer", aliases:["CHAMFER","CHANFREIN","CHA"], icone:"\u25e2", onglet:"edition", groupe:"Modifier la geometrie", ordre:55, portee:"selection", etat:"actif", commande:"CHANFREIN" },
  { id:"edition.decaler", nomFr:"Decaler", nomEn:"Offset", aliases:["OFFSET","DECALER","O"], icone:"\u2016", onglet:"edition", groupe:"Modifier la geometrie", ordre:56, portee:"selection", etat:"actif", commande:"DECALER" },
  { id:"edition.etirer", nomFr:"Etirer", nomEn:"Stretch", aliases:["STRETCH","ETIRER"], icone:"\u2194", onglet:"edition", groupe:"Modifier la geometrie", ordre:57, portee:"selection", etat:"grise", jalon:"019B" },
  { id:"edition.reseau", nomFr:"Reseau", nomEn:"Array", aliases:["ARRAY","RESEAU"], icone:"\u2237", onglet:"edition", groupe:"Modifier la geometrie", ordre:58, portee:"selection", etat:"grise", jalon:"019B" },
  { id:"edition.decomposer", nomFr:"Decomposer", nomEn:"Explode", aliases:["EXPLODE","DECOMPOSER"], icone:"\u2604", onglet:"edition", groupe:"Modifier la geometrie", ordre:59, portee:"selection", etat:"grise", jalon:"019B" },
  // ---- onglet dessin ----
  { id:"dessin.ligne", nomFr:"Ligne", nomEn:"Line", aliases:["LIGNE","LINE","L"], icone:"\u2571", onglet:"dessin", groupe:"Dessin 2D", ordre:51, portee:"document", etat:"actif", commande:"LIGNE" },
  { id:"dessin.polyligne", nomFr:"Polyligne", nomEn:"Polyline", aliases:["POLYLIGNE","POLYLINE"], icone:"\u2934", onglet:"dessin", groupe:"Dessin 2D", ordre:52, portee:"document", etat:"actif", commande:"POLYLIGNE" },
  { id:"dessin.rectangle", nomFr:"Rectangle", nomEn:"Rectangle", aliases:["RECTANGLE","RECT"], icone:"\u25ad", onglet:"dessin", groupe:"Dessin 2D", ordre:53, portee:"document", etat:"actif", commande:"RECTANGLE" },
  { id:"dessin.triangle", nomFr:"Triangle", nomEn:"Triangle", aliases:["TRIANGLE"], icone:"\u25b3", onglet:"dessin", groupe:"Dessin 2D", ordre:54, portee:"document", etat:"actif", commande:"TRIANGLE" },
  { id:"dessin.polygone", nomFr:"Polygone", nomEn:"Polygon", aliases:["POLYGONE","POLYGON"], icone:"\u2b20", onglet:"dessin", groupe:"Dessin 2D", ordre:55, portee:"document", etat:"actif", commande:"POLYGONE" },
  { id:"dessin.cercle", nomFr:"Cercle", nomEn:"Circle", aliases:["CERCLE","CIRCLE","C"], icone:"\u25cb", onglet:"dessin", groupe:"Dessin 2D", ordre:56, portee:"document", etat:"actif", commande:"CERCLE" },
  { id:"dessin.arc", nomFr:"Arc", nomEn:"Arc", aliases:["ARC"], icone:"\u25e1", onglet:"dessin", groupe:"Dessin 2D", ordre:57, portee:"document", etat:"actif", commande:"ARC" },
  { id:"dessin.texte", nomFr:"Texte / MTEXT", nomEn:"Text", aliases:["TEXT","TEXTE","MTEXT","DT"], icone:"T", onglet:"dessin", groupe:"Dessin 2D", ordre:58, portee:"document", etat:"actif", commande:"TEXTE" },
  { id:"dessin.hachure", nomFr:"Hachure", nomEn:"Hatch", aliases:["HATCH","HACHURE","H"], icone:"\u25a6", onglet:"dessin", groupe:"Dessin 2D", ordre:59, portee:"selection", etat:"actif", commande:"HACHURE" },
  // ---- onglet precision ----
  { id:"precision.specviewer", nomFr:"Visionneuse de spec", nomEn:"Spec viewer", aliases:["PLANTSPECVIEWER"], icone:"\u2637", onglet:"precision", groupe:"Verification", ordre:51, portee:"projet", etat:"actif", commande:"PLANTSPECVIEWER" },
  { id:"precision.plantvalidate", nomFr:"Valider la tuyauterie", nomEn:"Validate piping", aliases:["PLANTVALIDATE"], icone:"\u2714", onglet:"precision", groupe:"Verification", ordre:52, portee:"projet", etat:"grise", jalon:"018" },
  { id:"precision.plantaudit", nomFr:"Audit tuyauterie", nomEn:"Piping audit", aliases:["PLANTAUDIT"], icone:"\u2691", onglet:"precision", groupe:"Verification", ordre:53, portee:"projet", etat:"grise", jalon:"018" },
  { id:"precision.auditproject", nomFr:"Audit du projet", nomEn:"Project audit", aliases:["AUDITPROJECT"], icone:"\u2690", onglet:"precision", groupe:"Verification", ordre:54, portee:"projet", etat:"grise", jalon:"018" },
  { id:"precision.specupdatecheck", nomFr:"Controle de mise a jour spec", nomEn:"Spec update check", aliases:["PLANTSPECUPDATECHECK"], icone:"\u2691", onglet:"precision", groupe:"Verification", ordre:55, portee:"projet", etat:"grise", jalon:"018" },
  // ---- onglet trois_d ----
  { id:"trois_d.orbite", nomFr:"Orbite 3D", nomEn:"3D orbit", aliases:["3DORBIT","ORBITE"], icone:"\u25d4", onglet:"trois_d", groupe:"Navigation", ordre:51, portee:"vue", etat:"grise", jalon:"019C" },
  { id:"trois_d.pointvue", nomFr:"Point de vue", nomEn:"View point", aliases:["VPOINT"], icone:"\u25d5", onglet:"trois_d", groupe:"Navigation", ordre:52, portee:"vue", etat:"grise", jalon:"019C" },
  { id:"trois_d.pipeadd", nomFr:"Ajouter tube 3D", nomEn:"Add pipe", aliases:["PLANTPIPEADD"], icone:"\u2b1a", onglet:"trois_d", groupe:"Tuyauterie 3D", ordre:51, portee:"document", etat:"grise", jalon:"019C" },
  { id:"trois_d.nozzle", nomFr:"Ajouter piquage", nomEn:"Add nozzle", aliases:["PLANTNOZZLEADD"], icone:"\u22c8", onglet:"trois_d", groupe:"Tuyauterie 3D", ordre:52, portee:"document", etat:"grise", jalon:"019C" },
  { id:"trois_d.equipcreate", nomFr:"Creer equipement", nomEn:"Create equipment", aliases:["PLANTEQUIPMENTCREATE"], icone:"\u2b1c", onglet:"trois_d", groupe:"Equipements", ordre:51, portee:"document", etat:"grise", jalon:"019C" },
  { id:"trois_d.equipconvert", nomFr:"Convertir en equipement", nomEn:"Convert equipment", aliases:["PLANTEQUIPMENTCONVERT"], icone:"\u2b1b", onglet:"trois_d", groupe:"Equipements", ordre:52, portee:"selection", etat:"grise", jalon:"019C" },
  { id:"trois_d.convertline", nomFr:"Convertir en ligne", nomEn:"Convert line", aliases:["PLANTCONVERTLINE"], icone:"\u2500", onglet:"trois_d", groupe:"Tuyauterie 3D", ordre:53, portee:"selection", etat:"grise", jalon:"019C" },
  { id:"trois_d.fittingmove", nomFr:"Deplacer un raccord", nomEn:"Move fitting", aliases:["PLANTFITTINGMOVE"], icone:"\u2b83", onglet:"trois_d", groupe:"Tuyauterie 3D", ordre:54, portee:"selection", etat:"grise", jalon:"019C" },
  { id:"trois_d.flipfitting", nomFr:"Retourner un raccord", nomEn:"Flip fitting", aliases:["PLANTFLIPFITTING"], icone:"\u2b82", onglet:"trois_d", groupe:"Tuyauterie 3D", ordre:55, portee:"selection", etat:"grise", jalon:"019C" },
  { id:"trois_d.connect", nomFr:"Connecter", nomEn:"Connect", aliases:["PLANTCONNECT"], icone:"\u22c4", onglet:"trois_d", groupe:"Tuyauterie 3D", ordre:56, portee:"selection", etat:"grise", jalon:"019C" },
  { id:"trois_d.platine_acier", nomFr:"Platine acier", nomEn:"Steel plate", aliases:["PLANTSTEELPLATE"], icone:"\u25ac", onglet:"trois_d", groupe:"Structure et genie civil", ordre:51, portee:"document", etat:"grise", jalon:"019S+" },
  { id:"trois_d.semelle", nomFr:"Semelle", nomEn:"Footing", aliases:["PLANTSTEELFOOTING"], icone:"\u2b1f", onglet:"trois_d", groupe:"Structure et genie civil", ordre:52, portee:"document", etat:"grise", jalon:"019S+" },
  { id:"trois_d.escalier", nomFr:"Escalier", nomEn:"Stair", aliases:["PLANTSTEELSTAIR"], icone:"\u2b67", onglet:"trois_d", groupe:"Structure et genie civil", ordre:53, portee:"document", etat:"grise", jalon:"019S+" },
  { id:"trois_d.rack", nomFr:"Rack a tuyaux", nomEn:"Pipe rack", aliases:["PLANTSTEELRACK"], icone:"\u2263", onglet:"trois_d", groupe:"Structure et genie civil", ordre:54, portee:"document", etat:"grise", jalon:"019S+" },
  { id:"trois_d.rail", nomFr:"Rail", nomEn:"Rail", aliases:["PLANTSTEELRAIL"], icone:"\u2550", onglet:"trois_d", groupe:"Structure et genie civil", ordre:55, portee:"document", etat:"grise", jalon:"019S+" },
  { id:"trois_d.support_ajout", nomFr:"Ajouter un support", nomEn:"Add support", aliases:["PLANTSUPPORTADD"], icone:"\u2534", onglet:"trois_d", groupe:"Supports", ordre:51, portee:"document", etat:"grise", jalon:"019S+" },
  { id:"trois_d.support_convert", nomFr:"Convertir en support", nomEn:"Convert support", aliases:["PLANTSUPPORTCONVERT"], icone:"\u252c", onglet:"trois_d", groupe:"Supports", ordre:52, portee:"selection", etat:"grise", jalon:"019S+" },
  // ---- onglet donnees ----
  { id:"donnees.tag", nomFr:"Tag du troncon", nomEn:"Segment tag", aliases:["TAG"], icone:"\u25a3", onglet:"donnees", groupe:"Tags", ordre:51, portee:"selection", etat:"actif", commande:"TAG" },
  { id:"donnees.tagformat", nomFr:"Format de tag", nomEn:"Tag format", aliases:["TAGFORMAT","TF"], icone:"\u2263", onglet:"donnees", groupe:"Tags", ordre:52, portee:"projet", etat:"actif", commande:"TAGFORMAT" },
  { id:"donnees.tagdisplay", nomFr:"Afficher les tags", nomEn:"Show tags", aliases:["TAGDISPLAY","TD","AFFICHETAG","TAGON"], icone:"\u25a4", onglet:"donnees", groupe:"Tags", ordre:53, portee:"vue", etat:"actif", commande:"TAGDISPLAY" },
  { id:"donnees.autotag", nomFr:"Tag automatique", nomEn:"Auto tag", aliases:["AUTOTAG"], icone:"\u2699", onglet:"donnees", groupe:"Tags", ordre:54, portee:"projet", etat:"actif", commande:"AUTOTAG" },
  { id:"donnees.renumber", nomFr:"Renumeroter", nomEn:"Renumber", aliases:["RENUMBER","RN","RENUMEROTER"], icone:"\u2116", onglet:"donnees", groupe:"Tags", ordre:55, portee:"projet", etat:"actif", commande:"RENUMBER" },
  { id:"donnees.service", nomFr:"Service / fluide", nomEn:"Service", aliases:["SERVICE","FLUIDE"], icone:"\u2708", onglet:"donnees", groupe:"Tags", ordre:56, portee:"selection", etat:"actif", commande:"SERVICE" },
  { id:"donnees.datamanager", nomFr:"Gestionnaire de donnees", nomEn:"Data manager", aliases:["DATAMANAGER","DM","TABLEAU"], icone:"\u2338", onglet:"donnees", groupe:"Tables", ordre:51, portee:"projet", etat:"actif", commande:"DATAMANAGER" },
  { id:"donnees.proprietes", nomFr:"Inspecteur de proprietes", nomEn:"Properties", aliases:["PROPRIETES","PROPS","PR","PROPERTIES"], icone:"\u2261", onglet:"donnees", groupe:"Tables", ordre:52, portee:"selection", etat:"actif", commande:"PROPRIETES" },
  { id:"donnees.orthocreate", nomFr:"Creer vue ortho", nomEn:"Create ortho", aliases:["PLANTORTHOCREATE"], icone:"\u25f0", onglet:"donnees", groupe:"Production", ordre:51, portee:"document", etat:"grise", jalon:"020F" },
  { id:"donnees.orthoupdate", nomFr:"Mettre a jour ortho", nomEn:"Update ortho", aliases:["PLANTORTHOUPDATE"], icone:"\u25f1", onglet:"donnees", groupe:"Production", ordre:52, portee:"document", etat:"grise", jalon:"020F" },
  { id:"donnees.isoproduction", nomFr:"Production iso", nomEn:"Iso production", aliases:["PLANTISOPRODUCTION"], icone:"\u25f2", onglet:"donnees", groupe:"Production", ordre:53, portee:"document", etat:"grise", jalon:"020F" },
  // ---- onglet affichage ----
  { id:"affichage.espacetravail", nomFr:"Espace de travail / Multi-écran", nomEn:"Workspace / Multi-screen", aliases:["WORKSPACE","WORK","WOR","WS","WSPACE","ESPACETRAVAIL","ESPACE","MULTISCREEN","MULTI_ECRAN","MULTIECRAN","DOUBLEECRAN","DOUBLE_ECRAN","ECRAN2","DUALSCREEN","MONITEUR","MONITEURS","DISPLAYS"], icone:"\u229e", onglet:"affichage", groupe:"Outils", ordre:49, portee:"session", etat:"actif", commande:"WORKSPACE" },
  { id:"affichage.casttv", nomFr:"Caster / Projeter sur Smart TV", nomEn:"Cast / Project to Smart TV", aliases:["CAST","CASTTV","TV","SMARTTV","PROJETER","CHROMECAST","AIRPLAY","PROJECTION"], icone:"\u25a3", onglet:"affichage", groupe:"Outils", ordre:50, portee:"session", etat:"actif", commande:"CASTTV" },
  { id:"affichage.epaisseur", nomFr:"Epaisseur de trait", nomEn:"Line weight", aliases:["EPAISSEUR","LW","LINEWEIGHT"], icone:"\u2501", onglet:"affichage", groupe:"Apparence", ordre:51, portee:"vue", etat:"actif", commande:"EPAISSEUR" },
  { id:"affichage.couleur", nomFr:"Couleur", nomEn:"Color", aliases:["COULEUR","COLOR"], icone:"\u25c9", onglet:"affichage", groupe:"Apparence", ordre:52, portee:"vue", etat:"actif", commande:"COULEUR" },
  { id:"affichage.couleurservice", nomFr:"Couleur par service", nomEn:"Color by service", aliases:["COULEURSERVICE","COLORBYSERVICE","CBS"], icone:"\u25d1", onglet:"affichage", groupe:"Apparence", ordre:53, portee:"vue", etat:"actif", commande:"COULEURSERVICE" },
  { id:"affichage.style", nomFr:"Style actif", nomEn:"Active style", aliases:["STYLE"], icone:"\u2712", onglet:"affichage", groupe:"Apparence", ordre:54, portee:"vue", etat:"actif", commande:"STYLE" },
  { id:"affichage.perf", nomFr:"Performance", nomEn:"Performance", aliases:["PERF"], icone:"\u23f1", onglet:"affichage", groupe:"Outils", ordre:51, portee:"session", etat:"actif", commande:"PERF" },
  { id:"affichage.masquer", nomFr:"Masquer", nomEn:"Hide", aliases:["HIDE","MASQUER"], icone:"\u25cc", onglet:"affichage", groupe:"Apparence", ordre:55, portee:"vue", etat:"grise", jalon:"019C" },
];

/** Groupes d un onglet, dans l ordre de premiere apparition. */
export function pdiGroupesOnglet017M(onglet: string): string[] {
  const vus: string[] = [];
  PDI_REGISTRE_RUBAN_017M.forEach((e) => {
    if (e.onglet === onglet && vus.indexOf(e.groupe) === -1) vus.push(e.groupe);
  });
  return vus;
}

/** Entrees d un groupe, triees par ordre. */
export function pdiEntreesGroupe017M(
  onglet: string,
  groupe: string,
): PdiEntreeRuban017M[] {
  return PDI_REGISTRE_RUBAN_017M.filter(
    (e) => e.onglet === onglet && e.groupe === groupe,
  ).sort((a, b) => a.ordre - b.ordre);
}

/** Recherche par nom ou alias, insensible a la casse et bilingue. */
export function pdiChercherCommande017M(saisie: string): PdiEntreeRuban017M[] {
  const q = String(saisie || "").trim().toUpperCase();
  if (!q) return [];
  return PDI_REGISTRE_RUBAN_017M.filter((e) => {
    if (e.nomFr.toUpperCase().indexOf(q) === 0) return true;
    if (e.nomEn.toUpperCase().indexOf(q) === 0) return true;
    return e.aliases.some((a) => a.toUpperCase() === q);
  });
}
