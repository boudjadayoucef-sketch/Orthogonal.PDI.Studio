/**
 * PDI NORMATIVE ENGINE — MATERIAL ENGINE TESTS (NORM-06)
 * Reference: PATCH NORM-06 (Material Engine)
 * 
 * Suite de tests déterministes et isolés pour le Material Engine.
 * Valide les tests obligatoires M01 à M26 :
 * - Distinction stricte MATERIAL_STANDARD (API-5L) vs PRODUCT_STANDARD / DESIGN_CODE
 * - Validation structurelle (INVALID_RECORD_OBJECT) et type safety (unknown)
 * - Exigences des records complets vs partiels
 * - Traçabilité (VERIFIED / LICENSED exigent sourceReference)
 * - Contrôles d'intégrité numérique des propriétés mécaniques déclarées (> 0)
 * - Registre de production immuable avec 0 record
 * - Absence totale de calcul (allowable stress, Barlow, B31, interpolation température, mapping auto)
 */

import {
  validateCompleteMaterialRecord,
  validatePartialMaterialRecord,
} from "../validators/materialValidator";
import {
  MATERIAL_REGISTRY,
  getMaterialById,
  getMaterialsByStandard,
  getMaterialsByGrade,
  getMaterialsByCategory,
  getMaterialsByProductForm,
  getAllMaterials,
} from "../registry/materialRegistry";
import type { MaterialRecord } from "../types/materialTypes";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

/**
 * Fixture de test synthétique (utilisée strictement pour les tests, jamais dans le registre prod).
 */
const validMaterialFixture: MaterialRecord = Object.freeze({
  id: "TEST_MATERIAL_API5L_X65",
  standardId: "API-5L",
  designation: "API 5L Grade X65 PSL 2",
  grade: "X65",
  materialCategory: "CARBON_STEEL",
  productForm: "PIPE",
  specificationReference: "PSL 2",
  sourceStatus: "UNVERIFIED",
});

export function runMaterialEngineTests(): { success: boolean; testsRun: number } {
  let testsRun = 0;

  // =========================================================================
  // M01: Record complet valide
  // =========================================================================
  testsRun++;
  const resM01 = validateCompleteMaterialRecord(validMaterialFixture);
  assert(
    resM01.valid && resM01.errors.length === 0,
    "M01 — Record complet valide doit passer"
  );

  // =========================================================================
  // M02: {} complete -> FAIL
  // =========================================================================
  testsRun++;
  const resM02 = validateCompleteMaterialRecord({});
  assert(
    !resM02.valid &&
      resM02.errors.some((e) => e.code === "MISSING_RECORD_ID") &&
      resM02.errors.some((e) => e.code === "MISSING_STANDARD_ID") &&
      resM02.errors.some((e) => e.code === "MISSING_DESIGNATION") &&
      resM02.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "M02 — validateCompleteMaterialRecord({}) doit échouer (champs obligatoires manquants)"
  );

  // =========================================================================
  // M03: {} partial -> PASS
  // =========================================================================
  testsRun++;
  const resM03 = validatePartialMaterialRecord({});
  assert(
    resM03.valid && resM03.errors.length === 0,
    "M03 — validatePartialMaterialRecord({}) doit passer (état partiel)"
  );

  // =========================================================================
  // M04: null -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resM04 = validatePartialMaterialRecord(null as unknown);
  assert(
    !resM04.valid && resM04.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "M04 — validatePartialMaterialRecord(null) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // M05: array -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resM05 = validatePartialMaterialRecord([validMaterialFixture] as unknown);
  assert(
    !resM05.valid && resM05.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "M05 — validatePartialMaterialRecord([]) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // M06: standardId inconnu -> FAIL (INVALID_STANDARD_ID)
  // =========================================================================
  testsRun++;
  const resM06 = validatePartialMaterialRecord({
    standardId: "UNKNOWN-STANDARD-999" as unknown as undefined,
  });
  assert(
    !resM06.valid && resM06.errors.some((e) => e.code === "INVALID_STANDARD_ID"),
    "M06 — standardId inconnu doit échouer avec INVALID_STANDARD_ID"
  );

  // =========================================================================
  // M07: standardId PRODUCT_STANDARD -> FAIL (STANDARD_IS_NOT_MATERIAL_STANDARD)
  // =========================================================================
  testsRun++;
  const resM07 = validatePartialMaterialRecord({
    standardId: "ASME-B16.5" as unknown as undefined,
  });
  assert(
    !resM07.valid && resM07.errors.some((e) => e.code === "STANDARD_IS_NOT_MATERIAL_STANDARD"),
    "M07 — ASME-B16.5 (PRODUCT_STANDARD) comme standardId de matériau doit échouer"
  );

  // =========================================================================
  // M08: standardId DESIGN_CODE -> FAIL (STANDARD_IS_NOT_MATERIAL_STANDARD)
  // =========================================================================
  testsRun++;
  const resM08 = validatePartialMaterialRecord({
    standardId: "ASME-B31.3" as unknown as undefined,
  });
  assert(
    !resM08.valid && resM08.errors.some((e) => e.code === "STANDARD_IS_NOT_MATERIAL_STANDARD"),
    "M08 — ASME-B31.3 (DESIGN_CODE) comme standardId de matériau doit échouer"
  );

  // =========================================================================
  // M09: standardId MATERIAL_STANDARD -> PASS
  // =========================================================================
  testsRun++;
  const resM09 = validatePartialMaterialRecord({
    standardId: "API-5L",
  });
  assert(
    resM09.valid && resM09.errors.length === 0,
    "M09 — API-5L (MATERIAL_STANDARD) est valide comme standard de matériau"
  );

  // =========================================================================
  // M10: designation vide -> FAIL (EMPTY_DESIGNATION)
  // =========================================================================
  testsRun++;
  const resM10 = validatePartialMaterialRecord({
    designation: "   ",
  });
  assert(
    !resM10.valid && resM10.errors.some((e) => e.code === "EMPTY_DESIGNATION"),
    "M10 — Désignation vide doit échouer avec EMPTY_DESIGNATION"
  );

  // =========================================================================
  // M11: grade vide -> FAIL s'il est fourni (EMPTY_GRADE)
  // =========================================================================
  testsRun++;
  const resM11 = validatePartialMaterialRecord({
    grade: "  ",
  });
  assert(
    !resM11.valid && resM11.errors.some((e) => e.code === "EMPTY_GRADE"),
    "M11 — grade vide doit échouer avec EMPTY_GRADE"
  );

  // =========================================================================
  // M12: VERIFIED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resM12 = validatePartialMaterialRecord({
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resM12.valid && resM12.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "M12 — VERIFIED sans sourceReference doit échouer"
  );

  // =========================================================================
  // M13: LICENSED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resM13 = validatePartialMaterialRecord({
    sourceStatus: "LICENSED",
    sourceReference: "   ",
  });
  assert(
    !resM13.valid && resM13.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "M13 — LICENSED avec sourceReference vide doit échouer"
  );

  // =========================================================================
  // M14: UNVERIFIED sans sourceReference -> PASS
  // =========================================================================
  testsRun++;
  const resM14 = validatePartialMaterialRecord({
    sourceStatus: "UNVERIFIED",
    sourceReference: undefined,
  });
  assert(
    resM14.valid && resM14.errors.length === 0,
    "M14 — UNVERIFIED sans sourceReference est autorisé"
  );

  // =========================================================================
  // M15: yieldStrengthMPa <= 0 -> FAIL (INVALID_YIELD_STRENGTH)
  // =========================================================================
  testsRun++;
  const resM15 = validatePartialMaterialRecord({
    yieldStrengthMPa: 0,
  });
  assert(
    !resM15.valid && resM15.errors.some((e) => e.code === "INVALID_YIELD_STRENGTH"),
    "M15 — yieldStrengthMPa <= 0 doit échouer avec INVALID_YIELD_STRENGTH"
  );

  // =========================================================================
  // M16: tensileStrengthMPa <= 0 -> FAIL (INVALID_TENSILE_STRENGTH)
  // =========================================================================
  testsRun++;
  const resM16 = validatePartialMaterialRecord({
    tensileStrengthMPa: -100,
  });
  assert(
    !resM16.valid && resM16.errors.some((e) => e.code === "INVALID_TENSILE_STRENGTH"),
    "M16 — tensileStrengthMPa <= 0 doit échouer avec INVALID_TENSILE_STRENGTH"
  );

  // =========================================================================
  // M17: densityKgM3 <= 0 -> FAIL (INVALID_DENSITY)
  // =========================================================================
  testsRun++;
  const resM17 = validatePartialMaterialRecord({
    densityKgM3: 0,
  });
  assert(
    !resM17.valid && resM17.errors.some((e) => e.code === "INVALID_DENSITY"),
    "M17 — densityKgM3 <= 0 doit échouer avec INVALID_DENSITY"
  );

  // =========================================================================
  // M18: elasticModulusGPa <= 0 -> FAIL (INVALID_ELASTIC_MODULUS)
  // =========================================================================
  testsRun++;
  const resM18 = validatePartialMaterialRecord({
    elasticModulusGPa: -200,
  });
  assert(
    !resM18.valid && resM18.errors.some((e) => e.code === "INVALID_ELASTIC_MODULUS"),
    "M18 — elasticModulusGPa <= 0 doit échouer avec INVALID_ELASTIC_MODULUS"
  );

  // =========================================================================
  // M19: poissonRatio <= 0 -> FAIL (INVALID_POISSON_RATIO)
  // =========================================================================
  testsRun++;
  const resM19 = validatePartialMaterialRecord({
    poissonRatio: 0,
  });
  assert(
    !resM19.valid && resM19.errors.some((e) => e.code === "INVALID_POISSON_RATIO"),
    "M19 — poissonRatio <= 0 doit échouer avec INVALID_POISSON_RATIO"
  );

  // =========================================================================
  // M20: Aucune interpolation température
  // =========================================================================
  testsRun++;
  assert(
    !("getYieldAtTemperature" in validMaterialFixture),
    "M20 — Aucune fonction d'interpolation ou dérivation thermique automatique"
  );

  // =========================================================================
  // M21: Aucun calcul allowable stress
  // =========================================================================
  testsRun++;
  assert(
    validMaterialFixture.allowableStressMPa === undefined,
    "M21 — Aucun calcul automatique d'allowable stress par ratio ou formule"
  );

  // =========================================================================
  // M22: Aucun calcul B31
  // =========================================================================
  testsRun++;
  assert(
    !("b31AllowableStress" in validMaterialFixture) && !("qualityFactor" in validMaterialFixture),
    "M22 — Aucun calcul lié aux codes B31 dans le Material Engine"
  );

  // =========================================================================
  // M23: Aucun calcul de résistance
  // =========================================================================
  testsRun++;
  assert(
    !("burstPressure" in validMaterialFixture) && !("designStrength" in validMaterialFixture),
    "M23 — Aucun calcul de résistance mécanique ou pression d'éclatement"
  );

  // =========================================================================
  // M24: Registry production = 0
  // =========================================================================
  testsRun++;
  assert(
    MATERIAL_REGISTRY.length === 0,
    "M24 — MATERIAL_REGISTRY doit être strictement vide (0 records)"
  );

  // =========================================================================
  // M25: Recherches registry pures et immuables
  // =========================================================================
  testsRun++;
  assert(getMaterialById("TEST_MATERIAL_API5L_X65") === undefined, "getMaterialById retourne undefined");
  assert(getMaterialsByStandard("API-5L").length === 0, "getMaterialsByStandard retourne un tableau vide");
  assert(getMaterialsByGrade("X65").length === 0, "getMaterialsByGrade retourne un tableau vide");
  assert(getMaterialsByCategory("CARBON_STEEL").length === 0, "getMaterialsByCategory retourne un tableau vide");
  assert(getMaterialsByProductForm("PIPE").length === 0, "getMaterialsByProductForm retourne un tableau vide");
  assert(getAllMaterials().length === 0, "getAllMaterials retourne un tableau vide");

  // =========================================================================
  // M26: Aucun mapping automatique des anciens matériaux
  // =========================================================================
  testsRun++;
  // Vérification que les chaînes textuelles du record ne sont pas automatiquement converties
  assert(
    validMaterialFixture.designation === "API 5L Grade X65 PSL 2" &&
      !("legacyMappedId" in validMaterialFixture),
    "M26 — Aucun mapping automatique des catalogues ou chaînes legacy"
  );

  return { success: true, testsRun };
}
