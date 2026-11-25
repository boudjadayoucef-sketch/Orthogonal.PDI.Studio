/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-04-AUTH-01-FIX-02
 * Correction contrôlée de l'identité Super Admin Supabase
 * (`orthognaleng@gmail.com` -> `orthogonaleng@gmail.com`)
 * ============================================================================
 *
 * Garanties de sécurité :
 * 1. Exclusivement serveur (`src/server/`), interdit dans le navigateur et bloqué en Sandbox.
 * 2. Ne crée JAMAIS un deuxième compte utilisateur : met à jour le compte existant en conservant
 *    strictement son UUID (`auth.users.id === public.profiles.id`), son rôle (`super_admin`),
 *    son statut (`active`), et l'historique d'audit (`public.audit_logs`).
 * 3. Utilise l'API officielle Supabase Auth Admin (`auth.admin.updateUserById`) — jamais d'édition
 *    SQL directe sur `auth.users`.
 * 4. Refuse toute exécution si un second compte existe déjà avec l'adresse cible (`DUPLICATE_ACCOUNT_CONFLICT`).
 * 5. Ne déduit jamais le rôle `super_admin` depuis l'adresse email seule : revalide systématiquement
 *    `verifySupabaseSuperAdminAuthority` après la mise à jour.
 * 6. Journalise l'opération de manière immuable dans `public.audit_logs`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isStagingSandboxMode } from "../lib/stagingSandbox.ts";
import { sanitizeSupabaseAdminError } from "./supabaseAdmin.ts";
import {
  AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
  isEmailConfirmed,
  normalizeBootstrapEmail,
  verifySupabaseSuperAdminAuthority,
  type BootstrapAuditLogInsert,
  type BootstrapAuthUserRecord,
  type BootstrapProfileRecord,
  type BootstrapRequestContext,
} from "./supabaseSuperAdminBootstrap.ts";

function assertServerRuntimeOnly(override?: boolean): void {
  const isBrowser =
    typeof override === "boolean"
      ? override
      : typeof globalThis.window !== "undefined" || typeof globalThis.document !== "undefined";
  if (isBrowser) {
    throw new SuperAdminIdentityCorrectionError(
      "BROWSER_REQUEST_FORBIDDEN",
      "La correction d'identité Super Admin est strictement réservée au runtime serveur."
    );
  }
}

export const LEGACY_TYPO_SUPER_ADMIN_EMAIL = "orthognaleng@gmail.com" as const;
export const CORRECTED_SUPER_ADMIN_EMAIL = AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL;

export type SuperAdminIdentityCorrectionErrorCode =
  | "SANDBOX_FORBIDDEN"
  | "BROWSER_REQUEST_FORBIDDEN"
  | "INVALID_EMAIL_PAIR"
  | "SOURCE_USER_NOT_FOUND"
  | "DUPLICATE_ACCOUNT_CONFLICT"
  | "PROFILE_NOT_FOUND"
  | "NOT_VERIFIED_SUPER_ADMIN"
  | "UUID_MISMATCH"
  | "UPDATE_FAILED";

export class SuperAdminIdentityCorrectionError extends Error {
  public readonly code: SuperAdminIdentityCorrectionErrorCode;

  constructor(code: SuperAdminIdentityCorrectionErrorCode, message: string) {
    super(message);
    this.name = "SuperAdminIdentityCorrectionError";
    this.code = code;
  }
}

export interface SupabaseIdentityMappingRecord {
  id: string;
  supabase_user_id: string;
  firebase_email: string;
}

export interface SuperAdminIdentityCorrectionGateway {
  findAuthUsersByEmail(email: string): Promise<BootstrapAuthUserRecord[]>;
  updateAuthUserEmailById(
    userId: string,
    newEmail: string
  ): Promise<BootstrapAuthUserRecord>;
  findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null>;
  findProfilesByEmail(email: string): Promise<BootstrapProfileRecord[]>;
  updateProfileEmailPreservingRole(
    userId: string,
    newEmail: string
  ): Promise<BootstrapProfileRecord>;
  findIdentityMappingsByUserId?(
    userId: string
  ): Promise<SupabaseIdentityMappingRecord[]>;
  updateIdentityMappingEmail?(
    mappingId: string,
    newEmail: string
  ): Promise<void>;
  insertAuditLog(entry: BootstrapAuditLogInsert): Promise<void>;
}

export interface SuperAdminIdentityCorrectionOptions {
  gateway: SuperAdminIdentityCorrectionGateway;
  env?: Record<string, string | undefined>;
  oldEmail?: string;
  newEmail?: string;
  dryRun?: boolean;
  operatorId?: string;
  requestContext?: BootstrapRequestContext;
  isBrowserRuntime?: boolean;
}

export interface SuperAdminIdentityCorrectionResult {
  ok: true;
  status:
    | "dry_run_ready"
    | "already_corrected"
    | "corrected";
  dryRun: boolean;
  userId: string;
  oldEmail: string;
  newEmail: string;
  uuidPreserved: boolean;
  rolePreserved: boolean;
  statusPreserved: boolean;
  emailConfirmed: boolean;
  identityMappingsUpdated: number;
  auditLogged: boolean;
  message: string;
}

export function createSupabaseAdminIdentityCorrectionGateway(
  client: SupabaseClient
): SuperAdminIdentityCorrectionGateway {
  assertServerRuntimeOnly();

  return {
    async findAuthUsersByEmail(email: string): Promise<BootstrapAuthUserRecord[]> {
      const normalized = normalizeBootstrapEmail(email);
      const matches: BootstrapAuthUserRecord[] = [];
      let page = 1;
      const perPage = 200;

      while (page <= 50) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage });
        if (error) {
          throw new SuperAdminIdentityCorrectionError(
            "UPDATE_FAILED",
            `Impossible de lister auth.users via Supabase Admin API : ${sanitizeSupabaseAdminError(error)}`
          );
        }
        const users = data?.users ?? [];
        for (const u of users) {
          if (normalizeBootstrapEmail(u.email) === normalized) {
            matches.push({
              id: u.id,
              email: normalizeBootstrapEmail(u.email),
              email_confirmed_at: u.email_confirmed_at ?? null,
              created_at: u.created_at,
            });
          }
        }
        if (users.length < perPage) break;
        page += 1;
      }

      return matches;
    },

    async updateAuthUserEmailById(
      userId: string,
      newEmail: string
    ): Promise<BootstrapAuthUserRecord> {
      const normalized = normalizeBootstrapEmail(newEmail);
      const { data, error } = await client.auth.admin.updateUserById(userId, {
        email: normalized,
        email_confirm: true,
      });

      if (error || !data?.user) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec updateUserById sur Supabase Auth Admin API : ${sanitizeSupabaseAdminError(error)}`
        );
      }

      const u = data.user;
      return {
        id: u.id,
        email: normalizeBootstrapEmail(u.email),
        email_confirmed_at: u.email_confirmed_at ?? null,
        created_at: u.created_at,
      };
    },

    async findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null> {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec lecture public.profiles : ${sanitizeSupabaseAdminError(error)}`
        );
      }
      return (data as BootstrapProfileRecord | null) ?? null;
    },

    async findProfilesByEmail(email: string): Promise<BootstrapProfileRecord[]> {
      const normalized = normalizeBootstrapEmail(email);
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .ilike("email", normalized);

      if (error) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec recherche email dans public.profiles : ${sanitizeSupabaseAdminError(error)}`
        );
      }
      return ((data as BootstrapProfileRecord[] | null) ?? []).filter(
        (p) => normalizeBootstrapEmail(p.email) === normalized
      );
    },

    async updateProfileEmailPreservingRole(
      userId: string,
      newEmail: string
    ): Promise<BootstrapProfileRecord> {
      const normalized = normalizeBootstrapEmail(newEmail);
      const { data, error } = await client
        .from("profiles")
        .update({ email: normalized })
        .eq("id", userId)
        .select("*")
        .single();

      if (error || !data) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec mise à jour email dans public.profiles : ${sanitizeSupabaseAdminError(error)}`
        );
      }
      return data as BootstrapProfileRecord;
    },

    async findIdentityMappingsByUserId(
      userId: string
    ): Promise<SupabaseIdentityMappingRecord[]> {
      const { data, error } = await client
        .from("user_identity_mappings")
        .select("id, supabase_user_id, firebase_email")
        .eq("supabase_user_id", userId);

      if (error) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec lecture public.user_identity_mappings : ${sanitizeSupabaseAdminError(error)}`
        );
      }
      return (data as SupabaseIdentityMappingRecord[] | null) ?? [];
    },

    async updateIdentityMappingEmail(
      mappingId: string,
      newEmail: string
    ): Promise<void> {
      const normalized = normalizeBootstrapEmail(newEmail);
      const { error } = await client
        .from("user_identity_mappings")
        .update({ firebase_email: normalized })
        .eq("id", mappingId);

      if (error) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec mise à jour public.user_identity_mappings : ${sanitizeSupabaseAdminError(error)}`
        );
      }
    },

    async insertAuditLog(entry: BootstrapAuditLogInsert): Promise<void> {
      const { error } = await client.from("audit_logs").insert({
        actor_user_id: entry.actor_user_id,
        target_user_id: entry.target_user_id,
        event_type: entry.event_type,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        severity: entry.severity,
        metadata: entry.metadata,
      });

      if (error) {
        throw new SuperAdminIdentityCorrectionError(
          "UPDATE_FAILED",
          `Échec écriture public.audit_logs : ${sanitizeSupabaseAdminError(error)}`
        );
      }
    },
  };
}

/**
 * Corrige l'adresse email du Super Admin Supabase existant sans créer de deuxième compte
 * et en conservant strictement le même UUID, rôle `super_admin`, statut `active` et historique d'audit.
 */
export async function correctSupabaseSuperAdminIdentity(
  options: SuperAdminIdentityCorrectionOptions
): Promise<SuperAdminIdentityCorrectionResult> {
  assertServerRuntimeOnly(options.isBrowserRuntime);

  const env = options.env ?? (typeof process !== "undefined" ? process.env : {});
  if (isStagingSandboxMode(env)) {
    throw new SuperAdminIdentityCorrectionError(
      "SANDBOX_FORBIDDEN",
      "La correction d'identité Super Admin est strictement interdite en mode Sandbox."
    );
  }

  if (options.requestContext?.source === "browser" || options.requestContext?.origin) {
    throw new SuperAdminIdentityCorrectionError(
      "BROWSER_REQUEST_FORBIDDEN",
      "La correction d'identité Super Admin ne peut jamais être déclenchée depuis le navigateur."
    );
  }

  const oldEmail = normalizeBootstrapEmail(options.oldEmail ?? LEGACY_TYPO_SUPER_ADMIN_EMAIL);
  const newEmail = normalizeBootstrapEmail(options.newEmail ?? CORRECTED_SUPER_ADMIN_EMAIL);

  if (
    oldEmail !== LEGACY_TYPO_SUPER_ADMIN_EMAIL ||
    newEmail !== CORRECTED_SUPER_ADMIN_EMAIL
  ) {
    throw new SuperAdminIdentityCorrectionError(
      "INVALID_EMAIL_PAIR",
      `Seule la correction autorisée ${LEGACY_TYPO_SUPER_ADMIN_EMAIL} -> ${CORRECTED_SUPER_ADMIN_EMAIL} est permise par ce ticket.`
    );
  }

  const dryRun = options.dryRun !== false;
  const operatorId = (options.operatorId ?? "server-cli").trim() || "server-cli";
  const { gateway } = options;

  const [oldAuthUsers, newAuthUsers, newProfiles] = await Promise.all([
    gateway.findAuthUsersByEmail(oldEmail),
    gateway.findAuthUsersByEmail(newEmail),
    gateway.findProfilesByEmail(newEmail),
  ]);

  // Cas 1 : déjà corrigé (idempotent) — aucun compte sur l'ancienne adresse, 1 seul compte vérifié sur la nouvelle
  if (oldAuthUsers.length === 0 && newAuthUsers.length === 1) {
    const existingNewUser = newAuthUsers[0];
    const profile = await gateway.findProfileByUserId(existingNewUser.id);
    if (!profile) {
      throw new SuperAdminIdentityCorrectionError(
        "PROFILE_NOT_FOUND",
        `Profil public.profiles introuvable pour l'UUID ${existingNewUser.id}.`
      );
    }
    const authority = verifySupabaseSuperAdminAuthority({
      authUser: existingNewUser,
      profile,
    });
    if (!authority.isEffectiveSuperAdmin) {
      throw new SuperAdminIdentityCorrectionError(
        "NOT_VERIFIED_SUPER_ADMIN",
        `Le compte ${newEmail} existe mais n'est pas un Super Admin actif et confirmé (${authority.reasons.join(", ")}).`
      );
    }

    return {
      ok: true,
      status: "already_corrected",
      dryRun,
      userId: existingNewUser.id,
      oldEmail,
      newEmail,
      uuidPreserved: existingNewUser.id === profile.id,
      rolePreserved: profile.role === "super_admin",
      statusPreserved: profile.status === "active",
      emailConfirmed: isEmailConfirmed(existingNewUser),
      identityMappingsUpdated: 0,
      auditLogged: false,
      message: `Identité Super Admin déjà corrigée (${newEmail}, UUID=${existingNewUser.id}). Aucune modification requise.`,
    };
  }

  // Blocage anti-doublon : jamais de fusion silencieuse ni de création d'un 2e compte
  if (oldAuthUsers.length > 1 || newAuthUsers.length > 0 || newProfiles.length > 0) {
    throw new SuperAdminIdentityCorrectionError(
      "DUPLICATE_ACCOUNT_CONFLICT",
      `Conflit d'unicité détecté : oldAuth=${oldAuthUsers.length}, newAuth=${newAuthUsers.length}, newProfiles=${newProfiles.length}. Aucune création ni fusion automatique autorisée.`
    );
  }

  if (oldAuthUsers.length === 0) {
    throw new SuperAdminIdentityCorrectionError(
      "SOURCE_USER_NOT_FOUND",
      `Aucun utilisateur Supabase Auth trouvé pour ${oldEmail}.`
    );
  }

  const sourceAuthUser = oldAuthUsers[0];
  const sourceProfile = await gateway.findProfileByUserId(sourceAuthUser.id);
  if (!sourceProfile) {
    throw new SuperAdminIdentityCorrectionError(
      "PROFILE_NOT_FOUND",
      `Aucun profil public.profiles trouvé pour l'UUID ${sourceAuthUser.id}.`
    );
  }

  // Vérification stricte AVANT modification : le compte source doit déjà être un super_admin actif et confirmé
  const preCheck = verifySupabaseSuperAdminAuthority({
    authUser: sourceAuthUser,
    profile: sourceProfile,
  });
  if (!preCheck.isEffectiveSuperAdmin) {
    throw new SuperAdminIdentityCorrectionError(
      "NOT_VERIFIED_SUPER_ADMIN",
      `Le compte source (${oldEmail}) n'est pas un Super Admin actif et confirmé (${preCheck.reasons.join(", ")}).`
    );
  }

  if (dryRun) {
    return {
      ok: true,
      status: "dry_run_ready",
      dryRun: true,
      userId: sourceAuthUser.id,
      oldEmail,
      newEmail,
      uuidPreserved: true,
      rolePreserved: true,
      statusPreserved: true,
      emailConfirmed: isEmailConfirmed(sourceAuthUser),
      identityMappingsUpdated: 0,
      auditLogged: false,
      message: `Simulation (dry-run) prête : mettrait à jour l'UUID ${sourceAuthUser.id} de ${oldEmail} vers ${newEmail} via Admin API + public.profiles sans changer l'UUID ni le rôle super_admin.`,
    };
  }

  // Étape 1 : Mise à jour de auth.users via Supabase Admin API (conserve strictement l'UUID)
  const updatedAuthUser = await gateway.updateAuthUserEmailById(sourceAuthUser.id, newEmail);
  if (updatedAuthUser.id !== sourceAuthUser.id) {
    throw new SuperAdminIdentityCorrectionError(
      "UUID_MISMATCH",
      "Anomalie critique : l'UUID retourné par Supabase Auth diffère de l'UUID source."
    );
  }

  // Étape 2 : Mise à jour de public.profiles.email en conservant strictement UUID, role et status
  let updatedProfile: BootstrapProfileRecord;
  try {
    updatedProfile = await gateway.updateProfileEmailPreservingRole(sourceAuthUser.id, newEmail);
  } catch (err) {
    // Rollback best-effort sur auth.users si la mise à jour public.profiles échoue
    try {
      await gateway.updateAuthUserEmailById(sourceAuthUser.id, oldEmail);
    } catch {
      // Ignore rollback secondary error
    }
    throw err;
  }

  // Étape 3 : Mise à jour ciblée de public.user_identity_mappings si un mapping correspond à l'ancien email
  let identityMappingsUpdated = 0;
  if (gateway.findIdentityMappingsByUserId && gateway.updateIdentityMappingEmail) {
    const mappings = await gateway.findIdentityMappingsByUserId(sourceAuthUser.id);
    for (const m of mappings) {
      if (normalizeBootstrapEmail(m.firebase_email) === oldEmail) {
        await gateway.updateIdentityMappingEmail(m.id, newEmail);
        identityMappingsUpdated += 1;
      }
    }
  }

  // Étape 4 : Re-vérification autoritative post-mise à jour (UUID, role='super_admin', status='active', email confirmé)
  const postCheck = verifySupabaseSuperAdminAuthority({
    authUser: updatedAuthUser,
    profile: updatedProfile,
  });

  if (
    !postCheck.isEffectiveSuperAdmin ||
    updatedProfile.id !== sourceAuthUser.id ||
    updatedProfile.role !== "super_admin" ||
    updatedProfile.status !== "active"
  ) {
    throw new SuperAdminIdentityCorrectionError(
      "NOT_VERIFIED_SUPER_ADMIN",
      `Vérification post-mise à jour échouée pour l'UUID ${sourceAuthUser.id} (${postCheck.reasons.join(", ")}).`
    );
  }

  // Étape 5 : Journalisation immuable dans public.audit_logs (sans altérer les logs existants)
  await gateway.insertAuditLog({
    actor_user_id: sourceAuthUser.id,
    target_user_id: sourceAuthUser.id,
    event_type: "super_admin.identity_email.corrected",
    resource_type: "profiles",
    resource_id: sourceAuthUser.id,
    severity: "critical",
    metadata: {
      ticket: "MIG-04-AUTH-01-FIX-02",
      operator_id: operatorId,
      previous_email: oldEmail,
      corrected_email: newEmail,
      uuid_preserved: true,
      role_preserved: updatedProfile.role,
      status_preserved: updatedProfile.status,
      identity_mappings_updated: identityMappingsUpdated,
    },
  });

  return {
    ok: true,
    status: "corrected",
    dryRun: false,
    userId: sourceAuthUser.id,
    oldEmail,
    newEmail,
    uuidPreserved: updatedAuthUser.id === sourceAuthUser.id && updatedProfile.id === sourceAuthUser.id,
    rolePreserved: updatedProfile.role === "super_admin",
    statusPreserved: updatedProfile.status === "active",
    emailConfirmed: isEmailConfirmed(updatedAuthUser),
    identityMappingsUpdated,
    auditLogged: true,
    message: `Identité Super Admin corrigée avec succès (${oldEmail} -> ${newEmail}) en conservant l'UUID ${sourceAuthUser.id}, role=super_admin et status=active.`,
  };
}
