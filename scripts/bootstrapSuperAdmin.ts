/**
 * ORTHOGONAL PD&I STUDIO — SEC-01 / AUTH-ADMIN-05-FIX-07
 * Script de Bootstrap Super Admin sécurisé (Firebase Admin SDK).
 * 
 * Ce script est autonome, idempotent et strictement sécurisé :
 * - Cible exclusivement le projet Firebase 'graphical-router-x18qq' via adminAuth.app.options.projectId et getFirestoreProjectId(db).
 * - Autorise exclusivement l'adresse 'boudjada.youcef@gmail.com'.
 * - Contrôle le compte : existence, activation stricte (disabled === false), vérification email (emailVerified === true), fournisseur 'google.com'.
 * - FIX-07-A : Échec ambigu de l'écriture Firestore : encadrement spécifique, relecture diagnostique, comparaison intégrale,
 *   signalement partialState: true, refus de retry automatique, interdiction stricte de poursuivre vers les Custom Claims.
 * - FIX-07-B & FIX-07-G : Vérification structurelle récursive des Custom Claims (compareClaimsStructural) : indépendante de l'ordre JSON,
 *   détection des clés manquantes, valeurs différentes et clés supplémentaires inattendues. Préservation de tous les claims existants.
 * - FIX-07-C : Exclusion absolue des champs d'autorisation historiques (role, roles, admin, isAdmin, isSuperAdmin, permissions,
 *   customClaims, accessLevel, privileges, authorization, authorizations, securityRole, adminRole) à tous les niveaux.
 * - FIX-07-D : Validation stricte du compte désactivé (userRecord.disabled === false impératif, fail-closed).
 * - FIX-07-E : Réduction des données exposées dans les rapports : finalProfileToSave retiré du rapport, conflits sans valeurs brutes
 *   (uniquement field, valuesDiffer, conflictCategory), claim keys sans valeurs brutes.
 * - FIX-07-F : Protection contre la pollution de prototype (__proto__, constructor, prototype) via safeDefineProperty et createSafePlainObject.
 * - FIX-06 B1 : Extraction temporelle stricte avec fuseau obligatoire, calendrier réel, fraction 1..9 chiffres max, décalages UTC validés.
 * - FIX-06 B2 : Filtrage récursif des données commerciales dans les tableaux historiques imbriqués (filterHistoricalValue).
 * - FIX-06 B3 : Validation stricte et croisée du projet Firestore (getFirestoreProjectId) et du projet Auth avant toute lecture.
 * - Entrée CLI robuste avec resolve / pathToFileURL : dry-run par défaut, --execute seul requis pour écrire.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adminAuth, adminDb } from '../src/lib/firebase-admin.ts';

export const EXPECTED_PROJECT_ID = 'graphical-router-x18qq';
export const ALLOWED_SUPER_ADMIN_EMAIL = 'boudjada.youcef@gmail.com';
export const HISTORICAL_PROFILE_DOC_ID = 'superadmin-youcef-boudjada';

/**
 * FIX-07-F — Clés interdites pour prévenir la pollution de prototype.
 */
export const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isDangerousKey(key: string): boolean {
  if (typeof key !== 'string') return true;
  const lower = key.trim().toLowerCase();
  return (
    DANGEROUS_OBJECT_KEYS.has(lower) ||
    lower.startsWith('__proto__') ||
    lower.startsWith('constructor') ||
    lower.startsWith('prototype')
  );
}

/**
 * FIX-07-F — Création sécurisée d'un objet ordinaire compatible Firestore.
 */
export function createSafePlainObject(): Record<string, any> {
  return Object.create(Object.prototype);
}

/**
 * FIX-07-F — Affectation sécurisée sans déclencher de setter prototype.
 */
export function safeDefineProperty(target: Record<string, any>, key: string, value: any): void {
  if (isDangerousKey(key)) return;
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}

/**
 * Modèle commercial réel du projet Orthogonal PD&I Studio :
 * Clés de propriétés commerciales, de facturation, de passerelles de paiement,
 * de licences, de quotas et de statut strictement protégées contre toute importation à TOUS les niveaux de profondeur.
 */
export const PROTECTED_COMMERCIAL_LEAF_KEYS = new Set([
  'accounttype',
  'subscriptionplan',
  'status',
  'paymentgateway',
  'currency',
  'storageusedkb',
  'logincount',
  'licenses',
  'license',
  'licensekey',
  'licensekeys',
  'assignedplan',
  'maxusers',
  'payments',
  'payment',
  'paymentstatus',
  'billing',
  'billingcycle',
  'billingemail',
  'billingcounters',
  'billingdata',
  'invoices',
  'invoice',
  'subscription',
  'subscriptions',
  'subscriptionstatus',
  'quotas',
  'quota',
  'balance',
  'currentbalance',
  'customerid',
  'pricingplan',
  'tier',
  'accesstier'
]);

/**
 * FIX-07-C — Champs de privilèges et d'autorisations historiques strictement interdits d'importation.
 */
export const FORBIDDEN_HISTORICAL_AUTH_LEAF_KEYS = new Set([
  'role',
  'roles',
  'admin',
  'isadmin',
  'issuperadmin',
  'permissions',
  'customclaims',
  'accesslevel',
  'privileges',
  'authorization',
  'authorizations',
  'securityrole',
  'adminrole'
]);

/**
 * Détermine si un champ relève des données commerciales protégées.
 */
export function isProtectedCommercialField(key: string, pathPrefix = ''): boolean {
  const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
  const segments = fullPath.toLowerCase().split(/[.\[\]]+/).filter(Boolean);
  const leafKey = key.toLowerCase();

  // 1. Clé exacte dans la liste protégée issue du modèle commercial réel
  if (PROTECTED_COMMERCIAL_LEAF_KEYS.has(leafKey)) {
    return true;
  }

  // 2. Mots-clés commerciaux explicites dans la clé feuille
  if (
    leafKey.includes('billing') ||
    leafKey.includes('payment') ||
    leafKey.includes('invoice') ||
    leafKey.includes('license') ||
    leafKey.includes('subscription') ||
    leafKey.includes('accounttype') ||
    leafKey.includes('pricingplan')
  ) {
    return true;
  }

  // 3. Conteneur parent commercial dans le chemin hiérarchique
  for (const segment of segments) {
    if (
      segment === 'billing' ||
      segment === 'subscription' ||
      segment === 'subscriptions' ||
      segment === 'payments' ||
      segment === 'licenses' ||
      segment === 'invoices' ||
      segment === 'paymentgateway' ||
      segment === 'quotas' ||
      segment.includes('billing')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * FIX-07-C : Détermine si un champ relève des privilèges ou autorisations historiques protégés.
 */
export function isProtectedAuthorizationField(key: string, pathPrefix = ''): boolean {
  const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
  const segments = fullPath.toLowerCase().split(/[.\[\]]+/).filter(Boolean);
  const leafKey = key.toLowerCase();

  // 1. Clé exacte dans la liste protégée
  if (FORBIDDEN_HISTORICAL_AUTH_LEAF_KEYS.has(leafKey)) {
    return true;
  }

  // 2. Mots-clés explicites dans la clé feuille
  if (
    leafKey.includes('authorization') ||
    leafKey.includes('authorizations') ||
    leafKey.includes('permission') ||
    leafKey.includes('permissions') ||
    leafKey.includes('privilege') ||
    leafKey.includes('privileges') ||
    leafKey.includes('superadmin') ||
    leafKey.includes('adminrole') ||
    leafKey.includes('securityrole') ||
    leafKey.includes('customclaim') ||
    leafKey.includes('accesslevel')
  ) {
    return true;
  }

  // 3. Conteneur parent d'autorisation dans le chemin
  for (const segment of segments) {
    if (
      segment === 'permissions' ||
      segment === 'privileges' ||
      segment === 'authorizations' ||
      segment === 'roles' ||
      segment === 'customclaims' ||
      segment === 'role' ||
      segment === 'admin'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * FIX-07-C : Vérifie si un champ est strictement interdit d'importation depuis l'historique
 * (soit commercial, soit autorisation/privilège).
 */
export function isForbiddenHistoricalField(key: string, pathPrefix = ''): boolean {
  return isProtectedCommercialField(key, pathPrefix) || isProtectedAuthorizationField(key, pathPrefix);
}

/**
 * FIX-07-E — Résumé non sensible d'un conflit détecté.
 */
export interface ConflictSummary {
  field: string;
  valuesDiffer: boolean;
  conflictCategory?: 'commercial' | 'authorization' | 'profile_data' | 'structural';
}

/**
 * FIX-07-E — Rapport de bootstrap assaini, sans données personnelles ni commerciales brutes.
 */
export interface BootstrapReport {
  mode: 'dry-run' | 'execute';
  timestamp: string;
  projectId: string;
  email: string;
  uid?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  hasGoogleProvider?: boolean;
  existingClaimKeys?: string[];
  updatedClaimKeys?: string[];
  historicalProfileFound: boolean;
  targetProfileFound: boolean;
  conflictsDetected: ConflictSummary[];
  fieldsRecoveredFromHistory: string[];
  profileWritten: boolean;
  profileVerified: boolean;
  claimsUpdated: boolean;
  claimsVerified: boolean;
  success: boolean;
  partialState?: boolean;
  error?: string;
}

export interface BootstrapOptions {
  execute?: boolean;
  targetEmail?: string;
  authInstance?: any;
  firestoreInstance?: any;
}

/**
 * Spécification temporelle exacte avec précision nanoseconde (B1).
 */
export interface ExactTimeSpec {
  valid: boolean;
  type: 'timestamp' | 'date' | 'iso_string';
  seconds: number;
  nanoseconds: number;
  error?: string;
}

/**
 * Extraction temporelle exacte sans perte de précision nanoseconde.
 */
export function extractExactTime(val: any): ExactTimeSpec | null {
  if (val === null || val === undefined) return null;

  const fromMilliseconds = (ms: number, type: 'date' | 'timestamp'): ExactTimeSpec => {
    if (!Number.isFinite(ms)) {
      return { valid: false, type, seconds: NaN, nanoseconds: NaN, error: 'Date invalide' };
    }
    const seconds = Math.floor(ms / 1000);
    return {
      valid: true,
      type,
      seconds,
      nanoseconds: (ms - seconds * 1000) * 1_000_000
    };
  };

  if (val instanceof Date) return fromMilliseconds(val.getTime(), 'date');

  if (typeof val === 'object') {
    const hasSeconds = 'seconds' in val || '_seconds' in val;
    const hasNanoseconds = 'nanoseconds' in val || '_nanoseconds' in val;
    const rawSec = 'seconds' in val ? val.seconds : val._seconds;
    const rawNs = 'nanoseconds' in val ? val.nanoseconds : val._nanoseconds;

    if (hasSeconds || hasNanoseconds) {
      if (
        typeof rawSec !== 'number' ||
        typeof rawNs !== 'number' ||
        !Number.isSafeInteger(rawSec) ||
        !Number.isInteger(rawNs) ||
        rawNs < 0 ||
        rawNs >= 1_000_000_000
      ) {
        return {
          valid: false,
          type: 'timestamp',
          seconds: NaN,
          nanoseconds: NaN,
          error: 'Timestamp malformé'
        };
      }
      return { valid: true, type: 'timestamp', seconds: rawSec, nanoseconds: rawNs };
    }

    if (typeof val.toDate === 'function' || typeof val.toMillis === 'function') {
      return {
        valid: false,
        type: 'timestamp',
        seconds: NaN,
        nanoseconds: NaN,
        error: 'Timestamp opaque : seconds/nanoseconds indisponibles'
      };
    }
  }

  if (typeof val === 'string') {
    const match = val.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):?(\d{2}))$/i
    );
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const fraction = match[7] || '';
    const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
    const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);

    if (
      month < 1 || month > 12 ||
      hour > 23 || minute > 59 || second > 59 ||
      offsetHour > 14 || offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)
    ) {
      return {
        valid: false,
        type: 'iso_string',
        seconds: NaN,
        nanoseconds: NaN,
        error: 'Composantes ISO hors limites'
      };
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
      return {
        valid: false,
        type: 'iso_string',
        seconds: NaN,
        nanoseconds: NaN,
        error: 'Date calendaire impossible'
      };
    }

    const milliseconds = Date.parse(val);
    if (!Number.isFinite(milliseconds)) {
      return {
        valid: false,
        type: 'iso_string',
        seconds: NaN,
        nanoseconds: NaN,
        error: 'Chaîne ISO invalide'
      };
    }

    const secondsUtc = Math.floor(milliseconds / 1000);
    const nanoseconds = Number((fraction + '000000000').slice(0, 9));
    return { valid: true, type: 'iso_string', seconds: secondsUtc, nanoseconds };
  }

  return null;
}

export function isDateOrFirestoreTimestamp(val: any): boolean {
  return extractExactTime(val) !== null;
}

export function getNormalizedMillis(val: any): number {
  const t = extractExactTime(val);
  if (!t || !t.valid) return NaN;
  return t.seconds * 1000 + Math.floor(t.nanoseconds / 1_000_000);
}

export function areDatesOrTimestampsEqual(val1: any, val2: any): boolean {
  const t1 = extractExactTime(val1);
  const t2 = extractExactTime(val2);

  if (!t1 || !t2) return false;
  if (!t1.valid || !t2.valid) return false;

  return t1.seconds === t2.seconds && t1.nanoseconds === t2.nanoseconds;
}

export function isPlainObject(item: any): item is Record<string, any> {
  return (
    item !== null &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    !(item instanceof Date) &&
    !isDateOrFirestoreTimestamp(item)
  );
}

/**
 * FIX-07-B & FIX-07-G — Comparaison structurelle récursive des Custom Claims :
 * - Mêmes clés.
 * - Mêmes valeurs scalaires et types stricts.
 * - Mêmes tableaux et positions d'éléments.
 * - Indépendante de l'ordre des propriétés JSON des objets.
 * - Détection obligatoire des clés manquantes et des clés supplémentaires non autorisées.
 * - Distinction stricte entre null, undefined, booléen, nombre et chaîne.
 */
export function compareClaimsStructural(expected: any, actual: any, path = ''): string[] {
  const diffs: string[] = [];

  if (expected === actual) {
    return diffs;
  }

  const isExpNullOrUndef = expected === null || expected === undefined;
  const isActNullOrUndef = actual === null || actual === undefined;
  if (isExpNullOrUndef || isActNullOrUndef) {
    if (expected !== actual) {
      const expDesc = expected === undefined ? 'absent/undefined' : JSON.stringify(expected);
      const actDesc = actual === undefined ? 'absent/undefined' : JSON.stringify(actual);
      diffs.push(`Claim '${path || 'root'}' non conforme (attendu: ${expDesc}, obtenu: ${actDesc})`);
    }
    return diffs;
  }

  const expType = typeof expected;
  const actType = typeof actual;
  if (expType !== actType) {
    diffs.push(`Type de claim non conforme pour '${path || 'root'}' (attendu: ${expType}, obtenu: ${actType})`);
    return diffs;
  }

  const isExpArr = Array.isArray(expected);
  const isActArr = Array.isArray(actual);
  if (isExpArr || isActArr) {
    if (!isExpArr || !isActArr) {
      diffs.push(`Type de claim non conforme pour '${path || 'root'}' (attendu: ${isExpArr ? 'tableau' : expType}, obtenu: ${isActArr ? 'tableau' : actType})`);
      return diffs;
    }
    if (expected.length !== actual.length) {
      diffs.push(`Longueur de tableau de claims non conforme pour '${path || 'root'}' (attendu: ${expected.length}, obtenu: ${actual.length})`);
      return diffs;
    }
    for (let i = 0; i < expected.length; i++) {
      const subPath = `${path}[${i}]`;
      diffs.push(...compareClaimsStructural(expected[i], actual[i], subPath));
    }
    return diffs;
  }

  if (expType === 'object') {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    for (const key of expectedKeys) {
      const subPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        diffs.push(`Claim attendu manquant '${subPath}' (valeur: ${JSON.stringify(expected[key])})`);
      } else {
        diffs.push(...compareClaimsStructural(expected[key], actual[key], subPath));
      }
    }

    for (const key of actualKeys) {
      const subPath = path ? `${path}.${key}` : key;
      if (!(key in expected)) {
        diffs.push(`Claim supplémentaire inattendu '${subPath}' (valeur non sollicitée: ${JSON.stringify(actual[key])})`);
      }
    }

    return diffs;
  }

  if (expected !== actual) {
    diffs.push(`Valeur discordante pour claim '${path || 'root'}' (attendu: ${JSON.stringify(expected)}, obtenu: ${JSON.stringify(actual)})`);
  }

  return diffs;
}

/**
 * Comparaison intégrale récursive stricte pour documents Firestore.
 */
export function deepCompareFirestoreData(expected: any, actual: any, path = ''): string[] {
  const diffs: string[] = [];

  if (expected === actual) {
    return diffs;
  }

  const isExpectedTime = isDateOrFirestoreTimestamp(expected);
  const isActualTime = isDateOrFirestoreTimestamp(actual);

  if (isExpectedTime || isActualTime) {
    if (isExpectedTime && isActualTime && areDatesOrTimestampsEqual(expected, actual)) {
      return diffs;
    }
    const t1 = extractExactTime(expected);
    const t2 = extractExactTime(actual);
    const descExp = t1 ? (t1.valid ? `${t1.type}(s=${t1.seconds}, ns=${t1.nanoseconds})` : `invalide(${t1.error})`) : JSON.stringify(expected);
    const descAct = t2 ? (t2.valid ? `${t2.type}(s=${t2.seconds}, ns=${t2.nanoseconds})` : `invalide(${t2.error})`) : JSON.stringify(actual);
    diffs.push(`Horodatage '${path || 'root'}' non conforme (attendu: ${descExp}, obtenu: ${descAct})`);
    return diffs;
  }

  if (expected === null || expected === undefined || actual === null || actual === undefined) {
    if (expected !== actual) {
      const expDesc = expected === undefined ? 'absent' : JSON.stringify(expected);
      const actDesc = actual === undefined ? 'absent' : JSON.stringify(actual);
      diffs.push(`Champ '${path || 'root'}' non conforme (attendu: ${expDesc}, obtenu: ${actDesc})`);
    }
    return diffs;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push(`Type non conforme pour '${path || 'root'}' (attendu: tableau, obtenu: ${typeof actual})`);
      return diffs;
    }
    if (expected.length !== actual.length) {
      diffs.push(`Tableau '${path || 'root'}' de taille différente (attendu: ${expected.length}, obtenu: ${actual.length})`);
      return diffs;
    }
    for (let i = 0; i < expected.length; i++) {
      const subPath = `${path}[${i}]`;
      const subDiffs = deepCompareFirestoreData(expected[i], actual[i], subPath);
      diffs.push(...subDiffs);
    }
    return diffs;
  }

  if (Array.isArray(actual)) {
    diffs.push(`Type non conforme pour '${path || 'root'}' (attendu: ${typeof expected}, obtenu: tableau)`);
    return diffs;
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    for (const key of expectedKeys) {
      const subPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        diffs.push(`Champ attendu manquant '${subPath}' (valeur attendue: ${JSON.stringify(expected[key])})`);
      } else {
        const subDiffs = deepCompareFirestoreData(expected[key], actual[key], subPath);
        diffs.push(...subDiffs);
      }
    }

    for (const key of actualKeys) {
      const subPath = path ? `${path}.${key}` : key;
      if (!(key in expected)) {
        diffs.push(`Champ supplémentaire inattendu '${subPath}' (valeur non sollicitée: ${JSON.stringify(actual[key])})`);
      }
    }

    return diffs;
  }

  if (isPlainObject(expected) || isPlainObject(actual)) {
    diffs.push(`Type non conforme pour '${path || 'root'}' (attendu: ${typeof expected}, obtenu: ${typeof actual})`);
    return diffs;
  }

  if (expected !== actual) {
    diffs.push(`Champ '${path || 'root'}' différent (attendu: ${JSON.stringify(expected)}, obtenu: ${JSON.stringify(actual)})`);
  }

  return diffs;
}

/**
 * FIX-07-C & FIX-07-F : Fusion récursive non destructive protégée :
 * - Priorité absolue aux champs, objets imbriqués et tableaux de targetData.
 * - Récupération des champs absents autorisés depuis historicalData.
 * - Protection commerciale récursive absolue (isProtectedCommercialField).
 * - Exclusion absolue des champs d'autorisation historiques (isProtectedAuthorizationField).
 * - Protection contre la pollution de prototype (__proto__, constructor, prototype) via safeDefineProperty.
 * - Les valeurs déjà présentes dans le document cible sont strictement préservées.
 * - Résumé des conflits sans exposition des valeurs brutes sensibles (ConflictSummary).
 */
export function mergeProfileDataNonDestructive(
  realUid: string,
  targetProfileData: Record<string, any> | null,
  historicalProfileData: Record<string, any> | null
): {
  mergedData: Record<string, any>;
  conflicts: ConflictSummary[];
  recoveredFields: string[];
} {
  const conflicts: ConflictSummary[] = [];
  const recoveredFields: string[] = [];

  if (!targetProfileData && !historicalProfileData) {
    throw new Error("Impossible d'effectuer la fusion : aucun profil cible ni profil historique n'a été trouvé.");
  }

  function filterHistoricalValue(value: any, path: string): any {
    if (Array.isArray(value)) {
      return value
        .map((item, index) => filterHistoricalValue(item, `${path}[${index}]`))
        .filter((item) => item !== undefined);
    }

    if (isPlainObject(value)) {
      const filtered: Record<string, any> = createSafePlainObject();
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (isDangerousKey(nestedKey)) continue;
        if (isForbiddenHistoricalField(nestedKey, path)) continue;

        const nestedPath = path ? `${path}.${nestedKey}` : nestedKey;
        const safeValue = filterHistoricalValue(nestedValue, nestedPath);
        if (safeValue !== undefined) {
          safeDefineProperty(filtered, nestedKey, safeValue);
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : undefined;
    }

    return value;
  }

  function mergeRecursive(
    target: Record<string, any> | null,
    history: Record<string, any> | null,
    pathPrefix = ''
  ): Record<string, any> {
    const result: Record<string, any> = createSafePlainObject();

    if (target && isPlainObject(target)) {
      for (const [tKey, tVal] of Object.entries(target)) {
        if (isDangerousKey(tKey)) continue;
        safeDefineProperty(result, tKey, tVal);
      }
    }

    if (history && isPlainObject(history)) {
      for (const [key, histValue] of Object.entries(history)) {
        if (isDangerousKey(key)) continue;
        if (pathPrefix === '' && key === 'uid') continue;

        const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        const targetValue = target ? target[key] : undefined;

        // FIX-07-C : Exclusion absolue des données commerciales et des autorisations historiques
        if (isForbiddenHistoricalField(key, pathPrefix)) {
          if (targetValue !== undefined) {
            safeDefineProperty(result, key, targetValue);
            if (JSON.stringify(targetValue) !== JSON.stringify(histValue)) {
              conflicts.push({
                field: fieldPath,
                valuesDiffer: true,
                conflictCategory: isProtectedCommercialField(key, pathPrefix)
                  ? 'commercial'
                  : 'authorization'
              });
            }
          }
          // Si targetValue === undefined : NE JAMAIS IMPORTER DEPUIS L'HISTORIQUE !
          continue;
        }

        if (targetValue !== undefined) {
          if (isPlainObject(targetValue) && isPlainObject(histValue)) {
            safeDefineProperty(result, key, mergeRecursive(targetValue, histValue, fieldPath));
          } else if (Array.isArray(targetValue)) {
            if (JSON.stringify(targetValue) !== JSON.stringify(histValue)) {
              conflicts.push({
                field: fieldPath,
                valuesDiffer: true,
                conflictCategory: 'structural'
              });
            }
            safeDefineProperty(result, key, targetValue);
          } else {
            if (targetValue !== histValue) {
              conflicts.push({
                field: fieldPath,
                valuesDiffer: true,
                conflictCategory: 'profile_data'
              });
            }
            safeDefineProperty(result, key, targetValue);
          }
        } else {
          // Champ absent de la cible et non protégé :
          if (isPlainObject(histValue)) {
            const nestedMerged = mergeRecursive(null, histValue, fieldPath);
            if (nestedMerged && Object.keys(nestedMerged).length > 0) {
              safeDefineProperty(result, key, nestedMerged);
              recoveredFields.push(fieldPath);
            }
          } else if (Array.isArray(histValue)) {
            const safeArray = filterHistoricalValue(histValue, fieldPath);
            if (safeArray !== undefined) {
              safeDefineProperty(result, key, safeArray);
              recoveredFields.push(fieldPath);
            }
          } else {
            safeDefineProperty(result, key, histValue);
            recoveredFields.push(fieldPath);
          }
        }
      }
    }

    return result;
  }

  const mergedData = mergeRecursive(targetProfileData, historicalProfileData);
  safeDefineProperty(mergedData, 'uid', realUid);

  return {
    mergedData,
    conflicts,
    recoveredFields
  };
}

export function getFirestoreProjectId(firestoreInstance: any): string | null {
  const projectId = firestoreInstance?.app?.options?.projectId;
  return typeof projectId === 'string' && projectId.length > 0
    ? projectId
    : null;
}

export function parseCliArgs(argv: string[]): { isExecute: boolean } {
  if (argv.length === 0) {
    return { isExecute: false };
  }

  for (const arg of argv) {
    if (!arg.startsWith('-')) {
      throw new Error(`[ARGUMENT INVALIDE] Argument positionnel non autorisé : '${arg}'.`);
    }
  }

  const allowedFlags = new Set(['--execute', '--dry-run']);
  for (const arg of argv) {
    if (!allowedFlags.has(arg)) {
      throw new Error(`[ARGUMENT INVALIDE] Argument CLI non reconnu : '${arg}'. Seuls '--dry-run' et '--execute' sont autorisés.`);
    }
  }

  const hasExecute = argv.includes('--execute');
  const hasDryRun = argv.includes('--dry-run');

  if (hasExecute && hasDryRun) {
    throw new Error(`[ARGUMENT INVALIDE] Les options '--execute' et '--dry-run' sont mutuellement exclusives et ne peuvent être combinées.`);
  }

  if (hasExecute) {
    if (argv.length !== 1) {
      throw new Error(`[ARGUMENT INVALIDE] L'option '--execute' doit être fournie seule sans autre argument.`);
    }
    return { isExecute: true };
  }

  if (hasDryRun) {
    if (argv.length !== 1) {
      throw new Error(`[ARGUMENT INVALIDE] L'option '--dry-run' doit être fournie seule sans répétition.`);
    }
    return { isExecute: false };
  }

  return { isExecute: false };
}

export function isDirectCliExecution(metaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    const resolvedPath = resolve(process.cwd(), argv1);
    const resolvedUrl = pathToFileURL(resolvedPath).href;
    return metaUrl === resolvedUrl;
  } catch {
    return false;
  }
}

/**
 * Fonction maîtresse exécutant le bootstrap Super Admin.
 */
export async function runSuperAdminBootstrap(options: BootstrapOptions = {}): Promise<BootstrapReport> {
  const isExecute = options.execute === true;
  const targetEmail = (options.targetEmail || ALLOWED_SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const authSdk = options.authInstance || adminAuth;
  const dbSdk = options.firestoreInstance || adminDb;

  const authProjectId = authSdk?.app?.options?.projectId;
  const firestoreProjectId = getFirestoreProjectId(dbSdk);

  const report: BootstrapReport = {
    mode: isExecute ? 'execute' : 'dry-run',
    timestamp: new Date().toISOString(),
    projectId: authProjectId || firestoreProjectId || '',
    email: targetEmail,
    historicalProfileFound: false,
    targetProfileFound: false,
    conflictsDetected: [],
    fieldsRecoveredFromHistory: [],
    profileWritten: false,
    profileVerified: false,
    claimsUpdated: false,
    claimsVerified: false,
    success: false
  };

  try {
    // 1. Contrôle strict, croisé et exclusif des projets Auth et Firestore avant toute lecture
    if (
      authProjectId !== EXPECTED_PROJECT_ID ||
      firestoreProjectId !== EXPECTED_PROJECT_ID ||
      authProjectId !== firestoreProjectId
    ) {
      throw new Error(
        `[BLOCAGE PROJET] Projet Auth/Firestore non autorisé ou non vérifiable. ` +
        `Auth='${authProjectId || 'indéfini'}', ` +
        `Firestore='${firestoreProjectId || 'indéfini'}', ` +
        `attendu='${EXPECTED_PROJECT_ID}'.`
      );
    }

    // 2. Contrôle strict de l'adresse email autorisée
    if (targetEmail !== ALLOWED_SUPER_ADMIN_EMAIL) {
      throw new Error(`[BLOCAGE EMAIL] Seule l'adresse '${ALLOWED_SUPER_ADMIN_EMAIL}' est autorisée au bootstrap Super Admin.`);
    }

    // 3. Récupération et contrôle strict du compte Firebase Auth (Lecture seule)
    let userRecord: any;
    try {
      userRecord = await authSdk.getUserByEmail(targetEmail);
    } catch (err: any) {
      throw new Error(`[COMPTE INTROUVABLE] Aucun utilisateur Firebase Auth pour ${targetEmail} : ${err?.message || err}`);
    }

    report.uid = userRecord.uid;

    // FIX-07-D : Validation stricte du compte désactivé (userRecord.disabled === false impératif, fail-closed)
    if (userRecord.disabled !== false) {
      report.disabled = userRecord.disabled === true ? true : undefined;
      throw new Error(
        `[COMPTE DÉSACTIVÉ] Le compte Firebase Auth pour ${targetEmail} n'est pas explicitement actif (userRecord.disabled attendu strictement à false, obtenu : ${JSON.stringify(userRecord.disabled)}).`
      );
    }
    report.disabled = false;

    // Validation stricte de l'email vérifié
    if (userRecord.emailVerified !== true) {
      report.emailVerified = userRecord.emailVerified === true;
      throw new Error(
        `[EMAIL NON VÉRIFIÉ] Le compte Firebase Auth pour ${targetEmail} n'a pas son email vérifié (userRecord.emailVerified attendu strictement à true, obtenu : ${JSON.stringify(userRecord.emailVerified)}).`
      );
    }
    report.emailVerified = true;

    const providerIds = (userRecord.providerData || []).map((p: any) => p.providerId);
    report.hasGoogleProvider = providerIds.includes('google.com');
    if (!report.hasGoogleProvider) {
      throw new Error(`[FOURNISSEUR INVALIDE] Le compte ${targetEmail} n'est pas associé au fournisseur d'identité 'google.com' (providers: ${providerIds.join(', ')}).`);
    }

    // Préparation sécurisée des Custom Claims en préservant l'existant
    const existingClaims: Record<string, any> = { ...(userRecord.customClaims || {}) };
    const expectedClaims: Record<string, any> = {
      ...existingClaims,
      role: 'super_admin'
    };

    // FIX-07-E : Enregistrement uniquement des noms de clés de claims dans le rapport (pas de valeurs brutes)
    report.existingClaimKeys = Object.keys(existingClaims);
    report.updatedClaimKeys = Object.keys(expectedClaims);

    // 4. Lecture des profils Firestore : interruption immédiate en cas d'erreur de lecture (Lecture seule)
    const historicalDocRef = dbSdk.collection('profiles').doc(HISTORICAL_PROFILE_DOC_ID);
    const targetDocRef = dbSdk.collection('profiles').doc(userRecord.uid);

    let historicalData: Record<string, any> | null = null;
    let targetData: Record<string, any> | null = null;

    try {
      const histSnap = await historicalDocRef.get();
      if (histSnap.exists) {
        historicalData = histSnap.data();
        report.historicalProfileFound = true;
      }
    } catch (err: any) {
      throw new Error(`[ERREUR LECTURE FIRESTORE] Échec de la lecture du profil historique '${HISTORICAL_PROFILE_DOC_ID}' : ${err?.message || err}`);
    }

    try {
      const targetSnap = await targetDocRef.get();
      if (targetSnap.exists) {
        targetData = targetSnap.data();
        report.targetProfileFound = true;
      }
    } catch (err: any) {
      throw new Error(`[ERREUR LECTURE FIRESTORE] Échec de la lecture du profil cible '${userRecord.uid}' : ${err?.message || err}`);
    }

    // 5. Construction et validation de la fusion non destructive protégée (FIX-07-C & FIX-07-F)
    const mergeResult = mergeProfileDataNonDestructive(userRecord.uid, targetData, historicalData);
    report.conflictsDetected = mergeResult.conflicts;
    report.fieldsRecoveredFromHistory = mergeResult.recoveredFields;

    // FIX-07-E : Le profil final reste dans une variable locale, JAMAIS exposé dans le rapport
    const finalProfileToSave = mergeResult.mergedData;

    // 6. Exécution sécurisée conditionnée au mode --execute (strictement ignorée en dry-run)
    if (isExecute) {
      // Étape 6.1 : Écriture du profil cible dans Firestore avec gestion d'échec ambigu (FIX-07-A)
      try {
        await targetDocRef.set(finalProfileToSave, { merge: true });
        report.profileWritten = true;
      } catch (writeErr: any) {
        // Relecture diagnostique immédiate pour lever l'ambiguïté réseau/serveur
        let diagnosticDataPresent = false;
        let diagnosticReadPossible = false;
        try {
          const diagSnap = await targetDocRef.get();
          if (diagSnap.exists) {
            diagnosticReadPossible = true;
            const diagData = diagSnap.data();
            const diffs = deepCompareFirestoreData(finalProfileToSave, diagData);
            if (diffs.length === 0) {
              diagnosticDataPresent = true;
            }
          }
        } catch {
          diagnosticReadPossible = false;
        }

        report.partialState = true;
        report.profileWritten = diagnosticDataPresent;

        if (diagnosticDataPresent) {
          throw new Error(
            `[ÉTAT PARTIEL - INTERVENTION REQUISE] L'écriture Firestore targetDocRef.set() a levé une exception, mais la relecture diagnostique constate que les données attendues ont bien été enregistrées. Une intervention manuelle est requise avant toute modification de Custom Claims : ${writeErr?.message || writeErr}`
          );
        } else {
          throw new Error(
            `[ÉTAT PARTIEL - ÉCHEC ÉCRITURE AMBIGU] L'écriture Firestore targetDocRef.set() a échoué (${writeErr?.message || writeErr}) et la relecture diagnostique n'a pas pu certifier l'état final (diagnosticRead=${diagnosticReadPossible}, matched=${diagnosticDataPresent}). Arrêt immédiat sans modification de Custom Claims.`
          );
        }
      }

      // Étape 6.2 : Relire et vérifier intégralement le profil écrit dans Firestore
      try {
        const reloadedDoc = await targetDocRef.get();
        if (!reloadedDoc.exists) {
          throw new Error("Le document de profil cible est introuvable après écriture.");
        }
        const reloadedData = reloadedDoc.data();
        if (reloadedData?.uid !== userRecord.uid) {
          throw new Error(`L'UID du profil relu ('${reloadedData?.uid}') ne correspond pas à l'UID réel ('${userRecord.uid}').`);
        }

        const diffs = deepCompareFirestoreData(finalProfileToSave, reloadedData);
        if (diffs.length > 0) {
          throw new Error(`Le profil relu ne correspond pas aux données enregistrées : ${diffs.join(' ; ')}`);
        }

        report.profileVerified = true;
      } catch (err: any) {
        report.partialState = true;
        throw new Error(`[ÉTAT PARTIEL] Profil Firestore écrit, MAIS échec de la relecture/vérification du profil : ${err?.message || err}`);
      }

      // Étape 6.3 : Ajouter le Custom Claim role: 'super_admin' (après vérification Firestore réussie)
      try {
        await authSdk.setCustomUserClaims(userRecord.uid, expectedClaims);
        report.claimsUpdated = true;
      } catch (err: any) {
        report.partialState = true;
        throw new Error(`[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS échec de l'attribution des Custom Claims : ${err?.message || err}`);
      }

      // Étape 6.4 : Relire et vérifier intégralement les Custom Claims (FIX-07-B & FIX-07-G)
      try {
        const reloadedUser = await authSdk.getUser(userRecord.uid);
        const actualClaims = reloadedUser?.customClaims || {};

        if (actualClaims.role !== 'super_admin') {
          throw new Error("Le claim 'role: super_admin' est absent après enregistrement.");
        }

        const claimDiffs = compareClaimsStructural(expectedClaims, actualClaims);
        if (claimDiffs.length > 0) {
          throw new Error(`Divergence structurelle des Custom Claims relus : ${claimDiffs.join(' ; ')}`);
        }

        report.claimsVerified = true;
      } catch (err: any) {
        report.partialState = true;
        throw new Error(`[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS échec de la relecture/vérification des Custom Claims : ${err?.message || err}`);
      }
    }

    report.success = true;
    return report;
  } catch (err: any) {
    if (report.profileWritten && (!report.profileVerified || !report.claimsUpdated || !report.claimsVerified)) {
      report.partialState = true;
    }
    report.success = false;
    report.error = err?.message || String(err);
    return report;
  }
}

// Entrée CLI exécutée uniquement en appel direct
if (isDirectCliExecution(import.meta.url, process.argv[1])) {
  try {
    const rawArgs = process.argv.slice(2);
    const { isExecute } = parseCliArgs(rawArgs);

    console.log(`\n===============================================================`);
    console.log(`ORTHOGONAL PD&I STUDIO — BOOTSTRAP SUPER ADMIN [${isExecute ? 'EXECUTE' : 'DRY-RUN'}]`);
    console.log(`===============================================================\n`);

    runSuperAdminBootstrap({ execute: isExecute })
      .then((report) => {
        console.log(JSON.stringify(report, null, 2));
        if (!report.success) {
          if (report.partialState) {
            console.error(`\n[ALERTE SÉCURITÉ - ÉTAT PARTIEL] L'opération a échoué après l'écriture Firestore : ${report.error}`);
          } else {
            console.error(`\n[ÉCHEC] Le bootstrap a été interrompu : ${report.error}`);
          }
          process.exit(1);
        } else {
          console.log(`\n[SUCCÈS] Opération terminée avec succès en mode ${report.mode}.`);
          if (!isExecute) {
            console.log(`NOTE: Aucune écriture n'a été réalisée (mode dry-run par défaut).`);
            console.log(`Pour appliquer réellement les modifications, exécutez avec le flag : --execute\n`);
          }
          process.exit(0);
        }
      })
      .catch((err) => {
        console.error('\n[FATAL]', err);
        process.exit(1);
      });
  } catch (cliErr: any) {
    console.error(`\n[ERREUR CLI] ${cliErr.message}\n`);
    process.exit(1);
  }
}
