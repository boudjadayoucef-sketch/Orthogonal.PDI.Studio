/**
 * ORTHOGONAL PD&I STUDIO — SEC-01 / AUTH-ADMIN-05-FIX-06
 * Tests unitaires complets et réels pour le script de Bootstrap Super Admin.
 *
 * Ces tests s'exécutent avec `npm test` indépendamment de l'émulateur Java Firestore.
 * Ils intègrent l'ensemble de la suite FIX-01 à FIX-05 complétée par les blocs FIX-06 :
 * - FIX-06 B1 : Tests ISO stricts (fuseau obligatoire, calendrier réel, fraction 9 chiffres max, décalages UTC, égalité multi-fuseaux)
 * - FIX-06 B2 : Tests des tableaux et filtrage récursif des données commerciales historiques
 * - FIX-06 B3 : Tests de cohérence et validation croisée Auth / Firestore (getFirestoreProjectId)
 * - B3 : Test d'import isolé instrumenté en sous-processus vierge
 * - B4 : Sécurité et absence totale de mutation en mode dry-run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
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
  EXPECTED_PROJECT_ID,
  ALLOWED_SUPER_ADMIN_EMAIL,
  HISTORICAL_PROFILE_DOC_ID,
  FORBIDDEN_HISTORICAL_AUTH_LEAF_KEYS
} from '../../../scripts/bootstrapSuperAdmin.ts';

describe('AUTH-ADMIN-05-FIX-06 : Suite de validation unitaire du Bootstrap Super Admin', () => {
  const validUid = 'google_user_youcef_12345';

  let mockAuth: any;
  let mockDb: any;
  let store: Map<string, any>;
  let userRecordState: any;
  let callSequence: string[];

  beforeEach(() => {
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
        if (email === userRecordState.email) {
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
              })
            };
          })
        };
      })
    };
  });

  // =========================================================================
  // 1. SÉCURITÉ DRY-RUN ET CONDITIONS PRÉALABLES (B4 & POINTS 1 À 6)
  // =========================================================================

  it('1. B4 — Dry-run sécurisé sans mutation : lectures seules Auth/Firestore, aucune écriture', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      projectsCount: 16
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
    expect(diffs[0]).toContain("Horodatage non conforme au chemin 'time'");
  });

  it('9. B1 — Deux Timestamps différant de 500 000 nanosecondes (même milliseconde) sont rejetés', () => {
    const ts1 = { _seconds: 1785571200, _nanoseconds: 100000 };
    const ts2 = { _seconds: 1785571200, _nanoseconds: 600000 };
    expect(areDatesOrTimestampsEqual(ts1, ts2)).toBe(false);
    const diffs = deepCompareFirestoreData({ time: ts1 }, { time: ts2 });
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("Horodatage non conforme au chemin 'time'");
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
    expect(diffs[0]).toContain("Horodatage non conforme au chemin 'createdAt'");
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
    expect(diffs[0]).toContain("Horodatage non conforme au chemin 'd'");
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
  // 3. CORRECTION B2 : PROTECTION BASÉE SUR LE MODÈLE COMMERCIAL RÉEL DU PROJET
  // =========================================================================

  it('15. B2 — Protection absolue des données commerciales réelles (racine et imbriquées, absentes de la cible)', () => {
    const targetData = {
      uid: validUid,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      name: 'Youcef Boudjada'
    };

    const historicalData = {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      accountType: 'enterprise',
      subscriptionPlan: 'lifetime',
      status: 'active',
      paymentGateway: 'slickpay_baridimob',
      currency: 'DZD',
      storageUsedKb: 204800,
      loginCount: 42,
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
      account: {
        department: 'Direction Technique Pipelines'
      },
      company: 'PD&I Vision DZ'
    };

    const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

    expect(result.mergedData.accountType).toBeUndefined();
    expect(result.mergedData.subscriptionPlan).toBeUndefined();
    expect(result.mergedData.status).toBeUndefined();
    expect(result.mergedData.paymentGateway).toBeUndefined();
    expect(result.mergedData.currency).toBeUndefined();
    expect(result.mergedData.storageUsedKb).toBeUndefined();
    expect(result.mergedData.loginCount).toBeUndefined();
    expect(result.mergedData.licenses).toBeUndefined();
    expect(result.mergedData.assignedPlan).toBeUndefined();
    expect(result.mergedData.maxUsers).toBeUndefined();
    expect(result.mergedData.billing).toBeUndefined();
    expect(result.mergedData.billingCounters).toBeUndefined();
    expect(result.mergedData.invoices).toBeUndefined();
    expect(result.mergedData.metadata?.paymentStatus).toBeUndefined();

    expect(result.mergedData.company).toBe('PD&I Vision DZ');
    expect(result.mergedData.account?.department).toBe('Direction Technique Pipelines');
    expect(result.mergedData.metadata?.lastUpdatedBy).toBe('auditor_pdi');
    expect(result.recoveredFields).toContain('company');
  });

  it('16. B2 — Les données commerciales réelles présentes dans la cible restent strictement intactes', () => {
    const targetData = {
      uid: validUid,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      accountType: 'basic',
      subscriptionPlan: 'monthly',
      status: 'pending_activation',
      paymentGateway: 'paddle',
      currency: 'USD',
      storageUsedKb: 0,
      billing: {
        customerId: 'target_paddle_cus_1'
      }
    };

    const historicalData = {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL,
      accountType: 'enterprise',
      subscriptionPlan: 'lifetime',
      status: 'active',
      paymentGateway: 'slickpay_baridimob',
      currency: 'DZD',
      storageUsedKb: 500000,
      billing: {
        customerId: 'hist_slickpay_old'
      }
    };

    const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

    expect(result.mergedData.accountType).toBe('basic');
    expect(result.mergedData.subscriptionPlan).toBe('monthly');
    expect(result.mergedData.status).toBe('pending_activation');
    expect(result.mergedData.paymentGateway).toBe('paddle');
    expect(result.mergedData.currency).toBe('USD');
    expect(result.mergedData.storageUsedKb).toBe(0);
    expect(result.mergedData.billing?.customerId).toBe('target_paddle_cus_1');

    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'accountType' }),
        expect.objectContaining({ field: 'subscriptionPlan' }),
        expect.objectContaining({ field: 'status' }),
        expect.objectContaining({ field: 'paymentGateway' }),
        expect.objectContaining({ field: 'currency' }),
        expect.objectContaining({ field: 'storageUsedKb' }),
        expect.objectContaining({ field: 'billing' })
      ])
    );
  });

  // =========================================================================
  // FIX-06 B2 : TESTS DES TABLEAUX ET FILTRAGE DES DONNÉES COMMERCIALES
  // =========================================================================

  it('FIX-06 B2 — filtre les champs commerciaux dans un tableau historique absent de la cible', () => {
    const result = mergeProfileDataNonDestructive(
      validUid,
      { uid: validUid, email: ALLOWED_SUPER_ADMIN_EMAIL },
      {
        preferences: [{
          language: 'fr',
          billingData: { customerId: 'CUS-123', balance: 500 },
          department: 'Pipelines'
        }]
      }
    );

    expect(result.mergedData.preferences).toEqual([
      { language: 'fr', department: 'Pipelines' }
    ]);
  });

  it('FIX-06 B2 — filtre les champs commerciaux dans les tableaux imbriqués', () => {
    const result = mergeProfileDataNonDestructive(
      validUid,
      { uid: validUid },
      {
        workspace: {
          history: [{
            label: 'Projet B31',
            nested: [{
              description: 'Étude technique',
              paymentStatus: 'paid',
              licenseKey: 'SECRET-LICENSE'
            }]
          }]
        }
      }
    );

    expect(result.mergedData.workspace).toEqual({
      history: [{
        label: 'Projet B31',
        nested: [{ description: 'Étude technique' }]
      }]
    });
  });

  it('FIX-06 B2 — ne modifie pas un tableau déjà présent dans la cible', () => {
    const targetArray = [
      { label: 'Cible', billing: { customerId: 'TARGET-CUSTOMER' } }
    ];

    const result = mergeProfileDataNonDestructive(
      validUid,
      { uid: validUid, preferences: targetArray },
      { preferences: [{ label: 'Historique', paymentStatus: 'paid' }] }
    );

    expect(result.mergedData.preferences).toEqual(targetArray);
  });

  // =========================================================================
  // FIX-06 B3 : TESTS DE COHÉRENCE AUTH / FIRESTORE
  // =========================================================================

  it('FIX-06 B3 — reconnaît le projet Firestore autorisé', () => {
    expect(getFirestoreProjectId({
      app: { options: { projectId: EXPECTED_PROJECT_ID } }
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
  });

  // =========================================================================
  // 4. VÉRIFICATION INTÉGRALE DES DOCUMENTS ET ÉTATS PARTIELS
  // =========================================================================

  it('17. Détection stricte des champs supplémentaires inattendus', () => {
    const expected = { uid: 'user_1', name: 'Youcef' };
    const actualWithExtra = { uid: 'user_1', name: 'Youcef', unexpectedField: 'ghost' };
    const diffs = deepCompareFirestoreData(expected, actualWithExtra);
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("Champ supplémentaire inattendu au chemin 'unexpectedField'");
  });

  it('18. Rejet en cas de champ inattendu après écriture (profileVerified = false, partialState = true)', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL
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
    expect(report.error).toContain("Champ supplémentaire inattendu au chemin 'rogueField'");
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('19. Échec d’attribution des Custom Claims après écriture -> partialState: true', async () => {
    store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
      uid: HISTORICAL_PROFILE_DOC_ID,
      email: ALLOWED_SUPER_ADMIN_EMAIL
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
      email: ALLOWED_SUPER_ADMIN_EMAIL
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

    expect(() => parseCliArgs(['--unknown-flag'])).toThrow('[ARGUMENT INVALIDE]');
    expect(() => parseCliArgs(['positional-arg'])).toThrow('[ARGUMENT INVALIDE]');
    expect(() => parseCliArgs(['--execute', '--dry-run'])).toThrow('[ARGUMENT INVALIDE]');
    expect(() => parseCliArgs(['--execute', '--execute'])).toThrow('[ARGUMENT INVALIDE]');
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

  // FIX-07-A : Échec ambigu de l'écriture Firestore et relecture diagnostique
  describe('FIX-07-A : Échec ambigu de l’écriture Firestore', () => {
    it('signale partialState: true et requiert intervention si targetDocRef.set() échoue mais que les données sont constatées', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        company: 'PD&I Vision DZ'
      });

      // Simuler une exception sur targetDocRef.set(), mais le document est tout de même écrit sur le store
      const originalCol = mockDb.collection.bind(mockDb);
      mockDb.collection = (colName: string) => {
        const col = originalCol(colName);
        const originalDoc = col.doc.bind(col);
        col.doc = (docId: string) => {
          const docObj = originalDoc(docId);
          if (docId === validUid) {
            docObj.set = vi.fn(async (data: any, options: any) => {
              // Écrit quand même les données attendues (effet de bord serveur)
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
      // Ne doit JAMAIS continuer vers setCustomUserClaims
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('signale partialState: true et échec ambigu si targetDocRef.set() échoue et que les données ne sont pas présentes', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
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

  // FIX-07-B & FIX-07-G : Comparaison structurelle des custom claims
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
      expect(diffs[0]).toContain("Claim attendu manquant au chemin 'legacyClaim'");
    });

    it('détecte impérativement un claim supplémentaire inattendu', () => {
      const expected = { role: 'super_admin' };
      const actual = { role: 'super_admin', rogueClaim: 'infiltrated' };

      const diffs = compareClaimsStructural(expected, actual);
      expect(diffs.length).toBe(1);
      expect(diffs[0]).toContain("Claim supplémentaire inattendu au chemin 'rogueClaim'");
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
        uid: HISTORICAL_PROFILE_DOC_ID
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
      expect(report.error).toContain("Claim supplémentaire inattendu au chemin 'unexpectedBackendClaim'");
    });
  });

  // FIX-07-C : Protection des champs d'autorisation historiques
  describe('FIX-07-C : Protection des champs d’autorisation historiques', () => {
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

    it('n’importe aucun champ d’autorisation depuis l’historique si la cible ne les possède pas', () => {
      const targetData = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        company: 'PD&I Tech'
      };

      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        role: 'super_admin',
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
        projectContext: 'pipeline_b31'
      };

      const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

      expect(result.mergedData.role).toBeUndefined();
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

      // Le champ non sensible est bien récupéré
      expect(result.mergedData.projectContext).toBe('pipeline_b31');
    });

    it('préserve strictement les autorisations déjà présentes dans le document cible et consigne un conflit', () => {
      const targetData = {
        uid: validUid,
        email: ALLOWED_SUPER_ADMIN_EMAIL,
        role: 'field_inspector',
        permissions: ['read_pipe']
      };

      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        role: 'super_admin',
        permissions: ['all_access']
      };

      const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

      expect(result.mergedData.role).toBe('field_inspector');
      expect(result.mergedData.permissions).toEqual(['read_pipe']);
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'role', valuesDiffer: true, conflictCategory: 'authorization' }),
          expect.objectContaining({ field: 'permissions', valuesDiffer: true, conflictCategory: 'authorization' })
        ])
      );
    });

    it('filtre les champs d’autorisation au sein des tableaux et objets contenus dans les tableaux', () => {
      const result = mergeProfileDataNonDestructive(
        validUid,
        { uid: validUid },
        {
          teamMembers: [
            { name: 'Youcef', role: 'super_admin', permissions: ['all'], department: 'Pipelines' }
          ]
        }
      );

      expect(result.mergedData.teamMembers).toEqual([
        { name: 'Youcef', department: 'Pipelines' }
      ]);
    });
  });

  // FIX-07-D : Validation stricte du compte désactivé (disabled === false)
  describe('FIX-07-D : Validation stricte du compte désactivé', () => {
    it('refuse un compte dont la propriété disabled est undefined', async () => {
      userRecordState.disabled = undefined;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
    });

    it('refuse un compte dont la propriété disabled est null', async () => {
      userRecordState.disabled = null;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
    });

    it('refuse un compte dont la propriété disabled est une chaîne de caractères', async () => {
      userRecordState.disabled = 'false' as any;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.success).toBe(false);
      expect(report.error).toContain('[COMPTE DÉSACTIVÉ]');
    });

    it('accepte uniquement lorsque disabled vaut strictement false (booléen)', async () => {
      userRecordState.disabled = false;
      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect(report.disabled).toBe(false);
    });
  });

  // FIX-07-E : Réduction des données exposées dans les rapports
  describe('FIX-07-E : Réduction des données exposées dans les rapports', () => {
    it('ne contient jamais finalProfileToSave dans le rapport', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        secretNote: 'TopSecretHistoricalData'
      });

      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect((report as any).finalProfileToSave).toBeUndefined();
    });

    it('ne contient aucune valeur brute cible ou historique dans conflictsDetected', async () => {
      const targetData = {
        uid: validUid,
        secretField: 'TargetSecretValue123'
      };
      const historicalData = {
        uid: HISTORICAL_PROFILE_DOC_ID,
        secretField: 'HistoricalSecretValue999'
      };

      const result = mergeProfileDataNonDestructive(validUid, targetData, historicalData);

      expect(result.conflicts.length).toBe(1);
      const conflict = result.conflicts[0];
      expect(conflict.field).toBe('secretField');
      expect(conflict.valuesDiffer).toBe(true);
      expect((conflict as any).targetValue).toBeUndefined();
      expect((conflict as any).historicalValue).toBeUndefined();
    });

    it('expose uniquement les noms des clés de claims (existingClaimKeys, updatedClaimKeys)', async () => {
      userRecordState.customClaims = {
        tenantId: 'algeria_hub',
        confidentialData: 'private'
      };

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

  // FIX-07-F : Protection contre la pollution de prototype
  describe('FIX-07-F : Protection contre la pollution de prototype', () => {
    it('ignore récursivement __proto__, constructor et prototype lors de la fusion', () => {
      const maliciousData = JSON.parse(
        '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"prototype":{"polluted":"yes"},"safeProp":"valid"}'
      );

      const result = mergeProfileDataNonDestructive(validUid, null, maliciousData);

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(result.mergedData.safeProp).toBe('valid');
      expect(result.mergedData.__proto__).toBe(Object.prototype);
      expect(Object.keys(result.mergedData)).not.toContain('__proto__');
      expect(Object.keys(result.mergedData)).not.toContain('constructor');
      expect(Object.keys(result.mergedData)).not.toContain('prototype');
    });

    it('filtre les clés malveillantes au sein des objets contenus dans les tableaux', () => {
      const maliciousArray = [
        JSON.parse('{"__proto__":{"polluted":"array"},"constructor":{"bad":true},"title":"Valid Title"}')
      ];

      const result = mergeProfileDataNonDestructive(
        validUid,
        { uid: validUid },
        { items: maliciousArray }
      );

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(result.mergedData.items).toEqual([{ title: 'Valid Title' }]);
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
  // 8. AUTH-ADMIN-05-FIX-08 : TESTS UNITAIRES DES CORRECTIFS FINAUX A À H
  // =========================================================================

  describe('AUTH-ADMIN-05-FIX-08 : Non-divulgation, propriétés propres et préservation cible', () => {
    it('FIX-08-A : aucune valeur brute dans les messages de compareClaimsStructural', () => {
      const secret = 'FIX08_PRIVATE_VALUE_9f71';
      const diffs = compareClaimsStructural(
        { privateField: secret },
        { privateField: 'different-value' }
      );
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.join(' ')).not.toContain(secret);
      expect(diffs.join(' ')).not.toContain('different-value');
      expect(diffs[0]).toContain("Claim non conforme au chemin 'privateField' : valeur différente.");
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
      expect(claimDiffs[0]).toContain("Claim attendu manquant au chemin 'inheritedClaim'");

      const actualDoc = Object.create(proto);
      actualDoc.name = 'target_user';

      const docDiffs = deepCompareFirestoreData(
        { name: 'target_user', inheritedField: 'proto_field' },
        actualDoc
      );
      expect(docDiffs.length).toBe(1);
      expect(docDiffs[0]).toContain("Champ attendu manquant au chemin 'inheritedField'");
    });

    it('FIX-08-D : les clés historiques dangereuses restent exclues lors de la fusion', () => {
      const historicalData = JSON.parse(
        '{"__proto__":{"polluted":"hist"},"constructor":{"bad":true},"prototype":{"bad":true},"safeField":"kept"}'
      );
      const result = mergeProfileDataNonDestructive(validUid, { uid: validUid }, historicalData);
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(result.mergedData.safeField).toBe('kept');
      expect(Object.prototype.hasOwnProperty.call(result.mergedData, '__proto__')).toBe(false);
    });

    it('FIX-08-E : les propriétés propres légitimes de la cible sont préservées (constructorName, prototypeVersion, constructor, __proto__)', () => {
      const targetData: Record<string, any> = {
        uid: validUid,
        constructorName: 'CustomCivilPipelineBuilder',
        prototypeVersion: 'v2.4.1'
      };
      Object.defineProperty(targetData, 'constructor', {
        value: 'ChiefPdiArchitect',
        writable: true,
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(targetData, '__proto__', {
        value: 'legitimate_own_proto_data',
        writable: true,
        enumerable: true,
        configurable: true
      });

      const result = mergeProfileDataNonDestructive(validUid, targetData, null);

      expect(result.mergedData.constructorName).toBe('CustomCivilPipelineBuilder');
      expect(result.mergedData.prototypeVersion).toBe('v2.4.1');
      expect(result.mergedData.constructor).toBe('ChiefPdiArchitect');
      expect(Object.prototype.hasOwnProperty.call(result.mergedData, '__proto__')).toBe(true);
      expect(result.mergedData.__proto__).toBe('legitimate_own_proto_data');
      expect(Object.getPrototypeOf(result.mergedData)).toBe(Object.prototype);
    });

    it('FIX-08-F : absence absolue de pollution de prototype sur Object.prototype', () => {
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).bad).toBeUndefined();
    });

    it('FIX-08-G : absence d’email et d’UID dans le rapport final', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID,
        company: 'PD&I Tech'
      });

      const report = await runSuperAdminBootstrap({
        authInstance: mockAuth,
        firestoreInstance: mockDb
      });

      expect((report as any).email).toBeUndefined();
      expect((report as any).uid).toBeUndefined();

      const reportJson = JSON.stringify(report);
      expect(reportJson).not.toContain(ALLOWED_SUPER_ADMIN_EMAIL);
      expect(reportJson).not.toContain(validUid);
    });

    it('FIX-08-H : les erreurs remontées dans report.error ne divulguent aucune valeur brute ni secret', async () => {
      store.set(`profiles/${HISTORICAL_PROFILE_DOC_ID}`, {
        uid: HISTORICAL_PROFILE_DOC_ID
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
      expect(report.error).toContain("Claim supplémentaire inattendu au chemin 'rogueKeySecret'");
    });
  });
});


