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
  verifyPaddleWebhookSignature,
  verifySlickPayWebhook,
  globalWebhookIdempotency,
  verifyProductionConfig,
  isSuspiciousRequestPath
} from "./src/security/sec01SecurityService.ts";
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
// Slick-Pay & Paddle Webhook IPN Endpoints
// ==========================================

// Slick-Pay Webhook (Algeria - BaridiMob / Edahabia) — Section B3, B4, B5
app.post("/api/webhooks/slickpay", async (req: RequestWithRawBody, res) => {
  try {
    const payload = req.body;
    const invoiceId = payload?.invoice_id || payload?.id || payload?.order_id || payload?.data?.id;

    if (!invoiceId) {
      return res.status(400).json({ received: false, error: "Missing invoice_id in payload" });
    }

    const eventKey = `slickpay_${invoiceId}`;

    // Anti-Replay: Idempotency guard (Section B4)
    if (globalWebhookIdempotency.isProcessed(eventKey)) {
      return res.status(200).json({ received: true, status: "already_processed" });
    }
    if (!globalWebhookIdempotency.markInProgress(eventKey)) {
      return res.status(409).json({ error: "Webhook event currently in progress" });
    }

    try {
      // Vérification explicite Slick-Pay (Section B3)
      const verification = verifySlickPayWebhook(
        payload,
        req.headers,
        process.env.SLICKPAY_WEBHOOK_SECRET
      );

      const paymentStatus = payload?.status || payload?.event || payload?.data?.status;
      const amount = payload?.amount || payload?.data?.amount;
      const customerEmail = payload?.user?.email || payload?.customer_email || payload?.data?.user?.email;
      const isPaid = paymentStatus === "completed" || paymentStatus === "paid" || paymentStatus === "success" || paymentStatus === "COMPLETED";

      // Minimal logging without sensitive payload dump (Section B5)
      console.log(`[Webhook Slick-Pay] Invoice ${invoiceId} processed (Status: ${paymentStatus}, Verified: ${verification.isAuthentic})`);

      // Update or insert transaction record in Firestore
      const txRef = adminDb.collection("pdi_payment_transactions").doc(String(invoiceId));
      await txRef.set({
        id: `TX_SLICKPAY_${invoiceId}`,
        provider: "slickpay_baridimob",
        status: isPaid ? (verification.canAutoActivate ? "completed" : "pending_verification") : "pending",
        amount: Number(amount) || 49000,
        currency: "DZD",
        userEmail: customerEmail ? String(customerEmail).toLowerCase() : "client@pdi-pipeline.dz",
        updatedAt: new Date().toISOString(),
        verificationStatus: verification.isAuthentic ? "authentic" : "unverified"
      }, { merge: true });

      // RÈGLE STRICTE (Section B1 & B3) : JAMAIS d'auto-activation sans authentification vérifiée
      if (isPaid && customerEmail && verification.canAutoActivate) {
        try {
          const userRecord = await adminAuth.getUserByEmail(customerEmail);
          if (userRecord?.uid) {
            await adminAuth.setCustomUserClaims(userRecord.uid, {
              role: "client",
              plan: "pro",
              activeUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
            });
            await adminDb.collection("pdi_user_profiles").doc(userRecord.uid).set({
              plan: "pro",
              status: "active",
              activatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
              subscriptionProvider: "slickpay"
            }, { merge: true });
            console.log(`[Webhook Slick-Pay] Pro subscription activated for UID: ${userRecord.uid}`);
          }
        } catch {
          console.warn(`[Webhook Slick-Pay] User not registered yet in Auth, saved pending.`);
        }
      }

      globalWebhookIdempotency.markCompleted(eventKey);
      return res.status(200).json({ 
        received: true, 
        status: isPaid ? (verification.canAutoActivate ? "completed" : "pending_verification") : "pending" 
      });
    } catch (innerErr) {
      globalWebhookIdempotency.releaseInProgress(eventKey);
      throw innerErr;
    }
  } catch (err: any) {
    console.error("[Webhook Slick-Pay Error]:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Webhook processing failed" });
  }
});

// Paddle Webhook (International EUR/USD) — Section B2, B4, B5
app.post("/api/webhooks/paddle", async (req: RequestWithRawBody, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signatureHeader = (req.headers["paddle-signature"] || req.headers["Paddle-Signature"]) as string | undefined;
    const paddleSecret = process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET;

    // RÈGLE STRICTE (Section B2) : Vérification officielle de signature Paddle uniquement
    const sigVerification = verifyPaddleWebhookSignature(rawBody, signatureHeader, paddleSecret);

    if (!sigVerification.isValid) {
      console.warn(`[Webhook Paddle Rejected] Unauthorized webhook attempt: ${sigVerification.error}`);
      return res.status(401).json({ error: sigVerification.error || "Invalid Paddle signature" });
    }

    const payload = req.body;
    const eventType = payload?.alert_name || payload?.event_type || payload?.type;
    const checkoutId = payload?.checkout_id || payload?.data?.id || payload?.order_id || payload?.event_id;

    if (!checkoutId) {
      return res.status(400).json({ error: "Missing event/checkout ID in Paddle webhook" });
    }

    const eventKey = `paddle_${checkoutId}`;

    // Anti-Replay Idempotency Guard (Section B4)
    if (globalWebhookIdempotency.isProcessed(eventKey)) {
      return res.status(200).json({ received: true, status: "already_processed" });
    }
    if (!globalWebhookIdempotency.markInProgress(eventKey)) {
      return res.status(409).json({ error: "Webhook event currently in progress" });
    }

    try {
      console.log(`[Webhook Paddle Verified] Processing event: ${eventType} (ID: ${checkoutId})`);

      const customerEmail = payload?.email || payload?.data?.customer?.email || payload?.data?.user?.email;
      const isSuccess = eventType === "payment_succeeded" || eventType === "transaction.completed" || eventType === "subscription_created";

      const txRef = adminDb.collection("pdi_payment_transactions").doc(String(checkoutId));
      await txRef.set({
        id: `TX_PADDLE_${checkoutId}`,
        provider: "paddle_international",
        status: isSuccess ? "completed" : "pending",
        userEmail: customerEmail ? String(customerEmail).toLowerCase() : "international@client.com",
        updatedAt: new Date().toISOString(),
        eventType
      }, { merge: true });

      if (isSuccess && customerEmail) {
        try {
          const userRecord = await adminAuth.getUserByEmail(customerEmail);
          if (userRecord?.uid) {
            await adminAuth.setCustomUserClaims(userRecord.uid, {
              role: "client",
              plan: "pro",
              activeUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
            });
            await adminDb.collection("pdi_user_profiles").doc(userRecord.uid).set({
              plan: "pro",
              status: "active",
              activatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
              subscriptionProvider: "paddle"
            }, { merge: true });
            console.log(`[Webhook Paddle] Pro subscription activated for UID: ${userRecord.uid}`);
          }
        } catch {
          console.warn("[Webhook Paddle] User not found in Auth, saved pending.");
        }
      }

      globalWebhookIdempotency.markCompleted(eventKey);
      return res.status(200).json({ received: true });
    } catch (innerErr) {
      globalWebhookIdempotency.releaseInProgress(eventKey);
      throw innerErr;
    }
  } catch (err: any) {
    console.error("[Webhook Paddle Error]:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Paddle webhook processing failed" });
  }
});

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
