/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A-R1 — SLICK-PAY HTTP WEBHOOK HANDLER (B2-B)
 *
 * Responsibility:
 * - Adapts the Express HTTP request for `/api/webhooks/slickpay`.
 * - Enforces strict fail-closed rejection via `authenticateSlickPayWebhookRequest`.
 * - Contains ZERO Firestore writes, ZERO Firebase Auth calls, and ZERO auto-activation.
 */

import type { Request, Response } from "express";
import { authenticateSlickPayWebhookRequest } from "../webhookAuth.ts";

export interface SlickPayWebhookHandlerDeps {
  getSlickPaySecret?: () => string | undefined;
}

export function createSlickPayWebhookHandler(deps: SlickPayWebhookHandlerDeps = {}) {
  const resolveSecret =
    deps.getSlickPaySecret ?? (() => process.env.SLICKPAY_WEBHOOK_SECRET);

  return async (req: Request, res: Response) => {
    try {
      const authResult = authenticateSlickPayWebhookRequest({
        payload: req.body,
        headers: req.headers as Record<string, unknown> | undefined,
        secretKey: resolveSecret()
      });

      console.warn(`[Webhook Slick-Pay Rejected] Fail-closed: ${authResult.error}`);
      return res.status(authResult.statusCode).json({
        received: false,
        status: "rejected_unverified",
        isAuthentic: false,
        canAutoActivate: false,
        error: authResult.error
      });
    } catch (err: any) {
      console.error("[Webhook Slick-Pay Error]:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Webhook processing failed" });
    }
  };
}
