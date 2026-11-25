/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-04-AUTH-01-FIX-01
 * Tests du composant Super Admin Supabase (`PdiSupabaseSuperAdminPanel.tsx`)
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PdiSupabaseSuperAdminPanel,
  PdiSupabaseSuperAdminPanelView,
  loadSupabaseSuperAdminPanelState,
  classifySuperAdminPanelError,
  type PdiSupabaseSuperAdminPanelProps,
} from "../../pdi/superadmin/PdiSupabaseSuperAdminPanel";
import {
  fetchSupabaseSuperAdminOverview,
  PdiSupabaseAuthError,
  type SupabaseAdminOverviewData,
} from "../../lib/supabaseAuth";

const SAMPLE_OVERVIEW: SupabaseAdminOverviewData = {
  generatedAt: "2026-11-24T10:15:00.000Z",
  verifiedSuperAdmin: {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "orthogonaleng@gmail.com",
    emailConfirmedAt: "2026-11-20T08:00:00.000Z",
  },
  counts: {
    profiles: 7,
    activeProfiles: 5,
    superAdmins: 1,
    projects: 14,
    licenseKeys: 3,
    auditLogs: 9,
  },
  profiles: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "orthogonaleng@gmail.com",
      name: "Orthogonal Super Admin",
      role: "super_admin",
      status: "active",
      accountType: "enterprise",
      subscriptionPlan: "lifetime",
      company: "ORTHOGONAL - ENG",
      createdAt: "2026-11-20T08:00:00.000Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "piping.lead@orthogonal.dz",
      name: "Lead Piping",
      role: "client",
      status: "active",
      accountType: "pro",
      subscriptionPlan: "yearly",
      company: "Bureau EPC Alger",
      createdAt: "2026-11-21T09:30:00.000Z",
    },
  ],
  recentAuditLogs: [
    {
      id: "audit-001",
      eventType: "super_admin.overview.accessed",
      resourceType: "admin_console",
      resourceId: "supabase-overview",
      severity: "info",
      actorUserId: "11111111-1111-4111-8111-111111111111",
      targetUserId: null,
      createdAt: "2026-11-24T10:14:00.000Z",
    },
  ],
  legacyFirestoreModulesPendingMigration: [
    "payments_and_webhooks_ledger (Firestore pending_orders / payment_transactions)",
    "country_restrictions (Firestore settings/country_restrictions)",
  ],
};

function createFakeSupabaseClient(accessToken = "valid.supabase.jwt") {
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: accessToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: { session: null },
        error: new Error("refresh failed"),
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } as any;
}

describe("MIG-04-AUTH-01-FIX-01 — PdiSupabaseSuperAdminPanel", () => {
  it("1. affiche l'état de chargement initial sans aucune donnée administrative fictive", () => {
    const html = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanel, {
        currentUserEmail: "orthogonaleng@gmail.com",
        onSwitchModule: vi.fn(),
        fetchOverview: () => new Promise<SupabaseAdminOverviewData>(() => {}),
      })
    );

    expect(html).toContain('data-testid="pdi-supabase-super-admin-panel"');
    expect(html).toContain('data-testid="supabase-admin-loading"');
    expect(html).toContain("Chargement des données Super Administrateur Supabase");
    expect(html).not.toContain('data-testid="supabase-admin-data"');
    expect(html).not.toContain('data-testid="supabase-admin-counts"');
    expect(html).not.toContain('data-testid="supabase-admin-profiles"');
    expect(html).not.toContain('data-testid="supabase-admin-audit-logs"');
    expect(html).not.toContain('data-testid="supabase-admin-identity"');
  });

  it("2. affiche toutes les données réelles retournées par fetchSupabaseSuperAdminOverview (GET /api/admin/supabase/overview)", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, overview: SAMPLE_OVERVIEW }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ) as unknown as typeof fetch;

    const state = await loadSupabaseSuperAdminPanelState(() =>
      fetchSupabaseSuperAdminOverview({
        getClient: () => createFakeSupabaseClient(),
        isConfigured: () => true,
        isSandbox: () => false,
        fetchImpl,
      })
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/admin/supabase/overview",
      expect.objectContaining({ method: "GET" })
    );
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.overview).toEqual(SAMPLE_OVERVIEW);

    const html = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanelView, {
        state,
        currentUserEmail: "orthogonaleng@gmail.com",
        onRefresh: vi.fn(),
        onSwitchModule: vi.fn(),
      })
    );

    // Identité du Super Admin vérifié
    expect(html).toContain('data-testid="supabase-admin-identity"');
    expect(html).toContain("orthogonaleng@gmail.com");
    expect(html).toContain("11111111-1111-4111-8111-111111111111");

    // Compteurs réels : profils, profils actifs, Super Admin, projets, clés de licence, journaux d'audit
    expect(html).toContain('data-testid="supabase-admin-count-profiles"');
    expect(html).toContain(">7<");
    expect(html).toContain('data-testid="supabase-admin-count-activeProfiles"');
    expect(html).toContain(">5<");
    expect(html).toContain('data-testid="supabase-admin-count-superAdmins"');
    expect(html).toContain(">1<");
    expect(html).toContain('data-testid="supabase-admin-count-projects"');
    expect(html).toContain(">14<");
    expect(html).toContain('data-testid="supabase-admin-count-licenseKeys"');
    expect(html).toContain(">3<");
    expect(html).toContain('data-testid="supabase-admin-count-auditLogs"');
    expect(html).toContain(">9<");

    // Table des profils & journaux d'audit récents
    expect(html).toContain("piping.lead@orthogonal.dz");
    expect(html).toContain("super_admin.overview.accessed");
    expect(html).toContain("admin_console");

    // Modules Firestore restant à migrer
    expect(html).toContain('data-testid="supabase-admin-legacy-modules"');
    expect(html).toContain("payments_and_webhooks_ledger");
    expect(html).toContain("country_restrictions");
  });

  it("3. gère proprement une erreur réseau sans afficher aucune donnée administrative fictive", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const state = await loadSupabaseSuperAdminPanelState(() =>
      fetchSupabaseSuperAdminOverview({
        getClient: () => createFakeSupabaseClient(),
        isConfigured: () => true,
        isSandbox: () => false,
        fetchImpl,
      })
    );

    expect(state.loading).toBe(false);
    expect(state.overview).toBeNull();
    expect(state.error).not.toBeNull();
    expect(state.error?.kind).toBe("network");

    const html = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanelView, {
        state,
        currentUserEmail: "orthogonaleng@gmail.com",
        onRefresh: vi.fn(),
        onSwitchModule: vi.fn(),
      })
    );

    expect(html).toContain('data-testid="supabase-admin-error"');
    expect(html).toContain('data-error-kind="network"');
    expect(html).toContain("Erreur réseau ou service indisponible");
    expect(html).not.toContain('data-testid="supabase-admin-data"');
    expect(html).not.toContain('data-testid="supabase-admin-counts"');
    expect(html).not.toContain('data-testid="supabase-admin-profiles"');
    expect(html).not.toContain('data-testid="supabase-admin-audit-logs"');
    expect(html).not.toContain('data-testid="supabase-admin-identity"');
    expect(html).not.toContain("orthogonaleng@gmail.com");
  });

  it("4. gère un refus HTTP 401 (session expirée / non authentifiée) en mode fail-closed", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "Unauthorized: Supabase access token has expired.",
          code: "auth/token-expired",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const state = await loadSupabaseSuperAdminPanelState(() =>
      fetchSupabaseSuperAdminOverview({
        getClient: () => createFakeSupabaseClient(),
        isConfigured: () => true,
        isSandbox: () => false,
        fetchImpl,
      })
    );

    expect(state.loading).toBe(false);
    expect(state.overview).toBeNull();
    expect(state.error?.kind).toBe("unauthorized");
    expect(state.error?.status).toBe(401);
    expect(state.error?.code).toBe("auth/token-expired");

    const html = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanelView, {
        state,
        currentUserEmail: "orthogonaleng@gmail.com",
        onRefresh: vi.fn(),
      })
    );

    expect(html).toContain('data-testid="supabase-admin-error"');
    expect(html).toContain('data-error-kind="unauthorized"');
    expect(html).toContain('data-error-status="401"');
    expect(html).toContain("HTTP 401");
    expect(html).toContain("auth/token-expired");
    expect(html).not.toContain('data-testid="supabase-admin-data"');
    expect(html).not.toContain('data-testid="supabase-admin-counts"');
    expect(html).not.toContain('data-testid="supabase-admin-identity"');
  });

  it("5. gère un refus HTTP 403 (accès Super Admin interdit) en mode fail-closed", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "Forbidden: Verified active Supabase Super Admin required.",
          code: "auth/forbidden-super-admin",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const state = await loadSupabaseSuperAdminPanelState(() =>
      fetchSupabaseSuperAdminOverview({
        getClient: () => createFakeSupabaseClient(),
        isConfigured: () => true,
        isSandbox: () => false,
        fetchImpl,
      })
    );

    expect(state.loading).toBe(false);
    expect(state.overview).toBeNull();
    expect(state.error?.kind).toBe("forbidden");
    expect(state.error?.status).toBe(403);
    expect(state.error?.code).toBe("auth/forbidden-super-admin");

    const html = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanelView, {
        state,
        currentUserEmail: "client@orthogonal.dz",
        onRefresh: vi.fn(),
      })
    );

    expect(html).toContain('data-testid="supabase-admin-error"');
    expect(html).toContain('data-error-kind="forbidden"');
    expect(html).toContain('data-error-status="403"');
    expect(html).toContain("HTTP 403");
    expect(html).toContain("auth/forbidden-super-admin");
    expect(html).not.toContain('data-testid="supabase-admin-data"');
    expect(html).not.toContain('data-testid="supabase-admin-counts"');
    expect(html).not.toContain('data-testid="supabase-admin-profiles"');
    expect(html).not.toContain('data-testid="supabase-admin-legacy-modules"');
  });

  it("6. garantit l'absence de données administratives fictives en cas d'erreur directe ou de payload malformé", async () => {
    const authErrState = await loadSupabaseSuperAdminPanelState(async () => {
      throw new PdiSupabaseAuthError(
        "Accès refusé par le serveur.",
        "auth/forbidden-super-admin",
        403
      );
    });
    expect(authErrState.overview).toBeNull();
    expect(authErrState.error?.status).toBe(403);

    const malformedState = await loadSupabaseSuperAdminPanelState(async () => ({}) as any);
    expect(malformedState.overview).toBeNull();
    expect(malformedState.error?.code).toBe("server/invalid-overview-payload");

    const html = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanelView, {
        state: malformedState,
        onRefresh: vi.fn(),
      })
    );
    expect(html).toContain('data-testid="supabase-admin-error"');
    expect(html).not.toContain('data-testid="supabase-admin-data"');
    expect(html).not.toContain('data-testid="supabase-admin-counts"');
    expect(html).not.toContain('data-testid="supabase-admin-profiles"');
    expect(html).not.toContain('data-testid="supabase-admin-audit-logs"');
    expect(html).not.toContain('data-testid="supabase-admin-legacy-modules"');
    expect(html).not.toContain('data-testid="supabase-admin-identity"');
    expect(html).not.toContain("Utilisateurs Supabase");
    expect(html).not.toContain("Journaux d&#x27;audit récents");

    const classified503 = classifySuperAdminPanelError(
      new PdiSupabaseAuthError("Service indisponible", "server/supabase-auth-unconfigured", 503)
    );
    expect(classified503.kind).toBe("network");
    expect(classified503.status).toBe(503);
  });

  it("7. vérifie la compatibilité exacte des propriétés, du callback onSwitchModule et du chemin d'import avec PdiUnifiedApp.tsx", () => {
    // Vérification du fichier réel et de la casse exacte sur disque
    const superAdminDir = path.resolve(process.cwd(), "src/pdi/superadmin");
    const entries = fs.readdirSync(superAdminDir);
    expect(entries).toContain("PdiSupabaseSuperAdminPanel.tsx");

    // Vérification de l'import exact dans PdiUnifiedApp.tsx
    const unifiedAppSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/pdi/app/PdiUnifiedApp.tsx"),
      "utf-8"
    );
    expect(unifiedAppSource).toContain(
      'import { PdiSupabaseSuperAdminPanel } from "../superadmin/PdiSupabaseSuperAdminPanel";'
    );
    expect(unifiedAppSource).toContain("<PdiSupabaseSuperAdminPanel");

    // Vérification TypeScript + exécution du contrat de propriétés attendu par PdiUnifiedApp.tsx
    const onSwitchModule = vi.fn();
    const compatibleProps: PdiSupabaseSuperAdminPanelProps = {
      currentUserEmail: "orthogonaleng@gmail.com",
      onSwitchModule: (mod: string) => onSwitchModule(mod),
    };

    const htmlWithCallback = renderToStaticMarkup(
      React.createElement(PdiSupabaseSuperAdminPanel, {
        ...compatibleProps,
        fetchOverview: () => new Promise<SupabaseAdminOverviewData>(() => {}),
      })
    );
    expect(htmlWithCallback).toContain('data-testid="supabase-admin-switch-module"');
    expect(htmlWithCallback).toContain("Ouvrir Éditeur ISO");
    expect(htmlWithCallback).toContain('data-testid="supabase-admin-refresh"');

    // Vérification du callback onSwitchModule sans dépendre de localStorage ni de rôle client
    compatibleProps.onSwitchModule?.("isometric");
    expect(onSwitchModule).toHaveBeenCalledTimes(1);
    expect(onSwitchModule).toHaveBeenCalledWith("isometric");

    // Contrôle d'isolation : aucune référence serveur ni clé secrète dans le composant
    const panelSource = fs.readFileSync(
      path.resolve(superAdminDir, "PdiSupabaseSuperAdminPanel.tsx"),
      "utf-8"
    );
    expect(panelSource).not.toContain("src/server/");
    expect(panelSource).not.toContain("../server/");
    expect(panelSource).not.toContain("SUPABASE_SECRET_KEY");
    expect(panelSource).not.toContain("localStorage");
    expect(panelSource).not.toContain("user_metadata");
    expect(panelSource).not.toContain("app_metadata");
  });
});
