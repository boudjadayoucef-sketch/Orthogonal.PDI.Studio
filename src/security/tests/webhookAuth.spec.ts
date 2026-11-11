/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A — WEBHOOK AUTHENTICATION HARDENING TEST SUITE
 *
 * Tests both the modular authentication gates and the actual Express HTTP route handlers
 * (`createPaddleWebhookHandler`, `createSlickPayWebhookHandler`) with simulated Firebase
 * dependencies (`adminDb`, `adminAuth`) to verify HTTP responses and guarantee zero
 * unauthenticated Firestore or Auth writes.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import { WebhookIdempotencyRegistry } from "../sec01SecurityService.ts";
import {
  authenticatePaddleWebhookRequest,
  authenticateSlickPayWebhookRequest,
  createPaddleWebhookHandler,
  createSlickPayWebhookHandler,
  type RawBodyWebhookRequest
} from "../webhookAuth.ts";

function buildPaddleSignature(rawBody: string, secretKey: string, timestampSec?: number): string {
  const ts = (timestampSec ?? Math.floor(Date.now() / 1000)).toString();
  const signedPayload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secretKey).update(signedPayload, "utf8").digest("hex");
  return `ts=${ts};h1=${h1}`;
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

function createSimulatedFirebaseDeps(options?: {
  paddleSecret?: string;
  slickPaySecret?: string;
}) {
  const setCalls: Array<{ collection: string; docId: string; data: Record<string, unknown>; options?: { merge?: boolean } }> = [];
  const docSetMock = vi.fn();

  const adminDb = {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        set: vi.fn(async (data: Record<string, unknown>, setOpts?: { merge?: boolean }) => {
          setCalls.push({ collection: colName, docId, data, options: setOpts });
          docSetMock(colName, docId, data, setOpts);
        })
      }))
    }))
  };

  const adminAuth = {
    getUserByEmail: vi.fn(async (email: string) => ({ uid: `uid_for_${email}` })),
    setCustomUserClaims: vi.fn(async () => undefined)
  };

  const idempotency = new WebhookIdempotencyRegistry(500);

  return {
    adminDb,
    adminAuth,
    idempotency,
    setCalls,
    docSetMock,
    getPaddleSecret: () => options?.paddleSecret,
    getSlickPaySecret: () => options?.slickPaySecret
  };
}

describe("SEC-01-FIX-05-A : Webhook Authentication Hardening (Paddle & Slick-Pay)", () => {
  const paddleSecret = "pdl_ntfset_01hxyz_strict_webhook_secret_key";
  const slickPaySecret = "slickpay_shared_secret_2026_dz";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // A — PADDLE : AUTHENTIFICATION STRICTE SUR req.rawBody
  // =========================================================================
  describe("A — Paddle : Authentification stricte et effets HTTP / Firestore", () => {
    it("A1: Signature Paddle valide sur req.rawBody exact -> HTTP 200 et écriture contrôlée dans les dépendances simulées", async () => {
      const deps = createSimulatedFirebaseDeps({ paddleSecret });
      const handler = createPaddleWebhookHandler(deps);

      // Corps brut avec espacement spécifique pour prouver l'utilisation de req.rawBody et non JSON.stringify(req.body)
      const rawBody =
        '{\n  "event_id": "evt_paddle_valid_001",\n  "event_type": "transaction.completed",\n  "data": { "id": "chk_valid_001", "customer": { "email": "client@orthogonal.dz" } }\n}';
      const parsedBody = JSON.parse(rawBody);
      const signature = buildPaddleSignature(rawBody, paddleSecret);

      const req = {
        rawBody,
        body: parsedBody,
        headers: { "paddle-signature": signature }
      } as unknown as RawBodyWebhookRequest;
      const res = createMockExpressResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual({ received: true });
      expect(deps.docSetMock).toHaveBeenCalled();
      expect(deps.setCalls[0].collection).toBe("pdi_payment_transactions");
      expect(deps.setCalls[0].docId).toBe("chk_valid_001");
    });

    it("A2: Signature Paddle invalide -> HTTP 401, aucune mutation d'idempotence et AUCUNE écriture Firestore/Auth", async () => {
      const deps = createSimulatedFirebaseDeps({ paddleSecret });
      const handler = createPaddleWebhookHandler(deps);

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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(deps.idempotency.isProcessed("paddle_chk_invalid_sig_002")).toBe(false);
      expect(deps.idempotency.isInProgress("paddle_chk_invalid_sig_002")).toBe(false);
    });

    it("A3: Signature Paddle absente -> HTTP 401 et AUCUNE écriture Firestore/Auth", async () => {
      const deps = createSimulatedFirebaseDeps({ paddleSecret });
      const handler = createPaddleWebhookHandler(deps);

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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("Missing Paddle-Signature header");
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("A4: req.rawBody absent (suppression du fallback JSON.stringify(req.body)) -> HTTP 401 même si la signature correspond à JSON.stringify(req.body)", async () => {
      const deps = createSimulatedFirebaseDeps({ paddleSecret });
      const handler = createPaddleWebhookHandler(deps);

      const bodyObj = {
        event_id: "evt_paddle_no_raw_body",
        event_type: "transaction.completed",
        checkout_id: "chk_no_raw_body_004",
        email: "attacker@evil.com"
      };
      // Un attaquant signe JSON.stringify(bodyObj), mais req.rawBody est absent
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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.error).toContain("Missing raw request body");
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("A5: Signature calculée sur JSON.stringify(req.body) alors que req.rawBody diffère par le formatage -> HTTP 401 et aucune écriture Firestore", async () => {
      const deps = createSimulatedFirebaseDeps({ paddleSecret });
      const handler = createPaddleWebhookHandler(deps);

      const rawBody = '{ "checkout_id" : "chk_005" , "event_type" : "payment_succeeded" }';
      const parsedBody = JSON.parse(rawBody);
      // Signature calculée sur JSON.stringify(parsedBody) au lieu des octets originaux de req.rawBody
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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // B — SLICK-PAY : COMPORTEMENT FAIL-CLOSED STRICT
  // =========================================================================
  describe("B — Slick-Pay : Comportement Fail-Closed et blocage de toute écriture ou activation non authentifiée", () => {
    it("B1: Slick-Pay - Secret absent -> HTTP 401, isAuthentic: false, canAutoActivate: false, aucune écriture Firestore/Auth", async () => {
      const deps = createSimulatedFirebaseDeps({ slickPaySecret: undefined });
      const handler = createSlickPayWebhookHandler(deps);

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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("B2: Slick-Pay - Header de signature absent -> HTTP 401, isAuthentic: false, canAutoActivate: false, aucune écriture Firestore/Auth", async () => {
      const deps = createSimulatedFirebaseDeps({ slickPaySecret });
      const handler = createSlickPayWebhookHandler(deps);

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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(res.jsonBody?.error).toContain("Missing Slick-Pay signature header");
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("B3: Slick-Pay - Header incorrect -> HTTP 401, isAuthentic: false, canAutoActivate: false, aucune écriture Firestore/Auth", async () => {
      const deps = createSimulatedFirebaseDeps({ slickPaySecret });
      const handler = createSlickPayWebhookHandler(deps);

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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it("B4: Slick-Pay - Même si le header correspond exactement au secret partagé, la comparaison directe est refusée (isAuthentic: false, canAutoActivate: false, HTTP 401, zéro écriture Firestore et zéro activation)", async () => {
      const deps = createSimulatedFirebaseDeps({ slickPaySecret });
      const handler = createSlickPayWebhookHandler(deps);

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

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonBody?.received).toBe(false);
      expect(res.jsonBody?.isAuthentic).toBe(false);
      expect(res.jsonBody?.canAutoActivate).toBe(false);
      expect(deps.docSetMock).not.toHaveBeenCalled();
      expect(deps.adminDb.collection).not.toHaveBeenCalled();
      expect(deps.adminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(deps.adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(deps.idempotency.isProcessed("slickpay_INV_SLICK_004")).toBe(false);
    });
  });
});
