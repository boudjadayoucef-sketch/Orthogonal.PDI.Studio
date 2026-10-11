import { FicheSuivi, Project } from './types';
import { WILAYAS_ALGERIE, DEFAULT_TRAVAUX_LIGNE, DEFAULT_TRAVAUX_POSTES } from './constants';

export const computeProgressFromCanvas = (
  tLigne: any[],
  tPostes: any[],
  totalLengthKm: number,
  isPosteDetenteSeul: boolean = false
) => {
  const lenKm = totalLengthKm > 0 ? totalLengthKm : 10;
  const totLenM = lenKm * 1000;

  let gcLigneSum = 0;
  let mecaLigneSum = 0;
  let totalLigneSum = 0;

  const gcLigneNames = ["Piste", "Bardage", "Tranchée", "Mise en fouille"];

  (tLigne || DEFAULT_TRAVAUX_LIGNE).forEach(item => {
    const name = item.phase || item.label || "";
    const ant = parseFloat(String(item.anterieur)) || 0;
    const quot = parseFloat(String(item.quotidien)) || 0;
    const pond = parseFloat(String(item.ponderation)) || 0;
    const itemPct = Math.min(100, Math.max(0, ((ant + quot) / (totLenM || 1)) * 100));
    totalLigneSum += itemPct * (pond / 100);

    if (gcLigneNames.includes(name)) {
      gcLigneSum += itemPct * pond;
    } else {
      mecaLigneSum += itemPct * pond;
    }
  });

  const gcLignePct = Math.min(100, Math.max(0, gcLigneSum / 50));
  const mecaLignePct = Math.min(100, Math.max(0, mecaLigneSum / 50));
  const totalLignePct = Math.min(100, Math.max(0, totalLigneSum));

  let gcPostesSum = 0;
  let mecaPostesSum = 0;
  let totalPostesSum = 0;

  const gcPostesNames = ["Génie civil", "Clôture barreaudée", "Chemin d'exploitation"];

  (tPostes || DEFAULT_TRAVAUX_POSTES).forEach(item => {
    const name = item.phase || item.label || "";
    const ant = item.anterieur !== undefined 
      ? (parseFloat(String(item.anterieur)) || 0) 
      : Math.max(0, (parseFloat(String(item.global)) || 0) - (parseFloat(String(item.quotidien)) || 0));
    const quot = parseFloat(String(item.quotidien)) || 0;
    const itemPct = Math.min(100, Math.max(0, ant + quot));
    const pond = parseFloat(String(item.ponderation)) || 0;
    totalPostesSum += itemPct * (pond / 100);

    if (gcPostesNames.includes(name)) {
      gcPostesSum += itemPct * pond;
    } else {
      mecaPostesSum += itemPct * pond;
    }
  });

  const gcPostesPct = Math.min(100, Math.max(0, gcPostesSum / 35));
  const mecaPostesPct = Math.min(100, Math.max(0, mecaPostesSum / 65));
  const totalPostesPct = Math.min(100, Math.max(0, totalPostesSum));

  let finalGC = 0;
  let finalMeca = 0;
  let finalGlobal = 0;

  if (isPosteDetenteSeul) {
    finalGC = Math.round(gcPostesPct);
    finalMeca = Math.round(mecaPostesPct);
    finalGlobal = Math.round(totalPostesPct);
  } else {
    finalGC = Math.round((gcLignePct * 0.8) + (gcPostesPct * 0.2));
    finalMeca = Math.round((mecaLignePct * 0.8) + (mecaPostesPct * 0.2));
    finalGlobal = Math.round((totalLignePct * 0.8) + (totalPostesPct * 0.2));
  }

  return {
    avancementGC: Math.min(100, Math.max(0, finalGC)),
    avancementMeca: Math.min(100, Math.max(0, finalMeca)),
    avancementPhysique: Math.min(100, Math.max(0, finalGlobal))
  };
};

export function getProjectDisplayLength(project: any): string {
  if (!project || !project.identity || !project.identity.caracteristiques) {
    return "0";
  }
  const isSeul = project.identity.caracteristiques.typeOuvrage === "Poste de détente seul" || 
                 (project.identity.caracteristiques.hasPosteDetente && parseFloat(project.identity.caracteristiques.longueur || "10") === 0);
  if (isSeul) return "0";
  
  const hasLots = project.lots && project.lots.length > 0;
  if (hasLots) {
    const sum = project.lots.reduce((acc: number, l: any) => acc + (parseFloat(l.longueur) || 0), 0);
    if (sum > 0) return String(sum);
  }
  
  const len = project.identity.caracteristiques.longueur;
  return len && len !== "0" ? len : "10";
}

export function createDefaultFicheSuivi(): FicheSuivi {
  return {
    capPoste: "",
    ligneMl: "",
    typePoste: "",
    typeProgramme: "",
    demandeGefDate: "",
    gefCabinet: "",
    natureTerrain: "",
    depotDossierType: "",
    impactAssujettis: "",
    impactBetOds: "",
    impactDepotEtude: "",
    impactOuvertureEnqueteDate: "",
    choixTerrainDate: "",
    choixTerrainPv: "",
    etudeBetStatut: "",
    etudeBetCabinet: "",
    depotPcDate: "",
    depotAsDate: "",
    rappels: ["", "", "", "", ""],
    reserves: ["", "", "", "", ""],
    servitudeEnquetePv: "",
    servitudeEnqueteDate: "",
    servitudeJournaux: "",
    servitudeQuittancesPv: "",
    servitudeQuittancesDate: "",
    servitudeArreteStatus: "",
    servitudeArreteDate: "",
    servitudeArreteRef: "",
    autresInformations: ["", "", "", "", "", "", "", ""],
    expertiseArreteEnqueteRef: "",
    expertiseArreteEnqueteDate: "",
    expertiseArreteConsignationRef: "",
    expertiseArreteConsignationDate: "",
    servitudeEnqueteUtilitePubliquePv: "",
    servitudeEnqueteUtilitePubliqueDate: "",
    servitudeEnqueteUtilitePubliqueRef: "",
    asDateDemande: "",
    asOuvertureEnqueteDate: "",
    asPubJournauxDate: "",
    asQuittanceDate: "",
    impactDemandeAutExploitDate: "",
    impactPubJournauxDate: "",
    impactQuittanceDate: "",
    etudeLeveeReserveDate: "",
    etudeLeveeReserveStatus: "",
    etudeActionStatus: "",
    expertiseLeveeReserveDate: "",
    expertiseLeveeReserveStatus: "",
    expertiseActionStatus: ""
  };
}


export function getWilayaCoordinates(wilayaName: string): { lat: number; lng: number } {
  if (!wilayaName) return { lat: 36.7538, lng: 3.0588 }; // Default Algiers
  const cleanName = wilayaName.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
  
  const coords: Record<string, { lat: number; lng: number }> = {
    "alger": { lat: 36.7538, lng: 3.0588 },
    "oran": { lat: 35.6971, lng: -0.6308 },
    "constantine": { lat: 36.3650, lng: 6.6147 },
    "annaba": { lat: 36.9000, lng: 7.7667 },
    "blida": { lat: 36.4700, lng: 2.8300 },
    "jijel": { lat: 36.8205, lng: 5.7661 },
    "setif": { lat: 36.1900, lng: 5.4137 },
    "sétif": { lat: 36.1900, lng: 5.4137 },
    "ouargla": { lat: 31.9493, lng: 5.3250 },
    "hassi messaoud": { lat: 31.6804, lng: 6.0728 },
    "béchar": { lat: 31.6167, lng: -2.2167 },
    "bechar": { lat: 31.6167, lng: -2.2167 },
    "biskra": { lat: 34.8500, lng: 5.7333 },
    "tamanrasset": { lat: 22.7850, lng: 5.5228 },
    "adrar": { lat: 27.8742, lng: -0.2864 },
    "chlef": { lat: 36.1647, lng: 1.3317 },
    "laghouat": { lat: 33.8000, lng: 2.8651 },
    "batna": { lat: 35.5500, lng: 6.1667 },
    "bejaia": { lat: 36.7511, lng: 5.0643 },
    "béjaïa": { lat: 36.7511, lng: 5.0643 },
    "djelfa": { lat: 34.6667, lng: 3.2500 },
    "tiaret": { lat: 35.3711, lng: 1.3169 },
    "tizi ouzou": { lat: 36.7119, lng: 4.0458 },
    "medea": { lat: 36.2642, lng: 2.7539 },
    "médéa": { lat: 36.2642, lng: 2.7539 },
    "mascara": { lat: 35.3964, lng: 0.1403 },
    "mostaganem": { lat: 35.9311, lng: 0.1250 },
    "m'sila": { lat: 35.7058, lng: 4.5419 },
    "sidi bel abbes": { lat: 35.1914, lng: -0.6417 },
    "sidi bel abbès": { lat: 35.1914, lng: -0.6417 },
    "skikda": { lat: 36.8792, lng: 6.9044 },
    "guelma": { lat: 36.4622, lng: 7.4294 },
    "bordj bou arreridj": { lat: 36.0711, lng: 4.7594 },
    "boumerdes": { lat: 36.7594, lng: 3.4731 },
    "boumerdès": { lat: 36.7594, lng: 3.4731 },
    "el oued": { lat: 33.3678, lng: 6.8516 },
    "khenchela": { lat: 35.4358, lng: 7.1433 },
    "souk ahras": { lat: 36.2864, lng: 7.9511 },
    "tipaza": { lat: 36.5892, lng: 2.4475 },
    "mila": { lat: 36.4503, lng: 6.2644 },
    "ain defla": { lat: 36.2644, lng: 1.9678 },
    "aïn defla": { lat: 36.2644, lng: 1.9678 },
    "naama": { lat: 33.2667, lng: -0.3167 },
    "naâma": { lat: 33.2667, lng: -0.3167 },
    "ghardaia": { lat: 32.4900, lng: 3.6700 },
    "ghardaïa": { lat: 32.4900, lng: 3.6700 },
    "relizane": { lat: 35.7372, lng: 0.5558 },
    "el tarf": { lat: 36.7672, lng: 8.3136 },
    "tindouf": { lat: 27.6711, lng: -8.1478 },
    "tissemsilt": { lat: 35.6072, lng: 1.8106 },
    "illizi": { lat: 26.4833, lng: 8.4667 },
    "touggourt": { lat: 33.1000, lng: 6.0667 },
    "djanet": { lat: 24.5500, lng: 9.4833 },
    "in salah": { lat: 27.1935, lng: 2.4607 },
    "in guezzam": { lat: 19.5705, lng: 5.7694 }
  };

  for (const key of Object.keys(coords)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return coords[key];
    }
  }

  // Fallback: deterministic coordinates from hashing the Wilaya name
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = (Math.abs(hash % 100) / 100) * 4; // 0 to 4 degrees
  const lngOffset = ((hash % 100) / 100) * 6 - 3; // -3 to 3 degrees
  return {
    lat: 34.0 + latOffset,
    lng: 3.0 + lngOffset
  };
}

// Generates a complete and beautiful KML document for a project dynamically
export function generateKMLString(project: Project): string {
  const lengthKm = parseFloat(getProjectDisplayLength(project)) || 40;
  const baseCoords = getWilayaCoordinates(project.identity.wilaya);
  
  // Direct pipeline slightly northeast
  const angle = 0.5; // radians (approx 30 degrees)
  const degPerKm = 1 / 111.32;
  const totalDeg = lengthKm * degPerKm;
  const latDiff = totalDeg * Math.sin(angle);
  const lngDiff = (totalDeg * Math.cos(angle)) / Math.cos((baseCoords.lat * Math.PI) / 180);
  
  const startLat = baseCoords.lat;
  const startLng = baseCoords.lng;
  
  // Build path points
  const numSegments = 6;
  const pathPoints: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const currentLat = startLat + latDiff * t;
    const currentLng = startLng + lngDiff * t;
    
    // Add realistic bend to pipeline path (0 at ends)
    const deviation = 0.015 * Math.sin(t * Math.PI) * (lengthKm > 20 ? 1 : 0.4);
    const devAngle = angle + Math.PI / 2;
    
    pathPoints.push({
      lat: currentLat + deviation * Math.sin(devAngle),
      lng: currentLng + deviation * Math.cos(devAngle)
    });
  }
  
  const pathCoordsString = pathPoints.map(p => `${p.lng},${p.lat},0`).join(" ");
  
  let placemarks = `
    <Placemark>
      <name>Gazoduc: ${project.name}</name>
      <description>Tracé principal du gazoduc (${lengthKm} km, DN ${project.identity.caracteristiques.diametre || 'N/A'})</description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color> <!-- Red line -->
          <width>5</width>
        </LineStyle>
      </Style>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${pathCoordsString}</coordinates>
      </LineString>
    </Placemark>
  `;
  
  // Start Placemark (Scraper)
  placemarks += `
    <Placemark>
      <name>Gare de Racleur - Départ</name>
      <description>Station de départ du gazoduc ${project.name}</description>
      <Point>
        <coordinates>${pathPoints[0].lng},${pathPoints[0].lat},0</coordinates>
      </Point>
    </Placemark>
  `;
  
  // Sectioning Valves
  const nbCoupure = project.identity.caracteristiques.nbPostesCoupure || 1;
  for (let j = 1; j <= nbCoupure; j++) {
    const fraction = j / (nbCoupure + 1);
    const idx = Math.floor(fraction * pathPoints.length);
    const p = pathPoints[idx] || pathPoints[Math.floor(pathPoints.length / 2)];
    placemarks += `
      <Placemark>
        <name>Poste de Coupure PC ${j}</name>
        <description>Vanne de sectionnement de sécurité PC ${j}</description>
        <Point>
          <coordinates>${p.lng},${p.lat},0</coordinates>
        </Point>
      </Placemark>
    `;
  }
  
  // End Placemark (Scraper)
  placemarks += `
    <Placemark>
      <name>Gare de Racleur - Arrivée</name>
      <description>Station de réception de racleur finale pour le projet ${project.name}</description>
      <Point>
        <coordinates>${pathPoints[pathPoints.length - 1].lng},${pathPoints[pathPoints.length - 1].lat},0</coordinates>
      </Point>
    </Placemark>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${project.name.replace(/[<>&"]/g, "")} - Tracé Conduite</name>
    <description>Tracé technique officiel généré pour l'ouvrage ${project.name.replace(/[<>&"]/g, "")} - Localisation: ${project.identity.wilaya.replace(/[<>&"]/g, "")}</description>
    ${placemarks}
  </Document>
</kml>`;
}


// Hardcoded initial sample projects to populate empty firestore database automatically with realistic PD&I data

export const getPipelineSequence = (caracteristiques: any) => {
  if (caracteristiques?.pipelineSequence && Array.isArray(caracteristiques.pipelineSequence) && caracteristiques.pipelineSequence.length > 0) {
    return caracteristiques.pipelineSequence;
  }
  
  // Build a default sequence based on the individual fields
  const sequence: { id: string; type: "racc" | "gr_dep" | "gr_arr" | "coup" | "sect" | "det"; label?: string; pk?: string }[] = [];
  
  if (caracteristiques?.hasPiquage || caracteristiques?.pointRaccordement) {
    sequence.push({
      id: "racc-auto",
      type: "racc",
      label: caracteristiques?.pointRaccordement || "Piquage / Raccordement",
      pk: "Départ"
    });
  }
  
  if (caracteristiques?.hasGareRacleurDepart) {
    sequence.push({
      id: "gr_dep-auto",
      type: "gr_dep",
      label: "Gare Racleur Départ (GRD)"
    });
  }
  
  if (caracteristiques?.hasPosteCoupure) {
    const nb = caracteristiques?.nbPostesCoupure || 1;
    for (let i = 0; i < nb; i++) {
      sequence.push({
        id: `coup-auto-${i}`,
        type: "coup",
        label: nb > 1 ? `Poste de Coupure ${i + 1}` : "Poste de Coupure"
      });
    }
  }
  
  if (caracteristiques?.hasPosteSectionnement) {
    const nb = caracteristiques?.nbPostesSectionnement || 1;
    for (let i = 0; i < nb; i++) {
      sequence.push({
        id: `sect-auto-${i}`,
        type: "sect",
        label: nb > 1 ? `Poste Sectionnement ${i + 1}` : "Poste Sectionnement"
      });
    }
  }
  
  if (caracteristiques?.hasGareRacleurArrivee) {
    sequence.push({
      id: "gr_arr-auto",
      type: "gr_arr",
      label: "Gare Racleur Arrivée (GRA)"
    });
  }
  
  if (caracteristiques?.hasPosteDetente) {
    sequence.push({
      id: "det-auto",
      type: "det",
      label: "Poste Détente (DP)",
      pk: caracteristiques?.capacitePoste ? `Capacité: ${caracteristiques.capacitePoste}` : "DP"
    });
  }
  
  if (sequence.length === 0) {
    const L = caracteristiques?.longueur || "42";
    return [
      { id: "racc-def", type: "racc", label: "Piquage / Raccordement principal", pk: "0" },
      { id: "gr_dep-def", type: "gr_dep", label: "Gare Racleur Départ (GRD)", pk: "0" },
      { id: "coup-def", type: "coup", label: "Poste de Coupure de ligne", pk: `${Math.round(parseFloat(L) * 0.35) || 15}` },
      { id: "sect-def", type: "sect", label: "Poste de Sectionnement de sécurité", pk: `${Math.round(parseFloat(L) * 0.7) || 30}` },
      { id: "gr_arr-def", type: "gr_arr", label: "Gare Racleur Arrivée (GRA)", pk: L },
      { id: "det-def", type: "det", label: "Poste Détente Terminal (DP)", pk: L }
    ];
  }
  
  return sequence;
};

export const isUserPolesMatched = (userPoles: string[], projectPole: string) => {
  if (!userPoles || userPoles.length === 0) return true;
  if (userPoles.includes("Tous") || userPoles.includes("all")) return true;
  return userPoles.some(p => {
    if (!p || !projectPole) return false;
    const cleanUser = p.toLowerCase().replace(/ô/g, "o").trim();
    const cleanProj = projectPole.toLowerCase().replace(/ô/g, "o").trim();
    return cleanProj.includes(cleanUser) || cleanUser.includes(cleanProj) || 
           (cleanUser.includes("aco") && cleanProj.includes("aco")) ||
           (cleanUser.includes("bbo") && cleanProj.includes("bbo"));
  });
};

export const isUserDirectionsMatched = (userDirections: string[], projectRegion: string) => {
  if (!userDirections || userDirections.length === 0) return true;
  if (userDirections.includes("Tous") || userDirections.includes("all")) return true;
  return userDirections.some(d => {
    if (!d || !projectRegion) return false;
    const keywords = ["constantine", "ouargla", "alger", "oran", "blida", "bechar"];
    const matchedKeywordUser = keywords.find(k => d.toLowerCase().includes(k));
    const matchedKeywordProj = keywords.find(k => projectRegion.toLowerCase().includes(k));
    if (matchedKeywordUser && matchedKeywordProj) {
      return matchedKeywordUser === matchedKeywordProj;
    }
    const cleanUser = d.toLowerCase().replace(/dr/g, "").replace(/tg/g, "").replace(/region de transport/g, "").trim();
    const cleanProj = projectRegion.toLowerCase().replace(/dr/g, "").replace(/tg/g, "").replace(/region de transport/g, "").trim();
    return cleanProj.includes(cleanUser) || cleanUser.includes(cleanProj);
  });
};

export const formatDateFrench = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR");
  } catch {
    return dateStr;
  }
};



export const isPosteDetenteSeul = (project?: Project | null): boolean => {
  if (!project) return false;
  return Boolean(project.identity?.caracteristiques?.hasPosteDetente);
};

export const getProjectObjective = (p: Project): { type: string; label: string; date: string | null } => {
  const annee = p.planning?.etudeStart ? p.planning.etudeStart.substring(0, 4) : "2026";
  const trvStart = p.planning?.travauxStart;
  const gazEnd = p.planning?.gazEnd || p.planning?.gazStart;

  if (gazEnd && gazEnd.startsWith(annee)) {
    return { type: "misengaz", label: `Mise en gaz ${annee}`, date: gazEnd };
  } else if (trvStart && trvStart.startsWith(annee)) {
    return { type: "ouverture", label: `Ouverture Chantier ${annee}`, date: trvStart };
  } else if (gazEnd) {
    return { type: "misengaz", label: `Mise en gaz (${gazEnd.substring(0, 4)})`, date: gazEnd };
  } else if (trvStart) {
    return { type: "ouverture", label: `Chantier (${trvStart.substring(0, 4)})`, date: trvStart };
  }
  return { type: "autre", label: "Objectif Standard", date: null };
};

export const getPhaseBadgeColor = (phase?: string): string => {
  switch (phase) {
    case "Étude":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Travaux":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Essais":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Mise en Gaz":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Clôturé":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const generatePlanDeChargeHtml = (filteredProjects: Project[], filters: any): string => {
  let html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="color: #1e3a8a;">PD&I - PLAN DE CHARGE D'INGÉNIERIE & TRAVAUX</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
      <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #1e3a8a; color: white;">
            <th>Ouvrage</th>
            <th>Wilaya</th>
            <th>Pôle</th>
            <th>Région</th>
            <th>Phase</th>
            <th>Avancement</th>
          </tr>
        </thead>
        <tbody>
  `;
  filteredProjects.forEach(p => {
    html += `
      <tr>
        <td>${p.name}</td>
        <td>${p.identity?.wilaya || "-"}</td>
        <td>${p.identity?.pole || "-"}</td>
        <td>${p.identity?.region || "-"}</td>
        <td>${p.identity?.phase || "-"}</td>
        <td>${p.travauxPlanification?.avancementPhysique || 0}%</td>
      </tr>
    `;
  });
  html += `</tbody></table></div>`;
  return html;
};


export const getGenesisMilestones = (p: Project): any[] => {
  const milestones = [];
  if ((p.identity as any)?.dateIdentification) {
    milestones.push({
      title: "Identification & Faisabilité de l'Ouvrage",
      date: (p.identity as any).dateIdentification,
      status: "completed",
      description: "Étude d'opportunité, dimensionnement préliminaire et validation de l'insertion dans le schéma directeur de réseau pipeline."
    });
  }
  if (p.planning?.etudeStart) {
    milestones.push({
      title: "Lancement des Études de Base & Topo",
      date: p.planning.etudeStart,
      status: p.etudeAutorisation?.statutEtude === 'Approuvée' ? 'completed' : 'current',
      description: "Reconnaissance de tracé, levé topographique et élaboration du dossier d'impact sur l'environnement."
    });
  }
  if (p.planning?.travauxStart) {
    milestones.push({
      title: "Ouverture de Chantier & Début Travaux GC/Méca",
      date: p.planning.travauxStart,
      status: (p.travauxPlanification?.avancementPhysique || 0) >= 100 ? 'completed' : ((p.travauxPlanification?.avancementPhysique || 0) > 0 ? 'current' : 'pending'),
      description: "Piste d'emprise, ouverture de fouille, bardage, cintrage, soudage des tubes et contrôles non destructifs."
    });
  }
  if (p.planning?.gazStart || p.planning?.gazEnd) {
    milestones.push({
      title: "Mise en Gaz & Raccordement Réseau",
      date: p.planning?.gazEnd || p.planning?.gazStart,
      status: p.identity?.phase === 'Mise en Gaz' || p.identity?.phase === 'Clôturé' ? 'completed' : 'pending',
      description: "Épreuves hydrostatiques sous pression, séchage, inertage azote et introduction officielle du gaz naturel."
    });
  }
  return milestones;
};
