/**
 * PDI INDUSTRIAL ARCHITECTURE — ARCH-07: CLIENT NEUTRAL ARCHITECTURE & INDUSTRIALIZATION BOUNDARY
 * Reference: ARCH-07 (Client Neutral Architecture & Industrialization Boundary)
 *
 * Defines the strict 6-layer industrial architecture boundaries, client-neutral
 * project/organization profiles, and commercial/costing domain contracts:
 *
 * 1. PRODUCT_CORE — Generic CAD, Isometric, 2D, 3D, Universal Model, MTO, BOM, Spools
 * 2. NORMATIVE_ENGINEERING_DATA — ASME, API, ISO, EN, MSS, Evidence, Compatibility
 * 3. CLIENT_PROJECT_DATA — Configurable organization profile, project templates, nomenclature
 * 4. INDUSTRIAL_COMMERCIAL_DATA — BoQ, Costing, Unit Rates, Price Schedule, EPC Work Packages
 * 5. APPLICATION_UI — Views, Ribbons, Inspectors, Print Sheets, Modals
 * 6. INFRASTRUCTURE_SAAS — Persistence, Auth, Licensing, Multi-tenant Workspace
 *
 * CRITICAL INVARIANTS (ARCH-07):
 * - Product Core NEVER depends on a historical client (zero hardcoded client identity).
 * - Normative Engine NEVER depends on Commercial/Costing data or Client configuration.
 * - MTO / BOM (Product Core) is strictly separated from Costing / BoQ (Commercial Data).
 * - No automatic fabrication of technical or commercial values (missing unit rate = UNVERIFIED_COST).
 */

// ============================================================================
// 1. ARCHITECTURAL LAYERS & BOUNDARY DEFINITIONS
// ============================================================================

export type PdiArchitectureLayerId =
  | "PRODUCT_CORE"
  | "NORMATIVE_ENGINEERING_DATA"
  | "CLIENT_PROJECT_DATA"
  | "INDUSTRIAL_COMMERCIAL_DATA"
  | "APPLICATION_UI"
  | "INFRASTRUCTURE_SAAS";

export interface PdiArchitectureLayerDescriptor {
  readonly layerId: PdiArchitectureLayerId;
  readonly label: string;
  readonly description: string;
  /** Layers that this layer is explicitly allowed to depend on */
  readonly allowedDependencies: readonly PdiArchitectureLayerId[];
  /** Whether this layer is strictly client-neutral */
  readonly isClientNeutral: boolean;
}

export const PDI_ARCHITECTURE_LAYERS: Readonly<Record<PdiArchitectureLayerId, PdiArchitectureLayerDescriptor>> = {
  NORMATIVE_ENGINEERING_DATA: {
    layerId: "NORMATIVE_ENGINEERING_DATA",
    label: "Normative & Engineering Data Authority",
    description:
      "International standards (ASME, API, ISO, EN, MSS), Evidence Model (NORM-09), Compatibility Authority (NORM-13), Design Code Engine.",
    allowedDependencies: [],
    isClientNeutral: true,
  },
  PRODUCT_CORE: {
    layerId: "PRODUCT_CORE",
    label: "Product Core (Engineering & Geometry)",
    description:
      "Universal Model, Multi-Domain Engineering (Piping, Pipeline, Package, Equipment), Technical Workflow (P&ID -> Piping -> Isometric), Catalog Selection, 2D/3D/Iso Engines, Spools, Welds, MTO & BOM.",
    allowedDependencies: ["NORMATIVE_ENGINEERING_DATA"],
    isClientNeutral: true,
  },
  CLIENT_PROJECT_DATA: {
    layerId: "CLIENT_PROJECT_DATA",
    label: "Client & Project Configurable Data",
    description:
      "Configurable organization profile, project metadata, custom tag formats, title block (cartouche) templates, regional settings.",
    allowedDependencies: ["PRODUCT_CORE", "NORMATIVE_ENGINEERING_DATA"],
    isClientNeutral: true,
  },
  INDUSTRIAL_COMMERCIAL_DATA: {
    layerId: "INDUSTRIAL_COMMERCIAL_DATA",
    label: "Industrial & Commercial Data (BoQ / Costing / EPC)",
    description:
      "Bill of Quantities (BoQ), Unit Rate Library, Price Schedule, Cost Estimation, EPC Work Packages, Quantity Take-Off (QTO) valuation.",
    allowedDependencies: ["PRODUCT_CORE", "CLIENT_PROJECT_DATA"],
    isClientNeutral: true,
  },
  APPLICATION_UI: {
    layerId: "APPLICATION_UI",
    label: "Application & User Interface",
    description:
      "Workspaces, 2D/3D/Iso views, Property Inspectors, Print/Export Generators, EPC Project Management & BoQ Views.",
    allowedDependencies: [
      "PRODUCT_CORE",
      "NORMATIVE_ENGINEERING_DATA",
      "CLIENT_PROJECT_DATA",
      "INDUSTRIAL_COMMERCIAL_DATA",
    ],
    isClientNeutral: true,
  },
  INFRASTRUCTURE_SAAS: {
    layerId: "INFRASTRUCTURE_SAAS",
    label: "Infrastructure & SaaS Services",
    description:
      "Cloud persistence, Authentication, Role-Based Access Control (RBAC), Payment/Subscription gateways, Multi-screen channel.",
    allowedDependencies: [
      "PRODUCT_CORE",
      "CLIENT_PROJECT_DATA",
      "INDUSTRIAL_COMMERCIAL_DATA",
      "APPLICATION_UI",
    ],
    isClientNeutral: true,
  },
};

// ============================================================================
// 2. CLIENT & ORGANIZATION PROFILE (LAYER 3: CLIENT_PROJECT_DATA)
// ============================================================================

/**
 * Configurable client / organization profile injected into ProjectContext,
 * print title blocks (cartouches), and official engineering reports.
 * Replaces all historical hardcoded client names, divisions, and logos.
 */
export interface PdiOrganizationProfile {
  readonly organizationId: string;
  readonly companyName: string;
  readonly divisionOrDepartment?: string;
  readonly projectOwner?: string;
  readonly documentReferencePrefix: string;
  readonly defaultPlanNumberPrefix: string;
  readonly logoUrlOrDataUri?: string;
  readonly countryCode?: string;
  readonly regionLabel?: string; // e.g., "Region / Province / State / Wilaya"
  readonly defaultCurrencyCode: string; // e.g., "EUR", "USD", "DZD"
  readonly defaultTaxRatePercent: number; // e.g., 20, 19, 0
  readonly standardsHeaderNote: string;
}

/**
 * Default neutral international organization profile for PD&I.
 * Contains zero reference to any historical client (SONELGAZ, GRTG, etc.).
 */
export const PDI_NEUTRAL_ORGANIZATION_PROFILE: PdiOrganizationProfile = {
  organizationId: "ORG_PDI_DEFAULT",
  companyName: "PD&I — Piping Design & Isometrics",
  divisionOrDepartment: "Engineering & EPC Projects Division",
  projectOwner: "Industrial Project Owner",
  documentReferencePrefix: "PDI/ENG",
  defaultPlanNumberPrefix: "PDI-ENG",
  countryCode: "INTL",
  regionLabel: "Region / Site",
  defaultCurrencyCode: "EUR",
  defaultTaxRatePercent: 20,
  standardsHeaderNote: "ASME B31.3 / B31.8 · API 5L / 6D · ISO 1092 · MSS SP-58",
};

// ============================================================================
// 3. PRODUCT CORE: MTO & BOM (LAYER 1: PRODUCT_CORE)
// ============================================================================

/**
 * Engineering Material Take-Off (MTO) / Bill of Materials (BOM) item.
 * Belongs strictly to PRODUCT_CORE: contains physical, dimensional, and
 * normative traceability ONLY. Never contains commercial prices or currency.
 */
export type PdiMtoCategory =
  | "PIPE"
  | "FITTING"
  | "FLANGE"
  | "VALVE"
  | "FASTENER_GASKET"
  | "EQUIPMENT"
  | "SUPPORT_MSS"
  | "CIVIL_ANCHORAGE"
  | "WELD_JOINT";

export type PdiMtoQuantityUnit = "m" | "mm" | "u" | "kg" | "m3" | "set";

export interface PdiEngineeringMtoItem {
  readonly mtoItemId: string;
  readonly itemNumber: number;
  readonly category: PdiMtoCategory;
  readonly itemCode: string;
  readonly designation: string;
  readonly nominalDiameterMm?: number;
  readonly nominalPipeSizeInch?: string;
  readonly pressureRating?: string;
  readonly materialSpec?: string;
  readonly scheduleOrThickness?: string;
  readonly standardReference?: string;
  readonly quantity: number;
  readonly unit: PdiMtoQuantityUnit;
  readonly totalLengthM?: number;
  readonly unitWeightKg?: number;
  readonly totalWeightKg?: number;
  readonly spoolId?: string;
  readonly lineId?: string;
  readonly sourceEntityIds: readonly string[];
  /** Explicit provenance status: derived from model geometry & catalog */
  readonly engineeringStatus: "DERIVED_FROM_MODEL" | "EXPLICIT_INPUT" | "UNVERIFIED";
}

export interface PdiEngineeringBomSummary {
  readonly bomId: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly generatedAtIso: string;
  readonly items: readonly PdiEngineeringMtoItem[];
  readonly totalPipeLengthM: number;
  readonly totalComponentCount: number;
  readonly totalEstimatedWeightKg?: number;
}

// ============================================================================
// 4. COMMERCIAL & EPC DOMAIN (LAYER 4: INDUSTRIAL_COMMERCIAL_DATA)
// ============================================================================

/**
 * Standard international EPC Work Package categories for Price Schedules / BoQ.
 */
export type PdiEpcWorkPackageCode =
  | "WP_01_ENGINEERING_STUDIES"
  | "WP_02_INSPECTION_NDT_QAQC"
  | "WP_03_CONSTRUCTION_INSTALLATION"
  | "WP_04_PROCUREMENT_MATERIALS"
  | "WP_05_COMMISSIONING_TESTING";

/**
 * Unit Rate entry in a configurable Price Schedule / Unit Rate Library.
 */
export interface PdiUnitRateEntry {
  readonly rateId: string;
  readonly itemCode: string;
  readonly workPackage: PdiEpcWorkPackageCode;
  readonly designation: string;
  readonly unit: string;
  readonly unitPrice?: number;
  readonly currencyCode: string;
  readonly rateSource: "CONTRACT_PRICE_SCHEDULE" | "USER_CONFIGURED" | "UNVERIFIED";
  readonly formulaOrBasisNote?: string;
}

export interface PdiUnitRateLibrary {
  readonly libraryId: string;
  readonly libraryName: string;
  readonly currencyCode: string;
  readonly defaultTaxRatePercent: number;
  readonly entries: readonly PdiUnitRateEntry[];
}

/**
 * Costing status for a Bill of Quantities (BoQ) line item.
 * If unitPrice is missing or undefined, status MUST be "UNVERIFIED_COST"
 * and never fabricated silently.
 */
export type PdiBoqCostStatus =
  | "PRICED_EXPLICIT"
  | "UNVERIFIED_COST"
  | "ZERO_QUANTITY";

/**
 * Bill of Quantities (BoQ) / Price Schedule line item.
 * Combines a physical Quantity Take-Off (from MTO or Project scope) with an
 * explicit Unit Rate from a Price Schedule.
 */
export interface PdiBoqLineItem {
  readonly boqItemId: string;
  readonly code: string;
  readonly workPackage: PdiEpcWorkPackageCode;
  readonly designation: string;
  readonly unit: string;
  readonly quantity: number;
  readonly quantityFormulaNote?: string;
  /** Optional link to Product Core MTO item(s) */
  readonly linkedMtoItemIds?: readonly string[];
  /** Unit price in schedule currency; undefined if not provided */
  readonly unitPrice?: number;
  readonly currencyCode: string;
  /** Total amount excl. tax; undefined if unitPrice is undefined */
  readonly amountExclTax?: number;
  readonly costStatus: PdiBoqCostStatus;
}

/**
 * Complete Bill of Quantities (BoQ) / Cost Estimation summary for a project.
 */
export interface PdiProjectCostEstimate {
  readonly estimateId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly documentReference: string;
  readonly currencyCode: string;
  readonly taxRatePercent: number;
  readonly items: readonly PdiBoqLineItem[];
  readonly totalExclTax: number;
  readonly totalTaxAmount: number;
  readonly totalInclTax: number;
  readonly hasUnverifiedCosts: boolean;
  readonly unverifiedItemCount: number;
}

// ============================================================================
// 5. AUDIT CLASSIFICATION OF HISTORICAL CLIENT OCCURRENCES (ARCH-07 SECTION 1)
// ============================================================================

export type PdiClientOccurrenceAction =
  | "A_DELETE"
  | "B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA"
  | "C_KEEP_GENERIC_INDUSTRIAL";

export interface PdiClientNeutralityAuditRecord {
  readonly recordId: string;
  readonly path: string;
  readonly fileOrModule?: string;
  readonly historicalPattern: string;
  readonly classification: PdiClientOccurrenceAction;
  readonly action: PdiClientOccurrenceAction;
  readonly status: "DONE" | "IN_PROGRESS" | "LOCKED";
  readonly reason: string;
  readonly resolutionSummary?: string;
}
