import { pdiFeuilleImpression017L, PDI_STYLE_IMPRESSION_017L } from "../pdi/impression/pdiImpression017L";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import defaultLogo from "../assets/images/pdi-logo-horizontal.png";
import { SPARE_PARTS_RULES, RIGHT_OF_WAY_TABLE, COLD_BENDING_DATA } from "../data/fascicules";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ParametricSlab, ParametricAbri, ParametricMassif, ParametricGate, OuvrageBlock, SlabType } from "../types";
import {
  Calculator,
  Hammer,
  Shield,
  Zap,
  Info,
  Waves,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  Printer,
  Flame,
  Construction,
  Truck,
  HelpCircle,
  Sliders,
  Compass,
  Layers,
  RefreshCw,
  Paintbrush,
  Eraser,
  Undo,
  Type,
  Trash2,
  Square,
  Circle,
  Grid,
  PenTool,
  Diamond,
  Star,
  MousePointer,
  Activity,
  Home,
  Undo2,
  Redo2,
  ArrowUpRight,
  Plus,
  Minus,
  Triangle,
  Hexagon,
  ArrowLeftRight,
  RotateCw,
  RotateCcw,
  Copy,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Building2,
  DoorClosed,
  Move,
  DoorOpen,
  ShieldAlert,
  Settings,
  Ruler,
  Box,
  SlidersHorizontal,
  Check,
  X,
  Clipboard,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Disc,
  Filter
} from "lucide-react";
import { motion } from "motion/react";


/* 008e PD&I precision helper — utiliser clientX/clientY + getBoundingClientRect, pas offsetX/offsetY */
function pdiGetCanvasLocalPoint008e(event: any, canvas: any) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}


interface Project {
  id: string;
  name: string;
  createdAt: any;
  updatedAt: any;
  identity: {
    region: string;
    pole: string;
    wilaya: string;
    cadreInscription?: string;
    caracteristiques?: {
      diametre: string;
      longueur: string;
      hasGareRacleurDepart?: boolean;
      hasGareRacleurArrivee?: boolean;
      hasPosteDetente?: boolean;
      hasPosteCoupure?: boolean;
      hasPosteSectionnement?: boolean;
      nbPostesCoupure?: number;
      nbPostesSectionnement?: number;
      pointRaccordement?: string;
    };
  };
}


const PdiHeader = () => (
  <div className="w-full bg-white pb-2 mb-3 border-b-2 border-[#007ac3]">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img
          src={defaultLogo}
          alt="PD&I Logo Officiel"
          className="h-16 max-h-20 w-auto object-contain select-none"
          onError={(e) => {
            e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_PD&I.svg";
          }}
        />
      </div>

      <div className="flex-1 text-right flex flex-col justify-center">
        <h1 className="text-sm md:text-base font-black text-[#007ac3] tracking-tight leading-tight">
          PD&I — PIPING DESIGN & ISOMETRICS
        </h1>
        <h2 className="text-[11px] md:text-xs font-bold text-[#007ac3] tracking-normal leading-tight mt-0.5">
          Industrial Piping, Transport & Engineering Suite
        </h2>
      </div>
    </div>
  </div>
);

export default function Calculators() {
  const [activeTab, setActiveTab] = useState<"spare" | "emprise" | "bending" | "cavalier" | "gauvin" | "poste_gc" | "reception_usine" | "poste_croquis" | "bordereau">("spare");

  // BPU state variables
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [bordereauActivePart, setBordereauActivePart] = useState<"01" | "02" | "03">("01");
  const [bordereauSelectedProjectId, setBordereauSelectedProjectId] = useState<string>("all");
  const [showPrintBordereauModal, setShowPrintBordereauModal] = useState<boolean>(false);

  // Custom unit prices for Bordereau des prix
  const [bePrices, setBePrices] = useState<Record<string, number>>({
    impact: 1500000,
    topo: 45000,
    ing: 3000000,
    dup: 800000,
    geo: 120000
  });
  const [gefPrices, setGefPrices] = useState<Record<string, number>>({
    enq: 150000,
    exp: 80000,
    assist: 250000,
    cnd: 4500,
    audit: 65000
  });
  const [travauxPrices, setTravauxPrices] = useState<Record<string, number>>({
    piste: 12000,
    lit: 4000,
    soudage: 18000,
    enrobage: 85000,
    gr_dep: 4500000,
    gr_arr: 4500000,
    poste_coup: 3500000,
    poste_det: 15000000,
    raccord: 2500000,
    protection: 3500000,
    epreuve: 150000
  });

  // Real-time listener for PD&I projects from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "projects"), (snapshot) => {
      const projectsList: Project[] = [];
      snapshot.forEach((doc) => {
        projectsList.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(projectsList);
      setLoadingProjects(false);
    }, (error) => {
      console.error("Error loading projects in Calculators:", error);
      setLoadingProjects(false);
    });

    return () => unsubscribe();
  }, []);

  // Calculator 1: Spare parts (Rechanges)
  const [selectedSpareId, setSelectedSpareId] = useState(SPARE_PARTS_RULES[0].id);
  const [miValue, setMiValue] = useState<number>(25);

  // Calculator 2: Right of way (Emprise)
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  // Calculator 3: Cold Bending (Cintrage à Froid)
  const [selectedBendingIndex, setSelectedBendingIndex] = useState(0);
  const [selectedThickness, setSelectedThickness] = useState<number>(6);

  // Calculator 4: Cavalier Spacing (Lestage)
  const [pipeWeight, setPipeWeight] = useState<number>(80); // Wt in kg/m
  const [coatingWeight, setWr] = useState<number>(15); // Wr in kg/m
  const [concreteDensity, setGammaB] = useState<number>(2400); // kg/m3
  const [waterDensity, setGammaE] = useState<number>(1000); // kg/m3
  const [cavalierVolume, setVc] = useState<number>(0.35); // m3 per block
  const [pipeDiameterWithCoating, setDr] = useState<number>(0.32); // meters (Dr)

  // Calculator 5: GAUVIN air presence check & Hydrostatic Profile
  const [lengthKm, setLengthKm] = useState<number>(1.5); // Longueur du tronçon en km
  const [useLengthForVolume, setUseLengthForVolume] = useState<boolean>(true); // Calcul auto du volume V
  const [altHigh, setAltHigh] = useState<number>(250); // Altitude Point Haut Z_haut (m)
  const [altLow, setAltLow] = useState<number>(180); // Altitude Point Bas Z_bas (m)
  const [testPressureHigh, setTestPressureHigh] = useState<number>(80); // Pression d'épreuve au point haut (bar)
  const [vVolume, setVVolume] = useState<number>(120); // Volume in m3 (saisie manuelle si !useLengthForVolume)
  const [mBleed, setMBleed] = useState<number>(150); // Drawn water in litres
  const [measuredDrop, setMeasuredDrop] = useState<number>(1.2); // bar
  const [thicknessGauvin, setThicknessGauvin] = useState<number>(8); // mm
  const [diameterGauvin, setDiameterGauvin] = useState<number>(323.8); // mm
  const [gauvinSchemaTab, setGauvinSchemaTab] = useState<"calc" | "remplissage" | "tete_essai" | "all">("all");

  // Calculator 6: Génie Civil Poste de Détente
  const [gcCapacity, setGcCapacity] = useState<"small" | "medium" | "large">("small");
  const [mainSlabThickness, setMainSlabThickness] = useState<number>(0.25); // meters
  const [preheaterSlabThickness, setPreheaterSlabThickness] = useState<number>(0.20); // meters
  const [concreteDosage, setConcreteDosage] = useState<number>(350); // kg/m³

  // Calculator 7: Factory Reception (API 5L)
  const [pipeGrade, setPipeGrade] = useState<"B" | "X42" | "X52" | "X60" | "X65" | "X70">("X60");
  const [pslLevel, setPslLevel] = useState<"PSL1" | "PSL2">("PSL2");
  const [heatNumber, setHeatNumber] = useState<string>("H-2026-98745");
  const [pipeIdNumber, setPipeIdNumber] = useState<string>("T-0042");
  
  // Chemistry inputs
  const [chemC, setChemC] = useState<number>(0.14);
  const [chemMn, setChemMn] = useState<number>(1.35);
  const [chemP, setChemP] = useState<number>(0.012);
  const [chemS, setChemS] = useState<number>(0.004);
  const [chemSi, setChemSi] = useState<number>(0.26);
  const [chemCr, setChemCr] = useState<number>(0.04);
  const [chemMo, setChemMo] = useState<number>(0.02);
  const [chemV, setChemV] = useState<number>(0.03);
  const [chemNi, setChemNi] = useState<number>(0.02);
  const [chemCu, setChemCu] = useState<number>(0.05);

  // Mechanical properties inputs
  const [mechYS, setMechYS] = useState<number>(465); // Yield Strength (MPa)
  const [mechUTS, setMechUTS] = useState<number>(550); // Ultimate Tensile Strength (MPa)
  const [mechElong, setMechElong] = useState<number>(24.5); // Elongation %
  const [mechCharpy, setMechCharpy] = useState<number>(68); // Charpy impact Joules

  // Dimensional inputs
  const [geomOD, setGeomOD] = useState<number>(323.8); // Outer diameter mm
  const [geomThick, setGeomThick] = useState<number>(8.0); // mm
  const [geomOvality, setGeomOvality] = useState<number>(0.35); // %
  const [geomStraightness, setGeomStraightness] = useState<number>(0.8); // mm/m

  // Factory reception diagram tab state
  const [receptionDiagramTab, setReceptionDiagramTab] = useState<"geometry" | "coupons" | "ndt">("geometry");

  // Preview generated MTR State
  const [showMtrPreview, setShowMtrPreview] = useState<boolean>(false);

  // Calculator 8: Croquis & Conception Dalles GC (New & Extension)
  const [conceptionMode, setConceptionMode] = useState<"neuf" | "extension">("neuf");
  const [fenceA, setFenceA] = useState<number>(35); // Longueur clôture A (m)
  const [fenceB, setFenceB] = useState<number>(21); // Largeur clôture B (m)
  const [fenceHeight, setFenceHeight] = useState<number>(2.8); // Hauteur panneaux profilés (2.5 à 3.0m)

  // Fence Post Type & Concrete Section Inputs
  const [postType, setPostType] = useState<"metal_heb" | "beton_arme">("metal_heb");
  const [postConcreteWidth, setPostConcreteWidth] = useState<number>(0.25); // 25 cm = 0.25m
  const [postConcreteDepth, setPostConcreteDepth] = useState<number>(0.25); // 25 cm = 0.25m
  const [postConcreteHeight, setPostConcreteHeight] = useState<number>(2.8); // 2.8m

  // Dynamic Clôture Gates / Portails & Portillons State
  const [gates, setGates] = useState<ParametricGate[]>([
    {
      id: "gate-1",
      name: "Portail Véhicules Principal",
      type: "portail_5m",
      wall: "sud",
      offset: 5,
      width: 5,
      height: 2.8,
      ouvrageId: "ouvrage-1"
    },
    {
      id: "gate-2",
      name: "Portillon Piéton",
      type: "portillon",
      wall: "sud",
      offset: 15,
      width: 1,
      height: 2.8,
      ouvrageId: "ouvrage-1"
    }
  ]);

  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [draggingGateId, setDraggingGateId] = useState<string | null>(null);

  const handleAddGate = (type: "portail_5m" | "portail_custom" | "portillon" = "portail_5m", targetOuvrageId?: string) => {
    const newId = "gate-" + Date.now();
    const width = type === "portail_5m" ? 5 : type === "portillon" ? 1 : 4;
    const ouvrageId = targetOuvrageId || selectedOuvrageId || ouvrages[0]?.id || "ouvrage-1";
    const targetOv = ouvrages.find(o => o.id === ouvrageId);
    const wallLen = targetOv ? targetOv.length : fenceA;
    const gateHeight = targetOv ? targetOv.fenceHeight : fenceHeight;
    const existingOnOuvrage = gates.filter(g => g.ouvrageId === ouvrageId).length;
    const name = type === "portillon" ? `Portillon Piéton ${existingOnOuvrage + 1}` : `Portail Véhicules ${existingOnOuvrage + 1}`;
    setGates(prev => [
      ...prev,
      {
        id: newId,
        name,
        type,
        wall: "sud",
        offset: Math.min(2 + existingOnOuvrage * 3, Math.max(0, wallLen - width)),
        width,
        height: gateHeight,
        ouvrageId
      }
    ]);
    setSelectedGateId(newId);
  };

  const handleRemoveGate = (id: string) => {
    setGates(prev => prev.filter(g => g.id !== id));
    if (selectedGateId === id) setSelectedGateId(null);
  };

  const handleUpdateGate = (id: string, field: keyof ParametricGate, value: any) => {
    setGates(prev => prev.map(g => {
      if (g.id !== id) return g;
      const updated = { ...g, [field]: value };
      if (field === "wall" || field === "ouvrageId") {
        const targetOv = ouvrages.find(o => o.id === updated.ouvrageId) || ouvrages[0];
        const maxWallLen = (updated.wall === "sud" || updated.wall === "nord") ? (targetOv?.length ?? fenceA) : (targetOv?.width ?? fenceB);
        updated.offset = Math.min(Math.max(0, maxWallLen - updated.width), updated.offset);
      }
      return updated;
    }));
  };

  const handleDuplicateGate = (id: string) => {
    const target = gates.find(g => g.id === id);
    if (!target) return;
    const newId = "gate-" + Date.now();
    const maxWallLen = (target.wall === "sud" || target.wall === "nord") ? fenceA : fenceB;
    const newOffset = Math.min(Math.max(0, maxWallLen - target.width), target.offset + 2);
    setGates(prev => [
      ...prev,
      {
        ...target,
        id: newId,
        name: `${target.name} (Copie)`,
        offset: newOffset
      }
    ]);
    setSelectedGateId(newId);
  };

  // Dynamic Concrete Massifs (Fondations / Pylônes / Équipements) State
  const [massifs, setMassifs] = useState<ParametricMassif[]>([
    {
      id: "massif-1",
      name: "Massif Ancrage Filtre",
      length: 1.5,
      width: 1.5,
      height: 1.0,
      xOffset: 12,
      yOffset: 4,
      isExtension: false
    },
    {
      id: "massif-2",
      name: "Massif Pylône / Équipement",
      length: 1.2,
      width: 1.2,
      height: 0.8,
      xOffset: 25,
      yOffset: 14,
      isExtension: false
    }
  ]);
  const [selectedMassifId, setSelectedMassifId] = useState<string | null>(null);
  const [draggingMassifId, setDraggingMassifId] = useState<string | null>(null);

  const handleAddMassif = () => {
    const newId = "massif-" + Date.now();
    const count = massifs.length + 1;
    const offsetX = Math.round((-6 + (count * 4) % 16) * 10) / 10;
    const offsetY = Math.round((-4 + (count * 3) % 10) * 10) / 10;
    setMassifs(prev => [
      ...prev,
      {
        id: newId,
        name: `Massif Béton N°${count}`,
        length: 1.5,
        width: 1.5,
        height: 1.0,
        xOffset: offsetX,
        yOffset: offsetY,
        isExtension: false
      }
    ]);
    setSelectedMassifId(newId);
    setSelectedSlabId(null);
    setSelectedAbriId(null);
  };

  const handleRemoveMassif = (id: string) => {
    setMassifs(prev => prev.filter(m => m.id !== id));
    if (selectedMassifId === id) setSelectedMassifId(null);
  };

  const handleUpdateMassif = (id: string, field: keyof ParametricMassif, value: any) => {
    setMassifs(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleDuplicateMassif = (id: string) => {
    const target = massifs.find(m => m.id === id);
    if (!target) return;
    const newId = "massif-" + Date.now();
    setMassifs(prev => [
      ...prev,
      {
        ...target,
        id: newId,
        name: `${target.name} (Copie)`,
        xOffset: Math.round((target.xOffset + 2) * 10) / 10,
        yOffset: Math.round((target.yOffset + 2) * 10) / 10
      }
    ]);
    setSelectedMassifId(newId);
  };

  // Interactive Drag & Drop state for Slabs
  const [selectedSlabId, setSelectedSlabId] = useState<string | null>("slab-1");
  const [draggingSlabId, setDraggingSlabId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ pointerX: number; pointerY: number; initX: number; initY: number } | null>(null);

  // Cotation Generator states
  const [showCotations, setShowCotations] = useState<boolean>(true);
  const [cotationFilter, setCotationFilter] = useState<"all" | "selected">("all");
  const [minSafetyDistance, setMinSafetyDistance] = useState<number>(2.0);

  // Dynamic Abris de Télé-exploitation (Buildings)
  const [abris, setAbris] = useState<ParametricAbri[]>([
    {
      id: "abri-1",
      name: "Abri Télé-exploitation Principal",
      length: 5,
      width: 3,
      type: "02_portes",
      xOffset: 2.5,
      yOffset: 15.5,
      isExtension: false
    }
  ]);
  const [selectedAbriId, setSelectedAbriId] = useState<string | null>("abri-1");
  const [draggingAbriId, setDraggingAbriId] = useState<string | null>(null);

  // Active or primary abri helper bindings
  const primaryAbri = abris.find(a => a.id === selectedAbriId) || abris[0] || {
    id: "abri-1",
    name: "Abri Télé-exploitation Principal",
    length: 5,
    width: 3,
    type: "02_portes" as const,
    xOffset: 2.5,
    yOffset: 15.5,
    isExtension: false
  };

  const teleShelterLength = primaryAbri.length;
  const teleShelterWidth = primaryAbri.width;
  const teleShelterType = primaryAbri.type;
  const teleShelterIsExtension = !!primaryAbri.isExtension;

  const setTeleShelterLength = (len: number) => {
    setAbris(prev => prev.map(a => a.id === primaryAbri.id ? { ...a, length: len } : a));
  };
  const setTeleShelterWidth = (w: number) => {
    setAbris(prev => prev.map(a => a.id === primaryAbri.id ? { ...a, width: w } : a));
  };
  const setTeleShelterType = (t: "01_porte" | "02_portes") => {
    setAbris(prev => prev.map(a => a.id === primaryAbri.id ? { ...a, type: t } : a));
  };
  const setTeleShelterIsExtension = (ext: boolean) => {
    setAbris(prev => prev.map(a => a.id === primaryAbri.id ? { ...a, isExtension: ext } : a));
  };

  const nbPortails5m = gates.filter(g => g.type === "portail_5m" || g.type === "portail_custom").length;
  const nbPortillons1m = gates.filter(g => g.type === "portillon").length;

  // Voile Périphérique (Mur Béton Armé de Soutènement/Périmétrique)
  const [hasVoilePeripherique, setHasVoilePeripherique] = useState<boolean>(false);
  const [voileSides, setVoileSides] = useState<("nord" | "sud" | "est" | "ouest")[]>(["nord", "sud", "est", "ouest"]);
  const [voileHeight, setVoileHeight] = useState<number>(2.5); // Hauteur m
  const [voileThickness, setVoileThickness] = useState<number>(0.20); // Épaisseur m
  const [voileCustomLength, setVoileCustomLength] = useState<number>(20); // Longueur sur un mur spécifique (m)

  // State for CAD Modal Popups
  const [activeCadModal, setActiveCadModal] = useState<
    "perimeter" | "slabs" | "massifs" | "gates" | "ouvrages" | "voile" | "gabions" | "shelters" | null
  >(null);
  const [activeGabionTab, setActiveGabionTab] = useState<"nord" | "sud" | "est" | "ouest">("nord");
  const [activeGabionOuvrageId, setActiveGabionOuvrageId] = useState<string | null>(null);
  const [activeVoileOuvrageId, setActiveVoileOuvrageId] = useState<string | null>(null);

  // Protection par Gabions Multi-Côtés (Murs en Casier Pierres - Conception par Côté)
  const [hasGabions, setHasGabions] = useState<boolean>(false);
  const [gabionSideConfigs, setGabionSideConfigs] = useState<Record<"nord" | "sud" | "est" | "ouest", {
    enabled: boolean;
    etages: number; // 1 à 4 étages
    length: number; // Longueur du mur m
    width: number; // Largeur casier m
    height: number; // Hauteur casier m
    offset: number; // Position offset m
    gap: number; // Espace entre casiers/angles (m)
  }>>({
    nord: { enabled: true, etages: 1, length: 12, width: 1.0, height: 1.0, offset: 2.0, gap: 0.5 },
    sud: { enabled: false, etages: 2, length: 12, width: 1.0, height: 1.0, offset: 2.0, gap: 0.5 },
    est: { enabled: true, etages: 3, length: 10, width: 1.0, height: 1.0, offset: 2.0, gap: 0.5 },
    ouest: { enabled: false, etages: 2, length: 10, width: 1.0, height: 1.0, offset: 2.0, gap: 0.5 }
  });

  // Multi-Ouvrages & Blocs du Croquis (Gestion des Postes & Extensions Multiples)
  const [ouvrages, setOuvrages] = useState<OuvrageBlock[]>([
    {
      id: "ouvrage-1",
      name: "Poste Principal (Bloc A)",
      status: "nouveau",
      xOffset: 0,
      yOffset: 0,
      length: 35,
      width: 21,
      fenceHeight: 2.8,
      hasFence: true,
      hasVoile: false,
      hasGabions: false,
      voileSides: ["nord", "sud", "est", "ouest"],
      voileHeight: 2.5,
      voileThickness: 0.20,
      gabionSides: {
        nord: { enabled: false, length: 12, offset: 0, tiers: [{ height: 1, depth: 1, redanMode: "fixe", redanValue: 0 }] },
        sud: { enabled: false, length: 12, offset: 0, tiers: [
          { height: 1, depth: 1.2, redanMode: "fixe", redanValue: 0 },
          { height: 0.8, depth: 1.0, redanMode: "fixe", redanValue: 0.4 }
        ] },
        est: { enabled: false, length: 10, offset: 0, tiers: [
          { height: 1, depth: 1.2, redanMode: "fixe", redanValue: 0 },
          { height: 0.8, depth: 1.0, redanMode: "fixe", redanValue: 0.4 },
          { height: 0.6, depth: 0.8, redanMode: "pourcentage", redanValue: 30 }
        ] },
        ouest: { enabled: false, length: 10, offset: 0, tiers: [
          { height: 1, depth: 1.2, redanMode: "fixe", redanValue: 0 },
          { height: 0.8, depth: 1.0, redanMode: "fixe", redanValue: 0.4 }
        ] },
      }
    }
  ]);

  const [selectedOuvrageId, setSelectedOuvrageId] = useState<string | null>("ouvrage-1");
  const [draggingOuvrageId, setDraggingOuvrageId] = useState<string | null>(null);

  const primaryOuvrage = ouvrages[0] || {
    id: "ouvrage-1",
    name: "Poste Principal (Bloc A)",
    status: "nouveau" as const,
    xOffset: 0,
    yOffset: 0,
    length: fenceA,
    width: fenceB,
    fenceHeight: fenceHeight,
    hasFence: true,
    hasVoile: false,
    hasGabions: false
  };

  const handleAddOuvrage = () => {
    const newId = "ouvrage-" + Date.now();
    const count = ouvrages.length + 1;
    const refOv = ouvrages[0] || { length: 35, width: 21, xOffset: 0, yOffset: 0 };
    setOuvrages(prev => [
      ...prev,
      {
        id: newId,
        name: `Ouvrage / Bloc N°${count} (Extension)`,
        status: "nouveau",
        xOffset: refOv.xOffset + refOv.length + 4,
        yOffset: 0,
        length: 16,
        width: 12,
        fenceHeight: 2.8,
        hasFence: true,
        hasVoile: false,
        hasGabions: false,
        voileSides: ["nord", "sud", "est", "ouest"],
        voileHeight: 2.5,
        voileThickness: 0.20,
        gabionSides: {
          nord: { enabled: false, length: 10, offset: 0, tiers: [{ height: 1, depth: 1, redanMode: "fixe", redanValue: 0 }] },
          sud: { enabled: false, length: 10, offset: 0, tiers: [{ height: 1, depth: 1, redanMode: "fixe", redanValue: 0 }] },
          est: { enabled: false, length: 8, offset: 0, tiers: [{ height: 1, depth: 1, redanMode: "fixe", redanValue: 0 }] },
          ouest: { enabled: false, length: 8, offset: 0, tiers: [{ height: 1, depth: 1, redanMode: "fixe", redanValue: 0 }] },
        }
      }
    ]);
    setSelectedOuvrageId(newId);
  };

  const handleDuplicateOuvrage = (id: string) => {
    const target = ouvrages.find(o => o.id === id);
    if (!target) return;
    const newId = "ouvrage-" + Date.now();
    setOuvrages(prev => [
      ...prev,
      {
        ...target,
        id: newId,
        name: `${target.name} (Copie)`,
        xOffset: target.xOffset + target.length + 3,
        yOffset: target.yOffset
      }
    ]);
    setSelectedOuvrageId(newId);
  };

  const handleRemoveOuvrage = (id: string) => {
    if (ouvrages.length <= 1) return;
    setOuvrages(prev => prev.filter(o => o.id !== id));
    if (selectedOuvrageId === id) setSelectedOuvrageId(null);
  };

  const handleUpdateOuvrage = (id: string, field: keyof OuvrageBlock, value: any) => {
    setOuvrages(prev => prev.map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, [field]: value };
      if (id === ouvrages[0]?.id) {
        if (field === "length") setFenceA(Number(value) || 10);
        if (field === "width") setFenceB(Number(value) || 10);
      }
      return updated;
    }));
  };

  // State for Cartouche Metadata & Verification signatures
  const [cartoucheInfo, setCartoucheInfo] = useState({
    editorName: "Boudjada Youcef",
    verifierName: "Chef de Service Génie Civil",
    approverName: "Direction Technique & Projets",
    postName: "Poste de Détente & Mesurage Gaz",
    planNumber: "PDI-ENG-GC-2026-001",
    revisionIndex: "Rev 01 (Bon Pour Exécution)",
    date: new Date().toLocaleDateString("fr-FR"),
    scale: "1:100"
  });

  // Zoom & Pan state for parametric sketch canvas
  const [croquisZoom, setCroquisZoom] = useState<number>(1.0);
  const [croquisPan, setCroquisPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const handleDuplicateSlab = (id: string) => {
    const target = slabs.find(s => s.id === id);
    if (!target) return;
    const newId = "slab-" + Date.now();
    setSlabs(prev => [
      ...prev,
      {
        ...target,
        id: newId,
        name: `${target.name} (Copie)`,
        xOffset: Math.min(Math.max(0, fenceA - target.length), target.xOffset + 1),
        yOffset: Math.min(Math.max(0, fenceB - target.width), target.yOffset + 1)
      }
    ]);
    setSelectedSlabId(newId);
  };

  const handleDuplicateAbri = (id: string) => {
    const target = abris.find(a => a.id === id);
    if (!target) return;
    const newId = "abri-" + Date.now();
    setAbris(prev => [
      ...prev,
      {
        ...target,
        id: newId,
        name: `${target.name} (Copie)`,
        xOffset: Math.min(Math.max(0, fenceA - target.length), target.xOffset + 1),
        yOffset: Math.min(Math.max(0, fenceB - target.width), target.yOffset + 1)
      }
    ]);
    setSelectedAbriId(newId);
  };

  const handleAddAbri = () => {
    const newId = "abri-" + Date.now();
    const count = abris.length + 1;
    setAbris(prev => [
      ...prev,
      {
        id: newId,
        name: `Abri Télé-exploitation N°${count}`,
        length: 5,
        width: 3,
        type: "01_porte",
        xOffset: Math.min(Math.max(0, fenceA - 5), 2.5 + (prev.length * 2) % 15),
        yOffset: Math.min(Math.max(0, fenceB - 3), 2.5 + (prev.length * 3) % 10),
        isExtension: false
      }
    ]);
    setSelectedAbriId(newId);
    setSelectedSlabId(null);
  };

  const handleRemoveAbri = (id: string) => {
    setAbris(prev => prev.filter(a => a.id !== id));
    if (selectedAbriId === id) setSelectedAbriId(null);
  };

  const handleUpdateAbri = (id: string, field: keyof ParametricAbri, value: any) => {
    setAbris(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleZoomIn = () => setCroquisZoom(prev => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100));
  const handleZoomOut = () => setCroquisZoom(prev => Math.max(0.5, Math.round((prev - 0.25) * 100) / 100));
  const handleZoomReset = () => {
    setCroquisZoom(1.0);
    setCroquisPan({ x: 0, y: 0 });
  };

  // Single source of truth for the blueprint scale (px per meter), shared by
  // the SVG render AND by every drag handler so editing stays 1:1 with what
  // is actually drawn on screen, at any zoom level.
  const getBlueprintScale = () => {
    const maxDim = Math.max(
      ...ouvrages.map(o => Math.max(o.length, o.width, Math.abs(o.xOffset) + o.length, Math.abs(o.yOffset) + o.width)),
      40
    );
    return Math.min(18, Math.max(6, 600 / maxDim)) * croquisZoom;
  };
  // Must match svgW/2 and svgH/2 used inside the blueprint SVG render (1189x841)
  const BLUEPRINT_CX = 594.5;
  const BLUEPRINT_CY = 420.5;

  // Dynamic Slabs list
  const [slabs, setSlabs] = useState<ParametricSlab[]>([
    {
      id: "slab-1",
      name: "Dalle Poste de Détente",
      type: "poste_detente",
      length: 15,
      width: 3,
      thickness: 0.25,
      xOffset: 3,
      yOffset: 3,
      isExtension: false
    },
    {
      id: "slab-2",
      name: "Dalle Réchauffeur",
      type: "rechaffeur",
      length: 5,
      width: 3,
      thickness: 0.25,
      xOffset: 3,
      yOffset: 9,
      isExtension: false
    },
    {
      id: "slab-3",
      name: "Dalle Gare Racleur (Arrivée)",
      type: "gare_racleur_arrivee",
      length: 10,
      width: 3,
      thickness: 0.25,
      xOffset: 20,
      yOffset: 3,
      isExtension: false
    },
    {
      id: "slab-4",
      name: "Épandage Assiette",
      type: "epandage_assiette",
      length: 6,
      width: 4,
      thickness: 0.20,
      xOffset: 20,
      yOffset: 9,
      isExtension: false
    }
  ]);

  const totalSlabsArea = slabs.reduce((acc, s) => acc + (s.length * s.width), 0);

  const handleAddSlab = (type: SlabType = "poste_detente") => {
    const defaultNames: Record<SlabType, string> = {
      poste_detente: "Dalle Poste de Détente",
      rechaffeur: "Dalle Réchauffeur",
      gare_racleur_arrivee: "Dalle Gare Racleur (Arrivée)",
      gare_racleur_depart: "Dalle Gare Racleur (Départ)",
      epandage_assiette: "Épandage Assiette",
      abri_tele: "Dalle Abri Téléexploitation",
      dalle_custom: "Dalle Béton Personnalisée"
    };
    const defaultThickness: Record<SlabType, number> = {
      poste_detente: 0.25,
      rechaffeur: 0.25,
      gare_racleur_arrivee: 0.25,
      gare_racleur_depart: 0.25,
      epandage_assiette: 0.20,
      abri_tele: 0.20,
      dalle_custom: 0.25
    };
    const newId = "slab-" + Date.now();
    setSlabs(prev => [
      ...prev,
      {
        id: newId,
        name: defaultNames[type] || "Nouvelle Dalle",
        type,
        length: 6,
        width: 3,
        thickness: defaultThickness[type] || 0.25,
        xOffset: 4 + (prev.length * 2) % 15,
        yOffset: 4 + (prev.length * 3) % 10,
        isExtension: false
      }
    ]);
  };

  const handleRemoveSlab = (id: string) => {
    setSlabs(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateSlab = (id: string, field: keyof ParametricSlab, value: any) => {
    setSlabs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const [activeTooltipCroquis, setActiveTooltipCroquis] = useState<string | null>(null);
  const [showTechnicalReport, setShowTechnicalReport] = useState<boolean>(false);
  const handleDirectPrintCroquis = () => {
    const mainSvg = document.getElementById("mainCadPlanSvg");
    const svgHtml = mainSvg ? mainSvg.outerHTML : "";

    const totalSlabsConcrete = slabs.reduce((acc, s) => acc + (s.length * s.width * s.thickness), 0);
    const totalMassifsConcrete = massifs.reduce((acc, m) => acc + (m.length * m.width * m.height), 0);
    const totalConcrete = totalSlabsConcrete + totalMassifsConcrete;
    const totalFenceLength = (fenceA * 2 + fenceB * 2);

    // Calculate Section Views & Elevation Details for all active gabion sides across all ouvrages
    let coupeAaSvgHtml = "";
    const activeGabionSections: Array<{
      blockLetter: string;
      sideLetter: string;
      cutName: string;
      ovName: string;
      side: string;
      tiers: Array<{ height: number; depth: number; redanMode?: string; redanValue?: number }>;
      totalH: number;
    }> = [];

    const sideLetterMap: Record<"sud" | "nord" | "est" | "ouest", string> = {
      sud: "A",
      nord: "B",
      est: "C",
      ouest: "D",
    };

    ouvrages.forEach((ov, ovIndex) => {
      if (!ov.hasGabions || !ov.gabionSides) return;
      const blockLetter = String.fromCharCode(65 + (ovIndex % 26));
      const sides: Array<"sud" | "nord" | "est" | "ouest"> = ["sud", "nord", "est", "ouest"];
      sides.forEach((side) => {
        const gConf = ov.gabionSides?.[side];
        if (gConf && gConf.enabled && (gConf.tiers || []).length > 0) {
          const sideLetter = sideLetterMap[side];
          const tiers = gConf.tiers || [];
          const totalH = tiers.reduce((s, t) => s + (t.height || 0), 0);
          activeGabionSections.push({
            blockLetter,
            sideLetter,
            cutName: `${blockLetter}-${sideLetter}`,
            ovName: ov.name || `Ouvrage ${ovIndex + 1}`,
            side,
            tiers,
            totalH,
          });
        }
      });
    });

    if (activeGabionSections.length > 0) {
      const gridCols = activeGabionSections.length <= 1 ? 1 : 2;
      const blocksHtml = activeGabionSections.map((sec) => {
        const PX_PER_M = 36;
        let cumH = 0, cumD = 0;
        const tierElements = sec.tiers.map((t, idx) => {
          const h = (t.height || 0.5) * PX_PER_M;
          const d = (t.depth || 0.5) * PX_PER_M;
          if (idx > 0) {
            const prevDepth = sec.tiers[idx - 1].depth || 1;
            const redanM = t.redanMode === "pourcentage" ? (prevDepth * (t.redanValue || 0)) / 100 : (t.redanValue || 0);
            cumD += redanM * PX_PER_M;
          }
          const y = 115 - cumH - h;
          const x = 50 + cumD;
          cumH += h;
          return `
            <g>
              <rect x="${x}" y="${y}" width="${d}" height="${h}" fill="#0284c7" fill-opacity="0.25" stroke="#0072bc" stroke-width="1.5" />
              <text x="${x + d / 2}" y="${y + h / 2 - 2}" fill="#0f172a" font-size="8" font-weight="bold" text-anchor="middle">Ét.${idx + 1}</text>
              <text x="${x + d / 2}" y="${y + h / 2 + 8}" fill="#0072bc" font-size="7" font-weight="800" text-anchor="middle">H=${t.height}m P=${t.depth}m</text>
            </g>
          `;
        }).join("");

        return `
          <div style="border: 1.5px solid #0f172a; background: #ffffff; padding: 4px; border-radius: 4px; page-break-inside: avoid; display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #0072bc; padding-bottom: 2px; margin-bottom: 3px; flex-shrink: 0;">
              <span style="font-size: 7.5px; font-weight: 900; color: #0072bc; text-transform: uppercase; letter-spacing: 0.3px;">
                📐 COUPE ${sec.cutName} (${sec.ovName.toUpperCase()} — ${sec.side.toUpperCase()})
              </span>
              <span style="font-size: 7px; font-weight: 800; color: #0f172a; font-family: monospace; background: #e0f2fe; padding: 1px 4px; border-radius: 3px; border: 1px solid #0284c7;">
                ${sec.tiers.length}ét | H≈${sec.totalH.toFixed(2)}m
              </span>
            </div>
            <svg viewBox="0 0 480 135" style="width: 100%; height: 100%; flex: 1; min-height: 0; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px;">
              <line x1="15" y1="115" x2="465" y2="115" stroke="#0f172a" stroke-width="1.8" stroke-dasharray="4 2" />
              ${tierElements}
              <circle cx="20" cy="18" r="7" fill="#0072bc" />
              <text x="20" y="21" fill="#ffffff" font-size="8" font-weight="900" text-anchor="middle">${sec.blockLetter}</text>
              <circle cx="460" cy="18" r="7" fill="#0072bc" />
              <text x="460" y="21" fill="#ffffff" font-size="8" font-weight="900" text-anchor="middle">${sec.sideLetter}</text>
            </svg>
          </div>
        `;
      }).join("");
      coupeAaSvgHtml = `<div class="elevation-grid" style="grid-template-columns: repeat(${gridCols}, 1fr);">${blocksHtml}</div>`;
    } else {
      coupeAaSvgHtml = "";
    }

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <meta charset="utf-8" />
          <title>Plan_CAD_PD&I_${cartoucheInfo.planNumber || "GC-001"}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 4mm;
            }
            @media print {
              html, body {
                width: 100% !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page-container {
                border: 2px solid #0f172a !important;
                box-sizing: border-box !important;
                height: 98vh !important;
                max-height: 198mm !important;
              }
            }
            * { box-sizing: border-box; }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-container {
              width: 100%;
              height: 100vh;
              max-height: 198mm;
              margin: 0 auto;
              border: 2px solid #0f172a;
              padding: 10px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #ffffff;
              overflow: hidden;
              page-break-after: avoid;
              page-break-inside: avoid;
            }
            .header-banner {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .header-logo-title {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .main-content {
              display: flex;
              flex-direction: row;
              gap: 10px;
              flex: 1;
              min-height: 0;
            }
            .left-column {
              width: 320px;
              shrink: 0;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border-right: 2px solid #0f172a;
              padding-right: 10px;
            }
            .right-column {
              flex: 1;
              display: flex;
              flex-direction: column;
              border: 1.5px solid #0f172a;
              background: #090d16;
              padding: 6px;
              border-radius: 4px;
              overflow: hidden;
            }
            .drawing-title {
              text-align: center;
              background: #1e293b;
              color: #38bdf8;
              font-weight: 900;
              font-size: 10px;
              text-transform: uppercase;
              padding: 4px;
              letter-spacing: 1px;
              border-bottom: 1px solid #334155;
              margin-bottom: 4px;
            }
            .svg-container {
              flex: 2;
              min-height: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .svg-container svg {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .elevation-grid {
              flex: 1;
              min-height: 0;
              display: grid;
              gap: 4px;
              margin-top: 4px;
              overflow: hidden;
            }
            .cartouche-table {
              width: 100%;
              border-collapse: collapse;
              border: 1.5px solid #0f172a;
              font-size: 8px;
              font-family: monospace;
              margin-bottom: 6px;
            }
            .cartouche-table td {
              border: 1px solid #0f172a;
              padding: 3px 6px;
              vertical-align: top;
            }
            .cartouche-table .label {
              font-weight: bold;
              color: #475569;
              text-transform: uppercase;
            }
            .cartouche-table .val {
              font-weight: 900;
              color: #0f172a;
              font-size: 9px;
            }
            .metres-table {
              width: 100%;
              border-collapse: collapse;
              border: 1.5px solid #0f172a;
              font-size: 8px;
              font-family: monospace;
              margin-bottom: 6px;
            }
            .metres-table th {
              background: #f1f5f9;
              border: 1px solid #0f172a;
              padding: 3px 6px;
              text-align: left;
              text-transform: uppercase;
              font-weight: 900;
            }
            .metres-table td {
              border: 1px solid #0f172a;
              padding: 3px 6px;
            }
            .notes-box {
              border: 1px solid #0f172a;
              background: #f8fafc;
              padding: 4px 6px;
              font-size: 7.5px;
              font-family: monospace;
              line-height: 1.3;
              margin-bottom: 6px;
            }
            .visas-box {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
            }
            .visa-card {
              border: 1px solid #0f172a;
              height: 38px;
              padding: 3px;
              font-size: 7px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              background: #fafafa;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <!-- HEADER PD&I OFFICIEL -->
            <div class="header-banner" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0072bc; padding-bottom: 6px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <img src="/pdi-logo-horizontal.png" alt="PD&I Logo" style="height: 72px; width: 72px; min-width: 72px; object-fit: contain;" />
                <div>
                  <div style="font-size: 20px; font-weight: 900; color: #0072bc; font-family: 'Cairo', 'Amiri', 'Arial', sans-serif; line-height: 1.2;">
                    PD&I — PIPING DESIGN & ISOMETRICS
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #0072bc; font-family: 'Helvetica Neue', 'Arial', sans-serif; margin-top: 3px;">
                    Industrial Piping, Transport & Engineering Suite
                  </div>
                </div>
              </div>
              <div style="text-align: right; font-family: monospace; font-size: 9px; font-weight: 800;">
                <div style="color: #0072bc; text-transform: uppercase; font-size: 10px; font-weight: 900;">PLAN D'IMPLANTATION GC TECHNIQUE</div>
                <div>DOC N° : ${cartoucheInfo.planNumber || "PD&I-GC-001"} | RÉV : ${cartoucheInfo.revisionIndex || "0"}</div>
              </div>
            </div>

            <!-- MAIN DUAL COLUMN BODY -->
            <div class="main-content">
              <!-- LEFT COLUMN: CARTOUCHE & QUANTITATIFS -->
              <div class="left-column">
                <div>
                  <div style="text-align: center; background: #0f172a; color: #ffffff; padding: 3px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                    CARTOUCHE OFFICIEL PD&I
                  </div>

                  <table class="cartouche-table">
                    <tr>
                      <td width="50%">
                        <span class="label">Ouvrage / Poste :</span><br/>
                        <span class="val">${cartoucheInfo.postName || "Poste de Détente Gaz"}</span>
                      </td>
                      <td width="50%">
                        <span class="label">Conception :</span><br/>
                        <span class="val">${conceptionMode === "neuf" ? "Neuf (100%)" : "Extension Existant"}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span class="label">Échelle :</span><br/>
                        <span class="val">${cartoucheInfo.scale || "1 / 100"}</span>
                      </td>
                      <td>
                        <span class="label">Date :</span><br/>
                        <span class="val">${cartoucheInfo.date || new Date().toLocaleDateString('fr-FR')}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span class="label">Édité par :</span><br/>
                        <span class="val" style="color: #0284c7;">${cartoucheInfo.editorName || "PD&I"}</span>
                      </td>
                      <td>
                        <span class="label">Vérifié par :</span><br/>
                        <span class="val" style="color: #0284c7;">${cartoucheInfo.verifierName || "INGÉNIEUR GC"}</span>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2">
                        <span class="label">Approuvé par (PD&I) :</span><br/>
                        <span class="val" style="color: #16a34a;">${cartoucheInfo.approverName || "DIRECTION TECHNIQUE & PROJETS"}</span>
                      </td>
                    </tr>
                  </table>

                  <div style="font-size: 8px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #0f172a; padding-bottom: 2px; margin-bottom: 4px; color: #0f172a;">
                    RÉSUMÉ SYNTÉTIQUE DES MÉTRÉS GC :
                  </div>

                  <table class="metres-table">
                    <thead>
                      <tr>
                        <th>Désignation</th>
                        <th style="text-align: right;">Quantité</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Clôture Périmétrique</td>
                        <td style="text-align: right;"><strong>${totalFenceLength.toFixed(1)} ml</strong></td>
                      </tr>
                      <tr>
                        <td>Dalles Béton Armé</td>
                        <td style="text-align: right;"><strong>${slabs.length} U (${slabs.reduce((acc, s) => acc + s.length * s.width, 0).toFixed(1)} m²)</strong></td>
                      </tr>
                      <tr>
                        <td>Massifs / Socles Pylônes</td>
                        <td style="text-align: right;"><strong>${massifs.length} U</strong></td>
                      </tr>
                      <tr>
                        <td>Abris & Local Télécom</td>
                        <td style="text-align: right;"><strong>${abris.length} U</strong></td>
                      </tr>
                      <tr>
                        <td>Portails & Accès</td>
                        <td style="text-align: right;"><strong>${gates.length} U</strong></td>
                      </tr>
                      <tr>
                        <td>Volume Béton Total</td>
                        <td style="text-align: right;"><strong style="color: #0284c7;">${totalConcrete.toFixed(2)} m³</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <div class="notes-box">
                    <strong style="color: #0f172a;">NOTES TECHNIQUES :</strong><br/>
                    • Béton armé B35 (350 kg/m³ CPA) sur lit de sable compacté.<br/>
                    • Clôture de sécurité H=${fenceHeight}m avec fil ronce barbelé supérieur.<br/>
                    • Scellement par goujons chimiques époxy en cas d'extension.
                  </div>
                </div>

                <div class="visas-box">
                  <div class="visa-card">
                    <span style="font-weight: 800; color: #475569;">VISA INGÉNIEUR GC</span>
                    <span style="color: #94a3b8; font-size: 6px;">Signature / Date</span>
                  </div>
                  <div class="visa-card">
                    <span style="font-weight: 800; color: #475569;">VISA CHEF DE PROJET</span>
                    <span style="color: #94a3b8; font-size: 6px;">Signature / Cachet</span>
                  </div>
                </div>
              </div>

              <!-- RIGHT COLUMN: CAD TECHNICAL DRAWING SVG & COUPE A-A SECTION VIEW -->
              <div class="right-column">
                <div class="drawing-title">
                  SCHÉMA TECHNIQUE CAD 2D — VUE EN PLAN D'IMPLANTATION (ÉCHELLE ${cartoucheInfo.scale || "1/100"})
                </div>
                <div class="svg-container">
                  ${svgHtml}
                </div>
                ${coupeAaSvgHtml}
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintEmprise = () => {
    const row = RIGHT_OF_WAY_TABLE[selectedRowIndex];
    const win = window.open("", "_blank");
    if (!win) return;

    const svgElement = document.getElementById("empriseSvgDiagram");
    const svgHtml = svgElement ? svgElement.outerHTML : "";

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <meta charset="utf-8" />
          <title>Plan_Emprise_Piste_PD&I_Fasc2_DN${row.diameterInches}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { width: 100%; max-width: 1000px; margin: 0 auto; border: 2px solid #0f172a; padding: 16px; box-sizing: border-box; }
            .title-box { text-align: center; background: #f1f5f9; border: 1.5px solid #0f172a; padding: 8px; font-weight: 900; text-transform: uppercase; font-size: 11px; margin-bottom: 12px; }
            .param-grid { width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; font-size: 9px; font-family: monospace; margin-bottom: 12px; }
            .param-grid td, .param-grid th { border: 1px solid #0f172a; padding: 6px 10px; text-align: center; }
            .param-grid th { background: #e2e8f0; font-weight: bold; }
            .drawing-box { border: 1.5px solid #0f172a; padding: 12px; text-align: center; background: #0f172a; margin-bottom: 12px; }
            .drawing-box svg { max-width: 100%; height: auto; max-height: 300px; }
            .notes { border: 1.5px solid #0f172a; padding: 8px 12px; font-size: 8.5px; font-family: monospace; background: #fafafa; margin-bottom: 12px; line-height: 1.5; }
            .cartouche { width: 100%; border-collapse: collapse; border: 2px solid #0f172a; }
            .cartouche td { border: 1px solid #0f172a; padding: 5px 8px; font-size: 8.5px; font-family: monospace; vertical-align: top; }
            .cartouche .label { font-weight: bold; text-transform: uppercase; color: #475569; }
            .cartouche .value { font-weight: 900; font-size: 9.5px; color: #000000; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0072bc; padding-bottom: 6px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <img src="/pdi-logo-horizontal.png" alt="PD&I Logo" style="height: 68px; width: 68px; min-width: 68px; object-fit: contain;" />
                <div>
                  <div style="font-size: 19px; font-weight: 900; color: #0072bc; font-family: 'Cairo', 'Amiri', 'Arial', sans-serif; line-height: 1.2;">
                    PD&I — PIPING DESIGN & ISOMETRICS
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #0072bc; font-family: 'Helvetica Neue', 'Arial', sans-serif; margin-top: 2px;">
                    Industrial Piping, Transport & Engineering Suite
                  </div>
                </div>
              </div>
              <div style="text-align: right; font-family: monospace; font-size: 9px; font-weight: 700;">
                <div style="color: #0072bc; font-weight: 900; font-size: 11px;">PROFIL D'EMPRISE</div>
                <div>NORME : FASCICULE 2</div>
              </div>
            </div>

            <div class="title-box">
              PROFIL D'EMPRISE DE PISTE ET SERVITUDES — GAZODUC DN ${row.diameterInches} (${row.diameterMm} mm)
            </div>

            <table class="param-grid">
              <thead>
                <tr>
                  <th>Diamètre Nominal</th>
                  <th>Ø Extérieur</th>
                  <th>Piste de Travail (B)</th>
                  <th>Servitude Gauche (C)</th>
                  <th>Cordon Déblais (D)</th>
                  <th>EMPRISE TOTALE (A)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${row.diameterInches} Inches</strong></td>
                  <td>${row.diameterMm} mm</td>
                  <td>${row.b} m</td>
                  <td>${row.c} m</td>
                  <td>${row.d} m</td>
                  <td><strong style="color: #0284c7; font-size: 12px;">${row.total} MÈTRES</strong></td>
                </tr>
              </tbody>
            </table>

            <div class="drawing-box">
              ${svgHtml}
            </div>

            <div class="notes">
              <strong>NOTES TECHNIQUES FASCICULE 2 :</strong><br/>
              • Largeur minimale réglementaire obligatoire pour le passage du bardage et des engins lourds.<br/>
              • Séparation stricte du cordon de terre meuble/déblais (D) à gauche et de la piste de roulement (B) à droite.<br/>
              • Profondeur minimale de génératrice supérieure du tube : H ≥ 1.0 mètre par rapport au sol naturel.
            </div>

            <table class="cartouche">
              <tr>
                <td width="25%"><span class="label">Maître d'Ouvrage :</span><br/><span class="value">PD&I PIPELINE DESIGN & ISOMETRICS</span></td>
                <td width="25%"><span class="label">Ouvrage :</span><br/><span class="value">PISTE D'EMPRISE DN ${row.diameterInches}</span></td>
                <td width="25%"><span class="label">N° Plan :</span><br/><span class="value">${cartoucheInfo.planNumber || "EMP-FASC2-001"}</span></td>
                <td width="25%"><span class="label">Échelle & Date :</span><br/><span class="value">${cartoucheInfo.scale || "1 / 100"} | ${cartoucheInfo.date || "2026"}</span></td>
              </tr>
              <tr>
                <td><span class="label">Édité par :</span><br/><span class="value">${cartoucheInfo.editorName || "PD&I"}</span></td>
                <td><span class="label">Vérifié par :</span><br/><span class="value">${cartoucheInfo.verifierName || "INGÉNIEUR GC"}</span></td>
                <td colspan="2"><span class="label">Approuvé par (PD&I) :</span><br/><span class="value">${cartoucheInfo.approverName || "DIRECTION TECHNIQUE & PROJETS"}</span></td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 400); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintBending = () => {
    const bData = currentBending;
    const win = window.open("", "_blank");
    if (!win) return;

    const svgElement = document.getElementById("bendingSvgDiagram");
    const svgHtml = svgElement ? svgElement.outerHTML : "";

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <meta charset="utf-8" />
          <title>Plan_Cintrage_PD&I_Fasc3_DN${bData.diameterInches}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { width: 100%; max-width: 1000px; margin: 0 auto; border: 2px solid #0f172a; padding: 16px; box-sizing: border-box; }
            .title-box { text-align: center; background: #f1f5f9; border: 1.5px solid #0f172a; padding: 8px; font-weight: 900; text-transform: uppercase; font-size: 11px; margin-bottom: 12px; }
            .param-grid { width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; font-size: 9px; font-family: monospace; margin-bottom: 12px; }
            .param-grid td, .param-grid th { border: 1px solid #0f172a; padding: 6px 10px; text-align: center; }
            .param-grid th { background: #e2e8f0; font-weight: bold; }
            .drawing-box { border: 1.5px solid #0f172a; padding: 12px; text-align: center; background: #0f172a; margin-bottom: 12px; }
            .drawing-box svg { max-width: 100%; height: auto; max-height: 300px; }
            .notes { border: 1.5px solid #0f172a; padding: 8px 12px; font-size: 8.5px; font-family: monospace; background: #fafafa; margin-bottom: 12px; line-height: 1.5; }
            .cartouche { width: 100%; border-collapse: collapse; border: 2px solid #0f172a; }
            .cartouche td { border: 1px solid #0f172a; padding: 5px 8px; font-size: 8.5px; font-family: monospace; vertical-align: top; }
            .cartouche .label { font-weight: bold; text-transform: uppercase; color: #475569; }
            .cartouche .value { font-weight: 900; font-size: 9.5px; color: #000000; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0072bc; padding-bottom: 6px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <img src="/pdi-logo-horizontal.png" alt="PD&I Logo" style="height: 68px; width: 68px; min-width: 68px; object-fit: contain;" />
                <div>
                  <div style="font-size: 19px; font-weight: 900; color: #0072bc; font-family: 'Cairo', 'Amiri', 'Arial', sans-serif; line-height: 1.2;">
                    PD&I — PIPING DESIGN & ISOMETRICS
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #0072bc; font-family: 'Helvetica Neue', 'Arial', sans-serif; margin-top: 2px;">
                    Industrial Piping, Transport & Engineering Suite
                  </div>
                </div>
              </div>
              <div style="text-align: right; font-family: monospace; font-size: 9px; font-weight: 700;">
                <div style="color: #0072bc; font-weight: 900; font-size: 11px;">CINTRAGE À FROID</div>
                <div>NORME : FASCICULE 3</div>
              </div>
            </div>

            <div class="title-box">
              SCHÉMA CINÉMATIQUE & BANC DE CINTRAGE À FROID SUR CHANTIER — DN ${bData.diameterInches}
            </div>

            <table class="param-grid">
              <thead>
                <tr>
                  <th>Diamètre Nominal</th>
                  <th>Épaisseur Tube (e)</th>
                  <th>Gabarit de Vérification</th>
                  <th>RAYON R MIN RÉGLEMENTAIRE</th>
                  <th>Référence Réglementaire</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${bData.diameterInches} Inches</strong></td>
                  <td>${selectedThickness} mm</td>
                  <td>Ø ${bData.gaugePlateDiameter} mm</td>
                  <td><strong style="color: #d97706; font-size: 12px;">${currentBendingRadius} MÈTRES</strong></td>
                  <td>Fascicule 3 — Annexe 12, Page 138</td>
                </tr>
              </tbody>
            </table>

            <div class="drawing-box">
              ${svgHtml}
            </div>

            <div class="notes">
              <strong>SPÉCIFICATIONS TECHNIQUES DE CINTRAGE (FASCICULE 3) :</strong><br/>
              • Exécution sur cintreuse hydraulique avec sabots d'appui garnis d'élastomère pour préserver le revêtement.<br/>
              • L'ovalisation après cintrage ne doit sous aucun prétexte dépasser 2.5% du diamètre nominal du tube.<br/>
              • Contrôle systématique par passage de la plaque de gabarit circulaire de diamètre minimal Ø ${bData.gaugePlateDiameter} mm.
            </div>

            <table class="cartouche">
              <tr>
                <td width="25%"><span class="label">Maître d'Ouvrage :</span><br/><span class="value">PD&I PIPELINE DESIGN & ISOMETRICS</span></td>
                <td width="25%"><span class="label">Ouvrage :</span><br/><span class="value">CINTRAGE À FROID DN ${bData.diameterInches}</span></td>
                <td width="25%"><span class="label">N° Plan :</span><br/><span class="value">${cartoucheInfo.planNumber || "CIN-FASC3-001"}</span></td>
                <td width="25%"><span class="label">Échelle & Date :</span><br/><span class="value">${cartoucheInfo.scale || "1 / 50"} | ${cartoucheInfo.date || "2026"}</span></td>
              </tr>
              <tr>
                <td><span class="label">Édité par :</span><br/><span class="value">${cartoucheInfo.editorName || "PD&I"}</span></td>
                <td><span class="label">Vérifié par :</span><br/><span class="value">${cartoucheInfo.verifierName || "INGÉNIEUR PIPE"}</span></td>
                <td colspan="2"><span class="label">Approuvé par (PD&I) :</span><br/><span class="value">${cartoucheInfo.approverName || "DIRECTION TECHNIQUE & PROJETS"}</span></td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 400); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintCavalier = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const svgElement = document.getElementById("cavalierSvgDiagram");
    const svgHtml = svgElement ? svgElement.outerHTML : "";

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <meta charset="utf-8" />
          <title>Plan_Lestage_Cavaliers_PD&I_Fasc7</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { width: 100%; max-width: 1000px; margin: 0 auto; border: 2px solid #0f172a; padding: 16px; box-sizing: border-box; }
            .title-box { text-align: center; background: #f1f5f9; border: 1.5px solid #0f172a; padding: 8px; font-weight: 900; text-transform: uppercase; font-size: 11px; margin-bottom: 12px; }
            .param-grid { width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; font-size: 9px; font-family: monospace; margin-bottom: 12px; }
            .param-grid td, .param-grid th { border: 1px solid #0f172a; padding: 6px 10px; text-align: center; }
            .param-grid th { background: #e2e8f0; font-weight: bold; }
            .drawing-box { border: 1.5px solid #0f172a; padding: 12px; text-align: center; background: #0f172a; margin-bottom: 12px; }
            .drawing-box svg { max-width: 100%; height: auto; max-height: 300px; }
            .notes { border: 1.5px solid #0f172a; padding: 8px 12px; font-size: 8.5px; font-family: monospace; background: #fafafa; margin-bottom: 12px; line-height: 1.5; }
            .cartouche { width: 100%; border-collapse: collapse; border: 2px solid #0f172a; }
            .cartouche td { border: 1px solid #0f172a; padding: 5px 8px; font-size: 8.5px; font-family: monospace; vertical-align: top; }
            .cartouche .label { font-weight: bold; text-transform: uppercase; color: #475569; }
            .cartouche .value { font-weight: 900; font-size: 9.5px; color: #000000; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0072bc; padding-bottom: 6px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <img src="/pdi-logo-horizontal.png" alt="PD&I Logo" style="height: 68px; width: 68px; min-width: 68px; object-fit: contain;" />
                <div>
                  <div style="font-size: 19px; font-weight: 900; color: #0072bc; font-family: 'Cairo', 'Amiri', 'Arial', sans-serif; line-height: 1.2;">
                    PD&I — PIPING DESIGN & ISOMETRICS
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #0072bc; font-family: 'Helvetica Neue', 'Arial', sans-serif; margin-top: 2px;">
                    Industrial Piping, Transport & Engineering Suite
                  </div>
                </div>
              </div>
              <div style="text-align: right; font-family: monospace; font-size: 9px; font-weight: 700;">
                <div style="color: #0072bc; font-weight: 900; font-size: 11px;">LESTAGE ET STABILISATION</div>
                <div>NORME : FASCICULE 7</div>
              </div>
            </div>

            <div class="title-box">
              STABILISATION PAR CAVALIERS EN BÉTON ARMÉ EN ZONE INONDABLE / OUEDS — FASCICULE 7
            </div>

            <table class="param-grid">
              <thead>
                <tr>
                  <th>Diamètre Revêtu (Dr)</th>
                  <th>Poids Tube (Wt)</th>
                  <th>Poids Revêtement (Wr)</th>
                  <th>Vol. Cavalier (Vc)</th>
                  <th>Facteur de Sécurité K</th>
                  <th>SPACEMENT MAXIMAL (X)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${pipeDiameterWithCoating} m</td>
                  <td>${pipeWeight} kg/m</td>
                  <td>${coatingWeight} kg/m</td>
                  <td>${cavalierVolume} m³</td>
                  <td>K = ${K_factor}</td>
                  <td><strong style="color: #0284c7; font-size: 12px;">${maxSpacingX > 0 ? maxSpacingX.toFixed(2) + " MÈTRES" : "N/A"}</strong></td>
                </tr>
              </tbody>
            </table>

            <div class="drawing-box">
              ${svgHtml}
            </div>

            <div class="notes">
              <strong>NOTES DE CALCUL DE LESTAGE ET ARCHIMÈDE (FASCICULE 7) :</strong><br/>
              • Dimensionnement calculé pour s'opposer à la poussée d'Archimède en cas de submersion totale de la conduite.<br/>
              • Bande élastomère/néoprène de protection de 5 mm sous le cavalier pour prévenir tout poinçonnement.<br/>
              • Spacement maximal entre deux cavaliers successifs : X = ${maxSpacingX > 0 ? maxSpacingX.toFixed(2) + " m" : "Calcul non valide"}.
            </div>

            <table class="cartouche">
              <tr>
                <td width="25%"><span class="label">Maître d'Ouvrage :</span><br/><span class="value">PD&I PIPELINE DESIGN & ISOMETRICS</span></td>
                <td width="25%"><span class="label">Ouvrage :</span><br/><span class="value">LESTAGE GAZODUC EN OUED</span></td>
                <td width="25%"><span class="label">N° Plan :</span><br/><span class="value">${cartoucheInfo.planNumber || "LES-FASC7-001"}</span></td>
                <td width="25%"><span class="label">Échelle & Date :</span><br/><span class="value">${cartoucheInfo.scale || "1 / 100"} | ${cartoucheInfo.date || "2026"}</span></td>
              </tr>
              <tr>
                <td><span class="label">Édité par :</span><br/><span class="value">${cartoucheInfo.editorName || "PD&I"}</span></td>
                <td><span class="label">Vérifié par :</span><br/><span class="value">${cartoucheInfo.verifierName || "INGÉNIEUR HYDRAULIQUE"}</span></td>
                <td colspan="2"><span class="label">Approuvé par (PD&I) :</span><br/><span class="value">${cartoucheInfo.approverName || "DIRECTION TECHNIQUE & PROJETS"}</span></td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 400); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };


  // Unified CAD Studio States
  const [croquisMode, setCroquisMode] = useState<"unifie">("unifie");
  const [isFullscreenCroquis, setIsFullscreenCroquis] = useState<boolean>(false);

  const [drawingTool, setDrawingTool] = useState<string>("select"); // "select" | "pan" | "cotation" | "pencil" | "square" | ...
  const [brushColor, setBrushColor] = useState<string>("#38bdf8"); // Cyan engineering color by default
  const [brushSize, setBrushSize] = useState<number>(3);
  const [canvasBackground, setCanvasBackground] = useState<"bleu" | "ardoise" | "blanc">("bleu");
  const [textToInsert, setTextToInsert] = useState<string>("");
  const [showTextInputModal, setShowTextInputModal] = useState<{ x: number, y: number } | null>(null);
  const [freehandCanvasDataUrl, setFreehandCanvasDataUrl] = useState<string | null>(null);

  // Zoom & Pan Navigation
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPos, setPanStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Grid Snap & Print Mode State
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const gridSize = 10;
  const [printColorMode, setPrintColorMode] = useState<"color" | "bw">("color");
  const [showPrintLayoutModal, setShowPrintLayoutModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showCartoucheEditModal, setShowCartoucheEditModal] = useState<boolean>(false);
  const [cartouchePosition, setCartouchePosition] = useState<"left" | "right">("left");
  const [printOrientation, setPrintOrientation] = useState<"landscape" | "portrait">("landscape");
  const [printIncludeCartouche, setPrintIncludeCartouche] = useState<boolean>(true);
  const [printIncludeCotations, setPrintIncludeCotations] = useState<boolean>(true);
  const [printScale, setPrintScale] = useState<string>("1:100");
  const [printZoneMode, setPrintZoneMode] = useState<"all" | "window">("all");

  // Redo Stack & Clipboard & Multi-touch
  const [shapesUndoStack, setShapesUndoStack] = useState<VectorShape[][]>([]);
  const [shapesRedoStack, setShapesRedoStack] = useState<VectorShape[][]>([]);
  const [clipboardShapes, setClipboardShapes] = useState<VectorShape[]>([]);
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);
  const [touchContextMenuPos, setTouchContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [cotationStartPoint, setCotationStartPoint] = useState<{ x: number; y: number } | null>(null);


  // Vector Drawing Tool States
  interface VectorShape {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number; // Angle in degrees (0 to 360)
    color: string;
    fillColor?: string;
    text: string;
    fontSize: number;
    fontFamily: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
  }

  // x/y are expressed in METERS relative to the plan center (same convention as
  // ouvrages/slabs xOffset/yOffset) — NOT legacy 750x480 canvas pixels anymore.
  // width/height stay in their original legacy px units; the render transform
  // rescales them automatically via scale(blueprintScale / 12).
  const [shapes, setShapes] = useState<VectorShape[]>([
    { id: '1', type: 'hatch', x: -8.33, y: -5, width: 220, height: 160, rotation: 0, color: '#475569', text: '', fontSize: 11, fontFamily: 'Inter', strokeWidth: 1.5 },
    { id: '2', type: 'square', x: -8.33, y: -5, width: 220, height: 160, rotation: 0, color: '#38bdf8', text: '', fontSize: 11, fontFamily: 'Inter', strokeWidth: 2 },
    { id: '3', type: 'filtre-separateur', x: -15.42, y: -5, width: 38, height: 38, rotation: 0, color: '#0284c7', text: '', fontSize: 11, fontFamily: 'Inter', strokeWidth: 2 },
    { id: '4', type: 'regulateur', x: -8.33, y: -5, width: 32, height: 32, rotation: 0, color: '#ea580c', text: '', fontSize: 11, fontFamily: 'Inter', strokeWidth: 2 },
    { id: '5', type: 'vanne', x: -1.25, y: -5, width: 32, height: 24, rotation: 0, color: '#ef4444', text: '', fontSize: 11, fontFamily: 'Inter', strokeWidth: 2 },
    { id: '6', type: 'text', x: -8.33, y: -14.17, width: 180, height: 30, rotation: 0, color: '#38bdf8', text: 'DALLE DE REGULATION (NEUVE)', fontSize: 12, fontFamily: 'Space Grotesk', strokeWidth: 1.5 },
    { id: '7', type: 'cotation', x: -8.33, y: 4.17, width: 220, height: 20, rotation: 0, color: '#cbd5e1', text: 'LARGEUR CLÔTURE : 21.00 m', fontSize: 10, fontFamily: 'JetBrains Mono', strokeWidth: 1.5 }
  ]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isSelectingBox, setIsSelectingBox] = useState<boolean>(false);
  const [initialDragPositions, setInitialDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  // AutoCAD Print Zone / Window selection state
  const [printZone, setPrintZone] = useState<{ x: number; y: number; width: number; height: number; enabled: boolean }>({
    x: 40,
    y: 30,
    width: 670,
    height: 420,
    enabled: false
  });
  const [printZoneToolActive, setPrintZoneToolActive] = useState<boolean>(false);
  const [isDrawingPrintZone, setIsDrawingPrintZone] = useState<boolean>(false);
  const [isResizingPrintZone, setIsResizingPrintZone] = useState<'br' | 'bl' | 'tr' | 'tl' | 'move' | null>(null);
  const [draggingShapeId, setDraggingShapeId] = useState<string | null>(null);
  const [rotatingShapeId, setRotatingShapeId] = useState<string | null>(null);
  const [resizingShapeId, setResizingShapeId] = useState<string | null>(null);
  const [resizingHandle, setResizingHandle] = useState<'br' | 'bl' | 'tr' | 'tl' | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if (e.key === " ") {
        if (!isInput && !isSpacePressed) {
          setIsSpacePressed(true);
        }
      }

      if (e.key === "Escape") {
        if (selectedSlabId) setSelectedSlabId(null);
        if (selectedAbriId) setSelectedAbriId(null);
        if (selectedMassifId) setSelectedMassifId(null);
        if (selectedGateId) setSelectedGateId(null);
        if (selectedShapeId || selectedShapeIds.length > 0) {
          setSelectedShapeId(null);
          setSelectedShapeIds([]);
        }
        if (selectionBox) setSelectionBox(null);
        if (isSelectingBox) setIsSelectingBox(false);
        if (printZoneToolActive) setPrintZoneToolActive(false);
        if (isFullscreenCroquis) setIsFullscreenCroquis(false);
        setCotationStartPoint(null);
      }

      if (!isInput) {
        const isCtrl = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        // Delete / Backspace (Touche SUPP)
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          if (selectedAbriId) {
            handleRemoveAbri(selectedAbriId);
          } else if (selectedMassifId) {
            handleRemoveMassif(selectedMassifId);
          } else if (selectedSlabId) {
            handleRemoveSlab(selectedSlabId);
          } else if (selectedGateId) {
            handleRemoveGate(selectedGateId);
          } else if (selectedOuvrageId && ouvrages.length > 1) {
            handleRemoveOuvrage(selectedOuvrageId);
          } else {
            deleteSelectedShapes();
          }
        }

        // Copy: Ctrl+C
        if (isCtrl && key === "c") {
          e.preventDefault();
          copySelectedShapes();
        }

        // Paste: Ctrl+V
        if (isCtrl && key === "v") {
          e.preventDefault();
          pasteCopiedShapes();
        }

        // Duplicate: Ctrl+D
        if (isCtrl && key === "d") {
          e.preventDefault();
          if (selectedAbriId) handleDuplicateAbri(selectedAbriId);
          else if (selectedMassifId) handleDuplicateMassif(selectedMassifId);
          else if (selectedSlabId) handleDuplicateSlab(selectedSlabId);
          else if (selectedOuvrageId) handleDuplicateOuvrage(selectedOuvrageId);
          else if (selectedGateId) handleDuplicateGate(selectedGateId);
          else duplicateSelectedShapes();
        }

        // Select All: Ctrl+A
        if (isCtrl && key === "a") {
          e.preventDefault();
          selectAllShapes();
        }

        // Undo: Ctrl+Z
        if (isCtrl && key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleCanvasUndo();
        }

        // Redo: Ctrl+Shift+Z or Ctrl+Y
        if ((isCtrl && key === "z" && e.shiftKey) || (isCtrl && key === "y")) {
          e.preventDefault();
          handleCanvasRedo();
        }

        // Bring Forward / To Front: Ctrl+] or Ctrl+Shift+]
        if (isCtrl && e.key === "]") {
          e.preventDefault();
          if (e.shiftKey) bringToFront();
          else bringForward();
        }

        // Send Backward / To Back: Ctrl+[ or Ctrl+Shift+[
        if (isCtrl && e.key === "[") {
          e.preventDefault();
          if (e.shiftKey) sendToBack();
          else sendBackward();
        }

        // Shortcut 'D' for Cotation tool (without Ctrl/Cmd)
        if (!isCtrl && key === "d") {
          e.preventDefault();
          setDrawingTool(prev => prev === "cotation" ? "select" : "cotation");
        }

        // Arrow keys nudge the selected ouvrage/slab/abri/massif/gate,
        // or the selected free-draw shape if none of those are selected.
        if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
          e.preventDefault();
          const realStep = e.shiftKey ? 1 : 0.1;
          const dxReal = key === "arrowleft" ? -realStep : key === "arrowright" ? realStep : 0;
          const dyReal = key === "arrowup" ? -realStep : key === "arrowdown" ? realStep : 0;
          if (selectedAbriId) {
            setAbris(prev => prev.map(a => a.id === selectedAbriId ? {
              ...a,
              xOffset: Math.round((a.xOffset + dxReal) * 10) / 10,
              yOffset: Math.round((a.yOffset + dyReal) * 10) / 10
            } : a));
          } else if (selectedMassifId) {
            setMassifs(prev => prev.map(m => m.id === selectedMassifId ? {
              ...m,
              xOffset: Math.round((m.xOffset + dxReal) * 10) / 10,
              yOffset: Math.round((m.yOffset + dyReal) * 10) / 10
            } : m));
          } else if (selectedSlabId) {
            setSlabs(prev => prev.map(s => s.id === selectedSlabId ? {
              ...s,
              xOffset: Math.round((s.xOffset + dxReal) * 10) / 10,
              yOffset: Math.round((s.yOffset + dyReal) * 10) / 10
            } : s));
          } else if (selectedOuvrageId) {
            setOuvrages(prev => prev.map(o => o.id === selectedOuvrageId ? {
              ...o,
              xOffset: Math.round((o.xOffset + dxReal) * 10) / 10,
              yOffset: Math.round((o.yOffset + dyReal) * 10) / 10
            } : o));
          } else if (selectedGateId) {
            const targetGate = gates.find(g => g.id === selectedGateId);
            if (targetGate) {
              const isHorizWall = targetGate.wall === "nord" || targetGate.wall === "sud";
              const delta = isHorizWall ? dxReal : dyReal;
              setGates(prev => prev.map(g => g.id === selectedGateId ? {
                ...g,
                offset: Math.max(0, Math.round((g.offset + delta) * 10) / 10)
              } : g));
            }
          } else {
            const step = e.shiftKey ? 10 : 1;
            if (key === "arrowleft") moveSelectedShapes(-step, 0);
            if (key === "arrowright") moveSelectedShapes(step, 0);
            if (key === "arrowup") moveSelectedShapes(0, -step);
            if (key === "arrowdown") moveSelectedShapes(0, step);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isFullscreenCroquis, selectedSlabId, selectedAbriId, selectedMassifId, selectedOuvrageId, selectedGateId, selectedShapeId, selectedShapeIds, shapes, slabs, abris, massifs, ouvrages, gates, clipboardShapes, isSpacePressed, shapesUndoStack, shapesRedoStack]);

  // Bending helpers
  const currentBending = COLD_BENDING_DATA[selectedBendingIndex];
  const availableThicknesses = Object.keys(currentBending.thicknesses).map(Number);
  const currentBendingRadius = currentBending.thicknesses[selectedThickness] || currentBending.thicknesses[availableThicknesses[0]];

  // Spare calculation
  const currentSpareRule = SPARE_PARTS_RULES.find((r) => r.id === selectedSpareId)!;
  const findActiveRange = (mi: number, rule: typeof currentSpareRule) => {
    return rule.ranges.find((range) => mi >= range.minMI && mi <= range.maxMI) || rule.ranges[0];
  };
  const activeRange = findActiveRange(miValue, currentSpareRule);
  const calculatedMr = activeRange.calc(miValue);

  // Cavalier Spacing Calculations (implements the Archimedes equation)
  const K_factor = 1.1;
  const numerator = 4 * (concreteDensity * cavalierVolume - K_factor * waterDensity * cavalierVolume);
  const denominator = K_factor * waterDensity * Math.PI * Math.pow(pipeDiameterWithCoating, 2) - 4 * (pipeWeight + coatingWeight);
  const maxSpacingX = denominator > 0 ? (numerator / denominator) : 0;

  // GAUVIN calculations (p. 111 C + Profil Altimétrique & Longueur)
  const innerDiameterGauvin = Math.max(1, diameterGauvin - 2 * thicknessGauvin); // mm
  const calculatedVVolume = (Math.PI * Math.pow(innerDiameterGauvin / 1000, 2) / 4) * (lengthKm * 1000); // m3
  const effectiveVVolume = useLengthForVolume ? calculatedVVolume : vVolume;

  const deltaZ = Math.max(0, altHigh - altLow); // m
  const deltaPhydro = (1000 * 9.81 * deltaZ) / 100000; // bar (~0.0981 bar par 10m)
  const pLowPoint = testPressureHigh + deltaPhydro; // bar au point le plus bas
  const hoopStressLow = (pLowPoint * diameterGauvin) / (20 * thicknessGauvin); // MPa (Contrainte circonférentielle au point bas)

  const E_modulus = 2.1e6; // bar
  const lambda_water = 48e-6;
  const deltaP0_denom = effectiveVVolume * 1000 * (lambda_water + diameterGauvin / (E_modulus * thicknessGauvin));
  const deltaP0 = deltaP0_denom > 0 ? (mBleed / deltaP0_denom) : 0;
  const ratioP1P0 = deltaP0 > 0 ? (measuredDrop / deltaP0) : 0;
  const maxAllowedRatio = diameterGauvin < 400 ? 0.90 : 0.95;
  const isAirTestOk = ratioP1P0 < maxAllowedRatio;

  // -------------------------------------------------------------
  // Calculator 6: Génie Civil Poste de Détente Calculations
  // -------------------------------------------------------------
  const stationDims = {
    small: { title: "2500 - 5000 Nm³/h", A: 28, B: 21, C: 15, D: 3, E: 10, F: 3 },
    medium: { title: "10000 - 20000 Nm³/h", A: 35, B: 21, C: 25, D: 4, E: 15, F: 4 },
    large: { title: "20000 - 30000 Nm³/h", A: 45, B: 24, C: 32, D: 4, E: 20, F: 4 }
  };
  const currentDims = stationDims[gcCapacity];

  // Areas
  const mainSlabArea = currentDims.C * currentDims.D;
  const preheaterSlabArea = currentDims.E * currentDims.F;

  // Volumes
  const mainSlabVolume = mainSlabArea * mainSlabThickness;
  const preheaterSlabVolume = preheaterSlabArea * preheaterSlabThickness;
  const totalConcreteVolume = mainSlabVolume + preheaterSlabVolume;

  // Material Quantities
  const totalCementKg = totalConcreteVolume * concreteDosage;
  const totalCementBags = Math.ceil(totalCementKg / 50);
  const totalSandM3 = totalConcreteVolume * 0.40; // 400 Liters per m3 of concrete
  const totalGravelM3 = totalConcreteVolume * 0.80; // 800 Liters per m3 of concrete
  const totalWaterLiters = totalConcreteVolume * 175; // 175 Liters per m3 of concrete
  const estimatedSteelKg = totalConcreteVolume * 80; // Standard 80kg/m³ for reinforced slabs

  // -------------------------------------------------------------
  // Calculator 7: Factory Tube Reception (API 5L) Calculations
  // -------------------------------------------------------------
  // Carbon Equivalent (IIW formula)
  const calculatedCE = chemC + (chemMn / 6) + ((chemCr + chemMo + chemV) / 5) + ((chemNi + chemCu) / 15);

  // Grade Limits Mapping
  const gradeLimits = {
    B: { ysMin: 245, ysMax: 450, utsMin: 415, utsMax: 760, elongMin: 22 },
    X42: { ysMin: 290, ysMax: 496, utsMin: 415, utsMax: 760, elongMin: 21 },
    X52: { ysMin: 360, ysMax: 530, utsMin: 460, utsMax: 760, elongMin: 20 },
    X60: { ysMin: 415, ysMax: 565, utsMin: 520, utsMax: 760, elongMin: 18 },
    X65: { ysMin: 450, ysMax: 600, utsMin: 535, utsMax: 760, elongMin: 18 },
    X70: { ysMin: 485, ysMax: 635, utsMin: 570, utsMax: 760, elongMin: 18 }
  };
  const activeGradeLimit = gradeLimits[pipeGrade];

  // Validation scores
  const isC_Ok = pslLevel === "PSL2" ? chemC <= 0.16 : chemC <= 0.22;
  const isMn_Ok = pslLevel === "PSL2" ? chemMn <= 1.40 : chemMn <= 1.20;
  const isP_Ok = pslLevel === "PSL2" ? chemP <= 0.025 : chemP <= 0.030;
  const isS_Ok = pslLevel === "PSL2" ? chemS <= 0.015 : chemS <= 0.030;
  const isCE_Ok = pslLevel === "PSL2" ? calculatedCE <= 0.43 : true;

  const isYS_Ok = mechYS >= activeGradeLimit.ysMin && mechYS <= activeGradeLimit.ysMax;
  const isUTS_Ok = mechUTS >= activeGradeLimit.utsMin && mechUTS <= activeGradeLimit.utsMax;
  const isElong_Ok = mechElong >= activeGradeLimit.elongMin;
  const isCharpy_Ok = pslLevel === "PSL2" ? mechCharpy >= 27 : true; // PD&I spec requires 27J min for PSL2

  const isOD_Ok = geomOD >= 0.995 * 323.8 && geomOD <= 1.005 * 323.8; // Tolerances +/- 0.5%
  const isThick_Ok = geomThick >= 0.90 * 8.0 && geomThick <= 1.15 * 8.0; // Tolerances -10% / +15%
  const isOval_Ok = geomOvality <= 1.0; // Max 1%
  const isStraight_Ok = geomStraightness <= 1.5; // Max 1.5mm/m

  const isTotalCompliant =
    isC_Ok && isMn_Ok && isP_Ok && isS_Ok && isCE_Ok &&
    isYS_Ok && isUTS_Ok && isElong_Ok && isCharpy_Ok &&
    isOval_Ok && isStraight_Ok;

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Freehand Canvas References & Methods
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const drawCanvasBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, bgTheme: "bleu" | "ardoise" | "blanc") => {
    ctx.save();
    ctx.fillStyle = bgTheme === "bleu" ? "#0f172a" : bgTheme === "ardoise" ? "#1e293b" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    const gridSize = 15;
    ctx.strokeStyle = bgTheme === "bleu" ? "#1e293b" : bgTheme === "ardoise" ? "#2d3748" : "#f1f5f9";
    ctx.lineWidth = 0.5;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw center crosshairs
    ctx.strokeStyle = bgTheme === "bleu" ? "#334155" : bgTheme === "ardoise" ? "#4a5568" : "#cbd5e1";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([5, 5]);
    
    // Horizontal center
    ctx.beginPath();
    ctx.moveTo(10, height / 2);
    ctx.lineTo(width - 10, height / 2);
    ctx.stroke();

    // Vertical center
    ctx.beginPath();
    ctx.moveTo(width / 2, 10);
    ctx.lineTo(width / 2, height - 10);
    ctx.stroke();

    ctx.setLineDash([]); // Reset dash
    ctx.restore();
  };

  const renderVectorShapeGraphic = (shape: VectorShape, strokeWidth: number, strokeDash: string) => {
    const w = shape.width;
    const h = shape.height;
    const color = shape.color;

    if (shape.type === 'square') {
      return (
        <rect
          x={-w/2}
          y={-h/2}
          width={w}
          height={h}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'rounded-rect') {
      return (
        <rect
          x={-w/2}
          y={-h/2}
          width={w}
          height={h}
          rx={8}
          ry={8}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'circle') {
      return (
        <ellipse
          cx={0}
          cy={0}
          rx={w/2}
          ry={h/2}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'triangle') {
      return (
        <polygon
          points={`0,${-h/2} ${w/2},${h/2} ${-w/2},${h/2}`}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'right-triangle') {
      return (
        <polygon
          points={`${-w/2},${-h/2} ${w/2},${h/2} ${-w/2},${h/2}`}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'diamond') {
      return (
        <polygon
          points={`0,${-h/2} ${w/2},0 0,${h/2} ${-w/2},0`}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'polygon') {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        pts.push(`${(w/2)*Math.cos(angle)},${(h/2)*Math.sin(angle)}`);
      }
      return (
        <polygon
          points={pts.join(' ')}
          fill={shape.fillColor || (color + "22")}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'double-arrow') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash}>
          <line x1={-w/2} y1={0} x2={w/2} y2={0} />
          {(shape.type === 'arrow' || shape.type === 'double-arrow') && (
            <polygon points={`${w/2},0 ${w/2 - 8},-4 ${w/2 - 8},4`} fill={color} stroke="none" />
          )}
          {shape.type === 'double-arrow' && (
            <polygon points={`${-w/2},0 ${-w/2 + 8},-4 ${-w/2 + 8},4`} fill={color} stroke="none" />
          )}
        </g>
      );
    } else if (shape.type === 'elbow-line') {
      return (
        <polyline
          points={`${-w/2},${-h/2} 0,${-h/2} 0,${h/2} ${w/2},${h/2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'curved-line') {
      return (
        <path
          d={`M ${-w/2} 0 Q 0 ${-h/2} ${w/2} 0`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    } else if (shape.type === 'hatch') {
      return (
        <g>
          <rect
            x={-w/2}
            y={-h/2}
            width={w}
            height={h}
            fill={color + "11"}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
          />
          <svg x={-w/2} y={-h/2} width={w} height={h} className="overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => {
              const offset = -h + i * 15;
              return (
                <line
                  key={i}
                  x1={offset}
                  y1={0}
                  x2={offset + h}
                  y2={h}
                  stroke={color}
                  strokeWidth="1"
                  opacity="0.4"
                />
              );
            })}
          </svg>
        </g>
      );
    } else if (shape.type === 'vanne' || shape.type === 'vanne-motorisee') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.3">
          <polygon points={`${-w/2},${-h/2} 0,0 ${-w/2},${h/2}`} />
          <polygon points={`${w/2},${-h/2} 0,0 ${w/2},${h/2}`} />
          <line x1={0} y1={0} x2={0} y2={-h * 0.7} />
          <line x1={-w/3} y1={-h * 0.7} x2={w/3} y2={-h * 0.7} />
          {shape.type === 'vanne-motorisee' && (
            <rect x={-w/4} y={-h * 0.95} width={w/2} height={h*0.3} fill={color} />
          )}
        </g>
      );
    } else if (shape.type === 'clapet') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={w/2} />
          <line x1={-w*0.35} y1={h*0.15} x2={w*0.25} y2={-h*0.25} />
        </g>
      );
    } else if (shape.type === 'filtre-gaz' || shape.type === 'filtre-separateur') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.15">
          <rect x={-w/2} y={-h/2} width={w} height={h} rx={4} />
          <line x1={-w/2} y1={-h/2} x2={w/2} y2={h/2} strokeDasharray="2 2" />
          <line x1={-w/2} y1={h/2} x2={w/2} y2={-h/2} strokeDasharray="2 2" />
          {shape.type === 'filtre-separateur' && (
            <path d={`M 0 ${-h/2} L 0 ${h/2}`} strokeWidth={strokeWidth + 1} />
          )}
        </g>
      );
    } else if (shape.type === 'regulateur') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.3">
          <polygon points={`0,${-h/2} ${w/2},0 0,${h/2} ${-w/2},0`} />
          <line x1={-w/2} y1={0} x2={w/2} y2={0} />
          <circle cx={0} cy={-h*0.15} r="2.5" fill={color} />
        </g>
      );
    } else if (shape.type === 'soupape') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <polygon points={`0,${-h/2} ${w/2},0 ${-w/2},0`} fill={color} fillOpacity="0.3" />
          <line x1={0} y1={0} x2={0} y2={h/2} />
          <line x1={-w/3} y1={h/2} x2={w/3} y2={h/2} />
        </g>
      );
    } else if (shape.type === 'gare-depart' || shape.type === 'gare-arrivee') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.2">
          <rect x={-w/2} y={-h/3} width={w*0.8} height={h*0.6} rx={3} />
          <path d={`M ${w*0.3} ${-h/2} L ${w/2} 0 L ${w*0.3} ${h/2} Z`} />
          <text x={0} y={3} fontSize="8" fontWeight="black" fill={color} textAnchor="middle" stroke="none">
            {shape.type === 'gare-depart' ? 'GD' : 'GA'}
          </text>
        </g>
      );
    } else if (shape.type === 'joint-isolant') {
      return (
        <g stroke={color} strokeWidth={strokeWidth}>
          <line x1={-w/2} y1={0} x2={-w/6} y2={0} />
          <line x1={w/6} y1={0} x2={w/2} y2={0} />
          <line x1={-w/6} y1={-h/2} x2={-w/6} y2={h/2} strokeWidth={strokeWidth + 1} />
          <line x1={w/6} y1={-h/2} x2={w/6} y2={h/2} strokeWidth={strokeWidth + 1} />
          <circle cx={0} cy={0} r="3" fill="#ef4444" stroke="none" />
        </g>
      );
    } else if (shape.type === 'manometre' || shape.type === 'transmetteur') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={-h*0.2} r={w*0.35} fill="#ffffff" />
          <line x1={0} y1={h*0.15} x2={0} y2={h/2} />
          <line x1={-w*0.15} y1={-h*0.2} x2={w*0.15} y2={-h*0.35} strokeWidth="1.5" />
          <text x={0} y={-h*0.1} fontSize="7" fontWeight="bold" fill={color} textAnchor="middle" stroke="none">
            {shape.type === 'manometre' ? 'PI' : 'PT'}
          </text>
        </g>
      );
    } else if (shape.type === 'rechauffeur') {
      let pathD = `M ${-w/2} 0`;
      for (let i = 0; i <= 6; i++) {
        const px = -w/2 + (i * w) / 6;
        const dy = (i % 2 === 0) ? -h*0.3 : h*0.3;
        pathD += ` L ${px} ${dy}`;
      }
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-w/2} y={-h/2} width={w} height={h} />
          <path d={pathD} />
        </g>
      );
    } else if (shape.type === 'odoriseur') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.2">
          <rect x={-w/3} y={-h/2} width={(w*2)/3} height={h} rx={2} />
          <text x={0} y={3} fontSize="7" fontWeight="bold" fill={color} textAnchor="middle" stroke="none">
            THT
          </text>
        </g>
      );
    } else if (shape.type === 'compteur') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.15">
          <circle cx={0} cy={0} r={w/2} />
          <line x1={-w/4} y1={0} x2={w/4} y2={0} />
          <line x1={0} y1={-h/4} x2={0} y2={h/4} />
        </g>
      );
    } else if (shape.type === 'torche-event') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <path d={`M ${-w/6} ${h/2} L ${-w/6} ${-h/4} L ${w/6} ${-h/4} L ${w/6} ${h/2}`} />
          <path d={`M 0 ${-h/4} L 0 ${-h/2} L ${w/4} ${-h/3} Z`} fill="#ef4444" stroke="none" />
        </g>
      );
    } else if (shape.type === 'chaudiere') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.15">
          <rect x={-w/2} y={-h/2} width={w} height={h} rx={4} />
          <circle cx={0} cy={0} r={w/3} />
        </g>
      );
    } else if (shape.type === 'protection-cathodique') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.15">
          <circle cx={0} cy={0} r={w/2} />
          <text x={0} y={3} fontSize="8" fontWeight="bold" fill={color} textAnchor="middle" stroke="none">
            PC
          </text>
        </g>
      );
    } else if (shape.type === 'text') {
      return (
        <text
          x={0}
          y={0}
          fill={color}
          fontSize={shape.fontSize || 12}
          fontFamily={shape.fontFamily || 'Inter'}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {shape.text || "TEXTE"}
        </text>
      );
    } else if (shape.type === 'cotation') {
      return (
        <g stroke={color} strokeWidth={strokeWidth || 1.5} fill={color}>
          <line x1={-w/2} y1={0} x2={w/2} y2={0} strokeDasharray={strokeDash} />
          <line x1={-w/2} y1={-6} x2={-w/2} y2={6} />
          <line x1={w/2} y1={-6} x2={w/2} y2={6} />
          <polygon points={`${-w/2},0 ${-w/2 + 8},-4 ${-w/2 + 8},4`} />
          <polygon points={`${w/2},0 ${w/2 - 8},-4 ${w/2 - 8},4`} />
          <text
            x={0}
            y={-4}
            fontSize={shape.fontSize || 10}
            fontFamily={shape.fontFamily || 'JetBrains Mono'}
            fontWeight="bold"
            textAnchor="middle"
            stroke="none"
          >
            {shape.text || "CÔTE"}
          </text>
        </g>
      );
    } else if (shape.type === 'portail_5m' || shape.type === 'portillon') {
      const isSmall = shape.type === 'portillon';
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-w/2} y={-h/2} width={w} height={h} rx={3} fill={color + "15"} strokeDasharray="4 2" />
          <line x1={-w/2} y1={0} x2={w/2} y2={0} strokeWidth={strokeWidth + 1} />
          <rect x={-w/2 - 3} y={-h/2} width={6} height={h} fill={color} />
          <rect x={w/2 - 3} y={-h/2} width={6} height={h} fill={color} />
          <path d={`M ${-w/2} 0 A ${w/2} ${w/2} 0 0 1 0 ${h/2}`} strokeDasharray="2 2" />
          {!isSmall && (
            <path d={`M ${w/2} 0 A ${w/2} ${w/2} 0 0 0 0 ${h/2}`} strokeDasharray="2 2" />
          )}
          <text x={0} y={-h/2 - 4} fontSize="9" fontWeight="extrabold" fill={color} textAnchor="middle" stroke="none">
            {shape.text || (isSmall ? "PORTILLON 1M" : "PORTAIL 5M")}
          </text>
        </g>
      );
    } else if (shape.type === 'gabions') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color + "22"}>
          <rect x={-w/2} y={-h/2} width={w} height={h} rx={2} stroke={color} />
          <line x1={-w/2} y1={-h/2} x2={w/2} y2={h/2} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
          <line x1={-w/2} y1={h/2} x2={w/2} y2={-h/2} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
          <rect x={-w/2 + 2} y={-h/2 + 2} width={w - 4} height={h - 4} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 3" />
          <text x={0} y={0} fontSize="8" fontWeight="black" fill={color} textAnchor="middle" dominantBaseline="middle" stroke="none">
            {shape.text || "MUR GABIONS"}
          </text>
        </g>
      );
    } else if (shape.type === 'ouvrage_bloc' || shape.type === 'massif_beton') {
      return (
        <g stroke={color} strokeWidth={strokeWidth}>
          <rect x={-w/2} y={-h/2} width={w} height={h} rx={4} fill={color + "20"} stroke={color} strokeDasharray={strokeDash} />
          <rect x={-w/2 + 4} y={-h/2 + 4} width={w - 8} height={h - 8} fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
          <text x={0} y={0} fontSize="9" fontWeight="black" fill={color} textAnchor="middle" dominantBaseline="middle" stroke="none">
            {shape.text || shape.type.toUpperCase()}
          </text>
        </g>
      );
    } else if (shape.type.startsWith('callout') || shape.type === 'note-frame') {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="#ffffff" fillOpacity="0.9">
          <rect x={-w/2} y={-h/2} width={w} height={h} rx={6} />
          <polygon points={`0,${h/2} 10,${h/2 + 10} 20,${h/2}`} fill="#ffffff" stroke={color} />
          <text
            x={0}
            y={0}
            fontSize={shape.fontSize || 10}
            fontFamily={shape.fontFamily || 'Inter'}
            fontWeight="bold"
            fill="#0f172a"
            textAnchor="middle"
            dominantBaseline="middle"
            stroke="none"
          >
            {shape.text || "LÉGENDE"}
          </text>
        </g>
      );
    } else {
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity="0.2">
          <circle cx={0} cy={0} r={w/2} />
          <text x={0} y={3} fontSize="8" fontWeight="bold" fill={color} textAnchor="middle" stroke="none">
            {shape.type.substring(0, 4).toUpperCase()}
          </text>
        </g>
      );
    }
  };

  const drawCanvasShape = (ctx: CanvasRenderingContext2D, shape: VectorShape) => {
    ctx.save();
    const w = shape.width;
    const h = shape.height;
    const color = shape.color;
    const strokeWidth = shape.strokeWidth || 2;

    ctx.translate(shape.x, shape.y);
    ctx.rotate(((shape.rotation || 0) * Math.PI) / 180);

    ctx.strokeStyle = color;
    ctx.fillStyle = shape.fillColor || (color + "22");
    ctx.lineWidth = strokeWidth;

    if (shape.strokeStyle === 'dashed') ctx.setLineDash([6, 4]);
    else if (shape.strokeStyle === 'dotted') ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);

    if (shape.type === 'square') {
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.strokeRect(-w/2, -h/2, w, h);
    } else if (shape.type === 'rounded-rect') {
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-w/2, -h/2, w, h, 8);
      } else {
        ctx.rect(-w/2, -h/2, w, h);
      }
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(0, 0, w/2, h/2, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(0, -h/2);
      ctx.lineTo(w/2, h/2);
      ctx.lineTo(-w/2, h/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'right-triangle') {
      ctx.beginPath();
      ctx.moveTo(-w/2, -h/2);
      ctx.lineTo(w/2, h/2);
      ctx.lineTo(-w/2, h/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(0, -h/2);
      ctx.lineTo(w/2, 0);
      ctx.lineTo(0, h/2);
      ctx.lineTo(-w/2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'polygon') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = (w/2) * Math.cos(angle);
        const py = (h/2) * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'double-arrow') {
      ctx.beginPath();
      ctx.moveTo(-w/2, 0);
      ctx.lineTo(w/2, 0);
      ctx.stroke();

      if (shape.type === 'arrow' || shape.type === 'double-arrow') {
        ctx.beginPath();
        ctx.moveTo(w/2, 0);
        ctx.lineTo(w/2 - 8, -4);
        ctx.lineTo(w/2 - 8, 4);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
      if (shape.type === 'double-arrow') {
        ctx.beginPath();
        ctx.moveTo(-w/2, 0);
        ctx.lineTo(-w/2 + 8, -4);
        ctx.lineTo(-w/2 + 8, 4);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    } else if (shape.type === 'elbow-line') {
      ctx.beginPath();
      ctx.moveTo(-w/2, -h/2);
      ctx.lineTo(0, -h/2);
      ctx.lineTo(0, h/2);
      ctx.lineTo(w/2, h/2);
      ctx.stroke();
    } else if (shape.type === 'curved-line') {
      ctx.beginPath();
      ctx.moveTo(-w/2, 0);
      ctx.quadraticCurveTo(0, -h/2, w/2, 0);
      ctx.stroke();
    } else if (shape.type === 'hatch') {
      ctx.fillStyle = color + "11";
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -h; i < w + h; i += 12) {
        ctx.moveTo(Math.max(-w/2, i), Math.max(-h/2, -w/2 - i));
        ctx.lineTo(Math.min(w/2, i + h), Math.min(h/2, h/2 + i));
      }
      ctx.stroke();
      ctx.restore();
    } else if (shape.type === 'vanne' || shape.type === 'vanne-motorisee') {
      ctx.fillStyle = color + "44";
      ctx.beginPath();
      ctx.moveTo(-w/2, -h/2); ctx.lineTo(0, 0); ctx.lineTo(-w/2, h/2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w/2, -h/2); ctx.lineTo(0, 0); ctx.lineTo(w/2, h/2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.7);
      ctx.moveTo(-w/3, -h * 0.7); ctx.lineTo(w/3, -h * 0.7);
      ctx.stroke();
      if (shape.type === 'vanne-motorisee') {
        ctx.fillStyle = color;
        ctx.fillRect(-w/4, -h * 0.95, w/2, h * 0.3);
      }
    } else if (shape.type === 'clapet') {
      ctx.beginPath();
      ctx.arc(0, 0, w/2, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w*0.35, h*0.15); ctx.lineTo(w*0.25, -h*0.25);
      ctx.stroke();
    } else if (shape.type === 'filtre-gaz' || shape.type === 'filtre-separateur') {
      ctx.fillStyle = color + "22";
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.save();
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(-w/2, -h/2); ctx.lineTo(w/2, h/2);
      ctx.moveTo(-w/2, h/2); ctx.lineTo(w/2, -h/2);
      ctx.stroke();
      ctx.restore();
      if (shape.type === 'filtre-separateur') {
        ctx.beginPath();
        ctx.moveTo(0, -h/2); ctx.lineTo(0, h/2);
        ctx.lineWidth = strokeWidth + 1;
        ctx.stroke();
      }
    } else if (shape.type === 'regulateur') {
      ctx.fillStyle = color + "44";
      ctx.beginPath();
      ctx.moveTo(0, -h/2); ctx.lineTo(w/2, 0); ctx.lineTo(0, h/2); ctx.lineTo(-w/2, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h*0.15, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (shape.type === 'soupape') {
      ctx.fillStyle = color + "44";
      ctx.beginPath();
      ctx.moveTo(0, -h/2); ctx.lineTo(w/2, 0); ctx.lineTo(-w/2, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, h/2);
      ctx.moveTo(-w/3, h/2); ctx.lineTo(w/3, h/2);
      ctx.stroke();
    } else if (shape.type === 'gare-depart' || shape.type === 'gare-arrivee') {
      ctx.fillStyle = color + "33";
      ctx.fillRect(-w/2, -h/3, w*0.8, h*0.6);
      ctx.strokeRect(-w/2, -h/3, w*0.8, h*0.6);
      ctx.beginPath();
      ctx.moveTo(w*0.3, -h/2); ctx.lineTo(w/2, 0); ctx.lineTo(w*0.3, h/2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.type === 'gare-depart' ? 'GD' : 'GA', 0, 0);
    } else if (shape.type === 'joint-isolant') {
      ctx.beginPath();
      ctx.moveTo(-w/2, 0); ctx.lineTo(-w/6, 0);
      ctx.moveTo(w/6, 0); ctx.lineTo(w/2, 0);
      ctx.stroke();
      ctx.lineWidth = strokeWidth + 1;
      ctx.beginPath();
      ctx.moveTo(-w/6, -h/2); ctx.lineTo(-w/6, h/2);
      ctx.moveTo(w/6, -h/2); ctx.lineTo(w/6, h/2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    } else if (shape.type === 'manometre' || shape.type === 'transmetteur') {
      ctx.beginPath();
      ctx.arc(0, -h*0.2, w*0.35, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, h*0.15); ctx.lineTo(0, h/2);
      ctx.moveTo(-w*0.15, -h*0.2); ctx.lineTo(w*0.15, -h*0.35);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.type === 'manometre' ? 'PI' : 'PT', 0, -h*0.1);
    } else if (shape.type === 'rechauffeur') {
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.beginPath();
      ctx.moveTo(-w/2, 0);
      for (let i = 0; i <= 6; i++) {
        const px = -w/2 + (i * w) / 6;
        const dy = (i % 2 === 0) ? -h*0.3 : h*0.3;
        ctx.lineTo(px, dy);
      }
      ctx.stroke();
    } else if (shape.type === 'odoriseur') {
      ctx.fillStyle = color + "33";
      ctx.fillRect(-w/3, -h/2, (w*2)/3, h);
      ctx.strokeRect(-w/3, -h/2, (w*2)/3, h);
      ctx.fillStyle = color;
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('THT', 0, 0);
    } else if (shape.type === 'compteur') {
      ctx.beginPath();
      ctx.arc(0, 0, w/2, 0, 2 * Math.PI);
      ctx.fillStyle = color + "22";
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w/4, 0); ctx.lineTo(w/4, 0);
      ctx.moveTo(0, -h/4); ctx.lineTo(0, h/4);
      ctx.stroke();
    } else if (shape.type === 'torche-event') {
      ctx.beginPath();
      ctx.moveTo(-w/6, h/2); ctx.lineTo(-w/6, -h/4); ctx.lineTo(w/6, -h/4); ctx.lineTo(w/6, h/2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -h/4); ctx.lineTo(0, -h/2);
      ctx.lineTo(w/4, -h/3); ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    } else if (shape.type === 'chaudiere') {
      ctx.fillStyle = color + "22";
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.beginPath();
      ctx.arc(0, 0, w/3, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'protection-cathodique') {
      ctx.fillStyle = color + "22";
      ctx.beginPath();
      ctx.arc(0, 0, w/2, 0, 2 * Math.PI);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PC', 0, 0);
    } else if (shape.type === 'text') {
      ctx.fillStyle = color;
      ctx.font = `bold ${shape.fontSize || 12}px "${shape.fontFamily || 'Inter'}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.text || 'TEXTE', 0, 0);
    } else if (shape.type === 'cotation') {
      ctx.beginPath();
      ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w/2, 0); ctx.lineTo(-w/2 + 8, -4); ctx.lineTo(-w/2 + 8, 4);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(w/2 - 8, -4); ctx.lineTo(w/2 - 8, 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      ctx.font = `bold ${shape.fontSize || 10}px "${shape.fontFamily || 'JetBrains Mono'}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(shape.text || 'CÔTE', 0, -4);
    } else if (shape.type.startsWith('callout') || shape.type === 'note-frame') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.beginPath();
      ctx.moveTo(0, h/2); ctx.lineTo(10, h/2 + 10); ctx.lineTo(20, h/2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${shape.fontSize || 10}px "${shape.fontFamily || 'Inter'}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.text || 'LÉGENDE', 0, 0);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, w/2, 0, 2 * Math.PI);
      ctx.fillStyle = color + "33";
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.type.substring(0, 4).toUpperCase(), 0, 0);
    }

    ctx.restore();
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 750;
        canvas.height = 480;
        drawCanvasBackground(ctx, canvas.width, canvas.height, canvasBackground);
      }
    }

    // Export canvas for cartouche drawing
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 750;
    exportCanvas.height = 480;
    const exportCtx = exportCanvas.getContext("2d");
    if (exportCtx) {
      drawCanvasBackground(exportCtx, 750, 480, canvasBackground);
      shapes.forEach((shape) => {
        drawCanvasShape(exportCtx, shape);
      });
      setFreehandCanvasDataUrl(exportCanvas.toDataURL());
    }
  }, [croquisMode, canvasBackground, shapes]);

  const getCoordinates = (e: any) => {
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    if (clientX === undefined || clientY === undefined) return null;

    // 1. Try canvas element
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    // 2. Fallback SVG element
    const svg = e.currentTarget?.ownerSVGElement || e.currentTarget?.closest?.('svg') || e.target?.ownerSVGElement || e.target?.closest?.('svg');
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox?.baseVal;
      const viewBoxW = viewBox?.width || 750;
      const viewBoxH = viewBox?.height || 480;
      const scaleX = viewBoxW / rect.width;
      const scaleY = viewBoxH / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    return null;
  };

  const stampStructure = (ctx: CanvasRenderingContext2D, x: number, y: number, stampType: string) => {
    ctx.save();
    ctx.lineWidth = 2;
    
    if (stampType === "tampon_dalle") {
      ctx.fillStyle = brushColor + "44"; // transparency
      ctx.strokeStyle = brushColor;
      ctx.fillRect(x - 55, y - 25, 110, 50);
      ctx.strokeRect(x - 55, y - 25, 110, 50);
      
      ctx.strokeStyle = brushColor + "77";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 50, y);
      ctx.lineTo(x + 50, y);
      ctx.stroke();

      ctx.fillStyle = canvasBackground === "blanc" ? "#0f172a" : "#ffffff";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DALLE BÉTON ARMÉ", x, y + 3);
      
    } else if (stampType === "tampon_cloture") {
      ctx.strokeStyle = brushColor;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x - 85, y - 50, 170, 100);
      
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = brushColor + "88";
      ctx.strokeRect(x - 77, y - 42, 154, 84);
      
      ctx.setLineDash([]);
      ctx.fillStyle = canvasBackground === "blanc" ? "#475569" : "#cbd5e1";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DOUBLE CLÔTURE DE SÉCURITÉ", x, y - 5);
      
    } else if (stampType === "tampon_gare") {
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor + "33";
      
      ctx.fillRect(x - 50, y - 8, 70, 16);
      ctx.strokeRect(x - 50, y - 8, 70, 16);
      
      ctx.fillRect(x + 20, y - 5, 25, 10);
      ctx.strokeRect(x + 20, y - 5, 25, 10);
      
      ctx.fillStyle = brushColor;
      ctx.fillRect(x - 56, y - 12, 6, 24);
      
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + 22);
      ctx.lineTo(x + 20, y + 22);
      ctx.stroke();
      
      ctx.fillStyle = canvasBackground === "blanc" ? "#0f172a" : "#ffffff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GARE DE RACLEUR", x + 5, y - 14);
      
    } else if (stampType === "tampon_vanne") {
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor + "33";
      
      ctx.beginPath();
      ctx.moveTo(x - 18, y - 10);
      ctx.lineTo(x, y);
      ctx.lineTo(x - 18, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x + 18, y - 10);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 18, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 14);
      ctx.moveTo(x - 10, y - 14);
      ctx.lineTo(x + 10, y - 14);
      ctx.stroke();
      
      ctx.fillStyle = canvasBackground === "blanc" ? "#0f172a" : "#ffffff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("VANNE", x, y + 18);
      
    } else if (stampType === "tampon_fleche") {
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor;
      
      ctx.beginPath();
      ctx.moveTo(x - 50, y);
      ctx.lineTo(x + 50, y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x - 50, y);
      ctx.lineTo(x - 44, y - 3);
      ctx.lineTo(x - 44, y + 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(x + 50, y);
      ctx.lineTo(x + 44, y - 3);
      ctx.lineTo(x + 44, y + 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = canvasBackground === "blanc" ? "#0f172a" : "#ffffff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("COTE : ___ m", x, y - 5);
    }
    ctx.restore();
  };

  // Vector shapes undo stack & helper
  const pushShapesUndo = (newShapes: VectorShape[]) => {
    setShapesUndoStack(prev => [...prev.slice(-50), shapes]);
    setShapesRedoStack([]); // reset redo stack on new action
    setShapes(newShapes);
  };

  const handleCanvasUndo = () => {
    if (shapesUndoStack.length === 0) return;
    const previous = shapesUndoStack[shapesUndoStack.length - 1];
    setShapesRedoStack(prev => [...prev.slice(-50), shapes]);
    setShapesUndoStack(prev => prev.slice(0, -1));
    setShapes(previous);
    setSelectedShapeId(null);
    setSelectedShapeIds([]);
  };

  const handleCanvasRedo = () => {
    if (shapesRedoStack.length === 0) return;
    const next = shapesRedoStack[shapesRedoStack.length - 1];
    setShapesUndoStack(prev => [...prev.slice(-50), shapes]);
    setShapesRedoStack(prev => prev.slice(0, -1));
    setShapes(next);
    setSelectedShapeId(null);
    setSelectedShapeIds([]);
  };

  const selectAllShapes = () => {
    const allIds = shapes.map(s => s.id);
    setSelectedShapeIds(allIds);
    if (allIds.length > 0) setSelectedShapeId(allIds[allIds.length - 1]);
  };

  const copySelectedShapes = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const selected = shapes.filter(s => targetIds.includes(s.id));
    setClipboardShapes(selected);
  };

  const pasteCopiedShapes = () => {
    if (clipboardShapes.length === 0) return;
    const newShapesToInsert: VectorShape[] = [];
    const newIds: string[] = [];
    clipboardShapes.forEach((s, idx) => {
      const newId = (Date.now() + idx).toString() + '_' + Math.random().toString(36).substring(2, 6);
      newShapesToInsert.push({
        ...s,
        id: newId,
        x: s.x + 20,
        y: s.y + 20
      });
      newIds.push(newId);
    });
    pushShapesUndo([...shapes, ...newShapesToInsert]);
    setSelectedShapeIds(newIds);
    setSelectedShapeId(newIds[newIds.length - 1]);
  };

  const duplicateSelectedShapes = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const dups: VectorShape[] = [];
    const newIds: string[] = [];
    shapes.forEach((s, idx) => {
      if (targetIds.includes(s.id)) {
        const newId = (Date.now() + idx).toString() + '_' + Math.random().toString(36).substring(2, 6);
        dups.push({ ...s, id: newId, x: s.x + 20, y: s.y + 20 });
        newIds.push(newId);
      }
    });
    if (dups.length > 0) {
      pushShapesUndo([...shapes, ...dups]);
      setSelectedShapeIds(newIds);
      setSelectedShapeId(newIds[newIds.length - 1]);
    }
  };

  const deleteSelectedShapes = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    pushShapesUndo(shapes.filter(s => !targetIds.includes(s.id)));
    setSelectedShapeIds([]);
    setSelectedShapeId(null);
  };

  const bringForward = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const newShapes = [...shapes];
    for (let i = newShapes.length - 2; i >= 0; i--) {
      if (targetIds.includes(newShapes[i].id) && !targetIds.includes(newShapes[i + 1].id)) {
        const temp = newShapes[i];
        newShapes[i] = newShapes[i + 1];
        newShapes[i + 1] = temp;
      }
    }
    pushShapesUndo(newShapes);
  };

  const sendBackward = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const newShapes = [...shapes];
    for (let i = 1; i < newShapes.length; i++) {
      if (targetIds.includes(newShapes[i].id) && !targetIds.includes(newShapes[i - 1].id)) {
        const temp = newShapes[i];
        newShapes[i] = newShapes[i - 1];
        newShapes[i - 1] = temp;
      }
    }
    pushShapesUndo(newShapes);
  };

  const bringToFront = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const selected = shapes.filter(s => targetIds.includes(s.id));
    const unselected = shapes.filter(s => !targetIds.includes(s.id));
    pushShapesUndo([...unselected, ...selected]);
  };

  const sendToBack = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const selected = shapes.filter(s => targetIds.includes(s.id));
    const unselected = shapes.filter(s => !targetIds.includes(s.id));
    pushShapesUndo([...selected, ...unselected]);
  };

  const alignShapes = (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length < 2) return;
    const selected = shapes.filter(s => targetIds.includes(s.id));
    const minX = Math.min(...selected.map(s => s.x));
    const maxX = Math.max(...selected.map(s => s.x));
    const minY = Math.min(...selected.map(s => s.y));
    const maxY = Math.max(...selected.map(s => s.y));
    const avgX = selected.reduce((sum, s) => sum + s.x, 0) / selected.length;
    const avgY = selected.reduce((sum, s) => sum + s.y, 0) / selected.length;

    const newShapes = shapes.map(s => {
      if (!targetIds.includes(s.id)) return s;
      let newX = s.x;
      let newY = s.y;
      if (mode === 'left') newX = minX;
      if (mode === 'right') newX = maxX;
      if (mode === 'center-h') newX = avgX;
      if (mode === 'top') newY = minY;
      if (mode === 'bottom') newY = maxY;
      if (mode === 'center-v') newY = avgY;
      return { ...s, x: newX, y: newY };
    });

    pushShapesUndo(newShapes);
  };

  const moveSelectedShapes = (dx: number, dy: number) => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return;
    const newShapes = shapes.map(s => {
      if (targetIds.includes(s.id)) {
        return { ...s, x: s.x + dx, y: s.y + dy };
      }
      return s;
    });
    pushShapesUndo(newShapes);
  };

  const getSelectedBoundingBox = () => {
    const targetIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : []);
    if (targetIds.length === 0) return null;
    const selected = shapes.filter(s => targetIds.includes(s.id));
    if (selected.length === 0) return null;

    let minX = 9999, minY = 9999, maxX = -9999, maxY = -9999;
    selected.forEach(s => {
      minX = Math.min(minX, s.x - s.width / 2);
      maxX = Math.max(maxX, s.x + s.width / 2);
      minY = Math.min(minY, s.y - s.height / 2);
      maxY = Math.max(maxY, s.y + s.height / 2);
    });
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  };

  const addVectorShape = (type: string, presetText?: string, presetColor?: string) => {
    const id = Date.now().toString();
    let color = presetColor || brushColor;
    let text = presetText || "";
    let width = 80;
    let height = 80;
    let fontSize = 11;
    let fontFamily = "Inter";
    let strokeWidth = 2;
    
    if (["line", "arrow", "double-arrow", "cotation", "elbow-line", "curved-line"].includes(type)) {
      width = 120;
      height = 24;
    }
    if (["portail_5m", "portillon"].includes(type)) {
      width = type === "portillon" ? 60 : 120;
      height = 36;
    }
    if (["gabions", "ouvrage_bloc", "massif_beton", "abri_tele", "dalle_beton"].includes(type)) {
      width = 110;
      height = 65;
    }
    if (["vanne", "vanne-motorisee", "clapet", "joint-isolant", "regulateur", "soupape", "manometre", "transmetteur", "filtre-gaz", "filtre-separateur", "rechauffeur", "odoriseur", "compteur", "gare-depart", "gare-arrivee", "torche-event", "chaudiere", "protection-cathodique"].includes(type)) {
      width = 36;
      height = 36;
    }
    if (type === "text") {
      text = textToInsert || "NOUVEAU TEXTE";
      width = 140;
      height = 30;
      fontSize = 12;
      fontFamily = "Space Grotesk";
    }
    if (type === "callout-rect" || type === "callout-oval" || type === "note-frame") {
      text = textToInsert || "LÉGENDE / REMARQUE";
      width = 140;
      height = 60;
      fontSize = 10;
    }
    if (type === "cotation") {
      text = textToInsert || "CÔTE : 10.00 m";
      fontSize = 10;
      fontFamily = "JetBrains Mono";
    }
    
    const newShape: VectorShape = {
      id,
      type,
      x: 0, // center of the plan (meters) — matches cX/cY of the live blueprint
      y: 0, // center of the plan (meters) — matches cX/cY of the live blueprint
      width,
      height,
      rotation: 0,
      color,
      text,
      fontSize,
      fontFamily,
      strokeWidth,
      strokeStyle: 'solid'
    };
    
    pushShapesUndo([...shapes, newShape]);
    setSelectedShapeId(id);
    setSelectedShapeIds([id]);
  };

  const startResize = (e: any, shapeId: string, handle: 'br' | 'bl' | 'tr' | 'tl') => {
    e.stopPropagation();
    if (e.preventDefault && e.cancelable) e.preventDefault();
    setSelectedShapeId(shapeId);
    setResizingShapeId(shapeId);
    setResizingHandle(handle);
  };

  const startRotate = (e: any, shapeId: string) => {
    e.stopPropagation();
    if (e.preventDefault && e.cancelable) e.preventDefault();
    setSelectedShapeId(shapeId);
    setRotatingShapeId(shapeId);
  };

  const startShapeDrag = (e: any, shape: VectorShape) => {
    e.stopPropagation();
    const coords = getCoordinates(e);
    if (!coords) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    let newSelected: string[];

    if (isCtrl) {
      if (selectedShapeIds.includes(shape.id)) {
        newSelected = selectedShapeIds.filter(id => id !== shape.id);
      } else {
        newSelected = [...selectedShapeIds, shape.id];
      }
    } else {
      if (selectedShapeIds.includes(shape.id) && selectedShapeIds.length > 1) {
        newSelected = selectedShapeIds;
      } else {
        newSelected = [shape.id];
      }
    }

    setSelectedShapeIds(newSelected);
    setSelectedShapeId(shape.id);
    setDraggingShapeId(shape.id);

    // Save initial positions of all selected shapes for group dragging
    const initPosMap: Record<string, { x: number; y: number }> = {};
    shapes.forEach(s => {
      if (newSelected.includes(s.id)) {
        initPosMap[s.id] = { x: s.x, y: s.y };
      }
    });
    setInitialDragPositions(initPosMap);

    setDragStartPos({
      pointerX: coords.x,
      pointerY: coords.y,
      initX: shape.x,
      initY: shape.y
    });
  };

  const fitPrintZoneToDrawing = () => {
    if (shapes.length === 0) {
      setPrintZone({ x: 40, y: 30, width: 670, height: 420, enabled: true });
      return;
    }
    let minX = 750, minY = 480, maxX = 0, maxY = 0;
    shapes.forEach(s => {
      minX = Math.min(minX, s.x - s.width / 2);
      maxX = Math.max(maxX, s.x + s.width / 2);
      minY = Math.min(minY, s.y - s.height / 2);
      maxY = Math.max(maxY, s.y + s.height / 2);
    });
    const padding = 25;
    const x = Math.max(0, Math.floor(minX - padding));
    const y = Math.max(0, Math.floor(minY - padding));
    const width = Math.min(750 - x, Math.ceil(maxX - minX + padding * 2));
    const height = Math.min(480 - y, Math.ceil(maxY - minY + padding * 2));

    setPrintZone({
      x,
      y,
      width: Math.max(60, width),
      height: Math.max(60, height),
      enabled: true
    });
  };

  const startFreehandDrawing = (e: any) => {
    if (drawingTool !== "pen") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    
    isDrawingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const drawFreehand = (e: any) => {
    if (!isDrawingRef.current || drawingTool !== "pen") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endFreehandDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleCanvasStart = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    // 1. If user active tool is drawing AutoCAD Print Zone Window
    if (printZoneToolActive) {
      setPrintZone({
        x: Math.round(coords.x),
        y: Math.round(coords.y),
        width: 20,
        height: 20,
        enabled: true
      });
      setIsDrawingPrintZone(true);
      return;
    }

    // 2. Find if we clicked inside any shape (top to bottom)
    const clickedShape = [...shapes].reverse().find(shape => {
      const halfW = shape.width / 2;
      const halfH = shape.height / 2;
      return coords.x >= shape.x - halfW && coords.x <= shape.x + halfW &&
             coords.y >= shape.y - halfH && coords.y <= shape.y + halfH;
    });

    if (clickedShape) {
      startShapeDrag(e, clickedShape);
    } else {
      // Clicked on empty canvas background -> start Marquee Box Selection
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) {
        setSelectedShapeIds([]);
        setSelectedShapeId(null);
      }
      setSelectionBox({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y
      });
      setIsSelectingBox(true);
    }
  };

  const handleCanvasMove = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    // Resizing or Moving AutoCAD Print Zone Frame
    if (isResizingPrintZone && printZone && dragStartPos) {
      const dx = coords.x - dragStartPos.pointerX;
      const dy = coords.y - dragStartPos.pointerY;
      let newX = printZone.x;
      let newY = printZone.y;
      let newW = printZone.width;
      let newH = printZone.height;

      if (isResizingPrintZone === 'move') {
        newX = Math.max(0, Math.min(750 - newW, dragStartPos.initX + dx));
        newY = Math.max(0, Math.min(480 - newH, dragStartPos.initY + dy));
      } else if (isResizingPrintZone === 'br') {
        newW = Math.max(40, Math.min(750 - newX, dragStartPos.initX + dx));
        newH = Math.max(40, Math.min(480 - newY, dragStartPos.initY + dy));
      } else if (isResizingPrintZone === 'tl') {
        const potentialW = dragStartPos.initX - dx;
        const potentialH = dragStartPos.initY - dy;
        if (potentialW >= 40) {
          newX = Math.max(0, coords.x);
          newW = printZone.x + printZone.width - newX;
        }
        if (potentialH >= 40) {
          newY = Math.max(0, coords.y);
          newH = printZone.y + printZone.height - newY;
        }
      }
      setPrintZone(prev => ({
        ...prev,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH)
      }));
      return;
    }

    // Drawing AutoCAD Print Zone Window
    if (isDrawingPrintZone && printZone) {
      const startX = printZone.x;
      const startY = printZone.y;
      const minX = Math.min(startX, coords.x);
      const minY = Math.min(startY, coords.y);
      const width = Math.max(30, Math.abs(coords.x - startX));
      const height = Math.max(30, Math.abs(coords.y - startY));
      setPrintZone(prev => ({
        ...prev,
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height)
      }));
      return;
    }

    // Marquee Selection Box Drag
    if (isSelectingBox && selectionBox) {
      const updatedBox = { ...selectionBox, currentX: coords.x, currentY: coords.y };
      setSelectionBox(updatedBox);

      const boxMinX = Math.min(updatedBox.startX, updatedBox.currentX);
      const boxMaxX = Math.max(updatedBox.startX, updatedBox.currentX);
      const boxMinY = Math.min(updatedBox.startY, updatedBox.currentY);
      const boxMaxY = Math.max(updatedBox.startY, updatedBox.currentY);

      // Find shapes intersecting or enclosed in selection box
      const newlyFound = shapes.filter(s => {
        const halfW = s.width / 2;
        const halfH = s.height / 2;
        const sMinX = s.x - halfW;
        const sMaxX = s.x + halfW;
        const sMinY = s.y - halfH;
        const sMaxY = s.y + halfH;
        return sMaxX >= boxMinX && sMinX <= boxMaxX && sMaxY >= boxMinY && sMinY <= boxMaxY;
      }).map(s => s.id);

      setSelectedShapeIds(newlyFound);
      setSelectedShapeId(newlyFound.length > 0 ? newlyFound[newlyFound.length - 1] : null);
      return;
    }

    if (resizingShapeId && resizingHandle) {
      const target = shapes.find(s => s.id === resizingShapeId);
      if (target) {
        const dx = coords.x - target.x;
        const dy = coords.y - target.y;
        
        const rad = -(target.rotation || 0) * (Math.PI / 180);
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        let newW = target.width;
        let newH = target.height;

        if (resizingHandle === 'br') {
          newW = Math.max(16, Math.round(localX * 2));
          newH = Math.max(16, Math.round(localY * 2));
        } else if (resizingHandle === 'bl') {
          newW = Math.max(16, Math.round(-localX * 2));
          newH = Math.max(16, Math.round(localY * 2));
        } else if (resizingHandle === 'tr') {
          newW = Math.max(16, Math.round(localX * 2));
          newH = Math.max(16, Math.round(-localY * 2));
        } else if (resizingHandle === 'tl') {
          newW = Math.max(16, Math.round(-localX * 2));
          newH = Math.max(16, Math.round(-localY * 2));
        }

        setShapes(prev => prev.map(s => s.id === resizingShapeId ? { ...s, width: newW, height: newH } : s));
      }
      return;
    }

    if (rotatingShapeId) {
      const target = shapes.find(s => s.id === rotatingShapeId);
      if (target) {
        const angleRad = Math.atan2(coords.y - target.y, coords.x - target.x);
        let angleDeg = Math.round(angleRad * (180 / Math.PI) + 90);
        if (angleDeg < 0) angleDeg += 360;
        angleDeg = angleDeg % 360;
        setShapes(prev => prev.map(s => s.id === rotatingShapeId ? { ...s, rotation: angleDeg } : s));
      }
      return;
    }

    if (draggingShapeId && dragStartPos) {
      const dx = coords.x - dragStartPos.pointerX;
      const dy = coords.y - dragStartPos.pointerY;

      setShapes(prev => prev.map(s => {
        if (initialDragPositions[s.id]) {
          return {
            ...s,
            x: Math.round(initialDragPositions[s.id].x + dx),
            y: Math.round(initialDragPositions[s.id].y + dy)
          };
        }
        return s;
      }));
    }
  };

  const handleCanvasEnd = () => {
    setDraggingShapeId(null);
    setRotatingShapeId(null);
    setResizingShapeId(null);
    setResizingHandle(null);
    setIsSelectingBox(false);
    setSelectionBox(null);
    setIsDrawingPrintZone(false);
    setIsResizingPrintZone(null);
    setPrintZoneToolActive(false);
    setInitialDragPositions({});
  };

  const handleCanvasUp = handleCanvasEnd;
  const handleShapeMouseDown = (e: any, shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (shape) startShapeDrag(e, shape);
  };
  const handleRotationMouseDown = (e: any, shapeId: string) => {
    startRotate(e, shapeId);
  };

  const handleCanvasClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    pushShapesUndo([]);
    setSelectedShapeId(null);
  };

  // Clean old duplicate canvas routines

  const handlePrintMtr = () => {
    const printContent = printAreaRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;
    if (printContent) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>PV de Réception de Tube en Usine</title>
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 8px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-b: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px; }
                .title { font-size: 20px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; }
                .meta-table { w-full; border-collapse: collapse; margin-bottom: 20px; }
                .meta-table td, .meta-table th { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; }
                .meta-table th { background-color: #f8fafc; text-align: left; }
                .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; }
                .grid-table { width: 100%; border-collapse: collapse; }
                .grid-table th, .grid-table td { border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 11px; text-align: center; }
                .grid-table th { background-color: #f8fafc; font-weight: bold; }
                .verdict { font-size: 16px; font-weight: bold; padding: 10px; text-align: center; margin-top: 25px; border-radius: 6px; }
                .compliant { background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
                .non-compliant { background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; }
                .signature-block { width: 30%; text-align: center; border-top: 1px solid #94a3b8; padding-top: 10px; }
              </style>
            </head>
            <body>
              <div class="container">${printContent}</div>
              <script>window.print();</script>
            </body>
          </html>
        `);
        win.document.close();
      }
    }
  };

  // Find active project for BPU
  const activeBordereauProject = bordereauSelectedProjectId === "all"
    ? (projects[0] || null)
    : (projects.find(p => p.id === bordereauSelectedProjectId) || null);

  // Dynamic characteristics and item arrays for BPU des Prix Generator
  const diamNum = activeBordereauProject ? parseFloat(activeBordereauProject.identity?.caracteristiques?.diametre?.replace(/[^0-9.]/g, '')) || 12 : 12;
  const longNum = activeBordereauProject ? parseFloat(activeBordereauProject.identity?.caracteristiques?.longueur?.replace(/[^0-9.]/g, '')) || 15 : 15;

  // 1. Études items
  const etudeItems = activeBordereauProject ? [
    {
      id: "impact",
      code: "1.1",
      designation: "Étude d'impact sur l'environnement (EIE) et notice d'impact hydraulique réglementaire",
      unit: "FF",
      qty: 1,
      price: bePrices.impact ?? 1500000,
      formula: "Forfait global réglementaire pour étude environnementale"
    },
    {
      id: "topo",
      code: "1.2",
      designation: "Levé topographique de précision, délimitation fine du tracé et piquetage de l'axe de l'ouvrage",
      unit: "km",
      qty: longNum,
      price: bePrices.topo ?? 45000,
      formula: `${longNum} km linéaires de conduite à arpenter`
    },
    {
      id: "geo",
      code: "1.3",
      designation: "Étude géotechnique de la plate-forme (Points de sondages, résistivité de sol et essais de laboratoire)",
      unit: "U",
      qty: Math.max(3, Math.ceil(longNum / 2)),
      price: bePrices.geo ?? 120000,
      formula: `1 point de sondage tous les 2 km (min. 3) pour ${longNum} km`
    },
    {
      id: "ing",
      code: "1.4",
      designation: "Calculs d'ingénierie détaillée, dimensionnement hydraulique, mécanique et plans d'exécution",
      unit: "FF",
      qty: 1,
      price: bePrices.ing ?? 3000000,
      formula: `Ingénierie de détail pour canalisation DN ${diamNum}"`
    },
    {
      id: "dup",
      code: "1.5",
      designation: "Établissement du dossier de Déclaration d'Utilité Publique (DUP) et dossier d'autorisation",
      unit: "FF",
      qty: 1,
      price: bePrices.dup ?? 800000,
      formula: "Instruction administrative réglementaire"
    }
  ] : [];

  // 2. Expertise items
  const expertItems = activeBordereauProject ? [
    {
      id: "enq",
      code: "2.1",
      designation: "Enquête foncière parcellaire et identification minutieuse des propriétaires de l'emprise",
      unit: "U (Prop.)",
      qty: Math.max(5, Math.round(longNum * 4)),
      price: gefPrices.enq ?? 150000,
      formula: `Estimation de 4 parcelles/propriétaires par km de tracé`
    },
    {
      id: "exp",
      code: "2.2",
      designation: "Établissement des états d'expertise contradictoires et barèmes réglementaires d'indemnisation des cultures",
      unit: "U (Dossier)",
      qty: Math.max(5, Math.round(longNum * 4)),
      price: gefPrices.exp ?? 80000,
      formula: "Un dossier d'expertise par parcelle identifiée"
    },
    {
      id: "assist",
      code: "2.3",
      designation: "Assistance d'expertise foncière pour servitudes de passage et constitution de l'arrêté de servitude",
      unit: "FF",
      qty: 1,
      price: gefPrices.assist ?? 250000,
      formula: "Suivi foncier global avec les collectivités locales"
    },
    {
      id: "cnd",
      code: "2.4",
      designation: "Contrôle non destructif (CND) systématique et radiographie intégrale (100%) des joints soudés",
      unit: "U (Joint)",
      qty: Math.round(longNum * 85),
      price: gefPrices.cnd ?? 4500,
      formula: `Estimation de 85 joints de soudure par km pour DN ${diamNum}"`
    },
    {
      id: "audit",
      code: "2.5",
      designation: "Contrôle technique de conformité des aciers (tubes et raccords), audit documentaire et certifications",
      unit: "HJ",
      qty: Math.max(10, Math.round(longNum * 2)),
      price: gefPrices.audit ?? 65000,
      formula: `Suivi d'expertise tierce-partie (2 HJ par km de tracé)`
    }
  ] : [];

  // 3. Travaux items
  const travauxItems = activeBordereauProject ? [
    {
      id: "piste",
      code: "3.1",
      designation: "Ouverture de piste, décapage de terre végétale et excavation de la tranchée (terrains divers)",
      unit: "m³",
      qty: Math.round(longNum * 1000 * (diamNum * 0.0254 + 0.6) * 1.5),
      price: travauxPrices.piste ?? 12000,
      formula: `Tranchée de section (DN + 0.6m) × Profondeur 1.5m sur ${longNum} km`
    },
    {
      id: "lit",
      code: "3.2",
      designation: "Fourniture, transport et mise en œuvre du lit de pose sablonneux d'épaisseur 20cm (protection de conduite)",
      unit: "m³",
      qty: Math.round(longNum * 1000 * (diamNum * 0.0254 + 0.6) * 0.2),
      price: travauxPrices.lit ?? 4000,
      formula: `Épaisseur de sable de 20cm dans le fond de la fouille`
    },
    {
      id: "soudage",
      code: "3.3",
      designation: "Cintrage à froid, alignement rigoureux et soudage HP (procédé homologué) de la conduite en acier",
      unit: "U (Joint)",
      qty: Math.round(longNum * 85),
      price: travauxPrices.soudage ?? 18000,
      formula: `Soudures HP qualifiées de tubes en acier (85 joints par km)`
    },
    {
      id: "enrobage",
      code: "3.4",
      designation: "Contrôle de l'enrobage isolant (Holiday detector), retouches et étanchéité de la conduite",
      unit: "FF",
      qty: 1,
      price: travauxPrices.enrobage ?? 85000,
      formula: "Revêtement anticorrosion et essais électriques d'enrobage"
    },
    {
      id: "gr_dep",
      code: "3.5",
      designation: "Génie Civil et montage mécanique de la Gare de Racleur de Départ (y compris robinetterie HP et bypass)",
      unit: "U",
      qty: activeBordereauProject.identity?.caracteristiques?.hasGareRacleurDepart ? 1 : 0,
      price: travauxPrices.gr_dep ?? 4500000,
      formula: activeBordereauProject.identity?.caracteristiques?.hasGareRacleurDepart ? "Inclus dans l'identité technique de l'ouvrage" : "Non configuré"
    },
    {
      id: "gr_arr",
      code: "3.6",
      designation: "Génie Civil et montage mécanique de la Gare de Racleur d'Arrivée (y compris filtres récepteurs et purges)",
      unit: "U",
      qty: activeBordereauProject.identity?.caracteristiques?.hasGareRacleurArrivee ? 1 : 0,
      price: travauxPrices.gr_arr ?? 4500000,
      formula: activeBordereauProject.identity?.caracteristiques?.hasGareRacleurArrivee ? "Inclus dans l'identité technique de l'ouvrage" : "Non configuré"
    },
    {
      id: "poste_coup",
      code: "3.7",
      designation: "Réalisation complète du Génie Civil, clôture de sécurité et équipements de Poste de Coupure ou Sectionnement",
      unit: "U",
      qty: (activeBordereauProject.identity?.caracteristiques?.hasPosteCoupure ? (activeBordereauProject.identity?.caracteristiques?.nbPostesCoupure || 1) : 0) + (activeBordereauProject.identity?.caracteristiques?.hasPosteSectionnement ? (activeBordereauProject.identity?.caracteristiques?.nbPostesSectionnement || 1) : 0),
      price: travauxPrices.poste_coup ?? 3500000,
      formula: `Postes configurés : Sectionnement (${activeBordereauProject.identity?.caracteristiques?.hasPosteSectionnement ? (activeBordereauProject.identity?.caracteristiques?.nbPostesSectionnement || 1) : 0}) + Coupure (${activeBordereauProject.identity?.caracteristiques?.hasPosteCoupure ? (activeBordereauProject.identity?.caracteristiques?.nbPostesCoupure || 1) : 0})`
    },
    {
      id: "poste_det",
      code: "3.8",
      designation: "Génie Civil, installation mécanique des skids de régulation, détendeurs et compteurs du Poste de Détente",
      unit: "U",
      qty: activeBordereauProject.identity?.caracteristiques?.hasPosteDetente ? 1 : 0,
      price: travauxPrices.poste_det ?? 15000000,
      formula: activeBordereauProject.identity?.caracteristiques?.hasPosteDetente ? "Inclus dans l'identité technique de l'ouvrage" : "Non configuré"
    },
    {
      id: "raccord",
      code: "3.9",
      designation: "Raccordement physique final sur piquage HP en service (vannes HP de garde, piquages de décharge)",
      unit: "FF",
      qty: activeBordereauProject.identity?.caracteristiques?.pointRaccordement ? 1 : 0,
      price: travauxPrices.raccord ?? 2500000,
      formula: activeBordereauProject.identity?.caracteristiques?.pointRaccordement ? `Point désigné : ${activeBordereauProject.identity?.caracteristiques?.pointRaccordement}` : "Aucun point de raccordement désigné"
    },
    {
      id: "protection",
      code: "3.10",
      designation: "Fourniture et mise en œuvre du système de protection cathodique (Soutirage actif d'anodes et coffret de mesure)",
      unit: "FF",
      qty: 1,
      price: travauxPrices.protection ?? 3500000,
      formula: "Système de protection active anticorrosion"
    },
    {
      id: "epreuve",
      code: "3.11",
      designation: "Épreuve d'endurance mécanique et test d'étanchéité sous pression d'eau de la canalisation",
      unit: "FF",
      qty: 1,
      price: travauxPrices.epreuve ?? 150000,
      formula: "Essai de tenue de pression"
    }
  ] : [];

  return (
    <div id="calculateurs-panel" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl">
          <Calculator className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Outils de Calcul Réglementaires</h2>
          <p className="text-sm text-slate-500">
            Calculateurs officiels basés sur les abaques, coefficients d'Archimède, dimensionnement génie civil, conformité API 5L et estimation du Bordereau des Prix (BPU).
          </p>
        </div>
      </div>

      {/* Horizontal Navigation Bar for Calculators & Tools */}
      <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3 space-y-2 mb-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-orange-500" />
            <span>Calculateurs & Outils Réglementaires</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">
            {activeTab === "spare" && "Fascicule 1 — Pièces de Rechange"}
            {activeTab === "emprise" && "Fascicule 2 — Emprise de Piste"}
            {activeTab === "bending" && "Fascicule 3 — Cintrage à Froid"}
            {activeTab === "cavalier" && "Fascicule 7 — Lestage & Cavalier"}
            {activeTab === "gauvin" && "Fascicule 5 — Test GAUVIN & Profil Hydrostatique"}
            {activeTab === "poste_gc" && "Génie Civil Poste de Gaz"}
            {activeTab === "reception_usine" && "Réception Tube Usine"}
            {activeTab === "poste_croquis" && "Concepteur de Croquis Génie Civil"}
            {activeTab === "bordereau" && "Bordereau des Prix Unitaires (BPU)"}
          </span>
        </div>
        
        {/* Sleek Grid Navigation — No Horizontal Scroll, All 9 Tabs Visible */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("spare")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "spare"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Pièces (Fasc. 1)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("emprise")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "emprise"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Emprise (Fasc. 2)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bending")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "bending"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Cintrage (Fasc. 3)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cavalier")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "cavalier"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Waves className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Lestage (Fasc. 7)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gauvin")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "gauvin"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">GAUVIN (Fasc. 5)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("poste_gc")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "poste_gc"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Construction className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Génie Civil Poste</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reception_usine")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "reception_usine"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Réception Tube</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("poste_croquis")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "poste_croquis"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0 text-amber-300 animate-pulse" />
            <span className="truncate">Croquis & CAD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bordereau")}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-black transition-all border text-center cursor-pointer ${
              activeTab === "bordereau"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-800 shadow-md shadow-orange-500/20 ring-2 ring-orange-500/30 scale-[1.02]"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">BPU & Prix</span>
          </button>
        </div>
      </div>

      {/* Content Pane - Full Width */}
      <div className="w-full min-w-0">
        {activeTab === "spare" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Type de matériel ou raccord :</label>
                <select
                  value={selectedSpareId}
                  onChange={(e) => setSelectedSpareId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-orange-500"
                >
                  {SPARE_PARTS_RULES.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  Quantité Installée (M.I.) ({currentSpareRule.unit}) :
                </label>
                <input
                  type="number"
                  min="1"
                  value={miValue}
                  onChange={(e) => setMiValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 text-xs text-orange-800 space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-orange-500" />
                  Règles de Calcul Officielles :
                </p>
                <p>M.I = Quantité installée sur site par l'Entrepreneur.</p>
                <p>M.R = Quantité minimale de rechange à fournir obligatoirement.</p>
                <p>Tout arrondi pour calcul en pourcentage se fait à l'unité supérieure (Ex. 4.2 devient 5).</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Formule & Résultats</span>
                
                <div className="border-b border-slate-200 pb-4">
                  <p className="text-xs text-slate-500 font-medium">Formule réglementaire applicable :</p>
                  <p className="text-sm font-bold text-slate-700 mt-1 bg-white px-3 py-1.5 rounded-lg border border-slate-150 inline-block">{activeRange.mrFormula}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 font-medium">Quantité de rechange exigible (M.R.) :</p>
                  <p className="text-4xl font-black text-blue-600 mt-1.5 flex items-baseline gap-1">
                    <span>{calculatedMr}</span>
                    <span className="text-sm font-normal text-slate-500">{currentSpareRule.unit}</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-400 italic">
                Conforme au Tableau des Rechanges, Fascicule 1, Page 14.
              </div>
            </div>
          </div>
        )}

        {activeTab === "emprise" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Diamètre nominal de la canalisation :</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {RIGHT_OF_WAY_TABLE.map((row, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedRowIndex(idx)}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      selectedRowIndex === idx
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {row.diameterInches} ({row.diameterMm} mm)
                  </button>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Spécification des Servitudes :
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  L'emprise totale est libérée temporairement pour permettre le passage des excavateurs, le stockage latéral de la terre meuble et le déplacement continu du matériel de bardage et de soudage.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider text-slate-400">Occupation Temporaire Autorisée</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Bande de passage (A)</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{RIGHT_OF_WAY_TABLE[selectedRowIndex].a} m</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Servitude Droite (B)</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{RIGHT_OF_WAY_TABLE[selectedRowIndex].b} m</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Servitude Gauche (C)</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{RIGHT_OF_WAY_TABLE[selectedRowIndex].c} m</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cordon Déblais (D)</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{RIGHT_OF_WAY_TABLE[selectedRowIndex].d} m</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">Largeur totale d'emprise de la piste :</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{RIGHT_OF_WAY_TABLE[selectedRowIndex].total} mètres</p>
              </div>
            </div>
          </div>

          {/* SCHÉMA TECHNIQUE DESSIN INTERACTIF — EMPRISE DE PISTE (FASC. 2) */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400">
                  Schéma & Dessin Technique de Profil — Emprise de Piste (Fasc. 2)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-cyan-950 text-cyan-300 font-mono font-bold px-3 py-1 rounded-full border border-cyan-800/80 self-start sm:self-auto">
                  Tube Ø {RIGHT_OF_WAY_TABLE[selectedRowIndex].diameterInches} ({RIGHT_OF_WAY_TABLE[selectedRowIndex].diameterMm} mm)
                </span>
                <button
                  type="button"
                  onClick={handlePrintEmprise}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[11px] font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer Plan & Cartouche (PDF)</span>
                </button>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex justify-center items-center overflow-x-auto">
              <svg id="empriseSvgDiagram" viewBox="0 0 840 340" className="w-full max-w-4xl h-auto">
                <defs>
                  <pattern id="gridEmprise" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
                  </pattern>
                  <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#334155"/>
                    <stop offset="100%" stopColor="#0f172a"/>
                  </linearGradient>
                  <linearGradient id="pipeMetalGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8"/>
                    <stop offset="50%" stopColor="#0284c7"/>
                    <stop offset="100%" stopColor="#0369a1"/>
                  </linearGradient>
                  <linearGradient id="spoilGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97706"/>
                    <stop offset="100%" stopColor="#78350f"/>
                  </linearGradient>
                </defs>
                
                {/* Background Grid */}
                <rect width="840" height="340" fill="url(#gridEmprise)" />

                {/* Sky / Air label */}
                <text x="50" y="30" fill="#64748b" fontSize="10" fontWeight="bold">SURFACE DU SOL NATUREL</text>

                {/* Natural Ground Surface line */}
                <path d="M 40 180 L 260 180 Q 280 180 290 180 M 470 180 L 800 180" stroke="#94a3b8" strokeWidth="2.5" fill="none" strokeDasharray="6 3"/>
                <rect x="40" y="180" width="760" height="100" fill="url(#groundGrad)" opacity="0.35"/>

                {/* Excavated Trench (Tranchée au centre) */}
                <polygon points="290,180 310,245 450,245 470,180" fill="#020617" stroke="#38bdf8" strokeWidth="2.5"/>
                
                {/* Trench Sand Bedding */}
                <rect x="315" y="235" width="130" height="10" fill="#f59e0b" opacity="0.4" rx="2"/>

                {/* Pipeline inside Trench */}
                <circle cx="380" cy="210" r="23" fill="url(#pipeMetalGrad)" stroke="#ffffff" strokeWidth="2"/>
                <circle cx="380" cy="210" r="16" fill="none" stroke="#0f172a" strokeWidth="2"/>
                <text x="380" y="214" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
                  {RIGHT_OF_WAY_TABLE[selectedRowIndex].diameterInches}
                </text>

                {/* Spoil Heap / Merlon de déblais (Cordon D) on the left */}
                <path d="M 80 180 Q 150 100 220 180 Z" fill="url(#spoilGrad)" opacity="0.8" stroke="#f59e0b" strokeWidth="2"/>
                <text x="150" y="145" fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle">
                  Déblais (D) = {RIGHT_OF_WAY_TABLE[selectedRowIndex].d}m
                </text>
                <text x="150" y="162" fill="#fde68a" fontSize="9" textAnchor="middle">Stockage terre meuble</text>

                {/* Working Track (Bande B) on the right */}
                <rect x="490" y="175" width="290" height="10" fill="#10b981" rx="2"/>
                <text x="635" y="162" fill="#6ee7b7" fontSize="11" fontWeight="bold" textAnchor="middle">
                  Piste de Travail (B) = {RIGHT_OF_WAY_TABLE[selectedRowIndex].b}m
                </text>
                <text x="635" y="145" fill="#a7f3d0" fontSize="9" textAnchor="middle">Passage engins & bardage</text>

                {/* Left Servitude (C) */}
                <line x1="220" y1="170" x2="290" y2="170" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3 2"/>
                <text x="255" y="162" fill="#93c5fd" fontSize="10" fontWeight="bold" textAnchor="middle">
                  C = {RIGHT_OF_WAY_TABLE[selectedRowIndex].c}m
                </text>

                {/* Trench Depth Indicator */}
                <line x1="475" y1="180" x2="475" y2="245" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="2 2"/>
                <text x="490" y="215" fill="#c084fc" fontSize="9" fontWeight="bold">H ≥ 1.0 m</text>

                {/* Boundary Safety Fence Left & Right */}
                <line x1="40" y1="140" x2="40" y2="180" stroke="#ef4444" strokeWidth="3"/>
                <circle cx="40" cy="140" r="4" fill="#ef4444"/>
                <text x="40" y="130" fill="#fca5a5" fontSize="9" textAnchor="middle" fontWeight="bold">Limite Emprise</text>

                <line x1="800" y1="140" x2="800" y2="180" stroke="#ef4444" strokeWidth="3"/>
                <circle cx="800" cy="140" r="4" fill="#ef4444"/>
                <text x="800" y="130" fill="#fca5a5" fontSize="9" textAnchor="middle" fontWeight="bold">Limite Emprise</text>

                {/* Dimension Line Total A */}
                <line x1="40" y1="290" x2="800" y2="290" stroke="#38bdf8" strokeWidth="2.5"/>
                <polygon points="40,290 50,285 50,295" fill="#38bdf8"/>
                <polygon points="800,290 790,285 790,295" fill="#38bdf8"/>
                
                <rect x="290" y="276" width="260" height="28" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="2"/>
                <text x="420" y="295" fill="#38bdf8" fontSize="13" fontWeight="900" textAnchor="middle">
                  LARGEUR TOTALE (A) = {RIGHT_OF_WAY_TABLE[selectedRowIndex].total} MÈTRES
                </text>
              </svg>
            </div>
            <p className="text-[10px] text-slate-400 text-center italic">
              Conforme à l'Abaque Réglementaire Fascicule 2 — Pistes de Travail et Servitudes Gazoducs PD&I.
            </p>
          </div>
        </div>
      )}

        {activeTab === "bending" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Sélectionner le Diamètre Nominal (Pouces) :</label>
                <select
                  value={selectedBendingIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    setSelectedBendingIndex(idx);
                    const keys = Object.keys(COLD_BENDING_DATA[idx].thicknesses);
                    setSelectedThickness(Number(keys[0]));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-orange-500"
                >
                  {COLD_BENDING_DATA.map((item, idx) => (
                    <option key={idx} value={idx}>
                      {item.diameterInches}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Épaisseur de paroi du tube (mm) :</label>
                <select
                  value={selectedThickness}
                  onChange={(e) => setSelectedThickness(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-orange-500"
                >
                  {availableThicknesses.map((th) => (
                    <option key={th} value={th}>
                      {th} mm
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Spécifications de Cintrage</span>
                
                <div>
                  <p className="text-xs text-slate-500">Plaque de gabarit de vérification minimale :</p>
                  <p className="text-lg font-bold text-slate-800 mt-1">{currentBending.gaugePlateDiameter} mm</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 font-semibold text-slate-600">Rayon minimal de cintrage réglementaire à froid :</p>
                  <p className="text-4xl font-black text-blue-600 mt-1 flex items-baseline gap-1">
                    <span>{currentBendingRadius}</span>
                    <span className="text-sm font-normal text-slate-500">Mètres</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-400">
                Conforme à l'Annexe 12, Fascicule 7, Page 138.
              </div>
            </div>
          </div>

          {/* SCHÉMA TECHNIQUE DESSIN INTERACTIF — CINTRAGE À FROID (FASC. 3) */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Schéma Cinématique & Machine — Cintrage à Froid sur Chantier (Fasc. 3)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-950 text-amber-300 font-mono font-bold px-3 py-1 rounded-full border border-amber-800/80 self-start sm:self-auto">
                  DN {currentBending.diameterInches} | e = {selectedThickness} mm
                </span>
                <button
                  type="button"
                  onClick={handlePrintBending}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer Plan & Cartouche (PDF)</span>
                </button>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex justify-center items-center overflow-x-auto">
              <svg id="bendingSvgDiagram" viewBox="0 0 840 320" className="w-full max-w-4xl h-auto">
                <defs>
                  <pattern id="gridBending" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
                  </pattern>
                  <linearGradient id="pipeArcGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#38bdf8"/>
                    <stop offset="50%" stopColor="#fbbf24"/>
                    <stop offset="100%" stopColor="#38bdf8"/>
                  </linearGradient>
                </defs>
                <rect width="840" height="320" fill="url(#gridBending)" />

                {/* Machine Frame / Base */}
                <rect x="60" y="250" width="720" height="20" fill="#334155" rx="4"/>
                <text x="420" y="265" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
                  BANC DE CINTRAGE HYDRAULIQUE SUR CHANTIER
                </text>

                {/* Left Support Die */}
                <path d="M 120 250 L 140 200 L 180 200 L 200 250 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1.5"/>
                <circle cx="160" cy="200" r="12" fill="#64748b"/>

                {/* Right Support Die */}
                <path d="M 640 250 L 660 200 L 700 200 L 720 250 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1.5"/>
                <circle cx="680" cy="200" r="12" fill="#64748b"/>

                {/* Curved Bent Pipe Arc */}
                <path d="M 100 220 Q 420 80 740 220" stroke="url(#pipeArcGrad)" strokeWidth="18" fill="none" strokeLinecap="round"/>
                <path d="M 100 220 Q 420 80 740 220" stroke="#0284c7" strokeWidth="10" fill="none" strokeLinecap="round"/>

                {/* Center Hydraulic Bending Ram */}
                <rect x="390" y="20" width="60" height="50" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2"/>
                <text x="420" y="42" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">VÉRIN</text>
                
                {/* Piston Rod pushing down */}
                <rect x="412" y="70" width="16" height="50" fill="#cbd5e1"/>
                <polygon points="420,130 405,115 435,115" fill="#ef4444"/>
                <text x="450" y="95" fill="#ef4444" fontSize="10" fontWeight="bold">Effort F (kN)</text>

                {/* Curvature Radius Line to Center */}
                <line x1="420" y1="280" x2="420" y2="135" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2"/>
                <polygon points="420,135 414,145 426,145" fill="#f59e0b"/>
                
                <rect x="300" y="165" width="240" height="30" rx="8" fill="#0f172a" stroke="#f59e0b" strokeWidth="2"/>
                <text x="420" y="184" fill="#f59e0b" fontSize="13" fontWeight="900" textAnchor="middle">
                  RAYON R MIN = {currentBendingRadius} MÈTRES
                </text>

                {/* Gauge Plate Verification Badge */}
                <g transform="translate(620, 40)">
                  <rect x="0" y="0" width="170" height="60" rx="8" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.5"/>
                  <text x="85" y="22" fill="#a5b4fc" fontSize="9" fontWeight="bold" textAnchor="middle">PLAQUE DE GABARIT</text>
                  <text x="85" y="44" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle">Ø {currentBending.gaugePlateDiameter} mm</text>
                </g>
              </svg>
            </div>
            <p className="text-[10px] text-slate-400 text-center italic">
              Rayon minimal autorisé sans ovalisation nocive ni plissement de génératrice (Fascicule 3).
            </p>
          </div>
        </div>
      )}

      {activeTab === "cavalier" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-blue-600" />
                Calcul de l'Équilibre d'Archimède (Lestage)
              </h3>
              <p className="text-xs text-slate-500">
                Détermine la distance maximale autorisée entre deux blocs de lestage (cavaliers) pour s'opposer à la force de flottaison dans les oueds et zones inondables.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Poids du tube (Wt) (kg/m) :</label>
                  <input
                    type="number"
                    value={pipeWeight}
                    onChange={(e) => setPipeWeight(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Poids du revêtement (Wr) (kg/m) :</label>
                  <input
                    type="number"
                    value={coatingWeight}
                    onChange={(e) => setWr(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Vol. d'un cavalier (Vc) (m³) :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cavalierVolume}
                    onChange={(e) => setVc(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Diamètre extérieur revêtu (Dr) (m) :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pipeDiameterWithCoating}
                    onChange={(e) => setDr(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Distance Maximale (x)</span>
                <div>
                  <p className="text-xs text-slate-500">Seuil de Flottaison (K = {K_factor}) :</p>
                  <p className="text-2xl font-black text-blue-600 mt-1">
                    {maxSpacingX > 0 ? `${maxSpacingX.toFixed(2)} m` : "Calcul Impossible (Densité trop élevée)"}
                  </p>
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold">Note de calcul (p. 152) :</span> Le lestage doit garantir une flottabilité négative d'au moins 10% par rapport au volume déplacé.
                </div>
              </div>
            </div>
          </div>

          {/* SCHÉMA TECHNIQUE DESSIN INTERACTIF — LESTAGE & CAVALIER (FASC. 7) */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-400">
                  Schéma de Principe & Coupe — Lestage par Cavaliers en Béton Armé (Fasc. 7)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-950 text-blue-300 font-mono font-bold px-3 py-1 rounded-full border border-blue-800/80 self-start sm:self-auto">
                  Spacement Max X = {maxSpacingX > 0 ? `${maxSpacingX.toFixed(2)} m` : "N/A"}
                </span>
                <button
                  type="button"
                  onClick={handlePrintCavalier}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer Plan & Cartouche (PDF)</span>
                </button>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex justify-center items-center overflow-x-auto">
              <svg id="cavalierSvgDiagram" viewBox="0 0 840 340" className="w-full max-w-4xl h-auto">
                <defs>
                  <pattern id="gridCavalier" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
                  </pattern>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#075985" stopOpacity="0.8"/>
                  </linearGradient>
                </defs>
                <rect width="840" height="340" fill="url(#gridCavalier)" />

                {/* Water Table Submerged Layer */}
                <rect x="40" y="60" width="760" height="210" fill="url(#waterGrad)" rx="8"/>
                <line x1="40" y1="75" x2="800" y2="75" stroke="#38bdf8" strokeWidth="2" strokeDasharray="8 4"/>
                <text x="60" y="68" fill="#38bdf8" fontSize="10" fontWeight="bold">NIVEAU DE LA NAPPE PHRÉATIQUE / OUED EN CRUE</text>

                {/* Pipeline Longitudinal Axis */}
                <rect x="40" y="160" width="760" height="36" fill="#334155" stroke="#94a3b8" strokeWidth="2.5" rx="4"/>
                <line x1="40" y1="178" x2="800" y2="178" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 3"/>
                <text x="420" y="182" fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle">
                  GAZODUC REVÊTU Ø {pipeDiameterWithCoating} m
                </text>

                {/* Concrete Saddle 1 (Left) */}
                <g transform="translate(180, 115)">
                  <path d="M 0 0 L 70 0 L 70 110 L 52 110 L 52 75 L 18 75 L 18 110 L 0 110 Z" fill="#78716c" stroke="#f59e0b" strokeWidth="2"/>
                  <text x="35" y="-10" fill="#fef08a" fontSize="10" fontWeight="bold" textAnchor="middle">Cavalier 1</text>
                  <text x="35" y="45" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">{cavalierVolume} m³</text>
                </g>

                {/* Concrete Saddle 2 (Right) */}
                <g transform="translate(590, 115)">
                  <path d="M 0 0 L 70 0 L 70 110 L 52 110 L 52 75 L 18 75 L 18 110 L 0 110 Z" fill="#78716c" stroke="#f59e0b" strokeWidth="2"/>
                  <text x="35" y="-10" fill="#fef08a" fontSize="10" fontWeight="bold" textAnchor="middle">Cavalier 2</text>
                  <text x="35" y="45" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">{cavalierVolume} m³</text>
                </g>

                {/* Upward Archimedes Buoyancy Force Arrow */}
                <g transform="translate(420, 210)">
                  <line x1="0" y1="35" x2="0" y2="5" stroke="#06b6d4" strokeWidth="3"/>
                  <polygon points="0,0 -6,10 6,10" fill="#06b6d4"/>
                  <text x="0" y="50" fill="#6ee7b7" fontSize="10" fontWeight="extrabold" textAnchor="middle">Poussée d'Archimède (Fa)</text>
                </g>

                {/* Downward Gravity Force Arrows */}
                <g transform="translate(215, 230)">
                  <line x1="0" y1="0" x2="0" y2="25" stroke="#ef4444" strokeWidth="2.5"/>
                  <polygon points="0,30 -5,20 5,20" fill="#ef4444"/>
                  <text x="0" y="42" fill="#fca5a5" fontSize="9" textAnchor="middle">Poids (P1)</text>
                </g>
                <g transform="translate(625, 230)">
                  <line x1="0" y1="0" x2="0" y2="25" stroke="#ef4444" strokeWidth="2.5"/>
                  <polygon points="0,30 -5,20 5,20" fill="#ef4444"/>
                  <text x="0" y="42" fill="#fca5a5" fontSize="9" textAnchor="middle">Poids (P2)</text>
                </g>

                {/* Max Distance Spacing Arrow X */}
                <line x1="215" y1="295" x2="625" y2="295" stroke="#f59e0b" strokeWidth="2.5"/>
                <polygon points="215,295 225,290 225,300" fill="#f59e0b"/>
                <polygon points="625,295 615,290 615,300" fill="#f59e0b"/>
                
                <rect x="300" y="280" width="240" height="28" rx="8" fill="#0f172a" stroke="#f59e0b" strokeWidth="2"/>
                <text x="420" y="299" fill="#f59e0b" fontSize="12" fontWeight="900" textAnchor="middle">
                  DISTANCE MAX X = {maxSpacingX > 0 ? `${maxSpacingX.toFixed(2)} MÈTRES` : "N/A"}
                </text>
              </svg>
            </div>
            <p className="text-[10px] text-slate-400 text-center italic">
              Équilibre de stabilité sous coefficient de sécurité K = {K_factor} (Annexe Fascicule 7 PD&I).
            </p>
          </div>
        </div>
      )}

        {activeTab === "gauvin" && (
          <div className="space-y-6 animate-fade-in">
            {/* Sub Navigation Bar for Gauvin Section */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 p-2 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider px-2 font-mono">Vue Méthode Gauvin :</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setGauvinSchemaTab("calc")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      gauvinSchemaTab === "calc"
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-200/60"
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Calculs & Paramètres
                  </button>
                  <button
                    onClick={() => setGauvinSchemaTab("remplissage")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      gauvinSchemaTab === "remplissage"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-200/60"
                    }`}
                  >
                    <Waves className="w-3.5 h-3.5 text-blue-300" />
                    Schéma de Remplissage
                  </button>
                  <button
                    onClick={() => setGauvinSchemaTab("tete_essai")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      gauvinSchemaTab === "tete_essai"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-200/60"
                    }`}
                  >
                    <Construction className="w-3.5 h-3.5 text-purple-300" />
                    Schéma Tête d'Essais
                  </button>
                  <button
                    onClick={() => setGauvinSchemaTab("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      gauvinSchemaTab === "all"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-200/60"
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5 text-slate-300" />
                    Vue Complète
                  </button>
                </div>
              </div>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full font-mono">
                Conforme Spécification Technique PD&I
              </span>
            </div>

            {/* SECTION 1: CALCULATOR & INPUTS */}
            {(gauvinSchemaTab === "calc" || gauvinSchemaTab === "all") && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-orange-500" />
                      Contrôle de Présence d'Air (GAUVIN) & Profil Hydrostatique
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Calcul du Volume V :</span>
                      <button
                        type="button"
                        onClick={() => setUseLengthForVolume(!useLengthForVolume)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          useLengthForVolume
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {useLengthForVolume ? "Auto (par Longueur L)" : "Manuel (Saisie V)"}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Détermine le bilan d'air par la décompression d'un volume d'eau calibré M, en intégrant la géométrie de la conduite (Longueur L & Diamètre D) et le profil en long altimétrique (Altitudes Z).
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                    {/* Geometry & Pipe Params */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Diamètre Extérieur (D) (mm) :</label>
                      <input
                        type="number"
                        value={diameterGauvin}
                        onChange={(e) => setDiameterGauvin(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Épaisseur Tube (e) (mm) :</label>
                      <input
                        type="number"
                        value={thicknessGauvin}
                        onChange={(e) => setThicknessGauvin(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Longueur Tronçon (L) (km) :
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={lengthKm}
                        onChange={(e) => setLengthKm(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    {/* Volume (Auto or Manual) */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        {useLengthForVolume ? "Vol. Calculé (V) (m³) :" : "Vol. Conduite (V) (m³) :"}
                      </label>
                      {useLengthForVolume ? (
                        <div className="w-full bg-orange-50/80 border border-orange-200 rounded-lg p-2 text-xs text-orange-950 font-black font-mono">
                          {calculatedVVolume.toFixed(2)} m³ <span className="text-[9px] font-normal text-orange-700">(Di = {innerDiameterGauvin.toFixed(1)} mm)</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={vVolume}
                          onChange={(e) => setVVolume(Math.max(1, parseFloat(e.target.value) || 1))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                        />
                      )}
                    </div>

                    {/* Altitudes & Hydrostatic Profile */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Altitude Point Haut (Z_haut) (m) :
                      </label>
                      <input
                        type="number"
                        value={altHigh}
                        onChange={(e) => setAltHigh(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Altitude Point Bas (Z_bas) (m) :
                      </label>
                      <input
                        type="number"
                        value={altLow}
                        onChange={(e) => setAltLow(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    {/* Hydrostatic Test Inputs */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        P_épreuve Point Haut (bar) :
                      </label>
                      <input
                        type="number"
                        value={testPressureHigh}
                        onChange={(e) => setTestPressureHigh(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Vol. Purge (M) (Litres) :</label>
                      <input
                        type="number"
                        value={mBleed}
                        onChange={(e) => setMBleed(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Chute Réelle (Δp1) (bar) :</label>
                      <input
                        type="number"
                        step="0.05"
                        value={measuredDrop}
                        onChange={(e) => setMeasuredDrop(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col justify-between shadow-md space-y-4">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider font-mono">1. Bilan d'Air (Gauvin)</span>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 font-mono">
                      <div>
                        <p className="text-[9px] text-slate-400">Δpo Théorique :</p>
                        <p className="text-sm font-black text-white">{deltaP0.toFixed(3)} bar</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Rapport (Δp1 / Δpo) :</p>
                        <p className="text-sm font-black text-amber-300">{ratioP1P0.toFixed(3)}</p>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`inline-block w-full text-center px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                          isAirTestOk ? "bg-emerald-500 text-slate-950 shadow-sm" : "bg-red-500 text-white shadow-sm"
                        }`}
                      >
                        {isAirTestOk ? "✓ Concluant (Pas d'air)" : "✕ Rejeté (Poche d'air)"}
                      </span>
                      <p className="text-[9px] text-slate-400 mt-1 font-mono text-center">Seuil limite : &lt; {maxAllowedRatio} (DN {diameterGauvin}mm)</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider font-mono">2. Profil Altimétrique & Pression</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <p className="text-[9px] text-slate-400">Dénivelé ΔZ :</p>
                        <p className="text-xs font-bold text-sky-300">{deltaZ} m</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Surpression Hydro :</p>
                        <p className="text-xs font-bold text-sky-300">+{deltaPhydro.toFixed(2)} bar</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Pression Point Bas :</p>
                        <p className="text-xs font-bold text-orange-400">{pLowPoint.toFixed(2)} bar</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Contrainte Acier :</p>
                        <p className="text-xs font-bold text-slate-200">{hoopStressLow.toFixed(1)} MPa</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: SCHÉMA DE REMPLISSAGE (FILLING DIAGRAM) */}
            {(gauvinSchemaTab === "remplissage" || gauvinSchemaTab === "all") && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Waves className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Schéma 1 : Dispositif de Remplissage de la Conduite & Dégazage</h4>
                      <p className="text-xs text-slate-500">Procédure d'introduction de l'eau filtrée avec piston racleur (PIG) pour éliminer les poches d'air (Fascicule 5)</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 self-start sm:self-auto font-mono">
                    Phase 1 : Remplissage
                  </span>
                </div>

                {/* SVG Schema for Remplissage */}
                <div className="w-full bg-slate-950 rounded-xl p-4 overflow-x-auto border border-slate-800">
                  <svg viewBox="0 0 900 280" className="w-full min-w-[700px] h-auto font-sans">
                    <defs>
                      <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="50%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#1e293b" />
                      </linearGradient>
                      <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0284c7" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                      <linearGradient id="pigGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ea580c" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>

                    {/* Ground line */}
                    <path d="M 20 220 L 880 220" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
                    <text x="30" y="235" fill="#64748b" fontSize="10" fontWeight="bold">Niveau du Sol (Tranchée enterrée)</text>

                    {/* Water Supply Station */}
                    <g transform="translate(30, 70)">
                      <rect x="0" y="40" width="80" height="60" rx="6" fill="#0f172a" stroke="#0284c7" strokeWidth="2" />
                      <text x="40" y="65" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">Bac à Eau</text>
                      <text x="40" y="78" textAnchor="middle" fill="#94a3b8" fontSize="8">Filtrée &lt; 100 µm</text>

                      {/* Pump */}
                      <circle cx="110" cy="70" r="16" fill="#0369a1" stroke="#38bdf8" strokeWidth="2" />
                      <path d="M 102 70 L 118 62 L 118 78 Z" fill="#ffffff" />
                      <text x="110" y="100" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">Pompe Centrifuge</text>

                      {/* Meter & Valve */}
                      <rect x="145" y="62" width="20" height="16" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                      <text x="155" y="73" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold">M</text>
                      <text x="155" y="90" textAnchor="middle" fill="#64748b" fontSize="7">Compteur</text>

                      {/* Connecting pipe */}
                      <path d="M 80 70 L 94 70 M 126 70 L 145 70 M 165 70 L 190 70 L 190 120" stroke="#38bdf8" strokeWidth="4" fill="none" />
                    </g>

                    {/* Main Gas Pipeline under test */}
                    <g transform="translate(210, 150)">
                      {/* Pipe Steel Outer Shell */}
                      <rect x="0" y="0" width="560" height="48" rx="4" fill="url(#pipeGrad)" stroke="#64748b" strokeWidth="2" />
                      {/* Inner Pipe Bore */}
                      <rect x="4" y="5" width="552" height="38" rx="2" fill="#0f172a" />

                      {/* Filled Water Region */}
                      <rect x="4" y="5" width="340" height="38" fill="url(#waterGrad)" opacity="0.85" />

                      {/* Piston Racleur (PIG) */}
                      <g transform="translate(330, 7)">
                        <rect x="0" y="0" width="30" height="34" rx="4" fill="url(#pigGrad)" stroke="#ffedd5" strokeWidth="1.5" />
                        <line x1="8" y1="0" x2="8" y2="34" stroke="#ffffff" strokeWidth="2" />
                        <line x1="22" y1="0" x2="22" y2="34" stroke="#ffffff" strokeWidth="2" />
                        <text x="15" y="-6" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">Piston Racleur (PIG)</text>
                      </g>

                      {/* Air Region ahead of PIG */}
                      <g transform="translate(370, 12)">
                        <circle cx="30" cy="12" r="4" fill="#ffffff" opacity="0.6" />
                        <circle cx="70" cy="20" r="6" fill="#ffffff" opacity="0.6" />
                        <circle cx="120" cy="10" r="5" fill="#ffffff" opacity="0.6" />
                        <text x="80" y="28" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontStyle="italic">Air Purgé vers Point Haut ➔</text>
                      </g>

                      {/* Pipeline Labels */}
                      <text x="160" y="28" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">EAU FILTRÉE DE REMPLISSAGE</text>
                      <text x="280" y="65" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">Conduite Acier DN {diameterGauvin} mm (e = {thicknessGauvin} mm)</text>
                    </g>

                    {/* Launching Trap (Gare de départ) */}
                    <g transform="translate(190, 135)">
                      <rect x="-10" y="0" width="30" height="78" rx="6" fill="#1e293b" stroke="#f97316" strokeWidth="2" />
                      <text x="5" y="-8" textAnchor="middle" fill="#f97316" fontSize="8" fontWeight="bold">Gare Départ</text>
                    </g>

                    {/* High Point Vent & Receiving Trap (Point haut & Purge) */}
                    <g transform="translate(770, 80)">
                      {/* Vertical vent pipe */}
                      <path d="M 0 70 L 0 20" stroke="#e2e8f0" strokeWidth="6" />
                      <rect x="-15" y="10" width="30" height="12" rx="2" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                      <text x="25" y="18" fill="#ef4444" fontSize="9" fontWeight="bold">Vanne d'Évent / Dégazage</text>

                      {/* Pressure gauge at top */}
                      <circle cx="0" cy="-5" r="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                      <path d="M 0 -5 L 5 -10" stroke="#ef4444" strokeWidth="2" />
                      <text x="-25" y="-20" fill="#38bdf8" fontSize="8">Manomètre Dégazage</text>

                      <rect x="-15" y="68" width="30" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                      <text x="0" y="160" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">Gare Réception</text>
                    </g>
                  </svg>
                </div>

                {/* Technical Specifications Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-left">
                    <p className="text-[10px] font-black uppercase text-blue-700 tracking-wider font-mono">1. Vitesse du PIG de Remplissage</p>
                    <p className="text-xs text-slate-700 mt-1 font-medium">Maintenir une vitesse constante entre <strong>1,5 et 3 km/h</strong> grâce au débit contrôlé de la pompe pour éviter le piégeage d'air.</p>
                  </div>
                  <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-100 text-left">
                    <p className="text-[10px] font-black uppercase text-sky-700 tracking-wider font-mono">2. Qualité de l'Eau</p>
                    <p className="text-xs text-slate-700 mt-1 font-medium">Eau douce neutre filtrée &lt; 100 microns, exempte de sédiments ou micro-organismes pour ne pas altérer les manifolds d'épreuve.</p>
                  </div>
                  <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 text-left">
                    <p className="text-[10px] font-black uppercase text-indigo-700 tracking-wider font-mono">3. Dégazage Complet</p>
                    <p className="text-xs text-slate-700 mt-1 font-medium">Maintenir la vanne d'évent haute ouverte jusqu'à l'obtention d'un jet d'eau continu, homogène et sans émulsion gazeuse.</p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: SCHÉMA TÊTE D'ESSAIS & MANIFOLD (TESTING HEAD DIAGRAM) */}
            {(gauvinSchemaTab === "tete_essai" || gauvinSchemaTab === "all") && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Construction className="w-5 h-5 text-purple-600" />
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Schéma 2 : Tête d'Essais et Manifold de Pression & Purge GAUVIN</h4>
                      <p className="text-xs text-slate-500">Installation du fond bombé d'épreuve, manifold d'injection HP, manomètre étalonné et burette de mesure volumétrique M (Fascicule 5)</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 self-start sm:self-auto font-mono">
                    Phase 2 : Épreuve & Purge Gauvin
                  </span>
                </div>

                {/* SVG Schema for Tête d'Essais & Manifold */}
                <div className="w-full bg-slate-950 rounded-xl p-4 overflow-x-auto border border-slate-800">
                  <svg viewBox="0 0 900 320" className="w-full min-w-[700px] h-auto font-sans">
                    <defs>
                      <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#334155" />
                        <stop offset="50%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                      <linearGradient id="buretteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>

                    {/* Ground and Pipeline Section */}
                    <path d="M 20 250 L 880 250" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
                    <text x="30" y="265" fill="#64748b" fontSize="10" fontWeight="bold">Niveau Tranchée d'Essai (Sous pression P_essai)</text>

                    {/* Main Gas Pipe */}
                    <g transform="translate(40, 150)">
                      <rect x="0" y="0" width="320" height="60" rx="4" fill="url(#pipeGrad)" stroke="#475569" strokeWidth="2" />
                      <rect x="4" y="6" width="312" height="48" fill="#0369a1" opacity="0.9" />
                      <text x="140" y="35" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">CONDUITE D'ESSAI EN EAU (DN {diameterGauvin} mm)</text>

                      {/* Weld seam */}
                      <line x1="320" y1="-2" x2="320" y2="62" stroke="#f59e0b" strokeWidth="4" />
                      <text x="320" y="-8" textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="bold">Soudure Tête d'Essai (100% Rx)</text>

                      {/* Test Cap (Fond bombé) */}
                      <path d="M 320 0 C 370 0, 370 60, 320 60 Z" fill="url(#capGrad)" stroke="#cbd5e1" strokeWidth="2" />
                      <text x="345" y="34" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">Fond Bombé</text>
                    </g>

                    {/* Manifold Piping System attached to Test Cap */}
                    <g transform="translate(390, 180)">
                      {/* Main connection pipe from Cap */}
                      <path d="M 0 0 L 120 0 M 60 0 L 60 -100 M 120 0 L 120 -80 M 120 0 L 220 0" stroke="#e2e8f0" strokeWidth="5" fill="none" />

                      {/* Branch 1: High Pressure Hydrostatic Pump */}
                      <g transform="translate(220, -20)">
                        <rect x="0" y="-15" width="70" height="30" rx="4" fill="#1e293b" stroke="#a855f7" strokeWidth="2" />
                        <text x="35" y="3" textAnchor="middle" fill="#c084fc" fontSize="8" fontWeight="bold">Pompe HP</text>
                        <text x="35" y="26" textAnchor="middle" fill="#64748b" fontSize="7">Mise en Pression P0</text>
                      </g>

                      {/* Branch 2: Precision Calibrated Pressure Gauge & Digital Recorder */}
                      <g transform="translate(60, -100)">
                        <line x1="0" y1="0" x2="0" y2="-20" stroke="#e2e8f0" strokeWidth="3" />
                        <circle cx="0" cy="-35" r="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                        <path d="M 0 -35 L 8 -42" stroke="#a855f7" strokeWidth="2.5" />
                        <text x="0" y="-32" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">P0 / Δp1</text>
                        <text x="0" y="-60" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">Manomètre Cl. 0.25</text>
                        <text x="0" y="-70" textAnchor="middle" fill="#94a3b8" fontSize="7">& Enregistreur Graphique</text>
                      </g>

                      {/* Branch 3: Micrometric Bleed Valve & Graduated Volumetric Burette */}
                      <g transform="translate(120, -80)">
                        {/* Micrometric Valve */}
                        <polygon points="-8,-10 8,-10 0,0" fill="#ef4444" />
                        <polygon points="-8,10 8,10 0,0" fill="#ef4444" />
                        <text x="25" y="-2" fill="#ef4444" fontSize="8" fontWeight="bold">Vanne Purge Micrométrique</text>

                        {/* Pipe to Burette */}
                        <path d="M 0 -10 L 0 -40 L 90 -40 L 90 -10" stroke="#38bdf8" strokeWidth="3" fill="none" />

                        {/* Graduated Burette Container */}
                        <g transform="translate(80, 20)">
                          <rect x="0" y="0" width="30" height="90" rx="3" fill="url(#buretteGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                          {/* Graduation Ticks */}
                          <line x1="0" y1="20" x2="8" y2="20" stroke="#ffffff" strokeWidth="1" />
                          <line x1="0" y1="35" x2="8" y2="35" stroke="#ffffff" strokeWidth="1" />
                          <line x1="0" y1="50" x2="8" y2="50" stroke="#ffffff" strokeWidth="1" />
                          <line x1="0" y1="65" x2="8" y2="65" stroke="#ffffff" strokeWidth="1" />
                          <text x="36" y="45" fill="#38bdf8" fontSize="9" fontWeight="bold">Volume Purge M ({mBleed} L)</text>
                          <text x="15" y="105" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontStyle="italic">Burette Graduée</text>
                        </g>
                      </g>

                      {/* Thermowell Probe (Doigt de gant température) */}
                      <g transform="translate(-100, -30)">
                        <rect x="0" y="0" width="12" height="30" fill="#f59e0b" rx="2" />
                        <text x="6" y="-6" textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="bold font-mono">Sonde T° Sol/Eau</text>
                      </g>
                    </g>
                  </svg>
                </div>

                {/* Operating Protocol & Equations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100 text-left space-y-2">
                    <p className="text-xs font-black uppercase text-purple-800 tracking-wider font-mono">Équation Fondamentale de Gauvin (Fascicule 5) :</p>
                    <div className="bg-white p-2.5 rounded-lg border border-purple-200 text-center font-mono text-xs font-bold text-slate-800 shadow-2xs">
                      Δp₀ = M / [ 1000 · V · ( λ_eau + D / (E · e) ) ]
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Où <strong>M</strong> = Volume d'eau purgé (L), <strong>V</strong> = Volume du tronçon (m³), <strong>D</strong> = Diamètre (mm), <strong>e</strong> = Épaisseur (mm), <strong>E</strong> = 2,1×10⁵ MPa (Module Acier), <strong>λ_eau</strong> = Compressibilité de l'eau.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-2">
                    <p className="text-xs font-black uppercase text-slate-700 tracking-wider font-mono">Protocole d'Épreuve sur le Terrain :</p>
                    <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside font-medium">
                      <li>Stabilisation thermique de la conduite (minimum 24h après remplissage).</li>
                      <li>Montée en pression à P0 (Palier d'épreuve hydrostatique).</li>
                      <li>Ouverture lente de la vanne micrométrique et purge exacte du volume <strong>M</strong> dans la burette.</li>
                      <li>Relevé de la chute de pression réelle <strong>Δp1</strong>.</li>
                      <li>Si <strong>Δp1 / Δp0 &lt; {maxAllowedRatio}</strong> ➔ L'épreuve est déclarée <strong>CONCLUANTE</strong> (Absence d'air).</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* NEW Calculator 6: Génie Civil Poste de Détente */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "poste_gc" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-blue-700">
                <Construction className="w-5 h-5 text-blue-600" />
                Calculateur Génie Civil - Poste de Détente
              </h3>
              <p className="text-xs text-slate-500">
                Estimez les cubages de béton, le nombre de sacs de ciment (dosage requis {concreteDosage} kg/m³ pour béton armé), les volumes de sable, gravier et armature d'acier selon les dimensions réglementaires.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                {/* Capacity Select */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Capacité du Poste de Détente (Nm³/h) :</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(stationDims).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setGcCapacity(key as any)}
                        className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                          gcCapacity === key
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {value.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slabs parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Épaisseur Dalle Abri (m) :</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.10"
                      value={mainSlabThickness}
                      onChange={(e) => setMainSlabThickness(Math.max(0.10, parseFloat(e.target.value) || 0.25))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Épaisseur Dalle Réchauffeur (m) :</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.10"
                      value={preheaterSlabThickness}
                      onChange={(e) => setPreheaterSlabThickness(Math.max(0.10, parseFloat(e.target.value) || 0.20))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Dosage Ciment (kg/m³) :</label>
                    <input
                      type="number"
                      step="50"
                      min="150"
                      value={concreteDosage}
                      onChange={(e) => setConcreteDosage(Math.max(150, parseInt(e.target.value) || 350))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Dimension Details Table */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Dimensions d'implantation du standard (Fascicule 7) :</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-1">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Clôture A (Long)</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{currentDims.A} m</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Clôture B (Larg)</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{currentDims.B} m</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Dalle Abri C</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{currentDims.C} m</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Dalle Abri D</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{currentDims.D} m</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Dalle Réch E</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{currentDims.E} m</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Dalle Réch F</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{currentDims.F} m</p>
                  </div>
                </div>
              </div>
            </div>

            {/* GC Results Card */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-150 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Quantitatif de Matériaux Estimé</span>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Volume Total de Béton Coulé :</p>
                    <p className="text-3xl font-black text-blue-600 mt-0.5">{totalConcreteVolume.toFixed(2)} m³</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">({mainSlabVolume.toFixed(1)}m³ Abri + {preheaterSlabVolume.toFixed(1)}m³ Réchauffeur)</p>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Ciment Requis :</span>
                      <span className="font-bold text-slate-800">{totalCementKg.toFixed(0)} kg <span className="text-slate-500 font-normal">({totalCementBags} sacs de 50kg)</span></span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Sable Requis :</span>
                      <span className="font-bold text-slate-800">{totalSandM3.toFixed(2)} m³</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Gravier/Agrégats :</span>
                      <span className="font-bold text-slate-800">{totalGravelM3.toFixed(2)} m³</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Eau de gâchage :</span>
                      <span className="font-bold text-slate-800">{totalWaterLiters.toFixed(0)} Litres</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Armature d'acier (80kg/m³) :</span>
                      <span className="font-bold text-slate-800">{estimatedSteelKg.toFixed(0)} kg</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-400">
                * Calculs théoriques basés sur le dosage réglementaire de la PD&I pour béton armé de fondation.
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* NEW Calculator 7: Factory Tube Reception (API 5L) */}
        {activeTab === "reception_usine" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Parameter input panel */}
              <div className="lg:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span>Réception Usine et Qualification Tubes (API 5L)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 font-semibold">PSL Level :</label>
                    <select
                      value={pslLevel}
                      onChange={(e) => setPslLevel(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-bold shadow-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PSL1">PSL1 (Usage Standard)</option>
                      <option value="PSL2">PSL2 (Réglementaire Gazoduc High Pressure)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nuance d'Acier (Grade) :</label>
                    <select
                      value={pipeGrade}
                      onChange={(e) => setPipeGrade(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold"
                    >
                      <option value="B">L245 / Grade B</option>
                      <option value="X42">L290 / X42</option>
                      <option value="X52">L360 / X52</option>
                      <option value="X60">L415 / X60</option>
                      <option value="X65">L450 / X65</option>
                      <option value="X70">L485 / X70</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">N° de Coulée (Heat) :</label>
                    <input
                      type="text"
                      value={heatNumber}
                      onChange={(e) => setHeatNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">N° de Tube :</label>
                    <input
                      type="text"
                      value={pipeIdNumber}
                      onChange={(e) => setPipeIdNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-mono"
                    />
                  </div>
                  <div className="bg-blue-50/80 p-2 rounded-lg border border-blue-100 flex flex-col justify-center text-center">
                    <span className="text-[9px] text-blue-700 font-black uppercase">Carbone Équivalent (CE IIW)</span>
                    <span className="text-sm font-black text-blue-800 mt-0.5">{calculatedCE.toFixed(3)}</span>
                  </div>
                </div>

                {/* Chemical composition elements inputs */}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Analyse Chimique de la Coulée (%) :</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Formule CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15</span>
                  </div>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">C (Carbone)</span>
                      <input type="number" step="0.01" value={chemC} onChange={(e) => setChemC(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">Mn (Manganèse)</span>
                      <input type="number" step="0.05" value={chemMn} onChange={(e) => setChemMn(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">P (Phosphore)</span>
                      <input type="number" step="0.001" value={chemP} onChange={(e) => setChemP(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">S (Soufre)</span>
                      <input type="number" step="0.001" value={chemS} onChange={(e) => setChemS(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">Si (Silicium)</span>
                      <input type="number" step="0.05" value={chemSi} onChange={(e) => setChemSi(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">Cr (Chrome)</span>
                      <input type="number" step="0.01" value={chemCr} onChange={(e) => setChemCr(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">Mo (Molybdène)</span>
                      <input type="number" step="0.01" value={chemMo} onChange={(e) => setChemMo(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-600 block mb-0.5 text-center">V (Vanadium)</span>
                      <input type="number" step="0.01" value={chemV} onChange={(e) => setChemV(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-mono font-semibold" />
                    </div>
                  </div>

                  {/* API 5L Chemical Reference Rates Comparison Table */}
                  <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-[11px] font-bold text-slate-700">Taux de Référence & Comparaison API 5L (À titre indicatif)</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                        Nuance {pipeGrade} ({pslLevel})
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                            <th className="p-2 border-r border-slate-200">Élément Chimique</th>
                            <th className="p-2 border-r border-slate-200 text-center">Mesuré (Coulée)</th>
                            <th className="p-2 border-r border-slate-200 text-center">Seuil API 5L PSL1</th>
                            <th className="p-2 border-r border-slate-200 text-center bg-blue-50/50 text-blue-900">Seuil API 5L PSL2 (Gazoduc)</th>
                            <th className="p-2 text-center">Statut vs {pslLevel}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                          {/* Carbone */}
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-2 font-sans font-semibold border-r border-slate-200">Carbone (C)</td>
                            <td className={"p-2 text-center font-bold border-r border-slate-200 " + (isC_Ok ? "text-slate-800" : "text-red-600 bg-red-50")}>{chemC.toFixed(2)}%</td>
                            <td className="p-2 text-center border-r border-slate-200 text-slate-500">≤ {pipeGrade === "B" || pipeGrade === "X42" || pipeGrade === "X52" ? "0.28%" : "0.26%"}</td>
                            <td className="p-2 text-center border-r border-slate-200 font-semibold text-blue-950 bg-blue-50/30">
                              ≤ {pipeGrade === "B" || pipeGrade === "X42" || pipeGrade === "X52" ? "0.22%" : "0.16%"}
                            </td>
                            <td className="p-2 text-center font-sans">
                              <span className={"inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full " + (isC_Ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                {isC_Ok ? "CONFORME ✓" : "DÉPASSEMENT ⚠️"}
                              </span>
                            </td>
                          </tr>

                          {/* Manganèse */}
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-2 font-sans font-semibold border-r border-slate-200">Manganèse (Mn)</td>
                            <td className={"p-2 text-center font-bold border-r border-slate-200 " + (isMn_Ok ? "text-slate-800" : "text-red-600 bg-red-50")}>{chemMn.toFixed(2)}%</td>
                            <td className="p-2 text-center border-r border-slate-200 text-slate-500">≤ {pipeGrade === "B" ? "1.20%" : pipeGrade === "X42" || pipeGrade === "X52" ? "1.30%" : "1.40%"}</td>
                            <td className="p-2 text-center border-r border-slate-200 font-semibold text-blue-950 bg-blue-50/30">
                              ≤ {pipeGrade === "B" ? "1.20%" : pipeGrade === "X42" || pipeGrade === "X52" ? "1.40%" : "1.45%"}
                            </td>
                            <td className="p-2 text-center font-sans">
                              <span className={"inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full " + (isMn_Ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                {isMn_Ok ? "CONFORME ✓" : "DÉPASSEMENT ⚠️"}
                              </span>
                            </td>
                          </tr>

                          {/* Phosphore */}
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-2 font-sans font-semibold border-r border-slate-200">Phosphore (P)</td>
                            <td className={"p-2 text-center font-bold border-r border-slate-200 " + (isP_Ok ? "text-slate-800" : "text-red-600 bg-red-50")}>{chemP.toFixed(3)}%</td>
                            <td className="p-2 text-center border-r border-slate-200 text-slate-500">≤ 0.030%</td>
                            <td className="p-2 text-center border-r border-slate-200 font-semibold text-blue-950 bg-blue-50/30">≤ 0.025%</td>
                            <td className="p-2 text-center font-sans">
                              <span className={"inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full " + (isP_Ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                {isP_Ok ? "CONFORME ✓" : "DÉPASSEMENT ⚠️"}
                              </span>
                            </td>
                          </tr>

                          {/* Soufre */}
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-2 font-sans font-semibold border-r border-slate-200">Soufre (S)</td>
                            <td className={"p-2 text-center font-bold border-r border-slate-200 " + (isS_Ok ? "text-slate-800" : "text-red-600 bg-red-50")}>{chemS.toFixed(3)}%</td>
                            <td className="p-2 text-center border-r border-slate-200 text-slate-500">≤ 0.030%</td>
                            <td className="p-2 text-center border-r border-slate-200 font-semibold text-blue-950 bg-blue-50/30">≤ 0.015%</td>
                            <td className="p-2 text-center font-sans">
                              <span className={"inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full " + (isS_Ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                {isS_Ok ? "CONFORME ✓" : "DÉPASSEMENT ⚠️"}
                              </span>
                            </td>
                          </tr>

                          {/* Silicium */}
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-2 font-sans font-semibold border-r border-slate-200">Silicium (Si)</td>
                            <td className="p-2 text-center font-bold border-r border-slate-200 text-slate-800">{chemSi.toFixed(2)}%</td>
                            <td className="p-2 text-center border-r border-slate-200 text-slate-500">≤ 0.45%</td>
                            <td className="p-2 text-center border-r border-slate-200 font-semibold text-blue-950 bg-blue-50/30">≤ 0.45%</td>
                            <td className="p-2 text-center font-sans">
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                CONFORME ✓
                              </span>
                            </td>
                          </tr>

                          {/* Carbone Équivalent */}
                          <tr className="hover:bg-slate-50/50 bg-slate-50/40">
                            <td className="p-2 font-sans font-bold border-r border-slate-200 text-blue-900">Carbone Équivalent (CE IIW)</td>
                            <td className={"p-2 text-center font-bold border-r border-slate-200 " + (isCE_Ok ? "text-blue-900 bg-blue-50/50" : "text-red-600 bg-red-50")}>
                              {calculatedCE.toFixed(3)}
                            </td>
                            <td className="p-2 text-center border-r border-slate-200 text-slate-400 font-sans text-[9px]">Non exigé (Option)</td>
                            <td className="p-2 text-center border-r border-slate-200 font-bold text-blue-950 bg-blue-100/40">≤ 0.43 (PD&I)</td>
                            <td className="p-2 text-center font-sans">
                              <span className={"inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full " + (isCE_Ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                {isCE_Ok ? "CONFORME ✓" : "DÉPASSEMENT ⚠️"}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Mechanical tests */}
                <div className="border-t border-slate-200 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Caractéristiques Mécaniques du Métal :</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Limite Élastique YS (MPa)</span>
                      <input type="number" value={mechYS} onChange={(e) => setMechYS(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Résistance Traction UTS (MPa)</span>
                      <input type="number" value={mechUTS} onChange={(e) => setMechUTS(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Allongement A (%)</span>
                      <input type="number" step="0.5" value={mechElong} onChange={(e) => setMechElong(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Charpy Impact (Joules)</span>
                      <input type="number" value={mechCharpy} onChange={(e) => setMechCharpy(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                  </div>
                </div>

                {/* Dimensional clearances */}
                <div className="border-t border-slate-200 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Contrôles Géométriques :</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Diamètre Extérieur (mm)</span>
                      <input type="number" step="0.1" value={geomOD} onChange={(e) => setGeomOD(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Épaisseur Réelle (mm)</span>
                      <input type="number" step="0.1" value={geomThick} onChange={(e) => setGeomThick(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Ovalisation (%)</span>
                      <input type="number" step="0.05" value={geomOvality} onChange={(e) => setGeomOvality(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Rectitude (mm / mètre)</span>
                      <input type="number" step="0.1" value={geomStraightness} onChange={(e) => setGeomStraightness(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded p-2 text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Compliance score cards */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">État de Conformité API 5L</span>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
                      <span className="text-xs font-bold text-slate-700">Analyse Chimique</span>
                      <span className={"inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full " + (isC_Ok && isMn_Ok && isP_Ok && isS_Ok && isCE_Ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {isC_Ok && isMn_Ok && isP_Ok && isS_Ok && isCE_Ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{isC_Ok && isMn_Ok && isP_Ok && isS_Ok && isCE_Ok ? "CONFORME" : "REJETÉ"}</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
                      <span className="text-xs font-bold text-slate-700">Propriétés Mécaniques</span>
                      <span className={"inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full " + (isYS_Ok && isUTS_Ok && isElong_Ok && isCharpy_Ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {isYS_Ok && isUTS_Ok && isElong_Ok && isCharpy_Ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{isYS_Ok && isUTS_Ok && isElong_Ok && isCharpy_Ok ? "CONFORME" : "REJETÉ"}</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
                      <span className="text-xs font-bold text-slate-700">Dimensions & Géométrie</span>
                      <span className={"inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full " + (isOval_Ok && isStraight_Ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {isOval_Ok && isStraight_Ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{isOval_Ok && isStraight_Ok ? "CONFORME" : "REJETÉ"}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-center">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Verdict Final de la coulée :</span>
                    <div className={"mt-2 py-3 px-4 rounded-2xl border font-black text-base text-center uppercase tracking-wider " + (isTotalCompliant ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200")}>
                      {isTotalCompliant ? "TUBE CERTIFIÉ CONFORME" : "TUBE REJETÉ / NON CONFORME"}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <button
                    onClick={() => setShowMtrPreview(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Afficher le PV de Réception</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TECHNICAL DRAWINGS & SCHEMAS SECTION FOR FACTORY TUBE RECEPTION */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <PenTool className="w-4 h-4 text-blue-600" />
                    <span>Dessins Techniques & Schémas d'Inspection Usine (API 5L / ISO 3183)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Schémas cotés et plans de contrôle réglementaires pour tube acier gazoduc Grade L{activeGradeLimit.ysMin} / {pipeGrade}
                  </p>
                </div>

                {/* Schema selector tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold self-start md:self-auto">
                  <button
                    onClick={() => setReceptionDiagramTab("geometry")}
                    className={"px-3 py-1.5 rounded-lg transition-all text-[11px] flex items-center gap-1.5 " + (receptionDiagramTab === "geometry" ? "bg-white text-blue-700 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900")}
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>1. Coupe & Chanfrein</span>
                  </button>

                  <button
                    onClick={() => setReceptionDiagramTab("coupons")}
                    className={"px-3 py-1.5 rounded-lg transition-all text-[11px] flex items-center gap-1.5 " + (receptionDiagramTab === "coupons" ? "bg-white text-blue-700 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900")}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>2. Prélèvement Éprouvettes</span>
                  </button>

                  <button
                    onClick={() => setReceptionDiagramTab("ndt")}
                    className={"px-3 py-1.5 rounded-lg transition-all text-[11px] flex items-center gap-1.5 " + (receptionDiagramTab === "ndt" ? "bg-white text-blue-700 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900")}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>3. Chaîne CND & Hydrotest</span>
                  </button>
                </div>
              </div>

              {/* SCHEMA 1: PIPE GEOMETRY & BEVEL */}
              {receptionDiagramTab === "geometry" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="bg-slate-900 rounded-xl p-4 text-white relative overflow-hidden border border-slate-800">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                      <span className="text-xs font-mono font-bold text-cyan-400">PLAN SCHÉMATIQUE 1: DÉTAIL DU CHANFREIN ET GÉOMÉTRIE TUBE API 5L</span>
                      <span className="text-[10px] font-mono text-slate-400">Cote nominale: Ø{geomOD}mm × {geomThick}mm</span>
                    </div>

                    <div className="w-full flex justify-center py-2">
                      <svg viewBox="0 0 800 320" className="w-full max-w-3xl h-auto font-mono text-[11px]">
                        <rect width="800" height="320" fill="#0f172a" />

                        {/* TUBE LONGITUDINAL SECTION */}
                        <g transform="translate(40, 40)">
                          {/* Pipe upper wall */}
                          <rect x="0" y="20" width="360" height="30" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                          {/* Pipe inner cavity */}
                          <rect x="0" y="50" width="360" height="80" fill="#020617" opacity="0.6" />
                          {/* Pipe lower wall */}
                          <rect x="0" y="130" width="360" height="30" fill="#334155" stroke="#94a3b8" strokeWidth="2" />

                          {/* Weld seam (SAW/LSAW) on top wall */}
                          <path d="M 180 15 Q 187 18, 195 20 L 195 50 Q 187 52, 180 50 Z" fill="#38bdf8" opacity="0.8" />
                          <text x="180" y="8" fill="#38bdf8" textAnchor="middle" fontSize="10" fontWeight="bold">Surépaisseur Soudure h ≤ 3.5mm</text>

                          {/* Dimensions OD and Wall thickness */}
                          <line x1="-15" y1="20" x2="-15" y2="160" stroke="#f59e0b" strokeWidth="1.5" />
                          <line x1="-20" y1="20" x2="-10" y2="20" stroke="#f59e0b" strokeWidth="1.5" />
                          <line x1="-20" y1="160" x2="-10" y2="160" stroke="#f59e0b" strokeWidth="1.5" />
                          <text x="-25" y="95" fill="#f59e0b" textAnchor="middle" fontSize="11" fontWeight="bold" transform="rotate(-90, -25, 95)">OD = {geomOD} mm (±0.5%)</text>

                          {/* Thickness dimension line */}
                          <line x1="380" y1="20" x2="380" y2="50" stroke="#10b981" strokeWidth="1.5" />
                          <line x1="375" y1="20" x2="385" y2="20" stroke="#10b981" strokeWidth="1.5" />
                          <line x1="375" y1="50" x2="385" y2="50" stroke="#10b981" strokeWidth="1.5" />
                          <text x="390" y="40" fill="#10b981" fontSize="10" fontWeight="bold">t = {geomThick} mm (-10%/+15%)</text>

                          {/* Ovality check labels */}
                          <text x="180" y="95" fill="#cbd5e1" textAnchor="middle" fontSize="10">Axe de Symétrie - Ovalisation max: {geomOvality}% (≤ 1.0%)</text>
                          <line x1="0" y1="90" x2="360" y2="90" stroke="#64748b" strokeWidth="1" strokeDasharray="6,4" />
                        </g>

                        {/* TUBE END BEVEL DETAIL (ZOOM) */}
                        <g transform="translate(480, 40)">
                          <rect x="0" y="0" width="280" height="230" fill="#1e293b" rx="8" stroke="#334155" strokeWidth="1.5" />
                          <text x="140" y="20" fill="#38bdf8" textAnchor="middle" fontSize="11" fontWeight="bold">DÉTAIL DU CHANFREIN D'EXTRÉMITÉ</text>

                          {/* Bevel profile drawing */}
                          <path d="M 40 50 L 160 50 L 220 140 L 220 170 L 160 170 L 40 170 Z" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />

                          {/* Bevel angle 30deg line */}
                          <line x1="160" y1="50" x2="220" y2="140" stroke="#f59e0b" strokeWidth="2" />
                          <path d="M 160 50 L 190 50 A 30 30 0 0 1 180 80" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" />
                          <text x="200" y="65" fill="#f59e0b" fontSize="10" fontWeight="bold">α = 30° (+5°/-0°)</text>

                          {/* Root face (Talon) */}
                          <line x1="220" y1="140" x2="220" y2="170" stroke="#ef4444" strokeWidth="3" />
                          <line x1="220" y1="140" x2="250" y2="140" stroke="#ef4444" strokeWidth="1" />
                          <line x1="220" y1="170" x2="250" y2="170" stroke="#ef4444" strokeWidth="1" />
                          <line x1="240" y1="140" x2="240" y2="170" stroke="#ef4444" strokeWidth="1.5" />
                          <text x="245" y="158" fill="#ef4444" fontSize="9" fontWeight="bold">Talon = 1.6 ± 0.8 mm</text>

                          <text x="140" y="210" fill="#94a3b8" textAnchor="middle" fontSize="9">Conforme à la spécification PD&I Ed.2025</text>
                        </g>

                        {/* Title block */}
                        <rect x="40" y="240" width="720" height="50" fill="#1e293b" rx="4" stroke="#334155" />
                        <text x="50" y="260" fill="#e2e8f0" fontSize="10" fontWeight="bold">PROJET : CANALISATION HAUTE PRESSION - PD&I</text>
                        <text x="50" y="278" fill="#94a3b8" fontSize="9">Norme d'Inspection: API 5L (Éd. 46) / PSL2 | N° Coulée: {heatNumber} | Grade: L{activeGradeLimit.ysMin} ({pipeGrade})</text>
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">1. Tolérances sur Chanfrein</span>
                      <p className="text-[11px] text-slate-600">
                        Angle d'affûtage standard α = 30° (+5°/-0°). Talon plat (Root face) compris strictement entre 0.8 mm et 2.4 mm pour assurer une pénétration sans effondrement lors du soudage en ligne.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">2. Ovalisation aux Extrémités</span>
                      <p className="text-[11px] text-slate-600">
                        Mesure sur les 100 premiers millimètres des extrémités : (Dmax - Dmin) / Dnom ≤ 1.0% (limite max absolue 0.5% pour alignement de crabotage rapide).
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">3. Rectitude Longitudinale</span>
                      <p className="text-[11px] text-slate-600">
                        Flèche maximale autorisée par mètre linéaire : {geomStraightness} mm/m (limite d'acceptation API 5L ≤ 1.5 mm/m sur toute la longueur du tube de 12 mètres).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SCHEMA 2: SAMPLING SPECIMENS FOR MECHANICAL TESTS */}
              {receptionDiagramTab === "coupons" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="bg-slate-900 rounded-xl p-4 text-white relative overflow-hidden border border-slate-800">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                      <span className="text-xs font-mono font-bold text-cyan-400">PLAN SCHÉMATIQUE 2: MAPPING DU PRÉLÈVEMENT DES ÉPROUVETTES API 5L §10.2</span>
                      <span className="text-[10px] font-mono text-slate-400">Prélèvement par lot de 100 tubes (Nuance L{activeGradeLimit.ysMin})</span>
                    </div>

                    <div className="w-full flex justify-center py-2">
                      <svg viewBox="0 0 800 320" className="w-full max-w-3xl h-auto font-mono text-[11px]">
                        <rect width="800" height="320" fill="#0f172a" />

                        {/* UNFOLDED PIPE MAP */}
                        <g transform="translate(40, 30)">
                          {/* Unfolded pipe rectangle */}
                          <rect x="0" y="30" width="720" height="180" fill="#1e293b" stroke="#475569" strokeWidth="2" rx="4" />
                          <text x="360" y="20" fill="#e2e8f0" textAnchor="middle" fontSize="11" fontWeight="bold">DÉVELOPPÉ DE LA TÔLE DU TUBE ET EMPLACEMENTS DES ÉPROUVETTES D'ESSAI</text>

                          {/* Weld seam along center */}
                          <line x1="0" y1="120" x2="720" y2="120" stroke="#38bdf8" strokeWidth="3" strokeDasharray="8,4" />
                          <text x="650" y="112" fill="#38bdf8" fontSize="10" fontWeight="bold">Cordon de Soudure SAW</text>

                          {/* Specimen 1: Transverse Tensile Base Metal */}
                          <rect x="80" y="50" width="20" height="50" fill="#10b981" stroke="#a7f3d0" strokeWidth="1.5" />
                          <text x="90" y="42" fill="#10b981" textAnchor="middle" fontSize="9" fontWeight="bold">Traction Métal (YS={mechYS}MPa)</text>

                          {/* Specimen 2: Transverse Tensile Weld Seam */}
                          <rect x="220" y="95" width="20" height="50" fill="#3b82f6" stroke="#bfdbfe" strokeWidth="1.5" />
                          <text x="230" y="160" fill="#3b82f6" textAnchor="middle" fontSize="9" fontWeight="bold">Traction Soudure (UTS={mechUTS}MPa)</text>

                          {/* Specimen 3: Charpy Impact Trio (Base Metal, HAZ, Weld) */}
                          <g transform="translate(380, 50)">
                            <rect x="0" y="0" width="12" height="30" fill="#f59e0b" />
                            <rect x="16" y="0" width="12" height="30" fill="#f97316" />
                            <rect x="32" y="0" width="12" height="30" fill="#ef4444" />
                            <text x="22" y="-8" fill="#f59e0b" textAnchor="middle" fontSize="9" fontWeight="bold">Charpy V-Notch (-10°C)</text>
                            <text x="22" y="42" fill="#cbd5e1" textAnchor="middle" fontSize="8">KCV = {mechCharpy} Joules (≥27J)</text>
                          </g>

                          {/* Specimen 4: DWTT (Drop Weight Tear Test) for PSL2 */}
                          <rect x="530" y="50" width="30" height="60" fill="#a855f7" stroke="#e9d5ff" strokeWidth="1.5" />
                          <text x="545" y="42" fill="#a855f7" textAnchor="middle" fontSize="9" fontWeight="bold">DWTT (Gazoduc PSL2)</text>
                          <text x="545" y="125" fill="#e9d5ff" textAnchor="middle" fontSize="8">Surface Ductile ≥ 85%</text>

                          {/* Specimen 5: Bend Tests */}
                          <rect x="640" y="140" width="40" height="15" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.5" />
                          <text x="660" y="170" fill="#ec4899" textAnchor="middle" fontSize="9" fontWeight="bold">Pliage Endroit / Envers</text>

                          <line x1="0" y1="200" x2="720" y2="200" stroke="#334155" />
                        </g>

                        {/* Title bar */}
                        <rect x="40" y="245" width="720" height="45" fill="#1e293b" rx="4" stroke="#334155" />
                        <text x="50" y="265" fill="#e2e8f0" fontSize="10" fontWeight="bold">PRÉLÈVEMENT PAR COULÉE N° {heatNumber} - NORME PD&I / API 5L</text>
                        <text x="50" y="280" fill="#94a3b8" fontSize="9">Tous les essais mécaniques doivent satisfaire les exigences minimales du Grade L{activeGradeLimit.ysMin} ({pipeGrade})</text>
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">1. Essai de Traction Transversale</span>
                      <p className="text-[11px] text-slate-600">
                        Détermination de la limite d'élasticité YS ({activeGradeLimit.ysMin} - {activeGradeLimit.ysMax} MPa) et de la résistance à la rupture UTS ({activeGradeLimit.utsMin} - {activeGradeLimit.utsMax} MPa).
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">2. Résilience Charpy V-Notch (-10°C)</span>
                      <p className="text-[11px] text-slate-600">
                        Prélèvement de 3 éprouvettes en métal de base, 3 en zone affectée thermiquement (ZAT) et 3 au centre de la soudure. Énergie minimale exigée par PD&I : 27 Joules à -10°C.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">3. Essai DWTT (Mouton-Pendant)</span>
                      <p className="text-[11px] text-slate-600">
                        Obligatoire pour tubes PSL2 de transport de gaz naturel à haute pression pour garantir la non-propagation des ruptures fragiles (Cisaillement de fracture ≥ 85%).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SCHEMA 3: NDT INSPECTION LINE & HYDROSTATIC TEST */}
              {receptionDiagramTab === "ndt" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="bg-slate-900 rounded-xl p-4 text-white relative overflow-hidden border border-slate-800">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                      <span className="text-xs font-mono font-bold text-cyan-400">PLAN SCHÉMATIQUE 3: CHAÎNE DE CONTRÔLE CND EN USINE & ÉPREUVE HYDROSTATIQUE</span>
                      <span className="text-[10px] font-mono text-slate-400">Séquence 100% Automatisée API 5L §10.2.8</span>
                    </div>

                    <div className="w-full flex justify-center py-2">
                      <svg viewBox="0 0 800 320" className="w-full max-w-3xl h-auto font-mono text-[11px]">
                        <rect width="800" height="320" fill="#0f172a" />

                        {/* NDT WORKFLOW STEPS */}
                        {/* Step 1: Ultrasonics */}
                        <g transform="translate(40, 40)">
                          <rect x="0" y="0" width="150" height="110" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="6" />
                          <text x="75" y="22" fill="#38bdf8" textAnchor="middle" fontSize="10" fontWeight="bold">1. ULTRASONS (UT)</text>
                          <line x1="15" y1="30" x2="135" y2="30" stroke="#334155" />
                          <text x="75" y="48" fill="#e2e8f0" textAnchor="middle" fontSize="9">100% Corps & Soudure</text>
                          <text x="75" y="66" fill="#94a3b8" textAnchor="middle" fontSize="8">Détection Dédoublage &</text>
                          <text x="75" y="78" fill="#94a3b8" textAnchor="middle" fontSize="8">Défauts Longitudinaux</text>
                          <rect x="25" y="88" width="100" height="16" fill="#0284c7" rx="3" />
                          <text x="75" y="100" fill="#ffffff" textAnchor="middle" fontSize="8" fontWeight="bold">Banc UT Multi-Palpeurs</text>
                        </g>

                        {/* Arrow 1 */}
                        <polygon points="225,95 218,90 218,100" fill="#f59e0b" />

                        {/* Step 2: Radiography */}
                        <g transform="translate(230, 40)">
                          <rect x="0" y="0" width="150" height="110" fill="#1e293b" stroke="#a855f7" strokeWidth="2" rx="6" />
                          <text x="75" y="22" fill="#a855f7" textAnchor="middle" fontSize="10" fontWeight="bold">2. RADIOGRAPHIE (RT)</text>
                          <line x1="15" y1="30" x2="135" y2="30" stroke="#334155" />
                          <text x="75" y="48" fill="#e2e8f0" textAnchor="middle" fontSize="9">Extrémités Cordon</text>
                          <text x="75" y="66" fill="#94a3b8" textAnchor="middle" fontSize="8">Contrôle RX/Film X-Ray</text>
                          <text x="75" y="78" fill="#94a3b8" textAnchor="middle" fontSize="8">des zones d'arrêt UT</text>
                          <rect x="25" y="88" width="100" height="16" fill="#7e22ce" rx="3" />
                          <text x="75" y="100" fill="#ffffff" textAnchor="middle" fontSize="8" fontWeight="bold">Cabine RX Rayons X</text>
                        </g>

                        {/* Arrow 2 */}
                        <polygon points="415,95 408,90 408,100" fill="#f59e0b" />

                        {/* Step 3: Hydrotest */}
                        <g transform="translate(420, 40)">
                          <rect x="0" y="0" width="150" height="110" fill="#1e293b" stroke="#10b981" strokeWidth="2" rx="6" />
                          <text x="75" y="22" fill="#10b981" textAnchor="middle" fontSize="10" fontWeight="bold">3. ÉPREUVE HYDROST.</text>
                          <line x1="15" y1="30" x2="135" y2="30" stroke="#334155" />
                          <text x="75" y="48" fill="#10b981" textAnchor="middle" fontSize="9" fontWeight="bold">P = 2·S·t / D</text>
                          <text x="75" y="66" fill="#94a3b8" textAnchor="middle" fontSize="8">Pression d'épreuve hydro</text>
                          <text x="75" y="78" fill="#94a3b8" textAnchor="middle" fontSize="8">Maintien sous eau ≥ 10s</text>
                          <rect x="25" y="88" width="100" height="16" fill="#059669" rx="3" />
                          <text x="75" y="100" fill="#ffffff" textAnchor="middle" fontSize="8" fontWeight="bold">Banc d'Épreuve 100%</text>
                        </g>

                        {/* Arrow 3 */}
                        <polygon points="605,95 598,90 598,100" fill="#f59e0b" />

                        {/* Step 4: Magnetoscopy & Final Dimension */}
                        <g transform="translate(610, 40)">
                          <rect x="0" y="0" width="150" height="110" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" rx="6" />
                          <text x="75" y="22" fill="#f59e0b" textAnchor="middle" fontSize="10" fontWeight="bold">4. MT & MARQUAGE</text>
                          <line x1="15" y1="30" x2="135" y2="30" stroke="#334155" />
                          <text x="75" y="48" fill="#e2e8f0" textAnchor="middle" fontSize="9">Magnétoscopie MT</text>
                          <text x="75" y="66" fill="#94a3b8" textAnchor="middle" fontSize="8">Chanfreins + Marquage</text>
                          <text x="75" y="78" fill="#94a3b8" textAnchor="middle" fontSize="8">Stenciling API 5L Monogram</text>
                          <rect x="25" y="88" width="100" height="16" fill="#d97706" rx="3" />
                          <text x="75" y="100" fill="#ffffff" textAnchor="middle" fontSize="8" fontWeight="bold">Tube Homologué PV</text>
                        </g>

                        {/* Hydrotest Pressure Formula Box */}
                        <rect x="40" y="175" width="720" height="60" fill="#020617" rx="6" stroke="#334155" />
                        <text x="360" y="195" fill="#38bdf8" textAnchor="middle" fontSize="11" fontWeight="bold">FORMULE DE PRESSION D'ÉPREUVE HYDROSTATIQUE (API 5L §10.2.6.2) :</text>
                        <text x="360" y="218" fill="#f1f5f9" textAnchor="middle" fontSize="12" fontWeight="bold">
                          P (MPa) = (2 × S × t) / D  avec S = 90% de YS ({mechYS} MPa) pour Grade L{activeGradeLimit.ysMin} / {pipeGrade}
                        </text>

                        {/* Title block */}
                        <rect x="40" y="250" width="720" height="40" fill="#1e293b" rx="4" stroke="#334155" />
                        <text x="50" y="272" fill="#e2e8f0" fontSize="10" fontWeight="bold">QUALIFICATION USINE TOUS TUBES - EXIGENCE AUDIT QUALITÉ PD&I</text>
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">1. Inspection Ultrasons Corps & Soudure</span>
                      <p className="text-[11px] text-slate-600">
                        Banc multi-canaux automatique à haute fréquence assurant la détection des dédoublages dans la tôle et des fissures transversales/longitudinales dans la soudure SAW.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">2. Épreuve Hydrostatique Unitaire</span>
                      <p className="text-[11px] text-slate-600">
                        Chaque tube individuel subit une mise sous pression d'eau à 90% de sa limite élastique YS pendant un minimum de 10 secondes sans fuite ni déformation permanente.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">3. Magnétoscopie des Extrémités</span>
                      <p className="text-[11px] text-slate-600">
                        Examen par magnétoscopie (MT) des chanfreins de chaque tube sur une profondeur de 50 mm pour s'assurer de l'absence de criques ou de fissuration de bord de tôle.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PV Modal / Section */}
            {showMtrPreview && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 animate-fade-in relative shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500 fill-orange-400" />
                    <span className="font-bold text-slate-800">Aperçu du PV de réception d'usine officiel</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintMtr}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimer le PV</span>
                    </button>
                    <button
                      onClick={() => setShowMtrPreview(false)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all"
                    >
                      Fermer
                    </button>
                  </div>
                </div>

                {/* Printable Area Wrapper */}
                <div ref={printAreaRef} className="bg-slate-50/50 rounded-xl p-6 border border-slate-150 font-mono text-xs leading-relaxed max-w-4xl mx-auto text-slate-800">
                  <div className="border-2 border-slate-800 p-6 bg-white space-y-6">
                    {/* Official header */}
                    <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4">
                      <div>
                        <p className="font-black text-sm tracking-tight">PD&I — PIPING DESIGN & ISOMETRICS · INDUSTRIAL ENGINEERING</p>
                        <p className="font-bold text-xs text-slate-600">INSPECTION & QUALITY CONTROL (API 5L / ASME B31.3 / B31.8)</p>
                        <p className="text-[10px] text-slate-500">ENGINEERING & EPC PROJECTS DIVISION</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold border border-slate-800 px-3 py-1 bg-slate-50">PV-RECEP-USINE-{heatNumber.split('-')[2] || "2026"}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Date: {new Date().toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>

                    <h2 className="text-center text-sm font-black tracking-wider uppercase bg-slate-100 py-2 border border-slate-800">
                      PROCES-VERBAL DE RECEP-QUALIFICATION DU TUBE EN USINE (NORMES API 5L / PD&I)
                    </h2>

                    {/* Metadata summary */}
                    <table className="w-full text-left border-collapse border border-slate-800">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-800 text-[10px]">
                          <th className="p-2 border-r border-slate-800 font-bold">SPÉCIFICATION</th>
                          <th className="p-2 border-r border-slate-800 font-bold">GRADE SÉLECTIONNÉ</th>
                          <th className="p-2 border-r border-slate-800 font-bold">NIVEAU PRODUIT</th>
                          <th className="p-2 border-r border-slate-800 font-bold">HEAT COULÉE / TUBE ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 border-r border-slate-800">PD&I TRANS-GAZ ED.2025</td>
                          <td className="p-2 border-r border-slate-800 font-bold">L{activeGradeLimit.ysMin} / {pipeGrade}</td>
                          <td className="p-2 border-r border-slate-800 font-bold">{pslLevel}</td>
                          <td className="p-2 border-r border-slate-800 font-bold">{heatNumber} / {pipeIdNumber}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Chemical report */}
                    <div>
                      <p className="font-black text-[10px] uppercase border-b border-slate-800 pb-1 mb-2 text-blue-900">1. RAPPORT D'ANALYSE CHIMIQUE DES ÉLÉMENTS (%) ET CONFRONATION AUX SEUILS API 5L</p>
                      <table className="w-full text-center border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] border-b border-slate-800">
                            <th className="p-1 border-r border-slate-800">Elément</th>
                            <th className="p-1 border-r border-slate-800">C</th>
                            <th className="p-1 border-r border-slate-800">Mn</th>
                            <th className="p-1 border-r border-slate-800">P</th>
                            <th className="p-1 border-r border-slate-800">S</th>
                            <th className="p-1 border-r border-slate-800">Si</th>
                            <th className="p-1 border-r border-slate-800">Cr</th>
                            <th className="p-1 border-r border-slate-800">Mo</th>
                            <th className="p-1 border-r border-slate-800">V</th>
                            <th className="p-1 border-r border-slate-800">C.E (Carb. Equiv.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800 text-[10px]">
                            <td className="p-1.5 border-r border-slate-800 font-bold">Mesuré Coulée</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemC}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemMn}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemP}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemS}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemSi}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemCr}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemMo}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{chemV}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold bg-slate-100">{calculatedCE.toFixed(3)}</td>
                          </tr>
                          <tr className="text-[8px] text-slate-600 bg-slate-50/60 border-b border-slate-800">
                            <td className="p-1 border-r border-slate-800 font-bold">Ref API 5L PSL1</td>
                            <td className="p-1 border-r border-slate-800">≤ {pipeGrade === "B" || pipeGrade === "X42" || pipeGrade === "X52" ? "0.28%" : "0.26%"}</td>
                            <td className="p-1 border-r border-slate-800">≤ {pipeGrade === "B" ? "1.20%" : pipeGrade === "X42" || pipeGrade === "X52" ? "1.30%" : "1.40%"}</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.030%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.030%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.45%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.50%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.50%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.10%</td>
                            <td className="p-1 border-r border-slate-800">N/A</td>
                          </tr>
                          <tr className="text-[8px] font-bold text-slate-800 bg-blue-50/40">
                            <td className="p-1 border-r border-slate-800">Ref API 5L PSL2</td>
                            <td className="p-1 border-r border-slate-800">≤ {pipeGrade === "B" || pipeGrade === "X42" || pipeGrade === "X52" ? "0.22%" : "0.16%"}</td>
                            <td className="p-1 border-r border-slate-800">≤ {pipeGrade === "B" ? "1.20%" : pipeGrade === "X42" || pipeGrade === "X52" ? "1.40%" : "1.45%"}</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.025%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.015%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.45%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.50%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.50%</td>
                            <td className="p-1 border-r border-slate-800">≤ 0.10%</td>
                            <td className="p-1 border-r border-slate-800 text-blue-900">≤ 0.43 (PD&I)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Mechanical report */}
                    <div>
                      <p className="font-black text-[10px] uppercase border-b border-slate-800 pb-1 mb-2 text-blue-900">2. CARACTÉRISTIQUES MÉCANIQUES ET ESSAIS DE TRACTION / IMPACT</p>
                      <table className="w-full text-center border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] border-b border-slate-800">
                            <th className="p-1 border-r border-slate-800">PROPRIÉTÉ</th>
                            <th className="p-1 border-r border-slate-800">LIMITE ÉLASTIQUE YS</th>
                            <th className="p-1 border-r border-slate-800">TRACTION UTS</th>
                            <th className="p-1 border-r border-slate-800">ALLONGEMENT A</th>
                            <th className="p-1 border-r border-slate-800">CHARPY CVN (-10°C)</th>
                            <th className="p-1 border-r border-slate-800">VERDICT</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800 text-[10px]">
                            <td className="p-1.5 border-r border-slate-800 font-bold">Valeur Mesurée</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{mechYS} MPa</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{mechUTS} MPa</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{mechElong}%</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">{mechCharpy} Joules</td>
                            <td className="p-1.5 font-bold border-r border-slate-800">
                              {isYS_Ok && isUTS_Ok && isElong_Ok && isCharpy_Ok ? "CONFORME ✓" : "REJETÉ ✕"}
                            </td>
                          </tr>
                          <tr className="text-[9px] text-slate-500">
                            <td className="p-1 border-r border-slate-800 font-bold">Spécifié L{activeGradeLimit.ysMin}</td>
                            <td className="p-1 border-r border-slate-800">{activeGradeLimit.ysMin} - {activeGradeLimit.ysMax} MPa</td>
                            <td className="p-1 border-r border-slate-800">{activeGradeLimit.utsMin} - {activeGradeLimit.utsMax} MPa</td>
                            <td className="p-1 border-r border-slate-800">≥ {activeGradeLimit.elongMin}%</td>
                            <td className="p-1 border-r border-slate-800">≥ 27 J (-10°C)</td>
                            <td className="p-1 border-r border-slate-800">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Geometry report */}
                    <div>
                      <p className="font-black text-[10px] uppercase border-b border-slate-800 pb-1 mb-2 text-blue-900">3. RELEVÉ D'INSPECTION GÉOMÉTRIQUE ET DE CHANFREINAGE</p>
                      <table className="w-full text-center border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] border-b border-slate-800">
                            <th className="p-1 border-r border-slate-800">PARAMÈTRE</th>
                            <th className="p-1 border-r border-slate-800">DIAMÈTRE OD</th>
                            <th className="p-1 border-r border-slate-800">ÉPAISSEUR t</th>
                            <th className="p-1 border-r border-slate-800">OVALISATION</th>
                            <th className="p-1 border-r border-slate-800">RECTITUDE</th>
                            <th className="p-1 border-r border-slate-800">VERDICT</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800 text-[10px]">
                            <td className="p-1.5 border-r border-slate-800 font-bold">Mesuré</td>
                            <td className="p-1.5 border-r border-slate-800">{geomOD} mm</td>
                            <td className="p-1.5 border-r border-slate-800">{geomThick} mm</td>
                            <td className="p-1.5 border-r border-slate-800">{geomOvality}%</td>
                            <td className="p-1.5 border-r border-slate-800">{geomStraightness} mm/m</td>
                            <td className="p-1.5 font-bold border-r border-slate-800">
                              {isOval_Ok && isStraight_Ok ? "CONFORME ✓" : "REJETÉ ✕"}
                            </td>
                          </tr>
                          <tr className="text-[9px] text-slate-500">
                            <td className="p-1 border-r border-slate-800 font-bold">Tolérance API 5L</td>
                            <td className="p-1 border-r border-slate-800">± 0.5% Dnom</td>
                            <td className="p-1 border-r border-slate-800">-10% / +15%</td>
                            <td className="p-1 border-r border-slate-800">≤ 1.0%</td>
                            <td className="p-1 border-r border-slate-800">≤ 1.5 mm/m</td>
                            <td className="p-1 border-r border-slate-800">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Technical Drawing summary in PV */}
                    <div className="border border-slate-800 p-3 bg-slate-50/50">
                      <p className="font-bold text-[9px] uppercase text-slate-800 mb-1">CONTRÔLE CND QUALITÉ EN USINE & CONFORMITÉ DU SCHÉMA :</p>
                      <p className="text-[9px] text-slate-700 leading-normal">
                        - Ultrasons (UT) à 100% du corps de tube & du cordon de soudure SAW conforme au schéma normatif API 5L §10.2.8.<br/>
                        - Contrôle par Radiographie (RT) des extrémités de tube & Magnétoscopie (MT) des chanfreins (30° +5°/-0°, talon 1.6±0.8mm).<br/>
                        - Épreuve hydrostatique unitaire validée à la pression de calcul P = (2·S·t)/D avec maintien sous pression de 10s.
                      </p>
                    </div>

                    {/* Final Signatures */}
                    <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="font-bold text-[10px] uppercase">L'Inspecteur Contrôle Qualité Usine</p>
                        <p className="text-[9px] text-slate-500 italic mt-6">Visa & Tampon Homologué</p>
                      </div>
                      <div>
                        <p className="font-bold text-[10px] uppercase">Le Représentant Technique PD&I</p>
                        <p className="text-[9px] text-slate-500 italic mt-6">Visa & Signature de Réception</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* ------------------------------------------------------------- */}
        {/* NEW Calculator 8: Croquis & Conception Dalles GC (New & Extension) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "poste_croquis" && (
          <div className="space-y-6 animate-fade-in">
             {/* Header with Mode Switching Tabs */}
             <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                   <Compass className="w-5 h-5 text-blue-600 animate-spin" style={{ animationDuration: "5s" }} />
                   <span>Concepteur de Croquis Génie Civil - PD&I</span>
                 </h2>
                 <p className="text-xs text-slate-500 mt-1">
                   Générez un croquis technique d'implantation pour dalles et clôtures de sécurité.
                 </p>
               </div>
               
               <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                 <span className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-600 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5">
                   <Zap className="w-3.5 h-3.5 text-amber-300" />
                   <span>Studio CAD Unifié (Paramétrique + Dessin Libre)</span>
                 </span>
               </div>
               </div>

             <div className="space-y-6 animate-fade-in text-left">
          
          {/* ========================================================================= */}
          {/* CARRÉ JAUNE (YELLOW BOX): TOP HORIZONTAL TOOLBAR & CAD MODULE CARDS        */}
          {/* ========================================================================= */}
          <div className="w-full bg-slate-900 border-2 border-amber-400 rounded-3xl p-4 md:p-5 text-white space-y-4 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-amber-400/30 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                    <span>Carré Jaune — Module de Saisie CAD & Configuration Horizontal</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Sélectionnez un composant ci-dessous pour ouvrir sa fenêtre d'édition CAD paramétrique.
                  </p>
                </div>
              </div>

              {/* Config Type de Projet Switcher */}
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-amber-400/30 shrink-0">
                <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider px-2">Type de Projet :</span>
                <button
                  type="button"
                  onClick={() => setConceptionMode("neuf")}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    conceptionMode === "neuf" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Ouvrage Neuf
                </button>
                <button
                  type="button"
                  onClick={() => setConceptionMode("extension")}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    conceptionMode === "extension" ? "bg-orange-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Extension
                </button>
              </div>
            </div>

                        {/* BARRE D'AJOUT DIRECT & ACTIONS RAPIDES (+) */}
            <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-amber-400/50 space-y-2 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Ajout Direct d'Éléments au Plan (+) :</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono italic">
                  Cliquez sur un bouton ci-dessous pour insérer directement un ouvrage, un accès ou un équipement
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddOuvrage()}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Nouveau Bloc Ouvrage</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddGate("portail_5m")}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Portail Véhicules (5m)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddGate("portillon")}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Portillon Piéton (1m)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveGabionOuvrageId(selectedOuvrageId || ouvrages[0]?.id || null);
                    setActiveCadModal("gabions");
                  }}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Murs de Gabions</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSlab()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Dalle Béton</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMassif()}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Massif Béton</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddAbri()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Abri Télé-exploitation</span>
                </button>
              </div>
            </div>

            {/* HORIZONTAL GRID OF 7 CAD COMPONENT EDIT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* 1. Périmètre & Clôture */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-blue-400 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <ShieldAlert className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">Périmètre & Clôture</span>
                    </span>
                  </div>
                  <span className="font-mono text-blue-300 font-extrabold text-[10px] bg-blue-950 px-2 py-0.5 rounded border border-blue-800 inline-block">
                    {fenceA}m x {fenceB}m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCadModal("perimeter")}
                  className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Saisir Périmètre ⚙️</span>
                </button>
              </div>

              {/* 2. Abri Télé-exploitation */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-emerald-400 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Abri Télé-expl.</span>
                    </span>
                  </div>
                  <span className="font-mono text-emerald-300 font-extrabold text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 inline-block">
                    {teleShelterLength}m x {teleShelterWidth}m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCadModal("shelters")}
                  className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Saisir Abri Télé ⚙️</span>
                </button>
              </div>

              {/* 3. Ouvrages & Blocs */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-amber-400 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <Square className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Ouvrages & Blocs</span>
                    </span>
                  </div>
                  <span className="font-mono text-amber-300 font-extrabold text-[10px] bg-amber-950 px-2 py-0.5 rounded border border-amber-800 inline-block">
                    {ouvrages.length > 1 ? `${ouvrages.length} Blocs` : "Poste Unique"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCadModal("ouvrages")}
                  className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Gérer Blocs ⚙️</span>
                </button>
              </div>

              {/* 4. Voile Béton Armé */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-indigo-400 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">Voile Béton Armé</span>
                    </span>
                  </div>
                  <span className={`font-mono text-[10px] font-extrabold px-2 py-0.5 rounded border inline-block ${
                    hasVoilePeripherique ? "bg-indigo-950 text-indigo-300 border-indigo-800" : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}>
                    {hasVoilePeripherique ? `${voileSides.length} Côté(s)` : "Désactivé"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveVoileOuvrageId(selectedOuvrageId || ouvrages[0]?.id || null);
                    setActiveCadModal("voile");
                  }}
                  className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Saisir Voile ⚙️</span>
                </button>
              </div>

              {/* 5. Murs en Gabions */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-amber-500 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <Construction className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Murs Gabions</span>
                    </span>
                  </div>
                  <span className={`font-mono text-[10px] font-extrabold px-2 py-0.5 rounded border inline-block ${
                    hasGabions ? "bg-amber-950 text-amber-300 border-amber-800" : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}>
                    {hasGabions ? `${Object.entries(gabionSideConfigs).filter(([_, c]) => c.enabled).length} Côté(s)` : "Désactivés"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveGabionOuvrageId(selectedOuvrageId || ouvrages[0]?.id || null);
                    setActiveCadModal("gabions");
                  }}
                  className="w-full py-1.5 px-2 bg-amber-700 hover:bg-amber-600 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Designer Gabions ⚙️</span>
                </button>
              </div>

              {/* 6. Dalles & Socles Béton */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-purple-400 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">Dalles & Socles</span>
                    </span>
                  </div>
                  <span className="font-mono text-purple-300 font-extrabold text-[10px] bg-purple-950 px-2 py-0.5 rounded border border-purple-800 inline-block">
                    {slabs.length} Dalles ({totalSlabsArea.toFixed(1)} m²)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCadModal("slabs")}
                  className="w-full py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Gérer Dalles ⚙️</span>
                </button>
              </div>

              {/* 7. Portails & Accès */}
              <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 hover:border-cyan-400 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-black text-white uppercase flex items-center gap-1.5 truncate">
                      <DoorClosed className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Portails & Accès</span>
                    </span>
                  </div>
                  <span className="font-mono text-cyan-300 font-extrabold text-[10px] bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 inline-block">
                    {gates.length} Accès
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCadModal("gates")}
                  className="w-full py-1.5 px-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="truncate">Placer Accès ⚙️</span>
                </button>
              </div>
            </div>
          </div>

          <div ref={printAreaRef} className="space-y-6">
          {/* ========================================================================= */}
          {/* CARRÉ BLEU (BLUE BOX): SECTION DESSIN ET ÉDITION (FULL WIDTH CANVAS)       */}
          {/* ========================================================================= */}
          <div className="w-full bg-slate-950 border-2 border-blue-500/80 rounded-3xl p-4 md:p-6 text-white space-y-4 shadow-2xl relative">
            <div className="flex flex-wrap items-center justify-between border-b border-blue-500/30 pb-2 mb-2 gap-2">
              <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Carré Bleu — Espace de Dessin, Canvas et Édition Technique (Grand Format)</span>
              </span>

              {/* Floating Toolbar: Zoom + Wheel Scroll + Impression Paysage */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-cyan-500/40 p-1.5 rounded-2xl shadow-lg">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Zoom Arrière (-)"
                  className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl font-bold transition-all border border-slate-700 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-black text-cyan-300 px-1.5 min-w-[45px] text-center">
                  {Math.round(croquisZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom Avant (+)"
                  className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl font-bold transition-all border border-slate-700 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="Réinitialiser Zoom 100%"
                  className="px-2 py-1 text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>100%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCotations(prev => !prev)}
                  title="Afficher/Masquer les cotations automatiques"
                  className={`px-2 py-1 text-[10px] font-mono font-bold rounded-xl transition-all border flex items-center gap-1 cursor-pointer ${
                    showCotations ? "bg-cyan-950 text-cyan-300 border-cyan-700" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <Ruler className="w-3 h-3" />
                  <span>Cotations</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCartouchePosition(prev => prev === "left" ? "right" : "left")}
                  title="Déplacer le cartouche sur le schéma (Gauche / Droite)"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-[10px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>📋 Cartouche: {cartouchePosition === "left" ? "⬅️ Gauche (Optimisé)" : "➡️ Droite"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDirectPrintCroquis}
                  title="Imprimer au format paysage (Cartouche à gauche, Dessin à droite)"
                  className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-[10px] font-black shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>🖨️ Imprimer (Paysage)</span>
                </button>
              </div>
            </div>

            {/* BARRE D'OUTILS PERMANENTE : PALETTE D'AJOUT DE FORMES CAD & FIGMA */}
            <div className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-2.5 shadow-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-cyan-400 font-mono tracking-wider px-2 py-0.5 bg-cyan-950 rounded border border-cyan-800">
                  + AJOUTER DESSIN:
                </span>
                <button
                  type="button"
                  onClick={() => addVectorShape("square")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Carré / Rectangle"
                >
                  <Square className="w-3.5 h-3.5 text-sky-400" />
                  <span>Carré / Rectangle</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("rounded-rect")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Rectangle Arrondi"
                >
                  <Square className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Rect. Arrondi</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("circle")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Cercle / Ellipse"
                >
                  <Circle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cercle</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("triangle")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Triangle"
                >
                  <Triangle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Triangle</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("arrow")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter une Flèche / Ligne"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>Flèche / Ligne</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("cotation")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter une Côte de Dimension"
                >
                  <Ruler className="w-3.5 h-3.5 text-purple-400" />
                  <span>Côte</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("text")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-orange-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Texte Annotation"
                >
                  <Type className="w-3.5 h-3.5 text-orange-400" />
                  <span>Texte</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("vanne")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-red-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter une Vanne Gaz"
                >
                  <Disc className="w-3.5 h-3.5 text-red-400" />
                  <span>Vanne</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("regulateur")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Régulateur Gaz"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Régulateur</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("filtre-separateur")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter un Filtre Séparateur"
                >
                  <Filter className="w-3.5 h-3.5 text-teal-400" />
                  <span>Filtre</span>
                </button>
                <button
                  type="button"
                  onClick={() => addVectorShape("hatch")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Ajouter des Hachures Béton Armé"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Hachure</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowShortcutsModal(true)}
                className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded-xl text-[10px] font-extrabold transition-all border border-cyan-700 flex items-center gap-1 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>⌨️ Raccourcis CAD</span>
              </button>
            </div>

            <div 
                        className="relative w-full overflow-hidden bg-slate-950 rounded-b-xl border border-slate-800 shadow-2xl min-h-[580px] flex items-center justify-center p-2 select-none"
                        onMouseMove={(e) => {
                          if (!draggingOuvrageId && !draggingSlabId && !draggingAbriId && !draggingMassifId && !draggingShapeId && !resizingShapeId && !rotatingShapeId) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const mouseX = e.clientX - rect.left;
                          const mouseY = e.clientY - rect.top;

                          // Same scale the blueprint SVG is actually rendered at
                          const scale = getBlueprintScale();

                          if (resizingShapeId && resizingHandle) {
                            const target = shapes.find(s => s.id === resizingShapeId);
                            if (target) {
                              const shapeCx = BLUEPRINT_CX + target.x * scale;
                              const shapeCy = BLUEPRINT_CY + target.y * scale;
                              const dx = mouseX - shapeCx;
                              const dy = mouseY - shapeCy;
                              const rad = -(target.rotation || 0) * (Math.PI / 180);
                              const localScale = scale / 12;
                              const localX = (dx * Math.cos(rad) - dy * Math.sin(rad)) / localScale;
                              const localY = (dx * Math.sin(rad) + dy * Math.cos(rad)) / localScale;

                              let newW = target.width;
                              let newH = target.height;
                              if (resizingHandle === 'br') {
                                newW = Math.max(16, Math.round(localX * 2));
                                newH = Math.max(16, Math.round(localY * 2));
                              } else if (resizingHandle === 'bl') {
                                newW = Math.max(16, Math.round(-localX * 2));
                                newH = Math.max(16, Math.round(localY * 2));
                              } else if (resizingHandle === 'tr') {
                                newW = Math.max(16, Math.round(localX * 2));
                                newH = Math.max(16, Math.round(-localY * 2));
                              } else if (resizingHandle === 'tl') {
                                newW = Math.max(16, Math.round(-localX * 2));
                                newH = Math.max(16, Math.round(-localY * 2));
                              }
                              setShapes(prev => prev.map(s => s.id === resizingShapeId ? { ...s, width: newW, height: newH } : s));
                            }
                            return;
                          }

                          if (rotatingShapeId) {
                            const target = shapes.find(s => s.id === rotatingShapeId);
                            if (target) {
                              const shapeCx = BLUEPRINT_CX + target.x * scale;
                              const shapeCy = BLUEPRINT_CY + target.y * scale;
                              const angleRad = Math.atan2(mouseY - shapeCy, mouseX - shapeCx);
                              let angleDeg = Math.round(angleRad * (180 / Math.PI) + 90);
                              if (angleDeg < 0) angleDeg += 360;
                              angleDeg = angleDeg % 360;
                              setShapes(prev => prev.map(s => s.id === rotatingShapeId ? { ...s, rotation: angleDeg } : s));
                            }
                            return;
                          }

                          if (draggingOuvrageId) {
                            const deltaX = (mouseX - dragStartPos.pointerX) / scale;
                            const deltaY = (mouseY - dragStartPos.pointerY) / scale;
                            setOuvrages(prev => prev.map(ov => ov.id === draggingOuvrageId ? {
                              ...ov,
                              xOffset: Math.round((ov.xOffset + deltaX) * 10) / 10,
                              yOffset: Math.round((ov.yOffset + deltaY) * 10) / 10
                            } : ov));
                            setDragStartPos({ pointerX: mouseX, pointerY: mouseY, initX: 0, initY: 0 });
                          } else if (draggingSlabId) {
                            const deltaX = (mouseX - dragStartPos.pointerX) / scale;
                            const deltaY = (mouseY - dragStartPos.pointerY) / scale;
                            setSlabs(prev => prev.map(s => s.id === draggingSlabId ? {
                              ...s,
                              xOffset: Math.round((s.xOffset + deltaX) * 10) / 10,
                              yOffset: Math.round((s.yOffset + deltaY) * 10) / 10
                            } : s));
                            setDragStartPos({ pointerX: mouseX, pointerY: mouseY, initX: 0, initY: 0 });
                          } else if (draggingShapeId && dragStartPos) {
                            const deltaX = (mouseX - dragStartPos.pointerX) / scale;
                            const deltaY = (mouseY - dragStartPos.pointerY) / scale;
                            setShapes(prev => prev.map(sh => sh.id === draggingShapeId ? {
                              ...sh,
                              x: Math.round((dragStartPos.initX + deltaX) * 100) / 100,
                              y: Math.round((dragStartPos.initY + deltaY) * 100) / 100
                            } : sh));
                          } else if (draggingAbriId) {
                            const deltaX = (mouseX - dragStartPos.pointerX) / scale;
                            const deltaY = (mouseY - dragStartPos.pointerY) / scale;
                            setAbris(prev => prev.map(a => a.id === draggingAbriId ? {
                              ...a,
                              xOffset: Math.round((a.xOffset + deltaX) * 10) / 10,
                              yOffset: Math.round((a.yOffset + deltaY) * 10) / 10
                            } : a));
                            setDragStartPos({ pointerX: mouseX, pointerY: mouseY, initX: 0, initY: 0 });
                          } else if (draggingMassifId) {
                            const deltaX = (mouseX - dragStartPos.pointerX) / scale;
                            const deltaY = (mouseY - dragStartPos.pointerY) / scale;
                            setMassifs(prev => prev.map(m => m.id === draggingMassifId ? {
                              ...m,
                              xOffset: Math.round((m.xOffset + deltaX) * 10) / 10,
                              yOffset: Math.round((m.yOffset + deltaY) * 10) / 10
                            } : m));
                            setDragStartPos({ pointerX: mouseX, pointerY: mouseY, initX: 0, initY: 0 });
                          }
                        }}
                        onMouseUp={() => {
                          setDraggingOuvrageId(null);
                          setDraggingSlabId(null);
                          setDraggingAbriId(null);
                          setDraggingMassifId(null);
                          setDraggingShapeId(null);
                          setResizingShapeId(null);
                          setResizingHandle(null);
                          setRotatingShapeId(null);
                        }}
                      >
                        {(() => {
                          // Standard A3 Blueprint dimensions (1189 x 841 ratio)
                          const svgW = 1189;
                          const svgH = 841;
                          const cX = svgW / 2;
                          const cY = svgH / 2;

                          // Compute bounding box of all ouvrages for auto-scaling
                          const maxDim = Math.max(
                            ...ouvrages.map(o => Math.max(o.length, o.width, Math.abs(o.xOffset) + o.length, Math.abs(o.yOffset) + o.width)),
                            40
                          );
                          const scale = Math.min(18, Math.max(6, 600 / maxDim)) * croquisZoom;

                          // Style helper for Slab Type & Status
                          const getSlabStyle = (type: SlabType, status?: "nouveau" | "ancien") => {
                            const isNew = status === "nouveau";
                            const strokeDash = isNew ? "5 3" : "none";
                            switch (type) {
                              case "poste_detente":
                                return { fill: isNew ? "#0284c7" : "#1e3a8a", fillOpacity: 0.55, stroke: isNew ? "#38bdf8" : "#60a5fa", strokeWidth: 2, dash: strokeDash };
                              case "rechaffeur":
                                return { fill: isNew ? "#d97706" : "#854d0e", fillOpacity: 0.55, stroke: isNew ? "#fbbf24" : "#f59e0b", strokeWidth: 2, dash: strokeDash };
                              case "gare_racleur_arrivee":
                              case "gare_racleur_depart":
                                return { fill: isNew ? "#9333ea" : "#581c87", fillOpacity: 0.55, stroke: isNew ? "#c084fc" : "#a855f7", strokeWidth: 2, dash: strokeDash };
                              case "epandage_assiette":
                                return { fill: isNew ? "#059669" : "#064e3b", fillOpacity: 0.55, stroke: isNew ? "#34d399" : "#10b981", strokeWidth: 2, dash: strokeDash };
                              case "abri_tele":
                                return { fill: isNew ? "#475569" : "#1e293b", fillOpacity: 0.65, stroke: isNew ? "#94a3b8" : "#64748b", strokeWidth: 2, dash: strokeDash };
                              default:
                                return { fill: isNew ? "#2563eb" : "#1e293b", fillOpacity: 0.55, stroke: isNew ? "#60a5fa" : "#3b82f6", strokeWidth: 2, dash: strokeDash };
                            }
                          };

                          return (
                            <svg
                              id="mainCadPlanSvg"
                              viewBox={`0 0 ${svgW} ${svgH}`}
                              className="w-full h-auto max-h-[750px] object-contain drop-shadow-xl"
                              style={{ background: "#090d16" }}
                            >
                              <defs>
                                {/* Grid Blueprint Pattern */}
                                <pattern id="blueprintGrid" width={10 * croquisZoom} height={10 * croquisZoom} patternUnits="userSpaceOnUse">
                                  <path d={`M ${10 * croquisZoom} 0 L 0 0 0 ${10 * croquisZoom}`} fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
                                </pattern>
                                <pattern id="blueprintGridMajor" width={50 * croquisZoom} height={50 * croquisZoom} patternUnits="userSpaceOnUse">
                                  <rect width={50 * croquisZoom} height={50 * croquisZoom} fill="url(#blueprintGrid)" />
                                  <path d={`M ${50 * croquisZoom} 0 L 0 0 0 ${50 * croquisZoom}`} fill="none" stroke="#334155" strokeWidth="1" strokeOpacity="0.6" />
                                </pattern>

                                {/* Patterns for Voile & Gabion Hatching */}
                                <pattern id="hatchGabion" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                  <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="1.5" />
                                </pattern>
                                <pattern id="hatchVoile" width="6" height="6" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
                                  <line x1="0" y1="0" x2="0" y2="6" stroke="#0ea5e9" strokeWidth="1.2" />
                                </pattern>
                              </defs>

                              {/* Canvas Background Grid */}
                              <rect width={svgW} height={svgH} fill="#090d16" />
                              <rect width={svgW} height={svgH} fill="url(#blueprintGridMajor)" />

                              {/* Outer A3 Paper Border Accent */}
                              <rect x="12" y="12" width={svgW - 24} height={svgH - 24} fill="none" stroke="#334155" strokeWidth="1.5" rx="4" />
                              <rect x="18" y="18" width={svgW - 36} height={svgH - 36} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

                              {/* Center axes */}
                              <line x1={cX} y1="20" x2={cX} y2={svgH - 20} stroke="#1e293b" strokeWidth="1" strokeDasharray="2 4" />
                              <line x1="20" y1={cY} x2={svgW - 20} y2={cY} stroke="#1e293b" strokeWidth="1" strokeDasharray="2 4" />

                              {/* North Compass Rose */}
                              <g transform={`translate(${svgW - 80}, 65)`}>
                                <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                                <polygon points="0,-18 5,0 0,-4 -5,0" fill="#f59e0b" />
                                <polygon points="0,18 5,0 0,4 -5,0" fill="#475569" />
                                <text x="0" y="-24" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">N</text>
                                <text x="26" y="4" fill="#94a3b8" fontSize="9" textAnchor="start">E</text>
                                <text x="-26" y="4" fill="#94a3b8" fontSize="9" textAnchor="end">O</text>
                                <text x="0" y="32" fill="#64748b" fontSize="9" textAnchor="middle">S</text>
                              </g>

                              {/* Scale Indicator Bar */}
                              <g transform="translate(35, 45)">
                                <rect x="0" y="0" width="120" height="20" fill="#0f172a" stroke="#334155" strokeWidth="1" rx="3" />
                                <line x1="10" y1="12" x2="110" y2="12" stroke="#38bdf8" strokeWidth="2" />
                                <line x1="10" y1="8" x2="10" y2="16" stroke="#38bdf8" strokeWidth="2" />
                                <line x1="60" y1="9" x2="60" y2="15" stroke="#38bdf8" strokeWidth="1.5" />
                                <line x1="110" y1="8" x2="110" y2="16" stroke="#38bdf8" strokeWidth="2" />
                                <text x="10" y="-4" fill="#94a3b8" fontSize="9" fontWeight="bold">0m</text>
                                <text x="60" y="-4" fill="#94a3b8" fontSize="9" fontWeight="bold">5m</text>
                                <text x="110" y="-4" fill="#94a3b8" fontSize="9" fontWeight="bold">10m</text>
                              </g>

                              {/* ==================== RENDERING ALL OUVRAGES / BLOCS ==================== */}
                              {ouvrages.map((ov, idx) => {
                                const isSelected = selectedOuvrageId === ov.id;
                                const isNew = ov.status === "nouveau";

                                // Screen position calculation based on offset
                                const fW = ov.length * scale;
                                const fH = ov.width * scale;
                                const fX = cX + (ov.xOffset * scale) - (fW / 2);
                                const fY = cY + (ov.yOffset * scale) - (fH / 2);

                                // Main color palette
                                const strokeColor = isNew ? "#f59e0b" : "#3b82f6";
                                const badgeBg = isNew ? "#78350f" : "#1e3a8a";
                                const badgeText = isNew ? "#fef3c7" : "#dbeafe";
                                const badgeLabel = isNew ? "Nouveau (Extension)" : "Ancien (Existant)";

                                return (
                                  <g 
                                    key={ov.id} 
                                    className="cursor-move transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOuvrageId(ov.id);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedOuvrageId(ov.id);
                                      setDraggingOuvrageId(ov.id);
                                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                      if (rect) {
                                        setDragStartPos({
                                          pointerX: e.clientX - rect.left,
                                          pointerY: e.clientY - rect.top,
                                          initX: 0,
                                          initY: 0
                                        });
                                      }
                                    }}
                                  >
                                    {/* Ouvrage Perimeter Area Fill */}
                                    <rect
                                      x={fX}
                                      y={fY}
                                      width={fW}
                                      height={fH}
                                      fill={isNew ? "#312e81" : "#0f172a"}
                                      fillOpacity={isNew ? "0.25" : "0.4"}
                                      stroke={strokeColor}
                                      strokeWidth={isSelected ? 3 : 2}
                                      strokeDasharray={isNew ? "6 3" : "none"}
                                      rx="2"
                                    />

                                    {/* Selected highlight glow */}
                                    {isSelected && (
                                      <rect
                                        x={fX - 4}
                                        y={fY - 4}
                                        width={fW + 8}
                                        height={fH + 8}
                                        fill="none"
                                        stroke="#38bdf8"
                                        strokeWidth="1.5"
                                        strokeDasharray="4 2"
                                        rx="4"
                                      />
                                    )}

                                    {/* Gabions Protection Walls around Ouvrage (1 ligne par étage, retrait cumulé) */}
                                    {ov.hasGabions && ov.gabionSides && (
                                      <g>
                                        {(Object.keys(ov.gabionSides) as Array<"nord" | "sud" | "est" | "ouest">).map((side) => {
                                          const gConf = ov.gabionSides?.[side];
                                          if (!gConf || !gConf.enabled) return null;
                                          const tiers = gConf.tiers || [{ height: 1, depth: gConf.width || 1, redanMode: "fixe", redanValue: 0 }];
                                          const wallLen = (side === "nord" || side === "sud") ? fW : fH;
                                          const gSpan = Math.min(wallLen, Math.max(4, (gConf.length || 10) * scale));
                                          const clampedOffset = Math.min(Math.max(0, (gConf.offset || 0) * scale), Math.max(0, wallLen - gSpan));

                                          let cumulative = 0;
                                          const tierPositions = tiers.map((t, idx) => {
                                            if (idx > 0) {
                                              const prevDepth = tiers[idx - 1].depth || 1;
                                              const redan = t.redanMode === "pourcentage" ? (prevDepth * (t.redanValue || 0)) / 100 : (t.redanValue || 0);
                                              cumulative += redan;
                                            }
                                            return cumulative;
                                          });
                                          const tierColors = ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"];

                                          return (
                                            <g key={`gabion-${ov.id}-${side}`}>
                                              {tiers.map((t, idx) => {
                                                const perpOffset = 4 + tierPositions[idx] * scale;
                                                const basketSize = Math.max(6, (t.depth || 1) * scale);
                                                const nBaskets = Math.max(1, Math.round(gSpan / basketSize));
                                                const cell = gSpan / nBaskets;
                                                const tierColor = tierColors[idx % tierColors.length];
                                                const basketRects = [];
                                                for (let bi = 0; bi < nBaskets; bi++) {
                                                  let bx = fX, by = fY, bw = cell, bh = basketSize;
                                                  if (side === "nord") { bx = fX + clampedOffset + bi * cell; by = fY - perpOffset - basketSize; }
                                                  else if (side === "sud") { bx = fX + clampedOffset + bi * cell; by = fY + fH + perpOffset; }
                                                  else if (side === "ouest") { bx = fX - perpOffset - basketSize; by = fY + clampedOffset + bi * cell; bw = basketSize; bh = cell; }
                                                  else if (side === "est") { bx = fX + fW + perpOffset; by = fY + clampedOffset + bi * cell; bw = basketSize; bh = cell; }
                                                  basketRects.push(
                                                    <rect
                                                      key={`gbasket-${ov.id}-${side}-${idx}-${bi}`}
                                                      x={bx} y={by}
                                                      width={Math.max(1, bw - 1)}
                                                      height={Math.max(1, bh - 1)}
                                                      fill="url(#hatchGabion)"
                                                      stroke={tierColor}
                                                      strokeWidth="1"
                                                    />
                                                  );
                                                }
                                                return <g key={`gtier-${ov.id}-${side}-${idx}`}>{basketRects}</g>;
                                              })}
                                              <text
                                                x={side === "nord" || side === "sud" ? fX + clampedOffset + gSpan / 2 : (side === "ouest" ? fX - 8 - tierPositions[tierPositions.length - 1] * scale : fX + fW + 8 + tierPositions[tierPositions.length - 1] * scale)}
                                                y={side === "nord" ? fY - 8 - tierPositions[tierPositions.length - 1] * scale : side === "sud" ? fY + fH + 14 + tierPositions[tierPositions.length - 1] * scale : fY + clampedOffset + gSpan / 2}
                                                fill="#fbbf24"
                                                fontSize="7.5"
                                                fontWeight="bold"
                                                textAnchor="middle"
                                              >
                                                Gabion ({tiers.length} ét.)
                                              </text>
                                            </g>
                                          );
                                        })}
                                      </g>
                                    )}

                                    {/* Voile Béton Armé Périmétrique (par côté sélectionné) */}
                                    {ov.hasVoile && ov.voileSides && ov.voileSides.length > 0 && (
                                      <g>
                                        {ov.voileSides.map((side) => {
                                          const vThick = Math.max(2, (ov.voileThickness || 0.2) * scale);
                                          let vx = fX, vy = fY, vw = fW, vh = fH;
                                          if (side === "nord") { vy = fY - vThick; vh = vThick; }
                                          else if (side === "sud") { vy = fY + fH; vh = vThick; }
                                          else if (side === "ouest") { vx = fX - vThick; vw = vThick; }
                                          else if (side === "est") { vx = fX + fW; vw = vThick; }
                                          return (
                                            <rect
                                              key={`voile-${ov.id}-${side}`}
                                              x={vx}
                                              y={vy}
                                              width={vw}
                                              height={vh}
                                              fill="#0ea5e9"
                                              fillOpacity="0.35"
                                              stroke="#0ea5e9"
                                              strokeWidth="1.5"
                                            />
                                          );
                                        })}
                                      </g>
                                    )}

                                    {/* Clôture Périmétrique Fence Mesh */}
                                    {ov.hasFence && (
                                      <rect
                                        x={fX + 2}
                                        y={fY + 2}
                                        width={Math.max(1, fW - 4)}
                                        height={Math.max(1, fH - 4)}
                                        fill="none"
                                        stroke={isNew ? "#fbbf24" : "#64748b"}
                                        strokeWidth="1"
                                        strokeDasharray="3 3"
                                      />
                                    )}

                                    {/* Block Label & Badge Header */}
                                    <g transform={`translate(${fX + 8}, ${fY + 16})`}>
                                      <rect
                                        x="0"
                                        y="-12"
                                        width={Math.min(220, fW - 16)}
                                        height="22"
                                        fill={badgeBg}
                                        stroke={strokeColor}
                                        strokeWidth="1"
                                        rx="4"
                                      />
                                      <text x="8" y="2" fill={badgeText} fontSize="10" fontWeight="bold">
                                        {ov.name || `Bloc ${idx + 1}`} • {ov.length}m x {ov.width}m
                                      </text>
                                    </g>

                                    {/* Status Badge Tag */}
                                    <g transform={`translate(${fX + fW - 110}, ${fY + 16})`}>
                                      <rect
                                        x="0"
                                        y="-12"
                                        width="102"
                                        height="18"
                                        fill={isNew ? "#15803d" : "#1e293b"}
                                        stroke={isNew ? "#4ade80" : "#64748b"}
                                        strokeWidth="1"
                                        rx="9"
                                      />
                                      <circle cx="10" cy="-3" r="3" fill={isNew ? "#22c55e" : "#3b82f6"} />
                                      <text x="18" y="1" fill="#ffffff" fontSize="8.5" fontWeight="bold">
                                        {badgeLabel}
                                      </text>
                                    </g>

                                    {/* Dimension Cotes (A & B) */}
                                    <text x={fX + fW / 2} y={fY - 6} fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">
                                      A = {ov.length} m
                                    </text>
                                    <text x={fX - 8} y={fY + fH / 2} fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="end" transform={`rotate(-90 ${fX - 8} ${fY + fH / 2})`}>
                                      B = {ov.width} m
                                    </text>
                                  </g>
                                );
                              })}

                              {/* ==================== RENDERING PARAMETRIC SLABS ==================== */}
                              {slabs.map((slab) => {
                                const st = getSlabStyle(slab.type, slab.status);
                                const isSelected = selectedSlabId === slab.id;
                                const isNew = slab.status === "nouveau" || slab.isExtension;

                                // Position relative to primary canvas or coordinates
                                const sW = slab.length * scale;
                                const sH = slab.width * scale;
                                const sX = cX + (slab.xOffset * scale) - (sW / 2);
                                const sY = cY + (slab.yOffset * scale) - (sH / 2);

                                return (
                                  <g
                                    key={slab.id}
                                    className="cursor-grab active:cursor-grabbing hover:opacity-95"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSlabId(slab.id);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedSlabId(slab.id);
                                      setDraggingSlabId(slab.id);
                                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                      if (rect) {
                                        setDragStartPos({
                                          pointerX: e.clientX - rect.left,
                                          pointerY: e.clientY - rect.top,
                                          initX: 0,
                                          initY: 0
                                        });
                                      }
                                    }}
                                  >
                                    {/* Slab Geometry Body */}
                                    <rect
                                      x={sX}
                                      y={sY}
                                      width={sW}
                                      height={sH}
                                      fill={st.fill}
                                      fillOpacity={st.fillOpacity}
                                      stroke={isSelected ? "#38bdf8" : st.stroke}
                                      strokeWidth={isSelected ? 2.5 : st.strokeWidth}
                                      strokeDasharray={st.dash}
                                      rx="2"
                                    />

                                    {/* Diagonal cross for structural slab identification */}
                                    <line x1={sX} y1={sY} x2={sX + sW} y2={sY + sH} stroke={st.stroke} strokeWidth="0.5" strokeOpacity="0.4" />
                                    <line x1={sX + sW} y1={sY} x2={sX} y2={sY + sH} stroke={st.stroke} strokeWidth="0.5" strokeOpacity="0.4" />

                                    {/* Slab Title & Dimensions */}
                                    <text x={sX + sW / 2} y={sY + sH / 2 - 2} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                                      {slab.name}
                                    </text>
                                    <text x={sX + sW / 2} y={sY + sH / 2 + 10} fill="#cbd5e1" fontSize="8" textAnchor="middle">
                                      {slab.length}x{slab.width}m (e={slab.thickness}m)
                                    </text>

                                    {/* Status Badge */}
                                    <rect
                                      x={sX + 2}
                                      y={sY + 2}
                                      width="38"
                                      height="12"
                                      fill={isNew ? "#15803d" : "#334155"}
                                      rx="2"
                                    />
                                    <text x={sX + 21} y={sY + 10} fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                                      {isNew ? "NOUVEAU" : "ANCIEN"}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* ==================== RENDERING PARAMETRIC ABRIS & MASSIFS ==================== */}
                              {abris.map((abri) => {
                                const aW = abri.length * scale;
                                const aH = abri.width * scale;
                                const aX = cX + (abri.xOffset * scale) - (aW / 2);
                                const aY = cY + (abri.yOffset * scale) - (aH / 2);
                                const isNew = abri.status === "nouveau";
                                const isSelectedAbri = selectedAbriId === abri.id;

                                return (
                                  <g
                                    key={abri.id}
                                    className="cursor-move"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAbriId(abri.id);
                                      setSelectedSlabId(null);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedAbriId(abri.id);
                                      setSelectedSlabId(null);
                                      setDraggingAbriId(abri.id);
                                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                      if (rect) {
                                        setDragStartPos({
                                          pointerX: e.clientX - rect.left,
                                          pointerY: e.clientY - rect.top,
                                          initX: 0,
                                          initY: 0
                                        });
                                      }
                                    }}
                                  >
                                    <rect
                                      x={aX}
                                      y={aY}
                                      width={aW}
                                      height={aH}
                                      fill="#1e293b"
                                      stroke={isSelectedAbri ? "#38bdf8" : (isNew ? "#f59e0b" : "#94a3b8")}
                                      strokeWidth={isSelectedAbri ? 3 : 2}
                                      rx="2"
                                    />
                                    {isSelectedAbri && (
                                      <rect x={aX - 4} y={aY - 4} width={aW + 8} height={aH + 8} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" rx="4" />
                                    )}
                                    <text x={aX + aW / 2} y={aY + aH / 2 + 3} fill="#f8fafc" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                                      {abri.name} ({abri.type === "01_porte" ? "1P" : "2P"})
                                    </text>
                                  </g>
                                );
                              })}

                              {massifs.map((m) => {
                                const mW = m.length * scale;
                                const mH = m.width * scale;
                                const mX = cX + (m.xOffset * scale) - (mW / 2);
                                const mY = cY + (m.yOffset * scale) - (mH / 2);
                                const isSelectedMassif = selectedMassifId === m.id;

                                return (
                                  <g
                                    key={m.id}
                                    className="cursor-move"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMassifId(m.id);
                                      setSelectedSlabId(null);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedMassifId(m.id);
                                      setSelectedSlabId(null);
                                      setDraggingMassifId(m.id);
                                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                      if (rect) {
                                        setDragStartPos({
                                          pointerX: e.clientX - rect.left,
                                          pointerY: e.clientY - rect.top,
                                          initX: 0,
                                          initY: 0
                                        });
                                      }
                                    }}
                                  >
                                    <rect
                                      x={mX}
                                      y={mY}
                                      width={mW}
                                      height={mH}
                                      fill="#451a03"
                                      stroke={isSelectedMassif ? "#38bdf8" : "#d97706"}
                                      strokeWidth={isSelectedMassif ? 3 : 1.5}
                                      rx="1"
                                    />
                                    {isSelectedMassif && (
                                      <rect x={mX - 4} y={mY - 4} width={mW + 8} height={mH + 8} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" rx="4" />
                                    )}
                                    <text x={mX + mW / 2} y={mY + mH / 2 + 3} fill="#fef3c7" fontSize="8" fontWeight="bold" textAnchor="middle">
                                      {m.name}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* ==================== AUTO-COTATIONS (dalles / abri / clôture / voisin le plus proche) ==================== */}
                              {showCotations && (() => {
                                const mainOv = ouvrages[0];
                                if (!mainOv) return null;
                                const fenceX1 = cX + (mainOv.xOffset * scale) - (mainOv.length * scale) / 2;
                                const fenceY1 = cY + (mainOv.yOffset * scale) - (mainOv.width * scale) / 2;
                                const fenceX2 = fenceX1 + mainOv.length * scale;
                                const fenceY2 = fenceY1 + mainOv.width * scale;

                                type FurnitureBox = { id: string; x1: number; y1: number; x2: number; y2: number };
                                const boxes: FurnitureBox[] = [
                                  ...slabs.map(s => {
                                    const w = s.length * scale, h = s.width * scale;
                                    const x = cX + s.xOffset * scale - w / 2, y = cY + s.yOffset * scale - h / 2;
                                    return { id: s.id, x1: x, y1: y, x2: x + w, y2: y + h };
                                  }),
                                  ...abris.map(a => {
                                    const w = a.length * scale, h = a.width * scale;
                                    const x = cX + a.xOffset * scale - w / 2, y = cY + a.yOffset * scale - h / 2;
                                    return { id: a.id, x1: x, y1: y, x2: x + w, y2: y + h };
                                  })
                                ];

                                const filteredBoxes = cotationFilter === "selected"
                                  ? boxes.filter(b => b.id === selectedSlabId || b.id === selectedAbriId)
                                  : boxes;

                                const dimLine = (key: string, lx1: number, ly1: number, lx2: number, ly2: number, label: string, color: string) => {
                                  const horiz = Math.abs(lx2 - lx1) >= Math.abs(ly2 - ly1);
                                  const midX = (lx1 + lx2) / 2, midY = (ly1 + ly2) / 2;
                                  return (
                                    <g key={key}>
                                      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
                                      <line x1={lx1} y1={ly1 - 3} x2={lx1} y2={ly1 + 3} stroke={color} strokeWidth="1.2" />
                                      <line x1={lx2} y1={ly2 - 3} x2={lx2} y2={ly2 + 3} stroke={color} strokeWidth="1.2" />
                                      <rect x={midX - (horiz ? 16 : 22)} y={midY - 7} width={horiz ? 32 : 44} height="14" rx="3" fill="#0f172a" stroke={color} strokeWidth="0.8" />
                                      <text x={midX} y={midY + 3} fill={color} fontSize="7.5" fontWeight="bold" textAnchor="middle">{label}</text>
                                    </g>
                                  );
                                };

                                const clearanceLines: any[] = [];
                                filteredBoxes.forEach((b) => {
                                  const cyMid = b.y1 + (b.y2 - b.y1) / 2;
                                  const cxMid = b.x1 + (b.x2 - b.x1) / 2;
                                  const distWest = (b.x1 - fenceX1) / scale;
                                  const distEast = (fenceX2 - b.x2) / scale;
                                  if (distWest <= distEast) {
                                    clearanceLines.push(dimLine(`cl-w-${b.id}`, fenceX1, cyMid, b.x1, cyMid, `${distWest.toFixed(1)}m`, "#94a3b8"));
                                  } else {
                                    clearanceLines.push(dimLine(`cl-e-${b.id}`, b.x2, cyMid, fenceX2, cyMid, `${distEast.toFixed(1)}m`, "#94a3b8"));
                                  }
                                  const distNord = (b.y1 - fenceY1) / scale;
                                  const distSud = (fenceY2 - b.y2) / scale;
                                  if (distNord <= distSud) {
                                    clearanceLines.push(dimLine(`cl-n-${b.id}`, cxMid, fenceY1, cxMid, b.y1, `${distNord.toFixed(1)}m`, "#94a3b8"));
                                  } else {
                                    clearanceLines.push(dimLine(`cl-s-${b.id}`, cxMid, b.y2, cxMid, fenceY2, `${distSud.toFixed(1)}m`, "#94a3b8"));
                                  }
                                });

                                const GAP_THRESHOLD = 20 * scale;
                                const usedPairs = new Set<string>();
                                const neighborLines: any[] = [];
                                filteredBoxes.forEach((a) => {
                                  let best: { b: FurnitureBox; gap: number; horiz: boolean } | null = null;
                                  boxes.forEach((b) => {
                                    if (a.id === b.id) return;
                                    const vOverlap = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
                                    const hOverlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
                                    let gap: number | null = null;
                                    let horiz = true;
                                    if (vOverlap > 0 && b.x1 >= a.x2) { gap = b.x1 - a.x2; horiz = true; }
                                    else if (vOverlap > 0 && a.x1 >= b.x2) { gap = a.x1 - b.x2; horiz = true; }
                                    else if (hOverlap > 0 && b.y1 >= a.y2) { gap = b.y1 - a.y2; horiz = false; }
                                    else if (hOverlap > 0 && a.y1 >= b.y2) { gap = a.y1 - b.y2; horiz = false; }
                                    if (gap !== null && gap >= 0 && gap < GAP_THRESHOLD && (!best || gap < best.gap)) {
                                      best = { b, gap, horiz };
                                    }
                                  });
                                  if (best) {
                                    const pairKey = [a.id, best.b.id].sort().join("|");
                                    if (!usedPairs.has(pairKey)) {
                                      usedPairs.add(pairKey);
                                      const gapM = (best.gap / scale).toFixed(1);
                                      if (best.horiz) {
                                        const midY = (Math.max(a.y1, best.b.y1) + Math.min(a.y2, best.b.y2)) / 2;
                                        const [lx, rx] = a.x2 <= best.b.x1 ? [a.x2, best.b.x1] : [best.b.x2, a.x1];
                                        neighborLines.push(dimLine(`nb-${pairKey}`, lx, midY, rx, midY, `${gapM}m`, "#38bdf8"));
                                      } else {
                                        const midX = (Math.max(a.x1, best.b.x1) + Math.min(a.x2, best.b.x2)) / 2;
                                        const [ty, by] = a.y2 <= best.b.y1 ? [a.y2, best.b.y1] : [best.b.y2, a.y1];
                                        neighborLines.push(dimLine(`nb-${pairKey}`, midX, ty, midX, by, `${gapM}m`, "#38bdf8"));
                                      }
                                    }
                                  }
                                });

                                return (
                                  <g opacity="0.95">
                                    {clearanceLines}
                                    {neighborLines}
                                  </g>
                                );
                              })()}

                              {/* ==================== COUPE A-A — REPÈRE DE COUPE SUR LE PLAN ==================== */}
                              {(() => {
                                const sideLetterMap: Record<"sud" | "nord" | "est" | "ouest", string> = {
                                  sud: "A",
                                  nord: "B",
                                  est: "C",
                                  ouest: "D",
                                };

                                return ouvrages.flatMap((ov, ovIndex) => {
                                  if (!ov.hasGabions || !ov.gabionSides) return [];
                                  const blockLetter = String.fromCharCode(65 + (ovIndex % 26));
                                  const fW = ov.length * scale;
                                  const fH = ov.width * scale;
                                  const fX = cX + (ov.xOffset * scale) - fW / 2;
                                  const fY = cY + (ov.yOffset * scale) - fH / 2;

                                  const sides: Array<"sud" | "nord" | "est" | "ouest"> = ["sud", "nord", "est", "ouest"];
                                  return sides.map((side) => {
                                    const gConf = ov.gabionSides?.[side];
                                    if (!gConf || !gConf.enabled || (gConf.tiers || []).length === 0) return null;

                                    const sideLetter = sideLetterMap[side];
                                    const wallLen = (side === "nord" || side === "sud") ? fW : fH;
                                    const gSpan = Math.min(wallLen, Math.max(4, (gConf.length || 10) * scale));
                                    const clampedOffset = Math.min(Math.max(0, (gConf.offset || 0) * scale), Math.max(0, wallLen - gSpan));

                                    let mx1 = fX, my1 = fY, mx2 = fX, my2 = fY;
                                    if (side === "sud") {
                                      mx1 = fX + clampedOffset - 12; my1 = fY + fH + 20;
                                      mx2 = fX + clampedOffset + gSpan + 12; my2 = fY + fH + 20;
                                    } else if (side === "nord") {
                                      mx1 = fX + clampedOffset - 12; my1 = fY - 20;
                                      mx2 = fX + clampedOffset + gSpan + 12; my2 = fY - 20;
                                    } else if (side === "ouest") {
                                      mx1 = fX - 20; my1 = fY + clampedOffset - 12;
                                      mx2 = fX - 20; my2 = fY + clampedOffset + gSpan + 12;
                                    } else if (side === "est") {
                                      mx1 = fX + fW + 20; my1 = fY + clampedOffset - 12;
                                      mx2 = fX + fW + 20; my2 = fY + clampedOffset + gSpan + 12;
                                    }

                                    const midX = (mx1 + mx2) / 2;
                                    const midY = (my1 + my2) / 2;

                                    return (
                                      <g key={`plan-cut-${ov.id}-${side}`}>
                                        <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 3" />
                                        <circle cx={mx1} cy={my1} r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                                        <text x={mx1} y={my1 + 3} fill="#38bdf8" fontSize="9" fontWeight="900" textAnchor="middle">{blockLetter}</text>
                                        <circle cx={mx2} cy={my2} r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                                        <text x={mx2} y={my2 + 3} fill="#38bdf8" fontSize="9" fontWeight="900" textAnchor="middle">{sideLetter}</text>
                                        <rect x={midX - 22} y={midY - 7} width="44" height="14" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
                                        <text x={midX} y={midY + 3} fill="#38bdf8" fontSize="7.5" fontWeight="bold" textAnchor="middle">Coupe {blockLetter}-{sideLetter}</text>
                                      </g>
                                    );
                                  });
                                });
                              })()}

                              {/* ==================== RENDERING PARAMETRIC GATES & PORTILLONS ==================== */}
                              {gates.map((g) => {
                                const isSelected = selectedGateId === g.id;
                                const isSmall = g.type === "portillon";
                                const mainOv = ouvrages.find(o => o.id === g.ouvrageId) || ouvrages[0] || { length: 35, width: 21, xOffset: 0, yOffset: 0 };
                                const ovW = mainOv.length * scale;
                                const ovH = mainOv.width * scale;
                                const ovX = cX + (mainOv.xOffset * scale) - (ovW / 2);
                                const ovY = cY + (mainOv.yOffset * scale) - (ovH / 2);

                                const gWidthPx = g.width * scale;
                                let px = ovX;
                                let py = ovY;

                                if (g.wall === "sud") {
                                  px = ovX + Math.min(ovW - gWidthPx, Math.max(0, g.offset * scale));
                                  py = ovY + ovH;
                                } else if (g.wall === "nord") {
                                  px = ovX + Math.min(ovW - gWidthPx, Math.max(0, g.offset * scale));
                                  py = ovY;
                                } else if (g.wall === "ouest") {
                                  px = ovX;
                                  py = ovY + Math.min(ovH - gWidthPx, Math.max(0, g.offset * scale));
                                } else if (g.wall === "est") {
                                  px = ovX + ovW;
                                  py = ovY + Math.min(ovH - gWidthPx, Math.max(0, g.offset * scale));
                                }

                                const isHoriz = g.wall === "sud" || g.wall === "nord";

                                return (
                                  <g
                                    key={g.id}
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedGateId(g.id);
                                    }}
                                  >
                                    {isHoriz ? (
                                      <>
                                        <line x1={px} y1={py} x2={px + gWidthPx} y2={py} stroke="#090d16" strokeWidth="6" />
                                        <line x1={px} y1={py} x2={px + gWidthPx} y2={py} stroke={isSmall ? "#38bdf8" : "#0284c7"} strokeWidth="3" strokeDasharray="3 2" />
                                        <rect x={px - 4} y={py - 6} width="8" height="12" fill={isSmall ? "#38bdf8" : "#0284c7"} stroke="#ffffff" strokeWidth="1" rx="2" />
                                        <rect x={px + gWidthPx - 4} y={py - 6} width="8" height="12" fill={isSmall ? "#38bdf8" : "#0284c7"} stroke="#ffffff" strokeWidth="1" rx="2" />
                                        <path d={`M ${px} ${py} A ${gWidthPx/2} ${gWidthPx/2} 0 0 1 ${px + gWidthPx/2} ${py + 15}`} fill="none" stroke={isSmall ? "#38bdf8" : "#0284c7"} strokeWidth="1.2" strokeDasharray="2 2" />
                                        {!isSmall && (
                                          <path d={`M ${px + gWidthPx} ${py} A ${gWidthPx/2} ${gWidthPx/2} 0 0 0 ${px + gWidthPx/2} ${py + 15}`} fill="none" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="2 2" />
                                        )}
                                        <rect x={px + gWidthPx/2 - 45} y={py + (g.wall === "nord" ? -22 : 18)} width="90" height="16" fill={isSelected ? "#0284c7" : "#0f172a"} stroke={isSelected ? "#38bdf8" : "#334155"} rx="4" />
                                        <text x={px + gWidthPx/2} y={py + (g.wall === "nord" ? -10 : 30)} fill="#38bdf8" fontSize="8" fontWeight="black" textAnchor="middle">
                                          {g.name} ({g.width}m)
                                        </text>
                                      </>
                                    ) : (
                                      <>
                                        <line x1={px} y1={py} x2={px} y2={py + gWidthPx} stroke="#090d16" strokeWidth="6" />
                                        <line x1={px} y1={py} x2={px} y2={py + gWidthPx} stroke={isSmall ? "#38bdf8" : "#0284c7"} strokeWidth="3" strokeDasharray="3 2" />
                                        <rect x={px - 6} y={py - 4} width="12" height="8" fill={isSmall ? "#38bdf8" : "#0284c7"} stroke="#ffffff" strokeWidth="1" rx="2" />
                                        <rect x={px - 6} y={py + gWidthPx - 4} width="12" height="8" fill={isSmall ? "#38bdf8" : "#0284c7"} stroke="#ffffff" strokeWidth="1" rx="2" />
                                        <rect x={px + (g.wall === "ouest" ? -95 : 10)} y={py + gWidthPx/2 - 8} width="85" height="16" fill={isSelected ? "#0284c7" : "#0f172a"} stroke={isSelected ? "#38bdf8" : "#334155"} rx="4" />
                                        <text x={px + (g.wall === "ouest" ? -52.5 : 52.5)} y={py + gWidthPx/2 + 3} fill="#38bdf8" fontSize="8" fontWeight="black" textAnchor="middle">
                                          {g.name} ({g.width}m)
                                        </text>
                                      </>
                                    )}
                                  </g>
                                );
                              })}

                              {/* Gabions are rendered per-ouvrage above, inside the ouvrages.map loop
                                  (see "Gabions Protection Walls around Ouvrage" — ov.hasGabions / ov.gabionSides).
                                  The old global hasGabions/gabionSideConfigs (ouvrage[0]-only) is no longer rendered. */}

                              {/* ==================== 5. RENDERING VECTOR SHAPES LAYER (FIGMA/CAD) ==================== */}
                              {shapes.map((shape) => {
                                const rotation = shape.rotation || 0;
                                const cx = cX + shape.x * scale;
                                const cy = cY + shape.y * scale;
                                const w = shape.width;
                                const h = shape.height;
                                const color = shape.color || "#38bdf8";
                                const strokeWidth = shape.strokeWidth || 2;
                                const isSelected = selectedShapeId === shape.id || selectedShapeIds.includes(shape.id);
                                const strokeDash = shape.strokeStyle === 'dashed' ? "6 4" : shape.strokeStyle === 'dotted' ? "2 3" : "none";

                                const shapeGraphics = renderVectorShapeGraphic(shape, strokeWidth, strokeDash);

                                return (
                                  <g
                                    key={shape.id}
                                    transform={`translate(${cx}, ${cy}) rotate(${rotation}) scale(${scale / 12})`}
                                    className="cursor-pointer transition-transform"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedShapeId(shape.id);
                                      setSelectedShapeIds([shape.id]);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedShapeId(shape.id);
                                      setSelectedShapeIds([shape.id]);
                                      setDraggingShapeId(shape.id);
                                      const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                      if (svgRect) {
                                        setDragStartPos({
                                          pointerX: e.clientX - svgRect.left,
                                          pointerY: e.clientY - svgRect.top,
                                          initX: shape.x,
                                          initY: shape.y
                                        });
                                      }
                                    }}
                                  >
                                    {shapeGraphics}

                                    {/* Bounding Box Selection Highlight + interactive resize/rotate handles */}
                                    {isSelected && (
                                      <g>
                                        <rect x={-w/2 - 4} y={-h/2 - 4} width={w + 8} height={h + 8} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" rx="4" />
                                        <line x1={0} y1={-h/2 - 4} x2={0} y2={-h/2 - 22} stroke="#38bdf8" strokeWidth="1.5" />
                                        <circle
                                          cx={0} cy={-h/2 - 26} r="5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5"
                                          style={{ cursor: "grab" }}
                                          onMouseDown={(e) => startRotate(e, shape.id)}
                                        />
                                        <circle cx={-w/2 - 4} cy={-h/2 - 4} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" style={{ cursor: "nwse-resize" }} onMouseDown={(e) => startResize(e, shape.id, 'tl')} />
                                        <circle cx={w/2 + 4} cy={-h/2 - 4} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" style={{ cursor: "nesw-resize" }} onMouseDown={(e) => startResize(e, shape.id, 'tr')} />
                                        <circle cx={-w/2 - 4} cy={h/2 + 4} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" style={{ cursor: "nesw-resize" }} onMouseDown={(e) => startResize(e, shape.id, 'bl')} />
                                        <circle cx={w/2 + 4} cy={h/2 + 4} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" style={{ cursor: "nwse-resize" }} onMouseDown={(e) => startResize(e, shape.id, 'br')} />
                                      </g>
                                    )}
                                  </g>
                                );
                              })}

                              {/* ==================== 6. AUTOCAD PRINT ZONE RECTANGLE ==================== */}
                              {(printZone.enabled || printZoneMode === "window") && (
                                <g>
                                  <rect
                                    x={printZone.x}
                                    y={printZone.y}
                                    width={printZone.width}
                                    height={printZone.height}
                                    fill="#f59e0b"
                                    fillOpacity="0.08"
                                    stroke="#f59e0b"
                                    strokeWidth="2.5"
                                    strokeDasharray="6 4"
                                    rx="4"
                                  />
                                  <rect x={printZone.x + 8} y={printZone.y + 8} width="160" height="20" fill="#78350f" rx="4" />
                                  <text x={printZone.x + 16} y={printZone.y + 22} fill="#fef3c7" fontSize="10" fontWeight="bold">
                                    🖨️ FENÊTRE D'IMPRESSION CAD
                                  </text>
                                </g>
                              )}

                              {/* Cartouche retirée du plan pour agrandir la zone de dessin — les infos
                                  restent éditables directement dans le Carré Orange, et via le bouton
                                  "Modifier le Cartouche..." de la fenêtre de mise en page d'impression. */}
                            </svg>
                          );
                        })()}
                      </div>
                    </div>

          {/* ========================================================================= */}
          {/* CARRÉ ORANGE (ORANGE BOX): SECTION CARTOUCHE TECHNIQUE (BLOCK 2)           */}
          {/* ========================================================================= */}
          <div className="w-full bg-slate-900 border-2 border-orange-500/80 rounded-3xl p-5 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-orange-500/30 pb-2 mb-2">
              <span className="text-xs font-black uppercase text-orange-400 tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" />
                <span>Carré Orange — Cartouche Technique Normalisé PD&I (Block 2 d'Impression)</span>
              </span>
              <span className="text-[10px] bg-orange-950 text-orange-300 font-mono font-bold px-2.5 py-0.5 rounded border border-orange-800">
                Plan N° {cartoucheInfo.planNumber || "PD&I-GC-001"}
              </span>
            </div>

            {/* Rendered Normalized PD&I Cartouche Title Block */}
            <div className="w-full bg-slate-950 rounded-2xl p-4 border border-slate-800 flex justify-center items-center overflow-x-auto">
              <svg viewBox="0 0 450 205" className="w-full max-w-lg h-auto">
                <g transform="translate(7, 5)">
                                {/* Outer Cartouche Frame */}
                                <rect x="0" y="0" width="435" height="195" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" rx="4" />

                                {/* Header Strip */}
                                <rect x="0" y="0" width="435" height="32" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                                <text x="12" y="20" fill="#38bdf8" fontSize="12" fontWeight="bold" letterSpacing="0.5">
                                  PD&I • PIPELINE DESIGN & ISOMETRICS
                                </text>
                                <text x="420" y="20" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="end">
                                  FORMAT A3
                                </text>

                                {/* Project Name & Location */}
                                <line x1="0" y1="32" x2="435" y2="32" stroke="#334155" strokeWidth="1" />
                                <text x="12" y="48" fill="#94a3b8" fontSize="8" fontWeight="bold" className="uppercase">
                                  PROJET / OUVRAGE:
                                </text>
                                <text x="12" y="62" fill="#ffffff" fontSize="11" fontWeight="bold">
                                  {cartoucheInfo.postName || "POSTE DE DÉTENTE & COMPTAGE GAZ"}
                                </text>

                                <text x="240" y="48" fill="#94a3b8" fontSize="8" fontWeight="bold" className="uppercase">
                                  LOCALISATION:
                                </text>
                                <text x="240" y="62" fill="#e2e8f0" fontSize="10" fontWeight="semibold">
                                  PD&I / PIPELINE DESIGN & ISOMETRICS
                                </text>

                                <line x1="0" y1="72" x2="435" y2="72" stroke="#334155" strokeWidth="1" />

                                {/* Interactive Legend Section (Légende Nouveau vs Ancien) */}
                                <text x="12" y="86" fill="#f59e0b" fontSize="9" fontWeight="bold">
                                  LÉGENDE DES ÉLÉMENTS DU CROQUIS:
                                </text>

                                <g transform="translate(12, 94)">
                                  {/* Item 1: Nouveau */}
                                  <rect x="0" y="0" width="12" height="10" fill="#15803d" stroke="#4ade80" strokeWidth="1" rx="1" />
                                  <text x="16" y="8" fill="#e2e8f0" fontSize="8.5">Extension / Nouveau (Projet)</text>

                                  {/* Item 2: Ancien */}
                                  <rect x="145" y="0" width="12" height="10" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1" rx="1" />
                                  <text x="161" y="8" fill="#e2e8f0" fontSize="8.5">Ouvrage Ancien / Existant</text>

                                  {/* Item 3: Dalle */}
                                  <rect x="0" y="16" width="12" height="10" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" rx="1" />
                                  <text x="16" y="24" fill="#e2e8f0" fontSize="8.5">Dalles Béton Armé</text>

                                  {/* Item 4: Gabion / Voile */}
                                  <rect x="145" y="16" width="12" height="10" fill="#d97706" stroke="#fbbf24" strokeWidth="1" rx="1" />
                                  <text x="161" y="24" fill="#e2e8f0" fontSize="8.5">Gabions & Voiles Béton</text>
                                </g>

                                <line x1="0" y1="130" x2="435" y2="130" stroke="#334155" strokeWidth="1" />

                                {/* Bottom Metadata Grid */}
                                <g transform="translate(12, 144)">
                                  <text x="0" y="0" fill="#64748b" fontSize="8">ÉCHELLE:</text>
                                  <text x="0" y="11" fill="#38bdf8" fontSize="9" fontWeight="bold">{cartoucheInfo.scale || "1 / 100"}</text>

                                  <text x="80" y="0" fill="#64748b" fontSize="8">BLOCS/OUVRAGES:</text>
                                  <text x="80" y="11" fill="#ffffff" fontSize="9" fontWeight="bold">{ouvrages.length} Blocs</text>

                                  <text x="180" y="0" fill="#64748b" fontSize="8">DATE & ÉDITION:</text>
                                  <text x="180" y="11" fill="#ffffff" fontSize="9" fontWeight="bold">{cartoucheInfo.date || "2026"}</text>

                                  <text x="290" y="0" fill="#64748b" fontSize="8">ENTREPRISE / DESSIN:</text>
                                  <text x="290" y="11" fill="#f59e0b" fontSize="9" fontWeight="bold">{cartoucheInfo.editorName || "PD&I"}</text>
                                </g>

                                <rect x="0" y="168" width="435" height="27" fill="#0284c7" fillOpacity="0.2" rx="2" />
                                <text x="217" y="185" fill="#38bdf8" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                                  CROQUIS DE MÉTRAGE TECHNIQUE & IMPLANTATION CAD
                                </text>
                              </g>
                            </svg>
            </div>
{/* Quantitatif Estimatif Section Summary */}
                    {(() => {
                      const totalSlabsArea = slabs.reduce((acc, s) => acc + (s.length * s.width), 0);
                      const totalSlabsVol = slabs.reduce((acc, s) => acc + (s.length * s.width * s.thickness), 0);
                      const totalAbrisArea = abris.reduce((acc, a) => acc + (a.length * a.width), 0);
                      const totalMassifsVol = massifs.reduce((acc, m) => acc + (m.length * m.width * m.height), 0);
                      
                      const globalPosteArea = fenceA * fenceB;
                      const epandageCleanConcreteArea = Math.max(0, globalPosteArea - totalSlabsArea - totalAbrisArea);
                      
                      // Footing Volume: posts count * 0.8 * 0.8 * 1.0m
                      const nx = Math.max(2, Math.ceil(fenceA / 3));
                      const ny = Math.max(2, Math.ceil(fenceB / 3));
                      const postCount = (nx + 1) * 2 + (ny - 1) * 2;
                      const footingsVol = postCount * (0.8 * 0.8 * 1.0);
                      const postsConcreteVol = postType === "beton_arme" ? postCount * (postConcreteWidth * postConcreteDepth * postConcreteHeight) : 0;

                      const totalConcrete = totalSlabsVol + totalMassifsVol + footingsVol + postsConcreteVol;
                      const totalCementBags = Math.ceil(totalConcrete * 7); // 350kg/m3 => 7 bags of 50kg per m3

                      return (
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                              <Calculator className="w-4 h-4 text-emerald-600" />
                              <span>Quantitatif Estimatif du Poste Gaz</span>
                            </span>
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 font-black px-2 py-0.5 rounded border border-emerald-200">
                              Béton CPA 350kg/m³
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <span className="text-[9px] font-bold text-emerald-600 uppercase block">Surface Épandage Propreté :</span>
                              <span className="text-base font-black text-emerald-800 font-mono">{epandageCleanConcreteArea.toFixed(1)} m²</span>
                              <span className="text-[8.5px] text-slate-500 block mt-0.5">Global ({globalPosteArea}m²) - Dalles/Abris ({(totalSlabsArea + totalAbrisArea).toFixed(1)}m²)</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Massifs Béton ({massifs.length}) :</span>
                              <span className="text-base font-black text-purple-700 font-mono">{totalMassifsVol.toFixed(2)} m³</span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">{massifs.length} massif(s) béton armé</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Volume Béton Total :</span>
                              <span className="text-base font-black text-blue-700 font-mono">{totalConcrete.toFixed(2)} m³</span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">Dalles + Massifs + Poteaux + Semelles</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Besoins en Ciment :</span>
                              <span className="text-base font-black text-orange-600 font-mono">{totalCementBags} Sacs</span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">{(totalCementBags * 50 / 1000).toFixed(2)} Tonnes CPA</span>
                            </div>
                          </div>

                          {/* Form Fields for Cartouche Metadata in Carré Orange */}
                          <div className="bg-slate-900 border border-orange-500/40 p-4 rounded-2xl space-y-3 text-white">
                            <div className="flex items-center gap-2 border-b border-orange-500/30 pb-2">
                              <FileText className="w-4 h-4 text-orange-400" />
                              <span className="text-xs font-black uppercase text-orange-400 tracking-wider">
                                Renseignements du Cartouche Technique (Imprimés sur Plan PD&I)
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Nom du Poste / Ouvrage :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.postName}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, postName: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">N° du Plan :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.planNumber}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, planNumber: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Indice de Révision :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.revisionIndex}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, revisionIndex: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Échelle :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.scale}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, scale: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Édité / Établi par :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.editorName}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, editorName: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-amber-300 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Vérifié par :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.verifierName}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, verifierName: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-sky-300 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Approuvé par (PD&I) :</label>
                                <input
                                  type="text"
                                  value={cartoucheInfo.approverName}
                                  onChange={(e) => setCartoucheInfo(prev => ({ ...prev, approverName: e.target.value }))}
                                  className="w-full text-xs font-bold bg-slate-950 text-emerald-300 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Action Button: Direct Print / PDF Export */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                            <span className="text-[11px] text-slate-500 font-medium">
                              💡 L'impression génère le plan officiel combinant le <strong className="text-blue-600">Bloc Bleu (Schéma CAD 2D)</strong> et le <strong className="text-orange-600">Bloc Orange (Métrage & Cartouche)</strong> avec le logo officiel PD&I.
                            </span>
                            <button
                              type="button"
                              onClick={handleDirectPrintCroquis}
                              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Imprimer / Exporter PDF (Plan CAD & Cartouche PD&I)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
          </div>

          {/* ==================== VUES ÉLÉVATION DES GABIONS (DYNAMIQUES) ==================== */}
          {(() => {
            const sideLetterMap: Record<"sud" | "nord" | "est" | "ouest", string> = {
              sud: "A",
              nord: "B",
              est: "C",
              ouest: "D",
            };

            const sections: Array<{
              key: string;
              cutName: string;
              blockLetter: string;
              sideLetter: string;
              ovName: string;
              side: string;
              tiers: Array<{ height: number; depth: number; redanMode?: string; redanValue?: number }>;
              totalH: number;
            }> = [];

            ouvrages.forEach((ov, ovIndex) => {
              if (!ov.hasGabions || !ov.gabionSides) return;
              const blockLetter = String.fromCharCode(65 + (ovIndex % 26));
              const sides: Array<"sud" | "nord" | "est" | "ouest"> = ["sud", "nord", "est", "ouest"];
              sides.forEach((side) => {
                const gConf = ov.gabionSides?.[side];
                if (gConf && gConf.enabled && (gConf.tiers || []).length > 0) {
                  const sideLetter = sideLetterMap[side];
                  const tiers = gConf.tiers || [];
                  const totalH = tiers.reduce((s, t) => s + (t.height || 0), 0);
                  sections.push({
                    key: `${ov.id}-${side}`,
                    cutName: `${blockLetter}-${sideLetter}`,
                    blockLetter,
                    sideLetter,
                    ovName: ov.name || `Ouvrage ${ovIndex + 1}`,
                    side,
                    tiers,
                    totalH,
                  });
                }
              });
            });

            if (sections.length === 0) return null;

            return (
              <div className={`w-full grid gap-3 ${sections.length <= 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
                {sections.map((sec) => (
                  <div key={sec.key} className="w-full bg-slate-900 border-2 border-blue-500/80 rounded-3xl p-5 text-white space-y-3 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
                      <span className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-blue-400" />
                        <span>Coupe {sec.cutName} — Vue Élévation du Mur en Gabions ({sec.ovName} - Côté {sec.side.toUpperCase()})</span>
                      </span>
                      <span className="text-[10px] bg-blue-950 text-blue-300 font-mono font-bold px-2.5 py-0.5 rounded border border-blue-800">
                        {sec.tiers.length} Étage(s) | H≈{sec.totalH.toFixed(2)}m
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-xl p-4 border border-blue-800/60 flex justify-center">
                      <svg viewBox="0 0 500 260" className="w-full max-w-xl h-auto">
                        <line x1="20" y1="230" x2="480" y2="230" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 3" />
                        {(() => {
                          const PX_PER_M = 44;
                          let cumH = 0, cumD = 0;
                          return sec.tiers.map((t, idx) => {
                            const h = (t.height || 0.5) * PX_PER_M;
                            const d = (t.depth || 0.5) * PX_PER_M;
                            if (idx > 0) {
                              const prevDepth = sec.tiers[idx - 1].depth || 1;
                              const redanM = t.redanMode === "pourcentage" ? (prevDepth * (t.redanValue || 0)) / 100 : (t.redanValue || 0);
                              cumD += redanM * PX_PER_M;
                            }
                            const y = 230 - cumH - h;
                            const x = 60 + cumD;
                            cumH += h;
                            return (
                              <g key={idx}>
                                <rect x={x} y={y} width={d} height={h} fill="#0284c7" fillOpacity="0.55" stroke="#38bdf8" strokeWidth="1.8" />
                                <text x={x + d / 2} y={y + h / 2 - 4} fill="#e0f2fe" fontSize="9" fontWeight="bold" textAnchor="middle">Étage {idx + 1}</text>
                                <text x={x + d / 2} y={y + h / 2 + 9} fill="#bae6fd" fontSize="7.5" textAnchor="middle">H={t.height}m P={t.depth}m</text>
                              </g>
                            );
                          });
                        })()}
                        <text x="20" y="20" fill="#38bdf8" fontSize="13" fontWeight="900">{sec.blockLetter}</text>
                        <text x="470" y="20" fill="#38bdf8" fontSize="13" fontWeight="900">{sec.sideLetter}</text>
                        <text x="250" y="250" fill="#64748b" fontSize="9" textAnchor="middle">PROFIL ÉLÉVATION EN REDAN — COUPE {sec.cutName} (H≈{sec.totalH.toFixed(2)}m)</text>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          </div>
        </div>


              {/* Legacy printable reconstruction — kept only as inert fallback markup, no longer the print target */}
             <div className="hidden">
               <div className="bg-white p-3 border-2 border-slate-900 font-mono text-xs leading-relaxed w-full text-slate-800">
                     <div className="border-2 border-slate-900 p-3 bg-white">
                       {/* ========================================================================= */}
                       {/* IMPRESSION LANDSCAPE (PAYSAGE A3/A4): CARTOUCHE A GAUCHE, DESSIN A DROITE */}
                       {/* ========================================================================= */}
                       <div className="flex flex-row gap-3 items-stretch min-h-[580px]">
                         
                         {/* LEFT COLUMN: PD&I HEADER, CARTOUCHE & METRES TABLES (35% WIDTH) */}
                         <div className="w-[340px] shrink-0 flex flex-col justify-between border-r-2 border-slate-900 pr-3 space-y-2">
                           <div className="space-y-2">
                             {/* Official PD&I Engineering Header */}
                             <PdiHeader />

                             <div className="text-center border border-slate-900 bg-slate-50 py-1.5 px-2">
                               <h2 className="text-[10px] font-black tracking-widest uppercase text-slate-900">
                                 PLAN D'IMPLANTATION & CARTOUCHE TECHNIQUE
                               </h2>
                               <p className="text-[8px] text-slate-600 uppercase mt-0.5">
                                 {conceptionMode === "neuf" ? "Ouvrage Neuf d'Origine" : "Extension sur Ouvrage Existant"} • Plan N° {cartoucheInfo.planNumber || "PD&I-GC-001"}
                               </p>
                             </div>

                             {/* Cartouche Table */}
                             <table className="cartouche">
                               <tbody>
                                 <tr>
                                   <td className="w-1/2">
                                     <span className="label">Ouvrage :</span><br />
                                     <span className="value">{cartoucheInfo.postName}</span>
                                   </td>
                                   <td className="w-1/2">
                                     <span className="label">N° Plan & Rév :</span><br />
                                     <span className="value">{cartoucheInfo.planNumber} | {cartoucheInfo.revisionIndex}</span>
                                   </td>
                                 </tr>
                                 <tr>
                                   <td>
                                     <span className="label">Échelle & Date :</span><br />
                                     <span className="value">{cartoucheInfo.scale} | {cartoucheInfo.date}</span>
                                   </td>
                                   <td>
                                     <span className="label">Projet :</span><br />
                                     <span className="value">{conceptionMode === "neuf" ? "Neuf 100%" : "Extension"}</span>
                                   </td>
                                 </tr>
                                 <tr>
                                   <td>
                                     <span className="label">Dessiné par :</span><br />
                                     <span className="value text-[#007ac3] font-extrabold">{cartoucheInfo.editorName}</span>
                                   </td>
                                   <td>
                                     <span className="label">Vérifié par :</span><br />
                                     <span className="value text-[#007ac3] font-extrabold">{cartoucheInfo.verifierName}</span>
                                   </td>
                                 </tr>
                                 <tr>
                                   <td colSpan={2}>
                                     <span className="label">Approuvé par (Direction) :</span><br />
                                     <span className="value text-[#007ac3] font-extrabold">{cartoucheInfo.approverName}</span>
                                   </td>
                                 </tr>
                               </tbody>
                             </table>

                             {/* Summary Métrés Table */}
                             {(() => {
                               const totalSlabsConcrete = slabs.reduce((acc, s) => acc + (s.length * s.width * s.thickness), 0);
                               const teleShelterConcrete = teleShelterLength * teleShelterWidth * 0.20;
                               const nx = Math.max(2, Math.ceil(fenceA / 3));
                               const ny = Math.max(2, Math.ceil(fenceB / 3));
                               const postsCount = (nx + 1) * 2 + (ny - 1) * 2;
                               const footingsConcrete = postsCount * (0.80 * 0.80 * 0.80);
                               const totalConcrete = totalSlabsConcrete + teleShelterConcrete + footingsConcrete;

                               return (
                                 <div className="space-y-1">
                                   <span className="text-[8.5px] font-black uppercase text-slate-900 block border-b border-slate-900 pb-0.5">
                                     RÉSUMÉ SYNTÉTIQUE DES MÉTRÉS GC :
                                   </span>
                                   <table className="quantitatif-grid">
                                     <thead>
                                       <tr>
                                         <th>Désignation</th>
                                         <th style={{ textAlign: 'right' }}>Quantité</th>
                                       </tr>
                                     </thead>
                                     <tbody>
                                       <tr>
                                         <td>Blocs / Ouvrages GC</td>
                                         <td style={{ textAlign: 'right' }}><strong>{ouvrages.length} U</strong></td>
                                       </tr>
                                       <tr>
                                         <td>Dalles Béton Armé</td>
                                         <td style={{ textAlign: 'right' }}><strong>{slabs.length} U ({slabs.reduce((acc, s) => acc + s.length * s.width, 0).toFixed(1)} m²)</strong></td>
                                       </tr>
                                       <tr>
                                         <td>Volume Béton Total</td>
                                         <td style={{ textAlign: 'right' }}><strong>{totalConcrete.toFixed(2)} m³</strong></td>
                                       </tr>
                                       <tr>
                                         <td>Portails & Portillons</td>
                                         <td style={{ textAlign: 'right' }}><strong>{gates.length} U</strong></td>
                                       </tr>
                                       <tr>
                                         <td>Clôture Périmétrique</td>
                                         <td style={{ textAlign: 'right' }}><strong>{(fenceA * 2 + fenceB * 2).toFixed(1)} ml</strong></td>
                                       </tr>
                                     </tbody>
                                   </table>
                                 </div>
                               );
                             })()}

                             {/* Notes techniques */}
                             <div className="border border-slate-900 p-2 bg-slate-50 text-[7.5px] font-mono leading-tight space-y-1">
                               <p className="font-bold border-b border-slate-900 pb-0.5 text-slate-800">NOTES TECHNIQUES RÉGLEMENTAIRES :</p>
                               <p>1. Clôture H={fenceHeight}m avec fil barbelé et fer H.</p>
                               <p>2. Béton armé dosé à 350 kg/m³ CPA sur gravier compacté.</p>
                               <p>3. En cas d'extension, scellement par goujons résine époxy homologuée.</p>
                             </div>
                           </div>

                           {/* Visas & Signatures */}
                           <div className="border-t-2 border-slate-900 pt-1.5 grid grid-cols-2 gap-2 text-[7px] text-center">
                             <div className="border border-slate-900 p-1 h-12 flex flex-col justify-between">
                               <span className="font-bold uppercase text-slate-700">VISA INGÉNIEUR GC</span>
                               <span className="text-[6px] text-slate-400">Signature / Date</span>
                             </div>
                             <div className="border border-slate-900 p-1 h-12 flex flex-col justify-between">
                               <span className="font-bold uppercase text-slate-700">VISA CHEF DE PROJET</span>
                               <span className="text-[6px] text-slate-400">Signature / Cachet</span>
                             </div>
                           </div>
                         </div>

                         {/* RIGHT COLUMN: TECHNICAL DRAWING BLUEPRINT SVG (65% WIDTH) */}
                         <div className="flex-1 flex flex-col justify-between bg-white border border-slate-900 p-2 overflow-hidden">
                           <div className="text-center border-b border-slate-900 pb-1 mb-1">
                             <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-900">
                               SCHÉMA TECHNIQUE CAD 2D — VUE EN PLAN D'IMPLANTATION
                             </span>
                           </div>

                           {/* Schematic drawing print copy */}
                           <div className="flex-1 flex justify-center items-center p-1 bg-white">
                          <div className="w-full max-w-[550px] flex flex-col items-center justify-center border border-slate-900 overflow-hidden bg-white p-2">
                          <div className="w-full max-w-[550px] flex flex-col items-center justify-center border border-slate-900 overflow-hidden bg-white p-2">
                            <svg viewBox={printZone.enabled ? `${printZone.x} ${printZone.y} ${printZone.width} ${printZone.height}` : "0 0 750 480"} className="w-full h-auto max-h-[380px] bg-white">
                              <rect width="750" height="480" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
                              
                              {/* Vector Shapes Print Rendering */}
                              {shapes.map((shape) => {
                                const rotation = shape.rotation || 0;
                                const cx = shape.x;
                                const cy = shape.y;
                                const w = shape.width;
                                const h = shape.height;
                                const color = shape.color || "#000000";
                                const strokeWidth = shape.strokeWidth || 2;
                                const strokeDash = shape.strokeStyle === 'dashed' ? "6 4" : shape.strokeStyle === 'dotted' ? "2 3" : "none";

                                let shapeGraphics = null;
                                if (shape.type === 'square') {
                                  shapeGraphics = <rect x={-w/2} y={-h/2} width={w} height={h} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'rounded-rect') {
                                  shapeGraphics = <rect x={-w/2} y={-h/2} width={w} height={h} rx={8} ry={8} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'circle') {
                                  shapeGraphics = <ellipse cx={0} cy={0} rx={w/2} ry={h/2} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'triangle') {
                                  shapeGraphics = <polygon points={`0,${-h/2} ${w/2},${h/2} ${-w/2},${h/2}`} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'right-triangle') {
                                  shapeGraphics = <polygon points={`${-w/2},${-h/2} ${w/2},${h/2} ${-w/2},${h/2}`} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'diamond') {
                                  shapeGraphics = <polygon points={`0,${-h/2} ${w/2},0 0,${h/2} ${-w/2},0`} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'star') {
                                  shapeGraphics = <polygon points={`0,${-h/2} ${w*0.2},${-h*0.1} ${w/2},0 ${w*0.2},${h*0.1} 0,${h/2} ${-w*0.2},${h*0.1} ${-w/2},0 ${-w*0.2},${-h*0.1}`} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'hexagon') {
                                  shapeGraphics = <polygon points={`0,${-h/2} ${w/2},${-h/4} ${w/2},${h/4} 0,${h/2} ${-w/2},${h/4} ${-w/2},${-h/4}`} fill={shape.fillColor || (color + "11")} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'line') {
                                  shapeGraphics = <line x1={-w/2} y1={0} x2={w/2} y2={0} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'arrow') {
                                  shapeGraphics = (
                                    <g>
                                      <line x1={-w/2} y1={0} x2={w/2 - 8} y2={0} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />
                                      <polygon points={`${w/2},0 ${w/2 - 10},-5 ${w/2 - 10},5`} fill={color} />
                                    </g>
                                  );
                                } else if (shape.type === 'double-arrow') {
                                  shapeGraphics = (
                                    <g>
                                      <line x1={-w/2 + 8} y1={0} x2={w/2 - 8} y2={0} stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />
                                      <polygon points={`${w/2},0 ${w/2 - 10},-5 ${w/2 - 10},5`} fill={color} />
                                      <polygon points={`${-w/2},0 ${-w/2 + 10},-5 ${-w/2 + 10},5`} fill={color} />
                                    </g>
                                  );
                                } else if (shape.type === 'elbow-line') {
                                  shapeGraphics = <polyline points={`${-w/2},${-h/2} 0,${-h/2} 0,${h/2} ${w/2},${h/2}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'curved-line') {
                                  shapeGraphics = <path d={`M ${-w/2} 0 Q 0 ${-h} ${w/2} 0`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />;
                                } else if (shape.type === 'cotation') {
                                  shapeGraphics = (
                                    <g>
                                      <line x1={-w/2 + 8} y1={0} x2={w/2 - 8} y2={0} stroke={color} strokeWidth={strokeWidth} />
                                      <polygon points={`${w/2},0 ${w/2 - 8},-4 ${w/2 - 8},4`} fill={color} />
                                      <polygon points={`${-w/2},0 ${-w/2 + 8},-4 ${-w/2 + 8},4`} fill={color} />
                                      <text x="0" y="-6" fill={color} fontSize={shape.fontSize || 10} fontWeight="bold" textAnchor="middle">{shape.text || "CÔTE"}</text>
                                    </g>
                                  );
                                } else if (shape.type === 'vanne' || shape.type === 'vanne-motorisee') {
                                  shapeGraphics = (
                                    <g>
                                      <polygon points={`${-w/2},${-h/2} 0,0 ${-w/2},${h/2}`} fill={color} stroke={color} />
                                      <polygon points={`${w/2},${-h/2} 0,0 ${w/2},${h/2}`} fill={color} stroke={color} />
                                      <circle cx="0" cy="0" r="3" fill="#ffffff" />
                                      {shape.type === 'vanne-motorisee' && <rect x="-4" y={-h/2 - 8} width="8" height="8" fill="#eab308" stroke={color} strokeWidth="1" />}
                                    </g>
                                  );
                                } else if (shape.type === 'clapet') {
                                  shapeGraphics = (
                                    <g>
                                      <circle cx="0" cy="0" r={w/2} fill="none" stroke={color} strokeWidth={strokeWidth} />
                                      <polygon points={`0,${-h/3} ${w/3},${h/3} ${-w/3},${h/3}`} fill={color} />
                                    </g>
                                  );
                                } else if (shape.type === 'text') {
                                  shapeGraphics = (
                                    <text x="0" y="4" fill={color} fontSize={shape.fontSize || 12} fontWeight="bold" textAnchor="middle">
                                      {shape.text || "TEXTE"}
                                    </text>
                                  );
                                } else if (shape.type === 'callout-rect') {
                                  shapeGraphics = (
                                    <g>
                                      <rect x={-w/2} y={-h/2} width={w} height={h} rx={6} fill="#ffffff" stroke={color} strokeWidth={strokeWidth} />
                                      <text x="0" y="4" fill={color} fontSize={shape.fontSize || 10} fontWeight="bold" textAnchor="middle">
                                        {shape.text || "LÉGENDE"}
                                      </text>
                                    </g>
                                  );
                                } else {
                                  shapeGraphics = (
                                    <g>
                                      <rect x={-w/2} y={-h/2} width={w} height={h} rx={4} fill={color + "11"} stroke={color} strokeWidth={strokeWidth} />
                                      {shape.text && <text x="0" y="4" fill={color} fontSize={shape.fontSize || 10} fontWeight="bold" textAnchor="middle">{shape.text}</text>}
                                    </g>
                                  );
                                }

                                return (
                                  <g key={`print-shape-${shape.id}`} transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
                                    {shapeGraphics}
                                  </g>
                                );
                              })}

                              {/* Freehand Strokes Overlay Image */}
                              {freehandCanvasDataUrl && (
                                <image href={freehandCanvasDataUrl} x="0" y="0" width="750" height="480" />
                              )}
                            </svg>
                          </div>
                        ) : (
                          <svg viewBox="0 0 550 320" className="w-full max-w-[500px] h-auto">
                            <rect width="550" height="320" fill="none" stroke="#000" strokeWidth="1" />
                            
                            {(() => {
                              const maxDim = Math.max(fenceA, fenceB);
                              const scale = Math.min(8, Math.max(4, 280 / maxDim));
                              const fW = fenceA * scale;
                              const fH = fenceB * scale;
                              const fX = 275 - fW / 2;
                              const fY = 160 - fH / 2;

                              // Posts count
                              const nx = Math.max(2, Math.ceil(fenceA / 3));
                              const ny = Math.max(2, Math.ceil(fenceB / 3));
                              const stepX = fW / nx;
                              const stepY = fH / ny;

                              const fencePosts: { x: number; y: number }[] = [];
                              for (let i = 0; i <= nx; i++) {
                                fencePosts.push({ x: fX + i * stepX, y: fY });
                                fencePosts.push({ x: fX + i * stepX, y: fY + fH });
                              }
                              for (let j = 1; j < ny; j++) {
                                fencePosts.push({ x: fX, y: fY + j * stepY });
                                fencePosts.push({ x: fX + fW, y: fY + j * stepY });
                              }

                              // Tele shelter
                              const tW = teleShelterLength * scale;
                              const tH = teleShelterWidth * scale;
                              const tX = fX + 2 * scale;
                              const tY = fY + fH - tH - 2 * scale;

                              return (
                                <g stroke="#000" strokeWidth="1" fill="none">
                                  {/* Fence Panels */}
                                  <rect x={fX} y={fY} width={fW} height={fH} strokeWidth="1.5" strokeDasharray="5 2" />
                                  <text x="275" y={fY + 14} fill="#000" className="font-mono text-[7px] font-bold" textAnchor="middle">
                                    CLÔTURE PANNEAUX PROFILÉS H={fenceHeight}m ({fenceA}m x {fenceB}m) + FIL BARBELÉ
                                  </text>

                                  {/* Fer H Posts & 80x80 Footings */}
                                  {fencePosts.map((post, idx) => (
                                    <g key={idx}>
                                      <rect x={post.x - 0.4 * scale} y={post.y - 0.4 * scale} width={0.8 * scale} height={0.8 * scale} fill="#e2e8f0" stroke="#000" strokeWidth="0.5" />
                                      <rect x={post.x - 1.5} y={post.y - 1.5} width="3" height="3" fill="#000" />
                                    </g>
                                  ))}

                                  {/* Dynamic Abris Render in Printable Cartouche Sketch */}
                                  {abris.map((abri) => {
                                    const aW = abri.length * scale;
                                    const aH = abri.width * scale;
                                    const aX = fX + abri.xOffset * scale;
                                    const aY = fY + abri.yOffset * scale;
                                    const isExt = conceptionMode === "extension" && abri.isExtension;

                                    return (
                                      <g key={`print-${abri.id}`}>
                                        <rect
                                          x={aX}
                                          y={aY}
                                          width={aW}
                                          height={aH}
                                          fill={isExt ? "#ea580c" : "#10b981"}
                                          fillOpacity={isExt ? "0.35" : "0.5"}
                                          stroke={isExt ? "#ea580c" : "#059669"}
                                          strokeWidth="1.5"
                                          strokeDasharray={isExt ? "3 2" : "none"}
                                        />
                                        <text x={aX + aW / 2} y={aY + aH / 2} fill="#ffffff" className="font-mono text-[6px] font-bold" textAnchor="middle">
                                          {isExt ? `[EXT] ${abri.name}` : abri.name} ({abri.length}m x {abri.width}m)
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Dynamic Slabs */}
                                  {slabs.map((slab) => {
                                    const sW = slab.length * scale;
                                    const sH = slab.width * scale;
                                    const sX = fX + slab.xOffset * scale;
                                    const sY = fY + slab.yOffset * scale;
                                    const isExt = conceptionMode === "extension" && slab.isExtension;

                                    return (
                                      <g key={slab.id}>
                                        <rect x={sX} y={sY} width={sW} height={sH} strokeWidth={isExt ? "1.8" : "1"} strokeDasharray={isExt ? "2 2" : "none"} fill="#f1f5f9" />
                                        <text x={sX + sW / 2} y={sY + sH / 2 + 2} fill="#000" className="font-mono text-[5.5px] font-bold" textAnchor="middle">
                                          {isExt ? `[EXT] ${slab.name}` : slab.name} ({slab.length}x{slab.width}m)
                                        </text>
                                      </g>
                                    );
                                  })}
                                </g>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>

                     </div>
                   </div>
                 </div>
               </div>
          </div>
        </div>
        )}

        {activeTab === "bordereau" && (
          <div className="space-y-6 animate-fade-in text-left">
            {loadingProjects ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-orange-600 animate-spin" />
                <p className="text-sm text-slate-500 font-bold">Chargement des ouvrages PD&I...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-150 p-8 text-center text-slate-500 font-medium">
                Aucun ouvrage/projet enregistré pour générer un bordereau. Veuillez en créer un dans l'espace Suivi des Projets.
              </div>
            ) : (() => {
              const activeProject = projects.find(p => p.id === bordereauSelectedProjectId) || projects[0];

              const currentItems = 
                bordereauActivePart === "01" ? etudeItems : 
                bordereauActivePart === "02" ? expertItems : 
                travauxItems;

              const totalHT = currentItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
              const tva = totalHT * 0.19;
              const totalTTC = totalHT + tva;

              const formatDALocal = (val: number) => {
                return new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) + " DA";
              };

              const handlePriceChange = (itemId: string, newPrice: number) => {
                if (bordereauActivePart === "01") {
                  setBePrices(prev => ({ ...prev, [itemId]: newPrice }));
                } else if (bordereauActivePart === "02") {
                  setGefPrices(prev => ({ ...prev, [itemId]: newPrice }));
                } else {
                  setTravauxPrices(prev => ({ ...prev, [itemId]: newPrice }));
                }
              };

              const resetPrices = () => {
                if (bordereauActivePart === "01") {
                  setBePrices({
                    impact: 1500000,
                    topo: 45000,
                    ing: 3000000,
                    dup: 800000,
                    geo: 120000
                  });
                } else if (bordereauActivePart === "02") {
                  setGefPrices({
                    enq: 150000,
                    exp: 80000,
                    assist: 250000,
                    cnd: 4500,
                    audit: 65000
                  });
                } else {
                  setTravauxPrices({
                    piste: 12000,
                    lit: 4000,
                    soudage: 18000,
                    enrobage: 85000,
                    gr_dep: 4500000,
                    gr_arr: 4500000,
                    poste_coup: 3500000,
                    poste_det: 15000000,
                    raccord: 2500000,
                    protection: 3500000,
                    epreuve: 150000
                  });
                }
              };

              return (
                <div className="space-y-6">
                  {/* Selector Header */}
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider font-mono">Module Évaluation Financière</span>
                      <h3 className="font-extrabold text-lg text-slate-800">Bordereau des Prix Unitaire & Quantitatif (BPU)</h3>
                      <p className="text-xs text-slate-500 font-medium">Générez l'estimation financière d'un ouvrage gaz à partir des abaques PD&I.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 shrink-0">Ouvrage :</span>
                      <select
                        value={bordereauSelectedProjectId}
                        onChange={(e) => setBordereauSelectedProjectId(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 text-xs font-black rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer min-w-[200px]"
                      >
                        <option value="all">Choisir un ouvrage...</option>
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name} ({proj.identity?.wilaya || "N/A"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {activeProject ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-xs">
                      {/* Sub-Header bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider font-mono">Estimation Budgétaire Automatique</span>
                          <h4 className="font-extrabold text-base text-slate-800">Détails d'estimation de l'ouvrage : {activeProject.name}</h4>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={resetPrices}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-[11px] font-bold text-slate-600 cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Réinitialiser les prix
                          </button>
                          <button
                            onClick={() => {
                              setBordereauSelectedProjectId(activeProject.id);
                              setShowPrintBordereauModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Imprimer le Bordereau
                          </button>
                        </div>
                      </div>

                      {/* Technical specifications info row */}
                      <div className="bg-slate-900 text-slate-200 p-4.5 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-left">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Dimensions principales</span>
                          <div className="flex gap-4">
                            <div>
                              <span className="text-slate-400">Longueur :</span> <span className="font-mono font-black text-white">{longNum} km</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Diamètre :</span> <span className="font-mono font-black text-white">{diamNum}" (DN)</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Éléments de structure actifs détectés</span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeProject.identity?.caracteristiques?.hasGareRacleurDepart && (
                              <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-orange-400">🚀 Gare Racleur Départ</span>
                            )}
                            {activeProject.identity?.caracteristiques?.hasGareRacleurArrivee && (
                              <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-orange-400">🏁 Gare Racleur Arrivée</span>
                            )}
                            {activeProject.identity?.caracteristiques?.hasPosteDetente && (
                              <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-emerald-400">🔥 Poste Détente</span>
                            )}
                            {activeProject.identity?.caracteristiques?.hasPosteCoupure && (
                              <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-yellow-400">🔌 Poste Coupure</span>
                            )}
                            {activeProject.identity?.caracteristiques?.hasPosteSectionnement && (
                              <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-yellow-400">🛡️ Poste Sectionnement</span>
                            )}
                            {activeProject.identity?.caracteristiques?.pointRaccordement && (
                              <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-purple-400">🔌 Raccordement</span>
                            )}
                            {!activeProject.identity?.caracteristiques?.hasGareRacleurDepart && 
                             !activeProject.identity?.caracteristiques?.hasGareRacleurArrivee && 
                             !activeProject.identity?.caracteristiques?.hasPosteDetente && 
                             !activeProject.identity?.caracteristiques?.hasPosteCoupure && 
                             !activeProject.identity?.caracteristiques?.hasPosteSectionnement && 
                             !activeProject.identity?.caracteristiques?.pointRaccordement && (
                              <span className="text-slate-500 italic text-[11px]">Aucun poste ou équipement configuré dans l'identité technique de cet ouvrage.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Part switcher */}
                      <div className="flex border-b border-slate-100 gap-1 overflow-x-auto pb-px">
                        <button
                          onClick={() => setBordereauActivePart("01")}
                          className={`px-4 py-2 text-xs font-black shrink-0 transition-all border-b-2 ${
                            bordereauActivePart === "01"
                              ? "border-orange-600 text-orange-600 font-extrabold"
                              : "border-transparent text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Partie 01 : Bureau d'Études (BE)
                        </button>
                        <button
                          onClick={() => setBordereauActivePart("02")}
                          className={`px-4 py-2 text-xs font-black shrink-0 transition-all border-b-2 ${
                            bordereauActivePart === "02"
                              ? "border-orange-600 text-orange-600 font-extrabold"
                              : "border-transparent text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Partie 02 : Expertise & CND
                        </button>
                        <button
                          onClick={() => setBordereauActivePart("03")}
                          className={`px-4 py-2 text-xs font-black shrink-0 transition-all border-b-2 ${
                            bordereauActivePart === "03"
                              ? "border-orange-600 text-orange-600 font-extrabold"
                              : "border-transparent text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Partie 03 : Travaux de Réalisation
                        </button>
                      </div>

                      {/* Items table */}
                      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black">
                              <th className="py-3 px-4 w-12 text-center">Code</th>
                              <th className="py-3 px-4">Prestations de l'Abaque PD&I</th>
                              <th className="py-3 px-3 w-16 text-center">Unité</th>
                              <th className="py-3 px-3 w-20 text-center">Quantité</th>
                              <th className="py-3 px-4 w-36 text-right">P.U Estimé (DA)</th>
                              <th className="py-3 px-4 w-36 text-right font-black">Montant HT (DA)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-750 font-medium">
                            {currentItems.map((item) => {
                              const cost = item.qty * item.price;
                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">{item.code}</td>
                                  <td className="py-3 px-4 font-bold text-slate-800">
                                    {item.designation}
                                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5 font-medium">↳ Formule : {item.formula}</span>
                                  </td>
                                  <td className="py-3 px-3 text-center"><span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">{item.unit}</span></td>
                                  <td className="py-3 px-3 text-center font-mono font-black">{item.qty}</td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                                        className="bg-slate-50 border border-slate-250 rounded-lg px-2 py-1 w-24 text-right font-mono font-bold text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
                                      />
                                      <span className="text-[10px] font-bold text-slate-400">DA</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-black text-slate-900">{formatDALocal(cost)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-100 font-black text-slate-900">
                              <td colSpan={5} className="py-3 px-4 text-right text-xs uppercase">TOTAL ESTIMÉ HT :</td>
                              <td className="py-3 px-4 text-right font-mono text-sm">{formatDALocal(totalHT)}</td>
                            </tr>
                            <tr className="bg-slate-50 font-black text-slate-900 border-t border-slate-100/50">
                              <td colSpan={5} className="py-3 px-4 text-right text-xs uppercase">TVA RÉGLEMENTAIRE (19%) :</td>
                              <td className="py-3 px-4 text-right font-mono text-sm">{formatDALocal(tva)}</td>
                            </tr>
                            <tr className="bg-orange-50 font-black text-orange-950 border-t border-orange-100 text-sm">
                              <td colSpan={5} className="py-3.5 px-4 text-right uppercase">MONTANT TOTAL ESTIMÉ TTC :</td>
                              <td className="py-3.5 px-4 text-right font-mono text-orange-700 text-base">{formatDALocal(totalTTC)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 font-medium">
                      Veuillez sélectionner un ouvrage dans la liste ci-dessus pour afficher le chiffrage.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      {/* BPU Print Modal */}
      {showPrintBordereauModal && (() => {
        const activeProject = projects.find(p => p.id === bordereauSelectedProjectId) || projects[0];
        if (!activeProject) return null;

        const currentItems = 
          bordereauActivePart === "01" ? etudeItems : 
          bordereauActivePart === "02" ? expertItems : 
          travauxItems;

        const totalHT = currentItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        const tva = totalHT * 0.19;
        const totalTTC = totalHT + tva;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto text-left">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-8 flex flex-col justify-between space-y-6">
              {/* Print area */}
              <div id="printable-bordereau" className="space-y-6 text-left text-slate-800 p-6 border border-slate-100 rounded-2xl bg-white shadow-xs">
                {/* PD&I header */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                  <div className="space-y-1">
                    <p className="font-extrabold text-[10px] uppercase tracking-wider text-slate-900">PD&I — Piping Design & Isometrics</p>
                    <p className="font-black text-xs text-orange-500 uppercase tracking-widest">PD&I</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Engineering & EPC Projects Division</p>
                    <p className="text-[9px] font-medium text-slate-400">Bill of Quantities (BoQ) & Price Schedule</p>
                  </div>
                  <div className="text-right text-[9px] font-mono text-slate-400 space-y-0.5">
                    <p>Réf: PDI/ENG/{new Date().getFullYear()}/BOQ</p>
                    <p>Date: {new Date().toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>

                {/* Document title */}
                <div className="text-center py-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-y border-slate-300 py-2">
                    Bordereau Estimatif et Quantitatif (B.E.Q)
                  </h3>
                  <p className="text-[10px] font-bold uppercase text-orange-600 mt-1">
                    {bordereauActivePart === "01" ? "Partie 01 : Bureau d'Études (BE)" :
                     bordereauActivePart === "02" ? "Partie 02 : Expertise & Contrôle Technique (GEF / CND)" :
                     "Partie 03 : Travaux de Réalisation (Génie Civil & Montage)"}
                  </p>
                </div>

                {/* Project Info Panel */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4 text-[11px]">
                  <div>
                    <p className="font-bold text-slate-500">Ouvrage : <span className="font-black text-slate-800">{activeProject.name}</span></p>
                    <p className="font-bold text-slate-500">Localisation : <span className="font-black text-slate-800">{activeProject.identity?.wilaya || "N/A"} (Pôle {activeProject.identity?.pole || "N/A"})</span></p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-500">Caractéristiques : <span className="font-black text-slate-800">DN {diamNum}" • Longueur {longNum} km</span></p>
                    <p className="font-bold text-slate-500">Cadre d'inscription : <span className="font-black text-slate-800">{activeProject.identity?.cadreInscription || "N/A"}</span></p>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-extrabold text-slate-700">
                      <th className="py-2 px-2.5 border-r border-slate-300 w-10 text-center">Item</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Désignation des prestations</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-10 text-center">Unité</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-16 text-center">Qté</th>
                      <th className="py-2 px-2.5 border-r border-slate-300 w-24 text-right">P.U (DA)</th>
                      <th className="py-2 px-2.5 text-right w-28 font-black">Montant HT (DA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {currentItems.map((item) => {
                      const cost = item.qty * item.price;
                      return (
                        <tr key={item.id}>
                          <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono text-slate-500">{item.code}</td>
                          <td className="py-2 px-2.5 border-r border-slate-300 font-bold">{item.designation}</td>
                          <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-slate-500">{item.unit}</td>
                          <td className="py-2 px-2 border-r border-slate-300 text-center font-mono font-bold">{item.qty}</td>
                          <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">
                            {new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0 }).format(item.price)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-black">
                            {new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0 }).format(cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-300 font-black text-slate-900 text-[11px]">
                      <td colSpan={5} className="py-2 px-2.5 border-r border-slate-300 text-right uppercase">TOTAL GENERAL HT :</td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0 }).format(totalHT)} DA
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-black text-slate-900 text-[11px]">
                      <td colSpan={5} className="py-2 px-2.5 border-r border-slate-300 text-right uppercase">TVA REGLEMENTAIRE (19%) :</td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0 }).format(tva)} DA
                      </td>
                    </tr>
                    <tr className="bg-orange-50 font-black text-orange-950 text-[11px] border-t border-orange-400">
                      <td colSpan={5} className="py-2 px-2.5 border-r border-slate-300 text-right uppercase">MONTANT TOTAL ESTIMÉ TTC :</td>
                      <td className="py-2 px-2.5 text-right font-mono text-orange-700 font-black text-xs">
                        {new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0 }).format(totalTTC)} DA
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures block */}
                <div className="grid grid-cols-2 gap-8 pt-6 text-[11px]">
                  <div className="border border-slate-200 p-4 rounded-xl text-center space-y-12 bg-slate-50/50">
                    <p className="font-extrabold text-slate-600">Le Partenaire Contractant / L'Entreprise</p>
                    <p className="text-[9px] text-slate-400 italic">(Nom, Cachet et Signature précédés de la mention "Lu et approuvé")</p>
                  </div>
                  <div className="border border-slate-200 p-4 rounded-xl text-center space-y-12 bg-slate-50/50">
                    <p className="font-extrabold text-slate-600">Pour PD&I / Engineering &amp; Projects Division</p>
                    <p className="text-[9px] text-slate-400 italic">(Visa pour validation technique réglementaire)</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowPrintBordereauModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors text-xs"
                >
                  Fermer la prévisualisation
                </button>
                <button
                  onClick={() => {
                    const printContents = document.getElementById("printable-bordereau")?.innerHTML;
                    if (printContents) {
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(`
                          <html>
                            <head>
                              <title>PD&I BPU - ${activeProject.name}</title>
                              <style>${pdiFeuilleImpression017L()}
${PDI_STYLE_IMPRESSION_017L}</style>
                              <style>
                                body { padding: 40px; font-family: system-ui, sans-serif; background-color: #fff; color: #1e293b; }
                                table { border-collapse: collapse; width: 100%; margin-top: 15px; margin-bottom: 15px; }
                                th, td { border: 1px solid #94a3b8; padding: 8px; text-align: left; font-size: 10px; }
                                th { background-color: #f1f5f9; font-weight: bold; }
                                .text-right { text-align: right; }
                                .text-center { text-align: center; }
                                .font-black { font-weight: 900; }
                                .font-bold { font-weight: 700; }
                                .font-mono { font-family: monospace; }
                              </style>
                            </head>
                            <body>
                              ${printContents}
                              <script>window.onload = function() { window.print(); window.close(); }</script>
                            </body>
                          </html>
                        `);
                        win.document.close();
                      } else {
                        window.print();
                      }
                    }
                  }}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold cursor-pointer transition-all active:scale-95 flex items-center gap-2 shadow-md text-xs"
                >
                  <FileText className="w-4 h-4" />
                  Lancer l'impression officielle
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* AUTO-CAD MODAL OVERLAY FOR STANDALONE PARAMETER ENTRY     */}
      {/* ========================================================= */}
      {activeCadModal !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal CAD Header */}
            <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <span>Fenêtre de Saisie CAD - </span>
                    <span className="text-cyan-400">
                      {activeCadModal === "perimeter" && "Périmètre & Clôture du Poste"}
                      {activeCadModal === "shelters" && "Abri de Télé-exploitation"}
                      {activeCadModal === "ouvrages" && "Gestion des Ouvrages & Blocs (Multi-Postes / Extensions)"}
                      {activeCadModal === "voile" && "Voile Béton Armé Périmétrique"}
                      {activeCadModal === "gabions" && "Protection Périmétrique par Gabions"}
                      {activeCadModal === "slabs" && "Dalles & Socles Béton Armé"}
                      {activeCadModal === "gates" && "Portails & Accès Périmétriques"}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">Ajustez les consistances et paramètres techniques en temps réel</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCadModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with Scrollable Area */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
              {/* 1. GABIONS CAD MODAL (par ouvrage / bloc cible) */}
              {activeCadModal === "gabions" && (() => {
                const defaultGabionSide = { enabled: false, length: 10, offset: 0, tiers: [{ height: 1, depth: 1, redanMode: "fixe" as const, redanValue: 0.3 }] };
                const targetOuvrage = ouvrages.find(o => o.id === activeGabionOuvrageId) || ouvrages[0];
                const sides = targetOuvrage?.gabionSides || {
                  nord: defaultGabionSide, sud: defaultGabionSide, est: defaultGabionSide, ouest: defaultGabionSide
                };

                return (
                <div className="space-y-5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase block">Ouvrage / Bloc Cible :</label>
                    <select
                      value={targetOuvrage?.id || ""}
                      onChange={(e) => setActiveGabionOuvrageId(e.target.value)}
                      className="w-full font-bold text-sm bg-white border border-slate-300 rounded-xl px-3 py-2"
                    >
                      {ouvrages.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!targetOuvrage?.hasGabions}
                        onChange={(e) => targetOuvrage && handleUpdateOuvrage(targetOuvrage.id, "hasGabions", e.target.checked)}
                        className="rounded text-amber-700 focus:ring-amber-600 w-4 h-4"
                      />
                      <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                        Activer la Protection par Murs en Gabions (Terrain Dénivelé)
                      </span>
                    </label>
                  </div>

                  {targetOuvrage?.hasGabions && (
                    <div className="space-y-4">
                      {/* Side Tabs Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase block">Côté du Mur à Configurer :</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(["nord", "sud", "est", "ouest"] as const).map((side) => {
                            const conf = sides[side] || defaultGabionSide;
                            const isTabActive = activeGabionTab === side;
                            return (
                              <button
                                key={side}
                                type="button"
                                onClick={() => setActiveGabionTab(side)}
                                className={`py-2 px-3 rounded-xl font-black text-xs capitalize flex flex-col items-center justify-center border transition-all ${
                                  isTabActive
                                    ? "bg-amber-600 text-white border-amber-600 shadow-md scale-[1.02]"
                                    : conf.enabled
                                    ? "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                                    : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                <span className="uppercase">{side}</span>
                                <span className="text-[9px] font-mono opacity-80">
                                  {conf.enabled ? `${(conf.tiers || []).length} Étage${(conf.tiers || []).length > 1 ? "s" : ""}` : "Inactif"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Active Gabion Side Parameters Panel — étages paramétriques individuels */}
                      {(() => {
                        const side = activeGabionTab;
                        const conf = sides[side] || defaultGabionSide;
                        const tiers = conf.tiers || [];

                        const updateConf = (partial: Partial<typeof conf>) => {
                          if (!targetOuvrage) return;
                          setOuvrages(prev => prev.map(o => {
                            if (o.id !== targetOuvrage.id) return o;
                            const currentSides = o.gabionSides || { nord: defaultGabionSide, sud: defaultGabionSide, est: defaultGabionSide, ouest: defaultGabionSide };
                            return {
                              ...o,
                              gabionSides: {
                                ...currentSides,
                                [side]: { ...(currentSides[side] || defaultGabionSide), ...partial }
                              }
                            };
                          }));
                        };

                        const updateTier = (idx: number, partial: any) => {
                          const newTiers = tiers.map((t, i) => i === idx ? { ...t, ...partial } : t);
                          updateConf({ tiers: newTiers } as any);
                        };
                        const addTier = () => {
                          updateConf({ tiers: [...tiers, { height: 0.8, depth: 0.8, redanMode: "fixe", redanValue: 0.3 }] } as any);
                        };
                        const removeTier = (idx: number) => {
                          updateConf({ tiers: tiers.filter((_, i) => i !== idx) } as any);
                        };

                        const totalHeight = tiers.reduce((s, t) => s + (t.height || 0), 0);

                        return (
                          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-300 space-y-4">
                            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={conf.enabled}
                                  onChange={(e) => updateConf({ enabled: e.target.checked })}
                                  className="rounded text-amber-700 focus:ring-amber-600 w-4 h-4"
                                />
                                <span className="text-xs font-black text-slate-800 uppercase">
                                  Mur Gabion Côté <strong className="text-amber-800 uppercase">{side}</strong>
                                </span>
                              </label>
                              {conf.enabled && (
                                <span className="text-[10px] font-mono bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                                  {conf.length}m | {tiers.length} Étage(s) | H≈{totalHeight.toFixed(2)}m
                                </span>
                              )}
                            </div>

                            {conf.enabled && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Longueur du Mur (m) :</label>
                                    <input
                                      type="number"
                                      min="2"
                                      max="100"
                                      step="1"
                                      value={conf.length}
                                      onChange={(e) => updateConf({ length: Math.max(1, parseFloat(e.target.value) || 5) })}
                                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg px-2.5 py-1.5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Position le long du mur, depuis le coin (m) :</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      step="0.5"
                                      value={conf.offset}
                                      onChange={(e) => updateConf({ offset: Math.max(0, parseFloat(e.target.value) || 0) })}
                                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg px-2.5 py-1.5"
                                    />
                                  </div>
                                </div>

                                {/* Aperçu élévation (coupe) */}
                                <div className="bg-slate-950 rounded-xl p-3 border border-slate-700">
                                  <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Aperçu Élévation (Coupe)</span>
                                  <svg viewBox="0 0 400 220" className="w-full h-auto bg-slate-900 rounded">
                                    {tiers.length === 0 ? (
                                      <text x="200" y="110" fill="#64748b" fontSize="11" textAnchor="middle">Aucun étage configuré</text>
                                    ) : (() => {
                                      const PX_PER_M = 40;
                                      let cumH = 0, cumD = 0;
                                      const rects = tiers.map((t, idx) => {
                                        const h = (t.height || 0.5) * PX_PER_M;
                                        const d = (t.depth || 0.5) * PX_PER_M;
                                        if (idx > 0) {
                                          const prevDepth = tiers[idx - 1].depth || 1;
                                          const redanM = t.redanMode === "pourcentage" ? (prevDepth * (t.redanValue || 0)) / 100 : (t.redanValue || 0);
                                          cumD += redanM * PX_PER_M;
                                        }
                                        const y = 190 - cumH - h;
                                        const x = 30 + cumD;
                                        cumH += h;
                                        const color = idx % 2 === 0 ? "#92400e" : "#b45309";
                                        return (
                                          <g key={idx}>
                                            <rect x={x} y={y} width={d} height={h} fill={color} stroke="#f59e0b" strokeWidth="1.5" />
                                            <text x={x + d / 2} y={y + h / 2 + 3} fill="#fef3c7" fontSize="8" fontWeight="bold" textAnchor="middle">Ét.{idx + 1}</text>
                                          </g>
                                        );
                                      });
                                      return (
                                        <>
                                          <line x1="10" y1="190" x2="390" y2="190" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 3" />
                                          {rects}
                                          <text x="200" y="210" fill="#64748b" fontSize="9" textAnchor="middle">Hauteur totale ≈ {totalHeight.toFixed(2)} m</text>
                                        </>
                                      );
                                    })()}
                                  </svg>
                                </div>

                                {/* Liste des étages */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-600 uppercase">Étages ({tiers.length}) :</label>
                                    <button type="button" onClick={addTier} className="text-[10px] font-bold text-amber-700 underline">+ Ajouter un étage</button>
                                  </div>
                                  {tiers.map((t, idx) => (
                                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-amber-800">Étage {idx + 1} {idx === 0 ? "(base)" : ""}</span>
                                        {tiers.length > 1 && (
                                          <button type="button" onClick={() => removeTier(idx)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[9px] font-bold text-slate-500 block">Hauteur (m) :</label>
                                          <input
                                            type="number" min="0.2" step="0.1" value={t.height}
                                            onChange={(e) => updateTier(idx, { height: Math.max(0.2, parseFloat(e.target.value) || 0.5) })}
                                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-2 py-1"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold text-slate-500 block">Profondeur (m) :</label>
                                          <input
                                            type="number" min="0.3" step="0.1" value={t.depth}
                                            onChange={(e) => updateTier(idx, { depth: Math.max(0.3, parseFloat(e.target.value) || 0.5) })}
                                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-2 py-1"
                                          />
                                        </div>
                                      </div>
                                      {idx > 0 && (
                                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-100">
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 block">Mode du retrait :</label>
                                            <select
                                              value={t.redanMode}
                                              onChange={(e) => updateTier(idx, { redanMode: e.target.value })}
                                              className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded px-2 py-1"
                                            >
                                              <option value="fixe">Fixe (m)</option>
                                              <option value="pourcentage">% de la profondeur du dessous</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 block">{t.redanMode === "pourcentage" ? "Retrait (%) :" : "Retrait (m) :"}</label>
                                            <input
                                              type="number" min="0" step={t.redanMode === "pourcentage" ? "5" : "0.1"} value={t.redanValue}
                                              onChange={(e) => updateTier(idx, { redanValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                                              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-2 py-1"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 2. PERIMETER & FENCE CAD MODAL */}
              {activeCadModal === "perimeter" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase block">Longueur du Poste A (m) :</label>
                      <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.5"
                        value={ouvrages[0]?.length ?? fenceA}
                        onChange={(e) => {
                          const val = Math.max(5, parseFloat(e.target.value) || 35);
                          if (ouvrages[0]) handleUpdateOuvrage(ouvrages[0].id, "length", val);
                          else setFenceA(val);
                        }}
                        className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                      />
                      {!ouvrages[0] && (
                        <p className="text-[9px] text-amber-600 font-bold">Ajoutez d'abord un Ouvrage / Bloc pour que ce réglage prenne effet.</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase block">Largeur du Poste B (m) :</label>
                      <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.5"
                        value={ouvrages[0]?.width ?? fenceB}
                        onChange={(e) => {
                          const val = Math.max(5, parseFloat(e.target.value) || 21);
                          if (ouvrages[0]) handleUpdateOuvrage(ouvrages[0].id, "width", val);
                          else setFenceB(val);
                        }}
                        className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-slate-600 uppercase block">Matériau des Poteaux :</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPostType("metal_heb")}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                          postType === "metal_heb" ? "bg-slate-900 text-cyan-300 border-slate-900" : "bg-white text-slate-700 border-slate-200"
                        }`}
                      >
                        Poteaux Métalliques HEB
                      </button>
                      <button
                        type="button"
                        onClick={() => setPostType("beton_arme")}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                          postType === "beton_arme" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-700 border-slate-200"
                        }`}
                      >
                        Poteaux Béton Armé
                      </button>
                    </div>

                    {postType === "beton_arme" && (
                      <div className="grid grid-cols-3 gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs">
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 block">Larg. (m) :</label>
                          <input
                            type="number"
                            value={postConcreteWidth}
                            onChange={(e) => setPostConcreteWidth(parseFloat(e.target.value) || 0.25)}
                            className="w-full font-mono bg-white border border-emerald-300 rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 block">Prof. (m) :</label>
                          <input
                            type="number"
                            value={postConcreteDepth}
                            onChange={(e) => setPostConcreteDepth(parseFloat(e.target.value) || 0.25)}
                            className="w-full font-mono bg-white border border-emerald-300 rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 block">Hauteur (m) :</label>
                          <input
                            type="number"
                            value={postConcreteHeight}
                            onChange={(e) => setPostConcreteHeight(parseFloat(e.target.value) || 2.8)}
                            className="w-full font-mono bg-white border border-emerald-300 rounded px-2 py-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. SHELTER CAD MODAL - Multi-Abri List & Management */}
              {activeCadModal === "shelters" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <span className="text-xs font-black text-emerald-950 uppercase">
                      Liste des Abris de Télé-exploitation ({abris.length}) - Surface: {abris.reduce((acc, a) => acc + a.length * a.width, 0).toFixed(1)} m²
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddAbri()}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un Abri</span>
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {abris.map((a) => (
                      <div key={a.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <input
                            type="text"
                            value={a.name}
                            onChange={(e) => handleUpdateAbri(a.id, "name", e.target.value)}
                            className="font-bold text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 w-2/3"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateAbri(a.id)}
                              className="p-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded"
                              title="Dupliquer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAbri(a.id)}
                              className="p-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Accès & Portes :</label>
                            <select
                              value={a.type}
                              onChange={(e) => handleUpdateAbri(a.id, "type", e.target.value)}
                              className="w-full font-bold bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="01_porte">Type 01 Porte</option>
                              <option value="02_portes">Type 02 Portes</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Type d'Ouvrage :</label>
                            <select
                              value={a.isExtension ? "yes" : "no"}
                              onChange={(e) => handleUpdateAbri(a.id, "isExtension", e.target.value === "yes")}
                              className="w-full font-bold bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="no">Ouvrage Neuf (D'origine)</option>
                              <option value="yes">Extension à construire</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Longueur (m / Ml) :</label>
                            <input
                              type="number"
                              step="0.1"
                              value={a.length}
                              onChange={(e) => handleUpdateAbri(a.id, "length", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Largeur (m / Ml) :</label>
                            <input
                              type="number"
                              step="0.1"
                              value={a.width}
                              onChange={(e) => handleUpdateAbri(a.id, "width", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Pos X (m / Ml) :</label>
                            <input
                              type="number"
                              step="0.1"
                              value={a.xOffset}
                              onChange={(e) => handleUpdateAbri(a.id, "xOffset", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Pos Y (m / Ml) :</label>
                            <input
                              type="number"
                              step="0.1"
                              value={a.yOffset}
                              onChange={(e) => handleUpdateAbri(a.id, "yOffset", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. OUVRAGES CAD MODAL - Multi-Ouvrages / Blocs Placement Libre */}
              {activeCadModal === "ouvrages" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <div>
                      <span className="text-xs font-black text-amber-950 uppercase block">
                        Gestion des Blocs & Ouvrages du Croquis ({ouvrages.length})
                      </span>
                      <span className="text-[10px] text-amber-800">
                        Chaque bloc peut être configuré en Nouveau (Projet/Extension) ou Ancien (Existant) et positionné librement (X,Y).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddOuvrage()}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un Ouvrage / Bloc</span>
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {ouvrages.map((ov, idx) => (
                      <div key={ov.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-mono font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={ov.name}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "name", e.target.value)}
                              className="font-bold text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 w-full"
                              placeholder="Nom de l'ouvrage..."
                            />
                          </div>

                          {/* Statut Nouveau vs Ancien */}
                          <div className="flex items-center gap-1">
                            <select
                              value={ov.status}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "status", e.target.value as "nouveau" | "ancien")}
                              className={`font-mono font-bold text-xs rounded px-2 py-1 border ${
                                ov.status === "nouveau"
                                  ? "bg-sky-100 text-sky-800 border-sky-300"
                                  : "bg-slate-200 text-slate-700 border-slate-300"
                              }`}
                            >
                              <option value="nouveau">🆕 NOUVEAU / EXTENSION</option>
                              <option value="ancien">🏛️ ANCIEN / EXISTANT</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDuplicateOuvrage(ov.id)}
                              className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded"
                              title="Dupliquer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {ouvrages.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOuvrage(ov.id)}
                                className="p-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Coordonnées & Dimensions */}
                        <div className="grid grid-cols-5 gap-2 bg-white p-2 rounded-lg border border-slate-200">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Long. A (m):</label>
                            <input
                              type="number"
                              step="0.5"
                              value={ov.length}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "length", parseFloat(e.target.value) || 1)}
                              className="w-full font-mono font-bold bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Larg. B (m):</label>
                            <input
                              type="number"
                              step="0.5"
                              value={ov.width}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "width", parseFloat(e.target.value) || 1)}
                              className="w-full font-mono font-bold bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Pos X (m):</label>
                            <input
                              type="number"
                              step="0.5"
                              value={ov.xOffset}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "xOffset", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Pos Y (m):</label>
                            <input
                              type="number"
                              step="0.5"
                              value={ov.yOffset}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "yOffset", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">H Clôture (m):</label>
                            <input
                              type="number"
                              step="0.1"
                              value={ov.fenceHeight}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "fenceHeight", parseFloat(e.target.value) || 2.5)}
                              className="w-full font-mono font-bold bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                            />
                          </div>
                        </div>

                        {/* Éléments de l'Ouvrage */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-[10px]">
                          <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ov.hasFence}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "hasFence", e.target.checked)}
                              className="rounded text-amber-600"
                            />
                            <span>Clôture Périmétrique</span>
                          </label>
                          <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ov.hasVoile}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "hasVoile", e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <span>Voile Béton Armé</span>
                          </label>
                          <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ov.hasGabions}
                              onChange={(e) => handleUpdateOuvrage(ov.id, "hasGabions", e.target.checked)}
                              className="rounded text-amber-700"
                            />
                            <span>Gabions de Protection</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. VOILE CAD MODAL (par ouvrage / bloc cible) */}
              {activeCadModal === "voile" && (() => {
                const targetOuvrage = ouvrages.find(o => o.id === activeVoileOuvrageId) || ouvrages[0];
                const tSides = targetOuvrage?.voileSides || [];

                return (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase block">Ouvrage / Bloc Cible :</label>
                    <select
                      value={targetOuvrage?.id || ""}
                      onChange={(e) => setActiveVoileOuvrageId(e.target.value)}
                      className="w-full font-bold text-sm bg-white border border-slate-300 rounded-xl px-3 py-2"
                    >
                      {ouvrages.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                    <input
                      type="checkbox"
                      checked={!!targetOuvrage?.hasVoile}
                      onChange={(e) => targetOuvrage && handleUpdateOuvrage(targetOuvrage.id, "hasVoile", e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs font-black text-indigo-950 uppercase">
                      Activer le Voile Périmétrique en Béton Armé
                    </span>
                  </label>

                  {targetOuvrage?.hasVoile && (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase">Côtés du Voile :</label>
                          <button
                            type="button"
                            onClick={() => targetOuvrage && handleUpdateOuvrage(targetOuvrage.id, "voileSides", ["nord", "sud", "est", "ouest"])}
                            className="text-[10px] font-bold text-indigo-600 underline"
                          >
                            Tous les 4 côtés
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {(["nord", "sud", "est", "ouest"] as const).map((s) => {
                            const active = tSides.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  if (!targetOuvrage) return;
                                  const next = active ? tSides.filter(x => x !== s) : [...tSides, s];
                                  handleUpdateOuvrage(targetOuvrage.id, "voileSides", next);
                                }}
                                className={`py-2 text-center font-extrabold capitalize rounded-lg border text-xs transition-all ${
                                  active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200"
                                }`}
                              >
                                {s} {active ? "✓" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Hauteur Voile (m) :</label>
                          <input
                            type="number"
                            value={targetOuvrage?.voileHeight ?? 2.5}
                            onChange={(e) => targetOuvrage && handleUpdateOuvrage(targetOuvrage.id, "voileHeight", parseFloat(e.target.value) || 2.5)}
                            className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Épaisseur Voile (m) :</label>
                          <input
                            type="number"
                            value={targetOuvrage?.voileThickness ?? 0.2}
                            onChange={(e) => targetOuvrage && handleUpdateOuvrage(targetOuvrage.id, "voileThickness", parseFloat(e.target.value) || 0.2)}
                            className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 6. SLABS & MASSIFS CAD MODAL */}
              {(activeCadModal === "slabs" || activeCadModal === "massifs") && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl border border-purple-200 flex-wrap gap-2">
                    <span className="text-xs font-black text-purple-950 uppercase">
                      Dalles ({slabs.length}) et Massifs ({massifs.length}) Béton Armé
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddSlab()}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Dalle Béton</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddMassif()}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Massif Béton</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                    {/* SECTION MASSIFS */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1">
                        <span>🟧 Massifs Béton Armé / Socles Pylônes ({massifs.length}) :</span>
                      </h4>
                      {massifs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic bg-amber-50/50 p-2 rounded border border-amber-200">
                          Aucun massif béton configuré. Cliquez sur "+ Massif Béton" ci-dessus pour en insérer un.
                        </p>
                      ) : (
                        massifs.map((m, idx) => (
                          <div key={m.id} className={`p-3 rounded-xl border space-y-2 text-xs transition-all ${selectedMassifId === m.id ? "bg-amber-50/90 border-amber-400 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
                            <div className="flex justify-between items-center border-b border-amber-200/60 pb-2">
                              <input
                                type="text"
                                value={m.name}
                                onChange={(e) => handleUpdateMassif(m.id, "name", e.target.value)}
                                className="font-extrabold text-amber-950 bg-white border border-amber-300 rounded px-2 py-0.5 text-xs w-2/3"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateMassif(m.id)}
                                  className="p-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded"
                                  title="Dupliquer Massif"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMassif(m.id)}
                                  className="p-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded"
                                  title="Supprimer Massif"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Long. (m) :</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={m.length}
                                  onChange={(e) => handleUpdateMassif(m.id, "length", parseFloat(e.target.value) || 0.5)}
                                  className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Larg. (m) :</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={m.width}
                                  onChange={(e) => handleUpdateMassif(m.id, "width", parseFloat(e.target.value) || 0.5)}
                                  className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Haut. (m) :</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={m.height}
                                  onChange={(e) => handleUpdateMassif(m.id, "height", parseFloat(e.target.value) || 0.5)}
                                  className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Pos X (m) :</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={m.xOffset}
                                  onChange={(e) => handleUpdateMassif(m.id, "xOffset", parseFloat(e.target.value) || 0)}
                                  className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Pos Y (m) :</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={m.yOffset}
                                  onChange={(e) => handleUpdateMassif(m.id, "yOffset", parseFloat(e.target.value) || 0)}
                                  className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* SECTION DALLES */}
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <h4 className="text-[11px] font-black uppercase text-purple-800 tracking-wider flex items-center gap-1">
                        <span>🟪 Dalles Béton Armé ({slabs.length}) - Surface: {totalSlabsArea.toFixed(1)} m² :</span>
                      </h4>
                      {slabs.map((s, idx) => (
                        <div key={s.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="font-extrabold text-slate-800">#{idx + 1}</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateSlab(s.id)}
                                className="p-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded"
                                title="Dupliquer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlab(s.id)}
                                className="p-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Nom :</label>
                              <input
                                type="text"
                                value={s.name}
                                onChange={(e) => handleUpdateSlab(s.id, "name", e.target.value)}
                                className="w-full font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Type de Dalle :</label>
                              <select
                                value={s.type}
                                onChange={(e) => handleUpdateSlab(s.id, "type", e.target.value)}
                                className="w-full font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                              >
                                <option value="poste_detente">Dalle Poste de Détente</option>
                                <option value="rechaffeur">Dalle Réchauffeur</option>
                                <option value="gare_racleur_arrivee">Dalle Gare Racleur (Arrivée)</option>
                                <option value="gare_racleur_depart">Dalle Gare Racleur (Départ)</option>
                                <option value="epandage_assiette">Épandage Assiette</option>
                                <option value="abri_tele">Dalle Abri Télé-exploitation</option>
                                <option value="dalle_custom">Dalle Béton Personnalisée</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Long. (m) :</label>
                              <input
                                type="number"
                                value={s.length}
                                onChange={(e) => handleUpdateSlab(s.id, "length", parseFloat(e.target.value) || 1)}
                                className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Larg. (m) :</label>
                              <input
                                type="number"
                                value={s.width}
                                onChange={(e) => handleUpdateSlab(s.id, "width", parseFloat(e.target.value) || 1)}
                                className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Pos X (m) :</label>
                              <input
                                type="number"
                                value={s.xOffset}
                                onChange={(e) => handleUpdateSlab(s.id, "xOffset", parseFloat(e.target.value) || 0)}
                                className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Pos Y (m) :</label>
                              <input
                                type="number"
                                value={s.yOffset}
                                onChange={(e) => handleUpdateSlab(s.id, "yOffset", parseFloat(e.target.value) || 0)}
                                className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 7. GATES CAD MODAL */}
              {activeCadModal === "gates" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-cyan-50 p-3 rounded-xl border border-cyan-200 flex-wrap gap-2">
                    <span className="text-xs font-black text-cyan-950 uppercase">
                      Gestion des Portails & Accès ({gates.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddGate("portail_5m")}
                        className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Portail 5m (Véhicules)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddGate("portillon")}
                        className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Portillon 1m (Piéton)</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {gates.map((g) => (
                      <div key={g.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                        <div className="grid grid-cols-4 gap-2 flex-1">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Ouvrage :</label>
                            <select
                              value={g.ouvrageId || ouvrages[0]?.id || ""}
                              onChange={(e) => handleUpdateGate(g.id, "ouvrageId", e.target.value)}
                              className="w-full font-bold bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            >
                              {ouvrages.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Type d'Accès :</label>
                            <select
                              value={g.type}
                              onChange={(e) => handleUpdateGate(g.id, "type", e.target.value)}
                              className="w-full font-bold bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="portail_5m">Portail 5m (Véhicules)</option>
                              <option value="portillon">Portillon 1m (Piéton)</option>
                              <option value="portail_custom">Sur-mesure</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Côté Wall :</label>
                            <select
                              value={g.wall}
                              onChange={(e) => handleUpdateGate(g.id, "wall", e.target.value)}
                              className="w-full font-bold bg-white border border-slate-300 rounded px-2 py-1 text-xs capitalize"
                            >
                              <option value="sud">Sud</option>
                              <option value="nord">Nord</option>
                              <option value="est">Est</option>
                              <option value="ouest">Ouest</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Position Offset (m) :</label>
                            <input
                              type="number"
                              value={g.offset}
                              onChange={(e) => handleUpdateGate(g.id, "offset", parseFloat(e.target.value) || 0)}
                              className="w-full font-mono font-bold bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGate(g.id)}
                          className="p-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveCadModal(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Valider & Appliquer au Plan 2D</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. FENÊTRE DE DISPOSITION & CONFIGURATION D'IMPRESSION CAD */}
      {/* ========================================================= */}
      {showPrintLayoutModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-cyan-500/40 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <span>Disposition d'Impression CAD & Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-400">Configurez la mise en page, l'orientation et la fenêtre d'impression</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintLayoutModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-200">
              {/* Option 1: Orientation */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-cyan-400 tracking-wider block">1. Format & Orientation du Papier</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("landscape")}
                    className={`p-4 rounded-2xl border-2 font-bold text-xs flex items-center gap-3 transition-all cursor-pointer ${
                      printOrientation === "landscape" ? "bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md" : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="w-10 h-7 border-2 border-current rounded flex items-center justify-center font-mono text-[9px]">A3</div>
                    <div className="text-left">
                      <span className="block font-black text-sm">PAYSAGE (A3 / A4)</span>
                      <span className="text-[10px] opacity-75">Recommandé pour plans de masse et postes gaz</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("portrait")}
                    className={`p-4 rounded-2xl border-2 font-bold text-xs flex items-center gap-3 transition-all cursor-pointer ${
                      printOrientation === "portrait" ? "bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md" : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="w-7 h-10 border-2 border-current rounded flex items-center justify-center font-mono text-[9px]">A4</div>
                    <div className="text-left">
                      <span className="block font-black text-sm">PORTRAIT (A4)</span>
                      <span className="text-[10px] opacity-75">Surtout pour rapports d'impression d'1 page</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Option 2: Color Mode */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-cyan-400 tracking-wider block">2. Mode de Rendu des Couleurs</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintColorMode("color")}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      printColorMode === "color" ? "bg-blue-950/80 border-blue-400 text-blue-300" : "bg-slate-800/60 border-slate-700 text-slate-400"
                    }`}
                  >
                    <span>🎨 Plein Couleurs CAD</span>
                    <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded text-blue-200">Haute Clarté</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintColorMode("bw")}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      printColorMode === "bw" ? "bg-slate-800 border-slate-300 text-white" : "bg-slate-800/60 border-slate-700 text-slate-400"
                    }`}
                  >
                    <span>⬛ Noir & Blanc Technique</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Monochrome</span>
                  </button>
                </div>
              </div>

              {/* Option 3: Print Area */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-cyan-400 tracking-wider block">3. Zone d'Impression</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintZoneMode("all")}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      printZoneMode === "all" ? "bg-cyan-950/80 border-cyan-400 text-cyan-300" : "bg-slate-800/60 border-slate-700 text-slate-400"
                    }`}
                  >
                    <span>📐 Ensemble du Plan CAD</span>
                    <span className="text-[10px] bg-cyan-900 px-2 py-0.5 rounded text-cyan-200">Ajusté</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintZoneMode("window");
                      setDrawingTool("printZone");
                    }}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      printZoneMode === "window" ? "bg-amber-950/80 border-amber-400 text-amber-300" : "bg-slate-800/60 border-slate-700 text-slate-400"
                    }`}
                  >
                    <span>🖼️ Fenêtre Sélectionnée (AutoCAD)</span>
                    <span className="text-[10px] bg-amber-900 px-2 py-0.5 rounded text-amber-200">Cadre Jaune</span>
                  </button>
                </div>
              </div>

              {/* Option 4: Display Options */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <label className="text-xs font-black uppercase text-cyan-400 tracking-wider block">4. Éléments à Inclure sur l'Impression</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-cyan-500/40 transition-all">
                    <input
                      type="checkbox"
                      checked={printIncludeCotations}
                      onChange={(e) => setPrintIncludeCotations(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">📐 Cotations & Dimensions</span>
                      <span className="text-[10px] text-slate-400">Affiche les côtes automatiques et manuelles</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-cyan-500/40 transition-all">
                    <input
                      type="checkbox"
                      checked={printIncludeCartouche}
                      onChange={(e) => setPrintIncludeCartouche(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">📋 Cartouche Technique PD&I</span>
                      <span className="text-[10px] text-slate-400">Cartouche réglementaire avec visas et plan N°</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Option 5: Scale */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-cyan-400 tracking-wider block">5. Échelle du Plan</label>
                <div className="flex gap-2">
                  {["1:50", "1:100", "1:200", "1:500", "Ajuster"].map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setPrintScale(sc)}
                      className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                        printScale === sc ? "bg-cyan-500 text-slate-950 font-black border-cyan-400 shadow-sm" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-5 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowCartoucheEditModal(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-orange-400 font-bold text-xs rounded-xl border border-orange-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Modifier le Cartouche...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPrintLayoutModal(false);
                  handleDirectPrintCroquis();
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ Lancer l'Impression Offiielle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. FENÊTRE DE CARTOUCHE TECHNIQUE EDIT MODAL               */}
      {/* ========================================================= */}
      {showCartoucheEditModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-orange-500/40 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-white">Éditeur de Cartouche Normalisé PD&I</h3>
                  <p className="text-xs text-slate-400">Renseignez les métadonnées officielles figurant au bas du plan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCartoucheEditModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-slate-200 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">PROJET / INTITULÉ DU POSTE :</label>
                <input
                  type="text"
                  value={cartoucheInfo.postName}
                  onChange={(e) => setCartoucheInfo({ ...cartoucheInfo, postName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:border-orange-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">NUMÉRO DE PLAN :</label>
                  <input
                    type="text"
                    value={cartoucheInfo.planNumber}
                    onChange={(e) => setCartoucheInfo({ ...cartoucheInfo, planNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold font-mono text-xs focus:border-orange-400 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">ÉCHELLE D'IMPRESSION :</label>
                  <input
                    type="text"
                    value={cartoucheInfo.scale}
                    onChange={(e) => setCartoucheInfo({ ...cartoucheInfo, scale: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold font-mono text-xs focus:border-orange-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">NOM DU DESSINATEUR / INGÉNIEUR :</label>
                  <input
                    type="text"
                    value={cartoucheInfo.editorName}
                    onChange={(e) => setCartoucheInfo({ ...cartoucheInfo, editorName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:border-orange-400 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">DATE D'ÉDITION :</label>
                  <input
                    type="text"
                    value={cartoucheInfo.date}
                    onChange={(e) => setCartoucheInfo({ ...cartoucheInfo, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:border-orange-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">POSITION DU CARTOUCHE SUR LE CROQUIS :</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCartouchePosition("left")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      cartouchePosition === "left" 
                        ? "bg-orange-500 text-white shadow-sm" 
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>⬅️ Gauche (Optimisé pour édition & impression)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartouchePosition("right")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      cartouchePosition === "right" 
                        ? "bg-orange-500 text-white shadow-sm" 
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>➡️ Droite</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCartoucheEditModal(false)}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer & Appliquer au Cartouche</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. FENÊTRE DE RACCOURCIS CLAVIER CAD & FIGMA               */}
      {/* ========================================================= */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-cyan-500/40 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-white">Raccourcis Clavier & Fonctionnalités CAD</h3>
                  <p className="text-xs text-slate-400">Gagnez en rapidité avec les raccourcis professionnels type AutoCAD / Figma</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 text-slate-300 text-xs font-mono">
              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Panoramique / Déplacer Vue :</span>
                <span className="bg-slate-800 text-cyan-300 px-2 py-1 rounded border border-slate-700 font-bold">Molette / Espace + Glisser</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Zoom Avant / Zoom Arrière :</span>
                <span className="bg-slate-800 text-cyan-300 px-2 py-1 rounded border border-slate-700 font-bold">Molette Souris 🖱️</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Supprimer Élément Sélectionné :</span>
                <span className="bg-slate-800 text-red-300 px-2 py-1 rounded border border-slate-700 font-bold">Suppr / Backspace</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Annuler Action (Undo) :</span>
                <span className="bg-slate-800 text-amber-300 px-2 py-1 rounded border border-slate-700 font-bold">Ctrl + Z</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Rétablir Action (Redo) :</span>
                <span className="bg-slate-800 text-amber-300 px-2 py-1 rounded border border-slate-700 font-bold">Ctrl + Y / Ctrl+Shift+Z</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Copier & Coller Formes :</span>
                <span className="bg-slate-800 text-emerald-300 px-2 py-1 rounded border border-slate-700 font-bold">Ctrl + C / Ctrl + V</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Dupliquer Forme Sélectionnée :</span>
                <span className="bg-slate-800 text-emerald-300 px-2 py-1 rounded border border-slate-700 font-bold">Ctrl + D</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Tout Sélectionner :</span>
                <span className="bg-slate-800 text-purple-300 px-2 py-1 rounded border border-slate-700 font-bold">Ctrl + A</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Aimantation à la Grille (Grid Snap) :</span>
                <span className="bg-slate-800 text-sky-300 px-2 py-1 rounded border border-slate-700 font-bold">Touche G</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-sans">Déplacement Précis (Nudge) :</span>
                <span className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-slate-700 font-bold">Touches Fléchées (Shift=x10)</span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Compris !
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
