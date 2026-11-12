/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B-R1 — AUTHORITATIVE PENDING ORDER & CHECKOUT CLIENT SERVICE (B1)
 *
 * Responsibility:
 * - Connects the client payment flow exclusively to `POST /api/payments/orders`
 *   using the authenticated user's Firebase ID token.
 * - Never writes orders directly to Firestore from the client.
 * - Propagates the server-generated `orderId` into the Paddle checkout payload
 *   inside `custom_data.orderId` (`customData.orderId`) so that the authenticated
 *   Paddle webhook can deterministically retrieve and associate the pending order.
 * - Fails closed on any server or network error, preventing the checkout from starting
 *   and never displaying a false success state.
 */

import { auth, type PdiAccountType, type PdiSubscriptionPlan } from "../../lib/firebase.ts";
import type { PdiPaymentProvider } from "../../pdi/payment/pdiPaymentGateway.ts";
import { isValidInternalOrderIdFormat } from "../webhooks/pendingOrderRepository.ts";
import type { AuthoritativePendingOrder } from "../webhooks/webhookTypes.ts";

export interface CreateOrderClientRequest {
  plan: PdiAccountType;
  accountType?: PdiAccountType;
  billingCycle: PdiSubscriptionPlan;
  countryCode: string;
  country?: string;
  city?: string;
  userName?: string;
  company?: string;
  provider?: PdiPaymentProvider;
  currency?: "DZD" | "EUR" | "USD";
  amount?: number;
  /** Any untrusted client UID passed by a caller (ignored by server) */
  uid?: string;
  userUid?: string;
  userId?: string;
}

export interface PaddleCheckoutCustomData {
  orderId: string;
  userUid: string;
  plan: PdiAccountType;
  accountType: PdiAccountType;
  billingCycle: PdiSubscriptionPlan;
  countryCode: string;
  currency: "EUR" | "USD";
  amount: number;
}

export interface PaddleCheckoutLaunchPayload {
  provider: "paddle";
  orderId: string;
  userUid: string;
  plan: PdiAccountType;
  accountType: PdiAccountType;
  billingCycle: PdiSubscriptionPlan;
  countryCode: string;
  currency: "EUR" | "USD";
  amount: number;
  customer: {
    email: string;
  };
  /** Paddle Billing v2 webhook / API correlation object */
  custom_data: PaddleCheckoutCustomData;
  /** Paddle.js Checkout.open correlation object */
  customData: PaddleCheckoutCustomData;
}

export interface SlickPayPendingCheckoutDescriptor {
  provider: "slickpay_baridimob";
  orderId: string;
  userUid: string;
  plan: PdiAccountType;
  accountType: PdiAccountType;
  billingCycle: PdiSubscriptionPlan;
  countryCode: string;
  currency: "DZD";
  amount: number;
}

export interface InitiatedOrderCheckoutResult {
  order: AuthoritativePendingOrder;
  provider: PdiPaymentProvider;
  paddleCheckout: PaddleCheckoutLaunchPayload | null;
  slickPayDescriptor: SlickPayPendingCheckoutDescriptor | null;
}

export interface PendingOrderClientDeps {
  apiEndpoint?: string;
  getIdToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  onLaunchPaddleCheckout?: (payload: PaddleCheckoutLaunchPayload) => Promise<void> | void;
}

async function resolveDefaultIdToken(): Promise<string | null> {
  const currentUser = auth?.currentUser;
  if (!currentUser || typeof currentUser.getIdToken !== "function") {
    return null;
  }
  return currentUser.getIdToken();
}

/**
 * Calls `POST /api/payments/orders` to create an authoritative pending order on the server.
 * Throws on any authentication, validation, or server persistence failure.
 */
export async function createAuthoritativePendingOrder(
  request: CreateOrderClientRequest,
  deps: PendingOrderClientDeps = {}
): Promise<AuthoritativePendingOrder> {
  const getIdToken = deps.getIdToken ?? resolveDefaultIdToken;
  const fetchFn = deps.fetchImpl ?? globalThis.fetch;
  const endpoint = deps.apiEndpoint ?? "/api/payments/orders";

  if (typeof fetchFn !== "function") {
    throw new Error("Fetch API unavailable for authoritative order creation.");
  }

  const token = await getIdToken();
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error(
      "Authentification Firebase requise : impossible de créer une commande sans jeton ID vérifié."
    );
  }

  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`
    },
    body: JSON.stringify(request)
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.order) {
    const errMsg =
      payload?.error ||
      `Échec de création de la commande serveur (HTTP ${response.status}).`;
    const err: any = new Error(errMsg);
    err.statusCode = response.status;
    err.code = payload?.code;
    throw err;
  }

  const order = payload.order as AuthoritativePendingOrder;

  if (
    !order ||
    !isValidInternalOrderIdFormat(order.orderId) ||
    order.id !== order.orderId ||
    typeof order.userUid !== "string" ||
    order.userUid.trim().length === 0 ||
    order.status !== "pending" ||
    order.associationStatus !== "unassociated"
  ) {
    throw new Error(
      "Réponse serveur invalide : la commande retournée ne respecte pas le contrat d'autorité pending."
    );
  }

  return order;
}

/**
 * Builds the Paddle checkout launch payload from a server-created authoritative pending order.
 * Ensures `custom_data.orderId` (`customData.orderId`) carries the exact server `orderId`.
 */
export function buildPaddleCheckoutPayload(
  order: AuthoritativePendingOrder
): PaddleCheckoutLaunchPayload {
  if (
    !order ||
    !isValidInternalOrderIdFormat(order.orderId) ||
    order.id !== order.orderId
  ) {
    throw new Error("Cannot build Paddle checkout payload without a valid server-generated orderId.");
  }

  if (order.provider !== "paddle") {
    throw new Error(
      `Provider mismatch: cannot build Paddle checkout for order with provider '${String(order.provider)}'.`
    );
  }

  if (order.status !== "pending" || order.associationStatus !== "unassociated") {
    throw new Error("Cannot launch checkout for an order that is not in an unassociated pending state.");
  }

  const currency = order.currency === "USD" ? "USD" : "EUR";
  const accountType = order.accountType ?? order.plan;

  const customData: PaddleCheckoutCustomData = {
    orderId: order.orderId,
    userUid: order.userUid,
    plan: order.plan,
    accountType,
    billingCycle: order.billingCycle,
    countryCode: order.countryCode,
    currency,
    amount: order.amount
  };

  return {
    provider: "paddle",
    orderId: order.orderId,
    userUid: order.userUid,
    plan: order.plan,
    accountType,
    billingCycle: order.billingCycle,
    countryCode: order.countryCode,
    currency,
    amount: order.amount,
    customer: {
      email: order.userEmail
    },
    custom_data: { ...customData },
    customData: { ...customData }
  };
}

/**
 * End-to-end client orchestration:
 * `Client -> POST /api/payments/orders -> Authoritative Pending Order -> Provider Checkout Descriptor`
 * If server order creation fails, throws immediately and never launches the checkout.
 */
export async function initiateAuthoritativeOrderCheckout(
  request: CreateOrderClientRequest,
  deps: PendingOrderClientDeps = {}
): Promise<InitiatedOrderCheckoutResult> {
  const order = await createAuthoritativePendingOrder(request, deps);

  if (order.provider === "paddle") {
    const paddleCheckout = buildPaddleCheckoutPayload(order);

    if (typeof deps.onLaunchPaddleCheckout === "function") {
      await deps.onLaunchPaddleCheckout(paddleCheckout);
    } else if (
      typeof globalThis !== "undefined" &&
      typeof (globalThis as any).Paddle?.Checkout?.open === "function"
    ) {
      throw new Error(
        "BLOCKED — PADDLE CHECKOUT CONFIGURATION MISSING: Cannot call Paddle.Checkout.open() without an authoritative Paddle transactionId or configured priceId items."
      );
    }

    return {
      order,
      provider: "paddle",
      paddleCheckout,
      slickPayDescriptor: null
    };
  }

  const slickPayDescriptor: SlickPayPendingCheckoutDescriptor = {
    provider: "slickpay_baridimob",
    orderId: order.orderId,
    userUid: order.userUid,
    plan: order.plan,
    accountType: order.accountType ?? order.plan,
    billingCycle: order.billingCycle,
    countryCode: order.countryCode,
    currency: "DZD",
    amount: order.amount
  };

  return {
    order,
    provider: "slickpay_baridimob",
    paddleCheckout: null,
    slickPayDescriptor
  };
}
