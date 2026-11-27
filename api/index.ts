/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Point d'entrée Vercel Serverless Function pour les routes Express `/api/*`.
 *
 * - Aucun appel à `app.listen()`
 * - Aucun démarrage de Vite
 * - Import statique direct d'un module CommonJS pré-assemblé dans `api/_vercelHandler.cjs`
 *   (préfixé par `_` donc ignoré comme route publique par Vercel) afin d'éliminer tout
 *   import TypeScript inter-répertoires (`../src/*`) et de garantir le traçage natif par
 *   `@vercel/nft` de l'ensemble des dépendances npm serveur (`express`, `@supabase/supabase-js`, etc.).
 * - Attend la fin effective de la réponse HTTP (`finish` / `close`) pour garantir
 *   que les routes asynchrones (`/api/auth/supabase/session`, `/api/admin/supabase/overview`)
 *   ne soient jamais interrompues prématurément par le runtime Serverless.
 */

import type { IncomingMessage, ServerResponse } from "http";
import vercelHandlerModule from "./_vercelHandler.cjs";

type VercelHandlerFn = (req: IncomingMessage, res: ServerResponse) => void;

function resolveVercelApiHandler(mod: unknown): VercelHandlerFn {
  if (typeof mod === "function") {
    return mod as VercelHandlerFn;
  }
  const record = mod as {
    default?: unknown;
    vercelApiHandler?: unknown;
  } | null;
  if (record && typeof record.default === "function") {
    return record.default as VercelHandlerFn;
  }
  if (record && typeof record.vercelApiHandler === "function") {
    return record.vercelApiHandler as VercelHandlerFn;
  }
  if (
    record &&
    record.default &&
    typeof record.default === "object" &&
    typeof (record.default as { default?: unknown; vercelApiHandler?: unknown }).default ===
      "function"
  ) {
    return (record.default as { default: VercelHandlerFn }).default;
  }
  if (
    record &&
    record.default &&
    typeof record.default === "object" &&
    typeof (record.default as { vercelApiHandler?: unknown }).vercelApiHandler === "function"
  ) {
    return (record.default as { vercelApiHandler: VercelHandlerFn }).vercelApiHandler;
  }
  throw new Error("Vercel API handler export unavailable");
}

const vercelApiHandler = resolveVercelApiHandler(vercelHandlerModule);

export default async function vercelApiEntrypoint(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
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
      vercelApiHandler(req, res);
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
}
