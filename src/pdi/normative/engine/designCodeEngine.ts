/**
 * PDI NORMATIVE ENGINE — DESIGN CODE ENGINE
 * Reference: PATCH NORM-08 (Design Code Engine / Engineering Calculation Foundation)
 * 
 * Moteur d'exécution des calculs d'ingénierie selon codes de conception.
 * 
 * RÈGLE ARCHITECTURALE ABSOLUE :
 * - Déterministe, immuable, auditable, traçable.
 * - Indépendant de React, de l'UI, de Firestore et des catalogues legacy.
 * - Aucune formule inventée ou constante arbitraire.
 * - Tout calcul dont la formule, la clause, les coefficients ou l'édition
 *   ne sont pas intégralement vérifiés retourne NOT_IMPLEMENTED.
 * - AUCUN statut COMPLIANT n'est délivré (réservé à NORM-09).
 * - Vérification stricte contre NaN et Infinity.
 */

import type {
  EngineeringCalculationInput,
  EngineeringCalculationContext,
  EngineeringCalculationResult,
  DesignCodeFormulaReference,
  DiameterBasis,
  ResolvedNormativeFactor,
} from "../types/designCodeTypes";
import type {
  StandardEdition,
} from "../types/normativeCoreTypes";
import {
  validateCompleteEngineeringCalculationInput,
  validateDesignCodeFormulaReference,
  isFormulaQualified,
  isRecordObject,
} from "../validators/designCodeValidator";
import {
  getDesignCodeCalculationEntry,
} from "../registry/designCodeRegistry";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { resolveVerifiedNormativeValue } from "../validators/normativeVerifiedValueValidator";

function buildCalculationEvidenceResolver(
  input: EngineeringCalculationInput
): NormativeEvidenceResolver {
  const registry = new NormativeEvidenceRegistry();
  for (const evidence of input.evidenceItems ?? []) {
    try {
      registry.register(evidence);
    } catch {
      // Ignore invalid evidence items at registration stage
    }
  }
  return new NormativeEvidenceResolver(registry);
}

function buildInputsRecord(
  input: EngineeringCalculationInput,
  diameterBasis?: DiameterBasis
): Readonly<Record<string, number | string | undefined>> {
  return Object.freeze({
    pressure: input.pressure,
    temperature: input.temperature,
    outsideDiameterMm: input.outsideDiameterMm,
    insideDiameterMm: input.insideDiameterMm,
    wallThicknessMm: input.wallThicknessMm,
    diameterBasis: diameterBasis ?? input.diameterBasis,
    materialId: input.materialId,
    allowableStressMpa: input.allowableStressMpa ?? input.allowableStressInput?.value,
    corrosionAllowanceMm: input.corrosionAllowanceMm,
    weldJointFactor: input.weldJointFactor ?? input.qualityFactorInput?.factorValue,
    weldReductionFactor: input.weldReductionFactor ?? input.weldReductionFactorInput?.factorValue,
    yCoefficient: input.yCoefficient ?? input.yCoefficientInput?.factorValue,
    designFactor: input.designFactor,
    unitSystem: input.unitSystem,
  });
}

/**
 * Exécution qualifiée de la formule F01 : ASME B31.3-2024 para. 304.1.2(a) Équations (3a) et (3b).
 */
function executeAsmeB313F01Calculation(
  input: EngineeringCalculationInput,
  formula: DesignCodeFormulaReference,
  effectiveEdition: StandardEdition | undefined
): EngineeringCalculationResult {
  const calculationEvidenceResolver = buildCalculationEvidenceResolver(input);
  // RÈGLE ABSOLUE F01 : Le contrat qualifié est exclusivement SI (MPa, mm, °C)
  if (input.unitSystem !== "SI") {
    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "UNIT_CONTRACT_UNVERIFIED: Le contrat F01 qualifié ASME B31.3-2024 Eq. (3a)/(3b) est exclusivement qualifié pour le système d'unités SI (MPa, mm, °C). US_CUSTOMARY n'est pas qualifié et aucune conversion implicite n'est autorisée.",
      ]),
    });
  }

  const P = input.pressure;
  if (typeof P !== "number" || !Number.isFinite(P) || P <= 0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_PRESSURE: P doit être un nombre fini strictement positif (> 0)."]),
    });
  }

  const c = input.corrosionAllowanceMm;
  if (typeof c !== "number" || !Number.isFinite(c) || c < 0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "INVALID_CORROSION_ALLOWANCE: La surépaisseur de corrosion (c) doit être un nombre fini positif ou nul (>= 0).",
      ]),
    });
  }

  // Vérification stricte des diamètres
  const hasOutside = typeof input.outsideDiameterMm === "number" && Number.isFinite(input.outsideDiameterMm);
  const hasInside = typeof input.insideDiameterMm === "number" && Number.isFinite(input.insideDiameterMm);

  if (hasOutside && input.outsideDiameterMm! <= 0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_DIAMETER: outsideDiameterMm doit être strictement positif (> 0)."]),
    });
  }
  if (hasInside && input.insideDiameterMm! <= 0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_DIAMETER: insideDiameterMm doit être strictement positif (> 0)."]),
    });
  }
  if (!hasOutside && !hasInside) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "PIPE_DIMENSION_REFERENCE_REQUIRED: outsideDiameterMm ou insideDiameterMm est obligatoire.",
      ]),
    });
  }
  if (hasOutside && hasInside && !input.diameterBasis) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "DIAMETER_BASIS_REQUIRED: Les deux diamètres sont fournis sans diameterBasis. Déclarer explicitement diameterBasis ('OUTSIDE' ou 'INSIDE').",
      ]),
    });
  }

  if (input.diameterBasis === "INSIDE" && !hasInside) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis: "INSIDE",
      inputs: buildInputsRecord(input, "INSIDE"),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "PIPE_DIMENSION_REFERENCE_REQUIRED: diameterBasis est fixé à 'INSIDE' mais insideDiameterMm n'est pas fourni.",
      ]),
    });
  }
  if (input.diameterBasis === "OUTSIDE" && !hasOutside) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis: "OUTSIDE",
      inputs: buildInputsRecord(input, "OUTSIDE"),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "PIPE_DIMENSION_REFERENCE_REQUIRED: diameterBasis est fixé à 'OUTSIDE' mais outsideDiameterMm n'est pas fourni.",
      ]),
    });
  }

  let diameterBasis: DiameterBasis;
  if (input.diameterBasis) {
    diameterBasis = input.diameterBasis;
  } else if (hasOutside) {
    diameterBasis = "OUTSIDE";
  } else {
    diameterBasis = "INSIDE";
  }

  // 1. Facteur S (Contrainte admissible)
  let S: number | undefined;
  let sContractVerified = false;
  let sValueVerified = false;
  let sSource: string | undefined;
  let sTemperatureMismatch = false;
  let sTempMismatchDetail = "";
  let missingDesignTemperature = false;
  let missingStressTemp = false;

  const sInput = input.allowableStressInput;
  if (isRecordObject(sInput) && typeof sInput.value === "number") {
    S = sInput.value;
    sContractVerified = Number.isFinite(S) && S > 0;
    const hasMaterial = Boolean(
      (typeof sInput.materialReference === "string" && sInput.materialReference.trim().length > 0) ||
      (typeof input.materialId === "string" && input.materialId.trim().length > 0)
    );
    const hasStressTemp =
      typeof sInput.temperature === "number" &&
      Number.isFinite(sInput.temperature);
    const hasInputTemp =
      typeof input.temperature === "number" &&
      Number.isFinite(input.temperature);

    if (!hasStressTemp) {
      missingStressTemp = true;
    }
    if (!hasInputTemp) {
      missingDesignTemperature = true;
    }

    let tempMatches = false;
    if (hasStressTemp && hasInputTemp) {
      if (sInput.temperature === input.temperature) {
        tempMatches = true;
      } else {
        sTemperatureMismatch = true;
        sTempMismatchDetail = `S_TEMPERATURE_MISMATCH: allowableStressInput.temperature (${sInput.temperature}°C) !== input.temperature (${input.temperature}°C). Égalité numérique exacte requise.`;
      }
    }

    const hasUnit = sInput.unit === "MPa";
    const hasSource =
      typeof sInput.sourceReference === "string" &&
      sInput.sourceReference.trim().length > 0;
    const isStatusQualified =
      sInput.qualificationStatus === "VERIFIED" ||
      sInput.qualificationStatus === "LICENSED";

    const sVerifiedValue = resolveVerifiedNormativeValue<number>(
      sInput.verifiedValue,
      calculationEvidenceResolver,
      (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
    );

    if (
      sContractVerified &&
      hasMaterial &&
      hasStressTemp &&
      hasInputTemp &&
      tempMatches &&
      hasUnit &&
      hasSource &&
      isStatusQualified &&
      Boolean(sVerifiedValue) &&
      sVerifiedValue!.value === sInput.value
    ) {
      S = sVerifiedValue!.value;
      sValueVerified = true;
      sSource = sInput.sourceReference;
    }
  } else if (typeof input.allowableStressMpa === "number") {
    S = input.allowableStressMpa;
    sContractVerified = Number.isFinite(S) && S > 0;
    sValueVerified = false; // Une valeur numérique brute sans qualification/provenance n'est JAMAIS VALUE VERIFIED
    if (typeof input.temperature !== "number" || !Number.isFinite(input.temperature)) {
      missingDesignTemperature = true;
    }
  }

  if (S === undefined) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["MISSING_REQUIRED_INPUT: S (contrainte admissible) est obligatoire."]),
    });
  }
  if (!Number.isFinite(S) || S <= 0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_INPUT_VALUE: S doit être un nombre fini strictement positif (> 0)."]),
    });
  }

  // 2. Facteur E (Facteur de qualité de joint)
  let E: number | undefined;
  let eContractVerified = false;
  let eValueVerified = false;
  let eSource: string | undefined;

  const eInput = input.qualityFactorInput;
  if (isRecordObject(eInput) && typeof eInput.factorValue === "number") {
    E = eInput.factorValue;
    eContractVerified = Number.isFinite(E) && E > 0 && E <= 1.0;
    const hasSource =
      typeof eInput.sourceReference === "string" &&
      eInput.sourceReference.trim().length > 0;
    const hasContext = Boolean(
      (typeof eInput.productSpecification === "string" && eInput.productSpecification.trim().length > 0) ||
      (typeof eInput.jointType === "string" && eInput.jointType.trim().length > 0) ||
      (typeof eInput.selectionContext === "string" && eInput.selectionContext.trim().length > 0) ||
      (typeof eInput.examinationLevel === "string" && eInput.examinationLevel.trim().length > 0)
    );
    const isStatusQualified =
      eInput.qualificationStatus === "VERIFIED" ||
      eInput.qualificationStatus === "LICENSED";

    const eVerifiedValue = resolveVerifiedNormativeValue<number>(
      eInput.verifiedValue,
      calculationEvidenceResolver,
      (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1,
    );

    if (
      eContractVerified &&
      hasSource &&
      hasContext &&
      isStatusQualified &&
      Boolean(eVerifiedValue) &&
      eVerifiedValue!.value === eInput.factorValue
    ) {
      E = eVerifiedValue!.value;
      eValueVerified = true;
      eSource = eInput.sourceReference;
    }
  } else if (typeof input.weldJointFactor === "number") {
    E = input.weldJointFactor;
    eContractVerified = Number.isFinite(E) && E > 0 && E <= 1.0;
    eValueVerified = false; // Valeur brute sans contexte ni provenance
  }

  if (E === undefined) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["MISSING_REQUIRED_INPUT: E (facteur de joint) est obligatoire."]),
    });
  }
  if (!Number.isFinite(E) || E <= 0 || E > 1.0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_COEFFICIENT: E doit être un nombre fini dans ]0, 1.0]."]),
    });
  }

  // 3. Facteur W (Réduction de résistance du joint soudé)
  // RÈGLE ABSOLUE F01 : Aucun fallback SEAMLESS -> 1.0 ni FERRITIC/temp -> 1.0
  let W: number | undefined;
  let wContractVerified = false;
  let wValueVerified = false;
  let wSource: string | undefined;
  const wErrors: string[] = [];

  const wInput = input.weldReductionFactorInput;

  // Interception immédiate des branches exclues/bloquées (W-08 CSEF, W-09 autres fluages non listés)
  const isBranchBlocked =
    wInput?.branchId === "W-08" ||
    wInput?.branchId === "W-09" ||
    wInput?.materialGroup === "CSEF" ||
    wInput?.applicability === "W-08" ||
    wInput?.applicability === "W-09" ||
    wInput?.selectionContext?.includes("W-08") ||
    wInput?.selectionContext?.includes("W-09");

  if (isBranchBlocked) {
    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "BRANCH_BLOCKED: Les branches W-08 (aciers CSEF) et W-09 (matériaux hors fluage listé) sont hors périmètre qualifié F01 (non calculable).",
      ]),
    });
  }

  // Branches conditionnelles W-05 et W-07 : nécessitent hasQualifiedContextGrid === true
  const isConditionalBranch =
    wInput?.branchId === "W-05" ||
    wInput?.branchId === "W-07" ||
    wInput?.applicability === "W-05" ||
    wInput?.applicability === "W-07" ||
    wInput?.selectionContext?.includes("W-05") ||
    wInput?.selectionContext?.includes("W-07");

  if (isConditionalBranch && !wInput?.hasQualifiedContextGrid) {
    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "W_CONDITIONAL_CONTEXT_REQUIRED: Les branches W-05 et W-07 en régime de fluage nécessitent une grille de contexte de qualification complète (hasQualifiedContextGrid).",
      ]),
    });
  }

  if (isRecordObject(wInput) && typeof wInput.factorValue === "number") {
    W = wInput.factorValue;
    wContractVerified = Number.isFinite(W) && W > 0 && W <= 1.0;
    const hasSource =
      typeof wInput.sourceReference === "string" &&
      wInput.sourceReference.trim().length > 0;
    const isStatusQualified =
      wInput.qualificationStatus === "VERIFIED" ||
      wInput.qualificationStatus === "LICENSED";

    // Contrôle strict de cohérence input / wInput (Section 4)
    let hasContradiction = false;

    // 1. temperature / designTemperature
    if (
      typeof input.temperature === "number" &&
      typeof wInput.temperature === "number" &&
      input.temperature !== wInput.temperature
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: wInput.temperature (${wInput.temperature}°C) !== input.temperature (${input.temperature}°C).`
      );
    }
    if (
      typeof input.temperature === "number" &&
      typeof wInput.designTemperature === "number" &&
      input.temperature !== wInput.designTemperature
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: wInput.designTemperature (${wInput.designTemperature}°C) !== input.temperature (${input.temperature}°C).`
      );
    }
    if (
      typeof wInput.temperature === "number" &&
      typeof wInput.designTemperature === "number" &&
      wInput.temperature !== wInput.designTemperature
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: wInput.temperature (${wInput.temperature}°C) !== wInput.designTemperature (${wInput.designTemperature}°C).`
      );
    }

    // 2. componentType
    if (
      input.componentType !== undefined &&
      wInput.componentType !== undefined &&
      input.componentType !== wInput.componentType
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: input.componentType (${input.componentType}) !== wInput.componentType (${wInput.componentType}).`
      );
    }

    // 3. materialFamily
    if (
      input.materialFamily !== undefined &&
      wInput.materialFamily !== undefined &&
      input.materialFamily !== wInput.materialFamily
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: input.materialFamily (${input.materialFamily}) !== wInput.materialFamily (${wInput.materialFamily}).`
      );
    }
    if (
      input.materialFamily === "FERRITIC" &&
      typeof wInput.materialGroup === "string" &&
      wInput.materialGroup.toUpperCase().includes("AUSTENITIC")
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: input.materialFamily FERRITIC vs wInput.materialGroup AUSTENITIC.`
      );
    }
    if (
      input.materialFamily === "AUSTENITIC" &&
      typeof wInput.materialGroup === "string" &&
      (wInput.materialGroup.toUpperCase().includes("FERRITIC") ||
        wInput.materialGroup.toUpperCase().includes("CS"))
    ) {
      hasContradiction = true;
      wErrors.push(
        `W_INPUT_CONTRADICTION: input.materialFamily AUSTENITIC vs wInput.materialGroup FERRITIC/CS.`
      );
    }

    // Identification stricte de la branche W (doit être explicitement démontrée, jamais inférée d'un texte générique seul)
    const branchId = wInput.branchId;
    let isQualifiedBranch = false;

    if (branchId === "W-01") {
      // W-01 : Composant sans soudure (Seamless pipe / component)
      // Preuve POSITIVE obligatoire : componentType === "SEAMLESS"
      // Refus strict si componentType absent, WELDED, ou contradictoire
      const isPositiveSeamless =
        (input.componentType === "SEAMLESS" || wInput.componentType === "SEAMLESS") &&
        input.componentType !== "WELDED" &&
        wInput.componentType !== "WELDED";

      if (isPositiveSeamless && !hasContradiction) {
        isQualifiedBranch = true;
      }
    } else if (branchId === "W-02") {
      // W-02 : Carbon Steel (Table 302.3.5-1 sous régime non-fluage)
      // Preuve POSITIVE obligatoire :
      // 1. Catégorie structurée CARBON_STEEL obligatoire (strictement alignée sur NORM-06 MaterialCategory).
      //    Interdiction absolue d'utiliser comme preuve des heuristiques de nommage (MAT_CS_..., _CS_..., CS, CS_*).
      //    Les chaînes textuelles ne constituent pas une preuve normative de catégorie métallurgique.
      // 2. isCreepRegime === false
      // 3. Contexte composant compatible (non SEAMLESS)
      // 4. Aucune contradiction
      const isPositiveCarbonSteel =
        typeof wInput.materialGroup === "string" &&
        wInput.materialGroup.toUpperCase() === "CARBON_STEEL";

      const hasPositiveNonCreepProof = wInput.isCreepRegime === false;
      const isNotSeamless =
        input.componentType !== "SEAMLESS" && wInput.componentType !== "SEAMLESS";

      if (
        isPositiveCarbonSteel &&
        hasPositiveNonCreepProof &&
        isNotSeamless &&
        !hasContradiction
      ) {
        isQualifiedBranch = true;
      }
    } else if (branchId === "W-03") {
      // W-03 : Austenitic grade 3xx welded autogenous without filler metal
      // La matrice qualifiée exige :
      // - austenitic grade 3xx
      // - welded autogenous
      // - no filler metal
      // Le modèle de données actuel ne permet pas de représenter de manière structurée
      // "grade 3xx", "autogenous" et "no filler metal" sans inventer de nouveaux champs ou parser du texte libre.
      // Règle normative stricte : Si les données existantes ne permettent pas de prouver
      // positivement les conditions exactes d'une branche qualifiée -> W-03 reste UNVERIFIED.
      isQualifiedBranch = false;
    } else if (branchId === "W-04") {
      // W-04 : Austenitic grade 3xx welded with filler metal
      // La matrice qualifiée exige :
      // - austenitic grade 3xx
      // - welded
      // - with filler metal
      // Le modèle de données actuel ne permet pas de prouver de manière structurée
      // "grade 3xx" et "with filler metal" (la présence générique d'un materialGroup/materialFamily
      // ou du texte libre ne constitue pas une preuve normative).
      // Règle normative stricte : W-04 reste UNVERIFIED.
      isQualifiedBranch = false;
    } else if (branchId === "W-06") {
      // W-06 : CrMo
      // La matrice ASME B31.3 exige une preuve positive de nuance / groupe CrMo.
      // Dans le modèle normatif existant (NORM-06 MaterialEngine), les catégories métallurgiques
      // structurées sont : CARBON_STEEL, LOW_ALLOY_STEEL, STAINLESS_STEEL, DUPLEX_STAINLESS_STEEL,
      // NICKEL_ALLOY, OTHER.
      // Le modèle NORM-06 ne définit ni "CR_MO", ni "CRMO" comme une catégorie normative MaterialCategory.
      // LOW_ALLOY_STEEL ne prouve pas spécifiquement la composition CrMo requise par W-06.
      // De plus, les heuristiques de chaînes libres (CRMO, CR_MO, CRMO_*, CR_MO_*) sont formellement
      // interdites comme preuve normative autonome.
      // En l'absence de contrat structuré NORM-06 prouvant positivement la sous-famille CrMo,
      // la branche W-06 reste strictement UNVERIFIED.
      isQualifiedBranch = false;
    } else if (isConditionalBranch && Boolean(wInput.hasQualifiedContextGrid)) {
      isQualifiedBranch = true;
    }

    const wVerifiedValue = resolveVerifiedNormativeValue<number>(
      wInput.verifiedValue,
      calculationEvidenceResolver,
      (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1,
    );

    if (
      wContractVerified &&
      hasSource &&
      isStatusQualified &&
      isQualifiedBranch &&
      !hasContradiction &&
      Boolean(wVerifiedValue) &&
      wVerifiedValue!.value === wInput.factorValue
    ) {
      W = wVerifiedValue!.value;
      wValueVerified = true;
      wSource = wInput.sourceReference;
    }
  } else if (typeof input.weldReductionFactor === "number") {
    W = input.weldReductionFactor;
    wContractVerified = Number.isFinite(W) && W > 0 && W <= 1.0;
    wValueVerified = false; // Valeur brute sans provenance ni branche
  }

  // Si W est absent ou non résolu déterministement :
  if (W === undefined) {
    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "VALUE_UNVERIFIED: Le facteur W n'a pas pu être résolu ou n'est pas qualifié. Aucun fallback implicite autorisé.",
      ]),
    });
  }

  if (!Number.isFinite(W) || W <= 0 || W > 1.0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_COEFFICIENT: W doit être un nombre fini dans ]0, 1.0]."]),
    });
  }

  // 4. Coefficient Y
  // RÈGLE ABSOLUE F01 : Aucun fallback ferritic <= 482 -> 0.4 ni austenitic <= 566 -> 0.4
  let Y: number | undefined;
  let yContractVerified = false;
  let yValueVerified = false;
  let ySource: string | undefined;

  const yInput = input.yCoefficientInput;
  if (isRecordObject(yInput) && typeof yInput.factorValue === "number") {
    Y = yInput.factorValue;
    yContractVerified = Number.isFinite(Y) && Y >= 0 && Y <= 0.7;

    const hasSource =
      typeof yInput.sourceReference === "string" &&
      yInput.sourceReference.trim().length > 0;
    const isStatusQualified =
      yInput.qualificationStatus === "VERIFIED" ||
      yInput.qualificationStatus === "LICENSED";
    const materialFamily = yInput.materialFamily ?? input.materialFamily;
    const temperature = yInput.temperature ?? input.temperature;

    const hasContext =
      typeof materialFamily === "string" &&
      materialFamily.trim().length > 0 &&
      typeof temperature === "number" &&
      Number.isFinite(temperature);

    // Contrôle strict d'extrapolation au-delà de la Table 304.1.1-1
    let isExtrapolation = false;
    if (typeof temperature === "number" && materialFamily) {
      const famUpper = materialFamily.toUpperCase();
      if (famUpper.includes("FERRITIC") || famUpper === "CS" || famUpper === "CARBON_STEEL") {
        if (temperature > 538) {
          isExtrapolation = true;
        }
      } else if (famUpper.includes("AUSTENITIC") || famUpper === "SS") {
        if (temperature > 621) {
          isExtrapolation = true;
        }
      } else if (famUpper.includes("CAST_IRON")) {
        if (temperature > 482) {
          isExtrapolation = true;
        }
      } else {
        if (temperature > 482) {
          isExtrapolation = true;
        }
      }
    }

    const yVerifiedValue = resolveVerifiedNormativeValue<number>(
      yInput.verifiedValue,
      calculationEvidenceResolver,
      (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 0.7,
    );

    if (
      yContractVerified &&
      hasSource &&
      isStatusQualified &&
      hasContext &&
      !isExtrapolation &&
      Boolean(yVerifiedValue) &&
      yVerifiedValue!.value === yInput.factorValue
    ) {
      Y = yVerifiedValue!.value;
      yValueVerified = true;
      ySource = yInput.sourceReference;
    }
  } else if (typeof input.yCoefficient === "number") {
    Y = input.yCoefficient;
    yContractVerified = Number.isFinite(Y) && Y >= 0 && Y <= 0.7;
    yValueVerified = false; // Valeur brute sans contexte ni provenance
  }

  if (Y === undefined) {
    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "VALUE_UNVERIFIED: Le coefficient Y n'a pas pu être résolu ou n'est pas qualifié. Aucun fallback implicite autorisé.",
      ]),
    });
  }

  if (!Number.isFinite(Y) || Y < 0 || Y > 0.7) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_COEFFICIENT: Y doit être un nombre fini dans [0.0, 0.7]."]),
    });
  }

  const resolvedFactors: Record<string, ResolvedNormativeFactor> = {
    S: Object.freeze({
      name: "Basic Allowable Stress",
      value: S,
      contractVerified: sContractVerified,
      valueVerified: sValueVerified,
      sourceReference: sSource,
      evidenceIds: sInput?.verifiedValue?.evidenceIds,
    }),
    E: Object.freeze({
      name: "Quality Factor",
      value: E,
      contractVerified: eContractVerified,
      valueVerified: eValueVerified,
      sourceReference: eSource,
      evidenceIds: eInput?.verifiedValue?.evidenceIds,
    }),
    W: Object.freeze({
      name: "Weld Joint Strength Reduction Factor",
      value: W,
      contractVerified: wContractVerified,
      valueVerified: wValueVerified,
      sourceReference: wSource,
      evidenceIds: wInput?.verifiedValue?.evidenceIds,
    }),
    Y: Object.freeze({
      name: "Wall Thickness Coefficient Y",
      value: Y,
      contractVerified: yContractVerified,
      valueVerified: yValueVerified,
      sourceReference: ySource,
      evidenceIds: yInput?.verifiedValue?.evidenceIds,
    }),
  };

  // Contrat CONTRACT VERIFIED vs VALUE VERIFIED (Seul un ensemble 100% Value Verified autorise CALCULATED)
  const unverifiedFactors: string[] = [];
  if (!sValueVerified) unverifiedFactors.push("S (contrainte admissible)");
  if (!eValueVerified) unverifiedFactors.push("E (facteur de joint)");
  if (!wValueVerified) unverifiedFactors.push("W (facteur de réduction soudure)");
  if (!yValueVerified) unverifiedFactors.push("Y (coefficient d'épaisseur)");

  if (unverifiedFactors.length > 0) {
    const errorList: string[] = [];
    if (sTemperatureMismatch) {
      errorList.push(sTempMismatchDetail);
    }
    if (missingDesignTemperature) {
      errorList.push(
        "MISSING_DESIGN_TEMPERATURE: input.temperature est requis pour la qualification de S et du calcul."
      );
    }
    if (missingStressTemp) {
      errorList.push(
        "MISSING_STRESS_TEMPERATURE: allowableStressInput.temperature est requis et doit être un nombre fini."
      );
    }
    if (wErrors.length > 0) {
      errorList.push(...wErrors);
    }
    errorList.push(
      `VALUE_UNVERIFIED: Les facteurs suivants ne sont pas VALUE VERIFIED : ${unverifiedFactors.join(", ")}. Statut CALCULATED interdit sans provenance qualifiée complète.`
    );

    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      resolvedFactors: Object.freeze(resolvedFactors),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(errorList),
    });
  }

  // Contrôle P / (S * E) > 0.385 (Section 4 & 12)
  const stressRatio = P / (S * E);
  if (stressRatio > 0.385) {
    return Object.freeze({
      status: "OUT_OF_SCOPE",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      diameterBasis,
      inputs: buildInputsRecord(input, diameterBasis),
      resolvedFactors: Object.freeze(resolvedFactors),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        `SPECIAL_CONSIDERATION_REQUIRED: ASME B31.3-2024 para. 304.1.2(b): Le ratio P/(SE) = ${stressRatio.toFixed(4)} excède 0.385. Une analyse spéciale (théorie de rupture, fatigue, contraintes thermiques) est obligatoire.`,
      ]),
    });
  }

  // Calcul numérique et contrôle du domaine paroi mince t < D/6
  let t: number;
  let clauseReference: string;

  if (diameterBasis === "OUTSIDE") {
    clauseReference = "para. 304.1.2(a) Eq. (3a)";
    const D = input.outsideDiameterMm!;
    const denominator = 2 * (S * E * W + P * Y);
    if (denominator <= 0 || !Number.isFinite(denominator)) {
      return Object.freeze({
        status: "INVALID_INPUT",
        calculationType: input.calculationType,
        designCodeId: input.designCodeId,
        standardEdition: effectiveEdition,
        inputs: buildInputsRecord(input, diameterBasis),
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          "INVALID_DENOMINATOR: Le dénominateur de l'Équation (3a) 2*(S*E*W + P*Y) est nul ou négatif.",
        ]),
      });
    }
    t = (P * D) / denominator;

    // Critère non-circulaire t < D/6
    if (t >= D / 6 || !Number.isFinite(t) || t <= 0) {
      if (t >= D / 6) {
        return Object.freeze({
          status: "OUT_OF_SCOPE",
          calculationType: input.calculationType,
          designCodeId: input.designCodeId,
          standardEdition: effectiveEdition,
          formulaId: formula.id,
          clauseReference,
          sourceReference: formula.sourceReference,
          diameterBasis,
          inputs: buildInputsRecord(input, diameterBasis),
          resolvedFactors: Object.freeze(resolvedFactors),
          assumptions: Object.freeze([]),
          warnings: Object.freeze([]),
          errors: Object.freeze([
            `SPECIAL_CONSIDERATION_REQUIRED: ASME B31.3-2024 para. 304.1.2(b): t (${t.toFixed(4)} mm) >= D/6 (${(D / 6).toFixed(4)} mm). Calcul hors domaine de validité paroi mince.`,
          ]),
        });
      }
      return Object.freeze({
        status: "INVALID_INPUT",
        calculationType: input.calculationType,
        designCodeId: input.designCodeId,
        standardEdition: effectiveEdition,
        inputs: buildInputsRecord(input, diameterBasis),
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze(["INVALID_INPUT_VALUE: Valeur calculée pour t non valide."]),
      });
    }
  } else {
    clauseReference = "para. 304.1.2(a) Eq. (3b)";
    const d = input.insideDiameterMm!;
    const denominator = 2 * (S * E * W - P * (1 - Y));
    if (denominator <= 0 || !Number.isFinite(denominator)) {
      return Object.freeze({
        status: "INVALID_INPUT",
        calculationType: input.calculationType,
        designCodeId: input.designCodeId,
        standardEdition: effectiveEdition,
        inputs: buildInputsRecord(input, diameterBasis),
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          "INVALID_DENOMINATOR: Le dénominateur de l'Équation (3b) 2*[S*E*W - P*(1 - Y)] est nul ou négatif.",
        ]),
      });
    }
    t = (P * (d + 2 * c)) / denominator;

    // Critère non-circulaire t < (d + 2c)/4 (équivalent à t < Deq/6)
    const maxThinWallThickness = (d + 2 * c) / 4;
    if (t >= maxThinWallThickness || !Number.isFinite(t) || t <= 0) {
      if (t >= maxThinWallThickness) {
        return Object.freeze({
          status: "OUT_OF_SCOPE",
          calculationType: input.calculationType,
          designCodeId: input.designCodeId,
          standardEdition: effectiveEdition,
          formulaId: formula.id,
          clauseReference,
          sourceReference: formula.sourceReference,
          diameterBasis,
          inputs: buildInputsRecord(input, diameterBasis),
          resolvedFactors: Object.freeze(resolvedFactors),
          assumptions: Object.freeze([]),
          warnings: Object.freeze([]),
          errors: Object.freeze([
            `SPECIAL_CONSIDERATION_REQUIRED: ASME B31.3-2024 para. 304.1.2(b): t (${t.toFixed(4)} mm) >= Deq/6. Calcul hors domaine de validité paroi mince.`,
          ]),
        });
      }
      return Object.freeze({
        status: "INVALID_INPUT",
        calculationType: input.calculationType,
        designCodeId: input.designCodeId,
        standardEdition: effectiveEdition,
        inputs: buildInputsRecord(input, diameterBasis),
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze(["INVALID_INPUT_VALUE: Valeur calculée pour t non valide."]),
      });
    }
  }

  const tm = t + c;
  if (!Number.isFinite(tm) || tm <= 0) {
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: buildInputsRecord(input, diameterBasis),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(["INVALID_INPUT_VALUE: Épaisseur minimale requise tm non valide."]),
    });
  }

  return Object.freeze({
    status: "CALCULATED",
    calculationType: input.calculationType,
    designCodeId: input.designCodeId,
    standardEdition: effectiveEdition,
    formulaId: formula.id,
    clauseReference,
    sourceReference: formula.sourceReference,
    diameterBasis,
    value: t,
    minimumRequiredThicknessMm: tm,
    unit: "mm",
    inputs: buildInputsRecord(input, diameterBasis),
    resolvedFactors: Object.freeze(resolvedFactors),
    formulaReference: formula,
    domain: formula.domain,
    assumptions: Object.freeze([
      "Formule de paroi mince selon ASME B31.3-2024 para. 304.1.2(a).",
      `Base dimensionnelle sélectionnée : ${diameterBasis}.`,
      "Tous les facteurs normatifs (S, E, W, Y) sont audités et VALUE VERIFIED.",
    ]),
    warnings: Object.freeze([]),
    errors: Object.freeze([]),
  });
}

/**
 * Exécute un calcul d'ingénierie selon le code de conception spécifié.
 * RÈGLE ARCHITECTURALE ABSOLUE (NORM-08) :
 * - Déterministe, immuable, auditable, traçable.
 * - Aucune formule inventée ou constante arbitraire.
 * - Le statut CALCULATED exige que toutes les valeurs normatives soient VALUE VERIFIED.
 * - Toute sortie éventuelle est strictement vérifiée par Number.isFinite.
 */
export function executeEngineeringCalculation(
  input: EngineeringCalculationInput,
  context?: EngineeringCalculationContext
): EngineeringCalculationResult {
  // 1. Validation de l'entrée de calcul
  const validation = validateCompleteEngineeringCalculationInput(input);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e) => `${e.code}: ${e.message}`);
    return Object.freeze({
      status: "INVALID_INPUT",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: input.standardEdition ?? context?.standardEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze(errorMessages),
    });
  }

  // 2. Recherche du statut dans le registre des codes de conception
  const registryEntry = getDesignCodeCalculationEntry(input.designCodeId);
  if (!registryEntry) {
    return Object.freeze({
      status: "OUT_OF_SCOPE",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: input.standardEdition ?? context?.standardEdition,
      inputs: Object.freeze({
        pressure: input.pressure,
        unitSystem: input.unitSystem,
      }),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([`DESIGN_CODE_NOT_SUPPORTED: Le code ${input.designCodeId} n'est pas supporté.`]),
    });
  }

  // 3. Vérification du support du type de calcul par le code
  if (
    registryEntry.status === "NOT_IMPLEMENTED" ||
    !registryEntry.supportedCalculationTypes.includes(input.calculationType)
  ) {
    return Object.freeze({
      status: "NOT_IMPLEMENTED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: input.standardEdition ?? context?.standardEdition,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        `FORMULA_NOT_IMPLEMENTED: Aucun calcul vérifié et sourcé pour ${input.calculationType} selon ${input.designCodeId} dans NORM-08.`,
      ]),
    });
  }

  // 4. FORMULA EXECUTION GATE (Section 17)
  // Recherche d'une formule associée dans le registre
  const effectiveEdition = input.standardEdition ?? context?.standardEdition;
  const formula = registryEntry.formulaReferences.find(
    (f) =>
      (f.calculationType === input.calculationType || !f.calculationType) &&
      (!f.standardEdition || (effectiveEdition && f.standardEdition.year === effectiveEdition.year))
  );

  if (!formula || formula.status === "NOT_IMPLEMENTED") {
    return Object.freeze({
      status: "NOT_IMPLEMENTED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula?.id,
      clauseReference: formula?.clauseReference,
      sourceReference: formula?.sourceReference,
      formulaReference: formula,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        `FORMULA_NOT_IMPLEMENTED: Aucune formule implémentée pour ${input.calculationType} sous ${input.designCodeId}.`,
      ]),
    });
  }

  // Vérification de la qualification de la formule (Section 11 & 17)
  const formulaValidation = validateDesignCodeFormulaReference(formula);
  if (!formulaValidation.valid || !isFormulaQualified(formula)) {
    return Object.freeze({
      status: "UNVERIFIED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      formulaId: formula.id,
      clauseReference: formula.clauseReference,
      sourceReference: formula.sourceReference,
      formulaReference: formula,
      inputs: buildInputsRecord(input),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        "FORMULA_SOURCE_UNVERIFIED: Formule non qualifiée ou clause/source absente.",
      ]),
    });
  }

  // Cohérence designCodeId (Section 17)
  if (formula.designCodeId !== input.designCodeId) {
    return Object.freeze({
      status: "NOT_IMPLEMENTED",
      calculationType: input.calculationType,
      designCodeId: input.designCodeId,
      standardEdition: effectiveEdition,
      inputs: Object.freeze({
        pressure: input.pressure,
        unitSystem: input.unitSystem,
      }),
      assumptions: Object.freeze([]),
      warnings: Object.freeze([]),
      errors: Object.freeze([
        `FORMULA_DESIGN_CODE_MISMATCH: La formule ${formula.id} est dédiée à ${formula.designCodeId}, pas ${input.designCodeId}.`,
      ]),
    });
  }

  // 5. Exécution de la formule F01 : ASME-B31.3-2024 PRESSURE_WALL_THICKNESS
  if (
    formula.id === "NORM-08-F01-ASME-B31.3-2024-PRESSURE-WALL-THICKNESS" &&
    input.designCodeId === "ASME-B31.3" &&
    effectiveEdition?.year === "2024" &&
    input.calculationType === "PRESSURE_WALL_THICKNESS"
  ) {
    return executeAsmeB313F01Calculation(input, formula, effectiveEdition);
  }

  return Object.freeze({
    status: "UNVERIFIED",
    calculationType: input.calculationType,
    designCodeId: input.designCodeId,
    standardEdition: effectiveEdition,
    formulaId: formula.id,
    clauseReference: formula.clauseReference,
    sourceReference: formula.sourceReference,
    formulaReference: formula,
    inputs: buildInputsRecord(input),
    assumptions: Object.freeze([]),
    warnings: Object.freeze([]),
    errors: Object.freeze([
      `FORMULA_NOT_IMPLEMENTED: Formule ${formula.id} qualifiée mais non activée pour exécution.`,
    ]),
  });
}
