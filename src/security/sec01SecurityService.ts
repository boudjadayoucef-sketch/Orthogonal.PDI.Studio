/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01 SECURITY SERVICE — ATOMIC PRODUCTION HARDENING
 * Reference: TICKET SEC-01-FIX-01
 *
 * Responsibilities:
 * 1. Bounded In-Memory Rate Limiter (No infinite Map growth / memory leaks)
 * 2. Target Email Anti-Bombing Throttler
 * 3. Official Webhook Signature Verification (Paddle HMAC-SHA256 & Slick-Pay strict non-auto-activation)
 * 4. Idempotency & Anti-Replay Guard for Provider Events
 * 5. Open Redirect Protection (Strict allowlist + safe relative path validation)
 * 6. Safe Production Configuration Validation (No silent fallbacks / no leaked secrets)
 * 7. Portable Email Provider Interface & Safe Default
 */

import crypto from "node:crypto";
import net from "node:net";
import express from "express";
import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { resolvePdiEnvironmentMode } from "../lib/stagingSandbox.ts";

// =========================================================================
// 1. BOUNDED IN-MEMORY RATE LIMITER
// =========================================================================

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  maxEntries?: number;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class BoundedRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, RateLimitRecord>();

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxEntries = options.maxEntries ?? 5000;
  }

  public get size(): number {
    return this.store.size;
  }

  public clear(): void {
    this.store.clear();
  }

  /**
   * Cleans expired entries and enforces upper bound on map size.
   */
  private prune(now: number): void {
    // 1. Prune expired entries
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }

    // 2. If still exceeding maxEntries, evict oldest entries (FIFO)
    if (this.store.size >= this.maxEntries) {
      const keysToDelete = Array.from(this.store.keys()).slice(0, Math.floor(this.maxEntries * 0.2) + 1);
      for (const k of keysToDelete) {
        this.store.delete(k);
      }
    }
  }

  public consume(key: string): { allowed: boolean; currentCount: number; retryAfterSec?: number } {
    const now = Date.now();

    // Prevent map from growing unbounded
    if (this.store.size >= this.maxEntries) {
      this.prune(now);
    }

    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true, currentCount: 1 };
    }

    record.count++;
    if (record.count > this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      return { allowed: false, currentCount: record.count, retryAfterSec };
    }

    return { allowed: true, currentCount: record.count };
  }

  public middleware(errorMessage = "Trop de requêtes. Veuillez patienter avant de réessayer.") {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = (req.ip || req.socket.remoteAddress || "unknown_ip").toString();
      const result = this.consume(ip);

      if (!result.allowed) {
        if (result.retryAfterSec) {
          res.setHeader("Retry-After", result.retryAfterSec);
        }
        return res.status(429).json({
          error: errorMessage,
          retryAfterSec: result.retryAfterSec
        });
      }

      next();
    };
  }
}

export function createBoundedRateLimiter(options: RateLimitOptions): BoundedRateLimiter {
  return new BoundedRateLimiter(options);
}

// =========================================================================
// 2. EMAIL ANTI-BOMBING THROTTLER
// =========================================================================

export interface EmailThrottleOptions {
  windowMs?: number; // default: 15 minutes
  maxRequestsPerEmail?: number; // default: 3
  maxEntries?: number;
}

export class EmailAntiBombingThrottler {
  private readonly limiter: BoundedRateLimiter;

  constructor(options: EmailThrottleOptions = {}) {
    this.limiter = new BoundedRateLimiter({
      windowMs: options.windowMs ?? 15 * 60 * 1000,
      maxRequests: options.maxRequestsPerEmail ?? 3,
      maxEntries: options.maxEntries ?? 10000
    });
  }

  public normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  public checkAndConsume(email: string): { allowed: boolean; retryAfterSec?: number } {
    const normalized = this.normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) {
      return { allowed: false, retryAfterSec: 60 };
    }
    const result = this.limiter.consume(normalized);
    return {
      allowed: result.allowed,
      retryAfterSec: result.retryAfterSec
    };
  }

  public clear(): void {
    this.limiter.clear();
  }
}

export function createEmailAntiBombingThrottler(options?: EmailThrottleOptions): EmailAntiBombingThrottler {
  return new EmailAntiBombingThrottler(options);
}

// =========================================================================
// 3. WEBHOOK SIGNATURE VERIFICATION
// =========================================================================

/**
 * Official Paddle Billing Webhook Signature Verification (HMAC-SHA256).
 * Header format: `ts=<timestamp>;h1=<hmac_sha256_hash>`
 * Signed payload: `<timestamp>:<rawRequestBody>`
 * SEC-01-FIX-05-A: Must operate strictly on the original raw HTTP body bytes (never JSON.stringify(req.body)).
 */
export function verifyPaddleWebhookSignature(
  rawBody: string | undefined,
  signatureHeader: string | undefined,
  secretKey: string | undefined
): { isValid: boolean; error?: string } {
  if (!secretKey || typeof secretKey !== "string" || secretKey.trim().length === 0) {
    return { isValid: false, error: "Paddle webhook secret key not configured on server" };
  }

  if (typeof rawBody !== "string" || rawBody.length === 0) {
    return { isValid: false, error: "Missing raw request body for Paddle signature verification" };
  }

  if (!signatureHeader || typeof signatureHeader !== "string" || signatureHeader.trim().length === 0) {
    return { isValid: false, error: "Missing Paddle-Signature header" };
  }

  // Parse header components: ts=123456789;h1=abcdef...
  const parts = signatureHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = part.slice(eqIdx + 1).trim();
      if (k && v) acc[k] = v;
    }
    return acc;
  }, {});

  const timestamp = parts["ts"];
  const receivedHash = parts["h1"];

  // SEC-01-FIX-05-A-R1 (B1): Strictly require digits for ts and EXACTLY 64 hexadecimal characters for h1
  // before any Buffer.from(..., "hex") call (which would otherwise silently truncate a 65-char hex string).
  if (
    !timestamp ||
    !receivedHash ||
    !/^\d+$/.test(timestamp) ||
    receivedHash.length !== 64 ||
    !/^[0-9a-fA-F]{64}$/.test(receivedHash)
  ) {
    return {
      isValid: false,
      error: "Malformed Paddle-Signature header (ts must be digits and h1 must be exactly 64 hex characters)"
    };
  }

  // Replay tolerance: check timestamp within 10 minutes (600 seconds)
  const tsNum = parseInt(timestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(tsNum) || Math.abs(nowSec - tsNum) > 600) {
    return { isValid: false, error: "Paddle webhook timestamp out of tolerance window" };
  }

  try {
    const signedPayload = `${timestamp}:${rawBody}`;
    const expectedHash = crypto
      .createHmac("sha256", secretKey.trim())
      .update(signedPayload, "utf8")
      .digest("hex");

    // Timing-safe comparison to prevent side-channel timing attacks
    const receivedBuf = Buffer.from(receivedHash, "hex");
    const expectedBuf = Buffer.from(expectedHash, "hex");

    if (receivedBuf.length !== expectedBuf.length) {
      return { isValid: false, error: "Paddle webhook signature length mismatch" };
    }

    const matches = crypto.timingSafeEqual(receivedBuf, expectedBuf);
    return matches
      ? { isValid: true }
      : { isValid: false, error: "Paddle webhook signature mismatch" };
  } catch (err: any) {
    return { isValid: false, error: `Paddle signature calculation error: ${err?.message || err}` };
  }
}

/**
 * Slick-Pay Webhook Verification Layer (SEC-01-FIX-05-A — Strict Fail-Closed).
 *
 * RÈGLE STRICTE SEC-01-FIX-05-A :
 * - La comparaison directe d'un header avec un secret partagé n'est PAS confirmée comme protocole officiel Slick-Pay.
 * - Ne jamais retourner `isAuthentic: true` sur cette seule base.
 * - Forcer `canAutoActivate: false` tant que le protocole officiel n'est pas documenté et vérifié.
 * - Ne pas inventer de mécanisme de signature ni de documentation fournisseur.
 */
export function verifySlickPayWebhook(
  _payload: unknown,
  headers: Record<string, unknown> | undefined,
  configuredSecret: string | undefined
): { isAuthentic: boolean; canAutoActivate: boolean; reason: string } {
  if (!configuredSecret || typeof configuredSecret !== "string" || configuredSecret.trim().length === 0) {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "No official Slick-Pay webhook secret configured. Webhook rejected in fail-closed mode without auto-activation."
    };
  }

  const safeHeaders = headers && typeof headers === "object" ? headers : {};
  const rawSignature =
    safeHeaders["x-slickpay-signature"] ??
    safeHeaders["X-SlickPay-Signature"] ??
    safeHeaders["x-signature"] ??
    safeHeaders["X-Signature"];

  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
  if (!signature || typeof signature !== "string" || signature.trim().length === 0) {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "Missing Slick-Pay signature header. Webhook rejected in fail-closed mode."
    };
  }

  // SEC-01-FIX-05-A: Direct comparison of a header with a shared secret is NOT sufficient proof of authenticity.
  // Even if the header matches configuredSecret, both isAuthentic and canAutoActivate MUST remain false.
  return {
    isAuthentic: false,
    canAutoActivate: false,
    reason:
      "Unverified Slick-Pay webhook protocol: direct shared-secret header comparison is not accepted as proof of authenticity. Webhook held fail-closed without auto-activation."
  };
}

// =========================================================================
// 4. IDEMPOTENCE & ANTI-REPLAY GUARD
// =========================================================================

export class WebhookIdempotencyRegistry {
  private readonly processedEvents = new Set<string>();
  private readonly inProgressEvents = new Set<string>();
  private readonly maxCacheSize: number;

  constructor(maxCacheSize = 10000) {
    this.maxCacheSize = maxCacheSize;
  }

  public isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  public isInProgress(eventId: string): boolean {
    return this.inProgressEvents.has(eventId);
  }

  public markInProgress(eventId: string): boolean {
    if (this.processedEvents.has(eventId) || this.inProgressEvents.has(eventId)) {
      return false; // Already handled or currently being processed
    }
    this.inProgressEvents.add(eventId);
    return true;
  }

  public markCompleted(eventId: string): void {
    this.inProgressEvents.delete(eventId);
    if (this.processedEvents.size >= this.maxCacheSize) {
      // FIFO eviction
      const oldestKey = this.processedEvents.values().next().value;
      if (oldestKey) this.processedEvents.delete(oldestKey);
    }
    this.processedEvents.add(eventId);
  }

  public releaseInProgress(eventId: string): void {
    this.inProgressEvents.delete(eventId);
  }

  public clear(): void {
    this.processedEvents.clear();
    this.inProgressEvents.clear();
  }
}

export const globalWebhookIdempotency = new WebhookIdempotencyRegistry();

// =========================================================================
// 5. OPEN REDIRECT PROTECTION
// =========================================================================

/**
 * Validates a return or activation URL to prevent Open Redirect attacks.
 * Accepts:
 * - Safe relative URLs: must start with a single `/` and NOT `//` or `/\`.
 * - Absolute URLs ONLY if the origin strictly matches one of the allowedOrigins.
 * Rejects:
 * - `//evil.com`, `/\evil.com`
 * - `javascript:`, `data:`, `vbscript:`
 * - External domains not in allowlist.
 */
export function validateRedirectUrl(
  targetUrl: string | undefined | null,
  allowedOrigins: string[] = []
): { isValid: boolean; safeUrl: string } {
  if (!targetUrl || typeof targetUrl !== "string") {
    return { isValid: true, safeUrl: "/" };
  }

  const trimmed = targetUrl.trim();
  if (trimmed === "") {
    return { isValid: true, safeUrl: "/" };
  }

  // Reject dangerous pseudo-protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return { isValid: false, safeUrl: "/" };
  }

  // Check if it's a relative path: starts with / but NOT // or /\ (protocol-relative trick)
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
      return { isValid: false, safeUrl: "/" };
    }
    return { isValid: true, safeUrl: trimmed };
  }

  // If absolute URL, parse and verify origin
  try {
    const parsed = new URL(trimmed);
    const origin = parsed.origin.toLowerCase();
    const normalizedAllowed = allowedOrigins.map((o) => o.toLowerCase().replace(/\/+$/, ""));

    if (normalizedAllowed.includes(origin)) {
      return { isValid: true, safeUrl: trimmed };
    }

    return { isValid: false, safeUrl: "/" };
  } catch {
    // Malformed URL
    return { isValid: false, safeUrl: "/" };
  }
}

// =========================================================================
// 5.B PATH TRAVERSAL, DOTFILES & SENSITIVE FILE PROBE PROTECTION
// =========================================================================

export interface SuspiciousRequestPathOptions {
  /**
   * Autorise exclusivement les dépendances pré-bundlées Vite (`/node_modules/.vite/...`)
   * lorsque le serveur Express sert le middleware Vite en développement local / preview AI Studio.
   * Défaut : `false` (rejet strict maintenu en production, staging, dist statique et Serverless).
   */
  allowViteDevDeps?: boolean;
}

export function isSuspiciousRequestPath(
  rawUrl: string | undefined | null,
  options: SuspiciousRequestPathOptions = {}
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  // 1. Rejet immédiat des octets nuls et backslashes
  if (rawUrl.includes("\0") || /%00/i.test(rawUrl) || rawUrl.includes("\\") || /%5c/i.test(rawUrl)) {
    return true;
  }

  // Isoler le pathname sans la query string
  const rawPath = rawUrl.split("?")[0] || "/";

  // 2. Décodage URI sécurisé (rejeter tout encodage malformé type %E0%A4%A)
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
    if (decodedPath.includes("%")) {
      decodedPath = decodeURIComponent(decodedPath);
    }
  } catch {
    return true;
  }

  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    return true;
  }

  const lower = decodedPath.toLowerCase();

  // 3. Rejet de toute séquence de Path Traversal
  if (lower.includes("..") || lower.includes("/..")) {
    return true;
  }

  // 4. Rejet des dotfiles et dossiers cachés (/.env, /.git, /.htaccess...), sauf /.well-known/
  //    et, uniquement en mode dev Vite explicite (`allowViteDevDeps: true`), `/node_modules/.vite/...`.
  const segments = lower.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith(".")) {
      if (i === 0 && seg === ".well-known") continue;
      if (
        options.allowViteDevDeps === true &&
        i === 1 &&
        segments[0] === "node_modules" &&
        seg === ".vite"
      ) {
        continue;
      }
      return true;
    }
  }

  // 5. Rejet des sondes sur scripts serveur et fichiers de configuration internes
  const forbiddenExtensions = [
    ".php", ".phtml", ".phar", ".cgi", ".pl", ".sh", ".bash",
    ".env", ".pem", ".key", ".pkcs12", ".pfx", ".p12", ".crt",
    ".bak", ".old", ".sql"
  ];
  for (const ext of forbiddenExtensions) {
    if (lower.endsWith(ext) || lower.includes(`${ext}/`)) {
      return true;
    }
  }

  const forbiddenExactFiles = [
    "/server.ts",
    "/package.json",
    "/package-lock.json",
    "/tsconfig.json",
    "/firestore.rules",
    "/firebase-blueprint.json"
  ];
  if (forbiddenExactFiles.includes(lower)) {
    return true;
  }

  return false;
}

// =========================================================================
// 5.C CSP FRAME-ANCESTORS & STRICT ORIGIN VALIDATION (SEC-01-FIX-07-R1 D1)
// =========================================================================

/** Verified exact Google AI Studio parent frame origin (no wildcard *.google.com / *.run.app) */
export const VERIFIED_AISTUDIO_FRAME_ANCESTOR = "https://aistudio.google.com" as const;

export interface OriginValidationOptions {
  /** Allow http://localhost and http://127.0.0.1 in non-production environments only */
  allowLocalhostHttp?: boolean;
}

export interface OriginValidationResult {
  isValid: boolean;
  normalizedOrigin?: string;
  error?: string;
}

/**
 * Validates and normalizes a single origin entry (SEC-01-FIX-07-R1 D1.1 & D1.2).
 * Rejects:
 * - Wildcards (`*`, `https://*.google.com`, `https://*.run.app`, `https://*.googleusercontent.com`)
 * - Control characters, semicolons (`;`), quotes, whitespace, or backslashes
 * - Non-HTTPS origins (except `http://localhost` / `http://127.0.0.1` when `allowLocalhostHttp: true`)
 * - Origins containing paths (including trailing `/`), query parameters (`?`), fragments (`#`), or credentials
 */
export function validateOriginEntry(
  rawOrigin: unknown,
  options: OriginValidationOptions = {}
): OriginValidationResult {
  if (typeof rawOrigin !== "string") {
    return { isValid: false, error: "Origin must be a string" };
  }

  const trimmed = rawOrigin.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Origin cannot be empty" };
  }

  // Reject control characters, semicolons (CSP injection), spaces, quotes, backslashes
  if (/[\x00-\x1f\x7f;'"\\\s]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Origin contains forbidden characters (control chars, semicolon, quotes, or whitespace)"
    };
  }

  // Reject any wildcard '*' (global '*' or subdomain wildcard '*.domain')
  if (trimmed.includes("*")) {
    return {
      isValid: false,
      error: "Wildcard '*' is forbidden in validated origins"
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: `Malformed origin URL: ${trimmed}` };
  }

  if (parsed.username || parsed.password) {
    return { isValid: false, error: "Origin must not contain credentials" };
  }

  if (parsed.search !== "" || parsed.hash !== "" || trimmed.includes("?") || trimmed.includes("#")) {
    return {
      isValid: false,
      error: "Origin must not contain query parameters or fragments"
    };
  }

  if (parsed.pathname !== "/" || trimmed.endsWith("/")) {
    return {
      isValid: false,
      error: "Origin must not contain a path or trailing slash"
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (parsed.protocol === "https:") {
    if (!isLocalhost && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(hostname)) {
      return { isValid: false, error: `Invalid HTTPS hostname: ${hostname}` };
    }
  } else if (parsed.protocol === "http:") {
    if (!options.allowLocalhostHttp || !isLocalhost) {
      return {
        isValid: false,
        error: "Non-HTTPS origin is forbidden in production or for non-localhost hosts"
      };
    }
  } else {
    return {
      isValid: false,
      error: `Unsupported origin protocol: ${parsed.protocol}`
    };
  }

  return {
    isValid: true,
    normalizedOrigin: parsed.origin.toLowerCase()
  };
}

/**
 * Validates `APP_URL` strictly as an HTTPS origin (SEC-01-FIX-07-R1 D1.1).
 */
export function validateAppUrl(rawAppUrl: string | undefined): OriginValidationResult {
  if (rawAppUrl === undefined || rawAppUrl.trim() === "") {
    return { isValid: true };
  }
  return validateOriginEntry(rawAppUrl, { allowLocalhostHttp: false });
}

export interface AllowedOriginsValidationResult {
  isValid: boolean;
  origins: string[];
  invalidEntries: string[];
  error?: string;
}

/**
 * Validates and normalizes `ALLOWED_ORIGINS` while preserving legitimate base origins (SEC-01-FIX-07-R1 D1.2).
 */
export function validateAllowedOrigins(
  rawAllowedOrigins: string | undefined,
  options: { isProduction?: boolean; baseOrigins?: string[]; appUrl?: string } = {}
): AllowedOriginsValidationResult {
  const isProduction = options.isProduction === true;
  const allowLocalhostHttp = !isProduction;
  const invalidEntries: string[] = [];
  const normalizedSet = new Set<string>();

  const defaultBaseOrigins = options.baseOrigins ?? [
    VERIFIED_AISTUDIO_FRAME_ANCESTOR,
    "https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
    "https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
    ...(!isProduction ? ["http://localhost:3000", "http://127.0.0.1:3000"] : [])
  ];

  for (const base of defaultBaseOrigins) {
    const res = validateOriginEntry(base, { allowLocalhostHttp });
    if (res.isValid && res.normalizedOrigin) {
      normalizedSet.add(res.normalizedOrigin);
    }
  }

  if (options.appUrl !== undefined && options.appUrl.trim() !== "") {
    const appUrlRes = validateAppUrl(options.appUrl);
    if (appUrlRes.isValid && appUrlRes.normalizedOrigin) {
      normalizedSet.add(appUrlRes.normalizedOrigin);
    }
  }

  if (rawAllowedOrigins !== undefined && rawAllowedOrigins.trim() !== "") {
    const entries = rawAllowedOrigins.split(",").map((s) => s.trim());
    for (const entry of entries) {
      if (!entry) {
        invalidEntries.push(entry);
        continue;
      }
      const check = validateOriginEntry(entry, { allowLocalhostHttp });
      if (!check.isValid || !check.normalizedOrigin) {
        invalidEntries.push(entry);
      } else {
        normalizedSet.add(check.normalizedOrigin);
      }
    }
  }

  if (invalidEntries.length > 0) {
    return {
      isValid: false,
      origins: Array.from(normalizedSet),
      invalidEntries,
      error: `Invalid ALLOWED_ORIGINS entries rejected: ${invalidEntries.join(", ")}`
    };
  }

  return {
    isValid: true,
    origins: Array.from(normalizedSet),
    invalidEntries: []
  };
}

export interface CspFrameAncestorsResolution {
  isValid: boolean;
  /** Space-separated list of validated frame-ancestors sources (e.g. `'self' https://aistudio.google.com`) */
  value: string;
  /** Full directive `frame-ancestors <value>` */
  directive: string;
  ancestors: string[];
  error?: string;
}

/**
 * Pure, modular, testable resolver for the CSP `frame-ancestors` policy (SEC-01-FIX-07-R1 D1.1).
 *
 * Guarantees:
 * - `'self'` and the verified Google AI Studio origin (`https://aistudio.google.com`) are included.
 * - `APP_URL`, when provided, is validated strictly as an HTTPS origin before inclusion.
 * - `CSP_FRAME_ANCESTORS` is strictly validated token-by-token before any header construction.
 * - Rejects `;` (CSP directive injection), control characters, malformed origins, and general wildcards (`*.google.com`, `*.run.app`, etc.).
 * - Forbids `*` in production (`NODE_ENV === "production"`).
 * - Never concatenates unvalidated environment strings into the CSP header; falls closed to `'self' https://aistudio.google.com` on error.
 */
const ALLOWED_STATIC_DIST_FLAGS = new Set<string>(["true", "false", "1", "0"]);

export interface ServerDeliveryModeResolution {
  isValid: boolean;
  serveStaticDist: boolean;
  strictSecurityMode: boolean;
  isProductionNodeEnv: boolean;
  isStagingNodeEnv: boolean;
  explicitStaticDistFlag?: string;
  errorMessage?: string;
}

/**
 * STAGING-00-B4-FIX-ENV-02 (Parties A & E) :
 * Dissocie la livraison statique compilée (`dist/`) et le durcissement Cloud Run de `NODE_ENV=production`
 * tout en préservant strictement la protection C5 (`NODE_ENV=production` + `sandbox` toujours interdit).
 *
 * Règles explicites :
 * - `PDI_SERVE_STATIC_DIST` accepte uniquement `true`, `false`, `1`, `0` (ou absent).
 * - `NODE_ENV=production` exige la livraison statique (`PDI_SERVE_STATIC_DIST=false` refusé).
 * - `NODE_ENV=staging` exige explicitement `PDI_SERVE_STATIC_DIST=true` (ou `1`) ; le serveur dev Vite
 *   est strictement interdit en staging (comportement fail-closed explicite).
 * - En mode `production`, `staging` ou `PDI_SERVE_STATIC_DIST=true`, `strictSecurityMode === true`
 *   (trust proxy, CORS strict, CSP sans wildcard ni localhost, validation de config bloquante, `/api/health/assets` minimal).
 */
export function resolveServerDeliveryMode(
  env: Record<string, string | undefined> = process.env
): ServerDeliveryModeResolution {
  const rawNodeEnv = typeof env.NODE_ENV === "string" ? env.NODE_ENV.trim().toLowerCase() : "";
  const isProductionNodeEnv = rawNodeEnv === "production";
  const isStagingNodeEnv = rawNodeEnv === "staging";

  const rawFlag =
    typeof env.PDI_SERVE_STATIC_DIST === "string"
      ? env.PDI_SERVE_STATIC_DIST.trim().toLowerCase()
      : undefined;
  const hasExplicitFlag = rawFlag !== undefined && rawFlag.length > 0;

  if (hasExplicitFlag && !ALLOWED_STATIC_DIST_FLAGS.has(rawFlag!)) {
    return {
      isValid: false,
      serveStaticDist: false,
      strictSecurityMode: true,
      isProductionNodeEnv,
      isStagingNodeEnv,
      explicitStaticDistFlag: rawFlag,
      errorMessage: `Valeur invalide pour PDI_SERVE_STATIC_DIST ('${rawFlag}'). Valeurs autorisées : true, false, 1, 0.`,
    };
  }

  const explicitTrue = rawFlag === "true" || rawFlag === "1";
  const explicitFalse = rawFlag === "false" || rawFlag === "0";

  if (isProductionNodeEnv && explicitFalse) {
    return {
      isValid: false,
      serveStaticDist: false,
      strictSecurityMode: true,
      isProductionNodeEnv,
      isStagingNodeEnv,
      explicitStaticDistFlag: rawFlag,
      errorMessage:
        "Configuration interdite : PDI_SERVE_STATIC_DIST=false est interdit lorsque NODE_ENV=production (serveur de développement Vite interdit en production).",
    };
  }

  if (isStagingNodeEnv && !explicitTrue) {
    return {
      isValid: false,
      serveStaticDist: false,
      strictSecurityMode: true,
      isProductionNodeEnv,
      isStagingNodeEnv,
      explicitStaticDistFlag: rawFlag,
      errorMessage:
        "Politique de sécurité Cloud Run / Staging : NODE_ENV=staging exige PDI_SERVE_STATIC_DIST=true pour servir le bundle statique compilé dist/. Le serveur de développement Vite est strictement interdit en staging.",
    };
  }

  const serveStaticDist = explicitTrue || isProductionNodeEnv;
  const strictSecurityMode = isProductionNodeEnv || isStagingNodeEnv || serveStaticDist;

  return {
    isValid: true,
    serveStaticDist,
    strictSecurityMode,
    isProductionNodeEnv,
    isStagingNodeEnv,
    explicitStaticDistFlag: hasExplicitFlag ? rawFlag : undefined,
  };
}

// =========================================================================
// 5.B STRICT TRUST_PROXY VALIDATION & CENTRALIZED CSP BUILDER (FIX-ENV-03)
// =========================================================================

export type ExpressTrustProxyValue = boolean | number | string | string[];

export interface TrustProxyResolution {
  isValid: boolean;
  value: ExpressTrustProxyValue;
  rawValue?: string;
  error?: string;
}

export const MAX_TRUST_PROXY_HOPS = 32;

/**
 * Express `proxy-addr` documented named subnet presets.
 */
export const ALLOWED_TRUST_PROXY_PRESETS = new Set<string>([
  "loopback",
  "linklocal",
  "uniquelocal",
]);

function isValidIpOrCidrToken(token: string): boolean {
  if (!token || /\s/.test(token)) {
    return false;
  }

  const slashIdx = token.indexOf("/");
  if (slashIdx === -1) {
    return net.isIP(token) !== 0;
  }

  if (token.indexOf("/", slashIdx + 1) !== -1) {
    return false;
  }

  const ipPart = token.slice(0, slashIdx);
  const prefixPart = token.slice(slashIdx + 1);
  if (!/^\d+$/.test(prefixPart)) {
    return false;
  }

  const ipVersion = net.isIP(ipPart);
  if (ipVersion === 0) {
    return false;
  }

  const prefix = Number(prefixPart);
  const maxPrefix = ipVersion === 4 ? 32 : 128;
  return Number.isSafeInteger(prefix) && prefix >= 0 && prefix <= maxPrefix;
}

/**
 * STAGING-00-B4-FIX-ENV-03 (FIX-01) & FIX-ENV-03-FIX-01 :
 * Valide strictement `TRUST_PROXY` selon les formats documentés par Express :
 * - absent (`undefined`) -> défaut sûr (`1` en mode strict Cloud Run / production / staging, `false` sinon) ;
 * - booléen `false` (insensible à la casse) -> autorisé dans tous les modes ;
 * - booléen `true` (insensible à la casse) -> interdit en mode strict (`production`, `staging` ou livraison statique)
 *   afin d'empêcher l'usurpation d'en-têtes `X-Forwarded-*` (accepté uniquement hors mode strict en développement) ;
 * - entiers valides non négatifs : `0..32` (ex. `TRUST_PROXY=1` recommandé pour Cloud Run) ;
 * - liste séparée par virgules de valeurs proxy documentées Express (`loopback`, `linklocal`, `uniquelocal`)
 *   et/ou d'adresses IPv4/IPv6 ou sous-réseaux CIDR valides.
 * Toute valeur vide explicite, inconnue, mal formée ou contenant des caractères de contrôle est rejetée.
 */
export function resolveTrustProxyConfig(
  rawTrustProxy: string | undefined,
  options: { strictSecurityMode?: boolean } = {}
): TrustProxyResolution {
  const defaultValue: ExpressTrustProxyValue = options.strictSecurityMode ? 1 : false;

  if (rawTrustProxy === undefined) {
    return {
      isValid: true,
      value: defaultValue,
    };
  }

  if (typeof rawTrustProxy !== "string" || /[\x00-\x1f\x7f]/.test(rawTrustProxy)) {
    return {
      isValid: false,
      value: defaultValue,
      rawValue: String(rawTrustProxy),
      error: "TRUST_PROXY contient des caractères de contrôle interdits ou un type invalide.",
    };
  }

  const trimmed = rawTrustProxy.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      value: defaultValue,
      rawValue: rawTrustProxy,
      error: "TRUST_PROXY ne peut pas être vide lorsqu'il est explicitement défini.",
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower === "true") {
    if (options.strictSecurityMode) {
      return {
        isValid: false,
        value: defaultValue,
        rawValue: trimmed,
        error:
          "TRUST_PROXY=true est interdit en mode strict (production, staging ou livraison statique) : utilisez un nombre explicite de sauts (ex. TRUST_PROXY=1 pour Cloud Run), 'false', un preset documenté ou une liste IP/CIDR.",
      };
    }
    return { isValid: true, value: true, rawValue: trimmed };
  }
  if (lower === "false") {
    return { isValid: true, value: false, rawValue: trimmed };
  }

  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    if (!Number.isSafeInteger(hops) || hops < 0 || hops > MAX_TRUST_PROXY_HOPS) {
      return {
        isValid: false,
        value: defaultValue,
        rawValue: trimmed,
        error: `TRUST_PROXY entier hors bornes ('${trimmed}'). Valeurs autorisées : entier entre 0 et ${MAX_TRUST_PROXY_HOPS}.`,
      };
    }
    return { isValid: true, value: hops, rawValue: trimmed };
  }

  const rawParts = trimmed.split(",");
  const normalizedTokens: string[] = [];
  for (const part of rawParts) {
    const token = part.trim();
    if (!token) {
      return {
        isValid: false,
        value: defaultValue,
        rawValue: trimmed,
        error: `TRUST_PROXY mal formé ('${trimmed}') : entrée vide dans la liste de proxies.`,
      };
    }

    const tokenLower = token.toLowerCase();
    if (ALLOWED_TRUST_PROXY_PRESETS.has(tokenLower)) {
      normalizedTokens.push(tokenLower);
      continue;
    }

    if (isValidIpOrCidrToken(token)) {
      normalizedTokens.push(token);
      continue;
    }

    return {
      isValid: false,
      value: defaultValue,
      rawValue: trimmed,
      error: `Valeur TRUST_PROXY non reconnue ou mal formée ('${token}'). Formats autorisés : true, false, entier 0..${MAX_TRUST_PROXY_HOPS}, loopback, linklocal, uniquelocal, IP/CIDR valide.`,
    };
  }

  return {
    isValid: true,
    value: normalizedTokens.length === 1 ? normalizedTokens[0] : normalizedTokens,
    rawValue: trimmed,
  };
}

export const OPENCV_EMBIND_UNSAFE_EVAL_DEPENDENCY = "@techstark/opencv-js@5.0.0-release.1" as const;

export const OPENCV_EMBIND_UNSAFE_EVAL_JUSTIFICATION =
  "Requis par @techstark/opencv-js@5.0.0-release.1 (chargé par src/pdi/sketch/openCvSketchDetector.ts) : le runtime Emscripten Embind exécute inconditionnellement `new Function(...)` dans `createJsInvoker` (via `craftInvokerFunction`, 5 sites) et `__emval_get_method_caller` sans fallback statique ; `'wasm-unsafe-eval'` seul autorise WebAssembly mais pas `new Function()`.";

export interface ContentSecurityPolicyResolution {
  headerValue: string;
  scriptSrc: string;
  frameAncestors: CspFrameAncestorsResolution;
  allowsUnsafeEval: boolean;
  unsafeEvalDependency: string;
  unsafeEvalJustification: string;
}

/**
 * STAGING-00-B4-FIX-ENV-03 (FIX-02) :
 * Construit de manière centralisée et testable l'en-tête `Content-Security-Policy` durci :
 * - Conserve toutes les directives strictes existantes + ajoute `base-uri 'self'` et `form-action 'self'`.
 * - Inclut `'wasm-unsafe-eval'` pour OpenCV.js / Tesseract.js WebAssembly.
 * - Maintient `'unsafe-eval'` uniquement en raison de la contrainte technique avérée d'Emscripten Embind
 *   dans `@techstark/opencv-js@5.0.0-release.1` (`new Function()` inconditionnel sans fallback).
 * - Conserve `'unsafe-inline'` pour le script d'injection runtime minimal sans secret (`#pdi-runtime-config`).
 * - Applique `resolveCspFrameAncestors(env)` (sans `*` ni `localhost` en mode strict).
 */
export function buildContentSecurityPolicy(
  env: Record<string, string | undefined> = process.env
): ContentSecurityPolicyResolution {
  const frameAncestors = resolveCspFrameAncestors(env);
  const scriptSrc =
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://apis.google.com";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
    frameAncestors.directive,
    "object-src 'none'",
  ];

  return {
    headerValue: directives.join("; "),
    scriptSrc,
    frameAncestors,
    allowsUnsafeEval: true,
    unsafeEvalDependency: OPENCV_EMBIND_UNSAFE_EVAL_DEPENDENCY,
    unsafeEvalJustification: OPENCV_EMBIND_UNSAFE_EVAL_JUSTIFICATION,
  };
}

export function resolveCspFrameAncestors(
  env: Record<string, string | undefined> = process.env
): CspFrameAncestorsResolution {
  const deliveryMode = resolveServerDeliveryMode(env);
  const isProd = deliveryMode.strictSecurityMode;
  const failClosedAncestors = ["'self'", VERIFIED_AISTUDIO_FRAME_ANCESTOR];
  const failClosedValue = failClosedAncestors.join(" ");

  const ancestorsSet = new Set<string>(failClosedAncestors);

  // 1. Validate APP_URL if provided
  if (env.APP_URL !== undefined && env.APP_URL.trim() !== "") {
    const appUrlCheck = validateAppUrl(env.APP_URL);
    if (!appUrlCheck.isValid || !appUrlCheck.normalizedOrigin) {
      return {
        isValid: false,
        value: failClosedValue,
        directive: `frame-ancestors ${failClosedValue}`,
        ancestors: failClosedAncestors,
        error: `Invalid APP_URL for CSP frame-ancestors: ${appUrlCheck.error}`
      };
    }
    ancestorsSet.add(appUrlCheck.normalizedOrigin);
  }

  const rawCspAncestors = env.CSP_FRAME_ANCESTORS;

  // 2. If CSP_FRAME_ANCESTORS is not configured, use safe environment defaults
  if (rawCspAncestors === undefined || rawCspAncestors.trim() === "") {
    if (!isProd) {
      ancestorsSet.add("https://*.google.com");
      ancestorsSet.add("https://*.usercontent.goog");
      if (env.APP_URL && /^https:\/\/ais-dev-[a-z0-9-]+\.[a-z0-9.-]+\.run\.app$/i.test(env.APP_URL.trim())) {
        ancestorsSet.add(env.APP_URL.trim().replace(/^https:\/\/ais-dev-/i, "https://ais-pre-"));
      }
      ancestorsSet.add("http://localhost:3000");
      ancestorsSet.add("http://127.0.0.1:3000");
    }
    const ancestors = Array.from(ancestorsSet);
    const value = ancestors.join(" ");
    return {
      isValid: true,
      value,
      directive: `frame-ancestors ${value}`,
      ancestors
    };
  }

  // 3. Reject control characters and semicolon directive injection immediately
  if (/[\x00-\x1f\x7f;]/.test(rawCspAncestors)) {
    return {
      isValid: false,
      value: failClosedValue,
      directive: `frame-ancestors ${failClosedValue}`,
      ancestors: failClosedAncestors,
      error: "CSP_FRAME_ANCESTORS contains forbidden control characters or directive separator ';'"
    };
  }

  const tokens = rawCspAncestors
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      isValid: false,
      value: failClosedValue,
      directive: `frame-ancestors ${failClosedValue}`,
      ancestors: failClosedAncestors,
      error: "CSP_FRAME_ANCESTORS cannot be whitespace-only"
    };
  }

  for (const token of tokens) {
    if (token === "'self'" || token === "self") {
      ancestorsSet.add("'self'");
      continue;
    }

    if (token === "*") {
      if (isProd) {
        return {
          isValid: false,
          value: failClosedValue,
          directive: `frame-ancestors ${failClosedValue}`,
          ancestors: failClosedAncestors,
          error: "Wildcard '*' is strictly forbidden in CSP_FRAME_ANCESTORS in production"
        };
      }
      ancestorsSet.add("*");
      continue;
    }

    if (token.includes("*")) {
      return {
        isValid: false,
        value: failClosedValue,
        directive: `frame-ancestors ${failClosedValue}`,
        ancestors: failClosedAncestors,
        error: `Wildcard origin '${token}' is forbidden in CSP_FRAME_ANCESTORS`
      };
    }

    const originCheck = validateOriginEntry(token, { allowLocalhostHttp: !isProd });
    if (!originCheck.isValid || !originCheck.normalizedOrigin) {
      return {
        isValid: false,
        value: failClosedValue,
        directive: `frame-ancestors ${failClosedValue}`,
        ancestors: failClosedAncestors,
        error: `Invalid origin '${token}' in CSP_FRAME_ANCESTORS: ${originCheck.error}`
      };
    }

    ancestorsSet.add(originCheck.normalizedOrigin);
  }

  const ancestors = Array.from(ancestorsSet);
  const value = ancestors.join(" ");
  return {
    isValid: true,
    value,
    directive: `frame-ancestors ${value}`,
    ancestors
  };
}

// =========================================================================
// 6. SAFE PRODUCTION CONFIGURATION VALIDATION
// =========================================================================

export interface ConfigValidationResult {
  isSafe: boolean;
  missingCriticalKeys: string[];
  forbiddenViteSecretKeys: string[];
  invalidConfigKeys?: string[];
  hasFatalSandboxConfigError?: boolean;
  errorMessage?: string;
}

export const SUPABASE_SECRET_CREDENTIAL_PATTERN = /sb_secret_[0-9a-zA-Z_-]{16,}/;
export const SUPABASE_PAT_CREDENTIAL_PATTERN = /sbp_[0-9a-zA-Z]{20,}/;

/**
 * Detects whether a raw text or environment value contains an exposed Supabase secret credential
 * (`sb_secret_...` key or `sbp_...` personal access token) without treating bare variable names as credentials.
 */
export function containsExposedSupabaseSecretCredential(value: unknown): boolean {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  const trimmed = value.trim();
  return (
    /^sb_secret_/i.test(trimmed) ||
    SUPABASE_SECRET_CREDENTIAL_PATTERN.test(trimmed) ||
    SUPABASE_PAT_CREDENTIAL_PATTERN.test(trimmed)
  );
}

/**
 * Validates server configuration upon startup.
 * Enforces:
 * - No server secrets prefixed with VITE_ (must be server-only)
 * - Required production environment variables present
 * - Strict validation of APP_URL, ALLOWED_ORIGINS, and CSP_FRAME_ANCESTORS (SEC-01-FIX-07-R1 D1)
 * - Protection C5 (STAGING-00-B3): Forbids Sandbox mode in production, rejects frontend/server PDI_ENV mismatches, and rejects ambiguous PDI_ENV values
 * - Safe errors that never print secret values
 */
export function verifyProductionConfig(
  env: Record<string, string | undefined> = process.env
): ConfigValidationResult {
  const deliveryMode = resolveServerDeliveryMode(env);
  const isProduction = deliveryMode.isProductionNodeEnv;
  const isStrictSecurity = deliveryMode.strictSecurityMode;
  const missingCriticalKeys: string[] = [];
  const forbiddenViteSecretKeys: string[] = [];
  const invalidConfigKeys: string[] = [];
  let hasFatalSandboxConfigError = false;

  if (!deliveryMode.isValid) {
    hasFatalSandboxConfigError = true;
    invalidConfigKeys.push(
      `PDI_SERVE_STATIC_DIST (${deliveryMode.errorMessage ?? "Invalid static delivery configuration"})`
    );
  }

  // Check for accidentally leaked server secrets using VITE_ prefix
  const sensitiveSecretNames = [
    "PADDLE_WEBHOOK_SECRET",
    "PADDLE_WEBHOOK_SECRET_KEY",
    "SLICKPAY_WEBHOOK_SECRET",
    "FIREBASE_SERVICE_ACCOUNT",
    "FIREBASE_ADMIN_CREDENTIALS",
    "SMTP_PASSWORD",
    "BREVO_API_KEY",
    "RESEND_API_KEY",
    "SENDER_API_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SB_SECRET",
    "SB_SECRET_KEY",
    "DATABASE_URL",
    "DIRECT_URL",
    "SQL_PASSWORD",
    "SQL_ADMIN_PASSWORD"
  ];

  for (const name of sensitiveSecretNames) {
    if (env[`VITE_${name}`] !== undefined) {
      forbiddenViteSecretKeys.push(`VITE_${name}`);
    }
  }

  // MIG-01-FIX-02-R1: Also block any VITE_ variable whose value contains a Supabase secret credential (sb_secret_ or sbp_)
  for (const [envKey, envVal] of Object.entries(env)) {
    if (
      envKey.startsWith("VITE_") &&
      containsExposedSupabaseSecretCredential(envVal) &&
      !forbiddenViteSecretKeys.includes(envKey)
    ) {
      forbiddenViteSecretKeys.push(envKey);
    }
  }

  if (isProduction) {
    // In production, reject explicit demo project placeholders (e.g. 'demo-app-id', 'demo-project')
    const projectId =
      env.FIREBASE_PROJECT_ID ||
      env.GOOGLE_CLOUD_PROJECT ||
      env.GCLOUD_PROJECT ||
      env.VITE_FIREBASE_PROJECT_ID ||
      "graphical-router-x18qq";

    if (projectId.startsWith("demo-") && !env.ALLOW_DEMO_PROJECT_IN_PROD) {
      missingCriticalKeys.push("FIREBASE_PROJECT_ID (cannot use demo project in production)");
    }
  }

  // Protection C5 (STAGING-00-B3): Validate PDI_ENV & VITE_PDI_ENV coherence, ambiguity, and production prohibition
  const pdiEnvCheck = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true,
  });
  if (!pdiEnvCheck.isValid) {
    hasFatalSandboxConfigError = true;
    invalidConfigKeys.push(
      `PDI_ENV/VITE_PDI_ENV (${pdiEnvCheck.errorCode}: ${pdiEnvCheck.errorMessage})`
    );
  }

  // SEC-01-FIX-07-R1 (D1.1 & D1.2) & FIX-ENV-02 (Partie E): Validate APP_URL, ALLOWED_ORIGINS, and CSP_FRAME_ANCESTORS
  if (env.APP_URL !== undefined && env.APP_URL.trim() !== "") {
    const appUrlCheck = validateAppUrl(env.APP_URL);
    if (!appUrlCheck.isValid) {
      invalidConfigKeys.push(`APP_URL (${appUrlCheck.error})`);
    }
  }

  if (env.ALLOWED_ORIGINS !== undefined && env.ALLOWED_ORIGINS.trim() !== "") {
    const originsCheck = validateAllowedOrigins(env.ALLOWED_ORIGINS, {
      isProduction: isStrictSecurity,
      appUrl: env.APP_URL
    });
    if (!originsCheck.isValid) {
      invalidConfigKeys.push(`ALLOWED_ORIGINS (${originsCheck.error})`);
    }
  }

  // STAGING-00-B4-FIX-ENV-03 (FIX-01): Validate TRUST_PROXY strictly (blocking in strict security mode)
  const trustProxyCheck = resolveTrustProxyConfig(env.TRUST_PROXY, {
    strictSecurityMode: isStrictSecurity,
  });
  if (!trustProxyCheck.isValid) {
    invalidConfigKeys.push(`TRUST_PROXY (${trustProxyCheck.error})`);
  }

  const cspCheck = resolveCspFrameAncestors(env);
  if (!cspCheck.isValid) {
    invalidConfigKeys.push(`CSP_FRAME_ANCESTORS (${cspCheck.error})`);
  }

  const isSafe =
    missingCriticalKeys.length === 0 &&
    forbiddenViteSecretKeys.length === 0 &&
    invalidConfigKeys.length === 0;
  let errorMessage: string | undefined;

  if (!isSafe) {
    const issues: string[] = [];
    if (missingCriticalKeys.length > 0) {
      issues.push(`Missing critical server keys: ${missingCriticalKeys.join(", ")}`);
    }
    if (forbiddenViteSecretKeys.length > 0) {
      issues.push(
        `Server secrets MUST NOT use VITE_ prefix (exposed to client bundle): ${forbiddenViteSecretKeys.join(", ")}`
      );
    }
    if (invalidConfigKeys.length > 0) {
      issues.push(`Invalid security configuration: ${invalidConfigKeys.join("; ")}`);
    }
    errorMessage = `[FATAL] Server startup configuration failure: ${issues.join("; ")}`;
  }

  return {
    isSafe,
    missingCriticalKeys,
    forbiddenViteSecretKeys,
    invalidConfigKeys,
    hasFatalSandboxConfigError,
    errorMessage
  };
}

// =========================================================================
// 6.B HTTP BODY LIMITS, SELECTIVE RAWBODY & GLOBAL ERROR MASKING (SEC-01-FIX-07-R1 D2 & D3)
// =========================================================================

export const HTTP_BODY_LIMIT = "256kb" as const;
export const URLENCODED_PARAMETER_LIMIT = 100 as const;

/**
 * Isolated JSON parser for `POST /api/webhooks/paddle` ONLY (SEC-01-FIX-07-R1 D2.2).
 * Captures the exact raw UTF-8 request body into `req.rawBody` for HMAC-SHA256 verification
 * while enforcing the strict 256kb payload ceiling.
 */
export function createPaddleWebhookBodyParser() {
  return express.json({
    limit: HTTP_BODY_LIMIT,
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  });
}

/**
 * Standard JSON body parser with strict 256kb limit and NO `rawBody` allocation (SEC-01-FIX-07-R1 D2.1).
 * Skips `/api/webhooks/paddle` so that only `createPaddleWebhookBodyParser` parses and captures `rawBody` there.
 */
export function createStandardJsonParser() {
  const jsonParser = express.json({
    limit: HTTP_BODY_LIMIT
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const cleanPath = (req.originalUrl || req.url || req.path || "").split("?")[0];
    if (cleanPath === "/api/webhooks/paddle") {
      return next();
    }
    return jsonParser(req, res, next);
  };
}

/**
 * Standard URL-encoded body parser with strict 256kb limit, `extended: false`, and `parameterLimit: 100` (SEC-01-FIX-07-R1 D2.1).
 */
export function createStandardUrlencodedParser() {
  return express.urlencoded({
    limit: HTTP_BODY_LIMIT,
    extended: false,
    parameterLimit: URLENCODED_PARAMETER_LIMIT
  });
}

/**
 * Global Express error-handling middleware (SEC-01-FIX-07-R1 D2.4 & D3).
 *
 * Enforces:
 * - `entity.too.large` / HTTP 413 -> HTTP 413 generic JSON (`PAYLOAD_TOO_LARGE`)
 * - Malformed JSON / `entity.parse.failed` / `parameters.too.many` / HTTP 400 -> HTTP 400 generic JSON (`MALFORMED_PAYLOAD`)
 * - Any other unhandled error -> HTTP 500 generic JSON (`INTERNAL_SERVER_ERROR`)
 * - Never leaks `err.message`, `err.stack`, filesystem paths, or internal parser details to the client.
 */
export function createGlobalExpressErrorHandler(): ErrorRequestHandler {
  return (err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = Number(err?.status || err?.statusCode || 500);
    const errorType = typeof err?.type === "string" ? err.type : "";

    if (errorType === "entity.too.large" || status === 413) {
      console.warn("[HTTP 413] Request payload exceeded maximum allowed size (256kb).");
      return res.status(413).json({
        error: "Payload too large",
        code: "PAYLOAD_TOO_LARGE"
      });
    }

    if (
      errorType === "entity.parse.failed" ||
      errorType === "parameters.too.many" ||
      errorType === "charset.unsupported" ||
      errorType === "encoding.unsupported" ||
      (err instanceof SyntaxError && status === 400) ||
      status === 400
    ) {
      console.warn("[HTTP 400] Malformed request body rejected.");
      return res.status(400).json({
        error: "Malformed request payload",
        code: "MALFORMED_PAYLOAD"
      });
    }

    console.error("[HTTP 500] Unhandled internal server error:", err?.code || errorType || "InternalError");
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  };
}

// =========================================================================
// 7. PORTABLE EMAIL PROVIDER CONTRACT
// =========================================================================

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailSendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(payload: EmailPayload): Promise<EmailSendResult>;
}

/**
 * Safe unconfigured fallback that never throws unhandled errors or exposes secrets.
 */
export class SafeUnconfiguredEmailProvider implements EmailProvider {
  public readonly name = "unconfigured_portable";

  async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
    console.warn(
      `[SafeEmailProvider] Email to <${payload.to.replace(/(?<=.{2}).(?=[^@]*?@)/g, "*")}> not sent: No external email provider active. Configuration required (Sender, Brevo, Resend, or SMTP).`
    );
    return {
      success: false,
      provider: this.name,
      error: "Email provider not configured on server."
    };
  }
}
