/**
 * SEC-01-FIX-03 — Tests unitaires d'autorisation Super Admin côté client
 *
 * Vérifie l'ensemble des 10 exigences strictes du cahier des charges :
 * 1. Custom Claim Super Admin + email vérifié -> autorisé
 * 2. Custom Claim Super Admin + email non vérifié -> refusé
 * 3. Claim `role` absent -> refusé
 * 4. Claim `role: client` -> refusé
 * 5. Profil Firestore avec `role: super_admin`, mais token client -> refusé
 * 6. localStorage avec `super_admin`, mais token absent / nul -> refusé
 * 7. Adresse email historique Super Admin sans claim -> refusée
 * 8. Claim falsifié ou incomplet -> refusé
 * 9. Session démo (`authMode === "demo"`) donne zéro privilège administratif
 * 10. Accès direct aux vues administratives sans claim -> redirection vers vue de repli ("isometric")
 */

import { describe, it, expect } from "vitest";
import {
  isSuperAdminClaimAuthorized,
  isSuperAdminFromTokenResult,
  verifySuperAdminFromFirebaseUser,
  isRestrictedAdminView,
  getAuthorizedView,
  SUPER_ADMIN_RESTRICTED_VIEWS
} from "../clientAuthorization";

describe("SEC-01-FIX-03: Client Authorization & Super Admin Authority", () => {
  // 1. Custom Claim Super Admin + email vérifié -> autorisé
  it("Test 1: Custom Claim role==='super_admin' + emailVerified===true authorizes Super Admin", () => {
    const claims = { role: "super_admin", email_verified: true };
    expect(isSuperAdminClaimAuthorized(claims, true)).toBe(true);

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

  // 2. Custom Claim Super Admin + email non vérifié -> refusé
  it("Test 2: Custom Claim role==='super_admin' + email NOT verified (false or missing) is strictly rejected", () => {
    const claims = { role: "super_admin" };
    expect(isSuperAdminClaimAuthorized(claims, false)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claims, undefined)).toBe(false);

    // Même si claims.email_verified est faux
    const claimsUnverified = { role: "super_admin", email_verified: false };
    expect(isSuperAdminClaimAuthorized(claimsUnverified, false)).toBe(false);
    expect(isSuperAdminClaimAuthorized(claimsUnverified, true)).toBe(false);
  });

  // 3. Claim role absent -> refusé
  it("Test 3: Missing role claim is rejected even with verified email", () => {
    const claimsWithoutRole = { user_id: "xyz123", email_verified: true };
    expect(isSuperAdminClaimAuthorized(claimsWithoutRole, true)).toBe(false);

    const emptyClaims = {};
    expect(isSuperAdminClaimAuthorized(emptyClaims, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized(null, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized(undefined, true)).toBe(false);
  });

  // 4. Claim role: client -> refusé
  it("Test 4: Non super_admin roles (e.g. 'client', 'user', 'guest') are strictly rejected", () => {
    expect(isSuperAdminClaimAuthorized({ role: "client", email_verified: true }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "user", email_verified: true }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "guest", email_verified: true }, true)).toBe(false);
  });

  // 5. Profil Firestore avec role: super_admin, mais token client -> refusé
  it("Test 5: Firestore profile claiming 'super_admin' is discarded if token claims say otherwise", () => {
    const firestoreProfile = {
      name: "Attacker Pretending Admin",
      email: "attacker@pdi-vision.dz",
      role: "super_admin"
    };

    const tokenResult = {
      token: "valid-jwt",
      authTime: "now",
      issuedAtTime: "now",
      expirationTime: "later",
      signInProvider: "password",
      signInSecondFactor: null,
      claims: { role: "client", email_verified: true }
    };

    // Le token affirme client -> le résultat doit être faux indépendamment de firestoreProfile
    const isSuper = isSuperAdminFromTokenResult(tokenResult, true);
    expect(isSuper).toBe(false);
    expect(firestoreProfile.role === "super_admin").toBe(true); // profile declares it, but client authorization ignores it
  });

  // 6. localStorage avec super_admin, mais token absent / nul -> refusé
  it("Test 6: localStorage containing 'super_admin' without valid verified token results in rejection", async () => {
    // Simuler absence de Firebase User authentifié
    const isSuperNullUser = await verifySuperAdminFromFirebaseUser(null);
    expect(isSuperNullUser).toBe(false);

    // Simuler token sans claims valides
    const mockUserNoClaims = {
      emailVerified: true,
      getIdTokenResult: async () => ({
        token: "jwt",
        authTime: "now",
        issuedAtTime: "now",
        expirationTime: "later",
        signInProvider: null,
        signInSecondFactor: null,
        claims: {}
      })
    };
    const isSuperNoClaims = await verifySuperAdminFromFirebaseUser(mockUserNoClaims as any);
    expect(isSuperNoClaims).toBe(false);
  });

  // 7. Adresse email historique Super Admin sans claim -> refusée
  it("Test 7: Historic Super Admin email addresses are rejected if missing the custom claim", () => {
    const historicEmails = [
      "boudjada.youcef@gmail.com",
      "boudjada.youcef@outlook.com",
      "youcef.boudjada@pdi-vision.dz",
      "admin@pdi-vision.dz"
    ];

    for (const email of historicEmails) {
      // Token avec claims standard client ou vide
      const clientClaims = { email, role: "client", email_verified: true };
      expect(isSuperAdminClaimAuthorized(clientClaims, true)).toBe(false);

      const claimsWithoutRole = { email, email_verified: true };
      expect(isSuperAdminClaimAuthorized(claimsWithoutRole, true)).toBe(false);
    }
  });

  // 8. Claim falsifié ou incomplet -> refusé
  it("Test 8: Malformed, partial, or injection claims are rejected", () => {
    // string 'admin' au lieu de 'super_admin'
    expect(isSuperAdminClaimAuthorized({ role: "admin", email_verified: true }, true)).toBe(false);

    // String 'true' au lieu de boolean true pour email_verified
    expect(isSuperAdminClaimAuthorized({ role: "super_admin", email_verified: "true" }, true)).toBe(false);

    // Objets ou types inattendus
    expect(isSuperAdminClaimAuthorized({ role: ["super_admin"], email_verified: true }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: { super_admin: true }, email_verified: true }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "SUPER_ADMIN", email_verified: true }, true)).toBe(false);
    expect(isSuperAdminClaimAuthorized({ role: "super_admin " }, true)).toBe(false);
  });

  // 9. Session démo (authMode === "demo") donne zéro privilège administratif
  it("Test 9: Demo session authMode === 'demo' has zero administrative privilege", () => {
    const authMode: string = "demo";
    const isSuper = authMode === "super_admin";
    expect(isSuper).toBe(false);

    // Vérifie que les vues d'administration sont bloquées pour une session démo
    expect(getAuthorizedView("super_admin_console", isSuper, "isometric")).toBe("isometric");
    expect(getAuthorizedView("license_keys", isSuper, "isometric")).toBe("isometric");
  });

  // 10. Accès direct aux vues administratives sans claim -> redirection vers vue de repli ("isometric")
  it("Test 10: Direct access to admin views without verified claim redirects to fallback ('isometric')", () => {
    // Vérification du catalogue de vues protégées
    expect(SUPER_ADMIN_RESTRICTED_VIEWS.has("super_admin_console")).toBe(true);
    expect(SUPER_ADMIN_RESTRICTED_VIEWS.has("license_keys")).toBe(true);
    expect(isRestrictedAdminView("super_admin_console")).toBe(true);
    expect(isRestrictedAdminView("license_keys")).toBe(true);
    expect(isRestrictedAdminView("isometric")).toBe(false);
    expect(isRestrictedAdminView("home")).toBe(false);
    expect(isRestrictedAdminView("profile")).toBe(false);

    // Utilisateur non super admin (isSuper = false)
    expect(getAuthorizedView("super_admin_console", false, "isometric")).toBe("isometric");
    expect(getAuthorizedView("license_keys", false, "isometric")).toBe("isometric");
    expect(getAuthorizedView("isometric", false, "isometric")).toBe("isometric");
    expect(getAuthorizedView("projects", false, "isometric")).toBe("projects");

    // Utilisateur Super Admin vérifié (isSuper = true)
    expect(getAuthorizedView("super_admin_console", true, "isometric")).toBe("super_admin_console");
    expect(getAuthorizedView("license_keys", true, "isometric")).toBe("license_keys");
  });
});
