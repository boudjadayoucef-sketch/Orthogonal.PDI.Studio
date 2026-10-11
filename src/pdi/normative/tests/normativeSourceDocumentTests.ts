/**
 * PDI NORMATIVE ENGINE — NORMATIVE SOURCE DOCUMENT TESTS
 * Reference: B31.3-01 (ASME B31.3 Normative Data Foundation)
 * 
 * Suite de tests unitaires et d'intégration déterministes validant le modèle,
 * le registre et le résolveur de documents sources normatifs.
 */

import {
  NormativeSourceDocumentRegistry,
} from "../registry/normativeSourceDocumentRegistry";
import {
  NormativeSourceDocumentResolver,
} from "../registry/normativeSourceDocumentResolver";
import type {
  NormativeSourceDocument,
} from "../types/normativeSourceDocumentTypes";
import {
  validateNormativeSourceDocument,
} from "../validators/normativeSourceDocumentValidator";

export interface NormativeSourceDocumentTestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly results: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[B31.3-01 ASSERTION FAILED] ${message}`);
  }
}

/**
 * Exécute la suite complète de tests B31.3-01.
 */
export function runNormativeSourceDocumentTests(): NormativeSourceDocumentTestResult {
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

  // Fixtures synthétiques strictes (Section 8)
  const validUnverifiedDoc: NormativeSourceDocument = Object.freeze({
    documentId: "SYNTHETIC_DOCUMENT_01",
    title: "Synthetic Standard Source Document 01",
    publisher: "SYNTHETIC_PUBLISHER",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    documentReference: "SYNTHETIC_DOC_REF_01",
    status: "UNVERIFIED",
    notes: "Synthetic unverified test document",
  });

  const validVerifiedDoc: NormativeSourceDocument = Object.freeze({
    documentId: "SYNTHETIC_DOCUMENT_02",
    title: "Synthetic Standard Source Document 02",
    publisher: "SYNTHETIC_PUBLISHER",
    standardId: "SYNTHETIC_STANDARD_01",
    editionId: "SYNTHETIC_EDITION_01",
    documentReference: "SYNTHETIC_DOC_REF_02",
    status: "VERIFIED",
    verifiedBy: "SYNTHETIC_AUDITOR_01",
    verifiedAt: "2026-01-01T00:00:00.000Z",
    checksum: "sha256:synthetic_checksum_02",
    notes: "Synthetic verified test document",
  });

  // TEST 01: document valide accepté
  runTest("TEST 01 — Document valide accepté dans le registre", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    assert(reg.count() === 1, "Count must be 1 after registration");
    assert(reg.has("SYNTHETIC_DOCUMENT_01"), "Registry must have registered document");
    const retrieved = reg.get("SYNTHETIC_DOCUMENT_01");
    assert(retrieved !== undefined, "Retrieved document must not be undefined");
    assert(retrieved?.documentId === "SYNTHETIC_DOCUMENT_01", "documentId mismatch");
    assert(retrieved?.status === "UNVERIFIED", "status must be UNVERIFIED");
  });

  // TEST 02: document invalide rejeté
  runTest("TEST 02 — Document invalide rejeté avec exception explicite", () => {
    const reg = new NormativeSourceDocumentRegistry();
    let threw = false;
    try {
      reg.register({
        documentId: "SYNTHETIC_DOC_INVALID",
        title: "", // Empty title
        standardId: "SYNTHETIC_STD_01",
        editionId: "SYNTHETIC_ED_01",
        documentReference: "REF_01",
        status: "UNVERIFIED",
      });
    } catch {
      threw = true;
    }
    assert(threw, "Must throw on document with empty title");
    assert(reg.count() === 0, "Registry must remain empty");
  });

  // TEST 03: ID vide rejeté
  runTest("TEST 03 — ID vide ou blanc rejeté", () => {
    const reg = new NormativeSourceDocumentRegistry();
    let threw = false;
    try {
      reg.register({
        ...validUnverifiedDoc,
        documentId: "   ",
      });
    } catch {
      threw = true;
    }
    assert(threw, "Must throw on empty/whitespace documentId");
  });

  // TEST 04: doublon rejeté
  runTest("TEST 04 — Doublon de documentId formellement rejeté", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    let threw = false;
    try {
      reg.register(validUnverifiedDoc);
    } catch {
      threw = true;
    }
    assert(threw, "Must throw on duplicate documentId");
    assert(reg.count() === 1, "Count must remain 1");
  });

  // TEST 05: UNVERIFIED conservé
  runTest("TEST 05 — Statut UNVERIFIED rigoureusement conservé sans mutation", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    const doc = reg.get("SYNTHETIC_DOCUMENT_01");
    assert(doc?.status === "UNVERIFIED", "Status must strictly remain UNVERIFIED");
  });

  // TEST 06: VERIFIED conservé
  runTest("TEST 06 — Statut VERIFIED rigoureusement conservé avec métadonnées d'audit", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validVerifiedDoc);
    const doc = reg.get("SYNTHETIC_DOCUMENT_02");
    assert(doc?.status === "VERIFIED", "Status must strictly remain VERIFIED");
    assert(doc?.verifiedBy === "SYNTHETIC_AUDITOR_01", "verifiedBy mismatch");
    assert(doc?.verifiedAt === "2026-01-01T00:00:00.000Z", "verifiedAt mismatch");
  });

  // TEST 07: document inexistant -> NOT_FOUND
  runTest("TEST 07 — Résolution d'un document inexistant -> NOT_FOUND", () => {
    const reg = new NormativeSourceDocumentRegistry();
    const resolver = new NormativeSourceDocumentResolver(reg);
    const res = resolver.resolveDocument("SYNTHETIC_NON_EXISTENT_DOC");
    assert(res.status === "NOT_FOUND", `Expected NOT_FOUND, got '${res.status}'`);
    assert(res.document === undefined, "document must be undefined for NOT_FOUND");
  });

  // TEST 08: document vérifié -> FOUND_VERIFIED
  runTest("TEST 08 — Résolution d'un document vérifié -> FOUND_VERIFIED", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validVerifiedDoc);
    const resolver = new NormativeSourceDocumentResolver(reg);
    const res = resolver.resolveDocument("SYNTHETIC_DOCUMENT_02");
    assert(res.status === "FOUND_VERIFIED", `Expected FOUND_VERIFIED, got '${res.status}'`);
    assert(res.document !== undefined, "document must be defined for FOUND_VERIFIED");
    assert(res.document?.documentId === "SYNTHETIC_DOCUMENT_02", "documentId mismatch");
  });

  // TEST 09: document non vérifié -> FOUND_UNVERIFIED
  runTest("TEST 09 — Résolution d'un document non vérifié -> FOUND_UNVERIFIED", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    const resolver = new NormativeSourceDocumentResolver(reg);
    const res = resolver.resolveDocument("SYNTHETIC_DOCUMENT_01");
    assert(res.status === "FOUND_UNVERIFIED", `Expected FOUND_UNVERIFIED, got '${res.status}'`);
    assert(res.document !== undefined, "document must be defined for FOUND_UNVERIFIED");
  });

  // TEST 10: resolver déterministe
  runTest("TEST 10 — Resolver strictement déterministe sur appels successifs", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validVerifiedDoc);
    const resolver = new NormativeSourceDocumentResolver(reg);
    const res1 = resolver.resolveDocument("SYNTHETIC_DOCUMENT_02");
    const res2 = resolver.resolveDocument("SYNTHETIC_DOCUMENT_02");
    assert(res1.status === res2.status, "Status must be identical across calls");
    assert(JSON.stringify(res1) === JSON.stringify(res2), "Full response must be identical");
  });

  // TEST 11: aucune promotion UNVERIFIED -> VERIFIED
  runTest("TEST 11 — Aucune promotion automatique UNVERIFIED vers VERIFIED", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    const resolver = new NormativeSourceDocumentResolver(reg);
    const res = resolver.resolveDocument("SYNTHETIC_DOCUMENT_01");
    assert(res.status !== "FOUND_VERIFIED", "Must NEVER promote UNVERIFIED to FOUND_VERIFIED");
    assert(res.status === "FOUND_UNVERIFIED", "Status must be FOUND_UNVERIFIED");
  });

  // TEST 12: token interdit rejeté
  runTest("TEST 12 — Identifiant avec token heuristique interdit rejeté", () => {
    const reg = new NormativeSourceDocumentRegistry();
    const disallowedIds = [
      "MAT_CS_A106",
      "DOC_CS_PIPE",
      "CS_SPEC_01",
      "CARBON_STEEL_DOC",
      "CRMO",
      "AUSTENITIC",
    ];

    for (const did of disallowedIds) {
      let threw = false;
      try {
        reg.register({
          ...validUnverifiedDoc,
          documentId: did,
        });
      } catch {
        threw = true;
      }
      assert(threw, `Must throw when documentId contains disallowed heuristic token '${did}'`);

      const resolver = new NormativeSourceDocumentResolver(reg);
      const res = resolver.resolveDocument(did);
      assert(res.status === "INVALID", `Resolver must return INVALID for token '${did}'`);
    }
  });

  // TEST 13: registry vide au démarrage
  runTest("TEST 13 — Registry initialement vide (aucune donnée inventée)", () => {
    const freshRegistry = new NormativeSourceDocumentRegistry();
    assert(freshRegistry.count() === 0, "Initial count must be 0");
    assert(freshRegistry.list().length === 0, "Initial list must be empty");
  });

  // TEST 14: clear fonctionne
  runTest("TEST 14 — clear() réinitialise complètement le registre", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    reg.register(validVerifiedDoc);
    assert(reg.count() === 2, "Count must be 2 before clear");
    reg.clear();
    assert(reg.count() === 0, "Count must be 0 after clear");
    assert(!reg.has("SYNTHETIC_DOCUMENT_01"), "has must return false after clear");
  });

  // TEST 15: list déterministe
  runTest("TEST 15 — list() déterministe, ordonnée et immuable", () => {
    const reg1 = new NormativeSourceDocumentRegistry();
    reg1.register(validUnverifiedDoc);
    reg1.register(validVerifiedDoc);

    const reg2 = new NormativeSourceDocumentRegistry();
    reg2.register(validVerifiedDoc);
    reg2.register(validUnverifiedDoc);

    const list1 = reg1.list();
    const list2 = reg2.list();

    assert(list1.length === 2, "List length must be 2");
    assert(list1[0].documentId === list2[0].documentId, "Order must be deterministic regardless of insertion order");
    assert(list1[1].documentId === list2[1].documentId, "Order must be deterministic regardless of insertion order");
    assert(Object.isFrozen(list1), "Returned list must be frozen");
  });

  // TEST 16: resolveDocumentSet bilan consolidé
  runTest("TEST 16 — resolveDocumentSet bilan consolidé et typé", () => {
    const reg = new NormativeSourceDocumentRegistry();
    reg.register(validUnverifiedDoc);
    reg.register(validVerifiedDoc);
    const resolver = new NormativeSourceDocumentResolver(reg);

    const setRes = resolver.resolveDocumentSet([
      "SYNTHETIC_DOCUMENT_01",
      "SYNTHETIC_DOCUMENT_02",
      "SYNTHETIC_NON_EXISTENT",
    ]);

    assert(setRes.totalRequested === 3, "totalRequested mismatch");
    assert(setRes.verifiedCount === 1, "verifiedCount mismatch");
    assert(setRes.unverifiedCount === 1, "unverifiedCount mismatch");
    assert(setRes.notFoundCount === 1, "notFoundCount mismatch");
    assert(setRes.allFound === false, "allFound must be false");
    assert(setRes.allVerified === false, "allVerified must be false");
  });

  // TEST 17: Rejet d'objet non conforme / null
  runTest("TEST 17 — Rejet d'objet null ou non-objet dans register et resolver", () => {
    const reg = new NormativeSourceDocumentRegistry();
    let threw = false;
    try {
      reg.register(null as unknown as NormativeSourceDocument);
    } catch {
      threw = true;
    }
    assert(threw, "Must throw on registering null");

    const resolver = new NormativeSourceDocumentResolver(reg);
    const res = resolver.resolveDocument("");
    assert(res.status === "INVALID", "Empty id must return INVALID");
  });

  // TEST 18: Rejet de document VERIFIED sans verifiedBy ou avec date invalide
  runTest("TEST 18 — Validation rejette un document VERIFIED avec date invalide ou sans vérificateur", () => {
    const resNoBy = validateNormativeSourceDocument({
      ...validVerifiedDoc,
      verifiedBy: "",
    });
    assert(!resNoBy.valid, "Must be invalid without verifiedBy");

    const resInvalidDate = validateNormativeSourceDocument({
      ...validVerifiedDoc,
      verifiedAt: "NOT_A_DATE",
    });
    assert(!resInvalidDate.valid, "Must be invalid with invalid verifiedAt date");
  });

  // TEST 19: Barrière architecturale — SourceDocument seul ne produit jamais de qualification VERIFIED
  runTest("TEST 19 — Barrière architecturale : SourceDocument seul != Evidence vérifiée", () => {
    const valResult = validateNormativeSourceDocument(validUnverifiedDoc);
    assert(valResult.valid, "Source document itself is structurally valid");
    assert(
      validUnverifiedDoc.status !== "VERIFIED",
      "Document reference alone must never be implicitly considered VERIFIED"
    );
  });

  const success = results.every((r) => r.startsWith("✅ PASS"));

  return {
    success,
    testsRun,
    results,
  };
}
