/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-03-BOOTSTRAP-01
 * Client Supabase Admin strictement serveur (service_role / sb_secret_)
 * ============================================================================
 *
 * Règles de sécurité non négociables :
 * - Ce module est STRICTEMENT réservé au runtime serveur (Node.js / CLI / API serveur).
 * - Il ne doit JAMAIS être importé depuis le bundle navigateur (`src/components`, `src/pdi`, `src/lib/supabase.ts`).
 * - Il refuse de s'exécuter dans un contexte navigateur (`window` / `document`).
 * - Il refuse toute clé publique (`sb_publishable_*`, JWT `role: "anon"`) ou clé de management (`sbp_*`).
 * - Il refuse toute exposition d'une clé secrète dans une variable `VITE_*`.
 * - Il n'effectue aucun appel réseau à l'importation.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { containsExposedSupabaseSecretCredential } from "../security/sec01SecurityService.js";

export type SupabaseAdminKeyFormat = "sb_secret" | "service_role_jwt";

export type SupabaseAdminConfigErrorCode =
  | "BROWSER_CONTEXT_FORBIDDEN"
  | "FORBIDDEN_VITE_SECRET"
  | "MISSING_SUPABASE_URL"
  | "INVALID_SUPABASE_URL"
  | "MISSING_SUPABASE_SECRET_KEY"
  | "INVALID_SUPABASE_SECRET_KEY";

export class SupabaseAdminConfigError extends Error {
  public readonly code: SupabaseAdminConfigErrorCode;

  constructor(code: SupabaseAdminConfigErrorCode, message: string) {
    super(message);
    this.name = "SupabaseAdminConfigError";
    this.code = code;
  }
}

export interface SupabaseAdminConfigValidationOptions {
  /** Autorise http://localhost / 127.0.0.1 uniquement en test local explicite. Défaut : false. */
  allowInsecureLocalhost?: boolean;
  /** Surcharge de détection navigateur pour les tests unitaires uniquement. */
  isBrowserRuntime?: boolean;
}

export interface ValidatedSupabaseAdminConfig {
  url: string;
  secretKey: string;
  keyFormat: SupabaseAdminKeyFormat;
}

export interface SupabaseAdminClientHandle {
  client: SupabaseClient;
  url: string;
  keyFormat: SupabaseAdminKeyFormat;
}

const SB_SECRET_PREFIX = ["sb", "secret", ""].join("_");
const SB_PUBLISHABLE_PREFIX = ["sb", "publishable", ""].join("_");
const SB_MANAGEMENT_PAT_PREFIX = ["sbp", ""].join("_");

const FORBIDDEN_VITE_SECRET_KEYS = [
  ["VITE", "SUPABASE", "SECRET", "KEY"].join("_"),
  ["VITE", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
  ["VITE", "SB", "SECRET"].join("_"),
  ["VITE", "SB", "SECRET", "KEY"].join("_"),
] as const;

const SB_SECRET_KEY_REGEX = /^sb_secret_[0-9a-zA-Z_-]{16,}$/;
const JWT_STRUCTURE_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function detectBrowserRuntime(override?: boolean): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  return typeof globalThis.window !== "undefined" || typeof globalThis.document !== "undefined";
}

function decodeJwtPayloadRole(token: string): string | null {
  if (!JWT_STRUCTURE_REGEX.test(token)) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonText = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function redactSupabaseSecret(rawValue: unknown): string {
  if (typeof rawValue !== "string") {
    return "[non-string]";
  }
  let sanitized = rawValue;
  // Masque toute clé secrète Supabase ou token JWT potentiellement présent dans un message d'erreur
  sanitized = sanitized.replace(/sb_secret_[0-9a-zA-Z_-]+/g, "[REDACTED_SUPABASE_SECRET]");
  sanitized = sanitized.replace(/sbp_[0-9a-zA-Z_-]+/g, "[REDACTED_SUPABASE_PAT]");
  sanitized = sanitized.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[REDACTED_JWT]"
  );
  return sanitized;
}

export function sanitizeSupabaseAdminError(error: unknown): string {
  if (error instanceof Error) {
    return redactSupabaseSecret(error.message);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") {
      return redactSupabaseSecret(msg);
    }
  }
  return redactSupabaseSecret(String(error));
}

export function validateSupabaseAdminConfig(
  env: Record<string, string | undefined> = process.env,
  options: SupabaseAdminConfigValidationOptions = {}
): ValidatedSupabaseAdminConfig {
  if (detectBrowserRuntime(options.isBrowserRuntime)) {
    throw new SupabaseAdminConfigError(
      "BROWSER_CONTEXT_FORBIDDEN",
      "Le client Supabase Admin serveur ne peut jamais être initialisé dans un contexte navigateur."
    );
  }

  for (const forbiddenKey of FORBIDDEN_VITE_SECRET_KEYS) {
    const val = env[forbiddenKey];
    if (typeof val === "string" && val.trim().length > 0) {
      throw new SupabaseAdminConfigError(
        "FORBIDDEN_VITE_SECRET",
        `Variable navigateur interdite détectée (${forbiddenKey}). Les secrets Supabase doivent être exclusivement côté serveur.`
      );
    }
  }

  for (const [envKey, envVal] of Object.entries(env)) {
    if (envKey.startsWith("VITE_") && containsExposedSupabaseSecretCredential(envVal)) {
      throw new SupabaseAdminConfigError(
        "FORBIDDEN_VITE_SECRET",
        `Une variable VITE_* (${envKey}) contient une clé secrète Supabase. Exécution serveur bloquée.`
      );
    }
  }

  const rawUrl = (env.SUPABASE_URL ?? "").trim();
  if (!rawUrl) {
    throw new SupabaseAdminConfigError(
      "MISSING_SUPABASE_URL",
      "Variable serveur SUPABASE_URL manquante. Définir SUPABASE_URL côté serveur (sans préfixe VITE_)."
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL est mal formée. Une URL HTTPS valide est requise."
    );
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL ne doit pas contenir d'identifiants intégrés."
    );
  }

  const isLocalhost =
    parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
  const protocolAllowed =
    parsedUrl.protocol === "https:" ||
    (options.allowInsecureLocalhost === true &&
      parsedUrl.protocol === "http:" &&
      isLocalhost);

  if (!protocolAllowed) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL doit utiliser le protocole HTTPS."
    );
  }

  if (parsedUrl.search || parsedUrl.hash || (parsedUrl.pathname && parsedUrl.pathname !== "/")) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL doit pointer uniquement vers l'origine du projet Supabase (sans chemin ni paramètres)."
    );
  }

  const rawSecretKey = (env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!rawSecretKey) {
    throw new SupabaseAdminConfigError(
      "MISSING_SUPABASE_SECRET_KEY",
      "Variable serveur SUPABASE_SECRET_KEY manquante."
    );
  }

  if (rawSecretKey.startsWith(SB_PUBLISHABLE_PREFIX)) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_SECRET_KEY",
      "SUPABASE_SECRET_KEY ne peut pas être une clé publique publishable (sb_publishable_*)."
    );
  }

  if (rawSecretKey.startsWith(SB_MANAGEMENT_PAT_PREFIX)) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_SECRET_KEY",
      "SUPABASE_SECRET_KEY ne peut pas être un Personal Access Token (sbp_*)."
    );
  }

  let keyFormat: SupabaseAdminKeyFormat;
  if (rawSecretKey.startsWith(SB_SECRET_PREFIX)) {
    if (!SB_SECRET_KEY_REGEX.test(rawSecretKey)) {
      throw new SupabaseAdminConfigError(
        "INVALID_SUPABASE_SECRET_KEY",
        "SUPABASE_SECRET_KEY au format sb_secret_* est invalide ou trop courte."
      );
    }
    keyFormat = "sb_secret";
  } else {
    const jwtRole = decodeJwtPayloadRole(rawSecretKey);
    if (jwtRole === "service_role") {
      keyFormat = "service_role_jwt";
    } else if (jwtRole === "anon" || jwtRole === "authenticated") {
      throw new SupabaseAdminConfigError(
        "INVALID_SUPABASE_SECRET_KEY",
        `SUPABASE_SECRET_KEY possède un rôle JWT non autorisé (${jwtRole}). Une clé sb_secret_* ou service_role est requise.`
      );
    } else {
      throw new SupabaseAdminConfigError(
        "INVALID_SUPABASE_SECRET_KEY",
        "Format de SUPABASE_SECRET_KEY non reconnu. Attendu : clé secrète sb_secret_* ou JWT service_role."
      );
    }
  }

  return {
    url: parsedUrl.origin,
    secretKey: rawSecretKey,
    keyFormat,
  };
}

export function createSupabaseAdminClient(
  env: Record<string, string | undefined> = process.env,
  options: SupabaseAdminConfigValidationOptions = {}
): SupabaseAdminClientHandle {
  const config = validateSupabaseAdminConfig(env, options);

  const client = createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "orthogonal-pdi-server-admin",
      },
    },
  });

  return {
    client,
    url: config.url,
    keyFormat: config.keyFormat,
  };
}
