/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * MIG-01-FIX-02 — SUPABASE BROWSER CLIENT (ZERO-TRUST CONFIGURATION & LAZY INITIALIZATION)
 * Target: orthogonal-pdi-dev — West EU (Ireland)
 *
 * Security Guarantees:
 * - Reads ONLY `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
 * - Accepts ONLY a publishable key starting with `sb_publishable_`.
 * - Strictly rejects any secret key starting with `sb_secret_`.
 * - Strictly rejects any legacy JWT token (`eyJ...` or 3-segment JWT including `service_role` / `anon`).
 * - Validates HTTPS Supabase URL (no credentials, no query/hash, no path, no wildcards).
 * - Permits `localhost` / `127.0.0.1` ONLY in an explicitly identified local test environment, and NEVER in production.
 * - Enforces `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`.
 * - Enforces isolated storageKey: `orthogonal.pdi.supabase.auth.dev.v1`.
 * - Performs ZERO network calls at module import time (safe in CI even when unconfigured).
 * - Strictly browser-safe: zero server-side admin SDKs, database drivers, or server secrets.
 */

import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

export const SUPABASE_AUTH_STORAGE_KEY = "orthogonal.pdi.supabase.auth.dev.v1" as const;
export const SUPABASE_PUBLISHABLE_KEY_PREFIX = "sb_publishable_" as const;
const FORBIDDEN_SECRET_PREFIX = ["sb", "secret", ""].join("_");

export type SupabaseValidationErrorCode =
  | "MISSING_SUPABASE_URL"
  | "MALFORMED_SUPABASE_URL"
  | "INSECURE_HTTP_URL_FORBIDDEN"
  | "LOCALHOST_FORBIDDEN_OUTSIDE_TEST"
  | "MISSING_PUBLISHABLE_KEY"
  | "FORBIDDEN_SECRET_KEY"
  | "LEGACY_JWT_KEY_FORBIDDEN"
  | "INVALID_PUBLISHABLE_KEY_PREFIX"
  | "MALFORMED_PUBLISHABLE_KEY";

export interface SupabaseUrlValidationOptions {
  /**
   * Must be explicitly true AND running in a verified non-production test environment
   * to allow `http://localhost` or `http://127.0.0.1`.
   */
  allowLocalhostTestOnly?: boolean;
  /**
   * Explicit environment mode (`"production"` | `"development"` | `"test"`).
   * In `"production"`, localhost and HTTP are unconditionally rejected even if `allowLocalhostTestOnly` is true.
   */
  mode?: string;
}

export interface SupabaseUrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  code?: SupabaseValidationErrorCode;
  error?: string;
}

export interface SupabaseKeyValidationResult {
  isValid: boolean;
  publishableKey?: string;
  code?: SupabaseValidationErrorCode;
  error?: string;
}

export interface SupabaseBrowserEnvInput {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  MODE?: string;
  NODE_ENV?: string;
  VITEST?: string;
}

export interface SupabaseBrowserConfigValidationResult {
  isValid: boolean;
  url?: string;
  publishableKey?: string;
  storageKey: typeof SUPABASE_AUTH_STORAGE_KEY;
  authOptions: {
    persistSession: true;
    autoRefreshToken: true;
    detectSessionInUrl: true;
    storageKey: typeof SUPABASE_AUTH_STORAGE_KEY;
  };
  code?: SupabaseValidationErrorCode;
  error?: string;
}

export interface CreateSupabaseBrowserClientOptions extends SupabaseUrlValidationOptions {
  /**
   * Optional custom fetch implementation (useful in unit tests to verify zero eager network calls).
   */
  customFetch?: typeof fetch;
}

/**
 * Resolves only the allowed public browser environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`).
 */
export function readSupabaseBrowserEnv(customEnv?: SupabaseBrowserEnvInput): SupabaseBrowserEnvInput {
  if (customEnv) {
    return {
      VITE_SUPABASE_URL: customEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: customEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
      MODE: customEnv.MODE,
      NODE_ENV: customEnv.NODE_ENV,
      VITEST: customEnv.VITEST
    };
  }

  const metaEnv: Record<string, string | undefined> =
    typeof import.meta !== "undefined" && (import.meta as any).env
      ? ((import.meta as any).env as Record<string, string | undefined>)
      : {};

  const nodeEnv: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

  return {
    VITE_SUPABASE_URL: metaEnv.VITE_SUPABASE_URL ?? nodeEnv.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    MODE: metaEnv.MODE ?? nodeEnv.NODE_ENV,
    NODE_ENV: nodeEnv.NODE_ENV ?? metaEnv.MODE,
    VITEST: nodeEnv.VITEST ?? metaEnv.VITEST
  };
}

/**
 * Determines whether the current execution context is an explicitly identified local test environment,
 * while strictly guaranteeing that production NEVER relaxes security checks.
 */
function isExplicitLocalTestContext(
  env: SupabaseBrowserEnvInput,
  options: SupabaseUrlValidationOptions = {}
): { isProduction: boolean; canAllowLocalhost: boolean } {
  const mode = (options.mode ?? env.NODE_ENV ?? env.MODE ?? "").toLowerCase();
  const isProduction = mode === "production";

  if (isProduction) {
    return { isProduction: true, canAllowLocalhost: false };
  }

  const isTestRuntime = mode === "test" || env.VITEST === "true" || env.NODE_ENV === "test";
  const canAllowLocalhost = options.allowLocalhostTestOnly === true && isTestRuntime;

  return { isProduction: false, canAllowLocalhost };
}

/**
 * Validates the Supabase project URL for the browser client.
 * - Requires HTTPS for all remote hosts.
 * - Rejects malformed URLs, credentials, paths, query strings, fragments, and wildcards.
 * - Rejects `localhost` / `127.0.0.1` unless explicitly authorized in a non-production test environment.
 */
export function validateSupabaseBrowserUrl(
  rawUrl: unknown,
  options: SupabaseUrlValidationOptions = {},
  env: SupabaseBrowserEnvInput = {}
): SupabaseUrlValidationResult {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return {
      isValid: false,
      code: "MISSING_SUPABASE_URL",
      error: "VITE_SUPABASE_URL is missing or empty."
    };
  }

  const trimmed = rawUrl.trim();

  // Reject control chars, whitespace, semicolons, quotes, backslashes, or wildcards
  if (/[\x00-\x1f\x7f;'"\\\s*]/.test(trimmed)) {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL contains forbidden characters or wildcards."
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL is not a valid URL."
    };
  }

  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL must not contain embedded credentials."
    };
  }

  if (parsed.search !== "" || parsed.hash !== "" || trimmed.includes("?") || trimmed.includes("#")) {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL must not contain query parameters or fragments."
    };
  }

  if (parsed.pathname !== "/" || trimmed.endsWith("/")) {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL must be a pure origin without trailing slash or path."
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const { isProduction, canAllowLocalhost } = isExplicitLocalTestContext(env, options);

  if (isLocalhost) {
    if (isProduction || !canAllowLocalhost) {
      return {
        isValid: false,
        code: "LOCALHOST_FORBIDDEN_OUTSIDE_TEST",
        error:
          "Localhost Supabase URL is forbidden unless explicitly enabled in a verified local test environment."
      };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isValid: false,
        code: "MALFORMED_SUPABASE_URL",
        error: "Unsupported URL protocol for localhost test environment."
      };
    }

    return {
      isValid: true,
      normalizedUrl: parsed.origin.toLowerCase()
    };
  }

  // Remote host: reject non-http/https schemes as malformed, and http: as insecure
  if (parsed.protocol === "http:") {
    return {
      isValid: false,
      code: "INSECURE_HTTP_URL_FORBIDDEN",
      error: "VITE_SUPABASE_URL must use HTTPS for remote Supabase endpoints."
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL uses an unsupported protocol."
    };
  }

  // Require a valid multi-label domain name (and reject raw IPv4 addresses as remote Supabase URLs)
  const isRawIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (isRawIpv4 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(hostname)) {
    return {
      isValid: false,
      code: "MALFORMED_SUPABASE_URL",
      error: "VITE_SUPABASE_URL hostname is invalid."
    };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.origin.toLowerCase()
  };
}

/**
 * Checks whether a string looks like a legacy JWT (e.g. `eyJ...` or 3 dot-separated base64url segments).
 */
function isLegacyJwtFormat(candidate: string): boolean {
  if (/^eyJ[A-Za-z0-9_-]*\./.test(candidate)) {
    return true;
  }
  const parts = candidate.split(".");
  if (parts.length === 3 && parts.every((p) => p.length >= 4 && /^[A-Za-z0-9_-]+$/.test(p))) {
    return true;
  }
  return false;
}

/**
 * Validates `VITE_SUPABASE_PUBLISHABLE_KEY`.
 * - Rejects `sb_secret_...` immediately (`FORBIDDEN_SECRET_KEY`).
 * - Rejects any legacy JWT (`eyJ...` / `service_role` / `anon` JWT) (`LEGACY_JWT_KEY_FORBIDDEN`).
 * - Accepts ONLY keys starting with `sb_publishable_` followed by a valid token identifier.
 * - Never includes the raw key value in any error message.
 */
export function validateSupabasePublishableKey(rawKey: unknown): SupabaseKeyValidationResult {
  if (typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return {
      isValid: false,
      code: "MISSING_PUBLISHABLE_KEY",
      error: "VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty."
    };
  }

  const trimmed = rawKey.trim();

  // 1. Strictly reject any Supabase secret key (sb_secret_...)
  if (trimmed.toLowerCase().startsWith(FORBIDDEN_SECRET_PREFIX)) {
    return {
      isValid: false,
      code: "FORBIDDEN_SECRET_KEY",
      error:
        "SECURITY VIOLATION: A Supabase secret key (sb_secret_) must NEVER be used in the browser client."
    };
  }

  // 2. Strictly reject any legacy JWT (service_role or anon JWT)
  if (isLegacyJwtFormat(trimmed)) {
    return {
      isValid: false,
      code: "LEGACY_JWT_KEY_FORBIDDEN",
      error:
        "SECURITY VIOLATION: Legacy JWT keys (including service_role JWTs) are forbidden as browser publishable keys. Use an sb_publishable_ key."
    };
  }

  // 3. Require the official `sb_publishable_` prefix
  if (!trimmed.startsWith(SUPABASE_PUBLISHABLE_KEY_PREFIX)) {
    return {
      isValid: false,
      code: "INVALID_PUBLISHABLE_KEY_PREFIX",
      error: "VITE_SUPABASE_PUBLISHABLE_KEY must start with 'sb_publishable_'."
    };
  }

  // 4. Validate token body characters and minimum length after `sb_publishable_`
  const suffix = trimmed.slice(SUPABASE_PUBLISHABLE_KEY_PREFIX.length);
  if (suffix.length < 8 || !/^[A-Za-z0-9_-]+$/.test(suffix)) {
    return {
      isValid: false,
      code: "MALFORMED_PUBLISHABLE_KEY",
      error: "VITE_SUPABASE_PUBLISHABLE_KEY has a malformed token body."
    };
  }

  return {
    isValid: true,
    publishableKey: trimmed
  };
}

/**
 * Returns the canonical browser auth options for Orthogonal PD&I Studio.
 */
export function buildSupabaseBrowserClientOptions(
  customFetch?: typeof fetch
): SupabaseClientOptions<"public"> {
  return {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: SUPABASE_AUTH_STORAGE_KEY
    },
    ...(customFetch ? { global: { fetch: customFetch } } : {})
  };
}

/**
 * Validates the complete browser configuration (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`)
 * without making any network requests.
 */
export function validateSupabaseBrowserConfig(
  customEnv?: SupabaseBrowserEnvInput,
  options: SupabaseUrlValidationOptions = {}
): SupabaseBrowserConfigValidationResult {
  const env = readSupabaseBrowserEnv(customEnv);
  const baseAuthOptions = {
    persistSession: true as const,
    autoRefreshToken: true as const,
    detectSessionInUrl: true as const,
    storageKey: SUPABASE_AUTH_STORAGE_KEY
  };

  const urlCheck = validateSupabaseBrowserUrl(env.VITE_SUPABASE_URL, options, env);
  if (!urlCheck.isValid || !urlCheck.normalizedUrl) {
    return {
      isValid: false,
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      authOptions: baseAuthOptions,
      code: urlCheck.code,
      error: urlCheck.error
    };
  }

  const keyCheck = validateSupabasePublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!keyCheck.isValid || !keyCheck.publishableKey) {
    return {
      isValid: false,
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      authOptions: baseAuthOptions,
      code: keyCheck.code,
      error: keyCheck.error
    };
  }

  return {
    isValid: true,
    url: urlCheck.normalizedUrl,
    publishableKey: keyCheck.publishableKey,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    authOptions: baseAuthOptions
  };
}

/**
 * Checks whether the Supabase browser client is validly configured in the current environment,
 * without throwing or initiating any network connection.
 */
export function isSupabaseBrowserConfigured(
  customEnv?: SupabaseBrowserEnvInput,
  options: SupabaseUrlValidationOptions = {}
): boolean {
  return validateSupabaseBrowserConfig(customEnv, options).isValid;
}

/**
 * Creates a validated Supabase browser client instance.
 * Throws a descriptive error (without leaking any secret value) if validation fails.
 */
export function createSupabaseBrowserClient(
  customEnv?: SupabaseBrowserEnvInput,
  options: CreateSupabaseBrowserClientOptions = {}
): SupabaseClient {
  const validation = validateSupabaseBrowserConfig(customEnv, options);
  if (!validation.isValid || !validation.url || !validation.publishableKey) {
    const err = new Error(
      `[SupabaseBrowserConfigError:${validation.code ?? "INVALID_CONFIG"}] ${
        validation.error ?? "Invalid Supabase browser configuration."
      }`
    );
    (err as any).code = validation.code ?? "INVALID_CONFIG";
    throw err;
  }

  const clientOptions = buildSupabaseBrowserClientOptions(options.customFetch);
  return createClient(validation.url, validation.publishableKey, clientOptions);
}

let cachedBrowserClient: SupabaseClient | null = null;

/**
 * Lazily retrieves the singleton Supabase browser client.
 * Guarantees zero network requests at module load time.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!cachedBrowserClient) {
    cachedBrowserClient = createSupabaseBrowserClient();
  }
  return cachedBrowserClient;
}

/**
 * Resets the cached singleton browser client (for isolated unit testing).
 */
export function resetSupabaseBrowserClientForTesting(): void {
  cachedBrowserClient = null;
}
