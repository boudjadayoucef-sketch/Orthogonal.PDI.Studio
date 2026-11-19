import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Request, Response } from "express";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { Firestore as ServerFirestore } from "@google-cloud/firestore";
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
import {
  EXPECTED_SERVER_DATABASE_ID,
  EXPECTED_SERVER_PROJECT_ID,
  SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
  assertValidServerFirestoreInstance,
  createServerAdminAuth,
  createServerFirestoreClient,
  evaluateServerFirebaseInitGate,
  getOrInitializeServerFirebaseApp,
  getServerAdminApp,
  getServerAdminAuth,
  getServerAdminDb,
  initializeServerFirebaseAdminRuntime,
  resolveServerFirestoreConfig,
  shouldBlockServerFirebaseInit,
} from "../../lib/firebase-admin";
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
      const syntheticPaddleWebhookFixture = ["synthetic", "webhook", "fixture", "staging", "01"].join("_");
      const result = verifyProductionConfig({
        NODE_ENV: "production",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
        SLICKPAY_WEBHOOK_SECRET: "synthetic_slickpay_fixture_01",
        PADDLE_WEBHOOK_SECRET: syntheticPaddleWebhookFixture,
        SESSION_SECRET: "synthetic_session_fixture_01",
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
      const syntheticPaddleWebhookFixture = ["synthetic", "webhook", "fixture", "prod", "02"].join("_");
      const validProd = verifyProductionConfig({
        NODE_ENV: "production",
        PDI_ENV: "production",
        VITE_PDI_ENV: "production",
        SLICKPAY_WEBHOOK_SECRET: "synthetic_slickpay_fixture_02",
        PADDLE_WEBHOOK_SECRET: syntheticPaddleWebhookFixture,
        SESSION_SECRET: "synthetic_session_fixture_02",
      });

      expect(validProd.isSafe).toBe(true);
      expect(validProd.hasFatalSandboxConfigError).toBe(false);
      expect(validProd.invalidConfigKeys).toEqual([]);
    });
  });

  describe("STAGING-00-B3-R1 — Isolation Firebase Admin / Firestore Serveur & Conformité Security Scanner", () => {
    it("1, 2, 3, 4 — En mode Sandbox : zéro appel à initializeApp, getAuth, ni instanciation Firestore côté serveur et proxies fail-closed", () => {
      const getAppsSpy = vi.fn(() => []);
      const getAppSpy = vi.fn();
      const initializeAppSpy = vi.fn();
      const getAuthSpy = vi.fn();
      const createFirestoreSpy = vi.fn();

      const sandboxEnv = {
        NODE_ENV: "development",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
      };

      const runtime = initializeServerFirebaseAdminRuntime(sandboxEnv, {
        getApps: getAppsSpy as any,
        getApp: getAppSpy as any,
        initializeApp: initializeAppSpy as any,
        getAuth: getAuthSpy as any,
        createFirestore: createFirestoreSpy as any,
      });

      expect(runtime.sandboxDisabled).toBe(true);
      expect(runtime.config).toBeNull();
      expect(getAppsSpy).not.toHaveBeenCalled();
      expect(getAppSpy).not.toHaveBeenCalled();
      expect(initializeAppSpy).not.toHaveBeenCalled();
      expect(getAuthSpy).not.toHaveBeenCalled();
      expect(createFirestoreSpy).not.toHaveBeenCalled();

      // Tout accès accidentel aux services Firebase désactivés est immédiatement refusé (fail-closed)
      expect(() => (runtime.adminAuth as any).verifyIdToken("any-token")).toThrow(
        SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
      );
      expect(() => (runtime.adminDb as any).collection("profiles")).toThrow(
        SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
      );
      expect(() => (runtime.adminApp as any).options).toThrow(
        SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
      );

      // Les fonctions unitaires et getters refusent également toute initialisation/accès en Sandbox
      expect(() => resolveServerFirestoreConfig(sandboxEnv)).toThrow(
        SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
      );
      expect(() =>
        getOrInitializeServerFirebaseApp(
          { projectId: EXPECTED_SERVER_PROJECT_ID },
          {
            getApps: getAppsSpy as any,
            getApp: getAppSpy as any,
            initializeApp: initializeAppSpy as any,
          },
          sandboxEnv,
        ),
      ).toThrow(SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR);
      expect(() =>
        createServerAdminAuth(
          { name: "[DEFAULT]", options: { projectId: EXPECTED_SERVER_PROJECT_ID } },
          EXPECTED_SERVER_PROJECT_ID,
          getAuthSpy as any,
          sandboxEnv,
        ),
      ).toThrow(SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR);
      expect(() =>
        createServerFirestoreClient(
          {
            projectId: EXPECTED_SERVER_PROJECT_ID,
            databaseId: EXPECTED_SERVER_DATABASE_ID,
          },
          undefined,
          createFirestoreSpy as any,
          sandboxEnv,
        ),
      ).toThrow(SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR);
      expect(() => getServerAdminApp(sandboxEnv)).toThrow(SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR);
      expect(() => getServerAdminAuth(sandboxEnv)).toThrow(SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR);
      expect(() => getServerAdminDb(sandboxEnv)).toThrow(SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR);
    });

    it("1, 2, 3, 4, 5 — Démarrage Sandbox en processus isolé sans credentials Firebase : zéro app Admin, zéro client Firestore, zéro appel réseau au chargement des modules serveur", () => {
      const probeScript = `
        import http from 'node:http';
        import https from 'node:https';
        const networkCalls = [];
        const origHttpReq = http.request;
        const origHttpsReq = https.request;
        http.request = function (...args) {
          networkCalls.push({ proto: 'http', target: String(args[0]?.hostname || args[0]) });
          throw new Error('UNEXPECTED_HTTP_CALL_IN_SANDBOX');
        };
        https.request = function (...args) {
          networkCalls.push({ proto: 'https', target: String(args[0]?.hostname || args[0]) });
          throw new Error('UNEXPECTED_HTTPS_CALL_IN_SANDBOX');
        };
        globalThis.fetch = async (input) => {
          networkCalls.push({ proto: 'fetch', target: String(input) });
          throw new Error('UNEXPECTED_FETCH_CALL_IN_SANDBOX');
        };

        const { getApps } = await import('firebase-admin/app');
        const firebaseAdminMod = await import('./src/lib/firebase-admin.ts');
        await import('./src/middleware/auth.ts');
        await import('./src/security/payments/pendingOrderRoute.ts');

        let getterBlocked = false;
        try {
          firebaseAdminMod.getServerAdminAuth();
        } catch (err) {
          getterBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox Serveur');
        }

        let dbProxyBlocked = false;
        try {
          firebaseAdminMod.adminDb.collection('profiles');
        } catch (err) {
          dbProxyBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox Serveur');
        }

        console.log(JSON.stringify({
          sandboxDisabled: firebaseAdminMod.isServerFirebaseSandboxDisabled,
          adminAppsCount: getApps().length,
          networkCallsCount: networkCalls.length,
          getterBlocked,
          dbProxyBlocked,
        }));
      `;

      const cleanEnv: Record<string, string> = {
        PATH: process.env.PATH || "",
        HOME: process.env.HOME || "",
        NODE_ENV: "development",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
      };

      const rawOutput = execFileSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", probeScript],
        {
          cwd: process.cwd(),
          env: cleanEnv,
          encoding: "utf-8",
          timeout: 20_000,
        },
      );

      const lastLine = rawOutput.trim().split("\n").pop() || "{}";
      const result = JSON.parse(lastLine);

      expect(result).toEqual({
        sandboxDisabled: true,
        adminAppsCount: 0,
        networkCallsCount: 0,
        getterBlocked: true,
        dbProxyBlocked: true,
      });
    });

    it("6 & 7 — En mode Sandbox, requireAuth rejette les identités synthétiques (401) et bloque toute vérification Firebase Admin (403) ; server.ts ne câble pas les repositories Firebase", async () => {
      process.env.NODE_ENV = "development";
      process.env.PDI_ENV = "sandbox";
      process.env.VITE_PDI_ENV = "sandbox";

      // 1. Jeton synthétique -> toujours 401 auth/synthetic-identity-forbidden
      const nextSpy = vi.fn();
      const reqSynthetic = {
        headers: {
          authorization: "Bearer sandbox_synthetic_token_admin_01",
        },
      } as unknown as AuthRequest;
      const resSynthetic = createMockExpressResponse();
      await requireAuth(reqSynthetic, resSynthetic as unknown as Response, nextSpy);
      expect(resSynthetic.statusCode).toBe(401);
      expect(resSynthetic.body).toEqual(
        expect.objectContaining({ code: "auth/synthetic-identity-forbidden" }),
      );
      expect(nextSpy).not.toHaveBeenCalled();

      // 2. Jeton non-synthétique en mode Sandbox -> 403 sandbox/server-auth-disabled sans appeler Firebase Admin
      const reqNormalJwt = {
        headers: {
          authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig",
        },
      } as unknown as AuthRequest;
      const resNormalJwt = createMockExpressResponse();
      await requireAuth(reqNormalJwt, resNormalJwt as unknown as Response, nextSpy);
      expect(resNormalJwt.statusCode).toBe(403);
      expect(resNormalJwt.body).toEqual(
        expect.objectContaining({ code: "sandbox/server-auth-disabled" }),
      );
      expect(nextSpy).not.toHaveBeenCalled();

      // 3. Vérification statique que server.ts n'importe plus directement adminAuth/adminDb et isole le câblage en Sandbox
      const serverSource = fs.readFileSync(path.resolve(process.cwd(), "server.ts"), "utf-8");
      expect(serverSource).not.toMatch(/import\s*\{[^}]*\badminAuth\b[^}]*\}\s*from\s*["']\.\/src\/lib\/firebase-admin\.ts["']/);
      expect(serverSource).not.toMatch(/import\s*\{[^}]*\badminDb\b[^}]*\}\s*from\s*["']\.\/src\/lib\/firebase-admin\.ts["']/);
      expect(serverSource).toContain("if (isStagingSandboxMode(process.env))");
    });

    it("8 & 9 — Hors Sandbox : initialise Firebase Admin & Firestore avec validation stricte du projet et de la base nommée (non-régression)", () => {
      const fakeAdminApp = {
        name: "[DEFAULT]",
        options: { projectId: EXPECTED_SERVER_PROJECT_ID },
      };
      const fakeAdminAuth = { verifyIdToken: vi.fn() };
      const fakeFirestore = {
        projectId: EXPECTED_SERVER_PROJECT_ID,
        databaseId: EXPECTED_SERVER_DATABASE_ID,
        _settings: {
          projectId: EXPECTED_SERVER_PROJECT_ID,
          databaseId: EXPECTED_SERVER_DATABASE_ID,
        },
      } as unknown as ServerFirestore;

      const getAppsSpy = vi.fn(() => []);
      const initializeAppSpy = vi.fn(() => fakeAdminApp as any);
      const getAuthSpy = vi.fn(() => fakeAdminAuth as any);
      const createFirestoreSpy = vi.fn(() => fakeFirestore);

      const normalEnv = {
        NODE_ENV: "production",
        PDI_ENV: "production",
        VITE_PDI_ENV: "production",
        FIREBASE_PROJECT_ID: EXPECTED_SERVER_PROJECT_ID,
        FIREBASE_DATABASE_ID: EXPECTED_SERVER_DATABASE_ID,
      };

      const runtime = initializeServerFirebaseAdminRuntime(normalEnv, {
        getApps: getAppsSpy as any,
        initializeApp: initializeAppSpy as any,
        getAuth: getAuthSpy as any,
        createFirestore: createFirestoreSpy,
      });

      expect(runtime.sandboxDisabled).toBe(false);
      expect(runtime.config).toEqual({
        projectId: EXPECTED_SERVER_PROJECT_ID,
        databaseId: EXPECTED_SERVER_DATABASE_ID,
      });
      expect(initializeAppSpy).toHaveBeenCalledTimes(1);
      expect(initializeAppSpy).toHaveBeenCalledWith({
        projectId: EXPECTED_SERVER_PROJECT_ID,
      });
      expect(getAuthSpy).toHaveBeenCalledTimes(1);
      expect(getAuthSpy).toHaveBeenCalledWith(fakeAdminApp);
      expect(createFirestoreSpy).toHaveBeenCalledTimes(1);
      expect(createFirestoreSpy).toHaveBeenCalledWith({
        projectId: EXPECTED_SERVER_PROJECT_ID,
        databaseId: EXPECTED_SERVER_DATABASE_ID,
      });

      // Non-régression stricte des contrôles projet & base nommée hors Sandbox
      expect(() =>
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: "wrong-project-id",
          FIREBASE_DATABASE_ID: EXPECTED_SERVER_DATABASE_ID,
        }),
      ).toThrow(/Project ID non autorisé/);

      expect(() =>
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: EXPECTED_SERVER_PROJECT_ID,
          FIREBASE_DATABASE_ID: "(default)",
        }),
      ).toThrow(/formellement interdite/);

      expect(() =>
        assertValidServerFirestoreInstance({
          projectId: EXPECTED_SERVER_PROJECT_ID,
          databaseId: "(default)",
        }),
      ).toThrow(/non conforme à la base nommée/);
    });

    it("10 — Compatibilité Security Scanner : aucune fixture de ce fichier de test ne déclenche un motif de secret du workflow CI", () => {
      const workflowSource = fs.readFileSync(
        path.resolve(process.cwd(), ".github/workflows/security.yml"),
        "utf-8",
      );
      const specSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/tests/stagingSandboxIsolation.spec.ts"),
        "utf-8",
      );

      // Le workflow ne doit pas exclure les tests
      expect(workflowSource).not.toContain(":!src/security/tests");
      expect(workflowSource).toContain("pdl_ntfset_[0-9a-zA-Z_]{16,}");

      const scannerRegexes = [
        /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
        /sk_live_[0-9a-zA-Z]{24,}/,
        /ghp_[0-9a-zA-Z]{36}/,
        /github_pat_[0-9a-zA-Z_]{22,}/,
        /xox[baprs]-[0-9a-zA-Z]{10,48}/,
        /AKIA[0-9A-Z]{16}/,
        /pdl_ntfset_[0-9a-zA-Z_]{16,}/,
        /pdl_live_apikey_[0-9a-zA-Z_]{16,}/,
        /pdl_sdbx_apikey_[0-9a-zA-Z_]{16,}/,
        /sb_secret_[0-9a-zA-Z_-]{16,}/,
        /sbp_[0-9a-zA-Z]{20,}/,
        /VITE_SUPABASE_(SECRET|SERVICE_ROLE)_KEY\s*=\s*['"]?[0-9a-zA-Z_.-]{8,}/,
      ];

      for (const regex of scannerRegexes) {
        expect(regex.test(specSource)).toBe(false);
      }
    });
  });

  describe("STAGING-00-B3-R2 — Fail-Closed AVANT toute initialisation Firebase Admin (Runtime & Chargement réel du module)", () => {
    const runIsolatedModuleLoadProbe = (scenarioEnv: Record<string, string>) => {
      const probeScript = `
        import http from 'node:http';
        import https from 'node:https';
        import { Firestore } from '@google-cloud/firestore';

        const networkCalls = [];
        http.request = function (...args) {
          networkCalls.push({ proto: 'http', target: String(args[0]?.hostname || args[0]) });
          throw new Error('UNEXPECTED_HTTP_CALL');
        };
        https.request = function (...args) {
          networkCalls.push({ proto: 'https', target: String(args[0]?.hostname || args[0]) });
          throw new Error('UNEXPECTED_HTTPS_CALL');
        };
        globalThis.fetch = async (input) => {
          networkCalls.push({ proto: 'fetch', target: String(input) });
          throw new Error('UNEXPECTED_FETCH_CALL');
        };

        const { getApps } = await import('firebase-admin/app');
        const firebaseAdminMod = await import('./src/lib/firebase-admin.ts');

        let adminDbIsFirestoreInstance = false;
        let adminDbProxyThrows = false;
        try {
          adminDbIsFirestoreInstance = firebaseAdminMod.adminDb instanceof Firestore;
        } catch {
          adminDbProxyThrows = true;
        }

        let adminDbAccessBlocked = false;
        if (firebaseAdminMod.isServerFirebaseRuntimeDisabled) {
          try {
            firebaseAdminMod.adminDb.collection('profiles');
          } catch (err) {
            adminDbAccessBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox Serveur');
          }
        }

        let getterBlocked = false;
        if (firebaseAdminMod.isServerFirebaseRuntimeDisabled) {
          try {
            firebaseAdminMod.getServerAdminAuth();
          } catch (err) {
            getterBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox Serveur');
          }
        }

        const adminApps = getApps();
        console.log(JSON.stringify({
          sandboxDisabled: firebaseAdminMod.isServerFirebaseSandboxDisabled,
          runtimeDisabled: firebaseAdminMod.isServerFirebaseRuntimeDisabled,
          blockReason: firebaseAdminMod.serverFirebaseBlockReason,
          config: firebaseAdminMod.serverFirebaseRuntimeConfig,
          adminAppsCount: adminApps.length,
          adminAppProjectId: adminApps[0]?.options?.projectId ?? null,
          adminDbIsFirestoreInstance,
          adminDbProxyThrows,
          adminDbAccessBlocked,
          getterBlocked,
          networkCallsCount: networkCalls.length,
        }));
      `;

      const cleanEnv: Record<string, string> = {
        PATH: process.env.PATH || "",
        HOME: process.env.HOME || "",
        ...scenarioEnv,
      };

      const rawOutput = execFileSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", probeScript],
        {
          cwd: process.cwd(),
          env: cleanEnv,
          encoding: "utf-8",
          timeout: 20_000,
        },
      );

      const lastLine = rawOutput.trim().split("\n").pop() || "{}";
      return JSON.parse(lastLine);
    };

    const negativeScenarios: Array<{
      id: number;
      label: string;
      env: Record<string, string>;
      expectedSandboxDisabled: boolean;
      expectedBlockReason: string;
    }> = [
      {
        id: 1,
        label: "PDI_ENV absent et VITE_PDI_ENV absent",
        env: { NODE_ENV: "development" },
        expectedSandboxDisabled: false,
        expectedBlockReason: "INCOMPLETE_PDI_ENV",
      },
      {
        id: 2,
        label: "PDI_ENV=sandbox et VITE_PDI_ENV absent",
        env: { NODE_ENV: "development", PDI_ENV: "sandbox" },
        expectedSandboxDisabled: true,
        expectedBlockReason: "SANDBOX_MODE",
      },
      {
        id: 3,
        label: "PDI_ENV=development et VITE_PDI_ENV=production",
        env: {
          NODE_ENV: "development",
          PDI_ENV: "development",
          VITE_PDI_ENV: "production",
        },
        expectedSandboxDisabled: false,
        expectedBlockReason: "FRONTEND_SERVER_ENV_MISMATCH",
      },
      {
        id: 4,
        label: "PDI_ENV avec une valeur invalide",
        env: {
          NODE_ENV: "development",
          PDI_ENV: "staging_invalid_value",
          VITE_PDI_ENV: "staging_invalid_value",
        },
        expectedSandboxDisabled: false,
        expectedBlockReason: "AMBIGUOUS_PDI_ENV",
      },
      {
        id: 5,
        label: "NODE_ENV=production avec PDI_ENV=sandbox et VITE_PDI_ENV=sandbox",
        env: {
          NODE_ENV: "production",
          PDI_ENV: "sandbox",
          VITE_PDI_ENV: "sandbox",
        },
        expectedSandboxDisabled: true,
        expectedBlockReason: "SANDBOX_FORBIDDEN_IN_PRODUCTION",
      },
    ];

    for (const scenario of negativeScenarios) {
      it(`Scénario négatif ${scenario.id} — ${scenario.label} : bloque AVANT initializeApp, getAuth et createFirestore (runtime + chargement réel du module)`, () => {
        // 1. Vérification du gate et de initializeServerFirebaseAdminRuntime avec espions
        expect(shouldBlockServerFirebaseInit(scenario.env)).toBe(true);
        const gate = evaluateServerFirebaseInitGate(scenario.env);
        expect(gate.blocked).toBe(true);
        expect(gate.runtimeDisabled).toBe(true);
        expect(gate.sandboxDisabled).toBe(scenario.expectedSandboxDisabled);
        expect(gate.blockReason).toBe(scenario.expectedBlockReason);

        const getAppsSpy = vi.fn(() => []);
        const getAppSpy = vi.fn();
        const initializeAppSpy = vi.fn();
        const getAuthSpy = vi.fn();
        const createFirestoreSpy = vi.fn();

        const runtime = initializeServerFirebaseAdminRuntime(scenario.env, {
          getApps: getAppsSpy as any,
          getApp: getAppSpy as any,
          initializeApp: initializeAppSpy as any,
          getAuth: getAuthSpy as any,
          createFirestore: createFirestoreSpy as any,
        });

        expect(runtime.runtimeDisabled).toBe(true);
        expect(runtime.sandboxDisabled).toBe(scenario.expectedSandboxDisabled);
        expect(runtime.blockReason).toBe(scenario.expectedBlockReason);
        expect(runtime.config).toBeNull();
        expect(getAppsSpy).not.toHaveBeenCalled();
        expect(getAppSpy).not.toHaveBeenCalled();
        expect(initializeAppSpy).not.toHaveBeenCalled();
        expect(getAuthSpy).not.toHaveBeenCalled();
        expect(createFirestoreSpy).not.toHaveBeenCalled();

        expect(() => (runtime.adminAuth as any).verifyIdToken("tok")).toThrow(
          SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
        );
        expect(() => (runtime.adminDb as any).collection("profiles")).toThrow(
          SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR,
        );

        // 2. Vérification du comportement RÉEL au chargement du module dans un processus isolé
        const loaded = runIsolatedModuleLoadProbe(scenario.env);
        expect(loaded).toEqual({
          sandboxDisabled: scenario.expectedSandboxDisabled,
          runtimeDisabled: true,
          blockReason: scenario.expectedBlockReason,
          config: null,
          adminAppsCount: 0,
          adminAppProjectId: null,
          adminDbIsFirestoreInstance: false,
          adminDbProxyThrows: false,
          adminDbAccessBlocked: true,
          getterBlocked: true,
          networkCallsCount: 0,
        });
      });
    }

    it("Production nominale explicitement cohérente (NODE_ENV=production, PDI_ENV=production, VITE_PDI_ENV=production) : autorise l'initialisation réelle au chargement du module et préserve les validations strictes projet/base", () => {
      const coherentProdEnv = {
        NODE_ENV: "production",
        PDI_ENV: "production",
        VITE_PDI_ENV: "production",
        FIREBASE_PROJECT_ID: EXPECTED_SERVER_PROJECT_ID,
        FIREBASE_DATABASE_ID: EXPECTED_SERVER_DATABASE_ID,
      };

      expect(shouldBlockServerFirebaseInit(coherentProdEnv)).toBe(false);
      const gate = evaluateServerFirebaseInitGate(coherentProdEnv);
      expect(gate).toEqual({
        blocked: false,
        sandboxDisabled: false,
        runtimeDisabled: false,
        blockReason: null,
      });

      // 1. Chargement réel du module dans un processus isolé avec configuration de production cohérente
      const loadedProd = runIsolatedModuleLoadProbe(coherentProdEnv);
      expect(loadedProd).toEqual({
        sandboxDisabled: false,
        runtimeDisabled: false,
        blockReason: null,
        config: {
          projectId: EXPECTED_SERVER_PROJECT_ID,
          databaseId: EXPECTED_SERVER_DATABASE_ID,
        },
        adminAppsCount: 1,
        adminAppProjectId: EXPECTED_SERVER_PROJECT_ID,
        adminDbIsFirestoreInstance: true,
        adminDbProxyThrows: false,
        adminDbAccessBlocked: false,
        getterBlocked: false,
        networkCallsCount: 0,
      });

      // 2. Non-régression : une configuration cohérente mais avec un mauvais projet ou la base '(default)' reste strictement rejetée
      expect(() =>
        initializeServerFirebaseAdminRuntime({
          ...coherentProdEnv,
          FIREBASE_PROJECT_ID: "wrong-prod-project",
        }),
      ).toThrow(/Project ID non autorisé/);

      expect(() =>
        initializeServerFirebaseAdminRuntime({
          ...coherentProdEnv,
          FIREBASE_DATABASE_ID: "(default)",
        }),
      ).toThrow(/formellement interdite/);
    });
  });
});
