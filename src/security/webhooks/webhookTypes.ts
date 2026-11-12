/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B-R1 — SHARED WEBHOOK & PENDING ORDER ASSOCIATION TYPES
 *
 * Responsibility:
 * - Defines pure TypeScript interfaces for authoritative pending orders,
 *   Firestore/Auth injectable contracts, extracted Paddle webhook identifiers,
 *   and order-to-transaction association results.
 * - Contains zero business logic, zero HTTP logic, and zero Firebase global state.
 */

import type { PdiAccountType, PdiSubscriptionPlan } from "../../lib/firebase.ts";
import type { PdiPaymentProvider, PdiPaymentTransaction } from "../../pdi/payment/pdiPaymentGateway.ts";

export const AUTHORITATIVE_PENDING_ORDER_COLLECTION = "payment_transactions" as const;

export const PAYMENT_WEBHOOK_EVENTS_COLLECTION = "payment_webhook_events" as const;

export interface WebhookFirestoreDocSnapshot {
  exists: boolean | (() => boolean);
  id?: string;
  data(): Record<string, unknown> | undefined;
}

export interface WebhookFirestoreDocRef {
  id?: string;
  path?: string;
  get?(): Promise<WebhookFirestoreDocSnapshot>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
}

export interface WebhookFirestoreTransaction {
  get(docRef: WebhookFirestoreDocRef): Promise<WebhookFirestoreDocSnapshot>;
  set(
    docRef: WebhookFirestoreDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean }
  ): WebhookFirestoreTransaction | unknown;
  update?(docRef: WebhookFirestoreDocRef, data: Record<string, unknown>): WebhookFirestoreTransaction | unknown;
}

export interface WebhookFirestoreQuerySnapshot {
  empty?: boolean;
  docs?: Array<{
    id: string;
    data(): Record<string, unknown>;
  }>;
  forEach?(callback: (doc: { id: string; data(): Record<string, unknown> }) => void): void;
}

export interface WebhookFirestoreQuery {
  get(): Promise<WebhookFirestoreQuerySnapshot>;
}

export interface WebhookFirestoreCollectionRef {
  doc(id: string): WebhookFirestoreDocRef;
  where?(field: string, op: "==", value: unknown): WebhookFirestoreQuery;
}

export interface WebhookFirestoreDb {
  collection(name: string): WebhookFirestoreCollectionRef;
  runTransaction?<T>(
    updateFunction: (transaction: WebhookFirestoreTransaction) => Promise<T>
  ): Promise<T>;
}

export interface WebhookVerifiedUserRecord {
  uid: string;
  email?: string;
  disabled?: boolean;
}

export interface WebhookAdminAuth {
  getUser(uid: string): Promise<WebhookVerifiedUserRecord | null | undefined>;
  getUserByEmail?(email: string): Promise<{ uid?: string } | null | undefined>;
  setCustomUserClaims?(uid: string, claims: Record<string, unknown>): Promise<unknown>;
}

export type WebhookIdempotencyEventStatus = "processing" | "completed" | "failed";

export interface WebhookIdempotencyEventRecord {
  provider: "paddle";
  eventId: string;
  eventType: string;
  status: WebhookIdempotencyEventStatus;
  attemptCount: number;
  createdAt: unknown;
  updatedAt: unknown;
  leaseExpiresAt: unknown | null;
  leaseToken: string | null;
  completedAt?: unknown | null;
  lastErrorCode?: string | null;
}

export interface AcquireWebhookEventLeaseInput {
  provider: "paddle";
  eventId: string;
  eventType: string;
  leaseDurationMs?: number;
}

export type AcquireWebhookEventLeaseResult =
  | {
      outcome: "acquired";
      documentId: string;
      leaseToken: string;
      attemptCount: number;
      record: WebhookIdempotencyEventRecord;
    }
  | {
      outcome: "already_processed";
      documentId: string;
      record: WebhookIdempotencyEventRecord;
    }
  | {
      outcome: "in_progress";
      documentId: string;
      record: WebhookIdempotencyEventRecord;
    };

export interface CompleteWebhookEventLeaseInput {
  provider: "paddle";
  eventId: string;
  leaseToken: string;
}

export type CompleteWebhookEventLeaseResult =
  | {
      ok: true;
      documentId: string;
      record: WebhookIdempotencyEventRecord;
    }
  | {
      ok: false;
      code: "LEASE_CONFLICT" | "EVENT_NOT_FOUND";
      error: string;
    };

export interface FailWebhookEventLeaseInput {
  provider: "paddle";
  eventId: string;
  leaseToken: string;
  errorCode: string;
}

export type FailWebhookEventLeaseResult =
  | {
      ok: true;
      documentId: string;
      record: WebhookIdempotencyEventRecord;
    }
  | {
      ok: false;
      code: "LEASE_CONFLICT" | "EVENT_NOT_FOUND";
      error: string;
    };

export interface AuthoritativePendingOrder extends PdiPaymentTransaction {
  id: string;
  orderId: string;
  userId: string;
  userUid: string;
  accountType: PdiAccountType;
  provider: PdiPaymentProvider;
  status: "pending" | "completed" | "failed" | "refunded";
  associationStatus?: "unassociated" | "associated";
  providerTransactionId?: string;
  lastEventId?: string;
  lastEventType?: string;
  associatedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAuthoritativePendingOrderInput {
  /** Must come exclusively from server-verified Firebase Auth token (req.user.uid) */
  verifiedUserUid: string;
  verifiedUserEmail: string;
  userName?: string;
  company?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  plan: PdiAccountType;
  billingCycle: PdiSubscriptionPlan;
  amount: number;
  currency: "DZD" | "EUR" | "USD";
  provider: PdiPaymentProvider;
  expectedProviderTransactionId?: string;
}

export interface RecordOrderAssociationInput {
  orderId: string;
  userUid: string;
  provider: "paddle";
  providerTransactionId: string;
  eventId: string;
  eventType: string;
  /** Unique lease token held by the current worker in `payment_webhook_events` (SEC-01-FIX-06-R2 B1) */
  leaseToken?: string;
  customDataUserUid?: string;
  checkoutId?: string;
  webhookCustomerEmail?: string;
  associatedAt?: string;
  nowMs?: () => number;
}

export interface FencedOrderAssociationInput {
  provider: "paddle";
  eventId: string;
  leaseToken: string | undefined;
  orderId: string;
  userUid: string;
  providerTransactionId: string;
  eventType: string;
  customDataUserUid?: string;
  checkoutId?: string;
  webhookCustomerEmail?: string;
  associatedAt?: string;
  nowMs?: () => number;
}

export type FencedOrderAssociationResult =
  | {
      ok: true;
      statusCode: 200;
      alreadyAssociatedForSameEvent: boolean;
      order: AuthoritativePendingOrder;
    }
  | {
      ok: false;
      statusCode: 400 | 403 | 404 | 409 | 422;
      code: OrderAssociationErrorCode;
      error: string;
    };

export interface ExtractedPaddleWebhookIdentifiers {
  /** Internal pending order ID passed in checkout custom_data (NEVER fallback to event_id, data.id, checkout_id, or order_id) */
  orderId: string | undefined;
  /** External Paddle transaction ID from data.id or transaction_id (NEVER fallback to event_id or checkout_id) */
  providerTransactionId: string | undefined;
  /** Paddle notification/event ID from event_id or alert_id */
  eventId: string | undefined;
  /** Paddle event type (undefined when missing from payload) */
  eventType: string | undefined;
  /** Optional Paddle checkout session ID */
  checkoutId: string | undefined;
  /** Optional userUid carried in custom_data (used ONLY to detect cross-user order tampering, never as authority) */
  customDataUserUid: string | undefined;
  /** Untrusted email from webhook payload (logged/retained for audit only, never used for user attribution) */
  untrustedWebhookEmail: string | undefined;
  /** Untrusted UID from webhook payload (ignored for attribution) */
  untrustedWebhookUid: string | undefined;
}

export type OrderAssociationErrorCode =
  | "MISSING_INTERNAL_ORDER_ID"
  | "INVALID_INTERNAL_ORDER_ID"
  | "MISSING_PROVIDER_TRANSACTION_ID"
  | "MISSING_EVENT_ID"
  | "EVENT_ID_EQUALS_TRANSACTION_ID"
  | "MISSING_EVENT_TYPE"
  | "UNSUPPORTED_OR_EARLY_EVENT_TYPE"
  | "ORDER_NOT_FOUND"
  | "ORDER_INVALID_ID"
  | "ORDER_MISSING_UID"
  | "ORDER_USER_MISMATCH"
  | "ORDER_PROVIDER_MISMATCH"
  | "ORDER_INVALID_STATUS"
  | "PROVIDER_TRANSACTION_ID_MISMATCH"
  | "TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER"
  | "USER_IDENTITY_NOT_FOUND"
  | "LEASE_CONFLICT";

export type OrderAssociationValidationResult =
  | {
      ok: true;
      statusCode: 200;
      alreadyAssociatedForSameEvent?: boolean;
      order: AuthoritativePendingOrder;
      identifiers: {
        orderId: string;
        providerTransactionId: string;
        eventId: string;
        eventType: string;
        userUid: string;
      };
    }
  | {
      ok: false;
      statusCode: 400 | 403 | 404 | 409 | 422;
      code: OrderAssociationErrorCode;
      error: string;
    };

