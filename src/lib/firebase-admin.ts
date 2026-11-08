import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

// Preference order:
// 1. Server env vars (FIREBASE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT)
// 2. Client env var VITE_FIREBASE_PROJECT_ID
// 3. Current Cloud Run / Applet Google Cloud project ID ('graphical-router-x18qq')
const envProjectId =
  (typeof process !== 'undefined' && (
    process.env?.FIREBASE_PROJECT_ID ||
    process.env?.GOOGLE_CLOUD_PROJECT ||
    process.env?.GCLOUD_PROJECT ||
    process.env?.VITE_FIREBASE_PROJECT_ID
  )) ||
  metaEnv.VITE_FIREBASE_PROJECT_ID ||
  'graphical-router-x18qq';

// In production, reject explicit demo project placeholders (e.g. 'demo-app-id', 'demo-project')
if (isProd && envProjectId.startsWith('demo-') && !process.env?.ALLOW_DEMO_PROJECT_IN_PROD) {
  throw new Error('[FATAL] Production startup error: Cannot use demo project ID in production.');
}

// Configuration Firebase Admin (SDK Serveur)
const firebaseConfig = {
  projectId: envProjectId,
};

const app = !getApps().length
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApps()[0];

export const adminApp = app;
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

// Exposer l'application Admin réelle sur adminDb pour permettre la vérification du projet
if (!(adminDb as any).app) {
  Object.defineProperty(adminDb, 'app', {
    value: app,
    writable: false,
    enumerable: true
  });
}

