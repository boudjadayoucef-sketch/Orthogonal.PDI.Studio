// Project Management Types
// Project Interface structure matched with PD&I requirements
export interface PlanDeControleItemStatus {
  dateControle: string;
  resultat: "C" | "NC" | "/";
  etalonnage: string;
  action: string;
  dateNouveauControle: string;
  resultatNouveau: "C" | "NC" | "/";
  observation: string;
}

export interface FicheSuivi {
  capPoste: string;
  ligneMl: string;
  typePoste: string;
  typeProgramme: "OC et MEG" | "OC" | "MEG" | "Hors programme" | "";
  demandeGefDate: string;
  gefCabinet: string;
  natureTerrain: string;
  depotDossierType: string;
  impactAssujettis: "Oui" | "Non" | "";
  impactBetOds: string;
  impactDepotEtude: string;
  impactOuvertureEnqueteDate: string;
  choixTerrainDate: string;
  choixTerrainPv: "Oui" | "Non" | "";
  etudeBetStatut: "Oui" | "Non" | "";
  etudeBetCabinet: string;
  depotPcDate: string;
  depotAsDate: string;
  rappels: string[];
  reserves: string[];
  servitudeEnquetePv: "Oui" | "Non" | "";
  servitudeEnqueteDate: string;
  servitudeJournaux: "Oui" | "Non" | "";
  servitudeQuittancesPv: "Oui" | "Non" | "";
  servitudeQuittancesDate: string;
  servitudeArreteStatus: string;
  servitudeArreteDate: string;
  servitudeArreteRef: string;
  autresInformations: string[];
  
  // New fields for Expertise & Servitudes
  expertiseArreteEnqueteRef?: string;
  expertiseArreteEnqueteDate?: string;
  expertiseArreteConsignationRef?: string;
  expertiseArreteConsignationDate?: string;
  servitudeEnqueteUtilitePubliquePv?: "Oui" | "Non" | "";
  servitudeEnqueteUtilitePubliqueDate?: string;
  servitudeEnqueteUtilitePubliqueRef?: string;

  // New fields for Arrêté de servitude (AS) & Impact Environnement tracking
  asDateDemande?: string;
  asOuvertureEnqueteDate?: string;
  asPubJournauxDate?: string;
  asQuittanceDate?: string;
  impactDemandeAutExploitDate?: string;
  impactPubJournauxDate?: string;
  impactQuittanceDate?: string;

  // New fields for Levée de réserves & Action (Studies and Expertise)
  etudeLeveeReserveDate?: string;
  etudeLeveeReserveStatus?: string;
  etudeActionStatus?: string;
  expertiseLeveeReserveDate?: string;
  expertiseLeveeReserveStatus?: string;
  expertiseActionStatus?: string;
}

export interface ContractDetails {
  nom: string;
  ref: string;
  montant: string;
  date: string;
  ods: string;
  avancement: number;
  delai?: string;
  postesAffectes?: string;
}

export interface ProjectLot {
  id: string;
  name: string;
  phase: "Étude" | "Travaux" | "Mise en Gaz" | "Clôturé";
  avancementPhysique: number;
  avancementGC?: number;
  avancementMeca?: number;
  contrats?: {
    bureauEtude: ContractDetails;
    expert: ContractDetails;
    etbGC: ContractDetails;
    etbMeca: ContractDetails;
    betEnvironnement?: ContractDetails;
  };
  pkStart?: string;
  pkEnd?: string;
  longueur?: string;
  postesAffectes?: string[];
  wilaya?: string;
  travauxLigne?: any[];
  travauxPostes?: any[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: any;
  updatedAt: any;
  
  chefDeProjetUid?: string;
  chefDeProjetName?: string;
  chefDeProjetEmail?: string;
  chefDeProjetStructure?: string;

  chefDeProjetEtudeUid?: string;
  chefDeProjetEtudeName?: string;
  chefDeProjetEtudeEmail?: string;
  chefDeProjetEtudeStructure?: string;

  chefsDeProjetTravaux?: Array<{ uid: string; name: string; email?: string; structure?: string }>;
  chefsDeProjetEtude?: Array<{ uid: string; name: string; email?: string; structure?: string }>;
  chefsDeProjetExpertise?: Array<{ uid: string; name: string; email?: string; structure?: string }>;
  superviseurs?: Array<{ uid: string; name: string; email?: string; structure?: string }>;

  superviseurUid?: string;
  superviseurName?: string;
  superviseurEmail?: string;
  superviseurStructure?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedByUid?: string;
  createdByEmail?: string;
  createdByName?: string;
  createdByUid?: string;
  
  // Phase 00: Dates Planifiées (Début & Fin) pour le graphique Gantt
  planning: {
    etudeStart: string;
    etudeEnd: string;
    travauxStart: string;
    travauxEnd: string;
    essaisStart: string;
    essaisEnd: string;
    gazStart: string;
    gazEnd: string;
  };

  // Phase 01: Identité du projet
  identity: {
    region: string; // Direction de Région TG
    pole: string; // Pôle TG
    wilaya: string;
    district: string;
    phase: "Étude" | "Travaux" | "Mise en Gaz" | "Clôturé";
    cadreInscription: string;
    planificationComment: string;
    structureChargee: string;
    caracteristiques: {
      diametre: string;
      longueur: string;
      pression: string;
      typeTuyau: string;
      capacitePoste?: string;
      // Composition elements (checkboxes)
      hasPiquage?: boolean;
      hasGareRacleurDepart?: boolean;
      hasGareRacleurArrivee?: boolean;
      hasPosteCoupure?: boolean;
      hasPosteSectionnement?: boolean;
      nbPostesCoupure?: number;
      nbPostesSectionnement?: number;
      hasPosteDetente?: boolean;
      pointRaccordement?: string;
      typeOuvrage?: string;
      pipelineSequence?: { id: string; type: "racc" | "gr_dep" | "gr_arr" | "coup" | "sect" | "det"; label?: string; pk?: string }[];
    };
    contraintes?: string;
    contraintesAction?: string;
    kmzUrl?: string;
    kmzFileName?: string;
    kmzFileData?: string;
  };

  // Phase 02: Phase Étude et Autorisation
  etudeAutorisation: {
    statutEtude: "Non lancée" | "En cours" | "Approuvée";
    datePermisConstruire: string;
    statutPermisConstruire: "Non déposé" | "Déposé - En cours" | "Reçu";
    statutArreteServitude: "Non lancé" | "En cours de signature" | "Signé & Publié";
    arreteServitudeRef: string;
    expertiseFonciere: {
      gefDesignated: boolean;
      gefIdentity: string;
      acquisitionDemandEstablished: boolean;
      acquisitionComment: string;
    };
  };

  // Phase 03: Phase Travaux - Planification
  travauxPlanification: {
    avancementPhysique: number;
    avancementGC?: number;
    avancementMeca?: number;
    essaisReglementaires: {
      epreuveResistance: "Non faite" | "En cours" | "Réussie";
      epreuveEtancheite: "Non faite" | "En cours" | "Réussie";
      organismeControleur: string;
    };
    controleQualiteChecklist: {
      abaqueSoudageValide: boolean;
      radiographieCND: boolean;
      enrobageVerifie: boolean;
      litPoseSableux: boolean;
      protectionCathodique: boolean;
    };
  };

  // Phase 04: Mise en gaz et archive documentaire
  miseEnGazArchive: {
    statutMiseEnGaz: "Non planifiée" | "Planifiée" | "Prête" | "Réalisée";
    dateEffectiveMiseEnGaz: string;
    documentsArchives: Array<{
      id: string;
      name: string;
      category: string;
      addedAt: string;
    }>;
  };

  // Contracts and Multi-lot support
  contrats?: {
    bureauEtude: ContractDetails;
    expert: ContractDetails;
    etbGC: ContractDetails;
    etbMeca: ContractDetails;
    betEnvironnement?: ContractDetails;
  };
  nombreLots?: number;
  lots?: ProjectLot[];
  travauxLigne?: any[];
  travauxPostes?: any[];

  // Detailed templates
  ficheSuivi?: FicheSuivi;
  planDeControle?: Record<string, PlanDeControleItemStatus>;
  disponibiliteMateriel?: {
    tube: { statut: string; quantite: string; commentaire: string };
    posteRechauffeur: { statut: string; quantite: string; commentaire: string };
    raccorderie: { statut: string; quantite: string; commentaire: string };
    posteSectionnement: { statut: string; quantite: string; commentaire: string };
    gareRacleur: { statut: string; quantite: string; commentaire: string };
    autre: { statut: string; quantite: string; commentaire: string };
  };
}


export interface PlanDeControleItem {
  ord: string;
  tache: string;
  mode: string;
  ref: string;
  etalonnage: string;
  critere: string;
}



export interface ProjectManagementProps {
  isAdmin: boolean;
  currentUser: any;
  userProfile?: any;
}
