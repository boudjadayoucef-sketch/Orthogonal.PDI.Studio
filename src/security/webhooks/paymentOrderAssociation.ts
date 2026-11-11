/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B — PENDING ORDER & PADDLE TRANSACTION ASSOCIATION SERVICE
 *
 * Responsibility:
 * - Explicitly separates internal `orderId`, external `providerTransactionId`, and Paddle `eventId`.
 * - Never accepts `checkout_id`, `data.id`, `order_id`, or `event_id` as interchangeable substitutes
 *   for the internal pending `orderId`.
 * - Enforces all order, transaction, and user identity invariants (UID from authoritative order,
 *   never from webhook email or arbitrary webhook UID).
 * - Persists the validated association via `PendingOrderRepository` without performing any
 *   license or subscription activation (deferred to SEC-01-FIX-05-C).
 */

import {
  isValidInternalOrderIdFormat,
  type PendingOrderRepository
} from "./pendingOrderRepository.ts";
import type {
  ExtractedPaddleWebhookIdentifiers,
  OrderAssociationValidationResult,
  WebhookAdminAuth
} from "./webhookTypes.ts";

export interface PaymentOrderAssociationDeps {
  repository: PendingOrderRepository;
  adminAuth: WebhookAdminAuth;
}

function extractNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extracts and strictly separates:
 * 1. `orderId` (internal pending order ID from `custom_data.orderId` / `data.custom_data.orderId`)
 * 2. `providerTransactionId` (Paddle transaction ID from `data.id` or `transaction_id` / `provider_transaction_id`)
 * 3. `eventId` (Paddle webhook notification ID from `event_id` / `notification_id` / `alert_id`)
 *
 * Never uses `checkout_id`, `data.id`, `order_id`, or `event_id` as a fallback for `orderId`.
 */
export function extractPaddleWebhookIdentifiers(
  payload: Record<string, any> | null | undefined
): ExtractedPaddleWebhookIdentifiers {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const dataObj =
    safePayload.data && typeof safePayload.data === "object" ? safePayload.data : {};
  const dataCustomData =
    dataObj.custom_data && typeof dataObj.custom_data === "object" ? dataObj.custom_data : {};
  const rootCustomData =
    safePayload.custom_data && typeof safePayload.custom_data === "object"
      ? safePayload.custom_data
      : {};

  // 1. Internal orderId: ONLY from explicit custom_data correlation fields
  const orderId =
    extractNonEmptyString(dataCustomData.orderId) ??
    extractNonEmptyString(dataCustomData.order_id) ??
    extractNonEmptyString(rootCustomData.orderId) ??
    extractNonEmptyString(rootCustomData.order_id);

  // 2. External providerTransactionId: ONLY from Paddle transaction identifier fields
  const providerTransactionId =
    extractNonEmptyString(safePayload.provider_transaction_id) ??
    extractNonEmptyString(safePayload.transaction_id) ??
    extractNonEmptyString(dataObj.id);

  // 3. Paddle notification/event ID: ONLY from event_id / notification_id / alert_id
  const eventId =
    extractNonEmptyString(safePayload.event_id) ??
    extractNonEmptyString(safePayload.notification_id) ??
    extractNonEmptyString(safePayload.alert_id);

  const eventType =
    extractNonEmptyString(safePayload.event_type) ??
    extractNonEmptyString(safePayload.alert_name) ??
    extractNonEmptyString(safePayload.type) ??
    "unknown";

  const checkoutId =
    extractNonEmptyString(safePayload.checkout_id) ??
    extractNonEmptyString(dataObj?.checkout?.id);

  const customDataUserUid =
    extractNonEmptyString(dataCustomData.userUid) ??
    extractNonEmptyString(dataCustomData.userId) ??
    extractNonEmptyString(rootCustomData.userUid) ??
    extractNonEmptyString(rootCustomData.userId);

  const untrustedWebhookEmail =
    extractNonEmptyString(safePayload.email) ??
    extractNonEmptyString(dataObj?.customer?.email) ??
    extractNonEmptyString(dataObj?.user?.email);

  const untrustedWebhookUid =
    extractNonEmptyString(safePayload.uid) ??
    extractNonEmptyString(safePayload.user_id) ??
    extractNonEmptyString(dataObj?.user?.id) ??
    extractNonEmptyString(dataObj?.user?.uid) ??
    extractNonEmptyString(dataObj?.customer?.id);

  return {
    orderId,
    providerTransactionId,
    eventId,
    eventType,
    checkoutId,
    customDataUserUid,
    untrustedWebhookEmail,
    untrustedWebhookUid
  };
}

/**
 * Validates and records the association between an authenticated Paddle webhook event
 * and an authoritative pending order.
 */
export async function validateAndAssociatePaddleOrder(
  payload: Record<string, any>,
  deps: PaymentOrderAssociationDeps
): Promise<OrderAssociationValidationResult> {
  const extracted = extractPaddleWebhookIdentifiers(payload);

  // 1. Internal orderId presence & format check (before any Firestore read)
  if (!extracted.orderId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_INTERNAL_ORDER_ID",
      error: "Missing internal orderId in Paddle webhook custom_data"
    };
  }

  if (!isValidInternalOrderIdFormat(extracted.orderId)) {
    return {
      ok: false,
      statusCode: 422,
      code: "INVALID_INTERNAL_ORDER_ID",
      error: `Invalid internal orderId format: '${extracted.orderId}'`
    };
  }

  // 2. External providerTransactionId presence check
  if (!extracted.providerTransactionId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_PROVIDER_TRANSACTION_ID",
      error: "Missing external providerTransactionId in Paddle webhook payload"
    };
  }

  // 3. Paddle eventId presence & distinctness check
  if (!extracted.eventId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_EVENT_ID",
      error: "Missing Paddle event_id in webhook payload"
    };
  }

  if (
    extracted.eventId === extracted.providerTransactionId ||
    extracted.providerTransactionId === extracted.orderId ||
    extracted.eventId === extracted.orderId
  ) {
    return {
      ok: false,
      statusCode: 422,
      code: "EVENT_ID_EQUALS_TRANSACTION_ID",
      error:
        "Ambiguous identifiers: internal orderId, providerTransactionId, and eventId must be strictly distinct"
    };
  }

  // 4. Fetch authoritative pending order from repository
  const order = await deps.repository.getOrderById(extracted.orderId);
  if (!order) {
    return {
      ok: false,
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
      error: `Pending order '${extracted.orderId}' not found in authoritative repository`
    };
  }

  // 5. Verify stored internal order ID integrity
  const storedId = extractNonEmptyString(order.id);
  const storedOrderId = extractNonEmptyString(order.orderId) ?? storedId;
  if (
    !storedId ||
    !storedOrderId ||
    storedId !== storedOrderId ||
    storedId !== extracted.orderId ||
    !isValidInternalOrderIdFormat(storedId)
  ) {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_INVALID_ID",
      error: "Stored order document has an invalid or inconsistent internal orderId"
    };
  }

  // 6. Verify authoritative owner UID on the stored order
  const rawUserId = extractNonEmptyString(order.userId);
  const rawUserUid = extractNonEmptyString(order.userUid);
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

  // Prevent cross-user order reattribution if checkout custom_data carried a different userUid
  if (extracted.customDataUserUid && extracted.customDataUserUid !== authoritativeUserUid) {
    return {
      ok: false,
      statusCode: 403,
      code: "ORDER_USER_MISMATCH",
      error: "Order belongs to another userUid and cannot be reassigned"
    };
  }

  // 7. Verify payment provider matches Paddle
  if (order.provider !== "paddle") {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_PROVIDER_MISMATCH",
      error: `Order provider '${String(order.provider)}' does not allow Paddle webhook processing`
    };
  }

  // 8. Verify external providerTransactionId consistency with order (before status check so mismatched txId is caught explicitly)
  const expectedOrExistingTxId =
    extractNonEmptyString(order.providerTransactionId) ??
    extractNonEmptyString(order.paddleDetails?.paddleOrderId);

  if (expectedOrExistingTxId && expectedOrExistingTxId !== extracted.providerTransactionId) {
    return {
      ok: false,
      statusCode: 409,
      code: "PROVIDER_TRANSACTION_ID_MISMATCH",
      error: `Incoming providerTransactionId '${extracted.providerTransactionId}' does not match order transaction '${expectedOrExistingTxId}'`
    };
  }

  // 9. Verify order status allows payment association ("pending" and not already associated)
  if (order.status !== "pending" || order.associationStatus === "associated") {
    return {
      ok: false,
      statusCode: 409,
      code: "ORDER_INVALID_STATUS",
      error: `Order state (status='${String(order.status)}', associationStatus='${String(order.associationStatus || "unassociated")}') does not allow new payment association`
    };
  }

  // 10. Verify providerTransactionId is not already associated with a different order
  const otherOrderWithSameTx = await deps.repository.findOrderByProviderTransactionId(
    "paddle",
    extracted.providerTransactionId
  );
  if (otherOrderWithSameTx) {
    const otherId = extractNonEmptyString(otherOrderWithSameTx.orderId) ?? extractNonEmptyString(otherOrderWithSameTx.id);
    if (otherId && otherId !== extracted.orderId) {
      return {
        ok: false,
        statusCode: 409,
        code: "TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER",
        error: `External transaction '${extracted.providerTransactionId}' is already associated with another order ('${otherId}')`
      };
    }
  }

  // 11. Verify that the authoritative userUid still exists and is active in Firebase Authentication
  // Note: Identity verification is performed strictly by UID (never by email or webhook fields).
  let verifiedUser = null;
  try {
    verifiedUser = await deps.adminAuth.getUser(authoritativeUserUid);
  } catch {
    verifiedUser = null;
  }

  if (
    !verifiedUser ||
    typeof verifiedUser.uid !== "string" ||
    verifiedUser.uid.trim() !== authoritativeUserUid ||
    verifiedUser.disabled === true
  ) {
    return {
      ok: false,
      statusCode: 422,
      code: "USER_IDENTITY_NOT_FOUND",
      error: `Authoritative order owner UID '${authoritativeUserUid}' could not be verified in Firebase Authentication`
    };
  }

  // 12. Persist the validated association in the authoritative repository
  const updatedOrder = await deps.repository.recordOrderTransactionAssociation({
    orderId: extracted.orderId,
    userUid: authoritativeUserUid,
    provider: "paddle",
    providerTransactionId: extracted.providerTransactionId,
    eventId: extracted.eventId,
    eventType: extracted.eventType,
    checkoutId: extracted.checkoutId,
    webhookCustomerEmail: extracted.untrustedWebhookEmail
  });

  return {
    ok: true,
    statusCode: 200,
    order: updatedOrder,
    identifiers: {
      orderId: extracted.orderId,
      providerTransactionId: extracted.providerTransactionId,
      eventId: extracted.eventId,
      eventType: extracted.eventType,
      userUid: authoritativeUserUid
    }
  };
}
