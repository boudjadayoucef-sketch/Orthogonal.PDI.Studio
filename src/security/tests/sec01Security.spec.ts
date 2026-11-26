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
import express from "express";
import type { Server } from "node:http";
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
  isSuspiciousRequestPath,
  validateOriginEntry,
  validateAppUrl,
  validateAllowedOrigins,
  resolveCspFrameAncestors,
  VERIFIED_AISTUDIO_FRAME_ANCESTOR,
  createPaddleWebhookBodyParser,
  createStandardJsonParser,
  createStandardUrlencodedParser,
  createGlobalExpressErrorHandler
} from "../sec01SecurityService.ts";
import { createPaddleWebhookHandler } from "../webhooks/paddleWebhookHandler.ts";
import { createSlickPayWebhookHandler } from "../webhooks/slickPayWebhookHandler.ts";

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

    it("E7: /node_modules/.vite/deps/* rejeté par défaut (prod/staging) mais autorisé uniquement en mode dev Vite sans affaiblir les dotfiles ni le path traversal", () => {
      expect(isSuspiciousRequestPath("/node_modules/.vite/deps/react.js?v=b76aac1c")).toBe(true);
      expect(
        isSuspiciousRequestPath("/node_modules/.vite/deps/react.js?v=b76aac1c", {
          allowViteDevDeps: true,
        })
      ).toBe(false);
      // Même en dev Vite, tout dotfile imbriqué ou path traversal reste strictement bloqué
      expect(
        isSuspiciousRequestPath("/node_modules/.vite/.env", { allowViteDevDeps: true })
      ).toBe(true);
      expect(
        isSuspiciousRequestPath("/node_modules/.vite/../../.env", { allowViteDevDeps: true })
      ).toBe(true);
      expect(
        isSuspiciousRequestPath("/.env", { allowViteDevDeps: true })
      ).toBe(true);
    });
  });

  // =========================================================================
  // 8. SEC-01-FIX-07-R1 — SERVER HARDENING (D1: CSP & ORIGINES, D2: BODY LIMITS & RAWBODY, D3: ERROR MASKING, D4: SECURITY SCAN)
  // =========================================================================
  describe("G — SEC-01-FIX-07-R1 : D1 — CSP frame-ancestors & Validation Stricte des Origines", () => {
    it("G1 (CSP Prod): Production refuse '*' dans CSP_FRAME_ANCESTORS et échoue explicitement dans verifyProductionConfig", () => {
      const env = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "orthogonal-pdi-prod-01",
        CSP_FRAME_ANCESTORS: "*"
      };

      const cspRes = resolveCspFrameAncestors(env);
      expect(cspRes.isValid).toBe(false);
      expect(cspRes.error).toContain("Wildcard '*' is strictly forbidden");
      // Fail-closed: ne contient jamais '*' dans la directive émise
      expect(cspRes.value).not.toContain("*");
      expect(cspRes.ancestors).toEqual(["'self'", VERIFIED_AISTUDIO_FRAME_ANCESTOR]);

      const configRes = verifyProductionConfig(env);
      expect(configRes.isSafe).toBe(false);
      expect(configRes.errorMessage).toContain("CSP_FRAME_ANCESTORS");
    });

    it("G2 (CSP Prod): Production refuse toute injection de directive contenant ';'", () => {
      const env = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "orthogonal-pdi-prod-01",
        CSP_FRAME_ANCESTORS: "'self'; script-src 'unsafe-inline' https://evil.example.com"
      };

      const cspRes = resolveCspFrameAncestors(env);
      expect(cspRes.isValid).toBe(false);
      expect(cspRes.error).toContain("';'");
      expect(cspRes.directive).toBe(`frame-ancestors 'self' ${VERIFIED_AISTUDIO_FRAME_ANCESTOR}`);
      expect(cspRes.directive).not.toContain("evil.example.com");

      const configRes = verifyProductionConfig(env);
      expect(configRes.isSafe).toBe(false);
    });

    it("G3 (CSP Prod): Production refuse les origines malformées, non-HTTPS, avec chemins ou wildcards partiels (*.google.com, *.run.app)", () => {
      const invalidCases = [
        "http://insecure-origin.example.com",
        "https://*.google.com",
        "https://*.googleusercontent.com",
        "https://*.run.app",
        "https://valid.example.com/with/path",
        "https://valid.example.com?query=1",
        "https://valid.example.com#hash",
        "not-a-valid-url",
        "javascript:alert(1)"
      ];

      for (const badAncestor of invalidCases) {
        const res = resolveCspFrameAncestors({
          NODE_ENV: "production",
          CSP_FRAME_ANCESTORS: badAncestor
        });
        expect(res.isValid).toBe(false);
        expect(res.value).toBe(`'self' ${VERIFIED_AISTUDIO_FRAME_ANCESTOR}`);
      }
    });

    it("G4 (CSP Prod): Production accepte les origines HTTPS explicitement autorisées et APP_URL valide", () => {
      const env = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "orthogonal-pdi-prod-01",
        APP_URL: "https://studio.orthogonal-pdi.dz",
        CSP_FRAME_ANCESTORS: "'self' https://portal.orthogonal-pdi.dz https://aistudio.google.com"
      };

      const cspRes = resolveCspFrameAncestors(env);
      expect(cspRes.isValid).toBe(true);
      expect(cspRes.ancestors).toContain("'self'");
      expect(cspRes.ancestors).toContain("https://aistudio.google.com");
      expect(cspRes.ancestors).toContain("https://studio.orthogonal-pdi.dz");
      expect(cspRes.ancestors).toContain("https://portal.orthogonal-pdi.dz");
      expect(cspRes.value).not.toContain("*");

      const configRes = verifyProductionConfig(env);
      expect(configRes.isSafe).toBe(true);
    });

    it("G5 (CSP Dev): Développement conserve le comportement prévu (localhost autorisé, tout en bloquant les injections ';')", () => {
      const defaultDev = resolveCspFrameAncestors({ NODE_ENV: "development" });
      expect(defaultDev.isValid).toBe(true);
      expect(defaultDev.ancestors).toContain("'self'");
      expect(defaultDev.ancestors).toContain("https://aistudio.google.com");
      expect(defaultDev.ancestors).toContain("http://localhost:3000");
      expect(defaultDev.ancestors).toContain("http://127.0.0.1:3000");

      const wildcardDev = resolveCspFrameAncestors({
        NODE_ENV: "development",
        CSP_FRAME_ANCESTORS: "*"
      });
      expect(wildcardDev.isValid).toBe(true);
      expect(wildcardDev.ancestors).toContain("*");

      const injectedDev = resolveCspFrameAncestors({
        NODE_ENV: "development",
        CSP_FRAME_ANCESTORS: "*; object-src *"
      });
      expect(injectedDev.isValid).toBe(false);
    });

    it("G6 (APP_URL): APP_URL invalide (HTTP, chemin, wildcard, malformée) est rejeté", () => {
      expect(validateAppUrl("https://app.orthogonal-pdi.dz").isValid).toBe(true);
      expect(validateAppUrl("http://app.orthogonal-pdi.dz").isValid).toBe(false);
      expect(validateAppUrl("https://app.orthogonal-pdi.dz/subpath").isValid).toBe(false);
      expect(validateAppUrl("https://app.orthogonal-pdi.dz/").isValid).toBe(false);
      expect(validateAppUrl("https://*.run.app").isValid).toBe(false);
      expect(validateAppUrl("malformed_url").isValid).toBe(false);

      const badProdAppUrl = verifyProductionConfig({
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "orthogonal-pdi-prod-01",
        APP_URL: "http://insecure.orthogonal-pdi.dz"
      });
      expect(badProdAppUrl.isSafe).toBe(false);
      expect(badProdAppUrl.errorMessage).toContain("APP_URL");
    });

    it("G7 (ALLOWED_ORIGINS): ALLOWED_ORIGINS invalide ('*', HTTP en prod, chemins, fragments, malformé) est rejeté et les origines valides sont normalisées", () => {
      const badWildcard = validateAllowedOrigins("*", { isProduction: true });
      expect(badWildcard.isValid).toBe(false);
      expect(badWildcard.invalidEntries).toContain("*");

      const badHttpInProd = validateAllowedOrigins("http://localhost:3000", { isProduction: true });
      expect(badHttpInProd.isValid).toBe(false);

      const badPathOrigin = validateAllowedOrigins("https://orthogonal-pdi.dz/login", { isProduction: true });
      expect(badPathOrigin.isValid).toBe(false);

      const badQueryOrigin = validateAllowedOrigins("https://orthogonal-pdi.dz?redirect=1", { isProduction: true });
      expect(badQueryOrigin.isValid).toBe(false);

      const badFragmentOrigin = validateAllowedOrigins("https://orthogonal-pdi.dz#top", { isProduction: true });
      expect(badFragmentOrigin.isValid).toBe(false);

      const validProdOrigins = validateAllowedOrigins(
        "HTTPS://ORTHOGONAL-PDI.DZ, https://console.orthogonal-pdi.dz",
        { isProduction: true, appUrl: "https://app.orthogonal-pdi.dz" }
      );
      expect(validProdOrigins.isValid).toBe(true);
      expect(validProdOrigins.origins).toContain("https://orthogonal-pdi.dz");
      expect(validProdOrigins.origins).toContain("https://console.orthogonal-pdi.dz");
      expect(validProdOrigins.origins).toContain("https://app.orthogonal-pdi.dz");
      expect(validProdOrigins.origins).toContain("https://aistudio.google.com");

      const prodConfigWithInvalidOrigins = verifyProductionConfig({
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "orthogonal-pdi-prod-01",
        ALLOWED_ORIGINS: "https://orthogonal-pdi.dz, *"
      });
      expect(prodConfigWithInvalidOrigins.isSafe).toBe(false);
      expect(prodConfigWithInvalidOrigins.errorMessage).toContain("ALLOWED_ORIGINS");
    });
  });

  describe("H — SEC-01-FIX-07-R1 : D2 & D3 — HTTP Body Limits (256kb), Isolation rawBody Paddle & Masquage des Erreurs", () => {
    const testWebhookSecret = ["pdl_ntfset", "unit_test_secret_key_0123456789"].join("_");

    async function withTestServer(
      configureApp: (app: express.Express) => void,
      runTest: (baseUrl: string) => Promise<void>
    ) {
      const app = express();
      app.use(createStandardJsonParser());
      app.use(createStandardUrlencodedParser());
      configureApp(app);
      app.use(createGlobalExpressErrorHandler());

      const server: Server = await new Promise((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
      });
      const address = server.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${address.port}`;

      try {
        await runTest(baseUrl);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }

    it("H1 (HTTP Body Limits): JSON supérieur à 256kb -> HTTP 413 générique sans détail interne", async () => {
      await withTestServer(
        (app) => {
          app.post("/api/test-json", (req, res) => {
            res.status(200).json({ ok: true, size: JSON.stringify(req.body).length });
          });
        },
        async (baseUrl) => {
          const oversizedPayload = JSON.stringify({ data: "A".repeat(300 * 1024) });
          const res = await fetch(`${baseUrl}/api/test-json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: oversizedPayload
          });
          expect(res.status).toBe(413);
          const body = await res.json();
          expect(body).toEqual({
            error: "Payload too large",
            code: "PAYLOAD_TOO_LARGE"
          });
        }
      );
    });

    it("H2 (HTTP Body Limits): URL-encoded supérieur à 256kb -> HTTP 413 générique", async () => {
      await withTestServer(
        (app) => {
          app.post("/api/test-form", (_req, res) => {
            res.status(200).json({ ok: true });
          });
        },
        async (baseUrl) => {
          const oversizedForm = `field=${"B".repeat(300 * 1024)}`;
          const res = await fetch(`${baseUrl}/api/test-form`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: oversizedForm
          });
          expect(res.status).toBe(413);
          const body = await res.json();
          expect(body).toEqual({
            error: "Payload too large",
            code: "PAYLOAD_TOO_LARGE"
          });
        }
      );
    });

    it("H3 (HTTP Body Limits & Parsing): JSON malformé -> HTTP 400 générique sans stack ni détail du parser", async () => {
      await withTestServer(
        (app) => {
          app.post("/api/test-json", (_req, res) => {
            res.status(200).json({ ok: true });
          });
        },
        async (baseUrl) => {
          const res = await fetch(`${baseUrl}/api/test-json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: '{"unterminated_json": "SECRET_PARSER_DETAIL'
          });
          expect(res.status).toBe(400);
          const text = await res.text();
          expect(text).not.toContain("SyntaxError");
          expect(text).not.toContain("SECRET_PARSER_DETAIL");
          expect(JSON.parse(text)).toEqual({
            error: "Malformed request payload",
            code: "MALFORMED_PAYLOAD"
          });
        }
      );
    });

    it("H4 (Global Error Handler): Erreur interne synchrone contenant SECRET_DB_URI_LEAK -> HTTP 500 générique masqué", async () => {
      await withTestServer(
        (app) => {
          app.get("/api/test-crash", () => {
            throw new Error("Database connection failed: postgres://admin:SECRET_DB_URI_LEAK@10.0.0.5:5432/pdi");
          });
        },
        async (baseUrl) => {
          const res = await fetch(`${baseUrl}/api/test-crash`);
          expect(res.status).toBe(500);
          const text = await res.text();
          expect(text).not.toContain("SECRET_DB_URI_LEAK");
          expect(text).not.toContain("postgres://");
          expect(JSON.parse(text)).toEqual({
            error: "Internal server error",
            code: "INTERNAL_SERVER_ERROR"
          });
        }
      );
    });

    it("H5 (Paddle rawBody & Limits): Corps brut conservé exactement sur /api/webhooks/paddle, absent sur les autres routes, HMAC valide accepté, HMAC invalide rejeté, payload > 256kb rejeté avant traitement", async () => {
      let standardRouteRawBody: unknown = "NOT_CHECKED";
      const processedEvents: unknown[] = [];

      const mockProcessor = {
        processVerifiedPaddleEvent: vi.fn(async (payload: unknown) => {
          processedEvents.push(payload);
          return {
            statusCode: 200,
            body: {
              received: true,
              status: "associated",
              code: "ORDER_ASSOCIATED"
            }
          };
        })
      };

      await withTestServer(
        (app) => {
          app.post("/api/standard-route", (req: any, res) => {
            standardRouteRawBody = req.rawBody;
            res.status(200).json({ ok: true, hasRawBody: Boolean(req.rawBody) });
          });

          app.post(
            "/api/webhooks/paddle",
            createPaddleWebhookBodyParser(),
            createPaddleWebhookHandler({
              processor: mockProcessor as any,
              getPaddleSecret: () => testWebhookSecret
            })
          );
        },
        async (baseUrl) => {
          // 1. Route standard : req.rawBody NE DOIT PAS être capturé
          const stdRes = await fetch(`${baseUrl}/api/standard-route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hello: "world" })
          });
          expect(stdRes.status).toBe(200);
          expect(standardRouteRawBody).toBeUndefined();

          // 2. Webhook Paddle avec formatage JSON spécifique (espaces et retours ligne) :
          //    prouve que les octets bruts exacts sont préservés pour la vérification HMAC
          const rawBodyWithWhitespace =
            '{\n  "event_id":  "evt_raw_001" ,\n  "event_type": "transaction.completed",\n  "data": { "id": "txn_01" }\n}';
          const ts = Math.floor(Date.now() / 1000).toString();
          const validH1 = crypto
            .createHmac("sha256", testWebhookSecret)
            .update(`${ts}:${rawBodyWithWhitespace}`, "utf8")
            .digest("hex");

          const validRes = await fetch(`${baseUrl}/api/webhooks/paddle`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Paddle-Signature": `ts=${ts};h1=${validH1}`
            },
            body: rawBodyWithWhitespace
          });
          expect(validRes.status).toBe(200);
          expect(mockProcessor.processVerifiedPaddleEvent).toHaveBeenCalledTimes(1);

          // 3. Webhook Paddle avec HMAC invalide -> rejeté 401 sans appeler le processeur
          const invalidH1 = validH1.startsWith("a") ? `b${validH1.slice(1)}` : `a${validH1.slice(1)}`;
          const invalidRes = await fetch(`${baseUrl}/api/webhooks/paddle`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Paddle-Signature": `ts=${ts};h1=${invalidH1}`
            },
            body: rawBodyWithWhitespace
          });
          expect(invalidRes.status).toBe(401);
          expect(mockProcessor.processVerifiedPaddleEvent).toHaveBeenCalledTimes(1);

          // 4. Webhook Paddle surdimensionné (> 256kb) -> rejeté HTTP 413 avant le handler Paddle
          const hugeBody = JSON.stringify({
            event_id: "evt_huge_001",
            padding: "X".repeat(280 * 1024)
          });
          const hugeH1 = crypto
            .createHmac("sha256", testWebhookSecret)
            .update(`${ts}:${hugeBody}`, "utf8")
            .digest("hex");

          const hugeRes = await fetch(`${baseUrl}/api/webhooks/paddle`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Paddle-Signature": `ts=${ts};h1=${hugeH1}`
            },
            body: hugeBody
          });
          expect(hugeRes.status).toBe(413);
          expect(mockProcessor.processVerifiedPaddleEvent).toHaveBeenCalledTimes(1);
        }
      );
    });

    it("H6 (Error Masking Webhooks): Simulation d'une exception contenant SECRET_DB_URI_LEAK dans Paddle et Slick-Pay -> HTTP 500 générique sans fuite de SECRET_DB_URI_LEAK", async () => {
      const rawBody = JSON.stringify({
        event_id: "evt_crash_500",
        event_type: "transaction.completed"
      });
      const ts = Math.floor(Date.now() / 1000).toString();
      const validH1 = crypto
        .createHmac("sha256", testWebhookSecret)
        .update(`${ts}:${rawBody}`, "utf8")
        .digest("hex");

      const crashingPaddleProcessor = {
        processVerifiedPaddleEvent: vi.fn(async () => {
          throw new Error("Firestore fatal failure: SECRET_DB_URI_LEAK at /app/applet/server.ts");
        })
      };

      const paddleHandler = createPaddleWebhookHandler({
        processor: crashingPaddleProcessor as any,
        getPaddleSecret: () => testWebhookSecret
      });

      let paddleStatus = 200;
      let paddleJson: any = null;
      await paddleHandler(
        {
          rawBody,
          body: JSON.parse(rawBody),
          headers: { "paddle-signature": `ts=${ts};h1=${validH1}` }
        } as any,
        {
          status: (code: number) => {
            paddleStatus = code;
            return {
              json: (payload: any) => {
                paddleJson = payload;
              }
            };
          }
        } as any
      );

      expect(paddleStatus).toBe(500);
      expect(JSON.stringify(paddleJson)).not.toContain("SECRET_DB_URI_LEAK");
      expect(paddleJson).toEqual({
        error: "Internal webhook processing error",
        code: "WEBHOOK_INTERNAL_ERROR"
      });

      // Slick-Pay handler throwing an unexpected exception with SECRET_DB_URI_LEAK
      const slickPayHandler = createSlickPayWebhookHandler({
        getSlickPaySecret: () => {
          throw new Error("SlickPay config read crash: SECRET_DB_URI_LEAK");
        }
      });

      let slickStatus = 200;
      let slickJson: any = null;
      await slickPayHandler(
        { body: {}, headers: {} } as any,
        {
          status: (code: number) => {
            slickStatus = code;
            return {
              json: (payload: any) => {
                slickJson = payload;
              }
            };
          }
        } as any
      );

      expect(slickStatus).toBe(500);
      expect(JSON.stringify(slickJson)).not.toContain("SECRET_DB_URI_LEAK");
      expect(slickJson).toEqual({
        error: "Internal webhook processing error",
        code: "WEBHOOK_INTERNAL_ERROR"
      });
    });

    it("H7 (Server Error & 404 Masking): Vérification de server.ts — absence de fuite err.message / String(err) / req.path dans les réponses HTTP publiques", () => {
      const serverPath = path.resolve(process.cwd(), "server.ts");
      const serverContent = fs.readFileSync(serverPath, "utf-8");

      // Plus aucune limite 50mb dans server.ts
      expect(serverContent).not.toContain('limit: "50mb"');
      expect(serverContent).not.toContain("limit: '50mb'");

      // Masquage des erreurs sur /api/admin/set-user-role, /api/health/assets, /api/style/main.css et 404
      expect(serverContent).toContain('code: "ADMIN_ROLE_UPDATE_FAILED"');
      expect(serverContent).toContain('error: "Internal asset health check error"');
      expect(serverContent).toContain('.send("Internal Server Error")');
      expect(serverContent).toContain('.send("Asset not found")');
      expect(serverContent).not.toContain('send("Erreur lecture CSS: "');
      expect(serverContent).not.toContain('send("Asset introuvable: "');
    });
  });

  describe("I — SEC-01-FIX-07-R1 & R2 : D4 — Audit Statique et Compatibilité Grep du Workflow GitHub Security Scan", () => {
    it("I1: .github/workflows/security.yml définit permissions: contents: read, utilise grep -E -- et git grep -e, ne masque ni src/lib/firebase.ts ni les fichiers de tests, et conserve tous les patterns de secrets", () => {
      const workflowPath = path.resolve(process.cwd(), ".github/workflows/security.yml");
      const workflowContent = fs.readFileSync(workflowPath, "utf-8");

      // D4.1 : Permissions minimales explicites
      expect(workflowContent).toMatch(/permissions:\s*\n\s*contents:\s*read/);

      // D4.3 & R2 Correction C : ni src/lib/firebase.ts ni *Security.spec.ts ne sont exclus
      expect(workflowContent).not.toContain(":!src/lib/firebase.ts");
      expect(workflowContent).not.toContain(":!*Security.spec.ts");
      expect(workflowContent).not.toContain("AIzaSy[0-9A-Za-z_-]{33}");

      // R2 Correction B : compatibilité grep avec les motifs commençant par '-----BEGIN'
      expect(workflowContent).toContain('git grep -E -I -n -e "$PATTERN" --');
      expect(workflowContent).toContain('grep -E -- "$PATTERN"');

      // D4.4 & R2 Correction D : Motifs de secrets privés (PEM, Stripe, GitHub classic & fine-grained PAT, Slack, AWS, Paddle)
      expect(workflowContent).toContain("-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----");
      expect(workflowContent).toContain("sk_live_[0-9a-zA-Z]{24,}");
      expect(workflowContent).toContain("ghp_[0-9a-zA-Z]{36}");
      expect(workflowContent).toContain("github_pat_[0-9a-zA-Z_]{22,}");
      expect(workflowContent).toContain("xox[baprs]-[0-9a-zA-Z]{10,48}");
      expect(workflowContent).toContain("AKIA[0-9A-Z]{16}");
      expect(workflowContent).toContain("pdl_ntfset_[0-9a-zA-Z_]{16,}");
      expect(workflowContent).toContain("pdl_live_apikey_[0-9a-zA-Z_]{16,}");
      expect(workflowContent).toContain("pdl_sdbx_apikey_[0-9a-zA-Z_]{16,}");
    });

    it("I2 (R2 Correction A): Les cinq fixtures Paddle de test produisent exactement la même valeur à l'exécution sans correspondre littéralement au pattern de fuite dans les fichiers sources", () => {
      expect(["pdl_ntfset", "fix05b_secret_key_2026"].join("_")).toBe(
        `pdl_ntfset_${"fix05b_secret_key_2026"}`
      );
      expect(["pdl_ntfset", "fix05b_r1_secret_2026"].join("_")).toBe(
        `pdl_ntfset_${"fix05b_r1_secret_2026"}`
      );
      expect(["pdl_ntfset", "01hxyz_strict_webhook_secret_key"].join("_")).toBe(
        `pdl_ntfset_${"01hxyz_strict_webhook_secret_key"}`
      );
      expect(["pdl_ntfset", "fix06_secret_2026"].join("_")).toBe(
        `pdl_ntfset_${"fix06_secret_2026"}`
      );
      expect(["pdl_ntfset", "unit_test_secret_key_0123456789"].join("_")).toBe(
        `pdl_ntfset_${"unit_test_secret_key_0123456789"}`
      );

      const testFiles = [
        "src/security/tests/paymentOrderAssociation.spec.ts",
        "src/security/tests/pendingOrderFlowB1B2B3.spec.ts",
        "src/security/tests/webhookAuth.spec.ts",
        "src/security/tests/webhookIdempotencyRepository.spec.ts",
        "src/security/tests/sec01Security.spec.ts"
      ];
      const paddleSecretRegex = /pdl_ntfset_[0-9a-zA-Z_]{16,}/;

      for (const relPath of testFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
        expect(paddleSecretRegex.test(content)).toBe(false);
      }
    });
  });
});

