/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * STAGING-00-B4 — SUITE DE VALIDATION DU DÉMARRAGE COMPLET EN SANDBOX
 *
 * Couvre les 15 contrôles obligatoires B4-T01 .. B4-T15 ainsi que les 6 scénarios
 * négatifs fail-closed B4-F en exécutant le véritable code serveur (`server.ts`),
 * les véritables modules DB (`src/db/index.ts`, `projects.ts`, `users.ts`),
 * le véritable module Firebase Admin (`src/lib/firebase-admin.ts`), et le véritable
 * rendu React (`PdiUnifiedApp` + `StagingSandboxBanner`).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import util from "node:util";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";

import {
  SANDBOX_BANNER_LINES,
  SANDBOX_STORAGE_PREFIX,
  getSandboxSyntheticAuthUser,
  getSandboxSyntheticProfile,
  getSandboxSyntheticRole,
  isStagingSandboxMode,
  resetSandboxLocalStorageOnly,
  resolveScopedStorageKey,
  sandboxStorageGetItem,
  sandboxStorageRemoveItem,
  sandboxStorageSetItem,
  setSandboxSyntheticRole,
  setStagingSandboxTestOverride,
  toSandboxStorageKey,
} from "../../lib/stagingSandbox";
import {
  SANDBOX_POSTGRES_FORBIDDEN_ERROR,
  createPool,
  db,
  evaluateServerPostgresInitGate,
  getDb,
  isPostgresPoolInitialized,
  resetPostgresRuntimeForTests,
  shouldBlockServerPostgresInit,
} from "../../db/index";
import { projects } from "../../db/schema";
import {
  EXPECTED_SERVER_DATABASE_ID,
  EXPECTED_SERVER_PROJECT_ID,
  evaluateServerFirebaseInitGate,
  initializeServerFirebaseAdminRuntime,
  shouldBlockServerFirebaseInit,
} from "../../lib/firebase-admin";
import { verifyProductionConfig } from "../sec01SecurityService";
import PdiUnifiedApp, {
  StagingSandboxBanner,
  pdiReadProjectIndex,
  pdiRemoveProject,
  pdiUpsertProject,
} from "../../pdi/app/PdiUnifiedApp";
import { startServer } from "../../../server";

interface FullSandboxBootProbeResult {
  bootSucceeded: boolean;
  boundHost: string;
  boundPort: number;
  firebaseAdminAppsCount: number;
  firebaseRuntimeDisabled: boolean;
  firebaseSandboxDisabled: boolean;
  firebaseBlockReason: string | null;
  firebaseConfig: unknown;
  postgresPoolInitialized: boolean;
  pgPoolConstructedCount: number;
  pgPoolConnectCalls: number;
  pgPoolQueryCalls: number;
  postgresDirectCallBlocked: boolean;
  projectsModuleCallBlocked: boolean;
  usersModuleCallBlocked: boolean;
  externalHttpCalls: string[];
  externalTcpCalls: string[];
  externalFetchCalls: string[];
  routeResults: Record<string, { status: number; body: Record<string, unknown> }>;
  syntheticTokenResult: { status: number; body: Record<string, unknown> };
  syntheticHeaderResult: { status: number; body: Record<string, unknown> };
  syntheticPaymentResult: { status: number; body: Record<string, unknown> };
}

function runIsolatedFullSandboxServerBootProbe(): FullSandboxBootProbeResult {
  const probeScript = `
    import { createRequire } from 'node:module';
    import http from 'node:http';
    import https from 'node:https';
    import net from 'node:net';

    const require = createRequire(import.meta.url);

    // 1. Instrumentation PostgreSQL (pg.Pool constructor + connect + query) AVANT tout import applicatif
    const pgMod = require('pg');
    const OriginalPool = pgMod.Pool;
    const pgMetrics = {
      constructed: 0,
      connectCalls: 0,
      queryCalls: 0,
    };

    const origConnect = OriginalPool.prototype.connect;
    const origQuery = OriginalPool.prototype.query;
    OriginalPool.prototype.connect = function (...args) {
      pgMetrics.connectCalls += 1;
      return origConnect.apply(this, args);
    };
    OriginalPool.prototype.query = function (...args) {
      pgMetrics.queryCalls += 1;
      return origQuery.apply(this, args);
    };

    class InstrumentedPool extends OriginalPool {
      constructor(...args) {
        pgMetrics.constructed += 1;
        super(...args);
      }
    }
    pgMod.Pool = InstrumentedPool;
    if (pgMod.default && typeof pgMod.default === 'object') {
      pgMod.default.Pool = InstrumentedPool;
    }

    // 2. Instrumentation réseau stricte (autorise uniquement 127.0.0.1 sur le port du serveur de test)
    let allowedTestPort = null;
    const externalHttpCalls = [];
    const externalTcpCalls = [];
    const externalFetchCalls = [];

    const isAllowedLocalTarget = (host, port) => {
      const h = String(host || '').toLowerCase();
      const isLoopback = h === '127.0.0.1' || h === 'localhost' || h === '::1';
      if (!isLoopback) return false;
      if (allowedTestPort === null) return false;
      return Number(port) === Number(allowedTestPort);
    };

    const origHttpRequest = http.request;
    const origHttpsRequest = https.request;
    const origSocketConnect = net.Socket.prototype.connect;
    const origFetch = globalThis.fetch;

    http.request = function (input, ...rest) {
      let host = '';
      let port = 80;
      if (typeof input === 'string') {
        const u = new URL(input);
        host = u.hostname;
        port = Number(u.port || 80);
      } else if (input instanceof URL) {
        host = input.hostname;
        port = Number(input.port || 80);
      } else if (input && typeof input === 'object') {
        host = input.hostname || input.host || '';
        port = Number(input.port || 80);
      }
      if (!isAllowedLocalTarget(host, port)) {
        externalHttpCalls.push('http://' + host + ':' + port);
        throw new Error('EXTERNAL_HTTP_BLOCKED: ' + host + ':' + port);
      }
      return origHttpRequest.call(this, input, ...rest);
    };

    https.request = function (input, ...rest) {
      const target = typeof input === 'string' ? input : (input?.hostname || input?.host || 'https-unknown');
      externalHttpCalls.push('https://' + target);
      throw new Error('EXTERNAL_HTTPS_BLOCKED: ' + target);
    };

    net.Socket.prototype.connect = function (...args) {
      let host = '';
      let port = 0;
      const first = args[0];
      if (Array.isArray(first) && first[0] && typeof first[0] === 'object') {
        host = first[0].host || first[0].hostname || '127.0.0.1';
        port = Number(first[0].port || 0);
      } else if (first && typeof first === 'object') {
        host = first.host || first.hostname || '127.0.0.1';
        port = Number(first.port || 0);
      } else if (typeof first === 'number') {
        port = first;
        host = typeof args[1] === 'string' ? args[1] : '127.0.0.1';
      }
      if (!isAllowedLocalTarget(host, port)) {
        externalTcpCalls.push(host + ':' + port);
        throw new Error('EXTERNAL_TCP_BLOCKED: ' + host + ':' + port);
      }
      return origSocketConnect.apply(this, args);
    };

    globalThis.fetch = async function (input, init) {
      const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input?.url || '');
      const u = new URL(urlStr);
      const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
      if (u.protocol !== 'http:' || !isAllowedLocalTarget(u.hostname, port)) {
        externalFetchCalls.push(urlStr);
        throw new Error('EXTERNAL_FETCH_BLOCKED: ' + urlStr);
      }
      return origFetch(input, init);
    };

    // 3. Import réel des modules serveur, Firebase Admin, et PostgreSQL
    const { getApps } = await import('firebase-admin/app');
    const firebaseAdminMod = await import('./src/lib/firebase-admin.ts');
    const dbIndexMod = await import('./src/db/index.ts');
    const dbProjectsMod = await import('./src/db/projects.ts');
    const dbUsersMod = await import('./src/db/users.ts');
    const serverMod = await import('./server.ts');

    // 4. Démarrage réel du serveur Express sur 127.0.0.1 port libre (0)
    const started = await serverMod.startServer({
      host: '127.0.0.1',
      port: 0,
      attachFrontend: false,
    });
    allowedTestPort = started.port;

    const baseUrl = 'http://127.0.0.1:' + started.port;

    const callRoute = async (method, routePath, headers = {}, body = undefined) => {
      const init = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      const res = await fetch(baseUrl + routePath, init);
      let jsonBody = {};
      try {
        jsonBody = await res.json();
      } catch {
        jsonBody = {};
      }
      return { status: res.status, body: jsonBody };
    };

    const routeResults = {
      'GET /api/health': await callRoute('GET', '/api/health'),
      'GET /healthz': await callRoute('GET', '/healthz'),
      'POST /api/auth/sync-user': await callRoute('POST', '/api/auth/sync-user', {}, { displayName: 'Test' }),
      'GET /api/projects': await callRoute('GET', '/api/projects'),
      'POST /api/projects': await callRoute('POST', '/api/projects', {}, { name: 'Iso Test' }),
      'DELETE /api/projects/123': await callRoute('DELETE', '/api/projects/123'),
      'POST /api/admin/set-user-role': await callRoute('POST', '/api/admin/set-user-role', {}, { targetUid: 'u1', role: 'admin' }),
      'POST /api/payments/orders': await callRoute('POST', '/api/payments/orders', {}, { plan: 'pro' }),
      'POST /api/webhooks/paddle': await callRoute('POST', '/api/webhooks/paddle', {}, { event_type: 'transaction.completed' }),
      'POST /api/webhooks/slickpay': await callRoute('POST', '/api/webhooks/slickpay', {}, { status: 'paid' }),
    };

    // Rejet des identités synthétiques (HTTP 401 auth/synthetic-identity-forbidden)
    const syntheticTokenResult = await callRoute('GET', '/api/projects', {
      Authorization: 'Bearer sandbox_synthetic_token_client_local_only',
    });
    const syntheticHeaderResult = await callRoute('POST', '/api/auth/sync-user', {
      'X-PDI-Sandbox-Identity': 'sandbox_local_uid_engineer_01',
    }, { displayName: 'Synth' });
    const syntheticPaymentResult = await callRoute('POST', '/api/payments/orders', {
      Authorization: 'Bearer sandbox_synthetic_token_client_local_only',
    }, { plan: 'pro' });

    // Vérification qu'un appel direct aux fonctions DB échoue en fail-closed AVANT new Pool()
    let postgresDirectCallBlocked = false;
    try {
      dbIndexMod.createPool();
    } catch (err) {
      postgresDirectCallBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox / Fail-Closed PostgreSQL');
    }

    let projectsModuleCallBlocked = false;
    try {
      await dbProjectsMod.getUserProjects('sandbox_local_uid_engineer_01');
    } catch (err) {
      projectsModuleCallBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox / Fail-Closed PostgreSQL');
    }

    let usersModuleCallBlocked = false;
    try {
      await dbUsersMod.getOrCreateUser('sandbox_local_uid_engineer_01', 'sandbox@orthogonal-pdi.invalid');
    } catch (err) {
      usersModuleCallBlocked = String(err?.message || '').includes('Coupe-circuit Sandbox / Fail-Closed PostgreSQL');
    }

    await started.close();

    console.log(JSON.stringify({
      bootSucceeded: true,
      boundHost: started.host,
      boundPort: started.port,
      firebaseAdminAppsCount: getApps().length,
      firebaseRuntimeDisabled: firebaseAdminMod.isServerFirebaseRuntimeDisabled,
      firebaseSandboxDisabled: firebaseAdminMod.isServerFirebaseSandboxDisabled,
      firebaseBlockReason: firebaseAdminMod.serverFirebaseBlockReason,
      firebaseConfig: firebaseAdminMod.serverFirebaseRuntimeConfig,
      postgresPoolInitialized: dbIndexMod.isPostgresPoolInitialized(),
      pgPoolConstructedCount: pgMetrics.constructed,
      pgPoolConnectCalls: pgMetrics.connectCalls,
      pgPoolQueryCalls: pgMetrics.queryCalls,
      postgresDirectCallBlocked,
      projectsModuleCallBlocked,
      usersModuleCallBlocked,
      externalHttpCalls,
      externalTcpCalls,
      externalFetchCalls,
      routeResults,
      syntheticTokenResult,
      syntheticHeaderResult,
      syntheticPaymentResult,
    }));
  `;

  const cleanSandboxEnv: Record<string, string> = {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    NODE_ENV: "development",
    PDI_ENV: "sandbox",
    VITE_PDI_ENV: "sandbox",
    PDI_SERVER_NO_AUTOSTART: "1",
  };

  const rawOutput = execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", probeScript],
    {
      cwd: process.cwd(),
      env: cleanSandboxEnv,
      encoding: "utf-8",
      timeout: 30_000,
    },
  );

  const lastLine = rawOutput.trim().split("\n").pop() || "{}";
  return JSON.parse(lastLine) as FullSandboxBootProbeResult;
}

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
    },
  };
}

describe("STAGING-00-B4 — Validation du démarrage complet Sandbox (B4-T01 .. B4-T15)", () => {
  let sandboxBootProbe: FullSandboxBootProbeResult;

  beforeAll(() => {
    sandboxBootProbe = runIsolatedFullSandboxServerBootProbe();
  }, 35_000);

  beforeEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  afterEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  it("B4-T01 — Import serveur en Sandbox : aucun démarrage Firebase Admin / Firestore", () => {
    expect(sandboxBootProbe.firebaseAdminAppsCount).toBe(0);
    expect(sandboxBootProbe.firebaseRuntimeDisabled).toBe(true);
    expect(sandboxBootProbe.firebaseSandboxDisabled).toBe(true);
    expect(sandboxBootProbe.firebaseBlockReason).toBe("SANDBOX_MODE");
    expect(sandboxBootProbe.firebaseConfig).toBeNull();
  });

  it("B4-T02 — Import des modules DB (index.ts, projects.ts, users.ts) : aucun new Pool()", () => {
    expect(sandboxBootProbe.postgresPoolInitialized).toBe(false);
    expect(sandboxBootProbe.pgPoolConstructedCount).toBe(0);
  });

  it("B4-T03 — Démarrage réel du serveur Express Sandbox sur 127.0.0.1 et port libre", () => {
    expect(sandboxBootProbe.bootSucceeded).toBe(true);
    expect(sandboxBootProbe.boundHost).toBe("127.0.0.1");
    expect(sandboxBootProbe.boundPort).toBeGreaterThan(0);
  });

  it("B4-T04 — Health checks (/api/health et /healthz) : HTTP 200", () => {
    expect(sandboxBootProbe.routeResults["GET /api/health"].status).toBe(200);
    expect(sandboxBootProbe.routeResults["GET /api/health"].body).toEqual(
      expect.objectContaining({ status: "ok", service: "pdi-industrial-cad" }),
    );
    expect(sandboxBootProbe.routeResults["GET /healthz"].status).toBe(200);
    expect(sandboxBootProbe.routeResults["GET /healthz"].body).toEqual(
      expect.objectContaining({ status: "ok" }),
    );
  });

  it("B4-T05 — Routes projets (GET / POST / DELETE /api/projects) : HTTP 403", () => {
    expect(sandboxBootProbe.routeResults["GET /api/projects"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["GET /api/projects"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
    expect(sandboxBootProbe.routeResults["POST /api/projects"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["POST /api/projects"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
    expect(sandboxBootProbe.routeResults["DELETE /api/projects/123"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["DELETE /api/projects/123"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
  });

  it("B4-T06 — Route POST /api/auth/sync-user : HTTP 403", () => {
    expect(sandboxBootProbe.routeResults["POST /api/auth/sync-user"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["POST /api/auth/sync-user"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
  });

  it("B4-T07 — Route POST /api/admin/set-user-role : HTTP 403", () => {
    expect(sandboxBootProbe.routeResults["POST /api/admin/set-user-role"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["POST /api/admin/set-user-role"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
  });

  it("B4-T08 — Routes paiements et webhooks (orders, paddle, slickpay) : HTTP 403", () => {
    expect(sandboxBootProbe.routeResults["POST /api/payments/orders"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["POST /api/payments/orders"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
    expect(sandboxBootProbe.routeResults["POST /api/webhooks/paddle"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["POST /api/webhooks/paddle"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
    expect(sandboxBootProbe.routeResults["POST /api/webhooks/slickpay"].status).toBe(403);
    expect(sandboxBootProbe.routeResults["POST /api/webhooks/slickpay"].body.code).toBe(
      "sandbox/server-mutation-forbidden",
    );
  });

  it("B4-T09 — Identité synthétique (jeton Bearer et en-tête X-PDI-Sandbox-Identity) : HTTP 401 auth/synthetic-identity-forbidden", () => {
    expect(sandboxBootProbe.syntheticTokenResult.status).toBe(401);
    expect(sandboxBootProbe.syntheticTokenResult.body.code).toBe(
      "auth/synthetic-identity-forbidden",
    );
    expect(sandboxBootProbe.syntheticHeaderResult.status).toBe(401);
    expect(sandboxBootProbe.syntheticHeaderResult.body.code).toBe(
      "auth/synthetic-identity-forbidden",
    );
    expect(sandboxBootProbe.syntheticPaymentResult.status).toBe(401);
    expect(sandboxBootProbe.syntheticPaymentResult.body.code).toBe(
      "auth/synthetic-identity-forbidden",
    );
  });

  it("B4-T10 — PostgreSQL : zéro Pool, zéro connect(), zéro query() et appels directs bloqués fail-closed", () => {
    expect(sandboxBootProbe.pgPoolConstructedCount).toBe(0);
    expect(sandboxBootProbe.pgPoolConnectCalls).toBe(0);
    expect(sandboxBootProbe.pgPoolQueryCalls).toBe(0);
    expect(sandboxBootProbe.postgresDirectCallBlocked).toBe(true);
    expect(sandboxBootProbe.projectsModuleCallBlocked).toBe(true);
    expect(sandboxBootProbe.usersModuleCallBlocked).toBe(true);
  });

  it("B4-T11 — Appel réseau externe : zéro appel HTTP, HTTPS, TCP ou fetch hors 127.0.0.1:<testPort>", () => {
    expect(sandboxBootProbe.externalHttpCalls).toEqual([]);
    expect(sandboxBootProbe.externalTcpCalls).toEqual([]);
    expect(sandboxBootProbe.externalFetchCalls).toEqual([]);
  });

  it("B4-T12 — Bannière Sandbox réelle : visible et non dismissible dès l'entrée, sur l'écran de connexion et dans l'espace de travail lors des changements de module ; identité locale sans privilège Super Admin", () => {
    const memoryStorage = createMemoryStorage();
    const originalWindow = (globalThis as any).window;
    const originalLocalStorage = (globalThis as any).localStorage;
    const originalDocument = (globalThis as any).document;

    const stubWindow = {
      localStorage: memoryStorage,
      location: {
        hash: "",
        search: "",
        pathname: "/",
        href: "http://127.0.0.1/",
        origin: "http://127.0.0.1",
        reload: () => {},
      },
      innerWidth: 1440,
      innerHeight: 900,
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
      history: {
        replaceState: () => {},
        pushState: () => {},
      },
    };

    try {
      (globalThis as any).window = stubWindow;
      (globalThis as any).localStorage = memoryStorage;
      (globalThis as any).document = {
        documentElement: { setAttribute: () => {}, style: {} },
        body: { style: {} },
        title: "",
      };

      setStagingSandboxTestOverride(true);

      const assertValidBannerMarkup = (html: string) => {
        expect(html).toContain('data-testid="pdi-staging-sandbox-banner"');
        expect(html).toContain('data-dismissible="false"');
        for (const mandatoryLine of [
          "ENVIRONNEMENT SANDBOX DE TEST — AI STUDIO SHARE",
          "DONNÉES SYNTHÉTIQUES LOCALES",
          "FIREBASE PRODUCTION DÉSACTIVÉ",
          "STAGING-00-B4 — ENVIRONNEMENT DE TEST",
        ]) {
          expect(html).toContain(mandatoryLine);
        }

        // Extraire le bloc exact du bandeau (jusqu'à la fin de ses 2 sous-divs) et vérifier qu'aucun bouton ne permet de le masquer
        const bannerStart = html.indexOf('<div data-testid="pdi-staging-sandbox-banner"');
        expect(bannerStart).toBeGreaterThanOrEqual(0);
        const bannerEndMarker = 'Réinitialiser données Sandbox</button></div></div>';
        const bannerEnd = html.indexOf(bannerEndMarker, bannerStart);
        expect(bannerEnd).toBeGreaterThan(bannerStart);
        const bannerHtml = html.slice(bannerStart, bannerEnd + bannerEndMarker.length);

        const buttonsInBanner = bannerHtml.match(/<button\b[^>]*>.*?<\/button>/g) ?? [];
        // Uniquement le bouton de réinitialisation Sandbox, zéro bouton de fermeture/masquage
        expect(buttonsInBanner).toHaveLength(1);
        expect(buttonsInBanner[0]).toContain('data-testid="pdi-sandbox-reset-button"');
        expect(buttonsInBanner[0].toLowerCase()).not.toMatch(/fermer|masquer|dismiss|close/);

        expect(bannerHtml).not.toContain("Simulation UI Admin");
        expect(bannerHtml).toContain("aucun privilège Super Admin");
      };

      // 1. Rendu direct du composant StagingSandboxBanner
      const directBannerHtml = renderToStaticMarkup(
        React.createElement(StagingSandboxBanner, { onResetSandboxTestData: () => {} }),
      );
      assertValidBannerMarkup(directBannerHtml);

      // 2. Rendu réel de PdiUnifiedApp sur l'écran d'accueil (stage = landing)
      memoryStorage.setItem(toSandboxStorageKey("pdi.stage.v4"), "landing");
      const landingHtml = renderToStaticMarkup(React.createElement(PdiUnifiedApp));
      assertValidBannerMarkup(landingHtml);

      // 3. Rendu réel de PdiUnifiedApp sur l'écran de connexion (stage = auth)
      memoryStorage.setItem(toSandboxStorageKey("pdi.stage.v4"), "auth");
      const authHtml = renderToStaticMarkup(React.createElement(PdiUnifiedApp));
      assertValidBannerMarkup(authHtml);

      // 4. Rendu réel de PdiUnifiedApp dans l'espace de travail — module "home"
      memoryStorage.setItem(toSandboxStorageKey("pdi.stage.v4"), "workspace");
      memoryStorage.setItem(toSandboxStorageKey("pdi.activeModule.v1"), "home");
      const workspaceHomeHtml = renderToStaticMarkup(React.createElement(PdiUnifiedApp));
      assertValidBannerMarkup(workspaceHomeHtml);

      // 5. Rendu réel de PdiUnifiedApp après changement de module ("projects" puis "profile")
      memoryStorage.setItem(toSandboxStorageKey("pdi.activeModule.v1"), "projects");
      const workspaceProjectsHtml = renderToStaticMarkup(React.createElement(PdiUnifiedApp));
      assertValidBannerMarkup(workspaceProjectsHtml);

      memoryStorage.setItem(toSandboxStorageKey("pdi.activeModule.v1"), "profile");
      const workspaceProfileHtml = renderToStaticMarkup(React.createElement(PdiUnifiedApp));
      assertValidBannerMarkup(workspaceProfileHtml);

      // 6. Vérification que l'identité synthétique locale ne possède AUCUN privilège Super Admin
      setSandboxSyntheticRole("client", memoryStorage);
      expect(getSandboxSyntheticRole(memoryStorage)).toBe("client");
      const profile = getSandboxSyntheticProfile();
      expect(profile.role).toBe("client");
      expect(profile.role).not.toBe("super_admin");
      const authUser = getSandboxSyntheticAuthUser();
      expect(authUser.uid.startsWith("sandbox_local_uid_")).toBe(true);

      // 7. Hors Sandbox : le bandeau Sandbox ne s'affiche pas
      setStagingSandboxTestOverride(false);
      memoryStorage.setItem("pdi.stage.v4", "landing");
      const prodLandingHtml = renderToStaticMarkup(React.createElement(PdiUnifiedApp));
      expect(prodLandingHtml).not.toContain('data-testid="pdi-staging-sandbox-banner"');
      expect(prodLandingHtml).not.toContain("ENVIRONNEMENT SANDBOX DE TEST — AI STUDIO SHARE");
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).localStorage = originalLocalStorage;
      (globalThis as any).document = originalDocument;
    }
  });

  it("B4-T13 — Stockage Sandbox : préfixe pdi.sandbox.staging.v1. strictement respecté sur lecture, écriture et suppression sans toucher les clés historiques de production", () => {
    const memoryStorage = createMemoryStorage();
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { localStorage: memoryStorage };

    try {
      const prodIndexKey = "pdi.projects.index.v1";
      const prodAutosaveKey = "isometrie.autosave.v474.user.real_uid_01.project.prod-100.current";
      const prodIndexValue = JSON.stringify([
        { projectId: "prod-100", title: "Collecteur Production", module: "isometric", updatedAt: "2026-01-01T00:00:00Z" },
      ]);
      const prodAutosaveValue = JSON.stringify({ project: { name: "Collecteur Production" } });

      memoryStorage.setItem(prodIndexKey, prodIndexValue);
      memoryStorage.setItem(prodAutosaveKey, prodAutosaveValue);

      const sandboxEnv = {
        NODE_ENV: "development",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
      };

      expect(resolveScopedStorageKey(prodIndexKey, sandboxEnv)).toBe(
        `${SANDBOX_STORAGE_PREFIX}${prodIndexKey}`,
      );

      // Écriture isolée en Sandbox
      sandboxStorageSetItem("custom.setting.v1", "val-sandbox", memoryStorage, sandboxEnv);
      expect(memoryStorage.getItem(`${SANDBOX_STORAGE_PREFIX}custom.setting.v1`)).toBe("val-sandbox");
      expect(memoryStorage.getItem("custom.setting.v1")).toBeNull();
      expect(sandboxStorageGetItem("custom.setting.v1", memoryStorage, sandboxEnv)).toBe("val-sandbox");

      // Upsert + suppression projet dans l'espace Sandbox
      pdiUpsertProject(
        { projectId: "sbx-200", title: "Ligne Sandbox B4", module: "isometric" },
        sandboxEnv,
      );
      expect(pdiReadProjectIndex(sandboxEnv).some((p) => p.projectId === "sbx-200")).toBe(true);

      pdiRemoveProject("sbx-200", sandboxEnv);
      expect(pdiReadProjectIndex(sandboxEnv).some((p) => p.projectId === "sbx-200")).toBe(false);

      // Suppression isolée Sandbox + purge complète Sandbox
      sandboxStorageRemoveItem("custom.setting.v1", memoryStorage, sandboxEnv);
      expect(memoryStorage.getItem(`${SANDBOX_STORAGE_PREFIX}custom.setting.v1`)).toBeNull();

      resetSandboxLocalStorageOnly(memoryStorage);

      // Aucune clé Sandbox restante
      for (let i = 0; i < memoryStorage.length; i++) {
        const key = memoryStorage.key(i);
        expect(key?.startsWith(SANDBOX_STORAGE_PREFIX)).toBe(false);
      }

      // Clés historiques de production 100 % préservées
      expect(memoryStorage.getItem(prodIndexKey)).toBe(prodIndexValue);
      expect(memoryStorage.getItem(prodAutosaveKey)).toBe(prodAutosaveValue);
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it("B4-T14 — Protection C5 & scénarios négatifs B4-F : bloque Firebase Admin et PostgreSQL sur les 6 configurations interdites et refuse Sandbox en production", () => {
    const forbiddenScenarios: Array<{
      name: string;
      env: Record<string, string>;
      expectedBlockReason: string;
    }> = [
      {
        name: "1. PDI_ENV absent (VITE_PDI_ENV=sandbox)",
        env: { NODE_ENV: "development", VITE_PDI_ENV: "sandbox" },
        expectedBlockReason: "SANDBOX_MODE",
      },
      {
        name: "2. VITE_PDI_ENV absent (PDI_ENV=sandbox)",
        env: { NODE_ENV: "development", PDI_ENV: "sandbox" },
        expectedBlockReason: "SANDBOX_MODE",
      },
      {
        name: "3. Valeurs différentes (PDI_ENV=development, VITE_PDI_ENV=production)",
        env: { NODE_ENV: "development", PDI_ENV: "development", VITE_PDI_ENV: "production" },
        expectedBlockReason: "FRONTEND_SERVER_ENV_MISMATCH",
      },
      {
        name: "4. Valeur inconnue (PDI_ENV=unknown_env)",
        env: { NODE_ENV: "development", PDI_ENV: "unknown_env", VITE_PDI_ENV: "unknown_env" },
        expectedBlockReason: "AMBIGUOUS_PDI_ENV",
      },
      {
        name: "5. Sandbox avec NODE_ENV=production (C5)",
        env: { NODE_ENV: "production", PDI_ENV: "sandbox", VITE_PDI_ENV: "sandbox" },
        expectedBlockReason: "SANDBOX_FORBIDDEN_IN_PRODUCTION",
      },
      {
        name: "6. Configuration incomplète (PDI_ENV absent et VITE_PDI_ENV absent)",
        env: { NODE_ENV: "development" },
        expectedBlockReason: "INCOMPLETE_PDI_ENV",
      },
    ];

    for (const scenario of forbiddenScenarios) {
      // Garde Firebase Admin
      expect(shouldBlockServerFirebaseInit(scenario.env)).toBe(true);
      const fbGate = evaluateServerFirebaseInitGate(scenario.env);
      expect(fbGate.blocked).toBe(true);
      expect(fbGate.blockReason).toBe(scenario.expectedBlockReason);

      const fbInitSpy = vi.fn();
      const fbAuthSpy = vi.fn();
      const fbFsSpy = vi.fn();
      const fbRuntime = initializeServerFirebaseAdminRuntime(scenario.env, {
        getApps: vi.fn(() => []) as any,
        initializeApp: fbInitSpy as any,
        getAuth: fbAuthSpy as any,
        createFirestore: fbFsSpy as any,
      });
      expect(fbRuntime.runtimeDisabled).toBe(true);
      expect(fbRuntime.config).toBeNull();
      expect(fbInitSpy).not.toHaveBeenCalled();
      expect(fbAuthSpy).not.toHaveBeenCalled();
      expect(fbFsSpy).not.toHaveBeenCalled();

      // Garde PostgreSQL
      expect(shouldBlockServerPostgresInit(scenario.env)).toBe(true);
      const pgGate = evaluateServerPostgresInitGate(scenario.env);
      expect(pgGate.blocked).toBe(true);
      expect(pgGate.blockReason).toBe(scenario.expectedBlockReason);

      const pgFactorySpy = vi.fn();
      expect(() => createPool(scenario.env, pgFactorySpy)).toThrow(
        SANDBOX_POSTGRES_FORBIDDEN_ERROR,
      );
      expect(() => getDb(scenario.env, pgFactorySpy)).toThrow(
        SANDBOX_POSTGRES_FORBIDDEN_ERROR,
      );
      expect(pgFactorySpy).not.toHaveBeenCalled();
      expect(isPostgresPoolInitialized()).toBe(false);
    }

    // Protection C5 spécifique : verifyProductionConfig refuse formellement Sandbox en production
    const prodSandboxCheck = verifyProductionConfig({
      NODE_ENV: "production",
      PDI_ENV: "sandbox",
      VITE_PDI_ENV: "sandbox",
    });
    expect(prodSandboxCheck.isSafe).toBe(false);
    expect(prodSandboxCheck.hasFatalSandboxConfigError).toBe(true);
    expect(
      isStagingSandboxMode({
        NODE_ENV: "production",
        PDI_ENV: "sandbox",
        VITE_PDI_ENV: "sandbox",
      }),
    ).toBe(false);
  });

  it("B4-T15 — Non-régression hors Sandbox : configuration cohérente de développement avec dépendances simulées (PostgreSQL lazy, Firebase Admin nominal, serveur Express opérationnel)", async () => {
    const coherentDevEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      PDI_ENV: "development",
      VITE_PDI_ENV: "development",
      FIREBASE_PROJECT_ID: EXPECTED_SERVER_PROJECT_ID,
      FIREBASE_DATABASE_ID: EXPECTED_SERVER_DATABASE_ID,
      SQL_HOST: "127.0.0.1",
      SQL_USER: "dev_user",
      SQL_PASSWORD: "dev_synthetic_local_password",
      SQL_DB_NAME: "pdi_dev_local",
    };

    // 1. Garde PostgreSQL autorise la création lazy avec une fabrique simulée (aucune connexion réseau réelle)
    expect(shouldBlockServerPostgresInit(coherentDevEnv)).toBe(false);
    const simulatedPool = {
      on: vi.fn(),
      query: vi.fn(),
      connect: vi.fn(),
      end: vi.fn(),
    } as any;
    const poolFactorySpy = vi.fn(() => simulatedPool);

    const createdPool = createPool(coherentDevEnv, poolFactorySpy);
    expect(createdPool).toBe(simulatedPool);
    expect(poolFactorySpy).toHaveBeenCalledTimes(1);
    expect(poolFactorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "127.0.0.1",
        user: "dev_user",
        database: "pdi_dev_local",
      }),
    );
    expect(isPostgresPoolInitialized()).toBe(true);
    const lazyDb = getDb(coherentDevEnv, poolFactorySpy);
    expect(lazyDb).toBeDefined();
    // Le cache global évite une seconde construction de Pool
    expect(poolFactorySpy).toHaveBeenCalledTimes(1);

    // 2. Garde Firebase Admin autorise l'initialisation nominale avec espions
    expect(shouldBlockServerFirebaseInit(coherentDevEnv)).toBe(false);
    const fakeApp = { name: "[DEFAULT]", options: { projectId: EXPECTED_SERVER_PROJECT_ID } };
    const fakeAuth = { verifyIdToken: vi.fn() };
    const fakeFirestore = {
      projectId: EXPECTED_SERVER_PROJECT_ID,
      databaseId: EXPECTED_SERVER_DATABASE_ID,
      _settings: {
        projectId: EXPECTED_SERVER_PROJECT_ID,
        databaseId: EXPECTED_SERVER_DATABASE_ID,
      },
    } as any;

    const fbRuntime = initializeServerFirebaseAdminRuntime(coherentDevEnv, {
      getApps: vi.fn(() => []) as any,
      initializeApp: vi.fn(() => fakeApp) as any,
      getAuth: vi.fn(() => fakeAuth) as any,
      createFirestore: vi.fn(() => fakeFirestore),
    });
    expect(fbRuntime.runtimeDisabled).toBe(false);
    expect(fbRuntime.sandboxDisabled).toBe(false);
    expect(fbRuntime.config).toEqual({
      projectId: EXPECTED_SERVER_PROJECT_ID,
      databaseId: EXPECTED_SERVER_DATABASE_ID,
    });

    // 3. Démarrage du vrai serveur Express hors Sandbox sur 127.0.0.1:0 avec dépendances simulées
    const prevPdiEnv = process.env.PDI_ENV;
    const prevVitePdiEnv = process.env.VITE_PDI_ENV;
    process.env.PDI_ENV = "development";
    process.env.VITE_PDI_ENV = "development";

    const getUserProjectsMock = vi.fn(async (uid: string) => [
      { id: 1, uid, name: "Ligne Dev Simulée" },
    ]);

    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: false,
      env: coherentDevEnv,
      dependencies: {
        requireAuthMiddleware: (req: any, _res, next) => {
          req.user = {
            uid: "dev_uid_01",
            email: "dev@orthogonal.invalid",
            email_verified: true,
            role: "client",
          };
          next();
        },
        getAdminAuth: () => fakeAuth as any,
        getAdminDb: () => fakeFirestore,
        getUserProjects: getUserProjectsMock as any,
      },
    });

    try {
      const baseUrl = `http://127.0.0.1:${started.port}`;

      const healthRes = await fetch(`${baseUrl}/api/health`);
      expect(healthRes.status).toBe(200);

      // Hors Sandbox, une requête authentifiée accède normalement au handler /api/projects simulé
      const projectsRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: "Bearer simulated.valid.dev.jwt" },
      });
      expect(projectsRes.status).toBe(200);
      const projectsBody = (await projectsRes.json()) as { projects: Array<{ name: string }> };
      expect(projectsBody.projects).toHaveLength(1);
      expect(projectsBody.projects[0].name).toBe("Ligne Dev Simulée");
      expect(getUserProjectsMock).toHaveBeenCalledWith("dev_uid_01");

      // Même hors Sandbox, un jeton synthétique reste strictement rejeté (401 auth/synthetic-identity-forbidden)
      const synthRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: "Bearer sandbox_synthetic_token_client_local_only" },
      });
      expect(synthRes.status).toBe(401);
      const synthBody = (await synthRes.json()) as { code?: string };
      expect(synthBody.code).toBe("auth/synthetic-identity-forbidden");
    } finally {
      await started.close();
      if (prevPdiEnv === undefined) delete process.env.PDI_ENV;
      else process.env.PDI_ENV = prevPdiEnv;
      if (prevVitePdiEnv === undefined) delete process.env.VITE_PDI_ENV;
      else process.env.VITE_PDI_ENV = prevVitePdiEnv;
    }
  });
});

describe("STAGING-00-B4 FIX-01 — Cohérence stricte de runtimeEnv dans createPdiExpressApp() / server.ts", () => {
  const restoreEnvVar = (key: string, prev: string | undefined) => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };

  beforeEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  afterEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  it("FIX01-T01 — runtimeEnv=sandbox et process.env=development : bloque toutes les routes sensibles (403) et rejette toute identité synthétique (401) sans exécuter les dépendances", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPdiEnv = process.env.PDI_ENV;
    const prevVitePdiEnv = process.env.VITE_PDI_ENV;

    process.env.NODE_ENV = "development";
    process.env.PDI_ENV = "development";
    process.env.VITE_PDI_ENV = "development";

    const sandboxRuntimeEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      PDI_ENV: "sandbox",
      VITE_PDI_ENV: "sandbox",
    };

    const authSpy = vi.fn((_req, _res, next) => next());
    const adminAuthSpy = vi.fn();
    const adminDbSpy = vi.fn();
    const getUserProjectsSpy = vi.fn();
    const createOrUpdateProjectSpy = vi.fn();
    const deleteUserProjectSpy = vi.fn();
    const getOrCreateUserSpy = vi.fn();

    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: false,
      env: sandboxRuntimeEnv,
      dependencies: {
        requireAuthMiddleware: authSpy,
        getAdminAuth: adminAuthSpy as any,
        getAdminDb: adminDbSpy as any,
        getUserProjects: getUserProjectsSpy as any,
        createOrUpdateProject: createOrUpdateProjectSpy as any,
        deleteUserProject: deleteUserProjectSpy as any,
        getOrCreateUser: getOrCreateUserSpy as any,
      },
    });

    try {
      const baseUrl = `http://127.0.0.1:${started.port}`;

      // 1. Santé opérationnelle
      const healthRes = await fetch(`${baseUrl}/api/health`);
      expect(healthRes.status).toBe(200);

      // 2. Toutes les routes sensibles doivent renvoyer 403 sandbox/server-mutation-forbidden
      const sensitiveRequests: Array<{ method: string; path: string; body?: unknown }> = [
        { method: "GET", path: "/api/projects" },
        { method: "POST", path: "/api/projects", body: { name: "Blocked Iso" } },
        { method: "DELETE", path: "/api/projects/42" },
        { method: "POST", path: "/api/auth/sync-user", body: { displayName: "Blocked User" } },
        { method: "POST", path: "/api/admin/set-user-role", body: { targetUid: "u1", role: "admin" } },
        { method: "POST", path: "/api/payments/orders", body: { plan: "pro" } },
        { method: "POST", path: "/api/webhooks/paddle", body: { event_type: "transaction.completed" } },
        { method: "POST", path: "/api/webhooks/slickpay", body: { status: "paid" } },
      ];

      for (const reqSpec of sensitiveRequests) {
        const res = await fetch(`${baseUrl}${reqSpec.path}`, {
          method: reqSpec.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer simulated.valid.dev.jwt",
          },
          body: reqSpec.body ? JSON.stringify(reqSpec.body) : undefined,
        });
        expect(res.status, `${reqSpec.method} ${reqSpec.path}`).toBe(403);
        const json = (await res.json()) as { code?: string };
        expect(json.code, `${reqSpec.method} ${reqSpec.path}`).toBe(
          "sandbox/server-mutation-forbidden",
        );
      }

      // 3. Identité synthétique (jeton Bearer et en-tête X-PDI-Sandbox-Identity) -> 401 auth/synthetic-identity-forbidden
      for (const route of [
        { method: "GET", path: "/api/projects" },
        { method: "POST", path: "/api/auth/sync-user", body: { displayName: "Synth" } },
        { method: "POST", path: "/api/admin/set-user-role", body: { targetUid: "u1", role: "admin" } },
        { method: "POST", path: "/api/payments/orders", body: { plan: "pro" } },
        { method: "POST", path: "/api/webhooks/paddle", body: { event_type: "transaction.completed" } },
        { method: "POST", path: "/api/webhooks/slickpay", body: { status: "paid" } },
      ]) {
        const tokenRes = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sandbox_synthetic_token_client_local_only",
          },
          body: route.body ? JSON.stringify(route.body) : undefined,
        });
        expect(tokenRes.status, `Bearer synthetic on ${route.method} ${route.path}`).toBe(401);
        expect(((await tokenRes.json()) as { code?: string }).code).toBe(
          "auth/synthetic-identity-forbidden",
        );

        const headerRes = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: {
            "Content-Type": "application/json",
            "X-PDI-Sandbox-Identity": "sandbox_local_uid_engineer_01",
          },
          body: route.body ? JSON.stringify(route.body) : undefined,
        });
        expect(headerRes.status, `Header synthetic on ${route.method} ${route.path}`).toBe(401);
        expect(((await headerRes.json()) as { code?: string }).code).toBe(
          "auth/synthetic-identity-forbidden",
        );
      }

      // 4. Aucune dépendance backend ni middleware auth n'a été invoqué
      expect(authSpy).not.toHaveBeenCalled();
      expect(adminAuthSpy).not.toHaveBeenCalled();
      expect(adminDbSpy).not.toHaveBeenCalled();
      expect(getUserProjectsSpy).not.toHaveBeenCalled();
      expect(createOrUpdateProjectSpy).not.toHaveBeenCalled();
      expect(deleteUserProjectSpy).not.toHaveBeenCalled();
      expect(getOrCreateUserSpy).not.toHaveBeenCalled();
    } finally {
      await started.close();
      restoreEnvVar("NODE_ENV", prevNodeEnv);
      restoreEnvVar("PDI_ENV", prevPdiEnv);
      restoreEnvVar("VITE_PDI_ENV", prevVitePdiEnv);
    }
  });

  it("FIX01-T02 — runtimeEnv=development et process.env=sandbox : suit runtimeEnv pour toutes les routes sensibles et rejette toujours les identités synthétiques (401)", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPdiEnv = process.env.PDI_ENV;
    const prevVitePdiEnv = process.env.VITE_PDI_ENV;

    // process.env est volontairement en mode Sandbox pour prouver l'absence de fuite implicite
    process.env.NODE_ENV = "development";
    process.env.PDI_ENV = "sandbox";
    process.env.VITE_PDI_ENV = "sandbox";

    const devRuntimeEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      PDI_ENV: "development",
      VITE_PDI_ENV: "development",
      FIREBASE_PROJECT_ID: EXPECTED_SERVER_PROJECT_ID,
      FIREBASE_DATABASE_ID: EXPECTED_SERVER_DATABASE_ID,
    };

    const storedOrders: Array<Record<string, unknown>> = [];
    const verifyIdTokenSpy = vi.fn(async (token: string) => {
      if (token === "simulated.valid.superadmin.jwt") {
        return {
          uid: "dev_superadmin_01",
          email: "superadmin@orthogonal.invalid",
          email_verified: true,
          role: "super_admin",
          name: "Dev SuperAdmin",
        };
      }
      throw new Error("Invalid simulated token");
    });
    const setCustomUserClaimsSpy = vi.fn(async () => undefined);
    const fakeAdminAuth = {
      verifyIdToken: verifyIdTokenSpy,
      setCustomUserClaims: setCustomUserClaimsSpy,
    };
    const fakeAdminDb = {
      collection: vi.fn((_name: string) => ({
        doc: vi.fn((docId: string) => ({
          id: docId,
          set: vi.fn(async (data: Record<string, unknown>) => {
            storedOrders.push(data);
          }),
          get: vi.fn(async () => ({ exists: false, data: () => undefined })),
        })),
      })),
      runTransaction: vi.fn(async (fn: any) => fn({ get: vi.fn(), set: vi.fn() })),
    };

    const getUserProjectsSpy = vi.fn(async (uid: string) => [
      { id: 10, uid, name: "Iso Dev Runtime" },
    ]);
    const createOrUpdateProjectSpy = vi.fn(async (uid: string, payload: any) => ({
      id: 11,
      uid,
      name: payload?.name || "Created",
    }));
    const deleteUserProjectSpy = vi.fn(async () => [{ id: 10 }]);
    const getOrCreateUserSpy = vi.fn(async (uid: string, email: string) => ({
      uid,
      email,
    }));

    // Note : on NE remplace PAS requireAuthMiddleware afin de tester le vrai createRequireAuth(runtimeEnv)
    const started = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: false,
      env: devRuntimeEnv,
      dependencies: {
        getAdminAuth: () => fakeAdminAuth as any,
        getAdminDb: () => fakeAdminDb as any,
        getUserProjects: getUserProjectsSpy as any,
        createOrUpdateProject: createOrUpdateProjectSpy as any,
        deleteUserProject: deleteUserProjectSpy as any,
        getOrCreateUser: getOrCreateUserSpy as any,
      },
    });

    try {
      const baseUrl = `http://127.0.0.1:${started.port}`;
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: "Bearer simulated.valid.superadmin.jwt",
      };

      // 1. Routes projets, sync-user et administration suivent runtimeEnv=development (jamais 403 sandbox)
      const getProjectsRes = await fetch(`${baseUrl}/api/projects`, { headers: authHeaders });
      expect(getProjectsRes.status).toBe(200);
      expect(getUserProjectsSpy).toHaveBeenCalledWith("dev_superadmin_01");

      const postProjectRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: "Collecteur Dev" }),
      });
      expect(postProjectRes.status).toBe(200);
      expect(createOrUpdateProjectSpy).toHaveBeenCalledTimes(1);

      const deleteProjectRes = await fetch(`${baseUrl}/api/projects/10`, {
        method: "DELETE",
        headers: authHeaders,
      });
      expect(deleteProjectRes.status).toBe(200);
      expect(deleteUserProjectSpy).toHaveBeenCalledWith("dev_superadmin_01", 10);

      const syncUserRes = await fetch(`${baseUrl}/api/auth/sync-user`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ displayName: "Dev SuperAdmin" }),
      });
      expect(syncUserRes.status).toBe(200);
      expect(getOrCreateUserSpy).toHaveBeenCalledTimes(1);

      const adminRoleRes = await fetch(`${baseUrl}/api/admin/set-user-role`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ targetUid: "target_uid_02", role: "admin" }),
      });
      expect(adminRoleRes.status).toBe(200);
      expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("target_uid_02", { role: "admin" });

      // 2. Routes paiements et webhooks suivent runtimeEnv=development (pas de 403 sandbox)
      const orderRes = await fetch(`${baseUrl}/api/payments/orders`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ plan: "pro", billingCycle: "yearly", countryCode: "FR" }),
      });
      expect(orderRes.status).toBe(201);
      expect(storedOrders).toHaveLength(1);

      const paddleRes = await fetch(`${baseUrl}/api/webhooks/paddle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "transaction.completed" }),
      });
      expect(paddleRes.status).not.toBe(403);

      const slickpayRes = await fetch(`${baseUrl}/api/webhooks/slickpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      expect(slickpayRes.status).not.toBe(403);

      // 3. Identité synthétique reste strictement rejetée (401) sur toutes les routes sensibles
      verifyIdTokenSpy.mockClear();
      for (const route of [
        { method: "GET", path: "/api/projects" },
        { method: "POST", path: "/api/auth/sync-user", body: { displayName: "Synth" } },
        { method: "POST", path: "/api/admin/set-user-role", body: { targetUid: "u1", role: "admin" } },
        { method: "POST", path: "/api/payments/orders", body: { plan: "pro" } },
        { method: "POST", path: "/api/webhooks/paddle", body: { event_type: "transaction.completed" } },
        { method: "POST", path: "/api/webhooks/slickpay", body: { status: "paid" } },
      ]) {
        const tokenRes = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sandbox_synthetic_token_client_local_only",
          },
          body: route.body ? JSON.stringify(route.body) : undefined,
        });
        expect(tokenRes.status, `Bearer synthetic on ${route.method} ${route.path}`).toBe(401);
        expect(((await tokenRes.json()) as { code?: string }).code).toBe(
          "auth/synthetic-identity-forbidden",
        );

        const headerRes = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: {
            "Content-Type": "application/json",
            "X-PDI-Sandbox-Identity": "sandbox_local_uid_engineer_01",
          },
          body: route.body ? JSON.stringify(route.body) : undefined,
        });
        expect(headerRes.status, `Header synthetic on ${route.method} ${route.path}`).toBe(401);
        expect(((await headerRes.json()) as { code?: string }).code).toBe(
          "auth/synthetic-identity-forbidden",
        );
      }
      expect(verifyIdTokenSpy).not.toHaveBeenCalled();
    } finally {
      await started.close();
      restoreEnvVar("NODE_ENV", prevNodeEnv);
      restoreEnvVar("PDI_ENV", prevPdiEnv);
      restoreEnvVar("VITE_PDI_ENV", prevVitePdiEnv);
    }
  });

  it("FIX01-T03 — rejectWhenFirebaseRuntimeDisabled suit runtimeEnv (503 fail-closed hors Sandbox même si process.env=sandbox) et préserve le comportement normal avec process.env par défaut", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPdiEnv = process.env.PDI_ENV;
    const prevVitePdiEnv = process.env.VITE_PDI_ENV;

    process.env.NODE_ENV = "development";
    process.env.PDI_ENV = "sandbox";
    process.env.VITE_PDI_ENV = "sandbox";

    // Cas A : runtimeEnv incomplet (non-sandbox, fail-closed) alors que process.env=sandbox -> 503 (et non 403 sandbox)
    const failClosedServer = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: false,
      env: { NODE_ENV: "development" },
    });

    // Cas B : options.env omis -> runtimeEnv === process.env (Sandbox) -> 403 sandbox
    const defaultEnvServer = await startServer({
      host: "127.0.0.1",
      port: 0,
      attachFrontend: false,
    });

    try {
      const failClosedBase = `http://127.0.0.1:${failClosedServer.port}`;
      for (const routePath of [
        "/api/payments/orders",
        "/api/webhooks/paddle",
        "/api/webhooks/slickpay",
      ]) {
        const normalRes = await fetch(`${failClosedBase}${routePath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        expect(normalRes.status, `Fail-closed ${routePath}`).toBe(503);
        expect(((await normalRes.json()) as { code?: string }).code).toBe(
          "server/firebase-runtime-disabled",
        );

        const synthRes = await fetch(`${failClosedBase}${routePath}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sandbox_synthetic_token_client_local_only",
          },
          body: JSON.stringify({}),
        });
        expect(synthRes.status, `Synthetic on fail-closed ${routePath}`).toBe(401);
        expect(((await synthRes.json()) as { code?: string }).code).toBe(
          "auth/synthetic-identity-forbidden",
        );
      }

      const defaultBase = `http://127.0.0.1:${defaultEnvServer.port}`;
      const defaultProjectsRes = await fetch(`${defaultBase}/api/projects`);
      expect(defaultProjectsRes.status).toBe(403);
      expect(((await defaultProjectsRes.json()) as { code?: string }).code).toBe(
        "sandbox/server-mutation-forbidden",
      );

      const defaultOrderRes = await fetch(`${defaultBase}/api/payments/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      expect(defaultOrderRes.status).toBe(403);
      expect(((await defaultOrderRes.json()) as { code?: string }).code).toBe(
        "sandbox/server-mutation-forbidden",
      );
    } finally {
      await failClosedServer.close();
      await defaultEnvServer.close();
      restoreEnvVar("NODE_ENV", prevNodeEnv);
      restoreEnvVar("PDI_ENV", prevPdiEnv);
      restoreEnvVar("VITE_PDI_ENV", prevVitePdiEnv);
    }
  });
});

describe("STAGING-00-B4 FIX-02 — Compatibilité complète du proxy PostgreSQL paresseux `db`", () => {
  const restoreEnvVar = (key: string, prev: string | undefined) => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };

  beforeEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  afterEach(() => {
    setStagingSandboxTestOverride(null);
    resetPostgresRuntimeForTests();
  });

  it("FIX02-T01 — L'import et l'inspection du proxy `db` ne créent aucun Pool et toute opération est bloquée en mode Sandbox", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPdiEnv = process.env.PDI_ENV;
    const prevVitePdiEnv = process.env.VITE_PDI_ENV;

    try {
      process.env.NODE_ENV = "development";
      process.env.PDI_ENV = "sandbox";
      process.env.VITE_PDI_ENV = "sandbox";

      // 1. Aucun Pool créé à l'import ni lors d'opérations d'inspection / Promise.resolve
      expect(isPostgresPoolInitialized()).toBe(false);
      expect(Object.prototype.toString.call(db)).toBe("[object LazyPostgresDrizzleDb]");
      expect(await Promise.resolve(db)).toBe(db);
      expect(() => util.inspect(db)).not.toThrow();
      expect(isPostgresPoolInitialized()).toBe(false);

      // 2. En Sandbox, tout accès propriété, méthode ou opérateur `in` échoue fail-closed avant `new Pool()`
      expect(() => (db as any).select).toThrow(SANDBOX_POSTGRES_FORBIDDEN_ERROR);
      expect(() => (db as any).query).toThrow(SANDBOX_POSTGRES_FORBIDDEN_ERROR);
      expect(() => (db as any).insert).toThrow(SANDBOX_POSTGRES_FORBIDDEN_ERROR);
      expect(() => (db as any).$client).toThrow(SANDBOX_POSTGRES_FORBIDDEN_ERROR);
      expect(() => "select" in db).toThrow(SANDBOX_POSTGRES_FORBIDDEN_ERROR);
      expect(() => "query" in db).toThrow(SANDBOX_POSTGRES_FORBIDDEN_ERROR);
      expect(isPostgresPoolInitialized()).toBe(false);
    } finally {
      restoreEnvVar("NODE_ENV", prevNodeEnv);
      restoreEnvVar("PDI_ENV", prevPdiEnv);
      restoreEnvVar("VITE_PDI_ENV", prevVitePdiEnv);
    }
  });

  it("FIX02-T02 — Hors Sandbox : le proxy `db` transmet les propriétés Drizzle, préserve le contexte `this` (direct et déstructuré) et reste 100 % compatible avec les anciens consommateurs", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPdiEnv = process.env.PDI_ENV;
    const prevVitePdiEnv = process.env.VITE_PDI_ENV;

    try {
      process.env.NODE_ENV = "development";
      process.env.PDI_ENV = "development";
      process.env.VITE_PDI_ENV = "development";

      const querySpy = vi.fn(async (_queryConfig: unknown) => ({
        rows: [
          [
            77,
            "legacy_uid_01",
            "Ligne Legacy Proxy",
            "Test compatibilité proxy Drizzle",
            "isometric",
            "draft",
            null,
            null,
            null,
            null,
            new Date("2026-06-01T10:00:00.000Z"),
            new Date("2026-06-01T10:00:00.000Z"),
          ],
        ],
        rowCount: 1,
      }));

      const simulatedPool = {
        on: vi.fn(),
        query: querySpy,
        connect: vi.fn(),
        end: vi.fn(),
      } as any;

      const poolFactorySpy = vi.fn(() => simulatedPool);

      // Amorçage lazy du singleton Drizzle avec le Pool simulé (zéro connexion réseau réelle)
      const activeDrizzle = getDb(process.env, poolFactorySpy);
      expect(poolFactorySpy).toHaveBeenCalledTimes(1);
      expect(isPostgresPoolInitialized()).toBe(true);

      // 1. Propriétés et opérateur `in` correctement transmis
      expect("select" in db).toBe(true);
      expect("insert" in db).toBe(true);
      expect("update" in db).toBe(true);
      expect("delete" in db).toBe(true);
      expect("query" in db).toBe(true);
      expect("$client" in db).toBe(true);

      expect((db as unknown as Record<string, unknown>).$client).toBe(simulatedPool);
      expect((db as unknown as Record<string, unknown>).dialect).toBe(
        (activeDrizzle as unknown as Record<string, unknown>).dialect,
      );
      expect((db as unknown as Record<string, unknown>).session).toBe(
        (activeDrizzle as unknown as Record<string, unknown>).session,
      );
      expect(db._).toBe(activeDrizzle._);
      expect(db.query.projects).toBeDefined();
      expect(db.query.users).toBeDefined();
      expect(db.query.driveFiles).toBeDefined();
      expect(() => util.inspect(db)).not.toThrow();

      // 2. Méthodes Drizzle directes et déstructurées conservent le bon contexte `this`
      const { select, insert, update, delete: deleteFrom } = db;

      const directSelectSql = db
        .select()
        .from(projects)
        .where(eq(projects.uid, "legacy_uid_01"))
        .toSQL();
      const destructuredSelectSql = select()
        .from(projects)
        .where(eq(projects.uid, "legacy_uid_01"))
        .toSQL();
      expect(destructuredSelectSql).toEqual(directSelectSql);
      expect(directSelectSql.sql).toContain('from "projects"');
      expect(directSelectSql.params).toEqual(["legacy_uid_01"]);

      const insertSql = insert(projects)
        .values({ uid: "legacy_uid_01", name: "Ligne Insert Proxy" })
        .toSQL();
      expect(insertSql.sql).toContain('insert into "projects"');

      const updateSql = update(projects)
        .set({ name: "Ligne Update Proxy" })
        .where(eq(projects.id, 77))
        .toSQL();
      expect(updateSql.sql).toContain('update "projects" set');

      const deleteSql = deleteFrom(projects).where(eq(projects.id, 77)).toSQL();
      expect(deleteSql.sql).toContain('delete from "projects"');

      // 3. Exécution réelle d'une requête d'ancien consommateur via `db` et mapping Drizzle complet
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.uid, "legacy_uid_01"));
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          id: 77,
          uid: "legacy_uid_01",
          name: "Ligne Legacy Proxy",
          module: "isometric",
          status: "draft",
        }),
      );
      // Toujours un seul Pool créé pour toute la durée du test
      expect(poolFactorySpy).toHaveBeenCalledTimes(1);
    } finally {
      restoreEnvVar("NODE_ENV", prevNodeEnv);
      restoreEnvVar("PDI_ENV", prevPdiEnv);
      restoreEnvVar("VITE_PDI_ENV", prevVitePdiEnv);
    }
  });
});

