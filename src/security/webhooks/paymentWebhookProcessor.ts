/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-06-R1 — PAYMENT WEBHOOK BUSINESS PROCESSOR (DURABLE IDEMPOTENCY)
 *
 * Responsibility:
 * - Orchestrates post-authentication Paddle webhook processing by delegating:
 *   1. Identifier extraction to `extractPaddleWebhookIdentifiers`
 *   2. Event policy validation to `evaluatePaddleEventPolicy` (before any idempotency read/write)
 *   3. Durable atomic lease management to `WebhookIdempotencyRepository` (`payment_webhook_events`)
 *   4. Order lookup and association validation to `validateAndAssociatePaddleOrder` (`PendingOrderRepository`)
 * - Never relies on in-memory `globalWebhookIdempotency` as authority.
 * - Fails closed on any Firestore transaction or persistence error (never returns a false 200).
 * - Never creates arbitrary orders from webhook data, never resolves users by webhook email,
 *   and never activates subscriptions or Custom Claims.
 */

import type { WebhookIdempotencyRegistry } from "../sec01SecurityService.ts";
import { evaluatePaddleEventPolicy } from "./paddleEventPolicy.ts";
import {
  createPendingOrderRepository,
  isValidInternalOrderIdFormat,
  type PendingOrderRepository
} from "./pendingOrderRepository.ts";
import {
  extractPaddleWebhookIdentifiers,
  validateAndAssociatePaddleOrder
} from "./paymentOrderAssociation.ts";
import {
  createWebhookIdempotencyRepository,
  type WebhookIdempotencyRepository
} from "./webhookIdempotencyRepository.ts";
import type {
  OrderAssociationErrorCode,
  WebhookAdminAuth,
  WebhookFirestoreCollectionRef,
  WebhookFirestoreDb,
  WebhookFirestoreDocRef
} from "./webhookTypes.ts";

export type {
  WebhookFirestoreDocRef,
  WebhookFirestoreCollectionRef,
  WebhookFirestoreDb,
  WebhookAdminAuth
};

export interface PaymentWebhookProcessorDeps {
  adminDb: WebhookFirestoreDb;
  adminAuth: WebhookAdminAuth;
  /** Durable Firestore-backed idempotency repository (authority for SEC-01-FIX-06-R1) */
  idempotencyRepository?: WebhookIdempotencyRepository;
  /** Deprecated legacy prop kept only for backwards type compatibility in callers; ignored as authority */
  idempotency?: WebhookIdempotencyRegistry;
  pendingOrderRepository?: PendingOrderRepository;
}

export type PaddleWebhookProcessResult =
  | {
      statusCode: 200;
      body: {
        received: true;
        status?: "already_processed" | "pending";
        associated?: boolean;
        orderId?: string;
        providerTransactionId?: string;
        eventId?: string;
        userUid?: string;
        associationStatus?: "associated";
      };
    }
  | {
      statusCode: 400 | 403 | 404 | 409 | 422 | 500;
      body: {
        error: string;
        code?:
          | OrderAssociationErrorCode
          | "WEBHOOK_IN_PROGRESS"
          | "LEASE_CONFLICT"
          | "INTERNAL_PERSISTENCE_ERROR";
      };
    };

export interface PaymentWebhookProcessor {
  processVerifiedPaddleEvent(payload: Record<string, any>): Promise<PaddleWebhookProcessResult>;
}

export function createPaymentWebhookProcessor(
  deps: PaymentWebhookProcessorDeps
): PaymentWebhookProcessor {
  const idempotencyRepository =
    deps.idempotencyRepository ?? createWebhookIdempotencyRepository({ adminDb: deps.adminDb });
  const repository =
    deps.pendingOrderRepository ?? createPendingOrderRepository({ adminDb: deps.adminDb });

  return {
    async processVerifiedPaddleEvent(
      payload: Record<string, any>
    ): Promise<PaddleWebhookProcessResult> {
      // STEP 1 & 2: Receive authenticated event and extract identifiers
      const extracted = extractPaddleWebhookIdentifiers(payload);

      // STEP 3 & 4: Validate presence and distinctness of required identifiers
      // (before any idempotency or order Firestore read/write)
      if (!extracted.orderId) {
        return {
          statusCode: 400,
          body: {
            error: "Missing internal orderId in Paddle webhook custom_data",
            code: "MISSING_INTERNAL_ORDER_ID"
          }
        };
      }

      if (!isValidInternalOrderIdFormat(extracted.orderId)) {
        return {
          statusCode: 422,
          body: {
            error: `Invalid internal orderId format: '${extracted.orderId}'`,
            code: "INVALID_INTERNAL_ORDER_ID"
          }
        };
      }

      if (!extracted.providerTransactionId) {
        return {
          statusCode: 400,
          body: {
            error: "Missing external providerTransactionId in Paddle webhook payload",
            code: "MISSING_PROVIDER_TRANSACTION_ID"
          }
        };
      }

      if (!extracted.eventId) {
        return {
          statusCode: 400,
          body: {
            error: "Missing Paddle event_id in webhook payload",
            code: "MISSING_EVENT_ID"
          }
        };
      }

      if (
        extracted.eventId === extracted.providerTransactionId ||
        extracted.providerTransactionId === extracted.orderId ||
        extracted.eventId === extracted.orderId
      ) {
        return {
          statusCode: 422,
          body: {
            error:
              "Ambiguous identifiers: internal orderId, providerTransactionId, and eventId must be strictly distinct",
            code: "EVENT_ID_EQUALS_TRANSACTION_ID"
          }
        };
      }

      // STEP 5 & 6: Validate event type policy and refuse unauthorized events
      // BEFORE any Firestore idempotency read or write
      const policyCheck = evaluatePaddleEventPolicy(extracted.eventType);
      if (!policyCheck.allowed) {
        const deniedPolicy = policyCheck as Extract<typeof policyCheck, { allowed: false }>;
        return {
          statusCode: deniedPolicy.statusCode,
          body: {
            error: deniedPolicy.error,
            code: deniedPolicy.code
          }
        };
      }

      // STEP 7: Atomically acquire durable lease in Firestore (`payment_webhook_events`)
      let leaseAcquisition;
      try {
        leaseAcquisition = await idempotencyRepository.acquireEventLease({
          provider: "paddle",
          eventId: extracted.eventId,
          eventType: policyCheck.eventType
        });
      } catch (idempErr: any) {
        console.error(
          "[Webhook Paddle Durable Idempotency Error]:",
          idempErr?.message || idempErr
        );
        return {
          statusCode: 500,
          body: {
            error: "Failed to acquire durable webhook idempotency lease",
            code: "INTERNAL_PERSISTENCE_ERROR"
          }
        };
      }

      // STEP 8: If already_processed, return idempotent result without re-running business logic
      if (leaseAcquisition.outcome === "already_processed") {
        return {
          statusCode: 200,
          body: {
            received: true,
            status: "already_processed"
          }
        };
      }

      // STEP 9: If in_progress, return 409 conflict without executing business logic
      if (leaseAcquisition.outcome === "in_progress") {
        return {
          statusCode: 409,
          body: {
            error: "Webhook event currently in progress",
            code: "WEBHOOK_IN_PROGRESS"
          }
        };
      }

      const activeLeaseToken = leaseAcquisition.leaseToken;

      // STEP 10: If acquired, execute order validation and atomic lease-fenced association
      try {
        const associationResult = await validateAndAssociatePaddleOrder(payload, {
          repository,
          adminAuth: deps.adminAuth,
          leaseToken: activeLeaseToken,
          nowMs:
            typeof idempotencyRepository.getNowMs === "function"
              ? () => idempotencyRepository.getNowMs!()
              : undefined
        });

        // STEP 12: If association fails, record controlled failure in durable idempotency store
        if (!associationResult.ok) {
          const failedResult = associationResult as Extract<
            typeof associationResult,
            { ok: false }
          >;

          // SEC-01-FIX-06-R2 (B1): If association was rejected atomically due to LEASE_CONFLICT,
          // this worker no longer owns the active lease and must not mutate the event document.
          if (failedResult.code === "LEASE_CONFLICT") {
            return {
              statusCode: 409,
              body: {
                error: failedResult.error,
                code: "LEASE_CONFLICT"
              }
            };
          }

          try {
            await idempotencyRepository.failEventLease({
              provider: "paddle",
              eventId: extracted.eventId,
              leaseToken: activeLeaseToken,
              errorCode: failedResult.code
            });
          } catch (failLeaseErr: any) {
            console.error(
              "[Webhook Paddle Idempotency Fail-Lease Error]:",
              failLeaseErr?.message || failLeaseErr
            );
            return {
              statusCode: 500,
              body: {
                error: "Failed to persist webhook failure state",
                code: "INTERNAL_PERSISTENCE_ERROR"
              }
            };
          }

          return {
            statusCode: failedResult.statusCode,
            body: {
              error: failedResult.error,
              code: failedResult.code
            }
          };
        }

        const successResult = associationResult as Extract<
          typeof associationResult,
          { ok: true }
        >;

        // STEP 11: Finalize durable lease to "completed" while verifying leaseToken ownership
        const completionResult = await idempotencyRepository.completeEventLease({
          provider: "paddle",
          eventId: extracted.eventId,
          leaseToken: activeLeaseToken
        });

        if (!completionResult.ok) {
          const conflictResult = completionResult as Extract<
            typeof completionResult,
            { ok: false }
          >;
          return {
            statusCode: 409,
            body: {
              error: conflictResult.error,
              code: "LEASE_CONFLICT"
            }
          };
        }

        // STEP 13: Return HTTP 200 result
        return {
          statusCode: 200,
          body: {
            received: true,
            associated: true,
            orderId: successResult.identifiers.orderId,
            providerTransactionId: successResult.identifiers.providerTransactionId,
            eventId: successResult.identifiers.eventId,
            userUid: successResult.identifiers.userUid,
            status: "pending",
            associationStatus: "associated"
          }
        };
      } catch (innerErr: any) {
        try {
          await idempotencyRepository.failEventLease({
            provider: "paddle",
            eventId: extracted.eventId,
            leaseToken: activeLeaseToken,
            errorCode: "INTERNAL_PERSISTENCE_ERROR"
          });
        } catch {
          // If Firestore itself is unavailable, the lease will expire automatically
        }
        console.error(
          "[Webhook Paddle Association Error]:",
          innerErr?.message || innerErr
        );
        return {
          statusCode: 500,
          body: {
            error: "Failed to read or persist pending order association",
            code: "INTERNAL_PERSISTENCE_ERROR"
          }
        };
      }
    }
  };
}
