/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Tests d'intégration et de sécurité de l'adaptateur Express -> Vercel Serverless.
 *
 * IMPORTANT :
 * Les tests utilisant une passerelle Supabase injectée (`supabaseAuthGateway`)
 * valident le routage, l'autorisation serveur et les garde-fous de l'adaptateur
 * en environnement isolé. Ils ne constituent PAS une preuve de connexion réseau
 * vers une instance Supabase distante réelle.
 */

import http from "http";
import type { AddressInfo } from "net";
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import vercelDefaultHandler from "../../../api/index.ts";
import {
  createVercelApiHandler,
  inspectVercelSupabaseServerEnv,
  normalizeVercelApiRequestUrl,
  resolveVercelRuntimeEnv,
  type VercelApiRequestHandler,
} from "../../server/vercelHandler.ts";
import { startServer, type StartedPdiServer } from "../../../server.ts";
import type { SupabaseServerAuthGateway } from "../../server/supabaseAuth.ts";

interface EphemeralHarness {
  baseUrl: string;
  close: () => Promise<void>;
}

const activeClosers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (activeClosers.length > 0) {
    const closeFn = activeClosers.pop();
    if (closeFn) {
      await closeFn();
    }
  }
});

/**
 * Monte uniquement le handler Serverless `(req, res) => void` sur un serveur HTTP
 * éphémère de test (sans JAMAIS appeler `app.listen()` ni `startServer()` dans le handler).
 */
async function mountServerlessHandlerForTest(
  handler: VercelApiRequestHandler
): Promise<EphemeralHarness> {
  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const addr = server.address() as AddressInfo;
  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  activeClosers.push(close);
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close,
  };
}

function buildTestSecretKey(suffix = "vercel_api_01_fixture_99887766"): string {
  return ["sb", "secret", suffix].join("_");
}

const TEST_SUPABASE_URL = "https://example-project.supabase.co";
const SUPER_ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

function base64UrlEncode(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createTestJwtFixture(payload: Record<string, unknown>, sig = "test_signature_01"): string {
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.${sig}`;
}

const VALID_SUPERADMIN_JWT = createTestJwtFixture(
  {
    sub: SUPER_ADMIN_ID,
    aud: "authenticated",
    role: "authenticated",
    iss: `${TEST_SUPABASE_URL}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "sig_superadmin_valid"
);

const VALID_CLIENT_FORGED_META_JWT = createTestJwtFixture(
  {
    sub: CLIENT_ID,
    aud: "authenticated",
    role: "authenticated",
    iss: `${TEST_SUPABASE_URL}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "sig_client_valid"
);

const INVALID_SIGNATURE_JWT = createTestJwtFixture(
  {
    sub: CLIENT_ID,
    aud: "authenticated",
    role: "authenticated",
    iss: `${TEST_SUPABASE_URL}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "sig_forged_invalid"
);

function stripTsComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function createDeterministicSupabaseGateway(): SupabaseServerAuthGateway {
  const superAdminId = SUPER_ADMIN_ID;
  const clientId = CLIENT_ID;

  return {
    async verifyAccessTokenAndGetUser(accessToken: string) {
      if (accessToken === VALID_SUPERADMIN_JWT) {
        return {
          id: superAdminId,
          email: "orthogonaleng@gmail.com",
          email_confirmed_at: "2026-04-20T10:00:00.000Z",
          user_metadata: { role: "client" },
          app_metadata: { provider: "email" },
        };
      }
      if (accessToken === VALID_CLIENT_FORGED_META_JWT) {
        return {
          id: clientId,
          email: "engineer.client@example.com",
          email_confirmed_at: "2026-04-20T10:00:00.000Z",
          // Métadonnée falsifiée côté client — DOIT être ignorée au profit de public.profiles
          user_metadata: { role: "super_admin", status: "active" },
          app_metadata: { provider: "email" },
        };
      }
      return null;
    },

    async findProfileByUserId(userId: string) {
      if (userId === superAdminId) {
        return {
          id: superAdminId,
          email: "orthogonaleng@gmail.com",
          name: "Super Admin Orthogonal",
          display_name: "Super Admin Orthogonal",
          role: "super_admin",
          status: "active",
          account_type: "enterprise",
          subscription_plan: "yearly",
          company: "ORTHOGONAL ENG",
          country: "DZ",
          country_code: "DZ",
          city: "Alger",
          created_at: "2026-04-20T09:00:00.000Z",
          updated_at: "2026-04-20T10:00:00.000Z",
        };
      }
      if (userId === clientId) {
        return {
          id: clientId,
          email: "engineer.client@example.com",
          name: "Client Engineer",
          display_name: "Client Engineer",
          role: "client",
          status: "active",
          account_type: "pro",
          subscription_plan: "monthly",
          company: "Piping Corp",
          country: "DZ",
          country_code: "DZ",
          city: "Oran",
          created_at: "2026-04-20T09:00:00.000Z",
          updated_at: "2026-04-20T10:00:00.000Z",
        };
      }
      return null;
    },

    async getSuperAdminOverview(verifiedSession) {
      return {
        generatedAt: "2026-04-20T10:00:00.000Z",
        verifiedSuperAdmin: {
          userId: verifiedSession.userId,
          email: verifiedSession.email,
          emailConfirmedAt: verifiedSession.emailConfirmedAt || "2026-04-20T10:00:00.000Z",
        },
        counts: {
          profiles: 2,
          activeProfiles: 2,
          superAdmins: 1,
          projects: 0,
          licenseKeys: 0,
          auditLogs: 1,
        },
        profiles: [
          {
            id: superAdminId,
            email: "orthogonaleng@gmail.com",
            name: "Super Admin Orthogonal",
            role: "super_admin",
            status: "active",
            accountType: "enterprise",
            subscriptionPlan: "yearly",
            company: "ORTHOGONAL ENG",
            createdAt: "2026-04-20T09:00:00.000Z",
          },
        ],
        recentAuditLogs: [
          {
            id: "audit-1",
            eventType: "admin.overview.read",
            resourceType: "profiles",
            resourceId: superAdminId,
            severity: "info",
            actorUserId: superAdminId,
            targetUserId: superAdminId,
            createdAt: "2026-04-20T10:00:00.000Z",
          },
        ],
        legacyFirestoreModulesPendingMigration: ["projects", "licenses"],
      };
    },
  };
}

describe("VERCEL-API-01 — Raccordement du serveur Express à Vercel Serverless", () => {
  it("1. /api/health est accessible via le handler Serverless Vercel avec en-têtes de sécurité et CORS Vercel validé", async () => {
    const handler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_URL: "orthogonal-pdi-studio-preview.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "orthogonal-pdi-studio.vercel.app",
      },
    });

    const { baseUrl } = await mountServerlessHandlerForTest(handler);
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: "https://orthogonal-pdi-studio.vercel.app",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://orthogonal-pdi-studio.vercel.app"
    );

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("pdi-industrial-cad");
    expect(body.vendor).toBe("ORTHOGONAL - ENG");

    // Une origine externe non autorisée ne reçoit jamais Access-Control-Allow-Origin
    const untrustedRes = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: "https://evil.attacker.invalid",
      },
    });
    expect(untrustedRes.status).toBe(200);
    expect(untrustedRes.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("2. /api/auth/supabase/session rejette l'absence de JWT (401) et autorise un JWT vérifié côté serveur (test isolé avec passerelle injectée)", async () => {
    const handler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
        SUPABASE_URL: "https://example-project.supabase.co",
        SUPABASE_SECRET_KEY: buildTestSecretKey(),
      },
      dependencies: {
        supabaseAuthGateway: createDeterministicSupabaseGateway(),
      },
    });

    const { baseUrl } = await mountServerlessHandlerForTest(handler);

    // 2A. Sans JWT -> 401
    const unauthRes = await fetch(`${baseUrl}/api/auth/supabase/session`);
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.headers.get("content-type")).toContain("application/json");
    const unauthBody = await unauthRes.json();
    expect(unauthBody.code).toBe("auth/missing-token");

    // 2B. Avec token malformé -> 401 auth/malformed-token
    const malformedRes = await fetch(`${baseUrl}/api/auth/supabase/session`, {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(malformedRes.status).toBe(401);
    expect((await malformedRes.json()).code).toBe("auth/malformed-token");

    // 2C. Avec JWT structurellement valide mais signature rejetée -> 401 auth/invalid-token
    const invalidRes = await fetch(`${baseUrl}/api/auth/supabase/session`, {
      headers: { Authorization: `Bearer ${INVALID_SIGNATURE_JWT}` },
    });
    expect(invalidRes.status).toBe(401);
    const invalidBody = await invalidRes.json();
    expect(invalidBody.code).toBe("auth/invalid-token");

    // 2D. Avec JWT vérifié -> 200 avec profil issu de public.profiles (jamais user_metadata)
    const okRes = await fetch(`${baseUrl}/api/auth/supabase/session`, {
      headers: { Authorization: `Bearer ${VALID_CLIENT_FORGED_META_JWT}` },
    });
    expect(okRes.status).toBe(200);
    const okBody = await okRes.json();
    expect(okBody.ok).toBe(true);
    expect(okBody.session.provider).toBe("supabase");
    expect(okBody.session.role).toBe("client");
    expect(okBody.session.status).toBe("active");
    expect(okBody.session.isSuperAdmin).toBe(false);
    expect(okBody.session.profile.role).toBe("client");
  });

  it("3. /api/admin/supabase/overview rejette un utilisateur non authentifié (401) ou non Super Admin (403) et autorise un Super Admin actif", async () => {
    const handler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
        SUPABASE_URL: "https://example-project.supabase.co",
        SUPABASE_SECRET_KEY: buildTestSecretKey(),
      },
      dependencies: {
        supabaseAuthGateway: createDeterministicSupabaseGateway(),
      },
    });

    const { baseUrl } = await mountServerlessHandlerForTest(handler);

    // 3A. Sans JWT -> 401
    const missingRes = await fetch(`${baseUrl}/api/admin/supabase/overview`);
    expect(missingRes.status).toBe(401);
    const missingBody = await missingRes.json();
    expect(missingBody.code).toBe("auth/missing-token");

    // 3B. Utilisateur client authentifié (même avec user_metadata.role = "super_admin") -> 403
    const clientRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
      headers: { Authorization: `Bearer ${VALID_CLIENT_FORGED_META_JWT}` },
    });
    expect(clientRes.status).toBe(403);
    const clientBody = await clientRes.json();
    expect(clientBody.code).toBe("auth/forbidden-super-admin");

    // 3C. Super Admin confirmé dans public.profiles (role=super_admin, status=active) -> 200
    const adminRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
      headers: { Authorization: `Bearer ${VALID_SUPERADMIN_JWT}` },
    });
    expect(adminRes.status).toBe(200);
    const adminBody = await adminRes.json();
    expect(adminBody.ok).toBe(true);
    expect(adminBody.overview.verifiedSuperAdmin.email).toBe("orthogonaleng@gmail.com");
    expect(adminBody.overview.counts.superAdmins).toBe(1);
  });

  it("4. Une route /api/* inconnue ne retourne JAMAIS du HTML frontend (retourne toujours JSON 404 strict)", async () => {
    const handler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
      },
    });

    const { baseUrl } = await mountServerlessHandlerForTest(handler);

    for (const testCase of [
      { method: "GET", url: "/api/does-not-exist" },
      { method: "POST", url: "/api/unknown/nested/endpoint" },
      { method: "GET", url: "/api" },
      { method: "GET", url: "/api/" },
    ]) {
      const res = await fetch(`${baseUrl}${testCase.url}`, {
        method: testCase.method,
      });
      const contentType = res.headers.get("content-type") || "";
      const rawText = await res.text();

      expect(res.status, `${testCase.method} ${testCase.url}`).toBe(404);
      expect(contentType, `${testCase.method} ${testCase.url}`).toContain("application/json");
      expect(rawText.toLowerCase()).not.toContain("<!doctype html");
      expect(rawText.toLowerCase()).not.toContain("<html");

      const parsed = JSON.parse(rawText);
      expect(parsed).toEqual({
        error: "Not Found: Unknown API endpoint",
        code: "api/not-found",
      });
    }
  });

  it("5. Une erreur de configuration Supabase (SUPABASE_URL / SUPABASE_SECRET_KEY absentes ou invalides) produit un refus fail-closed 503 sans fuite de secret", async () => {
    const leakedSecretAttempt = buildTestSecretKey("must_never_appear_in_http_body_12345");

    // 5A. Variables absentes
    const unconfiguredStatus = inspectVercelSupabaseServerEnv({});
    expect(unconfiguredStatus.configured).toBe(false);
    expect(unconfiguredStatus.hasUrl).toBe(false);
    expect(unconfiguredStatus.hasSecretKey).toBe(false);
    expect(unconfiguredStatus.errorCode).toBe("MISSING_SUPABASE_URL");

    // 5B. URL invalide avec clé présente : aucune fuite de la clé
    const badUrlStatus = inspectVercelSupabaseServerEnv({
      SUPABASE_URL: "http://insecure.local",
      SUPABASE_SECRET_KEY: leakedSecretAttempt,
    });
    expect(badUrlStatus.configured).toBe(false);
    expect(badUrlStatus.errorCode).toBe("INVALID_SUPABASE_URL");
    expect(JSON.stringify(badUrlStatus)).not.toContain(leakedSecretAttempt);

    // 5C. Configuration serveur valide détectée sans jamais exposer la clé
    const validStatus = inspectVercelSupabaseServerEnv({
      SUPABASE_URL: TEST_SUPABASE_URL,
      SUPABASE_SECRET_KEY: leakedSecretAttempt,
    });
    expect(validStatus).toEqual({
      configured: true,
      hasUrl: true,
      hasSecretKey: true,
    });
    expect(JSON.stringify(validStatus)).not.toContain(leakedSecretAttempt);

    // 5D. Appel réel au handler Serverless sans SUPABASE_SECRET_KEY -> 503 fail-closed
    const handlerMissingSecret = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
        SUPABASE_URL: TEST_SUPABASE_URL,
        // SUPABASE_SECRET_KEY intentionnellement absente
      },
    });
    const { baseUrl } = await mountServerlessHandlerForTest(handlerMissingSecret);

    const sessionRes = await fetch(`${baseUrl}/api/auth/supabase/session`, {
      headers: { Authorization: `Bearer ${VALID_SUPERADMIN_JWT}` },
    });
    expect(sessionRes.status).toBe(503);
    const sessionText = await sessionRes.text();
    expect(sessionText).not.toContain(leakedSecretAttempt);
    expect(JSON.parse(sessionText).code).toBe("server/supabase-auth-unconfigured");

    const overviewRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
      headers: { Authorization: `Bearer ${VALID_SUPERADMIN_JWT}` },
    });
    expect(overviewRes.status).toBe(503);
    expect((await overviewRes.json()).code).toBe("server/supabase-auth-unconfigured");
  });

  it("6. Les protections Sandbox, fail-closed et anti-path-traversal restent actives dans le handler Serverless Vercel", async () => {
    // 6A. Mode Sandbox valide (non-production) -> bloque les routes Supabase et paiements avec 403
    const sandboxHandler = createVercelApiHandler({
      env: {
        NODE_ENV: "staging",
        PDI_SERVE_STATIC_DIST: "true",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
        VERCEL: "1",
      },
      dependencies: {
        supabaseAuthGateway: createDeterministicSupabaseGateway(),
      },
    });

    const sandboxServer = await mountServerlessHandlerForTest(sandboxHandler);

    const sandboxHealth = await fetch(`${sandboxServer.baseUrl}/api/health`);
    expect(sandboxHealth.status).toBe(200);
    expect((await sandboxHealth.json()).status).toBe("ok");

    const sandboxSession = await fetch(`${sandboxServer.baseUrl}/api/auth/supabase/session`, {
      headers: { Authorization: `Bearer ${VALID_SUPERADMIN_JWT}` },
    });
    expect(sandboxSession.status).toBe(403);
    expect((await sandboxSession.json()).code).toMatch(/^sandbox\//);

    const sandboxOverview = await fetch(`${sandboxServer.baseUrl}/api/admin/supabase/overview`, {
      headers: { Authorization: `Bearer ${VALID_SUPERADMIN_JWT}` },
    });
    expect(sandboxOverview.status).toBe(403);
    expect((await sandboxOverview.json()).code).toMatch(/^sandbox\//);

    const sandboxOrders = await fetch(`${sandboxServer.baseUrl}/api/payments/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pro" }),
    });
    expect(sandboxOrders.status).toBe(403);

    const traversalRes = await fetch(`${sandboxServer.baseUrl}/api/..%2f.env`);
    expect(traversalRes.status).toBe(403);

    // 6B. Configuration fatale interdite (NODE_ENV=production + PDI_ENV=sandbox) -> 503 fail-closed
    const forbiddenProdSandbox = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
        VERCEL: "1",
      },
    });
    const fatalServer = await mountServerlessHandlerForTest(forbiddenProdSandbox);
    const fatalRes = await fetch(`${fatalServer.baseUrl}/api/health`);
    expect(fatalRes.status).toBe(503);
    expect(fatalRes.headers.get("content-type")).toContain("application/json");
    expect(await fatalRes.json()).toEqual({
      error: "Service Unavailable: Server configuration failed security verification.",
      code: "server/configuration-error",
    });

    // 6C. Secret exposé avec préfixe VITE_ -> 503 fail-closed sans jamais fuiter la valeur
    const leakedViteSecret = buildTestSecretKey("leaked_via_vite_prefix_987654321");
    const forbiddenViteSecretHandler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
        VITE_SUPABASE_SECRET_KEY: leakedViteSecret,
      },
    });
    const viteLeakServer = await mountServerlessHandlerForTest(forbiddenViteSecretHandler);
    const viteLeakRes = await fetch(`${viteLeakServer.baseUrl}/api/health`);
    expect(viteLeakRes.status).toBe(503);
    const viteLeakText = await viteLeakRes.text();
    expect(viteLeakText).not.toContain(leakedViteSecret);
    expect(JSON.parse(viteLeakText).code).toBe("server/configuration-error");

    // 6D. ALLOWED_ORIGINS invalide avec wildcard reste rejeté fail-closed même sur Vercel
    const invalidCorsHandler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_URL: "orthogonal-pdi-studio.vercel.app",
        ALLOWED_ORIGINS: "https://*.evil.invalid",
      },
    });
    const invalidCorsServer = await mountServerlessHandlerForTest(invalidCorsHandler);
    const invalidCorsRes = await fetch(`${invalidCorsServer.baseUrl}/api/health`);
    expect(invalidCorsRes.status).toBe(503);
    expect((await invalidCorsRes.json()).code).toBe("server/configuration-error");
  });

  it("7. Les routes historiques Firebase / Firestore / paiements / webhooks restent montées dans le handler Serverless", async () => {
    const handler = createVercelApiHandler({
      env: {
        NODE_ENV: "production",
        VERCEL: "1",
      },
    });
    const { baseUrl } = await mountServerlessHandlerForTest(handler);

    // Les routes historiques doivent exister (jamais 404 api/not-found) et rejeter les requêtes non autorisées
    const adminRoleRes = await fetch(`${baseUrl}/api/admin/set-user-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUid: "u1", role: "admin" }),
    });
    expect(adminRoleRes.status).not.toBe(404);
    expect([401, 403, 503]).toContain(adminRoleRes.status);

    const paymentOrderRes = await fetch(`${baseUrl}/api/payments/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pro" }),
    });
    expect(paymentOrderRes.status).not.toBe(404);
    expect([401, 403, 503]).toContain(paymentOrderRes.status);

    const paddleWebhookRes = await fetch(`${baseUrl}/api/webhooks/paddle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "transaction.completed" }),
    });
    expect(paddleWebhookRes.status).not.toBe(404);
    expect([400, 401, 403, 500, 503]).toContain(paddleWebhookRes.status);

    const slickpayWebhookRes = await fetch(`${baseUrl}/api/webhooks/slickpay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(slickpayWebhookRes.status).not.toBe(404);
    expect([400, 401, 403, 500, 503]).toContain(slickpayWebhookRes.status);

    const projectsRes = await fetch(`${baseUrl}/api/projects`);
    expect(projectsRes.status).not.toBe(404);
    expect([401, 403, 503]).toContain(projectsRes.status);
  });

  it("8. Audit de configuration Vercel (vercel.json, api/index.ts, vercelHandler.ts) : zéro app.listen(), zéro Vite, zéro changement de région, zéro secret navigateur", () => {
    const rootDir = process.cwd();

    // 8A. Vérifier api/index.ts (code exécutable hors commentaires)
    expect(typeof vercelDefaultHandler).toBe("function");
    const apiEntryPath = path.join(rootDir, "api", "index.ts");
    const apiEntryCode = stripTsComments(fs.readFileSync(apiEntryPath, "utf-8"));
    expect(apiEntryCode).not.toContain(".listen(");
    expect(apiEntryCode).not.toContain("createViteServer");
    expect(apiEntryCode).not.toContain('from "vite"');
    expect(apiEntryCode).not.toContain("from 'vite'");

    // 8B. Vérifier src/server/vercelHandler.ts (code exécutable hors commentaires)
    const handlerPath = path.join(rootDir, "src", "server", "vercelHandler.ts");
    const handlerCode = stripTsComments(fs.readFileSync(handlerPath, "utf-8"));
    expect(handlerCode).not.toContain(".listen(");
    expect(handlerCode).not.toContain("startServer(");
    expect(handlerCode).not.toContain('from "vite"');
    expect(handlerCode).not.toContain("from 'vite'");

    // 8C. Vérifier server.ts : plus d'import runtime top-level de vite
    const serverPath = path.join(rootDir, "server.ts");
    const serverContent = fs.readFileSync(serverPath, "utf-8");
    expect(serverContent).not.toMatch(/^\s*import\s+\{[^}]*createServer[^}]*\}\s+from\s+["']vite["']/m);

    // 8D. Vérifier vercel.json
    const vercelJsonPath = path.join(rootDir, "vercel.json");
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
    expect(vercelConfig.outputDirectory).toBe("dist");
    expect(vercelConfig.framework).toBe("vite");
    expect(vercelConfig.regions).toBeUndefined();
    expect(Array.isArray(vercelConfig.rewrites)).toBe(true);

    const apiRewrite = vercelConfig.rewrites.find(
      (r: { source: string; destination: string }) => r.destination === "/api"
    );
    expect(apiRewrite).toBeDefined();
    expect(apiRewrite.source).toBe("/api/(.*)");

    const spaRewrite = vercelConfig.rewrites.find(
      (r: { source: string; destination: string }) => r.destination === "/index.html"
    );
    expect(spaRewrite).toBeDefined();

    // La regex de fallback SPA ne doit JAMAIS capturer /api ou /api/*
    const spaRegex = new RegExp(`^${spaRewrite.source}$`);
    expect(spaRegex.test("/api")).toBe(false);
    expect(spaRegex.test("/api/")).toBe(false);
    expect(spaRegex.test("/api/health")).toBe(false);
    expect(spaRegex.test("/api/auth/supabase/session")).toBe(false);
    expect(spaRegex.test("/api/admin/supabase/overview")).toBe(false);
    expect(spaRegex.test("/api/unknown-endpoint")).toBe(false);

    // Les routes frontend SPA doivent toujours être capturées
    expect(spaRegex.test("/")).toBe(true);
    expect(spaRegex.test("/dashboard")).toBe(true);
    expect(spaRegex.test("/projects/123")).toBe(true);

    // 8E. Vérifier que le parcours de connexion Supabase ne réactive jamais Firebase Auth
    const authPageContent = fs.readFileSync(
      path.join(rootDir, "src", "pdi", "auth", "PdiAuthPage.tsx"),
      "utf-8"
    );
    expect(authPageContent).not.toContain("loginWithEmailAndPasswordSecure");
    expect(authPageContent).toContain("loginWithSupabaseEmailPassword");

    // 8F. Vérifier les utilitaires purs de l'adaptateur
    expect(normalizeVercelApiRequestUrl(undefined)).toBe("/api");
    expect(normalizeVercelApiRequestUrl("")).toBe("/api");
    expect(normalizeVercelApiRequestUrl("/api/health?probe=1")).toBe("/api/health?probe=1");

    const resolvedVercelEnv = resolveVercelRuntimeEnv({
      VERCEL: "1",
      VERCEL_URL: "preview-123.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "orthogonal-pdi.vercel.app",
      ALLOWED_ORIGINS: "https://custom.orthogonal-eng.com",
    });
    expect(resolvedVercelEnv.ALLOWED_ORIGINS).toContain("https://custom.orthogonal-eng.com");
    expect(resolvedVercelEnv.ALLOWED_ORIGINS).toContain("https://orthogonal-pdi.vercel.app");
    expect(resolvedVercelEnv.ALLOWED_ORIGINS).toContain("https://preview-123.vercel.app");

    // 8G. Vérifier qu'aucun secret serveur ni module serveur n'apparaît dans dist/assets/*.js (si dist/assets existe)
    const distAssetsDir = path.join(rootDir, "dist", "assets");
    if (fs.existsSync(distAssetsDir)) {
      const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith(".js"));
      expect(jsFiles.length).toBeGreaterThan(0);
      for (const file of jsFiles) {
        const content = fs.readFileSync(path.join(distAssetsDir, file), "utf-8");
        expect(content, file).not.toContain("SUPABASE_SECRET_KEY");
        expect(content, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
        expect(content, file).not.toContain("createVercelApiHandler");
        expect(content, file).not.toContain("createPdiExpressApp");
        expect(content, file).not.toMatch(/sb_secret_[0-9a-zA-Z_-]{16,}/);
      }
    }
  });

  it("9. Le serveur de développement local startServer() continue de fonctionner normalement sans régression", async () => {
    const mockViteMiddlewares = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
    const mockCreateViteServer = vi.fn(async () => ({
      middlewares: mockViteMiddlewares,
    })) as unknown as NonNullable<Parameters<typeof startServer>[0]>["dependencies"]["createViteServer"];

    const started: StartedPdiServer = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: true,
      env: {
        NODE_ENV: "development",
        PDI_ENV: "development",
        VITE_PDI_ENV: "development",
      },
      dependencies: {
        createViteServer: mockCreateViteServer,
      },
    });
    activeClosers.push(started.close);

    expect(mockCreateViteServer).toHaveBeenCalledTimes(1);

    const baseUrl = `http://127.0.0.1:${started.port}`;
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    expect((await healthRes.json()).status).toBe("ok");

    // Une route /api/* inconnue en dev retourne JSON 404 sans passer par Vite SPA
    const unknownApiRes = await fetch(`${baseUrl}/api/non-existent-dev-route`);
    expect(unknownApiRes.status).toBe(404);
    expect(unknownApiRes.headers.get("content-type")).toContain("application/json");
    expect(await unknownApiRes.json()).toEqual({
      error: "Not Found: Unknown API endpoint",
      code: "api/not-found",
    });
    expect(mockViteMiddlewares).not.toHaveBeenCalled();
  });

  it("10. Compatibilité stricte Vercel Node ESM (@vercel/node) : zéro import relatif .ts dans le graphe serveur, zéro dépendance client firebase.ts et classification claire des erreurs HTTP 5xx", async () => {
    const rootDir = process.cwd();
    const visited = new Set<string>();
    const violations: string[] = [];

    const walkServerGraph = (filePath: string) => {
      const abs = path.resolve(filePath);
      if (visited.has(abs) || !fs.existsSync(abs)) {
        return;
      }
      visited.add(abs);
      const src = fs.readFileSync(abs, "utf-8");
      const re = /(?:from|import)\s+['"](\.\.?\/[^'"]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(src)) !== null) {
        const spec = match[1];
        const relFile = path.relative(rootDir, abs);
        if (spec.endsWith(".ts") || !/\.[a-z]+$/i.test(spec)) {
          violations.push(`${relFile} -> ${spec}`);
        }
        let target = path.resolve(path.dirname(abs), spec);
        if (!fs.existsSync(target) && target.endsWith(".js")) {
          target = `${target.slice(0, -3)}.ts`;
        }
        walkServerGraph(target);
      }
    };

    walkServerGraph(path.join(rootDir, "src", "server", "vercelHandler.ts"));

    // Aucun import relatif .ts ou sans extension ne doit subsister dans le graphe serveur source
    expect(violations).toEqual([]);
    // Le graphe serveur ne doit jamais référencer le SDK navigateur client src/lib/firebase.ts
    const relVisited = Array.from(visited).map((f) => path.relative(rootDir, f));
    expect(relVisited).toContain("src/server/vercelHandler.ts");
    expect(relVisited).toContain("server.ts");
    expect(relVisited).not.toContain("src/lib/firebase.ts");

    // Vérifier la présence de api/tsconfig.json (NodeNext, noEmit: false) scopé sur api/
    const apiTsconfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, "api", "tsconfig.json"), "utf-8")
    );
    expect(apiTsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
    expect(apiTsconfig.compilerOptions.noEmit).toBe(false);

    // Vérifier que api/index.ts importe statiquement le bundle CJS local ./_vercelHandler.cjs
    // sans aucun import TypeScript inter-répertoires ../src/* (prévention FUNCTION_INVOCATION_FAILED)
    const apiEntrySrc = fs.readFileSync(path.join(rootDir, "api", "index.ts"), "utf-8");
    const apiEntryCode = stripTsComments(apiEntrySrc);
    expect(apiEntryCode).toContain('from "./_vercelHandler.cjs"');
    expect(apiEntryCode).not.toContain("../src/");

    // Vérifier que le bundle api/_vercelHandler.cjs est présent, 100% autonome (zéro dépendance npm externe ni Firebase/Firestore/Vite)
    const cjsBundlePath = path.join(rootDir, "api", "_vercelHandler.cjs");
    expect(fs.existsSync(cjsBundlePath)).toBe(true);
    const cjsBundleSrc = fs.readFileSync(cjsBundlePath, "utf-8");
    expect(cjsBundleSrc).not.toContain('require("vite")');
    expect(cjsBundleSrc).not.toContain("require('vite')");
    expect(cjsBundleSrc).not.toContain('require("firebase-admin');
    expect(cjsBundleSrc).not.toContain('require("@google-cloud/firestore")');
    expect(cjsBundleSrc).not.toContain('require("express")');
    expect(cjsBundleSrc).not.toContain('require("@supabase/supabase-js")');
    expect(cjsBundleSrc).not.toContain('require("pg-native")');

    // Vérifier l'invocation HTTP réelle du handler par défaut exporté par api/index.ts
    const { baseUrl } = await mountServerlessHandlerForTest((req, res) => {
      void vercelDefaultHandler(req, res);
    });
    const entryHealthRes = await fetch(`${baseUrl}/api/health`);
    expect(entryHealthRes.status).toBe(200);
    expect((await entryHealthRes.json()).status).toBe("ok");

    // Vérifier que verifySupabaseSessionWithServer distingue un HTTP 500 non-JSON (ex: crash serverless)
    // d'un refus d'authentification 401 (auth/invalid-token)
    const { verifySupabaseSessionWithServer, PdiSupabaseAuthError } = await import(
      "../../lib/supabaseAuth.ts"
    );
    const mockFetch500 = vi.fn(async () =>
      new Response("A server error has occurred\nFUNCTION_INVOCATION_FAILED", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      })
    );
    let caughtError: unknown;
    try {
      await verifySupabaseSessionWithServer("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.sig", {
        fetchImpl: mockFetch500 as unknown as typeof fetch,
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(PdiSupabaseAuthError);
    expect((caughtError as InstanceType<typeof PdiSupabaseAuthError>).code).toBe(
      "server/unavailable"
    );
    expect((caughtError as InstanceType<typeof PdiSupabaseAuthError>).status).toBe(500);
    expect((caughtError as InstanceType<typeof PdiSupabaseAuthError>).message).toContain(
      "indisponible"
    );
  });
});
