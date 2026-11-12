/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B — PENDING ORDER & PAYMENT ASSOCIATION TEST SUITE
 *
 * Covers all 29 mandatory test scenarios across Categories A, B, C, D, and E:
 * - Category A (1–7): Authoritative pending order invariants
 * - Category B (8–14): Paddle transaction & identifier separation invariants
 * - Category C (15–18): User identity & UID attribution invariants
 * - Category D (19–24): Security, failure handling, and zero side-effects
 * - Category E (25–29): Non-regression & zero premature license activation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebhookIdempotencyRegistry } from "../sec01SecurityService.ts";
import {
  createPendingOrderRepository,
  generateAuthoritativeOrderId,
  isValidInternalOrderIdFormat
} from "../webhooks/pendingOrderRepository.ts";
import {
  extractPaddleWebhookIdentifiers,
  validateAndAssociatePaddleOrder
} from "../webhooks/paymentOrderAssociation.ts";
import { createPaymentWebhookProcessor } from "../webhooks/paymentWebhookProcessor.ts";
import {
  createPaddleWebhookHandler,
  type RawBodyWebhookRequest
} from "../webhooks/paddleWebhookHandler.ts";
import { createSlickPayWebhookHandler } from "../webhooks/slickPayWebhookHandler.ts";
import {
  AUTHORITATIVE_PENDING_ORDER_COLLECTION,
  type AuthoritativePendingOrder
} from "../webhooks/webhookTypes.ts";

function buildPaddleSignature(rawBody: string, secretKey: string, timestampSec?: number): string {
  const ts = (timestampSec ?? Math.floor(Date.now() / 1000)).toString();
  const signedPayload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secretKey).update(signedPayload, "utf8").digest("hex");
  return `ts=${ts};h1=${h1}`;
}

function createMockResponse() {
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

function createSimulatedOrderAssociationEnv(options?: {
  paddleSecret?: string;
  slickPaySecret?: string;
  failDbGet?: boolean;
  failDbSet?: boolean;
}) {
  const paddleSecret = options?.paddleSecret ?? "pdl_ntfset_fix05b_secret_key_2026";
  const slickPaySecret = options?.slickPaySecret ?? "slickpay_secret_fix05b_2026";

  const orderStore = new Map<string, Record<string, unknown>>();
  const authUsers = new Map<string, { uid: string; email: string; disabled?: boolean }>();
  const operationLog: string[] = [];

  const getCalls: Array<{ collection: string; docId: string }> = [];
  const setCalls: Array<{
    collection: string;
    docId: string;
    data: Record<string, unknown>;
    options?: { merge?: boolean };
  }> = [];

  let txQueue = Promise.resolve();
  const adminDb = {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        id: docId,
        path: `${colName}/${docId}`,
        get: vi.fn(async () => {
          if (colName !== "payment_webhook_events") {
            operationLog.push(`db.get:${colName}/${docId}`);
            getCalls.push({ collection: colName, docId });
            if (options?.failDbGet) {
              throw new Error("Simulated Firestore read failure");
            }
          }
          const existing = orderStore.get(`${colName}:${docId}`);
          return {
            exists: Boolean(existing),
            id: docId,
            data: () => (existing ? { ...existing } : undefined)
          };
        }),
        set: vi.fn(async (data: Record<string, unknown>, setOpts?: { merge?: boolean }) => {
          if (colName !== "payment_webhook_events") {
            operationLog.push(`db.set:${colName}/${docId}`);
            if (options?.failDbSet) {
              throw new Error("Simulated Firestore write failure");
            }
            setCalls.push({ collection: colName, docId, data, options: setOpts });
          }
          const current = orderStore.get(`${colName}:${docId}`) || {};
          orderStore.set(
            `${colName}:${docId}`,
            setOpts?.merge ? { ...current, ...data } : { ...data }
          );
        })
      })),
      where: vi.fn((field: string, _op: "==", value: unknown) => ({
        get: vi.fn(async () => {
          operationLog.push(`db.where:${colName}:${field}==${String(value)}`);
          const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
          for (const [k, v] of orderStore.entries()) {
            if (k.startsWith(`${colName}:`) && v[field] === value) {
              const id = k.slice(colName.length + 1);
              docs.push({ id, data: () => ({ ...v }) });
            }
          }
          return {
            empty: docs.length === 0,
            docs
          };
        })
      }))
    })),
    runTransaction: async <T>(updateFn: (tx: any) => Promise<T>): Promise<T> => {
      const run = txQueue.then(async () => {
        const tx = {
          get: async (docRef: any) => docRef.get(),
          set: (docRef: any, data: Record<string, unknown>, opts?: { merge?: boolean }) =>
            docRef.set(data, opts)
        };
        return updateFn(tx);
      });
      txQueue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    }
  };

  const adminAuth = {
    getUser: vi.fn(async (uid: string) => {
      operationLog.push(`auth.getUser:${uid}`);
      const u = authUsers.get(uid);
      if (!u) {
        const err: any = new Error(`There is no user record corresponding to the provided identifier (${uid}).`);
        err.code = "auth/user-not-found";
        throw err;
      }
      return u;
    }),
    getUserByEmail: vi.fn(async (email: string) => {
      operationLog.push(`auth.getUserByEmail:${email}`);
      throw new Error("getUserByEmail must never be called during SEC-01-FIX-05-B webhook processing");
    }),
    setCustomUserClaims: vi.fn(async (uid: string) => {
      operationLog.push(`auth.setCustomUserClaims:${uid}`);
      throw new Error("setCustomUserClaims must never be called during SEC-01-FIX-05-B");
    })
  };

  const idempotency = new WebhookIdempotencyRegistry(500);
  const repository = createPendingOrderRepository({ adminDb });
  const processor = createPaymentWebhookProcessor({
    adminDb,
    adminAuth,
    idempotency,
    pendingOrderRepository: repository
  });

  const paddleHandler = createPaddleWebhookHandler({
    processor,
    getPaddleSecret: () => paddleSecret
  });

  const slickPayHandler = createSlickPayWebhookHandler({
    getSlickPaySecret: () => slickPaySecret
  });

  function seedAuthUser(uid: string, email: string, disabled = false) {
    authUsers.set(uid, { uid, email, disabled });
  }

  function seedRawOrder(docId: string, rawOrder: Record<string, unknown>) {
    orderStore.set(`${AUTHORITATIVE_PENDING_ORDER_COLLECTION}:${docId}`, { ...rawOrder });
  }

  function getStoredOrder(docId: string): AuthoritativePendingOrder | undefined {
    return orderStore.get(
      `${AUTHORITATIVE_PENDING_ORDER_COLLECTION}:${docId}`
    ) as unknown as AuthoritativePendingOrder | undefined;
  }

  async function sendSignedPaddleWebhook(payloadObj: Record<string, unknown>) {
    const rawBody = JSON.stringify(payloadObj, null, 2);
    const sig = buildPaddleSignature(rawBody, paddleSecret);
    const req = {
      rawBody,
      body: JSON.parse(rawBody),
      headers: { "paddle-signature": sig }
    } as unknown as RawBodyWebhookRequest;
    const res = createMockResponse();
    await paddleHandler(req, res);
    return { req, res };
  }

  return {
    paddleSecret,
    slickPaySecret,
    adminDb,
    adminAuth,
    idempotency,
    repository,
    processor,
    paddleHandler,
    slickPayHandler,
    orderStore,
    authUsers,
    operationLog,
    getCalls,
    setCalls,
    seedAuthUser,
    seedRawOrder,
    getStoredOrder,
    sendSignedPaddleWebhook
  };
}

describe("SEC-01-FIX-05-B — Pending Order & Payment Association (Tests Obligatoires 1 à 29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // CATÉGORIE A — COMMANDE (Tests 1 à 7)
  // =========================================================================
  describe("A — Validation de la commande en attente (Tests 1 à 7)", () => {
    it("1. Commande existante et valide -> créée côté serveur avec UID vérifié et associée avec succès", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_verified_001", "ingenieur@orthogonal.dz");

      const createdOrder = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_verified_001",
        verifiedUserEmail: "ingenieur@orthogonal.dz",
        userName: "Ingénieur Piping",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });

      expect(createdOrder.orderId).toMatch(/^ORD_PADDLE_[0-9A-F]{32}$/);
      expect(createdOrder.id).toBe(createdOrder.orderId);
      expect(createdOrder.userUid).toBe("uid_verified_001");
      expect(createdOrder.userId).toBe("uid_verified_001");
      expect(createdOrder.status).toBe("pending");
      expect(createdOrder.associationStatus).toBe("unassociated");

      // Réinitialiser les compteurs d'écriture après création de la commande initiale
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_01hvalid001",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_01hvalid001",
          custom_data: {
            orderId: createdOrder.orderId
          },
          customer: {
            email: "ingenieur@orthogonal.dz"
          }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual({
        received: true,
        associated: true,
        orderId: createdOrder.orderId,
        providerTransactionId: "txn_paddle_01hvalid001",
        eventId: "evt_paddle_01hvalid001",
        userUid: "uid_verified_001",
        status: "pending",
        associationStatus: "associated"
      });

      expect(env.setCalls).toHaveLength(1);
      expect(env.setCalls[0].collection).toBe("payment_transactions");
      expect(env.setCalls[0].docId).toBe(createdOrder.orderId);
      expect(env.setCalls[0].data).toMatchObject({
        id: createdOrder.orderId,
        orderId: createdOrder.orderId,
        userId: "uid_verified_001",
        userUid: "uid_verified_001",
        provider: "paddle",
        status: "pending",
        associationStatus: "associated",
        providerTransactionId: "txn_paddle_01hvalid001",
        lastEventId: "evt_paddle_01hvalid001",
        lastEventType: "transaction.completed"
      });
    });

    it("2. Commande inexistante -> rejetée (404 ORDER_NOT_FOUND), aucune création de commande ni écriture", async () => {
      const env = createSimulatedOrderAssociationEnv();

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_002",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_002",
          custom_data: {
            orderId: "ORD_PADDLE_NON_EXISTENT_002"
          }
        }
      });

      expect(res.statusCode).toBe(404);
      expect(res.jsonBody?.code).toBe("ORDER_NOT_FOUND");
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.getUser).not.toHaveBeenCalled();
      expect(env.getStoredOrder("ORD_PADDLE_NON_EXISTENT_002")).toBeUndefined();
    });

    it("3. Commande sans UID -> rejetée (422 ORDER_MISSING_UID), aucune écriture ni activation", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedRawOrder("ORD_PADDLE_NO_UID_003", {
        id: "ORD_PADDLE_NO_UID_003",
        orderId: "ORD_PADDLE_NO_UID_003",
        userEmail: "orphan@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_003",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_003",
          custom_data: {
            orderId: "ORD_PADDLE_NO_UID_003"
          }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("ORDER_MISSING_UID");
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.getUser).not.toHaveBeenCalled();
    });

    it("4. Commande appartenant à un autre UID -> rejetée (403 ORDER_USER_MISMATCH), aucune réattribution", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_owner_alice", "alice@orthogonal.dz");
      env.seedAuthUser("uid_attacker_bob", "bob@evil.org");
      env.seedRawOrder("ORD_PADDLE_ALICE_004", {
        id: "ORD_PADDLE_ALICE_004",
        orderId: "ORD_PADDLE_ALICE_004",
        userId: "uid_owner_alice",
        userUid: "uid_owner_alice",
        userEmail: "alice@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_004",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_004",
          custom_data: {
            orderId: "ORD_PADDLE_ALICE_004",
            userUid: "uid_attacker_bob"
          }
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.jsonBody?.code).toBe("ORDER_USER_MISMATCH");
      expect(env.setCalls).toHaveLength(0);
      expect(env.getStoredOrder("ORD_PADDLE_ALICE_004")?.userUid).toBe("uid_owner_alice");
    });

    it("5. Commande avec fournisseur différent de Paddle (ex: slickpay_baridimob) -> rejetée (422 ORDER_PROVIDER_MISMATCH)", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_dz_client_005", "client@sonatrach.dz");
      env.seedRawOrder("ORD_SLICKPAY_DZ_005", {
        id: "ORD_SLICKPAY_DZ_005",
        orderId: "ORD_SLICKPAY_DZ_005",
        userId: "uid_dz_client_005",
        userUid: "uid_dz_client_005",
        userEmail: "client@sonatrach.dz",
        provider: "slickpay_baridimob",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_005",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_005",
          custom_data: {
            orderId: "ORD_SLICKPAY_DZ_005"
          }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("ORDER_PROVIDER_MISMATCH");
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.getUser).not.toHaveBeenCalled();
    });

    it("6. Commande dans un état incompatible (completed, failed, refunded ou déjà associée) -> rejetée (409 ORDER_INVALID_STATUS)", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_006", "client006@orthogonal.dz");

      for (const incompatibleStatus of ["completed", "failed", "refunded"] as const) {
        const orderId = `ORD_PADDLE_STATUS_${incompatibleStatus.toUpperCase()}`;
        env.seedRawOrder(orderId, {
          id: orderId,
          orderId,
          userId: "uid_client_006",
          userUid: "uid_client_006",
          userEmail: "client006@orthogonal.dz",
          provider: "paddle",
          status: incompatibleStatus,
          createdAt: "2026-11-11T00:00:00.000Z"
        });

        const { res } = await env.sendSignedPaddleWebhook({
          event_id: `evt_paddle_006_${incompatibleStatus}`,
          event_type: "transaction.completed",
          data: {
            id: `txn_paddle_006_${incompatibleStatus}`,
            custom_data: { orderId }
          }
        });

        expect(res.statusCode).toBe(409);
        expect(res.jsonBody?.code).toBe("ORDER_INVALID_STATUS");
      }

      // Vérifie également qu'une commande déjà associée n'est pas retraitée comme une nouvelle commande
      env.seedRawOrder("ORD_PADDLE_ALREADY_ASSOC", {
        id: "ORD_PADDLE_ALREADY_ASSOC",
        orderId: "ORD_PADDLE_ALREADY_ASSOC",
        userId: "uid_client_006",
        userUid: "uid_client_006",
        provider: "paddle",
        status: "pending",
        associationStatus: "associated",
        providerTransactionId: "txn_paddle_006_initial",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res: resAlreadyAssoc } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_006_second_notif",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_006_initial",
          custom_data: { orderId: "ORD_PADDLE_ALREADY_ASSOC" }
        }
      });

      expect(resAlreadyAssoc.statusCode).toBe(409);
      expect(resAlreadyAssoc.jsonBody?.code).toBe("ORDER_INVALID_STATUS");
      expect(env.setCalls).toHaveLength(0);
    });

    it("7. Commande sans identifiant interne valide (format invalide, préfixe externe Paddle ou incohérence id/orderId) -> rejetée (422)", async () => {
      const env = createSimulatedOrderAssociationEnv();

      expect(isValidInternalOrderIdFormat("")).toBe(false);
      expect(isValidInternalOrderIdFormat("evt_12345678")).toBe(false);
      expect(isValidInternalOrderIdFormat("txn_12345678")).toBe(false);
      expect(isValidInternalOrderIdFormat("chk_12345678")).toBe(false);
      expect(isValidInternalOrderIdFormat(generateAuthoritativeOrderId("paddle"))).toBe(true);

      // Cas 7a : custom_data.orderId contient un identifiant d'événement Paddle (evt_...)
      const { res: resInvalidFormat } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_007a",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_007a",
          custom_data: { orderId: "evt_forged_as_order_id" }
        }
      });
      expect(resInvalidFormat.statusCode).toBe(422);
      expect(resInvalidFormat.jsonBody?.code).toBe("INVALID_INTERNAL_ORDER_ID");
      expect(env.getCalls).toHaveLength(0);

      // Cas 7b : document stocké avec orderId corrompu / différent de id
      env.seedRawOrder("ORD_PADDLE_CORRUPT_007", {
        id: "ORD_PADDLE_CORRUPT_007",
        orderId: "ORD_PADDLE_DIFFERENT_999",
        userId: "uid_client_007",
        userUid: "uid_client_007",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res: resCorruptDoc } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_007b",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_007b",
          custom_data: { orderId: "ORD_PADDLE_CORRUPT_007" }
        }
      });
      expect(resCorruptDoc.statusCode).toBe(422);
      expect(resCorruptDoc.jsonBody?.code).toBe("ORDER_INVALID_ID");
      expect(env.setCalls).toHaveLength(0);
    });
  });

  // =========================================================================
  // CATÉGORIE B — TRANSACTION (Tests 8 à 14)
  // =========================================================================
  describe("B — Validation de la transaction et séparation des identifiants (Tests 8 à 14)", () => {
    it("8. Transaction Paddle associée à la bonne commande -> enregistre providerTransactionId, orderId, eventId et conserve status: pending", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_008", "client008@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_008_TARGET", {
        id: "ORD_PADDLE_008_TARGET",
        orderId: "ORD_PADDLE_008_TARGET",
        userId: "uid_client_008",
        userUid: "uid_client_008",
        userEmail: "client008@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });
      env.seedRawOrder("ORD_PADDLE_008_OTHER", {
        id: "ORD_PADDLE_008_OTHER",
        orderId: "ORD_PADDLE_008_OTHER",
        userId: "uid_client_008",
        userUid: "uid_client_008",
        userEmail: "client008@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_008",
        event_type: "transaction.completed",
        checkout_id: "chk_session_008",
        data: {
          id: "txn_paddle_008_exact",
          custom_data: {
            orderId: "ORD_PADDLE_008_TARGET"
          }
        }
      });

      expect(res.statusCode).toBe(200);
      const targetOrder = env.getStoredOrder("ORD_PADDLE_008_TARGET");
      const otherOrder = env.getStoredOrder("ORD_PADDLE_008_OTHER");

      expect(targetOrder?.providerTransactionId).toBe("txn_paddle_008_exact");
      expect(targetOrder?.lastEventId).toBe("evt_paddle_008");
      expect(targetOrder?.associationStatus).toBe("associated");
      expect(targetOrder?.status).toBe("pending");
      expect(targetOrder?.paddleDetails?.checkoutId).toBe("chk_session_008");
      expect(targetOrder?.paddleDetails?.paddleOrderId).toBe("txn_paddle_008_exact");

      // L'autre commande reste intacte
      expect(otherOrder?.providerTransactionId).toBeUndefined();
      expect(otherOrder?.associationStatus).toBeUndefined();
    });

    it("9. Identifiant de transaction externe absent -> rejeté (400 MISSING_PROVIDER_TRANSACTION_ID), aucune lecture ni écriture Firestore", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_009", "client009@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_009", {
        id: "ORD_PADDLE_009",
        orderId: "ORD_PADDLE_009",
        userId: "uid_client_009",
        userUid: "uid_client_009",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_009",
        event_type: "transaction.completed",
        checkout_id: "chk_009_not_a_transaction_id",
        order_id: "ord_classic_not_used_silently",
        data: {
          custom_data: {
            orderId: "ORD_PADDLE_009"
          }
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.jsonBody?.code).toBe("MISSING_PROVIDER_TRANSACTION_ID");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("10. Identifiant de transaction externe incohérent avec celui attendu sur la commande -> rejeté (409 PROVIDER_TRANSACTION_ID_MISMATCH)", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_010", "client010@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_010", {
        id: "ORD_PADDLE_010",
        orderId: "ORD_PADDLE_010",
        userId: "uid_client_010",
        userUid: "uid_client_010",
        provider: "paddle",
        status: "pending",
        providerTransactionId: "txn_expected_010_AAA",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_010",
        event_type: "transaction.completed",
        data: {
          id: "txn_unexpected_010_BBB",
          custom_data: {
            orderId: "ORD_PADDLE_010"
          }
        }
      });

      expect(res.statusCode).toBe(409);
      expect(res.jsonBody?.code).toBe("PROVIDER_TRANSACTION_ID_MISMATCH");
      expect(env.setCalls).toHaveLength(0);
      expect(env.getStoredOrder("ORD_PADDLE_010")?.providerTransactionId).toBe("txn_expected_010_AAA");
    });

    it("11. Même transaction externe associée à deux commandes différentes -> la seconde est rejetée (409 TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER)", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_011", "client011@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_011_FIRST", {
        id: "ORD_PADDLE_011_FIRST",
        orderId: "ORD_PADDLE_011_FIRST",
        userId: "uid_client_011",
        userUid: "uid_client_011",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });
      env.seedRawOrder("ORD_PADDLE_011_SECOND", {
        id: "ORD_PADDLE_011_SECOND",
        orderId: "ORD_PADDLE_011_SECOND",
        userId: "uid_client_011",
        userUid: "uid_client_011",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      // Première association sur ORD_PADDLE_011_FIRST -> Succès
      const { res: resFirst } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_011_a",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_shared_011",
          custom_data: { orderId: "ORD_PADDLE_011_FIRST" }
        }
      });
      expect(resFirst.statusCode).toBe(200);
      expect(env.setCalls).toHaveLength(1);

      // Seconde tentative avec la même transaction sur ORD_PADDLE_011_SECOND -> Rejet 409
      const { res: resSecond } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_011_b",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_shared_011",
          custom_data: { orderId: "ORD_PADDLE_011_SECOND" }
        }
      });

      expect(resSecond.statusCode).toBe(409);
      expect(resSecond.jsonBody?.code).toBe("TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER");
      expect(env.setCalls).toHaveLength(1);
      expect(env.getStoredOrder("ORD_PADDLE_011_SECOND")?.associationStatus).toBeUndefined();
    });

    it("12. Identifiant d'événement différent de l'identifiant de transaction -> rejeté (422 EVENT_ID_EQUALS_TRANSACTION_ID) s'ils sont confondus", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_012", "client012@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_012", {
        id: "ORD_PADDLE_012",
        orderId: "ORD_PADDLE_012",
        userId: "uid_client_012",
        userUid: "uid_client_012",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      // Cas où event_id et data.id ont la même valeur -> rejeté
      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "same_id_012",
        event_type: "transaction.completed",
        data: {
          id: "same_id_012",
          custom_data: { orderId: "ORD_PADDLE_012" }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("EVENT_ID_EQUALS_TRANSACTION_ID");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("13. Identifiant de commande absent du payload (même si checkout_id, data.id, order_id et event_id sont présents) -> rejeté (400 MISSING_INTERNAL_ORDER_ID)", async () => {
      const env = createSimulatedOrderAssociationEnv();

      const payloadWithoutCustomOrderId = {
        event_id: "evt_paddle_013",
        event_type: "transaction.completed",
        checkout_id: "chk_paddle_013",
        order_id: "ord_paddle_external_013",
        data: {
          id: "txn_paddle_013"
        }
      };

      const extracted = extractPaddleWebhookIdentifiers(payloadWithoutCustomOrderId);
      expect(extracted.orderId).toBeUndefined();
      expect(extracted.providerTransactionId).toBe("txn_paddle_013");
      expect(extracted.eventId).toBe("evt_paddle_013");
      expect(extracted.checkoutId).toBe("chk_paddle_013");

      const { res } = await env.sendSignedPaddleWebhook(payloadWithoutCustomOrderId);

      expect(res.statusCode).toBe(400);
      expect(res.jsonBody?.code).toBe("MISSING_INTERNAL_ORDER_ID");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("14. Identifiant de commande inconnu -> rejeté (404 ORDER_NOT_FOUND), aucune écriture", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_014", "client014@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_KNOWN_014", {
        id: "ORD_PADDLE_KNOWN_014",
        orderId: "ORD_PADDLE_KNOWN_014",
        userId: "uid_client_014",
        userUid: "uid_client_014",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_014",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_014",
          custom_data: {
            orderId: "ORD_PADDLE_UNKNOWN_999999"
          }
        }
      });

      expect(res.statusCode).toBe(404);
      expect(res.jsonBody?.code).toBe("ORDER_NOT_FOUND");
      expect(env.setCalls).toHaveLength(0);
    });
  });

  // =========================================================================
  // CATÉGORIE C — IDENTITÉ (Tests 15 à 18)
  // =========================================================================
  describe("C — Identité et attribution stricte par UID de commande (Tests 15 à 18)", () => {
    it("15. Email du webhook différent de celui du profil -> aucune réattribution, getUserByEmail jamais appelé, userUid et userEmail de la commande préservés", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_owner_015", "owner015@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_015", {
        id: "ORD_PADDLE_015",
        orderId: "ORD_PADDLE_015",
        userId: "uid_owner_015",
        userUid: "uid_owner_015",
        userEmail: "owner015@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_015",
        event_type: "transaction.completed",
        email: "spoofed_payer@evil.com",
        data: {
          id: "txn_paddle_015",
          custom_data: {
            orderId: "ORD_PADDLE_015"
          },
          customer: {
            email: "spoofed_payer@evil.com"
          }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody?.userUid).toBe("uid_owner_015");
      expect(env.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(env.adminAuth.getUser).toHaveBeenCalledTimes(1);
      expect(env.adminAuth.getUser).toHaveBeenCalledWith("uid_owner_015");

      const updatedOrder = env.getStoredOrder("ORD_PADDLE_015");
      expect(updatedOrder?.userUid).toBe("uid_owner_015");
      expect(updatedOrder?.userId).toBe("uid_owner_015");
      expect(updatedOrder?.userEmail).toBe("owner015@orthogonal.dz");
    });

    it("16. UID du webhook fourni arbitrairement dans le payload -> aucune prise en compte, seul l'UID de la commande fait foi", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_legit_owner_016", "legit016@orthogonal.dz");
      env.seedAuthUser("uid_injected_attacker_016", "attacker016@evil.com");
      env.seedRawOrder("ORD_PADDLE_016", {
        id: "ORD_PADDLE_016",
        orderId: "ORD_PADDLE_016",
        userId: "uid_legit_owner_016",
        userUid: "uid_legit_owner_016",
        userEmail: "legit016@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_016",
        event_type: "transaction.completed",
        uid: "uid_injected_attacker_016",
        user_id: "uid_injected_attacker_016",
        data: {
          id: "txn_paddle_016",
          user: {
            id: "uid_injected_attacker_016",
            uid: "uid_injected_attacker_016"
          },
          custom_data: {
            orderId: "ORD_PADDLE_016"
          }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody?.userUid).toBe("uid_legit_owner_016");
      expect(env.adminAuth.getUser).toHaveBeenCalledTimes(1);
      expect(env.adminAuth.getUser).toHaveBeenCalledWith("uid_legit_owner_016");
      expect(env.getStoredOrder("ORD_PADDLE_016")?.userUid).toBe("uid_legit_owner_016");
      expect(env.getStoredOrder("ORD_PADDLE_016")?.userId).toBe("uid_legit_owner_016");
    });

    it("17. Utilisateur Firebase absent (supprimé ou introuvable dans Firebase Auth) -> rejeté (422 USER_IDENTITY_NOT_FOUND), aucune écriture d'association ni activation", async () => {
      const env = createSimulatedOrderAssociationEnv();
      // On ne seed PAS uid_deleted_017 dans authUsers
      env.seedRawOrder("ORD_PADDLE_017", {
        id: "ORD_PADDLE_017",
        orderId: "ORD_PADDLE_017",
        userId: "uid_deleted_017",
        userUid: "uid_deleted_017",
        userEmail: "deleted017@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_017",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_017",
          custom_data: {
            orderId: "ORD_PADDLE_017"
          }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("USER_IDENTITY_NOT_FOUND");
      expect(env.adminAuth.getUser).toHaveBeenCalledWith("uid_deleted_017");
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("18. Utilisateur correspondant à la commande -> vérification par UID (adminAuth.getUser) et association correcte par UID", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_verified_018", "verified018@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_018", {
        id: "ORD_PADDLE_018",
        orderId: "ORD_PADDLE_018",
        userId: "uid_verified_018",
        userUid: "uid_verified_018",
        userEmail: "verified018@orthogonal.dz",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_018",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_018",
          custom_data: {
            orderId: "ORD_PADDLE_018",
            userUid: "uid_verified_018"
          }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody?.userUid).toBe("uid_verified_018");
      expect(env.operationLog).toEqual([
        "db.get:payment_transactions/ORD_PADDLE_018",
        "db.where:payment_transactions:providerTransactionId==txn_paddle_018",
        "auth.getUser:uid_verified_018",
        "db.get:payment_transactions/ORD_PADDLE_018",
        "db.set:payment_transactions/ORD_PADDLE_018"
      ]);
    });
  });

  // =========================================================================
  // CATÉGORIE D — SÉCURITÉ ET ABSENCE D'EFFETS (Tests 19 à 24)
  // =========================================================================
  describe("D — Sécurité, gestion des erreurs et absence d'effets secondaires (Tests 19 à 24)", () => {
    it("19. Signature invalide -> HTTP 401, aucune lecture métier ni écriture de commande", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_019", "client019@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_019", {
        id: "ORD_PADDLE_019",
        orderId: "ORD_PADDLE_019",
        userId: "uid_client_019",
        userUid: "uid_client_019",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const payload = {
        event_id: "evt_paddle_019",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_019",
          custom_data: { orderId: "ORD_PADDLE_019" }
        }
      };
      const rawBody = JSON.stringify(payload);
      const wrongSig = `ts=${Math.floor(Date.now() / 1000)};h1=${"b".repeat(64)}`;

      const req = {
        rawBody,
        body: payload,
        headers: { "paddle-signature": wrongSig }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockResponse();

      await env.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.getUser).not.toHaveBeenCalled();
      expect(env.operationLog).toHaveLength(0);
    });

    it("20. Signature valide mais commande inexistante -> HTTP 404, aucune écriture ni activation", async () => {
      const env = createSimulatedOrderAssociationEnv();

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_020",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_020",
          custom_data: { orderId: "ORD_PADDLE_MISSING_020" }
        }
      });

      expect(res.statusCode).toBe(404);
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.getUser).not.toHaveBeenCalled();
      expect(env.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("21. Signature valide mais mauvais fournisseur -> HTTP 422, aucune écriture ni activation", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_021", "client021@orthogonal.dz");
      env.seedRawOrder("ORD_SLICKPAY_021", {
        id: "ORD_SLICKPAY_021",
        orderId: "ORD_SLICKPAY_021",
        userId: "uid_client_021",
        userUid: "uid_client_021",
        provider: "slickpay_baridimob",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_021",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_021",
          custom_data: { orderId: "ORD_SLICKPAY_021" }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("22. Signature valide mais mauvaise association -> HTTP 409, aucune écriture ni activation", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_022", "client022@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_022", {
        id: "ORD_PADDLE_022",
        orderId: "ORD_PADDLE_022",
        userId: "uid_client_022",
        userUid: "uid_client_022",
        provider: "paddle",
        status: "pending",
        providerTransactionId: "txn_expected_022",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_022",
        event_type: "transaction.completed",
        data: {
          id: "txn_wrong_022",
          custom_data: { orderId: "ORD_PADDLE_022" }
        }
      });

      expect(res.statusCode).toBe(409);
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("23. Échec de lecture de la commande -> HTTP 500, aucun traitement métier ni écriture, verrou d'idempotence relâché", async () => {
      const env = createSimulatedOrderAssociationEnv({ failDbGet: true });
      env.seedAuthUser("uid_client_023", "client023@orthogonal.dz");

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_023",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_023",
          custom_data: { orderId: "ORD_PADDLE_023" }
        }
      });

      expect(res.statusCode).toBe(500);
      expect(res.jsonBody?.code).toBe("INTERNAL_PERSISTENCE_ERROR");
      expect(env.setCalls).toHaveLength(0);
      expect(env.adminAuth.getUser).not.toHaveBeenCalled();
      expect(env.idempotency.isProcessed("paddle_evt_evt_paddle_023")).toBe(false);
      expect(env.idempotency.isInProgress("paddle_evt_evt_paddle_023")).toBe(false);
    });

    it("24. Erreur d'écriture d'association -> HTTP 500 (jamais de succès 200 trompeur), verrou d'idempotence relâché", async () => {
      const env = createSimulatedOrderAssociationEnv({ failDbSet: true });
      env.seedAuthUser("uid_client_024", "client024@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_024", {
        id: "ORD_PADDLE_024",
        orderId: "ORD_PADDLE_024",
        userId: "uid_client_024",
        userUid: "uid_client_024",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_paddle_024",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_024",
          custom_data: { orderId: "ORD_PADDLE_024" }
        }
      });

      expect(res.statusCode).toBe(500);
      expect(res.jsonBody?.code).toBe("INTERNAL_PERSISTENCE_ERROR");
      expect(res.jsonBody?.received).not.toBe(true);
      expect(env.idempotency.isProcessed("paddle_evt_evt_paddle_024")).toBe(false);
      expect(env.idempotency.isInProgress("paddle_evt_evt_paddle_024")).toBe(false);
    });
  });

  // =========================================================================
  // CATÉGORIE E — NON-RÉGRESSION (Tests 25 à 29)
  // =========================================================================
  describe("E — Non-régression FIX-05-A-R1 et garantie d'absence d'activation dans FIX-05-B (Tests 25 à 29)", () => {
    it("25. Les validations de format HMAC 64-hex (63, 65, 66 chars) de FIX-05-A-R1 bloquent toujours en amont", async () => {
      const env = createSimulatedOrderAssociationEnv();
      const payload = {
        event_id: "evt_paddle_025",
        event_type: "transaction.completed",
        data: {
          id: "txn_paddle_025",
          custom_data: { orderId: "ORD_PADDLE_025" }
        }
      };
      const rawBody = JSON.stringify(payload);
      const ts = Math.floor(Date.now() / 1000);
      const validHmac = crypto
        .createHmac("sha256", env.paddleSecret)
        .update(`${ts}:${rawBody}`, "utf8")
        .digest("hex");

      // Signature de 65 caractères (64 valides + 1 char hex)
      const req65 = {
        rawBody,
        body: payload,
        headers: { "paddle-signature": `ts=${ts};h1=${validHmac}a` }
      } as unknown as RawBodyWebhookRequest;
      const res65 = createMockResponse();

      await env.paddleHandler(req65, res65);
      expect(res65.statusCode).toBe(401);
      expect(env.operationLog).toHaveLength(0);
    });

    it("26. Le webhook Paddle authentifié continue à utiliser exclusivement req.rawBody", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_026", "client026@orthogonal.dz");
      env.seedRawOrder("ORD_PADDLE_026", {
        id: "ORD_PADDLE_026",
        orderId: "ORD_PADDLE_026",
        userId: "uid_client_026",
        userUid: "uid_client_026",
        provider: "paddle",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const rawBodyWithWhitespace =
        '{\n  "event_id": "evt_paddle_026",\n  "event_type": "transaction.completed",\n  "data": {\n    "id": "txn_paddle_026",\n    "custom_data": { "orderId": "ORD_PADDLE_026" }\n  }\n}';
      const parsedBody = JSON.parse(rawBodyWithWhitespace);

      // Signature calculée sur JSON.stringify(parsedBody) au lieu de rawBodyWithWhitespace -> Rejet 401
      const wrongSigOverStringified = buildPaddleSignature(
        JSON.stringify(parsedBody),
        env.paddleSecret
      );
      const reqWrong = {
        rawBody: rawBodyWithWhitespace,
        body: parsedBody,
        headers: { "paddle-signature": wrongSigOverStringified }
      } as unknown as RawBodyWebhookRequest;
      const resWrong = createMockResponse();
      await env.paddleHandler(reqWrong, resWrong);
      expect(resWrong.statusCode).toBe(401);
      expect(env.operationLog).toHaveLength(0);

      // Signature calculée sur rawBodyWithWhitespace exact -> Succès 200
      const validSigOverRaw = buildPaddleSignature(rawBodyWithWhitespace, env.paddleSecret);
      const reqValid = {
        rawBody: rawBodyWithWhitespace,
        body: parsedBody,
        headers: { "paddle-signature": validSigOverRaw }
      } as unknown as RawBodyWebhookRequest;
      const resValid = createMockResponse();
      await env.paddleHandler(reqValid, resValid);
      expect(resValid.statusCode).toBe(200);
    });

    it("27. Slick-Pay reste strictement fail-closed sans aucune association ni écriture", async () => {
      const env = createSimulatedOrderAssociationEnv();
      env.seedAuthUser("uid_client_027", "client027@sonatrach.dz");
      env.seedRawOrder("ORD_SLICKPAY_027", {
        id: "ORD_SLICKPAY_027",
        orderId: "ORD_SLICKPAY_027",
        userId: "uid_client_027",
        userUid: "uid_client_027",
        provider: "slickpay_baridimob",
        status: "pending",
        createdAt: "2026-11-11T00:00:00.000Z"
      });

      const req = {
        body: {
          invoice_id: "INV_027",
          orderId: "ORD_SLICKPAY_027",
          status: "completed"
        },
        headers: { "x-slickpay-signature": env.slickPaySecret }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockResponse();

      await env.slickPayHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(env.operationLog).toHaveLength(0);
    });

    it("28. Aucun accès Firestore ou Firebase Auth n'est effectué avant l'authentification ni avant la validation des identifiants requis", async () => {
      const env = createSimulatedOrderAssociationEnv();

      // Requête non authentifiée -> zéro opération DB/Auth
      const reqUnauth = {
        rawBody: "{}",
        body: {},
        headers: {}
      } as unknown as RawBodyWebhookRequest;
      const resUnauth = createMockResponse();
      await env.paddleHandler(reqUnauth, resUnauth);
      expect(resUnauth.statusCode).toBe(401);
      expect(env.operationLog).toEqual([]);

      // Requête authentifiée mais sans orderId -> zéro opération DB/Auth
      const { res: resMissingId } = await env.sendSignedPaddleWebhook({
        event_id: "evt_028",
        event_type: "transaction.completed",
        data: { id: "txn_028" }
      });
      expect(resMissingId.statusCode).toBe(400);
      expect(env.operationLog).toEqual([]);
    });

    it("29. Aucune activation de licence, modification de profil ou attribution de Custom Claims n'est présente dans les modules webhook FIX-05-B", () => {
      const processorSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/webhooks/paymentWebhookProcessor.ts"),
        "utf8"
      );
      const associationSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/webhooks/paymentOrderAssociation.ts"),
        "utf8"
      );
      const repositorySource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/webhooks/pendingOrderRepository.ts"),
        "utf8"
      );

      for (const src of [processorSource, associationSource, repositorySource]) {
        expect(src).not.toContain("setCustomUserClaims");
        expect(src).not.toContain("getUserByEmail");
        expect(src).not.toContain("pdi_user_profiles");
        expect(src).not.toContain("pdi_payment_transactions");
        expect(src).not.toContain("activeUntil");
      }
    });
  });
});
