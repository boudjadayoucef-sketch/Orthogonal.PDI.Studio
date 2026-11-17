/**
 * ORTHOGONAL PD&I STUDIO — SEC-01 / AUTH-ADMIN-05-FIX-10-R1
 * Script de Bootstrap Super Admin sécurisé Zero-Trust (Firebase Admin SDK).
 *
 * Ce script est autonome, idempotent et strictement sécurisé (Zero-Trust) :
 * - Cible exclusivement le projet Firebase 'graphical-router-x18qq' via adminAuth.app.options.projectId et getFirestoreProjectId(db).
 * - Autorise exclusivement l'adresse 'boudjada.youcef@gmail.com' (comparaison insensible à la casse).
 * - Exige simultanément : emailVerified === true, disabled === false, providerData contenant 'google.com',
 *   et UID strictement égal à EXPECTED_SUPER_ADMIN_UID configuré indépendamment (jamais déduit de l'email).
 * - Exige une preuve d'autorisation préexistante vérifiée :
 *   A. Profil cible profiles/{uid} existant avec status === 'active' et role === 'super_admin' (et email conforme).
 *   B. Profil historique profiles/superadmin-youcef-boudjada vérifié avec email identique à l'email Auth,
 *      role === 'super_admin', status === 'active', et (s'il est présent) uid === HISTORICAL_PROFILE_DOC_ID.
 * - Retourne NO_VERIFIED_AUTHORIZATION_PROOF si aucune preuve valable n'existe. Ne fabrique jamais un profil Super Admin actif.
 * - R2 (FIX-10-R1) : Vérifie la cohérence de historicalProfileData.uid avec HISTORICAL_PROFILE_DOC_ID s'il est défini,
 *   refuse toute valeur contradictoire (HISTORICAL_UID_MISMATCH) et n'utilise jamais l'UID historique pour remplacer l'UID Auth attendu.
 * - Bloque strictement les statuts négatifs : 'suspended', 'revoked', 'banned', 'disabled'.
 *   Ne réactive jamais automatiquement un profil suspendu ou révoqué.
 * - Un profil cible 'pending_activation' ne peut être restauré que si le profil historique constitue une preuve complète et valide (B).
 * - R1 (FIX-10-R1) : Stratégie explicite de préservation non destructive du profil cible :
 *   1. Préserve les champs métier et métadonnées légitimes déjà présents sur le profil cible (même non importables depuis l'historique).
 *   2. Élimine explicitement les champs interdits (clés de prototype dangereuses, champs d'autorisation parallèles/ombres,
 *      et privilèges commerciaux non vérifiés tels que 'enterprise', 'lifetime', 'unlimited', 'licenses', 'assignedPlan').
 *   3. Ne récupère de l'historique que les champs explicitement autorisés dans ALLOWED_HISTORICAL_PROFILE_FIELDS s'ils sont absents de la cible.
 *   4. Conserve les contrôles stricts sur uid, email, status === 'active' et role === 'super_admin'.
 *   5. Remplace atomiquement le document cible par l'objet assaini (sans { merge: true } aveugle qui laisserait persister des champs interdits)
 *      et ne modifie jamais le document historique.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adminAuth,
  adminDb,
  EXPECTED_SERVER_DATABASE_ID,
  extractServerFirestoreProjectId,
  extractServerFirestoreDatabaseId
} from '../src/lib/firebase-admin.ts';

export const EXPECTED_PROJECT_ID = 'graphical-router-x18qq';
export const EXPECTED_DATABASE_ID = EXPECTED_SERVER_DATABASE_ID;
export const ALLOWED_SUPER_ADMIN_EMAIL = 'boudjada.youcef@gmail.com';
export const HISTORICAL_PROFILE_DOC_ID = 'superadmin-youcef-boudjada';

/**
 * AUTH-ADMIN-05-FIX-10 — Statuts négatifs strictement bloqués.
 * Aucun profil présentant l'un de ces statuts ne peut être activé ou réactivé automatiquement.
 */
export const NEGATIVE_PROFILE_STATUSES = new Set<string>([
  'suspended',
  'revoked',
  'banned',
  'disabled'
]);

/**
 * AUTH-ADMIN-05-FIX-10 — Whitelist explicite des champs descriptifs non sensibles
 * autorisés à être récupérés depuis un profil historique dûment vérifié (Preuve B),
 * uniquement lorsqu'ils sont absents du profil cible.
 */
export const ALLOWED_HISTORICAL_PROFILE_FIELDS = Object.freeze([
  'name',
  'displayName',
  'company',
  'country',
  'countryCode',
  'city',
  'department',
  'jobTitle',
  'phone',
  'photoURL',
  'photoUrl',
  'createdAt'
] as const);

export const ALLOWED_HISTORICAL_PROFILE_FIELD_SET = new Set<string>(
  ALLOWED_HISTORICAL_PROFILE_FIELDS
);

/**
 * AUTH-ADMIN-05-FIX-10 — Whitelist explicite des champs descriptifs standards de profil cible.
 */
export const ALLOWED_TARGET_PROFILE_FIELDS = Object.freeze([
  'name',
  'displayName',
  'company',
  'country',
  'countryCode',
  'city',
  'department',
  'jobTitle',
  'phone',
  'photoURL',
  'photoUrl',
  'createdAt',
  'updatedAt'
] as const);

export const ALLOWED_TARGET_PROFILE_FIELD_SET = new Set<string>(
  ALLOWED_TARGET_PROFILE_FIELDS
);

/**
 * AUTH-ADMIN-05-FIX-10 & FIX-10-R1 — Privilèges commerciaux interdits d'attribution ou de conservation sans preuve indépendante.
 */
export const FORBIDDEN_UNVERIFIED_COMMERCIAL_PRIVILEGES = new Set<string>([
  'enterprise',
  'lifetime',
  'unlimited'
]);

/**
 * AUTH-ADMIN-05-FIX-10-R1 — Clés de privilèges commerciaux directs strictement interdites sur le profil
 * sans preuve indépendante (licences octroyées manuellement, plans assignés de force, quotas d'utilisateurs).
 */
export const FORBIDDEN_UNVERIFIED_COMMERCIAL_KEYS = new Set<string>([
  'licenses',
  'license',
  'licensekey',
  'licensekeys',
  'assignedplan',
  'maxusers'
]);

/**
 * AUTH-ADMIN-05-FIX-10-R1 — Clés commerciales susceptibles de porter une valeur de palier/plan ('enterprise', 'lifetime').
 */
export const COMMERCIAL_TIER_AND_PLAN_KEYS = new Set<string>([
  'accounttype',
  'subscriptionplan',
  'pricingplan',
  'assignedplan',
  'tier',
  'accesstier',
  'plan',
  'billingcycle'
]);

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
 * FIX-08-R4-B3.1 & FIX-10-R1 — Dictionnaire privé et immuable des messages internes autorisés.
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
    "NO_VERIFIED_AUTHORIZATION_PROOF : Aucune preuve d'autorisation Super Admin préexistante et vérifiée n'a été trouvée (aucun profil cible ni historique).",
  NO_VERIFIED_AUTHORIZATION_PROOF:
    "NO_VERIFIED_AUTHORIZATION_PROOF : Aucune preuve d'autorisation Super Admin préexistante et vérifiée n'a été trouvée.",
  HISTORICAL_UID_MISMATCH:
    "[BLOCAGE UID HISTORIQUE] NO_VERIFIED_AUTHORIZATION_PROOF : Le champ uid du profil historique est contradictoire avec HISTORICAL_PROFILE_DOC_ID ('superadmin-youcef-boudjada').",
  NEGATIVE_PROFILE_STATUS_BLOCKED:
    "[BLOCAGE STATUT] Le profil présente un statut négatif interdit (suspended, revoked, banned ou disabled). Réactivation automatique refusée.",
  EXPECTED_UID_MISSING:
    "[BLOCAGE UID] EXPECTED_SUPER_ADMIN_UID est absent ou vide. L'UID attendu doit être configuré indépendamment.",
  EXPECTED_UID_MISMATCH:
    "[BLOCAGE UID] L'UID du compte Firebase Auth ne correspond pas à EXPECTED_SUPER_ADMIN_UID.",
  PROJECT_MISMATCH:
    "[BLOCAGE PROJET] Projet Auth/Firestore non autorisé ou non vérifiable. Attendu='graphical-router-x18qq'.",
  DATABASE_MISMATCH:
    "[BLOCAGE BASE FIRESTORE] Base de données Firestore non autorisée ou non vérifiable. Attendu='ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'.",
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
  PROFILE_EMAIL_MISMATCH:
    "[ÉTAT PARTIEL] Profil Firestore écrit, MAIS l'email du profil relu ne correspond pas à l'email Super Admin autorisé.",
  PROFILE_STATUS_INVALID_AFTER_WRITE:
    "[ÉTAT PARTIEL] Profil Firestore écrit, MAIS le statut du profil relu n'est pas strictement égal à 'active'.",
  PROFILE_ROLE_INVALID_AFTER_WRITE:
    "[ÉTAT PARTIEL] Profil Firestore écrit, MAIS le rôle du profil relu n'est pas strictement égal à 'super_admin'.",
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
 * AUTH-ADMIN-05-FIX-10 — Extrait le code interne authentifié d'une erreur interne via le WeakMap privé.
 */
export function getSafeInternalErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && INTERNAL_ERROR_REGISTRY.has(error)) {
    const code = INTERNAL_ERROR_REGISTRY.get(error);
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(SAFE_INTERNAL_MESSAGES, code)) {
      return code;
    }
  }
  return undefined;
}

/**
 * FIX-08-R4-B3.3 — Extrait le message sécurisé constant d'une erreur interne authentifiée.
 * Récupère le code via le WeakMap privé et résout dans le dictionnaire privé gelé.
 * Ne lit AUCUNE propriété sur l'objet d'erreur (aucun getter ne peut être déclenché).
 */
export function getSafeInternalMessage(error: unknown): string {
  const code = getSafeInternalErrorCode(error);
  if (code) {
    return SAFE_INTERNAL_MESSAGES[code];
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
 * de licences, de quotas et de statut strictement protégées contre toute importation historique.
 */
export const PROTECTED_COMMERCIAL_LEAF_KEYS = new Set([
  'accounttype',
  'subscriptionplan',
  'status',
  'paymentgateway',
  'currency',
  'storageusedkb',
  'logincount',
  'projectscount',
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
 * FIX-07-C — Champs de privilèges et d'autorisations historiques strictement interdits d'importation directe.
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

  if (PROTECTED_COMMERCIAL_LEAF_KEYS.has(leafKey)) {
    return true;
  }

  if (
    leafKey.includes('billing') ||
    leafKey.includes('payment') ||
    leafKey.includes('invoice') ||
    leafKey.includes('license') ||
    leafKey.includes('subscription') ||
    leafKey.includes('accounttype') ||
    leafKey.includes('pricingplan') ||
    leafKey.includes('count') ||
    leafKey.includes('quota')
  ) {
    return true;
  }

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

  if (FORBIDDEN_HISTORICAL_AUTH_LEAF_KEYS.has(leafKey)) {
    return true;
  }

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
 * (soit commercial, soit autorisation/privilège, soit hors whitelist).
 */
export function isForbiddenHistoricalField(key: string, pathPrefix = ''): boolean {
  if (pathPrefix !== '') return true;
  if (isProtectedCommercialField(key, pathPrefix) || isProtectedAuthorizationField(key, pathPrefix)) {
    return true;
  }
  return !ALLOWED_HISTORICAL_PROFILE_FIELD_SET.has(key);
}

/**
 * AUTH-ADMIN-05-FIX-10-R1 (R1) — Politique explicite des champs interdits sur le profil cible lui-même :
 * - Clés de pollution de prototype (__proto__, constructor, prototype).
 * - Champs d'autorisation parallèles ou ombres (roles, admin, isAdmin, isSuperAdmin, permissions,
 *   customClaims, accessLevel, privileges, authorization, authorizations, securityRole, adminRole).
 * - Clés d'octroi direct de licences/quotas sans preuve indépendante (licenses, license, licenseKey, assignedPlan, maxUsers).
 * - Valeurs de privilèges commerciaux non vérifiés ('enterprise', 'lifetime', 'unlimited') sur les champs de plan/tier.
 */
export function isExplicitlyForbiddenTargetField(
  key: string,
  value: unknown,
  pathPrefix = ''
): boolean {
  if (isDangerousKey(key)) {
    return true;
  }

  const leafKey = key.toLowerCase();

  // 1. Interdiction absolue des champs d'autorisation parallèles (hors 'role' racine contrôlé par le bootstrap)
  if (!(pathPrefix === '' && leafKey === 'role')) {
    if (isProtectedAuthorizationField(key, pathPrefix)) {
      return true;
    }
  }

  // 2. Interdiction des clés d'octroi direct de licences ou privilèges commerciaux non vérifiés
  if (FORBIDDEN_UNVERIFIED_COMMERCIAL_KEYS.has(leafKey)) {
    return true;
  }

  // 3. Interdiction des valeurs 'enterprise', 'lifetime', 'unlimited' sur tout champ de palier ou d'abonnement
  if (typeof value === 'string') {
    const normVal = value.trim().toLowerCase();
    if (
      FORBIDDEN_UNVERIFIED_COMMERCIAL_PRIVILEGES.has(normVal) &&
      (COMMERCIAL_TIER_AND_PLAN_KEYS.has(leafKey) || isProtectedCommercialField(key, pathPrefix))
    ) {
      return true;
    }
  }

  return false;
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
 * FIX-08-D & FIX-10 — Rapport de bootstrap assaini, sans email ni uid ni données sensibles.
 */
export interface BootstrapReport {
  mode: 'dry-run' | 'execute';
  timestamp: string;
  projectId: string;
  databaseId?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  hasGoogleProvider?: boolean;
  existingClaimKeys?: string[];
  updatedClaimKeys?: string[];
  historicalProfileFound: boolean;
  targetProfileFound: boolean;
  proofSource?: 'target' | 'historical';
  conflictsDetected: ConflictSummary[];
  fieldsRecoveredFromHistory: string[];
  profileWritten: boolean;
  profileVerified: boolean;
  claimsUpdated: boolean;
  claimsVerified: boolean;
  success: boolean;
  partialState?: boolean;
  errorCode?: string;
  error?: string;
}

export interface BootstrapOptions {
  execute?: boolean;
  targetEmail?: string;
  expectedUid?: string;
  authInstance?: any;
  firestoreInstance?: any;
}

/**
 * AUTH-ADMIN-05-FIX-10 — Résout EXPECTED_SUPER_ADMIN_UID de manière strictement indépendante.
 * Ne déduit JAMAIS l'UID à partir de l'adresse email ou du record Auth.
 * Retourne null si absent, non-chaîne ou vide.
 */
export function resolveExpectedSuperAdminUid(options?: BootstrapOptions): string | null {
  const rawUid =
    options && Object.prototype.hasOwnProperty.call(options, 'expectedUid')
      ? options.expectedUid
      : process.env.EXPECTED_SUPER_ADMIN_UID;

  if (typeof rawUid !== 'string') {
    return null;
  }

  const trimmed = rawUid.trim();
  return trimmed.length > 0 ? trimmed : null;
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
 * AUTH-ADMIN-05-FIX-10 — Vérifie de manière fail-closed si un profil présente un statut négatif interdit
 * ('suspended', 'revoked', 'banned', 'disabled').
 */
export function hasNegativeProfileStatus(profile: Record<string, any> | null | undefined): boolean {
  if (!profile || !isPlainObject(profile)) {
    return false;
  }

  const statusInsp = inspectOwnDataProperty(profile, 'status');
  if (statusInsp.kind === 'accessor') {
    return true;
  }

  if (statusInsp.kind === 'data' && typeof statusInsp.value === 'string') {
    const normalized = statusInsp.value.trim().toLowerCase();
    return NEGATIVE_PROFILE_STATUSES.has(normalized);
  }

  return false;
}

/**
 * AUTH-ADMIN-05-FIX-10-R1 (R2) — Vérifie la cohérence du champ uid du profil historique :
 * - Si le champ uid est absent ou undefined : autorisé par le modèle de données (retourne false).
 * - Si le champ uid est un accesseur (getter/setter) : rejeté fail-closed (retourne true).
 * - Si le champ uid est présent : il doit être une chaîne strictement égale à HISTORICAL_PROFILE_DOC_ID ('superadmin-youcef-boudjada').
 *   Toute valeur contradictoire est refusée (retourne true).
 */
export function hasContradictoryHistoricalUid(
  historicalProfileData: Record<string, any> | null | undefined
): boolean {
  if (!historicalProfileData || !isPlainObject(historicalProfileData)) {
    return false;
  }

  const uidInsp = inspectOwnDataProperty(historicalProfileData, 'uid');
  if (uidInsp.kind === 'accessor') {
    return true;
  }

  if (uidInsp.kind === 'data' && uidInsp.value !== undefined) {
    return typeof uidInsp.value !== 'string' || uidInsp.value !== HISTORICAL_PROFILE_DOC_ID;
  }

  return false;
}

/**
 * AUTH-ADMIN-05-FIX-10 — Vérifie la Preuve A :
 * Profil cible profiles/{uid} existant avec :
 * - status === 'active'
 * - role === 'super_admin'
 * - email égal à l'email Auth (sans distinction de casse)
 * - uid (si présent) égal à realUid
 */
export function isValidTargetAuthorizationProof(
  targetProfileData: Record<string, any> | null | undefined,
  realUid: string,
  expectedEmail: string = ALLOWED_SUPER_ADMIN_EMAIL
): boolean {
  if (!targetProfileData || !isPlainObject(targetProfileData)) {
    return false;
  }

  if (typeof realUid !== 'string' || realUid.trim().length === 0) {
    return false;
  }

  const normExpectedEmail = expectedEmail.trim().toLowerCase();

  const statusInsp = inspectOwnDataProperty(targetProfileData, 'status');
  if (statusInsp.kind !== 'data' || statusInsp.value !== 'active') {
    return false;
  }

  const roleInsp = inspectOwnDataProperty(targetProfileData, 'role');
  if (roleInsp.kind !== 'data' || roleInsp.value !== 'super_admin') {
    return false;
  }

  const emailInsp = inspectOwnDataProperty(targetProfileData, 'email');
  if (
    emailInsp.kind !== 'data' ||
    typeof emailInsp.value !== 'string' ||
    emailInsp.value.trim().toLowerCase() !== normExpectedEmail
  ) {
    return false;
  }

  const uidInsp = inspectOwnDataProperty(targetProfileData, 'uid');
  if (uidInsp.kind === 'accessor') {
    return false;
  }
  if (uidInsp.kind === 'data' && uidInsp.value !== undefined && uidInsp.value !== realUid) {
    return false;
  }

  return true;
}

/**
 * AUTH-ADMIN-05-FIX-10 & FIX-10-R1 (R2) — Vérifie la Preuve B :
 * Profil historique profiles/superadmin-youcef-boudjada vérifié avec :
 * - uid (s'il existe) strictement égal à HISTORICAL_PROFILE_DOC_ID
 * - email identique à l'email Auth (sans distinction de casse)
 * - role === 'super_admin'
 * - status === 'active'
 * Le profil historique n'est JAMAIS accepté sur la seule base de son identifiant de document.
 */
export function isValidHistoricalAuthorizationProof(
  historicalProfileData: Record<string, any> | null | undefined,
  expectedEmail: string = ALLOWED_SUPER_ADMIN_EMAIL
): boolean {
  if (!historicalProfileData || !isPlainObject(historicalProfileData)) {
    return false;
  }

  if (hasContradictoryHistoricalUid(historicalProfileData)) {
    return false;
  }

  const normExpectedEmail = expectedEmail.trim().toLowerCase();

  const emailInsp = inspectOwnDataProperty(historicalProfileData, 'email');
  if (
    emailInsp.kind !== 'data' ||
    typeof emailInsp.value !== 'string' ||
    emailInsp.value.trim().toLowerCase() !== normExpectedEmail
  ) {
    return false;
  }

  const roleInsp = inspectOwnDataProperty(historicalProfileData, 'role');
  if (roleInsp.kind !== 'data' || roleInsp.value !== 'super_admin') {
    return false;
  }

  const statusInsp = inspectOwnDataProperty(historicalProfileData, 'status');
  if (statusInsp.kind !== 'data' || statusInsp.value !== 'active') {
    return false;
  }

  return true;
}

/**
 * AUTH-ADMIN-05-FIX-10 — Vérifie si un profil cible en 'pending_activation' est éligible
 * à une restauration via une Preuve B historique valide.
 */
export function isEligiblePendingTargetProfile(
  targetProfileData: Record<string, any> | null | undefined,
  realUid: string,
  expectedEmail: string = ALLOWED_SUPER_ADMIN_EMAIL
): boolean {
  if (!targetProfileData || !isPlainObject(targetProfileData)) {
    return false;
  }

  const statusInsp = inspectOwnDataProperty(targetProfileData, 'status');
  if (statusInsp.kind !== 'data' || statusInsp.value !== 'pending_activation') {
    return false;
  }

  const normExpectedEmail = expectedEmail.trim().toLowerCase();
  const emailInsp = inspectOwnDataProperty(targetProfileData, 'email');
  if (emailInsp.kind === 'accessor') {
    return false;
  }
  if (
    emailInsp.kind === 'data' &&
    emailInsp.value !== undefined &&
    (typeof emailInsp.value !== 'string' || emailInsp.value.trim().toLowerCase() !== normExpectedEmail)
  ) {
    return false;
  }

  const uidInsp = inspectOwnDataProperty(targetProfileData, 'uid');
  if (uidInsp.kind === 'accessor') {
    return false;
  }
  if (uidInsp.kind === 'data' && uidInsp.value !== undefined && uidInsp.value !== realUid) {
    return false;
  }

  const roleInsp = inspectOwnDataProperty(targetProfileData, 'role');
  if (roleInsp.kind === 'accessor') {
    return false;
  }
  if (
    roleInsp.kind === 'data' &&
    roleInsp.value !== undefined &&
    roleInsp.value !== 'super_admin'
  ) {
    return false;
  }

  return true;
}

/**
 * AUTH-ADMIN-05-FIX-10 & FIX-10-R1 — Validation centralisée des statuts négatifs,
 * de la cohérence de l'UID historique (R2) et de la preuve d'autorisation préexistante.
 */
export function verifyPreexistingAuthorizationProof(
  realUid: string,
  targetProfileData: Record<string, any> | null,
  historicalProfileData: Record<string, any> | null,
  expectedEmail: string = ALLOWED_SUPER_ADMIN_EMAIL
): {
  valid: boolean;
  proofSource?: 'target' | 'historical';
  errorCode?:
    | 'NEGATIVE_PROFILE_STATUS_BLOCKED'
    | 'HISTORICAL_UID_MISMATCH'
    | 'NO_VERIFIED_AUTHORIZATION_PROOF';
} {
  // 1. Blocage strict des statuts négatifs sur la cible ou l'historique
  if (hasNegativeProfileStatus(targetProfileData) || hasNegativeProfileStatus(historicalProfileData)) {
    return {
      valid: false,
      errorCode: 'NEGATIVE_PROFILE_STATUS_BLOCKED'
    };
  }

  // 2. R2 : Blocage strict si le profil historique possède un champ uid contradictoire avec HISTORICAL_PROFILE_DOC_ID
  if (hasContradictoryHistoricalUid(historicalProfileData)) {
    return {
      valid: false,
      errorCode: 'HISTORICAL_UID_MISMATCH'
    };
  }

  const targetProof = isValidTargetAuthorizationProof(targetProfileData, realUid, expectedEmail);
  const historicalProof = isValidHistoricalAuthorizationProof(historicalProfileData, expectedEmail);

  // 3. Si un profil cible existe
  if (targetProfileData !== null && targetProfileData !== undefined) {
    if (targetProof) {
      return {
        valid: true,
        proofSource: 'target'
      };
    }

    // Un profil cible pending_activation ne peut être restauré QUE si le profil historique est une Preuve B valide
    if (
      isEligiblePendingTargetProfile(targetProfileData, realUid, expectedEmail) &&
      historicalProof
    ) {
      return {
        valid: true,
        proofSource: 'historical'
      };
    }

    return {
      valid: false,
      errorCode: 'NO_VERIFIED_AUTHORIZATION_PROOF'
    };
  }

  // 4. Si aucun profil cible n'existe, la Preuve B historique complète est obligatoire
  if (historicalProof) {
    return {
      valid: true,
      proofSource: 'historical'
    };
  }

  return {
    valid: false,
    errorCode: 'NO_VERIFIED_AUTHORIZATION_PROOF'
  };
}

/**
 * AUTH-ADMIN-05-FIX-10 — Validation stricte de la valeur d'un champ figurant dans la whitelist historique.
 */
export function isSafeWhitelistedFieldValue(key: string, value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (key === 'createdAt' || key === 'updatedAt') {
    const timeSpec = extractExactTime(value);
    return timeSpec !== null && timeSpec.valid === true;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return false;
    if (FORBIDDEN_UNVERIFIED_COMMERCIAL_PRIVILEGES.has(trimmed.toLowerCase())) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * AUTH-ADMIN-05-FIX-10-R1 (R1) — Assainissement récursif non destructif d'une valeur présente sur le profil cible :
 * - Préserve les primitives, dates/timestamps valides, tableaux et sous-objets métier légitimes de la cible.
 * - Élimine récursivement les clés de prototype dangereuses, les accesseurs (getters/setters),
 *   les champs d'autorisation parallèles et les privilèges commerciaux non vérifiés ('enterprise', 'lifetime', 'unlimited', 'licenses', etc.).
 */
export function sanitizeTargetFieldValue(
  value: unknown,
  key: string,
  pathPrefix = ''
): any {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    if (isExplicitlyForbiddenTargetField(key, value, pathPrefix)) {
      return undefined;
    }
    return value;
  }

  if (isDateOrFirestoreTimestamp(value)) {
    const spec = extractExactTime(value);
    return spec && spec.valid ? value : undefined;
  }

  if (Array.isArray(value)) {
    const sanitizedArr = value
      .map((item, idx) => sanitizeTargetFieldValue(item, key, `${pathPrefix}[${idx}]`))
      .filter((item) => item !== undefined);
    return sanitizedArr;
  }

  if (isPlainObject(value)) {
    const cleanedObj: Record<string, any> = createSafePlainObject();
    for (const nestedKey of Object.keys(value)) {
      if (isDangerousKey(nestedKey)) continue;
      const nestedInsp = inspectOwnDataProperty(value, nestedKey);
      if (nestedInsp.kind !== 'data') continue;

      const nestedPath = pathPrefix ? `${pathPrefix}.${nestedKey}` : nestedKey;
      if (isExplicitlyForbiddenTargetField(nestedKey, nestedInsp.value, pathPrefix)) {
        continue;
      }

      const safeNested = sanitizeTargetFieldValue(nestedInsp.value, nestedKey, nestedPath);
      if (safeNested !== undefined) {
        safeDefineProperty(cleanedObj, nestedKey, safeNested);
      }
    }
    return Object.keys(cleanedObj).length > 0 ? cleanedObj : undefined;
  }

  return undefined;
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
 * AUTH-ADMIN-05-FIX-10-R1 (R1 & R2) — Fusion non destructive du profil cible et whitelist stricte pour l'historique :
 * - Exige impérativement une preuve d'autorisation préexistante vérifiée (Preuve A ou Preuve B).
 * - Bloque strictement les statuts négatifs ('suspended', 'revoked', 'banned', 'disabled').
 * - R2 : Vérifie la cohérence de historicalProfileData.uid avec HISTORICAL_PROFILE_DOC_ID s'il existe.
 * - R1 : Préserve de manière non destructive tous les champs existants légitimes du profil cible
 *   (y compris les champs métier cibles non importables depuis l'historique), tout en éliminant
 *   les champs explicitement interdits (isExplicitlyForbiddenTargetField).
 * - Ne récupère depuis l'historique vérifié que les champs figurant dans ALLOWED_HISTORICAL_PROFILE_FIELDS,
 *   uniquement s'ils sont absents du profil cible.
 * - Ne réintroduit aucun privilège commercial non vérifié ('enterprise', 'lifetime', 'unlimited', 'licenses', etc.).
 * - Garantit uid === realUid (ne remplace jamais l'UID Auth par l'UID historique),
 *   email === expectedEmail normalisé, status === 'active', role === 'super_admin'.
 */
export function mergeProfileDataNonDestructive(
  realUid: string,
  targetProfileData: Record<string, any> | null,
  historicalProfileData: Record<string, any> | null,
  expectedEmail: string = ALLOWED_SUPER_ADMIN_EMAIL
): {
  mergedData: Record<string, any>;
  conflicts: ConflictSummary[];
  recoveredFields: string[];
  proofSource: 'target' | 'historical';
} {
  const conflicts: ConflictSummary[] = [];
  const recoveredFields: string[] = [];
  const normExpectedEmail = (expectedEmail || ALLOWED_SUPER_ADMIN_EMAIL).trim().toLowerCase();

  // 1. Vérification stricte des statuts négatifs, de l'UID historique (R2) et de la preuve d'autorisation préexistante
  const proofCheck = verifyPreexistingAuthorizationProof(
    realUid,
    targetProfileData,
    historicalProfileData,
    normExpectedEmail
  );

  if (!proofCheck.valid || !proofCheck.proofSource) {
    throw new InternalBootstrapError(
      proofCheck.errorCode || 'NO_VERIFIED_AUTHORIZATION_PROOF'
    );
  }

  const mergedData: Record<string, any> = createSafePlainObject();

  // 2. R1 : Préservation non destructive des champs légitimes existants du profil cible
  //    et filtrage explicite des champs interdits (isExplicitlyForbiddenTargetField)
  if (targetProfileData && isPlainObject(targetProfileData)) {
    for (const tKey of Object.keys(targetProfileData)) {
      if (tKey === 'uid' || tKey === 'email' || tKey === 'status' || tKey === 'role') {
        continue;
      }
      if (isDangerousKey(tKey)) {
        continue;
      }

      const ownInsp = inspectOwnDataProperty(targetProfileData, tKey);
      if (ownInsp.kind !== 'data') {
        continue;
      }

      if (isExplicitlyForbiddenTargetField(tKey, ownInsp.value, '')) {
        continue;
      }

      const sanitizedTargetVal = sanitizeTargetFieldValue(ownInsp.value, tKey, tKey);
      if (sanitizedTargetVal !== undefined) {
        safeDefineProperty(mergedData, tKey, sanitizedTargetVal);
      }
    }
  }

  // 3. Récupération contrôlée depuis l'historique uniquement pour les champs de ALLOWED_HISTORICAL_PROFILE_FIELDS
  const canRecoverFromHistory = isValidHistoricalAuthorizationProof(
    historicalProfileData,
    normExpectedEmail
  );

  if (historicalProfileData && isPlainObject(historicalProfileData)) {
    for (const key of Object.keys(historicalProfileData)) {
      if (isDangerousKey(key)) continue;
      if (key === 'uid' || key === 'email' || key === 'status' || key === 'role') {
        continue;
      }

      const histInsp = inspectOwnDataProperty(historicalProfileData, key);
      if (histInsp.kind !== 'data') continue;
      const histValue = histInsp.value;

      const targetInsp =
        targetProfileData && isPlainObject(targetProfileData)
          ? inspectOwnDataProperty(targetProfileData, key)
          : { kind: 'missing' as const };
      const targetValue = targetInsp.kind === 'data' ? targetInsp.value : undefined;

      // Tout champ hors de la whitelist historique est strictement refusé à l'importation depuis l'historique
      if (!ALLOWED_HISTORICAL_PROFILE_FIELD_SET.has(key)) {
        if (targetValue !== undefined && JSON.stringify(targetValue) !== JSON.stringify(histValue)) {
          const category = isProtectedCommercialField(key)
            ? 'commercial'
            : isProtectedAuthorizationField(key)
              ? 'authorization'
              : 'profile_data';
          conflicts.push({
            field: key,
            valuesDiffer: true,
            conflictCategory: category
          });
        }
        continue;
      }

      // Champ présent dans la whitelist historique
      if (Object.prototype.hasOwnProperty.call(mergedData, key)) {
        // La cible possède déjà ce champ : priorité absolue à la métadonnée cible récente
        const currentTargetVal = mergedData[key];
        const areEqual =
          isDateOrFirestoreTimestamp(currentTargetVal) && isDateOrFirestoreTimestamp(histValue)
            ? areDatesOrTimestampsEqual(currentTargetVal, histValue)
            : currentTargetVal === histValue;

        if (!areEqual) {
          conflicts.push({
            field: key,
            valuesDiffer: true,
            conflictCategory: 'profile_data'
          });
        }
      } else if (canRecoverFromHistory && isSafeWhitelistedFieldValue(key, histValue)) {
        safeDefineProperty(mergedData, key, histValue);
        recoveredFields.push(key);
      }
    }
  }

  // 4. Définition des 4 champs d'identité et d'autorisation vérifiés (Zero-Trust)
  //    R2 : uid est toujours realUid (l'UID Auth vérifié), jamais l'UID historique
  safeDefineProperty(mergedData, 'uid', realUid);
  safeDefineProperty(mergedData, 'email', normExpectedEmail);
  safeDefineProperty(mergedData, 'status', 'active');
  safeDefineProperty(mergedData, 'role', 'super_admin');

  return {
    mergedData,
    conflicts,
    recoveredFields,
    proofSource: proofCheck.proofSource
  };
}

export function getFirestoreProjectId(firestoreInstance: any): string | null {
  return extractServerFirestoreProjectId(firestoreInstance);
}

export function getFirestoreDatabaseId(firestoreInstance: any): string | null {
  return extractServerFirestoreDatabaseId(firestoreInstance);
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
 * Fonction maîtresse exécutant le bootstrap Super Admin Zero-Trust (AUTH-ADMIN-05-FIX-10-R1).
 */
export async function runSuperAdminBootstrap(options: BootstrapOptions = {}): Promise<BootstrapReport> {
  const isExecute = options.execute === true;
  const rawTargetEmail =
    typeof options.targetEmail === 'string' ? options.targetEmail : ALLOWED_SUPER_ADMIN_EMAIL;
  const targetEmail = rawTargetEmail.trim().toLowerCase();
  const authSdk = options.authInstance || adminAuth;
  const dbSdk = options.firestoreInstance || adminDb;

  const authProjectId = authSdk?.app?.options?.projectId;
  const firestoreProjectId = getFirestoreProjectId(dbSdk);
  const firestoreDatabaseId = getFirestoreDatabaseId(dbSdk);

  // FIX-08-D : Ni email ni uid dans le rapport final exposé
  const report: BootstrapReport = {
    mode: isExecute ? 'execute' : 'dry-run',
    timestamp: new Date().toISOString(),
    projectId: authProjectId || firestoreProjectId || '',
    databaseId: firestoreDatabaseId || '',
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
    // =========================================================================
    // ÉTAPE 1 : VALIDATION INTÉGRALE DE L'IDENTITÉ AUTH & DE LA CIBLE FIRESTORE
    // =========================================================================

    // 1.1 Contrôle strict, croisé et exclusif des projets Auth et Firestore avant toute lecture
    if (
      authProjectId !== EXPECTED_PROJECT_ID ||
      firestoreProjectId !== EXPECTED_PROJECT_ID ||
      authProjectId !== firestoreProjectId
    ) {
      throw new InternalBootstrapError('PROJECT_MISMATCH');
    }

    // 1.1b Contrôle strict de la base de données Firestore nommée avant toute lecture ou écriture (FIRESTORE-NAMED-DB-01-FIX-01)
    if (
      !firestoreDatabaseId ||
      firestoreDatabaseId === '(default)' ||
      firestoreDatabaseId !== EXPECTED_DATABASE_ID
    ) {
      throw new InternalBootstrapError('DATABASE_MISMATCH');
    }

    // 1.2 Contrôle strict de l'adresse email autorisée (comparaison sans distinction de casse)
    if (targetEmail !== ALLOWED_SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new InternalBootstrapError('EMAIL_MISMATCH');
    }

    // 1.3 Contrôle de la présence de EXPECTED_SUPER_ADMIN_UID configuré indépendamment
    const expectedSuperAdminUid = resolveExpectedSuperAdminUid(options);
    if (!expectedSuperAdminUid) {
      throw new InternalBootstrapError('EXPECTED_UID_MISSING');
    }

    // 1.4 Récupération du compte Firebase Auth (Lecture seule)
    let userRecord: any;
    try {
      userRecord = await authSdk.getUserByEmail(targetEmail);
    } catch {
      throw new InternalBootstrapError('USER_NOT_FOUND');
    }

    // 1.5 Vérification de l'email du record Auth (sans distinction de casse)
    const recordEmail =
      typeof userRecord?.email === 'string' ? userRecord.email.trim().toLowerCase() : '';
    if (recordEmail !== ALLOWED_SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new InternalBootstrapError('EMAIL_MISMATCH');
    }

    // 1.6 Validation stricte du compte actif (disabled === false impératif)
    if (userRecord.disabled !== false) {
      report.disabled = userRecord.disabled === true ? true : undefined;
      throw new InternalBootstrapError('ACCOUNT_DISABLED');
    }
    report.disabled = false;

    // 1.7 Validation stricte de l'email vérifié (emailVerified === true impératif)
    if (userRecord.emailVerified !== true) {
      report.emailVerified = userRecord.emailVerified === true;
      throw new InternalBootstrapError('EMAIL_NOT_VERIFIED');
    }
    report.emailVerified = true;

    // 1.8 Validation de la présence du fournisseur 'google.com' dans providerData
    const providerIds = Array.isArray(userRecord.providerData)
      ? userRecord.providerData.map((p: any) => p?.providerId)
      : [];
    report.hasGoogleProvider = providerIds.includes('google.com');
    if (!report.hasGoogleProvider) {
      throw new InternalBootstrapError('INVALID_PROVIDER');
    }

    // 1.9 Validation stricte de l'UID par rapport à EXPECTED_SUPER_ADMIN_UID configuré indépendamment
    if (typeof userRecord.uid !== 'string' || userRecord.uid.trim() !== expectedSuperAdminUid) {
      throw new InternalBootstrapError('EXPECTED_UID_MISMATCH');
    }

    // Préparation sécurisée des Custom Claims en préservant les claims existants non conflictuels
    const existingClaims: Record<string, any> = createSafePlainObject();
    if (userRecord.customClaims && isPlainObject(userRecord.customClaims)) {
      for (const [claimKey, claimVal] of Object.entries(userRecord.customClaims)) {
        if (isDangerousKey(claimKey)) continue;
        safeDefineProperty(existingClaims, claimKey, claimVal);
      }
    }

    const expectedClaims: Record<string, any> = createSafePlainObject();
    for (const [claimKey, claimVal] of Object.entries(existingClaims)) {
      safeDefineProperty(expectedClaims, claimKey, claimVal);
    }
    safeDefineProperty(expectedClaims, 'role', 'super_admin');

    // FIX-07-E : Enregistrement uniquement des noms de clés de claims dans le rapport (pas de valeurs brutes)
    report.existingClaimKeys = Object.keys(existingClaims);
    report.updatedClaimKeys = Object.keys(expectedClaims);

    // =========================================================================
    // ÉTAPE 2 & 3 : LECTURE FIRESTORE, VALIDATION DE LA PREUVE D'AUTORISATION
    //               PRÉEXISTANTE, DES STATUTS ET FUSION CONTRÔLÉE (R1 & R2)
    // =========================================================================
    const historicalDocRef = dbSdk.collection('profiles').doc(HISTORICAL_PROFILE_DOC_ID);
    const targetDocRef = dbSdk.collection('profiles').doc(userRecord.uid);

    let historicalData: Record<string, any> | null = null;
    let targetData: Record<string, any> | null = null;

    try {
      const histSnap = await historicalDocRef.get();
      if (histSnap.exists) {
        historicalData = histSnap.data() ?? null;
        report.historicalProfileFound = historicalData !== null;
      }
    } catch {
      throw new InternalBootstrapError('HISTORICAL_READ_FAILED');
    }

    try {
      const targetSnap = await targetDocRef.get();
      if (targetSnap.exists) {
        targetData = targetSnap.data() ?? null;
        report.targetProfileFound = targetData !== null;
      }
    } catch {
      throw new InternalBootstrapError('TARGET_READ_FAILED');
    }

    const mergeResult = mergeProfileDataNonDestructive(
      userRecord.uid,
      targetData,
      historicalData,
      recordEmail
    );
    report.proofSource = mergeResult.proofSource;
    report.conflictsDetected = mergeResult.conflicts;
    report.fieldsRecoveredFromHistory = mergeResult.recoveredFields;

    // FIX-07-E : Le profil final reste dans une variable locale, JAMAIS exposé dans le rapport
    const finalProfileToSave = mergeResult.mergedData;

    // =========================================================================
    // ÉTAPES 4 À 7 : EXÉCUTION SÉCURISÉE EN MODE --execute UNIQUEMENT
    // =========================================================================
    if (isExecute) {
      // Étape 4 : Écrire le profil cible Firestore (l'objet finalProfileToSave inclut déjà
      // tous les champs cibles légitimes préservés et purge les champs interdits)
      try {
        await targetDocRef.set(finalProfileToSave);
        report.profileWritten = true;
      } catch {
        let diagnosticDataPresent = false;
        try {
          const diagSnap = await targetDocRef.get();
          if (diagSnap.exists) {
            const diagData = diagSnap.data();
            const diffs = deepCompareFirestoreData(finalProfileToSave, diagData);
            if (diffs.length === 0) {
              diagnosticDataPresent = true;
            }
          }
        } catch {
          // Lecture diagnostique impossible
        }

        report.partialState = true;
        report.profileWritten = diagnosticDataPresent;

        if (diagnosticDataPresent) {
          throw new InternalBootstrapError('PARTIAL_WRITE_MANUAL_INTERVENTION_REQUIRED');
        } else {
          throw new InternalBootstrapError('PARTIAL_AMBIGUOUS_WRITE_FAILED');
        }
      }

      // Étape 5 & 6 : Relire le document cible et vérifier uid, email, status === 'active' et role === 'super_admin'
      try {
        const reloadedDoc = await targetDocRef.get();
        if (!reloadedDoc.exists) {
          throw new InternalBootstrapError('PROFILE_NOT_FOUND_AFTER_WRITE');
        }
        const reloadedData = reloadedDoc.data();

        if (reloadedData?.uid !== userRecord.uid) {
          throw new InternalBootstrapError('PROFILE_UID_MISMATCH');
        }

        if (
          typeof reloadedData?.email !== 'string' ||
          reloadedData.email.trim().toLowerCase() !== ALLOWED_SUPER_ADMIN_EMAIL.toLowerCase()
        ) {
          throw new InternalBootstrapError('PROFILE_EMAIL_MISMATCH');
        }

        if (reloadedData?.status !== 'active') {
          throw new InternalBootstrapError('PROFILE_STATUS_INVALID_AFTER_WRITE');
        }

        if (reloadedData?.role !== 'super_admin') {
          throw new InternalBootstrapError('PROFILE_ROLE_INVALID_AFTER_WRITE');
        }

        const diffs = deepCompareFirestoreData(finalProfileToSave, reloadedData);
        if (diffs.length > 0) {
          throw new InternalBootstrapError('PROFILE_STRUCTURAL_DIFF');
        }

        report.profileVerified = true;
      } catch (err: any) {
        report.partialState = true;
        if (isInternalBootstrapError(err)) {
          throw err;
        }
        throw new InternalBootstrapError('PROFILE_VERIFICATION_FAILED');
      }

      // Étape 7.1 : Seulement après toutes ces vérifications, attribuer le Custom Claim role: 'super_admin'
      try {
        await authSdk.setCustomUserClaims(userRecord.uid, expectedClaims);
        report.claimsUpdated = true;
      } catch {
        report.partialState = true;
        throw new InternalBootstrapError('CLAIMS_UPDATE_FAILED');
      }

      // Étape 7.2 : Relire et vérifier intégralement les Custom Claims
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
    report.errorCode = getSafeInternalErrorCode(err);
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
        console.error(`\n[FATAL] Échec critique non géré durant le bootstrap Super Admin${formatSanitizedErrorCode(err?.code)}.\n`);
        process.exit(1);
      });
  } catch (cliErr: any) {
    console.error(`\n[ERREUR CLI] ${sanitizeReportErrorMessage(cliErr)}\n`);
    process.exit(1);
  }
}
