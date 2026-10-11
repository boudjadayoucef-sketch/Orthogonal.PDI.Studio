/**
 * PDI ENGINEERING PLATFORM — ARCH-11 ASME B31.8 GAS PIPELINE READINESS TEST SUITE
 * Reference: ARCH-11 (ASME B31.8 — Gas Pipeline Engineering & Calculation Readiness)
 *
 * Couvre de manière déterministe les exigences de validation ARCH-11 (§1 & §3.D) :
 * 1. Identification d'un contexte d'ingénierie pipeline gaz ASME B31.8 (Étape 1 & Étape 2).
 * 2. Séparation stricte des 6 niveaux : Domaine -> Code/Édition -> Preuves normatives ->
 *    Qualification -> Disponibilité -> Exécution numérique.
 * 3. Vérification que la résolution d'ASME B31.8 n'active ni ne qualifie jamais automatiquement un calcul.
 * 4. Maintien explicite de tous les calculs ASME B31.8 (`PRESSURE_WALL_THICKNESS`, `HOOP_STRESS`,
 *    `ALLOWABLE_PRESSURE`, `TEST_PRESSURE`) à `NOT_IMPLEMENTED`.
 * 5. Absence totale de substitution inter-codes entre `ASME-B31.3`, `ASME-B31.8` et `ASME-B31.12`.
 * 6. Interdiction d'inférer le code à partir d'un nom de client, d'un titre de projet, d'un libellé matériau
 *    ou d'une licence commerciale.
 * 7. Préservation intacte du comportement qualifié d'`ASME-B31.3` (F01 Eq. 3a/3b) et du statut `NOT_IMPLEMENTED` d'`ASME-B31.12`.
 * 8. Préservation de l'immuabilité du modèle Pipeline (ARCH-10), des déclarations de fluide et de la validation des preuves (NORM-09).
 */

import {
  createPipelineNode,
  createPipelineSegment,
  createPipelineSystem,
} from "../../engineering/model/pipelineEngineeringModel";
import {
  buildPipelineMultiCodeResolutionContext,
  evaluateB31_8GasServiceStatus,
  evaluateB31_8PipelineReadiness,
  executeGuardedB31_8PipelineCalculation,
  validateB31_8PipelineReadinessRequest,
} from "../engine/b31_8ReadinessEngine";
import {
  ASME_B31_8_DESIGN_CODE_ID,
  ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID,
} from "../types/b31_8ReadinessTypes";
import {
  DESIGN_CODE_CALCULATION_REGISTRY,
  getDesignCodeCalculationEntry,
} from "../registry/designCodeRegistry";
import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import { resolveApplicableDesignCode } from "../engine/multiCodeResolver";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { getUpcomingNormativeSourceDocuments } from "../registry/normativeSourceDocumentRegistry";
import { runArch08MultiDomainArchitectureTests } from "./arch08MultiDomainArchitectureTests";
import { runArch09MultiCodeResolverTests } from "./arch09MultiCodeResolverTests";
import { runArch10PipelineEngineeringModelTests } from "./arch10PipelineEngineeringModelTests";

export interface Arch11TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-11 ASSERTION FAILED] ${message}`);
  }
}

export function runArch11B31_8PipelineReadinessTests(): Arch11TestResult {
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

  function createSampleGasPipelineSystem() {
    const n1 = createPipelineNode({
      id: "N-INLET-KP0",
      systemId: "SYS-GAS-B318",
      name: "Compressor Station Inlet KP 0.0",
      kind: "COMPRESSOR_STATION",
      stationPoint: { value: 0, unit: "km" },
      connectedSegmentIds: ["SEG-GAS-01"],
    });
    const n2 = createPipelineNode({
      id: "N-OUTLET-KP40",
      systemId: "SYS-GAS-B318",
      name: "Metering Station Outlet KP 40.0",
      kind: "METERING_REGULATING_STATION",
      stationPoint: { value: 40, unit: "km" },
      connectedSegmentIds: ["SEG-GAS-01"],
    });
    const seg1 = createPipelineSegment({
      id: "SEG-GAS-01",
      systemId: "SYS-GAS-B318",
      name: "Main Gas Transmission Trunkline DN 600",
      startNodeId: "N-INLET-KP0",
      endNodeId: "N-OUTLET-KP40",
      length: { value: 40, unit: "km" },
      dimensions: {
        nominalDiameter: { value: 600, unit: "mm" },
        outerDiameter: { value: 610, unit: "mm" },
        wallThickness: { value: 12.7, unit: "mm" },
      },
      material: {
        materialId: "MAT_API_5L_X65_PSL2",
        standardCode: "API-5L",
        grade: "X65",
      },
      service: {
        fluidCategory: "NATURAL_GAS",
        phase: "GAS",
        designPressure: { value: 85, unit: "bar" },
        designTemperature: { value: 60, unit: "C" },
      },
      domainAttributes: {
        kilometerPointStart: 0,
        kilometerPointEnd: 40,
        burialDepthMeters: 1.2,
        classLocation: 1,
        designFactorF: 0.72,
      },
      traceabilityRefs: {
        designCodeRef: "ASME-B31.8",
        sourceDocumentIds: ["DOC-ASME-B31.8-2022"],
      },
    });

    return createPipelineSystem({
      id: "SYS-GAS-B318",
      name: "Gas Transmission System Section 1",
      projectId: "PRJ-GAS-01",
      service: {
        fluidCategory: "NATURAL_GAS",
        phase: "GAS",
        designPressure: { value: 85, unit: "bar" },
      },
      nodes: [n1, n2],
      segments: [seg1],
      traceabilityRefs: {
        designCodeRef: "ASME-B31.8",
      },
    });
  }

  // =========================================================================
  // TEST 01 : IDENTIFICATION DU DOMAINE PIPELINE GAZ ET SÉPARATION DES 6 NIVEAUX
  // =========================================================================
  runTest("TEST 01 [ARCH-11]: Identification du domaine PIPELINE gaz ASME B31.8 et séparation explicite des 6 niveaux", () => {
    const gasSystem = createSampleGasPipelineSystem();

    const readiness = evaluateB31_8PipelineReadiness({
      system: gasSystem,
      segmentId: "SEG-GAS-01",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "SI",
    });

    // Étape 1 : Domaine et modèle pipeline identifiés
    assert(
      readiness.stage1DomainIdentification.domainIdentified === true,
      "Étape 1 : le domaine PIPELINE doit être identifié"
    );
    assert(
      readiness.stage1DomainIdentification.engineeringDomain === "PIPELINE",
      "Étape 1 : engineeringDomain === 'PIPELINE'"
    );
    assert(
      readiness.stage1DomainIdentification.modelStructurallyValid === true,
      "Étape 1 : le modèle PipelineSystem est structurellement valide"
    );
    assert(
      readiness.stage1DomainIdentification.gasServiceStatus === "GAS_SERVICE_DECLARED",
      "Étape 1 : service gaz naturel explicitement déclaré"
    );
    assert(
      readiness.stage1DomainIdentification.declaredClassLocation === 1 &&
        readiness.stage1DomainIdentification.declaredDesignFactorF === 0.72,
      "Étape 1 : attributs déclaratifs classLocation et designFactorF préservés"
    );

    // Étape 2 : Code ASME-B31.8 et édition 2022 identifiés par MultiCodeResolver
    assert(
      readiness.stage2CodeIdentification.resolutionStatus === "RESOLVED" &&
        readiness.stage2CodeIdentification.isB31_8Resolved === true &&
        readiness.stage2CodeIdentification.resolvedDesignCodeId === "ASME-B31.8",
      "Étape 2 : ASME-B31.8 doit être résolu"
    );
    assert(
      readiness.stage2CodeIdentification.identifiedEdition?.year === "2022",
      "Étape 2 : l'édition 2022 issue de PDI_STANDARDS_REGISTRY est identifiée"
    );

    // Étape 3 : Preuves normatives et document source restent UNVERIFIED (pas de promotion automatique)
    assert(
      readiness.stage3NormativeEvidence.referenceSourceDocumentId ===
        ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID,
      "Étape 3 : référence au document source DOC-ASME-B31.8-2022"
    );
    assert(
      readiness.stage3NormativeEvidence.referenceSourceDocumentStatus === "UNVERIFIED",
      "Étape 3 : DOC-ASME-B31.8-2022 est honnêtement déclaré UNVERIFIED"
    );
    assert(
      readiness.stage3NormativeEvidence.isAuthoritativeSourceVerified === false,
      "Étape 3 : aucune source normative B31.8 vérifiée n'est prétendue présente"
    );
    assert(
      readiness.stage3NormativeEvidence.isEditionEvidenceVerified === false,
      "Étape 3 : l'édition 2022 sans preuve NormativeEvidence VERIFIED reste non vérifiée"
    );

    // Étape 4 : Qualification des calculs B31.8 = NOT_QUALIFIED
    assert(
      readiness.stage4CalculationQualification.qualificationStatus === "NOT_QUALIFIED" &&
        readiness.stage4CalculationQualification.isCalculationQualified === false &&
        readiness.stage4CalculationQualification.qualifiedFormulaCount === 0,
      "Étape 4 : aucune formule B31.8 n'est faussement déclarée qualifiée"
    );

    // Étape 5 : Disponibilité des calculs B31.8 = NOT_IMPLEMENTED
    assert(
      readiness.stage5CalculationAvailability.codeSupportStatus === "NOT_IMPLEMENTED" &&
        readiness.stage5CalculationAvailability.availabilityStatus === "NOT_IMPLEMENTED" &&
        readiness.stage5CalculationAvailability.isCalculationAvailable === false,
      "Étape 5 : la capacité de calcul B31.8 reste NOT_IMPLEMENTED"
    );

    // Étape 6 : Garde d'exécution numérique bloquée
    assert(
      readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === false &&
        readiness.stage6NumericalExecutionGate.executionPerformed === false,
      "Étape 6 : l'exécution numérique B31.8 est bloquée"
    );
    assert(
      readiness.status === "BLOCKED_CALCULATION_NOT_IMPLEMENTED",
      `Statut global attendu BLOCKED_CALCULATION_NOT_IMPLEMENTED, reçu ${readiness.status}`
    );
  });

  // =========================================================================
  // TEST 02 : LA RÉSOLUTION OU MÊME UNE PREUVE D'ÉDITION N'ACTIVE JAMAIS UN CALCUL B31.8
  // =========================================================================
  runTest("TEST 02 [ARCH-11]: Séparation édition/preuves vs qualification/disponibilité — même avec une preuve d'édition VERIFIED, le calcul B31.8 reste NOT_IMPLEMENTED", () => {
    const gasSystem = createSampleGasPipelineSystem();

    // Enregistrement d'une preuve d'édition VERIFIED dans un registre isolé de test
    const customEvidenceRegistry = new NormativeEvidenceRegistry();
    customEvidenceRegistry.register({
      evidenceId: "EVID-B318-ED2022-SCOPE",
      standardId: "ASME-B31.8",
      editionId: "2022",
      clauseReference: "802.1",
      sourceType: "LICENSED_STANDARD",
      sourceReference: "ASME B31.8-2022 Scope Identification Only",
      verificationStatus: "VERIFIED",
      verifiedBy: "NORMATIVE_AUDIT",
      verifiedAt: "2026-10-10T00:00:00Z",
    });
    const customEvidenceResolver = new NormativeEvidenceResolver(customEvidenceRegistry);

    const readiness = evaluateB31_8PipelineReadiness(
      {
        system: gasSystem,
        segmentId: "SEG-GAS-01",
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
        unitSystem: "SI",
        evidenceIds: ["EVID-B318-ED2022-SCOPE"],
      },
      {
        resolverConfig: { evidenceResolver: customEvidenceResolver },
      }
    );

    // L'étape 3 (preuve d'édition) passe à VERIFIED, mais les étapes 4, 5 et 6 restent bloquées !
    assert(
      readiness.stage3NormativeEvidence.isEditionEvidenceVerified === true,
      "Étape 3 : la preuve d'édition fournie est résolue VERIFIED"
    );
    assert(
      readiness.stage4CalculationQualification.isCalculationQualified === false &&
        readiness.stage4CalculationQualification.qualificationStatus === "NOT_QUALIFIED",
      "Étape 4 : la preuve d'édition ne qualifie JAMAIS automatiquement une formule de calcul"
    );
    assert(
      readiness.stage5CalculationAvailability.isCalculationAvailable === false &&
        readiness.stage5CalculationAvailability.availabilityStatus === "NOT_IMPLEMENTED",
      "Étape 5 : la disponibilité du calcul reste NOT_IMPLEMENTED"
    );
    assert(
      readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === false &&
        readiness.status === "BLOCKED_CALCULATION_NOT_IMPLEMENTED",
      "Étape 6 : le calcul numérique reste strictement bloqué"
    );
  });

  // =========================================================================
  // TEST 03 : TOUS LES CALCULS ASME B31.8 RESTENT EXPLICITEMENT BLOQUÉS (NOT_IMPLEMENTED)
  // =========================================================================
  runTest("TEST 03 [ARCH-11]: Tous les types de calculs ASME B31.8 restent bloqués à NOT_IMPLEMENTED sans formule inventée", () => {
    const gasSystem = createSampleGasPipelineSystem();
    const b318Entry = getDesignCodeCalculationEntry(ASME_B31_8_DESIGN_CODE_ID);

    assert(b318Entry !== undefined, "ASME-B31.8 est enregistré dans DESIGN_CODE_CALCULATION_REGISTRY");
    assert(b318Entry!.status === "NOT_IMPLEMENTED", "Statut de ASME-B31.8 = NOT_IMPLEMENTED");
    assert(b318Entry!.supportedCalculationTypes.length === 0, "Aucun calcul supporté déclaré");
    assert(b318Entry!.formulaReferences.length === 0, "Aucune formule B31.8 inventée");

    const upcomingB318Doc = getUpcomingNormativeSourceDocuments().find(
      (d) => d.standardId === "ASME-B31.8"
    );
    assert(
      upcomingB318Doc !== undefined && upcomingB318Doc.status === "UNVERIFIED",
      "Le document source DOC-ASME-B31.8-2022 reste UNVERIFIED"
    );

    const calcTypes = [
      "PRESSURE_WALL_THICKNESS",
      "ALLOWABLE_PRESSURE",
      "HOOP_STRESS",
      "TEST_PRESSURE",
    ] as const;

    for (const calcType of calcTypes) {
      const guardedExec = executeGuardedB31_8PipelineCalculation(
        {
          system: gasSystem,
          segmentId: "SEG-GAS-01",
          requestedCalculationType: calcType,
          unitSystem: "SI",
        },
        {
          designCodeId: "ASME-B31.8",
          calculationType: calcType,
          pressure: 8.5,
          temperature: 60,
          outsideDiameterMm: 610,
          wallThicknessMm: 12.7,
          corrosionAllowanceMm: 0,
          weldJointFactor: 1.0,
          allowableStressMpa: 300,
          designFactor: 0.72,
          unitSystem: "SI",
        }
      );

      assert(
        guardedExec.calculationExecuted === false,
        `Aucun calcul numérique ne doit être exécuté pour ${calcType}`
      );
      assert(
        guardedExec.calculationResult.status === "NOT_IMPLEMENTED",
        `Le statut d'exécution pour ${calcType} sous ASME-B31.8 doit être NOT_IMPLEMENTED (reçu: ${guardedExec.calculationResult.status})`
      );
      assert(
        guardedExec.calculationResult.value === undefined &&
          guardedExec.calculationResult.minimumRequiredThicknessMm === undefined,
        `Aucune valeur numérique ne doit être produite pour ${calcType}`
      );
    }
  });

  // =========================================================================
  // TEST 04 : ABSENCE TOTALE DE SUBSTITUTION INTER-CODES ENTRE B31.3, B31.8 ET B31.12
  // =========================================================================
  runTest("TEST 04 [ARCH-11]: Rejet de toute substitution inter-codes entre ASME-B31.3, ASME-B31.8 et ASME-B31.12", () => {
    const gasSystem = createSampleGasPipelineSystem();

    // Cas 1 : Tenter d'exécuter un calcul ASME-B31.3 (ou ASME-B31.12) via la garde B31.8
    for (const foreignCode of ["ASME-B31.3", "ASME-B31.12", "ASME-B31.4"] as const) {
      const crossExec = executeGuardedB31_8PipelineCalculation(
        {
          system: gasSystem,
          segmentId: "SEG-GAS-01",
        },
        {
          designCodeId: foreignCode,
          calculationType: "PRESSURE_WALL_THICKNESS",
          pressure: 8.5,
          outsideDiameterMm: 610,
          corrosionAllowanceMm: 0,
          weldJointFactor: 1.0,
          allowableStressMpa: 138,
          unitSystem: "SI",
        }
      );

      assert(
        crossExec.calculationExecuted === false,
        `Substitution vers ${foreignCode} strictement bloquée`
      );
      assert(
        crossExec.calculationResult.status === "OUT_OF_SCOPE",
        `Statut OUT_OF_SCOPE attendu lors d'une tentative de substitution par ${foreignCode}`
      );
      assert(
        crossExec.calculationResult.errors.some((e) =>
          e.includes("CROSS_CODE_SUBSTITUTION_FORBIDDEN")
        ),
        `Erreur CROSS_CODE_SUBSTITUTION_FORBIDDEN attendue pour ${foreignCode}`
      );
    }

    // Cas 2 : Conflit entre le système (ASME-B31.8) et un explicitDesignCodeId étranger (ASME-B31.12)
    const conflictReadiness = evaluateB31_8PipelineReadiness({
      system: gasSystem,
      explicitDesignCodeId: "ASME-B31.12",
    });
    assert(
      conflictReadiness.status === "BLOCKED_CODE_RESOLUTION",
      "Un conflit ou une substitution explicite vers ASME-B31.12 bloque la résolution B31.8"
    );
    assert(
      conflictReadiness.stage2CodeIdentification.crossCodeSubstitutionAttempted === true,
      "crossCodeSubstitutionAttempted doit être signalé à true"
    );
    assert(
      conflictReadiness.diagnosticCodes.includes("CROSS_CODE_SUBSTITUTION_FORBIDDEN"),
      "Diagnostic CROSS_CODE_SUBSTITUTION_FORBIDDEN présent"
    );

    // Cas 3 : Vérifier que B31.3 est rejeté dans le domaine PIPELINE par le Multi-Code Resolver
    const b313InPipeline = resolveApplicableDesignCode({
      engineeringDomain: "PIPELINE",
      explicitDesignCodeId: "ASME-B31.3",
    });
    assert(
      b313InPipeline.status === "UNSUPPORTED_CODE",
      "ASME-B31.3 reste incompatible avec le domaine PIPELINE"
    );
  });

  // =========================================================================
  // TEST 05 : INTERDICTION D'INFÉRER LE CODE DEPUIS UN CLIENT, TITRE PROJET, MATÉRIAU OU LICENCE
  // =========================================================================
  runTest("TEST 05 [ARCH-11]: Rejet de toute inférence de code depuis un nom client, un titre de projet, un libellé matériau ou une licence commerciale", () => {
    const sysWithoutCodeRef = createPipelineSystem({
      id: "SYS-NO-CODE-REF",
      name: "ASME B31.8 High Pressure Gas Transmission Pipeline Project", // Titre mentionnant B31.8
      service: {
        fluidCategory: "NATURAL_GAS",
        phase: "GAS",
      },
      nodes: [
        createPipelineNode({ id: "N1", systemId: "SYS-NO-CODE-REF", name: "N1" }),
        createPipelineNode({ id: "N2", systemId: "SYS-NO-CODE-REF", name: "N2" }),
      ],
      segments: [
        createPipelineSegment({
          id: "S1",
          systemId: "SYS-NO-CODE-REF",
          name: "ASME B31.8 Segment",
          startNodeId: "N1",
          endNodeId: "N2",
          material: {
            standardCode: "API-5L",
            grade: "X65",
            designation: "API 5L X65 for ASME B31.8 Service",
          },
        }),
      ],
    });

    // Sans référence structurée (explicitDesignCodeId, pipingSpecId, traceabilityRefs.designCodeRef),
    // le nom du système et la désignation du matériau ne permettent JAMAIS d'inférer ASME-B31.8 :
    // le domaine PIPELINE seul ayant 4 codes candidats, le resolver retourne AMBIGUOUS.
    const noInferenceRes = evaluateB31_8PipelineReadiness({
      system: sysWithoutCodeRef,
      segmentId: "S1",
    });
    assert(
      noInferenceRes.stage2CodeIdentification.resolutionStatus === "AMBIGUOUS",
      "Sans référence structurée, le titre du système ou le libellé matériau ne résout jamais ASME-B31.8"
    );
    assert(
      noInferenceRes.stage2CodeIdentification.isB31_8Resolved === false,
      "isB31_8Resolved doit être false"
    );
    assert(
      noInferenceRes.status === "BLOCKED_CODE_RESOLUTION",
      "Le statut doit être BLOCKED_CODE_RESOLUTION"
    );

    // Rejet explicite des champs d'inférence interdits (clientName, projectTitle, materialLabel, commercialLicense)
    const forbiddenPayloads = [
      { system: sysWithoutCodeRef, clientName: "MajorGasOperator" },
      { system: sysWithoutCodeRef, projectTitle: "B31.8 Gas Pipeline" },
      { system: sysWithoutCodeRef, materialLabel: "API 5L X65 B31.8" },
      { system: sysWithoutCodeRef, commercialLicense: "ENTERPRISE_B31_8_MODULE" },
      { system: sysWithoutCodeRef, explicitDesignCodeId: "SONELGAZ-B318" },
    ];

    for (const payload of forbiddenPayloads) {
      const validation = validateB31_8PipelineReadinessRequest(payload);
      assert(
        validation.valid === false,
        `La requête contenant un champ d'inférence interdit doit être rejetée: ${JSON.stringify(Object.keys(payload))}`
      );
      const res = evaluateB31_8PipelineReadiness(
        payload as unknown as Parameters<typeof evaluateB31_8PipelineReadiness>[0]
      );
      assert(
        res.status === "INVALID_READINESS_REQUEST",
        "evaluateB31_8PipelineReadiness doit retourner INVALID_READINESS_REQUEST"
      );
    }
  });

  // =========================================================================
  // TEST 06 : COHÉRENCE DU SERVICE FLUIDE (GAZ NATUREL VS HYDROGÈNE VS LIQUIDE)
  // =========================================================================
  runTest("TEST 06 [ARCH-11]: Vérification du service fluide sur le pipeline (rejet des fluides liquides et maintien de la séparation H2 / B31.12)", () => {
    const n1 = createPipelineNode({ id: "N1", systemId: "SYS-LIQ", name: "N1" });
    const n2 = createPipelineNode({ id: "N2", systemId: "SYS-LIQ", name: "N2" });

    // 1. Pipeline d'hydrocarbures liquides avec référence B31.8 -> bloqué au niveau du domaine/modèle
    const liquidSystem = createPipelineSystem({
      id: "SYS-LIQ",
      name: "Crude Oil Pipeline",
      service: { fluidCategory: "LIQUID_HYDROCARBON", phase: "LIQUID" },
      nodes: [n1, n2],
      segments: [
        createPipelineSegment({
          id: "S-LIQ",
          systemId: "SYS-LIQ",
          name: "Liquid Segment",
          startNodeId: "N1",
          endNodeId: "N2",
        }),
      ],
      traceabilityRefs: { designCodeRef: "ASME-B31.8" },
    });

    const liqReadiness = evaluateB31_8PipelineReadiness({ system: liquidSystem });
    assert(
      liqReadiness.stage1DomainIdentification.gasServiceStatus === "NON_GAS_FLUID_MISMATCH",
      "LIQUID_HYDROCARBON doit être détecté comme NON_GAS_FLUID_MISMATCH pour B31.8"
    );
    assert(
      liqReadiness.status === "BLOCKED_DOMAIN_OR_MODEL_INVALID",
      "Un pipeline liquide doit être bloqué en BLOCKED_DOMAIN_OR_MODEL_INVALID pour B31.8"
    );

    // 2. Pipeline avec mélange GN/H2 -> signalé explicitement sans qualification automatique ni bascule B31.12
    const blendSystem = createPipelineSystem({
      id: "SYS-BLEND",
      name: "NG-H2 Blend Pipeline",
      service: {
        fluidCategory: "NATURAL_GAS_HYDROGEN_BLEND",
        phase: "GAS",
        hydrogenMoleFractionPercent: 15,
      },
      nodes: [
        createPipelineNode({ id: "N1", systemId: "SYS-BLEND", name: "N1" }),
        createPipelineNode({ id: "N2", systemId: "SYS-BLEND", name: "N2" }),
      ],
      segments: [
        createPipelineSegment({
          id: "S-BLEND",
          systemId: "SYS-BLEND",
          name: "Blend Segment",
          startNodeId: "N1",
          endNodeId: "N2",
        }),
      ],
      traceabilityRefs: { designCodeRef: "ASME-B31.8" },
    });

    const blendStatus = evaluateB31_8GasServiceStatus(blendSystem);
    assert(
      blendStatus === "HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION",
      "Un mélange GN/H2 doit retourner HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION"
    );
    const blendReadiness = evaluateB31_8PipelineReadiness({ system: blendSystem });
    assert(
      blendReadiness.diagnosticCodes.includes(
        "B31_8_HYDROGEN_SERVICE_REQUIRES_DEDICATED_QUALIFICATION"
      ),
      "Diagnostic B31_8_HYDROGEN_SERVICE_REQUIRES_DEDICATED_QUALIFICATION attendu"
    );
    assert(
      blendReadiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === false,
      "Aucun calcul n'est exécutable"
    );
  });

  // =========================================================================
  // TEST 07 : PRÉSERVATION INTACTE DU COMPORTEMENT QUALIFIÉ ASME B31.3 ET DE B31.12 NOT_IMPLEMENTED
  // =========================================================================
  runTest("TEST 07 [ARCH-11]: Le calcul qualifié ASME B31.3 (F01) et le blocage ASME B31.12 restent strictement inchangés", () => {
    // 1. Vérification que ASME-B31.3 F01 fonctionne exactement comme en NORM-08
    const b313Evidence = [
      {
        evidenceId: "EV-S-B313",
        standardId: "ASME-B31.3",
        editionId: "2024",
        clauseReference: "Table A-1",
        sourceType: "LICENSED_STANDARD" as const,
        sourceReference: "ASME B31.3-2024 Table A-1",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "NORMATIVE_AUDIT",
        verifiedAt: "2026-10-10T00:00:00Z",
      },
      {
        evidenceId: "EV-E-B313",
        standardId: "ASME-B31.3",
        editionId: "2024",
        clauseReference: "Table A-1B",
        sourceType: "LICENSED_STANDARD" as const,
        sourceReference: "ASME B31.3-2024 Table A-1B",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "NORMATIVE_AUDIT",
        verifiedAt: "2026-10-10T00:00:00Z",
      },
      {
        evidenceId: "EV-W-B313",
        standardId: "ASME-B31.3",
        editionId: "2024",
        clauseReference: "Table 302.3.5-1",
        sourceType: "LICENSED_STANDARD" as const,
        sourceReference: "ASME B31.3-2024 Table 302.3.5-1",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "NORMATIVE_AUDIT",
        verifiedAt: "2026-10-10T00:00:00Z",
      },
      {
        evidenceId: "EV-Y-B313",
        standardId: "ASME-B31.3",
        editionId: "2024",
        clauseReference: "Table 304.1.1-1",
        sourceType: "LICENSED_STANDARD" as const,
        sourceReference: "ASME B31.3-2024 Table 304.1.1-1",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "NORMATIVE_AUDIT",
        verifiedAt: "2026-10-10T00:00:00Z",
      },
    ];

    const b313CalcResult = executeEngineeringCalculation({
      designCodeId: "ASME-B31.3",
      calculationType: "PRESSURE_WALL_THICKNESS",
      standardEdition: { year: "2024" },
      pressure: 10,
      temperature: 100,
      outsideDiameterMm: 219.1,
      corrosionAllowanceMm: 1.5,
      componentType: "SEAMLESS",
      materialFamily: "FERRITIC",
      materialId: "MAT-A106-B",
      unitSystem: "SI",
      evidenceItems: b313Evidence,
      allowableStressInput: {
        value: 138,
        unit: "MPa",
        materialReference: "MAT-A106-B",
        temperature: 100,
        sourceReference: "ASME B31.3-2024 Table A-1",
        qualificationStatus: "VERIFIED",
        verifiedValue: {
          value: 138,
          verificationStatus: "VERIFIED",
          evidenceIds: ["EV-S-B313"],
          sourceReference: "ASME B31.3-2024 Table A-1",
        },
      },
      qualityFactorInput: {
        factorValue: 1.0,
        productSpecification: "ASTM A106",
        jointType: "SEAMLESS",
        sourceReference: "ASME B31.3-2024 Table A-1B",
        qualificationStatus: "VERIFIED",
        verifiedValue: {
          value: 1.0,
          verificationStatus: "VERIFIED",
          evidenceIds: ["EV-E-B313"],
          sourceReference: "ASME B31.3-2024 Table A-1B",
        },
      },
      weldReductionFactorInput: {
        branchId: "W-01",
        factorValue: 1.0,
        componentType: "SEAMLESS",
        materialFamily: "FERRITIC",
        temperature: 100,
        designTemperature: 100,
        sourceReference: "ASME B31.3-2024 para. 302.3.5(e)",
        qualificationStatus: "VERIFIED",
        verifiedValue: {
          value: 1.0,
          verificationStatus: "VERIFIED",
          evidenceIds: ["EV-W-B313"],
          sourceReference: "ASME B31.3-2024 Table 302.3.5-1",
        },
      },
      yCoefficientInput: {
        factorValue: 0.4,
        materialFamily: "FERRITIC",
        temperature: 100,
        sourceReference: "ASME B31.3-2024 Table 304.1.1-1",
        qualificationStatus: "VERIFIED",
        verifiedValue: {
          value: 0.4,
          verificationStatus: "VERIFIED",
          evidenceIds: ["EV-Y-B313"],
          sourceReference: "ASME B31.3-2024 Table 304.1.1-1",
        },
      },
    });

    assert(
      b313CalcResult.status === "CALCULATED",
      `Le calcul qualifié ASME B31.3 F01 doit rester CALCULATED (reçu: ${b313CalcResult.status})`
    );
    assert(
      typeof b313CalcResult.minimumRequiredThicknessMm === "number" &&
        Number.isFinite(b313CalcResult.minimumRequiredThicknessMm),
      "minimumRequiredThicknessMm de B31.3 F01 est calculé"
    );

    // 2. Vérification que ASME-B31.12 reste strictement NOT_IMPLEMENTED
    const b3112Entry = getDesignCodeCalculationEntry("ASME-B31.12");
    assert(
      b3112Entry !== undefined &&
        b3112Entry.status === "NOT_IMPLEMENTED" &&
        b3112Entry.supportedCalculationTypes.length === 0,
      "ASME-B31.12 doit rester NOT_IMPLEMENTED"
    );

    const b3112Calc = executeEngineeringCalculation({
      designCodeId: "ASME-B31.12",
      calculationType: "PRESSURE_WALL_THICKNESS",
      pressure: 10,
      outsideDiameterMm: 219.1,
      corrosionAllowanceMm: 0,
      weldJointFactor: 1.0,
      allowableStressMpa: 138,
      unitSystem: "SI",
    });
    assert(
      b3112Calc.status === "NOT_IMPLEMENTED",
      "Tout calcul ASME-B31.12 doit retourner NOT_IMPLEMENTED"
    );
  });

  // =========================================================================
  // TEST 08 : NON-MUTATION, IMMUTABILITÉ ET NON-RÉGRESSION ARCH-08 / ARCH-09 / ARCH-10
  // =========================================================================
  runTest("TEST 08 [ARCH-11]: Immuabilité des résultats ARCH-11, non-mutation du PipelineSystem et non-régression ARCH-08 / ARCH-09 / ARCH-10", () => {
    const gasSystem = createSampleGasPipelineSystem();
    const snapshotBefore = JSON.stringify(gasSystem);

    const context = buildPipelineMultiCodeResolutionContext({
      system: gasSystem,
      segmentId: "SEG-GAS-01",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "SI",
    });
    const readiness = evaluateB31_8PipelineReadiness({
      system: gasSystem,
      segmentId: "SEG-GAS-01",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "SI",
    });

    const snapshotAfter = JSON.stringify(gasSystem);
    assert(snapshotBefore === snapshotAfter, "gasSystem ne doit subir aucune mutation");
    assert(Object.isFrozen(context), "MultiCodeResolutionContext construit doit être gelé");
    assert(Object.isFrozen(readiness), "B31_8PipelineReadinessResult doit être gelé");
    assert(Object.isFrozen(readiness.stage1DomainIdentification), "stage1 gelé");
    assert(Object.isFrozen(readiness.stage2CodeIdentification), "stage2 gelé");
    assert(Object.isFrozen(readiness.stage3NormativeEvidence), "stage3 gelé");
    assert(Object.isFrozen(readiness.stage4CalculationQualification), "stage4 gelé");
    assert(Object.isFrozen(readiness.stage5CalculationAvailability), "stage5 gelé");
    assert(Object.isFrozen(readiness.stage6NumericalExecutionGate), "stage6 gelé");
    assert(Object.isFrozen(DESIGN_CODE_CALCULATION_REGISTRY), "DESIGN_CODE_CALCULATION_REGISTRY gelé");

    const arch08 = runArch08MultiDomainArchitectureTests();
    assert(arch08.success === true, `ARCH-08 doit rester PASS: ${arch08.failures.join("; ")}`);

    const arch09 = runArch09MultiCodeResolverTests();
    assert(arch09.success === true, `ARCH-09 doit rester PASS: ${arch09.failures.join("; ")}`);

    const arch10 = runArch10PipelineEngineeringModelTests();
    assert(arch10.success === true, `ARCH-10 doit rester PASS: ${arch10.failures.join("; ")}`);
  });

  // =========================================================================
  // TEST 09 [ARCH-11-FIX-01] : GARDE D'EXÉCUTION STRICTE SUR BLOCKED_CALCULATION_NOT_IMPLEMENTED
  // =========================================================================
  runTest("TEST 09 [ARCH-11-FIX-01]: executeGuardedB31_8PipelineCalculation bloque directement BLOCKED_CALCULATION_NOT_IMPLEMENTED sans déléguer à executeEngineeringCalculation", () => {
    const gasSystem = createSampleGasPipelineSystem();
    let engineDelegationCount = 0;

    const guardedRes = executeGuardedB31_8PipelineCalculation(
      {
        system: gasSystem,
        segmentId: "SEG-GAS-01",
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
        unitSystem: "SI",
      },
      {
        designCodeId: "ASME-B31.8",
        calculationType: "PRESSURE_WALL_THICKNESS",
        pressure: 8.5,
        temperature: 60,
        outsideDiameterMm: 610,
        wallThicknessMm: 12.7,
        corrosionAllowanceMm: 0,
        weldJointFactor: 1.0,
        allowableStressMpa: 300,
        designFactor: 0.72,
        unitSystem: "SI",
      },
      {
        calculationEngineExecutor: (...args) => {
          engineDelegationCount++;
          return executeEngineeringCalculation(...args);
        },
      }
    );

    assert(
      engineDelegationCount === 0,
      `executeEngineeringCalculation ne doit JAMAIS être appelé lorsque readiness.status === BLOCKED_CALCULATION_NOT_IMPLEMENTED (appels: ${engineDelegationCount})`
    );
    assert(
      guardedRes.readiness.status === "BLOCKED_CALCULATION_NOT_IMPLEMENTED",
      `Le statut de préparation doit être BLOCKED_CALCULATION_NOT_IMPLEMENTED (reçu: ${guardedRes.readiness.status})`
    );
    assert(
      guardedRes.readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === false,
      "canExecuteNumericalCalculation doit être false"
    );
    assert(
      guardedRes.calculationExecuted === false,
      "calculationExecuted doit être false"
    );
    assert(
      guardedRes.calculationResult.status === "NOT_IMPLEMENTED",
      `Le statut du résultat bloqué doit être NOT_IMPLEMENTED (reçu: ${guardedRes.calculationResult.status})`
    );
    assert(
      guardedRes.calculationResult.errors.some((e) =>
        e.includes("BLOCKED_CALCULATION_NOT_IMPLEMENTED (CODE_CALCULATION_NOT_IMPLEMENTED)")
      ),
      "Le résultat bloqué doit porter le diagnostic direct BLOCKED_CALCULATION_NOT_IMPLEMENTED de la garde ARCH-11"
    );
    assert(
      Object.isFrozen(guardedRes) &&
        Object.isFrozen(guardedRes.calculationResult) &&
        Object.isFrozen(guardedRes.calculationResult.errors),
      "Le résultat de la garde doit être profondément gelé"
    );
  });

  // =========================================================================
  // TEST 10 [ARCH-11-FIX-01] : GARDE D'EXÉCUTION STRICTE SUR BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE ET TOUT ÉTAT NON-READY
  // =========================================================================
  runTest("TEST 10 [ARCH-11-FIX-01]: executeGuardedB31_8PipelineCalculation bloque directement BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE et tous les états non-READY sans jamais déléguer à executeEngineeringCalculation", () => {
    const gasSystem = createSampleGasPipelineSystem();
    let engineDelegationCount = 0;
    const spyExecutor: typeof executeEngineeringCalculation = (...args) => {
      engineDelegationCount++;
      return executeEngineeringCalculation(...args);
    };

    // Cas A : Système gaz avec preuves d'édition explicitement absentes/UNVERIFIED
    const guardedUnverified = executeGuardedB31_8PipelineCalculation(
      {
        system: gasSystem,
        segmentId: "SEG-GAS-01",
        requestedEdition: { year: "2022" },
        evidenceIds: ["EVID-NON-EXISTENT-UNVERIFIED"],
      },
      {
        designCodeId: "ASME-B31.8",
        calculationType: "HOOP_STRESS",
        pressure: 8.5,
        outsideDiameterMm: 610,
        wallThicknessMm: 12.7,
        unitSystem: "SI",
      },
      { calculationEngineExecutor: spyExecutor }
    );

    assert(
      engineDelegationCount === 0,
      "Aucune délégation à executeEngineeringCalculation ne doit avoir lieu (Cas A)"
    );
    assert(
      guardedUnverified.readiness.stage3NormativeEvidence.isEditionEvidenceVerified === false &&
        guardedUnverified.readiness.stage3NormativeEvidence.isAuthoritativeSourceVerified === false,
      "Les preuves d'édition et le document source sont UNVERIFIED"
    );
    assert(
      guardedUnverified.readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === false,
      "canExecuteNumericalCalculation doit être false lorsque les preuves sont UNVERIFIED"
    );
    assert(
      guardedUnverified.calculationExecuted === false,
      "calculationExecuted doit être false"
    );
    assert(
      guardedUnverified.calculationResult.value === undefined,
      "Aucune valeur numérique ne doit être calculée"
    );

    // Cas B : Fluide H2/Blend (gasServiceStatus !== GAS_SERVICE_DECLARED) -> bloqué sans délégation
    const blendSystem = createPipelineSystem({
      id: "SYS-BLEND-GUARD",
      name: "NG-H2 Blend Pipeline",
      service: {
        fluidCategory: "NATURAL_GAS_HYDROGEN_BLEND",
        phase: "GAS",
        hydrogenMoleFractionPercent: 10,
      },
      nodes: [
        createPipelineNode({ id: "N1", systemId: "SYS-BLEND-GUARD", name: "N1" }),
        createPipelineNode({ id: "N2", systemId: "SYS-BLEND-GUARD", name: "N2" }),
      ],
      segments: [
        createPipelineSegment({
          id: "S-BLEND-GUARD",
          systemId: "SYS-BLEND-GUARD",
          name: "Blend Segment",
          startNodeId: "N1",
          endNodeId: "N2",
        }),
      ],
      traceabilityRefs: { designCodeRef: "ASME-B31.8" },
    });

    const guardedBlend = executeGuardedB31_8PipelineCalculation(
      {
        system: blendSystem,
        segmentId: "S-BLEND-GUARD",
      },
      {
        designCodeId: "ASME-B31.8",
        calculationType: "PRESSURE_WALL_THICKNESS",
        pressure: 8.5,
        outsideDiameterMm: 610,
        unitSystem: "SI",
      },
      { calculationEngineExecutor: spyExecutor }
    );

    assert(
      engineDelegationCount === 0,
      "Aucune délégation à executeEngineeringCalculation ne doit avoir lieu (Cas B)"
    );
    assert(
      guardedBlend.readiness.status === "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE",
      "Le statut de préparation doit être BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE pour un mélange H2 non qualifié"
    );
    assert(
      guardedBlend.readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === false,
      "canExecuteNumericalCalculation doit être false pour un mélange H2 non qualifié"
    );
    assert(
      guardedBlend.calculationExecuted === false,
      "calculationExecuted doit être false"
    );
    assert(
      guardedBlend.calculationResult.status === "INVALID_INPUT",
      "Le statut retourné par la garde sur BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE doit être INVALID_INPUT sans exécution numérique"
    );

    // Cas C : Requête invalide, modèle invalide et résolution de code bloquée -> 0 délégation
    const guardedInvalidModel = executeGuardedB31_8PipelineCalculation(
      {
        system: gasSystem,
        segmentId: "SEG-UNKNOWN-999",
      },
      {
        designCodeId: "ASME-B31.8",
        calculationType: "PRESSURE_WALL_THICKNESS",
        pressure: 8.5,
        outsideDiameterMm: 610,
        unitSystem: "SI",
      },
      { calculationEngineExecutor: spyExecutor }
    );
    assert(
      engineDelegationCount === 0 &&
        guardedInvalidModel.readiness.status === "BLOCKED_DOMAIN_OR_MODEL_INVALID" &&
        guardedInvalidModel.calculationExecuted === false &&
        guardedInvalidModel.calculationResult.status === "INVALID_INPUT",
      "Un segment introuvable doit bloquer en BLOCKED_DOMAIN_OR_MODEL_INVALID / INVALID_INPUT sans délégation"
    );

    // Cas D : Pipeline avec service non déclaré ou mélange H2/GN sous référence ASME-B31.8 ->
    // readiness.status === "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE" et 0 délégation à executeEngineeringCalculation !
    const undeclaredServiceSystem = createPipelineSystem({
      id: "SYS-GAS-UNDECLARED",
      name: "Pipeline Without Declared Fluid Service",
      nodes: [
        createPipelineNode({ id: "N1", systemId: "SYS-GAS-UNDECLARED", name: "N1" }),
        createPipelineNode({ id: "N2", systemId: "SYS-GAS-UNDECLARED", name: "N2" }),
      ],
      segments: [
        createPipelineSegment({
          id: "SEG-UNDECLARED-01",
          systemId: "SYS-GAS-UNDECLARED",
          name: "Segment 01",
          startNodeId: "N1",
          endNodeId: "N2",
          traceabilityRefs: { designCodeRef: "ASME-B31.8" },
        }),
      ],
      traceabilityRefs: { designCodeRef: "ASME-B31.8" },
    });

    const guardedExplicitUnverifiedStatus = executeGuardedB31_8PipelineCalculation(
      {
        system: undeclaredServiceSystem,
        segmentId: "SEG-UNDECLARED-01",
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
        unitSystem: "SI",
      },
      {
        designCodeId: "ASME-B31.8",
        calculationType: "PRESSURE_WALL_THICKNESS",
        pressure: 8.5,
        outsideDiameterMm: 610,
        wallThicknessMm: 12.7,
        unitSystem: "SI",
      },
      {
        calculationEngineExecutor: spyExecutor,
      }
    );

    assert(
      guardedExplicitUnverifiedStatus.readiness.status ===
        "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE",
      `Le statut de préparation doit être exactement BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE (reçu: ${guardedExplicitUnverifiedStatus.readiness.status})`
    );
    assert(
      guardedExplicitUnverifiedStatus.readiness.stage6NumericalExecutionGate
        .canExecuteNumericalCalculation === false,
      "canExecuteNumericalCalculation doit être false sur BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE"
    );
    assert(
      engineDelegationCount === 0,
      `executeEngineeringCalculation ne doit JAMAIS être appelé sur BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE (appels: ${engineDelegationCount})`
    );
    assert(
      guardedExplicitUnverifiedStatus.calculationExecuted === false,
      "calculationExecuted doit être false sur BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE"
    );
    assert(
      guardedExplicitUnverifiedStatus.calculationResult.status === "INVALID_INPUT",
      `Le résultat bloqué sur BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE doit avoir le statut INVALID_INPUT (reçu: ${guardedExplicitUnverifiedStatus.calculationResult.status})`
    );
    assert(
      guardedExplicitUnverifiedStatus.calculationResult.errors.some((e) =>
        e.includes("BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE (EDITION_OR_SOURCE_EVIDENCE_UNVERIFIED)")
      ),
      "Le résultat bloqué doit contenir l'erreur explicite BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE"
    );
  });

  return Object.freeze({
    success: testsFailed === 0,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
