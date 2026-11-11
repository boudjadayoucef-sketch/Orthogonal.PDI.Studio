/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A — MODULAR WEBHOOK AUTHENTICATION & HTTP GATEWAY
 *
 * Responsibilities:
 * 1. Dedicated, single-responsibility authentication gate for Paddle webhooks:
 *    - Strictly requires `req.rawBody` (original HTTP bytes).
 *    - Explicitly forbids any `JSON.stringify(req.body)` fallback.
 *    - Validates HMAC-SHA256 signature before any idempotency or Firestore write.
 * 2. Dedicated, fail-closed authentication gate for Slick-Pay webhooks:
 *    - Does not accept direct shared-secret header comparison as proof of authenticity.
 *    - Forces `isAuthentic: false` and `canAutoActivate: false`.
 *    - Blocks all unauthenticated business processing, transaction writes, and auto-activations.
 * 3. Clean dependency injection interfaces separating HTTP transport, authentication,
 *    and downstream persistence so route handlers can be unit- and integration-tested
 *    against simulated Firestore/Auth dependencies without touching production Firebase.
 */

import type { Request, Response } from "express";
import {
  verifyPaddleWebhookSignature,
  verifySlickPayWebhook,
  WebhookIdempotencyRegistry,
  globalWebhookIdempotency
} from "./sec01SecurityService.ts";

export interface RawBodyWebhookRequest extends Request {
  rawBody?: string;
}

export interface PaddleWebhookAuthInput {
  rawBody: unknown;
  headers: Record<string, unknown> | undefined;
  secretKey: string | undefined;
}

export interface PaddleWebhookAuthResult {
  readonly authenticated: boolean;
  readonly statusCode: 200 | 401;
  readonly rawBody?: string;
  readonly error?: string;
}

export interface SlickPayWebhookAuthInput {
  payload: unknown;
  headers: Record<string, unknown> | undefined;
  secretKey: string | undefined;
}

export interface SlickPayWebhookAuthResult {
  readonly authenticated: false;
  readonly canAutoActivate: false;
  readonly statusCode: 401 | 403;
  readonly error: string;
  readonly verification: {
    isAuthentic: boolean;
    canAutoActivate: boolean;
    reason: string;
  };
}

export interface WebhookFirestoreDocRef {
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
}

export interface WebhookFirestoreCollectionRef {
  doc(id: string): WebhookFirestoreDocRef;
}

export interface WebhookFirestoreDb {
  collection(name: string): WebhookFirestoreCollectionRef;
}

export interface WebhookAdminAuth {
  getUserByEmail(email: string): Promise<{ uid?: string } | null | undefined>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<unknown>;
}

export interface WebhookHandlerDependencies {
  adminDb: WebhookFirestoreDb;
  adminAuth: WebhookAdminAuth;
  idempotency?: WebhookIdempotencyRegistry;
  getPaddleSecret?: () => string | undefined;
  getSlickPaySecret?: () => string | undefined;
}

function extractSingleHeader(
  headers: Record<string, unknown> | undefined,
  ...candidateNames: string[]
): string | undefined {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }
  for (const name of candidateNames) {
    const val = headers[name] ?? headers[name.toLowerCase()];
    if (typeof val === "string" && val.trim().length > 0) {
      return val;
    }
    if (Array.isArray(val) && typeof val[0] === "string" && val[0].trim().length > 0) {
      return val[0];
    }
  }
  return undefined;
}

/**
 * A — Paddle: Strict authentication gate.
 * Uses exclusively the original HTTP body bytes preserved in `req.rawBody`.
 * Never falls back to `JSON.stringify(req.body)`.
 */
export function authenticatePaddleWebhookRequest(
  input: PaddleWebhookAuthInput
): PaddleWebhookAuthResult {
  if (typeof input.rawBody !== "string" || input.rawBody.length === 0) {
    return {
      authenticated: false,
      statusCode: 401,
      error: "Missing raw request body (req.rawBody) for Paddle webhook authentication"
    };
  }

  const signatureHeader = extractSingleHeader(
    input.headers,
    "paddle-signature",
    "Paddle-Signature"
  );

  const verification = verifyPaddleWebhookSignature(
    input.rawBody,
    signatureHeader,
    input.secretKey
  );

  if (!verification.isValid) {
    return {
      authenticated: false,
      statusCode: 401,
      error: verification.error || "Invalid Paddle webhook signature"
    };
  }

  return {
    authenticated: true,
    statusCode: 200,
    rawBody: input.rawBody
  };
}

/**
 * B — Slick-Pay: Strict fail-closed authentication gate.
 * Direct comparison of a header with a shared secret is not accepted as proof of authenticity.
 * Forces `authenticated: false` and `canAutoActivate: false` until an official protocol is verified.
 */
export function authenticateSlickPayWebhookRequest(
  input: SlickPayWebhookAuthInput
): SlickPayWebhookAuthResult {
  const verification = verifySlickPayWebhook(
    input.payload,
    input.headers,
    input.secretKey
  );

  return {
    authenticated: false,
    canAutoActivate: false,
    statusCode: 401,
    error: verification.reason,
    verification: {
      isAuthentic: false,
      canAutoActivate: false,
      reason: verification.reason
    }
  };
}

/**
 * Express route handler factory for `/api/webhooks/paddle`.
 * Guarantees that no idempotency state change, business logic, or Firestore/Auth write
 * occurs unless `authenticatePaddleWebhookRequest` succeeds on `req.rawBody`.
 */
export function createPaddleWebhookHandler(deps: WebhookHandlerDependencies) {
  const idempotency = deps.idempotency ?? globalWebhookIdempotency;
  const resolveSecret =
    deps.getPaddleSecret ??
    (() => process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET);

  return async (req: RawBodyWebhookRequest, res: Response) => {
    try {
      // 1. Strict authentication on original req.rawBody (NEVER JSON.stringify(req.body))
      const authResult = authenticatePaddleWebhookRequest({
        rawBody: req.rawBody,
        headers: req.headers as Record<string, unknown> | undefined,
        secretKey: resolveSecret()
      });

      if (!authResult.authenticated) {
        console.warn(`[Webhook Paddle Rejected] Unauthorized webhook attempt: ${authResult.error}`);
        return res.status(authResult.statusCode).json({
          received: false,
          error: authResult.error || "Invalid Paddle signature"
        });
      }

      // 2. Parse payload only after cryptographic signature over req.rawBody is verified
      const payload =
        req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
          ? req.body
          : JSON.parse(authResult.rawBody!);

      const eventType = payload?.alert_name || payload?.event_type || payload?.type;
      const checkoutId =
        payload?.checkout_id || payload?.data?.id || payload?.order_id || payload?.event_id;

      if (!checkoutId) {
        return res.status(400).json({ error: "Missing event/checkout ID in Paddle webhook" });
      }

      const eventKey = `paddle_${checkoutId}`;

      // 3. Anti-Replay Idempotency Guard
      if (idempotency.isProcessed(eventKey)) {
        return res.status(200).json({ received: true, status: "already_processed" });
      }
      if (!idempotency.markInProgress(eventKey)) {
        return res.status(409).json({ error: "Webhook event currently in progress" });
      }

      try {
        console.log(`[Webhook Paddle Verified] Processing event: ${eventType} (ID: ${checkoutId})`);

        const customerEmail =
          payload?.email || payload?.data?.customer?.email || payload?.data?.user?.email;
        const isSuccess =
          eventType === "payment_succeeded" ||
          eventType === "transaction.completed" ||
          eventType === "subscription_created";

        const txRef = deps.adminDb.collection("pdi_payment_transactions").doc(String(checkoutId));
        await txRef.set(
          {
            id: `TX_PADDLE_${checkoutId}`,
            provider: "paddle_international",
            status: isSuccess ? "completed" : "pending",
            userEmail: customerEmail
              ? String(customerEmail).toLowerCase()
              : "international@client.com",
            updatedAt: new Date().toISOString(),
            eventType
          },
          { merge: true }
        );

        if (isSuccess && customerEmail) {
          try {
            const userRecord = await deps.adminAuth.getUserByEmail(customerEmail);
            if (userRecord?.uid) {
              await deps.adminAuth.setCustomUserClaims(userRecord.uid, {
                role: "client",
                plan: "pro",
                activeUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
              });
              await deps.adminDb
                .collection("pdi_user_profiles")
                .doc(userRecord.uid)
                .set(
                  {
                    plan: "pro",
                    status: "active",
                    activatedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                    subscriptionProvider: "paddle"
                  },
                  { merge: true }
                );
              console.log(`[Webhook Paddle] Pro subscription activated for UID: ${userRecord.uid}`);
            }
          } catch {
            console.warn("[Webhook Paddle] User not found in Auth, saved pending.");
          }
        }

        idempotency.markCompleted(eventKey);
        return res.status(200).json({ received: true });
      } catch (innerErr) {
        idempotency.releaseInProgress(eventKey);
        throw innerErr;
      }
    } catch (err: any) {
      console.error("[Webhook Paddle Error]:", err?.message || err);
      return res
        .status(500)
        .json({ error: err?.message || "Paddle webhook processing failed" });
    }
  };
}

/**
 * Express route handler factory for `/api/webhooks/slickpay`.
 * Enforces strict fail-closed behavior (SEC-01-FIX-05-A Section 3.B):
 * - Authenticates before any idempotency mutation, business logic, or Firestore write.
 * - Because direct shared-secret comparison is not an officially verified Slick-Pay protocol,
 *   refuses unauthenticated webhook processing and performs zero Firestore or Auth writes.
 */
export function createSlickPayWebhookHandler(deps: WebhookHandlerDependencies) {
  const resolveSecret =
    deps.getSlickPaySecret ?? (() => process.env.SLICKPAY_WEBHOOK_SECRET);

  return async (req: RawBodyWebhookRequest, res: Response) => {
    try {
      const payload = req.body;
      const authResult = authenticateSlickPayWebhookRequest({
        payload,
        headers: req.headers as Record<string, unknown> | undefined,
        secretKey: resolveSecret()
      });

      // Strict fail-closed gate: never write unauthenticated transactions or auto-activate
      if (!authResult.authenticated || !authResult.canAutoActivate) {
        console.warn(`[Webhook Slick-Pay Rejected] Fail-closed: ${authResult.error}`);
        return res.status(authResult.statusCode).json({
          received: false,
          status: "rejected_unverified",
          isAuthentic: false,
          canAutoActivate: false,
          error: authResult.error
        });
      }
    } catch (err: any) {
      console.error("[Webhook Slick-Pay Error]:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Webhook processing failed" });
    }
  };
}
