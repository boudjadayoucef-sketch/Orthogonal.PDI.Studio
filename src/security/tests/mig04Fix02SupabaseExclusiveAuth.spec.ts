/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-04-AUTH-01-FIX-02
 * Tests complets : Supabase Auth exclusif, suppression du parcours Firebase Auth,
 * correction d'identité Super Admin (`orthognaleng@gmail.com` -> `orthogonaleng@gmail.com`),
 * élimination définitive de `r._getRecaptchaConfig is not a function`,
 * et non-régression des services Firebase métier conservés.
 * ============================================================================
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import PdiAuthPage, {
  executeSupabaseExclusiveLogin,
  executeSupabaseExclusivePasswordReset,
  SUPABASE_GOOGLE_OAUTH_DISABLED_NOTICE,
  SUPABASE_UNCONFIGURED_LOGIN_ERROR,
  SUPABASE_UNCONFIGURED_RESET_ERROR,
} from "../../pdi/auth/PdiAuthPage";
import {
  PdiSupabaseSuperAdminPanel,
  PdiSupabaseSuperAdminPanelView,
  loadSupabaseSuperAdminPanelState,
} from "../../pdi/superadmin/PdiSupabaseSuperAdminPanel";
import {
  attachSupabaseAuthMonitor,
  fetchSupabaseSuperAdminOverview,
  loginWithSupabaseEmailPassword,
  PdiSupabaseAuthError,
  sendSupabasePasswordResetEmail,
  type SupabaseAdminOverviewData,
} from "../../lib/supabaseAuth";
import {
  evaluateClientFirebaseInitGate,
  getCountryRestrictionsFromFirebase,
  getFirebaseProfiles,
  getPaymentTransactionsFromFirebase,
} from "../../lib/firebase";
import { isStagingSandboxMode } from "../../lib/stagingSandbox";
import { startServer } from "../../../server";
import {
  createSupabaseServerAuthGateway,
  verifySupabaseSessionFromBearerToken,
  type SupabaseAdminOverviewPayload,
  type SupabaseServerAuthGateway,
} from "../../server/supabaseAuth";
import {
  AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
  type BootstrapAuditLogInsert,
  type BootstrapAuthUserRecord,
  type BootstrapProfileRecord,
  type SupabaseProfileRole,
  type SupabaseProfileStatus,
} from "../../server/supabaseSuperAdminBootstrap";
import {
  CORRECTED_SUPER_ADMIN_EMAIL,
  correctSupabaseSuperAdminIdentity,
  LEGACY_TYPO_SUPER_ADMIN_EMAIL,
  SuperAdminIdentityCorrectionError,
  type SuperAdminIdentityCorrectionGateway,
  type SupabaseIdentityMappingRecord,
} from "../../server/supabaseSuperAdminIdentityCorrection";

const TEST_SUPABASE_URL = "https://orthogonal-fix02-test.supabase.co";
const TEST_SUPABASE_ISS = `${TEST_SUPABASE_URL}/auth/v1`;
const TEST_JWT_SECRET = "test_only_hmac_signing_secret_for_mig04_fix02_suite";

const SUPER_ADMIN_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SPOOF_EMAIL_CLIENT_UUID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSignedTestJwt(
  payload: Record<string, unknown>,
  secret = TEST_JWT_SECRET
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

function verifySignedTestJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expectedSig = b64url(
    crypto
      .createHmac("sha256", TEST_JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest()
  );
  if (expectedSig !== parts[2]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

async function initRealPostgresWithMig02Migrations(): Promise<PGlite> {
  const db = new PGlite();

  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY,
      email text UNIQUE,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user);
    $$;
  `);

  const migDir = path.resolve(process.cwd(), "supabase/migrations");
  const mig01Sql = fs.readFileSync(
    path.join(migDir, "20261123000100_mig02_supabase_core_schema.sql"),
    "utf8"
  );
  const mig02Sql = fs.readFileSync(
    path.join(migDir, "20261123000200_mig02_supabase_rls_and_security.sql"),
    "utf8"
  );
  const mig03Sql = fs.readFileSync(
    path.join(migDir, "20261123000300_mig02_fix01_security_definer_service_role_guard.sql"),
    "utf8"
  );

  await db.exec(mig01Sql);
  await db.exec(mig02Sql);
  await db.exec(mig03Sql);
  return db;
}

function createPGliteAuthGateway(db: PGlite): SupabaseServerAuthGateway {
  return {
    async verifyAccessTokenAndGetUser(
      accessToken: string
    ): Promise<BootstrapAuthUserRecord | null> {
      const claims = verifySignedTestJwt(accessToken);
      if (!claims || typeof claims.sub !== "string") return null;
      const res = await db.query<{
        id: string;
        email: string;
        email_confirmed_at: string | null;
        created_at: string;
      }>(
        `SELECT id::text, email, email_confirmed_at::text, created_at::text
         FROM auth.users WHERE id = $1::uuid`,
        [claims.sub]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        email: row.email,
        email_confirmed_at: row.email_confirmed_at,
        created_at: row.created_at,
      };
    },

    async findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null> {
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id::text, email, name, display_name, role, status, account_type,
                subscription_plan, company, country, country_code, city,
                created_at::text, updated_at::text
         FROM public.profiles WHERE id = $1::uuid`,
        [userId]
      );
      return res.rows[0] ?? null;
    },

    async getSuperAdminOverview(verifiedSession): Promise<SupabaseAdminOverviewPayload> {
      const [profilesRes, auditRes] = await Promise.all([
        db.query<{
          id: string;
          email: string;
          name: string;
          role: SupabaseProfileRole;
          status: SupabaseProfileStatus;
          account_type: string;
          subscription_plan: string;
          company: string | null;
          created_at: string;
        }>(
          `SELECT id::text, email, name, role, status, account_type, subscription_plan, company, created_at::text
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
          created_at: string;
        }>(
          `SELECT id::text, event_type, resource_type, resource_id, severity,
                  actor_user_id::text, target_user_id::text, created_at::text
           FROM public.audit_logs ORDER BY created_at DESC LIMIT 20`
        ),
      ]);

      return {
        generatedAt: new Date().toISOString(),
        verifiedSuperAdmin: {
          userId: verifiedSession.userId,
          email: verifiedSession.email,
          emailConfirmedAt: verifiedSession.emailConfirmedAt ?? new Date().toISOString(),
        },
        counts: {
          profiles: profilesRes.rows.length,
          activeProfiles: profilesRes.rows.filter((p) => p.status === "active").length,
          superAdmins: profilesRes.rows.filter(
            (p) => p.role === "super_admin" && p.status === "active"
          ).length,
          projects: 0,
          licenseKeys: 0,
          auditLogs: auditRes.rows.length,
        },
        profiles: profilesRes.rows.map((p) => ({
          id: p.id,
          email: p.email,
          name: p.name,
          role: p.role,
          status: p.status,
          accountType: p.account_type,
          subscriptionPlan: p.subscription_plan,
          company: p.company,
          createdAt: p.created_at,
        })),
        recentAuditLogs: auditRes.rows.map((a) => ({
          id: a.id,
          eventType: a.event_type,
          resourceType: a.resource_type,
          resourceId: a.resource_id,
          severity: a.severity,
          actorUserId: a.actor_user_id,
          targetUserId: a.target_user_id,
          createdAt: a.created_at,
        })),
        legacyFirestoreModulesPendingMigration: [
          "payments_and_webhooks_ledger (Firestore pending_orders / payment_transactions)",
          "country_restrictions (Firestore settings/country_restrictions)",
        ],
      };
    },
  };
}

function createPGliteIdentityCorrectionGateway(
  db: PGlite
): SuperAdminIdentityCorrectionGateway {
  return {
    async findAuthUsersByEmail(email: string): Promise<BootstrapAuthUserRecord[]> {
      const res = await db.query<{
        id: string;
        email: string;
        email_confirmed_at: string | null;
        created_at: string;
      }>(
        `SELECT id::text, email, email_confirmed_at::text, created_at::text
         FROM auth.users WHERE lower(email) = lower($1)`,
        [email]
      );
      return res.rows;
    },

    async updateAuthUserEmailById(
      userId: string,
      newEmail: string
    ): Promise<BootstrapAuthUserRecord> {
      const res = await db.query<{
        id: string;
        email: string;
        email_confirmed_at: string | null;
        created_at: string;
      }>(
        `UPDATE auth.users
         SET email = lower($2),
             email_confirmed_at = COALESCE(email_confirmed_at, now())
         WHERE id = $1::uuid
         RETURNING id::text, email, email_confirmed_at::text, created_at::text`,
        [userId, newEmail]
      );
      if (res.rows.length !== 1) {
        throw new Error("auth.users row not found during updateUserById simulation");
      }
      return res.rows[0];
    },

    async findProfileByUserId(userId: string): Promise<BootstrapProfileRecord | null> {
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id::text, email, name, display_name, role, status, account_type,
                subscription_plan, company, country, country_code, city,
                created_at::text, updated_at::text
         FROM public.profiles WHERE id = $1::uuid`,
        [userId]
      );
      return res.rows[0] ?? null;
    },

    async findProfilesByEmail(email: string): Promise<BootstrapProfileRecord[]> {
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id::text, email, name, display_name, role, status, account_type,
                subscription_plan, company, country, country_code, city,
                created_at::text, updated_at::text
         FROM public.profiles WHERE lower(email) = lower($1)`,
        [email]
      );
      return res.rows;
    },

    async updateProfileEmailPreservingRole(
      userId: string,
      newEmail: string
    ): Promise<BootstrapProfileRecord> {
      const res = await db.query<BootstrapProfileRecord>(
        `UPDATE public.profiles
         SET email = lower($2)
         WHERE id = $1::uuid
         RETURNING id::text, email, name, display_name, role, status, account_type,
                   subscription_plan, company, country, country_code, city,
                   created_at::text, updated_at::text`,
        [userId, newEmail]
      );
      if (res.rows.length !== 1) {
        throw new Error("public.profiles row not found during update");
      }
      return res.rows[0];
    },

    async findIdentityMappingsByUserId(
      userId: string
    ): Promise<SupabaseIdentityMappingRecord[]> {
      const res = await db.query<SupabaseIdentityMappingRecord>(
        `SELECT id::text, supabase_user_id::text, firebase_email
         FROM public.user_identity_mappings WHERE supabase_user_id = $1::uuid`,
        [userId]
      );
      return res.rows;
    },

    async updateIdentityMappingEmail(
      mappingId: string,
      newEmail: string
    ): Promise<void> {
      await db.query(
        `UPDATE public.user_identity_mappings
         SET firebase_email = lower($2)
         WHERE id = $1::uuid`,
        [mappingId, newEmail]
      );
    },

    async insertAuditLog(entry: BootstrapAuditLogInsert): Promise<void> {
      await db.query(
        `INSERT INTO public.audit_logs
           (actor_user_id, target_user_id, event_type, resource_type, resource_id, severity, metadata)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb)`,
        [
          entry.actor_user_id,
          entry.target_user_id,
          entry.event_type,
          entry.resource_type,
          entry.resource_id,
          entry.severity,
          JSON.stringify(entry.metadata),
        ]
      );
    },
  };
}

describe("MIG-04-AUTH-01-FIX-02 — Supabase Auth Exclusif & Correction Identité Super Admin", () => {
  let db: PGlite;
  let authGateway: SupabaseServerAuthGateway;
  let correctionGateway: SuperAdminIdentityCorrectionGateway;
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    db = await initRealPostgresWithMig02Migrations();

    // Seed initial : Super Admin avec l'ancienne faute de frappe (orthognaleng@gmail.com) + historique audit + mapping
    await db.query(
      `INSERT INTO auth.users (id, email, email_confirmed_at)
       VALUES
         ($1::uuid, $2, now()),
         ($3::uuid, 'engineer@orthogonal.dz', now())`,
      [SUPER_ADMIN_UUID, LEGACY_TYPO_SUPER_ADMIN_EMAIL, CLIENT_UUID]
    );

    await db.query(
      `INSERT INTO public.profiles (id, email, name, display_name, role, status, account_type, subscription_plan, company)
       VALUES
         ($1::uuid, $2, 'Orthogonal Super Admin', 'Orthogonal Super Admin', 'super_admin', 'active', 'enterprise', 'lifetime', 'ORTHOGONAL - ENG'),
         ($3::uuid, 'engineer@orthogonal.dz', 'Ingénieur Standard', 'Ingénieur Standard', 'client', 'active', 'pro', 'yearly', 'Bureau EPC')`,
      [SUPER_ADMIN_UUID, LEGACY_TYPO_SUPER_ADMIN_EMAIL, CLIENT_UUID]
    );

    await db.query(
      `INSERT INTO public.user_identity_mappings (firebase_uid, supabase_user_id, firebase_email, migration_status)
       VALUES ('legacy_fb_super_admin', $1::uuid, $2, 'verified')`,
      [SUPER_ADMIN_UUID, LEGACY_TYPO_SUPER_ADMIN_EMAIL]
    );

    await db.query(
      `INSERT INTO public.audit_logs (actor_user_id, target_user_id, event_type, resource_type, resource_id, severity, metadata)
       VALUES ($1::uuid, $1::uuid, 'super_admin.bootstrap.activated', 'profiles', $1::text, 'critical', '{"ticket":"MIG-03-BOOTSTRAP-01"}'::jsonb)`,
      [SUPER_ADMIN_UUID]
    );

    authGateway = createPGliteAuthGateway(db);
    correctionGateway = createPGliteIdentityCorrectionGateway(db);

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
        supabaseAuthGateway: authGateway,
      },
    });
    baseUrl = `http://127.0.0.1:${started.port}`;
    closeServer = started.close;
  }, 30000);

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
    if (db) {
      await db.close();
    }
  });

  const makeJwtFor = (
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

  it("7 & 8. Corrige l'identité Super Admin (orthognaleng@gmail.com -> orthogonaleng@gmail.com) en conservant STRICTEMENT le même UUID, role='super_admin', status='active', zéro doublon et historique d'audit intact", async () => {
    expect(AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL).toBe("orthogonaleng@gmail.com");
    expect(CORRECTED_SUPER_ADMIN_EMAIL).toBe("orthogonaleng@gmail.com");

    // 1. Blocage navigateur strict
    await expect(
      correctSupabaseSuperAdminIdentity({
        gateway: correctionGateway,
        dryRun: false,
        requestContext: { source: "browser", origin: "https://app.example.com" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof SuperAdminIdentityCorrectionError &&
        err.code === "BROWSER_REQUEST_FORBIDDEN"
    );

    // 2. Simulation (dry-run) : ne modifie rien en base
    const dryRunRes = await correctSupabaseSuperAdminIdentity({
      gateway: correctionGateway,
      dryRun: true,
      operatorId: "sec-ops-fix02",
      requestContext: { source: "server_cli" },
    });
    expect(dryRunRes.ok).toBe(true);
    expect(dryRunRes.status).toBe("dry_run_ready");
    expect(dryRunRes.userId).toBe(SUPER_ADMIN_UUID);

    // 3. Exécution réelle : met à jour le compte existant SANS créer de 2e compte
    const execRes = await correctSupabaseSuperAdminIdentity({
      gateway: correctionGateway,
      dryRun: false,
      operatorId: "sec-ops-fix02",
      requestContext: { source: "server_cli" },
    });

    expect(execRes.ok).toBe(true);
    expect(execRes.status).toBe("corrected");
    expect(execRes.userId).toBe(SUPER_ADMIN_UUID);
    expect(execRes.uuidPreserved).toBe(true);
    expect(execRes.rolePreserved).toBe(true);
    expect(execRes.statusPreserved).toBe(true);
    expect(execRes.emailConfirmed).toBe(true);
    expect(execRes.identityMappingsUpdated).toBe(1);
    expect(execRes.auditLogged).toBe(true);

    // Vérification SQL réelle : UUID identique, 0 doublon, rôle super_admin + status active préservés
    const authUsers = await db.query<{ id: string; email: string }>(
      `SELECT id::text, email FROM auth.users WHERE email LIKE '%@gmail.com'`
    );
    expect(authUsers.rows).toHaveLength(1);
    expect(authUsers.rows[0].id).toBe(SUPER_ADMIN_UUID);
    expect(authUsers.rows[0].email).toBe("orthogonaleng@gmail.com");

    const profiles = await db.query<{
      id: string;
      email: string;
      role: string;
      status: string;
    }>(
      `SELECT id::text, email, role, status FROM public.profiles WHERE id = $1::uuid`,
      [SUPER_ADMIN_UUID]
    );
    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0]).toEqual({
      id: SUPER_ADMIN_UUID,
      email: "orthogonaleng@gmail.com",
      role: "super_admin",
      status: "active",
    });

    // Mapping mis à jour sans casser la référence UUID
    const mappings = await db.query<{ supabase_user_id: string; firebase_email: string }>(
      `SELECT supabase_user_id::text, firebase_email FROM public.user_identity_mappings WHERE supabase_user_id = $1::uuid`,
      [SUPER_ADMIN_UUID]
    );
    expect(mappings.rows).toHaveLength(1);
    expect(mappings.rows[0].firebase_email).toBe("orthogonaleng@gmail.com");

    // Historique d'audit conservé (entrée MIG-03 toujours présente + nouvelle entrée FIX-02 ajoutée)
    const audits = await db.query<{ event_type: string }>(
      `SELECT event_type FROM public.audit_logs ORDER BY created_at ASC`
    );
    const eventTypes = audits.rows.map((r) => r.event_type);
    expect(eventTypes).toContain("super_admin.bootstrap.activated");
    expect(eventTypes).toContain("super_admin.identity_email.corrected");

    // Idempotence : relancer la correction retourne already_corrected sans erreur ni doublon
    const idempotentRes = await correctSupabaseSuperAdminIdentity({
      gateway: correctionGateway,
      dryRun: false,
      requestContext: { source: "server_cli" },
    });
    expect(idempotentRes.status).toBe("already_corrected");
    expect(idempotentRes.userId).toBe(SUPER_ADMIN_UUID);
  });

  it("1. Connexion Super Admin Supabase (orthogonaleng@gmail.com) vérifiée côté serveur + accès autorisé à GET /api/admin/supabase/overview", async () => {
    const superJwt = makeJwtFor(SUPER_ADMIN_UUID, "orthogonaleng@gmail.com");
    const fakeClient = {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: {
            session: {
              access_token: superJwt,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        })),
        getSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: superJwt,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as any;

    const routedFetch: typeof fetch = (input, init) => {
      const target =
        typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
      return fetch(target, init);
    };

    const loginRes = await executeSupabaseExclusiveLogin(
      "orthogonaleng@gmail.com",
      "ValidSuperAdminPassword!",
      {
        supabaseAvailable: true,
        loginFn: (email, password) =>
          loginWithSupabaseEmailPassword(email, password, {
            getClient: () => fakeClient,
            fetchImpl: routedFetch,
            isConfigured: () => true,
            isSandbox: () => false,
          }),
      }
    );

    expect(loginRes.provider).toBe("supabase");
    expect(loginRes.authUser.uid).toBe(SUPER_ADMIN_UUID);
    expect(loginRes.authUser.email).toBe("orthogonaleng@gmail.com");
    expect(loginRes.isSuperAdmin).toBe(true);
    expect(loginRes.profile.role).toBe("super_admin");
    expect(loginRes.sessionResolution.authMode).toBe("super_admin");

    // Ouverture du panneau Super Admin Supabase (GET /api/admin/supabase/overview)
    const panelState = await loadSupabaseSuperAdminPanelState(() =>
      fetchSupabaseSuperAdminOverview({
        getClient: () => fakeClient,
        fetchImpl: routedFetch,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    );

    expect(panelState.error).toBeNull();
    expect(panelState.overview?.verifiedSuperAdmin.userId).toBe(SUPER_ADMIN_UUID);
    expect(panelState.overview?.verifiedSuperAdmin.email).toBe("orthogonaleng@gmail.com");

    const panelHtml = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanelView, {
        state: panelState,
        currentUserEmail: "orthogonaleng@gmail.com",
        onRefresh: vi.fn(),
        onSwitchModule: vi.fn(),
      })
    );
    expect(panelHtml).toContain("orthogonaleng@gmail.com");
    expect(panelHtml).toContain(SUPER_ADMIN_UUID);
  });

  it("2. Connexion utilisateur standard Supabase (role='client') : accès workspace autorisé, accès Super Admin refusé (403)", async () => {
    const clientJwt = makeJwtFor(CLIENT_UUID, "engineer@orthogonal.dz", {
      // Tentative d'élévation via metadata falsifiées -> ignorée par le serveur
      user_metadata: { role: "super_admin" },
      app_metadata: { role: "super_admin" },
    });

    const fakeClient = {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: {
            session: {
              access_token: clientJwt,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        })),
        getSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: clientJwt,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as any;

    const routedFetch: typeof fetch = (input, init) => {
      const target =
        typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
      return fetch(target, init);
    };

    const clientLogin = await executeSupabaseExclusiveLogin(
      "engineer@orthogonal.dz",
      "ClientPassword123!",
      {
        supabaseAvailable: true,
        loginFn: (email, password) =>
          loginWithSupabaseEmailPassword(email, password, {
            getClient: () => fakeClient,
            fetchImpl: routedFetch,
            isConfigured: () => true,
            isSandbox: () => false,
          }),
      }
    );

    expect(clientLogin.provider).toBe("supabase");
    expect(clientLogin.profile.role).toBe("client");
    expect(clientLogin.isSuperAdmin).toBe(false);
    expect(clientLogin.sessionResolution.canAccessWorkspace).toBe(true);
    expect(clientLogin.sessionResolution.authMode).toBe("client");

    // Refus serveur 403 sur l'endpoint Super Admin
    const overviewRes = await fetch(`${baseUrl}/api/admin/supabase/overview`, {
      headers: { Authorization: `Bearer ${clientJwt}` },
    });
    expect(overviewRes.status).toBe(403);
  });

  it("3. Supabase non configuré : blocage explicite dans PdiAuthPage, loginWithSupabaseEmailPassword et sendSupabasePasswordResetEmail — AUCUN fallback Firebase", async () => {
    // Rendu UI de PdiAuthPage avec Supabase non configuré
    const unconfiguredHtml = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: false,
      })
    );
    expect(unconfiguredHtml).toContain('data-testid="pdi-supabase-unconfigured-banner"');
    expect(unconfiguredHtml).toContain(
      SUPABASE_UNCONFIGURED_LOGIN_ERROR.replace(/'/g, "&#x27;")
    );
    expect(unconfiguredHtml).toContain("Connexion bloquée (Supabase non configuré)");
    expect(unconfiguredHtml).not.toContain('data-testid="pdi-auth-provider-switch"');
    expect(unconfiguredHtml).not.toContain("Firebase Auth");

    // Bouton Google désactivé proprement (aucun parcours Firebase caché)
    expect(unconfiguredHtml).toContain('data-testid="pdi-btn-google-disabled"');
    expect(unconfiguredHtml).toContain(SUPABASE_GOOGLE_OAUTH_DISABLED_NOTICE);

    // Exécution bloquée au niveau fonctionnel sans jamais appeler un fallback
    const loginSpy = vi.fn();
    await expect(
      executeSupabaseExclusiveLogin("orthogonaleng@gmail.com", "Secret123!", {
        supabaseAvailable: false,
        loginFn: loginSpy,
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof PdiSupabaseAuthError &&
        err.code === "client/supabase-unconfigured" &&
        err.status === 503
    );
    expect(loginSpy).not.toHaveBeenCalled();

    // Service direct bloqué aussi si non configuré
    await expect(
      loginWithSupabaseEmailPassword("orthogonaleng@gmail.com", "Secret123!", {
        isConfigured: () => false,
        isSandbox: () => false,
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof PdiSupabaseAuthError && err.code === "client/supabase-unconfigured"
    );

    await expect(
      executeSupabaseExclusivePasswordReset("orthogonaleng@gmail.com", {
        supabaseAvailable: false,
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof PdiSupabaseAuthError &&
        err.code === "client/supabase-unconfigured" &&
        err.message === SUPABASE_UNCONFIGURED_RESET_ERROR
    );

    await expect(
      sendSupabasePasswordResetEmail("orthogonaleng@gmail.com", {
        isConfigured: () => false,
        isSandbox: () => false,
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof PdiSupabaseAuthError && err.code === "client/supabase-unconfigured"
    );
  });

  it("4. Échec de connexion Supabase (mauvais mot de passe / erreur serveur) : retourne une erreur Supabase explicite sans AUCUN appel Firebase", async () => {
    const failingSupabaseClient = {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials" },
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as any;

    await expect(
      executeSupabaseExclusiveLogin("orthogonaleng@gmail.com", "WrongPass!", {
        supabaseAvailable: true,
        loginFn: (email, password) =>
          loginWithSupabaseEmailPassword(email, password, {
            getClient: () => failingSupabaseClient,
            isConfigured: () => true,
            isSandbox: () => false,
          }),
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof PdiSupabaseAuthError && err.code === "auth/invalid-credentials"
    );

    expect(failingSupabaseClient.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    // Vérification statique que PdiAuthPage n'importe ni n'appelle plus aucun flux de connexion Firebase
    const authPageSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/pdi/auth/PdiAuthPage.tsx"),
      "utf8"
    );
    expect(authPageSource).not.toContain("loginWithEmailAndPasswordSecure");
    expect(authPageSource).not.toContain("loginWithGoogleSecure");
    expect(authPageSource).not.toContain("sendResetPasswordEmail");
    expect(authPageSource).not.toContain("pdi-auth-provider-switch");
    expect(authPageSource).not.toContain("Firebase Auth (Hérité)");
    expect(authPageSource).not.toContain("orthognaleng@gmail.com");
  });

  it("5. Récupération du mot de passe via Supabase uniquement (sendSupabasePasswordResetEmail) — zéro appel Firebase", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
    const fakeClient = {
      auth: {
        resetPasswordForEmail,
      },
    } as any;

    await executeSupabaseExclusivePasswordReset("  orthogonaleng@gmail.com  ", {
      supabaseAvailable: true,
      resetFn: (email) =>
        sendSupabasePasswordResetEmail(email, {
          getClient: () => fakeClient,
          isConfigured: () => true,
          isSandbox: () => false,
        }),
    });

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("orthogonaleng@gmail.com");
  });

  it("6. Absence TOTALE d'appel Firebase Auth (élimination définitive de r._getRecaptchaConfig is not a function) pendant : chargement login, connexion Supabase, rafraîchissement session et ouverture panneau Super Admin", async () => {
    // 6a. Vérification statique de PdiUnifiedApp.tsx : zéro import firebase/auth, zéro onIdTokenChanged, zéro attachSuperAdminTokenMonitor, zéro logoutFirebase / changeUserProfilePassword
    const unifiedAppSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/pdi/app/PdiUnifiedApp.tsx"),
      "utf8"
    );
    expect(unifiedAppSource).not.toContain('from "firebase/auth"');
    expect(unifiedAppSource).not.toContain("onIdTokenChanged");
    expect(unifiedAppSource).not.toContain("attachSuperAdminTokenMonitor");
    expect(unifiedAppSource).not.toContain("logoutFirebase");
    expect(unifiedAppSource).not.toContain("changeUserProfilePassword");
    expect(unifiedAppSource).not.toContain("resolveAuthoritativeWorkspaceSession");

    // 6b. Chargement de PdiAuthPage (tab='login') avec Supabase configuré -> 0 erreur, placeholder corrigé, 0 switch Firebase
    const loginPageHtml = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: true,
      })
    );
    expect(loginPageHtml).toContain('data-testid="pdi-supabase-auth-badge"');
    expect(loginPageHtml).toContain("orthogonaleng@gmail.com");
    expect(loginPageHtml).not.toContain("orthognaleng@gmail.com");
    expect(loginPageHtml).not.toContain("pdi-auth-provider-switch");

    // 6c. Rafraîchissement de session Supabase (TOKEN_REFRESHED) via attachSupabaseAuthMonitor
    const refreshedJwt = makeJwtFor(SUPER_ADMIN_UUID, "orthogonaleng@gmail.com");
    let capturedAuthCallback: ((event: string, session: any) => void) | null = null;
    const unsubscribe = vi.fn();
    const fakeSupabaseClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: string, session: any) => void) => {
          capturedAuthCallback = cb;
          return { data: { subscription: { unsubscribe } } };
        }),
        getSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: refreshedJwt,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as any;

    const onVerified = vi.fn();
    const onRevoked = vi.fn();
    const routedFetch: typeof fetch = (input, init) => {
      const target =
        typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
      return fetch(target, init);
    };

    const cleanup = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeSupabaseClient,
        fetchImpl: routedFetch,
        isConfigured: () => true,
        isSandbox: () => false,
      },
      onSessionVerified: onVerified,
      onSessionRevokedOrSignedOut: onRevoked,
    });

    expect(capturedAuthCallback).not.toBeNull();
    capturedAuthCallback!("TOKEN_REFRESHED", { access_token: refreshedJwt });
    await vi.waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(onVerified.mock.calls[0][0].isSuperAdmin).toBe(true);
    expect(onVerified.mock.calls[0][1]).toBe("TOKEN_REFRESHED");
    expect(onRevoked).not.toHaveBeenCalled();

    // 6d. Ouverture du panneau Super Admin Supabase : zéro dépendance Firebase
    const panelHtml = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanel, {
        currentUserEmail: "orthogonaleng@gmail.com",
        onSwitchModule: vi.fn(),
        fetchOverview: () =>
          fetchSupabaseSuperAdminOverview({
            getClient: () => fakeSupabaseClient,
            fetchImpl: routedFetch,
            isConfigured: () => true,
            isSandbox: () => false,
          }),
      })
    );
    expect(panelHtml).toContain('data-testid="pdi-supabase-super-admin-panel"');

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("9. Accès Super Admin refusé (403) si le rôle super_admin n'est pas confirmé côté serveur — même si l'email correspond à une adresse sensible", async () => {
    // Crée un Gateway de test où un utilisateur ayant l'email exact orthogonaleng@gmail.com a role='client' en base
    const spoofedGateway: SupabaseServerAuthGateway = {
      async verifyAccessTokenAndGetUser(): Promise<BootstrapAuthUserRecord> {
        return {
          id: SPOOF_EMAIL_CLIENT_UUID,
          email: "orthogonaleng@gmail.com",
          email_confirmed_at: new Date().toISOString(),
        };
      },
      async findProfileByUserId(): Promise<BootstrapProfileRecord> {
        return {
          id: SPOOF_EMAIL_CLIENT_UUID,
          email: "orthogonaleng@gmail.com",
          name: "Fake Email Match",
          role: "client", // PAS super_admin côté serveur !
          status: "active",
          account_type: "pro",
          subscription_plan: "monthly",
        };
      },
    };

    const spoofToken = makeJwtFor(SPOOF_EMAIL_CLIENT_UUID, "orthogonaleng@gmail.com", {
      user_metadata: { role: "super_admin", is_super_admin: true },
    });

    const verified = await verifySupabaseSessionFromBearerToken(spoofToken, {
      gateway: spoofedGateway,
      expectedSupabaseUrl: TEST_SUPABASE_URL,
    });
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      // L'email ne confère JAMAIS super_admin : seul public.profiles.role fait foi !
      expect(verified.session.isSuperAdmin).toBe(false);
      expect(verified.session.role).toBe("client");
    }

    // Démarrage d'un serveur avec ce gateway pour vérifier le refus HTTP 403
    const tempServer = await startServer({
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
        supabaseAuthGateway: spoofedGateway,
      },
    });
    try {
      const denied = await fetch(
        `http://127.0.0.1:${tempServer.port}/api/admin/supabase/overview`,
        {
          headers: { Authorization: `Bearer ${spoofToken}` },
        }
      );
      expect(denied.status).toBe(403);
      const body = (await denied.json()) as { code?: string };
      expect(body.code).toBe("auth/forbidden-super-admin");
    } finally {
      await tempServer.close();
    }
  });

  it("10. Non-régression des services Firebase métier encore utilisés et isolation stricte côté serveur", () => {
    // Services Firestore métier toujours exportés et opérationnels
    expect(typeof getFirebaseProfiles).toBe("function");
    expect(typeof getCountryRestrictionsFromFirebase).toBe("function");
    expect(typeof getPaymentTransactionsFromFirebase).toBe("function");
    expect(typeof evaluateClientFirebaseInitGate).toBe("function");
    expect(typeof isStagingSandboxMode).toBe("function");
    expect(typeof createSupabaseServerAuthGateway).toBe("function");

    // Vérification d'isolation : aucun fichier frontend n'importe supabaseSuperAdminIdentityCorrection
    const frontendDirs = ["src/lib", "src/pdi", "src/components"];
    for (const relDir of frontendDirs) {
      const absDir = path.resolve(process.cwd(), relDir);
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (/\.(ts|tsx)$/.test(entry.name)) {
            const content = fs.readFileSync(full, "utf8");
            expect(content).not.toContain("supabaseSuperAdminIdentityCorrection");
          }
        }
      };
      walk(absDir);
    }

    // Google Drive OAuth indépendant préservé
    const googleAuthPath = path.resolve(process.cwd(), "src/lib/googleAuth.ts");
    expect(fs.existsSync(googleAuthPath)).toBe(true);
  });
});
