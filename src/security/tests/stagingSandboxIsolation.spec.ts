import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  SANDBOX_BANNER_LINES,
  SANDBOX_STORAGE_PREFIX,
  getSandboxSyntheticAuthUser,
  getSandboxSyntheticProfile,
  isSandboxStorageKey,
  isStagingSandboxMode,
  isSyntheticSandboxToken,
  isSyntheticSandboxUid,
  resetSandboxLocalStorageOnly,
  resolvePdiEnvironmentMode,
  resolveScopedStorageKey,
  seedSandboxDefaultProjectIfEmpty,
  setStagingSandboxTestOverride,
  toSandboxStorageKey,
} from "../../lib/stagingSandbox";
import {
  EXPECTED_FIREBASE_PROJECT_ID,
  EXPECTED_FIRESTORE_DATABASE_ID,
  SANDBOX_DISABLED_FIREBASE_CONFIG,
  getOrInitializeClientFirebaseApp,
  getOrInitializeClientFirestore,
  initializeClientFirebaseRuntime,
  resolveAuthoritativeWorkspaceSession,
  resolveClientFirebaseConfig,
  testConnection,
} from "../../lib/firebase";
import { verifyProductionConfig } from "../sec01SecurityService";
import {
  rejectInStagingSandboxMode,
  requireAuth,
  type AuthRequest,
} from "../../middleware/auth";
import {
  getStagingSandboxBannerSpec,
  pdiListLocalSessions,
  pdiReadProjectIndex,
  pdiRemoveProject,
  pdiUpsertProject,
  pdiWriteProjectIndex,
} from "../../pdi/app/PdiUnifiedApp";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  keys(): string[] {
    return Array.from(this.map.keys());
  }
}

function createMockExpressResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("STAGING-00-B3 — Sandbox Isolée AI Studio Share (C1..C5)", () => {
  const originalEnv = { ...process.env };
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PDI_ENV;
    delete process.env.VITE_PDI_ENV;
    setStagingSandboxTestOverride(null);
    memoryStorage = new MemoryStorage();
    vi.stubGlobal("localStorage", memoryStorage);
    vi.stubGlobal("window", {
      localStorage: memoryStorage,
      sessionStorage: new MemoryStorage(),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setStagingSandboxTestOverride(null);
    vi.unstubAllGlobals();
  });

  describe("Protection C1 — Kill-switch Firebase (Aucune initialisation Firebase Production en mode Sandbox)", () => {
    it("n'appelle jamais initializeApp, initializeFirestore ni getAuth lorsque le mode Sandbox est actif", () => {
      const fakeApp = {
        name: "[DEFAULT]",
        options: { projectId: EXPECTED_FIREBASE_PROJECT_ID },
      } as unknown as FirebaseApp;
      const fakeDb = { type: "firestore" } as Firestore;
      const fakeAuth = { name: "fake-auth" } as unknown as Auth;

      const sdkSpy = {
        getApps: vi.fn(() => []),
        getApp: vi.fn(() => fakeApp),
        initializeApp: vi.fn(() => fakeApp),
        initializeFirestore: vi.fn(() => fakeDb),
        getAuth: vi.fn(() => fakeAuth),
      };

      const runtime = initializeClientFirebaseRuntime(
        {
          VITE_PDI_ENV: "sandbox",
          PDI_ENV: "sandbox",
          NODE_ENV: "development",
        },
        sdkSpy,
      );

      expect(runtime.sandboxDisabled).toBe(true);
      expect(runtime.activeConfig).toEqual(SANDBOX_DISABLED_FIREBASE_CONFIG);
      expect(runtime.activeConfig.projectId).not.toBe(EXPECTED_FIREBASE_PROJECT_ID);
      expect(sdkSpy.initializeApp).not.toHaveBeenCalled();
      expect(sdkSpy.initializeFirestore).not.toHaveBeenCalled();
      expect(sdkSpy.getAuth).not.toHaveBeenCalled();
    });

    it("bloque explicitement resolveClientFirebaseConfig, getOrInitializeClientFirebaseApp et getOrInitializeClientFirestore en mode Sandbox", () => {
      const sandboxEnv = {
        VITE_PDI_ENV: "sandbox",
        PDI_ENV: "sandbox",
        NODE_ENV: "development",
      };

      expect(() => resolveClientFirebaseConfig(sandboxEnv)).toThrow(
        /Coupe-circuit Sandbox \(C1\)/,
      );

      setStagingSandboxTestOverride(true);
      expect(() => getOrInitializeClientFirebaseApp(SANDBOX_DISABLED_FIREBASE_CONFIG)).toThrow(
        /Coupe-circuit Sandbox \(C1\).*initializeApp/,
      );
      expect(() =>
        getOrInitializeClientFirestore({} as FirebaseApp, {
          projectId: EXPECTED_FIREBASE_PROJECT_ID,
          firestoreDatabaseId: EXPECTED_FIRESTORE_DATABASE_ID,
        }),
      ).toThrow(/Coupe-circuit Sandbox \(C1\).*initializeFirestore/);
    });

    it("empêche testConnection() d'interroger Firestore et retourne une session synthétique locale sans Firebase", async () => {
      setStagingSandboxTestOverride(true);

      await expect(testConnection()).resolves.toBeUndefined();

      const session = await resolveAuthoritativeWorkspaceSession();
      expect(session.status).toBe("active");
      expect(session.canAccessWorkspace).toBe(true);
      expect(session.profile?.uid).toBe("sandbox_local_uid_engineer_01");
      expect(session.profile?.status).toBe("active");
    });

    it("préserve le fonctionnement normal hors mode Sandbox (non-régression C1)", () => {
      const fakeApp = {
        name: "[DEFAULT]",
        options: { projectId: EXPECTED_FIREBASE_PROJECT_ID },
      } as unknown as FirebaseApp;
      const fakeDb = { type: "firestore" } as Firestore;
      const fakeAuth = { name: "prod-auth" } as unknown as Auth;

      const sdkSpy = {
        getApps: vi.fn(() => []),
        getApp: vi.fn(() => fakeApp),
        initializeApp: vi.fn(() => fakeApp),
        initializeFirestore: vi.fn(() => fakeDb),
        getAuth: vi.fn(() => fakeAuth),
      };

      const runtime = initializeClientFirebaseRuntime(
        {
          NODE_ENV: "development",
          VITE_PDI_ENV: "development",
          PDI_ENV: "development",
        },
        sdkSpy,
      );

      expect(runtime.sandboxDisabled).toBe(false);
      expect(runtime.activeConfig.projectId).toBe(EXPECTED_FIREBASE_PROJECT_ID);
      expect(sdkSpy.initializeApp).toHaveBeenCalledTimes(1);
      expect(sdkSpy.initializeFirestore).toHaveBeenCalledTimes(1);
      expect(sdkSpy.getAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe("Protection C2 — Serveur Zero-Trust (Rejet identité synthétique & routes sensibles)", () => {
    it("rejette tout jeton synthétique ou en-tête x-pdi-sandbox-identity avec 401 auth/synthetic-identity-forbidden", async () => {
      const nextSpy = vi.fn();

      const reqWithSyntheticBearer = {
        headers: {
          authorization: "Bearer sandbox_synthetic_token_engineer_01",
        },
      } as unknown as AuthRequest;
      const res1 = createMockExpressResponse();

      await requireAuth(reqWithSyntheticBearer, res1 as unknown as Response, nextSpy);
      expect(res1.statusCode).toBe(401);
      expect(res1.body).toEqual(
        expect.objectContaining({
          code: "auth/synthetic-identity-forbidden",
        }),
      );
      expect(nextSpy).not.toHaveBeenCalled();

      const reqWithSyntheticHeader = {
        headers: {
          authorization: "Bearer fake.jwt.token",
          "x-pdi-sandbox-identity": "sandbox_local_uid_engineer_01",
        },
      } as unknown as AuthRequest;
      const res2 = createMockExpressResponse();

      await requireAuth(reqWithSyntheticHeader, res2 as unknown as Response, nextSpy);
      expect(res2.statusCode).toBe(401);
      expect(res2.body).toEqual(
        expect.objectContaining({
          code: "auth/synthetic-identity-forbidden",
        }),
      );
      expect(nextSpy).not.toHaveBeenCalled();
    });

    it("détecte les UID et jetons synthétiques locaux comme interdits côté serveur", () => {
      expect(isSyntheticSandboxUid(getSandboxSyntheticAuthUser().uid)).toBe(true);
      expect(isSyntheticSandboxUid(getSandboxSyntheticProfile().uid)).toBe(true);
      expect(isSyntheticSandboxUid("WGeEjhbec9RIDZmlD7PxGQM2i9p1")).toBe(false);

      expect(isSyntheticSandboxToken("sandbox_synthetic_token_abc")).toBe(true);
      expect(isSyntheticSandboxToken("sandbox-local-only-jwt")).toBe(true);
      expect(isSyntheticSandboxToken("eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.payload.sig")).toBe(
        false,
      );
    });

    it("bloque les routes d'administration, paiements, webhooks et écritures serveur en mode Sandbox (403 sandbox/server-mutation-forbidden)", () => {
      process.env.PDI_ENV = "sandbox";
      process.env.VITE_PDI_ENV = "sandbox";
      process.env.NODE_ENV = "development";

      const protectedRoutes = [
        "/api/admin/set-user-role",
        "/api/payments/orders",
        "/api/webhooks/paddle",
        "/api/webhooks/slickpay",
        "/api/auth/sync-user",
        "/api/projects",
      ];

      for (const path of protectedRoutes) {
        const nextSpy = vi.fn();
        const req = { path, method: "POST" } as unknown as Request;
        const res = createMockExpressResponse();

        rejectInStagingSandboxMode(req, res as unknown as Response, nextSpy);

        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual(
          expect.objectContaining({
            code: "sandbox/server-mutation-forbidden",
          }),
        );
        expect(nextSpy).not.toHaveBeenCalled();
      }
    });

    it("autorise le passage du middleware rejectInStagingSandboxMode hors mode Sandbox", () => {
      process.env.PDI_ENV = "development";
      process.env.VITE_PDI_ENV = "development";

      const nextSpy = vi.fn();
      const req = { path: "/api/projects", method: "GET" } as unknown as Request;
      const res = createMockExpressResponse();

      rejectInStagingSandboxMode(req, res as unknown as Response, nextSpy);
      expect(nextSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Protection C3 — Isolation stricte du stockage local (pdi.sandbox.staging.v1.)", () => {
    it("préfixe toutes les clés Sandbox avec pdi.sandbox.staging.v1. et n'écrase jamais les clés historiques", () => {
      const historicalIndexKey = "pdi.projects.index.v1";
      const historicalAutosaveKey =
        "isometrie.autosave.v474.user.WGeEjhbec9RIDZmlD7PxGQM2i9p1.project.prod-proj-01.current";
      const historicalIndexValue = JSON.stringify([
        {
          projectId: "prod-proj-01",
          title: "Projet Production Réel",
          module: "isometric",
          updatedAt: "2026-03-01T10:00:00.000Z",
        },
      ]);
      const historicalAutosaveValue = JSON.stringify({
        project: { name: "Projet Production Réel", updatedAt: "2026-03-01T10:00:00.000Z" },
        model: { nodes: [{ id: "N1" }], segments: [{ id: "S1" }] },
      });

      memoryStorage.setItem(historicalIndexKey, historicalIndexValue);
      memoryStorage.setItem(historicalAutosaveKey, historicalAutosaveValue);

      const sandboxEnv = {
        VITE_PDI_ENV: "sandbox",
        PDI_ENV: "sandbox",
        NODE_ENV: "development",
      };
      setStagingSandboxTestOverride(true);

      seedSandboxDefaultProjectIfEmpty(memoryStorage);

      pdiUpsertProject(
        {
          projectId: "sandbox-proj-02",
          title: "Ligne Vapeur Synthétique 02",
          module: "isometric",
        },
        sandboxEnv,
      );

      const scopedIsoKey = resolveScopedStorageKey(
        "isometrie.autosave.v474.user.sandbox_local_uid_engineer_01.project.sandbox-proj-02.current",
        sandboxEnv,
      );
      expect(scopedIsoKey.startsWith(SANDBOX_STORAGE_PREFIX)).toBe(true);
      memoryStorage.setItem(
        scopedIsoKey,
        JSON.stringify({
          project: {
            id: "sandbox-proj-02",
            name: "Ligne Vapeur Synthétique 02",
            updatedAt: "2026-04-01T12:00:00.000Z",
          },
          model: {
            nodes: [{ id: "N1" }, { id: "N2" }],
            segments: [{ id: "S1" }],
          },
        }),
      );

      // Vérification que les clés historiques sont strictement intactes
      expect(memoryStorage.getItem(historicalIndexKey)).toBe(historicalIndexValue);
      expect(memoryStorage.getItem(historicalAutosaveKey)).toBe(historicalAutosaveValue);

      // Vérification que la lecture Sandbox ne retourne que les projets Sandbox
      const sandboxProjects = pdiReadProjectIndex(sandboxEnv);
      expect(sandboxProjects.map((p) => p.projectId)).toContain("sandbox-iso-line-101");
      expect(sandboxProjects.map((p) => p.projectId)).toContain("sandbox-proj-02");
      expect(sandboxProjects.map((p) => p.projectId)).not.toContain("prod-proj-01");

      // Vérification que pdiListLocalSessions ne lit que les sessions préfixées pdi.sandbox.staging.v1.
      const sandboxSessions = pdiListLocalSessions(sandboxEnv);
      expect(sandboxSessions.length).toBeGreaterThanOrEqual(2);
      expect(sandboxSessions.every((s) => s.key.startsWith(SANDBOX_STORAGE_PREFIX))).toBe(true);
      expect(sandboxSessions.map((s) => s.projectId)).not.toContain("prod-proj-01");

      // Suppression d'un projet Sandbox : ne touche jamais aux clés historiques
      pdiRemoveProject("sandbox-proj-02", sandboxEnv);
      expect(memoryStorage.getItem(historicalIndexKey)).toBe(historicalIndexValue);
      expect(memoryStorage.getItem(historicalAutosaveKey)).toBe(historicalAutosaveValue);
    });

    it("supprime exclusivement les clés pdi.sandbox.staging.v1.* lors de la réinitialisation Sandbox", () => {
      const historicalKeys = [
        "pdi.projects.index.v1",
        "isometrie.autosave.v474.user.real.project.p1.current",
        "pdi.active_project.v1",
        "other.app.preference",
      ];
      for (const k of historicalKeys) {
        memoryStorage.setItem(k, "keep-me");
      }

      const sandboxKeys = [
        toSandboxStorageKey("pdi.projects.index.v1"),
        toSandboxStorageKey(
          "isometrie.autosave.v474.user.sandbox_local_uid_engineer_01.project.p1.current",
        ),
        toSandboxStorageKey("pdi.sketch_to_iso.bridge.v1"),
      ];
      for (const k of sandboxKeys) {
        memoryStorage.setItem(k, "delete-me");
      }

      const removedKeys = resetSandboxLocalStorageOnly(memoryStorage);

      expect(removedKeys.length).toBe(sandboxKeys.length);
      expect(removedKeys.sort()).toEqual(sandboxKeys.sort());
      expect(removedKeys.every((k) => isSandboxStorageKey(k))).toBe(true);

      for (const k of historicalKeys) {
        expect(memoryStorage.getItem(k)).toBe("keep-me");
      }
      for (const k of sandboxKeys) {
        expect(memoryStorage.getItem(k)).toBeNull();
      }
    });

    it("utilise les clés normales sans préfixe Sandbox lorsque le mode Sandbox est inactif", () => {
      setStagingSandboxTestOverride(false);
      const normalEnv = {
        NODE_ENV: "development",
        PDI_ENV: "development",
        VITE_PDI_ENV: "development",
      };

      expect(resolveScopedStorageKey("pdi.projects.index.v1", normalEnv)).toBe(
        "pdi.projects.index.v1",
      );
      pdiWriteProjectIndex(
        [
          {
            projectId: "normal-proj-1",
            title: "Projet Normal",
            module: "isometric",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        normalEnv,
      );

      expect(memoryStorage.getItem("pdi.projects.index.v1")).not.toBeNull();
      expect(memoryStorage.getItem(toSandboxStorageKey("pdi.projects.index.v1"))).toBeNull();
    });
  });

  describe("Protection C4 — Bandeau permanent non masquable en mode Sandbox", () => {
    it("affiche les 3 mentions obligatoires exactes et interdit le masquage en mode Sandbox", () => {
      const spec = getStagingSandboxBannerSpec({
        VITE_PDI_ENV: "sandbox",
        PDI_ENV: "sandbox",
        NODE_ENV: "development",
      });

      expect(spec.visible).toBe(true);
      expect(spec.dismissible).toBe(false);
      expect(spec.lines).toEqual([
        "ENVIRONNEMENT SANDBOX DE TEST — AI STUDIO SHARE",
        "DONNÉES SYNTHÉTIQUES LOCALES",
        "FIREBASE PRODUCTION DÉSACTIVÉ",
      ]);
      expect(spec.lines).toEqual(SANDBOX_BANNER_LINES);
    });

    it("n'affiche pas le bandeau Sandbox en mode normal/production", () => {
      const spec = getStagingSandboxBannerSpec({
        VITE_PDI_ENV: "production",
        PDI_ENV: "production",
        NODE_ENV: "production",
      });

      expect(spec.visible).toBe(false);
    });
  });

  describe("Protection C5 — Interdiction du mode Sandbox en production et cohérence Frontend/Serveur", () => {
    it("refuse le démarrage en production si le mode Sandbox est activé (SANDBOX_FORBIDDEN_IN_PRODUCTION)", () => {
      const result = verifyProductionConfig({
        NODE_ENV: "production",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
        SLICKPAY_WEBHOOK_SECRET: "prod_secret_1234567890123456",
        PADDLE_WEBHOOK_SECRET: "pdl_ntfset_1234567890123456",
        SESSION_SECRET: "session_secret_1234567890123456",
      });

      expect(result.isSafe).toBe(false);
      expect(result.hasFatalSandboxConfigError).toBe(true);
      expect(
        result.invalidConfigKeys?.some((e) => e.includes("SANDBOX_FORBIDDEN_IN_PRODUCTION")),
      ).toBe(true);
      expect(
        isStagingSandboxMode({
          NODE_ENV: "production",
          PDI_ENV: "sandbox",
          VITE_PDI_ENV: "sandbox",
        }),
      ).toBe(false);
    });

    it("refuse toute incohérence entre PDI_ENV (serveur) et VITE_PDI_ENV (frontend) (FRONTEND_SERVER_ENV_MISMATCH)", () => {
      const mismatch1 = verifyProductionConfig({
        NODE_ENV: "development",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "production",
      });

      expect(mismatch1.isSafe).toBe(false);
      expect(mismatch1.hasFatalSandboxConfigError).toBe(true);
      expect(
        mismatch1.invalidConfigKeys?.some((e) => e.includes("FRONTEND_SERVER_ENV_MISMATCH")),
      ).toBe(true);

      const mismatch2 = verifyProductionConfig({
        NODE_ENV: "development",
        PDI_ENV: "sandbox",
      });

      expect(mismatch2.isSafe).toBe(false);
      expect(mismatch2.hasFatalSandboxConfigError).toBe(true);
      expect(
        mismatch2.invalidConfigKeys?.some((e) => e.includes("FRONTEND_SERVER_ENV_MISMATCH")),
      ).toBe(true);
    });

    it("refuse toute valeur ambiguë ou inconnue dans PDI_ENV / VITE_PDI_ENV (AMBIGUOUS_PDI_ENV)", () => {
      const ambiguous = verifyProductionConfig({
        NODE_ENV: "development",
        PDI_ENV: "staging-maybe",
        VITE_PDI_ENV: "staging-maybe",
      });

      expect(ambiguous.isSafe).toBe(false);
      expect(ambiguous.hasFatalSandboxConfigError).toBe(true);
      expect(ambiguous.invalidConfigKeys?.some((e) => e.includes("AMBIGUOUS_PDI_ENV"))).toBe(true);
    });

    it("valide une configuration Sandbox cohérente hors production", () => {
      const validSandbox = verifyProductionConfig({
        NODE_ENV: "development",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
      });

      expect(validSandbox.isSafe).toBe(true);
      expect(validSandbox.hasFatalSandboxConfigError).toBe(false);
      expect(
        resolvePdiEnvironmentMode(
          {
            NODE_ENV: "development",
            PDI_ENV: "sandbox",
            VITE_PDI_ENV: "sandbox",
          },
          { requireServerClientCoherence: true },
        ),
      ).toEqual({
        isValid: true,
        mode: "sandbox",
        isSandbox: true,
        serverPdiEnv: "sandbox",
        clientVitePdiEnv: "sandbox",
        nodeEnv: "development",
      });
    });

    it("préserve le fonctionnement du mode production normal (non-régression C5)", () => {
      const validProd = verifyProductionConfig({
        NODE_ENV: "production",
        PDI_ENV: "production",
        VITE_PDI_ENV: "production",
        SLICKPAY_WEBHOOK_SECRET: "prod_secret_1234567890123456",
        PADDLE_WEBHOOK_SECRET: "pdl_ntfset_1234567890123456",
        SESSION_SECRET: "session_secret_1234567890123456",
      });

      expect(validProd.isSafe).toBe(true);
      expect(validProd.hasFatalSandboxConfigError).toBe(false);
      expect(validProd.invalidConfigKeys).toEqual([]);
    });
  });
});
