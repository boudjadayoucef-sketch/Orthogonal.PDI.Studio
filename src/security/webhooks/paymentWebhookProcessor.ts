/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B-R1 — PAYMENT WEBHOOK BUSINESS PROCESSOR
 *
 * Responsibility:
 * - Orchestrates post-authentication Paddle webhook processing by delegating order lookup
 *   to `PendingOrderRepository`, event policy evaluation to `evaluatePaddleEventPolicy`,
 *   and association validation to `validateAndAssociatePaddleOrder`.
 * - Enforces event-level idempotency via `WebhookIdempotencyRegistry` for valid association events.
 * - Never creates arbitrary orders from webhook data, never resolves users by webhook email,
 *   and never activates subscriptions or Custom Claims in SEC-01-FIX-05-B-R1.
 */

import {
  WebhookIdempotencyRegistry,
  globalWebhookIdempotency
} from "../sec01SecurityService.ts";
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
        code?: OrderAssociationErrorCode | "WEBHOOK_IN_PROGRESS" | "INTERNAL_PERSISTENCE_ERROR";
      };
    };

export interface PaymentWebhookProcessor {
  processVerifiedPaddleEvent(payload: Record<string, any>): Promise<PaddleWebhookProcessResult>;
}

export function createPaymentWebhookProcessor(
  deps: PaymentWebhookProcessorDeps
): PaymentWebhookProcessor {
  const idempotency = deps.idempotency ?? globalWebhookIdempotency;
  const repository =
    deps.pendingOrderRepository ?? createPendingOrderRepository({ adminDb: deps.adminDb });

  return {
    async processVerifiedPaddleEvent(
      payload: Record<string, any>
    ): Promise<PaddleWebhookProcessResult> {
      const extracted = extractPaddleWebhookIdentifiers(payload);
      const policyCheck = evaluatePaddleEventPolicy(extracted.eventType);

      const eventKey =
        policyCheck.allowed &&
        extracted.eventId &&
        extracted.orderId &&
        isValidInternalOrderIdFormat(extracted.orderId) &&
        extracted.providerTransactionId &&
        extracted.eventId !== extracted.providerTransactionId &&
        extracted.providerTransactionId !== extracted.orderId &&
        extracted.eventId !== extracted.orderId
          ? `paddle_evt_${extracted.eventId}`
          : null;

      if (eventKey) {
        if (idempotency.isProcessed(eventKey)) {
          return {
            statusCode: 200,
            body: { received: true, status: "already_processed" }
          };
        }
        if (!idempotency.markInProgress(eventKey)) {
          return {
            statusCode: 409,
            body: {
              error: "Webhook event currently in progress",
              code: "WEBHOOK_IN_PROGRESS"
            }
          };
        }
      }

      try {
        const associationResult = await validateAndAssociatePaddleOrder(payload, {
          repository,
          adminAuth: deps.adminAuth
        });

        if (!associationResult.ok) {
          const failedResult = associationResult as Extract<
            typeof associationResult,
            { ok: false }
          >;
          if (eventKey) {
            idempotency.releaseInProgress(eventKey);
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

        if (eventKey) {
          idempotency.markCompleted(eventKey);
        }

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
        if (eventKey) {
          idempotency.releaseInProgress(eventKey);
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
