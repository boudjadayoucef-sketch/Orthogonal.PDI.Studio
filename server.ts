/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * SECURE ENTERPRISE CAD APPLICATION SERVER.
 * UNAUTHORIZED DUPLICATION OR USAGE IS STRICTLY PROHIBITED.
 */

import express from "express";
import path from "path";
// PATCH 017G : inspection reelle du dossier dist/assets.
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { requireAuth, requireSuperAdmin, requireEmailVerified, AuthRequest } from "./src/middleware/auth.ts";
import { adminAuth, adminDb } from "./src/lib/firebase-admin.ts";
import { 
  createBoundedRateLimiter,
  globalWebhookIdempotency,
  verifyProductionConfig,
  isSuspiciousRequestPath
} from "./src/security/sec01SecurityService.ts";
import { createPendingOrderRepository } from "./src/security/webhooks/pendingOrderRepository.ts";
import { createPaymentWebhookProcessor } from "./src/security/webhooks/paymentWebhookProcessor.ts";
import { createPaddleWebhookHandler } from "./src/security/webhooks/paddleWebhookHandler.ts";
import { createSlickPayWebhookHandler } from "./src/security/webhooks/slickPayWebhookHandler.ts";
import { getPaymentConfigForCountry } from "./src/pdi/payment/pdiPaymentGateway.ts";
import type { PdiAccountType, PdiSubscriptionPlan } from "./src/lib/firebase.ts";
import { 
  getUserProjects, 
  createOrUpdateProject, 
  deleteUserProject, 
  getDriveFiles, 
  saveDriveFileRecord 
} from "./src/db/projects.ts";
import { getOrCreateUser } from "./src/db/users.ts";

dotenv.config();

// Validation sûre de la configuration au démarrage (Section D2)
const configValidation = verifyProductionConfig();
if (!configValidation.isSafe) {
  if (process.env.NODE_ENV === "production") {
    console.error(configValidation.errorMessage);
    process.exit(1);
  } else {
    console.warn("[SECURITY WARN] Development configuration note:", configValidation.errorMessage);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Hardening & Security Middleware ORTHOGONAL - ENG
app.disable("x-powered-by");

// Protection Globale contre Path Traversal, Dotfiles et sondes de fichiers sensibles (SEC-01-FIX-02)
app.use((req, res, next) => {
  if (isSuspiciousRequestPath(req.originalUrl || req.url)) {
    return res.status(403).type("text/plain").send("Forbidden: Invalid request path or file probe");
  }
  next();
});

// Configuration explicite Trust Proxy pour Hostinger VPS / Nginx / LiteSpeed (Section E1)
const trustProxyConfig = process.env.TRUST_PROXY || (process.env.NODE_ENV === "production" ? 1 : false);
app.set("trust proxy", trustProxyConfig);

// Whitelist CORS dynamique contrôlée via environnement (Section E2)
const defaultAllowedOrigins = [
  "https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
  "https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : [])
];
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const ALLOWED_ORIGINS = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

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

  // Content-Security-Policy durcie : frame-ancestors restreint en production (Section E3)
  const isProd = process.env.NODE_ENV === "production";
  const frameAncestors = process.env.CSP_FRAME_ANCESTORS || (isProd ? "'self'" : "*");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https: wss:; frame-src 'self' https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app; frame-ancestors ${frameAncestors}; object-src 'none'`
  );
  res.setHeader("X-Engine-Vendor", "ORTHOGONAL - ENG");
  res.setHeader("X-Engine-Product", "Piping Design & Isometrics");
  next();
});

// Appliquer le rate limiter borné sur toutes les requêtes API (Section F1)
app.use("/api", apiRateLimiter.middleware());

// Parser JSON avec conservation du corps brut pour vérification de signature webhook (Section B2)
interface RequestWithRawBody extends express.Request {
  rawBody?: string;
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

// Cloud SQL User Sync & Projects Endpoints
app.post("/api/auth/sync-user", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || "unknown@domain.com";
    if (!uid) return res.status(401).json({ error: "Missing user uid" });

    const user = await getOrCreateUser(
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

// Admin: Assign Custom Claims (Role) securely via Firebase Admin SDK (Section A3)
app.post("/api/admin/set-user-role", requireAuth, requireSuperAdmin, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
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

    await adminAuth.setCustomUserClaims(targetUid, { role });
    console.log(`[Admin] Custom Claim 'role: ${role}' assigned to UID: ${targetUid} by verified super_admin UID: ${req.user?.uid}`);
    
    res.json({ 
      success: true, 
      targetUid, 
      role, 
      message: "Rôle attribué via Firebase Custom Claim. Un rafraîchissement du token client (getIdToken(true)) est nécessaire pour appliquer le rôle." 
    });
  } catch (err: any) {
    console.error("Error setting custom user claim:", err?.message || err);
    res.status(500).json({ error: err?.message || "Échec de l'attribution du rôle utilisateur." });
  }
});

// ==========================================
// Slick-Pay & Paddle Webhook IPN & Pending Order Endpoints (SEC-01-FIX-05-B)
// ==========================================
const pendingOrderRepository = createPendingOrderRepository({
  adminDb
});

const paymentWebhookProcessor = createPaymentWebhookProcessor({
  adminDb,
  adminAuth,
  idempotency: globalWebhookIdempotency,
  pendingOrderRepository
});

// Authoritative Pending Order Creation (Server-side UID & unguessable orderId)
app.post("/api/payments/orders", requireAuth, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const verifiedUid = req.user?.uid;
    const verifiedEmail = req.user?.email;
    if (!verifiedUid || !verifiedEmail) {
      return res.status(401).json({ error: "Authenticated user identity required." });
    }

    const validPlans: PdiAccountType[] = ["basic", "pro", "team", "enterprise"];
    const validCycles: PdiSubscriptionPlan[] = ["monthly", "yearly"];
    const plan = req.body?.plan as PdiAccountType;
    const billingCycle = (req.body?.billingCycle || "yearly") as PdiSubscriptionPlan;
    const countryCode = typeof req.body?.countryCode === "string" ? req.body.countryCode.trim().toUpperCase() : "FR";

    if (!validPlans.includes(plan) || !validCycles.includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid subscription plan or billingCycle." });
    }

    const paymentConfig = getPaymentConfigForCountry(countryCode);
    const pricing = paymentConfig.pricingTable[plan];
    const amount = billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;

    const order = await pendingOrderRepository.createPendingOrder({
      verifiedUserUid: verifiedUid,
      verifiedUserEmail: verifiedEmail,
      userName: typeof req.body?.userName === "string" ? req.body.userName : req.user?.name,
      company: typeof req.body?.company === "string" ? req.body.company : "",
      country: typeof req.body?.country === "string" ? req.body.country : undefined,
      countryCode,
      city: typeof req.body?.city === "string" ? req.body.city : "",
      plan,
      billingCycle,
      amount,
      currency: paymentConfig.currency,
      provider: paymentConfig.provider
    });

    return res.status(201).json({ order });
  } catch (err: any) {
    console.error("[Orders API Error]:", err?.message || err);
    return res.status(500).json({ error: "Failed to create authoritative pending order." });
  }
});

// Slick-Pay Webhook (Algeria - BaridiMob / Edahabia) — Strict Fail-Closed
app.post("/api/webhooks/slickpay", createSlickPayWebhookHandler());

// Paddle Webhook (International EUR/USD) — Strict RawBody Signature Verification & Order Association
app.post(
  "/api/webhooks/paddle",
  createPaddleWebhookHandler({
    processor: paymentWebhookProcessor
  })
);

app.get("/api/projects", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const userProjects = await getUserProjects(uid);
    res.json({ projects: userProjects });
  } catch (err: any) {
    console.error("Error fetching projects from Cloud SQL:", err);
    res.status(500).json({ error: "Failed to fetch projects." });
  }
});

app.post("/api/projects", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const saved = await createOrUpdateProject(uid, req.body);
    res.json({ project: saved });
  } catch (err: any) {
    console.error("Error saving project to Cloud SQL:", err);
    res.status(500).json({ error: "Failed to save project." });
  }
});

app.delete("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const projectId = Number(req.params.id);
    if (!uid || isNaN(projectId)) return res.status(400).json({ error: "Invalid request" });
    await deleteUserProject(uid, projectId);
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

// Configure Express to serve built frontend static assets or mount Vite dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // Protection Path Traversal & Dotfiles pour les requêtes statiques (Section E4)
    app.use((req, res, next) => {
      if (req.path.includes("..") || req.path.includes("/.") || req.path.startsWith("/.")) {
        return res.status(403).type("text/plain").send("Forbidden: Invalid path syntax");
      }
      next();
    });

    // PATCH 017G : index.html ne doit jamais etre mis en cache, sinon il
    // continue de pointer vers des assets haches qui n existent plus.
    app.use(
      express.static(distPath, {
        dotfiles: "ignore",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
        },
      })
    );

    // PATCH 017G : sonde de diagnostic des assets (Section E6 : minimisée en production)
    app.get("/api/health/assets", (_req, res) => {
      if (process.env.NODE_ENV === "production" && !process.env.ENABLE_ASSET_DIAGNOSTICS) {
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
        res.status(500).json({ error: String(err?.message || err) });
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
        res.status(500).type("text/plain").send("Erreur lecture CSS: " + String(err));
      }
    });

    app.get("*", (req, res) => {
      // PATCH 017G : ne jamais renvoyer index.html a la place d un asset.
      // C est ce fallback qui masquait l absence du bundle CSS : le navigateur
      // recevait du HTML en text/html et ignorait la feuille sans erreur.
      if (path.extname(req.path)) {
        res.status(404).type("text/plain").send("Asset introuvable: " + req.path);
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
