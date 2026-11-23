/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-03-BOOTSTRAP-01
 * Suite de tests de sécurité & intégration PostgreSQL réelle (PGlite)
 * ============================================================================
 *
 * Couvre les 10 exigences obligatoires de MIG-03-BOOTSTRAP-01 :
 *  1. Seul `orthognaleng@gmail.com` est accepté.
 *  2. Tout autre email est rejeté (`UNAUTHORIZED_EMAIL`).
 *  3. La réexécution ne crée pas de doublon, préserve le profil existant et bloque un 2e super_admin.
 *  4. Aucune requête navigateur ne peut attribuer `super_admin` (couche TS + RLS PostgreSQL réelle).
 *  5. `user_metadata` et `app_metadata` falsifiés (`role: "super_admin"`) n'accordent aucun privilège
 *     (vérification TS + `public.is_super_admin()` PostgreSQL réelle).
 *  6. Un compte non confirmé (`email_confirmed_at IS NULL`) n'obtient pas les privilèges `super_admin`
 *     (Phase 1 + `public.is_super_admin()` PostgreSQL réelle).
 *  7. Un compte confirmé (`email_confirmed_at IS NOT NULL`) avec profil `super_admin` + `active`
 *     passe `verifySupabaseSuperAdminAuthority()` et `public.is_super_admin()` en PostgreSQL réel.
 *  8. Une erreur Supabase en cours de création/activation déclenche un rollback compensatoire
 *     et ne laisse jamais de profil partiellement privilégié.
 *  9. Aucun secret serveur (`SUPABASE_SECRET_KEY`, `sb_secret_*`, etc.) n'est présent dans les
 *     imports client, ni dans le bundle frontend (`dist/assets/*.js`), ni ne déclenche le scanner CI.
 * 10. Le mécanisme de bootstrap est désactivé par défaut et lorsqu'il est à `false` (kill-switch)
 *     ainsi qu'en mode Sandbox.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIG02_MIGRATION_FILES } from "../../db/supabaseSchema";
import {
  createSupabaseAdminClient,
  redactSupabaseSecret,
  SupabaseAdminConfigError,
  validateSupabaseAdminConfig,
} from "../../server/supabaseAdmin";
import {
  AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
  type BootstrapAuditLogInsert,
  type BootstrapAuthUserRecord,
  type BootstrapProfileInsert,
  type BootstrapProfileRecord,
  type BootstrapProfileUpdate,
  bootstrapSupabaseSuperAdmin,
  isSupabaseBootstrapEnabled,
  SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG,
  type SupabaseBootstrapGateway,
  SupabaseBootstrapError,
  verifySupabaseSuperAdminAuthority,
} from "../../server/supabaseSuperAdminBootstrap";
import { parseBootstrapCliArgs, runBootstrapCli } from "../../../scripts/bootstrapSupabaseSuperAdmin";

// Clés synthétiques construites dynamiquement en mémoire (évite tout faux positif scanner secrets)
const SYNTHETIC_SB_SECRET = ["sb", "secret", "mig03test0000000000000001"].join("_");
const SYNTHETIC_SB_PUBLISHABLE = ["sb", "publishable", "mig03test0000000000000001"].join("_");
const SYNTHETIC_SBP_PAT = ["sbp", "mig03testtoken0000000000000001"].join("_");

function makeSyntheticJwt(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase-test" })).toString("base64url");
  return `${header}.${payload}.synthetic_signature_mig03`;
}

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

async function createMigratedPGliteDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_AUTH_BOOTSTRAP_SQL);
  for (const migrationPath of MIGRATION_PATHS) {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    await db.exec(sql);
  }
  return db;
}

async function resetTestDb(db: PGlite): Promise<void> {
  await db.exec(`
    DELETE FROM public.audit_logs;
    DELETE FROM public.profiles;
    DELETE FROM auth.users;
  `);
}

async function runAsAuthenticated<T>(
  db: PGlite,
  userId: string,
  extraJwtClaims: Record<string, unknown>,
  fn: (tx: PGlite) => Promise<T>
): Promise<T> {
  const claims = JSON.stringify({
    sub: userId,
    role: "authenticated",
    ...extraJwtClaims,
  });
  let result!: T;
  await db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE authenticated;`);
    await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    result = await fn(tx as unknown as PGlite);
  });
  return result;
}

/**
 * Passerelle réelle appuyée sur PostgreSQL (PGlite) avec migrations MIG-02 + MIG-02-FIX-01
 * permettant de tester en conditions réelles les contraintes, triggers et RLS.
 */
function createPGliteBootstrapGateway(
  db: PGlite,
  hooks?: {
    failOnInsertProfile?: boolean;
    failOnUpdateProfile?: boolean;
    failOnInsertAuditLog?: boolean;
    failOnPostWriteFindById?: boolean;
  }
): SupabaseBootstrapGateway {
  let postWriteReadCount = 0;

  return {
    async findAuthUserByEmail(email: string): Promise<BootstrapAuthUserRecord | null> {
      const res = await db.query<{
        id: string;
        email: string;
        email_confirmed_at: Date | string | null;
        raw_user_meta_data: Record<string, unknown>;
        raw_app_meta_data: Record<string, unknown>;
      }>(
        `SELECT id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
         FROM auth.users
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [email]
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        email_confirmed_at:
          row.email_confirmed_at instanceof Date
            ? row.email_confirmed_at.toISOString()
            : row.email_confirmed_at,
        user_metadata: row.raw_user_meta_data,
        app_metadata: row.raw_app_meta_data,
      };
    },

    async inviteAuthUserByEmail(email: string): Promise<BootstrapAuthUserRecord> {
      const id = crypto.randomUUID();
      // inviteUserByEmail crée un utilisateur NON confirmé (email_confirmed_at = NULL) et user_metadata = '{}'
      await db.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
         VALUES ($1, $2, NULL, '{}'::jsonb, '{}'::jsonb)`,
        [id, email.toLowerCase()]
      );
      return {
        id,
        email: email.toLowerCase(),
        email_confirmed_at: null,
        user_metadata: {},
        app_metadata: {},
      };
    },

    async deleteAuthUserById(userId: string): Promise<void> {
      await db.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    },

    async listSuperAdminProfiles(): Promise<BootstrapProfileRecord[]> {
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company
         FROM public.profiles
         WHERE role = 'super_admin'`
      );
      return res.rows;
    },

    async findProfileById(id: string): Promise<BootstrapProfileRecord | null> {
      postWriteReadCount += 1;
      if (hooks?.failOnPostWriteFindById && postWriteReadCount >= 2) {
        throw new Error("Simulated post-write profile verification failure");
      }
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company
         FROM public.profiles
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      return res.rows[0] ?? null;
    },

    async findProfileByEmail(email: string): Promise<BootstrapProfileRecord | null> {
      const res = await db.query<BootstrapProfileRecord>(
        `SELECT id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company
         FROM public.profiles
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [email]
      );
      return res.rows[0] ?? null;
    },

    async insertProfile(record: BootstrapProfileInsert): Promise<BootstrapProfileRecord> {
      if (hooks?.failOnInsertProfile) {
        throw new Error(`Simulated profiles.insert failure with leaked ${SYNTHETIC_SB_SECRET}`);
      }
      const res = await db.query<BootstrapProfileRecord>(
        `INSERT INTO public.profiles (id, email, name, display_name, role, status, account_type, subscription_plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company`,
        [
          record.id,
          record.email,
          record.name,
          record.display_name ?? record.name,
          record.role,
          record.status,
          record.account_type ?? "basic",
          record.subscription_plan ?? "monthly",
        ]
      );
      return res.rows[0];
    },

    async updateProfile(
      id: string,
      patch: BootstrapProfileUpdate
    ): Promise<BootstrapProfileRecord> {
      if (hooks?.failOnUpdateProfile) {
        throw new Error("Simulated profiles.update failure");
      }
      const res = await db.query<BootstrapProfileRecord>(
        `UPDATE public.profiles
         SET role = COALESCE($2, role),
             status = COALESCE($3, status)
         WHERE id = $1
         RETURNING id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company`,
        [id, patch.role ?? null, patch.status ?? null]
      );
      return res.rows[0];
    },

    async deleteProfile(id: string): Promise<void> {
      await db.query(`DELETE FROM public.profiles WHERE id = $1`, [id]);
    },

    async insertAuditLog(entry: BootstrapAuditLogInsert): Promise<{ id: string }> {
      if (hooks?.failOnInsertAuditLog) {
        throw new Error("Simulated audit_logs.insert failure");
      }
      const res = await db.query<{ id: string }>(
        `INSERT INTO public.audit_logs (actor_user_id, target_user_id, event_type, resource_type, resource_id, severity, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id`,
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
      return { id: res.rows[0].id };
    },
  };
}

const ENABLED_ENV: Record<string, string | undefined> = {
  NODE_ENV: "production",
  PDI_ENV: "production",
  [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "true",
};

describe("MIG-03-BOOTSTRAP-01 — Création sécurisée du premier super administrateur Supabase", () => {
  let sharedDb: PGlite;

  beforeAll(async () => {
    sharedDb = await createMigratedPGliteDb();
  }, 30000);

  afterAll(async () => {
    if (sharedDb) {
      await sharedDb.close();
    }
  });

  describe("0. Client Supabase Admin strictement serveur (src/server/supabaseAdmin.ts)", () => {
    it("refuse toute initialisation dans un contexte navigateur", () => {
      expect(() =>
        validateSupabaseAdminConfig(
          {
            SUPABASE_URL: "https://example-project.supabase.co",
            SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
          },
          { isBrowserRuntime: true }
        )
      ).toThrowError(SupabaseAdminConfigError);

      try {
        validateSupabaseAdminConfig(
          {
            SUPABASE_URL: "https://example-project.supabase.co",
            SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
          },
          { isBrowserRuntime: true }
        );
      } catch (err) {
        expect((err as SupabaseAdminConfigError).code).toBe("BROWSER_CONTEXT_FORBIDDEN");
      }
    });

    it("refuse toute clé secrète placée dans une variable VITE_*", () => {
      const forbiddenViteEnvKey = ["VITE", "SUPABASE", "SECRET", "KEY"].join("_");
      expect(() =>
        validateSupabaseAdminConfig({
          SUPABASE_URL: "https://example-project.supabase.co",
          SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
          [forbiddenViteEnvKey]: SYNTHETIC_SB_SECRET,
        })
      ).toThrowError(SupabaseAdminConfigError);

      expect(() =>
        validateSupabaseAdminConfig({
          SUPABASE_URL: "https://example-project.supabase.co",
          SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
          VITE_RANDOM_VAR: SYNTHETIC_SB_SECRET,
        })
      ).toThrowError(SupabaseAdminConfigError);
    });

    it("rejette sb_publishable_*, sbp_* et un JWT anon ; accepte sb_secret_* et JWT service_role", () => {
      const base = { SUPABASE_URL: "https://example-project.supabase.co" };

      expect(() =>
        validateSupabaseAdminConfig({ ...base, SUPABASE_SECRET_KEY: SYNTHETIC_SB_PUBLISHABLE })
      ).toThrowError(/publishable/i);

      expect(() =>
        validateSupabaseAdminConfig({ ...base, SUPABASE_SECRET_KEY: SYNTHETIC_SBP_PAT })
      ).toThrowError(/Personal Access Token/i);

      expect(() =>
        validateSupabaseAdminConfig({ ...base, SUPABASE_SECRET_KEY: makeSyntheticJwt("anon") })
      ).toThrowError(/non autorisé/i);

      const validModern = validateSupabaseAdminConfig({
        ...base,
        SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
      });
      expect(validModern.keyFormat).toBe("sb_secret");
      expect(validModern.url).toBe("https://example-project.supabase.co");

      const validJwt = validateSupabaseAdminConfig({
        ...base,
        SUPABASE_SECRET_KEY: makeSyntheticJwt("service_role"),
      });
      expect(validJwt.keyFormat).toBe("service_role_jwt");

      const handle = createSupabaseAdminClient({
        ...base,
        SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
      });
      expect(handle.url).toBe("https://example-project.supabase.co");
      expect(handle.keyFormat).toBe("sb_secret");
      expect(handle.client).toBeDefined();
    });

    it("masque toujours les clés secrètes et JWT dans les messages d'erreur", () => {
      const raw = `Error with ${SYNTHETIC_SB_SECRET}, ${SYNTHETIC_SBP_PAT}, and ${makeSyntheticJwt("service_role")}`;
      const sanitized = redactSupabaseSecret(raw);
      expect(sanitized).not.toContain(SYNTHETIC_SB_SECRET);
      expect(sanitized).not.toContain(SYNTHETIC_SBP_PAT);
      expect(sanitized).not.toContain("eyJ");
      expect(sanitized).toContain("[REDACTED_SUPABASE_SECRET]");
      expect(sanitized).toContain("[REDACTED_SUPABASE_PAT]");
      expect(sanitized).toContain("[REDACTED_JWT]");
    });
  });

  describe("1 & 2. Restriction exclusive à orthognaleng@gmail.com et rejet de tout autre email", () => {
    beforeAll(async () => {
      await resetTestDb(sharedDb);
    });

    it("1. accepte uniquement orthognaleng@gmail.com (insensible à la casse/espaces)", async () => {
      const gateway = createPGliteBootstrapGateway(sharedDb);
      const dryRunResult = await bootstrapSupabaseSuperAdmin({
        gateway,
        env: ENABLED_ENV,
        targetEmail: "  ORTHOGNALENG@GMAIL.COM  ",
        dryRun: true,
        requestContext: { source: "server_cli" },
      });

      expect(dryRunResult.ok).toBe(true);
      expect(dryRunResult.targetEmail).toBe(AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL);
      expect(dryRunResult.phase).toBe("dry_run_would_invite_and_provision_pending");
      expect(dryRunResult.privilegesEffective).toBe(false);
    });

    it("2. rejette strictement tout autre email avant toute opération base/API", async () => {
      const gateway = createPGliteBootstrapGateway(sharedDb);
      const unauthorizedEmails = [
        "admin@orthogonal-pdi.com",
        "orthogonaleng@gmail.com", // orthographe proche mais différente
        "attacker@gmail.com",
        "orthognaleng@gmail.com.evil.test",
        "",
      ];

      for (const badEmail of unauthorizedEmails) {
        await expect(
          bootstrapSupabaseSuperAdmin({
            gateway,
            env: ENABLED_ENV,
            targetEmail: badEmail,
            dryRun: false,
            requestContext: { source: "server_cli" },
          })
        ).rejects.toSatisfy(
          (err: unknown) =>
            err instanceof SupabaseBootstrapError && err.code === "UNAUTHORIZED_EMAIL"
        );
      }

      const authCount = await sharedDb.query<{ count: string }>(`SELECT count(*) FROM auth.users`);
      const profileCount = await sharedDb.query<{ count: string }>(
        `SELECT count(*) FROM public.profiles`
      );
      expect(Number(authCount.rows[0].count)).toBe(0);
      expect(Number(profileCount.rows[0].count)).toBe(0);
    });
  });

  describe("3, 5, 6 & 7. Flux réel en 2 phases sur PostgreSQL (PGlite) : confirmation email, idempotence, anti-doublon et metadata falsifiées", () => {
    let superAdminUserId: string;

    beforeAll(async () => {
      await resetTestDb(sharedDb);
    });

    it("6. Phase 1 : un compte invité non confirmé n'obtient AUCUN privilège super_admin (ni en TS ni dans public.is_super_admin())", async () => {
      const gateway = createPGliteBootstrapGateway(sharedDb);

      const phase1 = await bootstrapSupabaseSuperAdmin({
        gateway,
        env: ENABLED_ENV,
        targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
        dryRun: false,
        operatorId: "sec-operator-1",
        requestContext: { source: "server_cli" },
      });

      expect(phase1.ok).toBe(true);
      expect(phase1.phase).toBe("awaiting_email_confirmation");
      expect(phase1.emailConfirmed).toBe(false);
      expect(phase1.profileRole).toBe("client");
      expect(phase1.profileStatus).toBe("pending_activation");
      expect(phase1.privilegesEffective).toBe(false);
      expect(phase1.userId).toBeTruthy();
      expect(phase1.auditLogId).toBeTruthy();
      superAdminUserId = phase1.userId!;

      // Même si le bootstrap est relancé avant confirmation email, aucune promotion n'est accordée
      const phase1Repeat = await bootstrapSupabaseSuperAdmin({
        gateway,
        env: ENABLED_ENV,
        targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
        dryRun: false,
        requestContext: { source: "server_cli" },
      });
      expect(phase1Repeat.phase).toBe("awaiting_email_confirmation");
      expect(phase1Repeat.profileRole).toBe("client");
      expect(phase1Repeat.privilegesEffective).toBe(false);

      // Vérification réelle en PostgreSQL via public.is_super_admin()
      const pgCheck = await runAsAuthenticated(sharedDb, superAdminUserId, {}, async (tx) => {
        const res = await tx.query<{ is_sa: boolean }>(`SELECT public.is_super_admin() AS is_sa`);
        return res.rows[0].is_sa;
      });
      expect(pgCheck).toBe(false);
    });

    it("5. user_metadata et app_metadata falsifiés ({ role: 'super_admin' }) n'accordent AUCUN privilège (TS + PostgreSQL réel)", async () => {
      // Injection malveillante dans raw_user_meta_data, raw_app_meta_data et JWT claims
      await sharedDb.query(
        `UPDATE auth.users
         SET raw_user_meta_data = '{"role":"super_admin","is_super_admin":true}'::jsonb,
             raw_app_meta_data = '{"role":"super_admin","claims_admin":true}'::jsonb
         WHERE id = $1`,
        [superAdminUserId]
      );

      // Vérification TS autoritative
      const authCheck = verifySupabaseSuperAdminAuthority({
        authUser: {
          id: superAdminUserId,
          email: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          email_confirmed_at: null,
          user_metadata: { role: "super_admin", status: "active" },
          app_metadata: { role: "super_admin", status: "active" },
        },
        profile: {
          id: superAdminUserId,
          email: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          name: "Orthogonal Super Admin",
          role: "client",
          status: "pending_activation",
        },
      });
      expect(authCheck.isEffectiveSuperAdmin).toBe(false);
      expect(authCheck.reasons).toContain("EMAIL_NOT_CONFIRMED");

      // Vérification PostgreSQL réelle avec claims JWT falsifiés (user_metadata + app_metadata)
      const pgCheckForgedJwt = await runAsAuthenticated(
        sharedDb,
        superAdminUserId,
        {
          user_metadata: { role: "super_admin", is_super_admin: true },
          app_metadata: { role: "super_admin", is_super_admin: true },
        },
        async (tx) => {
          const res = await tx.query<{ is_sa: boolean }>(`SELECT public.is_super_admin() AS is_sa`);
          return res.rows[0].is_sa;
        }
      );
      expect(pgCheckForgedJwt).toBe(false);

      // Même si quelqu'un forçait en DB role='super_admin' & status='active' SANS email_confirmed_at,
      // public.is_super_admin() DOIT toujours retourner FALSE !
      await sharedDb.query(
        `UPDATE public.profiles SET role = 'super_admin', status = 'active' WHERE id = $1`,
        [superAdminUserId]
      );
      const pgCheckUnconfirmedSuperAdmin = await runAsAuthenticated(
        sharedDb,
        superAdminUserId,
        {},
        async (tx) => {
          const res = await tx.query<{ is_sa: boolean }>(`SELECT public.is_super_admin() AS is_sa`);
          return res.rows[0].is_sa;
        }
      );
      expect(pgCheckUnconfirmedSuperAdmin).toBe(false);

      // Remise à l'état Phase 1 (client / pending_activation) + enrichissement profil existant pour tester préservation
      await sharedDb.query(
        `UPDATE public.profiles
         SET role = 'client',
             status = 'pending_activation',
             company = 'Orthogonal Engineering',
             firebase_uid = 'legacy_fb_super_admin_uid_001'
         WHERE id = $1`,
        [superAdminUserId]
      );
    });

    it("7. Phase 2 : après confirmation réelle de l'email, active super_admin, préserve les données existantes et passe public.is_super_admin() = true", async () => {
      // Simulation de la confirmation réelle de l'email par l'utilisateur dans Gmail
      await sharedDb.query(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1`, [
        superAdminUserId,
      ]);

      const gateway = createPGliteBootstrapGateway(sharedDb);
      const phase2 = await bootstrapSupabaseSuperAdmin({
        gateway,
        env: ENABLED_ENV,
        targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
        dryRun: false,
        operatorId: "sec-operator-1",
        requestContext: { source: "server_cli" },
      });

      expect(phase2.ok).toBe(true);
      expect(phase2.phase).toBe("activated");
      expect(phase2.emailConfirmed).toBe(true);
      expect(phase2.profileRole).toBe("super_admin");
      expect(phase2.profileStatus).toBe("active");
      expect(phase2.privilegesEffective).toBe(true);
      expect(phase2.auditLogId).toBeTruthy();

      // Vérifie que les champs existants du profil n'ont PAS été écrasés
      const profileRow = await sharedDb.query<{
        role: string;
        status: string;
        company: string | null;
        firebase_uid: string | null;
      }>(`SELECT role, status, company, firebase_uid FROM public.profiles WHERE id = $1`, [
        superAdminUserId,
      ]);
      expect(profileRow.rows[0]).toEqual({
        role: "super_admin",
        status: "active",
        company: "Orthogonal Engineering",
        firebase_uid: "legacy_fb_super_admin_uid_001",
      });

      // Vérification réelle en PostgreSQL via public.is_super_admin() -> TRUE !
      const pgCheckConfirmed = await runAsAuthenticated(
        sharedDb,
        superAdminUserId,
        {},
        async (tx) => {
          const res = await tx.query<{ is_sa: boolean }>(`SELECT public.is_super_admin() AS is_sa`);
          return res.rows[0].is_sa;
        }
      );
      expect(pgCheckConfirmed).toBe(true);

      // Vérification de la trace dans public.audit_logs
      const auditRes = await sharedDb.query<{ event_type: string; severity: string }>(
        `SELECT event_type, severity FROM public.audit_logs WHERE id = $1`,
        [phase2.auditLogId]
      );
      expect(auditRes.rows[0]).toEqual({
        event_type: "supabase.super_admin.bootstrap.activated",
        severity: "critical",
      });
    });

    it("3. Réexécution idempotente : aucun doublon, aucune rétrogradation, et blocage si un autre super_admin existe", async () => {
      const gateway = createPGliteBootstrapGateway(sharedDb);

      const repeat = await bootstrapSupabaseSuperAdmin({
        gateway,
        env: ENABLED_ENV,
        targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
        dryRun: false,
        requestContext: { source: "server_cli" },
      });
      expect(repeat.phase).toBe("already_active");
      expect(repeat.privilegesEffective).toBe(true);
      expect(repeat.userId).toBe(superAdminUserId);

      // Aucun doublon dans auth.users ni dans public.profiles
      const authCount = await sharedDb.query<{ count: string }>(`SELECT count(*) FROM auth.users`);
      const profileCount = await sharedDb.query<{ count: string }>(
        `SELECT count(*) FROM public.profiles`
      );
      expect(Number(authCount.rows[0].count)).toBe(1);
      expect(Number(profileCount.rows[0].count)).toBe(1);

      // Test du blocage multiple super_admin sur base réinitialisée
      await resetTestDb(sharedDb);
      const otherId = crypto.randomUUID();
      await sharedDb.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'other-admin@example.com', now())`,
        [otherId]
      );
      await sharedDb.query(
        `INSERT INTO public.profiles (id, email, name, role, status)
         VALUES ($1, 'other-admin@example.com', 'Other Admin', 'super_admin', 'active')`,
        [otherId]
      );

      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway: createPGliteBootstrapGateway(sharedDb),
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          dryRun: false,
          requestContext: { source: "server_cli" },
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError &&
          err.code === "MULTIPLE_SUPER_ADMINS_FORBIDDEN"
      );
    });

    it("refuse de réactiver automatiquement un profil suspended / revoked / disabled", async () => {
      for (const blockedStatus of ["suspended", "revoked", "disabled"] as const) {
        await resetTestDb(sharedDb);
        const uid = crypto.randomUUID();
        await sharedDb.query(
          `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, $2, now())`,
          [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
        );
        await sharedDb.query(
          `INSERT INTO public.profiles (id, email, name, role, status)
           VALUES ($1, $2, 'Blocked Admin', 'client', $3)`,
          [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL, blockedStatus]
        );

        await expect(
          bootstrapSupabaseSuperAdmin({
            gateway: createPGliteBootstrapGateway(sharedDb),
            env: ENABLED_ENV,
            targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
            dryRun: false,
            requestContext: { source: "server_cli" },
          })
        ).rejects.toSatisfy(
          (err: unknown) =>
            err instanceof SupabaseBootstrapError &&
            err.code === "NEGATIVE_PROFILE_STATUS_BLOCKED"
        );
      }
    });
  });

  describe("4. Rejet absolu de toute requête navigateur / attribution cliente du rôle super_admin", () => {
    it("4a. bloque toute exécution depuis un contexte navigateur ou une requête portant un rôle client", async () => {
      await resetTestDb(sharedDb);
      const gateway = createPGliteBootstrapGateway(sharedDb);

      // Contexte navigateur simulé
      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway,
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          isBrowserRuntime: true,
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError && err.code === "BROWSER_CONTEXT_FORBIDDEN"
      );

      // Requête HTTP client / navigateur avec Origin ou clientRequestedRole: 'super_admin'
      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway,
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          requestContext: {
            source: "browser",
            origin: "https://evil.example.com",
            clientRequestedRole: "super_admin",
          },
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError && err.code === "BROWSER_REQUEST_FORBIDDEN"
      );

      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway,
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          requestContext: {
            source: "server_internal",
            clientRequestedRole: "super_admin",
          },
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError && err.code === "BROWSER_REQUEST_FORBIDDEN"
      );
    });

    it("4b. en PostgreSQL réel (RLS + trigger), un utilisateur authentifié (même orthognaleng@gmail.com) ne peut PAS s'auto-attribuer super_admin", async () => {
      await resetTestDb(sharedDb);
      const uid = crypto.randomUUID();
      await sharedDb.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, $2, now())`,
        [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
      );

      // Tentative 1 : INSERT client avec role = 'super_admin' -> bloqué par RLS / trigger 42501
      await expect(
        runAsAuthenticated(sharedDb, uid, {}, async (tx) => {
          await tx.query(
            `INSERT INTO public.profiles (id, email, name, role, status)
             VALUES ($1, $2, 'Self Escalation', 'super_admin', 'active')`,
            [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
          );
        })
      ).rejects.toThrow();

      // Insertion légitime en client/pending_activation puis tentative UPDATE -> bloqué par trigger 42501
      await runAsAuthenticated(sharedDb, uid, {}, async (tx) => {
        await tx.query(
          `INSERT INTO public.profiles (id, email, name, role, status)
           VALUES ($1, $2, 'Normal User', 'client', 'pending_activation')`,
          [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
        );
      });

      await expect(
        runAsAuthenticated(sharedDb, uid, {}, async (tx) => {
          await tx.query(
            `UPDATE public.profiles SET role = 'super_admin', status = 'active' WHERE id = $1`,
            [uid]
          );
        })
      ).rejects.toThrow(/privileged or server-managed/i);
    });
  });

  describe("8. Rollback compensatoire sur erreur Supabase : aucun profil partiellement privilégié", () => {
    it("8a. Phase 1 : si profiles.insert échoue après inviteAuthUserByEmail, supprime l'utilisateur auth.users créé et masque le secret", async () => {
      await resetTestDb(sharedDb);
      const failingGateway = createPGliteBootstrapGateway(sharedDb, {
        failOnInsertProfile: true,
      });

      let caughtError: unknown = null;
      try {
        await bootstrapSupabaseSuperAdmin({
          gateway: failingGateway,
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          dryRun: false,
          requestContext: { source: "server_cli" },
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(SupabaseBootstrapError);
      expect((caughtError as SupabaseBootstrapError).code).toBe("SUPABASE_API_ERROR");
      expect((caughtError as SupabaseBootstrapError).details?.rolledBack).toBe(true);
      // Aucune fuite de secret dans le message d'erreur
      expect((caughtError as Error).message).not.toContain(SYNTHETIC_SB_SECRET);

      // Vérifie que auth.users ET public.profiles sont vides (rollback complet)
      const authCount = await sharedDb.query<{ count: string }>(`SELECT count(*) FROM auth.users`);
      const profileCount = await sharedDb.query<{ count: string }>(
        `SELECT count(*) FROM public.profiles`
      );
      expect(Number(authCount.rows[0].count)).toBe(0);
      expect(Number(profileCount.rows[0].count)).toBe(0);
    });

    it("8b. Phase 2 : si audit_logs.insert échoue après promotion en super_admin, restaure le profil précédent (client / pending_activation)", async () => {
      await resetTestDb(sharedDb);
      const uid = crypto.randomUUID();
      await sharedDb.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, $2, now())`,
        [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
      );
      await sharedDb.query(
        `INSERT INTO public.profiles (id, email, name, role, status)
         VALUES ($1, $2, 'Orthogonal Super Admin', 'client', 'pending_activation')`,
        [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
      );

      const failingAuditGateway = createPGliteBootstrapGateway(sharedDb, {
        failOnInsertAuditLog: true,
      });

      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway: failingAuditGateway,
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          dryRun: false,
          requestContext: { source: "server_cli" },
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError &&
          err.code === "SUPABASE_API_ERROR" &&
          err.details?.rolledBack === true
      );

      // Vérifie que le profil a été strictement restauré à client / pending_activation (aucun privilège laissé)
      const profileRow = await sharedDb.query<{ role: string; status: string }>(
        `SELECT role, status FROM public.profiles WHERE id = $1`,
        [uid]
      );
      expect(profileRow.rows[0]).toEqual({
        role: "client",
        status: "pending_activation",
      });

      const isSa = await runAsAuthenticated(sharedDb, uid, {}, async (tx) => {
        const r = await tx.query<{ is_sa: boolean }>(`SELECT public.is_super_admin() AS is_sa`);
        return r.rows[0].is_sa;
      });
      expect(isSa).toBe(false);
    });

    it("8c. Phase 2 (nouveau profil) : si la vérification post-écriture échoue, supprime le profil créé", async () => {
      await resetTestDb(sharedDb);
      const uid = crypto.randomUUID();
      await sharedDb.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, $2, now())`,
        [uid, AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL]
      );

      const failingPostReadGateway = createPGliteBootstrapGateway(sharedDb, {
        failOnPostWriteFindById: true,
      });

      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway: failingPostReadGateway,
          env: ENABLED_ENV,
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          dryRun: false,
          requestContext: { source: "server_cli" },
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError &&
          err.code === "SUPABASE_API_ERROR" &&
          err.details?.rolledBack === true
      );

      const profileCount = await sharedDb.query<{ count: string }>(
        `SELECT count(*) FROM public.profiles`
      );
      expect(Number(profileCount.rows[0].count)).toBe(0);
    });
  });

  describe("9. Zéro fuite de secret serveur dans les fichiers frontend, le bundle Vite et le scanner CI", () => {
    it("9a. aucun fichier frontend (src/lib, src/components, src/pdi, src/App.tsx, src/main.tsx) n'importe src/server/supabaseAdmin ou supabaseSuperAdminBootstrap", () => {
      const clientRoots = [
        path.resolve(process.cwd(), "src/App.tsx"),
        path.resolve(process.cwd(), "src/main.tsx"),
        path.resolve(process.cwd(), "src/lib"),
        path.resolve(process.cwd(), "src/components"),
        path.resolve(process.cwd(), "src/pdi"),
      ];

      const collectFiles = (target: string): string[] => {
        if (!fs.existsSync(target)) return [];
        const stat = fs.statSync(target);
        if (stat.isFile()) return [target];
        const results: string[] = [];
        for (const entry of fs.readdirSync(target)) {
          results.push(...collectFiles(path.join(target, entry)));
        }
        return results;
      };

      const clientFiles = clientRoots
        .flatMap(collectFiles)
        .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));

      expect(clientFiles.length).toBeGreaterThan(0);

      for (const file of clientFiles) {
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toContain("supabaseAdmin");
        expect(content).not.toContain("supabaseSuperAdminBootstrap");
        expect(content).not.toContain("SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED");
      }
    });

    it("9b. les fichiers MIG-03 créés ne déclenchent aucun faux positif dans les règles du scanner .github/workflows/security.yml", () => {
      const scannerSbSecretRegex = /sb_secret_[0-9a-zA-Z_-]{16,}/;
      const scannerSbpRegex = /sbp_[0-9a-zA-Z]{20,}/;
      const scannerViteSecretAssignmentRegex =
        /VITE_SUPABASE_(SECRET|SERVICE_ROLE)_KEY\s*=\s*['"]?[0-9a-zA-Z_.-]{8,}/;

      const mig03Files = [
        "src/server/supabaseAdmin.ts",
        "src/server/supabaseSuperAdminBootstrap.ts",
        "scripts/bootstrapSupabaseSuperAdmin.ts",
        "src/security/tests/mig03SupabaseBootstrap.spec.ts",
        ".env.example",
        "MIG-03-BOOTSTRAP.md",
      ];

      for (const relPath of mig03Files) {
        const absPath = path.resolve(process.cwd(), relPath);
        if (!fs.existsSync(absPath)) continue;
        const content = fs.readFileSync(absPath, "utf-8");
        expect(scannerSbSecretRegex.test(content), `sb_secret_ detected in ${relPath}`).toBe(false);
        expect(scannerSbpRegex.test(content), `sbp_ detected in ${relPath}`).toBe(false);
        expect(
          scannerViteSecretAssignmentRegex.test(content),
          `VITE secret assignment detected in ${relPath}`
        ).toBe(false);
      }
    });

    it("9c. le bundle Vite compilé (dist/assets/*.js) ne contient aucun secret ni symbole serveur de bootstrap", () => {
      const distAssetsDir = path.resolve(process.cwd(), "dist/assets");
      if (!fs.existsSync(distAssetsDir)) {
        const envExample = fs.readFileSync(path.resolve(process.cwd(), ".env.example"), "utf-8");
        expect(envExample).toContain("SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false");
        expect(envExample).not.toContain(["VITE", "SUPABASE", "SECRET", "KEY"].join("_"));
        return;
      }

      const jsFiles = fs
        .readdirSync(distAssetsDir)
        .filter((name) => name.endsWith(".js"))
        .map((name) => path.join(distAssetsDir, name));

      expect(jsFiles.length).toBeGreaterThan(0);

      for (const bundleFile of jsFiles) {
        const content = fs.readFileSync(bundleFile, "utf-8");
        expect(content).not.toMatch(/sb_secret_[0-9a-zA-Z_-]{16,}/);
        expect(content).not.toContain("SUPABASE_SECRET_KEY");
        expect(content).not.toContain("SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED");
        expect(content).not.toContain("bootstrapSupabaseSuperAdmin");
        expect(content).not.toContain("createSupabaseAdminClient");
      }
    });
  });

  describe("10. Désactivation du mécanisme (kill-switch fail-closed, Sandbox, CLI)", () => {
    it("10a. est désactivé par défaut et pour toute valeur autre que la chaîne exacte 'true'", async () => {
      await resetTestDb(sharedDb);
      expect(isSupabaseBootstrapEnabled({})).toBe(false);
      expect(isSupabaseBootstrapEnabled({ [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "" })).toBe(
        false
      );
      expect(
        isSupabaseBootstrapEnabled({ [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "false" })
      ).toBe(false);
      expect(isSupabaseBootstrapEnabled({ [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "1" })).toBe(
        false
      );
      expect(
        isSupabaseBootstrapEnabled({ [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "TRUE" })
      ).toBe(false);
      expect(
        isSupabaseBootstrapEnabled({ [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "true" })
      ).toBe(true);

      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway: createPGliteBootstrapGateway(sharedDb),
          env: { NODE_ENV: "production", [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "false" },
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          dryRun: false,
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError && err.code === "BOOTSTRAP_DISABLED"
      );
    });

    it("10b. est bloqué en mode Sandbox (PDI_ENV=sandbox)", async () => {
      await resetTestDb(sharedDb);
      await expect(
        bootstrapSupabaseSuperAdmin({
          gateway: createPGliteBootstrapGateway(sharedDb),
          env: {
            NODE_ENV: "development",
            PDI_ENV: "sandbox",
            [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "true",
          },
          targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
          dryRun: true,
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof SupabaseBootstrapError && err.code === "SANDBOX_MODE_FORBIDDEN"
      );
    });

    it("10c. le CLI par défaut s'exécute en --dry-run, rejette les options inconnues et retourne code 1 quand le kill-switch est désactivé", async () => {
      expect(parseBootstrapCliArgs([])).toEqual({
        dryRun: true,
        targetEmail: AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
        operatorId: "server-cli",
        redirectTo: undefined,
      });

      expect(() => parseBootstrapCliArgs(["--dry-run", "--execute"])).toThrow(/exclusives/i);
      expect(() => parseBootstrapCliArgs(["--unknown-flag"])).toThrow(/non autorisé/i);

      const exitCode = await runBootstrapCli(["--execute"], {
        NODE_ENV: "production",
        SUPABASE_URL: "https://example-project.supabase.co",
        SUPABASE_SECRET_KEY: SYNTHETIC_SB_SECRET,
        [SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENV_FLAG]: "false",
      });
      expect(exitCode).toBe(1);
    });
  });
});
