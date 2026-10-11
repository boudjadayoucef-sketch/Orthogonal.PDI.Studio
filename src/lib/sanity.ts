/**
 * PD&I VISION - SANITY CMS CLIENT (Free Tier / Read-Only Support)
 */
import { createClient } from "@sanity/client";

const metaEnv = (typeof import.meta !== "undefined" && (import.meta as any)?.env) || {};

export const SANITY_PROJECT_ID = metaEnv.VITE_SANITY_PROJECT_ID || "";
export const SANITY_DATASET = metaEnv.VITE_SANITY_DATASET || "production";

export interface SanityAnnouncement {
  _id: string;
  title: string;
  tag?: "feature" | "maintenance" | "info" | string;
  publishedAt?: string;
  content?: string;
  author?: string;
}

export const sanityClient = SANITY_PROJECT_ID
  ? createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      useCdn: true,
      apiVersion: "2024-01-01",
    })
  : null;

/**
 * Récupère les dernières annonces depuis Sanity (ou données d'exemple si non configuré)
 */
export async function getSanityAnnouncements(): Promise<{ announcements: SanityAnnouncement[]; isConfigured: boolean }> {
  if (!sanityClient || !SANITY_PROJECT_ID) {
    return {
      isConfigured: false,
      announcements: [
        {
          _id: "demo-1",
          title: "Mise à jour v017Q4 - Synchronisation Multi-Écran et Moteur Transactionnel",
          tag: "feature",
          publishedAt: new Date().toISOString(),
          content: "Déploiement du dispatcher universel commitGraph() et sécurisation des flux Firestore.",
          author: "Équipe PD&I Tech"
        },
        {
          _id: "demo-2",
          title: "Intégration du catalogue international ASME / API / DIN",
          tag: "info",
          publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          content: "Tous les composants ASME B16.5 / B16.9 sont désormais indexés et cotés au millimètre près.",
          author: "Catalogue Standard"
        }
      ]
    };
  }

  try {
    const data = await sanityClient.fetch<SanityAnnouncement[]>(
      `*[_type == "announcement"] | order(publishedAt desc)[0..20]`
    );
    return { announcements: data || [], isConfigured: true };
  } catch (err) {
    console.warn("Erreur lors de la récupération des données Sanity:", err);
    return { announcements: [], isConfigured: true };
  }
}
