/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-04-AUTH-01
 * Service navigateur Supabase Auth (clé publique `sb_publishable_` uniquement)
 * ============================================================================
 *
 * Garanties de sécurité côté navigateur :
 * - Utilise EXCLUSIVEMENT `src/lib/supabase.ts` (`VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`).
 * - Aucun import serveur, aucune clé `sb_secret_` ni `service_role`.
 * - N'accorde JAMAIS un rôle ou un accès Super Admin depuis `user_metadata`, `app_metadata`,
 *   `localStorage` ou un paramètre client.
 * - Toute ouverture de session, restauration ou rafraîchissement de token est validée côté
 *   serveur via `GET /api/auth/supabase/session` (JWT vérifié + `public.profiles`).
 * - Refuse toute exécution en mode Sandbox (`isStagingSandboxMode()`).
 * - N'expose jamais de token d'accès dans la console ou les messages d'erreur.
 */

import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type {
  PdiAccountType,
  PdiAuthDenialReason,
  PdiSubscriptionPlan,
  PdiUserProfile,
  PdiUserRole,
  WorkspaceSessionResolution,
} from "../types/pdiAuthTypes";
import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
  SUPABASE_AUTH_STORAGE_KEY,
} from "./supabase";
import { isStagingSandboxMode } from "./stagingSandbox";

export interface SupabaseVerifiedServerProfile {
  id: string;
  email: string;
  name: string;
  displayName?: string | null;
  role: PdiUserRole;
  status: PdiUserProfile["status"];
  accountType: PdiAccountType;
  subscriptionPlan: PdiSubscriptionPlan;
  company?: string | null;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SupabaseVerifiedServerSessionPayload {
  provider: "supabase";
  userId: string;
  email: string;
  emailConfirmed: boolean;
  emailConfirmedAt: string | null;
  role: PdiUserRole;
  status: PdiUserProfile["status"];
  isSuperAdmin: boolean;
  tokenExp: number;
  tokenIat?: number | null;
  profile: SupabaseVerifiedServerProfile;
}

export interface SupabaseClientAuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  provider: "supabase";
}

export interface SupabaseVerifiedLoginResult {
  provider: "supabase";
  authUser: SupabaseClientAuthUser;
  profile: PdiUserProfile;
  isSuperAdmin: boolean;
  emailConfirmed: boolean;
  sessionResolution: WorkspaceSessionResolution;
  tokenExp: number;
}

export interface SupabaseAdminOverviewData {
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
  profiles: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    accountType: string;
    subscriptionPlan: string;
    company: string | null;
    createdAt: string | null;
  }>;
  recentAuditLogs: Array<{
    id: string;
    eventType: string;
    resourceType: string;
    resourceId: string | null;
    severity: "info" | "warning" | "critical";
    actorUserId: string | null;
    targetUserId: string | null;
    createdAt: string | null;
  }>;
  legacyFirestoreModulesPendingMigration: string[];
}

export class PdiSupabaseAuthError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly denialReason?: PdiAuthDenialReason;

  constructor(
    message: string,
    code: string,
    status = 401,
    denialReason?: PdiAuthDenialReason
  ) {
    super(message);
    this.name = "PdiSupabaseAuthError";
    this.code = code;
    this.status = status;
    this.denialReason = denialReason;
  }
}

export interface SupabaseAuthDependencies {
  getClient?: () => SupabaseClient;
  fetchImpl?: typeof fetch;
  isConfigured?: () => boolean;
  isSandbox?: () => boolean;
  locationLike?: { search?: string; hash?: string; pathname?: string; origin?: string };
  redirectTo?: string;
}

export interface SupabasePasswordRecoveryContext {
  userId: string;
  email: string;
  expiresAt: number | null;
}

export type SupabaseRecoverySessionValidationResult =
  | {
      valid: true;
      userId: string;
      email: string;
      expiresAt: number | null;
    }
  | {
      valid: false;
      code:
        | "sandbox/server-auth-disabled"
        | "client/supabase-unconfigured"
        | "auth/recovery-session-missing"
        | "auth/recovery-session-expired"
        | "auth/recovery-session-invalid";
      status: number;
      message: string;
    };

export interface SupabasePasswordRecoveryResult {
  updated: true;
  userId: string;
  email: string;
}

export interface SupabaseRecoveryUrlHint {
  hasRecoveryParam: boolean;
  hasTokenHash?: boolean;
  hasPkceCode?: boolean;
  hasError: boolean;
  errorCode?: string;
  userMessage?: string;
}

export const SUPABASE_PASSWORD_RESET_ROUTE = "/auth/reset-password" as const;

export const SUPABASE_RECOVERY_MIN_PASSWORD_LENGTH = 6 as const;
export const SUPABASE_RECOVERY_MAX_PASSWORD_LENGTH = 128 as const;

const VALID_ACCOUNT_TYPES = new Set<PdiAccountType>(["basic", "pro", "team", "enterprise"]);
const VALID_SUBSCRIPTION_PLANS = new Set<PdiSubscriptionPlan>([
  "monthly",
  "yearly",
  "trial",
  "lifetime",
]);
const VALID_ROLES = new Set<PdiUserRole>(["super_admin", "admin", "client", "guest", "demo"]);
const VALID_STATUSES = new Set<PdiUserProfile["status"]>([
  "active",
  "suspended",
  "pending_activation",
  "revoked",
  "disabled",
]);

function mapErrorCodeToDenialReason(code: string): PdiAuthDenialReason {
  switch (code) {
    case "auth/pending-activation":
      return "pending_activation";
    case "auth/account-suspended":
      return "suspended";
    case "auth/account-revoked":
      return "revoked";
    case "auth/account-disabled":
      return "disabled";
    case "auth/profile-not-found":
      return "profile_not_found";
    case "auth/unverified-email":
      return "permission_denied";
    case "auth/profile-email-mismatch":
    case "auth/invalid-token":
    case "auth/token-expired":
    case "auth/malformed-token":
      return "invalid_claims";
    default:
      return "token_error";
  }
}

function mapErrorCodeToFrenchMessage(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "auth/token-expired":
      return "Votre session Supabase a expiré. Veuillez vous reconnecter.";
    case "auth/account-suspended":
      return "Accès refusé : votre compte est suspendu. Contactez l'administrateur.";
    case "auth/account-revoked":
      return "Accès refusé : votre compte a été révoqué.";
    case "auth/account-disabled":
      return "Accès refusé : votre compte est désactivé.";
    case "auth/pending-activation":
      return "Votre compte est en attente d'activation.";
    case "auth/unverified-email":
      return "Confirmation de l'adresse email obligatoire avant l'activation des privilèges.";
    case "auth/profile-not-found":
      return "Aucun profil autorisé n'a été trouvé dans public.profiles pour ce compte.";
    case "auth/profile-email-mismatch":
      return "Incohérence d'identité entre le compte Supabase Auth et le profil serveur.";
    case "sandbox/server-auth-disabled":
      return "L'authentification serveur Supabase est désactivée en mode Sandbox.";
    case "server/supabase-auth-unconfigured":
      return "La vérification serveur Supabase n'est pas configurée sur cet environnement.";
    case "server/configuration-error":
      return "La configuration de sécurité du serveur est invalide. Vérifiez les variables d'environnement serveur.";
    case "server/unavailable":
      return "Le serveur de vérification Supabase est temporairement indisponible (erreur serveur). Veuillez réessayer dans quelques instants.";
    default:
      return fallbackMessage || "Authentification Supabase refusée par le serveur.";
  }
}

/**
 * Convertit le profil autoritatif retourné par le serveur (`public.profiles`) en `PdiUserProfile`.
 */
export function mapSupabaseServerProfileToPdiProfile(
  serverSession: SupabaseVerifiedServerSessionPayload
): PdiUserProfile {
  const p = serverSession.profile;
  const role: PdiUserRole = VALID_ROLES.has(p.role) ? p.role : "client";
  const status: PdiUserProfile["status"] = VALID_STATUSES.has(p.status)
    ? p.status
    : "disabled";
  const accountType: PdiAccountType = VALID_ACCOUNT_TYPES.has(p.accountType)
    ? p.accountType
    : "basic";
  const subscriptionPlan: PdiSubscriptionPlan = VALID_SUBSCRIPTION_PLANS.has(p.subscriptionPlan)
    ? p.subscriptionPlan
    : "monthly";

  return {
    uid: serverSession.userId,
    email: serverSession.email,
    name: p.displayName || p.name || serverSession.email,
    company: p.company ?? undefined,
    country: p.country ?? undefined,
    countryCode: p.countryCode ?? undefined,
    city: p.city ?? undefined,
    role,
    accountType,
    subscriptionPlan,
    status,
    createdAt: p.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

/**
 * Transforme une réponse serveur vérifiée `/api/auth/supabase/session` en `WorkspaceSessionResolution`.
 * Ne lit jamais `user_metadata` ni `localStorage`.
 */
export function buildWorkspaceResolutionFromSupabaseServer(
  serverSession: SupabaseVerifiedServerSessionPayload
): SupabaseVerifiedLoginResult {
  const profile = mapSupabaseServerProfileToPdiProfile(serverSession);
  const verifiedSuperAdmin =
    serverSession.isSuperAdmin === true &&
    serverSession.role === "super_admin" &&
    serverSession.status === "active" &&
    serverSession.emailConfirmed === true;

  const authUser: SupabaseClientAuthUser = {
    uid: serverSession.userId,
    email: serverSession.email,
    emailVerified: serverSession.emailConfirmed === true,
    provider: "supabase",
  };

  const sessionResolution: WorkspaceSessionResolution = {
    status: profile.status === "active" ? "active" : "denied",
    canAccessWorkspace: profile.status === "active",
    canAccessActivation: profile.status === "pending_activation",
    isSuperAdmin: verifiedSuperAdmin,
    authMode:
      profile.status === "active"
        ? verifiedSuperAdmin
          ? "super_admin"
          : "client"
        : "guest",
    profile,
  };

  return {
    provider: "supabase",
    authUser,
    profile,
    isSuperAdmin: verifiedSuperAdmin,
    emailConfirmed: serverSession.emailConfirmed === true,
    sessionResolution,
    tokenExp: serverSession.tokenExp,
  };
}

/**
 * Vérifie le JWT Supabase auprès du backend autoritatif (`GET /api/auth/supabase/session`).
 */
export async function verifySupabaseSessionWithServer(
  accessToken: string,
  deps: Pick<SupabaseAuthDependencies, "fetchImpl"> = {}
): Promise<SupabaseVerifiedLoginResult> {
  const trimmedToken = (accessToken ?? "").trim();
  if (!trimmedToken) {
    throw new PdiSupabaseAuthError(
      "Jeton de session Supabase manquant.",
      "auth/missing-token",
      401,
      "token_error"
    );
  }

  const fetchFn = deps.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn("/api/auth/supabase/session", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new PdiSupabaseAuthError(
      "Impossible de contacter le serveur d'autorisation Supabase.",
      "server/network-error",
      503
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (!response.ok || body.ok !== true || !body.session) {
    const defaultCode = response.status >= 500 ? "server/unavailable" : "auth/invalid-token";
    const code = typeof body.code === "string" ? body.code : defaultCode;
    const serverMsg = typeof body.error === "string" ? body.error : undefined;
    throw new PdiSupabaseAuthError(
      mapErrorCodeToFrenchMessage(code, serverMsg),
      code,
      response.status,
      mapErrorCodeToDenialReason(code)
    );
  }

  const sessionPayload = body.session as SupabaseVerifiedServerSessionPayload;
  if (
    !sessionPayload ||
    sessionPayload.provider !== "supabase" ||
    !sessionPayload.userId ||
    !sessionPayload.profile
  ) {
    throw new PdiSupabaseAuthError(
      "Réponse de session serveur Supabase invalide.",
      "auth/invalid-token",
      401,
      "invalid_claims"
    );
  }

  return buildWorkspaceResolutionFromSupabaseServer(sessionPayload);
}

/**
 * Récupère le JWT d'accès Supabase actif et le renouvelle automatiquement s'il approche
 * de l'expiration ou si `forceRefresh` est demandé.
 */
export async function getSupabaseAccessToken(
  forceRefresh = false,
  deps: SupabaseAuthDependencies = {}
): Promise<string | null> {
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    return null;
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    return null;
  }

  try {
    const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      return null;
    }

    const session = data.session;
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = typeof session.expires_at === "number" ? session.expires_at : 0;
    const needsRefresh = forceRefresh || (expiresAt > 0 && expiresAt - nowSec <= 60);

    if (!needsRefresh && session.access_token) {
      return session.access_token;
    }

    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data?.session?.access_token) {
      // Session expirée ou refresh token révoqué : nettoyage local sans fuite de token
      await logoutSupabase(deps);
      return null;
    }

    return refreshed.data.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Connexion email/mot de passe via Supabase Auth + vérification autoritative côté serveur.
 * Si le serveur refuse le compte (suspendu, révoqué, désactivé, email non confirmé, profil absent),
 * la session navigateur Supabase est immédiatement révoquée via `signOut()`.
 */
export async function loginWithSupabaseEmailPassword(
  email: string,
  password: string,
  deps: SupabaseAuthDependencies = {}
): Promise<SupabaseVerifiedLoginResult> {
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    throw new PdiSupabaseAuthError(
      "L'authentification Supabase est désactivée en mode Sandbox.",
      "sandbox/server-auth-disabled",
      403
    );
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    throw new PdiSupabaseAuthError(
      "Supabase Auth n'est pas configuré dans cet environnement navigateur.",
      "client/supabase-unconfigured",
      503
    );
  }

  const cleanedEmail = (email ?? "").trim();
  if (!cleanedEmail || !password) {
    throw new PdiSupabaseAuthError(
      "Veuillez saisir votre adresse email et votre mot de passe.",
      "auth/missing-credentials",
      400
    );
  }

  const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanedEmail,
    password,
  });

  if (error || !data?.session?.access_token) {
    const rawMsg = error?.message || "";
    if (/email not confirmed/i.test(rawMsg)) {
      throw new PdiSupabaseAuthError(
        "Votre adresse email n'est pas encore confirmée. Vérifiez votre boîte de réception.",
        "auth/unverified-email",
        403,
        "permission_denied"
      );
    }
    throw new PdiSupabaseAuthError(
      "Identifiants Supabase invalides. Vérifiez votre email et votre mot de passe.",
      "auth/invalid-credentials",
      401,
      "token_error"
    );
  }

  try {
    return await verifySupabaseSessionWithServer(data.session.access_token, deps);
  } catch (serverErr) {
    // Fail-closed : ne jamais conserver une session navigateur refusée par le serveur
    await logoutSupabase(deps);
    throw serverErr;
  }
}

// Marqueur mémoire éphémère de flux de récupération (ne stocke AUCUN token, n'accorde AUCUNE auth).
// Permet de survivre au double-montage React StrictMode ou au nettoyage immédiat du hash par GoTrue.
let pendingSupabaseRecoveryHint = false;

export function clearPendingSupabaseRecoveryHint(): void {
  pendingSupabaseRecoveryHint = false;
}

export function hasPendingSupabaseRecoveryHint(): boolean {
  return pendingSupabaseRecoveryHint;
}

/**
 * Déconnexion complète Supabase Auth + purge de la clé de stockage dédiée.
 */
export async function logoutSupabase(deps: SupabaseAuthDependencies = {}): Promise<void> {
  pendingSupabaseRecoveryHint = false;
  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (configured) {
    try {
      const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
      await client.auth.signOut();
    } catch {
      // Purge locale obligatoire même si le réseau est indisponible
    }
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Construit et valide strictement l'URL de redirection (`redirectTo`) pour le lien
 * de récupération de mot de passe Supabase Auth (`/auth/reset-password`).
 *
 * Garanties sécurité :
 * - Autorise uniquement `https://` en production (ou `http://localhost` / `http://127.0.0.1` en dev local).
 * - Refuse toute URL malformée, identifiants embarqués, caractères de contrôle ou schémas dangereux (`javascript:`, `data:`).
 * - Retourne `undefined` hors contexte navigateur si aucune URL explicite n'est fournie.
 */
export function resolveSupabasePasswordResetRedirectUrl(options?: {
  redirectTo?: string;
  locationLike?: { origin?: string };
}): string | undefined {
  const validateSafeUrl = (raw: string): string | undefined => {
    const trimmed = raw.trim();
    if (!trimmed || /[\x00-\x1f\x7f\s'"\\]/.test(trimmed)) {
      return undefined;
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return undefined;
    }
    if (parsed.username || parsed.password) {
      return undefined;
    }
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const protocolAllowed =
      parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalhost);
    if (!protocolAllowed) {
      return undefined;
    }
    return parsed.toString();
  };

  if (typeof options?.redirectTo === "string" && options.redirectTo.trim().length > 0) {
    return validateSafeUrl(options.redirectTo);
  }

  const candidateOrigin =
    options?.locationLike?.origin ??
    (typeof window !== "undefined" &&
    window.location &&
    typeof window.location.origin === "string" &&
    window.location.origin !== "null"
      ? window.location.origin
      : undefined);

  if (!candidateOrigin) {
    return undefined;
  }

  const normalizedOrigin = candidateOrigin.trim().replace(/\/+$/, "");
  return validateSafeUrl(`${normalizedOrigin}${SUPABASE_PASSWORD_RESET_ROUTE}`);
}

/**
 * Envoie un email officiel de réinitialisation de mot de passe via Supabase Auth,
 * avec une URL de redirection HTTPS explicite (`/auth/reset-password`) en contexte navigateur.
 */
export async function sendSupabasePasswordResetEmail(
  email: string,
  deps: SupabaseAuthDependencies = {}
): Promise<void> {
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    throw new PdiSupabaseAuthError(
      "La réinitialisation du mot de passe Supabase est désactivée en mode Sandbox.",
      "sandbox/server-auth-disabled",
      403
    );
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    throw new PdiSupabaseAuthError(
      "Supabase Auth n'est pas configuré dans cet environnement navigateur. Réinitialisation impossible sans bascule Firebase.",
      "client/supabase-unconfigured",
      503
    );
  }

  const cleanedEmail = (email ?? "").trim();
  if (!cleanedEmail) {
    throw new PdiSupabaseAuthError(
      "Veuillez saisir une adresse email valide.",
      "auth/missing-credentials",
      400
    );
  }

  const redirectTo = resolveSupabasePasswordResetRedirectUrl({
    redirectTo: deps.redirectTo,
    locationLike: deps.locationLike,
  });

  const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
  const { error } = redirectTo
    ? await client.auth.resetPasswordForEmail(cleanedEmail, { redirectTo })
    : await client.auth.resetPasswordForEmail(cleanedEmail);
  if (error) {
    const safeMsg = sanitizeSupabaseAuthErrorText(error.message || "").toLowerCase();
    if (safeMsg.includes("rate limit") || safeMsg.includes("too many") || (error as any)?.status === 429) {
      throw new PdiSupabaseAuthError(
        "Trop de demandes de réinitialisation ont été envoyées récemment. Veuillez patienter quelques instants avant de réessayer.",
        "auth/rate-limit",
        429
      );
    }
    throw new PdiSupabaseAuthError(
      "Impossible d'envoyer l'email de réinitialisation Supabase.",
      "auth/reset-password-failed",
      400
    );
  }
}

/**
 * Changement sécurisé de mot de passe pour un utilisateur connecté via Supabase Auth
 * (ré-authentifie d'abord l'ancien mot de passe).
 */
export async function updateSupabaseUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
  deps: SupabaseAuthDependencies = {}
): Promise<void> {
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    throw new PdiSupabaseAuthError(
      "Le changement de mot de passe Supabase est désactivé en mode Sandbox.",
      "sandbox/server-auth-disabled",
      403
    );
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    throw new PdiSupabaseAuthError(
      "Supabase Auth n'est pas configuré dans cet environnement navigateur.",
      "client/supabase-unconfigured",
      503
    );
  }

  const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
  const reauth = await client.auth.signInWithPassword({
    email: email.trim(),
    password: currentPassword,
  });
  if (reauth.error || !reauth.data?.session) {
    throw new PdiSupabaseAuthError(
      "L'ancien mot de passe saisi est incorrect.",
      "auth/invalid-credentials",
      401
    );
  }

  const updated = await client.auth.updateUser({ password: newPassword });
  if (updated.error) {
    throw new PdiSupabaseAuthError(
      "Impossible de mettre à jour le mot de passe Supabase.",
      "auth/password-update-failed",
      400
    );
  }
}

/**
 * Masque tout jeton JWT ou secret potentiellement présent dans un message d'erreur brut
 * avant affichage ou remontée vers l'interface (MIG-04-AUTH-02).
 */
export function sanitizeSupabaseAuthErrorText(rawMessage: unknown): string {
  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return "";
  }
  return rawMessage
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(
      /((?:access_token|refresh_token|provider_token|token_hash|token|code)\s*[=:]\s*)[^\s&;,"']+/gi,
      "$1[REDACTED]"
    )
    .replace(/sb_secret_[0-9a-zA-Z_-]+/g, "[REDACTED_SECRET]")
    .replace(/sbp_[0-9a-zA-Z_-]+/g, "[REDACTED_SECRET]");
}

/**
 * Valide le nouveau mot de passe et sa confirmation selon les règles existantes du projet.
 */
export function validateSupabaseRecoveryPassword(
  newPassword: string,
  confirmPassword: string
): { valid: true } | { valid: false; code: string; message: string } {
  if (typeof newPassword !== "string" || newPassword.length === 0) {
    return {
      valid: false,
      code: "auth/missing-password",
      message: "Veuillez saisir un nouveau mot de passe.",
    };
  }
  if (typeof confirmPassword !== "string" || confirmPassword.length === 0) {
    return {
      valid: false,
      code: "auth/missing-password-confirmation",
      message: "Veuillez confirmer le nouveau mot de passe.",
    };
  }
  if (newPassword.trim().length === 0) {
    return {
      valid: false,
      code: "auth/weak-password",
      message: "Le nouveau mot de passe ne peut pas être composé uniquement d'espaces.",
    };
  }
  if (newPassword.length < SUPABASE_RECOVERY_MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      code: "auth/weak-password",
      message: `Le nouveau mot de passe doit contenir au minimum ${SUPABASE_RECOVERY_MIN_PASSWORD_LENGTH} caractères.`,
    };
  }
  if (newPassword.length > SUPABASE_RECOVERY_MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      code: "auth/weak-password",
      message: `Le nouveau mot de passe ne doit pas dépasser ${SUPABASE_RECOVERY_MAX_PASSWORD_LENGTH} caractères.`,
    };
  }
  if (newPassword !== confirmPassword) {
    return {
      valid: false,
      code: "auth/password-mismatch",
      message: "Les deux mots de passe ne correspondent pas.",
    };
  }
  return { valid: true };
}

function isPasswordResetPathnameOrHash(pathname: string, rawHash: string): boolean {
  const normalizedPath = pathname.trim().replace(/\/+$/, "").toLowerCase();
  const normalizedHash = rawHash.trim().toLowerCase();
  return (
    normalizedPath === SUPABASE_PASSWORD_RESET_ROUTE ||
    normalizedPath === "/reset-password" ||
    normalizedHash === "reset-password" ||
    normalizedHash === "auth/reset-password"
  );
}

/**
 * Extrait uniquement en interne les paramètres d'échange OTP (`token_hash`) ou PKCE (`code`)
 * présents dans l'URL au retour d'un email Supabase. Ne jamais exposer ce résultat à l'UI ou aux logs.
 */
function extractInternalRecoveryExchangeParams(
  locationLike?: { search?: string; hash?: string; pathname?: string }
): { tokenHash: string | null; pkceCode: string | null; typeParam: string; isResetRoute: boolean } {
  const loc =
    locationLike ??
    (typeof window !== "undefined" && window.location ? window.location : undefined);

  if (!loc) {
    return { tokenHash: null, pkceCode: null, typeParam: "", isResetRoute: false };
  }

  const rawSearch = typeof loc.search === "string" ? loc.search.replace(/^\?/, "") : "";
  const rawHash = typeof loc.hash === "string" ? loc.hash.replace(/^#/, "") : "";
  const rawPathname = typeof loc.pathname === "string" ? loc.pathname : "";

  const searchParams = new URLSearchParams(rawSearch);
  const hashParams = new URLSearchParams(rawHash);

  const typeParam = (hashParams.get("type") ?? searchParams.get("type") ?? "").trim().toLowerCase();
  const tokenHash = (searchParams.get("token_hash") ?? hashParams.get("token_hash") ?? "").trim() || null;
  const pkceCode = (searchParams.get("code") ?? "").trim() || null;
  const isResetRoute = isPasswordResetPathnameOrHash(rawPathname, rawHash);

  return { tokenHash, pkceCode, typeParam, isResetRoute };
}

/**
 * Inspecte les paramètres d'URL uniquement pour détecter un retour d'erreur Supabase
 * (ex. `error_code=otp_expired`) ou la présence d'un indice de récupération (`type=recovery`,
 * route `/auth/reset-password`, `token_hash` ou `code`).
 *
 * IMPORTANT : un paramètre d'URL ne constitue JAMAIS une preuve d'identité ni
 * d'authentification ; seule une session Supabase réellement validée est acceptée.
 * Aucun jeton brut n'est jamais retourné par cette fonction.
 */
export function inspectSupabaseRecoveryUrlHint(
  locationLike?: { search?: string; hash?: string; pathname?: string }
): SupabaseRecoveryUrlHint {
  const loc =
    locationLike ??
    (typeof window !== "undefined" && window.location ? window.location : undefined);

  if (!loc) {
    return { hasRecoveryParam: false, hasTokenHash: false, hasPkceCode: false, hasError: false };
  }

  const rawSearch = typeof loc.search === "string" ? loc.search.replace(/^\?/, "") : "";
  const rawHash = typeof loc.hash === "string" ? loc.hash.replace(/^#/, "") : "";
  const rawPathname = typeof loc.pathname === "string" ? loc.pathname : "";

  const searchParams = new URLSearchParams(rawSearch);
  const hashParams = new URLSearchParams(rawHash);

  const typeParam = (hashParams.get("type") ?? searchParams.get("type") ?? "").trim().toLowerCase();
  const isResetRoute = isPasswordResetPathnameOrHash(rawPathname, rawHash);
  const hasRecoveryParam = typeParam === "recovery" || isResetRoute;
  const hasTokenHash = Boolean(
    (searchParams.get("token_hash") ?? hashParams.get("token_hash") ?? "").trim()
  );
  const hasPkceCode = Boolean((searchParams.get("code") ?? "").trim());

  const rawError = (hashParams.get("error") ?? searchParams.get("error") ?? "").trim().toLowerCase();
  const rawErrorCode = (
    hashParams.get("error_code") ??
    searchParams.get("error_code") ??
    ""
  )
    .trim()
    .toLowerCase();
  const rawErrorDesc = (
    hashParams.get("error_description") ??
    searchParams.get("error_description") ??
    ""
  )
    .trim()
    .toLowerCase();

  if (rawError || rawErrorCode) {
    const isExpiredOrInvalidOtp =
      rawErrorCode === "otp_expired" ||
      rawErrorCode === "flow_state_expired" ||
      rawErrorCode === "flow_state_not_found" ||
      rawErrorDesc.includes("expired") ||
      rawErrorDesc.includes("invalid");

    if (hasRecoveryParam || isExpiredOrInvalidOtp || rawError === "access_denied") {
      return {
        hasRecoveryParam,
        hasTokenHash,
        hasPkceCode,
        hasError: true,
        errorCode: rawErrorCode || rawError || "auth/recovery-link-invalid",
        userMessage:
          "Le lien de récupération de mot de passe est invalide ou expiré. Veuillez demander un nouveau lien depuis la page de connexion.",
      };
    }
  }

  return {
    hasRecoveryParam,
    hasTokenHash,
    hasPkceCode,
    hasError: false,
  };
}

/**
 * Supprime les fragments/paramètres d'authentification sensibles de la barre d'adresse
 * une fois que Supabase les a consommés (sans jamais recharger la page).
 */
export function clearSensitiveAuthParamsFromUrl(
  windowLike?: Pick<Window, "location" | "history">,
  options?: { resetToAuthRoot?: boolean }
): void {
  const win = windowLike ?? (typeof window !== "undefined" ? window : undefined);
  if (!win || !win.location || !win.history || typeof win.history.replaceState !== "function") {
    return;
  }

  try {
    const rawPathname = win.location.pathname || "/";
    const pathname =
      options?.resetToAuthRoot && isPasswordResetPathnameOrHash(rawPathname, "")
        ? "/"
        : rawPathname;
    const currentSearch = win.location.search || "";
    const currentHash = win.location.hash || "";

    const sensitivePattern =
      /(access_token|refresh_token|provider_token|token_hash|type=recovery|error_code=|error_description=|code=)/i;

    if (
      !options?.resetToAuthRoot &&
      !sensitivePattern.test(currentSearch) &&
      !sensitivePattern.test(currentHash)
    ) {
      return;
    }

    const cleanSearchParams = new URLSearchParams(currentSearch.replace(/^\?/, ""));
    for (const key of [
      "code",
      "token_hash",
      "type",
      "access_token",
      "refresh_token",
      "error",
      "error_code",
      "error_description",
    ]) {
      cleanSearchParams.delete(key);
    }

    const nextSearch = cleanSearchParams.toString();
    const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}#auth`;
    win.history.replaceState(null, "", nextUrl);
  } catch {
    // Ignore history API restrictions in constrained environments
  }
}

/**
 * Vérifie qu'une session de récupération Supabase est réellement présente, non expirée
 * et confirmée par Supabase Auth (`getUser()`). Ne renvoie jamais aucun token.
 */
export async function validateActiveSupabaseRecoverySession(
  deps: SupabaseAuthDependencies = {}
): Promise<SupabaseRecoverySessionValidationResult> {
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    return {
      valid: false,
      code: "sandbox/server-auth-disabled",
      status: 403,
      message: "La récupération du mot de passe Supabase est désactivée en mode Sandbox.",
    };
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    return {
      valid: false,
      code: "client/supabase-unconfigured",
      status: 503,
      message:
        "Récupération du mot de passe indisponible : la configuration Supabase navigateur est absente ou désactivée. Aucune bascule Firebase n'est autorisée.",
    };
  }

  try {
    const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session || !data.session.access_token) {
      return {
        valid: false,
        code: "auth/recovery-session-missing",
        status: 401,
        message:
          "Aucune session de récupération Supabase active. Veuillez ouvrir un lien de récupération valide reçu par e-mail.",
      };
    }

    const session = data.session;
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = typeof session.expires_at === "number" ? session.expires_at : null;
    if (expiresAt !== null && expiresAt > 0 && expiresAt <= nowSec) {
      return {
        valid: false,
        code: "auth/recovery-session-expired",
        status: 401,
        message:
          "Votre session de récupération a expiré. Veuillez demander un nouveau lien de réinitialisation.",
      };
    }

    // Vérification auprès de Supabase Auth (ne jamais se fier à un simple paramètre URL ou cache local)
    let verifiedUser = session.user ?? null;
    if (typeof client.auth.getUser === "function") {
      const userCheck = await client.auth.getUser();
      if (userCheck.error || !userCheck.data?.user?.id) {
        return {
          valid: false,
          code: "auth/recovery-session-invalid",
          status: 401,
          message:
            "La session de récupération est invalide ou expirée. Veuillez demander un nouveau lien de réinitialisation.",
        };
      }
      if (session.user?.id && userCheck.data.user.id !== session.user.id) {
        return {
          valid: false,
          code: "auth/recovery-session-invalid",
          status: 401,
          message: "Incohérence détectée sur la session de récupération Supabase.",
        };
      }
      verifiedUser = userCheck.data.user;
    }

    if (!verifiedUser || !verifiedUser.id) {
      return {
        valid: false,
        code: "auth/recovery-session-invalid",
        status: 401,
        message:
          "Impossible de vérifier l'identité associée à cette session de récupération Supabase.",
      };
    }

    return {
      valid: true,
      userId: verifiedUser.id,
      email: typeof verifiedUser.email === "string" ? verifiedUser.email : "",
      expiresAt,
    };
  } catch {
    return {
      valid: false,
      code: "auth/recovery-session-invalid",
      status: 503,
      message:
        "Impossible de vérifier la session de récupération Supabase (erreur réseau ou session invalide).",
    };
  }
}

/**
 * Finalise la récupération du mot de passe à partir d'une session de récupération Supabase
 * réellement valide (`supabase.auth.updateUser({ password: newPassword })`).
 *
 * Garanties MIG-04-AUTH-02 :
 * - N'exige jamais l'ancien mot de passe.
 * - Refuse toute session absente, expirée ou invalide.
 * - Ne modifie jamais le rôle, le statut, l'UUID ni `public.profiles`.
 * - Ne déconnecte jamais la session de récupération avant le succès confirmé de `updateUser`.
 * - N'expose jamais aucun token dans les erreurs ni dans la console.
 * - Aucune bascule Firebase.
 */
export async function completeSupabasePasswordRecovery(
  newPassword: string,
  confirmPassword: string,
  deps: SupabaseAuthDependencies = {}
): Promise<SupabasePasswordRecoveryResult> {
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    throw new PdiSupabaseAuthError(
      "La récupération du mot de passe Supabase est désactivée en mode Sandbox.",
      "sandbox/server-auth-disabled",
      403
    );
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    throw new PdiSupabaseAuthError(
      "Récupération du mot de passe indisponible : la configuration Supabase navigateur est absente ou désactivée. Aucune bascule Firebase n'est autorisée.",
      "client/supabase-unconfigured",
      503
    );
  }

  const pwdValidation = validateSupabaseRecoveryPassword(newPassword, confirmPassword);
  if ("code" in pwdValidation) {
    throw new PdiSupabaseAuthError(pwdValidation.message, pwdValidation.code, 400);
  }

  const sessionCheck = await validateActiveSupabaseRecoverySession(deps);
  if ("code" in sessionCheck) {
    throw new PdiSupabaseAuthError(
      sessionCheck.message,
      sessionCheck.code,
      sessionCheck.status
    );
  }

  const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
  let updateResult: Awaited<ReturnType<typeof client.auth.updateUser>>;
  try {
    // Met à jour STRICTEMENT le mot de passe (jamais de metadata, rôle, statut ou profil)
    updateResult = await client.auth.updateUser({ password: newPassword });
  } catch {
    throw new PdiSupabaseAuthError(
      "Erreur réseau lors de l'enregistrement du nouveau mot de passe Supabase. Réessayez.",
      "auth/network-error",
      503
    );
  }

  if (updateResult.error) {
    const safeRaw = sanitizeSupabaseAuthErrorText(updateResult.error.message || "").toLowerCase();
    if (safeRaw.includes("same password") || safeRaw.includes("different from the old password")) {
      throw new PdiSupabaseAuthError(
        "Le nouveau mot de passe doit être différent de l'ancien mot de passe.",
        "auth/same-password",
        400
      );
    }
    if (safeRaw.includes("expired") || safeRaw.includes("invalid jwt") || safeRaw.includes("session")) {
      throw new PdiSupabaseAuthError(
        "Votre session de récupération a expiré ou n'est plus valide. Veuillez demander un nouveau lien.",
        "auth/recovery-session-expired",
        401
      );
    }
    if (safeRaw.includes("weak") || safeRaw.includes("at least") || safeRaw.includes("characters")) {
      throw new PdiSupabaseAuthError(
        "Le mot de passe ne respecte pas la politique de sécurité Supabase. Choisissez un mot de passe plus robuste.",
        "auth/weak-password",
        400
      );
    }
    throw new PdiSupabaseAuthError(
      "Impossible d'enregistrer le nouveau mot de passe Supabase. Veuillez réessayer ou demander un nouveau lien.",
      "auth/password-update-failed",
      400
    );
  }

  const updatedUser = updateResult.data?.user;
  if (updatedUser && updatedUser.id && updatedUser.id !== sessionCheck.userId) {
    throw new PdiSupabaseAuthError(
      "Incohérence d'identité détectée lors de la mise à jour du mot de passe.",
      "auth/invalid-claims",
      403
    );
  }

  // Déconnexion propre de la session temporaire de récupération APRÈS confirmation de la mise à jour,
  // afin que l'utilisateur revienne à une connexion normale avec son nouveau mot de passe.
  try {
    await logoutSupabase(deps);
  } catch {
    // La mise à jour du mot de passe est confirmée même si la fermeture locale échoue
  }

  return {
    updated: true,
    userId: sessionCheck.userId,
    email: updatedUser?.email || sessionCheck.email,
  };
}

/**
 * Récupère les données réelles d'administration Supabase (`GET /api/admin/supabase/overview`).
 * Protégé côté serveur par `requireSupabaseAuth` + `requireSupabaseSuperAdmin`.
 */
export async function fetchSupabaseSuperAdminOverview(
  deps: SupabaseAuthDependencies = {}
): Promise<SupabaseAdminOverviewData> {
  const token = await getSupabaseAccessToken(false, deps);
  if (!token) {
    throw new PdiSupabaseAuthError(
      "Session Supabase absente ou expirée.",
      "auth/missing-token",
      401
    );
  }

  const fetchFn = deps.fetchImpl ?? fetch;
  let response = await fetchFn("/api/admin/supabase/overview", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    const refreshed = await getSupabaseAccessToken(true, deps);
    if (refreshed) {
      response = await fetchFn("/api/admin/supabase/overview", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${refreshed}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (!response.ok || body.ok !== true || !body.overview) {
    const code = typeof body.code === "string" ? body.code : "auth/forbidden-super-admin";
    const msg = typeof body.error === "string" ? body.error : undefined;
    throw new PdiSupabaseAuthError(
      mapErrorCodeToFrenchMessage(code, msg),
      code,
      response.status
    );
  }

  return body.overview as SupabaseAdminOverviewData;
}

export interface AttachSupabaseAuthMonitorOptions {
  deps?: SupabaseAuthDependencies;
  onSessionVerified: (result: SupabaseVerifiedLoginResult, event: AuthChangeEvent) => void;
  onSessionRevokedOrSignedOut: (reason: {
    event: AuthChangeEvent | "SERVER_DENIED";
    code?: string;
    message?: string;
  }) => void;
  onNoInitialSession?: () => void;
  /** Déclenché uniquement lorsqu'une session de récupération Supabase est validée (MIG-04-AUTH-02) */
  onPasswordRecovery?: (context: SupabasePasswordRecoveryContext) => void;
  /** Déclenché lorsqu'un retour de récupération échoue (session absente, invalide ou expirée) */
  onPasswordRecoveryInvalid?: (reason: { code: string; message: string }) => void;
}

/**
 * Surveille les événements de session Supabase (`INITIAL_SESSION`, `PASSWORD_RECOVERY`, `SIGNED_IN`,
 * `TOKEN_REFRESHED`, `SIGNED_OUT`, `USER_UPDATED`) et revalide systématiquement chaque session/token côté serveur.
 *
 * Garanties MIG-05-FIX-02 :
 * - Immunisé contre la course `PASSWORD_RECOVERY` vs `INITIAL_SESSION` / `SIGNED_IN`.
 * - Compatible avec les 3 formats de liens Supabase (fragment implicite `#access_token=...&type=recovery`,
 *   PKCE `?code=...` sur `/auth/reset-password`, et modèle OTP `?token_hash=...&type=recovery`).
 * - Résilient au double-montage React `<StrictMode>` tout en exigeant systématiquement une session
 *   réellement validée côté Supabase (`getUser()`).
 */
export function attachSupabaseAuthMonitor(options: AttachSupabaseAuthMonitorOptions): () => void {
  const deps = options.deps ?? {};
  const inSandbox = deps.isSandbox ? deps.isSandbox() : isStagingSandboxMode();
  if (inSandbox) {
    return () => {};
  }

  const configured = deps.isConfigured ? deps.isConfigured() : isSupabaseBrowserConfigured();
  if (!configured) {
    options.onNoInitialSession?.();
    return () => {};
  }

  const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
  const initialUrlHint = inspectSupabaseRecoveryUrlHint(deps.locationLike);
  const exchangeParams = extractInternalRecoveryExchangeParams(deps.locationLike);

  if (initialUrlHint.hasRecoveryParam && !initialUrlHint.hasError) {
    pendingSupabaseRecoveryHint = true;
  }

  let active = true;
  let seq = 0;
  let inRecoveryFlow = false;
  // Verrou synchrone empêchant INITIAL_SESSION / SIGNED_IN d'annuler une validation PASSWORD_RECOVERY en vol
  let recoveryValidationInFlight = false;
  let recoveryDispatched = false;
  let tokenHashExchangeInFlight = false;

  const validateRecoveryEventSession = async (session: Session | null) => {
    if (!session || !session.access_token) {
      return {
        valid: false as const,
        code: "auth/recovery-session-missing",
        message:
          "Aucune session de récupération Supabase active. Veuillez ouvrir un lien de récupération valide.",
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = typeof session.expires_at === "number" ? session.expires_at : null;
    if (expiresAt !== null && expiresAt > 0 && expiresAt <= nowSec) {
      return {
        valid: false as const,
        code: "auth/recovery-session-expired",
        message:
          "Votre session de récupération a expiré. Veuillez demander un nouveau lien de réinitialisation.",
      };
    }

    let verifiedUser = session.user ?? null;
    if (typeof client.auth.getUser === "function") {
      try {
        const userCheck = await client.auth.getUser();
        if (userCheck.error || !userCheck.data?.user?.id) {
          return {
            valid: false as const,
            code: "auth/recovery-session-invalid",
            message:
              "La session de récupération est invalide ou expirée. Veuillez demander un nouveau lien de réinitialisation.",
          };
        }
        if (session.user?.id && userCheck.data.user.id !== session.user.id) {
          return {
            valid: false as const,
            code: "auth/recovery-session-invalid",
            message: "Incohérence détectée sur la session de récupération Supabase.",
          };
        }
        verifiedUser = userCheck.data.user;
      } catch {
        return {
          valid: false as const,
          code: "auth/recovery-session-invalid",
          message:
            "Impossible de vérifier la session de récupération Supabase. Veuillez demander un nouveau lien.",
        };
      }
    }

    if (!verifiedUser || !verifiedUser.id) {
      return {
        valid: false as const,
        code: "auth/recovery-session-invalid",
        message: "La session de récupération Supabase est incomplète ou invalide.",
      };
    }

    return {
      valid: true as const,
      context: {
        userId: verifiedUser.id,
        email: typeof verifiedUser.email === "string" ? verifiedUser.email : "",
        expiresAt,
      },
    };
  };

  const handleValidatedRecoverySession = async (session: Session | null) => {
    if (recoveryDispatched) return;
    recoveryValidationInFlight = true;
    pendingSupabaseRecoveryHint = true;
    const check = await validateRecoveryEventSession(session);
    recoveryValidationInFlight = false;
    if (!active) return;

    if ("code" in check) {
      inRecoveryFlow = false;
      pendingSupabaseRecoveryHint = false;
      options.onPasswordRecoveryInvalid?.({
        code: check.code,
        message: check.message,
      });
      return;
    }

    inRecoveryFlow = true;
    recoveryDispatched = true;
    options.onPasswordRecovery?.(check.context);
  };

  // Support explicite des liens email Supabase au format `?token_hash=...&type=recovery`
  // (non échangés automatiquement par detectSessionInUrl).
  if (
    exchangeParams.tokenHash &&
    initialUrlHint.hasRecoveryParam &&
    !initialUrlHint.hasError &&
    typeof client.auth.verifyOtp === "function"
  ) {
    tokenHashExchangeInFlight = true;
    recoveryValidationInFlight = true;
    void (async () => {
      try {
        const otpRes = await client.auth.verifyOtp({
          token_hash: exchangeParams.tokenHash!,
          type: "recovery",
        });
        tokenHashExchangeInFlight = false;
        if (!active) return;
        if (otpRes.error || !otpRes.data?.session) {
          recoveryValidationInFlight = false;
          inRecoveryFlow = false;
          pendingSupabaseRecoveryHint = false;
          options.onPasswordRecoveryInvalid?.({
            code: "auth/recovery-link-invalid",
            message:
              "Le lien de récupération de mot de passe est invalide ou expiré. Veuillez demander un nouveau lien depuis la page de connexion.",
          });
          return;
        }
        await handleValidatedRecoverySession(otpRes.data.session);
      } catch {
        tokenHashExchangeInFlight = false;
        recoveryValidationInFlight = false;
        if (!active) return;
        inRecoveryFlow = false;
        pendingSupabaseRecoveryHint = false;
        options.onPasswordRecoveryInvalid?.({
          code: "auth/recovery-link-invalid",
          message:
            "Impossible de valider le lien de récupération de mot de passe. Veuillez demander un nouveau lien.",
        });
      }
    })();
  }

  const verifyAndDispatch = async (event: AuthChangeEvent, session: Session | null) => {
    // MIG-04-AUTH-02 & MIG-05-FIX-02 : Parcours dédié de récupération de mot de passe Supabase.
    // Ne déconnecte JAMAIS prématurément la session et ne laisse aucun événement concurrent
    // (INITIAL_SESSION / SIGNED_IN) annuler PASSWORD_RECOVERY.
    if (event === "PASSWORD_RECOVERY") {
      if (tokenHashExchangeInFlight) {
        return;
      }
      await handleValidatedRecoverySession(session);
      return;
    }

    // Tant qu'un échange token_hash ou une validation PASSWORD_RECOVERY est en vol,
    // ou que l'utilisateur est dans l'écran de saisie du nouveau mot de passe,
    // bloquer toute bascule intempestive vers le workspace ou erreur prématurée.
    if (
      (recoveryValidationInFlight || tokenHashExchangeInFlight || inRecoveryFlow) &&
      event !== "SIGNED_OUT"
    ) {
      return;
    }

    const currentSeq = ++seq;

    if (event === "SIGNED_OUT") {
      inRecoveryFlow = false;
      recoveryValidationInFlight = false;
      recoveryDispatched = false;
      pendingSupabaseRecoveryHint = false;
      if (!active || currentSeq !== seq) return;
      options.onSessionRevokedOrSignedOut({ event });
      return;
    }

    if (!session || !session.access_token) {
      if (!active || currentSeq !== seq) return;
      if (event === "INITIAL_SESSION") {
        if (initialUrlHint.hasError && initialUrlHint.userMessage) {
          pendingSupabaseRecoveryHint = false;
          options.onPasswordRecoveryInvalid?.({
            code: initialUrlHint.errorCode || "auth/recovery-link-invalid",
            message: initialUrlHint.userMessage,
          });
          return;
        }
        // Si un code PKCE est présent sur la route de récupération et que GoTrue ne l'a pas encore échangé,
        // tenter l'échange explicite une seule fois avant de conclure à l'absence de session.
        if (
          exchangeParams.pkceCode &&
          initialUrlHint.hasRecoveryParam &&
          typeof client.auth.exchangeCodeForSession === "function"
        ) {
          recoveryValidationInFlight = true;
          try {
            const pkceRes = await client.auth.exchangeCodeForSession(exchangeParams.pkceCode);
            if (!active) return;
            if (!pkceRes.error && pkceRes.data?.session) {
              await handleValidatedRecoverySession(pkceRes.data.session);
              return;
            }
          } catch {
            // Poursuit vers le refus contrôlé
          } finally {
            recoveryValidationInFlight = false;
          }
          if (!active) return;
          pendingSupabaseRecoveryHint = false;
          options.onPasswordRecoveryInvalid?.({
            code: "auth/recovery-link-invalid",
            message:
              "Le lien de récupération de mot de passe est invalide ou expiré. Veuillez demander un nouveau lien depuis la page de connexion.",
          });
          return;
        }
        if (initialUrlHint.hasRecoveryParam) {
          // URL contenant type=recovery ou /auth/reset-password sans aucune session Supabase valide -> refus explicite
          pendingSupabaseRecoveryHint = false;
          options.onPasswordRecoveryInvalid?.({
            code: "auth/recovery-session-missing",
            message:
              "Le lien de récupération ne contient pas de session Supabase valide ou a expiré. Demandez un nouveau lien.",
          });
          return;
        }
        pendingSupabaseRecoveryHint = false;
        options.onNoInitialSession?.();
      } else {
        options.onSessionRevokedOrSignedOut({ event });
      }
      return;
    }

    // Si GoTrue émet INITIAL_SESSION ou SIGNED_IN lors d'un retour de lien recovery
    // (ou après double-montage StrictMode quand GoTrue a déjà consommé le hash URL),
    // valider la session de récupération au lieu d'entrer directement dans le workspace.
    if (
      (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
      (initialUrlHint.hasRecoveryParam || pendingSupabaseRecoveryHint) &&
      options.onPasswordRecovery
    ) {
      await handleValidatedRecoverySession(session);
      return;
    }

    try {
      const verified = await verifySupabaseSessionWithServer(session.access_token, deps);
      if (!active || currentSeq !== seq || inRecoveryFlow || recoveryValidationInFlight) return;
      options.onSessionVerified(verified, event);
    } catch (err) {
      if (!active || currentSeq !== seq || inRecoveryFlow || recoveryValidationInFlight) return;
      const authErr =
        err instanceof PdiSupabaseAuthError
          ? err
          : new PdiSupabaseAuthError(
              "Session Supabase refusée par le serveur.",
              "auth/invalid-token",
              401
            );

      // Si token expiré (401), tenter un rafraîchissement unique avant de déconnecter
      if (authErr.status === 401 && authErr.code === "auth/token-expired") {
        const refreshedToken = await getSupabaseAccessToken(true, deps);
        if (refreshedToken && active && currentSeq === seq) {
          try {
            const retried = await verifySupabaseSessionWithServer(refreshedToken, deps);
            if (!active || currentSeq !== seq) return;
            options.onSessionVerified(retried, "TOKEN_REFRESHED");
            return;
          } catch {
            // Poursuit vers la révocation fail-closed
          }
        }
      }

      // Ne pas déconnecter sur erreur transitoire 503 réseau si session initiale ; sinon révoquer
      if (authErr.status === 401 || authErr.status === 403) {
        await logoutSupabase(deps);
      }

      options.onSessionRevokedOrSignedOut({
        event: "SERVER_DENIED",
        code: authErr.code,
        message: authErr.message,
      });
    }
  };

  const { data } = client.auth.onAuthStateChange((event, session) => {
    void verifyAndDispatch(event, session);
  });

  return () => {
    active = false;
    data?.subscription?.unsubscribe();
  };
}
