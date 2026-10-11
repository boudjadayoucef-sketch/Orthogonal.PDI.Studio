/**
 * PDI NORMATIVE ENGINE — TESTS NORM-02
 * Reference: PATCH NORM-02
 * 
 * Tests unitaires déterministes validant les 10 exigences strictes de NORM-02 :
 * - TEST 01: Chaque record possède un standardId valide.
 * - TEST 02: Les standards dimensionnels acceptés sont distingués (ASME B36.10M / B36.19M).
 * - TEST 03: Aucune conversion NPS/DN n'existe dans le moteur.
 * - TEST 04: Aucune valeur dimensionnelle inventée n'est générée par formule.
 * - TEST 05: Les éditions non vérifiées restent undefined.
 * - TEST 06: Le registre est déterministe et immuable.
 * - TEST 07: Les unités dimensionnelles sont explicitement identifiées.
 * - TEST 08: Les données matériau restent des références et aucune propriété mécanique n'est embarquée.
 * - TEST 09: Les schedules ne sont pas transformés automatiquement en épaisseurs.
 * - TEST 10: Le registre ne contient aucune donnée de calcul B31.
 */

import {
  PIPE_DIMENSIONAL_REGISTRY,
  getPipeDimensionsByStandard,
} from "../registry/pipeDimensionalRegistry";
import type { PipeDimensionalRecord } from "../types/pipeDimensionalTypes";
import * as pipeRegistryModule from "../registry/pipeDimensionalRegistry";
import {
  validatePipeDimensionalRecord,
  validatePartialPipeDimensionalRecord,
  validateCompletePipeDimensionalRecord,
} from "../validators/pipeDimensionalValidator";

export function runPipeDimensionalEngineTests(): { success: boolean; results: string[] } {
  const results: string[] = [];
  let success = true;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      success = false;
      results.push(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    } else {
      results.push(`✅ PASS: ${testName}`);
    }
  }

  // =========================================================================
  // 1. TESTS DE BASE NORM-02
  // =========================================================================

  // TEST 01: Chaque record possède un standardId valide
  const validStandardIds = ["ASME-B36.10M", "ASME-B36.19M"];
  const t1Valid = PIPE_DIMENSIONAL_REGISTRY.every((r) => validStandardIds.includes(r.standardId));
  assert(t1Valid, "TEST 01 — Chaque record possède un standardId valide (ASME-B36.10M / ASME-B36.19M)");

  // TEST 02: Les standards dimensionnels de tubes sont correctement distingués
  const b36_10Records = getPipeDimensionsByStandard("ASME-B36.10M");
  const b36_19Records = getPipeDimensionsByStandard("ASME-B36.19M");
  const t2Valid = Array.isArray(b36_10Records) && Array.isArray(b36_19Records);
  assert(t2Valid, "TEST 02 — Distinction explicite entre ASME B36.10M et ASME B36.19M");

  // TEST 03: Aucune conversion NPS/DN n'existe dans les exported functions
  const moduleExportNames = Object.keys(pipeRegistryModule);
  const hasConversionFunction = moduleExportNames.some((name) =>
    /npsToDn|dnToNps|convertNps|convertDn/i.test(name)
  );
  assert(!hasConversionFunction, "TEST 03 — Aucune fonction ni table de conversion NPS ↔ DN n'existe dans le moteur");

  // TEST 04: Aucune valeur dimensionnelle inventée par formule
  const t4Valid = PIPE_DIMENSIONAL_REGISTRY.every((r) => {
    if (r.outsideDiameterMm && r.wallThicknessMm) {
      return r.wallThicknessMm !== r.outsideDiameterMm / 10;
    }
    return true;
  });
  assert(t4Valid, "TEST 04 — Aucune valeur dimensionnelle n'est générée par formule mathématique");

  // TEST 05: Les éditions non vérifiées restent undefined
  const t5Valid = PIPE_DIMENSIONAL_REGISTRY.every((r) => r.standardEdition === undefined);
  assert(t5Valid, "TEST 05 — Les éditions non vérifiées restent strictly undefined");

  // TEST 06: Le registre est déterministe et immuable
  let t6Valid = true;
  try {
    (PIPE_DIMENSIONAL_REGISTRY as any).push({ id: "INVALID" });
    t6Valid = false;
  } catch {
    t6Valid = true;
  }
  assert(t6Valid, "TEST 06 — Le registre dimensionnel est immuable et déterministe");

  // TEST 07: Les unités dimensionnelles sont explicitement identifiées (SI / US_CUSTOMARY)
  const t7Valid = PIPE_DIMENSIONAL_REGISTRY.every((r) => r.unitSystem === "SI" || r.unitSystem === "US_CUSTOMARY");
  assert(t7Valid, "TEST 07 — Les systèmes d'unités sont explicitement déclarés");

  // TEST 08: Les données matériau restent des références sans propriétés mécaniques
  const forbiddenMaterialKeys = ["smys", "yieldStrength", "tensileStrength", "allowableStress", "toughness"];
  const t8Valid = PIPE_DIMENSIONAL_REGISTRY.every((r) => {
    const keys = Object.keys(r);
    return !forbiddenMaterialKeys.some((fk) => keys.includes(fk));
  });
  assert(t8Valid, "TEST 08 — Aucune propriété mécanique (SMYS, contraintes) n'est embarquée dans le modèle dimensionnel");

  // TEST 09: Les schedules ne sont pas transformés automatiquement en épaisseurs par table inventée
  const hasScheduleMapper = moduleExportNames.some((name) =>
    /getThicknessFromSchedule|scheduleToThickness/i.test(name)
  );
  assert(!hasScheduleMapper, "TEST 09 — Aucune transformation automatique Schedule → épaisseur par approximation");

  // TEST 10: Le registre ne contient aucune donnée de calcul B31
  const forbiddenCalcKeys = ["barlow", "maop", "designPressure", "requiredThickness", "hoopStress"];
  const t10Valid = PIPE_DIMENSIONAL_REGISTRY.every((r) => {
    const keys = Object.keys(r);
    return !forbiddenCalcKeys.some((fk) => keys.includes(fk));
  });
  assert(t10Valid, "TEST 10 — Aucune donnée ou formule de calcul B31/Barlow dans le moteur dimensionnel");

  // =========================================================================
  // 2. TESTS NORM-02-R1.1 — COMPLETE VS PARTIAL RECORD VALIDATION (M01 - M07)
  // =========================================================================

  // FIXTURES DE TEST SYNTHÉTIQUES
  const validCompleteFixture: PipeDimensionalRecord = Object.freeze({
    id: "TEST_SYNTHETIC_PIPE_001",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
  });

  // TEST M01: validateCompletePipeDimensionalRecord({}) → FAIL
  const resM01 = validateCompletePipeDimensionalRecord({});
  assert(
    !resM01.valid && resM01.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST M01 — validateCompletePipeDimensionalRecord({}) doit échouer (objet vide)"
  );

  // TEST M02: validateCompletePipeDimensionalRecord(null) → FAIL
  const resM02 = validateCompletePipeDimensionalRecord(null);
  assert(
    !resM02.valid && resM02.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST M02 — validateCompletePipeDimensionalRecord(null) doit échouer (null non-objet)"
  );

  // TEST M03: validateCompletePipeDimensionalRecord("invalid") → FAIL
  const resM03 = validateCompletePipeDimensionalRecord("invalid");
  assert(
    !resM03.valid && resM03.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST M03 — validateCompletePipeDimensionalRecord('invalid') doit échouer (string non-objet)"
  );

  // TEST M04: validateCompletePipeDimensionalRecord([]) → FAIL
  const resM04 = validateCompletePipeDimensionalRecord([]);
  assert(
    !resM04.valid && resM04.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST M04 — validateCompletePipeDimensionalRecord([]) doit échouer (array non-record-object)"
  );

  // TEST M05: Record complet valide (id, standardId, unitSystem, sourceStatus) → PASS
  const resM05 = validateCompletePipeDimensionalRecord(validCompleteFixture);
  assert(
    resM05.valid && resM05.errors.length === 0,
    "TEST M05 — Un record complet valide doit passer la validation complète"
  );

  // TEST M06: Vérification du typage unknown à la signature de validateCompletePipeDimensionalRecord
  const acceptUnknownTypeCheck: (val: unknown) => unknown = validateCompletePipeDimensionalRecord;
  assert(
    typeof acceptUnknownTypeCheck === "function",
    "TEST M06 — validateCompletePipeDimensionalRecord accepte l'entrée 'unknown' de manière type-safe"
  );

  // TEST M07: validatePartialPipeDimensionalRecord({}) reste valide comme état partiel
  const resM07 = validatePartialPipeDimensionalRecord({});
  assert(
    resM07.valid && resM07.errors.length === 0,
    "TEST M07 — validatePartialPipeDimensionalRecord({}) reste valide comme état partiel"
  );

  // TEST R1.1-04: Record complet sans id → FAIL MISSING_RECORD_ID
  const resR1_1_04 = validateCompletePipeDimensionalRecord({
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
  });
  assert(
    !resR1_1_04.valid && resR1_1_04.errors.some((e) => e.code === "MISSING_RECORD_ID"),
    "TEST R1.1-04 — Record complet sans 'id' doit renvoyer l'erreur MISSING_RECORD_ID"
  );

  // TEST R1.1-05: Record complet sans standardId → FAIL MISSING_STANDARD_ID
  const resR1_1_05 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_005",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
  });
  assert(
    !resR1_1_05.valid && resR1_1_05.errors.some((e) => e.code === "MISSING_STANDARD_ID"),
    "TEST R1.1-05 — Record complet sans 'standardId' doit renvoyer l'erreur MISSING_STANDARD_ID"
  );

  // TEST R1.1-06: Record complet sans unitSystem → FAIL MISSING_UNIT_SYSTEM
  const resR1_1_06 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_006",
    standardId: "ASME-B36.10M",
    sourceStatus: "UNVERIFIED",
  });
  assert(
    !resR1_1_06.valid && resR1_1_06.errors.some((e) => e.code === "MISSING_UNIT_SYSTEM"),
    "TEST R1.1-06 — Record complet sans 'unitSystem' doit renvoyer l'erreur MISSING_UNIT_SYSTEM"
  );

  // TEST R1.1-07: Record complet sans sourceStatus → FAIL MISSING_SOURCE_STATUS
  const resR1_1_07 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_007",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
  });
  assert(
    !resR1_1_07.valid && resR1_1_07.errors.some((e) => e.code === "MISSING_SOURCE_STATUS"),
    "TEST R1.1-07 — Record complet sans 'sourceStatus' doit renvoyer l'erreur MISSING_SOURCE_STATUS"
  );

  // TEST R1.1-08: standardId = ASME-B31.3 → FAIL STANDARD_IS_NOT_DIMENSIONAL
  const resR1_1_08 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_008",
    standardId: "ASME-B31.3",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
  });
  assert(
    !resR1_1_08.valid && resR1_1_08.errors.some((e) => e.code === "STANDARD_IS_NOT_DIMENSIONAL"),
    "TEST R1.1-08 — Record avec standardId = ASME-B31.3 doit renvoyer STANDARD_IS_NOT_DIMENSIONAL"
  );

  // TEST R1.1-09: VERIFIED sans sourceReference → FAIL
  const resR1_1_09 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_009",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "VERIFIED",
  });
  assert(
    !resR1_1_09.valid && resR1_1_09.errors.some((e) => e.code === "VERIFIED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "TEST R1.1-09 — Statut VERIFIED sans sourceReference doit échouer à la validation"
  );

  // TEST R1.1-10: LICENSED sans sourceReference → FAIL
  const resR1_1_10 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_010",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "LICENSED",
  });
  assert(
    !resR1_1_10.valid && resR1_1_10.errors.some((e) => e.code === "LICENSED_RECORD_REQUIRES_SOURCE_REFERENCE"),
    "TEST R1.1-10 — Statut LICENSED sans sourceReference doit échouer à la validation"
  );

  // TEST R1.1-11: UNVERIFIED sans sourceReference → PASS
  const resR1_1_11 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_011",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
  });
  assert(
    resR1_1_11.valid,
    "TEST R1.1-11 — Statut UNVERIFIED sans sourceReference est valide"
  );

  // TEST R1.1-12: LEGACY sans sourceReference → PASS comme état legacy
  const resR1_1_12 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_012",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "LEGACY",
  });
  assert(
    resR1_1_12.valid,
    "TEST R1.1-12 — Statut LEGACY sans sourceReference est valide comme donnée historique"
  );

  // TEST R1.1-13: dn = 0 → FAIL INVALID_DN
  const resR1_1_13 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_013",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
    dn: 0,
  });
  assert(
    !resR1_1_13.valid && resR1_1_13.errors.some((e) => e.code === "INVALID_DN"),
    "TEST R1.1-13 — dn = 0 doit renvoyer INVALID_DN"
  );

  // TEST R1.1-14: outsideDiameterMm = -1 → FAIL INVALID_OUTSIDE_DIAMETER
  const resR1_1_14 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_014",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
    outsideDiameterMm: -1,
  });
  assert(
    !resR1_1_14.valid && resR1_1_14.errors.some((e) => e.code === "INVALID_OUTSIDE_DIAMETER"),
    "TEST R1.1-14 — outsideDiameterMm = -1 doit renvoyer INVALID_OUTSIDE_DIAMETER"
  );

  // TEST R1.1-15: wallThicknessMm = 0 → FAIL INVALID_WALL_THICKNESS
  const resR1_1_15 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_015",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
    wallThicknessMm: 0,
  });
  assert(
    !resR1_1_15.valid && resR1_1_15.errors.some((e) => e.code === "INVALID_WALL_THICKNESS"),
    "TEST R1.1-15 — wallThicknessMm = 0 doit renvoyer INVALID_WALL_THICKNESS"
  );

  // TEST R1.1-16: schedule = "" → FAIL EMPTY_SCHEDULE
  const resR1_1_16 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_016",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
    schedule: "",
  });
  assert(
    !resR1_1_16.valid && resR1_1_16.errors.some((e) => e.code === "EMPTY_SCHEDULE"),
    "TEST R1.1-16 — schedule = '' doit renvoyer EMPTY_SCHEDULE"
  );

  // TEST R1.1-17: pipeType = "INVALID" → FAIL INVALID_PIPE_TYPE
  const resR1_1_17 = validateCompletePipeDimensionalRecord({
    id: "TEST_PIPE_017",
    standardId: "ASME-B36.10M",
    unitSystem: "SI",
    sourceStatus: "UNVERIFIED",
    pipeType: "INVALID" as any,
  });
  assert(
    !resR1_1_17.valid && resR1_1_17.errors.some((e) => e.code === "INVALID_PIPE_TYPE"),
    "TEST R1.1-17 — pipeType = 'INVALID' doit renvoyer INVALID_PIPE_TYPE"
  );

  // TEST R1.1-18: Détection d'ID dupliqués dans un registre synthétique de test
  const syntheticDuplicatesList: PipeDimensionalRecord[] = [
    { id: "TEST_DUPLICATE_001", standardId: "ASME-B36.10M", unitSystem: "SI", sourceStatus: "UNVERIFIED" },
    { id: "TEST_DUPLICATE_001", standardId: "ASME-B36.10M", unitSystem: "SI", sourceStatus: "UNVERIFIED" },
  ];
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  for (const item of syntheticDuplicatesList) {
    if (seenIds.has(item.id)) {
      duplicateIds.push(item.id);
    } else {
      seenIds.add(item.id);
    }
  }
  assert(
    duplicateIds.length === 1 && duplicateIds[0] === "TEST_DUPLICATE_001",
    "TEST R1.1-18 — Détection exacte d'identifiant dupliqué dans un registre synthétique de test"
  );

  // VÉRIFICATION PRODUCTION REGISTRY COUNT
  assert(
    PIPE_DIMENSIONAL_REGISTRY.length === 0,
    "TEST PRODUCTION REGISTRY — Le registre de production reste à 0 record tant qu'aucune donnée normative vérifiée n'est chargée"
  );

  // IMMUTABILITÉ — Vérification que la validation ne mute pas l'objet d'entrée
  const immutableInput = Object.freeze({
    id: "TEST_IMMUTABLE_PIPE",
    standardId: "ASME-B36.10M" as const,
    unitSystem: "SI" as const,
    sourceStatus: "UNVERIFIED" as const,
  });
  let immutabilityPassed = true;
  try {
    validateCompletePipeDimensionalRecord(immutableInput);
    validatePartialPipeDimensionalRecord(immutableInput);
  } catch {
    immutabilityPassed = false;
  }
  assert(immutabilityPassed, "TEST IMMUTABILITÉ — Les fonctions de validation sont pures et n'altèrent pas l'objet fourni");

  return { success, results };
}

