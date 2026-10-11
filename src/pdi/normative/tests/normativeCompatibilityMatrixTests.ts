/**
 * PDI NORMATIVE ENGINE — NORMATIVE COMPATIBILITY MATRIX TESTS
 * Reference: NORM-14-01 (Compatibility Matrix Foundation)
 * 
 * Tests d'intégrité, de conformité, de traçabilité et de déterminisme
 * pour la matrice de compatibilité normative.
 * 
 * RÈGLE ABSOLUE :
 * Aucun inventaire normatif réel (pas d'ASME B31.3, B16, API, ISO, EN, ASTM).
 * Identifiants et fixtures strictement synthétiques (SYN_*).
 */

import type {
  NormativeCompatibilityMatrixRule,
} from "../types/normativeCompatibilityMatrixTypes";
import {
  validateNormativeCompatibilityMatrixRule,
  validateCompatibilityMatrixQuery,
} from "../validators/normativeCompatibilityMatrixValidator";
import {
  NormativeCompatibilityMatrixRegistry,
  NORMATIVE_COMPATIBILITY_MATRIX,
} from "../registry/normativeCompatibilityMatrixRegistry";
import { NormativeCompatibilityMatrixEngine } from "../engine/normativeCompatibilityMatrixEngine";
import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";

export function runNormativeCompatibilityMatrixTests(): {
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
    evidenceId: "SYN_EVIDENCE_001",
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
    evidenceId: "SYN_EVIDENCE_002",
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

  // ==========================================
  // SECTION 1 : VALIDATION STRUCTURELLE (14 TESTS)
  // ==========================================

  // TEST 1 : Règle synthétique valide
  const validRule: NormativeCompatibilityMatrixRule = {
    ruleId: "SYN_RULE_001",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_001",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_001"],
    sourceReference: "SYN_REF_01",
    notes: "Synthetic compatibility rule 1",
  };
  const val1 = validateNormativeCompatibilityMatrixRule(validRule);
  assert("TEST 01 — Règle valide passe la validation structurelle", val1.valid && val1.errors.length === 0);

  // TEST 2 : null rejeté
  const val2 = validateNormativeCompatibilityMatrixRule(null);
  assert(
    "TEST 02 — null rejeté avec INVALID_RECORD_OBJECT",
    !val2.valid && val2.errors.some((e) => e.code === "INVALID_RECORD_OBJECT")
  );

  // TEST 3 : Primitives rejetées
  const val3Num = validateNormativeCompatibilityMatrixRule(42);
  const val3Str = validateNormativeCompatibilityMatrixRule("invalid");
  const val3Bool = validateNormativeCompatibilityMatrixRule(true);
  assert(
    "TEST 03 — Primitives rejetées",
    !val3Num.valid && !val3Str.valid && !val3Bool.valid
  );

  // TEST 4 : Array rejeté
  const val4 = validateNormativeCompatibilityMatrixRule([]);
  assert(
    "TEST 04 — Array rejeté avec INVALID_RECORD_OBJECT",
    !val4.valid && val4.errors.some((e) => e.code === "INVALID_RECORD_OBJECT")
  );

  // TEST 5 : ruleId vide ou manquant rejeté
  const val5Missing = validateNormativeCompatibilityMatrixRule({ ...validRule, ruleId: undefined });
  const val5Empty = validateNormativeCompatibilityMatrixRule({ ...validRule, ruleId: "   " });
  assert(
    "TEST 05 — ruleId vide ou manquant rejeté",
    !val5Missing.valid && !val5Empty.valid && val5Empty.errors.some((e) => e.code === "EMPTY_RULE_ID")
  );

  // TEST 6 : leftEntityType invalide ou manquant rejeté
  const val6Missing = validateNormativeCompatibilityMatrixRule({ ...validRule, leftEntityType: undefined });
  const val6Invalid = validateNormativeCompatibilityMatrixRule({ ...validRule, leftEntityType: "UNKNOWN_TYPE" as any });
  assert(
    "TEST 06 — leftEntityType invalide ou manquant rejeté",
    !val6Missing.valid && !val6Invalid.valid && val6Invalid.errors.some((e) => e.code === "INVALID_LEFT_ENTITY_TYPE")
  );

  // TEST 7 : rightEntityType invalide ou manquant rejeté
  const val7Missing = validateNormativeCompatibilityMatrixRule({ ...validRule, rightEntityType: undefined });
  const val7Invalid = validateNormativeCompatibilityMatrixRule({ ...validRule, rightEntityType: "INVALID_RIGHT" as any });
  assert(
    "TEST 07 — rightEntityType invalide ou manquant rejeté",
    !val7Missing.valid && !val7Invalid.valid && val7Invalid.errors.some((e) => e.code === "INVALID_RIGHT_ENTITY_TYPE")
  );

  // TEST 8 : leftEntityId vide ou non string rejeté
  const val8Missing = validateNormativeCompatibilityMatrixRule({ ...validRule, leftEntityId: undefined });
  const val8Empty = validateNormativeCompatibilityMatrixRule({ ...validRule, leftEntityId: "" });
  assert(
    "TEST 08 — leftEntityId vide ou manquant rejeté",
    !val8Missing.valid && !val8Empty.valid && val8Empty.errors.some((e) => e.code === "EMPTY_LEFT_ENTITY_ID")
  );

  // TEST 9 : rightEntityId vide ou non string rejeté
  const val9Missing = validateNormativeCompatibilityMatrixRule({ ...validRule, rightEntityId: undefined });
  const val9Empty = validateNormativeCompatibilityMatrixRule({ ...validRule, rightEntityId: "  " });
  assert(
    "TEST 09 — rightEntityId vide ou manquant rejeté",
    !val9Missing.valid && !val9Empty.valid && val9Empty.errors.some((e) => e.code === "EMPTY_RIGHT_ENTITY_ID")
  );

  // TEST 10 : status invalide rejeté
  const val10Missing = validateNormativeCompatibilityMatrixRule({ ...validRule, status: undefined });
  const val10Invalid = validateNormativeCompatibilityMatrixRule({ ...validRule, status: "MAYBE" as any });
  assert(
    "TEST 10 — status invalide rejeté",
    !val10Missing.valid && !val10Invalid.valid && val10Invalid.errors.some((e) => e.code === "INVALID_STATUS")
  );

  // TEST 11 : evidenceIds non-array rejeté
  const val11 = validateNormativeCompatibilityMatrixRule({ ...validRule, evidenceIds: "SYN_EVIDENCE" as any });
  assert(
    "TEST 11 — evidenceIds non-array rejeté",
    !val11.valid && val11.errors.some((e) => e.code === "INVALID_EVIDENCE_IDS_TYPE")
  );

  // TEST 12 : evidenceIds avec élément vide ou non-string rejeté
  const val12EmptyElem = validateNormativeCompatibilityMatrixRule({ ...validRule, evidenceIds: [""] });
  const val12NumElem = validateNormativeCompatibilityMatrixRule({ ...validRule, evidenceIds: [123 as any] });
  assert(
    "TEST 12 — evidenceIds contenant un élément vide ou non-string rejeté",
    !val12EmptyElem.valid && !val12NumElem.valid
  );

  // TEST 13 : evidenceIds contenant des doublons rejeté
  const val13 = validateNormativeCompatibilityMatrixRule({
    ...validRule,
    evidenceIds: ["SYN_EVIDENCE_001", "SYN_EVIDENCE_001"],
  });
  assert(
    "TEST 13 — evidenceIds contenant des doublons rejeté avec DUPLICATE_EVIDENCE_ID",
    !val13.valid && val13.errors.some((e) => e.code === "DUPLICATE_EVIDENCE_ID")
  );

  // TEST 14 : Token heuristique rejeté dans ruleId / entityId / evidenceIds
  const val14Heuristic = validateNormativeCompatibilityMatrixRule({
    ...validRule,
    ruleId: "RULE_MAT_CS_A106",
  });
  const val14Entity = validateNormativeCompatibilityMatrixRule({
    ...validRule,
    leftEntityId: "PIPE_CS_HEURISTIC",
  });
  assert(
    "TEST 14 — Token heuristique formellement rejeté",
    !val14Heuristic.valid && !val14Entity.valid && val14Heuristic.errors.some((e) => e.code === "DISALLOWED_TOKEN_HEURISTIC")
  );

  // ==========================================
  // SECTION 2 : REGISTRY DÉTERMINISTE (8 TESTS)
  // ==========================================

  const testRegistry = new NormativeCompatibilityMatrixRegistry();

  // TEST 15 : Registration valide
  const reg15 = testRegistry.register(validRule);
  assert("TEST 15 — Registration valide dans le registre réussie", reg15.success && testRegistry.count() === 1);

  // TEST 16 : Doublon de ruleId rejeté
  const reg16 = testRegistry.register(validRule);
  assert(
    "TEST 16 — Doublon de ruleId formellement rejeté",
    !reg16.success && reg16.error?.includes("COMPATIBILITY_MATRIX_REGISTRY_DUPLICATE") === true
  );

  // TEST 17 : get exact
  const got17 = testRegistry.get("SYN_RULE_001");
  assert(
    "TEST 17 — get exact retourne la règle immuable",
    got17 !== undefined && got17.ruleId === "SYN_RULE_001" && Object.isFrozen(got17)
  );

  // TEST 18 : has exact
  assert("TEST 18 — has exact retourne vrai si présent, faux sinon", testRegistry.has("SYN_RULE_001") && !testRegistry.has("NON_EXISTENT"));

  // TEST 19 : list() déterministe et trié
  const ruleB: NormativeCompatibilityMatrixRule = {
    ruleId: "SYN_RULE_002",
    leftEntityType: "FLANGE",
    leftEntityId: "SYN_FLANGE_001",
    rightEntityType: "PIPE",
    rightEntityId: "SYN_PIPE_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_001"],
  };
  testRegistry.register(ruleB);
  const list19 = testRegistry.list();
  assert(
    "TEST 19 — list() retourne les règles triées par ruleId de manière stable",
    list19.length === 2 && list19[0].ruleId === "SYN_RULE_001" && list19[1].ruleId === "SYN_RULE_002"
  );

  // TEST 20 : count exact
  assert("TEST 20 — count exact", testRegistry.count() === 2);

  // TEST 21 : clear vide complètement
  testRegistry.clear();
  assert("TEST 21 — clear() réinitialise complètement le registre", testRegistry.count() === 0 && testRegistry.list().length === 0);

  // TEST 22 : NORMATIVE_COMPATIBILITY_MATRIX initialement vide
  assert(
    "TEST 22 — Matrice de production NORMATIVE_COMPATIBILITY_MATRIX initialement vide et gelée",
    NORMATIVE_COMPATIBILITY_MATRIX.length === 0 && Object.isFrozen(NORMATIVE_COMPATIBILITY_MATRIX)
  );

  // ==========================================
  // SECTION 3 : ENGINE — MATCHING EXACT & DIRECTIONNALITÉ (5 TESTS)
  // ==========================================

  const engineRegistry = new NormativeCompatibilityMatrixRegistry();
  const engine = new NormativeCompatibilityMatrixEngine(engineRegistry, testEvidenceResolver);

  // Règle A : PIPE SYN_PIPE_001 -> FITTING SYN_FITTING_001 (COMPATIBLE, vérifié)
  engineRegistry.register({
    ruleId: "SYN_RULE_PIPE_FITTING_01",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_001",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_001",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_001"],
  });

  // TEST 23 : Exact matching
  const res23 = engine.resolveCompatibility("PIPE", "SYN_PIPE_001", "FITTING", "SYN_FITTING_001");
  assert(
    "TEST 23 — Exact matching résout avec succès",
    res23.status === "COMPATIBLE" && res23.matchedRuleIds.includes("SYN_RULE_PIPE_FITTING_01")
  );

  // TEST 24 : Partial matching rejeté
  const res24 = engine.resolveCompatibility("PIPE", "SYN_PIPE_00", "FITTING", "SYN_FITTING_001");
  assert("TEST 24 — Sous-chaîne ou ID approché retourne UNVERIFIED", res24.status === "UNVERIFIED");

  // TEST 25 : Directionnalité stricte (A -> B n'implique pas B -> A)
  const res25 = engine.resolveCompatibility("FITTING", "SYN_FITTING_001", "PIPE", "SYN_PIPE_001");
  assert("TEST 25 — Directionnalité stricte : relation inverse non déclarée retourne UNVERIFIED", res25.status === "UNVERIFIED");

  // TEST 26 : Aucune règle correspondante retourne UNVERIFIED (et non INCOMPATIBLE)
  const res26 = engine.resolveCompatibility("VALVE", "SYN_VALVE_999", "FLANGE", "SYN_FLANGE_999");
  assert(
    "TEST 26 — Aucune règle retourne UNVERIFIED et non INCOMPATIBLE",
    res26.status === "UNVERIFIED" && res26.matchedRuleIds.length === 0
  );

  // TEST 27 : Requête invalide (entity type invalide ou id vide)
  const res27Type = engine.resolveCompatibility("INVALID_ENTITY" as any, "SYN_PIPE_001", "FITTING", "SYN_FITTING_001");
  const res27Id = engine.resolveCompatibility("PIPE", "", "FITTING", "SYN_FITTING_001");
  assert(
    "TEST 27 — Paramètres de requête invalides retournent statut INVALID",
    res27Type.status === "INVALID" && res27Id.status === "INVALID"
  );

  // ==========================================
  // SECTION 4 : ENGINE — EVIDENCE VERIFICATION & PROMOTION GUARDS (7 TESTS)
  // ==========================================

  // Règle INCOMPATIBLE avec evidence vérifiée
  engineRegistry.register({
    ruleId: "SYN_RULE_PIPE_FLANGE_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_001",
    rightEntityType: "FLANGE",
    rightEntityId: "SYN_FLANGE_002",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_002"],
    notes: "Synthetic incompatible pair",
  });

  // TEST 28 : Règle COMPATIBLE avec evidence VERIFIED retourne COMPATIBLE
  assert("TEST 28 — Règle COMPATIBLE avec evidence VERIFIED donne COMPATIBLE", res23.status === "COMPATIBLE");

  // TEST 29 : Règle INCOMPATIBLE avec evidence VERIFIED retourne INCOMPATIBLE
  const res29 = engine.resolveCompatibility("PIPE", "SYN_PIPE_001", "FLANGE", "SYN_FLANGE_002");
  assert(
    "TEST 29 — Règle INCOMPATIBLE avec evidence VERIFIED donne INCOMPATIBLE",
    res29.status === "INCOMPATIBLE" && res29.matchedRuleIds.includes("SYN_RULE_PIPE_FLANGE_INCOMPAT")
  );

  // Règle sans evidence
  engineRegistry.register({
    ruleId: "SYN_RULE_NO_EVIDENCE",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_002",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_002",
    status: "COMPATIBLE",
  });

  // TEST 30 : Règle sans evidence retourne UNVERIFIED
  const res30 = engine.resolveCompatibility("PIPE", "SYN_PIPE_002", "FITTING", "SYN_FITTING_002");
  assert("TEST 30 — Règle sans evidence reste UNVERIFIED", res30.status === "UNVERIFIED");

  // Règle avec evidence UNVERIFIED
  engineRegistry.register({
    ruleId: "SYN_RULE_UNVERIFIED_EVIDENCE",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_003",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_003",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_UNVERIFIED"],
  });

  // TEST 31 : Règle avec evidence UNVERIFIED retourne UNVERIFIED
  const res31 = engine.resolveCompatibility("PIPE", "SYN_PIPE_003", "FITTING", "SYN_FITTING_003");
  assert("TEST 31 — Règle avec evidence UNVERIFIED reste UNVERIFIED", res31.status === "UNVERIFIED");

  // Règle avec evidence introuvable (NOT_FOUND)
  engineRegistry.register({
    ruleId: "SYN_RULE_MISSING_EVIDENCE",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_004",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_004",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_NON_EXISTENT"],
  });

  // TEST 32 : Règle avec evidence NOT_FOUND retourne UNVERIFIED
  const res32 = engine.resolveCompatibility("PIPE", "SYN_PIPE_004", "FITTING", "SYN_FITTING_004");
  assert("TEST 32 — Règle avec evidence inexistante reste UNVERIFIED", res32.status === "UNVERIFIED");

  // Règle déclarée avec statut UNVERIFIED même si evidence valide
  engineRegistry.register({
    ruleId: "SYN_RULE_EXPLICIT_UNVERIFIED",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_005",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_005",
    status: "UNVERIFIED",
    evidenceIds: ["SYN_EVIDENCE_001"],
  });

  // TEST 33 : Règle avec statut UNVERIFIED ne devient JAMAIS vérifiée
  const res33 = engine.resolveCompatibility("PIPE", "SYN_PIPE_005", "FITTING", "SYN_FITTING_005");
  assert("TEST 33 — Règle avec status UNVERIFIED reste UNVERIFIED même avec preuve", res33.status === "UNVERIFIED");

  // TEST 34 : sourceReference seule sans evidenceIds valide ne confère JAMAIS le statut VERIFIED
  engineRegistry.register({
    ruleId: "SYN_RULE_SOURCE_REF_ONLY",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_006",
    rightEntityType: "FITTING",
    rightEntityId: "SYN_FITTING_006",
    status: "COMPATIBLE",
    sourceReference: "SYN_TEXTUAL_REFERENCE_ONLY",
  });
  const res34 = engine.resolveCompatibility("PIPE", "SYN_PIPE_006", "FITTING", "SYN_FITTING_006");
  assert("TEST 34 — sourceReference seule ne promeut JAMAIS une règle vers COMPATIBLE", res34.status === "UNVERIFIED");

  // ==========================================
  // SECTION 5 : CONFLITS, PRÉCÉDENCE & DÉTERMINISME (6 TESTS)
  // ==========================================

  // Paire en conflit : une règle COMPATIBLE vérifiée et une règle INCOMPATIBLE vérifiée
  const conflictRegistry = new NormativeCompatibilityMatrixRegistry();
  conflictRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_A",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_CONF",
    rightEntityType: "FLANGE",
    rightEntityId: "SYN_FLANGE_CONF",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_001"],
  });
  conflictRegistry.register({
    ruleId: "SYN_RULE_CONFLICT_B",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_CONF",
    rightEntityType: "FLANGE",
    rightEntityId: "SYN_FLANGE_CONF",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_002"],
  });

  const conflictEngine = new NormativeCompatibilityMatrixEngine(conflictRegistry, testEvidenceResolver);
  const res35 = conflictEngine.resolveCompatibility("PIPE", "SYN_PIPE_CONF", "FLANGE", "SYN_FLANGE_CONF");

  // TEST 35 : Conflit entre deux règles vérifiées contradictoires
  assert(
    "TEST 35 — COMPATIBLE + INCOMPATIBLE vérifiés retourne statut INVALID avec conflictCode",
    res35.status === "INVALID" &&
      res35.conflictCode === "COMPATIBILITY_CONFLICT_CONTRADICTORY_VERIFIED_RULES" &&
      res35.matchedRuleIds.length === 2
  );

  // Precedence : Une règle vérifiée COMPATIBLE + une règle UNVERIFIED
  const precRegistry = new NormativeCompatibilityMatrixRegistry();
  precRegistry.register({
    ruleId: "SYN_RULE_PREC_COMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_PREC",
    rightEntityType: "VALVE",
    rightEntityId: "SYN_VALVE_PREC",
    status: "COMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_001"],
  });
  precRegistry.register({
    ruleId: "SYN_RULE_PREC_UNVERIF",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_PREC",
    rightEntityType: "VALVE",
    rightEntityId: "SYN_VALVE_PREC",
    status: "UNVERIFIED",
  });
  const precEngine = new NormativeCompatibilityMatrixEngine(precRegistry, testEvidenceResolver);
  const res36 = precEngine.resolveCompatibility("PIPE", "SYN_PIPE_PREC", "VALVE", "SYN_VALVE_PREC");

  // TEST 36 : Règle vérifiée déterminante face à une règle UNVERIFIED
  assert(
    "TEST 36 — Règle vérifiée COMPATIBLE est déterminante face à une règle UNVERIFIED",
    res36.status === "COMPATIBLE" && res36.matchedRule?.ruleId === "SYN_RULE_PREC_COMPAT"
  );

  // Precedence : Une règle vérifiée INCOMPATIBLE + une règle UNVERIFIED
  const precIncompatRegistry = new NormativeCompatibilityMatrixRegistry();
  precIncompatRegistry.register({
    ruleId: "SYN_RULE_PREC_INCOMPAT",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_PREC_2",
    rightEntityType: "VALVE",
    rightEntityId: "SYN_VALVE_PREC_2",
    status: "INCOMPATIBLE",
    evidenceIds: ["SYN_EVIDENCE_002"],
  });
  precIncompatRegistry.register({
    ruleId: "SYN_RULE_PREC_UNVERIF_2",
    leftEntityType: "PIPE",
    leftEntityId: "SYN_PIPE_PREC_2",
    rightEntityType: "VALVE",
    rightEntityId: "SYN_VALVE_PREC_2",
    status: "UNVERIFIED",
  });
  const precIncompatEngine = new NormativeCompatibilityMatrixEngine(precIncompatRegistry, testEvidenceResolver);
  const res37 = precIncompatEngine.resolveCompatibility("PIPE", "SYN_PIPE_PREC_2", "VALVE", "SYN_VALVE_PREC_2");

  // TEST 37 : Règle vérifiée INCOMPATIBLE est déterminante face à une règle UNVERIFIED
  assert(
    "TEST 37 — Règle vérifiée INCOMPATIBLE est déterminante face à une règle UNVERIFIED",
    res37.status === "INCOMPATIBLE" && res37.matchedRule?.ruleId === "SYN_RULE_PREC_INCOMPAT"
  );

  // TEST 38 : Déterminisme absolu — Ordre d'insertion inversé produit le même résultat
  const orderRegistry1 = new NormativeCompatibilityMatrixRegistry();
  orderRegistry1.register(precRegistry.get("SYN_RULE_PREC_COMPAT")!);
  orderRegistry1.register(precRegistry.get("SYN_RULE_PREC_UNVERIF")!);

  const orderRegistry2 = new NormativeCompatibilityMatrixRegistry();
  orderRegistry2.register(precRegistry.get("SYN_RULE_PREC_UNVERIF")!);
  orderRegistry2.register(precRegistry.get("SYN_RULE_PREC_COMPAT")!);

  const engineOrd1 = new NormativeCompatibilityMatrixEngine(orderRegistry1, testEvidenceResolver);
  const engineOrd2 = new NormativeCompatibilityMatrixEngine(orderRegistry2, testEvidenceResolver);

  const evalOrd1 = engineOrd1.resolveCompatibility("PIPE", "SYN_PIPE_PREC", "VALVE", "SYN_VALVE_PREC");
  const evalOrd2 = engineOrd2.resolveCompatibility("PIPE", "SYN_PIPE_PREC", "VALVE", "SYN_VALVE_PREC");

  assert(
    "TEST 38 — Déterminisme strict : insertion [A, B] vs [B, A] produit des résultats strictement identiques",
    evalOrd1.status === evalOrd2.status &&
      evalOrd1.matchedRuleIds.join(",") === evalOrd2.matchedRuleIds.join(",") &&
      evalOrd1.evidenceIds.join(",") === evalOrd2.evidenceIds.join(",")
  );

  // TEST 39 : Traçabilité complète et immuabilité du résultat
  assert(
    "TEST 39 — Traçabilité : matchedRuleIds et evidenceIds sont triés, dédupliqués et gelés",
    Object.isFrozen(res35.matchedRuleIds) &&
      Object.isFrozen(res35.evidenceIds) &&
      res35.matchedRuleIds.length === 2 &&
      res35.evidenceIds.length === 2
  );

  // TEST 40 : Non-invention normative (aucune fixture réelle)
  const isSyntheticEvidence = testEvidenceRegistry.list().every((e) => e.evidenceId.startsWith("SYN_"));
  assert(
    "TEST 40 — Non-invention normative : toutes les fixtures sont strictement synthétiques",
    isSyntheticEvidence && NORMATIVE_COMPATIBILITY_MATRIX.length === 0
  );

  return {
    success: allPass,
    testsRun,
    results,
  };
}
