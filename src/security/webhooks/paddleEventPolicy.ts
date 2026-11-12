/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B-R1 — PADDLE WEBHOOK EVENT POLICY (B2)
 *
 * Responsibility:
 * - Centralizes the explicit policy of Paddle webhook event types allowed to associate
 *   a transaction with an authoritative pending order.
 * - Authorizes ONLY `transaction.completed` (the terminal Paddle Billing v2 event
 *   representing a completed transaction).
 * - Explicitly refuses missing event types, early/intermediate transaction events
 *   (`transaction.created`, `transaction.updated`, `transaction.ready`, `transaction.billed`, etc.),
 *   checkout lifecycle events (`checkout.*`), subscription lifecycle events (`subscription.*`),
 *   and unknown event types before any Firestore read or write occurs.
 */

export const ALLOWED_PADDLE_ASSOCIATION_EVENTS: ReadonlySet<string> = new Set([
  "transaction.completed"
]);

export type PaddleEventPolicyDenialCode =
  | "MISSING_EVENT_TYPE"
  | "UNSUPPORTED_OR_EARLY_EVENT_TYPE";

export type PaddleEventPolicyEvaluation =
  | {
      allowed: true;
      eventType: "transaction.completed";
    }
  | {
      allowed: false;
      statusCode: 400 | 422;
      code: PaddleEventPolicyDenialCode;
      error: string;
    };

/**
 * Evaluates whether a Paddle webhook event type is permitted to associate
 * a payment transaction with an authoritative pending order.
 */
export function evaluatePaddleEventPolicy(
  rawEventType: unknown
): PaddleEventPolicyEvaluation {
  if (typeof rawEventType !== "string" || rawEventType.trim().length === 0) {
    return {
      allowed: false,
      statusCode: 400,
      code: "MISSING_EVENT_TYPE",
      error: "Missing Paddle event_type in webhook payload"
    };
  }

  const normalized = rawEventType.trim();

  if (!ALLOWED_PADDLE_ASSOCIATION_EVENTS.has(normalized)) {
    return {
      allowed: false,
      statusCode: 422,
      code: "UNSUPPORTED_OR_EARLY_EVENT_TYPE",
      error: `Paddle event_type '${normalized}' is not authorized to associate a pending order (only 'transaction.completed' is permitted)`
    };
  }

  return {
    allowed: true,
    eventType: "transaction.completed"
  };
}
