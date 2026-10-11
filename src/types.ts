/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FasciculeSection {
  id: string;
  title: string;
  page?: number;
  content: string;
  points?: string[];
  procedure?: {
    title: string;
    steps: string[];
    equipment?: string[];
    tolerances?: string[];
  };
  qaqcChecklist?: string[];
  relatedPv?: string;
  relatedIllustrationId?: string;
}

export interface Fascicule {
  id: string;
  number: string;
  title: string;
  summary: string;
  sections: FasciculeSection[];
  annexes?: string;
  illustrations?: {
    id: string;
    title: string;
    src: string;
    caption: string;
    page: number;
  }[];
}

export interface SparePartItem {
  id: string;
  designation: string;
  unit: string;
  ranges: {
    minMI: number;
    maxMI: number; // Use Infinity for open upper bound
    mrFormula: string; // e.g., "1", "2", "4", "5", "0.05 * MI"
    calc: (mi: number) => number;
  }[];
}

export interface BendingRecord {
  diameterInches: string;
  thicknesses: { [thick: number]: number }; // thickness in mm -> min radius in meters
  gaugePlateDiameter: number; // in mm
}

export interface Message {
  role: "user" | "model" | "system";
  content: string;
}

export interface PVState {
  type: "etat_des_lieux" | "qualification_soudeur";
  // Fields for PV d'état des lieux
  pvNumber?: string;
  wilaya?: string;
  commune?: string;
  antennaOuvrage?: string;
  ownerName?: string;
  ownerCardId?: string;
  operatorName?: string;
  operatorCardId?: string;
  date?: string;
  place?: string;
  rows?: {
    planNo: string;
    parcelNo: string;
    length: string;
    state: string; // e.g., récoltes, arbres
    rightOfWay: string;
    observations: string;
  }[];
  // Fields for PV de qualification de soudeur
  welderName?: string;
  welderId?: string;
  welderStamp?: string;
  weldingProcess?: string;
  electrodesBrandType?: string;
  diameterPipe?: string;
  thicknessPipe?: string;
  weldingPosition?: string; // e.g. en montant, en descendant
  testDate?: string;
  inspectorName?: string;
  resultsTraction?: string;
  resultsPliage?: string;
  resultsDurete?: string;
  resultsRadio?: string;
  observationsGeneral?: string;
}

export interface OuvrageBlock {
  id: string;
  name: string;
  status: "nouveau" | "ancien"; // "nouveau" (Nouveau / Extension / Projet) | "ancien" (Existant / Ancien)
  xOffset: number; // Position X sur le terrain / site (m)
  yOffset: number; // Position Y sur le terrain / site (m)
  length: number;  // Dimension A Longueur périmètre (m)
  width: number;   // Dimension B Largeur périmètre (m)
  fenceHeight: number; // Hauteur clôture profilée (m)
  hasFence: boolean;   // Clôture présente
  hasVoile: boolean;   // Voile béton armé
  voileSides?: ("nord" | "sud" | "est" | "ouest")[];
  voileHeight?: number;
  voileThickness?: number;
  hasGabions: boolean; // Gabions de protection
  gabionSides?: Record<"nord" | "sud" | "est" | "ouest", {
    enabled: boolean;
    etages?: number;
    length: number;
    width?: number;
    height?: number;
    offset: number;
    gap?: number;
    status?: "nouveau" | "ancien";
    tiers?: {
      height: number;
      depth: number;
      redanMode: "fixe" | "pourcentage" | string;
      redanValue: number;
    }[];
  }>;
}

export type SlabType = 
  | "poste_detente" 
  | "rechaffeur" 
  | "gare_racleur_arrivee" 
  | "gare_racleur_depart" 
  | "epandage_assiette" 
  | "abri_tele"
  | "dalle_custom";

export interface ParametricSlab {
  id: string;
  name: string;
  type: SlabType;
  length: number;
  width: number;
  thickness: number;
  xOffset: number;
  yOffset: number;
  isExtension: boolean;
  status?: "nouveau" | "ancien";
  ouvrageId?: string;
}

export interface ParametricAbri {
  id: string;
  name: string;
  length: number;
  width: number;
  height?: number;
  type: "01_porte" | "02_portes";
  xOffset: number;
  yOffset: number;
  isExtension?: boolean;
  status?: "nouveau" | "ancien";
  ouvrageId?: string;
}

export interface ParametricMassif {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  isExtension?: boolean;
  status?: "nouveau" | "ancien";
  ouvrageId?: string;
}

export interface ParametricGate {
  id: string;
  name: string;
  type: "portail_5m" | "portail_custom" | "portillon";
  wall: "sud" | "nord" | "est" | "ouest";
  offset: number;
  width: number;
  height?: number;
  status?: "nouveau" | "ancien";
  ouvrageId?: string;
}

export interface ParametricExtension {
  id: string;
  name: string;
  wall: "est" | "ouest" | "nord" | "sud" | "libre";
  length: number;
  width: number;
  xOffset: number;
  yOffset: number;
  isExtension: boolean;
  status?: "nouveau" | "ancien";
}

