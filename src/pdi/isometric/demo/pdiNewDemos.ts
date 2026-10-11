/**
 * PD&I - Nouveaux Modèles de Démonstration Industrielle
 * 1. Chambre Technique (Local Technique Fermé avec Confinement & Traversées de Mur)
 * 2. Skid de Filtration Parallèle (ASME B31.3 / Conforme à 100% au Plan isometrie.png avec Coudes et Collecteurs)
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

// Utility function to generate unique IDs
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).substring(2, 9)}`;

export interface NewDemoData {
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
  envelopeActive: boolean;
  envelopeLength: number;
  envelopeWidth: number;
  envelopeHeight: number;
  envelopeX: number;
  envelopeY: number;
  envelopeZ: number;
  envelopePreset: string;
}

/**
 * DEMO 1 : CHAMBRE TECHNIQUE (LOCAL TECHNIQUE CHAUFFAGE & CLIMATISATION)
 * Enveloppe fermée et confinée de 4.8m × 3.8m × H=2.8m avec traversées de parois
 */
export function generateChambreTechniqueDemo(): NewDemoData {
  const lineAllerId = "line_ct_aller";
  const lineRetourId = "line_ct_retour";

  const lines: PipingLine[] = [
    {
      id: lineAllerId,
      lineNumber: "201-EGL-100-M20",
      service: "Eau Glacée (Aller)",
      dn: 100,
      nps: '4"',
      material: "Acier ASTM A106 Gr. B",
      pressureClass: "PN16",
      schedule: "40",
      designPressure: 16,
      designTemperature: 7,
      color: "#0284C7", // Bleu glacial
    },
    {
      id: lineRetourId,
      lineNumber: "202-EGR-100-M20",
      service: "Eau Glacée (Retour)",
      dn: 100,
      nps: '4"',
      material: "Acier ASTM A106 Gr. B",
      pressureClass: "PN16",
      schedule: "40",
      designPressure: 16,
      designTemperature: 12,
      color: "#38BDF8", // Bleu ciel
    },
  ];

  // Helper for fittings
  const makeFitting = (type: string, pos: number, size: number): IsoFitting => ({
    id: uid("fit"),
    type: type as any,
    label: `${type.toUpperCase()} DN${size}`,
    localPosition: pos,
    cumulativePosition: pos,
    dn: size,
  });

  // --- LIGNE ALLER (Entrée Ouest Z=0.5m -> Vanne -> Coude bas 90° -> Riser -> Coude haut 90° -> Raccord Y -> Coude 90° -> Sortie Est Z=2.3m) ---
  const a01: IsoNode = {
    id: "ct_a01",
    name: "Arrivée Extérieure Aller DN100 (EL. +0.500)",
    x: -0.6,
    y: 0.8,
    z: 0.5,
    type: "entree_poste",
    lineId: lineAllerId,
    dn: 100,
  };

  const a02: IsoNode = {
    id: "ct_a02",
    name: "Vanne d'isolement Aller (Intérieur Local)",
    x: 1.8,
    y: 0.8,
    z: 0.5,
    type: "normal",
    lineId: lineAllerId,
    dn: 100,
  };

  const a03: IsoNode = {
    id: "ct_a03",
    name: "Pied de colonne Aller (Coude 90° Bas)",
    x: 3.5,
    y: 0.8,
    z: 0.5,
    type: "normal",
    equipmentType: "coude_90",
    lineId: lineAllerId,
    dn: 100,
  };

  const a04: IsoNode = {
    id: "ct_a04",
    name: "Tête de colonne Aller (Coude 90° Haut, EL. +2.300)",
    x: 3.5,
    y: 0.8,
    z: 2.3,
    type: "normal",
    equipmentType: "coude_90",
    lineId: lineAllerId,
    dn: 100,
  };

  const a05: IsoNode = {
    id: "ct_a05",
    name: "Coude 90° Changement d'axe Aller (Vers Sortie Est)",
    x: 3.5,
    y: 2.6,
    z: 2.3,
    type: "normal",
    equipmentType: "coude_90",
    lineId: lineAllerId,
    dn: 100,
  };

  const a06: IsoNode = {
    id: "ct_a06",
    name: "Sortie Aller vers Bâtiment (EL. +2.300)",
    x: 5.6,
    y: 2.6,
    z: 2.3,
    type: "sortie_poste",
    lineId: lineAllerId,
    dn: 100,
  };

  // --- LIGNE RETOUR (Entrée Ouest Z=0.8m -> Vanne -> Coude bas 90° -> Riser -> Coude haut 90° -> Raccord Y -> Coude 90° -> Sortie Est Z=2.5m) ---
  const r01: IsoNode = {
    id: "ct_r01",
    name: "Arrivée Extérieure Retour DN100 (EL. +0.800)",
    x: -0.6,
    y: 2.0,
    z: 0.8,
    type: "entree_poste",
    lineId: lineRetourId,
    dn: 100,
  };

  const r02: IsoNode = {
    id: "ct_r02",
    name: "Vanne d'isolement Retour (Intérieur Local)",
    x: 1.8,
    y: 2.0,
    z: 0.8,
    type: "normal",
    lineId: lineRetourId,
    dn: 100,
  };

  const r03: IsoNode = {
    id: "ct_r03",
    name: "Pied de colonne Retour (Coude 90° Bas)",
    x: 3.5,
    y: 2.0,
    z: 0.8,
    type: "normal",
    equipmentType: "coude_90",
    lineId: lineRetourId,
    dn: 100,
  };

  const r04: IsoNode = {
    id: "ct_r04",
    name: "Tête de colonne Retour (Coude 90° Haut, EL. +2.500)",
    x: 3.5,
    y: 2.0,
    z: 2.5,
    type: "normal",
    equipmentType: "coude_90",
    lineId: lineRetourId,
    dn: 100,
  };

  const r05: IsoNode = {
    id: "ct_r05",
    name: "Coude 90° Changement d'axe Retour (Vers Sortie Est)",
    x: 3.5,
    y: 3.3,
    z: 2.5,
    type: "normal",
    equipmentType: "coude_90",
    lineId: lineRetourId,
    dn: 100,
  };

  const r06: IsoNode = {
    id: "ct_r06",
    name: "Sortie Retour vers Bâtiment (EL. +2.500)",
    x: 5.6,
    y: 3.3,
    z: 2.5,
    type: "sortie_poste",
    lineId: lineRetourId,
    dn: 100,
  };

  const nodes = [a01, a02, a03, a04, a05, a06, r01, r02, r03, r04, r05, r06];

  const segments: IsoSegment[] = [
    // Ligne Aller
    {
      id: "ct_seg_a01",
      fromNodeId: a01.id,
      toNodeId: a02.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 2.4,
      type: "straight",
      lineId: lineAllerId,
      fittings: [
        makeFitting("bride_wn", 0.15, 100),
        makeFitting("vanne_passage_total", 1.5, 100),
        makeFitting("bride_wn", 2.2, 100),
      ],
    },
    {
      id: "ct_seg_a02",
      fromNodeId: a02.id,
      toNodeId: a03.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 1.7,
      type: "straight",
      lineId: lineAllerId,
      fittings: [
        makeFitting("manometre", 0.8, 100),
        makeFitting("coude_90", 0.95, 100), // Coude 90° Bas (Pied de colonne Aller)
      ],
    },
    {
      id: "ct_seg_a03",
      fromNodeId: a03.id,
      toNodeId: a04.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 1.8,
      type: "riser",
      lineId: lineAllerId,
      fittings: [
        makeFitting("coude_90", 0.95, 100), // Coude 90° Haut (Tête de colonne Aller)
      ],
    },
    {
      id: "ct_seg_a04",
      fromNodeId: a04.id,
      toNodeId: a05.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 1.8,
      type: "straight",
      lineId: lineAllerId,
      fittings: [
        makeFitting("coude_90", 0.95, 100), // Coude 90° Changement d'axe vers sortie Est
      ],
    },
    {
      id: "ct_seg_a05",
      fromNodeId: a05.id,
      toNodeId: a06.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 2.1,
      type: "straight",
      lineId: lineAllerId,
      fittings: [
        makeFitting("bride_wn", 2.0, 100),
      ],
    },

    // Ligne Retour
    {
      id: "ct_seg_r01",
      fromNodeId: r01.id,
      toNodeId: r02.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 2.4,
      type: "straight",
      lineId: lineRetourId,
      fittings: [
        makeFitting("bride_wn", 0.15, 100),
        makeFitting("vanne_passage_total", 1.5, 100),
        makeFitting("bride_wn", 2.2, 100),
      ],
    },
    {
      id: "ct_seg_r02",
      fromNodeId: r02.id,
      toNodeId: r03.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 1.7,
      type: "straight",
      lineId: lineRetourId,
      fittings: [
        makeFitting("coude_90", 0.95, 100), // Coude 90° Bas (Pied de colonne Retour)
      ],
    },
    {
      id: "ct_seg_r03",
      fromNodeId: r03.id,
      toNodeId: r04.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 1.7,
      type: "riser",
      lineId: lineRetourId,
      fittings: [
        makeFitting("coude_90", 0.95, 100), // Coude 90° Haut (Tête de colonne Retour)
      ],
    },
    {
      id: "ct_seg_r04",
      fromNodeId: r04.id,
      toNodeId: r05.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 1.3,
      type: "straight",
      lineId: lineRetourId,
      fittings: [
        makeFitting("coude_90", 0.95, 100), // Coude 90° Changement d'axe vers sortie Est
      ],
    },
    {
      id: "ct_seg_r05",
      fromNodeId: r05.id,
      toNodeId: r06.id,
      dn: 100,
      pn: "PN16",
      material: "Acier ASTM A106 Gr. B",
      length: 2.1,
      type: "straight",
      lineId: lineRetourId,
      fittings: [
        makeFitting("bride_wn", 2.0, 100),
      ],
    },
  ];

  // Supports (MSS SP-58 / Génie Civil)
  const supports: IsoPipingSupport[] = [
    {
      id: "ct_sup01",
      tag: "SUP-CT-01",
      type: "mss_type_39", // Shoe type / patin
      segmentId: "ct_seg_a02",
      tRatio: 0.5,
      distanceFromFromNodeM: 0.85,
      worldPos: { x: 2.65, y: 0.8, z: 0.5 },
      elevationZ: 0.5,
      orientationAngleDeg: 0,
      comments: "Support de sol glissant sous manomètre",
      civilSpec: createDefaultCivilSpecForDn(100),
    },
    {
      id: "ct_sup02",
      tag: "SUP-CT-02",
      type: "mss_type_1", // Hanger type / pendard
      segmentId: "ct_seg_a04",
      tRatio: 0.5,
      distanceFromFromNodeM: 0.9,
      worldPos: { x: 3.5, y: 1.7, z: 2.3 },
      elevationZ: 2.3,
      orientationAngleDeg: 0,
      comments: "Pendard de suspension articulé sous dalle béton de plafond",
      civilSpec: {
        ...createDefaultCivilSpecForDn(100),
        foundationType: "dalle_existante",
      },
    },
    {
      id: "ct_sup03",
      tag: "SUP-CT-03",
      type: "mss_type_35", // Guide type / collier de guidage
      segmentId: "ct_seg_r02",
      tRatio: 0.5,
      distanceFromFromNodeM: 0.85,
      worldPos: { x: 2.65, y: 2.0, z: 0.8 },
      elevationZ: 0.8,
      orientationAngleDeg: 0,
      comments: "Support guide latéral fixé sur socle métallique",
      civilSpec: createDefaultCivilSpecForDn(100),
    },
  ];

  // Dimensions
  const dimensions: IsoDimension[] = [
    {
      id: "ct_dim01",
      type: "distance",
      a: { kind: "node", nodeId: a01.id },
      b: { kind: "node", nodeId: a02.id },
      label: "2 400 mm",
      offset: { x: 0, y: -35 },
      unit: "mm",
    },
    {
      id: "ct_dim02",
      type: "distance",
      a: { kind: "node", nodeId: a02.id },
      b: { kind: "node", nodeId: a03.id },
      label: "1 700 mm",
      offset: { x: 0, y: -35 },
      unit: "mm",
    },
    {
      id: "ct_dim03",
      type: "deltaZ",
      a: { kind: "node", nodeId: a03.id },
      b: { kind: "node", nodeId: a04.id },
      label: "ΔZ = 1 800 mm",
      offset: { x: -38, y: 0 },
      unit: "mm",
    },
    {
      id: "ct_dim04",
      type: "distance",
      a: { kind: "node", nodeId: r01.id },
      b: { kind: "node", nodeId: r02.id },
      label: "2 400 mm",
      offset: { x: 0, y: 35 },
      unit: "mm",
    },
  ];

  const cad2dEntities: Cad2dEntity[] = [
    {
      id: uid("cad"),
      type: "text",
      layerId: "0",
      color: "#38BDF8",
      center: { x: 100, y: 100 },
      text: "CHAMBRE TECHNIQUE : CHAUFFAGE & EAU GLACÉE",
      fontSize: 16,
    },
    {
      id: uid("cad"),
      type: "text",
      layerId: "0",
      color: "#9CA3AF",
      center: { x: 100, y: 125 },
      text: "Traversées de parois étanches Ouest (Inlets) et Est (Outlets)",
      fontSize: 11,
    },
  ];

  const cad2dLayers: Cad2dLayer[] = [
    { id: "0", name: "Défaut", color: "#FFFFFF", visible: true, locked: false },
  ];

  return {
    projectName: "Local Chauffage & Clim - Chambre Technique",
    wilaya: "Alger (Local technique)",
    pressDesign: 16,
    lines,
    nodes,
    segments,
    dimensions,
    supports,
    cad2dEntities,
    cad2dLayers,
    envelopeActive: true,
    envelopeLength: 4.8,
    envelopeWidth: 3.8,
    envelopeHeight: 2.8,
    envelopeX: 0.0,
    envelopeY: 0.0,
    envelopeZ: 0.0,
    envelopePreset: "local_compresseur",
  };
}

/**
 * DEMO 2 : SKID DE FILTRATION PARALLÈLE (3 LIGNES DN150 AVEC COUDES BAS/HAUT ET COLLECTEUR DE RETOUR)
 * Basé à 100% sur le plan industriel "isometrie.png"
 * Gabarit de Skid ASME standard de 6.0m × 4.5m × H=3.0m
 */
export function generateSkidFiltrationDemo(): NewDemoData {
  const lineAId = "line_skid_a";
  const lineBId = "line_skid_b";
  const lineCId = "line_skid_c";

  const lines: PipingLine[] = [
    {
      id: lineAId,
      lineNumber: "301-FL-A-150-C30",
      service: "Filtration - Ligne Parallèle A",
      dn: 150,
      nps: '6"',
      material: "Acier API 5L Gr. B",
      pressureClass: "Class 300",
      schedule: "40",
      designPressure: 50,
      designTemperature: 50,
      color: "#0284C7", // Bleu
    },
    {
      id: lineBId,
      lineNumber: "302-FL-B-150-C30",
      service: "Filtration - Ligne Parallèle B",
      dn: 150,
      nps: '6"',
      material: "Acier API 5L Gr. B",
      pressureClass: "Class 300",
      schedule: "40",
      designPressure: 50,
      designTemperature: 50,
      color: "#3B82F6", // Bleu moyen
    },
    {
      id: lineCId,
      lineNumber: "303-FL-C-150-C30",
      service: "Filtration - Ligne Parallèle C",
      dn: 150,
      nps: '6"',
      material: "Acier API 5L Gr. B",
      pressureClass: "Class 300",
      schedule: "40",
      designPressure: 50,
      designTemperature: 50,
      color: "#6366F1", // Indigo
    },
  ];

  const nodes: IsoNode[] = [];
  const segments: IsoSegment[] = [];
  const dimensions: IsoDimension[] = [];
  const supports: IsoPipingSupport[] = [];

  const makeFitting = (type: string, pos: number, size: number): IsoFitting => ({
    id: uid("fit"),
    type: type as any,
    label: `${type.toUpperCase()} DN${size}`,
    localPosition: pos,
    cumulativePosition: pos,
    dn: size,
  });

  // Construction des 3 lignes parallèles du plan isometrie.png à Y = 0.8m, Y = 2.0m, et Y = 3.2m
  const yCoordinates = [0.8, 2.0, 3.2];
  const lineIds = [lineAId, lineBId, lineCId];
  const lineTags = ["A", "B", "C"];

  yCoordinates.forEach((y, i) => {
    const lId = lineIds[i];
    const tag = lineTags[i];

    // N01 : Entrée basse avec bride WN (isometrie.png)
    const n1: IsoNode = {
      id: `skid_${tag}_n01`,
      name: `Inlet Ligne ${tag} (Bride WN)`,
      x: 0.2,
      y: y,
      z: 0.4,
      type: "entree_poste",
      lineId: lId,
      dn: 150,
    };

    // N02 : Détente & Élargisseur conique
    const n2: IsoNode = {
      id: `skid_${tag}_n02`,
      name: `Détente & Expansion Ligne ${tag}`,
      x: 1.5,
      y: y,
      z: 0.4,
      type: "normal",
      lineId: lId,
      dn: 150,
    };

    // N03 : Vanne de sectionnement à volant (Gate valve)
    const n3: IsoNode = {
      id: `skid_${tag}_n03`,
      name: `Vanne Motorisée Ligne ${tag}`,
      x: 2.9,
      y: y,
      z: 0.4,
      type: "normal",
      lineId: lId,
      dn: 150,
    };

    // N04 : Point instrumenté
    const n4: IsoNode = {
      id: `skid_${tag}_n04`,
      name: `Point Instrumenté Ligne ${tag}`,
      x: 4.1,
      y: y,
      z: 0.4,
      type: "normal",
      lineId: lId,
      dn: 150,
    };

    // N05 : Pied de colonne montante avec Coude 90° Bas (isometrie.png)
    const n5: IsoNode = {
      id: `skid_${tag}_n05`,
      name: `Pied de Riser Ligne ${tag} (Coude 90° Bas)`,
      x: 5.2,
      y: y,
      z: 0.4,
      type: "normal",
      equipmentType: "coude_90",
      lineId: lId,
      dn: 150,
    };

    // N06 : Tête de colonne montante avec Coude 90° Haut (isometrie.png)
    const n6: IsoNode = {
      id: `skid_${tag}_n06`,
      name: `Tête de Riser Ligne ${tag} (Coude 90° Haut, EL. +2.000)`,
      x: 5.2,
      y: y,
      z: 2.0,
      type: "normal",
      equipmentType: "coude_90",
      lineId: lId,
      dn: 150,
    };

    // N07 : Sortie haute ramenée horizontalement au-dessus du châssis (isometrie.png)
    const n7: IsoNode = {
      id: `skid_${tag}_n07`,
      name: `Sortie Haute Skid ${tag} (Bride WN, EL. +2.000)`,
      x: 1.8,
      y: y,
      z: 2.0,
      type: "sortie_poste",
      lineId: lId,
      dn: 150,
    };

    nodes.push(n1, n2, n3, n4, n5, n6, n7);

    // Tronçons de tuyauterie
    const seg1: IsoSegment = {
      id: `seg_skid_${tag}_01`,
      fromNodeId: n1.id,
      toNodeId: n2.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 1.3,
      type: "straight",
      lineId: lId,
      fittings: [
        makeFitting("bride_wn", 0.15, 150),
        makeFitting("reduction_concentrique", 1.0, 150),
      ],
    };

    const seg2: IsoSegment = {
      id: `seg_skid_${tag}_02`,
      fromNodeId: n2.id,
      toNodeId: n3.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 1.4,
      type: "straight",
      lineId: lId,
      fittings: [
        makeFitting("bride_wn", 0.15, 150),
        makeFitting("vanne_passage_total", 0.7, 150), // Gate valve with handwheel
        makeFitting("bride_wn", 1.25, 150),
      ],
    };

    const seg3: IsoSegment = {
      id: `seg_skid_${tag}_03`,
      fromNodeId: n3.id,
      toNodeId: n4.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 1.2,
      type: "straight",
      lineId: lId,
      fittings: [
        makeFitting("manometre", 0.6, 150),
      ],
    };

    const seg4: IsoSegment = {
      id: `seg_skid_${tag}_04`,
      fromNodeId: n4.id,
      toNodeId: n5.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 1.1,
      type: "straight",
      lineId: lId,
      fittings: [
        makeFitting("coude_90", 0.95, 150), // Coude 90° Bas ASME B16.9
      ],
    };

    // Seg 5 : Colonne verticale montante (Riser entre Coude Bas et Coude Haut)
    const seg5: IsoSegment = {
      id: `seg_skid_${tag}_05`,
      fromNodeId: n5.id,
      toNodeId: n6.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 1.6,
      type: "riser",
      lineId: lId,
      fittings: [
        makeFitting("coude_90", 0.95, 150), // Coude 90° Haut ASME B16.9
      ],
    };

    // Seg 6 : Tronçon horizontal supérieur de retour vers l'avant du Skid (isometrie.png)
    const seg6: IsoSegment = {
      id: `seg_skid_${tag}_06`,
      fromNodeId: n6.id,
      toNodeId: n7.id,
      dn: 150,
      pn: "Class 300",
      material: "Acier API 5L Gr. B",
      length: 3.4,
      type: "straight",
      lineId: lId,
      fittings: [
        makeFitting("bride_wn", 3.25, 150),
      ],
    };

    segments.push(seg1, seg2, seg3, seg4, seg5, seg6);

    // Supports MSS SP-58 (Patins sur IPE et Support poteau supérieur)
    const supBase: IsoPipingSupport = {
      id: `sup_skid_${tag}_01`,
      tag: `PAT-${tag}01`,
      type: "mss_type_39", // Welded shoe support
      segmentId: seg3.id,
      tRatio: 0.5,
      distanceFromFromNodeM: 0.6,
      worldPos: { x: 3.5, y: y, z: 0.4 },
      elevationZ: 0.4,
      orientationAngleDeg: 0,
      comments: `Support patin soudé type 39 sur profilé IPE du châssis Skid ${tag}`,
      civilSpec: {
        ...createDefaultCivilSpecForDn(150),
        foundationType: "structure_metallique",
        steelGrade: "S235JR",
      },
    };

    const supTop: IsoPipingSupport = {
      id: `sup_skid_${tag}_02`,
      tag: `GDE-${tag}02`,
      type: "mss_type_35", // Guide support sous ligne haute
      segmentId: seg6.id,
      tRatio: 0.5,
      distanceFromFromNodeM: 1.7,
      worldPos: { x: 3.5, y: y, z: 2.0 },
      elevationZ: 2.0,
      orientationAngleDeg: 0,
      comments: `Guide de maintien horizontal sur potence haute du Skid ${tag}`,
      civilSpec: {
        ...createDefaultCivilSpecForDn(150),
        foundationType: "structure_metallique",
        steelGrade: "S235JR",
      },
    };

    supports.push(supBase, supTop);

    // Dimensions détaillées (sur ligne B pour netteté du plan)
    if (tag === "B") {
      dimensions.push(
        {
          id: `skid_dim_01`,
          type: "distance",
          a: { kind: "node", nodeId: n1.id },
          b: { kind: "node", nodeId: n2.id },
          label: "1 300 mm",
          offset: { x: 0, y: -45 },
          unit: "mm",
        },
        {
          id: `skid_dim_02`,
          type: "distance",
          a: { kind: "node", nodeId: n2.id },
          b: { kind: "node", nodeId: n3.id },
          label: "1 400 mm",
          offset: { x: 0, y: -45 },
          unit: "mm",
        },
        {
          id: `skid_dim_03`,
          type: "distance",
          a: { kind: "node", nodeId: n3.id },
          b: { kind: "node", nodeId: n5.id },
          label: "2 300 mm",
          offset: { x: 0, y: -45 },
          unit: "mm",
        },
        {
          id: `skid_dim_04`,
          type: "deltaZ",
          a: { kind: "node", nodeId: n5.id },
          b: { kind: "node", nodeId: n6.id },
          label: "ΔZ = 1 600 mm",
          offset: { x: -45, y: 0 },
          unit: "mm",
        },
        {
          id: `skid_dim_05`,
          type: "distance",
          a: { kind: "node", nodeId: n6.id },
          b: { kind: "node", nodeId: n7.id },
          label: "3 400 mm (Retour)",
          offset: { x: 0, y: 45 },
          unit: "mm",
        }
      );
    }
  });

  // Dimensions d'entraxe entre lignes parallèles (1200 mm)
  dimensions.push(
    {
      id: `skid_dim_space1`,
      type: "distance",
      a: { kind: "node", nodeId: `skid_A_n01` },
      b: { kind: "node", nodeId: `skid_B_n01` },
      label: "Entraxe Y = 1 200 mm",
      offset: { x: -50, y: 0 },
      unit: "mm",
    },
    {
      id: `skid_dim_space2`,
      type: "distance",
      a: { kind: "node", nodeId: `skid_B_n01` },
      b: { kind: "node", nodeId: `skid_C_n01` },
      label: "Entraxe Y = 1 200 mm",
      offset: { x: -50, y: 0 },
      unit: "mm",
    }
  );

  const cad2dEntities: Cad2dEntity[] = [
    {
      id: uid("cad"),
      type: "text",
      layerId: "0",
      color: "#F59E0B",
      center: { x: 100, y: 100 },
      text: "SKID DE FILTRATION INDUSTRIEL ASME B31.3",
      fontSize: 16,
    },
    {
      id: uid("cad"),
      type: "text",
      layerId: "0",
      color: "#9CA3AF",
      center: { x: 100, y: 125 },
      text: "3 Lignes complètes avec coudes 90° bas/haut, vannes et collecteur supérieur",
      fontSize: 11,
    },
  ];

  const cad2dLayers: Cad2dLayer[] = [
    { id: "0", name: "Défaut", color: "#FFFFFF", visible: true, locked: false },
  ];

  return {
    projectName: "Skid de Filtration ASME - 3 Lignes Parallèles",
    wilaya: "Hassi Messaoud (Skid)",
    pressDesign: 50,
    lines,
    nodes,
    segments,
    dimensions,
    supports,
    cad2dEntities,
    cad2dLayers,
    envelopeActive: true,
    envelopeLength: 6.0,
    envelopeWidth: 4.5,
    envelopeHeight: 2.8,
    envelopeX: -0.3,
    envelopeY: -0.3,
    envelopeZ: 0.0,
    envelopePreset: "skid_filtration",
  };
}
