import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import PdiAuthPage, {
  LOGIN_EMAIL_PLACEHOLDER,
  SUPABASE_UNCONFIGURED_RESET_ERROR,
  executeSupabaseExclusiveLogin,
  executeSupabaseExclusivePasswordRecoveryUpdate,
} from "../../pdi/auth/PdiAuthPage";
import {
  PdiSupabaseAuthError,
  SUPABASE_RECOVERY_MIN_PASSWORD_LENGTH,
  attachSupabaseAuthMonitor,
  clearSensitiveAuthParamsFromUrl,
  completeSupabasePasswordRecovery,
  inspectSupabaseRecoveryUrlHint,
  sanitizeSupabaseAuthErrorText,
  validateActiveSupabaseRecoverySession,
  validateSupabaseRecoveryPassword,
  type SupabasePasswordRecoveryContext,
  type SupabaseVerifiedLoginResult,
} from "../../lib/supabaseAuth";

const PRESERVED_SUPER_ADMIN_UUID = "7243efe7-113d-45f2-8f2e-044799b25ff0";
const PRESERVED_SUPER_ADMIN_EMAIL = "orthogonaleng@gmail.com";
const LEGACY_WRONG_EMAIL = "orthognaleng@gmail.com";

function makeSyntheticJwt(sub: string, email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      email,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const signature = Buffer.from("synthetic-signature-for-unit-test").toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function makeFakeSession(overrides?: Partial<Session>): Session {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: makeSyntheticJwt(PRESERVED_SUPER_ADMIN_UUID, PRESERVED_SUPER_ADMIN_EMAIL),
    refresh_token: "synthetic_refresh_tok_do_not_leak_998877",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: nowSec + 3600,
    user: {
      id: PRESERVED_SUPER_ADMIN_UUID,
      email: PRESERVED_SUPER_ADMIN_EMAIL,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  } as Session;
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MIG-04-AUTH-02 — Parcours complet de récupération de mot de passe Supabase", () => {
  it("1. Ouverture normale de PdiAuthPage : l'écran de récupération n'apparaît PAS sans session recovery validée", () => {
    const html = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: true,
      })
    );

    expect(html).toContain('data-testid="pdi-supabase-login-form"');
    expect(html).not.toContain('data-testid="pdi-supabase-recovery-update-form"');
    expect(html).not.toContain('data-testid="pdi-supabase-recovery-success"');
    expect(html).not.toContain("Enregistrer le nouveau mot de passe");
  });

  it("2. Événement PASSWORD_RECOVERY avec session Supabase réellement valide -> affiche l'interface dédiée (sans exposer aucun token ni déconnecter prématurément)", async () => {
    const session = makeFakeSession();
    let capturedCallback: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;
    const unsubscribe = vi.fn();
    const signOut = vi.fn(async () => ({ error: null }));
    const getUser = vi.fn(async () => ({
      data: {
        user: {
          id: PRESERVED_SUPER_ADMIN_UUID,
          email: PRESERVED_SUPER_ADMIN_EMAIL,
        },
      },
      error: null,
    }));

    const fakeClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe } } };
        }),
        getUser,
        signOut,
      },
    } as any;

    const onSessionVerified = vi.fn();
    const onSessionRevokedOrSignedOut = vi.fn();
    const onPasswordRecovery = vi.fn<(ctx: SupabasePasswordRecoveryContext) => void>();
    const onPasswordRecoveryInvalid = vi.fn();

    const stop = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: { search: "", hash: "#type=recovery" },
      },
      onSessionVerified,
      onSessionRevokedOrSignedOut,
      onPasswordRecovery,
      onPasswordRecoveryInvalid,
    });

    expect(capturedCallback).not.toBeNull();
    capturedCallback!("PASSWORD_RECOVERY", session);
    await flushAsync();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(onPasswordRecovery).toHaveBeenCalledTimes(1);
    const receivedContext = onPasswordRecovery.mock.calls[0][0];
    expect(receivedContext.userId).toBe(PRESERVED_SUPER_ADMIN_UUID);
    expect(receivedContext.email).toBe(PRESERVED_SUPER_ADMIN_EMAIL);
    // Vérification stricte : aucun access_token ni refresh_token dans le contexte transmis à l'UI
    expect(JSON.stringify(receivedContext)).not.toContain(session.access_token);
    expect(JSON.stringify(receivedContext)).not.toContain(session.refresh_token);
    expect(JSON.stringify(receivedContext)).not.toContain("access_token");
    expect(JSON.stringify(receivedContext)).not.toContain("refresh_token");

    // Aucune déconnexion prématurée, aucune entrée automatique dans le workspace
    expect(signOut).not.toHaveBeenCalled();
    expect(onSessionVerified).not.toHaveBeenCalled();
    expect(onPasswordRecoveryInvalid).not.toHaveBeenCalled();

    // Rendu de l'interface dédiée lorsque passwordRecoveryMode=true
    const recoveryHtml = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: true,
        passwordRecoveryMode: true,
        passwordRecoveryEmail: receivedContext.email,
      })
    );

    expect(recoveryHtml).toContain('data-testid="pdi-supabase-recovery-update-form"');
    expect(recoveryHtml).toContain("Nouveau mot de passe");
    expect(recoveryHtml).toContain("Confirmation du nouveau mot de passe");
    expect(recoveryHtml).toContain("Enregistrer le nouveau mot de passe");
    expect(recoveryHtml).toContain('data-testid="pdi-recovery-new-password-input"');
    expect(recoveryHtml).toContain('data-testid="pdi-recovery-confirm-password-input"');
    expect(recoveryHtml).toContain('data-testid="pdi-recovery-submit-btn"');
    expect(recoveryHtml).not.toContain('data-testid="pdi-supabase-login-form"');
    expect(recoveryHtml).not.toContain(session.access_token);
    expect(recoveryHtml).not.toContain(session.refresh_token);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("3. Un simple paramètre URL (?type=recovery ou #type=recovery) SANS session Supabase valide n'ouvre JAMAIS le mode récupération", async () => {
    let capturedCallback: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;
    const fakeClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    } as any;

    const onPasswordRecovery = vi.fn();
    const onPasswordRecoveryInvalid = vi.fn();
    const onSessionVerified = vi.fn();

    const stop = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: { search: "?type=recovery", hash: "" },
      },
      onSessionVerified,
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery,
      onPasswordRecoveryInvalid,
    });

    capturedCallback!("INITIAL_SESSION", null);
    await flushAsync();

    expect(onPasswordRecovery).not.toHaveBeenCalled();
    expect(onSessionVerified).not.toHaveBeenCalled();
    expect(onPasswordRecoveryInvalid).toHaveBeenCalledTimes(1);
    expect(onPasswordRecoveryInvalid.mock.calls[0][0].code).toBe("auth/recovery-session-missing");

    stop();
  });

  it("4. URL de retour contenant une erreur Supabase (otp_expired / access_denied) -> refus contrôlé + nettoyage URL sensible", async () => {
    const hint = inspectSupabaseRecoveryUrlHint({
      search: "",
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    });
    expect(hint.hasError).toBe(true);
    expect(hint.errorCode).toBe("otp_expired");
    expect(hint.userMessage).toContain("invalide ou expiré");

    let capturedCallback: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;
    const fakeClient = {
      auth: {
        onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    } as any;

    const onPasswordRecovery = vi.fn();
    const onPasswordRecoveryInvalid = vi.fn();

    const stop = attachSupabaseAuthMonitor({
      deps: {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
        locationLike: {
          search: "",
          hash: "#error=access_denied&error_code=otp_expired&error_description=Link+expired",
        },
      },
      onSessionVerified: vi.fn(),
      onSessionRevokedOrSignedOut: vi.fn(),
      onPasswordRecovery,
      onPasswordRecoveryInvalid,
    });

    capturedCallback!("INITIAL_SESSION", null);
    await flushAsync();

    expect(onPasswordRecovery).not.toHaveBeenCalled();
    expect(onPasswordRecoveryInvalid).toHaveBeenCalledTimes(1);
    expect(onPasswordRecoveryInvalid.mock.calls[0][0].code).toBe("otp_expired");

    // Vérification du nettoyage des tokens/erreurs dans la barre d'adresse
    const replaceState = vi.fn();
    clearSensitiveAuthParamsFromUrl({
      location: {
        pathname: "/",
        search: "?code=secret_pkce_code&type=recovery",
        hash: "#access_token=eyJabc.def.ghi&refresh_token=secret_refresh&type=recovery",
      } as Location,
      history: { replaceState } as unknown as History,
    });
    expect(replaceState).toHaveBeenCalledTimes(1);
    const cleanedUrl = replaceState.mock.calls[0][2] as string;
    expect(cleanedUrl).toBe("/#auth");
    expect(cleanedUrl).not.toContain("access_token");
    expect(cleanedUrl).not.toContain("refresh_token");
    expect(cleanedUrl).not.toContain("secret_pkce_code");

    // Rendu de l'erreur contrôlée sur la page d'authentification
    const errorHtml = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: true,
        passwordRecoveryMode: false,
        passwordRecoveryError: onPasswordRecoveryInvalid.mock.calls[0][0].message,
      })
    );
    expect(errorHtml).toContain('data-testid="pdi-auth-error-banner"');
    expect(errorHtml).toContain("invalide ou expiré");

    stop();
  });

  it("5. Session de récupération absente -> refusé avant tout appel updateUser", async () => {
    const updateUser = vi.fn();
    const fakeClient = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        updateUser,
      },
    } as any;

    await expect(
      completeSupabasePasswordRecovery("NouveauMotDePasse#2026", "NouveauMotDePasse#2026", {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    ).rejects.toMatchObject({
      code: "auth/recovery-session-missing",
      status: 401,
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("6. Session de récupération expirée -> refusé avant tout appel updateUser", async () => {
    const expiredSession = makeFakeSession({
      expires_at: Math.floor(Date.now() / 1000) - 120,
    });
    const updateUser = vi.fn();
    const fakeClient = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: expiredSession }, error: null })),
        getUser: vi.fn(),
        updateUser,
      },
    } as any;

    await expect(
      completeSupabasePasswordRecovery("NouveauMotDePasse#2026", "NouveauMotDePasse#2026", {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    ).rejects.toMatchObject({
      code: "auth/recovery-session-expired",
      status: 401,
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("7. Session de récupération invalide (rejetée par getUser()) -> refusé avant tout appel updateUser", async () => {
    const session = makeFakeSession();
    const updateUser = vi.fn();
    const fakeClient = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: "Invalid JWT token" },
        })),
        updateUser,
      },
    } as any;

    const validation = await validateActiveSupabaseRecoverySession({
      getClient: () => fakeClient,
      isConfigured: () => true,
      isSandbox: () => false,
    });
    expect(validation.valid).toBe(false);
    if ("code" in validation) {
      expect(validation.code).toBe("auth/recovery-session-invalid");
    }

    await expect(
      completeSupabasePasswordRecovery("NouveauMotDePasse#2026", "NouveauMotDePasse#2026", {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    ).rejects.toMatchObject({
      code: "auth/recovery-session-invalid",
      status: 401,
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("8. Mots de passe non concordants ou non conformes -> refusé sans appeler updateUser", async () => {
    const updateUser = vi.fn();
    const fakeClient = {
      auth: {
        getSession: vi.fn(),
        updateUser,
      },
    } as any;

    // Non concordants
    const mismatch = validateSupabaseRecoveryPassword("SecretStrong123!", "SecretStrong999!");
    expect(mismatch.valid).toBe(false);
    if ("code" in mismatch) {
      expect(mismatch.code).toBe("auth/password-mismatch");
    }

    await expect(
      completeSupabasePasswordRecovery("SecretStrong123!", "SecretStrong999!", {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    ).rejects.toMatchObject({
      code: "auth/password-mismatch",
      status: 400,
    });

    // Trop court (< 6 caractères)
    expect(SUPABASE_RECOVERY_MIN_PASSWORD_LENGTH).toBe(6);
    await expect(
      completeSupabasePasswordRecovery("12345", "12345", {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    ).rejects.toMatchObject({
      code: "auth/weak-password",
      status: 400,
    });

    // Espaces uniquement
    await expect(
      completeSupabasePasswordRecovery("      ", "      ", {
        getClient: () => fakeClient,
        isConfigured: () => true,
        isSandbox: () => false,
      })
    ).rejects.toMatchObject({
      code: "auth/weak-password",
      status: 400,
    });

    // Vide
    await expect(
      executeSupabaseExclusivePasswordRecoveryUpdate("", "", {
        supabaseAvailable: true,
      })
    ).rejects.toMatchObject({
      code: "auth/missing-password",
      status: 400,
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("9. Mise à jour réussie via supabase.auth.updateUser({ password }) : préserve UUID/rôle/statut, n'exige pas l'ancien mot de passe, déconnecte APRÈS succès et affiche la confirmation", async () => {
    const session = makeFakeSession();
    const callOrder: string[] = [];

    const signInWithPassword = vi.fn();
    const updateUser = vi.fn(async (payload: Record<string, unknown>) => {
      callOrder.push("updateUser");
      return {
        data: {
          user: {
            id: PRESERVED_SUPER_ADMIN_UUID,
            email: PRESERVED_SUPER_ADMIN_EMAIL,
          },
        },
        error: null,
        _receivedPayload: payload,
      };
    });
    const signOut = vi.fn(async () => {
      callOrder.push("signOut");
      return { error: null };
    });

    const fakeClient = {
      auth: {
        getSession: vi.fn(async () => {
          callOrder.push("getSession");
          return { data: { session }, error: null };
        }),
        getUser: vi.fn(async () => {
          callOrder.push("getUser");
          return {
            data: {
              user: {
                id: PRESERVED_SUPER_ADMIN_UUID,
                email: PRESERVED_SUPER_ADMIN_EMAIL,
              },
            },
            error: null,
          };
        }),
        updateUser,
        signOut,
        signInWithPassword,
      },
    } as any;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await executeSupabaseExclusivePasswordRecoveryUpdate(
      "Orthogonal#NewPass2026!",
      "Orthogonal#NewPass2026!",
      {
        supabaseAvailable: true,
        completeRecoveryFn: (pwd, confirm) =>
          completeSupabasePasswordRecovery(pwd, confirm, {
            getClient: () => fakeClient,
            isConfigured: () => true,
            isSandbox: () => false,
          }),
      }
    );

    expect(res).toEqual({
      updated: true,
      userId: PRESERVED_SUPER_ADMIN_UUID,
      email: PRESERVED_SUPER_ADMIN_EMAIL,
    });

    // Vérification stricte de l'appel updateUser : UNIQUEMENT { password } (aucune modification de rôle, statut, email ou metadata)
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ password: "Orthogonal#NewPass2026!" });
    expect(Object.keys(updateUser.mock.calls[0][0])).toEqual(["password"]);

    // L'ancien mot de passe n'est jamais demandé / vérifié via signInWithPassword
    expect(signInWithPassword).not.toHaveBeenCalled();

    // Ordre critique : getSession -> getUser -> updateUser -> signOut (jamais de signOut avant updateUser)
    expect(callOrder).toEqual(["getSession", "getUser", "updateUser", "signOut"]);

    // Zéro fuite de token dans la console ou la valeur retournée
    const allLogs = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
      JSON.stringify(res),
    ].join(" ");
    expect(allLogs).not.toContain(session.access_token);
    expect(allLogs).not.toContain(session.refresh_token);
    expect(allLogs).not.toContain("Orthogonal#NewPass2026!");

    // Rendu de l'écran de confirmation et du bouton de retour à la connexion normale
    const successHtml = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: true,
        passwordRecoveryMode: true,
        initialRecoveryCompleted: true,
      })
    );
    expect(successHtml).toContain('data-testid="pdi-supabase-recovery-success"');
    expect(successHtml).toContain("Mot de passe mis à jour avec succès");
    expect(successHtml).toContain('data-testid="pdi-recovery-back-to-login-btn"');
    expect(successHtml).toContain("Revenir à la connexion normale");
  });

  it("10. Erreur Supabase ou réseau contenant des tokens -> erreur contrôlée, ZÉRO fuite de access_token / refresh_token dans l'erreur ou les logs", async () => {
    const session = makeFakeSession();
    const leakedRawError = `Supabase error: Bearer ${session.access_token} access_token=${session.access_token} refresh_token=${session.refresh_token}`;

    // Test de sanitizeSupabaseAuthErrorText
    const sanitized = sanitizeSupabaseAuthErrorText(leakedRawError);
    expect(sanitized).not.toContain(session.access_token);
    expect(sanitized).not.toContain(session.refresh_token);
    expect(sanitized).toContain("[REDACTED");

    // Test erreur retournée par updateUser
    const signOut = vi.fn();
    const fakeClientError = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
        getUser: vi.fn(async () => ({
          data: { user: { id: PRESERVED_SUPER_ADMIN_UUID, email: PRESERVED_SUPER_ADMIN_EMAIL } },
          error: null,
        })),
        updateUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: leakedRawError },
        })),
        signOut,
      },
    } as any;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let caughtErr: unknown = null;
    try {
      await completeSupabasePasswordRecovery("Orthogonal#2026!", "Orthogonal#2026!", {
        getClient: () => fakeClientError,
        isConfigured: () => true,
        isSandbox: () => false,
      });
    } catch (e) {
      caughtErr = e;
    }

    expect(caughtErr).toBeInstanceOf(PdiSupabaseAuthError);
    const err = caughtErr as PdiSupabaseAuthError;
    expect(err.code).toBe("auth/password-update-failed");
    expect(err.message).not.toContain(session.access_token);
    expect(err.message).not.toContain(session.refresh_token);
    // Ne doit pas avoir déconnecté la session de récupération si updateUser échoue
    expect(signOut).not.toHaveBeenCalled();

    // Test exception réseau sur updateUser
    const fakeClientNetwork = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
        getUser: vi.fn(async () => ({
          data: { user: { id: PRESERVED_SUPER_ADMIN_UUID, email: PRESERVED_SUPER_ADMIN_EMAIL } },
          error: null,
        })),
        updateUser: vi.fn(async () => {
          throw new Error(`Network failed with token=${session.access_token}`);
        }),
        signOut,
      },
    } as any;

    let netErr: unknown = null;
    try {
      await completeSupabasePasswordRecovery("Orthogonal#2026!", "Orthogonal#2026!", {
        getClient: () => fakeClientNetwork,
        isConfigured: () => true,
        isSandbox: () => false,
      });
    } catch (e) {
      netErr = e;
    }

    expect(netErr).toBeInstanceOf(PdiSupabaseAuthError);
    expect((netErr as PdiSupabaseAuthError).code).toBe("auth/network-error");
    expect((netErr as PdiSupabaseAuthError).message).not.toContain(session.access_token);

    const allConsoleOutput = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].join(" ");
    expect(allConsoleOutput).not.toContain(session.access_token);
    expect(allConsoleOutput).not.toContain(session.refresh_token);
  });

  it("11. Supabase non configuré -> bloque explicitement la finalisation de récupération sans aucune bascule Firebase", async () => {
    const completeRecoveryFn = vi.fn();

    await expect(
      executeSupabaseExclusivePasswordRecoveryUpdate("Orthogonal#2026!", "Orthogonal#2026!", {
        supabaseAvailable: false,
        completeRecoveryFn,
      })
    ).rejects.toMatchObject({
      code: "client/supabase-unconfigured",
      status: 503,
      message: SUPABASE_UNCONFIGURED_RESET_ERROR,
    });

    expect(completeRecoveryFn).not.toHaveBeenCalled();

    // Vérification statique qu'aucun fallback Firebase Auth n'a été réintroduit
    const authPageSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/pdi/auth/PdiAuthPage.tsx"),
      "utf8"
    );
    const supabaseAuthSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/supabaseAuth.ts"),
      "utf8"
    );
    expect(authPageSrc).not.toContain("loginWithEmailAndPasswordSecure");
    expect(authPageSrc).not.toContain("sendPasswordResetEmail");
    expect(supabaseAuthSrc).not.toContain("firebase/auth");
    expect(supabaseAuthSrc).not.toContain("sendPasswordResetEmail");
  });
});

describe("MIG-04-AUTH-02 — Nettoyage du champ e-mail de connexion (aucune adresse préremplie ou en placeholder)", () => {
  it("12. À l'ouverture normale de PdiAuthPage, le champ e-mail est vide (value=\"\") et son placeholder est exactement \"Adresse e-mail\"", () => {
    expect(LOGIN_EMAIL_PLACEHOLDER).toBe("Adresse e-mail");

    const html = renderToStaticMarkup(
      React.createElement(PdiAuthPage, {
        onSuccess: vi.fn(),
        onBackToLanding: vi.fn(),
        supabaseConfiguredOverride: true,
      })
    );

    // Extraire la balise <input ... data-testid="pdi-login-email-input" ... />
    const inputMatch = html.match(/<input[^>]*data-testid="pdi-login-email-input"[^>]*>/);
    expect(inputMatch).not.toBeNull();
    const emailInputTag = inputMatch![0];

    expect(emailInputTag).toContain('value=""');
    expect(emailInputTag).toContain('placeholder="Adresse e-mail"');
    expect(emailInputTag).not.toContain(PRESERVED_SUPER_ADMIN_EMAIL);
    expect(emailInputTag).not.toContain(LEGACY_WRONG_EMAIL);

    // Vérification globale sur l'ensemble du HTML initial de la page de connexion
    expect(html).not.toContain(PRESERVED_SUPER_ADMIN_EMAIL);
    expect(html).not.toContain(LEGACY_WRONG_EMAIL);
  });

  it("13. Aucun mécanisme dans PdiAuthPage.tsx ne préremplit ni ne réinjecte orthogonaleng@gmail.com dans le champ e-mail", () => {
    const authPageSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/pdi/auth/PdiAuthPage.tsx"),
      "utf8"
    );

    expect(authPageSrc).toContain('const [loginEmail, setLoginEmail] = useState("");');
    expect(authPageSrc).toContain('const [resetEmail, setResetEmail] = useState("");');
    expect(authPageSrc).toContain('export const LOGIN_EMAIL_PLACEHOLDER = "Adresse e-mail" as const;');
    expect(authPageSrc).not.toContain(PRESERVED_SUPER_ADMIN_EMAIL);
    expect(authPageSrc).not.toContain(LEGACY_WRONG_EMAIL);
    // Vérifier qu'aucun localStorage ne réinjecte loginEmail
    expect(authPageSrc).not.toMatch(/setLoginEmail\s*\(\s*localStorage/i);
  });

  it("14. La saisie manuelle de orthogonaleng@gmail.com fonctionne normalement pour la connexion Super Admin et conserve UUID/rôle/statut", async () => {
    const mockLoginFn = vi.fn(async (email: string, password: string): Promise<SupabaseVerifiedLoginResult> => {
      expect(email).toBe(PRESERVED_SUPER_ADMIN_EMAIL);
      expect(password).toBe("ManualEnteredPass#2026");
      return {
        provider: "supabase",
        isSuperAdmin: true,
        emailConfirmed: true,
        tokenExp: Math.floor(Date.now() / 1000) + 3600,
        sessionResolution: {
          authorized: true,
          isSuperAdmin: true,
          role: "super_admin",
          status: "active",
        } as any,
        authUser: {
          uid: PRESERVED_SUPER_ADMIN_UUID,
          email: PRESERVED_SUPER_ADMIN_EMAIL,
          emailVerified: true,
          provider: "supabase",
        },
        profile: {
          uid: PRESERVED_SUPER_ADMIN_UUID,
          email: PRESERVED_SUPER_ADMIN_EMAIL,
          name: "Super Admin Orthogonal",
          role: "super_admin",
          status: "active",
          plan: "enterprise",
        } as any,
      };
    });

    const result = await executeSupabaseExclusiveLogin(
      PRESERVED_SUPER_ADMIN_EMAIL,
      "ManualEnteredPass#2026",
      {
        supabaseAvailable: true,
        loginFn: mockLoginFn,
      }
    );

    expect(mockLoginFn).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("supabase");
    expect(result.isSuperAdmin).toBe(true);
    expect(result.authUser.uid).toBe(PRESERVED_SUPER_ADMIN_UUID);
    expect(result.authUser.email).toBe(PRESERVED_SUPER_ADMIN_EMAIL);
    expect(result.profile.role).toBe("super_admin");
    expect(result.profile.status).toBe("active");
  });
});
