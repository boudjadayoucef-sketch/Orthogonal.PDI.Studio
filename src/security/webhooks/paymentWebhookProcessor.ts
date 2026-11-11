/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-A-R1 — PAYMENT WEBHOOK BUSINESS PROCESSOR (B2-C & B2-D)
 *
 * Responsibility:
 * - Isolates the existing payment webhook business orchestration behind an explicit interface.
 * - Accepts injectable Firebase Admin (`adminDb`, `adminAuth`) and idempotency dependencies
 *   so tests can verify real calls on simulated dependencies without touching production Firebase.
 * - Preserves existing business behavior strictly as required for SEC-01-FIX-05-A-R1.
 */

import {
  WebhookIdempotencyRegistry,
  globalWebhookIdempotency
} from "../sec01SecurityService.ts";

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

export interface PaymentWebhookProcessorDeps {
  adminDb: WebhookFirestoreDb;
  adminAuth: WebhookAdminAuth;
  idempotency?: WebhookIdempotencyRegistry;
}

export type PaddleWebhookProcessResult =
  | { statusCode: 200; body: { received: true; status?: "already_processed" } }
  | { statusCode: 400; body: { error: string } }
  | { statusCode: 409; body: { error: string } };

export interface PaymentWebhookProcessor {
  processVerifiedPaddleEvent(payload: Record<string, any>): Promise<PaddleWebhookProcessResult>;
}

export function createPaymentWebhookProcessor(
  deps: PaymentWebhookProcessorDeps
): PaymentWebhookProcessor {
  const idempotency = deps.idempotency ?? globalWebhookIdempotency;

  return {
    async processVerifiedPaddleEvent(
      payload: Record<string, any>
    ): Promise<PaddleWebhookProcessResult> {
      const eventType = payload?.alert_name || payload?.event_type || payload?.type;
      const checkoutId =
        payload?.checkout_id || payload?.data?.id || payload?.order_id || payload?.event_id;

      if (!checkoutId) {
        return {
          statusCode: 400,
          body: { error: "Missing event/checkout ID in Paddle webhook" }
        };
      }

      const eventKey = `paddle_${checkoutId}`;

      if (idempotency.isProcessed(eventKey)) {
        return {
          statusCode: 200,
          body: { received: true, status: "already_processed" }
        };
      }
      if (!idempotency.markInProgress(eventKey)) {
        return {
          statusCode: 409,
          body: { error: "Webhook event currently in progress" }
        };
      }

      try {
        console.log(`[Webhook Paddle Verified] Processing event: ${eventType} (ID: ${checkoutId})`);

        const customerEmail =
          payload?.email || payload?.data?.customer?.email || payload?.data?.user?.email;
        const isSuccess =
          eventType === "payment_succeeded" ||
          eventType === "transaction.completed" ||
          eventType === "subscription_created";

        const txRef = deps.adminDb
          .collection("pdi_payment_transactions")
          .doc(String(checkoutId));
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
        return {
          statusCode: 200,
          body: { received: true }
        };
      } catch (innerErr) {
        idempotency.releaseInProgress(eventKey);
        throw innerErr;
      }
    }
  };
}
