/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Point d'entrée Vercel Serverless Function pour les routes Express `/api/*`.
 *
 * - Aucun appel à `app.listen()`
 * - Aucun démarrage de Vite
 * - Charge le bundle ESM autonome `api/_vercelBundle.mjs` produit par `buildCommand`
 *   sur Vercel (zéro dépendance TS/parent-dir/Vite au runtime), avec repli automatique
 *   sur `../src/server/vercelHandler.js` en exécution locale / tests Vitest.
 * - Attend la fin effective de la réponse HTTP (`finish` / `close`) pour garantir
 *   que les routes asynchrones (`/api/auth/supabase/session`, etc.) ne soient jamais
 *   interrompues prématurément par le runtime Serverless.
 */

import type { IncomingMessage, ServerResponse } from "http";

type VercelApiHandlerFn = (req: IncomingMessage, res: ServerResponse) => void;

let cachedHandler: VercelApiHandlerFn | null = null;
let pendingLoad: Promise<VercelApiHandlerFn> | null = null;

async function resolveVercelApiHandler(): Promise<VercelApiHandlerFn> {
  if (cachedHandler) {
    return cachedHandler;
  }
  if (pendingLoad) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    try {
      const bundledMod = await import("./_vercelBundle.mjs");
      if (typeof bundledMod?.default === "function") {
        cachedHandler = bundledMod.default;
        return cachedHandler;
      }
    } catch {
      // En environnement local / Vitest (avant buildCommand Vercel), basculer vers la source TS/ESM.
    }

    const fallbackSpecifier = ["..", "src", "server", "vercelHandler.js"].join("/");
    const sourceMod = (await import(fallbackSpecifier)) as { default?: VercelApiHandlerFn };
    if (typeof sourceMod?.default !== "function") {
      throw new Error("Vercel API handler export is missing or invalid.");
    }
    cachedHandler = sourceMod.default;
    return cachedHandler;
  })();

  try {
    return await pendingLoad;
  } catch (err) {
    pendingLoad = null;
    throw err;
  }
}

export default async function vercelApiEntrypoint(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const handler = await resolveVercelApiHandler();
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      res.once("finish", done);
      res.once("close", done);

      try {
        handler(req, res);
      } catch (invokeErr) {
        console.error(
          "[VERCEL-API-01] Erreur synchrone du handler Express:",
          invokeErr instanceof Error ? invokeErr.message : "unknown"
        );
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.end(
            JSON.stringify({
              error: "Internal Server Error",
              code: "server/handler-error",
            })
          );
        }
        done();
        return;
      }

      if (res.writableEnded) {
        done();
      }
    });
  } catch (err) {
    console.error(
      "[VERCEL-API-01] Échec du chargement du handler API Serverless:",
      err instanceof Error ? err.message : "unknown"
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(
        JSON.stringify({
          error: "Internal Server Error: API runtime unavailable.",
          code: "server/bootstrap-error",
        })
      );
    }
  }
}
