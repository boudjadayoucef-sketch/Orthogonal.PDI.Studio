/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * SECURE ENTERPRISE CAD APPLICATION SERVER.
 * UNAUTHORIZED DUPLICATION OR USAGE IS STRICTLY PROHIBITED.
 */

import "dotenv/config";
import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import path from "path";
// PATCH 017G : inspection reelle du dossier dist/assets.
import fs from "fs";
import type { createServer as CreateViteServerFn } from "vite";
import {
  createRequireAuth,
  requireSuperAdmin,
  requireEmailVerified,
  createRejectInStagingSandboxMode,
  AuthRequest,
} from "./src/middleware/auth.ts";
import {
  getServerAdminAuth,
  getServerAdminDb,
  isServerFirebaseRuntimeDisabled,
  shouldBlockServerFirebaseInit,
} from "./src/lib/firebase-admin.ts";
import {
  buildPublicBrowserRuntimeConfig,
  injectPublicRuntimeConfigIntoHtml,
  isStagingSandboxMode,
} from "./src/lib/stagingSandbox.ts";
import { 
  createBoundedRateLimiter,
  verifyProductionConfig,
  resolveServerDeliveryMode,
  resolveTrustProxyConfig,
  buildContentSecurityPolicy,
  isSuspiciousRequestPath,
  validateAllowedOrigins,
  createPaddleWebhookBodyParser,
  createStandardJsonParser,
  createStandardUrlencodedParser,
  createGlobalExpressErrorHandler
} from "./src/security/sec01SecurityService.ts";
import { createPendingOrderRepository } from "./src/security/webhooks/pendingOrderRepository.ts";
import { createWebhookIdempotencyRepository } from "./src/security/webhooks/webhookIdempotencyRepository.ts";
import { createPaymentWebhookProcessor } from "./src/security/webhooks/paymentWebhookProcessor.ts";
import { createPaddleWebhookHandler } from "./src/security/webhooks/paddleWebhookHandler.ts";
import { createSlickPayWebhookHandler } from "./src/security/webhooks/slickPayWebhookHandler.ts";
import { createPendingOrderRoute } from "./src/security/payments/pendingOrderRoute.ts";
import { 
  getUserProjects, 
  createOrUpdateProject, 
  deleteUserProject, 
  getDriveFiles, 
  saveDriveFileRecord 
} from "./src/db/projects.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import {
  createRequireSupabaseAuth,
  requireSupabaseSuperAdmin,
  resolveSupabaseServerAuthGateway,
  verifySupabaseSessionFromBearerToken,
  type SupabaseAuthRequest,
  type SupabaseServerAuthGateway,
} from "./src/server/supabaseAuth.ts";

export interface PdiServerDependencies {
  requireAuthMiddleware?: express.RequestHandler;
  getAdminAuth?: typeof getServerAdminAuth;
  getAdminDb?: typeof getServerAdminDb;
  supabaseAuthGateway?: SupabaseServerAuthGateway;
  getUserProjects?: typeof getUserProjects;
  createOrUpdateProject?: typeof createOrUpdateProject;
  deleteUserProject?: typeof deleteUserProject;
  getOrCreateUser?: typeof getOrCreateUser;
  createViteServer?: typeof CreateViteServerFn;
}

export interface CreatePdiExpressAppOptions {
  env?: NodeJS.ProcessEnv;
  mountErrorHandler?: boolean;
  mountApiNotFoundHandler?: boolean;
  dependencies?: PdiServerDependencies;
}

export interface StartServerOptions {
  host?: string;
  port?: number;
  attachFrontend?: boolean;
  distPath?: string;
  env?: NodeJS.ProcessEnv;
  dependencies?: PdiServerDependencies;
}

export interface StartedPdiServer {
  app: express.Express;
  server: Server;
  host: string;
  port: number;
  close: () => Promise<void>;
}

// Keep unused DB helpers explicitly referenced without invoking PostgreSQL
void getDriveFiles;
void saveDriveFileRecord;

/**
 * VERCEL-API-01 :
 * Garantit qu'une route `/api/*` inconnue retourne toujours un JSON 404 strict
 * (jamais de HTML frontend ni de chemin réfléchi).
 */
export function createApiNotFoundHandler(): express.RequestHandler {
  return (_req, res) => {
    res.status(404).json({
      error: "Not Found: Unknown API endpoint",
      code: "api/not-found",
    });
  };
}

/**
 * STAGING-00-B4-C :
 * Construit la véritable application Express avec tous les middlewares de sécurité,
 * les routes santé, les routes protégées et le coupe-circuit Sandbox/Fail-Closed.
 */
export function createPdiExpressApp(options: CreatePdiExpressAppOptions = {}): express.Express {
  const runtimeEnv = options.env ?? process.env;
  const deps = options.dependencies ?? {};

  // Validation sûre de la configuration au démarrage (Section D2, Protection C5 & FIX-ENV-02)
  const deliveryMode = resolveServerDeliveryMode(runtimeEnv);
  const configValidation = verifyProductionConfig(runtimeEnv);
  if (!configValidation.isSafe) {
    if (
      deliveryMode.strictSecurityMode ||
      configValidation.hasFatalSandboxConfigError ||
      !deliveryMode.isValid
    ) {
      throw new Error(configValidation.errorMessage || "Fatal server configuration error");
    } else {
      console.warn("[SECURITY WARN] Development configuration note:", configValidation.errorMessage);
    }
  }

  const app = express();

  // Hardening & Security Middleware ORTHOGONAL - ENG
  app.disable("x-powered-by");

  // Protection Globale contre Path Traversal, Dotfiles et sondes de fichiers sensibles (SEC-01-FIX-02)
  app.use((req, res, next) => {
    if (isSuspiciousRequestPath(req.originalUrl || req.url)) {
      return res.status(403).type("text/plain").send("Forbidden: Invalid request path or file probe");
    }
    next();
  });

  // Configuration explicite et validée Trust Proxy pour Cloud Run / Hostinger VPS / Nginx / LiteSpeed (Section E1, FIX-ENV-02 & FIX-ENV-03)
  const trustProxyResolution = resolveTrustProxyConfig(runtimeEnv.TRUST_PROXY, {
    strictSecurityMode: deliveryMode.strictSecurityMode,
  });
  app.set("trust proxy", trustProxyResolution.value);

  // Whitelist CORS dynamique contrôlée et validée via environnement (Section E2, SEC-01-FIX-07-R1 D1.2 & FIX-ENV-02)
  const allowedOriginsValidation = validateAllowedOrigins(runtimeEnv.ALLOWED_ORIGINS, {
    isProduction: deliveryMode.strictSecurityMode,
    appUrl: runtimeEnv.APP_URL
  });
  const ALLOWED_ORIGINS = allowedOriginsValidation.origins;

  // In-Memory Rate Limiter BORNÉ pour protéger l'API sans fuite mémoire (Section F1)
  const apiRateLimiter = createBoundedRateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 100, // Max 100 requêtes/min par IP
    maxEntries: 5000 // Borne supérieure stricte
  });

  // Middleware Global de Sécurité (Headers, CORS, CSP, HSTS)
  app.use((req, res, next) => {
    // CORS sécurisé dynamique
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Paddle-Signature,X-SlickPay-Signature,X-Signature");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    // Headers de sécurité
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

    // Content-Security-Policy durcie et centralisée (SEC-01-FIX-07-R1 D1.1, FIX-ENV-02 & FIX-ENV-03)
    const cspPolicy = buildContentSecurityPolicy(runtimeEnv);
    res.setHeader("Content-Security-Policy", cspPolicy.headerValue);
    res.setHeader("X-Engine-Vendor", "ORTHOGONAL - ENG");
    res.setHeader("X-Engine-Product", "Piping Design & Isometrics");
    next();
  });

  // Appliquer le rate limiter borné sur toutes les requêtes API (Section F1)
  app.use("/api", apiRateLimiter.middleware());

  // Limites strictes des corps HTTP (256kb max, sans capture rawBody globale — SEC-01-FIX-07-R1 D2.1)
  app.use(createStandardJsonParser());
  app.use(createStandardUrlencodedParser());

  // Endpoints santé minimaux (Section E5)
  const handleHealthCheck = (_req: express.Request, res: express.Response) => {
    res.json({
      status: "ok",
      service: "pdi-industrial-cad",
      vendor: "ORTHOGONAL - ENG",
      engineVersion: "4.8d",
      timestamp: new Date().toISOString()
    });
  };
  app.get("/api/health", handleHealthCheck);
  app.get("/healthz", handleHealthCheck);

  const sandboxGuard = createRejectInStagingSandboxMode(runtimeEnv);
  const resolveAdminAuth = deps.getAdminAuth ?? getServerAdminAuth;
  const resolveAdminDb = deps.getAdminDb ?? getServerAdminDb;

  let cachedSupabaseGateway: ReturnType<typeof resolveSupabaseServerAuthGateway> = null;
  const getSupabaseGateway = () => {
    if (!cachedSupabaseGateway) {
      cachedSupabaseGateway = resolveSupabaseServerAuthGateway(
        runtimeEnv,
        deps.supabaseAuthGateway
      );
    }
    return cachedSupabaseGateway;
  };

  const supabaseAuthMiddleware = createRequireSupabaseAuth(runtimeEnv, {
    gateway: deps.supabaseAuthGateway,
  });

  const verifySupabaseTokenForRoutes = async (token: string) => {
    const resolved = getSupabaseGateway();
    if (!resolved) {
      return null;
    }
    return verifySupabaseSessionFromBearerToken(token, {
      gateway: resolved.gateway,
      expectedSupabaseUrl: resolved.expectedSupabaseUrl,
    });
  };

  // MIG-05-FIX-01 : Authentification Supabase stricte (sans fallback Firebase) pour /api/auth/sync-user et /api/projects
  const strictSupabaseApiAuthMiddleware =
    deps.requireAuthMiddleware ??
    createRequireAuth(runtimeEnv, {
      allowFirebaseFallback: false,
      expectedSupabaseUrl: runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL,
      verifySupabaseToken: verifySupabaseTokenForRoutes,
    });

  // Fallback Firebase conservé exclusivement pour la route héritée POST /api/admin/set-user-role
  const authMiddleware =
    deps.requireAuthMiddleware ??
    createRequireAuth(runtimeEnv, {
      allowFirebaseFallback: true,
      getAdminAuth: resolveAdminAuth,
      expectedSupabaseUrl: runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL,
      verifySupabaseToken: verifySupabaseTokenForRoutes,
    });
  const fetchProjects = deps.getUserProjects ?? getUserProjects;
  const upsertProject = deps.createOrUpdateProject ?? createOrUpdateProject;
  const removeProject = deps.deleteUserProject ?? deleteUserProject;
  const syncUser = deps.getOrCreateUser ?? getOrCreateUser;

  // =========================================================================
  // MIG-04-AUTH-01 : Routes sécurisées Supabase Auth & Console Super Admin
  // =========================================================================
  app.get(
    "/api/auth/supabase/session",
    sandboxGuard,
    supabaseAuthMiddleware,
    (req: SupabaseAuthRequest, res) => {
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        ok: true,
        session: req.supabaseSession,
      });
    }
  );

  app.get(
    "/api/admin/supabase/overview",
    sandboxGuard,
    supabaseAuthMiddleware,
    requireSupabaseSuperAdmin,
    async (req: SupabaseAuthRequest, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        const session = req.supabaseSession;
        const resolved = getSupabaseGateway();
        if (!session || !resolved || !resolved.gateway.getSuperAdminOverview) {
          return res.status(503).json({
            error: "Service Unavailable: Supabase Super Admin overview gateway is not configured.",
            code: "server/supabase-auth-unconfigured",
          });
        }
        const overview = await resolved.gateway.getSuperAdminOverview(session);
        return res.json({
          ok: true,
          overview,
        });
      } catch (err: any) {
        console.error("Error loading Supabase Super Admin overview:", err?.message || "unknown");
        return res.status(500).json({
          error: "Internal server error while loading Supabase Super Admin overview.",
          code: "server/supabase-admin-overview-failed",
        });
      }
    }
  );

  // Cloud SQL User Sync & Projects Endpoints (MIG-05-FIX-01: strict Supabase auth + C2 sandboxGuard)
  app.post("/api/auth/sync-user", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || "unknown@domain.com";
      if (!uid) return res.status(401).json({ error: "Missing user uid" });

      const user = await syncUser(
        uid,
        email,
        req.body?.displayName || req.user?.name,
        req.body?.photoUrl || req.user?.picture
      );
      res.json({ user });
    } catch (err: any) {
      console.error("Error syncing user to Cloud SQL:", err);
      res.status(500).json({ error: "Failed to sync user profile." });
    }
  });

  // Admin: Assign Custom Claims (Role) securely via Firebase Admin SDK (Section A3 & Protection C2)
  app.post("/api/admin/set-user-role", sandboxGuard, authMiddleware, requireSuperAdmin, requireEmailVerified, async (req: AuthRequest, res) => {
    try {
      if (req.supabaseSession) {
        return res.status(403).json({
          error: "Cette route concerne uniquement les Custom Claims Firebase hérités.",
          code: "auth/firebase-only-route",
        });
      }
      const { targetUid, role } = req.body;
      if (!targetUid || typeof targetUid !== "string" || targetUid.trim().length === 0 || targetUid.length > 128) {
        return res.status(400).json({ error: "Paramètre targetUid valide requis." });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ error: "Paramètre role requis." });
      }

      // Alignment strictly with PdiUserRole ("super_admin" | "admin" | "client" | "guest" | "demo")
      const validRoles = ["super_admin", "admin", "client", "guest", "demo"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Rôle invalide. Rôles autorisés: ${validRoles.join(", ")}` });
      }

      // Protection anti-escalade / anti-verrouillage : un administrateur ne peut pas rétrograder son propre compte directement
      if (req.user?.uid === targetUid && role !== "super_admin") {
        return res.status(400).json({ error: "Un super-administrateur ne peut pas rétrograder son propre compte via cette route." });
      }

      await resolveAdminAuth().setCustomUserClaims(targetUid, { role });
      console.log(`[Admin] Custom Claim 'role: ${role}' assigned to UID: ${targetUid} by verified super_admin UID: ${req.user?.uid}`);
      
      res.json({ 
        success: true, 
        targetUid, 
        role, 
        message: "Rôle attribué via Firebase Custom Claim. Un rafraîchissement du token client (getIdToken(true)) est nécessaire pour appliquer le rôle." 
      });
    } catch (err: any) {
      console.error("Error setting custom user claim:", err?.message || err);
      res.status(500).json({
        error: "Internal server error",
        code: "ADMIN_ROLE_UPDATE_FAILED"
      });
    }
  });

  // ==========================================
  // Slick-Pay & Paddle Webhook IPN & Pending Order Endpoints (SEC-01-FIX-05-B & Protection C2 STAGING-00-B3-R1/R2/B4)
  // ==========================================
  const hasInjectedFirebaseDeps = Boolean(deps.getAdminDb && deps.getAdminAuth);
  const sandboxModeActive = isStagingSandboxMode(runtimeEnv);
  const firebaseRuntimeBlocked =
    sandboxModeActive ||
    shouldBlockServerFirebaseInit(runtimeEnv) ||
    (!hasInjectedFirebaseDeps && isServerFirebaseRuntimeDisabled);

  if (firebaseRuntimeBlocked) {
    // STAGING-00-B3-R1 / R2 / B4-B / FIX-01: Do NOT instantiate Firebase-backed repositories or processors when Sandbox or fail-closed gate is active for runtimeEnv.
    const rejectWhenFirebaseRuntimeDisabled: express.RequestHandler = (req, res, _next) => {
      return sandboxGuard(req, res, () => {
        if (sandboxModeActive) {
          return res.status(403).json({
            error:
              "Forbidden: Server-side administrative, payment, webhook, and database persistence routes are disabled in Sandbox mode.",
            code: "sandbox/server-mutation-forbidden",
          });
        }
        return res.status(503).json({
          error:
            "Service Unavailable: Server Firebase Admin runtime is disabled (explicit coherent PDI_ENV and VITE_PDI_ENV required).",
          code: "server/firebase-runtime-disabled",
        });
      });
    };
    app.post("/api/payments/orders", rejectWhenFirebaseRuntimeDisabled);
    app.post("/api/webhooks/slickpay", rejectWhenFirebaseRuntimeDisabled);
    app.post("/api/webhooks/paddle", rejectWhenFirebaseRuntimeDisabled);
  } else {
    const activeAdminDb = resolveAdminDb();
    const activeAdminAuth = resolveAdminAuth();

    const pendingOrderRepository = createPendingOrderRepository({
      adminDb: activeAdminDb
    });

    const webhookIdempotencyRepository = createWebhookIdempotencyRepository({
      adminDb: activeAdminDb
    });

    const paymentWebhookProcessor = createPaymentWebhookProcessor({
      adminDb: activeAdminDb,
      adminAuth: activeAdminAuth,
      idempotencyRepository: webhookIdempotencyRepository,
      pendingOrderRepository
    });

    // Authoritative Pending Order Creation (Server-side UID & unguessable orderId)
    app.post(
      "/api/payments/orders",
      sandboxGuard,
      ...createPendingOrderRoute({
        pendingOrderRepository,
        verifyIdToken: deps.getAdminAuth
          ? (token) => activeAdminAuth.verifyIdToken(token)
          : undefined,
      })
    );

    // Slick-Pay Webhook (Algeria - BaridiMob / Edahabia) — Strict Fail-Closed
    app.post("/api/webhooks/slickpay", sandboxGuard, createSlickPayWebhookHandler());

    // Paddle Webhook (International EUR/USD) — Strict Isolated RawBody Parser (256kb) & Order Association (SEC-01-FIX-07-R1 D2.2)
    app.post(
      "/api/webhooks/paddle",
      sandboxGuard,
      createPaddleWebhookBodyParser(),
      createPaddleWebhookHandler({
        processor: paymentWebhookProcessor
      })
    );
  }

  app.get("/api/projects", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const userProjects = await fetchProjects(uid);
      res.json({ projects: userProjects });
    } catch (err: any) {
      console.error("Error fetching projects from Cloud SQL:", err);
      res.status(500).json({ error: "Failed to fetch projects." });
    }
  });

  app.post("/api/projects", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const saved = await upsertProject(uid, req.body);
      res.json({ project: saved });
    } catch (err: any) {
      console.error("Error saving project to Cloud SQL:", err);
      res.status(500).json({ error: "Failed to save project." });
    }
  });

  app.delete("/api/projects/:id", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const projectId = Number(req.params.id);
      if (!uid || isNaN(projectId)) return res.status(400).json({ error: "Invalid request" });
      await removeProject(uid, projectId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting project from Cloud SQL:", err);
      res.status(500).json({ error: "Failed to delete project." });
    }
  });

  // =========================================================================
  // PIPELINE OCR & DÉTECTION TOPOLOGIQUE ISOMÉTRIE (0 API EXTERNE / LOCAL)
  // =========================================================================
  app.post("/api/sketch/detect-iso", async (_req, res) => {
    // L'application fonctionne en 0 API externe (détection locale autonome / pointage assisté)
    return res.json({
      success: true,
      data: null,
    });
  });

  const shouldMountApiNotFound =
    options.mountApiNotFoundHandler ?? options.mountErrorHandler !== false;
  if (shouldMountApiNotFound) {
    app.use("/api", createApiNotFoundHandler());
  }

  if (options.mountErrorHandler !== false) {
    app.use(createGlobalExpressErrorHandler());
  }

  return app;
}

// Configure Express to serve built frontend static assets or mount Vite dev server
export async function startServer(options: StartServerOptions = {}): Promise<StartedPdiServer> {
  const runtimeEnv = options.env ?? process.env;
  const host = options.host ?? "0.0.0.0";
  const port = options.port !== undefined ? options.port : Number(runtimeEnv.PORT) || 3000;
  const attachFrontend = options.attachFrontend !== false;

  const app = createPdiExpressApp({
    env: runtimeEnv,
    mountErrorHandler: false,
    mountApiNotFoundHandler: false,
    dependencies: options.dependencies,
  });

  const deliveryMode = resolveServerDeliveryMode(runtimeEnv);

  if (attachFrontend) {
    if (!deliveryMode.serveStaticDist) {
      app.use("/api", createApiNotFoundHandler());
      const viteServerFactory =
        options.dependencies?.createViteServer ?? (await import("vite")).createServer;
      const vite = await viteServerFactory({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = options.distPath ?? path.join(process.cwd(), "dist");

      // Protection Path Traversal & Dotfiles pour les requêtes statiques (Section E4)
      app.use((req, res, next) => {
        if (req.path.includes("..") || req.path.includes("/.") || req.path.startsWith("/.")) {
          return res.status(403).type("text/plain").send("Forbidden: Invalid path syntax");
        }
        next();
      });

      // STAGING-00-B4-FIX-ENV-02 (Partie C) :
      // Sert index.html avec injection de la configuration publique runtime minimale validée
      // AVANT le chargement des modules frontend (zéro secret, zéro URL DB, zéro identifiant).
      const sendRuntimeConfiguredIndexHtml = (_req: express.Request, res: express.Response) => {
        try {
          const indexPath = path.join(distPath, "index.html");
          if (!fs.existsSync(indexPath)) {
            res.status(404).type("text/plain").send("Asset not found");
            return;
          }
          const rawHtml = fs.readFileSync(indexPath, "utf-8");
          const publicRuntimeConfig = buildPublicBrowserRuntimeConfig(runtimeEnv);
          const renderedHtml = injectPublicRuntimeConfigIntoHtml(rawHtml, publicRuntimeConfig);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.send(renderedHtml);
        } catch (err: any) {
          console.error("Error serving runtime-configured index.html:", err?.message || err);
          res.status(500).type("text/plain").send("Internal Server Error");
        }
      };

      app.get(["/", "/index.html"], sendRuntimeConfiguredIndexHtml);

      // PATCH 017G : index.html ne doit jamais etre mis en cache, sinon il
      // continue de pointer vers des assets haches qui n existent plus.
      app.use(
        express.static(distPath, {
          index: false,
          dotfiles: "ignore",
          setHeaders: (res, filePath) => {
            if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
          },
        })
      );

      // PATCH 017G : sonde de diagnostic des assets (Section E6 & FIX-ENV-02 : minimisée en mode strict/Cloud Run)
      app.get("/api/health/assets", (_req, res) => {
        if (deliveryMode.strictSecurityMode && !runtimeEnv.ENABLE_ASSET_DIAGNOSTICS) {
          return res.json({
            status: "ok",
            ready: fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"))
          });
        }
        try {
          const assetsDir = path.join(distPath, "assets");
          const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
          res.json({
            distExists: fs.existsSync(distPath),
            indexHtml: fs.existsSync(path.join(distPath, "index.html")),
            css: files.filter((f) => f.endsWith(".css")),
            jsCount: files.filter((f) => f.endsWith(".js")).length,
          });
        } catch (err: any) {
          console.error("Asset health check error:", err?.message || err);
          res.status(500).json({ error: "Internal asset health check error" });
        }
      });

      // PATCH 017H : route de secours pour les styles. Certaines plateformes
      // repondent 403 sur /assets/*.css ; /api/* reste accessible. On concatene
      // les CSS presents dans dist/assets et on les sert en text/css.
      app.get("/api/style/main.css", (_req, res) => {
        try {
          const assetsDir = path.join(distPath, "assets");
          const files = fs.existsSync(assetsDir)
            ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".css"))
            : [];
          if (files.length === 0) {
            res.status(404).type("text/plain").send("Aucun bundle CSS dans dist/assets");
            return;
          }
          const css = files
            .map((f) => fs.readFileSync(path.join(assetsDir, f), "utf-8"))
            .join("\n");
          res.setHeader("Content-Type", "text/css; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.send(css);
        } catch (err: any) {
          console.error("Error reading CSS bundle:", err?.message || err);
          res.status(500).type("text/plain").send("Internal Server Error");
        }
      });

      // VERCEL-API-01 : aucune route /api/* inconnue ne doit tomber dans le fallback HTML SPA
      app.use("/api", createApiNotFoundHandler());

      app.get("*", (req, res) => {
        // PATCH 017G : ne jamais renvoyer index.html a la place d un asset.
        // C est ce fallback qui masquait l absence du bundle CSS : le navigateur
        // recevait du HTML en text/html et ignorait la feuille sans erreur.
        if (path.extname(req.path)) {
          res.status(404).type("text/plain").send("Asset not found");
          return;
        }
        return sendRuntimeConfiguredIndexHtml(req, res);
      });
    }
  } else {
    app.use("/api", createApiNotFoundHandler());
  }

  // Middleware global de gestion des erreurs de parsing (400 / 413) et d'erreurs internes (500) en fin de chaîne (SEC-01-FIX-07-R1 D2.4 & D3)
  app.use(createGlobalExpressErrorHandler());

  const server = await new Promise<Server>((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      resolve(httpServer);
    });
    httpServer.on("error", reject);
  });

  const address = server.address() as AddressInfo | null;
  const boundPort = address && typeof address === "object" ? address.port : port;
  console.log(`Server running on http://${host}:${boundPort}`);

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return {
    app,
    server,
    host,
    port: boundPort,
    close,
  };
}

function isDirectServerExecution(): boolean {
  if (
    process.env.PDI_SERVER_NO_AUTOSTART === "1" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true"
  ) {
    return false;
  }
  if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
    return true;
  }
  const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return (
    entryArg.endsWith(`${path.sep}server.ts`) ||
    entryArg.endsWith(`${path.sep}server.cjs`) ||
    entryArg.endsWith(`${path.sep}server.js`)
  );
}

if (isDirectServerExecution()) {
  startServer().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
