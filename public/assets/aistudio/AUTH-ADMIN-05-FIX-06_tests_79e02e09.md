# AUTH-ADMIN-05-FIX-06 — Tests complémentaires

Fichier cible : `src/security/tests/adminBootstrapValidation.spec.ts`.

Ajouter ces tests à la suite FIX-05 existante. Ne supprimer aucun test antérieur.

## 1. Import

Ajouter `getFirestoreProjectId` à l'import de `bootstrapSuperAdmin.ts`.

## 2. Tests ISO stricts

```ts
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
```

## 3. Tests des tableaux

```ts
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
```

## 4. Tests de cohérence Auth / Firestore

Dans le `beforeEach`, ajouter au mock `mockDb` une propriété `app` :

```ts
app: {
  options: {
    projectId: EXPECTED_PROJECT_ID
  }
},
```

Conserver intégralement l'implémentation actuelle de `collection()`.

Ajouter ensuite :

```ts
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
```

## 5. Vérification de l'API réelle

Les tests ci-dessus doivent refléter l'initialisation réelle de `src/lib/firebase-admin.ts`. Si l'instance Firestore Admin n'expose pas `app`, adapter le contrôle et les tests pour utiliser l'application Admin réellement passée à `getFirestore(app)`. Ne pas ajouter une propriété fictive au seul mock de test.

## 6. Validation

Conserver tous les tests FIX-01 à FIX-05 et exécuter uniquement :

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Interdictions : pas de `--execute`, aucune mutation Firebase réelle, aucun commit, aucun push.
