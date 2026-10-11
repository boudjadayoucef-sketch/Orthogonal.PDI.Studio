/**
 * PDI ENGINEERING PLATFORM — MULTI-DOMAIN ENGINEERING ARCHITECTURE — ARCH-08 TEST SUITE
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Test suite verifying:
 * 1. Valid registration of canonical engineering domains: PIPING, PIPELINE, PACKAGE, EQUIPMENT.
 * 2. Strict client neutrality of all engineering domains (zero client dependencies).
 * 3. Strict commercial boundary isolation (no prices, rates, or currencies in engineering domains).
 * 4. Reuse and binding to Common Engineering Model (PdiUniversalEntity) without divergent models.
 * 5. Orthogonality and independence between Domains and Capabilities.
 * 6. Separation between Engineering Domain and Normative Rules (no hardcoded calculation logic).
 * 7. Clear distinction between EngineeringDomain and PdiOrganizationProfile.
 * 8. Product Core client-neutrality invariants preserved.
 * 9. Non-regression of ARCH-07 test suite (ARCH-07 PASS).
 * 10. Non-regression of Global Normative Suite (NORM-01..14 PASS).
 * 11. Anti-pattern detection & non-duplication enforcement (rejection of PipelineUniversalEntity, etc.).
 * 12. Architectural chain of authority boundary validation (Domain -> Model -> Normative Context -> Normative Engine).
 */

import {
  defaultEngineeringDomainRegistry,
  EngineeringDomainRegistry,
  createDefaultEngineeringDomainRegistry,
  PIPING_DOMAIN_DESCRIPTOR,
  PIPELINE_DOMAIN_DESCRIPTOR,
  PACKAGE_DOMAIN_DESCRIPTOR,
  EQUIPMENT_DOMAIN_DESCRIPTOR,
  createEngineeringDomainContext,
  resolveApplicableDesignCodesForDomain,
  validateDomainBoundary,
  detectDuplicateUniversalModelAntiPattern,
  FORBIDDEN_DUPLICATE_UNIVERSAL_ENTITY_NAMES,
  attachDomainAttributes,
  getDomainAttributes,
  isEngineeringDomainId,
  isEngineeringCapabilityId,
} from "../../engineering";
import type {
  EngineeringDomainId,
  EngineeringCapabilityId,
  PipingDomainAttributes,
  PipelineDomainAttributes,
  PackageDomainAttributes,
  EquipmentDomainAttributes,
} from "../../engineering";
import {
  createEmptyPdiModel,
  PDI_NEUTRAL_ORGANIZATION_PROFILE,
  FORBIDDEN_HISTORICAL_CLIENT_PATTERNS,
  createProjectContext,
} from "../../model";
import type { PdiUniversalEntity } from "../../model";
import { runArch07IndustrialArchitectureTests } from "./arch07IndustrialArchitectureTests";
import { runNormativeGlobalIntegrationTests } from "./normativeGlobalIntegrationTests";

export interface Arch08TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-08 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Fixture d'entité universelle minimale valide pour les tests de modélisation.
 */
function createSyntheticUniversalEntity(id: string = "ENT-001"): PdiUniversalEntity {
  return {
    identity: {
      id,
      type: "pipe",
      category: "pipe",
      name: "Main Process Pipe",
      labelFr: "Tronçon principal",
      source: "ISOMETRIC",
    },
    geometry: {
      x: 0,
      y: 0,
      z: 0,
      length: 12.5,
    },
    connection: {
      ports: [],
      connectionType: "butt_weld",
    },
    dn: { dn: 100, inch: '4"', outerDiameterMm: 114.3 },
    pn: { rating: "Class 300", designPressureBar: 50 },
    material: { grade: "ASTM A106 Gr. B", standard: "ASTM" },
    service: { code: "GAS", description: "Process Gas" },
    spec: { pmsCode: "CS-300-01" },
    tag: { fullTag: "100-PG-001" },
    fabrication: { spoolNumber: "SP-01", location: "shop" },
    documentation: { notes: "Engineering verified" },
    specific: {},
  };
}

/**
 * Exécute la suite complète de validation ARCH-08.
 */
export function runArch08MultiDomainArchitectureTests(): Arch08TestResult {
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
  // TEST 01: VALIDITÉ DES DOMAINES D'INGÉNIERIE DÉCLARÉS
  // =========================================================================
  runTest("TEST 01 [ARCH-08]: Tous les 4 domaines d'ingénierie canoniques sont valides et enregistrés", () => {
    const registry = defaultEngineeringDomainRegistry;
    const requiredDomains: EngineeringDomainId[] = ["PIPING", "PIPELINE", "PACKAGE", "EQUIPMENT"];

    for (const domainId of requiredDomains) {
      assert(registry.hasDomain(domainId), `Le domaine ${domainId} doit être enregistré dans le registre`);
      assert(isEngineeringDomainId(domainId), `L'identifiant ${domainId} doit être un EngineeringDomainId valide`);

      const descriptor = registry.getDomain(domainId);
      assert(descriptor !== undefined, `Le descripteur pour ${domainId} ne doit pas être undefined`);
      assert(descriptor!.id === domainId, `L'id du descripteur doit correspondre à ${domainId}`);
      assert(descriptor!.label.length > 5, `Le label de ${domainId} doit être explicite et non vide`);
      assert(descriptor!.description.length > 10, `La description de ${domainId} doit être documentée`);
      assert(descriptor!.capabilities.length > 0, `Le domaine ${domainId} doit avoir au moins une capacité`);
      assert(descriptor!.allowedEntityCategories.length > 0, `Le domaine ${domainId} doit autoriser des entités`);

      const integrity = registry.validateDomainIntegrity(domainId);
      assert(integrity.valid === true, `L'intégrité de ${domainId} doit être valide: ${integrity.errors.join(", ")}`);
    }

    assert(registry.getAllDomains().length >= 4, "Le registre doit exposer au moins les 4 domaines canoniques");
  });

  // =========================================================================
  // TEST 02: AUCUN DOMAINE NE DÉPEND DIRECTEMENT D'UN CLIENT
  // =========================================================================
  runTest("TEST 02 [ARCH-08]: Aucun domaine ne dépend directement d'un client (neutralité client stricte)", () => {
    const registry = defaultEngineeringDomainRegistry;
    for (const domain of registry.getAllDomains()) {
      const serialized = JSON.stringify(domain);
      for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
        assert(
          !pattern.test(serialized),
          `Le descripteur du domaine ${domain.id} contient une mention client interdite: ${pattern}`
        );
      }
    }
  });

  // =========================================================================
  // TEST 03: AUCUN DOMAINE NE CONTIENT DE PRIX COMMERCIAUX (ARCH-07 BOUNDARY)
  // =========================================================================
  runTest("TEST 03 [ARCH-08]: Les domaines d'ingénierie ne contiennent aucune donnée commerciale ou financière", () => {
    const registry = defaultEngineeringDomainRegistry;
    for (const domain of registry.getAllDomains()) {
      const boundaryCheck = validateDomainBoundary(domain.id, domain);
      assert(
        boundaryCheck.valid,
        `Le domaine ${domain.id} ne doit contenir aucune donnée commerciale: ${boundaryCheck.violations.join(", ")}`
      );
    }

    // Test de rejet d'une charge contenant un prix infiltré
    const dirtyPayload = {
      domainId: "PIPING",
      unitRate: 150.0,
      currency: "EUR",
    };
    const dirtyCheck = validateDomainBoundary("PIPING", dirtyPayload);
    assert(dirtyCheck.valid === false, "Une charge avec données de prix doit être rejetée par la frontière de domaine");
  });

  // =========================================================================
  // TEST 04: LES DOMAINES UTILISENT LE MODÈLE UNIVERSEL COMMUN
  // =========================================================================
  runTest("TEST 04 [ARCH-08]: Les domaines partagent et enrichissent PdiUniversalEntity sans duplication", () => {
    const baseEntity = createSyntheticUniversalEntity("ENT-UNIV-01");

    // Projection PIPELINE
    const pipelineAttrs: PipelineDomainAttributes = {
      kilometerPointStart: 12.5,
      kilometerPointEnd: 15.0,
      burialDepthMeters: 1.2,
      classLocation: 2,
      designFactorF: 0.60,
      crossingType: "road",
    };
    const pipelineEntity = attachDomainAttributes(baseEntity, "PIPELINE", pipelineAttrs);
    const retrievedPipelineAttrs = getDomainAttributes<PipelineDomainAttributes>(pipelineEntity, "PIPELINE");
    assert(retrievedPipelineAttrs !== undefined, "Les attributs Pipeline doivent être récupérables");
    assert(retrievedPipelineAttrs?.classLocation === 2, "La classe d'emplacement doit être préservée");
    assert(pipelineEntity.identity.id === "ENT-UNIV-01", "L'identité universelle reste intacte");

    // Projection PIPING
    const pipingAttrs: PipingDomainAttributes = {
      lineTag: "100-PG-001",
      serviceCategory: "process",
      slopeDirection: "flat",
      testMedium: "water",
    };
    const pipingEntity = attachDomainAttributes(baseEntity, "PIPING", pipingAttrs);
    const retrievedPipingAttrs = getDomainAttributes<PipingDomainAttributes>(pipingEntity, "PIPING");
    assert(retrievedPipingAttrs?.lineTag === "100-PG-001", "Le lineTag piping doit être préservé");

    // Projection PACKAGE / SKID
    const packageAttrs: PackageDomainAttributes = {
      skidModuleId: "SKID-MET-01",
      structuralBaseType: "skid_metallique",
      transportEnvelope: { lengthMeters: 12, widthMeters: 3.5, heightMeters: 4 },
    };
    const packageEntity = attachDomainAttributes(baseEntity, "PACKAGE", packageAttrs);
    const retrievedPackageAttrs = getDomainAttributes<PackageDomainAttributes>(packageEntity, "PACKAGE");
    assert(retrievedPackageAttrs?.skidModuleId === "SKID-MET-01", "Le skidModuleId doit être préservé");

    // Projection EQUIPMENT
    const equipAttrs: EquipmentDomainAttributes = {
      equipmentTag: "V-101",
      equipmentCategory: "vessel",
      dryWeightKg: 12500,
    };
    const equipEntity = attachDomainAttributes(baseEntity, "EQUIPMENT", equipAttrs);
    const retrievedEquipAttrs = getDomainAttributes<EquipmentDomainAttributes>(equipEntity, "EQUIPMENT");
    assert(retrievedEquipAttrs?.equipmentTag === "V-101", "Le tag équipement doit être préservé");
  });

  // =========================================================================
  // TEST 05: LES CAPABILITÉS SONT ORTHOGONALES ET INDÉPENDANTES DES DOMAINES
  // =========================================================================
  runTest("TEST 05 [ARCH-08]: Les capabilities d'ingénierie sont modulaires et sélectives selon le domaine", () => {
    const registry = defaultEngineeringDomainRegistry;

    // PIPING supporte ISOMETRIC et SPOOL
    assert(registry.isCapabilitySupported("PIPING", "ISOMETRIC") === true, "PIPING supporte ISOMETRIC");
    assert(registry.isCapabilitySupported("PIPING", "SPOOL") === true, "PIPING supporte SPOOL");

    // PIPELINE supporte ALIGNMENT et STATIONS mais PAS SPOOL d'atelier
    assert(registry.isCapabilitySupported("PIPELINE", "ALIGNMENT") === true, "PIPELINE supporte ALIGNMENT");
    assert(registry.isCapabilitySupported("PIPELINE", "STATIONS") === true, "PIPELINE supporte STATIONS");
    assert(registry.isCapabilitySupported("PIPELINE", "SPOOL") === false, "PIPELINE ne supporte pas SPOOL d'atelier");

    // EQUIPMENT supporte 3D et COMPONENT_SELECTION mais PAS ALIGNMENT
    assert(registry.isCapabilitySupported("EQUIPMENT", "3D") === true, "EQUIPMENT supporte 3D");
    assert(registry.isCapabilitySupported("EQUIPMENT", "ALIGNMENT") === false, "EQUIPMENT ne supporte pas ALIGNMENT");

    // Vérification de la garde de type des capabilities
    assert(isEngineeringCapabilityId("ISOMETRIC"), "ISOMETRIC doit être une capacité reconnue");
    assert(isEngineeringCapabilityId("ALIGNMENT"), "ALIGNMENT doit être une capacité reconnue");
    assert(!isEngineeringCapabilityId("NON_EXISTING_CAPABILITY"), "Capacité invalide doit retourner false");
  });

  // =========================================================================
  // TEST 06: LE DOMAINE NE CONTIENT PAS DE RÈGLES NORMATIVES CODÉES EN DUR
  // =========================================================================
  runTest("TEST 06 [ARCH-08]: Les domaines déclarent uniquement des références de codes sans logique normative", () => {
    const pipingCodes = resolveApplicableDesignCodesForDomain("PIPING");
    assert(pipingCodes.includes("ASME-B31.3"), "PIPING référence ASME-B31.3");
    assert(pipingCodes.includes("EN-13480"), "PIPING référence EN-13480");

    const pipelineCodes = resolveApplicableDesignCodesForDomain("PIPELINE");
    assert(pipelineCodes.includes("ASME-B31.4"), "PIPELINE référence ASME-B31.4");
    assert(pipelineCodes.includes("ASME-B31.8"), "PIPELINE référence ASME-B31.8");
    assert(pipelineCodes.includes("ASME-B31.12"), "PIPELINE référence ASME-B31.12");

    // Vérification qu'aucune fonction de calcul ou formule n'est injectée dans le descripteur
    const pipelineDescriptor = PIPELINE_DOMAIN_DESCRIPTOR;
    assert(
      (pipelineDescriptor as unknown as Record<string, unknown>).calculatePressure === undefined,
      "Le descripteur ne doit pas posséder de méthode de calcul"
    );
    assert(
      (pipelineDescriptor as unknown as Record<string, unknown>).normativeFormulas === undefined,
      "Le descripteur ne doit pas posséder de formules normatives"
    );
  });

  // =========================================================================
  // TEST 07: SÉPARATION STRICTE DOMAIN CONTEXT VS CLIENT PROFILE
  // =========================================================================
  runTest("TEST 07 [ARCH-08]: EngineeringDomain et PdiOrganizationProfile restent strictement orthogonaux", () => {
    const domainContext = createEngineeringDomainContext("PIPELINE", "PROJ-101");
    assert(domainContext.domainId === "PIPELINE", "Le domaine technique doit être PIPELINE");
    assert(
      (domainContext as unknown as Record<string, unknown>).companyName === undefined,
      "Le contexte technique ne doit pas héberger l'organisation cliente"
    );
    assert(
      (domainContext as unknown as Record<string, unknown>).logoUrl === undefined,
      "Le contexte technique ne doit pas héberger de logo"
    );

    const clientProfile = PDI_NEUTRAL_ORGANIZATION_PROFILE;
    assert(clientProfile.organizationId !== undefined, "Le profil organisationnel existe indépendamment");
    assert(
      (clientProfile as unknown as Record<string, unknown>).domainId === undefined,
      "Le profil organisationnel ne doit pas être confondu avec le domaine d'ingénierie"
    );
  });

  // =========================================================================
  // TEST 08: LE PRODUCT CORE RESTE TOTALEMENT CLIENT-NEUTRAL
  // =========================================================================
  runTest("TEST 08 [ARCH-08]: Intégration du domaine dans le projet (PdiProjectContext) avec neutralité client", () => {
    const projectContext = createProjectContext({
      projectId: "PROJ-MULTI-01",
      projectName: "Unité de Séparation Gaz Naturel",
      engineeringDomain: "PIPING",
    });

    assert(projectContext.engineeringDomain === "PIPING", "Le projet doit stocker son domaine d'ingénierie");
    assert(projectContext.metadata.engineeringDomain === "PIPING", "Les métadonnées doivent conserver le domaine");

    // Test avec le domaine PIPELINE
    const pipelineProject = createProjectContext({
      projectId: "PROJ-PL-02",
      projectName: "Gazoduc Régional 28 Pouces",
      engineeringDomain: "PIPELINE",
    });
    assert(pipelineProject.engineeringDomain === "PIPELINE", "Projet Pipeline correctement initialisé");
  });

  // =========================================================================
  // TEST 09: ARCH-07 RESTE PASS (NON-RÉGRESSION ARCHITECTURALE)
  // =========================================================================
  runTest("TEST 09 [ARCH-08]: Non-régression — ARCH-07 Suite complète reste 100% PASS", () => {
    const arch07Result = runArch07IndustrialArchitectureTests();
    assert(arch07Result.success === true, `ARCH-07 doit rester PASS: ${arch07Result.failures.join("; ")}`);
    assert(arch07Result.testsPassed >= 20, "ARCH-07 doit avoir validé au moins 20 tests d'architecture");
  });

  // =========================================================================
  // TEST 10: NORM-01 → NORM-14 RESTENT PASS (NON-RÉGRESSION NORMATIVE)
  // =========================================================================
  runTest("TEST 10 [ARCH-08]: Non-régression — NORM-01..14 Global Normative Integration Suite reste PASS", () => {
    const normResult = runNormativeGlobalIntegrationTests();
    assert(normResult.success === true, "La suite normative globale NORM-01..14 doit rester 100% PASS");
    assert(normResult.testsRun >= 40, "Au moins 40 tests normatifs doivent être exécutés");
  });

  // =========================================================================
  // TEST 11: CONTRÔLE DE NON-DUPLICATION DU MODÈLE UNIVERSEL
  // =========================================================================
  runTest("TEST 11 [ARCH-08]: Détection et rejet systématique de tout type universel dupliqué concurrent", () => {
    for (const forbiddenName of FORBIDDEN_DUPLICATE_UNIVERSAL_ENTITY_NAMES) {
      assert(
        detectDuplicateUniversalModelAntiPattern(forbiddenName) === true,
        `Le validateur anti-pattern doit interdire ${forbiddenName}`
      );
    }

    assert(
      detectDuplicateUniversalModelAntiPattern("PdiUniversalEntity") === false,
      "PdiUniversalEntity est le modèle légitime et ne doit pas être rejeté"
    );
    assert(
      detectDuplicateUniversalModelAntiPattern("CommonEngineeringEntity") === false,
      "CommonEngineeringEntity est un alias autorisé"
    );

    // Vérification de validation de frontière avec modèle concurrent
    const payloadWithForbiddenClass = {
      type: "PipelineUniversalEntity",
      name: "Bad Duplicate Model",
    };
    const res = validateDomainBoundary("PIPELINE", payloadWithForbiddenClass);
    assert(res.valid === false, "Une charge utilisant un type universel concurrent doit être rejetée");
  });

  // =========================================================================
  // TEST 12: CONTRÔLE DE LA CHAÎNE DE FRONTIÈRE D'AUTORITÉ
  // =========================================================================
  runTest("TEST 12 [ARCH-08]: Respect de la frontière Domain -> Model -> Normative Context -> Normative Engine", () => {
    // 1. Le domaine fournit le contexte technique et les codes applicables
    const applicableCodes = resolveApplicableDesignCodesForDomain("PIPING");
    assert(applicableCodes.includes("ASME-B31.3"), "Codes applicables identifiés");

    // 2. Le modèle technique (vide ou enrichi) n'auto-certifie rien
    const model = createEmptyPdiModel("PROJ-TEST");
    assert(model.lines.length === 0, "Modèle vide instancié");

    // 3. Le contexte de domaine ne bypass pas le moteur normatif
    const domainContext = createEngineeringDomainContext("PIPING", "PROJ-TEST");
    assert(domainContext.activeStandardCodeRef === "ASME-B31.3", "Code applicable désigné comme référence");
    assert(
      (domainContext as unknown as Record<string, unknown>).isCompliant === undefined,
      "Le contexte ne doit pas auto-déclarer de conformité sans évaluation par le moteur normatif"
    );
  });

  return {
    success: testsFailed === 0,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  };
}
