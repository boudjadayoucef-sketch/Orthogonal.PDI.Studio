var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/vercelHandler.ts
var vercelHandler_exports = {};
__export(vercelHandler_exports, {
  createVercelApiHandler: () => createVercelApiHandler,
  default: () => vercelHandler_default,
  inspectVercelSupabaseServerEnv: () => inspectVercelSupabaseServerEnv,
  normalizeVercelApiRequestUrl: () => normalizeVercelApiRequestUrl,
  resolveVercelRuntimeEnv: () => resolveVercelRuntimeEnv,
  vercelApiHandler: () => vercelApiHandler
});
module.exports = __toCommonJS(vercelHandler_exports);

// server.ts
var import_config = require("dotenv/config");
var import_express2 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);

// src/lib/firebase-admin.ts
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("@google-cloud/firestore");

// src/lib/stagingSandbox.ts
var import_meta = {};
var SANDBOX_STORAGE_PREFIX = "pdi.sandbox.staging.v1.";
var SANDBOX_SYNTHETIC_TOKEN_PREFIX = "sandbox_synthetic_token_";
var SANDBOX_SYNTHETIC_UID_PREFIX = "sandbox_local_uid_";
var ALLOWED_PDI_ENV_VALUES = /* @__PURE__ */ new Set([
  "production",
  "development",
  "test",
  "sandbox"
]);
var PDI_RUNTIME_CONFIG_GLOBAL_KEY = "__PDI_RUNTIME_CONFIG__";
function readInjectedBrowserRuntimeConfig(globalObj = typeof globalThis !== "undefined" ? globalThis : void 0) {
  const fromWindow = typeof window !== "undefined" ? window[PDI_RUNTIME_CONFIG_GLOBAL_KEY] : void 0;
  const candidate = globalObj && Object.prototype.hasOwnProperty.call(globalObj, PDI_RUNTIME_CONFIG_GLOBAL_KEY) ? globalObj[PDI_RUNTIME_CONFIG_GLOBAL_KEY] : fromWindow;
  if (candidate === void 0 || candidate === null) {
    return { present: false, isValid: true };
  }
  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    return { present: true, isValid: false, rawValue: String(candidate) };
  }
  const rawPdiEnv = candidate.pdiEnv;
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
    pdiEnv: normalized
  };
}
function buildPublicBrowserRuntimeConfig(env) {
  const resolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });
  if (!resolution.isValid) {
    return null;
  }
  const hasExplicitServerEnv = typeof resolution.serverPdiEnv === "string" && resolution.serverPdiEnv.trim().length > 0;
  const hasExplicitClientEnv = typeof resolution.clientVitePdiEnv === "string" && resolution.clientVitePdiEnv.trim().length > 0;
  if (!hasExplicitServerEnv || !hasExplicitClientEnv) {
    return null;
  }
  if (!ALLOWED_PDI_ENV_VALUES.has(resolution.mode)) {
    return null;
  }
  return {
    pdiEnv: resolution.mode
  };
}
function serializePublicRuntimeConfigScript(config) {
  if (!config || !ALLOWED_PDI_ENV_VALUES.has(config.pdiEnv)) {
    return "";
  }
  const safePayload = JSON.stringify({ pdiEnv: config.pdiEnv });
  return `<script id="pdi-runtime-config">window.${PDI_RUNTIME_CONFIG_GLOBAL_KEY}=Object.freeze(${safePayload});</script>`;
}
function injectPublicRuntimeConfigIntoHtml(html, config) {
  const scriptTag = serializePublicRuntimeConfigScript(config);
  if (!scriptTag) {
    return html;
  }
  if (html.includes("</head>")) {
    return html.replace("</head>", `    ${scriptTag}
  </head>`);
  }
  if (html.includes("<script")) {
    return html.replace("<script", `${scriptTag}
<script`);
  }
  return `${scriptTag}
${html}`;
}
var sandboxTestOverride = null;
function getRuntimeCombinedEnv(explicitEnv) {
  if (explicitEnv && typeof explicitEnv === "object") {
    const injectedInExplicit = Object.prototype.hasOwnProperty.call(
      explicitEnv,
      PDI_RUNTIME_CONFIG_GLOBAL_KEY
    ) ? readInjectedBrowserRuntimeConfig(explicitEnv) : { present: false, isValid: true };
    if (!injectedInExplicit.present) {
      return explicitEnv;
    }
    const mergedExplicit = { ...explicitEnv };
    const injectedValue = injectedInExplicit.rawValue ?? "__invalid_runtime_config__";
    const existingBuildClientEnv = typeof mergedExplicit.VITE_PDI_ENV === "string" && mergedExplicit.VITE_PDI_ENV.trim().length > 0 ? mergedExplicit.VITE_PDI_ENV.trim() : void 0;
    mergedExplicit.PDI_ENV = injectedValue;
    if (!existingBuildClientEnv) {
      mergedExplicit.VITE_PDI_ENV = injectedValue;
    }
    return mergedExplicit;
  }
  const combined = {};
  if (typeof process !== "undefined" && process?.env) {
    for (const [k, v] of Object.entries(process.env)) {
      combined[k] = v;
    }
  }
  const metaEnv = typeof import_meta !== "undefined" && import_meta?.env ? import_meta.env : void 0;
  if (metaEnv && typeof metaEnv === "object") {
    for (const [k, v] of Object.entries(metaEnv)) {
      if (v !== void 0) {
        combined[k] = v;
      }
    }
  }
  const injectedRuntime = readInjectedBrowserRuntimeConfig();
  if (injectedRuntime.present) {
    const injectedValue = injectedRuntime.rawValue ?? "__invalid_runtime_config__";
    const existingBuildClientEnv = typeof combined.VITE_PDI_ENV === "string" && combined.VITE_PDI_ENV.trim().length > 0 ? combined.VITE_PDI_ENV.trim() : void 0;
    combined.PDI_ENV = injectedValue;
    if (!existingBuildClientEnv) {
      combined.VITE_PDI_ENV = injectedValue;
    }
  }
  return combined;
}
function resolvePdiEnvironmentMode(explicitEnv, options) {
  const env = getRuntimeCombinedEnv(explicitEnv);
  const requireCoherence = Boolean(options?.requireServerClientCoherence);
  const rawNodeEnv = typeof env.NODE_ENV === "string" ? env.NODE_ENV.trim() : void 0;
  const rawServerEnv = typeof env.PDI_ENV === "string" ? env.PDI_ENV.trim() : void 0;
  const rawClientEnv = typeof env.VITE_PDI_ENV === "string" ? env.VITE_PDI_ENV.trim() : void 0;
  const hasServerEnv = rawServerEnv !== void 0 && rawServerEnv.length > 0;
  const hasClientEnv = rawClientEnv !== void 0 && rawClientEnv.length > 0;
  if (hasServerEnv && !ALLOWED_PDI_ENV_VALUES.has(rawServerEnv)) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "AMBIGUOUS_PDI_ENV",
      errorMessage: `Configuration PDI_ENV ambigu\xEB ou invalide ('${rawServerEnv}'). Valeurs autoris\xE9es : production, development, test, sandbox.`
    };
  }
  if (hasClientEnv && !ALLOWED_PDI_ENV_VALUES.has(rawClientEnv)) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "AMBIGUOUS_PDI_ENV",
      errorMessage: `Configuration VITE_PDI_ENV ambigu\xEB ou invalide ('${rawClientEnv}'). Valeurs autoris\xE9es : production, development, test, sandbox.`
    };
  }
  if (hasServerEnv && hasClientEnv && rawServerEnv !== rawClientEnv) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "FRONTEND_SERVER_ENV_MISMATCH",
      errorMessage: `Incoh\xE9rence de configuration entre le serveur (PDI_ENV='${rawServerEnv}') et le frontend (VITE_PDI_ENV='${rawClientEnv}').`
    };
  }
  if (requireCoherence && (hasServerEnv && !hasClientEnv || !hasServerEnv && hasClientEnv)) {
    return {
      isValid: false,
      mode: rawNodeEnv === "production" ? "production" : "development",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "FRONTEND_SERVER_ENV_MISMATCH",
      errorMessage: `Incoh\xE9rence de configuration : PDI_ENV ('${rawServerEnv || "non d\xE9fini"}') et VITE_PDI_ENV ('${rawClientEnv || "non d\xE9fini"}') doivent \xEAtre d\xE9finis ensemble avec la m\xEAme valeur.`
    };
  }
  const candidateMode = hasClientEnv ? rawClientEnv : hasServerEnv ? rawServerEnv : rawNodeEnv === "production" ? "production" : rawNodeEnv === "test" ? "test" : "development";
  if (rawNodeEnv === "production" && candidateMode === "sandbox") {
    return {
      isValid: false,
      mode: "production",
      isSandbox: false,
      serverPdiEnv: rawServerEnv,
      clientVitePdiEnv: rawClientEnv,
      nodeEnv: rawNodeEnv,
      errorCode: "SANDBOX_FORBIDDEN_IN_PRODUCTION",
      errorMessage: "Interdiction absolue (C5) : le mode Sandbox (PDI_ENV=sandbox / VITE_PDI_ENV=sandbox) est strictement interdit lorsque NODE_ENV=production."
    };
  }
  return {
    isValid: true,
    mode: candidateMode,
    isSandbox: candidateMode === "sandbox",
    serverPdiEnv: rawServerEnv,
    clientVitePdiEnv: rawClientEnv,
    nodeEnv: rawNodeEnv
  };
}
function isStagingSandboxMode(explicitEnv) {
  if (explicitEnv === void 0 && sandboxTestOverride !== null) {
    return sandboxTestOverride;
  }
  const resolution = resolvePdiEnvironmentMode(explicitEnv);
  return resolution.isValid && resolution.isSandbox;
}
function isSyntheticSandboxToken(token) {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(SANDBOX_SYNTHETIC_TOKEN_PREFIX)) return true;
  if (trimmed.startsWith("sandbox_synthetic_")) return true;
  if (trimmed.includes("sandbox-local-only")) return true;
  return false;
}
function isSyntheticSandboxUid(uid) {
  if (typeof uid !== "string") return false;
  const trimmed = uid.trim();
  return trimmed.startsWith(SANDBOX_SYNTHETIC_UID_PREFIX) || trimmed.startsWith("sandbox_local_");
}
var SANDBOX_ROLE_KEY = `${SANDBOX_STORAGE_PREFIX}synthetic.role.v1`;

// src/lib/firebase-admin.ts
var EXPECTED_SERVER_PROJECT_ID = "graphical-router-x18qq";
var EXPECTED_SERVER_DATABASE_ID = "ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf";
var SERVER_PROJECT_ENV_KEYS = [
  "FIREBASE_PROJECT_ID",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT"
];
var SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR = "Coupe-circuit Sandbox Serveur (C1/C2) : Firebase Admin et Firestore Serveur sont strictement d\xE9sactiv\xE9s en mode Sandbox. Aucune connexion \xE0 Firebase Production n\u2019est autoris\xE9e.";
function evaluateServerFirebaseInitGate(env) {
  if (isStagingSandboxMode(env)) {
    return {
      blocked: true,
      sandboxDisabled: true,
      runtimeDisabled: true,
      blockReason: "SANDBOX_MODE"
    };
  }
  const resolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });
  if (!resolution.isValid) {
    const reason = resolution.errorCode ?? "AMBIGUOUS_PDI_ENV";
    return {
      blocked: true,
      sandboxDisabled: reason === "SANDBOX_FORBIDDEN_IN_PRODUCTION",
      runtimeDisabled: true,
      blockReason: reason
    };
  }
  if (resolution.isSandbox) {
    return {
      blocked: true,
      sandboxDisabled: true,
      runtimeDisabled: true,
      blockReason: "SANDBOX_MODE"
    };
  }
  const hasExplicitServerEnv = typeof resolution.serverPdiEnv === "string" && resolution.serverPdiEnv.trim().length > 0;
  const hasExplicitClientEnv = typeof resolution.clientVitePdiEnv === "string" && resolution.clientVitePdiEnv.trim().length > 0;
  if (!hasExplicitServerEnv || !hasExplicitClientEnv) {
    return {
      blocked: true,
      sandboxDisabled: false,
      runtimeDisabled: true,
      blockReason: "INCOMPLETE_PDI_ENV"
    };
  }
  return {
    blocked: false,
    sandboxDisabled: false,
    runtimeDisabled: false,
    blockReason: null
  };
}
function shouldBlockServerFirebaseInit(env) {
  return evaluateServerFirebaseInitGate(env).blocked;
}
function createSandboxDisabledServerProxy(serviceName) {
  const throwForbidden = () => {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Service refus\xE9 : ${serviceName}]`);
  };
  return new Proxy(/* @__PURE__ */ Object.create(null), {
    get(_target, prop) {
      if (prop === "__sandboxDisabled") return true;
      if (prop === "then") return void 0;
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
      if (prop === "__sandboxDisabled") return true;
      return throwForbidden();
    }
  });
}
function validateServerProjectId(projectId) {
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    throw new Error(
      "[FATAL] Configuration serveur Firebase refus\xE9e : Project ID absent ou vide."
    );
  }
  const normalized = projectId.trim();
  if (normalized.startsWith("demo-")) {
    throw new Error(
      "[FATAL] Production startup error: Cannot use demo project ID in server configuration."
    );
  }
  if (normalized !== EXPECTED_SERVER_PROJECT_ID) {
    throw new Error(
      `[FATAL] Configuration serveur Firebase refus\xE9e : Project ID non autoris\xE9 ('${normalized}'). Attendu : '${EXPECTED_SERVER_PROJECT_ID}'.`
    );
  }
  return EXPECTED_SERVER_PROJECT_ID;
}
function validateServerDatabaseId(databaseId) {
  if (typeof databaseId !== "string" || databaseId.trim().length === 0) {
    throw new Error(
      "[FATAL] Configuration serveur Firestore refus\xE9e : Database ID (FIREBASE_DATABASE_ID) absent ou vide. Aucun fallback vers '(default)' n'est autoris\xE9."
    );
  }
  const normalized = databaseId.trim();
  if (normalized === "(default)") {
    throw new Error(
      "[FATAL] Configuration serveur Firestore refus\xE9e : la base '(default)' est formellement interdite c\xF4t\xE9 serveur."
    );
  }
  if (normalized !== EXPECTED_SERVER_DATABASE_ID) {
    throw new Error(
      `[FATAL] Configuration serveur Firestore refus\xE9e : Database ID non autoris\xE9 ('${normalized}'). Attendu : '${EXPECTED_SERVER_DATABASE_ID}'.`
    );
  }
  return EXPECTED_SERVER_DATABASE_ID;
}
function resolveServerFirestoreConfig(env = typeof process !== "undefined" && process.env ? process.env : {}, options) {
  const pdiResolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });
  if (isStagingSandboxMode(env) || !pdiResolution.isValid || pdiResolution.isSandbox) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [resolveServerFirestoreConfig interdit en mode Sandbox ou configuration invalide]`
    );
  }
  const sourceEnv = env && typeof env === "object" ? env : {};
  const requireExplicit = Boolean(options?.requireExplicitEnv);
  const definedProjectEntries = [];
  for (const key of SERVER_PROJECT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceEnv, key) && sourceEnv[key] !== void 0) {
      definedProjectEntries.push({ key, rawValue: sourceEnv[key] });
    }
  }
  let projectId;
  if (definedProjectEntries.length === 0) {
    if (requireExplicit) {
      projectId = validateServerProjectId(void 0);
    } else {
      projectId = validateServerProjectId(EXPECTED_SERVER_PROJECT_ID);
    }
  } else {
    const trimmedEntries = [];
    for (const entry of definedProjectEntries) {
      if (typeof entry.rawValue !== "string" || entry.rawValue.trim().length === 0) {
        throw new Error(
          `[FATAL] Configuration serveur Firebase refus\xE9e : la variable '${entry.key}' est d\xE9finie mais Project ID absent ou vide.`
        );
      }
      trimmedEntries.push({ key: entry.key, value: entry.rawValue.trim() });
    }
    const distinctValues = new Set(trimmedEntries.map((e) => e.value));
    if (distinctValues.size > 1) {
      const details = trimmedEntries.map((e) => `${e.key}='${e.value}'`).join(", ");
      throw new Error(
        `[FATAL] Configuration serveur Firebase refus\xE9e : conflit entre les variables d'environnement de projet (${details}). Project ID non autoris\xE9 ou contradictoire. Attendu : '${EXPECTED_SERVER_PROJECT_ID}'.`
      );
    }
    let lastValidated = EXPECTED_SERVER_PROJECT_ID;
    for (const entry of trimmedEntries) {
      lastValidated = validateServerProjectId(entry.value);
    }
    projectId = lastValidated;
  }
  const hasExplicitDatabaseId = Object.prototype.hasOwnProperty.call(sourceEnv, "FIREBASE_DATABASE_ID") && sourceEnv.FIREBASE_DATABASE_ID !== void 0;
  const rawDatabaseId = requireExplicit || hasExplicitDatabaseId ? sourceEnv.FIREBASE_DATABASE_ID : EXPECTED_SERVER_DATABASE_ID;
  const databaseId = validateServerDatabaseId(rawDatabaseId);
  return { projectId, databaseId };
}
function validateServerFirebaseAppProjectId(appInstance, expectedProjectId = EXPECTED_SERVER_PROJECT_ID) {
  if (!appInstance || typeof appInstance !== "object") {
    throw new Error(
      "[FATAL] Configuration serveur Firebase Admin refus\xE9e : instance d'application Admin absente ou invalide."
    );
  }
  const validatedExpected = validateServerProjectId(expectedProjectId);
  const rawAppProjectId = appInstance?.options?.projectId;
  const validatedAppProjectId = validateServerProjectId(rawAppProjectId);
  if (validatedAppProjectId !== validatedExpected) {
    throw new Error(
      `[FATAL] Configuration serveur Firebase Admin refus\xE9e : le projectId de l'application Admin ('${validatedAppProjectId}') diverge du projet attendu ('${validatedExpected}').`
    );
  }
  return validatedAppProjectId;
}
function getOrInitializeServerFirebaseApp(config, sdk, env) {
  if (shouldBlockServerFirebaseInit(env)) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [getOrInitializeServerFirebaseApp / initializeApp interdit en mode Sandbox]`
    );
  }
  const expectedProjectId = validateServerProjectId(
    config && Object.prototype.hasOwnProperty.call(config, "projectId") ? config.projectId : EXPECTED_SERVER_PROJECT_ID
  );
  const listApps = sdk?.getApps ?? import_app.getApps;
  const fetchDefaultApp = sdk?.getApp ?? import_app.getApp;
  const createApp = sdk?.initializeApp ?? import_app.initializeApp;
  const existingApps = listApps();
  const defaultAppInList = Array.isArray(existingApps) ? existingApps.find(
    (candidate) => candidate && typeof candidate === "object" && candidate.name === "[DEFAULT]"
  ) : void 0;
  let resolvedApp;
  if (defaultAppInList) {
    resolvedApp = typeof fetchDefaultApp === "function" ? fetchDefaultApp() : defaultAppInList;
    if (!resolvedApp || typeof resolvedApp !== "object") {
      resolvedApp = defaultAppInList;
    }
    if (resolvedApp.name !== void 0 && resolvedApp.name !== "[DEFAULT]") {
      throw new Error(
        `[FATAL] Configuration serveur Firebase Admin refus\xE9e : l'application s\xE9lectionn\xE9e ('${String(resolvedApp.name)}') n'est pas l'application '[DEFAULT]'.`
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
function createServerAdminAuth(appInstance, expectedProjectId = EXPECTED_SERVER_PROJECT_ID, authFactory = import_auth.getAuth, env) {
  if (shouldBlockServerFirebaseInit(env)) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [createServerAdminAuth / getAuth interdit en mode Sandbox]`
    );
  }
  validateServerFirebaseAppProjectId(appInstance, expectedProjectId);
  return authFactory(appInstance);
}
function extractServerFirestoreProjectId(dbInstance) {
  if (!dbInstance || typeof dbInstance !== "object") {
    return null;
  }
  const ownProjDesc = Object.getOwnPropertyDescriptor(dbInstance, "projectId");
  if (ownProjDesc && !Object.prototype.hasOwnProperty.call(ownProjDesc, "value")) {
    return null;
  }
  const ownSettingsDesc = Object.getOwnPropertyDescriptor(dbInstance, "_settings");
  if (ownSettingsDesc && !Object.prototype.hasOwnProperty.call(ownSettingsDesc, "value")) {
    return null;
  }
  const directProjectId = typeof dbInstance?.projectId === "string" && dbInstance.projectId.trim().length > 0 ? dbInstance.projectId.trim() : null;
  const settingsObj = ownSettingsDesc ? ownSettingsDesc.value : dbInstance?._settings;
  let settingsProjectId = null;
  if (settingsObj && typeof settingsObj === "object") {
    const settingsProjDesc = Object.getOwnPropertyDescriptor(settingsObj, "projectId");
    if (settingsProjDesc && !Object.prototype.hasOwnProperty.call(settingsProjDesc, "value")) {
      return null;
    }
    if (typeof settingsObj.projectId === "string" && settingsObj.projectId.trim().length > 0) {
      settingsProjectId = settingsObj.projectId.trim();
    }
  }
  if (directProjectId && settingsProjectId && directProjectId !== settingsProjectId) {
    return null;
  }
  const nativeProjectId = directProjectId || settingsProjectId;
  if (!nativeProjectId) {
    return null;
  }
  if ("app" in dbInstance) {
    const ownAppDesc = Object.getOwnPropertyDescriptor(dbInstance, "app");
    if (ownAppDesc && !Object.prototype.hasOwnProperty.call(ownAppDesc, "value")) {
      return null;
    }
    if (!dbInstance.app || typeof dbInstance.app !== "object") {
      return null;
    }
    const appProjectId = typeof dbInstance.app?.options?.projectId === "string" && dbInstance.app.options.projectId.trim().length > 0 ? dbInstance.app.options.projectId.trim() : null;
    if (!appProjectId || appProjectId !== nativeProjectId) {
      return null;
    }
  }
  return nativeProjectId;
}
function extractServerFirestoreDatabaseId(dbInstance) {
  if (!dbInstance || typeof dbInstance !== "object") {
    return null;
  }
  const ownDbDesc = Object.getOwnPropertyDescriptor(dbInstance, "databaseId");
  if (ownDbDesc && !Object.prototype.hasOwnProperty.call(ownDbDesc, "value")) {
    return null;
  }
  const ownSettingsDesc = Object.getOwnPropertyDescriptor(dbInstance, "_settings");
  if (ownSettingsDesc && !Object.prototype.hasOwnProperty.call(ownSettingsDesc, "value")) {
    return null;
  }
  const directDatabaseId = typeof dbInstance?.databaseId === "string" && dbInstance.databaseId.trim().length > 0 ? dbInstance.databaseId.trim() : null;
  const settingsObj = ownSettingsDesc ? ownSettingsDesc.value : dbInstance?._settings;
  let settingsDatabaseId = null;
  if (settingsObj && typeof settingsObj === "object") {
    const settingsDbDesc = Object.getOwnPropertyDescriptor(settingsObj, "databaseId");
    if (settingsDbDesc && !Object.prototype.hasOwnProperty.call(settingsDbDesc, "value")) {
      return null;
    }
    if (typeof settingsObj.databaseId === "string" && settingsObj.databaseId.trim().length > 0) {
      settingsDatabaseId = settingsObj.databaseId.trim();
    }
  }
  if (directDatabaseId && settingsDatabaseId && directDatabaseId !== settingsDatabaseId) {
    return null;
  }
  return directDatabaseId || settingsDatabaseId || null;
}
function assertValidServerFirestoreInstance(dbInstance, expected = {}, adminAppInstance) {
  const expectedProjectId = validateServerProjectId(
    expected && Object.prototype.hasOwnProperty.call(expected, "projectId") ? expected.projectId : EXPECTED_SERVER_PROJECT_ID
  );
  const expectedDatabaseId = validateServerDatabaseId(
    expected && Object.prototype.hasOwnProperty.call(expected, "databaseId") ? expected.databaseId : EXPECTED_SERVER_DATABASE_ID
  );
  const actualProjectId = extractServerFirestoreProjectId(dbInstance);
  if (!actualProjectId || actualProjectId !== expectedProjectId) {
    throw new Error(
      `[FATAL] V\xE9rification Firestore serveur refus\xE9e : Project ID r\xE9el du client ('${actualProjectId ?? "inconnu"}') non conforme \xE0 '${expectedProjectId}'.`
    );
  }
  const actualDatabaseId = extractServerFirestoreDatabaseId(dbInstance);
  if (!actualDatabaseId || actualDatabaseId === "(default)" || actualDatabaseId !== expectedDatabaseId) {
    throw new Error(
      `[FATAL] V\xE9rification Firestore serveur refus\xE9e : Database ID r\xE9el du client ('${actualDatabaseId ?? "inconnu"}') non conforme \xE0 la base nomm\xE9e '${expectedDatabaseId}'.`
    );
  }
  if (adminAppInstance !== void 0) {
    const adminAppProjectId = validateServerFirebaseAppProjectId(adminAppInstance, expectedProjectId);
    if (adminAppProjectId !== actualProjectId) {
      throw new Error(
        `[FATAL] V\xE9rification Firestore serveur refus\xE9e : divergence de projectId entre l'application Admin ('${adminAppProjectId}') et le client Firestore ('${actualProjectId}').`
      );
    }
  }
  return {
    projectId: actualProjectId,
    databaseId: actualDatabaseId
  };
}
function createServerFirestoreClient(config, adminAppInstance, firestoreFactory, env) {
  if (shouldBlockServerFirebaseInit(env)) {
    throw new Error(
      `${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [createServerFirestoreClient / Firestore interdit en mode Sandbox]`
    );
  }
  const validatedProjectId = validateServerProjectId(
    config && Object.prototype.hasOwnProperty.call(config, "projectId") ? config.projectId : EXPECTED_SERVER_PROJECT_ID
  );
  const validatedDatabaseId = validateServerDatabaseId(
    config && Object.prototype.hasOwnProperty.call(config, "databaseId") ? config.databaseId : EXPECTED_SERVER_DATABASE_ID
  );
  if (adminAppInstance !== void 0) {
    validateServerFirebaseAppProjectId(adminAppInstance, validatedProjectId);
  }
  const firestoreClient = firestoreFactory ? firestoreFactory({
    projectId: validatedProjectId,
    databaseId: validatedDatabaseId
  }) : new import_firestore.Firestore({
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
function initializeServerFirebaseAdminRuntime(env = typeof process !== "undefined" && process.env ? process.env : {}, sdk) {
  const gate = evaluateServerFirebaseInitGate(env);
  if (gate.blocked) {
    return {
      sandboxDisabled: gate.sandboxDisabled,
      runtimeDisabled: true,
      blockReason: gate.blockReason,
      config: null,
      adminApp: createSandboxDisabledServerProxy("adminApp"),
      adminAuth: createSandboxDisabledServerProxy("adminAuth"),
      adminDb: createSandboxDisabledServerProxy("adminDb")
    };
  }
  const serverFirestoreConfig = resolveServerFirestoreConfig(env);
  const appInstance = getOrInitializeServerFirebaseApp(serverFirestoreConfig, sdk, env);
  const authInstance = createServerAdminAuth(
    appInstance,
    serverFirestoreConfig.projectId,
    sdk?.getAuth ?? import_auth.getAuth,
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
function bootstrapActiveServerFirebaseRuntime() {
  const isVercelRuntime = typeof process !== "undefined" && (process.env?.VERCEL === "1" || process.env?.VERCEL === "true");
  if (!isVercelRuntime) {
    return initializeServerFirebaseAdminRuntime();
  }
  try {
    return initializeServerFirebaseAdminRuntime();
  } catch (err) {
    console.warn(
      "[VERCEL-API-01] Firebase Admin top-level initialization disabled (fail-closed) on Vercel:",
      err instanceof Error ? err.message : "configuration unavailable"
    );
    return {
      sandboxDisabled: false,
      runtimeDisabled: true,
      blockReason: "INCOMPLETE_PDI_ENV",
      config: null,
      adminApp: createSandboxDisabledServerProxy("adminApp"),
      adminAuth: createSandboxDisabledServerProxy("adminAuth"),
      adminDb: createSandboxDisabledServerProxy("adminDb")
    };
  }
}
var activeServerFirebaseRuntime = bootstrapActiveServerFirebaseRuntime();
var isServerFirebaseSandboxDisabled = activeServerFirebaseRuntime.sandboxDisabled;
var isServerFirebaseRuntimeDisabled = activeServerFirebaseRuntime.runtimeDisabled;
var serverFirebaseBlockReason = activeServerFirebaseRuntime.blockReason;
var serverFirebaseRuntimeConfig = activeServerFirebaseRuntime.config;
var adminApp = activeServerFirebaseRuntime.adminApp;
var adminAuth = activeServerFirebaseRuntime.adminAuth;
var adminDb = activeServerFirebaseRuntime.adminDb;
function getServerAdminAuth(env) {
  if (shouldBlockServerFirebaseInit(env) || activeServerFirebaseRuntime.runtimeDisabled) {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Acc\xE8s \xE0 adminAuth refus\xE9]`);
  }
  return adminAuth;
}
function getServerAdminDb(env) {
  if (shouldBlockServerFirebaseInit(env) || activeServerFirebaseRuntime.runtimeDisabled) {
    throw new Error(`${SANDBOX_SERVER_FIREBASE_FORBIDDEN_ERROR} [Acc\xE8s \xE0 adminDb refus\xE9]`);
  }
  return adminDb;
}

// src/server/supabaseAdmin.ts
var import_supabase_js = require("@supabase/supabase-js");

// src/security/sec01SecurityService.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_net = __toESM(require("node:net"), 1);
var import_express = __toESM(require("express"), 1);
var BoundedRateLimiter = class {
  constructor(options) {
    this.store = /* @__PURE__ */ new Map();
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxEntries = options.maxEntries ?? 5e3;
  }
  get size() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  /**
   * Cleans expired entries and enforces upper bound on map size.
   */
  prune(now) {
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
    if (this.store.size >= this.maxEntries) {
      const keysToDelete = Array.from(this.store.keys()).slice(0, Math.floor(this.maxEntries * 0.2) + 1);
      for (const k of keysToDelete) {
        this.store.delete(k);
      }
    }
  }
  consume(key) {
    const now = Date.now();
    if (this.store.size >= this.maxEntries) {
      this.prune(now);
    }
    const record = this.store.get(key);
    if (!record || now > record.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true, currentCount: 1 };
    }
    record.count++;
    if (record.count > this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1e3));
      return { allowed: false, currentCount: record.count, retryAfterSec };
    }
    return { allowed: true, currentCount: record.count };
  }
  middleware(errorMessage = "Trop de requ\xEAtes. Veuillez patienter avant de r\xE9essayer.") {
    return (req, res, next) => {
      const ip = (req.ip || req.socket.remoteAddress || "unknown_ip").toString();
      const result = this.consume(ip);
      if (!result.allowed) {
        if (result.retryAfterSec) {
          res.setHeader("Retry-After", result.retryAfterSec);
        }
        return res.status(429).json({
          error: errorMessage,
          retryAfterSec: result.retryAfterSec
        });
      }
      next();
    };
  }
};
function createBoundedRateLimiter(options) {
  return new BoundedRateLimiter(options);
}
function verifyPaddleWebhookSignature(rawBody, signatureHeader, secretKey) {
  if (!secretKey || typeof secretKey !== "string" || secretKey.trim().length === 0) {
    return { isValid: false, error: "Paddle webhook secret key not configured on server" };
  }
  if (typeof rawBody !== "string" || rawBody.length === 0) {
    return { isValid: false, error: "Missing raw request body for Paddle signature verification" };
  }
  if (!signatureHeader || typeof signatureHeader !== "string" || signatureHeader.trim().length === 0) {
    return { isValid: false, error: "Missing Paddle-Signature header" };
  }
  const parts = signatureHeader.split(";").reduce((acc, part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = part.slice(eqIdx + 1).trim();
      if (k && v) acc[k] = v;
    }
    return acc;
  }, {});
  const timestamp2 = parts["ts"];
  const receivedHash = parts["h1"];
  if (!timestamp2 || !receivedHash || !/^\d+$/.test(timestamp2) || receivedHash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(receivedHash)) {
    return {
      isValid: false,
      error: "Malformed Paddle-Signature header (ts must be digits and h1 must be exactly 64 hex characters)"
    };
  }
  const tsNum = parseInt(timestamp2, 10);
  const nowSec = Math.floor(Date.now() / 1e3);
  if (isNaN(tsNum) || Math.abs(nowSec - tsNum) > 600) {
    return { isValid: false, error: "Paddle webhook timestamp out of tolerance window" };
  }
  try {
    const signedPayload = `${timestamp2}:${rawBody}`;
    const expectedHash = import_node_crypto.default.createHmac("sha256", secretKey.trim()).update(signedPayload, "utf8").digest("hex");
    const receivedBuf = Buffer.from(receivedHash, "hex");
    const expectedBuf = Buffer.from(expectedHash, "hex");
    if (receivedBuf.length !== expectedBuf.length) {
      return { isValid: false, error: "Paddle webhook signature length mismatch" };
    }
    const matches = import_node_crypto.default.timingSafeEqual(receivedBuf, expectedBuf);
    return matches ? { isValid: true } : { isValid: false, error: "Paddle webhook signature mismatch" };
  } catch (err) {
    return { isValid: false, error: `Paddle signature calculation error: ${err?.message || err}` };
  }
}
function verifySlickPayWebhook(_payload, headers, configuredSecret) {
  if (!configuredSecret || typeof configuredSecret !== "string" || configuredSecret.trim().length === 0) {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "No official Slick-Pay webhook secret configured. Webhook rejected in fail-closed mode without auto-activation."
    };
  }
  const safeHeaders = headers && typeof headers === "object" ? headers : {};
  const rawSignature = safeHeaders["x-slickpay-signature"] ?? safeHeaders["X-SlickPay-Signature"] ?? safeHeaders["x-signature"] ?? safeHeaders["X-Signature"];
  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
  if (!signature || typeof signature !== "string" || signature.trim().length === 0) {
    return {
      isAuthentic: false,
      canAutoActivate: false,
      reason: "Missing Slick-Pay signature header. Webhook rejected in fail-closed mode."
    };
  }
  return {
    isAuthentic: false,
    canAutoActivate: false,
    reason: "Unverified Slick-Pay webhook protocol: direct shared-secret header comparison is not accepted as proof of authenticity. Webhook held fail-closed without auto-activation."
  };
}
var WebhookIdempotencyRegistry = class {
  constructor(maxCacheSize = 1e4) {
    this.processedEvents = /* @__PURE__ */ new Set();
    this.inProgressEvents = /* @__PURE__ */ new Set();
    this.maxCacheSize = maxCacheSize;
  }
  isProcessed(eventId) {
    return this.processedEvents.has(eventId);
  }
  isInProgress(eventId) {
    return this.inProgressEvents.has(eventId);
  }
  markInProgress(eventId) {
    if (this.processedEvents.has(eventId) || this.inProgressEvents.has(eventId)) {
      return false;
    }
    this.inProgressEvents.add(eventId);
    return true;
  }
  markCompleted(eventId) {
    this.inProgressEvents.delete(eventId);
    if (this.processedEvents.size >= this.maxCacheSize) {
      const oldestKey = this.processedEvents.values().next().value;
      if (oldestKey) this.processedEvents.delete(oldestKey);
    }
    this.processedEvents.add(eventId);
  }
  releaseInProgress(eventId) {
    this.inProgressEvents.delete(eventId);
  }
  clear() {
    this.processedEvents.clear();
    this.inProgressEvents.clear();
  }
};
var globalWebhookIdempotency = new WebhookIdempotencyRegistry();
function isSuspiciousRequestPath(rawUrl, options = {}) {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  if (rawUrl.includes("\0") || /%00/i.test(rawUrl) || rawUrl.includes("\\") || /%5c/i.test(rawUrl)) {
    return true;
  }
  const rawPath = rawUrl.split("?")[0] || "/";
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
    if (decodedPath.includes("%")) {
      decodedPath = decodeURIComponent(decodedPath);
    }
  } catch {
    return true;
  }
  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    return true;
  }
  const lower = decodedPath.toLowerCase();
  if (lower.includes("..") || lower.includes("/..")) {
    return true;
  }
  const segments = lower.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith(".")) {
      if (i === 0 && seg === ".well-known") continue;
      if (options.allowViteDevDeps === true && i === 1 && segments[0] === "node_modules" && seg === ".vite") {
        continue;
      }
      return true;
    }
  }
  const forbiddenExtensions = [
    ".php",
    ".phtml",
    ".phar",
    ".cgi",
    ".pl",
    ".sh",
    ".bash",
    ".env",
    ".pem",
    ".key",
    ".pkcs12",
    ".pfx",
    ".p12",
    ".crt",
    ".bak",
    ".old",
    ".sql"
  ];
  for (const ext of forbiddenExtensions) {
    if (lower.endsWith(ext) || lower.includes(`${ext}/`)) {
      return true;
    }
  }
  const forbiddenExactFiles = [
    "/server.ts",
    "/package.json",
    "/package-lock.json",
    "/tsconfig.json",
    "/firestore.rules",
    "/firebase-blueprint.json"
  ];
  if (forbiddenExactFiles.includes(lower)) {
    return true;
  }
  return false;
}
var VERIFIED_AISTUDIO_FRAME_ANCESTOR = "https://aistudio.google.com";
function validateOriginEntry(rawOrigin, options = {}) {
  if (typeof rawOrigin !== "string") {
    return { isValid: false, error: "Origin must be a string" };
  }
  const trimmed = rawOrigin.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Origin cannot be empty" };
  }
  if (/[\x00-\x1f\x7f;'"\\\s]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Origin contains forbidden characters (control chars, semicolon, quotes, or whitespace)"
    };
  }
  if (trimmed.includes("*")) {
    return {
      isValid: false,
      error: "Wildcard '*' is forbidden in validated origins"
    };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: `Malformed origin URL: ${trimmed}` };
  }
  if (parsed.username || parsed.password) {
    return { isValid: false, error: "Origin must not contain credentials" };
  }
  if (parsed.search !== "" || parsed.hash !== "" || trimmed.includes("?") || trimmed.includes("#")) {
    return {
      isValid: false,
      error: "Origin must not contain query parameters or fragments"
    };
  }
  if (parsed.pathname !== "/" || trimmed.endsWith("/")) {
    return {
      isValid: false,
      error: "Origin must not contain a path or trailing slash"
    };
  }
  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (parsed.protocol === "https:") {
    if (!isLocalhost && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(hostname)) {
      return { isValid: false, error: `Invalid HTTPS hostname: ${hostname}` };
    }
  } else if (parsed.protocol === "http:") {
    if (!options.allowLocalhostHttp || !isLocalhost) {
      return {
        isValid: false,
        error: "Non-HTTPS origin is forbidden in production or for non-localhost hosts"
      };
    }
  } else {
    return {
      isValid: false,
      error: `Unsupported origin protocol: ${parsed.protocol}`
    };
  }
  return {
    isValid: true,
    normalizedOrigin: parsed.origin.toLowerCase()
  };
}
function validateAppUrl(rawAppUrl) {
  if (rawAppUrl === void 0 || rawAppUrl.trim() === "") {
    return { isValid: true };
  }
  return validateOriginEntry(rawAppUrl, { allowLocalhostHttp: false });
}
function validateAllowedOrigins(rawAllowedOrigins, options = {}) {
  const isProduction = options.isProduction === true;
  const allowLocalhostHttp = !isProduction;
  const invalidEntries = [];
  const normalizedSet = /* @__PURE__ */ new Set();
  const defaultBaseOrigins = options.baseOrigins ?? [
    VERIFIED_AISTUDIO_FRAME_ANCESTOR,
    "https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
    "https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
    ...!isProduction ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []
  ];
  for (const base of defaultBaseOrigins) {
    const res = validateOriginEntry(base, { allowLocalhostHttp });
    if (res.isValid && res.normalizedOrigin) {
      normalizedSet.add(res.normalizedOrigin);
    }
  }
  if (options.appUrl !== void 0 && options.appUrl.trim() !== "") {
    const appUrlRes = validateAppUrl(options.appUrl);
    if (appUrlRes.isValid && appUrlRes.normalizedOrigin) {
      normalizedSet.add(appUrlRes.normalizedOrigin);
    }
  }
  if (rawAllowedOrigins !== void 0 && rawAllowedOrigins.trim() !== "") {
    const entries = rawAllowedOrigins.split(",").map((s) => s.trim());
    for (const entry of entries) {
      if (!entry) {
        invalidEntries.push(entry);
        continue;
      }
      const check = validateOriginEntry(entry, { allowLocalhostHttp });
      if (!check.isValid || !check.normalizedOrigin) {
        invalidEntries.push(entry);
      } else {
        normalizedSet.add(check.normalizedOrigin);
      }
    }
  }
  if (invalidEntries.length > 0) {
    return {
      isValid: false,
      origins: Array.from(normalizedSet),
      invalidEntries,
      error: `Invalid ALLOWED_ORIGINS entries rejected: ${invalidEntries.join(", ")}`
    };
  }
  return {
    isValid: true,
    origins: Array.from(normalizedSet),
    invalidEntries: []
  };
}
var ALLOWED_STATIC_DIST_FLAGS = /* @__PURE__ */ new Set(["true", "false", "1", "0"]);
function resolveServerDeliveryMode(env = process.env) {
  const rawNodeEnv = typeof env.NODE_ENV === "string" ? env.NODE_ENV.trim().toLowerCase() : "";
  const isProductionNodeEnv = rawNodeEnv === "production";
  const isStagingNodeEnv = rawNodeEnv === "staging";
  const rawFlag = typeof env.PDI_SERVE_STATIC_DIST === "string" ? env.PDI_SERVE_STATIC_DIST.trim().toLowerCase() : void 0;
  const hasExplicitFlag = rawFlag !== void 0 && rawFlag.length > 0;
  if (hasExplicitFlag && !ALLOWED_STATIC_DIST_FLAGS.has(rawFlag)) {
    return {
      isValid: false,
      serveStaticDist: false,
      strictSecurityMode: true,
      isProductionNodeEnv,
      isStagingNodeEnv,
      explicitStaticDistFlag: rawFlag,
      errorMessage: `Valeur invalide pour PDI_SERVE_STATIC_DIST ('${rawFlag}'). Valeurs autoris\xE9es : true, false, 1, 0.`
    };
  }
  const explicitTrue = rawFlag === "true" || rawFlag === "1";
  const explicitFalse = rawFlag === "false" || rawFlag === "0";
  if (isProductionNodeEnv && explicitFalse) {
    return {
      isValid: false,
      serveStaticDist: false,
      strictSecurityMode: true,
      isProductionNodeEnv,
      isStagingNodeEnv,
      explicitStaticDistFlag: rawFlag,
      errorMessage: "Configuration interdite : PDI_SERVE_STATIC_DIST=false est interdit lorsque NODE_ENV=production (serveur de d\xE9veloppement Vite interdit en production)."
    };
  }
  if (isStagingNodeEnv && !explicitTrue) {
    return {
      isValid: false,
      serveStaticDist: false,
      strictSecurityMode: true,
      isProductionNodeEnv,
      isStagingNodeEnv,
      explicitStaticDistFlag: rawFlag,
      errorMessage: "Politique de s\xE9curit\xE9 Cloud Run / Staging : NODE_ENV=staging exige PDI_SERVE_STATIC_DIST=true pour servir le bundle statique compil\xE9 dist/. Le serveur de d\xE9veloppement Vite est strictement interdit en staging."
    };
  }
  const serveStaticDist = explicitTrue || isProductionNodeEnv;
  const strictSecurityMode = isProductionNodeEnv || isStagingNodeEnv || serveStaticDist;
  return {
    isValid: true,
    serveStaticDist,
    strictSecurityMode,
    isProductionNodeEnv,
    isStagingNodeEnv,
    explicitStaticDistFlag: hasExplicitFlag ? rawFlag : void 0
  };
}
var MAX_TRUST_PROXY_HOPS = 32;
var ALLOWED_TRUST_PROXY_PRESETS = /* @__PURE__ */ new Set([
  "loopback",
  "linklocal",
  "uniquelocal"
]);
function isValidIpOrCidrToken(token) {
  if (!token || /\s/.test(token)) {
    return false;
  }
  const slashIdx = token.indexOf("/");
  if (slashIdx === -1) {
    return import_node_net.default.isIP(token) !== 0;
  }
  if (token.indexOf("/", slashIdx + 1) !== -1) {
    return false;
  }
  const ipPart = token.slice(0, slashIdx);
  const prefixPart = token.slice(slashIdx + 1);
  if (!/^\d+$/.test(prefixPart)) {
    return false;
  }
  const ipVersion = import_node_net.default.isIP(ipPart);
  if (ipVersion === 0) {
    return false;
  }
  const prefix = Number(prefixPart);
  const maxPrefix = ipVersion === 4 ? 32 : 128;
  return Number.isSafeInteger(prefix) && prefix >= 0 && prefix <= maxPrefix;
}
function resolveTrustProxyConfig(rawTrustProxy, options = {}) {
  const defaultValue = options.strictSecurityMode ? 1 : false;
  if (rawTrustProxy === void 0) {
    return {
      isValid: true,
      value: defaultValue
    };
  }
  if (typeof rawTrustProxy !== "string" || /[\x00-\x1f\x7f]/.test(rawTrustProxy)) {
    return {
      isValid: false,
      value: defaultValue,
      rawValue: String(rawTrustProxy),
      error: "TRUST_PROXY contient des caract\xE8res de contr\xF4le interdits ou un type invalide."
    };
  }
  const trimmed = rawTrustProxy.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      value: defaultValue,
      rawValue: rawTrustProxy,
      error: "TRUST_PROXY ne peut pas \xEAtre vide lorsqu'il est explicitement d\xE9fini."
    };
  }
  const lower = trimmed.toLowerCase();
  if (lower === "true") {
    if (options.strictSecurityMode) {
      return {
        isValid: false,
        value: defaultValue,
        rawValue: trimmed,
        error: "TRUST_PROXY=true est interdit en mode strict (production, staging ou livraison statique) : utilisez un nombre explicite de sauts (ex. TRUST_PROXY=1 pour Cloud Run), 'false', un preset document\xE9 ou une liste IP/CIDR."
      };
    }
    return { isValid: true, value: true, rawValue: trimmed };
  }
  if (lower === "false") {
    return { isValid: true, value: false, rawValue: trimmed };
  }
  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    if (!Number.isSafeInteger(hops) || hops < 0 || hops > MAX_TRUST_PROXY_HOPS) {
      return {
        isValid: false,
        value: defaultValue,
        rawValue: trimmed,
        error: `TRUST_PROXY entier hors bornes ('${trimmed}'). Valeurs autoris\xE9es : entier entre 0 et ${MAX_TRUST_PROXY_HOPS}.`
      };
    }
    return { isValid: true, value: hops, rawValue: trimmed };
  }
  const rawParts = trimmed.split(",");
  const normalizedTokens = [];
  for (const part of rawParts) {
    const token = part.trim();
    if (!token) {
      return {
        isValid: false,
        value: defaultValue,
        rawValue: trimmed,
        error: `TRUST_PROXY mal form\xE9 ('${trimmed}') : entr\xE9e vide dans la liste de proxies.`
      };
    }
    const tokenLower = token.toLowerCase();
    if (ALLOWED_TRUST_PROXY_PRESETS.has(tokenLower)) {
      normalizedTokens.push(tokenLower);
      continue;
    }
    if (isValidIpOrCidrToken(token)) {
      normalizedTokens.push(token);
      continue;
    }
    return {
      isValid: false,
      value: defaultValue,
      rawValue: trimmed,
      error: `Valeur TRUST_PROXY non reconnue ou mal form\xE9e ('${token}'). Formats autoris\xE9s : true, false, entier 0..${MAX_TRUST_PROXY_HOPS}, loopback, linklocal, uniquelocal, IP/CIDR valide.`
    };
  }
  return {
    isValid: true,
    value: normalizedTokens.length === 1 ? normalizedTokens[0] : normalizedTokens,
    rawValue: trimmed
  };
}
var OPENCV_EMBIND_UNSAFE_EVAL_DEPENDENCY = "@techstark/opencv-js@5.0.0-release.1";
var OPENCV_EMBIND_UNSAFE_EVAL_JUSTIFICATION = "Requis par @techstark/opencv-js@5.0.0-release.1 (charg\xE9 par src/pdi/sketch/openCvSketchDetector.ts) : le runtime Emscripten Embind ex\xE9cute inconditionnellement `new Function(...)` dans `createJsInvoker` (via `craftInvokerFunction`, 5 sites) et `__emval_get_method_caller` sans fallback statique ; `'wasm-unsafe-eval'` seul autorise WebAssembly mais pas `new Function()`.";
function buildContentSecurityPolicy(env = process.env) {
  const frameAncestors = resolveCspFrameAncestors(env);
  const scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://apis.google.com";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app https://ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app",
    frameAncestors.directive,
    "object-src 'none'"
  ];
  return {
    headerValue: directives.join("; "),
    scriptSrc,
    frameAncestors,
    allowsUnsafeEval: true,
    unsafeEvalDependency: OPENCV_EMBIND_UNSAFE_EVAL_DEPENDENCY,
    unsafeEvalJustification: OPENCV_EMBIND_UNSAFE_EVAL_JUSTIFICATION
  };
}
function resolveCspFrameAncestors(env = process.env) {
  const deliveryMode = resolveServerDeliveryMode(env);
  const isProd = deliveryMode.strictSecurityMode;
  const failClosedAncestors = ["'self'", VERIFIED_AISTUDIO_FRAME_ANCESTOR];
  const failClosedValue = failClosedAncestors.join(" ");
  const ancestorsSet = new Set(failClosedAncestors);
  if (env.APP_URL !== void 0 && env.APP_URL.trim() !== "") {
    const appUrlCheck = validateAppUrl(env.APP_URL);
    if (!appUrlCheck.isValid || !appUrlCheck.normalizedOrigin) {
      return {
        isValid: false,
        value: failClosedValue,
        directive: `frame-ancestors ${failClosedValue}`,
        ancestors: failClosedAncestors,
        error: `Invalid APP_URL for CSP frame-ancestors: ${appUrlCheck.error}`
      };
    }
    ancestorsSet.add(appUrlCheck.normalizedOrigin);
  }
  const rawCspAncestors = env.CSP_FRAME_ANCESTORS;
  if (rawCspAncestors === void 0 || rawCspAncestors.trim() === "") {
    if (!isProd) {
      ancestorsSet.add("https://*.google.com");
      ancestorsSet.add("https://*.usercontent.goog");
      if (env.APP_URL && /^https:\/\/ais-dev-[a-z0-9-]+\.[a-z0-9.-]+\.run\.app$/i.test(env.APP_URL.trim())) {
        ancestorsSet.add(env.APP_URL.trim().replace(/^https:\/\/ais-dev-/i, "https://ais-pre-"));
      }
      ancestorsSet.add("http://localhost:3000");
      ancestorsSet.add("http://127.0.0.1:3000");
    }
    const ancestors2 = Array.from(ancestorsSet);
    const value2 = ancestors2.join(" ");
    return {
      isValid: true,
      value: value2,
      directive: `frame-ancestors ${value2}`,
      ancestors: ancestors2
    };
  }
  if (/[\x00-\x1f\x7f;]/.test(rawCspAncestors)) {
    return {
      isValid: false,
      value: failClosedValue,
      directive: `frame-ancestors ${failClosedValue}`,
      ancestors: failClosedAncestors,
      error: "CSP_FRAME_ANCESTORS contains forbidden control characters or directive separator ';'"
    };
  }
  const tokens = rawCspAncestors.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return {
      isValid: false,
      value: failClosedValue,
      directive: `frame-ancestors ${failClosedValue}`,
      ancestors: failClosedAncestors,
      error: "CSP_FRAME_ANCESTORS cannot be whitespace-only"
    };
  }
  for (const token of tokens) {
    if (token === "'self'" || token === "self") {
      ancestorsSet.add("'self'");
      continue;
    }
    if (token === "*") {
      if (isProd) {
        return {
          isValid: false,
          value: failClosedValue,
          directive: `frame-ancestors ${failClosedValue}`,
          ancestors: failClosedAncestors,
          error: "Wildcard '*' is strictly forbidden in CSP_FRAME_ANCESTORS in production"
        };
      }
      ancestorsSet.add("*");
      continue;
    }
    if (token.includes("*")) {
      return {
        isValid: false,
        value: failClosedValue,
        directive: `frame-ancestors ${failClosedValue}`,
        ancestors: failClosedAncestors,
        error: `Wildcard origin '${token}' is forbidden in CSP_FRAME_ANCESTORS`
      };
    }
    const originCheck = validateOriginEntry(token, { allowLocalhostHttp: !isProd });
    if (!originCheck.isValid || !originCheck.normalizedOrigin) {
      return {
        isValid: false,
        value: failClosedValue,
        directive: `frame-ancestors ${failClosedValue}`,
        ancestors: failClosedAncestors,
        error: `Invalid origin '${token}' in CSP_FRAME_ANCESTORS: ${originCheck.error}`
      };
    }
    ancestorsSet.add(originCheck.normalizedOrigin);
  }
  const ancestors = Array.from(ancestorsSet);
  const value = ancestors.join(" ");
  return {
    isValid: true,
    value,
    directive: `frame-ancestors ${value}`,
    ancestors
  };
}
var SUPABASE_SECRET_CREDENTIAL_PATTERN = /sb_secret_[0-9a-zA-Z_-]{16,}/;
var SUPABASE_PAT_CREDENTIAL_PATTERN = /sbp_[0-9a-zA-Z]{20,}/;
function containsExposedSupabaseSecretCredential(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  const trimmed = value.trim();
  return /^sb_secret_/i.test(trimmed) || SUPABASE_SECRET_CREDENTIAL_PATTERN.test(trimmed) || SUPABASE_PAT_CREDENTIAL_PATTERN.test(trimmed);
}
function verifyProductionConfig(env = process.env) {
  const deliveryMode = resolveServerDeliveryMode(env);
  const isProduction = deliveryMode.isProductionNodeEnv;
  const isStrictSecurity = deliveryMode.strictSecurityMode;
  const missingCriticalKeys = [];
  const forbiddenViteSecretKeys = [];
  const invalidConfigKeys = [];
  let hasFatalSandboxConfigError = false;
  if (!deliveryMode.isValid) {
    hasFatalSandboxConfigError = true;
    invalidConfigKeys.push(
      `PDI_SERVE_STATIC_DIST (${deliveryMode.errorMessage ?? "Invalid static delivery configuration"})`
    );
  }
  const sensitiveSecretNames = [
    "PADDLE_WEBHOOK_SECRET",
    "PADDLE_WEBHOOK_SECRET_KEY",
    "SLICKPAY_WEBHOOK_SECRET",
    "FIREBASE_SERVICE_ACCOUNT",
    "FIREBASE_ADMIN_CREDENTIALS",
    "SMTP_PASSWORD",
    "BREVO_API_KEY",
    "RESEND_API_KEY",
    "SENDER_API_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SB_SECRET",
    "SB_SECRET_KEY",
    "DATABASE_URL",
    "DIRECT_URL",
    "SQL_PASSWORD",
    "SQL_ADMIN_PASSWORD"
  ];
  for (const name of sensitiveSecretNames) {
    if (env[`VITE_${name}`] !== void 0) {
      forbiddenViteSecretKeys.push(`VITE_${name}`);
    }
  }
  for (const [envKey, envVal] of Object.entries(env)) {
    if (envKey.startsWith("VITE_") && containsExposedSupabaseSecretCredential(envVal) && !forbiddenViteSecretKeys.includes(envKey)) {
      forbiddenViteSecretKeys.push(envKey);
    }
  }
  if (isProduction) {
    const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || env.VITE_FIREBASE_PROJECT_ID || "graphical-router-x18qq";
    if (projectId.startsWith("demo-") && !env.ALLOW_DEMO_PROJECT_IN_PROD) {
      missingCriticalKeys.push("FIREBASE_PROJECT_ID (cannot use demo project in production)");
    }
  }
  const pdiEnvCheck = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });
  if (!pdiEnvCheck.isValid) {
    hasFatalSandboxConfigError = true;
    invalidConfigKeys.push(
      `PDI_ENV/VITE_PDI_ENV (${pdiEnvCheck.errorCode}: ${pdiEnvCheck.errorMessage})`
    );
  }
  if (env.APP_URL !== void 0 && env.APP_URL.trim() !== "") {
    const appUrlCheck = validateAppUrl(env.APP_URL);
    if (!appUrlCheck.isValid) {
      invalidConfigKeys.push(`APP_URL (${appUrlCheck.error})`);
    }
  }
  if (env.ALLOWED_ORIGINS !== void 0 && env.ALLOWED_ORIGINS.trim() !== "") {
    const originsCheck = validateAllowedOrigins(env.ALLOWED_ORIGINS, {
      isProduction: isStrictSecurity,
      appUrl: env.APP_URL
    });
    if (!originsCheck.isValid) {
      invalidConfigKeys.push(`ALLOWED_ORIGINS (${originsCheck.error})`);
    }
  }
  const trustProxyCheck = resolveTrustProxyConfig(env.TRUST_PROXY, {
    strictSecurityMode: isStrictSecurity
  });
  if (!trustProxyCheck.isValid) {
    invalidConfigKeys.push(`TRUST_PROXY (${trustProxyCheck.error})`);
  }
  const cspCheck = resolveCspFrameAncestors(env);
  if (!cspCheck.isValid) {
    invalidConfigKeys.push(`CSP_FRAME_ANCESTORS (${cspCheck.error})`);
  }
  const isSafe = missingCriticalKeys.length === 0 && forbiddenViteSecretKeys.length === 0 && invalidConfigKeys.length === 0;
  let errorMessage;
  if (!isSafe) {
    const issues = [];
    if (missingCriticalKeys.length > 0) {
      issues.push(`Missing critical server keys: ${missingCriticalKeys.join(", ")}`);
    }
    if (forbiddenViteSecretKeys.length > 0) {
      issues.push(
        `Server secrets MUST NOT use VITE_ prefix (exposed to client bundle): ${forbiddenViteSecretKeys.join(", ")}`
      );
    }
    if (invalidConfigKeys.length > 0) {
      issues.push(`Invalid security configuration: ${invalidConfigKeys.join("; ")}`);
    }
    errorMessage = `[FATAL] Server startup configuration failure: ${issues.join("; ")}`;
  }
  return {
    isSafe,
    missingCriticalKeys,
    forbiddenViteSecretKeys,
    invalidConfigKeys,
    hasFatalSandboxConfigError,
    errorMessage
  };
}
var HTTP_BODY_LIMIT = "256kb";
var URLENCODED_PARAMETER_LIMIT = 100;
function createPaddleWebhookBodyParser() {
  return import_express.default.json({
    limit: HTTP_BODY_LIMIT,
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  });
}
function createStandardJsonParser() {
  const jsonParser = import_express.default.json({
    limit: HTTP_BODY_LIMIT
  });
  return (req, res, next) => {
    const cleanPath = (req.originalUrl || req.url || req.path || "").split("?")[0];
    if (cleanPath === "/api/webhooks/paddle") {
      return next();
    }
    return jsonParser(req, res, next);
  };
}
function createStandardUrlencodedParser() {
  return import_express.default.urlencoded({
    limit: HTTP_BODY_LIMIT,
    extended: false,
    parameterLimit: URLENCODED_PARAMETER_LIMIT
  });
}
function createGlobalExpressErrorHandler() {
  return (err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    const status = Number(err?.status || err?.statusCode || 500);
    const errorType = typeof err?.type === "string" ? err.type : "";
    if (errorType === "entity.too.large" || status === 413) {
      console.warn("[HTTP 413] Request payload exceeded maximum allowed size (256kb).");
      return res.status(413).json({
        error: "Payload too large",
        code: "PAYLOAD_TOO_LARGE"
      });
    }
    if (errorType === "entity.parse.failed" || errorType === "parameters.too.many" || errorType === "charset.unsupported" || errorType === "encoding.unsupported" || err instanceof SyntaxError && status === 400 || status === 400) {
      console.warn("[HTTP 400] Malformed request body rejected.");
      return res.status(400).json({
        error: "Malformed request payload",
        code: "MALFORMED_PAYLOAD"
      });
    }
    console.error("[HTTP 500] Unhandled internal server error:", err?.code || errorType || "InternalError");
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  };
}

// src/server/supabaseAdmin.ts
var SupabaseAdminConfigError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SupabaseAdminConfigError";
    this.code = code;
  }
};
var SB_SECRET_PREFIX = ["sb", "secret", ""].join("_");
var SB_PUBLISHABLE_PREFIX = ["sb", "publishable", ""].join("_");
var SB_MANAGEMENT_PAT_PREFIX = ["sbp", ""].join("_");
var FORBIDDEN_VITE_SECRET_KEYS = [
  ["VITE", "SUPABASE", "SECRET", "KEY"].join("_"),
  ["VITE", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
  ["VITE", "SB", "SECRET"].join("_"),
  ["VITE", "SB", "SECRET", "KEY"].join("_")
];
var SB_SECRET_KEY_REGEX = /^sb_secret_[0-9a-zA-Z_-]{16,}$/;
var JWT_STRUCTURE_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function detectBrowserRuntime(override) {
  if (typeof override === "boolean") {
    return override;
  }
  return typeof globalThis.window !== "undefined" || typeof globalThis.document !== "undefined";
}
function decodeJwtPayloadRole(token) {
  if (!JWT_STRUCTURE_REGEX.test(token)) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
    const jsonText = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonText);
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}
function redactSupabaseSecret(rawValue) {
  if (typeof rawValue !== "string") {
    return "[non-string]";
  }
  let sanitized = rawValue;
  sanitized = sanitized.replace(/sb_secret_[0-9a-zA-Z_-]+/g, "[REDACTED_SUPABASE_SECRET]");
  sanitized = sanitized.replace(/sbp_[0-9a-zA-Z_-]+/g, "[REDACTED_SUPABASE_PAT]");
  sanitized = sanitized.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[REDACTED_JWT]"
  );
  return sanitized;
}
function sanitizeSupabaseAdminError(error) {
  if (error instanceof Error) {
    return redactSupabaseSecret(error.message);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = error.message;
    if (typeof msg === "string") {
      return redactSupabaseSecret(msg);
    }
  }
  return redactSupabaseSecret(String(error));
}
function validateSupabaseAdminConfig(env = process.env, options = {}) {
  if (detectBrowserRuntime(options.isBrowserRuntime)) {
    throw new SupabaseAdminConfigError(
      "BROWSER_CONTEXT_FORBIDDEN",
      "Le client Supabase Admin serveur ne peut jamais \xEAtre initialis\xE9 dans un contexte navigateur."
    );
  }
  for (const forbiddenKey of FORBIDDEN_VITE_SECRET_KEYS) {
    const val = env[forbiddenKey];
    if (typeof val === "string" && val.trim().length > 0) {
      throw new SupabaseAdminConfigError(
        "FORBIDDEN_VITE_SECRET",
        `Variable navigateur interdite d\xE9tect\xE9e (${forbiddenKey}). Les secrets Supabase doivent \xEAtre exclusivement c\xF4t\xE9 serveur.`
      );
    }
  }
  for (const [envKey, envVal] of Object.entries(env)) {
    if (envKey.startsWith("VITE_") && containsExposedSupabaseSecretCredential(envVal)) {
      throw new SupabaseAdminConfigError(
        "FORBIDDEN_VITE_SECRET",
        `Une variable VITE_* (${envKey}) contient une cl\xE9 secr\xE8te Supabase. Ex\xE9cution serveur bloqu\xE9e.`
      );
    }
  }
  const rawUrl = (env.SUPABASE_URL ?? "").trim();
  if (!rawUrl) {
    throw new SupabaseAdminConfigError(
      "MISSING_SUPABASE_URL",
      "Variable serveur SUPABASE_URL manquante. D\xE9finir SUPABASE_URL c\xF4t\xE9 serveur (sans pr\xE9fixe VITE_)."
    );
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL est mal form\xE9e. Une URL HTTPS valide est requise."
    );
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL ne doit pas contenir d'identifiants int\xE9gr\xE9s."
    );
  }
  const isLocalhost = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
  const protocolAllowed = parsedUrl.protocol === "https:" || options.allowInsecureLocalhost === true && parsedUrl.protocol === "http:" && isLocalhost;
  if (!protocolAllowed) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL doit utiliser le protocole HTTPS."
    );
  }
  if (parsedUrl.search || parsedUrl.hash || parsedUrl.pathname && parsedUrl.pathname !== "/") {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_URL",
      "SUPABASE_URL doit pointer uniquement vers l'origine du projet Supabase (sans chemin ni param\xE8tres)."
    );
  }
  const rawSecretKey = (env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!rawSecretKey) {
    throw new SupabaseAdminConfigError(
      "MISSING_SUPABASE_SECRET_KEY",
      "Variable serveur SUPABASE_SECRET_KEY manquante."
    );
  }
  if (rawSecretKey.startsWith(SB_PUBLISHABLE_PREFIX)) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_SECRET_KEY",
      "SUPABASE_SECRET_KEY ne peut pas \xEAtre une cl\xE9 publique publishable (sb_publishable_*)."
    );
  }
  if (rawSecretKey.startsWith(SB_MANAGEMENT_PAT_PREFIX)) {
    throw new SupabaseAdminConfigError(
      "INVALID_SUPABASE_SECRET_KEY",
      "SUPABASE_SECRET_KEY ne peut pas \xEAtre un Personal Access Token (sbp_*)."
    );
  }
  let keyFormat;
  if (rawSecretKey.startsWith(SB_SECRET_PREFIX)) {
    if (!SB_SECRET_KEY_REGEX.test(rawSecretKey)) {
      throw new SupabaseAdminConfigError(
        "INVALID_SUPABASE_SECRET_KEY",
        "SUPABASE_SECRET_KEY au format sb_secret_* est invalide ou trop courte."
      );
    }
    keyFormat = "sb_secret";
  } else {
    const jwtRole = decodeJwtPayloadRole(rawSecretKey);
    if (jwtRole === "service_role") {
      keyFormat = "service_role_jwt";
    } else if (jwtRole === "anon" || jwtRole === "authenticated") {
      throw new SupabaseAdminConfigError(
        "INVALID_SUPABASE_SECRET_KEY",
        `SUPABASE_SECRET_KEY poss\xE8de un r\xF4le JWT non autoris\xE9 (${jwtRole}). Une cl\xE9 sb_secret_* ou service_role est requise.`
      );
    } else {
      throw new SupabaseAdminConfigError(
        "INVALID_SUPABASE_SECRET_KEY",
        "Format de SUPABASE_SECRET_KEY non reconnu. Attendu : cl\xE9 secr\xE8te sb_secret_* ou JWT service_role."
      );
    }
  }
  return {
    url: parsedUrl.origin,
    secretKey: rawSecretKey,
    keyFormat
  };
}
function createSupabaseAdminClient(env = process.env, options = {}) {
  const config = validateSupabaseAdminConfig(env, options);
  const client = (0, import_supabase_js.createClient)(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        "X-Client-Info": "orthogonal-pdi-server-admin"
      }
    }
  });
  return {
    client,
    url: config.url,
    keyFormat: config.keyFormat
  };
}

// src/server/supabaseSuperAdminBootstrap.ts
var BLOCKED_NEGATIVE_PROFILE_STATUSES = /* @__PURE__ */ new Set([
  "suspended",
  "revoked",
  "disabled"
]);
function normalizeBootstrapEmail(email) {
  return (email ?? "").trim().toLowerCase();
}
function isEmailConfirmed(authUser) {
  return typeof authUser?.email_confirmed_at === "string" && authUser.email_confirmed_at.trim().length > 0;
}
function verifySupabaseSuperAdminAuthority(params) {
  const reasons = [];
  const { authUser, profile } = params;
  if (!authUser) {
    reasons.push("AUTH_USER_MISSING");
  }
  if (!profile) {
    reasons.push("PROFILE_MISSING");
  }
  if (authUser && profile) {
    if (authUser.id !== profile.id) {
      reasons.push("USER_ID_MISMATCH");
    }
    if (normalizeBootstrapEmail(authUser.email) !== normalizeBootstrapEmail(profile.email)) {
      reasons.push("EMAIL_MISMATCH");
    }
  }
  if (authUser && !isEmailConfirmed(authUser)) {
    reasons.push("EMAIL_NOT_CONFIRMED");
  }
  if (profile && profile.role !== "super_admin") {
    reasons.push(`ROLE_NOT_SUPER_ADMIN:${profile.role}`);
  }
  if (profile && profile.status !== "active") {
    reasons.push(`STATUS_NOT_ACTIVE:${profile.status}`);
  }
  return {
    isEffectiveSuperAdmin: reasons.length === 0,
    reasons
  };
}

// src/server/supabaseAuth.ts
var UUID_V4_OR_STANDARD_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var JWT_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;
var ALLOWED_JWT_ALGORITHMS = /* @__PURE__ */ new Set([
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA"
]);
var LEGACY_FIRESTORE_MODULES_PENDING_MIGRATION = [
  "payments_and_webhooks_ledger (Firestore pending_orders / payment_transactions)",
  "country_restrictions (Firestore settings/country_restrictions)",
  "commercial_visits_and_subscriber_usage (Firestore commercial_visits / subscriber_usage)",
  "legacy_firebase_license_keys_and_feedbacks (Firestore license_keys / user_feedbacks)"
];
function decodeBase64UrlJson(segment) {
  if (!segment || !JWT_SEGMENT_REGEX.test(segment)) {
    return null;
  }
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
    const text2 = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(text2);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function isLikelySupabaseAccessToken(token, expectedSupabaseUrl) {
  if (typeof token !== "string" || !token.includes(".")) {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const payload = decodeBase64UrlJson(parts[1]);
  if (!payload || typeof payload.iss !== "string") {
    return false;
  }
  const iss = payload.iss.trim().replace(/\/+$/, "");
  if (expectedSupabaseUrl && expectedSupabaseUrl.trim()) {
    const expectedOrigin = expectedSupabaseUrl.trim().replace(/\/+$/, "");
    return iss === `${expectedOrigin}/auth/v1`;
  }
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1$/i.test(iss) || iss.endsWith("/auth/v1");
}
function parseAndValidateSupabaseJwtClaims(token, options = {}) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      code: "auth/empty-token",
      error: "Unauthorized: Empty bearer token."
    };
  }
  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts.some((p) => !p || !JWT_SEGMENT_REGEX.test(p))) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Malformed Supabase JWT structure."
    };
  }
  const header = decodeBase64UrlJson(parts[0]);
  const payload = decodeBase64UrlJson(parts[1]);
  if (!header || !payload) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Invalid JWT encoding."
    };
  }
  const alg = typeof header.alg === "string" ? header.alg : "";
  if (!alg || alg.toLowerCase() === "none" || !ALLOWED_JWT_ALGORITHMS.has(alg)) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Unsupported or unsigned JWT algorithm."
    };
  }
  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub || !UUID_V4_OR_STANDARD_REGEX.test(sub)) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Missing or invalid subject UUID in Supabase JWT."
    };
  }
  if (isSyntheticSandboxUid(sub) || payload.sandbox_synthetic === true) {
    return {
      ok: false,
      code: "auth/synthetic-identity-forbidden",
      error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server."
    };
  }
  const nowSec = options.nowEpochSeconds ?? Math.floor(Date.now() / 1e3);
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return {
      ok: false,
      code: "auth/malformed-token",
      error: "Unauthorized: Missing expiration claim (exp) in Supabase JWT."
    };
  }
  if (payload.exp <= nowSec) {
    return {
      ok: false,
      code: "auth/token-expired",
      error: "Unauthorized: Supabase access token has expired. Please refresh session."
    };
  }
  if (typeof payload.nbf === "number" && Number.isFinite(payload.nbf) && payload.nbf > nowSec + 5) {
    return {
      ok: false,
      code: "auth/token-not-yet-valid",
      error: "Unauthorized: Supabase access token is not yet valid."
    };
  }
  if (payload.aud !== void 0) {
    const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audList.includes("authenticated")) {
      return {
        ok: false,
        code: "auth/invalid-audience",
        error: "Unauthorized: Invalid Supabase JWT audience."
      };
    }
  }
  if (options.expectedSupabaseUrl && options.expectedSupabaseUrl.trim()) {
    const expectedIss = `${options.expectedSupabaseUrl.trim().replace(/\/+$/, "").toLowerCase()}/auth/v1`;
    const actualIss = typeof payload.iss === "string" ? payload.iss.trim().replace(/\/+$/, "").toLowerCase() : "";
    if (!actualIss || actualIss !== expectedIss) {
      return {
        ok: false,
        code: "auth/invalid-issuer",
        error: "Unauthorized: Supabase JWT issuer does not match configured project."
      };
    }
  }
  return {
    ok: true,
    jwt: {
      header,
      payload
    }
  };
}
function mapProfileRecordToPayload(profile) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    displayName: profile.display_name ?? profile.name,
    role: profile.role,
    status: profile.status,
    accountType: profile.account_type ?? "basic",
    subscriptionPlan: profile.subscription_plan ?? "monthly",
    company: profile.company ?? null,
    country: profile.country ?? null,
    countryCode: profile.country_code ?? null,
    city: profile.city ?? null,
    createdAt: profile.created_at ?? null,
    updatedAt: profile.updated_at ?? null
  };
}
async function verifySupabaseSessionFromBearerToken(token, options) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/empty-token",
      error: "Unauthorized: Empty bearer token."
    };
  }
  const trimmed = token.trim();
  if (isSyntheticSandboxToken(trimmed)) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/synthetic-identity-forbidden",
      error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server."
    };
  }
  const jwtCheck = parseAndValidateSupabaseJwtClaims(trimmed, {
    expectedSupabaseUrl: options.expectedSupabaseUrl,
    nowEpochSeconds: options.nowEpochSeconds
  });
  if ("code" in jwtCheck) {
    return {
      ok: false,
      httpStatus: 401,
      code: jwtCheck.code,
      error: jwtCheck.error
    };
  }
  let authUser;
  try {
    authUser = await options.gateway.verifyAccessTokenAndGetUser(trimmed);
  } catch (err) {
    const safeMsg = sanitizeSupabaseAdminError(err);
    const isExpired = /expired|jwt expired/i.test(safeMsg);
    return {
      ok: false,
      httpStatus: 401,
      code: isExpired ? "auth/token-expired" : "auth/invalid-token",
      error: isExpired ? "Unauthorized: Supabase access token has expired." : "Unauthorized: Invalid or revoked Supabase access token."
    };
  }
  if (!authUser || !authUser.id || !authUser.email) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/invalid-token",
      error: "Unauthorized: Supabase access token could not be verified."
    };
  }
  if (authUser.id !== jwtCheck.jwt.payload.sub) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/invalid-token",
      error: "Unauthorized: Token subject mismatch."
    };
  }
  if (isSyntheticSandboxUid(authUser.id)) {
    return {
      ok: false,
      httpStatus: 401,
      code: "auth/synthetic-identity-forbidden",
      error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server."
    };
  }
  let profile;
  try {
    profile = await options.gateway.findProfileByUserId(authUser.id);
  } catch (err) {
    console.error(
      "[SupabaseAuth] Failed to query public.profiles:",
      sanitizeSupabaseAdminError(err)
    );
    return {
      ok: false,
      httpStatus: 503,
      code: "server/supabase-auth-error",
      error: "Service Unavailable: Unable to verify authoritative user profile."
    };
  }
  if (!profile) {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/profile-not-found",
      error: "Forbidden: No authorized profile found in public.profiles for this account."
    };
  }
  if (normalizeBootstrapEmail(profile.email) !== normalizeBootstrapEmail(authUser.email)) {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/profile-email-mismatch",
      error: "Forbidden: Profile email does not match verified Supabase Auth identity."
    };
  }
  if (BLOCKED_NEGATIVE_PROFILE_STATUSES.has(profile.status)) {
    const statusCodeMap = {
      suspended: "auth/account-suspended",
      revoked: "auth/account-revoked",
      disabled: "auth/account-disabled"
    };
    return {
      ok: false,
      httpStatus: 403,
      code: statusCodeMap[profile.status] ?? "auth/account-disabled",
      error: `Forbidden: Account status '${profile.status}' is not authorized to access the application.`,
      profileStatus: profile.status
    };
  }
  if (profile.status === "pending_activation") {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/pending-activation",
      error: "Forbidden: Account is pending activation.",
      profileStatus: profile.status
    };
  }
  if (profile.status !== "active") {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/account-inactive",
      error: "Forbidden: Account is not active.",
      profileStatus: profile.status
    };
  }
  const emailConfirmed = isEmailConfirmed(authUser);
  if (profile.role === "super_admin" && !emailConfirmed) {
    return {
      ok: false,
      httpStatus: 403,
      code: "auth/unverified-email",
      error: "Forbidden: Email confirmation is mandatory before super_admin privileges take effect.",
      profileStatus: profile.status
    };
  }
  const authority = verifySupabaseSuperAdminAuthority({
    authUser,
    profile
  });
  const verifiedSession = {
    provider: "supabase",
    userId: authUser.id,
    email: authUser.email,
    emailConfirmed,
    emailConfirmedAt: authUser.email_confirmed_at ?? null,
    role: profile.role,
    status: profile.status,
    isSuperAdmin: authority.isEffectiveSuperAdmin,
    tokenExp: jwtCheck.jwt.payload.exp,
    tokenIat: typeof jwtCheck.jwt.payload.iat === "number" ? jwtCheck.jwt.payload.iat : null,
    profile: mapProfileRecordToPayload(profile)
  };
  return {
    ok: true,
    session: verifiedSession
  };
}
function createSupabaseServerAuthGateway(adminClient) {
  return {
    async verifyAccessTokenAndGetUser(accessToken) {
      const { data, error } = await adminClient.auth.getUser(accessToken);
      if (error || !data?.user || !data.user.email) {
        if (error) {
          throw new Error(sanitizeSupabaseAdminError(error));
        }
        return null;
      }
      return {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at ?? null,
        invited_at: data.user.invited_at ?? null,
        created_at: data.user.created_at ?? null,
        user_metadata: null,
        app_metadata: null
      };
    },
    async findProfileByUserId(userId) {
      const { data, error } = await adminClient.from("profiles").select(
        "id, email, name, display_name, role, status, account_type, subscription_plan, firebase_uid, company, country, country_code, city, created_at, updated_at"
      ).eq("id", userId).maybeSingle();
      if (error) {
        throw new Error(`profiles.select failed: ${sanitizeSupabaseAdminError(error)}`);
      }
      return data ?? null;
    },
    async getSuperAdminOverview(verifiedSession) {
      const [profilesRes, auditRes, projectsCountRes, licensesCountRes, auditCountRes] = await Promise.all([
        adminClient.from("profiles").select(
          "id, email, name, role, status, account_type, subscription_plan, company, created_at"
        ).order("created_at", { ascending: false }).limit(100),
        adminClient.from("audit_logs").select(
          "id, event_type, resource_type, resource_id, severity, actor_user_id, target_user_id, created_at"
        ).order("created_at", { ascending: false }).limit(25),
        adminClient.from("projects").select("id", { count: "exact", head: true }),
        adminClient.from("license_keys").select("id", { count: "exact", head: true }),
        adminClient.from("audit_logs").select("id", { count: "exact", head: true })
      ]);
      if (profilesRes.error) {
        throw new Error(`profiles overview failed: ${sanitizeSupabaseAdminError(profilesRes.error)}`);
      }
      if (auditRes.error) {
        throw new Error(`audit_logs overview failed: ${sanitizeSupabaseAdminError(auditRes.error)}`);
      }
      const rawProfiles = profilesRes.data ?? [];
      const profiles = rawProfiles.map((row) => ({
        id: String(row.id),
        email: String(row.email),
        name: String(row.name ?? ""),
        role: row.role,
        status: row.status,
        accountType: String(row.account_type ?? "basic"),
        subscriptionPlan: String(row.subscription_plan ?? "monthly"),
        company: typeof row.company === "string" ? row.company : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null
      }));
      const rawAudits = auditRes.data ?? [];
      const recentAuditLogs = rawAudits.map((row) => ({
        id: String(row.id),
        eventType: String(row.event_type ?? ""),
        resourceType: String(row.resource_type ?? ""),
        resourceId: typeof row.resource_id === "string" ? row.resource_id : null,
        severity: row.severity ?? "info",
        actorUserId: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
        targetUserId: typeof row.target_user_id === "string" ? row.target_user_id : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null
      }));
      return {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        verifiedSuperAdmin: {
          userId: verifiedSession.userId,
          email: verifiedSession.email,
          emailConfirmedAt: verifiedSession.emailConfirmedAt ?? ""
        },
        counts: {
          profiles: profiles.length,
          activeProfiles: profiles.filter((p) => p.status === "active").length,
          superAdmins: profiles.filter((p) => p.role === "super_admin" && p.status === "active").length,
          projects: projectsCountRes.count ?? 0,
          licenseKeys: licensesCountRes.count ?? 0,
          auditLogs: auditCountRes.count ?? recentAuditLogs.length
        },
        profiles,
        recentAuditLogs,
        legacyFirestoreModulesPendingMigration: [...LEGACY_FIRESTORE_MODULES_PENDING_MIGRATION]
      };
    }
  };
}
function resolveSupabaseServerAuthGateway(env = process.env, injectedGateway) {
  if (injectedGateway) {
    return {
      gateway: injectedGateway,
      expectedSupabaseUrl: env.SUPABASE_URL?.trim() || void 0
    };
  }
  try {
    const { client, url } = createSupabaseAdminClient(env);
    return {
      gateway: createSupabaseServerAuthGateway(client),
      expectedSupabaseUrl: url
    };
  } catch (err) {
    if (err instanceof SupabaseAdminConfigError) {
      return null;
    }
    return null;
  }
}
function createRequireSupabaseAuth(env = process.env, options = {}) {
  let cachedGateway = null;
  return async (req, res, next) => {
    const headers = req.headers ?? {};
    if (headers["x-pdi-sandbox-identity"]) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden"
      });
    }
    const authHeader = typeof headers.authorization === "string" ? headers.authorization : "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized: Missing or invalid authorization header",
        code: "auth/missing-token"
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized: Empty bearer token",
        code: "auth/empty-token"
      });
    }
    if (isSyntheticSandboxToken(token)) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden"
      });
    }
    if (isStagingSandboxMode(env)) {
      return res.status(403).json({
        error: "Forbidden: Supabase server authentication is disabled in Sandbox mode.",
        code: "sandbox/server-auth-disabled"
      });
    }
    if (!cachedGateway) {
      cachedGateway = resolveSupabaseServerAuthGateway(env, options.gateway);
    }
    if (!cachedGateway) {
      return res.status(503).json({
        error: "Service Unavailable: Supabase server authentication is not configured (SUPABASE_URL and SUPABASE_SECRET_KEY required on server).",
        code: "server/supabase-auth-unconfigured"
      });
    }
    const verification = await verifySupabaseSessionFromBearerToken(token, {
      gateway: cachedGateway.gateway,
      expectedSupabaseUrl: cachedGateway.expectedSupabaseUrl,
      nowEpochSeconds: options.nowEpochSeconds?.()
    });
    if ("code" in verification) {
      return res.status(verification.httpStatus).json({
        error: verification.error,
        code: verification.code,
        ...verification.profileStatus ? { profileStatus: verification.profileStatus } : {}
      });
    }
    const session = verification.session;
    req.supabaseSession = session;
    req.user = {
      uid: session.userId,
      email: session.email,
      email_verified: session.emailConfirmed,
      role: session.role,
      name: session.profile.name,
      auth_provider: "supabase"
    };
    next();
  };
}
function requireSupabaseSuperAdmin(req, res, next) {
  const session = req.supabaseSession;
  if (!session) {
    return res.status(401).json({
      error: "Unauthorized: Verified Supabase session required.",
      code: "auth/missing-token"
    });
  }
  if (session.isSuperAdmin !== true || session.role !== "super_admin" || session.status !== "active" || session.emailConfirmed !== true) {
    return res.status(403).json({
      error: "Forbidden: Verified active super_admin role with confirmed email required.",
      code: "auth/forbidden-super-admin"
    });
  }
  next();
}

// src/middleware/auth.ts
function createRejectInStagingSandboxMode(env) {
  return (req, res, next) => {
    const effectiveEnv = env ?? process.env;
    const headers = req?.headers ?? {};
    if (headers["x-pdi-sandbox-identity"]) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden"
      });
    }
    const authHeader = typeof headers.authorization === "string" ? headers.authorization : "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1]?.trim();
      if (token && isSyntheticSandboxToken(token)) {
        return res.status(401).json({
          error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
          code: "auth/synthetic-identity-forbidden"
        });
      }
    }
    if (isStagingSandboxMode(effectiveEnv)) {
      return res.status(403).json({
        error: "Forbidden: Server-side administrative, payment, webhook, and database persistence routes are disabled in Sandbox mode.",
        code: "sandbox/server-mutation-forbidden"
      });
    }
    next();
  };
}
var rejectInStagingSandboxMode = createRejectInStagingSandboxMode();
function createRequireAuth(env, options = {}) {
  const resolveAdminAuth = options.getAdminAuth ?? getServerAdminAuth;
  const allowFirebaseFallback = options.allowFirebaseFallback !== false;
  return async (req, res, next) => {
    const effectiveEnv = env ?? process.env;
    if (req.headers["x-pdi-sandbox-identity"]) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden"
      });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized: Missing or invalid authorization header",
        code: "auth/missing-token"
      });
    }
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized: Empty bearer token",
        code: "auth/empty-token"
      });
    }
    if (isSyntheticSandboxToken(token)) {
      return res.status(401).json({
        error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
        code: "auth/synthetic-identity-forbidden"
      });
    }
    if (isStagingSandboxMode(effectiveEnv)) {
      return res.status(403).json({
        error: "Forbidden: Server authentication is disabled in Sandbox mode.",
        code: "sandbox/server-auth-disabled"
      });
    }
    const isSupabaseCandidate = isLikelySupabaseAccessToken(token, options.expectedSupabaseUrl);
    if (options.verifySupabaseToken && isSupabaseCandidate) {
      const supabaseResult = await options.verifySupabaseToken(token);
      if (!supabaseResult) {
        return res.status(503).json({
          error: "Service Unavailable: Supabase server authentication is not configured.",
          code: "server/supabase-auth-unconfigured"
        });
      }
      if ("code" in supabaseResult) {
        return res.status(supabaseResult.httpStatus).json({
          error: supabaseResult.error,
          code: supabaseResult.code,
          ...supabaseResult.profileStatus ? { profileStatus: supabaseResult.profileStatus } : {}
        });
      }
      const session = supabaseResult.session;
      req.supabaseSession = session;
      req.user = {
        uid: session.userId,
        sub: session.userId,
        email: session.email,
        email_verified: session.emailConfirmed,
        role: session.role,
        name: session.profile.name,
        auth_provider: "supabase"
      };
      return next();
    }
    if (!allowFirebaseFallback) {
      if (!options.verifySupabaseToken) {
        return res.status(503).json({
          error: "Service Unavailable: Supabase server authentication is not configured.",
          code: "server/supabase-auth-unconfigured"
        });
      }
      return res.status(401).json({
        error: "Unauthorized: Valid Supabase Bearer token required",
        code: "auth/supabase-token-required"
      });
    }
    try {
      const decodedToken = await resolveAdminAuth().verifyIdToken(token);
      if (isSyntheticSandboxUid(decodedToken?.uid) || decodedToken?.sandbox_synthetic === true) {
        return res.status(401).json({
          error: "Unauthorized: Synthetic Sandbox identity is strictly forbidden on server",
          code: "auth/synthetic-identity-forbidden"
        });
      }
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Error verifying Firebase ID token in requireAuth:", error?.code || error?.message || error);
      if (error?.code === "auth/id-token-expired") {
        return res.status(401).json({
          error: "Unauthorized: Firebase ID token has expired. Please refresh token.",
          code: "auth/id-token-expired"
        });
      }
      return res.status(401).json({
        error: "Unauthorized: Invalid authentication token",
        code: "auth/invalid-token"
      });
    }
  };
}
var requireAuth = createRequireAuth();
var isEmailVerified = (user) => {
  return user?.email_verified === true;
};
var requireEmailVerified = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: "Unauthorized: User authentication required",
      code: "auth/unauthorized"
    });
  }
  if (!isEmailVerified(user)) {
    return res.status(403).json({
      error: "Forbidden: Email verification required for this operation",
      code: "auth/unverified-email"
    });
  }
  next();
};
var requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: "Unauthorized: User authentication required",
        code: "auth/unauthorized"
      });
    }
    const effectiveRole = typeof user.role === "string" ? user.role : "client";
    if (allowedRoles.includes(effectiveRole)) {
      return next();
    }
    return res.status(403).json({
      error: "Forbidden: Insufficient privileges for this operation",
      code: "auth/forbidden-role"
    });
  };
};
var requireSuperAdmin = requireRole(["super_admin"]);

// src/security/webhooks/pendingOrderRepository.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);

// src/security/webhooks/webhookTypes.ts
var AUTHORITATIVE_PENDING_ORDER_COLLECTION = "payment_transactions";
var PAYMENT_WEBHOOK_EVENTS_COLLECTION = "payment_webhook_events";

// src/security/webhooks/pendingOrderRepository.ts
function extractNonEmptyString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}
function deriveWebhookEventDocumentId(provider, eventId) {
  const cleanProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const cleanEventId = typeof eventId === "string" ? eventId.trim() : "";
  if (cleanProvider !== "paddle") {
    throw new Error(`Unsupported webhook provider for idempotency key: '${String(provider)}'`);
  }
  if (!cleanEventId) {
    throw new Error("Cannot derive webhook idempotency document key from an empty eventId.");
  }
  const digest = import_node_crypto2.default.createHash("sha256").update(`${cleanProvider}:${cleanEventId}`, "utf8").digest("hex");
  return `${cleanProvider}_${digest}`;
}
function parseFirestoreTimeMs(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value?.toMillis === "function") {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "object" && typeof value.seconds === "number" && Number.isFinite(value.seconds)) {
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1e3 + Math.floor(nanos / 1e6);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function generateAuthoritativeOrderId(provider) {
  const prefix = provider === "slickpay_baridimob" ? "ORD_SLICKPAY" : "ORD_PADDLE";
  const entropy = import_node_crypto2.default.randomBytes(16).toString("hex").toUpperCase();
  return `${prefix}_${entropy}`;
}
function isValidInternalOrderIdFormat(orderId) {
  if (typeof orderId !== "string") return false;
  const trimmed = orderId.trim();
  if (trimmed.length < 12 || trimmed.length > 128) return false;
  if (!/^ORD_(PADDLE|SLICKPAY)_[A-Za-z0-9_-]{1,110}$/.test(trimmed)) return false;
  return true;
}
function isSnapshotExisting(snap) {
  if (!snap) return false;
  if (typeof snap.exists === "function") {
    return Boolean(snap.exists());
  }
  return Boolean(snap.exists);
}
async function executeFencedOrderAssociationTransaction(adminDb2, input, options) {
  if (!adminDb2 || typeof adminDb2.runTransaction !== "function") {
    throw new Error(
      "Firestore Admin transaction support (adminDb.runTransaction) is required for fenced order association."
    );
  }
  const provider = input.provider;
  const eventId = extractNonEmptyString(input.eventId);
  const leaseToken = extractNonEmptyString(input.leaseToken);
  const orderId = extractNonEmptyString(input.orderId);
  const expectedUserUid = extractNonEmptyString(input.userUid);
  const providerTransactionId = extractNonEmptyString(input.providerTransactionId);
  const eventType = extractNonEmptyString(input.eventType) ?? "transaction.completed";
  if (provider !== "paddle") {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_PROVIDER_MISMATCH",
      error: `Order provider '${String(provider)}' does not allow Paddle webhook processing`
    };
  }
  if (!eventId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_EVENT_ID",
      error: "Missing Paddle event_id in webhook payload"
    };
  }
  if (!orderId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_INTERNAL_ORDER_ID",
      error: "Missing internal orderId in Paddle webhook custom_data"
    };
  }
  if (!isValidInternalOrderIdFormat(orderId)) {
    return {
      ok: false,
      statusCode: 422,
      code: "INVALID_INTERNAL_ORDER_ID",
      error: `Invalid internal orderId format: '${orderId}'`
    };
  }
  if (!providerTransactionId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_PROVIDER_TRANSACTION_ID",
      error: "Missing external providerTransactionId in Paddle webhook payload"
    };
  }
  const eventDocId = deriveWebhookEventDocumentId("paddle", eventId);
  const eventDocRef = adminDb2.collection(PAYMENT_WEBHOOK_EVENTS_COLLECTION).doc(eventDocId);
  const orderDocRef = adminDb2.collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION).doc(orderId);
  const resolveNowMs = input.nowMs ?? options?.nowMs ?? (() => Date.now());
  return adminDb2.runTransaction(
    async (tx) => {
      const eventSnap = await tx.get(eventDocRef);
      const orderSnap = await tx.get(orderDocRef);
      const currentTimeMs = resolveNowMs();
      if (!isSnapshotExisting(eventSnap)) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Cannot associate order '${orderId}': webhook event '${eventId}' lease document does not exist.`
        };
      }
      const rawEventData = eventSnap.data() || {};
      const storedEventProvider = extractNonEmptyString(rawEventData.provider);
      const storedEventId = extractNonEmptyString(rawEventData.eventId);
      const storedEventStatus = extractNonEmptyString(rawEventData.status);
      const storedLeaseToken = extractNonEmptyString(rawEventData.leaseToken);
      const leaseExpiresMs = parseFirestoreTimeMs(rawEventData.leaseExpiresAt);
      if (storedEventProvider !== "paddle" || storedEventId !== eventId) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Webhook event document identity mismatch for event '${eventId}'.`
        };
      }
      if (storedEventStatus !== "processing") {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Webhook event '${eventId}' is in status '${String(storedEventStatus)}' (expected 'processing').`
        };
      }
      if (!leaseToken || !storedLeaseToken || storedLeaseToken !== leaseToken) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Lease conflict for webhook event '${eventId}': worker does not hold the active lease token.`
        };
      }
      if (leaseExpiresMs === null || leaseExpiresMs <= currentTimeMs) {
        return {
          ok: false,
          statusCode: 409,
          code: "LEASE_CONFLICT",
          error: `Lease conflict for webhook event '${eventId}': lease has expired prior to order association write.`
        };
      }
      if (!isSnapshotExisting(orderSnap)) {
        return {
          ok: false,
          statusCode: 404,
          code: "ORDER_NOT_FOUND",
          error: `Pending order '${orderId}' not found in authoritative repository`
        };
      }
      const rawOrderData = orderSnap.data();
      if (!rawOrderData || typeof rawOrderData !== "object") {
        return {
          ok: false,
          statusCode: 404,
          code: "ORDER_NOT_FOUND",
          error: `Pending order '${orderId}' not found in authoritative repository`
        };
      }
      const existingOrder = {
        ...rawOrderData,
        id: rawOrderData.id ?? orderSnap.id ?? orderId
      };
      const storedId = extractNonEmptyString(existingOrder.id);
      const storedOrderId = extractNonEmptyString(existingOrder.orderId) ?? storedId;
      if (!storedId || !storedOrderId || storedId !== storedOrderId || storedId !== orderId || !isValidInternalOrderIdFormat(storedId)) {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_INVALID_ID",
          error: "Stored order document has an invalid or inconsistent internal orderId"
        };
      }
      const rawUserId = extractNonEmptyString(existingOrder.userId);
      const rawUserUid = extractNonEmptyString(existingOrder.userUid);
      if (rawUserId && rawUserUid && rawUserId !== rawUserUid) {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_USER_MISMATCH",
          error: "Stored order document has conflicting userId and userUid fields"
        };
      }
      const authoritativeUserUid = rawUserUid ?? rawUserId;
      if (!authoritativeUserUid) {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_MISSING_UID",
          error: "Pending order is missing authoritative owner userUid"
        };
      }
      if (expectedUserUid && expectedUserUid !== authoritativeUserUid || input.customDataUserUid && input.customDataUserUid !== authoritativeUserUid) {
        return {
          ok: false,
          statusCode: 403,
          code: "ORDER_USER_MISMATCH",
          error: "Order belongs to another userUid and cannot be reassigned"
        };
      }
      if (existingOrder.provider !== "paddle") {
        return {
          ok: false,
          statusCode: 422,
          code: "ORDER_PROVIDER_MISMATCH",
          error: `Order provider '${String(existingOrder.provider)}' does not allow Paddle webhook processing`
        };
      }
      const expectedOrExistingTxId = extractNonEmptyString(existingOrder.providerTransactionId) ?? extractNonEmptyString(existingOrder.paddleDetails?.paddleOrderId);
      if (expectedOrExistingTxId && expectedOrExistingTxId !== providerTransactionId) {
        return {
          ok: false,
          statusCode: 409,
          code: "PROVIDER_TRANSACTION_ID_MISMATCH",
          error: `Incoming providerTransactionId '${providerTransactionId}' does not match order transaction '${expectedOrExistingTxId}'`
        };
      }
      if (existingOrder.status !== "pending") {
        return {
          ok: false,
          statusCode: 409,
          code: "ORDER_INVALID_STATUS",
          error: `Order state (status='${String(existingOrder.status)}', associationStatus='${String(existingOrder.associationStatus || "unassociated")}') does not allow new payment association`
        };
      }
      const isAlreadyAssociatedForExactSameEvent = existingOrder.associationStatus === "associated" && expectedOrExistingTxId === providerTransactionId && extractNonEmptyString(existingOrder.lastEventId) === eventId && existingOrder.provider === "paddle" && (!expectedUserUid || authoritativeUserUid === expectedUserUid);
      if (existingOrder.associationStatus === "associated") {
        if (isAlreadyAssociatedForExactSameEvent) {
          return {
            ok: true,
            statusCode: 200,
            alreadyAssociatedForSameEvent: true,
            order: existingOrder
          };
        }
        return {
          ok: false,
          statusCode: 409,
          code: "ORDER_INVALID_STATUS",
          error: `Order state (status='${String(existingOrder.status)}', associationStatus='${String(existingOrder.associationStatus || "unassociated")}') does not allow new payment association`
        };
      }
      const nowIso = input.associatedAt || new Date(currentTimeMs).toISOString();
      const existingPaddleDetails = existingOrder.paddleDetails && typeof existingOrder.paddleDetails === "object" ? existingOrder.paddleDetails : { checkoutId: input.checkoutId || "" };
      const updatedFields = {
        id: orderId,
        orderId,
        userId: authoritativeUserUid,
        userUid: authoritativeUserUid,
        provider: "paddle",
        // SEC-01-FIX-05-B Section 7: Order remains "pending" with associationStatus: "associated"
        status: "pending",
        associationStatus: "associated",
        providerTransactionId,
        lastEventId: eventId,
        lastEventType: eventType,
        associatedAt: nowIso,
        updatedAt: nowIso,
        paddleDetails: {
          ...existingPaddleDetails,
          checkoutId: input.checkoutId || existingPaddleDetails.checkoutId || "",
          paddleOrderId: providerTransactionId,
          ...input.webhookCustomerEmail ? { customerEmail: input.webhookCustomerEmail.toLowerCase() } : {}
        }
      };
      await Promise.resolve(tx.set(orderDocRef, updatedFields, { merge: true }));
      const updatedOrder = {
        ...existingOrder,
        ...updatedFields
      };
      return {
        ok: true,
        statusCode: 200,
        alreadyAssociatedForSameEvent: false,
        order: updatedOrder
      };
    }
  );
}
function createPendingOrderRepository(deps) {
  const defaultNowMs = deps.nowMs ?? (() => Date.now());
  return {
    async createPendingOrder(input) {
      const uid = typeof input.verifiedUserUid === "string" ? input.verifiedUserUid.trim() : "";
      if (!uid) {
        throw new Error("Cannot create authoritative pending order without a verified Firebase userUid.");
      }
      const email = typeof input.verifiedUserEmail === "string" ? input.verifiedUserEmail.trim().toLowerCase() : "";
      if (!email) {
        throw new Error("Cannot create authoritative pending order without a verified userEmail.");
      }
      if (input.provider !== "paddle" && input.provider !== "slickpay_baridimob") {
        throw new Error(`Unsupported payment provider: ${String(input.provider)}`);
      }
      const orderId = generateAuthoritativeOrderId(input.provider);
      const nowIso = new Date(defaultNowMs()).toISOString();
      const pendingOrder = {
        id: orderId,
        orderId,
        userId: uid,
        userUid: uid,
        userEmail: email,
        userName: (input.userName || email.split("@")[0] || "Client PD&I").trim(),
        company: input.company ? input.company.trim() : "",
        country: input.country || (input.provider === "slickpay_baridimob" ? "Alg\xE9rie" : "International"),
        countryCode: (input.countryCode || (input.provider === "slickpay_baridimob" ? "DZ" : "FR")).toUpperCase(),
        city: input.city || "",
        plan: input.plan,
        accountType: input.plan,
        billingCycle: input.billingCycle,
        amount: input.amount,
        currency: input.currency,
        provider: input.provider,
        status: "pending",
        associationStatus: "unassociated",
        ...input.expectedProviderTransactionId ? { providerTransactionId: input.expectedProviderTransactionId.trim() } : {},
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await deps.adminDb.collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION).doc(orderId).set(pendingOrder);
      return pendingOrder;
    },
    async getOrderById(orderId) {
      const trimmedId = typeof orderId === "string" ? orderId.trim() : "";
      if (!trimmedId) return null;
      const docRef = deps.adminDb.collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION).doc(trimmedId);
      if (typeof docRef.get !== "function") {
        return null;
      }
      const snap = await docRef.get();
      if (!isSnapshotExisting(snap)) {
        return null;
      }
      const rawData = snap.data();
      if (!rawData || typeof rawData !== "object") {
        return null;
      }
      const order = {
        ...rawData,
        id: rawData.id ?? snap.id ?? trimmedId
      };
      return order;
    },
    async findOrderByProviderTransactionId(provider, providerTransactionId) {
      const trimmedTxId = typeof providerTransactionId === "string" ? providerTransactionId.trim() : "";
      if (!trimmedTxId) return null;
      const colRef = deps.adminDb.collection(AUTHORITATIVE_PENDING_ORDER_COLLECTION);
      if (typeof colRef.where === "function") {
        const querySnap = await colRef.where("providerTransactionId", "==", trimmedTxId).get();
        const matchedDocs = [];
        if (Array.isArray(querySnap?.docs)) {
          matchedDocs.push(...querySnap.docs);
        } else if (typeof querySnap?.forEach === "function") {
          querySnap.forEach((d) => matchedDocs.push(d));
        }
        for (const docItem of matchedDocs) {
          const data = docItem.data();
          if (data && data.provider === provider) {
            return {
              ...data,
              id: data.id || docItem.id,
              orderId: data.orderId || data.id || docItem.id
            };
          }
        }
      }
      return null;
    },
    async associateOrderWithLeaseFencing(input) {
      return executeFencedOrderAssociationTransaction(deps.adminDb, input, {
        nowMs: input.nowMs ?? defaultNowMs
      });
    },
    async recordOrderTransactionAssociation(input) {
      const fencedResult = await this.associateOrderWithLeaseFencing({
        provider: input.provider,
        eventId: input.eventId,
        leaseToken: input.leaseToken,
        orderId: input.orderId,
        userUid: input.userUid,
        providerTransactionId: input.providerTransactionId,
        eventType: input.eventType,
        customDataUserUid: input.customDataUserUid,
        checkoutId: input.checkoutId,
        webhookCustomerEmail: input.webhookCustomerEmail,
        associatedAt: input.associatedAt,
        nowMs: input.nowMs ?? defaultNowMs
      });
      if (fencedResult.ok === false) {
        const err = new Error(fencedResult.error);
        err.code = fencedResult.code;
        err.statusCode = fencedResult.statusCode;
        throw err;
      }
      return fencedResult.order;
    }
  };
}

// src/security/webhooks/webhookIdempotencyRepository.ts
var import_node_crypto3 = __toESM(require("node:crypto"), 1);
var import_firestore2 = require("@google-cloud/firestore");
var DEFAULT_WEBHOOK_LEASE_DURATION_MS = 6e4;
function generateSecureLeaseToken() {
  return `lease_${import_node_crypto3.default.randomBytes(16).toString("hex")}`;
}
function isDocSnapshotExisting(snap) {
  if (!snap) return false;
  if (typeof snap.exists === "function") {
    return Boolean(snap.exists());
  }
  return Boolean(snap.exists);
}
function buildFirestoreTimestamp(ms) {
  return import_firestore2.Timestamp.fromMillis(ms);
}
function sanitizeErrorCode(rawErrorCode) {
  const trimmed = typeof rawErrorCode === "string" ? rawErrorCode.trim() : "";
  if (!trimmed) return "UNKNOWN_PROCESSING_ERROR";
  const cleaned = trimmed.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 96);
  return cleaned || "UNKNOWN_PROCESSING_ERROR";
}
function normalizeStoredRecord(raw, fallbackProvider, fallbackEventId) {
  const statusRaw = raw.status;
  const status = statusRaw === "completed" || statusRaw === "failed" || statusRaw === "processing" ? statusRaw : "processing";
  const attemptCount = typeof raw.attemptCount === "number" && Number.isFinite(raw.attemptCount) && raw.attemptCount >= 1 ? Math.floor(raw.attemptCount) : 1;
  return {
    provider: raw.provider || fallbackProvider,
    eventId: typeof raw.eventId === "string" ? raw.eventId : fallbackEventId,
    eventType: typeof raw.eventType === "string" ? raw.eventType : "transaction.completed",
    status,
    attemptCount,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    leaseExpiresAt: raw.leaseExpiresAt ?? null,
    leaseToken: typeof raw.leaseToken === "string" ? raw.leaseToken : null,
    completedAt: raw.completedAt ?? null,
    lastErrorCode: typeof raw.lastErrorCode === "string" ? raw.lastErrorCode : null
  };
}
async function executeFirestoreTransaction(adminDb2, fn) {
  if (!adminDb2 || typeof adminDb2.runTransaction !== "function") {
    throw new Error(
      "Firestore Admin transaction support (adminDb.runTransaction) is required for durable webhook idempotency."
    );
  }
  return adminDb2.runTransaction(fn);
}
function createWebhookIdempotencyRepository(deps) {
  const nowMs = deps.nowMs ?? (() => Date.now());
  const defaultLeaseDurationMs = deps.defaultLeaseDurationMs && deps.defaultLeaseDurationMs > 0 ? deps.defaultLeaseDurationMs : DEFAULT_WEBHOOK_LEASE_DURATION_MS;
  const generateToken = deps.generateLeaseToken ?? generateSecureLeaseToken;
  function getEventDocRef(provider, eventId) {
    const documentId = deriveWebhookEventDocumentId(provider, eventId);
    const docRef = deps.adminDb.collection(PAYMENT_WEBHOOK_EVENTS_COLLECTION).doc(documentId);
    return { documentId, docRef };
  }
  return {
    deriveDocumentId(provider, eventId) {
      return deriveWebhookEventDocumentId(provider, eventId);
    },
    getNowMs() {
      return nowMs();
    },
    async acquireEventLease(input) {
      const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
      const eventType = typeof input.eventType === "string" ? input.eventType.trim() : "";
      if (input.provider !== "paddle") {
        throw new Error(`Unsupported provider '${String(input.provider)}' for webhook idempotency.`);
      }
      if (!eventId) {
        throw new Error("Webhook eventId is required to acquire an idempotency lease.");
      }
      if (!eventType) {
        throw new Error("Webhook eventType is required to acquire an idempotency lease.");
      }
      const leaseDurationMs = typeof input.leaseDurationMs === "number" && input.leaseDurationMs > 0 ? input.leaseDurationMs : defaultLeaseDurationMs;
      const { documentId, docRef } = getEventDocRef(input.provider, eventId);
      return executeFirestoreTransaction(deps.adminDb, async (tx) => {
        const snap = await tx.get(docRef);
        const currentTimeMs = nowMs();
        const nowTimestamp = buildFirestoreTimestamp(currentTimeMs);
        const expiresTimestamp = buildFirestoreTimestamp(currentTimeMs + leaseDurationMs);
        if (!isDocSnapshotExisting(snap)) {
          const leaseToken = generateToken();
          const newRecord = {
            provider: "paddle",
            eventId,
            eventType,
            status: "processing",
            attemptCount: 1,
            createdAt: nowTimestamp,
            updatedAt: nowTimestamp,
            leaseExpiresAt: expiresTimestamp,
            leaseToken,
            completedAt: null,
            lastErrorCode: null
          };
          await Promise.resolve(
            tx.set(docRef, newRecord)
          );
          return {
            outcome: "acquired",
            documentId,
            leaseToken,
            attemptCount: 1,
            record: newRecord
          };
        }
        const existingData = snap.data() || {};
        const existingRecord = normalizeStoredRecord(existingData, "paddle", eventId);
        if (existingRecord.status === "completed") {
          return {
            outcome: "already_processed",
            documentId,
            record: existingRecord
          };
        }
        if (existingRecord.status === "processing") {
          const leaseExpiresMs = parseFirestoreTimeMs(existingRecord.leaseExpiresAt);
          const hasValidActiveLease = typeof existingRecord.leaseToken === "string" && existingRecord.leaseToken.trim().length > 0 && leaseExpiresMs !== null && leaseExpiresMs > currentTimeMs;
          if (hasValidActiveLease) {
            return {
              outcome: "in_progress",
              documentId,
              record: existingRecord
            };
          }
          const newLeaseToken = generateToken();
          const nextAttemptCount = existingRecord.attemptCount + 1;
          const takenOverRecord = {
            provider: "paddle",
            eventId,
            eventType,
            status: "processing",
            attemptCount: nextAttemptCount,
            createdAt: existingRecord.createdAt ?? nowTimestamp,
            updatedAt: nowTimestamp,
            leaseExpiresAt: expiresTimestamp,
            leaseToken: newLeaseToken,
            completedAt: null,
            lastErrorCode: existingRecord.lastErrorCode ?? null
          };
          await Promise.resolve(
            tx.set(docRef, takenOverRecord)
          );
          return {
            outcome: "acquired",
            documentId,
            leaseToken: newLeaseToken,
            attemptCount: nextAttemptCount,
            record: takenOverRecord
          };
        }
        const retryLeaseToken = generateToken();
        const retryAttemptCount = existingRecord.attemptCount + 1;
        const retriedRecord = {
          provider: "paddle",
          eventId,
          eventType,
          status: "processing",
          attemptCount: retryAttemptCount,
          createdAt: existingRecord.createdAt ?? nowTimestamp,
          updatedAt: nowTimestamp,
          leaseExpiresAt: expiresTimestamp,
          leaseToken: retryLeaseToken,
          completedAt: null,
          lastErrorCode: existingRecord.lastErrorCode ?? null
        };
        await Promise.resolve(
          tx.set(docRef, retriedRecord)
        );
        return {
          outcome: "acquired",
          documentId,
          leaseToken: retryLeaseToken,
          attemptCount: retryAttemptCount,
          record: retriedRecord
        };
      });
    },
    async completeEventLease(input) {
      const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
      const leaseToken = typeof input.leaseToken === "string" ? input.leaseToken.trim() : "";
      if (input.provider !== "paddle" || !eventId || !leaseToken) {
        throw new Error(
          "Valid provider, eventId, and leaseToken are required to complete a webhook idempotency lease."
        );
      }
      const { documentId, docRef } = getEventDocRef(input.provider, eventId);
      return executeFirestoreTransaction(deps.adminDb, async (tx) => {
        const snap = await tx.get(docRef);
        if (!isDocSnapshotExisting(snap)) {
          return {
            ok: false,
            code: "EVENT_NOT_FOUND",
            error: `Cannot finalize webhook event '${eventId}': idempotency document does not exist.`
          };
        }
        const existingData = snap.data() || {};
        const existingRecord = normalizeStoredRecord(existingData, "paddle", eventId);
        const currentTimeMs = nowMs();
        const leaseExpiresMs = parseFirestoreTimeMs(existingRecord.leaseExpiresAt);
        if (existingRecord.status !== "processing" || !existingRecord.leaseToken || existingRecord.leaseToken !== leaseToken || leaseExpiresMs === null || leaseExpiresMs <= currentTimeMs) {
          return {
            ok: false,
            code: "LEASE_CONFLICT",
            error: `Lease conflict for webhook event '${eventId}': leaseToken is no longer owned or has expired.`
          };
        }
        const nowTimestamp = buildFirestoreTimestamp(currentTimeMs);
        const completedRecord = {
          provider: existingRecord.provider,
          eventId: existingRecord.eventId,
          eventType: existingRecord.eventType,
          status: "completed",
          attemptCount: existingRecord.attemptCount,
          createdAt: existingRecord.createdAt ?? nowTimestamp,
          updatedAt: nowTimestamp,
          leaseExpiresAt: null,
          leaseToken: null,
          completedAt: nowTimestamp,
          lastErrorCode: null
        };
        await Promise.resolve(
          tx.set(docRef, completedRecord)
        );
        return {
          ok: true,
          documentId,
          record: completedRecord
        };
      });
    },
    async failEventLease(input) {
      const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
      const leaseToken = typeof input.leaseToken === "string" ? input.leaseToken.trim() : "";
      const safeErrorCode = sanitizeErrorCode(input.errorCode);
      if (input.provider !== "paddle" || !eventId || !leaseToken) {
        throw new Error(
          "Valid provider, eventId, and leaseToken are required to record a failed webhook lease."
        );
      }
      const { documentId, docRef } = getEventDocRef(input.provider, eventId);
      return executeFirestoreTransaction(deps.adminDb, async (tx) => {
        const snap = await tx.get(docRef);
        if (!isDocSnapshotExisting(snap)) {
          return {
            ok: false,
            code: "EVENT_NOT_FOUND",
            error: `Cannot mark webhook event '${eventId}' as failed: document not found.`
          };
        }
        const existingData = snap.data() || {};
        const existingRecord = normalizeStoredRecord(existingData, "paddle", eventId);
        if (existingRecord.status !== "processing" || !existingRecord.leaseToken || existingRecord.leaseToken !== leaseToken) {
          return {
            ok: false,
            code: "LEASE_CONFLICT",
            error: `Lease conflict for webhook event '${eventId}': cannot mark failed with stale leaseToken.`
          };
        }
        const currentTimeMs = nowMs();
        const nowTimestamp = buildFirestoreTimestamp(currentTimeMs);
        const failedRecord = {
          provider: existingRecord.provider,
          eventId: existingRecord.eventId,
          eventType: existingRecord.eventType,
          status: "failed",
          attemptCount: existingRecord.attemptCount,
          createdAt: existingRecord.createdAt ?? nowTimestamp,
          updatedAt: nowTimestamp,
          leaseExpiresAt: null,
          leaseToken: null,
          completedAt: null,
          lastErrorCode: safeErrorCode
        };
        await Promise.resolve(
          tx.set(docRef, failedRecord)
        );
        return {
          ok: true,
          documentId,
          record: failedRecord
        };
      });
    },
    async getEventRecord(provider, eventId) {
      const cleanEventId = typeof eventId === "string" ? eventId.trim() : "";
      if (provider !== "paddle" || !cleanEventId) return null;
      const { docRef } = getEventDocRef(provider, cleanEventId);
      if (typeof docRef.get !== "function") {
        return null;
      }
      const snap = await docRef.get();
      if (!isDocSnapshotExisting(snap)) {
        return null;
      }
      const raw = snap.data();
      if (!raw || typeof raw !== "object") {
        return null;
      }
      return normalizeStoredRecord(raw, provider, cleanEventId);
    }
  };
}

// src/security/webhooks/paddleEventPolicy.ts
var ALLOWED_PADDLE_ASSOCIATION_EVENTS = /* @__PURE__ */ new Set([
  "transaction.completed"
]);
function evaluatePaddleEventPolicy(rawEventType) {
  if (typeof rawEventType !== "string" || rawEventType.trim().length === 0) {
    return {
      allowed: false,
      statusCode: 400,
      code: "MISSING_EVENT_TYPE",
      error: "Missing Paddle event_type in webhook payload"
    };
  }
  const normalized = rawEventType.trim();
  if (!ALLOWED_PADDLE_ASSOCIATION_EVENTS.has(normalized)) {
    return {
      allowed: false,
      statusCode: 422,
      code: "UNSUPPORTED_OR_EARLY_EVENT_TYPE",
      error: `Paddle event_type '${normalized}' is not authorized to associate a pending order (only 'transaction.completed' is permitted)`
    };
  }
  return {
    allowed: true,
    eventType: "transaction.completed"
  };
}

// src/security/webhooks/paymentOrderAssociation.ts
function extractNonEmptyString2(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}
function extractPaddleWebhookIdentifiers(payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const dataObj = safePayload.data && typeof safePayload.data === "object" ? safePayload.data : {};
  const dataCustomData = dataObj.custom_data && typeof dataObj.custom_data === "object" ? dataObj.custom_data : {};
  const rootCustomData = safePayload.custom_data && typeof safePayload.custom_data === "object" ? safePayload.custom_data : {};
  const orderId = extractNonEmptyString2(dataCustomData.orderId) ?? extractNonEmptyString2(dataCustomData.order_id) ?? extractNonEmptyString2(rootCustomData.orderId) ?? extractNonEmptyString2(rootCustomData.order_id);
  const providerTransactionId = extractNonEmptyString2(safePayload.provider_transaction_id) ?? extractNonEmptyString2(safePayload.transaction_id) ?? extractNonEmptyString2(dataObj.id);
  const eventId = extractNonEmptyString2(safePayload.event_id) ?? extractNonEmptyString2(safePayload.notification_id) ?? extractNonEmptyString2(safePayload.alert_id);
  const eventType = extractNonEmptyString2(safePayload.event_type);
  const checkoutId = extractNonEmptyString2(safePayload.checkout_id) ?? extractNonEmptyString2(dataObj?.checkout?.id);
  const customDataUserUid = extractNonEmptyString2(dataCustomData.userUid) ?? extractNonEmptyString2(dataCustomData.userId) ?? extractNonEmptyString2(rootCustomData.userUid) ?? extractNonEmptyString2(rootCustomData.userId);
  const untrustedWebhookEmail = extractNonEmptyString2(safePayload.email) ?? extractNonEmptyString2(dataObj?.customer?.email) ?? extractNonEmptyString2(dataObj?.user?.email);
  const untrustedWebhookUid = extractNonEmptyString2(safePayload.uid) ?? extractNonEmptyString2(safePayload.user_id) ?? extractNonEmptyString2(dataObj?.user?.id) ?? extractNonEmptyString2(dataObj?.user?.uid) ?? extractNonEmptyString2(dataObj?.customer?.id);
  return {
    orderId,
    providerTransactionId,
    eventId,
    eventType,
    checkoutId,
    customDataUserUid,
    untrustedWebhookEmail,
    untrustedWebhookUid
  };
}
async function validateAndAssociatePaddleOrder(payload, deps) {
  const extracted = extractPaddleWebhookIdentifiers(payload);
  if (!extracted.orderId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_INTERNAL_ORDER_ID",
      error: "Missing internal orderId in Paddle webhook custom_data"
    };
  }
  if (!isValidInternalOrderIdFormat(extracted.orderId)) {
    return {
      ok: false,
      statusCode: 422,
      code: "INVALID_INTERNAL_ORDER_ID",
      error: `Invalid internal orderId format: '${extracted.orderId}'`
    };
  }
  if (!extracted.providerTransactionId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_PROVIDER_TRANSACTION_ID",
      error: "Missing external providerTransactionId in Paddle webhook payload"
    };
  }
  if (!extracted.eventId) {
    return {
      ok: false,
      statusCode: 400,
      code: "MISSING_EVENT_ID",
      error: "Missing Paddle event_id in webhook payload"
    };
  }
  if (extracted.eventId === extracted.providerTransactionId || extracted.providerTransactionId === extracted.orderId || extracted.eventId === extracted.orderId) {
    return {
      ok: false,
      statusCode: 422,
      code: "EVENT_ID_EQUALS_TRANSACTION_ID",
      error: "Ambiguous identifiers: internal orderId, providerTransactionId, and eventId must be strictly distinct"
    };
  }
  const eventPolicyResult = evaluatePaddleEventPolicy(extracted.eventType);
  if (!eventPolicyResult.allowed) {
    const deniedPolicy = eventPolicyResult;
    return {
      ok: false,
      statusCode: deniedPolicy.statusCode,
      code: deniedPolicy.code,
      error: deniedPolicy.error
    };
  }
  const order = await deps.repository.getOrderById(extracted.orderId);
  if (!order) {
    return {
      ok: false,
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
      error: `Pending order '${extracted.orderId}' not found in authoritative repository`
    };
  }
  const storedId = extractNonEmptyString2(order.id);
  const storedOrderId = extractNonEmptyString2(order.orderId) ?? storedId;
  if (!storedId || !storedOrderId || storedId !== storedOrderId || storedId !== extracted.orderId || !isValidInternalOrderIdFormat(storedId)) {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_INVALID_ID",
      error: "Stored order document has an invalid or inconsistent internal orderId"
    };
  }
  const rawUserId = extractNonEmptyString2(order.userId);
  const rawUserUid = extractNonEmptyString2(order.userUid);
  if (rawUserId && rawUserUid && rawUserId !== rawUserUid) {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_USER_MISMATCH",
      error: "Stored order document has conflicting userId and userUid fields"
    };
  }
  const authoritativeUserUid = rawUserUid ?? rawUserId;
  if (!authoritativeUserUid) {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_MISSING_UID",
      error: "Pending order is missing authoritative owner userUid"
    };
  }
  if (extracted.customDataUserUid && extracted.customDataUserUid !== authoritativeUserUid) {
    return {
      ok: false,
      statusCode: 403,
      code: "ORDER_USER_MISMATCH",
      error: "Order belongs to another userUid and cannot be reassigned"
    };
  }
  if (order.provider !== "paddle") {
    return {
      ok: false,
      statusCode: 422,
      code: "ORDER_PROVIDER_MISMATCH",
      error: `Order provider '${String(order.provider)}' does not allow Paddle webhook processing`
    };
  }
  const expectedOrExistingTxId = extractNonEmptyString2(order.providerTransactionId) ?? extractNonEmptyString2(order.paddleDetails?.paddleOrderId);
  if (expectedOrExistingTxId && expectedOrExistingTxId !== extracted.providerTransactionId) {
    return {
      ok: false,
      statusCode: 409,
      code: "PROVIDER_TRANSACTION_ID_MISMATCH",
      error: `Incoming providerTransactionId '${extracted.providerTransactionId}' does not match order transaction '${expectedOrExistingTxId}'`
    };
  }
  if (order.status !== "pending") {
    return {
      ok: false,
      statusCode: 409,
      code: "ORDER_INVALID_STATUS",
      error: `Order state (status='${String(order.status)}', associationStatus='${String(order.associationStatus || "unassociated")}') does not allow new payment association`
    };
  }
  const isAlreadyAssociatedForExactSameEvent = order.associationStatus === "associated" && expectedOrExistingTxId === extracted.providerTransactionId && extractNonEmptyString2(order.lastEventId) === extracted.eventId && order.provider === "paddle";
  if (order.associationStatus === "associated" && !isAlreadyAssociatedForExactSameEvent) {
    return {
      ok: false,
      statusCode: 409,
      code: "ORDER_INVALID_STATUS",
      error: `Order state (status='${String(order.status)}', associationStatus='${String(order.associationStatus || "unassociated")}') does not allow new payment association`
    };
  }
  const otherOrderWithSameTx = await deps.repository.findOrderByProviderTransactionId(
    "paddle",
    extracted.providerTransactionId
  );
  if (otherOrderWithSameTx) {
    const otherId = extractNonEmptyString2(otherOrderWithSameTx.orderId) ?? extractNonEmptyString2(otherOrderWithSameTx.id);
    if (otherId && otherId !== extracted.orderId) {
      return {
        ok: false,
        statusCode: 409,
        code: "TRANSACTION_ALREADY_ASSOCIATED_TO_ANOTHER_ORDER",
        error: `External transaction '${extracted.providerTransactionId}' is already associated with another order ('${otherId}')`
      };
    }
  }
  let verifiedUser = null;
  try {
    verifiedUser = await deps.adminAuth.getUser(authoritativeUserUid);
  } catch {
    verifiedUser = null;
  }
  if (!verifiedUser || typeof verifiedUser.uid !== "string" || verifiedUser.uid.trim() !== authoritativeUserUid || verifiedUser.disabled === true) {
    return {
      ok: false,
      statusCode: 422,
      code: "USER_IDENTITY_NOT_FOUND",
      error: `Authoritative order owner UID '${authoritativeUserUid}' could not be verified in Firebase Authentication`
    };
  }
  const fencedResult = await deps.repository.associateOrderWithLeaseFencing({
    provider: "paddle",
    eventId: extracted.eventId,
    leaseToken: deps.leaseToken,
    orderId: extracted.orderId,
    userUid: authoritativeUserUid,
    providerTransactionId: extracted.providerTransactionId,
    eventType: eventPolicyResult.eventType,
    customDataUserUid: extracted.customDataUserUid,
    checkoutId: extracted.checkoutId,
    webhookCustomerEmail: extracted.untrustedWebhookEmail,
    nowMs: deps.nowMs
  });
  if (fencedResult.ok === false) {
    return {
      ok: false,
      statusCode: fencedResult.statusCode,
      code: fencedResult.code,
      error: fencedResult.error
    };
  }
  return {
    ok: true,
    statusCode: 200,
    alreadyAssociatedForSameEvent: fencedResult.alreadyAssociatedForSameEvent,
    order: fencedResult.order,
    identifiers: {
      orderId: extracted.orderId,
      providerTransactionId: extracted.providerTransactionId,
      eventId: extracted.eventId,
      eventType: eventPolicyResult.eventType,
      userUid: authoritativeUserUid
    }
  };
}

// src/security/webhooks/paymentWebhookProcessor.ts
function createPaymentWebhookProcessor(deps) {
  const idempotencyRepository = deps.idempotencyRepository ?? createWebhookIdempotencyRepository({ adminDb: deps.adminDb });
  const repository = deps.pendingOrderRepository ?? createPendingOrderRepository({ adminDb: deps.adminDb });
  return {
    async processVerifiedPaddleEvent(payload) {
      const extracted = extractPaddleWebhookIdentifiers(payload);
      if (!extracted.orderId) {
        return {
          statusCode: 400,
          body: {
            error: "Missing internal orderId in Paddle webhook custom_data",
            code: "MISSING_INTERNAL_ORDER_ID"
          }
        };
      }
      if (!isValidInternalOrderIdFormat(extracted.orderId)) {
        return {
          statusCode: 422,
          body: {
            error: `Invalid internal orderId format: '${extracted.orderId}'`,
            code: "INVALID_INTERNAL_ORDER_ID"
          }
        };
      }
      if (!extracted.providerTransactionId) {
        return {
          statusCode: 400,
          body: {
            error: "Missing external providerTransactionId in Paddle webhook payload",
            code: "MISSING_PROVIDER_TRANSACTION_ID"
          }
        };
      }
      if (!extracted.eventId) {
        return {
          statusCode: 400,
          body: {
            error: "Missing Paddle event_id in webhook payload",
            code: "MISSING_EVENT_ID"
          }
        };
      }
      if (extracted.eventId === extracted.providerTransactionId || extracted.providerTransactionId === extracted.orderId || extracted.eventId === extracted.orderId) {
        return {
          statusCode: 422,
          body: {
            error: "Ambiguous identifiers: internal orderId, providerTransactionId, and eventId must be strictly distinct",
            code: "EVENT_ID_EQUALS_TRANSACTION_ID"
          }
        };
      }
      const policyCheck = evaluatePaddleEventPolicy(extracted.eventType);
      if (!policyCheck.allowed) {
        const deniedPolicy = policyCheck;
        return {
          statusCode: deniedPolicy.statusCode,
          body: {
            error: deniedPolicy.error,
            code: deniedPolicy.code
          }
        };
      }
      let leaseAcquisition;
      try {
        leaseAcquisition = await idempotencyRepository.acquireEventLease({
          provider: "paddle",
          eventId: extracted.eventId,
          eventType: policyCheck.eventType
        });
      } catch (idempErr) {
        console.error(
          "[Webhook Paddle Durable Idempotency Error]:",
          idempErr?.message || idempErr
        );
        return {
          statusCode: 500,
          body: {
            error: "Failed to acquire durable webhook idempotency lease",
            code: "INTERNAL_PERSISTENCE_ERROR"
          }
        };
      }
      if (leaseAcquisition.outcome === "already_processed") {
        return {
          statusCode: 200,
          body: {
            received: true,
            status: "already_processed"
          }
        };
      }
      if (leaseAcquisition.outcome === "in_progress") {
        return {
          statusCode: 409,
          body: {
            error: "Webhook event currently in progress",
            code: "WEBHOOK_IN_PROGRESS"
          }
        };
      }
      const activeLeaseToken = leaseAcquisition.leaseToken;
      try {
        const associationResult = await validateAndAssociatePaddleOrder(payload, {
          repository,
          adminAuth: deps.adminAuth,
          leaseToken: activeLeaseToken,
          nowMs: typeof idempotencyRepository.getNowMs === "function" ? () => idempotencyRepository.getNowMs() : void 0
        });
        if (!associationResult.ok) {
          const failedResult = associationResult;
          if (failedResult.code === "LEASE_CONFLICT") {
            return {
              statusCode: 409,
              body: {
                error: failedResult.error,
                code: "LEASE_CONFLICT"
              }
            };
          }
          try {
            await idempotencyRepository.failEventLease({
              provider: "paddle",
              eventId: extracted.eventId,
              leaseToken: activeLeaseToken,
              errorCode: failedResult.code
            });
          } catch (failLeaseErr) {
            console.error(
              "[Webhook Paddle Idempotency Fail-Lease Error]:",
              failLeaseErr?.message || failLeaseErr
            );
            return {
              statusCode: 500,
              body: {
                error: "Failed to persist webhook failure state",
                code: "INTERNAL_PERSISTENCE_ERROR"
              }
            };
          }
          return {
            statusCode: failedResult.statusCode,
            body: {
              error: failedResult.error,
              code: failedResult.code
            }
          };
        }
        const successResult = associationResult;
        const completionResult = await idempotencyRepository.completeEventLease({
          provider: "paddle",
          eventId: extracted.eventId,
          leaseToken: activeLeaseToken
        });
        if (!completionResult.ok) {
          const conflictResult = completionResult;
          return {
            statusCode: 409,
            body: {
              error: conflictResult.error,
              code: "LEASE_CONFLICT"
            }
          };
        }
        return {
          statusCode: 200,
          body: {
            received: true,
            associated: true,
            orderId: successResult.identifiers.orderId,
            providerTransactionId: successResult.identifiers.providerTransactionId,
            eventId: successResult.identifiers.eventId,
            userUid: successResult.identifiers.userUid,
            status: "pending",
            associationStatus: "associated"
          }
        };
      } catch (innerErr) {
        try {
          await idempotencyRepository.failEventLease({
            provider: "paddle",
            eventId: extracted.eventId,
            leaseToken: activeLeaseToken,
            errorCode: "INTERNAL_PERSISTENCE_ERROR"
          });
        } catch {
        }
        console.error(
          "[Webhook Paddle Association Error]:",
          innerErr?.message || innerErr
        );
        return {
          statusCode: 500,
          body: {
            error: "Failed to read or persist pending order association",
            code: "INTERNAL_PERSISTENCE_ERROR"
          }
        };
      }
    }
  };
}

// src/security/webhookAuth.ts
function extractSingleHeader(headers, ...candidateNames) {
  if (!headers || typeof headers !== "object") {
    return void 0;
  }
  for (const name of candidateNames) {
    const val = headers[name] ?? headers[name.toLowerCase()];
    if (typeof val === "string" && val.trim().length > 0) {
      return val;
    }
    if (Array.isArray(val) && typeof val[0] === "string" && val[0].trim().length > 0) {
      return val[0];
    }
  }
  return void 0;
}
function authenticatePaddleWebhookRequest(input) {
  if (typeof input.rawBody !== "string" || input.rawBody.length === 0) {
    return {
      authenticated: false,
      statusCode: 401,
      error: "Missing raw request body (req.rawBody) for Paddle webhook authentication"
    };
  }
  const signatureHeader = extractSingleHeader(
    input.headers,
    "paddle-signature",
    "Paddle-Signature"
  );
  const verification = verifyPaddleWebhookSignature(
    input.rawBody,
    signatureHeader,
    input.secretKey
  );
  if (!verification.isValid) {
    return {
      authenticated: false,
      statusCode: 401,
      error: verification.error || "Invalid Paddle webhook signature"
    };
  }
  return {
    authenticated: true,
    statusCode: 200,
    rawBody: input.rawBody
  };
}
function authenticateSlickPayWebhookRequest(input) {
  const verification = verifySlickPayWebhook(
    input.payload,
    input.headers,
    input.secretKey
  );
  return {
    authenticated: false,
    canAutoActivate: false,
    statusCode: 401,
    error: verification.reason,
    verification: {
      isAuthentic: false,
      canAutoActivate: false,
      reason: verification.reason
    }
  };
}

// src/security/webhooks/paddleWebhookHandler.ts
function createPaddleWebhookHandler(deps) {
  const resolveSecret = deps.getPaddleSecret ?? (() => process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET);
  return async (req, res) => {
    try {
      const authResult = authenticatePaddleWebhookRequest({
        rawBody: req.rawBody,
        headers: req.headers,
        secretKey: resolveSecret()
      });
      if (!authResult.authenticated) {
        console.warn(`[Webhook Paddle Rejected] Unauthorized webhook attempt: ${authResult.error}`);
        return res.status(authResult.statusCode).json({
          received: false,
          error: authResult.error || "Invalid Paddle signature"
        });
      }
      const payload = req.body && typeof req.body === "object" && Object.keys(req.body).length > 0 ? req.body : JSON.parse(authResult.rawBody);
      const result = await deps.processor.processVerifiedPaddleEvent(payload);
      return res.status(result.statusCode).json(result.body);
    } catch (err) {
      console.error("[Webhook Paddle Error]:", err?.message || err);
      return res.status(500).json({
        error: "Internal webhook processing error",
        code: "WEBHOOK_INTERNAL_ERROR"
      });
    }
  };
}

// src/security/webhooks/slickPayWebhookHandler.ts
function createSlickPayWebhookHandler(deps = {}) {
  const resolveSecret = deps.getSlickPaySecret ?? (() => process.env.SLICKPAY_WEBHOOK_SECRET);
  return async (req, res) => {
    try {
      const authResult = authenticateSlickPayWebhookRequest({
        payload: req.body,
        headers: req.headers,
        secretKey: resolveSecret()
      });
      console.warn(`[Webhook Slick-Pay Rejected] Fail-closed: ${authResult.error}`);
      return res.status(authResult.statusCode).json({
        received: false,
        status: "rejected_unverified",
        isAuthentic: false,
        canAutoActivate: false,
        error: authResult.error
      });
    } catch (err) {
      console.error("[Webhook Slick-Pay Error]:", err?.message || err);
      return res.status(500).json({
        error: "Internal webhook processing error",
        code: "WEBHOOK_INTERNAL_ERROR"
      });
    }
  };
}

// src/pdi/payment/pdiPaymentGateway.ts
var PDI_PRICING_DZD = {
  basic: {
    plan: "basic",
    name: "PD&I Basic",
    tagline: "Pour ing\xE9nieurs ind\xE9pendants et techniciens d\xE9butants",
    monthlyPrice: 2500,
    yearlyPrice: 24e3,
    currency: "DZD",
    currencySymbol: "DZD",
    features: [
      "1 projet actif simultan\xE9",
      "\xC9diteur isom\xE9trique 2D / 3D standard",
      "Export PDF haute pr\xE9cision A4/A3",
      "Support standard par email",
      "Sauvegarde locale automatique"
    ]
  },
  pro: {
    plan: "pro",
    name: "PD&I Pro",
    tagline: "La solution compl\xE8te pour concepteurs tuyauterie & piping",
    monthlyPrice: 4900,
    yearlyPrice: 49e3,
    currency: "DZD",
    currencySymbol: "DZD",
    popular: true,
    features: [
      "Projets & plans illimit\xE9s",
      "G\xE9n\xE9ration automatique d'isom\xE9tries",
      "Module Vision & Reconnaissance photo/croquis",
      "Imports DXF / CAO / PDF avanc\xE9s",
      "Nomenclature compl\xE8te & MTO exportable Excel",
      "Support prioritaire sous 12h"
    ]
  },
  team: {
    plan: "team",
    name: "PD&I Team",
    tagline: "Pour bureaux d'\xE9tudes et \xE9quipes industrielles (5 licences)",
    monthlyPrice: 12500,
    yearlyPrice: 12e4,
    currency: "DZD",
    currencySymbol: "DZD",
    features: [
      "Jusqu'\xE0 5 concepteurs inclus",
      "Partage d'onglets et de projets en \xE9quipe",
      "Validation centralis\xE9e & r\xE9vision des plans",
      "Export DXF multi-calques et cartouche personnalis\xE9",
      "Formation en ligne & support d\xE9di\xE9 WhatsApp"
    ]
  },
  enterprise: {
    plan: "enterprise",
    name: "PD&I Enterprise",
    tagline: "Grands comptes industriels, p\xE9trochimie & gaz",
    monthlyPrice: 35e3,
    yearlyPrice: 35e4,
    currency: "DZD",
    currencySymbol: "DZD",
    features: [
      "Licences illimit\xE9es sur site ou cloud priv\xE9",
      "Int\xE9gration Sonatrach / normes ASME B31.3",
      "API & Passerelle d'interconnexion interne",
      "Support technique VIP 24/7 & ing\xE9nieur r\xE9f\xE9rent",
      "Contrat de maintenance et formation sur site"
    ]
  }
};
var PDI_PRICING_INTERNATIONAL = {
  basic: {
    plan: "basic",
    name: "PD&I Basic",
    tagline: "Single seat for piping drafters & freelance engineers",
    monthlyPrice: 25,
    yearlyPrice: 240,
    currency: "EUR",
    currencySymbol: "\u20AC",
    features: [
      "1 active isometric project",
      "Full 2D/3D piping editor",
      "High-res PDF vector export (A4-A1)",
      "Standard email technical support",
      "Automatic offline persistence"
    ]
  },
  pro: {
    plan: "pro",
    name: "PD&I Pro",
    tagline: "Complete pipeline design suite with Vision & CAD engine",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "EUR",
    currencySymbol: "\u20AC",
    popular: true,
    features: [
      "Unlimited projects & runs",
      "PD&I Vision photo & sketch to ISO",
      "DXF / CAD / PDF multi-layer importer",
      "Automated MTO & material takeoff export",
      "Priority 24/7 technical support"
    ]
  },
  team: {
    plan: "team",
    name: "PD&I Team",
    tagline: "Engineering consulting offices & EPC contractor teams (5 seats)",
    monthlyPrice: 125,
    yearlyPrice: 1200,
    currency: "EUR",
    currencySymbol: "\u20AC",
    features: [
      "5 user seats included",
      "Multi-user isometric collaboration",
      "Custom company borders & title blocks",
      "Shared piping catalogs & specifications",
      "Dedicated onboarding session"
    ]
  },
  enterprise: {
    plan: "enterprise",
    name: "PD&I Enterprise",
    tagline: "Global EPC contractors, Oil & Gas operators",
    monthlyPrice: 350,
    yearlyPrice: 3500,
    currency: "EUR",
    currencySymbol: "\u20AC",
    features: [
      "Custom seats deployment",
      "ASME / DIN / ISO standards compliance engine",
      "API access & enterprise ERP integration",
      "SLA 99.9% guarantee & dedicated account manager",
      "Custom piping components library development"
    ]
  }
};
function getPaymentConfigForCountry(countryCode) {
  const code = (countryCode || "DZ").toUpperCase().trim();
  if (code === "DZ" || code === "ALGERIA" || code === "ALG\xC9RIE") {
    return {
      provider: "slickpay_baridimob",
      currency: "DZD",
      currencySymbol: "DZD",
      pricingTable: PDI_PRICING_DZD
    };
  }
  return {
    provider: "paddle",
    currency: "EUR",
    currencySymbol: "\u20AC",
    pricingTable: PDI_PRICING_INTERNATIONAL
  };
}

// src/security/payments/pendingOrderRoute.ts
var VALID_PLANS = /* @__PURE__ */ new Set([
  "basic",
  "pro",
  "team",
  "enterprise"
]);
var VALID_BILLING_CYCLES = /* @__PURE__ */ new Set([
  "monthly",
  "yearly"
]);
var VALID_PROVIDERS = /* @__PURE__ */ new Set([
  "paddle",
  "slickpay_baridimob"
]);
function createPendingOrderRoute(deps) {
  const verifyToken = deps.verifyIdToken ?? ((token) => getServerAdminAuth().verifyIdToken(token));
  const resolveConfig = deps.resolvePaymentConfig ?? getPaymentConfigForCountry;
  const requireOrderAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized: Missing or invalid authorization header",
        code: "auth/missing-token"
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized: Empty bearer token",
        code: "auth/empty-token"
      });
    }
    try {
      const decoded = await verifyToken(token);
      if (!decoded || typeof decoded.uid !== "string" || decoded.uid.trim().length === 0) {
        return res.status(401).json({
          error: "Unauthorized: Token is missing a valid user uid",
          code: "auth/missing-uid"
        });
      }
      req.user = {
        ...decoded,
        uid: decoded.uid.trim()
      };
      return next();
    } catch (err) {
      return res.status(401).json({
        error: "Unauthorized: Invalid authentication token",
        code: err?.code === "auth/id-token-expired" ? "auth/id-token-expired" : "auth/invalid-token"
      });
    }
  };
  const requireOrderEmailVerified = (req, res, next) => {
    const user = req.user;
    if (!user || typeof user.uid !== "string" || user.uid.trim().length === 0) {
      return res.status(401).json({
        error: "Unauthorized: User authentication required",
        code: "auth/unauthorized"
      });
    }
    if (user.email_verified !== true) {
      return res.status(403).json({
        error: "Forbidden: Email verification required for order creation",
        code: "auth/unverified-email"
      });
    }
    if (typeof user.email !== "string" || user.email.trim().length === 0) {
      return res.status(403).json({
        error: "Forbidden: Verified user email claim is required",
        code: "auth/missing-email"
      });
    }
    return next();
  };
  const handleCreatePendingOrder = async (req, res) => {
    try {
      const verifiedUid = typeof req.user?.uid === "string" ? req.user.uid.trim() : "";
      const verifiedEmail = typeof req.user?.email === "string" ? req.user.email.trim().toLowerCase() : "";
      if (!verifiedUid || !verifiedEmail || req.user?.email_verified !== true) {
        return res.status(401).json({
          error: "Authenticated and verified user identity required.",
          code: "auth/unauthorized"
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const rawPlan = body.plan;
      if (typeof rawPlan !== "string" || !VALID_PLANS.has(rawPlan)) {
        return res.status(400).json({
          error: "Invalid or missing subscription plan.",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const plan = rawPlan;
      if (body.accountType !== void 0 && body.accountType !== plan) {
        return res.status(400).json({
          error: "Inconsistent accountType and plan parameters.",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const rawCycle = body.billingCycle ?? "yearly";
      if (typeof rawCycle !== "string" || !VALID_BILLING_CYCLES.has(rawCycle)) {
        return res.status(400).json({
          error: "Invalid billingCycle parameter (must be 'monthly' or 'yearly').",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const billingCycle = rawCycle;
      const rawCountryCode = body.countryCode ?? "FR";
      if (typeof rawCountryCode !== "string" || !/^[A-Za-z]{2}$/.test(rawCountryCode.trim())) {
        return res.status(400).json({
          error: "Invalid countryCode parameter (must be a 2-letter ISO code).",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const countryCode = rawCountryCode.trim().toUpperCase();
      const paymentConfig = resolveConfig(countryCode);
      const pricing = paymentConfig.pricingTable[plan];
      if (!pricing) {
        return res.status(400).json({
          error: "Pricing configuration unavailable for requested plan.",
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      if (body.provider !== void 0) {
        if (typeof body.provider !== "string" || !VALID_PROVIDERS.has(body.provider) || body.provider !== paymentConfig.provider) {
          return res.status(422).json({
            error: `Unauthorized or inconsistent payment provider '${String(body.provider)}' for country '${countryCode}'.`,
            code: "INVALID_PAYMENT_PROVIDER"
          });
        }
      }
      const authoritativeAmount = billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;
      if (body.currency !== void 0 && body.currency !== paymentConfig.currency) {
        return res.status(422).json({
          error: `Inconsistent currency '${String(body.currency)}' (expected '${paymentConfig.currency}').`,
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      if (body.amount !== void 0 && Number(body.amount) !== authoritativeAmount) {
        return res.status(422).json({
          error: `Inconsistent amount '${String(body.amount)}' (expected '${authoritativeAmount}').`,
          code: "INVALID_ORDER_PARAMETERS"
        });
      }
      const order = await deps.pendingOrderRepository.createPendingOrder({
        verifiedUserUid: verifiedUid,
        verifiedUserEmail: verifiedEmail,
        userName: typeof body.userName === "string" && body.userName.trim().length > 0 ? body.userName.trim() : typeof req.user?.name === "string" ? req.user.name : void 0,
        company: typeof body.company === "string" ? body.company.trim() : "",
        country: typeof body.country === "string" ? body.country.trim() : void 0,
        countryCode,
        city: typeof body.city === "string" ? body.city.trim() : "",
        plan,
        billingCycle,
        amount: authoritativeAmount,
        currency: paymentConfig.currency,
        provider: paymentConfig.provider
      });
      return res.status(201).json({ order });
    } catch (err) {
      console.error("[Orders API Error]:", err?.message || err);
      return res.status(500).json({
        error: "Failed to create authoritative pending order.",
        code: "ORDER_PERSISTENCE_ERROR"
      });
    }
  };
  return [requireOrderAuth, requireOrderEmailVerified, handleCreatePendingOrder];
}

// src/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  driveFiles: () => driveFiles,
  driveFilesRelations: () => driveFilesRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull().unique(),
  // Firebase Auth UID
  email: (0, import_pg_core.text)("email").notNull(),
  displayName: (0, import_pg_core.text)("display_name"),
  photoUrl: (0, import_pg_core.text)("photo_url"),
  role: (0, import_pg_core.text)("role").default("demo").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var projects = (0, import_pg_core.pgTable)("projects", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull(),
  // User's Firebase UID
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description"),
  module: (0, import_pg_core.text)("module").notNull().default("isometric"),
  status: (0, import_pg_core.text)("status").notNull().default("draft"),
  // draft, in_progress, archived, published
  driveFileId: (0, import_pg_core.text)("drive_file_id"),
  // Google Drive file ID if synced
  driveFolderId: (0, import_pg_core.text)("drive_folder_id"),
  // Google Drive folder ID
  driveWebViewLink: (0, import_pg_core.text)("drive_web_view_link"),
  data: (0, import_pg_core.jsonb)("data"),
  // Complete serialized project CAD/ISO state
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var driveFiles = (0, import_pg_core.pgTable)("drive_files", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull(),
  driveFileId: (0, import_pg_core.text)("drive_file_id").notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  mimeType: (0, import_pg_core.text)("mime_type").notNull(),
  size: (0, import_pg_core.text)("size"),
  webViewLink: (0, import_pg_core.text)("web_view_link"),
  iconLink: (0, import_pg_core.text)("icon_link"),
  thumbnailLink: (0, import_pg_core.text)("thumbnail_link"),
  isPdiProject: (0, import_pg_core.boolean)("is_pdi_project").default(false),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  lastSyncedAt: (0, import_pg_core.timestamp)("last_synced_at").defaultNow()
});
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  projects: many(projects),
  driveFiles: many(driveFiles)
}));
var projectsRelations = (0, import_drizzle_orm.relations)(projects, ({ one }) => ({
  author: one(users, {
    fields: [projects.uid],
    references: [users.uid]
  })
}));
var driveFilesRelations = (0, import_drizzle_orm.relations)(driveFiles, ({ one }) => ({
  user: one(users, {
    fields: [driveFiles.uid],
    references: [users.uid]
  })
}));

// src/db/index.ts
var SANDBOX_POSTGRES_FORBIDDEN_ERROR = "Coupe-circuit Sandbox / Fail-Closed PostgreSQL (STAGING-00-B4-A) : PostgreSQL / Cloud SQL est strictement d\xE9sactiv\xE9 en mode Sandbox ou lorsque PDI_ENV / VITE_PDI_ENV est absent, incoh\xE9rent ou invalide.";
function evaluateServerPostgresInitGate(env) {
  if (isStagingSandboxMode(env)) {
    return {
      blocked: true,
      sandboxDisabled: true,
      blockReason: "SANDBOX_MODE"
    };
  }
  const resolution = resolvePdiEnvironmentMode(env, {
    requireServerClientCoherence: true
  });
  if (!resolution.isValid) {
    const reason = resolution.errorCode ?? "AMBIGUOUS_PDI_ENV";
    return {
      blocked: true,
      sandboxDisabled: reason === "SANDBOX_FORBIDDEN_IN_PRODUCTION",
      blockReason: reason
    };
  }
  if (resolution.isSandbox) {
    return {
      blocked: true,
      sandboxDisabled: true,
      blockReason: "SANDBOX_MODE"
    };
  }
  const hasExplicitServerEnv = typeof resolution.serverPdiEnv === "string" && resolution.serverPdiEnv.trim().length > 0;
  const hasExplicitClientEnv = typeof resolution.clientVitePdiEnv === "string" && resolution.clientVitePdiEnv.trim().length > 0;
  if (!hasExplicitServerEnv || !hasExplicitClientEnv) {
    return {
      blocked: true,
      sandboxDisabled: false,
      blockReason: "INCOMPLETE_PDI_ENV"
    };
  }
  return {
    blocked: false,
    sandboxDisabled: false,
    blockReason: null
  };
}
var createPool = (env, poolFactory) => {
  const gate = evaluateServerPostgresInitGate(env);
  if (gate.blocked) {
    throw new Error(
      `${SANDBOX_POSTGRES_FORBIDDEN_ERROR} [Raison : ${gate.blockReason ?? "BLOCKED"}]`
    );
  }
  if (!global._postgresPool) {
    const sourceEnv = env ?? process.env;
    const poolConfig = {
      host: sourceEnv.SQL_HOST,
      user: sourceEnv.SQL_USER,
      password: sourceEnv.SQL_PASSWORD,
      database: sourceEnv.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15e3
    };
    const instance = poolFactory ? poolFactory(poolConfig) : new import_pg.Pool(poolConfig);
    if (typeof instance.on === "function") {
      instance.on("error", (err) => {
        console.error("Unexpected error on idle SQL pool client:", err);
      });
    }
    global._postgresPool = instance;
  }
  return global._postgresPool;
};
var getDb = (env, poolFactory) => {
  const gate = evaluateServerPostgresInitGate(env);
  if (gate.blocked) {
    throw new Error(
      `${SANDBOX_POSTGRES_FORBIDDEN_ERROR} [Raison : ${gate.blockReason ?? "BLOCKED"}]`
    );
  }
  if (!global._drizzleDb) {
    const pool = createPool(env, poolFactory);
    global._drizzleDb = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });
  }
  return global._drizzleDb;
};
var NODE_UTIL_INSPECT_CUSTOM = Symbol.for("nodejs.util.inspect.custom");
var db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then") return void 0;
      if (prop === Symbol.toStringTag) return "LazyPostgresDrizzleDb";
      if (prop === NODE_UTIL_INSPECT_CUSTOM) {
        return () => global._drizzleDb ? "[LazyPostgresDrizzleDb (initialized)]" : "[LazyPostgresDrizzleDb (uninitialized)]";
      }
      const activeDb = getDb();
      const value = Reflect.get(activeDb, prop, activeDb);
      return typeof value === "function" ? value.bind(activeDb) : value;
    },
    has(_target, prop) {
      const activeDb = getDb();
      return Reflect.has(activeDb, prop);
    },
    set(_target, prop, value) {
      const activeDb = getDb();
      return Reflect.set(activeDb, prop, value, activeDb);
    }
  }
);

// src/db/projects.ts
var import_drizzle_orm2 = require("drizzle-orm");
async function getUserProjects(uid) {
  const db2 = getDb();
  try {
    return await db2.select().from(projects).where((0, import_drizzle_orm2.eq)(projects.uid, uid)).orderBy((0, import_drizzle_orm2.desc)(projects.updatedAt));
  } catch (error) {
    console.error("Database query failed in getUserProjects:", error);
    throw new Error("Failed to retrieve user projects.", { cause: error });
  }
}
async function createOrUpdateProject(uid, projectData) {
  const db2 = getDb();
  try {
    if (projectData.id) {
      const updated = await db2.update(projects).set({
        name: projectData.name,
        description: projectData.description || null,
        module: projectData.module || "isometric",
        status: projectData.status || "draft",
        driveFileId: projectData.driveFileId || null,
        driveFolderId: projectData.driveFolderId || null,
        driveWebViewLink: projectData.driveWebViewLink || null,
        data: projectData.data || null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm2.and)((0, import_drizzle_orm2.eq)(projects.id, projectData.id), (0, import_drizzle_orm2.eq)(projects.uid, uid))).returning();
      return updated[0];
    } else {
      const inserted = await db2.insert(projects).values({
        uid,
        name: projectData.name,
        description: projectData.description || null,
        module: projectData.module || "isometric",
        status: projectData.status || "draft",
        driveFileId: projectData.driveFileId || null,
        driveFolderId: projectData.driveFolderId || null,
        driveWebViewLink: projectData.driveWebViewLink || null,
        data: projectData.data || null
      }).returning();
      return inserted[0];
    }
  } catch (error) {
    console.error("Database query failed in createOrUpdateProject:", error);
    throw new Error("Failed to save project to database.", { cause: error });
  }
}
async function deleteUserProject(uid, projectId) {
  const db2 = getDb();
  try {
    return await db2.delete(projects).where((0, import_drizzle_orm2.and)((0, import_drizzle_orm2.eq)(projects.id, projectId), (0, import_drizzle_orm2.eq)(projects.uid, uid))).returning();
  } catch (error) {
    console.error("Database query failed in deleteUserProject:", error);
    throw new Error("Failed to delete project from database.", { cause: error });
  }
}

// src/db/users.ts
var import_drizzle_orm3 = require("drizzle-orm");
async function getOrCreateUser(uid, email, displayName, photoUrl) {
  const db2 = getDb();
  try {
    const result = await db2.insert(users).values({
      uid,
      email,
      displayName: displayName || null,
      photoUrl: photoUrl || null
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Database operation failed. Please try again later.", { cause: error });
  }
}

// server.ts
function createApiNotFoundHandler() {
  return (_req, res) => {
    res.status(404).json({
      error: "Not Found: Unknown API endpoint",
      code: "api/not-found"
    });
  };
}
function createPdiExpressApp(options = {}) {
  const runtimeEnv = options.env ?? process.env;
  const deps = options.dependencies ?? {};
  const deliveryMode = resolveServerDeliveryMode(runtimeEnv);
  const configValidation = verifyProductionConfig(runtimeEnv);
  if (!configValidation.isSafe) {
    if (deliveryMode.strictSecurityMode || configValidation.hasFatalSandboxConfigError || !deliveryMode.isValid) {
      throw new Error(configValidation.errorMessage || "Fatal server configuration error");
    } else {
      console.warn("[SECURITY WARN] Development configuration note:", configValidation.errorMessage);
    }
  }
  const app = (0, import_express2.default)();
  app.disable("x-powered-by");
  const allowViteDevDeps = !deliveryMode.serveStaticDist && !deliveryMode.strictSecurityMode && runtimeEnv.VERCEL !== "1" && runtimeEnv.VERCEL !== "true";
  app.use((req, res, next) => {
    if (isSuspiciousRequestPath(req.originalUrl || req.url, { allowViteDevDeps })) {
      return res.status(403).type("text/plain").send("Forbidden: Invalid request path or file probe");
    }
    next();
  });
  const trustProxyResolution = resolveTrustProxyConfig(runtimeEnv.TRUST_PROXY, {
    strictSecurityMode: deliveryMode.strictSecurityMode
  });
  app.set("trust proxy", trustProxyResolution.value);
  const allowedOriginsValidation = validateAllowedOrigins(runtimeEnv.ALLOWED_ORIGINS, {
    isProduction: deliveryMode.strictSecurityMode,
    appUrl: runtimeEnv.APP_URL
  });
  const ALLOWED_ORIGINS = allowedOriginsValidation.origins;
  const apiRateLimiter = createBoundedRateLimiter({
    windowMs: 6e4,
    // 1 minute
    maxRequests: 100,
    // Max 100 requêtes/min par IP
    maxEntries: 5e3
    // Borne supérieure stricte
  });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Paddle-Signature,X-SlickPay-Signature,X-Signature");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    const cspPolicy = buildContentSecurityPolicy(runtimeEnv);
    res.setHeader("Content-Security-Policy", cspPolicy.headerValue);
    res.setHeader("X-Engine-Vendor", "ORTHOGONAL - ENG");
    res.setHeader("X-Engine-Product", "Piping Design & Isometrics");
    next();
  });
  app.use("/api", apiRateLimiter.middleware());
  app.use(createStandardJsonParser());
  app.use(createStandardUrlencodedParser());
  const handleHealthCheck = (_req, res) => {
    res.json({
      status: "ok",
      service: "pdi-industrial-cad",
      vendor: "ORTHOGONAL - ENG",
      engineVersion: "4.8d",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  app.get("/api/health", handleHealthCheck);
  app.get("/healthz", handleHealthCheck);
  const sandboxGuard = createRejectInStagingSandboxMode(runtimeEnv);
  const resolveAdminAuth = deps.getAdminAuth ?? getServerAdminAuth;
  const resolveAdminDb = deps.getAdminDb ?? getServerAdminDb;
  let cachedSupabaseGateway = null;
  const getSupabaseGateway = () => {
    if (!cachedSupabaseGateway) {
      cachedSupabaseGateway = resolveSupabaseServerAuthGateway(
        runtimeEnv,
        deps.supabaseAuthGateway
      );
    }
    return cachedSupabaseGateway;
  };
  const supabaseAuthMiddleware = createRequireSupabaseAuth(runtimeEnv, {
    gateway: deps.supabaseAuthGateway
  });
  const verifySupabaseTokenForRoutes = async (token) => {
    const resolved = getSupabaseGateway();
    if (!resolved) {
      return null;
    }
    return verifySupabaseSessionFromBearerToken(token, {
      gateway: resolved.gateway,
      expectedSupabaseUrl: resolved.expectedSupabaseUrl
    });
  };
  const strictSupabaseApiAuthMiddleware = deps.requireAuthMiddleware ?? createRequireAuth(runtimeEnv, {
    allowFirebaseFallback: false,
    expectedSupabaseUrl: runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL,
    verifySupabaseToken: verifySupabaseTokenForRoutes
  });
  const authMiddleware = deps.requireAuthMiddleware ?? createRequireAuth(runtimeEnv, {
    allowFirebaseFallback: true,
    getAdminAuth: resolveAdminAuth,
    expectedSupabaseUrl: runtimeEnv.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL,
    verifySupabaseToken: verifySupabaseTokenForRoutes
  });
  const fetchProjects = deps.getUserProjects ?? getUserProjects;
  const upsertProject = deps.createOrUpdateProject ?? createOrUpdateProject;
  const removeProject = deps.deleteUserProject ?? deleteUserProject;
  const syncUser = deps.getOrCreateUser ?? getOrCreateUser;
  app.get(
    "/api/auth/supabase/session",
    sandboxGuard,
    supabaseAuthMiddleware,
    (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        ok: true,
        session: req.supabaseSession
      });
    }
  );
  app.get(
    "/api/admin/supabase/overview",
    sandboxGuard,
    supabaseAuthMiddleware,
    requireSupabaseSuperAdmin,
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        const session = req.supabaseSession;
        const resolved = getSupabaseGateway();
        if (!session || !resolved || !resolved.gateway.getSuperAdminOverview) {
          return res.status(503).json({
            error: "Service Unavailable: Supabase Super Admin overview gateway is not configured.",
            code: "server/supabase-auth-unconfigured"
          });
        }
        const overview = await resolved.gateway.getSuperAdminOverview(session);
        return res.json({
          ok: true,
          overview
        });
      } catch (err) {
        console.error("Error loading Supabase Super Admin overview:", err?.message || "unknown");
        return res.status(500).json({
          error: "Internal server error while loading Supabase Super Admin overview.",
          code: "server/supabase-admin-overview-failed"
        });
      }
    }
  );
  app.post("/api/auth/sync-user", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || "unknown@domain.com";
      if (!uid) return res.status(401).json({ error: "Missing user uid" });
      const user = await syncUser(
        uid,
        email,
        req.body?.displayName || req.user?.name,
        req.body?.photoUrl || req.user?.picture
      );
      res.json({ user });
    } catch (err) {
      console.error("Error syncing user to Cloud SQL:", err);
      res.status(500).json({ error: "Failed to sync user profile." });
    }
  });
  app.post("/api/admin/set-user-role", sandboxGuard, authMiddleware, requireSuperAdmin, requireEmailVerified, async (req, res) => {
    try {
      if (req.supabaseSession) {
        return res.status(403).json({
          error: "Cette route concerne uniquement les Custom Claims Firebase h\xE9rit\xE9s.",
          code: "auth/firebase-only-route"
        });
      }
      const { targetUid, role } = req.body;
      if (!targetUid || typeof targetUid !== "string" || targetUid.trim().length === 0 || targetUid.length > 128) {
        return res.status(400).json({ error: "Param\xE8tre targetUid valide requis." });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ error: "Param\xE8tre role requis." });
      }
      const validRoles = ["super_admin", "admin", "client", "guest", "demo"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `R\xF4le invalide. R\xF4les autoris\xE9s: ${validRoles.join(", ")}` });
      }
      if (req.user?.uid === targetUid && role !== "super_admin") {
        return res.status(400).json({ error: "Un super-administrateur ne peut pas r\xE9trograder son propre compte via cette route." });
      }
      await resolveAdminAuth().setCustomUserClaims(targetUid, { role });
      console.log(`[Admin] Custom Claim 'role: ${role}' assigned to UID: ${targetUid} by verified super_admin UID: ${req.user?.uid}`);
      res.json({
        success: true,
        targetUid,
        role,
        message: "R\xF4le attribu\xE9 via Firebase Custom Claim. Un rafra\xEEchissement du token client (getIdToken(true)) est n\xE9cessaire pour appliquer le r\xF4le."
      });
    } catch (err) {
      console.error("Error setting custom user claim:", err?.message || err);
      res.status(500).json({
        error: "Internal server error",
        code: "ADMIN_ROLE_UPDATE_FAILED"
      });
    }
  });
  const hasInjectedFirebaseDeps = Boolean(deps.getAdminDb && deps.getAdminAuth);
  const sandboxModeActive = isStagingSandboxMode(runtimeEnv);
  const firebaseRuntimeBlocked = sandboxModeActive || shouldBlockServerFirebaseInit(runtimeEnv) || !hasInjectedFirebaseDeps && isServerFirebaseRuntimeDisabled;
  if (firebaseRuntimeBlocked) {
    const rejectWhenFirebaseRuntimeDisabled = (req, res, _next) => {
      return sandboxGuard(req, res, () => {
        if (sandboxModeActive) {
          return res.status(403).json({
            error: "Forbidden: Server-side administrative, payment, webhook, and database persistence routes are disabled in Sandbox mode.",
            code: "sandbox/server-mutation-forbidden"
          });
        }
        return res.status(503).json({
          error: "Service Unavailable: Server Firebase Admin runtime is disabled (explicit coherent PDI_ENV and VITE_PDI_ENV required).",
          code: "server/firebase-runtime-disabled"
        });
      });
    };
    app.post("/api/payments/orders", rejectWhenFirebaseRuntimeDisabled);
    app.post("/api/webhooks/slickpay", rejectWhenFirebaseRuntimeDisabled);
    app.post("/api/webhooks/paddle", rejectWhenFirebaseRuntimeDisabled);
  } else {
    const activeAdminDb = resolveAdminDb();
    const activeAdminAuth = resolveAdminAuth();
    const pendingOrderRepository = createPendingOrderRepository({
      adminDb: activeAdminDb
    });
    const webhookIdempotencyRepository = createWebhookIdempotencyRepository({
      adminDb: activeAdminDb
    });
    const paymentWebhookProcessor = createPaymentWebhookProcessor({
      adminDb: activeAdminDb,
      adminAuth: activeAdminAuth,
      idempotencyRepository: webhookIdempotencyRepository,
      pendingOrderRepository
    });
    app.post(
      "/api/payments/orders",
      sandboxGuard,
      ...createPendingOrderRoute({
        pendingOrderRepository,
        verifyIdToken: deps.getAdminAuth ? (token) => activeAdminAuth.verifyIdToken(token) : void 0
      })
    );
    app.post("/api/webhooks/slickpay", sandboxGuard, createSlickPayWebhookHandler());
    app.post(
      "/api/webhooks/paddle",
      sandboxGuard,
      createPaddleWebhookBodyParser(),
      createPaddleWebhookHandler({
        processor: paymentWebhookProcessor
      })
    );
  }
  app.get("/api/projects", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const userProjects = await fetchProjects(uid);
      res.json({ projects: userProjects });
    } catch (err) {
      console.error("Error fetching projects from Cloud SQL:", err);
      res.status(500).json({ error: "Failed to fetch projects." });
    }
  });
  app.post("/api/projects", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const saved = await upsertProject(uid, req.body);
      res.json({ project: saved });
    } catch (err) {
      console.error("Error saving project to Cloud SQL:", err);
      res.status(500).json({ error: "Failed to save project." });
    }
  });
  app.delete("/api/projects/:id", sandboxGuard, strictSupabaseApiAuthMiddleware, async (req, res) => {
    try {
      const uid = req.user?.uid;
      const projectId = Number(req.params.id);
      if (!uid || isNaN(projectId)) return res.status(400).json({ error: "Invalid request" });
      await removeProject(uid, projectId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting project from Cloud SQL:", err);
      res.status(500).json({ error: "Failed to delete project." });
    }
  });
  app.post("/api/sketch/detect-iso", async (_req, res) => {
    return res.json({
      success: true,
      data: null
    });
  });
  const shouldMountApiNotFound = options.mountApiNotFoundHandler ?? options.mountErrorHandler !== false;
  if (shouldMountApiNotFound) {
    app.use("/api", createApiNotFoundHandler());
  }
  if (options.mountErrorHandler !== false) {
    app.use(createGlobalExpressErrorHandler());
  }
  return app;
}
async function startServer(options = {}) {
  const runtimeEnv = options.env ?? process.env;
  const host = options.host ?? "0.0.0.0";
  const port = options.port !== void 0 ? options.port : Number(runtimeEnv.PORT) || 3e3;
  const attachFrontend = options.attachFrontend !== false;
  const app = createPdiExpressApp({
    env: runtimeEnv,
    mountErrorHandler: false,
    mountApiNotFoundHandler: false,
    dependencies: options.dependencies
  });
  const deliveryMode = resolveServerDeliveryMode(runtimeEnv);
  if (attachFrontend) {
    if (!deliveryMode.serveStaticDist) {
      app.use("/api", createApiNotFoundHandler());
      const viteModuleName = "vite";
      const viteServerFactory = options.dependencies?.createViteServer ?? (await import(viteModuleName)).createServer;
      const vite = await viteServerFactory({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = options.distPath ?? import_path.default.join(process.cwd(), "dist");
      app.use((req, res, next) => {
        if (req.path.includes("..") || req.path.includes("/.") || req.path.startsWith("/.")) {
          return res.status(403).type("text/plain").send("Forbidden: Invalid path syntax");
        }
        next();
      });
      const sendRuntimeConfiguredIndexHtml = (_req, res) => {
        try {
          const indexPath = import_path.default.join(distPath, "index.html");
          if (!import_fs.default.existsSync(indexPath)) {
            res.status(404).type("text/plain").send("Asset not found");
            return;
          }
          const rawHtml = import_fs.default.readFileSync(indexPath, "utf-8");
          const publicRuntimeConfig = buildPublicBrowserRuntimeConfig(runtimeEnv);
          const renderedHtml = injectPublicRuntimeConfigIntoHtml(rawHtml, publicRuntimeConfig);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.send(renderedHtml);
        } catch (err) {
          console.error("Error serving runtime-configured index.html:", err?.message || err);
          res.status(500).type("text/plain").send("Internal Server Error");
        }
      };
      app.get(["/", "/index.html"], sendRuntimeConfiguredIndexHtml);
      app.use(
        import_express2.default.static(distPath, {
          index: false,
          dotfiles: "ignore",
          setHeaders: (res, filePath) => {
            if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
          }
        })
      );
      app.get("/api/health/assets", (_req, res) => {
        if (deliveryMode.strictSecurityMode && !runtimeEnv.ENABLE_ASSET_DIAGNOSTICS) {
          return res.json({
            status: "ok",
            ready: import_fs.default.existsSync(distPath) && import_fs.default.existsSync(import_path.default.join(distPath, "index.html"))
          });
        }
        try {
          const assetsDir = import_path.default.join(distPath, "assets");
          const files = import_fs.default.existsSync(assetsDir) ? import_fs.default.readdirSync(assetsDir) : [];
          res.json({
            distExists: import_fs.default.existsSync(distPath),
            indexHtml: import_fs.default.existsSync(import_path.default.join(distPath, "index.html")),
            css: files.filter((f) => f.endsWith(".css")),
            jsCount: files.filter((f) => f.endsWith(".js")).length
          });
        } catch (err) {
          console.error("Asset health check error:", err?.message || err);
          res.status(500).json({ error: "Internal asset health check error" });
        }
      });
      app.get("/api/style/main.css", (_req, res) => {
        try {
          const assetsDir = import_path.default.join(distPath, "assets");
          const files = import_fs.default.existsSync(assetsDir) ? import_fs.default.readdirSync(assetsDir).filter((f) => f.endsWith(".css")) : [];
          if (files.length === 0) {
            res.status(404).type("text/plain").send("Aucun bundle CSS dans dist/assets");
            return;
          }
          const css = files.map((f) => import_fs.default.readFileSync(import_path.default.join(assetsDir, f), "utf-8")).join("\n");
          res.setHeader("Content-Type", "text/css; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.send(css);
        } catch (err) {
          console.error("Error reading CSS bundle:", err?.message || err);
          res.status(500).type("text/plain").send("Internal Server Error");
        }
      });
      app.use("/api", createApiNotFoundHandler());
      app.get("*", (req, res) => {
        if (import_path.default.extname(req.path)) {
          res.status(404).type("text/plain").send("Asset not found");
          return;
        }
        return sendRuntimeConfiguredIndexHtml(req, res);
      });
    }
  } else {
    app.use("/api", createApiNotFoundHandler());
  }
  app.use(createGlobalExpressErrorHandler());
  const server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      resolve(httpServer);
    });
    httpServer.on("error", reject);
  });
  const address = server.address();
  const boundPort = address && typeof address === "object" ? address.port : port;
  console.log(`Server running on http://${host}:${boundPort}`);
  const close = () => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  });
  return {
    app,
    server,
    host,
    port: boundPort,
    close
  };
}
function isDirectServerExecution() {
  if (process.env.PDI_SERVER_NO_AUTOSTART === "1" || process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return false;
  }
  if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
    return true;
  }
  const entryArg = process.argv[1] ? import_path.default.resolve(process.argv[1]) : "";
  return entryArg.endsWith(`${import_path.default.sep}server.ts`) || entryArg.endsWith(`${import_path.default.sep}server.cjs`) || entryArg.endsWith(`${import_path.default.sep}server.js`);
}
if (isDirectServerExecution()) {
  startServer().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

// src/server/vercelHandler.ts
function inspectVercelSupabaseServerEnv(env = process.env) {
  const hasUrl = typeof env.SUPABASE_URL === "string" && env.SUPABASE_URL.trim().length > 0;
  const hasSecretKey = typeof env.SUPABASE_SECRET_KEY === "string" && env.SUPABASE_SECRET_KEY.trim().length > 0;
  try {
    validateSupabaseAdminConfig(env);
    return {
      configured: true,
      hasUrl: true,
      hasSecretKey: true
    };
  } catch (err) {
    const errorCode = err instanceof SupabaseAdminConfigError ? err.code : "INVALID_SUPABASE_CONFIG";
    return {
      configured: false,
      hasUrl,
      hasSecretKey,
      errorCode
    };
  }
}
function resolveVercelRuntimeEnv(rawEnv = process.env) {
  const clonedEnv = { ...rawEnv };
  const isVercelRuntime = clonedEnv.VERCEL === "1" || clonedEnv.VERCEL === "true";
  if (!isVercelRuntime) {
    return clonedEnv;
  }
  const candidateHosts = [
    clonedEnv.VERCEL_PROJECT_PRODUCTION_URL,
    clonedEnv.VERCEL_URL,
    clonedEnv.VERCEL_BRANCH_URL
  ];
  const validatedVercelOrigins = [];
  for (const rawHost of candidateHosts) {
    if (typeof rawHost !== "string" || rawHost.trim().length === 0) {
      continue;
    }
    const trimmed = rawHost.trim();
    const candidateOrigin = trimmed.startsWith("https://") ? trimmed : trimmed.startsWith("http://") ? trimmed : `https://${trimmed}`;
    const check = validateOriginEntry(candidateOrigin, { allowLocalhostHttp: false });
    if (check.isValid && check.normalizedOrigin && !validatedVercelOrigins.includes(check.normalizedOrigin)) {
      validatedVercelOrigins.push(check.normalizedOrigin);
    }
  }
  if (validatedVercelOrigins.length > 0) {
    const existingEntries = typeof clonedEnv.ALLOWED_ORIGINS === "string" && clonedEnv.ALLOWED_ORIGINS.trim().length > 0 ? clonedEnv.ALLOWED_ORIGINS.split(",").map((entry) => entry.trim()) : [];
    const existingLower = new Set(existingEntries.map((entry) => entry.toLowerCase()));
    const mergedEntries = [...existingEntries];
    for (const vercelOrigin of validatedVercelOrigins) {
      if (!existingLower.has(vercelOrigin.toLowerCase())) {
        mergedEntries.push(vercelOrigin);
        existingLower.add(vercelOrigin.toLowerCase());
      }
    }
    clonedEnv.ALLOWED_ORIGINS = mergedEntries.join(",");
  }
  return clonedEnv;
}
function normalizeVercelApiRequestUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return "/api";
  }
  return rawUrl;
}
function createVercelApiHandler(options = {}) {
  let cachedApp = null;
  let initFailed = false;
  const getOrCreateApp = () => {
    if (cachedApp) {
      return cachedApp;
    }
    if (initFailed) {
      return null;
    }
    try {
      const resolvedEnv = resolveVercelRuntimeEnv(options.env ?? process.env);
      cachedApp = createPdiExpressApp({
        env: resolvedEnv,
        mountErrorHandler: true,
        mountApiNotFoundHandler: true,
        dependencies: options.dependencies
      });
      return cachedApp;
    } catch {
      initFailed = true;
      console.error(
        "[VERCEL-API-01] Refus fail-closed : \xE9chec de la v\xE9rification de configuration serveur Express."
      );
      return null;
    }
  };
  return (req, res) => {
    const app = getOrCreateApp();
    if (!app) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(
        JSON.stringify({
          error: "Service Unavailable: Server configuration failed security verification.",
          code: "server/configuration-error"
        })
      );
      return;
    }
    req.url = normalizeVercelApiRequestUrl(req.url);
    app(req, res);
  };
}
var singletonVercelHandler = null;
function vercelApiHandler(req, res) {
  if (!singletonVercelHandler) {
    singletonVercelHandler = createVercelApiHandler();
  }
  singletonVercelHandler(req, res);
}
var vercelHandler_default = vercelApiHandler;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createVercelApiHandler,
  inspectVercelSupabaseServerEnv,
  normalizeVercelApiRequestUrl,
  resolveVercelRuntimeEnv,
  vercelApiHandler
});
