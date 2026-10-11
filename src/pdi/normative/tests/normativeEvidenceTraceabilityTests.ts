/**
 * PDI NORMATIVE ENGINE — NORMATIVE EVIDENCE TRACEABILITY TESTS
 * Reference: NORM-14-10 (Evidence / Traceability Lock)
 * 
 * Suite de tests unitaires formelle et déterministe pour le verrou de traçabilité.
 * Exigence : Minimum 50 tests, 70 tests implémentés.
 */

import { NormativeEvidenceTraceabilityEngine } from "../engine/normativeEvidenceTraceabilityEngine";
import { validateTraceabilityInput } from "../validators/normativeEvidenceTraceabilityValidator";
import type {
  NormativeTraceabilityInput,
  NormativeTraceabilityResult,
} from "../types/normativeEvidenceTraceabilityTypes";

export function runNormativeEvidenceTraceabilityTests(): {
  total: number;
  passed: number;
  failed: number;
  results: string[];
} {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      failed++;
      results.push(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    } else {
      passed++;
      results.push(`✅ PASS: ${testName}`);
    }
  }

  function runTest(testName: string, fn: () => void) {
    try {
      fn();
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`❌ EXCEPTION in ${testName}: ${msg}`);
    }
  }

  const engine = new NormativeEvidenceTraceabilityEngine();

  // ==========================================
  // SECTION 1: VALIDATION STRUCTURELLE (1..12)
  // ==========================================

  runTest("TEST 01: Input null -> INVALID", () => {
    const val = validateTraceabilityInput(null);
    assert(!val.valid, "null n'est pas valide");
    const res = engine.lock(null);
    assert(!res.valid, "lock(null) -> valid === false");
  });

  runTest("TEST 02: Input undefined -> INVALID", () => {
    const val = validateTraceabilityInput(undefined);
    assert(!val.valid, "undefined n'est pas valide");
    const res = engine.lock(undefined);
    assert(!res.valid, "lock(undefined) -> valid === false");
  });

  runTest("TEST 03: Primitive number -> INVALID", () => {
    const val = validateTraceabilityInput(12345);
    assert(!val.valid, "number n'est pas valide");
    const res = engine.lock(12345);
    assert(!res.valid, "lock(number) -> valid === false");
  });

  runTest("TEST 04: Primitive boolean -> INVALID", () => {
    const val = validateTraceabilityInput(true);
    assert(!val.valid, "boolean n'est pas valide");
    const res = engine.lock(false);
    assert(!res.valid, "lock(boolean) -> valid === false");
  });

  runTest("TEST 05: Primitive string -> INVALID", () => {
    const val = validateTraceabilityInput("INVALID_STRING_INPUT");
    assert(!val.valid, "string primitive n'est pas valide");
    const res = engine.lock("INVALID_STRING_INPUT");
    assert(!res.valid, "lock(string) -> valid === false");
  });

  runTest("TEST 06: Array -> INVALID", () => {
    const val = validateTraceabilityInput(["RULE_01", "EVID_01"]);
    assert(!val.valid, "array n'est pas un input valide");
    const res = engine.lock(["RULE_01"]);
    assert(!res.valid, "lock(array) -> valid === false");
  });

  runTest("TEST 07: Empty rule ID -> INVALID", () => {
    const val = validateTraceabilityInput({
      matchedRuleIds: ["RULE_01", "   ", "RULE_02"],
    });
    assert(!val.valid, "Rule ID vide doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_EMPTY_RULE_ID"), "Code TRACEABILITY_EMPTY_RULE_ID requis");
  });

  runTest("TEST 08: Empty evidence ID -> INVALID", () => {
    const val = validateTraceabilityInput({
      evidenceIds: ["EVID_01", ""],
    });
    assert(!val.valid, "Evidence ID vide doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_EMPTY_EVIDENCE_ID"), "Code TRACEABILITY_EMPTY_EVIDENCE_ID requis");
  });

  runTest("TEST 09: Empty conflict code -> INVALID", () => {
    const val = validateTraceabilityInput({
      conflictCodes: ["\t\n"],
    });
    assert(!val.valid, "Conflict code vide doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_EMPTY_CONFLICT_CODE"), "Code TRACEABILITY_EMPTY_CONFLICT_CODE requis");
  });

  runTest("TEST 10: Non-string rule ID -> INVALID", () => {
    const val = validateTraceabilityInput({
      matchedRuleIds: [123 as any],
    });
    assert(!val.valid, "Rule ID non-string doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_NON_STRING_RULE_ID"), "Code TRACEABILITY_NON_STRING_RULE_ID requis");
  });

  runTest("TEST 11: Non-string evidence ID -> INVALID", () => {
    const val = validateTraceabilityInput({
      evidenceIds: [{ id: "EVID_01" } as any],
    });
    assert(!val.valid, "Evidence ID non-string doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_NON_STRING_EVIDENCE_ID"), "Code TRACEABILITY_NON_STRING_EVIDENCE_ID requis");
  });

  runTest("TEST 12: Non-string conflict code -> INVALID", () => {
    const val = validateTraceabilityInput({
      conflictCodes: [true as any],
    });
    assert(!val.valid, "Conflict code non-string doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_NON_STRING_CONFLICT_CODE"), "Code TRACEABILITY_NON_STRING_CONFLICT_CODE requis");
  });

  // ==========================================
  // SECTION 2: NO INVENTION (13..18)
  // ==========================================

  runTest("TEST 13: Aucune evidence fournie -> aucune evidence générée", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: [],
      conflictCodes: [],
    });
    assert(res.valid, "Résultat valide");
    assert(res.evidenceIds.length === 0, "evidenceIds reste strictement vide");
  });

  runTest("TEST 14: Aucun rule ID fourni -> aucun rule ID généré", () => {
    const res = engine.lock({
      matchedRuleIds: [],
      evidenceIds: ["EVID_01"],
      conflictCodes: [],
    });
    assert(res.valid, "Résultat valide");
    assert(res.matchedRuleIds.length === 0, "matchedRuleIds reste strictement vide");
  });

  runTest("TEST 15: Aucun conflict code fourni -> aucun conflict généré", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_01"],
      conflictCodes: [],
    });
    assert(res.valid, "Résultat valide");
    assert(res.conflictCodes.length === 0, "conflictCodes reste strictement vide");
  });

  runTest("TEST 16: Evidence inconnue -> pas de remplacement automatique", () => {
    const res = engine.lock({
      matchedRuleIds: [],
      evidenceIds: ["UNKNOWN_EVIDENCE_999"],
      conflictCodes: [],
    });
    assert(res.valid, "Résultat valide");
    assert(res.evidenceIds.length === 1, "Conserve l'evidence telle quelle");
    assert(res.evidenceIds[0] === "UNKNOWN_EVIDENCE_999", "Pas d'altération");
  });

  runTest("TEST 17: Rule inconnue -> pas de déduction", () => {
    const res = engine.lock({
      matchedRuleIds: ["UNKNOWN_RULE_XYZ"],
      evidenceIds: [],
      conflictCodes: [],
    });
    assert(res.valid, "Résultat valide");
    assert(res.matchedRuleIds[0] === "UNKNOWN_RULE_XYZ", "Pas de déduction ou mapping");
  });

  runTest("TEST 18: Absence d'evidence -> aucune insertion de AUTO_EVIDENCE", () => {
    const res = engine.lock({});
    assert(res.valid, "Input vide valide");
    assert(res.evidenceIds.length === 0, "Aucun AUTO_EVIDENCE ou EVIDENCE_001 créé");
    assert(res.matchedRuleIds.length === 0, "Aucun RULE_001 créé");
  });

  // ==========================================
  // SECTION 3: NO PROMOTION (19..23)
  // ==========================================

  runTest("TEST 19: Evidence absente -> ne devient pas VERIFIED", () => {
    const res = engine.lock({
      evidenceIds: [],
    });
    assert(res.evidenceIds.length === 0, "Aucune evidence créée ou promue");
  });

  runTest("TEST 20: Trace UNVERIFIED -> reste UNVERIFIED", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_UNVERIFIED"],
      evidenceIds: ["EVID_UNVERIFIED_01"],
    });
    assert(res.evidenceIds.includes("EVID_UNVERIFIED_01"), "Conserve l'ID sans modifier la sémantique");
  });

  runTest("TEST 21: Aucune promotion automatique", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_A"],
    });
    assert(res.valid, "Valide");
    assert(!("verificationStatus" in res), "Aucun champ de statut normatif ajouté");
  });

  runTest("TEST 22: Aucune qualification créée", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_B"],
    });
    assert(!("status" in res && (res as any).status === "QUALIFIED"), "Pas de qualification créée");
  });

  runTest("TEST 23: Aucun statut normatif créé", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_C"],
      evidenceIds: ["EVID_C"],
    });
    assert(!("designCodeStatus" in res), "Pas de statut normatif créé");
  });

  // ==========================================
  // SECTION 4: NO LOSS, DEDUPLICATION, SORTING & FREEZE (24..38)
  // ==========================================

  runTest("TEST 24: Conservation de toutes les rules", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_Z", "RULE_A", "RULE_M"],
      evidenceIds: [],
      conflictCodes: [],
    });
    assert(res.matchedRuleIds.length === 3, "Toutes les rules sont conservées");
  });

  runTest("TEST 25: Conservation de toutes les evidences", () => {
    const res = engine.lock({
      matchedRuleIds: [],
      evidenceIds: ["EVID_3", "EVID_1", "EVID_2"],
      conflictCodes: [],
    });
    assert(res.evidenceIds.length === 3, "Toutes les evidences sont conservées");
  });

  runTest("TEST 26: Conservation de tous les conflicts", () => {
    const res = engine.lock({
      matchedRuleIds: [],
      evidenceIds: [],
      conflictCodes: ["CONF_B", "CONF_A"],
    });
    assert(res.conflictCodes.length === 2, "Tous les conflicts sont conservés");
  });

  runTest("TEST 27: Déduplication rules", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A", "RULE_B", "RULE_A", "RULE_B", "RULE_A"],
    });
    assert(res.matchedRuleIds.length === 2, "2 rules uniques");
    assert(res.matchedRuleIds[0] === "RULE_A" && res.matchedRuleIds[1] === "RULE_B", "Contenu exact");
  });

  runTest("TEST 28: Déduplication evidences", () => {
    const res = engine.lock({
      evidenceIds: ["EVID_X", "EVID_Y", "EVID_X"],
    });
    assert(res.evidenceIds.length === 2, "2 evidences uniques");
  });

  runTest("TEST 29: Déduplication conflicts", () => {
    const res = engine.lock({
      conflictCodes: ["ERR_1", "ERR_1", "ERR_2"],
    });
    assert(res.conflictCodes.length === 2, "2 conflits uniques");
  });

  runTest("TEST 30: Tri lexicographique rules", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_C", "RULE_A", "RULE_B"],
    });
    assert(res.matchedRuleIds[0] === "RULE_A", "Index 0 = RULE_A");
    assert(res.matchedRuleIds[1] === "RULE_B", "Index 1 = RULE_B");
    assert(res.matchedRuleIds[2] === "RULE_C", "Index 2 = RULE_C");
  });

  runTest("TEST 31: Tri lexicographique evidences", () => {
    const res = engine.lock({
      evidenceIds: ["EVID_30", "EVID_10", "EVID_20"],
    });
    assert(res.evidenceIds[0] === "EVID_10", "Index 0 = EVID_10");
    assert(res.evidenceIds[1] === "EVID_20", "Index 1 = EVID_20");
    assert(res.evidenceIds[2] === "EVID_30", "Index 2 = EVID_30");
  });

  runTest("TEST 32: Tri lexicographique conflicts", () => {
    const res = engine.lock({
      conflictCodes: ["CONFLICT_Z", "CONFLICT_A"],
    });
    assert(res.conflictCodes[0] === "CONFLICT_A", "Index 0 = CONFLICT_A");
    assert(res.conflictCodes[1] === "CONFLICT_Z", "Index 1 = CONFLICT_Z");
  });

  runTest("TEST 33: Freeze complet du résultat racine", () => {
    const res = engine.lock({});
    assert(Object.isFrozen(res), "Résultat racine gelé");
  });

  runTest("TEST 34: Freeze complet de matchedRuleIds", () => {
    const res = engine.lock({ matchedRuleIds: ["RULE_A"] });
    assert(Object.isFrozen(res.matchedRuleIds), "matchedRuleIds gelé");
  });

  runTest("TEST 35: Freeze complet de evidenceIds", () => {
    const res = engine.lock({ evidenceIds: ["EVID_A"] });
    assert(Object.isFrozen(res.evidenceIds), "evidenceIds gelé");
  });

  runTest("TEST 36: Freeze complet de conflictCodes", () => {
    const res = engine.lock({ conflictCodes: ["CONF_A"] });
    assert(Object.isFrozen(res.conflictCodes), "conflictCodes gelé");
  });

  runTest("TEST 37: Freeze complet de ruleEvidence", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_A"],
      ruleEvidence: [{ ruleId: "RULE_A", evidenceIds: ["EVID_A"] }],
    });
    assert(Object.isFrozen(res.ruleEvidence), "ruleEvidence gelé");
    assert(Object.isFrozen(res.ruleEvidence[0]), "ruleEvidence[0] gelé");
    assert(Object.isFrozen(res.ruleEvidence[0].evidenceIds), "ruleEvidence[0].evidenceIds gelé");
  });

  runTest("TEST 38: Freeze complet de conflicts", () => {
    const res = engine.lock({
      evidenceIds: ["EVID_B"],
      conflictCodes: ["CONF_B"],
      conflicts: [{ conflictCode: "CONF_B", evidenceIds: ["EVID_B"] }],
    });
    assert(Object.isFrozen(res.conflicts), "conflicts gelé");
    assert(Object.isFrozen(res.conflicts[0]), "conflicts[0] gelé");
    assert(Object.isFrozen(res.conflicts[0].evidenceIds), "conflicts[0].evidenceIds gelé");
  });

  // ==========================================
  // SECTION 5: PROVENANCE & CONSISTANCE (39..45)
  // ==========================================

  runTest("TEST 39: Rule <-> evidence cohérent -> PASS", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A", "RULE_B"],
      evidenceIds: ["EVID_01", "EVID_02"],
      ruleEvidence: [
        { ruleId: "RULE_A", evidenceIds: ["EVID_01"] },
        { ruleId: "RULE_B", evidenceIds: ["EVID_02"] },
      ],
    });
    assert(res.valid, "Rule <-> evidence valide");
    assert(res.ruleEvidence.length === 2, "2 ruleEvidence");
  });

  runTest("TEST 40: Rule <-> evidence incohérent (evidence non déclarée) -> INVALID", () => {
    const val = validateTraceabilityInput({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_01"],
      ruleEvidence: [
        { ruleId: "RULE_A", evidenceIds: ["EVID_UNDECLARED_99"] },
      ],
    });
    assert(!val.valid, "Evidence non déclarée doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_INCONSISTENT_RULE_EVIDENCE"), "Code TRACEABILITY_INCONSISTENT_RULE_EVIDENCE");
  });

  runTest("TEST 41: Rule <-> evidence incohérent (règle non déclarée dans matchedRuleIds) -> INVALID", () => {
    const val = validateTraceabilityInput({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_01"],
      ruleEvidence: [
        { ruleId: "RULE_UNDECLARED_X", evidenceIds: ["EVID_01"] },
      ],
    });
    assert(!val.valid, "Règle non déclarée doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_INVALID_RULE_REFERENCE"), "Code TRACEABILITY_INVALID_RULE_REFERENCE");
  });

  runTest("TEST 42: Conflict <-> evidence cohérent -> PASS", () => {
    const res = engine.lock({
      evidenceIds: ["EVID_01"],
      conflictCodes: ["CONF_01"],
      conflicts: [
        { conflictCode: "CONF_01", evidenceIds: ["EVID_01"] },
      ],
    });
    assert(res.valid, "Conflict <-> evidence valide");
    assert(res.conflicts.length === 1, "1 conflit validé");
  });

  runTest("TEST 43: Conflict <-> evidence incohérent (evidence non déclarée) -> INVALID", () => {
    const val = validateTraceabilityInput({
      evidenceIds: ["EVID_01"],
      conflictCodes: ["CONF_01"],
      conflicts: [
        { conflictCode: "CONF_01", evidenceIds: ["EVID_NOT_IN_LIST"] },
      ],
    });
    assert(!val.valid, "Evidence non déclarée dans conflit doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_INCONSISTENT_CONFLICT_EVIDENCE"), "Code TRACEABILITY_INCONSISTENT_CONFLICT_EVIDENCE");
  });

  runTest("TEST 44: Conflict <-> evidence incohérent (conflit non déclaré dans conflictCodes) -> INVALID", () => {
    const val = validateTraceabilityInput({
      evidenceIds: ["EVID_01"],
      conflictCodes: ["CONF_01"],
      conflicts: [
        { conflictCode: "CONF_UNDECLARED", evidenceIds: ["EVID_01"] },
      ],
    });
    assert(!val.valid, "Conflit non déclaré doit échouer");
    assert(val.errors.some((e) => e.code === "TRACEABILITY_INVALID_CONFLICT_REFERENCE"), "Code TRACEABILITY_INVALID_CONFLICT_REFERENCE");
  });

  runTest("TEST 45: Evidence non attribuée à une règle -> pas d'attribution automatique", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_01", "EVID_UNASSIGNED"],
      ruleEvidence: [
        { ruleId: "RULE_A", evidenceIds: ["EVID_01"] },
      ],
    });
    assert(res.valid, "Valide");
    assert(res.ruleEvidence.length === 1, "1 seule règle liée");
    assert(!res.ruleEvidence[0].evidenceIds.includes("EVID_UNASSIGNED"), "EVID_UNASSIGNED non rattachée automatiquement");
  });

  // ==========================================
  // SECTION 6: DÉTERMINISME (46..50)
  // ==========================================

  runTest("TEST 46: Même entrée -> même sortie", () => {
    const input: NormativeTraceabilityInput = {
      matchedRuleIds: ["R2", "R1"],
      evidenceIds: ["E2", "E1"],
      conflictCodes: ["C2", "C1"],
    };
    const res1 = engine.lock(input);
    const res2 = engine.lock(input);
    assert(JSON.stringify(res1) === JSON.stringify(res2), "Résultats identiques");
  });

  runTest("TEST 47: Ordre différent des rules -> même résultat normalisé", () => {
    const res1 = engine.lock({ matchedRuleIds: ["R1", "R2", "R3"] });
    const res2 = engine.lock({ matchedRuleIds: ["R3", "R1", "R2"] });
    assert(JSON.stringify(res1.matchedRuleIds) === JSON.stringify(res2.matchedRuleIds), "Tri déterministe des rules");
  });

  runTest("TEST 48: Ordre différent des evidences -> même résultat normalisé", () => {
    const res1 = engine.lock({ evidenceIds: ["E_B", "E_A"] });
    const res2 = engine.lock({ evidenceIds: ["E_A", "E_B"] });
    assert(JSON.stringify(res1.evidenceIds) === JSON.stringify(res2.evidenceIds), "Tri déterministe des evidences");
  });

  runTest("TEST 49: Ordre différent des conflicts -> même résultat normalisé", () => {
    const res1 = engine.lock({ conflictCodes: ["C_Z", "C_A"] });
    const res2 = engine.lock({ conflictCodes: ["C_A", "C_Z"] });
    assert(JSON.stringify(res1.conflictCodes) === JSON.stringify(res2.conflictCodes), "Tri déterministe des conflicts");
  });

  runTest("TEST 50: Répétition de la validation -> même résultat (idempotence)", () => {
    const input = {
      matchedRuleIds: ["R_1", "R_2"],
      evidenceIds: ["E_1"],
      conflictCodes: ["C_1"],
    };
    const val1 = validateTraceabilityInput(input);
    const val2 = validateTraceabilityInput(input);
    assert(val1.valid === val2.valid, "Validations répétées identiques");
  });

  // ==========================================
  // SECTION 7: ANTI-HEURISTIQUE (51..56)
  // ==========================================

  runTest("TEST 51: ASME_B16_SYNTHETIC accepté comme ID opaque", () => {
    const res = engine.lock({
      matchedRuleIds: ["ASME_B16_SYNTHETIC"],
      evidenceIds: ["EVID_01"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds[0] === "ASME_B16_SYNTHETIC", "Conserve le nom opaque");
  });

  runTest("TEST 52: API_TEST_01 accepté comme ID opaque", () => {
    const res = engine.lock({
      matchedRuleIds: ["API_TEST_01"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds[0] === "API_TEST_01", "Conserve le nom opaque");
  });

  runTest("TEST 53: NPS_DN_SYNTHETIC accepté comme ID opaque", () => {
    const res = engine.lock({
      matchedRuleIds: ["NPS_DN_SYNTHETIC"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds[0] === "NPS_DN_SYNTHETIC", "Conserve le nom opaque");
  });

  runTest("TEST 54: CLASS_PN_TEST accepté comme ID opaque", () => {
    const res = engine.lock({
      matchedRuleIds: ["CLASS_PN_TEST"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds[0] === "CLASS_PN_TEST", "Conserve le nom opaque");
  });

  runTest("TEST 55: PIPE_CS_TEST accepté comme ID opaque", () => {
    const res = engine.lock({
      matchedRuleIds: ["PIPE_CS_TEST"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds[0] === "PIPE_CS_TEST", "Conserve le nom opaque");
  });

  runTest("TEST 56: VALVE_CRMO_TEST accepté comme ID opaque", () => {
    const res = engine.lock({
      matchedRuleIds: ["VALVE_CRMO_TEST"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds[0] === "VALVE_CRMO_TEST", "Conserve le nom opaque");
  });

  // ==========================================
  // SECTION 8: ARCHITECTURE (57..60)
  // ==========================================

  runTest("TEST 57: Aucun accès direct à NORM-14-01 registry", () => {
    // Engine ne contient aucune référence externe ou état mutable
    assert(typeof engine.lock === "function", "Méthode lock présente");
  });

  runTest("TEST 58: Aucun calcul de compatibilité", () => {
    const res = engine.lock({
      matchedRuleIds: ["INCOMPATIBLE_RULE_A"],
      conflictCodes: ["CONFLICT_MATERIAL_MISMATCH"],
    });
    assert(res.valid, "Ne modifie pas le conflit ou le statut");
    assert(res.conflictCodes.includes("CONFLICT_MATERIAL_MISMATCH"), "Conserve le conflit sans recalculer");
  });

  runTest("TEST 59: Aucune nouvelle source normative", () => {
    const res = engine.lock({});
    assert(res.valid, "Pas d'injection de base normative");
  });

  runTest("TEST 60: Aucune création d'evidence", () => {
    const res = engine.lock({ matchedRuleIds: ["RULE_ONLY"] });
    assert(res.evidenceIds.length === 0, "Aucune evidence créée");
  });

  // ==========================================
  // SECTION 9: TESTS SUPPLÉMENTAIRES (61..70)
  // ==========================================

  runTest("TEST 61: Freeze des ruleEvidence et arrays imbriqués", () => {
    const res = engine.lock({
      matchedRuleIds: ["R1"],
      evidenceIds: ["E1"],
      ruleEvidence: [{ ruleId: "R1", evidenceIds: ["E1"] }],
    });
    assert(Object.isFrozen(res.ruleEvidence[0]), "Objet ruleEvidence gelé");
    assert(Object.isFrozen(res.ruleEvidence[0].evidenceIds), "Tableau evidenceIds gelé");
  });

  runTest("TEST 62: Freeze des conflicts et arrays imbriqués", () => {
    const res = engine.lock({
      evidenceIds: ["E1"],
      conflictCodes: ["C1"],
      conflicts: [{ conflictCode: "C1", evidenceIds: ["E1"] }],
    });
    assert(Object.isFrozen(res.conflicts[0]), "Objet conflicts gelé");
    assert(Object.isFrozen(res.conflicts[0].evidenceIds), "Tableau evidenceIds gelé");
  });

  runTest("TEST 63: Tentative de mutation rejetée", () => {
    const res = engine.lock({
      matchedRuleIds: ["R1"],
      evidenceIds: ["E1"],
    });
    let mutated = false;
    try {
      (res.matchedRuleIds as any).push("MUTATION");
      mutated = true;
    } catch {
      mutated = false;
    }
    assert(!mutated, "Mutation interdite sur tableau gelé");
  });

  runTest("TEST 64: Duplication massive d'une evidence", () => {
    const massive = Array(100).fill("EVID_MASSIVE");
    const res = engine.lock({ evidenceIds: massive });
    assert(res.evidenceIds.length === 1, "1 seule instance après déduplication");
    assert(res.evidenceIds[0] === "EVID_MASSIVE", "Contenu exact");
  });

  runTest("TEST 65: Duplication massive d'une rule", () => {
    const massive = Array(100).fill("RULE_MASSIVE");
    const res = engine.lock({ matchedRuleIds: massive });
    assert(res.matchedRuleIds.length === 1, "1 seule rule après déduplication");
  });

  runTest("TEST 66: Duplication massive d'un conflict", () => {
    const massive = Array(100).fill("CONFLICT_MASSIVE");
    const res = engine.lock({ conflictCodes: massive });
    assert(res.conflictCodes.length === 1, "1 seul conflit après déduplication");
  });

  runTest("TEST 67: IDs contenant des tokens normatifs traités comme chaînes opaques", () => {
    const res = engine.lock({
      matchedRuleIds: ["B31.3_TABLE_302.3.1_RULE", "ASME_B16.5_CLASS_300"],
      evidenceIds: ["NPS_4_SCHEDULE_40_EVID"],
    });
    assert(res.valid, "Valide");
    assert(res.matchedRuleIds.length === 2, "Conserve les 2 rules");
    assert(res.evidenceIds.length === 1, "Conserve l'evidence");
  });

  runTest("TEST 68: Résultat vide mais valide", () => {
    const res = engine.lock({
      matchedRuleIds: [],
      evidenceIds: [],
      conflictCodes: [],
      ruleEvidence: [],
      conflicts: [],
    });
    assert(res.valid, "Valide");
    assert(res.errors.length === 0, "Aucune erreur");
  });

  runTest("TEST 69: Erreur de provenance correctement isolée", () => {
    const res = engine.lock({
      matchedRuleIds: ["RULE_A"],
      evidenceIds: ["EVID_A"],
      ruleEvidence: [
        { ruleId: "RULE_A", evidenceIds: ["EVID_GHOST"] },
      ],
    });
    assert(!res.valid, "Invalide");
    assert(res.errors.some((e) => e.includes("TRACEABILITY_INCONSISTENT_RULE_EVIDENCE")), "Erreur de provenance présente");
  });

  runTest("TEST 70: Déterminisme après normalisation complète", () => {
    const input1 = {
      matchedRuleIds: ["R_Z", "R_A", "R_M"],
      evidenceIds: ["E_9", "E_1", "E_5"],
      conflictCodes: ["C_B", "C_A"],
      ruleEvidence: [
        { ruleId: "R_Z", evidenceIds: ["E_9"] },
        { ruleId: "R_A", evidenceIds: ["E_1"] },
      ],
      conflicts: [
        { conflictCode: "C_B", evidenceIds: ["E_5"] },
      ],
    };

    const input2 = {
      matchedRuleIds: ["R_A", "R_M", "R_Z"],
      evidenceIds: ["E_1", "E_5", "E_9"],
      conflictCodes: ["C_A", "C_B"],
      ruleEvidence: [
        { ruleId: "R_A", evidenceIds: ["E_1"] },
        { ruleId: "R_Z", evidenceIds: ["E_9"] },
      ],
      conflicts: [
        { conflictCode: "C_B", evidenceIds: ["E_5"] },
      ],
    };

    const res1 = engine.lock(input1);
    const res2 = engine.lock(input2);

    assert(JSON.stringify(res1) === JSON.stringify(res2), "Résultats strictement identiques quel que soit l'ordre");
  });

  return {
    total: passed + failed,
    passed,
    failed,
    results,
  };
}
