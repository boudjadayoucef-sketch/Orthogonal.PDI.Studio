/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * STAGING-00-B3 — ISOLATED SANDBOX MODE FOR GOOGLE AI STUDIO SHARE
 *
 * Guarantees:
 * - C1: Complete Firebase Production kill-switch (zero initialization, zero network requests).
 * - C2: Zero-Trust server rejection of synthetic identities and state-mutating routes in Sandbox.
 * - C3: Isolated localStorage namespace (`pdi.sandbox.staging.v1.`) preserving historical keys.
 * - C4: Permanent, non-dismissible Sandbox banner constants.
 * - C5: Strict prohibition of Sandbox in production (`NODE_ENV === "production"`),
 *       rejection of frontend/server mismatches (`VITE_PDI_ENV` vs `PDI_ENV`),
 *       and rejection of ambiguous environment configurations.
 */

export const SANDBOX_STORAGE_PREFIX = "pdi.sandbox.staging.v1." as const;

export const SANDBOX_BANNER_LINES = [
  "ENVIRONNEMENT SANDBOX DE TEST — AI STUDIO SHARE",
  "DONNÉES SYNTHÉTIQUES LOCALES",
  "FIREBASE PRODUCTION DÉSACTIVÉ",
  "STAGING-00-B4 — ENVIRONNEMENT DE TEST",
] as const;

export const HISTORICAL_PROTECTED_STORAGE_PREFIXES = [
  "pdi.projects.index.v1",
  "isometrie.autosave.v474",
] as const;

export const SANDBOX_SYNTHETIC_TOKEN_PREFIX = "sandbox_synthetic_token_" as const;
export const SANDBOX_SYNTHETIC_UID_PREFIX = "sandbox_local_uid_" as const;

export type PdiEnvironmentMode = "production" | "development" | "test" | "sandbox";

export type PdiEnvironmentErrorCode =
  | "SANDBOX_FORBIDDEN_IN_PRODUCTION"
  | "FRONTEND_SERVER_ENV_MISMATCH"
  | "AMBIGUOUS_PDI_ENV";

export interface PdiEnvironmentResolution {
  isValid: boolean;
  mode: PdiEnvironmentMode;
  isSandbox: boolean;
  serverPdiEnv?: string;
  clientVitePdiEnv?: string;
  nodeEnv?: string;
  errorCode?: PdiEnvironmentErrorCode;
  errorMessage?: string;
}

const ALLOWED_PDI_ENV_VALUES = new Set<string>([
  "production",
  "development",
  "test",
  "sandbox",
]);

export const PDI_RUNTIME_CONFIG_GLOBAL_KEY = "__PDI_RUNTIME_CONFIG__" as const;

/**
 * STAGING-00-B4-FIX-ENV-02 (Partie C) :
 * Configuration publique minimale injectée par le serveur dans `index.html` avant
 * le chargement des modules frontend.
 * Ne contient JAMAIS de secret, clé API, URL de base de données ni identifiant.
 */
export interface PdiPublicRuntimeConfig {
  pdiEnv: PdiEnvironmentMode;
}

export interface InjectedBrowserRuntimeConfigRead {
  present: boolean;
  isValid: boolean;
  rawValue?: string;
  pdiEnv?: PdiEnvironmentMode;
}

export function readInjectedBrowserRuntimeConfig(
  globalObj: Record<string, unknown> | undefined = typeof globalThis !== "undefined"
    ? (globalThis as unknown as Record<string, unknown>)
    : undefined
): InjectedBrowserRuntimeConfigRead {
  const fromWindow =
    typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>)[PDI_RUNTIME_CONFIG_GLOBAL_KEY]
      : undefined;
  const candidate =
    globalObj && Object.prototype.hasOwnProperty.call(globalObj, PDI_RUNTIME_CONFIG_GLOBAL_KEY)
      ? globalObj[PDI_RUNTIME_CONFIG_GLOBAL_KEY]
      : fromWindow;

  if (candidate === undefined || candidate === null) {
    return { present: false, isValid: true };
  }

  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    return { present: true, isValid: false, rawValue: String(candidate) };
  }

  const rawPdiEnv = (candidate as Record<string, unknown>).pdiEnv;
  if (typeof rawPdiEnv !== "string" || rawPdiEnv.trim().length === 0) {
    return { present: true, isValid: false, rawValue: String(rawPdiEnv ?? "") };
  }

  const normalized = rawPdiEnv.trim();
  if (!ALLOWED_PDI_ENV_VALUES.has(normalized)) {
    return { present: true, isValid: false, rawValue: normalized };
  }

  return {
    present: true,
    isValid: true,
    rawValue: normalized,
    pdiEnv: normalized as PdiEnvironmentMode,
  };
}

/**
 * Construit la configuration publique minimale à injecter côté serveur dans `index.html`.
 * Retourne `null` si la configuration serveur est absente, incomplète, invalide, incohérente
 * ou en violation de la protection C5 (`NODE_ENV=production` + `sandbox`).
 */
export function buildPublicBrowserRuntimeConfig(
  env?: Record<string, unknown>
): PdiPublicRuntimeConfig | null {
  const resolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true,
  });

  if (!resolution.isValid) {
    return null;
  }

  const hasExplicitServerEnv =
    typeof resolution.serverPdiEnv === "string" && resolution.serverPdiEnv.trim().length > 0;
  const hasExplicitClientEnv =
    typeof resolution.clientVitePdiEnv === "string" &&
    resolution.clientVitePdiEnv.trim().length > 0;

  if (!hasExplicitServerEnv || !hasExplicitClientEnv) {
    return null;
  }

  if (!ALLOWED_PDI_ENV_VALUES.has(resolution.mode)) {
    return null;
  }

  return {
    pdiEnv: resolution.mode,
  };
}

export function serializePublicRuntimeConfigScript(
  config: PdiPublicRuntimeConfig | null
): string {
  if (!config || !ALLOWED_PDI_ENV_VALUES.has(config.pdiEnv)) {
    return "";
  }
  const safePayload = JSON.stringify({ pdiEnv: config.pdiEnv });
  return `<script id="pdi-runtime-config">window.${PDI_RUNTIME_CONFIG_GLOBAL_KEY}=Object.freeze(${safePayload});</script>`;
}

export function injectPublicRuntimeConfigIntoHtml(
  html: string,
  config: PdiPublicRuntimeConfig | null
): string {
  const scriptTag = serializePublicRuntimeConfigScript(config);
  if (!scriptTag) {
    return html;
  }
  if (html.includes("</head>")) {
    return html.replace("</head>", `    ${scriptTag}\n  </head>`);
  }
  if (html.includes("<script")) {
    return html.replace("<script", `${scriptTag}\n<script`);
  }
  return `${scriptTag}\n${html}`;
}

let sandboxTestOverride: boolean | null = null;

/**
 * Allows deterministic unit test overriding of Sandbox mode without mutating process globals.
 * Pass `null` to restore standard environment resolution.
 */
export function setStagingSandboxTestOverride(override: boolean | null): void {
  sandboxTestOverride = override;
}

export function getRuntimeCombinedEnv(
  explicitEnv?: Record<string, unknown>
): Record<string, unknown> {
  if (explicitEnv && typeof explicitEnv === "object") {
    const injectedInExplicit = Object.prototype.hasOwnProperty.call(
      explicitEnv,
      PDI_RUNTIME_CONFIG_GLOBAL_KEY
    )
      ? readInjectedBrowserRuntimeConfig(explicitEnv)
      : { present: false, isValid: true };

    if (!injectedInExplicit.present) {
      return explicitEnv;
    }

    const mergedExplicit: Record<string, unknown> = { ...explicitEnv };
    const injectedValue = injectedInExplicit.rawValue ?? "__invalid_runtime_config__";
    const existingBuildClientEnv =
      typeof mergedExplicit.VITE_PDI_ENV === "string" &&
      mergedExplicit.VITE_PDI_ENV.trim().length > 0
        ? mergedExplicit.VITE_PDI_ENV.trim()
        : undefined;

    mergedExplicit.PDI_ENV = injectedValue;
    if (!existingBuildClientEnv) {
      mergedExplicit.VITE_PDI_ENV = injectedValue;
    }
    return mergedExplicit;
  }

  const combined: Record<string, unknown> = {};

  if (typeof process !== "undefined" && process?.env) {
    for (const [k, v] of Object.entries(process.env)) {
      combined[k] = v;
    }
  }

  const metaEnv =
    typeof import.meta !== "undefined" && (import.meta as any)?.env
      ? ((import.meta as any).env as Record<string, unknown>)
      : undefined;

  if (metaEnv && typeof metaEnv === "object") {
    for (const [k, v] of Object.entries(metaEnv)) {
      if (v !== undefined) {
        combined[k] = v;
      }
    }
  }

  // STAGING-00-B4-FIX-ENV-02 (Partie C) :
  // Priorité explicite à la configuration publique runtime injectée par le serveur dans `index.html`,
  // tout en préservant la détection d'incohérence si le bundle Vite a été compilé avec un VITE_PDI_ENV différent.
  const injectedRuntime = readInjectedBrowserRuntimeConfig();
  if (injectedRuntime.present) {
    const injectedValue = injectedRuntime.rawValue ?? "__invalid_runtime_config__";
    const existingBuildClientEnv =
      typeof combined.VITE_PDI_ENV === "string" && combined.VITE_PDI_ENV.trim().length > 0
        ? combined.VITE_PDI_ENV.trim()
        : undefined;

    combined.PDI_ENV = injectedValue;
    if (!existingBuildClientEnv) {
      combined.VITE_PDI_ENV = injectedValue;
    }
  }

  return combined;
}

/**
 * Resolves and validates the PD&I execution mode from environment variables (`PDI_ENV`, `VITE_PDI_ENV`, `NODE_ENV`).
 *
 * Rules (Protection C5):
 * 1. Any non-empty value for `PDI_ENV` or `VITE_PDI_ENV` outside `production | development | test | sandbox`
 *    is rejected as ambiguous (`AMBIGUOUS_PDI_ENV`).
 * 2. When `requireServerClientCoherence` is enabled (server startup) or when both `PDI_ENV` and `VITE_PDI_ENV`
 *    are provided, any mismatch between `PDI_ENV` and `VITE_PDI_ENV` is rejected (`FRONTEND_SERVER_ENV_MISMATCH`).
 * 3. If `NODE_ENV === "production"` and either `PDI_ENV === "sandbox"` or `VITE_PDI_ENV === "sandbox"`,
 *    startup is strictly refused (`SANDBOX_FORBIDDEN_IN_PRODUCTION`).
 */
export function resolvePdiEnvironmentMode(
  explicitEnv?: Record<string, unknown>,
  options?: { requireServerClientCoherence?: boolean }
): PdiEnvironmentResolution {
  const env = getRuntimeCombinedEnv(explicitEnv);
  const requireCoherence = Boolean(options?.requireServerClientCoherence);

  const rawNodeEnv = typeof env.NODE_ENV === "string" ? env.NODE_ENV.trim() : undefined;
  const rawServerEnv = typeof env.PDI_ENV === "string" ? env.PDI_ENV.trim() : undefined;
  const rawClientEnv = typeof env.VITE_PDI_ENV === "string" ? env.VITE_PDI_ENV.trim() : undefined;

  const hasServerEnv = rawServerEnv !== undefined && rawServerEnv.length > 0;
  const hasClientEnv = rawClientEnv !== undefined && rawClientEnv.length > 0;

  if (hasServerEnv && !ALLOWED_PDI_ENV_VALUES.has(rawServerEnv!)) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "AMBIGUOUS_PDI_ENV",
      errorMessage: `Configuration PDI_ENV ambiguë ou invalide ('${rawServerEnv}'). Valeurs autorisées : production, development, test, sandbox.`,
    };
  }

  if (hasClientEnv && !ALLOWED_PDI_ENV_VALUES.has(rawClientEnv!)) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "AMBIGUOUS_PDI_ENV",
      errorMessage: `Configuration VITE_PDI_ENV ambiguë ou invalide ('${rawClientEnv}'). Valeurs autorisées : production, development, test, sandbox.`,
    };
  }

  // Check coherence between server PDI_ENV and frontend VITE_PDI_ENV
  if (hasServerEnv && hasClientEnv && rawServerEnv !== rawClientEnv) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "FRONTEND_SERVER_ENV_MISMATCH",
      errorMessage: `Incohérence de configuration entre le serveur (PDI_ENV='${rawServerEnv}') et le frontend (VITE_PDI_ENV='${rawClientEnv}').`,
    };
  }

  if (
    requireCoherence &&
    ((hasServerEnv && !hasClientEnv) || (!hasServerEnv && hasClientEnv))
  ) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "FRONTEND_SERVER_ENV_MISMATCH",
      errorMessage: `Incohérence de configuration : PDI_ENV ('${rawServerEnv || "non défini"}') et VITE_PDI_ENV ('${rawClientEnv || "non défini"}') doivent être définis ensemble avec la même valeur.`,
    };
  }

  const candidateMode = (
    hasClientEnv
      ? rawClientEnv
      : hasServerEnv
      ? rawServerEnv
      : rawNodeEnv === "production"
      ? "production"
      : rawNodeEnv === "test"
      ? "test"
      : "development"
  ) as PdiEnvironmentMode;

  // Protection C5: Never allow Sandbox mode when NODE_ENV === "production"
  if (rawNodeEnv === "production" && candidateMode === "sandbox") {
    return {
      isValid: false,
      mode: "production",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "SANDBOX_FORBIDDEN_IN_PRODUCTION",
      errorMessage:
        "Interdiction absolue (C5) : le mode Sandbox (PDI_ENV=sandbox / VITE_PDI_ENV=sandbox) est strictement interdit lorsque NODE_ENV=production.",
    };
  }

  return {
    isValid: true,
    mode: candidateMode,
    isSandbox: candidateMode === "sandbox",
    serverPdiEnv: rawServerEnv,
    clientVitePdiEnv: rawClientEnv,
    nodeEnv: rawNodeEnv,
  };
}

/**
 * Returns `true` if and only if the application is running in a valid, non-production Sandbox configuration.
 */
export function isStagingSandboxMode(explicitEnv?: Record<string, unknown>): boolean {
  if (explicitEnv === undefined && sandboxTestOverride !== null) {
    return sandboxTestOverride;
  }
  const resolution = resolvePdiEnvironmentMode(explicitEnv);
  return resolution.isValid && resolution.isSandbox;
}

// ============================================================================
// PROTECTION C2 — SYNTHETIC IDENTITY DETECTION (SERVER ZERO-TRUST)
// ============================================================================

export function isSyntheticSandboxToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(SANDBOX_SYNTHETIC_TOKEN_PREFIX)) return true;
  if (trimmed.startsWith("sandbox_synthetic_")) return true;
  if (trimmed.includes("sandbox-local-only")) return true;
  return false;
}

export function isSyntheticSandboxUid(uid: unknown): boolean {
  if (typeof uid !== "string") return false;
  const trimmed = uid.trim();
  return (
    trimmed.startsWith(SANDBOX_SYNTHETIC_UID_PREFIX) ||
    trimmed.startsWith("sandbox_local_")
  );
}

// ============================================================================
// PROTECTION C3 — ISOLATED SANDBOX LOCALSTORAGE (`pdi.sandbox.staging.v1.`)
// ============================================================================

export function isSandboxStorageKey(key: string): boolean {
  return typeof key === "string" && key.startsWith(SANDBOX_STORAGE_PREFIX);
}

export function isHistoricalProtectedStorageKey(key: string): boolean {
  if (typeof key !== "string" || isSandboxStorageKey(key)) {
    return false;
  }
  return HISTORICAL_PROTECTED_STORAGE_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(prefix)
  );
}

export function toSandboxStorageKey(key: string): string {
  if (!key || typeof key !== "string") {
    return `${SANDBOX_STORAGE_PREFIX}default`;
  }
  return key.startsWith(SANDBOX_STORAGE_PREFIX)
    ? key
    : `${SANDBOX_STORAGE_PREFIX}${key}`;
}

export function fromSandboxStorageKey(key: string): string {
  if (!key || typeof key !== "string") return "";
  return key.startsWith(SANDBOX_STORAGE_PREFIX)
    ? key.slice(SANDBOX_STORAGE_PREFIX.length)
    : key;
}

/**
 * Resolves a localStorage key according to the active environment:
 * - In Sandbox mode: prefixes with `pdi.sandbox.staging.v1.`
 * - Outside Sandbox mode: returns the original key untouched.
 */
export function resolveScopedStorageKey(
  key: string,
  explicitEnv?: Record<string, unknown>
): string {
  if (isStagingSandboxMode(explicitEnv)) {
    return toSandboxStorageKey(key);
  }
  return key;
}

function getDefaultStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function sandboxStorageGetItem(
  key: string,
  storage: Pick<Storage, "getItem"> | null = getDefaultStorage(),
  explicitEnv?: Record<string, unknown>
): string | null {
  if (!storage) return null;
  const scopedKey = resolveScopedStorageKey(key, explicitEnv);
  return storage.getItem(scopedKey);
}

export function sandboxStorageSetItem(
  key: string,
  value: string,
  storage: Pick<Storage, "setItem"> | null = getDefaultStorage(),
  explicitEnv?: Record<string, unknown>
): void {
  if (!storage) return;
  const scopedKey = resolveScopedStorageKey(key, explicitEnv);
  if (isStagingSandboxMode(explicitEnv) && isHistoricalProtectedStorageKey(scopedKey)) {
    throw new Error(
      `Protection C3 : écriture directe interdite sur la clé historique protégée '${scopedKey}' en mode Sandbox.`
    );
  }
  storage.setItem(scopedKey, value);
}

export function sandboxStorageRemoveItem(
  key: string,
  storage: Pick<Storage, "removeItem"> | null = getDefaultStorage(),
  explicitEnv?: Record<string, unknown>
): void {
  if (!storage) return;
  const scopedKey = resolveScopedStorageKey(key, explicitEnv);
  if (isStagingSandboxMode(explicitEnv) && isHistoricalProtectedStorageKey(scopedKey)) {
    throw new Error(
      `Protection C3 : suppression directe interdite sur la clé historique protégée '${scopedKey}' en mode Sandbox.`
    );
  }
  storage.removeItem(scopedKey);
}

/**
 * Protection C3: Deletes EXCLUSIVELY keys prefixed with `pdi.sandbox.staging.v1.`.
 * Never touches `pdi.projects.index.v1`, `isometrie.autosave.v474...`, or any other non-Sandbox key.
 * Returns the list of removed Sandbox keys.
 */
export function resetSandboxLocalStorageOnly(
  storage: Pick<Storage, "length" | "key" | "removeItem"> | null = getDefaultStorage()
): string[] {
  if (!storage) return [];

  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && isSandboxStorageKey(k)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      storage.removeItem(k);
    }
  } catch {
    // Ignore storage iteration errors
  }
  return keysToRemove;
}

// ============================================================================
// SYNTHETIC LOCAL PROFILES & DEMO SEED DATA (SANDBOX ONLY, NEVER SERVER AUTH)
// ============================================================================

export type SandboxSyntheticRole = "client";

export interface SandboxSyntheticProfile {
  uid: string;
  email: string;
  name: string;
  company: string;
  country: string;
  countryCode: string;
  city: string;
  role: "client";
  accountType: "pro";
  subscriptionPlan: "yearly";
  status: "active";
  createdAt: string;
}

const SANDBOX_ROLE_KEY = `${SANDBOX_STORAGE_PREFIX}synthetic.role.v1`;

/**
 * STAGING-00-B4-E :
 * L'identité synthétique Sandbox reste strictement locale et ne possède jamais de privilège Super Admin.
 */
export function getSandboxSyntheticRole(
  _storage: Pick<Storage, "getItem"> | null = getDefaultStorage()
): SandboxSyntheticRole {
  return "client";
}

export function setSandboxSyntheticRole(
  _role: SandboxSyntheticRole,
  storage: Pick<Storage, "setItem"> | null = getDefaultStorage()
): void {
  try {
    storage?.setItem(SANDBOX_ROLE_KEY, "client");
  } catch {
    // Ignore
  }
}

export function getSandboxSyntheticProfile(
  _role: SandboxSyntheticRole = getSandboxSyntheticRole()
): SandboxSyntheticProfile {
  return {
    uid: `${SANDBOX_SYNTHETIC_UID_PREFIX}engineer_01`,
    email: "sandbox.engineer.local@orthogonal-pdi.invalid",
    name: "Ingénieur Tuyauterie (Sandbox Locale)",
    company: "ORTHOGONAL PD&I — Sandbox Locale",
    country: "Algérie",
    countryCode: "DZ",
    city: "Hassi Messaoud",
    role: "client",
    accountType: "pro",
    subscriptionPlan: "yearly",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

export function getSandboxSyntheticAuthUser(
  role: SandboxSyntheticRole = getSandboxSyntheticRole()
) {
  const profile = getSandboxSyntheticProfile(role);
  const syntheticToken = `${SANDBOX_SYNTHETIC_TOKEN_PREFIX}${role}_local_only`;
  return {
    uid: profile.uid,
    email: profile.email,
    emailVerified: true,
    displayName: profile.name,
    isAnonymous: false,
    __sandboxSynthetic: true as const,
    getIdToken: async () => syntheticToken,
    getIdTokenResult: async () => ({
      token: syntheticToken,
      claims: {
        role: profile.role,
        email: profile.email,
        email_verified: true,
        sandbox_synthetic: true,
      },
    }),
  };
}

/**
 * Seeds a synthetic local piping project in `pdi.sandbox.staging.v1.*` if none exists yet,
 * enabling immediate testing of 2D/3D isometric editing, BOM/MTO/BoQ calculations, and PDF/DXF/JSON exports.
 */
export function seedSandboxDefaultProjectIfEmpty(
  storage: Pick<Storage, "getItem" | "setItem"> | null = getDefaultStorage()
): void {
  if (!storage || !isStagingSandboxMode()) return;

  try {
    const indexKey = toSandboxStorageKey("pdi.projects.index.v1");
    const existingIndex = storage.getItem(indexKey);
    if (existingIndex) {
      const parsed = JSON.parse(existingIndex);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return;
      }
    }

    const profile = getSandboxSyntheticProfile();
    const projectId = "sandbox-iso-line-101";
    const now = "2026-04-17T08:00:00.000Z";

    const initialIndex = [
      {
        projectId,
        title: "Collecteur Vapeur HP L-101 (Sandbox Synthétique)",
        module: "isometric",
        updatedAt: now,
      },
    ];
    storage.setItem(indexKey, JSON.stringify(initialIndex));

    const autosaveKey = toSandboxStorageKey(
      `isometrie.autosave.v474.user.${profile.uid}.project.${projectId}.current`
    );

    const syntheticSnapshot = {
      schemaVersion: "4.7.4",
      exportedAt: now,
      project: {
        id: projectId,
        ownerUid: profile.uid,
        name: "Collecteur Vapeur HP L-101 (Sandbox Synthétique)",
        wilaya: "Ouargla (30)",
        pressDesign: 40,
        createdAt: now,
        updatedAt: now,
        unitSystem: "metric",
      },
      model: {
        lines: [
          {
            id: "line-sandbox-101",
            lineNumber: "100-ST-101-A1A",
            service: "VAPEUR HP",
            dn: 100,
            nps: '4"',
            material: "ASTM A106 Gr.B",
            pressureClass: "Class 300",
            schedule: "40",
            designPressure: 40,
            color: "#06B6D4",
          },
        ],
        nodes: [
          {
            id: "N1",
            label: "N1",
            x: 0,
            y: 0,
            z: 0,
            equipmentType: "flange",
            tag: "BR-101",
          },
          {
            id: "N2",
            label: "N2",
            x: 3.5,
            y: 0,
            z: 0,
            equipmentType: "elbow90",
            tag: "EL-101",
          },
          {
            id: "N3",
            label: "N3",
            x: 3.5,
            y: 2.4,
            z: 0,
            equipmentType: "elbow90",
            tag: "EL-102",
          },
          {
            id: "N4",
            label: "N4",
            x: 3.5,
            y: 2.4,
            z: 1.8,
            equipmentType: "flange",
            tag: "BR-102",
          },
        ],
        segments: [
          {
            id: "S1",
            fromNodeId: "N1",
            toNodeId: "N2",
            lineId: "line-sandbox-101",
            dn: 100,
            schedule: "40",
            material: "ASTM A106 Gr.B",
            lengthM: 3.5,
          },
          {
            id: "S2",
            fromNodeId: "N2",
            toNodeId: "N3",
            lineId: "line-sandbox-101",
            dn: 100,
            schedule: "40",
            material: "ASTM A106 Gr.B",
            lengthM: 2.4,
          },
          {
            id: "S3",
            fromNodeId: "N3",
            toNodeId: "N4",
            lineId: "line-sandbox-101",
            dn: 100,
            schedule: "40",
            material: "ASTM A106 Gr.B",
            lengthM: 1.8,
          },
        ],
        dimensions: [],
        supports: [],
      },
      workspace: {
        showGrid: true,
        showDimensions: true,
        showPipeLabels: true,
        showLabels: true,
        showWelds: true,
        isoSnapStep: 0.5,
        viewport: { zoom: 1, panX: 0, panY: 0 },
      },
    };

    if (!storage.getItem(autosaveKey)) {
      storage.setItem(autosaveKey, JSON.stringify(syntheticSnapshot));
    }
  } catch {
    // Ignore seed errors in constrained environments
  }
}
