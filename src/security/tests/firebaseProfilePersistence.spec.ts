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
  initializeFirestore: vi.fn(() => ({ type: "mock-firestore" })),
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
  type PdiUserProfile
} from "../../lib/firebase";

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

    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...existingFirestoreDoc })
    });

    await expect(
      saveFirebaseProfile({
        ...existingFirestoreDoc,
        status: "active"
      })
    ).rejects.toThrow(/status/);

    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(getProfileFromLocalCache("user_123")?.status).toBe("pending_activation");
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
  // 7. Le cache local reste disponible en cas d'échec distant
  // =========================================================================
  it("07. Le cache local reste disponible en cas d'échec distant sans inclure aucun champ serveur falsifié", async () => {
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

    // Le cache local reste disponible avec les modifications de présentation légitimes et les champs serveur intacts
    const cached = getProfileFromLocalCache("user_123");
    expect(cached).not.toBeNull();
    expect(cached?.name).toBe("Nom Modifié Hors Ligne");
    expect(cached?.company).toBe("Nouvelle Société");
    expect(cached?.status).toBe("pending_activation");
    expect(cached?.accountType).toBe("basic");
    expect(cached?.role).toBe("client");
  });

  // =========================================================================
  // 8. Connexion sans profil Firestore : refus fail-closed (aucun statut actif artificiel)
  // =========================================================================
  it("08. Un compte Firebase Auth sans document profiles/{uid} dans Firestore ne peut pas obtenir automatiquement un statut actif", async () => {
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

    authMocks.signInWithEmailAndPassword.mockResolvedValueOnce({
      user: authState.currentUser
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });

    await expect(
      loginWithEmailAndPasswordSecure("ingenieur@orthogonal.dz", "Password123!")
    ).rejects.toThrow(/profil PD&I autoritatif est absent dans Firestore/);

    // Aucune requête globale getDocs sur la collection profiles ne doit être exécutée
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();

    // Même garantie fail-closed pour loginWithGoogleSecure
    authMocks.signInWithPopup.mockResolvedValueOnce({
      user: authState.currentUser
    });
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false
    });

    await expect(loginWithGoogleSecure()).rejects.toThrow(
      /aucun profil PD&I autoritatif n'est enregistré dans Firestore/
    );
  });

  // =========================================================================
  // 9. Interdiction de modifier les champs d'identité ou d'autorisation
  // =========================================================================
  it("09. Un utilisateur ne peut pas modifier les champs d'identité (uid, email) ni d'autorisation ou compteurs serveur", async () => {
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

    // Tentative d'élévation de rôle
    await expect(
      saveFirebaseProfile({ ...existingDoc, role: "super_admin" })
    ).rejects.toThrow(/rôle privilégié/);

    // Tentative de modification de accountType
    await expect(
      saveFirebaseProfile({ ...existingDoc, accountType: "enterprise" })
    ).rejects.toThrow(/accountType/);

    // Tentative de modification de subscriptionPlan
    await expect(
      saveFirebaseProfile({ ...existingDoc, subscriptionPlan: "lifetime" })
    ).rejects.toThrow(/subscriptionPlan/);

    // Tentative de modification de loginCount
    await expect(
      saveFirebaseProfile({ ...existingDoc, loginCount: 99 })
    ).rejects.toThrow(/loginCount/);

    // Tentative de modification de projectsCount
    await expect(
      saveFirebaseProfile({ ...existingDoc, projectsCount: 0 })
    ).rejects.toThrow(/projectsCount/);

    // Tentative de modification de storageUsedKb
    await expect(
      saveFirebaseProfile({ ...existingDoc, storageUsedKb: 0 })
    ).rejects.toThrow(/storageUsedKb/);

    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
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
});
