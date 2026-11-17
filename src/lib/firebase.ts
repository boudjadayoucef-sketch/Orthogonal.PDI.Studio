import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDocs, 
  getDoc,
  getDocFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot
} from "firebase/firestore";
import { 
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
  signOut as fbSignOut
} from "firebase/auth";
import { isSuperAdminClaimAuthorized } from "../security/clientAuthorization";

// ==========================================
// FIRESTORE ERROR HANDLING & CONNECTION TEST
// ==========================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch {
    // Silent fallback to local persistence when offline or backend unreachable
  }
}
// ==========================================
// FIRESTORE NAMED DATABASE & CLIENT CONFIG VALIDATION (FIRESTORE-NAMED-DB-01-FIX-01)
// ==========================================
export const EXPECTED_FIREBASE_PROJECT_ID = "graphical-router-x18qq";
export const EXPECTED_FIRESTORE_DATABASE_ID =
  "ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf";

export function validateClientFirebaseProjectId(projectId: unknown): string {
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    throw new Error(
      "Configuration Firebase refusée : l'identifiant de projet (VITE_FIREBASE_PROJECT_ID) est absent ou vide."
    );
  }
  const normalized = projectId.trim();
  if (normalized !== EXPECTED_FIREBASE_PROJECT_ID) {
    throw new Error(
      `Configuration Firebase refusée : projectId invalide ('${normalized}'). Attendu : '${EXPECTED_FIREBASE_PROJECT_ID}'.`
    );
  }
  return EXPECTED_FIREBASE_PROJECT_ID;
}

export function validateClientFirestoreDatabaseId(databaseId: unknown): string {
  if (typeof databaseId !== "string" || databaseId.trim().length === 0) {
    throw new Error(
      "Configuration Firestore refusée : l'identifiant de base de données (VITE_FIREBASE_DATABASE_ID) est absent ou vide. Aucun fallback vers '(default)' n'est autorisé."
    );
  }
  const normalized = databaseId.trim();
  if (normalized === "(default)") {
    throw new Error(
      "Configuration Firestore refusée : la base '(default)' est interdite. La base nommée explicite est requise."
    );
  }
  if (normalized !== EXPECTED_FIRESTORE_DATABASE_ID) {
    throw new Error(
      `Configuration Firestore refusée : identifiant de base Firestore invalide ('${normalized}'). Attendu : '${EXPECTED_FIRESTORE_DATABASE_ID}'.`
    );
  }
  return EXPECTED_FIRESTORE_DATABASE_ID;
}

export interface ClientFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId: string;
}

export function resolveClientFirebaseConfig(
  env?: Record<string, unknown>,
  options?: { requireExplicitEnv?: boolean }
): ClientFirebaseConfig {
  const sourceEnv = env && typeof env === "object" ? env : {};
  const requireExplicit = Boolean(options?.requireExplicitEnv);

  const hasExplicitProjectId =
    Object.prototype.hasOwnProperty.call(sourceEnv, "VITE_FIREBASE_PROJECT_ID") &&
    sourceEnv.VITE_FIREBASE_PROJECT_ID !== undefined;
  const rawProjectId =
    requireExplicit || hasExplicitProjectId
      ? sourceEnv.VITE_FIREBASE_PROJECT_ID
      : EXPECTED_FIREBASE_PROJECT_ID;
  const validatedProjectId = validateClientFirebaseProjectId(rawProjectId);

  const hasExplicitDatabaseId =
    Object.prototype.hasOwnProperty.call(sourceEnv, "VITE_FIREBASE_DATABASE_ID") &&
    sourceEnv.VITE_FIREBASE_DATABASE_ID !== undefined;
  const rawDatabaseId =
    requireExplicit || hasExplicitDatabaseId
      ? sourceEnv.VITE_FIREBASE_DATABASE_ID
      : EXPECTED_FIRESTORE_DATABASE_ID;
  const validatedDatabaseId = validateClientFirestoreDatabaseId(rawDatabaseId);

  return {
    apiKey:
      typeof sourceEnv.VITE_FIREBASE_API_KEY === "string" && sourceEnv.VITE_FIREBASE_API_KEY.trim().length > 0
        ? sourceEnv.VITE_FIREBASE_API_KEY.trim()
        : "AIzaSyDdmbiKphCDABf83fWOcBix72FOMT-ZGGo",
    authDomain:
      typeof sourceEnv.VITE_FIREBASE_AUTH_DOMAIN === "string" && sourceEnv.VITE_FIREBASE_AUTH_DOMAIN.trim().length > 0
        ? sourceEnv.VITE_FIREBASE_AUTH_DOMAIN.trim()
        : "graphical-router-x18qq.firebaseapp.com",
    projectId: validatedProjectId,
    storageBucket:
      typeof sourceEnv.VITE_FIREBASE_STORAGE_BUCKET === "string" &&
      sourceEnv.VITE_FIREBASE_STORAGE_BUCKET.trim().length > 0
        ? sourceEnv.VITE_FIREBASE_STORAGE_BUCKET.trim()
        : "graphical-router-x18qq.firebasestorage.app",
    messagingSenderId:
      typeof sourceEnv.VITE_FIREBASE_MESSAGING_SENDER_ID === "string" &&
      sourceEnv.VITE_FIREBASE_MESSAGING_SENDER_ID.trim().length > 0
        ? sourceEnv.VITE_FIREBASE_MESSAGING_SENDER_ID.trim()
        : "757027531011",
    appId:
      typeof sourceEnv.VITE_FIREBASE_APP_ID === "string" && sourceEnv.VITE_FIREBASE_APP_ID.trim().length > 0
        ? sourceEnv.VITE_FIREBASE_APP_ID.trim()
        : "1:757027531011:web:758a7df99506a6e9dc6136",
    firestoreDatabaseId: validatedDatabaseId
  };
}

const CLIENT_FIRESTORE_INSTANCES = new WeakMap<
  object,
  { databaseId: string; projectId: string; instance: ReturnType<typeof initializeFirestore> }
>();

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-A) :
 * Vérifie que l'instance FirebaseApp possède un options.projectId valide et conforme au projet autorisé.
 */
export function validateClientFirebaseAppProjectId(
  appInstance: any,
  expectedProjectId: unknown = EXPECTED_FIREBASE_PROJECT_ID
): string {
  if (!appInstance || typeof appInstance !== "object") {
    throw new Error(
      "Configuration Firebase refusée : instance FirebaseApp absente ou invalide."
    );
  }
  const validatedExpected = validateClientFirebaseProjectId(expectedProjectId);
  const rawAppProjectId = appInstance?.options?.projectId;
  const validatedAppProjectId = validateClientFirebaseProjectId(rawAppProjectId);

  if (validatedAppProjectId !== validatedExpected) {
    throw new Error(
      `Configuration Firebase refusée : le projectId de l'application Firebase ('${validatedAppProjectId}') diverge de la configuration validée ('${validatedExpected}').`
    );
  }
  return validatedAppProjectId;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-A) :
 * Sélectionne explicitement l'application Firebase '[DEFAULT]' si elle existe,
 * ou l'initialise avec la configuration validée si elle n'existe pas (y compris lorsqu'une application
 * secondaire préexistante est présente sans application '[DEFAULT]').
 * Vérifie systématiquement que app.options.projectId === 'graphical-router-x18qq' avant tout appel à Auth ou Firestore.
 */
export function getOrInitializeClientFirebaseApp(
  config: ClientFirebaseConfig,
  sdk?: {
    getApps?: typeof getApps;
    getApp?: typeof getApp;
    initializeApp?: typeof initializeApp;
  }
): ReturnType<typeof initializeApp> {
  const validatedProjectId = validateClientFirebaseProjectId(config?.projectId);
  validateClientFirestoreDatabaseId(config?.firestoreDatabaseId);

  const listApps = sdk?.getApps ?? getApps;
  const fetchDefaultApp = sdk?.getApp ?? getApp;
  const createApp = sdk?.initializeApp ?? initializeApp;

  const existingApps = listApps();
  const defaultAppInList = Array.isArray(existingApps)
    ? existingApps.find(
        (candidate: any) =>
          candidate && typeof candidate === "object" && candidate.name === "[DEFAULT]"
      )
    : undefined;

  let resolvedApp: any;
  if (defaultAppInList) {
    const fetchedApp = typeof fetchDefaultApp === "function" ? fetchDefaultApp() : defaultAppInList;
    resolvedApp =
      fetchedApp && typeof fetchedApp === "object" && fetchedApp.options !== undefined
        ? fetchedApp
        : defaultAppInList;

    if (resolvedApp?.name !== undefined && resolvedApp.name !== "[DEFAULT]") {
      throw new Error(
        `Configuration Firebase refusée : l'application sélectionnée ('${String(resolvedApp.name)}') n'est pas l'application '[DEFAULT]'.`
      );
    }
    validateClientFirebaseAppProjectId(resolvedApp, validatedProjectId);
  } else {
    resolvedApp = createApp(config);
    if (resolvedApp && typeof resolvedApp === "object" && resolvedApp.options === undefined) {
      (resolvedApp as any).options = { ...config, projectId: validatedProjectId };
    }
    validateClientFirebaseAppProjectId(resolvedApp, validatedProjectId);
  }

  return resolvedApp;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-01 & FIX-02 (4.1 & FIX-02-A) :
 * Initialise Firestore côté client exclusivement sur la base nommée validée,
 * sans aucun fallback vers '(default)', en vérifiant la cohérence du projectId de l'application,
 * et en garantissant une seule initialisation par instance d'application.
 */
export function getOrInitializeClientFirestore(
  appInstance: any,
  config: { projectId?: unknown; firestoreDatabaseId?: unknown }
): ReturnType<typeof initializeFirestore> {
  if (!appInstance || typeof appInstance !== "object") {
    throw new Error("Initialisation Firestore refusée : instance FirebaseApp absente ou invalide.");
  }

  const validatedProjectId = validateClientFirebaseProjectId(config?.projectId);
  const validatedDatabaseId = validateClientFirestoreDatabaseId(config?.firestoreDatabaseId);

  validateClientFirebaseAppProjectId(appInstance, validatedProjectId);
  if ("projectId" in appInstance && appInstance.projectId !== undefined) {
    const directAppProj = validateClientFirebaseProjectId(appInstance.projectId);
    if (directAppProj !== validatedProjectId) {
      throw new Error(
        "Initialisation Firestore refusée : divergence entre le projectId de l'application et la configuration validée."
      );
    }
  }

  const existing = CLIENT_FIRESTORE_INSTANCES.get(appInstance);
  if (existing) {
    if (existing.databaseId !== validatedDatabaseId || existing.projectId !== validatedProjectId) {
      throw new Error(
        "Initialisation Firestore refusée : une instance Firestore est déjà initialisée avec une configuration différente."
      );
    }
    return existing.instance;
  }

  const instance = initializeFirestore(
    appInstance,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    validatedDatabaseId
  );

  CLIENT_FIRESTORE_INSTANCES.set(appInstance, {
    databaseId: validatedDatabaseId,
    projectId: validatedProjectId,
    instance
  });

  return instance;
}

const metaEnv = (typeof import.meta !== "undefined" && (import.meta as any)?.env) || {};

const activeConfig = resolveClientFirebaseConfig(metaEnv);

// Initialize or select [DEFAULT] Firebase App with strict projectId verification (FIX-02-A)
const app = getOrInitializeClientFirebaseApp(activeConfig);
validateClientFirebaseAppProjectId(app, activeConfig.projectId);

// Initialize Firestore with robust local offline persistence (IndexedDB) and explicit named database ID
const db = getOrInitializeClientFirestore(app, activeConfig);

const auth = getAuth(app);

export { app, db, auth, activeConfig };

// ==========================================
// MODELS & SERVICES
// ==========================================

export type PdiUserRole = "super_admin" | "admin" | "client" | "guest" | "demo";
export type PdiAccountType = "basic" | "pro" | "enterprise" | "team";
export type PdiSubscriptionPlan = "monthly" | "yearly" | "trial" | "lifetime";

export interface PdiUserProfile {
  uid: string;
  email: string;
  name: string;
  company?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  paymentGateway?: string;
  currency?: string;
  role: PdiUserRole;
  accountType: PdiAccountType;
  subscriptionPlan: PdiSubscriptionPlan;
  status: "active" | "suspended" | "pending_activation" | "revoked" | "disabled";
  createdAt: string;
  lastLoginAt?: string;
  loginCount?: number;
  projectsCount?: number;
  storageUsedKb?: number;
}

export interface PdiConnectionLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  accountType?: string;
  ip?: string;
  userAgent?: string;
  device?: string;
  timestamp: string;
  status: "success" | "failed";
}

export interface PdiCommercialVisit {
  id: string;
  path: string;
  referrer?: string;
  section?: string;
  action?: string;
  device?: string;
  timestamp: string;
}

export interface PdiUserFeedback {
  id: string;
  userId?: string;
  userEmail: string;
  userName?: string;
  category: "feature_request" | "bug_report" | "general_feedback" | "satisfaction";
  rating: number; // 1 to 5
  title: string;
  message: string;
  status: "new" | "reviewed" | "in_progress" | "resolved";
  createdAt: string;
  adminNotes?: string;
}

export interface PdiSubscriberUsage {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  module: string;
  details?: string;
  timestamp: string;
}

// ------------------------------------------
// PROFILES API
// ------------------------------------------
export async function getFirebaseProfiles(): Promise<PdiUserProfile[]> {
  try {
    const q = query(collection(db, "profiles"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list: PdiUserProfile[] = [];
    snap.forEach((docSnap) => {
      list.push({ uid: docSnap.id, ...docSnap.data() } as PdiUserProfile);
    });
    return list;
  } catch (err) {
    console.warn("Firestore profiles read fallback:", err);
    try {
      const cached = localStorage.getItem("pdi_user_profile");
      if (cached) {
        return [JSON.parse(cached)];
      }
    } catch {
      // Ignore
    }
    return [];
  }
}

export function getProfileFromLocalCache(uid?: string): PdiUserProfile | null {
  try {
    const raw = localStorage.getItem("pdi_user_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PdiUserProfile;
    if (!parsed || typeof parsed !== "object" || typeof parsed.uid !== "string") {
      return null;
    }
    if (uid && parsed.uid !== uid) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfileToLocalCache(profile: PdiUserProfile): void {
  try {
    localStorage.setItem("pdi_user_profile", JSON.stringify(profile));
  } catch {
    // Ignore storage limits
  }
}

/**
 * SEC-01-FIX-04-R1 & R2 (Corrections B3, B4, E) : Validation stricte des champs de présentation éditables.
 * Rejette tout objet, tableau, nombre, booléen, null, nom composé uniquement d'espaces ou code pays hors ISO alpha-2.
 */
export function validateProfilePresentationFields(
  profile: Partial<PdiUserProfile>,
  requireName: boolean
): void {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("Validation du profil refusée : données de profil invalides.");
  }

  const raw = profile as Record<string, unknown>;

  if (requireName || "name" in raw) {
    if (
      typeof raw.name !== "string" ||
      raw.name.length < 1 ||
      raw.name.length > 120 ||
      raw.name.trim().length < 1 ||
      /^\s*$/.test(raw.name)
    ) {
      throw new Error(
        "Validation du profil refusée : le champ 'name' doit être une chaîne non vide de 1 à 120 caractères."
      );
    }
  }

  if ("company" in raw && raw.company !== undefined) {
    if (typeof raw.company !== "string" || raw.company.length > 150) {
      throw new Error(
        "Validation du profil refusée : le champ 'company' doit être une chaîne d'au plus 150 caractères."
      );
    }
  }

  if ("country" in raw && raw.country !== undefined) {
    if (typeof raw.country !== "string" || raw.country.length > 100) {
      throw new Error(
        "Validation du profil refusée : le champ 'country' doit être une chaîne d'au plus 100 caractères."
      );
    }
  }

  if ("countryCode" in raw && raw.countryCode !== undefined) {
    if (
      typeof raw.countryCode !== "string" ||
      raw.countryCode.length !== 2 ||
      !/^[A-Z]{2}$/.test(raw.countryCode)
    ) {
      throw new Error(
        "Validation du profil refusée : le champ 'countryCode' doit être un code ISO 3166-1 alpha-2 valide (exactement 2 lettres majuscules)."
      );
    }
  }

  if ("city" in raw && raw.city !== undefined) {
    if (typeof raw.city !== "string" || raw.city.length > 100) {
      throw new Error(
        "Validation du profil refusée : le champ 'city' doit être une chaîne d'au plus 100 caractères."
      );
    }
  }
}

const FORBIDDEN_CLIENT_PROFILE_KEYS = [
  "isAdmin",
  "isSuperAdmin",
  "permissions",
  "isActivated",
  "admin"
] as const;

const SERVER_COUNTER_AND_AUDIT_KEYS = [
  "loginCount",
  "projectsCount",
  "storageUsedKb",
  "lastLoginAt"
] as const;

/**
 * SEC-01-FIX-04 & R1 : Construit le payload strict de création initiale d'un profil dans Firestore.
 * Exclut formellement et rejette toute tentative d'injection :
 * - des compteurs serveur : loginCount, projectsCount, storageUsedKb
 * - des champs de gestion serveur : lastLoginAt
 * - des champs de privilèges ou d'activation : role != client, status != pending_activation,
 *   accountType != basic, subscriptionPlan != monthly, isAdmin, isSuperAdmin, permissions, isActivated, admin.
 */
export function buildFirestoreProfileCreatePayload(
  profile: PdiUserProfile,
  authenticatedUid: string,
  authenticatedEmail: string
): Record<string, string> {
  if (!authenticatedUid || typeof profile?.uid !== "string" || profile.uid !== authenticatedUid) {
    throw new Error("Intégrité du profil refusée : l'UID du profil ne correspond pas à l'utilisateur authentifié.");
  }
  const normalizedAuthEmail = authenticatedEmail.trim().toLowerCase();
  const normalizedProfileEmail = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!normalizedAuthEmail || !normalizedProfileEmail || profile.email !== authenticatedEmail) {
    throw new Error("Intégrité du profil refusée : l'email du profil ne correspond pas au claim Firebase Authentication.");
  }

  const raw = profile as unknown as Record<string, unknown>;
  for (const key of FORBIDDEN_CLIENT_PROFILE_KEYS) {
    if (key in raw && raw[key] !== undefined) {
      throw new Error(`Intégrité du profil refusée : le champ d'autorisation '${key}' est interdit côté client.`);
    }
  }
  for (const key of SERVER_COUNTER_AND_AUDIT_KEYS) {
    if (key in raw && raw[key] !== undefined) {
      throw new Error(`Intégrité du profil refusée : le champ serveur '${key}' ne peut pas être défini par le client.`);
    }
  }

  if (raw.role !== undefined && raw.role !== "client") {
    throw new Error("Intégrité du profil refusée : aucun rôle privilégié ne peut être attribué par le client.");
  }
  if (raw.status !== undefined && raw.status !== "pending_activation") {
    throw new Error("Intégrité du profil refusée : un profil créé par le client doit avoir le statut 'pending_activation'.");
  }
  if (raw.accountType !== undefined && raw.accountType !== "basic") {
    throw new Error("Intégrité du profil refusée : un profil créé par le client doit avoir le plan initial 'basic'.");
  }
  if (raw.subscriptionPlan !== undefined && raw.subscriptionPlan !== "monthly") {
    throw new Error("Intégrité du profil refusée : un profil créé par le client doit avoir le cycle initial 'monthly'.");
  }

  validateProfilePresentationFields(profile, true);

  if (raw.paymentGateway !== undefined && (typeof raw.paymentGateway !== "string" || raw.paymentGateway.length > 60)) {
    throw new Error("Validation du profil refusée : le champ 'paymentGateway' est invalide.");
  }
  if (raw.currency !== undefined && (typeof raw.currency !== "string" || raw.currency.length > 10)) {
    throw new Error("Validation du profil refusée : le champ 'currency' est invalide.");
  }
  if (raw.createdAt !== undefined && (typeof raw.createdAt !== "string" || raw.createdAt.length === 0 || raw.createdAt.length > 60)) {
    throw new Error("Validation du profil refusée : le champ 'createdAt' est invalide.");
  }

  const payload: Record<string, string> = {
    uid: authenticatedUid,
    email: authenticatedEmail,
    name: profile.name,
    accountType: "basic",
    subscriptionPlan: "monthly",
    status: "pending_activation",
    createdAt: profile.createdAt || new Date().toISOString()
  };

  if (profile.company !== undefined) payload.company = profile.company;
  if (profile.country !== undefined) payload.country = profile.country;
  if (profile.countryCode !== undefined) payload.countryCode = profile.countryCode;
  if (profile.city !== undefined) payload.city = profile.city;
  if (profile.paymentGateway !== undefined) payload.paymentGateway = profile.paymentGateway;
  if (profile.currency !== undefined) payload.currency = profile.currency;

  return payload;
}

/**
 * SEC-01-FIX-04 & R1 : Construit le payload strict de mise à jour cliente d'un profil dans Firestore.
 * Seuls les champs de présentation validés sont autorisés.
 * Exclut formellement : uid, email, role, status, accountType, subscriptionPlan,
 * loginCount, projectsCount, storageUsedKb, createdAt, lastLoginAt, paymentGateway, currency.
 */
export function buildFirestoreProfileUpdatePayload(
  profile: Partial<PdiUserProfile>
): Record<string, string> {
  validateProfilePresentationFields(profile, false);

  const payload: Record<string, string> = {};
  if (profile.name !== undefined) payload.name = profile.name;
  if (profile.company !== undefined) payload.company = profile.company;
  if (profile.country !== undefined) payload.country = profile.country;
  if (profile.countryCode !== undefined) payload.countryCode = profile.countryCode;
  if (profile.city !== undefined) payload.city = profile.city;
  return payload;
}

function buildSafeLocalCacheProfile(
  validatedPresentationOrCreate: Record<string, string>,
  authenticatedUid: string,
  authenticatedEmail: string,
  authoritativeBase?: Partial<PdiUserProfile> | null
): PdiUserProfile {
  if (authoritativeBase) {
    const safeProfile: PdiUserProfile = {
      uid: authenticatedUid,
      email: authenticatedEmail,
      name: validatedPresentationOrCreate.name ?? authoritativeBase.name ?? "",
      company: validatedPresentationOrCreate.company ?? authoritativeBase.company ?? "",
      country: validatedPresentationOrCreate.country ?? authoritativeBase.country ?? "",
      countryCode: validatedPresentationOrCreate.countryCode ?? authoritativeBase.countryCode ?? "DZ",
      city: validatedPresentationOrCreate.city ?? authoritativeBase.city ?? "",
      role: "client",
      accountType: authoritativeBase.accountType ?? "basic",
      subscriptionPlan: authoritativeBase.subscriptionPlan ?? "monthly",
      status: authoritativeBase.status ?? "pending_activation",
      createdAt: authoritativeBase.createdAt || new Date().toISOString()
    };

    if (authoritativeBase.paymentGateway !== undefined) {
      safeProfile.paymentGateway = authoritativeBase.paymentGateway;
    }
    if (authoritativeBase.currency !== undefined) {
      safeProfile.currency = authoritativeBase.currency;
    }
    if (authoritativeBase.lastLoginAt !== undefined) {
      safeProfile.lastLoginAt = authoritativeBase.lastLoginAt;
    }
    if (authoritativeBase.loginCount !== undefined) {
      safeProfile.loginCount = authoritativeBase.loginCount;
    }
    if (authoritativeBase.projectsCount !== undefined) {
      safeProfile.projectsCount = authoritativeBase.projectsCount;
    }
    if (authoritativeBase.storageUsedKb !== undefined) {
      safeProfile.storageUsedKb = authoritativeBase.storageUsedKb;
    }

    return safeProfile;
  }

  const createdProfile: PdiUserProfile = {
    uid: authenticatedUid,
    email: authenticatedEmail,
    name: validatedPresentationOrCreate.name ?? "",
    company: validatedPresentationOrCreate.company ?? "",
    country: validatedPresentationOrCreate.country ?? "",
    countryCode: validatedPresentationOrCreate.countryCode ?? "DZ",
    city: validatedPresentationOrCreate.city ?? "",
    role: "client",
    accountType: "basic",
    subscriptionPlan: "monthly",
    status: "pending_activation",
    createdAt: validatedPresentationOrCreate.createdAt || new Date().toISOString()
  };

  if (validatedPresentationOrCreate.paymentGateway !== undefined) {
    createdProfile.paymentGateway = validatedPresentationOrCreate.paymentGateway;
  }
  if (validatedPresentationOrCreate.currency !== undefined) {
    createdProfile.currency = validatedPresentationOrCreate.currency;
  }

  return createdProfile;
}

export async function saveFirebaseProfile(profile: PdiUserProfile): Promise<void> {
  // 1. Authentification et validation de l'identité et des champs de présentation (aucune lecture/écriture localStorage)
  const currentUser = auth.currentUser;
  if (!currentUser || !profile || typeof profile.uid !== "string" || currentUser.uid !== profile.uid) {
    throw new Error("Sauvegarde Firestore refusée : l'UID du profil ne correspond pas à l'utilisateur authentifié.");
  }

  const tokenEmail = currentUser.email || "";
  if (!tokenEmail || typeof profile.email !== "string" || profile.email !== tokenEmail) {
    throw new Error("Sauvegarde Firestore refusée : l'email du profil ne correspond pas à l'utilisateur authentifié.");
  }

  validateProfilePresentationFields(profile, true);

  // 2. Lecture Firestore — le document Firestore est l'unique source d'autorité (SEC-01-FIX-04-R3 B1)
  const profileRef = doc(db, "profiles", currentUser.uid);
  const existingSnap = await getDoc(profileRef);

  if (existingSnap.exists()) {
    const existingData = existingSnap.data();
    if (existingData.uid && existingData.uid !== profile.uid) {
      throw new Error("Sauvegarde Firestore refusée : l'UID d'un profil ne peut pas être modifié.");
    }
    if (existingData.email && existingData.email !== profile.email) {
      throw new Error("Sauvegarde Firestore refusée : l'email d'un profil ne peut pas être modifié après création.");
    }

    // 3. Construction du payload de présentation par projection explicite et contrôlée (B1-A & B1-B)
    const updatePayload = buildFirestoreProfileUpdatePayload(profile);

    // 4. Écriture Firestore (exclusivement les champs de présentation autorisés)
    if (Object.keys(updatePayload).length > 0) {
      await updateDoc(profileRef, updatePayload);
    }

    // 5. Après succès seulement, synchronisation du cache local à partir des données autoritaires Firestore (B1-C)
    const synchronizedLocalProfile = buildSafeLocalCacheProfile(
      updatePayload,
      currentUser.uid,
      tokenEmail,
      existingData as Partial<PdiUserProfile>
    );
    saveProfileToLocalCache(synchronizedLocalProfile);
  } else {
    // Création initiale : préservation intégrale des protections R2 (B1-D)
    const createPayload = buildFirestoreProfileCreatePayload(profile, currentUser.uid, tokenEmail);
    await setDoc(profileRef, createPayload);

    const createdLocalProfile = buildSafeLocalCacheProfile(
      createPayload,
      currentUser.uid,
      tokenEmail,
      null
    );
    saveProfileToLocalCache(createdLocalProfile);
  }
}

export async function deleteFirebaseProfile(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "profiles", uid));
  } catch (err) {
    console.warn("Error deleting profile:", err);
  }
}

// ------------------------------------------
// CONNECTION LOGS
// ------------------------------------------
export async function logConnectionToFirebase(logData: Omit<PdiConnectionLog, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "connection_logs"), {
      ...logData,
      id: docRefPlaceholder(),
      timestamp: logData.timestamp || new Date().toISOString()
    });
    return docRef.id;
  } catch (err) {
    console.warn("Could not log connection to Firestore:", err);
    return "local-log";
  }
}

export async function getConnectionLogsFromFirebase(limitCount = 50): Promise<PdiConnectionLog[]> {
  try {
    const q = query(collection(db, "connection_logs"), orderBy("timestamp", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const logs: PdiConnectionLog[] = [];
    snap.forEach((d) => logs.push({ id: d.id, ...d.data() } as PdiConnectionLog));
    return logs;
  } catch (err) {
    console.warn("Could not get connection logs from Firestore:", err);
    return [];
  }
}

// ------------------------------------------
// COMMERCIAL SITE VISITS
// ------------------------------------------
export async function recordCommercialVisit(visit: Omit<PdiCommercialVisit, "id">): Promise<void> {
  try {
    await addDoc(collection(db, "commercial_visits"), {
      ...visit,
      timestamp: visit.timestamp || new Date().toISOString()
    });
  } catch (err) {
    console.warn("Commercial visit tracking log error:", err);
  }
}

export async function getCommercialVisitsFromFirebase(limitCount = 60): Promise<PdiCommercialVisit[]> {
  try {
    const q = query(collection(db, "commercial_visits"), orderBy("timestamp", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const visits: PdiCommercialVisit[] = [];
    snap.forEach((d) => visits.push({ id: d.id, ...d.data() } as PdiCommercialVisit));
    return visits;
  } catch (err) {
    console.warn("Could not get commercial visits from Firestore:", err);
    return [];
  }
}

// ------------------------------------------
// USER FEEDBACK
// ------------------------------------------
export async function submitUserFeedback(feedback: Omit<PdiUserFeedback, "id" | "createdAt" | "status">): Promise<string> {
  try {
    const newFeedback = {
      ...feedback,
      status: "new" as const,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, "user_feedbacks"), newFeedback);
    return docRef.id;
  } catch (err) {
    console.error("Error submitting user feedback to Firestore:", err);
    throw err;
  }
}

export async function getUserFeedbacksFromFirebase(limitCount = 50): Promise<PdiUserFeedback[]> {
  try {
    const q = query(collection(db, "user_feedbacks"), orderBy("createdAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const list: PdiUserFeedback[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PdiUserFeedback));
    return list;
  } catch (err) {
    console.warn("Could not get feedback from Firestore:", err);
    return [];
  }
}

export async function updateFeedbackStatusInFirebase(id: string, status: PdiUserFeedback["status"], adminNotes?: string): Promise<void> {
  try {
    const updateData: Record<string, any> = { status };
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    await updateDoc(doc(db, "user_feedbacks", id), updateData);
  } catch (err) {
    console.error("Error updating feedback status in Firestore:", err);
    throw err;
  }
}

// ------------------------------------------
// SECURITY & PASSWORD HASHING (Web Crypto API SHA-256 with Salt)
// ------------------------------------------
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + "::" + password + "::PD&I_SECURE_SALT_2026");
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateCryptoSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function changeUserProfilePassword(
  _emailInput: string,
  _oldPasswordInput: string,
  newPasswordInput: string
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("Aucun utilisateur n'est actuellement connecté.");
  }

  if (newPasswordInput.length < 6) {
    throw new Error("Le nouveau mot de passe doit faire au moins 6 caractères.");
  }

  try {
    await updatePassword(auth.currentUser, newPasswordInput);
  } catch (err: any) {
    if (err.code === "auth/requires-recent-login") {
      throw new Error("Pour modifier votre mot de passe, veuillez vous reconnecter récemment puis réessayer.");
    }
    throw new Error(err.message || "Impossible de modifier le mot de passe.");
  }
}

export async function sendResetPasswordEmail(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  if (!email) {
    throw new Error("Veuillez saisir votre adresse email.");
  }
  await sendPasswordResetEmail(auth, email);
}

// ------------------------------------------
// LICENSE KEYS API
// ------------------------------------------
export interface PdiLicenseKey {
  id: string;
  code: string;
  type: string; // e.g., 'TRIAL_7', 'TRIAL_30', 'PRO_YEAR', 'TEAM_YEAR', 'ENTERPRISE'
  plan: string; // 'BASIC', 'PRO', 'TEAM', 'ENTERPRISE'
  status: "generated" | "active" | "revoked" | "expired";
  assignedTo?: string; // email
  activatedBy?: string; // email who used it
  activatedAt?: string;
  createdAt: string;
  expiresAt: string;
  maxUsers?: number;
}

export async function getFirebaseLicenseKeys(): Promise<PdiLicenseKey[]> {
  try {
    const q = query(collection(db, "license_keys"), orderBy("createdAt", "desc"), limit(100));
    const snap = await getDocs(q);
    const list: PdiLicenseKey[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PdiLicenseKey));
    return list;
  } catch (err) {
    console.warn("Could not load license keys from Firestore:", err);
    return [];
  }
}

export async function saveFirebaseLicenseKey(key: PdiLicenseKey): Promise<void> {
  try {
    await setDoc(doc(db, "license_keys", key.id), key, { merge: true });
  } catch (err) {
    console.error("Error saving license key to Firestore:", err);
    throw err;
  }
}

export async function revokeFirebaseLicenseKey(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, "license_keys", id), { status: "revoked" });
  } catch (err) {
    console.error("Error revoking license key:", err);
    throw err;
  }
}

export async function validateAndConsumeLicenseKey(code: string, userEmail: string): Promise<{ valid: boolean; plan: PdiAccountType; error?: string }> {
  const cleanedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  const cleanedEmail = typeof userEmail === "string" ? userEmail.trim().toLowerCase() : "";

  if (!cleanedCode || !cleanedEmail) {
    return {
      valid: false,
      plan: "basic",
      error: "Clé de licence et adresse email requises."
    };
  }

  // SEC-01-FIX-04-R1 (Corrections A & B) :
  // Ne jamais transformer une clé de licence côté client en preuve d'activation serveur,
  // ni muter la collection license_keys depuis un flux client d'activation.
  return {
    valid: false,
    plan: "basic",
    error: "Validation et activation de licence impossibles côté client : cette opération requiert un traitement serveur autoritatif."
  };
}

// ------------------------------------------
// CREDENTIALS & SECURE AUTHENTICATION API
// ------------------------------------------
export interface PdiAuthCredential {
  email: string;
  passwordHash: string;
  salt: string;
  role: PdiUserRole;
  isSuperAdmin?: boolean;
  updatedAt: string;
}

export async function setSuperAdminMasterPassword(password: string): Promise<void> {
  const salt = generateCryptoSalt();
  const passwordHash = await hashPassword(password, salt);
  const adminCred: PdiAuthCredential = {
    email: "boudjada.youcef@gmail.com",
    passwordHash,
    salt,
    role: "super_admin",
    isSuperAdmin: true,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, "auth_credentials", "super_admin_boudjada"), adminCred);
}

export async function hasSuperAdminPasswordConfigured(): Promise<boolean> {
  try {
    const credSnap = await getDoc(doc(db, "auth_credentials", "super_admin_boudjada"));
    return credSnap.exists() && !!credSnap.data()?.passwordHash;
  } catch {
    return false;
  }
}

export type PdiAuthDenialReason =
  | "profile_not_found"
  | "pending_activation"
  | "suspended"
  | "revoked"
  | "disabled"
  | "inactive_status"
  | "permission_denied"
  | "network_error"
  | "token_error"
  | "invalid_claims"
  | "unexpected_error"
  | "signout_failed";

export class PdiAuthAccessError extends Error {
  readonly reason: PdiAuthDenialReason;
  readonly code?: string;
  readonly transient: boolean;
  readonly sessionTerminated: boolean;
  readonly pendingProfile?: PdiUserProfile;

  constructor(options: {
    message: string;
    reason: PdiAuthDenialReason;
    code?: string;
    transient?: boolean;
    sessionTerminated?: boolean;
    pendingProfile?: PdiUserProfile;
  }) {
    super(options.message);
    this.name = "PdiAuthAccessError";
    this.reason = options.reason;
    this.code = options.code;
    this.transient = Boolean(options.transient);
    this.sessionTerminated = Boolean(options.sessionTerminated);
    this.pendingProfile = options.pendingProfile;
    Object.setPrototypeOf(this, PdiAuthAccessError.prototype);
  }
}

const LOCAL_IDENTITY_CACHE_KEYS = [
  "pdi_user_profile",
  "pdi.user.profile.v1",
  "pdi.userProfile.v1",
  "pdi.force.app.v1",
  "pdi.activation.pendingToken.v1",
  "pdi.auth.pendingUser.v1"
] as const;

const SESSION_IDENTITY_CACHE_KEYS = [
  "pdi.stage.v4",
  "pdi.drive.accessToken.v1"
] as const;

/**
 * AUTH-ADMIN-05-FIX-11-R2 : Purge atomique des caches locaux d'identité et d'autorisation workspace.
 */
export function purgeLocalAuthCaches(options?: { preservePendingState?: boolean }): void {
  const preservePending = Boolean(options?.preservePendingState);
  try {
    if (typeof localStorage !== "undefined") {
      if (!preservePending) {
        for (const key of LOCAL_IDENTITY_CACHE_KEYS) {
          localStorage.removeItem(key);
        }
        localStorage.setItem("pdi.auth.mode.v1", "guest");
      } else {
        localStorage.removeItem("pdi.force.app.v1");
        localStorage.setItem("pdi.auth.mode.v1", "pending_email");
      }
      localStorage.setItem("pdi.activeModule.v1", "home");
    }
  } catch {
    // Ignore storage access errors
  }

  try {
    if (typeof sessionStorage !== "undefined") {
      for (const key of SESSION_IDENTITY_CACHE_KEYS) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore sessionStorage access errors
  }
}

/**
 * AUTH-ADMIN-05-FIX-11-R2 (A3) : Classification stricte des erreurs Firestore lors de la lecture de profiles/{uid}.
 * Ne confond jamais une erreur technique (permission-denied, réseau/indisponibilité, inattendue) avec un profil absent.
 */
export function classifyFirestoreProfileReadError(err: unknown): {
  reason: "permission_denied" | "network_error" | "unexpected_error";
  code?: string;
  transient: boolean;
  message: string;
} {
  const rawCode =
    err && typeof err === "object" && "code" in err && typeof (err as any).code === "string"
      ? String((err as any).code).trim().toLowerCase()
      : undefined;
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : String(err ?? "");
  const lowerMsg = rawMessage.toLowerCase();

  if (
    rawCode === "permission-denied" ||
    rawCode === "firestore/permission-denied" ||
    rawCode === "unauthenticated" ||
    rawCode === "firestore/unauthenticated" ||
    lowerMsg.includes("permission-denied") ||
    lowerMsg.includes("permission denied") ||
    lowerMsg.includes("missing or insufficient permissions") ||
    lowerMsg.includes("insufficient permissions")
  ) {
    return {
      reason: "permission_denied",
      code: rawCode || "permission-denied",
      transient: false,
      message:
        "Connexion refusée : accès refusé par Firestore lors de la lecture du profil PD&I (permission-denied)."
    };
  }

  if (
    rawCode === "unavailable" ||
    rawCode === "firestore/unavailable" ||
    rawCode === "deadline-exceeded" ||
    rawCode === "firestore/deadline-exceeded" ||
    rawCode === "aborted" ||
    rawCode === "resource-exhausted" ||
    rawCode === "auth/network-request-failed" ||
    lowerMsg.includes("unavailable") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("connection lost") ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("deadline-exceeded")
  ) {
    return {
      reason: "network_error",
      code: rawCode || "unavailable",
      transient: true,
      message:
        "Impossible de vérifier le profil PD&I : erreur réseau ou service Firestore temporairement indisponible. Veuillez réessayer."
    };
  }

  return {
    reason: "unexpected_error",
    code: rawCode,
    transient: false,
    message:
      "Connexion refusée : une erreur technique inattendue est survenue lors de la lecture du profil PD&I dans Firestore."
  };
}

async function terminateAuthSessionOnDenial(
  denialMessage: string,
  reason: PdiAuthDenialReason,
  code?: string
): Promise<never> {
  purgeLocalAuthCaches({ preservePendingState: false });
  try {
    await fbSignOut(auth);
  } catch (signOutErr: unknown) {
    purgeLocalAuthCaches({ preservePendingState: false });
    const signOutDetail =
      signOutErr instanceof Error ? signOutErr.message : String(signOutErr ?? "erreur inconnue");
    throw new PdiAuthAccessError({
      message: `${denialMessage} (Échec critique de fermeture de la session Firebase : ${signOutDetail})`,
      reason,
      code: code || "auth/signout-failed",
      transient: false,
      sessionTerminated: false
    });
  }

  throw new PdiAuthAccessError({
    message: denialMessage,
    reason,
    code,
    transient: false,
    sessionTerminated: true
  });
}

function validateTokenAndClaimsOrThrow(
  tokenResult: { claims?: Record<string, unknown> } | null | undefined,
  fbUser: { uid: string; email?: string | null; emailVerified?: boolean }
): { isSuperAdmin: boolean; claims: Record<string, unknown> } {
  if (!tokenResult || !tokenResult.claims || typeof tokenResult.claims !== "object" || Array.isArray(tokenResult.claims)) {
    throw new PdiAuthAccessError({
      message: "Connexion refusée : les Custom Claims du jeton Firebase sont absents ou invalides.",
      reason: "invalid_claims",
      code: "auth/invalid-claims",
      transient: false,
      sessionTerminated: false
    });
  }

  const claims = tokenResult.claims;

  if (
    typeof claims.email === "string" &&
    claims.email.trim().length > 0 &&
    typeof fbUser.email === "string" &&
    fbUser.email.trim().length > 0 &&
    claims.email.trim().toLowerCase() !== fbUser.email.trim().toLowerCase()
  ) {
    throw new PdiAuthAccessError({
      message: "Connexion refusée : incohérence entre l'adresse email du compte et les claims du jeton Firebase.",
      reason: "invalid_claims",
      code: "auth/claims-email-mismatch",
      transient: false,
      sessionTerminated: false
    });
  }

  const isSuperAdmin = isSuperAdminClaimAuthorized(claims, fbUser.emailVerified);

  // Si le jeton contient un claim role explicite différent de 'client', il doit obligatoirement
  // satisfaire isSuperAdminClaimAuthorized (role === 'super_admin' && email_verified === true).
  if (claims.role !== undefined && claims.role !== "client" && !isSuperAdmin) {
    throw new PdiAuthAccessError({
      message:
        "Connexion refusée : les Custom Claims d'autorisation privilégiée sont invalides ou l'email n'est pas vérifié.",
      reason: "invalid_claims",
      code: "auth/invalid-privileged-claims",
      transient: false,
      sessionTerminated: false
    });
  }

  return { isSuperAdmin, claims };
}

async function verifyAuthenticatedUserProfileAndClaims(options: {
  fbUser: {
    uid: string;
    email?: string | null;
    emailVerified?: boolean;
    getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
  };
  providerType: "email" | "google";
  fallbackEmail: string;
  clientInfo?: { userAgent?: string; device?: string };
}): Promise<{ profile: PdiUserProfile; isSuperAdmin: boolean }> {
  const { fbUser, providerType, fallbackEmail, clientInfo } = options;
  const uid = fbUser?.uid;

  if (!uid || typeof uid !== "string" || uid.trim().length === 0) {
    await terminateAuthSessionOnDenial(
      "Connexion refusée : identifiant utilisateur Firebase (UID) absent ou invalide.",
      "token_error",
      "auth/invalid-uid"
    );
  }

  let tokenResult: { claims: Record<string, unknown> };
  try {
    tokenResult = await fbUser.getIdTokenResult(true);
  } catch (tokenErr: unknown) {
    const code =
      tokenErr && typeof tokenErr === "object" && "code" in tokenErr && typeof (tokenErr as any).code === "string"
        ? String((tokenErr as any).code)
        : "auth/token-retrieval-failed";
    await terminateAuthSessionOnDenial(
      "Connexion refusée : impossible de récupérer ou vérifier le jeton d'authentification Firebase.",
      "token_error",
      code
    );
  }

  let isSuperAdminUser = false;
  try {
    const validated = validateTokenAndClaimsOrThrow(tokenResult!, fbUser);
    isSuperAdminUser = validated.isSuperAdmin;
  } catch (claimErr: unknown) {
    if (claimErr instanceof PdiAuthAccessError) {
      await terminateAuthSessionOnDenial(claimErr.message, claimErr.reason, claimErr.code);
    }
    await terminateAuthSessionOnDenial(
      "Connexion refusée : les Custom Claims du jeton Firebase sont invalides.",
      "invalid_claims",
      "auth/invalid-claims"
    );
  }

  // SEC-01-FIX-04-R1 & FIX-11-R2 (A3) : Lecture directe et exclusive de profiles/{uid} dans Firestore,
  // avec distinction stricte entre absence de document et erreurs techniques Firestore.
  let userDoc: any;
  try {
    userDoc = await getDoc(doc(db, "profiles", uid));
  } catch (readErr: unknown) {
    const classified = classifyFirestoreProfileReadError(readErr);
    if (classified.transient) {
      // A3 : Une erreur réseau n'autorise jamais l'entrée dans le workspace, mais ne provoque pas
      // une déconnexion aveugle afin de permettre une nouvelle tentative explicite.
      purgeLocalAuthCaches({ preservePendingState: false });
      throw new PdiAuthAccessError({
        message: classified.message,
        reason: classified.reason,
        code: classified.code,
        transient: true,
        sessionTerminated: false
      });
    }
    await terminateAuthSessionOnDenial(classified.message, classified.reason, classified.code);
  }

  if (!userDoc || typeof userDoc.exists !== "function" || !userDoc.exists()) {
    const missingMsg =
      providerType === "google"
        ? `Connexion refusée : aucun profil PD&I autoritatif n'est enregistré dans Firestore pour ${fallbackEmail || "cet utilisateur"}.`
        : "Connexion refusée : le profil PD&I autoritatif est absent dans Firestore pour ce compte.";
    await terminateAuthSessionOnDenial(missingMsg, "profile_not_found", "profile/not-found");
  }

  const rawData = (userDoc.data() || {}) as Record<string, unknown>;

  if (typeof rawData.uid === "string" && rawData.uid.trim().length > 0 && rawData.uid !== uid) {
    await terminateAuthSessionOnDenial(
      "Connexion refusée : l'UID du profil Firestore ne correspond pas à l'UID Firebase Authentication.",
      "invalid_claims",
      "profile/uid-mismatch"
    );
  }

  // Section 7 (Tests Super Admin) : Un profil avec role: 'super_admin' (ou 'admin') mais sans claim Super Admin valide est refusé.
  const profileClaimsPrivilegedRole =
    rawData.role === "super_admin" ||
    rawData.role === "admin" ||
    rawData.isSuperAdmin === true ||
    rawData.isAdmin === true;

  if (profileClaimsPrivilegedRole && !isSuperAdminUser) {
    await terminateAuthSessionOnDenial(
      "Connexion refusée : le profil Firestore indique un rôle administratif mais aucun Custom Claim Super Admin valide n'est présent sur le jeton Firebase.",
      "invalid_claims",
      "auth/missing-super-admin-claim"
    );
  }

  const userProfile: PdiUserProfile = {
    ...(rawData as unknown as PdiUserProfile),
    uid,
    role: "client"
  };

  const rawStatus = String(rawData.status ?? "");

  if (rawStatus === "suspended") {
    if (providerType === "email") {
      await logConnectionToFirebase({
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userName: userProfile.name,
        userRole: userProfile.role,
        status: "failed",
        timestamp: new Date().toISOString(),
        userAgent: clientInfo?.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")
      });
    }
    const suspendedMsg =
      providerType === "google"
        ? "Ce compte a été suspendu par l'administrateur."
        : "Ce compte a été suspendu par le Super Administrateur. Contactez le support.";
    await terminateAuthSessionOnDenial(suspendedMsg, "suspended", "profile/suspended");
  }

  if (rawStatus === "revoked") {
    await terminateAuthSessionOnDenial(
      "Connexion refusée : ce compte a été révoqué par l'administrateur.",
      "revoked",
      "profile/revoked"
    );
  }

  if (rawStatus === "disabled" || rawStatus === "banned") {
    await terminateAuthSessionOnDenial(
      "Connexion refusée : ce compte a été désactivé.",
      "disabled",
      "profile/disabled"
    );
  }

  if (rawStatus === "pending_activation") {
    // BLOC B : Conserver la session Firebase pour le parcours d'activation uniquement,
    // sans jamais autoriser l'entrée dans le workspace normal ni accorder de rôle actif.
    saveProfileToLocalCache(userProfile);
    purgeLocalAuthCaches({ preservePendingState: true });
    const pendingMsg =
      providerType === "google"
        ? "Ce compte est en attente d'activation par clé de licence."
        : "Votre compte est en attente d'activation. Veuillez saisir votre clé d'activation PD&I.";
    throw new PdiAuthAccessError({
      message: pendingMsg,
      reason: "pending_activation",
      code: "profile/pending-activation",
      transient: false,
      sessionTerminated: false,
      pendingProfile: userProfile
    });
  }

  if (rawStatus !== "active") {
    await terminateAuthSessionOnDenial(
      "Connexion refusée : le statut du profil PD&I n'est pas actif.",
      "inactive_status",
      "profile/inactive-status"
    );
  }

  // SEC-01-FIX-04 : Ne jamais modifier lastLoginAt ni loginCount dans Firestore depuis le client.
  saveProfileToLocalCache(userProfile);

  await logConnectionToFirebase({
    userId: userProfile.uid,
    userEmail: userProfile.email,
    userName: userProfile.name,
    userRole: userProfile.role,
    accountType: userProfile.accountType,
    status: "success",
    timestamp: new Date().toISOString(),
    ...(providerType === "email"
      ? { userAgent: clientInfo?.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "") }
      : {})
  });

  return { profile: userProfile, isSuperAdmin: isSuperAdminUser };
}

export interface WorkspaceSessionResolution {
  status: "unauthenticated" | "active" | "pending_activation" | "denied" | "error";
  canAccessWorkspace: boolean;
  canAccessActivation: boolean;
  isSuperAdmin: boolean;
  authMode: "guest" | "pending_email" | "client" | "super_admin";
  profile: PdiUserProfile | null;
  reason?: PdiAuthDenialReason;
  transient?: boolean;
  errorMessage?: string;
}

/**
 * AUTH-ADMIN-05-FIX-11-R2 (BLOC B & BLOC C) :
 * Résout de manière autoritative l'état de session Firebase + Custom Claims + profil Firestore profiles/{uid}
 * pour le garde centralisé du workspace (PdiUnifiedApp).
 */
export async function resolveAuthoritativeWorkspaceSession(
  candidateUser?: {
    uid: string;
    email?: string | null;
    emailVerified?: boolean;
    getIdTokenResult?: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
  } | null,
  options?: { forceRefreshToken?: boolean }
): Promise<WorkspaceSessionResolution> {
  const activeUser = candidateUser !== undefined ? candidateUser : (auth.currentUser as any);

  if (!activeUser || typeof activeUser.uid !== "string" || activeUser.uid.trim().length === 0) {
    purgeLocalAuthCaches({ preservePendingState: false });
    return {
      status: "unauthenticated",
      canAccessWorkspace: false,
      canAccessActivation: false,
      isSuperAdmin: false,
      authMode: "guest",
      profile: null
    };
  }

  if (auth.currentUser && auth.currentUser.uid !== activeUser.uid) {
    purgeLocalAuthCaches({ preservePendingState: false });
    return {
      status: "denied",
      canAccessWorkspace: false,
      canAccessActivation: false,
      isSuperAdmin: false,
      authMode: "guest",
      profile: null,
      reason: "invalid_claims",
      errorMessage: "Incohérence d'UID entre la session active et l'utilisateur vérifié."
    };
  }

  if (typeof activeUser.getIdTokenResult !== "function") {
    try {
      await terminateAuthSessionOnDenial(
        "Connexion refusée : impossible de vérifier le jeton de la session Firebase.",
        "token_error",
        "auth/missing-token-method"
      );
    } catch (e: any) {
      return {
        status: "denied",
        canAccessWorkspace: false,
        canAccessActivation: false,
        isSuperAdmin: false,
        authMode: "guest",
        profile: null,
        reason: "token_error",
        errorMessage: e?.message
      };
    }
  }

  try {
    const tokenResult = await activeUser.getIdTokenResult!(options?.forceRefreshToken ?? false);
    const { isSuperAdmin } = validateTokenAndClaimsOrThrow(tokenResult, activeUser);

    let snap: any;
    try {
      snap = await getDoc(doc(db, "profiles", activeUser.uid));
    } catch (readErr: unknown) {
      const classified = classifyFirestoreProfileReadError(readErr);
      if (classified.transient) {
        purgeLocalAuthCaches({ preservePendingState: false });
        return {
          status: "error",
          canAccessWorkspace: false,
          canAccessActivation: false,
          isSuperAdmin: false,
          authMode: "guest",
          profile: null,
          reason: classified.reason,
          transient: true,
          errorMessage: classified.message
        };
      }
      try {
        await terminateAuthSessionOnDenial(classified.message, classified.reason, classified.code);
      } catch (denialErr: any) {
        return {
          status: "denied",
          canAccessWorkspace: false,
          canAccessActivation: false,
          isSuperAdmin: false,
          authMode: "guest",
          profile: null,
          reason: classified.reason,
          transient: false,
          errorMessage: denialErr?.message || classified.message
        };
      }
    }

    if (!snap || typeof snap.exists !== "function" || !snap.exists()) {
      try {
        await terminateAuthSessionOnDenial(
          "Connexion refusée : le profil PD&I autoritatif est absent dans Firestore pour ce compte.",
          "profile_not_found",
          "profile/not-found"
        );
      } catch (denialErr: any) {
        return {
          status: "denied",
          canAccessWorkspace: false,
          canAccessActivation: false,
          isSuperAdmin: false,
          authMode: "guest",
          profile: null,
          reason: "profile_not_found",
          errorMessage: denialErr?.message
        };
      }
    }

    const rawData = (snap.data() || {}) as Record<string, unknown>;

    if (typeof rawData.uid === "string" && rawData.uid.trim().length > 0 && rawData.uid !== activeUser.uid) {
      try {
        await terminateAuthSessionOnDenial(
          "Connexion refusée : incohérence d'UID sur le profil Firestore.",
          "invalid_claims",
          "profile/uid-mismatch"
        );
      } catch (denialErr: any) {
        return {
          status: "denied",
          canAccessWorkspace: false,
          canAccessActivation: false,
          isSuperAdmin: false,
          authMode: "guest",
          profile: null,
          reason: "invalid_claims",
          errorMessage: denialErr?.message
        };
      }
    }

    const profileClaimsPrivilegedRole =
      rawData.role === "super_admin" ||
      rawData.role === "admin" ||
      rawData.isSuperAdmin === true ||
      rawData.isAdmin === true;

    if (profileClaimsPrivilegedRole && !isSuperAdmin) {
      try {
        await terminateAuthSessionOnDenial(
          "Connexion refusée : le profil Firestore indique un rôle administratif sans Custom Claim Super Admin vérifié.",
          "invalid_claims",
          "auth/missing-super-admin-claim"
        );
      } catch (denialErr: any) {
        return {
          status: "denied",
          canAccessWorkspace: false,
          canAccessActivation: false,
          isSuperAdmin: false,
          authMode: "guest",
          profile: null,
          reason: "invalid_claims",
          errorMessage: denialErr?.message
        };
      }
    }

    const normalizedProfile: PdiUserProfile = {
      ...(rawData as unknown as PdiUserProfile),
      uid: activeUser.uid,
      role: "client"
    };

    const rawStatus = String(rawData.status ?? "");

    if (rawStatus === "pending_activation") {
      saveProfileToLocalCache(normalizedProfile);
      purgeLocalAuthCaches({ preservePendingState: true });
      return {
        status: "pending_activation",
        canAccessWorkspace: false,
        canAccessActivation: true,
        isSuperAdmin: false,
        authMode: "pending_email",
        profile: normalizedProfile,
        reason: "pending_activation"
      };
    }

    if (rawStatus === "suspended" || rawStatus === "revoked" || rawStatus === "disabled" || rawStatus === "banned" || rawStatus !== "active") {
      const reason: PdiAuthDenialReason =
        rawStatus === "suspended"
          ? "suspended"
          : rawStatus === "revoked"
          ? "revoked"
          : rawStatus === "disabled" || rawStatus === "banned"
          ? "disabled"
          : "inactive_status";
      try {
        await terminateAuthSessionOnDenial(
          `Connexion refusée : statut de profil non autorisé (${rawStatus || "inconnu"}).`,
          reason,
          `profile/${reason}`
        );
      } catch (denialErr: any) {
        return {
          status: "denied",
          canAccessWorkspace: false,
          canAccessActivation: false,
          isSuperAdmin: false,
          authMode: "guest",
          profile: null,
          reason,
          errorMessage: denialErr?.message
        };
      }
    }

    saveProfileToLocalCache(normalizedProfile);
    const resolvedMode = isSuperAdmin ? "super_admin" : "client";
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("pdi.auth.mode.v1", resolvedMode);
        localStorage.setItem("pdi.user.profile.v1", JSON.stringify({ ...normalizedProfile, role: resolvedMode }));
      }
    } catch {}

    return {
      status: "active",
      canAccessWorkspace: true,
      canAccessActivation: false,
      isSuperAdmin,
      authMode: resolvedMode,
      profile: normalizedProfile
    };
  } catch (err: any) {
    const reason: PdiAuthDenialReason =
      err instanceof PdiAuthAccessError ? err.reason : "token_error";
    try {
      await terminateAuthSessionOnDenial(
        err?.message || "Connexion refusée : échec de vérification du jeton ou des claims.",
        reason
      );
    } catch (denialErr: any) {
      return {
        status: "denied",
        canAccessWorkspace: false,
        canAccessActivation: false,
        isSuperAdmin: false,
        authMode: "guest",
        profile: null,
        reason,
        errorMessage: denialErr?.message || err?.message
      };
    }
  }
}

export async function loginWithEmailAndPasswordSecure(
  emailInput: string,
  passwordInput: string,
  clientInfo?: { userAgent?: string; device?: string }
): Promise<{ profile: PdiUserProfile; isSuperAdmin: boolean }> {
  const email = emailInput.trim().toLowerCase();

  if (!email || !passwordInput) {
    throw new Error("Veuillez saisir votre adresse email et votre mot de passe.");
  }

  let userCredential: any;
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, passwordInput);
  } catch (err: any) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      throw new Error("Identifiants incorrects ou compte inexistant dans Firebase Authentication.");
    }
    if (err.code === "auth/invalid-email") {
      throw new Error("Adresse email invalide.");
    }
    if (err.code === "auth/too-many-requests") {
      throw new Error("Trop de tentatives de connexion échouées. Veuillez réessayer dans quelques instants ou réinitialiser votre mot de passe.");
    }
    throw err;
  }

  return verifyAuthenticatedUserProfileAndClaims({
    fbUser: userCredential?.user,
    providerType: "email",
    fallbackEmail: email,
    clientInfo
  });
}

export async function registerWithEmailAndPasswordSecure(data: {
  email: string;
  password: string;
  name: string;
  company?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  requestedPlan?: string;
  activationKey?: string;
}): Promise<PdiUserProfile> {
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";

  if (!email || !data.password || typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Veuillez renseigner votre nom, email et mot de passe (au moins 6 caractères).");
  }

  if (data.password.length < 6) {
    throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
  }

  const countryCode = (data.countryCode || "DZ").toUpperCase();
  validateProfilePresentationFields(
    {
      name: data.name,
      company: data.company,
      country: data.country,
      countryCode,
      city: data.city
    },
    true
  );

  // SEC-01-FIX-04-R1 (Correction A) :
  // Si une clé d'activation est fournie à l'inscription, refuser explicitement avant toute création
  // car l'activation autoritative (status: "active", accountType) requiert un traitement serveur.
  if (typeof data.activationKey === "string" && data.activationKey.trim().length > 0) {
    throw new Error(
      "Activation de licence impossible côté client lors de l'inscription : l'attribution du statut 'active' et du plan de licence est réservée au serveur."
    );
  }

  // Check if country is allowed
  const countries = await getCountryRestrictionsFromFirebase();
  const matchedCountry = countries.find(c => c.code.toUpperCase() === countryCode);
  if (matchedCountry && !matchedCountry.allowed) {
    throw new Error(`L'accès depuis ce pays (${matchedCountry.name}) est temporairement restreint par l'administrateur.`);
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, data.password);
    const fbUser = userCredential.user;
    const uid = fbUser.uid;

    const isAlgeria = countryCode === "DZ" || (data.country && data.country.toLowerCase().includes("algér"));
    const paymentGateway = isAlgeria ? "slickpay_baridimob" : "paddle";
    const currency = isAlgeria ? "DZD" : "EUR";

    const canonicalEmail = fbUser.email || email;

    // SEC-01-FIX-04-R1 (Correction A) & FIX-11-R2 (BLOC B) :
    // Cohérence stricte entre le profil retourné, le cache local et le document Firestore :
    // accountType est toujours "basic", subscriptionPlan est "monthly" et status est "pending_activation".
    // La session Firebase est conservée uniquement pour l'écran d'activation, avec isolation stricte hors du workspace.
    const profile: PdiUserProfile = {
      uid,
      email: canonicalEmail,
      name: data.name,
      company: data.company || "",
      country: data.country || (isAlgeria ? "Algérie" : "International"),
      countryCode,
      city: data.city || "",
      paymentGateway,
      currency,
      role: "client",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: new Date().toISOString()
    };

    await saveFirebaseProfile(profile);
    purgeLocalAuthCaches({ preservePendingState: true });

    return profile;
  } catch (err: any) {
    if (err.code === "auth/email-already-in-use") {
      throw new Error("Un compte existe déjà avec cette adresse email dans Firebase Authentication. Veuillez vous connecter.");
    }
    if (err.code === "auth/weak-password") {
      throw new Error("Le mot de passe choisi est trop faible. Veuillez choisir un mot de passe plus robuste.");
    }
    throw err;
  }
}

export async function saveAuthCredentialsSecure(emailInput: string, passwordInput: string, role: PdiUserRole = "client"): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !passwordInput) return;
  const salt = generateCryptoSalt();
  const passwordHash = await hashPassword(passwordInput, salt);
  const credDocId = `cred_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const cred: PdiAuthCredential = {
    email,
    passwordHash,
    salt,
    role,
    isSuperAdmin: false,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, "auth_credentials", credDocId), cred);
}

export async function loginWithGoogleSecure(): Promise<{ profile: PdiUserProfile; isSuperAdmin: boolean }> {
  let result: any;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    result = await signInWithPopup(auth, provider);
  } catch (err: any) {
    if (err.code === "auth/popup-closed-by-user") {
      throw new Error("La fenêtre de connexion Google a été fermée.");
    }
    throw err;
  }

  const gUser = result?.user;
  const gEmail = gUser?.email?.toLowerCase() || "";

  return verifyAuthenticatedUserProfileAndClaims({
    fbUser: gUser,
    providerType: "google",
    fallbackEmail: gEmail
  });
}

/**
 * AUTH-ADMIN-05-FIX-11-R2 (A4) : Déconnexion stricte Firebase Authentication.
 * - Purge immédiatement les caches locaux d'identité et d'autorisation pour maintenir le workspace bloqué.
 * - Attend la fin réelle de fbSignOut(auth).
 * - N'avale jamais silencieusement une erreur de fbSignOut(auth).
 * - Refuse de confirmer la déconnexion si Firebase conserve une session active (auth.currentUser !== null).
 */
export async function logoutFirebase(): Promise<void> {
  purgeLocalAuthCaches({ preservePendingState: false });
  try {
    await fbSignOut(auth);
  } catch (err: unknown) {
    purgeLocalAuthCaches({ preservePendingState: false });
    const detail = err instanceof Error ? err.message : String(err ?? "erreur inconnue");
    throw new PdiAuthAccessError({
      message: `Échec de la déconnexion Firebase Authentication : ${detail}`,
      reason: "signout_failed",
      code: "auth/signout-failed",
      transient: false,
      sessionTerminated: false
    });
  }

  if (auth.currentUser !== null) {
    purgeLocalAuthCaches({ preservePendingState: false });
    throw new PdiAuthAccessError({
      message: "Échec de la déconnexion Firebase Authentication : une session active persiste après signOut.",
      reason: "signout_failed",
      code: "auth/session-still-active",
      transient: false,
      sessionTerminated: false
    });
  }
}

export async function activateAccountWithLicenseKey(email: string, licenseCode: string): Promise<PdiUserProfile> {
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const cleanCode = typeof licenseCode === "string" ? licenseCode.trim() : "";

  if (!cleanEmail || !cleanCode) {
    throw new Error("Veuillez fournir une adresse email et une clé de licence valides.");
  }

  // SEC-01-FIX-04-R1 (Correction B) :
  // Aucun updateDoc() client ne peut modifier status, accountType ou subscriptionPlan dans Firestore.
  // En l'absence d'un traitement serveur autoritatif d'activation, cette opération doit échouer
  // explicitement sans modifier le statut local ni prétendre que l'activation a été persistée.
  throw new Error(
    "Activation refusée : la modification des champs 'status', 'accountType' et 'subscriptionPlan' est réservée au serveur. Aucune activation autoritative n'a été persistée dans Firestore."
  );
}

export async function recordSubscriberUsage(usage: Omit<PdiSubscriberUsage, "id" | "timestamp"> & { timestamp?: string }): Promise<void> {
  try {
    await addDoc(collection(db, "subscriber_usage"), {
      ...usage,
      timestamp: usage.timestamp || new Date().toISOString()
    });
  } catch (err) {
    console.warn("Subscriber usage logging failed:", err);
  }
}

export async function getSubscriberUsageFromFirebase(limitCount = 60): Promise<PdiSubscriberUsage[]> {
  try {
    const q = query(collection(db, "subscriber_usage"), orderBy("timestamp", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const list: PdiSubscriberUsage[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PdiSubscriberUsage));
    return list;
  } catch (err) {
    console.warn("Could not get subscriber usage from Firestore:", err);
    return [];
  }
}

function docRefPlaceholder() {
  return "doc-" + Math.random().toString(36).slice(2, 9);
}

// ------------------------------------------
// LEGACY COMPATIBILITY EXPORTS
// ------------------------------------------
export interface EngineeringPlan {
  id: string;
  title: string;
  fascicule: string;
  page: number;
  category: string;
  src: string;
  caption: string;
  tags: string[];
}

const PLANS_COLLECTION = "plans";

export async function fetchPlans(): Promise<EngineeringPlan[]> {
  try {
    const querySnapshot = await getDocs(collection(db, PLANS_COLLECTION));
    const plans: EngineeringPlan[] = [];
    querySnapshot.forEach((d) => {
      plans.push({ id: d.id, ...d.data() } as EngineeringPlan);
    });
    return plans;
  } catch (error) {
    console.error("Error fetching plans from Firestore: ", error);
    throw error;
  }
}

export async function savePlan(plan: Omit<EngineeringPlan, "id"> & { id?: string }): Promise<string> {
  try {
    if (plan.id) {
      await setDoc(doc(db, PLANS_COLLECTION, plan.id), plan);
      return plan.id;
    } else {
      const docRef = await addDoc(collection(db, PLANS_COLLECTION), plan);
      return docRef.id;
    }
  } catch (error) {
    console.error("Error saving plan to Firestore: ", error);
    throw error;
  }
}

export async function deletePlanFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PLANS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting plan from Firestore: ", error);
    throw error;
  }
}

export async function seedPlansIfEmpty(defaultPlans: EngineeringPlan[]): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, PLANS_COLLECTION));
    if (querySnapshot.empty) {
      for (const plan of defaultPlans) {
        await setDoc(doc(db, PLANS_COLLECTION, plan.id), plan);
      }
    }
  } catch (error) {
    console.error("Error seeding plans: ", error);
  }
}

export interface ProjectNotification {
  id?: string;
  projectId: string;
  projectName: string;
  message: string;
  category: "creation" | "update" | "assignment" | "status_change";
  authorName: string;
  authorEmail: string;
  authorRole?: string;
  timestamp: string;
  pole?: string;
  region?: string;
  readBy?: string[];
}

export async function createNotification(notif: Omit<ProjectNotification, "timestamp">): Promise<string> {
  try {
    const newNotif = {
      ...notif,
      timestamp: new Date().toISOString(),
      readBy: notif.readBy || []
    };
    const docRef = await addDoc(collection(db, "notifications"), newNotif);
    return docRef.id;
  } catch (error) {
    console.error("Error creating notification in Firestore:", error);
    throw error;
  }
}

// ------------------------------------------
// COUNTRY RESTRICTIONS & GEO CONFIGURATION API
// ------------------------------------------
import { PdiCountryConfig, PDI_DEFAULT_COUNTRIES } from "../pdi/data/pdiGeoData";
import { PdiPaymentTransaction } from "../pdi/payment/pdiPaymentGateway";

const COUNTRY_CONFIG_DOC_ID = "country_restrictions_v1";

export async function getCountryRestrictionsFromFirebase(): Promise<PdiCountryConfig[]> {
  try {
    const docSnap = await getDoc(doc(db, "system_config", COUNTRY_CONFIG_DOC_ID));
    if (docSnap.exists() && docSnap.data()?.countries && Array.isArray(docSnap.data().countries)) {
      return docSnap.data().countries as PdiCountryConfig[];
    }
  } catch (err) {
    console.warn("Could not read country restrictions from Firestore, using defaults:", err);
  }
  return PDI_DEFAULT_COUNTRIES;
}

export async function saveCountryRestrictionsToFirebase(countries: PdiCountryConfig[]): Promise<void> {
  try {
    await setDoc(doc(db, "system_config", COUNTRY_CONFIG_DOC_ID), {
      countries,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Error saving country restrictions to Firestore:", err);
    throw err;
  }
}

export async function toggleCountryAllowedStatus(countryCode: string, allowed: boolean): Promise<PdiCountryConfig[]> {
  const current = await getCountryRestrictionsFromFirebase();
  const updated = current.map((c) => {
    if (c.code.toUpperCase() === countryCode.toUpperCase()) {
      return { ...c, allowed };
    }
    return c;
  });
  await saveCountryRestrictionsToFirebase(updated);
  return updated;
}

// ------------------------------------------
// PAYMENT TRANSACTIONS & CHECKOUT ROUTER API
// ------------------------------------------
export async function savePaymentTransactionToFirebase(_transaction: PdiPaymentTransaction): Promise<void> {
  throw new Error(
    "Client-side creation or mutation in payment_transactions is forbidden (FR-15 Zero-Trust). " +
      "Create pending orders exclusively via the authenticated server endpoint POST /api/payments/orders."
  );
}

export async function getPaymentTransactionsFromFirebase(limitCount = 100): Promise<PdiPaymentTransaction[]> {
  try {
    const q = query(collection(db, "payment_transactions"), orderBy("createdAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const list: PdiPaymentTransaction[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PdiPaymentTransaction));
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Could not read payment transactions from Firestore (trying local fallback):", err);
  }

  try {
    const raw = localStorage.getItem("pdi_payment_transactions");
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return [];
}

export async function updatePaymentTransactionStatus(
  txId: string,
  status: PdiPaymentTransaction["status"],
  details?: Partial<PdiPaymentTransaction>
): Promise<void> {
  try {
    await updateDoc(doc(db, "payment_transactions", txId), {
      status,
      updatedAt: new Date().toISOString(),
      ...(details || {})
    });
  } catch (err) {
    console.error("Error updating transaction status:", err);
    throw err;
  }
}

/**
 * Super Admin manually approves / activates a pending transaction
 * Automatically activates user profile and updates subscription plan
 */
export async function approveAndActivateTransaction(txId: string): Promise<PdiUserProfile | null> {
  const snap = await getDoc(doc(db, "payment_transactions", txId));
  if (!snap.exists()) {
    throw new Error("Transaction introuvable.");
  }
  const tx = snap.data() as PdiPaymentTransaction;

  // Mark transaction completed
  await updatePaymentTransactionStatus(txId, "completed", {
    slickPayDetails: {
      ...(tx.slickPayDetails || { invoiceId: txId, baridiMobRip: "", slickPayUrl: "" }),
      verifiedByAdmin: true
    }
  });

  // Find user profile and activate
  const profiles = await getFirebaseProfiles();
  const user = profiles.find((p) => p.email.toLowerCase() === tx.userEmail.toLowerCase());
  if (user) {
    const updatedUser: PdiUserProfile = {
      ...user,
      status: "active",
      accountType: tx.plan,
      subscriptionPlan: tx.billingCycle || "monthly",
      lastLoginAt: new Date().toISOString()
    };
    await saveFirebaseProfile(updatedUser);
    return updatedUser;
  }
  return null;
}

// ------------------------------------------
// PAYMENT GATEWAYS SYSTEM CONFIGURATION
// ------------------------------------------
export interface PdiPaymentGatewayConfig {
  slickPayPublicKey: string;
  slickPayAccountId: string;
  slickPayApiUrl: string;
  slickPayWebhookSecret: string;
  slickPayEnabled: boolean;
  paddleVendorId: string;
  paddleApiKey: string;
  paddleClientToken: string;
  paddleSandbox: boolean;
  paddleEnabled: boolean;
}

const DEFAULT_GATEWAY_CONFIG: PdiPaymentGatewayConfig = {
  slickPayPublicKey: "pub_test_slickpay_pdi_2026_algeria",
  slickPayAccountId: "00799999000123456789", // BaridiMob CCP account number
  slickPayApiUrl: "https://api.slick-pay.com/v1",
  slickPayWebhookSecret: "", // Server secret, never stored in client bundle
  slickPayEnabled: true,
  paddleVendorId: "pdl_vnd_987654",
  paddleApiKey: "", // Server secret, never stored in client bundle
  paddleClientToken: "test_token_paddle_pdi_vision",
  paddleSandbox: true,
  paddleEnabled: true
};

export async function getPaymentGatewayConfigFromFirebase(): Promise<PdiPaymentGatewayConfig> {
  try {
    const docSnap = await getDoc(doc(db, "system_config", "payment_gateways_v1"));
    if (docSnap.exists()) {
      return { ...DEFAULT_GATEWAY_CONFIG, ...docSnap.data() } as PdiPaymentGatewayConfig;
    }
  } catch (err) {
    console.warn("Could not read gateway config, using defaults:", err);
  }
  return DEFAULT_GATEWAY_CONFIG;
}

export async function savePaymentGatewayConfigToFirebase(config: Partial<PdiPaymentGatewayConfig>): Promise<void> {
  try {
    await setDoc(doc(db, "system_config", "payment_gateways_v1"), {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Error saving payment gateway config:", err);
    throw err;
  }
}

// ------------------------------------------
// SAAS PROJECTS & ISOMETRICS FIRESTORE API
// ------------------------------------------
export interface PdiSaasProject {
  id: string;
  name: string;
  code: string;
  tenantId: string;
  ownerId: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PdiSaasIsometric {
  id: string;
  title: string;
  projectId: string;
  tenantId: string;
  ownerId: string;
  drawingNumber?: string;
  linePid?: string;
  fluidCode?: string;
  status?: "draft" | "approved" | "as_built";
  dataJson?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function saveSaasProjectToFirestore(project: PdiSaasProject): Promise<void> {
  const path = `projects/${project.id}`;
  try {
    await setDoc(doc(db, "projects", project.id), {
      ...project,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getSaasProjectsFromFirestore(tenantId: string): Promise<PdiSaasProject[]> {
  const path = "projects";
  try {
    const q = query(collection(db, "projects"), where("tenantId", "==", tenantId));
    const snap = await getDocs(q);
    const list: PdiSaasProject[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PdiSaasProject));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveSaasIsometricToFirestore(iso: PdiSaasIsometric): Promise<void> {
  const path = `projects/${iso.projectId}/isometrics/${iso.id}`;
  try {
    await setDoc(doc(db, "projects", iso.projectId, "isometrics", iso.id), {
      ...iso,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getSaasIsometricsFromFirestore(projectId: string): Promise<PdiSaasIsometric[]> {
  const path = `projects/${projectId}/isometrics`;
  try {
    const snap = await getDocs(collection(db, "projects", projectId, "isometrics"));
    const list: PdiSaasIsometric[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PdiSaasIsometric));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteSaasIsometricFromFirestore(projectId: string, isoId: string): Promise<void> {
  const path = `projects/${projectId}/isometrics/${isoId}`;
  try {
    await deleteDoc(doc(db, "projects", projectId, "isometrics", isoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getPaginatedProjectsFromFirestore(
  pageSize = 50,
  lastDoc: any = null,
  tenantId?: string
): Promise<{ items: PdiSaasProject[]; lastDoc: any }> {
  const path = "projects";
  try {
    let constraints: any[] = [orderBy("updatedAt", "desc"), limit(pageSize)];
    if (tenantId) {
      constraints.unshift(where("tenantId", "==", tenantId));
    }
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(collection(db, "projects"), ...constraints);
    const snap = await getDocs(q);
    const items: PdiSaasProject[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as PdiSaasProject));
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { items, lastDoc: newLastDoc };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return { items: [], lastDoc: null };
  }
}

export async function getPaginatedProfilesFromFirebase(
  pageSize = 50,
  lastDoc: any = null
): Promise<{ items: PdiUserProfile[]; lastDoc: any }> {
  const path = "profiles";
  try {
    let constraints: any[] = [orderBy("lastLoginAt", "desc"), limit(pageSize)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(collection(db, "profiles"), ...constraints);
    const snap = await getDocs(q);
    const items: PdiUserProfile[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as unknown as PdiUserProfile));
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { items, lastDoc: newLastDoc };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return { items: [], lastDoc: null };
  }
}



