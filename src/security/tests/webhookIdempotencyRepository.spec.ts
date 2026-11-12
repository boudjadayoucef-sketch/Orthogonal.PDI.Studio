/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-06-R1 — DURABLE WEBHOOK IDEMPOTENCY TEST SUITE (T1 to T12)
 *
 * Tests the real production modules:
 * - `src/security/webhooks/webhookIdempotencyRepository.ts`
 * - `src/security/webhooks/paymentWebhookProcessor.ts`
 * - `src/security/webhooks/paymentOrderAssociation.ts`
 * - `src/security/webhooks/pendingOrderRepository.ts`
 * - `src/security/webhooks/paddleWebhookHandler.ts`
 *
 * Uses a deterministic transactional Firestore Admin simulator with strict
 * Optimistic Concurrency Control (OCC) / serialized read-your-own-writes isolation
 * and multi-instance separation (no shared in-memory idempotency state).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  createWebhookIdempotencyRepository,
  deriveWebhookEventDocumentId,
  type WebhookIdempotencyRepository
} from "../webhooks/webhookIdempotencyRepository.ts";
import {
  createPendingOrderRepository,
  executeFencedOrderAssociationTransaction
} from "../webhooks/pendingOrderRepository.ts";
import { validateAndAssociatePaddleOrder } from "../webhooks/paymentOrderAssociation.ts";
import { createPaymentWebhookProcessor } from "../webhooks/paymentWebhookProcessor.ts";
import {
  createPaddleWebhookHandler,
  type RawBodyWebhookRequest
} from "../webhooks/paddleWebhookHandler.ts";
import {
  AUTHORITATIVE_PENDING_ORDER_COLLECTION,
  PAYMENT_WEBHOOK_EVENTS_COLLECTION,
  type WebhookFirestoreDb,
  type WebhookFirestoreDocRef,
  type WebhookFirestoreDocSnapshot,
  type WebhookFirestoreTransaction
} from "../webhooks/webhookTypes.ts";

function buildPaddleSignature(rawBody: string, secretKey: string, timestampSec?: number): string {
  const ts = (timestampSec ?? Math.floor(Date.now() / 1000)).toString();
  const signedPayload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secretKey).update(signedPayload, "utf8").digest("hex");
  return `ts=${ts};h1=${h1}`;
}

function createMockHttpResponse() {
  let statusCode = 200;
  let jsonBody: any = undefined;
  const res: any = {
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((body: any) => {
      jsonBody = body;
      return res;
    }),
    get statusCode() {
      return statusCode;
    },
    get jsonBody() {
      return jsonBody;
    }
  };
  return res;
}

/**
 * Deterministic transactional Firestore simulator supporting:
 * - True serialized atomic transactions (`runTransaction`) with staged writes
 *   committed only if the transaction callback resolves without throwing.
 * - Independent server instances sharing the same persistent backing store
 *   with zero shared in-memory idempotency cache.
 * - Injectable failure hooks (`failRunTransaction`, `failCollectionGet`, `failCollectionSet`)
 *   to verify fail-closed semantics under database outages.
 */
function createTransactionalFirestoreBackingStore() {
  const documents = new Map<string, Record<string, unknown>>();
  const transactionCalls: Array<{ startedAtMs: number; committed: boolean }> = [];
  const docReads: Array<{ collection: string; docId: string; inTransaction: boolean }> = [];
  const docWrites: Array<{
    collection: string;
    docId: string;
    inTransaction: boolean;
    data: Record<string, unknown>;
  }> = [];

  let currentClockMs = 1_762_900_000_000;
  let failAllTransactions = false;
  let failIdempotencyTransactions = false;
  let failOrderReads = false;
  let failTransactionalOrderReads = false;
  let failOrderWrites = false;

  // Mutex chain ensuring atomic transaction execution across concurrent promises
  let transactionMutex: Promise<void> = Promise.resolve();

  function cloneRecord(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!obj) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v instanceof Timestamp) {
        out[k] = Timestamp.fromMillis(v.toMillis());
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = cloneRecord(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function createAdminDbClient(): WebhookFirestoreDb {
    return {
      collection: vi.fn((colName: string) => ({
        doc: vi.fn((docId: string): WebhookFirestoreDocRef => {
          const fullKey = `${colName}:${docId}`;
          return {
            id: docId,
            path: `${colName}/${docId}`,
            get: vi.fn(async (): Promise<WebhookFirestoreDocSnapshot> => {
              docReads.push({ collection: colName, docId, inTransaction: false });
              if (colName === AUTHORITATIVE_PENDING_ORDER_COLLECTION && failOrderReads) {
                throw new Error("Simulated Firestore read outage on payment_transactions");
              }
              const stored = documents.get(fullKey);
              return {
                exists: Boolean(stored),
                id: docId,
                data: () => cloneRecord(stored)
              };
            }),
            set: vi.fn(async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
              if (colName === AUTHORITATIVE_PENDING_ORDER_COLLECTION && failOrderWrites) {
                throw new Error("Simulated Firestore write outage on payment_transactions");
              }
              docWrites.push({
                collection: colName,
                docId,
                inTransaction: false,
                data: cloneRecord(data) || {}
              });
              const current = documents.get(fullKey) || {};
              const next = options?.merge
                ? { ...cloneRecord(current), ...cloneRecord(data) }
                : { ...cloneRecord(data) };
              documents.set(fullKey, next);
            })
          };
        }),
        where: vi.fn((field: string, _op: "==", value: unknown) => ({
          get: vi.fn(async () => {
            if (colName === AUTHORITATIVE_PENDING_ORDER_COLLECTION && failOrderReads) {
              throw new Error("Simulated Firestore query outage on payment_transactions");
            }
            const matched: Array<{ id: string; data: () => Record<string, unknown> }> = [];
            for (const [k, v] of documents.entries()) {
              if (k.startsWith(`${colName}:`) && v[field] === value) {
                const id = k.slice(colName.length + 1);
                matched.push({ id, data: () => cloneRecord(v) || {} });
              }
            }
            return {
              empty: matched.length === 0,
              docs: matched
            };
          })
        }))
      })),

      runTransaction: (async <T>(
        updateFn: (tx: WebhookFirestoreTransaction) => Promise<T>
      ): Promise<T> => {
        if (failAllTransactions || failIdempotencyTransactions) {
          transactionCalls.push({ startedAtMs: currentClockMs, committed: false });
          throw new Error("Simulated Firestore transaction failure (UNAVAILABLE / ABORTED)");
        }

          let releaseMutex!: () => void;
          const prevMutex = transactionMutex;
          transactionMutex = new Promise<void>((resolve) => {
            releaseMutex = resolve;
          });

          await prevMutex;

          const stagedWrites = new Map<
            string,
            { colName: string; docId: string; data: Record<string, unknown> }
          >();

          try {
            const tx: WebhookFirestoreTransaction = {
              async get(docRef: WebhookFirestoreDocRef): Promise<WebhookFirestoreDocSnapshot> {
                // Enforce Firestore invariant: all reads must execute before any writes in a transaction
                if (stagedWrites.size > 0) {
                  throw new Error(
                    "Firestore transactions require all reads to be executed before all writes."
                  );
                }

                const pathParts = (docRef.path || "").split("/");
                const colName = pathParts[0] || PAYMENT_WEBHOOK_EVENTS_COLLECTION;
                const docId = docRef.id || pathParts[1] || "";
                const fullKey = `${colName}:${docId}`;

                docReads.push({ collection: colName, docId, inTransaction: true });

                if (
                  colName === AUTHORITATIVE_PENDING_ORDER_COLLECTION &&
                  (failOrderReads || failTransactionalOrderReads)
                ) {
                  throw new Error(
                    "Simulated Firestore transactional read outage on payment_transactions"
                  );
                }

                const staged = stagedWrites.get(fullKey);
                if (staged) {
                  return {
                    exists: true,
                    id: docId,
                    data: () => cloneRecord(staged.data)
                  };
                }

                const existing = documents.get(fullKey);
                return {
                  exists: Boolean(existing),
                  id: docId,
                  data: () => cloneRecord(existing)
                };
              },
              set(
                docRef: WebhookFirestoreDocRef,
                data: Record<string, unknown>,
                options?: { merge?: boolean }
              ) {
                const pathParts = (docRef.path || "").split("/");
                const colName = pathParts[0] || PAYMENT_WEBHOOK_EVENTS_COLLECTION;
                const docId = docRef.id || pathParts[1] || "";
                const fullKey = `${colName}:${docId}`;

                if (colName === AUTHORITATIVE_PENDING_ORDER_COLLECTION && failOrderWrites) {
                  throw new Error(
                    "Simulated Firestore transactional write outage on payment_transactions"
                  );
                }

                const base = stagedWrites.get(fullKey)?.data ?? documents.get(fullKey) ?? {};
                const next = options?.merge
                  ? { ...cloneRecord(base), ...cloneRecord(data) }
                  : { ...cloneRecord(data) };

                stagedWrites.set(fullKey, { colName, docId, data: next });
                return tx;
              }
            };

            const result = await updateFn(tx);

            // Commit staged writes atomically
            for (const [fullKey, entry] of stagedWrites.entries()) {
              documents.set(fullKey, cloneRecord(entry.data) || {});
              docWrites.push({
                collection: entry.colName,
                docId: entry.docId,
                inTransaction: true,
                data: cloneRecord(entry.data) || {}
              });
            }

            transactionCalls.push({ startedAtMs: currentClockMs, committed: true });
            return result;
          } catch (err) {
            transactionCalls.push({ startedAtMs: currentClockMs, committed: false });
            throw err;
          } finally {
            releaseMutex();
          }
      }) as WebhookFirestoreDb["runTransaction"]
    };
  }

  function createServerInstance(paddleSecret = "pdl_ntfset_fix06_secret_2026") {
    const adminDb = createAdminDbClient();
    const authUsers = new Map<string, { uid: string; email: string; disabled?: boolean }>();

    const adminAuth = {
      getUser: vi.fn(async (uid: string) => {
        const u = authUsers.get(uid);
        if (!u) {
          const err: any = new Error(`User not found: ${uid}`);
          err.code = "auth/user-not-found";
          throw err;
        }
        return u;
      }),
      getUserByEmail: vi.fn(async () => {
        throw new Error("getUserByEmail must never be called");
      }),
      setCustomUserClaims: vi.fn(async () => {
        throw new Error("setCustomUserClaims must never be called");
      })
    };

    const idempotencyRepository: WebhookIdempotencyRepository =
      createWebhookIdempotencyRepository({
        adminDb,
        nowMs: () => currentClockMs,
        defaultLeaseDurationMs: 60_000
      });

    const pendingOrderRepository = createPendingOrderRepository({
      adminDb,
      nowMs: () => currentClockMs
    });

    const processor = createPaymentWebhookProcessor({
      adminDb,
      adminAuth,
      idempotencyRepository,
      pendingOrderRepository
    });

    const paddleHandler = createPaddleWebhookHandler({
      processor,
      getPaddleSecret: () => paddleSecret
    });

    function registerUser(uid: string, email: string, disabled = false) {
      authUsers.set(uid, { uid, email, disabled });
    }

    async function sendSignedWebhook(payloadObj: Record<string, unknown>) {
      const rawBody = JSON.stringify(payloadObj);
      const sig = buildPaddleSignature(rawBody, paddleSecret);
      const req = {
        rawBody,
        body: JSON.parse(rawBody),
        headers: { "paddle-signature": sig }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockHttpResponse();
      await paddleHandler(req, res);
      return { req, res };
    }

    return {
      adminDb,
      adminAuth,
      idempotencyRepository,
      pendingOrderRepository,
      processor,
      paddleHandler,
      registerUser,
      sendSignedWebhook
    };
  }

  return {
    documents,
    transactionCalls,
    docReads,
    docWrites,
    getClockMs: () => currentClockMs,
    advanceClockMs: (deltaMs: number) => {
      currentClockMs += deltaMs;
    },
    setFailAllTransactions: (v: boolean) => {
      failAllTransactions = v;
    },
    setFailIdempotencyTransactions: (v: boolean) => {
      failIdempotencyTransactions = v;
    },
    setFailOrderReads: (v: boolean) => {
      failOrderReads = v;
    },
    setFailTransactionalOrderReads: (v: boolean) => {
      failTransactionalOrderReads = v;
    },
    setFailOrderWrites: (v: boolean) => {
      failOrderWrites = v;
    },
    getIdempotencyDoc: (eventId: string) => {
      const docId = deriveWebhookEventDocumentId("paddle", eventId);
      return documents.get(`${PAYMENT_WEBHOOK_EVENTS_COLLECTION}:${docId}`);
    },
    getOrderDoc: (orderId: string) => {
      return documents.get(`${AUTHORITATIVE_PENDING_ORDER_COLLECTION}:${orderId}`);
    },
    createServerInstance
  };
}

describe("SEC-01-FIX-06-R1 — Durable Webhook Idempotency (T1 à T12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // T1 — Première réception
  // =========================================================================
  it("T1 — Première réception : événement absent -> acquisition réussie, document 'processing' créé en transaction puis finalisé en 'completed'", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();

    // Test direct sur le repository d'acquisition
    const acq = await instance.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t1_first_001",
      eventType: "transaction.completed"
    });

    expect(acq.outcome).toBe("acquired");
    if (acq.outcome === "acquired") {
      expect(acq.attemptCount).toBe(1);
      expect(acq.leaseToken).toMatch(/^lease_[0-9a-f]{32}$/);
      expect(acq.documentId).toBe(deriveWebhookEventDocumentId("paddle", "evt_t1_first_001"));
    }

    const storedProcessing = store.getIdempotencyDoc("evt_t1_first_001");
    expect(storedProcessing).toBeDefined();
    expect(storedProcessing?.provider).toBe("paddle");
    expect(storedProcessing?.eventId).toBe("evt_t1_first_001");
    expect(storedProcessing?.eventType).toBe("transaction.completed");
    expect(storedProcessing?.status).toBe("processing");
    expect(storedProcessing?.attemptCount).toBe(1);
    expect(storedProcessing?.leaseToken).toBeTruthy();
    expect(storedProcessing?.leaseExpiresAt).toBeInstanceOf(Timestamp);
    expect(storedProcessing?.completedAt).toBeNull();
  });

  // =========================================================================
  // T2 — Événement déjà terminé
  // =========================================================================
  it("T2 — Événement déjà terminé : deuxième réception -> résultat 'already_processed', aucun second traitement métier", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t2_user", "t2@orthogonal.fr");

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t2_user",
      verifiedUserEmail: "t2@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_t2_completed_001",
      event_type: "transaction.completed",
      data: {
        id: "txn_t2_001",
        custom_data: { orderId: order.orderId }
      }
    };

    // 1ère réception -> traitement complet
    const { res: res1 } = await instance.sendSignedWebhook(payload);
    expect(res1.statusCode).toBe(200);
    expect(res1.jsonBody?.associated).toBe(true);
    expect(store.getIdempotencyDoc("evt_t2_completed_001")?.status).toBe("completed");
    expect(store.getIdempotencyDoc("evt_t2_completed_001")?.leaseToken).toBeNull();
    expect(store.getIdempotencyDoc("evt_t2_completed_001")?.completedAt).toBeInstanceOf(Timestamp);

    const orderWritesBeforeSecond = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    instance.adminAuth.getUser.mockClear();

    // 2ème réception -> already_processed, aucun appel métier ni écriture dans payment_transactions
    const { res: res2 } = await instance.sendSignedWebhook(payload);
    expect(res2.statusCode).toBe(200);
    expect(res2.jsonBody).toEqual({
      received: true,
      status: "already_processed"
    });

    const orderWritesAfterSecond = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    expect(orderWritesAfterSecond).toBe(orderWritesBeforeSecond);
    expect(instance.adminAuth.getUser).not.toHaveBeenCalled();
  });

  // =========================================================================
  // T3 — Concurrence entre deux instances serveur
  // =========================================================================
  it("T3 — Concurrence : deux acquisitions simultanées du même événement sur deux instances -> une seule acquiert le lease, l'autre reçoit 'in_progress' (HTTP 409)", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instanceA = store.createServerInstance();
    const instanceB = store.createServerInstance();
    instanceA.registerUser("uid_t3_user", "t3@orthogonal.fr");
    instanceB.registerUser("uid_t3_user", "t3@orthogonal.fr");

    const order = await instanceA.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t3_user",
      verifiedUserEmail: "t3@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    // 1. Concurrence directe sur acquireEventLease entre instanceA et instanceB
    const [leaseA, leaseB] = await Promise.all([
      instanceA.idempotencyRepository.acquireEventLease({
        provider: "paddle",
        eventId: "evt_t3_concurrent_direct",
        eventType: "transaction.completed"
      }),
      instanceB.idempotencyRepository.acquireEventLease({
        provider: "paddle",
        eventId: "evt_t3_concurrent_direct",
        eventType: "transaction.completed"
      })
    ]);

    const outcomes = [leaseA.outcome, leaseB.outcome].sort();
    expect(outcomes).toEqual(["acquired", "in_progress"]);

    // 2. Concurrence complète au niveau du processeur / handler HTTP entre instanceA et instanceB
    const webhookPayload = {
      event_id: "evt_t3_concurrent_webhook",
      event_type: "transaction.completed",
      data: {
        id: "txn_t3_concurrent_001",
        custom_data: { orderId: order.orderId }
      }
    };

    const [webhookResA, webhookResB] = await Promise.all([
      instanceA.sendSignedWebhook(webhookPayload),
      instanceB.sendSignedWebhook(webhookPayload)
    ]);

    const statuses = [webhookResA.res.statusCode, webhookResB.res.statusCode].sort();
    // L'un traite et réussit (200), l'autre voit in_progress (409) ou already_processed (200)
    // sans jamais exécuter deux écritures d'association sur payment_transactions
    expect(
      statuses.every((s) => s === 200 || s === 409)
    ).toBe(true);

    const associationWrites = store.docWrites.filter(
      (w) =>
        w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION &&
        w.data.associationStatus === "associated"
    );
    expect(associationWrites).toHaveLength(1);
  });

  // =========================================================================
  // T4 — Redémarrage du serveur (aucun état mémoire partagé)
  // =========================================================================
  it("T4 — Redémarrage : un nouveau repository et processeur recréés après redémarrage retrouvent l'état 'completed' dans Firestore sans aucun cache mémoire partagé", async () => {
    const store = createTransactionalFirestoreBackingStore();

    // Instance 1 avant redémarrage
    const instanceBeforeRestart = store.createServerInstance();
    instanceBeforeRestart.registerUser("uid_t4_user", "t4@orthogonal.fr");

    const order = await instanceBeforeRestart.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t4_user",
      verifiedUserEmail: "t4@orthogonal.fr",
      plan: "team",
      billingCycle: "yearly",
      amount: 1200,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_t4_survives_restart",
      event_type: "transaction.completed",
      data: {
        id: "txn_t4_001",
        custom_data: { orderId: order.orderId }
      }
    };

    const { res: firstRes } = await instanceBeforeRestart.sendSignedWebhook(payload);
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.jsonBody?.associated).toBe(true);

    // Simulation d'un redémarrage complet : nouvelle instance avec nouveau repository et nouveau processeur
    const instanceAfterRestart = store.createServerInstance();
    instanceAfterRestart.registerUser("uid_t4_user", "t4@orthogonal.fr");

    const persistedRecord = await instanceAfterRestart.idempotencyRepository.getEventRecord(
      "paddle",
      "evt_t4_survives_restart"
    );
    expect(persistedRecord?.status).toBe("completed");

    const { res: secondRes } = await instanceAfterRestart.sendSignedWebhook(payload);
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.jsonBody).toEqual({
      received: true,
      status: "already_processed"
    });
    expect(instanceAfterRestart.adminAuth.getUser).not.toHaveBeenCalled();
  });

  // =========================================================================
  // T5 — Deux événements distincts pour une même transaction
  // =========================================================================
  it("T5 — Deux événements distincts avec le même providerTransactionId ont des clés d'idempotence distinctes tout en respectant les règles métier d'association", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t5_user", "t5@orthogonal.fr");

    const key1 = deriveWebhookEventDocumentId("paddle", "evt_t5_first");
    const key2 = deriveWebhookEventDocumentId("paddle", "evt_t5_second");
    expect(key1).not.toBe(key2);

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t5_user",
      verifiedUserEmail: "t5@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    // Événement 1 -> associe la commande et passe à completed
    const { res: resEvt1 } = await instance.sendSignedWebhook({
      event_id: "evt_t5_first",
      event_type: "transaction.completed",
      data: {
        id: "txn_t5_shared_tx",
        custom_data: { orderId: order.orderId }
      }
    });
    expect(resEvt1.statusCode).toBe(200);
    expect(store.getIdempotencyDoc("evt_t5_first")?.status).toBe("completed");

    // Événement 2 (autre event_id mais même transaction sur commande déjà associée par evt_t5_first)
    // -> possède son propre enregistrement d'idempotence et est refusé par la règle métier ORDER_INVALID_STATUS (409)
    const { res: resEvt2 } = await instance.sendSignedWebhook({
      event_id: "evt_t5_second",
      event_type: "transaction.completed",
      data: {
        id: "txn_t5_shared_tx",
        custom_data: { orderId: order.orderId }
      }
    });
    expect(resEvt2.statusCode).toBe(409);
    expect(resEvt2.jsonBody?.code).toBe("ORDER_INVALID_STATUS");
    expect(store.getIdempotencyDoc("evt_t5_second")?.status).toBe("failed");
    expect(store.getIdempotencyDoc("evt_t5_second")?.lastErrorCode).toBe("ORDER_INVALID_STATUS");
  });

  // =========================================================================
  // T6 — Lease expirée
  // =========================================================================
  it("T6 — Lease expirée : un événement 'processing' dont la lease est expirée est repris atomiquement par une nouvelle instance avec un nouveau leaseToken et attemptCount incrémenté", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance1 = store.createServerInstance();
    const instance2 = store.createServerInstance();

    const firstLease = await instance1.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t6_expired_lease",
      eventType: "transaction.completed",
      leaseDurationMs: 30_000
    });
    expect(firstLease.outcome).toBe("acquired");
    const token1 = firstLease.outcome === "acquired" ? firstLease.leaseToken : "";

    // Avant expiration (à +10s) -> instance2 reçoit in_progress
    store.advanceClockMs(10_000);
    const midCheck = await instance2.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t6_expired_lease",
      eventType: "transaction.completed"
    });
    expect(midCheck.outcome).toBe("in_progress");

    // Après expiration (à +35s) -> instance2 reprend atomiquement le lease
    store.advanceClockMs(25_000);
    const takeoverLease = await instance2.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t6_expired_lease",
      eventType: "transaction.completed"
    });

    expect(takeoverLease.outcome).toBe("acquired");
    if (takeoverLease.outcome === "acquired") {
      expect(takeoverLease.attemptCount).toBe(2);
      expect(takeoverLease.leaseToken).not.toBe(token1);
    }
  });

  // =========================================================================
  // T7 — Ancien propriétaire de lease (Zombie Worker Protection)
  // =========================================================================
  it("T7 — Ancien propriétaire : après reprise du lease expiré par une seconde instance, l'ancienne instance ne peut plus finaliser ni marquer en échec l'événement", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance1 = store.createServerInstance();
    const instance2 = store.createServerInstance();

    const acq1 = await instance1.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t7_zombie_worker",
      eventType: "transaction.completed",
      leaseDurationMs: 20_000
    });
    expect(acq1.outcome).toBe("acquired");
    const staleToken = acq1.outcome === "acquired" ? acq1.leaseToken : "";

    // La lease expire et instance2 reprend le verrou
    store.advanceClockMs(25_000);
    const acq2 = await instance2.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t7_zombie_worker",
      eventType: "transaction.completed",
      leaseDurationMs: 60_000
    });
    expect(acq2.outcome).toBe("acquired");
    const activeToken = acq2.outcome === "acquired" ? acq2.leaseToken : "";

    // L'instance 1 (avec staleToken) tente de finaliser -> refusé LEASE_CONFLICT
    const staleComplete = await instance1.idempotencyRepository.completeEventLease({
      provider: "paddle",
      eventId: "evt_t7_zombie_worker",
      leaseToken: staleToken
    });
    expect(staleComplete.ok).toBe(false);
    if (staleComplete.ok === false) {
      expect(staleComplete.code).toBe("LEASE_CONFLICT");
    }

    // L'instance 1 (avec staleToken) tente de marquer failed -> refusé LEASE_CONFLICT
    const staleFail = await instance1.idempotencyRepository.failEventLease({
      provider: "paddle",
      eventId: "evt_t7_zombie_worker",
      leaseToken: staleToken,
      errorCode: "STALE_WORKER_FAILURE"
    });
    expect(staleFail.ok).toBe(false);
    if (staleFail.ok === false) {
      expect(staleFail.code).toBe("LEASE_CONFLICT");
    }

    // Le document est toujours détenu par instance2 en processing
    expect(store.getIdempotencyDoc("evt_t7_zombie_worker")?.status).toBe("processing");
    expect(store.getIdempotencyDoc("evt_t7_zombie_worker")?.leaseToken).toBe(activeToken);

    // L'instance 2 (propriétaire légitime) finalise avec succès
    const validComplete = await instance2.idempotencyRepository.completeEventLease({
      provider: "paddle",
      eventId: "evt_t7_zombie_worker",
      leaseToken: activeToken
    });
    expect(validComplete.ok).toBe(true);
    expect(store.getIdempotencyDoc("evt_t7_zombie_worker")?.status).toBe("completed");
  });

  // =========================================================================
  // SEC-01-FIX-06-R2 — B1 : Fencing atomique au moment exact de l'écriture d'association
  // =========================================================================
  it("B1 — Scénario de reprise de lease (15 étapes) : Worker A dont la lease a expiré et été reprise par Worker B est rejeté atomiquement lors de la tentative d'association métier et ne modifie jamais payment_transactions", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const workerA = store.createServerInstance();
    const workerB = store.createServerInstance();
    workerA.registerUser("uid_b1_fenced_user", "b1@orthogonal.fr");
    workerB.registerUser("uid_b1_fenced_user", "b1@orthogonal.fr");

    const order = await workerA.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_b1_fenced_user",
      verifiedUserEmail: "b1@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    // Étape 1 : Créer un événement webhook
    const eventId = "evt_b1_fenced_takeover_001";
    const webhookPayload = {
      event_id: eventId,
      event_type: "transaction.completed",
      data: {
        id: "txn_b1_fenced_001",
        custom_data: { orderId: order.orderId }
      }
    };

    // Étapes 2 & 3 : Faire acquérir la lease par Worker A et conserver le token A
    const acqA = await workerA.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId,
      eventType: "transaction.completed",
      leaseDurationMs: 20_000
    });
    expect(acqA.outcome).toBe("acquired");
    const tokenA = acqA.outcome === "acquired" ? acqA.leaseToken : "";
    expect(tokenA).toMatch(/^lease_[0-9a-f]{32}$/);

    // Étape 4 : Simuler l'expiration de la lease avec une horloge contrôlée
    store.advanceClockMs(25_000);

    // Vérifier aussi qu'avant même la reprise par B, une lease expirée est rejetée à l'écriture (R2-04)
    const expiredAssocAttempt = await executeFencedOrderAssociationTransaction(
      workerA.adminDb,
      {
        provider: "paddle",
        eventId,
        leaseToken: tokenA,
        orderId: order.orderId,
        userUid: "uid_b1_fenced_user",
        providerTransactionId: "txn_b1_fenced_001",
        eventType: "transaction.completed",
        nowMs: () => store.getClockMs()
      }
    );
    expect(expiredAssocAttempt.ok).toBe(false);
    if (expiredAssocAttempt.ok === false) {
      expect(expiredAssocAttempt.statusCode).toBe(409);
      expect(expiredAssocAttempt.code).toBe("LEASE_CONFLICT");
    }
    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("unassociated");

    // Étapes 5 & 6 : Faire reprendre la lease par Worker B et conserver le token B
    const acqB = await workerB.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId,
      eventType: "transaction.completed",
      leaseDurationMs: 60_000
    });
    expect(acqB.outcome).toBe("acquired");
    const tokenB = acqB.outcome === "acquired" ? acqB.leaseToken : "";
    expect(tokenB).toMatch(/^lease_[0-9a-f]{32}$/);

    // Étape 7 : Vérifier que A et B possèdent des tokens distincts
    expect(tokenA).not.toBe(tokenB);

    const orderWritesBeforeStaleWorkerA = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;

    // Étape 8 : Faire tenter à A l'association métier avec son ancien token A
    const assocAttemptA = await validateAndAssociatePaddleOrder(webhookPayload, {
      repository: workerA.pendingOrderRepository,
      adminAuth: workerA.adminAuth,
      leaseToken: tokenA,
      nowMs: () => store.getClockMs()
    });

    // Étape 9 : Vérifier que l'opération d'association de A échoue atomiquement (LEASE_CONFLICT)
    expect(assocAttemptA.ok).toBe(false);
    if (assocAttemptA.ok === false) {
      expect(assocAttemptA.statusCode).toBe(409);
      expect(assocAttemptA.code).toBe("LEASE_CONFLICT");
    }

    // Étape 10 : Vérifier que payment_transactions n'a PAS été modifié par A
    const orderWritesAfterStaleWorkerA = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    expect(orderWritesAfterStaleWorkerA).toBe(orderWritesBeforeStaleWorkerA);
    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("unassociated");
    expect(store.getOrderDoc(order.orderId)?.providerTransactionId).toBeUndefined();
    expect(store.getOrderDoc(order.orderId)?.lastEventId).toBeUndefined();

    // Étape 11 : Faire tenter à B l'association métier avec son token valide B
    const assocAttemptB = await validateAndAssociatePaddleOrder(webhookPayload, {
      repository: workerB.pendingOrderRepository,
      adminAuth: workerB.adminAuth,
      leaseToken: tokenB,
      nowMs: () => store.getClockMs()
    });

    // Étape 12 : Vérifier que B réussit et que payment_transactions est mis à jour par B
    expect(assocAttemptB.ok).toBe(true);
    const persistedOrderAfterB = store.getOrderDoc(order.orderId);
    expect(persistedOrderAfterB?.status).toBe("pending");
    expect(persistedOrderAfterB?.associationStatus).toBe("associated");
    expect(persistedOrderAfterB?.providerTransactionId).toBe("txn_b1_fenced_001");
    expect(persistedOrderAfterB?.lastEventId).toBe(eventId);
    expect(persistedOrderAfterB?.userUid).toBe("uid_b1_fenced_user");

    // Étape 13 : Faire tenter à A de finaliser l'événement avec son ancien token A
    const completeAttemptA = await workerA.idempotencyRepository.completeEventLease({
      provider: "paddle",
      eventId,
      leaseToken: tokenA
    });

    // Étape 14 : Vérifier que A ne peut pas finaliser l'événement
    expect(completeAttemptA.ok).toBe(false);
    if (completeAttemptA.ok === false) {
      expect(completeAttemptA.code).toBe("LEASE_CONFLICT");
    }
    expect(store.getIdempotencyDoc(eventId)?.status).toBe("processing");
    expect(store.getIdempotencyDoc(eventId)?.leaseToken).toBe(tokenB);

    // Étape 15 : Worker B finalise l'événement ; vérifier qu'il n'y a qu'une seule association et que l'événement est completed
    const completeAttemptB = await workerB.idempotencyRepository.completeEventLease({
      provider: "paddle",
      eventId,
      leaseToken: tokenB
    });
    expect(completeAttemptB.ok).toBe(true);

    const finalEventDoc = store.getIdempotencyDoc(eventId);
    expect(finalEventDoc?.status).toBe("completed");
    expect(finalEventDoc?.attemptCount).toBe(2);
    expect(finalEventDoc?.leaseToken).toBeNull();
    expect(finalEventDoc?.completedAt).toBeInstanceOf(Timestamp);

    const associationWriteEntries = store.docWrites.filter(
      (w) =>
        w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION &&
        w.data.associationStatus === "associated"
    );
    expect(associationWriteEntries).toHaveLength(1);
    expect(associationWriteEntries[0].inTransaction).toBe(true);
  });

  it("B1 (Bout-en-bout Processeur) — Si Worker A est suspendu pendant son traitement métier jusqu'après expiration et reprise par Worker B, le processeur de A est bloqué par la transaction d'association (409 LEASE_CONFLICT)", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const workerA = store.createServerInstance();
    const workerB = store.createServerInstance();
    workerA.registerUser("uid_b1_e2e_user", "b1e2e@orthogonal.fr");
    workerB.registerUser("uid_b1_e2e_user", "b1e2e@orthogonal.fr");

    const order = await workerA.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_b1_e2e_user",
      verifiedUserEmail: "b1e2e@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_b1_e2e_pause_race",
      event_type: "transaction.completed",
      data: {
        id: "txn_b1_e2e_001",
        custom_data: { orderId: order.orderId }
      }
    };

    // Suspendre Worker A pendant l'appel adminAuth.getUser (après acquireEventLease, juste avant la transaction d'association)
    let releaseWorkerAAuth!: () => void;
    let notifyWorkerAPaused!: () => void;
    const workerAPausedPromise = new Promise<void>((resolve) => {
      notifyWorkerAPaused = resolve;
    });
    const workerAResumeGate = new Promise<void>((resolve) => {
      releaseWorkerAAuth = resolve;
    });

    workerA.adminAuth.getUser.mockImplementationOnce(async (uid: string) => {
      notifyWorkerAPaused();
      await workerAResumeGate;
      return { uid, email: "b1e2e@orthogonal.fr", disabled: false };
    });

    // Lancer le traitement de Worker A (il acquiert la lease A puis se met en pause dans getUser)
    const workerAProcessPromise = workerA.processor.processVerifiedPaddleEvent(payload);
    await workerAPausedPromise;

    // La lease de Worker A (60s) expire pendant qu'il est suspendu
    store.advanceClockMs(65_000);

    // Worker B reçoit l'événement, reprend la lease expirée, associe la commande et finalise l'événement
    const workerBResult = await workerB.processor.processVerifiedPaddleEvent(payload);
    expect(workerBResult.statusCode).toBe(200);
    expect(store.getIdempotencyDoc("evt_b1_e2e_pause_race")?.status).toBe("completed");
    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("associated");

    const orderWritesAfterB = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;

    // Débloquer Worker A : il atteint la transaction d'association et est rejeté atomiquement (409 LEASE_CONFLICT)
    releaseWorkerAAuth();
    const workerAResult = await workerA.processor.processVerifiedPaddleEvent(payload);
    // Note: workerAProcessPromise est l'appel en cours qui a été repris
    const pausedWorkerAResult = await workerAProcessPromise;
    expect(pausedWorkerAResult.statusCode).toBe(409);
    if (pausedWorkerAResult.statusCode !== 200) {
      expect(pausedWorkerAResult.body.code).toBe("LEASE_CONFLICT");
    }
    expect(workerAResult.statusCode).toBe(200);
    if (workerAResult.statusCode === 200) {
      expect(workerAResult.body.status).toBe("already_processed");
    }

    // Aucune écriture supplémentaire sur payment_transactions n'a été commise par Worker A
    const orderWritesAfterA = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    expect(orderWritesAfterA).toBe(orderWritesAfterB);
  });

  // =========================================================================
  // T8 — Échec métier et reprise contrôlée
  // =========================================================================
  it("T8 — Échec métier : le traitement échoue -> l'état devient 'failed' (lease invalidée) et une nouvelle tentative contrôlée est possible", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t8_delayed_user",
      verifiedUserEmail: "t8@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_t8_retryable",
      event_type: "transaction.completed",
      data: {
        id: "txn_t8_001",
        custom_data: { orderId: order.orderId }
      }
    };

    // 1ère tentative : l'utilisateur n'est pas encore présent dans Auth -> échoue avec 422 USER_IDENTITY_NOT_FOUND
    const { res: resFail } = await instance.sendSignedWebhook(payload);
    expect(resFail.statusCode).toBe(422);
    expect(resFail.jsonBody?.code).toBe("USER_IDENTITY_NOT_FOUND");

    const failedDoc = store.getIdempotencyDoc("evt_t8_retryable");
    expect(failedDoc?.status).toBe("failed");
    expect(failedDoc?.attemptCount).toBe(1);
    expect(failedDoc?.leaseToken).toBeNull();
    expect(failedDoc?.leaseExpiresAt).toBeNull();
    expect(failedDoc?.lastErrorCode).toBe("USER_IDENTITY_NOT_FOUND");

    // 2ème tentative après enregistrement de l'utilisateur -> reprise contrôlée (attemptCount = 2) et succès
    instance.registerUser("uid_t8_delayed_user", "t8@orthogonal.fr");
    const { res: resRetry } = await instance.sendSignedWebhook(payload);
    expect(resRetry.statusCode).toBe(200);
    expect(resRetry.jsonBody?.associated).toBe(true);

    const completedDoc = store.getIdempotencyDoc("evt_t8_retryable");
    expect(completedDoc?.status).toBe("completed");
    expect(completedDoc?.attemptCount).toBe(2);
    expect(completedDoc?.leaseToken).toBeNull();
    expect(completedDoc?.lastErrorCode).toBeNull();
  });

  // =========================================================================
  // T9 — Panne de persistance (Fail-Closed, zéro fallback mémoire)
  // =========================================================================
  it("T9 — Panne de persistance : erreur Firestore sur l'idempotence ou sur la commande -> HTTP 500, jamais 200, aucun fallback mémoire", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t9_user", "t9@orthogonal.fr");

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t9_user",
      verifiedUserEmail: "t9@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_t9_db_outage",
      event_type: "transaction.completed",
      data: {
        id: "txn_t9_001",
        custom_data: { orderId: order.orderId }
      }
    };

    // Cas A : Panne transactionnelle Firestore lors de l'acquisition du lease d'idempotence
    store.setFailIdempotencyTransactions(true);
    const { res: resOutage } = await instance.sendSignedWebhook(payload);
    expect(resOutage.statusCode).toBe(500);
    expect(resOutage.jsonBody?.code).toBe("INTERNAL_PERSISTENCE_ERROR");
    expect(resOutage.jsonBody?.received).not.toBe(true);
    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("unassociated");

    // Rétablissement de Firestore -> l'événement peut maintenant être traité normalement
    store.setFailIdempotencyTransactions(false);
    const { res: resRecovered } = await instance.sendSignedWebhook(payload);
    expect(resRecovered.statusCode).toBe(200);
    expect(resRecovered.jsonBody?.associated).toBe(true);
  });

  // =========================================================================
  // SEC-01-FIX-06-R2 — T9-A : Échec réel de lecture de payment_transactions
  // =========================================================================
  it("T9-A — Échec de lecture de payment_transactions pendant l'association transactionnelle -> HTTP 500, aucune association, événement marqué 'failed' (jamais 'completed'), aucune activation ni fallback mémoire, et reprise possible", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t9a_user", "t9a@orthogonal.fr");

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t9a_user",
      verifiedUserEmail: "t9a@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_t9a_read_failure",
      event_type: "transaction.completed",
      data: {
        id: "txn_t9a_001",
        custom_data: { orderId: order.orderId }
      }
    };

    const orderWritesBefore = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;

    // 1. Simuler une erreur réelle de lecture du document payment_transactions pendant la transaction d'association
    store.setFailTransactionalOrderReads(true);
    const { res: resTxReadFail } = await instance.sendSignedWebhook(payload);

    expect(resTxReadFail.statusCode).toBe(500);
    expect(resTxReadFail.jsonBody?.code).toBe("INTERNAL_PERSISTENCE_ERROR");
    expect(resTxReadFail.jsonBody?.received).not.toBe(true);

    // Vérifier qu'aucune association n'a été réalisée et qu'aucun événement n'est marqué 'completed'
    const orderAfterTxReadFail = store.getOrderDoc(order.orderId);
    expect(orderAfterTxReadFail?.status).toBe("pending");
    expect(orderAfterTxReadFail?.associationStatus).toBe("unassociated");
    expect(orderAfterTxReadFail?.providerTransactionId).toBeUndefined();

    const eventAfterTxReadFail = store.getIdempotencyDoc("evt_t9a_read_failure");
    expect(eventAfterTxReadFail?.status).toBe("failed");
    expect(eventAfterTxReadFail?.completedAt).toBeNull();
    expect(eventAfterTxReadFail?.leaseToken).toBeNull();
    expect(eventAfterTxReadFail?.lastErrorCode).toBe("INTERNAL_PERSISTENCE_ERROR");
    expect(instance.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();

    const orderWritesAfterTxReadFail = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    expect(orderWritesAfterTxReadFail).toBe(orderWritesBefore);

    // 2. Simuler également une panne de lecture directe de payment_transactions (setFailOrderReads)
    store.setFailTransactionalOrderReads(false);
    store.setFailOrderReads(true);
    const { res: resDirectReadFail } = await instance.sendSignedWebhook(payload);

    expect(resDirectReadFail.statusCode).toBe(500);
    expect(resDirectReadFail.jsonBody?.code).toBe("INTERNAL_PERSISTENCE_ERROR");
    expect(resDirectReadFail.jsonBody?.received).not.toBe(true);
    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("unassociated");
    expect(store.getIdempotencyDoc("evt_t9a_read_failure")?.status).toBe("failed");
    expect(store.getIdempotencyDoc("evt_t9a_read_failure")?.attemptCount).toBe(2);
    expect(instance.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();

    // 3. Rétablissement de la lecture de payment_transactions -> la nouvelle tentative réussit proprement
    store.setFailOrderReads(false);
    const { res: resRecovered } = await instance.sendSignedWebhook(payload);
    expect(resRecovered.statusCode).toBe(200);
    expect(resRecovered.jsonBody?.associated).toBe(true);

    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("associated");
    expect(store.getOrderDoc(order.orderId)?.providerTransactionId).toBe("txn_t9a_001");
    expect(store.getIdempotencyDoc("evt_t9a_read_failure")?.status).toBe("completed");
    expect(store.getIdempotencyDoc("evt_t9a_read_failure")?.attemptCount).toBe(3);
  });

  // =========================================================================
  // SEC-01-FIX-06-R2 — T9-B : Échec réel d'écriture de payment_transactions
  // =========================================================================
  it("T9-B — Échec d'écriture de payment_transactions pendant l'association transactionnelle -> HTTP 500, aucune association partielle, événement marqué 'failed' (jamais 'completed'), aucun fallback mémoire, et reprise contrôlée possible", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t9b_user", "t9b@orthogonal.fr");

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t9b_user",
      verifiedUserEmail: "t9b@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const payload = {
      event_id: "evt_t9b_write_failure",
      event_type: "transaction.completed",
      data: {
        id: "txn_t9b_001",
        custom_data: { orderId: order.orderId }
      }
    };

    const orderWritesBefore = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;

    // 1. Simuler une erreur réelle d'écriture sur payment_transactions lors de la transaction d'association
    store.setFailOrderWrites(true);
    const { res: resWriteFail } = await instance.sendSignedWebhook(payload);

    expect(resWriteFail.statusCode).toBe(500);
    expect(resWriteFail.jsonBody?.code).toBe("INTERNAL_PERSISTENCE_ERROR");
    expect(resWriteFail.jsonBody?.received).not.toBe(true);

    // Vérifier qu'aucune écriture partielle n'a été commise dans payment_transactions
    const orderWritesAfterFail = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    expect(orderWritesAfterFail).toBe(orderWritesBefore);

    const orderAfterWriteFail = store.getOrderDoc(order.orderId);
    expect(orderAfterWriteFail?.status).toBe("pending");
    expect(orderAfterWriteFail?.associationStatus).toBe("unassociated");
    expect(orderAfterWriteFail?.providerTransactionId).toBeUndefined();
    expect(orderAfterWriteFail?.lastEventId).toBeUndefined();

    // Vérifier que l'événement est en état 'failed' (jamais 'completed') et que le verrou est relâché
    const eventAfterWriteFail = store.getIdempotencyDoc("evt_t9b_write_failure");
    expect(eventAfterWriteFail?.status).toBe("failed");
    expect(eventAfterWriteFail?.attemptCount).toBe(1);
    expect(eventAfterWriteFail?.completedAt).toBeNull();
    expect(eventAfterWriteFail?.leaseToken).toBeNull();
    expect(eventAfterWriteFail?.leaseExpiresAt).toBeNull();
    expect(eventAfterWriteFail?.lastErrorCode).toBe("INTERNAL_PERSISTENCE_ERROR");
    expect(instance.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();

    // 2. Rétablissement de l'écriture sur payment_transactions -> reprise contrôlée réussie
    store.setFailOrderWrites(false);
    const { res: resRecovered } = await instance.sendSignedWebhook(payload);

    expect(resRecovered.statusCode).toBe(200);
    expect(resRecovered.jsonBody?.associated).toBe(true);

    const orderAfterRecovery = store.getOrderDoc(order.orderId);
    expect(orderAfterRecovery?.status).toBe("pending");
    expect(orderAfterRecovery?.associationStatus).toBe("associated");
    expect(orderAfterRecovery?.providerTransactionId).toBe("txn_t9b_001");
    expect(orderAfterRecovery?.lastEventId).toBe("evt_t9b_write_failure");

    const eventAfterRecovery = store.getIdempotencyDoc("evt_t9b_write_failure");
    expect(eventAfterRecovery?.status).toBe("completed");
    expect(eventAfterRecovery?.attemptCount).toBe(2);
    expect(eventAfterRecovery?.leaseToken).toBeNull();
  });

  // =========================================================================
  // T10 — Validation événement avant idempotence
  // =========================================================================
  it("T10 — Validation événement avant idempotence : event_type absent, vide, non chaîne ou non autorisé -> aucun document d'idempotence créé et aucune transaction Firestore exécutée", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t10_user", "t10@orthogonal.fr");

    const order = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t10_user",
      verifiedUserEmail: "t10@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    store.transactionCalls.length = 0;

    const invalidPayloads = [
      // event_type absent
      {
        event_id: "evt_t10_missing",
        data: { id: "txn_t10_1", custom_data: { orderId: order.orderId } }
      },
      // event_type vide
      {
        event_id: "evt_t10_empty",
        event_type: "   ",
        data: { id: "txn_t10_2", custom_data: { orderId: order.orderId } }
      },
      // event_type non chaîne
      {
        event_id: "evt_t10_number",
        event_type: 999 as any,
        data: { id: "txn_t10_3", custom_data: { orderId: order.orderId } }
      },
      // event_type non autorisé
      {
        event_id: "evt_t10_created",
        event_type: "transaction.created",
        data: { id: "txn_t10_4", custom_data: { orderId: order.orderId } }
      },
      // fallback alert_name sans event_type
      {
        event_id: "evt_t10_alert_fallback",
        alert_name: "transaction.completed",
        data: { id: "txn_t10_5", custom_data: { orderId: order.orderId } }
      }
    ];

    for (const p of invalidPayloads) {
      const { res } = await instance.sendSignedWebhook(p);
      expect([400, 422]).toContain(res.statusCode);
      expect(store.getIdempotencyDoc(p.event_id)).toBeUndefined();
    }

    expect(store.transactionCalls).toHaveLength(0);
  });

  // =========================================================================
  // T11 — Reprise après interruption entre association commande et finalisation événement
  // =========================================================================
  it("T11 — Reprise après association : si le serveur s'interrompt après l'écriture de l'association dans payment_transactions mais avant completeEventLease, la reprise du même événement reconnaît l'association exacte et finalise l'événement en 'completed'", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance1 = store.createServerInstance();
    const instance2 = store.createServerInstance();
    instance1.registerUser("uid_t11_user", "t11@orthogonal.fr");
    instance2.registerUser("uid_t11_user", "t11@orthogonal.fr");

    const order = await instance1.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t11_user",
      verifiedUserEmail: "t11@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    // Simuler l'état après qu'instance1 a acquis le lease et enregistré l'association sur la commande,
    // puis a crashé juste avant `completeEventLease`:
    const acq1 = await instance1.idempotencyRepository.acquireEventLease({
      provider: "paddle",
      eventId: "evt_t11_interrupted",
      eventType: "transaction.completed",
      leaseDurationMs: 20_000
    });
    expect(acq1.outcome).toBe("acquired");

    await instance1.pendingOrderRepository.recordOrderTransactionAssociation({
      orderId: order.orderId,
      userUid: "uid_t11_user",
      provider: "paddle",
      providerTransactionId: "txn_t11_exact",
      eventId: "evt_t11_interrupted",
      eventType: "transaction.completed",
      leaseToken: acq1.outcome === "acquired" ? acq1.leaseToken : ""
    });

    // Vérifier l'état interrompu : commande associée, mais événement toujours en "processing"
    expect(store.getOrderDoc(order.orderId)?.associationStatus).toBe("associated");
    expect(store.getOrderDoc(order.orderId)?.lastEventId).toBe("evt_t11_interrupted");
    expect(store.getIdempotencyDoc("evt_t11_interrupted")?.status).toBe("processing");

    const orderWritesBeforeRecovery = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;

    // La lease expire, Paddle renvoie le même événement à instance2
    store.advanceClockMs(25_000);

    const { res: recoveryRes } = await instance2.sendSignedWebhook({
      event_id: "evt_t11_interrupted",
      event_type: "transaction.completed",
      data: {
        id: "txn_t11_exact",
        custom_data: { orderId: order.orderId }
      }
    });

    expect(recoveryRes.statusCode).toBe(200);
    expect(recoveryRes.jsonBody).toEqual({
      received: true,
      associated: true,
      orderId: order.orderId,
      providerTransactionId: "txn_t11_exact",
      eventId: "evt_t11_interrupted",
      userUid: "uid_t11_user",
      status: "pending",
      associationStatus: "associated"
    });

    // L'événement est maintenant durablement finalisé en "completed" sans réécriture contradictoire
    expect(store.getIdempotencyDoc("evt_t11_interrupted")?.status).toBe("completed");
    expect(store.getIdempotencyDoc("evt_t11_interrupted")?.attemptCount).toBe(2);
    const orderWritesAfterRecovery = store.docWrites.filter(
      (w) => w.collection === AUTHORITATIVE_PENDING_ORDER_COLLECTION
    ).length;
    expect(orderWritesAfterRecovery).toBe(orderWritesBeforeRecovery);
  });

  // =========================================================================
  // T12 — Protection inter-commandes lors de la reprise
  // =========================================================================
  it("T12 — Protection inter-commandes : une commande déjà associée rejette tout événement ayant un autre eventId, un autre providerTransactionId, un autre orderId ou un autre UID", async () => {
    const store = createTransactionalFirestoreBackingStore();
    const instance = store.createServerInstance();
    instance.registerUser("uid_t12_owner", "owner12@orthogonal.fr");
    instance.registerUser("uid_t12_other", "other12@orthogonal.fr");

    const orderA = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t12_owner",
      verifiedUserEmail: "owner12@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    const orderB = await instance.pendingOrderRepository.createPendingOrder({
      verifiedUserUid: "uid_t12_owner",
      verifiedUserEmail: "owner12@orthogonal.fr",
      plan: "pro",
      billingCycle: "yearly",
      amount: 490,
      currency: "EUR",
      provider: "paddle",
      countryCode: "FR"
    });

    // Associer légitimement orderA avec evt_t12_original et txn_t12_original
    const { res: resInit } = await instance.sendSignedWebhook({
      event_id: "evt_t12_original",
      event_type: "transaction.completed",
      data: {
        id: "txn_t12_original",
        custom_data: { orderId: orderA.orderId }
      }
    });
    expect(resInit.statusCode).toBe(200);

    // 1. Même orderA et même txn_t12_original, mais AUTRE eventId -> rejeté 409 ORDER_INVALID_STATUS
    const { res: resDifferentEventId } = await instance.sendSignedWebhook({
      event_id: "evt_t12_different_event",
      event_type: "transaction.completed",
      data: {
        id: "txn_t12_original",
        custom_data: { orderId: orderA.orderId }
      }
    });
    expect(resDifferentEventId.statusCode).toBe(409);
    expect(resDifferentEventId.jsonBody?.code).toBe("ORDER_INVALID_STATUS");

    // 2. Même orderA, mais AUTRE providerTransactionId -> rejeté 409 PROVIDER_TRANSACTION_ID_MISMATCH
    const { res: resDifferentTxId } = await instance.sendSignedWebhook({
      event_id: "evt_t12_other_tx_event",
      event_type: "transaction.completed",
      data: {
        id: "txn_t12_forged_different",
        custom_data: { orderId: orderA.orderId }
      }
    });
    expect(resDifferentTxId.statusCode).toBe(409);
    expect(resDifferentTxId.jsonBody?.code).toBe("PROVIDER_TRANSACTION_ID_MISMATCH");

    // 3. Même txn_t12_original soumis sur une AUTRE commande (orderB) -> rejeté 409 TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER
    const { res: resOtherOrder } = await instance.sendSignedWebhook({
      event_id: "evt_t12_cross_order",
      event_type: "transaction.completed",
      data: {
        id: "txn_t12_original",
        custom_data: { orderId: orderB.orderId }
      }
    });
    expect(resOtherOrder.statusCode).toBe(409);
    expect(resOtherOrder.jsonBody?.code).toBe("TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER");

    // 4. Tentative avec un autre UID dans custom_data -> rejeté 403 ORDER_USER_MISMATCH
    const { res: resDifferentUid } = await instance.sendSignedWebhook({
      event_id: "evt_t12_wrong_uid",
      event_type: "transaction.completed",
      data: {
        id: "txn_t12_original",
        custom_data: {
          orderId: orderA.orderId,
          userUid: "uid_t12_other"
        }
      }
    });
    expect(resDifferentUid.statusCode).toBe(403);
    expect(resDifferentUid.jsonBody?.code).toBe("ORDER_USER_MISMATCH");
  });
});
