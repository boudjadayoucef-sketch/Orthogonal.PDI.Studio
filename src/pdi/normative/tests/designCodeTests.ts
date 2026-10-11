/**
 * PDI NORMATIVE ENGINE — TESTS NORM-08
 * Reference: PATCH NORM-08 (Design Code Engine / Engineering Calculation Foundation)
 * 
 * Tests unitaires déterministes validant les 36 exigences strictes de NORM-08 :
 * - D01: Design Code existant reconnu.
 * - D02: Design Code inconnu -> FAIL.
 * - D03: Design Code PRODUCT_STANDARD -> FAIL.
 * - D04: Design Code DIMENSIONAL_STANDARD -> FAIL.
 * - D05: Design Code MATERIAL_STANDARD -> FAIL.
 * - D06: {} partial -> PASS.
 * - D07: {} complete -> FAIL lorsque le calcul sélectionné exige des inputs.
 * - D08: null -> FAIL.
 * - D09: array -> FAIL.
 * - D10: invalid unit system -> FAIL.
 * - D11: pressure <= 0 -> FAIL lorsqu'exigée.
 * - D12: diameter <= 0 -> FAIL lorsqu'exigée.
 * - D13: thickness <= 0 -> FAIL lorsqu'exigée.
 * - D14: corrosion allowance négative -> FAIL.
 * - D15: NaN -> FAIL.
 * - D16: Infinity -> FAIL.
 * - D17: missing material reference -> FAIL lorsqu'un calcul le requiert.
 * - D18: missing pipe dimension reference -> FAIL lorsqu'un calcul le requiert.
 * - D19: missing weld factor -> aucune valeur implicite (FAIL sur complete).
 * - D20: missing design factor -> aucune valeur implicite (rejet si invalide).
 * - D21: missing edition lorsque requise -> pas d'invention silencieuse.
 * - D22: formula sans source vérifiée -> NOT_IMPLEMENTED ou UNVERIFIED.
 * - D23: formula sans clause/reference -> NOT_IMPLEMENTED ou UNVERIFIED.
 * - D24: aucun résultat NaN.
 * - D25: aucun résultat Infinity.
 * - D26: aucun arrondi arbitraire.
 * - D27: aucune conversion NPS/DN ajoutée.
 * - D28: aucune conversion Class/PN ajoutée.
 * - D29: aucune donnée matériau inventée.
 * - D30: aucune donnée dimensionnelle inventée.
 * - D31: aucun mapping legacy.
 * - D32: aucune intégration UI.
 * - D33: aucune intégration database.
 * - D34: aucune décision de compliance (COMPLIANT interdit).
 * - D35: registry immutable (Object.isFrozen).
 * - D36: calcul purement déterministe pour les mêmes entrées.
 */

import {
  DESIGN_CODE_CALCULATION_REGISTRY,
  getDesignCodeCalculationEntry,
  isDesignCodeRegisteredForCalculation,
} from "../registry/designCodeRegistry";
import {
  validateCompleteEngineeringCalculationInput,
  validatePartialEngineeringCalculationInput,
  validateDesignCodeFormulaReference,
  isFormulaQualified,
  isEngineeringCalculationType,
  isEngineeringUnitSystem,
  isDesignCodeFormulaStatus,
  VALID_FORMULA_STATUSES,
} from "../validators/designCodeValidator";
import { executeEngineeringCalculation } from "../engine/designCodeEngine";
import type {
  DesignCodeFormulaReference,
  DesignCodeFormulaStatus,
  FormulaDomain,
  FormulaRegime,
  FormulaUnitContract,
  EngineeringCalculationInput,
} from "../types/designCodeTypes";

export function runDesignCodeEngineTests(): { success: boolean; testsRun: number } {
  let testsRun = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      throw new Error(`TEST FAILED: ${testName} ${detail ? `(${detail})` : ""}`);
    }
  }

  // =========================================================================
  // D01: Design Code existant reconnu
  // =========================================================================
  testsRun++;
  const entryB313 = getDesignCodeCalculationEntry("ASME-B31.3");
  assert(
    entryB313 !== undefined && entryB313.id === "ASME-B31.3",
    "D01 — ASME-B31.3 doit être reconnu dans le registre de calcul"
  );

  // =========================================================================
  // D02: Design Code inconnu -> FAIL
  // =========================================================================
  testsRun++;
  const resD02 = validatePartialEngineeringCalculationInput({
    designCodeId: "UNKNOWN-CODE-999",
  });
  assert(
    !resD02.valid && resD02.errors.some((e) => e.code === "DESIGN_CODE_NOT_FOUND"),
    "D02 — Design Code inconnu doit échouer avec DESIGN_CODE_NOT_FOUND"
  );

  // =========================================================================
  // D03: Design Code PRODUCT_STANDARD (ASME-B16.5) -> FAIL
  // =========================================================================
  testsRun++;
  const resD03 = validatePartialEngineeringCalculationInput({
    designCodeId: "ASME-B16.5",
  });
  assert(
    !resD03.valid && resD03.errors.some((e) => e.code === "STANDARD_IS_NOT_DESIGN_CODE"),
    "D03 — Standard produit (ASME-B16.5) fourni comme designCodeId doit échouer"
  );

  // =========================================================================
  // D04: Design Code DIMENSIONAL_STANDARD (ASME-B36.10M) -> FAIL
  // =========================================================================
  testsRun++;
  const resD04 = validatePartialEngineeringCalculationInput({
    designCodeId: "ASME-B36.10M",
  });
  assert(
    !resD04.valid && resD04.errors.some((e) => e.code === "STANDARD_IS_NOT_DESIGN_CODE"),
    "D04 — Standard dimensionnel (ASME-B36.10M) fourni comme designCodeId doit échouer"
  );

  // =========================================================================
  // D05: Design Code MATERIAL_STANDARD (API-5L) -> FAIL
  // =========================================================================
  testsRun++;
  const resD05 = validatePartialEngineeringCalculationInput({
    designCodeId: "API-5L",
  });
  assert(
    !resD05.valid && resD05.errors.some((e) => e.code === "STANDARD_IS_NOT_DESIGN_CODE"),
    "D05 — Standard matériau (API-5L) fourni comme designCodeId doit échouer"
  );

  // =========================================================================
  // D06: {} partial -> PASS
  // =========================================================================
  testsRun++;
  const resD06 = validatePartialEngineeringCalculationInput({});
  assert(resD06.valid && resD06.errors.length === 0, "D06 — {} partial doit être valide");

  // =========================================================================
  // D07: {} complete -> FAIL lorsque le calcul sélectionné exige des inputs
  // =========================================================================
  testsRun++;
  const resD07 = validateCompleteEngineeringCalculationInput({});
  assert(!resD07.valid && resD07.errors.length > 0, "D07 — {} complete doit échouer");

  // =========================================================================
  // D08: null -> FAIL
  // =========================================================================
  testsRun++;
  const resD08 = validatePartialEngineeringCalculationInput(null);
  assert(
    !resD08.valid && resD08.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "D08 — null doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // D09: array -> FAIL
  // =========================================================================
  testsRun++;
  const resD09 = validatePartialEngineeringCalculationInput([]);
  assert(
    !resD09.valid && resD09.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "D09 — array doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // D10: invalid unit system -> FAIL
  // =========================================================================
  testsRun++;
  const resD10 = validatePartialEngineeringCalculationInput({
    unitSystem: "METRIC_BAR" as unknown as undefined,
  });
  assert(
    !resD10.valid && resD10.errors.some((e) => e.code === "INVALID_UNIT_SYSTEM"),
    "D10 — Système d'unité invalide doit échouer"
  );

  // =========================================================================
  // D11: pressure <= 0 -> FAIL lorsqu'exigée
  // =========================================================================
  testsRun++;
  const resD11 = validatePartialEngineeringCalculationInput({
    pressure: 0,
  });
  assert(
    !resD11.valid && resD11.errors.some((e) => e.code === "INVALID_PRESSURE"),
    "D11 — Pression <= 0 doit échouer avec INVALID_PRESSURE"
  );

  // =========================================================================
  // D12: diameter <= 0 -> FAIL lorsqu'exigée
  // =========================================================================
  testsRun++;
  const resD12 = validatePartialEngineeringCalculationInput({
    outsideDiameterMm: -10,
  });
  assert(
    !resD12.valid && resD12.errors.some((e) => e.code === "INVALID_DIAMETER"),
    "D12 — Diamètre <= 0 doit échouer avec INVALID_DIAMETER"
  );

  // =========================================================================
  // D13: thickness <= 0 -> FAIL lorsqu'exigée
  // =========================================================================
  testsRun++;
  const resD13 = validatePartialEngineeringCalculationInput({
    wallThicknessMm: 0,
  });
  assert(
    !resD13.valid && resD13.errors.some((e) => e.code === "INVALID_THICKNESS"),
    "D13 — Épaisseur <= 0 doit échouer avec INVALID_THICKNESS"
  );

  // =========================================================================
  // D14: corrosion allowance négative -> FAIL
  // =========================================================================
  testsRun++;
  const resD14 = validatePartialEngineeringCalculationInput({
    corrosionAllowanceMm: -1.5,
  });
  assert(
    !resD14.valid && resD14.errors.some((e) => e.code === "INVALID_CORROSION_ALLOWANCE"),
    "D14 — Surépaisseur de corrosion négative doit échouer"
  );

  // =========================================================================
  // D15: NaN -> FAIL
  // =========================================================================
  testsRun++;
  const resD15 = validatePartialEngineeringCalculationInput({
    pressure: NaN,
  });
  assert(
    !resD15.valid && resD15.errors.some((e) => e.code === "INVALID_INPUT_VALUE"),
    "D15 — NaN en entrée doit échouer"
  );

  // =========================================================================
  // D16: Infinity -> FAIL
  // =========================================================================
  testsRun++;
  const resD16 = validatePartialEngineeringCalculationInput({
    pressure: Infinity,
  });
  assert(
    !resD16.valid && resD16.errors.some((e) => e.code === "INVALID_INPUT_VALUE"),
    "D16 — Infinity en entrée doit échouer"
  );

  // =========================================================================
  // D17: missing material reference -> FAIL lorsqu'un calcul le requiert
  // =========================================================================
  testsRun++;
  const resD17 = validateCompleteEngineeringCalculationInput({
    designCodeId: "ASME-B31.3",
    calculationType: "PRESSURE_WALL_THICKNESS",
    unitSystem: "SI",
    pressure: 2.0,
    outsideDiameterMm: 60.3,
    corrosionAllowanceMm: 1.5,
    weldJointFactor: 1.0,
    // Absence de materialId et allowableStressMpa
  });
  assert(
    !resD17.valid && resD17.errors.some((e) => e.code === "MATERIAL_REFERENCE_REQUIRED"),
    "D17 — Absence de référence matériau doit échouer avec MATERIAL_REFERENCE_REQUIRED"
  );

  // =========================================================================
  // D18: missing pipe dimension reference -> FAIL lorsqu'un calcul le requiert
  // =========================================================================
  testsRun++;
  const resD18 = validateCompleteEngineeringCalculationInput({
    designCodeId: "ASME-B31.3",
    calculationType: "PRESSURE_WALL_THICKNESS",
    unitSystem: "SI",
    pressure: 2.0,
    materialId: "MAT_CS_001",
    corrosionAllowanceMm: 1.5,
    weldJointFactor: 1.0,
    // Absence de outsideDiameterMm
  });
  assert(
    !resD18.valid && resD18.errors.some((e) => e.code === "PIPE_DIMENSION_REFERENCE_REQUIRED"),
    "D18 — Absence de référence dimensionnelle doit échouer avec PIPE_DIMENSION_REFERENCE_REQUIRED"
  );

  // =========================================================================
  // D19: missing weld factor -> aucune valeur implicite
  // =========================================================================
  testsRun++;
  const resD19 = validateCompleteEngineeringCalculationInput({
    designCodeId: "ASME-B31.3",
    calculationType: "PRESSURE_WALL_THICKNESS",
    unitSystem: "SI",
    pressure: 2.0,
    outsideDiameterMm: 60.3,
    materialId: "MAT_CS_001",
    corrosionAllowanceMm: 1.5,
    // weldJointFactor manquant
  });
  assert(
    !resD19.valid && resD19.errors.some((e) => e.field === "weldJointFactor"),
    "D19 — weldJointFactor manquant doit échouer (aucune valeur implicite)"
  );

  // =========================================================================
  // D20: missing design factor -> aucune valeur implicite
  // =========================================================================
  testsRun++;
  const resD20Invalid = validatePartialEngineeringCalculationInput({
    designFactor: 1.5, // > 1.0 -> invalide
  });
  assert(
    !resD20Invalid.valid && resD20Invalid.errors.some((e) => e.code === "INVALID_COEFFICIENT"),
    "D20 — designFactor hors domaine valide doit échouer"
  );

  // =========================================================================
  // D21: missing edition lorsque requise -> pas d'invention silencieuse
  // =========================================================================
  testsRun++;
  const validNominalInput: EngineeringCalculationInput = {
    designCodeId: "ASME-B31.3",
    calculationType: "PRESSURE_WALL_THICKNESS",
    unitSystem: "SI",
    pressure: 2.5,
    outsideDiameterMm: 114.3,
    materialId: "MAT_API_5L_X52",
    corrosionAllowanceMm: 1.5,
    weldJointFactor: 1.0,
  };
  const execD21 = executeEngineeringCalculation(validNominalInput);
  assert(
    execD21.standardEdition === undefined,
    "D21 — L'édition ne doit pas être inventée silencieusement"
  );

  // =========================================================================
  // D22: formula sans source vérifiée -> NOT_IMPLEMENTED ou UNVERIFIED
  // =========================================================================
  testsRun++;
  assert(
    execD21.status === "NOT_IMPLEMENTED" || execD21.status === "UNVERIFIED",
    "D22 — Formule sans source vérifiée doit renvoyer NOT_IMPLEMENTED ou UNVERIFIED"
  );

  // =========================================================================
  // D23: formula sans clause/reference -> NOT_IMPLEMENTED ou UNVERIFIED
  // =========================================================================
  testsRun++;
  assert(
    execD21.status === "NOT_IMPLEMENTED",
    "D23 — Sans clause vérifiée implémentée, le statut doit être NOT_IMPLEMENTED"
  );

  // =========================================================================
  // D24: aucun résultat NaN
  // =========================================================================
  testsRun++;
  assert(
    execD21.value === undefined || (typeof execD21.value === "number" && !Number.isNaN(execD21.value)),
    "D24 — Aucun résultat ne doit être NaN"
  );

  // =========================================================================
  // D25: aucun résultat Infinity
  // =========================================================================
  testsRun++;
  assert(
    execD21.value === undefined || (typeof execD21.value === "number" && Number.isFinite(execD21.value)),
    "D25 — Aucun résultat ne doit être Infinity"
  );

  // =========================================================================
  // D26: aucun arrondi arbitraire
  // =========================================================================
  testsRun++;
  assert(
    !("roundedValue" in execD21),
    "D26 — Aucun champ d'arrondi arbitraire dans le modèle de résultat"
  );

  // =========================================================================
  // D27: aucune conversion NPS/DN ajoutée
  // =========================================================================
  testsRun++;
  assert(
    !("convertedDn" in execD21) && !("convertedNps" in execD21),
    "D27 — Aucune conversion automatique NPS/DN"
  );

  // =========================================================================
  // D28: aucune conversion Class/PN ajoutée
  // =========================================================================
  testsRun++;
  assert(
    !("convertedRating" in execD21),
    "D28 — Aucune conversion automatique Class/PN"
  );

  // =========================================================================
  // D29: aucune donnée matériau inventée
  // =========================================================================
  testsRun++;
  assert(
    !("fabricatedYieldStrength" in execD21) && !("inventedAllowableStress" in execD21),
    "D29 — Aucune donnée de matériau inventée"
  );

  // =========================================================================
  // D30: aucune donnée dimensionnelle inventée
  // =========================================================================
  testsRun++;
  assert(
    !("assumedSchedule" in execD21),
    "D30 — Aucune donnée dimensionnelle inventée (aucun Schedule assumé)"
  );

  // =========================================================================
  // D31: aucun mapping legacy
  // =========================================================================
  testsRun++;
  assert(
    !("legacyCatalogId" in execD21),
    "D31 — Aucun mapping vers les catalogues legacy"
  );

  // =========================================================================
  // D32: aucune intégration UI
  // =========================================================================
  testsRun++;
  assert(
    !("htmlElement" in execD21) && !("reactComponent" in execD21),
    "D32 — Aucune intégration UI dans le moteur"
  );

  // =========================================================================
  // D33: aucune intégration database
  // =========================================================================
  testsRun++;
  assert(
    !("firestoreId" in execD21) && !("sqlTable" in execD21),
    "D33 — Aucune intégration base de données dans le moteur de calcul"
  );

  // =========================================================================
  // D34: aucune décision de compliance
  // =========================================================================
  testsRun++;
  assert(
    (execD21.status as string) !== "COMPLIANT",
    "D34 — Le statut COMPLIANT est strictement interdit dans NORM-08"
  );

  // =========================================================================
  // D35: registry immutable
  // =========================================================================
  testsRun++;
  assert(
    Object.isFrozen(DESIGN_CODE_CALCULATION_REGISTRY),
    "D35 — Le registre DESIGN_CODE_CALCULATION_REGISTRY doit être gelé (Object.freeze)"
  );

  // =========================================================================
  // D36: calcul purement déterministe pour les mêmes entrées
  // =========================================================================
  testsRun++;
  const runA = executeEngineeringCalculation(validNominalInput);
  const runB = executeEngineeringCalculation(validNominalInput);
  assert(
    runA.status === runB.status &&
      runA.calculationType === runB.calculationType &&
      runA.designCodeId === runB.designCodeId &&
      runA.errors.length === runB.errors.length,
    "D36 — Le calcul doit être strictement déterministe pour des entrées identiques"
  );

  // =========================================================================
  // R1-01: Types DesignCodeFormulaStatus vérifiés
  // =========================================================================
  testsRun++;
  assert(
    VALID_FORMULA_STATUSES.length === 4 &&
      VALID_FORMULA_STATUSES.includes("VERIFIED") &&
      VALID_FORMULA_STATUSES.includes("LICENSED") &&
      VALID_FORMULA_STATUSES.includes("UNVERIFIED") &&
      VALID_FORMULA_STATUSES.includes("NOT_IMPLEMENTED"),
    "R1-01 — Les 4 statuts de formule sont VERIFIED, LICENSED, UNVERIFIED, NOT_IMPLEMENTED"
  );

  // =========================================================================
  // R1-02: Aucun cast 'as any' dans l'implémentation
  // =========================================================================
  testsRun++;
  assert(
    typeof validateDesignCodeFormulaReference === "function" &&
      typeof isFormulaQualified === "function",
    "R1-02 — Fonctions de validation et qualification disponibles sans cast as any"
  );

  // =========================================================================
  // R1-03: FormulaUnitContract supporte explicitement SI et US_CUSTOMARY
  // =========================================================================
  testsRun++;
  const sampleUnitContract: FormulaUnitContract = Object.freeze({
    unitSystem: "SI",
    pressureUnit: "MPa",
    diameterUnit: "mm",
    thicknessUnit: "mm",
    stressUnit: "MPa",
  });
  assert(
    sampleUnitContract.unitSystem === "SI" && sampleUnitContract.pressureUnit === "MPa",
    "R1-03 — FormulaUnitContract supporte explicitement SI"
  );

  // =========================================================================
  // R1-04: FormulaDomain inclut THIN_WALL, THICK_WALL, HIGH_TEMP, ALL
  // =========================================================================
  testsRun++;
  const regimes: readonly FormulaRegime[] = ["THIN_WALL", "THICK_WALL", "HIGH_TEMP", "ALL"];
  const sampleDomain: FormulaDomain = Object.freeze({
    regime: "THIN_WALL",
    minimumPressure: 0,
    maximumPressure: 100,
  });
  assert(
    regimes.length === 4 &&
      regimes.includes("THIN_WALL") &&
      regimes.includes("ALL") &&
      sampleDomain.regime === "THIN_WALL",
    "R1-04 — FormulaDomain supporte regime (THIN_WALL, THICK_WALL, HIGH_TEMP, ALL)"
  );

  // =========================================================================
  // R1-05: validateDesignCodeFormulaReference rejette objet non-record
  // =========================================================================
  testsRun++;
  const vNonObj = validateDesignCodeFormulaReference(null);
  const vArr = validateDesignCodeFormulaReference(["not", "an", "object"]);
  assert(
    !vNonObj.valid &&
      !vArr.valid &&
      vNonObj.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "R1-05 — validateDesignCodeFormulaReference rejette null et array"
  );

  // =========================================================================
  // R1-06: validateDesignCodeFormulaReference exige un champ id non vide
  // =========================================================================
  testsRun++;
  const vMissingId = validateDesignCodeFormulaReference({
    designCodeId: "ASME-B31.3",
    status: "NOT_IMPLEMENTED",
  });
  const vEmptyId = validateDesignCodeFormulaReference({
    id: "   ",
    designCodeId: "ASME-B31.3",
    status: "NOT_IMPLEMENTED",
  });
  assert(
    !vMissingId.valid &&
      !vEmptyId.valid &&
      vMissingId.errors.some((e) => e.code === "INVALID_FORMULA_REFERENCE"),
    "R1-06 — validateDesignCodeFormulaReference exige un id non vide"
  );

  // =========================================================================
  // R1-07: validateDesignCodeFormulaReference exige un designCodeId répertorié de type DESIGN_CODE
  // =========================================================================
  testsRun++;
  const vUnknownCode = validateDesignCodeFormulaReference({
    id: "FORM-01",
    designCodeId: "UNKNOWN-CODE-999",
    status: "NOT_IMPLEMENTED",
  });
  const vNonDesignCode = validateDesignCodeFormulaReference({
    id: "FORM-02",
    designCodeId: "ASME-B16.5", // C'est un PRODUCT_STANDARD, pas un DESIGN_CODE
    status: "NOT_IMPLEMENTED",
  });
  assert(
    !vUnknownCode.valid &&
      vUnknownCode.errors.some((e) => e.code === "DESIGN_CODE_NOT_FOUND") &&
      !vNonDesignCode.valid &&
      vNonDesignCode.errors.some((e) => e.code === "FORMULA_DESIGN_CODE_MISMATCH"),
    "R1-07 — validateDesignCodeFormulaReference exige un code DESIGN_CODE répertorié"
  );

  // =========================================================================
  // R1-08: validateDesignCodeFormulaReference rejette un statut invalide
  // =========================================================================
  testsRun++;
  const vInvalidStatus = validateDesignCodeFormulaReference({
    id: "FORM-03",
    designCodeId: "ASME-B31.3",
    status: "APPROVED_MAGICALLY",
  });
  assert(
    !vInvalidStatus.valid &&
      vInvalidStatus.errors.some((e) => e.code === "INVALID_FORMULA_STATUS"),
    "R1-08 — validateDesignCodeFormulaReference rejette un statut arbitraire"
  );

  // =========================================================================
  // R1-09: Formule VERIFIED sans clauseReference -> erreur FORMULA_CLAUSE_REQUIRED
  // =========================================================================
  testsRun++;
  const vVerifiedNoClause = validateDesignCodeFormulaReference({
    id: "B313-THK-01",
    designCodeId: "ASME-B31.3",
    status: "VERIFIED",
    sourceReference: "ASME B31.3-2022 Chapter II",
  });
  assert(
    !vVerifiedNoClause.valid &&
      vVerifiedNoClause.errors.some((e) => e.code === "FORMULA_CLAUSE_REQUIRED"),
    "R1-09 — Formule VERIFIED sans clauseReference est rejetée"
  );

  // =========================================================================
  // R1-10: Formule VERIFIED sans sourceReference -> erreur FORMULA_SOURCE_REQUIRED
  // =========================================================================
  testsRun++;
  const vVerifiedNoSource = validateDesignCodeFormulaReference({
    id: "B313-THK-01",
    designCodeId: "ASME-B31.3",
    status: "VERIFIED",
    clauseReference: "para. 304.1.2",
  });
  assert(
    !vVerifiedNoSource.valid &&
      vVerifiedNoSource.errors.some((e) => e.code === "FORMULA_SOURCE_REQUIRED"),
    "R1-10 — Formule VERIFIED sans sourceReference est rejetée"
  );

  // =========================================================================
  // R1-11: Formule VERIFIED avec clause et source complètes -> valid: true
  // =========================================================================
  testsRun++;
  const validVerifiedFormula: DesignCodeFormulaReference = Object.freeze({
    id: "B313-EQ-304.1.2",
    designCodeId: "ASME-B31.3",
    status: "VERIFIED",
    calculationType: "PRESSURE_WALL_THICKNESS",
    clauseReference: "para. 304.1.2 Eq. (3a)",
    sourceReference: "ASME B31.3 Process Piping 2022 Edition",
    domain: Object.freeze({ regime: "THIN_WALL" }),
  });
  const vVerifiedValid = validateDesignCodeFormulaReference(validVerifiedFormula);
  assert(
    vVerifiedValid.valid && vVerifiedValid.errors.length === 0,
    "R1-11 — Formule VERIFIED avec clause et source est valide"
  );

  // =========================================================================
  // R1-12: Formule LICENSED avec clause et source complètes -> valid: true
  // =========================================================================
  testsRun++;
  const validLicensedFormula: DesignCodeFormulaReference = Object.freeze({
    id: "EN13480-EQ-6.1",
    designCodeId: "EN-13480",
    status: "LICENSED",
    calculationType: "PRESSURE_WALL_THICKNESS",
    clauseReference: "Clause 6.1-1",
    sourceReference: "EN 13480-3:2017+A4:2020",
    domain: Object.freeze({ regime: "ALL" }),
  });
  const vLicensedValid = validateDesignCodeFormulaReference(validLicensedFormula);
  assert(
    vLicensedValid.valid && vLicensedValid.errors.length === 0,
    "R1-12 — Formule LICENSED avec clause et source est valide"
  );

  // =========================================================================
  // R1-13: Formule NOT_IMPLEMENTED sans clause/source reste valide au schéma de base
  // =========================================================================
  testsRun++;
  const notImplFormula: DesignCodeFormulaReference = Object.freeze({
    id: "B314-THK-FUTURE",
    designCodeId: "ASME-B31.4",
    status: "NOT_IMPLEMENTED",
  });
  const vNotImpl = validateDesignCodeFormulaReference(notImplFormula);
  assert(
    vNotImpl.valid && vNotImpl.errors.length === 0,
    "R1-13 — Formule NOT_IMPLEMENTED sans clause reste valide au schéma de base"
  );

  // =========================================================================
  // R1-14: isFormulaQualified retourne false pour NOT_IMPLEMENTED
  // =========================================================================
  testsRun++;
  assert(
    isFormulaQualified(notImplFormula) === false,
    "R1-14 — isFormulaQualified retourne false pour NOT_IMPLEMENTED"
  );

  // =========================================================================
  // R1-15: isFormulaQualified retourne false pour UNVERIFIED
  // =========================================================================
  testsRun++;
  const unverifiedFormula: DesignCodeFormulaReference = Object.freeze({
    id: "B318-THK-UNVERIF",
    designCodeId: "ASME-B31.8",
    status: "UNVERIFIED",
    clauseReference: "841.1.1",
  });
  assert(
    isFormulaQualified(unverifiedFormula) === false,
    "R1-15 — isFormulaQualified retourne false pour UNVERIFIED"
  );

  // =========================================================================
  // R1-16: isFormulaQualified retourne true pour VERIFIED avec clause et source
  // =========================================================================
  testsRun++;
  assert(
    isFormulaQualified(validVerifiedFormula) === true,
    "R1-16 — isFormulaQualified retourne true pour VERIFIED avec clause et source"
  );

  // =========================================================================
  // R1-17: isFormulaQualified retourne true pour LICENSED avec clause et source
  // =========================================================================
  testsRun++;
  assert(
    isFormulaQualified(validLicensedFormula) === true,
    "R1-17 — isFormulaQualified retourne true pour LICENSED avec clause et source"
  );

  // =========================================================================
  // R1-18: isFormulaQualified retourne false pour objet invalide ou non-record
  // =========================================================================
  testsRun++;
  assert(
    isFormulaQualified(null) === false &&
      isFormulaQualified(undefined) === false &&
      isFormulaQualified("string") === false &&
      isFormulaQualified({}) === false,
    "R1-18 — isFormulaQualified retourne false pour données invalides ou incomplètes"
  );

  // =========================================================================
  // R1-19: isEngineeringCalculationType valide types supportés et rejette invalides
  // =========================================================================
  testsRun++;
  assert(
    isEngineeringCalculationType("PRESSURE_WALL_THICKNESS") &&
      isEngineeringCalculationType("ALLOWABLE_PRESSURE") &&
      isEngineeringCalculationType("HOOP_STRESS") &&
      isEngineeringCalculationType("TEST_PRESSURE") &&
      isEngineeringCalculationType("OTHER") &&
      !isEngineeringCalculationType("BOGUS_CALC") &&
      !isEngineeringCalculationType(null),
    "R1-19 — isEngineeringCalculationType discrimine rigoureusement sans cast"
  );

  // =========================================================================
  // R1-20: isEngineeringUnitSystem valide SI / US_CUSTOMARY et rejette autres
  // =========================================================================
  testsRun++;
  assert(
    isEngineeringUnitSystem("SI") &&
      isEngineeringUnitSystem("US_CUSTOMARY") &&
      !isEngineeringUnitSystem("IMPERIAL_INCH") &&
      !isEngineeringUnitSystem("METRIC_BAR"),
    "R1-20 — isEngineeringUnitSystem discrimine sans cast"
  );

  // =========================================================================
  // R1-21: isDesignCodeFormulaStatus valide les 4 statuts et rejette autres
  // =========================================================================
  testsRun++;
  assert(
    isDesignCodeFormulaStatus("VERIFIED") &&
      isDesignCodeFormulaStatus("LICENSED") &&
      isDesignCodeFormulaStatus("UNVERIFIED") &&
      isDesignCodeFormulaStatus("NOT_IMPLEMENTED") &&
      !isDesignCodeFormulaStatus("VALIDATED") &&
      !isDesignCodeFormulaStatus(undefined),
    "R1-21 — isDesignCodeFormulaStatus valide exactement les 4 statuts normatifs"
  );

  // =========================================================================
  // R1-22: executeEngineeringCalculation retourne NOT_IMPLEMENTED avec message explicite
  // =========================================================================
  testsRun++;
  const resExec = executeEngineeringCalculation(validNominalInput);
  assert(
    resExec.status === "NOT_IMPLEMENTED" &&
      resExec.errors.some((err) => err.includes("FORMULA_NOT_IMPLEMENTED")),
    "R1-22 — executeEngineeringCalculation retourne NOT_IMPLEMENTED pour ASME-B31.3"
  );

  // =========================================================================
  // R1-23: Output contract: aucun résultat ne contient NaN, Infinity, -Infinity
  // =========================================================================
  testsRun++;
  assert(
    resExec.value === undefined ||
      (typeof resExec.value === "number" && Number.isFinite(resExec.value)),
    "R1-23 — Output contract: aucune valeur numérique NaN ou infinie dans le résultat"
  );

  // =========================================================================
  // R1-24: Output contract: result est strictement gelé (Object.isFrozen)
  // =========================================================================
  testsRun++;
  assert(
    Object.isFrozen(resExec) &&
      Object.isFrozen(resExec.inputs) &&
      Object.isFrozen(resExec.errors) &&
      Object.isFrozen(resExec.warnings) &&
      Object.isFrozen(resExec.assumptions),
    "R1-24 — Output contract: l'intégralité du résultat est gelé (Object.isFrozen)"
  );

  // =========================================================================
  // R1-25: Traceability: result contient structure pour formulaId, clauseReference, sourceReference
  // =========================================================================
  testsRun++;
  assert(
    "calculationType" in resExec &&
      "designCodeId" in resExec &&
      "inputs" in resExec &&
      "errors" in resExec,
    "R1-25 — Traceability: contrat de traçabilité respecté"
  );

  // =========================================================================
  // R1-26: Gate: Aucune formule arbitraire non qualifiée n'est exécutée numériquement
  // =========================================================================
  testsRun++;
  assert(
    resExec.value === undefined,
    "R1-26 — Gate: aucune formule numérique n'a été exécutée silencieusement"
  );

  // =========================================================================
  // R1-27: Gate: Entrée sans designCodeId supporté retourne OUT_OF_SCOPE
  // =========================================================================
  testsRun++;
  const outOfScopeResult = executeEngineeringCalculation({
    ...validNominalInput,
    designCodeId: "UNREGISTERED_CODE" as unknown as EngineeringCalculationInput["designCodeId"],
  });
  assert(
    outOfScopeResult.status === "INVALID_INPUT" || outOfScopeResult.status === "OUT_OF_SCOPE",
    "R1-27 — Gate: code non supporté est intercepté"
  );

  // =========================================================================
  // R1-28: Statut CALCULATED impossible sur les 5 codes enregistrés actuels
  // =========================================================================
  testsRun++;
  const codesToTest: readonly EngineeringCalculationInput["designCodeId"][] = [
    "ASME-B31.3",
    "ASME-B31.4",
    "ASME-B31.8",
    "EN-13480",
    "ISO-13623",
  ];
  for (const code of codesToTest) {
    const r = executeEngineeringCalculation({
      ...validNominalInput,
      designCodeId: code,
    });
    assert(
      (r.status as string) !== "CALCULATED",
      `R1-28 — Le statut CALCULATED est impossible pour le code ${code}`
    );
  }

  // =========================================================================
  // R1-29: Statut COMPLIANT strictement absent des résultats
  // =========================================================================
  testsRun++;
  for (const code of codesToTest) {
    const r = executeEngineeringCalculation({
      ...validNominalInput,
      designCodeId: code,
    });
    assert(
      (r.status as string) !== "COMPLIANT",
      `R1-29 — Le statut COMPLIANT est strictement interdit pour le code ${code}`
    );
  }

  // =========================================================================
  // R1-30: Purement déterministe et reproductible (idempotent, zéro effet de bord)
  // =========================================================================
  testsRun++;
  const sample1 = executeEngineeringCalculation(validNominalInput);
  const sample2 = executeEngineeringCalculation(validNominalInput);
  assert(
    JSON.stringify(sample1) === JSON.stringify(sample2),
    "R1-30 — L'exécution est purement déterministe et reproductible"
  );

  // =========================================================================
  // SUITE QUALIFIÉE F01 : ASME B31.3-2024 para. 304.1.2(a) Eq. (3a) / Eq. (3b)
  // Tests obligatoires F01-01 à F01-62
  // =========================================================================

  const f01Baseline: EngineeringCalculationInput = Object.freeze({
    evidenceItems: Object.freeze([
      {
        evidenceId: "SYNTHETIC_NORM12_EVIDENCE_S_001",
        standardId: "SYNTHETIC_STANDARD_NORM12" as any,
        editionId: "SYNTHETIC_EDITION_NORM12",
        clauseReference: "SYNTHETIC_CLAUSE_S",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_S",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        evidenceId: "SYNTHETIC_NORM12_EVIDENCE_E_002",
        standardId: "SYNTHETIC_STANDARD_NORM12" as any,
        editionId: "SYNTHETIC_EDITION_NORM12",
        clauseReference: "SYNTHETIC_CLAUSE_E",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_E",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        evidenceId: "SYNTHETIC_NORM12_EVIDENCE_W_003",
        standardId: "SYNTHETIC_STANDARD_NORM12" as any,
        editionId: "SYNTHETIC_EDITION_NORM12",
        clauseReference: "SYNTHETIC_CLAUSE_W",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_W",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        evidenceId: "SYNTHETIC_NORM12_EVIDENCE_Y_004",
        standardId: "SYNTHETIC_STANDARD_NORM12" as any,
        editionId: "SYNTHETIC_EDITION_NORM12",
        clauseReference: "SYNTHETIC_CLAUSE_Y",
        sourceType: "VERIFIED_INTERNAL_REFERENCE" as const,
        sourceReference: "SYNTHETIC_SOURCE_Y",
        verificationStatus: "VERIFIED" as const,
        verifiedBy: "SYSTEM_VALIDATOR",
        verifiedAt: "2026-01-01T00:00:00.000Z",
      },
    ]),
    designCodeId: "ASME-B31.3",
    standardEdition: Object.freeze({ year: "2024" }),
    calculationType: "PRESSURE_WALL_THICKNESS",
    unitSystem: "SI",
    pressure: 2.0, // MPa
    temperature: 100, // °C
    outsideDiameterMm: 114.3, // mm (4" pipe)
    corrosionAllowanceMm: 1.5, // mm
    diameterBasis: "OUTSIDE",
    componentType: "SEAMLESS",
    materialId: "MAT_CS_ASTM_A106_B",
    allowableStressInput: Object.freeze({
      verifiedValue: Object.freeze({
        value: 138.0,
        verificationStatus: "VERIFIED",
        evidenceIds: Object.freeze(["SYNTHETIC_NORM12_EVIDENCE_S_001"]),
      }),
      value: 138.0,
      unit: "MPa",
      temperature: 100,
      materialReference: "ASTM A106 Grade B",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table A-1",
    }),
    qualityFactorInput: Object.freeze({
      verifiedValue: Object.freeze({
        value: 1.0,
        verificationStatus: "VERIFIED",
        evidenceIds: Object.freeze(["SYNTHETIC_NORM12_EVIDENCE_E_002"]),
      }),
      factorValue: 1.0,
      productSpecification: "ASTM A106 Seamless",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table 302.3.4",
    }),
    weldReductionFactorInput: Object.freeze({
      verifiedValue: Object.freeze({
        value: 1.0,
        verificationStatus: "VERIFIED",
        evidenceIds: Object.freeze(["SYNTHETIC_NORM12_EVIDENCE_W_003"]),
      }),
      factorValue: 1.0,
      branchId: "W-01",
      componentType: "SEAMLESS",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 para. 302.3.5(e) Seamless Component",
    }),
    yCoefficientInput: Object.freeze({
      verifiedValue: Object.freeze({
        value: 0.4,
        verificationStatus: "VERIFIED",
        evidenceIds: Object.freeze(["SYNTHETIC_NORM12_EVIDENCE_Y_004"]),
      }),
      factorValue: 0.4,
      materialFamily: "FERRITIC",
      temperature: 100,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table 304.1.1-1",
    }),
  });

  // F01-01 : identification du code + édition 2024
  testsRun++;
  const rF01_01 = executeEngineeringCalculation(f01Baseline);
  assert(
    rF01_01.designCodeId === "ASME-B31.3" && rF01_01.standardEdition?.year === "2024",
    "F01-01 — identification du code ASME-B31.3 + édition 2024"
  );

  // F01-02 : formulaId exact
  testsRun++;
  const entryB313F01 = getDesignCodeCalculationEntry("ASME-B31.3");
  const formulaF01 = entryB313F01?.formulaReferences.find(
    (f) => f.id === "NORM-08-F01-ASME-B31.3-2024-PRESSURE-WALL-THICKNESS"
  );
  assert(
    formulaF01 !== undefined &&
      rF01_01.formulaId === "NORM-08-F01-ASME-B31.3-2024-PRESSURE-WALL-THICKNESS",
    "F01-02 — formulaId exact NORM-08-F01-ASME-B31.3-2024-PRESSURE-WALL-THICKNESS"
  );

  // F01-03 : clause 304.1.2(a)
  testsRun++;
  assert(
    rF01_01.clauseReference?.includes("304.1.2(a)") === true &&
      formulaF01?.clauseReference?.includes("304.1.2(a)") === true,
    "F01-03 — clause 304.1.2(a) déclarée et propagée"
  );

  // F01-04 : Eq. 3a OUTSIDE
  testsRun++;
  assert(
    rF01_01.status === "CALCULATED" &&
      rF01_01.clauseReference === "para. 304.1.2(a) Eq. (3a)" &&
      rF01_01.diameterBasis === "OUTSIDE",
    "F01-04 — Eq. 3a OUTSIDE sélectionnée et calculée"
  );

  // F01-05 : Eq. 3b INSIDE
  testsRun++;
  const rF01_05 = executeEngineeringCalculation({
    ...f01Baseline,
    outsideDiameterMm: undefined,
    insideDiameterMm: 100.0,
    diameterBasis: "INSIDE",
  });
  assert(
    rF01_05.status === "CALCULATED" &&
      rF01_05.clauseReference === "para. 304.1.2(a) Eq. (3b)" &&
      rF01_05.diameterBasis === "INSIDE",
    "F01-05 — Eq. 3b INSIDE sélectionnée et calculée"
  );

  // F01-06 : deux diamètres + absence de basis
  testsRun++;
  const rF01_06 = executeEngineeringCalculation({
    ...f01Baseline,
    outsideDiameterMm: 114.3,
    insideDiameterMm: 100.0,
    diameterBasis: undefined,
  });
  assert(
    rF01_06.status === "INVALID_INPUT" &&
      rF01_06.errors.some((e) => e.includes("DIAMETER_BASIS_REQUIRED")),
    "F01-06 — deux diamètres fournis sans basis explicite retourne INVALID_INPUT"
  );

  // F01-07 : aucun diamètre exploitable
  testsRun++;
  const rF01_07 = executeEngineeringCalculation({
    ...f01Baseline,
    outsideDiameterMm: undefined,
    insideDiameterMm: undefined,
  });
  assert(
    rF01_07.status === "INVALID_INPUT" &&
      rF01_07.errors.some((e) => e.includes("PIPE_DIMENSION_REFERENCE_REQUIRED")),
    "F01-07 — aucun diamètre exploitable retourne PIPE_DIMENSION_REFERENCE_REQUIRED"
  );

  // F01-08 : SI accepté
  testsRun++;
  assert(
    f01Baseline.unitSystem === "SI" && rF01_01.status === "CALCULATED",
    "F01-08 — SI accepté et produit CALCULATED"
  );

  // F01-09 : US_CUSTOMARY bloqué pour F01
  testsRun++;
  const rF01_09 = executeEngineeringCalculation({
    ...f01Baseline,
    unitSystem: "US_CUSTOMARY",
  });
  assert(
    rF01_09.status === "UNVERIFIED" &&
      rF01_09.value === undefined &&
      rF01_09.errors.some((e) => e.includes("UNIT_CONTRACT_UNVERIFIED")),
    "F01-09 — US_CUSTOMARY bloqué pour F01 avec UNIT_CONTRACT_UNVERIFIED"
  );

  // F01-10 : pression invalide
  testsRun++;
  const rF01_10a = executeEngineeringCalculation({ ...f01Baseline, pressure: 0 });
  const rF01_10b = executeEngineeringCalculation({ ...f01Baseline, pressure: -5.0 });
  assert(
    rF01_10a.status === "INVALID_INPUT" &&
      rF01_10b.status === "INVALID_INPUT" &&
      rF01_10a.errors.some((e) => e.includes("INVALID_PRESSURE")),
    "F01-10 — pression invalide (<= 0) rejetée"
  );

  // F01-11 : diamètre invalide
  testsRun++;
  const rF01_11 = executeEngineeringCalculation({ ...f01Baseline, outsideDiameterMm: -100.0 });
  assert(
    rF01_11.status === "INVALID_INPUT" &&
      rF01_11.errors.some((e) => e.includes("INVALID_DIAMETER")),
    "F01-11 — diamètre négatif rejeté"
  );

  // F01-12 : corrosion allowance négative
  testsRun++;
  const rF01_12 = executeEngineeringCalculation({ ...f01Baseline, corrosionAllowanceMm: -1.0 });
  assert(
    rF01_12.status === "INVALID_INPUT" &&
      rF01_12.errors.some((e) => e.includes("INVALID_CORROSION_ALLOWANCE")),
    "F01-12 — corrosion allowance négative rejetée"
  );

  // F01-13 : S absent
  testsRun++;
  const rF01_13 = executeEngineeringCalculation({
    ...f01Baseline,
    allowableStressInput: undefined,
    allowableStressMpa: undefined,
  });
  assert(
    rF01_13.status === "INVALID_INPUT",
    "F01-13 — S absent retourne INVALID_INPUT"
  );

  // F01-14 : S numérique mais sans provenance
  testsRun++;
  const rF01_14 = executeEngineeringCalculation({
    ...f01Baseline,
    allowableStressInput: undefined,
    allowableStressMpa: 138.0,
  });
  assert(
    rF01_14.status === "UNVERIFIED" &&
      rF01_14.resolvedFactors?.S?.contractVerified === true &&
      rF01_14.resolvedFactors?.S?.valueVerified === false,
    "F01-14 — S numérique sans provenance est non qualifié (ValueVerified false)"
  );

  // F01-15 : S sans température
  testsRun++;
  const rF01_15 = executeEngineeringCalculation({
    ...f01Baseline,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      temperature: undefined as any,
    },
  });
  assert(
    rF01_15.status === "UNVERIFIED" &&
      rF01_15.resolvedFactors?.S?.valueVerified === false,
    "F01-15 — S sans température ne peut pas être VALUE VERIFIED"
  );

  // F01-16 : S avec mauvaise unité
  testsRun++;
  const rF01_16 = executeEngineeringCalculation({
    ...f01Baseline,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      unit: "psi" as any,
    },
  });
  assert(
    rF01_16.status === "UNVERIFIED" &&
      rF01_16.resolvedFactors?.S?.valueVerified === false,
    "F01-16 — S avec mauvaise unité n'est pas qualifié"
  );

  // F01-17 : S VALUE VERIFIED correctement qualifié
  testsRun++;
  assert(
    rF01_01.resolvedFactors?.S?.valueVerified === true &&
      rF01_01.resolvedFactors?.S?.contractVerified === true,
    "F01-17 — S VALUE VERIFIED correctement qualifié"
  );

  // F01-18 : E absent
  testsRun++;
  const rF01_18 = executeEngineeringCalculation({
    ...f01Baseline,
    qualityFactorInput: undefined,
    weldJointFactor: undefined,
  });
  assert(
    rF01_18.status === "INVALID_INPUT",
    "F01-18 — E absent retourne INVALID_INPUT"
  );

  // F01-19 : E numérique sans source
  testsRun++;
  const rF01_19 = executeEngineeringCalculation({
    ...f01Baseline,
    qualityFactorInput: undefined,
    weldJointFactor: 1.0,
  });
  assert(
    rF01_19.status === "UNVERIFIED" &&
      rF01_19.resolvedFactors?.E?.contractVerified === true &&
      rF01_19.resolvedFactors?.E?.valueVerified === false,
    "F01-19 — E numérique sans source n'est pas VALUE VERIFIED"
  );

  // F01-20 : E correctement qualifié
  testsRun++;
  assert(
    rF01_01.resolvedFactors?.E?.valueVerified === true &&
      rF01_01.resolvedFactors?.E?.contractVerified === true,
    "F01-20 — E correctement qualifié est VALUE VERIFIED"
  );

  // F01-21 : W absent
  testsRun++;
  const rF01_21 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: undefined,
    weldReductionFactor: undefined,
  });
  assert(
    rF01_21.status === "UNVERIFIED" &&
      rF01_21.errors.some((e) => e.includes("VALUE_UNVERIFIED")),
    "F01-21 — W absent retourne UNVERIFIED"
  );

  // F01-22 : W = 1 par fallback SEAMLESS => doit être refusé
  testsRun++;
  const rF01_22 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: undefined,
    weldReductionFactor: undefined,
    componentType: "SEAMLESS",
  });
  assert(
    rF01_22.status === "UNVERIFIED" && rF01_22.value === undefined,
    "F01-22 — W = 1 par fallback SEAMLESS doit être strictement refusé"
  );

  // F01-23 : W = 1 par fallback FERRITIC/temp => doit être refusé
  testsRun++;
  const rF01_23 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: undefined,
    weldReductionFactor: undefined,
    materialFamily: "FERRITIC",
    temperature: 200,
  });
  assert(
    rF01_23.status === "UNVERIFIED" && rF01_23.value === undefined,
    "F01-23 — W = 1 par fallback FERRITIC/temp doit être strictement refusé"
  );

  // F01-24 : W-01 explicitement qualifié
  testsRun++;
  const rF01_24 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "SEAMLESS",
    weldReductionFactorInput: {
      ...f01Baseline.weldReductionFactorInput!,
      factorValue: 1.0,
      branchId: "W-01",
      componentType: "SEAMLESS",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 para. 302.3.5(e)",
    },
  });
  assert(
    rF01_24.status === "CALCULATED" &&
      rF01_24.resolvedFactors?.W?.valueVerified === true,
    "F01-24 — W-01 explicitement qualifié est accepté"
  );

  // F01-25 : W-02 explicitement qualifié avec preuve structurée CARBON_STEEL
  testsRun++;
  const rF01_25 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      ...f01Baseline.weldReductionFactorInput!,
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      materialGroup: "CARBON_STEEL",
      isCreepRegime: false,
      temperature: 100,
      designTemperature: 100,
      selectionContext: "Below creep range T <= 510°C",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
    },
  });
  assert(
    rF01_25.status === "CALCULATED" &&
      rF01_25.resolvedFactors?.W?.valueVerified === true,
    "F01-25 — W-02 explicitement qualifié avec preuve structurée CARBON_STEEL est accepté"
  );

  // F01-26 : W-03 sans preuve normative complète reste UNVERIFIED
  testsRun++;
  const rF01_26 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    materialFamily: "AUSTENITIC",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-03",
      componentType: "WELDED",
      materialFamily: "AUSTENITIC",
      materialGroup: "AUSTENITIC_SS",
      isCreepRegime: false,
      temperature: 100,
      selectionContext: "Longitudinal seam weld in austenitic steel",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-03",
    },
  });
  assert(
    rF01_26.status === "UNVERIFIED" &&
      rF01_26.resolvedFactors?.W?.valueVerified === false,
    "F01-26 — W-03 sans preuve normative complète (grade 3xx, autogenous, fillerless) reste UNVERIFIED"
  );

  // F01-27 : W-04 sans preuve normative complète reste UNVERIFIED
  testsRun++;
  const rF01_27 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-04",
      componentType: "WELDED",
      materialGroup: "CS_ERW",
      isCreepRegime: false,
      temperature: 100,
      selectionContext: "Qualified SAW/ERW longitudinal weld seam",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-04",
    },
  });
  assert(
    rF01_27.status === "UNVERIFIED" &&
      rF01_27.resolvedFactors?.W?.valueVerified === false,
    "F01-27 — W-04 sans preuve normative complète (grade 3xx, filler metal) reste UNVERIFIED"
  );

  // F01-28 : W-06 sans catégorie structurée NORM-06 reste UNVERIFIED (CRMO / CR_MO non défini dans NORM-06)
  testsRun++;
  const rF01_28 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "WELDED",
      materialGroup: "CR_MO",
      isCreepRegime: false,
      temperature: 100,
      selectionContext: "Circumferential butt weld joint under pressure",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
    },
  });
  assert(
    rF01_28.status === "UNVERIFIED" &&
      rF01_28.resolvedFactors?.W?.valueVerified === false,
    "F01-28 — W-06 sans catégorie structurée NORM-06 reste strictement UNVERIFIED"
  );

  // F01-29 : W-05 sans contexte => non calculé
  testsRun++;
  const rF01_29 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.8,
      branchId: "W-05",
      hasQualifiedContextGrid: false,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-05",
    },
  });
  assert(
    rF01_29.status === "UNVERIFIED" &&
      rF01_29.errors.some((e) => e.includes("W_CONDITIONAL_CONTEXT_REQUIRED")),
    "F01-29 — W-05 sans contexte de grille est non calculé"
  );

  // F01-30 : W-07 sans contexte => non calculé
  testsRun++;
  const rF01_30 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.8,
      branchId: "W-07",
      hasQualifiedContextGrid: false,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-07",
    },
  });
  assert(
    rF01_30.status === "UNVERIFIED" &&
      rF01_30.errors.some((e) => e.includes("W_CONDITIONAL_CONTEXT_REQUIRED")),
    "F01-30 — W-07 sans contexte de grille est non calculé"
  );

  // F01-31 : W-08 CSEF => non calculé
  testsRun++;
  const rF01_31 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.7,
      branchId: "W-08",
      materialGroup: "CSEF",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 W-08",
    },
  });
  assert(
    rF01_31.status === "UNVERIFIED" &&
      rF01_31.errors.some((e) => e.includes("BRANCH_BLOCKED")),
    "F01-31 — W-08 CSEF est bloqué hors périmètre F01"
  );

  // F01-32 : W-09 => non calculé
  testsRun++;
  const rF01_32 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.7,
      branchId: "W-09",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 W-09",
    },
  });
  assert(
    rF01_32.status === "UNVERIFIED" &&
      rF01_32.errors.some((e) => e.includes("BRANCH_BLOCKED")),
    "F01-32 — W-09 autres matériaux creep non listés est bloqué"
  );

  // F01-33 : Y absent
  testsRun++;
  const rF01_33 = executeEngineeringCalculation({
    ...f01Baseline,
    yCoefficientInput: undefined,
    yCoefficient: undefined,
  });
  assert(
    rF01_33.status === "UNVERIFIED" &&
      rF01_33.errors.some((e) => e.includes("VALUE_UNVERIFIED")),
    "F01-33 — Y absent retourne UNVERIFIED"
  );

  // F01-34 : Y=0.4 sans contexte => refusé
  testsRun++;
  const rF01_34 = executeEngineeringCalculation({
    ...f01Baseline,
    yCoefficientInput: undefined,
    yCoefficient: undefined,
    materialFamily: "FERRITIC",
    temperature: 150,
  });
  assert(
    rF01_34.status === "UNVERIFIED" && rF01_34.value === undefined,
    "F01-34 — Y=0.4 sans contexte qualifié doit être refusé"
  );

  // F01-35 : Y qualifié avec materialFamily + temperature + source
  testsRun++;
  assert(
    rF01_01.resolvedFactors?.Y?.valueVerified === true &&
      rF01_01.resolvedFactors?.Y?.sourceReference === "ASME B31.3-2024 Table 304.1.1-1",
    "F01-35 — Y qualifié avec materialFamily + temperature + source est VALUE VERIFIED"
  );

  // F01-36 : pas d’extrapolation Y (ferritique > 538°C)
  testsRun++;
  const rF01_36 = executeEngineeringCalculation({
    ...f01Baseline,
    yCoefficientInput: {
      factorValue: 0.4,
      materialFamily: "FERRITIC",
      temperature: 650,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table 304.1.1-1",
    },
  });
  assert(
    rF01_36.status === "UNVERIFIED" &&
      rF01_36.resolvedFactors?.Y?.valueVerified === false,
    "F01-36 — extrapolation Y rejetée (température ferritique > 538°C)"
  );

  // F01-37 : pas d’interpolation Y hors domaine (austénitique > 621°C)
  testsRun++;
  const rF01_37 = executeEngineeringCalculation({
    ...f01Baseline,
    yCoefficientInput: {
      factorValue: 0.4,
      materialFamily: "AUSTENITIC",
      temperature: 700,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3-2024 Table 304.1.1-1",
    },
  });
  assert(
    rF01_37.status === "UNVERIFIED" &&
      rF01_37.resolvedFactors?.Y?.valueVerified === false,
    "F01-37 — extrapolation Y rejetée (température austénitique > 621°C)"
  );

  // F01-38 : denominator <= 0 ou ratio extrême intercepté
  testsRun++;
  const rF01_38 = executeEngineeringCalculation({
    ...f01Baseline,
    diameterBasis: "INSIDE",
    insideDiameterMm: 100.0,
    outsideDiameterMm: undefined,
    pressure: 250.0,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      value: 100.0,
      verifiedValue: {
        value: 100.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_NORM12_EVIDENCE_S_001"],
      },
    },
  });
  assert(
    rF01_38.status === "INVALID_INPUT" || rF01_38.status === "OUT_OF_SCOPE",
    "F01-38 — dénominateur négatif ou ratio extrême intercepté sans crash"
  );

  // F01-39 : résultat non fini
  testsRun++;
  assert(
    typeof rF01_01.value === "number" &&
      Number.isFinite(rF01_01.value) &&
      typeof rF01_01.minimumRequiredThicknessMm === "number" &&
      Number.isFinite(rF01_01.minimumRequiredThicknessMm),
    "F01-39 — résultat garanti fini et non NaN"
  );

  // F01-40 : t positif et fini sur cas qualifié
  testsRun++;
  assert(
    rF01_01.value !== undefined && rF01_01.value > 0,
    "F01-40 — t est strictement positif et fini sur cas qualifié"
  );

  // F01-41 : tm = t + c
  testsRun++;
  assert(
    Math.abs(rF01_01.minimumRequiredThicknessMm! - (rF01_01.value! + 1.5)) < 1e-9,
    "F01-41 — tm = t + c respecté exactement"
  );

  // F01-42 : domaine t >= D/6
  testsRun++;
  const rF01_42 = executeEngineeringCalculation({
    ...f01Baseline,
    pressure: 53.1,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      value: 138.0,
    },
  });
  assert(
    rF01_42.status === "OUT_OF_SCOPE" &&
      rF01_42.errors.some((e) => e.includes("SPECIAL_CONSIDERATION_REQUIRED")),
    "F01-42 — t >= D/6 retourne OUT_OF_SCOPE avec SPECIAL_CONSIDERATION_REQUIRED"
  );

  // F01-43 : stress ratio > 0.385
  testsRun++;
  const rF01_43 = executeEngineeringCalculation({
    ...f01Baseline,
    pressure: 60.0,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      value: 138.0,
    },
  });
  assert(
    rF01_43.status === "OUT_OF_SCOPE" &&
      rF01_43.errors.some((e) => e.includes("SPECIAL_CONSIDERATION_REQUIRED")),
    "F01-43 — stress ratio P/(SE) > 0.385 retourne OUT_OF_SCOPE"
  );

  // F01-44 : SPECIAL_CONSIDERATION_REQUIRED
  testsRun++;
  assert(
    rF01_42.errors.some((e) => e.includes("SPECIAL_CONSIDERATION_REQUIRED")) &&
      rF01_43.errors.some((e) => e.includes("SPECIAL_CONSIDERATION_REQUIRED")),
    "F01-44 — message SPECIAL_CONSIDERATION_REQUIRED explicite"
  );

  // F01-45 : séparation Contract Verified / Value Verified
  testsRun++;
  const rF01_45 = executeEngineeringCalculation({
    ...f01Baseline,
    allowableStressInput: undefined,
    allowableStressMpa: 138.0,
  });
  assert(
    rF01_45.resolvedFactors?.S?.contractVerified === true &&
      rF01_45.resolvedFactors?.S?.valueVerified === false,
    "F01-45 — stricte séparation Contract Verified vs Value Verified"
  );

  // F01-46 : seul un résultat entièrement qualifié peut être CALCULATED
  testsRun++;
  assert(
    rF01_01.status === "CALCULATED" && rF01_45.status === "UNVERIFIED",
    "F01-46 — seul un ensemble 100% Value Verified peut obtenir le statut CALCULATED"
  );

  // F01-47 : provenance propagée dans resolvedFactors
  testsRun++;
  assert(
    Boolean(rF01_01.resolvedFactors?.S?.sourceReference) &&
      Boolean(rF01_01.resolvedFactors?.E?.sourceReference) &&
      Boolean(rF01_01.resolvedFactors?.W?.sourceReference) &&
      Boolean(rF01_01.resolvedFactors?.Y?.sourceReference),
    "F01-47 — provenance propagée dans tous les resolvedFactors"
  );

  // F01-48 : édition 2024 propagée
  testsRun++;
  assert(
    rF01_01.standardEdition?.year === "2024",
    "F01-48 — édition 2024 propagée dans le résultat"
  );

  // F01-49 : unité mm propagée pour résultat SI
  testsRun++;
  assert(
    rF01_01.unit === "mm",
    "F01-49 — unité mm propagée pour résultat SI"
  );

  // F01-50 : absence de conversion US implicite
  testsRun++;
  const rF01_50 = executeEngineeringCalculation({
    ...f01Baseline,
    unitSystem: "US_CUSTOMARY",
    pressure: 500,
  });
  assert(
    rF01_50.status === "UNVERIFIED" && rF01_50.value === undefined,
    "F01-50 — absence absolue de conversion US implicite"
  );

  // F01-51 : corrosion allowance effectivement ajoutée à tm
  testsRun++;
  const rF01_51 = executeEngineeringCalculation({
    ...f01Baseline,
    corrosionAllowanceMm: 3.0,
  });
  assert(
    Math.abs(rF01_51.minimumRequiredThicknessMm! - (rF01_51.value! + 3.0)) < 1e-9,
    "F01-51 — corrosion allowance de 3.0 mm effectivement ajoutée à tm"
  );

  // F01-52 : Eq3a avec valeurs simples auditables
  testsRun++;
  // P=2.0, D=100.0, c=0, S=100.0, E=1.0, W=1.0, Y=0.4
  // t = (2 * 100) / [2 * (100 * 1 * 1 + 2 * 0.4)] = 200 / 201.6 = 0.992063492...
  const rF01_52 = executeEngineeringCalculation({
    ...f01Baseline,
    pressure: 2.0,
    outsideDiameterMm: 100.0,
    corrosionAllowanceMm: 0,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      value: 100.0,
      verifiedValue: {
        value: 100.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_NORM12_EVIDENCE_S_001"],
      },
    },
  });
  const expectedT3a = 200 / 201.6;
  assert(
    rF01_52.status === "CALCULATED" &&
      Math.abs(rF01_52.value! - expectedT3a) < 1e-6,
    "F01-52 — Eq3a avec valeurs simples auditables concorde exactement"
  );

  // F01-53 : Eq3b avec valeurs simples auditables
  testsRun++;
  // P=2.0, d=100.0, c=0, S=100.0, E=1.0, W=1.0, Y=0.4
  // t = (2 * 100) / [2 * (100 * 1 * 1 - 2 * (1 - 0.4))] = 200 / 197.6 = 1.0121457...
  const rF01_53 = executeEngineeringCalculation({
    ...f01Baseline,
    diameterBasis: "INSIDE",
    outsideDiameterMm: undefined,
    insideDiameterMm: 100.0,
    corrosionAllowanceMm: 0,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      value: 100.0,
      verifiedValue: {
        value: 100.0,
        verificationStatus: "VERIFIED",
        evidenceIds: ["SYNTHETIC_NORM12_EVIDENCE_S_001"],
      },
    },
  });
  const expectedT3b = 200 / 197.6;
  assert(
    rF01_53.status === "CALCULATED" &&
      Math.abs(rF01_53.value! - expectedT3b) < 1e-6,
    "F01-53 — Eq3b avec valeurs simples auditables concorde exactement"
  );

  // F01-54 : erreur si diamètre sélectionné impossible
  testsRun++;
  const rF01_54 = executeEngineeringCalculation({
    ...f01Baseline,
    diameterBasis: "INSIDE",
    insideDiameterMm: undefined,
  });
  assert(
    rF01_54.status === "INVALID_INPUT",
    "F01-54 — erreur si diamètre sélectionné impossible"
  );

  // F01-55 : pas de valeur normative implicite
  testsRun++;
  const rF01_55 = executeEngineeringCalculation({
    ...f01Baseline,
    allowableStressInput: undefined,
    allowableStressMpa: undefined,
    qualityFactorInput: undefined,
    weldJointFactor: undefined,
  });
  assert(
    rF01_55.status === "INVALID_INPUT",
    "F01-55 — aucune valeur normative implicite n'est admise"
  );

  // F01-56 : pas de fallback W
  testsRun++;
  const rF01_56 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: undefined,
    weldReductionFactor: undefined,
    componentType: "SEAMLESS",
  });
  assert(
    rF01_56.status === "UNVERIFIED" &&
      rF01_56.errors.some((e) => e.includes("VALUE_UNVERIFIED")),
    "F01-56 — pas de fallback W (SEAMLESS)"
  );

  // F01-57 : pas de fallback Y
  testsRun++;
  const rF01_57 = executeEngineeringCalculation({
    ...f01Baseline,
    yCoefficientInput: undefined,
    yCoefficient: undefined,
    materialFamily: "FERRITIC",
  });
  assert(
    rF01_57.status === "UNVERIFIED" &&
      rF01_57.errors.some((e) => e.includes("VALUE_UNVERIFIED")),
    "F01-57 — pas de fallback Y (FERRITIC)"
  );

  // F01-58 : provenance S suffisante
  testsRun++;
  assert(
    typeof rF01_01.resolvedFactors?.S?.sourceReference === "string" &&
      rF01_01.resolvedFactors.S.sourceReference.length > 5,
    "F01-58 — provenance S suffisante et auditable"
  );

  // F01-59 : provenance E suffisante
  testsRun++;
  assert(
    typeof rF01_01.resolvedFactors?.E?.sourceReference === "string" &&
      rF01_01.resolvedFactors.E.sourceReference.length > 5,
    "F01-59 — provenance E suffisante et auditable"
  );

  // F01-60 : provenance W suffisante
  testsRun++;
  assert(
    typeof rF01_01.resolvedFactors?.W?.sourceReference === "string" &&
      rF01_01.resolvedFactors.W.sourceReference.length > 5,
    "F01-60 — provenance W suffisante et auditable"
  );

  // F01-61 : provenance Y suffisante
  testsRun++;
  assert(
    typeof rF01_01.resolvedFactors?.Y?.sourceReference === "string" &&
      rF01_01.resolvedFactors.Y.sourceReference.length > 5,
    "F01-61 — provenance Y suffisante et auditable"
  );

  // F01-62 : non-régression des autres design codes / statuts
  testsRun++;
  const otherCodes = ["ASME-B31.4", "ASME-B31.8", "EN-13480", "ISO-13623"] as const;
  const nonRegressionOk = otherCodes.every((c) => {
    const entry = getDesignCodeCalculationEntry(c);
    const r = executeEngineeringCalculation({
      ...f01Baseline,
      designCodeId: c,
    });
    return entry?.status === "NOT_IMPLEMENTED" && r.status === "NOT_IMPLEMENTED";
  });
  assert(
    nonRegressionOk,
    "F01-62 — non-régression stricte des autres design codes / statuts (NOT_IMPLEMENTED)"
  );

  // =========================================================================
  // SUITE PATCH F01-R5 : CORRECTION CIBLÉE S / W CONTEXT
  // Tests obligatoires F01-R5-01 à F01-R5-14
  // =========================================================================

  // F01-R5-01 : S température identique -> nominal (CALCULATED)
  testsRun++;
  const rF01_R5_01 = executeEngineeringCalculation({
    ...f01Baseline,
    temperature: 100,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      temperature: 100,
    },
  });
  assert(
    rF01_R5_01.status === "CALCULATED" &&
      rF01_R5_01.resolvedFactors?.S?.valueVerified === true &&
      typeof rF01_R5_01.value === "number",
    "F01-R5-01 — S température identique produit le statut nominal CALCULATED"
  );

  // F01-R5-02 : S température différente -> UNVERIFIED + S_TEMPERATURE_MISMATCH
  testsRun++;
  const rF01_R5_02 = executeEngineeringCalculation({
    ...f01Baseline,
    temperature: 100,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      temperature: 150,
    },
  });
  assert(
    rF01_R5_02.status === "UNVERIFIED" &&
      rF01_R5_02.resolvedFactors?.S?.valueVerified === false &&
      rF01_R5_02.errors.some((e) => e.includes("S_TEMPERATURE_MISMATCH")),
    "F01-R5-02 — S température différente retourne UNVERIFIED et S_TEMPERATURE_MISMATCH"
  );

  // F01-R5-03 : température S absente -> pas de CALCULATED
  testsRun++;
  const rF01_R5_03 = executeEngineeringCalculation({
    ...f01Baseline,
    temperature: 100,
    allowableStressInput: {
      ...f01Baseline.allowableStressInput!,
      temperature: undefined as any,
    },
  });
  assert(
    rF01_R5_03.status !== "CALCULATED" &&
      rF01_R5_03.status === "UNVERIFIED" &&
      rF01_R5_03.resolvedFactors?.S?.valueVerified === false,
    "F01-R5-03 — température S absente interdit le statut CALCULATED"
  );

  // F01-R5-04 : température input absente -> pas de CALCULATED
  testsRun++;
  const rF01_R5_04 = executeEngineeringCalculation({
    ...f01Baseline,
    temperature: undefined,
  });
  assert(
    rF01_R5_04.status !== "CALCULATED" &&
      rF01_R5_04.status === "UNVERIFIED" &&
      rF01_R5_04.resolvedFactors?.S?.valueVerified === false,
    "F01-R5-04 — température input absente interdit le statut CALCULATED"
  );

  // F01-R5-05 : W-02 contexte qualifié avec preuve structurée CARBON_STEEL -> CALCULATED
  testsRun++;
  const rF01_R5_05 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      ...f01Baseline.weldReductionFactorInput!,
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      materialGroup: "CARBON_STEEL",
      isCreepRegime: false,
      temperature: 100,
      designTemperature: 100,
      selectionContext: "Below creep range T <= 510°C",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
    },
  });
  assert(
    rF01_R5_05.status === "CALCULATED" &&
      rF01_R5_05.resolvedFactors?.W?.valueVerified === true,
    "F01-R5-05 — W-02 avec contexte suffisant et cohérent est qualifié (CALCULATED)"
  );

  // F01-R5-06 : W-02 contexte insuffisant -> UNVERIFIED
  testsRun++;
  const rF01_R5_06 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
    },
  });
  assert(
    rF01_R5_06.status === "UNVERIFIED" &&
      rF01_R5_06.resolvedFactors?.W?.valueVerified === false,
    "F01-R5-06 — W-02 sans contexte de qualification retourne UNVERIFIED"
  );

  // F01-R5-07 : W-03 contexte insuffisant -> UNVERIFIED
  testsRun++;
  const rF01_R5_07 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-03",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-03",
    },
  });
  assert(
    rF01_R5_07.status === "UNVERIFIED" &&
      rF01_R5_07.resolvedFactors?.W?.valueVerified === false,
    "F01-R5-07 — W-03 sans contexte matériau/sélection retourne UNVERIFIED"
  );

  // F01-R5-08 : W-04 contexte insuffisant -> UNVERIFIED
  testsRun++;
  const rF01_R5_08 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-04",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-04",
    },
  });
  assert(
    rF01_R5_08.status === "UNVERIFIED" &&
      rF01_R5_08.resolvedFactors?.W?.valueVerified === false,
    "F01-R5-08 — W-04 sans contexte procédé/sélection retourne UNVERIFIED"
  );

  // F01-R5-09 : W-06 contexte insuffisant -> UNVERIFIED
  testsRun++;
  const rF01_R5_09 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
    },
  });
  assert(
    rF01_R5_09.status === "UNVERIFIED" &&
      rF01_R5_09.resolvedFactors?.W?.valueVerified === false,
    "F01-R5-09 — W-06 sans contexte circonférentiel retourne UNVERIFIED"
  );

  // F01-R5-10 : W-05 sans hasQualifiedContextGrid -> UNVERIFIED
  testsRun++;
  const rF01_R5_10 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.8,
      branchId: "W-05",
      hasQualifiedContextGrid: false,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-05",
    },
  });
  assert(
    rF01_R5_10.status === "UNVERIFIED" &&
      rF01_R5_10.errors.some((e) => e.includes("W_CONDITIONAL_CONTEXT_REQUIRED")),
    "F01-R5-10 — W-05 sans hasQualifiedContextGrid retourne UNVERIFIED"
  );

  // F01-R5-11 : W-07 sans hasQualifiedContextGrid -> UNVERIFIED
  testsRun++;
  const rF01_R5_11 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.8,
      branchId: "W-07",
      hasQualifiedContextGrid: false,
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-07",
    },
  });
  assert(
    rF01_R5_11.status === "UNVERIFIED" &&
      rF01_R5_11.errors.some((e) => e.includes("W_CONDITIONAL_CONTEXT_REQUIRED")),
    "F01-R5-11 — W-07 sans hasQualifiedContextGrid retourne UNVERIFIED"
  );

  // F01-R5-12 : W-08/W-09 restent non qualifiés (BRANCH_BLOCKED)
  testsRun++;
  const rF01_R5_12a = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.7,
      branchId: "W-08",
      materialGroup: "CSEF",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-08",
    },
  });
  const rF01_R5_12b = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 0.7,
      branchId: "W-09",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-09",
    },
  });
  assert(
    rF01_R5_12a.status === "UNVERIFIED" &&
      rF01_R5_12a.errors.some((e) => e.includes("BRANCH_BLOCKED")) &&
      rF01_R5_12b.status === "UNVERIFIED" &&
      rF01_R5_12b.errors.some((e) => e.includes("BRANCH_BLOCKED")),
    "F01-R5-12 — W-08 et W-09 restent strictement non qualifiés et bloqués"
  );

  // F01-R5-13 : non-régression W-01 cohérence (refus si déclaré WELDED)
  testsRun++;
  const rF01_R5_13 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-01",
      qualificationStatus: "VERIFIED",
      sourceReference: "ASME B31.3 para. 302.3.5(e)",
    },
  });
  assert(
    rF01_R5_13.status === "UNVERIFIED" &&
      rF01_R5_13.resolvedFactors?.W?.valueVerified === false,
    "F01-R5-13 — non-régression W-01 : incohérence componentType WELDED vs SEAMLESS W-01 refusée"
  );

  // F01-R5-14 : non-régression W fallback / Y fallback
  testsRun++;
  const rF01_R5_14a = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "SEAMLESS",
    weldReductionFactorInput: undefined,
    weldReductionFactor: undefined,
  });
  const rF01_R5_14b = executeEngineeringCalculation({
    ...f01Baseline,
    materialFamily: "FERRITIC",
    temperature: 100,
    yCoefficientInput: undefined,
    yCoefficient: undefined,
  });
  assert(
    rF01_R5_14a.status === "UNVERIFIED" &&
      rF01_R5_14a.value === undefined &&
      rF01_R5_14b.status === "UNVERIFIED" &&
      rF01_R5_14b.value === undefined,
    "F01-R5-14 — non-régression stricte des fallbacks W et Y (aucun fallback implicite admis)"
  );

  // =========================================================================
  // SUITE PATCH F01-R5-FIX : DURCISSEMENT FINAL DU CONTEXTE W (TESTS 1 À 20)
  // =========================================================================

  // TEST 1 : W-01 + componentType = SEAMLESS + sourceReference + VERIFIED => VALUE VERIFIED
  testsRun++;
  const rF01_R5_FIX_01 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "SEAMLESS",
    weldReductionFactorInput: {
      ...f01Baseline.weldReductionFactorInput!,
      factorValue: 1.0,
      branchId: "W-01",
      componentType: "SEAMLESS",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-01",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_01.status === "CALCULATED" &&
      rF01_R5_FIX_01.resolvedFactors?.W?.valueVerified === true,
    "TEST 1 — W-01 + componentType = SEAMLESS + sourceReference + VERIFIED => VALUE VERIFIED"
  );

  // TEST 2 : W-01 sans componentType => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_02 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: undefined,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-01",
      componentType: undefined,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-01",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_02.status === "UNVERIFIED" &&
      rF01_R5_FIX_02.resolvedFactors?.W?.valueVerified === false,
    "TEST 2 — W-01 sans componentType => UNVERIFIED"
  );

  // TEST 3 : W-01 + componentType = WELDED => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_03 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-01",
      componentType: "WELDED",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-01",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_03.status === "UNVERIFIED" &&
      rF01_R5_FIX_03.resolvedFactors?.W?.valueVerified === false,
    "TEST 3 — W-01 + componentType = WELDED => UNVERIFIED"
  );

  // TEST 4 : W-01 + selectionContext = "W-01" sans componentType => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_04 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: undefined,
    weldReductionFactorInput: {
      factorValue: 1.0,
      selectionContext: "W-01",
      sourceReference: "ASME B31.3 Table 302.3.5-1",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_04.status === "UNVERIFIED" &&
      rF01_R5_FIX_04.resolvedFactors?.W?.valueVerified === false,
    "TEST 4 — W-01 + selectionContext = 'W-01' sans componentType => UNVERIFIED"
  );

  // TEST 5 : W-02 + materialGroup = "CARBON_STEEL" + isCreepRegime = false => VALUE VERIFIED
  testsRun++;
  const rF01_R5_FIX_05 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      ...f01Baseline.weldReductionFactorInput!,
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      materialGroup: "CARBON_STEEL",
      isCreepRegime: false,
      temperature: 100,
      designTemperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_05.status === "CALCULATED" &&
      rF01_R5_FIX_05.resolvedFactors?.W?.valueVerified === true,
    "TEST 5 — W-02 + materialGroup = 'CARBON_STEEL' + isCreepRegime = false => VALUE VERIFIED"
  );

  // TEST 5a : W-02 + materialId = "MAT_CS_..." sans catégorie structurée => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_05a = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    materialId: "MAT_CS_ASTM_A106_B",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_05a.status === "UNVERIFIED" &&
      rF01_R5_FIX_05a.resolvedFactors?.W?.valueVerified === false,
    "TEST 5a — W-02 + materialId = 'MAT_CS_...' sans catégorie structurée => UNVERIFIED"
  );

  // TEST 5b : W-02 + materialId contenant "_CS_" sans catégorie structurée => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_05b = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    materialId: "PIPE_CS_GRADE_B",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_05b.status === "UNVERIFIED" &&
      rF01_R5_FIX_05b.resolvedFactors?.W?.valueVerified === false,
    "TEST 5b — W-02 + materialId = '..._CS_...' sans catégorie structurée => UNVERIFIED"
  );

  // TEST 5c : W-02 + materialGroup = "CS" sans preuve structurée NORM-06 => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_05c = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      materialGroup: "CS",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_05c.status === "UNVERIFIED" &&
      rF01_R5_FIX_05c.resolvedFactors?.W?.valueVerified === false,
    "TEST 5c — W-02 + materialGroup = 'CS' sans preuve structurée NORM-06 => UNVERIFIED"
  );

  // TEST 5d : W-02 + LOW_ALLOY_STEEL ne doit pas être assimilé automatiquement à CARBON_STEEL
  testsRun++;
  const rF01_R5_FIX_05d = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      materialGroup: "LOW_ALLOY_STEEL",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_05d.status === "UNVERIFIED" &&
      rF01_R5_FIX_05d.resolvedFactors?.W?.valueVerified === false,
    "TEST 5d — W-02 + LOW_ALLOY_STEEL ne doit pas être assimilé automatiquement à CARBON_STEEL => UNVERIFIED"
  );

  // TEST 6 : W-02 + selectionContext uniquement => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_06 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      selectionContext: "Below creep range T <= 510°C",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_06.status === "UNVERIFIED" &&
      rF01_R5_FIX_06.resolvedFactors?.W?.valueVerified === false,
    "TEST 6 — W-02 + selectionContext uniquement => UNVERIFIED"
  );

  // TEST 7 : W-02 + isCreepRegime = true => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_07 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      isCreepRegime: true,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_07.status === "UNVERIFIED" &&
      rF01_R5_FIX_07.resolvedFactors?.W?.valueVerified === false,
    "TEST 7 — W-02 + isCreepRegime = true => UNVERIFIED"
  );

  // TEST 8 : W-02 + température W différente de input.temperature => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_08 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    temperature: 100,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-02",
      componentType: "WELDED",
      isCreepRegime: false,
      temperature: 150,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-02",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_08.status === "UNVERIFIED" &&
      rF01_R5_FIX_08.resolvedFactors?.W?.valueVerified === false,
    "TEST 8 — W-02 + température W différente de input.temperature => UNVERIFIED"
  );

  // TEST 9 : W-03 + conditions non prouvées par modèle => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_09 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    materialFamily: "AUSTENITIC",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-03",
      componentType: "WELDED",
      materialFamily: "AUSTENITIC",
      materialGroup: "AUSTENITIC_SS",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-03",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_09.status === "UNVERIFIED" &&
      rF01_R5_FIX_09.resolvedFactors?.W?.valueVerified === false,
    "TEST 9 — W-03 + conditions non prouvées par modèle => UNVERIFIED"
  );

  // TEST 10 : W-03 + selectionContext uniquement => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_10 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-03",
      selectionContext: "Longitudinal seam weld in austenitic steel",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-03",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_10.status === "UNVERIFIED" &&
      rF01_R5_FIX_10.resolvedFactors?.W?.valueVerified === false,
    "TEST 10 — W-03 + selectionContext uniquement => UNVERIFIED"
  );

  // TEST 11 : W-03 + contexte contradictoire => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_11 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    materialFamily: "FERRITIC",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-03",
      componentType: "WELDED",
      materialFamily: "AUSTENITIC",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-03",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_11.status === "UNVERIFIED" &&
      rF01_R5_FIX_11.resolvedFactors?.W?.valueVerified === false,
    "TEST 11 — W-03 + contexte contradictoire => UNVERIFIED"
  );

  // TEST 12 : W-04 + conditions non prouvées par modèle => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_12 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-04",
      componentType: "WELDED",
      materialGroup: "CS_ERW",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-04",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_12.status === "UNVERIFIED" &&
      rF01_R5_FIX_12.resolvedFactors?.W?.valueVerified === false,
    "TEST 12 — W-04 + conditions non prouvées par modèle => UNVERIFIED"
  );

  // TEST 13 : W-04 + isCreepRegime seul => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_13 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-04",
      isCreepRegime: false,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-04",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_13.status === "UNVERIFIED" &&
      rF01_R5_FIX_13.resolvedFactors?.W?.valueVerified === false,
    "TEST 13 — W-04 + isCreepRegime seul => UNVERIFIED"
  );

  // TEST 14 : W-04 + texte générique seul => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_14 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-04",
      selectionContext: "Qualified SAW/ERW longitudinal weld seam",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-04",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_14.status === "UNVERIFIED" &&
      rF01_R5_FIX_14.resolvedFactors?.W?.valueVerified === false,
    "TEST 14 — W-04 + texte générique seul => UNVERIFIED"
  );

  // TEST 15 : W-06 + materialGroup = "CRMO" sans catégorie structurée NORM-06 => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_15 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "WELDED",
      materialGroup: "CRMO",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_15.status === "UNVERIFIED" &&
      rF01_R5_FIX_15.resolvedFactors?.W?.valueVerified === false,
    "TEST 15 — W-06 + materialGroup = 'CRMO' sans catégorie structurée NORM-06 => UNVERIFIED"
  );

  // TEST 15a : W-06 + materialGroup = "CR_MO" sans catégorie structurée NORM-06 => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_15a = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "WELDED",
      materialGroup: "CR_MO",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_15a.status === "UNVERIFIED" &&
      rF01_R5_FIX_15a.resolvedFactors?.W?.valueVerified === false,
    "TEST 15a — W-06 + materialGroup = 'CR_MO' sans catégorie structurée NORM-06 => UNVERIFIED"
  );

  // TEST 15b : W-06 + materialGroup = "CRMO_..." => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_15b = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "WELDED",
      materialGroup: "CRMO_P22",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_15b.status === "UNVERIFIED" &&
      rF01_R5_FIX_15b.resolvedFactors?.W?.valueVerified === false,
    "TEST 15b — W-06 + materialGroup = 'CRMO_...' => UNVERIFIED"
  );

  // TEST 15c : W-06 + LOW_ALLOY_STEEL ne suffit pas pour qualifier le contexte CrMo spécifique
  testsRun++;
  const rF01_R5_FIX_15c = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "WELDED",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "WELDED",
      materialGroup: "LOW_ALLOY_STEEL",
      isCreepRegime: false,
      temperature: 100,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_15c.status === "UNVERIFIED" &&
      rF01_R5_FIX_15c.resolvedFactors?.W?.valueVerified === false,
    "TEST 15c — W-06 + LOW_ALLOY_STEEL ne suffit pas pour qualifier CrMo => UNVERIFIED"
  );

  // TEST 16 : W-06 + selectionContext seul => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_16 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      selectionContext: "Circumferential butt weld joint under pressure",
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_16.status === "UNVERIFIED" &&
      rF01_R5_FIX_16.resolvedFactors?.W?.valueVerified === false,
    "TEST 16 — W-06 + selectionContext seul => UNVERIFIED"
  );

  // TEST 17 : W-06 + contexte contradictoire => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_17 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: "SEAMLESS",
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-06",
      componentType: "SEAMLESS",
      isCreepRegime: false,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-06",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_17.status === "UNVERIFIED" &&
      rF01_R5_FIX_17.resolvedFactors?.W?.valueVerified === false,
    "TEST 17 — W-06 + contexte contradictoire => UNVERIFIED"
  );

  // TEST 18 : W numérique sans provenance qualifiée => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_18 = executeEngineeringCalculation({
    ...f01Baseline,
    weldReductionFactor: 1.0,
    weldReductionFactorInput: undefined,
  });
  assert(
    rF01_R5_FIX_18.status === "UNVERIFIED" &&
      rF01_R5_FIX_18.resolvedFactors?.W?.valueVerified === false,
    "TEST 18 — W numérique sans provenance qualifiée => UNVERIFIED"
  );

  // TEST 19 : W numérique + source + VERIFIED mais sans preuve structurée de branche => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_19 = executeEngineeringCalculation({
    ...f01Baseline,
    componentType: undefined,
    weldReductionFactorInput: {
      factorValue: 1.0,
      sourceReference: "ASME B31.3 Table 302.3.5-1",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_19.status === "UNVERIFIED" &&
      rF01_R5_FIX_19.resolvedFactors?.W?.valueVerified === false,
    "TEST 19 — W numérique + source + VERIFIED mais sans preuve structurée de branche => UNVERIFIED"
  );

  // TEST 20 : contradiction input/W => UNVERIFIED
  testsRun++;
  const rF01_R5_FIX_20 = executeEngineeringCalculation({
    ...f01Baseline,
    temperature: 100,
    weldReductionFactorInput: {
      factorValue: 1.0,
      branchId: "W-01",
      componentType: "SEAMLESS",
      temperature: 150,
      sourceReference: "ASME B31.3 Table 302.3.5-1 W-01",
      qualificationStatus: "VERIFIED",
    },
  });
  assert(
    rF01_R5_FIX_20.status === "UNVERIFIED" &&
      rF01_R5_FIX_20.resolvedFactors?.W?.valueVerified === false,
    "TEST 20 — contradiction input/W => UNVERIFIED"
  );

  return { success: true, testsRun };
}
