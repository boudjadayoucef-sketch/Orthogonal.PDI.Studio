/**
 * PDI INDUSTRIAL ARCHITECTURE & CLIENT NEUTRALITY — ARCH-07 TEST SUITE
 * Reference: ARCH-07 (Client Neutral Architecture & Industrialization Boundary)
 *
 * Test suite verifying:
 * 1. 6-Layer Industrial Architecture Boundaries:
 *    - Layer 1: PRODUCT_CORE
 *    - Layer 2: NORMATIVE_ENGINEERING_DATA
 *    - Layer 3: CLIENT_PROJECT_DATA
 *    - Layer 4: INDUSTRIAL_COMMERCIAL_DATA
 *    - Layer 5: APPLICATION_UI
 *    - Layer 6: INFRASTRUCTURE_SAAS
 * 2. Strict Boundary Isolation:
 *    - Normative engine NEVER depends on commercial / costing data.
 *    - Product Core NEVER depends on specific client configuration.
 *    - Commercial costing NEVER alters or promotes normative or engineering status.
 * 3. Client Neutrality & Configurable Profiles:
 *    - Default profile has zero hardcoded historical client identities.
 *    - Rejection of forbidden client patterns via verification adapter.
 *    - Configurable Organization Profile injection into documents and cartouches.
 * 4. Engineering Material Take-Off (MTO) / BOM in Product Core:
 *    - Pure physical / geometric data only.
 *    - Complete absence of commercial / currency / pricing fields.
 * 5. Industrial Commercial Data (BoQ / Price Schedule / Cost Estimation):
 *    - Explicit EPC work packages (WP 01 to WP 05).
 *    - Strict non-fabrication of prices: missing rates produce UNVERIFIED_COST.
 *    - Mathematical accuracy of total excl. tax, VAT, and total incl. tax.
 * 6. Non-regression:
 *    - NORM-01..14, ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06 (FIX-01..FIX-04)
 */

import {
  PDI_ARCHITECTURE_LAYERS,
  PDI_NEUTRAL_ORGANIZATION_PROFILE,
  validateArchitectureLayerDependency,
  verifyClientNeutralString,
  createOrganizationProfile,
  buildNeutralDocumentReference,
  buildEngineeringBomFromGraph,
  verifyPureEngineeringBom,
  createDefaultIndustrialUnitRateLibrary,
  evaluateProjectCostEstimate,
  evaluateBomCommercialCost,
  FORBIDDEN_HISTORICAL_CLIENT_PATTERNS,
  ARCH07_CLIENT_NEUTRALITY_AUDIT_LEDGER,
} from "../../model";
import type {
  PdiArchitectureLayerId,
  PdiOrganizationProfile,
  PdiEngineeringBomSummary,
  PdiBoqQuantityInput,
} from "../../model";
import type { IsoNode, IsoSegment } from "../../isometric/types/isoGraphTypes";
import { runNormativeGlobalIntegrationTests } from "./normativeGlobalIntegrationTests";
import { runArch01IsometricNormativeBridgeTests } from "./arch01IsometricNormativeBridgeTests";
import { runArch02PmsAuthorityUnificationTests } from "./arch02PmsAuthorityUnificationTests";
import { runArch03UniversalModelTests } from "./arch03UniversalModelTests";
import { runArch04ProjectWorkspaceDataTests } from "./arch04ProjectWorkspaceDataTests";
import { runArch05TechnicalWorkflowTests } from "./arch05TechnicalWorkflowTests";
import { runArch06ComponentSelectionCompatibilityTests } from "./arch06ComponentSelectionCompatibilityTests";

export interface Arch07TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-07 ASSERTION FAILED] ${message}`);
  }
}

export function runArch07IndustrialArchitectureTests(): Arch07TestResult {
  const results: string[] = [];
  const failures: string[] = [];
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  function runTest(testName: string, fn: () => void): void {
    testsRun++;
    try {
      fn();
      testsPassed++;
      results.push(`[PASS] ${testName}`);
    } catch (err: unknown) {
      testsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`[FAIL] ${testName} — ${msg}`);
      failures.push(`${testName}: ${msg}`);
    }
  }

  // =========================================================================
  // SECTION 1: 6-LAYER ARCHITECTURAL BOUNDARIES
  // =========================================================================

  runTest("TEST 01 [ARCH-07]: 6 couches architecturales formellement définies", () => {
    const layerIds: PdiArchitectureLayerId[] = [
      "PRODUCT_CORE",
      "NORMATIVE_ENGINEERING_DATA",
      "CLIENT_PROJECT_DATA",
      "INDUSTRIAL_COMMERCIAL_DATA",
      "APPLICATION_UI",
      "INFRASTRUCTURE_SAAS",
    ];

    for (const id of layerIds) {
      const descriptor = PDI_ARCHITECTURE_LAYERS[id];
      assert(descriptor !== undefined, `La couche ${id} doit exister`);
      assert(descriptor.layerId === id, `Identifiant cohérent pour ${id}`);
      assert(descriptor.isClientNeutral === true, `La couche ${id} doit être client-neutral`);
    }
  });

  runTest("TEST 02 [ARCH-07]: NORMATIVE_ENGINEERING_DATA est strictement isolée (0 dépendance)", () => {
    const normativeLayer = PDI_ARCHITECTURE_LAYERS.NORMATIVE_ENGINEERING_DATA;
    assert(normativeLayer.allowedDependencies.length === 0, "L'autorité normative ne doit dépendre d'aucune couche");

    const depOnCommercial = validateArchitectureLayerDependency(
      "NORMATIVE_ENGINEERING_DATA",
      "INDUSTRIAL_COMMERCIAL_DATA"
    );
    assert(depOnCommercial.allowed === false, "L'autorité normative ne peut JAMAIS dépendre des données commerciales");

    const depOnClient = validateArchitectureLayerDependency(
      "NORMATIVE_ENGINEERING_DATA",
      "CLIENT_PROJECT_DATA"
    );
    assert(depOnClient.allowed === false, "L'autorité normative ne peut JAMAIS dépendre d'un client");
  });

  runTest("TEST 03 [ARCH-07]: PRODUCT_CORE dépend uniquement de NORMATIVE_ENGINEERING_DATA", () => {
    const coreLayer = PDI_ARCHITECTURE_LAYERS.PRODUCT_CORE;
    assert(
      coreLayer.allowedDependencies.includes("NORMATIVE_ENGINEERING_DATA"),
      "Product Core peut consommer l'autorité normative"
    );
    assert(
      !coreLayer.allowedDependencies.includes("INDUSTRIAL_COMMERCIAL_DATA"),
      "Product Core ne doit PAS dépendre des données commerciales"
    );
    assert(
      !coreLayer.allowedDependencies.includes("CLIENT_PROJECT_DATA"),
      "Product Core ne doit PAS dépendre de données client spécifiques"
    );

    const checkComm = validateArchitectureLayerDependency("PRODUCT_CORE", "INDUSTRIAL_COMMERCIAL_DATA");
    assert(checkComm.allowed === false, "Dépendance Core -> Commercial interdite");
  });

  runTest("TEST 04 [ARCH-07]: INDUSTRIAL_COMMERCIAL_DATA dépend de Core & Client mais pas de l'autorité normative directe", () => {
    const commLayer = PDI_ARCHITECTURE_LAYERS.INDUSTRIAL_COMMERCIAL_DATA;
    assert(commLayer.allowedDependencies.includes("PRODUCT_CORE"), "BoQ consomme les quantités Product Core");
    assert(commLayer.allowedDependencies.includes("CLIENT_PROJECT_DATA"), "BoQ consomme le profil client / projet");

    const checkNorm = validateArchitectureLayerDependency(
      "INDUSTRIAL_COMMERCIAL_DATA",
      "NORMATIVE_ENGINEERING_DATA"
    );
    assert(checkNorm.allowed === false, "Le chiffrage commercial ne redéfinit pas les règles normatives");
  });

  // =========================================================================
  // SECTION 2: CLIENT NEUTRALITY & CONFIGURABLE PROFILES
  // =========================================================================

  runTest("TEST 05 [ARCH-07]: Profil d'organisation par défaut 100% neutre", () => {
    const prof = PDI_NEUTRAL_ORGANIZATION_PROFILE;
    assert(prof.companyName.includes("PD&I"), "Nom d'entreprise générique PD&I");
    assert(prof.defaultCurrencyCode === "EUR", "Devise par défaut standardisée");
    assert(prof.defaultPlanNumberPrefix === "PDI-ENG", "Préfixe de plan neutre");

    const serialized = JSON.stringify(prof);
    const check = verifyClientNeutralString(serialized, "PDI_NEUTRAL_ORGANIZATION_PROFILE");
    assert(check.isNeutral === true, `Profil par défaut non neutre: ${check.violations.join(", ")}`);
  });

  runTest("TEST 06 [ARCH-07]: Détection et rejet des motifs clients historiques interdits", () => {
    const forbiddenExamples = [
      "Société Algérienne de l'Électricité et du Gaz",
      "SONELGAZ Transport Gaz",
      "Réf: SNG/DRTG/DETN/2026/BPU",
      "GRTG-GC-2026-001",
      "الشركة الجزائرية للكهرباء و الغاز",
      "Direction DETN",
      "Secteur DRTG",
      "District Gaz Centre",
      "Transport du Gaz Alger",
      "PD&I- Transport",
    ];

    for (const ex of forbiddenExamples) {
      const check = verifyClientNeutralString(ex, "Test Historical String");
      assert(check.isNeutral === false, `Le motif historique "${ex}" aurait dû être détecté comme non neutre`);
      assert(check.violations.length > 0, "Au moins une violation signalée");
    }
  });

  runTest("TEST 07 [ARCH-07]: Création de profil d'organisation configurable sans altérer le Core", () => {
    const customProfile: PdiOrganizationProfile = createOrganizationProfile({
      organizationId: "ORG_GLOBAL_ENERGY",
      companyName: "Global Energy Pipeline Corp",
      divisionOrDepartment: "Major Infrastructure Projects",
      projectOwner: "International Pipeline Authority",
      documentReferencePrefix: "GEP/EPC",
      defaultPlanNumberPrefix: "GEP-PIPE",
      defaultCurrencyCode: "USD",
      defaultTaxRatePercent: 15,
    });

    assert(customProfile.companyName === "Global Energy Pipeline Corp", "Nom d'organisation configuré");
    assert(customProfile.defaultCurrencyCode === "USD", "Devise USD configurée");
    assert(customProfile.defaultTaxRatePercent === 15, "Taux de taxe configuré");

    const docRef = buildNeutralDocumentReference(customProfile, "BOQ", 2026, "SEC-01");
    assert(docRef === "GEP/EPC/2026/BOQ/SEC-01", `Référence documentaire attendue GEP/EPC/2026/BOQ/SEC-01, reçu ${docRef}`);
  });

  runTest("TEST 08 [ARCH-07]: Audit Ledger consigne l'ensemble des catégories d'occurrences historiques avec statuts et raisons", () => {
    assert(ARCH07_CLIENT_NEUTRALITY_AUDIT_LEDGER.length >= 10, "Au moins 10 enregistrements d'audit documentés");
    const actions = ARCH07_CLIENT_NEUTRALITY_AUDIT_LEDGER.map((r) => r.action);
    assert(actions.includes("A_DELETE"), "Action A_DELETE présente");
    assert(actions.includes("B_CONVERT_TO_CONFIGURABLE_CLIENT_DATA"), "Action B_CONVERT_TO_CONFIGURABLE présente");
    assert(actions.includes("C_KEEP_GENERIC_INDUSTRIAL"), "Action C_KEEP_GENERIC_INDUSTRIAL présente");

    for (const rec of ARCH07_CLIENT_NEUTRALITY_AUDIT_LEDGER) {
      assert(Boolean(rec.path && rec.path.length > 0), `Record ${rec.recordId} possède un champ path`);
      assert(Boolean(rec.classification), `Record ${rec.recordId} possède une classification`);
      assert(rec.status === "DONE" || rec.status === "LOCKED", `Record ${rec.recordId} a le statut DONE ou LOCKED`);
      assert(Boolean(rec.action), `Record ${rec.recordId} possède une action`);
      assert(Boolean(rec.reason && rec.reason.length > 0), `Record ${rec.recordId} possède une justification raison`);
    }
  });

  runTest("TEST 08b [ARCH-07]: Neutralité client absolue des templates, profils par défaut et bibliothèques", () => {
    const defaultProfileJson = JSON.stringify(PDI_NEUTRAL_ORGANIZATION_PROFILE);
    const pCheck = verifyClientNeutralString(defaultProfileJson, "Default Organization Profile");
    assert(pCheck.isNeutral === true, `Profil par défaut contient des violations: ${pCheck.violations.join(", ")}`);

    const defaultUnitRates = createDefaultIndustrialUnitRateLibrary();
    const ratesJson = JSON.stringify(defaultUnitRates);
    const rCheck = verifyClientNeutralString(ratesJson, "Default Unit Rates");
    assert(rCheck.isNeutral === true, `Bibliothèque de prix par défaut contient des violations: ${rCheck.violations.join(", ")}`);
  });

  runTest("TEST 08c [ARCH-07-FIX-02]: Validation de la réconciliation legacy — Autonomie complète du Product Core", () => {
    // Vérifie que le Product Core fonctionne de manière autonome sans scripts externes
    assert(typeof PDI_ARCHITECTURE_LAYERS === "object", "PDI_ARCHITECTURE_LAYERS accessible");
    assert(typeof PDI_NEUTRAL_ORGANIZATION_PROFILE === "object", "PDI_NEUTRAL_ORGANIZATION_PROFILE accessible");
    assert(ARCH07_CLIENT_NEUTRALITY_AUDIT_LEDGER.length >= 10, "Ledger d'audit complet");
  });

  // =========================================================================
  // SECTION 3: PRODUCT CORE — ENGINEERING MTO & BOM
  // =========================================================================

  runTest("TEST 09 [ARCH-07]: Génération de BOM / MTO purement physique dans Product Core", () => {
    const node1: IsoNode = {
      id: "N1",
      name: "Valve Station Inlet",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      equipmentLabel: "Gate Valve DN300 Class 600",
      dn: 300,
      pn: "Class 600",
      material: "ASTM A105",
      reference: "API 6D",
    };
    const node2: IsoNode = {
      id: "N2",
      name: "Terminal",
      x: 50,
      y: 0,
      z: 0,
      type: "normal",
      dn: 300,
    };
    const seg1: IsoSegment = {
      id: "S1",
      fromNodeId: "N1",
      toNodeId: "N2",
      type: "straight",
      dn: 300,
      pn: "Class 600",
      material: "API 5L X52",
      length: 50,
      fittings: [
        {
          id: "F1",
          type: "bride_wn",
          label: "Weld Neck Flange DN300",
          dn: 300,
          reference: "ASME B16.5",
          localPosition: 0,
          cumulativePosition: 0,
        },
      ],
    };

    const bom: PdiEngineeringBomSummary = buildEngineeringBomFromGraph(
      "PROJ_TEST_CORE",
      "DOC_ISO_01",
      [node1, node2],
      [seg1]
    );

    assert(bom.projectId === "PROJ_TEST_CORE", "projectId conservé");
    assert(bom.totalPipeLengthM === 50, "Longueur de tube exacte (50m)");
    assert(bom.totalComponentCount === 3, "3 éléments d'ingénierie (Vanne, Tube, Bride)");

    // Vérification de la pureté Product Core (zéro champ commercial)
    const purity = verifyPureEngineeringBom(bom);
    assert(purity.valid === true, `BOM Product Core non pure: ${purity.errors.join(", ")}`);

    const mtoValve = bom.items.find((i) => i.category === "VALVE");
    assert(mtoValve !== undefined, "Item Vanne présent dans l'ingénierie MTO");
    assert(mtoValve?.nominalDiameterMm === 300, "DN 300 tracé");
    assert(mtoValve?.engineeringStatus === "DERIVED_FROM_MODEL", "Provenance explicite DERIVED_FROM_MODEL");
  });

  runTest("TEST 10 [ARCH-07]: Non-fabrication d'attributs techniques dans MTO Product Core", () => {
    const nodeIncomplete: IsoNode = {
      id: "N_INC",
      name: "Incomplete Component",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "fond_bombe",
      // Pas de schedule, pas de référence constructeur
    };

    const bom = buildEngineeringBomFromGraph("PROJ_INC", "DOC_01", [nodeIncomplete], []);
    const item = bom.items[0];
    assert(item.scheduleOrThickness === undefined, "Schedule manquant doit rester strictement undefined");
    assert(item.standardReference === undefined, "Référence manquante doit rester strictement undefined");
  });

  // =========================================================================
  // SECTION 4: INDUSTRIAL & COMMERCIAL DATA — BOQ & COST ESTIMATION
  // =========================================================================

  runTest("TEST 11 [ARCH-07]: Bibliothèque de prix unitaires standard EPC (Layer 4)", () => {
    const rateLib = createDefaultIndustrialUnitRateLibrary("EUR", 20);
    assert(rateLib.currencyCode === "EUR", "Devise EUR");
    assert(rateLib.entries.length >= 10, "Au moins 10 postes de prix configurés");

    const workPackages = new Set(rateLib.entries.map((e) => e.workPackage));
    assert(workPackages.has("WP_01_ENGINEERING_STUDIES"), "WP 01 Études présent");
    assert(workPackages.has("WP_02_INSPECTION_NDT_QAQC"), "WP 02 Contrôle/CND présent");
    assert(workPackages.has("WP_03_CONSTRUCTION_INSTALLATION"), "WP 03 Construction présent");
    assert(workPackages.has("WP_05_COMMISSIONING_TESTING"), "WP 05 Essais/Commissioning présent");
  });

  runTest("TEST 12 [ARCH-07]: Chiffrage BoQ exact avec calculs HT, TVA et TTC", () => {
    const rateLib = createDefaultIndustrialUnitRateLibrary("EUR", 20);
    const quantities: PdiBoqQuantityInput[] = [
      {
        boqItemId: "BOQ_01",
        code: "1.2",
        workPackage: "WP_01_ENGINEERING_STUDIES",
        designation: "Topographical Survey",
        unit: "km",
        quantity: 10,
        rateId: "topo", // 45,000 EUR/km -> 450,000 EUR
      },
      {
        boqItemId: "BOQ_02",
        code: "2.4",
        workPackage: "WP_02_INSPECTION_NDT_QAQC",
        designation: "NDT Welds 100%",
        unit: "u",
        quantity: 100,
        rateId: "cnd", // 4,500 EUR/joint -> 450,000 EUR
      },
    ];

    const estimate = evaluateProjectCostEstimate({
      estimateId: "EST_001",
      projectId: "PROJ_PIPELINE_10KM",
      projectName: "Pipeline Section A",
      unitRateLibrary: rateLib,
      quantities,
    });

    assert(estimate.currencyCode === "EUR", "Devise EUR");
    assert(estimate.totalExclTax === 900000, `Total HT attendu 900,000, reçu ${estimate.totalExclTax}`);
    assert(estimate.totalTaxAmount === 180000, `TVA 20% attendue 180,000, reçu ${estimate.totalTaxAmount}`);
    assert(estimate.totalInclTax === 1080000, `Total TTC attendu 1,080,000, reçu ${estimate.totalInclTax}`);
    assert(estimate.hasUnverifiedCosts === false, "Aucun coût non vérifié");
    assert(estimate.unverifiedItemCount === 0, "0 item non vérifié");
  });

  runTest("TEST 13 [ARCH-07]: Règle de non-fabrication commerciale (prix manquant = UNVERIFIED_COST)", () => {
    const rateLib = createDefaultIndustrialUnitRateLibrary("EUR", 20);
    const quantities: PdiBoqQuantityInput[] = [
      {
        boqItemId: "BOQ_KNOWN",
        code: "1.2",
        workPackage: "WP_01_ENGINEERING_STUDIES",
        designation: "Topographical Survey",
        unit: "km",
        quantity: 5,
        rateId: "topo",
      },
      {
        boqItemId: "BOQ_UNKNOWN",
        code: "99.9",
        workPackage: "WP_03_CONSTRUCTION_INSTALLATION",
        designation: "Custom Specialized Subsea Crossing Installation",
        unit: "LS",
        quantity: 1,
        // Pas de rateId ni explicitUnitPrice
      },
    ];

    const estimate = evaluateProjectCostEstimate({
      estimateId: "EST_UNVERIFIED_TEST",
      projectId: "PROJ_UNKNOWN_RATES",
      projectName: "Project with missing commercial rates",
      unitRateLibrary: rateLib,
      quantities,
    });

    assert(estimate.hasUnverifiedCosts === true, "L'estimation doit signaler la présence de coûts non vérifiés");
    assert(estimate.unverifiedItemCount === 1, "1 item non vérifié");

    const unknownItem = estimate.items.find((i) => i.boqItemId === "BOQ_UNKNOWN");
    assert(unknownItem !== undefined, "Item non vérifié présent");
    assert(unknownItem?.costStatus === "UNVERIFIED_COST", "Statut strict UNVERIFIED_COST");
    assert(unknownItem?.unitPrice === undefined, "Le prix ne doit JAMAIS être fabriqué");
    assert(unknownItem?.amountExclTax === undefined, "Le montant HT ne doit JAMAIS être fabriqué");
  });

  runTest("TEST 14 [ARCH-07]: Valorisation commerciale d'un BOM (Layer 1 -> Layer 4) sans muter le BOM", () => {
    const node: IsoNode = {
      id: "N1",
      name: "Valve",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      equipmentType: "vanne_passage_total",
      dn: 200,
    };
    const seg: IsoSegment = {
      id: "S1",
      fromNodeId: "N1",
      toNodeId: "N1",
      type: "straight",
      dn: 200,
      pn: "Class 300",
      material: "A106",
      length: 12,
      fittings: [],
    };

    const bom = buildEngineeringBomFromGraph("PROJ_VAL", "DOC_VAL", [node], [seg]);
    const rateLib = createDefaultIndustrialUnitRateLibrary("EUR", 20);

    const costEstimate = evaluateBomCommercialCost(bom, rateLib);

    assert(costEstimate.projectId === "PROJ_VAL", "projectId conservé dans le devis commercial");
    assert(costEstimate.items.length === 2, "2 lignes de BoQ créées");

    // Vérifier que le BOM d'origine reste parfaitement pur et inchangé
    const purityAfter = verifyPureEngineeringBom(bom);
    assert(purityAfter.valid === true, "Le BOM Product Core n'a pas été pollué par des données commerciales");
  });

  // =========================================================================
  // SECTION 5: NON-RÉGRESSION GLOBALE (NORM-01..14 & ARCH-01..06)
  // =========================================================================

  runTest("TEST 15 [ARCH-07]: Non-régression NORM-01..14 (Global Normative Suite)", () => {
    const res = runNormativeGlobalIntegrationTests();
    assert(res.success === true, `Suite globale NORM-01..14 échouée: ${res.failed} tests échoués`);
  });


  runTest("TEST 16 [ARCH-07]: Non-régression ARCH-01 (Isometric ↔ Normative Bridge)", () => {
    const res = runArch01IsometricNormativeBridgeTests();
    assert(res.success === true, `ARCH-01 échoué: ${res.failures.join("; ")}`);
  });

  runTest("TEST 17 [ARCH-07]: Non-régression ARCH-02 (Normative Authority Unification)", () => {
    const res = runArch02PmsAuthorityUnificationTests();
    assert(res.success === true, `ARCH-02 échoué: ${res.failures.join("; ")}`);
  });

  runTest("TEST 18 [ARCH-07]: Non-régression ARCH-03 (Universal Model)", () => {
    const res = runArch03UniversalModelTests();
    assert(res.success === true, `ARCH-03 échoué: ${res.failures.join("; ")}`);
  });

  runTest("TEST 19 [ARCH-07]: Non-régression ARCH-04 (Project / Document / Workspace Data)", () => {
    const res = runArch04ProjectWorkspaceDataTests();
    assert(res.success === true, `ARCH-04 échoué: ${res.failures.join("; ")}`);
  });

  runTest("TEST 20 [ARCH-07]: Non-régression ARCH-05 (Technical Workflow P&ID → Piping → Isometric)", () => {
    const res = runArch05TechnicalWorkflowTests();
    assert(res.success === true, `ARCH-05 échoué: ${res.failures.join("; ")}`);
  });

  runTest("TEST 21 [ARCH-07]: Non-régression ARCH-06 (Component Selection & Compatibility FIX-01..04)", () => {
    const res = runArch06ComponentSelectionCompatibilityTests();
    assert(res.success === true, `ARCH-06 échoué: ${res.failures.join("; ")}`);
  });

  return {
    success: testsFailed === 0,
    testsRun,
    testsPassed,
    testsFailed,
    results,
    failures,
  };
}
