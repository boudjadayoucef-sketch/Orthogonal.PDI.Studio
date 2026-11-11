/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A-R1 — PURE WEBHOOK AUTHENTICATION MODULE (B2-A)
 *
 * Responsibility:
 * - Exclusively validates webhook authenticity and exposes explicit authentication contracts.
 * - Contains ZERO Firestore access, ZERO user lookup, ZERO transaction writes,
 *   ZERO Custom Claims mutation, ZERO license/subscription activation, and ZERO HTTP/business orchestration.
 */

import {
  verifyPaddleWebhookSignature,
  verifySlickPayWebhook
} from "./sec01SecurityService.ts";

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
