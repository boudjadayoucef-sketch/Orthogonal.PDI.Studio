/**
 * ORTHOGONAL PD&I STUDIO — MIG-05-FIX-01
 * Test A — Absence d'initialisation Firebase au démarrage + Authentification serveur Supabase stricte
 *
 * Preuves vérifiées :
 * 1. Traversée statique exhaustive du graphe d'imports transitifs depuis `src/main.tsx` :
 *    zéro import runtime vers `firebase/app`, `firebase/auth`, `firebase/firestore` ou `src/lib/firebase`.
 * 2. Instrumentation des appels Firebase SDK en environnement production hors Sandbox (`VITE_PDI_ENV=production`) :
 *    - initializeApp : 0 appel
 *    - initializeFirestore : 0 appel
 *    - getAuth : 0 appel
 *    - getDocFromServer : 0 appel
 *    - onAuthStateChanged : 0 appel
 * 3. Découplage effectif de `PdiAuthPage`, `GoogleDriveWorkspace` et `PdiFeedbackModal` en chargement paresseux
 *    (leurs modules ne sont pas évalués au démarrage tout en restant disponibles à l'usage).
 * 4. Authentification serveur Supabase stricte sur `/api/auth/sync-user` et `/api/projects`,
 *    tout en préservant le fallback Firebase sur `/api/admin/set-user-role`.
 */

import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseSpies = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]", options: { projectId: "graphical-router-x18qq" } })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => {
    throw new Error("no default app");
  }),
  initializeFirestore: vi.fn(() => ({ type: "mock-firestore" })),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  getDocFromServer: vi.fn(async () => ({ exists: () => false })),
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: vi.fn(() => () => {}),
}));

vi.mock("firebase/app", () => ({
  initializeApp: firebaseSpies.initializeApp,
  getApps: firebaseSpies.getApps,
  getApp: firebaseSpies.getApp,
}));

vi.mock("firebase/firestore", () => ({
  initializeFirestore: firebaseSpies.initializeFirestore,
  persistentLocalCache: firebaseSpies.persistentLocalCache,
  persistentMultipleTabManager: firebaseSpies.persistentMultipleTabManager,
  getDocFromServer: firebaseSpies.getDocFromServer,
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: firebaseSpies.getAuth,
  onAuthStateChanged: firebaseSpies.onAuthStateChanged,
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updatePassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));

import { startServer } from "../../../server.ts";
import type { SupabaseServerAuthGateway } from "../../server/supabaseAuth.ts";

const PROJECT_ROOT = process.cwd();

interface StaticImportEdge {
  from: string;
  specifier: string;
  isTypeOnly: boolean;
  statement: string;
  chain: string[];
}

function resolveRelativeTsModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function stripCommentsForImportScan(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function collectStaticTransitiveImports(entryAbsPath: string): {
  visitedFiles: string[];
  firebaseRuntimeEdges: StaticImportEdge[];
} {
  const visited = new Set<string>();
  const firebaseRuntimeEdges: StaticImportEdge[] = [];

  const staticImportOrReexportRegex =
    /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  const sideEffectImportRegex = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;

  const walk = (absFile: string, chain: string[]) => {
    if (visited.has(absFile)) return;
    visited.add(absFile);

    const relFile = path.relative(PROJECT_ROOT, absFile);
    const cleaned = stripCommentsForImportScan(fs.readFileSync(absFile, "utf8"));
    const nextChain = [...chain, relFile];

    let match: RegExpExecArray | null;
    staticImportOrReexportRegex.lastIndex = 0;
    while ((match = staticImportOrReexportRegex.exec(cleaned)) !== null) {
      const isTypeOnly = Boolean(match[2]);
      const clause = match[3].trim();
      const specifier = match[4].trim();

      // Check named-only type imports like `import { type Foo, type Bar } from "..."`
      const namedBlockMatch = clause.match(/^\{([\s\S]*)\}$/);
      const allSpecifiersAreTypeOnly =
        isTypeOnly ||
        (Boolean(namedBlockMatch) &&
          namedBlockMatch![1]
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
            .every((part) => part.startsWith("type ")));

      if (allSpecifiersAreTypeOnly) {
        continue;
      }

      if (
        specifier === "firebase/app" ||
        specifier === "firebase/auth" ||
        specifier === "firebase/firestore" ||
        /(^|\/)lib\/firebase(\.ts)?$/.test(specifier)
      ) {
        firebaseRuntimeEdges.push({
          from: relFile,
          specifier,
          isTypeOnly: false,
          statement: match[0].trim(),
          chain: nextChain,
        });
      }

      const resolvedTarget = resolveRelativeTsModule(absFile, specifier);
      if (resolvedTarget) {
        walk(resolvedTarget, nextChain);
      }
    }

    sideEffectImportRegex.lastIndex = 0;
    while ((match = sideEffectImportRegex.exec(cleaned)) !== null) {
      const specifier = match[1].trim();
      if (
        specifier.startsWith("firebase/") ||
        /(^|\/)lib\/firebase(\.ts)?$/.test(specifier)
      ) {
        firebaseRuntimeEdges.push({
          from: relFile,
          specifier,
          isTypeOnly: false,
          statement: match[0].trim(),
          chain: nextChain,
        });
      }
      const resolvedTarget = resolveRelativeTsModule(absFile, specifier);
      if (resolvedTarget) {
        walk(resolvedTarget, nextChain);
      }
    }
  };

  walk(entryAbsPath, []);
  return {
    visitedFiles: Array.from(visited).map((f) => path.relative(PROJECT_ROOT, f)),
    firebaseRuntimeEdges,
  };
}

function makeBase64Url(input: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(input), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeSupabaseJwt(userId: string, email: string, supabaseUrl: string): string {
  const header = makeBase64Url({ alg: "HS256", typ: "JWT" });
  const payload = makeBase64Url({
    iss: `${supabaseUrl}/auth/v1`,
    sub: userId,
    email,
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.signature_mig05_test`;
}

describe("MIG-05-FIX-01 — Test A : Absence d'initialisation Firebase au démarrage", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "production";
    process.env.PDI_ENV = "production";
    process.env.VITE_PDI_ENV = "production";
    delete process.env.VITE_STAGING_SANDBOX;
    delete process.env.STAGING_SANDBOX;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("A1 — Le graphe réel des imports transitifs statiques depuis src/main.tsx ne contient AUCUN import runtime Firebase/Firestore", () => {
    const mainEntry = path.resolve(PROJECT_ROOT, "src/main.tsx");
    const { visitedFiles, firebaseRuntimeEdges } = collectStaticTransitiveImports(mainEntry);

    expect(visitedFiles).toContain("src/main.tsx");
    expect(visitedFiles).toContain("src/App.tsx");
    expect(visitedFiles).toContain("src/pdi/app/PdiUnifiedApp.tsx");
    expect(visitedFiles).toContain("src/pdi/isometric/PdiIsometricEditor.tsx");
    expect(visitedFiles).toContain("src/pdi/isometric/engine/IsometrieModuleV48d.tsx");
    expect(visitedFiles).toContain("src/lib/pdiApiClient.ts");
    expect(visitedFiles).toContain("src/lib/supabaseAuth.ts");
    expect(visitedFiles).toContain("src/lib/localAuthCache.ts");

    // Preuve structurelle complète : aucune chaîne statique au démarrage n'atteint Firebase
    expect(firebaseRuntimeEdges).toEqual([]);
    expect(visitedFiles).not.toContain("src/lib/firebase.ts");
    expect(visitedFiles).not.toContain("src/lib/googleAuth.ts");
  });

  it("A2 — Instrumentation SDK Firebase en environnement production hors Sandbox : 0 appel à initializeApp, initializeFirestore, getAuth, getDocFromServer et onAuthStateChanged", async () => {
    vi.resetModules();

    // Charger réellement tous les modules du chemin critique de démarrage en environnement production hors Sandbox
    const localAuthCache = await import("../../lib/localAuthCache.ts");
    const pdiAuthTypes = await import("../../types/pdiAuthTypes.ts");
    const supabaseAuth = await import("../../lib/supabaseAuth.ts");
    const pdiApiClient = await import("../../lib/pdiApiClient.ts");
    const isoMigration = await import("../../pdi/isometric/state/isometricIdentityMigration.ts");
    const pdiAuthPageModule = await import("../../pdi/auth/PdiAuthPage.tsx");
    const pdiFeedbackModule = await import("../../pdi/feedback/PdiFeedbackModal.tsx");

    // Exercer les chemins de boot/session sans Firebase
    expect(typeof localAuthCache.purgeLocalAuthCaches).toBe("function");
    expect(typeof pdiAuthTypes.PdiAuthAccessError).toBe("function");
    expect(typeof supabaseAuth.attachSupabaseAuthMonitor).toBe("function");
    expect(typeof pdiAuthPageModule.default).toBe("function");
    expect(typeof pdiFeedbackModule.PdiFeedbackModal).toBe("function");

    const token = await pdiApiClient.getAuthToken(false);
    expect(token).toBeNull();

    const resolvedUid = isoMigration.resolveCanonicalIsometricUserUid({
      sandboxMode: false,
      storage: null,
    });
    expect(typeof resolvedUid).toBe("string");

    // Assertions obligatoires MIG-05-FIX-01 (en mode production hors Sandbox)
    expect(firebaseSpies.initializeApp).toHaveBeenCalledTimes(0);
    expect(firebaseSpies.initializeFirestore).toHaveBeenCalledTimes(0);
    expect(firebaseSpies.getAuth).toHaveBeenCalledTimes(0);
    expect(firebaseSpies.getDocFromServer).toHaveBeenCalledTimes(0);
    expect(firebaseSpies.onAuthStateChanged).toHaveBeenCalledTimes(0);
  }, 15000);

  it("A3 — Découplage paresseux vérifié dans PdiUnifiedApp.tsx, PdiAuthPage.tsx, PdiFeedbackModal.tsx et src/main.tsx", () => {
    const mainSource = fs.readFileSync(path.resolve(PROJECT_ROOT, "src/main.tsx"), "utf8");
    const unifiedSource = fs.readFileSync(
      path.resolve(PROJECT_ROOT, "src/pdi/app/PdiUnifiedApp.tsx"),
      "utf8"
    );
    const authPageSource = fs.readFileSync(
      path.resolve(PROJECT_ROOT, "src/pdi/auth/PdiAuthPage.tsx"),
      "utf8"
    );
    const feedbackSource = fs.readFileSync(
      path.resolve(PROJECT_ROOT, "src/pdi/feedback/PdiFeedbackModal.tsx"),
      "utf8"
    );

    expect(mainSource).not.toContain("testConnection");
    expect(mainSource).not.toContain("./lib/firebase");

    expect(unifiedSource).not.toContain('from "../../lib/firebase"');
    expect(unifiedSource).toContain('React.lazy(() => import("../auth/PdiAuthPage"))');
    expect(unifiedSource).toContain('import("../../components/GoogleDriveWorkspace")');
    expect(unifiedSource).toContain('import("../feedback/PdiFeedbackModal")');

    // PdiAuthPage et PdiFeedbackModal conservent leurs capacités Firebase en import dynamique paresseux
    expect(authPageSource).not.toMatch(/^\s*import\s+.*from\s+["']\.\.\/\.\.\/lib\/firebase["']/m);
    expect(authPageSource).toContain('import("../../lib/firebase")');
    expect(feedbackSource).not.toMatch(/^\s*import\s+.*from\s+["']\.\.\/\.\.\/lib\/firebase["']/m);
    expect(feedbackSource).toContain('import("../../lib/firebase")');
  });

  it("A4 — Serveur Express : /api/auth/sync-user et /api/projects exigent strictement Supabase (0 fallback Firebase) tandis que /api/admin/set-user-role préserve le fallback Firebase", async () => {
    const TEST_SUPABASE_URL = "https://mig05testproj.supabase.co";
    const ACTIVE_UUID = "7243efe7-113d-45f2-8f2e-044799b25ff0";
    const ACTIVE_EMAIL = "orthogonaleng@gmail.com";
    const validSbJwt = makeSupabaseJwt(ACTIVE_UUID, ACTIVE_EMAIL, TEST_SUPABASE_URL);

    const verifyIdTokenSpy = vi.fn(async (token: string) => {
      if (token === "legacy_firebase_superadmin_token") {
        return {
          uid: "firebase_legacy_sa_01",
          email: "legacy-admin@orthogonal.dz",
          email_verified: true,
          role: "super_admin",
        };
      }
      throw new Error("Invalid Firebase token");
    });
    const setCustomUserClaimsSpy = vi.fn(async () => undefined);
    const getUserProjectsSpy = vi.fn(async (uid: string) => [{ id: 1, user_id: uid, name: "Iso 1" }]);
    const getOrCreateUserSpy = vi.fn(async (uid: string, email: string) => ({ id: 1, uid, email }));

    const gateway: SupabaseServerAuthGateway = {
      verifyAccessTokenAndGetUser: async (token: string) => {
        if (token === validSbJwt) {
          return {
            id: ACTIVE_UUID,
            email: ACTIVE_EMAIL,
            email_confirmed_at: "2026-11-23T10:00:00.000Z",
          };
        }
        return null;
      },
      findProfileByUserId: async (userId: string) => {
        if (userId === ACTIVE_UUID) {
          return {
            id: ACTIVE_UUID,
            email: ACTIVE_EMAIL,
            name: "Super Admin Orthogonal",
            display_name: "Super Admin Orthogonal",
            company: "Orthogonal",
            country: "Algérie",
            country_code: "DZ",
            role: "super_admin",
            status: "active",
            account_type: "enterprise",
            subscription_plan: "yearly",
            created_at: "2026-11-23T10:00:00.000Z",
            updated_at: "2026-11-23T10:00:00.000Z",
          };
        }
        return null;
      },
    };

    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: false,
      env: {
        NODE_ENV: "development",
        PDI_ENV: "development",
        VITE_PDI_ENV: "development",
        SUPABASE_URL: TEST_SUPABASE_URL,
      },
      dependencies: {
        supabaseAuthGateway: gateway,
        getAdminAuth: () =>
          ({
            verifyIdToken: verifyIdTokenSpy,
            setCustomUserClaims: setCustomUserClaimsSpy,
          }) as any,
        getAdminDb: () => ({ collection: vi.fn() }) as any,
        getUserProjects: getUserProjectsSpy as any,
        getOrCreateUser: getOrCreateUserSpy as any,
      },
    });

    try {
      const baseUrl = `http://127.0.0.1:${started.port}`;

      // 1. /api/projects et /api/auth/sync-user acceptent un JWT Supabase vérifié
      const sbProjectsRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${validSbJwt}` },
      });
      expect(sbProjectsRes.status).toBe(200);
      expect(getUserProjectsSpy).toHaveBeenCalledWith(ACTIVE_UUID);

      const sbSyncRes = await fetch(`${baseUrl}/api/auth/sync-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validSbJwt}`,
        },
        body: JSON.stringify({ displayName: "Super Admin Orthogonal" }),
      });
      expect(sbSyncRes.status).toBe(200);
      expect(getOrCreateUserSpy).toHaveBeenCalledWith(
        ACTIVE_UUID,
        ACTIVE_EMAIL,
        "Super Admin Orthogonal",
        undefined
      );

      // 2. Un jeton Firebase hérité est STRICTEMENT rejeté (401) sur /api/projects et /api/auth/sync-user
      //    avec 0 appel à verifyIdToken() !
      const fbProjectsRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: "Bearer legacy_firebase_superadmin_token" },
      });
      expect(fbProjectsRes.status).toBe(401);
      const fbProjectsBody = (await fbProjectsRes.json()) as any;
      expect(fbProjectsBody.code).toBe("auth/supabase-token-required");

      const fbSyncRes = await fetch(`${baseUrl}/api/auth/sync-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer legacy_firebase_superadmin_token",
        },
        body: JSON.stringify({ displayName: "Legacy" }),
      });
      expect(fbSyncRes.status).toBe(401);
      expect(verifyIdTokenSpy).toHaveBeenCalledTimes(0);

      // 3. /api/admin/set-user-role préserve le fallback Firebase (non cassée dans MIG-05-FIX-01)
      const fbAdminRes = await fetch(`${baseUrl}/api/admin/set-user-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer legacy_firebase_superadmin_token",
        },
        body: JSON.stringify({ targetUid: "legacy_target_uid", role: "admin" }),
      });
      expect(fbAdminRes.status).toBe(200);
      expect(verifyIdTokenSpy).toHaveBeenCalledTimes(1);
      expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("legacy_target_uid", { role: "admin" });
    } finally {
      await started.close();
    }
  });
});
