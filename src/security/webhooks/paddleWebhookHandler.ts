/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A-R1 — PADDLE HTTP WEBHOOK HANDLER (B2-B)
 *
 * Responsibility:
 * - Adapts the Express HTTP request for `/api/webhooks/paddle`.
 * - Enforces authentication via `authenticatePaddleWebhookRequest` on `req.rawBody`
 *   BEFORE any business delegation.
 * - Delegates verified events to an injected `PaymentWebhookProcessor`.
 * - Contains ZERO direct Firestore, Firebase Auth, or Custom Claims logic.
 */

import type { Request, Response } from "express";
import { authenticatePaddleWebhookRequest } from "../webhookAuth.ts";
import type { PaymentWebhookProcessor } from "./paymentWebhookProcessor.ts";

export interface RawBodyWebhookRequest extends Request {
  rawBody?: string;
}

export interface PaddleWebhookHandlerDeps {
  processor: PaymentWebhookProcessor;
  getPaddleSecret?: () => string | undefined;
}

export function createPaddleWebhookHandler(deps: PaddleWebhookHandlerDeps) {
  const resolveSecret =
    deps.getPaddleSecret ??
    (() => process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET);

  return async (req: RawBodyWebhookRequest, res: Response) => {
    try {
      // 1. Strict authentication gate on original req.rawBody (never JSON.stringify(req.body))
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

      // 2. Parse verified raw body and delegate to isolated business processor
      const payload =
        req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
          ? req.body
          : JSON.parse(authResult.rawBody!);

      const result = await deps.processor.processVerifiedPaddleEvent(payload);
      return res.status(result.statusCode).json(result.body);
    } catch (err: any) {
      console.error("[Webhook Paddle Error]:", err?.message || err);
      return res
        .status(500)
        .json({ error: err?.message || "Paddle webhook processing failed" });
    }
  };
}
