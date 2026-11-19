import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';
import { isStagingSandboxMode, resolvePdiEnvironmentMode } from '../lib/stagingSandbox.ts';

export const SANDBOX_POSTGRES_FORBIDDEN_ERROR =
  'Coupe-circuit Sandbox / Fail-Closed PostgreSQL (STAGING-00-B4-A) : PostgreSQL / Cloud SQL est strictement désactivé en mode Sandbox ou lorsque PDI_ENV / VITE_PDI_ENV est absent, incohérent ou invalide.';

export type ServerPostgresBlockReason =
  | 'SANDBOX_MODE'
  | 'INCOMPLETE_PDI_ENV'
  | 'SANDBOX_FORBIDDEN_IN_PRODUCTION'
  | 'FRONTEND_SERVER_ENV_MISMATCH'
  | 'AMBIGUOUS_PDI_ENV';

export interface ServerPostgresInitGateResult {
  blocked: boolean;
  sandboxDisabled: boolean;
  blockReason: ServerPostgresBlockReason | null;
}

/**
 * STAGING-00-B4-A & B4-F :
 * Validation fail-closed exécutée AVANT toute création de Pool PostgreSQL (`new Pool()`)
 * et AVANT toute requête Drizzle.
 * - Mode Sandbox : BLOQUER ;
 * - Configuration absente, incomplète, incohérente ou invalide : BLOQUER ;
 * - NODE_ENV=production + Sandbox : BLOQUER ;
 * - Configuration explicitement cohérente hors Sandbox (production / development / test) : AUTORISER.
 */
export function evaluateServerPostgresInitGate(
  env?: Record<string, unknown>
): ServerPostgresInitGateResult {
  if (isStagingSandboxMode(env)) {
    return {
      blocked: true,
      sandboxDisabled: true,
      blockReason: 'SANDBOX_MODE',
    };
  }

  const resolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true,
  });

  if (!resolution.isValid) {
    const reason: ServerPostgresBlockReason =
      resolution.errorCode ?? 'AMBIGUOUS_PDI_ENV';
    return {
      blocked: true,
      sandboxDisabled: reason === 'SANDBOX_FORBIDDEN_IN_PRODUCTION',
      blockReason: reason,
    };
  }

  if (resolution.isSandbox) {
    return {
      blocked: true,
      sandboxDisabled: true,
      blockReason: 'SANDBOX_MODE',
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
      blockReason: 'INCOMPLETE_PDI_ENV',
    };
  }

  return {
    blocked: false,
    sandboxDisabled: false,
    blockReason: null,
  };
}

export function shouldBlockServerPostgresInit(env?: Record<string, unknown>): boolean {
  return evaluateServerPostgresInitGate(env).blocked;
}

// Global connection pool & Drizzle instance caching to persist across hot-reloads (STRICTLY LAZY)
declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: NodePgDatabase<typeof schema> | undefined;
}

export function isPostgresPoolInitialized(): boolean {
  return Boolean(global._postgresPool);
}

export function resetPostgresRuntimeForTests(): void {
  global._postgresPool = undefined;
  global._drizzleDb = undefined;
}

/**
 * STAGING-00-B4-A :
 * Initialisation paresseuse (lazy) du Pool PostgreSQL.
 * Aucun `new Pool()` n'est exécuté au chargement du module ni en mode Sandbox / fail-closed.
 */
export const createPool = (
  env?: Record<string, unknown>,
  poolFactory?: (config: PoolConfig) => Pool
): Pool => {
  const gate = evaluateServerPostgresInitGate(env);
  if (gate.blocked) {
    throw new Error(
      `${SANDBOX_POSTGRES_FORBIDDEN_ERROR} [Raison : ${gate.blockReason ?? 'BLOCKED'}]`
    );
  }

  if (!global._postgresPool) {
    const sourceEnv = (env ?? process.env) as Record<string, string | undefined>;
    const poolConfig: PoolConfig = {
      host: sourceEnv.SQL_HOST,
      user: sourceEnv.SQL_USER,
      password: sourceEnv.SQL_PASSWORD,
      database: sourceEnv.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    };

    const instance = poolFactory ? poolFactory(poolConfig) : new Pool(poolConfig);

    // Prevent unhandled pool-level errors from crashing the application
    if (typeof instance.on === 'function') {
      instance.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    }

    global._postgresPool = instance;
  }

  return global._postgresPool;
};

/**
 * STAGING-00-B4-A :
 * Retourne l'instance Drizzle de manière paresseuse, uniquement hors Sandbox et
 * après validation fail-closed de l'environnement.
 */
export const getDb = (
  env?: Record<string, unknown>,
  poolFactory?: (config: PoolConfig) => Pool
): NodePgDatabase<typeof schema> => {
  const gate = evaluateServerPostgresInitGate(env);
  if (gate.blocked) {
    throw new Error(
      `${SANDBOX_POSTGRES_FORBIDDEN_ERROR} [Raison : ${gate.blockReason ?? 'BLOCKED'}]`
    );
  }

  if (!global._drizzleDb) {
    const pool = createPool(env, poolFactory);
    global._drizzleDb = drizzle(pool, { schema });
  }

  return global._drizzleDb;
};

const NODE_UTIL_INSPECT_CUSTOM = Symbol.for('nodejs.util.inspect.custom');

/**
 * Proxy paresseux conservant la compatibilité de l'export `db` sans jamais
 * instancier `new Pool()` ni `drizzle(...)` lors de l'import du module.
 * - Transmet `activeDb` comme récepteur `Reflect.get` pour préserver le contexte `this`
 *   des getters et champs internes Drizzle ;
 * - Lie les méthodes retournées à `activeDb` (compatible avec la déstructuration) ;
 * - Transmet les opérateurs `in` (`has`) et assignations (`set`) à l'instance Drizzle active.
 */
export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      if (prop === Symbol.toStringTag) return 'LazyPostgresDrizzleDb';
      if (prop === NODE_UTIL_INSPECT_CUSTOM) {
        return () =>
          global._drizzleDb
            ? '[LazyPostgresDrizzleDb (initialized)]'
            : '[LazyPostgresDrizzleDb (uninitialized)]';
      }
      const activeDb = getDb();
      const value = Reflect.get(activeDb as object, prop, activeDb);
      return typeof value === 'function' ? value.bind(activeDb) : value;
    },
    has(_target, prop) {
      const activeDb = getDb();
      return Reflect.has(activeDb as object, prop);
    },
    set(_target, prop, value) {
      const activeDb = getDb();
      return Reflect.set(activeDb as object, prop, value, activeDb);
    },
  }
);
