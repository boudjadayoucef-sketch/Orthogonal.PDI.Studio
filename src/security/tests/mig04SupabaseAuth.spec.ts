/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-04-AUTH-01
 * Suite de tests complète : Supabase Auth, validation JWT serveur,
 * autorisation `public.profiles`, Super Admin, Sandbox & Fail-Closed
 * ============================================================================
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MIG02_MIGRATION_FILES } from "../../db/supabaseSchema";
import { startServer } from "../../../server";
import {
  createRequireSupabaseAuth,
  isLikelySupabaseAccessToken,
  parseAndValidateSupabaseJwtClaims,
  requireSupabaseSuperAdmin,
  verifySupabaseSessionFromBearerToken,
  type SupabaseAdminOverviewPayload,
  type SupabaseServerAuthGateway,
  type SupabaseVerifiedSession,
} from "../../server/supabaseAuth";
import {
  attachSupabaseAuthMonitor,
  getSupabaseAccessToken,
  loginWithSupabaseEmailPassword,
  logoutSupabase,
  PdiSupabaseAuthError,
  verifySupabaseSessionWithServer,
} from "../../lib/supabaseAuth";
import { SUPABASE_AUTH_STORAGE_KEY } from "../../lib/supabase";
import {
  AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
  type BootstrapAuthUserRecord,
  type BootstrapProfileRecord,
} from "../../server/supabaseSuperAdminBootstrap";
import { evaluateWorkspaceAccessGuard } from "../../pdi/app/PdiUnifiedApp";
import { isCoherentAuthorizedLoginResult } from "../../pdi/auth/PdiAuthPage";

const TEST_SUPABASE_URL = "https://mig04testproject.supabase.co";
const TEST_SUPABASE_ISS = `${TEST_SUPABASE_URL}/auth/v1`;
const MIGRATION_PATHS = MIG02_MIGRATION_FILES.map((file) => path.resolve(process.cwd(), file));

const SUPABASE_AUTH_BOOTSTRAP_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
      CREATE ROLE authenticator NOLOGIN NOINHERIT;
    END IF;
  END
  $$;

  CREATE SCHEMA IF NOT EXISTS auth;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
  GRANT USAGE ON SCHEMA auth TO authenticated, service_role;

  CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE OR REPLACE FUNCTION auth.jwt()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  $$;

  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$
    SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
  $$;

  CREATE OR REPLACE FUNCTION auth.role()
  RETURNS text
  LANGUAGE sql
  STABLE
  AS $$
    SELECT COALESCE(NULLIF(auth.jwt() ->> 'role', ''), current_user::text);
  $$;

  GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role, authenticator;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role, authenticator;
  GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role, authenticator;
`;

function createSignedTestJwt(
  payload: Record<string, unknown>,
  secret = "mig04_test_hmac_signing_key",
  headerOverride?: Record<string, unknown>
): string {
  const header = headerOverride ?? { alg: "HS256", typ: "JWT" };
  const encHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${sig}`;
}

function verifySignedTestJwt(
  token: string,
  secret = "mig04_test_hmac_signing_key"
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest("base64url");
  const actualBuf = Buffer.from(parts[2]);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
}

async function createMigratedPGliteDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_AUTH_BOOTSTRAP_SQL);
  for (const migrationPath of MIGRATION_PATHS) {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    await db.exec(sql);
  }
  return db;
}

function createPGliteSupabaseAuthGateway(
  db: PGlite,
  signingSecret = "mig04_test_hmac_signing_key"
): SupabaseServerAuthGateway {
  return {
    async verifyAccessTokenAndGetUser(accessToken: string): Promise<BootstrapAuthUserRecord | null> {
      const verifiedPayload = verifySignedTestJwt(accessToken, signingSecret);
      if (!verifiedPayload || typeof verifiedPayload.sub !== "string") {
        throw new Error("Invalid JWT signature");
      }
      const res = await db.query<{
        id: string;
        email: string;
        email_confirmed_at: Date | string | null;
      }>(
        `SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1 LIMIT 1`,
        [verifiedPayload.sub]
      );
      const row = res.rows[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        email: row.email,
        email_confirmed_at:
          row.email_confirmed_at instanceof Date
            ? row.email_confirmed_at.toISOString()
            : row.email_confirmed_at,
        user_metadata: null,
        app_metadata: null,
      };
    },

    async findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null> {
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id, email, name, display_name, role, status, account_type, subscription_plan, company, country, country_code, city, created_at, updated_at
         FROM public.profiles
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );
      return res.rows[0] ?? null;
    },

    async getSuperAdminOverview(
      verifiedSession: SupabaseVerifiedSession
    ): Promise<SupabaseAdminOverviewPayload> {
      const [profilesRes, auditsRes, projRes, licRes] = await Promise.all([
        db.query<{
          id: string;
          email: string;
          name: string;
          role: "super_admin" | "admin" | "client" | "guest" | "demo";
          status: "active" | "suspended" | "pending_activation" | "revoked" | "disabled";
          account_type: string;
          subscription_plan: string;
          company: string | null;
          created_at: Date | string | null;
        }>(
          `SELECT id, email, name, role, status, account_type, subscription_plan, company, created_at
           FROM public.profiles ORDER BY created_at DESC`
        ),
        db.query<{
          id: string;
          event_type: string;
          resource_type: string;
          resource_id: string | null;
          severity: "info" | "warning" | "critical";
          actor_user_id: string | null;
          target_user_id: string | null;
          created_at: Date | string | null;
        }>(
          `SELECT id, event_type, resource_type, resource_id, severity, actor_user_id, target_user_id, created_at
           FROM public.audit_logs ORDER BY created_at DESC LIMIT 25`
        ),
        db.query<{ count: string }>(`SELECT count(*) FROM public.projects`),
        db.query<{ count: string }>(`SELECT count(*) FROM public.license_keys`),
      ]);

      return {
        generatedAt: new Date().toISOString(),
        verifiedSuperAdmin: {
          userId: verifiedSession.userId,
          email: verifiedSession.email,
          emailConfirmedAt: verifiedSession.emailConfirmedAt ?? "",
        },
        counts: {
          profiles: profilesRes.rows.length,
          activeProfiles: profilesRes.rows.filter((p) => p.status === "active").length,
          superAdmins: profilesRes.rows.filter(
            (p) => p.role === "super_admin" && p.status === "active"
          ).length,
          projects: Number(projRes.rows[0]?.count ?? 0),
          licenseKeys: Number(licRes.rows[0]?.count ?? 0),
          auditLogs: auditsRes.rows.length,
        },
        profiles: profilesRes.rows.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          role: r.role,
          status: r.status,
          accountType: r.account_type,
          subscriptionPlan: r.subscription_plan,
          company: r.company,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        })),
        recentAuditLogs: auditsRes.rows.map((a) => ({
          id: a.id,
          eventType: a.event_type,
          resourceType: a.resource_type,
          resourceId: a.resource_id,
          severity: a.severity,
          actorUserId: a.actor_user_id,
          targetUserId: a.target_user_id,
          createdAt: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at,
        })),
        legacyFirestoreModulesPendingMigration: ["payments_and_webhooks_ledger"],
      };
    },
  };
}

describe("MIG-04-AUTH-01 — Intégration Supabase Auth & autorisation serveur", () => {
  let db: PGlite;
  let gateway: SupabaseServerAuthGateway;

  const SUPER_ADMIN_ID = "11111111-1111-4111-8111-111111111111";
  const ACTIVE_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
  const SUSPENDED_USER_ID = "33333333-3333-4333-8333-333333333333";
  const REVOKED_USER_ID = "44444444-4444-4444-8444-444444444444";
  const DISABLED_USER_ID = "55555555-5555-4555-8555-555555555555";
  const PENDING_USER_ID = "66666666-6666-4666-8666-666666666666";
  const UNCONFIRMED_SUPER_ADMIN_ID = "77777777-7777-4777-8777-777777777777";
  const NO_PROFILE_USER_ID = "88888888-8888-4888-8888-888888888888";

  beforeAll(async () => {
    db = await createMigratedPGliteDb();
    gateway = createPGliteSupabaseAuthGateway(db);

    await db.exec(`
      INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
      VALUES
        ('${SUPER_ADMIN_ID}', '${AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL}', now(), '{}'::jsonb, '{}'::jsonb),
        ('${ACTIVE_CLIENT_ID}', 'engineer@orthogonal.dz', now(), '{"role":"super_admin","is_super_admin":true}'::jsonb, '{"role":"super_admin"}'::jsonb),
        ('${SUSPENDED_USER_ID}', 'suspended@orthogonal.dz', now(), '{}'::jsonb, '{}'::jsonb),
        ('${REVOKED_USER_ID}', 'revoked@orthogonal.dz', now(), '{}'::jsonb, '{}'::jsonb),
        ('${DISABLED_USER_ID}', 'disabled@orthogonal.dz', now(), '{}'::jsonb, '{}'::jsonb),
        ('${PENDING_USER_ID}', 'pending@orthogonal.dz', now(), '{}'::jsonb, '{}'::jsonb),
        ('${UNCONFIRMED_SUPER_ADMIN_ID}', 'unconfirmed-admin@orthogonal.dz', NULL, '{"role":"super_admin"}'::jsonb, '{}'::jsonb),
        ('${NO_PROFILE_USER_ID}', 'noprofile@orthogonal.dz', now(), '{}'::jsonb, '{}'::jsonb);

      INSERT INTO public.profiles (id, email, name, display_name, role, status, account_type, subscription_plan, company)
      VALUES
        ('${SUPER_ADMIN_ID}', '${AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL}', 'Orthogonal Super Admin', 'Orthogonal Super Admin', 'super_admin', 'active', 'enterprise', 'lifetime', 'Orthogonal Engineering'),
        ('${ACTIVE_CLIENT_ID}', 'engineer@orthogonal.dz', 'Ingénieur Piping', 'Ingénieur Piping', 'client', 'active', 'pro', 'monthly', 'Bureau Études Alger'),
        ('${SUSPENDED_USER_ID}', 'suspended@orthogonal.dz', 'Compte Suspendu', 'Compte Suspendu', 'client', 'suspended', 'basic', 'monthly', NULL),
        ('${REVOKED_USER_ID}', 'revoked@orthogonal.dz', 'Compte Révoqué', 'Compte Révoqué', 'client', 'revoked', 'basic', 'monthly', NULL),
        ('${DISABLED_USER_ID}', 'disabled@orthogonal.dz', 'Compte Désactivé', 'Compte Désactivé', 'client', 'disabled', 'basic', 'monthly', NULL),
        ('${PENDING_USER_ID}', 'pending@orthogonal.dz', 'Compte En Attente', 'Compte En Attente', 'client', 'pending_activation', 'basic', 'monthly', NULL),
        ('${UNCONFIRMED_SUPER_ADMIN_ID}', 'unconfirmed-admin@orthogonal.dz', 'Admin Non Confirmé', 'Admin Non Confirmé', 'super_admin', 'active', 'enterprise', 'lifetime', NULL);

      INSERT INTO public.audit_logs (actor_user_id, target_user_id, event_type, resource_type, resource_id, severity, metadata)
      VALUES
        ('${SUPER_ADMIN_ID}', '${SUPER_ADMIN_ID}', 'supabase.super_admin.bootstrap.activated', 'profile', '${SUPER_ADMIN_ID}', 'critical', '{"bootstrap_ticket":"MIG-03-BOOTSTRAP-01"}'::jsonb);
    `);
  }, 30000);

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  const makeValidJwtFor = (
    userId: string,
    email: string,
    overrides: Record<string, unknown> = {}
  ) => {
    const now = Math.floor(Date.now() / 1000);
    return createSignedTestJwt({
      sub: userId,
      email,
      aud: "authenticated",
      iss: TEST_SUPABASE_ISS,
      role: "authenticated",
      iat: now - 10,
      exp: now + 3600,
      ...overrides,
    });
  };

  describe("1. Validation JWT serveur & autorisation autoritative depuis public.profiles", () => {
    it("valide un JWT Super Admin confirmé (orthogonaleng@gmail.com) et accorde isSuperAdmin=true depuis public.profiles", async () => {
      const token = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
      expect(isLikelySupabaseAccessToken(token, TEST_SUPABASE_URL)).toBe(true);

      const res = await verifySupabaseSessionFromBearerToken(token, {
        gateway,
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.session.userId).toBe(SUPER_ADMIN_ID);
        expect(res.session.email).toBe(AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
        expect(res.session.role).toBe("super_admin");
        expect(res.session.status).toBe("active");
        expect(res.session.emailConfirmed).toBe(true);
        expect(res.session.isSuperAdmin).toBe(true);
      }
    });

    it("ignore totalement user_metadata / app_metadata falsifiés ({ role: 'super_admin' }) pour un utilisateur client", async () => {
      const forgedToken = makeValidJwtFor(ACTIVE_CLIENT_ID, "engineer@orthogonal.dz", {
        user_metadata: { role: "super_admin", is_super_admin: true },
        app_metadata: { role: "super_admin", is_super_admin: true },
      });

      const res = await verifySupabaseSessionFromBearerToken(forgedToken, {
        gateway,
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.session.role).toBe("client");
        expect(res.session.status).toBe("active");
        expect(res.session.isSuperAdmin).toBe(false);
      }
    });

    it("refuse un compte super_admin dont email_confirmed_at IS NULL (403 auth/unverified-email)", async () => {
      const token = makeValidJwtFor(UNCONFIRMED_SUPER_ADMIN_ID, "unconfirmed-admin@orthogonal.dz");
      const res = await verifySupabaseSessionFromBearerToken(token, {
        gateway,
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });

      expect(res.ok).toBe(false);
      if ("code" in res) {
        expect(res.httpStatus).toBe(403);
        expect(res.code).toBe("auth/unverified-email");
      }
    });

    it("refuse tous les statuts bloqués (suspended, revoked, disabled, pending_activation) et un compte sans profil", async () => {
      const cases = [
        { id: SUSPENDED_USER_ID, email: "suspended@orthogonal.dz", expectedCode: "auth/account-suspended" },
        { id: REVOKED_USER_ID, email: "revoked@orthogonal.dz", expectedCode: "auth/account-revoked" },
        { id: DISABLED_USER_ID, email: "disabled@orthogonal.dz", expectedCode: "auth/account-disabled" },
        { id: PENDING_USER_ID, email: "pending@orthogonal.dz", expectedCode: "auth/pending-activation" },
        { id: NO_PROFILE_USER_ID, email: "noprofile@orthogonal.dz", expectedCode: "auth/profile-not-found" },
      ] as const;

      for (const c of cases) {
        const token = makeValidJwtFor(c.id, c.email);
        const res = await verifySupabaseSessionFromBearerToken(token, {
          gateway,
          expectedSupabaseUrl: TEST_SUPABASE_URL,
        });
        expect(res.ok).toBe(false);
        if ("code" in res) {
          expect(res.httpStatus).toBe(403);
          expect(res.code).toBe(c.expectedCode);
        }
      }
    });

    it("rejette les JWT expirés, malformés, alg='none', mauvais issuer, ou signature falsifiée (401)", async () => {
      const now = Math.floor(Date.now() / 1000);

      // Expiré
      const expiredToken = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL, {
        exp: now - 30,
      });
      const expiredRes = await verifySupabaseSessionFromBearerToken(expiredToken, {
        gateway,
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });
      expect(expiredRes.ok).toBe(false);
      if ("code" in expiredRes) {
        expect(expiredRes.httpStatus).toBe(401);
        expect(expiredRes.code).toBe("auth/token-expired");
      }

      // Signature falsifiée (clé incorrecte)
      const forgedSigToken = createSignedTestJwt(
        {
          sub: SUPER_ADMIN_ID,
          email: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          aud: "authenticated",
          iss: TEST_SUPABASE_ISS,
          exp: now + 3600,
        },
        "wrong_attacker_secret"
      );
      const forgedSigRes = await verifySupabaseSessionFromBearerToken(forgedSigToken, {
        gateway,
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });
      expect(forgedSigRes.ok).toBe(false);
      if ("code" in forgedSigRes) {
        expect(forgedSigRes.httpStatus).toBe(401);
        expect(forgedSigRes.code).toBe("auth/invalid-token");
      }

      // alg: "none"
      const algNoneToken = createSignedTestJwt(
        {
          sub: SUPER_ADMIN_ID,
          aud: "authenticated",
          iss: TEST_SUPABASE_ISS,
          exp: now + 3600,
        },
        "any",
        { alg: "none", typ: "JWT" }
      );
      const algNoneCheck = parseAndValidateSupabaseJwtClaims(algNoneToken, {
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });
      expect(algNoneCheck.ok).toBe(false);

      // Mauvais issuer
      const wrongIssToken = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL, {
        iss: "https://attacker-project.supabase.co/auth/v1",
      });
      const wrongIssCheck = parseAndValidateSupabaseJwtClaims(wrongIssToken, {
        expectedSupabaseUrl: TEST_SUPABASE_URL,
      });
      expect(wrongIssCheck.ok).toBe(false);
      if ("code" in wrongIssCheck) {
        expect(wrongIssCheck.code).toBe("auth/invalid-issuer");
      }
    });
  });

  describe("2. Serveur Express réel (HTTP) : routes protégées, Super Admin, Dual-Provider, Sandbox & Fail-Closed", () => {
    let baseUrl: string;
    let closeServer: () => Promise<void>;

    beforeAll(async () => {
      const started = await startServer({
        host: "127.0.0.1",
        port: 0,
        attachFrontend: false,
        env: {
          NODE_ENV: "test",
          PDI_ENV: "test",
          VITE_PDI_ENV: "test",
          SUPABASE_URL: TEST_SUPABASE_URL,
        },
        dependencies: {
          supabaseAuthGateway: gateway,
          getAdminAuth: () =>
            ({
              verifyIdToken: async (token: string) => {
                if (token === "valid_legacy_firebase_token") {
                  return {
                    uid: "firebase_legacy_uid_1",
                    email: "legacy@orthogonal.dz",
                    email_verified: true,
                    role: "client",
                  };
                }
                throw new Error("Invalid Firebase token");
              },
            }) as any,
          getUserProjects: async (uid: string) => [
            { id: 1, user_id: uid, name: "Iso Line 01" } as any,
          ],
        },
      });
      baseUrl = `http://127.0.0.1:${started.port}`;
      closeServer = started.close;
    });

    afterAll(async () => {
      if (closeServer) {
        await closeServer();
      }
    });

    it("GET /api/auth/supabase/session retourne 200 avec le profil serveur pour orthogonaleng@gmail.com et 401 sans token", async () => {
      const unauth = await fetch(`${baseUrl}/api/auth/supabase/session`);
      expect(unauth.status).toBe(401);

      const superToken = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
      const res = await fetch(`${baseUrl}/api/auth/supabase/session`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.session.isSuperAdmin).toBe(true);
      expect(body.session.role).toBe("super_admin");
      expect(body.session.email).toBe(AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
    });

    it("GET /api/admin/supabase/overview autorise le Super Admin vérifié (200) et refuse un client même avec metadata et en-têtes falsifiés (403)", async () => {
      const superToken = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
      const okRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
      expect(okRes.status).toBe(200);
      const okBody = (await okRes.json()) as any;
      expect(okBody.ok).toBe(true);
      expect(okBody.overview.verifiedSuperAdmin.email).toBe(AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
      // 2 profils super_admin actifs en base de test (dont 1 non confirmé qui reste refusé par le serveur)
      expect(okBody.overview.counts.superAdmins).toBe(2);
      expect(okBody.overview.recentAuditLogs.length).toBeGreaterThanOrEqual(1);

      // Super Admin non confirmé (email_confirmed_at IS NULL) -> 403 auth/unverified-email
      const unconfirmedAdminToken = makeValidJwtFor(
        UNCONFIRMED_SUPER_ADMIN_ID,
        "unconfirmed-admin@orthogonal.dz"
      );
      const unconfirmedRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
        headers: { Authorization: `Bearer ${unconfirmedAdminToken}` },
      });
      expect(unconfirmedRes.status).toBe(403);
      const unconfirmedBody = (await unconfirmedRes.json()) as any;
      expect(unconfirmedBody.code).toBe("auth/unverified-email");

      // Client avec user_metadata.role = super_admin + en-tête client forgé -> 403
      const clientForgedToken = makeValidJwtFor(ACTIVE_CLIENT_ID, "engineer@orthogonal.dz", {
        user_metadata: { role: "super_admin" },
        app_metadata: { role: "super_admin" },
      });
      const deniedRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
        headers: {
          Authorization: `Bearer ${clientForgedToken}`,
          "X-User-Role": "super_admin",
        },
      });
      expect(deniedRes.status).toBe(403);
      const deniedBody = (await deniedRes.json()) as any;
      expect(deniedBody.code).toBe("auth/forbidden-super-admin");
    });

    it("GET /api/projects accepte un JWT Supabase vérifié et rejette un ID Token Firebase hérité (MIG-05-FIX-01)", async () => {
      const sbToken = makeValidJwtFor(ACTIVE_CLIENT_ID, "engineer@orthogonal.dz");
      const sbRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${sbToken}` },
      });
      expect(sbRes.status).toBe(200);
      const sbBody = (await sbRes.json()) as any;
      expect(sbBody.projects[0].user_id).toBe(ACTIVE_CLIENT_ID);

      const fbRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: "Bearer valid_legacy_firebase_token" },
      });
      expect(fbRes.status).toBe(401);
      const fbBody = (await fbRes.json()) as any;
      expect(fbBody.code).toBe("auth/supabase-token-required");
    });

    it("protections Sandbox (401/403) et Fail-Closed (503) sur createRequireSupabaseAuth et requireSupabaseSuperAdmin", async () => {
      const makeMockRes = () => {
        const res: any = { statusCode: 200, body: null };
        res.status = (code: number) => {
          res.statusCode = code;
          return res;
        };
        res.json = (payload: unknown) => {
          res.body = payload;
          return res;
        };
        return res;
      };

      // 1. Token synthétique Sandbox -> 401
      const mwNormal = createRequireSupabaseAuth(
        { NODE_ENV: "test", PDI_ENV: "test", SUPABASE_URL: TEST_SUPABASE_URL },
        { gateway }
      );
      const resSyn = makeMockRes();
      const nextSpy = vi.fn();
      await mwNormal(
        { headers: { authorization: "Bearer sandbox_synthetic_token_001" } } as any,
        resSyn,
        nextSpy
      );
      expect(resSyn.statusCode).toBe(401);
      expect(resSyn.body.code).toBe("auth/synthetic-identity-forbidden");
      expect(nextSpy).not.toHaveBeenCalled();

      // 2. Mode Sandbox actif -> 403
      const mwSandbox = createRequireSupabaseAuth(
        { NODE_ENV: "development", PDI_ENV: "sandbox", VITE_PDI_ENV: "sandbox" },
        { gateway }
      );
      const resSandbox = makeMockRes();
      const validToken = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
      await mwSandbox(
        { headers: { authorization: `Bearer ${validToken}` } } as any,
        resSandbox,
        nextSpy
      );
      expect(resSandbox.statusCode).toBe(403);
      expect(resSandbox.body.code).toBe("sandbox/server-auth-disabled");

      // 3. Fail-Closed sans configuration serveur Supabase -> 503
      const mwUnconfigured = createRequireSupabaseAuth({ NODE_ENV: "production", PDI_ENV: "production" });
      const resFailClosed = makeMockRes();
      await mwUnconfigured(
        { headers: { authorization: `Bearer ${validToken}` } } as any,
        resFailClosed,
        nextSpy
      );
      expect(resFailClosed.statusCode).toBe(503);
      expect(resFailClosed.body.code).toBe("server/supabase-auth-unconfigured");

      // 4. requireSupabaseSuperAdmin sans session -> 401
      const resNoSession = makeMockRes();
      requireSupabaseSuperAdmin({} as any, resNoSession, nextSpy);
      expect(resNoSession.statusCode).toBe(401);
    });
  });

  describe("3. Flux client navigateur (src/lib/supabaseAuth.ts) : connexion, refresh token, moniteur, révocation & déconnexion", () => {
    it("loginWithSupabaseEmailPassword valide côté serveur et ouvre la session Super Admin vérifiée", async () => {
      const signOutSpy = vi.fn(async () => ({ error: null }));
      const validToken = makeValidJwtFor(SUPER_ADMIN_ID, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);

      const mockClient = {
        auth: {
          signInWithPassword: vi.fn(async () => ({
            data: { session: { access_token: validToken } },
            error: null,
          })),
          signOut: signOutSpy,
        },
      } as any;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe("/api/auth/supabase/session");
        const authHeader = new Headers(init?.headers).get("Authorization");
        expect(authHeader).toBe(`Bearer ${validToken}`);
        const serverRes = await verifySupabaseSessionFromBearerToken(validToken, {
          gateway,
          expectedSupabaseUrl: TEST_SUPABASE_URL,
        });
        expect(serverRes.ok).toBe(true);
        return new Response(
          JSON.stringify({ ok: true, provider: "supabase", session: (serverRes as any).session }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch;

      const loginResult = await loginWithSupabaseEmailPassword(
        AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
        "StrongPassword#2026",
        {
          getClient: () => mockClient,
          fetchImpl: mockFetch,
          isConfigured: () => true,
          isSandbox: () => false,
        }
      );

      expect(loginResult.isSuperAdmin).toBe(true);
      expect(loginResult.emailConfirmed).toBe(true);
      expect(loginResult.profile.role).toBe("super_admin");
      expect(loginResult.sessionResolution.authMode).toBe("super_admin");
      expect(signOutSpy).not.toHaveBeenCalled();

      // Vérifie compatibilité avec le garde de PdiAuthPage & PdiUnifiedApp
      expect(isCoherentAuthorizedLoginResult(loginResult, loginResult.authUser)).toBe(true);
      const guardSuper = evaluateWorkspaceAccessGuard(
        loginResult.sessionResolution,
        "super_admin_console",
        loginResult.authUser
      );
      expect(guardSuper.allowed).toBe(true);
      expect(guardSuper.resolvedAuthMode).toBe("super_admin");
      expect(guardSuper.authorizedModule).toBe("super_admin_console");
    });

    it("loginWithSupabaseEmailPassword révoque immédiatement la session locale (signOut) si le serveur refuse le compte (suspendu / non confirmé)", async () => {
      const signOutSpy = vi.fn(async () => ({ error: null }));
      const suspendedToken = makeValidJwtFor(SUSPENDED_USER_ID, "suspended@orthogonal.dz");

      const mockClient = {
        auth: {
          signInWithPassword: vi.fn(async () => ({
            data: { session: { access_token: suspendedToken } },
            error: null,
          })),
          signOut: signOutSpy,
        },
      } as any;

      const mockFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "Forbidden: Account status 'suspended' is not authorized.",
            code: "auth/account-suspended",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      ) as unknown as typeof fetch;

      await expect(
        loginWithSupabaseEmailPassword("suspended@orthogonal.dz", "Pass123!", {
          getClient: () => mockClient,
          fetchImpl: mockFetch,
          isConfigured: () => true,
          isSandbox: () => false,
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof PdiSupabaseAuthError && err.code === "auth/account-suspended"
      );

      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });

    it("getSupabaseAccessToken renouvelle automatiquement un token proche de l'expiration et déconnecte si le refresh échoue", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const expiringToken = makeValidJwtFor(ACTIVE_CLIENT_ID, "engineer@orthogonal.dz");
      const freshToken = makeValidJwtFor(ACTIVE_CLIENT_ID, "engineer@orthogonal.dz");

      const refreshSpy = vi.fn(async () => ({
        data: { session: { access_token: freshToken, expires_at: nowSec + 3600 } },
        error: null,
      }));

      const mockClient = {
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: { access_token: expiringToken, expires_at: nowSec + 15 } },
            error: null,
          })),
          refreshSession: refreshSpy,
          signOut: vi.fn(async () => ({ error: null })),
        },
      } as any;

      const token = await getSupabaseAccessToken(false, {
        getClient: () => mockClient,
        isConfigured: () => true,
        isSandbox: () => false,
      });
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(token).toBe(freshToken);

      // Échec du refresh (session expirée) -> déclenche signOut et retourne null
      const signOutOnExpired = vi.fn(async () => ({ error: null }));
      const expiredClient = {
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: { access_token: expiringToken, expires_at: nowSec - 10 } },
            error: null,
          })),
          refreshSession: vi.fn(async () => ({
            data: { session: null },
            error: new Error("Refresh token expired"),
          })),
          signOut: signOutOnExpired,
        },
      } as any;

      const expiredResult = await getSupabaseAccessToken(false, {
        getClient: () => expiredClient,
        isConfigured: () => true,
        isSandbox: () => false,
      });
      expect(expiredResult).toBeNull();
      expect(signOutOnExpired).toHaveBeenCalledTimes(1);
    });

    it("attachSupabaseAuthMonitor revalide INITIAL_SESSION et TOKEN_REFRESHED côté serveur, et révoque sur SIGNED_OUT ou refus serveur", async () => {
      let authCallback: ((event: any, session: any) => void) | null = null;
      const unsubscribeSpy = vi.fn();
      const signOutSpy = vi.fn(async () => ({ error: null }));

      const mockClient = {
        auth: {
          onAuthStateChange: vi.fn((cb: any) => {
            authCallback = cb;
            return { data: { subscription: { unsubscribe: unsubscribeSpy } } };
          }),
          signOut: signOutSpy,
        },
      } as any;

      const verifiedSpy = vi.fn();
      const revokedSpy = vi.fn();

      const clientToken = makeValidJwtFor(ACTIVE_CLIENT_ID, "engineer@orthogonal.dz");
      let denyNext = false;

      const mockFetch = vi.fn(async () => {
        if (denyNext) {
          return new Response(
            JSON.stringify({ error: "Suspended", code: "auth/account-suspended" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        const serverRes = await verifySupabaseSessionFromBearerToken(clientToken, {
          gateway,
          expectedSupabaseUrl: TEST_SUPABASE_URL,
        });
        return new Response(
          JSON.stringify({ ok: true, provider: "supabase", session: (serverRes as any).session }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch;

      const stop = attachSupabaseAuthMonitor({
        deps: {
          getClient: () => mockClient,
          fetchImpl: mockFetch,
          isConfigured: () => true,
          isSandbox: () => false,
        },
        onSessionVerified: verifiedSpy,
        onSessionRevokedOrSignedOut: revokedSpy,
      });

      expect(authCallback).not.toBeNull();
      authCallback!("INITIAL_SESSION", { access_token: clientToken });
      await new Promise((r) => setTimeout(r, 20));
      expect(verifiedSpy).toHaveBeenCalledTimes(1);
      expect(verifiedSpy.mock.calls[0][0].isSuperAdmin).toBe(false);

      // Un client ne peut jamais ouvrir super_admin_console dans le garde workspace
      const clientRes = verifiedSpy.mock.calls[0][0];
      const clientGuard = evaluateWorkspaceAccessGuard(
        clientRes.sessionResolution,
        "super_admin_console",
        clientRes.authUser
      );
      expect(clientGuard.allowed).toBe(true);
      expect(clientGuard.resolvedAuthMode).toBe("client");
      expect(clientGuard.authorizedModule).toBe("isometric");

      // Suspension côté serveur lors d'un TOKEN_REFRESHED -> révocation immédiate + signOut
      denyNext = true;
      authCallback!("TOKEN_REFRESHED", { access_token: clientToken });
      await new Promise((r) => setTimeout(r, 20));
      expect(revokedSpy).toHaveBeenCalledTimes(1);
      expect(revokedSpy.mock.calls[0][0].code).toBe("auth/account-suspended");
      expect(signOutSpy).toHaveBeenCalledTimes(1);

      stop();
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it("logoutSupabase appelle signOut() et purge la clé de stockage dédiée", async () => {
      const signOutSpy = vi.fn(async () => ({ error: null }));
      const removeItemSpy = vi.fn();
      const prevWindow = (globalThis as any).window;
      (globalThis as any).window = { localStorage: { removeItem: removeItemSpy } };

      try {
        await logoutSupabase({
          getClient: () => ({ auth: { signOut: signOutSpy } }) as any,
          isConfigured: () => true,
        });
        expect(signOutSpy).toHaveBeenCalledTimes(1);
        expect(removeItemSpy).toHaveBeenCalledWith(SUPABASE_AUTH_STORAGE_KEY);
      } finally {
        (globalThis as any).window = prevWindow;
      }
    });

    it("verifySupabaseSessionWithServer rejette un token vide (401)", async () => {
      await expect(verifySupabaseSessionWithServer("")).rejects.toSatisfy(
        (err: unknown) => err instanceof PdiSupabaseAuthError && err.code === "auth/missing-token"
      );
    });
  });

  describe("4. Isolation des secrets et absence de fuite côté navigateur / bundle", () => {
    it("src/lib/supabaseAuth.ts et PdiSupabaseSuperAdminPanel.tsx n'importent aucun module serveur ni secret", () => {
      const browserFiles = [
        "src/lib/supabaseAuth.ts",
        "src/pdi/superadmin/PdiSupabaseSuperAdminPanel.tsx",
        "src/pdi/auth/PdiAuthPage.tsx",
        "src/pdi/app/PdiUnifiedApp.tsx",
      ];

      for (const relPath of browserFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
        expect(content).not.toContain("src/server/");
        expect(content).not.toContain("../server/");
        expect(content).not.toContain("SUPABASE_SECRET_KEY");
        expect(content).not.toMatch(/sb_secret_[0-9a-zA-Z_-]{16,}/);
      }
    });
  });
});
