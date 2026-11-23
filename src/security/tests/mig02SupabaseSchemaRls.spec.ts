/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * MIG-02 — SUITE DE TESTS RÉELS POSTGRESQL (PGlite) : SCHÉMA, CONTRAINTES, RLS & COMPATIBILITÉ
 *
 * Exécute les migrations SQL versionnées de `supabase/migrations/` sur une instance
 * PostgreSQL réelle isolée en mémoire (`@electric-sql/pglite`, zéro production, zéro réseau)
 * avec simulation fidèle du schéma `auth` Supabase (`auth.users`, `auth.uid()`, `auth.role()`,
 * `auth.jwt()`) et des rôles PostgreSQL (`anon`, `authenticated`, `service_role`).
 *
 * Couvre les 10 axes obligatoires MIG-02 :
 *  1. Création du schéma (12 tables, index, triggers, RLS activé et forcé)
 *  2. Intégrité des clés étrangères
 *  3. Unicité des identifiants
 *  4. Isolation des données entre deux utilisateurs distincts (User A vs User B)
 *  5. Protection des rôles privilégiés (`super_admin` / `admin`)
 *  6. Protection des données de paiement, abonnements et licences
 *  7. Refus des accès non authentifiés (`anon`)
 *  8. Refus des modifications non autorisées (journaux, feedback, membres projet)
 *  9. Fonctionnement complet des politiques RLS (`anon`, `User A`, `User B`, `super_admin`, `service_role`)
 * 10. Compatibilité du schéma avec les données héritées PostgreSQL et Firestore
 */

import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MIG02_MIGRATION_FILES,
  MIG02_RLS_PROTECTED_TABLES,
  MIG02_SUPABASE_TABLES,
  mapLegacyFirestoreProfileToSupabaseRecord,
  mapLegacyPostgresProjectToSupabaseRecord,
} from "../../db/supabaseSchema";

const USER_A_ID = "11111111-1111-4111-8111-111111111111";
const USER_B_ID = "22222222-2222-4222-8222-222222222222";
const USER_C_ID = "33333333-3333-4333-8333-333333333333";
const SUPER_ADMIN_ID = "99999999-9999-4999-8999-999999999999";
const UNVERIFIED_ADMIN_ID = "88888888-8888-4888-8888-888888888888";

const MIGRATION_01_PATH = path.resolve(process.cwd(), MIG02_MIGRATION_FILES[0]);
const MIGRATION_02_PATH = path.resolve(process.cwd(), MIG02_MIGRATION_FILES[1]);

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
  END
  $$;

  CREATE SCHEMA IF NOT EXISTS auth;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA auth TO authenticated, service_role;

  CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
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

  GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
`;

async function createMigratedTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_AUTH_BOOTSTRAP_SQL);
  const sql01 = fs.readFileSync(MIGRATION_01_PATH, "utf-8");
  const sql02 = fs.readFileSync(MIGRATION_02_PATH, "utf-8");
  await db.exec(sql01);
  await db.exec(sql02);
  return db;
}

async function runAsAnon<T>(db: PGlite, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  let result!: T;
  await db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE anon; SET LOCAL request.jwt.claims = '{"role":"anon"}';`);
    result = await fn(tx as unknown as PGlite);
  });
  return result;
}

async function runAsAuthenticated<T>(
  db: PGlite,
  userId: string,
  fn: (tx: PGlite) => Promise<T>,
  extraClaims: Record<string, unknown> = {}
): Promise<T> {
  let result!: T;
  const claims = JSON.stringify({
    sub: userId,
    role: "authenticated",
    ...extraClaims,
  });
  await db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE authenticated;`);
    await tx.query(`SELECT set_config('request.jwt.claims', $1, true);`, [claims]);
    result = await fn(tx as unknown as PGlite);
  });
  return result;
}

async function runAsServiceRole<T>(db: PGlite, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  let result!: T;
  await db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE service_role; SET LOCAL request.jwt.claims = '{"role":"service_role"}';`);
    result = await fn(tx as unknown as PGlite);
  });
  return result;
}

describe("MIG-02 : Schéma PostgreSQL Supabase, Migrations SQL & Sécurité RLS réelle (PGlite)", () => {
  let db: PGlite;
  let projectAId: string;
  let projectBId: string;
  let fileAId: string;
  let paymentAId: string;
  let subscriptionAId: string;
  let licenseKeyAId: string;
  let feedbackAId: string;

  beforeAll(async () => {
    db = await createMigratedTestDb();

    // Seed auth.users + profiles + baseline business data via service_role (autorité serveur)
    await db.query(
      `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
        ($1, 'alice@orthogonal-test.local', now()),
        ($2, 'bob@orthogonal-test.local', now()),
        ($3, 'charlie@orthogonal-test.local', now()),
        ($4, 'superadmin@orthogonal-test.local', now()),
        ($5, 'unverified-admin@orthogonal-test.local', NULL)`,
      [USER_A_ID, USER_B_ID, USER_C_ID, SUPER_ADMIN_ID, UNVERIFIED_ADMIN_ID]
    );

    await runAsServiceRole(db, async (tx) => {
      await tx.query(
        `INSERT INTO public.profiles (id, firebase_uid, email, name, role, account_type, subscription_plan, status)
         VALUES
          ($1, 'fb_uid_alice_001', 'alice@orthogonal-test.local', 'Alice Ingénieure', 'client', 'pro', 'yearly', 'active'),
          ($2, 'fb_uid_bob_002', 'bob@orthogonal-test.local', 'Bob Tuyauteur', 'client', 'basic', 'monthly', 'active'),
          ($3, 'fb_uid_super_999', 'superadmin@orthogonal-test.local', 'Super Admin Vérifié', 'super_admin', 'enterprise', 'lifetime', 'active'),
          ($4, 'fb_uid_unverified_888', 'unverified-admin@orthogonal-test.local', 'Admin Non Vérifié', 'super_admin', 'enterprise', 'lifetime', 'active')`,
        [USER_A_ID, USER_B_ID, SUPER_ADMIN_ID, UNVERIFIED_ADMIN_ID]
      );

      await tx.query(
        `INSERT INTO public.user_identity_mappings (supabase_user_id, firebase_uid, firebase_email, migration_status, migrated_at)
         VALUES
          ($1, 'fb_uid_alice_001', 'alice@orthogonal-test.local', 'verified', now()),
          ($2, 'fb_uid_bob_002', 'bob@orthogonal-test.local', 'pending', NULL)`,
        [USER_A_ID, USER_B_ID]
      );

      const projARes = await tx.query<{ id: string }>(
        `INSERT INTO public.projects (owner_id, legacy_firebase_uid, tenant_id, code, name, module, status, data)
         VALUES ($1, 'fb_uid_alice_001', 'fb_uid_alice_001', 'ISO-A-01', 'Ligne Vapeur HP Alice', 'isometric', 'in_progress', '{"pipes":3}'::jsonb)
         RETURNING id`,
        [USER_A_ID]
      );
      projectAId = projARes.rows[0].id;

      const projBRes = await tx.query<{ id: string }>(
        `INSERT INTO public.projects (owner_id, legacy_firebase_uid, tenant_id, code, name, module, status, data)
         VALUES ($1, 'fb_uid_bob_002', 'fb_uid_bob_002', 'ISO-B-01', 'Collecteur Gaz Bob', 'isometric', 'draft', '{"pipes":1}'::jsonb)
         RETURNING id`,
        [USER_B_ID]
      );
      projectBId = projBRes.rows[0].id;

      const fileARes = await tx.query<{ id: string }>(
        `INSERT INTO public.project_files (project_id, owner_id, file_kind, name, mime_type, drawing_number, line_pid, fluid_code, status)
         VALUES ($1, $2, 'isometric', 'ISO-A-01-REV0.json', 'application/json', 'DWG-101', 'PID-01', 'STM', 'draft')
         RETURNING id`,
        [projectAId, USER_A_ID]
      );
      fileAId = fileARes.rows[0].id;

      const licARes = await tx.query<{ id: string }>(
        `INSERT INTO public.license_keys (code, type, plan, status, assigned_to_email, assigned_user_id, expires_at, max_users)
         VALUES ('PDI-PRO-ALICE-2026', 'PRO_YEAR', 'pro', 'active', 'alice@orthogonal-test.local', $1, now() + interval '365 days', 1)
         RETURNING id`,
        [USER_A_ID]
      );
      licenseKeyAId = licARes.rows[0].id;

      const subARes = await tx.query<{ id: string }>(
        `INSERT INTO public.subscriptions (user_id, plan, billing_cycle, status, provider, provider_subscription_id, license_key_id, current_period_start, current_period_end)
         VALUES ($1, 'pro', 'yearly', 'active', 'paddle', 'sub_paddle_alice_001', $2, now(), now() + interval '365 days')
         RETURNING id`,
        [USER_A_ID, licenseKeyAId]
      );
      subscriptionAId = subARes.rows[0].id;

      const payARes = await tx.query<{ id: string }>(
        `INSERT INTO public.payments (order_id, user_id, subscription_id, legacy_firebase_uid, user_email, user_name, country, country_code, plan, billing_cycle, amount, currency, provider, status, association_status, provider_transaction_id)
         VALUES ('ORD_PADDLE_ALICE000000000001', $1, $2, 'fb_uid_alice_001', 'alice@orthogonal-test.local', 'Alice Ingénieure', 'Algérie', 'DZ', 'pro', 'yearly', 49000.00, 'DZD', 'paddle', 'completed', 'associated', 'txn_paddle_alice_001')
         RETURNING id`,
        [USER_A_ID, subscriptionAId]
      );
      paymentAId = payARes.rows[0].id;

      await tx.query(
        `INSERT INTO public.connection_logs (user_id, user_email, user_name, user_role, account_type, ip_address, status)
         VALUES ($1, 'alice@orthogonal-test.local', 'Alice Ingénieure', 'client', 'pro', '192.0.2.10', 'success')`,
        [USER_A_ID]
      );

      await tx.query(
        `INSERT INTO public.audit_logs (actor_user_id, target_user_id, event_type, resource_type, resource_id, severity, metadata)
         VALUES ($1, $2, 'payment.completed', 'payments', $3, 'info', '{"provider":"paddle"}'::jsonb)`,
        [SUPER_ADMIN_ID, USER_A_ID, paymentAId]
      );

      const fbARes = await tx.query<{ id: string }>(
        `INSERT INTO public.feedback (user_id, user_email, user_name, category, rating, title, message, status)
         VALUES ($1, 'alice@orthogonal-test.local', 'Alice Ingénieure', 'feature_request', 5, 'Export DXF calques', 'Ajouter les calques par fluide.', 'new')
         RETURNING id`,
        [USER_A_ID]
      );
      feedbackAId = fbARes.rows[0].id;
    });
  }, 30000);

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  // =========================================================================
  // 1. CRÉATION DU SCHÉMA, INDEX, TRIGGERS ET RLS ACTIVÉ/FORCÉ
  // =========================================================================
  it("1. exécute les 2 migrations SQL sur une base vierge, crée les 12 tables, active et force RLS sur 100 % des tables", async () => {
    expect(fs.existsSync(MIGRATION_01_PATH)).toBe(true);
    expect(fs.existsSync(MIGRATION_02_PATH)).toBe(true);

    const tablesRes = await db.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
       ORDER BY c.relname`
    );

    const tableMap = new Map(tablesRes.rows.map((r) => [r.relname, r]));
    for (const expectedTable of MIG02_SUPABASE_TABLES) {
      const row = tableMap.get(expectedTable);
      expect(row, `Table ${expectedTable} manquante`).toBeDefined();
      expect(row!.relrowsecurity, `RLS non activé sur ${expectedTable}`).toBe(true);
      expect(row!.relforcerowsecurity, `FORCE RLS non activé sur ${expectedTable}`).toBe(true);
    }

    // Vérification de la présence des politiques RLS sur toutes les tables protégées
    const policiesRes = await db.query<{ tablename: string; policy_count: string }>(
      `SELECT tablename, COUNT(*)::text AS policy_count
       FROM pg_policies
       WHERE schemaname = 'public'
       GROUP BY tablename`
    );
    const policyMap = new Map(policiesRes.rows.map((r) => [r.tablename, Number(r.policy_count)]));
    for (const table of MIG02_RLS_PROTECTED_TABLES) {
      expect(policyMap.get(table) ?? 0, `Aucune politique RLS sur ${table}`).toBeGreaterThanOrEqual(2);
    }

    // Vérification qu'aucune colonne mot de passe ou secret n'existe dans les tables métier
    const forbiddenCols = await db.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name ~* '(password|secret|private_key|service_role)'`
    );
    expect(forbiddenCols.rows).toEqual([]);
  });

  // =========================================================================
  // 2. INTÉGRITÉ DES CLÉS ÉTRANGÈRES
  // =========================================================================
  it("2. applique strictement les clés étrangères (profiles->auth.users, projects->profiles, project_members->projects, payments->profiles)", async () => {
    const unknownUuid = "77777777-7777-4777-8777-777777777777";

    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.profiles (id, email, name) VALUES ($1, 'ghost@test.local', 'Ghost')`,
          [unknownUuid]
        )
      )
    ).rejects.toThrow(/foreign key constraint/i);

    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(`INSERT INTO public.projects (owner_id, name) VALUES ($1, 'Orphelin')`, [unknownUuid])
      )
    ).rejects.toThrow(/foreign key constraint/i);

    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.project_members (project_id, user_id, member_role) VALUES ($1, $2, 'viewer')`,
          [unknownUuid, USER_A_ID]
        )
      )
    ).rejects.toThrow(/foreign key constraint/i);

    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.payments (order_id, user_id, user_email, plan, billing_cycle, amount, currency, provider)
           VALUES ('ORD_PADDLE_ORPHAN000000001', $1, 'ghost@test.local', 'basic', 'monthly', 2500, 'DZD', 'paddle')`,
          [unknownUuid]
        )
      )
    ).rejects.toThrow(/foreign key constraint/i);
  });

  // =========================================================================
  // 3. UNICITÉ DES IDENTIFIANTS
  // =========================================================================
  it("3. garantit l'unicité des identifiants (firebase_uid, email insensible à la casse, mappings, license code, order_id, provider_tx)", async () => {
    // Email dupliqué insensible à la casse
    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.profiles (id, email, name) VALUES ($1, 'ALICE@ORTHOGONAL-TEST.LOCAL', 'Doublon')`,
          [USER_C_ID]
        )
      )
    ).rejects.toThrow(/duplicate key|unique constraint/i);

    // firebase_uid dupliqué dans profiles
    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.profiles (id, firebase_uid, email, name)
           VALUES ($1, 'fb_uid_alice_001', 'charlie@orthogonal-test.local', 'Charlie')`,
          [USER_C_ID]
        )
      )
    ).rejects.toThrow(/duplicate key|unique constraint/i);

    // firebase_uid dupliqué dans user_identity_mappings
    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.user_identity_mappings (supabase_user_id, firebase_uid, firebase_email)
           VALUES ($1, 'fb_uid_alice_001', 'charlie@orthogonal-test.local')`,
          [USER_C_ID]
        )
      )
    ).rejects.toThrow(/duplicate key|unique constraint/i);

    // code licence dupliqué
    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.license_keys (code, type, plan, expires_at)
           VALUES ('PDI-PRO-ALICE-2026', 'PRO_YEAR', 'pro', now() + interval '30 days')`
        )
      )
    ).rejects.toThrow(/duplicate key|unique constraint/i);

    // order_id dupliqué dans payments
    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.payments (order_id, user_id, user_email, plan, billing_cycle, amount, currency, provider)
           VALUES ('ORD_PADDLE_ALICE000000000001', $1, 'alice@orthogonal-test.local', 'pro', 'yearly', 49000, 'DZD', 'paddle')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/duplicate key|unique constraint/i);

    // (provider, provider_transaction_id) dupliqué dans payments
    await expect(
      runAsServiceRole(db, (tx) =>
        tx.query(
          `INSERT INTO public.payments (order_id, user_id, user_email, plan, billing_cycle, amount, currency, provider, provider_transaction_id)
           VALUES ('ORD_PADDLE_ALICE000000000002', $1, 'alice@orthogonal-test.local', 'pro', 'yearly', 49000, 'DZD', 'paddle', 'txn_paddle_alice_001')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/duplicate key|unique constraint/i);
  });

  // =========================================================================
  // 4. ISOLATION DES DONNÉES ENTRE DEUX UTILISATEURS DISTINCTS (USER A vs USER B)
  // =========================================================================
  it("4. isole strictement les données entre User A (Alice) et User B (Bob) via RLS réelle PostgreSQL", async () => {
    const aliceView = await runAsAuthenticated(db, USER_A_ID, async (tx) => ({
      profiles: (await tx.query<{ id: string }>(`SELECT id FROM public.profiles`)).rows,
      mappings: (await tx.query<{ supabase_user_id: string }>(`SELECT supabase_user_id FROM public.user_identity_mappings`)).rows,
      projects: (await tx.query<{ id: string }>(`SELECT id FROM public.projects`)).rows,
      files: (await tx.query<{ id: string }>(`SELECT id FROM public.project_files`)).rows,
      payments: (await tx.query<{ id: string }>(`SELECT id FROM public.payments`)).rows,
      subscriptions: (await tx.query<{ id: string }>(`SELECT id FROM public.subscriptions`)).rows,
      licenses: (await tx.query<{ id: string }>(`SELECT id FROM public.license_keys`)).rows,
      connectionLogs: (await tx.query<{ user_id: string }>(`SELECT user_id FROM public.connection_logs`)).rows,
      feedback: (await tx.query<{ id: string }>(`SELECT id FROM public.feedback`)).rows,
      auditLogs: (await tx.query<{ id: string }>(`SELECT id FROM public.audit_logs`)).rows,
    }));

    expect(aliceView.profiles.map((r) => r.id)).toEqual([USER_A_ID]);
    expect(aliceView.mappings.map((r) => r.supabase_user_id)).toEqual([USER_A_ID]);
    expect(aliceView.projects.map((r) => r.id)).toEqual([projectAId]);
    expect(aliceView.files.map((r) => r.id)).toEqual([fileAId]);
    expect(aliceView.payments.map((r) => r.id)).toEqual([paymentAId]);
    expect(aliceView.subscriptions.map((r) => r.id)).toEqual([subscriptionAId]);
    expect(aliceView.licenses.map((r) => r.id)).toEqual([licenseKeyAId]);
    expect(aliceView.connectionLogs.every((r) => r.user_id === USER_A_ID)).toBe(true);
    expect(aliceView.feedback.map((r) => r.id)).toEqual([feedbackAId]);
    expect(aliceView.auditLogs).toEqual([]);

    const bobView = await runAsAuthenticated(db, USER_B_ID, async (tx) => ({
      profiles: (await tx.query<{ id: string }>(`SELECT id FROM public.profiles`)).rows,
      mappings: (await tx.query<{ supabase_user_id: string }>(`SELECT supabase_user_id FROM public.user_identity_mappings`)).rows,
      projects: (await tx.query<{ id: string }>(`SELECT id FROM public.projects`)).rows,
      files: (await tx.query<{ id: string }>(`SELECT id FROM public.project_files`)).rows,
      payments: (await tx.query<{ id: string }>(`SELECT id FROM public.payments`)).rows,
      subscriptions: (await tx.query<{ id: string }>(`SELECT id FROM public.subscriptions`)).rows,
      licenses: (await tx.query<{ id: string }>(`SELECT id FROM public.license_keys`)).rows,
      connectionLogs: (await tx.query<{ user_id: string }>(`SELECT user_id FROM public.connection_logs`)).rows,
      feedback: (await tx.query<{ id: string }>(`SELECT id FROM public.feedback`)).rows,
      auditLogs: (await tx.query<{ id: string }>(`SELECT id FROM public.audit_logs`)).rows,
    }));

    expect(bobView.profiles.map((r) => r.id)).toEqual([USER_B_ID]);
    expect(bobView.mappings.map((r) => r.supabase_user_id)).toEqual([USER_B_ID]);
    expect(bobView.projects.map((r) => r.id)).toEqual([projectBId]);
    expect(bobView.files).toEqual([]);
    expect(bobView.payments).toEqual([]);
    expect(bobView.subscriptions).toEqual([]);
    expect(bobView.licenses).toEqual([]);
    expect(bobView.connectionLogs).toEqual([]);
    expect(bobView.feedback).toEqual([]);
    expect(bobView.auditLogs).toEqual([]);

    const bobUpdateAliceProj = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query(`UPDATE public.projects SET name = 'Piraté' WHERE id = $1 RETURNING id`, [projectAId])
    );
    expect(bobUpdateAliceProj.rows).toEqual([]);

    const bobDeleteAliceProj = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query(`DELETE FROM public.projects WHERE id = $1 RETURNING id`, [projectAId])
    );
    expect(bobDeleteAliceProj.rows).toEqual([]);

    const bobUpdateAliceProfile = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query(`UPDATE public.profiles SET name = 'Piraté' WHERE id = $1 RETURNING id`, [USER_A_ID])
    );
    expect(bobUpdateAliceProfile.rows).toEqual([]);
  });

  // =========================================================================
  // 5. PROTECTION DES RÔLES PRIVILÉGIÉS (ANTI-ESCALADE)
  // =========================================================================
  it("5. empêche toute auto-attribution ou escalade vers admin / super_admin et ignore les claims JWT falsifiés côté navigateur", async () => {
    await expect(
      runAsAuthenticated(db, USER_C_ID, (tx) =>
        tx.query(
          `INSERT INTO public.profiles (id, email, name, role, status)
           VALUES ($1, 'charlie@orthogonal-test.local', 'Charlie', 'super_admin', 'active')`,
          [USER_C_ID]
        )
      )
    ).rejects.toThrow(/Forbidden|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_C_ID, (tx) =>
        tx.query(
          `INSERT INTO public.profiles (id, email, name, role)
           VALUES ($1, 'charlie@orthogonal-test.local', 'Charlie', 'admin')`,
          [USER_C_ID]
        )
      )
    ).rejects.toThrow(/Forbidden|row-level security/i);

    // Usurpation d'email refusée à la création
    await expect(
      runAsAuthenticated(db, USER_C_ID, (tx) =>
        tx.query(
          `INSERT INTO public.profiles (id, email, name)
           VALUES ($1, 'spoofed@orthogonal-test.local', 'Charlie')`,
          [USER_C_ID]
        )
      )
    ).rejects.toThrow(/Forbidden|profile email must match/i);

    // Création légitime d'un profil client pending_activation
    const createdCharlie = await runAsAuthenticated(db, USER_C_ID, (tx) =>
      tx.query<{ id: string; role: string; status: string }>(
        `INSERT INTO public.profiles (id, email, name)
         VALUES ($1, 'charlie@orthogonal-test.local', 'Charlie Client')
         RETURNING id, role, status`,
        [USER_C_ID]
      )
    );
    expect(createdCharlie.rows[0]).toEqual({
      id: USER_C_ID,
      role: "client",
      status: "pending_activation",
    });

    // Mise à jour présentation autorisée
    const allowedUpdate = await runAsAuthenticated(db, USER_A_ID, (tx) =>
      tx.query<{ city: string }>(
        `UPDATE public.profiles SET city = 'Alger' WHERE id = $1 RETURNING city`,
        [USER_A_ID]
      )
    );
    expect(allowedUpdate.rows[0].city).toBe("Alger");

    // Tentatives d'escalade sur colonnes privilégiées -> refusées
    for (const maliciousSql of [
      `UPDATE public.profiles SET role = 'super_admin' WHERE id = $1`,
      `UPDATE public.profiles SET role = 'admin' WHERE id = $1`,
      `UPDATE public.profiles SET account_type = 'enterprise' WHERE id = $1`,
      `UPDATE public.profiles SET status = 'suspended' WHERE id = $1`,
      `UPDATE public.profiles SET login_count = 999 WHERE id = $1`,
    ]) {
      await expect(
        runAsAuthenticated(db, USER_A_ID, (tx) => tx.query(maliciousSql, [USER_A_ID]))
      ).rejects.toThrow(/Forbidden|privileged/i);
    }

    // Falsification JWT (`user_metadata`, `app_metadata`, `role='service_role'`) -> AUCUN privilège accordé
    const spoofedAuditRead = await runAsAuthenticated(
      db,
      USER_A_ID,
      (tx) => tx.query(`SELECT id FROM public.audit_logs`),
      { user_metadata: { role: "super_admin" }, app_metadata: { role: "super_admin" } }
    );
    expect(spoofedAuditRead.rows).toEqual([]);

    await expect(
      runAsAuthenticated(
        db,
        USER_A_ID,
        (tx) => tx.query(`UPDATE public.profiles SET role = 'super_admin' WHERE id = $1`, [USER_A_ID]),
        { role: "service_role" }
      )
    ).rejects.toThrow(/Forbidden|privileged/i);

    // Suppression directe d'un profil interdite côté client
    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`DELETE FROM public.profiles WHERE id = $1`, [USER_A_ID])
      )
    ).rejects.toThrow(/permission denied/i);

    // Super admin avec email NON vérifié dans auth.users refusé sur audit_logs
    const unverifiedAdminAudit = await runAsAuthenticated(db, UNVERIFIED_ADMIN_ID, (tx) =>
      tx.query(`SELECT id FROM public.audit_logs`)
    );
    expect(unverifiedAdminAudit.rows).toEqual([]);

    // Super admin vérifié et actif lit audit_logs mais ne peut pas escalader le rôle d'autrui directement côté client
    const verifiedAdminAudit = await runAsAuthenticated(db, SUPER_ADMIN_ID, (tx) =>
      tx.query<{ event_type: string }>(`SELECT event_type FROM public.audit_logs`)
    );
    expect(verifiedAdminAudit.rows.map((r) => r.event_type)).toContain("payment.completed");

    const superAdminUpdateBobRole = await runAsAuthenticated(db, SUPER_ADMIN_ID, (tx) =>
      tx.query(`UPDATE public.profiles SET role = 'super_admin' WHERE id = $1 RETURNING id`, [USER_B_ID])
    );
    expect(superAdminUpdateBobRole.rows).toEqual([]);
  });

  // =========================================================================
  // 6. PROTECTION DES DONNÉES DE PAIEMENT, ABONNEMENTS ET LICENCES
  // =========================================================================
  it("6. interdit toute création/modification/suppression client sur payments, subscriptions, license_keys et user_identity_mappings", async () => {
    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.payments (order_id, user_id, user_email, plan, billing_cycle, amount, currency, provider, status)
           VALUES ('ORD_PADDLE_FAKECLIENT00001', $1, 'alice@orthogonal-test.local', 'enterprise', 'lifetime', 0, 'EUR', 'paddle', 'completed')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`UPDATE public.payments SET status = 'refunded' WHERE id = $1`, [paymentAId])
      )
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`DELETE FROM public.payments WHERE id = $1`, [paymentAId])
      )
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.subscriptions (user_id, plan, billing_cycle, status)
           VALUES ($1, 'enterprise', 'lifetime', 'active')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`UPDATE public.license_keys SET status = 'active' WHERE id = $1`, [licenseKeyAId])
      )
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.user_identity_mappings (supabase_user_id, firebase_uid, firebase_email)
           VALUES ($1, 'fb_uid_spoofed', 'alice@orthogonal-test.local')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  // =========================================================================
  // 7. REFUS DES ACCÈS NON AUTHENTIFIÉS (`anon`)
  // =========================================================================
  it("7. refuse tout accès SELECT/INSERT/UPDATE/DELETE au rôle non authentifié (anon) sur l'ensemble des 12 tables", async () => {
    for (const tableName of MIG02_SUPABASE_TABLES) {
      await expect(
        runAsAnon(db, (tx) => tx.query(`SELECT 1 FROM public.${tableName} LIMIT 1`)),
        `anon SELECT aurait dû échouer sur ${tableName}`
      ).rejects.toThrow(/permission denied/i);
    }

    await expect(
      runAsAnon(db, (tx) =>
        tx.query(
          `INSERT INTO public.projects (owner_id, name) VALUES ($1, 'Anon Hack')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  // =========================================================================
  // 8 & 9. REFUS DES MODIFICATIONS NON AUTORISÉES & POLITIQUE COLLABORATIVE RLS
  // =========================================================================
  it("8 & 9. empêche l'auto-adhésion à un projet, protège les journaux contre modification/suppression et vérifie les rôles viewer/editor sur project_members", async () => {
    await expect(
      runAsAuthenticated(db, USER_B_ID, (tx) =>
        tx.query(
          `INSERT INTO public.project_members (project_id, user_id, member_role)
           VALUES ($1, $2, 'editor')`,
          [projectAId, USER_B_ID]
        )
      )
    ).rejects.toThrow(/row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.project_members (project_id, user_id, member_role)
           VALUES ($1, $2, 'owner')`,
          [projectAId, USER_B_ID]
        )
      )
    ).rejects.toThrow(/Forbidden|row-level security/i);

    await runAsAuthenticated(db, USER_A_ID, (tx) =>
      tx.query(
        `INSERT INTO public.project_members (project_id, user_id, member_role, invited_by)
         VALUES ($1, $2, 'viewer', $3)`,
        [projectAId, USER_B_ID, USER_A_ID]
      )
    );

    const bobReadsSharedProj = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM public.projects WHERE id = $1`, [projectAId])
    );
    expect(bobReadsSharedProj.rows.map((r) => r.id)).toEqual([projectAId]);

    const bobViewerUpdate = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query(`UPDATE public.projects SET description = 'Interdit' WHERE id = $1 RETURNING id`, [projectAId])
    );
    expect(bobViewerUpdate.rows).toEqual([]);

    await runAsAuthenticated(db, USER_A_ID, (tx) =>
      tx.query(
        `UPDATE public.project_members SET member_role = 'editor' WHERE project_id = $1 AND user_id = $2`,
        [projectAId, USER_B_ID]
      )
    );

    const bobEditorUpdate = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query<{ description: string }>(
        `UPDATE public.projects SET description = 'Revue tuyauterie validée' WHERE id = $1 RETURNING description`,
        [projectAId]
      )
    );
    expect(bobEditorUpdate.rows[0].description).toBe("Revue tuyauterie validée");

    await expect(
      runAsAuthenticated(db, USER_B_ID, (tx) =>
        tx.query(`UPDATE public.projects SET owner_id = $2 WHERE id = $1`, [projectAId, USER_B_ID])
      )
    ).rejects.toThrow(/Forbidden|immutable/i);

    const bobEditorDelete = await runAsAuthenticated(db, USER_B_ID, (tx) =>
      tx.query(`DELETE FROM public.projects WHERE id = $1 RETURNING id`, [projectAId])
    );
    expect(bobEditorDelete.rows).toEqual([]);

    const usageInsert = await runAsAuthenticated(db, USER_A_ID, (tx) =>
      tx.query<{ id: string }>(
        `INSERT INTO public.subscriber_usage (user_id, user_email, action, module)
         VALUES ($1, 'alice@orthogonal-test.local', 'export_pdf', 'isometric')
         RETURNING id`,
        [USER_A_ID]
      )
    );
    expect(usageInsert.rows).toHaveLength(1);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`UPDATE public.subscriber_usage SET action = 'tampered' WHERE id = $1`, [usageInsert.rows[0].id])
      )
    ).rejects.toThrow(/permission denied/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`DELETE FROM public.subscriber_usage WHERE id = $1`, [usageInsert.rows[0].id])
      )
    ).rejects.toThrow(/permission denied/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.connection_logs (user_id, user_email, status)
           VALUES ($1, 'alice@orthogonal-test.local', 'success')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/permission denied/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.audit_logs (event_type, resource_type) VALUES ('fake.event', 'profiles')`
        )
      )
    ).rejects.toThrow(/permission denied/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.feedback (user_id, user_email, category, rating, title, message, status, admin_notes)
           VALUES ($1, 'alice@orthogonal-test.local', 'bug_report', 4, 'Test', 'Message', 'resolved', 'Auto-approuvé')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/Forbidden|row-level security/i);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(`DELETE FROM public.feedback WHERE id = $1`, [feedbackAId])
      )
    ).rejects.toThrow(/permission denied/i);

    // Client ordinaire ne peut pas modifier un feedback ni forger legacy_pg_id sur un projet
    const aliceFeedbackUpdate = await runAsAuthenticated(db, USER_A_ID, (tx) =>
      tx.query(`UPDATE public.feedback SET status = 'resolved' WHERE id = $1 RETURNING id`, [feedbackAId])
    );
    expect(aliceFeedbackUpdate.rows).toEqual([]);

    await expect(
      runAsAuthenticated(db, USER_A_ID, (tx) =>
        tx.query(
          `INSERT INTO public.projects (owner_id, legacy_pg_id, name) VALUES ($1, 99999, 'Legacy Forge')`,
          [USER_A_ID]
        )
      )
    ).rejects.toThrow(/Forbidden|legacy migration identifiers/i);

    // Super Admin vérifié peut trier status/admin_notes mais ne peut pas altérer le message de l'utilisateur
    const triageOk = await runAsAuthenticated(db, SUPER_ADMIN_ID, (tx) =>
      tx.query<{ status: string; admin_notes: string }>(
        `UPDATE public.feedback SET status = 'reviewed', admin_notes = 'Pris en compte pour v4.9' WHERE id = $1 RETURNING status, admin_notes`,
        [feedbackAId]
      )
    );
    expect(triageOk.rows[0]).toEqual({
      status: "reviewed",
      admin_notes: "Pris en compte pour v4.9",
    });

    await expect(
      runAsAuthenticated(db, SUPER_ADMIN_ID, (tx) =>
        tx.query(`UPDATE public.feedback SET message = 'Altéré' WHERE id = $1`, [feedbackAId])
      )
    ).rejects.toThrow(/Forbidden|only status and admin_notes/i);
  });

  // =========================================================================
  // 10. COMPATIBILITÉ DU SCHÉMA AVEC LES DONNÉES EXISTANTES (PG + FIRESTORE)
  // =========================================================================
  it("10. garantit la compatibilité du schéma Supabase avec les structures existantes PostgreSQL (Drizzle) et Firestore", async () => {
    const legacyUserUuid = "44444444-4444-4444-8444-444444444444";
    await db.query(
      `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'legacy-eng@orthogonal-test.local', now())`,
      [legacyUserUuid]
    );

    const mappedProfile = mapLegacyFirestoreProfileToSupabaseRecord(
      legacyUserUuid,
      {
        uid: "firebase_legacy_uid_42",
        email: "Legacy-Eng@Orthogonal-Test.Local",
        name: "Ingénieur Historique",
        company: "Orthogonal Test Corp",
        country: "Algérie",
        countryCode: "dz",
        city: "Oran",
        paymentGateway: "slickpay_baridimob",
        currency: "dzd",
        role: "client",
        accountType: "team",
        subscriptionPlan: "yearly",
        status: "active",
        loginCount: 12,
        projectsCount: 3,
        storageUsedKb: 4096,
        lastLoginAt: "2026-11-20T10:00:00.000Z",
      },
      { displayName: "Ingénieur Historique", photoUrl: "https://example.test/avatar.png" }
    );

    const mappedProject = mapLegacyPostgresProjectToSupabaseRecord(legacyUserUuid, {
      id: 42,
      uid: "firebase_legacy_uid_42",
      name: "Unité Compression Hassi",
      description: "Migré depuis Drizzle projects",
      module: "isometric",
      status: "in_progress",
      driveFileId: "gdrive_file_0042",
      driveFolderId: "gdrive_folder_0001",
      driveWebViewLink: "https://drive.google.com/file/d/gdrive_file_0042/view",
      data: { pipes: [{ id: "P-101", dn: 150 }] },
    });

    await runAsServiceRole(db, async (tx) => {
      await tx.query(
        `INSERT INTO public.profiles (
          id, firebase_uid, email, name, display_name, photo_url, company, country, country_code, city,
          payment_gateway, currency, role, account_type, subscription_plan, status,
          login_count, projects_count, storage_used_kb, last_login_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          mappedProfile.id,
          mappedProfile.firebase_uid,
          mappedProfile.email,
          mappedProfile.name,
          mappedProfile.display_name,
          mappedProfile.photo_url,
          mappedProfile.company,
          mappedProfile.country,
          mappedProfile.country_code,
          mappedProfile.city,
          mappedProfile.payment_gateway,
          mappedProfile.currency,
          mappedProfile.role,
          mappedProfile.account_type,
          mappedProfile.subscription_plan,
          mappedProfile.status,
          mappedProfile.login_count,
          mappedProfile.projects_count,
          mappedProfile.storage_used_kb,
          mappedProfile.last_login_at,
        ]
      );

      await tx.query(
        `INSERT INTO public.user_identity_mappings (supabase_user_id, firebase_uid, firebase_email, migration_status, migrated_at)
         VALUES ($1, $2, $3, 'migrated', now())`,
        [legacyUserUuid, mappedProfile.firebase_uid, mappedProfile.email]
      );

      const projRes = await tx.query<{ id: string; legacy_pg_id: number }>(
        `INSERT INTO public.projects (
          legacy_pg_id, owner_id, legacy_firebase_uid, tenant_id, name, description,
          module, status, drive_file_id, drive_folder_id, drive_web_view_link, data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
        RETURNING id, legacy_pg_id`,
        [
          mappedProject.legacy_pg_id,
          mappedProject.owner_id,
          mappedProject.legacy_firebase_uid,
          mappedProject.tenant_id,
          mappedProject.name,
          mappedProject.description,
          mappedProject.module,
          mappedProject.status,
          mappedProject.drive_file_id,
          mappedProject.drive_folder_id,
          mappedProject.drive_web_view_link,
          JSON.stringify(mappedProject.data),
        ]
      );

      expect(projRes.rows[0].legacy_pg_id).toBe(42);

      await tx.query(
        `INSERT INTO public.project_files (project_id, owner_id, legacy_drive_record_id, file_kind, name, mime_type, size_label, drive_file_id, is_pdi_project)
         VALUES ($1, $2, 1001, 'drive_file', 'Plan_P101.pdi', 'application/json', '128 KB', 'gdrive_file_0042', true)`,
        [projRes.rows[0].id, legacyUserUuid]
      );

      await tx.query(
        `INSERT INTO public.project_files (project_id, owner_id, legacy_isometric_id, file_kind, name, drawing_number, line_pid, fluid_code, status, data_json)
         VALUES ($1, $2, 'iso_legacy_01', 'isometric', 'ISO Ligne P-101', 'ISO-101', 'PID-HASSI-01', 'GAS', 'approved', '{"version":"4.8d"}'::jsonb)`,
        [projRes.rows[0].id, legacyUserUuid]
      );
    });

    const migratedView = await runAsAuthenticated(db, legacyUserUuid, async (tx) => ({
      profile: (await tx.query<{ firebase_uid: string; country_code: string; currency: string }>(`SELECT firebase_uid, country_code, currency FROM public.profiles`)).rows[0],
      projects: (await tx.query<{ legacy_pg_id: number; name: string }>(`SELECT legacy_pg_id, name FROM public.projects`)).rows,
      files: (await tx.query<{ file_kind: string }>(`SELECT file_kind FROM public.project_files ORDER BY file_kind`)).rows,
    }));

    expect(migratedView.profile).toEqual({
      firebase_uid: "firebase_legacy_uid_42",
      country_code: "DZ",
      currency: "DZD",
    });
    expect(migratedView.projects).toEqual([{ legacy_pg_id: 42, name: "Unité Compression Hassi" }]);
    expect(migratedView.files).toEqual([{ file_kind: "drive_file" }, { file_kind: "isometric" }]);
  });
});
