/**
 * PDI NORMATIVE ENGINE — FITTING ENGINE TEST SUITE
 * Reference: PATCH NORM-03 (Fittings Engine)
 * 
 * Suite de tests déterministe pour le moteur normatif des raccords.
 */

import {
  validateCompleteFittingRecord,
  validatePartialFittingRecord,
} from "../validators/fittingValidator";
import { isRecordObject } from "../validators/pipeDimensionalValidator";
import {
  FITTING_DIMENSIONAL_REGISTRY,
  getFittingById,
  getFittingsByStandard,
  getFittingsByType,
  getAllFittings,
} from "../registry/fittingRegistry";
import type { FittingDimensionalRecord } from "../types/fittingTypes";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[NORM-03 TEST FAILURE] ${message}`);
  }
}

/**
 * Exécute la suite complète de validation NORM-03.
 */
export function runFittingEngineTests(): { success: boolean; testsRun: number } {
  let testsRun = 0;

  // FIXTURES DE TEST SYNTHÉTIQUES (Non insérées dans le registre de production)
  const validFittingFixture: FittingDimensionalRecord = Object.freeze({
    id: "SYNTHETIC_FITTING_001",
    standardId: "ASME-B16.9",
    fittingType: "ELBOW",
    connectionType: "BUTT_WELD",
    sourceStatus: "UNVERIFIED",
  });

  // TEST F01: Minimal valid complete record -> PASS
  testsRun++;
  const resF01 = validateCompleteFittingRecord(validFittingFixture);
  assert(
    resF01.valid && resF01.errors.length === 0,
    "TEST F01 — Le record complet minimal valide doit réussir la validation"
  );

  // TEST F02: Complete record {} -> FAIL
  testsRun++;
  const resF02 = validateCompleteFittingRecord({});
  assert(
    !resF02.valid && resF02.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST F02 — validateCompleteFittingRecord({}) doit échouer (champs obligatoires manquants)"
  );

  // TEST F03: null -> FAIL (INVALID_RECORD_OBJECT)
  testsRun++;
  const resF03 = validateCompleteFittingRecord(null);
  assert(
    !resF03.valid && resF03.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST F03 — validateCompleteFittingRecord(null) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST F04: string -> FAIL (INVALID_RECORD_OBJECT)
  testsRun++;
  const resF04 = validateCompleteFittingRecord("invalid_string_input");
  assert(
    !resF04.valid && resF04.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST F04 — validateCompleteFittingRecord('string') doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST F05: array -> FAIL (INVALID_RECORD_OBJECT)
  testsRun++;
  const resF05 = validateCompleteFittingRecord([validFittingFixture]);
  assert(
    !resF05.valid && resF05.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST F05 — validateCompleteFittingRecord([]) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST F06: standardId inconnu -> FAIL (INVALID_STANDARD_ID)
  testsRun++;
  const resF06 = validateCompleteFittingRecord({
    ...validFittingFixture,
    standardId: "ASME-UNKNOWN-99",
  });
  assert(
    !resF06.valid && resF06.errors.some((e) => e.code === "INVALID_STANDARD_ID"),
    "TEST F06 — standardId non enregistré dans NORM-01 doit échouer"
  );

  // TEST F07: standardId = ASME-B31.3 (DESIGN_CODE) -> FAIL (STANDARD_IS_NOT_PRODUCT_STANDARD)
  testsRun++;
  const resF07 = validateCompleteFittingRecord({
    ...validFittingFixture,
    standardId: "ASME-B31.3",
  });
  assert(
    !resF07.valid && resF07.errors.some((e) => e.code === "STANDARD_IS_NOT_PRODUCT_STANDARD"),
    "TEST F07 — standardId de type DESIGN_CODE (ex: ASME-B31.3) doit être refusé"
  );

  // TEST F08: standardId = ASME-B16.9 (PRODUCT_STANDARD) -> PASS
  testsRun++;
  const resF08 = validateCompleteFittingRecord({
    ...validFittingFixture,
    standardId: "ASME-B16.9",
  });
  assert(
    resF08.valid,
    "TEST F08 — standardId ASME-B16.9 (PRODUCT_STANDARD) doit passer"
  );

  // TEST F09: standardId = ASME-B16.11 (PRODUCT_STANDARD) -> PASS
  testsRun++;
  const resF09 = validateCompleteFittingRecord({
    ...validFittingFixture,
    standardId: "ASME-B16.11",
    connectionType: "SOCKET_WELD",
  });
  assert(
    resF09.valid,
    "TEST F09 — standardId ASME-B16.11 (PRODUCT_STANDARD) doit passer"
  );

  // TEST F10: VERIFIED sans sourceReference -> FAIL (VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE)
  testsRun++;
  const resF10 = validateCompleteFittingRecord({
    ...validFittingFixture,
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resF10.valid && resF10.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "TEST F10 — VERIFIED sans sourceReference doit échouer"
  );

  // TEST F11: LICENSED sans sourceReference -> FAIL (LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE)
  testsRun++;
  const resF11 = validateCompleteFittingRecord({
    ...validFittingFixture,
    sourceStatus: "LICENSED",
    sourceReference: undefined,
  });
  assert(
    !resF11.valid && resF11.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "TEST F11 — LICENSED sans sourceReference doit échouer"
  );

  // TEST F12: UNVERIFIED sans sourceReference -> PASS
  testsRun++;
  const resF12 = validateCompleteFittingRecord({
    ...validFittingFixture,
    sourceStatus: "UNVERIFIED",
    sourceReference: undefined,
  });
  assert(
    resF12.valid,
    "TEST F12 — UNVERIFIED sans sourceReference doit passer"
  );

  // TEST F13: LEGACY sans sourceReference -> PASS
  testsRun++;
  const resF13 = validateCompleteFittingRecord({
    ...validFittingFixture,
    sourceStatus: "LEGACY",
    sourceReference: undefined,
  });
  assert(
    resF13.valid,
    "TEST F13 — LEGACY sans sourceReference doit passer"
  );

  // TEST F14: dn = 0 -> FAIL (INVALID_DN)
  testsRun++;
  const resF14 = validateCompleteFittingRecord({
    ...validFittingFixture,
    dn: 0,
  });
  assert(
    !resF14.valid && resF14.errors.some((e) => e.code === "INVALID_DN"),
    "TEST F14 — dn = 0 doit échouer (doit être > 0)"
  );

  // TEST F15: endDn2 = 0 -> FAIL (INVALID_END_DN2)
  testsRun++;
  const resF15 = validateCompleteFittingRecord({
    ...validFittingFixture,
    fittingType: "REDUCER",
    dn: 50,
    endDn2: 0,
  });
  assert(
    !resF15.valid && resF15.errors.some((e) => e.code === "INVALID_END_DN2"),
    "TEST F15 — endDn2 = 0 doit échouer (doit être > 0)"
  );

  // TEST F16: nps = "" -> FAIL (EMPTY_NPS)
  testsRun++;
  const resF16 = validateCompleteFittingRecord({
    ...validFittingFixture,
    nps: "  ",
  });
  assert(
    !resF16.valid && resF16.errors.some((e) => e.code === "EMPTY_NPS"),
    "TEST F16 — nps vide doit échouer"
  );

  // TEST F17: angleDeg négatif ou zéro -> FAIL (INVALID_ANGLE_DEG)
  testsRun++;
  const resF17 = validateCompleteFittingRecord({
    ...validFittingFixture,
    angleDeg: -45,
  });
  assert(
    !resF17.valid && resF17.errors.some((e) => e.code === "INVALID_ANGLE_DEG"),
    "TEST F17 — angleDeg négatif (-45) doit échouer"
  );

  // TEST F18: connectionType invalide -> FAIL (INVALID_CONNECTION_TYPE)
  testsRun++;
  const resF18 = validateCompleteFittingRecord({
    ...validFittingFixture,
    connectionType: "INVALID_CONN" as any,
  });
  assert(
    !resF18.valid && resF18.errors.some((e) => e.code === "INVALID_CONNECTION_TYPE"),
    "TEST F18 — connectionType invalide doit échouer"
  );

  // TEST F19: fittingType invalide -> FAIL (INVALID_FITTING_TYPE)
  testsRun++;
  const resF19 = validateCompleteFittingRecord({
    ...validFittingFixture,
    fittingType: "INVALID_FITTING" as any,
  });
  assert(
    !resF19.valid && resF19.errors.some((e) => e.code === "INVALID_FITTING_TYPE"),
    "TEST F19 — fittingType invalide doit échouer"
  );

  // TEST F20: Partial {} -> PASS
  testsRun++;
  const resF20 = validatePartialFittingRecord({});
  assert(
    resF20.valid && resF20.errors.length === 0,
    "TEST F20 — validatePartialFittingRecord({}) doit passer comme état partiel valide"
  );

  // TEST F21: Complete {} -> FAIL
  testsRun++;
  const resF21 = validateCompleteFittingRecord({});
  assert(
    !resF21.valid && resF21.errors.length > 0,
    "TEST F21 — validateCompleteFittingRecord({}) doit échouer"
  );

  // TEST F22: Aucune fonction NPS/DN inventée n'est exportée
  testsRun++;
  const fittingModuleKeys = Object.keys(require("../types/fittingTypes"));
  const hasConversion = fittingModuleKeys.some((k) =>
    k.toLowerCase().includes("convert") || k.toLowerCase().includes("nps2dn")
  );
  assert(
    !hasConversion,
    "TEST F22 — Aucune conversion automatique NPS ↔ DN dans le module raccords"
  );

  // TEST F23: Aucun calcul automatique de rayon / OD
  testsRun++;
  const hasRadiusCalc = fittingModuleKeys.some((k) =>
    k.toLowerCase().includes("radius") || k.toLowerCase().includes("calculate")
  );
  assert(
    !hasRadiusCalc,
    "TEST F23 — Aucun calcul géométrique ou de rayon automatique dans le module"
  );

  // TEST F24: Aucune formule ou calcul B31 dans le moteur raccords
  testsRun++;
  const hasB31Calc = fittingModuleKeys.some((k) =>
    k.toLowerCase().includes("barlow") || k.toLowerCase().includes("b31")
  );
  assert(
    !hasB31Calc,
    "TEST F24 — Aucune formule de calcul B31 ou de contrainte dans le moteur raccords"
  );

  // TEST F25: Registre de production raccords contient exactement 0 enregistrement
  testsRun++;
  assert(
    FITTING_DIMENSIONAL_REGISTRY.length === 0,
    "TEST F25 — FITTING_DIMENSIONAL_REGISTRY doit contenir exactement 0 enregistrement en l'absence de source licenciée"
  );

  // Verifications des fonctions d'accès au registre de production
  testsRun++;
  assert(getFittingById("NON_EXISTENT") === undefined, "getFittingById retourne undefined pour ID inconnu");
  assert(getFittingsByStandard("ASME-B16.9").length === 0, "getFittingsByStandard retourne un tableau vide");
  assert(getFittingsByType("ELBOW").length === 0, "getFittingsByType retourne un tableau vide");
  assert(getAllFittings().length === 0, "getAllFittings retourne un tableau vide");

  // =========================================================================
  // NORM-03-R1: TYPE SAFETY & PARTIAL INPUT TESTS (R1-01 to R1-12)
  // =========================================================================

  // TEST R1-01: validatePartialFittingRecord({}) → valid === true
  testsRun++;
  const resR1_01 = validatePartialFittingRecord({});
  assert(
    resR1_01.valid && resR1_01.errors.length === 0,
    "TEST R1-01 — validatePartialFittingRecord({}) doit être valide (état partiel)"
  );

  // TEST R1-02: validatePartialFittingRecord(null) → valid === false (INVALID_RECORD_OBJECT)
  testsRun++;
  const resR1_02 = validatePartialFittingRecord(null as unknown);
  assert(
    !resR1_02.valid && resR1_02.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST R1-02 — validatePartialFittingRecord(null) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST R1-03: validatePartialFittingRecord(undefined) → valid === false (INVALID_RECORD_OBJECT)
  testsRun++;
  const resR1_03 = validatePartialFittingRecord(undefined as unknown);
  assert(
    !resR1_03.valid && resR1_03.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST R1-03 — validatePartialFittingRecord(undefined) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST R1-04: validatePartialFittingRecord("invalid") → valid === false (INVALID_RECORD_OBJECT)
  testsRun++;
  const resR1_04 = validatePartialFittingRecord("invalid" as unknown);
  assert(
    !resR1_04.valid && resR1_04.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST R1-04 — validatePartialFittingRecord('invalid') doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST R1-05: validatePartialFittingRecord(123) → valid === false (INVALID_RECORD_OBJECT)
  testsRun++;
  const resR1_05 = validatePartialFittingRecord(123 as unknown);
  assert(
    !resR1_05.valid && resR1_05.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST R1-05 — validatePartialFittingRecord(123) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST R1-06: validatePartialFittingRecord([]) → valid === false (INVALID_RECORD_OBJECT)
  testsRun++;
  const resR1_06 = validatePartialFittingRecord([] as unknown);
  assert(
    !resR1_06.valid && resR1_06.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "TEST R1-06 — validatePartialFittingRecord([]) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // TEST R1-07: validateCompleteFittingRecord({}) → valid === false
  testsRun++;
  const resR1_07 = validateCompleteFittingRecord({});
  assert(
    !resR1_07.valid && resR1_07.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST R1-07 — validateCompleteFittingRecord({}) doit échouer (champs requis manquants)"
  );

  // TEST R1-08: Un record complet valide → valid === true
  testsRun++;
  const resR1_08 = validateCompleteFittingRecord(validFittingFixture);
  assert(
    resR1_08.valid && resR1_08.errors.length === 0,
    "TEST R1-08 — Un record complet valide doit passer la validation complète"
  );

  // TEST R1-09: Vérifier que l'erreur structurelle est bien INVALID_RECORD_OBJECT (pas MISSING_RECORD_ID)
  testsRun++;
  const resR1_09_bool = validatePartialFittingRecord(true as unknown);
  assert(
    !resR1_09_bool.valid &&
      resR1_09_bool.errors.length === 1 &&
      resR1_09_bool.errors[0].code === "INVALID_RECORD_OBJECT",
    "TEST R1-09 — Entrée booléenne produit uniquement INVALID_RECORD_OBJECT"
  );

  // TEST R1-10: Type safety check - la signature accepte unknown sans contournement any
  testsRun++;
  const acceptUnknownPartial: (v: unknown) => unknown = validatePartialFittingRecord;
  const acceptUnknownComplete: (v: unknown) => unknown = validateCompleteFittingRecord;
  assert(
    typeof acceptUnknownPartial === "function" && typeof acceptUnknownComplete === "function",
    "TEST R1-10 — Frontière runtime type-safe acceptant unknown sans contournement any"
  );

  // TEST R1-11: Vérifier que les règles VERIFIED/LICENSED sont préservées
  testsRun++;
  const resR1_11_verified = validatePartialFittingRecord({
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resR1_11_verified.valid &&
      resR1_11_verified.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "TEST R1-11 — VERIFIED sans sourceReference continue d'échouer dans le partial validator"
  );

  // TEST R1-12: Vérifier que FITTING_DIMENSIONAL_REGISTRY.length === 0
  testsRun++;
  assert(
    FITTING_DIMENSIONAL_REGISTRY.length === 0,
    "TEST R1-12 — FITTING_DIMENSIONAL_REGISTRY.length === 0 strictement garanti"
  );

  return { success: true, testsRun };
}
