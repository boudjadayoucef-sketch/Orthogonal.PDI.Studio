/**
 * SEC-01-FIX-03-R1 — Tests unitaires d'autorisation Super Admin côté client
 *
 * Vérifie l'ensemble des exigences strictes :
 * 1. role=super_admin et email_verified=true : autorisé
 * 2. role=super_admin sans email_verified : refusé, même si userEmailVerified=true
 * 3. role=super_admin et email_verified=false : refusé
 * 4. role=super_admin et email_verified="true" : refusé
 * 5. Token client après une session Super Admin : rétrogradation immédiate
 * 6. Déconnexion pendant une vérification asynchrone : aucun rétablissement des droits
 * 7. Changement de compte pendant une vérification asynchrone : ancien résultat ignoré
 * 8. Erreur de récupération du token : refus d'autorisation
 * 9. Claims Super Admin actualisés après révocation : accès administratif refusé
 * 10. Aucun état provenant de localStorage ne peut rétablir les privilèges
 *
 * + Maintien des tests de compatibilité de vues et session démo.
 */

import { describe, it, expect } from "vitest";
import {
  isSuperAdminClaimAuthorized,
  isSuperAdminFromTokenResult,
  verifySuperAdminFromFirebaseUser,
  isRestrictedAdminView,
  getAuthorizedView,
  SUPER_ADMIN_RESTRICTED_VIEWS,
  resolveNextAuthMode
} from "../clientAuthorization";

describe("SEC-01-FIX-03-R1: Client Authorization, Token Listener Hardening & Revocation", () => {
  // 1. role=super_admin et email_verified=true : autorisé
  it("Exigence 1: role='super_admin' and email_verified=true is authorized", () => {
    const claims = { role: "super_admin", email_verified: true };
    expect(isSuperAdminClaimAuthorized(claims, true)).toBe(true);
    expect(isSuperAdminClaimAuthorized(claims, undefined)).toBe(true);

    const tokenResult = {
      token: "valid-jwt",
      authTime: "now",
      issuedAtTime: "now",
      expirationTime: "later",
      signInProvider: "password",
      signInSecondFactor: null,
      claims: { role: "super_admin", email_verified: true }
    };
    expect(isSuperAdminFromTokenResult(tokenResult, true)).toBe(true);
  });

  // 2. role=super_admin sans email_verified : refusé, même si userEmailVerified=true
  it("Exigence 2: role='super_admin' without email_verified claim is strictly rejected even if userEmailVerified=true", () => {
    const claimsWithoutEmailVerified = { role: "super_admin" };
    expect(isSuperAdminClaimAuthorized(claimsWithoutEmailVerified, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsWithoutEmailVerified, false)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsWithoutEmailVerified, undefined)).toBe(false);

    const tokenResult = {
      claims: { role: "super_admin" }
    };
    expect(isSuperAdminFromTokenResult(tokenResult, true)).toBe(false);
  });

  // 3. role=super_admin et email_verified=false : refusé
  it("Exigence 3: role='super_admin' and email_verified=false is strictly rejected", () => {
    const claimsUnverified = { role: "super_admin", email_verified: false };
    expect(isSuperAdminClaimAuthorized(claimsUnverified, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsUnverified, false)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsUnverified, undefined)).toBe(false);
  });

  // 4. role=super_admin et email_verified="true" : refusé
  it("Exigence 4: role='super_admin' and email_verified='true' (string) is strictly rejected", () => {
    const claimsStringTrue = { role: "super_admin", email_verified: "true" };
    expect(isSuperAdminClaimAuthorized(claimsStringTrue, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsStringTrue, false)).toBe(false);

    // Types alternatifs inattendus (number, object, null)
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: 1 }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: {} }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: null }, true)).toBe(false);
  });

  // 5. Token client après une session Super Admin : rétrogradation immédiate
  it("Exigence 5: Client token received after Super Admin session triggers immediate downgrade to 'client'", () => {
    const currentAuthMode = "super_admin";
    const user = { uid: "user-123", emailVerified: true };
    const clientClaims = { role: "client", email_verified: true };
    const sessionContext = {
      isSubscribed: true,
      callbackSeq: 2,
      currentSeq: 2,
      activeUid: "user-123"
    };

    const nextMode = resolveNextAuthMode(currentAuthMode, user, clientClaims, sessionContext);
    expect(nextMode).toBe("client");
  });

  // 6. Déconnexion pendant une vérification asynchrone : aucun rétablissement des droits
  it("Exigence 6: Sign-out occurring during async token verification prevents any re-elevation of rights", () => {
    const currentAuthMode = "guest"; // l'utilisateur s'est déconnecté
    const staleUser = { uid: "user-super", emailVerified: true };
    const superClaims = { role: "super_admin", email_verified: true };

    // Contexte 1 : l'utilisateur actuel est devenu null (déconnexion effective)
    const contextSignedOut = {
      isSubscribed: true,
      callbackSeq: 1,
      currentSeq: 1,
      activeUid: null // auth.currentUser est null
    };

    const modeAfterSignOut = resolveNextAuthMode(currentAuthMode, staleUser, superClaims, contextSignedOut);
    expect(modeAfterSignOut).toBe("guest");

    // Contexte 2 : le composant a été démonté (isSubscribed: false)
    const contextUnmounted = {
      isSubscribed: false,
      callbackSeq: 1,
      currentSeq: 1,
      activeUid: "user-super"
    };
    const modeAfterUnmount = resolveNextAuthMode("guest", staleUser, superClaims, contextUnmounted);
    expect(modeAfterUnmount).toBe("guest");
  });

  // 7. Changement de compte pendant une vérification asynchrone : ancien résultat ignoré
  it("Exigence 7: Account switch occurring during async token check discards obsolete callback result", () => {
    const currentAuthMode = "client"; // nouveau compte client actif
    const staleSuperUser = { uid: "super-user-uid", emailVerified: true };
    const superClaims = { role: "super_admin", email_verified: true };

    // Séquence obsolète (un nouveau callback a été émis entre-temps)
    const contextStaleSeq = {
      isSubscribed: true,
      callbackSeq: 1,
      currentSeq: 2, // une nouvelle séquence a démarré
      activeUid: "new-client-uid" // le compte actif a changé
    };

    const nextModeStale = resolveNextAuthMode(currentAuthMode, staleSuperUser, superClaims, contextStaleSeq);
    expect(nextModeStale).toBe("client"); // inchangé, l'ancien résultat est totalement ignoré
  });

  // 8. Erreur de récupération du token : refus d'autorisation
  it("Exigence 8: Token acquisition failure strictly denies authorization and reverts Super Admin", async () => {
    const failingUser = {
      emailVerified: true,
      getIdTokenResult: async () => {
        throw new Error("Network / auth error during token refresh");
      }
    };

    const isSuper = await verifySuperAdminFromFirebaseUser(failingUser as any, true);
    expect(isSuper).toBe(false);

    // En cas d'erreur dans le listener, rétrogradation immédiate
    const prevAuthMode = "super_admin";
    const modeOnError = resolveNextAuthMode(prevAuthMode, { uid: "failing-uid", emailVerified: true }, null, {
      isSubscribed: true,
      callbackSeq: 1,
      currentSeq: 1,
      activeUid: "failing-uid"
    });
    expect(modeOnError).toBe("client");
  });

  // 9. Claims Super Admin actualisés après révocation : accès administratif refusé
  it("Exigence 9: Revoked claims on token update immediately deny access to restricted views", () => {
    // Session initialement super_admin
    let authMode = "super_admin";
    let activeModule = "super_admin_console";

    // Réception du nouveau token révoqué (claims ne contenant plus super_admin)
    const revokedClaims = { role: "client", email_verified: true };
    authMode = resolveNextAuthMode(authMode, { uid: "user-1" }, revokedClaims, {
      isSubscribed: true,
      callbackSeq: 3,
      currentSeq: 3,
      activeUid: "user-1"
    });
    expect(authMode).toBe("client");

    // Gardien de vue : accès à super_admin_console refusé et replié vers isometric
    const safeView = getAuthorizedView(activeModule, authMode === "super_admin", "isometric");
    expect(safeView).toBe("isometric");
    expect(getAuthorizedView("license_keys", authMode === "super_admin", "isometric")).toBe("isometric");
  });

  // 10. Aucun état provenant de localStorage ne peut rétablir les privilèges
  it("Exigence 10: LocalStorage manipulation cannot restore administrative privileges without verified token", async () => {
    // Simuler absence d'utilisateur Firebase valide malgré un localStorage corrompu
    const isSuperNull = await verifySuperAdminFromFirebaseUser(null);
    expect(isSuperNull).toBe(false);

    // Utilisateur avec token vide ou sans claim
    const mockUserEmptyClaims = {
      emailVerified: true,
      getIdTokenResult: async () => ({
        token: "fake-jwt",
        authTime: "now",
        issuedAtTime: "now",
        expirationTime: "later",
        signInProvider: null,
        signInSecondFactor: null,
        claims: {}
      })
    };
    const isSuperEmpty = await verifySuperAdminFromFirebaseUser(mockUserEmptyClaims as any);
    expect(isSuperEmpty).toBe(false);

    // Tentative de forcer super_admin dans resolveNextAuthMode avec un token vide
    const coercedMode = resolveNextAuthMode("super_admin", { uid: "attacker" }, {}, {
      isSubscribed: true,
      callbackSeq: 1,
      currentSeq: 1,
      activeUid: "attacker"
    });
    expect(coercedMode).toBe("client");
  });

  // Tests complémentaires de robustesse
  it("Complementary: Rejects role casing variants and missing role claim", () => {
    expect(isSuperAdminClaimAuthorized({ role: "SUPER_ADMIN", email_verified: true })).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "admin", email_verified: true })).toBe(false);
    expect(isSuperAdminClaimAuthorized({ email_verified: true })).toBe(false);
    expect(isSuperAdminClaimAuthorized(null)).toBe(false);
    expect(isSuperAdminClaimAuthorized(undefined)).toBe(false);
  });

  it("Complementary: Catalog of restricted admin views is sound", () => {
    expect(SUPER_ADMIN_RESTRICTED_VIEWS.has("super_admin_console")).toBe(true);
    expect(SUPER_ADMIN_RESTRICTED_VIEWS.has("license_keys")).toBe(true);
    expect(isRestrictedAdminView("super_admin_console")).toBe(true);
    expect(isRestrictedAdminView("license_keys")).toBe(true);
    expect(isRestrictedAdminView("isometric")).toBe(false);
    expect(isRestrictedAdminView("home")).toBe(false);
    expect(isRestrictedAdminView("projects")).toBe(false);
  });
});
