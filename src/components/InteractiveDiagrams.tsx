/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Technical Manual Schemas & Interactive Nomograms Hub
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Info, 
  HelpCircle, 
  MapPin, 
  Layers, 
  ShieldAlert, 
  Sliders, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Download, 
  BookOpen, 
  Award, 
  Move, 
  Check, 
  ChevronRight, 
  Eye,
  Database,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus
} from "lucide-react";
import { onSnapshot, collection, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLD_BENDING_DATA } from "../data/fascicules";
import DriveLinkConverter from "./DriveLinkConverter";

// Import local images statically to let Vite bundle them correctly for production
import trenchImg from "../assets/images/trench_technical_sheet_1783361610351.jpg";
import sandbagImg from "../assets/images/sandbag_protection_1783362513651.jpg";
import cableImg from "../assets/images/cable_crossing_protection_1783362523438.jpg";
import crossingImg from "../assets/images/crossing_technical_sheet_1783361623788.jpg";
import ouedImg from "../assets/images/oued_technical_sheet_1783361638299.jpg";
import bendingImg from "../assets/images/cintrage_abaque_1783362534158.jpg";
import posteImg from "../assets/images/poste_technical_sheet_1783361652494.jpg";

/// Complete dataset of official schemas and drawings
const ORIGINAL_PLANS = [
  {
    id: "trench_spec",
    title: "Profil en Travers Type de la Tranchée d'Enfouissement",
    fascicule: "Fascicule 2",
    page: 12,
    category: "Ligne courante",
    src: trenchImg,
    caption: "Profil de terrassement réglementaire pour tracé standard. Définit la largeur minimale de fouille (D + 0.40m), l'épaisseur du lit de pose en sable fin criblé (10cm), l'enrobage initial protecteur de la canalisation et le positionnement réglementaire du grillage avertisseur en plastique orange.",
    tags: ["fouille", "tranchée", "sable", "grillage", "remblai", "couverture", "profil"]
  },
  {
    id: "sandbag_spec",
    title: "Détail de Protection de la Conduite par Sacs de Sable",
    fascicule: "Fascicule 2",
    page: 34,
    category: "Ligne courante",
    src: sandbagImg,
    caption: "Schéma d'exécution pour la protection et la stabilisation de la canalisation dans les pentes ou terrains instables à l'aide de sacs de sable ou de sacs de terre (sandbags). Permet de stabiliser le remblai, de prévenir l'érosion interne due au ravinement des eaux pluviales et de protéger l'acier contre les frottements rocheux.",
    tags: ["sacs de sable", "pente", "stabilisation", "érosion", "protection", "terrasseements"]
  },
  {
    id: "cable_crossing_spec",
    title: "Plan Type de Croisement de Câbles Souterrains",
    fascicule: "Fascicule 2",
    page: 36,
    category: "Croisements",
    src: cableImg,
    caption: "Plan type d'ingénierie PD&I décrivant le passage en dessus ou en dessous d'un câble souterrain (télécommunication, fibre optique ou lignes d'énergie BT/MT/HT). Spécifie la distance verticale minimale libre (clearance de 0.40 m à 0.50 m), le remblaiement obligatoire en sable de granulométrie contrôlée et la pose du grillage avertisseur.",
    tags: ["câble", "croisement", "distance", "électricité", "télécom", "sable", "sécurité"]
  },
  {
    id: "crossing_spec",
    title: "Plan de Traversée de Route Nationale (Fonçage & Tranchée)",
    fascicule: "Fascicule 2",
    page: 40,
    category: "Croisements",
    src: crossingImg,
    caption: "Dessin d'exécution technique d'une traversée de route nationale par fonçage horizontal ou tranchée ouverte avec gaine de protection en acier. Détaille la disposition des colliers isolants de centrage tous les 1.5m, des obturateurs étanches aux extrémités et du tube reniflard de respiration.",
    tags: ["route", "gaine", "collier", "reniflard", "fonçage", "traversée", "fourreau"]
  },
  {
    id: "oued_spec",
    title: "Profil de Pose pour la Traversée d'un Oued",
    fascicule: "Fascicule 5",
    page: 111,
    category: "Ouvrages spéciaux",
    src: ouedImg,
    caption: "Extrait de plan de pose pour traversée d'un oued. Représente l'enfouissement de la conduite sous le lit stable de l'oued avec des cavaliers de lestage en béton armé espacés pour annuler la force d'Archimède (poussée d'Archimède) et la protection par matelas de gabions ou enrochements.",
    tags: ["oued", "lest", "cavalier", "béton", "gabion", "flottaison", "lit de rivière"]
  },
  {
    id: "bending_abaque_spec",
    title: "Abaque de Cintrage à Froid des Tubes en Acier",
    fascicule: "Fascicule 7",
    page: 126,
    category: "Abaques",
    src: bendingImg,
    caption: "Abaque technique officiel déterminant le rayon minimal de cintrage à froid admissible (R ≥ 30 * Dn) en fonction du diamètre nominal (Dn) et de l'épaisseur du tube en acier pour les différentes nuances (X52, X60, X70). Évite tout plissement et ovalisation excessive.",
    tags: ["abaque", "cintrage", "rayon", "métal", "tube", "courbe", "tolérance"]
  },
  {
    id: "poste_detente_spec",
    title: "Plan d'Implantation d'un Poste de Coupure et de Détente",
    fascicule: "Fascicule 7",
    page: 185,
    category: "Postes",
    src: posteImg,
    caption: "Dessin technique d'implantation générale d'un poste de détente et de livraison de gaz. Présente la disposition des clôtures de sécurité (double clôture de 2m de hauteur), de la zone de sécurité, des dalles en béton armé pour les équipements de détente et comptage, et des systèmes de mise à la terre.",
    tags: ["poste", "détente", "comptage", "génie civil", "clôture", "bâtiment", "sécurité"]
  }
];

const LOCAL_IMAGE_MAP: Record<string, string> = {
  trench_spec: trenchImg,
  sandbag_spec: sandbagImg,
  cable_crossing_spec: cableImg,
  crossing_spec: crossingImg,
  oued_spec: ouedImg,
  bending_abaque_spec: bendingImg,
  poste_detente_spec: posteImg
};

interface InteractiveDiagramsProps {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export default function InteractiveDiagrams({ isAdmin = false, isSuperAdmin = false }: InteractiveDiagramsProps) {
  const [activeTab, setActiveTab] = useState<"interactif" | "officiel" | "sync">("interactif");
  const [plansList, setPlansList] = useState(ORIGINAL_PLANS);
  
  // Real-time Firestore sync
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "plans"), async (snapshot) => {
      if (snapshot.empty) {
        console.log("Firestore collection empty, seeding with default plans...");
        for (const plan of ORIGINAL_PLANS) {
          try {
            await setDoc(doc(db, "plans", plan.id), plan);
          } catch (e) {
            console.error("Seeding error for plan: " + plan.id, e);
          }
        }
        setPlansList(ORIGINAL_PLANS);
      } else {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;
          const src = LOCAL_IMAGE_MAP[id] || data.src;
          list.push({ id, ...data, src });
        });

        // Merge keeping local image assets for official plans
        const mergedList = [...ORIGINAL_PLANS];
        list.forEach(p => {
          const idx = mergedList.findIndex(orig => orig.id === p.id);
          if (idx !== -1) {
            mergedList[idx] = { 
              ...mergedList[idx], 
              ...p, 
              src: LOCAL_IMAGE_MAP[p.id] || mergedList[idx].src 
            };
          } else {
            mergedList.push(p);
          }
        });
        setPlansList(mergedList);
      }
    }, (err) => {
      console.warn("Firestore loading error (using offline default fallback): ", err);
      setPlansList(ORIGINAL_PLANS);
    });
    return () => unsubscribe();
  }, []);

  // Plan Edit states
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFascicule, setEditFascicule] = useState("Fascicule 7");
  const [editPage, setEditPage] = useState<number>(1);
  const [editCategory, setEditCategory] = useState("Ligne courante");
  const [editSrc, setEditSrc] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editTags, setEditTags] = useState("");

  const handleSavePlanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editSrc.trim()) return;
    try {
      await setDoc(doc(db, "plans", editingPlan.id), {
        id: editingPlan.id,
        title: editTitle,
        fascicule: editFascicule,
        page: Number(editPage) || 1,
        category: editCategory,
        src: editSrc,
        caption: editCaption,
        tags: editTags.split(",").map(t => t.trim()).filter(Boolean)
      });
      setEditingPlan(null);
    } catch (err) {
      console.error("Error saving plan edit: ", err);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce document technique ? Cette action est irréversible dans Firestore.")) return;
    try {
      await deleteDoc(doc(db, "plans", planId));
    } catch (err) {
      console.error("Error deleting plan from Firestore: ", err);
    }
  };
  
  // Local Uploader States
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFascicule, setUploadFascicule] = useState("Fascicule 7");
  const [uploadPage, setUploadPage] = useState<number>(1);
  const [uploadCategory, setUploadCategory] = useState("Tous");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadSrc, setUploadSrc] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Helper to compress images on the client side before saving to Firestore to respect the 1MB document limit
  const compressImage = (file: File, maxW = 1200, maxH = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxW) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            }
          } else {
            if (height > maxH) {
              width = Math.round((width * maxH) / height);
              height = maxH;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress as JPEG with 0.75 quality for optimal weight-to-quality ratio (< 200KB)
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          resolve(compressedBase64);
        };
        img.onerror = () => {
          reject(new Error("Erreur de chargement de l'image pour compression."));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
      reader.readAsDataURL(file);
    });
  };

  const compressAndSetImage = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setUploadSrc(compressed);
      setUploadError(null);
    } catch (err: any) {
      setUploadError("Erreur lors de la compression de l'image : " + err.message);
    }
  };
  
  // States for Interactive Diagrams (SVG with Hotspots)
  const [selectedDiagram, setSelectedDiagram] = useState<
    "trench" | "crossing" | "cable" | "sandbag" | "oued" | "ancrage" | "poste_layout" | "bending_abaque" | "gare_racleur"
  >("trench");
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [stationCapacity, setStationCapacity] = useState<"small" | "medium" | "large">("small");

  // Nomogram States
  const [nomoInches, setNomoInches] = useState<string>("12 3/4\"");
  const [nomoSteelGrade, setNomoSteelGrade] = useState<"X52" | "X60" | "X70">("X60");
  const [cableSubTab, setCableSubTab] = useState<"souterrain_croise" | "souterrain_parallele" | "aerien">("souterrain_croise");

  // Gallery Listing States
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryFilter, setGalleryFilter] = useState("Tous");

  // Advanced Zoom Modal States
  const [zoomPlan, setZoomPlan] = useState<typeof ORIGINAL_PLANS[0] | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Station dimensions mapping according to page 186-187
  const stationDims = {
    small: { cap: "2500 - 5000 Nm³/h", A: 28, B: 21, C: 15, D: 3, E: 10, F: 3 },
    medium: { cap: "10000 - 20000 Nm³/h", A: 35, B: 21, C: 25, D: 4, E: 15, F: 4 },
    large: { cap: "20000 - 30000 Nm³/h", A: 45, B: 24, C: 32, D: 4, E: 20, F: 4 }
  };
  const currentDims = stationDims[stationCapacity];

  const tooltips: { [key: string]: string } = {
    // Trench
    h_recouvrement: "Hauteur de recouvrement : 1,00 m minimum en tracé courant standard, ou 0,80 m en zone désertique.",
    lit_pose: "Lit de pose : Sable ou terre meuble d'épaisseur minimale de 0,10 m (obligatoire en terrain rocheux).",
    remblai: "Remblai protecteur : Épaisseur de 20 cm de terre meuble exempte de pierres au-dessus du tube avant le remblai définitif.",
    
    // Crossing
    gaine: "Gaine de protection : Diamètre extérieur de la gaine doit dépasser celui du tube d'au moins 20 cm pour permettre le coulissement.",
    obturateur: "Obturateur d'extrémité : Assure l'étanchéité à chaque extrémité de la gaine pour éviter l'entrée de terre ou d'eaux de ruissellement.",
    collier: "Colliers de centrage (Isolants) : Espacés de 1.5m à 2m. Ils isolent électriquement la canalisation et évitent d'endommager le revêtement.",
    reniflard: "Tube de respiration (Reniflard) : Placé aux extrémités pour surveiller l'absence de gaz et évacuer l'humidité accumulée.",

    // Cable
    clearance_elec: "Distance minimale Électricité : 0,50 m minimum de séparation verticale en croisement. Un grillage rouge avertisseur doit être placé au-dessus du câble.",
    grillage_avertisseur: "Grillage avertisseur orange : Placé à 30 cm au-dessus de la génératrice supérieure de la conduite de gaz.",
    
    // Detailed Cable Crossings Subtabs Tooltips
    cable_underground_cross_clearance: "Distance verticale minimale réglementaire : 0,50 m entre la canalisation de gaz et la génératrice externe des câbles électriques. Un lit de sable fin amortisseur de 15 cm doit séparer le tube et le dispositif protecteur.",
    cable_underground_cross_dalle: "Dalle de protection mécanique : Une dalle en béton armé dosé à 350 kg/m³ d'épaisseur de 5 cm d'épaisseur doit être interposée mécaniquement pour protéger le gazoduc contre les coups de pioche et fouilles ultérieures.",
    cable_underground_cross_sheath: "Fourreau de protection électrique : Les câbles électriques tiers doivent être insérés dans des gaines en PVC lourd, annelées ou en acier s'étendant sur une longueur minimale de 2,00 m de part et d'autre du croisement.",
    
    cable_underground_para_dist: "Distance de parallélisme standard : Distance horizontale minimale de 1,00 m exigée entre la canalisation de gaz et tout câble d'énergie souterrain posé parallèlement en tranchée séparée.",
    cable_underground_para_heat: "Écran isolant & Contrainte thermique : Si l'écart de parallélisme est réduit à 0,50 m, des dalles en béton armé ou un écran continu vertical doit être installé pour isoler thermiquement la canalisation des émanations de chaleur des câbles d'énergie HT/THT.",
    
    cable_aerial_cross_vertical: "Gabarit d'élévation aérienne : Distance verticale minimale d'au moins 8,00 m pour les lignes de tension < 50 kV, et 12,00 m pour les lignes ≥ 50 kV, mesurée sous flèche maximale des conducteurs électriques par temps chaud.",
    cable_aerial_cross_ground: "Servitude et distance d'implantation : Aucun support de ligne électrique (pylône de transport en treillis ou poteau en béton) ne doit être construit ou implanté à moins de 10,00 m de part et d'autre de l'axe de la conduite de gaz.",
    cable_aerial_cross_cathodic: "Mise à la terre équipotentielle & Cathodique : Les tensions d'induction et de foudre induites par les lignes HT aériennes de transport d'électricité sur l'acier du gazoduc doivent être drainées par des piquets de mise à la terre équipotentiels reliés à des déversoirs de surtension spécifiques.",

    // Sandbag Protection
    sandbag_barrage: "Barrage d'ancrage en sacs de sable : Placé tous les 10m à 15m dans les fortes pentes (> 15%) pour empêcher le sable et le remblai de glisser sous l'effet des eaux pluviales.",
    sandbag_slope: "Zone de forte pente : Supérieure à 15°. L'eau de pluie a tendance à s'infiltrer et à éroder la tranchée de l'intérieur, créant un ravinement interne destructif.",
    sandbag_bedding: "Criblage et lit de pose : Sable meuble d'une épaisseur de 10cm. Les sacs entourent la canalisation pour former un joint stable sans contrainte de frottement direct.",

    // Oued (Fascicule 7)
    oued_cover: "Couverture sous lit d'oued : Profondeur minimale h ≥ 1,50 m sous le lit stable estimé de l'oued. Peut aller jusqu'à 2,00 m en cas d'oued à fort débit ou érosion active.",
    oued_cavalier: "Cavaliers de lestage : Blocs en béton armé vibré dosé à 350 kg/m³, dimensionnés pour s'opposer à la force de flottaison (Principe d'Archimède) avec un coefficient de sécurité de 1.1.",
    oued_selle: "Bande d'isolation (Selle résiliente) : Feuille d'élastomère synthétique ou néoprène de 5 mm d'épaisseur enveloppant le tube sous le cavalier pour empêcher tout poinçonnement mécanique.",
    oued_slope: "Pente de raccordement des berges : Limitée à un angle maximal de 15° (approx 25% de déclivité) pour éviter l'éboulement et réduire les contraintes dues au tassement du sol.",

    // Massif d'Ancrage (Fascicule 7)
    ancrage_force: "Poussée hydraulique de calcul (Fp) : Résultante des forces de pression interne au niveau du coude. Calculée selon Fp = 2 * P * S * sin(θ/2) où θ est l'angle du coude.",
    ancrage_beton: "Béton de butée : Massif d'ancrage de type poids en béton armé dosé à 350 kg/m³. Coulé directement contre les parois de la fouille non remaniée pour maximiser la réaction passive du sol.",
    ancrage_joint: "Protection de paroi : Manchette en élastomère souple entourant le tube au passage du béton pour éviter le cisaillement du revêtement lors des mouvements de dilatation.",

    // Layout Poste
    poste_dalle: "Dalle principale du poste (C x D) : Dalle de fondation en béton armé d'épaisseur 25 cm, dosée à 350 kg/m³ de ciment. Reçoit l'abri d'exploitation du poste de détente.",
    poste_preheater: "Dalle des réchauffeurs (E x F) : Plateforme surélevée de 15 cm avec caniveaux pour l'installation des réchauffeurs de gaz de procédé.",
    poste_fence: "Périmètre clôturé (A x B) : Clôture réglementaire constituée de panneaux en treillis rigides doublés de poteaux métalliques avec fil de fer barbelé ou concertina.",

    // Bending Nomogram
    abaque_radius: "Rayon minimal réglementaire R = 30 * Dn : Aucun rayon de cintrage à froid ne doit être inférieur à cette limite afin de préserver l'intégrité de la structure moléculaire de l'acier.",
    abaque_angle: "Angle de cintrage par passe : Limité à un maximum de 1,5° pour les nuances X60/X70 et 2,0° pour le X52. Réduit considérablement les risques de plissement localisé.",

    // Gare de Racleur (Scraper Station)
    gare_sas: "Sas de chargement / réception (Barrel) : Cylindre de diamètre élargi raccordé au gazoduc principal, permettant l'insertion ou l'extraction en toute sécurité d'un racleur de nettoyage, de calibrage ou d'inspection intelligente.",
    gare_closure: "Porte à fermeture rapide filetée (Quick Opening Closure) : Hublot d'extrémité étanche avec loquet de sécurité d'interlock mécanique. Empêche l'ouverture physique du sas tant que la pression interne n'est pas tombée à 0 bar.",
    gare_bypass: "Vannes de by-pass et kickoff (Kicker lines) : Ensemble de piquages et de vannes papillon/boisseau sphérique permettant de dériver le flux de gaz sous pression derrière le racleur pour le propulser ou réceptionner.",
    gare_drain: "Ligne de vidange et de purge (Drain lines) : Orifices de vidange raccordés à des bacs de décantation fermés pour purger les condensats, les sédiments lourds, l'eau d'épreuve et les résidus de raclage.",
    gare_indicator: "Indicateur de passage de racleur (Pig Signaller) : Capteur à palettes bidirectionnel monté en sortie immédiate de gare, signalant par indicateur visuel rotatif ou contact électrique le passage effectif du racleur."
  };

  // Get active bending record
  const currentBendingRecord = COLD_BENDING_DATA.find(r => r.diameterInches === nomoInches) || COLD_BENDING_DATA[4];
  const dn_mm = currentBendingRecord ? Math.round(parseFloat(currentBendingRecord.diameterInches) * 25.4) : 323;
  const min_r_theory = currentBendingRecord ? (30 * dn_mm) / 1000 : 9.69;

  // Search filter for official blueprints gallery
  const filteredPlans = plansList.filter(plan => {
    const matchesSearch = 
      plan.title.toLowerCase().includes(gallerySearch.toLowerCase()) ||
      plan.caption.toLowerCase().includes(gallerySearch.toLowerCase()) ||
      plan.tags.some(t => t.toLowerCase().includes(gallerySearch.toLowerCase())) ||
      plan.category.toLowerCase().includes(gallerySearch.toLowerCase());
    
    if (galleryFilter === "Tous") return matchesSearch;
    return matchesSearch && plan.category === galleryFilter;
  });

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.4, 4));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const next = Math.max(prev - 0.4, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  return (
    <div id="visualiseur-schemas" className="space-y-6">
      
      {/* Visualizer Mode Switcher */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-slate-800">Recueil de Plans, Abaques & Dessins Techniques</h2>
          <p className="text-xs text-slate-500">Explorez les schémas réglementaires originaux et interactifs de la PD&I.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto flex-wrap gap-1 md:gap-0 shrink-0 border border-slate-200/50">
          <button
            onClick={() => setActiveTab("interactif")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "interactif" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1. Schémas Interactifs & Calculs</span>
          </button>
          <button
            onClick={() => setActiveTab("officiel")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "officiel" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>2. Galerie des Plans Officiels</span>
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("sync")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "sync" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Database className="w-3.5 h-3.5 text-orange-500" />
              <span>3. Gestion & Synchro Cloud</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === "interactif" ? (
        /* ==================== TAB 1: INTERACTIVE DIAGRAMS WITH HOTSPOTS ==================== */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Sidebar categories */}
          <div className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4 h-fit">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block px-1">Catégories de Schémas</span>
            
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase text-blue-500 bg-blue-50 px-2 py-0.5 rounded block w-fit">Ligne Courante</span>
              <button
                onClick={() => { setSelectedDiagram("trench"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "trench" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Profil de Tranchée</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => { setSelectedDiagram("sandbag"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "sandbag" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Protection forte pente</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => { setSelectedDiagram("crossing"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "crossing" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Traversée Route</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => { setSelectedDiagram("cable"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "cable" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Croisement Réseaux</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[9px] font-bold uppercase text-orange-500 bg-orange-50 px-2 py-0.5 rounded block w-fit">Ouvrages & Postes</span>
              
              <button
                onClick={() => { setSelectedDiagram("oued"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "oued" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Traversée d'Oued</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => { setSelectedDiagram("ancrage"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "ancrage" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Massif d'Ancrage</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => { setSelectedDiagram("poste_layout"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "poste_layout" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Implantation Poste</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => { setSelectedDiagram("gare_racleur"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "gare_racleur" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Gare de Racleur</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[9px] font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded block w-fit">Abaques Officiels</span>
              
              <button
                onClick={() => { setSelectedDiagram("bending_abaque"); setActiveTooltip(null); }}
                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedDiagram === "bending_abaque" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>Abaque de Cintrage</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>

          {/* SVG Canvas Board */}
          <div className="xl:col-span-2 bg-slate-900 rounded-2xl p-6 flex flex-col items-center justify-between min-h-[440px] border border-slate-800 relative overflow-hidden">
            {/* Subtle background blueprint grid */}
            <div className="absolute inset-0 bg-blueprint-grid opacity-10 pointer-events-none" />
            
            {/* Legend/Context Overlay */}
            <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-700/50 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 font-mono z-10">
              SPEC : <span className="text-orange-400 font-bold">PD&I MANUAL</span> | SCHÉMA : 
              <span className="text-white font-bold ml-1 uppercase">
                {selectedDiagram === "trench" && "T-01 PROFIL DE TRANCHÉE"}
                {selectedDiagram === "sandbag" && "T-02 PROTECTION FORTE PENTE SACS DE SABLE"}
                {selectedDiagram === "crossing" && "T-03 TRAVERSÉE ROUTE"}
                {selectedDiagram === "cable" && "T-04 CROISEMENT DE RÉSEAUX"}
                {selectedDiagram === "oued" && "A-05 TRAVERSÉE OUED & LESTAGE"}
                {selectedDiagram === "ancrage" && "A-06 MASSIF D'ANCRAGE COUDE"}
                {selectedDiagram === "poste_layout" && "GC-07 IMPLANTATION GÉNIE CIVIL POSTE"}
                {selectedDiagram === "bending_abaque" && "AB-08 ABAQUE DE CINTRAGE À FROID"}
                {selectedDiagram === "gare_racleur" && "GP-09 GARE DE RACLEUR EXPÉDITION / RÉCEPTION"}
              </span>
            </div>

            {/* Active Drawing Renderer */}
            <div className="w-full h-full flex items-center justify-center py-6">
              
              {selectedDiagram === "trench" && (
                <svg viewBox="0 0 400 350" className="w-full max-w-[380px] select-none">
                  {/* Real Word Document image inserted directly to prevent interpretation error */}
                  <image href={trenchImg} x="0" y="0" width="400" height="350" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />
                  <g display="none">
                    {/* Soil layers */}
                    <rect x="0" y="0" width="400" height="80" fill="#1e293b" opacity="0.4" />
                    <line x1="10" y1="80" x2="390" y2="80" stroke="#475569" strokeWidth="2" />
                    <path d="M 90 80 L 120 300 L 280 300 L 310 80" fill="none" stroke="#64748b" strokeWidth="2.5" />
                    
                    {/* Bedding layer */}
                    <rect x="120" y="270" width="160" height="30" fill="#eab308" fillOpacity="0.2" />
                    
                    {/* Pipe */}
                    <circle cx="200" cy="210" r="45" fill="#334155" stroke="#64748b" strokeWidth="3" />
                    <circle cx="200" cy="210" r="41" fill="#1e293b" stroke="#0284c7" strokeWidth="4" />
                    <circle cx="200" cy="210" r="3" fill="#e2e8f0" />
                    
                    {/* Warning Tape */}
                    <line x1="100" y1="120" x2="300" y2="120" stroke="#f97316" strokeWidth="3" strokeDasharray="5 4" />
                    
                    {/* Labels */}
                    <text x="200" y="213" fill="#fff" className="font-mono text-[9px] font-bold" textAnchor="middle">Ø CANALISATION</text>
                    <text x="200" y="288" fill="#eab308" className="font-mono text-[8px] font-bold" textAnchor="middle">LIT DE POSE (SABLE 10cm)</text>
                    <text x="200" y="110" fill="#f97316" className="font-mono text-[8px] font-bold" textAnchor="middle">GRILLAGE AVERTISSEUR ORANGE</text>
                    <text x="200" y="150" fill="#94a3b8" className="font-mono text-[8px]" textAnchor="middle">Remblai de terre tamisée (20cm)</text>

                    {/* Heights */}
                    <line x1="330" y1="80" x2="330" y2="165" stroke="#38bdf8" strokeWidth="1" />
                    <polygon points="330,80 327,86 333,86" fill="#38bdf8" />
                    <polygon points="330,165 327,159 333,159" fill="#38bdf8" />
                    <text x="340" y="125" fill="#38bdf8" className="font-mono text-[9px] font-bold">h ≥ 1.00m</text>
                  </g>

                  {/* Hotspots */}
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("h_recouvrement")}>
                    <circle cx="330" cy="120" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                    <text x="330" y="123" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("lit_pose")}>
                    <circle cx="200" cy="290" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="200" y="293" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("remblai")}>
                    <circle cx="200" cy="145" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="200" y="148" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                  </g>
                </svg>
              )}

              {selectedDiagram === "sandbag" && (
                <svg viewBox="0 0 400 350" className="w-full max-w-[380px] select-none">
                  {/* Real Word Document image inserted directly to prevent interpretation error */}
                  <image href={sandbagImg} x="0" y="0" width="400" height="350" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                  <g display="none">
                    {/* Slope line */}
                    <path d="M 0 100 L 400 240" stroke="#475569" strokeWidth="3" strokeDasharray="3 3" />
                    <path d="M 0 130 L 400 270" stroke="#64748b" strokeWidth="2.5" />
                    
                    {/* Diagonal Pipe */}
                    <path d="M 0 190 L 400 330" stroke="#0284c7" strokeWidth="14" strokeLinecap="round" />
                    <path d="M 0 190 L 400 330" stroke="#334155" strokeWidth="18" strokeOpacity="0.25" strokeLinecap="round" />
                    
                    {/* Sandbags Stack 1 */}
                    <g fill="#9a3412" stroke="#451a03" strokeWidth="1">
                      <rect x="120" y="150" width="30" height="15" rx="3" />
                      <rect x="110" y="165" width="30" height="15" rx="3" />
                      <rect x="135" y="165" width="30" height="15" rx="3" />
                      <rect x="105" y="180" width="30" height="15" rx="3" />
                      <rect x="130" y="180" width="30" height="15" rx="3" />
                      <rect x="155" y="180" width="30" height="15" rx="3" />
                    </g>

                    {/* Sandbags Stack 2 */}
                    <g fill="#9a3412" stroke="#451a03" strokeWidth="1">
                      <rect x="290" y="210" width="30" height="15" rx="3" />
                      <rect x="280" y="225" width="30" height="15" rx="3" />
                      <rect x="305" y="225" width="30" height="15" rx="3" />
                      <rect x="275" y="240" width="30" height="15" rx="3" />
                      <rect x="300" y="240" width="30" height="15" rx="3" />
                      <rect x="325" y="240" width="30" height="15" rx="3" />
                    </g>

                    {/* Text labels */}
                    <text x="200" y="310" fill="#fff" className="font-mono text-[9px] font-bold" textAnchor="middle">GAZODUC EN PENTE (&gt; 15%)</text>
                    <text x="135" y="130" fill="#f59e0b" className="font-mono text-[8.5px] font-bold" textAnchor="middle">SACS DE SABLE COULÉS</text>
                    <text x="200" y="75" fill="#ea580c" className="font-mono text-[9px] font-extrabold" textAnchor="middle">PENTE SANS RAVINEMENT INTERNE</text>
                  </g>

                  {/* Hotspots */}
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("sandbag_barrage")}>
                    <circle cx="130" cy="180" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                    <text x="130" y="183" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("sandbag_slope")}>
                    <circle cx="200" cy="95" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="200" y="98" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("sandbag_bedding")}>
                    <circle cx="220" cy="270" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="220" y="273" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                  </g>
                </svg>
              )}

              {selectedDiagram === "crossing" && (
                <svg viewBox="0 0 450 320" className="w-full max-w-[400px] select-none">
                  {/* Real Word Document image inserted directly to prevent interpretation error */}
                  <image href={crossingImg} x="0" y="0" width="450" height="320" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                  <g display="none">
                    <rect x="110" y="40" width="230" height="40" fill="#334155" rx="2" />
                    <line x1="110" y1="60" x2="340" y2="60" stroke="#cbd5e1" strokeDasharray="6 4" strokeWidth="1.5" />
                    <text x="225" y="55" fill="#94a3b8" className="font-mono text-[9px] font-black" textAnchor="middle">CHAUSSÉE ROUTIÈRE</text>

                    <rect x="15" y="80" width="95" height="200" fill="#1e293b" opacity="0.3" />
                    <rect x="340" y="80" width="95" height="200" fill="#1e293b" opacity="0.3" />

                    {/* Gaine */}
                    <rect x="75" y="130" width="300" height="60" fill="#475569" fillOpacity="0.6" stroke="#64748b" strokeWidth="2" />
                    
                    {/* Carrier tube */}
                    <rect x="30" y="145" width="390" height="30" fill="#0284c7" fillOpacity="0.8" stroke="#0284c7" strokeWidth="2" />
                    <text x="225" y="163" fill="#fff" className="font-mono text-[9px] font-bold" textAnchor="middle">CONDUITE DE GAZ EN ACIER</text>

                    {/* Obturateurs */}
                    <rect x="75" y="130" width="10" height="60" fill="#ea580c" />
                    <rect x="365" y="130" width="10" height="60" fill="#ea580c" />

                    {/* Spacers */}
                    <line x1="130" y1="130" x2="130" y2="190" stroke="#f59e0b" strokeWidth="3" />
                    <line x1="220" y1="130" x2="220" y2="190" stroke="#f59e0b" strokeWidth="3" />
                    <line x1="310" y1="130" x2="310" y2="190" stroke="#f59e0b" strokeWidth="3" />

                    {/* Reniflard */}
                    <path d="M 90 130 L 90 25 L 50 25 L 50 35" fill="none" stroke="#64748b" strokeWidth="1.5" />
                    <circle cx="50" cy="35" r="3" fill="#64748b" />
                    <text x="90" y="18" fill="#94a3b8" className="font-mono text-[8px]" textAnchor="middle">RENIFLARD</text>
                  </g>

                  {/* Hotspots */}
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("gaine")}>
                    <circle cx="225" cy="180" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                    <text x="225" y="183" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("obturateur")}>
                    <circle cx="80" cy="160" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="80" y="163" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("collier")}>
                    <circle cx="130" cy="160" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="130" y="163" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("reniflard")}>
                    <circle cx="50" cy="25" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="50" y="28" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">4</text>
                  </g>
                </svg>
              )}

              {selectedDiagram === "cable" && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  {/* Cable Crossing Sub-tabs */}
                  <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 space-x-1 shrink-0 z-10">
                    <button
                      onClick={() => { setCableSubTab("souterrain_croise"); setActiveTooltip(null); }}
                      className={`px-2.5 py-1 text-[8.5px] rounded-md font-bold uppercase transition-all ${
                        cableSubTab === "souterrain_croise" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Croisement Souterrain
                    </button>
                    <button
                      onClick={() => { setCableSubTab("souterrain_parallele"); setActiveTooltip(null); }}
                      className={`px-2.5 py-1 text-[8.5px] rounded-md font-bold uppercase transition-all ${
                        cableSubTab === "souterrain_parallele" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Parallélisme Souterrain
                    </button>
                    <button
                      onClick={() => { setCableSubTab("aerien"); setActiveTooltip(null); }}
                      className={`px-2.5 py-1 text-[8.5px] rounded-md font-bold uppercase transition-all ${
                        cableSubTab === "aerien" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Ligne Aérienne HT
                    </button>
                  </div>

                  {/* SVG drawing container based on sub-tab */}
                  {cableSubTab === "souterrain_croise" && (
                    <svg viewBox="0 0 400 320" className="w-full max-w-[380px] select-none">
                      {/* Real Word Document image inserted directly to prevent interpretation error */}
                      <image href={cableImg} x="0" y="0" width="400" height="320" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                      <g display="none">
                        <rect x="10" y="50" width="380" height="250" fill="#1e293b" opacity="0.2" />
                        <line x1="10" y1="50" x2="390" y2="50" stroke="#475569" strokeWidth="2" />

                        {/* Gas Pipe */}
                        <circle cx="200" cy="140" r="35" fill="#334155" stroke="#64748b" strokeWidth="2" />
                        <circle cx="200" cy="140" r="31" fill="#0284c7" />
                        <text x="200" y="143" fill="#fff" className="font-mono text-[8px] font-black" textAnchor="middle">GAZODUC ACIER</text>

                        {/* Warning grids */}
                        {/* Orange for gas */}
                        <line x1="100" y1="90" x2="300" y2="90" stroke="#ea580c" strokeWidth="3" strokeDasharray="5 3" />
                        <text x="200" y="82" fill="#ea580c" className="font-mono text-[7.5px] font-bold" textAnchor="middle">GRILLAGE JAUNE/ORANGE (GAZ)</text>

                        {/* Red for electricity */}
                        <line x1="100" y1="210" x2="300" y2="210" stroke="#dc2626" strokeWidth="3" strokeDasharray="5 3" />
                        <text x="200" y="202" fill="#dc2626" className="font-mono text-[7.5px] font-bold" textAnchor="middle">GRILLAGE ROUGE (ÉLECTRICITÉ)</text>

                        {/* Cable below */}
                        <rect x="100" y="235" width="200" height="15" fill="#dc2626" rx="2" />
                        <text x="200" y="246" fill="#fff" className="font-mono text-[8px] font-bold" textAnchor="middle">CÂBLE ÉLECTRIQUE TIER (HT/MT)</text>

                        {/* Concrete protective slab in between */}
                        <rect x="110" y="185" width="180" height="10" fill="#64748b" fillOpacity="0.8" stroke="#475569" strokeWidth="1" rx="1" />
                        <text x="200" y="193" fill="#f8fafc" className="font-mono text-[7px] font-bold animate-pulse" textAnchor="middle">DALLE DE PROTECTION BÉTON (5cm)</text>

                        {/* Dimensions arrows */}
                        {/* Vertical gap E >= 0.50m */}
                        <line x1="310" y1="140" x2="310" y2="235" stroke="#38bdf8" strokeWidth="1.5" />
                        <polygon points="310,140 307,146 313,146" fill="#38bdf8" />
                        <polygon points="310,235 307,229 313,229" fill="#38bdf8" />
                        <text x="320" y="190" fill="#38bdf8" className="font-mono text-[8.5px] font-bold">E ≥ 0.50m</text>
                      </g>

                      {/* Hotspots */}
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_underground_cross_clearance")}>
                        <circle cx="310" cy="180" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                        <text x="310" y="183" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                      </g>
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_underground_cross_dalle")}>
                        <circle cx="200" cy="190" r="11" fill="#ea580c" fillOpacity="0.9" />
                        <text x="200" y="193" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                      </g>
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_underground_cross_sheath")}>
                        <circle cx="200" cy="242" r="11" fill="#ea580c" fillOpacity="0.9" />
                        <text x="200" y="245" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                      </g>
                    </svg>
                  )}

                  {cableSubTab === "souterrain_parallele" && (
                    <svg viewBox="0 0 400 320" className="w-full max-w-[380px] select-none">
                      {/* Real Word Document image inserted directly to prevent interpretation error */}
                      <image href={cableImg} x="0" y="0" width="400" height="320" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                      <g display="none">
                        <rect x="10" y="50" width="380" height="250" fill="#1e293b" opacity="0.2" />
                        <line x1="10" y1="50" x2="390" y2="50" stroke="#475569" strokeWidth="2" />

                        {/* Gas Pipe (Left side) */}
                        <g transform="translate(100, 160)">
                          <circle cx="0" cy="0" r="32" fill="#334155" stroke="#64748b" strokeWidth="2" />
                          <circle cx="0" cy="0" r="28" fill="#0284c7" />
                          <text x="0" y="3" fill="#fff" className="font-mono text-[7px] font-black" textAnchor="middle">GAZODUC</text>
                          {/* Warning tape */}
                          <line x1="-50" y1="-50" x2="50" y2="-50" stroke="#ea580c" strokeWidth="2" strokeDasharray="4 2" />
                          <text x="0" y="-56" fill="#ea580c" className="font-mono text-[6.5px]" textAnchor="middle">GRILLAGE GAZ</text>
                        </g>

                        {/* Cable (Right side) */}
                        <g transform="translate(280, 160)">
                          <rect x="-20" y="-20" width="40" height="40" fill="#dc2626" rx="3" stroke="#991b1b" strokeWidth="1.5" />
                          <circle cx="0" cy="0" r="10" fill="#fef08a" />
                          <text x="0" y="3" fill="#1e293b" className="font-mono text-[7px] font-extrabold" textAnchor="middle">HT/MT</text>
                          {/* Warning tape */}
                          <line x1="-50" y1="-50" x2="50" y2="-50" stroke="#dc2626" strokeWidth="2" strokeDasharray="4 2" />
                          <text x="0" y="-56" fill="#dc2626" className="font-mono text-[6.5px]" textAnchor="middle">GRILLAGE ELEC</text>
                        </g>

                        {/* Continuous separating vertical concrete barrier */}
                        <rect x="185" y="80" width="12" height="180" fill="#64748b" fillOpacity="0.9" stroke="#334155" strokeWidth="1" />
                        <text x="191" y="170" fill="#fff" className="font-mono text-[7.5px] font-bold" textAnchor="middle" transform="rotate(-90, 191, 170)">BARRIÈRE ISOLANTE (CONDUITE SERRÉE)</text>

                        {/* Dimension Arrow 1.00m */}
                        <line x1="100" y1="210" x2="280" y2="210" stroke="#38bdf8" strokeWidth="1.5" />
                        <polygon points="100,210 106,207 106,213" fill="#38bdf8" />
                        <polygon points="280,210 274,207 274,213" fill="#38bdf8" />
                        <text x="190" y="224" fill="#38bdf8" className="font-mono text-[8.5px] font-bold" textAnchor="middle">D ≥ 1.00m (Réduit à 0.50m avec écran)</text>
                      </g>

                      {/* Hotspots */}
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_underground_para_dist")}>
                        <circle cx="140" cy="210" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                        <text x="140" y="213" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                      </g>
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_underground_para_heat")}>
                        <circle cx="191" cy="110" r="11" fill="#ea580c" fillOpacity="0.9" />
                        <text x="191" y="113" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                      </g>
                    </svg>
                  )}

                  {cableSubTab === "aerien" && (
                    <svg viewBox="0 0 420 320" className="w-full max-w-[380px] select-none">
                      {/* Real Word Document image inserted directly to prevent interpretation error */}
                      <image href={cableImg} x="0" y="0" width="420" height="320" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                      <g display="none">
                        <rect x="10" y="50" width="400" height="250" fill="#1e293b" opacity="0.2" />
                        
                        {/* Pylon / Tower on the left */}
                        <g transform="translate(80, 50)" stroke="#94a3b8" strokeWidth="1.5" fill="none">
                          {/* Pylon framework */}
                          <line x1="0" y1="200" x2="20" y2="0" />
                          <line x1="40" y1="200" x2="20" y2="0" strokeWidth="2" />
                          {/* Cross lattices */}
                          <line x1="5" y1="150" x2="35" y2="150" />
                          <line x1="10" y1="100" x2="30" y2="100" />
                          <line x1="15" y1="50" x2="25" y2="50" />
                          <line x1="0" y1="200" x2="30" y2="100" />
                          <line x1="40" y1="200" x2="10" y2="100" />
                          <line x1="10" y1="100" x2="25" y2="50" />
                          <line x1="30" y1="100" x2="15" y2="50" />
                          
                          {/* Horizontal arms */}
                          <line x1="-15" y1="60" x2="55" y2="60" strokeWidth="2" />
                          <line x1="-10" y1="110" x2="50" y2="110" strokeWidth="2" />

                          {/* Insulators and Lines */}
                          <line x1="-15" y1="60" x2="-15" y2="75" stroke="#ef4444" strokeWidth="2" />
                          <line x1="55" y1="60" x2="55" y2="75" stroke="#ef4444" strokeWidth="2" />
                          <circle cx="-15" cy="75" r="2" fill="#ef4444" />
                          <circle cx="55" cy="75" r="2" fill="#ef4444" />
                        </g>

                        {/* Overhead electrical wires dangles */}
                        <path d="M 65 125 Q 240 135 410 115" fill="none" stroke="#fca5a5" strokeWidth="2" />
                        <path d="M 135 110 Q 260 120 410 100" fill="none" stroke="#fca5a5" strokeWidth="2" />
                        <text x="320" y="90" fill="#fca5a5" className="font-mono text-[7px]" textAnchor="middle">LIGNE AÉRIENNE HTA/HTB</text>

                        {/* Ground line */}
                        <line x1="10" y1="220" x2="410" y2="220" stroke="#475569" strokeWidth="2" />
                        <rect x="10" y="221" width="400" height="79" fill="#1e293b" opacity="0.4" />
                        <text x="320" y="235" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="middle">TERRAIN NATUREL</text>

                        {/* Buried Gazoduc below */}
                        <circle cx="280" cy="265" r="18" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                        <circle cx="280" cy="265" r="15" fill="#0284c7" />
                        <text x="280" y="268" fill="#fff" className="font-mono text-[6px] font-black" textAnchor="middle">GAZ</text>

                        {/* Grounding rods & equipotential ring */}
                        <g stroke="#22c55e" strokeWidth="1">
                          <line x1="280" y1="283" x2="280" y2="295" />
                          <line x1="262" y1="265" x2="250" y2="265" />
                          <line x1="250" y1="265" x2="250" y2="295" />
                          {/* Grounding symbol */}
                          <line x1="240" y1="295" x2="260" y2="295" strokeWidth="1.5" />
                          <line x1="244" y1="298" x2="256" y2="298" />
                          <line x1="248" y1="301" x2="252" y2="301" />
                        </g>
                        <text x="235" y="285" fill="#22c55e" className="font-mono text-[6.5px] font-bold" textAnchor="end">DÉVERSOIR DE TENSION INDUITE</text>

                        {/* Dimension 1: Vertical gap wire to ground */}
                        <line x1="240" y1="130" x2="240" y2="220" stroke="#38bdf8" strokeWidth="1.5" />
                        <polygon points="240,130 237,136 243,136" fill="#38bdf8" />
                        <polygon points="240,220 237,214 243,214" fill="#38bdf8" />
                        <text x="230" y="180" fill="#38bdf8" className="font-mono text-[8px] font-bold" textAnchor="end">H ≥ 8.00m / 12.00m</text>

                        {/* Dimension 2: Pylon distance to tube axis */}
                        <line x1="100" y1="210" x2="280" y2="210" stroke="#eab308" strokeWidth="1.2" strokeDasharray="3 2" />
                        <polygon points="100,210 106,207 106,213" fill="#eab308" />
                        <polygon points="280,210 274,207 274,213" fill="#eab308" />
                        <text x="180" y="202" fill="#eab308" className="font-mono text-[7.5px] font-bold" textAnchor="middle">D ≥ 10.00m (Éloignement Pylône)</text>
                      </g>

                      {/* Hotspots */}
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_aerial_cross_vertical")}>
                        <circle cx="240" cy="170" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                        <text x="240" y="173" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                      </g>
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_aerial_cross_ground")}>
                        <circle cx="160" cy="210" r="11" fill="#ea580c" fillOpacity="0.9" />
                        <text x="160" y="213" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                      </g>
                      <g className="cursor-pointer" onClick={() => setActiveTooltip("cable_aerial_cross_cathodic")}>
                        <circle cx="250" cy="285" r="11" fill="#ea580c" fillOpacity="0.9" />
                        <text x="250" y="288" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                      </g>
                    </svg>
                  )}
                </div>
              )}

              {selectedDiagram === "oued" && (
                <svg viewBox="0 0 500 350" className="w-full max-w-[420px] select-none">
                  {/* Real Word Document image inserted directly to prevent interpretation error */}
                  <image href={ouedImg} x="0" y="0" width="500" height="350" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                  <g display="none">
                    {/* Water */}
                    <path d="M 0 100 Q 125 75 250 100 T 500 100 L 500 130 L 0 130 Z" fill="#0284c7" fillOpacity="0.3" />
                    <path d="M 0 115 Q 125 90 250 115 T 500 115" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeOpacity="0.5" />

                    {/* River soil */}
                    <path d="M 0 160 L 120 220 L 380 220 L 500 160 L 500 350 L 0 350 Z" fill="#1e293b" opacity="0.3" stroke="#64748b" strokeWidth="2" />
                    
                    {/* Pipeline */}
                    <rect x="0" y="270" width="500" height="24" fill="#38bdf8" fillOpacity="0.6" stroke="#0284c7" strokeWidth="2" />

                    {/* Cavaliers */}
                    <rect x="150" y="240" width="40" height="30" fill="#94a3b8" rx="2" stroke="#475569" strokeWidth="1.5" />
                    <rect x="310" y="240" width="40" height="30" fill="#94a3b8" rx="2" stroke="#475569" strokeWidth="1.5" />

                    {/* Selles */}
                    <rect x="150" y="268" width="40" height="3" fill="#ea580c" />
                    <rect x="310" y="268" width="40" height="3" fill="#ea580c" />

                    {/* Slope */}
                    <text x="440" y="210" fill="#f59e0b" className="font-mono text-[8px] font-bold">Pente max 15°</text>

                    {/* Cover */}
                    <line x1="250" y1="220" x2="250" y2="270" stroke="#ef4444" strokeWidth="1.5" />
                    <polygon points="250,220 247,226 253,226" fill="#ef4444" />
                    <polygon points="250,270 247,264 253,264" fill="#ef4444" />
                    <text x="260" y="245" fill="#ef4444" className="font-mono text-[8px] font-black">h ≥ 1.50m</text>
                  </g>

                  {/* Hotspots */}
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("oued_cover")}>
                    <circle cx="250" cy="235" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                    <text x="250" y="238" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("oued_cavalier")}>
                    <circle cx="170" cy="250" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="170" y="253" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("oued_selle")}>
                    <circle cx="170" cy="275" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="170" y="278" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("oued_slope")}>
                    <circle cx="430" cy="195" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="430" y="198" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">4</text>
                  </g>
                </svg>
              )}

              {selectedDiagram === "ancrage" && (
                <svg viewBox="0 0 450 350" className="w-full max-w-[380px] select-none">
                  {/* Real Word Document image inserted directly to prevent interpretation error */}
                  <image href={ouedImg} x="0" y="0" width="450" height="350" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                  <g display="none">
                    <rect x="10" y="40" width="430" height="290" fill="#1e293b" opacity="0.15" />
                    
                    {/* Excavation */}
                    <path d="M 80 40 L 100 290 L 320 290 L 350 40" fill="none" stroke="#cbd5e1" strokeDasharray="4 2" strokeWidth="1.5" />

                    {/* Massif */}
                    <path d="M 110 90 L 300 90 L 290 280 L 120 280 Z" fill="#64748b" fillOpacity="0.5" stroke="#475569" strokeWidth="3" />
                    <text x="205" y="125" fill="#f1f5f9" className="font-mono text-[9px] font-black" textAnchor="middle">MASSIF DE BÉTON</text>

                    {/* Tube entry */}
                    <path d="M 40 180 Q 205 180 205 320" fill="none" stroke="#38bdf8" strokeWidth="24" strokeLinecap="square" />
                    <path d="M 40 180 Q 205 180 205 320" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="square" />

                    {/* Thrust vectors */}
                    <line x1="170" y1="150" x2="250" y2="100" stroke="#f43f5e" strokeWidth="4.5" />
                    <polygon points="250,100 240,100 245,108" fill="#f43f5e" transform="rotate(-32, 250, 100)" />
                    <text x="250" y="85" fill="#f43f5e" className="font-mono text-[9px] font-black">Poussée Hydraulique (Fp)</text>
                  </g>

                  {/* Hotspots */}
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("ancrage_force")}>
                    <circle cx="210" cy="125" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                    <text x="210" y="128" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("ancrage_beton")}>
                    <circle cx="205" cy="220" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="205" y="223" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("ancrage_joint")}>
                    <circle cx="110" cy="180" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="110" y="183" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                  </g>
                </svg>
              )}

              {selectedDiagram === "poste_layout" && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 space-x-1 shrink-0">
                    {["small", "medium", "large"].map((cap) => (
                      <button
                        key={cap}
                        onClick={() => setStationCapacity(cap as any)}
                        className={`px-2.5 py-1 text-[8px] rounded-md font-bold uppercase transition-all ${
                          stationCapacity === cap ? "bg-orange-500 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {cap === "small" ? "2500 - 5000" : cap === "medium" ? "10000 - 20000" : "20000 - 30000"} Nm³/h
                      </button>
                    ))}
                  </div>

                  <svg viewBox="0 0 500 320" className="w-full max-w-[420px] select-none">
                    {/* Real Word Document image inserted directly to prevent interpretation error */}
                    <image href={posteImg} x="0" y="0" width="500" height="320" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                    <g display="none">
                      <rect x="0" y="0" width="500" height="320" fill="#1e293b" opacity="0.1" />

                      {/* Fence */}
                      <rect x="30" y="30" width="440" height="260" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="5 3" />
                      <text x="250" y="22" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="middle">DOUBLE CLÔTURE DE SÉCURITÉ ({currentDims.A}m x {currentDims.B}m)</text>

                      {/* Slab */}
                      <rect x="60" y="80" width="220" height="120" fill="#64748b" fillOpacity="0.4" stroke="#64748b" strokeWidth="2" />
                      <text x="170" y="135" fill="#f8fafc" className="font-mono text-[8.5px] font-black" textAnchor="middle">DALLE DE L'ABRI DE DÉTENTE</text>
                      <text x="170" y="150" fill="#cbd5e1" className="font-mono text-[7.5px]" textAnchor="middle">{currentDims.C}m x {currentDims.D}m</text>

                      {/* Preheater */}
                      <rect x="310" y="100" width="130" height="80" fill="#64748b" fillOpacity="0.4" stroke="#64748b" strokeWidth="2" />
                      <text x="375" y="135" fill="#f8fafc" className="font-mono text-[8.5px] font-black" textAnchor="middle">RECHAUFFEURS</text>
                      <text x="375" y="150" fill="#cbd5e1" className="font-mono text-[7.5px]" textAnchor="middle">{currentDims.E}m x {currentDims.F}m</text>

                      {/* Pipes */}
                      <path d="M 0 140 L 60 140" fill="none" stroke="#ea580c" strokeWidth="4.5" />
                      <path d="M 280 140 L 310 140 M 440 140 L 500 140" fill="none" stroke="#38bdf8" strokeWidth="4" />
                    </g>

                    {/* Hotspots */}
                    <g className="cursor-pointer" onClick={() => setActiveTooltip("poste_dalle")}>
                      <circle cx="170" cy="165" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                      <text x="170" y="168" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                    </g>
                    <g className="cursor-pointer" onClick={() => setActiveTooltip("poste_preheater")}>
                      <circle cx="375" cy="165" r="11" fill="#ea580c" fillOpacity="0.9" />
                      <text x="375" y="168" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                    </g>
                    <g className="cursor-pointer" onClick={() => setActiveTooltip("poste_fence")}>
                      <circle cx="470" cy="160" r="11" fill="#ea580c" fillOpacity="0.9" />
                      <text x="470" y="163" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                    </g>
                  </svg>
                </div>
              )}

              {selectedDiagram === "bending_abaque" && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  {/* Diameter Select */}
                  <div className="flex flex-wrap gap-1.5 justify-center bg-slate-800 p-2 rounded-xl border border-slate-700 shrink-0 max-w-[420px]">
                    {COLD_BENDING_DATA.slice(2, 8).map((record) => (
                      <button
                        key={record.diameterInches}
                        onClick={() => { setNomoInches(record.diameterInches); setActiveTooltip(null); }}
                        className={`px-2 py-1 text-[8.5px] rounded font-mono font-bold uppercase transition-all ${
                          nomoInches === record.diameterInches ? "bg-green-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Dn {record.diameterInches}
                      </button>
                    ))}
                  </div>

                  <svg viewBox="0 0 420 280" className="w-full max-w-[380px] select-none">
                    {/* Real Word Document image inserted directly to prevent interpretation error */}
                    <image href={bendingImg} x="0" y="0" width="420" height="280" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                    <g display="none">
                      {/* Grid */}
                      <g stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3">
                        <line x1="50" y1="30" x2="380" y2="30" />
                        <line x1="50" y1="80" x2="380" y2="80" />
                        <line x1="50" y1="130" x2="380" y2="130" />
                        <line x1="50" y1="180" x2="380" y2="180" />
                        <line x1="50" y1="230" x2="380" y2="230" />
                        
                        <line x1="100" y1="30" x2="100" y2="230" />
                        <line x1="170" y1="30" x2="170" y2="230" />
                        <line x1="240" y1="30" x2="240" y2="230" />
                        <line x1="310" y1="30" x2="310" y2="230" />
                        <line x1="380" y1="30" x2="380" y2="230" />
                      </g>

                      {/* Axis */}
                      <line x1="50" y1="30" x2="50" y2="230" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="50" y1="230" x2="380" y2="230" stroke="#94a3b8" strokeWidth="1.5" />

                      <text x="40" y="234" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="end">0 m</text>
                      <text x="40" y="184" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="end">10 m</text>
                      <text x="40" y="134" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="end">20 m</text>
                      <text x="40" y="84" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="end">30 m</text>
                      <text x="215" y="244" fill="#94a3b8" className="font-mono text-[7px] font-bold" textAnchor="middle">Diamètre nominal externe Dn (Pouces)</text>
                      <text x="35" y="130" fill="#94a3b8" className="font-mono text-[7px] font-bold" textAnchor="middle" transform="rotate(-90, 35, 130)">Rayon de Cintrage Min (m)</text>

                      {/* Curves plotting */}
                      {/* Limit R = 30 * Dn curve */}
                      <path d="M 50 230 Q 180 150 380 50" fill="none" stroke="#22c55e" strokeWidth="2.5" />
                      <text x="360" y="40" fill="#22c55e" className="font-mono text-[7px] font-bold" textAnchor="end">Min R = 30 * Dn (REGLEMENTAIRE)</text>

                      {/* Interactive dot plot based on selected Dn */}
                      {(() => {
                        const x_val = 50 + (dn_mm / 1000) * 400; // mapped to fit scale
                        const y_val = 230 - min_r_theory * 5; // mapped to fit scale
                        return (
                          <g>
                            <line x1={x_val} y1="230" x2={x_val} y2={y_val} stroke="#eab308" strokeWidth="1" strokeDasharray="2 2" />
                            <line x1="50" y1={y_val} x2={x_val} y2={y_val} stroke="#eab308" strokeWidth="1" strokeDasharray="2 2" />
                            <circle cx={x_val} cy={y_val} r="7" fill="#eab308" className="animate-ping" />
                            <circle cx={x_val} cy={y_val} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                          </g>
                        );
                      })()}
                    </g>

                    {/* Hotspots */}
                    <g className="cursor-pointer" onClick={() => setActiveTooltip("abaque_radius")}>
                      <circle cx="200" cy="160" r="11" fill="#ea580c" fillOpacity="0.9" />
                      <text x="200" y="163" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                    </g>
                    <g className="cursor-pointer" onClick={() => setActiveTooltip("abaque_angle")}>
                      <circle cx="320" cy="80" r="11" fill="#ea580c" fillOpacity="0.9" />
                      <text x="320" y="83" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                    </g>
                  </svg>
                </div>
              )}

              {selectedDiagram === "gare_racleur" && (
                <svg viewBox="0 0 500 350" className="w-full max-w-[440px] select-none">
                  {/* Real Word Document image inserted directly to prevent interpretation error */}
                  <image href={posteImg} x="0" y="0" width="500" height="350" preserveAspectRatio="xMidYMid meet" className="rounded-xl opacity-95" />

                  <g display="none">
                    {/* Blueprint backplane */}
                    <rect x="10" y="40" width="480" height="280" fill="#1e293b" opacity="0.15" />
                    
                    {/* Concrete Supports */}
                    <rect x="110" y="240" width="40" height="40" fill="#475569" rx="2" />
                    <rect x="330" y="240" width="40" height="40" fill="#475569" rx="2" />
                    <text x="130" y="265" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="middle">SUPPORT</text>
                    <text x="350" y="265" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="middle">SUPPORT</text>
                    
                    {/* Main pipeline going right */}
                    <path d="M 120 180 L 500 180" fill="none" stroke="#334155" strokeWidth="16" />
                    <path d="M 120 180 L 500 180" fill="none" stroke="#0284c7" strokeWidth="12" />
                    <text x="440" y="205" fill="#0284c7" className="font-mono text-[8px] font-black" textAnchor="middle">VERS LIGNE COURANTE</text>

                    {/* Reducer / Enlarged Barrel (Sas) */}
                    <path d="M 80 180 L 120 180" fill="none" stroke="#0f172a" strokeWidth="26" />
                    <path d="M 80 180 L 120 180" fill="none" stroke="#0ea5e9" strokeWidth="22" />
                    
                    {/* Barrel Body */}
                    <rect x="20" y="160" width="60" height="40" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" rx="4" />
                    <text x="50" y="185" fill="#fff" className="font-mono text-[9px] font-black" textAnchor="middle">SAS (BARREL)</text>

                    {/* Quick-opening Door (Porte de fermeture rapide) */}
                    <rect x="5" y="155" width="15" height="50" fill="#f59e0b" stroke="#d97706" strokeWidth="2" rx="2" />
                    {/* Door Handle wheel */}
                    <circle cx="12" cy="180" r="10" fill="none" stroke="#fff" strokeWidth="2.5" />
                    <line x1="12" y1="170" x2="12" y2="190" stroke="#fff" strokeWidth="2.5" />
                    <line x1="2" y1="180" x2="22" y2="180" stroke="#fff" strokeWidth="2.5" />

                    {/* Kicker Line / Bypass loop */}
                    <path d="M 350 180 L 350 100 L 70 100 L 70 160" fill="none" stroke="#0284c7" strokeWidth="8" />
                    
                    {/* Bypass Valves */}
                    {/* Kickoff Valve */}
                    <g transform="translate(200, 100)">
                      <polygon points="-10,-8 10,8 10,-8 -10,8" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
                      <circle cx="0" cy="0" r="4" fill="#38bdf8" />
                      <rect x="-2" y="-14" width="4" height="8" fill="#475569" />
                      <text x="0" y="-18" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="middle">Vanne Kickoff</text>
                    </g>
                    
                    {/* Main Line isolation valve */}
                    <g transform="translate(260, 180)">
                      <polygon points="-12,-10 12,10 12,-10 -12,10" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
                      <circle cx="0" cy="0" r="5" fill="#ef4444" />
                      <rect x="-3" y="-18" width="6" height="10" fill="#475569" />
                      <text x="0" y="24" fill="#94a3b8" className="font-mono text-[7px]" textAnchor="middle">Vanne de Ligne</text>
                    </g>

                    {/* Vent / Event connections */}
                    <line x1="50" y1="160" x2="50" y2="120" stroke="#0284c7" strokeWidth="4" />
                    <circle cx="50" cy="115" r="5" fill="#10b981" />
                    <text x="50" y="105" fill="#10b981" className="font-mono text-[7px] font-bold" textAnchor="middle">ÉVENT</text>

                    {/* Drain / Vidange connections */}
                    <line x1="50" y1="200" x2="50" y2="240" stroke="#0284c7" strokeWidth="4" />
                    <circle cx="50" cy="245" r="5" fill="#ea580c" />
                    <text x="50" y="260" fill="#ea580c" className="font-mono text-[7px] font-bold" textAnchor="middle">DRAIN / PURGE</text>

                    {/* Pig Signaller (Indicateur de passage) */}
                    <g transform="translate(400, 172)">
                      <line x1="0" y1="0" x2="0" y2="-20" stroke="#eab308" strokeWidth="2.5" />
                      <polygon points="-6,-20 6,-20 0,-28" fill="#eab308" />
                      <text x="0" y="-32" fill="#eab308" className="font-mono text-[7.5px] font-bold" textAnchor="middle">PIG SIGNALLER</text>
                    </g>
                  </g>

                  {/* Hotspots */}
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("gare_sas")}>
                    <circle cx="50" cy="180" r="11" fill="#ea580c" fillOpacity="0.9" className="animate-pulse" />
                    <text x="50" y="183" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">1</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("gare_closure")}>
                    <circle cx="12" cy="180" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="12" y="183" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">2</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("gare_bypass")}>
                    <circle cx="200" cy="100" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="200" y="103" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">3</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("gare_drain")}>
                    <circle cx="50" cy="245" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="50" y="248" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">4</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setActiveTooltip("gare_indicator")}>
                    <circle cx="400" cy="165" r="11" fill="#ea580c" fillOpacity="0.9" />
                    <text x="400" y="168" fill="#fff" className="font-extrabold text-[8px]" textAnchor="middle">5</text>
                  </g>
                </svg>
              )}

            </div>
          </div>

          {/* Informative side panel & specifications summaries */}
          <div className="xl:col-span-1 bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-100 px-2.5 py-1 rounded-md block w-fit">
                Exigences Officielles
              </span>
              
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>
                  {selectedDiagram === "trench" && "Profil de Tranchée Standard"}
                  {selectedDiagram === "sandbag" && "Protection de forte pente"}
                  {selectedDiagram === "crossing" && "Traversée Routière Gaine"}
                  {selectedDiagram === "cable" && "Croisements de Sécurité"}
                  {selectedDiagram === "oued" && "Lestage en Traversée d'Oued"}
                  {selectedDiagram === "ancrage" && "Massif d'Ancrage de Butée"}
                  {selectedDiagram === "poste_layout" && "Implantation Génie Civil de Poste"}
                  {selectedDiagram === "bending_abaque" && "Nomogramme de Cintrage à Froid"}
                  {selectedDiagram === "gare_racleur" && "Gare de Racleur d'Expédition / Réception"}
                </span>
              </h3>

              {activeTooltip ? (
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed shadow-sm space-y-1.5 animate-fade-in">
                  <p className="font-bold text-blue-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Point clé réglementaire :</span>
                  </p>
                  <p className="text-slate-600">{tooltips[activeTooltip]}</p>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 text-xs text-slate-500 italic">
                  Cliquez sur les puces oranges numérotées sur le plan technique pour faire apparaître instantanément l'exigence règlementaire.
                </div>
              )}
            </div>

            {/* Calculations widget based on Nomogram input */}
            {selectedDiagram === "bending_abaque" && currentBendingRecord && (
              <div className="bg-green-50/50 rounded-xl p-4 border border-green-100 mt-4 space-y-2.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded">Calculateur Intégré d'Abaques</span>
                <div className="text-[11px] text-slate-700 space-y-1 font-mono">
                  <p>• External Diameter : <strong>{dn_mm} mm</strong> ({nomoInches})</p>
                  <p>• Min Radius (R=30*Dn) : <strong className="text-green-700 font-bold">{min_r_theory.toFixed(2)} m</strong></p>
                  <p>• Gabarit plaque d'épreuve : <strong>{currentBendingRecord.gaugePlateDiameter} mm</strong></p>
                </div>
                <div className="border-t border-green-100 pt-2 text-[10px] text-slate-600 leading-relaxed">
                  <p className="font-bold text-slate-800">Cintrage maximum par tube de 12m :</p>
                  <p>Angle max total supportable = {((12 / min_r_theory) * (180 / Math.PI)).toFixed(1)}° (généralement réalisé par passes de 1.5° maximum).</p>
                </div>
              </div>
            )}

            <div className="border-t border-slate-200/60 pt-4 mt-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Prescriptions de Chantier :</span>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                {selectedDiagram === "trench" && (
                  <>
                    <p>• <strong>Épaisseur sable :</strong> 10 cm minimum au fond de la tranchée si présence de cailloux.</p>
                    <p>• <strong>Grillage :</strong> Placé obligatoirement 30 cm au-dessus de la conduite de gaz.</p>
                  </>
                )}
                {selectedDiagram === "sandbag" && (
                  <>
                    <p>• <strong>Fréquence :</strong> Barrages placés tous les 15m (pente 15-25%) et tous les 10m (pente &gt; 25%).</p>
                    <p>• <strong>Matière :</strong> Sacs en jute imputrescibles remplis de sable de granulométrie fine.</p>
                  </>
                )}
                {selectedDiagram === "crossing" && (
                  <>
                    <p>• <strong>Séparateur :</strong> Colliers de centrage posés tous les 1,50 m dans la gaine.</p>
                    <p>• <strong>Obturateur :</strong> Doit empêcher l'entrée des eaux pluviales et boues dans la gaine.</p>
                  </>
                )}
                {selectedDiagram === "cable" && (
                  <>
                    {cableSubTab === "souterrain_croise" && (
                      <>
                        <p>• <strong>Distance croisement :</strong> Écart vertical réglementaire de 0,50 m. Intercaler une dalle en béton de 5 cm minimum.</p>
                        <p>• <strong>Réseaux humides :</strong> Les conduites d'eau ou d'assainissement doivent être posées sous le gazoduc pour éviter d'imbiber le terrain de pose en cas de fuite.</p>
                      </>
                    )}
                    {cableSubTab === "souterrain_parallele" && (
                      <>
                        <p>• <strong>Parallélisme type :</strong> Garder un écartement horizontal de 1,00 m en tranchées séparées.</p>
                        <p>• <strong>Écrans séparateurs :</strong> Si l'espace est réduit à 0,50 m, poser un écran séparateur physique continu en plaques de béton.</p>
                      </>
                    )}
                    {cableSubTab === "aerien" && (
                      <>
                        <p>• <strong>Lignes Haute Tension :</strong> Respecter le couloir de servitude. Les mouvements d'engins télescopiques ou grues exigent une DICT.</p>
                        <p>• <strong>Courant d'induction :</strong> Pose d'un anneau de mise à la terre locale raccordé à la conduite pour capter et décharger l'induction alternative des lignes HTA/HTB.</p>
                      </>
                    )}
                  </>
                )}
                {selectedDiagram === "oued" && (
                  <>
                    <p>• <strong>Cavaliers :</strong> Béton vibré dosé à 350 kg/m³. Espacement précis pour équilibrer la poussée d'Archimède.</p>
                    <p>• <strong>Selles :</strong> Selles résilientes néoprène de 5 mm sous chaque cavalier.</p>
                  </>
                )}
                {selectedDiagram === "ancrage" && (
                  <>
                    <p>• <strong>Butée :</strong> Coulée directe contre le terrain non remanié pour s'opposer au glissement.</p>
                    <p>• <strong>Dilatation :</strong> Prise en compte de la dilatation thermique du gazoduc.</p>
                  </>
                )}
                {selectedDiagram === "poste_layout" && (
                  <>
                    <p>• <strong>Clôtures :</strong> Double clôture de treillis rigides espacées de 1.50 m pour zone haute sécurité.</p>
                    <p>• <strong>Béton dalles :</strong> Épaisseur réglementaire minimale de 25 cm armé de treillis soudé.</p>
                  </>
                )}
                {selectedDiagram === "bending_abaque" && (
                  <>
                    <p>• <strong>Ovalisation :</strong> Le diamètre extérieur ne doit pas être déformé de plus de 2.5% après cintrage.</p>
                    <p>• <strong>Interdictions :</strong> Le cintrage à chaud est strictement interdit sur les aciers de ligne.</p>
                  </>
                )}
                {selectedDiagram === "gare_racleur" && (
                  <>
                    <p>• <strong>Interverrouillage de sécurité :</strong> Clés prisonnières de sécurité de la porte d'ouverture rapide (porte filetée ou à mâchoires).</p>
                    <p>• <strong>Inclinaison du tube :</strong> Une inclinaison de 1% vers les drains est obligatoire pour vidanger correctement les hydrocarbures liquides.</p>
                    <p>• <strong>By-pass / Kickoff :</strong> Permet d'assurer la continuité de service sans interrompre le débit de gaz général du réseau.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "officiel" ? (
        /* ==================== TAB 2: COMPLETE SEARCHABLE GALLERY OF BLUEPRINTS ==================== */
        <div className="space-y-6">
          
          {/* Gallery controls & Search */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher un plan (ex: sable, oued, abaque, dalle...)"
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter tags */}
            <div className="flex flex-wrap gap-1.5">
              {["Tous", "Ligne courante", "Croisements", "Ouvrages spéciaux", "Postes", "Abaques"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGalleryFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    galleryFilter === filter 
                      ? "bg-orange-500 text-white shadow-sm" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid */}
          {filteredPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group p-3.5 space-y-3"
                >
                  <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200/50">
                    <img
                      src={plan.src}
                      alt={plan.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => {
                          setZoomPlan(plan);
                          setScale(1);
                          setPosition({ x: 0, y: 0 });
                        }}
                        className="px-3.5 py-2 bg-white text-slate-800 text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        <Maximize2 className="w-4 h-4" />
                        <span>Examiner & Zoomer</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-black text-orange-500 uppercase">{plan.category}</span>
                      <span className="text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{plan.fascicule} • Page {plan.page}</span>
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-xs group-hover:text-blue-600 transition-colors">{plan.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2 italic">{plan.caption}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                    <div className="flex flex-wrap gap-1">
                      {plan.tags.slice(0, 3).map(t => (
                        <span key={t} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">#{t}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setZoomPlan(plan);
                        setScale(1);
                        setPosition({ x: 0, y: 0 });
                      }}
                      className="text-blue-600 font-extrabold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Agrandir</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/60 text-[10px]">
                      <button
                        onClick={() => {
                          setEditingPlan(plan);
                          setEditTitle(plan.title);
                          setEditFascicule(plan.fascicule);
                          setEditPage(plan.page);
                          setEditCategory(plan.category);
                          setEditSrc(plan.src);
                          setEditCaption(plan.caption);
                          setEditTags(plan.tags.join(", "));
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Modifier les détails réglementaires"
                      >
                        <Plus className="w-3 h-3" /> {/* Represents modifications */}
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Supprimer ce document de Firestore"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 flex flex-col items-center justify-center space-y-3">
              <Search className="w-10 h-10 text-slate-300" />
              <h3 className="font-bold text-sm text-slate-700">Aucun plan ne correspond à votre recherche</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">Essayez d'utiliser des termes plus génériques comme "sable", "cavalier", "route", "tranchée" ou "clôture".</p>
            </div>
          )}
        </div>
      ) : (isSuperAdmin && activeTab === "sync") ? (
        /* ==================== TAB 3: CLOUD SYNC & LOCAL DOCUMENT MANAGER ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          {/* Column 1: Educational & Conceptual Sync Guide */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Directives d'Intégration & Synchro</h3>
                  <p className="text-xs text-slate-500">Comprendre le fonctionnement et la synchronisation avec Firebase / Claude.</p>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 leading-relaxed space-y-4 font-sans">
                <p>
                  Pour répondre à votre question sur l'intégration globale de l'ensemble de vos documents :
                </p>
                
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                  <h4 className="font-extrabold text-blue-800 text-xs flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Option A : Synchronisation Dynamique via Firebase Cloud</span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Cette méthode est idéale si vous avez une équipe qui doit téléverser des documents en continu depuis un navigateur. 
                    Vous pouvez provisionner une base de données cloud Firestore pour stocker les métadonnées de vos plans et un bucket Firebase Storage pour héberger les fichiers physiques (.jpg, .pdf, .png).
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-[11px] text-slate-500">
                    <li><strong>Firestore Schema</strong> : Une collection <code className="bg-slate-100 px-1 rounded font-mono">schemas</code> avec les attributs <code className="font-mono">id, title, page, caption, src, category, tags</code>.</li>
                    <li><strong>Storage Bucket</strong> : Stockage et livraison optimisés de vos fichiers d'ingénierie d'origine.</li>
                    <li><strong>Claude Sync</strong> : Vous pouvez utiliser un assistant IA Claude externe pour structurer ou réécrire vos fichiers de métadonnées et les synchroniser en base de données.</li>
                  </ul>
                </div>

                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 space-y-2">
                  <h4 className="font-extrabold text-amber-800 text-xs flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Option B : Intégration Directe en Dur (Recommandé pour Production Hors-Ligne)</span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Pour cette édition stable du guide 2026, l'intégration des documents directement dans l'application garantit une <strong>indépendance totale du réseau</strong> et une vitesse d'affichage instantanée, tout en évitant les abonnements cloud payants.
                  </p>
                  <ol className="list-decimal pl-5 mt-1 space-y-1 text-[11px] text-slate-500">
                    <li>Placez vos dessins techniques ou photos d'origine dans le dossier du projet <code className="bg-slate-100 px-1 rounded font-mono">/src/assets/images/</code>.</li>
                    <li>Référencez-les dans le fichier statique <code className="bg-slate-100 px-1 rounded font-mono">/src/components/InteractiveDiagrams.tsx</code> (la constante <code className="font-mono">ORIGINAL_PLANS</code>) et dans <code className="bg-slate-100 px-1 rounded font-mono">/src/data/fascicules.ts</code>.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Simulated Live Connection Status Card */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-orange-400 bg-orange-950/60 border border-orange-900/40 px-2.5 py-0.5 rounded">
                  Status de Connexion Cloud
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-200">Synchronisation Firebase Firestore Active</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  L'application est entièrement connectée à Firestore. Tout document ajouté, modifié ou supprimé par l'administrateur est immédiatement persisté en temps réel dans le cloud et partagé avec tous vos collègues.
                </p>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>DATABASE CLOUD : CONNECTÉ</span>
                <span>TOTAL PLANS : {plansList.length}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Drag and Drop Interactive Form or Protected Screen */}
          <div className="lg:col-span-5">
            {!isAdmin ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                <div className="p-4 bg-orange-50 text-orange-600 rounded-full">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Accès Administrateur Requis</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                    La partie insertion, édition et liaison de documents d'ingénierie est hautement sécurisée. 
                    Veuillez activer le <strong>Mode Administrateur</strong> dans la barre de navigation supérieure (mot de passe requis) pour déverrouiller l'outil d'insertion cloud.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 font-medium italic">
                  Les collègues peuvent consulter tous les plans dans l'onglet "Galerie des Plans Officiels".
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-orange-500" />
                    <span>Ajouter un Document Technique</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Insérez de nouveaux schémas via un lien Google Cloud ou en téléversant un fichier d'image local.</p>
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-100 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Document intégré au Cloud !</p>
                      <p className="text-[10px] text-green-600 mt-0.5">Le plan a été enregistré dans Firebase Firestore et est maintenant partagé avec vos collègues.</p>
                    </div>
                  </div>
                )}

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!uploadTitle.trim()) {
                      setUploadError("Veuillez saisir un titre pour le document.");
                      return;
                    }
                    if (!uploadSrc) {
                      setUploadError("Veuillez téléverser un fichier local ou coller un lien d'image Google Cloud.");
                      return;
                    }

                    const newPlan = {
                      id: `uploaded_${Date.now()}`,
                      title: uploadTitle,
                      fascicule: uploadFascicule,
                      page: Number(uploadPage) || 1,
                      category: uploadCategory === "Tous" ? "Ligne courante" : uploadCategory,
                      src: uploadSrc,
                      caption: uploadCaption || "Aucun descriptif technique fourni pour ce plan.",
                      tags: uploadTags.split(",").map(t => t.trim()).filter(Boolean).concat(["cloud_upload"])
                    };

                    try {
                      await setDoc(doc(db, "plans", newPlan.id), newPlan);
                      setUploadSuccess(true);
                      setUploadError(null);
                      
                      // Reset form fields
                      setUploadTitle("");
                      setUploadCaption("");
                      setUploadTags("");
                      setUploadSrc(null);
                      
                      // Switch tab to show the newly added plan
                      setTimeout(() => {
                        setActiveTab("officiel");
                        setUploadSuccess(false);
                      }, 1500);
                    } catch (err: any) {
                      setUploadError("Erreur lors de l'enregistrement sur Firebase : " + err.message);
                    }
                  }}
                  className="space-y-4"
                >
                  {/* Google Cloud Link pasting input */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-orange-600 block">Lien URL de l'Image du Plan</label>
                      <input
                        type="text"
                        placeholder="Collez l'URL de votre plan (ex: https://storage.googleapis.com/...)"
                        value={uploadSrc || ""}
                        onChange={(e) => {
                          setUploadSrc(e.target.value || null);
                          setUploadError(null);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition-colors font-mono text-blue-600 shadow-[inset_1px_1px_2.5px_rgba(0,0,0,0.03)]"
                      />
                    </div>

                    {/* Integrated Google Drive share link converter */}
                    <DriveLinkConverter 
                      compact={true} 
                      onUseLink={(directLink) => {
                        setUploadSrc(directLink);
                        setUploadError(null);
                      }} 
                    />
                  </div>

                  <div className="relative flex py-1.5 items-center">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink mx-3 text-[9px] text-slate-400 font-bold uppercase">OU ALORS</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>

                  {/* Drag and Drop area */}
                  <div 
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                      uploadSrc && !uploadSrc.startsWith("http")
                        ? "border-green-400 bg-green-50/20" 
                        : isDragOver 
                          ? "border-orange-500 bg-orange-50/40" 
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        if (!file.type.startsWith("image/")) {
                          setUploadError("Format invalide. Seuls les fichiers images (.png, .jpg, .svg, .webp) sont supportés.");
                          return;
                        }
                        setUploadError(null);
                        compressAndSetImage(file);
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith("image/")) {
                            setUploadError("Format invalide. Seuls les fichiers images (.png, .jpg, .svg, .webp) sont supportés.");
                            return;
                          }
                          setUploadError(null);
                          compressAndSetImage(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    {uploadSrc && !uploadSrc.startsWith("http") ? (
                      <div className="space-y-1.5 w-full">
                        <div className="relative mx-auto w-24 h-16 rounded-lg overflow-hidden border border-green-200 shadow-sm bg-white">
                          <img src={uploadSrc} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadSrc(null);
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-green-700 font-bold">Fichier d'image locale chargé !</p>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className={`w-7 h-7 ${isDragOver ? "text-orange-500 animate-bounce" : "text-slate-400"}`} />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Glissez-déposez une image locale ici</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Ou cliquez pour parcourir les fichiers</p>
                        </div>
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Formats supportés : Images PNG, JPG, SVG</span>
                      </>
                    )}
                  </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Titre du Plan Saisi</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Plan d'ingénierie - Traversée Rail"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Fascicule</label>
                    <select
                      value={uploadFascicule}
                      onChange={(e) => setUploadFascicule(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                    >
                      {["Fascicule 1", "Fascicule 2", "Fascicule 3", "Fascicule 4", "Fascicule 5", "Fascicule 6", "Fascicule 7"].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Numéro de Page</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={uploadPage}
                      onChange={(e) => setUploadPage(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Category & Tags Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Catégorie</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                    >
                      {["Tous", "Ligne courante", "Croisements", "Ouvrages spéciaux", "Postes", "Abaques"].map(c => (
                        <option key={c} value={c}>{c === "Tous" ? "Ligne courante (Défaut)" : c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Tags (Séparés par virgule)</label>
                    <input
                      type="text"
                      placeholder="Ex: béton, oued, rail"
                      value={uploadTags}
                      onChange={(e) => setUploadTags(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Caption Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Prescriptions Techniques & Description</label>
                  <textarea
                    rows={3}
                    placeholder="Saisissez ici les exigences règlementaires, côtes techniques, tolérances issues du cahier des charges..."
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!uploadTitle.trim() || !uploadSrc}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Intégrer le plan à la Galerie Locale</span>
                </button>
              </form>
            </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Advanced Zoom and Pan Modal */}
      {zoomPlan && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-orange-400 bg-orange-950/60 border border-orange-900/40 px-2.5 py-0.5 rounded">
                  {zoomPlan.fascicule} • Page {zoomPlan.page}
                </span>
                <h3 className="text-sm font-bold text-slate-100 mt-1">{zoomPlan.title}</h3>
              </div>
              
              <button
                onClick={() => setZoomPlan(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all font-bold text-xs cursor-pointer"
              >
                Fermer l'examen
              </button>
            </div>

            {/* Interactive Zoom Controls strip */}
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-2.5 flex items-center justify-between text-xs text-slate-600 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleZoomOut}
                  disabled={scale <= 1}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                  title="Zoom arrière"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono font-bold w-12 text-center text-slate-800">{Math.round(scale * 100)}%</span>
                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 4}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                  title="Zoom avant"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[11px] cursor-pointer"
                  title="Réinitialiser l'affichage"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>
              </div>

              {scale > 1 && (
                <div className="text-[11px] text-orange-600 font-medium flex items-center gap-1 animate-pulse">
                  <Move className="w-3.5 h-3.5" />
                  <span>Cliquez et glissez pour naviguer sur le plan de détail</span>
                </div>
              )}
            </div>

            {/* Canvas Area with drag & scroll support */}
            <div 
              className="flex-1 overflow-hidden bg-slate-900 flex items-center justify-center relative cursor-grab active:cursor-grabbing p-6 min-h-[300px]"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out",
                  transformOrigin: "center center"
                }}
                className="max-h-[55vh] max-w-full flex items-center justify-center pointer-events-none"
              >
                <img
                  src={zoomPlan.src}
                  alt={zoomPlan.title}
                  className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
                  referrerPolicy="no-referrer"
                ></img>
              </div>
            </div>

            {/* Modal Technical Description Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 text-xs leading-relaxed shrink-0 max-h-[180px] overflow-auto">
              <p className="font-extrabold text-slate-800 mb-1 text-xs">Descriptif Technique & Clauses Règlementaires :</p>
              <p className="text-slate-600 font-medium text-[11px]">{zoomPlan.caption}</p>
            </div>

          </div>
        </div>
      )}

      {/* Admin Modification Modal for Plans */}
      {editingPlan && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full flex flex-col border border-slate-200 animate-fade-in">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-950/60 border border-blue-900/40 px-2.5 py-0.5 rounded">
                  Mode Administrateur • Modification
                </span>
                <h3 className="text-sm font-bold text-slate-100 mt-1">Modifier le Dessin Réglementaire</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all font-bold text-xs cursor-pointer"
              >
                Annuler
              </button>
            </div>

            <form onSubmit={handleSavePlanEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 block">Titre du Plan</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Plan d'ingénierie - Traversée Rail"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-medium text-slate-800"
                />
              </div>

              {/* Source Link */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Lien URL du Document</label>
                  <input
                    type="text"
                    required
                    placeholder="https://..."
                    value={editSrc}
                    onChange={(e) => setEditSrc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-blue-600 shadow-[inset_1px_1px_2.5px_rgba(0,0,0,0.03)]"
                  />
                </div>

                {/* Integrated Google Drive share link converter for editing */}
                <DriveLinkConverter 
                  compact={true} 
                  onUseLink={(directLink) => {
                    setEditSrc(directLink);
                  }} 
                />
              </div>

              {/* Metadata Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Fascicule</label>
                  <select
                    value={editFascicule}
                    onChange={(e) => setEditFascicule(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-medium text-slate-700"
                  >
                    {["Fascicule 1", "Fascicule 2", "Fascicule 3", "Fascicule 4", "Fascicule 5", "Fascicule 6", "Fascicule 7"].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Numéro de Page</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editPage}
                    onChange={(e) => setEditPage(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Category & Tags Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Catégorie</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-medium text-slate-700"
                  >
                    {["Ligne courante", "Croisements", "Ouvrages spéciaux", "Postes", "Abaques"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Tags (séparés par virgule)</label>
                  <input
                    type="text"
                    placeholder="béton, oued, rail"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Caption Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 block">Prescriptions Techniques & Description</label>
                <textarea
                  rows={4}
                  placeholder="Saisissez ici les exigences règlementaires..."
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors font-medium text-slate-600 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim() || !editSrc.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
