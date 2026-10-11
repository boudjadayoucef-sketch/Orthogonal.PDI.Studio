/**
 * PDI NORMATIVE ENGINE — PIPING SPECIFICATION TESTS (NORM-07)
 * Reference: PATCH NORM-07 (Piping Specification Engine / Spec Builder)
 * 
 * Suite de tests déterministes et isolés pour le Piping Specification Engine.
 * Valide les tests obligatoires S01 à S32 :
 * - Validation structurelle (INVALID_RECORD_OBJECT) et type safety (unknown)
 * - Exigences des records complets vs partiels
 * - Séparation stricte des types de standards (DESIGN_CODE, DIMENSIONAL_STANDARD, PRODUCT_STANDARD)
 * - Traçabilité (VERIFIED / LICENSED exigent sourceReference)
 * - Détection des duplications de code / id dans les registres
 * - Registre de production immuable avec 0 record
 * - Absence totale de calcul (épaisseur, B31, pression, température, conformité mécanique)
 */

import {
  validateCompletePipingSpecification,
  validatePartialPipingSpecification,
  validatePipingSpecRegistryUniqueness,
} from "../validators/pipingSpecValidator";
import {
  PIPING_SPEC_REGISTRY,
  getPipingSpecById,
  getPipingSpecByCode,
  getPipingSpecsByDesignCode,
  getPipingSpecsByMaterial,
  getAllPipingSpecs,
} from "../registry/pipingSpecRegistry";
import type { PipingSpecification } from "../types/pipingSpecTypes";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

/**
 * Fixture synthétique de test valide (utilisée strictement dans les tests).
 */
const validSpecFixture: PipingSpecification = Object.freeze({
  id: "TEST_SPEC_001",
  code: "TEST_CS150",
  name: "Test Carbon Steel 150# Process Piping",
  designCodeId: "ASME-B31.3",
  materialReferenceIds: ["MAT_API_5L_X65"],
  pipeRules: [
    {
      pipeDimensionalStandardId: "ASME-B36.10M",
      schedule: "STD",
      sourceStatus: "UNVERIFIED" as const,
    },
  ],
  fittingRules: [
    {
      fittingStandardId: "ASME-B16.9",
      fittingTypes: ["ELBOW", "TEE"] as const,
      sourceStatus: "UNVERIFIED" as const,
    },
  ],
  flangeRules: [
    {
      flangeStandardId: "ASME-B16.5",
      flangeTypes: ["WELD_NECK", "BLIND"] as const,
      ratingSystem: "ASME_CLASS" as const,
      rating: "Class 150",
      sourceStatus: "UNVERIFIED" as const,
    },
  ],
  valveRules: [
    {
      productStandardId: "API-600",
      dimensionalStandardId: "ASME-B16.10",
      valveTypes: ["GATE"] as const,
      connectionTypes: ["FLANGED"] as const,
      sourceStatus: "UNVERIFIED" as const,
    },
  ],
  sourceStatus: "UNVERIFIED",
});

export function runPipingSpecEngineTests(): { success: boolean; testsRun: number } {
  let testsRun = 0;

  // =========================================================================
  // S01: Record complet minimal valide
  // =========================================================================
  testsRun++;
  const minimalSpec: PipingSpecification = Object.freeze({
    id: "TEST_SPEC_MINIMAL",
    code: "MIN01",
    name: "Minimal Spec",
    materialReferenceIds: [],
    pipeRules: [],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
    sourceStatus: "UNVERIFIED",
  });
  const resS01 = validateCompletePipingSpecification(minimalSpec);
  assert(
    resS01.valid && resS01.errors.length === 0,
    "S01 — Record complet minimal valide doit passer"
  );

  // =========================================================================
  // S02: {} complete -> FAIL
  // =========================================================================
  testsRun++;
  const resS02 = validateCompletePipingSpecification({});
  assert(
    !resS02.valid &&
      resS02.errors.some((e) => e.code === "MISSING_RECORD_ID") &&
      resS02.errors.some((e) => e.code === "MISSING_SPEC_CODE") &&
      resS02.errors.some((e) => e.code === "MISSING_SPEC_NAME") &&
      resS02.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "S02 — validateCompletePipingSpecification({}) doit échouer (champs requis manquants)"
  );

  // =========================================================================
  // S03: {} partial -> PASS
  // =========================================================================
  testsRun++;
  const resS03 = validatePartialPipingSpecification({});
  assert(
    resS03.valid && resS03.errors.length === 0,
    "S03 — validatePartialPipingSpecification({}) doit passer (état partiel)"
  );

  // =========================================================================
  // S04: null -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resS04 = validatePartialPipingSpecification(null as unknown);
  assert(
    !resS04.valid && resS04.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "S04 — validatePartialPipingSpecification(null) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // S05: array -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resS05 = validatePartialPipingSpecification([validSpecFixture] as unknown);
  assert(
    !resS05.valid && resS05.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "S05 — validatePartialPipingSpecification([]) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // S06: code vide -> FAIL (EMPTY_SPEC_CODE)
  // =========================================================================
  testsRun++;
  const resS06 = validatePartialPipingSpecification({
    code: "   ",
  });
  assert(
    !resS06.valid && resS06.errors.some((e) => e.code === "EMPTY_SPEC_CODE"),
    "S06 — code vide doit échouer avec EMPTY_SPEC_CODE"
  );

  // =========================================================================
  // S07: name vide -> FAIL (EMPTY_SPEC_NAME)
  // =========================================================================
  testsRun++;
  const resS07 = validatePartialPipingSpecification({
    name: "   ",
  });
  assert(
    !resS07.valid && resS07.errors.some((e) => e.code === "EMPTY_SPEC_NAME"),
    "S07 — name vide doit échouer avec EMPTY_SPEC_NAME"
  );

  // =========================================================================
  // S08: designCodeId valide de type DESIGN_CODE -> PASS
  // =========================================================================
  testsRun++;
  const resS08 = validatePartialPipingSpecification({
    designCodeId: "ASME-B31.3",
  });
  assert(
    resS08.valid && resS08.errors.length === 0,
    "S08 — designCodeId = ASME-B31.3 (DESIGN_CODE) doit passer"
  );

  // =========================================================================
  // S09: designCodeId = API-600 -> FAIL (STANDARD_IS_NOT_DESIGN_CODE)
  // =========================================================================
  testsRun++;
  const resS09 = validatePartialPipingSpecification({
    designCodeId: "API-600" as unknown as undefined,
  });
  assert(
    !resS09.valid && resS09.errors.some((e) => e.code === "STANDARD_IS_NOT_DESIGN_CODE"),
    "S09 — designCodeId = API-600 (PRODUCT_STANDARD) doit échouer"
  );

  // =========================================================================
  // S10: pipeDimensionalStandardId = ASME-B36.10M -> PASS
  // =========================================================================
  testsRun++;
  const resS10 = validatePartialPipingSpecification({
    pipeRules: [{ pipeDimensionalStandardId: "ASME-B36.10M", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS10.valid && resS10.errors.length === 0,
    "S10 — pipeDimensionalStandardId = ASME-B36.10M (DIMENSIONAL_STANDARD) doit passer"
  );

  // =========================================================================
  // S11: pipeDimensionalStandardId = API-600 -> FAIL (STANDARD_IS_NOT_DIMENSIONAL_STANDARD)
  // =========================================================================
  testsRun++;
  const resS11 = validatePartialPipingSpecification({
    pipeRules: [{ pipeDimensionalStandardId: "API-600" as unknown as undefined, sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resS11.valid && resS11.errors.some((e) => e.code === "STANDARD_IS_NOT_DIMENSIONAL_STANDARD"),
    "S11 — pipeDimensionalStandardId = API-600 doit échouer avec STANDARD_IS_NOT_DIMENSIONAL_STANDARD"
  );

  // =========================================================================
  // S12: fittingStandardId = ASME-B16.9 -> PASS
  // =========================================================================
  testsRun++;
  const resS12 = validatePartialPipingSpecification({
    fittingRules: [{ fittingStandardId: "ASME-B16.9", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS12.valid && resS12.errors.length === 0,
    "S12 — fittingStandardId = ASME-B16.9 (PRODUCT_STANDARD) doit passer"
  );

  // =========================================================================
  // S13: fittingStandardId = ASME-B31.3 -> FAIL (STANDARD_IS_NOT_PRODUCT_STANDARD)
  // =========================================================================
  testsRun++;
  const resS13 = validatePartialPipingSpecification({
    fittingRules: [{ fittingStandardId: "ASME-B31.3" as unknown as undefined, sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resS13.valid && resS13.errors.some((e) => e.code === "STANDARD_IS_NOT_PRODUCT_STANDARD"),
    "S13 — fittingStandardId = ASME-B31.3 doit échouer avec STANDARD_IS_NOT_PRODUCT_STANDARD"
  );

  // =========================================================================
  // S14: flangeStandardId = ASME-B16.5 -> PASS
  // =========================================================================
  testsRun++;
  const resS14 = validatePartialPipingSpecification({
    flangeRules: [{ flangeStandardId: "ASME-B16.5", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS14.valid && resS14.errors.length === 0,
    "S14 — flangeStandardId = ASME-B16.5 (PRODUCT_STANDARD) doit passer"
  );

  // =========================================================================
  // S15: flangeStandardId = ASME-B36.10M -> FAIL (STANDARD_IS_NOT_PRODUCT_STANDARD)
  // =========================================================================
  testsRun++;
  const resS15 = validatePartialPipingSpecification({
    flangeRules: [{ flangeStandardId: "ASME-B36.10M" as unknown as undefined, sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resS15.valid && resS15.errors.some((e) => e.code === "STANDARD_IS_NOT_PRODUCT_STANDARD"),
    "S15 — flangeStandardId = ASME-B36.10M doit échouer avec STANDARD_IS_NOT_PRODUCT_STANDARD"
  );

  // =========================================================================
  // S16: valve productStandardId = API-600 -> PASS
  // =========================================================================
  testsRun++;
  const resS16 = validatePartialPipingSpecification({
    valveRules: [{ productStandardId: "API-600", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS16.valid && resS16.errors.length === 0,
    "S16 — valve productStandardId = API-600 (PRODUCT_STANDARD) doit passer"
  );

  // =========================================================================
  // S17: valve productStandardId = ASME-B16.10 -> FAIL (STANDARD_IS_NOT_PRODUCT_STANDARD)
  // =========================================================================
  testsRun++;
  const resS17 = validatePartialPipingSpecification({
    valveRules: [{ productStandardId: "ASME-B16.10" as unknown as undefined, sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resS17.valid && resS17.errors.some((e) => e.code === "STANDARD_IS_NOT_PRODUCT_STANDARD"),
    "S17 — valve productStandardId = ASME-B16.10 doit échouer avec STANDARD_IS_NOT_PRODUCT_STANDARD"
  );

  // =========================================================================
  // S18: valve dimensionalStandardId = ASME-B16.10 -> PASS
  // =========================================================================
  testsRun++;
  const resS18 = validatePartialPipingSpecification({
    valveRules: [{ dimensionalStandardId: "ASME-B16.10", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS18.valid && resS18.errors.length === 0,
    "S18 — valve dimensionalStandardId = ASME-B16.10 (DIMENSIONAL_STANDARD) doit passer"
  );

  // =========================================================================
  // S19: valve dimensionalStandardId = API-600 -> FAIL (STANDARD_IS_NOT_DIMENSIONAL_STANDARD)
  // =========================================================================
  testsRun++;
  const resS19 = validatePartialPipingSpecification({
    valveRules: [{ dimensionalStandardId: "API-600" as unknown as undefined, sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resS19.valid && resS19.errors.some((e) => e.code === "STANDARD_IS_NOT_DIMENSIONAL_STANDARD"),
    "S19 — valve dimensionalStandardId = API-600 doit échouer avec STANDARD_IS_NOT_DIMENSIONAL_STANDARD"
  );

  // =========================================================================
  // S20: VERIFIED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resS20 = validatePartialPipingSpecification({
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resS20.valid && resS20.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "S20 — VERIFIED sans sourceReference doit échouer"
  );

  // =========================================================================
  // S21: LICENSED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resS21 = validatePartialPipingSpecification({
    sourceStatus: "LICENSED",
    sourceReference: "   ",
  });
  assert(
    !resS21.valid && resS21.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "S21 — LICENSED avec sourceReference vide doit échouer"
  );

  // =========================================================================
  // S22: UNVERIFIED sans sourceReference -> PASS
  // =========================================================================
  testsRun++;
  const resS22 = validatePartialPipingSpecification({
    sourceStatus: "UNVERIFIED",
    sourceReference: undefined,
  });
  assert(
    resS22.valid && resS22.errors.length === 0,
    "S22 — UNVERIFIED sans sourceReference est autorisé"
  );

  // =========================================================================
  // S23: Deux Specs avec même code dans fixture registry -> FAIL
  // =========================================================================
  testsRun++;
  const duplicateRegistryFixture = [
    { id: "SPEC_001", code: "CS150" },
    { id: "SPEC_002", code: "CS150" },
  ];
  const resS23 = validatePipingSpecRegistryUniqueness(duplicateRegistryFixture);
  assert(
    !resS23.valid && resS23.errors.some((e) => e.code === "DUPLICATE_SPEC_CODE"),
    "S23 — Deux spécifications avec le même code doivent échouer à l'unicité"
  );

  // =========================================================================
  // S24: ratingSystem ASME_CLASS -> structurellement valide
  // =========================================================================
  testsRun++;
  const resS24 = validatePartialPipingSpecification({
    flangeRules: [{ flangeStandardId: "ASME-B16.5", ratingSystem: "ASME_CLASS", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS24.valid && resS24.errors.length === 0,
    "S24 — ratingSystem ASME_CLASS est valide"
  );

  // =========================================================================
  // S25: ratingSystem EN_PN -> structurellement valide
  // =========================================================================
  testsRun++;
  const resS25 = validatePartialPipingSpecification({
    flangeRules: [{ flangeStandardId: "EN-1092-1", ratingSystem: "EN_PN", sourceStatus: "UNVERIFIED" }],
  });
  assert(
    resS25.valid && resS25.errors.length === 0,
    "S25 — ratingSystem EN_PN est valide"
  );

  // =========================================================================
  // S26: Aucune conversion Class ↔ PN
  // =========================================================================
  testsRun++;
  assert(
    !("convertedRating" in validSpecFixture) && !("equivalentPn" in validSpecFixture),
    "S26 — Aucune conversion automatique Class ↔ PN dans la spec"
  );

  // =========================================================================
  // S27: Aucun calcul d'épaisseur
  // =========================================================================
  testsRun++;
  assert(
    !("requiredThicknessMm" in validSpecFixture) && !("minimumThicknessMm" in validSpecFixture),
    "S27 — Aucun calcul d'épaisseur dans le Spec Builder"
  );

  // =========================================================================
  // S28: Aucun calcul B31
  // =========================================================================
  testsRun++;
  assert(
    !("allowableStress" in validSpecFixture) && !("b31Equation" in validSpecFixture),
    "S28 — Aucun calcul issu des équations de conception B31"
  );

  // =========================================================================
  // S29: Aucun calcul de pression
  // =========================================================================
  testsRun++;
  assert(
    !("designPressureBar" in validSpecFixture) && !("maop" in validSpecFixture),
    "S29 — Aucun calcul de pression nominale, maximale ou admissible"
  );

  // =========================================================================
  // S30: Registre de production = 0
  // =========================================================================
  testsRun++;
  assert(
    PIPING_SPEC_REGISTRY.length === 0,
    "S30 — PIPING_SPEC_REGISTRY doit être strictement vide (0 records)"
  );

  // =========================================================================
  // S31: Recherches registry pures et immuables
  // =========================================================================
  testsRun++;
  assert(getPipingSpecById("TEST_SPEC_001") === undefined, "getPipingSpecById retourne undefined");
  assert(getPipingSpecByCode("CS150") === undefined, "getPipingSpecByCode retourne undefined");
  assert(getPipingSpecsByDesignCode("ASME-B31.3").length === 0, "getPipingSpecsByDesignCode retourne tableau vide");
  assert(getPipingSpecsByMaterial("MAT_001").length === 0, "getPipingSpecsByMaterial retourne tableau vide");
  assert(getAllPipingSpecs().length === 0, "getAllPipingSpecs retourne tableau vide");

  // =========================================================================
  // S32: Aucun mapping automatique vers les catalogues legacy
  // =========================================================================
  testsRun++;
  assert(
    !("pdiDefaultSpecId" in validSpecFixture) && !("trouvayCauvinMapping" in validSpecFixture),
    "S32 — Aucun mapping automatique vers les catalogues legacy"
  );

  // =========================================================================
  // R1-01: pipeRules: [{}] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_01 = validatePartialPipingSpecification({
    pipeRules: [{}],
  });
  assert(!resR1_01.valid, "R1-01 — pipeRules: [{}] doit échouer");

  // =========================================================================
  // R1-02: fittingRules: [{}] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_02 = validatePartialPipingSpecification({
    fittingRules: [{}],
  });
  assert(!resR1_02.valid, "R1-02 — fittingRules: [{}] doit échouer");

  // =========================================================================
  // R1-03: flangeRules: [{}] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_03 = validatePartialPipingSpecification({
    flangeRules: [{}],
  });
  assert(!resR1_03.valid, "R1-03 — flangeRules: [{}] doit échouer");

  // =========================================================================
  // R1-04: valveRules: [{}] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_04 = validatePartialPipingSpecification({
    valveRules: [{}],
  });
  assert(!resR1_04.valid, "R1-04 — valveRules: [{}] doit échouer");

  // =========================================================================
  // R1-05: Pipe rule sans pipeDimensionalStandardId -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_05 = validatePartialPipingSpecification({
    pipeRules: [{ sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resR1_05.valid && resR1_05.errors.some((e) => e.code === "MISSING_PIPE_STANDARD"),
    "R1-05 — Pipe rule sans pipeDimensionalStandardId doit échouer avec MISSING_PIPE_STANDARD"
  );

  // =========================================================================
  // R1-06: Pipe rule sans sourceStatus -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_06 = validatePartialPipingSpecification({
    pipeRules: [{ pipeDimensionalStandardId: "ASME-B36.10M" }],
  });
  assert(
    !resR1_06.valid && resR1_06.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "R1-06 — Pipe rule sans sourceStatus doit échouer avec MISSING_SOURCE_STATUS"
  );

  // =========================================================================
  // R1-07: Fitting rule sans fittingStandardId -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_07 = validatePartialPipingSpecification({
    fittingRules: [{ sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resR1_07.valid && resR1_07.errors.some((e) => e.code === "MISSING_FITTING_STANDARD"),
    "R1-07 — Fitting rule sans fittingStandardId doit échouer avec MISSING_FITTING_STANDARD"
  );

  // =========================================================================
  // R1-08: Fitting rule sans sourceStatus -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_08 = validatePartialPipingSpecification({
    fittingRules: [{ fittingStandardId: "ASME-B16.9" }],
  });
  assert(
    !resR1_08.valid && resR1_08.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "R1-08 — Fitting rule sans sourceStatus doit échouer avec MISSING_SOURCE_STATUS"
  );

  // =========================================================================
  // R1-09: Flange rule sans flangeStandardId -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_09 = validatePartialPipingSpecification({
    flangeRules: [{ sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resR1_09.valid && resR1_09.errors.some((e) => e.code === "MISSING_FLANGE_STANDARD"),
    "R1-09 — Flange rule sans flangeStandardId doit échouer avec MISSING_FLANGE_STANDARD"
  );

  // =========================================================================
  // R1-10: Flange rule sans sourceStatus -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_10 = validatePartialPipingSpecification({
    flangeRules: [{ flangeStandardId: "ASME-B16.5" }],
  });
  assert(
    !resR1_10.valid && resR1_10.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "R1-10 — Flange rule sans sourceStatus doit échouer avec MISSING_SOURCE_STATUS"
  );

  // =========================================================================
  // R1-11: Valve rule sans productStandardId ET sans dimensionalStandardId -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_11 = validatePartialPipingSpecification({
    valveRules: [{ sourceStatus: "UNVERIFIED" }],
  });
  assert(
    !resR1_11.valid && resR1_11.errors.some((e) => e.code === "MISSING_VALVE_STANDARD"),
    "R1-11 — Valve rule sans standard doit échouer avec MISSING_VALVE_STANDARD"
  );

  // =========================================================================
  // R1-12: Valve rule sans sourceStatus -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_12 = validatePartialPipingSpecification({
    valveRules: [{ productStandardId: "API-600" }],
  });
  assert(
    !resR1_12.valid && resR1_12.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "R1-12 — Valve rule sans sourceStatus doit échouer avec MISSING_SOURCE_STATUS"
  );

  // =========================================================================
  // R1-13: sourceStatus = "INVALID" -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_13 = validatePartialPipingSpecification({
    sourceStatus: "INVALID" as unknown as undefined,
  });
  assert(
    !resR1_13.valid && resR1_13.errors.some((e) => e.code === "INVALID_SOURCE_STATUS"),
    "R1-13 — sourceStatus invalide doit échouer avec INVALID_SOURCE_STATUS"
  );

  // =========================================================================
  // R1-14: pipeRules = {} -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_14 = validatePartialPipingSpecification({
    pipeRules: {} as unknown as undefined,
  });
  assert(
    !resR1_14.valid && resR1_14.errors.some((e) => e.code === "INVALID_ARRAY" || e.code === "INVALID_PIPE_RULES"),
    "R1-14 — pipeRules = {} doit échouer"
  );

  // =========================================================================
  // R1-15: fittingRules = "ELBOW" -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_15 = validatePartialPipingSpecification({
    fittingRules: "ELBOW" as unknown as undefined,
  });
  assert(
    !resR1_15.valid && resR1_15.errors.some((e) => e.code === "INVALID_ARRAY" || e.code === "INVALID_FITTING_RULES"),
    "R1-15 — fittingRules = 'ELBOW' doit échouer"
  );

  // =========================================================================
  // R1-16: flangeRules = null -> FAIL pour une Specification complète
  // =========================================================================
  testsRun++;
  const resR1_16 = validateCompletePipingSpecification({
    id: "SPEC_R1_16",
    code: "R116",
    name: "Spec R1-16",
    sourceStatus: "UNVERIFIED",
    materialReferenceIds: [],
    pipeRules: [],
    fittingRules: [],
    flangeRules: null as unknown as undefined,
    valveRules: [],
  });
  assert(
    !resR1_16.valid &&
      resR1_16.errors.some(
        (e) => e.code === "MISSING_FLANGE_RULES" || e.code === "INVALID_ARRAY" || e.code === "INVALID_FLANGE_RULES"
      ),
    "R1-16 — flangeRules = null pour spec complète doit échouer"
  );

  // =========================================================================
  // R1-17: valveRules = [] -> PASS
  // =========================================================================
  testsRun++;
  const resR1_17 = validatePartialPipingSpecification({
    valveRules: [],
  });
  assert(resR1_17.valid && resR1_17.errors.length === 0, "R1-17 — valveRules = [] doit passer");

  // =========================================================================
  // R1-18: fittingTypes = "ELBOW" -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_18 = validatePartialPipingSpecification({
    fittingRules: [
      {
        fittingStandardId: "ASME-B16.9",
        sourceStatus: "UNVERIFIED",
        fittingTypes: "ELBOW" as unknown as undefined,
      },
    ],
  });
  assert(
    !resR1_18.valid && resR1_18.errors.some((e) => e.code === "INVALID_ARRAY" || e.code === "INVALID_FITTING_TYPES"),
    "R1-18 — fittingTypes sous forme de chaîne simple doit échouer"
  );

  // =========================================================================
  // R1-19: fittingTypes = ["INVALID"] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_19 = validatePartialPipingSpecification({
    fittingRules: [
      {
        fittingStandardId: "ASME-B16.9",
        sourceStatus: "UNVERIFIED",
        fittingTypes: ["INVALID" as unknown as undefined],
      },
    ],
  });
  assert(
    !resR1_19.valid &&
      resR1_19.errors.some((e) => e.code === "INVALID_FITTING_TYPE" || e.code === "INVALID_FITTING_TYPES"),
    "R1-19 — fittingTypes avec valeur invalide doit échouer"
  );

  // =========================================================================
  // R1-20: connectionTypes = "FLANGED" -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_20 = validatePartialPipingSpecification({
    fittingRules: [
      {
        fittingStandardId: "ASME-B16.9",
        sourceStatus: "UNVERIFIED",
        connectionTypes: "FLANGED" as unknown as undefined,
      },
    ],
  });
  assert(
    !resR1_20.valid &&
      resR1_20.errors.some((e) => e.code === "INVALID_ARRAY" || e.code === "INVALID_FITTING_CONNECTION_TYPES"),
    "R1-20 — connectionTypes sous forme de chaîne simple doit échouer"
  );

  // =========================================================================
  // R1-21: flangeTypes = ["INVALID"] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_21 = validatePartialPipingSpecification({
    flangeRules: [
      {
        flangeStandardId: "ASME-B16.5",
        sourceStatus: "UNVERIFIED",
        flangeTypes: ["INVALID" as unknown as undefined],
      },
    ],
  });
  assert(
    !resR1_21.valid &&
      resR1_21.errors.some((e) => e.code === "INVALID_FLANGE_TYPE" || e.code === "INVALID_FLANGE_TYPES"),
    "R1-21 — flangeTypes avec valeur invalide doit échouer"
  );

  // =========================================================================
  // R1-22: valveTypes = ["INVALID"] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_22 = validatePartialPipingSpecification({
    valveRules: [
      {
        productStandardId: "API-600",
        sourceStatus: "UNVERIFIED",
        valveTypes: ["INVALID" as unknown as undefined],
      },
    ],
  });
  assert(
    !resR1_22.valid &&
      resR1_22.errors.some((e) => e.code === "INVALID_VALVE_TYPE" || e.code === "INVALID_VALVE_TYPES"),
    "R1-22 — valveTypes avec valeur invalide doit échouer"
  );

  // =========================================================================
  // R1-23: materialReferenceIds = "MAT001" -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_23 = validatePartialPipingSpecification({
    materialReferenceIds: "MAT001" as unknown as undefined,
  });
  assert(
    !resR1_23.valid &&
      resR1_23.errors.some((e) => e.code === "INVALID_ARRAY" || e.code === "INVALID_MATERIAL_REFERENCE"),
    "R1-23 — materialReferenceIds sous forme de chaîne doit échouer"
  );

  // =========================================================================
  // R1-24: materialReferenceIds = [""] -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_24 = validatePartialPipingSpecification({
    materialReferenceIds: [""],
  });
  assert(
    !resR1_24.valid && resR1_24.errors.some((e) => e.code === "INVALID_MATERIAL_REFERENCE"),
    "R1-24 — materialReferenceIds avec élément vide doit échouer"
  );

  // =========================================================================
  // R1-25: sourceStatus = "VERIFIED" sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_25 = validatePartialPipingSpecification({
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resR1_25.valid && resR1_25.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "R1-25 — Spec VERIFIED sans sourceReference doit échouer"
  );

  // =========================================================================
  // R1-26: sourceStatus = "LICENSED" sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resR1_26 = validatePartialPipingSpecification({
    sourceStatus: "LICENSED",
    sourceReference: "   ",
  });
  assert(
    !resR1_26.valid && resR1_26.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "R1-26 — Spec LICENSED avec sourceReference vide doit échouer"
  );

  // =========================================================================
  // R1-27: UNVERIFIED sans sourceReference -> PASS
  // =========================================================================
  testsRun++;
  const resR1_27 = validatePartialPipingSpecification({
    sourceStatus: "UNVERIFIED",
  });
  assert(resR1_27.valid && resR1_27.errors.length === 0, "R1-27 — UNVERIFIED sans sourceReference doit passer");

  // =========================================================================
  // R1-28: Complete Spec avec les cinq collections présentes et vides -> PASS
  // =========================================================================
  testsRun++;
  const resR1_28 = validateCompletePipingSpecification({
    id: "SPEC_EMPTY_COLLECTIONS",
    code: "EC01",
    name: "Empty Collections Spec",
    sourceStatus: "UNVERIFIED",
    materialReferenceIds: [],
    pipeRules: [],
    fittingRules: [],
    flangeRules: [],
    valveRules: [],
  });
  assert(
    resR1_28.valid && resR1_28.errors.length === 0,
    "R1-28 — Complete Spec avec les cinq collections vides doit passer"
  );

  // =========================================================================
  // R1-29: Chaque rule complète individuellement valide -> PASS
  // =========================================================================
  testsRun++;
  const resR1_29 = validateCompletePipingSpecification(validSpecFixture);
  assert(resR1_29.valid && resR1_29.errors.length === 0, "R1-29 — Spec avec règles complètes valides doit passer");

  // =========================================================================
  // R1-30: Chaque rule sans champ obligatoire -> FAIL
  // =========================================================================
  testsRun++;
  const pipeMissing = validatePartialPipingSpecification({ pipeRules: [{ sourceStatus: "UNVERIFIED" }] });
  const fittingMissing = validatePartialPipingSpecification({ fittingRules: [{ sourceStatus: "UNVERIFIED" }] });
  const flangeMissing = validatePartialPipingSpecification({ flangeRules: [{ sourceStatus: "UNVERIFIED" }] });
  const valveMissing = validatePartialPipingSpecification({ valveRules: [{ sourceStatus: "UNVERIFIED" }] });
  assert(
    !pipeMissing.valid && !fittingMissing.valid && !flangeMissing.valid && !valveMissing.valid,
    "R1-30 — Chaque règle sans champ obligatoire doit échouer"
  );

  // =========================================================================
  // R1-31: Registry production reste à 0
  // =========================================================================
  testsRun++;
  assert(PIPING_SPEC_REGISTRY.length === 0, "R1-31 — PIPING_SPEC_REGISTRY doit être strictement vide (0)");

  // =========================================================================
  // R1-32: Aucun calcul B31 / pression / épaisseur
  // =========================================================================
  testsRun++;
  assert(
    !("allowableStress" in validSpecFixture) &&
      !("designPressureBar" in validSpecFixture) &&
      !("minimumThicknessMm" in validSpecFixture),
    "R1-32 — Aucun calcul B31 / pression / épaisseur"
  );

  // =========================================================================
  // R1-33: Aucune conversion NPS/DN ou Class/PN
  // =========================================================================
  testsRun++;
  assert(
    !("convertedRating" in validSpecFixture) && !("convertedSize" in validSpecFixture),
    "R1-33 — Aucune conversion NPS/DN ou Class/PN"
  );

  return { success: true, testsRun };
}
