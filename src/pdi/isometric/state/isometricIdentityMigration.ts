/**
 * ORTHOGONAL PD&I STUDIO — MIG-05-FIX-01
 * Résolution d'identité canonique Supabase UUID et reprise non destructive des sauvegardes isométriques.
 *
 * Garanties absolues :
 * - Zéro dépendance Firebase (`firebase/auth`, `src/lib/firebase.ts`).
 * - Zéro modification des algorithmes géométriques, isométriques, CAO 2D/3D ou normatifs.
 * - Lorsque un UUID Supabase valide est disponible, il est TOUJOURS utilisé (aucun UID `local-...` généré).
 * - La reprise `local-...` -> UUID Supabase est 100 % non destructive :
 *   1. N'écrase JAMAIS une sauvegarde cible existante.
 *   2. Vérifie strictement `snapshot.project.ownerUid === localUid`.
 *   3. Valide le JSON et la structure minimale avant toute écriture.
 *   4. Met à jour uniquement `project.ownerUid` (et métadonnées explicites de migration) dans le clone cible,
 *      sans altérer aucune donnée métier CAO (`nodes`, `segments`, `lines`, `dimensions`, `cad2dEntities`,
 *      `cad2dLayers`, `projectSetup`, `viewport`, etc.).
 *   5. Préserve intégralement la source `local-...` et `pdi.localUid.v1`.
 *   6. Écrit le marqueur d'idempotence UNIQUEMENT après vérification par relecture de l'écriture cible.
 *   7. En cas d'erreur d'écriture ou de parsing, conserve intacte la source pour permettre une reprise ultérieure.
 */

import {
  isCanonicalSupabaseUuid,
  readCanonicalSupabaseUuidFromCache,
  readVerifiedUserProfileFromCache,
} from "../../../lib/localAuthCache";
import {
  getSandboxSyntheticProfile,
  isStagingSandboxMode,
  resolveScopedStorageKey,
} from "../../../lib/stagingSandbox";

export const ISOMETRIC_LOCAL_UID_STORAGE_KEY = "pdi.localUid.v1";

export function isLocalFallbackUid(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("local-") && value.trim().length > "local-".length;
}

export function normalizeIsometricProjectKey(projectId?: string): string {
  return projectId && projectId.trim() ? projectId.trim() : "default";
}

export interface IsometricAutosaveKeys {
  prefix: string;
  current: string;
  previous: string;
  legacy: string;
  corrupt: string;
}

export function buildIsometricAutosaveKeys(
  userUid: string | null | undefined,
  projectId?: string,
  env?: Record<string, unknown>
): IsometricAutosaveKeys {
  const normalizedUid = typeof userUid === "string" ? userUid.trim() : "";
  if (!normalizedUid) {
    return { prefix: "", current: "", previous: "", legacy: "", corrupt: "" };
  }
  const activeProjectKey = normalizeIsometricProjectKey(projectId);
  const rawPrefix = `isometrie.autosave.v474.user.${normalizedUid}.project.${activeProjectKey}`;
  const prefix = resolveScopedStorageKey(rawPrefix, env);
  return {
    prefix,
    current: `${prefix}.current`,
    previous: `${prefix}.previous`,
    legacy: `${prefix}.legacy`,
    corrupt: `${prefix}.corrupt`,
  };
}

export function buildIsometricMigrationMarkerKey(
  canonicalUuid: string,
  projectId?: string,
  env?: Record<string, unknown>
): string {
  const activeProjectKey = normalizeIsometricProjectKey(projectId);
  return resolveScopedStorageKey(
    `isometrie.migration.v1.user.${canonicalUuid.trim()}.project.${activeProjectKey}`,
    env
  );
}

function getDefaultStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Résout l'identifiant canonique de l'éditeur isométrique SANS Firebase Auth.
 *
 * Ordre de priorité :
 * 1. Mode Sandbox -> UID synthétique Sandbox.
 * 2. UUID Supabase canonique lu depuis `pdi.user.profile.v1` (ou clé compatible `pdi.userProfile.v1`).
 *    Ne génère JAMAIS d'identifiant `local-...` lorsqu'un UUID Supabase valide est disponible.
 * 3. Identifiant de profil non-UUID (uniquement si présent dans le cache vérifié).
 * 4. En dernier recours hors session authentifiée -> `pdi.localUid.v1` (`local-...`).
 */
export function resolveCanonicalIsometricUserUid(options?: {
  storage?: Storage | null;
  env?: Record<string, unknown>;
  sandboxMode?: boolean;
  sandboxUid?: string;
}): string {
  const inSandbox =
    options?.sandboxMode !== undefined ? options.sandboxMode : isStagingSandboxMode(options?.env);
  if (inSandbox) {
    return options?.sandboxUid ?? getSandboxSyntheticProfile().uid;
  }

  const storage = options?.storage !== undefined ? options.storage : getDefaultStorage();

  // 1. UUID Supabase canonique prioritaire — jamais remplacé par local-...
  const canonicalUuid = readCanonicalSupabaseUuidFromCache({
    storage,
    env: options?.env,
  });
  if (canonicalUuid) {
    return canonicalUuid;
  }

  // 2. Fallback sur le uid du profil en cache s'il existe et est non vide
  const cachedProfile = readVerifiedUserProfileFromCache({
    storage,
    env: options?.env,
  });
  if (cachedProfile?.uid && cachedProfile.uid.trim().length > 0) {
    return cachedProfile.uid.trim();
  }

  // 3. Fallback local anonyme uniquement lorsqu'aucune session authentifiée n'est présente
  try {
    if (storage) {
      const key = resolveScopedStorageKey(ISOMETRIC_LOCAL_UID_STORAGE_KEY, options?.env);
      const existing = storage.getItem(key);
      if (existing && existing.trim()) {
        return existing.trim();
      }
      const generated = "local-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      storage.setItem(key, generated);
      return generated;
    }
  } catch {
    // Ignore storage access errors
  }

  return "local-session";
}

export type IsometricIdentityTransitionAction = "noop" | "switch_in_place";

/**
 * Détermine comment réagir à un changement d'UID dans `IsometrieModuleV48d` sans déclencher
 * de rechargement intempestif (`window.location.reload()`).
 *
 * - Même UID -> `noop`
 * - Transition `local-...` -> UUID Supabase (restauration F5 / login) -> `switch_in_place` (pas de reload)
 * - Changement d'utilisateur (UUID A -> UUID B ou déconnexion) -> `switch_in_place` avec réinitialisation propre du graphe en mémoire
 */
export function resolveIsometricIdentityTransition(
  previousUid: string | null,
  nextUid: string | null
): { action: IsometricIdentityTransitionAction; requiresInMemoryReset: boolean } {
  if (previousUid === nextUid) {
    return { action: "noop", requiresInMemoryReset: false };
  }
  if (!previousUid || !nextUid) {
    return { action: "switch_in_place", requiresInMemoryReset: Boolean(previousUid && !nextUid) };
  }
  // Bascule d'un UID local initial vers l'UUID Supabase authentifié : la reprise non destructive chargera les données sans vider prématurément avant lecture.
  if (isLocalFallbackUid(previousUid) && isCanonicalSupabaseUuid(nextUid)) {
    return { action: "switch_in_place", requiresInMemoryReset: false };
  }
  // Changement entre deux utilisateurs distincts (A -> B) ou logout (A -> local) : isolation stricte en mémoire sans rechargement brutal.
  return { action: "switch_in_place", requiresInMemoryReset: true };
}

export type IsometricAutosaveMigrationStatus =
  | "migrated"
  | "skipped_invalid_target_uuid"
  | "skipped_target_exists"
  | "skipped_already_migrated"
  | "skipped_no_local_uid"
  | "skipped_no_source_autosave"
  | "skipped_invalid_source_json"
  | "skipped_owner_mismatch"
  | "skipped_empty_source"
  | "error_source_preserved";

export interface IsometricAutosaveMigrationMarker {
  schema: "pdi.isometric.local-to-uuid.v1";
  status: "copied_source_preserved";
  fromLocalUid: string;
  targetUuid: string;
  projectId: string;
  sourceKey: string;
  targetKey: string;
  migratedAt: string;
}

export interface IsometricAutosaveMigrationResult {
  status: IsometricAutosaveMigrationStatus;
  migrated: boolean;
  sourcePreserved: boolean;
  sourceKey?: string;
  targetKey?: string;
  markerKey?: string;
  fromLocalUid?: string;
  targetUuid?: string;
  error?: string;
}

function hasNonEmptyCadContent(snapshot: Record<string, any>): boolean {
  const model = snapshot.model && typeof snapshot.model === "object" ? snapshot.model : null;
  if (!model) return false;

  const nodesCount = Array.isArray(model.nodes) ? model.nodes.length : 0;
  const segmentsCount = Array.isArray(model.segments) ? model.segments.length : 0;
  const cad2dInModel = Array.isArray(model.cad2dEntities) ? model.cad2dEntities.length : 0;
  const cad2dAtRoot = Array.isArray(snapshot.cad2dEntities) ? snapshot.cad2dEntities.length : 0;
  const cad2dInWorkspace =
    snapshot.workspace &&
    typeof snapshot.workspace === "object" &&
    Array.isArray(snapshot.workspace.cad2dEntities)
      ? snapshot.workspace.cad2dEntities.length
      : 0;

  return nodesCount > 0 || segmentsCount > 0 || cad2dInModel > 0 || cad2dAtRoot > 0 || cad2dInWorkspace > 0;
}

function isValidIsometricSnapshotStructure(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, any>;
  if (!obj.project || typeof obj.project !== "object" || Array.isArray(obj.project)) {
    return false;
  }
  if (!obj.model || typeof obj.model !== "object" || Array.isArray(obj.model)) {
    return false;
  }
  if (!Array.isArray(obj.model.nodes) || !Array.isArray(obj.model.segments)) {
    return false;
  }
  return true;
}

/**
 * Reprise non destructive d'une sauvegarde locale `local-...` vers l'UUID Supabase canonique.
 *
 * - Règle 1 : N'écrase JAMAIS une sauvegarde cible existante.
 * - Règle 2 : Vérifie strictement `snapshot.project.ownerUid === localUid`.
 * - Règle 3 : Valide le JSON et la structure avant toute écriture.
 * - Règle 4 : Met à jour uniquement `project.ownerUid` + métadonnées de migration dans le clone cible.
 * - Règle 5 & 6 : Préserve intégralement la source `local-...` et `pdi.localUid.v1`.
 * - Règle 7 : Écrit le marqueur d'idempotence uniquement après vérification de la cible écrite.
 * - Règle 8 : Toute erreur conserve la source et n'écrit pas le marqueur, autorisant une reprise sûre.
 * - Règle 9 : Zéro altération des données métier CAO.
 */
export function migrateLocalIsometricAutosaveToCanonicalUuid(params: {
  canonicalUuid: string;
  projectId?: string;
  storage?: Storage | null;
  env?: Record<string, unknown>;
  nowIso?: () => string;
}): IsometricAutosaveMigrationResult {
  const storage = params.storage !== undefined ? params.storage : getDefaultStorage();
  const canonicalUuid = typeof params.canonicalUuid === "string" ? params.canonicalUuid.trim() : "";

  if (!isCanonicalSupabaseUuid(canonicalUuid) || !storage) {
    return {
      status: "skipped_invalid_target_uuid",
      migrated: false,
      sourcePreserved: true,
    };
  }

  const activeProjectKey = normalizeIsometricProjectKey(params.projectId);
  const targetKeys = buildIsometricAutosaveKeys(canonicalUuid, activeProjectKey, params.env);
  const markerKey = buildIsometricMigrationMarkerKey(canonicalUuid, activeProjectKey, params.env);

  try {
    // Règle 1 : Interdiction absolue d'écraser une sauvegarde cible existante
    const existingTarget = storage.getItem(targetKeys.current);
    if (existingTarget !== null && existingTarget.trim().length > 0) {
      return {
        status: "skipped_target_exists",
        migrated: false,
        sourcePreserved: true,
        targetKey: targetKeys.current,
        markerKey,
        targetUuid: canonicalUuid,
      };
    }

    // Règle 7 : Idempotence — ne pas ré-exécuter si déjà migrée avec succès pour ce couple (UUID, projet)
    const existingMarkerRaw = storage.getItem(markerKey);
    if (existingMarkerRaw) {
      try {
        const marker = JSON.parse(existingMarkerRaw) as Partial<IsometricAutosaveMigrationMarker>;
        if (marker?.status === "copied_source_preserved" && marker?.targetUuid === canonicalUuid) {
          return {
            status: "skipped_already_migrated",
            migrated: false,
            sourcePreserved: true,
            targetKey: targetKeys.current,
            markerKey,
            targetUuid: canonicalUuid,
            fromLocalUid: marker.fromLocalUid,
          };
        }
      } catch {
        // Marqueur corrompu ignoré pour autoriser une reprise sûre
      }
    }

    // Recherche de l'ancien UID local (sans jamais le supprimer)
    const localUidKey = resolveScopedStorageKey(ISOMETRIC_LOCAL_UID_STORAGE_KEY, params.env);
    const localUid = storage.getItem(localUidKey)?.trim() || "";
    if (!isLocalFallbackUid(localUid)) {
      return {
        status: "skipped_no_local_uid",
        migrated: false,
        sourcePreserved: true,
        targetKey: targetKeys.current,
        markerKey,
        targetUuid: canonicalUuid,
      };
    }

    // Lecture de la source `local-...` (.current en priorité, .previous en second recours)
    const sourceKeys = buildIsometricAutosaveKeys(localUid, activeProjectKey, params.env);
    let sourceKeyUsed = sourceKeys.current;
    let sourceRaw = storage.getItem(sourceKeys.current);
    if (!sourceRaw || !sourceRaw.trim()) {
      sourceKeyUsed = sourceKeys.previous;
      sourceRaw = storage.getItem(sourceKeys.previous);
    }

    if (!sourceRaw || !sourceRaw.trim()) {
      return {
        status: "skipped_no_source_autosave",
        migrated: false,
        sourcePreserved: true,
        sourceKey: sourceKeys.current,
        targetKey: targetKeys.current,
        markerKey,
        fromLocalUid: localUid,
        targetUuid: canonicalUuid,
      };
    }

    // Règle 3 : Validation JSON et structurelle AVANT toute écriture
    let parsed: unknown;
    try {
      parsed = JSON.parse(sourceRaw);
    } catch {
      return {
        status: "skipped_invalid_source_json",
        migrated: false,
        sourcePreserved: true,
        sourceKey: sourceKeyUsed,
        targetKey: targetKeys.current,
        markerKey,
        fromLocalUid: localUid,
        targetUuid: canonicalUuid,
      };
    }

    if (!isValidIsometricSnapshotStructure(parsed)) {
      return {
        status: "skipped_invalid_source_json",
        migrated: false,
        sourcePreserved: true,
        sourceKey: sourceKeyUsed,
        targetKey: targetKeys.current,
        markerKey,
        fromLocalUid: localUid,
        targetUuid: canonicalUuid,
      };
    }

    // Règle 2 : Vérification stricte de la propriété `snapshot.project.ownerUid`
    const declaredOwnerUid =
      typeof parsed.project.ownerUid === "string" ? parsed.project.ownerUid.trim() : "";
    if (declaredOwnerUid !== localUid) {
      return {
        status: "skipped_owner_mismatch",
        migrated: false,
        sourcePreserved: true,
        sourceKey: sourceKeyUsed,
        targetKey: targetKeys.current,
        markerKey,
        fromLocalUid: localUid,
        targetUuid: canonicalUuid,
      };
    }

    if (!hasNonEmptyCadContent(parsed)) {
      return {
        status: "skipped_empty_source",
        migrated: false,
        sourcePreserved: true,
        sourceKey: sourceKeyUsed,
        targetKey: targetKeys.current,
        markerKey,
        fromLocalUid: localUid,
        targetUuid: canonicalUuid,
      };
    }

    // Règle 4 & Règle 9 : Clone intégral des données CAO, modification limitée à project.ownerUid + métadonnées de migration
    const migratedAt = params.nowIso ? params.nowIso() : new Date().toISOString();
    const clonedSnapshot = JSON.parse(sourceRaw) as Record<string, any>;
    clonedSnapshot.project = {
      ...clonedSnapshot.project,
      ownerUid: canonicalUuid,
      migratedFromLocalUid: localUid,
      migratedAt,
    };

    const serializedTarget = JSON.stringify(clonedSnapshot);

    // Double vérification de non-écrasement juste avant l'écriture cible
    const recheckTarget = storage.getItem(targetKeys.current);
    if (recheckTarget !== null && recheckTarget.trim().length > 0) {
      return {
        status: "skipped_target_exists",
        migrated: false,
        sourcePreserved: true,
        sourceKey: sourceKeyUsed,
        targetKey: targetKeys.current,
        markerKey,
        fromLocalUid: localUid,
        targetUuid: canonicalUuid,
      };
    }

    // Écriture cible
    storage.setItem(targetKeys.current, serializedTarget);

    // Règle 7 : Vérification effective par relecture + validation JSON avant écriture du marqueur d'idempotence
    const readBackRaw = storage.getItem(targetKeys.current);
    if (readBackRaw !== serializedTarget) {
      throw new Error("Target autosave write verification failed: read-back mismatch.");
    }
    const readBackParsed = JSON.parse(readBackRaw) as Record<string, any>;
    if (readBackParsed?.project?.ownerUid !== canonicalUuid) {
      throw new Error("Target autosave write verification failed: ownerUid mismatch.");
    }

    // Règle 5 & 6 : Ne JAMAIS supprimer la source `local-...` ni `pdi.localUid.v1`
    const marker: IsometricAutosaveMigrationMarker = {
      schema: "pdi.isometric.local-to-uuid.v1",
      status: "copied_source_preserved",
      fromLocalUid: localUid,
      targetUuid: canonicalUuid,
      projectId: activeProjectKey,
      sourceKey: sourceKeyUsed,
      targetKey: targetKeys.current,
      migratedAt,
    };
    storage.setItem(markerKey, JSON.stringify(marker));

    return {
      status: "migrated",
      migrated: true,
      sourcePreserved: true,
      sourceKey: sourceKeyUsed,
      targetKey: targetKeys.current,
      markerKey,
      fromLocalUid: localUid,
      targetUuid: canonicalUuid,
    };
  } catch (err: unknown) {
    // Règle 8 : Toute erreur préserve la source et n'écrit pas le marqueur d'idempotence
    return {
      status: "error_source_preserved",
      migrated: false,
      sourcePreserved: true,
      targetKey: targetKeys.current,
      markerKey,
      targetUuid: canonicalUuid,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
