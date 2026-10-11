/**
 * PDI NORMATIVE ENGINE — MULTI-CODE RESOLVER — ARCH-09 TEST SUITE
 * Reference: ARCH-09 (Multi-Code Resolver)
 *
 * Suite complète de validation architecturale et normative pour ARCH-09 :
 * 1. Résolution nominale explicite par domaine (PIPING, PIPELINE, PACKAGE, EQUIPMENT).
 * 2. Résolution via spécification de tuyauterie (PipingSpecification) et référence projet.
 * 3. Séparation stricte des 5 niveaux :
 *    (1) Identification du code applicable
 *    (2) Vérification de l'édition et de ses preuves
 *    (3) Qualification normative
 *    (4) Disponibilité réelle des calculs
 *    (5) Exécution d'un calcul (aucune exécution numérique dans le resolver)
 * 4. Préservation exacte des statuts du registre existant :
 *    - ASME-B31.3 : PARTIAL (PRESSURE_WALL_THICKNESS disponible en édition 2024 SI)
 *    - ASME-B31.4, ASME-B31.8, ASME-B31.12, EN-13480, ISO-13623 : NOT_IMPLEMENTED
 * 5. Refus de sélection silencieuse en cas d'ambiguïté (AMBIGUOUS).
 * 6. Refus de contexte insuffisant (INSUFFICIENT_DATA).
 * 7. Rejet des codes inconnus, des standards non DESIGN_CODE (ASME-B16.5, ASME-B36.10M, API-5L)
 *    et des codes incompatibles avec le domaine (UNSUPPORTED_CODE).
 * 8. Anti-heuristique stricte : rejet des noms de clients, chaînes libres et tokens heuristiques.
 * 9. Une absence de preuve ne devient jamais une validation normative (édition UNVERIFIED sans preuve VERIFIED).
 * 10. Non-régression complète : ARCH-08, ARCH-07 et NORM-01..14.
 */

import {
  MultiCodeResolver,
  defaultMultiCodeResolver,
  resolveApplicableDesignCode,
} from "../engine/multiCodeResolver";
import { validateMultiCodeResolutionContext } from "../validators/multiCodeResolverValidator";
import {
  DESIGN_CODE_CALCULATION_REGISTRY,
  getDesignCodeCalculationEntry,
} from "../registry/designCodeRegistry";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import { runArch08MultiDomainArchitectureTests } from "./arch08MultiDomainArchitectureTests";
import { runArch07IndustrialArchitectureTests } from "./arch07IndustrialArchitectureTests";
import { runNormativeGlobalIntegrationTests } from "./normativeGlobalIntegrationTests";
import { runDesignCodeEngineTests } from "./designCodeTests";

export interface Arch09TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-09 ASSERTION FAILED] ${message}`);
  }
}

export function runArch09MultiCodeResolverTests(): Arch09TestResult {
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
  // TEST 01 : PRÉSERVATION STRICTE DES STATUTS DU REGISTRE EXISTANT (§5)
  // =========================================================================
  runTest("TEST 01 [ARCH-09]: Préservation stricte des statuts réels dans DESIGN_CODE_CALCULATION_REGISTRY", () => {
    const b313 = getDesignCodeCalculationEntry("ASME-B31.3");
    assert(b313 !== undefined, "ASME-B31.3 doit exister dans le registre");
    assert(b313!.status === "PARTIAL", "ASME-B31.3 doit conserver le statut PARTIAL");
    assert(
      b313!.supportedCalculationTypes.length === 1 &&
        b313!.supportedCalculationTypes[0] === "PRESSURE_WALL_THICKNESS",
      "ASME-B31.3 supporte uniquement PRESSURE_WALL_THICKNESS"
    );

    const notImplementedCodes = [
      "ASME-B31.4",
      "ASME-B31.8",
      "ASME-B31.12",
      "EN-13480",
      "ISO-13623",
    ];

    for (const codeId of notImplementedCodes) {
      const entry = getDesignCodeCalculationEntry(codeId);
      assert(entry !== undefined, `${codeId} doit exister dans DESIGN_CODE_CALCULATION_REGISTRY`);
      assert(
        entry!.status === "NOT_IMPLEMENTED",
        `${codeId} doit conserver strictement le statut NOT_IMPLEMENTED (actuel: ${entry!.status})`
      );
      assert(
        entry!.supportedCalculationTypes.length === 0,
        `${codeId} ne doit déclarer aucun type de calcul implémenté`
      );
    }

    assert(Object.isFrozen(DESIGN_CODE_CALCULATION_REGISTRY), "Le registre doit rester immuable");
  });

  // =========================================================================
  // TEST 02 : RÉSOLUTION EXPLICITE ASME-B31.3 + CAPACITÉ DISPONIBLE (PIPING)
  // =========================================================================
  runTest("TEST 02 [ARCH-09]: Résolution nominale de ASME-B31.3 dans le domaine PIPING avec PRESSURE_WALL_THICKNESS", () => {
    const res = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.3",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      requestedEdition: { year: "2024" },
      unitSystem: "SI",
    });

    assert(res.status === "RESOLVED", `Attendu RESOLVED, obtenu ${res.status}`);
    assert(res.resolvedDesignCodeId === "ASME-B31.3", "Code résolu doit être ASME-B31.3");
    assert(res.resolutionSource === "EXPLICIT_DESIGN_CODE", "Source doit être EXPLICIT_DESIGN_CODE");
    assert(res.implementationStatus === "PARTIAL", "Statut d'implémentation doit être PARTIAL");
    assert(res.isUsableForCalculation === true, "ASME-B31.3 (2024, SI) doit être utilisable pour PRESSURE_WALL_THICKNESS");
    assert(
      res.calculationAvailability.availabilityStatus === "AVAILABLE",
      "availabilityStatus doit être AVAILABLE"
    );
    assert(
      res.calculationAvailability.matchedFormulaReference?.id ===
        "NORM-08-F01-ASME-B31.3-2024-PRESSURE-WALL-THICKNESS",
      "La référence de formule F01 doit être exposée"
    );
    assert(
      res.calculationAvailability.qualificationStatus === "PARTIALLY_QUALIFIED",
      "Le code ayant le statut PARTIAL, sa qualification globale est PARTIALLY_QUALIFIED"
    );
    // Vérification qu'aucun calcul numérique n'a été exécuté par le resolver
    assert(
      !("value" in res) && !("minimumRequiredThicknessMm" in res),
      "Le resolver ne doit exécuter aucun calcul numérique d'épaisseur"
    );
    assert(Object.isFrozen(res), "Le résultat de résolution doit être gelé (Object.isFrozen)");
  });

  // =========================================================================
  // TEST 03 : DISTINCTION CODE RÉSOLU VS CAPACITÉ NON IMPLÉMENTÉE SUR ASME-B31.3
  // =========================================================================
  runTest("TEST 03 [ARCH-09]: ASME-B31.3 résolu mais non utilisable pour un calcul non implémenté (HOOP_STRESS / ALLOWABLE_PRESSURE)", () => {
    const res = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.3",
      requestedCalculationType: "HOOP_STRESS",
      unitSystem: "SI",
    });

    assert(res.status === "RESOLVED", "Le code ASME-B31.3 est bien identifié (RESOLVED)");
    assert(res.resolvedDesignCodeId === "ASME-B31.3", "Code identifié = ASME-B31.3");
    assert(res.implementationStatus === "PARTIAL", "Statut du code = PARTIAL");
    assert(
      res.isUsableForCalculation === false,
      "ASME-B31.3 ne doit PAS être utilisable pour HOOP_STRESS"
    );
    assert(
      res.calculationAvailability.availabilityStatus === "NOT_IMPLEMENTED",
      "La capacité HOOP_STRESS doit avoir le statut NOT_IMPLEMENTED"
    );
  });

  // =========================================================================
  // TEST 04 : DISTINCTION CODE RÉSOLU VS CODE NOT_IMPLEMENTED (PIPELINE : B31.4, B31.8, B31.12, ISO-13623)
  // =========================================================================
  runTest("TEST 04 [ARCH-09]: Résolution dans PIPELINE distingue identification du code (RESOLVED) et statut NOT_IMPLEMENTED", () => {
    const pipelineCodes = ["ASME-B31.4", "ASME-B31.8", "ASME-B31.12", "ISO-13623"] as const;

    for (const codeId of pipelineCodes) {
      const res = resolveApplicableDesignCode({
        engineeringDomain: "PIPELINE",
        explicitDesignCodeId: codeId,
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
        unitSystem: "SI",
      });

      assert(res.status === "RESOLVED", `${codeId} doit être identifié comme RESOLVED dans PIPELINE`);
      assert(res.resolvedDesignCodeId === codeId, `resolvedDesignCodeId doit être ${codeId}`);
      assert(
        res.implementationStatus === "NOT_IMPLEMENTED",
        `Le statut d'implémentation de ${codeId} doit être NOT_IMPLEMENTED`
      );
      assert(
        res.isUsableForCalculation === false,
        `${codeId} ne doit jamais être déclaré utilisable pour un calcul (isUsableForCalculation === false)`
      );
      assert(
        res.calculationAvailability.availabilityStatus === "NOT_IMPLEMENTED",
        `availabilityStatus de ${codeId} doit être NOT_IMPLEMENTED`
      );
      assert(
        res.calculationAvailability.qualificationStatus === "NOT_QUALIFIED",
        `qualificationStatus de ${codeId} sans formule vérifiée doit être NOT_QUALIFIED`
      );
    }
  });

  // =========================================================================
  // TEST 05 : DISTINCTION CODE RÉSOLU VS NOT_IMPLEMENTED POUR EN-13480 (PIPING / PACKAGE / EQUIPMENT)
  // =========================================================================
  runTest("TEST 05 [ARCH-09]: Résolution de EN-13480 dans PIPING, PACKAGE et EQUIPMENT conserve NOT_IMPLEMENTED", () => {
    const domains = ["PIPING", "PACKAGE", "EQUIPMENT"] as const;

    for (const dom of domains) {
      const res = resolveApplicableDesignCode({
        engineeringDomain: dom,
        explicitDesignCodeId: "EN-13480",
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      });

      assert(res.status === "RESOLVED", `EN-13480 doit être RESOLVED pour le domaine ${dom}`);
      assert(res.resolvedDesignCodeId === "EN-13480", "Code résolu = EN-13480");
      assert(res.implementationStatus === "NOT_IMPLEMENTED", "EN-13480 est NOT_IMPLEMENTED");
      assert(res.isUsableForCalculation === false, "EN-13480 n'est pas utilisable pour le calcul");
    }
  });

  // =========================================================================
  // TEST 06 : REFUS D'ARBITRAGE SILENCIEUX LORSQUE SEUL LE DOMAINE EST FOURNI (AMBIGUOUS)
  // =========================================================================
  runTest("TEST 06 [ARCH-09]: Refus de sélection silencieuse lorsqu'un domaine multi-code est fourni sans sélection explicite", () => {
    const domains = ["PIPING", "PIPELINE", "PACKAGE", "EQUIPMENT"] as const;

    for (const dom of domains) {
      const res = resolveApplicableDesignCode({
        engineeringDomain: dom,
        requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      });

      assert(
        res.status === "AMBIGUOUS",
        `Le domaine ${dom} seul possède plusieurs codes de référence et doit retourner AMBIGUOUS (obtenu: ${res.status})`
      );
      assert(
        res.resolvedDesignCodeId === undefined,
        `Aucun code ne doit être sélectionné silencieusement pour ${dom}`
      );
      assert(
        res.isUsableForCalculation === false,
        "isUsableForCalculation doit être false en cas d'ambiguïté"
      );
      assert(
        res.diagnosticCodes.includes("AMBIGUOUS_DOMAIN_MULTIPLE_CODES"),
        "Le code diagnostic AMBIGUOUS_DOMAIN_MULTIPLE_CODES doit être émis"
      );
      assert(
        res.candidateCodeIds.length >= 2,
        `Les candidats du domaine ${dom} doivent être tracés`
      );
    }
  });

  // =========================================================================
  // TEST 07 : DÉTECTION D'AMBIGUÏTÉ ENTRE SOURCES STRUCTURÉES CONTRADICTOIRES
  // =========================================================================
  runTest("TEST 07 [ARCH-09]: Conflit entre explicitDesignCodeId, pipingSpecId ou projectDefaultDesignCodeId -> AMBIGUOUS", () => {
    const syntheticSpecs: readonly PipingSpecification[] = Object.freeze([
      Object.freeze({
        id: "SPEC-B313-01",
        code: "CS150",
        name: "Synthetic Spec B31.3",
        designCodeId: "ASME-B31.3",
        materialReferenceIds: Object.freeze([]),
        pipeRules: Object.freeze([]),
        fittingRules: Object.freeze([]),
        flangeRules: Object.freeze([]),
        valveRules: Object.freeze([]),
        sourceStatus: "VERIFIED",
        sourceReference: "SYNTHETIC_SPEC_DOC",
      }),
    ]);

    const resolver = new MultiCodeResolver({ specLookup: syntheticSpecs });

    // Conflit entre explicitDesignCodeId (EN-13480) et pipingSpecId (ASME-B31.3)
    const conflictSpecVsExplicit = resolver.resolve({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "EN-13480",
      pipingSpecId: "SPEC-B313-01",
    });

    assert(conflictSpecVsExplicit.status === "AMBIGUOUS", "Conflit Explicit vs Spec doit retourner AMBIGUOUS");
    assert(conflictSpecVsExplicit.resolvedDesignCodeId === undefined, "Aucun code résolu en cas de conflit");
    assert(
      conflictSpecVsExplicit.diagnosticCodes.includes("CONFLICT_EXPLICIT_VS_PIPING_SPEC"),
      "Diagnostic CONFLICT_EXPLICIT_VS_PIPING_SPEC requis"
    );
    assert(
      conflictSpecVsExplicit.competingValidCodeIds.includes("ASME-B31.3") &&
        conflictSpecVsExplicit.competingValidCodeIds.includes("EN-13480"),
      "Les deux codes en compétition doivent être listés"
    );

    // Conflit entre projectDefaultDesignCodeId (ASME-B31.4) et explicitDesignCodeId (ASME-B31.8)
    const conflictProjectVsExplicit = resolver.resolve({
      engineeringDomain: "PIPELINE",
      explicitDesignCodeId: "ASME-B31.8",
      projectDefaultDesignCodeId: "ASME-B31.4",
    });

    assert(conflictProjectVsExplicit.status === "AMBIGUOUS", "Conflit Explicit vs Project doit retourner AMBIGUOUS");
    assert(
      conflictProjectVsExplicit.diagnosticCodes.includes("CONFLICT_EXPLICIT_VS_PROJECT_REF"),
      "Diagnostic CONFLICT_EXPLICIT_VS_PROJECT_REF requis"
    );

    // Plusieurs candidateDesignCodeIds non départagés
    const multiCandidates = resolver.resolve({
      engineeringDomain: "PIPELINE",
      candidateDesignCodeIds: ["ASME-B31.4", "ASME-B31.8"],
    });
    assert(multiCandidates.status === "AMBIGUOUS", "Liste de plusieurs candidats doit retourner AMBIGUOUS");
  });

  // =========================================================================
  // TEST 08 : CONCORDANCE ENTRE PLUSIEURS SOURCES STRUCTURÉES -> RESOLVED
  // =========================================================================
  runTest("TEST 08 [ARCH-09]: Concordance unanime entre PipingSpec, ProjectRef et ExplicitCode -> RESOLVED", () => {
    const syntheticSpecs: readonly PipingSpecification[] = Object.freeze([
      Object.freeze({
        id: "SPEC-B313-UNANIMOUS",
        code: "CS300",
        name: "Unanimous Spec B31.3",
        designCodeId: "ASME-B31.3",
        materialReferenceIds: Object.freeze([]),
        pipeRules: Object.freeze([]),
        fittingRules: Object.freeze([]),
        flangeRules: Object.freeze([]),
        valveRules: Object.freeze([]),
        sourceStatus: "VERIFIED",
        sourceReference: "SYNTHETIC_SPEC_DOC",
      }),
    ]);

    const resolver = new MultiCodeResolver({ specLookup: syntheticSpecs });

    // Résolution par PipingSpec seule
    const bySpecOnly = resolver.resolve({
      engineeringDomain: "PIPING",
      pipingSpecId: "SPEC-B313-UNANIMOUS",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      requestedEdition: { year: "2024" },
      unitSystem: "SI",
    });
    assert(bySpecOnly.status === "RESOLVED", "Résolution par PipingSpec seule doit être RESOLVED");
    assert(bySpecOnly.resolvedDesignCodeId === "ASME-B31.3", "Code résolu = ASME-B31.3");
    assert(bySpecOnly.resolutionSource === "PIPING_SPECIFICATION", "Source = PIPING_SPECIFICATION");
    assert(bySpecOnly.isUsableForCalculation === true, "Utilisable pour PRESSURE_WALL_THICKNESS");

    // Résolution avec concordance Explicit + Spec + Project
    const unanimous = resolver.resolve({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.3",
      pipingSpecId: "SPEC-B313-UNANIMOUS",
      projectDefaultDesignCodeId: "ASME-B31.3",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
    });
    assert(unanimous.status === "RESOLVED", "Concordance unanime doit retourner RESOLVED");
    assert(unanimous.resolvedDesignCodeId === "ASME-B31.3", "Code résolu = ASME-B31.3");
  });

  // =========================================================================
  // TEST 09 : DONNÉES INSUFFISANTES -> INSUFFICIENT_DATA
  // =========================================================================
  runTest("TEST 09 [ARCH-09]: Contexte vide ou sans aucune source exploitable retourne INSUFFICIENT_DATA", () => {
    const emptyRes = resolveApplicableDesignCode({});
    assert(emptyRes.status === "INSUFFICIENT_DATA", "Contexte vide {} doit retourner INSUFFICIENT_DATA");
    assert(emptyRes.resolvedDesignCodeId === undefined, "Aucun code ne doit être résolu");
    assert(emptyRes.isUsableForCalculation === false, "isUsableForCalculation doit être false");
    assert(
      emptyRes.diagnosticCodes.includes("INSUFFICIENT_STRUCTURED_CONTEXT"),
      "Diagnostic INSUFFICIENT_STRUCTURED_CONTEXT attendu"
    );

    // Spec introuvable sans autre source
    const unknownSpecRes = resolveApplicableDesignCode({
      pipingSpecId: "NON-EXISTENT-SPEC-999",
    });
    assert(unknownSpecRes.status === "INSUFFICIENT_DATA", "Spec introuvable seule -> INSUFFICIENT_DATA");
    assert(
      unknownSpecRes.diagnosticCodes.includes("PIPING_SPEC_NOT_FOUND"),
      "Diagnostic PIPING_SPEC_NOT_FOUND attendu"
    );
  });

  // =========================================================================
  // TEST 10 : CODES NON PRIS EN CHARGE, NON DESIGN_CODE OU INCOMPATIBLES DOMAINE -> UNSUPPORTED_CODE
  // =========================================================================
  runTest("TEST 10 [ARCH-09]: Rejet des codes inconnus, des standards non-DESIGN_CODE et des codes hors domaine", () => {
    // 1. Code inconnu du registre
    const unknownCode = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.999-UNKNOWN",
    });
    assert(unknownCode.status === "UNSUPPORTED_CODE", "Code inconnu -> UNSUPPORTED_CODE");
    assert(unknownCode.diagnosticCodes.includes("DESIGN_CODE_NOT_FOUND"), "DESIGN_CODE_NOT_FOUND attendu");

    // 2. ASME-B31.1 référencé dans PIPING mais absent de PDI_STANDARDS_REGISTRY
    const b311Res = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.1",
    });
    assert(
      b311Res.status === "UNSUPPORTED_CODE",
      "ASME-B31.1 n'est pas dans PDI_STANDARDS_REGISTRY -> UNSUPPORTED_CODE"
    );

    // 3. Standards existants mais qui ne sont PAS des DESIGN_CODE (PRODUCT / DIMENSIONAL / MATERIAL)
    const nonDesignCodes = ["ASME-B16.5", "ASME-B36.10M", "API-5L", "API-6D"] as const;
    for (const stdId of nonDesignCodes) {
      const res = resolveApplicableDesignCode({
        explicitDesignCodeId: stdId,
      });
      assert(
        res.status === "UNSUPPORTED_CODE",
        `Le standard ${stdId} n'est pas un DESIGN_CODE et doit retourner UNSUPPORTED_CODE`
      );
      assert(
        res.diagnosticCodes.includes("STANDARD_IS_NOT_DESIGN_CODE"),
        `STANDARD_IS_NOT_DESIGN_CODE attendu pour ${stdId}`
      );
    }

    // 4. Code DESIGN_CODE valide mais incompatible avec le domaine déclaré (ex: ASME-B31.8 dans EQUIPMENT)
    const domainMismatch = resolveApplicableDesignCode({
      engineeringDomain: "EQUIPMENT",
      explicitDesignCodeId: "ASME-B31.8",
    });
    assert(
      domainMismatch.status === "UNSUPPORTED_CODE",
      "ASME-B31.8 n'est pas applicable au domaine EQUIPMENT -> UNSUPPORTED_CODE"
    );
    assert(
      domainMismatch.diagnosticCodes.includes("DOMAIN_DESIGN_CODE_MISMATCH"),
      "DOMAIN_DESIGN_CODE_MISMATCH attendu"
    );
  });

  // =========================================================================
  // TEST 11 : VÉRIFICATION DE L'ÉDITION ET DES PREUVES (ABSENCE DE PREUVE != VALIDATION)
  // =========================================================================
  runTest("TEST 11 [ARCH-09]: Une édition sans NormativeEvidence VERIFIED reste UNVERIFIED ou MISSING_EDITION", () => {
    // 1. ASME-B31.8 possède une édition 2022 dans PDI_STANDARDS_REGISTRY, mais aucune preuve VERIFIED
    const b318Res = resolveApplicableDesignCode({
      engineeringDomain: "PIPELINE",
      explicitDesignCodeId: "ASME-B31.8",
    });
    assert(b318Res.status === "RESOLVED", "ASME-B31.8 est RESOLVED");
    assert(
      b318Res.editionReport.effectiveEdition?.year === "2022",
      "L'édition 2022 du registre est exposée"
    );
    assert(
      b318Res.editionReport.editionVerificationStatus === "UNVERIFIED",
      "Sans preuve NormativeEvidence VERIFIED, l'édition 2022 reste strictement UNVERIFIED"
    );

    // 2. EN-13480 n'a aucune édition dans PDI_STANDARDS_REGISTRY
    const enRes = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "EN-13480",
    });
    assert(
      enRes.editionReport.editionVerificationStatus === "MISSING_EDITION",
      "EN-13480 sans édition doit rapporter MISSING_EDITION"
    );

    // 3. Avec une preuve NormativeEvidence enregistrée et VERIFIED correspondant au code et à l'édition
    const customEvRegistry = new NormativeEvidenceRegistry();
    customEvRegistry.register({
      evidenceId: "EVID_ARCH09_B313_2024",
      standardId: "ASME-B31.3",
      editionId: "ASME-B31.3-2024",
      clauseReference: "para. 304.1.2(a)",
      sourceType: "LICENSED_STANDARD",
      sourceReference: "ASME B31.3-2024 Process Piping",
      verificationStatus: "VERIFIED",
      verifiedBy: "AUDITOR_ARCH09",
      verifiedAt: "2026-01-15T00:00:00Z",
    });
    const customEvResolver = new NormativeEvidenceResolver(customEvRegistry);
    const resolverWithEvidence = new MultiCodeResolver({
      evidenceResolver: customEvResolver,
    });

    const verifiedEdRes = resolverWithEvidence.resolve({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.3",
      requestedEdition: { year: "2024" },
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "SI",
      evidenceIds: ["EVID_ARCH09_B313_2024"],
    });

    assert(
      verifiedEdRes.editionReport.editionVerificationStatus === "VERIFIED",
      "Avec une preuve NormativeEvidence VERIFIED correspondante, l'édition devient VERIFIED"
    );
    assert(
      verifiedEdRes.editionReport.verifiedEvidenceIds.includes("EVID_ARCH09_B313_2024"),
      "L'identifiant de preuve vérifiée doit être exposé"
    );

    // 4. Avec une preuve UNVERIFIED -> reste UNVERIFIED
    customEvRegistry.register({
      evidenceId: "EVID_ARCH09_UNVERIFIED",
      standardId: "ASME-B31.8",
      editionId: "ASME-B31.8-2022",
      clauseReference: "841.1.1",
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: "Draft",
      verificationStatus: "UNVERIFIED",
    });
    const unverifiedEdRes = resolverWithEvidence.resolve({
      engineeringDomain: "PIPELINE",
      explicitDesignCodeId: "ASME-B31.8",
      evidenceIds: ["EVID_ARCH09_UNVERIFIED"],
    });
    assert(
      unverifiedEdRes.editionReport.editionVerificationStatus === "UNVERIFIED",
      "Une preuve UNVERIFIED ne valide jamais l'édition"
    );
  });

  // =========================================================================
  // TEST 12 : CONTRÔLE D'ÉDITION ET D'UNITÉS SUR LA DISPONIBILITÉ DE CALCUL
  // =========================================================================
  runTest("TEST 12 [ARCH-09]: Vérification stricte de l'édition (2024) et du système d'unités (SI) pour F01 ASME-B31.3", () => {
    // Édition non qualifiée (ex: 2018 au lieu de 2024) -> EDITION_MISMATCH
    const wrongEdition = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.3",
      requestedEdition: { year: "2018" },
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "SI",
    });
    assert(wrongEdition.status === "RESOLVED", "Le code ASME-B31.3 reste RESOLVED");
    assert(
      wrongEdition.isUsableForCalculation === false,
      "L'édition 2018 n'est pas qualifiée pour F01 -> isUsableForCalculation === false"
    );
    assert(
      wrongEdition.calculationAvailability.availabilityStatus === "EDITION_MISMATCH",
      "availabilityStatus doit être EDITION_MISMATCH"
    );

    // Système d'unités US_CUSTOMARY au lieu de SI -> UNVERIFIED_UNIT_SYSTEM
    const wrongUnits = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      explicitDesignCodeId: "ASME-B31.3",
      requestedEdition: { year: "2024" },
      requestedCalculationType: "PRESSURE_WALL_THICKNESS",
      unitSystem: "US_CUSTOMARY",
    });
    assert(wrongUnits.status === "RESOLVED", "Le code ASME-B31.3 reste RESOLVED");
    assert(
      wrongUnits.isUsableForCalculation === false,
      "US_CUSTOMARY n'est pas qualifié pour F01 -> isUsableForCalculation === false"
    );
    assert(
      wrongUnits.calculationAvailability.availabilityStatus === "UNVERIFIED_UNIT_SYSTEM",
      "availabilityStatus doit être UNVERIFIED_UNIT_SYSTEM"
    );
  });

  // =========================================================================
  // TEST 13 : ANTI-HEURISTIQUE & REJET DU NOM CLIENT / TEXTE LIBRE (§4)
  // =========================================================================
  runTest("TEST 13 [ARCH-09]: Rejet strict de toute sélection basée sur un nom de client, texte libre ou token heuristique", () => {
    // 1. Champ clientName injecté dans le contexte
    const withClientName = resolveApplicableDesignCode({
      engineeringDomain: "PIPELINE",
      clientName: "National Gas Corp",
    } as unknown as Parameters<typeof resolveApplicableDesignCode>[0]);
    assert(
      withClientName.status === "INVALID_CONTEXT",
      "La présence d'un champ clientName doit être rejetée avec INVALID_CONTEXT"
    );
    assert(
      withClientName.diagnosticCodes.includes("DISALLOWED_CLIENT_NAME_INFLUENCE"),
      "Diagnostic DISALLOWED_CLIENT_NAME_INFLUENCE attendu"
    );

    // 2. Champ freeText / descriptionHint injecté dans le contexte
    const withFreeText = resolveApplicableDesignCode({
      engineeringDomain: "PIPING",
      freeText: "Please use process piping code B31.3 for this refinery line",
    } as unknown as Parameters<typeof resolveApplicableDesignCode>[0]);
    assert(
      withFreeText.status === "INVALID_CONTEXT",
      "La présence d'un champ freeText doit être rejetée avec INVALID_CONTEXT"
    );
    assert(
      withFreeText.diagnosticCodes.includes("DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT"),
      "Diagnostic DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT attendu"
    );

    // 3. Chaîne libre avec espaces passée dans explicitDesignCodeId
    const freeTextInCodeId = resolveApplicableDesignCode({
      explicitDesignCodeId: "ASME B31.3 Process Piping",
    });
    assert(
      freeTextInCodeId.status === "INVALID_CONTEXT",
      "Une phrase libre dans explicitDesignCodeId doit être rejetée avec INVALID_CONTEXT"
    );

    // 4. Token heuristique interdit (ex: MAT_CS_001) passé comme identifiant
    const heuristicToken = resolveApplicableDesignCode({
      explicitDesignCodeId: "MAT_CS_B313",
    });
    assert(
      heuristicToken.status === "INVALID_CONTEXT",
      "Un token heuristique MAT_CS_* doit être rejeté avec INVALID_CONTEXT"
    );
    assert(
      heuristicToken.diagnosticCodes.includes("DISALLOWED_TOKEN_HEURISTIC"),
      "Diagnostic DISALLOWED_TOKEN_HEURISTIC attendu"
    );

    // 5. Validation directe d'entrées non-objets (null, array)
    assert(
      resolveApplicableDesignCode(null as unknown as Parameters<typeof resolveApplicableDesignCode>[0]).status ===
        "INVALID_CONTEXT",
      "null doit retourner INVALID_CONTEXT"
    );
    assert(
       validateMultiCodeResolutionContext([]).valid === false,
      "Un tableau doit être rejeté par validateMultiCodeResolutionContext"
    );
  });

  // =========================================================================
  // TEST 14 : DÉTERMINISME ET IMMUTABILITÉ DU RESOLVER
  // =========================================================================
  runTest("TEST 14 [ARCH-09]: Déterminisme strict et immutabilité complète des sorties", () => {
    const ctx = {
      engineeringDomain: "PIPING" as const,
      explicitDesignCodeId: "ASME-B31.3",
      requestedCalculationType: "PRESSURE_WALL_THICKNESS" as const,
      requestedEdition: { year: "2024" },
      unitSystem: "SI" as const,
    };

    const r1 = defaultMultiCodeResolver.resolve(ctx);
    const r2 = defaultMultiCodeResolver.resolve(ctx);

    assert(JSON.stringify(r1) === JSON.stringify(r2), "Deux exécutions identiques doivent produire exactement le même JSON");
    assert(Object.isFrozen(r1), "Result doit être Object.isFrozen");
    assert(Object.isFrozen(r1.candidateCodeIds), "candidateCodeIds doit être Object.isFrozen");
    assert(Object.isFrozen(r1.competingValidCodeIds), "competingValidCodeIds doit être Object.isFrozen");
    assert(Object.isFrozen(r1.candidateTraces), "candidateTraces doit être Object.isFrozen");
    assert(Object.isFrozen(r1.editionReport), "editionReport doit être Object.isFrozen");
    assert(Object.isFrozen(r1.calculationAvailability), "calculationAvailability doit être Object.isFrozen");
    assert(Object.isFrozen(r1.diagnosticCodes), "diagnosticCodes doit être Object.isFrozen");
    assert(Object.isFrozen(r1.messages), "messages doit être Object.isFrozen");
  });

  // =========================================================================
  // TEST 15 : NON-RÉGRESSION ARCH-08, ARCH-07, NORM-08 & NORM-01..14
  // =========================================================================
  runTest("TEST 15 [ARCH-09]: Non-régression complète ARCH-08, ARCH-07, NORM-08 et Global Normative Suite", () => {
    const arch08 = runArch08MultiDomainArchitectureTests();
    assert(arch08.success === true, `ARCH-08 doit rester 100% PASS: ${arch08.failures.join("; ")}`);

    const arch07 = runArch07IndustrialArchitectureTests();
    assert(arch07.success === true, `ARCH-07 doit rester 100% PASS: ${arch07.failures.join("; ")}`);

    const norm08 = runDesignCodeEngineTests();
    assert(norm08.success === true && norm08.testsRun >= 90, "NORM-08 DesignCodeEngineTests doit rester 100% PASS");

    const globalNorm = runNormativeGlobalIntegrationTests();
    assert(globalNorm.success === true, "NORM-01..14 Global Integration Suite doit rester 100% PASS");

    // Vérifier que PDI_STANDARDS_REGISTRY est intact
    assert(Object.isFrozen(PDI_STANDARDS_REGISTRY), "PDI_STANDARDS_REGISTRY reste gelé");
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
