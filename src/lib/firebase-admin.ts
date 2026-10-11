import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
const envProjectId = metaEnv.VITE_FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? (process.env?.VITE_FIREBASE_PROJECT_ID || process.env?.FIREBASE_PROJECT_ID || process.env?.GCLOUD_PROJECT) : '') || 'graphical-router-x18qq';

// PATCH 009b — Vercel-safe Firebase config.
// Ne jamais dépendre d'un JSON local absent du build.
// Config publique Firebase via variables Vercel VITE_FIREBASE_* ; fallback demo non secret pour build.
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'graphical-router-x18qq.firebaseapp.com',
  projectId: envProjectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || 'graphical-router-x18qq.firebasestorage.app',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '757027531011',
  appId: metaEnv.VITE_FIREBASE_APP_ID || 'demo-app-id',
};

if (!getApps().length) {
  // Read the projectId directly from firebase-applet-config.json
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
