/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B — AUTHORITATIVE PENDING ORDER REPOSITORY
 *
 * Responsibility:
 * - Authoritative server-side persistence and lookup of pending orders in the
 *   Zero-Trust Firestore collection `payment_transactions` (locked against client writes
 *   by `firestore.rules` FR-15: `allow create, update, delete: if false`).
 * - Generates unguessable server-side `orderId` values using `crypto.randomBytes`.
 * - Tracks and queries `providerTransactionId` bindings to prevent associating a single
 *   external transaction with multiple internal orders.
 * - Contains zero HTTP route logic and zero Paddle signature verification rules.
 */

import crypto from "node:crypto";
import type { PdiPaymentProvider } from "../../pdi/payment/pdiPaymentGateway.ts";
import {
  AUTHORITATIVE_PENDING_ORDER_COLLECTION,
  type AuthoritativePendingOrder,
  type CreateAuthoritativePendingOrderInput,
  type RecordOrderAssociationInput,
  type WebhookFirestoreDb
} from "./webhookTypes.ts";

export interface PendingOrderRepository {
  createPendingOrder(input: CreateAuthoritativePendingOrderInput): Promise<AuthoritativePendingOrder>;
  getOrderById(orderId: string): Promise<AuthoritativePendingOrder | null>;
  findOrderByProviderTransactionId(
    provider: PdiPaymentProvider,
    providerTransactionId: string
  ): Promise<AuthoritativePendingOrder | null>;
  recordOrderTransactionAssociation(
    input: RecordOrderAssociationInput
  ): Promise<AuthoritativePendingOrder>;
}

export interface PendingOrderRepositoryDeps {
  adminDb: WebhookFirestoreDb;
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

export function createPendingOrderRepository(
  deps: PendingOrderRepositoryDeps
): PendingOrderRepository {
  // In-memory index of known providerTransactionId -> orderId associations observed by this
  // repository instance, complementing Firestore `.where()` queries for deterministic detection.
  const knownTxToOrderMap = new Map<string, AuthoritativePendingOrder>();

  const indexOrderIfAssociated = (order: AuthoritativePendingOrder | null) => {
    if (!order) return;
    const txId = (order.providerTransactionId || order.paddleDetails?.paddleOrderId || "").trim();
    if (txId && order.provider) {
      const key = `${order.provider}:${txId}`;
      if (!knownTxToOrderMap.has(key)) {
        knownTxToOrderMap.set(key, order);
      }
    }
  };

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
      const nowIso = new Date().toISOString();

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

      indexOrderIfAssociated(pendingOrder);
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

      indexOrderIfAssociated(order);
      return order;
    },

    async findOrderByProviderTransactionId(
      provider: PdiPaymentProvider,
      providerTransactionId: string
    ): Promise<AuthoritativePendingOrder | null> {
      const trimmedTxId =
        typeof providerTransactionId === "string" ? providerTransactionId.trim() : "";
      if (!trimmedTxId) return null;

      const cacheKey = `${provider}:${trimmedTxId}`;
      const cached = knownTxToOrderMap.get(cacheKey);
      if (cached) {
        return cached;
      }

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
            const foundOrder = {
              ...data,
              id: (data.id as string) || docItem.id,
              orderId: (data.orderId as string) || (data.id as string) || docItem.id
            } as AuthoritativePendingOrder;
            knownTxToOrderMap.set(cacheKey, foundOrder);
            return foundOrder;
          }
        }
      }

      return null;
    },

    async recordOrderTransactionAssociation(
      input: RecordOrderAssociationInput
    ): Promise<AuthoritativePendingOrder> {
      const nowIso = input.associatedAt || new Date().toISOString();
      const existing = await this.getOrderById(input.orderId);
      if (!existing) {
        throw new Error(`Cannot record association for non-existent order '${input.orderId}'.`);
      }

      const existingPaddleDetails =
        existing.paddleDetails && typeof existing.paddleDetails === "object"
          ? existing.paddleDetails
          : { checkoutId: input.checkoutId || "" };

      const updatedFields: Partial<AuthoritativePendingOrder> & Record<string, unknown> = {
        id: input.orderId,
        orderId: input.orderId,
        userId: input.userUid,
        userUid: input.userUid,
        provider: input.provider,
        // SEC-01-FIX-05-B Section 7: Do NOT mark the order as "completed" or "paid" in FIX-05-B.
        // Order remains "pending" with associationStatus: "associated" until commercial validation in FIX-05-C.
        status: "pending",
        associationStatus: "associated",
        providerTransactionId: input.providerTransactionId,
        lastEventId: input.eventId,
        lastEventType: input.eventType,
        associatedAt: nowIso,
        updatedAt: nowIso,
        paddleDetails: {
          ...existingPaddleDetails,
          checkoutId: input.checkoutId || existingPaddleDetails.checkoutId || "",
          paddleOrderId: input.providerTransactionId,
          ...(input.webhookCustomerEmail
            ? { customerEmail: input.webhookCustomerEmail.toLowerCase() }
            : {})
        }
      };

      await deps.adminDb
        .collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION)
        .doc(input.orderId)
        .set(updatedFields, { merge: true });

      const updatedOrder: AuthoritativePendingOrder = {
        ...existing,
        ...updatedFields
      };

      knownTxToOrderMap.set(`${input.provider}:${input.providerTransactionId}`, updatedOrder);
      return updatedOrder;
    }
  };
}
