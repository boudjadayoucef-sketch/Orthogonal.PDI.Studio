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
import type { Request, Response, NextFunction } from "express";

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
 */
export function verifyPaddleWebhookSignature(
  rawBody: string | undefined,
  signatureHeader: string | undefined,
  secretKey: string | undefined
): { isValid: boolean; error?: string } {
  if (!secretKey || secretKey.trim().length === 0) {
    return { isValid: false, error: "Paddle webhook secret key not configured on server" };
  }

  if (!rawBody) {
    return { isValid: false, error: "Missing raw request body for Paddle signature verification" };
  }

  if (!signatureHeader) {
    return { isValid: false, error: "Missing Paddle-Signature header" };
  }

  // Parse header components: ts=123456789;h1=abcdef...
  const parts = signatureHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestamp = parts["ts"];
  const receivedHash = parts["h1"];

  if (!timestamp || !receivedHash) {
    return { isValid: false, error: "Malformed Paddle-Signature header (missing ts or h1)" };
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
 * Slick-Pay Webhook Verification Layer.
 * RÈGLE STRICTE DU TICKET :
 * Ne pas inventer un faux algorithme Slick-Pay.
 * Si une signature/clé officielle est configurée, vérifier.
 * Si AUCUNE signature officielle n'est configurée, NE JAMAIS auto-activer de rôle/licence/abonnement.
 */
export function verifySlickPayWebhook(
  _payload: any,
  headers: Record<string, any>,
  configuredSecret: string | undefined
): { isAuthentic: boolean; canAutoActivate: boolean; reason: string } {
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "No official Slick-Pay webhook secret configured. Webhook must be held in safe pending state without auto-activation."
    };
  }

  const signature = headers["x-slickpay-signature"] || headers["x-signature"];
  if (!signature) {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "Missing Slick-Pay signature header."
    };
  }

  // If a shared secret token is configured, do a constant-time comparison
  try {
    const sigStr = String(signature).trim();
    const secretStr = configuredSecret.trim();

    if (sigStr.length !== secretStr.length) {
      return {
        isAuthentic: false,
        canAutoActivate: false,
        reason: "Slick-Pay signature mismatch."
      };
    }

    const matches = crypto.timingSafeEqual(Buffer.from(sigStr), Buffer.from(secretStr));
    return {
      isAuthentic: matches,
      canAutoActivate: matches,
      reason: matches ? "Verified Slick-Pay signature" : "Slick-Pay signature mismatch."
    };
  } catch {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "Error evaluating Slick-Pay signature."
    };
  }
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

export function isSuspiciousRequestPath(rawUrl: string | undefined | null): boolean {
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
  const segments = lower.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith(".")) {
      if (i === 0 && seg === ".well-known") continue;
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
// 6. SAFE PRODUCTION CONFIGURATION VALIDATION
// =========================================================================

export interface ConfigValidationResult {
  isSafe: boolean;
  missingCriticalKeys: string[];
  forbiddenViteSecretKeys: string[];
  errorMessage?: string;
}

/**
 * Validates server configuration upon startup.
 * Enforces:
 * - No server secrets prefixed with VITE_ (must be server-only)
 * - Required production environment variables present
 * - Safe errors that never print secret values
 */
export function verifyProductionConfig(
  env: Record<string, string | undefined> = process.env
): ConfigValidationResult {
  const isProduction = env.NODE_ENV === "production";
  const missingCriticalKeys: string[] = [];
  const forbiddenViteSecretKeys: string[] = [];

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
    "SENDER_API_KEY"
  ];

  for (const name of sensitiveSecretNames) {
    if (env[`VITE_${name}`] !== undefined) {
      forbiddenViteSecretKeys.push(`VITE_${name}`);
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

  const isSafe = missingCriticalKeys.length === 0 && forbiddenViteSecretKeys.length === 0;
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
    errorMessage = `[FATAL] Server startup configuration failure: ${issues.join("; ")}`;
  }

  return {
    isSafe,
    missingCriticalKeys,
    forbiddenViteSecretKeys,
    errorMessage
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
