/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-04-AUTH-01
 * Vérification serveur des JWT Supabase & autorisation depuis `public.profiles`
 * ============================================================================
 *
 * Garanties Zero-Trust côté serveur :
 * 1. Exclusivement serveur (`src/server/`), interdit dans le navigateur.
 * 2. Rejette immédiatement tout token synthétique Sandbox (`sandbox_synthetic_token_*`),
 *    tout en-tête `x-pdi-sandbox-identity`, et bloque toute vérification en mode Sandbox.
 * 3. Valide la structure JWT, l'algorithme (refuse `none`), `exp` (expiration stricte),
 *    `nbf`, `sub` (UUID valide), `aud`, et `iss` (cohérent avec `SUPABASE_URL/auth/v1`).
 * 4. Vérifie la signature cryptographique et l'état réel de la session côté Supabase Auth
 *    via `adminClient.auth.getUser(token)` (zéro confiance dans un simple décodage local).
 * 5. Charge le profil autoritatif depuis `public.profiles` via `service_role` et
 *    n'utilise JAMAIS `user_metadata` ni `app_metadata` pour accorder un rôle ou statut.
 * 6. Refuse tout compte `suspended`, `revoked`, `disabled`, `pending_activation`,
 *    sans profil, ou `super_admin` dont `email_confirmed_at IS NULL`.
 * 7. N'expose jamais de token JWT ou de clé secrète dans les journaux ou réponses d'erreur.
 */

import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isStagingSandboxMode,
  isSyntheticSandboxToken,
  isSyntheticSandboxUid,
} from "../lib/stagingSandbox.ts";
import {
  createSupabaseAdminClient,
  sanitizeSupabaseAdminError,
  SupabaseAdminConfigError,
} from "./supabaseAdmin.ts";
import {
  BLOCKED_NEGATIVE_PROFILE_STATUSES,
  isEmailConfirmed,
  normalizeBootstrapEmail,
  verifySupabaseSuperAdminAuthority,
  type BootstrapAuthUserRecord,
  type BootstrapProfileRecord,
  type SupabaseProfileRole,
  type SupabaseProfileStatus,
} from "./supabaseSuperAdminBootstrap.ts";

export interface SupabaseVerifiedProfilePayload {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  role: SupabaseProfileRole;
  status: SupabaseProfileStatus;
  accountType: "basic" | "pro" | "team" | "enterprise";
  subscriptionPlan: "monthly" | "yearly" | "trial" | "lifetime";
  company: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SupabaseVerifiedSession {
  provider: "supabase";
  userId: string;
  email: string;
  emailConfirmed: boolean;
  emailConfirmedAt: string | null;
  role: SupabaseProfileRole;
  status: SupabaseProfileStatus;
  isSuperAdmin: boolean;
  tokenExp: number;
  tokenIat: number | null;
  profile: SupabaseVerifiedProfilePayload;
}

export interface SupabaseAdminOverviewProfileSummary {
  id: string;
  email: string;
  name: string;
  role: SupabaseProfileRole;
  status: SupabaseProfileStatus;
  accountType: string;
  subscriptionPlan: string;
  company: string | null;
  createdAt: string | null;
}

export interface SupabaseAdminOverviewAuditLog {
  id: string;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  severity: "info" | "warning" | "critical";
  actorUserId: string | null;
  targetUserId: string | null;
  createdAt: string | null;
}

export interface SupabaseAdminOverviewPayload {
  generatedAt: string;
  verifiedSuperAdmin: {
    userId: string;
    email: string;
    emailConfirmedAt: string;
  };
  counts: {
    profiles: number;
    activeProfiles: number;
    superAdmins: number;
    projects: number;
    licenseKeys: number;
    auditLogs: number;
  };
  profiles: SupabaseAdminOverviewProfileSummary[];
  recentAuditLogs: SupabaseAdminOverviewAuditLog[];
  legacyFirestoreModulesPendingMigration: string[];
}

export interface SupabaseServerAuthGateway {
  verifyAccessTokenAndGetUser(accessToken: string): Promise<BootstrapAuthUserRecord | null>;
  findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null>;
  getSuperAdminOverview?(
    verifiedSession: SupabaseVerifiedSession
  ): Promise<SupabaseAdminOverviewPayload>;
}

export type SupabaseAuthVerificationErrorCode =
  | "auth/missing-token"
  | "auth/empty-token"
  | "auth/synthetic-identity-forbidden"
  | "auth/malformed-token"
  | "auth/token-expired"
  | "auth/token-not-yet-valid"
  | "auth/invalid-issuer"
  | "auth/invalid-audience"
  | "auth/invalid-token"
  | "auth/profile-not-found"
  | "auth/profile-email-mismatch"
  | "auth/account-suspended"
  | "auth/account-revoked"
  | "auth/account-disabled"
  | "auth/pending-activation"
  | "auth/account-inactive"
  | "auth/unverified-email"
  | "auth/forbidden-super-admin"
  | "sandbox/server-auth-disabled"
  | "server/supabase-auth-unconfigured"
  | "server/supabase-auth-error";

export type SupabaseSessionVerificationResult =
  | {
      ok: true;
      session: SupabaseVerifiedSession;
    }
  | {
      ok: false;
      httpStatus: 401 | 403 | 503;
      code: SupabaseAuthVerificationErrorCode;
      error: string;
      profileStatus?: SupabaseProfileStatus;
    };

export interface ParsedSupabaseJwt {
  header: {
    alg?: string;
    typ?: string;
    kid?: string;
  };
  payload: {
    sub?: string;
    email?: string;
    aud?: string | string[];
    iss?: string;
    role?: string;
    exp?: number;
    iat?: number;
    nbf?: number;
    [key: string]: unknown;
  };
}

export interface SupabaseAuthRequest extends Request {
  supabaseSession?: SupabaseVerifiedSession;
  user?: {
    uid: string;
    email?: string;
    email_verified?: boolean;
    role?: string;
    name?: string;
    picture?: string;
    auth_provider?: "firebase" | "supabase";
    [key: string]: unknown;
  };
}

const UUID_V4_OR_STANDARD_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;
const ALLOWED_JWT_ALGORITHMS = new Set([
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
]);

export const LEGACY_FIRESTORE_MODULES_PENDING_MIGRATION = [
  "payments_and_webhooks_ledger (Firestore pending_orders / payment_transactions)",
  "country_restrictions (Firestore settings/country_restrictions)",
  "commercial_visits_and_subscriber_usage (Firestore commercial_visits / subscriber_usage)",
  "legacy_firebase_license_keys_and_feedbacks (Firestore license_keys / user_feedbacks)",
] as const;

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  if (!segment || !JWT_SEGMENT_REGEX.test(segment)) {
    return null;
  }
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const text = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Détecte sans effet de bord si un token Bearer est émis par Supabase Auth (`iss` se terminant par `/auth/v1`).
 * Ne valide PAS la signature (sert uniquement au routage vers le vérificateur cryptographique Supabase).
 */
export function isLikelySupabaseAccessToken(
  token: string,
  expectedSupabaseUrl?: string
): boolean {
  if (typeof token !== "string" || !token.includes(".")) {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const payload = decodeBase64UrlJson(parts[1]);
  if (!payload || typeof payload.iss !== "string") {
    return false;
  }
  const iss = payload.iss.trim().replace(/\/+$/, "");
  if (expectedSupabaseUrl && expectedSupabaseUrl.trim()) {
    const expectedOrigin = expectedSupabaseUrl.trim().replace(/\/+$/, "");
    return iss === `${expectedOrigin}/auth/v1`;
  }
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1$/i.test(iss) || iss.endsWith("/auth/v1");
}

/**
 * Validation structurelle et temporelle stricte d'un JWT Supabase avant vérification cryptographique serveur.
 */
export function parseAndValidateSupabaseJwtClaims(
  token: string,
  options: {
    expectedSupabaseUrl?: string;
    nowEpochSeconds?: number;
  } = {}
):
  | { ok: true; jwt: ParsedSupabaseJwt }
  | { ok: false; code: SupabaseAuthVerificationErrorCode; error: string } {
  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      code: "auth/empty-token",
      error: "Unauthorized: Empty bearer token.",
    };
  }

  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts.some((p) => !p || !JWT_SEGMENT_REGEX.test(p))) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Malformed Supabase JWT structure.",
    };
  }

  const header = decodeBase64UrlJson(parts[0]);
  const payload = decodeBase64UrlJson(parts[1]);
  if (!header || !payload) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Invalid JWT encoding.",
    };
  }

  const alg = typeof header.alg === "string" ? header.alg : "";
  if (!alg || alg.toLowerCase() === "none" || !ALLOWED_JWT_ALGORITHMS.has(alg)) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Unsupported or unsigned JWT algorithm.",
    };
  }

  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub || !UUID_V4_OR_STANDARD_REGEX.test(sub)) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Missing or invalid subject UUID in Supabase JWT.",
    };
  }

  if (isSyntheticSandboxUid(sub) || payload.sandbox_synthetic === true) {
    return {
      ok: false,
      code: "auth/synthetic-identity-forbidden",
      error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server.",
    };
  }

  const nowSec = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Missing expiration claim (exp) in Supabase JWT.",
    };
  }
  if (payload.exp <= nowSec) {
    return {
      ok: false,
      code: "auth/token-expired",
      error: "Unauthorized: Supabase access token has expired. Please refresh session.",
    };
  }

  if (typeof payload.nbf === "number" && Number.isFinite(payload.nbf) && payload.nbf > nowSec + 5) {
    return {
      ok: false,
      code: "auth/token-not-yet-valid",
      error: "Unauthorized: Supabase access token is not yet valid.",
    };
  }

  if (payload.aud !== undefined) {
    const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audList.includes("authenticated")) {
      return {
        ok: false,
        code: "auth/invalid-audience",
        error: "Unauthorized: Invalid Supabase JWT audience.",
      };
    }
  }

  if (options.expectedSupabaseUrl && options.expectedSupabaseUrl.trim()) {
    const expectedIss = `${options.expectedSupabaseUrl.trim().replace(/\/+$/, "").toLowerCase()}/auth/v1`;
    const actualIss =
      typeof payload.iss === "string"
        ? payload.iss.trim().replace(/\/+$/, "").toLowerCase()
        : "";
    if (!actualIss || actualIss !== expectedIss) {
      return {
        ok: false,
        code: "auth/invalid-issuer",
        error: "Unauthorized: Supabase JWT issuer does not match configured project.",
      };
    }
  }

  return {
    ok: true,
    jwt: {
      header: header as ParsedSupabaseJwt["header"],
      payload: payload as ParsedSupabaseJwt["payload"],
    },
  };
}

function mapProfileRecordToPayload(profile: BootstrapProfileRecord): SupabaseVerifiedProfilePayload {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    displayName: profile.display_name ?? profile.name,
    role: profile.role,
    status: profile.status,
    accountType: profile.account_type ?? "basic",
    subscriptionPlan: profile.subscription_plan ?? "monthly",
    company: profile.company ?? null,
    country: profile.country ?? null,
    countryCode: profile.country_code ?? null,
    city: profile.city ?? null,
    createdAt: profile.created_at ?? null,
    updatedAt: profile.updated_at ?? null,
  };
}

/**
 * Vérification complète de bout en bout d'un JWT Supabase :
 * 1. Rejet des identités synthétiques Sandbox.
 * 2. Validation structurelle / expiration / issuer du JWT.
 * 3. Validation cryptographique & session active côté serveur Supabase Auth (`auth.getUser(token)`).
 * 4. Lecture autoritative de `public.profiles` (jamais `user_metadata` ni `app_metadata`).
 * 5. Application stricte des statuts bloqués (`suspended`, `revoked`, `disabled`, `pending_activation`)
 *    et de l'exigence `email_confirmed_at IS NOT NULL` pour `super_admin`.
 */
export async function verifySupabaseSessionFromBearerToken(
  token: string,
  options: {
    gateway: SupabaseServerAuthGateway;
    expectedSupabaseUrl?: string;
    nowEpochSeconds?: number;
  }
): Promise<SupabaseSessionVerificationResult> {
  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/empty-token",
      error: "Unauthorized: Empty bearer token.",
    };
  }

  const trimmed = token.trim();
  if (isSyntheticSandboxToken(trimmed)) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/synthetic-identity-forbidden",
      error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server.",
    };
  }

  const jwtCheck = parseAndValidateSupabaseJwtClaims(trimmed, {
    expectedSupabaseUrl: options.expectedSupabaseUrl,
    nowEpochSeconds: options.nowEpochSeconds,
  });
  if ("code" in jwtCheck) {
    return {
      ok: false,
      httpStatus: 401,
      code: jwtCheck.code,
      error: jwtCheck.error,
    };
  }

  // Validation cryptographique réelle auprès du serveur Supabase Auth
  let authUser: BootstrapAuthUserRecord | null;
  try {
    authUser = await options.gateway.verifyAccessTokenAndGetUser(trimmed);
  } catch (err) {
    const safeMsg = sanitizeSupabaseAdminError(err);
    const isExpired = /expired|jwt expired/i.test(safeMsg);
    return {
      ok: false,
      httpStatus: 401,
      code: isExpired ? "auth/token-expired" : "auth/invalid-token",
      error: isExpired
        ? "Unauthorized: Supabase access token has expired."
        : "Unauthorized: Invalid or revoked Supabase access token.",
    };
  }

  if (!authUser || !authUser.id || !authUser.email) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/invalid-token",
      error: "Unauthorized: Supabase access token could not be verified.",
    };
  }

  // Cohérence stricte entre `sub` du JWT et l'utilisateur vérifié par Supabase Auth
  if (authUser.id !== jwtCheck.jwt.payload.sub) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/invalid-token",
      error: "Unauthorized: Token subject mismatch.",
    };
  }

  if (isSyntheticSandboxUid(authUser.id)) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/synthetic-identity-forbidden",
      error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server.",
    };
  }

  // Lecture autoritative du profil serveur dans `public.profiles` (JAMAIS `user_metadata` / `app_metadata`)
  let profile: BootstrapProfileRecord | null;
  try {
    profile = await options.gateway.findProfileByUserId(authUser.id);
  } catch (err) {
    console.error(
      "[SupabaseAuth] Failed to query public.profiles:",
      sanitizeSupabaseAdminError(err)
    );
    return {
      ok: false,
      httpStatus: 503,
      code: "server/supabase-auth-error",
      error: "Service Unavailable: Unable to verify authoritative user profile.",
    };
  }

  if (!profile) {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/profile-not-found",
      error: "Forbidden: No authorized profile found in public.profiles for this account.",
    };
  }

  if (normalizeBootstrapEmail(profile.email) !== normalizeBootstrapEmail(authUser.email)) {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/profile-email-mismatch",
      error: "Forbidden: Profile email does not match verified Supabase Auth identity.",
    };
  }

  // Rejet strict des statuts bloqués (suspended / revoked / disabled)
  if (BLOCKED_NEGATIVE_PROFILE_STATUSES.has(profile.status)) {
    const statusCodeMap: Record<string, SupabaseAuthVerificationErrorCode> = {
      suspended: "auth/account-suspended",
      revoked: "auth/account-revoked",
      disabled: "auth/account-disabled",
    };
    return {
      ok: false,
      httpStatus: 403,
      code: statusCodeMap[profile.status] ?? "auth/account-disabled",
      error: `Forbidden: Account status '${profile.status}' is not authorized to access the application.`,
      profileStatus: profile.status,
    };
  }

  if (profile.status === "pending_activation") {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/pending-activation",
      error: "Forbidden: Account is pending activation.",
      profileStatus: profile.status,
    };
  }

  if (profile.status !== "active") {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/account-inactive",
      error: "Forbidden: Account is not active.",
      profileStatus: profile.status,
    };
  }

  const emailConfirmed = isEmailConfirmed(authUser);

  // Règle critique : un rôle `super_admin` exige obligatoirement un email confirmé côté Supabase Auth
  if (profile.role === "super_admin" && !emailConfirmed) {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/unverified-email",
      error: "Forbidden: Email confirmation is mandatory before super_admin privileges take effect.",
      profileStatus: profile.status,
    };
  }

  // Vérification autoritative alignée sur `public.is_super_admin()` et MIG-03 (ignore totalement metadata)
  const authority = verifySupabaseSuperAdminAuthority({
    authUser,
    profile,
  });

  const verifiedSession: SupabaseVerifiedSession = {
    provider: "supabase",
    userId: authUser.id,
    email: authUser.email,
    emailConfirmed,
    emailConfirmedAt: authUser.email_confirmed_at ?? null,
    role: profile.role,
    status: profile.status,
    isSuperAdmin: authority.isEffectiveSuperAdmin,
    tokenExp: jwtCheck.jwt.payload.exp as number,
    tokenIat: typeof jwtCheck.jwt.payload.iat === "number" ? jwtCheck.jwt.payload.iat : null,
    profile: mapProfileRecordToPayload(profile),
  };

  return {
    ok: true,
    session: verifiedSession,
  };
}

/**
 * Implémentation concrète serveur appuyée sur le client Supabase Admin (`service_role` / `sb_secret_`).
 */
export function createSupabaseServerAuthGateway(
  adminClient: SupabaseClient
): SupabaseServerAuthGateway {
  return {
    async verifyAccessTokenAndGetUser(
      accessToken: string
    ): Promise<BootstrapAuthUserRecord | null> {
      const { data, error } = await adminClient.auth.getUser(accessToken);
      if (error || !data?.user || !data.user.email) {
        if (error) {
          throw new Error(sanitizeSupabaseAdminError(error));
        }
        return null;
      }
      return {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at ?? null,
        invited_at: data.user.invited_at ?? null,
        created_at: data.user.created_at ?? null,
        user_metadata: null,
        app_metadata: null,
      };
    },

    async findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null> {
      const { data, error } = await adminClient
        .from("profiles")
        .select(
          "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        throw new Error(`profiles.select failed: ${sanitizeSupabaseAdminError(error)}`);
      }
      return (data as BootstrapProfileRecord | null) ?? null;
    },

    async getSuperAdminOverview(
      verifiedSession: SupabaseVerifiedSession
    ): Promise<SupabaseAdminOverviewPayload> {
      const [profilesRes, auditRes, projectsCountRes, licensesCountRes, auditCountRes] =
        await Promise.all([
          adminClient
            .from("profiles")
            .select(
              "id, email, name, role, status, account_type, subscription_plan, company, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(100),
          adminClient
            .from("audit_logs")
            .select(
              "id, event_type, resource_type, resource_id, severity, actor_user_id, target_user_id, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(25),
          adminClient.from("projects").select("id", { count: "exact", head: true }),
          adminClient.from("license_keys").select("id", { count: "exact", head: true }),
          adminClient.from("audit_logs").select("id", { count: "exact", head: true }),
        ]);

      if (profilesRes.error) {
        throw new Error(`profiles overview failed: ${sanitizeSupabaseAdminError(profilesRes.error)}`);
      }
      if (auditRes.error) {
        throw new Error(`audit_logs overview failed: ${sanitizeSupabaseAdminError(auditRes.error)}`);
      }

      const rawProfiles = (profilesRes.data ?? []) as Array<Record<string, unknown>>;
      const profiles: SupabaseAdminOverviewProfileSummary[] = rawProfiles.map((row) => ({
        id: String(row.id),
        email: String(row.email),
        name: String(row.name ?? ""),
        role: row.role as SupabaseProfileRole,
        status: row.status as SupabaseProfileStatus,
        accountType: String(row.account_type ?? "basic"),
        subscriptionPlan: String(row.subscription_plan ?? "monthly"),
        company: typeof row.company === "string" ? row.company : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
      }));

      const rawAudits = (auditRes.data ?? []) as Array<Record<string, unknown>>;
      const recentAuditLogs: SupabaseAdminOverviewAuditLog[] = rawAudits.map((row) => ({
        id: String(row.id),
        eventType: String(row.event_type ?? ""),
        resourceType: String(row.resource_type ?? ""),
        resourceId: typeof row.resource_id === "string" ? row.resource_id : null,
        severity: (row.severity as "info" | "warning" | "critical") ?? "info",
        actorUserId: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
        targetUserId: typeof row.target_user_id === "string" ? row.target_user_id : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
      }));

      return {
        generatedAt: new Date().toISOString(),
        verifiedSuperAdmin: {
          userId: verifiedSession.userId,
          email: verifiedSession.email,
          emailConfirmedAt: verifiedSession.emailConfirmedAt ?? "",
        },
        counts: {
          profiles: profiles.length,
          activeProfiles: profiles.filter((p) => p.status === "active").length,
          superAdmins: profiles.filter((p) => p.role === "super_admin" && p.status === "active")
            .length,
          projects: projectsCountRes.count ?? 0,
          licenseKeys: licensesCountRes.count ?? 0,
          auditLogs: auditCountRes.count ?? recentAuditLogs.length,
        },
        profiles,
        recentAuditLogs,
        legacyFirestoreModulesPendingMigration: [...LEGACY_FIRESTORE_MODULES_PENDING_MIGRATION],
      };
    },
  };
}

export interface CreateRequireSupabaseAuthOptions {
  gateway?: SupabaseServerAuthGateway;
  nowEpochSeconds?: () => number;
}

/**
 * Résout de manière paresseuse la passerelle serveur Supabase Auth (zéro appel réseau au boot).
 */
export function resolveSupabaseServerAuthGateway(
  env: Record<string, string | undefined> = process.env,
  injectedGateway?: SupabaseServerAuthGateway
): { gateway: SupabaseServerAuthGateway; expectedSupabaseUrl?: string } | null {
  if (injectedGateway) {
    return {
      gateway: injectedGateway,
      expectedSupabaseUrl: env.SUPABASE_URL?.trim() || undefined,
    };
  }

  try {
    const { client, url } = createSupabaseAdminClient(env);
    return {
      gateway: createSupabaseServerAuthGateway(client),
      expectedSupabaseUrl: url,
    };
  } catch (err) {
    if (err instanceof SupabaseAdminConfigError) {
      return null;
    }
    return null;
  }
}

/**
 * Middleware Express : authentification et autorisation strictes par JWT Supabase + `public.profiles`.
 * Conserve toutes les protections Sandbox et Fail-Closed.
 */
export function createRequireSupabaseAuth(
  env: Record<string, string | undefined> = process.env,
  options: CreateRequireSupabaseAuthOptions = {}
) {
  let cachedGateway: { gateway: SupabaseServerAuthGateway; expectedSupabaseUrl?: string } | null =
    null;

  return async (req: SupabaseAuthRequest, res: Response, next: NextFunction) => {
    const headers = req.headers ?? {};

    // Protection C2 : rejet immédiat de toute identité synthétique Sandbox
    if (headers["x-pdi-sandbox-identity"]) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden",
      });
    }

    const authHeader = typeof headers.authorization === "string" ? headers.authorization : "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized: Missing or invalid authorization header",
        code: "auth/missing-token",
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized: Empty bearer token",
        code: "auth/empty-token",
      });
    }

    if (isSyntheticSandboxToken(token)) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden",
      });
    }

    // Protection Sandbox serveur : aucune vérification Supabase Auth en mode Sandbox
    if (isStagingSandboxMode(env)) {
      return res.status(403).json({
        error: "Forbidden: Supabase server authentication is disabled in Sandbox mode.",
        code: "sandbox/server-auth-disabled",
      });
    }

    if (!cachedGateway) {
      cachedGateway = resolveSupabaseServerAuthGateway(env, options.gateway);
    }

    if (!cachedGateway) {
      return res.status(503).json({
        error:
          "Service Unavailable: Supabase server authentication is not configured (SUPABASE_URL and SUPABASE_SECRET_KEY required on server).",
        code: "server/supabase-auth-unconfigured",
      });
    }

    const verification = await verifySupabaseSessionFromBearerToken(token, {
      gateway: cachedGateway.gateway,
      expectedSupabaseUrl: cachedGateway.expectedSupabaseUrl,
      nowEpochSeconds: options.nowEpochSeconds?.(),
    });

    if ("code" in verification) {
      return res.status(verification.httpStatus).json({
        error: verification.error,
        code: verification.code,
        ...(verification.profileStatus ? { profileStatus: verification.profileStatus } : {}),
      });
    }

    const session = verification.session;
    req.supabaseSession = session;
    req.user = {
      uid: session.userId,
      email: session.email,
      email_verified: session.emailConfirmed,
      role: session.role,
      name: session.profile.name,
      auth_provider: "supabase",
    };

    next();
  };
}

/**
 * Middleware Express : autorise UNIQUEMENT un Super Admin Supabase vérifié côté serveur
 * (`public.profiles.role === 'super_admin'`, `status === 'active'`, `email_confirmed_at IS NOT NULL`).
 * Rejette toute tentative de fourniture de rôle administrateur par le client.
 */
export function requireSupabaseSuperAdmin(
  req: SupabaseAuthRequest,
  res: Response,
  next: NextFunction
) {
  const session = req.supabaseSession;
  if (!session) {
    return res.status(401).json({
      error: "Unauthorized: Verified Supabase session required.",
      code: "auth/missing-token",
    });
  }

  if (
    session.isSuperAdmin !== true ||
    session.role !== "super_admin" ||
    session.status !== "active" ||
    session.emailConfirmed !== true
  ) {
    return res.status(403).json({
      error:
        "Forbidden: Verified active super_admin role with confirmed email required.",
      code: "auth/forbidden-super-admin",
    });
  }

  next();
}
