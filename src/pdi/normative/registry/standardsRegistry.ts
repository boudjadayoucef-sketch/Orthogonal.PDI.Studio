/**
 * PDI NORMATIVE ENGINE — STANDARDS REGISTRY
 * Reference: PATCH NORM-01
 * 
 * Registre central, typé, déterministe et immuable des standards industriels référencés.
 * 
 * RÈGLE ABSOLUE :
 * Ce registre contient UNIQUEMENT l'identité et la classification des standards.
 * Il ne contient AUCUNE table dimensionnelle, AUCUNE formule, AUCUN calcul,
 * AUCUNE limite de pression, température, épaisseur ou équivalence automatique.
 * Les éditions non vérifiées de manière absolue sont laissées à `undefined`.
 */

import type {
  NormativeStandard,
  StandardId,
  DesignCodeId,
  ProductStandardId,
  DimensionalStandardId,
  MaterialStandardId,
} from "../types/normativeCoreTypes";

/**
 * Registre d'identification des standards industriels PDI.
 * Déclaré comme un dictionnaire immuable (Readonly<Record<StandardId, NormativeStandard>>).
 */
export const PDI_STANDARDS_REGISTRY: Readonly<Record<StandardId, NormativeStandard>> = Object.freeze({
  // =========================================================================
  // 1. CODES DE CONCEPTION (DESIGN CODES)
  // =========================================================================
  "ASME-B31.3": Object.freeze({
    id: "ASME-B31.3",
    organization: "ASME",
    code: "B31.3",
    title: "Process Piping",
    domain: "INDUSTRIAL_PIPING",
    standardType: "DESIGN_CODE",
    status: "ACTIVE",
    edition: undefined, // Non vérifiée dans le socle NORM-01
  }),

  "ASME-B31.4": Object.freeze({
    id: "ASME-B31.4",
    organization: "ASME",
    code: "B31.4",
    title: "Pipeline Transportation Systems for Liquids and Slurries",
    domain: "PIPELINE",
    standardType: "DESIGN_CODE",
    status: "ACTIVE",
    edition: undefined,
  }),

  "ASME-B31.8": Object.freeze({
    id: "ASME-B31.8",
    organization: "ASME",
    code: "B31.8",
    title: "Gas Transmission and Distribution Piping Systems",
    domain: "PIPELINE",
    standardType: "DESIGN_CODE",
    status: "ACTIVE",
    edition: Object.freeze({
      year: "2022",
      revision: "Revision of ASME B31.8-2020",
      effectiveDate: "2022-12-22",
      notes: "Code pour réseaux de transport et distribution de gaz, stations de compression, calculs MAOP et gaz acide (Sour Gas)",
    }),
  }),

  "ASME-B31.12": Object.freeze({
    id: "ASME-B31.12",
    organization: "ASME",
    code: "B31.12",
    title: "Hydrogen Piping and Pipelines",
    domain: "INDUSTRIAL_PIPING",
    standardType: "DESIGN_CODE",
    status: "ACTIVE",
    edition: Object.freeze({
      year: "2019",
      revision: "Revision of ASME B31.12-2014",
      effectiveDate: "2019-12-20",
      notes: "Code pour tuyauteries industrielles (Part IP) et canalisations (Part PL) d'hydrogène gazeux et liquide, tenue à la fragilisation HE",
    }),
  }),

  "ISO-13623": Object.freeze({
    id: "ISO-13623",
    organization: "ISO",
    code: "13623",
    title: "Petroleum and natural gas industries — Pipeline transportation systems",
    domain: "PIPELINE",
    standardType: "DESIGN_CODE",
    status: "ACTIVE",
    edition: undefined,
  }),

  "EN-13480": Object.freeze({
    id: "EN-13480",
    organization: "EN",
    code: "EN 13480",
    title: "Metallic industrial piping",
    domain: "INDUSTRIAL_PIPING",
    standardType: "DESIGN_CODE",
    status: "ACTIVE",
    edition: undefined,
  }),

  // =========================================================================
  // 2. STANDARDS PRODUITS & RACCORDEMENTS (PRODUCT STANDARDS)
  // =========================================================================
  "ASME-B16.5": Object.freeze({
    id: "ASME-B16.5",
    organization: "ASME",
    code: "B16.5",
    title: "Pipe Flanges and Flanged Fittings: NPS 1/2 through NPS 24 Metric/Inch Standard",
    domain: "FLANGE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "ASME-B16.47": Object.freeze({
    id: "ASME-B16.47",
    organization: "ASME",
    code: "B16.47",
    title: "Large Diameter Steel Flanges: NPS 26 Through NPS 60 Metric/Inch Standard",
    domain: "FLANGE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "ASME-B16.9": Object.freeze({
    id: "ASME-B16.9",
    organization: "ASME",
    code: "B16.9",
    title: "Factory-Made Wrought Buttwelding Fittings",
    domain: "FITTING",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "ASME-B16.11": Object.freeze({
    id: "ASME-B16.11",
    organization: "ASME",
    code: "B16.11",
    title: "Forged Fittings, Socket-Welding and Threaded",
    domain: "FITTING",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "EN-1092-1": Object.freeze({
    id: "EN-1092-1",
    organization: "EN",
    code: "EN 1092-1",
    title: "Flanges and their joints - Circular flanges for pipes, valves, fittings and accessories, PN designated",
    domain: "FLANGE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "DIN-FLANGES-LEGACY": Object.freeze({
    id: "DIN-FLANGES-LEGACY",
    organization: "DIN",
    code: "DIN Series",
    title: "Deutsches Institut für Normung - Historical / Legacy Flange Standards Reference (superseded by EN 1092-1)",
    domain: "FLANGE",
    standardType: "PRODUCT_STANDARD",
    status: "SUPERSEDED",
    edition: undefined,
  }),

  // =========================================================================
  // 3. STANDARDS DIMENSIONNELS (DIMENSIONAL STANDARDS)
  // =========================================================================
  "ASME-B36.10M": Object.freeze({
    id: "ASME-B36.10M",
    organization: "ASME",
    code: "B36.10M",
    title: "Welded and Seamless Wrought Steel Pipe",
    domain: "PIPE",
    standardType: "DIMENSIONAL_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "ASME-B36.19M": Object.freeze({
    id: "ASME-B36.19M",
    organization: "ASME",
    code: "B36.19M",
    title: "Stainless Steel Pipe",
    domain: "PIPE",
    standardType: "DIMENSIONAL_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "ASME-B16.10": Object.freeze({
    id: "ASME-B16.10",
    organization: "ASME",
    code: "B16.10",
    title: "Face-to-Face and End-to-End Dimensions of Valves",
    domain: "VALVE",
    standardType: "DIMENSIONAL_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  // =========================================================================
  // 4. STANDARDS MATÉRIAUX & ROBINETTERIE API (MATERIAL & VALVE STANDARDS)
  // =========================================================================
  "API-5L": Object.freeze({
    id: "API-5L",
    organization: "API",
    code: "5L",
    title: "Specification for Line Pipe",
    domain: "PIPE",
    standardType: "MATERIAL_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "API-6D": Object.freeze({
    id: "API-6D",
    organization: "API",
    code: "6D",
    title: "Specification for Pipeline and Piping Valves",
    domain: "VALVE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "API-594": Object.freeze({
    id: "API-594",
    organization: "API",
    code: "594",
    title: "Check Valves: Flanged, Lug, Wafer, and Butt-welding",
    domain: "VALVE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "API-600": Object.freeze({
    id: "API-600",
    organization: "API",
    code: "600",
    title: "Steel Gate Valves - Flanged and Butt-welding Ends, Bolted Bonnets",
    domain: "VALVE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "API-602": Object.freeze({
    id: "API-602",
    organization: "API",
    code: "602",
    title: "Gate, Globe, and Check Valves for Sizes DN 100 (NPS 4) and Smaller for the Petroleum and Natural Gas Industries",
    domain: "VALVE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),

  "API-609": Object.freeze({
    id: "API-609",
    organization: "API",
    code: "609",
    title: "Butterfly Valves: Double-flanged, Lug- and Wafer-type",
    domain: "VALVE",
    standardType: "PRODUCT_STANDARD",
    status: "ACTIVE",
    edition: undefined,
  }),
});

/**
 * Fonctions de consultation pures et immuables du registre normatif.
 */

/**
 * Récupère un standard par son identifiant strict.
 */
export function getNormativeStandard(id: StandardId): NormativeStandard | undefined {
  return PDI_STANDARDS_REGISTRY[id];
}

/**
 * Retourne la liste complète de tous les standards enregistrés.
 */
export function getAllNormativeStandards(): readonly NormativeStandard[] {
  return Object.values(PDI_STANDARDS_REGISTRY);
}

/**
 * Filtre les standards par type fonctionnel (DESIGN_CODE, PRODUCT_STANDARD, etc.).
 */
export function getStandardsByType(type: NormativeStandard["standardType"]): readonly NormativeStandard[] {
  return Object.values(PDI_STANDARDS_REGISTRY).filter((s) => s.standardType === type);
}

/**
 * Filtre les standards par organisation (ASME, API, ISO, EN, DIN).
 */
export function getStandardsByOrganization(org: NormativeStandard["organization"]): readonly NormativeStandard[] {
  return Object.values(PDI_STANDARDS_REGISTRY).filter((s) => s.organization === org);
}

/**
 * Filtre les standards par domaine (PIPING, PIPE, FLANGE, VALVE, etc.).
 */
export function getStandardsByDomain(domain: NormativeStandard["domain"]): readonly NormativeStandard[] {
  return Object.values(PDI_STANDARDS_REGISTRY).filter((s) => s.domain === domain);
}
