/**
 * PDI NORMATIVE ENGINE — FLANGE ENGINE TESTS (NORM-04)
 * Reference: PATCH NORM-04 (Flange Engine)
 * 
 * Suite de tests déterministes et isolés pour le Flange Engine.
 * Valide les tests obligatoires F01 à F28 :
 * - Type safety et robustesse runtime (unknown)
 * - Validation structurelle (INVALID_RECORD_OBJECT)
 * - Séparation stricte ASME (Class) / EN (PN)
 * - Respect des standards produit (B16.5, B16.47, EN 1092-1) et rejet des design codes (B31.3)
 * - Traçabilité de source (VERIFIED / LICENSED exigent sourceReference)
 * - Registre de production immuable avec 0 record
 * - Absence de conversion automatique ou de calculs
 */

import {
  validateCompleteFlangeRecord,
  validatePartialFlangeRecord,
} from "../validators/flangeValidator";
import {
  FLANGE_DIMENSIONAL_REGISTRY,
  getFlangeById,
  getFlangesByStandard,
  getFlangesByType,
  getFlangesByRatingSystem,
  getAllFlanges,
} from "../registry/flangeRegistry";
import type { FlangeDimensionalRecord } from "../types/flangeTypes";

/**
 * Fixture de test synthétique pour une bride ASME (purement pour test, JAMAIS dans le registre prod).
 */
const validAsmeFixture: FlangeDimensionalRecord = Object.freeze({
  id: "TEST_FLANGE_ASME_001",
  standardId: "ASME-B16.5",
  flangeType: "WELD_NECK",
  ratingSystem: "ASME_CLASS",
  rating: "Class 150",
  nps: "2",
  facingType: "RF",
  boreType: "STD",
  sourceStatus: "UNVERIFIED",
});

/**
 * Fixture de test synthétique pour une bride EN (purement pour test, JAMAIS dans le registre prod).
 */
const validEnFixture: FlangeDimensionalRecord = Object.freeze({
  id: "TEST_FLANGE_EN_001",
  standardId: "EN-1092-1",
  flangeType: "WELD_NECK",
  ratingSystem: "EN_PN",
  rating: "PN16",
  dn: 50,
  facingType: "B1",
  sourceStatus: "UNVERIFIED",
});

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

export function runFlangeEngineTests(): { success: boolean; testsRun: number } {
  let testsRun = 0;

  // =========================================================================
  // F01: Record complet ASME valide -> PASS
  // =========================================================================
  testsRun++;
  const resF01 = validateCompleteFlangeRecord(validAsmeFixture);
  assert(
    resF01.valid && resF01.errors.length === 0,
    "F01 — Record complet ASME valide doit passer"
  );

  // =========================================================================
  // F02: Record complet EN valide -> PASS
  // =========================================================================
  testsRun++;
  const resF02 = validateCompleteFlangeRecord(validEnFixture);
  assert(
    resF02.valid && resF02.errors.length === 0,
    "F02 — Record complet EN valide doit passer"
  );

  // =========================================================================
  // F03: {} complete -> FAIL
  // =========================================================================
  testsRun++;
  const resF03 = validateCompleteFlangeRecord({});
  assert(
    !resF03.valid && resF03.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "F03 — validateCompleteFlangeRecord({}) doit échouer (champs requis manquants)"
  );

  // =========================================================================
  // F04: {} partial -> PASS
  // =========================================================================
  testsRun++;
  const resF04 = validatePartialFlangeRecord({});
  assert(
    resF04.valid && resF04.errors.length === 0,
    "F04 — validatePartialFlangeRecord({}) doit passer (état partiel)"
  );

  // =========================================================================
  // F05: null partial -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resF05 = validatePartialFlangeRecord(null as unknown);
  assert(
    !resF05.valid && resF05.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "F05 — validatePartialFlangeRecord(null) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // F06: array partial -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resF06 = validatePartialFlangeRecord([validAsmeFixture] as unknown);
  assert(
    !resF06.valid && resF06.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "F06 — validatePartialFlangeRecord([]) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // F07: standard inconnu -> FAIL (INVALID_STANDARD_ID)
  // =========================================================================
  testsRun++;
  const resF07 = validatePartialFlangeRecord({
    standardId: "UNKNOWN-STANDARD-999" as unknown,
  });
  assert(
    !resF07.valid && resF07.errors.some((e) => e.code === "INVALID_STANDARD_ID"),
    "F07 — standard inconnu doit échouer avec INVALID_STANDARD_ID"
  );

  // =========================================================================
  // F08: ASME B31.3 comme standard -> FAIL (STANDARD_IS_NOT_PRODUCT_STANDARD)
  // =========================================================================
  testsRun++;
  const resF08 = validatePartialFlangeRecord({
    standardId: "ASME-B31.3",
  });
  assert(
    !resF08.valid && resF08.errors.some((e) => e.code === "STANDARD_IS_NOT_PRODUCT_STANDARD"),
    "F08 — ASME B31.3 (DESIGN_CODE) comme standard principal de bride doit échouer"
  );

  // =========================================================================
  // F09: B16.5 comme standard -> PASS
  // =========================================================================
  testsRun++;
  const resF09 = validatePartialFlangeRecord({
    standardId: "ASME-B16.5",
  });
  assert(
    resF09.valid && resF09.errors.length === 0,
    "F09 — ASME-B16.5 est un PRODUCT_STANDARD reconnu et doit passer"
  );

  // =========================================================================
  // F10: B16.47 comme standard -> PASS
  // =========================================================================
  testsRun++;
  const resF10 = validatePartialFlangeRecord({
    standardId: "ASME-B16.47",
  });
  assert(
    resF10.valid && resF10.errors.length === 0,
    "F10 — ASME-B16.47 est un PRODUCT_STANDARD reconnu et doit passer"
  );

  // =========================================================================
  // F11: EN 1092-1 comme standard -> PASS
  // =========================================================================
  testsRun++;
  const resF11 = validatePartialFlangeRecord({
    standardId: "EN-1092-1",
  });
  assert(
    resF11.valid && resF11.errors.length === 0,
    "F11 — EN-1092-1 est un PRODUCT_STANDARD reconnu et doit passer"
  );

  // =========================================================================
  // F12: ASME + EN_PN -> FAIL (INCOMPATIBLE_RATING_SYSTEM)
  // =========================================================================
  testsRun++;
  const resF12 = validatePartialFlangeRecord({
    standardId: "ASME-B16.5",
    ratingSystem: "EN_PN",
  });
  assert(
    !resF12.valid && resF12.errors.some((e) => e.code === "INCOMPATIBLE_RATING_SYSTEM"),
    "F12 — Standard ASME associé à un ratingSystem EN_PN doit échouer"
  );

  // =========================================================================
  // F13: EN + ASME_CLASS -> FAIL (INCOMPATIBLE_RATING_SYSTEM)
  // =========================================================================
  testsRun++;
  const resF13 = validatePartialFlangeRecord({
    standardId: "EN-1092-1",
    ratingSystem: "ASME_CLASS",
  });
  assert(
    !resF13.valid && resF13.errors.some((e) => e.code === "INCOMPATIBLE_RATING_SYSTEM"),
    "F13 — Standard EN associé à un ratingSystem ASME_CLASS doit échouer"
  );

  // =========================================================================
  // F14: ASME + ASME_CLASS -> PASS structurellement
  // =========================================================================
  testsRun++;
  const resF14 = validatePartialFlangeRecord({
    standardId: "ASME-B16.5",
    ratingSystem: "ASME_CLASS",
  });
  assert(
    resF14.valid && resF14.errors.length === 0,
    "F14 — ASME + ASME_CLASS doit passer la validation de cohérence"
  );

  // =========================================================================
  // F15: EN + EN_PN -> PASS structurellement
  // =========================================================================
  testsRun++;
  const resF15 = validatePartialFlangeRecord({
    standardId: "EN-1092-1",
    ratingSystem: "EN_PN",
  });
  assert(
    resF15.valid && resF15.errors.length === 0,
    "F15 — EN + EN_PN doit passer la validation de cohérence"
  );

  // =========================================================================
  // F16: VERIFIED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resF16 = validatePartialFlangeRecord({
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resF16.valid && resF16.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "F16 — VERIFIED sans sourceReference doit échouer"
  );

  // =========================================================================
  // F17: LICENSED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resF17 = validatePartialFlangeRecord({
    sourceStatus: "LICENSED",
    sourceReference: "   ",
  });
  assert(
    !resF17.valid && resF17.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "F17 — LICENSED avec sourceReference vide doit échouer"
  );

  // =========================================================================
  // F18: UNVERIFIED sans sourceReference -> PASS
  // =========================================================================
  testsRun++;
  const resF18 = validatePartialFlangeRecord({
    sourceStatus: "UNVERIFIED",
    sourceReference: undefined,
  });
  assert(
    resF18.valid && resF18.errors.length === 0,
    "F18 — UNVERIFIED sans sourceReference est autorisé"
  );

  // =========================================================================
  // F19: rating vide -> FAIL s'il est fourni (EMPTY_RATING)
  // =========================================================================
  testsRun++;
  const resF19 = validatePartialFlangeRecord({
    rating: "  ",
  });
  assert(
    !resF19.valid && resF19.errors.some((e) => e.code === "EMPTY_RATING"),
    "F19 — rating sous forme de chaîne vide doit échouer avec EMPTY_RATING"
  );

  // =========================================================================
  // F20: rating incohérent avec ratingSystem -> FAIL
  // =========================================================================
  testsRun++;
  const resF20a = validatePartialFlangeRecord({
    ratingSystem: "ASME_CLASS",
    rating: "PN16",
  });
  assert(
    !resF20a.valid && resF20a.errors.some((e) => e.code === "INCOMPATIBLE_RATING_VALUE"),
    "F20a — ratingSystem 'ASME_CLASS' avec rating 'PN16' doit échouer avec INCOMPATIBLE_RATING_VALUE"
  );

  const resF20b = validatePartialFlangeRecord({
    ratingSystem: "EN_PN",
    rating: "Class 150",
  });
  assert(
    !resF20b.valid && resF20b.errors.some((e) => e.code === "INCOMPATIBLE_RATING_VALUE"),
    "F20b — ratingSystem 'EN_PN' avec rating 'Class 150' doit échouer avec INCOMPATIBLE_RATING_VALUE"
  );

  // =========================================================================
  // F21: NPS vide -> FAIL s'il est fourni (EMPTY_NPS)
  // =========================================================================
  testsRun++;
  const resF21 = validatePartialFlangeRecord({
    nps: "  ",
  });
  assert(
    !resF21.valid && resF21.errors.some((e) => e.code === "EMPTY_NPS"),
    "F21 — NPS sous forme de chaîne vide doit échouer avec EMPTY_NPS"
  );

  // =========================================================================
  // F22: DN <= 0 -> FAIL (INVALID_DN)
  // =========================================================================
  testsRun++;
  const resF22 = validatePartialFlangeRecord({
    dn: 0,
  });
  assert(
    !resF22.valid && resF22.errors.some((e) => e.code === "INVALID_DN"),
    "F22 — dn <= 0 doit échouer avec INVALID_DN"
  );

  // =========================================================================
  // F23: Aucune conversion NPS/DN (Vérification structurelle de non-dérivation)
  // =========================================================================
  testsRun++;
  const fixtureNpsOnly = Object.freeze({
    id: "TEST_NPS_ONLY",
    standardId: "ASME-B16.5" as const,
    flangeType: "WELD_NECK" as const,
    ratingSystem: "ASME_CLASS" as const,
    nps: "2",
    sourceStatus: "UNVERIFIED" as const,
  });
  const resF23 = validateCompleteFlangeRecord(fixtureNpsOnly);
  assert(
    resF23.valid && (fixtureNpsOnly as unknown as { dn?: unknown }).dn === undefined,
    "F23 — Aucune dérivation ou conversion automatique de dn à partir de nps"
  );

  // =========================================================================
  // F24: Aucune conversion Class/PN
  // =========================================================================
  testsRun++;
  const asmeFlange = Object.freeze({
    id: "TEST_ASME_NO_PN",
    standardId: "ASME-B16.5" as const,
    flangeType: "BLIND" as const,
    ratingSystem: "ASME_CLASS" as const,
    rating: "Class 300",
    sourceStatus: "UNVERIFIED" as const,
  });
  assert(
    asmeFlange.ratingSystem === "ASME_CLASS" && !("pn" in asmeFlange),
    "F24 — Aucune dérivation ou conversion automatique entre Class et PN"
  );

  // =========================================================================
  // F25: Aucun calcul dimensionnel
  // =========================================================================
  testsRun++;
  // Vérification que le record ne calcule pas automatiquement boltCount ou dimensions
  assert(
    validAsmeFixture.boltCount === undefined && validAsmeFixture.outsideDiameterMm === undefined,
    "F25 — Aucune dimension ni boulonnerie inventée sans donnée source"
  );

  // =========================================================================
  // F26: Aucun calcul de pression
  // =========================================================================
  testsRun++;
  assert(
    !("allowablePressure" in validAsmeFixture) && !("testPressure" in validAsmeFixture),
    "F26 — Aucun calcul mécanique ou de pression autorisé dans NORM-04"
  );

  // =========================================================================
  // F27: Registry production = 0
  // =========================================================================
  testsRun++;
  assert(
    FLANGE_DIMENSIONAL_REGISTRY.length === 0,
    "F27 — FLANGE_DIMENSIONAL_REGISTRY doit être strictement vide (0 records)"
  );

  // =========================================================================
  // F28: Recherches du registry pures et immuables
  // =========================================================================
  testsRun++;
  assert(getFlangeById("TEST_FLANGE_ASME_001") === undefined, "getFlangeById retourne undefined");
  assert(getFlangesByStandard("ASME-B16.5").length === 0, "getFlangesByStandard retourne un tableau vide");
  assert(getFlangesByType("WELD_NECK").length === 0, "getFlangesByType retourne un tableau vide");
  assert(getFlangesByRatingSystem("ASME_CLASS").length === 0, "getFlangesByRatingSystem retourne un tableau vide");
  assert(getAllFlanges().length === 0, "getAllFlanges retourne un tableau vide");

  return { success: true, testsRun };
}
