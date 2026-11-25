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
} from "./firebase";
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
}

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
    const code = typeof body.code === "string" ? body.code : "auth/invalid-token";
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

/**
 * Déconnexion complète Supabase Auth + purge de la clé de stockage dédiée.
 */
export async function logoutSupabase(deps: SupabaseAuthDependencies = {}): Promise<void> {
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
 * Envoie un email officiel de réinitialisation de mot de passe via Supabase Auth.
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
  const client = deps.getClient ? deps.getClient() : getSupabaseBrowserClient();
  const { error } = await client.auth.resetPasswordForEmail(cleanedEmail);
  if (error) {
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
}

/**
 * Surveille les événements de session Supabase (`INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`,
 * `SIGNED_OUT`, `USER_UPDATED`) et revalide systématiquement chaque session/token côté serveur.
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
  let active = true;
  let seq = 0;

  const verifyAndDispatch = async (event: AuthChangeEvent, session: Session | null) => {
    const currentSeq = ++seq;
    if (!session || !session.access_token) {
      if (!active || currentSeq !== seq) return;
      if (event === "INITIAL_SESSION") {
        options.onNoInitialSession?.();
      } else {
        options.onSessionRevokedOrSignedOut({ event });
      }
      return;
    }

    try {
      const verified = await verifySupabaseSessionWithServer(session.access_token, deps);
      if (!active || currentSeq !== seq) return;
      options.onSessionVerified(verified, event);
    } catch (err) {
      if (!active || currentSeq !== seq) return;
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
