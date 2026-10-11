/**
 * PD&I VISION - MICROSOFT CLARITY UX ANALYTICS (100% Free / RGPD Compliant)
 */
import Clarity from "@microsoft/clarity";

const metaEnv = (typeof import.meta !== "undefined" && (import.meta as any)?.env) || {};

export const CLARITY_PROJECT_ID = metaEnv.VITE_CLARITY_PROJECT_ID || "";

let isClarityInitialized = false;

export function initClarity(customProjectId?: string): boolean {
  if (typeof window === "undefined" || isClarityInitialized) {
    return isClarityInitialized;
  }

  const projectId = customProjectId || CLARITY_PROJECT_ID;

  if (!projectId) {
    return false;
  }

  try {
    Clarity.init(projectId);
    isClarityInitialized = true;
    console.log(`[Clarity] Initialisé avec succès pour le projet: ${projectId}`);
    return true;
  } catch (err) {
    console.warn("[Clarity] Échec de l'initialisation:", err);
    return false;
  }
}
