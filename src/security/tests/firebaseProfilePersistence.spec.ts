/**
 * ORTHOGONAL PD&I STUDIO — SEC-01-FIX-04-R1
 * Tests unitaires et d'intégration ciblés sur les vraies fonctions de production de `src/lib/firebase.ts` :
 * - buildFirestoreProfileCreatePayload()
 * - buildFirestoreProfileUpdatePayload()
 * - validateProfilePresentationFields()
 * - saveFirebaseProfile()
 * - registerWithEmailAndPasswordSecure()
 * - loginWithEmailAndPasswordSecure()
 * - loginWithGoogleSecure()
 * - activateAccountWithLicenseKey()
 * - validateAndConsumeLicenseKey()
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  initializeFirestore: vi.fn(() => ({ type: "mock-firestore" })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}`, col, id })),
  collection: vi.fn((_db: unknown, col: string) => ({ col })),
  query: vi.fn((colRef: unknown) => colRef),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  onSnapshot: vi.fn(),
  getDocFromServer: vi.fn()
}));

const authState = vi.hoisted(() => ({
  currentUser: null as {
    uid: string;
    email: string | null;
    emailVerified: boolean;
    displayName?: string | null;
    getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
  } | null
}));

const authMocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  updatePassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "mock-app" })),
  getApps: vi.fn(() => [{ name: "mock-app" }]),
  getApp: vi.fn(() => ({ name: "mock-app" }))
}));

vi.mock("firebase/firestore", () => ({
  initializeFirestore: firestoreMocks.initializeFirestore,
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  collection: firestoreMocks.collection,
  doc: firestoreMocks.doc,
  getDocs: firestoreMocks.getDocs,
  getDoc: firestoreMocks.getDoc,
  getDocFromServer: firestoreMocks.getDocFromServer,
  setDoc: firestoreMocks.setDoc,
  updateDoc: firestoreMocks.updateDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  addDoc: firestoreMocks.addDoc,
  query: firestoreMocks.query,
  where: firestoreMocks.where,
  orderBy: firestoreMocks.orderBy,
  limit: firestoreMocks.limit,
  startAfter: firestoreMocks.startAfter,
  onSnapshot: firestoreMocks.onSnapshot
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return authState.currentUser;
    }
  })),
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
  signInWithPopup: authMocks.signInWithPopup,
  signInWithEmailAndPassword: authMocks.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
  updatePassword: authMocks.updatePassword,
  sendPasswordResetEmail: authMocks.sendPasswordResetEmail,
  signOut: authMocks.signOut
}));

import {
  buildFirestoreProfileCreatePayload,
  buildFirestoreProfileUpdatePayload,
  validateProfilePresentationFields,
  saveFirebaseProfile,
  getProfileFromLocalCache,
  saveProfileToLocalCache,
  registerWithEmailAndPasswordSecure,
  loginWithEmailAndPasswordSecure,
  loginWithGoogleSecure,
  activateAccountWithLicenseKey,
  validateAndConsumeLicenseKey,
  logoutFirebase,
  purgeLocalAuthCaches,
  classifyFirestoreProfileReadError,
  resolveAuthoritativeWorkspaceSession,
  PdiAuthAccessError,
  EXPECTED_FIREBASE_PROJECT_ID,
  EXPECTED_FIRESTORE_DATABASE_ID,
  validateClientFirebaseProjectId,
  validateClientFirestoreDatabaseId,
  validateClientFirebaseAppProjectId,
  resolveClientFirebaseConfig,
  getOrInitializeClientFirebaseApp,
  getOrInitializeClientFirestore,
  activeConfig,
  app,
  db,
  auth,
  type PdiUserProfile
} from "../../lib/firebase";
import fs from "node:fs";
import path from "node:path";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

describe("SEC-01-FIX-04-R1 : Persistance des profils Firestore, cohérence d'inscription/activation et résilience du cache local", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("navigator", { userAgent: "Vitest-Agent/1.0" });

    authState.currentUser = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      emailVerified: true,
      displayName: "Ingénieur Test",
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { email: "ingenieur@orthogonal.dz", email_verified: true }
      })
    };

    authMocks.signOut.mockImplementation(async () => {
      authState.currentUser = null;
    });
  });

  // =========================================================================
  // 1. Payload de création : aucun champ serveur interdit
  // =========================================================================
  it("01. Le payload de création ne contient aucun champ serveur interdit et rejette toute injection de compteurs ou privilèges", () => {
    const validProfile: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      paymentGateway: "slickpay_baridimob",
      currency: "DZD",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };

    const payload = buildFirestoreProfileCreatePayload(
      validProfile,
      "user_123",
      "ingenieur@orthogonal.dz"
    );

    expect(payload).toEqual({
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      paymentGateway: "slickpay_baridimob",
      currency: "DZD",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    });

    expect("role" in payload).toBe(false);
    expect("loginCount" in payload).toBe(false);
    expect("projectsCount" in payload).toBe(false);
    expect("storageUsedKb" in payload).toBe(false);
    expect("lastLoginAt" in payload).toBe(false);

    // Rejet explicite si des compteurs ou privilèges serveur sont fournis
    expect(() =>
      buildFirestoreProfileCreatePayload(
        { ...validProfile, loginCount: 1 },
        "user_123",
        "ingenieur@orthogonal.dz"
      )
    ).toThrow(/loginCount/);

    expect(() =>
      buildFirestoreProfileCreatePayload(
        { ...validProfile, projectsCount: 0 },
        "user_123",
        "ingenieur@orthogonal.dz"
      )
    ).toThrow(/projectsCount/);

    expect(() =>
      buildFirestoreProfileCreatePayload(
        { ...validProfile, storageUsedKb: 0 },
        "user_123",
        "ingenieur@orthogonal.dz"
      )
    ).toThrow(/storageUsedKb/);

    expect(() =>
      buildFirestoreProfileCreatePayload(
        { ...validProfile, role: "super_admin" },
        "user_123",
        "ingenieur@orthogonal.dz"
      )
    ).toThrow(/rôle privilégié/);

    expect(() =>
      buildFirestoreProfileCreatePayload(
        { ...validProfile, status: "active" },
        "user_123",
        "ingenieur@orthogonal.dz"
      )
    ).toThrow(/pending_activation/);

    expect(() =>
      buildFirestoreProfileCreatePayload(
        { ...validProfile, accountType: "pro" },
        "user_123",
        "ingenieur@orthogonal.dz"
      )
    ).toThrow(/basic/);
  });

  // =========================================================================
  // 2. Payload de mise à jour & validation des champs de présentation
  // =========================================================================
  it("02. Le payload de mise à jour ne contient que les champs de présentation autorisés et valide strictement leurs types et limites", () => {
    const dirtyInput = {
      uid: "hacked_uid",
      email: "hacked@domain.com",
      name: "Nouveau Nom Valide",
      company: "Orthogonal Piping SARL",
      country: "Algérie",
      countryCode: "DZ",
      city: "Oran",
      role: "super_admin" as const,
      status: "active" as const,
      accountType: "enterprise" as const,
      subscriptionPlan: "lifetime" as const,
      loginCount: 999,
      projectsCount: 50,
      storageUsedKb: 4096,
      lastLoginAt: "2026-04-12T12:00:00.000Z",
      paymentGateway: "paddle",
      currency: "EUR"
    };

    const updatePayload = buildFirestoreProfileUpdatePayload(dirtyInput);

    expect(Object.keys(updatePayload).sort()).toEqual([
      "city",
      "company",
      "country",
      "countryCode",
      "name"
    ]);
    expect(updatePayload).toEqual({
      name: "Nouveau Nom Valide",
      company: "Orthogonal Piping SARL",
      country: "Algérie",
      countryCode: "DZ",
      city: "Oran"
    });

    // Rejet des objets, tableaux, chaînes vides ou hors limites (Correction E)
    expect(() =>
      buildFirestoreProfileUpdatePayload({ name: "" })
    ).toThrow(/name/);

    expect(() =>
      buildFirestoreProfileUpdatePayload({ name: { evil: true } as unknown as string })
    ).toThrow(/name/);

    expect(() =>
      buildFirestoreProfileUpdatePayload({ city: ["Alger"] as unknown as string })
    ).toThrow(/city/);

    expect(() =>
      buildFirestoreProfileUpdatePayload({ company: "X".repeat(151) })
    ).toThrow(/company/);

    expect(() =>
      buildFirestoreProfileUpdatePayload({ countryCode: "dz_invalid" })
    ).toThrow(/countryCode/);

    expect(() =>
      validateProfilePresentationFields({ name: "Nom Valide", country: 123 as unknown as string }, true)
    ).toThrow(/country/);
  });

  // =========================================================================
  // 3. Inscription : un plan demandé ou une clé ne produit jamais un plan/statut falsifié
  // =========================================================================
  it("03. Un plan demandé à l'inscription ne devient pas artificiellement un plan Firestore validé et une clé d'activation cliente est refusée", async () => {
    // Cas 3a : Inscription avec requestedPlan = "enterprise" (sans clé) -> forcé à "basic" et "pending_activation" partout
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => false }) // getCountryRestrictionsFromFirebase
      .mockResolvedValueOnce({ exists: () => false }); // saveFirebaseProfile -> getDoc(profiles/user_new)
    firestoreMocks.setDoc.mockResolvedValueOnce(undefined);

    authMocks.createUserWithEmailAndPassword.mockImplementationOnce(async () => {
      authState.currentUser = {
        uid: "user_new",
        email: "nouveau@orthogonal.dz",
        emailVerified: false,
        getIdTokenResult: vi.fn().mockResolvedValue({ claims: { email: "nouveau@orthogonal.dz" } })
      };
      return { user: authState.currentUser };
    });

    const createdProfile = await registerWithEmailAndPasswordSecure({
      email: "nouveau@orthogonal.dz",
      password: "Password123!",
      name: "Nouvel Ingénieur",
      company: "Sonatrach Engineering",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      requestedPlan: "enterprise"
    });

    // Le profil retourné à l'application est strictement cohérent avec Firestore
    expect(createdProfile.accountType).toBe("basic");
    expect(createdProfile.subscriptionPlan).toBe("monthly");
    expect(createdProfile.status).toBe("pending_activation");
    expect(createdProfile.role).toBe("client");

    // Le payload envoyé à Firestore (setDoc) est identique
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
    const [, firestorePayload] = firestoreMocks.setDoc.mock.calls[0];
    expect(firestorePayload.accountType).toBe("basic");
    expect(firestorePayload.subscriptionPlan).toBe("monthly");
    expect(firestorePayload.status).toBe("pending_activation");
    expect("role" in firestorePayload).toBe(false);
    expect("loginCount" in firestorePayload).toBe(false);

    // Le cache local est identique
    const cached = getProfileFromLocalCache("user_new");
    expect(cached?.accountType).toBe("basic");
    expect(cached?.status).toBe("pending_activation");

    // Cas 3b : Inscription fournissant une activationKey -> refus explicite avant toute création Auth/Firestore
    vi.clearAllMocks();
    await expect(
      registerWithEmailAndPasswordSecure({
        email: "avec_cle@orthogonal.dz",
        password: "Password123!",
        name: "Utilisateur Clé",
        activationKey: "PDI-PRO-2026-KEY"
      })
    ).rejects.toThrow(/Activation de licence impossible côté client/);

    expect(authMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 4. Activation de licence : une activation non persistée ne retourne pas un succès
  // =========================================================================
  it("04. Une activation de licence côté client échoue explicitement sans modifier Firestore ni le cache local", async () => {
    const initialPendingProfile: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };
    saveProfileToLocalCache(initialPendingProfile);

    const keyValidation = await validateAndConsumeLicenseKey("PDI-PRO-2026", "ingenieur@orthogonal.dz");
    expect(keyValidation.valid).toBe(false);
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();

    await expect(
      activateAccountWithLicenseKey("ingenieur@orthogonal.dz", "PDI-PRO-2026")
    ).rejects.toThrow(/Activation refusée/);

    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();

    // Le cache local conserve son état initial pending_activation / basic
    const cachedAfter = getProfileFromLocalCache("user_123");
    expect(cachedAfter?.status).toBe("pending_activation");
    expect(cachedAfter?.accountType).toBe("basic");
  });

  // =========================================================================
  // 5. Un statut pending_activation ne devient pas active par modification cliente
  // =========================================================================
  it("05. Un statut pending_activation ne devient jamais active par une modification cliente via saveFirebaseProfile", async () => {
    const existingFirestoreDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };
    saveProfileToLocalCache(existingFirestoreDoc);

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...existingFirestoreDoc })
    });
    firestoreMocks.updateDoc.mockResolvedValueOnce(undefined);

    await saveFirebaseProfile({
      ...existingFirestoreDoc,
      name: "Youcef Ingénieur Modifié",
      status: "active"
    });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1);
    const [, sentPayload] = firestoreMocks.updateDoc.mock.calls[0];
    expect("status" in sentPayload).toBe(false);
    expect(getProfileFromLocalCache("user_123")?.status).toBe("pending_activation");
    expect(getProfileFromLocalCache("user_123")?.name).toBe("Youcef Ingénieur Modifié");
  });

  // =========================================================================
  // 6. Une erreur Firestore n'est pas présentée comme une sauvegarde distante réussie
  // =========================================================================
  it("06. Une erreur Firestore est propagée à l'appelant et n'est jamais présentée comme une sauvegarde distante réussie", async () => {
    const initialProfile: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Nom Initial",
      company: "Société Initiale",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };

    // Échec sur setDoc lors d'une création
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });
    firestoreMocks.setDoc.mockRejectedValueOnce(new Error("FIRESTORE_WRITE_DENIED: Permission denied"));

    await expect(saveFirebaseProfile(initialProfile)).rejects.toThrow(
      "FIRESTORE_WRITE_DENIED: Permission denied"
    );

    // Échec sur getDoc lors de la lecture préalable
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error("FIRESTORE_NETWORK_DOWN: Connection lost"));

    await expect(saveFirebaseProfile(initialProfile)).rejects.toThrow(
      "FIRESTORE_NETWORK_DOWN: Connection lost"
    );
  });

  // =========================================================================
  // 7. Le cache local reste intact (non corrompu) en cas d'échec distant
  // =========================================================================
  it("07. Le cache local reste disponible et strictement inchangé en cas d'échec distant sans inclure aucun profil non persisté", async () => {
    const initialProfile: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Nom Initial",
      company: "Société Initiale",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };
    saveProfileToLocalCache(initialProfile);

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...initialProfile })
    });
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error("FIRESTORE_UNAVAILABLE: Service temporairement indisponible"));

    // L'erreur Firestore est propagée à l'appelant (jamais avalée)
    await expect(
      saveFirebaseProfile({
        ...initialProfile,
        name: "Nom Modifié Hors Ligne",
        company: "Nouvelle Société"
      })
    ).rejects.toThrow("FIRESTORE_UNAVAILABLE: Service temporairement indisponible");

    // SEC-01-FIX-04-R2 (B2) : Aucune écriture non persistée ne doit polluer localStorage ; le cache précédent reste intact
    const cached = getProfileFromLocalCache("user_123");
    expect(cached).not.toBeNull();
    expect(cached).toEqual(initialProfile);
    expect(cached?.name).toBe("Nom Initial");
    expect(cached?.company).toBe("Société Initiale");
    expect(cached?.status).toBe("pending_activation");
    expect(cached?.accountType).toBe("basic");
    expect(cached?.role).toBe("client");
  });

  // =========================================================================
  // 8. Connexion sans profil Firestore : refus fail-closed (aucun statut actif artificiel)
  // =========================================================================
  it("08. Un compte Firebase Auth sans document profiles/{uid} dans Firestore ne peut pas obtenir automatiquement un statut actif", async () => {
    const initialMockUser = authState.currentUser!;
    // Même si un profil actif résiduel existait dans localStorage, il ne doit pas contourner l'absence de document Firestore
    saveProfileToLocalCache({
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Profil Local Résiduel",
      role: "client",
      accountType: "pro",
      subscriptionPlan: "yearly",
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z"
    });

    authMocks.signInWithEmailAndPassword.mockImplementationOnce(async () => {
      authState.currentUser = initialMockUser;
      return { user: initialMockUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });

    await expect(
      loginWithEmailAndPasswordSecure("ingenieur@orthogonal.dz", "Password123!")
    ).rejects.toThrow(/profil PD&I autoritatif est absent dans Firestore/);

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();
    expect(getProfileFromLocalCache("user_123")).toBeNull();

    // Aucune requête globale getDocs sur la collection profiles ne doit être exécutée
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();

    // Même garantie fail-closed pour loginWithGoogleSecure
    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = initialMockUser;
      return { user: initialMockUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });

    await expect(loginWithGoogleSecure()).rejects.toThrow(
      /aucun profil PD&I autoritatif n'est enregistré dans Firestore/
    );
    expect(authMocks.signOut).toHaveBeenCalledTimes(2);
    expect(authState.currentUser).toBeNull();
  });

  // =========================================================================
  // 9. Interdiction de modifier les champs d'identité ou d'autorisation
  // =========================================================================
  it("09. Un utilisateur ne peut pas modifier les champs d'identité (uid, email) et toute tentative de création avec privilèges ou compteurs serveur est rejetée", async () => {
    const existingDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z",
      loginCount: 4,
      projectsCount: 2,
      storageUsedKb: 256
    };

    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...existingDoc })
    });

    // Tentative de modification d'UID
    await expect(
      saveFirebaseProfile({ ...existingDoc, uid: "autre_uid" })
    ).rejects.toThrow(/UID/);

    // Tentative de modification d'email
    await expect(
      saveFirebaseProfile({ ...existingDoc, email: "autre@orthogonal.dz" })
    ).rejects.toThrow(/email/);

    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();

    // Sur le chemin de création (document inexistant), toute injection de rôle, plan, statut ou compteur serveur est rejetée
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => false
    });

    const baseCreateDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, role: "super_admin" })
    ).rejects.toThrow(/rôle privilégié/);

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, accountType: "enterprise" })
    ).rejects.toThrow(/basic/);

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, subscriptionPlan: "lifetime" })
    ).rejects.toThrow(/monthly/);

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, status: "active" })
    ).rejects.toThrow(/pending_activation/);

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, loginCount: 99 })
    ).rejects.toThrow(/loginCount/);

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, projectsCount: 0 })
    ).rejects.toThrow(/projectsCount/);

    await expect(
      saveFirebaseProfile({ ...baseCreateDoc, storageUsedKb: 0 })
    ).rejects.toThrow(/storageUsedKb/);

    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 10. Lecture et modification légitimes des champs de présentation
  // =========================================================================
  it("10. Les profils légitimes actifs restent lisibles à la connexion et leurs champs de présentation restent modifiables", async () => {
    const activeFirestoreDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "pro",
      subscriptionPlan: "yearly",
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z",
      loginCount: 7,
      projectsCount: 3,
      storageUsedKb: 512
    };

    // 10a. Connexion légitime d'un utilisateur disposant d'un profil Firestore actif
    authMocks.signInWithEmailAndPassword.mockResolvedValueOnce({
      user: authState.currentUser
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...activeFirestoreDoc })
    });
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: "log_1" });

    const loginResult = await loginWithEmailAndPasswordSecure(
      "ingenieur@orthogonal.dz",
      "Password123!"
    );

    expect(loginResult.isSuperAdmin).toBe(false);
    expect(loginResult.profile.uid).toBe("user_123");
    expect(loginResult.profile.status).toBe("active");
    expect(loginResult.profile.accountType).toBe("pro");
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled(); // Aucune écriture de loginCount/lastLoginAt sur profiles

    // 10b. Modification légitime des champs de présentation par le propriétaire
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...activeFirestoreDoc })
    });
    firestoreMocks.updateDoc.mockResolvedValueOnce(undefined);

    await saveFirebaseProfile({
      ...activeFirestoreDoc,
      name: "Youcef Boudjada",
      company: "Orthogonal PD&I Studio",
      country: "France",
      countryCode: "FR",
      city: "Paris"
    });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1);
    const [, sentUpdatePayload] = firestoreMocks.updateDoc.mock.calls[0];
    expect(sentUpdatePayload).toEqual({
      name: "Youcef Boudjada",
      company: "Orthogonal PD&I Studio",
      country: "France",
      countryCode: "FR",
      city: "Paris"
    });

    const updatedCache = getProfileFromLocalCache("user_123");
    expect(updatedCache?.name).toBe("Youcef Boudjada");
    expect(updatedCache?.company).toBe("Orthogonal PD&I Studio");
    expect(updatedCache?.city).toBe("Paris");
    expect(updatedCache?.accountType).toBe("pro");
    expect(updatedCache?.status).toBe("active");
    expect(updatedCache?.loginCount).toBe(7);
  });

  // =========================================================================
  // 11. SEC-01-FIX-04-R3 — Test B1-1 : Profil client obsolète construit depuis le cache local
  // =========================================================================
  it("11. (Test B1-1) Un profil client construit à partir des anciennes métadonnées du cache local met à jour la présentation sans erreur et synchronise le cache avec les valeurs serveur de Firestore", async () => {
    // Cache local obsolète : pending_activation / basic / monthly / loginCount: 1
    const staleLocalCache: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Ancien Nom Cache",
      company: "Ancienne Société Cache",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z",
      loginCount: 1,
      projectsCount: 0,
      storageUsedKb: 0
    };
    saveProfileToLocalCache(staleLocalCache);

    // Document Firestore autoritatif : active / pro / annual / loginCount: 8
    const authoritativeFirestoreDoc = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Ancien Nom Cache",
      company: "Ancienne Société Cache",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      paymentGateway: "slickpay_cib",
      currency: "DZD",
      role: "client",
      accountType: "pro",
      subscriptionPlan: "annual" as unknown as PdiUserProfile["subscriptionPlan"],
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z",
      lastLoginAt: "2026-05-01T08:30:00.000Z",
      loginCount: 8,
      projectsCount: 4,
      storageUsedKb: 1024
    };

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...authoritativeFirestoreDoc })
    });
    firestoreMocks.updateDoc.mockResolvedValueOnce(undefined);

    // L'objet transmis à saveFirebaseProfile() est réellement construit à partir du cache obsolète (staleLocalCache)
    const staleClientProfileInput: PdiUserProfile = {
      ...staleLocalCache,
      name: "Youcef Boudjada Mis À Jour",
      company: "Orthogonal PD&I Engineering"
    };

    await expect(saveFirebaseProfile(staleClientProfileInput)).resolves.toBeUndefined();

    // updateDoc() reçoit exclusivement les champs de présentation autorisés
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1);
    const [, sentUpdatePayload] = firestoreMocks.updateDoc.mock.calls[0];
    expect(sentUpdatePayload).toEqual({
      name: "Youcef Boudjada Mis À Jour",
      company: "Orthogonal PD&I Engineering",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger"
    });
    expect("status" in sentUpdatePayload).toBe(false);
    expect("accountType" in sentUpdatePayload).toBe(false);
    expect("subscriptionPlan" in sentUpdatePayload).toBe(false);
    expect("loginCount" in sentUpdatePayload).toBe(false);
    expect("role" in sentUpdatePayload).toBe(false);

    // Le cache local après succès conserve les valeurs serveur actuelles de Firestore (jamais écrasées par staleLocalCache)
    const cachedAfter = getProfileFromLocalCache("user_123");
    expect(cachedAfter).not.toBeNull();
    expect(cachedAfter?.name).toBe("Youcef Boudjada Mis À Jour");
    expect(cachedAfter?.company).toBe("Orthogonal PD&I Engineering");
    expect(cachedAfter?.status).toBe("active");
    expect(cachedAfter?.accountType).toBe("pro");
    expect(cachedAfter?.subscriptionPlan).toBe("annual");
    expect(cachedAfter?.loginCount).toBe(8);
    expect(cachedAfter?.projectsCount).toBe(4);
    expect(cachedAfter?.storageUsedKb).toBe(1024);
    expect(cachedAfter?.lastLoginAt).toBe("2026-05-01T08:30:00.000Z");
    expect(cachedAfter?.paymentGateway).toBe("slickpay_cib");
    expect(cachedAfter?.currency).toBe("DZD");
  });

  // =========================================================================
  // 12. SEC-01-FIX-04-R3 — Test B1-2 : Tentative de falsification des champs serveur
  // =========================================================================
  it("12. (Test B1-2) La transmission d'un profil contenant des champs serveur falsifiés n'inclut aucun champ serveur dans updateDoc() et ne remplace aucune valeur autoritaire dans le cache", async () => {
    const authoritativeFirestoreDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      company: "Orthogonal Studio",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      paymentGateway: "slickpay_baridimob",
      currency: "DZD",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z",
      lastLoginAt: "2026-04-12T11:00:00.000Z",
      loginCount: 2,
      projectsCount: 1,
      storageUsedKb: 128
    };
    saveProfileToLocalCache(authoritativeFirestoreDoc);

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...authoritativeFirestoreDoc })
    });
    firestoreMocks.updateDoc.mockResolvedValueOnce(undefined);

    // Objet client contenant des valeurs falsifiées pour les champs serveur et indicateurs admin
    const tamperedClientProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Présentation Légitime",
      company: "Orthogonal Process",
      country: "Algérie",
      countryCode: "DZ",
      city: "Oran",
      role: "super_admin" as const,
      status: "active" as const,
      accountType: "enterprise" as const,
      subscriptionPlan: "lifetime" as const,
      paymentGateway: "forged_gateway",
      currency: "EUR",
      createdAt: "1999-01-01T00:00:00.000Z",
      lastLoginAt: "2099-01-01T00:00:00.000Z",
      loginCount: 9999,
      projectsCount: 500,
      storageUsedKb: 999999,
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
      isActivated: true,
      admin: true
    } as unknown as PdiUserProfile;

    await expect(saveFirebaseProfile(tamperedClientProfile)).resolves.toBeUndefined();

    // 1. Aucun champ serveur ou admin ne figure dans le payload updateDoc()
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1);
    const [, sentUpdatePayload] = firestoreMocks.updateDoc.mock.calls[0];
    expect(sentUpdatePayload).toEqual({
      name: "Youcef Présentation Légitime",
      company: "Orthogonal Process",
      country: "Algérie",
      countryCode: "DZ",
      city: "Oran"
    });
    for (const forbiddenKey of [
      "role",
      "status",
      "accountType",
      "subscriptionPlan",
      "paymentGateway",
      "currency",
      "createdAt",
      "lastLoginAt",
      "loginCount",
      "projectsCount",
      "storageUsedKb",
      "isAdmin",
      "isSuperAdmin",
      "permissions",
      "isActivated",
      "admin"
    ]) {
      expect(forbiddenKey in sentUpdatePayload).toBe(false);
    }

    // 2. Aucune valeur falsifiée ne remplace les valeurs autoritaires dans le cache local
    const cachedAfter = getProfileFromLocalCache("user_123") as unknown as Record<string, unknown>;
    expect(cachedAfter).not.toBeNull();
    expect(cachedAfter.name).toBe("Youcef Présentation Légitime");
    expect(cachedAfter.company).toBe("Orthogonal Process");
    expect(cachedAfter.city).toBe("Oran");
    expect(cachedAfter.role).toBe("client");
    expect(cachedAfter.status).toBe("pending_activation");
    expect(cachedAfter.accountType).toBe("basic");
    expect(cachedAfter.subscriptionPlan).toBe("monthly");
    expect(cachedAfter.paymentGateway).toBe("slickpay_baridimob");
    expect(cachedAfter.currency).toBe("DZD");
    expect(cachedAfter.createdAt).toBe("2026-04-12T10:00:00.000Z");
    expect(cachedAfter.lastLoginAt).toBe("2026-04-12T11:00:00.000Z");
    expect(cachedAfter.loginCount).toBe(2);
    expect(cachedAfter.projectsCount).toBe(1);
    expect(cachedAfter.storageUsedKb).toBe(128);
    expect(cachedAfter.isAdmin).toBeUndefined();
    expect(cachedAfter.isSuperAdmin).toBeUndefined();
    expect(cachedAfter.permissions).toBeUndefined();
    expect(cachedAfter.isActivated).toBeUndefined();
    expect(cachedAfter.admin).toBeUndefined();
  });

  // =========================================================================
  // 13. SEC-01-FIX-04-R3 — Test B1-3 & B2 : Synchronisation atomique du cache et identité exacte des erreurs
  // =========================================================================
  it("13. (Test B1-3 / B2-1) Échec de getDoc() -> cache local strictement identique et instance d'erreur originale propagée (rejects.toBe)", async () => {
    const previousCache: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Profil Avant Erreur GetDoc",
      company: "Orthogonal",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };
    saveProfileToLocalCache(previousCache);

    const getDocError = new Error("FIRESTORE_GETDOC_FAILED: Network timeout");
    firestoreMocks.getDoc.mockRejectedValueOnce(getDocError);

    await expect(
      saveFirebaseProfile({
        ...previousCache,
        name: "Nouveau Nom Non Persisté"
      })
    ).rejects.toBe(getDocError);

    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
    expect(getProfileFromLocalCache("user_123")).toEqual(previousCache);
  });

  it("14. (Test B1-3 / B2-2) Échec de updateDoc() -> cache local strictement identique et instance d'erreur originale propagée (rejects.toBe)", async () => {
    const previousCache: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Profil Avant Erreur UpdateDoc",
      company: "Orthogonal",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "pro",
      subscriptionPlan: "yearly",
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z"
    };
    saveProfileToLocalCache(previousCache);

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...previousCache })
    });
    const updateError = new Error("FIRESTORE_UPDATEDOC_FAILED: Permission denied");
    firestoreMocks.updateDoc.mockRejectedValueOnce(updateError);

    await expect(
      saveFirebaseProfile({
        ...previousCache,
        name: "Modification Rejetée Par UpdateDoc",
        city: "Constantine"
      })
    ).rejects.toBe(updateError);

    expect(getProfileFromLocalCache("user_123")).toEqual(previousCache);
  });

  it("15. (Test B1-3 / B2-3) Échec de setDoc() -> cache local préexistant strictement identique et instance d'erreur originale propagée (rejects.toBe)", async () => {
    const preExistingCache: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Profil Cache Préexistant Avant SetDoc",
      company: "Orthogonal Cache Initial",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T09:00:00.000Z"
    };
    saveProfileToLocalCache(preExistingCache);

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });
    const setDocError = new Error("FIRESTORE_SETDOC_FAILED: Quota exceeded");
    firestoreMocks.setDoc.mockRejectedValueOnce(setDocError);

    const newProfile: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Nouveau Profil Création Échouée",
      company: "Orthogonal Nouvelle Création",
      country: "Algérie",
      countryCode: "DZ",
      city: "Oran",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };

    await expect(saveFirebaseProfile(newProfile)).rejects.toBe(setDocError);

    expect(getProfileFromLocalCache("user_123")).toEqual(preExistingCache);
  });

  it("16. (Test B2-4) Succès de updateDoc() -> le cache local est mis à jour UNIQUEMENT après la résolution de updateDoc()", async () => {
    const initialDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Nom Avant Update",
      company: "Société Avant Update",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "pro",
      subscriptionPlan: "yearly",
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z",
      loginCount: 5
    };
    saveProfileToLocalCache(initialDoc);

    let cacheDuringUpdateDocExecution: PdiUserProfile | null = null;
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...initialDoc })
    });
    firestoreMocks.updateDoc.mockImplementationOnce(async () => {
      // Au moment où updateDoc s'exécute, localStorage ne doit PAS encore avoir été modifié
      cacheDuringUpdateDocExecution = getProfileFromLocalCache("user_123");
    });

    await saveFirebaseProfile({
      ...initialDoc,
      name: "Nom Après Update Réussi",
      company: "Société Après Update Réussi"
    });

    expect(cacheDuringUpdateDocExecution).toEqual(initialDoc);
    const cacheAfterCompletion = getProfileFromLocalCache("user_123");
    expect(cacheAfterCompletion?.name).toBe("Nom Après Update Réussi");
    expect(cacheAfterCompletion?.company).toBe("Société Après Update Réussi");
    expect(cacheAfterCompletion?.status).toBe("active");
    expect(cacheAfterCompletion?.accountType).toBe("pro");
    expect(cacheAfterCompletion?.loginCount).toBe(5);
  });

  it("17. (Test B2-5) Succès de setDoc() -> le cache local est mis à jour UNIQUEMENT après la résolution de setDoc()", async () => {
    localStorage.removeItem("pdi_user_profile");

    let cacheDuringSetDocExecution: PdiUserProfile | null = null;
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });
    firestoreMocks.setDoc.mockImplementationOnce(async () => {
      // Au moment où setDoc s'exécute, localStorage doit encore être vide
      cacheDuringSetDocExecution = getProfileFromLocalCache("user_123");
    });

    const createdProfile: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Profil Créé Après SetDoc",
      company: "Orthogonal Création",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    };

    await saveFirebaseProfile(createdProfile);

    expect(cacheDuringSetDocExecution).toBeNull();
    const cacheAfterSetDoc = getProfileFromLocalCache("user_123");
    expect(cacheAfterSetDoc).not.toBeNull();
    expect(cacheAfterSetDoc?.name).toBe("Profil Créé Après SetDoc");
    expect(cacheAfterSetDoc?.status).toBe("pending_activation");
    expect(cacheAfterSetDoc?.accountType).toBe("basic");
  });

  it("18. (Test B2-6) Toute opération échouée propage exactement son instance d'erreur d'origine sans l'altérer", async () => {
    const customError = new Error("CUSTOM_FIRESTORE_ERROR_CODE_503");
    firestoreMocks.getDoc.mockRejectedValueOnce(customError);

    let caughtError: unknown = null;
    try {
      await saveFirebaseProfile({
        uid: "user_123",
        email: "ingenieur@orthogonal.dz",
        name: "Youcef Ingénieur",
        role: "client",
        accountType: "basic",
        subscriptionPlan: "monthly",
        status: "pending_activation",
        createdAt: "2026-04-12T10:00:00.000Z"
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBe(customError);
  });

  // =========================================================================
  // 19. SEC-01-FIX-04-R2 — B3 & B4 : Validation stricte de name et countryCode ISO Alpha-2 côté TypeScript
  // =========================================================================
  it("19. (B3 & B4) validateProfilePresentationFields rejette les noms blancs et impose un countryCode ISO 3166-1 alpha-2 exact", () => {
    // B3 : Rejet des noms vides ou composés uniquement d'espaces
    for (const invalidName of ["", " ", "    ", "\t", "\n", " \t \n "]) {
      expect(() =>
        validateProfilePresentationFields({ name: invalidName }, true)
      ).toThrow(/name/);
    }

    // B3 : Acceptation d'un nom valide
    expect(() =>
      validateProfilePresentationFields({ name: "Ingénieur Valide" }, true)
    ).not.toThrow();

    // B4 : Acceptation des codes ISO alpha-2 exacts (2 lettres majuscules) et de l'omission
    expect(() =>
      validateProfilePresentationFields({ name: "Ingénieur", countryCode: "DZ" }, true)
    ).not.toThrow();
    expect(() =>
      validateProfilePresentationFields({ name: "Ingénieur", countryCode: "US" }, true)
    ).not.toThrow();
    expect(() =>
      validateProfilePresentationFields({ name: "Ingénieur" }, true)
    ).not.toThrow();

    // B4 : Rejet de tous les formats countryCode non conformes
    const invalidCodes: unknown[] = [
      "DZA",
      "DZ123",
      "dz",
      "Dz",
      "12",
      "123",
      "",
      "A",
      "FRX",
      12,
      ["DZ"],
      { code: "DZ" },
      null
    ];

    for (const badCode of invalidCodes) {
      expect(() =>
        validateProfilePresentationFields(
          { name: "Ingénieur", countryCode: badCode as string },
          true
        )
      ).toThrow(/countryCode/);
    }
  });
});

// ===========================================================================
// AUTH-ADMIN-05-FIX-11-R2 — BLOC A, BLOC B & BLOC E (8.1 / 8.2 / 8.4)
// Hygiène de session Firebase, classification Firestore, déconnexion vérifiée
// et isolation stricte de pending_activation
// ===========================================================================
describe("AUTH-ADMIN-05-FIX-11-R2 : Session Hygiene, Firestore Error Classification, Verified Logout & Pending Activation Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("navigator", { userAgent: "Vitest-Agent/1.0" });

    authState.currentUser = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      emailVerified: true,
      displayName: "Ingénieur Test",
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { email: "ingenieur@orthogonal.dz", email_verified: true, role: "client" }
      })
    };

    authMocks.signOut.mockImplementation(async () => {
      authState.currentUser = null;
    });
  });

  it("FIX-11-R2 [8.1.1 & 8.1.2] : Connexion Google et Email/Password avec profil absent -> fbSignOut appelé, auth.currentUser === null et caches purgés", async () => {
    const mockUser = authState.currentUser!;
    localStorage.setItem("pdi.auth.mode.v1", "client");
    localStorage.setItem("pdi.user.profile.v1", JSON.stringify({ uid: "user_123", status: "active" }));
    localStorage.setItem("pdi_user_profile", JSON.stringify({ uid: "user_123", status: "active" }));
    sessionStorage.setItem("pdi.stage.v4", "app");

    // 1. Google avec profil absent
    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = mockUser;
      return { user: mockUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(loginWithGoogleSecure()).rejects.toMatchObject({
      name: "PdiAuthAccessError",
      reason: "profile_not_found"
    });
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");
    expect(localStorage.getItem("pdi.user.profile.v1")).toBeNull();
    expect(localStorage.getItem("pdi_user_profile")).toBeNull();
    expect(sessionStorage.getItem("pdi.stage.v4")).toBeNull();

    // 2. Email/Password avec profil absent
    localStorage.setItem("pdi.auth.mode.v1", "client");
    authMocks.signInWithEmailAndPassword.mockImplementationOnce(async () => {
      authState.currentUser = mockUser;
      return { user: mockUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(
      loginWithEmailAndPasswordSecure("ingenieur@orthogonal.dz", "Pass123!")
    ).rejects.toMatchObject({
      name: "PdiAuthAccessError",
      reason: "profile_not_found"
    });
    expect(authMocks.signOut).toHaveBeenCalledTimes(2);
    expect(authState.currentUser).toBeNull();
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");
  });

  it("FIX-11-R2 [8.1.3] : Connexion Google et Email/Password avec profil active -> session conservée et profil retourné", async () => {
    const mockUser = authState.currentUser!;
    const activeDoc: PdiUserProfile = {
      uid: "user_123",
      email: "ingenieur@orthogonal.dz",
      name: "Youcef Ingénieur",
      role: "client",
      accountType: "pro",
      subscriptionPlan: "yearly",
      status: "active",
      createdAt: "2026-04-12T10:00:00.000Z"
    };

    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = mockUser;
      return { user: mockUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...activeDoc })
    });
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: "log_g1" });

    const googleRes = await loginWithGoogleSecure();
    expect(googleRes.profile.status).toBe("active");
    expect(googleRes.isSuperAdmin).toBe(false);
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(authState.currentUser?.uid).toBe("user_123");
  });

  it("FIX-11-R2 [8.1.4, 8.1.5, 8.1.6] : Profils suspended, revoked et disabled -> refus explicite, fbSignOut appelé, auth.currentUser === null et caches purgés", async () => {
    const mockUser = authState.currentUser!;
    const forbiddenStatuses: Array<"suspended" | "revoked" | "disabled"> = [
      "suspended",
      "revoked",
      "disabled"
    ];

    for (const badStatus of forbiddenStatuses) {
      vi.clearAllMocks();
      localStorage.setItem("pdi.auth.mode.v1", "client");
      localStorage.setItem("pdi_user_profile", JSON.stringify({ uid: "user_123", status: "active" }));

      authMocks.signInWithEmailAndPassword.mockImplementationOnce(async () => {
        authState.currentUser = mockUser;
        return { user: mockUser };
      });
      firestoreMocks.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: "user_123",
          email: "ingenieur@orthogonal.dz",
          name: "Compte Bloqué",
          role: "client",
          accountType: "basic",
          subscriptionPlan: "monthly",
          status: badStatus,
          createdAt: "2026-04-12T10:00:00.000Z"
        })
      });

      await expect(
        loginWithEmailAndPasswordSecure("ingenieur@orthogonal.dz", "Pass123!")
      ).rejects.toMatchObject({
        name: "PdiAuthAccessError",
        reason: badStatus
      });

      expect(authMocks.signOut).toHaveBeenCalledTimes(1);
      expect(authState.currentUser).toBeNull();
      expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");
      expect(localStorage.getItem("pdi_user_profile")).toBeNull();
    }
  });

  it("FIX-11-R2 [8.1.7 & 8.1.8] : Classification stricte des erreurs Firestore (permission_denied vs network_error vs unexpected_error)", async () => {
    const mockUser = authState.currentUser!;

    // 1. permission-denied -> refus définitif, jamais assimilé à profil absent, fbSignOut exécuté
    const permError = Object.assign(new Error("Missing or insufficient permissions."), {
      code: "permission-denied"
    });
    expect(classifyFirestoreProfileReadError(permError)).toEqual({
      reason: "permission_denied",
      code: "permission-denied",
      transient: false,
      message: expect.stringMatching(/accès refusé par Firestore lors de la lecture du profil PD&I/i)
    });

    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = mockUser;
      return { user: mockUser };
    });
    firestoreMocks.getDoc.mockRejectedValueOnce(permError);

    let caughtPerm: unknown = null;
    try {
      await loginWithGoogleSecure();
    } catch (e) {
      caughtPerm = e;
    }
    expect(caughtPerm).toBeInstanceOf(PdiAuthAccessError);
    expect((caughtPerm as PdiAuthAccessError).reason).toBe("permission_denied");
    expect((caughtPerm as PdiAuthAccessError).message).not.toMatch(/aucun profil PD&I autoritatif/i);
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();

    // 2. network_error (unavailable) -> refus d'accès au workspace, message de réessai explicite, PAS de signOut aveugle
    vi.clearAllMocks();
    const netError = Object.assign(new Error("Failed to get document because the client is offline."), {
      code: "unavailable"
    });
    expect(classifyFirestoreProfileReadError(netError)).toEqual({
      reason: "network_error",
      code: "unavailable",
      transient: true,
      message: expect.stringMatching(/erreur réseau ou service Firestore temporairement indisponible/i)
    });

    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = mockUser;
      return { user: mockUser };
    });
    firestoreMocks.getDoc.mockRejectedValueOnce(netError);

    let caughtNet: unknown = null;
    try {
      await loginWithGoogleSecure();
    } catch (e) {
      caughtNet = e;
    }
    expect(caughtNet).toBeInstanceOf(PdiAuthAccessError);
    expect((caughtNet as PdiAuthAccessError).reason).toBe("network_error");
    expect((caughtNet as PdiAuthAccessError).transient).toBe(true);
    expect((caughtNet as PdiAuthAccessError).message).toMatch(/Veuillez réessayer/i);
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");

    // Et resolveAuthoritativeWorkspaceSession refuse l'accès au workspace en cas d'erreur réseau sans signOut aveugle
    firestoreMocks.getDoc.mockRejectedValueOnce(netError);
    const sessionRes = await resolveAuthoritativeWorkspaceSession(mockUser);
    expect(sessionRes.status).toBe("error");
    expect(sessionRes.reason).toBe("network_error");
    expect(sessionRes.canAccessWorkspace).toBe(false);
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it("FIX-11-R2 [8.1.9 & 8.1.10 & 8.4] : Erreur de récupération du token et claims Super Admin invalides -> refus, fbSignOut et auth.currentUser === null", async () => {
    // 1. Erreur de récupération du token (getIdTokenResult rejette)
    const tokenFailUser = {
      uid: "user_token_fail",
      email: "ingenieur@orthogonal.dz",
      emailVerified: true,
      getIdTokenResult: vi.fn().mockRejectedValue(new Error("Token refresh failed"))
    };
    authMocks.signInWithEmailAndPassword.mockImplementationOnce(async () => {
      authState.currentUser = tokenFailUser;
      return { user: tokenFailUser };
    });

    await expect(
      loginWithEmailAndPasswordSecure("ingenieur@orthogonal.dz", "Pass123!")
    ).rejects.toMatchObject({
      name: "PdiAuthAccessError",
      reason: "token_error"
    });
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();

    // 2. Claim role="super_admin" mais email_verified=false -> refus invalid_claims + signOut
    vi.clearAllMocks();
    const unverifiedSuperUser = {
      uid: "uid_super",
      email: "boudjada.youcef@gmail.com",
      emailVerified: false,
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: "super_admin", email_verified: false, email: "boudjada.youcef@gmail.com" }
      })
    };
    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = unverifiedSuperUser;
      return { user: unverifiedSuperUser };
    });

    await expect(loginWithGoogleSecure()).rejects.toMatchObject({
      name: "PdiAuthAccessError",
      reason: "invalid_claims"
    });
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();

    // 3. Profil Firestore role="super_admin" mais sans Custom Claim Super Admin valide -> refus invalid_claims + signOut
    vi.clearAllMocks();
    const clientClaimUser = {
      uid: "uid_fake_super",
      email: "boudjada.youcef@gmail.com",
      emailVerified: true,
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: "client", email_verified: true, email: "boudjada.youcef@gmail.com" }
      })
    };
    authMocks.signInWithPopup.mockImplementationOnce(async () => {
      authState.currentUser = clientClaimUser;
      return { user: clientClaimUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: "uid_fake_super",
        email: "boudjada.youcef@gmail.com",
        name: "Youcef",
        role: "super_admin",
        accountType: "enterprise",
        subscriptionPlan: "lifetime",
        status: "active",
        createdAt: "2026-04-12T10:00:00.000Z"
      })
    });

    await expect(loginWithGoogleSecure()).rejects.toMatchObject({
      name: "PdiAuthAccessError",
      reason: "invalid_claims"
    });
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();
  });

  it("FIX-11-R2 [8.1.11, 8.1.12, 8.1.13] : logoutFirebase() vérifie auth.currentUser === null, purge les caches et lève une erreur explicite si fbSignOut échoue", async () => {
    localStorage.setItem("pdi.auth.mode.v1", "super_admin");
    localStorage.setItem("pdi.user.profile.v1", JSON.stringify({ uid: "user_123" }));
    localStorage.setItem("pdi_user_profile", JSON.stringify({ uid: "user_123" }));
    sessionStorage.setItem("pdi.stage.v4", "app");

    // 1. Succès de logoutFirebase()
    await expect(logoutFirebase()).resolves.toBeUndefined();
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authState.currentUser).toBeNull();
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");
    expect(localStorage.getItem("pdi.user.profile.v1")).toBeNull();
    expect(localStorage.getItem("pdi_user_profile")).toBeNull();
    expect(sessionStorage.getItem("pdi.stage.v4")).toBeNull();

    // 2. Échec de fbSignOut (promesse rejetée) -> purge quand même les caches locaux et propage une erreur explicite
    localStorage.setItem("pdi.auth.mode.v1", "client");
    sessionStorage.setItem("pdi.stage.v4", "app");
    authMocks.signOut.mockRejectedValueOnce(new Error("SignOut internal failure"));

    await expect(logoutFirebase()).rejects.toThrow(/Échec de la déconnexion Firebase Authentication/);
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");
    expect(sessionStorage.getItem("pdi.stage.v4")).toBeNull();

    // 3. fbSignOut résout mais auth.currentUser reste non nul -> lève une erreur explicite
    authState.currentUser = {
      uid: "stuck_user",
      email: "stuck@orthogonal.dz",
      emailVerified: true,
      getIdTokenResult: vi.fn()
    };
    authMocks.signOut.mockImplementationOnce(async () => {
      // Ne nettoie pas currentUser
    });

    await expect(logoutFirebase()).rejects.toThrow(/une session active persiste après signOut/);
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("guest");
  });

  it("FIX-11-R2 [8.2] : Isolation stricte de pending_activation (inscription, connexion, conservation de session pour activation uniquement, puis passage à active)", async () => {
    // 1. Inscription crée un profil pending_activation et conserve la session uniquement pour l'écran d'activation
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => false }) // restrictions pays
      .mockResolvedValueOnce({ exists: () => false }); // saveFirebaseProfile
    firestoreMocks.setDoc.mockResolvedValueOnce(undefined);

    const pendingUser = {
      uid: "user_pending_1",
      email: "pending@orthogonal.dz",
      emailVerified: false,
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { email: "pending@orthogonal.dz", role: "client" }
      })
    };

    authMocks.createUserWithEmailAndPassword.mockImplementationOnce(async () => {
      authState.currentUser = pendingUser;
      return { user: pendingUser };
    });

    const regProfile = await registerWithEmailAndPasswordSecure({
      email: "pending@orthogonal.dz",
      password: "Password123!",
      name: "Utilisateur En Attente",
      company: "Bureau Piping",
      country: "Algérie",
      countryCode: "DZ",
      city: "Alger",
      requestedPlan: "pro"
    });

    expect(regProfile.status).toBe("pending_activation");
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(authState.currentUser?.uid).toBe("user_pending_1");
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("pending_email");
    expect(sessionStorage.getItem("pdi.stage.v4")).toBeNull();

    // 2. Tentative de connexion avec un profil pending_activation -> lève PdiAuthAccessError(reason="pending_activation") SANS déconnecter l'utilisateur pour lui permettre d'activer sa licence
    authMocks.signInWithEmailAndPassword.mockImplementationOnce(async () => {
      authState.currentUser = pendingUser;
      return { user: pendingUser };
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...regProfile })
    });

    let pendingLoginErr: unknown = null;
    try {
      await loginWithEmailAndPasswordSecure("pending@orthogonal.dz", "Password123!");
    } catch (err) {
      pendingLoginErr = err;
    }
    expect(pendingLoginErr).toBeInstanceOf(PdiAuthAccessError);
    expect((pendingLoginErr as PdiAuthAccessError).reason).toBe("pending_activation");
    expect((pendingLoginErr as PdiAuthAccessError).pendingProfile?.uid).toBe("user_pending_1");
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(authState.currentUser?.uid).toBe("user_pending_1");
    expect(localStorage.getItem("pdi.auth.mode.v1")).toBe("pending_email");

    // 3. Résolution de session autoritaire pour pending_activation -> canAccessActivation=true, canAccessWorkspace=false, isSuperAdmin=false
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...regProfile })
    });
    const pendingResolution = await resolveAuthoritativeWorkspaceSession(pendingUser);
    expect(pendingResolution).toEqual({
      status: "pending_activation",
      reason: "pending_activation",
      profile: expect.objectContaining({ uid: "user_pending_1", status: "pending_activation" }),
      isSuperAdmin: false,
      authMode: "pending_email",
      canAccessWorkspace: false,
      canAccessActivation: true
    });

    // 4. Après validation serveur du profil (passage à status="active"), une nouvelle résolution autorise le workspace
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...regProfile, status: "active", accountType: "pro" })
    });
    const activeResolution = await resolveAuthoritativeWorkspaceSession(pendingUser);
    expect(activeResolution.status).toBe("active");
    expect(activeResolution.canAccessWorkspace).toBe(true);
    expect(activeResolution.canAccessActivation).toBe(false);
    expect(activeResolution.authMode).toBe("client");
    expect(activeResolution.profile?.status).toBe("active");
  });

  // =========================================================================
  // FIRESTORE-NAMED-DB-01-FIX-01 : TESTS DE CONFIGURATION, CLIENT WEB & FIREBASE.JSON (SECTIONS 6.A, 6.B, 6.E)
  // =========================================================================
  it("FIRESTORE-NAMED-DB-01-FIX-01 [6.A] : Validation stricte du Database ID et du Project ID côté client (aucun fallback vers (default))", () => {
    // 1. Database ID correct accepté
    expect(
      validateClientFirestoreDatabaseId("ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf")
    ).toBe(EXPECTED_FIRESTORE_DATABASE_ID);

    // 2. Database ID absent refusé
    expect(() => validateClientFirestoreDatabaseId(undefined)).toThrow(/absent ou vide/);
    expect(() => validateClientFirestoreDatabaseId(null)).toThrow(/absent ou vide/);
    expect(() => validateClientFirestoreDatabaseId("")).toThrow(/absent ou vide/);
    expect(() => validateClientFirestoreDatabaseId("   ")).toThrow(/absent ou vide/);

    // 3. '(default)' formellement refusé
    expect(() => validateClientFirestoreDatabaseId("(default)")).toThrow(/\(default\)['"]? est interdite/);
    expect(() => validateClientFirestoreDatabaseId(" (default) ")).toThrow(/\(default\)['"]? est interdite/);

    // 4. Database ID incorrect refusé
    expect(() => validateClientFirestoreDatabaseId("wrong-firestore-db")).toThrow(/invalide/);

    // 5. Project ID correct accepté et Project ID incorrect ou absent refusé
    expect(validateClientFirebaseProjectId("graphical-router-x18qq")).toBe(EXPECTED_FIREBASE_PROJECT_ID);
    expect(() => validateClientFirebaseProjectId(undefined)).toThrow(/absent ou vide/);
    expect(() => validateClientFirebaseProjectId("")).toThrow(/absent ou vide/);
    expect(() => validateClientFirebaseProjectId("wrong-project-id")).toThrow(/projectId invalide/);

    // 6. resolveClientFirebaseConfig refuse explicitement une variable VITE_FIREBASE_DATABASE_ID vide, '(default)' ou erronée sans fallback
    expect(() =>
      resolveClientFirebaseConfig({ VITE_FIREBASE_DATABASE_ID: "" })
    ).toThrow(/absent ou vide/);
    expect(() =>
      resolveClientFirebaseConfig({ VITE_FIREBASE_DATABASE_ID: "(default)" })
    ).toThrow(/\(default\)['"]? est interdite/);
    expect(() =>
      resolveClientFirebaseConfig({ VITE_FIREBASE_DATABASE_ID: "other-db" })
    ).toThrow(/invalide/);
    expect(() =>
      resolveClientFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: "other-project" })
    ).toThrow(/projectId invalide/);
    expect(() =>
      resolveClientFirebaseConfig({}, { requireExplicitEnv: true })
    ).toThrow(/absent ou vide/);
  });

  it("FIRESTORE-NAMED-DB-01-FIX-01 [6.B] : Initialisation Firestore client avec la base nommée, absence de double initialisation et préservation de Firebase Auth", () => {
    // 1. La configuration active utilise explicitement la base nommée
    expect(activeConfig.projectId).toBe("graphical-router-x18qq");
    expect(activeConfig.firestoreDatabaseId).toBe(
      "ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf"
    );
    expect(activeConfig.firestoreDatabaseId).not.toBe("(default)");

    // 2. Absence de double initialisation sur l'instance d'application existante
    firestoreMocks.initializeFirestore.mockClear();
    const sameDb = getOrInitializeClientFirestore(app, activeConfig);
    expect(sameDb).toBe(db);
    expect(firestoreMocks.initializeFirestore).not.toHaveBeenCalled();

    // 3. Sur une nouvelle instance d'application, initializeFirestore reçoit explicitement la base nommée en 3e argument
    const customApp = { name: "secondary-test-app", options: { projectId: EXPECTED_FIREBASE_PROJECT_ID } };
    const secondaryDb = getOrInitializeClientFirestore(customApp, {
      projectId: EXPECTED_FIREBASE_PROJECT_ID,
      firestoreDatabaseId: EXPECTED_FIRESTORE_DATABASE_ID
    });
    expect(firestoreMocks.initializeFirestore).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.initializeFirestore).toHaveBeenCalledWith(
      customApp,
      expect.any(Object),
      "ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf"
    );

    // Un second appel sur customApp retourne exactement la même instance sans réinitialiser Firestore
    const secondaryDbAgain = getOrInitializeClientFirestore(customApp, {
      projectId: EXPECTED_FIREBASE_PROJECT_ID,
      firestoreDatabaseId: EXPECTED_FIRESTORE_DATABASE_ID
    });
    expect(secondaryDbAgain).toBe(secondaryDb);
    expect(firestoreMocks.initializeFirestore).toHaveBeenCalledTimes(1);

    // Un appel sur customApp avec un Database ID absent ou '(default)' échoue immédiatement
    expect(() =>
      getOrInitializeClientFirestore({ name: "bad-app", options: { projectId: EXPECTED_FIREBASE_PROJECT_ID } }, {
        projectId: EXPECTED_FIREBASE_PROJECT_ID,
        firestoreDatabaseId: "(default)"
      })
    ).toThrow(/\(default\)['"]? est interdite/);

    // 4. Firebase Authentication reste opérationnel
    expect(auth).toBeDefined();
    expect(auth.currentUser?.uid).toBe("user_123");
  });

  it("FIRESTORE-NAMED-DB-01-FIX-01 [6.E] : firebase.json déclare un tableau Firestore ciblant exactement la base nommée et conserve firestore.rules et l'émulateur", () => {
    const firebaseJsonRaw = fs.readFileSync(path.resolve(process.cwd(), "firebase.json"), "utf-8");
    const parsed = JSON.parse(firebaseJsonRaw);

    expect(Array.isArray(parsed.firestore)).toBe(true);
    expect(parsed.firestore).toHaveLength(1);
    expect(parsed.firestore[0]).toEqual({
      database: "ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf",
      rules: "firestore.rules"
    });
    expect(parsed.emulators).toEqual({
      firestore: {
        port: 8080
      }
    });
  });

  // =========================================================================
  // FIRESTORE-NAMED-DB-01-FIX-02 : IDENTITÉ FIREBASE APP CÔTÉ CLIENT (FIX-02-A)
  // =========================================================================
  it("FIRESTORE-NAMED-DB-01-FIX-02 [FIX-02-A] : Sélection explicite de l'application [DEFAULT], rejet d'un mauvais projet et gestion sûre des applications secondaires", () => {
    // 1. Une application [DEFAULT] préexistante du bon projet est acceptée sans réinitialisation
    const validPreexistingDefaultApp = {
      name: "[DEFAULT]",
      options: { projectId: "graphical-router-x18qq" }
    };
    const initSpyValid = vi.fn();
    const getAppSpyValid = vi.fn(() => validPreexistingDefaultApp as any);
    const reusedApp = getOrInitializeClientFirebaseApp(activeConfig, {
      getApps: () => [validPreexistingDefaultApp as any],
      getApp: getAppSpyValid,
      initializeApp: initSpyValid as any
    });
    expect(reusedApp).toBe(validPreexistingDefaultApp);
    expect(getAppSpyValid).toHaveBeenCalledTimes(1);
    expect(initSpyValid).not.toHaveBeenCalled();
    expect(validateClientFirebaseAppProjectId(reusedApp)).toBe("graphical-router-x18qq");

    // 2. Une application [DEFAULT] préexistante d'un autre projet est immédiatement rejetée
    const wrongProjectDefaultApp = {
      name: "[DEFAULT]",
      options: { projectId: "wrong-firebase-project" }
    };
    expect(() =>
      getOrInitializeClientFirebaseApp(activeConfig, {
        getApps: () => [wrongProjectDefaultApp as any],
        getApp: () => wrongProjectDefaultApp as any,
        initializeApp: vi.fn() as any
      })
    ).toThrow(/projectId invalide/);

    // Une application [DEFAULT] préexistante sans options.projectId est également rejetée
    const missingProjectDefaultApp = {
      name: "[DEFAULT]",
      options: {}
    };
    expect(() =>
      getOrInitializeClientFirebaseApp(activeConfig, {
        getApps: () => [missingProjectDefaultApp as any],
        getApp: () => missingProjectDefaultApp as any,
        initializeApp: vi.fn() as any
      })
    ).toThrow(/absent ou vide/);

    // 3. Une application secondaire préexistante sans application [DEFAULT] ne provoque pas d'erreur non contrôlée :
    // getApp() n'est pas appelé à tort et [DEFAULT] est initialisée avec activeConfig
    const preexistingSecondaryApp = {
      name: "secondary-analytics-app",
      options: { projectId: "other-secondary-project" }
    };
    const createdDefaultApp = {
      name: "[DEFAULT]",
      options: { projectId: "graphical-router-x18qq" }
    };
    const getAppThrowIfCalled = vi.fn(() => {
      throw new Error("No Firebase App '[DEFAULT]' has been created");
    });
    const initDefaultSpy = vi.fn(() => createdDefaultApp as any);

    const initializedDefault = getOrInitializeClientFirebaseApp(activeConfig, {
      getApps: () => [preexistingSecondaryApp as any],
      getApp: getAppThrowIfCalled as any,
      initializeApp: initDefaultSpy as any
    });
    expect(initializedDefault).toBe(createdDefaultApp);
    expect(getAppThrowIfCalled).not.toHaveBeenCalled();
    expect(initDefaultSpy).toHaveBeenCalledTimes(1);
    expect(initDefaultSpy).toHaveBeenCalledWith(activeConfig);

    // 4. getOrInitializeClientFirestore() rejette toute application dont le projet diverge de la configuration validée
    firestoreMocks.initializeFirestore.mockClear();
    expect(() =>
      getOrInitializeClientFirestore(
        { name: "[DEFAULT]", options: { projectId: "wrong-project-id" } },
        activeConfig
      )
    ).toThrow(/projectId invalide/);
    expect(() =>
      getOrInitializeClientFirestore(
        { name: "[DEFAULT]", options: {} },
        activeConfig
      )
    ).toThrow(/absent ou vide/);
    expect(() =>
      getOrInitializeClientFirestore(
        {
          name: "[DEFAULT]",
          options: { projectId: "graphical-router-x18qq" },
          projectId: "divergent-direct-project"
        },
        activeConfig
      )
    ).toThrow(/projectId invalide/);
    expect(firestoreMocks.initializeFirestore).not.toHaveBeenCalled();
  });
});



