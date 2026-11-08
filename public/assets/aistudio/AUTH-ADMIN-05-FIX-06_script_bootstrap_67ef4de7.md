# AUTH-ADMIN-05-FIX-06 — Correctifs `bootstrapSuperAdmin.ts`

Ce document contient les blocs à intégrer dans `scripts/bootstrapSuperAdmin.ts`. Conserver les autres protections FIX-05.

## 1. Remplacer `extractExactTime`

```ts
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
          valid: false, type: 'timestamp', seconds: NaN, nanoseconds: NaN,
          error: 'Timestamp malformé'
        };
      }
      return { valid: true, type: 'timestamp', seconds: rawSec, nanoseconds: rawNs };
    }

    // Ne jamais utiliser toMillis()/toDate() : ces méthodes perdent les nanosecondes.
    if (typeof val.toDate === 'function' || typeof val.toMillis === 'function') {
      return {
        valid: false, type: 'timestamp', seconds: NaN, nanoseconds: NaN,
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
        valid: false, type: 'iso_string', seconds: NaN, nanoseconds: NaN,
        error: 'Composantes ISO hors limites'
      };
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
      return {
        valid: false, type: 'iso_string', seconds: NaN, nanoseconds: NaN,
        error: 'Date calendaire impossible'
      };
    }

    const milliseconds = Date.parse(val);
    if (!Number.isFinite(milliseconds)) {
      return {
        valid: false, type: 'iso_string', seconds: NaN, nanoseconds: NaN,
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
```

## 2. Filtrer les données commerciales dans les tableaux historiques

Dans `mergeProfileDataNonDestructive()`, ajouter cette fonction locale dans `mergeRecursive()` ou juste avant `mergeRecursive()` :

```ts
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
```

Puis remplacer la branche de copie d'un tableau historique absent de la cible :

```ts
} else if (Array.isArray(histValue)) {
  const safeArray = filterHistoricalValue(histValue, fieldPath);
  if (safeArray !== undefined) {
    result[key] = safeArray;
    recoveredFields.push(fieldPath);
  }
}
```

Ne pas modifier la branche qui conserve les tableaux déjà présents dans le profil cible.

## 3. Vérifier l'identité du projet Firestore

Ajouter un résolveur fail-closed. L'instance Firestore doit être reliée à l'application Admin effectivement utilisée pour la créer. Ne pas supposer que `firestoreInstance.app` existe sans vérifier la version installée du SDK et `src/lib/firebase-admin.ts`.

```ts
export function getFirestoreProjectId(firestoreInstance: any): string | null {
  const projectId = firestoreInstance?.app?.options?.projectId;
  return typeof projectId === 'string' && projectId.length > 0
    ? projectId
    : null;
}
```

Dans `runSuperAdminBootstrap()`, remplacer le contrôle initial du seul Auth par :

```ts
const authProjectId = authSdk?.app?.options?.projectId;
const firestoreProjectId = getFirestoreProjectId(dbSdk);

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
```

**Condition obligatoire :** si `adminDb.app` n'est pas une propriété réelle de l'instance Firestore Admin du projet, adapter `src/lib/firebase-admin.ts` pour exposer l'application Admin utilisée et vérifier que Firestore a été construit avec cette application. Ne pas utiliser de variable `VITE_*`. Ne pas faire passer les tests avec une propriété fictive.

## 4. Préserver les garanties FIX-05

Ne pas modifier les contrôles email, compte actif, email vérifié, fournisseur Google, lecture avant écriture, vérification Firestore avant Custom Claims, préservation des claims, partialState, dry-run par défaut et garde CLI.

Ne pas exécuter `--execute`. Aucune mutation Firebase réelle, aucun commit, aucun push.
