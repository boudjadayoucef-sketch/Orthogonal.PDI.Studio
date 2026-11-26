import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from '@google-cloud/firestore';
import { isStagingSandboxMode, resolvePdiEnvironmentMode } from './stagingSandbox.js';

export const EXPECTED_SERVER_PROJECT_ID = 'graphical-router-x18qq';
export const EXPECTED_SERVER_DATABASE_ID =
  'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf';

const SERVER_PROJECT_ENV_KEYS = [
  'FIREBASE_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT'
] as const;

export const SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR =
  'Coupe-circuit Sandbox Serveur (C1/C2) : Firebase Admin et Firestore Serveur sont strictement désactivés en mode Sandbox. Aucune connexion à Firebase Production n’est autorisée.';

export const SERVER_FIREBASE_FAIL_CLOSED_ERROR =
  'Coupe-circuit Fail-Closed Serveur (STAGING-00-B3-R2) : initialisation Firebase Admin et Firestore Serveur refusée (PDI_ENV et VITE_PDI_ENV doivent être explicitement définis, valides, cohérents et hors mode Sandbox).';

export type ServerFirebaseBlockReason =
  | 'SANDBOX_MODE'
  | 'INCOMPLETE_PDI_ENV'
  | 'SANDBOX_FORBIDDEN_IN_PRODUCTION'
  | 'FRONTEND_SERVER_ENV_MISMATCH'
  | 'AMBIGUOUS_PDI_ENV';

export interface ServerFirebaseInitGateResult {
  blocked: boolean;
  sandboxDisabled: boolean;
  runtimeDisabled: boolean;
  blockReason: ServerFirebaseBlockReason | null;
}

/**
 * STAGING-00-B3-R2 :
 * Validation fail-closed exécutée AVANT toute initialisation Firebase Admin (`initializeApp`, `getAuth`, `new Firestore`).
 * Règles impératives :
 * - résolution invalide : BLOQUER ;
 * - configuration incomplète (`PDI_ENV` absent ou `VITE_PDI_ENV` absent) : BLOQUER ;
 * - mode sandbox : BLOQUER ;
 * - `NODE_ENV=production` avec mode sandbox : BLOQUER ;
 * - configuration explicitement cohérente `production` / `development` / `test` : AUTORISER.
 */
export function evaluateServerFirebaseInitGate(
  env?: Record<string, unknown>
): ServerFirebaseInitGateResult {
  if (isStagingSandboxMode(env)) {
    return {
      blocked: true,
      sandboxDisabled: true,
      runtimeDisabled: true,
      blockReason: 'SANDBOX_MODE'
    };
  }

  const resolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });

  if (!resolution.isValid) {
    const reason: ServerFirebaseBlockReason =
      resolution.errorCode ?? 'AMBIGUOUS_PDI_ENV';
    return {
      blocked: true,
      sandboxDisabled: reason === 'SANDBOX_FORBIDDEN_IN_PRODUCTION',
      runtimeDisabled: true,
      blockReason: reason
    };
  }

  if (resolution.isSandbox) {
    return {
      blocked: true,
      sandboxDisabled: true,
      runtimeDisabled: true,
      blockReason: 'SANDBOX_MODE'
    };
  }

  const hasExplicitServerEnv =
    typeof resolution.serverPdiEnv === 'string' && resolution.serverPdiEnv.trim().length > 0;
  const hasExplicitClientEnv =
    typeof resolution.clientVitePdiEnv === 'string' &&
    resolution.clientVitePdiEnv.trim().length > 0;

  if (!hasExplicitServerEnv || !hasExplicitClientEnv) {
    return {
      blocked: true,
      sandboxDisabled: false,
      runtimeDisabled: true,
      blockReason: 'INCOMPLETE_PDI_ENV'
    };
  }

  return {
    blocked: false,
    sandboxDisabled: false,
    runtimeDisabled: false,
    blockReason: null
  };
}

export function shouldBlockServerFirebaseInit(env?: Record<string, unknown>): boolean {
  return evaluateServerFirebaseInitGate(env).blocked;
}

function createSandboxDisabledServerProxy<T extends object>(serviceName: string): T {
  const throwForbidden = (): never => {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Service refusé : ${serviceName}]`);
  };

  return new Proxy(Object.create(null), {
    get(_target, prop) {
      if (prop === '__sandboxDisabled') return true;
      if (prop === 'then') return undefined;
      if (prop === Symbol.toStringTag) return `SandboxDisabled(${serviceName})`;
      throwForbidden();
    },
    set() {
      return throwForbidden();
    },
    apply() {
      return throwForbidden();
    },
    has(_target, prop) {
      if (prop === '__sandboxDisabled') return true;
      return throwForbidden();
    }
  }) as unknown as T;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-01 & FIX-02 :
 * Validation stricte du Project ID côté serveur.
 * Refuse toute valeur absente, vide, de démonstration ('demo-*') ou différente de 'graphical-router-x18qq'.
 */
export function validateServerProjectId(projectId: unknown): string {
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new Error(
      '[FATAL] Configuration serveur Firebase refusée : Project ID absent ou vide.'
    );
  }
  const normalized = projectId.trim();
  if (normalized.startsWith('demo-')) {
    throw new Error(
      '[FATAL] Production startup error: Cannot use demo project ID in server configuration.'
    );
  }
  if (normalized !== EXPECTED_SERVER_PROJECT_ID) {
    throw new Error(
      `[FATAL] Configuration serveur Firebase refusée : Project ID non autorisé ('${normalized}'). Attendu : '${EXPECTED_SERVER_PROJECT_ID}'.`
    );
  }
  return EXPECTED_SERVER_PROJECT_ID;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-01 & FIX-02 :
 * Validation stricte du Database ID Firestore côté serveur.
 * Refuse toute valeur absente, vide, '(default)' ou différente de la base nommée attendue.
 */
export function validateServerDatabaseId(databaseId: unknown): string {
  if (typeof databaseId !== 'string' || databaseId.trim().length === 0) {
    throw new Error(
      "[FATAL] Configuration serveur Firestore refusée : Database ID (FIREBASE_DATABASE_ID) absent ou vide. Aucun fallback vers '(default)' n'est autorisé."
    );
  }
  const normalized = databaseId.trim();
  if (normalized === '(default)') {
    throw new Error(
      "[FATAL] Configuration serveur Firestore refusée : la base '(default)' est formellement interdite côté serveur."
    );
  }
  if (normalized !== EXPECTED_SERVER_DATABASE_ID) {
    throw new Error(
      `[FATAL] Configuration serveur Firestore refusée : Database ID non autorisé ('${normalized}'). Attendu : '${EXPECTED_SERVER_DATABASE_ID}'.`
    );
  }
  return EXPECTED_SERVER_DATABASE_ID;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-D) :
 * Résout et valide la configuration serveur sans JAMAIS dépendre d'une variable préfixée par VITE_.
 * Examine simultanément FIREBASE_PROJECT_ID, GOOGLE_CLOUD_PROJECT et GCLOUD_PROJECT :
 * - Toute variable définie mais vide est immédiatement rejetée.
 * - Si plusieurs variables sont définies avec des valeurs contradictoires, lève une erreur explicite de conflit.
 * - Chaque variable renseignée doit valoir exactement 'graphical-router-x18qq'.
 */
export function resolveServerFirestoreConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env
    ? process.env
    : {},
  options?: { requireExplicitEnv?: boolean }
): { projectId: string; databaseId: string } {
  const pdiResolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });
  if (isStagingSandboxMode(env) || !pdiResolution.isValid || pdiResolution.isSandbox) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [resolveServerFirestoreConfig interdit en mode Sandbox ou configuration invalide]`
    );
  }

  const sourceEnv = env && typeof env === 'object' ? env : {};
  const requireExplicit = Boolean(options?.requireExplicitEnv);

  const definedProjectEntries: Array<{ key: string; rawValue: unknown }> = [];
  for (const key of SERVER_PROJECT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceEnv, key) && sourceEnv[key] !== undefined) {
      definedProjectEntries.push({ key, rawValue: sourceEnv[key] });
    }
  }

  let projectId: string;
  if (definedProjectEntries.length === 0) {
    if (requireExplicit) {
      projectId = validateServerProjectId(undefined);
    } else {
      projectId = validateServerProjectId(EXPECTED_SERVER_PROJECT_ID);
    }
  } else {
    // 1. Vérifier qu'aucune variable définie n'est vide ou non-string
    const trimmedEntries: Array<{ key: string; value: string }> = [];
    for (const entry of definedProjectEntries) {
      if (typeof entry.rawValue !== 'string' || entry.rawValue.trim().length === 0) {
        throw new Error(
          `[FATAL] Configuration serveur Firebase refusée : la variable '${entry.key}' est définie mais Project ID absent ou vide.`
        );
      }
      trimmedEntries.push({ key: entry.key, value: entry.rawValue.trim() });
    }

    // 2. Détecter tout conflit entre les variables de projet définies simultanément
    const distinctValues = new Set(trimmedEntries.map((e) => e.value));
    if (distinctValues.size > 1) {
      const details = trimmedEntries.map((e) => `${e.key}='${e.value}'`).join(', ');
      throw new Error(
        `[FATAL] Configuration serveur Firebase refusée : conflit entre les variables d'environnement de projet (${details}). Project ID non autorisé ou contradictoire. Attendu : '${EXPECTED_SERVER_PROJECT_ID}'.`
      );
    }

    // 3. Valider individuellement chaque variable définie
    let lastValidated = EXPECTED_SERVER_PROJECT_ID;
    for (const entry of trimmedEntries) {
      lastValidated = validateServerProjectId(entry.value);
    }
    projectId = lastValidated;
  }

  const hasExplicitDatabaseId =
    Object.prototype.hasOwnProperty.call(sourceEnv, 'FIREBASE_DATABASE_ID') &&
    sourceEnv.FIREBASE_DATABASE_ID !== undefined;

  const rawDatabaseId =
    requireExplicit || hasExplicitDatabaseId
      ? sourceEnv.FIREBASE_DATABASE_ID
      : EXPECTED_SERVER_DATABASE_ID;

  const databaseId = validateServerDatabaseId(rawDatabaseId);

  return { projectId, databaseId };
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-B) :
 * Vérifie que l'instance Firebase Admin App possède un options.projectId valide et conforme au projet attendu.
 */
export function validateServerFirebaseAppProjectId(
  appInstance: any,
  expectedProjectId: unknown = EXPECTED_SERVER_PROJECT_ID
): string {
  if (!appInstance || typeof appInstance !== 'object') {
    throw new Error(
      "[FATAL] Configuration serveur Firebase Admin refusée : instance d'application Admin absente ou invalide."
    );
  }
  const validatedExpected = validateServerProjectId(expectedProjectId);
  const rawAppProjectId = appInstance?.options?.projectId;
  const validatedAppProjectId = validateServerProjectId(rawAppProjectId);

  if (validatedAppProjectId !== validatedExpected) {
    throw new Error(
      `[FATAL] Configuration serveur Firebase Admin refusée : le projectId de l'application Admin ('${validatedAppProjectId}') diverge du projet attendu ('${validatedExpected}').`
    );
  }
  return validatedAppProjectId;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-B) :
 * Sélectionne explicitement l'application Firebase Admin '[DEFAULT]' (sans jamais utiliser getApps()[0]),
 * l'initialise si elle n'existe pas, et valide son options.projectId avant toute initialisation d'Authentication.
 */
export function getOrInitializeServerFirebaseApp(
  config?: { projectId?: unknown },
  sdk?: {
    getApps?: typeof getApps;
    getApp?: typeof getApp;
    initializeApp?: typeof initializeApp;
  },
  env?: Record<string, unknown>
): ReturnType<typeof initializeApp> {
  if (shouldBlockServerFirebaseInit(env)) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [getOrInitializeServerFirebaseApp / initializeApp interdit en mode Sandbox]`
    );
  }

  const expectedProjectId = validateServerProjectId(
    config && Object.prototype.hasOwnProperty.call(config, 'projectId')
      ? config.projectId
      : EXPECTED_SERVER_PROJECT_ID
  );

  const listApps = sdk?.getApps ?? getApps;
  const fetchDefaultApp = sdk?.getApp ?? getApp;
  const createApp = sdk?.initializeApp ?? initializeApp;

  const existingApps = listApps();
  const defaultAppInList = Array.isArray(existingApps)
    ? existingApps.find(
        (candidate: any) =>
          candidate && typeof candidate === 'object' && candidate.name === '[DEFAULT]'
      )
    : undefined;

  let resolvedApp: any;
  if (defaultAppInList) {
    resolvedApp = typeof fetchDefaultApp === 'function' ? fetchDefaultApp() : defaultAppInList;
    if (!resolvedApp || typeof resolvedApp !== 'object') {
      resolvedApp = defaultAppInList;
    }
    if (resolvedApp.name !== undefined && resolvedApp.name !== '[DEFAULT]') {
      throw new Error(
        `[FATAL] Configuration serveur Firebase Admin refusée : l'application sélectionnée ('${String(resolvedApp.name)}') n'est pas l'application '[DEFAULT]'.`
      );
    }
  } else {
    resolvedApp = createApp({
      projectId: expectedProjectId
    });
  }

  validateServerFirebaseAppProjectId(resolvedApp, expectedProjectId);
  return resolvedApp;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-B) :
 * Initialise Firebase Admin Auth uniquement après validation stricte du projectId de l'application Admin.
 */
export function createServerAdminAuth(
  appInstance: any,
  expectedProjectId: unknown = EXPECTED_SERVER_PROJECT_ID,
  authFactory: typeof getAuth = getAuth,
  env?: Record<string, unknown>
): ReturnType<typeof getAuth> {
  if (shouldBlockServerFirebaseInit(env)) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [createServerAdminAuth / getAuth interdit en mode Sandbox]`
    );
  }
  validateServerFirebaseAppProjectId(appInstance, expectedProjectId);
  return authFactory(appInstance);
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-02 (FIX-02-C) :
 * Extrait le Project ID d'une instance Firestore serveur exclusivement à partir des propriétés natives
 * fiables de @google-cloud/firestore (projectId ou _settings.projectId).
 * Une propriété .app seule ne suffit JAMAIS à prouver le projet d'une instance Firestore.
 * Si une propriété .app est néanmoins présente sur l'objet (ex. mock de test), elle doit être valide et cohérente.
 */
export function extractServerFirestoreProjectId(dbInstance: any): string | null {
  if (!dbInstance || typeof dbInstance !== 'object') {
    return null;
  }

  const ownProjDesc = Object.getOwnPropertyDescriptor(dbInstance, 'projectId');
  if (ownProjDesc && !Object.prototype.hasOwnProperty.call(ownProjDesc, 'value')) {
    return null;
  }
  const ownSettingsDesc = Object.getOwnPropertyDescriptor(dbInstance, '_settings');
  if (ownSettingsDesc && !Object.prototype.hasOwnProperty.call(ownSettingsDesc, 'value')) {
    return null;
  }

  const directProjectId =
    typeof dbInstance?.projectId === 'string' && dbInstance.projectId.trim().length > 0
      ? dbInstance.projectId.trim()
      : null;

  const settingsObj = ownSettingsDesc ? ownSettingsDesc.value : dbInstance?._settings;
  let settingsProjectId: string | null = null;
  if (settingsObj && typeof settingsObj === 'object') {
    const settingsProjDesc = Object.getOwnPropertyDescriptor(settingsObj, 'projectId');
    if (settingsProjDesc && !Object.prototype.hasOwnProperty.call(settingsProjDesc, 'value')) {
      return null;
    }
    if (
      typeof settingsObj.projectId === 'string' &&
      settingsObj.projectId.trim().length > 0
    ) {
      settingsProjectId = settingsObj.projectId.trim();
    }
  }

  if (directProjectId && settingsProjectId && directProjectId !== settingsProjectId) {
    return null;
  }

  // Exigence FIX-02-C (3 & 4) : Le projet doit obligatoirement provenir d'une propriété native de Firestore
  const nativeProjectId = directProjectId || settingsProjectId;
  if (!nativeProjectId) {
    return null;
  }

  // Exigence FIX-02-C (6) : Protection contre les objets incohérents ou mocks qui définissent .app
  if ('app' in dbInstance) {
    const ownAppDesc = Object.getOwnPropertyDescriptor(dbInstance, 'app');
    if (ownAppDesc && !Object.prototype.hasOwnProperty.call(ownAppDesc, 'value')) {
      return null;
    }
    if (!dbInstance.app || typeof dbInstance.app !== 'object') {
      return null;
    }
    const appProjectId =
      typeof dbInstance.app?.options?.projectId === 'string' &&
      dbInstance.app.options.projectId.trim().length > 0
        ? dbInstance.app.options.projectId.trim()
        : null;
    if (!appProjectId || appProjectId !== nativeProjectId) {
      return null;
    }
  }

  return nativeProjectId;
}

export function extractServerFirestoreDatabaseId(dbInstance: any): string | null {
  if (!dbInstance || typeof dbInstance !== 'object') {
    return null;
  }
  const ownDbDesc = Object.getOwnPropertyDescriptor(dbInstance, 'databaseId');
  if (ownDbDesc && !Object.prototype.hasOwnProperty.call(ownDbDesc, 'value')) {
    return null;
  }
  const ownSettingsDesc = Object.getOwnPropertyDescriptor(dbInstance, '_settings');
  if (ownSettingsDesc && !Object.prototype.hasOwnProperty.call(ownSettingsDesc, 'value')) {
    return null;
  }

  const directDatabaseId =
    typeof dbInstance?.databaseId === 'string' && dbInstance.databaseId.trim().length > 0
      ? dbInstance.databaseId.trim()
      : null;

  const settingsObj = ownSettingsDesc ? ownSettingsDesc.value : dbInstance?._settings;
  let settingsDatabaseId: string | null = null;
  if (settingsObj && typeof settingsObj === 'object') {
    const settingsDbDesc = Object.getOwnPropertyDescriptor(settingsObj, 'databaseId');
    if (settingsDbDesc && !Object.prototype.hasOwnProperty.call(settingsDbDesc, 'value')) {
      return null;
    }
    if (
      typeof settingsObj.databaseId === 'string' &&
      settingsObj.databaseId.trim().length > 0
    ) {
      settingsDatabaseId = settingsObj.databaseId.trim();
    }
  }

  if (directDatabaseId && settingsDatabaseId && directDatabaseId !== settingsDatabaseId) {
    return null;
  }
  return directDatabaseId || settingsDatabaseId || null;
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-01 & FIX-02 (4.3 & FIX-02-C) :
 * Vérifie strictement qu'une instance Firestore serveur cible le projet autorisé
 * et la base nommée attendue avant toute opération critique.
 * Si une application Admin est fournie, vérifie séparément que son projectId concorde avec celui du client Firestore.
 */
export function assertValidServerFirestoreInstance(
  dbInstance: any,
  expected: { projectId?: unknown; databaseId?: unknown } = {},
  adminAppInstance?: any
): { projectId: string; databaseId: string } {
  const expectedProjectId = validateServerProjectId(
    expected && Object.prototype.hasOwnProperty.call(expected, 'projectId')
      ? expected.projectId
      : EXPECTED_SERVER_PROJECT_ID
  );
  const expectedDatabaseId = validateServerDatabaseId(
    expected && Object.prototype.hasOwnProperty.call(expected, 'databaseId')
      ? expected.databaseId
      : EXPECTED_SERVER_DATABASE_ID
  );

  const actualProjectId = extractServerFirestoreProjectId(dbInstance);
  if (!actualProjectId || actualProjectId !== expectedProjectId) {
    throw new Error(
      `[FATAL] Vérification Firestore serveur refusée : Project ID réel du client ('${actualProjectId ?? 'inconnu'}') non conforme à '${expectedProjectId}'.`
    );
  }

  const actualDatabaseId = extractServerFirestoreDatabaseId(dbInstance);
  if (!actualDatabaseId || actualDatabaseId === '(default)' || actualDatabaseId !== expectedDatabaseId) {
    throw new Error(
      `[FATAL] Vérification Firestore serveur refusée : Database ID réel du client ('${actualDatabaseId ?? 'inconnu'}') non conforme à la base nommée '${expectedDatabaseId}'.`
    );
  }

  if (adminAppInstance !== undefined) {
    const adminAppProjectId = validateServerFirebaseAppProjectId(adminAppInstance, expectedProjectId);
    if (adminAppProjectId !== actualProjectId) {
      throw new Error(
        `[FATAL] Vérification Firestore serveur refusée : divergence de projectId entre l'application Admin ('${adminAppProjectId}') et le client Firestore ('${actualProjectId}').`
      );
    }
  }

  return {
    projectId: actualProjectId,
    databaseId: actualDatabaseId
  };
}

/**
 * FIRESTORE-NAMED-DB-01-FIX-01 & FIX-02 (4.2 & FIX-02-C) :
 * Construit un client officiel stable @google-cloud/firestore avec { projectId, databaseId } explicites,
 * sans injection artificielle de propriété .app, et vérifie immédiatement sa cible réelle et sa cohérence avec l'application Admin.
 */
export function createServerFirestoreClient(
  config?: { projectId?: unknown; databaseId?: unknown },
  adminAppInstance?: any,
  firestoreFactory?: (settings: { projectId: string; databaseId: string }) => Firestore,
  env?: Record<string, unknown>
): Firestore {
  if (shouldBlockServerFirebaseInit(env)) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [createServerFirestoreClient / Firestore interdit en mode Sandbox]`
    );
  }

  const validatedProjectId = validateServerProjectId(
    config && Object.prototype.hasOwnProperty.call(config, 'projectId')
      ? config.projectId
      : EXPECTED_SERVER_PROJECT_ID
  );
  const validatedDatabaseId = validateServerDatabaseId(
    config && Object.prototype.hasOwnProperty.call(config, 'databaseId')
      ? config.databaseId
      : EXPECTED_SERVER_DATABASE_ID
  );

  if (adminAppInstance !== undefined) {
    validateServerFirebaseAppProjectId(adminAppInstance, validatedProjectId);
  }

  const firestoreClient = firestoreFactory
    ? firestoreFactory({
        projectId: validatedProjectId,
        databaseId: validatedDatabaseId
      })
    : new Firestore({
        projectId: validatedProjectId,
        databaseId: validatedDatabaseId
      });

  assertValidServerFirestoreInstance(
    firestoreClient,
    {
      projectId: validatedProjectId,
      databaseId: validatedDatabaseId
    },
    adminAppInstance
  );

  return firestoreClient;
}

export interface ServerFirebaseAdminRuntime {
  sandboxDisabled: boolean;
  runtimeDisabled: boolean;
  blockReason: ServerFirebaseBlockReason | null;
  config: { projectId: string; databaseId: string } | null;
  adminApp: ReturnType<typeof initializeApp>;
  adminAuth: ReturnType<typeof getAuth>;
  adminDb: Firestore;
}

/**
 * STAGING-00-B3-R1 & STAGING-00-B3-R2 :
 * Initialise conditionnellement Firebase Admin et Firestore côté serveur avec contrôle fail-closed préalable.
 * - Lorsque `shouldBlockServerFirebaseInit(env)` est vrai (mode Sandbox, `PDI_ENV` absent, `VITE_PDI_ENV` absent,
 *   incohérence `PDI_ENV !== VITE_PDI_ENV`, valeur invalide, ou `NODE_ENV=production` + sandbox) :
 *   1. Aucune résolution de configuration Firebase Production.
 *   2. Aucun appel à `initializeApp` (Firebase Admin).
 *   3. Aucun appel à `getAuth` (Firebase Admin Auth).
 *   4. Aucune instanciation de `Firestore` (`@google-cloud/firestore`).
 *   5. Retourne `config: null`, `runtimeDisabled: true` et des proxies fail-closed.
 * - Lorsque `PDI_ENV` et `VITE_PDI_ENV` sont explicitement définis, valides, cohérents et hors Sandbox :
 *   Exécute l'initialisation nominale complète avec validation stricte du projet et de la base Firestore nommée.
 */
export function initializeServerFirebaseAdminRuntime(
  env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env
    ? process.env
    : {},
  sdk?: {
    getApps?: typeof getApps;
    getApp?: typeof getApp;
    initializeApp?: typeof initializeApp;
    getAuth?: typeof getAuth;
    createFirestore?: (settings: { projectId: string; databaseId: string }) => Firestore;
  }
): ServerFirebaseAdminRuntime {
  const gate = evaluateServerFirebaseInitGate(env);
  if (gate.blocked) {
    return {
      sandboxDisabled: gate.sandboxDisabled,
      runtimeDisabled: true,
      blockReason: gate.blockReason,
      config: null,
      adminApp: createSandboxDisabledServerProxy<ReturnType<typeof initializeApp>>('adminApp'),
      adminAuth: createSandboxDisabledServerProxy<ReturnType<typeof getAuth>>('adminAuth'),
      adminDb: createSandboxDisabledServerProxy<Firestore>('adminDb')
    };
  }

  const serverFirestoreConfig = resolveServerFirestoreConfig(env);
  const appInstance = getOrInitializeServerFirebaseApp(serverFirestoreConfig, sdk, env);
  const authInstance = createServerAdminAuth(
    appInstance,
    serverFirestoreConfig.projectId,
    sdk?.getAuth ?? getAuth,
    env
  );
  const dbInstance = createServerFirestoreClient(
    serverFirestoreConfig,
    appInstance,
    sdk?.createFirestore,
    env
  );

  return {
    sandboxDisabled: false,
    runtimeDisabled: false,
    blockReason: null,
    config: serverFirestoreConfig,
    adminApp: appInstance,
    adminAuth: authInstance,
    adminDb: dbInstance
  };
}

function bootstrapActiveServerFirebaseRuntime(): ServerFirebaseAdminRuntime {
  const isVercelRuntime =
    typeof process !== 'undefined' &&
    (process.env?.VERCEL === '1' || process.env?.VERCEL === 'true');
  if (!isVercelRuntime) {
    return initializeServerFirebaseAdminRuntime();
  }
  try {
    return initializeServerFirebaseAdminRuntime();
  } catch (err) {
    console.warn(
      '[VERCEL-API-01] Firebase Admin top-level initialization disabled (fail-closed) on Vercel:',
      err instanceof Error ? err.message : 'configuration unavailable'
    );
    return {
      sandboxDisabled: false,
      runtimeDisabled: true,
      blockReason: 'INCOMPLETE_PDI_ENV',
      config: null,
      adminApp: createSandboxDisabledServerProxy<ReturnType<typeof initializeApp>>('adminApp'),
      adminAuth: createSandboxDisabledServerProxy<ReturnType<typeof getAuth>>('adminAuth'),
      adminDb: createSandboxDisabledServerProxy<Firestore>('adminDb')
    };
  }
}

const activeServerFirebaseRuntime = bootstrapActiveServerFirebaseRuntime();

export const isServerFirebaseSandboxDisabled = activeServerFirebaseRuntime.sandboxDisabled;
export const isServerFirebaseRuntimeDisabled = activeServerFirebaseRuntime.runtimeDisabled;
export const serverFirebaseBlockReason = activeServerFirebaseRuntime.blockReason;
export const serverFirebaseRuntimeConfig = activeServerFirebaseRuntime.config;
export const adminApp = activeServerFirebaseRuntime.adminApp;
export const adminAuth = activeServerFirebaseRuntime.adminAuth;
export const adminDb = activeServerFirebaseRuntime.adminDb;

export function getServerAdminApp(env?: Record<string, unknown>): ReturnType<typeof initializeApp> {
  if (shouldBlockServerFirebaseInit(env) || activeServerFirebaseRuntime.runtimeDisabled) {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Accès à adminApp refusé]`);
  }
  return adminApp;
}

export function getServerAdminAuth(env?: Record<string, unknown>): ReturnType<typeof getAuth> {
  if (shouldBlockServerFirebaseInit(env) || activeServerFirebaseRuntime.runtimeDisabled) {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Accès à adminAuth refusé]`);
  }
  return adminAuth;
}

export function getServerAdminDb(env?: Record<string, unknown>): Firestore {
  if (shouldBlockServerFirebaseInit(env) || activeServerFirebaseRuntime.runtimeDisabled) {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Accès à adminDb refusé]`);
  }
  return adminDb;
}

