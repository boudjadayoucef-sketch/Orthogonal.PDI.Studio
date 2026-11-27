/**
 * ORTHOGONAL PD&I STUDIO — VERCEL-API-01
 * Stub fail-closed injecté lors du pré-assemblage `api/_vercelHandler.cjs`
 * pour éliminer les dépendances serveur parasites (`firebase-admin`, `@google-cloud/firestore`,
 * `@grpc/grpc-js`, `pg-native`) du bundle Serverless Vercel tout en conservant
 * l'ensemble des routes et garde-fous de sécurité de `server.ts`.
 */

export const isServerFirebaseSandboxDisabled = false;
export const isServerFirebaseRuntimeDisabled = true;
export const serverFirebaseBlockReason = "INCOMPLETE_PDI_ENV";
export const serverFirebaseRuntimeConfig = null;

export function shouldBlockServerFirebaseInit(): boolean {
  return true;
}

export function getServerAdminApp(): never {
  throw new Error("Server Firebase Admin runtime is disabled on Vercel Serverless.");
}

export function getServerAdminAuth(): never {
  throw new Error("Server Firebase Admin runtime is disabled on Vercel Serverless.");
}

export function getServerAdminDb(): never {
  throw new Error("Server Firebase Admin runtime is disabled on Vercel Serverless.");
}

export function initializeApp(): never {
  throw new Error("firebase-admin/app is disabled on Vercel Serverless.");
}

export function getApps(): never[] {
  return [];
}

export function getApp(): never {
  throw new Error("firebase-admin/app is disabled on Vercel Serverless.");
}

export function getAuth(): never {
  throw new Error("firebase-admin/auth is disabled on Vercel Serverless.");
}

export class Firestore {
  constructor() {
    throw new Error("@google-cloud/firestore is disabled on Vercel Serverless.");
  }
}

export class Timestamp {
  public readonly seconds: number;
  public readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }
}

export default function pgNativeDisabledStub(): never {
  throw new Error("pg-native is disabled on Vercel Serverless.");
}
