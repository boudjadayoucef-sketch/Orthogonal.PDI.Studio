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
import { requireAuth, requireSuperAdmin, AuthRequest } from "./src/middleware/auth.ts";
import { adminAuth, adminDb } from "./src/lib/firebase-admin.ts";
import { 
  getUserProjects, 
  createOrUpdateProject, 
  deleteUserProject, 
  getDriveFiles, 
  saveDriveFileRecord 
} from "./src/db/projects.ts";
import { getOrCreateUser } from "./src/db/users.ts";

dotenv.config();

const app = express();
const PORT = 3000;

// Hardening & Security Middleware ORTHOGONAL - ENG
app.disable("x-powered-by");

// Whitelist CORS et prévention wildcard en prod
const ALLOWED_ORIGINS = [
  "https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
  "https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
  "http://localhost:3000"
];

// In-Memory IP Rate Limiter pour protéger les endpoints sensibles
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const ipRequestLimits = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 100; // Max 100 requêtes/min par IP

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
  const now = Date.now();
  const record = ipRequestLimits.get(ip);

  if (!record || now > record.resetTime) {
    ipRequestLimits.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    return next();
  }

  record.count++;
  if (record.count > MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      error: "Trop de requêtes. Veuillez patienter une minute avant de réessayer."
    });
  }

  next();
};

// Middleware Global de Sécurité (Headers, CORS, CSP, HSTS)
app.use((req, res, next) => {
  // CORS sécurisé dynamique
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  // Headers de sécurité
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https: wss:; frame-src 'self' https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app; object-src 'none'");
  res.setHeader("X-Engine-Vendor", "ORTHOGONAL - ENG");
  res.setHeader("X-Engine-Product", "Piping Design & Isometrics");
  next();
});

// Appliquer le rate limiter sur toutes les requêtes API
app.use("/api", rateLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// API health endpoint with software signature
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "pdi-industrial-cad",
    vendor: "ORTHOGONAL - ENG",
    engineVersion: "4.8d",
    timestamp: new Date().toISOString(),
  });
});

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

// Admin: Assign Custom Claims (Role) securely via Firebase Admin SDK
app.post("/api/admin/set-user-role", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { targetUid, role } = req.body;
    if (!targetUid || !role) {
      return res.status(400).json({ error: "Paramètres targetUid et role requis." });
    }

    // Alignment strictly with PdiUserRole ("super_admin" | "admin" | "client" | "guest" | "demo")
    const validRoles = ["super_admin", "admin", "client", "guest", "demo"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Rôle invalide. Rôles autorisés: ${validRoles.join(", ")}` });
    }

    await adminAuth.setCustomUserClaims(targetUid, { role });
    console.log(`Custom Claim 'role: ${role}' successfully assigned to UID: ${targetUid} by ${req.user?.email}`);
    
    res.json({ 
      success: true, 
      targetUid, 
      role, 
      message: "Rôle attribué via Firebase Custom Claim. Un rafraîchissement du token client (getIdToken(true)) est nécessaire pour appliquer le rôle." 
    });
  } catch (err: any) {
    console.error("Error setting custom user claim:", err);
    res.status(500).json({ error: err.message || "Échec de l'attribution du rôle utilisateur." });
  }
});

// ==========================================
// Slick-Pay & Paddle Webhook IPN Endpoints
// ==========================================

// Slick-Pay Webhook (Algeria - BaridiMob / Edahabia)
app.post("/api/webhooks/slickpay", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[Webhook Slick-Pay] Received payload:", JSON.stringify(payload));

    // Expected Slick-Pay event parameters
    const invoiceId = payload?.invoice_id || payload?.id || payload?.order_id || payload?.data?.id;
    const paymentStatus = payload?.status || payload?.event || payload?.data?.status;
    const amount = payload?.amount || payload?.data?.amount;
    const customerEmail = payload?.user?.email || payload?.customer_email || payload?.data?.user?.email;

    if (!invoiceId) {
      return res.status(400).json({ received: true, error: "Missing invoice_id in payload" });
    }

    const isPaid = paymentStatus === "completed" || paymentStatus === "paid" || paymentStatus === "success" || paymentStatus === "COMPLETED";

    // Update or insert transaction record in Firestore
    const txRef = adminDb.collection("pdi_payment_transactions").doc(String(invoiceId));
    await txRef.set({
      id: `TX_SLICKPAY_${invoiceId}`,
      provider: "slickpay_baridimob",
      status: isPaid ? "completed" : "pending",
      amount: Number(amount) || 49000,
      currency: "DZD",
      userEmail: customerEmail || "client@pdi-pipeline.dz",
      updatedAt: new Date().toISOString(),
      slickPayDetails: {
        invoiceId: String(invoiceId),
        rawWebhook: payload,
      }
    }, { merge: true });

    // If payment succeeded, automatically activate subscription for customer
    if (isPaid && customerEmail) {
      try {
        const userRecord = await adminAuth.getUserByEmail(customerEmail);
        if (userRecord?.uid) {
          await adminAuth.setCustomUserClaims(userRecord.uid, { role: "client", plan: "pro", activeUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() });
          await adminDb.collection("pdi_user_profiles").doc(userRecord.uid).set({
            plan: "pro",
            status: "active",
            activatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
            subscriptionProvider: "slickpay"
          }, { merge: true });
          console.log(`[Webhook Slick-Pay] Auto-activated Pro subscription for: ${customerEmail}`);
        }
      } catch (userErr) {
        console.warn(`[Webhook Slick-Pay] User ${customerEmail} not registered yet in Auth, saved pending activation.`);
      }
    }

    return res.status(200).json({ received: true, status: isPaid ? "completed" : "pending" });
  } catch (err: any) {
    console.error("[Webhook Slick-Pay Error]:", err);
    return res.status(500).json({ error: err?.message || "Webhook processing failed" });
  }
});

// Paddle Webhook (International EUR/USD)
app.post("/api/webhooks/paddle", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[Webhook Paddle] Received event:", payload?.alert_name || payload?.event_type);

    const eventType = payload?.alert_name || payload?.event_type || payload?.type;
    const checkoutId = payload?.checkout_id || payload?.data?.id || payload?.order_id;
    const customerEmail = payload?.email || payload?.data?.customer?.email || payload?.data?.user?.email;

    if (checkoutId) {
      const isSuccess = eventType === "payment_succeeded" || eventType === "transaction.completed" || eventType === "subscription_created";
      const txRef = adminDb.collection("pdi_payment_transactions").doc(String(checkoutId));
      await txRef.set({
        id: `TX_PADDLE_${checkoutId}`,
        provider: "paddle_international",
        status: isSuccess ? "completed" : "pending",
        userEmail: customerEmail || "international@client.com",
        updatedAt: new Date().toISOString(),
        rawEvent: payload
      }, { merge: true });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("[Webhook Paddle Error]:", err);
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
    // PATCH 017G : index.html ne doit jamais etre mis en cache, sinon il
    // continue de pointer vers des assets haches qui n existent plus.
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
        },
      })
    );

    // PATCH 017G : sonde de diagnostic des assets reellement livres.
    app.get("/api/health/assets", (_req, res) => {
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
