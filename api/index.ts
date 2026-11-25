/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Point d'entrée Vercel Serverless Function pour les routes Express `/api/*`.
 *
 * - Aucun appel à `app.listen()`
 * - Aucun démarrage de Vite
 * - Préserve tous les middlewares de sécurité, CORS, rate limiting, Sandbox et fail-closed
 */

import vercelApiHandler from "../src/server/vercelHandler.ts";

export default vercelApiHandler;
