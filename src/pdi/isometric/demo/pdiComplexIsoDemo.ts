/**
 * PD&I - Modèle Isométrique Complexe de Démonstration Industrielle
 * Conforme ASME B31.3 / MSS SP-58 / EN 1992-4
 * 
 * Contient un ensemble riche et cohérent pour tester l'intégralité des moteurs :
 * - Géométrie 3D spatiale (X, Y, Z, Riser vertical, Décalage 45°, boucle de By-pass)
 * - Raccords et équipements variés (vannes à passage total, boisseau, papillon, soupape, clapet,
 *   coudes 90° et 45°, brides WN/SO, JMI, manomètres, piquage, réductions concentrique & excentrique, purge, évent)
 * - Lignes de procédé multiples (Ligne principale HP DN150/DN100 et By-pass régulation DN80)
 * - Supportage normalisé MSS SP-58 (Types 1, 35, 39, 51, 57) avec spécifications Génie Civil complètes
 * - Cotations isométriques d'axe en axe et d'élévation
 * - Éléments 2D CAD (Flèche Nord isométrique, notes d'ingénierie, cartouche)
 */

import type {
  IsoNode,
  IsoSegment,
  IsoFitting,
  IsoDimension,
  Cad2dEntity,
  Cad2dLayer,
  PipingLine,
} from "../types/isoGraphTypes";
import {
  type IsoPipingSupport,
  createDefaultCivilSpecForDn,
} from "../supports/pdiMssSupportEngine";

export interface ComplexIsoDemoData {
  projectName: string;
  wilaya: string;
  pressDesign: number;
  lines: PipingLine[];
  nodes: IsoNode[];
  segments: IsoSegment[];
  dimensions: IsoDimension[];
  supports: IsoPipingSupport[];
  cad2dEntities: Cad2dEntity[];
  cad2dLayers: Cad2dLayer[];
}

export function generateComplexIndustrialIsoDemo(): ComplexIsoDemoData {
  // 1. Lignes de procédé (Piping Lines)
  const line1Id = "line_hp_proc";
  const line2Id = "line_bp_reg";

  const lines: PipingLine[] = [
    {
      id: line1Id,
      lineNumber: "101-PG-150-C30",
      service: "Gaz Naturel HP (Procédé)",
      dn: 150,
      nps: '6"',
      material: "Acier API 5L Gr. B",
      pressureClass: "Class 300",
      schedule: "40",
      designPressure: 50,
      designTemperature: 60,
      color: "#0284C7", // Cyan / Bleu procédé
    },
    {
      id: line2Id,
      lineNumber: "102-PG-080-C30",
      service: "By-Pass Régulation & Sécurité",
      dn: 80,
      nps: '3"',
      material: "Acier ASTM A106 Gr. B",
      pressureClass: "Class 300",
      schedule: "40",
      designPressure: 50,
      designTemperature: 60,
      color: "#10B981", // Vert émeraude
    },
  ];

  // 2. Nœuds 3D Isométriques
  // Architecture spatiale :
  // N01 -> N02 -> N03 (axe X, Z=0)
  // N03 -> N04 (colonne verticale Riser Z=0 -> Z=2.8m)
  // N04 -> N05 (axe Y horizontal à Z=2.8m, Té vers By-Pass)
  // Ligne 1 principale continue : N05 -> N06 -> N07 (axe X à Z=2.8m)
  // N07 -> N08 (décalage à 45° dans plan XY de Z=2.8m)
  // N08 -> N09 (axe X vers descente)
  // N09 -> N10 (colonne verticale descente Z=2.8m -> Z=0.5m)
  // N10 -> N11 (axe X horizontal Z=0.5m vers sortie de poste)
  //
  // Ligne 2 By-Pass :
  // N05 (Té) -> N12 (déport axe Y vers Y=7.0m à Z=2.8m)
  // N12 -> N13 (axe X parallèle de 6m)
  // N13 -> N09 (reconnexion au collecteur aval avant descente)

  const n01: IsoNode = {
    id: "demo_n01",
    name: "Arrivée Skid HP DN150 (EL. +0.000)",
    x: 0,
    y: 0,
    z: 0,
    type: "entree_poste",
    lineId: line1Id,
    dn: 150,
  };

  const n02: IsoNode = {
    id: "demo_n02",
    name: "Point d'ancrage & Manomètre PI-101",
    x: 2.8,
    y: 0,
    z: 0,
    type: "normal",
    lineId: line1Id,
    dn: 150,
  };

  const n03: IsoNode = {
    id: "demo_n03",
    name: "Pied de colonne montante (Riser)",
    x: 6.0,
    y: 0,
    z: 0,
    type: "normal",
    lineId: line1Id,
    dn: 150,
  };

  const n04: IsoNode = {
    id: "demo_n04",
    name: "Tête de colonne (EL. +2.800)",
    x: 6.0,
    y: 0,
    z: 2.8,
    type: "normal",
    lineId: line1Id,
    dn: 150,
  };

  const n05: IsoNode = {
    id: "demo_n05",
    name: "Piquage Té By-Pass régulation",
    x: 6.0,
    y: 3.5,
    z: 2.8,
    type: "piquage",
    lineId: line1Id,
    dn: 150,
  };

  const n06: IsoNode = {
    id: "demo_n06",
    name: "Train de détente principal PCV-101",
    x: 9.8,
    y: 3.5,
    z: 2.8,
    type: "normal",
    lineId: line1Id,
    dn: 100,
  };

  const n07: IsoNode = {
    id: "demo_n07",
    name: "Amont décalage 45° (Coude 45°)",
    x: 13.0,
    y: 3.5,
    z: 2.8,
    type: "normal",
    lineId: line1Id,
    dn: 100,
  };

  const n08: IsoNode = {
    id: "demo_n08",
    name: "Aval décalage 45° (Rolling offset)",
    x: 15.2,
    y: 5.7,
    z: 2.8,
    type: "normal",
    lineId: line1Id,
    dn: 100,
  };

  const n09: IsoNode = {
    id: "demo_n09",
    name: "Collecteur jonction by-pass & descente",
    x: 18.5,
    y: 5.7,
    z: 2.8,
    type: "normal",
    lineId: line1Id,
    dn: 100,
  };

  const n10: IsoNode = {
    id: "demo_n10",
    name: "Pied de descente aval (EL. +0.500)",
    x: 18.5,
    y: 5.7,
    z: 0.5,
    type: "normal",
    lineId: line1Id,
    dn: 100,
  };

  const n11: IsoNode = {
    id: "demo_n11",
    name: "Sortie Unité DN100 (EL. +0.500)",
    x: 22.5,
    y: 5.7,
    z: 0.5,
    type: "sortie_poste",
    lineId: line1Id,
    dn: 100,
  };

  // Nœuds Ligne 2 By-Pass
  const n12: IsoNode = {
    id: "demo_n12",
    name: "Coude supérieur By-Pass DN80",
    x: 6.0,
    y: 7.2,
    z: 2.8,
    type: "normal",
    lineId: line2Id,
    dn: 80,
  };

  const n13: IsoNode = {
    id: "demo_n13",
    name: "Train By-Pass & Soupape PSV-102",
    x: 13.0,
    y: 7.2,
    z: 2.8,
    type: "normal",
    lineId: line2Id,
    dn: 80,
  };

  const nodes: IsoNode[] = [
    n01, n02, n03, n04, n05, n06, n07, n08, n09, n10, n11,
    n12, n13,
  ];

  // 3. Tronçons et Raccords (Fittings)
  const segments: IsoSegment[] = [
    // S01 : N01 -> N02 (Entrée DN150 L=2.8m, Bride WN + JMI + Vanne passage total)
    {
      id: "demo_seg01",
      fromNodeId: n01.id,
      toNodeId: n02.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 2.8,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_01", type: "bride_wn", label: "Bride WN 6\" Cl.300", localPosition: 0.12, cumulativePosition: 0, dn: 150 },
        { id: "fit_02", type: "jmi", label: "Joint Isolant Monobloc JMI 6\"", localPosition: 0.32, cumulativePosition: 0, dn: 150 },
        { id: "fit_03", type: "manometre", label: "Manomètre amont PI-101", localPosition: 0.58, cumulativePosition: 0, dn: 150 },
        { id: "fit_04", type: "vanne_passage_total", label: "Vanne passage total MOV-101", localPosition: 0.82, cumulativePosition: 0, dn: 150 },
      ],
    },
    // S02 : N02 -> N03 (Axe X L=3.2m, Coude 90° à l'extrémité)
    {
      id: "demo_seg02",
      fromNodeId: n02.id,
      toNodeId: n03.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.2,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_05", type: "coude_90", label: "Coude 90° LR DN150", localPosition: 0.92, cumulativePosition: 0, dn: 150 },
      ],
    },
    // S03 : N03 -> N04 (Riser vertical L=2.8m vers le haut, Coude 90°)
    {
      id: "demo_seg03",
      fromNodeId: n03.id,
      toNodeId: n04.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 2.8,
      type: "riser",
      lineId: line1Id,
      fittings: [
        { id: "fit_06", type: "coude_90", label: "Coude 90° LR DN150", localPosition: 0.92, cumulativePosition: 0, dn: 150 },
      ],
    },
    // S04 : N04 -> N05 (Axe Y L=3.5m, Té réduit vers By-Pass)
    {
      id: "demo_seg04",
      fromNodeId: n04.id,
      toNodeId: n05.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.5,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_07", type: "te_reduit", label: "Té réduit 150x80", localPosition: 0.94, cumulativePosition: 0, dn: 150 },
      ],
    },
    // S05 : N05 -> N06 (L=3.8m, Réduction concentrique 150->100, Clapet anti-retour, Vanne boisseau régulatrice)
    {
      id: "demo_seg05",
      fromNodeId: n05.id,
      toNodeId: n06.id,
      dn: 100,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.8,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_08", type: "reduction_concentrique", label: "Réduction conc. 150x100", localPosition: 0.22, cumulativePosition: 0, dn: 100 },
        { id: "fit_09", type: "clapet", label: "Clapet anti-retour NRV-101", localPosition: 0.52, cumulativePosition: 0, dn: 100 },
        { id: "fit_10", type: "vanne_boisseau", label: "Vanne boisseau régulation PCV-101", localPosition: 0.80, cumulativePosition: 0, dn: 100 },
      ],
    },
    // S06 : N06 -> N07 (L=3.2m, Coude 45° amont)
    {
      id: "demo_seg06",
      fromNodeId: n06.id,
      toNodeId: n07.id,
      dn: 100,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.2,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_11", type: "coude_45", label: "Coude 45° DN100", localPosition: 0.92, cumulativePosition: 0, dn: 100 },
      ],
    },
    // S07 : N07 -> N08 (Décalage à 45° L=3.11m, Coude 45° aval)
    {
      id: "demo_seg07",
      fromNodeId: n07.id,
      toNodeId: n08.id,
      dn: 100,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.11,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_12", type: "coude_45", label: "Coude 45° DN100", localPosition: 0.92, cumulativePosition: 0, dn: 100 },
      ],
    },
    // S08 : N08 -> N09 (Axe X L=3.3m, Prise pression PT-102, Coude 90°)
    {
      id: "demo_seg08",
      fromNodeId: n08.id,
      toNodeId: n09.id,
      dn: 100,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.3,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_13", type: "prise_pression", label: "Prise pression PT-102", localPosition: 0.35, cumulativePosition: 0, dn: 100 },
        { id: "fit_14", type: "coude_90", label: "Coude 90° LR DN100", localPosition: 0.92, cumulativePosition: 0, dn: 100 },
      ],
    },
    // S09 : N09 -> N10 (Descente verticale L=2.3m Z=2.8m -> Z=0.5m, Coude 90° bas)
    {
      id: "demo_seg09",
      fromNodeId: n09.id,
      toNodeId: n10.id,
      dn: 100,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 2.3,
      type: "riser",
      lineId: line1Id,
      fittings: [
        { id: "fit_15", type: "coude_90", label: "Coude 90° LR DN100", localPosition: 0.92, cumulativePosition: 0, dn: 100 },
      ],
    },
    // S10 : N10 -> N11 (Sortie aval L=4.0m, Vanne papillon, Purge point bas, Bride WN)
    {
      id: "demo_seg10",
      fromNodeId: n10.id,
      toNodeId: n11.id,
      dn: 100,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 4.0,
      type: "straight",
      lineId: line1Id,
      fittings: [
        { id: "fit_16", type: "purge", label: "Purge point bas DN25", localPosition: 0.20, cumulativePosition: 0, dn: 100 },
        { id: "fit_17", type: "vanne_papillon", label: "Vanne papillon aval MOV-102", localPosition: 0.50, cumulativePosition: 0, dn: 100 },
        { id: "fit_18", type: "bride_wn", label: "Bride WN 4\" Cl.300", localPosition: 0.88, cumulativePosition: 0, dn: 100 },
      ],
    },

    // --- Ligne 2 : By-pass de Régulation (DN80) ---
    // S11 : N05 -> N12 (Déport Y L=3.7m, Vanne boisseau by-pass, Coude 90°)
    {
      id: "demo_seg11",
      fromNodeId: n05.id,
      toNodeId: n12.id,
      dn: 80,
      pn: "Class 300",
      material: "Acier ASTM A106 Gr. B",
      length: 3.7,
      type: "straight",
      lineId: line2Id,
      fittings: [
        { id: "fit_19", type: "vanne_boisseau", label: "Vanne d'isolement By-Pass", localPosition: 0.35, cumulativePosition: 0, dn: 80 },
        { id: "fit_20", type: "coude_90", label: "Coude 90° LR DN80", localPosition: 0.92, cumulativePosition: 0, dn: 80 },
      ],
    },
    // S12 : N12 -> N13 (Section parallèle X L=7.0m, Soupape sécurité PSV-102, Évent point haut, Vanne boisseau, Coude 90°)
    {
      id: "demo_seg12",
      fromNodeId: n12.id,
      toNodeId: n13.id,
      dn: 80,
      pn: "Class 300",
      material: "Acier ASTM A106 Gr. B",
      length: 7.0,
      type: "straight",
      lineId: line2Id,
      fittings: [
        { id: "fit_21", type: "event", label: "Évent de dégazage point haut", localPosition: 0.18, cumulativePosition: 0, dn: 80 },
        { id: "fit_22", type: "soupape", label: "Soupape de sécurité PSV-102", localPosition: 0.45, cumulativePosition: 0, dn: 80 },
        { id: "fit_23", type: "vanne_boisseau", label: "Vanne manuelle de réglage", localPosition: 0.75, cumulativePosition: 0, dn: 80 },
        { id: "fit_24", type: "coude_90", label: "Coude 90° LR DN80", localPosition: 0.94, cumulativePosition: 0, dn: 80 },
      ],
    },
    // S13 : N13 -> N09 (Reconnexion L=5.7m vers collecteur N09, Clapet anti-retour by-pass)
    {
      id: "demo_seg13",
      fromNodeId: n13.id,
      toNodeId: n09.id,
      dn: 80,
      pn: "Class 300",
      material: "Acier ASTM A106 Gr. B",
      length: 5.7,
      type: "straight",
      lineId: line2Id,
      fittings: [
        { id: "fit_25", type: "clapet", label: "Clapet anti-retour By-Pass", localPosition: 0.50, cumulativePosition: 0, dn: 80 },
        { id: "fit_26", type: "bride_so", label: "Bride SO 3\" Cl.300", localPosition: 0.85, cumulativePosition: 0, dn: 80 },
      ],
    },
  ];

  // 4. Supports normalisés MSS SP-58 & Spécifications Génie Civil
  const supports: IsoPipingSupport[] = [
    // FIX-01 : Point Fixe Ancrage Rigide MSS Type 57 (Entrée Skid sur S01)
    {
      id: "demo_sup_fix01",
      tag: "FIX-01",
      type: "mss_type_57",
      segmentId: "demo_seg01",
      tRatio: 0.45,
      distanceFromFromNodeM: 1.26,
      worldPos: { x: 1.26, y: 0, z: 0 },
      elevationZ: 0,
      orientationAngleDeg: 0,
      comments: "Point fixe d'ancrage primaire entrée station - Reprend la poussée de fond",
      civilSpec: {
        basePlateLengthMm: 300,
        basePlateWidthMm: 300,
        basePlateThicknessMm: 20,
        steelGrade: "S275JR",
        calculatedPlateWeightKg: 14.13,
        anchorType: "mechanical_expansion",
        anchorDiameter: "M20",
        anchorCount: 4,
        anchorEmbedmentDepthMm: 200,
        foundationType: "massif_isole",
        foundationLengthM: 0.8,
        foundationWidthM: 0.8,
        foundationHeightM: 0.6,
        calculatedConcreteVolumeM3: 0.384,
        concreteGrade: "C25/30",
      },
    },
    // GDE-01 : Guide coulissant réglable MSS Type 35 (sur S02)
    {
      id: "demo_sup_gde01",
      tag: "GDE-01",
      type: "mss_type_35",
      segmentId: "demo_seg02",
      tRatio: 0.50,
      distanceFromFromNodeM: 1.60,
      worldPos: { x: 4.40, y: 0, z: 0 },
      elevationZ: 0,
      orientationAngleDeg: 0,
      comments: "Guide directionnel limitant le débattement latéral Y",
      civilSpec: {
        basePlateLengthMm: 250,
        basePlateWidthMm: 200,
        basePlateThicknessMm: 15,
        steelGrade: "S235JR",
        calculatedPlateWeightKg: 5.89,
        anchorType: "chemical_threaded_rod",
        anchorDiameter: "M16",
        anchorCount: 4,
        anchorEmbedmentDepthMm: 150,
        foundationType: "massif_isole",
        foundationLengthM: 0.6,
        foundationWidthM: 0.5,
        foundationHeightM: 0.4,
        calculatedConcreteVolumeM3: 0.12,
        concreteGrade: "C25/30",
      },
    },
    // RES-01 : Support à ressort variable MSS Type 51 (au pied du Riser S03)
    {
      id: "demo_sup_res01",
      tag: "RES-01",
      type: "mss_type_51",
      segmentId: "demo_seg03",
      tRatio: 0.35,
      distanceFromFromNodeM: 0.98,
      worldPos: { x: 6.0, y: 0, z: 0.98 },
      elevationZ: 0.98,
      orientationAngleDeg: 0,
      comments: "Boîte à ressort variable compensant la dilatation thermique verticale Delta Z = +14mm",
      civilSpec: createDefaultCivilSpecForDn(150),
    },
    // PAT-01 : Patin soudé pour tuyauterie calorifugée MSS Type 39 (sur S04)
    {
      id: "demo_sup_pat01",
      tag: "PAT-01",
      type: "mss_type_39",
      segmentId: "demo_seg04",
      tRatio: 0.50,
      distanceFromFromNodeM: 1.75,
      worldPos: { x: 6.0, y: 1.75, z: 2.8 },
      elevationZ: 2.8,
      orientationAngleDeg: 0,
      comments: "Patin support acier H=100mm posé sur profilé HEB 160 de skid",
      civilSpec: {
        ...createDefaultCivilSpecForDn(150),
        foundationType: "structure_metallique",
      },
    },
    // GDE-02 : Guide coulissant réglable MSS Type 35 (sur S05 après réduction)
    {
      id: "demo_sup_gde02",
      tag: "GDE-02",
      type: "mss_type_35",
      segmentId: "demo_seg05",
      tRatio: 0.40,
      distanceFromFromNodeM: 1.52,
      worldPos: { x: 7.52, y: 3.5, z: 2.8 },
      elevationZ: 2.8,
      orientationAngleDeg: 0,
      civilSpec: createDefaultCivilSpecForDn(100),
    },
    // PEN-01 : Pendard articulé réglable MSS Type 1 (sur S07 décalage 45°)
    {
      id: "demo_sup_pen01",
      tag: "PEN-01",
      type: "mss_type_1",
      segmentId: "demo_seg07",
      tRatio: 0.50,
      distanceFromFromNodeM: 1.55,
      worldPos: { x: 14.1, y: 4.6, z: 2.8 },
      elevationZ: 2.8,
      orientationAngleDeg: 0,
      comments: "Tige filetée M16 suspendue sous charpente métallique atelier",
      civilSpec: {
        ...createDefaultCivilSpecForDn(100),
        foundationType: "structure_metallique",
      },
    },
    // GDE-03 : Guide coulissant MSS Type 35 (sur S08 avant descente)
    {
      id: "demo_sup_gde03",
      tag: "GDE-03",
      type: "mss_type_35",
      segmentId: "demo_seg08",
      tRatio: 0.60,
      distanceFromFromNodeM: 1.98,
      worldPos: { x: 17.18, y: 5.7, z: 2.8 },
      elevationZ: 2.8,
      orientationAngleDeg: 0,
      civilSpec: createDefaultCivilSpecForDn(100),
    },
    // FIX-02 : Point Fixe d'Ancrage Aval MSS Type 57 (sur S10 vers limite batterie)
    {
      id: "demo_sup_fix02",
      tag: "FIX-02",
      type: "mss_type_57",
      segmentId: "demo_seg10",
      tRatio: 0.65,
      distanceFromFromNodeM: 2.60,
      worldPos: { x: 21.1, y: 5.7, z: 0.5 },
      elevationZ: 0.5,
      orientationAngleDeg: 0,
      comments: "Point fixe de sortie d'unité reprenant les efforts de tuyauterie enterrée",
      civilSpec: {
        basePlateLengthMm: 300,
        basePlateWidthMm: 250,
        basePlateThicknessMm: 20,
        steelGrade: "S355JR",
        calculatedPlateWeightKg: 11.78,
        anchorType: "chemical_threaded_rod",
        anchorDiameter: "M20",
        anchorCount: 4,
        anchorEmbedmentDepthMm: 220,
        foundationType: "massif_isole",
        foundationLengthM: 0.8,
        foundationWidthM: 0.7,
        foundationHeightM: 0.6,
        calculatedConcreteVolumeM3: 0.336,
        concreteGrade: "C30/37",
      },
    },
    // PEN-02 : Pendard de suspension By-Pass MSS Type 1 (sur S11)
    {
      id: "demo_sup_pen02",
      tag: "PEN-02",
      type: "mss_type_1",
      segmentId: "demo_seg11",
      tRatio: 0.60,
      distanceFromFromNodeM: 2.22,
      worldPos: { x: 6.0, y: 5.72, z: 2.8 },
      elevationZ: 2.8,
      orientationAngleDeg: 0,
      comments: "Support pendard sous toiture skid",
      civilSpec: createDefaultCivilSpecForDn(80),
    },
    // GDE-04 : Guide coulissant By-Pass MSS Type 35 (sur S12)
    {
      id: "demo_sup_gde04",
      tag: "GDE-04",
      type: "mss_type_35",
      segmentId: "demo_seg12",
      tRatio: 0.50,
      distanceFromFromNodeM: 3.50,
      worldPos: { x: 9.5, y: 7.2, z: 2.8 },
      elevationZ: 2.8,
      orientationAngleDeg: 0,
      civilSpec: createDefaultCivilSpecForDn(80),
    },
  ];

  // 5. Cotations Isométriques Réelles (Espacement aéré évitant tout encombrement du dessin)
  const dimensions: IsoDimension[] = [
    {
      id: "demo_dim01",
      type: "distance",
      a: { kind: "node", nodeId: n01.id },
      b: { kind: "node", nodeId: n02.id },
      label: "2 800 mm",
      offset: { x: 0, y: -44 },
      unit: "mm",
    },
    {
      id: "demo_dim02",
      type: "distance",
      a: { kind: "node", nodeId: n02.id },
      b: { kind: "node", nodeId: n03.id },
      label: "3 200 mm",
      offset: { x: 0, y: -44 },
      unit: "mm",
    },
    {
      id: "demo_dim03",
      type: "deltaZ",
      a: { kind: "node", nodeId: n03.id },
      b: { kind: "node", nodeId: n04.id },
      label: "ΔZ = 2 800 mm",
      offset: { x: -48, y: 0 },
      unit: "mm",
    },
    {
      id: "demo_dim04",
      type: "distance",
      a: { kind: "node", nodeId: n04.id },
      b: { kind: "node", nodeId: n05.id },
      label: "3 500 mm",
      offset: { x: 0, y: -42 },
      unit: "mm",
    },
    {
      id: "demo_dim05",
      type: "distance",
      a: { kind: "node", nodeId: n05.id },
      b: { kind: "node", nodeId: n06.id },
      label: "3 800 mm",
      offset: { x: 0, y: -44 },
      unit: "mm",
    },
    {
      id: "demo_dim06",
      type: "distance",
      a: { kind: "node", nodeId: n06.id },
      b: { kind: "node", nodeId: n07.id },
      label: "3 200 mm",
      offset: { x: 0, y: -44 },
      unit: "mm",
    },
    {
      id: "demo_dim07",
      type: "distance",
      a: { kind: "node", nodeId: n07.id },
      b: { kind: "node", nodeId: n08.id },
      label: "Δ45° = 3 110 mm",
      offset: { x: 26, y: -42 },
      unit: "mm",
    },
    {
      id: "demo_dim08",
      type: "deltaZ",
      a: { kind: "node", nodeId: n09.id },
      b: { kind: "node", nodeId: n10.id },
      label: "ΔZ = 2 300 mm",
      offset: { x: 46, y: 0 },
      unit: "mm",
    },
    {
      id: "demo_dim09",
      type: "distance",
      a: { kind: "node", nodeId: n10.id },
      b: { kind: "node", nodeId: n11.id },
      label: "4 000 mm",
      offset: { x: 0, y: -44 },
      unit: "mm",
    },
    {
      id: "demo_dim10",
      type: "distance",
      a: { kind: "node", nodeId: n12.id },
      b: { kind: "node", nodeId: n13.id },
      label: "7 000 mm (By-Pass)",
      offset: { x: 0, y: -46 },
      unit: "mm",
    },
  ];

  // 6. Calques et Entités CAD 2D (Cartouche, Flèche Nord Isométrique, Notes techniques)
  const cad2dLayers: Cad2dLayer[] = [
    { id: "axes_tuyauterie", name: "Axes tuyauterie", color: "#9CA3AF", visible: true, locked: false },
    { id: "annotations", name: "Annotations & Cartouche", color: "#60A5FA", visible: true, locked: false },
    { id: "import_cad", name: "Fond de plan Génie Civil", color: "#6B7280", visible: true, locked: false },
  ];

  const cad2dEntities: Cad2dEntity[] = [
    // Flèche Nord Isométrique 30°
    {
      id: "demo_c2d_nord_arrow",
      type: "line",
      layerId: "annotations",
      color: "#F59E0B", // Ambre
      lineWeight: 2,
      points: [
        { x: -3.0, y: -2.0 },
        { x: -1.0, y: -0.84 },
      ],
    },
    {
      id: "demo_c2d_nord_head1",
      type: "line",
      layerId: "annotations",
      color: "#F59E0B",
      lineWeight: 2,
      points: [
        { x: -1.0, y: -0.84 },
        { x: -1.5, y: -0.85 },
      ],
    },
    {
      id: "demo_c2d_nord_head2",
      type: "line",
      layerId: "annotations",
      color: "#F59E0B",
      lineWeight: 2,
      points: [
        { x: -1.0, y: -0.84 },
        { x: -1.3, y: -1.25 },
      ],
    },
    {
      id: "demo_c2d_nord_text",
      type: "text",
      layerId: "annotations",
      color: "#F59E0B",
      text: "NORD ISO (30°)",
      fontSize: 14,
      points: [{ x: -3.2, y: -2.4 }],
    },
    // Note d'ingénierie et de conformité
    {
      id: "demo_c2d_title_text",
      type: "text",
      layerId: "annotations",
      color: "#38BDF8", // Cyan clair
      text: "POSTE DE DETENTE & COMPTAGE GAZ NATUREL HP / MP — BY-PASS DE REGULATION",
      fontSize: 16,
      points: [{ x: 1.0, y: -4.0 }],
    },
    {
      id: "demo_c2d_sub_text",
      type: "text",
      layerId: "annotations",
      color: "#94A3B8",
      text: "Codes : ASME B31.3 Ed. 2024 / MSS SP-58 / Eurocode 2 (EN 1992-4) — Pression : 50 bar — DN150/100/80",
      fontSize: 12,
      points: [{ x: 1.0, y: -3.3 }],
    },
    // Repères d'élévation
    {
      id: "demo_c2d_el0",
      type: "text",
      layerId: "annotations",
      color: "#A78BFA",
      text: "EL. SOL +0.000 m",
      fontSize: 11,
      points: [{ x: -1.5, y: 0.5 }],
    },
    {
      id: "demo_c2d_el1",
      type: "text",
      layerId: "annotations",
      color: "#A78BFA",
      text: "EL. HAUT +2.800 m",
      fontSize: 11,
      points: [{ x: 4.2, y: 1.0 }],
    },
  ];

  return {
    projectName: "Poste Détente & Comptage Gaz HP/MP",
    wilaya: "Hassi Messaoud (Sonatrach / SH-DP)",
    pressDesign: 50,
    lines,
    nodes,
    segments,
    dimensions,
    supports,
    cad2dEntities,
    cad2dLayers,
  };
}
