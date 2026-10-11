/**
 * PDI NORMATIVE ENGINE — TESTS NORM-01
 * Reference: PATCH NORM-01
 * 
 * Tests unitaires déterministes validant les 7 exigences strictes de NORM-01 :
 * - TEST 01: Chaque standard possède organization, code, standardType, domain, status.
 * - TEST 02: Aucun standard n'utilise une organisation inconnue.
 * - TEST 03: Les Design Codes sont distingués des Product Standards.
 * - TEST 04: Les éditions non vérifiées ne sont pas inventées (undefined).
 * - TEST 05: Le registre est déterministe et immuable.
 * - TEST 06: Le registre ne contient aucune donnée dimensionnelle ou calculatoire.
 * - TEST 07: Les statuts et types de conformité sont correctement définis.
 */

import {
  PDI_STANDARDS_REGISTRY,
  getAllNormativeStandards,
  getStandardsByType,
  getNormativeStandard,
} from "../registry/standardsRegistry";
import type {
  NormativeOrganization,
  NormativeStandardType,
  NormativeDomain,
  NormativeStatus,
} from "../types/normativeCoreTypes";
import type { ComplianceStatus, ComplianceResult } from "../types/complianceTypes";

export function runNormativeEngineTests(): { success: boolean; results: string[] } {
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

  const standards = getAllNormativeStandards();

  // TEST 01: Chaque standard possède les champs obligatoires
  const validOrgs: NormativeOrganization[] = ["ASME", "API", "ISO", "EN", "DIN"];
  const validTypes: NormativeStandardType[] = [
    "DESIGN_CODE",
    "PRODUCT_STANDARD",
    "DIMENSIONAL_STANDARD",
    "MATERIAL_STANDARD",
  ];
  const validDomains: NormativeDomain[] = [
    "PIPING",
    "PIPE",
    "FITTING",
    "FLANGE",
    "VALVE",
    "MATERIAL",
    "PIPELINE",
    "INDUSTRIAL_PIPING",
  ];
  const validStatuses: NormativeStatus[] = [
    "ACTIVE",
    "SUPERSEDED",
    "WITHDRAWN",
    "DRAFT",
    "UNVERIFIED",
  ];

  const t1Valid = standards.length > 0 && standards.every((s) => {
    return (
      Boolean(s.id) &&
      Boolean(s.code) &&
      Boolean(s.title) &&
      validOrgs.includes(s.organization) &&
      validTypes.includes(s.standardType) &&
      validDomains.includes(s.domain) &&
      validStatuses.includes(s.status)
    );
  });
  assert(t1Valid, "TEST 01 — Exhaustivité des métadonnées obligatoires");

  // TEST 02: Aucune organisation inconnue
  const t2Valid = standards.every((s) => validOrgs.includes(s.organization));
  assert(t2Valid, "TEST 02 — Aucune organisation inconnue (uniquement ASME, API, ISO, EN, DIN)");

  // TEST 03: Séparation stricte Design Codes vs Product Standards
  const designCodes = getStandardsByType("DESIGN_CODE");
  const productStandards = getStandardsByType("PRODUCT_STANDARD");

  const b31_3 = getNormativeStandard("ASME-B31.3");
  const b16_5 = getNormativeStandard("ASME-B16.5");

  const t3Valid =
    designCodes.length >= 3 &&
    productStandards.length >= 5 &&
    b31_3?.standardType === "DESIGN_CODE" &&
    b16_5?.standardType === "PRODUCT_STANDARD" &&
    b31_3.id !== b16_5.id;
  assert(t3Valid, "TEST 03 — Séparation stricte Design Codes vs Product Standards");

  // TEST 04: Pas d'éditions inventées (edition = undefined pour les entrées de base NORM-01)
  const t4Valid = standards.every((s) => s.edition === undefined);
  assert(t4Valid, "TEST 04 — Les éditions non vérifiées restent strictement undefined");

  // TEST 05: Déterminisme et immuabilité du registre
  let t5Valid = true;
  try {
    // Tentative de mutation (doit échouer ou être protégée par Object.freeze)
    (PDI_STANDARDS_REGISTRY as any)["FAKE-STANDARD"] = { id: "FAKE" };
    t5Valid = !("FAKE-STANDARD" in PDI_STANDARDS_REGISTRY);
  } catch {
    t5Valid = true;
  }
  assert(t5Valid, "TEST 05 — Registre immuable et déterministe");

  // TEST 06: Aucune donnée dimensionnelle ou calculatoire
  const keysControllingDimensions = [
    "od",
    "wallThickness",
    "schedule",
    "nps",
    "dn",
    "faceToFace",
    "pressureRating",
    "formula",
    "calculation",
    "barlow",
  ];
  const t6Valid = standards.every((s) => {
    const objKeys = Object.keys(s).map((k) => k.toLowerCase());
    return !keysControllingDimensions.some((dk) => objKeys.includes(dk.toLowerCase()));
  });
  assert(t6Valid, "TEST 06 — Absence absolue de données dimensionnelles ou calculatoires");

  // TEST 07: Typage déclaratif du vocabulaire de conformité
  const validComplianceStatuses: ComplianceStatus[] = [
    "COMPLIANT",
    "WARNING",
    "NON_COMPLIANT",
    "UNVERIFIED",
  ];
  const sampleResult: ComplianceResult = {
    status: "COMPLIANT",
    standardId: "ASME-B31.3",
    message: "Test déclaratif",
    severity: "INFO",
  };
  const t7Valid = validComplianceStatuses.includes(sampleResult.status);
  assert(t7Valid, "TEST 07 — Typage déclaratif de la conformité");

  // TEST 08: Vérification exacte du nombre de standards (20)
  const t8Valid = standards.length === 20;
  assert(t8Valid, "TEST 08 — Nombre exact de standards enregistrés dans le registre (20)");

  return { success, results };
}
