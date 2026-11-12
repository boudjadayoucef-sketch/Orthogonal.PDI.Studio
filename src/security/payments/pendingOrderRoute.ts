/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-05-B-R1 — AUTHORITATIVE PENDING ORDER EXPRESS ROUTE (B1 & B3)
 *
 * Responsibility:
 * - Provides the Express middleware chain and handler for `POST /api/payments/orders`.
 * - Enforces Bearer token verification, fail-closed `uid` presence, and `email_verified === true`.
 * - Extracts `userUid` exclusively from the verified token (`req.user.uid`), ignoring any
 *   client-supplied `uid`, `userUid`, `userId`, `orderId`, `status`, or `role`.
 * - Validates order parameters (`plan`, `accountType`, `billingCycle`, `countryCode`, `provider`,
 *   `currency`, `amount`) against the project's payment configuration before persisting the
 *   pending order in `payment_transactions` via `PendingOrderRepository`.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { adminAuth } from "../../lib/firebase-admin.ts";
import type { PdiAccountType, PdiSubscriptionPlan } from "../../lib/firebase.ts";
import {
  getPaymentConfigForCountry,
  type PdiPaymentProvider
} from "../../pdi/payment/pdiPaymentGateway.ts";
import type { PendingOrderRepository } from "../webhooks/pendingOrderRepository.ts";

export interface VerifiedOrderTokenClaims {
  uid?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface PendingOrderRequest extends Request {
  user?: VerifiedOrderTokenClaims;
}

export interface PendingOrderRouteDeps {
  pendingOrderRepository: PendingOrderRepository;
  verifyIdToken?: (token: string) => Promise<VerifiedOrderTokenClaims>;
  resolvePaymentConfig?: typeof getPaymentConfigForCountry;
}

const VALID_PLANS: ReadonlySet<PdiAccountType> = new Set([
  "basic",
  "pro",
  "team",
  "enterprise"
]);

const VALID_BILLING_CYCLES: ReadonlySet<PdiSubscriptionPlan> = new Set([
  "monthly",
  "yearly"
]);

const VALID_PROVIDERS: ReadonlySet<PdiPaymentProvider> = new Set([
  "paddle",
  "slickpay_baridimob"
]);

/**
 * Creates the Express middleware + handler chain `[requireOrderAuth, requireOrderEmailVerified, handleCreatePendingOrder]`
 * for `POST /api/payments/orders` with injectable dependencies for real HTTP testing without production side-effects.
 */
export function createPendingOrderRoute(deps: PendingOrderRouteDeps): RequestHandler[] {
  const verifyToken =
    deps.verifyIdToken ??
    ((token: string) => adminAuth.verifyIdToken(token) as Promise<VerifiedOrderTokenClaims>);
  const resolveConfig = deps.resolvePaymentConfig ?? getPaymentConfigForCountry;

  const requireOrderAuth: RequestHandler = async (
    req: PendingOrderRequest,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized: Missing or invalid authorization header",
        code: "auth/missing-token"
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized: Empty bearer token",
        code: "auth/empty-token"
      });
    }

    try {
      const decoded = await verifyToken(token);
      if (
        !decoded ||
        typeof decoded.uid !== "string" ||
        decoded.uid.trim().length === 0
      ) {
        return res.status(401).json({
          error: "Unauthorized: Token is missing a valid user uid",
          code: "auth/missing-uid"
        });
      }

      req.user = {
        ...decoded,
        uid: decoded.uid.trim()
      };
      return next();
    } catch (err: any) {
      return res.status(401).json({
        error: "Unauthorized: Invalid authentication token",
        code: err?.code === "auth/id-token-expired" ? "auth/id-token-expired" : "auth/invalid-token"
      });
    }
  };

  const requireOrderEmailVerified: RequestHandler = (
    req: PendingOrderRequest,
    res: Response,
    next: NextFunction
  ) => {
    const user = req.user;
    if (!user || typeof user.uid !== "string" || user.uid.trim().length === 0) {
      return res.status(401).json({
        error: "Unauthorized: User authentication required",
        code: "auth/unauthorized"
      });
    }

    if (user.email_verified !== true) {
      return res.status(403).json({
        error: "Forbidden: Email verification required for order creation",
        code: "auth/unverified-email"
      });
    }

    if (typeof user.email !== "string" || user.email.trim().length === 0) {
      return res.status(403).json({
        error: "Forbidden: Verified user email claim is required",
        code: "auth/missing-email"
      });
    }

    return next();
  };

  const handleCreatePendingOrder: RequestHandler = async (
    req: PendingOrderRequest,
    res: Response
  ) => {
    try {
      // Fail-closed check on req.user.uid & req.user.email from verified token ONLY
      const verifiedUid =
        typeof req.user?.uid === "string" ? req.user.uid.trim() : "";
      const verifiedEmail =
        typeof req.user?.email === "string" ? req.user.email.trim().toLowerCase() : "";

      if (!verifiedUid || !verifiedEmail || req.user?.email_verified !== true) {
        return res.status(401).json({
          error: "Authenticated and verified user identity required.",
          code: "auth/unauthorized"
        });
      }

      const body = req.body && typeof req.body === "object" ? req.body : {};

      // 1. Validate plan & optional accountType consistency
      const rawPlan = body.plan;
      if (typeof rawPlan !== "string" || !VALID_PLANS.has(rawPlan as PdiAccountType)) {
        return res.status(400).json({
          error: "Invalid or missing subscription plan.",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const plan = rawPlan as PdiAccountType;

      if (body.accountType !== undefined && body.accountType !== plan) {
        return res.status(400).json({
          error: "Inconsistent accountType and plan parameters.",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }

      // 2. Validate billingCycle
      const rawCycle = body.billingCycle ?? "yearly";
      if (
        typeof rawCycle !== "string" ||
        !VALID_BILLING_CYCLES.has(rawCycle as PdiSubscriptionPlan)
      ) {
        return res.status(400).json({
          error: "Invalid billingCycle parameter (must be 'monthly' or 'yearly').",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const billingCycle = rawCycle as PdiSubscriptionPlan;

      // 3. Validate countryCode (2-letter ISO code)
      const rawCountryCode = body.countryCode ?? "FR";
      if (
        typeof rawCountryCode !== "string" ||
        !/^[A-Za-z]{2}$/.test(rawCountryCode.trim())
      ) {
        return res.status(400).json({
          error: "Invalid countryCode parameter (must be a 2-letter ISO code).",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const countryCode = rawCountryCode.trim().toUpperCase();

      // 4. Resolve authoritative server payment configuration for countryCode
      const paymentConfig = resolveConfig(countryCode);
      const pricing = paymentConfig.pricingTable[plan];
      if (!pricing) {
        return res.status(400).json({
          error: "Pricing configuration unavailable for requested plan.",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }

      // 5. Validate provider if supplied by client (must be a valid provider AND match server selection)
      if (body.provider !== undefined) {
        if (
          typeof body.provider !== "string" ||
          !VALID_PROVIDERS.has(body.provider as PdiPaymentProvider) ||
          body.provider !== paymentConfig.provider
        ) {
          return res.status(422).json({
            error: `Unauthorized or inconsistent payment provider '${String(body.provider)}' for country '${countryCode}'.`,
            code: "INVALID_PAYMENT_PROVIDER"
          });
        }
      }

      // 6. Validate currency and amount if supplied by client against server catalog
      const authoritativeAmount =
        billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;

      if (body.currency !== undefined && body.currency !== paymentConfig.currency) {
        return res.status(422).json({
          error: `Inconsistent currency '${String(body.currency)}' (expected '${paymentConfig.currency}').`,
          code: "INVALID_ORDER_PARAMETERS"
        });
      }

      if (body.amount !== undefined && Number(body.amount) !== authoritativeAmount) {
        return res.status(422).json({
          error: `Inconsistent amount '${String(body.amount)}' (expected '${authoritativeAmount}').`,
          code: "INVALID_ORDER_PARAMETERS"
        });
      }

      // 7. Create pending order via authoritative repository (ignoring any client-supplied uid/orderId/status)
      const order = await deps.pendingOrderRepository.createPendingOrder({
        verifiedUserUid: verifiedUid,
        verifiedUserEmail: verifiedEmail,
        userName:
          typeof body.userName === "string" && body.userName.trim().length > 0
            ? body.userName.trim()
            : typeof req.user?.name === "string"
              ? req.user.name
              : undefined,
        company: typeof body.company === "string" ? body.company.trim() : "",
        country: typeof body.country === "string" ? body.country.trim() : undefined,
        countryCode,
        city: typeof body.city === "string" ? body.city.trim() : "",
        plan,
        billingCycle,
        amount: authoritativeAmount,
        currency: paymentConfig.currency,
        provider: paymentConfig.provider
      });

      return res.status(201).json({ order });
    } catch (err: any) {
      console.error("[Orders API Error]:", err?.message || err);
      return res.status(500).json({
        error: "Failed to create authoritative pending order.",
        code: "ORDER_PERSISTENCE_ERROR"
      });
    }
  };

  return [requireOrderAuth, requireOrderEmailVerified, handleCreatePendingOrder];
}
