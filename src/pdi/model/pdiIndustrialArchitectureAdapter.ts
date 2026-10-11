/**
 * PDI INDUSTRIAL ARCHITECTURE — ARCH-07 ADAPTER & BOUNDARY ENFORCEMENT
 * Reference: ARCH-07 (Client Neutral Architecture & Industrialization Boundary)
 *
 * Pure functions providing:
 * 1. Architecture layer boundary validation (Product Core vs Normative vs Client vs Commercial)
 * 2. Client-neutral Organization Profile management (replacing historical hardcoded client names)
 * 3. Product Core MTO / BOM generation (strictly physical/engineering, zero commercial fields)
 * 4. Commercial / EPC Bill of Quantities (BoQ), Unit Rate Library & Cost Estimation
 * 5. Client-neutrality verification across data payloads
 */

import type {
  PdiArchitectureLayerId,
  PdiOrganizationProfile,
  PdiEngineeringMtoItem,
  PdiEngineeringBomSummary,
  PdiMtoCategory,
  PdiEpcWorkPackageCode,
  PdiUnitRateEntry,
  PdiUnitRateLibrary,
  PdiBoqLineItem,
  PdiProjectCostEstimate,
  PdiClientNeutralityAuditRecord,
} from "./pdiIndustrialArchitecture";
import {
  PDI_ARCHITECTURE_LAYERS,
  PDI_NEUTRAL_ORGANIZATION_PROFILE,
} from "./pdiIndustrialArchitecture";
import type { IsoNode, IsoSegment } from "../isometric/types/isoGraphTypes";

// ============================================================================
// 1. ARCHITECTURAL BOUNDARY VALIDATION
// ============================================================================

export interface PdiLayerDependencyValidationResult {
  readonly allowed: boolean;
  readonly sourceLayer: PdiArchitectureLayerId;
  readonly targetLayer: PdiArchitectureLayerId;
  readonly reason: string;
}

/**
 * Validates whether `sourceLayer` is architecturally allowed to depend on `targetLayer`.
 * Enforces:
 * - NORMATIVE_ENGINEERING_DATA depends on nothing
 * - PRODUCT_CORE depends ONLY on NORMATIVE_ENGINEERING_DATA (never on CLIENT_PROJECT_DATA or INDUSTRIAL_COMMERCIAL_DATA)
 * - INDUSTRIAL_COMMERCIAL_DATA depends on PRODUCT_CORE and CLIENT_PROJECT_DATA (never vice-versa)
 */
export function validateArchitectureLayerDependency(
  sourceLayer: PdiArchitectureLayerId,
  targetLayer: PdiArchitectureLayerId
): PdiLayerDependencyValidationResult {
  if (sourceLayer === targetLayer) {
    return {
      allowed: true,
      sourceLayer,
      targetLayer,
      reason: `Intra-layer dependency within ${sourceLayer} is permitted.`,
    };
  }

  const descriptor = PDI_ARCHITECTURE_LAYERS[sourceLayer];
  if (!descriptor) {
    return {
      allowed: false,
      sourceLayer,
      targetLayer,
      reason: `Unknown source architecture layer: ${sourceLayer}`,
    };
  }

  const isAllowed = descriptor.allowedDependencies.includes(targetLayer);
  return {
    allowed: isAllowed,
    sourceLayer,
    targetLayer,
    reason: isAllowed
      ? `${sourceLayer} is explicitly allowed to depend on ${targetLayer}.`
      : `[ARCH-07 BOUNDARY VIOLATION] ${sourceLayer} MUST NOT depend on ${targetLayer}. Allowed dependencies: [${descriptor.allowedDependencies.join(", ")}]`,
  };
}

// ============================================================================
// 2. CLIENT NEUTRALITY AUDIT & VERIFICATION
// ============================================================================

/**
 * Forbidden historical client identifiers in Product Core and default templates.
 */
export const FORBIDDEN_HISTORICAL_CLIENT_PATTERNS: readonly RegExp[] = [
  /\bsonelgaz\b/i,
  /\bsng\/drtg\b/i,
  /\bdrtg\/detn\b/i,
  /\bgrtg-gc\b/i,
  /\bsoci[eé]t[eé]\s+alg[eé]rienne\s+de\s+l['’][eé]lectricit[eé]\s+et\s+du\s+gaz\b/i,
  /\bsoci[eé]t[eé]\s+alg[eé]rienne\s+de\s+distribution\s+du\s+gaz\b/i,
  /الشركة\s+الجزائرية\s+للكهرباء/i,
  /\bdetn\b/i,
  /\bdrtg\b/i,
  /\bgrtg\b/i,
  /\bdistrict\s+gaz\b/i,
  /\btransport\s+du\s+gaz\b/i,
  /\bpd&i-\s*transport\b/i,
];


export interface PdiClientNeutralityCheckResult {
  readonly isNeutral: boolean;
  readonly violations: readonly string[];
}

/**
 * Verifies that a string or serialized payload does not contain hardcoded
 * historical client identities.
 */
export function verifyClientNeutralString(text: string, contextLabel: string = "payload"): PdiClientNeutralityCheckResult {
  const violations: string[] = [];
  for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Forbidden client pattern ${pattern.source} detected in ${contextLabel}`);
    }
  }
  return {
    isNeutral: violations.length === 0,
    violations,
  };
}

/**
 * Complete audit ledger classifying historical occurrences per ARCH-07 Section 1:
 * A_DELETE, B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA, C_KEEP_GENERIC_INDUSTRIAL.
 */
export const ARCH07_CLIENT_NEUTRALITY_AUDIT_LEDGER: readonly PdiClientNeutralityAuditRecord[] = [
  {
    recordId: "AUDIT-01",
    path: "src/assets/images/sonelgaz_*.jpg",
    fileOrModule: "src/assets/images/sonelgaz_*.jpg",
    historicalPattern: "sonelgaz_bg, sonelgaz_header, sonelgaz_logo image assets",
    classification: "A_DELETE",
    action: "A_DELETE",
    status: "DONE",
    reason: "Removed unused historical client image assets from repository.",
    resolutionSummary: "Removed unused historical client image assets from repository.",
  },
  {
    recordId: "AUDIT-02",
    path: "src/components/Calculators.tsx",
    fileOrModule: "src/components/Calculators.tsx",
    historicalPattern: "Hardcoded 'Société algérienne de l'électricité et du gaz', 'SNG/DRTG/DETN', 'GRTG-GC-2026-001', 'Official PD&I Transport du Gaz Header', 'Pour PD&I / Division Engineering (DETN)'",
    classification: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    action: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    status: "DONE",
    reason: "Neutralized header and signatures; replaced historical client identity with generic PDI-ENG and configurable profile.",
    resolutionSummary: "Replaced with configurable PdiOrganizationProfile / pdiBranding headers and generic PDI-ENG references.",
  },
  {
    recordId: "AUDIT-03",
    path: "src/components/project-management/views/RapportMensuelView.tsx & useExportHandlers.ts",
    fileOrModule: "src/components/project-management/views/RapportMensuelView.tsx & useExportHandlers.ts",
    historicalPattern: "Hardcoded Arabic/French Sonelgaz, DETN and Transport du Gaz headers in reports and Word/PDF exports",
    classification: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    action: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    status: "DONE",
    reason: "Replaced with configurable client-neutral PD&I / Organization Profile headers and department signatures.",
    resolutionSummary: "Replaced with configurable client-neutral PD&I / Organization Profile headers.",
  },
  {
    recordId: "AUDIT-04",
    path: "src/components/Forms.tsx",
    fileOrModule: "src/components/Forms.tsx",
    historicalPattern: "Hardcoded 'Transport du Gaz', 'CMD/DETN/042-2026', 'DETN - Division Engineering et Travaux Neufs', 'District Gaz Centre', 'DCET'",
    classification: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    action: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    status: "DONE",
    reason: "Replaced historical departmental/district hardcodes with configurable engineering management and regional operations center.",
    resolutionSummary: "Replaced with configurable organization header from PdiOrganizationProfile.",
  },
  {
    recordId: "AUDIT-05",
    path: "src/components/project-management/views/BordereauPrixView.tsx & constants.ts",
    fileOrModule: "src/components/project-management/views/BordereauPrixView.tsx & constants.ts",
    historicalPattern: "Bordereau des Prix / BPU / EPC contract pricing / Division Engineering et Travaux Neufs (DETN)",
    classification: "C_KEEP_GENERIC_INDUSTRIAL",
    action: "C_KEEP_GENERIC_INDUSTRIAL",
    status: "DONE",
    reason: "Preserved and formalized as generic industrial Bill of Quantities (BoQ) / Price Schedule / Cost Estimation in Layer 4 with neutral engineering notice.",
    resolutionSummary: "Preserved and formalized as generic industrial Bill of Quantities (BoQ) / Price Schedule / Cost Estimation in Layer 4.",
  },
  {
    recordId: "AUDIT-06",
    path: "src/pdi/isometric/supports/pdiMssSupportEngine.ts & IsometrieModuleV48d.tsx",
    fileOrModule: "src/pdi/isometric/supports/pdiMssSupportEngine.ts & IsometrieModuleV48d.tsx",
    historicalPattern: "MTO / BOM / Spool / Civil quantities",
    classification: "C_KEEP_GENERIC_INDUSTRIAL",
    action: "C_KEEP_GENERIC_INDUSTRIAL",
    status: "DONE",
    reason: "Preserved in Product Core (Layer 1) with pure physical/dimensional data and zero commercial pricing fields.",
    resolutionSummary: "Preserved in Product Core (Layer 1) with zero commercial pricing fields.",
  },
  {
    recordId: "AUDIT-07",
    path: "src/components/project-management/constants.ts & useProjectsData.ts",
    fileOrModule: "src/components/project-management/constants.ts & useProjectsData.ts",
    historicalPattern: "Région de transport gaz ... / District Gaz ... / Département Travaux Neufs - TG Alger",
    classification: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    action: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    status: "DONE",
    reason: "Standardized regions to neutral administrative territories and project organizational structures without client hardcoding.",
    resolutionSummary: "Replaced with neutral geographical regions and organizational structures.",
  },
  {
    recordId: "AUDIT-08",
    path: "src/components/project-management/views/gestion/EditProjectForm.tsx & IdentityTab.tsx",
    fileOrModule: "src/components/project-management/views/gestion/EditProjectForm.tsx & IdentityTab.tsx",
    historicalPattern: "District Gaz / Direction Régionale TG / Pôle de rattachement TG",
    classification: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    action: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    status: "DONE",
    reason: "Converted form selectors and labels into generic project management entities (District / Direction Régionale / Pôle).",
    resolutionSummary: "Converted to client-neutral project management form labels and selectors.",
  },
  {
    recordId: "AUDIT-09",
    path: "src/components/ProjectManagement.tsx & projectUtils.ts",
    fileOrModule: "src/components/ProjectManagement.tsx & projectUtils.ts",
    historicalPattern: "ouvrages de transport gaz PD&I / schéma directeur de transport gaz",
    classification: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    action: "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA",
    status: "DONE",
    reason: "Updated governance and milestone descriptions to cover generic industrial pipelines and networks.",
    resolutionSummary: "Updated to generic industrial pipeline infrastructure descriptions.",
  },
  {
    recordId: "AUDIT-10",
    path: "src/pdi/catalog/trouvayCauvinCatalog.ts",
    fileOrModule: "src/pdi/catalog/trouvayCauvinCatalog.ts",
    historicalPattern: "Poste de sectionnement de ligne transport gaz",
    classification: "C_KEEP_GENERIC_INDUSTRIAL",
    action: "C_KEEP_GENERIC_INDUSTRIAL",
    status: "DONE",
    reason: "Mainline Block Valve Station preserved as generic industrial piping station with international terminology.",
    resolutionSummary: "Preserved as generic industrial pipeline station definition.",
  },
];

// ============================================================================
// 3. CONFIGURABLE ORGANIZATION PROFILE (LAYER 3: CLIENT_PROJECT_DATA)
// ============================================================================

export function createOrganizationProfile(
  overrides?: Partial<PdiOrganizationProfile>
): PdiOrganizationProfile {
  return {
    ...PDI_NEUTRAL_ORGANIZATION_PROFILE,
    ...overrides,
    companyName: overrides?.companyName?.trim() || PDI_NEUTRAL_ORGANIZATION_PROFILE.companyName,
    documentReferencePrefix:
      overrides?.documentReferencePrefix?.trim() || PDI_NEUTRAL_ORGANIZATION_PROFILE.documentReferencePrefix,
    defaultPlanNumberPrefix:
      overrides?.defaultPlanNumberPrefix?.trim() || PDI_NEUTRAL_ORGANIZATION_PROFILE.defaultPlanNumberPrefix,
    defaultCurrencyCode:
      overrides?.defaultCurrencyCode?.trim() || PDI_NEUTRAL_ORGANIZATION_PROFILE.defaultCurrencyCode,
    defaultTaxRatePercent:
      typeof overrides?.defaultTaxRatePercent === "number"
        ? overrides.defaultTaxRatePercent
        : PDI_NEUTRAL_ORGANIZATION_PROFILE.defaultTaxRatePercent,
  };
}

/**
 * Builds a client-neutral document reference string for BoQ, Reports, or Certificates.
 */
export function buildNeutralDocumentReference(
  profile: PdiOrganizationProfile,
  docTypeCode: "BOQ" | "MTO" | "BOM" | "MTR" | "RPT" | "DWG",
  year: number = new Date().getFullYear(),
  sequenceOrId?: string
): string {
  const prefix = profile.documentReferencePrefix || "PDI/ENG";
  const seq = sequenceOrId ? `/${sequenceOrId}` : "";
  return `${prefix}/${year}/${docTypeCode}${seq}`;
}

// ============================================================================
// 4. PRODUCT CORE: ENGINEERING MTO & BOM (LAYER 1: PRODUCT_CORE)
// ============================================================================

/**
 * Generates a pure Engineering BOM / MTO summary from isometric graph nodes & segments.
 *
 * STRICT INVARIANT (ARCH-07 Section 4):
 * - Belongs to PRODUCT_CORE.
 * - Contains ONLY physical/engineering quantities (m, u) and technical attributes.
 * - NEVER contains unit prices, currency, tax, or commercial fields.
 * - NEVER fabricates missing dimensions or schedules.
 */
export function buildEngineeringBomFromGraph(
  projectId: string,
  documentId: string,
  nodes: readonly IsoNode[],
  segments: readonly IsoSegment[]
): PdiEngineeringBomSummary {
  const items: PdiEngineeringMtoItem[] = [];
  let itemNumber = 1;
  let totalPipeLengthM = 0;

  // 1. Equipment nodes
  for (const node of nodes) {
    if (!node.equipmentType) continue;
    const category: PdiMtoCategory =
      node.equipmentType.startsWith("vanne_") ||
      node.equipmentType.startsWith("clapet") ||
      node.equipmentType === "soupape" ||
      node.equipmentType === "robinet_pointeau"
        ? "VALVE"
        : node.equipmentType.startsWith("bride_")
        ? "FLANGE"
        : "EQUIPMENT";

    items.push({
      mtoItemId: `MTO_NODE_${node.id}`,
      itemNumber: itemNumber++,
      category,
      itemCode: node.equipmentType.toUpperCase(),
      designation: node.equipmentLabel || node.name || node.equipmentType,
      nominalDiameterMm: typeof node.dn === "number" ? node.dn : undefined,
      pressureRating: node.pn || undefined,
      materialSpec: node.material || undefined,
      scheduleOrThickness: node.schedule || undefined,
      standardReference: node.reference || undefined,
      quantity: 1,
      unit: "u",
      totalLengthM: typeof node.length === "number" ? node.length : undefined,
      spoolId: node.spoolNumber || undefined,
      lineId: node.lineId || undefined,
      sourceEntityIds: [node.id],
      engineeringStatus: "DERIVED_FROM_MODEL",
    });
  }

  // 2. Pipe segments and inline fittings
  for (const seg of segments) {
    const segLength = typeof seg.length === "number" && seg.length > 0 ? seg.length : 0;
    totalPipeLengthM += segLength;

    items.push({
      mtoItemId: `MTO_SEG_${seg.id}`,
      itemNumber: itemNumber++,
      category: "PIPE",
      itemCode: `PIPE_DN${seg.dn}`,
      designation: seg.material ? `Pipe ${seg.material}` : "Pipe Segment",
      nominalDiameterMm: typeof seg.dn === "number" ? seg.dn : undefined,
      pressureRating: seg.pressureClass || seg.pn || undefined,
      materialSpec: seg.material || undefined,
      scheduleOrThickness: seg.schedule || undefined,
      quantity: segLength,
      unit: "m",
      totalLengthM: segLength,
      spoolId: seg.spoolNumber || undefined,
      lineId: seg.lineId || undefined,
      sourceEntityIds: [seg.id],
      engineeringStatus: "DERIVED_FROM_MODEL",
    });

    for (const fit of seg.fittings || []) {
      const fitCategory: PdiMtoCategory = fit.type.startsWith("bride_")
        ? "FLANGE"
        : fit.type === "joint" || fit.type === "jmi"
        ? "FASTENER_GASKET"
        : fit.type.startsWith("vanne_") || fit.type.startsWith("clapet")
        ? "VALVE"
        : "FITTING";

      items.push({
        mtoItemId: `MTO_FIT_${fit.id}`,
        itemNumber: itemNumber++,
        category: fitCategory,
        itemCode: fit.type.toUpperCase(),
        designation: fit.label || fit.type,
        nominalDiameterMm: typeof fit.dn === "number" ? fit.dn : typeof seg.dn === "number" ? seg.dn : undefined,
        pressureRating: seg.pressureClass || seg.pn || undefined,
        materialSpec: seg.material || undefined,
        standardReference: fit.reference || undefined,
        quantity: 1,
        unit: "u",
        totalLengthM: typeof fit.length === "number" ? fit.length : undefined,
        spoolId: seg.spoolNumber || undefined,
        lineId: seg.lineId || undefined,
        sourceEntityIds: [fit.id, seg.id],
        engineeringStatus: "DERIVED_FROM_MODEL",
      });
    }
  }

  return {
    bomId: `BOM_${projectId}_${documentId}`,
    projectId,
    documentId,
    generatedAtIso: new Date().toISOString(),
    items,
    totalPipeLengthM: Number(totalPipeLengthM.toFixed(3)),
    totalComponentCount: items.length,
  };
}

/**
 * Verifies that an Engineering BOM / MTO summary is strictly pure Product Core data
 * and contains zero commercial / pricing properties.
 */
export function verifyPureEngineeringBom(bom: PdiEngineeringBomSummary): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  const forbiddenKeys = ["unitPrice", "price", "currencyCode", "amountExclTax", "taxRate", "totalTTC", "totalHT"];

  for (const item of bom.items) {
    const raw = item as unknown as Record<string, unknown>;
    for (const key of forbiddenKeys) {
      if (key in raw && raw[key] !== undefined) {
        errors.push(`MTO item ${item.mtoItemId} contains forbidden commercial property '${key}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 5. INDUSTRIAL / COMMERCIAL DOMAIN: BOQ, PRICE SCHEDULE & COST ESTIMATION (LAYER 4)
// ============================================================================

/**
 * Standard generic industrial Unit Rate Library (Price Schedule / Bordereau des Prix Unitaires).
 * Configurable currency and unit rates.
 */
export function createDefaultIndustrialUnitRateLibrary(
  currencyCode: string = "EUR",
  defaultTaxRatePercent: number = 20,
  customRates?: Readonly<Record<string, number>>
): PdiUnitRateLibrary {
  const getRate = (id: string, fallback: number): number =>
    customRates && typeof customRates[id] === "number" ? customRates[id] : fallback;

  const entries: PdiUnitRateEntry[] = [
    // Work Package 01: Engineering & Studies
    {
      rateId: "impact",
      itemCode: "1.1",
      workPackage: "WP_01_ENGINEERING_STUDIES",
      designation: "Environmental Impact Assessment (EIA) & Regulatory Hydraulic Notice",
      unit: "LS",
      unitPrice: getRate("impact", 1500000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "topo",
      itemCode: "1.2",
      workPackage: "WP_01_ENGINEERING_STUDIES",
      designation: "Precision Topographical Survey, Route Delineation & Centerline Staking",
      unit: "km",
      unitPrice: getRate("topo", 45000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "geo",
      itemCode: "1.3",
      workPackage: "WP_01_ENGINEERING_STUDIES",
      designation: "Geotechnical Investigation (Boreholes, Soil Resistivity & Lab Testing)",
      unit: "u",
      unitPrice: getRate("geo", 120000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "ing",
      itemCode: "1.4",
      workPackage: "WP_01_ENGINEERING_STUDIES",
      designation: "Detailed Engineering Calculations, Hydraulic/Mechanical Sizing & IFC Drawings",
      unit: "LS",
      unitPrice: getRate("ing", 3000000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "dup",
      itemCode: "1.5",
      workPackage: "WP_01_ENGINEERING_STUDIES",
      designation: "Right-of-Way (RoW) Administrative Permitting & Public Utility Dossier",
      unit: "LS",
      unitPrice: getRate("dup", 800000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    // Work Package 02: Inspection, NDT & QA/QC
    {
      rateId: "enq",
      itemCode: "2.1",
      workPackage: "WP_02_INSPECTION_NDT_QAQC",
      designation: "Cadastral Land Survey & Right-of-Way Parcel Identification",
      unit: "u",
      unitPrice: getRate("enq", 150000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "exp",
      itemCode: "2.2",
      workPackage: "WP_02_INSPECTION_NDT_QAQC",
      designation: "Land Valuation & Easement Compensation Assessment Dossiers",
      unit: "u",
      unitPrice: getRate("exp", 80000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "assist",
      itemCode: "2.3",
      workPackage: "WP_02_INSPECTION_NDT_QAQC",
      designation: "Right-of-Way Legal Easement & Administrative Clearance Support",
      unit: "LS",
      unitPrice: getRate("assist", 250000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "cnd",
      itemCode: "2.4",
      workPackage: "WP_02_INSPECTION_NDT_QAQC",
      designation: "Non-Destructive Testing (NDT) & 100% Radiographic Inspection of Welded Joints",
      unit: "u",
      unitPrice: getRate("cnd", 4500),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "audit",
      itemCode: "2.5",
      workPackage: "WP_02_INSPECTION_NDT_QAQC",
      designation: "Third-Party QA/QC Material Compliance Audit & Mill Test Certificate Review",
      unit: "man-day",
      unitPrice: getRate("audit", 65000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    // Work Package 03: Construction & Installation
    {
      rateId: "piste",
      itemCode: "3.1",
      workPackage: "WP_03_CONSTRUCTION_INSTALLATION",
      designation: "Right-of-Way Grading, Topsoil Stripping & Trench Excavation",
      unit: "m3",
      unitPrice: getRate("piste", 12000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "lit",
      itemCode: "3.2",
      workPackage: "WP_03_CONSTRUCTION_INSTALLATION",
      designation: "Sand Bedding Supply & Placement (20 cm Pipe Protection Layer)",
      unit: "m3",
      unitPrice: getRate("lit", 4000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "soudage",
      itemCode: "3.3",
      workPackage: "WP_03_CONSTRUCTION_INSTALLATION",
      designation: "Cold Field Bending, Stringing, Alignment & Qualified High-Pressure Welding",
      unit: "u",
      unitPrice: getRate("soudage", 18000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "enrobage",
      itemCode: "3.4",
      workPackage: "WP_03_CONSTRUCTION_INSTALLATION",
      designation: "Coating Holiday Detection, Field Joint Coating & Insulation Integrity",
      unit: "LS",
      unitPrice: getRate("enrobage", 85000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "protection",
      itemCode: "3.10",
      workPackage: "WP_03_CONSTRUCTION_INSTALLATION",
      designation: "Impressed Current Cathodic Protection (ICCP) System & Test Stations",
      unit: "LS",
      unitPrice: getRate("protection", 3500000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
    {
      rateId: "epreuve",
      itemCode: "3.11",
      workPackage: "WP_05_COMMISSIONING_TESTING",
      designation: "Hydrostatic Strength & Leak Testing of Pipeline Section",
      unit: "LS",
      unitPrice: getRate("epreuve", 150000),
      currencyCode,
      rateSource: "CONTRACT_PRICE_SCHEDULE",
    },
  ];

  return {
    libraryId: "LIB_PDI_STANDARD_EPC",
    libraryName: "PD&I Standard EPC Price Schedule (BoQ / BPU)",
    currencyCode,
    defaultTaxRatePercent,
    entries,
  };
}

export interface PdiBoqQuantityInput {
  readonly boqItemId: string;
  readonly code: string;
  readonly workPackage: PdiEpcWorkPackageCode;
  readonly designation: string;
  readonly unit: string;
  readonly quantity: number;
  readonly quantityFormulaNote?: string;
  readonly linkedMtoItemIds?: readonly string[];
  readonly rateId?: string;
  readonly explicitUnitPrice?: number;
}

/**
 * Evaluates a Bill of Quantities (BoQ) / Cost Estimate from physical quantities
 * and a Unit Rate Library.
 *
 * STRICT INVARIANT:
 * - Never fabricates a price if neither `explicitUnitPrice` nor a matching library rate exists.
 * - Marks items without a known price as `costStatus: "UNVERIFIED_COST"`.
 */
export function evaluateProjectCostEstimate(params: {
  readonly estimateId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly organizationProfile?: PdiOrganizationProfile;
  readonly unitRateLibrary: PdiUnitRateLibrary;
  readonly quantities: readonly PdiBoqQuantityInput[];
  readonly taxRatePercentOverride?: number;
}): PdiProjectCostEstimate {
  const profile = params.organizationProfile || PDI_NEUTRAL_ORGANIZATION_PROFILE;
  const currencyCode = params.unitRateLibrary.currencyCode || profile.defaultCurrencyCode;
  const taxRatePercent =
    typeof params.taxRatePercentOverride === "number"
      ? params.taxRatePercentOverride
      : params.unitRateLibrary.defaultTaxRatePercent;

  const rateMap = new Map<string, PdiUnitRateEntry>();
  for (const entry of params.unitRateLibrary.entries) {
    rateMap.set(entry.rateId, entry);
    rateMap.set(entry.itemCode, entry);
  }

  const items: PdiBoqLineItem[] = [];
  let totalExclTax = 0;
  let unverifiedItemCount = 0;

  for (const q of params.quantities) {
    const matchedEntry =
      (q.rateId ? rateMap.get(q.rateId) : undefined) ?? rateMap.get(q.code);
    const resolvedUnitPrice =
      typeof q.explicitUnitPrice === "number"
        ? q.explicitUnitPrice
        : matchedEntry?.unitPrice;

    if (q.quantity === 0) {
      items.push({
        boqItemId: q.boqItemId,
        code: q.code,
        workPackage: q.workPackage,
        designation: q.designation,
        unit: q.unit,
        quantity: 0,
        quantityFormulaNote: q.quantityFormulaNote,
        linkedMtoItemIds: q.linkedMtoItemIds,
        unitPrice: resolvedUnitPrice,
        currencyCode,
        amountExclTax: 0,
        costStatus: "ZERO_QUANTITY",
      });
      continue;
    }

    if (typeof resolvedUnitPrice !== "number" || Number.isNaN(resolvedUnitPrice)) {
      unverifiedItemCount++;
      items.push({
        boqItemId: q.boqItemId,
        code: q.code,
        workPackage: q.workPackage,
        designation: q.designation,
        unit: q.unit,
        quantity: q.quantity,
        quantityFormulaNote: q.quantityFormulaNote,
        linkedMtoItemIds: q.linkedMtoItemIds,
        unitPrice: undefined,
        currencyCode,
        amountExclTax: undefined,
        costStatus: "UNVERIFIED_COST",
      });
      continue;
    }

    const amountExclTax = Number((q.quantity * resolvedUnitPrice).toFixed(2));
    totalExclTax += amountExclTax;

    items.push({
      boqItemId: q.boqItemId,
      code: q.code,
      workPackage: q.workPackage,
      designation: q.designation,
      unit: q.unit,
      quantity: q.quantity,
      quantityFormulaNote: q.quantityFormulaNote,
      linkedMtoItemIds: q.linkedMtoItemIds,
      unitPrice: resolvedUnitPrice,
      currencyCode,
      amountExclTax,
      costStatus: "PRICED_EXPLICIT",
    });
  }

  totalExclTax = Number(totalExclTax.toFixed(2));
  const totalTaxAmount = Number(((totalExclTax * taxRatePercent) / 100).toFixed(2));
  const totalInclTax = Number((totalExclTax + totalTaxAmount).toFixed(2));

  return {
    estimateId: params.estimateId,
    projectId: params.projectId,
    projectName: params.projectName,
    documentReference: buildNeutralDocumentReference(profile, "BOQ"),
    currencyCode,
    taxRatePercent,
    items,
    totalExclTax,
    totalTaxAmount,
    totalInclTax,
    hasUnverifiedCosts: unverifiedItemCount > 0,
    unverifiedItemCount,
  };
}

/**
 * Bridges an Engineering BOM (Layer 1: PRODUCT_CORE) to a Commercial BoQ Cost Estimate
 * (Layer 4: INDUSTRIAL_COMMERCIAL_DATA) using an explicit Unit Rate Library, without
 * mutating the Engineering BOM.
 */
export function evaluateBomCommercialCost(
  bom: PdiEngineeringBomSummary,
  unitRateLibrary: PdiUnitRateLibrary,
  organizationProfile?: PdiOrganizationProfile
): PdiProjectCostEstimate {
  const quantities: PdiBoqQuantityInput[] = bom.items.map((mto, idx) => ({
    boqItemId: `BOQ_FROM_${mto.mtoItemId}`,
    code: mto.itemCode || `MTO.${idx + 1}`,
    workPackage: "WP_04_PROCUREMENT_MATERIALS",
    designation: `${mto.designation}${mto.nominalDiameterMm ? ` DN${mto.nominalDiameterMm}` : ""}`,
    unit: mto.unit,
    quantity: mto.quantity,
    quantityFormulaNote: `Derived from Engineering MTO item ${mto.mtoItemId}`,
    linkedMtoItemIds: [mto.mtoItemId],
    rateId: mto.itemCode,
  }));

  return evaluateProjectCostEstimate({
    estimateId: `EST_${bom.bomId}`,
    projectId: bom.projectId,
    projectName: bom.projectId,
    organizationProfile,
    unitRateLibrary,
    quantities,
  });
}
