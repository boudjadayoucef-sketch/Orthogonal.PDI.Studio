/**
 * ORTHOGONAL PD&I STUDIO — SEC-01 / AUTH-ADMIN-05-FIX-08-R1
 * Script de Bootstrap Super Admin sécurisé (Firebase Admin SDK).
 * 
 * Ce script est autonome, idempotent et strictement sécurisé :
 * - Cible exclusivement le projet Firebase 'graphical-router-x18qq' via adminAuth.app.options.projectId et getFirestoreProjectId(db).
 * - Autorise exclusivement l'adresse 'boudjada.youcef@gmail.com'.
 * - Contrôle le compte : existence, activation stricte (disabled === false), vérification email (emailVerified === true), fournisseur 'google.com'.
 * - FIX-08-R1-A : Élimination absolue des messages d'erreur SDK bruts, stacks et payloads dans BootstrapReport, report.error,
 *   les exceptions levées et les logs CLI. Normalisation centralisée avec sanitizeReportErrorMessage() et codes d'erreur strictement validés.
 * - FIX-08-R1-B : Élimination de l'opérateur 'in' dans extractExactTime() au profit exclusif de Object.prototype.hasOwnProperty.call().
 *   Rejet strict des propriétés temporelles héritées, préservation de la précision nanoseconde.
 * - FIX-08-A : Suppression totale des valeurs sensibles, dates, timestamps et données brutes dans compareClaimsStructural et deepCompareFirestoreData.
 * - FIX-08-B : Remplacement strict de l'opérateur 'in' par Object.prototype.hasOwnProperty.call() pour n'évaluer que les propriétés propres.
 * - FIX-08-C : Détection exacte de isDangerousKey sans rejeter les propriétés légitimes cibles (constructorName, prototypeVersion),
 *   safeDefineProperty sécurisée avec Object.defineProperty, préservation des propriétés propres cibles.
 * - FIX-08-D : Retrait d'email et uid de BootstrapReport et des logs de sortie (traitement mémoire interne préservé).
 * - FIX-07-A : Échec ambigu de l'écriture Firestore : encadrement spécifique, relecture diagnostique, comparaison intégrale,
 *   signalement partialState: true, refus de retry automatique, interdiction stricte de poursuivre vers les Custom Claims.
 * - FIX-07-B & FIX-07-G : Vérification structurelle récursive des Custom Claims : indépendante de l'ordre JSON, détection des clés manquantes/inattendues.
 * - FIX-07-C : Exclusion absolue des champs d'autorisation historiques à tous les niveaux.
 * - FIX-07-D : Validation stricte du compte désactivé (userRecord.disabled === false impératif, fail-closed).
 * - FIX-07-E : Réduction des données exposées dans les rapports : finalProfileToSave retiré du rapport, conflits sans valeurs brutes.
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
 * FIX-08-R2-B1 — Liste blanche fermée et stricte des codes d'erreur SDK Firebase autorisés.
 * Rejette toute chaîne externe non reconnue, sentinelle, email, UID ou jeton arbitraire.
 */
export const ALLOWED_SDK_ERROR_CODES = new Set<string>([
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/invalid-email',
  'auth/operation-not-allowed',
  'auth/invalid-credential',
  'unavailable',
  'permission-denied',
  'deadline-exceeded',
  'internal',
  'resource-exhausted',
  'resource_exhausted',
  'not-found',
  'already-exists',
  'cancelled',
  'invalid-argument',
  'failed-precondition',
  'aborted',
  'out-of-range',
  'unimplemented',
  'unauthenticated'
]);

/**
 * FIX-08-R2-B1 — Validation strictement fail-closed d'un code d'erreur SDK.
 * Ne retourne JAMAIS de chaîne arbitraire. Retourne undefined si non présent dans la liste blanche.
 */
export function sanitizeSdkErrorCode(code: any): string | undefined {
  if (typeof code !== 'string') return undefined;
  const normalized = code.trim().toLowerCase();
  if (ALLOWED_SDK_ERROR_CODES.has(normalized)) {
    return normalized;
  }
  return undefined;
}

export function formatSanitizedErrorCode(code: any): string {
  const sanitized = sanitizeSdkErrorCode(code);
  return sanitized ? ` (code: ${sanitized})` : '';
}

/**
 * FIX-08-R4-B3.2 — Registre privé WeakMap pour l'authentification non forgeable des erreurs internes.
 * Aucune propriété n'est attachée à l'instance (ni symbole inspectable, ni code lisible).
 */
const INTERNAL_ERROR_REGISTRY = new WeakMap<object, string>();

export const GENERIC_EXTERNAL_ERROR =
  'Une erreur externe est survenue. Consultez le diagnostic sécurisé.';

/**
 * FIX-08-R4-B3.1 — Dictionnaire privé et immuable des 24 messages internes autorisés.
 * Non exporté et gelé par Object.freeze() pour interdire toute modification à l'exécution.
 * Aucun message n'est une donnée libre, aucun argument ni identifiant externe n'est interpolé.
 */
const SAFE_INTERNAL_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  CLI_POSITIONAL_ARG:
    'Argument positionnel non autorisé.',
  CLI_UNKNOWN_ARG:
    'Argument CLI non reconnu.',
  CLI_MUTUALLY_EXCLUSIVE:
    'Options CLI incompatibles.',
  CLI_EXECUTE_NOT_ALONE:
    "L'option execute doit être fournie seule.",
  CLI_DRYRUN_REPEATED:
    "L'option dry-run ne doit pas être répétée.",
  FUSION_NO_PROFILE:
    "[ERREUR FUSION] Impossible d'effectuer la fusion : aucun profil cible ni profil historique n'a été trouvé.",
  PROJECT_MISMATCH:
    "[BLOCAGE PROJET] Projet Auth/Firestore non autorisé ou non vérifiable. Attendu='graphical-router-x18qq'.",
  EMAIL_MISMATCH:
    "[BLOCAGE EMAIL] L'adresse email fournie n'est pas autorisée pour le bootstrap Super Admin.",
  USER_NOT_FOUND:
    '[COMPTE INTROUVABLE] Aucun utilisateur Firebase Auth pour le compte cible.',
  ACCOUNT_DISABLED:
    '[COMPTE DÉSACTIVÉ] Le compte Firebase Auth cible n\'est pas explicitement actif (disabled attendu strictement à false).',
  EMAIL_NOT_VERIFIED:
    '[EMAIL NON VÉRIFIÉ] Le compte Firebase Auth cible n\'a pas son email vérifié (emailVerified attendu strictement à true).',
  INVALID_PROVIDER:
    "[FOURNISSEUR INVALIDE] Le compte cible n'est pas associé au fournisseur d'identité 'google.com'.",
  HISTORICAL_READ_FAILED:
    '[ERREUR LECTURE FIRESTORE] Échec de la lecture du profil historique.',
  TARGET_READ_FAILED:
    '[ERREUR LECTURE FIRESTORE] Échec de la lecture du profil cible.',
  PARTIAL_WRITE_MANUAL_INTERVENTION_REQUIRED:
    "[ÉTAT PARTIEL - INTERVENTION REQUISE] L'écriture Firestore targetDocRef.set() a levé une exception, mais la relecture diagnostique constate que les données attendues ont bien été enregistrées. Une intervention manuelle est requise avant toute modification de Custom Claims.",
  PARTIAL_AMBIGUOUS_WRITE_FAILED:
    "[ÉTAT PARTIEL - ÉCHEC ÉCRITURE AMBIGU] L'écriture Firestore targetDocRef.set() a échoué et la relecture diagnostique n'a pas pu certifier l'état final. Arrêt immédiat sans modification de Custom Claims.",
  PROFILE_NOT_FOUND_AFTER_WRITE:
    '[ÉTAT PARTIEL] Profil Firestore écrit, MAIS le document de profil cible est introuvable après écriture.',
  PROFILE_UID_MISMATCH:
    "[ÉTAT PARTIEL] Profil Firestore écrit, MAIS l'UID du profil relu ne correspond pas à l'UID réel attendu.",
  PROFILE_STRUCTURAL_DIFF:
    '[ÉTAT PARTIEL] Profil Firestore écrit, MAIS Divergence structurelle du profil relu.',
  PROFILE_VERIFICATION_FAILED:
    '[ÉTAT PARTIEL] Profil Firestore écrit, MAIS échec de la relecture/vérification du profil.',
  CLAIMS_UPDATE_FAILED:
    "[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS échec de l'attribution des Custom Claims.",
  ROLE_CLAIM_MISSING:
    "[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS le claim 'role: super_admin' est absent après enregistrement.",
  CLAIMS_STRUCTURAL_DIFF:
    '[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS Divergence structurelle des Custom Claims relus.',
  CLAIMS_VERIFICATION_FAILED:
    "[ÉTAT PARTIEL] Profil Firestore écrit et vérifié, MAIS échec de la relecture/vérification des Custom Claims."
});

/**
 * FIX-08-R4-B3.2 / B3.3 — Classe d'erreur interne non exportée.
 * Enregistrée exclusivement dans le WeakMap privé du module.
 * Ne stocke aucun code ni message libre sur l'instance.
 */
class InternalBootstrapError extends Error {
  constructor(safeCode: string) {
    const message = Object.prototype.hasOwnProperty.call(SAFE_INTERNAL_MESSAGES, safeCode)
      ? SAFE_INTERNAL_MESSAGES[safeCode]
      : GENERIC_EXTERNAL_ERROR;
    super(message);
    this.name = 'InternalBootstrapError';
    Object.setPrototypeOf(this, InternalBootstrapError.prototype);
    INTERNAL_ERROR_REGISTRY.set(this, safeCode);
  }
}

/**
 * FIX-08-R4-B3.3 — Vérifie si une erreur est une erreur interne authentifiée
 * via l'appartenance au registre privé WeakMap.
 */
export function isInternalBootstrapError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && INTERNAL_ERROR_REGISTRY.has(error);
}

/**
 * FIX-08-R4-B3.3 — Extrait le message sécurisé constant d'une erreur interne authentifiée.
 * Récupère le code via le WeakMap privé et résout dans le dictionnaire privé gelé.
 * Ne lit AUCUNE propriété sur l'objet d'erreur (aucun getter ne peut être déclenché).
 */
export function getSafeInternalMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && INTERNAL_ERROR_REGISTRY.has(error)) {
    const code = INTERNAL_ERROR_REGISTRY.get(error);
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(SAFE_INTERNAL_MESSAGES, code)) {
      return SAFE_INTERNAL_MESSAGES[code];
    }
  }
  return GENERIC_EXTERNAL_ERROR;
}

/**
 * FIX-08-R4-B3.3 — Normalisation centralisée des erreurs de bootstrap :
 * Utilise EXCLUSIVEMENT le dictionnaire fermé de messages constants pour les erreurs internes authentifiées.
 * Neutralise toutes les autres erreurs vers GENERIC_EXTERNAL_ERROR sans jamais lire err.message ou d'autres propriétés.
 */
export function sanitizeReportErrorMessage(err: unknown): string {
  if (!err) return GENERIC_EXTERNAL_ERROR;
  return getSafeInternalMessage(err);
}

/**
 * FIX-08-C — Liste exacte des clés dangereuses pour prévenir la pollution de prototype.
 */
export const DANGEROUS_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);

/**
 * FIX-08-C — Détection exacte des clés interdites d'importation historique.
 */
export function isDangerousKey(key: string): boolean {
  if (typeof key !== 'string') return true;
  return DANGEROUS_OBJECT_KEYS.has(key);
}

/**
 * FIX-07-F — Création sécurisée d'un objet ordinaire compatible Firestore.
 */
export function createSafePlainObject(): Record<string, any> {
  return Object.create(Object.prototype);
}

/**
 * FIX-08-C — Affectation sécurisée sans déclencher de setter prototype.
 */
export function safeDefineProperty(
  target: Record<string, any>,
  key: string,
  value: any
): void {
  if (typeof key !== 'string') return;

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
 * FIX-08-D — Rapport de bootstrap assaini, sans email ni uid ni données sensibles.
 */
export interface BootstrapReport {
  mode: 'dry-run' | 'execute';
  timestamp: string;
  projectId: string;
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

export type SafePropertyInspection =
  | { kind: 'missing' }
  | { kind: 'data'; value: unknown }
  | { kind: 'accessor' }
  | { kind: 'inherited' };

/**
 * FIX-08-R3-B2 — Inspection d'une propriété propre sans risque de déclencher de getter.
 */
export function inspectOwnDataProperty(
  value: object,
  property: string
): SafePropertyInspection {
  if (!value || typeof value !== 'object') {
    return { kind: 'missing' };
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    return { kind: 'accessor' };
  }
  return {
    kind: 'data',
    value: descriptor.value
  };
}

/**
 * FIX-08-R3-B2 — Vérifie la présence d'une propriété dans la chaîne de prototypes sans jamais invoquer de getter hérité.
 */
export function hasInheritedPropertyWithoutReading(
  value: object,
  property: string
): boolean {
  if (!value || typeof value !== 'object') return false;
  let prototype = Object.getPrototypeOf(value);
  while (prototype !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (descriptor !== undefined) {
      return true;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return false;
}

/**
 * FIX-08-R3-B2 — Inspection sécurisée complète (propre et héritée) pour une propriété temporelle.
 */
export function inspectSafeTimeProperty(
  value: object,
  property: string
): SafePropertyInspection {
  const own = inspectOwnDataProperty(value, property);
  if (own.kind !== 'missing') {
    return own;
  }
  if (hasInheritedPropertyWithoutReading(value, property)) {
    return { kind: 'inherited' };
  }
  return { kind: 'missing' };
}

/**
 * FIX-08-R5-B2 — Références natives capturées au chargement du module.
 * Ne jamais appeler val.getTime() : cette propriété peut être contrôlée
 * par un getter propre ou hérité.
 */
const SAFE_DATE_GET_TIME = Date.prototype.getTime;
const SAFE_REFLECT_APPLY = Reflect.apply;

export const TIME_PROPERTIES = [
  'seconds',
  '_seconds',
  'nanoseconds',
  '_nanoseconds',
  'toDate',
  'toMillis'
] as const;

export function hasOwnDataProperty(value: object, property: string): boolean {
  return inspectOwnDataProperty(value, property).kind === 'data';
}

export function getOwnDataPropertyValue(value: object, property: string): any {
  const insp = inspectOwnDataProperty(value, property);
  return insp.kind === 'data' ? insp.value : undefined;
}

export function hasOwnAccessorProperty(value: object, property: string): boolean {
  return inspectOwnDataProperty(value, property).kind === 'accessor';
}

/**
 * FIX-08-R3-B2 — Extraction temporelle exacte sécurisée :
 * Utilise exclusivement les descripteurs de propriétés, inspecte TIME_PROPERTIES sans
 * jamais déclencher de getter hérité ou propre, et préserve la précision nanoseconde.
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

  if (typeof val === 'object') {
    // 1. FIX-08-R4-B2 — Inspection sécurisée stricte sans exécution de getters pour toutes les TIME_PROPERTIES
    // Exécutée AVANT toute acceptation d'instance de Date ou Timestamp
    const inspections: Record<string, SafePropertyInspection> = {};

    for (const prop of TIME_PROPERTIES) {
      const insp = inspectSafeTimeProperty(val, prop);
      inspections[prop] = insp;

      if (insp.kind === 'accessor') {
        return {
          valid: false,
          type: 'timestamp',
          seconds: NaN,
          nanoseconds: NaN,
          error: 'Propriétés temporelles par getter/setter non autorisées'
        };
      }

      if (insp.kind === 'inherited') {
        return {
          valid: false,
          type: 'timestamp',
          seconds: NaN,
          nanoseconds: NaN,
          error: 'Propriétés temporelles héritées non autorisées'
        };
      }
    }

    // 2. FIX-08-R5-B2 — Instance de Date acceptée uniquement après validation stricte des TIME_PROPERTIES
    // et évaluation sécurisée via la référence native capturée SAFE_DATE_GET_TIME
    if (val instanceof Date) {
      let milliseconds: number;

      try {
        milliseconds = SAFE_REFLECT_APPLY(
          SAFE_DATE_GET_TIME,
          val,
          []
        ) as number;
      } catch {
        return {
          valid: false,
          type: 'date',
          seconds: NaN,
          nanoseconds: NaN,
          error: 'Date invalide'
        };
      }

      return fromMilliseconds(milliseconds, 'date');
    }

    // 3. Propriétés de données propres uniquement
    const secInsp = inspections['seconds'];
    const uSecInsp = inspections['_seconds'];
    const nsInsp = inspections['nanoseconds'];
    const uNsInsp = inspections['_nanoseconds'];

    const hasAnySeconds = secInsp.kind === 'data' || uSecInsp.kind === 'data';
    const hasAnyNanoseconds = nsInsp.kind === 'data' || uNsInsp.kind === 'data';

    if (hasAnySeconds || hasAnyNanoseconds) {
      const rawSec = secInsp.kind === 'data' ? secInsp.value : (uSecInsp.kind === 'data' ? uSecInsp.value : undefined);
      const rawNs = nsInsp.kind === 'data' ? nsInsp.value : (uNsInsp.kind === 'data' ? uNsInsp.value : undefined);

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

    // 3. Inspection toDate / toMillis data sans JAMAIS les invoquer
    const toDateInsp = inspections['toDate'];
    const toMillisInsp = inspections['toMillis'];
    if (
      (toDateInsp.kind === 'data' && typeof toDateInsp.value === 'function') ||
      (toMillisInsp.kind === 'data' && typeof toMillisInsp.value === 'function')
    ) {
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
 * FIX-08-R3-B3 — Comparaison structurelle récursive des Custom Claims :
 * - Aucune valeur sensible brute dans les messages de diagnostic.
 * - Aucune interpolation de clés ou de chemins non fiables dans les diagnostics.
 * - Utilisation stricte de Object.prototype.hasOwnProperty.call() pour ignorer les propriétés de prototype.
 * - Mêmes clés propres, mêmes types et valeurs, positions de tableau ordonnées.
 * - Indépendante de l'ordre d'énumération des clés d'objets.
 */
export function compareClaimsStructural(expected: any, actual: any, _path = ''): string[] {
  const diffs: string[] = [];

  if (expected === actual) {
    return diffs;
  }

  const isExpNullOrUndef = expected === null || expected === undefined;
  const isActNullOrUndef = actual === null || actual === undefined;
  if (isExpNullOrUndef || isActNullOrUndef) {
    if (expected !== actual) {
      diffs.push('Claim non conforme : valeur absente ou différente.');
    }
    return diffs;
  }

  const expType = typeof expected;
  const actType = typeof actual;
  if (expType !== actType) {
    diffs.push('Type de claim non conforme.');
    return diffs;
  }

  const isExpArr = Array.isArray(expected);
  const isActArr = Array.isArray(actual);
  if (isExpArr || isActArr) {
    if (!isExpArr || !isActArr) {
      diffs.push('Type de claim non conforme.');
      return diffs;
    }
    if (expected.length !== actual.length) {
      diffs.push('Longueur de tableau de claims non conforme.');
      return diffs;
    }
    for (let i = 0; i < expected.length; i++) {
      diffs.push(...compareClaimsStructural(expected[i], actual[i]));
    }
    return diffs;
  }

  if (expType === 'object') {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    // FIX-08-B : Vérification stricte via hasOwnProperty (aucune propriété de prototype admise)
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        diffs.push('Claim attendu manquant.');
      } else {
        diffs.push(...compareClaimsStructural(expected[key], actual[key]));
      }
    }

    for (const key of actualKeys) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) {
        diffs.push('Claim supplémentaire inattendu.');
      }
    }

    return diffs;
  }

  if (expected !== actual) {
    diffs.push('Claim non conforme : valeur différente.');
  }

  return diffs;
}

/**
 * FIX-08-R3-B3 — Comparaison intégrale récursive stricte pour documents Firestore :
 * - Aucune valeur sensible brute, ni date, ni timestamp interpolé dans les messages d'erreur.
 * - Aucune clé ni chemin interpolé dans les messages de diagnostic.
 * - Utilisation stricte de Object.prototype.hasOwnProperty.call() pour les propriétés propres.
 */
export function deepCompareFirestoreData(expected: any, actual: any, _path = ''): string[] {
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
    diffs.push('Horodatage non conforme : instant divergent ou format invalide.');
    return diffs;
  }

  if (expected === null || expected === undefined || actual === null || actual === undefined) {
    if (expected !== actual) {
      diffs.push('Champ non conforme : valeur absente ou différente.');
    }
    return diffs;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push('Type non conforme.');
      return diffs;
    }
    if (expected.length !== actual.length) {
      diffs.push('Tableau de taille différente.');
      return diffs;
    }
    for (let i = 0; i < expected.length; i++) {
      const subDiffs = deepCompareFirestoreData(expected[i], actual[i]);
      diffs.push(...subDiffs);
    }
    return diffs;
  }

  if (Array.isArray(actual)) {
    diffs.push('Type non conforme.');
    return diffs;
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    // FIX-08-B : Vérification des propriétés propres uniquement
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        diffs.push('Champ attendu manquant.');
      } else {
        const subDiffs = deepCompareFirestoreData(expected[key], actual[key]);
        diffs.push(...subDiffs);
      }
    }

    for (const key of actualKeys) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) {
        diffs.push('Champ supplémentaire inattendu.');
      }
    }

    return diffs;
  }

  if (isPlainObject(expected) || isPlainObject(actual)) {
    diffs.push('Type non conforme.');
    return diffs;
  }

  if (expected !== actual) {
    diffs.push('Champ non conforme : valeur différente.');
  }

  return diffs;
}

/**
 * FIX-08-C : Fusion récursive non destructive protégée :
 * - Priorité absolue aux champs, objets imbriqués et tableaux de targetData.
 * - Les propriétés propres déjà présentes dans la cible sont intégralement préservées.
 * - Les clés dangereuses provenant du profil historique restent strictement exclues.
 * - Exclusion absolue des champs d'autorisation et des données commerciales depuis l'historique.
 * - Résumé non sensible des conflits (ConflictSummary sans valeurs brutes).
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
    throw new InternalBootstrapError('FUSION_NO_PROFILE');
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
        // FIX-08-C : Exclusion stricte des clés dangereuses historiques
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

    // FIX-08-C : Copier toutes les propriétés propres de target
    if (target && isPlainObject(target)) {
      for (const tKey of Object.getOwnPropertyNames(target)) {
        safeDefineProperty(result, tKey, target[tKey]);
      }
    }

    if (history && isPlainObject(history)) {
      for (const [key, histValue] of Object.entries(history)) {
        // FIX-08-C : Rejet strict des clés dangereuses historiques
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
      throw new InternalBootstrapError('CLI_POSITIONAL_ARG');
    }
  }

  const allowedFlags = new Set(['--execute', '--dry-run']);
  for (const arg of argv) {
    if (!allowedFlags.has(arg)) {
      throw new InternalBootstrapError('CLI_UNKNOWN_ARG');
    }
  }

  const hasExecute = argv.includes('--execute');
  const hasDryRun = argv.includes('--dry-run');

  if (hasExecute && hasDryRun) {
    throw new InternalBootstrapError('CLI_MUTUALLY_EXCLUSIVE');
  }

  if (hasExecute) {
    if (argv.length !== 1) {
      throw new InternalBootstrapError('CLI_EXECUTE_NOT_ALONE');
    }
    return { isExecute: true };
  }

  if (hasDryRun) {
    if (argv.length !== 1) {
      throw new InternalBootstrapError('CLI_DRYRUN_REPEATED');
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

  // FIX-08-D : Ni email ni uid dans le rapport final exposé
  const report: BootstrapReport = {
    mode: isExecute ? 'execute' : 'dry-run',
    timestamp: new Date().toISOString(),
    projectId: authProjectId || firestoreProjectId || '',
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
      throw new InternalBootstrapError('PROJECT_MISMATCH');
    }

    // 2. Contrôle strict de l'adresse email autorisée
    if (targetEmail !== ALLOWED_SUPER_ADMIN_EMAIL) {
      throw new InternalBootstrapError('EMAIL_MISMATCH');
    }

    // 3. Récupération et contrôle strict du compte Firebase Auth (Lecture seule)
    let userRecord: any;
    try {
      userRecord = await authSdk.getUserByEmail(targetEmail);
    } catch {
      throw new InternalBootstrapError('USER_NOT_FOUND');
    }

    // FIX-07-D : Validation stricte du compte désactivé (userRecord.disabled === false impératif, fail-closed)
    if (userRecord.disabled !== false) {
      report.disabled = userRecord.disabled === true ? true : undefined;
      throw new InternalBootstrapError('ACCOUNT_DISABLED');
    }
    report.disabled = false;

    // Validation stricte de l'email vérifié
    if (userRecord.emailVerified !== true) {
      report.emailVerified = userRecord.emailVerified === true;
      throw new InternalBootstrapError('EMAIL_NOT_VERIFIED');
    }
    report.emailVerified = true;

    const providerIds = (userRecord.providerData || []).map((p: any) => p.providerId);
    report.hasGoogleProvider = providerIds.includes('google.com');
    if (!report.hasGoogleProvider) {
      throw new InternalBootstrapError('INVALID_PROVIDER');
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
    } catch {
      throw new InternalBootstrapError('HISTORICAL_READ_FAILED');
    }

    try {
      const targetSnap = await targetDocRef.get();
      if (targetSnap.exists) {
        targetData = targetSnap.data();
        report.targetProfileFound = true;
      }
    } catch {
      throw new InternalBootstrapError('TARGET_READ_FAILED');
    }

    // 5. Construction et validation de la fusion non destructive protégée (FIX-07-C & FIX-08-C)
    const mergeResult = mergeProfileDataNonDestructive(userRecord.uid, targetData, historicalData);
    report.conflictsDetected = mergeResult.conflicts;
    report.fieldsRecoveredFromHistory = mergeResult.recoveredFields;

    // FIX-07-E : Le profil final reste dans une variable locale, JAMAIS exposé dans le rapport
    const finalProfileToSave = mergeResult.mergedData;

    // 6. Exécution sécurisée conditionnée au mode --execute (strictement ignorée en dry-run)
    if (isExecute) {
      // Étape 6.1 : Écriture du profil cible dans Firestore avec gestion d'échec ambigu (FIX-07-A & FIX-08-R1-A)
      try {
        await targetDocRef.set(finalProfileToSave, { merge: true });
        report.profileWritten = true;
      } catch {
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
          throw new InternalBootstrapError('PARTIAL_WRITE_MANUAL_INTERVENTION_REQUIRED');
        } else {
          throw new InternalBootstrapError('PARTIAL_AMBIGUOUS_WRITE_FAILED');
        }
      }

      // Étape 6.2 : Relire et vérifier intégralement le profil écrit dans Firestore
      try {
        const reloadedDoc = await targetDocRef.get();
        if (!reloadedDoc.exists) {
          throw new InternalBootstrapError('PROFILE_NOT_FOUND_AFTER_WRITE');
        }
        const reloadedData = reloadedDoc.data();
        if (reloadedData?.uid !== userRecord.uid) {
          throw new InternalBootstrapError('PROFILE_UID_MISMATCH');
        }

        const diffs = deepCompareFirestoreData(finalProfileToSave, reloadedData);
        if (diffs.length > 0) {
          throw new InternalBootstrapError('PROFILE_STRUCTURAL_DIFF');
        }

        report.profileVerified = true;
      } catch (err: any) {
        report.partialState = true;
        // FIX-08-R3-B3 : Relayer uniquement nos erreurs internes authentifiées
        if (isInternalBootstrapError(err)) {
          throw err;
        }
        throw new InternalBootstrapError('PROFILE_VERIFICATION_FAILED');
      }

      // Étape 6.3 : Ajouter le Custom Claim role: 'super_admin' (après vérification Firestore réussie)
      try {
        await authSdk.setCustomUserClaims(userRecord.uid, expectedClaims);
        report.claimsUpdated = true;
      } catch {
        report.partialState = true;
        throw new InternalBootstrapError('CLAIMS_UPDATE_FAILED');
      }

      // Étape 6.4 : Relire et vérifier intégralement les Custom Claims (FIX-07-B, FIX-07-G & FIX-08-A)
      try {
        const reloadedUser = await authSdk.getUser(userRecord.uid);
        const actualClaims = reloadedUser?.customClaims || {};

        if (actualClaims.role !== 'super_admin') {
          throw new InternalBootstrapError('ROLE_CLAIM_MISSING');
        }

        const claimDiffs = compareClaimsStructural(expectedClaims, actualClaims);
        if (claimDiffs.length > 0) {
          throw new InternalBootstrapError('CLAIMS_STRUCTURAL_DIFF');
        }

        report.claimsVerified = true;
      } catch (err: any) {
        report.partialState = true;
        // FIX-08-R3-B3 : Relayer uniquement nos erreurs internes authentifiées
        if (isInternalBootstrapError(err)) {
          throw err;
        }
        throw new InternalBootstrapError('CLAIMS_VERIFICATION_FAILED');
      }
    }

    report.success = true;
    return report;
  } catch (err: any) {
    if (report.profileWritten && (!report.profileVerified || !report.claimsUpdated || !report.claimsVerified)) {
      report.partialState = true;
    }
    report.success = false;
    // FIX-08-R3-B3 : Assainissement centralisé sans fuite de message brut
    report.error = sanitizeReportErrorMessage(err);
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
        // FIX-08-R1-A : Aucun objet d'erreur brut imprimé dans la sortie
        console.error(`\n[FATAL] Échec critique non géré durant le bootstrap Super Admin${formatSanitizedErrorCode(err?.code)}.\n`);
        process.exit(1);
      });
  } catch (cliErr: any) {
    // FIX-08-R1-A : Assainissement du message CLI
    console.error(`\n[ERREUR CLI] ${sanitizeReportErrorMessage(cliErr)}\n`);
    process.exit(1);
  }
}
