/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B-R1 — PENDING ORDER & PAYMENT ASSOCIATION CORRECTIVE TEST SUITE (B1 / B2 / B3)
 *
 * Covers all mandatory corrective test scenarios:
 * - B1 (Tests 1–10): Client-to-server order creation & checkout association flow
 * - B2 (Tests 1–12): Strict Paddle event policy (ONLY transaction.completed)
 * - B3 (Tests 1–15): Real HTTP tests on POST /api/payments/orders & middlewares
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebhookIdempotencyRegistry } from "../sec01SecurityService.ts";
import {
  createPendingOrderRepository,
  isValidInternalOrderIdFormat
} from "../webhooks/pendingOrderRepository.ts";
import { evaluatePaddleEventPolicy, ALLOWED_PADDLE_ASSOCIATION_EVENTS } from "../webhooks/paddleEventPolicy.ts";
import { createPaymentWebhookProcessor } from "../webhooks/paymentWebhookProcessor.ts";
import {
  createPaddleWebhookHandler,
  type RawBodyWebhookRequest
} from "../webhooks/paddleWebhookHandler.ts";
import {
  AUTHORITATIVE_PENDING_ORDER_COLLECTION,
  type AuthoritativePendingOrder
} from "../webhooks/webhookTypes.ts";
import { createPendingOrderRoute } from "../payments/pendingOrderRoute.ts";
import {
  createAuthoritativePendingOrder,
  initiateAuthoritativeOrderCheckout,
  buildPaddleCheckoutPayload
} from "../payments/pendingOrderClient.ts";
import { savePaymentTransactionToFirebase } from "../../lib/firebase.ts";
import { generateTransactionId } from "../../pdi/payment/pdiPaymentGateway.ts";

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

function createSimulatedBackendEnv(options?: {
  paddleSecret?: string;
  failDbGet?: boolean;
  failDbSet?: boolean;
}) {
  const paddleSecret = options?.paddleSecret ?? "pdl_ntfset_fix05b_r1_secret_2026";
  const orderStore = new Map<string, Record<string, unknown>>();
  const authUsers = new Map<
    string,
    {
      uid: string;
      email: string;
      email_verified?: boolean;
      name?: string;
      disabled?: boolean;
    }
  >();
  const validTokens = new Map<
    string,
    {
      uid?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      role?: string;
    }
  >();

  const operationLog: string[] = [];
  const getCalls: Array<{ collection: string; docId: string }> = [];
  const setCalls: Array<{
    collection: string;
    docId: string;
    data: Record<string, unknown>;
    options?: { merge?: boolean };
  }> = [];

  let failNextSet = Boolean(options?.failDbSet);

  const adminDb = {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn(async () => {
          operationLog.push(`db.get:${colName}/${docId}`);
          getCalls.push({ collection: colName, docId });
          if (options?.failDbGet) {
            throw new Error("Simulated Firestore read failure");
          }
          const existing = orderStore.get(`${colName}:${docId}`);
          return {
            exists: Boolean(existing),
            id: docId,
            data: () => (existing ? { ...existing } : undefined)
          };
        }),
        set: vi.fn(async (data: Record<string, unknown>, setOpts?: { merge?: boolean }) => {
          operationLog.push(`db.set:${colName}/${docId}`);
          if (failNextSet) {
            throw new Error("Simulated Firestore write failure");
          }
          const current = orderStore.get(`${colName}:${docId}`) || {};
          orderStore.set(
            `${colName}:${docId}`,
            setOpts?.merge ? { ...current, ...data } : { ...data }
          );
          setCalls.push({ collection: colName, docId, data, options: setOpts });
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
    }))
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
      throw new Error("getUserByEmail must never be called");
    }),
    setCustomUserClaims: vi.fn(async (uid: string) => {
      operationLog.push(`auth.setCustomUserClaims:${uid}`);
      throw new Error("setCustomUserClaims must never be called during SEC-01-FIX-05-B-R1");
    })
  };

  const verifyIdToken = vi.fn(async (token: string) => {
    operationLog.push(`auth.verifyIdToken:${token}`);
    const decoded = validTokens.get(token);
    if (!decoded) {
      throw new Error("Firebase ID token has invalid signature or is expired.");
    }
    return decoded;
  });

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

  function registerAuthenticatedUser(params: {
    token: string;
    uid?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    disabled?: boolean;
  }) {
    validTokens.set(params.token, {
      uid: params.uid,
      email: params.email,
      email_verified: params.email_verified ?? true,
      name: params.name
    });
    if (params.uid && params.email) {
      authUsers.set(params.uid, {
        uid: params.uid,
        email: params.email,
        email_verified: params.email_verified ?? true,
        name: params.name,
        disabled: params.disabled ?? false
      });
    }
  }

  function getStoredOrder(docId: string): AuthoritativePendingOrder | undefined {
    return orderStore.get(
      `${AUTHORITATIVE_PENDING_ORDER_COLLECTION}:${docId}`
    ) as unknown as AuthoritativePendingOrder | undefined;
  }

  function setFailDbWrite(shouldFail: boolean) {
    failNextSet = shouldFail;
  }

  async function sendSignedPaddleWebhook(payloadObj: Record<string, unknown>, customSigHeader?: string) {
    const rawBody = JSON.stringify(payloadObj);
    const sig = customSigHeader ?? buildPaddleSignature(rawBody, paddleSecret);
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
    adminDb,
    adminAuth,
    verifyIdToken,
    idempotency,
    repository,
    processor,
    paddleHandler,
    orderStore,
    authUsers,
    validTokens,
    operationLog,
    getCalls,
    setCalls,
    registerAuthenticatedUser,
    getStoredOrder,
    setFailDbWrite,
    sendSignedPaddleWebhook
  };
}

async function startTestExpressOrderServer(env: ReturnType<typeof createSimulatedBackendEnv>) {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/payments/orders",
    ...createPendingOrderRoute({
      pendingOrderRepository: env.repository,
      verifyIdToken: env.verifyIdToken
    })
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind ephemeral HTTP server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  };
}

describe("SEC-01-FIX-05-B-R1 — Correctifs B1 / B2 / B3", () => {
  let activeServer: { baseUrl: string; close: () => Promise<void> } | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (activeServer) {
      await activeServer.close();
      activeServer = null;
    }
  });

  // =========================================================================
  // B1 — RACCORDEMENT DU PARCOURS DE PAIEMENT À LA CRÉATION SERVEUR (Tests 1 à 10)
  // =========================================================================
  describe("B1 — Raccordement du parcours de paiement à la création serveur (Tests 1 à 10)", () => {
    it("B1.1 Le flux client appelle POST /api/payments/orders avec le Bearer token", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_valid_b1_1",
        uid: "uid_b1_client_01",
        email: "engineer@orthogonal.fr",
        email_verified: true,
        name: "Marc Ingénieur"
      });
      activeServer = await startTestExpressOrderServer(env);

      const fetchSpy = vi.fn(globalThis.fetch);

      const result = await initiateAuthoritativeOrderCheckout(
        {
          plan: "pro",
          accountType: "pro",
          billingCycle: "yearly",
          countryCode: "FR",
          country: "France",
          city: "Paris"
        },
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_valid_b1_1",
          fetchImpl: fetchSpy as unknown as typeof fetch
        }
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${activeServer.baseUrl}/api/payments/orders`);
      expect(calledInit?.method).toBe("POST");
      expect((calledInit?.headers as Record<string, string>)?.Authorization).toBe("Bearer token_valid_b1_1");
      expect(result.order.orderId).toMatch(/^ORD_PADDLE_[0-9A-F]{32}$/);
    });

    it("B1.2 Le client n'écrit jamais directement dans payment_transactions (savePaymentTransactionToFirebase refuse toute écriture et PdiSuperAdminConsole utilise initiateAuthoritativeOrderCheckout)", async () => {
      await expect(
        savePaymentTransactionToFirebase({
          id: "TX_PADDLE_DIRECT_ATTEMPT",
          userEmail: "test@orthogonal.fr",
          userName: "Test",
          country: "France",
          countryCode: "FR",
          plan: "pro",
          billingCycle: "yearly",
          amount: 490,
          currency: "EUR",
          provider: "paddle",
          status: "pending",
          createdAt: new Date().toISOString()
        })
      ).rejects.toThrow(/Client-side creation or mutation in payment_transactions is forbidden/i);

      const consoleSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/pdi/superadmin/PdiSuperAdminConsole.tsx"),
        "utf8"
      );
      expect(consoleSource).toContain("initiateAuthoritativeOrderCheckout");
      expect(consoleSource).not.toContain("savePaymentTransactionToFirebase(");
    });

    it("B1.3 L'UID fourni par le client est ignoré", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b1_3",
        uid: "uid_verified_real_user",
        email: "real@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const order = await createAuthoritativePendingOrder(
        {
          plan: "team",
          billingCycle: "yearly",
          countryCode: "FR",
          uid: "uid_spoofed_by_client",
          userUid: "uid_spoofed_by_client",
          userId: "uid_spoofed_by_client"
        } as any,
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_b1_3"
        }
      );

      expect(order.userUid).toBe("uid_verified_real_user");
      expect(order.userId).toBe("uid_verified_real_user");
      expect(order.userUid).not.toBe("uid_spoofed_by_client");
    });

    it("B1.4 Le serveur utilise l'UID du token Firebase vérifié", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b1_4_verified",
        uid: "uid_from_firebase_id_token_99",
        email: "verified99@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const result = await initiateAuthoritativeOrderCheckout(
        {
          plan: "basic",
          billingCycle: "monthly",
          countryCode: "FR"
        },
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_b1_4_verified"
        }
      );

      expect(result.order.userUid).toBe("uid_from_firebase_id_token_99");
      expect(result.order.userEmail).toBe("verified99@orthogonal.fr");
      const stored = env.getStoredOrder(result.order.orderId);
      expect(stored?.userUid).toBe("uid_from_firebase_id_token_99");
    });

    it("B1.5 Le fournisseur est cohérent entre commande serveur et checkout", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b1_5",
        uid: "uid_b1_5",
        email: "client5@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const paddleCheckout = await initiateAuthoritativeOrderCheckout(
        {
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "FR",
          provider: "paddle"
        },
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_b1_5"
        }
      );
      expect(paddleCheckout.order.provider).toBe("paddle");
      expect(paddleCheckout.paddleCheckout).toBeDefined();
      expect(paddleCheckout.paddleCheckout?.provider).toBe("paddle");

      const slickPayCheckout = await initiateAuthoritativeOrderCheckout(
        {
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "DZ",
          provider: "slickpay_baridimob"
        },
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_b1_5"
        }
      );
      expect(slickPayCheckout.order.provider).toBe("slickpay_baridimob");
      expect(slickPayCheckout.paddleCheckout).toBeNull();
      expect(slickPayCheckout.slickPayDescriptor?.provider).toBe("slickpay_baridimob");
    });

    it("B1.6 orderId serveur est transmis à Paddle dans custom_data.orderId", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b1_6",
        uid: "uid_b1_6",
        email: "client6@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const launchedPayloads: any[] = [];
      const checkoutResult = await initiateAuthoritativeOrderCheckout(
        {
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "FR"
        },
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_b1_6",
          onLaunchPaddleCheckout: async (payload) => {
            launchedPayloads.push(payload);
          }
        }
      );

      expect(launchedPayloads).toHaveLength(1);
      expect(launchedPayloads[0].custom_data.orderId).toBe(checkoutResult.order.orderId);
      expect(launchedPayloads[0].customData.orderId).toBe(checkoutResult.order.orderId);
    });

    it("B1.7 Le webhook Paddle retrouve et associe la commande grâce à ce custom_data.orderId", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b1_7",
        uid: "uid_b1_7_e2e",
        email: "e2e@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      // 1. Client -> API authentifiée -> Commande serveur -> Checkout fournisseur
      const checkoutInitiation = await initiateAuthoritativeOrderCheckout(
        {
          plan: "enterprise",
          billingCycle: "yearly",
          countryCode: "FR"
        },
        {
          apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
          getIdToken: async () => "token_b1_7"
        }
      );

      const customDataOrderId = checkoutInitiation.paddleCheckout!.custom_data.orderId;
      expect(customDataOrderId).toBe(checkoutInitiation.order.orderId);

      // 2. Webhook Paddle authentifié utilisant custom_data.orderId
      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b1_7_completed",
        event_type: "transaction.completed",
        data: {
          id: "txn_b1_7_provider_id",
          custom_data: {
            orderId: customDataOrderId
          }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toMatchObject({
        received: true,
        associated: true,
        orderId: customDataOrderId,
        providerTransactionId: "txn_b1_7_provider_id",
        userUid: "uid_b1_7_e2e",
        status: "pending",
        associationStatus: "associated"
      });
    });

    it("B1.8 Une commande non créée par le serveur ne peut pas être associée", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b1_8",
        uid: "uid_b1_8",
        email: "b1_8@orthogonal.fr",
        email_verified: true
      });

      // Cas A : ID généré côté client avec generateTransactionId ("TX_PADDLE_...")
      const clientTxId = generateTransactionId("paddle");
      expect(isValidInternalOrderIdFormat(clientTxId)).toBe(false);
      expect(() =>
        buildPaddleCheckoutPayload({
          id: clientTxId,
          orderId: clientTxId,
          userId: "uid_b1_8",
          userUid: "uid_b1_8",
          userEmail: "b1_8@orthogonal.fr",
          userName: "Client",
          country: "France",
          countryCode: "FR",
          plan: "pro",
          accountType: "pro",
          billingCycle: "yearly",
          amount: 490,
          currency: "EUR",
          provider: "paddle",
          status: "pending",
          associationStatus: "unassociated",
          createdAt: new Date().toISOString()
        })
      ).toThrow(/without a valid server-generated orderId/i);

      const { res: resClientTx } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b1_8_client_tx",
        event_type: "transaction.completed",
        data: {
          id: "txn_b1_8_a",
          custom_data: {
            orderId: clientTxId
          }
        }
      });
      expect(resClientTx.statusCode).toBe(422);
      expect(resClientTx.jsonBody?.code).toBe("INVALID_INTERNAL_ORDER_ID");

      // Cas B : Format ORD_PADDLE_... mais jamais créé sur le serveur
      const uncreatedOrderId = "ORD_PADDLE_99999999999999999999999999999999";
      const { res: resNotCreated } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b1_8_uncreated",
        event_type: "transaction.completed",
        data: {
          id: "txn_b1_8_b",
          custom_data: {
            orderId: uncreatedOrderId
          }
        }
      });
      expect(resNotCreated.statusCode).toBe(404);
      expect(resNotCreated.jsonBody?.code).toBe("ORDER_NOT_FOUND");
    });

    it("B1.9 Une erreur serveur de création de commande empêche le démarrage du checkout", async () => {
      const env = createSimulatedBackendEnv();
      activeServer = await startTestExpressOrderServer(env);

      const onLaunchPaddleCheckout = vi.fn();

      await expect(
        initiateAuthoritativeOrderCheckout(
          {
            plan: "pro",
            billingCycle: "yearly",
            countryCode: "FR"
          },
          {
            apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
            getIdToken: async () => "invalid_token_b1_9",
            onLaunchPaddleCheckout
          }
        )
      ).rejects.toThrow();

      expect(onLaunchPaddleCheckout).not.toHaveBeenCalled();
    });

    it("B1.10 Une erreur de persistance ne produit jamais de faux succès", async () => {
      const env = createSimulatedBackendEnv({ failDbSet: true });
      env.registerAuthenticatedUser({
        token: "token_b1_10",
        uid: "uid_b1_10",
        email: "b1_10@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const onLaunchPaddleCheckout = vi.fn();

      await expect(
        initiateAuthoritativeOrderCheckout(
          {
            plan: "pro",
            billingCycle: "yearly",
            countryCode: "FR"
          },
          {
            apiEndpoint: `${activeServer.baseUrl}/api/payments/orders`,
            getIdToken: async () => "token_b1_10",
            onLaunchPaddleCheckout
          }
        )
      ).rejects.toThrow(/Failed to create authoritative pending order/i);

      expect(onLaunchPaddleCheckout).not.toHaveBeenCalled();
      expect(env.orderStore.size).toBe(0);
    });
  });

  // =========================================================================
  // B2 — VALIDATION STRICTE DES TYPES D'ÉVÉNEMENTS PADDLE (Tests 1 à 12)
  // =========================================================================
  describe("B2 — Validation stricte des types d'événements Paddle (Tests 1 à 12)", () => {
    it("B2.1 transaction.completed autorisé et associe la commande", async () => {
      expect(ALLOWED_PADDLE_ASSOCIATION_EVENTS.has("transaction.completed")).toBe(true);
      expect(ALLOWED_PADDLE_ASSOCIATION_EVENTS.size).toBe(1);
      expect(evaluatePaddleEventPolicy("transaction.completed")).toEqual({
        allowed: true,
        eventType: "transaction.completed"
      });

      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_1",
        uid: "uid_b2_1",
        email: "b2_1@orthogonal.fr",
        email_verified: true
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_1",
        verifiedUserEmail: "b2_1@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_1_completed",
        event_type: "transaction.completed",
        data: {
          id: "txn_b2_1",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody?.associated).toBe(true);
      expect(env.setCalls).toHaveLength(1);
    });

    it("B2.2 transaction.created refusé (422 UNSUPPORTED_OR_EARLY_EVENT_TYPE) sans lecture ni écriture Firestore", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_2",
        uid: "uid_b2_2",
        email: "b2_2@orthogonal.fr"
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_2",
        verifiedUserEmail: "b2_2@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_2_created",
        event_type: "transaction.created",
        data: {
          id: "txn_b2_2",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("UNSUPPORTED_OR_EARLY_EVENT_TYPE");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.3 transaction.updated refusé (422 UNSUPPORTED_OR_EARLY_EVENT_TYPE) sans lecture ni écriture Firestore", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_3",
        uid: "uid_b2_3",
        email: "b2_3@orthogonal.fr"
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_3",
        verifiedUserEmail: "b2_3@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_3_updated",
        event_type: "transaction.updated",
        data: {
          id: "txn_b2_3",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("UNSUPPORTED_OR_EARLY_EVENT_TYPE");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.4 Événement checkout.* refusé avant toute lecture ou écriture en base", async () => {
      const env = createSimulatedBackendEnv();
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_4",
        verifiedUserEmail: "b2_4@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      for (const checkoutEvent of ["checkout.created", "checkout.completed", "checkout.loaded"]) {
        const { res } = await env.sendSignedPaddleWebhook({
          event_id: `evt_b2_4_${checkoutEvent}`,
          event_type: checkoutEvent,
          data: {
            id: "txn_b2_4",
            custom_data: { orderId: order.orderId }
          }
        });
        expect(res.statusCode).toBe(422);
        expect(res.jsonBody?.code).toBe("UNSUPPORTED_OR_EARLY_EVENT_TYPE");
      }

      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.5 Événement subscription.* refusé avant toute lecture ou écriture en base", async () => {
      const env = createSimulatedBackendEnv();
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_5",
        verifiedUserEmail: "b2_5@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      for (const subEvent of ["subscription.created", "subscription.activated", "subscription_payment_succeeded"]) {
        const { res } = await env.sendSignedPaddleWebhook({
          event_id: `evt_b2_5_${subEvent}`,
          event_type: subEvent,
          data: {
            id: "txn_b2_5",
            custom_data: { orderId: order.orderId }
          }
        });
        expect(res.statusCode).toBe(422);
        expect(res.jsonBody?.code).toBe("UNSUPPORTED_OR_EARLY_EVENT_TYPE");
      }

      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.6 event_type absent refusé (400 MISSING_EVENT_TYPE) avant toute lecture ou écriture en base", async () => {
      const env = createSimulatedBackendEnv();
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_6",
        verifiedUserEmail: "b2_6@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_6_missing_type",
        data: {
          id: "txn_b2_6",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.jsonBody?.code).toBe("MISSING_EVENT_TYPE");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.7 event_type inconnu refusé (422 UNSUPPORTED_OR_EARLY_EVENT_TYPE) avant toute lecture ou écriture en base", async () => {
      const env = createSimulatedBackendEnv();
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_7",
        verifiedUserEmail: "b2_7@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.getCalls.length = 0;
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_7_unknown",
        event_type: "transaction.custom_unknown_event",
        data: {
          id: "txn_b2_7",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(422);
      expect(res.jsonBody?.code).toBe("UNSUPPORTED_OR_EARLY_EVENT_TYPE");
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.8 Signature invalide rejetée (401) avant toute logique métier", async () => {
      const env = createSimulatedBackendEnv();
      const processorSpy = vi.spyOn(env.processor, "processVerifiedPaddleEvent");

      const { res } = await env.sendSignedPaddleWebhook(
        {
          event_id: "evt_b2_8_forged",
          event_type: "transaction.completed",
          data: {
            id: "txn_b2_8",
            custom_data: { orderId: "ORD_PADDLE_0123456789ABCDEF0123456789ABCDEF" }
          }
        },
        "ts=1700000000;h1=0000000000000000000000000000000000000000000000000000000000000000"
      );

      expect(res.statusCode).toBe(401);
      expect(processorSpy).not.toHaveBeenCalled();
      expect(env.getCalls).toHaveLength(0);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B2.9 Aucun événement refusé ne consomme la commande en attente", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_9",
        uid: "uid_b2_9",
        email: "b2_9@orthogonal.fr"
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_9",
        verifiedUserEmail: "b2_9@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });

      await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_9_created",
        event_type: "transaction.created",
        data: {
          id: "txn_b2_9",
          custom_data: { orderId: order.orderId }
        }
      });

      const storedAfterEarly = env.getStoredOrder(order.orderId);
      expect(storedAfterEarly?.status).toBe("pending");
      expect(storedAfterEarly?.associationStatus).toBe("unassociated");
      expect(storedAfterEarly?.providerTransactionId).toBeUndefined();
    });

    it("B2.10 Un vrai événement transaction.completed associe toujours la commande après un événement intermédiaire refusé", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_10",
        uid: "uid_b2_10",
        email: "b2_10@orthogonal.fr"
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_10",
        verifiedUserEmail: "b2_10@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });

      // 1. Événement précoce transaction.created (même txn_b2_10) -> refusé 422
      const { res: earlyRes } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_10_early_created",
        event_type: "transaction.created",
        data: {
          id: "txn_b2_10_shared",
          custom_data: { orderId: order.orderId }
        }
      });
      expect(earlyRes.statusCode).toBe(422);

      // 2. Événement final transaction.completed (même txn_b2_10) -> accepté et associé 200
      const { res: finalRes } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_10_final_completed",
        event_type: "transaction.completed",
        data: {
          id: "txn_b2_10_shared",
          custom_data: { orderId: order.orderId }
        }
      });
      expect(finalRes.statusCode).toBe(200);
      expect(finalRes.jsonBody?.associated).toBe(true);
      expect(finalRes.jsonBody?.providerTransactionId).toBe("txn_b2_10_shared");
    });

    it("B2.11 status reste 'pending' après association", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_11",
        uid: "uid_b2_11",
        email: "b2_11@orthogonal.fr"
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_11",
        verifiedUserEmail: "b2_11@orthogonal.fr",
        plan: "pro",
        billingCycle: "yearly",
        amount: 490,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_11",
        event_type: "transaction.completed",
        data: {
          id: "txn_b2_11",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(200);
      const updated = env.getStoredOrder(order.orderId);
      expect(updated?.status).toBe("pending");
      expect(updated?.associationStatus).toBe("associated");
    });

    it("B2.12 Aucune activation de licence ni attribution de Custom Claims", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b2_12",
        uid: "uid_b2_12",
        email: "b2_12@orthogonal.fr"
      });
      const order = await env.repository.createPendingOrder({
        verifiedUserUid: "uid_b2_12",
        verifiedUserEmail: "b2_12@orthogonal.fr",
        plan: "enterprise",
        billingCycle: "yearly",
        amount: 3500,
        currency: "EUR",
        provider: "paddle",
        countryCode: "FR"
      });
      env.setCalls.length = 0;

      const { res } = await env.sendSignedPaddleWebhook({
        event_id: "evt_b2_12",
        event_type: "transaction.completed",
        data: {
          id: "txn_b2_12",
          custom_data: { orderId: order.orderId }
        }
      });

      expect(res.statusCode).toBe(200);
      expect(env.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(env.setCalls.every((c) => c.collection === "payment_transactions")).toBe(true);
    });
  });

  // =========================================================================
  // B3 — TESTS HTTP DE LA ROUTE POST /api/payments/orders (Tests 1 à 15)
  // =========================================================================
  describe("B3 — Tests HTTP réels de la route POST /api/payments/orders et ses middlewares (Tests 1 à 15)", () => {
    it("B3.1 Sans token Bearer -> 401", async () => {
      const env = createSimulatedBackendEnv();
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res.status).toBe(401);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B3.2 Token invalide -> 401", async () => {
      const env = createSimulatedBackendEnv();
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer forged_or_expired_token"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res.status).toBe(401);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B3.3 Email non vérifié -> 403", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_unverified_b3_3",
        uid: "uid_b3_3",
        email: "unverified@orthogonal.fr",
        email_verified: false
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_unverified_b3_3"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res.status).toBe(403);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B3.4 userUid vient uniquement du token vérifié", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_verified_b3_4",
        uid: "uid_authoritative_token_b3_4",
        email: "b3_4@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_verified_b3_4"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.order.userUid).toBe("uid_authoritative_token_b3_4");
      expect(body.order.userId).toBe("uid_authoritative_token_b3_4");
    });

    it("B3.5 uid / userUid dans le body différent -> ignoré, jamais utilisé", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_verified_b3_5",
        uid: "uid_real_token_owner_b3_5",
        email: "b3_5@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_verified_b3_5"
        },
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "FR",
          uid: "uid_attacker_body",
          userUid: "uid_attacker_body",
          userId: "uid_attacker_body",
          orderId: "ORD_PADDLE_CLIENT_FORGED_ID"
        })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.order.userUid).toBe("uid_real_token_owner_b3_5");
      expect(body.order.userId).toBe("uid_real_token_owner_b3_5");
      expect(body.order.orderId).not.toBe("ORD_PADDLE_CLIENT_FORGED_ID");
    });

    it("B3.6 uid absent du token -> 401 fail-closed", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_missing_uid_b3_6",
        uid: "",
        email: "nouid@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_missing_uid_b3_6"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res.status).toBe(401);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B3.7 provider non autorisé ou incohérent avec le pays -> 422", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_7",
        uid: "uid_b3_7",
        email: "b3_7@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      // Provider inconnu ("stripe")
      const resUnknownProvider = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_7"
        },
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "FR",
          provider: "stripe"
        })
      });
      expect(resUnknownProvider.status).toBe(422);

      // Provider incohérent avec le pays (paddle demandé pour DZ)
      const resMismatchedProvider = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_7"
        },
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "DZ",
          provider: "paddle"
        })
      });
      expect(resMismatchedProvider.status).toBe(422);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B3.8 Paramètres de commande invalides (plan, billingCycle, countryCode, accountType, amount, currency) -> 400 / 422", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_8",
        uid: "uid_b3_8",
        email: "b3_8@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      // Plan invalide
      const resInvalidPlan = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_8"
        },
        body: JSON.stringify({ plan: "unlimited_hacked", billingCycle: "yearly", countryCode: "FR" })
      });
      expect(resInvalidPlan.status).toBe(400);

      // billingCycle invalide
      const resInvalidCycle = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_8"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "lifetime", countryCode: "FR" })
      });
      expect(resInvalidCycle.status).toBe(400);

      // Montant falsifié par le client
      const resTamperedAmount = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_8"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR", amount: 1 })
      });
      expect(resTamperedAmount.status).toBe(422);
      expect(env.setCalls).toHaveLength(0);
    });

    it("B3.9 Création valide -> 201 avec orderId serveur", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_9",
        uid: "uid_b3_9",
        email: "b3_9@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_9"
        },
        body: JSON.stringify({
          plan: "pro",
          accountType: "pro",
          billingCycle: "yearly",
          countryCode: "FR"
        })
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.order.orderId).toMatch(/^ORD_PADDLE_[0-9A-F]{32}$/);
      expect(data.order.id).toBe(data.order.orderId);
      expect(data.order.amount).toBe(490);
      expect(data.order.currency).toBe("EUR");
    });

    it("B3.10 Document créé dans payment_transactions", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_10",
        uid: "uid_b3_10",
        email: "b3_10@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_10"
        },
        body: JSON.stringify({ plan: "team", billingCycle: "monthly", countryCode: "FR" })
      });

      expect(res.status).toBe(201);
      const { order } = await res.json();
      expect(env.setCalls).toHaveLength(1);
      expect(env.setCalls[0].collection).toBe("payment_transactions");
      expect(env.setCalls[0].docId).toBe(order.orderId);
      expect(env.getStoredOrder(order.orderId)).toBeDefined();
    });

    it("B3.11 status initial égal à 'pending'", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_11",
        uid: "uid_b3_11",
        email: "b3_11@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_11"
        },
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "FR",
          status: "completed" // tentative cliente d'injecter un statut completed
        })
      });

      expect(res.status).toBe(201);
      const { order } = await res.json();
      expect(order.status).toBe("pending");
      expect(env.getStoredOrder(order.orderId)?.status).toBe("pending");
    });

    it("B3.12 associationStatus initial égal à 'unassociated'", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_12",
        uid: "uid_b3_12",
        email: "b3_12@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_12"
        },
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          countryCode: "FR",
          associationStatus: "associated"
        })
      });

      expect(res.status).toBe(201);
      const { order } = await res.json();
      expect(order.associationStatus).toBe("unassociated");
      expect(env.getStoredOrder(order.orderId)?.associationStatus).toBe("unassociated");
    });

    it("B3.13 Échec d'écriture Firestore -> 500, pas de succès", async () => {
      const env = createSimulatedBackendEnv({ failDbSet: true });
      env.registerAuthenticatedUser({
        token: "token_b3_13",
        uid: "uid_b3_13",
        email: "b3_13@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_b3_13"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.order).toBeUndefined();
      expect(env.orderStore.size).toBe(0);
    });

    it("B3.14 Aucun document créé après échec d'authentification", async () => {
      const env = createSimulatedBackendEnv();
      activeServer = await startTestExpressOrderServer(env);

      const res1 = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });
      const res2 = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid_token"
        },
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" })
      });

      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(env.setCalls).toHaveLength(0);
      expect(env.orderStore.size).toBe(0);
    });

    it("B3.15 Aucun document créé après échec de validation", async () => {
      const env = createSimulatedBackendEnv();
      env.registerAuthenticatedUser({
        token: "token_b3_15",
        uid: "uid_b3_15",
        email: "b3_15@orthogonal.fr",
        email_verified: true
      });
      activeServer = await startTestExpressOrderServer(env);

      const invalidPayloads = [
        { plan: "invalid_plan", billingCycle: "yearly", countryCode: "FR" },
        { plan: "pro", billingCycle: "invalid_cycle", countryCode: "FR" },
        { plan: "pro", billingCycle: "yearly", countryCode: "INVALID_CODE" },
        { plan: "pro", accountType: "enterprise", billingCycle: "yearly", countryCode: "FR" },
        { plan: "pro", billingCycle: "yearly", countryCode: "FR", provider: "slickpay_baridimob" }
      ];

      for (const payload of invalidPayloads) {
        const res = await fetch(`${activeServer.baseUrl}/api/payments/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token_b3_15"
          },
          body: JSON.stringify(payload)
        });
        expect([400, 422]).toContain(res.status);
      }

      expect(env.setCalls).toHaveLength(0);
      expect(env.orderStore.size).toBe(0);
    });
  });
});
