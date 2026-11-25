/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — ADDENDUM MIG-04-AUTH-01-FIX-02
 * Tests du script administratif `scripts/updateSupabaseSuperAdminEmail.ts`
 * (exécutés strictement en mode simulation / client mocké — aucune mutation réelle)
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  executeUpdateSupabaseSuperAdminEmail,
  EXPLICIT_CONFIRMATION_TOKEN,
  parseUpdateSuperAdminEmailArgs,
  runUpdateSuperAdminEmailCli,
  SOURCE_SUPER_ADMIN_EMAIL,
  TARGET_SUPER_ADMIN_EMAIL,
  UpdateSuperAdminEmailError,
} from "../../../scripts/updateSupabaseSuperAdminEmail";

const SUPER_ADMIN_UUID = "11111111-2222-4333-8444-555555555555";
const OTHER_USER_UUID = "99999999-8888-4777-8666-555555555555";

interface MockAuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

interface MockSupabaseState {
  authUsers: MockAuthUser[];
  profiles: Array<Record<string, unknown>>;
  userIdentityMappings: Array<Record<string, unknown>> | null; // null = table absente
  auditLogs: Array<Record<string, unknown>>;
}

function createSimulatedSupabaseAdminClient(initial: MockSupabaseState) {
  const state: MockSupabaseState = {
    authUsers: initial.authUsers.map((u) => ({ ...u })),
    profiles: initial.profiles.map((p) => ({ ...p })),
    userIdentityMappings:
      initial.userIdentityMappings === null
        ? null
        : initial.userIdentityMappings.map((m) => ({ ...m })),
    auditLogs: initial.auditLogs.map((a) => ({ ...a })),
  };

  const spies = {
    listUsers: vi.fn(),
    updateUserById: vi.fn(),
    getUserById: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    profilesUpdate: vi.fn(),
    mappingsUpdate: vi.fn(),
    auditInsert: vi.fn(),
  };

  const client = {
    auth: {
      admin: {
        listUsers: async () => {
          spies.listUsers();
          return {
            data: { users: state.authUsers.map((u) => ({ ...u })) },
            error: null,
          };
        },
        updateUserById: async (
          uid: string,
          attrs: { email?: string; email_confirm?: boolean }
        ) => {
          spies.updateUserById(uid, attrs);
          const found = state.authUsers.find((u) => u.id === uid);
          if (!found) {
            return { data: { user: null }, error: { message: "User not found" } };
          }
          if (attrs.email) {
            found.email = attrs.email.trim().toLowerCase();
          }
          if (attrs.email_confirm) {
            found.email_confirmed_at =
              found.email_confirmed_at ?? "2026-11-25T00:00:00.000Z";
          }
          return { data: { user: { ...found } }, error: null };
        },
        getUserById: async (uid: string) => {
          spies.getUserById(uid);
          const found = state.authUsers.find((u) => u.id === uid);
          if (!found) {
            return { data: { user: null }, error: { message: "User not found" } };
          }
          return { data: { user: { ...found } }, error: null };
        },
        createUser: spies.createUser,
        deleteUser: spies.deleteUser,
      },
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: (_cols: string) => ({
            eq: (col: string, val: unknown) => ({
              maybeSingle: async () => {
                const row = state.profiles.find((p) => p[col] === val) ?? null;
                return { data: row ? { ...row } : null, error: null };
              },
            }),
            limit: async () => ({
              data: state.profiles.map((p) => ({ ...p })),
              error: null,
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (col: string, val: unknown) => {
              spies.profilesUpdate(patch, col, val);
              for (const row of state.profiles) {
                if (row[col] === val) {
                  Object.assign(row, patch);
                }
              }
              return { error: null };
            },
          }),
        };
      }

      if (table === "user_identity_mappings") {
        return {
          select: (_cols: string) => ({
            limit: async () => {
              if (state.userIdentityMappings === null) {
                return {
                  data: null,
                  error: {
                    code: "42P01",
                    message: 'relation "public.user_identity_mappings" does not exist',
                  },
                };
              }
              return {
                data: state.userIdentityMappings.map((m) => ({ ...m })),
                error: null,
              };
            },
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (col: string, val: unknown) => {
              spies.mappingsUpdate(patch, col, val);
              if (state.userIdentityMappings) {
                for (const row of state.userIdentityMappings) {
                  if (row[col] === val) {
                    Object.assign(row, patch);
                  }
                }
              }
              return { error: null };
            },
          }),
        };
      }

      if (table === "audit_logs") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return Promise.resolve({
                count: state.auditLogs.length,
                data: null,
                error: null,
              });
            }
            return Promise.resolve({
              count: state.auditLogs.length,
              data: state.auditLogs.map((a) => ({ ...a })),
              error: null,
            });
          },
          insert: async (entry: Record<string, unknown>) => {
            spies.auditInsert(entry);
            state.auditLogs.push({ id: `audit-${state.auditLogs.length + 1}`, ...entry });
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table accessed: ${table}`);
    },
  } as any;

  return { client, state, spies };
}

function makeDefaultInitialState(): MockSupabaseState {
  return {
    authUsers: [
      {
        id: SUPER_ADMIN_UUID,
        email: SOURCE_SUPER_ADMIN_EMAIL,
        email_confirmed_at: "2026-11-20T08:00:00.000Z",
      },
      {
        id: OTHER_USER_UUID,
        email: "engineer@orthogonal.dz",
        email_confirmed_at: "2026-11-21T09:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: SUPER_ADMIN_UUID,
        email: SOURCE_SUPER_ADMIN_EMAIL,
        name: "Orthogonal Super Admin",
        role: "super_admin",
        status: "active",
        account_type: "enterprise",
        subscription_plan: "lifetime",
      },
      {
        id: OTHER_USER_UUID,
        email: "engineer@orthogonal.dz",
        name: "Standard Engineer",
        role: "client",
        status: "active",
      },
    ],
    userIdentityMappings: [
      {
        id: "map-001",
        supabase_user_id: SUPER_ADMIN_UUID,
        firebase_uid: "fb_legacy_super_admin",
        firebase_email: SOURCE_SUPER_ADMIN_EMAIL,
      },
    ],
    auditLogs: [
      {
        id: "audit-existing-1",
        event_type: "super_admin.bootstrap.activated",
        actor_user_id: SUPER_ADMIN_UUID,
      },
    ],
  };
}

describe("ADDENDUM MIG-04-AUTH-01-FIX-02 — scripts/updateSupabaseSuperAdminEmail.ts", () => {
  it("1. Mode DRY_RUN par défaut : affiche le plan sans modifier AUCUNE donnée et refuse toute écriture si --dry-run ou DRY_RUN=true est combiné avec --execute", async () => {
    const { client, state, spies } = createSimulatedSupabaseAdminClient(
      makeDefaultInitialState()
    );

    const parsedDefault = parseUpdateSuperAdminEmailArgs([], {});
    expect(parsedDefault.dryRun).toBe(true);

    // Refus explicite si --dry-run et --execute sont passés ensemble
    expect(() =>
      parseUpdateSuperAdminEmailArgs(["--dry-run", "--execute"], {})
    ).toThrowError(UpdateSuperAdminEmailError);

    // Refus explicite si DRY_RUN=true dans l'env avec --execute
    expect(() =>
      parseUpdateSuperAdminEmailArgs(["--execute"], { DRY_RUN: "true" })
    ).toThrowError(UpdateSuperAdminEmailError);

    // Exécution DRY_RUN même avec un jeton de confirmation présent -> ZÉRO écriture
    const report = await executeUpdateSupabaseSuperAdminEmail({
      client,
      dryRun: true,
      confirmToken: EXPLICIT_CONFIRMATION_TOKEN,
      supabaseOrigin: "https://example-dev.supabase.co",
      operatorId: "sec-ops-dryrun",
      env: { NODE_ENV: "test", PDI_ENV: "test" },
    });

    expect(report.ok).toBe(true);
    expect(report.mode).toBe("DRY_RUN");
    expect(report.executed).toBe(false);
    expect(report.changesApplied).toBe(false);
    expect(report.userId).toBe(SUPER_ADMIN_UUID);
    expect(report.uuidPreserved).toBe(true);
    expect(report.plannedActions.length).toBeGreaterThanOrEqual(3);

    // Preuve absolue d'absence d'écriture en mode DRY_RUN
    expect(spies.updateUserById).not.toHaveBeenCalled();
    expect(spies.createUser).not.toHaveBeenCalled();
    expect(spies.deleteUser).not.toHaveBeenCalled();
    expect(spies.profilesUpdate).not.toHaveBeenCalled();
    expect(spies.mappingsUpdate).not.toHaveBeenCalled();
    expect(spies.auditInsert).not.toHaveBeenCalled();

    // Données totalement intactes
    expect(state.authUsers[0].email).toBe(SOURCE_SUPER_ADMIN_EMAIL);
    expect(state.profiles[0].email).toBe(SOURCE_SUPER_ADMIN_EMAIL);
    expect(state.userIdentityMappings?.[0].firebase_email).toBe(SOURCE_SUPER_ADMIN_EMAIL);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("2. Exige une confirmation explicite avant toute modification réelle (--execute sans --confirm -> refusé avec ZÉRO écriture)", async () => {
    const { client, spies } = createSimulatedSupabaseAdminClient(
      makeDefaultInitialState()
    );

    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client,
        dryRun: false,
        confirmToken: null,
        env: { NODE_ENV: "test", PDI_ENV: "test" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError && err.code === "CONFIRMATION_REQUIRED"
    );

    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client,
        dryRun: false,
        confirmToken: "WRONG_CONFIRMATION_TOKEN",
        env: { NODE_ENV: "test", PDI_ENV: "test" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError && err.code === "CONFIRMATION_REQUIRED"
    );

    expect(spies.updateUserById).not.toHaveBeenCalled();
    expect(spies.profilesUpdate).not.toHaveBeenCalled();
  });

  it("3. Refuse l'opération si l'adresse cible orthogonaleng@gmail.com est déjà attribuée à un autre utilisateur (auth.users ou profiles)", async () => {
    // Cas 3a : conflit dans auth.users
    const stateAuthConflict = makeDefaultInitialState();
    stateAuthConflict.authUsers.push({
      id: "77777777-7777-4777-8777-777777777777",
      email: TARGET_SUPER_ADMIN_EMAIL,
      email_confirmed_at: "2026-11-22T10:00:00.000Z",
    });
    const simAuth = createSimulatedSupabaseAdminClient(stateAuthConflict);

    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client: simAuth.client,
        dryRun: false,
        confirmToken: EXPLICIT_CONFIRMATION_TOKEN,
        env: { NODE_ENV: "test", PDI_ENV: "test" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError &&
        err.code === "TARGET_EMAIL_ALREADY_IN_USE"
    );
    expect(simAuth.spies.updateUserById).not.toHaveBeenCalled();
    expect(simAuth.spies.profilesUpdate).not.toHaveBeenCalled();

    // Cas 3b : conflit dans public.profiles sur un autre UUID
    const stateProfileConflict = makeDefaultInitialState();
    stateProfileConflict.profiles[1].email = TARGET_SUPER_ADMIN_EMAIL;
    const simProfile = createSimulatedSupabaseAdminClient(stateProfileConflict);

    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client: simProfile.client,
        dryRun: false,
        confirmToken: EXPLICIT_CONFIRMATION_TOKEN,
        env: { NODE_ENV: "test", PDI_ENV: "test" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError &&
        err.code === "TARGET_EMAIL_ALREADY_IN_USE"
    );
    expect(simProfile.spies.updateUserById).not.toHaveBeenCalled();
  });

  it("4. Refuse l'opération si l'utilisateur source orthognaleng@gmail.com est absent", async () => {
    const emptySourceState = makeDefaultInitialState();
    emptySourceState.authUsers = emptySourceState.authUsers.filter(
      (u) => u.email !== SOURCE_SUPER_ADMIN_EMAIL
    );
    const { client, spies } = createSimulatedSupabaseAdminClient(emptySourceState);

    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client,
        dryRun: true,
        env: { NODE_ENV: "test", PDI_ENV: "test" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError && err.code === "SOURCE_USER_NOT_FOUND"
    );

    expect(spies.updateUserById).not.toHaveBeenCalled();
    expect(spies.profilesUpdate).not.toHaveBeenCalled();
  });

  it("5. Simulation d'exécution confirmée : utilise exclusivement updateUserById, conserve l'UUID, role='super_admin', status='active', journaux d'audit, et synchronise profiles + user_identity_mappings sans supposer le schéma", async () => {
    const { client, state, spies } = createSimulatedSupabaseAdminClient(
      makeDefaultInitialState()
    );

    const report = await executeUpdateSupabaseSuperAdminEmail({
      client,
      dryRun: false,
      confirmToken: EXPLICIT_CONFIRMATION_TOKEN,
      operatorId: "sec-admin-1",
      supabaseOrigin: "https://example-dev.supabase.co",
      env: { NODE_ENV: "test", PDI_ENV: "test" },
    });

    expect(report.ok).toBe(true);
    expect(report.mode).toBe("EXECUTED");
    expect(report.executed).toBe(true);
    expect(report.changesApplied).toBe(true);

    // Conservation stricte de l'UUID
    expect(report.userId).toBe(SUPER_ADMIN_UUID);
    expect(report.uuidBefore).toBe(SUPER_ADMIN_UUID);
    expect(report.uuidAfter).toBe(SUPER_ADMIN_UUID);
    expect(report.uuidPreserved).toBe(true);

    // Conservation du rôle super_admin, statut active et journaux d'audit
    expect(report.roleBefore).toBe("super_admin");
    expect(report.roleAfter).toBe("super_admin");
    expect(report.statusBefore).toBe("active");
    expect(report.statusAfter).toBe("active");
    expect(report.auditLogs.countBefore).toBe(1);
    expect(report.auditLogs.countAfter).toBe(2);
    expect(report.auditLogs.preserved).toBe(true);
    expect(report.auditLogs.auditEntryAppended).toBe(true);

    // Vérification post-modification complète
    expect(report.postVerification).toEqual({
      performed: true,
      authUserUuidMatch: true,
      authUserEmailMatch: true,
      authUserEmailConfirmed: true,
      profileUuidMatch: true,
      profileEmailMatch: true,
      profileRolePreserved: true,
      profileStatusPreserved: true,
      identityMappingsClean: true,
      auditLogsPreserved: true,
    });

    // Exclusivement updateUserById (jamais createUser ni deleteUser)
    expect(spies.updateUserById).toHaveBeenCalledTimes(1);
    expect(spies.updateUserById).toHaveBeenCalledWith(SUPER_ADMIN_UUID, {
      email: TARGET_SUPER_ADMIN_EMAIL,
      email_confirm: true,
    });
    expect(spies.createUser).not.toHaveBeenCalled();
    expect(spies.deleteUser).not.toHaveBeenCalled();
    expect(spies.getUserById).toHaveBeenCalledWith(SUPER_ADMIN_UUID);

    // Aucun doublon créé ; ancien log d'audit conservé intact
    expect(state.authUsers).toHaveLength(2);
    expect(state.authUsers[0].id).toBe(SUPER_ADMIN_UUID);
    expect(state.authUsers[0].email).toBe(TARGET_SUPER_ADMIN_EMAIL);
    expect(state.profiles[0].role).toBe("super_admin");
    expect(state.profiles[0].status).toBe("active");
    expect(state.profiles[0].email).toBe(TARGET_SUPER_ADMIN_EMAIL);
    expect(state.userIdentityMappings?.[0].firebase_email).toBe(TARGET_SUPER_ADMIN_EMAIL);
    expect(state.auditLogs[0].event_type).toBe("super_admin.bootstrap.activated");
    expect(state.auditLogs[1].event_type).toBe("super_admin.identity_email.updated");
  });

  it("6. Fonctionne sans supposer le schéma de user_identity_mappings (table absente OU colonnes personnalisées user_id / legacy_email)", async () => {
    // Cas 6a : table user_identity_mappings absente (42P01)
    const noMappingsState = makeDefaultInitialState();
    noMappingsState.userIdentityMappings = null;
    const simNoTable = createSimulatedSupabaseAdminClient(noMappingsState);

    const reportNoTable = await executeUpdateSupabaseSuperAdminEmail({
      client: simNoTable.client,
      dryRun: false,
      confirmToken: EXPLICIT_CONFIRMATION_TOKEN,
      env: { NODE_ENV: "test", PDI_ENV: "test" },
    });
    expect(reportNoTable.ok).toBe(true);
    expect(reportNoTable.identityMappingsInspection.tableExists).toBe(false);
    expect(reportNoTable.uuidPreserved).toBe(true);

    // Cas 6b : colonnes personnalisées (user_id + legacy_email)
    const customSchemaState = makeDefaultInitialState();
    customSchemaState.userIdentityMappings = [
      {
        id: "custom-row-1",
        user_id: SUPER_ADMIN_UUID,
        legacy_email: SOURCE_SUPER_ADMIN_EMAIL,
      },
    ];
    const simCustom = createSimulatedSupabaseAdminClient(customSchemaState);

    const reportCustom = await executeUpdateSupabaseSuperAdminEmail({
      client: simCustom.client,
      dryRun: false,
      confirmToken: EXPLICIT_CONFIRMATION_TOKEN,
      env: { NODE_ENV: "test", PDI_ENV: "test" },
    });
    expect(reportCustom.ok).toBe(true);
    expect(reportCustom.identityMappingsInspection.emailColumnsDetected).toEqual([
      "legacy_email",
    ]);
    expect(reportCustom.identityMappingsInspection.updatedRowCount).toBe(1);
    expect(simCustom.state.userIdentityMappings?.[0].legacy_email).toBe(
      TARGET_SUPER_ADMIN_EMAIL
    );
  });

  it("7. Sécurité CLI : bloque Sandbox/navigateur, masque tout secret dans le rapport, utilise src/server/supabaseAdmin.ts et interdit createUser / deleteUser / SQL sur auth.users", async () => {
    const { client } = createSimulatedSupabaseAdminClient(makeDefaultInitialState());

    // Blocage Sandbox
    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client,
        dryRun: true,
        env: { PDI_ENV: "sandbox", VITE_PDI_ENV: "sandbox" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError && err.code === "SANDBOX_FORBIDDEN"
    );

    // Blocage contexte navigateur
    await expect(
      executeUpdateSupabaseSuperAdminEmail({
        client,
        dryRun: true,
        isBrowserRuntime: true,
        env: { NODE_ENV: "test", PDI_ENV: "test" },
      })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof UpdateSuperAdminEmailError &&
        err.code === "BROWSER_CONTEXT_FORBIDDEN"
    );

    // Sortie CLI en DRY_RUN sans fuite de secret
    const fakeSecret = ["sb", "secret", "unitTestSecretValue1234567890"].join("_");
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const exitCode = await runUpdateSuperAdminEmailCli(
      ["--dry-run", "--operator", `ops-${fakeSecret}`],
      { NODE_ENV: "test", PDI_ENV: "test" },
      {
        client,
        supabaseOrigin: "https://example-dev.supabase.co",
        stdout: (line) => stdoutLines.push(line),
        stderr: (line) => stderrLines.push(line),
      }
    );
    expect(exitCode).toBe(0);
    expect(stderrLines).toHaveLength(0);
    const printed = stdoutLines.join("\n");
    expect(printed).not.toContain(fakeSecret);
    expect(printed).toContain("[REDACTED_SUPABASE_SECRET]");
    expect(printed).toContain('"mode": "DRY_RUN"');

    // Audit statique du script
    const scriptSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/updateSupabaseSuperAdminEmail.ts"),
      "utf8"
    );
    expect(scriptSource).toContain("../src/server/supabaseAdmin.ts");
    expect(scriptSource).toContain("auth.admin.updateUserById");
    expect(scriptSource).not.toContain("auth.admin.createUser");
    expect(scriptSource).not.toContain("auth.admin.deleteUser");
    expect(scriptSource).not.toMatch(/UPDATE\s+auth\.users/i);
    expect(scriptSource).not.toMatch(/DELETE\s+FROM\s+auth\.users/i);
  });
});
