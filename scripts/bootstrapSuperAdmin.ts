/**
 * ORTHOGONAL PD&I STUDIO — SEC-01 / AUTH-ADMIN-05-FIX-06
 * Script de Bootstrap Super Admin sécurisé (Firebase Admin SDK).
 * 
 * Ce script est autonome, idempotent et strictement sécurisé :
 * - Cible exclusivement le projet Firebase 'graphical-router-x18qq' via adminAuth.app.options.projectId et getFirestoreProjectId(db).
 * - Autorise exclusivement l'adresse 'boudjada.youcef@gmail.com'.
 * - Contrôle le compte : existence, activation, vérification email (propriété native), présence du fournisseur 'google.com'.
 * - Interruption immédiate et sans écriture en cas d'erreur de lecture Firestore.
 * - FIX-06 B1 : Extraction temporelle stricte avec fuseau obligatoire, calendrier réel, fraction 1..9 chiffres max, décalages UTC validés.
 * - FIX-06 B2 : Filtrage récursif des données commerciales dans les tableaux historiques imbriqués (filterHistoricalValue).
 * - FIX-06 B3 : Validation stricte et croisée du projet Firestore (getFirestoreProjectId) et du projet Auth avant toute lecture.
 * - Fusion non destructive récursive avec préservation des objets imbriqués, tableaux et compteurs du profil cible.
 * - Ordre strict des écritures :
 *     1. Validation projet & compte
 *     2. Lecture des deux profils (interruption si erreur)
 *     3. Fusion non destructive protégée récursive
 *     4. Écriture du profil cible dans Firestore
 *     5. Relecture et vérification intégrale stricte du profil écrit (Correction B2 : bi-directionnelle,
 *        détection des champs inattendus supplémentaires, types Date / Timestamp Firestore exacts)
 *     6. Attribution du Custom Claim role: 'super_admin' (préservation de TOUS les autres claims)
 *     7. Relecture et vérification intégrale des Custom Claims
 * - Correction C : Tout échec survenant après l'écriture Firestore (étape 4) consigne impérativement un état partiel (partialState: true).
 * - Correction D : Entrée CLI robuste avec resolve / pathToFileURL : dry-run par défaut, --execute seul requis pour écrire,
 *   rejet strict des inconnus, positionnels et combinaisons d'options.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adminAuth, adminDb } from '../src/lib/firebase-admin.ts';

export const EXPECTED_PROJECT_ID = 'graphical-router-x18qq';
export const ALLOWED_SUPER_ADMIN_EMAIL = 'boudjada.youcef@gmail.com';
export const HISTORICAL_PROFILE_DOC_ID = 'superadmin-youcef-boudjada';

/**
 * B2 — Modèle commercial réel du projet Orthogonal PD&I Studio :
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
 * Correction B2 : Détermine si un champ relève des données commerciales protégées,
 * quel que soit son niveau de profondeur dans l'arborescence (racine ou imbriqué).
 */
export function isProtectedCommercialField(key: string, pathPrefix = ''): boolean {
  const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
  const segments = fullPath.toLowerCase().split('.');
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

export interface BootstrapReport {
  mode: 'dry-run' | 'execute';
  timestamp: string;
  projectId: string;
  email: string;
  uid?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  hasGoogleProvider?: boolean;
  existingClaims?: Record<string, any>;
  updatedClaims?: Record<string, any>;
  historicalProfileFound: boolean;
  targetProfileFound: boolean;
  conflictsDetected: Array<{ field: string; targetValue: any; historicalValue: any }>;
  fieldsRecoveredFromHistory: string[];
  finalProfileToSave?: Record<string, any>;
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
 * FIX-06 B1 — Extraction temporelle exacte sans perte de précision nanoseconde :
 * - Fuseau horaire obligatoire.
 * - Validation stricte du calendrier réel (jours par mois, années bissextiles).
 * - Fraction de seconde limitée à 9 chiffres maximum (rejet si >= 10 chiffres).
 * - Contrôle strict des décalages horaires (UTC -14:00 à +14:00).
 * - Détection sécurisée des Firestore Timestamps sans utilisation de toMillis/toDate.
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

    // Ne jamais utiliser toMillis()/toDate() : ces méthodes perdent les nanosecondes.
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
    // Fuseau obligatoire ; fraction limitée à 9 chiffres.
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

    // Date.parse fournit les secondes UTC ; la fraction est reconstruite à 9 chiffres.
    const secondsUtc = Math.floor(milliseconds / 1000);
    const nanoseconds = Number((fraction + '000000000').slice(0, 9));
    return { valid: true, type: 'iso_string', seconds: secondsUtc, nanoseconds };
  }

  return null;
}

/**
 * B1 — Vérification si une valeur est une entité temporelle reconnue.
 */
export function isDateOrFirestoreTimestamp(val: any): boolean {
  return extractExactTime(val) !== null;
}

/**
 * Normalisation milliseconde (fournie pour compatibilité ascendante).
 */
export function getNormalizedMillis(val: any): number {
  const t = extractExactTime(val);
  if (!t || !t.valid) return NaN;
  return t.seconds * 1000 + Math.floor(t.nanoseconds / 1_000_000);
}

/**
 * B1 — Comparaison temporelle exacte sans perte de précision nanoseconde :
 * 1. Deux Firestore Timestamps : égalité exacte des secondes et nanosecondes (1 ns de différence est rejetée).
 * 2. Deux Date JS : égalité exacte des millisecondes.
 * 3. Date vs Timestamp : acceptée UNIQUEMENT si le Timestamp représente exactement l'instant exprimable
 *    par la Date (nanosecondes = (ms % 1000) * 1_000_000). Toute précision supplémentaire entraîne un refus.
 * 4. Timestamp vs ISO : acceptée UNIQUEMENT si la chaîne représente exactement le même instant (s et ns identiques).
 * 5. Rejet systématique des dates invalides et timestamps malformés.
 */
export function areDatesOrTimestampsEqual(val1: any, val2: any): boolean {
  const t1 = extractExactTime(val1);
  const t2 = extractExactTime(val2);

  if (!t1 || !t2) return false;
  if (!t1.valid || !t2.valid) return false;

  return t1.seconds === t2.seconds && t1.nanoseconds === t2.nanoseconds;
}

/**
 * Détection si une valeur est un objet ordinaire (hors null, array, Date, Timestamp, etc.)
 */
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
 * Comparaison intégrale récursive stricte pour documents Firestore :
 * 1. Vérifie l'ensemble des champs attendus dans expected.
 * 2. Détecte impérativement les champs supplémentaires inattendus dans actual.
 * 3. Vérifie récursivement les objets imbriqués et tableaux.
 * 4. Distingue strictement les valeurs nulles, absentes et définies.
 * 5. Prend en charge les équivalences Date / Timestamp Firestore exactes (B1).
 * 6. Fournit des chemins de divergence explicites.
 */
export function deepCompareFirestoreData(expected: any, actual: any, path = ''): string[] {
  const diffs: string[] = [];

  // Égalité stricte de valeur ou référence primitive
  if (expected === actual) {
    return diffs;
  }

  // Équivalence temporelle exacte (Timestamp / Date / ISO)
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

  // Distinction stricte entre null, undefined (absent) et défini
  if (expected === null || expected === undefined || actual === null || actual === undefined) {
    if (expected !== actual) {
      const expDesc = expected === undefined ? 'absent' : JSON.stringify(expected);
      const actDesc = actual === undefined ? 'absent' : JSON.stringify(actual);
      diffs.push(`Champ '${path || 'root'}' non conforme (attendu: ${expDesc}, obtenu: ${actDesc})`);
    }
    return diffs;
  }

  // Comparaison des tableaux
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

  // Comparaison des objets ordinaires (bi-directionnelle complète)
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    // 1. Vérifier tous les champs attendus
    for (const key of expectedKeys) {
      const subPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        diffs.push(`Champ attendu manquant '${subPath}' (valeur attendue: ${JSON.stringify(expected[key])})`);
      } else {
        const subDiffs = deepCompareFirestoreData(expected[key], actual[key], subPath);
        diffs.push(...subDiffs);
      }
    }

    // 2. Détecter impérativement les champs supplémentaires inattendus
    for (const key of actualKeys) {
      const subPath = path ? `${path}.${key}` : key;
      if (!(key in expected)) {
        diffs.push(`Champ supplémentaire inattendu '${subPath}' (valeur non sollicitée: ${JSON.stringify(actual[key])})`);
      }
    }

    return diffs;
  }

  // Si l'un est objet et pas l'autre
  if (isPlainObject(expected) || isPlainObject(actual)) {
    diffs.push(`Type non conforme pour '${path || 'root'}' (attendu: ${typeof expected}, obtenu: ${typeof actual})`);
    return diffs;
  }

  // Scalaires discordants
  if (expected !== actual) {
    diffs.push(`Champ '${path || 'root'}' différent (attendu: ${JSON.stringify(expected)}, obtenu: ${JSON.stringify(actual)})`);
  }

  return diffs;
}

/**
 * FIX-06 B2 : Fusion récursive non destructive protégée :
 * - Priorité absolue aux champs, objets imbriqués et tableaux de targetData.
 * - Récupération des champs absents autorisés depuis historicalData.
 * - Protection commerciale récursive absolue à TOUS les niveaux de profondeur,
 *   y compris dans les tableaux historiques imbriqués (filterHistoricalValue).
 * - Préservation intégrale des tableaux existants dans targetData.
 * - Traçabilité et détection de tous les conflits.
 */
export function mergeProfileDataNonDestructive(
  realUid: string,
  targetProfileData: Record<string, any> | null,
  historicalProfileData: Record<string, any> | null
): {
  mergedData: Record<string, any>;
  conflicts: Array<{ field: string; targetValue: any; historicalValue: any }>;
  recoveredFields: string[];
} {
  const conflicts: Array<{ field: string; targetValue: any; historicalValue: any }> = [];
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
      const filtered: Record<string, any> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (isProtectedCommercialField(nestedKey, path)) continue;
        const nestedPath = path ? `${path}.${nestedKey}` : nestedKey;
        const safeValue = filterHistoricalValue(nestedValue, nestedPath);
        if (safeValue !== undefined) filtered[nestedKey] = safeValue;
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
    const result: Record<string, any> = target ? { ...target } : {};

    if (history) {
      for (const [key, histValue] of Object.entries(history)) {
        if (pathPrefix === '' && key === 'uid') continue; // L'UID réel sera prioritaire au niveau racine

        const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        const targetValue = target ? target[key] : undefined;

        // B2 : Protection commerciale récursive à tout niveau de profondeur
        if (isProtectedCommercialField(key, pathPrefix)) {
          if (targetValue !== undefined) {
            result[key] = targetValue;
            if (JSON.stringify(targetValue) !== JSON.stringify(histValue)) {
              conflicts.push({
                field: fieldPath,
                targetValue,
                historicalValue: histValue
              });
            }
          }
          // Si targetValue === undefined : NE JAMAIS IMPORTER DEPUIS L'HISTORIQUE !
          continue;
        }

        if (targetValue !== undefined) {
          // Si les deux sont des objets ordinaires, récursion
          if (isPlainObject(targetValue) && isPlainObject(histValue)) {
            result[key] = mergeRecursive(targetValue, histValue, fieldPath);
          } else if (Array.isArray(targetValue)) {
            if (JSON.stringify(targetValue) !== JSON.stringify(histValue)) {
              conflicts.push({
                field: fieldPath,
                targetValue,
                historicalValue: histValue
              });
            }
            result[key] = targetValue;
          } else {
            if (targetValue !== histValue) {
              conflicts.push({
                field: fieldPath,
                targetValue,
                historicalValue: histValue
              });
            }
            result[key] = targetValue;
          }
        } else {
          // Champ absent de la cible et non protégé :
          if (isPlainObject(histValue)) {
            const nestedMerged = mergeRecursive(null, histValue, fieldPath);
            if (nestedMerged && Object.keys(nestedMerged).length > 0) {
              result[key] = nestedMerged;
              recoveredFields.push(fieldPath);
            }
          } else if (Array.isArray(histValue)) {
            // FIX-06 B2 : Filtrer les champs commerciaux dans les tableaux historiques
            const safeArray = filterHistoricalValue(histValue, fieldPath);
            if (safeArray !== undefined) {
              result[key] = safeArray;
              recoveredFields.push(fieldPath);
            }
          } else {
            result[key] = histValue;
            recoveredFields.push(fieldPath);
          }
        }
      }
    }

    return result;
  }

  const mergedData = mergeRecursive(targetProfileData, historicalProfileData);
  mergedData.uid = realUid;

  return {
    mergedData,
    conflicts,
    recoveredFields
  };
}

/**
 * FIX-06 B3 — Résolveur fail-closed de l'ID du projet Firestore.
 * Récupère le projet configuré sur l'application Firebase Admin associée à Firestore.
 */
export function getFirestoreProjectId(firestoreInstance: any): string | null {
  const projectId = firestoreInstance?.app?.options?.projectId;
  return typeof projectId === 'string' && projectId.length > 0
    ? projectId
    : null;
}

/**
 * Analyse et validation stricte des arguments CLI :
 * - Démarre en dry-run par défaut (args vides).
 * - Accepte '--dry-run' seul.
 * - Accepte '--execute' uniquement lorsqu'il est seul.
 * - Refuse les arguments inconnus.
 * - Refuse les arguments positionnels.
 * - Refuse la combinaison '--execute --dry-run'.
 */
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

/**
 * Détection robuste de l'exécution CLI directe via node:path et node:url.
 * Empêche toute exécution lors de l'import du module dans les tests ou un autre script.
 */
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
 * B4 — Fonction maîtresse exécutant le bootstrap Super Admin :
 * 
 * COMPORTEMENT EN MODE DRY-RUN (--dry-run par défaut) :
 * 1. Opérations Auth effectuées : LECTURE SEULE via getUserByEmail(targetEmail) pour valider existence,
 *    emailVerified natif, état actif, provider google.com et inspection des customClaims actuels.
 *    AUCUN appel à setCustomUserClaims() n'est effectué.
 * 2. Lectures Firestore effectuées : LECTURE SEULE via historicalDocRef.get() et targetDocRef.get().
 * 3. Opérations Firestore STRICTEMENT INTERDITES en dry-run : AUCUN set(), AUCUN delete(), AUCUN update().
 * 4. Modifications Custom Claims STRICTEMENT INTERDITES en dry-run : AUCUNE mutation.
 * 5. Traitement en mémoire : Simulation complète de la fusion non destructive, détection des conflits
 *    et génération du rapport d'audit exhaustif avec profileWritten: false et claimsUpdated: false.
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
    // FIX-06 B3 : Contrôle strict, croisé et exclusif des projets Auth et Firestore avant toute lecture
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
    report.emailVerified = userRecord.emailVerified === true;
    report.disabled = userRecord.disabled === true;

    if (report.disabled) {
      throw new Error(`[COMPTE DÉSACTIVÉ] Le compte Firebase Auth pour ${targetEmail} est désactivé.`);
    }

    if (!report.emailVerified) {
      throw new Error(`[EMAIL NON VÉRIFIÉ] Le compte Firebase Auth pour ${targetEmail} n'a pas son email vérifié (email_verified != true).`);
    }

    const providerIds = (userRecord.providerData || []).map((p: any) => p.providerId);
    report.hasGoogleProvider = providerIds.includes('google.com');
    if (!report.hasGoogleProvider) {
      throw new Error(`[FOURNISSEUR INVALIDE] Le compte ${targetEmail} n'est pas associé au fournisseur d'identité 'google.com' (providers: ${providerIds.join(', ')}).`);
    }

    report.existingClaims = { ...(userRecord.customClaims || {}) };
    report.updatedClaims = {
      ...report.existingClaims,
      role: 'super_admin'
    };

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

    // 5. Construction et validation de la fusion non destructive protégée (B2)
    const mergeResult = mergeProfileDataNonDestructive(userRecord.uid, targetData, historicalData);
    report.conflictsDetected = mergeResult.conflicts;
    report.fieldsRecoveredFromHistory = mergeResult.recoveredFields;
    report.finalProfileToSave = mergeResult.mergedData;

    // 6. Exécution sécurisée conditionnée au mode --execute (strictement ignorée en dry-run)
    if (isExecute) {
      // Étape 6.1 : Écriture du profil cible dans Firestore
      try {
        await targetDocRef.set(report.finalProfileToSave, { merge: true });
        report.profileWritten = true;
      } catch (err: any) {
        throw new Error(`[ÉCHEC ÉCRITURE FIRESTORE] Impossible d'écrire le profil cible : ${err?.message || err}`);
      }

      // Étape 6.2 : Relire et vérifier intégralement le profil écrit dans Firestore (B1 & B2)
      try {
        const reloadedDoc = await targetDocRef.get();
        if (!reloadedDoc.exists) {
          throw new Error("Le document de profil cible est introuvable après écriture.");
        }
        const reloadedData = reloadedDoc.data();
        if (reloadedData?.uid !== userRecord.uid) {
          throw new Error(`L'UID du profil relu ('${reloadedData?.uid}') ne correspond pas à l'UID réel ('${userRecord.uid}').`);
        }

        // Vérification intégrale récursive bi-directionnelle avec précision nanoseconde exacte
        const diffs = deepCompareFirestoreData(report.finalProfileToSave, reloadedData);
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
        await authSdk.setCustomUserClaims(userRecord.uid, report.updatedClaims);
        report.claimsUpdated = true;
      } catch (err: any) {
        report.partialState = true;
        throw new Error(`[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS échec de l'attribution des Custom Claims : ${err?.message || err}`);
      }

      // Étape 6.4 : Relire et vérifier les Custom Claims
      try {
        const reloadedUser = await authSdk.getUser(userRecord.uid);
        if (reloadedUser.customClaims?.role !== 'super_admin') {
          throw new Error("Le claim 'role: super_admin' est absent après enregistrement.");
        }
        for (const [claimKey, expectedVal] of Object.entries(report.updatedClaims || {})) {
          if (JSON.stringify(reloadedUser.customClaims?.[claimKey]) !== JSON.stringify(expectedVal)) {
            throw new Error(`Le claim '${claimKey}' relu est non conforme (attendu: ${JSON.stringify(expectedVal)}, obtenu: ${JSON.stringify(reloadedUser.customClaims?.[claimKey])}).`);
          }
        }
        report.claimsVerified = true;
      } catch (err: any) {
        report.partialState = true;
        throw new Error(`[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS échec de la relecture des Custom Claims : ${err?.message || err}`);
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
