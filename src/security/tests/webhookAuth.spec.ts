/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A-R1 & SEC-01-FIX-05-B — WEBHOOK AUTHENTICATION & MODULAR ARCHITECTURE TEST SUITE
 *
 * Tests:
 * 1. Pure authentication contracts in `src/security/webhookAuth.ts`
 * 2. Express HTTP route handlers in `src/security/webhooks/paddleWebhookHandler.ts`
 *    and `src/security/webhooks/slickPayWebhookHandler.ts`
 * 3. Business orchestration in `src/security/webhooks/paymentWebhookProcessor.ts`
 * 4. Strict B1 (64-hex HMAC format validation) and B2 (modular separation & delegation)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebhookIdempotencyRegistry } from "../sec01SecurityService.ts";
import {
  authenticatePaddleWebhookRequest,
  authenticateSlickPayWebhookRequest
} from "../webhookAuth.ts";
import {
  createPaddleWebhookHandler,
  type RawBodyWebhookRequest
} from "../webhooks/paddleWebhookHandler.ts";
import { createSlickPayWebhookHandler } from "../webhooks/slickPayWebhookHandler.ts";
import {
  createPaymentWebhookProcessor,
  type PaymentWebhookProcessor
} from "../webhooks/paymentWebhookProcessor.ts";

function buildPaddleSignature(rawBody: string, secretKey: string, timestampSec?: number): string {
  const ts = (timestampSec ?? Math.floor(Date.now() / 1000)).toString();
  const signedPayload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secretKey).update(signedPayload, "utf8").digest("hex");
  return `ts=${ts};h1=${h1}`;
}

function buildPaddleRawHmac(rawBody: string, secretKey: string, timestampSec: number): string {
  return crypto
    .createHmac("sha256", secretKey)
    .update(`${timestampSec}:${rawBody}`, "utf8")
    .digest("hex");
}

function createMockExpressResponse() {
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

function createSimulatedWebhookStack(options?: {
  paddleSecret?: string;
  slickPaySecret?: string;
}) {
  const store = new Map<string, Record<string, unknown>>();
  store.set("payment_transactions:ORD_PADDLE_VALID_001", {
    id: "ORD_PADDLE_VALID_001",
    orderId: "ORD_PADDLE_VALID_001",
    userId: "uid_for_client@orthogonal.dz",
    userUid: "uid_for_client@orthogonal.dz",
    userEmail: "client@orthogonal.dz",
    userName: "Client Orthogonal",
    country: "France",
    countryCode: "FR",
    plan: "pro",
    billingCycle: "yearly",
    amount: 490,
    currency: "EUR",
    provider: "paddle",
    status: "pending",
    associationStatus: "unassociated",
    createdAt: "2026-11-11T00:00:00.000Z"
  });

  const setCalls: Array<{
    collection: string;
    docId: string;
    data: Record<string, unknown>;
    options?: { merge?: boolean };
  }> = [];
  const docSetMock = vi.fn();

  const adminDb = {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn(async () => {
          const existing = store.get(`${colName}:${docId}`);
          return {
            exists: Boolean(existing),
            id: docId,
            data: () => (existing ? { ...existing } : undefined)
          };
        }),
        set: vi.fn(async (data: Record<string, unknown>, setOpts?: { merge?: boolean }) => {
          const current = store.get(`${colName}:${docId}`) || {};
          store.set(
            `${colName}:${docId}`,
            setOpts?.merge ? { ...current, ...data } : { ...data }
          );
          setCalls.push({ collection: colName, docId, data, options: setOpts });
          docSetMock(colName, docId, data, setOpts);
        })
      }))
    }))
  };

  const adminAuth = {
    getUser: vi.fn(async (uid: string) => ({
      uid,
      email: "client@orthogonal.dz",
      disabled: false
    })),
    getUserByEmail: vi.fn(async (email: string) => ({ uid: `uid_for_${email}` })),
    setCustomUserClaims: vi.fn(async () => undefined)
  };

  const idempotency = new WebhookIdempotencyRegistry(500);
  const realProcessor = createPaymentWebhookProcessor({
    adminDb,
    adminAuth,
    idempotency
  });

  const processorSpy: PaymentWebhookProcessor = {
    processVerifiedPaddleEvent: vi.fn((payload: Record<string, any>) =>
      realProcessor.processVerifiedPaddleEvent(payload)
    )
  };

  const paddleHandler = createPaddleWebhookHandler({
    processor: processorSpy,
    getPaddleSecret: () => options?.paddleSecret
  });

  const slickPayHandler = createSlickPayWebhookHandler({
    getSlickPaySecret: () => options?.slickPaySecret
  });

  return {
    adminDb,
    adminAuth,
    idempotency,
    processorSpy,
    paddleHandler,
    slickPayHandler,
    setCalls,
    docSetMock
  };
}

describe("SEC-01-FIX-05-A-R1 : Webhook Authentication Hardening & Modular Separation", () => {
  const paddleSecret = "pdl_ntfset_01hxyz_strict_webhook_secret_key";
  const slickPaySecret = "slickpay_shared_secret_2026_dz";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // A — PADDLE : AUTHENTIFICATION STRICTE SUR req.rawBody & FORMAT 64-HEX (B1)
  // =========================================================================
  describe("A — Paddle : Authentification stricte, format HMAC 64-hex et délégation contrôlée", () => {
    it("1. Signature Paddle 64-hex valide sur req.rawBody exact -> authentification réussie et délégation au processeur métier", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });

      // Corps brut avec espacement spécifique pour prouver l'utilisation de req.rawBody et non JSON.stringify(req.body)
      const rawBody =
        '{\n  "event_id": "evt_paddle_valid_001",\n  "event_type": "transaction.completed",\n  "data": { "id": "txn_valid_001", "custom_data": { "orderId": "ORD_PADDLE_VALID_001" }, "customer": { "email": "client@orthogonal.dz" } }\n}';
      const parsedBody = JSON.parse(rawBody);
      const signature = buildPaddleSignature(rawBody, paddleSecret);

      const req = {
        rawBody,
        body: parsedBody,
        headers: { "paddle-signature": signature }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toMatchObject({
        received: true,
        associated: true,
        orderId: "ORD_PADDLE_VALID_001",
        providerTransactionId: "txn_valid_001"
      });
      expect(stack.processorSpy.processVerifiedPaddleEvent).toHaveBeenCalledTimes(1);
      expect(stack.processorSpy.processVerifiedPaddleEvent).toHaveBeenCalledWith(parsedBody);
      expect(stack.docSetMock).toHaveBeenCalledTimes(1);
      expect(stack.setCalls[0].collection).toBe("payment_transactions");
      expect(stack.setCalls[0].docId).toBe("ORD_PADDLE_VALID_001");
      // SEC-01-FIX-05-B: No premature license/claim activation during order-to-transaction association
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
    });

    it("2. Signature Paddle 64-hex invalide -> HTTP 401, processeur métier NON appelé, aucune écriture Firestore/Auth", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });

      const rawBody = JSON.stringify({
        event_id: "evt_paddle_invalid_sig",
        event_type: "transaction.completed",
        checkout_id: "chk_invalid_sig_002",
        email: "attacker@evil.com"
      });
      const invalidSignature = `ts=${Math.floor(Date.now() / 1000)};h1=${"a".repeat(64)}`;

      const req = {
        rawBody,
        body: JSON.parse(rawBody),
        headers: { "paddle-signature": invalidSignature }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(stack.idempotency.isProcessed("paddle_chk_invalid_sig_002")).toBe(false);
    });

    it("3. Signature Paddle absente -> HTTP 401, processeur métier NON appelé, aucune écriture Firestore/Auth", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });

      const rawBody = JSON.stringify({
        event_id: "evt_paddle_no_sig",
        event_type: "payment_succeeded",
        checkout_id: "chk_no_sig_003",
        email: "attacker@evil.com"
      });

      const req = {
        rawBody,
        body: JSON.parse(rawBody),
        headers: {}
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("Missing Paddle-Signature header");
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("4. req.rawBody absent (suppression du fallback JSON.stringify(req.body)) -> HTTP 401, processeur métier NON appelé", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });

      const bodyObj = {
        event_id: "evt_paddle_no_raw_body",
        event_type: "transaction.completed",
        checkout_id: "chk_no_raw_body_004",
        email: "attacker@evil.com"
      };
      const forgedSignatureOnJsonStringify = buildPaddleSignature(
        JSON.stringify(bodyObj),
        paddleSecret
      );

      const req = {
        rawBody: undefined,
        body: bodyObj,
        headers: { "paddle-signature": forgedSignatureOnJsonStringify }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("Missing raw request body");
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
    });

    it("5. Corps JSON reconstruit différent de req.rawBody -> HTTP 401, processeur métier NON appelé", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });

      const rawBody = '{ "checkout_id" : "chk_005" , "event_type" : "payment_succeeded" }';
      const parsedBody = JSON.parse(rawBody);
      const signatureOverReserialized = buildPaddleSignature(
        JSON.stringify(parsedBody),
        paddleSecret
      );

      const authCheck = authenticatePaddleWebhookRequest({
        rawBody,
        headers: { "paddle-signature": signatureOverReserialized },
        secretKey: paddleSecret
      });
      expect(authCheck.authenticated).toBe(false);

      const req = {
        rawBody,
        body: parsedBody,
        headers: { "paddle-signature": signatureOverReserialized }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
    });

    it("6. Signature malformée (63 caractères) -> HTTP 401, processeur métier NON appelé, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });
      const rawBody = JSON.stringify({
        event_id: "evt_paddle_63_chars",
        event_type: "transaction.completed",
        checkout_id: "chk_63_chars"
      });
      const ts = Math.floor(Date.now() / 1000);
      const validH1 = buildPaddleRawHmac(rawBody, paddleSecret, ts);
      const sig63 = `ts=${ts};h1=${validH1.slice(0, 63)}`;

      const req = {
        rawBody,
        body: JSON.parse(rawBody),
        headers: { "paddle-signature": sig63 }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("64 hex characters");
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
    });

    it("7. Signature malformée (65 caractères : HMAC valide + 1 caractère hex) -> HTTP 401, processeur métier NON appelé, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });
      const rawBody = JSON.stringify({
        event_id: "evt_paddle_65_chars",
        event_type: "transaction.completed",
        checkout_id: "chk_65_chars",
        email: "attacker@evil.com"
      });
      const ts = Math.floor(Date.now() / 1000);
      const validH1 = buildPaddleRawHmac(rawBody, paddleSecret, ts);
      const sig65 = `ts=${ts};h1=${validH1}f`;

      const req = {
        rawBody,
        body: JSON.parse(rawBody),
        headers: { "paddle-signature": sig65 }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("64 hex characters");
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("8. Signature malformée (66 caractères) -> HTTP 401, processeur métier NON appelé, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ paddleSecret });
      const rawBody = JSON.stringify({
        event_id: "evt_paddle_66_chars",
        event_type: "transaction.completed",
        checkout_id: "chk_66_chars"
      });
      const ts = Math.floor(Date.now() / 1000);
      const validH1 = buildPaddleRawHmac(rawBody, paddleSecret, ts);
      const sig66 = `ts=${ts};h1=${validH1}ab`;

      const req = {
        rawBody,
        body: JSON.parse(rawBody),
        headers: { "paddle-signature": sig66 }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.paddleHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("64 hex characters");
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // B — SLICK-PAY : COMPORTEMENT FAIL-CLOSED STRICT
  // =========================================================================
  describe("B — Slick-Pay : Comportement Fail-Closed et blocage de toute écriture ou activation non authentifiée", () => {
    it("9. Slick-Pay sans secret -> HTTP 401, isAuthentic: false, canAutoActivate: false, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ slickPaySecret: undefined });

      const req = {
        body: {
          invoice_id: "INV_SLICK_001",
          status: "completed",
          amount: 49000,
          customer_email: "client@orthogonal.dz"
        },
        headers: { "x-slickpay-signature": "any_sig" }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.slickPayHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("10. Slick-Pay avec header absent -> HTTP 401, isAuthentic: false, canAutoActivate: false, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ slickPaySecret });

      const req = {
        body: {
          invoice_id: "INV_SLICK_002",
          status: "completed",
          amount: 49000,
          customer_email: "client@orthogonal.dz"
        },
        headers: {}
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.slickPayHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(res.jsonBody?.error).toContain("Missing Slick-Pay signature header");
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("11. Slick-Pay avec header faux -> HTTP 401, isAuthentic: false, canAutoActivate: false, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ slickPaySecret });

      const req = {
        body: {
          invoice_id: "INV_SLICK_003",
          status: "completed",
          amount: 49000,
          customer_email: "client@orthogonal.dz"
        },
        headers: { "x-slickpay-signature": "wrong_secret_value" }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.slickPayHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("12. Slick-Pay avec header égal au secret partagé -> HTTP 401, isAuthentic: false, canAutoActivate: false, zéro effet métier", async () => {
      const stack = createSimulatedWebhookStack({ slickPaySecret });

      const authResult = authenticateSlickPayWebhookRequest({
        payload: { invoice_id: "INV_SLICK_004", status: "completed" },
        headers: { "x-slickpay-signature": slickPaySecret },
        secretKey: slickPaySecret
      });

      expect(authResult.authenticated).toBe(false);
      expect(authResult.canAutoActivate).toBe(false);
      expect(authResult.verification.isAuthentic).toBe(false);
      expect(authResult.verification.canAutoActivate).toBe(false);

      const req = {
        body: {
          invoice_id: "INV_SLICK_004",
          status: "completed",
          amount: 49000,
          customer_email: "client@orthogonal.dz"
        },
        headers: { "x-slickpay-signature": slickPaySecret }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await stack.slickPayHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(stack.processorSpy.processVerifiedPaddleEvent).not.toHaveBeenCalled();
      expect(stack.docSetMock).not.toHaveBeenCalled();
      expect(stack.adminDb.collection).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUser).not.toHaveBeenCalled();
      expect(stack.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(stack.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(stack.idempotency.isProcessed("slickpay_INV_SLICK_004")).toBe(false);
    });
  });

  // =========================================================================
  // C — GARANTIES ARCHITECTURALES B2 : SÉPARATION STRICTE DES RESPONSABILITÉS
  // =========================================================================
  describe("C — Séparation modulaire B2 (webhookAuth, HTTP handlers, paymentWebhookProcessor)", () => {
    it("13. Les handlers HTTP ne contiennent aucune orchestration directe Firestore / Auth et délèguent exclusivement après authentification", () => {
      const paddleHandlerSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/webhooks/paddleWebhookHandler.ts"),
        "utf8"
      );
      const slickPayHandlerSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/webhooks/slickPayWebhookHandler.ts"),
        "utf8"
      );

      expect(paddleHandlerSource).not.toContain("adminDb");
      expect(paddleHandlerSource).not.toContain("adminAuth");
      expect(paddleHandlerSource).not.toContain("pdi_payment_transactions");
      expect(paddleHandlerSource).not.toContain("payment_transactions");
      expect(paddleHandlerSource).not.toContain("setCustomUserClaims");

      expect(slickPayHandlerSource).not.toContain("adminDb");
      expect(slickPayHandlerSource).not.toContain("adminAuth");
      expect(slickPayHandlerSource).not.toContain("pdi_payment_transactions");
      expect(slickPayHandlerSource).not.toContain("payment_transactions");
      expect(slickPayHandlerSource).not.toContain("setCustomUserClaims");
    });

    it("14. webhookAuth.ts ne contient aucune opération métier, aucun accès Firestore et aucune mutation Custom Claims", () => {
      const webhookAuthSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/webhookAuth.ts"),
        "utf8"
      );

      expect(webhookAuthSource).not.toContain("adminDb");
      expect(webhookAuthSource).not.toContain("adminAuth");
      expect(webhookAuthSource).not.toContain("pdi_payment_transactions");
      expect(webhookAuthSource).not.toContain("payment_transactions");
      expect(webhookAuthSource).not.toContain("profiles");
      expect(webhookAuthSource).not.toContain("setCustomUserClaims");
      expect(webhookAuthSource).not.toContain("getUserByEmail");
    });
  });
});
