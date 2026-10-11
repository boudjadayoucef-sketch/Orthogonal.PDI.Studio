import { PlanDeControleItem, Project } from './types';

export const DEFAULT_TRAVAUX_LIGNE = [
  { phase: "Piste", ponderation: 5, anterieur: 0, quotidien: 0 },
  { phase: "Bardage", ponderation: 5, anterieur: 0, quotidien: 0 },
  { phase: "Tranchée", ponderation: 15, anterieur: 0, quotidien: 0 },
  { phase: "Soudage", ponderation: 20, anterieur: 0, quotidien: 0 },
  { phase: "Radiographie", ponderation: 10, anterieur: 0, quotidien: 0 },
  { phase: "Enrobage", ponderation: 10, anterieur: 0, quotidien: 0 },
  { phase: "Mise en fouille", ponderation: 25, anterieur: 0, quotidien: 0 },
  { phase: "Essais", ponderation: 10, anterieur: 0, quotidien: 0 }
];

export const DEFAULT_TRAVAUX_POSTES = [
  { phase: "Préfabrication", ponderation: 35, quotidien: 0, global: 0 },
  { phase: "Montage, soudure, essais et finition", ponderation: 30, quotidien: 0, global: 0 },
  { phase: "Génie civil", ponderation: 10, quotidien: 0, global: 0 },
  { phase: "Clôture barreaudée", ponderation: 23, quotidien: 0, global: 0 },
  { phase: "Chemin d'exploitation", ponderation: 2, quotidien: 0, global: 0 }
];


export const STATIC_PLAN_DE_CONTROLE_TASKS: PlanDeControleItem[] = [
  {
    ord: "01",
    tache: "Mobilisation du chantier",
    mode: "Visuel",
    ref: "Contrat d'exécution",
    etalonnage: "/",
    critere: "Installation conforme par rapport aux exigences du contrat de travaux"
  },
  {
    ord: "02",
    tache: "Réception des tubes en acier sur site",
    mode: "Visuel + mesure physique",
    ref: "Plans BPE + Contrat + Bordereau d'expédition",
    etalonnage: "Mètre à ruban, Pied à coulisse",
    critere: "Diamètre, Épaisseur, n° de Coulée, longueur et état d'enrobage physique conformes aux bordereaux"
  },
  {
    ord: "03",
    tache: "Réception des postes de coupure / détente + rechanges",
    mode: "Visuel + examen dimensionnel",
    ref: "Plans BPE + Contrat + PV de transfert matériel",
    etalonnage: "/",
    critere: "État de conservation physique conforme aux documents et PV de remise de matériel"
  },
  {
    ord: "04",
    tache: "Mise à disposition des ressources humaines qualifiées",
    mode: "Examen documentaire",
    ref: "Contrat + SP TEC + Certificats d'aptitude",
    etalonnage: "/",
    critere: "Qualifications et habilitations en cours de validité selon l'activité de pose"
  },
  {
    ord: "05",
    tache: "Réception des accessoires des postes sur site",
    mode: "Visuel et inventaire",
    ref: "Plans BPE + Contrat + PV de remise matériel",
    etalonnage: "/",
    critere: "État physique et colisage conformes aux listes de pièces jointes"
  },
  {
    ord: "06",
    tache: "Vérification de l'étalonnage des appareils de mesure",
    mode: "Examen des certificats",
    ref: "Liste des appareils de mesure à utiliser",
    etalonnage: "Justificatifs de calibrage COFRAC / ONML",
    critere: "Certificats d'étalonnage valides pour les manomètres, enregistreurs, balais électriques, etc."
  },
  {
    ord: "07",
    tache: "Réception géométrique du tracé",
    mode: "Levé topographique & Visuel",
    ref: "Contrat + Plans BPE approuvés",
    etalonnage: "/",
    critere: "Piquets de tracé conformes aux plans d'exécution et au profil en long validé"
  },
  {
    ord: "08",
    tache: "Ouverture de la piste",
    mode: "Visuel + mesure de largeur",
    ref: "Contrat + Plans BPE",
    etalonnage: "Mètre de chantier",
    critere: "Largeur de piste nettoyée conforme au diamètre nominal, praticabilité assurée"
  },
  {
    ord: "09",
    tache: "Bardage et pré-alignement des tubes acier",
    mode: "Visuel de sécurité",
    ref: "Contrat + Spécification Technique (SP TEC)",
    etalonnage: "/",
    critere: "Tubes alignés de manière stable, reposant sur cales en bois ou sacs de terre meuble"
  },
  {
    ord: "10",
    tache: "Mise à disposition du dossier technique de soudage",
    mode: "Vérification documentaire",
    ref: "Procédures qualifiées (PQR + WPS) selon SP TEC",
    etalonnage: "/",
    critere: "Dossier de soudage dûment approuvé et contresigné avant début de fabrication"
  },
  {
    ord: "11",
    tache: "Mise à disposition et qualification des soudeurs",
    mode: "Contrôle d'habilitation",
    ref: "Contrat + Procédure WPS + Licences de soudure",
    etalonnage: "/",
    critere: "Soudeurs qualifiés et homologués sur éprouvettes réelles selon le type de raccordement"
  },
  {
    ord: "12",
    tache: "Mise à disposition des outillages matériels de soudage",
    mode: "Visuel et contrôle technique",
    ref: "SP TEC + Dossier de soudage",
    etalonnage: "/",
    critere: "Générateurs, pinces de centrage et étuves à électrodes conformes et fonctionnels"
  },
  {
    ord: "13",
    tache: "Soudage de la canalisation",
    mode: "Visuel + mesure des paramètres",
    ref: "SP TEC + Fiche de spécification de soudage (WPS)",
    etalonnage: "Pince ampèremétrique, Pyromètre de contact",
    critere: "Paramètres de passe de pénétration et remplissage respectés. Prêt pour contrôle non destructif"
  },
  {
    ord: "14",
    tache: "Creusement de la tranchée",
    mode: "Visuel + mesure de section",
    ref: "Contrat + SP TEC + Plans d'exécution",
    etalonnage: "Mètre de chantier, Jauge",
    critere: "Profondeur de couverture réglementaire et largeur de fouille conformes au cahier des charges"
  },
  {
    ord: "15",
    tache: "Sablage des joints soudés",
    mode: "Visuel avant revêtement",
    ref: "Contrat + SP TEC de sablage",
    etalonnage: "/",
    critere: "Rugosité et propreté de surface métallique conformes au standard Sa 2 1/2"
  },
  {
    ord: "16",
    tache: "Revêtement isolant des joints soudés & raccords",
    mode: "Visuel + mesure d'épaisseur & continuité",
    ref: "Contrat + SP TEC + Procédure revêtement",
    etalonnage: "Jauge d'épaisseur, Détecteur de porosité (balai électrique)",
    critere: "Adhérence parfaite, aucune porosité détectée sous la tension d'épreuve réglementaire"
  },
  {
    ord: "17",
    tache: "Mise en place du lit de pose en sable",
    mode: "Visuel + mesure d'épaisseur",
    ref: "Contrat + SP TEC de pose",
    etalonnage: "Mètre",
    critere: "Épaisseur de sable doux de lit de pose ≥ 10 cm, fond de fouille exempt de pierres blessantes"
  },
  {
    ord: "18",
    tache: "Mise en place du pré-remblai de protection",
    mode: "Visuel de conformité",
    ref: "Contrat + SP TEC",
    etalonnage: "/",
    critere: "Recouvrement initial de la canalisation en sable doux sur au moins 20 cm au-dessus de la génératrice supérieure"
  },
  {
    ord: "19",
    tache: "Pose de câble à fibre optique sous gaine & chambres",
    mode: "Visuel + mesure de distance",
    ref: "Contrat + Procédure pose câble FO approuvée",
    etalonnage: "/",
    critere: "Alignement parallèle de la gaine, profondeur, pose de grillage avertisseur vert et chambres de tirage"
  },
  {
    ord: "20",
    tache: "Remblai définitif de la tranchée",
    mode: "Visuel et contrôle de compactage",
    ref: "Contrat + SP TEC de terrassement",
    etalonnage: "/",
    critere: "Compactage par couches successives, aucun élément rocheux de taille excessive admis"
  },
  {
    ord: "21",
    tache: "Mise en fouille des tronçons assemblés & raccordement",
    mode: "Visuel + détection électrique de défaut",
    ref: "Contrat + SP TEC de pose",
    etalonnage: "Balai électrique haute tension",
    critere: "Absence de défaut d'isolement lors de la descente en fouille. Alignement des tubes sans contraintes"
  },
  {
    ord: "22",
    tache: "Réalisation des points spéciaux (Traversées de routes / oueds)",
    mode: "Visuel + mesure topographique",
    ref: "Contrat + Plans BPE de détails",
    etalonnage: "/",
    critere: "Pose de gaines de protection en béton ou acier, lestages et signalisation spécifiques conformes"
  },
  {
    ord: "23",
    tache: "Réalisation des points particuliers (Coudes, piquages)",
    mode: "Visuel + mesure d'angles",
    ref: "Contrat + SP TEC + Plans de montage",
    etalonnage: "Rapporteur d'angle, Niveau",
    critere: "Rayon de courbure des coudes cintrés à froid ou préfabriqués conforme aux tolérances"
  },
  {
    ord: "24",
    tache: "Ferraillage des ouvrages de génie civil",
    mode: "Visuel + mesure d'espacement",
    ref: "Plans de ferraillage BPE approuvés",
    etalonnage: "Mètre",
    critere: "Diamètre des aciers, espacement des cadres et recouvrements conformes aux notes de calculs"
  },
  {
    ord: "25",
    tache: "Bétonnage des massifs et dalles",
    mode: "Visuel + prélèvement d'échantillons",
    ref: "Contrat + Spécifications Bétons",
    etalonnage: "Éprouvettes béton, thermomètre de cure",
    critere: "Résistance à la compression validée à 28 jours, vibrage correct, absence de nids de cailloux"
  },
  {
    ord: "26",
    tache: "Fourniture matériel Protection Cathodique (PC) provisoire & définitive",
    mode: "Visuel + examen de fiches techniques",
    ref: "Contrat + SP TEC + Plans d'ingénierie PC",
    etalonnage: "/",
    critere: "Anodes sacrificielles, déversoirs, soutirages et câbles de liaison conformes aux spécifications"
  },
  {
    ord: "27",
    tache: "Exécution des travaux de Protection Cathodique",
    mode: "Mesures électriques de potentiel",
    ref: "Contrat + Spécifications PC",
    etalonnage: "Multimètre de précision, Électrode cuivre/sulfate de cuivre",
    critere: "Continuité électrique assurée, potentiel de protection structure/sol dans la plage réglementaire"
  },
  {
    ord: "28",
    tache: "Ramonage mécanique de nettoyage de la ligne",
    mode: "Contrôle visuel de l'exutoire",
    ref: "Contrat + Procédure d'essais hydrostatiques",
    etalonnage: "/",
    critere: "Piston racleur récupéré entier à la gare de réception, absence de débris solides résiduels"
  },
  {
    ord: "29",
    tache: "Calibrage géométrique de la ligne",
    mode: "Examen de la plaque témoin",
    ref: "Contrat + Procédure d'essais hydrostatiques",
    etalonnage: "Plaque de calibrage en aluminium",
    critere: "Plaque de calibrage extraite saine, sans pliure ni encoche supérieure aux tolérances de l'épaisseur"
  },
  {
    ord: "30",
    tache: "Essais hydrostatiques globaux (Épreuves réglementaires)",
    mode: "Mesure de pression de résistance et étanchéité",
    ref: "Fascicules de réglementation en vigueur + SP TEC",
    etalonnage: "Balance manométrique étalonnée, Enregistreur de pression",
    critere: "Épreuve réussie : tenue à la pression de calcul minimale pendant 24h sans baisse inexpliquée"
  },
  {
    ord: "31",
    tache: "Essuyage et séchage préliminaire",
    mode: "Visuel",
    ref: "Procédure de séchage approuvée",
    etalonnage: "/",
    critere: "Piston mousse propulsé jusqu'à obtention d'une mousse ne présentant aucun signe d'humidité"
  },
  {
    ord: "32",
    tache: "Séchage final de la canalisation",
    mode: "Mesure d'humidité résiduelle",
    ref: "Procédure de séchage approuvée",
    etalonnage: "Hygromètre de point de rosée",
    critere: "Point de rosée de l'air ou de l'azote de balayage ≤ -20°C (ou conforme à la spécification)"
  },
  {
    ord: "33",
    tache: "Soufflage et nettoyage des tuyauteries de postes",
    mode: "Visuel (témoin papier/chiffon)",
    ref: "Contrat + SP TEC de pré-commissioning",
    etalonnage: "/",
    critere: "Aucun débris ni humidité résiduelle projetée sur le témoin lors du soufflage sous pression"
  },
  {
    ord: "34",
    tache: "Réception sur touret du câble fibre optique avant pose",
    mode: "Réflectométrie de contrôle",
    ref: "Contrat + Procédure de raccordement FO",
    etalonnage: "Réflectomètre optique étalonné (OTDR)",
    critere: "Rapport de test d'usine vérifié, absence de contraintes ou de cassures physiques de la fibre"
  },
  {
    ord: "35",
    tache: "Mise à disposition et vérification des équipements de pose FO",
    mode: "Examen mécanique",
    ref: "Contrat + Procédure de tirage FO",
    etalonnage: "Tensiomètre de tirage",
    critere: "Limiteur de tension mécanique étalonné pour éviter tout étirement de la fibre optique"
  },
  {
    ord: "36",
    tache: "Réception finale des liaisons fibre optique posées",
    mode: "Réflectométrie bilatérale",
    ref: "Contrat + Procédure de tirage FO",
    etalonnage: "Réflectomètre optique (OTDR)",
    critere: "Affaiblissement linéique et pertes aux épissures conformes aux seuils contractuels (dB/km)"
  }
];


// Lists of official Algerian regions, poles, and wilayas for project registration
export const POLES_ALGERIE = [
  "Pôle ACO (Alger - Constantine - Ouargla)",
  "Pôle BBO (Blida - Béchar - Oran)"
];

export const REGIONS_ALGERIE = [
  "Région Constantine",
  "Région Ouargla",
  "Région Alger",
  "Région Oran",
  "Région Blida",
  "Région Béchar"
];

export const WILAYAS_ALGERIE = [
  "01 - Adrar",
  "02 - Chlef",
  "03 - Laghouat",
  "04 - Oum El Bouaghi",
  "05 - Batna",
  "06 - Béjaïa",
  "07 - Biskra",
  "08 - Béchar",
  "09 - Blida",
  "10 - Bouira",
  "11 - Tamanrasset",
  "12 - Tébessa",
  "13 - Tlemcen",
  "14 - Tiaret",
  "15 - Tizi Ouzou",
  "16 - Alger",
  "17 - Djelfa",
  "18 - Jijel",
  "19 - Sétif",
  "20 - Saïda",
  "21 - Skikda",
  "22 - Sidi Bel Abbès",
  "23 - Annaba",
  "24 - Guelma",
  "25 - Constantine",
  "26 - Médéa",
  "27 - Mostaganem",
  "28 - M'Sila",
  "29 - Mascara",
  "30 - Ouargla",
  "31 - Oran",
  "32 - El Bayadh",
  "33 - Illizi",
  "34 - Bordj Bou Arreridj",
  "35 - Boumerdès",
  "36 - El Tarf",
  "37 - Tindouf",
  "38 - Tissemsilt",
  "39 - El Oued",
  "40 - Khenchela",
  "41 - Souk Ahras",
  "42 - Tipaza",
  "43 - Mila",
  "44 - Aïn Defla",
  "45 - Naâma",
  "46 - Aïn Témouchent",
  "47 - Ghardaïa",
  "48 - Relizane",
  "49 - El M'Ghair",
  "50 - El Meniaa",
  "51 - Ouled Djellal",
  "52 - Bordj Badji Mokhtar",
  "53 - Béni Abbès",
  "54 - Timimoun",
  "55 - Touggourt",
  "56 - Djanet",
  "57 - In Salah",
  "58 - In Guezzam",
  "59 - Aflou",
  "60 - Ain Oussera",
  "61 - Barika",
  "62 - Bou Saâda",
  "63 - Chelghoum Laïd",
  "64 - El Abiodh Sidi Cheikh",
  "65 - El Eulma",
  "66 - Frenda",
  "67 - Maghnia",
  "68 - Messaad",
  "69 - Sour El Ghozlane"
];

// Helper to find latitude/longitude coordinates of Algerian Wilayas for KMZ/KML generation

export const SAMPLE_PROJECTS: Omit<Project, "id">[] = [
  {
    name: "Gazoduc d'Alimentation Centrale Électrique JIJEL (20\")",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    planning: {
      etudeStart: "2026-01-10",
      etudeEnd: "2026-03-25",
      travauxStart: "2026-04-01",
      travauxEnd: "2026-09-15",
      essaisStart: "2026-09-16",
      essaisEnd: "2026-10-15",
      gazStart: "2026-10-16",
      gazEnd: "2026-10-30"
    },
    identity: {
      region: "Région Constantine",
      pole: "Pôle ACO (Alger - Constantine - Ouargla)",
      wilaya: "18 - Jijel",
      district: "18 - Jijel District",
      phase: "Travaux",
      cadreInscription: "Programme d'Urgence National (PUN)",
      planificationComment: "Travaux en cours de terrassement et cintrage sur l'essentiel du tracé. Progression conforme au planning initial.",
      structureChargee: "Division Ingénierie & Projets EPC",
      caracteristiques: {
        diametre: "20\" (DN 500)",
        longueur: "42",
        pression: "70 bar (HP)",
        typeTuyau: "Acier API 5L X60 - Enrobé PE extrudé"
      },
      contraintes: "Opposition résolue au PK 12+500. Retard de livraison des vannes de sectionnement."
    },
    etudeAutorisation: {
      statutEtude: "Approuvée",
      datePermisConstruire: "2026-03-10",
      statutPermisConstruire: "Reçu",
      statutArreteServitude: "Signé & Publié",
      arreteServitudeRef: "Arrêté n° 245/Jijel/2026",
      expertiseFonciere: {
        gefDesignated: true,
        gefIdentity: "Bureau d'Expertise Foncière SADAOUI, Constantine",
        acquisitionDemandEstablished: true,
        acquisitionComment: "Dossiers d'expropriation déposés au niveau des APC de Jijel et Kaous. Indemnisation en cours."
      }
    },
    travauxPlanification: {
      avancementPhysique: 55,
      essaisReglementaires: {
        epreuveResistance: "Non faite",
        epreuveEtancheite: "Non faite",
        organismeControleur: "VERITAL SpA"
      },
      controleQualiteChecklist: {
        abaqueSoudageValide: true,
        radiographieCND: true,
        enrobageVerifie: false,
        litPoseSableux: true,
        protectionCathodique: false
      }
    },
    miseEnGazArchive: {
      statutMiseEnGaz: "Planifiée",
      dateEffectiveMiseEnGaz: "2026-10-25",
      documentsArchives: [
        { id: "1", name: "Etude de Desserte et d'Impact Hydraulique_Jijel.pdf", category: "Étude d'Impact", addedAt: "2026-02-15" },
        { id: "2", name: "Procédure d'Abaque de Soudage Qualifiée.pdf", category: "Soudure", addedAt: "2026-04-10" }
      ]
    }
  },
  {
    name: "Interconnexion Gazoduc Ouest ALGER - BLIDA (30\")",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    planning: {
      etudeStart: "2025-08-01",
      etudeEnd: "2025-11-15",
      travauxStart: "2025-12-01",
      travauxEnd: "2026-05-30",
      essaisStart: "2026-06-01",
      essaisEnd: "2026-06-25",
      gazStart: "2026-07-01",
      gazEnd: "2026-07-10"
    },
    identity: {
      region: "Région Alger",
      pole: "Pôle ACO (Alger - Constantine - Ouargla)",
      wilaya: "09 - Blida",
      district: "09 - Blida District",
      phase: "Mise en Gaz",
      cadreInscription: "Plan de Développement Inter-Régional (PDIR)",
      planificationComment: "Tous les essais de pression hydraulique de résistance et d'étanchéité ont été validés par VERITAL. Phase finale de rinçage et de mise en gaz.",
      structureChargee: "Département Ingénierie & Projets - Pôle Alger",
      caracteristiques: {
        diametre: "30\" (DN 750)",
        longueur: "28",
        pression: "70 bar (HP)",
        typeTuyau: "Acier API 5L X70 - Haute Résistance"
      },
      contraintes: "Aucune contrainte majeure. Traversée de l'Oued Chiffa finalisée sans incident."
    },
    etudeAutorisation: {
      statutEtude: "Approuvée",
      datePermisConstruire: "2025-11-02",
      statutPermisConstruire: "Reçu",
      statutArreteServitude: "Signé & Publié",
      arreteServitudeRef: "Arrêté n° 1087/Blida/2025",
      expertiseFonciere: {
        gefDesignated: true,
        gefIdentity: "Cabinet de Géomètre-Expert BELHADJ, Alger",
        acquisitionDemandEstablished: true,
        acquisitionComment: "Expertise foncière finalisée à 100%. Accords amiables signés avec l'ensemble des propriétaires agricoles."
      }
    },
    travauxPlanification: {
      avancementPhysique: 100,
      essaisReglementaires: {
        epreuveResistance: "Réussie",
        epreuveEtancheite: "Réussie",
        organismeControleur: "ALGERAC"
      },
      controleQualiteChecklist: {
        abaqueSoudageValide: true,
        radiographieCND: true,
        enrobageVerifie: true,
        litPoseSableux: true,
        protectionCathodique: true
      }
    },
    miseEnGazArchive: {
      statutMiseEnGaz: "Réalisée",
      dateEffectiveMiseEnGaz: "2026-07-05",
      documentsArchives: [
        { id: "1", name: "Rapport d'épreuve hydrostatique validé_VERITAL.pdf", category: "PV d'essais", addedAt: "2026-06-20" },
        { id: "2", name: "Dossier Technique Final de Recollement (As-Built).zip", category: "Dossier Technique Final", addedAt: "2026-07-02" },
        { id: "3", name: "Certificat de tarage des soupapes de sécurité du poste.pdf", category: "PV d'essais", addedAt: "2026-06-28" }
      ]
    }
  }
];


export const AVAILABLE_COLUMNS = [
  { key: "wilaya", label: "Wilaya" },
  { key: "pole", label: "Pôle" },
  { key: "region", label: "Direction / Région" },
  { key: "phase", label: "Phase du Projet" },
  { key: "objective", label: "Objectif / Date" },
  { key: "diametre", label: "Diamètre" },
  { key: "longueur", label: "Longueur" },
  { key: "capacite", label: "Capacité Poste" },
  { key: "avGC", label: "Avancement GC" },
  { key: "avMeca", label: "Avancement Méca" },
  { key: "avGlobal", label: "Avancement Global" },
  { key: "contraintes", label: "Contraintes Majeures" }
];

