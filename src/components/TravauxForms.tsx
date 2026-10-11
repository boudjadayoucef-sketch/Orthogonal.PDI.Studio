import { useState } from "react";
import { 
  Plus, 
  Trash2, 
  ClipboardList, 
  FileCheck, 
  Search, 
  Award, 
  Activity, 
  Settings,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Thermometer,
  Wrench,
  Wifi,
  Scale
} from "lucide-react";
import defaultLogo from "../assets/images/pdi-logo-horizontal.png";

export interface TravauxTemplate {
  id: string;
  label: string;
  code: string;
  imp: string;
  procedure: string;
  type: "ods" | "certif" | "pv_test" | "table_rows" | "checklist" | "opposition" | "telecom";
  desc: string;
  pageCount?: string;
}

export const TRAVAUX_TEMPLATES: TravauxTemplate[] = [
  { id: "ods_prestataire", label: "Ordre de Service au Prestataire", code: "PR.INFR.01.V01", imp: "IMP.INFR.01", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "ods", desc: "Notification de commencement des prestations", pageCount: "1 / 1" },
  { id: "ods_arret", label: "Ordre d'Arrêt de Service", code: "PR.INFR.01.V01", imp: "IMP.INFR.02", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "ods", desc: "Notification d'arrêt temporaire des travaux", pageCount: "1 / 1" },
  { id: "ods_reprise", label: "Ordre de Reprise de Service", code: "PR.INFR.01.V01", imp: "IMP.INFR.03", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "ods", desc: "Notification de reprise de service", pageCount: "1 / 1" },
  { id: "pv_demarrage", label: "PV de Démarrage des Travaux", code: "PR.INFR.01.V01", imp: "IMP.INFR.04", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "PV officiel de démarrage et d'ouverture de chantier", pageCount: "1 / 2" },
  { id: "attachement_ligne", label: "Attachement Travaux - Ligne", code: "PR.INFR.01.V01", imp: "IMP.INFR.05", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "table_rows", desc: "Attachement mensuel pour les travaux de ligne", pageCount: "1 / 1" },
  { id: "attachement_postes", label: "Attachement Travaux - Postes", code: "PR.INFR.01.V01", imp: "IMP.INFR.06", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "table_rows", desc: "Attachement mensuel pour les travaux de postes", pageCount: "1 / 1" },
  { id: "certif_conformite_ligne", label: "Certificat de Conformité Ligne", code: "PR.INFR.01.V01", imp: "IMP.INFR.07", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Certificat de conformité des travaux ligne", pageCount: "1 / 1" },
  { id: "certif_conformite_poste", label: "Certificat de Conformité Poste", code: "PR.INFR.01.V01", imp: "IMP.INFR.08", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Certificat de conformité des travaux poste", pageCount: "1 / 1" },
  { id: "certif_construction_ligne", label: "Certificat de Construction Ligne", code: "PR.INFR.01.V01", imp: "IMP.INFR.09", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Certificat de construction ligne (épreuves hydro)", pageCount: "1 / 1" },
  { id: "certif_construction_poste", label: "Certificat de Construction Poste", code: "PR.INFR.01.V01", imp: "IMP.INFR.10", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Certificat de construction poste (épreuves hydro)", pageCount: "1 / 1" },
  { id: "pv_ramonage", label: "PV de Ramonage de Conduite", code: "MOP.INFR.07.V00", imp: "IMP.INFR.11", procedure: "MODE OPERATOIRE ESSAIS HYDROSTATIQUES DES OUVRAGES", type: "pv_test", desc: "Essai de nettoyage et ramonage de la conduite", pageCount: "1 / 1" },
  { id: "pv_calibrage", label: "PV de Calibrage de Conduite", code: "MOP.INFR.07.V00", imp: "IMP.INFR.12", procedure: "MODE OPERATOIRE ESSAIS HYDROSTATIQUES DES OUVRAGES", type: "pv_test", desc: "Essai de passage de plaque de calibrage", pageCount: "1 / 1" },
  { id: "controle_radio_ligne", label: "PV de Contrôle Radiographique Ligne", code: "PR.INFR.01.V01", imp: "IMP.INFR.13", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "pv_test", desc: "Rapport de contrôle non destructif radiographique ligne", pageCount: "1 / 1" },
  { id: "controle_radio_ouvrage", label: "PV de Contrôle Radio Ouvrage Concentré", code: "PR.INFR.01.V01", imp: "IMP.INFR.14", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "pv_test", desc: "Contrôle radiographique des ouvrages concentrés", pageCount: "1 / 2" },
  { id: "pv_mise_en_gaz", label: "PV de Mise en Gaz", code: "PR.INFR.01.V01", imp: "IMP.INFR.15", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "telecom", desc: "Mise en service et injection de gaz dans l'ouvrage", pageCount: "1 / 1" },
  { id: "fin_chantier_provisoire", label: "PV de Fin de Chantier Provisoire", code: "PR.INFR.01.V01", imp: "IMP.INFR.16", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Réception provisoire du chantier de construction", pageCount: "1 / 1" },
  { id: "pv_levee_reserves_travaux", label: "PV de Levée de Réserves", code: "PR.INFR.01.V01", imp: "IMP.INFR.17", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Levée officielle des réserves de chantier", pageCount: "1 / 2" },
  { id: "fin_chantier_definitif", label: "PV de Fin de Chantier Définitif", code: "PR.INFR.01.V01", imp: "IMP.INFR.18", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "certif", desc: "Réception définitive de l'ouvrage et transfert", pageCount: "1 / 1" },
  { id: "qualification_soudeur_travaux", label: "PV de Qualification de Soudeur", code: "PR.INFR.01.V01", imp: "IMP.INFR.19", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "pv_test", desc: "Agrément technique de soudeur de ligne sur chantier", pageCount: "1 / 1" },
  { id: "pv_signalisation_opposition_travaux", label: "PV de Signalisation d'Opposition (Travaux)", code: "PR.INFR.01.V01", imp: "IMP.INFR.20", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "opposition", desc: "Signalisation d'opposition agricole ou d'utilité", pageCount: "1 / 1" },
  { id: "pv_levee_opposition_travaux", label: "PV de Levée d'Opposition (Travaux)", code: "PR.INFR.01.V01", imp: "IMP.INFR.21", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "opposition", desc: "Levée d'opposition avec accord d'indemnisation", pageCount: "1 / 2" },
  { id: "pv_mise_en_fouille", label: "PV de Mise en Fouille", code: "MOP.INFR.03.V01", imp: "IMP.INFR.22", procedure: "MODE OPERATOIRE D’OUVERTURE, FERMETURE TRANCHEE ET POSE", type: "pv_test", desc: "PV d'autorisation d'enfouissement de tronçon de ligne", pageCount: "1 / 1" },
  { id: "fiche_troncon", label: "Fiche de Tronçon", code: "PR.INFR.01.V01", imp: "IMP.INFR.23", procedure: "MODE OPERATOIRE D’OUVERTURE, FERMETURE TRANCHEE ET POSE", type: "table_rows", desc: "Suivi géométrique et radiographique des tubes posés", pageCount: "1 / 1" },
  { id: "carnet_soudure", label: "Carnet de Soudure", code: "PR.INFR.01.V01", imp: "CARNET SOUDURE", procedure: "REGISTRE DE SOUDAGE ET DE CONTRÔLE RADIOGRAPHIQUE LIGNE", type: "table_rows", desc: "Enregistrement complet des soudures et opérateurs", pageCount: "Page N° 01" },
  { id: "pv_essuyage", label: "PV d'Essuyage de la Conduite", code: "MOP.INFR.08.V00", imp: "IMP.INFR.25", procedure: "MODE OPERATOIRE SECHAGE DES OUVRAGES DE TRANSPORT", type: "certif", desc: "Essai de raclage et d'essuyage de l'intérieur de ligne", pageCount: "1 / 1" },
  { id: "pv_sechage", label: "PV de Séchage de la Conduite", code: "MOP.INFR.08.V00", imp: "IMP.INFR.26", procedure: "MODE OPERATOIRE SECHAGE DES OUVRAGES DE TRANSPORT", type: "certif", desc: "Mesure de point de rosée et de teneur en eau", pageCount: "1 / 1" },
  { id: "pv_soufflage", label: "PV de Soufflage de Poste", code: "MOP.INFR.08.V00", imp: "IMP.INFR.27", procedure: "MODE OPERATOIRE SECHAGE DES OUVRAGES DE TRANSPORT", type: "certif", desc: "Nettoyage et soufflage à l'air sec des équipements", pageCount: "1 / 1" },
  { id: "balance_materiels_tube", label: "Balance de Matériels [Tube de ligne]", code: "PR.INFR.01.V01", imp: "IMP.INFR.28", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "table_rows", desc: "Bilan quantitatif des tubes aciers fournis", pageCount: "1 / 1" },
  { id: "balance_materiels_accessoires", label: "Balance de Matériels [Accessoires]", code: "PR.INFR.01.V01", imp: "IMP.INFR.29", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "table_rows", desc: "Bilan des accessoires et vannes raccordés", pageCount: "1 / 1" },
  { id: "pv_controle_prestation", label: "PV de Contrôle de Prestation Sous-traitée", code: "PR.INFR.04.V00", imp: "IMP.INFR.30", procedure: "PROCEDURE SUIVI DE LA CONFORMITE DES PRESTATIONS", type: "checklist", desc: "Suivi et contrôle qualité des prestations sous-traitées", pageCount: "1 / 1" },
  { id: "carnet_chantier", label: "Carnet de Chantier (Journal)", code: "PR.INFR.03.V01", imp: "IMP.INFR.31", procedure: "PROCEDURE DE CONTRÔLE DES TRAVAUX", type: "telecom", desc: "Rapport quotidien des conditions, moyens et tâches", pageCount: "1 / 2" },
  { id: "rapport_hebdo_avancement", label: "Rapport Hebdomadaire d'Avancement", code: "PR.INR.03.V01", imp: "IMP.INFR.33", procedure: "PROCEDURE DE CONTRÔLE DES TRAVAUX", type: "table_rows", desc: "Situation d'avancement des phases physiques", pageCount: "1 / 2" },
  { id: "rapport_final_execution", label: "Rapport Final de Fin d'Exécution", code: "PR.INFR.01.V01", imp: "IMP.INFR.34", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "telecom", desc: "Rapport de synthèse contractuelle et technique", pageCount: "1 / 4" },
  { id: "pv_essai_mandrinage", label: "PV d'Essai du Mandrinage (FO)", code: "MOP.INFR.05.V00", imp: "IMP.INFR.35", procedure: "POSE DE CABLE A FIBRE OPTIQUE EN TRANCHEE COMMUNE", type: "telecom", desc: "Essai de mandrinage des gaines PEHD de télécom", pageCount: "1 / 1" },
  { id: "pv_essai_etancheite", label: "PV d'Essai d'Étanchéité (FO)", code: "MOP.INFR.05.V00", imp: "IMP.INFR.36", procedure: "POSE DE CABLE A FIBRE OPTIQUE EN TRANCHEE COMMUNE", type: "telecom", desc: "Mesure d'étanchéité à la pression des alvéoles", pageCount: "1 / 1" },
  { id: "touret_cable_fo", label: "Tests sur Touret FO avant pose", code: "MOP.INFR.06.V00", imp: "IMP.INFR.37", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "table_rows", desc: "Mesure par réflectomètre OTDR du touret", pageCount: "1 / 1" },
  { id: "pv_reception_doc_fo", label: "PV Réception Documentation (FO)", code: "MOP.INFR.06.V00", imp: "IMP.INFR.38", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "checklist", desc: "Validation de la documentation as-built fibre optique", pageCount: "1 / 1" },
  { id: "pv_constat_telecom", label: "PV Constat Équipements Telecom", code: "MOP.INFR.06.V00", imp: "IMP.INFR.39", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "checklist", desc: "Constat de conformité des équipements télécom", pageCount: "1 / 1" },
  { id: "mesures_reflectometre_fo", label: "Résultats Mesures Réflectomètre", code: "MOP.INFR.06.V00", imp: "IMP.INFR.40", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "table_rows", desc: "Situation détaillée des mesures optiques bi-directionnelles", pageCount: "1 / 1" },
  { id: "pv_reception_site_fo", label: "PV Réception sur Site (FO)", code: "MOP.INFR.06.V00", imp: "IMP.INFR.41", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "certif", desc: "Réception globale des travaux de fibre optique", pageCount: "1 / 1" },
  { id: "pv_levee_reserves_fo", label: "PV de Levée des Réserves (FO)", code: "MOP.INFR.06.V00", imp: "IMP.INFR.42", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "certif", desc: "Levée officielle de réserves télécom fibre optique", pageCount: "1 / 1" },
  { id: "pv_constat_travaux_fo", label: "PV de Constat des Travaux (FO)", code: "MOP.INFR.06.V00", imp: "IMP.INFR.43", procedure: "TESTS ET RECEPTION SUR SITE FIBRE OPTIQUE", type: "certif", desc: "Rapport de constat d'anomalies ou d'avancement", pageCount: "1 / 1" },
  { id: "fiche_raccordement", label: "Fiche de Raccordement de Conduite", code: "PR.INFR.01.V01", imp: "IMP.INFR.44", procedure: "PROCEDURE REALISATION DES TRAVAUX DE DEVELOPPEMENT", type: "table_rows", desc: "Schéma d'assemblage et de raccordement final (Golden tie-in)", pageCount: "1 / 1" }
];

interface TravauxFormsProps {
  formType: string;
}

export default function TravauxForms({ formType }: TravauxFormsProps) {
  const currentTemplate = TRAVAUX_TEMPLATES.find(t => t.id === formType);

  // Big comprehensive realistic Gas Engineering Projects state
  const [state, setState] = useState({
    direction: "Direction Régionale de Projet — Zone Centre",
    district: "District d'Ingénierie & Travaux",
    ouvrage: "Canalisation 12\" Alimentation Zone Industrielle",
    ouvrageDetails: "Ø 12\" L - 14.5 Km Site Industriel",
    prestataire: "Entreprise de Réalisation & Montage",
    bureauControle: "Organisme Agréé de Contrôle & Inspection",
    contratNo: "N° 248/EPC-PDI/2025",
    apNo: "AP N° 12-405-2025",
    delaiExecution: "12 Mois",
    dateODS: "10/11/2025",
    dateStart: "15/11/2025",
    dateLieu: "Site de Projet, le 13/07/2026",
    dateJour: "13/07/2026",
    moyensHumains: "01 Chef de projet, 02 Ingénieurs QA/QC, 04 Soudeurs qualifiés API 5L, 06 Terrassiers",
    moyensMateriels: "01 Grue 25T, 02 Postes à souder Lincoln, 01 Excavatrice CAT 320, 01 Camion plateau",
    directeur: "M. Benmalek Slimane",
    responsableAuteur: "M. Khelifi Slimane",
    adressePrestataire: "Zone Industrielle Oued Smar, Alger",
    odsNo: "ODS/01/2025",
    arretNo: "AR/01/2026",
    repriseNo: "REP/01/2026",
    dateArret: "15/02/2026",
    dateReprise: "10/04/2026",
    suspenduParArret: "AR/01/2026 du 15/02/2026",
    odsRef: "ODS/01/2025 du 10/11/2025",
    wilaya: "M'Sila",
    daira: "Sidi Aïssa",
    commune: "Sidi Aïssa",
    
    // Attachement values
    moisAnnee: "Juillet 2026",
    attachementNo: "03",
    attachementRows: [
      { des: "Terrassement en excavation tranchée", uni: "Ml", qAnt: "4500.00", qFact: "1200.00", qCum: "5700.00", nPri: "101", obs: "Conforme" },
      { des: "Bardage et alignement des tubes 12\"", uni: "Ml", qAnt: "4000.00", qFact: "1500.00", qCum: "5500.00", nPri: "102", obs: "Fouille en cours" },
      { des: "Soudage de ligne bout à bout", uni: "Jts", qAnt: "120.00", qFact: "45.00", qCum: "165.00", nPri: "103", obs: "Contrôles radio 100%" }
    ],

    // Fiche de troncon values
    datesTroncon: "Posé le : 18/05/2026",
    ficheTronconRows: [
      { date: "18/05/2026", s: "TR-08-01", tube: "T-0943", coulee: "C-84329", long: "12.15", cumul: "12.15", radio: "R-9483", prof: "1.25" },
      { date: "18/05/2026", s: "TR-08-02", tube: "T-0944", coulee: "C-84329", long: "11.95", cumul: "24.10", radio: "R-9484", prof: "1.20" },
      { date: "19/05/2026", s: "TR-08-03", tube: "T-0945", coulee: "C-84330", long: "12.00", cumul: "36.10", radio: "R-9485", prof: "1.22" }
    ],

    // Carnet de soudure
    carnetRows: [
      { date: "15/05/2026", s: "S-104", tube: "T-0943", coulee: "C-84329", long: "12.15", deg: "0°", haut: "1.20", ep: "6.35", cum: "12.15", e1: "S. Ahmed (Gr.1)", e2: "B. Ali (Gr.1)", fini: "OK", r1: "Accepté", r2: "Accepté" }
    ],

    // Ramonage/Calibrage
    diametreTube: "12''",
    longueurTroncon: "3500 m",
    epaisseurMm: "6.35 mm",
    pressionNettoyage: "6.5 bar",
    pressionCompresseur: "8.0 bar",
    dureePassage: "45 min",
    diametrePlaque: "298 mm",

    // Radiographie values
    wpsNo: "WPS-12-005 Rev 01",
    methodeSoudage: "5G Mixte (Montant)",
    electrodes: "E6010 / E7018",
    gammagraphie: "IR 192 (Iridium)",
    filmType: "D4, D5",
    priseClich: "Extérieur contact / Intérieur crawler",
    marquageFilm: "Lettres en Plomb (DZ)",
    repassageCirco: "Bande chiffrée",
    nuanceMetal: "API 5L Grade X52 - Gr B",
    soudureControl: "120",
    soudureAccept: "118",
    soudureRepar: "2",
    soudureCoupe: "0",
    obsRadio: "Toutes les soudures données à réparer sont acceptées après reprise.",

    // Opposition values
    opposant: "M. Touati Salah (Né le 12/04/1965, exploitant agricole)",
    assiettePoste: "Parcelle cadastrale n° 72, Sidi Aïssa",
    oppositionDate: "05/03/2026",
    oppositionObservations: "Le propriétaire terrien bloque l'accès aux engins au niveau du PK 12+450 pour exiger la réévaluation des récoltes maraîchères endommagées.",
    leveeOppositionDate: "12/06/2026",
    leveeOppositionObs: "Accord amiable trouvé pour indemnisation anticipée des cultures et restauration complète des clôtures en fin de chantier.",

    // Fibres Optiques OTDR tests
    numTouret: "TR-FO-2026-45",
    longueurTouret: "4050 m",
    appareilMesure: "EXFO FTB-200 OTDR",
    operateur: "Ing. Youcef Boudjada",
    fibresAttenuations: [
      { couleur: "Bleu", no: "01", att1310: "0.334 dB/km", att1550: "0.198 dB/km", attAB1310: "0.32 dB", attAB1550: "0.19 dB", attBA1310: "0.31 dB", attBA1550: "0.18 dB", distance: "4.05 KM", epissures: "02", connec: "02", verdict: "Accepté" },
      { couleur: "Orange", no: "02", att1310: "0.331 dB/km", att1550: "0.194 dB/km", attAB1310: "0.32 dB", attAB1550: "0.19 dB", attBA1310: "0.31 dB", attBA1550: "0.18 dB", distance: "4.05 KM", epissures: "02", connec: "02", verdict: "Accepté" },
      { couleur: "Vert", no: "03", att1310: "0.336 dB/km", att1550: "0.199 dB/km", attAB1310: "0.32 dB", attAB1550: "0.19 dB", attBA1310: "0.31 dB", attBA1550: "0.18 dB", distance: "4.05 KM", epissures: "02", connec: "02", verdict: "Accepté" },
      { couleur: "Marron", no: "04", att1310: "0.332 dB/km", att1550: "0.195 dB/km", attAB1310: "0.32 dB", attAB1550: "0.19 dB", attBA1310: "0.31 dB", attBA1550: "0.18 dB", distance: "4.05 KM", epissures: "02", connec: "02", verdict: "Accepté" },
      { couleur: "Gris", no: "05", att1310: "0.335 dB/km", att1550: "0.197 dB/km", attAB1310: "0.32 dB", attAB1550: "0.19 dB", attBA1310: "0.31 dB", attBA1550: "0.18 dB", distance: "4.05 KM", epissures: "02", connec: "02", verdict: "Accepté" },
      { couleur: "Blanc", no: "06", att1310: "0.330 dB/km", att1550: "0.192 dB/km", attAB1310: "0.32 dB", attAB1550: "0.19 dB", attBA1310: "0.31 dB", attBA1550: "0.18 dB", distance: "4.05 KM", epissures: "02", connec: "02", verdict: "Accepté" }
    ],

    // Telecom items checklist state
    telecomLiaison: "Sidi Aïssa ↔ Zone Industrielle",
    telecomItems: [
      { item: "01", desig: "Patch Panel", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Installé en baie 19\"" },
      { item: "02", desig: "Etiquetage du Patch Panel", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Identification claire des ports" },
      { item: "03", desig: "Fibre protégée par goulotte", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Goulotte PVC blanche" },
      { item: "04", desig: "Chambre de jonction", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Chambre type L2T" },
      { item: "05", desig: "Boite de jonction", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Étanchéité testée" },
      { item: "06", desig: "Signalisation du câble (balise)", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Balises béton posées" }
    ],

    // Prestation checklist
    controlePrestationItems: [
      { item: "01", desig: "Fourniture des vannes de ligne", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Vannes à boisseau sphérique 12\" Class 600" },
      { item: "02", desig: "Étude d'exécution mécanique", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Approuvée par PD&I STG" },
      { item: "03", desig: "Travaux de raccordement optique", existant: "Oui", nonExist: "Non", conf: "Oui", nonConf: "Non", obs: "Soudage de fibre par fusion" }
    ],

    receptionDocFoItems: [
      { item: "01", desig: "Les plans comme construit (AS BUILT) de la liaison FO (Synoptique, tracé)", existant: "Oui", conf: "Oui", obs: "Remis en 3 exemplaires + DVD" },
      { item: "02", desig: "PV des essais de pression PEHD (Gaines de protection)", existant: "Oui", conf: "Oui", obs: "Conforme au fascicule de pose télécom" },
      { item: "03", desig: "Fiche des tests de réflectométrie sur tourets de câble FO avant pose", existant: "Oui", conf: "Oui", obs: "Atténuation moyenne < 0.22 dB/km" }
    ],

    // Balance des matériels tubes
    balanceRows: [
      { des: "Tube Acier 12\" API 5L X52", uni: "Ml", qEnl: "15000.00", qRec: "15000.00", qPos: "14500.00", eca: "500.00", qRei: "480.00", qReb: "15.00", qPer: "5.00", totReb: "20.00", tol: "43.50", defl: "14500.00", site: "Sidi Aïssa" }
    ],

    balanceAccessoiresRows: [
      { des: "Vanne de ligne 12\" Class 600", uni: "U", qRec: "3", qPos: "3", eca: "0", qRei: "0", totRebPer: "0", defl: "3" },
      { des: "Joint d'isolation monobloc 12\"", uni: "U", qRec: "2", qPos: "2", eca: "0", qRei: "0", totRebPer: "0", defl: "2" }
    ],

    // Comments & Observations
    commentaires: "Par le présent document, le chantier est déclaré conforme aux normes de PD&I.",
    verdictMiseEnGaz: "Mise en gaz réussie après vérification des paramètres d'épreuve et de balayage.",
    verdictGenerique: "Travaux déclarés entièrement conformes aux règles de l'art de PD&I.",
    dateLieuOpposition: "Sidi Aïssa, le 13/07/2026",

    // Missing state fields for dynamic forms
    longueurM: "14500",
    diametrePouce: "12",
    jointStart: "J-01",
    jointEnd: "J-120",
    posteNom: "Poste de Détente Sidi Aïssa 20000 m³/h",
    pkStart: "12+450",
    pkEnd: "13+100",
    destinationOuvrage: "Centrale de Sidi Aïssa",
    terminalDepart: "Poste de Coupure PC 14",
    terminalArrivee: "Zone Industrielle Sidi Aïssa",
    rechauffeurMarque: "Pietro Fiorentini",
    indexCompteur: "012847",

    // Dynamic signatory and section text properties
    signLeftTitle: "P/ LE PRESTATAIRE (REALISATEUR)",
    signLeftSub: "Signature & Cachet",
    signRightTitle: "P/ PD&I PIPELINE DESIGN & ISOMETRICS",
    signRightSub: "Signature & Cachet",
    signCenterTitle: "L'ORGANISME DE CONTROLE (VERITAL)",
    signCenterSub: "Signature",
    signThirdLeftTitle: "LE PRESTATAIRE / SOUDEUR",
    signThirdLeftSub: "Signature",
    signThirdRightTitle: "LE REPRESENTANT PD&I",
    signThirdRightSub: "Signature",

    // Dynamic paragraph content properties
    odsPrestataireText: "Notification est faite à Monsieur de commencer les prestations relatives au Marché/Commande/Lettre de commande N°.\n\nLe présent ordre de service met en application les clauses du présent Marché/Commande/Lettre de commande.\n\nLe présent ordre de service sera notifié au prestataire demeurant en Algérie.",
    odsArretText: "Notification est faite à Monsieur, d’arrêter temporairement les travaux relatifs au Marché/Commande/Lettre de commande N° , à partir du , pour des raisons de force majeure ou de libération d'emprises.\n\nLe présent ordre d’arrêt de service sera notifié à l'entrepreneur.",
    odsRepriseText: "Notification est faite à Monsieur, de reprendre les travaux relatifs au contrat suspendu par l’ordre d’arrêt de service N° .\n\nLe présent ordre de reprise de service sera notifié au prestataire.",
    pvDemarrageIntro: "Nous soussignés, représentants de PD&I et du prestataire, certifions que toutes les conditions d'ouverture de chantier sont réunies :",
    certifConformiteLigneText: "Nous soussignés, réalisateur représenté par son responsable habilité, certifions avoir réalisé les travaux de pipeline de transport :\n- D'ouverture de tranchée\n- De soudage, radiographie et enrobage des tubes aciers\n- De mise en fouille et de remblais de la conduite.\n\nRelatif à la ligne, d'une longueur de ml et de Ø \", du joint au joint , selon les spécifications techniques de PD&I dans les règles de l'art.",
    certifConformitePosteText: "Nous soussignés, réalisateur , certifions avoir réalisé les travaux du Poste :\n- De Préfabrication des manifolds et collecteurs\n- De Montage des lignes de détente et sécurité\n- De Radiographie 100% des soudures à l'arc.\n\nLe projet est déclaré entièrement conforme au cahier des charges de PD&I.",
    certifConstructionLigneText: "Nous soussignés, réalisateur , certifions que les travaux de la ligne de longueur ml, diamètre \", du PK au PK ont été construits conformément aux spécifications techniques.\n\nL'ouvrage est déclaré apte à subir les épreuves hydrostatiques de résistance et d'étanchéité sans réserves.",
    certifConstructionPosteText: "Nous soussignés, réalisateur , certifions que les travaux du Poste de Détente/Coupure ont été construits de manière conforme.\n\nLe poste est déclaré apte aux épreuves hydrostatiques sous pression sans aucune réserve.",
    pvEssuyageText: "Essuyage de la conduite : Par le passage de racleurs d'essuyage propulsés à l'air sec, en présence des représentants de PD&I, jusqu'à obtention d'un état interne parfaitement propre et exempt de poussière ou d'eau résiduelle.",
    pvSechageText: "Séchage de la conduite : Par circulation d'air sec déshydraté.\n\nTempérature ambiante : 28°C\nPoint de rosée atteint à la sortie : -45°C",
    pvSoufflageText: "Soufflage des tuyauteries de poste : Réalisé par purges successives de l'air comprimé pour chasser toutes les impuretés et scories de soudage des collecteurs. Le résultat de l'essai est déclaré pleinement satisfaisant.",
    finChantierProvisoireText: "Réception provisoire du chantier de construction. Réception prononcée SANS réserves.",
    pvLeveeReservesTravauxText: "Levée des réserves : Suite aux travaux de mise en conformité effectués par le prestataire, toutes les réserves formulées lors de la réception provisoire sont déclarées officiellement levées et closes ce jour.",
    finChantierDefinitifText: "L'ouvrage ayant passé la période de garantie d'un an sans incident technique, la réception définitive est déclarée acquise et le transfert de propriété est validé.",
    pvMiseEnFouilleText: "Contrôles préalables validés : Le revêtement de la conduite a fait l'objet d'un contrôle au balai électrique (Holiday detector) sous tension de 15kV, validant l'absence de défauts de rigidité diélectrique. Le fond de fouille a été débarrassé de tout caillou saillant et tapissé de sable de protection.",
    qualificationSoudeurText: "Résultats des Examens Mécaniques :\n- Essai de traction : Conforme (Rupture dans le métal de base)\n- Essai de pliage : Conforme (Aucune fissure à 180°)\n- Contrôle visuel : Excellent\n- Contrôle radiographique : 100% Conforme aux critères API 1104",
    pvRamonageText: "Le nettoyage a été effectué par le passage d'un piston racleur propulsé à l'air comprimé :",
    pvCalibrageText: "Le calibrage a été effectué par le passage d'un piston racleur muni d'une plaque d'aluminium déformable :"
  });

  const [headerProcedure, setHeaderProcedure] = useState("");
  const [headerTitle, setHeaderTitle] = useState("");
  const [headerCode, setHeaderCode] = useState("");
  const [headerDate, setHeaderDate] = useState("");
  const [headerImp, setHeaderImp] = useState("");
  const [headerPage, setHeaderPage] = useState("");
  const [lastFormType, setLastFormType] = useState("");

  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});

  if (currentTemplate && formType !== lastFormType) {
    setHeaderProcedure(currentTemplate.procedure);
    setHeaderTitle(currentTemplate.label.toUpperCase());
    setHeaderCode(currentTemplate.code);
    setHeaderDate("29/10/2024");
    setHeaderImp(currentTemplate.imp);
    setHeaderPage(currentTemplate.pageCount || "1 / 1");
    setLastFormType(formType);
  }

  if (!currentTemplate) {
    return (
      <div className="py-12 text-center text-slate-500 font-semibold text-xs bg-white rounded-2xl border border-dashed border-slate-200">
        Veuillez sélectionner un PV pour l'afficher ici.
      </div>
    );
  }

  // Interactive inline fields helper
  const renderDottedField = (label: string, value: string, fieldName?: keyof typeof state, placeholder = "........................") => {
    const key = label;
    const displayValue = dynamicFields[key] !== undefined ? dynamicFields[key] : value;
    return (
      <div className="flex items-baseline gap-1.5 text-[11px] leading-relaxed my-1.5">
        <span className="font-bold text-slate-700 whitespace-nowrap">{label} :</span>
        <input
          type="text"
          value={displayValue || ""}
          onChange={(e) => {
            const val = e.target.value;
            setDynamicFields(prev => ({ ...prev, [key]: val }));
            if (fieldName) {
              setState(prev => ({ ...prev, [fieldName]: val }));
            }
          }}
          className="flex-1 bg-transparent border-b border-dashed border-slate-300 focus:border-orange-500 focus:outline-none px-1 py-0 text-slate-800 font-semibold text-[11px] print:border-none"
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderDottedTextarea = (label: string, value: string, fieldName?: keyof typeof state, placeholder = "........................") => {
    const key = label;
    const displayValue = dynamicFields[key] !== undefined ? dynamicFields[key] : value;
    return (
      <div className="text-[11px] leading-relaxed my-2">
        <span className="font-bold text-slate-700 block mb-0.5">{label} :</span>
        <textarea
          value={displayValue || ""}
          onChange={(e) => {
            const val = e.target.value;
            setDynamicFields(prev => ({ ...prev, [key]: val }));
            if (fieldName) {
              setState(prev => ({ ...prev, [fieldName]: val }));
            }
          }}
          className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-orange-500 focus:outline-none py-0.5 px-1 text-slate-800 font-semibold resize-none h-14 leading-relaxed text-[11px] print:border-none"
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderOfficialHeader = (procedure: string, title: string, code: string, date: string, imp: string, page: string) => (
    <div className="border-2 border-slate-900 w-full text-slate-900 mb-5 font-sans text-[10px] leading-tight print:mb-3">
      <div className="flex h-20">
        <div className="w-[18%] border-r-2 border-slate-900 flex flex-col items-center justify-center p-1 bg-white select-none">
          <img 
            src={defaultLogo} 
            alt="PD&I Logo" 
            className="h-16 w-16 max-h-full max-w-full object-contain aspect-square"
            onError={(e) => {
              e.currentTarget.src = "/pdi-logo-horizontal.png";
            }}
          />
        </div>

        <div className="w-[57%] border-r-2 border-slate-900 flex flex-col justify-between py-0.5 px-2 text-center bg-white">
          <div className="font-extrabold text-[11px] uppercase text-slate-800 tracking-wide pt-0.5 select-none">
            PD&I Pipeline Design & Isometrics
          </div>
          <input
            type="text"
            value={headerProcedure}
            onChange={(e) => setHeaderProcedure(e.target.value)}
            className="w-full text-center bg-transparent border-t border-b border-dashed border-slate-300 text-[8px] uppercase text-slate-600 font-mono font-bold leading-tight py-0.5 focus:border-blue-500 focus:outline-none print:border-none"
          />
          <input
            type="text"
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            className="w-full text-center bg-transparent border-b border-dashed border-slate-300 text-[11px] uppercase text-orange-900 font-black leading-tight py-0.5 focus:border-blue-500 focus:outline-none print:border-none"
          />
        </div>

        <div className="w-[25%] flex flex-col justify-between bg-white text-[8px] font-semibold">
          <div className="flex border-b border-slate-900 h-1/4 items-center px-1.5">
            <span className="font-bold w-10 border-r border-slate-300 mr-1.5 shrink-0 select-none">CODE</span>
            <input
              type="text"
              value={headerCode}
              onChange={(e) => setHeaderCode(e.target.value)}
              className="flex-1 bg-transparent border-b border-dashed border-slate-300 font-mono text-slate-800 px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
          <div className="flex border-b border-slate-900 h-1/4 items-center px-1.5">
            <span className="font-bold w-10 border-r border-slate-300 mr-1.5 shrink-0 select-none">DATE</span>
            <input
              type="text"
              value={headerDate}
              onChange={(e) => setHeaderDate(e.target.value)}
              className="flex-1 bg-transparent border-b border-dashed border-slate-300 font-mono text-slate-800 px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
          <div className="flex border-b border-slate-900 h-1/4 items-center px-1.5 font-mono font-bold justify-center bg-orange-50/40 text-orange-950">
            <input
              type="text"
              value={headerImp}
              onChange={(e) => setHeaderImp(e.target.value)}
              className="w-full text-center bg-transparent border-b border-dashed border-slate-300 font-mono text-orange-950 font-bold px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
          <div className="flex h-1/4 items-center px-1.5">
            <span className="font-bold w-10 border-r border-slate-300 mr-1.5 shrink-0 select-none">PAGE</span>
            <input
              type="text"
              value={headerPage}
              onChange={(e) => setHeaderPage(e.target.value)}
              className="flex-1 bg-transparent border-b border-dashed border-slate-300 font-mono text-slate-800 px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 1. ODS / ARRET / REPRISE TEMPLATE */}
      {currentTemplate.type === "ods" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-x-4 bg-slate-50 p-2 border border-slate-200 rounded text-[11px]">
            {renderDottedField("DIRECTION", state.direction, "direction")}
            {renderDottedField("Lieu et date", state.dateLieu, "dateLieu")}
            <div className="col-span-2">{renderDottedField("Marché/Commande/Lettre de commande N°", state.contratNo, "contratNo")}</div>
            {renderDottedField("Objet de la prestation", state.ouvrage, "ouvrage")}
            {renderDottedField("Prestataire", state.prestataire, "prestataire")}
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-white mt-4 space-y-3">
            <h3 className="text-center font-extrabold text-sm border-2 border-slate-800 p-2 uppercase bg-slate-50 tracking-wider">
              {currentTemplate.id === "ods_prestataire" && "ORDRE DE SERVICE AU PRESTATAIRE"}
              {currentTemplate.id === "ods_arret" && "ORDRE D’ARRET DE SERVICE AU PRESTATAIRE"}
              {currentTemplate.id === "ods_reprise" && "ORDRE DE REPRISE DE SERVICE AU PRESTATAIRE"}
            </h3>

            {currentTemplate.id === "ods_prestataire" && (
              <textarea
                value={state.odsPrestataireText}
                onChange={(e) => setState({ ...state, odsPrestataireText: e.target.value })}
                className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-28 print:border-none"
              />
            )}

            {currentTemplate.id === "ods_arret" && (
              <textarea
                value={state.odsArretText}
                onChange={(e) => setState({ ...state, odsArretText: e.target.value })}
                className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-28 print:border-none"
              />
            )}

            {currentTemplate.id === "ods_reprise" && (
              <textarea
                value={state.odsRepriseText}
                onChange={(e) => setState({ ...state, odsRepriseText: e.target.value })}
                className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-28 print:border-none"
              />
            )}

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 pt-8 border-t border-slate-100">
              <div>
                <span>Le Directeur :</span>
                <input type="text" value={state.directeur} onChange={e => setState({ ...state, directeur: e.target.value })} className="ml-1 bg-transparent border-b border-dashed border-slate-300 font-bold px-1 py-0.2 focus:outline-none focus:border-orange-500" />
              </div>
              <div className="text-right">
                <span>Le Prestataire :</span>
                <span className="block text-[8px] text-slate-400 font-normal italic">Signature & Cachet pour notification</span>
              </div>
            </div>
          </div>

          {/* Conservé par l'entrepreneur divider section to match IMP.INFR.01/02/03 */}
          <div className="relative my-6 print:hidden">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-dashed border-slate-400"></div>
            </div>
            <div className="relative flex justify-center text-[8px] font-extrabold uppercase tracking-widest">
              <span className="bg-white px-2 text-slate-400">PARTIE A CONSERVER PAR L’ENTREPRENEUR / RETOURNER A PD&I</span>
            </div>
          </div>

          <div className="p-3 border border-dashed border-slate-300 bg-slate-50/50 rounded-lg text-left text-[11px] print:hidden">
            <h4 className="font-extrabold text-[10px] text-slate-600 uppercase tracking-wider mb-2">A RETOURNER IMPERATIVEMENT A PD&I SOUS HUITAINE :</h4>
            <p className="text-[10px] text-slate-500 mb-3">
              Le soussigné <span className="font-bold">{state.responsableAuteur}</span> déclare avoir fait parvenir au domicile de Monsieur <span className="font-bold">{state.prestataire}</span> l'ordre de service susvisé en date du <span className="font-bold">{state.dateJour}</span>.
            </p>
            <div className="flex justify-between font-bold text-slate-600 text-[9px]">
              <span>Signature du Directeur de Projet :</span>
              <span>Signature du Prestataire :</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. CERTIF & PROTOCOLE COMPILATION */}
      {currentTemplate.type === "certif" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 border border-slate-200 rounded text-[11px]">
            {renderDottedField("Ouvrage", state.ouvrage, "ouvrage")}
            {renderDottedField("Lieu et date", state.dateLieu, "dateLieu")}
            {renderDottedField("Maitre de l'ouvrage", "PD&I PIPELINE DESIGN & ISOMETRICS", "direction")}
            {renderDottedField("Réalisateur / Prestataire", state.prestataire, "prestataire")}
            {renderDottedField("Contrat N°", state.contratNo, "contratNo")}
          </div>

          <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-white mt-4">
            <h3 className="text-center font-extrabold text-sm uppercase text-slate-800 tracking-wider underline border-b pb-2 mb-2">
              {currentTemplate.label}
            </h3>

            {/* PV Demarrage (IMP.INFR.04) */}
            {currentTemplate.id === "pv_demarrage" && (
              <div className="space-y-3 text-[11px]">
                <textarea
                  value={state.pvDemarrageIntro}
                  onChange={(e) => setState({ ...state, pvDemarrageIntro: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-14 print:border-none"
                />
                <div className="grid grid-cols-2 gap-4 my-2 border p-2.5 rounded bg-slate-50">
                  <div>
                    <span className="font-bold text-[10px] text-blue-800 block uppercase border-b mb-1">Moyens Humains Disponibles</span>
                    <p className="text-[10px]">{state.moyensHumains}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[10px] text-blue-800 block uppercase border-b mb-1">Moyens Matériels Disponibles</span>
                    <p className="text-[10px]">{state.moyensMateriels}</p>
                  </div>
                </div>
                <div className="space-y-1.5 border-t pt-2">
                  <span className="font-bold text-slate-700 block text-[10px] uppercase">Documents « Bon pour exécution » fournis :</span>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 font-semibold">
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Carte générale du tracé</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Vues en plan</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Profils en long</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Arrêté de servitude</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Permis de construire</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Ordre de service (ODS)</label>
                  </div>
                </div>
                <p className="font-bold text-center text-blue-900 border-t pt-2 mt-3 text-[11px]">Par le présent document, le chantier is déclaré officiellement ouvert.</p>
              </div>
            )}

            {/* Certificat Conformite Ligne (IMP.INFR.07) */}
            {currentTemplate.id === "certif_conformite_ligne" && (
              <div className="space-y-2.5 text-[11px] leading-relaxed">
                <textarea
                  value={state.certifConformiteLigneText}
                  onChange={(e) => setState({ ...state, certifConformiteLigneText: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-28 print:border-none"
                />
              </div>
            )}

            {/* Certificat Conformite Poste (IMP.INFR.08) */}
            {currentTemplate.id === "certif_conformite_poste" && (
              <div className="space-y-2 text-[11px] leading-relaxed">
                <textarea
                  value={state.certifConformitePosteText}
                  onChange={(e) => setState({ ...state, certifConformitePosteText: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-28 print:border-none"
                />
              </div>
            )}

            {/* Certificat Construction Ligne (IMP.INFR.09) */}
            {currentTemplate.id === "certif_construction_ligne" && (
              <div className="space-y-2.5 text-[11px]">
                <textarea
                  value={state.certifConstructionLigneText}
                  onChange={(e) => setState({ ...state, certifConstructionLigneText: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-24 print:border-none"
                />
              </div>
            )}

            {/* Certificat Construction Poste (IMP.INFR.10) */}
            {currentTemplate.id === "certif_construction_poste" && (
              <div className="space-y-2 text-[11px]">
                <textarea
                  value={state.certifConstructionPosteText}
                  onChange={(e) => setState({ ...state, certifConstructionPosteText: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-24 print:border-none"
                />
              </div>
            )}

            {/* Essuyage / Séchage / Soufflage (IMP.INFR.25 / 26 / 27) */}
            {["pv_essuyage", "pv_sechage", "pv_soufflage"].includes(currentTemplate.id) && (
              <div className="space-y-2 text-[11px] leading-relaxed">
                <p>
                  L'an <span className="font-bold">{state.dateJour.split("/")[2] || "2026"}</span>, il a été procédé aux opérations sur l'ouvrage <span className="font-bold">{state.ouvrage}</span> :
                </p>
                {currentTemplate.id === "pv_essuyage" && (
                  <textarea
                    value={state.pvEssuyageText}
                    onChange={(e) => setState({ ...state, pvEssuyageText: e.target.value })}
                    className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-16 print:border-none"
                  />
                )}
                {currentTemplate.id === "pv_sechage" && (
                  <textarea
                    value={state.pvSechageText}
                    onChange={(e) => setState({ ...state, pvSechageText: e.target.value })}
                    className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-20 print:border-none"
                  />
                )}
                {currentTemplate.id === "pv_soufflage" && (
                  <textarea
                    value={state.pvSoufflageText}
                    onChange={(e) => setState({ ...state, pvSoufflageText: e.target.value })}
                    className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-16 print:border-none"
                  />
                )}
              </div>
            )}

            {/* Reception Provisoire & Definitive (IMP.INFR.16 / 17 / 18) */}
            {["fin_chantier_provisoire", "pv_levee_reserves_travaux", "fin_chantier_definitif"].includes(currentTemplate.id) && (
              <div className="space-y-2.5 text-[11px] leading-relaxed">
                <p>
                  Il a été procédé ce jour, le <span className="font-bold">{state.dateJour}</span>, à la réception de l’ouvrage <span className="font-bold">{state.ouvrage}</span>, déclarant :
                </p>
                
                {currentTemplate.id === "fin_chantier_provisoire" && (
                  <div className="space-y-2">
                    <textarea
                      value={state.finChantierProvisoireText}
                      onChange={(e) => setState({ ...state, finChantierProvisoireText: e.target.value })}
                      className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-12 print:border-none"
                    />
                    <div className="space-y-2 mt-1">
                      <span className="font-black text-slate-800 text-[10px] block uppercase">Statut des réserves de réception :</span>
                      <label className="flex items-center gap-2 font-bold"><input type="checkbox" defaultChecked /> Réception prononcée SANS réserves.</label>
                      <label className="flex items-center gap-2 font-bold text-slate-400"><input type="checkbox" disabled /> Réception prononcée AVEC les réserves suivantes.</label>
                    </div>
                  </div>
                )}

                {currentTemplate.id === "pv_levee_reserves_travaux" && (
                  <textarea
                    value={state.pvLeveeReservesTravauxText}
                    onChange={(e) => setState({ ...state, pvLeveeReservesTravauxText: e.target.value })}
                    className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-16 print:border-none"
                  />
                )}

                {currentTemplate.id === "fin_chantier_definitif" && (
                  <textarea
                    value={state.finChantierDefinitifText}
                    onChange={(e) => setState({ ...state, finChantierDefinitifText: e.target.value })}
                    className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none text-[11px] leading-relaxed font-semibold text-slate-800 resize-none h-16 print:border-none"
                  />
                )}
              </div>
            )}

            {renderDottedTextarea("Observations et remarques", state.verdictGenerique, "verdictGenerique")}

            <div className="grid grid-cols-2 gap-4 pt-6 text-center text-[10px] font-bold text-slate-700">
              <div className="border-t border-slate-200 pt-6">
                <textarea
                  value={state.signLeftTitle}
                  onChange={(e) => setState({ ...state, signLeftTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold resize-none h-8 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signLeftSub}
                  onChange={(e) => setState({ ...state, signLeftSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
              <div className="border-t border-slate-200 pt-6">
                <textarea
                  value={state.signRightTitle}
                  onChange={(e) => setState({ ...state, signRightTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold resize-none h-8 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signRightSub}
                  onChange={(e) => setState({ ...state, signRightSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. INSPECTIONS & PV TECHNIQUES */}
      {currentTemplate.type === "pv_test" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-x-4 bg-slate-50 p-2 border border-slate-200 rounded text-[11px]">
            {renderDottedField("Ouvrage de transport", state.ouvrage, "ouvrage")}
            {renderDottedField("Lieu et date de l'épreuve", state.dateLieu, "dateLieu")}
            {renderDottedField("Contrat N°", state.contratNo, "contratNo")}
            {renderDottedField("Constructeur / Prestataire", state.prestataire, "prestataire")}
          </div>

          <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-white mt-4 text-[11px]">
            <h3 className="text-center font-extrabold text-xs uppercase text-orange-950 tracking-wider bg-orange-50/50 p-2 rounded border border-orange-200">
              Caractéristiques de l'Épreuve : {currentTemplate.label}
            </h3>

            {/* Ramonage / Calibrage (IMP.INFR.11 / 12) */}
            {["pv_ramonage", "pv_calibrage"].includes(currentTemplate.id) && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 border p-2.5 rounded bg-slate-50">
                  <div className="space-y-1">
                    {renderDottedField("Diamètre du tube", state.diametreTube, "diametreTube")}
                    {renderDottedField("Longueur du tronçon", state.longueurTroncon, "longueurTroncon")}
                  </div>
                  <div className="space-y-1">
                    {renderDottedField("Épaisseur nominale", state.epaisseurMm, "epaisseurMm")}
                    {renderDottedField("Nuance acier", state.nuanceMetal, "nuanceMetal")}
                  </div>
                </div>
                
                {currentTemplate.id === "pv_ramonage" ? (
                  <div className="space-y-1.5">
                    <p>Le nettoyage a été effectué par le passage d'un piston racleur propulsé à l'air comprimé :</p>
                    {renderDottedField("Pression maximale enregistrée (Bars)", state.pressionNettoyage, "pressionNettoyage")}
                    {renderDottedField("Durée de passage du piston (Min)", state.dureePassage, "dureePassage")}
                    <p className="font-bold text-center text-green-800 bg-green-50 p-1.5 rounded border border-green-200 mt-2">RESULTAT : Ramonage de la conduite jugé entièrement conforme.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p>Le calibrage a été effectué par le passage d'un piston racleur muni d'une plaque d'aluminium déformable :</p>
                    {renderDottedField("Diamètre de la plaque de calibrage (mm)", state.diametrePlaque, "diametrePlaque")}
                    {renderDottedField("Pression de propulsion (Bars)", state.pressionNettoyage, "pressionNettoyage")}
                    <p className="font-bold text-center text-green-800 bg-green-50 p-1.5 rounded border border-green-200 mt-2">RESULTAT : Plaque de calibrage intacte. Diamètre de la conduite validé conforme.</p>
                  </div>
                )}
              </div>
            )}

            {/* PV de Controle Radiographique Ligne / Ouvrage (IMP.INFR.13 / 14) */}
            {["controle_radio_ligne", "controle_radio_ouvrage"].includes(currentTemplate.id) && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 border p-2 rounded bg-slate-50">
                  <div>
                    {renderDottedField("WPS / Procédure de soudage", state.wpsNo, "wpsNo")}
                    {renderDottedField("Méthode de soudage", state.methodeSoudage, "methodeSoudage")}
                    {renderDottedField("Électrodes utilisées", state.electrodes, "electrodes")}
                  </div>
                  <div>
                    {renderDottedField("Source radioactive", state.gammagraphie, "gammagraphie")}
                    {renderDottedField("Type de film", state.filmType, "filmType")}
                    {renderDottedField("Prise de clichés", state.priseClich, "priseClich")}
                  </div>
                </div>

                <div className="space-y-1.5 border-t pt-2.5">
                  <span className="font-bold text-slate-700 uppercase text-[10px] block mb-1">Résultats du Contrôle Non Destructif (RT) :</span>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-2 border rounded">
                    {renderDottedField("Nombre de soudures contrôlées à 100%", state.soudureControl, "soudureControl")}
                    {renderDottedField("Nombre de soudures acceptées", state.soudureAccept, "soudureAccept")}
                    {renderDottedField("Nombre de soudures à réparer", state.soudureRepar, "soudureRepar")}
                    {renderDottedField("Nombre de soudures coupées", state.soudureCoupe, "soudureCoupe")}
                  </div>
                </div>
              </div>
            )}

            {/* PV de Qualification de Soudeur (IMP.INFR.19) */}
            {currentTemplate.id === "qualification_soudeur_travaux" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 border p-2 rounded bg-slate-50">
                  <div>
                    {renderDottedField("Nom et Prénom du Soudeur", "Benali Kamel", "responsableAuteur")}
                    {renderDottedField("Poinçon / Repère attribué", "BK-09", "contratNo")}
                    {renderDottedField("Procédé de soudage", "Manual Metal Arc (111)", "methodeSoudage")}
                  </div>
                  <div>
                    {renderDottedField("Diamètre du tube test", state.diametreTube, "diametreTube")}
                    {renderDottedField("Épaisseur du tube test", state.epaisseurMm, "epaisseurMm")}
                    {renderDottedField("Position de soudage", "5G Montante (Soudage en position)", "electrodes")}
                  </div>
                </div>
                <div className="space-y-1 bg-slate-50 p-2 border rounded">
                  <span className="font-bold text-[10px] text-slate-700 block uppercase border-b mb-1">Résultats des Examens Mécaniques :</span>
                  <div className="grid grid-cols-2 gap-x-4">
                    <span>Essai de traction : Conforme (Rupture dans le métal de base)</span>
                    <span>Essai de pliage : Conforme (Aucune fissure à 180°)</span>
                    <span>Contrôle visuel : Excellent</span>
                    <span>Contrôle radiographique : 100% Conforme aux critères API 1104</span>
                  </div>
                </div>
              </div>
            )}

            {/* PV de Mise en Fouille (IMP.INFR.22) */}
            {currentTemplate.id === "pv_mise_en_fouille" && (
              <div className="space-y-3">
                <p>Il a été procédé à l'autorisation d'enfouissement du tronçon de canalisation de gaz haute pression :</p>
                <div className="grid grid-cols-2 gap-4 border p-2.5 rounded bg-slate-50">
                  <div>
                    {renderDottedField("Tronçon de ligne N°", "TR-08", "contratNo")}
                    {renderDottedField("Longueur du tronçon (ml)", "420.00 ml", "longueurTroncon")}
                  </div>
                  <div>
                    {renderDottedField("Du PK", "12+450", "apNo")}
                    {renderDottedField("Au PK", "12+870", "dateODS")}
                  </div>
                </div>
                <p className="bg-slate-50 p-2.5 border rounded">
                  <strong>Contrôles préalables validés :</strong> Le revêtement de la conduite a fait l'objet d'un contrôle au balai électrique (Holiday detector) sous tension de 15kV, validant l'absence de défauts de rigidité diélectrique. Le fond de fouille a été débarrassé de tout caillou saillant et tapissé de sable de protection.
                </p>
              </div>
            )}

            {renderDottedTextarea("Observations de l'Inspecteur / Contrôleur", state.commentaires, "commentaires")}

            <div className="grid grid-cols-3 gap-2 pt-6 text-center text-[9px] font-bold text-slate-600 border-t border-slate-100">
              <div>
                <textarea
                  value={state.signThirdLeftTitle}
                  onChange={(e) => setState({ ...state, signThirdLeftTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold resize-none h-8 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signThirdLeftSub}
                  onChange={(e) => setState({ ...state, signThirdLeftSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
              <div>
                <textarea
                  value={state.signCenterTitle}
                  onChange={(e) => setState({ ...state, signCenterTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold resize-none h-8 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signCenterSub}
                  onChange={(e) => setState({ ...state, signCenterSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
              <div>
                <textarea
                  value={state.signThirdRightTitle}
                  onChange={(e) => setState({ ...state, signThirdRightTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold resize-none h-8 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signThirdRightSub}
                  onChange={(e) => setState({ ...state, signThirdRightSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TABLES (ATTACHEMENT & BALANCES) */}
      {currentTemplate.type === "table_rows" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 border border-slate-200 rounded text-[10px]">
            {renderDottedField("Ouvrage", state.ouvrage, "ouvrage")}
            {renderDottedField("Lieu et date", state.dateLieu, "dateLieu")}
            {renderDottedField("Constructeur / Prestataire", state.prestataire, "prestataire")}
            {renderDottedField("Contrat N°", state.contratNo, "contratNo")}
            {currentTemplate.id.startsWith("attachement") && (
              <>
                {renderDottedField("Mois/Année de l'Attachement", state.moisAnnee, "moisAnnee")}
                {renderDottedField("Attachement N°", state.attachementNo, "attachementNo")}
              </>
            )}
          </div>

          <div className="overflow-x-auto border rounded-lg bg-white mt-4 select-text">
            {/* Attachement Ligne & Postes Table */}
            {currentTemplate.id.startsWith("attachement") && (
              <table className="w-full text-left text-[10px] font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-200 w-[45%]">DESIGNATION DES TRAVAUX</th>
                    <th className="p-2 border-r border-slate-200 text-center">UNITE</th>
                    <th className="p-2 border-r border-slate-200 text-right">QUANTITE ANTERIEURE</th>
                    <th className="p-2 border-r border-slate-200 text-right">QUANTITE A FACTURER</th>
                    <th className="p-2 border-r border-slate-200 text-right">QUANTITE CUMULEE</th>
                    <th className="p-2 border-r border-slate-200 text-center">N° PRIX</th>
                    <th className="p-2 text-center">OBSERVATIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {state.attachementRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 font-semibold text-slate-800">
                      <td className="p-1 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.des}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].des = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="text"
                          value={row.uni}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].uni = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-center px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qAnt}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].qAnt = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qFact}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].qFact = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[10px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qCum}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].qCum = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="text"
                          value={row.nPri}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].nPri = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-center px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <input
                          type="text"
                          value={row.obs}
                          onChange={(e) => {
                            const newRows = [...state.attachementRows];
                            newRows[idx].obs = e.target.value;
                            setState({ ...state, attachementRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-center px-1 py-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px] text-slate-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Fiche de Troncon Table (IMP.INFR.23) */}
            {currentTemplate.id === "fiche_troncon" && (
              <div className="p-2 space-y-3">
                <div className="flex justify-between text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1">FICHE DE TRONCON N° : <input type="text" defaultValue="TR-08" className="font-bold text-blue-950 bg-transparent border-b border-dashed border-slate-300 w-16 focus:outline-none print:border-none" /></span>
                  <span className="flex items-center gap-1">de la soudure N° <input type="text" defaultValue="TR-08-01 à TR-08-15" className="font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 w-32 focus:outline-none print:border-none" /></span>
                  <span className="flex items-center gap-1">PK : <input type="text" defaultValue="12+450 au 12+870" className="font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 w-28 focus:outline-none print:border-none" /></span>
                </div>
                <table className="w-full text-left text-[9px] font-sans border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-1 border-r border-slate-200 text-center">Date pose</th>
                      <th className="p-1 border-r border-slate-200 text-center">N° Soudure</th>
                      <th className="p-1 border-r border-slate-200 text-center">N° Tube</th>
                      <th className="p-1 border-r border-slate-200 text-center">N° Coulée</th>
                      <th className="p-1 border-r border-slate-200 text-right">Longueur (ml)</th>
                      <th className="p-1 border-r border-slate-200 text-right">Cumul (ml)</th>
                      <th className="p-1 border-r border-slate-200 text-center">PV Radio</th>
                      <th className="p-1 text-right">Profondeur (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.ficheTronconRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 font-medium text-slate-800">
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.date}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].date = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center font-bold">
                          <input
                            type="text"
                            value={row.s}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].s = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.tube}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].tube = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.coulee}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].coulee = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-right">
                          <input
                            type="text"
                            value={row.long}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].long = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-right font-semibold text-blue-900">
                          <input
                            type="text"
                            value={row.cumul}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].cumul = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 font-semibold text-blue-900 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.radio}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].radio = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 text-right">
                          <input
                            type="text"
                            value={row.prof}
                            onChange={(e) => {
                              const newRows = [...state.ficheTronconRows];
                              newRows[idx].prof = e.target.value;
                              setState({ ...state, ficheTronconRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Carnet de Soudure Table */}
            {currentTemplate.id === "carnet_soudure" && (
              <div className="p-2 space-y-2">
                <span className="font-bold text-[10px] text-blue-800 block uppercase">Registre complet de soudage des tubes :</span>
                <table className="w-full text-left text-[8px] font-sans border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-1 border-r border-slate-200 text-center">Date Exec</th>
                      <th className="p-1 border-r border-slate-200 text-center">N° Soudure</th>
                      <th className="p-1 border-r border-slate-200 text-center">N° Tube</th>
                      <th className="p-1 border-r border-slate-200 text-center">Coulée</th>
                      <th className="p-1 border-r border-slate-200 text-right">Epaisseur</th>
                      <th className="p-1 border-r border-slate-200 text-center">Equipe 1er passe</th>
                      <th className="p-1 border-r border-slate-200 text-center">Equipe remplissage</th>
                      <th className="p-1 border-r border-slate-200 text-center">Radio 1°</th>
                      <th className="p-1 border-r border-slate-200 text-center">Radio 2°</th>
                      <th className="p-1 text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.carnetRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 font-medium text-slate-800">
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.date}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].date = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center font-bold">
                          <input
                            type="text"
                            value={row.s}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].s = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.tube}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].tube = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.coulee}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].coulee = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-right">
                          <input
                            type="text"
                            value={row.ep}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].ep = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.e1}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].e1 = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.e2}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].e2 = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.r1}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].r1 = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.r2}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].r2 = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 text-center text-green-700 font-bold">
                          <input
                            type="text"
                            value={row.fini}
                            onChange={(e) => {
                              const newRows = [...state.carnetRows];
                              newRows[idx].fini = e.target.value;
                              setState({ ...state, carnetRows: newRows });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px] font-bold text-green-700"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Balance des Matériels (Tubes) (IMP.INFR.28) */}
            {currentTemplate.id === "balance_materiels_tube" && (
              <table className="w-full text-left text-[9px] font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 leading-tight">
                    <th className="p-1 border-r border-slate-200 w-[20%]">Désignation</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Enlevée (ML)</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Reçue (ML)</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Posée (ML)</th>
                    <th className="p-1 border-r border-slate-200 text-right">Écart (ML)</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Réintégrer</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Rebutée</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Perdue</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Tolérée</th>
                    <th className="p-1 border-r border-slate-200 text-right">Défalquer</th>
                  </tr>
                </thead>
                <tbody>
                  {state.balanceRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 font-medium text-slate-800">
                      <td className="p-0.5 border-r border-slate-200 font-bold">
                        <input
                          type="text"
                          value={row.des}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].des = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qEnl}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].qEnl = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qRec}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].qRec = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right font-bold text-orange-900">
                        <input
                          type="text"
                          value={row.qPos}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].qPos = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-orange-900 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.eca}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].eca = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qRei}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].qRei = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qReb}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].qReb = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qPer}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].qPer = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.tol}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].tol = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 text-right font-bold text-blue-900">
                        <input
                          type="text"
                          value={row.defl}
                          onChange={(e) => {
                            const newRows = [...state.balanceRows];
                            newRows[idx].defl = e.target.value;
                            setState({ ...state, balanceRows: newRows });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-blue-900 text-[9px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Balance des Matériels (Accessoires) (IMP.INFR.29) */}
            {currentTemplate.id === "balance_materiels_accessoires" && (
              <table className="w-full text-left text-[9px] font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 leading-tight">
                    <th className="p-1 border-r border-slate-200 w-[25%]">Désignation Accessoire & Poste</th>
                    <th className="p-1 border-r border-slate-200 text-center">Unité</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Reçue</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Posée</th>
                    <th className="p-1 border-r border-slate-200 text-right">Écart</th>
                    <th className="p-1 border-r border-slate-200 text-right">Q. Réintégrer</th>
                    <th className="p-1 border-r border-slate-200 text-right">Total Rebuté & Perdu</th>
                    <th className="p-1 text-right">Quantité à défalquer</th>
                  </tr>
                </thead>
                <tbody>
                  {state.balanceAccessoiresRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 font-medium text-slate-800">
                      <td className="p-0.5 border-r border-slate-200 font-bold">
                        <input
                          type="text"
                          value={row.des}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].des = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-center">
                        <input
                          type="text"
                          value={row.uni}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].uni = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qRec}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].qRec = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qPos}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].qPos = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.eca}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].eca = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.qRei}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].qRei = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 border-r border-slate-200 text-right">
                        <input
                          type="text"
                          value={row.totRebPer}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].totRebPer = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                        />
                      </td>
                      <td className="p-0.5 text-right font-bold text-blue-900">
                        <input
                          type="text"
                          value={row.defl}
                          onChange={(e) => {
                            const r = [...state.balanceAccessoiresRows];
                            r[idx].defl = e.target.value;
                            setState({ ...state, balanceAccessoiresRows: r });
                          }}
                          className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-blue-900 text-[9px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Tests sur Touret FO (IMP.INFR.37) */}
            {currentTemplate.id === "touret_cable_fo" && (
              <div className="p-2 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-[10px] bg-slate-50 p-2 rounded">
                  {renderDottedField("Numéro de touret", state.numTouret, "numTouret")}
                  {renderDottedField("Longueur de touret", state.longueurTouret, "longueurTouret")}
                  {renderDottedField("Appareil de mesure", state.appareilMesure, "appareilMesure")}
                  {renderDottedField("Opérateur technique", state.operateur, "operateur")}
                </div>
                <table className="w-full text-left text-[9px] font-sans border-collapse mt-2">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-1 border-r border-slate-200 text-center">Couleur Fibre</th>
                      <th className="p-1 border-r border-slate-200 text-center">N° Fibre</th>
                      <th className="p-1 border-r border-slate-200 text-right">Atténuation à 1310nm</th>
                      <th className="p-1 text-right">Atténuation à 1550nm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.fibresAttenuations.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 font-medium text-slate-800">
                        <td className="p-0.5 border-r border-slate-200 text-center font-bold" style={{ color: row.couleur === "Orange" ? "#ff7a00" : row.couleur === "Vert" ? "#10b981" : row.couleur === "Bleu" ? "#2563eb" : "#78350f" }}>
                          <input
                            type="text"
                            value={row.couleur}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].couleur = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[9px]"
                            style={{ color: row.couleur === "Orange" ? "#ff7a00" : row.couleur === "Vert" ? "#10b981" : row.couleur === "Bleu" ? "#2563eb" : "#78350f" }}
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.no}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].no = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-right">
                          <input
                            type="text"
                            value={row.att1310}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].att1310 = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px]"
                          />
                        </td>
                        <td className="p-0.5 text-right font-semibold">
                          <input
                            type="text"
                            value={row.att1550}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].att1550 = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-right p-0.5 focus:outline-none focus:bg-orange-50/50 text-[9px] font-semibold"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Résultats Mesures Réflectomètre FO (IMP.INFR.40) */}
            {currentTemplate.id === "mesures_reflectometre_fo" && (
              <div className="p-2 space-y-2">
                <span className="font-bold text-[10px] text-blue-800 block uppercase">Mesures bi-directionnelles par réflectométrie (OTDR) :</span>
                <table className="w-full text-left text-[8px] font-sans border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-1 border-r border-slate-200 text-center" rowSpan={2}>Fibre</th>
                      <th className="p-1 border-r border-slate-200 text-center" colSpan={2}>Sens A → B (Perte dB)</th>
                      <th className="p-1 border-r border-slate-200 text-center" colSpan={2}>Sens B → A (Perte dB)</th>
                      <th className="p-1 border-r border-slate-200 text-center" rowSpan={2}>Distance (KM)</th>
                      <th className="p-1 border-r border-slate-200 text-center" rowSpan={2}>Épissures</th>
                      <th className="p-1 border-r border-slate-200 text-center" rowSpan={2}>Connec.</th>
                      <th className="p-1 text-center" rowSpan={2}>Verdict</th>
                    </tr>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="p-0.5 border-r border-slate-200 text-center">1310 nm</th>
                      <th className="p-0.5 border-r border-slate-200 text-center">1550 nm</th>
                      <th className="p-0.5 border-r border-slate-200 text-center">1310 nm</th>
                      <th className="p-0.5 border-r border-slate-200 text-center">1550 nm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.fibresAttenuations.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 font-medium text-slate-800">
                        <td className="p-0.5 border-r border-slate-200 text-center font-bold">
                          <input
                            type="text"
                            value={`${row.couleur} (N°${row.no})`}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              const match = e.target.value.match(/^(.*)\s*\(N°\s*(.*)\)$/);
                              if (match) {
                                r[idx].couleur = match[1].trim();
                                r[idx].no = match[2].trim();
                              } else {
                                r[idx].couleur = e.target.value;
                              }
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 font-bold text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.attAB1310 || "0.32 dB"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].attAB1310 = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.attAB1550 || "0.19 dB"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].attAB1550 = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.attBA1310 || "0.31 dB"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].attBA1310 = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.attBA1550 || "0.18 dB"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].attBA1550 = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.distance || "4.05 KM"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].distance = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.epissures || "02"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].epissures = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 border-r border-slate-200 text-center">
                          <input
                            type="text"
                            value={row.connec || "02"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].connec = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px]"
                          />
                        </td>
                        <td className="p-0.5 text-center text-green-700 font-bold">
                          <input
                            type="text"
                            value={row.verdict || "Accepté"}
                            onChange={(e) => {
                              const r = [...state.fibresAttenuations];
                              r[idx].verdict = e.target.value;
                              setState({ ...state, fibresAttenuations: r });
                            }}
                            className="w-full bg-transparent border-none text-center p-0.5 focus:outline-none focus:bg-orange-50/50 text-[8px] font-bold text-green-700"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Fiche de Raccordement (IMP.INFR.44) */}
            {currentTemplate.id === "fiche_raccordement" && (
              <div className="p-2 space-y-2 text-[10px]">
                <div className="border border-slate-300 rounded p-2 bg-slate-50 space-y-1.5 font-bold">
                  <span className="text-[11px] text-blue-900 block">SENS DU GAZ →</span>
                  <div className="flex items-center gap-1">
                    <span>RACCORDEMENT N° :</span>
                    <input
                      type="text"
                      defaultValue="R-04 : TR-08 / TR-09"
                      className="bg-transparent border-b border-dashed border-slate-300 font-bold text-slate-800 focus:outline-none w-48 print:border-none"
                    />
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-600">
                    <span className="flex items-center gap-1">
                      Soudé le :
                      <input
                        type="text"
                        defaultValue="12/06/2026"
                        className="bg-transparent border-b border-dashed border-slate-300 focus:outline-none w-20 text-slate-800 font-bold text-center print:border-none"
                      />
                    </span>
                    <span className="flex items-center gap-1">
                      Remblayé le :
                      <input
                        type="text"
                        defaultValue="14/06/2026"
                        className="bg-transparent border-b border-dashed border-slate-300 focus:outline-none w-20 text-slate-800 font-bold text-center print:border-none"
                      />
                    </span>
                  </div>
                </div>
                <div className="border border-dashed border-slate-300 p-2 rounded bg-slate-50 font-mono text-[9px] text-slate-500">
                  <p className="font-bold text-slate-700 text-center mb-1">SCHÉMA SYNOPTIQUE DU TIE-IN (Modifiable) :</p>
                  <textarea
                    defaultValue={`======= [ Tronçon 08 ] ======= ( SOUDURE RACCORDEMENT ) ======= [ Tronçon 09 ] =======\nPK 12+450 (Joint J-R04-A) ----------------------------------- PK 12+455 (Joint J-R04-B)`}
                    className="w-full h-12 bg-transparent text-slate-600 focus:outline-none text-center font-mono resize-none border-none p-1 focus:bg-orange-50/50"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-8 text-center text-[10px] font-bold text-slate-700">
            <div>
              <textarea
                value={state.signLeftTitle}
                onChange={(e) => setState({ ...state, signLeftTitle: e.target.value })}
                className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none uppercase"
              />
              <span className="text-[8px] text-slate-400 font-normal font-mono">{state.prestataire}</span>
            </div>
            <div>
              <textarea
                value={state.signRightTitle}
                onChange={(e) => setState({ ...state, signRightTitle: e.target.value })}
                className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none uppercase"
              />
              <span className="text-[8px] text-slate-400 font-normal font-mono">PD&I PIPELINE DESIGN & ISOMETRICS</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. CHECKLIST TEMPLATE (IMP.INFR.30 / 38 / 39) */}
      {currentTemplate.type === "checklist" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 border border-slate-200 rounded text-[11px]">
            {renderDottedField("Ouvrage concerné", state.ouvrage, "ouvrage")}
            {renderDottedField("Prestataire / Sous-traitant", state.prestataire, "prestataire")}
            {renderDottedField("Date d'inspection", state.dateJour, "dateJour")}
            {renderDottedField("Contrat de base N°", state.contratNo, "contratNo")}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mt-4 select-text">
            <table className="w-full text-left text-[10px] font-sans border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <th className="p-2 border-r border-slate-200 text-center w-12">N° Item</th>
                  <th className="p-2 border-r border-slate-200 w-[45%]">DESIGNATION DES CONTRÔLES / DOCUMENTS</th>
                  <th className="p-2 border-r border-slate-200 text-center">EXISTANT</th>
                  <th className="p-2 border-r border-slate-200 text-center">CONFORME</th>
                  <th className="p-2 text-center">OBSERVATIONS</th>
                </tr>
              </thead>
              <tbody>
                 {currentTemplate.id === "pv_controle_prestation" && state.controlePrestationItems.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 font-semibold text-slate-800">
                    <td className="p-1 border-r border-slate-200 text-center font-bold text-slate-400">
                      <input
                        type="text"
                        value={row.item}
                        onChange={(e) => {
                          const r = [...state.controlePrestationItems];
                          r[idx].item = e.target.value;
                          setState({ ...state, controlePrestationItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 font-bold text-slate-400 text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.desig}
                        onChange={(e) => {
                          const r = [...state.controlePrestationItems];
                          r[idx].desig = e.target.value;
                          setState({ ...state, controlePrestationItems: r });
                        }}
                        className="w-full bg-transparent border-none p-1 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 text-center text-green-700 font-bold">
                      <input
                        type="text"
                        value={row.existant}
                        onChange={(e) => {
                          const r = [...state.controlePrestationItems];
                          r[idx].existant = e.target.value;
                          setState({ ...state, controlePrestationItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 text-green-700 font-bold text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 text-center text-green-700 font-bold">
                      <input
                        type="text"
                        value={row.conf}
                        onChange={(e) => {
                          const r = [...state.controlePrestationItems];
                          r[idx].conf = e.target.value;
                          setState({ ...state, controlePrestationItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 text-green-700 font-bold text-[10px]"
                      />
                    </td>
                    <td className="p-1 text-slate-500 font-medium text-[9px]">
                      <input
                        type="text"
                        value={row.obs}
                        onChange={(e) => {
                          const r = [...state.controlePrestationItems];
                          r[idx].obs = e.target.value;
                          setState({ ...state, controlePrestationItems: r });
                        }}
                        className="w-full bg-transparent border-none p-1 focus:outline-none focus:bg-orange-50/50 text-slate-500 font-medium text-[9px]"
                      />
                    </td>
                  </tr>
                ))}

                {currentTemplate.id === "pv_reception_doc_fo" && state.receptionDocFoItems.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 font-semibold text-slate-800">
                    <td className="p-1 border-r border-slate-200 text-center font-bold text-slate-400">
                      <input
                        type="text"
                        value={row.item}
                        onChange={(e) => {
                          const r = [...state.receptionDocFoItems];
                          r[idx].item = e.target.value;
                          setState({ ...state, receptionDocFoItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 font-bold text-slate-400 text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.desig}
                        onChange={(e) => {
                          const r = [...state.receptionDocFoItems];
                          r[idx].desig = e.target.value;
                          setState({ ...state, receptionDocFoItems: r });
                        }}
                        className="w-full bg-transparent border-none p-1 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 text-center text-green-700 font-bold">
                      <input
                        type="text"
                        value={row.existant}
                        onChange={(e) => {
                          const r = [...state.receptionDocFoItems];
                          r[idx].existant = e.target.value;
                          setState({ ...state, receptionDocFoItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 text-green-700 font-bold text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 text-center text-green-700 font-bold">
                      <input
                        type="text"
                        value={row.conf}
                        onChange={(e) => {
                          const r = [...state.receptionDocFoItems];
                          r[idx].conf = e.target.value;
                          setState({ ...state, receptionDocFoItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 text-green-700 font-bold text-[10px]"
                      />
                    </td>
                    <td className="p-1 text-slate-500 font-medium text-[9px]">
                      <input
                        type="text"
                        value={row.obs}
                        onChange={(e) => {
                          const r = [...state.receptionDocFoItems];
                          r[idx].obs = e.target.value;
                          setState({ ...state, receptionDocFoItems: r });
                        }}
                        className="w-full bg-transparent border-none p-1 focus:outline-none focus:bg-orange-50/50 text-slate-500 font-medium text-[9px]"
                      />
                    </td>
                  </tr>
                ))}

                {currentTemplate.id === "pv_constat_telecom" && state.telecomItems.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 font-semibold text-slate-800">
                    <td className="p-1 border-r border-slate-200 text-center font-bold text-slate-400">
                      <input
                        type="text"
                        value={row.item}
                        onChange={(e) => {
                          const r = [...state.telecomItems];
                          r[idx].item = e.target.value;
                          setState({ ...state, telecomItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 font-bold text-slate-400 text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.desig}
                        onChange={(e) => {
                          const r = [...state.telecomItems];
                          r[idx].desig = e.target.value;
                          setState({ ...state, telecomItems: r });
                        }}
                        className="w-full bg-transparent border-none p-1 focus:outline-none focus:bg-orange-50/50 text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 text-center text-green-700 font-bold">
                      <input
                        type="text"
                        value={row.existant}
                        onChange={(e) => {
                          const r = [...state.telecomItems];
                          r[idx].existant = e.target.value;
                          setState({ ...state, telecomItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 text-green-700 font-bold text-[10px]"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 text-center text-green-700 font-bold">
                      <input
                        type="text"
                        value={row.conf}
                        onChange={(e) => {
                          const r = [...state.telecomItems];
                          r[idx].conf = e.target.value;
                          setState({ ...state, telecomItems: r });
                        }}
                        className="w-full bg-transparent border-none text-center p-1 focus:outline-none focus:bg-orange-50/50 text-green-700 font-bold text-[10px]"
                      />
                    </td>
                    <td className="p-1 text-slate-500 font-medium text-[9px]">
                      <input
                        type="text"
                        value={row.obs}
                        onChange={(e) => {
                          const r = [...state.telecomItems];
                          r[idx].obs = e.target.value;
                          setState({ ...state, telecomItems: r });
                        }}
                        className="w-full bg-transparent border-none p-1 focus:outline-none focus:bg-orange-50/50 text-slate-500 font-medium text-[9px]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {renderDottedTextarea("Conclusion et signature du protocole", state.commentaires, "commentaires")}

          <div className="grid grid-cols-2 gap-4 pt-6 text-center text-[10px] font-bold text-slate-700">
            <div>
              <textarea
                value={state.signLeftTitle}
                onChange={(e) => setState({ ...state, signLeftTitle: e.target.value })}
                className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none uppercase"
              />
              <input
                type="text"
                value={state.signLeftSub}
                onChange={(e) => setState({ ...state, signLeftSub: e.target.value })}
                className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
              />
            </div>
            <div>
              <textarea
                value={state.signRightTitle}
                onChange={(e) => setState({ ...state, signRightTitle: e.target.value })}
                className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none uppercase"
              />
              <input
                type="text"
                value={state.signRightSub}
                onChange={(e) => setState({ ...state, signRightSub: e.target.value })}
                className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. OPPOSITION TEMPLATES (IMP.INFR.20 / 21) */}
      {currentTemplate.type === "opposition" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-x-4 bg-slate-50 p-2 border border-slate-200 rounded text-[11px]">
            {renderDottedField("Wilaya", state.wilaya, "wilaya")}
            {renderDottedField("Daïra", state.daira, "daira")}
            {renderDottedField("Commune", state.commune, "commune")}
            {renderDottedField("Lieu et date", state.dateLieuOpposition, "dateLieuOpposition")}
          </div>

          <div className="border border-slate-200 p-4 rounded-xl bg-white mt-4 space-y-3">
            <h3 className="text-center font-extrabold text-xs uppercase text-red-900 border-2 border-red-200 p-2 bg-red-50/50 rounded tracking-wider">
              {currentTemplate.id === "pv_signalisation_opposition_travaux" ? "PV DE SIGNALISATION DE L'OPPOSITION (TRAVAUX)" : "PV DE LEVEE DE L'OPPOSITION (TRAVAUX)"}
            </h3>

            <div className="space-y-1.5 text-[11px] leading-relaxed">
              <p>
                Ce jour, il a été procédé au constat d'une opposition au niveau des emprises de la conduite de gaz :
              </p>
              <div className="grid grid-cols-2 gap-4">
                {renderDottedField("Du PK", "12+450", "pkStart")}
                {renderDottedField("Au PK", "13+100", "pkEnd")}
              </div>
              {renderDottedField("Assiette / Parcelle touchée", state.assiettePoste, "assiettePoste")}
              {renderDottedField("Opposant(s)", state.opposant, "opposant")}
            </div>

            {currentTemplate.id === "pv_signalisation_opposition_travaux" ? (
              <div className="space-y-2 mt-2">
                {renderDottedTextarea("Détail de l'opposition et anomalies constatées", state.oppositionObservations, "oppositionObservations")}
                <p className="text-[10px] text-red-800 font-bold bg-red-50 p-2 rounded border border-red-150 leading-relaxed">
                  L'entrepreneur est invité à suspendre les travaux de génie civil et de soudage sur cette parcelle en attendant la résolution juridique et le paiement de l'indemnité compensatoire agricole par l'expert.
                </p>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {renderDottedTextarea("Détails de l'accord amiable de levée d'opposition", state.leveeOppositionObs, "leveeOppositionObs")}
                <p className="text-[10px] text-green-900 font-bold bg-green-50 p-2 rounded border border-green-200 leading-relaxed">
                  La levée d'opposition est déclarée définitivement acquise. L'entrepreneur est autorisé à reprendre immédiatement l'ensemble des travaux de pose et de fouille sans restriction.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-8 text-center text-[10px] font-bold text-slate-700 border-t border-slate-100">
              <div>
                <textarea
                  value={state.signRightTitle}
                  onChange={(e) => setState({ ...state, signRightTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-2 mb-1 resize-none h-12 print:border-none uppercase"
                />
                <span className="block text-[8px] text-slate-400 font-normal">Signature</span>
              </div>
              <div>
                <textarea
                  value={state.signCenterTitle}
                  onChange={(e) => setState({ ...state, signCenterTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-2 mb-1 resize-none h-12 print:border-none uppercase"
                />
                <span className="block text-[8px] text-slate-400 font-normal">Signature</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. DYNAMIC TELECOM & GENERAL LIFE PVs (IMP.INFR.15 / 31 / 34 / 35 / 36) */}
      {currentTemplate.type === "telecom" && (
        <div className="space-y-4 text-left">
          {renderOfficialHeader(currentTemplate.procedure, currentTemplate.label.toUpperCase(), currentTemplate.code, "29/10/2024", currentTemplate.imp, currentTemplate.pageCount || "1 / 1")}
          
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 border border-slate-200 rounded text-[11px]">
            {renderDottedField("Ouvrage principal", state.ouvrage, "ouvrage")}
            {renderDottedField("Date d'édition", state.dateJour, "dateJour")}
            {renderDottedField("Prestataire / Réalisateur", state.prestataire, "prestataire")}
            {renderDottedField("Contrat de travaux", state.contratNo, "contratNo")}
          </div>

          <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-white mt-4 text-[11px] leading-relaxed">
            <h3 className="text-center font-extrabold text-xs uppercase text-slate-800 tracking-wider underline pb-1 mb-2">
              Rapport d'Essai et Synthèse Technique
            </h3>

            {/* PV de Mise en Gaz (IMP.INFR.15) */}
            {currentTemplate.id === "pv_mise_en_gaz" && (
              <div className="space-y-2">
                <p>Il a été procédé ce jour au balayage à l'azote et à la mise en gaz de la canalisation :</p>
                <div className="grid grid-cols-2 gap-x-4 border p-2 rounded bg-slate-50 text-[10px] font-semibold text-slate-600">
                  <span>Destination de l'ouvrage : {state.destinationOuvrage}</span>
                  <span>Pression finale de gaz : 70 bar</span>
                  <span>Terminal de départ : {state.terminalDepart}</span>
                  <span>Terminal d'arrivée : {state.terminalArrivee}</span>
                  <span>Réchauffeur de gaz : {state.rechauffeurMarque}</span>
                  <span>Index de compteur : {state.indexCompteur} m³</span>
                </div>
                {renderDottedTextarea("Paramètres et verdict de mise en service", state.verdictMiseEnGaz, "verdictMiseEnGaz")}
              </div>
            )}

            {/* Carnet de Chantier (Journal) (IMP.INFR.31) */}
            {currentTemplate.id === "carnet_chantier" && (
              <div className="space-y-3">
                <div className="bg-slate-50 p-2.5 border rounded border-slate-300 space-y-1.5 font-bold text-[10px]">
                  <p className="text-slate-800 font-extrabold uppercase text-[11px] tracking-wide text-orange-900">Journal de Chantier du {state.dateJour}</p>
                  <p className="text-slate-600">Conditions climatiques : Ensoleillé --- Température moyenne : 32 °C</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-500 font-semibold border-t pt-1.5 mt-1.5">
                    <span>Moyens humains : {state.moyensHumains}</span>
                    <span>Moyens matériels : {state.moyensMateriels}</span>
                  </div>
                </div>
                {renderDottedTextarea("Travaux et tâches physiques réalisés ce jour", state.commentaires, "commentaires")}
              </div>
            )}

            {/* Rapport Final de Fin d'Exécution (IMP.INFR.34) */}
            {currentTemplate.id === "rapport_final_execution" && (
              <div className="space-y-2">
                <p>
                  Le présent rapport récapitule la fin physique des travaux d'exécution du contrat <span className="font-bold">{state.contratNo}</span>.
                </p>
                <div className="bg-slate-50 p-2.5 border rounded space-y-1 text-[10px] text-slate-600 font-semibold">
                  <p>• Date contractuelle d'ODS : {state.dateODS}</p>
                  <p>• Date réelle de mise en gaz : {state.dateJour}</p>
                  <p>• Bilan physique des attachements : Entièrement validé à 100% sans réserves.</p>
                  <p>• Documents as-built remis : Plans de récolement, rapports de radiographie 100%, fiches d'étanchéité.</p>
                </div>
                {renderDottedTextarea("Recommandations et bilan final", state.verdictGenerique, "verdictGenerique")}
              </div>
            )}

            {/* PV Essai Mandrinage (IMP.INFR.35) */}
            {currentTemplate.id === "pv_essai_mandrinage" && (
              <div className="space-y-2">
                <p>
                  Il a été procédé au test mécanique de mandrinage des alvéoles de gaines PEHD pour s'assurer de l'absence d'écrasement de la gaine de fibre optique :
                </p>
                <div className="grid grid-cols-2 gap-4 border p-2.5 rounded bg-slate-50">
                  {renderDottedField("Diamètre gaine PEHD (mm)", "40 mm", "apNo")}
                  {renderDottedField("Gabarit de passage (mm)", "32 mm", "dateODS")}
                  <div className="col-span-2">{renderDottedField("Résultat du passage", "Réussi (Gabarit passé sans obstruction entre les chambres de tirage)", "commentaires")}</div>
                </div>
              </div>
            )}

            {/* PV Essai d'Étanchéité (IMP.INFR.36) */}
            {currentTemplate.id === "pv_essai_etancheite" && (
              <div className="space-y-2">
                <p>
                  Il a été procédé à l'essai d'étanchéité à la pression d'air comprimé de la gaine PEHD pour la fibre optique de sécurité :
                </p>
                <div className="grid grid-cols-2 gap-4 border p-2.5 rounded bg-slate-50 text-[10px]">
                  {renderDottedField("Pression de test initiale", "1.5 bar", "apNo")}
                  {renderDottedField("Durée du maintien", "30 minutes", "dateODS")}
                  {renderDottedField("Heure début test", "09:00", "arretNo")}
                  {renderDottedField("Heure fin test", "09:30", "repriseNo")}
                  <div className="col-span-2">{renderDottedField("Verdict final d'étanchéité gaine", "Parfaitement étanche (Baisse de pression nulle constatée)", "commentaires")}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-8 text-center text-[10px] font-bold text-slate-700 border-t border-slate-100">
              <div>
                <textarea
                  value={state.signLeftTitle}
                  onChange={(e) => setState({ ...state, signLeftTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signLeftSub}
                  onChange={(e) => setState({ ...state, signLeftSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
              <div>
                <textarea
                  value={state.signRightTitle}
                  onChange={(e) => setState({ ...state, signRightTitle: e.target.value })}
                  className="w-full text-center bg-transparent border-b border-dashed border-slate-200 focus:border-orange-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none uppercase"
                />
                <input
                  type="text"
                  value={state.signRightSub}
                  onChange={(e) => setState({ ...state, signRightSub: e.target.value })}
                  className="w-full text-center bg-transparent text-[8px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-orange-500 print:border-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
