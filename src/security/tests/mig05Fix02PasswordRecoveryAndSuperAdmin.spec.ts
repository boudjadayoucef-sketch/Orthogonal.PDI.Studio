import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  SUPABASE_PASSWORD_RESET_ROUTE,
  PdiSupabaseAuthError,
  attachSupabaseAuthMonitor,
  clearPendingSupabaseRecoveryHint,
  clearSensitiveAuthParamsFromUrl,
  completeSupabasePasswordRecovery,
  fetchSupabaseSuperAdminOverview,
  inspectSupabaseRecoveryUrlHint,
  loginWithSupabaseEmailPassword,
  logoutSupabase,
  resolveSupabasePasswordResetRedirectUrl,
  sendSupabasePasswordResetEmail,
  type SupabasePasswordRecoveryContext,
} from "../../lib/supabaseAuth";
import {
  createRequireSupabaseAuth,
  requireSupabaseSuperAdmin,
  type SupabaseAuthRequest,
  type SupabaseServerAuthGateway,
} from "../../server/supabaseAuth";
import { evaluateWorkspaceAccessGuard } from "../../pdi/app/PdiUnifiedApp";

const EXISTING_SUPER_ADMIN_UUID = "7243efe7-113d-45f2-8f2e-044799b25ff0";
const EXISTING_SUPER_ADMIN_EMAIL = "orthogonaleng@gmail.com";
const PROD_ORIGIN = "https://orthogonal-pdi-studio.vercel.app";
const SUPABASE_PROJECT_URL = "https://ffskadagffdiwsdaszxu.supabase.co";

function makeSupabaseJwt(sub: string, email: string, issUrl = SUPABASE_PROJECT_URL): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      email,
      aud: "authenticated",
      role: "authenticated",
      iss: `${issUrl}/auth/v1`,
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const sig = Buffer.from("synthetic-test-sig-mig05-fix02").toString("base64url");
  return `${header}.${payload}.${sig}`;
}

function makeRecoverySession(overrides?: Partial<Session>): Session {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: makeSupabaseJwt(EXISTING_SUPER_ADMIN_UUID, EXISTING_SUPER_ADMIN_EMAIL),
    refresh_token: "refresh_secret_mig05_fix02_do_not_leak",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: nowSec + 3600,
    user: {
      id: EXISTING_SUPER_ADMIN_UUID,
      email: EXISTING_SUPER_ADMIN_EMAIL,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  } as Session;
}

function flushAsync(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  clearPendingSupabaseRecoveryHint();
  vi.restoreAllMocks();
});

describe("MIG-05-FIX-02 — Récupération du mot de passe et accès SaaS Super Admin Supabase", () => {
  it("1. Construit et valide strictement redirectTo vers /auth/reset-password en contexte HTTPS et rejette toute URL dangereuse", async () => {
    expect(
      resolveSupabasePasswordResetRedirectUrl({
        locationLike: { origin: PROD_ORIGIN },
      })
    ).toBe(`${PROD_ORIGIN}${SUPABASE_PASSWORD_RESET_ROUTE}`);

    expect(
      resolveSupabasePasswordResetRedirectUrl({
        locationLike: { origin: "http://localhost:3000" },
      })
    ).toBe("http://localhost:3000/auth/reset-password");

    // Rejet strict des protocoles dangereux, HTTP distant et identifiants embarqués
    expect(
      resolveSupabasePasswordResetRedirectUrl({
        redirectTo: "javascript:alert(1)",
      })
    ).toBeUndefined();
    expect(
      resolveSupabasePasswordResetRedirectUrl({
        redirectTo: "http://evil.example.com/auth/reset-password",
      })
    ).toBeUndefined();
    expect(
      resolveSupabasePasswordResetRedirectUrl({
        redirectTo: "https://user:pass@orthogonal-pdi-studio.vercel.app/auth/reset-password",
      })
    ).toBeUndefined();

    // Vérifie que sendSupabasePasswordResetEmail transmet explicitement { redirectTo } quand une origine navigateur est disponible
    const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
    const fakeClient = { auth: { resetPasswordForEmail } } as any;

    await sendSupabasePasswordResetEmail(`  ${EXISTING_SUPER_ADMIN_EMAIL}  `, {
      getClient: () => fakeClient,
      isConfigured: () => true,
      isSandbox: () => false,
      locationLike: { origin: PROD_ORIGIN },
    });

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(EXISTING_SUPER_ADMIN_EMAIL, {
      redirectTo: `${PROD_ORIGIN}/auth/reset-password`,
    });
  });

  it("2. Anti-course critique : INITIAL_SESSION / SIGNED_IN émis immédiatement après PASSWORD_RECOVERY n'annule JAMAIS le formulaire de récupération", async () => {
    const session = makeRecoverySession();
    let capturedCb: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;

    // Simule un appel réseau getUser() lent pendant lequel GoTrue émet INITIAL_SESSION + SIGNED_IN
    const getUser = vi.fn(async () => {
      await flushAsync(25);
      return {
        data: {
          user: {
            id: EXISTING_SUPER_ADMIN_UUID,
            email: EXISTING_SUPER_ADMIN_EMAIL,
          },
        },
        error: null,
      };
    });

    const fakeClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
          capturedCb = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        getUser,
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as any;

    const onSessionVerified = vi.fn();
    const onPasswordRecovery = vi.fn<(ctx: SupabasePasswordRecoveryContext) => void>();
    const onPasswordRecoveryInvalid = vi.fn();
    const fetchSpy = vi.fn();

    const stop = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeClient,
        fetchImpl: fetchSpy as any,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: {
          pathname: "/auth/reset-password",
          search: "",
          hash: "#access_token=abc&type=recovery",
        },
      },
      onSessionVerified,
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery,
      onPasswordRecoveryInvalid,
    });

    expect(capturedCb).not.toBeNull();
    // Rafale réelle GoTrue v2 : PASSWORD_RECOVERY suivi immédiatement de INITIAL_SESSION et SIGNED_IN
    capturedCb!("PASSWORD_RECOVERY", session);
    capturedCb!("INITIAL_SESSION", session);
    capturedCb!("SIGNED_IN", session);

    await flushAsync(50);

    expect(onPasswordRecovery).toHaveBeenCalledTimes(1);
    expect(onPasswordRecovery.mock.calls[0][0].userId).toBe(EXISTING_SUPER_ADMIN_UUID);
    expect(onPasswordRecovery.mock.calls[0][0].email).toBe(EXISTING_SUPER_ADMIN_EMAIL);
    expect(onSessionVerified).not.toHaveBeenCalled();
    expect(onPasswordRecoveryInvalid).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    stop();
  });

  it("3. Résilience React StrictMode : si le 1er montage est démonté après consommation du hash URL par GoTrue, le 2e montage restaure toujours le flux de récupération", async () => {
    const session = makeRecoverySession();
    const listeners: Array<(event: AuthChangeEvent, s: Session | null) => void> = [];

    const getUser = vi.fn(async () => ({
      data: {
        user: {
          id: EXISTING_SUPER_ADMIN_UUID,
          email: EXISTING_SUPER_ADMIN_EMAIL,
        },
      },
      error: null,
    }));

    const fakeClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        getUser,
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as any;

    // Montage #1 : URL contient #type=recovery, mais React StrictMode démonte immédiatement avant fin d'async
    const onRecoveryMount1 = vi.fn();
    const stop1 = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: { pathname: "/", search: "", hash: "#access_token=xyz&type=recovery" },
      },
      onSessionVerified: vi.fn(),
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery: onRecoveryMount1,
      onPasswordRecoveryInvalid: vi.fn(),
    });
    stop1();

    // Montage #2 : GoTrue a déjà nettoyé window.location.hash, et émet uniquement INITIAL_SESSION(session)
    const onRecoveryMount2 = vi.fn();
    const onSessionVerifiedMount2 = vi.fn();
    const stop2 = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: { pathname: "/", search: "", hash: "" },
      },
      onSessionVerified: onSessionVerifiedMount2,
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery: onRecoveryMount2,
      onPasswordRecoveryInvalid: vi.fn(),
    });

    listeners[1]("INITIAL_SESSION", session);
    await flushAsync(25);

    expect(onRecoveryMount1).not.toHaveBeenCalled();
    expect(onRecoveryMount2).toHaveBeenCalledTimes(1);
    expect(onRecoveryMount2.mock.calls[0][0].userId).toBe(EXISTING_SUPER_ADMIN_UUID);
    expect(onSessionVerifiedMount2).not.toHaveBeenCalled();

    stop2();
  });

  it("4. Support complet des liens email Supabase ?token_hash=...&type=recovery (verifyOtp) et PKCE ?code=... (exchangeCodeForSession) sans jamais exposer les jetons", async () => {
    const session = makeRecoverySession();
    const verifyOtp = vi.fn(async () => ({ data: { session, user: session.user }, error: null }));
    const getUser = vi.fn(async () => ({
      data: { user: { id: EXISTING_SUPER_ADMIN_UUID, email: EXISTING_SUPER_ADMIN_EMAIL } },
      error: null,
    }));

    const otpClient = {
      auth: {
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        verifyOtp,
        getUser,
      },
    } as any;

    const urlHint = inspectSupabaseRecoveryUrlHint({
      pathname: "/auth/reset-password",
      search: "?token_hash=secret_otp_hash_value_999&type=recovery",
      hash: "",
    });
    expect(urlHint.hasRecoveryParam).toBe(true);
    expect(urlHint.hasTokenHash).toBe(true);
    expect(JSON.stringify(urlHint)).not.toContain("secret_otp_hash_value_999");

    const onPasswordRecovery = vi.fn();
    const stopOtp = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => otpClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: {
          pathname: "/auth/reset-password",
          search: "?token_hash=secret_otp_hash_value_999&type=recovery",
          hash: "",
        },
      },
      onSessionVerified: vi.fn(),
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery,
      onPasswordRecoveryInvalid: vi.fn(),
    });

    await flushAsync(30);
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "secret_otp_hash_value_999",
      type: "recovery",
    });
    expect(onPasswordRecovery).toHaveBeenCalledTimes(1);
    expect(onPasswordRecovery.mock.calls[0][0].email).toBe(EXISTING_SUPER_ADMIN_EMAIL);
    stopOtp();

    clearPendingSupabaseRecoveryHint();

    // Format PKCE : /auth/reset-password?code=pkce_code_123
    let pkceCb: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;
    const exchangeCodeForSession = vi.fn(async () => ({
      data: { session, user: session.user },
      error: null,
    }));
    const pkceClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
          pkceCb = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        exchangeCodeForSession,
        getUser,
      },
    } as any;

    const onPkceRecovery = vi.fn();
    const stopPkce = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => pkceClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: {
          pathname: "/auth/reset-password",
          search: "?code=pkce_code_123",
          hash: "",
        },
      },
      onSessionVerified: vi.fn(),
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery: onPkceRecovery,
      onPasswordRecoveryInvalid: vi.fn(),
    });

    pkceCb!("INITIAL_SESSION", null);
    await flushAsync(30);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce_code_123");
    expect(onPkceRecovery).toHaveBeenCalledTimes(1);
    expect(onPkceRecovery.mock.calls[0][0].userId).toBe(EXISTING_SUPER_ADMIN_UUID);
    stopPkce();

    // Nettoyage de la route /auth/reset-password lors du retour à la connexion normale
    const replaceState = vi.fn();
    clearSensitiveAuthParamsFromUrl(
      {
        location: {
          pathname: "/auth/reset-password",
          search: "?code=pkce_code_123",
          hash: "#access_token=secret&type=recovery",
        } as Location,
        history: { replaceState } as unknown as History,
      },
      { resetToAuthRoot: true }
    );
    expect(replaceState).toHaveBeenCalledWith(null, "", "/#auth");
  });

  it("5. Cycle complet Super Admin existant : changement de mot de passe -> déconnexion -> connexion normale -> persistance rechargement F5 -> accès Console Super Admin", async () => {
    const validJwt = makeSupabaseJwt(EXISTING_SUPER_ADMIN_UUID, EXISTING_SUPER_ADMIN_EMAIL);

    // Serveur Express réel avec routes /api/auth/supabase/session et /api/admin/supabase/overview
    const gateway: SupabaseServerAuthGateway = {
      verifyAccessTokenAndGetUser: vi.fn(async (token: string) => {
        if (token !== validJwt) {
          throw new Error("Invalid JWT");
        }
        return {
          id: EXISTING_SUPER_ADMIN_UUID,
          email: EXISTING_SUPER_ADMIN_EMAIL,
          email_confirmed_at: "2026-03-01T10:00:00.000Z",
          user_metadata: {},
          app_metadata: {},
        };
      }),
      findProfileByUserId: vi.fn(async (uid: string) => {
        if (uid !== EXISTING_SUPER_ADMIN_UUID) return null;
        return {
          id: EXISTING_SUPER_ADMIN_UUID,
          email: EXISTING_SUPER_ADMIN_EMAIL,
          name: "Orthogonal Super Admin",
          display_name: "Orthogonal Super Admin",
          role: "super_admin" as const,
          status: "active" as const,
          account_type: "enterprise" as const,
          subscription_plan: "lifetime" as const,
          created_at: "2026-03-01T10:00:00.000Z",
          updated_at: "2026-03-01T10:00:00.000Z",
        };
      }),
      getSuperAdminOverview: vi.fn(async (verifiedSession) => ({
        generatedAt: new Date().toISOString(),
        verifiedSuperAdmin: {
          userId: verifiedSession.userId,
          email: verifiedSession.email,
          emailConfirmedAt: verifiedSession.emailConfirmedAt ?? "",
        },
        counts: {
          profiles: 1,
          activeProfiles: 1,
          superAdmins: 1,
          projects: 3,
          licenseKeys: 2,
          auditLogs: 5,
        },
        profiles: [
          {
            id: EXISTING_SUPER_ADMIN_UUID,
            email: EXISTING_SUPER_ADMIN_EMAIL,
            name: "Orthogonal Super Admin",
            role: "super_admin" as const,
            status: "active" as const,
            accountType: "enterprise",
            subscriptionPlan: "lifetime",
            company: "Orthogonal Engineering",
            createdAt: "2026-03-01T10:00:00.000Z",
          },
        ],
        recentAuditLogs: [],
        legacyFirestoreModulesPendingMigration: [],
      })),
    };

    const app = express();
    // Teste aussi la normalisation de casse de SUPABASE_URL (majuscules dans l'env serveur)
    const serverEnv = {
      SUPABASE_URL: "HTTPS://FFSKADAGFFDIWSDASZXU.SUPABASE.CO/",
      NODE_ENV: "test",
    };
    const authMiddleware = createRequireSupabaseAuth(serverEnv, { gateway });
    app.get("/api/auth/supabase/session", authMiddleware, (req, res) => {
      const sbReq = req as SupabaseAuthRequest;
      return res.status(200).json({ ok: true, session: sbReq.supabaseSession });
    });
    app.get(
      "/api/admin/supabase/overview",
      authMiddleware,
      requireSupabaseSuperAdmin,
      async (req, res) => {
        const sbReq = req as SupabaseAuthRequest;
        const overview = await gateway.getSuperAdminOverview!(sbReq.supabaseSession!);
        return res.status(200).json({ ok: true, overview });
      }
    );

    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const routedFetch: typeof fetch = (input, init) => {
      const url = typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
      return fetch(url, init);
    };

    try {
      const recoverySession = makeRecoverySession({ access_token: validJwt });
      let currentSession: Session | null = recoverySession;

      const fakeSupabaseClient = {
        auth: {
          getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
          getUser: vi.fn(async () => ({
            data: {
              user: currentSession
                ? { id: EXISTING_SUPER_ADMIN_UUID, email: EXISTING_SUPER_ADMIN_EMAIL }
                : null,
            },
            error: currentSession ? null : { message: "No session" },
          })),
          updateUser: vi.fn(async ({ password }: { password: string }) => {
            expect(password).toBe("SuperAdmin#2026!Secure");
            return {
              data: { user: { id: EXISTING_SUPER_ADMIN_UUID, email: EXISTING_SUPER_ADMIN_EMAIL } },
              error: null,
            };
          }),
          signOut: vi.fn(async () => {
            currentSession = null;
            return { error: null };
          }),
          signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
            if (email === EXISTING_SUPER_ADMIN_EMAIL && password === "SuperAdmin#2026!Secure") {
              currentSession = makeRecoverySession({ access_token: validJwt });
              return { data: { session: currentSession, user: currentSession.user }, error: null };
            }
            return {
              data: { session: null, user: null },
              error: { message: "Invalid login credentials" },
            };
          }),
          onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
            // Simule un rechargement F5 avec session persistée dans localStorage
            queueMicrotask(() => cb("INITIAL_SESSION", currentSession));
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          }),
        },
      } as any;

      // Étape A : Définition du nouveau mot de passe via la session de récupération
      const recoveryRes = await completeSupabasePasswordRecovery(
        "SuperAdmin#2026!Secure",
        "SuperAdmin#2026!Secure",
        {
          getClient: () => fakeSupabaseClient,
          isConfigured: () => true,
          isSandbox: () => false,
        }
      );
      expect(recoveryRes).toEqual({
        updated: true,
        userId: EXISTING_SUPER_ADMIN_UUID,
        email: EXISTING_SUPER_ADMIN_EMAIL,
      });
      // Session temporaire fermée proprement après updateUser
      expect(currentSession).toBeNull();

      // Étape B : Ancien mot de passe refusé avec erreur contrôlée
      await expect(
        loginWithSupabaseEmailPassword(EXISTING_SUPER_ADMIN_EMAIL, "AncienMotDePasseFaux", {
          getClient: () => fakeSupabaseClient,
          fetchImpl: routedFetch,
          isConfigured: () => true,
          isSandbox: () => false,
        })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof PdiSupabaseAuthError && err.code === "auth/invalid-credentials"
      );

      // Étape C : Connexion normale avec le nouveau mot de passe -> Super Admin vérifié côté serveur
      const loginRes = await loginWithSupabaseEmailPassword(
        EXISTING_SUPER_ADMIN_EMAIL,
        "SuperAdmin#2026!Secure",
        {
          getClient: () => fakeSupabaseClient,
          fetchImpl: routedFetch,
          isConfigured: () => true,
          isSandbox: () => false,
        }
      );
      expect(loginRes.isSuperAdmin).toBe(true);
      expect(loginRes.profile.uid).toBe(EXISTING_SUPER_ADMIN_UUID);
      expect(loginRes.profile.role).toBe("super_admin");
      expect(loginRes.profile.status).toBe("active");

      // Vérifie l'autorisation d'accès au module Super Admin Console
      const guard = evaluateWorkspaceAccessGuard(
        loginRes.sessionResolution,
        "super_admin_console",
        loginRes.authUser
      );
      expect(guard.allowed).toBe(true);
      expect(guard.resolvedAuthMode).toBe("super_admin");
      expect(guard.authorizedModule).toBe("super_admin_console");

      // Étape D : Rechargement de page (F5) -> INITIAL_SESSION restaure la session Super Admin sans perte
      const onReloadVerified = vi.fn();
      const onReloadRevoked = vi.fn();
      const stopMonitor = attachSupabaseAuthMonitor({
        deps: {
          getClient: () => fakeSupabaseClient,
          fetchImpl: routedFetch,
          isConfigured: () => true,
          isSandbox: () => false,
          locationLike: { pathname: "/", search: "", hash: "#app" },
        },
        onSessionVerified: onReloadVerified,
        onSessionRevokedOrSignedOut: onReloadRevoked,
      });

      await vi.waitFor(() => expect(onReloadVerified).toHaveBeenCalledTimes(1));
      expect(onReloadVerified.mock.calls[0][0].isSuperAdmin).toBe(true);
      expect(onReloadVerified.mock.calls[0][0].profile.uid).toBe(EXISTING_SUPER_ADMIN_UUID);
      expect(onReloadRevoked).not.toHaveBeenCalled();

      // Étape E : Accès réel aux fonctions autorisées Super Admin (/api/admin/supabase/overview)
      const overview = await fetchSupabaseSuperAdminOverview({
        getClient: () => fakeSupabaseClient,
        fetchImpl: routedFetch,
        isConfigured: () => true,
        isSandbox: () => false,
      });
      expect(overview.verifiedSuperAdmin.userId).toBe(EXISTING_SUPER_ADMIN_UUID);
      expect(overview.verifiedSuperAdmin.email).toBe(EXISTING_SUPER_ADMIN_EMAIL);
      expect(overview.counts.superAdmins).toBe(1);

      stopMonitor();
      await logoutSupabase({
        getClient: () => fakeSupabaseClient,
        isConfigured: () => true,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("6. Vérification structurelle : Suspense garanti autour de PdiAuthPage, route /auth/reset-password reconnue, zéro trace Firebase Auth dans le boot/app", () => {
    const unifiedSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/pdi/app/PdiUnifiedApp.tsx"),
      "utf8"
    );
    const supabaseAuthSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/supabaseAuth.ts"),
      "utf8"
    );

    // Tous les rendus de <PdiAuthPage (lazy) doivent être entourés de <React.Suspense
    const pdiAuthPageUsages = unifiedSrc.match(/<PdiAuthPage\b/g) ?? [];
    const suspenseWrappersForAuth =
      unifiedSrc.match(/<React\.Suspense[\s\S]{0,350}<PdiAuthPage\b/g) ?? [];
    expect(pdiAuthPageUsages.length).toBeGreaterThanOrEqual(2);
    expect(suspenseWrappersForAuth.length).toBe(pdiAuthPageUsages.length);

    // Détection explicite de la route /auth/reset-password
    expect(unifiedSrc).toContain("/auth/reset-password");
    expect(supabaseAuthSrc).toContain('SUPABASE_PASSWORD_RESET_ROUTE = "/auth/reset-password"');

    // Aucune trace Firebase dans PdiUnifiedApp.tsx (imports, commentaires de garde ou auth)
    expect(unifiedSrc).not.toContain('from "../../lib/firebase"');
    expect(unifiedSrc).not.toContain("firebase/auth");
    expect(unifiedSrc).not.toContain("session Firebase valide");
    expect(unifiedSrc).not.toContain("profil Firestore");
  });
});
