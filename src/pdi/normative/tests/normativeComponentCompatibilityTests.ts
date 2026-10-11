/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPONENT COMPATIBILITY TESTS
 * Reference: NORM-14-02 (Component Compatibility Adapter)
 * 
 * Tests d'intégrité, de conformité, de traçabilité et de déterminisme
 * pour l'adapter Component ↔ Component (PIPE, FITTING, FLANGE, VALVE).
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B31.3, B16, API, ISO, EN, ASTM).
 * Identifiants et fixtures strictement synthétiques (SYNTHETIC_*).
 */

import type {
  NormativeComponentCompatibilityQuery,
} from "../types/normativeComponentCompatibilityTypes";
import {
  validateNormativeComponentReference,
  validateNormativeComponentCompatibilityQuery,
} from "../validators/normativeComponentCompatibilityValidator";
import {
  NormativeComponentCompatibilityEngine,
  ComponentCompatibilityAdapter,
} from "../engine/normativeComponentCompatibilityEngine";
import { NormativeCompatibilityMatrixRegistry } from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

export function runNormativeComponentCompatibilityTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let testsRun = 0;
  let allPass = true;

  function assert(name: string, condition: boolean, details?: string): void {
    testsRun++;
    if (condition) {
      results.push(`✅ PASS: ${name}`);
    } else {
      allPass = false;
      results.push(`❌ FAIL: ${name} — ${details ?? "Assertion failed"}`);
    }
  }

  // Configuration de l'environnement de test synthétique
  const testEvidenceRegistry = new NormativeEvidenceRegistry();

  testEvidenceRegistry.register({
    evidenceId: "SYN_EVIDENCE_COMP_01",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_01",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_01",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_A",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  testEvidenceRegistry.register({
    evidenceId: "SYN_EVIDENCE_COMP_02",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_02",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_02",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYN_AUDITOR_B",
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  testEvidenceRegistry.register({
    evidenceId: "SYN_EVIDENCE_UNVERIFIED",
    standardId: "SYN_STD_001",
    editionId: "SYN_ED_001",
    clauseReference: "SYN_CLAUSE_03",
    sourceType: "VERIFIED_INTERNAL_REFERENCE",
    sourceReference: "SYN_DOC_REF_03",
    verificationStatus: "UNVERIFIED",
  });

  const testEvidenceResolver = new NormativeEvidenceResolver(testEvidenceRegistry);
  const matrixRegistry = new NormativeCompatibilityMatrixRegistry();
  const matrixEngine = new NormativeCompatibilityMatrixEngine(matrixRegistry, testEvidenceResolver);
  const adapter = new ComponentCompatibilityAdapter(matrixEngine);

  // ==========================================
  // SECTION 1 : VALIDATION (8 TESTS)
  // ==========================================

  // TEST 1 : PIPE valide
  const valPipe = validateNormativeComponentReference({
    componentType: "PIPE",
    componentId: "SYNTHETIC_PIPE_001",
  });
  assert("TEST 01 — Référence PIPE valide acceptée", valPipe.valid && valPipe.errors.length === 0);

  // TEST 2 : FITTING valide
  const valFitting = validateNormativeComponentReference({
    componentType: "FITTING",
    componentId: "SYNTHETIC_FITTING_001",
  });
  assert("TEST 02 — Référence FITTING valide acceptée", valFitting.valid && valFitting.errors.length === 0);

  // TEST 3 : FLANGE valide
  const valFlange = validateNormativeComponentReference({
    componentType: "FLANGE",
    componentId: "SYNTHETIC_FLANGE_001",
  });
  assert("TEST 03 — Référence FLANGE valide acceptée", valFlange.valid && valFlange.errors.length === 0);

  // TEST 4 : VALVE valide
  const valValve = validateNormativeComponentReference({
    componentType: "VALVE",
    componentId: "SYNTHETIC_VALVE_001",
  });
  assert("TEST 04 — Référence VALVE valide acceptée", valValve.valid && valValve.errors.length === 0);

  // TEST 5 : componentType invalide rejeté (ex: MATERIAL, DIMENSIONAL_STANDARD ou type inconnu)
  const valInvalidType = validateNormativeComponentReference({
    componentType: "MATERIAL",
    componentId: "SYNTHETIC_MAT_001",
  });
  const valUnknownType = validateNormativeComponentReference({
    componentType: "GASKET",
    componentId: "SYNTHETIC_GASKET_001",
  });
  assert(
    "TEST 05 — componentType hors PIPE/FITTING/FLANGE/VALVE rejeté",
    !valInvalidType.valid &&
      !valUnknownType.valid &&
      valInvalidType.errors.some((e) => e.code === "INVALID_COMPONENT_TYPE")
  );

  // TEST 6 : componentId vide ou avec espaces seuls rejeté
  const valEmptyId = validateNormativeComponentReference({
    componentType: "PIPE",
    componentId: "",
  });
  const valWhitespaceId = validateNormativeComponentReference({
    componentType: "PIPE",
    componentId: "    ",
  });
  assert(
    "TEST 06 — componentId vide ou espaces seuls rejeté",
    !valEmptyId.valid &&
      !valWhitespaceId.valid &&
      valEmptyId.errors.some((e) => e.code === "EMPTY_COMPONENT_ID")
  );

  // TEST 7 : query null, primitive ou tableau rejeté
  const valNullQuery = validateNormativeComponentCompatibilityQuery(null);
  const valPrimQuery = validateNormativeComponentCompatibilityQuery("INVALID_QUERY");
  const valArrQuery = validateNormativeComponentCompatibilityQuery([]);
  assert(
    "TEST 07 — Query null, primitive ou tableau rejeté avec INVALID_QUERY_OBJECT",
    !valNullQuery.valid &&
      !valPrimQuery.valid &&
      !valArrQuery.valid &&
      valNullQuery.errors.some((e) => e.code === "INVALID_QUERY_OBJECT")
  );

  // TEST 8 : query incomplète rejetée (missing left ou right)
  const valMissingLeft = validateNormativeComponentCompatibilityQuery({
    right: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  const valMissingRight = validateNormativeComponentCompatibilityQuery({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  assert(
    "TEST 08 — Query incomplète (left ou right manquant) rejetée",
    !valMissingLeft.valid &&
      !valMissingRight.valid &&
      valMissingLeft.errors.some((e) => e.code === "MISSING_LEFT_REFERENCE") &&
      valMissingRight.errors.some((e) => e.code === "MISSING_RIGHT_REFERENCE")
  );

  // ==========================================
  // SECTION 2 : MAPPING NORM-14-01 & STATUTS (4 TESTS)
  // ==========================================

  // Enregistrement d'une règle synthétique COMPATIBLE vérifiée
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_FITTING_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "FITTING",
    rightEntityId: "SYNTHETIC_FITTING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
    notes: "Compatible synthetic pipe to fitting",
  });

  // Enregistrement d'une règle synthétique INCOMPATIBLE vérifiée
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_FLANGE_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "FLANGE",
    rightEntityId: "SYNTHETIC_FLANGE_002",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_02"],
    notes: "Incompatible synthetic pipe to flange",
  });

  // TEST 9 : COMPATIBLE → COMPATIBLE
  const resCompat = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
  });
  assert(
    "TEST 09 — Mapping COMPATIBLE NORM-14-01 → COMPATIBLE NORM-14-02",
    resCompat.status === "COMPATIBLE" &&
      resCompat.matchedRuleIds.includes("SYN_RULE_PIPE_FITTING_COMPAT")
  );

  // TEST 10 : INCOMPATIBLE → INCOMPATIBLE
  const resIncompat = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_002" },
  });
  assert(
    "TEST 10 — Mapping INCOMPATIBLE NORM-14-01 → INCOMPATIBLE NORM-14-02",
    resIncompat.status === "INCOMPATIBLE" &&
      resIncompat.matchedRuleIds.includes("SYN_RULE_PIPE_FLANGE_INCOMPAT")
  );

  // TEST 11 : UNVERIFIED → UNVERIFIED (règle sans évidence ou absence de règle)
  const resUnverified = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_999" },
  });
  assert(
    "TEST 11 — Mapping UNVERIFIED NORM-14-01 → UNVERIFIED NORM-14-02",
    resUnverified.status === "UNVERIFIED" && resUnverified.matchedRuleIds.length === 0
  );

  // TEST 12 : INVALID → INVALID (requête invalide)
  const resInvalid = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "" },
    right: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
  });
  assert("TEST 12 — Mapping INVALID NORM-14-01 → INVALID NORM-14-02", resInvalid.status === "INVALID");

  // ==========================================
  // SECTION 3 : DIRECTIONNALITÉ STRICTE (2 TESTS)
  // ==========================================

  // TEST 13 : PIPE → FITTING résolu avec succès
  assert(
    "TEST 13 — PIPE → FITTING résout vers COMPATIBLE conformément à la règle",
    resCompat.status === "COMPATIBLE"
  );

  // TEST 14 : FITTING → PIPE avec comportement indépendant (non supposé COMPATIBLE sans règle explicite)
  const resInverse = adapter.resolveCompatibility({
    left: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
    right: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  assert(
    "TEST 14 — Directionnalité stricte : FITTING → PIPE retourne UNVERIFIED en l'absence de règle inverse",
    resInverse.status === "UNVERIFIED"
  );

  // ==========================================
  // SECTION 4 : TOUTES LES FAMILLES DE COMPOSANTS (7 TESTS)
  // ==========================================

  // Enregistrement des règles pour les différentes paires de composants
  matrixRegistry.register({
    ruleId: "SYN_RULE_PIPE_PIPE",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "PIPE",
    rightEntityId: "SYNTHETIC_PIPE_002",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FITTING_FLANGE",
    leftEntityType: "FITTING",
    leftEntityId: "SYNTHETIC_FITTING_001",
    rightEntityType: "FLANGE",
    rightEntityId: "SYNTHETIC_FLANGE_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FLANGE_VALVE",
    leftEntityType: "FLANGE",
    leftEntityId: "SYNTHETIC_FLANGE_001",
    rightEntityType: "VALVE",
    rightEntityId: "SYNTHETIC_VALVE_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_VALVE_PIPE",
    leftEntityType: "VALVE",
    leftEntityId: "SYNTHETIC_VALVE_001",
    rightEntityType: "PIPE",
    rightEntityId: "SYNTHETIC_PIPE_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_FLANGE_FLANGE",
    leftEntityType: "FLANGE",
    leftEntityId: "SYNTHETIC_FLANGE_001",
    rightEntityType: "FLANGE",
    rightEntityId: "SYNTHETIC_FLANGE_003",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
  });

  matrixRegistry.register({
    ruleId: "SYN_RULE_VALVE_VALVE",
    leftEntityType: "VALVE",
    leftEntityId: "SYNTHETIC_VALVE_001",
    rightEntityType: "VALVE",
    rightEntityId: "SYNTHETIC_VALVE_002",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_01"],
  });

  // TEST 15 : PIPE → PIPE
  const resPipePipe = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_002" },
  });
  assert("TEST 15 — Famille PIPE → PIPE résolue", resPipePipe.status === "COMPATIBLE");

  // TEST 16 : PIPE → FITTING
  assert("TEST 16 — Famille PIPE → FITTING résolue", resCompat.status === "COMPATIBLE");

  // TEST 17 : FITTING → FLANGE
  const resFitFlange = adapter.resolveCompatibility({
    left: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
    right: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_001" },
  });
  assert("TEST 17 — Famille FITTING → FLANGE résolue", resFitFlange.status === "COMPATIBLE");

  // TEST 18 : FLANGE → VALVE
  const resFlangeValve = adapter.resolveCompatibility({
    left: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_001" },
    right: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_001" },
  });
  assert("TEST 18 — Famille FLANGE → VALVE résolue", resFlangeValve.status === "COMPATIBLE");

  // TEST 19 : VALVE → PIPE
  const resValvePipe = adapter.resolveCompatibility({
    left: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_001" },
    right: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
  });
  assert("TEST 19 — Famille VALVE → PIPE résolue", resValvePipe.status === "COMPATIBLE");

  // TEST 20 : FLANGE → FLANGE
  const resFlangeFlange = adapter.resolveCompatibility({
    left: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_001" },
    right: { componentType: "FLANGE", componentId: "SYNTHETIC_FLANGE_003" },
  });
  assert("TEST 20 — Famille FLANGE → FLANGE résolue", resFlangeFlange.status === "COMPATIBLE");

  // TEST 21 : VALVE → VALVE
  const resValveValve = adapter.resolveCompatibility({
    left: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_001" },
    right: { componentType: "VALVE", componentId: "SYNTHETIC_VALVE_002" },
  });
  assert("TEST 21 — Famille VALVE → VALVE résolue", resValveValve.status === "COMPATIBLE");

  // ==========================================
  // SECTION 5 : TRAÇABILITÉ & SÉCURITÉ (9 TESTS)
  // ==========================================

  // TEST 22 : matchedRuleIds préservés
  assert(
    "TEST 22 — matchedRuleIds exactement préservés depuis NORM-14-01",
    resCompat.matchedRuleIds.length === 1 &&
      resCompat.matchedRuleIds[0] === "SYN_RULE_PIPE_FITTING_COMPAT" &&
      Object.isFrozen(resCompat.matchedRuleIds)
  );

  // TEST 23 : evidenceIds préservés
  assert(
    "TEST 23 — evidenceIds exactement préservés depuis NORM-14-01",
    resCompat.evidenceIds.length === 1 &&
      resCompat.evidenceIds[0] === "SYN_EVIDENCE_COMP_01" &&
      Object.isFrozen(resCompat.evidenceIds)
  );

  // TEST 24 : ordre déterministe et trié
  assert(
    "TEST 24 — matchedRuleIds et evidenceIds triés par ordre alphabétique stable",
    [...resCompat.matchedRuleIds].sort().join(",") === resCompat.matchedRuleIds.join(",") &&
      [...resCompat.evidenceIds].sort().join(",") === resCompat.evidenceIds.join(",")
  );

  // TEST 25 : aucune evidence inventée
  assert(
    "TEST 25 — Aucune évidence inventée sur résultat sans règle",
    resUnverified.evidenceIds.length === 0
  );

  // TEST 26 : Test d'absence de règle retourne UNVERIFIED et NON INCOMPATIBLE
  const isStatusUnverified = (resUnverified.status as string) === "UNVERIFIED";
  const isStatusNotBlocked = (resUnverified.status as string) !== "INCOMPATIBLE";
  assert(
    "TEST 26 — Absence de règle (SYNTHETIC_PIPE_001 → SYNTHETIC_VALVE_999) = UNVERIFIED (et non INCOMPATIBLE)",
    isStatusUnverified && isStatusNotBlocked
  );

  // TEST 27 : Indépendance des familles : règle PIPE:A → FITTING:B ne crée aucune règle pour PIPE:A → FLANGE:B etc.
  const resIndepFlange = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "FLANGE", componentId: "SYNTHETIC_FITTING_001" },
  });
  const resIndepValve = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "VALVE", componentId: "SYNTHETIC_FITTING_001" },
  });
  assert(
    "TEST 27 — Indépendance totale des familles : aucun matching implicite cross-family",
    resIndepFlange.status === "UNVERIFIED" && resIndepValve.status === "UNVERIFIED"
  );

  // TEST 28 : Aucun fuzzy matching : ID partiel retourne UNVERIFIED
  const resPartial = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_00" },
    right: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
  });
  assert("TEST 28 — Aucun fuzzy matching : correspondance approchée retourne UNVERIFIED", resPartial.status === "UNVERIFIED");

  // TEST 29A : TEST A — Identifiant avec pattern apparent "PIPE_MAT_CS_A106" est structurellement valide
  const valTestA = validateNormativeComponentReference({
    componentType: "PIPE",
    componentId: "PIPE_MAT_CS_A106",
  });
  assert("TEST 29A — PIPE_MAT_CS_A106 est structurellement valide (aucun blocage heuristique)", valTestA.valid && valTestA.errors.length === 0);

  // TEST 29B : TEST B — Identifiant avec pattern apparent "VALVE_CRMO_TEST" est structurellement valide
  const valTestB = validateNormativeComponentReference({
    componentType: "VALVE",
    componentId: "VALVE_CRMO_TEST",
  });
  assert("TEST 29B — VALVE_CRMO_TEST est structurellement valide (aucun blocage heuristique)", valTestB.valid && valTestB.errors.length === 0);

  // TEST 29C : TEST C — Identifiant avec pattern apparent "ASME_B16_5_TEST" est structurellement valide
  const valTestC = validateNormativeComponentReference({
    componentType: "FLANGE",
    componentId: "ASME_B16_5_TEST",
  });
  assert("TEST 29C — ASME_B16_5_TEST est structurellement valide (aucun blocage heuristique)", valTestC.valid && valTestC.errors.length === 0);

  // TEST 29D : TEST D — Le validator répond uniquement à la validité structurelle et ne confère aucun statut
  const valQueryA = validateNormativeComponentCompatibilityQuery({
    left: { componentType: "PIPE", componentId: "PIPE_MAT_CS_A106" },
    right: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
  });
  const valResultKeys = Object.keys(valTestA);
  const queryResultKeys = Object.keys(valQueryA);
  const validatorHasNoStatus =
    !("status" in valTestA) &&
    !("status" in valQueryA) &&
    valQueryA.valid === true;
  assert(
    "TEST 29D — Le validator répond uniquement par validité structurelle (sans statut COMPATIBLE/INCOMPATIBLE/VERIFIED/QUALIFIED)",
    validatorHasNoStatus && valTestA.valid && valTestB.valid && valTestC.valid
  );

  // TEST 29E : Principe architectural — componentId = identification uniquement ≠ qualification normative
  const resTestE = adapter.resolveCompatibility({
    left: { componentType: "VALVE", componentId: "VALVE_CRMO_TEST" },
    right: { componentType: "FLANGE", componentId: "ASME_B16_5_TEST" },
  });
  const notAutoPromoted =
    (resTestE.status as string) !== "COMPATIBLE" &&
    (resTestE.status as string) !== "INCOMPATIBLE" &&
    (resTestE.status as string) !== "VERIFIED" &&
    (resTestE.status as string) !== "QUALIFIED";
  assert(
    "TEST 29E — Principe architectural : componentId = identification pure, pas de qualification (statut reste UNVERIFIED)",
    resTestE.status === "UNVERIFIED" && notAutoPromoted && resTestE.evidenceIds.length === 0
  );

  // TEST 30 : Injection obligatoire du moteur NORM-14-01 dans le constructeur
  let threwOnNull = false;
  try {
    new (NormativeComponentCompatibilityEngine as any)(null);
  } catch {
    threwOnNull = true;
  }
  assert("TEST 30 — Constructeur rejette formellement l'absence de moteur NORM-14-01", threwOnNull);

  // TEST 31 : Conflit de règles contradictoires dans NORM-14-01 transmis en INVALID avec conflictCode
  matrixRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYNTHETIC_PIPE_001",
    rightEntityType: "FITTING",
    rightEntityId: "SYNTHETIC_FITTING_001",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_COMP_02"],
  });
  const resConflict = adapter.resolveCompatibility({
    left: { componentType: "PIPE", componentId: "SYNTHETIC_PIPE_001" },
    right: { componentType: "FITTING", componentId: "SYNTHETIC_FITTING_001" },
  });
  assert(
    "TEST 31 — Conflit de règles contradictoires NORM-14-01 transmis en INVALID avec conflictCode",
    resConflict.status === "INVALID" &&
      resConflict.conflictCode === "COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES"
  );

  // TEST 32 : Immuabilité absolue de l'objet résultat
  assert(
    "TEST 32 — Immuabilité stricte du résultat retourné (gel profond)",
    Object.isFrozen(resCompat) &&
      Object.isFrozen(resCompat.left) &&
      Object.isFrozen(resCompat.right) &&
      Object.isFrozen(resCompat.matchedRuleIds) &&
      Object.isFrozen(resCompat.evidenceIds)
  );

  return {
    success: allPass,
    testsRun,
    results,
  };
}
