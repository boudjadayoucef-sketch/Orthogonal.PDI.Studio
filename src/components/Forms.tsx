/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { 
  Printer, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Activity, 
  CheckCircle2,
  Award,
  ClipboardList,
  Search,
  FileDown
} from "lucide-react";
import defaultLogo from "../assets/images/pdi-logo-horizontal.png";
import TravauxForms, { TRAVAUX_TEMPLATES } from "./TravauxForms";
// PATCH 017K2
import { pdiAlert } from "../pdi/ui/PdiNotice";

type FormType = string;

const ETUDE_TEMPLATES = [
  { id: "levee_opposition", label: "PV de Levée de l'Opposition", code: "PR.ETU.02.V01", imp: "IMP.ETU.02", desc: "Procédure d'indemnisation" },
  { id: "signalisation_opposition", label: "PV de Signalisation de l'Opposition", code: "PR.ETU.02.V01", imp: "IMP.ETU.01", desc: "Procédure d'indemnisation" },
  { id: "etat_estimatif", label: "État Estimatif d'Indemnisation", code: "PR.ETU.02.V01", imp: "IMP.ETU.03", desc: "Procédure d'indemnisation" },
  { id: "constat_lieux_avant_travaux", label: "PV de Constat d'État des Lieux Avant Travaux", code: "PR.ETU.02.V01", imp: "IMP.ETU.04", desc: "Procédure d'indemnisation" },
  { id: "visite_trace", label: "PV de Visite de Tracé", code: "PR.ETU.01.V01", imp: "IMP.ETU.05", desc: "Procédure études exécution ouvrages TG" },
  { id: "approbation_etude_preliminaire", label: "PV d'Approbation de l'Étude Préliminaire", code: "PR.ETU.01.V01", imp: "IMP.ETU.06", desc: "Procédure études exécution ouvrages TG" },
  { id: "conformite_materiel_topo", label: "PV de Conformité Matériel Topographique", code: "PR.ETU.01.V01", imp: "IMP.ETU.07", desc: "Procédure études exécution ouvrages TG" },
  { id: "qualification_ressource_humaine", label: "PV de Qualification de la Ressource Humaine", code: "PR.ETU.01.V01", imp: "IMP.ETU.08", desc: "Procédure études exécution ouvrages TG" },
  { id: "planification_prestation_etude", label: "PV de Planification de la Prestation Étude", code: "PR.ETU.01.V01", imp: "IMP.ETU.09", desc: "Procédure études exécution ouvrages TG" },
  { id: "approbation_etude_execution", label: "PV d'Approbation de l'Étude d'Exécution", code: "PR.ETU.01.V01", imp: "IMP.ETU.10", desc: "Procédure études exécution ouvrages TG" },
  { id: "collecte_information", label: "Fiche de Collecte d'Informations", code: "PR.ETU.03 V00", imp: "IMP.ETU.12", desc: "Procédure études d'exécution des projets télécom" }
];



export default function Forms() {
  const [formType, setFormType] = useState<FormType>("levee_opposition");
  const [searchTerm, setSearchTerm] = useState("");

  const [headerProcedure, setHeaderProcedure] = useState("");
  const [headerTitle, setHeaderTitle] = useState("");
  const [headerCode, setHeaderCode] = useState("");
  const [headerDate, setHeaderDate] = useState("");
  const [headerImp, setHeaderImp] = useState("");
  const [headerPage, setHeaderPage] = useState("");
  const [lastFormType, setLastFormType] = useState("");

  const currentTemplate = ETUDE_TEMPLATES.find(t => t.id === formType);
  if (currentTemplate && formType !== lastFormType) {
    setHeaderProcedure(currentTemplate.desc.toUpperCase());
    setHeaderTitle(currentTemplate.label.toUpperCase());
    setHeaderCode(currentTemplate.code);
    setHeaderDate("07.10.2024");
    setHeaderImp(currentTemplate.imp);
    setHeaderPage("1 / 1");
    setLastFormType(formType);
  }

  // Common State for Indemnisation & Opposition PVs
  const [indemnisations, setIndemnisations] = useState({
    wilaya: "M'Sila",
    daira: "Sidi Aïssa",
    commune: "Sidi Aïssa",
    dateLieu: "Sidi Aïssa, le 13/07/2026",
    objet: "Réalisation du gazoduc alimentant la localité de Sidi Aïssa, de l'antenne et du poste",
    pkStart: "12+450",
    pkEnd: "13+100",
    opposant: "M. Merbah Ahmed, né le 12/04/1965, exploitant agricole",
    observations: "Après concertation avec l'expert et le propriétaire terrien, l'opposant accepte de lever l'opposition contre une réévaluation de l'indemnisation des oliviers touchés par le tracé. L'entreprise est autorisée à reprendre les travaux de terrassement sur cette section.",
    
    // State unique to Etat Estimatif
    estimNum: "2026/EE-089",
    sommeTotal: "320 000.00",
    indemniteDueA: "M. Merbah Ahmed",
    demeurant: "Sidi Aïssa, Wilaya de M'Sila",
    communeOuvrage: "Sidi Aïssa",
    constatPvNumberDate: "PV de constat n° 12 du 06/07/2026",
    chantierOuvrage: "Antenne Gaz Sidi Aïssa 10\" DP 70 bar",
    estimRows: [
      { parcelNo: "45", superficie: "350 m²", nature: "Perte de récolte céréalière", elements: "Superficie emprise temporaire", evaluation: "120 000.00" },
      { parcelNo: "45", superficie: "4 arbres", nature: "Arrachage d'oliviers (productifs)", elements: "Barème d'indemnisation agricole", evaluation: "200 000.00" }
    ],
    mrName: "Merbah Ahmed",
    cniPc: "CNI n° 093847291",

    // State unique to Constat des lieux Avant travaux
    constatNum: "2026/CL-034",
    antenne: "Gazoduc 12\" Alimentation Zone Industrielle",
    ownerName: "M. Khelifi Slimane",
    ownerAddress: "Cité des Jardins, Khemis El Khechna",
    ownerCardId: "12-094832-B",
    operatorName: "M. Khelifi Slimane",
    operatorAddress: "Cité des Jardins, Khemis El Khechna",
    operatorCardId: "12-094832-B",
    constatRows: [
      { planNo: "PL-KK-02", parcelNo: "114", length: "120 m", emprise: "15 m", state: "Terrain agricole planté de vigne de table (environ 45 pieds touchés), présence d'une clôture en grillage.", observations: "Clôture à rétablir après passage." }
    ],
    faitA: "Khemis El Khechna",
    faitLe: "2026-07-13",

    // Dynamically editable content and signatories
    leveeOppositionIntro: "Ce jour il a été procédé a la levée de l’opposition à la construction du gazoduc alimentant la localité suscitée en objet, localisé comme suite :",
    leveeOppositionSignLeft: "P/PD&I",
    leveeOppositionSignRight: "P/ L’EXPERT",
    signalisationOppositionIntro: "Ce jour il a été signalé l’opposition à la construction du gazoduc alimentant la localité suscitée en objet, localisé comme suite :",
    signalisationOppositionSignLeft: "P/PD&I",
    signalisationOppositionSignRight: "P/ L’EXPERT",
    etatEstimatifIntro: "Déclare accepter pour solde de tout compte le montant de l’indemnité ci-dessus indiquée et renoncer à toute réclamation ultérieure pour dépréciation de sa propriété.",
    estimSignLeftTitle: "L'INTERESSE",
    estimSignLeftSub: "(LEGALISATION DE LA SIGNATURE PAR L'APC)",
    estimSignRightTitle: "L'EXPERT",
    estimSignRightSub: "Signature & Cachet",
    constatIntro: "NB : L’exploitant a été identifié suite à ses déclarations qui seront confirmées après présentation des documents. En foi de quoi nous avons dressé le présent procès-verbal en triple expédition et invité l’intéressé à signer avec nous.",
    constatSignLeftTitle: "LE REPRESENTANT STG",
    constatSignLeftSub: "(Contrôleur)",
    constatSignMiddleTitle: "L'EXPERT",
    constatSignMiddleSub: "Signature & Cachet",
    constatSignRightTitle: "L'INTERESSE",
    constatSignRightSub: "(LEGALISATION APC)"
  });

  // Common State for Study/Ouvrage PVs (visite_trace, approbation_etude, conformite_topo, etc.)
  const [etudeOuvrage, setEtudeOuvrage] = useState({
    bureauEtudes: "EURL ALGERIE ENGINEERING STUDY",
    ouvrage: "Gazoduc 20\" - Extension Zone Nord de Sétif",
    longueur: "18.5 km",
    commandeNo: "CMD/ENG/042-2026",
    obsBureauEtudes: "Le bureau d'études s'engage à lever toutes les réserves signalées sous huitaine et à intégrer les modifications dans le dossier APD.",
    
    // Visite Trace
    visiteStart: "2026-07-01",
    visiteEnd: "2026-07-03",
    visiteObsRepresentant: "Le représentant de l'Ingénierie valide le tracé proposé sous réserve d'éviter la zone boisée proche du PK 8+200 et de respecter un parallélisme de 10m avec la ligne haute tension existante.",

    // Approbation Etude Preliminaire
    prelimControle: "Rapport d'avant-projet sommaire",
    prelimStart: "2026-07-01",
    prelimEnd: "2026-07-03",
    prelimConstat: "Le dossier d'étude préliminaire comprend les plans de situation, les profils en long préliminaires, et l'étude d'impact environnemental. Les variantes ont été correctement analysées.",
    prelimReserves: "1. Présenter la note de calcul hydraulique révisée.\n2. Intégrer les avis d'opposition préliminaires signalés par la commune de Sétif.",

    // Conformite Matériel Topographique
    topoAppareil: "Station Totale Électronique & Récepteur GNSS RTK",
    topoMarque: "Leica Geosystems",
    topoSerie: "TS16 / GS18 T - N° de Série 849302-39485",
    topoDocs: "Certificat d'étalonnage constructeur, fiches techniques du fabricant.",
    topoCertificat: "Certificat Leica n° LC-2025-9834 délivré le 12/01/2026, valable jusqu'au 11/01/2027.",
    topoReserves: "Aucune réserve. Le matériel présente une précision planimétrique et altimétrique conforme aux exigences du cahier des charges.",

    // Qualification Ressource Humaine
    rhDateSortie: "2026-07-13",
    rhRows: [
      { nomPrenom: "M. Benyahia Karim", qualite: "Ingénieur Topographe Principal (Chef de brigade)", pieceRemise: "CV, Diplôme d'Ingénieur de l'ENSH, Attestation CNAS" },
      { nomPrenom: "M. Ziani Abderrezak", qualite: "Technicien Supérieur Topographe", pieceRemise: "Diplôme TS de l'IAP, CV, Carte professionnelle" },
      { nomPrenom: "M. Belhadj Omar", qualite: "Ingénieur d'études pipeline", pieceRemise: "CV, Diplôme d'Ingénieur USTHB" }
    ],

    // Planification Prestation Etude
    planDemarrage: "2026-07-15",
    planPrelimStart: "2026-07-15",
    planPrelimEnd: "2026-08-05",
    planVerifStart: "2026-08-06",
    planVerifEnd: "2026-08-15",
    planExecStart: "2026-08-16",
    planExecEnd: "2026-09-30",

    // Approbation Etude Execution
    execControle: "Dossier d'Exécution Final (Plan, Profils, Calculs mécaniques)",
    execStart: "2026-09-20",
    execEnd: "2026-09-25",
    execConstat: "Le dossier d'exécution est complet et conforme aux normes d'ingénierie ASME B31.8 et aux règles de PD&I. Toutes les réserves de la phase préliminaire ont été levées.",
    execReserves: "1. Transmettre 3 exemplaires physiques d'exécution tamponnés 'Bon pour Construction'.\n2. Fournir les fichiers d'implantation géospatiale Shapefile (GIS).",

    // Dynamically editable content and signatories
    signLeft: "Visa Maître d'Ouvrage / Ingénierie",
    signRight: "Visa du Bureau d'études",
    rhIntro: "Nous reconnaissons après avoir vérifié sur site les pièces remises par les représentants du prestataire que les ressources mobilisées sont conformes aux exigences contractuelles.",
    planificationIntro: "L’étude de tracée sera réalisée suivant le planning ci-dessous :"
  });

  // Collecte Information (Télécom) State
  const [telecom, setTelecom] = useState({
    direction: "Engineering & Construction Department",
    district: "Regional Operations Center",
    ouvrage: "Liaison Fibre Optique de sécurité pour Gazoduc 28\" Alger-Est",
    maitreOuvrage: "PD&I PIPELINE DESIGN & ISOMETRICS",
    lieuDate: "Alger, le 13/07/2026",
    siteNom: "Poste de Coupure PC 14 - Réseau de sécurité",
    siteAdresse: "Oued Smar, Alger",
    siteRepresentant: "Project Engineering Manager",
    siteDateVisite: "2026-07-10",
    canalisationType: "Fourreau PEHD pour Fibre Optique adjacent au Gazoduc",
    canalisationMateriau: "Polyéthylène Haute Densité (PEHD)",
    canalisationDiametre: "40 mm",
    canalisationProfondeur: "1.20 m",
    canalisationPression: "N/A (Câble Télécom)",
    fluideType: "Aucun (Fibre Optique de Télécommunication / Téléconduite)",
    fluideAutres: "Signaux optiques de sécurité et mesures de téléconduite",
    distanceMin: "0.50 m par rapport à la génératrice supérieure de la conduite de gaz",
    restrictionsTravaux: "Interdiction d'engins mécaniques lourds à moins de 2 mètres sans surveillance.",
    reglesSecurite: "Travaux de terrassement manuel obligatoires aux abords immédiats. Présence obligatoire d'un superviseur PD&I.",
    commentaires: "La collecte d'information valide le raccordement télécom du poste PC 14. Les distances de sécurité avec le gazoduc principal de 28\" adjacent sont respectées.",

    // Dynamically editable content and signatories
    signLeftTitle: "P/ Maître de l'Ouvrage\nDirection de Projet PD&I",
    signRightTitle: "P/ Le Prestataire",
    signRightSub: "Signature & Cachet"
  });

  // State for PV de Qualification de Soudeur (Processus Travaux)
  const [soudeur, setSoudeur] = useState({
    pvNumber: "WQT-2026-09",
    welderName: "Kamel Benali",
    welderId: "W-7648-ST",
    welderStamp: "KB-09",
    weldingProcess: "Arc Manuel (111)",
    electrodesBrandType: "Cellulosique (E6010) + Basique (E7018)",
    diameterPipe: "323.8 mm (12\")",
    thicknessPipe: "8.0 mm",
    weldingPosition: "En position (5G) - Technique Montante",
    testDate: "2026-07-06",
    inspectorName: "M. Ould Kablia (Expert M.O.)",
    resultsTraction: "Conforme (Résistance > 450 Mpa - Rupture hors soudure)",
    resultsPliage: "Aucune fissure après pliage endroit et envers à 180°",
    resultsDurete: "Conforme (Dureté maximale < 350 HV5)",
    resultsRadio: "100% Acceptable selon critères de l'Annexe 28",
    observationsGeneral: "Soudure de qualification acceptée. Certificat délivré pour une durée d'un an."
  });

  // State for PV d'Épreuve Hydrostatique (Processus Travaux)
  const [epreuveHydro, setEpreuveHydro] = useState({
    pvNumber: "PV-EH-2026-004",
    projectName: "Gazoduc 28\" - Alimentation Centrale de Jijel",
    testDate: "2026-07-10",
    inspectorName: "H. Benslimane (Inspecteur Principal VÉRITAL)",
    contractorName: "COSIDER Canalisation",
    sectionTested: "Tronçon 01 : PK 0+000 au PK 12+500",
    testFluid: "Eau claire inhibée",
    designPressure: "70 bar",
    testPressure: "105 bar (1.5 x DP)",
    duration: "24 Heures (Résistance) + 24 Heures (Étanchéité)",
    verdictResistance: "Réussie (Baisse de pression nulle, corrigée à 105.0 bar)",
    verdictEtancheite: "Réussie (Absence totale de suintement ou fuite sur la ligne)",
    generalVerdict: "Le tronçon éprouvé est déclaré étanche, conforme au Fascicule 7 et apte au service continu."
  });

  // Table add/remove row handlers
  const handleAddEstimRow = () => {
    setIndemnisations(prev => ({
      ...prev,
      estimRows: [...prev.estimRows, { parcelNo: "", superficie: "", nature: "", elements: "", evaluation: "" }]
    }));
  };

  const handleRemoveEstimRow = (index: number) => {
    setIndemnisations(prev => ({
      ...prev,
      estimRows: prev.estimRows.filter((_, i) => i !== index)
    }));
  };

  const handleAddConstatRow = () => {
    setIndemnisations(prev => ({
      ...prev,
      constatRows: [...prev.constatRows, { planNo: "", parcelNo: "", length: "", emprise: "", state: "", observations: "" }]
    }));
  };

  const handleRemoveConstatRow = (index: number) => {
    setIndemnisations(prev => ({
      ...prev,
      constatRows: prev.constatRows.filter((_, i) => i !== index)
    }));
  };

  const handleAddRhRow = () => {
    setEtudeOuvrage(prev => ({
      ...prev,
      rhRows: [...prev.rhRows, { nomPrenom: "", qualite: "", pieceRemise: "" }]
    }));
  };

  const handleRemoveRhRow = (index: number) => {
    setEtudeOuvrage(prev => ({
      ...prev,
      rhRows: prev.rhRows.filter((_, i) => i !== index)
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportWord = () => {
    const previewEl = document.getElementById("forms_printable_preview");
    if (!previewEl) {
      void pdiAlert("Impossible de trouver le document à exporter.");
      return;
    }
    
    // Find the actual content card (the first child div)
    const cardEl = previewEl.firstElementChild as HTMLElement;
    if (!cardEl) return;

    // Clone the element so we don't modify the live document on screen
    const clone = cardEl.cloneNode(true) as HTMLElement;

    // Replace inputs and textareas with their current values
    // To ensure we get the latest values, we grab them from the original DOM element
    const originalInputs = cardEl.querySelectorAll("input, textarea");
    const clonedInputs = clone.querySelectorAll("input, textarea");

    originalInputs.forEach((origInput, idx) => {
      const clonedInput = clonedInputs[idx] as HTMLElement;
      if (!clonedInput) return;

      let textVal = "";
      if (origInput instanceof HTMLInputElement) {
        if (origInput.type === "checkbox") {
          textVal = origInput.checked ? " [X] " : " [ ] ";
        } else {
          textVal = origInput.value;
        }
      } else if (origInput instanceof HTMLTextAreaElement) {
        textVal = origInput.value;
      }

      const span = document.createElement("span");
      span.textContent = textVal;
      span.style.fontWeight = "bold";
      span.style.color = "#1e3a8a"; // nice deep blue for export visibility
      span.style.borderBottom = "1.5px solid #cbd5e1";
      span.style.padding = "0 4px";
      span.style.display = "inline-block";

      if (clonedInput.parentNode) {
        clonedInput.parentNode.replaceChild(span, clonedInput);
      }
    });

    // Remove any elements that shouldn't appear in the print/export
    const printHiddenEls = clone.querySelectorAll(".print\\:hidden, button");
    printHiddenEls.forEach(el => el.remove());

    const htmlContent = clone.innerHTML;

    // Get a nice filename based on the current form type
    const templateName = ETUDE_TEMPLATES.find(t => t.id === formType)?.label || 
                         TRAVAUX_TEMPLATES.find(t => t.id === formType)?.label || 
                         "Proces_Verbal";
    const safeFilename = `PV_${templateName.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.doc`;

    const documentTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${templateName}</title>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.5;
            color: #1e293b;
            padding: 40px;
          }
          h1, h2, h3, h4 {
            color: #1e3a8a;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #94a3b8;
            padding: 8px 12px;
            font-size: 10pt;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #1e293b;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
          .border-2 { border: 2px solid #0f172a; }
          .border-r-2 { border-right: 2px solid #0f172a; }
          .border-b { border-bottom: 1px solid #cbd5e1; }
          .border-t { border-top: 1px solid #cbd5e1; }
          .p-1 { padding: 4px; }
          .p-1.5 { padding: 6px; }
          .p-2 { padding: 8px; }
          .p-3 { padding: 12px; }
          .p-4 { padding: 16px; }
          .m-2 { margin: 8px; }
          .m-4 { margin: 16px; }
          .w-full { width: 100%; }
        </style>
      </head>
      <body>
        <div style="max-width: 800px; margin: 0 auto;">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([documentTemplate], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper renderers for Dotted lines / Fields to keep code extremely concise and light on tokens!
  const renderDottedField = (label: string, value: string, onChange: (val: string) => void, placeholder = "........................") => (
    <div className="flex items-baseline gap-2 text-xs leading-relaxed my-2">
      <span className="font-bold text-slate-700 whitespace-nowrap">{label} :</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-slate-800 font-semibold"
        placeholder={placeholder}
      />
    </div>
  );

  const renderDottedTextarea = (label: string, value: string, onChange: (val: string) => void, placeholder = "........................") => (
    <div className="text-xs leading-relaxed my-3">
      <span className="font-bold text-slate-700 block mb-1">{label} :</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none py-1 px-1 text-slate-800 font-semibold resize-none h-16 leading-relaxed"
        placeholder={placeholder}
      />
    </div>
  );

  const renderOfficialHeader = (procedure: string, title: string, code: string, date: string, imp: string, page: string) => (
    <div className="border-2 border-slate-900 w-full text-slate-900 mb-6 font-sans text-[11px] leading-tight print:mb-4">
      <div className="flex h-24">
        {/* Left column: Logo */}
        <div className="w-[18%] border-r-2 border-slate-900 flex flex-col items-center justify-center p-1 bg-white select-none">
          <img 
            src={defaultLogo} 
            alt="PD&I Logo" 
            className="h-20 w-20 max-h-full max-w-full object-contain aspect-square"
            onError={(e) => {
              e.currentTarget.src = "/pdi-logo-horizontal.png";
            }}
          />
        </div>

        {/* Middle column: Title */}
        <div className="w-[57%] border-r-2 border-slate-900 flex flex-col justify-between py-1 px-3 text-center bg-white">
          <div className="font-extrabold text-[12px] uppercase text-slate-800 tracking-wide pt-1 select-none">
            PD&I Pipeline Design & Isometrics
          </div>
          <input
            type="text"
            value={headerProcedure}
            onChange={(e) => setHeaderProcedure(e.target.value)}
            className="w-full text-center bg-transparent border-t border-b border-dashed border-slate-300 text-[9px] uppercase text-slate-600 font-mono font-bold leading-tight py-1 focus:border-blue-500 focus:outline-none print:border-none"
          />
          <input
            type="text"
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            className="w-full text-center bg-transparent border-b border-dashed border-slate-300 text-[12px] uppercase text-blue-900 font-black leading-snug py-1 focus:border-blue-500 focus:outline-none print:border-none"
          />
        </div>

        {/* Right column: Metadata table */}
        <div className="w-[25%] flex flex-col justify-between bg-white text-[9px] font-semibold">
          <div className="flex border-b border-slate-900 h-1/4 items-center px-2">
            <span className="font-bold w-12 border-r border-slate-300 mr-2 select-none">CODE</span>
            <input
              type="text"
              value={headerCode}
              onChange={(e) => setHeaderCode(e.target.value)}
              className="flex-1 bg-transparent border-b border-dashed border-slate-300 font-mono text-slate-800 px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
          <div className="flex border-b border-slate-900 h-1/4 items-center px-2">
            <span className="font-bold w-12 border-r border-slate-300 mr-2 select-none">DATE</span>
            <input
              type="text"
              value={headerDate}
              onChange={(e) => setHeaderDate(e.target.value)}
              className="flex-1 bg-transparent border-b border-dashed border-slate-300 font-mono text-slate-800 px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
          <div className="flex border-b border-slate-900 h-1/4 items-center px-2 text-slate-850 font-mono font-bold justify-center bg-slate-50">
            <input
              type="text"
              value={headerImp}
              onChange={(e) => setHeaderImp(e.target.value)}
              className="w-full text-center bg-transparent border-b border-dashed border-slate-300 font-mono text-slate-850 font-bold px-0.5 focus:border-blue-500 focus:outline-none print:border-none"
            />
          </div>
          <div className="flex h-1/4 items-center px-2">
            <span className="font-bold w-12 border-r border-slate-300 mr-2 select-none">PAGE</span>
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

  // Filters based on search term
  const filteredEtude = ETUDE_TEMPLATES.filter(
    t => t.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
         t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
         t.imp.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTravaux = TRAVAUX_TEMPLATES.filter(
    t => t.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
         t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
         t.imp.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="forms_module_container" className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Sidebar - Hidden during printing */}
      <div id="forms_input_sidebar" className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Générateur de Procès-Verbal</h2>
          <p className="text-sm text-slate-500">Sélectionnez la section pour générer et éditer un PV officiel de PD&I en direct.</p>
        </div>

        {/* Real-time Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un PV (titre, code, IMP...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* PV Template Selector Buttons */}
        <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 scrollbar-none">
          {filteredEtude.length > 0 && (
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2.5">PROCESSUS ÉTUDE ({filteredEtude.length})</span>
              <div className="space-y-1.5">
                {filteredEtude.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setFormType(t.id as FormType)}
                    className={`w-full flex flex-col p-2.5 rounded-xl text-left border transition-all ${
                      formType === t.id 
                        ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs" 
                        : "text-slate-600 hover:bg-slate-50 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className={`w-3.5 h-3.5 shrink-0 ${formType === t.id ? "text-blue-600" : "text-slate-400"}`} />
                      <span className="text-[11px] font-bold leading-snug">{t.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 pl-5.5 text-[9px] text-slate-400 font-medium">
                      <span className="bg-slate-100 px-1 py-0.2 rounded text-slate-500 font-mono font-bold">{t.imp}</span>
                      <span className="font-mono text-slate-400">{t.code}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredTravaux.length > 0 && (
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2.5">PROCESSUS TRAVAUX ({filteredTravaux.length})</span>
              <div className="space-y-1.5">
                {filteredTravaux.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setFormType(t.id as FormType)}
                    className={`w-full flex flex-col p-2.5 rounded-xl text-left border transition-all ${
                      formType === t.id 
                        ? "bg-orange-50 text-orange-700 border-orange-200 shadow-xs" 
                        : "text-slate-600 hover:bg-slate-50 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Award className={`w-3.5 h-3.5 shrink-0 ${formType === t.id ? "text-orange-600" : "text-slate-400"}`} />
                      <span className="text-[11px] font-bold leading-snug">{t.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 pl-5.5 text-[9px] text-slate-400 font-medium">
                      <span className="bg-slate-100 px-1 py-0.2 rounded text-slate-500 font-mono font-bold">{t.imp}</span>
                      <span className="font-mono text-slate-400">{t.code}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredEtude.length === 0 && filteredTravaux.length === 0 && (
            <div className="py-6 text-center text-slate-400 text-xs font-semibold">
              Aucun procès-verbal trouvé.
            </div>
          )}
        </div>

        {/* Live Editing Info Banner */}
        <div className="border-t border-slate-100 pt-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-blue-700">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              Saisie en Direct sur le PV :
            </p>
            <p className="leading-relaxed">
              Pour votre confort, le remplissage s'effectue désormais <strong>directement dans le document officiel à droite</strong>.
            </p>
            <p className="leading-relaxed">
              Cliquez sur n'importe quel champ en pointillés sur le PV pour le modifier en temps réel. Les pointillés s'effaceront automatiquement à l'impression.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 print:hidden">
          <button
            id="btn_print_pv_officiel"
            onClick={handlePrint}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" /> Imprimer le PV Officiel
          </button>

          <button
            id="btn_export_pv_word"
            onClick={handleExportWord}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <FileDown className="w-5 h-5" /> Exporter au format Word (.doc)
          </button>
        </div>
      </div>

      {/* Printable Sheet Preview - Interactive inline input fields */}
      <div id="forms_printable_preview" className="xl:col-span-2 bg-slate-100 rounded-2xl p-4 md:p-8 flex justify-center items-start overflow-x-auto print:bg-white print:p-0">
        <div className="bg-white w-[793px] min-h-[1120px] p-12 shadow-md border border-slate-200 rounded-lg flex flex-col justify-between text-slate-800 font-sans print:shadow-none print:border-none print:w-full print:p-0 print:m-0">
          
          {/* PV Rendering Router */}
          <div className="flex-1">
            {/* 1. PV LEVEE DE L'OPPOSITION */}
            {formType === "levee_opposition" && (
              <div className="space-y-5 text-left">
                {renderOfficialHeader("PROCEDURE D'INDEMNISATION", "PROCES – VERBAL DE LEVEE DE L'OPPOSITION", "PR.ETU.02.V01", "07.10.2024", "IMP.ETU.02", "1 / 1")}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {renderDottedField("Wilaya", indemnisations.wilaya, val => setIndemnisations({ ...indemnisations, wilaya: val }))}
                    {renderDottedField("Daira", indemnisations.daira, val => setIndemnisations({ ...indemnisations, daira: val }))}
                    {renderDottedField("Commune", indemnisations.commune, val => setIndemnisations({ ...indemnisations, commune: val }))}
                  </div>
                  <div className="text-right">
                    {renderDottedField("Lieu et date", indemnisations.dateLieu, val => setIndemnisations({ ...indemnisations, dateLieu: val }))}
                  </div>
                </div>

                <div className="mt-4">
                  {renderDottedTextarea("Objet : Réalisation du gazoduc alimentant la localité de", indemnisations.objet, val => setIndemnisations({ ...indemnisations, objet: val }))}
                </div>

                <textarea
                  value={indemnisations.leveeOppositionIntro}
                  onChange={(e) => setIndemnisations({ ...indemnisations, leveeOppositionIntro: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none text-xs leading-relaxed font-semibold text-slate-800 mt-4 resize-none h-12 print:border-none"
                />

                <div className="flex gap-6">
                  <div className="w-1/2">{renderDottedField("- Du PK", indemnisations.pkStart, val => setIndemnisations({ ...indemnisations, pkStart: val }))}</div>
                  <div className="w-1/2">{renderDottedField("au PK", indemnisations.pkEnd, val => setIndemnisations({ ...indemnisations, pkEnd: val }))}</div>
                </div>

                {renderDottedTextarea("- Opposant", indemnisations.opposant, val => setIndemnisations({ ...indemnisations, opposant: val }))}
                {renderDottedTextarea("- Observations", indemnisations.observations, val => setIndemnisations({ ...indemnisations, observations: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-black text-slate-900 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={indemnisations.leveeOppositionSignLeft}
                      onChange={(e) => setIndemnisations({ ...indemnisations, leveeOppositionSignLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={indemnisations.leveeOppositionSignRight}
                      onChange={(e) => setIndemnisations({ ...indemnisations, leveeOppositionSignRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. PV SIGNALISATION DE L'OPPOSITION */}
            {formType === "signalisation_opposition" && (
              <div className="space-y-5 text-left">
                {renderOfficialHeader("PROCEDURE D'INDEMNISATION", "PROCES – VERBAL DE SIGNALISATION DE L'OPPOSITION", "PR.ETU.02.V01", "07.10.2024", "IMP.ETU.01", "1 / 1")}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {renderDottedField("Wilaya", indemnisations.wilaya, val => setIndemnisations({ ...indemnisations, wilaya: val }))}
                    {renderDottedField("Daira", indemnisations.daira, val => setIndemnisations({ ...indemnisations, daira: val }))}
                    {renderDottedField("Commune", indemnisations.commune, val => setIndemnisations({ ...indemnisations, commune: val }))}
                  </div>
                  <div className="text-right">
                    {renderDottedField("Lieu et date", indemnisations.dateLieu, val => setIndemnisations({ ...indemnisations, dateLieu: val }))}
                  </div>
                </div>

                <div className="mt-4">
                  {renderDottedTextarea("Objet : Réalisation du gazoduc alimentant la localité de", indemnisations.objet, val => setIndemnisations({ ...indemnisations, objet: val }))}
                </div>

                <textarea
                  value={indemnisations.signalisationOppositionIntro}
                  onChange={(e) => setIndemnisations({ ...indemnisations, signalisationOppositionIntro: e.target.value })}
                  className="w-full bg-transparent border-b border-dashed border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none text-xs leading-relaxed font-semibold text-slate-800 mt-4 resize-none h-12 print:border-none"
                />

                <div className="flex gap-6">
                  <div className="w-1/2">{renderDottedField("- Du PK", indemnisations.pkStart, val => setIndemnisations({ ...indemnisations, pkStart: val }))}</div>
                  <div className="w-1/2">{renderDottedField("au PK", indemnisations.pkEnd, val => setIndemnisations({ ...indemnisations, pkEnd: val }))}</div>
                </div>

                {renderDottedTextarea("- Opposant", indemnisations.opposant, val => setIndemnisations({ ...indemnisations, opposant: val }))}
                {renderDottedTextarea("- Observations", indemnisations.observations, val => setIndemnisations({ ...indemnisations, observations: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-black text-slate-900 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={indemnisations.signalisationOppositionSignLeft}
                      onChange={(e) => setIndemnisations({ ...indemnisations, signalisationOppositionSignLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={indemnisations.signalisationOppositionSignRight}
                      onChange={(e) => setIndemnisations({ ...indemnisations, signalisationOppositionSignRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. ETAT ESTIMATIF */}
            {formType === "etat_estimatif" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE D'INDEMNISATION", "ETAT ESTIMATIF", "PR.ETU.02.V01", "07.10.2024", "IMP.ETU.03", "1 / 1")}
                
                <div className="flex justify-between items-center bg-slate-50 p-2 border border-slate-200 rounded">
                  <div className="w-1/3">{renderDottedField("N°", indemnisations.estimNum, val => setIndemnisations({ ...indemnisations, estimNum: val }))}</div>
                  <div className="w-1/2 text-right">{renderDottedField("SOMME TOTALE À PAYER", indemnisations.sommeTotal, val => setIndemnisations({ ...indemnisations, sommeTotal: val }))}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  {renderDottedField("De l'indemnité due à", indemnisations.indemniteDueA, val => setIndemnisations({ ...indemnisations, indemniteDueA: val }))}
                  {renderDottedField("Demeurant", indemnisations.demeurant, val => setIndemnisations({ ...indemnisations, demeurant: val }))}
                </div>

                <div className="border-l-2 border-orange-500 pl-3 py-1 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Situation d'implantation</p>
                  {renderDottedField("Pour passage d'une conduite de gaz naturel située sur la commune de", indemnisations.communeOuvrage, val => setIndemnisations({ ...indemnisations, communeOuvrage: val }))}
                  {renderDottedField("N° et date du P.V de constat", indemnisations.constatPvNumberDate, val => setIndemnisations({ ...indemnisations, constatPvNumberDate: val }))}
                  {renderDottedField("Chantier / Ouvrage", indemnisations.chantierOuvrage, val => setIndemnisations({ ...indemnisations, chantierOuvrage: val }))}
                </div>

                <div className="space-y-1.5 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Évaluation détaillée des indemnités</span>
                    <button 
                      onClick={handleAddEstimRow} 
                      className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-150 flex items-center gap-1 print:hidden"
                    >
                      <Plus className="w-3 h-3" /> Ligne
                    </button>
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700">
                        <th className="border border-slate-300 p-1 w-20 text-center">N° Parcelles</th>
                        <th className="border border-slate-300 p-1 w-24 text-center">Superficie utilisée</th>
                        <th className="border border-slate-300 p-1">Nature du préjudice</th>
                        <th className="border border-slate-300 p-1">Éléments de facturation</th>
                        <th className="border border-slate-300 p-1 w-24 text-center">Evaluation DA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indemnisations.estimRows.map((row, idx) => (
                        <tr key={idx} className="group/row">
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.parcelNo} onChange={e => {
                            const rows = [...indemnisations.estimRows]; rows[idx].parcelNo = e.target.value; setIndemnisations({...indemnisations, estimRows: rows});
                          }} className="w-full bg-transparent border-none text-center p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.superficie} onChange={e => {
                            const rows = [...indemnisations.estimRows]; rows[idx].superficie = e.target.value; setIndemnisations({...indemnisations, estimRows: rows});
                          }} className="w-full bg-transparent border-none text-center p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.nature} onChange={e => {
                            const rows = [...indemnisations.estimRows]; rows[idx].nature = e.target.value; setIndemnisations({...indemnisations, estimRows: rows});
                          }} className="w-full bg-transparent border-none p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.elements} onChange={e => {
                            const rows = [...indemnisations.estimRows]; rows[idx].elements = e.target.value; setIndemnisations({...indemnisations, estimRows: rows});
                          }} className="w-full bg-transparent border-none p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5 relative">
                            <div className="flex items-center">
                              <input type="text" value={row.evaluation} onChange={e => {
                                const rows = [...indemnisations.estimRows]; rows[idx].evaluation = e.target.value; setIndemnisations({...indemnisations, estimRows: rows});
                              }} className="w-full bg-transparent border-none text-right pr-4 p-0.5 text-[10px]" />
                              {indemnisations.estimRows.length > 1 && (
                                <button onClick={() => handleRemoveEstimRow(idx)} className="absolute right-0 text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 print:hidden">×</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-x-6 mt-4">
                  {renderDottedField("MR", indemnisations.mrName, val => setIndemnisations({ ...indemnisations, mrName: val }))}
                  {renderDottedField("CNI / PC", indemnisations.cniPc, val => setIndemnisations({ ...indemnisations, cniPc: val }))}
                </div>

                {renderDottedTextarea("Observations", indemnisations.observations, val => setIndemnisations({ ...indemnisations, observations: val }))}

                <textarea
                  value={indemnisations.etatEstimatifIntro}
                  onChange={(e) => setIndemnisations({ ...indemnisations, etatEstimatifIntro: e.target.value })}
                  className="w-full bg-slate-50/30 border border-dashed border-slate-200 focus:border-blue-500 focus:outline-none text-[10px] text-slate-500 p-2.5 rounded mt-2 font-medium leading-relaxed resize-none h-12 print:border-none print:bg-transparent"
                />

                <div className="grid grid-cols-2 gap-4 pt-8 text-center text-xs font-bold text-slate-850">
                  <div>
                    <input
                      type="text"
                      value={indemnisations.estimSignLeftTitle}
                      onChange={(e) => setIndemnisations({ ...indemnisations, estimSignLeftTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none mb-1 uppercase"
                    />
                    <input
                      type="text"
                      value={indemnisations.estimSignLeftSub}
                      onChange={(e) => setIndemnisations({ ...indemnisations, estimSignLeftSub: e.target.value })}
                      className="w-full text-center bg-transparent text-[9px] text-slate-500 border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={indemnisations.estimSignRightTitle}
                      onChange={(e) => setIndemnisations({ ...indemnisations, estimSignRightTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none mb-1 uppercase"
                    />
                    <input
                      type="text"
                      value={indemnisations.estimSignRightSub}
                      onChange={(e) => setIndemnisations({ ...indemnisations, estimSignRightSub: e.target.value })}
                      className="w-full text-center bg-transparent text-[9px] text-slate-500 border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. PV DE CONSTATATION DES LIEUX AVANT TRAVAUX */}
            {formType === "constat_lieux_avant_travaux" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE D'INDEMNISATION", "PV de Constatation des lieux Avant travaux", "PR.ETU.02.V01", "07.10.2024", "IMP.ETU.04", "1 / 1")}
                
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded border border-slate-250">
                  {renderDottedField("WILAYA", indemnisations.wilaya, val => setIndemnisations({ ...indemnisations, wilaya: val }))}
                  {renderDottedField("COMMUNE", indemnisations.commune, val => setIndemnisations({ ...indemnisations, commune: val }))}
                  {renderDottedField("N°", indemnisations.constatNum, val => setIndemnisations({ ...indemnisations, constatNum: val }))}
                </div>
                {renderDottedField("ANTENNE", indemnisations.antenne, val => setIndemnisations({ ...indemnisations, antenne: val }))}

                <div className="border border-slate-200 p-2.5 rounded-lg space-y-1 bg-white">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Identification du Propriétaire / Exploitant</span>
                  <div className="grid grid-cols-2 gap-x-4">
                    {renderDottedField("Nom du Propriétaire", indemnisations.ownerName, val => setIndemnisations({ ...indemnisations, ownerName: val }))}
                    {renderDottedField("Demeurant à", indemnisations.ownerAddress, val => setIndemnisations({ ...indemnisations, ownerAddress: val }))}
                    <div className="col-span-2">{renderDottedField("Pièce d'Identité", indemnisations.ownerCardId, val => setIndemnisations({ ...indemnisations, ownerCardId: val }))}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 border-t border-slate-100 pt-1 mt-1">
                    {renderDottedField("Nom de l'exploitant", indemnisations.operatorName, val => setIndemnisations({ ...indemnisations, operatorName: val }))}
                    {renderDottedField("Demeurant à", indemnisations.operatorAddress, val => setIndemnisations({ ...indemnisations, operatorAddress: val }))}
                    <div className="col-span-2">{renderDottedField("Pièce d'Identité", indemnisations.operatorCardId, val => setIndemnisations({ ...indemnisations, operatorCardId: val }))}</div>
                  </div>
                </div>

                <div className="space-y-1.5 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">État des lieux détaillé</span>
                    <button onClick={handleAddConstatRow} className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-150 flex items-center gap-1 print:hidden">
                      <Plus className="w-3 h-3" /> Ligne
                    </button>
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-[10px]">
                    <thead>
                      <tr className="bg-slate-150 font-bold text-slate-700">
                        <th className="border border-slate-300 p-1 w-16 text-center">N° du Plan</th>
                        <th className="border border-slate-300 p-1 w-16 text-center">N° Parcelles</th>
                        <th className="border border-slate-300 p-1 w-18 text-center">Long. traversée</th>
                        <th className="border border-slate-300 p-1 w-16 text-center">Emprise</th>
                        <th className="border border-slate-300 p-1">Etat des lieux (Récolte, Arbres, Culture, Haies etc...)</th>
                        <th className="border border-slate-300 p-1 w-24">Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indemnisations.constatRows.map((row, idx) => (
                        <tr key={idx} className="group/row">
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.planNo} onChange={e => {
                            const r = [...indemnisations.constatRows]; r[idx].planNo = e.target.value; setIndemnisations({...indemnisations, constatRows: r});
                          }} className="w-full bg-transparent border-none text-center p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.parcelNo} onChange={e => {
                            const r = [...indemnisations.constatRows]; r[idx].parcelNo = e.target.value; setIndemnisations({...indemnisations, constatRows: r});
                          }} className="w-full bg-transparent border-none text-center p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.length} onChange={e => {
                            const r = [...indemnisations.constatRows]; r[idx].length = e.target.value; setIndemnisations({...indemnisations, constatRows: r});
                          }} className="w-full bg-transparent border-none text-center p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.emprise} onChange={e => {
                            const r = [...indemnisations.constatRows]; r[idx].emprise = e.target.value; setIndemnisations({...indemnisations, constatRows: r});
                          }} className="w-full bg-transparent border-none text-center p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><textarea value={row.state} onChange={e => {
                            const r = [...indemnisations.constatRows]; r[idx].state = e.target.value; setIndemnisations({...indemnisations, constatRows: r});
                          }} className="w-full bg-transparent border-none p-0.5 text-[10px] resize-none h-6 focus:h-12" /></td>
                          <td className="border border-slate-300 p-0.5 relative">
                            <div className="flex items-center">
                              <input type="text" value={row.observations} onChange={e => {
                                const r = [...indemnisations.constatRows]; r[idx].observations = e.target.value; setIndemnisations({...indemnisations, constatRows: r});
                              }} className="w-full bg-transparent border-none p-0.5 text-[10px]" />
                              {indemnisations.constatRows.length > 1 && (
                                <button onClick={() => handleRemoveConstatRow(idx)} className="absolute right-0 text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 print:hidden">×</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <textarea
                  value={indemnisations.constatIntro}
                  onChange={(e) => setIndemnisations({ ...indemnisations, constatIntro: e.target.value })}
                  className="w-full bg-transparent border-t border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none text-[9px] text-slate-500 italic leading-relaxed mt-2 pt-2 resize-none h-14 print:border-none"
                />

                <div className="grid grid-cols-2 gap-4 text-xs font-bold pt-4">
                  <div className="col-span-2 text-right">
                    {renderDottedField("Fait A", indemnisations.faitA, val => setIndemnisations({ ...indemnisations, faitA: val }))}
                    {renderDottedField("le", indemnisations.faitLe, val => setIndemnisations({ ...indemnisations, faitLe: val }))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-6 text-center text-[9px] font-bold text-slate-850">
                  <div>
                    <input
                      type="text"
                      value={indemnisations.constatSignLeftTitle}
                      onChange={(e) => setIndemnisations({ ...indemnisations, constatSignLeftTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none mb-0.5 uppercase"
                    />
                    <input
                      type="text"
                      value={indemnisations.constatSignLeftSub}
                      onChange={(e) => setIndemnisations({ ...indemnisations, constatSignLeftSub: e.target.value })}
                      className="w-full text-center bg-transparent text-[8px] text-slate-500 border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={indemnisations.constatSignMiddleTitle}
                      onChange={(e) => setIndemnisations({ ...indemnisations, constatSignMiddleTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none mb-0.5 uppercase"
                    />
                    <input
                      type="text"
                      value={indemnisations.constatSignMiddleSub}
                      onChange={(e) => setIndemnisations({ ...indemnisations, constatSignMiddleSub: e.target.value })}
                      className="w-full text-center bg-transparent text-[8px] text-slate-500 border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={indemnisations.constatSignRightTitle}
                      onChange={(e) => setIndemnisations({ ...indemnisations, constatSignRightTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none mb-0.5 uppercase"
                    />
                    <input
                      type="text"
                      value={indemnisations.constatSignRightSub}
                      onChange={(e) => setIndemnisations({ ...indemnisations, constatSignRightSub: e.target.value })}
                      className="w-full text-center bg-transparent text-[8px] text-slate-500 border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. PV DE VISITE DE TRACÉ */}
            {formType === "visite_trace" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES EXECUTION OUVRAGES TG", "PV de visite de tracé", "PR.ETU.01.V01", "17/10/2024", "IMP.ETU.05", "1 / 1")}
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {renderDottedField("Bureau d'études", etudeOuvrage.bureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, bureauEtudes: val }))}
                  {renderDottedField("Ouvrage", etudeOuvrage.ouvrage, val => setEtudeOuvrage({ ...etudeOuvrage, ouvrage: val }))}
                  {renderDottedField("Longueur", etudeOuvrage.longueur, val => setEtudeOuvrage({ ...etudeOuvrage, longueur: val }))}
                  {renderDottedField("Commande N°", etudeOuvrage.commandeNo, val => setEtudeOuvrage({ ...etudeOuvrage, commandeNo: val }))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  {renderDottedField("Date de visite tracé (Début)", etudeOuvrage.visiteStart, val => setEtudeOuvrage({ ...etudeOuvrage, visiteStart: val }))}
                  {renderDottedField("au", etudeOuvrage.visiteEnd, val => setEtudeOuvrage({ ...etudeOuvrage, visiteEnd: val }))}
                </div>

                {renderDottedTextarea("Observation représentant de l'Ingénierie", etudeOuvrage.visiteObsRepresentant, val => setEtudeOuvrage({ ...etudeOuvrage, visiteObsRepresentant: val }))}
                {renderDottedTextarea("Observation du bureau d'études", etudeOuvrage.obsBureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, obsBureauEtudes: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-bold text-slate-800 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signLeft}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signRight}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. PV D'APPROBATION DE L'ÉTUDE PRÉLIMINAIRE */}
            {formType === "approbation_etude_preliminaire" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES EXECUTION OUVRAGES TG", "PV d'approbation de l'étude préliminaire", "PR.ETU.01.V01", "17/10/2024", "IMP.ETU.06", "1 / 1")}
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {renderDottedField("Bureau d'études", etudeOuvrage.bureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, bureauEtudes: val }))}
                  {renderDottedField("Ouvrage", etudeOuvrage.ouvrage, val => setEtudeOuvrage({ ...etudeOuvrage, ouvrage: val }))}
                  {renderDottedField("Longueur", etudeOuvrage.longueur, val => setEtudeOuvrage({ ...etudeOuvrage, longueur: val }))}
                  {renderDottedField("Commande N°", etudeOuvrage.commandeNo, val => setEtudeOuvrage({ ...etudeOuvrage, commandeNo: val }))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3 border-t pt-2">
                  {renderDottedField("Contrôle de l'étude du", etudeOuvrage.prelimStart, val => setEtudeOuvrage({ ...etudeOuvrage, prelimStart: val }))}
                  {renderDottedField("au", etudeOuvrage.prelimEnd, val => setEtudeOuvrage({ ...etudeOuvrage, prelimEnd: val }))}
                </div>
                {renderDottedField("Document de contrôle", etudeOuvrage.prelimControle, val => setEtudeOuvrage({ ...etudeOuvrage, prelimControle: val }))}

                {renderDottedTextarea("Constat", etudeOuvrage.prelimConstat, val => setEtudeOuvrage({ ...etudeOuvrage, prelimConstat: val }))}
                {renderDottedTextarea("Réserves", etudeOuvrage.prelimReserves, val => setEtudeOuvrage({ ...etudeOuvrage, prelimReserves: val }))}
                {renderDottedTextarea("Observation du bureau d'études", etudeOuvrage.obsBureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, obsBureauEtudes: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-bold text-slate-800 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signLeft}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signRight}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. PV DE CONFORMITÉ MATÉRIEL TOPOGRAPHIQUE */}
            {formType === "conformite_materiel_topo" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES EXECUTION OUVRAGES TG", "PV de conformité matériel topographique", "PR.ETU.01.V01", "17/10/2024", "IMP.ETU.07", "1 / 1")}
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {renderDottedField("Bureau d'études", etudeOuvrage.bureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, bureauEtudes: val }))}
                  {renderDottedField("Ouvrage", etudeOuvrage.ouvrage, val => setEtudeOuvrage({ ...etudeOuvrage, ouvrage: val }))}
                  {renderDottedField("Longueur", etudeOuvrage.longueur, val => setEtudeOuvrage({ ...etudeOuvrage, longueur: val }))}
                  {renderDottedField("Commande N°", etudeOuvrage.commandeNo, val => setEtudeOuvrage({ ...etudeOuvrage, commandeNo: val }))}
                </div>

                <div className="border border-slate-250 p-3 rounded-lg space-y-2 mt-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Fiche technique du matériel</span>
                  {renderDottedField("Appareil de levée topographique", etudeOuvrage.topoAppareil, val => setEtudeOuvrage({ ...etudeOuvrage, topoAppareil: val }))}
                  <div className="grid grid-cols-2 gap-x-4">
                    {renderDottedField("Marque", etudeOuvrage.topoMarque, val => setEtudeOuvrage({ ...etudeOuvrage, topoMarque: val }))}
                    {renderDottedField("Numéro de série", etudeOuvrage.topoSerie, val => setEtudeOuvrage({ ...etudeOuvrage, topoSerie: val }))}
                  </div>
                  {renderDottedField("Documents techniques présentés", etudeOuvrage.topoDocs, val => setEtudeOuvrage({ ...etudeOuvrage, topoDocs: val }))}
                  {renderDottedField("Certificat d'étalonnage", etudeOuvrage.topoCertificat, val => setEtudeOuvrage({ ...etudeOuvrage, topoCertificat: val }))}
                </div>

                {renderDottedTextarea("Réserves", etudeOuvrage.topoReserves, val => setEtudeOuvrage({ ...etudeOuvrage, topoReserves: val }))}
                {renderDottedTextarea("Observation du bureau d'études", etudeOuvrage.obsBureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, obsBureauEtudes: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-bold text-slate-800 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signLeft}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signRight}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 8. PV DE QUALIFICATION DE LA RESSOURCE HUMAINE */}
            {formType === "qualification_ressource_humaine" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES EXECUTION OUVRAGES TG", "PV de qualification de la ressource humaine", "PR.ETU.01.V01", "17/10/2024", "IMP.ETU.08", "1 / 1")}
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {renderDottedField("Bureau d'études", etudeOuvrage.bureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, bureauEtudes: val }))}
                  {renderDottedField("Ouvrage", etudeOuvrage.ouvrage, val => setEtudeOuvrage({ ...etudeOuvrage, ouvrage: val }))}
                  {renderDottedField("Longueur", etudeOuvrage.longueur, val => setEtudeOuvrage({ ...etudeOuvrage, longueur: val }))}
                  {renderDottedField("Commande N°", etudeOuvrage.commandeNo, val => setEtudeOuvrage({ ...etudeOuvrage, commandeNo: val }))}
                </div>

                <div className="mt-4">
                  {renderDottedField("Liste de la ressource humaine mise à disposition lors de la sortie du", etudeOuvrage.rhDateSortie, val => setEtudeOuvrage({ ...etudeOuvrage, rhDateSortie: val }))}
                </div>

                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500">Membres de l'équipe d'étude mobilisés</span>
                    <button onClick={handleAddRhRow} className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-150 flex items-center gap-1 print:hidden">
                      <Plus className="w-3 h-3" /> Personnel
                    </button>
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold">
                        <th className="border border-slate-300 p-1">Nom et prénom</th>
                        <th className="border border-slate-300 p-1 w-44">qualité</th>
                        <th className="border border-slate-300 p-1">Pièce remise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etudeOuvrage.rhRows.map((row, idx) => (
                        <tr key={idx} className="group/row">
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.nomPrenom} onChange={e => {
                            const r = [...etudeOuvrage.rhRows]; r[idx].nomPrenom = e.target.value; setEtudeOuvrage({...etudeOuvrage, rhRows: r});
                          }} className="w-full bg-transparent border-none p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5"><input type="text" value={row.qualite} onChange={e => {
                            const r = [...etudeOuvrage.rhRows]; r[idx].qualite = e.target.value; setEtudeOuvrage({...etudeOuvrage, rhRows: r});
                          }} className="w-full bg-transparent border-none p-0.5 text-[10px]" /></td>
                          <td className="border border-slate-300 p-0.5 relative">
                            <div className="flex items-center">
                              <input type="text" value={row.pieceRemise} onChange={e => {
                                const r = [...etudeOuvrage.rhRows]; r[idx].pieceRemise = e.target.value; setEtudeOuvrage({...etudeOuvrage, rhRows: r});
                              }} className="w-full bg-transparent border-none p-0.5 text-[10px]" />
                              {etudeOuvrage.rhRows.length > 1 && (
                                <button onClick={() => handleRemoveRhRow(idx)} className="absolute right-0 text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 print:hidden">×</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <textarea
                  value={etudeOuvrage.rhIntro}
                  onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, rhIntro: e.target.value })}
                  className="w-full bg-transparent border-l-2 border-blue-500 pl-3 py-1 text-[10px] text-slate-500 italic mt-3 font-semibold focus:outline-none focus:border-blue-700 resize-none h-12 print:border-none"
                />

                {renderDottedTextarea("Observation du bureau d'études", etudeOuvrage.obsBureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, obsBureauEtudes: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-bold text-slate-800 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signLeft}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signRight}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 9. PV DE PLANIFICATION DE LA PRESTATION ÉTUDE */}
            {formType === "planification_prestation_etude" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES EXECUTION OUVRAGES TG", "PV de planification de la prestation étude", "PR.ETU.01.V01", "17/10/2024", "IMP.ETU.09", "1 / 1")}
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {renderDottedField("Bureau d'études", etudeOuvrage.bureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, bureauEtudes: val }))}
                  {renderDottedField("Ouvrage", etudeOuvrage.ouvrage, val => setEtudeOuvrage({ ...etudeOuvrage, ouvrage: val }))}
                  {renderDottedField("Longueur", etudeOuvrage.longueur, val => setEtudeOuvrage({ ...etudeOuvrage, longueur: val }))}
                  {renderDottedField("Commande N°", etudeOuvrage.commandeNo, val => setEtudeOuvrage({ ...etudeOuvrage, commandeNo: val }))}
                </div>

                <div className="mt-4">
                  <textarea
                    value={etudeOuvrage.planificationIntro}
                    onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, planificationIntro: e.target.value })}
                    className="w-full bg-transparent border-b border-dashed border-slate-200 focus:border-blue-500 focus:outline-none text-xs font-semibold text-slate-800 mb-2 resize-none h-8 print:border-none"
                  />
                  <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700">
                        <th className="border border-slate-300 p-2 text-left">Action</th>
                        <th className="border border-slate-300 p-2 w-72 text-left">Date programmée</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2 font-bold">Démarrage des travaux</td>
                        <td className="border border-slate-300 p-1">
                          <input type="text" value={etudeOuvrage.planDemarrage} onChange={e => setEtudeOuvrage({...etudeOuvrage, planDemarrage: e.target.value})} className="w-full bg-transparent border-none text-[11px] px-1 py-0.5" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 font-bold">Etude préliminaire</td>
                        <td className="border border-slate-300 p-1 flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Du</span>
                          <input type="text" value={etudeOuvrage.planPrelimStart} onChange={e => setEtudeOuvrage({...etudeOuvrage, planPrelimStart: e.target.value})} className="bg-transparent border-none text-[11px] w-28 text-center" />
                          <span className="text-[10px] text-slate-400">au</span>
                          <input type="text" value={etudeOuvrage.planPrelimEnd} onChange={e => setEtudeOuvrage({...etudeOuvrage, planPrelimEnd: e.target.value})} className="bg-transparent border-none text-[11px] w-28 text-center" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 font-bold">Vérification d’étude sur site</td>
                        <td className="border border-slate-300 p-1 flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Du</span>
                          <input type="text" value={etudeOuvrage.planVerifStart} onChange={e => setEtudeOuvrage({...etudeOuvrage, planVerifStart: e.target.value})} className="bg-transparent border-none text-[11px] w-28 text-center" />
                          <span className="text-[10px] text-slate-400">au</span>
                          <input type="text" value={etudeOuvrage.planVerifEnd} onChange={e => setEtudeOuvrage({...etudeOuvrage, planVerifEnd: e.target.value})} className="bg-transparent border-none text-[11px] w-28 text-center" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 font-bold">Etude d’exécution</td>
                        <td className="border border-slate-300 p-1 flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Du</span>
                          <input type="text" value={etudeOuvrage.planExecStart} onChange={e => setEtudeOuvrage({...etudeOuvrage, planExecStart: e.target.value})} className="bg-transparent border-none text-[11px] w-28 text-center" />
                          <span className="text-[10px] text-slate-400">au</span>
                          <input type="text" value={etudeOuvrage.planExecEnd} onChange={e => setEtudeOuvrage({...etudeOuvrage, planExecEnd: e.target.value})} className="bg-transparent border-none text-[11px] w-28 text-center" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {renderDottedTextarea("Observation du bureau d'études", etudeOuvrage.obsBureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, obsBureauEtudes: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-bold text-slate-800 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signLeft}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signRight}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 10. PV D'APPROBATION DE L'ÉTUDE D'EXÉCUTION */}
            {formType === "approbation_etude_execution" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES EXECUTION OUVRAGES TG", "PV d'approbation de l'étude d'exécution", "PR.ETU.01.V01", "17/10/2024", "IMP.ETU.10", "1 / 1")}
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {renderDottedField("Bureau d'études", etudeOuvrage.bureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, bureauEtudes: val }))}
                  {renderDottedField("Ouvrage", etudeOuvrage.ouvrage, val => setEtudeOuvrage({ ...etudeOuvrage, ouvrage: val }))}
                  {renderDottedField("Longueur", etudeOuvrage.longueur, val => setEtudeOuvrage({ ...etudeOuvrage, longueur: val }))}
                  {renderDottedField("Commande N°", etudeOuvrage.commandeNo, val => setEtudeOuvrage({ ...etudeOuvrage, commandeNo: val }))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3 border-t pt-2">
                  {renderDottedField("Contrôle de l'étude du", etudeOuvrage.execStart, val => setEtudeOuvrage({ ...etudeOuvrage, execStart: val }))}
                  {renderDottedField("au", etudeOuvrage.execEnd, val => setEtudeOuvrage({ ...etudeOuvrage, execEnd: val }))}
                </div>
                {renderDottedField("Document de contrôle", etudeOuvrage.execControle, val => setEtudeOuvrage({ ...etudeOuvrage, execControle: val }))}

                {renderDottedTextarea("Constat", etudeOuvrage.execConstat, val => setEtudeOuvrage({ ...etudeOuvrage, execConstat: val }))}
                {renderDottedTextarea("Réserves", etudeOuvrage.execReserves, val => setEtudeOuvrage({ ...etudeOuvrage, execReserves: val }))}
                {renderDottedTextarea("Observation du bureau d'études", etudeOuvrage.obsBureauEtudes, val => setEtudeOuvrage({ ...etudeOuvrage, obsBureauEtudes: val }))}

                <div className="grid grid-cols-2 gap-4 pt-16 text-center text-xs font-bold text-slate-800 print:pt-8">
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signLeft}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signLeft: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={etudeOuvrage.signRight}
                      onChange={(e) => setEtudeOuvrage({ ...etudeOuvrage, signRight: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 11. FICHE DE COLLECTE D'INFORMATION */}
            {formType === "collecte_information" && (
              <div className="space-y-4 text-left">
                {renderOfficialHeader("PROCEDURE ETUDES D’EXECUTION DES PROJETS TELECOM", "FICHE DE COLLECTE D'INFORMATION", "PR.ETU.03 V00", "29/10/2024", "IMP.ETU.12", "1 / 1")}
                
                <div className="grid grid-cols-2 gap-x-6 bg-slate-50 p-2 border border-slate-200 rounded">
                  {renderDottedField("DIRECTION", telecom.direction, val => setTelecom({ ...telecom, direction: val }))}
                  {renderDottedField("DISTRICT", telecom.district, val => setTelecom({ ...telecom, district: val }))}
                  {renderDottedField("Ouvrage", telecom.ouvrage, val => setTelecom({ ...telecom, ouvrage: val }))}
                  {renderDottedField("Maitre de l'ouvrage", telecom.maitreOuvrage, val => setTelecom({ ...telecom, maitreOuvrage: val }))}
                  <div className="col-span-2">{renderDottedField("Lieu et date", telecom.lieuDate, val => setTelecom({ ...telecom, lieuDate: val }))}</div>
                </div>

                <div className="border border-slate-200 p-3 rounded-lg space-y-1.5 mt-2">
                  <span className="text-[10px] font-black text-blue-700 uppercase">1. Informations générales</span>
                  {renderDottedField("Nom du site", telecom.siteNom, val => setTelecom({ ...telecom, siteNom: val }))}
                  {renderDottedField("Adresse du site", telecom.siteAdresse, val => setTelecom({ ...telecom, siteAdresse: val }))}
                  <div className="grid grid-cols-2 gap-x-4">
                    {renderDottedField("Représentant", telecom.siteRepresentant, val => setTelecom({ ...telecom, siteRepresentant: val }))}
                    {renderDottedField("Date de visite", telecom.siteDateVisite, val => setTelecom({ ...telecom, siteDateVisite: val }))}
                  </div>
                </div>

                <div className="border border-slate-200 p-3 rounded-lg space-y-1.5 mt-2">
                  <span className="text-[10px] font-black text-blue-700 uppercase">2. Caractéristiques des canalisations</span>
                  <div className="grid grid-cols-2 gap-x-4">
                    {renderDottedField("Type de canalisation", telecom.canalisationType, val => setTelecom({ ...telecom, canalisationType: val }))}
                    {renderDottedField("Matériau", telecom.canalisationMateriau, val => setTelecom({ ...telecom, canalisationMateriau: val }))}
                    {renderDottedField("Diamètre (mm)", telecom.canalisationDiametre, val => setTelecom({ ...telecom, canalisationDiametre: val }))}
                    {renderDottedField("Profondeur d'enfouissement", telecom.canalisationProfondeur, val => setTelecom({ ...telecom, canalisationProfondeur: val }))}
                    <div className="col-span-2">{renderDottedField("Pression de service", telecom.canalisationPression, val => setTelecom({ ...telecom, canalisationPression: val }))}</div>
                  </div>
                </div>

                <div className="border border-slate-200 p-3 rounded-lg space-y-1.5 mt-2">
                  <span className="text-[10px] font-black text-blue-700 uppercase">3. Nature des fluides transportés</span>
                  {renderDottedField("Type de fluide", telecom.fluideType, val => setTelecom({ ...telecom, fluideType: val }))}
                  {renderDottedField("Autres fluides ou matériaux", telecom.fluideAutres, val => setTelecom({ ...telecom, fluideAutres: val }))}
                </div>

                <div className="border border-slate-200 p-3 rounded-lg space-y-1.5 mt-2">
                  <span className="text-[10px] font-black text-blue-700 uppercase">4. Distances et contraintes à respecter</span>
                  {renderDottedField("Distance minimale par rapport à d'autres installations", telecom.distanceMin, val => setTelecom({ ...telecom, distanceMin: val }))}
                </div>

                <div className="border border-slate-200 p-3 rounded-lg space-y-1.5 mt-2">
                  <span className="text-[10px] font-black text-blue-700 uppercase">5. Contraintes liées à la présence des canalisations</span>
                  {renderDottedField("Restrictions sur les travaux à proximité", telecom.restrictionsTravaux, val => setTelecom({ ...telecom, restrictionsTravaux: val }))}
                  {renderDottedField("Règles de sécurité spécifiques", telecom.reglesSecurite, val => setTelecom({ ...telecom, reglesSecurite: val }))}
                </div>

                {renderDottedTextarea("Commentaires supplémentaires", telecom.commentaires, val => setTelecom({ ...telecom, commentaires: val }))}

                <div className="grid grid-cols-2 gap-4 pt-8 text-center text-[10px] font-bold text-slate-800 leading-snug">
                  <div>
                    <textarea
                      value={telecom.signLeftTitle}
                      onChange={(e) => setTelecom({ ...telecom, signLeftTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none"
                    />
                    {renderDottedField("Région / Site d'Implantation", telecom.siteNom, val => setTelecom({ ...telecom, siteNom: val }))}
                  </div>
                  <div>
                    <textarea
                      value={telecom.signRightTitle}
                      onChange={(e) => setTelecom({ ...telecom, signRightTitle: e.target.value })}
                      className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none font-bold pb-4 mb-1 resize-none h-12 print:border-none"
                    />
                    <input
                      type="text"
                      value={telecom.signRightSub}
                      onChange={(e) => setTelecom({ ...telecom, signRightSub: e.target.value })}
                      className="w-full text-center bg-transparent text-[9px] text-slate-400 font-normal focus:outline-none border-b border-dashed border-slate-200 focus:border-blue-500 print:border-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 12. DYNAMIC PROCESSUS TRAVAUX TEMPLATES */}
            {TRAVAUX_TEMPLATES.some(t => t.id === formType) && (
              <TravauxForms formType={formType} />
            )}
          </div>

          {/* Footer of the sheet */}
          <div className="border-t border-slate-200 pt-4 text-[9px] text-slate-400 text-center flex justify-between uppercase font-bold mt-12 print:mt-6 select-none">
            <span>PD&I - Cahier des charges et spécifications d'exécution des ouvrages</span>
            <span>Reproduction interdite</span>
          </div>

        </div>
      </div>
    </div>
  );
}
