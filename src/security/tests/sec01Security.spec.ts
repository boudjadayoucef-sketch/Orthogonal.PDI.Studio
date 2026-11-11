/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-01 — TEST SUITE: SÉCURITÉ ATOMIQUE
 *
 * Couverture :
 * 1. Auth & Super Admin (Custom Claims, email_verified, suppression autorité par email)
 * 2. Bounded Rate Limiting & Hygiène Mémoire (429, expiration, borne maxEntries)
 * 3. Webhook Security & Idempotence (Paddle HMAC SHA256, Slick-Pay strict non-auto-activation, anti-replay)
 * 4. Open Redirect Prevention (Safe relative URLs, domain allowlist, attack vectors blocked)
 * 5. Production Configuration Safety (Missing critical keys fail safe, no VITE_ server secrets)
 * 6. Email Anti-Bombing Throttler & Portable Provider Contract
 * 7. Firestore Security Rules Audit (Deny by default, no email authority, no unauthenticated writes)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  requireRole,
  requireSuperAdmin,
  requireEmailVerified,
  isEmailVerified,
  AuthRequest
} from "../../middleware/auth.ts";
import {
  createBoundedRateLimiter,
  BoundedRateLimiter,
  createEmailAntiBombingThrottler,
  verifyPaddleWebhookSignature,
  verifySlickPayWebhook,
  WebhookIdempotencyRegistry,
  validateRedirectUrl,
  verifyProductionConfig,
  SafeUnconfiguredEmailProvider,
  isSuspiciousRequestPath
} from "../sec01SecurityService.ts";

describe("SEC-01-FIX-01 : Sécurité Atomique Frontend / Serveur / Auth / Webhook", () => {
  // =========================================================================
  // 1. AUTHENTIFICATION ET SUPER ADMIN
  // =========================================================================
  describe("A — Authentification et Super Admin (Custom Claims)", () => {
    it("A1: Utilisateur non authentifié (user absent) -> 401 Unauthorized", () => {
      const middleware = requireSuperAdmin;
      let statusCode = 200;
      let responseBody: any = null;

      const mockReq = {} as AuthRequest;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            }
          };
        }
      } as any;
      const nextFn = vi.fn();

      middleware(mockReq, mockRes, nextFn);

      expect(statusCode).toBe(401);
      expect(responseBody?.code).toBe("auth/unauthorized");
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("A2: Utilisateur authentifié sans rôle Super Admin -> 403 Forbidden", () => {
      const middleware = requireSuperAdmin;
      let statusCode = 200;
      let responseBody: any = null;

      const mockReq = {
        user: {
          uid: "user_standard",
          email: "user@example.com",
          role: "client"
        }
      } as unknown as AuthRequest;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            }
          };
        }
      } as any;
      const nextFn = vi.fn();

      middleware(mockReq, mockRes, nextFn);

      expect(statusCode).toBe(403);
      expect(responseBody?.code).toBe("auth/forbidden-role");
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("A3: Super Admin uniquement via Custom Claim role === 'super_admin' -> Autorisé (next appelé)", () => {
      const middleware = requireSuperAdmin;
      const mockReq = {
        user: {
          uid: "admin_uid_123",
          email: "admin@enterprise.dz",
          role: "super_admin",
          email_verified: true
        }
      } as unknown as AuthRequest;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;
      const nextFn = vi.fn();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("A4: RÈGLE STRICTE A1 : Ancienne adresse email sans Custom Claim role -> REFUSÉ (403)", () => {
      const middleware = requireSuperAdmin;
      let statusCode = 200;

      // Email historique mais sans custom claim super_admin (ex: token volé ou falsifié)
      const mockReq = {
        user: {
          uid: "intruder_with_known_email",
          email: "boudjada.youcef@gmail.com",
          role: "client" // ou undefined
        }
      } as unknown as AuthRequest;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return { json: vi.fn() };
        }
      } as any;
      const nextFn = vi.fn();

      middleware(mockReq, mockRes, nextFn);

      expect(statusCode).toBe(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("A5: Action sensible exige email_verified === true ; refus si non vérifié (403)", () => {
      let statusCode = 200;
      let responseBody: any = null;

      // Utilisateur avec email non vérifié
      const mockReqUnverified = {
        user: {
          uid: "admin_unverified",
          email: "admin@unverified.dz",
          email_verified: false,
          role: "super_admin"
        }
      } as unknown as AuthRequest;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            }
          };
        }
      } as any;
      const nextFn = vi.fn();

      requireEmailVerified(mockReqUnverified, mockRes, nextFn);

      expect(statusCode).toBe(403);
      expect(responseBody?.code).toBe("auth/unverified-email");
      expect(nextFn).not.toHaveBeenCalled();
      expect(isEmailVerified(mockReqUnverified.user)).toBe(false);

      // Avec email vérifié
      const mockReqVerified = {
        user: {
          uid: "admin_verified",
          email: "admin@verified.dz",
          email_verified: true,
          role: "super_admin"
        }
      } as unknown as AuthRequest;
      const nextVerified = vi.fn();

      requireEmailVerified(mockReqVerified, mockRes, nextVerified);
      expect(nextVerified).toHaveBeenCalledTimes(1);
      expect(isEmailVerified(mockReqVerified.user)).toBe(true);
    });
  });

  // =========================================================================
  // 2. RATE LIMITER BORNÉ ET HYGIÈNE MÉMOIRE
  // =========================================================================
  describe("F — Rate Limiter Borné et Hygiène Mémoire", () => {
    it("F1: Limite normale permet les requêtes jusqu'au seuil", () => {
      const limiter = createBoundedRateLimiter({
        windowMs: 10000,
        maxRequests: 3,
        maxEntries: 100
      });

      expect(limiter.consume("1.2.3.4").allowed).toBe(true);
      expect(limiter.consume("1.2.3.4").allowed).toBe(true);
      expect(limiter.consume("1.2.3.4").allowed).toBe(true);
    });

    it("F2: Dépassement du seuil -> allowed: false et code HTTP 429", () => {
      const limiter = createBoundedRateLimiter({
        windowMs: 10000,
        maxRequests: 2,
        maxEntries: 100
      });

      limiter.consume("10.0.0.1");
      limiter.consume("10.0.0.1");
      const blocked = limiter.consume("10.0.0.1");

      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSec).toBeGreaterThan(0);

      // Test middleware Express 429 response
      let statusCode = 200;
      let sentBody: any = null;
      let retryAfterHeader = "";
      const middleware = limiter.middleware("Custom rate limit error");

      middleware(
        { ip: "10.0.0.1", socket: {} } as any,
        {
          setHeader: (_k: string, v: any) => {
            retryAfterHeader = String(v);
          },
          status: (code: number) => {
            statusCode = code;
            return {
              json: (body: any) => {
                sentBody = body;
              }
            };
          }
        } as any,
        vi.fn()
      );

      expect(statusCode).toBe(429);
      expect(sentBody?.error).toBe("Custom rate limit error");
      expect(Number(retryAfterHeader)).toBeGreaterThan(0);
    });

    it("F3: Expiration des fenêtres temporelles restaure l'accès", async () => {
      // Fenêtre ultra-courte de 20ms pour tester l'expiration réelle
      const limiter = createBoundedRateLimiter({
        windowMs: 20,
        maxRequests: 1,
        maxEntries: 50
      });

      expect(limiter.consume("192.168.1.1").allowed).toBe(true);
      expect(limiter.consume("192.168.1.1").allowed).toBe(false);

      // Attente expiration
      await new Promise((r) => setTimeout(r, 35));

      expect(limiter.consume("192.168.1.1").allowed).toBe(true);
    });

    it("F4: Borne mémoire : la taille de la table ne dépasse pas maxEntries", () => {
      const maxEntries = 20;
      const limiter = createBoundedRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        maxEntries
      });

      // Insertion de 100 IPs distinctes
      for (let i = 0; i < 100; i++) {
        limiter.consume(`172.16.0.${i}`);
      }

      // La taille interne ne doit jamais exploser au-delà de maxEntries
      expect(limiter.size).toBeLessThanOrEqual(maxEntries);
    });
  });

  // =========================================================================
  // 3. WEBHOOKS PAIEMENT & ANTI-REJEU
  // =========================================================================
  describe("B — Webhooks Paiement, Signature & Anti-Rejeu", () => {
    const testSecret = "pdl_sec_test_secret_key_123456789";

    it("B1: Paddle - Signature valide calculée en HMAC-SHA256 -> Accepté", () => {
      const rawBody = JSON.stringify({
        event_id: "evt_paddle_100",
        event_type: "transaction.completed",
        data: { id: "txn_001", status: "paid" }
      });
      const ts = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${ts}:${rawBody}`;
      const h1 = crypto.createHmac("sha256", testSecret).update(signedPayload, "utf8").digest("hex");
      const signatureHeader = `ts=${ts};h1=${h1}`;

      const res = verifyPaddleWebhookSignature(rawBody, signatureHeader, testSecret);
      expect(res.isValid).toBe(true);
    });

    it("B2: Paddle - Signature altérée ou secrète erronée -> Rejeté (isValid: false)", () => {
      const rawBody = JSON.stringify({ event_id: "evt_paddle_tampered" });
      const ts = Math.floor(Date.now() / 1000).toString();
      const signatureHeader = `ts=${ts};h1=deadbeefcafebabe0123456789abcdefdeadbeefcafebabe0123456789abcdef`;

      const res = verifyPaddleWebhookSignature(rawBody, signatureHeader, testSecret);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("B2-R1 (SEC-01-FIX-05-A-R1 B1): Paddle - Validation stricte du format HMAC (exactement 64 caractères hexadécimaux) et de la fenêtre anti-rejeu", () => {
      const rawBody = JSON.stringify({
        event_id: "evt_paddle_strict_hex_001",
        event_type: "transaction.completed"
      });
      const nowSec = Math.floor(Date.now() / 1000);
      const ts = nowSec.toString();
      const validH1 = crypto
        .createHmac("sha256", testSecret)
        .update(`${ts}:${rawBody}`, "utf8")
        .digest("hex");

      // 1. Signature valide de 64 caractères hexadécimaux -> Acceptée
      expect(validH1).toHaveLength(64);
      expect(
        verifyPaddleWebhookSignature(rawBody, `ts=${ts};h1=${validH1}`, testSecret).isValid
      ).toBe(true);

      // 2. Signature de 63 caractères -> Rejetée avant décodage hex
      const sig63 = validH1.slice(0, 63);
      expect(sig63).toHaveLength(63);
      const res63 = verifyPaddleWebhookSignature(rawBody, `ts=${ts};h1=${sig63}`, testSecret);
      expect(res63.isValid).toBe(false);
      expect(res63.error).toContain("64 hex characters");

      // 3. Signature de 65 caractères (64 hex valides + 1 caractère hex que Buffer.from("hex") tronquerait silencieusement !) -> Rejetée
      const sig65 = `${validH1}a`;
      expect(sig65).toHaveLength(65);
      const res65 = verifyPaddleWebhookSignature(rawBody, `ts=${ts};h1=${sig65}`, testSecret);
      expect(res65.isValid).toBe(false);
      expect(res65.error).toContain("64 hex characters");

      // 4. Signature de 66 caractères -> Rejetée
      const sig66 = `${validH1}ab`;
      expect(sig66).toHaveLength(66);
      const res66 = verifyPaddleWebhookSignature(rawBody, `ts=${ts};h1=${sig66}`, testSecret);
      expect(res66.isValid).toBe(false);
      expect(res66.error).toContain("64 hex characters");

      // 5. Signature de 64 caractères contenant un caractère non hexadécimal -> Rejetée
      const sigNonHex = `${validH1.slice(0, 63)}g`;
      expect(sigNonHex).toHaveLength(64);
      const resNonHex = verifyPaddleWebhookSignature(rawBody, `ts=${ts};h1=${sigNonHex}`, testSecret);
      expect(resNonHex.isValid).toBe(false);
      expect(resNonHex.error).toContain("64 hex characters");

      // 6. Signature de 64 caractères hexadécimaux mais HMAC erroné -> Rejetée
      const wrongHex64 = validH1.startsWith("0") ? `1${validH1.slice(1)}` : `0${validH1.slice(1)}`;
      const resWrongHmac = verifyPaddleWebhookSignature(rawBody, `ts=${ts};h1=${wrongHex64}`, testSecret);
      expect(resWrongHmac.isValid).toBe(false);
      expect(resWrongHmac.error).toContain("signature mismatch");

      // 7. Timestamp hors tolérance (> 600s dans le passé ou le futur) -> Rejeté
      const expiredTs = (nowSec - 605).toString();
      const expiredH1 = crypto
        .createHmac("sha256", testSecret)
        .update(`${expiredTs}:${rawBody}`, "utf8")
        .digest("hex");
      const resExpired = verifyPaddleWebhookSignature(
        rawBody,
        `ts=${expiredTs};h1=${expiredH1}`,
        testSecret
      );
      expect(resExpired.isValid).toBe(false);
      expect(resExpired.error).toContain("out of tolerance window");

      const futureTs = (nowSec + 605).toString();
      const futureH1 = crypto
        .createHmac("sha256", testSecret)
        .update(`${futureTs}:${rawBody}`, "utf8")
        .digest("hex");
      const resFuture = verifyPaddleWebhookSignature(
        rawBody,
        `ts=${futureTs};h1=${futureH1}`,
        testSecret
      );
      expect(resFuture.isValid).toBe(false);
      expect(resFuture.error).toContain("out of tolerance window");
    });

    it("B3: Paddle - Secret serveur non configuré -> Rejeté sans tentative d'activation", () => {
      const res = verifyPaddleWebhookSignature("{}", "ts=123;h1=abc", undefined);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("not configured");
    });

    it("B4: Slick-Pay - RÈGLE STRICTE B3 & FIX-05-A : Sans configuration officielle, JAMAIS d'auto-activation", () => {
      const res = verifySlickPayWebhook(
        { invoice_id: "12345", status: "completed" },
        {},
        undefined // Pas de secret officiel configuré
      );

      expect(res.isAuthentic).toBe(false);
      expect(res.canAutoActivate).toBe(false);
      expect(res.reason).toContain("No official Slick-Pay webhook secret configured");
    });

    it("B4-bis (SEC-01-FIX-05-A): Slick-Pay - Comparaison directe header === secret non reconnue comme preuve officielle (isAuthentic: false, canAutoActivate: false)", () => {
      const sharedSecret = "slickpay_shared_secret_token_2026";
      const resMatchingHeader = verifySlickPayWebhook(
        { invoice_id: "12345", status: "completed" },
        { "x-slickpay-signature": sharedSecret },
        sharedSecret
      );

      expect(resMatchingHeader.isAuthentic).toBe(false);
      expect(resMatchingHeader.canAutoActivate).toBe(false);
      expect(resMatchingHeader.reason).toContain("Unverified Slick-Pay webhook protocol");
    });

    it("B5: Anti-Rejeu : un même identifiant d'événement provider ne peut être traité qu'une seule fois", () => {
      const registry = new WebhookIdempotencyRegistry(100);
      const eventId = "txn_provider_unique_999";

      // 1ère tentative : peut démarrer
      expect(registry.markInProgress(eventId)).toBe(true);
      expect(registry.isInProgress(eventId)).toBe(true);
      expect(registry.isProcessed(eventId)).toBe(false);

      // Tentative concurrente simultanée : bloquée
      expect(registry.markInProgress(eventId)).toBe(false);

      // Achèvement du traitement
      registry.markCompleted(eventId);
      expect(registry.isInProgress(eventId)).toBe(false);
      expect(registry.isProcessed(eventId)).toBe(true);

      // Rejeu ultérieur de la même transaction : bloqué
      expect(registry.markInProgress(eventId)).toBe(false);
    });
  });

  // =========================================================================
  // 4. OPEN REDIRECT PREVENTION
  // =========================================================================
  describe("Architecture Email & Open Redirect Prevention", () => {
    const allowedOrigins = [
      "https://orthogonal-pdi.dz",
      "https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app"
    ];

    it("Redir 1: Chemins relatifs sûrs acceptés", () => {
      expect(validateRedirectUrl("/dashboard", allowedOrigins)).toEqual({
        isValid: true,
        safeUrl: "/dashboard"
      });
      expect(validateRedirectUrl("/projects/42?view=iso", allowedOrigins)).toEqual({
        isValid: true,
        safeUrl: "/projects/42?view=iso"
      });
      expect(validateRedirectUrl("", allowedOrigins)).toEqual({
        isValid: true,
        safeUrl: "/"
      });
    });

    it("Redir 2: Protocole-relatif (//evil.com ou /\\evil.com) strictement rejeté", () => {
      const attack1 = validateRedirectUrl("//evil.com/phishing", allowedOrigins);
      expect(attack1.isValid).toBe(false);
      expect(attack1.safeUrl).toBe("/");

      const attack2 = validateRedirectUrl("/\\evil.com", allowedOrigins);
      expect(attack2.isValid).toBe(false);
      expect(attack2.safeUrl).toBe("/");
    });

    it("Redir 3: Domaines tiers non autorisés strictement rejetés", () => {
      const untrusted = validateRedirectUrl("https://evil-phishing-login.example.com", allowedOrigins);
      expect(untrusted.isValid).toBe(false);
      expect(untrusted.safeUrl).toBe("/");
    });

    it("Redir 4: Pseudo-protocoles (javascript:, data:) strictement rejetés", () => {
      const xss1 = validateRedirectUrl("javascript:alert(1)", allowedOrigins);
      expect(xss1.isValid).toBe(false);
      expect(xss1.safeUrl).toBe("/");

      const xss2 = validateRedirectUrl("data:text/html;base64,PHNjcmlwdD4=", allowedOrigins);
      expect(xss2.isValid).toBe(false);
      expect(xss2.safeUrl).toBe("/");
    });

    it("Redir 5: Domaine expressément dans la whitelist accepté", () => {
      const trusted = validateRedirectUrl(
        "https://orthogonal-pdi.dz/activation/success",
        allowedOrigins
      );
      expect(trusted.isValid).toBe(true);
      expect(trusted.safeUrl).toBe("https://orthogonal-pdi.dz/activation/success");
    });
  });

  // =========================================================================
  // 5. CONFIGURATION SÛRE ET PROTECTION DES SECRETS
  // =========================================================================
  describe("D — Configuration et Secrets", () => {
    it("D1: Détection des secrets serveur accidentellement préfixés par VITE_ (fuite client)", () => {
      const badEnv = {
        NODE_ENV: "development",
        VITE_PADDLE_WEBHOOK_SECRET: "should_not_be_vite_prefixed",
        VITE_SMTP_PASSWORD: "secret_exposed_to_browser"
      };

      const result = verifyProductionConfig(badEnv);
      expect(result.isSafe).toBe(false);
      expect(result.forbiddenViteSecretKeys).toContain("VITE_PADDLE_WEBHOOK_SECRET");
      expect(result.forbiddenViteSecretKeys).toContain("VITE_SMTP_PASSWORD");
      // Aucune valeur de secret ne doit figurer dans le message d'erreur
      expect(result.errorMessage).not.toContain("should_not_be_vite_prefixed");
      expect(result.errorMessage).not.toContain("secret_exposed_to_browser");
    });

    it("D2: En production, échec explicite et sûr si FIREBASE_PROJECT_ID est un projet demo", () => {
      const prodEnvWithDemo = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "demo-project-id"
      };

      const result = verifyProductionConfig(prodEnvWithDemo);
      expect(result.isSafe).toBe(false);
      expect(result.missingCriticalKeys.some((k) => k.includes("FIREBASE_PROJECT_ID"))).toBe(true);
    });

    it("D3: En production avec configuration valide -> isSafe: true", () => {
      const validProdEnv = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "orthogonal-pdi-prod-01",
        PADDLE_WEBHOOK_SECRET_KEY: "paddle_srv_sec"
      };

      const result = verifyProductionConfig(validProdEnv);
      expect(result.isSafe).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it("D4: Provider Email portable par défaut sécurisé (ne jette pas d'erreur, n'envoie rien sans config)", async () => {
      const safeProvider = new SafeUnconfiguredEmailProvider();
      expect(safeProvider.name).toBe("unconfigured_portable");

      const res = await safeProvider.sendEmail({
        to: "client@test.dz",
        subject: "Activation",
        html: "<p>Bienvenue</p>"
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Email provider not configured");
    });
  });

  // =========================================================================
  // 6. AUDIT STATIQUE DES RÈGLES FIRESTORE (DENY BY DEFAULT & SANS AUTORITÉ EMAIL)
  // =========================================================================
  describe("C — Audit Statique des Règles Firestore", () => {
    it("C1: firestore.rules n'a AUCUNE autorisation Super Admin basée sur l'adresse email", () => {
      const rulesPath = path.resolve(process.cwd(), "firestore.rules");
      const rulesContent = fs.readFileSync(rulesPath, "utf-8");

      // Vérifie l'absence de toute condition email == dans isSuperAdmin
      const isSuperAdminDecl = rulesContent.match(/function\s+isSuperAdmin\s*\(\)\s*\{([^}]+)\}/);
      expect(isSuperAdminDecl).not.toBeNull();
      const body = isSuperAdminDecl![1];

      expect(body).not.toMatch(/request\.auth\.token\.email\s*==/);
      expect(body).not.toContain("boudjada.youcef@gmail.com");
      expect(body).not.toContain("superadmin@pdi-vision.dz");
      expect(body).toContain('request.auth.token.role == "super_admin"');
      expect(body).toContain('request.auth.token.email_verified == true');
    });

    it("C2: firestore.rules maintient le DENY BY DEFAULT", () => {
      const rulesPath = path.resolve(process.cwd(), "firestore.rules");
      const rulesContent = fs.readFileSync(rulesPath, "utf-8");

      expect(rulesContent).toContain("match /{document=**} {");
      expect(rulesContent).toContain("allow read, write: if false;");
    });

    it("C3: Les collections critiques ne comportent aucune écriture publique (allow create: if true)", () => {
      const rulesPath = path.resolve(process.cwd(), "firestore.rules");
      const rulesContent = fs.readFileSync(rulesPath, "utf-8");

      // Pas de create public sur connection_logs ou password_requests
      expect(rulesContent).not.toMatch(/match\s+\/connection_logs\/[^{]+\{\s*allow\s+create:\s*if\s+true;/);
      expect(rulesContent).not.toMatch(/match\s+\/password_requests\/[^{]+\{\s*allow\s+create:\s*if\s+true;/);
      expect(rulesContent).not.toMatch(/match\s+\/commercial_visits\/[^{]+\{\s*allow\s+create:\s*if\s+true;/);
    });
  });

  // =========================================================================
  // 7. PROTECTION PATH TRAVERSAL, DOTFILES & SONDES FICHIERS SENSIBLES
  // =========================================================================
  describe("E — Protection Path Traversal & Dotfiles (isSuspiciousRequestPath)", () => {
    it("E1: Chemins légitimes autorisés (false)", () => {
      expect(isSuspiciousRequestPath("/")).toBe(false);
      expect(isSuspiciousRequestPath("/api/health")).toBe(false);
      expect(isSuspiciousRequestPath("/index.html")).toBe(false);
      expect(isSuspiciousRequestPath("/assets/index-abc123.js")).toBe(false);
      expect(isSuspiciousRequestPath("/api/projects?search=cad")).toBe(false);
      expect(isSuspiciousRequestPath("/.well-known/acme-challenge/test")).toBe(false);
      expect(isSuspiciousRequestPath(null)).toBe(false);
      expect(isSuspiciousRequestPath(undefined)).toBe(false);
      expect(isSuspiciousRequestPath("")).toBe(false);
    });

    it("E2: Rejet immédiat des octets nuls et backslashes", () => {
      expect(isSuspiciousRequestPath("/api/projects\0")).toBe(true);
      expect(isSuspiciousRequestPath("/api/projects%00")).toBe(true);
      expect(isSuspiciousRequestPath("/assets\\index.js")).toBe(true);
      expect(isSuspiciousRequestPath("/assets%5cindex.js")).toBe(true);
    });

    it("E3: Rejet des séquences de Path Traversal (.. et /..)", () => {
      expect(isSuspiciousRequestPath("/../etc/passwd")).toBe(true);
      expect(isSuspiciousRequestPath("/api/../../server.ts")).toBe(true);
      expect(isSuspiciousRequestPath("/assets/..")).toBe(true);
      expect(isSuspiciousRequestPath("/%2e%2e/package.json")).toBe(true);
    });

    it("E4: Rejet des dotfiles et dossiers cachés (/.env, /.git, /.htaccess... sauf /.well-known/)", () => {
      expect(isSuspiciousRequestPath("/.env")).toBe(true);
      expect(isSuspiciousRequestPath("/.git/config")).toBe(true);
      expect(isSuspiciousRequestPath("/.env.local")).toBe(true);
      expect(isSuspiciousRequestPath("/.htaccess")).toBe(true);
      expect(isSuspiciousRequestPath("/subdir/.hidden")).toBe(true);
    });

    it("E5: Rejet des sondes sur scripts serveur et fichiers de configuration sensibles", () => {
      expect(isSuspiciousRequestPath("/admin.php")).toBe(true);
      expect(isSuspiciousRequestPath("/shell.sh")).toBe(true);
      expect(isSuspiciousRequestPath("/dump.sql")).toBe(true);
      expect(isSuspiciousRequestPath("/server.key")).toBe(true);
      expect(isSuspiciousRequestPath("/backup.bak")).toBe(true);
      expect(isSuspiciousRequestPath("/server.ts")).toBe(true);
      expect(isSuspiciousRequestPath("/package.json")).toBe(true);
      expect(isSuspiciousRequestPath("/firestore.rules")).toBe(true);
      expect(isSuspiciousRequestPath("/tsconfig.json")).toBe(true);
    });

    it("E6: Décodage malformé rejeté en toute sécurité", () => {
      expect(isSuspiciousRequestPath("/%E0%A4%A")).toBe(true);
    });
  });
});

