/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Point d'entrée Vercel Serverless Function pour les routes Express `/api/*`.
 *
 * - Aucun appel à `app.listen()`
 * - Aucun démarrage de Vite
 * - Import statique ESM direct vers `../src/server/vercelHandler.js` afin que `@vercel/node`
 *   et `@vercel/nft` compilent et embarquent nativement tous les modules serveur et leurs
 *   dépendances npm (`express`, `@supabase/supabase-js`, etc.) sans bundle intermédiaire.
 * - Attend la fin effective de la réponse HTTP (`finish` / `close`) pour garantir
 *   que les routes asynchrones (`/api/auth/supabase/session`, `/api/admin/supabase/overview`)
 *   ne soient jamais interrompues prématurément par le runtime Serverless.
 */

import type { IncomingMessage, ServerResponse } from "http";
import vercelApiHandler from "../src/server/vercelHandler.js";

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
