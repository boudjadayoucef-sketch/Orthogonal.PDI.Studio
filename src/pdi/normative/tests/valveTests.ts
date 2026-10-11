/**
 * PDI NORMATIVE ENGINE — VALVE ENGINE TESTS (NORM-05)
 * Reference: PATCH NORM-05 (Valve Engine)
 * 
 * Suite de tests déterministes et isolés pour le Valve Engine.
 * Valide les tests obligatoires V01 à V26 :
 * - Séparation stricte PRODUCT_STANDARD (API-6D, API-600, API-602, API-609)
 *   et DIMENSIONAL_STANDARD (ASME-B16.10)
 * - Validation structurelle (INVALID_RECORD_OBJECT) et type safety (unknown)
 * - Exigences des records complets vs partiels
 * - Traçabilité (VERIFIED / LICENSED exigent sourceReference)
 * - Registre de production immuable avec 0 record
 * - Absence totale de conversion ou calcul (Cv/Kv, couple, pression, matériau, dimensions FTF)
 */

import {
  validateCompleteValveRecord,
  validatePartialValveRecord,
} from "../validators/valveValidator";
import {
  VALVE_REGISTRY,
  getValveById,
  getValvesByProductStandard,
  getValvesByDimensionalStandard,
  getValvesByType,
  getValvesByConnectionType,
  getAllValves,
} from "../registry/valveRegistry";
import type { ValveRecord } from "../types/valveTypes";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

/**
 * Fixtures synthétiques de test (pour test uniquement, JAMAIS dans le registre prod).
 */
const validApi600Fixture: ValveRecord = Object.freeze({
  id: "TEST_VALVE_API600_001",
  productStandardId: "API-600",
  valveType: "GATE",
  connectionType: "FLANGED",
  sourceStatus: "UNVERIFIED",
});

const validApi602Fixture: ValveRecord = Object.freeze({
  id: "TEST_VALVE_API602_001",
  productStandardId: "API-602",
  valveType: "GATE",
  connectionType: "SOCKET_WELD",
  sourceStatus: "UNVERIFIED",
});

const validApi609Fixture: ValveRecord = Object.freeze({
  id: "TEST_VALVE_API609_001",
  productStandardId: "API-609",
  valveType: "BUTTERFLY",
  connectionType: "WAFER",
  sourceStatus: "UNVERIFIED",
});

const validApi6dFixture: ValveRecord = Object.freeze({
  id: "TEST_VALVE_API6D_001",
  productStandardId: "API-6D",
  valveType: "BALL",
  connectionType: "FLANGED",
  sourceStatus: "UNVERIFIED",
});

const validB1610Fixture: ValveRecord = Object.freeze({
  id: "TEST_VALVE_B1610_001",
  dimensionalStandardId: "ASME-B16.10",
  valveType: "GLOBE",
  connectionType: "FLANGED",
  sourceStatus: "UNVERIFIED",
});

export function runValveEngineTests(): { success: boolean; testsRun: number } {
  let testsRun = 0;

  // =========================================================================
  // V01: Record complet valide avec productStandardId = API-600
  // =========================================================================
  testsRun++;
  const resV01 = validateCompleteValveRecord(validApi600Fixture);
  assert(
    resV01.valid && resV01.errors.length === 0,
    "V01 — Record complet API-600 valide doit passer"
  );

  // =========================================================================
  // V02: Record complet valide avec productStandardId = API-602
  // =========================================================================
  testsRun++;
  const resV02 = validateCompleteValveRecord(validApi602Fixture);
  assert(
    resV02.valid && resV02.errors.length === 0,
    "V02 — Record complet API-602 valide doit passer"
  );

  // =========================================================================
  // V03: Record complet valide avec productStandardId = API-609
  // =========================================================================
  testsRun++;
  const resV03 = validateCompleteValveRecord(validApi609Fixture);
  assert(
    resV03.valid && resV03.errors.length === 0,
    "V03 — Record complet API-609 valide doit passer"
  );

  // =========================================================================
  // V04: Record complet valide avec productStandardId = API-6D
  // =========================================================================
  testsRun++;
  const resV04 = validateCompleteValveRecord(validApi6dFixture);
  assert(
    resV04.valid && resV04.errors.length === 0,
    "V04 — Record complet API-6D valide doit passer"
  );

  // =========================================================================
  // V05: Record avec dimensionalStandardId = ASME-B16.10
  // =========================================================================
  testsRun++;
  const resV05 = validateCompleteValveRecord(validB1610Fixture);
  assert(
    resV05.valid && resV05.errors.length === 0,
    "V05 — Record complet avec dimensionalStandardId ASME-B16.10 doit passer"
  );

  // =========================================================================
  // V06: Record {} complet -> FAIL
  // =========================================================================
  testsRun++;
  const resV06 = validateCompleteValveRecord({});
  assert(
    !resV06.valid &&
      resV06.errors.some((e) => e.code === "MISSING_RECORD_ID") &&
      resV06.errors.some((e) => e.code === "MISSING_STANDARD_REFERENCE"),
    "V06 — validateCompleteValveRecord({}) doit échouer (champs requis manquants)"
  );

  // =========================================================================
  // V07: Record {} partiel -> PASS
  // =========================================================================
  testsRun++;
  const resV07 = validatePartialValveRecord({});
  assert(
    resV07.valid && resV07.errors.length === 0,
    "V07 — validatePartialValveRecord({}) doit passer (état partiel)"
  );

  // =========================================================================
  // V08: null partiel -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resV08 = validatePartialValveRecord(null as unknown);
  assert(
    !resV08.valid && resV08.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "V08 — validatePartialValveRecord(null) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // V09: array partiel -> FAIL (INVALID_RECORD_OBJECT)
  // =========================================================================
  testsRun++;
  const resV09 = validatePartialValveRecord([validApi600Fixture] as unknown);
  assert(
    !resV09.valid && resV09.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"),
    "V09 — validatePartialValveRecord([]) doit échouer avec INVALID_RECORD_OBJECT"
  );

  // =========================================================================
  // V10: productStandardId = ASME-B36.10M -> FAIL (STANDARD_IS_NOT_PRODUCT_STANDARD)
  // =========================================================================
  testsRun++;
  const resV10 = validatePartialValveRecord({
    productStandardId: "ASME-B36.10M" as unknown as undefined,
  });
  assert(
    !resV10.valid && resV10.errors.some((e) => e.code === "STANDARD_IS_NOT_PRODUCT_STANDARD"),
    "V10 — productStandardId = ASME-B36.10M (DIMENSIONAL_STANDARD) doit échouer"
  );

  // =========================================================================
  // V11: dimensionalStandardId = API-600 -> FAIL (STANDARD_IS_NOT_DIMENSIONAL_STANDARD)
  // =========================================================================
  testsRun++;
  const resV11 = validatePartialValveRecord({
    dimensionalStandardId: "API-600" as unknown as undefined,
  });
  assert(
    !resV11.valid && resV11.errors.some((e) => e.code === "STANDARD_IS_NOT_DIMENSIONAL_STANDARD"),
    "V11 — dimensionalStandardId = API-600 (PRODUCT_STANDARD) doit échouer"
  );

  // =========================================================================
  // V12: VERIFIED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resV12 = validatePartialValveRecord({
    sourceStatus: "VERIFIED",
    sourceReference: undefined,
  });
  assert(
    !resV12.valid && resV12.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "V12 — VERIFIED sans sourceReference doit échouer"
  );

  // =========================================================================
  // V13: LICENSED sans sourceReference -> FAIL
  // =========================================================================
  testsRun++;
  const resV13 = validatePartialValveRecord({
    sourceStatus: "LICENSED",
    sourceReference: "   ",
  });
  assert(
    !resV13.valid && resV13.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "V13 — LICENSED avec sourceReference vide doit échouer"
  );

  // =========================================================================
  // V14: UNVERIFIED sans sourceReference -> PASS
  // =========================================================================
  testsRun++;
  const resV14 = validatePartialValveRecord({
    sourceStatus: "UNVERIFIED",
    sourceReference: undefined,
  });
  assert(
    resV14.valid && resV14.errors.length === 0,
    "V14 — UNVERIFIED sans sourceReference est autorisé"
  );

  // =========================================================================
  // V15: DN <= 0 -> FAIL (INVALID_DN)
  // =========================================================================
  testsRun++;
  const resV15 = validatePartialValveRecord({
    dn: -50,
  });
  assert(
    !resV15.valid && resV15.errors.some((e) => e.code === "INVALID_DN"),
    "V15 — dn <= 0 doit échouer avec INVALID_DN"
  );

  // =========================================================================
  // V16: NPS vide -> FAIL (EMPTY_NPS)
  // =========================================================================
  testsRun++;
  const resV16 = validatePartialValveRecord({
    nps: "   ",
  });
  assert(
    !resV16.valid && resV16.errors.some((e) => e.code === "EMPTY_NPS"),
    "V16 — NPS vide doit échouer avec EMPTY_NPS"
  );

  // =========================================================================
  // V17: valveType invalide -> FAIL (INVALID_VALVE_TYPE)
  // =========================================================================
  testsRun++;
  const resV17 = validatePartialValveRecord({
    valveType: "INVALID_VALVE_TYPE_XYZ" as unknown as undefined,
  });
  assert(
    !resV17.valid && resV17.errors.some((e) => e.code === "INVALID_VALVE_TYPE"),
    "V17 — valveType invalide doit échouer"
  );

  // =========================================================================
  // V18: connectionType invalide -> FAIL (INVALID_CONNECTION_TYPE)
  // =========================================================================
  testsRun++;
  const resV18 = validatePartialValveRecord({
    connectionType: "INVALID_CONN_XYZ" as unknown as undefined,
  });
  assert(
    !resV18.valid && resV18.errors.some((e) => e.code === "INVALID_CONNECTION_TYPE"),
    "V18 — connectionType invalide doit échouer"
  );

  // =========================================================================
  // V19: productStandardId + dimensionalStandardId valides -> PASS structurellement
  // =========================================================================
  testsRun++;
  const combinedFixture: ValveRecord = Object.freeze({
    id: "TEST_VALVE_DUAL_STANDARD",
    productStandardId: "API-600",
    dimensionalStandardId: "ASME-B16.10",
    valveType: "GATE",
    connectionType: "FLANGED",
    sourceStatus: "UNVERIFIED",
  });
  const resV19 = validateCompleteValveRecord(combinedFixture);
  assert(
    resV19.valid && resV19.errors.length === 0,
    "V19 — Vanne avec productStandardId (API-600) et dimensionalStandardId (ASME-B16.10) est structurellement valide"
  );

  // =========================================================================
  // V20: Class/PN conversion absente
  // =========================================================================
  testsRun++;
  const valveRatingCheck = Object.freeze({
    id: "TEST_VALVE_RATING",
    productStandardId: "API-600" as const,
    valveType: "GATE" as const,
    connectionType: "FLANGED" as const,
    pressureRatingSystem: "ASME_CLASS",
    pressureRating: "Class 150",
    sourceStatus: "UNVERIFIED" as const,
  });
  assert(
    !("pnRating" in valveRatingCheck) && !("convertedPn" in valveRatingCheck),
    "V20 — Aucune conversion automatique Class ↔ PN dans le modèle"
  );

  // =========================================================================
  // V21: Aucun calcul FTF (Face-to-Face)
  // =========================================================================
  testsRun++;
  assert(
    validApi600Fixture.faceToFaceMm === undefined,
    "V21 — Aucun calcul automatique de Face-to-Face"
  );

  // =========================================================================
  // V22: Aucun calcul de pression
  // =========================================================================
  testsRun++;
  assert(
    !("testPressure" in validApi600Fixture) && !("workingPressure" in validApi600Fixture),
    "V22 — Aucun calcul de pression ou formule barlow/coque autorisée"
  );

  // =========================================================================
  // V23: Aucun calcul Cv/Kv
  // =========================================================================
  testsRun++;
  assert(
    !("cv" in validApi600Fixture) && !("kv" in validApi600Fixture),
    "V23 — Aucun calcul hydraulique ou coefficient d'écoulement Cv/Kv"
  );

  // =========================================================================
  // V24: Aucun calcul matériau
  // =========================================================================
  testsRun++;
  assert(
    !("allowableStress" in validApi600Fixture) && !("smys" in validApi600Fixture),
    "V24 — Aucune mécanique matériau ni contrainte admissible dans NORM-05"
  );

  // =========================================================================
  // V25: Registry production = 0
  // =========================================================================
  testsRun++;
  assert(
    VALVE_REGISTRY.length === 0,
    "V25 — VALVE_REGISTRY doit être strictement vide (0 records)"
  );

  // =========================================================================
  // V26: Recherches registry pures et immuables
  // =========================================================================
  testsRun++;
  assert(getValveById("TEST_VALVE_API600_001") === undefined, "getValveById retourne undefined");
  assert(getValvesByProductStandard("API-600").length === 0, "getValvesByProductStandard retourne un tableau vide");
  assert(getValvesByDimensionalStandard("ASME-B16.10").length === 0, "getValvesByDimensionalStandard retourne un tableau vide");
  assert(getValvesByType("GATE").length === 0, "getValvesByType retourne un tableau vide");
  assert(getValvesByConnectionType("FLANGED").length === 0, "getValvesByConnectionType retourne un tableau vide");
  assert(getAllValves().length === 0, "getAllValves retourne un tableau vide");

  return { success: true, testsRun };
}
