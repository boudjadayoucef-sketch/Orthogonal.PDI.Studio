/**
 * PDI NORMATIVE & ARCHITECTURE TEST SUITE
 * Reference: MASTER-ARCH-06 (Component Selection + Catalog + Compatibility)
 *
 * Tests unitaires et d'intégration couvrant les critères AC-01 à AC-20
 * et garantissant la non-régression de ARCH-01..05 et NORM-01..14.
 */

import {
  createCatalogComponent,
  createCatalogRegistry,
  type PdiCatalogComponent,
  type PdiCatalogComponentType,
} from "../../model/pdiCatalogComponent";
import {
  checkComponentCompatibility,
  selectCatalogComponent,
  adaptCatalogComponentToUniversalEntity,
  adaptUniversalEntityToCatalogComponent,
  adaptTrouvayCauvinCatalogToPdiCatalog,
  adaptCatalogComponentToCandidate,
  type PdiComponentSelectionRequest,
  type PdiPipingSpecConstraint,
} from "../../model/pdiCatalogSelectionAdapter";
import { runNormativeGlobalIntegrationTests } from "./normativeGlobalIntegrationTests";
import { runArch01IsometricNormativeBridgeTests } from "./arch01IsometricNormativeBridgeTests";
import { runArch02PmsAuthorityUnificationTests } from "./arch02PmsAuthorityUnificationTests";
import { runArch03UniversalModelTests } from "./arch03UniversalModelTests";
import { runArch04ProjectWorkspaceDataTests } from "./arch04ProjectWorkspaceDataTests";
import { runArch05TechnicalWorkflowTests } from "./arch05TechnicalWorkflowTests";

export interface Arch06TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly failures: readonly string[];
}

export function runArch06ComponentSelectionCompatibilityTests(): Arch06TestResult {
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;
  const failures: string[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function runTest(name: string, fn: () => void) {
    testsRun++;
    try {
      fn();
      testsPassed++;
    } catch (err: any) {
      testsFailed++;
      failures.push(`${name}: ${err.message || String(err)}`);
    }
  }

  // =========================================================================
  // AC-01 : Un composant catalogue correctement renseigné peut être chargé.
  // =========================================================================
  runTest("TEST AC-01: Composant catalogue complet chargé correctement", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_CAT_PIPE_001",
      componentType: "PIPE",
      description: "Synthetic Test Carbon Steel Pipe",
      shortName: "Pipe Synth",
      manufacturer: "Synthetic Forge",
      manufacturerPartNumber: "SF-P-100",
      standard: "SYNTHETIC_STD_B3610",
      material: "SYNTH_A106_GRB",
      nominalDiameter: 100,
      nominalDiameterUnit: "mm",
      nominalSize: "4\"",
      outerDiameterMm: 114.3,
      pressureClass: "Class 300",
      schedule: "Sch 40",
      wallThicknessMm: 6.02,
      connectionType: "butt_weld",
      weightKg: 16.07,
      evidenceIds: ["EVID_SYNTH_01"],
    });

    assert(comp.id === "SYNTH_CAT_PIPE_001", "ID conservé");
    assert(comp.componentType === "PIPE", "Type PIPE");
    assert(comp.nominalDiameter === 100, "DN 100");
    assert(comp.nominalSize === "4\"", "NPS 4\"");
    assert(comp.outerDiameterMm === 114.3, "OD 114.3");
    assert(comp.material === "SYNTH_A106_GRB", "Material grade conservé");
    assert(comp.pressureClass === "Class 300", "Class 300 conservé");
    assert(comp.connectionType === "butt_weld", "Connexion butt_weld");
    assert(Array.isArray(comp.evidenceIds) && comp.evidenceIds[0] === "EVID_SYNTH_01", "Evidence ID conservé");
  });

  // =========================================================================
  // AC-02 : Propriétés techniques absentes restent undefined.
  // =========================================================================
  runTest("TEST AC-02: Propriétés techniques absentes restent strictement undefined", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_CAT_MINIMAL_01",
      componentType: "VALVE",
      description: "Minimal Valve Without Technical Specs",
    });

    assert(comp.id === "SYNTH_CAT_MINIMAL_01", "ID conservé");
    assert(comp.nominalDiameter === undefined, "nominalDiameter est undefined");
    assert(comp.nominalSize === undefined, "nominalSize est undefined");
    assert(comp.outerDiameterMm === undefined, "outerDiameterMm est undefined");
    assert(comp.material === undefined, "material est undefined");
    assert(comp.pressureClass === undefined, "pressureClass est undefined");
    assert(comp.schedule === undefined, "schedule est undefined");
    assert(comp.wallThicknessMm === undefined, "wallThicknessMm est undefined");
    assert(comp.faceType === undefined, "faceType est undefined");
    assert(comp.connectionType === undefined, "connectionType est undefined");
    assert(comp.weightKg === undefined, "weightKg est undefined");
    assert(comp.evidenceIds === undefined, "evidenceIds est undefined");
  });

  // =========================================================================
  // AC-03 : Aucun DN par défaut (pas de 0 ni de DN50 inventé).
  // =========================================================================
  runTest("TEST AC-03: Aucun DN par défaut", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_NO_DN_01",
      componentType: "ELBOW",
    });

    assert(comp.nominalDiameter === undefined, "DN ne doit pas valoir 0 ou 50");
    assert(comp.nominalDiameter !== 0, "DN !== 0");
  });

  // =========================================================================
  // AC-04 : Aucun NPS par défaut (pas de chaîne vide ni de 2\" inventé).
  // =========================================================================
  runTest("TEST AC-04: Aucun NPS par défaut", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_NO_NPS_01",
      componentType: "TEE",
    });

    assert(comp.nominalSize === undefined, "NPS ne doit pas être inventé");
    assert(comp.nominalSize !== "", "NPS !== ''");
  });

  // =========================================================================
  // AC-05 : Aucun Class/PN par défaut (pas de Class 150 ou PN16 inventé).
  // =========================================================================
  runTest("TEST AC-05: Aucun Class/PN par défaut", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_NO_CLASS_01",
      componentType: "FLANGE",
    });

    assert(comp.pressureClass === undefined, "pressureClass ne doit pas valoir Class 150 ou PN16");
    assert(comp.pressureClass !== "", "pressureClass !== ''");
  });

  // =========================================================================
  // AC-06 : Aucune conversion DN ↔ NPS.
  // =========================================================================
  runTest("TEST AC-06: Aucune conversion implicite DN ↔ NPS", () => {
    const compDnOnly = createCatalogComponent({
      id: "SYNTH_DN_ONLY",
      componentType: "PIPE",
      nominalDiameter: 50,
    });
    assert(compDnOnly.nominalDiameter === 50, "DN est 50");
    assert(compDnOnly.nominalSize === undefined, "NPS ne doit pas être automatiquement calculé comme 2\"");

    const compNpsOnly = createCatalogComponent({
      id: "SYNTH_NPS_ONLY",
      componentType: "PIPE",
      nominalSize: "2\"",
    });
    assert(compNpsOnly.nominalSize === "2\"", "NPS est 2\"");
    assert(compNpsOnly.nominalDiameter === undefined, "DN ne doit pas être automatiquement calculé comme 50");
  });

  // =========================================================================
  // AC-07 : Aucune conversion Class ↔ PN.
  // =========================================================================
  runTest("TEST AC-07: Aucune conversion implicite Class ↔ PN", () => {
    const compClassOnly = createCatalogComponent({
      id: "SYNTH_CLASS_ONLY",
      componentType: "FLANGE",
      pressureClass: "Class 150",
    });
    assert(compClassOnly.pressureClass === "Class 150", "Class 150 préservé");

    const compPnOnly = createCatalogComponent({
      id: "SYNTH_PN_ONLY",
      componentType: "FLANGE",
      pressureClass: "PN16",
    });
    assert(compPnOnly.pressureClass === "PN16", "PN16 préservé");

    // Vérification de compatibilité entre Class 150 et PN16 -> INCOMPATIBLE
    const compat = checkComponentCompatibility(compClassOnly, compPnOnly);
    assert(compat.overallStatus === "INCOMPATIBLE" || compat.overallStatus === "INSUFFICIENT_DATA", "Pas d'équivalence Class 150 = PN16");
  });

  // =========================================================================
  // AC-08 : Deux composants compatibles : DATA_MATCH sans moteur, COMPATIBLE avec NORM-13.
  // =========================================================================
  runTest("TEST AC-08: Deux composants avec données concordantes (DATA_MATCH / NORM-13 COMPATIBLE)", () => {
    const pipe = createCatalogComponent({
      id: "SYNTH_COMPAT_PIPE_01",
      componentType: "PIPE",
      nominalDiameter: 100,
      nominalSize: "4\"",
      pressureClass: "Class 300",
      material: "SYNTH_A106_B",
      connectionType: "butt_weld",
      standard: "SYNTH_ASME_B3610",
      evidenceIds: ["EVID_SYNTH_01"],
    });

    const elbow = createCatalogComponent({
      id: "SYNTH_COMPAT_ELBOW_01",
      componentType: "ELBOW",
      nominalDiameter: 100,
      nominalSize: "4\"",
      pressureClass: "Class 300",
      material: "SYNTH_A106_B",
      connectionType: "butt_weld",
      standard: "SYNTH_ASME_B169",
      evidenceIds: ["EVID_SYNTH_02"],
    });

    // 1. Sans autorité normative : DATA_MATCH pur reste UNVERIFIED (FIX-02 §1)
    const resUnverified = checkComponentCompatibility(pipe, elbow);
    assert(resUnverified.overallStatus === "UNVERIFIED", "Status UNVERIFIED sans autorité");
    assert(resUnverified.dimensions.find((d) => d.dimension === "connection")?.observation === "DATA_MATCH", "Connexion DATA_MATCH");
    assert(resUnverified.dimensions.find((d) => d.dimension === "nominalSize")?.observation === "DATA_MATCH", "DN DATA_MATCH");
    assert(resUnverified.dimensions.find((d) => d.dimension === "pressureRating")?.observation === "DATA_MATCH", "Rating DATA_MATCH");
    assert(resUnverified.dimensions.find((d) => d.dimension === "material")?.observation === "DATA_MATCH", "Material DATA_MATCH");

    // 2. Avec autorité normative NORM-13 : devient COMPATIBLE uniquement avec matchedRule bilatérale explicite (FIX-04)
    const mockNorm13 = {
      evaluate(ctx: any) {
        if (ctx.componentType === "PIPE_TO_ELBOW" && ctx.connectionType === "butt_weld_TO_butt_weld") {
          const rule = {
            ruleId: "NORM13_RULE_MATCHING_PARTS",
            description: "Bilateral PIPE to ELBOW butt_weld rule",
            componentType: "PIPE_TO_ELBOW",
            connectionType: "butt_weld_TO_butt_weld",
            status: "COMPATIBLE" as const,
            evidenceIds: ["EVID_NORM13_01"],
          };
          return {
            status: "COMPATIBLE" as const,
            ruleId: rule.ruleId,
            matchedRule: rule,
            matchedRuleIds: [rule.ruleId],
            message: "Validated by NORM-13",
            evidenceIds: ["EVID_NORM13_01"],
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };
    const resNorm = checkComponentCompatibility(pipe, elbow, { normativeCompatibilityEngine: mockNorm13 });
    assert(resNorm.overallStatus === "COMPATIBLE", "Status COMPATIBLE avec NORM-13");
    assert(resNorm.dimensions.find((d) => d.dimension === "connection")?.status === "COMPATIBLE", "Connexion compatible NORM-13");
    assert(resNorm.evidenceIds.includes("EVID_NORM13_01"), "Evidence NORM-13 incluse");
  });

  // =========================================================================
  // AC-09 : Deux composants de diamètres différents (DATA_MISMATCH / NORM-13 INCOMPATIBLE).
  // =========================================================================
  runTest("TEST AC-09: Deux composants de diamètres différents retournent DATA_MISMATCH / UNVERIFIED", () => {
    const pipe100 = createCatalogComponent({
      id: "SYNTH_PIPE_DN100",
      componentType: "PIPE",
      nominalDiameter: 100,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "SYNTH_CS",
    });

    const pipe150 = createCatalogComponent({
      id: "SYNTH_PIPE_DN150",
      componentType: "PIPE",
      nominalDiameter: 150,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "SYNTH_CS",
    });

    // Sans moteur normatif : DATA_MISMATCH avec statut UNVERIFIED (FIX-02 §2)
    const res = checkComponentCompatibility(pipe100, pipe150);
    assert(res.overallStatus === "UNVERIFIED", "Status global UNVERIFIED sans autorité externe");
    const dim = res.dimensions.find((d) => d.dimension === "nominalSize");
    assert(dim?.observation === "DATA_MISMATCH", "Dimension nominalSize DATA_MISMATCH");
    assert(dim?.status === "UNVERIFIED", "Dimension nominalSize UNVERIFIED");

    // Avec moteur NORM-13 qui qualifie explicitement le mismatch bilatéral en INCOMPATIBLE (FIX-04)
    const mockNorm13Incompat = {
      evaluate(ctx: any) {
        if (ctx.componentType === "PIPE_TO_PIPE" && ctx.nominalSize === "DN100_TO_DN150") {
          const rule = {
            ruleId: "NORM13_SIZE_MISMATCH",
            description: "Bilateral DN100 to DN150 mismatch rule",
            componentType: "PIPE_TO_PIPE",
            nominalSize: "DN100_TO_DN150",
            status: "INCOMPATIBLE" as const,
          };
          return {
            status: "INCOMPATIBLE" as const,
            ruleId: rule.ruleId,
            matchedRule: rule,
            matchedRuleIds: [rule.ruleId],
            message: "Size mismatch",
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };
    const resNorm = checkComponentCompatibility(pipe100, pipe150, { normativeCompatibilityEngine: mockNorm13Incompat });
    assert(resNorm.overallStatus === "INCOMPATIBLE", "Status INCOMPATIBLE via NORM-13");
  });

  // =========================================================================
  // AC-10 : Données insuffisantes → UNVERIFIED ou INSUFFICIENT_DATA.
  // =========================================================================
  runTest("TEST AC-10: Données techniques incomplètes retournent INSUFFICIENT_DATA ou UNVERIFIED", () => {
    const compA = createCatalogComponent({
      id: "SYNTH_INCOMPLETE_A",
      componentType: "PIPE",
      nominalDiameter: 100,
      // connectionType, material, pressureClass absents
    });

    const compB = createCatalogComponent({
      id: "SYNTH_INCOMPLETE_B",
      componentType: "VALVE",
      nominalDiameter: 100,
      // connectionType, material, pressureClass absents
    });

    const res = checkComponentCompatibility(compA, compB);
    assert(
      res.overallStatus === "INSUFFICIENT_DATA" || res.overallStatus === "UNVERIFIED",
      "Doit être INSUFFICIENT_DATA ou UNVERIFIED"
    );
    assert(res.overallStatus !== "COMPATIBLE", "Ne doit jamais être COMPATIBLE");
    assert(res.overallStatus !== "INCOMPATIBLE", "Ne doit pas être faussement INCOMPATIBLE");
  });

  // =========================================================================
  // AC-11 : Aucun evidenceId inventé.
  // =========================================================================
  runTest("TEST AC-11: Aucun evidenceId inventé", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_NO_EVID_01",
      componentType: "PIPE",
      nominalDiameter: 80,
    });

    assert(comp.evidenceIds === undefined, "evidenceIds reste undefined");

    const comp2 = createCatalogComponent({
      id: "SYNTH_NO_EVID_02",
      componentType: "PIPE",
      nominalDiameter: 80,
    });

    const compat = checkComponentCompatibility(comp, comp2);
    assert(compat.evidenceIds.length === 0, "Aucun evidenceId inventé par le moteur de compatibilité");
  });

  // =========================================================================
  // AC-12 : Aucune qualification normative inventée à partir d'un simple nom de matériau.
  // =========================================================================
  runTest("TEST AC-12: Pas d'auto-qualification sur sous-chaîne matière", () => {
    const compA = createCatalogComponent({
      id: "SYNTH_MAT_CS1",
      componentType: "PIPE",
      nominalDiameter: 50,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "CS Carbon Steel Grade X",
    });

    const compB = createCatalogComponent({
      id: "SYNTH_MAT_CS2",
      componentType: "ELBOW",
      nominalDiameter: 50,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "CS Carbon Steel Grade Y",
    });

    const compat = checkComponentCompatibility(compA, compB);
    const matDim = compat.dimensions.find((d) => d.dimension === "material");
    assert(matDim?.status === "UNVERIFIED", "Matières différentes mais contenant toutes deux 'CS' doivent être UNVERIFIED");
    assert(matDim?.status !== "COMPATIBLE", "Ne doit pas s'auto-qualifier COMPATIBLE");
  });

  // =========================================================================
  // AC-13 : La Piping Specification est utilisée comme contrainte lorsqu'elle est disponible.
  // =========================================================================
  runTest("TEST AC-13: Piping Specification appliquée comme contrainte de sélection", () => {
    const registry = createCatalogRegistry([
      createCatalogComponent({
        id: "SYNTH_VALVE_CL150",
        componentType: "VALVE",
        nominalDiameter: 100,
        pressureClass: "Class 150",
        material: "SYNTH_CS_A",
      }),
      createCatalogComponent({
        id: "SYNTH_VALVE_CL300",
        componentType: "VALVE",
        nominalDiameter: 100,
        pressureClass: "Class 300",
        material: "SYNTH_CS_A",
      }),
    ]);

    const specConstraint: PdiPipingSpecConstraint = {
      pipingSpecId: "PMS_SYNTH_300",
      pressureClass: "Class 300",
      materialGrade: "SYNTH_CS_A",
      evidenceIds: ["EVID_PMS_300"],
    };

    const selReq: PdiComponentSelectionRequest = {
      componentType: "VALVE",
      nominalDiameter: 100,
      pipingSpecConstraint: specConstraint,
    };

    const selRes = selectCatalogComponent(registry, selReq);
    assert(selRes.status === "SELECTED", "Statut SELECTED");
    assert(selRes.selectedComponent?.id === "SYNTH_VALVE_CL300", "Seule la vanne Class 300 est retenue");
    assert(selRes.pipingSpecConstraintsApplied === true, "Contraintes PMS appliquées");
    assert(selRes.evidenceIds.includes("EVID_PMS_300"), "Preuve PMS conservée");
  });

  // =========================================================================
  // AC-14 : Absence de Piping Specification → pas de valeur par défaut inventée.
  // =========================================================================
  runTest("TEST AC-14: Absence de Piping Spec ne génère pas de spec par défaut", () => {
    const registry = createCatalogRegistry([
      createCatalogComponent({
        id: "SYNTH_COMP_A",
        componentType: "PIPE",
        nominalDiameter: 50,
      }),
    ]);

    const req: PdiComponentSelectionRequest = {
      componentType: "PIPE",
      nominalDiameter: 50,
      // pas de pipingSpecConstraint
    };

    const res = selectCatalogComponent(registry, req);
    assert(res.pipingSpecConstraintsApplied === false, "Pas de contrainte PMS appliquée");
  });

  // =========================================================================
  // AC-15 : Le Universal Model n'est pas utilisé comme source d'autorité normative.
  // =========================================================================
  runTest("TEST AC-15: Universal Model n'auto-certifie pas de conformité normative", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_FOR_UNIVERSAL",
      componentType: "PIPE",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT",
    });

    const universalEntity = adaptCatalogComponentToUniversalEntity(comp);
    assert(universalEntity.identity.source === "CATALOG", "Source CATALOG");
    assert(universalEntity.dn.dn === 100, "DN conservé");
    // L'adaptation ne fabrique aucun calcul normatif
    assert(universalEntity.pn.testPressureBar === undefined, "Pression d'épreuve non inventée");
  });

  // =========================================================================
  // AC-16 : Le catalogue n'est pas utilisé comme preuve normative.
  // =========================================================================
  runTest("TEST AC-16: Présence au catalogue ≠ Preuve normative automatique", () => {
    const tcCatalog = adaptTrouvayCauvinCatalogToPdiCatalog();
    assert(tcCatalog.length > 0, "Catalogue Trouvay & Cauvin converti");

    const sample = tcCatalog[0];
    assert(sample.id.length > 0, "ID valide");
    assert(sample.evidenceIds === undefined, "Aucun evidenceId normatif fabriqué pour un composant catalogue");
  });

  // =========================================================================
  // AC-17 : Les identifiants catalogue restent stables.
  // =========================================================================
  runTest("TEST AC-17: Stabilité des identifiants catalogue", () => {
    const id = "SYNTH_STABLE_ID_001";
    const comp = createCatalogComponent({
      id,
      componentType: "FLANGE",
      nominalDiameter: 200,
    });

    const uEntity = adaptCatalogComponentToUniversalEntity(comp);
    const compBack = adaptUniversalEntityToCatalogComponent(uEntity);

    assert(comp.id === id, "ID initial");
    assert(uEntity.identity.id === `entity_${id}`, "ID Universal dérivé de manière stable");
    assert(compBack.id === `entity_${id}`, "ID restauré de façon stable");
  });

  // =========================================================================
  // AC-18 : Aucune mutation des données source.
  // =========================================================================
  runTest("TEST AC-18: Immutabilité totale des données source", () => {
    const compA = createCatalogComponent({
      id: "SYNTH_FROZEN_A",
      componentType: "PIPE",
      nominalDiameter: 50,
      connectionType: "butt_weld",
    });

    const compB = createCatalogComponent({
      id: "SYNTH_FROZEN_B",
      componentType: "PIPE",
      nominalDiameter: 50,
      connectionType: "butt_weld",
    });

    const strA = JSON.stringify(compA);
    const strB = JSON.stringify(compB);

    checkComponentCompatibility(compA, compB);

    assert(JSON.stringify(compA) === strA, "compA non muté");
    assert(JSON.stringify(compB) === strB, "compB non muté");
  });

  // =========================================================================
  // AC-19 : Sélection répétée avec les mêmes inputs → résultat déterministe.
  // =========================================================================
  runTest("TEST AC-19: Déterminisme strict de la sélection de composants", () => {
    const registry = createCatalogRegistry([
      createCatalogComponent({ id: "CAND_B", componentType: "ELBOW", nominalDiameter: 100 }),
      createCatalogComponent({ id: "CAND_A", componentType: "ELBOW", nominalDiameter: 100 }),
    ]);

    const req: PdiComponentSelectionRequest = {
      componentType: "ELBOW",
      nominalDiameter: 100,
    };

    const run1 = selectCatalogComponent(registry, req);
    const run2 = selectCatalogComponent(registry, req);
    const run3 = selectCatalogComponent(registry, req);

    assert(run1.status === "ELIGIBLE", "Statut ELIGIBLE");
    assert(run1.selectedComponent?.id === run2.selectedComponent?.id, "run1 === run2");
    assert(run2.selectedComponent?.id === run3.selectedComponent?.id, "run2 === run3");
    assert(run1.selectedComponent?.id === "CAND_A", "Tri alphabétique déterministe CAND_A en tête");
  });

  // =========================================================================
  // AC-20 : Un changement de composant entraîne une nouvelle évaluation de compatibilité.
  // =========================================================================
  runTest("TEST AC-20: Réévaluation dynamique lors du changement de composant", () => {
    const pipe50 = createCatalogComponent({
      id: "SYNTH_P50",
      componentType: "PIPE",
      nominalDiameter: 50,
      connectionType: "butt_weld",
    });

    const elbow50 = createCatalogComponent({
      id: "SYNTH_E50",
      componentType: "ELBOW",
      nominalDiameter: 50,
      connectionType: "butt_weld",
    });

    const elbow80 = createCatalogComponent({
      id: "SYNTH_E80",
      componentType: "ELBOW",
      nominalDiameter: 80,
      connectionType: "butt_weld",
    });

    const res1 = checkComponentCompatibility(pipe50, elbow50);
    const res2 = checkComponentCompatibility(pipe50, elbow80);

    assert(res1.overallStatus === "UNVERIFIED" || res1.overallStatus === "INSUFFICIENT_DATA", "res1 statut conforme");
    assert(res2.overallStatus === "UNVERIFIED" || res2.overallStatus === "INSUFFICIENT_DATA", "res2 statut conforme");
    assert(res1.dimensions.find((d) => d.dimension === "nominalSize")?.observation === "DATA_MATCH", "res1 DN DATA_MATCH");
    assert(res2.dimensions.find((d) => d.dimension === "nominalSize")?.observation === "DATA_MISMATCH", "res2 DN DATA_MISMATCH");
  });

  // =========================================================================
  // AC-21 : Adaptation de PdiCatalogComponent vers ComponentCandidate
  // =========================================================================
  runTest("TEST AC-21: Conversion PdiCatalogComponent vers ComponentCandidate", () => {
    const comp = createCatalogComponent({
      id: "SYNTH_CAND_01",
      componentType: "FLANGE",
      nominalDiameter: 150,
      nominalSize: "6\"",
      pressureClass: "Class 300",
      material: "SYNTH_ASTM_A105",
      standard: "SYNTH_B165",
      connectionType: "flanged",
      evidenceIds: ["EVID_CAND_01"],
    });

    const candidate = adaptCatalogComponentToCandidate(comp);
    assert(candidate.candidateId === "SYNTH_CAND_01", "candidateId conservé");
    assert(candidate.componentType === "FLANGE", "type FLANGE");
    assert(candidate.productStandardId === "SYNTH_B165", "standard conservé");
    assert(candidate.ratingValue === "Class 300", "rating conservé");
    assert(candidate.materialId === "SYNTH_ASTM_A105", "matériau conservé");
    assert(Array.isArray(candidate.evidenceIds) && candidate.evidenceIds[0] === "EVID_CAND_01", "evidenceIds conservés");
  });

  // =========================================================================
  // AC-22 : Face de bride hétérogène (RF vs RTJ) sans autorité -> UNVERIFIED
  // =========================================================================
  runTest("TEST AC-22: Face de bride hétérogène (RF vs RTJ) sans autorité retourne UNVERIFIED", () => {
    const flangeRF = createCatalogComponent({
      id: "SYNTH_FLANGE_RF",
      componentType: "FLANGE",
      nominalDiameter: 100,
      connectionType: "flanged",
      faceType: "RF",
      pressureClass: "Class 300",
      material: "SYNTH_CS",
    });

    const flangeRTJ = createCatalogComponent({
      id: "SYNTH_FLANGE_RTJ",
      componentType: "FLANGE",
      nominalDiameter: 100,
      connectionType: "flanged",
      faceType: "RTJ",
      pressureClass: "Class 300",
      material: "SYNTH_CS",
    });

    const res = checkComponentCompatibility(flangeRF, flangeRTJ);
    assert(res.overallStatus === "UNVERIFIED", "Statut global UNVERIFIED");
    const faceDim = res.dimensions.find((d) => d.dimension === "faceType");
    assert(faceDim?.status === "UNVERIFIED", "Dimension faceType UNVERIFIED");
  });

  // =========================================================================
  // AC-23 : Raccordement fileté mâle / femelle sans autorité -> UNVERIFIED
  // =========================================================================
  runTest("TEST AC-23: Raccordement fileté mâle/femelle sans autorité retourne UNVERIFIED", () => {
    const nipple = createCatalogComponent({
      id: "SYNTH_NIPPLE_M",
      componentType: "OTHER",
      nominalDiameter: 25,
      connectionType: "male_threaded",
      pressureClass: "Class 800",
      material: "SYNTH_CS",
    });

    const valve = createCatalogComponent({
      id: "SYNTH_VALVE_F",
      componentType: "VALVE",
      nominalDiameter: 25,
      connectionType: "female_threaded",
      pressureClass: "Class 800",
      material: "SYNTH_CS",
    });

    const res = checkComponentCompatibility(nipple, valve);
    assert(res.overallStatus === "UNVERIFIED", "Statut UNVERIFIED");
    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.status === "UNVERIFIED", "Connexion mâle/femelle UNVERIFIED sans règle normative");
  });

  // =========================================================================
  // AC-24 : Sélection avec données incomplètes sur les candidats
  // =========================================================================
  runTest("TEST AC-24: Sélection avec candidats incomplets retourne UNVERIFIED", () => {
    const registry = createCatalogRegistry([
      createCatalogComponent({
        id: "SYNTH_INCOMPLETE_CAND_01",
        componentType: "VALVE",
        // pas de DN ni de matériau
      }),
    ]);

    const req: PdiComponentSelectionRequest = {
      componentType: "VALVE",
      nominalDiameter: 100,
      material: "SYNTH_CS_A",
    };

    const res = selectCatalogComponent(registry, req);
    assert(res.status === "UNVERIFIED", "Statut UNVERIFIED car le candidat n'a pas les données nécessaires");
  });

  // =========================================================================
  // AC-25 : Registre de catalogue (batching, comptage, filtrage)
  // =========================================================================
  runTest("TEST AC-25: Fonctionnalités complètes du registre de catalogue", () => {
    const registry = createCatalogRegistry();
    assert(registry.count() === 0, "Registre initial vide");

    const comp1 = createCatalogComponent({ id: "REG_PIPE_1", componentType: "PIPE", nominalDiameter: 50 });
    const comp2 = createCatalogComponent({ id: "REG_PIPE_2", componentType: "PIPE", nominalDiameter: 100 });
    const comp3 = createCatalogComponent({ id: "REG_VALVE_1", componentType: "VALVE", nominalDiameter: 50 });

    registry.registerBatch([comp1, comp2, comp3]);
    assert(registry.count() === 3, "3 composants enregistrés");
    assert(registry.has("REG_PIPE_1"), "Possède REG_PIPE_1");
    assert(registry.get("REG_PIPE_2")?.nominalDiameter === 100, "Récupération par ID");
    assert(registry.findByType("PIPE").length === 2, "2 PIPE trouvés");
    assert(registry.findByType("VALVE").length === 1, "1 VALVE trouvée");
    assert(registry.filter((c) => c.nominalDiameter === 50).length === 2, "2 composants DN50");

    registry.clear();
    assert(registry.count() === 0, "Registre vidé");
  });

  // =========================================================================
  // AC-26 : Erreur explicite sur ID invalide
  // =========================================================================
  runTest("TEST AC-26: Rejet immédiat sur ID de composant vide ou invalide", () => {
    let errorCaught = false;
    try {
      createCatalogComponent({
        id: "   ",
        componentType: "PIPE",
      });
    } catch {
      errorCaught = true;
    }
    assert(errorCaught, "Exception levée sur ID vide");
  });

  // =========================================================================
  // AC-27 : Erreur explicite sur type de composant invalide
  // =========================================================================
  runTest("TEST AC-27: Rejet immédiat sur type de composant invalide", () => {
    let errorCaught = false;
    try {
      createCatalogComponent({
        id: "SYNTH_INVALID_TYPE",
        componentType: "INVALID_UNKNOWN_TYPE" as any,
      });
    } catch {
      errorCaught = true;
    }
    assert(errorCaught, "Exception levée sur componentType inconnu");
  });

  // =========================================================================
  // AC-28 : Erreur sur ID en doublon dans le registre
  // =========================================================================
  runTest("TEST AC-28: Rejet des ID dupliqués dans le registre de catalogue", () => {
    const registry = createCatalogRegistry();
    const comp = createCatalogComponent({ id: "DUP_ID", componentType: "PIPE" });
    registry.register(comp);

    let dupCaught = false;
    try {
      registry.register(comp);
    } catch {
      dupCaught = true;
    }
    assert(dupCaught, "Exception levée sur ID dupliqué");
  });

  // =========================================================================
  // AC-29 : Rejet par Piping Specification sur classe de pression
  // =========================================================================
  runTest("TEST AC-29: Rejet par contrainte Piping Spec sur classe de pression", () => {
    const registry = createCatalogRegistry([
      createCatalogComponent({
        id: "SYNTH_TEE_CL150",
        componentType: "TEE",
        nominalDiameter: 50,
        pressureClass: "Class 150",
      }),
    ]);

    const req: PdiComponentSelectionRequest = {
      componentType: "TEE",
      nominalDiameter: 50,
      pipingSpecConstraint: {
        pipingSpecId: "PMS_CL600",
        pressureClass: "Class 600",
      },
    };

    const res = selectCatalogComponent(registry, req);
    assert(res.status === "NO_CANDIDATE", "Rejet car la classe 150 ne satisfait pas la spec Class 600");
  });

  // =========================================================================
  // AC-30 : Rejet par Piping Specification sur nuance de matériau
  // =========================================================================
  runTest("TEST AC-30: Rejet par contrainte Piping Spec sur nuance de matériau", () => {
    const registry = createCatalogRegistry([
      createCatalogComponent({
        id: "SYNTH_ELBOW_CS",
        componentType: "ELBOW",
        nominalDiameter: 80,
        material: "SYNTH_CARBON_STEEL",
      }),
    ]);

    const req: PdiComponentSelectionRequest = {
      componentType: "ELBOW",
      nominalDiameter: 80,
      pipingSpecConstraint: {
        pipingSpecId: "PMS_SS316",
        materialGrade: "SYNTH_STAINLESS_316L",
      },
    };

    const res = selectCatalogComponent(registry, req);
    assert(res.status === "NO_CANDIDATE", "Rejet car le matériau acier carbone ne satisfait pas la spec inox 316L");
  });

  // =========================================================================
  // ARCH-06-FIX-01 : TESTS DE GARDE FIX-01-01 À FIX-01-12
  // =========================================================================

  // FIX-01-01 : Une règle de compatibilité industrielle n'est pas créée directement dans ARCH-06
  runTest("TEST FIX-01-01 [ARCH-06-FIX-01]: Pas de création de règle normative autonome dans ARCH-06", () => {
    const compA = createCatalogComponent({ id: "COMP_A", componentType: "PIPE", nominalDiameter: 50, material: "SYNTH_CS", pressureClass: "Class 150", connectionType: "special_joint_a" });
    const compB = createCatalogComponent({ id: "COMP_B", componentType: "PIPE", nominalDiameter: 50, material: "SYNTH_CS", pressureClass: "Class 150", connectionType: "special_joint_b" });
    const res = checkComponentCompatibility(compA, compB);
    assert(res.overallStatus === "UNVERIFIED", "Doit rester UNVERIFIED sans autorité externe");
  });

  // FIX-01-02 : male_threaded + female_threaded ne produit pas automatiquement COMPATIBLE
  runTest("TEST FIX-01-02 [ARCH-06-FIX-01]: male_threaded + female_threaded ne produit pas COMPATIBLE sans autorité", () => {
    const male = createCatalogComponent({ id: "NIP_M", componentType: "OTHER", nominalDiameter: 25, material: "SYNTH_CS", pressureClass: "Class 800", connectionType: "male_threaded" });
    const female = createCatalogComponent({ id: "VLV_F", componentType: "VALVE", nominalDiameter: 25, material: "SYNTH_CS", pressureClass: "Class 800", connectionType: "female_threaded" });
    const res = checkComponentCompatibility(male, female);
    assert(res.overallStatus === "UNVERIFIED", "Reste UNVERIFIED sans preuve NORM-13");
    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.status === "UNVERIFIED", "Connexion UNVERIFIED");
  });

  // FIX-01-03 : RF + RTJ ne produit pas automatiquement INCOMPATIBLE sans autorité existante
  runTest("TEST FIX-01-03 [ARCH-06-FIX-01]: RF + RTJ ne produit pas INCOMPATIBLE sans autorité existante", () => {
    const fRF = createCatalogComponent({ id: "F_RF", componentType: "FLANGE", nominalDiameter: 100, material: "SYNTH_CS", pressureClass: "Class 300", connectionType: "flanged", faceType: "RF" });
    const fRTJ = createCatalogComponent({ id: "F_RTJ", componentType: "FLANGE", nominalDiameter: 100, material: "SYNTH_CS", pressureClass: "Class 300", connectionType: "flanged", faceType: "RTJ" });
    const res = checkComponentCompatibility(fRF, fRTJ);
    assert(res.overallStatus === "UNVERIFIED", "Reste UNVERIFIED sans décision NORM-13");
    const faceDim = res.dimensions.find((d) => d.dimension === "faceType");
    assert(faceDim?.status === "UNVERIFIED", "FaceType UNVERIFIED");
  });

  // FIX-01-04 : Une égalité de matériau n'est pas une qualification normative
  runTest("TEST FIX-01-04 [ARCH-06-FIX-01]: Egalité de matériau = observation DATA_MATCH, pas qualification normative", () => {
    const pipeA = createCatalogComponent({ id: "P_A", componentType: "PIPE", material: "ASTM_A106_GRB" });
    const pipeB = createCatalogComponent({ id: "P_B", componentType: "PIPE", material: "ASTM_A106_GRB" });
    const res = checkComponentCompatibility(pipeA, pipeB);
    const matDim = res.dimensions.find((d) => d.dimension === "material");
    assert(matDim?.observation === "DATA_MATCH", "Observation de correspondance de données DATA_MATCH");
  });

  // FIX-01-05 : Une égalité de standard n'est pas une qualification normative
  runTest("TEST FIX-01-05 [ARCH-06-FIX-01]: Egalité de standard = observation DATA_MATCH", () => {
    const pipeA = createCatalogComponent({ id: "P_A2", componentType: "PIPE", standard: "ASME_B3610" });
    const pipeB = createCatalogComponent({ id: "P_B2", componentType: "PIPE", standard: "ASME_B3610" });
    const res = checkComponentCompatibility(pipeA, pipeB);
    const stdDim = res.dimensions.find((d) => d.dimension === "standard");
    assert(stdDim?.observation === "DATA_MATCH", "Observation de standard DATA_MATCH");
  });

  // FIX-01-06 : Aucune conversion DN/NPS
  runTest("TEST FIX-01-06 [ARCH-06-FIX-01]: Aucune conversion DN ↔ NPS (maintien UNVERIFIED sur représentations hétérogènes)", () => {
    const cDN = createCatalogComponent({ id: "C_DN50", componentType: "PIPE", nominalDiameter: 50 });
    const cNPS = createCatalogComponent({ id: "C_NPS2", componentType: "PIPE", nominalSize: "2\"" });
    const res = checkComponentCompatibility(cDN, cNPS);
    const dnDim = res.dimensions.find((d) => d.dimension === "nominalSize");
    assert(dnDim?.status === "UNVERIFIED", "Statut UNVERIFIED sans conversion implicite");
  });

  // FIX-01-07 : Aucune conversion Class/PN (Class 150 !== PN16) et statut reste UNVERIFIED (FIX-02 §2)
  runTest("TEST FIX-01-07 [ARCH-06-FIX-01/02]: Aucune conversion Class ↔ PN (maintien UNVERIFIED / DATA_MISMATCH)", () => {
    const cClass = createCatalogComponent({ id: "C_CL150", componentType: "FLANGE", pressureClass: "Class 150" });
    const cPN = createCatalogComponent({ id: "C_PN16", componentType: "FLANGE", pressureClass: "PN16" });
    const res = checkComponentCompatibility(cClass, cPN);
    const pnDim = res.dimensions.find((d) => d.dimension === "pressureRating");
    assert(pnDim?.status === "UNVERIFIED", "Class 150 et PN16 ne sont pas convertis et restent UNVERIFIED sans décision NORM-13");
    assert(pnDim?.observation === "DATA_MISMATCH", "Observation DATA_MISMATCH");
  });

  // FIX-01-08 : NORM-13, s'il est applicable, est utilisé au lieu d'un moteur parallèle
  runTest("TEST FIX-01-08 [ARCH-06-FIX-01]: Délégation transparente à l'autorité NORM-13", () => {
    // Moteur mock NORM-13 qui autorise explicitement la relation bilatérale OTHER_TO_VALVE + male_threaded_TO_female_threaded
    const mockNorm13 = {
      evaluate(ctx: any) {
        if (ctx.componentType === "OTHER_TO_VALVE" && ctx.connectionType === "male_threaded_TO_female_threaded") {
          const rule = {
            ruleId: "NORM13_RULE_THREAD_MATING",
            description: "Bilateral OTHER to VALVE threaded mating rule",
            componentType: "OTHER_TO_VALVE",
            connectionType: "male_threaded_TO_female_threaded",
            status: "COMPATIBLE" as const,
            evidenceIds: ["EVID_NORM13_THREAD"],
          };
          return {
            status: "COMPATIBLE" as const,
            ruleId: rule.ruleId,
            matchedRule: rule,
            matchedRuleIds: [rule.ruleId],
            message: "Threaded mating verified by NORM-13",
            evidenceIds: ["EVID_NORM13_THREAD"],
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };

    const nipple = createCatalogComponent({ id: "NIP_M_DELEG", componentType: "OTHER", connectionType: "male_threaded" });
    const valve = createCatalogComponent({ id: "VLV_F_DELEG", componentType: "VALVE", connectionType: "female_threaded" });

    const res = checkComponentCompatibility(nipple, valve, {
      normativeCompatibilityEngine: mockNorm13,
    });

    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.status === "COMPATIBLE", "Statut COMPATIBLE retourné par NORM-13");
    assert(connDim?.observation === "NORMATIVE_DECISION", "Observation NORMATIVE_DECISION");
    assert(connDim?.matchedRuleId === "NORM13_RULE_THREAD_MATING", "Règle NORM-13 tracée");
    assert(res.evidenceIds.includes("EVID_NORM13_THREAD"), "Evidence NORM-13 agrégée");
  });

  // FIX-01-09 : Aucun evidenceId inventé
  runTest("TEST FIX-01-09 [ARCH-06-FIX-01]: Aucun evidenceId inventé sans preuve réelle", () => {
    const c1 = createCatalogComponent({ id: "C_NO_E1", componentType: "PIPE" });
    const c2 = createCatalogComponent({ id: "C_NO_E2", componentType: "PIPE" });
    const res = checkComponentCompatibility(c1, c2);
    assert(res.evidenceIds.length === 0, "0 evidenceId inventé");
  });

  // FIX-01-10 : Catalogue ≠ Normative Evidence
  runTest("TEST FIX-01-10 [ARCH-06-FIX-01]: Présence catalogue ne confère aucune preuve normative", () => {
    const tc = adaptTrouvayCauvinCatalogToPdiCatalog();
    for (const item of tc.slice(0, 10)) {
      assert(item.evidenceIds === undefined, "evidenceIds reste strictement undefined pour catalogue fabricant");
    }
  });

  // FIX-01-11 : Même inputs → résultat déterministe
  runTest("TEST FIX-01-11 [ARCH-06-FIX-01]: Déterminisme absolu des résultats", () => {
    const compA = createCatalogComponent({ id: "DET_A", componentType: "VALVE", nominalDiameter: 100, pressureClass: "Class 150" });
    const compB = createCatalogComponent({ id: "DET_B", componentType: "VALVE", nominalDiameter: 100, pressureClass: "Class 150" });
    const r1 = checkComponentCompatibility(compA, compB);
    const r2 = checkComponentCompatibility(compA, compB);
    assert(JSON.stringify(r1) === JSON.stringify(r2), "r1 === r2");
  });

  // FIX-01-12 : Les données source restent immuables
  runTest("TEST FIX-01-12 [ARCH-06-FIX-01]: Immutabilité stricte des objets sources", () => {
    const comp = createCatalogComponent({ id: "IMMUTABLE_SRC", componentType: "PIPE", nominalDiameter: 50 });
    const snapshot = JSON.stringify(comp);
    checkComponentCompatibility(comp, comp);
    assert(JSON.stringify(comp) === snapshot, "Aucune mutation");
  });

  // =========================================================================
  // ARCH-06-FIX-03 : TESTS OBLIGATOIRES (PRÉVENTION DU BYPASS UNILATÉRAL LEFT)
  // =========================================================================

  // TEST 1 — Bypass LEFT interdit
  runTest("TEST FIX-03-01 [ARCH-06-FIX-03]: Bypass LEFT interdit (un contexte unilatéral LEFT COMPATIBLE ne promeut jamais overallStatus)", () => {
    const leftPipe = createCatalogComponent({
      id: "SYNTH_FIX03_LEFT_PIPE",
      componentType: "PIPE",
      nominalDiameter: 100,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "SYNTH_MAT_CS",
      standard: "SYNTH_STD_PIPE",
    });

    const rightElbow = createCatalogComponent({
      id: "SYNTH_FIX03_RIGHT_ELBOW",
      componentType: "ELBOW",
      nominalDiameter: 100,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "SYNTH_MAT_CS",
      standard: "SYNTH_STD_ELBOW",
    });

    // Mock NORM-13 retournant COMPATIBLE uniquement pour un contexte unilatéral LEFT (componentType === "PIPE")
    const unilateralLeftMockNorm13 = {
      evaluate(ctx: any) {
        if (ctx.componentType === "PIPE") {
          return {
            status: "COMPATIBLE" as const,
            ruleId: "SYNTH_UNILATERAL_LEFT_PIPE_RULE",
            matchedRuleIds: ["SYNTH_UNILATERAL_LEFT_PIPE_RULE"],
            message: "Unilateral LEFT PIPE rule matched",
            evidenceIds: ["EVID_SYNTH_UNILATERAL_LEFT"],
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };

    const res = checkComponentCompatibility(leftPipe, rightElbow, {
      normativeCompatibilityEngine: unilateralLeftMockNorm13,
    });

    assert(res.overallStatus !== "COMPATIBLE", "Un résultat normatif unilatéral LEFT ne doit jamais rendre overallStatus COMPATIBLE");
    assert(res.overallStatus === "UNVERIFIED", "overallStatus doit rester UNVERIFIED sans décision bilatérale LEFT ↔ RIGHT");
    assert(!res.evidenceIds.includes("EVID_SYNTH_UNILATERAL_LEFT"), "Aucune preuve unilatérale LEFT injectée");
  });

  // TEST 2 — DATA_MATCH reste UNVERIFIED
  runTest("TEST FIX-03-02 [ARCH-06-FIX-03]: DATA_MATCH reste UNVERIFIED (même connexion, DN, matériau, standard, rating sans décision normative)", () => {
    const compLeft = createCatalogComponent({
      id: "SYNTH_FIX03_DM_LEFT",
      componentType: "PIPE",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      material: "SYNTH_MAT_A",
      standard: "SYNTH_STD_A",
      pressureClass: "Class 150",
    });

    const compRight = createCatalogComponent({
      id: "SYNTH_FIX03_DM_RIGHT",
      componentType: "ELBOW",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      material: "SYNTH_MAT_A",
      standard: "SYNTH_STD_A",
      pressureClass: "Class 150",
    });

    const res = checkComponentCompatibility(compLeft, compRight);
    assert(res.overallStatus === "UNVERIFIED", "overallStatus doit être UNVERIFIED");

    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    const sizeDim = res.dimensions.find((d) => d.dimension === "nominalSize");
    const matDim = res.dimensions.find((d) => d.dimension === "material");
    const stdDim = res.dimensions.find((d) => d.dimension === "standard");
    const ratingDim = res.dimensions.find((d) => d.dimension === "pressureRating");

    assert(connDim?.observation === "DATA_MATCH" && connDim?.status === "UNVERIFIED", "connection DATA_MATCH / UNVERIFIED");
    assert(sizeDim?.observation === "DATA_MATCH" && sizeDim?.status === "UNVERIFIED", "nominalSize DATA_MATCH / UNVERIFIED");
    assert(matDim?.observation === "DATA_MATCH" && matDim?.status === "UNVERIFIED", "material DATA_MATCH / UNVERIFIED");
    assert(stdDim?.observation === "DATA_MATCH" && stdDim?.status === "UNVERIFIED", "standard DATA_MATCH / UNVERIFIED");
    assert(ratingDim?.observation === "DATA_MATCH" && ratingDim?.status === "UNVERIFIED", "pressureRating DATA_MATCH / UNVERIFIED");
    assert(res.evidenceIds.length === 0, "DATA_MATCH ne reçoit pas artificiellement de preuves normatives");
  });

  // TEST 3 — DATA_MISMATCH ne devient pas INCOMPATIBLE
  runTest("TEST FIX-03-03 [ARCH-06-FIX-03]: DATA_MISMATCH (DN100 vs DN150) reste UNVERIFIED sans décision normative", () => {
    const compDn100 = createCatalogComponent({
      id: "SYNTH_FIX03_DN100",
      componentType: "PIPE",
      nominalDiameter: 100,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "SYNTH_MAT_A",
    });

    const compDn150 = createCatalogComponent({
      id: "SYNTH_FIX03_DN150",
      componentType: "ELBOW",
      nominalDiameter: 150,
      connectionType: "butt_weld",
      pressureClass: "Class 150",
      material: "SYNTH_MAT_A",
    });

    const res = checkComponentCompatibility(compDn100, compDn150);
    assert(res.overallStatus === "UNVERIFIED", "overallStatus doit rester UNVERIFIED sans décision normative");
    const sizeDim = res.dimensions.find((d) => d.dimension === "nominalSize");
    assert(sizeDim?.observation === "DATA_MISMATCH", "Observation DATA_MISMATCH sur nominalSize");
    assert(sizeDim?.status === "UNVERIFIED", "Statut UNVERIFIED sur nominalSize");
  });

  // TEST 4 — Vraie décision normative de dimension conservée
  runTest("TEST FIX-03-04 [ARCH-06-FIX-03]: Vraie décision normative de dimension (NORMATIVE_DECISION + COMPATIBLE) conservée avec traçabilité", () => {
    const compLeft = createCatalogComponent({
      id: "SYNTH_FIX03_DEC_L",
      componentType: "PIPE",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_A",
    });

    const compRight = createCatalogComponent({
      id: "SYNTH_FIX03_DEC_R",
      componentType: "ELBOW",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_A",
    });

    const bilateralNorm13 = {
      evaluate(ctx: any) {
        if (ctx.componentType === "PIPE_TO_ELBOW" && ctx.connectionType === "butt_weld_TO_butt_weld") {
          const rule = {
            ruleId: "SYNTH_RULE_BILAT_CONN_01",
            description: "Bilateral connection rule",
            componentType: "PIPE_TO_ELBOW",
            connectionType: "butt_weld_TO_butt_weld",
            status: "COMPATIBLE" as const,
            evidenceIds: ["EVID_SYNTH_BILAT_01"],
          };
          return {
            status: "COMPATIBLE" as const,
            ruleId: rule.ruleId,
            matchedRule: rule,
            matchedRuleIds: [rule.ruleId],
            message: "Bilateral connection verified",
            evidenceIds: ["EVID_SYNTH_BILAT_01"],
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };

    const res = checkComponentCompatibility(compLeft, compRight, {
      normativeCompatibilityEngine: bilateralNorm13,
    });

    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.observation === "NORMATIVE_DECISION", "Observation NORMATIVE_DECISION sur la dimension connection");
    assert(connDim?.status === "COMPATIBLE", "Statut COMPATIBLE sur la dimension connection");
    assert(connDim?.matchedRuleId === "SYNTH_RULE_BILAT_CONN_01", "ruleId conservé sur la dimension");
    assert(connDim?.matchedRuleIds?.includes("SYNTH_RULE_BILAT_CONN_01") === true, "matchedRuleIds conservé sur la dimension");
    assert(connDim?.evidenceIds?.includes("EVID_SYNTH_BILAT_01") === true, "evidenceIds conservé sur la dimension");
    assert(res.overallStatus === "COMPATIBLE", "La décision normative bilatérale de dimension promeut overallStatus à COMPATIBLE");
    assert(res.evidenceIds.includes("EVID_SYNTH_BILAT_01"), "evidenceIds conservé au niveau global");
    assert(res.matchedRuleIds?.includes("SYNTH_RULE_BILAT_CONN_01") === true, "matchedRuleIds conservé au niveau global");
  });

  // TEST 5 — NORM-13 INCOMPATIBLE explicite
  runTest("TEST FIX-03-05 [ARCH-06-FIX-03]: Décision normative explicite INCOMPATIBLE (NORMATIVE_DECISION + INCOMPATIBLE) préservée", () => {
    const compLeft = createCatalogComponent({
      id: "SYNTH_FIX03_INC_L",
      componentType: "PIPE",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_A",
    });

    const compRight = createCatalogComponent({
      id: "SYNTH_FIX03_INC_R",
      componentType: "ELBOW",
      connectionType: "flanged",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_A",
    });

    const incompatNorm13 = {
      evaluate(ctx: any) {
        if (ctx.componentType === "PIPE_TO_ELBOW" && ctx.connectionType === "butt_weld_TO_flanged") {
          const rule = {
            ruleId: "SYNTH_RULE_INCOMPAT_CONN_01",
            description: "Bilateral butt_weld to flanged incompatibility rule",
            componentType: "PIPE_TO_ELBOW",
            connectionType: "butt_weld_TO_flanged",
            status: "INCOMPATIBLE" as const,
            evidenceIds: ["EVID_SYNTH_INCOMPAT_01"],
          };
          return {
            status: "INCOMPATIBLE" as const,
            ruleId: rule.ruleId,
            matchedRule: rule,
            matchedRuleIds: [rule.ruleId],
            message: "Direct butt_weld to flanged connection is normatively incompatible",
            evidenceIds: ["EVID_SYNTH_INCOMPAT_01"],
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };

    const res = checkComponentCompatibility(compLeft, compRight, {
      normativeCompatibilityEngine: incompatNorm13,
    });

    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.observation === "NORMATIVE_DECISION", "Observation NORMATIVE_DECISION");
    assert(connDim?.status === "INCOMPATIBLE", "Statut dimension INCOMPATIBLE");
    assert(connDim?.matchedRuleId === "SYNTH_RULE_INCOMPAT_CONN_01", "ruleId tracé");
    assert(connDim?.evidenceIds?.includes("EVID_SYNTH_INCOMPAT_01") === true, "evidenceIds tracé sur la dimension");
    assert(res.overallStatus === "INCOMPATIBLE", "overallStatus doit être INCOMPATIBLE");
    assert(res.evidenceIds.includes("EVID_SYNTH_INCOMPAT_01"), "evidenceIds tracé au niveau global");
    assert(res.matchedRuleIds?.includes("SYNTH_RULE_INCOMPAT_CONN_01") === true, "matchedRuleIds tracé au niveau global");
  });

  // =========================================================================
  // ARCH-06-FIX-04 : VALIDATION STRICTE DE LA DÉCISION BILATÉRALE
  // =========================================================================

  // FIX-04-01 : Une règle générique NORM-13 ({ connectionType: "butt_weld" }) ne produit JAMAIS NORMATIVE_DECISION
  runTest("TEST FIX-04-01 [ARCH-06-FIX-04]: Règle générique ou partielle NORM-13 rejetée (reste DATA_MATCH / UNVERIFIED)", () => {
    const compLeft = createCatalogComponent({
      id: "SYNTH_FIX04_GEN_L",
      componentType: "PIPE",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_CS",
    });

    const compRight = createCatalogComponent({
      id: "SYNTH_FIX04_GEN_R",
      componentType: "ELBOW",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_CS",
    });

    // Moteur retournant COMPATIBLE mais avec une matchedRule générique (sans relation bilatérale explicite)
    const genericRuleNorm13 = {
      evaluate(_ctx: any) {
        return {
          status: "COMPATIBLE" as const,
          ruleId: "SYNTH_GENERIC_CONN_RULE",
          matchedRule: {
            ruleId: "SYNTH_GENERIC_CONN_RULE",
            description: "Generic butt_weld rule",
            connectionType: "butt_weld", // générique, pas butt_weld_TO_butt_weld ni componentType bilatéral
            status: "COMPATIBLE" as const,
          },
          matchedRuleIds: ["SYNTH_GENERIC_CONN_RULE"],
          evidenceIds: ["EVID_GENERIC_01"],
          message: "Generic rule matched",
        };
      },
    };

    const res = checkComponentCompatibility(compLeft, compRight, {
      normativeCompatibilityEngine: genericRuleNorm13,
    });

    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.observation !== "NORMATIVE_DECISION", "Une règle générique ne doit jamais produire NORMATIVE_DECISION");
    assert(connDim?.observation === "DATA_MATCH", "Observation reste DATA_MATCH");
    assert(connDim?.status === "UNVERIFIED", "Statut de la dimension reste UNVERIFIED");
    assert(res.overallStatus === "UNVERIFIED", "overallStatus reste UNVERIFIED");
    assert(!res.evidenceIds.includes("EVID_GENERIC_01"), "Aucune preuve d'une règle générique non bilatérale n'est agrégée");
  });

  // FIX-04-02 : Réponse NORM-13 sans matchedRule explicite (seulement status + ruleId) est rejetée
  runTest("TEST FIX-04-02 [ARCH-06-FIX-04]: Réponse NORM-13 sans matchedRule vérifiable ne produit jamais NORMATIVE_DECISION", () => {
    const compLeft = createCatalogComponent({
      id: "SYNTH_FIX04_NOMR_L",
      componentType: "PIPE",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_CS",
    });

    const compRight = createCatalogComponent({
      id: "SYNTH_FIX04_NOMR_R",
      componentType: "ELBOW",
      connectionType: "butt_weld",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_MAT_CS",
    });

    const noMatchedRuleEngine = {
      evaluate(_ctx: any) {
        return {
          status: "COMPATIBLE" as const,
          ruleId: "RULE_WITHOUT_MATCHED_OBJECT",
          matchedRuleIds: ["RULE_WITHOUT_MATCHED_OBJECT"],
          evidenceIds: ["EVID_NO_OBJ"],
        };
      },
    };

    const res = checkComponentCompatibility(compLeft, compRight, {
      normativeCompatibilityEngine: noMatchedRuleEngine,
    });

    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(connDim?.observation === "DATA_MATCH", "Sans matchedRule, observation = DATA_MATCH");
    assert(connDim?.status === "UNVERIFIED", "Sans matchedRule, status = UNVERIFIED");
    assert(res.overallStatus === "UNVERIFIED", "overallStatus = UNVERIFIED");
  });

  // FIX-04-03 : Règle avec componentType partiel (PIPE au lieu de PIPE_TO_ELBOW) est rejetée
  runTest("TEST FIX-04-03 [ARCH-06-FIX-04]: Règle avec componentType unilatéral dans matchedRule rejetée", () => {
    const compLeft = createCatalogComponent({
      id: "SYNTH_FIX04_PART_L",
      componentType: "PIPE",
      material: "SYNTH_MAT_CS",
    });

    const compRight = createCatalogComponent({
      id: "SYNTH_FIX04_PART_R",
      componentType: "ELBOW",
      material: "SYNTH_MAT_CS",
    });

    const partialComponentTypeEngine = {
      evaluate(_ctx: any) {
        return {
          status: "COMPATIBLE" as const,
          ruleId: "RULE_PARTIAL_COMP_TYPE",
          matchedRule: {
            ruleId: "RULE_PARTIAL_COMP_TYPE",
            description: "Partial unilateral componentType rule",
            componentType: "PIPE", // unilatéral, pas PIPE_TO_ELBOW
            materialId: "SYNTH_MAT_CS_TO_SYNTH_MAT_CS",
            status: "COMPATIBLE" as const,
          },
          matchedRuleIds: ["RULE_PARTIAL_COMP_TYPE"],
          evidenceIds: ["EVID_PARTIAL"],
        };
      },
    };

    const res = checkComponentCompatibility(compLeft, compRight, {
      normativeCompatibilityEngine: partialComponentTypeEngine,
    });

    const matDim = res.dimensions.find((d) => d.dimension === "material");
    assert(matDim?.observation === "DATA_MATCH", "Observation reste DATA_MATCH");
    assert(matDim?.status === "UNVERIFIED", "Status reste UNVERIFIED");
    assert(res.overallStatus !== "COMPATIBLE", "Ne promeut jamais overallStatus en COMPATIBLE");
  });

  // FIX-04-04 : Règle bilatérale complète et exacte acceptée sur toutes les dimensions (nominalSize, pressureRating, material, standard, faceType)
  runTest("TEST FIX-04-04 [ARCH-06-FIX-04]: Règle bilatérale explicite complète validée avec traçabilité sur les dimensions", () => {
    const flangeLeft = createCatalogComponent({
      id: "SYNTH_FIX04_FLG_L",
      componentType: "FLANGE",
      connectionType: "flanged",
      faceType: "RF",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_A105",
      standard: "SYNTH_B165",
    });

    const valveRight = createCatalogComponent({
      id: "SYNTH_FIX04_VLV_R",
      componentType: "VALVE",
      connectionType: "flanged",
      faceType: "RF",
      nominalDiameter: 100,
      pressureClass: "Class 150",
      material: "SYNTH_A216_WCB",
      standard: "SYNTH_B1634",
    });

    const strictBilateralEngine = {
      evaluate(ctx: any) {
        if (ctx.componentType === "FLANGE_TO_VALVE" && ctx.materialId === "SYNTH_A105_TO_SYNTH_A216_WCB") {
          const rule = {
            ruleId: "SYNTH_BILAT_MAT_RULE_01",
            description: "Bilateral FLANGE to VALVE material compatibility rule",
            componentType: "FLANGE_TO_VALVE",
            materialId: "SYNTH_A105_TO_SYNTH_A216_WCB",
            status: "COMPATIBLE" as const,
            evidenceIds: ["EVID_BILAT_MAT_01"],
          };
          return {
            status: "COMPATIBLE" as const,
            ruleId: rule.ruleId,
            matchedRule: rule,
            matchedRuleIds: [rule.ruleId],
            evidenceIds: ["EVID_BILAT_MAT_01"],
          };
        }
        return { status: "UNVERIFIED" as const };
      },
    };

    const res = checkComponentCompatibility(flangeLeft, valveRight, {
      normativeCompatibilityEngine: strictBilateralEngine,
    });

    const matDim = res.dimensions.find((d) => d.dimension === "material");
    const connDim = res.dimensions.find((d) => d.dimension === "connection");
    assert(matDim?.observation === "NORMATIVE_DECISION", "Material = NORMATIVE_DECISION");
    assert(matDim?.status === "COMPATIBLE", "Material = COMPATIBLE");
    assert(matDim?.matchedRuleId === "SYNTH_BILAT_MAT_RULE_01", "ruleId tracé sur material");
    assert(connDim?.observation === "DATA_MATCH" && connDim?.status === "UNVERIFIED", "Connection sans règle bilatérale reste DATA_MATCH / UNVERIFIED");
    assert(res.overallStatus === "COMPATIBLE", "Décision bilatérale explicite promeut overallStatus");
    assert(res.evidenceIds.includes("EVID_BILAT_MAT_01"), "Evidence bilatérale tracée");
  });

  // =========================================================================
  // NON-RÉGRESSION ARCH-01..05 & NORM-01..14
  // =========================================================================
  runTest("TEST NON-REGRESSION: NORM-01..14 Global Integration Tests", () => {
    const res = runNormativeGlobalIntegrationTests();
    assert(res.success, `NORM Global tests failed (${res.failed} failures)`);
  });

  runTest("TEST NON-REGRESSION: ARCH-01 Isometric Normative Bridge Tests", () => {
    const res = runArch01IsometricNormativeBridgeTests();
    assert(res.success, "ARCH-01 tests failed");
  });

  runTest("TEST NON-REGRESSION: ARCH-02 PMS Authority Unification Tests", () => {
    const res = runArch02PmsAuthorityUnificationTests();
    assert(res.success, "ARCH-02 tests failed");
  });

  runTest("TEST NON-REGRESSION: ARCH-03 Universal Model Tests", () => {
    const res = runArch03UniversalModelTests();
    assert(res.success, "ARCH-03 tests failed");
  });

  runTest("TEST NON-REGRESSION: ARCH-04 Project Workspace Data Tests", () => {
    const res = runArch04ProjectWorkspaceDataTests();
    assert(res.success, "ARCH-04 tests failed");
  });

  runTest("TEST NON-REGRESSION: ARCH-05 Technical Workflow Tests", () => {
    const res = runArch05TechnicalWorkflowTests();
    assert(res.success, "ARCH-05 tests failed");
  });

  return Object.freeze({
    success: testsFailed === 0 && testsRun >= 53,
    testsRun,
    testsPassed,
    testsFailed,
    failures: Object.freeze(failures),
  });
}
