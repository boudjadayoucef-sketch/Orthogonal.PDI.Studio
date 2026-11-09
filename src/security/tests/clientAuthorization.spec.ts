/**
 * SEC-01-FIX-03-R2 — Tests unitaires et tests asynchrones réels du listener de production
 *
 * Vérifie :
 * - B1 : Fail-closed immédiat au changement de compte (les droits Super Admin disparaissent
 *        synchronement dès la détection d'un nouveau compte, avant la résolution du token).
 * - B2 : Exécution directe du vrai gestionnaire de production `attachSuperAdminTokenMonitor`
 *        utilisé par `PdiUnifiedApp.tsx` avec promesses différées, faux listener `onIdTokenChanged`,
 *        changements de comptes, déconnexions, erreurs réseau et démontage.
 * - B3 : Révocation immédiate et refus strict en cas d'incohérence entre `auth.currentUser.uid`
 *        et l'UID du callback traité.
 * - Maintien des invariants A1, A2, A3 (`claims.role === "super_admin"` et `claims.email_verified === true` strict).
 */

import { describe, it, expect, vi } from "vitest";
import {
  isSuperAdminClaimAuthorized,
  isSuperAdminFromTokenResult,
  verifySuperAdminFromFirebaseUser,
  isRestrictedAdminView,
  getAuthorizedView,
  SUPER_ADMIN_RESTRICTED_VIEWS,
  resolveNextAuthMode,
  attachSuperAdminTokenMonitor,
  type TokenMonitorUser
} from "../clientAuthorization";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createTokenMonitorHarness(initialAuthMode = "guest", initialModule = "home") {
  let authMode = initialAuthMode;
  let activeModule = initialModule;
  const authStateHistory: string[] = [];
  let currentListener: ((user: TokenMonitorUser | null) => void | Promise<void>) | null = null;
  let unsubscribedCount = 0;

  const mockAuth: { currentUser: { uid: string } | null } = {
    currentUser: null
  };

  const setAuthModeSpy = vi.fn((updater: (prev: string) => string) => {
    authMode = updater(authMode);
    authStateHistory.push(authMode);
    if (isRestrictedAdminView(activeModule) && authMode !== "super_admin") {
      activeModule = "isometric";
    }
  });

  const onAdminRevokedSpy = vi.fn(() => {
    if (isRestrictedAdminView(activeModule)) {
      activeModule = "isometric";
    }
  });

  const cleanup = attachSuperAdminTokenMonitor({
    auth: mockAuth,
    subscribeIdTokenChanged: (cb) => {
      currentListener = cb;
      return () => {
        unsubscribedCount += 1;
        currentListener = null;
      };
    },
    setAuthMode: setAuthModeSpy,
    onAdminRevoked: onAdminRevokedSpy
  });

  const emitTokenChange = (user: TokenMonitorUser | null) => {
    if (!currentListener) {
      throw new Error("Listener is not subscribed");
    }
    return currentListener(user);
  };

  return {
    get authMode() {
      return authMode;
    },
    set authMode(val: string) {
      authMode = val;
    },
    get activeModule() {
      return activeModule;
    },
    set activeModule(val: string) {
      activeModule = val;
    },
    get unsubscribedCount() {
      return unsubscribedCount;
    },
    authStateHistory,
    mockAuth,
    setAuthModeSpy,
    onAdminRevokedSpy,
    emitTokenChange,
    cleanup
  };
}

describe("SEC-01-FIX-03-R2: Real Production Token Monitor (B1 / B2 / B3) & Asynchronous Scenarios", () => {
  // Scénario 1 : Session A Super Admin, puis connexion du compte B client : les droits A disparaissent immédiatement
  it("Scenario 1 (B1): Session A Super Admin followed by account B login revokes A's privileges immediately before B's token resolves", async () => {
    const harness = createTokenMonitorHarness("client", "home");

    // 1. Connexion du compte A (Super Admin)
    const deferredA = createDeferred<{ claims: Record<string, unknown> }>();
    const userA: TokenMonitorUser = {
      uid: "uid-super-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredA.promise)
    };
    harness.mockAuth.currentUser = { uid: "uid-super-A" };
    const promiseA = harness.emitTokenChange(userA);
    deferredA.resolve({ claims: { role: "super_admin", email_verified: true } });
    await promiseA;

    expect(harness.authMode).toBe("super_admin");
    harness.activeModule = "super_admin_console";
    expect(getAuthorizedView(harness.activeModule, harness.authMode === "super_admin", "isometric")).toBe(
      "super_admin_console"
    );

    // 2. Changement de compte vers B (Client) dont le token est encore en attente (promesse non résolue)
    const deferredB = createDeferred<{ claims: Record<string, unknown> }>();
    const userB: TokenMonitorUser = {
      uid: "uid-client-B",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredB.promise)
    };
    harness.mockAuth.currentUser = { uid: "uid-client-B" };
    const promiseB = harness.emitTokenChange(userB);

    // VÉRIFICATION CRITIQUE B1 : Synchronement, AVANT que deferredB ne soit résolue,
    // authMode n'est PLUS "super_admin" et la console Super Admin / générateur de licences sont inaccessibles.
    expect(harness.authMode).toBe("client");
    expect(harness.activeModule).toBe("isometric");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe("isometric");
    expect(getAuthorizedView("license_keys", harness.authMode === "super_admin", "isometric")).toBe("isometric");

    // 3. Résolution du token de B (client)
    deferredB.resolve({ claims: { role: "client", email_verified: true } });
    await promiseB;

    expect(harness.authMode).toBe("client");
    expect(harness.activeModule).toBe("isometric");
  });

  // Scénario 2 : La promesse de vérification de A se résout après celle de B : A ne peut pas rétablir ses droits
  it("Scenario 2 (B2/A2): Deferred token verification of Super Admin A resolving after Client B cannot restore Super Admin rights", async () => {
    const harness = createTokenMonitorHarness("client", "isometric");

    const deferredA = createDeferred<{ claims: Record<string, unknown> }>();
    const userA: TokenMonitorUser = {
      uid: "uid-super-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredA.promise)
    };

    const deferredB = createDeferred<{ claims: Record<string, unknown> }>();
    const userB: TokenMonitorUser = {
      uid: "uid-client-B",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredB.promise)
    };

    // A démarre sa vérification mais sa promesse reste en suspens
    harness.mockAuth.currentUser = { uid: "uid-super-A" };
    const pendingA = harness.emitTokenChange(userA);

    // B se connecte avant que A n'ait résolu son token
    harness.mockAuth.currentUser = { uid: "uid-client-B" };
    const pendingB = harness.emitTokenChange(userB);

    // Le token de B se résout en premier avec un rôle client
    deferredB.resolve({ claims: { role: "client", email_verified: true } });
    await pendingB;
    expect(harness.authMode).toBe("client");

    // Le token de A se résout ENSUITE avec les claims Super Admin
    deferredA.resolve({ claims: { role: "super_admin", email_verified: true } });
    await pendingA;

    // A ne doit JAMAIS pouvoir rétablir super_admin
    expect(harness.authMode).toBe("client");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe("isometric");
  });

  // Scénario 3 : Déconnexion pendant l'attente du token : aucun droit privilégié ne revient
  it("Scenario 3: Sign-out during pending token resolution prevents any privileged state restoration", async () => {
    const harness = createTokenMonitorHarness("client", "home");

    const deferredA = createDeferred<{ claims: Record<string, unknown> }>();
    const userA: TokenMonitorUser = {
      uid: "uid-super-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredA.promise)
    };

    harness.mockAuth.currentUser = { uid: "uid-super-A" };
    const pendingA = harness.emitTokenChange(userA);

    // Déconnexion pendant que deferredA est en attente
    harness.mockAuth.currentUser = null;
    await harness.emitTokenChange(null);
    expect(harness.authMode).toBe("client");

    // La promesse de A se résout tardivement avec super_admin
    deferredA.resolve({ claims: { role: "super_admin", email_verified: true } });
    await pendingA;

    // Aucun droit privilégié ne revient
    expect(harness.authMode).not.toBe("super_admin");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe("isometric");
  });

  // Scénario 4 : Changement de UID pendant l'attente : ancien callback ignoré
  it("Scenario 4: UID switch during pending token check ignores the obsolete callback completely", async () => {
    const harness = createTokenMonitorHarness("client", "home");

    const deferredA = createDeferred<{ claims: Record<string, unknown> }>();
    const userA: TokenMonitorUser = {
      uid: "uid-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredA.promise)
    };

    const deferredC = createDeferred<{ claims: Record<string, unknown> }>();
    const userC: TokenMonitorUser = {
      uid: "uid-C",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredC.promise)
    };

    harness.mockAuth.currentUser = { uid: "uid-A" };
    const pendingA = harness.emitTokenChange(userA);

    // Changement vers uid-C (dont le token est toujours en attente)
    harness.mockAuth.currentUser = { uid: "uid-C" };
    const pendingC = harness.emitTokenChange(userC);

    // L'ancien callback A se résout pendant que C attend encore son token
    deferredA.resolve({ claims: { role: "super_admin", email_verified: true } });
    await pendingA;

    // L'état doit rester non privilégié ("client")
    expect(harness.authMode).toBe("client");

    // Puis C se résout comme client
    deferredC.resolve({ claims: { role: "client", email_verified: true } });
    await pendingC;
    expect(harness.authMode).toBe("client");
  });

  // Scénario 5 : Erreur de récupération du token : état non privilégié
  it("Scenario 5: Token retrieval error forces non-privileged state even if previously Super Admin", async () => {
    const harness = createTokenMonitorHarness("client", "home");

    let shouldFail = false;
    const userA: TokenMonitorUser = {
      uid: "uid-super-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(async () => {
        if (shouldFail) {
          throw new Error("Firebase network error");
        }
        return { claims: { role: "super_admin", email_verified: true } };
      })
    };

    harness.mockAuth.currentUser = { uid: "uid-super-A" };
    await harness.emitTokenChange(userA);
    expect(harness.authMode).toBe("super_admin");
    harness.activeModule = "license_keys";

    // Rafraîchissement du token échouant avec une erreur réseau
    shouldFail = true;
    await harness.emitTokenChange(userA);

    expect(harness.authMode).toBe("client");
    expect(harness.activeModule).toBe("isometric");
  });

  // Scénario 6 : Révocation des claims : accès administratif refusé après réception du token actualisé
  it("Scenario 6: Revocation of Super Admin claims on token refresh immediately revokes admin access without refresh loop", async () => {
    const harness = createTokenMonitorHarness("client", "home");

    let currentClaims: Record<string, unknown> = { role: "super_admin", email_verified: true };
    const getIdTokenResultMock = vi.fn(async (_forceRefresh?: boolean) => ({
      claims: currentClaims
    }));

    const userA: TokenMonitorUser = {
      uid: "uid-super-A",
      emailVerified: true,
      getIdTokenResult: getIdTokenResultMock
    };

    // 1. Démarrage de session : forceRefresh = true
    harness.mockAuth.currentUser = { uid: "uid-super-A" };
    await harness.emitTokenChange(userA);
    expect(getIdTokenResultMock).toHaveBeenNthCalledWith(1, true);
    expect(harness.authMode).toBe("super_admin");
    harness.activeModule = "super_admin_console";

    // 2. Révocation des claims côté serveur et notification via onIdTokenChanged : forceRefresh = false
    currentClaims = { role: "client", email_verified: true };
    await harness.emitTokenChange(userA);
    expect(getIdTokenResultMock).toHaveBeenNthCalledWith(2, false);

    expect(harness.authMode).toBe("client");
    expect(harness.activeModule).toBe("isometric");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe("isometric");
    expect(getAuthorizedView("license_keys", harness.authMode === "super_admin", "isometric")).toBe("isometric");
  });

  // Scénario 7 : Incohérence entre UID actif et UID du callback : refus des privilèges
  it("Scenario 7 (B3): Mismatch between auth.currentUser.uid and callback user.uid immediately revokes and denies privileges", async () => {
    const harness = createTokenMonitorHarness("super_admin", "super_admin_console");

    // Cas 7a : Incohérence dès l'entrée du callback
    const userA: TokenMonitorUser = {
      uid: "uid-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(async () => ({
        claims: { role: "super_admin", email_verified: true }
      }))
    };
    harness.mockAuth.currentUser = { uid: "uid-different-active" };
    await harness.emitTokenChange(userA);

    expect(harness.authMode).toBe("client");
    expect(harness.activeModule).toBe("isometric");
    expect(userA.getIdTokenResult).not.toHaveBeenCalled();

    // Cas 7b : Incohérence survenant pendant l'attente asynchrone du token (sans second emitTokenChange)
    const deferredA = createDeferred<{ claims: Record<string, unknown> }>();
    const userAsyncA: TokenMonitorUser = {
      uid: "uid-async-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredA.promise)
    };
    harness.mockAuth.currentUser = { uid: "uid-async-A" };
    const pendingAsyncA = harness.emitTokenChange(userAsyncA);

    // auth.currentUser change silencieusement avant la résolution de deferredA
    harness.mockAuth.currentUser = { uid: "uid-intruder-B" };
    harness.authMode = "super_admin";
    harness.activeModule = "super_admin_console";

    deferredA.resolve({ claims: { role: "super_admin", email_verified: true } });
    await pendingAsyncA;

    // L'incohérence entre auth.currentUser.uid ("uid-intruder-B") et targetUid ("uid-async-A")
    // doit impérativement révoquer l'état super_admin et refuser les privilèges.
    expect(harness.authMode).toBe("client");
    expect(harness.activeModule).toBe("isometric");
  });

  // Scénario 8 : Démontage du composant : aucun callback ne peut modifier l'état
  it("Scenario 8: Unmounting component prevents any in-flight token callback from mutating state", async () => {
    const harness = createTokenMonitorHarness("client", "isometric");

    const deferredA = createDeferred<{ claims: Record<string, unknown> }>();
    const userA: TokenMonitorUser = {
      uid: "uid-super-A",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredA.promise)
    };

    harness.mockAuth.currentUser = { uid: "uid-super-A" };
    const pendingA = harness.emitTokenChange(userA);

    // Démontage du composant pendant que la promesse est en vol
    harness.cleanup();
    expect(harness.unsubscribedCount).toBe(1);
    const callCountAtUnmount = harness.setAuthModeSpy.mock.calls.length;

    // La promesse se résout après démontage
    deferredA.resolve({ claims: { role: "super_admin", email_verified: true } });
    await pendingA;

    expect(harness.setAuthModeSpy.mock.calls.length).toBe(callCountAtUnmount);
    expect(harness.authMode).toBe("client");
  });

  // Scénario 9 : Token client : aucune vue administrative accessible
  it("Scenario 9: Valid client token keeps authMode as 'client' and blocks all administrative views", async () => {
    const harness = createTokenMonitorHarness("guest", "home");

    const clientUser: TokenMonitorUser = {
      uid: "uid-standard-client",
      emailVerified: true,
      getIdTokenResult: vi.fn(async () => ({
        claims: { role: "client", email_verified: true }
      }))
    };

    harness.mockAuth.currentUser = { uid: "uid-standard-client" };
    await harness.emitTokenChange(clientUser);

    expect(harness.authMode).not.toBe("super_admin");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe("isometric");
    expect(getAuthorizedView("license_keys", harness.authMode === "super_admin", "isometric")).toBe("isometric");
    expect(getAuthorizedView("projects", harness.authMode === "super_admin", "isometric")).toBe("projects");
  });

  // Scénario 10 : Token Super Admin valide : accès administratif autorisé après vérification complète
  it("Scenario 10: Valid Super Admin token grants administrative access only AFTER complete async verification", async () => {
    const harness = createTokenMonitorHarness("client", "home");

    const deferredSuper = createDeferred<{ claims: Record<string, unknown> }>();
    const superUser: TokenMonitorUser = {
      uid: "uid-verified-super",
      emailVerified: true,
      getIdTokenResult: vi.fn(() => deferredSuper.promise)
    };

    harness.mockAuth.currentUser = { uid: "uid-verified-super" };
    const pendingSuper = harness.emitTokenChange(superUser);

    // Pendant la vérification, aucun droit Super Admin n'est encore accordé
    expect(harness.authMode).toBe("client");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe("isometric");

    // Résolution complète du token avec role === "super_admin" et email_verified === true
    deferredSuper.resolve({ claims: { role: "super_admin", email_verified: true } });
    await pendingSuper;

    expect(harness.authMode).toBe("super_admin");
    expect(getAuthorizedView("super_admin_console", harness.authMode === "super_admin", "isometric")).toBe(
      "super_admin_console"
    );
    expect(getAuthorizedView("license_keys", harness.authMode === "super_admin", "isometric")).toBe("license_keys");
  });
});

describe("SEC-01-FIX-03-R1 & R2: Strict Claims Validation & Invariants", () => {
  it("Invariant A3-1: role='super_admin' and email_verified=true is authorized", () => {
    const claims = { role: "super_admin", email_verified: true };
    expect(isSuperAdminClaimAuthorized(claims, true)).toBe(true);
    expect(isSuperAdminClaimAuthorized(claims, undefined)).toBe(true);
    expect(isSuperAdminFromTokenResult({ claims }, true)).toBe(true);
  });

  it("Invariant A3-2: role='super_admin' without email_verified claim is strictly rejected even if userEmailVerified=true", () => {
    const claimsWithoutEmailVerified = { role: "super_admin" };
    expect(isSuperAdminClaimAuthorized(claimsWithoutEmailVerified, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsWithoutEmailVerified, false)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsWithoutEmailVerified, undefined)).toBe(false);
  });

  it("Invariant A3-3: role='super_admin' and email_verified=false or non-boolean is strictly rejected", () => {
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: false }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: "true" }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: 1 }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: null }, true)).toBe(false);
  });

  it("Invariant B3 on resolveNextAuthMode: UID mismatch revokes super_admin when callbackSeq === currentSeq", () => {
    expect(
      resolveNextAuthMode(
        "super_admin",
        { uid: "uid-A", emailVerified: true },
        { role: "super_admin", email_verified: true },
        {
          isSubscribed: true,
          callbackSeq: 1,
          currentSeq: 1,
          activeUid: "uid-B"
        }
      )
    ).toBe("client");
  });

  it("Invariant: verifySuperAdminFromFirebaseUser & restricted views catalog", async () => {
    expect(await verifySuperAdminFromFirebaseUser(null)).toBe(false);
    expect(SUPER_ADMIN_RESTRICTED_VIEWS.has("super_admin_console")).toBe(true);
    expect(SUPER_ADMIN_RESTRICTED_VIEWS.has("license_keys")).toBe(true);
    expect(isRestrictedAdminView("super_admin_console")).toBe(true);
    expect(isRestrictedAdminView("license_keys")).toBe(true);
    expect(isRestrictedAdminView("isometric")).toBe(false);
  });
});
