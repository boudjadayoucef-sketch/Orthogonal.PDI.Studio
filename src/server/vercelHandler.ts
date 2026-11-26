/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Adaptateur Vercel Serverless Node.js pour l'application Express (`createPdiExpressApp`).
 *
 * Garanties :
 * - N'appelle JAMAIS `app.listen()` ni `startServer()`.
 * - Ne charge et ne démarre JAMAIS Vite.
 * - Préserve tous les middlewares de sécurité (CORS validé, CSP, HSTS, rate limiting,
 *   anti-path-traversal, limites de payload 256kb, Sandbox, fail-closed).
 * - Préserve toutes les routes `/api/*` (Supabase Auth, Super Admin Overview, santé,
 *   et routes historiques Firebase / Firestore / paiements / webhooks).
 * - Garantit un refus fail-closed JSON 503 sans fuite de secret si la configuration
 *   de sécurité serveur est invalide.
 */

import type { IncomingMessage, ServerResponse } from "http";
import type express from "express";
import {
  createPdiExpressApp,
  type PdiServerDependencies,
} from "../../server.js";
import { validateOriginEntry } from "../security/sec01SecurityService.js";
import {
  SupabaseAdminConfigError,
  validateSupabaseAdminConfig,
  type SupabaseAdminConfigErrorCode,
} from "./supabaseAdmin.js";

export interface VercelSupabaseServerEnvStatus {
  configured: boolean;
  hasUrl: boolean;
  hasSecretKey: boolean;
  errorCode?: SupabaseAdminConfigErrorCode | "INVALID_SUPABASE_CONFIG";
}

export interface CreateVercelApiHandlerOptions {
  env?: NodeJS.ProcessEnv;
  dependencies?: PdiServerDependencies;
}

export type VercelApiRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void;

/**
 * Inspecte de manière sûre la disponibilité des variables serveur Supabase
 * (`SUPABASE_URL` et `SUPABASE_SECRET_KEY`) sans jamais exposer aucune valeur secrète.
 */
export function inspectVercelSupabaseServerEnv(
  env: NodeJS.ProcessEnv = process.env
): VercelSupabaseServerEnvStatus {
  const hasUrl = typeof env.SUPABASE_URL === "string" && env.SUPABASE_URL.trim().length > 0;
  const hasSecretKey =
    typeof env.SUPABASE_SECRET_KEY === "string" && env.SUPABASE_SECRET_KEY.trim().length > 0;

  try {
    validateSupabaseAdminConfig(env);
    return {
      configured: true,
      hasUrl: true,
      hasSecretKey: true,
    };
  } catch (err) {
    const errorCode =
      err instanceof SupabaseAdminConfigError ? err.code : "INVALID_SUPABASE_CONFIG";
    return {
      configured: false,
      hasUrl,
      hasSecretKey,
      errorCode,
    };
  }
}

/**
 * Enrichit prudemment l'environnement d'exécution Vercel sans jamais muter `process.env`
 * ni affaiblir aucune règle de sécurité (Sandbox, fail-closed, TRUST_PROXY, CSP, CORS).
 *
 * Lorsque `VERCEL=1`, les noms d'hôtes HTTPS natifs du déploiement Vercel
 * (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, `VERCEL_BRANCH_URL`) sont validés
 * individuellement via `validateOriginEntry(..., { allowLocalhostHttp: false })` et ajoutés
 * à `ALLOWED_ORIGINS` tout en conservant intactes toutes les entrées explicitement configurées
 * (afin qu'une valeur invalide dans `ALLOWED_ORIGINS` reste bloquée en fail-closed).
 */
export function resolveVercelRuntimeEnv(
  rawEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const clonedEnv: NodeJS.ProcessEnv = { ...rawEnv };
  const isVercelRuntime = clonedEnv.VERCEL === "1" || clonedEnv.VERCEL === "true";

  if (!isVercelRuntime) {
    return clonedEnv;
  }

  const candidateHosts = [
    clonedEnv.VERCEL_PROJECT_PRODUCTION_URL,
    clonedEnv.VERCEL_URL,
    clonedEnv.VERCEL_BRANCH_URL,
  ];

  const validatedVercelOrigins: string[] = [];
  for (const rawHost of candidateHosts) {
    if (typeof rawHost !== "string" || rawHost.trim().length === 0) {
      continue;
    }
    const trimmed = rawHost.trim();
    const candidateOrigin = trimmed.startsWith("https://")
      ? trimmed
      : trimmed.startsWith("http://")
      ? trimmed
      : `https://${trimmed}`;

    const check = validateOriginEntry(candidateOrigin, { allowLocalhostHttp: false });
    if (check.isValid && check.normalizedOrigin && !validatedVercelOrigins.includes(check.normalizedOrigin)) {
      validatedVercelOrigins.push(check.normalizedOrigin);
    }
  }

  if (validatedVercelOrigins.length > 0) {
    const existingEntries =
      typeof clonedEnv.ALLOWED_ORIGINS === "string" && clonedEnv.ALLOWED_ORIGINS.trim().length > 0
        ? clonedEnv.ALLOWED_ORIGINS.split(",").map((entry) => entry.trim())
        : [];

    const existingLower = new Set(existingEntries.map((entry) => entry.toLowerCase()));
    const mergedEntries = [...existingEntries];

    for (const vercelOrigin of validatedVercelOrigins) {
      if (!existingLower.has(vercelOrigin.toLowerCase())) {
        mergedEntries.push(vercelOrigin);
        existingLower.add(vercelOrigin.toLowerCase());
      }
    }

    clonedEnv.ALLOWED_ORIGINS = mergedEntries.join(",");
  }

  return clonedEnv;
}

/**
 * Normalise `req.url` pour garantir que l'application Express reçoit systématiquement
 * un chemin valide (les rewrites `vercel.json` `/api/(.*) -> /api` préservent `/api/...`).
 */
export function normalizeVercelApiRequestUrl(rawUrl: string | undefined): string {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return "/api";
  }
  return rawUrl;
}

/**
 * Crée un handler compatible Vercel Serverless Functions (`(req, res) => void`)
 * autour de `createPdiExpressApp()` sans jamais appeler `app.listen()` ni démarrer Vite.
 */
export function createVercelApiHandler(
  options: CreateVercelApiHandlerOptions = {}
): VercelApiRequestHandler {
  let cachedApp: express.Express | null = null;
  let initFailed = false;

  const getOrCreateApp = (): express.Express | null => {
    if (cachedApp) {
      return cachedApp;
    }
    if (initFailed) {
      return null;
    }

    try {
      const resolvedEnv = resolveVercelRuntimeEnv(options.env ?? process.env);
      cachedApp = createPdiExpressApp({
        env: resolvedEnv,
        mountErrorHandler: true,
        mountApiNotFoundHandler: true,
        dependencies: options.dependencies,
      });
      return cachedApp;
    } catch {
      initFailed = true;
      console.error(
        "[VERCEL-API-01] Refus fail-closed : échec de la vérification de configuration serveur Express."
      );
      return null;
    }
  };

  return (req: IncomingMessage, res: ServerResponse): void => {
    const app = getOrCreateApp();
    if (!app) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(
        JSON.stringify({
          error: "Service Unavailable: Server configuration failed security verification.",
          code: "server/configuration-error",
        })
      );
      return;
    }

    req.url = normalizeVercelApiRequestUrl(req.url);
    app(req as unknown as express.Request, res as unknown as express.Response);
  };
}

let singletonVercelHandler: VercelApiRequestHandler | null = null;

/**
 * Handler singleton paresseux exporté par défaut pour Vercel Serverless Functions (`api/index.ts`).
 */
export function vercelApiHandler(req: IncomingMessage, res: ServerResponse): void {
  if (!singletonVercelHandler) {
    singletonVercelHandler = createVercelApiHandler();
  }
  singletonVercelHandler(req, res);
}

export default vercelApiHandler;
