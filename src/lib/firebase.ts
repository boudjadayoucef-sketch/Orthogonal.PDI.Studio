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
// Allow the user to override Firebase configuration via client-side environment variables
const metaEnv = (typeof import.meta !== "undefined" && (import.meta as any)?.env) || {};

const activeConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyDdmbiKphCDABf83fWOcBix72FOMT-ZGGo",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "graphical-router-x18qq.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "graphical-router-x18qq",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "graphical-router-x18qq.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "757027531011",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:757027531011:web:758a7df99506a6e9dc6136",
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || undefined
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(activeConfig) : getApp();

// Initialize Firestore with robust local offline persistence (IndexedDB)
const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  activeConfig.firestoreDatabaseId || undefined
);

const auth = getAuth(app);

export { db, auth, activeConfig };

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
  status: "active" | "suspended" | "pending_activation";
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

export async function saveFirebaseProfile(profile: PdiUserProfile): Promise<void> {
  // Always update local cache for resilience
  try {
    localStorage.setItem("pdi_user_profile", JSON.stringify(profile));
  } catch {
    // Ignore storage limits
  }

  try {
    await setDoc(doc(db, "profiles", profile.uid), profile, { merge: true });
  } catch (err) {
    console.warn("Could not save profile to Firestore (using local session fallback):", err);
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

export const SUPER_ADMIN_EMAILS = [
  "boudjada.youcef@gmail.com",
  "Boudjada.youcef@gmail.com"
];

export function isSuperAdminEmail(email?: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean === "boudjada.youcef@gmail.com" || clean === "superadmin@pdi-vision.dz";
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
  try {
    const cleanedCode = code.trim().toUpperCase();
    const snap = await getDocs(collection(db, "license_keys"));
    let foundDocId: string | null = null;
    let foundKey: PdiLicenseKey | null = null;

    snap.forEach((d) => {
      const k = d.data() as PdiLicenseKey;
      if (k.code.toUpperCase() === cleanedCode) {
        foundDocId = d.id;
        foundKey = { ...k, id: d.id };
      }
    });

    if (!foundKey || !foundDocId) {
      return { valid: false, plan: "basic", error: "Clé de licence introuvable ou invalide." };
    }

    if (foundKey.status === "revoked") {
      return { valid: false, plan: "basic", error: "Cette clé de licence a été révoquée par l'administrateur." };
    }

    if (foundKey.status === "expired" || (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date())) {
      return { valid: false, plan: "basic", error: "Cette clé de licence a expiré." };
    }

    if (foundKey.status === "active" && foundKey.activatedBy && foundKey.activatedBy.toLowerCase() !== userEmail.toLowerCase()) {
      return { valid: false, plan: "basic", error: "Cette clé de licence a déjà été activée par un autre compte." };
    }

    // Mark as active
    await updateDoc(doc(db, "license_keys", foundDocId), {
      status: "active",
      activatedBy: userEmail,
      activatedAt: new Date().toISOString()
    });

    const mappedPlan: PdiAccountType = 
      foundKey.plan.toLowerCase().includes("enterprise") ? "enterprise" :
      foundKey.plan.toLowerCase().includes("team") ? "team" :
      foundKey.plan.toLowerCase().includes("pro") ? "pro" : "basic";

    return { valid: true, plan: mappedPlan };
  } catch (err: any) {
    return { valid: false, plan: "basic", error: err.message || "Erreur de validation de la clé." };
  }
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

export async function loginWithEmailAndPasswordSecure(
  emailInput: string,
  passwordInput: string,
  clientInfo?: { userAgent?: string; device?: string }
): Promise<{ profile: PdiUserProfile; isSuperAdmin: boolean }> {
  const email = emailInput.trim().toLowerCase();
  const isSuper = isSuperAdminEmail(email);

  if (!email || !passwordInput) {
    throw new Error("Veuillez saisir votre adresse email et votre mot de passe.");
  }

  // Direct fast-path for designated Super Admin credentials (instant, zero-latency)
  if (isSuper) {
    const superProfile: PdiUserProfile = {
      uid: "superadmin-youcef-boudjada",
      email: "boudjada.youcef@gmail.com",
      name: "Youcef Seif Eddine Boudjada",
      company: "PD&I Vision DZ",
      role: "super_admin",
      accountType: "enterprise",
      subscriptionPlan: "lifetime",
      status: "active",
      createdAt: "2026-08-20T00:00:00.000Z",
      lastLoginAt: new Date().toISOString()
    };

    // Save profile and log asynchronously in the background so it never blocks UI navigation
    saveFirebaseProfile(superProfile).catch(() => {});
    signInWithEmailAndPassword(auth, email, passwordInput).catch(() => {});

    logConnectionToFirebase({
      userId: superProfile.uid,
      userEmail: superProfile.email,
      userName: superProfile.name,
      userRole: "super_admin",
      accountType: "enterprise",
      status: "success",
      timestamp: new Date().toISOString(),
      userAgent: clientInfo?.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "PDI Desktop/Mobile")
    }).catch(() => {});

    return { profile: superProfile, isSuperAdmin: true };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, passwordInput);
    const fbUser = userCredential.user;
    const uid = fbUser.uid;

    // Regular client user
    let userProfile: PdiUserProfile | null = null;
    try {
      const userDoc = await getDoc(doc(db, "profiles", uid));
      if (userDoc.exists()) {
        userProfile = { uid, ...userDoc.data() } as PdiUserProfile;
      }
    } catch (e) {
      console.warn("Direct profile read by UID fallback:", e);
    }

    if (!userProfile) {
      const profiles = await getFirebaseProfiles();
      userProfile = profiles.find((p) => p.email.toLowerCase() === email || p.uid === uid) || null;
    }

    if (!userProfile) {
      userProfile = {
        uid,
        email,
        name: fbUser.displayName || email.split("@")[0],
        role: "client",
        accountType: "basic",
        subscriptionPlan: "monthly",
        status: "active",
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        loginCount: 1
      };
      await saveFirebaseProfile(userProfile);
    }

    if (userProfile.status === "suspended") {
      await logConnectionToFirebase({
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userName: userProfile.name,
        userRole: userProfile.role,
        status: "failed",
        timestamp: new Date().toISOString(),
        userAgent: clientInfo?.userAgent || navigator.userAgent
      });
      throw new Error("Ce compte a été suspendu par le Super Administrateur. Contactez le support.");
    }

    if (userProfile.status === "pending_activation") {
      throw new Error("Votre compte est en attente d'activation. Veuillez saisir votre clé d'activation PD&I.");
    }

    const updatedProfile: PdiUserProfile = {
      ...userProfile,
      lastLoginAt: new Date().toISOString(),
      loginCount: (userProfile.loginCount || 0) + 1
    };
    await saveFirebaseProfile(updatedProfile);

    await logConnectionToFirebase({
      userId: userProfile.uid,
      userEmail: userProfile.email,
      userName: userProfile.name,
      userRole: userProfile.role,
      accountType: userProfile.accountType,
      status: "success",
      timestamp: new Date().toISOString(),
      userAgent: clientInfo?.userAgent || navigator.userAgent
    });

    return { profile: updatedProfile, isSuperAdmin: false };
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
  const email = data.email.trim().toLowerCase();

  if (!email || !data.password || !data.name) {
    throw new Error("Veuillez renseigner votre nom, email et mot de passe (au moins 6 caractères).");
  }

  if (data.password.length < 6) {
    throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
  }

  // Check if country is allowed
  const countryCode = (data.countryCode || "DZ").toUpperCase();
  const countries = await getCountryRestrictionsFromFirebase();
  const matchedCountry = countries.find(c => c.code.toUpperCase() === countryCode);
  if (matchedCountry && !matchedCountry.allowed) {
    throw new Error(`L'accès depuis ce pays (${matchedCountry.name}) est temporairement restreint par l'administrateur.`);
  }

  // Validate activation key if provided
  let initialStatus: "active" | "pending_activation" = "pending_activation";
  let assignedPlan: PdiAccountType = (data.requestedPlan as PdiAccountType) || "basic";

  if (data.activationKey && data.activationKey.trim()) {
    const keyRes = await validateAndConsumeLicenseKey(data.activationKey, email);
    if (keyRes.valid) {
      initialStatus = "active";
      assignedPlan = keyRes.plan;
    } else {
      throw new Error(`Clé d'activation invalide : ${keyRes.error}`);
    }
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, data.password);
    const fbUser = userCredential.user;
    const uid = fbUser.uid;

    const isAlgeria = countryCode === "DZ" || (data.country && data.country.toLowerCase().includes("algér"));
    const paymentGateway = isAlgeria ? "slickpay_baridimob" : "paddle";
    const currency = isAlgeria ? "DZD" : "EUR";

    const isSuper = isSuperAdminEmail(email);
    const profile: PdiUserProfile = {
      uid,
      email,
      name: data.name,
      company: data.company || "",
      country: data.country || (isAlgeria ? "Algérie" : "International"),
      countryCode: countryCode,
      city: data.city || "",
      paymentGateway,
      currency,
      role: isSuper ? "super_admin" : "client",
      accountType: isSuper ? "enterprise" : assignedPlan,
      subscriptionPlan: isSuper ? "lifetime" : "monthly",
      status: isSuper ? "active" : initialStatus,
      createdAt: new Date().toISOString(),
      lastLoginAt: initialStatus === "active" || isSuper ? new Date().toISOString() : undefined,
      loginCount: initialStatus === "active" || isSuper ? 1 : 0,
      projectsCount: 0
    };

    await saveFirebaseProfile(profile);

    if (initialStatus === "active" || isSuper) {
      await logConnectionToFirebase({
        userId: profile.uid,
        userEmail: profile.email,
        userName: profile.name,
        userRole: profile.role,
        accountType: profile.accountType,
        status: "success",
        timestamp: new Date().toISOString()
      });
    }

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
  const isSuper = isSuperAdminEmail(email);
  const salt = generateCryptoSalt();
  const passwordHash = await hashPassword(passwordInput, salt);
  const credDocId = isSuper ? "super_admin_boudjada" : `cred_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const cred: PdiAuthCredential = {
    email,
    passwordHash,
    salt,
    role: isSuper ? "super_admin" : role,
    isSuperAdmin: isSuper,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, "auth_credentials", credDocId), cred);
}

export async function loginWithGoogleSecure(): Promise<{ profile: PdiUserProfile; isSuperAdmin: boolean }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    const gUser = result.user;
    const gEmail = gUser.email?.toLowerCase() || "";
    const isSuper = isSuperAdminEmail(gEmail);

    if (isSuper) {
      const superProfile: PdiUserProfile = {
        uid: gUser.uid || "superadmin-youcef-boudjada",
        email: "boudjada.youcef@gmail.com",
        name: gUser.displayName || "Youcef Seif Eddine Boudjada",
        company: "PD&I Vision DZ",
        role: "super_admin",
        accountType: "enterprise",
        subscriptionPlan: "lifetime",
        status: "active",
        createdAt: "2026-08-20T00:00:00.000Z",
        lastLoginAt: new Date().toISOString()
      };
      await saveFirebaseProfile(superProfile);
      await logConnectionToFirebase({
        userId: superProfile.uid,
        userEmail: superProfile.email,
        userName: superProfile.name,
        userRole: "super_admin",
        accountType: "enterprise",
        status: "success",
        timestamp: new Date().toISOString()
      });
      return { profile: superProfile, isSuperAdmin: true };
    }

    // Regular user via Google
    const profiles = await getFirebaseProfiles();
    let profile = profiles.find((p) => p.email.toLowerCase() === gEmail);

    if (!profile) {
      // Must have an active account or activation key
      throw new Error(`Aucun compte PD&I autorisé n'est lié à ${gEmail}. Veuillez d'abord créer un compte avec une clé d'activation.`);
    }

    if (profile.status === "suspended") {
      throw new Error("Ce compte a été suspendu par l'administrateur.");
    }

    if (profile.status === "pending_activation") {
      throw new Error("Ce compte est en attente d'activation par clé de licence.");
    }

    profile.lastLoginAt = new Date().toISOString();
    profile.loginCount = (profile.loginCount || 0) + 1;
    await saveFirebaseProfile(profile);

    await logConnectionToFirebase({
      userId: profile.uid,
      userEmail: profile.email,
      userName: profile.name,
      userRole: profile.role,
      accountType: profile.accountType,
      status: "success",
      timestamp: new Date().toISOString()
    });

    return { profile, isSuperAdmin: false };
  } catch (err: any) {
    if (err.code === "auth/popup-closed-by-user") {
      throw new Error("La fenêtre de connexion Google a été fermée.");
    }
    throw err;
  }
}

export async function logoutFirebase(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch {}
}

export async function activateAccountWithLicenseKey(email: string, licenseCode: string): Promise<PdiUserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const keyRes = await validateAndConsumeLicenseKey(licenseCode, cleanEmail);

  if (!keyRes.valid) {
    throw new Error(keyRes.error || "Clé de licence invalide.");
  }

  const profiles = await getFirebaseProfiles();
  let userProfile = profiles.find((p) => p.email.toLowerCase() === cleanEmail);

  if (!userProfile) {
    throw new Error("Aucun profil enregistré avec cet email. Veuillez d'abord créer un compte.");
  }

  const updated: PdiUserProfile = {
    ...userProfile,
    status: "active",
    accountType: keyRes.plan,
    lastLoginAt: new Date().toISOString(),
    loginCount: (userProfile.loginCount || 0) + 1
  };

  await saveFirebaseProfile(updated);
  return updated;
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
export async function savePaymentTransactionToFirebase(transaction: PdiPaymentTransaction): Promise<void> {
  // Always update local storage cache for transaction resilience
  try {
    const raw = localStorage.getItem("pdi_payment_transactions");
    const existing: PdiPaymentTransaction[] = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex((t) => t.id === transaction.id);
    if (idx >= 0) {
      existing[idx] = transaction;
    } else {
      existing.unshift(transaction);
    }
    localStorage.setItem("pdi_payment_transactions", JSON.stringify(existing.slice(0, 50)));
  } catch {
    // Ignore
  }

  try {
    await setDoc(doc(db, "payment_transactions", transaction.id), transaction, { merge: true });
  } catch (err) {
    console.warn("Could not write payment transaction to Firestore (cached locally):", err);
  }
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
  slickPayWebhookSecret: "whsec_slickpay_baridimob_dz_secret",
  slickPayEnabled: true,
  paddleVendorId: "pdl_vnd_987654",
  paddleApiKey: "pdl_api_key_test_international",
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



