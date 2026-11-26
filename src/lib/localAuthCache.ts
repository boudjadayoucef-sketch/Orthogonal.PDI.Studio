/**
 * ORTHOGONAL PD&I STUDIO — MIG-05-FIX-01
 * Utilitaires de cache local d'identité totalement indépendants de Firebase.
 *
 * - Zéro import `firebase/*` ou `src/lib/firebase.ts`.
 * - Gère la clé canonique `pdi.user.profile.v1` ainsi que les clés héritées compatibles
 *   (`pdi.userProfile.v1`, `pdi_user_profile`) pour assurer la cohérence UUID Supabase
 *   entre `PdiUnifiedApp`, la restauration F5 et l'éditeur isométrique.
 */

import type { PdiUserProfile } from "../types/pdiAuthTypes";
import { resolveScopedStorageKey } from "./stagingSandbox";

export const CANONICAL_USER_PROFILE_STORAGE_KEY = "pdi.user.profile.v1";
export const LEGACY_USER_PROFILE_STORAGE_KEYS = [
  "pdi.userProfile.v1",
  "pdi_user_profile",
] as const;

export const LOCAL_IDENTITY_CACHE_KEYS = [
  "pdi_user_profile",
  "pdi.user.profile.v1",
  "pdi.userProfile.v1",
  "pdi.force.app.v1",
  "pdi.activation.pendingToken.v1",
  "pdi.auth.pendingUser.v1",
] as const;

export const SESSION_IDENTITY_CACHE_KEYS = [
  "pdi.stage.v4",
  "pdi.drive.accessToken.v1",
] as const;

export const PDI_IDENTITY_SYNCED_EVENT = "pdi:identity-synced";

const SUPABASE_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vérifie strictement qu'un identifiant est un UUID Supabase canonique (jamais un UID `local-...`).
 */
export function isCanonicalSupabaseUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("local-")) {
    return false;
  }
  return SUPABASE_UUID_PATTERN.test(trimmed);
}

function getDefaultLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function getDefaultSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Synchronise le profil utilisateur vérifié dans le stockage local canonique (`pdi.user.profile.v1`)
 * et propage la clé de compatibilité (`pdi.userProfile.v1`) afin que tous les modules (dont
 * l'éditeur isométrique) lisent immédiatement le même UUID Supabase canonique après connexion
 * comme après restauration F5.
 */
export function syncVerifiedUserProfileCache(
  profile: PdiUserProfile & { role?: string },
  options?: {
    storage?: Storage | null;
    env?: Record<string, unknown>;
    dispatchEvent?: boolean;
  }
): void {
  const storage = options?.storage !== undefined ? options.storage : getDefaultLocalStorage();
  if (!storage || !profile || typeof profile.uid !== "string" || !profile.uid.trim()) {
    return;
  }

  const normalizedUid = profile.uid.trim();
  const payload = JSON.stringify({
    ...profile,
    uid: normalizedUid,
  });

  try {
    storage.setItem(resolveScopedStorageKey(CANONICAL_USER_PROFILE_STORAGE_KEY, options?.env), payload);
    storage.setItem(resolveScopedStorageKey("pdi.userProfile.v1", options?.env), payload);
  } catch {
    // Ignore storage quota or private browsing errors
  }

  if (options?.dispatchEvent !== false && typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent(PDI_IDENTITY_SYNCED_EVENT, {
          detail: { uid: normalizedUid, role: profile.role },
        })
      );
    } catch {
      // Ignore event dispatch errors in restricted environments
    }
  }
}

/**
 * Lit le profil utilisateur mis en cache en privilégiant la clé canonique `pdi.user.profile.v1`,
 * avec lecture de compatibilité sur `pdi.userProfile.v1` et `pdi_user_profile`.
 */
export function readVerifiedUserProfileFromCache(options?: {
  storage?: Storage | null;
  env?: Record<string, unknown>;
}): PdiUserProfile | null {
  const storage = options?.storage !== undefined ? options.storage : getDefaultLocalStorage();
  if (!storage) {
    return null;
  }

  const candidateKeys = [
    resolveScopedStorageKey(CANONICAL_USER_PROFILE_STORAGE_KEY, options?.env),
    resolveScopedStorageKey("pdi.userProfile.v1", options?.env),
    resolveScopedStorageKey("pdi_user_profile", options?.env),
  ];

  for (const key of candidateKeys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<PdiUserProfile> & { id?: string };
      if (!parsed || typeof parsed !== "object") continue;
      const resolvedUid =
        typeof parsed.uid === "string" && parsed.uid.trim()
          ? parsed.uid.trim()
          : typeof parsed.id === "string" && parsed.id.trim()
            ? parsed.id.trim()
            : null;
      if (!resolvedUid) continue;
      return {
        ...(parsed as PdiUserProfile),
        uid: resolvedUid,
      };
    } catch {
      // Ignore malformed cache entries
    }
  }

  return null;
}

/**
 * Extrait l'UUID Supabase canonique du profil en cache (retourne `null` si absent ou non-UUID).
 */
export function readCanonicalSupabaseUuidFromCache(options?: {
  storage?: Storage | null;
  env?: Record<string, unknown>;
}): string | null {
  const profile = readVerifiedUserProfileFromCache(options);
  if (!profile) {
    return null;
  }
  return isCanonicalSupabaseUuid(profile.uid) ? profile.uid.trim() : null;
}

/**
 * AUTH-ADMIN-05-FIX-11-R2 & MIG-05-FIX-01 :
 * Purge atomique des caches locaux d'identité et d'autorisation workspace (0 dépendance Firebase).
 */
export function purgeLocalAuthCaches(options?: {
  preservePendingState?: boolean;
  storage?: Storage | null;
  sessionStore?: Storage | null;
  env?: Record<string, unknown>;
}): void {
  const preservePending = Boolean(options?.preservePendingState);
  const storage = options?.storage !== undefined ? options.storage : getDefaultLocalStorage();
  const sessStorage =
    options?.sessionStore !== undefined ? options.sessionStore : getDefaultSessionStorage();

  try {
    if (storage) {
      if (!preservePending) {
        for (const key of LOCAL_IDENTITY_CACHE_KEYS) {
          storage.removeItem(key);
          const scopedKey = resolveScopedStorageKey(key, options?.env);
          if (scopedKey !== key) {
            storage.removeItem(scopedKey);
          }
        }
        storage.setItem(resolveScopedStorageKey("pdi.auth.mode.v1", options?.env), "guest");
      } else {
        storage.removeItem("pdi.force.app.v1");
        storage.removeItem(resolveScopedStorageKey("pdi.force.app.v1", options?.env));
        storage.setItem(resolveScopedStorageKey("pdi.auth.mode.v1", options?.env), "pending_email");
      }
      storage.setItem(resolveScopedStorageKey("pdi.activeModule.v1", options?.env), "home");
    }
  } catch {
    // Ignore storage access errors
  }

  try {
    if (sessStorage) {
      for (const key of SESSION_IDENTITY_CACHE_KEYS) {
        sessStorage.removeItem(key);
        const scopedKey = resolveScopedStorageKey(key, options?.env);
        if (scopedKey !== key) {
          sessStorage.removeItem(scopedKey);
        }
      }
    }
  } catch {
    // Ignore sessionStorage access errors
  }

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent(PDI_IDENTITY_SYNCED_EVENT, {
          detail: { uid: null, purged: true },
        })
      );
    } catch {
      // Ignore event dispatch errors
    }
  }
}
