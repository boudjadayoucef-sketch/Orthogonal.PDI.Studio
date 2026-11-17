/**
 * ORTHOGONAL PD&I STUDIO — SEC-01 / AUTH-ADMIN-05-FIX-10
 * Tests unitaires complets et isolés pour le script de Bootstrap Super Admin Zero-Trust.
 *
 * Ces tests s'exécutent avec `npm test` (Vitest) en environnement 100 % isolé et mocké,
 * sans aucune connexion ni opération sur Firebase production :
 * - FIX-06 B1 : Tests ISO stricts (fuseau obligatoire, calendrier réel, fraction 9 chiffres max, décalages UTC, égalité multi-fuseaux)
 * - FIX-06 B2 & FIX-10 : Fusion contrôlée par whitelist explicite, rejet des données commerciales, compteurs et privilèges non prouvés
 * - FIX-06 B3 : Validation croisée Auth / Firestore (getFirestoreProjectId)
 * - FIX-07 & FIX-08 : Non-divulgation, getters temporels hostiles, erreurs internes WeakMap, absence d'effet de bord à l'import
 * - FIX-10 : Durcissement Zero-Trust complet (EXPECTED_SUPER_ADMIN_UID indépendant, Preuves A et B, blocage des statuts négatifs,
 *   restauration conditionnelle de pending_activation, vérification post-écriture de uid/email/status/role avant setCustomUserClaims).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as bootstrapModule from '../../../scripts/bootstrapSuperAdmin.ts';
import {
  mergeProfileDataNonDestructive,
  deepCompareFirestoreData,
  areDatesOrTimestampsEqual,
  extractExactTime,
  getFirestoreProjectId,
  parseCliArgs,
  isDirectCliExecution,
  isProtectedCommercialField,
  isProtectedAuthorizationField,
  isForbiddenHistoricalField,
  compareClaimsStructural,
  isDangerousKey,
  createSafePlainObject,
  safeDefineProperty,
  runSuperAdminBootstrap,
  ALLOWED_SDK_ERROR_CODES,
  sanitizeSdkErrorCode,
  formatSanitizedErrorCode,
  GENERIC_EXTERNAL_ERROR,
  getSafeInternalMessage,
  getSafeInternalErrorCode,
  isInternalBootstrapError,
  sanitizeReportErrorMessage,
  hasOwnDataProperty,
  getOwnDataPropertyValue,
  hasOwnAccessorProperty,
  hasInheritedPropertyWithoutReading,
  inspectOwnDataProperty,
  inspectSafeTimeProperty,
  TIME_PROPERTIES,
  EXPECTED_PROJECT_ID,
  EXPECTED_DATABASE_ID,
  getFirestoreDatabaseId,
  ALLOWED_SUPER_ADMIN_EMAIL,
  HISTORICAL_PROFILE_DOC_ID,
  FORBIDDEN_HISTORICAL_AUTH_LEAF_KEYS,
  NEGATIVE_PROFILE_STATUSES,
  ALLOWED_HISTORICAL_PROFILE_FIELDS,
  ALLOWED_HISTORICAL_PROFILE_FIELD_SET,
  ALLOWED_TARGET_PROFILE_FIELDS,
  ALLOWED_TARGET_PROFILE_FIELD_SET,
  FORBIDDEN_UNVERIFIED_COMMERCIAL_PRIVILEGES,
  FORBIDDEN_UNVERIFIED_COMMERCIAL_KEYS,
  COMMERCIAL_TIER_AND_PLAN_KEYS,
  isExplicitlyForbiddenTargetField,
  sanitizeTargetFieldValue,
  hasContradictoryHistoricalUid,
  resolveExpectedSuperAdminUid,
  hasNegativeProfileStatus,
  isValidTargetAuthorizationProof,
  isValidHistoricalAuthorizationProof,
  verifyPreexistingAuthorizationProof
} from '../../../scripts/bootstrapSuperAdmin.ts';
import {
  adminDb as realServerAdminDb,
  adminAuth as realServerAdminAuth,
  EXPECTED_SERVER_PROJECT_ID,
  EXPECTED_SERVER_DATABASE_ID,
  validateServerProjectId,
  validateServerDatabaseId,
  validateServerFirebaseAppProjectId,
  getOrInitializeServerFirebaseApp,
  createServerAdminAuth,
  resolveServerFirestoreConfig,
  extractServerFirestoreProjectId,
  extractServerFirestoreDatabaseId,
  assertValidServerFirestoreInstance,
  createServerFirestoreClient
} from '../../lib/firebase-admin.ts';
import { Firestore, Timestamp as GCloudTimestamp } from '@google-cloud/firestore';
import { createWebhookIdempotencyRepository } from '../webhooks/webhookIdempotencyRepository.ts';
import fs from 'node:fs';

describe('AUTH-ADMIN-05-FIX-06 à FIX-10 : Suite de validation unitaire du Bootstrap Super Admin Zero-Trust', () => {
  const validUid = 'google_user_youcef_12345';
  const originalEnvExpectedUid = process.env.EXPECTED_SUPER_ADMIN_UID;

  let mockAuth: any;
  let mockDb: any;
  let store: Map<string, any>;
  let userRecordState: any;
  let callSequence: string[];

  beforeEach(() => {
    process.env.EXPECTED_SUPER_ADMIN_UID = validUid;
    store = new Map<string, any>();
    callSequence = [];

    userRecordState = {
      uid: validUid,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      emailVerified: true,
      disabled: false,
      providerData: [{ providerId: 'google.com' }],
      customClaims: {
        otherClaim: 'preserved_value',
        legacyTier: 'enterprise_auditor',
        features: ['cad_export', 'b31_8_audit'],
        orgContext: { id: 'dz_national_pdi', verified: true }
      }
    };

    mockAuth = {
      app: {
        options: {
          projectId: EXPECTED_PROJECT_ID
        }
      },
      getUserByEmail: vi.fn(async (email: string) => {
        callSequence.push(`auth.getUserByEmail:${email}`);
        if (email.toLowerCase() === userRecordState.email.toLowerCase()) {
          return { ...userRecordState };
        }
        const err: any = new Error('User not found');
        err.code = 'auth/user-not-found';
        throw err;
      }),
      getUser: vi.fn(async (uid: string) => {
        callSequence.push(`auth.getUser:${uid}`);
        if (uid === userRecordState.uid) {
          return { ...userRecordState };
        }
        throw new Error('User not found by UID');
      }),
      setCustomUserClaims: vi.fn(async (uid: string, claims: Record<string, any>) => {
        callSequence.push(`auth.setCustomUserClaims:${uid}`);
        if (uid === userRecordState.uid) {
          userRecordState.customClaims = { ...claims };
        }
      })
    };

    mockDb = {
      app: {
        options: {
          projectId: EXPECTED_PROJECT_ID
        }
      },
      projectId: EXPECTED_PROJECT_ID,
      databaseId: EXPECTED_DATABASE_ID,
      collection: vi.fn((colName: string) => {
        return {
          doc: vi.fn((docId: string) => {
            const key = `${colName}/${docId}`;
            return {
              get: vi.fn(async () => {
                callSequence.push(`firestore.get:${key}`);
                const data = store.get(key);
                return {
                  exists: data !== undefined,
                  data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
                };
              }),
              set: vi.fn(async (newData: any, options?: any) => {
                callSequence.push(`firestore.set:${key}`);
                const existing = store.get(key) || {};
                const merged = options?.merge ? { ...existing, ...newData } : { ...newData };
                store.set(key, JSON.parse(JSON.stringify(merged)));
              }),
              delete: vi.fn(async () => {
                callSequence.push(`firestore.delete:${key}`);
                store.delete(key);
              })
            };
          })
        };
      })
    };
  });

  afterEach(() => {
    if (originalEnvExpectedUid === undefined) {
      delete process.env.EXPECTED_SUPER_ADMIN_UID;
    } else {
      process.env.EXPECTED_SUPER_ADMIN_UID = originalEnvExpectedUid;
    }
  });

  // =========================================================================
  // 1. SÉCURITÉ DRY-RUN ET CONDITIONS PRÉALABLES (B4 & POINTS 1 À 6)
  // =========================================================================

  it('1. B4 — Dry-run sécurisé sans mutation : lectures seules Auth/Firestore, aucune écriture', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active',
      company: 'PD&I Vision DZ'
    });

    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(true);
    expect(report.mode).toBe('dry-run');
    expect(report.profileWritten).toBe(false);
    expect(report.profileVerified).toBe(false);
    expect(report.claimsUpdated).toBe(false);
    expect(report.claimsVerified).toBe(false);

    // Aucune mutation de Custom Claims
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    // Aucune écriture Firestore
    expect(store.get(`profiles/${validUid}`)).toBeUndefined();

    // Seules les opérations de lecture autorisées ont été invoquées
    expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(ALLOWED_SUPER_ADMIN_EMAIL);
    expect(callSequence).toContain(`auth.getUserByEmail:${ALLOWED_SUPER_ADMIN_EMAIL}`);
    expect(callSequence).toContain(`firestore.get:profiles/${HISTORICAL_PROFILE_DOC_ID}`);
    expect(callSequence).toContain(`firestore.get:profiles/${validUid}`);
    expect(callSequence.some(s => s.startsWith('firestore.set'))).toBe(false);
  });

  it('2. Refus d’un projet Firebase différent de graphical-router-x18qq', async () => {
    mockAuth.app.options.projectId = 'wrong-project-id';
    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[BLOCAGE PROJET]');
    expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('3. Refus d’un email différent de boudjada.youcef@gmail.com', async () => {
    const report = await runSuperAdminBootstrap({
      targetEmail: 'imposteur@autre.dz',
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[BLOCAGE EMAIL]');
    expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('4. Refus d’un compte désactivé', async () => {
    userRecordState.disabled = true;
    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('5. Refus d’un email non vérifié (propriété native)', async () => {
    userRecordState.emailVerified = false;
    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[EMAIL NON VÉRIFIÉ]');
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('6. Refus d’un compte sans fournisseur Google', async () => {
    userRecordState.providerData = [{ providerId: 'password' }];
    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[FOURNISSEUR INVALIDE]');
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 2. CORRECTION B1 : COMPARAISON TEMPORELLE EXACTE (NANOSECONDES, DATES, ISO)
  // =========================================================================

  it('7. B1 — Deux Timestamps Firestore strictement identiques sont déclarés égaux', () => {
    const ts1 = { _seconds: 1785571200, _nanoseconds: 123456789 };
    const ts2 = { _seconds: 1785571200, _nanoseconds: 123456789 };
    expect(areDatesOrTimestampsEqual(ts1, ts2)).toBe(true);
    expect(deepCompareFirestoreData({ time: ts1 }, { time: ts2 })).toEqual([]);
  });

  it('8. B1 — Deux Timestamps différant de 1 nanoseconde sont rejetés', () => {
    const ts1 = { _seconds: 1785571200, _nanoseconds: 500000000 };
    const ts2 = { _seconds: 1785571200, _nanoseconds: 500000001 };
    expect(areDatesOrTimestampsEqual(ts1, ts2)).toBe(false);
    const diffs = deepCompareFirestoreData({ time: ts1 }, { time: ts2 });
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain('Horodatage non conforme');
  });

  it('9. B1 — Deux Timestamps différant de 500 000 nanosecondes (même milliseconde) sont rejetés', () => {
    const ts1 = { _seconds: 1785571200, _nanoseconds: 100000 };
    const ts2 = { _seconds: 1785571200, _nanoseconds: 600000 };
    expect(areDatesOrTimestampsEqual(ts1, ts2)).toBe(false);
    const diffs = deepCompareFirestoreData({ time: ts1 }, { time: ts2 });
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain('Horodatage non conforme');
  });

  it('10. B1 — Date égale à Timestamp exactement représentable est acceptée', () => {
    const date = new Date(1785571200123);
    const tsExact = { _seconds: 1785571200, _nanoseconds: 123000000 };
    expect(areDatesOrTimestampsEqual(date, tsExact)).toBe(true);
    expect(deepCompareFirestoreData({ createdAt: date }, { createdAt: tsExact })).toEqual([]);
  });

  it('11. B1 — Date comparée à Timestamp avec précision supplémentaire sub-milliseconde est rejetée', () => {
    const date = new Date(1785571200123);
    const tsExtraPrecision = { _seconds: 1785571200, _nanoseconds: 123000042 };
    expect(areDatesOrTimestampsEqual(date, tsExtraPrecision)).toBe(false);
    const diffs = deepCompareFirestoreData({ createdAt: date }, { createdAt: tsExtraPrecision });
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain('Horodatage non conforme');
  });

  it('12. B1 — Timestamp comparé à chaîne ISO : accepté si instant exact, rejeté si précision masquée', () => {
    const isoMs = '2026-08-01T08:00:00.123Z';
    const tsMs = { _seconds: 1785571200, _nanoseconds: 123000000 };
    expect(areDatesOrTimestampsEqual(isoMs, tsMs)).toBe(true);

    const tsSubMs = { _seconds: 1785571200, _nanoseconds: 123500000 };
    expect(areDatesOrTimestampsEqual(isoMs, tsSubMs)).toBe(false);

    const isoNs = '2026-08-01T08:00:00.123456789Z';
    const tsFullNs = { _seconds: 1785571200, _nanoseconds: 123456789 };
    expect(areDatesOrTimestampsEqual(isoNs, tsFullNs)).toBe(true);
  });

  it('13. B1 — Rejet des dates invalides et formats temporels ambigus', () => {
    const invalidDate = new Date('date-invalide-non-parsable');
    const validTs = { _seconds: 1785571200, _nanoseconds: 0 };
    expect(areDatesOrTimestampsEqual(invalidDate, validTs)).toBe(false);
    expect(areDatesOrTimestampsEqual(invalidDate, invalidDate)).toBe(false);

    const badIso = '2026/08/01 08:00:00';
    expect(areDatesOrTimestampsEqual(badIso, validTs)).toBe(false);

    const diffs = deepCompareFirestoreData({ d: invalidDate }, { d: validTs });
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain('Horodatage non conforme');
  });

  it('14. B1 — Rejet des Timestamps malformés (nanosecondes négatives, non entières, hors limites)', () => {
    const malformed1 = { _seconds: 1785571200, _nanoseconds: -10 };
    const malformed2 = { _seconds: 1785571200, _nanoseconds: 1000000000 };
    const malformed3 = { _seconds: 'pas-un-nombre', _nanoseconds: 0 };
    const validTs = { _seconds: 1785571200, _nanoseconds: 0 };

    expect(areDatesOrTimestampsEqual(malformed1, validTs)).toBe(false);
    expect(areDatesOrTimestampsEqual(malformed2, validTs)).toBe(false);
    expect(areDatesOrTimestampsEqual(malformed3, validTs)).toBe(false);
  });

  // =========================================================================
  // FIX-06 B1 : TESTS ISO STRICTS SPÉCIFIQUES
  // =========================================================================

  it('FIX-06 B1 — exige un fuseau horaire explicite', () => {
    expect(extractExactTime('2026-11-08T10:30:00')).toBeNull();
  });

  it('FIX-06 B1 — rejette les dates calendaires impossibles', () => {
    expect(extractExactTime('2026-02-30T10:00:00Z')?.valid).toBe(false);
    expect(extractExactTime('2026-04-31T10:00:00Z')?.valid).toBe(false);
  });

  it('FIX-06 B1 — accepte neuf chiffres et rejette dix chiffres fractionnaires', () => {
    expect(extractExactTime('2026-08-01T08:00:00.123456789Z')?.valid).toBe(true);
    expect(extractExactTime('2026-08-01T08:00:00.1234567890Z')).toBeNull();
  });

  it('FIX-06 B1 — rejette les décalages horaires hors limites', () => {
    expect(extractExactTime('2026-08-01T08:00:00+15:00')?.valid).toBe(false);
    expect(extractExactTime('2026-08-01T08:00:00+02:60')?.valid).toBe(false);
  });

  it('FIX-06 B1 — compare deux fuseaux représentant le même instant', () => {
    expect(areDatesOrTimestampsEqual(
      '2026-08-01T08:00:00.123456789Z',
      '2026-08-01T10:00:00.123456789+02:00'
    )).toBe(true);
  });

  // =========================================================================
  // 3. FUSION CONTRÔLÉE PAR WHITELIST & REJET DES CHAMPS COMMERCIAUX / COMPTEURS
  // =========================================================================

  it('15. B2 & FIX-10 — Exclusion absolue des données commerciales, compteurs et propriétés hors whitelist', () => {
    const targetData = {
      uid: validUid,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      status: 'pending_activation',
      name: 'Youcef Boudjada'
    };

    const historicalData = {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active',
      accountType: 'enterprise',
      subscriptionPlan: 'lifetime',
      paymentGateway: 'slickpay_baridimob',
      currency: 'DZD',
      storageUsedKb: 204800,
      loginCount: 42,
      projectsCount: 18,
      licenses: ['lic_normative_b31_8', 'lic_cad_iso'],
      assignedPlan: 'ENTERPRISE',
      maxUsers: 50,
      billing: {
        customerId: 'cus_slickpay_987654',
        currentBalance: 15000,
        billingCycle: 'yearly'
      },
      billingCounters: { usedExportHours: 120 },
      invoices: [{ invoiceId: 'inv_dz_2026_01' }],
      metadata: {
        paymentStatus: 'paid_baridimob',
        lastUpdatedBy: 'auditor_pdi'
      },
      department: 'Direction Technique Pipelines',
      company: 'PD&I Vision DZ',
      city: 'Alger'
    };

    const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

    // Champs commerciaux et compteurs strictement exclus
    expect(result.mergedData.accountType).toBeUndefined();
    expect(result.mergedData.subscriptionPlan).toBeUndefined();
    expect(result.mergedData.paymentGateway).toBeUndefined();
    expect(result.mergedData.currency).toBeUndefined();
    expect(result.mergedData.storageUsedKb).toBeUndefined();
    expect(result.mergedData.loginCount).toBeUndefined();
    expect(result.mergedData.projectsCount).toBeUndefined();
    expect(result.mergedData.licenses).toBeUndefined();
    expect(result.mergedData.assignedPlan).toBeUndefined();
    expect(result.mergedData.maxUsers).toBeUndefined();
    expect(result.mergedData.billing).toBeUndefined();
    expect(result.mergedData.billingCounters).toBeUndefined();
    expect(result.mergedData.invoices).toBeUndefined();
    expect(result.mergedData.metadata).toBeUndefined();

    // Seuls les champs de la whitelist et les 4 champs d'autorité vérifiés sont présents
    expect(result.mergedData.uid).toBe(validUid);
    expect(result.mergedData.email).toBe(ALLOWED_SUPER_ADMIN_EMAIL);
    expect(result.mergedData.status).toBe('active');
    expect(result.mergedData.role).toBe('super_admin');
    expect(result.mergedData.name).toBe('Youcef Boudjada');
    expect(result.mergedData.company).toBe('PD&I Vision DZ');
    expect(result.mergedData.department).toBe('Direction Technique Pipelines');
    expect(result.mergedData.city).toBe('Alger');
    expect(result.recoveredFields).toContain('company');
    expect(result.recoveredFields).toContain('department');
    expect(result.recoveredFields).toContain('city');
  });

  it('16. B2 & FIX-10 — Consigne les conflits commerciaux et n’attribue jamais enterprise ni lifetime', () => {
    const targetData = {
      uid: validUid,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      status: 'pending_activation',
      accountType: 'basic',
      subscriptionPlan: 'monthly',
      paymentGateway: 'paddle',
      currency: 'USD',
      storageUsedKb: 0,
      billing: {
        customerId: 'target_paddle_cus_1'
      },
      name: 'Youcef Boudjada'
    };

    const historicalData = {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active',
      accountType: 'enterprise',
      subscriptionPlan: 'lifetime',
      paymentGateway: 'slickpay_baridimob',
      currency: 'DZD',
      storageUsedKb: 500000,
      billing: {
        customerId: 'hist_slickpay_old'
      }
    };

    const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

    // R1 : Les champs cibles légitimes non privilégiés sont préservés non destructivement,
    // tandis qu'aucun privilège commercial non prouvé ('enterprise', 'lifetime') de l'historique n'est attribué.
    expect(result.mergedData.accountType).toBe('basic');
    expect(result.mergedData.subscriptionPlan).toBe('monthly');
    expect(result.mergedData.paymentGateway).toBe('paddle');
    expect(result.mergedData.currency).toBe('USD');
    expect(result.mergedData.storageUsedKb).toBe(0);
    expect(result.mergedData.billing).toEqual({ customerId: 'target_paddle_cus_1' });
    expect(result.mergedData.status).toBe('active');
    expect(result.mergedData.role).toBe('super_admin');

    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'accountType', conflictCategory: 'commercial' }),
        expect.objectContaining({ field: 'subscriptionPlan', conflictCategory: 'commercial' }),
        expect.objectContaining({ field: 'paymentGateway', conflictCategory: 'commercial' }),
        expect.objectContaining({ field: 'currency', conflictCategory: 'commercial' }),
        expect.objectContaining({ field: 'storageUsedKb', conflictCategory: 'commercial' }),
        expect.objectContaining({ field: 'billing', conflictCategory: 'commercial' })
      ])
    );
  });

  // =========================================================================
  // FIX-06 B3 : TESTS DE COHÉRENCE AUTH / FIRESTORE
  // =========================================================================

  it('FIX-06 B3 — reconnaît le projet Firestore autorisé', () => {
    expect(getFirestoreProjectId({
      projectId: EXPECTED_PROJECT_ID,
      _settings: { projectId: EXPECTED_PROJECT_ID }
    })).toBe(EXPECTED_PROJECT_ID);
  });

  it('FIX-06 B3 — refuse un Firestore rattaché à un autre projet avant toute lecture', async () => {
    const wrongDb = {
      ...mockDb,
      app: { options: { projectId: 'wrong-project-id' } }
    };

    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: wrongDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[BLOCAGE PROJET]');
    expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
    expect(mockDb.collection).not.toHaveBeenCalled();
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('FIX-06 B3 — refuse un projet Firestore impossible à identifier', async () => {
    const unverifiableDb = { ...mockDb, app: undefined };

    const report = await runSuperAdminBootstrap({
      authInstance: mockAuth,
      firestoreInstance: unverifiableDb
    });

    expect(report.success).toBe(false);
    expect(report.error).toContain('[BLOCAGE PROJET]');
    expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 4. VÉRIFICATION INTÉGRALE DES DOCUMENTS ET ÉTATS PARTIELS
  // =========================================================================

  it('17. Détection stricte des champs supplémentaires inattendus', () => {
    const expected = { uid: 'user_1', name: 'Youcef' };
    const actualWithExtra = { uid: 'user_1', name: 'Youcef', unexpectedField: 'ghost' };
    const diffs = deepCompareFirestoreData(expected, actualWithExtra);
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain('Champ supplémentaire inattendu');
  });

  it('18. Rejet en cas de champ inattendu après écriture (profileVerified = false, partialState = true)', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active'
    });

    mockDb.collection = vi.fn(() => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn(async () => {
          if (docId === validUid && store.has(`profiles/${validUid}`)) {
            const data = store.get(`profiles/${validUid}`);
            return {
              exists: true,
              data: () => ({ ...data, rogueField: 'mutation_non_attendue' })
            };
          }
          const data = store.get(`profiles/${docId}`);
          return { exists: data !== undefined, data: () => data };
        }),
        set: vi.fn(async (newData: any) => {
          store.set(`profiles/${docId}`, newData);
        })
      }))
    }));

    const report = await runSuperAdminBootstrap({
      execute: true,
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.profileWritten).toBe(true);
    expect(report.profileVerified).toBe(false);
    expect(report.partialState).toBe(true);
    expect(report.error).toContain('[ÉTAT PARTIEL]');
    expect(report.error).toContain('Divergence structurelle du profil relu');
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('19. Échec d’attribution des Custom Claims après écriture -> partialState: true', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active'
    });

    mockAuth.setCustomUserClaims = vi.fn(async () => {
      throw new Error('Firebase Auth RPC error [UNAVAILABLE]');
    });

    const report = await runSuperAdminBootstrap({
      execute: true,
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(false);
    expect(report.profileWritten).toBe(true);
    expect(report.profileVerified).toBe(true);
    expect(report.claimsUpdated).toBe(false);
    expect(report.partialState).toBe(true);
    expect(report.error).toContain('[ÉTAT PARTIEL]');
  });

  it('20. Écriture Firestore avant attribution du claim : ordre strict respecté', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active',
      company: 'PD&I Vision DZ'
    });

    const report = await runSuperAdminBootstrap({
      execute: true,
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(true);
    expect(report.profileWritten).toBe(true);
    expect(report.profileVerified).toBe(true);
    expect(report.claimsUpdated).toBe(true);
    expect(report.claimsVerified).toBe(true);
    expect(report.partialState).toBeUndefined();

    const setFirestoreIndex = callSequence.findIndex(s => s === `firestore.set:profiles/${validUid}`);
    const verifyFirestoreIndex = callSequence.findIndex((s, idx) => idx > setFirestoreIndex && s === `firestore.get:profiles/${validUid}`);
    const setClaimsIndex = callSequence.findIndex((s, idx) => idx > verifyFirestoreIndex && s === `auth.setCustomUserClaims:${validUid}`);
    const verifyClaimsIndex = callSequence.findIndex((s, idx) => idx > setClaimsIndex && s === `auth.getUser:${validUid}`);

    expect(setFirestoreIndex).toBeGreaterThan(-1);
    expect(verifyFirestoreIndex).toBeGreaterThan(setFirestoreIndex);
    expect(setClaimsIndex).toBeGreaterThan(verifyFirestoreIndex);
    expect(verifyClaimsIndex).toBeGreaterThan(setClaimsIndex);
  });

  // =========================================================================
  // 5. CORRECTION B3 : TEST RÉEL DE L'ABSENCE D'EFFET DE BORD À L'IMPORT (INSTRUMENTÉ)
  // =========================================================================

  it('21. B3 — Test d’import isolé instrumenté : aucun appel Auth, aucune lecture/écriture Firestore', () => {
    const probeScript = `
      import('./src/lib/firebase-admin.ts').then(async ({ adminAuth, adminDb }) => {
        const calls = [];
        adminAuth.getUserByEmail = () => { calls.push('auth.getUserByEmail'); };
        adminAuth.getUser = () => { calls.push('auth.getUser'); };
        adminAuth.setCustomUserClaims = () => { calls.push('auth.setCustomUserClaims'); };
        const origCol = adminDb.collection.bind(adminDb);
        adminDb.collection = (name) => {
          calls.push('firestore.collection:' + name);
          return origCol(name);
        };
        const mod = await import('./scripts/bootstrapSuperAdmin.ts');
        console.log(JSON.stringify({
          status: 'CLEAN_ISOLATED_IMPORT',
          calls,
          hasBootstrapFn: typeof mod.runSuperAdminBootstrap === 'function'
        }));
      });
    `;

    const rawOutput = execFileSync('npx', ['tsx', '-e', probeScript], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const parsed = JSON.parse(rawOutput.trim());
    expect(parsed.status).toBe('CLEAN_ISOLATED_IMPORT');
    expect(parsed.calls).toEqual([]);
    expect(parsed.hasBootstrapFn).toBe(true);
  });

  it('22. Conservation et vérification de TOUS les Custom Claims existants (pas seulement role)', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      status: 'active'
    });

    userRecordState.customClaims = {
      tenantId: 'pdi_algeria_hub',
      accessTier: 4,
      isStaff: true,
      permissions: ['read', 'write', 'audit_export'],
      preferences: { allowDevTools: true }
    };

    const report = await runSuperAdminBootstrap({
      execute: true,
      authInstance: mockAuth,
      firestoreInstance: mockDb
    });

    expect(report.success).toBe(true);
    expect(report.claimsVerified).toBe(true);
    expect(userRecordState.customClaims.role).toBe('super_admin');
    expect(userRecordState.customClaims.tenantId).toBe('pdi_algeria_hub');
    expect(userRecordState.customClaims.accessTier).toBe(4);
    expect(userRecordState.customClaims.isStaff).toBe(true);
    expect(userRecordState.customClaims.permissions).toEqual(['read', 'write', 'audit_export']);
    expect(userRecordState.customClaims.preferences).toEqual({ allowDevTools: true });
  });

  // =========================================================================
  // 6. VALIDATION DES ARGUMENTS CLI ET DÉTECTION D'EXÉCUTION DIRECTE
  // =========================================================================

  it('23. Validation stricte des arguments CLI parseCliArgs', () => {
    expect(parseCliArgs([])).toEqual({ isExecute: false });
    expect(parseCliArgs(['--dry-run'])).toEqual({ isExecute: false });
    expect(parseCliArgs(['--execute'])).toEqual({ isExecute: true });

    expect(() => parseCliArgs(['--unknown-flag'])).toThrow('Argument CLI non reconnu');
    expect(() => parseCliArgs(['positional-arg'])).toThrow('Argument positionnel non autorisé');
    expect(() => parseCliArgs(['--execute', '--dry-run'])).toThrow('Options CLI incompatibles');
    expect(() => parseCliArgs(['--execute', '--execute'])).toThrow("L'option execute doit être fournie seule");
  });

  it('24. Détection robuste de l’exécution directe CLI avec node:path et node:url', () => {
    const fakeScriptPath = resolve(process.cwd(), 'scripts/bootstrapSuperAdmin.ts');
    const fakeScriptUrl = pathToFileURL(fakeScriptPath).href;

    expect(isDirectCliExecution(fakeScriptUrl, 'scripts/bootstrapSuperAdmin.ts')).toBe(true);
    expect(isDirectCliExecution(fakeScriptUrl, fakeScriptPath)).toBe(true);

    expect(isDirectCliExecution(fakeScriptUrl, 'node_modules/vitest/dist/cli.js')).toBe(false);
    expect(isDirectCliExecution(fakeScriptUrl, undefined)).toBe(false);
  });

  // =========================================================================
  // 7. AUTH-ADMIN-05-FIX-07 : TESTS UNITAIRES DES CORRECTIFS A À G
  // =========================================================================

  describe('FIX-07-A : Échec ambigu de l’écriture Firestore', () => {
    it('signale partialState: true et requiert intervention si targetDocRef.set() échoue mais que les données sont constatées', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        company: 'PD&I Vision DZ'
      });

      const originalCol = mockDb.collection.bind(mockDb);
      mockDb.collection = (colName: string) => {
        const col = originalCol(colName);
        const originalDoc = col.doc.bind(col);
        col.doc = (docId: string) => {
          const docObj = originalDoc(docId);
          if (docId === validUid) {
            docObj.set = vi.fn(async (data: any) => {
              store.set(`profiles/${validUid}`, JSON.parse(JSON.stringify(data)));
              throw new Error('DEADLINE_EXCEEDED : Timeout de confirmation Firestore');
            });
          }
          return docObj;
        };
        return col;
      };

      const report = await runSuperAdminBootstrap({
        execute: true,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.partialState).toBe(true);
      expect(report.profileWritten).toBe(true);
      expect(report.claimsUpdated).toBe(false);
      expect(report.claimsVerified).toBe(false);
      expect(report.error).toContain('[ÉTAT PARTIEL - INTERVENTION REQUISE]');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('signale partialState: true et échec ambigu si targetDocRef.set() échoue et que les données ne sont pas présentes', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        company: 'PD&I Vision DZ'
      });

      const originalCol = mockDb.collection.bind(mockDb);
      mockDb.collection = (colName: string) => {
        const col = originalCol(colName);
        const originalDoc = col.doc.bind(col);
        col.doc = (docId: string) => {
          const docObj = originalDoc(docId);
          if (docId === validUid) {
            docObj.set = vi.fn(async () => {
              throw new Error('UNAVAILABLE : Service Firestore inaccessible');
            });
          }
          return docObj;
        };
        return col;
      };

      const report = await runSuperAdminBootstrap({
        execute: true,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.partialState).toBe(true);
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(report.error).toContain('[ÉTAT PARTIEL - ÉCHEC ÉCRITURE AMBIGU]');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  describe('FIX-07-B & FIX-07-G : Comparaison structurelle des Custom Claims', () => {
    it('accepte deux objets de claims ayant les mêmes propriétés dans un ordre différent', () => {
      const expected = { role: 'super_admin', tier: 4, isStaff: true };
      const actual = { isStaff: true, role: 'super_admin', tier: 4 };

      const diffs = compareClaimsStructural(expected, actual);
      expect(diffs).toEqual([]);
    });

    it('détecte un claim attendu manquant', () => {
      const expected = { role: 'super_admin', legacyClaim: 'keep_me' };
      const actual = { role: 'super_admin' };

      const diffs = compareClaimsStructural(expected, actual);
      expect(diffs.length).toBe(1);
      expect(diffs[0]).toContain('Claim attendu manquant');
    });

    it('détecte impérativement un claim supplémentaire inattendu', () => {
      const expected = { role: 'super_admin' };
      const actual = { role: 'super_admin', rogueClaim: 'infiltrated' };

      const diffs = compareClaimsStructural(expected, actual);
      expect(diffs.length).toBe(1);
      expect(diffs[0]).toContain('Claim supplémentaire inattendu');
    });

    it('distingue strictement les types et ne confond pas null avec undefined', () => {
      expect(compareClaimsStructural({ flag: 1 }, { flag: '1' }).length).toBeGreaterThan(0);
      expect(compareClaimsStructural({ flag: true }, { flag: 1 }).length).toBeGreaterThan(0);
      expect(compareClaimsStructural({ flag: null }, { flag: undefined }).length).toBeGreaterThan(0);
    });

    it('compare strictement les éléments et positions des tableaux de claims', () => {
      const expected = { permissions: ['read', 'write'] };
      const actualInverted = { permissions: ['write', 'read'] };

      const diffs = compareClaimsStructural(expected, actualInverted);
      expect(diffs.length).toBeGreaterThan(0);
    });

    it('arrête avec partialState: true si la relecture des Custom Claims après mutation révèle un claim inattendu', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      mockAuth.getUser = vi.fn(async () => {
        return {
          ...userRecordState,
          customClaims: {
            ...userRecordState.customClaims,
            role: 'super_admin',
            unexpectedBackendClaim: 'rogue'
          }
        };
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(true);
      expect(report.claimsUpdated).toBe(true);
      expect(report.claimsVerified).toBe(false);
      expect(report.partialState).toBe(true);
      expect(report.error).toContain('Divergence structurelle des Custom Claims relus');
    });
  });

  describe('FIX-07-C & FIX-10 : Protection des champs d’autorisation historiques', () => {
    it('identifie tous les champs d’autorisation historiques protégés de la liste', () => {
      const requiredAuthFields = [
        'role',
        'roles',
        'admin',
        'isAdmin',
        'isSuperAdmin',
        'permissions',
        'customClaims',
        'accessLevel',
        'privileges',
        'authorization',
        'authorizations',
        'securityRole',
        'adminRole'
      ];

      for (const field of requiredAuthFields) {
        expect(isProtectedAuthorizationField(field)).toBe(true);
        expect(isForbiddenHistoricalField(field)).toBe(true);
      }
    });

    it('n’importe aucun champ d’autorisation additionnel depuis l’historique (roles, permissions, privileges, etc.)', () => {
      const targetData = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'pending_activation',
        company: 'PD&I Tech'
      };

      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        roles: ['admin', 'owner'],
        admin: true,
        isAdmin: true,
        isSuperAdmin: true,
        permissions: ['all', 'root'],
        customClaims: { role: 'super_admin' },
        accessLevel: 'level_5',
        privileges: ['grant_roles'],
        authorization: { scope: 'full' },
        authorizations: ['billing_admin'],
        securityRole: 'sec_officer',
        adminRole: 'super_user',
        city: 'Alger'
      };

      const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

      expect(result.mergedData.role).toBe('super_admin');
      expect(result.mergedData.status).toBe('active');
      expect(result.mergedData.roles).toBeUndefined();
      expect(result.mergedData.admin).toBeUndefined();
      expect(result.mergedData.isAdmin).toBeUndefined();
      expect(result.mergedData.isSuperAdmin).toBeUndefined();
      expect(result.mergedData.permissions).toBeUndefined();
      expect(result.mergedData.customClaims).toBeUndefined();
      expect(result.mergedData.accessLevel).toBeUndefined();
      expect(result.mergedData.privileges).toBeUndefined();
      expect(result.mergedData.authorization).toBeUndefined();
      expect(result.mergedData.authorizations).toBeUndefined();
      expect(result.mergedData.securityRole).toBeUndefined();
      expect(result.mergedData.adminRole).toBeUndefined();
      expect(result.mergedData.city).toBe('Alger');
    });
  });

  describe('FIX-07-D : Validation stricte du compte désactivé', () => {
    it('refuse un compte dont la propriété disabled est undefined', async () => {
      userRecordState.disabled = undefined;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('refuse un compte dont la propriété disabled est null', async () => {
      userRecordState.disabled = null;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('refuse un compte dont la propriété disabled est une chaîne de caractères', async () => {
      userRecordState.disabled = 'false' as any;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('accepte uniquement lorsque disabled vaut strictement false (booléen)', async () => {
      userRecordState.disabled = false;
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin'
      });
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.disabled).toBe(false);
      expect(report.success).toBe(true);
    });
  });

  describe('FIX-07-E : Réduction des données exposées dans les rapports', () => {
    it('ne contient jamais finalProfileToSave dans le rapport', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        secretNote: 'TopSecretHistoricalData'
      });

      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect((report as any).finalProfileToSave).toBeUndefined();
    });

    it('ne contient aucune valeur brute cible ou historique dans conflictsDetected', () => {
      const targetData = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        company: 'TargetSecretCompany123'
      };
      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        company: 'HistoricalSecretCompany999'
      };

      const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

      expect(result.conflicts.length).toBe(1);
      const conflict = result.conflicts[0];
      expect(conflict.field).toBe('company');
      expect(conflict.valuesDiffer).toBe(true);
      expect((conflict as any).targetValue).toBeUndefined();
      expect((conflict as any).historicalValue).toBeUndefined();
    });

    it('expose uniquement les noms des clés de claims (existingClaimKeys, updatedClaimKeys)', async () => {
      userRecordState.customClaims = {
        tenantId: 'algeria_hub',
        confidentialData: 'private'
      };
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin'
      });

      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.existingClaimKeys).toEqual(['tenantId', 'confidentialData']);
      expect(report.updatedClaimKeys).toEqual(['tenantId', 'confidentialData', 'role']);
      expect((report as any).existingClaims).toBeUndefined();
      expect((report as any).updatedClaims).toBeUndefined();
    });
  });

  describe('FIX-07-F : Protection contre la pollution de prototype', () => {
    it('ignore __proto__, constructor et prototype lors de la fusion par whitelist', () => {
      const maliciousData = JSON.parse(
        `{"uid":"${HISTORICAL_PROFILE_DOC_ID}","email":"${ALLOWED_SUPER_ADMIN_EMAIL}","role":"super_admin","status":"active","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"prototype":{"polluted":"yes"},"company":"Valid Company"}`
      );

      const result = mergeProfileDataNonDestructive(validUid, null, maliciousData);

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(result.mergedData.company).toBe('Valid Company');
      expect(Object.getPrototypeOf(result.mergedData)).toBe(Object.prototype);
      expect(Object.keys(result.mergedData)).not.toContain('__proto__');
      expect(Object.keys(result.mergedData)).not.toContain('constructor');
      expect(Object.keys(result.mergedData)).not.toContain('prototype');
    });

    it('détecte correctement toutes les clés dangereuses avec isDangerousKey', () => {
      expect(isDangerousKey('__proto__')).toBe(true);
      expect(isDangerousKey('constructor')).toBe(true);
      expect(isDangerousKey('prototype')).toBe(true);
      expect(isDangerousKey('constructorName')).toBe(false);
      expect(isDangerousKey('prototypeVersion')).toBe(false);
      expect(isDangerousKey('safeField')).toBe(false);
    });
  });

  // =========================================================================
  // 8. AUTH-ADMIN-05-FIX-08 : NON-DIVULGATION ET GETTERS HOSTILES
  // =========================================================================

  describe('AUTH-ADMIN-05-FIX-08 : Non-divulgation et propriétés propres', () => {
    it('FIX-08-A : aucune valeur brute dans les messages de compareClaimsStructural', () => {
      const secret = 'FIX08_PRIVATE_VALUE_9f71';
      const diffs = compareClaimsStructural(
        { privateField: secret },
        { privateField: 'different-value' }
      );
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.join(' ')).not.toContain(secret);
      expect(diffs.join(' ')).not.toContain('different-value');
      expect(diffs[0]).toContain('Claim non conforme : valeur différente.');
    });

    it('FIX-08-B : aucune valeur brute dans les messages de deepCompareFirestoreData', () => {
      const secret = 'FIX08_SECRET_FIRESTORE_DATA_a78c';
      const diffs = deepCompareFirestoreData(
        { secretField: secret, ts: new Date(1785571200000) },
        { secretField: 'different-data', ts: new Date(1785571300000) }
      );
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.join(' ')).not.toContain(secret);
      expect(diffs.join(' ')).not.toContain('different-data');
      expect(diffs.join(' ')).not.toContain('1785571200000');
      expect(diffs.join(' ')).not.toContain('1785571300000');
    });

    it('FIX-08-C : les propriétés héritées ne satisfont pas les comparaisons dans compareClaimsStructural et deepCompareFirestoreData', () => {
      const proto = { inheritedClaim: 'secret_val', inheritedField: 'proto_field' };
      const actualClaim = Object.create(proto);
      actualClaim.role = 'super_admin';

      const claimDiffs = compareClaimsStructural(
        { role: 'super_admin', inheritedClaim: 'secret_val' },
        actualClaim
      );
      expect(claimDiffs.length).toBe(1);
      expect(claimDiffs[0]).toContain('Claim attendu manquant');

      const actualDoc = Object.create(proto);
      actualDoc.name = 'target_user';

      const docDiffs = deepCompareFirestoreData(
        { name: 'target_user', inheritedField: 'proto_field' },
        actualDoc
      );
      expect(docDiffs.length).toBe(1);
      expect(docDiffs[0]).toContain('Champ attendu manquant');
    });

    it('FIX-08-G : absence d’email et d’UID dans le rapport final', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        company: 'PD&I Tech'
      });

      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect((report as any).email).toBeUndefined();
      expect((report as any).uid).toBeUndefined();

      const reportJson = JSON.stringify(report);
      expect(reportJson).not.toContain(ALLOWED_SUPER_ADMIN_EMAIL);
      expect(reportJson).not.toContain(validUid);
    });

    it('FIX-08-H : les erreurs remontées dans report.error ne divulguent aucune valeur brute ni secret', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      mockAuth.getUser = vi.fn(async () => {
        return {
          ...userRecordState,
          customClaims: {
            ...userRecordState.customClaims,
            role: 'super_admin',
            rogueKeySecret: 'SUPER_SECRET_PAYMENT_DATA_TOKEN_999'
          }
        };
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toBeDefined();
      expect(report.error).not.toContain('SUPER_SECRET_PAYMENT_DATA_TOKEN_999');
      expect(report.error).toContain('Divergence structurelle des Custom Claims relus');
      expect(report.error).not.toContain('rogueKeySecret');
    });
  });

  // =========================================================================
  // AUTH-ADMIN-05-FIX-08-R3 : CORRECTIFS B1 / B2 / B3
  // =========================================================================
  describe('AUTH-ADMIN-05-FIX-08-R3 : Correctifs stricts B1 / B2 / B3', () => {
    const PRIVATE_EMAIL_SENTINEL = 'secret_private_admin@gmail.com';
    const PRIVATE_UID_SENTINEL = 'user_internal_credential_uid_98765';
    const PRIVATE_SECRET_SENTINEL = 'bearer_token_stripe_prod_secret_key_abcdef123456';

    describe('B1 : Verrouillage absolu de sanitizeSdkErrorCode (fail-closed)', () => {
      it('B1 — valide tous les codes SDK autorisés de la liste blanche', () => {
        expect(sanitizeSdkErrorCode('auth/user-not-found')).toBe('auth/user-not-found');
        expect(sanitizeSdkErrorCode('UNAVAILABLE')).toBe('unavailable');
        expect(sanitizeSdkErrorCode('permission-denied')).toBe('permission-denied');
        expect(sanitizeSdkErrorCode('RESOURCE_EXHAUSTED')).toBe('resource_exhausted');
        expect(sanitizeSdkErrorCode('resource-exhausted')).toBe('resource-exhausted');
        expect(sanitizeSdkErrorCode('  auth/invalid-credential  ')).toBe('auth/invalid-credential');
        expect(sanitizeSdkErrorCode('deadline-exceeded')).toBe('deadline-exceeded');
        expect(sanitizeSdkErrorCode('internal')).toBe('internal');
      });

      it('B1 — rejette strictement les sentinelles secrètes obligatoires', () => {
        const forbiddenSdkCodes = [
          'PRIVATE_SECRET_SENTINEL',
          'PRIVATE_UID_SENTINEL',
          'PRIVATE_EMAIL_SENTINEL',
          'bearer_token_stripe_prod_secret_key_abcdef123456',
          'arbitrary-private-diagnostic'
        ];

        for (const code of forbiddenSdkCodes) {
          expect(sanitizeSdkErrorCode(code)).toBeUndefined();
        }
      });

      it('B1 — formatSanitizedErrorCode formate correctement ou retourne une chaîne vide', () => {
        expect(formatSanitizedErrorCode('auth/user-not-found')).toBe(' (code: auth/user-not-found)');
        expect(formatSanitizedErrorCode('INVALID_UNAUTHORIZED_CODE')).toBe('');
        expect(formatSanitizedErrorCode(PRIVATE_SECRET_SENTINEL)).toBe('');
        expect(formatSanitizedErrorCode(undefined)).toBe('');
      });
    });

    describe('B2 : Blocage strict des getters dans extractExactTime et inspection sécurisée', () => {
      it('B2 Test A — ne déclenche JAMAIS un getter seconds hérité', () => {
        let getterCalled = false;
        const object = Object.create({
          get seconds() {
            getterCalled = true;
            throw new Error('PRIVATE_GETTER_SENTINEL');
          }
        });

        expect(() => extractExactTime(object)).not.toThrow('PRIVATE_GETTER_SENTINEL');
        const res = extractExactTime(object);
        expect(res?.valid).toBe(false);
        expect(res?.error).toBe('Propriétés temporelles héritées non autorisées');
        expect(getterCalled).toBe(false);
      });

      it('B2 Test B — ne déclenche JAMAIS de getters propres et hérités sur toutes les TIME_PROPERTIES', () => {
        for (const prop of TIME_PROPERTIES) {
          let inheritedCalled = false;
          const proto = {};
          Object.defineProperty(proto, prop, {
            get() {
              inheritedCalled = true;
              throw new Error(`SENTINEL_INHERITED_${prop}`);
            },
            configurable: true,
            enumerable: true
          });
          const childObj = Object.create(proto);
          expect(() => extractExactTime(childObj)).not.toThrow();
          const inheritedRes = extractExactTime(childObj);
          expect(inheritedRes?.valid).toBe(false);
          expect(inheritedRes?.error).toBe('Propriétés temporelles héritées non autorisées');
          expect(inheritedCalled).toBe(false);

          let ownCalled = false;
          const ownObj = {};
          Object.defineProperty(ownObj, prop, {
            get() {
              ownCalled = true;
              throw new Error(`SENTINEL_OWN_${prop}`);
            },
            configurable: true,
            enumerable: true
          });
          expect(() => extractExactTime(ownObj)).not.toThrow();
          const ownRes = extractExactTime(ownObj);
          expect(ownRes?.valid).toBe(false);
          expect(ownRes?.error).toBe('Propriétés temporelles par getter/setter non autorisées');
          expect(ownCalled).toBe(false);
        }
      });

      it('Test R5-01 — Getter propre getTime : jamais exécuté, compteur à 0, Date reste valide', () => {
        let ownGetTimeCalls = 0;
        const validTimestamp = 1785571200456;
        const hostileDate = new Date(validTimestamp);

        Object.defineProperty(hostileDate, 'getTime', {
          get() {
            ownGetTimeCalls++;
            throw new Error('HOSTILE_GETTIME_OWN_SENTINEL');
          },
          configurable: true,
          enumerable: true
        });

        expect(() => extractExactTime(hostileDate)).not.toThrow();
        const res = extractExactTime(hostileDate);
        expect(res?.valid).toBe(true);
        expect(res?.seconds).toBe(1785571200);
        expect(res?.nanoseconds).toBe(456000000);
        expect(ownGetTimeCalls).toBe(0);
      });
    });

    describe('B3 : Neutralisation complète des données externes et messages constants', () => {
      it('B3 Test 1 — Arguments CLI : aucune sentinelle injectée n’apparaît dans les exceptions ou messages', () => {
        const maliciousArgs = [
          'PRIVATE_SECRET_SENTINEL',
          'PRIVATE_UID_SENTINEL',
          'PRIVATE_EMAIL_SENTINEL',
          'bearer_token_stripe_prod_secret_key_abcdef123456'
        ];

        for (const malArg of maliciousArgs) {
          try {
            parseCliArgs([malArg]);
            expect.unreachable('Devait lever une exception');
          } catch (err: any) {
            const sanitized = sanitizeReportErrorMessage(err);
            expect(sanitized).toBe('Argument positionnel non autorisé.');
            expect(sanitized).not.toContain(malArg);
            expect(err.message).not.toContain(malArg);
          }
        }
      });

      it('B3 Test 2 — Préfixes hostiles : toutes les exceptions avec faux préfixes sont neutralisées vers GENERIC_EXTERNAL_ERROR', () => {
        const fakeErr = new Error(`[BLOCAGE] ${PRIVATE_SECRET_SENTINEL}`);
        const sanitized = sanitizeReportErrorMessage(fakeErr);
        expect(sanitized).toBe(GENERIC_EXTERNAL_ERROR);
        expect(sanitized).not.toContain(PRIVATE_SECRET_SENTINEL);
        expect(sanitized).not.toContain(PRIVATE_UID_SENTINEL);
        expect(sanitized).not.toContain(PRIVATE_EMAIL_SENTINEL);
      });

      it('B3 Test 4 — Dictionnaire privé et registre WeakMap non exportés, authentification inviolable', () => {
        expect((bootstrapModule as any).SAFE_INTERNAL_MESSAGES).toBeUndefined();
        expect((bootstrapModule as any).INTERNAL_ERROR_REGISTRY).toBeUndefined();
        expect((bootstrapModule as any).INTERNAL_ERROR_BRAND).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // 9. AUTH-ADMIN-05-FIX-10 : DURCISSEMENT ZERO-TRUST DU BOOTSTRAP SUPER ADMIN
  // =========================================================================
  describe('AUTH-ADMIN-05-FIX-10 : Scénarios obligatoires Zero-Trust (A à F et cas limites)', () => {
    // -----------------------------------------------------------------------
    // SCÉNARIO A : PROFIL CIBLE ACTIF ET AUTORISÉ (PREUVE A)
    // -----------------------------------------------------------------------
    it('Scénario A — Profil cible profiles/{uid} existant, actif et super_admin : validation et exécution complètes', async () => {
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        name: 'Youcef Boudjada',
        company: 'Orthogonal PD&I Studio',
        city: 'Alger'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.proofSource).toBe('target');
      expect(report.targetProfileFound).toBe(true);
      expect(report.historicalProfileFound).toBe(false);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(true);
      expect(report.claimsUpdated).toBe(true);
      expect(report.claimsVerified).toBe(true);

      const savedProfile = store.get(`profiles/${validUid}`);
      expect(savedProfile).toEqual({
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        name: 'Youcef Boudjada',
        company: 'Orthogonal PD&I Studio',
        city: 'Alger'
      });
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledTimes(1);
      expect(userRecordState.customClaims.role).toBe('super_admin');
    });

    // -----------------------------------------------------------------------
    // SCÉNARIO B : MIGRATION DEPUIS UN HISTORIQUE VALIDE (PREUVE B)
    // -----------------------------------------------------------------------
    it('Scénario B — Migration depuis un profil historique valide (email Auth, role=super_admin, status=active) avec whitelist stricte et préservation du document historique', async () => {
      const initialHistoricalDoc = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        name: 'Youcef Boudjada',
        company: 'PD&I Vision DZ',
        country: 'Algeria',
        city: 'Algiers',
        department: 'Pipelines & Isométrie',
        // Champs interdits d'importation / hors whitelist :
        accountType: 'enterprise',
        subscriptionPlan: 'lifetime',
        loginCount: 150,
        storageUsedKb: 512000,
        unwhitelistedCustomProp: 'must_be_ignored'
      };
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, { ...initialHistoricalDoc });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.proofSource).toBe('historical');
      expect(report.historicalProfileFound).toBe(true);
      expect(report.targetProfileFound).toBe(false);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(true);
      expect(report.claimsUpdated).toBe(true);
      expect(report.claimsVerified).toBe(true);

      // Vérifier le profil cible écrit
      const targetSaved = store.get(`profiles/${validUid}`);
      expect(targetSaved).toEqual({
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        name: 'Youcef Boudjada',
        company: 'PD&I Vision DZ',
        country: 'Algeria',
        city: 'Algiers',
        department: 'Pipelines & Isométrie'
      });
      // Aucun privilège commercial ni compteur n'a été importé ou fabriqué
      expect(targetSaved.accountType).toBeUndefined();
      expect(targetSaved.subscriptionPlan).toBeUndefined();
      expect(targetSaved.loginCount).toBeUndefined();
      expect(targetSaved.storageUsedKb).toBeUndefined();
      expect(targetSaved.unwhitelistedCustomProp).toBeUndefined();

      // Le document historique n'a jamais été modifié ni supprimé
      expect(store.get(`profiles/${HISTORICAL_PROFILE_DOC_ID}`)).toEqual(initialHistoricalDoc);
      expect(callSequence).not.toContain(`firestore.set:profiles/${HISTORICAL_PROFILE_DOC_ID}`);
      expect(callSequence).not.toContain(`firestore.delete:profiles/${HISTORICAL_PROFILE_DOC_ID}`);
    });

    // -----------------------------------------------------------------------
    // SCÉNARIO C : DEUX PROFILS ABSENTS -> NO_VERIFIED_AUTHORIZATION_PROOF
    // -----------------------------------------------------------------------
    it('Scénario C — Deux profils absents : retourne NO_VERIFIED_AUTHORIZATION_PROOF, ne fabrique aucun profil et n’attribue aucun claim', async () => {
      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.errorCode).toBe('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.error).toContain('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(store.get(`profiles/${validUid}`)).toBeUndefined();
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // SCÉNARIO D : PROFIL SUSPENDU, RÉVOQUÉ, BANNI OU DÉSACTIVÉ
    // -----------------------------------------------------------------------
    it.each(['suspended', 'revoked', 'banned', 'disabled'])(
      'Scénario D1 — Profil cible avec statut négatif "%s" : blocage strict sans réactivation ni claim (même avec historique valide)',
      async (negativeStatus) => {
        store.set(`profiles/${validUid}`, {
          uid: validUid,
          email: ALLOWED_SUPER_ADMIN_EMAIL,
          role: 'super_admin',
          status: negativeStatus,
          name: 'Youcef Boudjada'
        });
        store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
          uid: HISTORICAL_PROFILE_DOC_ID,
          email: ALLOWED_SUPER_ADMIN_EMAIL,
          role: 'super_admin',
          status: 'active'
        });

        const report = await runSuperAdminBootstrap({
          execute: true,
          expectedUid: validUid,
          authInstance: mockAuth,
          firestoreInstance: mockDb
        });

        expect(report.success).toBe(false);
        expect(report.errorCode).toBe('NEGATIVE_PROFILE_STATUS_BLOCKED');
        expect(report.error).toContain('[BLOCAGE STATUT]');
        expect(report.profileWritten).toBe(false);
        expect(report.claimsUpdated).toBe(false);
        expect(store.get(`profiles/${validUid}`).status).toBe(negativeStatus);
        expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
      }
    );

    it.each(['suspended', 'revoked', 'banned', 'disabled'])(
      'Scénario D2 — Profil historique avec statut négatif "%s" : blocage strict sans écriture ni claim',
      async (negativeStatus) => {
        store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
          uid: HISTORICAL_PROFILE_DOC_ID,
          email: ALLOWED_SUPER_ADMIN_EMAIL,
          role: 'super_admin',
          status: negativeStatus
        });

        const report = await runSuperAdminBootstrap({
          execute: true,
          expectedUid: validUid,
          authInstance: mockAuth,
          firestoreInstance: mockDb
        });

        expect(report.success).toBe(false);
        expect(report.errorCode).toBe('NEGATIVE_PROFILE_STATUS_BLOCKED');
        expect(report.error).toContain('[BLOCAGE STATUT]');
        expect(report.profileWritten).toBe(false);
        expect(report.claimsUpdated).toBe(false);
        expect(store.get(`profiles/${validUid}`)).toBeUndefined();
        expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
      }
    );

    // -----------------------------------------------------------------------
    // SCÉNARIO E : CIBLE pending_activation ET HISTORIQUE VALIDE (VS INVALIDE)
    // -----------------------------------------------------------------------
    it('Scénario E1 — Cible pending_activation restaurée uniquement grâce à un historique valide, en préservant les métadonnées cibles récentes', async () => {
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'pending_activation',
        name: 'Youcef Boudjada (Récent)',
        company: 'Orthogonal Studio (Récent)',
        updatedAt: '2026-11-15T09:00:00.000Z'
      });

      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        name: 'Youcef Boudjada (Ancien)',
        company: 'Ancienne Société',
        city: 'Alger',
        country: 'Algérie',
        accountType: 'enterprise',
        subscriptionPlan: 'lifetime'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.proofSource).toBe('historical');
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(true);
      expect(report.claimsUpdated).toBe(true);
      expect(report.claimsVerified).toBe(true);

      const restored = store.get(`profiles/${validUid}`);
      expect(restored.uid).toBe(validUid);
      expect(restored.email).toBe(ALLOWED_SUPER_ADMIN_EMAIL);
      expect(restored.status).toBe('active');
      expect(restored.role).toBe('super_admin');
      // Les métadonnées récentes de la cible n'ont pas été remplacées par l'historique
      expect(restored.name).toBe('Youcef Boudjada (Récent)');
      expect(restored.company).toBe('Orthogonal Studio (Récent)');
      expect(restored.updatedAt).toBe('2026-11-15T09:00:00.000Z');
      // Les champs de la whitelist absents de la cible ont été récupérés
      expect(restored.city).toBe('Alger');
      expect(restored.country).toBe('Algérie');
      // Aucun privilège commercial non prouvé
      expect(restored.accountType).toBeUndefined();
      expect(restored.subscriptionPlan).toBeUndefined();
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledTimes(1);
    });

    it('Scénario E2 — Cible pending_activation SANS historique valide : refus NO_VERIFIED_AUTHORIZATION_PROOF, aucune activation ni claim', async () => {
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'pending_activation',
        name: 'Youcef Boudjada'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.errorCode).toBe('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.error).toContain('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(store.get(`profiles/${validUid}`).status).toBe('pending_activation');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // SCÉNARIO F : PROFIL CIBLE ACTIF AVEC SYNCHRONISATION DU CLAIM
    // -----------------------------------------------------------------------
    it('Scénario F — Profil cible actif et super_admin sans historique : synchronise le Custom Claim role: super_admin en préservant les claims existants', async () => {
      userRecordState.customClaims = {
        existingWorkspaceScope: 'iso_pipeline_v3',
        mfaVerified: true
      };

      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        name: 'Youcef Boudjada'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.proofSource).toBe('target');
      expect(report.claimsUpdated).toBe(true);
      expect(report.claimsVerified).toBe(true);
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(validUid, {
        existingWorkspaceScope: 'iso_pipeline_v3',
        mfaVerified: true,
        role: 'super_admin'
      });
    });

    // -----------------------------------------------------------------------
    // CONDITIONS D'IDENTITÉ : EXPECTED_SUPER_ADMIN_UID ABSENT / VIDE / DIFFÉRENT
    // -----------------------------------------------------------------------
    it('Refus immédiat si EXPECTED_SUPER_ADMIN_UID est absent ou vide (aucune écriture, aucun claim)', async () => {
      delete process.env.EXPECTED_SUPER_ADMIN_UID;
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin'
      });

      const reportMissing = await runSuperAdminBootstrap({
        execute: true,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(reportMissing.success).toBe(false);
      expect(reportMissing.errorCode).toBe('EXPECTED_UID_MISSING');
      expect(reportMissing.error).toContain('[BLOCAGE UID]');
      expect(reportMissing.profileWritten).toBe(false);
      expect(reportMissing.claimsUpdated).toBe(false);
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();

      const reportEmpty = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: '   ',
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(reportEmpty.success).toBe(false);
      expect(reportEmpty.errorCode).toBe('EXPECTED_UID_MISSING');
      expect(reportEmpty.profileWritten).toBe(false);
      expect(reportEmpty.claimsUpdated).toBe(false);
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('Refus immédiat si l’UID du compte Auth diffère de EXPECTED_SUPER_ADMIN_UID (aucune écriture, aucun claim)', async () => {
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: 'different_independent_expected_uid_999',
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.errorCode).toBe('EXPECTED_UID_MISMATCH');
      expect(report.error).toContain('[BLOCAGE UID]');
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(callSequence.some(s => s.startsWith('firestore.set'))).toBe(false);
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // PREUVE HISTORIQUE : EMAIL DIFFÉRENT OU ACCEPTATION SUR SEUL ID INTERDITE
    // -----------------------------------------------------------------------
    it('Refus si l’email du profil historique diffère de l’email Auth (aucune écriture, aucun claim)', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: 'autre.adresse@gmail.com',
        role: 'super_admin',
        status: 'active',
        name: 'Youcef'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.errorCode).toBe('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.error).toContain('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(store.get(`profiles/${validUid}`)).toBeUndefined();
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('Refus si le profil historique possède le bon ID de document mais manque role=super_admin ou status=active', async () => {
      // Cas 1 : role absent sur le document historique
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active'
      });

      const reportNoRole = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(reportNoRole.success).toBe(false);
      expect(reportNoRole.errorCode).toBe('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();

      // Cas 2 : status absent ou différent de 'active' sur le document historique
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'pending_activation'
      });

      const reportNotActive = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(reportNotActive.success).toBe(false);
      expect(reportNotActive.errorCode).toBe('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('Accepte l’email Auth et l’email historique comparés sans distinction de casse', async () => {
      userRecordState.email = 'Boudjada.Youcef@Gmail.com';
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: 'BOUDJADA.YOUCEF@GMAIL.COM',
        role: 'super_admin',
        status: 'active',
        name: 'Youcef Boudjada'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        targetEmail: 'Boudjada.Youcef@gmail.com',
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.claimsUpdated).toBe(true);
      expect(store.get(`profiles/${validUid}`).email).toBe(ALLOWED_SUPER_ADMIN_EMAIL);
    });

    // -----------------------------------------------------------------------
    // ÉCHECS D'ÉCRITURE ET DE RELECTURE FIRESTORE (VÉRIFICATION STRICTE ÉTAPE 6)
    // -----------------------------------------------------------------------
    it('Échec de relecture Firestore si le document relu a status !== "active" ou role !== "super_admin" ou email invalide : aucun Custom Claim attribué', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      // Simuler une altération du statut lors de la relecture après écriture
      const originalCol = mockDb.collection.bind(mockDb);
      let targetWritten = false;
      mockDb.collection = (colName: string) => {
        const col = originalCol(colName);
        const origDoc = col.doc.bind(col);
        col.doc = (docId: string) => {
          const docObj = origDoc(docId);
          if (docId === validUid) {
            const origSet = docObj.set.bind(docObj);
            docObj.set = vi.fn(async (data: any) => {
              await origSet(data);
              targetWritten = true;
            });
            const origGet = docObj.get.bind(docObj);
            docObj.get = vi.fn(async () => {
              const snap = await origGet();
              if (targetWritten && snap.exists) {
                return {
                  exists: true,
                  data: () => ({
                    ...snap.data(),
                    status: 'pending_activation'
                  })
                };
              }
              return snap;
            });
          }
          return docObj;
        };
        return col;
      };

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.partialState).toBe(true);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(report.errorCode).toBe('PROFILE_STATUS_INVALID_AFTER_WRITE');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('Échec de relecture Firestore si le document relu a role !== "super_admin" : aucun Custom Claim attribué', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      const originalCol = mockDb.collection.bind(mockDb);
      let targetWritten = false;
      mockDb.collection = (colName: string) => {
        const col = originalCol(colName);
        const origDoc = col.doc.bind(col);
        col.doc = (docId: string) => {
          const docObj = origDoc(docId);
          if (docId === validUid) {
            const origSet = docObj.set.bind(docObj);
            docObj.set = vi.fn(async (data: any) => {
              await origSet(data);
              targetWritten = true;
            });
            const origGet = docObj.get.bind(docObj);
            docObj.get = vi.fn(async () => {
              const snap = await origGet();
              if (targetWritten && snap.exists) {
                return {
                  exists: true,
                  data: () => ({
                    ...snap.data(),
                    role: 'client'
                  })
                };
              }
              return snap;
            });
          }
          return docObj;
        };
        return col;
      };

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.partialState).toBe(true);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(report.errorCode).toBe('PROFILE_ROLE_INVALID_AFTER_WRITE');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('Échec de relecture Firestore (exception réseau au get post-écriture) : aucun Custom Claim attribué', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      const originalCol = mockDb.collection.bind(mockDb);
      let targetWritten = false;
      mockDb.collection = (colName: string) => {
        const col = originalCol(colName);
        const origDoc = col.doc.bind(col);
        col.doc = (docId: string) => {
          const docObj = origDoc(docId);
          if (docId === validUid) {
            const origSet = docObj.set.bind(docObj);
            docObj.set = vi.fn(async (data: any) => {
              await origSet(data);
              targetWritten = true;
            });
            const origGet = docObj.get.bind(docObj);
            docObj.get = vi.fn(async () => {
              if (targetWritten) {
                throw new Error('UNAVAILABLE : Firestore read failed after write');
              }
              return origGet();
            });
          }
          return docObj;
        };
        return col;
      };

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.partialState).toBe(true);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(report.errorCode).toBe('PROFILE_VERIFICATION_FAILED');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 10. AUTH-ADMIN-05-FIX-10-R1 : CORRECTION DES RÉSERVES DU CONTRE-AUDIT (R1 & R2)
  // =========================================================================
  describe('AUTH-ADMIN-05-FIX-10-R1 : Correctifs du contre-audit (R1 — Préservation non destructive & R2 — Cohérence UID historique)', () => {
    // -----------------------------------------------------------------------
    // R1-1 : PRÉSERVATION D'UN CHAMP MÉTIER CIBLE AUTORISÉ MAIS NON IMPORTABLE DEPUIS L'HISTORIQUE
    // -----------------------------------------------------------------------
    it('R1-1 — Préserve un champ métier cible autorisé mais non importable depuis l’historique lors de mergeProfileDataNonDestructive et targetDocRef.set()', async () => {
      const targetProfileWithBusinessFields = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        name: 'Youcef Boudjada',
        // Champs métier / ingénierie PD&I présents sur le profil cible mais hors ALLOWED_HISTORICAL_PROFILE_FIELDS :
        defaultNormativeCode: 'ASME_B31_8_2024',
        engineeringSettings: {
          unitSystem: 'SI_METRIC',
          pressureUnit: 'bar',
          seismicZone: 'IIA_ALGER',
          enabledModules: ['cathodic_protection', 'hydraulic_transient']
        },
        workspacePreferences: {
          theme: 'industrial_dark',
          gridSnapMm: 5
        }
      };

      const historicalProfileWithExtraFields = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        company: 'Orthogonal PD&I Studio',
        city: 'Alger',
        // Champ métier présent uniquement dans l'historique (ne doit PAS être importé) :
        historicalOnlyBusinessField: 'LEGACY_PIPELINE_ARCHIVE_DO_NOT_IMPORT',
        defaultNormativeCode: 'OLD_CODE_1999'
      };

      store.set(`profiles/${validUid}`, { ...targetProfileWithBusinessFields });
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, { ...historicalProfileWithExtraFields });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(true);
      expect(report.claimsUpdated).toBe(true);

      const savedTarget = store.get(`profiles/${validUid}`);
      // 1. Les champs métier cibles existants sont intégralement préservés :
      expect(savedTarget.defaultNormativeCode).toBe('ASME_B31_8_2024');
      expect(savedTarget.engineeringSettings).toEqual({
        unitSystem: 'SI_METRIC',
        pressureUnit: 'bar',
        seismicZone: 'IIA_ALGER',
        enabledModules: ['cathodic_protection', 'hydraulic_transient']
      });
      expect(savedTarget.workspacePreferences).toEqual({
        theme: 'industrial_dark',
        gridSnapMm: 5
      });
      // 2. Les champs de la whitelist historique absents de la cible sont récupérés :
      expect(savedTarget.company).toBe('Orthogonal PD&I Studio');
      expect(savedTarget.city).toBe('Alger');
      // 3. Un champ hors whitelist présent uniquement dans l'historique n'est JAMAIS importé :
      expect(savedTarget.historicalOnlyBusinessField).toBeUndefined();
      // 4. Le document historique n'est jamais modifié :
      expect(store.get(`profiles/${HISTORICAL_PROFILE_DOC_ID}`)).toEqual(historicalProfileWithExtraFields);
    });

    // -----------------------------------------------------------------------
    // R1-2 : TRAITEMENT ET PURGE D'UN CHAMP EXPLICITEMENT INTERDIT SUR LE PROFIL CIBLE
    // -----------------------------------------------------------------------
    it('R1-2 — Élimine et purge de Firestore tout champ explicitement interdit présent sur le profil cible (autorisations parallèles, privilèges commerciaux non vérifiés, clés dangereuses)', async () => {
      const pollutedTargetProfile = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'super_admin',
        name: 'Youcef Boudjada',
        defaultNormativeCode: 'API_5L_X70',
        // Champs d'autorisation parallèles / ombres interdits sur la cible :
        roles: ['super_admin', 'billing_root'],
        admin: true,
        isAdmin: true,
        isSuperAdmin: true,
        permissions: ['*'],
        customClaims: { role: 'super_admin' },
        accessLevel: 'unrestricted',
        privileges: ['bypass_audit'],
        authorization: { override: true },
        authorizations: ['all'],
        securityRole: 'root',
        adminRole: 'global_owner',
        // Privilèges commerciaux non vérifiés interdits sur la cible :
        accountType: 'enterprise',
        subscriptionPlan: 'lifetime',
        pricingPlan: 'unlimited',
        assignedPlan: 'ENTERPRISE',
        licenses: ['lic_unverified_1'],
        licenseKey: 'LIC-FAKE-999',
        maxUsers: 9999,
        nestedConfig: {
          validSetting: 'keep_me',
          permissions: ['rogue_nested_perm'],
          accountType: 'enterprise',
          licenses: ['nested_lic']
        }
      };

      store.set(`profiles/${validUid}`, { ...pollutedTargetProfile });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.profileWritten).toBe(true);
      expect(report.profileVerified).toBe(true);

      const savedTarget = store.get(`profiles/${validUid}`);
      // Le champ métier légitime est conservé :
      expect(savedTarget.defaultNormativeCode).toBe('API_5L_X70');
      expect(savedTarget.nestedConfig).toEqual({ validSetting: 'keep_me' });

      // Tous les champs explicitement interdits ont été purgés du document cible (sans { merge: true } aveugle) :
      expect(savedTarget.roles).toBeUndefined();
      expect(savedTarget.admin).toBeUndefined();
      expect(savedTarget.isAdmin).toBeUndefined();
      expect(savedTarget.isSuperAdmin).toBeUndefined();
      expect(savedTarget.permissions).toBeUndefined();
      expect(savedTarget.customClaims).toBeUndefined();
      expect(savedTarget.accessLevel).toBeUndefined();
      expect(savedTarget.privileges).toBeUndefined();
      expect(savedTarget.authorization).toBeUndefined();
      expect(savedTarget.authorizations).toBeUndefined();
      expect(savedTarget.securityRole).toBeUndefined();
      expect(savedTarget.adminRole).toBeUndefined();
      expect(savedTarget.accountType).toBeUndefined();
      expect(savedTarget.subscriptionPlan).toBeUndefined();
      expect(savedTarget.pricingPlan).toBeUndefined();
      expect(savedTarget.assignedPlan).toBeUndefined();
      expect(savedTarget.licenses).toBeUndefined();
      expect(savedTarget.licenseKey).toBeUndefined();
      expect(savedTarget.maxUsers).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // R1-3 : CONTRÔLE STRICT DE status ET role SUR LE PROFIL CIBLE
    // -----------------------------------------------------------------------
    it('R1-3 — Maintient un contrôle strict sur uid, email, status === "active" et role === "super_admin" et rejette un profil cible avec rôle contradictoire', async () => {
      // Un profil cible avec role: 'client' (même avec historique valide) ne peut pas être promu silencieusement
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'active',
        role: 'client',
        defaultNormativeCode: 'ASME_B31_4'
      });
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.errorCode).toBe('NO_VERIFIED_AUTHORIZATION_PROOF');
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // R1-4 : AUCUNE COPIE DE PRIVILÈGE COMMERCIAL NON AUTORISÉ DEPUIS L'HISTORIQUE
    // -----------------------------------------------------------------------
    it('R1-4 — La migration historique ne copie jamais aucun privilège commercial non autorisé, même déguisé dans un champ de la whitelist', () => {
      const targetData = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'pending_activation',
        projectDiscipline: 'Piping & Instrumentation'
      };
      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        accountType: 'enterprise',
        subscriptionPlan: 'lifetime',
        pricingPlan: 'unlimited',
        licenses: ['lic_enterprise_all'],
        // Tentative d'injecter un mot-clé commercial interdit dans un champ de la whitelist :
        department: 'enterprise',
        jobTitle: 'lifetime',
        company: 'Orthogonal PD&I Studio'
      };

      const { mergedData, recoveredFields } = mergeProfileDataNonDestructive(
        validUid,
        targetData,
        historicalData
      );

      expect(mergedData.projectDiscipline).toBe('Piping & Instrumentation');
      expect(mergedData.company).toBe('Orthogonal PD&I Studio');
      expect(mergedData.accountType).toBeUndefined();
      expect(mergedData.subscriptionPlan).toBeUndefined();
      expect(mergedData.pricingPlan).toBeUndefined();
      expect(mergedData.licenses).toBeUndefined();
      expect(mergedData.department).toBeUndefined();
      expect(mergedData.jobTitle).toBeUndefined();
      expect(recoveredFields).toEqual(['company']);
    });

    // -----------------------------------------------------------------------
    // R2-1 : UID HISTORIQUE CONFORME (uid === HISTORICAL_PROFILE_DOC_ID)
    // -----------------------------------------------------------------------
    it('R2-1 — Accepte un profil historique dont le champ uid est strictement égal à HISTORICAL_PROFILE_DOC_ID sans jamais remplacer l’UID Auth attendu', async () => {
      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        name: 'Youcef Boudjada',
        company: 'Orthogonal PD&I Studio'
      };

      expect(hasContradictoryHistoricalUid(historicalData)).toBe(false);
      expect(isValidHistoricalAuthorizationProof(historicalData)).toBe(true);

      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, historicalData);

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.proofSource).toBe('historical');
      expect(report.profileWritten).toBe(true);
      expect(report.claimsUpdated).toBe(true);

      // L'UID enregistré dans le profil cible et utilisé pour les Custom Claims est strictement validUid (jamais HISTORICAL_PROFILE_DOC_ID)
      const savedTarget = store.get(`profiles/${validUid}`);
      expect(savedTarget.uid).toBe(validUid);
      expect(savedTarget.uid).not.toBe(HISTORICAL_PROFILE_DOC_ID);
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
        validUid,
        expect.objectContaining({ role: 'super_admin' })
      );
    });

    // -----------------------------------------------------------------------
    // R2-2 : UID HISTORIQUE ABSENT (AUTORISÉ PAR LE MODÈLE SI PREUVE B COMPLÈTE)
    // -----------------------------------------------------------------------
    it('R2-2 — Accepte un profil historique dont le champ uid est absent (undefined) lorsque email, role=super_admin et status=active sont conformes', async () => {
      const historicalWithoutUid = {
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        name: 'Youcef Boudjada',
        city: 'Alger'
      };

      expect(hasContradictoryHistoricalUid(historicalWithoutUid)).toBe(false);
      expect(isValidHistoricalAuthorizationProof(historicalWithoutUid)).toBe(true);

      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, historicalWithoutUid);

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(true);
      expect(report.proofSource).toBe('historical');
      expect(report.profileWritten).toBe(true);
      expect(report.claimsUpdated).toBe(true);

      const savedTarget = store.get(`profiles/${validUid}`);
      expect(savedTarget.uid).toBe(validUid);
      expect(savedTarget.city).toBe('Alger');
    });

    // -----------------------------------------------------------------------
    // R2-3 & R2-4 : UID HISTORIQUE CONTRADICTOIRE -> REJET STRICT, ZÉRO ÉCRITURE FIRESTORE ET ZÉRO CUSTOM CLAIM
    // -----------------------------------------------------------------------
    it.each([
      ['chaîne contradictoire', 'contradictory-uid-999'],
      ['UID Auth réel au lieu de HISTORICAL_PROFILE_DOC_ID', 'google_user_youcef_12345'],
      ['chaîne vide', ''],
      ['espaces autour de HISTORICAL_PROFILE_DOC_ID', ` ${HISTORICAL_PROFILE_DOC_ID} `],
      ['null', null],
      ['nombre', 12345],
      ['objet', { id: HISTORICAL_PROFILE_DOC_ID }]
    ])(
      'R2-3 & R2-4 — Rejette strictement un profil historique avec uid contradictoire (%s) : aucune écriture Firestore et aucun Custom Claim',
      async (_label, invalidHistoricalUid) => {
        const badHistoricalProfile: Record<string, any> = {
          uid: invalidHistoricalUid,
          email: ALLOWED_SUPER_ADMIN_EMAIL,
          role: 'super_admin',
          status: 'active',
          name: 'Youcef Boudjada',
          company: 'PD&I Studio'
        };

        expect(hasContradictoryHistoricalUid(badHistoricalProfile)).toBe(true);
        expect(isValidHistoricalAuthorizationProof(badHistoricalProfile)).toBe(false);

        const proofCheck = verifyPreexistingAuthorizationProof(
          validUid,
          null,
          badHistoricalProfile
        );
        expect(proofCheck.valid).toBe(false);
        expect(proofCheck.errorCode).toBe('HISTORICAL_UID_MISMATCH');

        store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, badHistoricalProfile);

        const report = await runSuperAdminBootstrap({
          execute: true,
          expectedUid: validUid,
          authInstance: mockAuth,
          firestoreInstance: mockDb
        });

        expect(report.success).toBe(false);
        expect(report.errorCode).toBe('HISTORICAL_UID_MISMATCH');
        expect(report.error).toContain('[BLOCAGE UID HISTORIQUE]');
        expect(report.error).toContain('NO_VERIFIED_AUTHORIZATION_PROOF');
        // Preuve : zéro écriture Firestore et zéro Custom Claim
        expect(report.profileWritten).toBe(false);
        expect(report.profileVerified).toBe(false);
        expect(report.claimsUpdated).toBe(false);
        expect(report.claimsVerified).toBe(false);
        expect(store.get(`profiles/${validUid}`)).toBeUndefined();
        expect(callSequence.some(s => s.startsWith('firestore.set'))).toBe(false);
        expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
      }
    );

    it('R2-4b — Rejette un profil historique dont uid est défini par un getter (accesseur) sans l’invoquer, et bloque même si un profil cible existe', async () => {
      let uidGetterInvoked = false;
      const hostileHistorical: Record<string, any> = {
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      };
      Object.defineProperty(hostileHistorical, 'uid', {
        get() {
          uidGetterInvoked = true;
          return HISTORICAL_PROFILE_DOC_ID;
        },
        enumerable: true,
        configurable: true
      });

      expect(hasContradictoryHistoricalUid(hostileHistorical)).toBe(true);
      expect(isValidHistoricalAuthorizationProof(hostileHistorical)).toBe(false);
      expect(uidGetterInvoked).toBe(false);

      // Même si le profil cible est en pending_activation, un historique avec UID contradictoire bloque tout :
      store.set(`profiles/${validUid}`, {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        status: 'pending_activation',
        name: 'Youcef Boudjada'
      });
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: 'wrong-historical-uid-777',
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active',
        city: 'Alger'
      });

      const report = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.errorCode).toBe('HISTORICAL_UID_MISMATCH');
      expect(report.profileWritten).toBe(false);
      expect(report.claimsUpdated).toBe(false);
      expect(store.get(`profiles/${validUid}`).status).toBe('pending_activation');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 11. FIRESTORE-NAMED-DB-01-FIX-01 : SERVEUR @GOOGLE-CLOUD/FIRESTORE, VALIDATION STRICTE & BOOTSTRAP (SECTIONS 6.A, 6.C, 6.D, 6.E)
  // =========================================================================
  describe('FIRESTORE-NAMED-DB-01-FIX-01 : Migration sécurisée vers la base Firestore nommée côté serveur et bootstrap', () => {
    it('6.A & 6.C — Validation stricte côté serveur : accepte uniquement graphical-router-x18qq et ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf, refuse absent, (default) ou projet invalide', () => {
      expect(validateServerProjectId(EXPECTED_SERVER_PROJECT_ID)).toBe('graphical-router-x18qq');
      expect(validateServerDatabaseId(EXPECTED_SERVER_DATABASE_ID)).toBe(
        'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      );

      // Refus de Database ID absent, vide, '(default)' ou incorrect
      expect(() => validateServerDatabaseId(undefined)).toThrow(/absent ou vide/);
      expect(() => validateServerDatabaseId(null)).toThrow(/absent ou vide/);
      expect(() => validateServerDatabaseId('')).toThrow(/absent ou vide/);
      expect(() => validateServerDatabaseId('   ')).toThrow(/absent ou vide/);
      expect(() => validateServerDatabaseId('(default)')).toThrow(/\(default\)['"]? est formellement interdite/);
      expect(() => validateServerDatabaseId(' (default) ')).toThrow(/\(default\)['"]? est formellement interdite/);
      expect(() => validateServerDatabaseId('wrong-db-id')).toThrow(/Database ID non autorisé/);

      // Refus de Project ID absent, vide, demo-* ou incorrect
      expect(() => validateServerProjectId(undefined)).toThrow(/absent ou vide/);
      expect(() => validateServerProjectId('')).toThrow(/absent ou vide/);
      expect(() => validateServerProjectId('demo-orthogonal-rules-pdi')).toThrow(/Cannot use demo project ID/);
      expect(() => validateServerProjectId('wrong-project')).toThrow(/Project ID non autorisé/);

      // Le serveur ignore toute variable VITE_ et échoue si FIREBASE_DATABASE_ID ou FIREBASE_PROJECT_ID est vide ou invalide
      expect(
        resolveServerFirestoreConfig({
          VITE_FIREBASE_PROJECT_ID: 'wrong-vite-project',
          VITE_FIREBASE_DATABASE_ID: '(default)'
        })
      ).toEqual({
        projectId: EXPECTED_SERVER_PROJECT_ID,
        databaseId: EXPECTED_SERVER_DATABASE_ID
      });

      expect(() =>
        resolveServerFirestoreConfig({ FIREBASE_DATABASE_ID: '' })
      ).toThrow(/absent ou vide/);
      expect(() =>
        resolveServerFirestoreConfig({ FIREBASE_DATABASE_ID: '(default)' })
      ).toThrow(/\(default\)['"]? est formellement interdite/);
      expect(() =>
        resolveServerFirestoreConfig({ FIREBASE_DATABASE_ID: 'other-db' })
      ).toThrow(/Database ID non autorisé/);
      expect(() =>
        resolveServerFirestoreConfig({ FIREBASE_PROJECT_ID: 'other-proj' })
      ).toThrow(/Project ID non autorisé/);
      expect(() =>
        resolveServerFirestoreConfig({}, { requireExplicitEnv: true })
      ).toThrow(/absent ou vide/);
    });

    it('6.C — Client serveur adminDb construit via @google-cloud/firestore avec Project ID et Database ID nommés explicites, méthodes compatibles et zéro secret exposé', () => {
      expect(realServerAdminDb).toBeInstanceOf(Firestore);
      expect(extractServerFirestoreProjectId(realServerAdminDb)).toBe('graphical-router-x18qq');
      expect(extractServerFirestoreDatabaseId(realServerAdminDb)).toBe(
        'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      );
      expect((realServerAdminDb as any).databaseId).toBe(
        'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      );
      expect((realServerAdminDb as any).databaseId).not.toBe('(default)');

      // Vérification de compatibilité des méthodes utilisées par les consommateurs serveur (bootstrap, webhooks, ordres)
      expect(typeof realServerAdminDb.collection).toBe('function');
      expect(typeof realServerAdminDb.doc).toBe('function');
      expect(typeof realServerAdminDb.runTransaction).toBe('function');
      expect(typeof realServerAdminDb.batch).toBe('function');

      const colRef = realServerAdminDb.collection('profiles');
      expect(typeof colRef.doc).toBe('function');
      expect(typeof colRef.where).toBe('function');
      expect(typeof colRef.limit).toBe('function');
      expect(typeof colRef.get).toBe('function');

      const docRef = colRef.doc('test_doc_check');
      expect(typeof docRef.get).toBe('function');
      expect(typeof docRef.set).toBe('function');
      expect(typeof docRef.update).toBe('function');
      expect(typeof docRef.delete).toBe('function');

      // Vérification de assertValidServerFirestoreInstance avant opération administrative
      expect(assertValidServerFirestoreInstance(realServerAdminDb)).toEqual({
        projectId: 'graphical-router-x18qq',
        databaseId: 'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      });

      // Refus immédiat si une instance pointe vers '(default)' ou un mauvais Database ID
      const defaultDbFake = {
        app: { options: { projectId: 'graphical-router-x18qq' } },
        projectId: 'graphical-router-x18qq',
        databaseId: '(default)'
      };
      expect(() => assertValidServerFirestoreInstance(defaultDbFake)).toThrow(/non conforme à la base nommée/);

      expect(() =>
        createServerFirestoreClient({
          projectId: 'graphical-router-x18qq',
          databaseId: '(default)'
        })
      ).toThrow(/\(default\)['"]? est formellement interdite/);

      // Vérification statique que src/lib/firebase-admin.ts n'utilise pas getFirestore de firebase-admin/firestore ni de variable VITE_ ni de clé privée
      const adminSource = fs.readFileSync(resolve(process.cwd(), 'src/lib/firebase-admin.ts'), 'utf-8');
      expect(adminSource).not.toContain('firebase-admin/firestore');
      expect(adminSource).not.toContain('VITE_FIREBASE_');
      expect(adminSource).not.toContain('BEGIN PRIVATE KEY');
      expect(realServerAdminAuth).toBeDefined();
    });

    it('6.D — Le bootstrap refuse un Database ID égal à (default), absent ou incorrect avant toute lecture Auth ou Firestore', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'active'
      });

      // 1. Refus de '(default)'
      const defaultDb = {
        ...mockDb,
        databaseId: '(default)'
      };
      const reportDefault = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: defaultDb
      });
      expect(reportDefault.success).toBe(false);
      expect(reportDefault.errorCode).toBe('DATABASE_MISMATCH');
      expect(reportDefault.error).toContain('[BLOCAGE BASE FIRESTORE]');
      expect(reportDefault.profileWritten).toBe(false);
      expect(reportDefault.claimsUpdated).toBe(false);
      expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(mockDb.collection).not.toHaveBeenCalled();
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();

      // 2. Refus d'un Database ID incorrect
      const wrongNamedDb = {
        ...mockDb,
        databaseId: 'wrong-named-database-id'
      };
      const reportWrongDb = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: wrongNamedDb
      });
      expect(reportWrongDb.success).toBe(false);
      expect(reportWrongDb.errorCode).toBe('DATABASE_MISMATCH');
      expect(reportWrongDb.error).toContain('[BLOCAGE BASE FIRESTORE]');
      expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(mockDb.collection).not.toHaveBeenCalled();
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();

      // 3. Refus d'un Database ID absent / non vérifiable
      const missingDbId = {
        ...mockDb,
        databaseId: undefined
      };
      const reportMissingDb = await runSuperAdminBootstrap({
        execute: false,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: missingDbId
      });
      expect(reportMissingDb.success).toBe(false);
      expect(reportMissingDb.errorCode).toBe('DATABASE_MISMATCH');
      expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();

      // 4. Refus d'une incohérence entre databaseId et _settings.databaseId
      const inconsistentDb = {
        ...mockDb,
        databaseId: EXPECTED_DATABASE_ID,
        _settings: { databaseId: '(default)' }
      };
      expect(getFirestoreDatabaseId(inconsistentDb)).toBeNull();
      const reportInconsistent = await runSuperAdminBootstrap({
        execute: false,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: inconsistentDb
      });
      expect(reportInconsistent.success).toBe(false);
      expect(reportInconsistent.errorCode).toBe('DATABASE_MISMATCH');
      expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();
    });

    it('FIX-02-B & FIX-02-C — Identité Firebase Admin App [DEFAULT], suppression de .app artificiel et rejet des faux objets ou divergences', async () => {
      // 1. Une application Admin [DEFAULT] du bon projet est acceptée
      const validDefaultAdminApp = {
        name: '[DEFAULT]',
        options: { projectId: 'graphical-router-x18qq' }
      };
      const initAdminSpy = vi.fn();
      const getAppAdminSpy = vi.fn(() => validDefaultAdminApp as any);
      const selectedAdminApp = getOrInitializeServerFirebaseApp(
        { projectId: 'graphical-router-x18qq' },
        {
          getApps: () => [validDefaultAdminApp as any],
          getApp: getAppAdminSpy as any,
          initializeApp: initAdminSpy as any
        }
      );
      expect(selectedAdminApp).toBe(validDefaultAdminApp);
      expect(getAppAdminSpy).toHaveBeenCalledTimes(1);
      expect(initAdminSpy).not.toHaveBeenCalled();
      expect(validateServerFirebaseAppProjectId(selectedAdminApp)).toBe('graphical-router-x18qq');

      // 2. Une application Admin [DEFAULT] d'un autre projet est rejetée AVANT getAuth()
      const wrongDefaultAdminApp = {
        name: '[DEFAULT]',
        options: { projectId: 'wrong-admin-project' }
      };
      const getAuthSpy = vi.fn();
      expect(() =>
        getOrInitializeServerFirebaseApp(
          { projectId: 'graphical-router-x18qq' },
          {
            getApps: () => [wrongDefaultAdminApp as any],
            getApp: () => wrongDefaultAdminApp as any,
            initializeApp: vi.fn() as any
          }
        )
      ).toThrow(/Project ID non autorisé/);
      expect(() =>
        createServerAdminAuth(wrongDefaultAdminApp, 'graphical-router-x18qq', getAuthSpy as any)
      ).toThrow(/Project ID non autorisé/);
      expect(getAuthSpy).not.toHaveBeenCalled();

      // 3. Une application secondaire préexistante ne doit jamais être sélectionnée à la place de [DEFAULT]
      const secondaryAdminApp = {
        name: 'secondary-worker-app',
        options: { projectId: 'other-worker-project' }
      };
      const newlyCreatedDefaultApp = {
        name: '[DEFAULT]',
        options: { projectId: 'graphical-router-x18qq' }
      };
      const getAppShouldNotBeCalled = vi.fn(() => {
        throw new Error('Default app does not exist yet');
      });
      const createDefaultAdminSpy = vi.fn(() => newlyCreatedDefaultApp as any);
      const resolvedWhenSecondaryExists = getOrInitializeServerFirebaseApp(
        { projectId: 'graphical-router-x18qq' },
        {
          getApps: () => [secondaryAdminApp as any],
          getApp: getAppShouldNotBeCalled as any,
          initializeApp: createDefaultAdminSpy as any
        }
      );
      expect(resolvedWhenSecondaryExists).toBe(newlyCreatedDefaultApp);
      expect(getAppShouldNotBeCalled).not.toHaveBeenCalled();
      expect(createDefaultAdminSpy).toHaveBeenCalledTimes(1);
      expect(createDefaultAdminSpy).toHaveBeenCalledWith({
        projectId: 'graphical-router-x18qq'
      });

      // 4. Le client Firestore réel utilise le projet et la base nommée attendus et NE possède PAS de propriété artificielle .app
      expect(realServerAdminDb).toBeInstanceOf(Firestore);
      expect('app' in (realServerAdminDb as any)).toBe(false);
      expect((realServerAdminDb as any).app).toBeUndefined();
      expect((realServerAdminDb as any).projectId).toBe('graphical-router-x18qq');
      expect((realServerAdminDb as any)._settings?.projectId).toBe('graphical-router-x18qq');
      expect((realServerAdminDb as any).databaseId).toBe(
        'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      );
      expect((realServerAdminDb as any)._settings?.databaseId).toBe(
        'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      );

      // 5. Un faux objet dont seul .app.options.projectId est renseigné ne passe PAS la validation
      const fakeOnlyAppDb = {
        app: { options: { projectId: 'graphical-router-x18qq' } },
        databaseId: EXPECTED_DATABASE_ID
      };
      expect(extractServerFirestoreProjectId(fakeOnlyAppDb)).toBeNull();
      expect(getFirestoreProjectId(fakeOnlyAppDb)).toBeNull();
      expect(() => assertValidServerFirestoreInstance(fakeOnlyAppDb)).toThrow(
        /Project ID réel du client \('inconnu'\) non conforme/
      );

      const reportFakeOnlyApp = await runSuperAdminBootstrap({
        execute: true,
        expectedUid: validUid,
        authInstance: mockAuth,
        firestoreInstance: fakeOnlyAppDb
      });
      expect(reportFakeOnlyApp.success).toBe(false);
      expect(reportFakeOnlyApp.errorCode).toBe('PROJECT_MISMATCH');
      expect(mockAuth.getUserByEmail).not.toHaveBeenCalled();

      // 6. Une divergence entre le projet de l'application Admin et celui du client Firestore est rejetée
      expect(() =>
        assertValidServerFirestoreInstance(
          realServerAdminDb,
          {
            projectId: EXPECTED_SERVER_PROJECT_ID,
            databaseId: EXPECTED_SERVER_DATABASE_ID
          },
          { name: '[DEFAULT]', options: { projectId: 'wrong-admin-project' } }
        )
      ).toThrow(/Project ID non autorisé/);

      expect(() =>
        createServerFirestoreClient(
          {
            projectId: EXPECTED_SERVER_PROJECT_ID,
            databaseId: EXPECTED_SERVER_DATABASE_ID
          },
          { name: '[DEFAULT]', options: { projectId: 'wrong-admin-project' } }
        )
      ).toThrow(/Project ID non autorisé/);
    });

    it('FIX-02-D — Détection stricte des conflits et valeurs vides entre FIREBASE_PROJECT_ID, GOOGLE_CLOUD_PROJECT et GCLOUD_PROJECT', () => {
      // 1. FIREBASE_PROJECT_ID=graphical-router-x18qq et GOOGLE_CLOUD_PROJECT=wrong-project -> rejeté
      expect(() =>
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: 'graphical-router-x18qq',
          GOOGLE_CLOUD_PROJECT: 'wrong-project'
        })
      ).toThrow(/conflit entre les variables d'environnement de projet/);

      // 2. FIREBASE_PROJECT_ID=graphical-router-x18qq et GCLOUD_PROJECT="" -> rejeté
      expect(() =>
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: 'graphical-router-x18qq',
          GCLOUD_PROJECT: ''
        })
      ).toThrow(/GCLOUD_PROJECT.*absent ou vide/);

      // 3. FIREBASE_PROJECT_ID=wrong-project et GCLOUD_PROJECT=graphical-router-x18qq -> rejeté
      expect(() =>
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: 'wrong-project',
          GCLOUD_PROJECT: 'graphical-router-x18qq'
        })
      ).toThrow(/conflit entre les variables d'environnement de projet/);

      // 4. Les trois variables renseignées avec des valeurs contradictoires -> rejeté
      expect(() =>
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: 'graphical-router-x18qq',
          GOOGLE_CLOUD_PROJECT: 'other-project-1',
          GCLOUD_PROJECT: 'other-project-2'
        })
      ).toThrow(/conflit entre les variables d'environnement de projet/);

      // 5. Les trois variables renseignées et cohérentes avec graphical-router-x18qq -> accepté
      expect(
        resolveServerFirestoreConfig({
          FIREBASE_PROJECT_ID: 'graphical-router-x18qq',
          GOOGLE_CLOUD_PROJECT: 'graphical-router-x18qq',
          GCLOUD_PROJECT: 'graphical-router-x18qq',
          FIREBASE_DATABASE_ID: 'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
        })
      ).toEqual({
        projectId: 'graphical-router-x18qq',
        databaseId: 'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      });

      // 6. Les trois variables absentes conservent le fallback attendu lorsque requireExplicitEnv est désactivé
      expect(resolveServerFirestoreConfig({})).toEqual({
        projectId: 'graphical-router-x18qq',
        databaseId: 'ai-studio-pdivisdz-12e4b2ec-ffc7-48b8-9472-8a77deb300cf'
      });
    });

    it('FIX-02-E & FIX-02-F — Alignement de Timestamp sur @google-cloud/firestore dans les transactions de webhooks et chargement de dotenv avant firebase-admin', async () => {
      // 1. Vérification statique de webhookIdempotencyRepository.ts
      const webhookRepoSource = fs.readFileSync(
        resolve(process.cwd(), 'src/security/webhooks/webhookIdempotencyRepository.ts'),
        'utf-8'
      );
      expect(webhookRepoSource).toContain('import { Timestamp } from "@google-cloud/firestore";');
      expect(webhookRepoSource).not.toContain('firebase-admin/firestore');

      // 2. Vérification dynamique que les objets Timestamp écrits dans les transactions sont des instances @google-cloud/firestore Timestamp
      const persistedEventDocs = new Map<string, Record<string, unknown>>();
      const mockTxDb = {
        collection: (colName: string) => ({
          doc: (docId: string) => {
            const key = `${colName}/${docId}`;
            return {
              id: docId,
              get: async () => ({
                id: docId,
                exists: persistedEventDocs.has(key),
                data: () => persistedEventDocs.get(key)
              }),
              set: async (data: Record<string, unknown>) => {
                persistedEventDocs.set(key, data);
              }
            };
          }
        }),
        runTransaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
          const tx = {
            get: async (docRef: any) => docRef.get(),
            set: async (docRef: any, data: Record<string, unknown>) => docRef.set(data)
          };
          return fn(tx);
        }
      };

      const idempRepo = createWebhookIdempotencyRepository({
        adminDb: mockTxDb as any,
        nowMs: () => 1785571200123
      });

      const acquired = await idempRepo.acquireEventLease({
        provider: 'paddle',
        eventId: 'evt_fix02_timestamp_check',
        eventType: 'transaction.completed'
      });
      expect(acquired.outcome).toBe('acquired');
      if (acquired.outcome === 'acquired') {
        expect(acquired.record.createdAt).toBeInstanceOf(GCloudTimestamp);
        expect(acquired.record.updatedAt).toBeInstanceOf(GCloudTimestamp);
        expect(acquired.record.leaseExpiresAt).toBeInstanceOf(GCloudTimestamp);

        const completed = await idempRepo.completeEventLease({
          provider: 'paddle',
          eventId: 'evt_fix02_timestamp_check',
          leaseToken: acquired.leaseToken
        });
        expect(completed.ok).toBe(true);
        if (completed.ok) {
          expect(completed.record.completedAt).toBeInstanceOf(GCloudTimestamp);
          expect(completed.record.updatedAt).toBeInstanceOf(GCloudTimestamp);
        }
      }

      // 3. Vérification statique de l'ordre de chargement dotenv dans server.ts (FIX-02-F)
      const serverSource = fs.readFileSync(resolve(process.cwd(), 'server.ts'), 'utf-8');
      const dotenvImportIndex = serverSource.indexOf('import "dotenv/config";');
      const firebaseAdminImportIndex = serverSource.indexOf('./src/lib/firebase-admin.ts');
      expect(dotenvImportIndex).toBeGreaterThanOrEqual(0);
      expect(firebaseAdminImportIndex).toBeGreaterThan(dotenvImportIndex);
      expect(serverSource).not.toContain('dotenv.config()');
    });
  });
});


