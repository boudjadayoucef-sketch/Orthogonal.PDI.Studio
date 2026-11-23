/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-03-BOOTSTRAP-01
 * Bootstrap Zero-Trust serveur du premier super administrateur Supabase
 * ============================================================================
 *
 * Garanties de sécurité :
 * 1. Exclusivement serveur (`service_role` / `sb_secret_`), jamais appelable depuis un navigateur.
 * 2. Restreint à un seul email exact autorisé : `orthognaleng@gmail.com`.
 * 3. Activation explicite requise via `SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=true` (fail-closed par défaut).
 * 4. Interdit en mode Sandbox (`PDI_ENV=sandbox`).
 * 5. Deux phases strictes :
 *    - Phase 1 (email non confirmé) : invite l'utilisateur via Supabase Auth Admin API
 *      (sans forcer `email_confirm: true` et sans claim dans `user_metadata`), crée un profil
 *      non privilégié (`role = 'client'`, `status = 'pending_activation'`) et trace dans `public.audit_logs`.
 *      Aucun privilège `super_admin` n'est effectif tant que `email_confirmed_at IS NULL`.
 *    - Phase 2 (email réellement confirmé) : promeut `public.profiles` vers `role = 'super_admin'`
 *      et `status = 'active'` sans écraser les données existantes, vérifie l'état relu et écrit
 *      dans `public.audit_logs`.
 * 6. Idempotent : les réexécutions ne créent aucun doublon, ne rétrogradent pas et n'écrasent pas
 *    le profil existant ; la présence d'un autre `super_admin` bloque immédiatement l'opération.
 * 7. Rollback compensatoire : toute erreur Supabase après une écriture partielle restaure l'état
 *    antérieur (ou supprime le compte/profil nouvellement créé) afin de ne jamais laisser un profil
 *    partiellement privilégié.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isStagingSandboxMode } from "../lib/stagingSandbox.ts";
import { sanitizeSupabaseAdminError } from "./supabaseAdmin.ts";

export const AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL = "orthognaleng@gmail.com" as const;
export const SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG =
  "SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED" as const;
export const DEFAULT_SUPER_ADMIN_DISPLAY_NAME = "Orthogonal Super Admin" as const;

export const BLOCKED_NEGATIVE_PROFILE_STATUSES = new Set<string>([
  "suspended",
  "revoked",
  "disabled",
]);

export type SupabaseProfileRole = "super_admin" | "admin" | "client" | "guest" | "demo";
export type SupabaseProfileStatus =
  | "active"
  | "suspended"
  | "pending_activation"
  | "revoked"
  | "disabled";

export type SupabaseBootstrapErrorCode =
  | "BOOTSTRAP_DISABLED"
  | "BROWSER_CONTEXT_FORBIDDEN"
  | "BROWSER_REQUEST_FORBIDDEN"
  | "SANDBOX_MODE_FORBIDDEN"
  | "UNAUTHORIZED_EMAIL"
  | "INVALID_REDIRECT_URL"
  | "MULTIPLE_SUPER_ADMINS_FORBIDDEN"
  | "NEGATIVE_PROFILE_STATUS_BLOCKED"
  | "EMAIL_MISMATCH_INTEGRITY_ERROR"
  | "SUPABASE_API_ERROR"
  | "ROLLBACK_FAILED";

export class SupabaseBootstrapError extends Error {
  public readonly code: SupabaseBootstrapErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: SupabaseBootstrapErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SupabaseBootstrapError";
    this.code = code;
    this.details = details;
  }
}

export interface BootstrapAuthUserRecord {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  invited_at?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

export interface BootstrapProfileRecord {
  id: string;
  email: string;
  name: string;
  display_name?: string | null;
  role: SupabaseProfileRole;
  status: SupabaseProfileStatus;
  account_type?: "basic" | "pro" | "team" | "enterprise";
  subscription_plan?: "monthly" | "yearly" | "trial" | "lifetime";
  firebase_uid?: string | null;
  company?: string | null;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BootstrapProfileInsert {
  id: string;
  email: string;
  name: string;
  display_name?: string | null;
  role: SupabaseProfileRole;
  status: SupabaseProfileStatus;
  account_type?: "basic" | "pro" | "team" | "enterprise";
  subscription_plan?: "monthly" | "yearly" | "trial" | "lifetime";
}

export interface BootstrapProfileUpdate {
  role?: SupabaseProfileRole;
  status?: SupabaseProfileStatus;
}

export interface BootstrapAuditLogInsert {
  actor_user_id: string | null;
  target_user_id: string | null;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  severity: "info" | "warning" | "critical";
  metadata: Record<string, unknown>;
}

export interface SupabaseBootstrapGateway {
  findAuthUserByEmail(email: string): Promise<BootstrapAuthUserRecord | null>;
  inviteAuthUserByEmail(
    email: string,
    options?: { redirectTo?: string }
  ): Promise<BootstrapAuthUserRecord>;
  deleteAuthUserById(userId: string): Promise<void>;
  listSuperAdminProfiles(): Promise<BootstrapProfileRecord[]>;
  findProfileById(id: string): Promise<BootstrapProfileRecord | null>;
  findProfileByEmail(email: string): Promise<BootstrapProfileRecord | null>;
  insertProfile(record: BootstrapProfileInsert): Promise<BootstrapProfileRecord>;
  updateProfile(id: string, patch: BootstrapProfileUpdate): Promise<BootstrapProfileRecord>;
  deleteProfile(id: string): Promise<void>;
  insertAuditLog(entry: BootstrapAuditLogInsert): Promise<{ id: string }>;
}

export interface BootstrapRequestContext {
  source?: "server_cli" | "server_internal" | "browser" | "http_client";
  origin?: string | null;
  userAgent?: string | null;
  clientRequestedRole?: string | null;
}

export interface BootstrapSupabaseSuperAdminOptions {
  gateway: SupabaseBootstrapGateway;
  env?: Record<string, string | undefined>;
  targetEmail?: string;
  dryRun?: boolean;
  operatorId?: string;
  redirectTo?: string;
  allowInsecureLocalhost?: boolean;
  isBrowserRuntime?: boolean;
  requestContext?: BootstrapRequestContext;
}

export type BootstrapExecutionPhase =
  | "dry_run_would_invite_and_provision_pending"
  | "dry_run_awaiting_email_confirmation"
  | "dry_run_would_activate_super_admin"
  | "dry_run_already_active"
  | "awaiting_email_confirmation"
  | "activated"
  | "already_active";

export interface BootstrapSupabaseSuperAdminResult {
  ok: true;
  dryRun: boolean;
  phase: BootstrapExecutionPhase;
  targetEmail: typeof AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL;
  userId: string | null;
  emailConfirmed: boolean;
  emailConfirmedAt: string | null;
  profileRole: SupabaseProfileRole | null;
  profileStatus: SupabaseProfileStatus | null;
  privilegesEffective: boolean;
  auditLogId: string | null;
  actions: string[];
  nextStep: string;
}

export interface SuperAdminAuthorityCheckResult {
  isEffectiveSuperAdmin: boolean;
  reasons: string[];
}

export function normalizeBootstrapEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isEmailConfirmed(
  authUser: Pick<BootstrapAuthUserRecord, "email_confirmed_at"> | null | undefined
): boolean {
  return (
    typeof authUser?.email_confirmed_at === "string" &&
    authUser.email_confirmed_at.trim().length > 0
  );
}

/**
 * Kill-switch serveur explicite : fail-closed par défaut.
 * Seule la valeur exacte `"true"` active le bootstrap.
 */
export function isSupabaseBootstrapEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env[SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG];
  if (typeof raw !== "string") {
    return false;
  }
  return raw.trim() === "true";
}

/**
 * Vérification autoritative côté serveur reproduisant exactement `public.is_super_admin()` :
 * - ne lit JAMAIS `user_metadata` ni `app_metadata` ;
 * - exige `auth.users.id === public.profiles.id`, email concordant, `email_confirmed_at IS NOT NULL`,
 *   `profile.role === 'super_admin'` et `profile.status === 'active'`.
 */
export function verifySupabaseSuperAdminAuthority(params: {
  authUser: BootstrapAuthUserRecord | null | undefined;
  profile: BootstrapProfileRecord | null | undefined;
}): SuperAdminAuthorityCheckResult {
  const reasons: string[] = [];
  const { authUser, profile } = params;

  if (!authUser) {
    reasons.push("AUTH_USER_MISSING");
  }
  if (!profile) {
    reasons.push("PROFILE_MISSING");
  }
  if (authUser && profile) {
    if (authUser.id !== profile.id) {
      reasons.push("USER_ID_MISMATCH");
    }
    if (normalizeBootstrapEmail(authUser.email) !== normalizeBootstrapEmail(profile.email)) {
      reasons.push("EMAIL_MISMATCH");
    }
  }
  if (authUser && !isEmailConfirmed(authUser)) {
    reasons.push("EMAIL_NOT_CONFIRMED");
  }
  if (profile && profile.role !== "super_admin") {
    reasons.push(`ROLE_NOT_SUPER_ADMIN:${profile.role}`);
  }
  if (profile && profile.status !== "active") {
    reasons.push(`STATUS_NOT_ACTIVE:${profile.status}`);
  }

  return {
    isEffectiveSuperAdmin: reasons.length === 0,
    reasons,
  };
}

function validateRedirectToUrl(
  rawRedirectTo: string | undefined,
  allowInsecureLocalhost: boolean
): string | undefined {
  const trimmed = (rawRedirectTo ?? "").trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SupabaseBootstrapError(
      "INVALID_REDIRECT_URL",
      "SUPABASE_SUPER_ADMIN_REDIRECT_URL est mal formée."
    );
  }

  if (parsed.username || parsed.password) {
    throw new SupabaseBootstrapError(
      "INVALID_REDIRECT_URL",
      "SUPABASE_SUPER_ADMIN_REDIRECT_URL ne doit pas contenir d'identifiants."
    );
  }

  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const protocolOk =
    parsed.protocol === "https:" ||
    (allowInsecureLocalhost && parsed.protocol === "http:" && isLocalhost);

  if (!protocolOk) {
    throw new SupabaseBootstrapError(
      "INVALID_REDIRECT_URL",
      "SUPABASE_SUPER_ADMIN_REDIRECT_URL doit utiliser le protocole HTTPS."
    );
  }

  return parsed.toString();
}

function assertServerOnlyContext(options: BootstrapSupabaseSuperAdminOptions): void {
  const isBrowser =
    typeof options.isBrowserRuntime === "boolean"
      ? options.isBrowserRuntime
      : typeof globalThis.window !== "undefined" || typeof globalThis.document !== "undefined";

  if (isBrowser) {
    throw new SupabaseBootstrapError(
      "BROWSER_CONTEXT_FORBIDDEN",
      "Le bootstrap super_admin Supabase ne peut jamais s'exécuter dans un navigateur."
    );
  }

  const ctx = options.requestContext;
  if (ctx) {
    if (ctx.source === "browser" || ctx.source === "http_client") {
      throw new SupabaseBootstrapError(
        "BROWSER_REQUEST_FORBIDDEN",
        "Aucune requête navigateur ou cliente HTTP ne peut déclencher le bootstrap super_admin."
      );
    }
    if (typeof ctx.origin === "string" && ctx.origin.trim().length > 0) {
      throw new SupabaseBootstrapError(
        "BROWSER_REQUEST_FORBIDDEN",
        "Une requête portant un en-tête Origin navigateur ne peut pas déclencher le bootstrap super_admin."
      );
    }
    if (typeof ctx.clientRequestedRole === "string" && ctx.clientRequestedRole.trim().length > 0) {
      throw new SupabaseBootstrapError(
        "BROWSER_REQUEST_FORBIDDEN",
        "Un rôle fourni par une requête cliente (ex. super_admin) est strictement rejeté."
      );
    }
  }
}

export function assertAuthorizedBootstrapEmail(targetEmail: string | undefined): typeof AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL {
  const normalized = normalizeBootstrapEmail(targetEmail);
  if (normalized !== AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL) {
    throw new SupabaseBootstrapError(
      "UNAUTHORIZED_EMAIL",
      `Seul l'email autorisé '${AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL}' est accepté par MIG-03-BOOTSTRAP-01.`,
      { receivedEmail: normalized || "(empty)" }
    );
  }
  return AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL;
}

export async function bootstrapSupabaseSuperAdmin(
  options: BootstrapSupabaseSuperAdminOptions
): Promise<BootstrapSupabaseSuperAdminResult> {
  const env = options.env ?? process.env;
  const dryRun = options.dryRun === true;
  const operatorId = (options.operatorId ?? "server-cli").trim() || "server-cli";
  const allowInsecureLocalhost = options.allowInsecureLocalhost === true;

  // 1. Rejet strict navigateur / requête cliente / rôle envoyé par client
  assertServerOnlyContext(options);

  // 2. Rejet strict en mode Sandbox
  if (isStagingSandboxMode(env)) {
    throw new SupabaseBootstrapError(
      "SANDBOX_MODE_FORBIDDEN",
      "Le bootstrap super_admin Supabase est interdit lorsque PDI_ENV=sandbox est actif."
    );
  }

  // 3. Kill-switch explicite (désactivé par défaut)
  if (!isSupabaseBootstrapEnabled(env)) {
    throw new SupabaseBootstrapError(
      "BOOTSTRAP_DISABLED",
      `Bootstrap désactivé. Définir ${SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG}=true uniquement pendant la fenêtre d'exécution serveur, puis le repasser à false.`
    );
  }

  // 4. Restriction exclusive à orthognaleng@gmail.com
  const targetEmail = assertAuthorizedBootstrapEmail(
    options.targetEmail ?? AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL
  );

  // 5. Validation stricte de l'URL de redirection d'invitation si fournie
  const redirectTo = validateRedirectToUrl(
    options.redirectTo ?? env.SUPABASE_SUPER_ADMIN_REDIRECT_URL,
    allowInsecureLocalhost
  );

  const { gateway } = options;
  const actions: string[] = [];

  // 6. Vérifier qu'aucun AUTRE super_admin n'existe déjà
  let existingSuperAdmins: BootstrapProfileRecord[];
  try {
    existingSuperAdmins = await gateway.listSuperAdminProfiles();
  } catch (err) {
    throw new SupabaseBootstrapError(
      "SUPABASE_API_ERROR",
      `Impossible de vérifier les profils super_admin existants : ${sanitizeSupabaseAdminError(err)}`
    );
  }

  const conflictingSuperAdmins = existingSuperAdmins.filter(
    (p) => normalizeBootstrapEmail(p.email) !== targetEmail
  );
  if (conflictingSuperAdmins.length > 0) {
    throw new SupabaseBootstrapError(
      "MULTIPLE_SUPER_ADMINS_FORBIDDEN",
      "Un autre compte super_admin existe déjà dans public.profiles. Création d'un second super_admin bloquée.",
      { existingCount: conflictingSuperAdmins.length }
    );
  }

  // 7. Lire l'état existant dans auth.users et public.profiles
  let authUser: BootstrapAuthUserRecord | null;
  let profileByEmail: BootstrapProfileRecord | null;
  let profileById: BootstrapProfileRecord | null = null;
  try {
    authUser = await gateway.findAuthUserByEmail(targetEmail);
    profileByEmail = await gateway.findProfileByEmail(targetEmail);
    if (authUser) {
      profileById = await gateway.findProfileById(authUser.id);
    }
  } catch (err) {
    throw new SupabaseBootstrapError(
      "SUPABASE_API_ERROR",
      `Impossible de lire l'état existant Supabase : ${sanitizeSupabaseAdminError(err)}`
    );
  }

  // Vérification d'intégrité entre auth.users et public.profiles
  if (authUser && profileByEmail && profileByEmail.id !== authUser.id) {
    throw new SupabaseBootstrapError(
      "EMAIL_MISMATCH_INTEGRITY_ERROR",
      "Incohérence critique : un profil public.profiles porte déjà cet email avec un autre UUID que auth.users."
    );
  }
  if (authUser && profileById && normalizeBootstrapEmail(profileById.email) !== targetEmail) {
    throw new SupabaseBootstrapError(
      "EMAIL_MISMATCH_INTEGRITY_ERROR",
      "Incohérence critique : le profil associé à cet UUID porte un email différent de orthognaleng@gmail.com."
    );
  }

  const existingProfile = profileById ?? profileByEmail;

  // Ne jamais réactiver automatiquement un compte suspendu, révoqué ou désactivé
  if (existingProfile && BLOCKED_NEGATIVE_PROFILE_STATUSES.has(existingProfile.status)) {
    throw new SupabaseBootstrapError(
      "NEGATIVE_PROFILE_STATUS_BLOCKED",
      `Le profil existant est dans un statut bloqué (${existingProfile.status}). Aucune réactivation automatique n'est autorisée.`
    );
  }

  // 8. Mode DRY-RUN (aucune écriture)
  if (dryRun) {
    if (!authUser) {
      return {
        ok: true,
        dryRun: true,
        phase: "dry_run_would_invite_and_provision_pending",
        targetEmail,
        userId: null,
        emailConfirmed: false,
        emailConfirmedAt: null,
        profileRole: existingProfile?.role ?? null,
        profileStatus: existingProfile?.status ?? null,
        privilegesEffective: false,
        auditLogId: null,
        actions: [
          "dry_run: would invite orthognaleng@gmail.com via Supabase Auth Admin API",
          "dry_run: would create unprivileged profile (role=client, status=pending_activation)",
          "dry_run: would record audit log supabase.super_admin.bootstrap.invited",
        ],
        nextStep:
          "Relancer avec --execute pour envoyer l'invitation email, puis confirmer l'email avant d'activer super_admin.",
      };
    }

    const confirmed = isEmailConfirmed(authUser);
    if (!confirmed) {
      return {
        ok: true,
        dryRun: true,
        phase: "dry_run_awaiting_email_confirmation",
        targetEmail,
        userId: authUser.id,
        emailConfirmed: false,
        emailConfirmedAt: null,
        profileRole: existingProfile?.role ?? null,
        profileStatus: existingProfile?.status ?? null,
        privilegesEffective: false,
        auditLogId: null,
        actions: [
          "dry_run: auth.users record exists but email_confirmed_at IS NULL",
          "dry_run: super_admin promotion blocked until real email confirmation",
        ],
        nextStep:
          "Ouvrir l'email de confirmation envoyé à orthognaleng@gmail.com, confirmer le compte, puis relancer avec --execute.",
      };
    }

    const alreadyAuthority = verifySupabaseSuperAdminAuthority({
      authUser,
      profile: existingProfile,
    });
    if (alreadyAuthority.isEffectiveSuperAdmin) {
      return {
        ok: true,
        dryRun: true,
        phase: "dry_run_already_active",
        targetEmail,
        userId: authUser.id,
        emailConfirmed: true,
        emailConfirmedAt: authUser.email_confirmed_at,
        profileRole: existingProfile!.role,
        profileStatus: existingProfile!.status,
        privilegesEffective: true,
        auditLogId: null,
        actions: ["dry_run: super_admin already confirmed and active; no mutation needed"],
        nextStep:
          "Désactiver SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false immédiatement.",
      };
    }

    return {
      ok: true,
      dryRun: true,
      phase: "dry_run_would_activate_super_admin",
      targetEmail,
      userId: authUser.id,
      emailConfirmed: true,
      emailConfirmedAt: authUser.email_confirmed_at,
      profileRole: existingProfile?.role ?? null,
      profileStatus: existingProfile?.status ?? null,
      privilegesEffective: false,
      auditLogId: null,
      actions: [
        existingProfile
          ? "dry_run: would promote existing profile to role=super_admin, status=active (preserving existing fields)"
          : "dry_run: would create confirmed profile with role=super_admin, status=active",
        "dry_run: would record audit log supabase.super_admin.bootstrap.activated",
      ],
      nextStep: "Relancer avec --execute pour finaliser l'activation super_admin.",
    };
  }

  // =========================================================================
  // 9. EXÉCUTION RÉELLE — PHASE 1 : Création/Invitation si inexistant
  // =========================================================================
  if (!authUser) {
    let createdAuthUser: BootstrapAuthUserRecord;
    try {
      createdAuthUser = await gateway.inviteAuthUserByEmail(targetEmail, { redirectTo });
      actions.push("auth.admin.inviteUserByEmail");
    } catch (err) {
      throw new SupabaseBootstrapError(
        "SUPABASE_API_ERROR",
        `Échec de l'invitation Supabase Auth Admin : ${sanitizeSupabaseAdminError(err)}`
      );
    }

    // Ne jamais accorder super_admin avant confirmation réelle de l'email
    let createdProfile: BootstrapProfileRecord | null = null;
    try {
      createdProfile = await gateway.insertProfile({
        id: createdAuthUser.id,
        email: targetEmail,
        name: DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
        display_name: DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
        role: "client",
        status: "pending_activation",
        account_type: "basic",
        subscription_plan: "monthly",
      });
      actions.push("profiles.insert(client,pending_activation)");

      const auditRecord = await gateway.insertAuditLog({
        actor_user_id: null,
        target_user_id: createdAuthUser.id,
        event_type: "supabase.super_admin.bootstrap.invited",
        resource_type: "profile",
        resource_id: createdAuthUser.id,
        severity: "info",
        metadata: {
          bootstrap_ticket: "MIG-03-BOOTSTRAP-01",
          target_email: targetEmail,
          email_confirmed: false,
          granted_role: "client",
          granted_status: "pending_activation",
          intended_role_after_confirmation: "super_admin",
          operator_id: operatorId,
        },
      });
      actions.push("audit_logs.insert(invited)");

      return {
        ok: true,
        dryRun: false,
        phase: "awaiting_email_confirmation",
        targetEmail,
        userId: createdAuthUser.id,
        emailConfirmed: false,
        emailConfirmedAt: null,
        profileRole: createdProfile.role,
        profileStatus: createdProfile.status,
        privilegesEffective: false,
        auditLogId: auditRecord.id,
        actions,
        nextStep:
          "Un email d'invitation/confirmation a été envoyé à orthognaleng@gmail.com. Confirmer l'email et définir le mot de passe, puis relancer le bootstrap avec --execute pour activer le rôle super_admin.",
      };
    } catch (err) {
      // Rollback compensatoire : ne jamais laisser un utilisateur/profil orphelin ou partiel
      const rollbackErrors: string[] = [];
      if (createdProfile) {
        try {
          await gateway.deleteProfile(createdAuthUser.id);
        } catch (rbErr) {
          rollbackErrors.push(`deleteProfile: ${sanitizeSupabaseAdminError(rbErr)}`);
        }
      }
      try {
        await gateway.deleteAuthUserById(createdAuthUser.id);
      } catch (rbErr) {
        rollbackErrors.push(`deleteAuthUserById: ${sanitizeSupabaseAdminError(rbErr)}`);
      }

      if (rollbackErrors.length > 0) {
        throw new SupabaseBootstrapError(
          "ROLLBACK_FAILED",
          `Erreur lors du provisioning initial (${sanitizeSupabaseAdminError(err)}) et échec partiel du rollback (${rollbackErrors.join("; ")}).`,
          { rolledBack: false, rollbackErrors }
        );
      }

      throw new SupabaseBootstrapError(
        "SUPABASE_API_ERROR",
        `Erreur Supabase pendant la Phase 1 du bootstrap (${sanitizeSupabaseAdminError(err)}). Rollback compensatoire effectué.`,
        { rolledBack: true }
      );
    }
  }

  // =========================================================================
  // 10. EXÉCUTION RÉELLE — Utilisateur existant mais email NON confirmé
  // =========================================================================
  if (!isEmailConfirmed(authUser)) {
    let activeProfile = existingProfile;
    let createdPendingProfile = false;

    try {
      if (!activeProfile) {
        activeProfile = await gateway.insertProfile({
          id: authUser.id,
          email: targetEmail,
          name: DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
          display_name: DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
          role: "client",
          status: "pending_activation",
          account_type: "basic",
          subscription_plan: "monthly",
        });
        createdPendingProfile = true;
        actions.push("profiles.insert(client,pending_activation)");
      } else {
        actions.push("profiles.preserved_unconfirmed");
      }

      const auditRecord = await gateway.insertAuditLog({
        actor_user_id: null,
        target_user_id: authUser.id,
        event_type: "supabase.super_admin.bootstrap.awaiting_email_confirmation",
        resource_type: "profile",
        resource_id: authUser.id,
        severity: "warning",
        metadata: {
          bootstrap_ticket: "MIG-03-BOOTSTRAP-01",
          target_email: targetEmail,
          email_confirmed: false,
          current_role: activeProfile.role,
          current_status: activeProfile.status,
          privileges_effective: false,
          operator_id: operatorId,
        },
      });
      actions.push("audit_logs.insert(awaiting_email_confirmation)");

      return {
        ok: true,
        dryRun: false,
        phase: "awaiting_email_confirmation",
        targetEmail,
        userId: authUser.id,
        emailConfirmed: false,
        emailConfirmedAt: null,
        profileRole: activeProfile.role,
        profileStatus: activeProfile.status,
        privilegesEffective: false,
        auditLogId: auditRecord.id,
        actions,
        nextStep:
          "L'email orthognaleng@gmail.com n'est pas encore confirmé dans Supabase Auth (email_confirmed_at IS NULL). Confirmer l'email puis relancer avec --execute.",
      };
    } catch (err) {
      if (createdPendingProfile) {
        try {
          await gateway.deleteProfile(authUser.id);
        } catch (rbErr) {
          throw new SupabaseBootstrapError(
            "ROLLBACK_FAILED",
            `Erreur Supabase (${sanitizeSupabaseAdminError(err)}) et échec rollback profil (${sanitizeSupabaseAdminError(rbErr)}).`,
            { rolledBack: false }
          );
        }
      }
      throw new SupabaseBootstrapError(
        "SUPABASE_API_ERROR",
        `Erreur Supabase pendant la vérification d'email non confirmé : ${sanitizeSupabaseAdminError(err)}`,
        { rolledBack: createdPendingProfile }
      );
    }
  }

  // =========================================================================
  // 11. EXÉCUTION RÉELLE — PHASE 2 : Email confirmé -> Vérification idempotente ou Activation
  // =========================================================================
  const existingAuthority = verifySupabaseSuperAdminAuthority({
    authUser,
    profile: existingProfile,
  });

  if (existingAuthority.isEffectiveSuperAdmin && existingProfile) {
    actions.push("profiles.preserved_already_super_admin");
    let auditRecord: { id: string };
    try {
      auditRecord = await gateway.insertAuditLog({
        actor_user_id: authUser.id,
        target_user_id: authUser.id,
        event_type: "supabase.super_admin.bootstrap.verified_idempotent",
        resource_type: "profile",
        resource_id: authUser.id,
        severity: "info",
        metadata: {
          bootstrap_ticket: "MIG-03-BOOTSTRAP-01",
          target_email: targetEmail,
          email_confirmed_at: authUser.email_confirmed_at,
          role: existingProfile.role,
          status: existingProfile.status,
          operator_id: operatorId,
        },
      });
      actions.push("audit_logs.insert(verified_idempotent)");
    } catch (err) {
      throw new SupabaseBootstrapError(
        "SUPABASE_API_ERROR",
        `Le compte super_admin est déjà actif mais l'écriture du journal d'audit a échoué : ${sanitizeSupabaseAdminError(err)}`
      );
    }

    return {
      ok: true,
      dryRun: false,
      phase: "already_active",
      targetEmail,
      userId: authUser.id,
      emailConfirmed: true,
      emailConfirmedAt: authUser.email_confirmed_at,
      profileRole: existingProfile.role,
      profileStatus: existingProfile.status,
      privilegesEffective: true,
      auditLogId: auditRecord.id,
      actions,
      nextStep:
        "Le compte super_admin orthognaleng@gmail.com est déjà confirmé et actif. Désactiver SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false immédiatement.",
    };
  }

  // Promotion contrôlée avec snapshot préalable pour rollback compensatoire
  const previousProfileSnapshot: BootstrapProfileRecord | null = existingProfile
    ? { ...existingProfile }
    : null;
  let mutatedProfile = false;
  let createdNewProfile = false;

  try {
    if (!previousProfileSnapshot) {
      await gateway.insertProfile({
        id: authUser.id,
        email: targetEmail,
        name: DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
        display_name: DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
        role: "super_admin",
        status: "active",
        account_type: "enterprise",
        subscription_plan: "lifetime",
      });
      createdNewProfile = true;
      mutatedProfile = true;
      actions.push("profiles.insert(super_admin,active)");
    } else {
      // Préserve strictement toutes les autres colonnes existantes (name, company, firebase_uid, etc.)
      await gateway.updateProfile(authUser.id, {
        role: "super_admin",
        status: "active",
      });
      mutatedProfile = true;
      actions.push("profiles.update(role=super_admin,status=active)");
    }

    // Relecture autoritative post-écriture
    const verifiedProfile = await gateway.findProfileById(authUser.id);
    const postWriteAuthority = verifySupabaseSuperAdminAuthority({
      authUser,
      profile: verifiedProfile,
    });
    if (!postWriteAuthority.isEffectiveSuperAdmin || !verifiedProfile) {
      throw new Error(
        `Post-write super_admin verification failed: ${postWriteAuthority.reasons.join(", ")}`
      );
    }
    actions.push("profiles.verified_super_admin_authority");

    const auditRecord = await gateway.insertAuditLog({
      actor_user_id: authUser.id,
      target_user_id: authUser.id,
      event_type: "supabase.super_admin.bootstrap.activated",
      resource_type: "profile",
      resource_id: authUser.id,
      severity: "critical",
      metadata: {
        bootstrap_ticket: "MIG-03-BOOTSTRAP-01",
        target_email: targetEmail,
        previous_role: previousProfileSnapshot?.role ?? null,
        previous_status: previousProfileSnapshot?.status ?? null,
        new_role: verifiedProfile.role,
        new_status: verifiedProfile.status,
        email_confirmed_at: authUser.email_confirmed_at,
        operator_id: operatorId,
      },
    });
    actions.push("audit_logs.insert(activated)");

    return {
      ok: true,
      dryRun: false,
      phase: "activated",
      targetEmail,
      userId: authUser.id,
      emailConfirmed: true,
      emailConfirmedAt: authUser.email_confirmed_at,
      profileRole: verifiedProfile.role,
      profileStatus: verifiedProfile.status,
      privilegesEffective: true,
      auditLogId: auditRecord.id,
      actions,
      nextStep:
        "Le premier super_admin orthognaleng@gmail.com est activé. Désactiver immédiatement SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false dans l'environnement serveur.",
    };
  } catch (err) {
    // Rollback compensatoire : ne jamais laisser un profil partiellement promu sans vérification + audit
    if (mutatedProfile) {
      try {
        if (createdNewProfile) {
          await gateway.deleteProfile(authUser.id);
        } else if (previousProfileSnapshot) {
          await gateway.updateProfile(authUser.id, {
            role: previousProfileSnapshot.role,
            status: previousProfileSnapshot.status,
          });
        }
      } catch (rbErr) {
        throw new SupabaseBootstrapError(
          "ROLLBACK_FAILED",
          `Erreur lors de l'activation super_admin (${sanitizeSupabaseAdminError(err)}) et échec du rollback compensatoire (${sanitizeSupabaseAdminError(rbErr)}). Intervention manuelle requise.`,
          { rolledBack: false }
        );
      }
    }

    throw new SupabaseBootstrapError(
      "SUPABASE_API_ERROR",
      `Erreur Supabase pendant la Phase 2 d'activation (${sanitizeSupabaseAdminError(err)}). Rollback compensatoire appliqué : aucun privilège partiel conservé.`,
      { rolledBack: mutatedProfile }
    );
  }
}

/**
 * Implémentation concrète de `SupabaseBootstrapGateway` appuyée sur le client Supabase Admin serveur.
 */
export function createSupabaseAdminBootstrapGateway(
  adminClient: SupabaseClient
): SupabaseBootstrapGateway {
  const MAX_LIST_USERS_PAGES = 50;
  const PER_PAGE = 200;

  return {
    async findAuthUserByEmail(email: string): Promise<BootstrapAuthUserRecord | null> {
      const target = normalizeBootstrapEmail(email);
      for (let page = 1; page <= MAX_LIST_USERS_PAGES; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({
          page,
          perPage: PER_PAGE,
        });
        if (error) {
          throw new Error(`auth.admin.listUsers failed: ${sanitizeSupabaseAdminError(error)}`);
        }
        const users = data?.users ?? [];
        const match = users.find((u) => normalizeBootstrapEmail(u.email) === target);
        if (match && match.email) {
          return {
            id: match.id,
            email: match.email,
            email_confirmed_at: match.email_confirmed_at ?? null,
            invited_at: match.invited_at ?? null,
            created_at: match.created_at ?? null,
            user_metadata: (match.user_metadata as Record<string, unknown> | null) ?? null,
            app_metadata: (match.app_metadata as Record<string, unknown> | null) ?? null,
          };
        }
        if (users.length < PER_PAGE) {
          break;
        }
      }
      return null;
    },

    async inviteAuthUserByEmail(
      email: string,
      options?: { redirectTo?: string }
    ): Promise<BootstrapAuthUserRecord> {
      // `data: {}` garantit qu'aucun rôle ni privilège n'est injecté dans `user_metadata`.
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {},
        ...(options?.redirectTo ? { redirectTo: options.redirectTo } : {}),
      });
      if (error || !data?.user || !data.user.email) {
        throw new Error(
          `auth.admin.inviteUserByEmail failed: ${sanitizeSupabaseAdminError(error ?? "missing user")}`
        );
      }
      return {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at ?? null,
        invited_at: data.user.invited_at ?? null,
        created_at: data.user.created_at ?? null,
        user_metadata: (data.user.user_metadata as Record<string, unknown> | null) ?? null,
        app_metadata: (data.user.app_metadata as Record<string, unknown> | null) ?? null,
      };
    },

    async deleteAuthUserById(userId: string): Promise<void> {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        throw new Error(`auth.admin.deleteUser failed: ${sanitizeSupabaseAdminError(error)}`);
      }
    },

    async listSuperAdminProfiles(): Promise<BootstrapProfileRecord[]> {
      const { data, error } = await adminClient
        .from("profiles")
        .select(
          "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
        )
        .eq("role", "super_admin");
      if (error) {
        throw new Error(`profiles.select(super_admin) failed: ${sanitizeSupabaseAdminError(error)}`);
      }
      return (data ?? []) as BootstrapProfileRecord[];
    },

    async findProfileById(id: string): Promise<BootstrapProfileRecord | null> {
      const { data, error } = await adminClient
        .from("profiles")
        .select(
          "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`profiles.select(id) failed: ${sanitizeSupabaseAdminError(error)}`);
      }
      return (data as BootstrapProfileRecord | null) ?? null;
    },

    async findProfileByEmail(email: string): Promise<BootstrapProfileRecord | null> {
      const { data, error } = await adminClient
        .from("profiles")
        .select(
          "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
        )
        .ilike("email", normalizeBootstrapEmail(email))
        .maybeSingle();
      if (error) {
        throw new Error(`profiles.select(email) failed: ${sanitizeSupabaseAdminError(error)}`);
      }
      return (data as BootstrapProfileRecord | null) ?? null;
    },

    async insertProfile(record: BootstrapProfileInsert): Promise<BootstrapProfileRecord> {
      const { data, error } = await adminClient
        .from("profiles")
        .insert(record)
        .select(
          "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
        )
        .single();
      if (error || !data) {
        throw new Error(
          `profiles.insert failed: ${sanitizeSupabaseAdminError(error ?? "empty response")}`
        );
      }
      return data as BootstrapProfileRecord;
    },

    async updateProfile(
      id: string,
      patch: BootstrapProfileUpdate
    ): Promise<BootstrapProfileRecord> {
      const { data, error } = await adminClient
        .from("profiles")
        .update(patch)
        .eq("id", id)
        .select(
          "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
        )
        .single();
      if (error || !data) {
        throw new Error(
          `profiles.update failed: ${sanitizeSupabaseAdminError(error ?? "empty response")}`
        );
      }
      return data as BootstrapProfileRecord;
    },

    async deleteProfile(id: string): Promise<void> {
      const { error } = await adminClient.from("profiles").delete().eq("id", id);
      if (error) {
        throw new Error(`profiles.delete failed: ${sanitizeSupabaseAdminError(error)}`);
      }
    },

    async insertAuditLog(entry: BootstrapAuditLogInsert): Promise<{ id: string }> {
      const { data, error } = await adminClient
        .from("audit_logs")
        .insert(entry)
        .select("id")
        .single();
      if (error || !data?.id) {
        throw new Error(
          `audit_logs.insert failed: ${sanitizeSupabaseAdminError(error ?? "missing audit id")}`
        );
      }
      return { id: String(data.id) };
    },
  };
}
