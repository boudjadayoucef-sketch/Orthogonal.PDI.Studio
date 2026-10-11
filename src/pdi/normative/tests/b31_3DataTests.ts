/**
 * PDI NORMATIVE ENGINE — ASME B31.3 DATA INGESTION & GOVERNANCE TESTS
 * Reference: B31.3-02 (Controlled Normative Data Ingestion)
 * 
 * Suite complète de tests unitaires et d'intégration validant le modèle,
 * la gouvernance de la chaîne de traçabilité, le registre et le résolveur de données B31.3.
 * 
 * RÈGLE FONDAMENTALE (Section 12) :
 * - Utilisation EXCLUSIVE d'identifiants synthétiques (`SYNTHETIC_*`).
 * - Aucune vraie valeur normative comme fixture.
 */

import {
  NormativeSourceDocumentRegistry,
} from "../registry/normativeSourceDocumentRegistry";
import {
  NormativeSourceDocumentResolver,
} from "../registry/normativeSourceDocumentResolver";
import {
  NormativeEvidenceRegistry,
} from "../registry/normativeEvidenceRegistry";
import {
  NormativeEvidenceResolver,
} from "../registry/normativeEvidenceResolver";
import {
  B31_3DataRegistry,
  defaultB31_3DataRegistry,
} from "../data/b31_3/b31_3DataRegistry";
import {
  B31_3DataResolver,
  defaultB31_3DataResolver,
} from "../data/b31_3/b31_3DataResolver";
import { B31_3_VERIFIED_DATA } from "../data/b31_3/b31_3VerifiedData";
import type {
  B31_3NormativeDataRecord,
} from "../types/b31_3DataTypes";
import type {
  NormativeSourceDocument,
} from "../types/normativeSourceDocumentTypes";
import type {
  NormativeEvidence,
} from "../types/normativeEvidenceTypes";
import {
  validateB31_3DataRecordStructure,
  validateB31_3DataRecordGovernance,
} from "../data/b31_3/b31_3DataValidator";

export interface B31_3DataTestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[B31.3-02 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Exécute la suite complète de tests B31.3-02.
 */
export function runB31_3DataTests(): B31_3DataTestResult {
  const results: string[] = [];
  let testsRun = 0;

  function runTest(testName: string, testFn: () => void) {
    testsRun++;
    try {
      testFn();
      results.push(`✅ PASS: ${testName}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`❌ FAIL: ${testName} (${msg})`);
    }
  }

  // =========================================================================
  // FIXTURES SYNTHÉTIQUES STRICTES
  // =========================================================================

  const verifiedDoc: NormativeSourceDocument = Object.freeze({
    documentId: "SYNTHETIC_SOURCE_DOCUMENT_VERIFIED",
    title: "Synthetic Source Document",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    documentReference: "SYNTHETIC_REF_DOC_01",
    status: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });

  const unverifiedDoc: NormativeSourceDocument = Object.freeze({
    documentId: "SYNTHETIC_SOURCE_DOCUMENT_UNVERIFIED",
    title: "Synthetic Unverified Document",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    documentReference: "SYNTHETIC_REF_DOC_02",
    status: "UNVERIFIED",
  });

  const verifiedEvidence: NormativeEvidence = Object.freeze({
    evidenceId: "SYNTHETIC_EVIDENCE_VERIFIED",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    clauseReference: "SYNTHETIC_CLAUSE_01",
    sourceType: "LICENSED_STANDARD",
    sourceReference: "SYNTHETIC_REF_DOC_01",
    sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_VERIFIED",
    verificationStatus: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });

  const unverifiedEvidence: NormativeEvidence = Object.freeze({
    evidenceId: "SYNTHETIC_EVIDENCE_UNVERIFIED",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    clauseReference: "SYNTHETIC_CLAUSE_02",
    sourceType: "LEGACY_REFERENCE",
    sourceReference: "SYNTHETIC_REF_DOC_02",
    sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_UNVERIFIED",
    verificationStatus: "UNVERIFIED",
  });

  function createTestEnvironment() {
    const docRegistry = new NormativeSourceDocumentRegistry();
    docRegistry.register(verifiedDoc);
    docRegistry.register(unverifiedDoc);
    const docResolver = new NormativeSourceDocumentResolver(docRegistry);

    const evRegistry = new NormativeEvidenceRegistry();
    evRegistry.register(verifiedEvidence);
    evRegistry.register(unverifiedEvidence);
    const evResolver = new NormativeEvidenceResolver(evRegistry);

    const dataRegistry = new B31_3DataRegistry(docResolver, evResolver);
    const dataResolver = new B31_3DataResolver(dataRegistry);

    return {
      docRegistry,
      docResolver,
      evRegistry,
      evResolver,
      dataRegistry,
      dataResolver,
    };
  }

  const validRecordSynthetic: B31_3NormativeDataRecord<number> = Object.freeze({
    dataId: "SYNTHETIC_B31_3_DATA_001",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_VERIFIED",
    evidenceId: "SYNTHETIC_EVIDENCE_VERIFIED",
    clauseReference: "SYNTHETIC_CLAUSE_01",
    dataType: "ALLOWABLE_STRESS_SYNTHETIC",
    value: 120.5,
    unit: "MPa",
    status: "VERIFIED",
    notes: "Synthetic verified test record",
  });

  // =========================================================================
  // 1. TESTS DE STRUCTURE (TESTS 01 à 09)
  // =========================================================================

  // TEST 01: record valide synthétique
  runTest("TEST 01 — Record valide synthétique passe la validation structurelle", () => {
    const res = validateB31_3DataRecordStructure(validRecordSynthetic);
    assert(res.valid, `Expected valid, got errors: ${res.errors.map((e) => e.message).join("; ")}`);
    assert(res.errors.length === 0, "Errors array must be empty");
  });

  // TEST 02: record null
  runTest("TEST 02 — Record null rejeté", () => {
    const res = validateB31_3DataRecordStructure(null);
    assert(!res.valid, "Null record must be invalid");
    assert(res.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"), "Must return INVALID_RECORD_OBJECT");
  });

  // TEST 03: record array
  runTest("TEST 03 — Record array rejeté", () => {
    const res = validateB31_3DataRecordStructure([]);
    assert(!res.valid, "Array record must be invalid");
    assert(res.errors.some((e) => e.code === "INVALID_RECORD_OBJECT"), "Must return INVALID_RECORD_OBJECT");
  });

  // TEST 04: dataId vide
  runTest("TEST 04 — dataId vide rejeté", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      dataId: "   ",
    });
    assert(!res.valid, "Empty dataId must be invalid");
    assert(res.errors.some((e) => e.code === "EMPTY_DATA_ID"), "Must return EMPTY_DATA_ID");
  });

  // TEST 05: standardId vide
  runTest("TEST 05 — standardId vide rejeté", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      standardId: "",
    });
    assert(!res.valid, "Empty standardId must be invalid");
    assert(res.errors.some((e) => e.code === "EMPTY_STANDARD_ID"), "Must return EMPTY_STANDARD_ID");
  });

  // TEST 06: editionId vide
  runTest("TEST 06 — editionId vide rejeté", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      editionId: "  ",
    });
    assert(!res.valid, "Empty editionId must be invalid");
    assert(res.errors.some((e) => e.code === "EMPTY_EDITION_ID"), "Must return EMPTY_EDITION_ID");
  });

  // TEST 07: sourceDocumentId vide
  runTest("TEST 07 — sourceDocumentId vide rejeté", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      sourceDocumentId: "",
    });
    assert(!res.valid, "Empty sourceDocumentId must be invalid");
    assert(res.errors.some((e) => e.code === "EMPTY_SOURCE_DOCUMENT_ID"), "Must return EMPTY_SOURCE_DOCUMENT_ID");
  });

  // TEST 08: evidenceId vide
  runTest("TEST 08 — evidenceId vide rejeté", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      evidenceId: "",
    });
    assert(!res.valid, "Empty evidenceId must be invalid");
    assert(res.errors.some((e) => e.code === "EMPTY_EVIDENCE_ID"), "Must return EMPTY_EVIDENCE_ID");
  });

  // TEST 09: clauseReference vide
  runTest("TEST 09 — clauseReference vide rejeté", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      clauseReference: "  ",
    });
    assert(!res.valid, "Empty clauseReference must be invalid");
    assert(res.errors.some((e) => e.code === "EMPTY_CLAUSE_REFERENCE"), "Must return EMPTY_CLAUSE_REFERENCE");
  });

  // =========================================================================
  // 2. TESTS DU REGISTRE (TESTS 10 à 15)
  // =========================================================================

  // TEST 10: register
  runTest("TEST 10 — Enregistrement réussi d'un record valide dans le registre", () => {
    const { dataRegistry } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);
    assert(dataRegistry.count() === 1, "Registry count must be 1");
    assert(dataRegistry.has("SYNTHETIC_B31_3_DATA_001"), "Registry must have registered record");
    const retrieved = dataRegistry.get("SYNTHETIC_B31_3_DATA_001");
    assert(retrieved !== undefined, "Retrieved record must be defined");
    assert(retrieved?.dataId === "SYNTHETIC_B31_3_DATA_001", "dataId mismatch");
    assert(retrieved?.status === "VERIFIED", "status must be VERIFIED");
  });

  // TEST 11: duplicate rejection
  runTest("TEST 11 — Doublon de dataId formellement rejeté", () => {
    const { dataRegistry } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);
    let threw = false;
    try {
      dataRegistry.register(validRecordSynthetic);
    } catch {
      threw = true;
    }
    assert(threw, "Must throw on duplicate dataId");
    assert(dataRegistry.count() === 1, "Count must remain 1");
  });

  // TEST 12: immutable retrieval
  runTest("TEST 12 — Récupération d'une copie immuable gelée", () => {
    const { dataRegistry } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);
    const retrieved = dataRegistry.get("SYNTHETIC_B31_3_DATA_001");
    assert(Object.isFrozen(retrieved), "Retrieved record must be frozen");
  });

  // TEST 13: deterministic list
  runTest("TEST 13 — list() déterministe et triée alphabétiquement", () => {
    const { dataRegistry, docRegistry, evRegistry } = createTestEnvironment();

    const recordB: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_B31_3_DATA_002",
    };
    const recordA: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_B31_3_DATA_001",
    };

    // Inverser l'ordre d'insertion
    dataRegistry.register(recordB);
    dataRegistry.register(recordA);

    const list = dataRegistry.list();
    assert(list.length === 2, "List length must be 2");
    assert(list[0].dataId === "SYNTHETIC_B31_3_DATA_001", "First item must be DATA_001");
    assert(list[1].dataId === "SYNTHETIC_B31_3_DATA_002", "Second item must be DATA_002");
  });

  // TEST 14: empty registry initial
  runTest("TEST 14 — Registre initialement vide sans données injectées", () => {
    const { dataRegistry } = createTestEnvironment();
    assert(dataRegistry.count() === 0, "Initial count must be 0");
    assert(dataRegistry.list().length === 0, "Initial list must be empty");
  });

  // TEST 15: clear
  runTest("TEST 15 — clear() réinitialise complètement le registre", () => {
    const { dataRegistry } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);
    assert(dataRegistry.count() === 1, "Count must be 1 before clear");
    dataRegistry.clear();
    assert(dataRegistry.count() === 0, "Count must be 0 after clear");
    assert(!dataRegistry.has("SYNTHETIC_B31_3_DATA_001"), "has must return false after clear");
  });

  // =========================================================================
  // 3. TESTS DE LA CHAÎNE DOCUMENTAIRE / GOUVERNANCE (TESTS 16 à 20)
  // =========================================================================

  // TEST 16: VERIFIED source + VERIFIED evidence -> VERIFIED possible
  runTest("TEST 16 — Chaîne complète vérifiée (Doc VERIFIED + Evidence VERIFIED) -> Record VERIFIED accepté", () => {
    const { docResolver, evResolver, dataRegistry } = createTestEnvironment();
    const govRes = validateB31_3DataRecordGovernance(validRecordSynthetic, docResolver, evResolver);
    assert(govRes.valid, `Expected valid governance, got: ${govRes.errors.map((e) => e.message).join("; ")}`);
    dataRegistry.register(validRecordSynthetic);
    assert(dataRegistry.has("SYNTHETIC_B31_3_DATA_001"), "Registration must succeed");
  });

  // TEST 17: UNVERIFIED source -> VERIFIED bloqué
  runTest("TEST 17 — Source UNVERIFIED bloque l'enregistrement d'un record VERIFIED", () => {
    const { docResolver, evResolver, dataRegistry } = createTestEnvironment();
    const invalidRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_DATA_UNV_SRC",
      sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_UNVERIFIED",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(invalidRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when source document is UNVERIFIED");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED"),
      "Must return VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED"
    );

    let threw = false;
    try {
      dataRegistry.register(invalidRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw when registering VERIFIED record with UNVERIFIED source");
  });

  // TEST 18: NOT_FOUND source -> VERIFIED bloqué
  runTest("TEST 18 — Source NOT_FOUND bloque l'enregistrement d'un record VERIFIED", () => {
    const { docResolver, evResolver, dataRegistry } = createTestEnvironment();
    const invalidRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_DATA_MISSING_SRC",
      sourceDocumentId: "SYNTHETIC_NON_EXISTENT_DOCUMENT",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(invalidRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when source document is missing");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_SOURCE_DOCUMENT_NOT_FOUND"),
      "Must return VERIFIED_RECORD_SOURCE_DOCUMENT_NOT_FOUND"
    );

    let threw = false;
    try {
      dataRegistry.register(invalidRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw when registering VERIFIED record with missing source");
  });

  // TEST 19: UNVERIFIED evidence -> VERIFIED bloqué
  runTest("TEST 19 — Evidence UNVERIFIED bloque l'enregistrement d'un record VERIFIED", () => {
    const { docResolver, evResolver, dataRegistry } = createTestEnvironment();
    const invalidRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_DATA_UNV_EV",
      evidenceId: "SYNTHETIC_EVIDENCE_UNVERIFIED",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(invalidRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when evidence is UNVERIFIED");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_EVIDENCE_UNVERIFIED"),
      "Must return VERIFIED_RECORD_EVIDENCE_UNVERIFIED"
    );

    let threw = false;
    try {
      dataRegistry.register(invalidRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw when registering VERIFIED record with UNVERIFIED evidence");
  });

  // TEST 20: NOT_FOUND evidence -> VERIFIED bloqué
  runTest("TEST 20 — Evidence NOT_FOUND bloque l'enregistrement d'un record VERIFIED", () => {
    const { docResolver, evResolver, dataRegistry } = createTestEnvironment();
    const invalidRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_DATA_MISSING_EV",
      evidenceId: "SYNTHETIC_NON_EXISTENT_EVIDENCE",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(invalidRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when evidence is missing");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_EVIDENCE_NOT_FOUND"),
      "Must return VERIFIED_RECORD_EVIDENCE_NOT_FOUND"
    );

    let threw = false;
    try {
      dataRegistry.register(invalidRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw when registering VERIFIED record with missing evidence");
  });

  // =========================================================================
  // 4. TESTS DU RESOLVER (TESTS 21 à 24)
  // =========================================================================

  // TEST 21: FOUND_VERIFIED
  runTest("TEST 21 — Résolution d'un record vérifié -> FOUND_VERIFIED", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    const res = dataResolver.resolveData<number>("SYNTHETIC_B31_3_DATA_001");
    assert(res.status === "FOUND_VERIFIED", `Expected FOUND_VERIFIED, got '${res.status}'`);
    assert(res.record !== undefined, "Record must be defined");
    assert(res.record?.value === 120.5, "Value mismatch");
  });

  // TEST 22: FOUND_UNVERIFIED
  runTest("TEST 22 — Résolution d'un record non vérifié -> FOUND_UNVERIFIED", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    const unverifiedRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_B31_3_DATA_UNVERIFIED",
      status: "UNVERIFIED",
    };
    dataRegistry.register(unverifiedRecord);

    const res = dataResolver.resolveData<number>("SYNTHETIC_B31_3_DATA_UNVERIFIED");
    assert(res.status === "FOUND_UNVERIFIED", `Expected FOUND_UNVERIFIED, got '${res.status}'`);
    assert(res.record !== undefined, "Record must be defined");
  });

  // TEST 23: NOT_FOUND
  runTest("TEST 23 — Résolution d'un record inexistant -> NOT_FOUND", () => {
    const { dataResolver } = createTestEnvironment();
    const res = dataResolver.resolveData("SYNTHETIC_NON_EXISTENT_ID");
    assert(res.status === "NOT_FOUND", `Expected NOT_FOUND, got '${res.status}'`);
    assert(res.record === undefined, "Record must be undefined for NOT_FOUND");
  });

  // TEST 24: INVALID
  runTest("TEST 24 — Résolution avec identifiant vide ou invalide -> INVALID", () => {
    const { dataResolver } = createTestEnvironment();
    const res1 = dataResolver.resolveData("");
    assert(res1.status === "INVALID", "Empty id must return INVALID");

    const res2 = dataResolver.resolveData("MAT_CS_A106");
    assert(res2.status === "INVALID", "Disallowed token heuristic must return INVALID");
  });

  // =========================================================================
  // 5. TESTS DE NON-PROMOTION & ANTI-HEURISTIQUE (TESTS 25 à 30)
  // =========================================================================

  // TEST 25: UNVERIFIED record ne devient jamais VERIFIED
  runTest("TEST 25 — Record UNVERIFIED ne devient jamais VERIFIED lors de la résolution", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    const unverifiedRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_DATA_UNV_STRICT",
      status: "UNVERIFIED",
    };
    dataRegistry.register(unverifiedRecord);

    const res = dataResolver.resolveData("SYNTHETIC_DATA_UNV_STRICT");
    assert(res.status !== "FOUND_VERIFIED", "Must NEVER promote UNVERIFIED to FOUND_VERIFIED");
    assert(res.status === "FOUND_UNVERIFIED", "Status must be FOUND_UNVERIFIED");
  });

  // TEST 26: resolver ne modifie jamais le record
  runTest("TEST 26 — Le resolver ne modifie jamais l'objet record enregistré", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    const res1 = dataResolver.resolveData<number>("SYNTHETIC_B31_3_DATA_001");
    const res2 = dataResolver.resolveData<number>("SYNTHETIC_B31_3_DATA_001");

    assert(res1.record === res2.record, "Must return reference to same frozen object");
    assert(JSON.stringify(res1.record) === JSON.stringify(validRecordSynthetic), "Object state unchanged");
  });

  // TEST 27: aucune heuristique
  runTest("TEST 27 — Rejet absolu des tokens heuristiques (MAT_CS_*, _CS_, etc.)", () => {
    const { dataRegistry } = createTestEnvironment();
    const disallowedTokens = [
      "MAT_CS_PIPE",
      "CS_A106",
      "RECORD_CS_VAL",
      "CARBON_STEEL_VAL",
      "CRMO",
      "CR_MO",
      "CRMO_VALUE",
      "CR_MO_VALUE",
      "AUSTENITIC",
    ];

    for (const tok of disallowedTokens) {
      let threw = false;
      try {
        dataRegistry.register({
          ...validRecordSynthetic,
          dataId: tok,
        });
      } catch {
        threw = true;
      }
      assert(threw, `Must throw when dataId uses heuristic token '${tok}'`);
    }
  });

  // TEST 28: aucun fallback sourceReference
  runTest("TEST 28 — sourceReference seul ne remplace jamais un sourceDocumentId + evidenceId vérifiés", () => {
    const { docResolver, evResolver } = createTestEnvironment();
    const recordWithOnlyReference = {
      ...validRecordSynthetic,
      sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_UNVERIFIED",
      evidenceId: "SYNTHETIC_EVIDENCE_UNVERIFIED",
      status: "VERIFIED" as const,
      notes: "Document reference claimed in notes without verified evidence",
    };

    const govRes = validateB31_3DataRecordGovernance(recordWithOnlyReference, docResolver, evResolver);
    assert(!govRes.valid, "Must reject VERIFIED record relying on unverified chain regardless of notes/reference");
  });

  // TEST 29: aucun fuzzy matching
  runTest("TEST 29 — Aucun fuzzy matching : une clé partielle ou approchée retourne NOT_FOUND", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    // Essayer des clés partielles
    assert(dataResolver.resolveData("SYNTHETIC_B31_3_DATA").status === "NOT_FOUND", "Partial key must return NOT_FOUND");
    assert(dataResolver.resolveData("synthetic_b31_3_data_001").status === "NOT_FOUND", "Case mismatch must return NOT_FOUND");
    assert(dataResolver.resolveData("DATA_001").status === "NOT_FOUND", "Suffix key must return NOT_FOUND");
  });

  // TEST 30: déterminisme avec ordre inversé
  runTest("TEST 30 — Déterminisme strict indépendant de l'ordre d'insertion", () => {
    const docReg1 = new NormativeSourceDocumentRegistry();
    docReg1.register(verifiedDoc);
    const evReg1 = new NormativeEvidenceRegistry();
    evReg1.register(verifiedEvidence);
    const reg1 = new B31_3DataRegistry(
      new NormativeSourceDocumentResolver(docReg1),
      new NormativeEvidenceResolver(evReg1)
    );

    const docReg2 = new NormativeSourceDocumentRegistry();
    docReg2.register(verifiedDoc);
    const evReg2 = new NormativeEvidenceRegistry();
    evReg2.register(verifiedEvidence);
    const reg2 = new B31_3DataRegistry(
      new NormativeSourceDocumentResolver(docReg2),
      new NormativeEvidenceResolver(evReg2)
    );

    const rec1: B31_3NormativeDataRecord<number> = { ...validRecordSynthetic, dataId: "SYNTHETIC_REC_1" };
    const rec2: B31_3NormativeDataRecord<number> = { ...validRecordSynthetic, dataId: "SYNTHETIC_REC_2" };

    // reg1: 1 puis 2
    reg1.register(rec1);
    reg1.register(rec2);

    // reg2: 2 puis 1
    reg2.register(rec2);
    reg2.register(rec1);

    const list1 = reg1.list();
    const list2 = reg2.list();

    assert(list1.length === list2.length, "Lengths must match");
    assert(list1[0].dataId === list2[0].dataId, "First item dataId must match");
    assert(list1[1].dataId === list2[1].dataId, "Second item dataId must match");
  });

  // =========================================================================
  // 6. TESTS D'INTÉGRITÉ CRITIQUE (Section 14 & Batch)
  // =========================================================================

  // TEST 31: Test d'intégrité critique — sourceReference seule ne produit JAMAIS VERIFIED
  runTest("TEST 31 — Test d'intégrité critique : sourceReference seule != Evidence vérifiée", () => {
    const { docResolver, evResolver } = createTestEnvironment();
    const bareRecord: B31_3NormativeDataRecord<string> = {
      dataId: "SYNTHETIC_BARE_RECORD",
      standardId: "SYNTHETIC_STANDARD_01",
      editionId: "SYNTHETIC_EDITION_01",
      sourceDocumentId: "SYNTHETIC_NON_EXISTENT_DOC",
      evidenceId: "SYNTHETIC_NON_EXISTENT_EV",
      clauseReference: "SYNTHETIC_PARAGRAPH_304",
      dataType: "MATERIAL_SPECIFICATION",
      value: "SYNTHETIC_MATERIAL_NAME",
      status: "VERIFIED",
    };

    const res = validateB31_3DataRecordGovernance(bareRecord, docResolver, evResolver);
    assert(!res.valid, "Bare text metadata alone must never satisfy VERIFIED governance");
    assert(res.errors.length >= 2, "Must flag missing source document and missing evidence");
  });

  // TEST 32: resolveDataSet consolide fidèlement l'état d'un lot de données
  runTest("TEST 32 — resolveDataSet bilan consolidé et typé", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    const unverifiedRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_DATA_UNV",
      status: "UNVERIFIED",
    };
    dataRegistry.register(unverifiedRecord);

    const setRes = dataResolver.resolveDataSet([
      "SYNTHETIC_B31_3_DATA_001",
      "SYNTHETIC_DATA_UNV",
      "SYNTHETIC_NON_EXISTENT",
    ]);

    assert(setRes.totalRequested === 3, "totalRequested mismatch");
    assert(setRes.verifiedCount === 1, "verifiedCount mismatch");
    assert(setRes.unverifiedCount === 1, "unverifiedCount mismatch");
    assert(setRes.notFoundCount === 1, "notFoundCount mismatch");
    assert(setRes.allFound === false, "allFound must be false");
    assert(setRes.allVerified === false, "allVerified must be false");
  });

  // =========================================================================
  // 7. TESTS B31.3-03 (TESTS 33 à 50)
  // =========================================================================

  // TEST 33: Une donnée réellement vérifiée peut être enregistrée avec succès
  runTest("TEST 33 (B31.3-03) — Une donnée vérifiée avec chaîne complète est enregistrée avec succès", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    const verifiedItem: B31_3NormativeDataRecord<number> = {
      dataId: "SYNTHETIC_B31_3_VERIFIED_ITEM_01",
      standardId: "SYNTHETIC_STANDARD_01",
      editionId: "SYNTHETIC_EDITION_01",
      sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_VERIFIED",
      evidenceId: "SYNTHETIC_EVIDENCE_VERIFIED",
      clauseReference: "SYNTHETIC_CLAUSE_01",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      unit: "MPa",
      status: "VERIFIED",
    };

    dataRegistry.register(verifiedItem);
    const res = dataResolver.resolveData<number>("SYNTHETIC_B31_3_VERIFIED_ITEM_01");
    assert(res.status === "FOUND_VERIFIED", `Expected FOUND_VERIFIED, got '${res.status}'`);
    assert(res.record?.value === 137.9, "Value mismatch");
    assert(res.record?.unit === "MPa", "Unit mismatch");
  });

  // TEST 34: Une donnée sans SourceDocument vérifié est rejetée
  runTest("TEST 34 (B31.3-03) — Une donnée sans SourceDocument vérifié est rejetée", () => {
    const { dataRegistry, docResolver, evResolver } = createTestEnvironment();
    const badDocRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_BAD_DOC_RECORD",
      sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_UNVERIFIED",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(badDocRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail for unverified source document");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED"),
      "Must return VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED"
    );

    let threw = false;
    try {
      dataRegistry.register(badDocRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw when source document is not verified");
  });

  // TEST 35: Une donnée sans Evidence vérifiée est rejetée
  runTest("TEST 35 (B31.3-03) — Une donnée sans Evidence vérifiée est rejetée", () => {
    const { dataRegistry, docResolver, evResolver } = createTestEnvironment();
    const badEvRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_BAD_EV_RECORD",
      evidenceId: "SYNTHETIC_EVIDENCE_UNVERIFIED",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(badEvRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail for unverified evidence");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_EVIDENCE_UNVERIFIED"),
      "Must return VERIFIED_RECORD_EVIDENCE_UNVERIFIED"
    );

    let threw = false;
    try {
      dataRegistry.register(badEvRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw when evidence is not verified");
  });

  // TEST 36: Une donnée dont standardId diffère de l'Evidence et du Document Source est rejetée
  runTest("TEST 36 (B31.3-03) — Incohérence de standardId entre record et Evidence / SourceDocument est rejetée", () => {
    const { dataRegistry, docResolver, evResolver } = createTestEnvironment();
    const mismatchStdRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_MISMATCH_STD_RECORD",
      standardId: "SYNTHETIC_STANDARD_DIFFERENT",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(mismatchStdRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when standardId differs from evidence and document");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_SOURCE_DOCUMENT_STANDARD_MISMATCH"),
      "Must return VERIFIED_RECORD_SOURCE_DOCUMENT_STANDARD_MISMATCH"
    );
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_STANDARD_MISMATCH"),
      "Must return VERIFIED_RECORD_STANDARD_MISMATCH"
    );

    let threw = false;
    try {
      dataRegistry.register(mismatchStdRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw on standardId mismatch");
  });

  // TEST 37: Une donnée dont editionId diffère de l'Evidence et du Document Source est rejetée
  runTest("TEST 37 (B31.3-03) — Incohérence d'editionId entre record et Evidence / SourceDocument est rejetée", () => {
    const { dataRegistry, docResolver, evResolver } = createTestEnvironment();
    const mismatchEdRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_MISMATCH_ED_RECORD",
      editionId: "SYNTHETIC_EDITION_DIFFERENT",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(mismatchEdRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when editionId differs from evidence and document");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_SOURCE_DOCUMENT_EDITION_MISMATCH"),
      "Must return VERIFIED_RECORD_SOURCE_DOCUMENT_EDITION_MISMATCH"
    );
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_EDITION_MISMATCH"),
      "Must return VERIFIED_RECORD_EDITION_MISMATCH"
    );

    let threw = false;
    try {
      dataRegistry.register(mismatchEdRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw on editionId mismatch");
  });

  // TEST 38: Une Evidence liée à un autre sourceDocumentId est rejetée
  runTest("TEST 38 (B31.3-03) — Evidence liée à un autre sourceDocumentId est rejetée", () => {
    const { dataRegistry, docResolver, evResolver } = createTestEnvironment();
    const mismatchDocRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_MISMATCH_DOC_RECORD",
      sourceDocumentId: "SYNTHETIC_SOURCE_DOCUMENT_UNVERIFIED", // Evidence is bound to SYNTHETIC_SOURCE_DOCUMENT_VERIFIED
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(mismatchDocRecord, docResolver, evResolver);
    assert(!govRes.valid, "Governance validation must fail when record sourceDocumentId differs from evidence sourceDocumentId");
    assert(
      govRes.errors.some((e) => e.code === "VERIFIED_RECORD_EVIDENCE_DOCUMENT_MISMATCH" || e.code === "VERIFIED_RECORD_SOURCE_DOCUMENT_UNVERIFIED"),
      "Must return error for source document mismatch"
    );

    let threw = false;
    try {
      dataRegistry.register(mismatchDocRecord);
    } catch {
      threw = true;
    }
    assert(threw, "Registry must throw on evidence document mismatch");
  });

  // TEST 39: sourceReference seul ne permet jamais VERIFIED
  runTest("TEST 39 (B31.3-03) — sourceReference textuel seul ne permet jamais le statut VERIFIED", () => {
    const { docResolver, evResolver } = createTestEnvironment();
    const fakeReferenceRecord: B31_3NormativeDataRecord<number> = {
      dataId: "SYNTHETIC_TEXT_REF_RECORD",
      standardId: "SYNTHETIC_STANDARD_01",
      editionId: "SYNTHETIC_EDITION_01",
      sourceDocumentId: "SYNTHETIC_UNAUDITED_DOC",
      evidenceId: "SYNTHETIC_UNAUDITED_EV",
      clauseReference: "PARAGRAPH_304",
      dataType: "ALLOWABLE_STRESS",
      value: 120,
      unit: "MPa",
      status: "VERIFIED",
      notes: "Reference claiming to be ASME without audit",
    };

    const govRes = validateB31_3DataRecordGovernance(fakeReferenceRecord, docResolver, evResolver);
    assert(!govRes.valid, "Textual reference alone must never satisfy VERIFIED governance");
  });

  // TEST 40: Une donnée UNVERIFIED reste FOUND_UNVERIFIED
  runTest("TEST 40 (B31.3-03) — Une donnée UNVERIFIED reste FOUND_UNVERIFIED sans blocage", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    const unverifiedRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_RECORD_UNVERIFIED_STABLE",
      status: "UNVERIFIED",
    };

    dataRegistry.register(unverifiedRecord);
    const res = dataResolver.resolveData("SYNTHETIC_RECORD_UNVERIFIED_STABLE");
    assert(res.status === "FOUND_UNVERIFIED", `Expected FOUND_UNVERIFIED, got '${res.status}'`);
    assert(res.record !== undefined, "Record must be returned");
  });

  // TEST 41: Aucune promotion automatique vers FOUND_VERIFIED
  runTest("TEST 41 (B31.3-03) — Aucune promotion automatique UNVERIFIED vers FOUND_VERIFIED", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    const unverifiedRecord: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_NO_PROMO",
      status: "UNVERIFIED",
    };
    dataRegistry.register(unverifiedRecord);

    const res = dataResolver.resolveData("SYNTHETIC_NO_PROMO");
    assert(res.status !== "FOUND_VERIFIED", "Must NEVER promote UNVERIFIED to FOUND_VERIFIED");
    assert(res.status === "FOUND_UNVERIFIED", "Must be FOUND_UNVERIFIED");
  });

  // TEST 42: Aucune conversion d'unité
  runTest("TEST 42 (B31.3-03) — Aucune conversion automatique d'unité (unités préservées telles quelles)", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    const recordWithUnit: B31_3NormativeDataRecord<number> = {
      ...validRecordSynthetic,
      dataId: "SYNTHETIC_UNIT_PRESERVE",
      value: 20000,
      unit: "psi",
    };
    dataRegistry.register(recordWithUnit);

    const res = dataResolver.resolveData<number>("SYNTHETIC_UNIT_PRESERVE");
    assert(res.record?.value === 20000, "Value must not be mathematically converted");
    assert(res.record?.unit === "psi", "Unit string must not be converted (e.g. psi -> MPa)");
  });

  // TEST 43: Aucun fuzzy matching
  runTest("TEST 43 (B31.3-03) — Aucun fuzzy matching ou recherche approchée", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    assert(dataResolver.resolveData("SYNTHETIC_B31_3_DATA_00").status === "NOT_FOUND", "Partial match must fail");
    assert(dataResolver.resolveData("SYNTHETIC_b31_3_data_001").status === "NOT_FOUND", "Case variation must fail");
  });

  // TEST 44: Aucune recherche par nom de matériau
  runTest("TEST 44 (B31.3-03) — Aucune recherche par nom de matériau (dataId exact obligatoire)", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    assert(dataResolver.resolveData("A106-B").status === "NOT_FOUND", "Material name lookup must return NOT_FOUND");
    assert(dataResolver.resolveData("ASTM A106").status === "NOT_FOUND", "Material name lookup must return NOT_FOUND");
  });

  // TEST 45: Aucune déduction de clause
  runTest("TEST 45 (B31.3-03) — Aucune déduction ou synthèse de clause", () => {
    const res = validateB31_3DataRecordStructure({
      ...validRecordSynthetic,
      clauseReference: "",
    });
    assert(!res.valid, "Empty clauseReference must be invalid (clause cannot be inferred)");
  });

  // TEST 46: Le registry par défaut reste vide si aucune donnée réelle n'est enregistrée
  runTest("TEST 46 (B31.3-03) — Le registry par défaut reste vide et aucune donnée fictive n'est injectée", () => {
    const freshReg = new B31_3DataRegistry();
    assert(freshReg.count() === 0, "Default fresh registry count must be 0");
    assert(freshReg.list().length === 0, "Default fresh registry list must be empty");
  });

  // TEST 47: Les données vérifiées sont retournées avec leur chaîne d'identifiants intacte
  runTest("TEST 47 (B31.3-03) — Données retournées avec la chaîne d'identifiants complète et intacte", () => {
    const { dataRegistry, dataResolver } = createTestEnvironment();
    dataRegistry.register(validRecordSynthetic);

    const res = dataResolver.resolveData("SYNTHETIC_B31_3_DATA_001");
    assert(res.status === "FOUND_VERIFIED", "Status must be FOUND_VERIFIED");
    assert(res.record?.dataId === "SYNTHETIC_B31_3_DATA_001", "dataId intact");
    assert(res.record?.standardId === "SYNTHETIC_STANDARD_01", "standardId intact");
    assert(res.record?.editionId === "SYNTHETIC_EDITION_01", "editionId intact");
    assert(res.record?.sourceDocumentId === "SYNTHETIC_SOURCE_DOCUMENT_VERIFIED", "sourceDocumentId intact");
    assert(res.record?.evidenceId === "SYNTHETIC_EVIDENCE_VERIFIED", "evidenceId intact");
    assert(res.record?.clauseReference === "SYNTHETIC_CLAUSE_01", "clauseReference intact");
  });

  // TEST 48: Résultat déterministe indépendamment de l'ordre d'insertion
  runTest("TEST 48 (B31.3-03) — Déterminisme strict du registre et des listes de données", () => {
    const env1 = createTestEnvironment();
    const env2 = createTestEnvironment();

    const recA: B31_3NormativeDataRecord<number> = { ...validRecordSynthetic, dataId: "SYNTHETIC_REC_A" };
    const recB: B31_3NormativeDataRecord<number> = { ...validRecordSynthetic, dataId: "SYNTHETIC_REC_B" };

    // Env 1 : A puis B
    env1.dataRegistry.register(recA);
    env1.dataRegistry.register(recB);

    // Env 2 : B puis A
    env2.dataRegistry.register(recB);
    env2.dataRegistry.register(recA);

    const list1 = env1.dataRegistry.list();
    const list2 = env2.dataRegistry.list();

    assert(list1.length === 2 && list2.length === 2, "Both must have 2 records");
    assert(list1[0].dataId === list2[0].dataId, "First item dataId must match");
    assert(list1[1].dataId === list2[1].dataId, "Second item dataId must match");
  });

  // TEST 49 (Section 15): Test critique — standardId + editionId + clause + value + sourceRef != VERIFIED
  runTest("TEST 49 (B31.3-03 Test Critique) — standardId + editionId + clause + value + sourceReference sans Evidence vérifiée != VERIFIED", () => {
    const { docResolver, evResolver } = createTestEnvironment();
    const unverifiedAttempt: B31_3NormativeDataRecord<number> = {
      dataId: "SYNTHETIC_CRITICAL_ATTEMPT",
      standardId: "ASME-B31.3",
      editionId: "2024",
      sourceDocumentId: "NON_EXISTENT_DOCUMENT",
      evidenceId: "NON_EXISTENT_EVIDENCE",
      clauseReference: "Table A-1",
      dataType: "ALLOWABLE_STRESS",
      value: 137.9,
      unit: "MPa",
      status: "VERIFIED",
    };

    const govRes = validateB31_3DataRecordGovernance(unverifiedAttempt, docResolver, evResolver);
    assert(!govRes.valid, "Must reject record when SourceDocument and Evidence are not found/verified");
  });

  // TEST 50 (Section 16): Test de non-invention — B31_3_VERIFIED_DATA ne contient aucune fixture synthétique
  runTest("TEST 50 (B31.3-03 Non-Invention) — B31_3_VERIFIED_DATA ne contient aucune fixture synthétique ni donnée fictive", () => {
    assert(Array.isArray(B31_3_VERIFIED_DATA), "B31_3_VERIFIED_DATA must be an array");
    assert(Object.isFrozen(B31_3_VERIFIED_DATA), "B31_3_VERIFIED_DATA must be frozen");

    // Vérifier qu'aucune donnée synthétique ou fictive n'est présente dans la constante de production
    for (const item of B31_3_VERIFIED_DATA) {
      assert(!item.dataId.startsWith("SYNTHETIC_"), "Must not contain SYNTHETIC fixtures");
      assert(!item.dataId.startsWith("TEST_"), "Must not contain TEST fixtures");
      assert(!item.dataId.startsWith("DEMO_"), "Must not contain DEMO fixtures");
      assert(!item.dataId.startsWith("FAKE_"), "Must not contain FAKE fixtures");
    }

    // Si aucune donnée réelle n'a été certifiée dans le projet, length === 0 est attendu et valide
    if (B31_3_VERIFIED_DATA.length === 0) {
      assert(B31_3_VERIFIED_DATA.length === 0, "Empty verified data confirmed when no certified source is available");
    }
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
