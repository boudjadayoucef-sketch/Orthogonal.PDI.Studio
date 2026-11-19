/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * STAGING-00-B4 — FIX-ENV-02
 *
 * Tests de validation de la séparation du mode Sandbox et du mode de livraison Cloud Run :
 * 1.  Sandbox + NODE_ENV=production -> démarrage refusé (même avec PDI_SERVE_STATIC_DIST=true)
 * 2.  Sandbox + NODE_ENV=staging + mode statique -> démarrage autorisé + injection runtime publique
 * 3.  Sandbox + NODE_ENV=staging sans mode statique -> refus fail-closed explicite (Vite interdit)
 * 4.  PDI_ENV et VITE_PDI_ENV incohérents (serveur & client vs config runtime injectée) -> refusés
 * 5.  Configuration runtime absente -> client Firebase fail-closed (zéro initialisation)
 * 6.  Configuration runtime Sandbox -> zéro initialisation Firebase client (build & runtime injecté)
 * 7.  Configuration runtime production explicite -> fonctionnement normal préservé
 * 8.  Mode statique Cloud Run -> zéro serveur Vite démarré
 * 9.  Mode statique Cloud Run -> sécurité stricte maintenue (CORS, CSP, trust proxy, health/assets)
 * 10. Routes sensibles en Sandbox -> mutations refusées (403)
 * 11. PostgreSQL -> zéro initialisation
 * 12. Identités synthétiques -> zéro authentification serveur accordée (401)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";

import {
  PDI_RUNTIME_CONFIG_GLOBAL_KEY,
  buildPublicBrowserRuntimeConfig,
  injectPublicRuntimeConfigIntoHtml,
  readInjectedBrowserRuntimeConfig,
  resolvePdiEnvironmentMode,
  serializePublicRuntimeConfigScript,
  setStagingSandboxTestOverride,
} from "../../lib/stagingSandbox";
import {
  resolveServerDeliveryMode,
  resolveCspFrameAncestors,
  validateAllowedOrigins,
  verifyProductionConfig,
} from "../sec01SecurityService";
import {
  CLIENT_FIREBASE_FAIL_CLOSED_CONFIG,
  EXPECTED_FIREBASE_PROJECT_ID,
  EXPECTED_FIRESTORE_DATABASE_ID,
  SANDBOX_DISABLED_FIREBASE_CONFIG,
  evaluateClientFirebaseInitGate,
  initializeClientFirebaseRuntime,
  resolveClientFirebaseConfig,
  testConnection,
} from "../../lib/firebase";
import { createRequireAuth } from "../../middleware/auth";
import {
  createPool,
  evaluateServerPostgresInitGate,
  getDb,
  isPostgresPoolInitialized,
  resetPostgresRuntimeForTests,
  shouldBlockServerPostgresInit,
} from "../../db/index";
import { createPdiExpressApp, startServer, type StartedPdiServer } from "../../../server";

const execFileAsync = promisify(execFile);

const CLOUD_RUN_STAGING_SANDBOX_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "staging",
  PDI_ENV: "sandbox",
  VITE_PDI_ENV: "sandbox",
  TRUST_PROXY: "1",
  PDI_SERVE_STATIC_DIST: "true",
};

function createTemporaryDistDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdi-fix-env-02-dist-"));
  const assetsDir = path.join(dir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.html"),
    [
      "<!doctype html>",
      '<html lang="fr">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      "    <title>Orthogonal PD&amp;I Studio</title>",
      '    <script type="module" crossorigin src="/assets/index-test.js"></script>',
      "  </head>",
      "  <body>",
      '    <div id="root"></div>',
      "  </body>",
      "</html>",
    ].join("\n"),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(assetsDir, "index-test.js"),
    'console.log("pdi-static-bundle");\n',
    "utf-8"
  );
  fs.writeFileSync(
    path.join(assetsDir, "index-test.css"),
    "body { margin: 0; }\n",
    "utf-8"
  );
  return dir;
}

describe("STAGING-00-B4 — FIX-ENV-02 : Séparation Sandbox / Livraison Cloud Run", () => {
  const startedServers: StartedPdiServer[] = [];
  const tempDirs: string[] = [];

  beforeEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  afterEach(async () => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
    while (startedServers.length > 0) {
      const srv = startedServers.pop();
      if (srv) {
        await srv.close();
      }
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  // =========================================================================
  // 1. Sandbox + NODE_ENV=production -> démarrage refusé (C5 préservée)
  // =========================================================================
  it("1. refuse strictement le démarrage en Sandbox lorsque NODE_ENV=production (même avec PDI_SERVE_STATIC_DIST=true)", async () => {
    const forbiddenProdSandboxEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      PDI_ENV: "sandbox",
      VITE_PDI_ENV: "sandbox",
      TRUST_PROXY: "1",
      PDI_SERVE_STATIC_DIST: "true",
    };

    const envResolution = resolvePdiEnvironmentMode(forbiddenProdSandboxEnv, {
      requireServerClientCoherence: true,
    });
    expect(envResolution.isValid).toBe(false);
    expect(envResolution.errorCode).toBe("SANDBOX_FORBIDDEN_IN_PRODUCTION");

    const validation = verifyProductionConfig(forbiddenProdSandboxEnv);
    expect(validation.isSafe).toBe(false);
    expect(validation.hasFatalSandboxConfigError).toBe(true);

    expect(buildPublicBrowserRuntimeConfig(forbiddenProdSandboxEnv)).toBeNull();

    expect(() => createPdiExpressApp({ env: forbiddenProdSandboxEnv })).toThrow(
      /SANDBOX_FORBIDDEN_IN_PRODUCTION|Fatal server configuration error/i
    );

    const viteSpy = vi.fn();
    await expect(
      startServer({
        host: "127.0.0.1",
        port: 0,
        attachFrontend: true,
        env: forbiddenProdSandboxEnv,
        dependencies: { createViteServer: viteSpy as any },
      })
    ).rejects.toThrow(/SANDBOX_FORBIDDEN_IN_PRODUCTION|Fatal server configuration error/i);
    expect(viteSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 2. Sandbox + NODE_ENV=staging + mode statique -> autorisé + injection runtime
  // =========================================================================
  it("2. autorise Sandbox + NODE_ENV=staging + PDI_SERVE_STATIC_DIST=true et injecte la config runtime publique minimale dans index.html", async () => {
    const distDir = createTemporaryDistDir();
    tempDirs.push(distDir);
    const viteSpy = vi.fn();

    const delivery = resolveServerDeliveryMode(CLOUD_RUN_STAGING_SANDBOX_ENV);
    expect(delivery.isValid).toBe(true);
    expect(delivery.serveStaticDist).toBe(true);
    expect(delivery.strictSecurityMode).toBe(true);
    expect(delivery.isStagingNodeEnv).toBe(true);
    expect(delivery.isProductionNodeEnv).toBe(false);

    const validation = verifyProductionConfig(CLOUD_RUN_STAGING_SANDBOX_ENV);
    expect(validation.isSafe).toBe(true);

    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: true,
      distPath: distDir,
      env: CLOUD_RUN_STAGING_SANDBOX_ENV,
      dependencies: { createViteServer: viteSpy as any },
    });
    startedServers.push(started);

    const baseUrl = `http://127.0.0.1:${started.port}`;

    // GET / et GET /index.html et route SPA /workspace doivent recevoir l'injection runtime
    for (const route of ["/", "/index.html", "/workspace"]) {
      const res = await fetch(`${baseUrl}${route}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(res.headers.get("cache-control")).toBe("no-store");

      const html = await res.text();
      expect(html).toContain(
        `<script id="pdi-runtime-config">window.__PDI_RUNTIME_CONFIG__=Object.freeze({"pdiEnv":"sandbox"});</script>`
      );

      // Le script de config runtime doit être injecté AVANT le premier <script type="module"> ou </head>
      const configIdx = html.indexOf('id="pdi-runtime-config"');
      const headCloseIdx = html.indexOf("</head>");
      expect(configIdx).toBeGreaterThan(-1);
      expect(configIdx).toBeLessThan(headCloseIdx);

      // Aucun secret, aucune URL DB, aucun identifiant exposé dans la balise injectée
      const scriptMatch = html.match(/<script id="pdi-runtime-config">([\s\S]*?)<\/script>/);
      expect(scriptMatch).not.toBeNull();
      const scriptBody = scriptMatch![1];
      expect(scriptBody).toBe('window.__PDI_RUNTIME_CONFIG__=Object.freeze({"pdiEnv":"sandbox"});');
      expect(scriptBody).not.toMatch(/DATABASE_URL|SUPABASE|FIREBASE|SECRET|API_KEY|PASSWORD|postgresql:/i);
    }

    // Les assets statiques restent servis normalement et un asset inexistant renvoie 404 (jamais index.html)
    const jsAssetRes = await fetch(`${baseUrl}/assets/index-test.js`);
    expect(jsAssetRes.status).toBe(200);
    expect(await jsAssetRes.text()).toContain("pdi-static-bundle");

    const missingAssetRes = await fetch(`${baseUrl}/assets/missing.js`);
    expect(missingAssetRes.status).toBe(404);
    expect(await missingAssetRes.text()).toBe("Asset not found");

    expect(viteSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 3. Sandbox + NODE_ENV=staging sans mode statique -> refus fail-closed explicite
  // =========================================================================
  it("3. refuse en fail-closed NODE_ENV=staging lorsque PDI_SERVE_STATIC_DIST est absent, false ou invalide", async () => {
    const cases: Array<{ label: string; env: NodeJS.ProcessEnv }> = [
      {
        label: "absent",
        env: {
          NODE_ENV: "staging",
          PDI_ENV: "sandbox",
          VITE_PDI_ENV: "sandbox",
        },
      },
      {
        label: "false",
        env: {
          NODE_ENV: "staging",
          PDI_ENV: "sandbox",
          VITE_PDI_ENV: "sandbox",
          PDI_SERVE_STATIC_DIST: "false",
        },
      },
      {
        label: "valeur invalide",
        env: {
          NODE_ENV: "staging",
          PDI_ENV: "sandbox",
          VITE_PDI_ENV: "sandbox",
          PDI_SERVE_STATIC_DIST: "maybe",
        },
      },
      {
        label: "NODE_ENV=production avec PDI_SERVE_STATIC_DIST=false",
        env: {
          NODE_ENV: "production",
          PDI_ENV: "production",
          VITE_PDI_ENV: "production",
          PDI_SERVE_STATIC_DIST: "false",
        },
      },
    ];

    for (const tc of cases) {
      const delivery = resolveServerDeliveryMode(tc.env);
      expect(delivery.isValid, tc.label).toBe(false);
      expect(delivery.serveStaticDist, tc.label).toBe(false);
      expect(delivery.strictSecurityMode, tc.label).toBe(true);

      const validation = verifyProductionConfig(tc.env);
      expect(validation.isSafe, tc.label).toBe(false);
      expect(validation.hasFatalSandboxConfigError, tc.label).toBe(true);

      expect(() => createPdiExpressApp({ env: tc.env }), tc.label).toThrow(
        /PDI_SERVE_STATIC_DIST|Fatal server configuration error/i
      );
    }
  });

  // =========================================================================
  // 4. PDI_ENV et VITE_PDI_ENV incohérents (serveur + runtime injecté vs build) -> refusés
  // =========================================================================
  it("4. refuse toute incohérence PDI_ENV/VITE_PDI_ENV côté serveur et toute divergence runtime injecté vs VITE_PDI_ENV compilé côté client", () => {
    const mismatchedServerEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "staging",
      PDI_ENV: "sandbox",
      VITE_PDI_ENV: "production",
      PDI_SERVE_STATIC_DIST: "true",
    };

    expect(verifyProductionConfig(mismatchedServerEnv).isSafe).toBe(false);
    expect(buildPublicBrowserRuntimeConfig(mismatchedServerEnv)).toBeNull();
    expect(() => createPdiExpressApp({ env: mismatchedServerEnv })).toThrow(
      /FRONTEND_SERVER_ENV_MISMATCH|Fatal server configuration error/i
    );

    const incompleteServerEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "staging",
      PDI_ENV: "sandbox",
      PDI_SERVE_STATIC_DIST: "true",
    };
    expect(buildPublicBrowserRuntimeConfig(incompleteServerEnv)).toBeNull();

    // Côté client : si le bundle a été compilé avec VITE_PDI_ENV=production mais le serveur injecte sandbox -> bloqué fail-closed
    const sdkSpy = {
      getApps: vi.fn(() => []),
      getApp: vi.fn(),
      initializeApp: vi.fn(),
      initializeFirestore: vi.fn(),
      getAuth: vi.fn(),
    };

    const mismatchedClientRuntime = initializeClientFirebaseRuntime(
      {
        VITE_PDI_ENV: "production",
        [PDI_RUNTIME_CONFIG_GLOBAL_KEY]: { pdiEnv: "sandbox" },
      },
      sdkSpy
    );
    expect(mismatchedClientRuntime.runtimeDisabled).toBe(true);
    expect(mismatchedClientRuntime.blockReason).toBe("FRONTEND_SERVER_ENV_MISMATCH");
    expect(sdkSpy.initializeApp).not.toHaveBeenCalled();
    expect(sdkSpy.initializeFirestore).not.toHaveBeenCalled();
    expect(sdkSpy.getAuth).not.toHaveBeenCalled();

    // Valeur invalide injectée dans __PDI_RUNTIME_CONFIG__ -> rejetée fail-closed
    const invalidInjectedRead = readInjectedBrowserRuntimeConfig({
      [PDI_RUNTIME_CONFIG_GLOBAL_KEY]: { pdiEnv: "staging_invalid" },
    });
    expect(invalidInjectedRead.present).toBe(true);
    expect(invalidInjectedRead.isValid).toBe(false);

    const invalidInjectedRuntime = initializeClientFirebaseRuntime(
      {
        [PDI_RUNTIME_CONFIG_GLOBAL_KEY]: { pdiEnv: "staging_invalid" },
      },
      sdkSpy
    );
    expect(invalidInjectedRuntime.runtimeDisabled).toBe(true);
    expect(invalidInjectedRuntime.blockReason).toBe("AMBIGUOUS_PDI_ENV");
    expect(sdkSpy.initializeApp).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 5. Configuration runtime absente -> client Firebase fail-closed
  // =========================================================================
  it("5. applique un coupe-circuit fail-closed dans firebase.ts lorsque la configuration runtime est absente (zéro bascule Production)", async () => {
    const emptyRuntimeEnv: Record<string, unknown> = {};
    const gate = evaluateClientFirebaseInitGate(emptyRuntimeEnv);
    expect(gate.blocked).toBe(true);
    expect(gate.runtimeDisabled).toBe(true);
    expect(gate.sandboxDisabled).toBe(false);
    expect(gate.blockReason).toBe("MISSING_RUNTIME_ENV");

    expect(() => resolveClientFirebaseConfig(emptyRuntimeEnv)).toThrow(
      /Fail-Closed Client.*MISSING_RUNTIME_ENV/i
    );

    const sdkSpy = {
      getApps: vi.fn(() => []),
      getApp: vi.fn(),
      initializeApp: vi.fn(),
      initializeFirestore: vi.fn(),
      getAuth: vi.fn(),
    };

    const runtime = initializeClientFirebaseRuntime(emptyRuntimeEnv, sdkSpy);
    expect(runtime.runtimeDisabled).toBe(true);
    expect(runtime.sandboxDisabled).toBe(false);
    expect(runtime.blockReason).toBe("MISSING_RUNTIME_ENV");
    expect(runtime.activeConfig).toEqual(CLIENT_FIREBASE_FAIL_CLOSED_CONFIG);
    expect(runtime.activeConfig.projectId).not.toBe(EXPECTED_FIREBASE_PROJECT_ID);
    expect(sdkSpy.initializeApp).not.toHaveBeenCalled();
    expect(sdkSpy.initializeFirestore).not.toHaveBeenCalled();
    expect(sdkSpy.getAuth).not.toHaveBeenCalled();

    // testConnection() ne doit jamais toucher Firestore en mode fail-closed
    await expect(testConnection(emptyRuntimeEnv)).resolves.toBeUndefined();
  });

  // =========================================================================
  // 6. Configuration runtime Sandbox -> zéro initialisation Firebase client
  // =========================================================================
  it("6. garantit zéro initialisation Firebase client en Sandbox via VITE_PDI_ENV ou via window.__PDI_RUNTIME_CONFIG__ (VITE_PDI_ENV absent au build)", () => {
    const sdkSpy = {
      getApps: vi.fn(() => []),
      getApp: vi.fn(),
      initializeApp: vi.fn(),
      initializeFirestore: vi.fn(),
      getAuth: vi.fn(),
    };

    // Cas 6A : configuration runtime injectée par le serveur dans index.html alors que VITE_PDI_ENV est absent du bundle
    const injectedOnlySandboxRuntime = initializeClientFirebaseRuntime(
      {
        [PDI_RUNTIME_CONFIG_GLOBAL_KEY]: Object.freeze({ pdiEnv: "sandbox" }),
      },
      sdkSpy
    );
    expect(injectedOnlySandboxRuntime.sandboxDisabled).toBe(true);
    expect(injectedOnlySandboxRuntime.runtimeDisabled).toBe(true);
    expect(injectedOnlySandboxRuntime.blockReason).toBe("SANDBOX_MODE");
    expect(injectedOnlySandboxRuntime.activeConfig).toEqual(SANDBOX_DISABLED_FIREBASE_CONFIG);

    // Cas 6B : configuration explicite Sandbox cohérente
    const explicitSandboxRuntime = initializeClientFirebaseRuntime(
      {
        NODE_ENV: "staging",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
      },
      sdkSpy
    );
    expect(explicitSandboxRuntime.sandboxDisabled).toBe(true);
    expect(explicitSandboxRuntime.runtimeDisabled).toBe(true);
    expect(explicitSandboxRuntime.blockReason).toBe("SANDBOX_MODE");

    expect(sdkSpy.initializeApp).not.toHaveBeenCalled();
    expect(sdkSpy.initializeFirestore).not.toHaveBeenCalled();
    expect(sdkSpy.getAuth).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 7. Configuration runtime production explicite -> fonctionnement normal préservé
  // =========================================================================
  it("7. préserve le fonctionnement normal de Firebase client lorsque la configuration runtime production est explicite", () => {
    const fakeApp = {
      name: "[DEFAULT]",
      options: { projectId: EXPECTED_FIREBASE_PROJECT_ID },
    } as unknown as FirebaseApp;
    const fakeDb = { type: "firestore-prod" } as unknown as Firestore;
    const fakeAuth = { name: "auth-prod" } as unknown as Auth;

    const sdkSpy = {
      getApps: vi.fn(() => []),
      getApp: vi.fn(() => fakeApp),
      initializeApp: vi.fn(() => fakeApp),
      initializeFirestore: vi.fn(() => fakeDb),
      getAuth: vi.fn(() => fakeAuth),
    };

    // Cas 7A : variables build/runtime production explicites
    const prodRuntime = initializeClientFirebaseRuntime(
      {
        NODE_ENV: "production",
        PDI_ENV: "production",
        VITE_PDI_ENV: "production",
      },
      sdkSpy
    );
    expect(prodRuntime.sandboxDisabled).toBe(false);
    expect(prodRuntime.runtimeDisabled).toBe(false);
    expect(prodRuntime.blockReason).toBeNull();
    expect(prodRuntime.activeConfig.projectId).toBe(EXPECTED_FIREBASE_PROJECT_ID);
    expect(prodRuntime.activeConfig.firestoreDatabaseId).toBe(EXPECTED_FIRESTORE_DATABASE_ID);
    expect(sdkSpy.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdkSpy.initializeFirestore).toHaveBeenCalledTimes(1);
    expect(sdkSpy.getAuth).toHaveBeenCalledTimes(1);

    // Cas 7B : configuration runtime production injectée par le serveur alors que VITE_PDI_ENV est absent au build
    const sdkSpyInjected = {
      getApps: vi.fn(() => []),
      getApp: vi.fn(() => fakeApp),
      initializeApp: vi.fn(() => fakeApp),
      initializeFirestore: vi.fn(() => fakeDb),
      getAuth: vi.fn(() => fakeAuth),
    };
    const injectedProdRuntime = initializeClientFirebaseRuntime(
      {
        [PDI_RUNTIME_CONFIG_GLOBAL_KEY]: Object.freeze({ pdiEnv: "production" }),
      },
      sdkSpyInjected
    );
    expect(injectedProdRuntime.sandboxDisabled).toBe(false);
    expect(injectedProdRuntime.runtimeDisabled).toBe(false);
    expect(injectedProdRuntime.blockReason).toBeNull();
    expect(injectedProdRuntime.activeConfig.projectId).toBe(EXPECTED_FIREBASE_PROJECT_ID);
    expect(sdkSpyInjected.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdkSpyInjected.initializeFirestore).toHaveBeenCalledTimes(1);
    expect(sdkSpyInjected.getAuth).toHaveBeenCalledTimes(1);

    // Sérialisation HTML en production valide
    const prodConfig = buildPublicBrowserRuntimeConfig({
      NODE_ENV: "production",
      PDI_ENV: "production",
      VITE_PDI_ENV: "production",
    });
    expect(prodConfig).toEqual({ pdiEnv: "production" });
    const serialized = serializePublicRuntimeConfigScript(prodConfig);
    expect(serialized).toBe(
      '<script id="pdi-runtime-config">window.__PDI_RUNTIME_CONFIG__=Object.freeze({"pdiEnv":"production"});</script>'
    );
    const injectedHtml = injectPublicRuntimeConfigIntoHtml("<html><head></head><body></body></html>", prodConfig);
    expect(injectedHtml).toContain(serialized);
  });

  // =========================================================================
  // 8. Mode statique Cloud Run -> zéro serveur Vite démarré
  // =========================================================================
  it("8. ne démarre jamais le serveur de développement Vite en mode statique Cloud Run (NODE_ENV=staging + PDI_SERVE_STATIC_DIST=true)", async () => {
    const distDir = createTemporaryDistDir();
    tempDirs.push(distDir);

    const createViteSpy = vi.fn(async () => {
      throw new Error("Vite MUST NEVER be started in Cloud Run static mode");
    });

    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: true,
      distPath: distDir,
      env: CLOUD_RUN_STAGING_SANDBOX_ENV,
      dependencies: { createViteServer: createViteSpy as any },
    });
    startedServers.push(started);

    expect(createViteSpy).not.toHaveBeenCalled();

    const healthRes = await fetch(`http://127.0.0.1:${started.port}/api/health`);
    expect(healthRes.status).toBe(200);
    expect((await healthRes.json()).status).toBe("ok");
  });

  // =========================================================================
  // 9. Mode statique Cloud Run -> sécurité stricte maintenue (CORS, CSP, trust proxy, health/assets)
  // =========================================================================
  it("9. maintient tous les paramètres de sécurité stricts en mode Cloud Run statique staging (trust proxy, CORS, CSP, /api/health/assets minimisé)", async () => {
    const distDir = createTemporaryDistDir();
    tempDirs.push(distDir);

    // 9A. CSP strict : pas de localhost par défaut, rejet du wildcard '*'
    const defaultStagingCsp = resolveCspFrameAncestors(CLOUD_RUN_STAGING_SANDBOX_ENV);
    expect(defaultStagingCsp.isValid).toBe(true);
    expect(defaultStagingCsp.directive).not.toContain("localhost");
    expect(defaultStagingCsp.directive).not.toContain("127.0.0.1");
    expect(defaultStagingCsp.directive).not.toContain("*");

    const wildcardCsp = resolveCspFrameAncestors({
      ...CLOUD_RUN_STAGING_SANDBOX_ENV,
      CSP_FRAME_ANCESTORS: "*",
    });
    expect(wildcardCsp.isValid).toBe(false);
    expect(() =>
      createPdiExpressApp({
        env: { ...CLOUD_RUN_STAGING_SANDBOX_ENV, CSP_FRAME_ANCESTORS: "*" },
      })
    ).toThrow(/CSP_FRAME_ANCESTORS|Fatal server configuration error/i);

    // 9B. CORS strict : pas de localhost par défaut, rejet wildcard '*' et HTTP localhost
    const defaultOrigins = validateAllowedOrigins(undefined, { isProduction: true });
    expect(defaultOrigins.isValid).toBe(true);
    expect(defaultOrigins.origins.some((o) => o.includes("localhost"))).toBe(false);

    const wildcardOrigins = validateAllowedOrigins("*", { isProduction: true });
    expect(wildcardOrigins.isValid).toBe(false);
    expect(() =>
      createPdiExpressApp({
        env: { ...CLOUD_RUN_STAGING_SANDBOX_ENV, ALLOWED_ORIGINS: "*" },
      })
    ).toThrow(/ALLOWED_ORIGINS|Fatal server configuration error/i);

    // 9C. trust proxy parsé numériquement (1) + en-têtes HTTP + /api/health/assets minimisé
    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: true,
      distPath: distDir,
      env: CLOUD_RUN_STAGING_SANDBOX_ENV,
      dependencies: { createViteServer: vi.fn() as any },
    });
    startedServers.push(started);

    expect(started.app.get("trust proxy")).toBe(1);

    // Défaut trust proxy = 1 même si TRUST_PROXY n'est pas défini en mode Cloud Run statique
    const appWithDefaultProxy = createPdiExpressApp({
      env: {
        NODE_ENV: "staging",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
        PDI_SERVE_STATIC_DIST: "true",
      },
    });
    expect(appWithDefaultProxy.get("trust proxy")).toBe(1);

    const baseUrl = `http://127.0.0.1:${started.port}`;
    const healthAssetsRes = await fetch(`${baseUrl}/api/health/assets`, {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(healthAssetsRes.status).toBe(200);
    expect(healthAssetsRes.headers.get("access-control-allow-origin")).toBeNull();
    expect(healthAssetsRes.headers.get("x-content-type-options")).toBe("nosniff");
    expect(healthAssetsRes.headers.get("strict-transport-security")).toContain("max-age=63072000");

    const cspHeader = healthAssetsRes.headers.get("content-security-policy") || "";
    expect(cspHeader).toContain("frame-ancestors 'self' https://aistudio.google.com");
    expect(cspHeader).not.toContain("http://localhost:3000");
    expect(cspHeader).not.toContain("frame-ancestors *");

    // Réponse /api/health/assets strictement minimisée (aucune fuite de noms de bundles CSS/JS)
    const assetsBody = await healthAssetsRes.json();
    expect(assetsBody).toEqual({ status: "ok", ready: true });
    expect(assetsBody.css).toBeUndefined();
    expect(assetsBody.jsCount).toBeUndefined();
  });

  // =========================================================================
  // 10. Routes sensibles en Sandbox (mode statique Cloud Run) -> mutations refusées 403
  // =========================================================================
  it("10. refuse toutes les routes serveur sensibles (403 sandbox/server-mutation-forbidden) en mode Sandbox Cloud Run statique", async () => {
    const distDir = createTemporaryDistDir();
    tempDirs.push(distDir);

    const dbSpy = vi.fn();
    const adminSpy = vi.fn();

    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: true,
      distPath: distDir,
      env: CLOUD_RUN_STAGING_SANDBOX_ENV,
      dependencies: {
        createViteServer: vi.fn() as any,
        getUserProjects: dbSpy,
        createOrUpdateProject: dbSpy,
        deleteUserProject: dbSpy,
        getOrCreateUser: dbSpy,
        getAdminAuth: adminSpy,
        getAdminDb: adminSpy,
      },
    });
    startedServers.push(started);

    const baseUrl = `http://127.0.0.1:${started.port}`;
    const sensitiveRequests: Array<{ method: string; path: string; body?: unknown }> = [
      { method: "GET", path: "/api/projects" },
      { method: "POST", path: "/api/projects", body: { id: "p-1", name: "Sandbox Test" } },
      { method: "DELETE", path: "/api/projects/p-1" },
      { method: "POST", path: "/api/auth/sync-user", body: { displayName: "Sandbox" } },
      { method: "POST", path: "/api/admin/set-user-role", body: { targetUid: "u1", role: "super_admin" } },
      { method: "POST", path: "/api/payments/orders", body: { planId: "pro_monthly" } },
      { method: "POST", path: "/api/webhooks/paddle", body: { event_type: "transaction.completed" } },
      { method: "POST", path: "/api/webhooks/slickpay", body: { invoice_id: "inv-1" } },
    ];

    for (const reqSpec of sensitiveRequests) {
      const res = await fetch(`${baseUrl}${reqSpec.path}`, {
        method: reqSpec.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer prod-token-simulation",
        },
        body: reqSpec.body ? JSON.stringify(reqSpec.body) : undefined,
      });

      expect(res.status, `${reqSpec.method} ${reqSpec.path}`).toBe(403);
      const payload = await res.json();
      expect(payload.code, `${reqSpec.method} ${reqSpec.path}`).toBe("sandbox/server-mutation-forbidden");
    }

    expect(dbSpy).not.toHaveBeenCalled();
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 11. PostgreSQL -> zéro initialisation
  // =========================================================================
  it("11. garantit zéro initialisation PostgreSQL en mode Cloud Run statique Sandbox", () => {
    expect(shouldBlockServerPostgresInit(CLOUD_RUN_STAGING_SANDBOX_ENV)).toBe(true);

    const gate = evaluateServerPostgresInitGate(CLOUD_RUN_STAGING_SANDBOX_ENV);
    expect(gate.blocked).toBe(true);
    expect(gate.sandboxDisabled).toBe(true);
    expect(gate.blockReason).toBe("SANDBOX_MODE");

    const poolFactorySpy = vi.fn();
    expect(() => createPool(CLOUD_RUN_STAGING_SANDBOX_ENV, poolFactorySpy)).toThrow(
      /Coupe-circuit Sandbox \/ Fail-Closed PostgreSQL/i
    );
    expect(() => getDb(CLOUD_RUN_STAGING_SANDBOX_ENV, poolFactorySpy)).toThrow(
      /Coupe-circuit Sandbox \/ Fail-Closed PostgreSQL/i
    );
    expect(poolFactorySpy).not.toHaveBeenCalled();
    expect(isPostgresPoolInitialized()).toBe(false);
  });

  // =========================================================================
  // 12. Identités synthétiques -> zéro authentification serveur accordée (401)
  // =========================================================================
  it("12. rejette toute identité synthétique (jeton ou header) avec 401 auth/synthetic-identity-forbidden sans jamais appeler Firebase Admin", async () => {
    const adminAuthSpy = vi.fn();
    const requireAuthStaging = createRequireAuth(CLOUD_RUN_STAGING_SANDBOX_ENV, {
      getAdminAuth: adminAuthSpy,
    });

    const invokeMiddleware = async (headers: Record<string, string>) => {
      let statusCode = 200;
      let body: unknown = null;
      const nextSpy = vi.fn();
      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
          return this;
        },
      };
      await requireAuthStaging({ headers } as any, res, nextSpy);
      return { statusCode, body, nextCalled: nextSpy.mock.calls.length > 0 };
    };

    const syntheticBearerResult = await invokeMiddleware({
      authorization: "Bearer sandbox_synthetic_token_engineer_01",
    });
    expect(syntheticBearerResult.statusCode).toBe(401);
    expect((syntheticBearerResult.body as any)?.code).toBe("auth/synthetic-identity-forbidden");
    expect(syntheticBearerResult.nextCalled).toBe(false);

    const syntheticHeaderResult = await invokeMiddleware({
      authorization: "Bearer any-token",
      "x-pdi-sandbox-identity": "sandbox_local_uid_engineer_01",
    });
    expect(syntheticHeaderResult.statusCode).toBe(401);
    expect((syntheticHeaderResult.body as any)?.code).toBe("auth/synthetic-identity-forbidden");
    expect(syntheticHeaderResult.nextCalled).toBe(false);

    expect(adminAuthSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Preuve intégrale en sous-processus isolé Node/tsx avec la configuration cible Cloud Run
  // =========================================================================
  it("démarre le serveur complet dans un processus Node isolé avec la configuration cible Cloud Run (NODE_ENV=staging, PDI_ENV=sandbox, VITE_PDI_ENV=sandbox, TRUST_PROXY=1, PDI_SERVE_STATIC_DIST=true) avec 0 Firebase Admin, 0 PostgreSQL, 0 Vite et injection HTML vérifiée", async () => {
    const distDir = createTemporaryDistDir();
    tempDirs.push(distDir);

    const probeScript = `
      import pg from "pg";
      import { startServer } from "./server.ts";
      import { isServerFirebaseRuntimeDisabled } from "./src/lib/firebase-admin.ts";
      import { evaluateServerPostgresInitGate, isPostgresPoolInitialized } from "./src/db/index.ts";

      (async () => {
        let pgPoolCalls = 0;
        const OrigPool = pg.Pool;
        pg.Pool = new Proxy(OrigPool, {
          construct(target, args, newTarget) {
            pgPoolCalls++;
            return Reflect.construct(target, args, newTarget);
          },
        });

        let viteCalls = 0;
        const started = await startServer({
          host: "127.0.0.1",
          port: 0,
          attachFrontend: true,
          distPath: ${JSON.stringify(distDir)},
          dependencies: {
            createViteServer: async () => {
              viteCalls++;
              throw new Error("Vite forbidden");
            },
          },
        });

        const base = "http://127.0.0.1:" + started.port;
        const htmlRes = await fetch(base + "/");
        const html = await htmlRes.text();
        const assetsRes = await fetch(base + "/api/health/assets");
        const assetsJson = await assetsRes.json();
        const synthRes = await fetch(base + "/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer sandbox_synthetic_token_01" },
          body: JSON.stringify({ name: "Test" }),
        });
        const synthJson = await synthRes.json();

        const projRes = await fetch(base + "/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer prod-token-simulation" },
          body: JSON.stringify({ name: "Test" }),
        });
        const projJson = await projRes.json();

        const report = {
          firebaseAdminDisabled: isServerFirebaseRuntimeDisabled,
          pgGate: evaluateServerPostgresInitGate(),
          pgPoolInitialized: isPostgresPoolInitialized(),
          pgPoolCalls,
          viteCalls,
          trustProxy: started.app.get("trust proxy"),
          htmlStatus: htmlRes.status,
          hasInjectedConfig: html.includes('window.__PDI_RUNTIME_CONFIG__=Object.freeze({"pdiEnv":"sandbox"});'),
          assetsJson,
          csp: htmlRes.headers.get("content-security-policy"),
          synthStatus: synthRes.status,
          synthCode: synthJson.code,
          projStatus: projRes.status,
          projCode: projJson.code,
        };

        await started.close();
        console.log("__FIX_ENV_02_PROBE__" + JSON.stringify(report));
      })().catch((err) => {
        console.error(err);
        process.exit(1);
      });
    `;

    const cleanEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "staging",
      PDI_ENV: "sandbox",
      VITE_PDI_ENV: "sandbox",
      TRUST_PROXY: "1",
      PDI_SERVE_STATIC_DIST: "true",
      PDI_SERVER_NO_AUTOSTART: "1",
    };

    const tsxBin = path.resolve(process.cwd(), "node_modules", ".bin", "tsx");
    const { stdout } = await execFileAsync(tsxBin, ["-e", probeScript], {
      cwd: process.cwd(),
      env: cleanEnv,
      timeout: 30000,
    });

    const marker = "__FIX_ENV_02_PROBE__";
    const line = stdout.split("\n").find((l) => l.includes(marker));
    expect(line).toBeDefined();
    const report = JSON.parse(line!.slice(line!.indexOf(marker) + marker.length));

    expect(report.firebaseAdminDisabled).toBe(true);
    expect(report.pgGate.blocked).toBe(true);
    expect(report.pgGate.blockReason).toBe("SANDBOX_MODE");
    expect(report.pgPoolInitialized).toBe(false);
    expect(report.pgPoolCalls).toBe(0);
    expect(report.viteCalls).toBe(0);
    expect(report.trustProxy).toBe(1);
    expect(report.htmlStatus).toBe(200);
    expect(report.hasInjectedConfig).toBe(true);
    expect(report.assetsJson).toEqual({ status: "ok", ready: true });
    expect(report.csp).not.toContain("http://localhost:3000");
    expect(report.csp).not.toContain("frame-ancestors *");
    expect(report.synthStatus).toBe(401);
    expect(report.synthCode).toBe("auth/synthetic-identity-forbidden");
    expect(report.projStatus).toBe(403);
    expect(report.projCode).toBe("sandbox/server-mutation-forbidden");
  }, 35000);
});
