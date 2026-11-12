/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B / SEC-01-FIX-06-R2 — AUTHORITATIVE PENDING ORDER REPOSITORY (WITH ATOMIC LEASE FENCING)
 *
 * Responsibility:
 * - Authoritative server-side persistence and lookup of pending orders in the
 *   Zero-Trust Firestore collection `payment_transactions` (locked against client writes
 *   by `firestore.rules` FR-15: `allow create, update, delete: if false`).
 * - Generates unguessable server-side `orderId` values using `crypto.randomBytes`.
 * - Enforces atomic Firestore transaction fencing (`executeFencedOrderAssociationTransaction`)
 *   that reads both `payment_webhook_events` and `payment_transactions` in the same
 *   Firestore transaction, verifies active lease ownership (`status === "processing"`,
 *   matching `leaseToken`, non-expired `leaseExpiresAt`) and order invariants before
 *   committing the order-to-transaction association write.
 * - Contains zero HTTP route logic, zero Paddle signature verification rules, and zero in-memory fallback.
 */

import crypto from "node:crypto";
import type { PdiPaymentProvider } from "../../pdi/payment/pdiPaymentGateway.ts";
import {
  AUTHORITATIVE_PENDING_ORDER_COLLECTION,
  PAYMENT_WEBHOOK_EVENTS_COLLECTION,
  type AuthoritativePendingOrder,
  type CreateAuthoritativePendingOrderInput,
  type FencedOrderAssociationInput,
  type FencedOrderAssociationResult,
  type RecordOrderAssociationInput,
  type WebhookFirestoreDb,
  type WebhookFirestoreTransaction
} from "./webhookTypes.ts";

export interface PendingOrderRepository {
  createPendingOrder(input: CreateAuthoritativePendingOrderInput): Promise<AuthoritativePendingOrder>;
  getOrderById(orderId: string): Promise<AuthoritativePendingOrder | null>;
  findOrderByProviderTransactionId(
    provider: PdiPaymentProvider,
    providerTransactionId: string
  ): Promise<AuthoritativePendingOrder | null>;
  associateOrderWithLeaseFencing(
    input: FencedOrderAssociationInput
  ): Promise<FencedOrderAssociationResult>;
  recordOrderTransactionAssociation(
    input: RecordOrderAssociationInput
  ): Promise<AuthoritativePendingOrder>;
}

export interface PendingOrderRepositoryDeps {
  adminDb: WebhookFirestoreDb;
  nowMs?: () => number;
}

function extractNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Derives a deterministic, non-ambiguous Firestore document key from `provider` and `eventId`
 * using SHA-256 (`paddle_<64-char-sha256>`).
 * Never uses `providerTransactionId` as the idempotency key.
 */
export function deriveWebhookEventDocumentId(provider: "paddle", eventId: string): string {
  const cleanProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const cleanEventId = typeof eventId === "string" ? eventId.trim() : "";

  if (cleanProvider !== "paddle") {
    throw new Error(`Unsupported webhook provider for idempotency key: '${String(provider)}'`);
  }
  if (!cleanEventId) {
    throw new Error("Cannot derive webhook idempotency document key from an empty eventId.");
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${cleanProvider}:${cleanEventId}`, "utf8")
    .digest("hex");

  return `${cleanProvider}_${digest}`;
}

/**
 * Converts a stored Firestore Timestamp, Date, ISO string, or epoch millisecond value
 * into epoch milliseconds for deterministic lease expiration comparison inside transactions.
 */
export function parseFirestoreTimeMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof (value as any)?.toMillis === "function") {
    const ms = Number((value as any).toMillis());
    return Number.isFinite(ms) ? ms : null;
  }
  if (
    typeof value === "object" &&
    typeof (value as any).seconds === "number" &&
    Number.isFinite((value as any).seconds)
  ) {
    const nanos = typeof (value as any).nanoseconds === "number" ? (value as any).nanoseconds : 0;
    return (value as any).seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Generates an unguessable server-side internal order identifier.
 * Format: ORD_PADDLE_<32-hex> or ORD_SLICKPAY_<32-hex>.
 */
export function generateAuthoritativeOrderId(provider: PdiPaymentProvider): string {
  const prefix = provider === "slickpay_baridimob" ? "ORD_SLICKPAY" : "ORD_PADDLE";
  const entropy = crypto.randomBytes(16).toString("hex").toUpperCase();
  return `${prefix}_${entropy}`;
}

/**
 * Validates that an internal order identifier has a well-formed server-issued structure
 * (`ORD_PADDLE_...` or `ORD_SLICKPAY_...`) and is never a client-generated `TX_...` / `DEMO_...`
 * or raw Paddle notification/transaction/checkout identifier (`evt_`, `txn_`, `chk_`, `sub_`).
 */
export function isValidInternalOrderIdFormat(orderId: unknown): orderId is string {
  if (typeof orderId !== "string") return false;
  const trimmed = orderId.trim();
  if (trimmed.length < 12 || trimmed.length > 128) return false;
  if (!/^ORD_(PADDLE|SLICKPAY)_[A-Za-z0-9_-]{1,110}$/.test(trimmed)) return false;
  return true;
}

function isSnapshotExisting(snap: { exists: boolean | (() => boolean) } | null | undefined): boolean {
  if (!snap) return false;
  if (typeof snap.exists === "function") {
    return Boolean(snap.exists());
  }
  return Boolean(snap.exists);
}

/**
 * SEC-01-FIX-06-R2 (Section 4 — B1):
 * Dedicated atomic Firestore transaction that fences order-to-transaction association
 * on active webhook lease ownership at the exact point of write.
 *
 * Mandatory guarantees inside a single `adminDb.runTransaction`:
 * 1. Receives provider, eventId, leaseToken, and orderId.
 * 2. Opens a Firestore Admin transaction.
 * 3. Reads `payment_webhook_events` document FIRST.
 * 4. Reads `payment_transactions` document SECOND (all reads strictly precede writes).
 * 5. Verifies lease ownership: document exists, `status === "processing"`, non-empty
 *    `leaseToken` matches `input.leaseToken`, and `leaseExpiresAt > currentTimeMs`.
 * 6. Verifies order identity, owner UID, provider, transaction ID consistency, and status.
 * 7. Handles identical existing association idempotently without contradictory writes.
 * 8. Writes the association ONLY if every lease and order condition is satisfied.
 */
export async function executeFencedOrderAssociationTransaction(
  adminDb: WebhookFirestoreDb,
  input: FencedOrderAssociationInput,
  options?: { nowMs?: () => number }
): Promise<FencedOrderAssociationResult> {
  if (!adminDb || typeof adminDb.runTransaction !== "function") {
    throw new Error(
      "Firestore Admin transaction support (adminDb.runTransaction) is required for fenced order association."
    );
  }

  const provider = input.provider;
  const eventId = extractNonEmptyString(input.eventId);
  const leaseToken = extractNonEmptyString(input.leaseToken);
  const orderId = extractNonEmptyString(input.orderId);
  const expectedUserUid = extractNonEmptyString(input.userUid);
  const providerTransactionId = extractNonEmptyString(input.providerTransactionId);
  const eventType = extractNonEmptyString(input.eventType) ?? "transaction.completed";

  if (provider !== "paddle") {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_PROVIDER_MISMATCH",
      error: `Order provider '${String(provider)}' does not allow Paddle webhook processing`
    };
  }

  if (!eventId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_EVENT_ID",
      error: "Missing Paddle event_id in webhook payload"
    };
  }

  if (!orderId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_INTERNAL_ORDER_ID",
      error: "Missing internal orderId in Paddle webhook custom_data"
    };
  }

  if (!isValidInternalOrderIdFormat(orderId)) {
    return {
      ok: false,
      statusCode: 422,
      code: "INVALID_INTERNAL_ORDER_ID",
      error: `Invalid internal orderId format: '${orderId}'`
    };
  }

  if (!providerTransactionId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_PROVIDER_TRANSACTION_ID",
      error: "Missing external providerTransactionId in Paddle webhook payload"
    };
  }

  const eventDocId = deriveWebhookEventDocumentId("paddle", eventId);
  const eventDocRef = adminDb.collection(PAYMENT_WEBHOOK_EVENTS_COLLECTION).doc(eventDocId);
  const orderDocRef = adminDb.collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION).doc(orderId);
  const resolveNowMs = input.nowMs ?? options?.nowMs ?? (() => Date.now());

  return adminDb.runTransaction(
    async (tx: WebhookFirestoreTransaction): Promise<FencedOrderAssociationResult> => {
      // ALL Firestore reads MUST precede writes inside the transaction
      const eventSnap = await tx.get(eventDocRef);
      const orderSnap = await tx.get(orderDocRef);

      const currentTimeMs = resolveNowMs();

      // 1. Verify webhook event lease document existence
      if (!isSnapshotExisting(eventSnap)) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Cannot associate order '${orderId}': webhook event '${eventId}' lease document does not exist.`
        };
      }

      const rawEventData = eventSnap.data() || {};
      const storedEventProvider = extractNonEmptyString(rawEventData.provider);
      const storedEventId = extractNonEmptyString(rawEventData.eventId);
      const storedEventStatus = extractNonEmptyString(rawEventData.status);
      const storedLeaseToken = extractNonEmptyString(rawEventData.leaseToken);
      const leaseExpiresMs = parseFirestoreTimeMs(rawEventData.leaseExpiresAt);

      // 2. Verify event identity, status === "processing", leaseToken presence & match, and non-expiration
      if (storedEventProvider !== "paddle" || storedEventId !== eventId) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Webhook event document identity mismatch for event '${eventId}'.`
        };
      }

      if (storedEventStatus !== "processing") {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Webhook event '${eventId}' is in status '${String(storedEventStatus)}' (expected 'processing').`
        };
      }

      if (!leaseToken || !storedLeaseToken || storedLeaseToken !== leaseToken) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Lease conflict for webhook event '${eventId}': worker does not hold the active lease token.`
        };
      }

      if (leaseExpiresMs === null || leaseExpiresMs <= currentTimeMs) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Lease conflict for webhook event '${eventId}': lease has expired prior to order association write.`
        };
      }

      // 3. Verify payment order document existence and internal ID integrity
      if (!isSnapshotExisting(orderSnap)) {
        return {
          ok: false,
          statusCode: 404,
          code: "ORDER_NOT_FOUND",
          error: `Pending order '${orderId}' not found in authoritative repository`
        };
      }

      const rawOrderData = orderSnap.data();
      if (!rawOrderData || typeof rawOrderData !== "object") {
        return {
          ok: false,
          statusCode: 404,
          code: "ORDER_NOT_FOUND",
          error: `Pending order '${orderId}' not found in authoritative repository`
        };
      }

      const existingOrder = {
        ...rawOrderData,
        id: (rawOrderData.id as string) ?? orderSnap.id ?? orderId
      } as AuthoritativePendingOrder;

      const storedId = extractNonEmptyString(existingOrder.id);
      const storedOrderId = extractNonEmptyString(existingOrder.orderId) ?? storedId;
      if (
        !storedId ||
        !storedOrderId ||
        storedId !== storedOrderId ||
        storedId !== orderId ||
        !isValidInternalOrderIdFormat(storedId)
      ) {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_INVALID_ID",
          error: "Stored order document has an invalid or inconsistent internal orderId"
        };
      }

      // 4. Verify owner UID and payment provider integrity
      const rawUserId = extractNonEmptyString(existingOrder.userId);
      const rawUserUid = extractNonEmptyString(existingOrder.userUid);
      if (rawUserId && rawUserUid && rawUserId !== rawUserUid) {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_USER_MISMATCH",
          error: "Stored order document has conflicting userId and userUid fields"
        };
      }

      const authoritativeUserUid = rawUserUid ?? rawUserId;
      if (!authoritativeUserUid) {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_MISSING_UID",
          error: "Pending order is missing authoritative owner userUid"
        };
      }

      if (
        (expectedUserUid && expectedUserUid !== authoritativeUserUid) ||
        (input.customDataUserUid && input.customDataUserUid !== authoritativeUserUid)
      ) {
        return {
          ok: false,
          statusCode: 403,
          code: "ORDER_USER_MISMATCH",
          error: "Order belongs to another userUid and cannot be reassigned"
        };
      }

      if (existingOrder.provider !== "paddle") {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_PROVIDER_MISMATCH",
          error: `Order provider '${String(existingOrder.provider)}' does not allow Paddle webhook processing`
        };
      }

      // 5. Verify transaction ID consistency and order status
      const expectedOrExistingTxId =
        extractNonEmptyString(existingOrder.providerTransactionId) ??
        extractNonEmptyString(existingOrder.paddleDetails?.paddleOrderId);

      if (expectedOrExistingTxId && expectedOrExistingTxId !== providerTransactionId) {
        return {
          ok: false,
          statusCode: 409,
          code: "PROVIDER_TRANSACTION_ID_MISMATCH",
          error: `Incoming providerTransactionId '${providerTransactionId}' does not match order transaction '${expectedOrExistingTxId}'`
        };
      }

      if (existingOrder.status !== "pending") {
        return {
          ok: false,
          statusCode: 409,
          code: "ORDER_INVALID_STATUS",
          error: `Order state (status='${String(existingOrder.status)}', associationStatus='${String(existingOrder.associationStatus || "unassociated")}') does not allow new payment association`
        };
      }

      // 6. Handle idempotent recovery if already associated for the exact same event and transaction
      const isAlreadyAssociatedForExactSameEvent =
        existingOrder.associationStatus === "associated" &&
        expectedOrExistingTxId === providerTransactionId &&
        extractNonEmptyString(existingOrder.lastEventId) === eventId &&
        existingOrder.provider === "paddle" &&
        (!expectedUserUid || authoritativeUserUid === expectedUserUid);

      if (existingOrder.associationStatus === "associated") {
        if (isAlreadyAssociatedForExactSameEvent) {
          return {
            ok: true,
            statusCode: 200,
            alreadyAssociatedForSameEvent: true,
            order: existingOrder
          };
        }
        return {
          ok: false,
          statusCode: 409,
          code: "ORDER_INVALID_STATUS",
          error: `Order state (status='${String(existingOrder.status)}', associationStatus='${String(existingOrder.associationStatus || "unassociated")}') does not allow new payment association`
        };
      }

      // 7. Write association atomically inside the same Firestore transaction
      const nowIso = input.associatedAt || new Date(currentTimeMs).toISOString();
      const existingPaddleDetails =
        existingOrder.paddleDetails && typeof existingOrder.paddleDetails === "object"
          ? existingOrder.paddleDetails
          : { checkoutId: input.checkoutId || "" };

      const updatedFields: Partial<AuthoritativePendingOrder> & Record<string, unknown> = {
        id: orderId,
        orderId,
        userId: authoritativeUserUid,
        userUid: authoritativeUserUid,
        provider: "paddle",
        // SEC-01-FIX-05-B Section 7: Order remains "pending" with associationStatus: "associated"
        status: "pending",
        associationStatus: "associated",
        providerTransactionId,
        lastEventId: eventId,
        lastEventType: eventType,
        associatedAt: nowIso,
        updatedAt: nowIso,
        paddleDetails: {
          ...existingPaddleDetails,
          checkoutId: input.checkoutId || existingPaddleDetails.checkoutId || "",
          paddleOrderId: providerTransactionId,
          ...(input.webhookCustomerEmail
            ? { customerEmail: input.webhookCustomerEmail.toLowerCase() }
            : {})
        }
      };

      await Promise.resolve(tx.set(orderDocRef, updatedFields, { merge: true }));

      const updatedOrder: AuthoritativePendingOrder = {
        ...existingOrder,
        ...updatedFields
      };

      return {
        ok: true,
        statusCode: 200,
        alreadyAssociatedForSameEvent: false,
        order: updatedOrder
      };
    }
  );
}

export function createPendingOrderRepository(
  deps: PendingOrderRepositoryDeps
): PendingOrderRepository {
  const defaultNowMs = deps.nowMs ?? (() => Date.now());

  return {
    async createPendingOrder(
      input: CreateAuthoritativePendingOrderInput
    ): Promise<AuthoritativePendingOrder> {
      const uid = typeof input.verifiedUserUid === "string" ? input.verifiedUserUid.trim() : "";
      if (!uid) {
        throw new Error("Cannot create authoritative pending order without a verified Firebase userUid.");
      }

      const email =
        typeof input.verifiedUserEmail === "string"
          ? input.verifiedUserEmail.trim().toLowerCase()
          : "";
      if (!email) {
        throw new Error("Cannot create authoritative pending order without a verified userEmail.");
      }

      if (input.provider !== "paddle" && input.provider !== "slickpay_baridimob") {
        throw new Error(`Unsupported payment provider: ${String(input.provider)}`);
      }

      const orderId = generateAuthoritativeOrderId(input.provider);
      const nowIso = new Date(defaultNowMs()).toISOString();

      const pendingOrder: AuthoritativePendingOrder = {
        id: orderId,
        orderId,
        userId: uid,
        userUid: uid,
        userEmail: email,
        userName: (input.userName || email.split("@")[0] || "Client PD&I").trim(),
        company: input.company ? input.company.trim() : "",
        country: input.country || (input.provider === "slickpay_baridimob" ? "Algérie" : "International"),
        countryCode: (input.countryCode || (input.provider === "slickpay_baridimob" ? "DZ" : "FR")).toUpperCase(),
        city: input.city || "",
        plan: input.plan,
        accountType: input.plan,
        billingCycle: input.billingCycle,
        amount: input.amount,
        currency: input.currency,
        provider: input.provider,
        status: "pending",
        associationStatus: "unassociated",
        ...(input.expectedProviderTransactionId
          ? { providerTransactionId: input.expectedProviderTransactionId.trim() }
          : {}),
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await deps.adminDb
        .collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION)
        .doc(orderId)
        .set(pendingOrder as unknown as Record<string, unknown>);

      return pendingOrder;
    },

    async getOrderById(orderId: string): Promise<AuthoritativePendingOrder | null> {
      const trimmedId = typeof orderId === "string" ? orderId.trim() : "";
      if (!trimmedId) return null;

      const docRef = deps.adminDb
        .collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION)
        .doc(trimmedId);

      if (typeof docRef.get !== "function") {
        return null;
      }

      const snap = await docRef.get();
      if (!isSnapshotExisting(snap)) {
        return null;
      }

      const rawData = snap.data();
      if (!rawData || typeof rawData !== "object") {
        return null;
      }

      const order = {
        ...rawData,
        id: (rawData.id as string) ?? snap.id ?? trimmedId
      } as AuthoritativePendingOrder;

      return order;
    },

    async findOrderByProviderTransactionId(
      provider: PdiPaymentProvider,
      providerTransactionId: string
    ): Promise<AuthoritativePendingOrder | null> {
      const trimmedTxId =
        typeof providerTransactionId === "string" ? providerTransactionId.trim() : "";
      if (!trimmedTxId) return null;

      const colRef = deps.adminDb.collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION);
      if (typeof colRef.where === "function") {
        const querySnap = await colRef
          .where("providerTransactionId", "==", trimmedTxId)
          .get();

        const matchedDocs: Array<{ id: string; data(): Record<string, unknown> }> = [];
        if (Array.isArray(querySnap?.docs)) {
          matchedDocs.push(...querySnap.docs);
        } else if (typeof querySnap?.forEach === "function") {
          querySnap.forEach((d) => matchedDocs.push(d));
        }

        for (const docItem of matchedDocs) {
          const data = docItem.data();
          if (data && data.provider === provider) {
            return {
              ...data,
              id: (data.id as string) || docItem.id,
              orderId: (data.orderId as string) || (data.id as string) || docItem.id
            } as AuthoritativePendingOrder;
          }
        }
      }

      return null;
    },

    async associateOrderWithLeaseFencing(
      input: FencedOrderAssociationInput
    ): Promise<FencedOrderAssociationResult> {
      return executeFencedOrderAssociationTransaction(deps.adminDb, input, {
        nowMs: input.nowMs ?? defaultNowMs
      });
    },

    async recordOrderTransactionAssociation(
      input: RecordOrderAssociationInput
    ): Promise<AuthoritativePendingOrder> {
      const fencedResult = await this.associateOrderWithLeaseFencing({
        provider: input.provider,
        eventId: input.eventId,
        leaseToken: input.leaseToken,
        orderId: input.orderId,
        userUid: input.userUid,
        providerTransactionId: input.providerTransactionId,
        eventType: input.eventType,
        customDataUserUid: input.customDataUserUid,
        checkoutId: input.checkoutId,
        webhookCustomerEmail: input.webhookCustomerEmail,
        associatedAt: input.associatedAt,
        nowMs: input.nowMs ?? defaultNowMs
      });

      if (fencedResult.ok === false) {
        const err: Error & { code?: string; statusCode?: number } = new Error(fencedResult.error);
        err.code = fencedResult.code;
        err.statusCode = fencedResult.statusCode;
        throw err;
      }

      return fencedResult.order;
    }
  };
}

