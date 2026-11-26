/**
 * ORTHOGONAL PD&I STUDIO — MIG-05-FIX-01
 * Test B — Identité canonique Supabase UUID et reprise non destructive des sauvegardes isométriques
 *
 * Couverture obligatoire :
 * - T-ISO-01 : UUID Supabase canonique (aucun `local-...` généré lorsqu'un UUID valide existe)
 * - T-ISO-02 : Restauration après F5 (synchronisation de `pdi.user.profile.v1`, aucun reload intempestif)
 * - T-ISO-03 : Reprise locale non destructive (`local-...` -> UUID Supabase, source préservée, idempotence, reprise sûre après erreur)
 * - T-ISO-04 : Interdiction absolue d'écrasement d'une sauvegarde cible existante (+ rejet ownerUid incohérent / JSON invalide)
 * - T-ISO-05 : Isolation stricte entre utilisateurs A et B
 * - T-ISO-06 : Intégrité bit-à-bit des données CAO avant/après (nodes, segments, lines, dimensions, cad2dEntities, cad2dLayers, projectSetup, viewport)
 */

import { describe, expect, it } from "vitest";
import {
  CANONICAL_USER_PROFILE_STORAGE_KEY,
  isCanonicalSupabaseUuid,
  purgeLocalAuthCaches,
  readCanonicalSupabaseUuidFromCache,
  readVerifiedUserProfileFromCache,
  syncVerifiedUserProfileCache,
} from "../../lib/localAuthCache.ts";
import {
  ISOMETRIC_LOCAL_UID_STORAGE_KEY,
  buildIsometricAutosaveKeys,
  buildIsometricMigrationMarkerKey,
  migrateLocalIsometricAutosaveToCanonicalUuid,
  resolveCanonicalIsometricUserUid,
  resolveIsometricIdentityTransition,
} from "../../pdi/isometric/state/isometricIdentityMigration.ts";
import type { PdiUserProfile } from "../../types/pdiAuthTypes.ts";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  public failNextSetOnKey: string | null = null;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failNextSetOnKey === key) {
      this.failNextSetOnKey = null;
      throw new Error("QuotaExceededError: simulated write failure");
    }
    this.store.set(key, String(value));
  }
}

const UUID_SUPER_ADMIN = "7243efe7-113d-45f2-8f2e-044799b25ff0";
const UUID_USER_A = "11111111-2222-4333-8444-555555555555";
const UUID_USER_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeProfile(uid: string, email: string, name: string): PdiUserProfile {
  return {
    uid,
    email,
    name,
    company: "Orthogonal Engineering",
    country: "Algérie",
    countryCode: "DZ",
    role: uid === UUID_SUPER_ADMIN ? "super_admin" : "client",
    accountType: "pro",
    subscriptionPlan: "yearly",
    status: "active",
    createdAt: "2026-11-23T10:00:00.000Z",
  };
}

/**
 * Snapshot CAO complet et représentatif incluant :
 * nodes, segments, lines, dimensions, cad2dEntities, cad2dLayers, projectSetup et viewport.
 */
function buildRepresentativeCadSnapshot(ownerUid: string, projectName = "Collecteur Gaz HP-101") {
  return {
    schemaVersion: "4.7.4",
    exportedAt: "2026-11-25T14:20:00.000Z",
    project: {
      id: "proj-hp-101",
      ownerUid,
      name: projectName,
      wilaya: "Hassi Messaoud",
      pressDesign: 68.5,
      createdAt: "2026-11-20T09:00:00.000Z",
      updatedAt: "2026-11-25T14:20:00.000Z",
      unitSystem: "metric",
      projectSetup: {
        designCode: "ASME B31.8",
        fluidService: "Natural Gas",
        materialSpec: "API 5L X65",
        corrosionAllowanceMm: 3.0,
        designTemperatureC: 65,
        locationClass: 2,
      },
    },
    model: {
      lines: [
        {
          id: "line-100",
          lineNumber: '6"-NG-101-A1B',
          service: "GAS",
          dn: 150,
          nps: '6"',
          material: "API 5L X65",
          pressureClass: "600#",
          schedule: "80",
          designPressure: 68.5,
          color: "#22D3EE",
        },
      ],
      nodes: [
        {
          id: "N01",
          x: 0,
          y: 0,
          z: 0,
          kind: "equipment",
          equipmentType: "pump",
          label: "P-101A",
          ports: [{ index: 0, dx: 1, dy: 0, dz: 0, connectionType: "flanged" }],
        },
        {
          id: "N02",
          x: 4.5,
          y: 0,
          z: 0,
          kind: "elbow",
          label: "ELB-01",
          ports: [
            { index: 0, dx: -1, dy: 0, dz: 0 },
            { index: 1, dx: 0, dy: 0, dz: 1 },
          ],
        },
        {
          id: "N03",
          x: 4.5,
          y: 0,
          z: 3.25,
          kind: "free",
          label: "NOZ-V201",
          ports: [{ index: 0, dx: 0, dy: 0, dz: -1 }],
        },
      ],
      segments: [
        {
          id: "SEG-01",
          from: "N01",
          to: "N02",
          lineId: "line-100",
          dn: 150,
          length: 4.5,
          fittings: [{ id: "FIT-GV1", type: "gate_valve", positionRatio: 0.45, tag: "HV-101" }],
        },
        {
          id: "SEG-02",
          from: "N02",
          to: "N03",
          lineId: "line-100",
          dn: 150,
          length: 3.25,
          fittings: [],
        },
      ],
      dimensions: [
        {
          id: "DIM-01",
          type: "distance",
          a: { nodeId: "N01" },
          b: { nodeId: "N02" },
          label: "4500 mm",
          offset: { x: 0, y: -28 },
          unit: "mm",
          locked: true,
        },
      ],
      cad2dEntities: [
        {
          id: "CAD-RECT-01",
          type: "rectangle",
          layerId: "layer-civil",
          points: [
            { x: -1.2, y: -0.8 },
            { x: 1.2, y: -0.8 },
            { x: 1.2, y: 0.8 },
            { x: -1.2, y: 0.8 },
          ],
          stroke: "#F59E0B",
          locked: false,
        },
        {
          id: "CAD-TXT-01",
          type: "text",
          layerId: "layer-annot",
          points: [{ x: 2.25, y: 1.1 }],
          text: "MASSIF BETON M-01",
          fontSize: 14,
        },
      ],
      cad2dLayers: [
        { id: "layer-civil", name: "Génie Civil", visible: true, locked: false, color: "#F59E0B" },
        { id: "layer-annot", name: "Annotations", visible: true, locked: false, color: "#E2E8F0" },
      ],
    },
    workspace: {
      showGrid: true,
      showDimensions: true,
      showPipeLabels: true,
      showLabels: true,
      showWelds: true,
      isoSnapStep: 0.25,
      projectSetup: {
        titleBlockRevision: "REV-B",
        sheetFormat: "A3",
      },
      viewport: {
        zoom: 1.35,
        panX: 120.5,
        panY: -48.25,
      },
    },
  };
}

describe("MIG-05-FIX-01 — Test B : Identité canonique Supabase UUID et reprise isométrique non destructive", () => {
  it("T-ISO-01 : UUID Supabase canonique résolu depuis pdi.user.profile.v1 et aucun UID local-... généré", () => {
    const storage = new MemoryStorage();
    const profile = makeProfile(UUID_SUPER_ADMIN, "orthogonaleng@gmail.com", "Super Admin");

    syncVerifiedUserProfileCache(profile, { storage, dispatchEvent: false });

    expect(storage.getItem(CANONICAL_USER_PROFILE_STORAGE_KEY)).toBeTruthy();
    expect(isCanonicalSupabaseUuid(UUID_SUPER_ADMIN)).toBe(true);
    expect(readCanonicalSupabaseUuidFromCache({ storage })).toBe(UUID_SUPER_ADMIN);

    const resolvedUid = resolveCanonicalIsometricUserUid({ storage, sandboxMode: false });
    expect(resolvedUid).toBe(UUID_SUPER_ADMIN);
    expect(resolvedUid.startsWith("local-")).toBe(false);
    // Vérifie qu'aucun `pdi.localUid.v1` n'a été généré lorsqu'un UUID Supabase valide est disponible
    expect(storage.getItem(ISOMETRIC_LOCAL_UID_STORAGE_KEY)).toBeNull();

    const keys = buildIsometricAutosaveKeys(resolvedUid, "proj-hp-101");
    expect(keys.current).toBe(
      `isometrie.autosave.v474.user.${UUID_SUPER_ADMIN}.project.proj-hp-101.current`
    );
  });

  it("T-ISO-02 : Restauration après F5 — synchronisation pdi.user.profile.v1 et transition sans rechargement intempestif", () => {
    const storage = new MemoryStorage();
    const profile = makeProfile(UUID_USER_A, "engineer.a@orthogonal.dz", "Ingénieur A");

    // 1. Avant F5 : session déjà vérifiée et projet sauvegardé sous l'UUID canonique
    syncVerifiedUserProfileCache(profile, { storage, dispatchEvent: false });
    const keysA = buildIsometricAutosaveKeys(UUID_USER_A, "default");
    const savedSnapshot = buildRepresentativeCadSnapshot(UUID_USER_A, "Ligne F5 Persistée");
    storage.setItem(keysA.current, JSON.stringify(savedSnapshot));

    // 2. Simulation F5 : si le cache profil avait été vidé avant le retour de onSessionVerified(),
    //    la résolution initiale transitoire pouvait être `local-...`, puis `onSessionVerified` resynchronise `pdi.user.profile.v1`.
    const transitionFromLocalToUuid = resolveIsometricIdentityTransition(
      "local-transient01",
      UUID_USER_A
    );
    expect(transitionFromLocalToUuid).toEqual({
      action: "switch_in_place",
      requiresInMemoryReset: false,
    });

    // 3. Re-synchronisation par `onSessionVerified` après F5
    syncVerifiedUserProfileCache(profile, { storage, dispatchEvent: false });
    const uidAfterF5 = resolveCanonicalIsometricUserUid({ storage, sandboxMode: false });
    expect(uidAfterF5).toBe(UUID_USER_A);

    // 4. Même UID après revalidation -> noop (0 reload)
    expect(resolveIsometricIdentityTransition(UUID_USER_A, uidAfterF5)).toEqual({
      action: "noop",
      requiresInMemoryReset: false,
    });

    // 5. La sauvegarde existante sous UUID A est intacte et rechargée
    const loaded = JSON.parse(storage.getItem(keysA.current)!);
    expect(loaded.project.ownerUid).toBe(UUID_USER_A);
    expect(loaded.model.nodes).toHaveLength(3);
    expect(loaded.model.segments).toHaveLength(2);
  });

  it("T-ISO-03 : Reprise locale non destructive (local-... -> UUID), source conservée, idempotence après vérification et sécurité en cas d'erreur", () => {
    const storage = new MemoryStorage();
    const localUid = "local-abc123xyz";
    storage.setItem(ISOMETRIC_LOCAL_UID_STORAGE_KEY, localUid);

    const sourceKeys = buildIsometricAutosaveKeys(localUid, "default");
    const targetKeys = buildIsometricAutosaveKeys(UUID_USER_A, "default");
    const markerKey = buildIsometricMigrationMarkerKey(UUID_USER_A, "default");

    const sourceSnapshot = buildRepresentativeCadSnapshot(localUid, "Projet Local Avant MIG-05");
    const sourceRaw = JSON.stringify(sourceSnapshot);
    storage.setItem(sourceKeys.current, sourceRaw);

    // 1. Simulation d'une erreur d'écriture (ex: QuotaExceededError) -> source intacte, aucun marqueur écrit
    storage.failNextSetOnKey = targetKeys.current;
    const failedAttempt = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_USER_A,
      projectId: "default",
      storage,
      nowIso: () => "2026-11-26T08:00:00.000Z",
    });
    expect(failedAttempt.status).toBe("error_source_preserved");
    expect(failedAttempt.migrated).toBe(false);
    expect(failedAttempt.sourcePreserved).toBe(true);
    expect(storage.getItem(sourceKeys.current)).toBe(sourceRaw);
    expect(storage.getItem(ISOMETRIC_LOCAL_UID_STORAGE_KEY)).toBe(localUid);
    expect(storage.getItem(markerKey)).toBeNull();

    // 2. Reprise sûre réussie au passage suivant
    const successAttempt = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_USER_A,
      projectId: "default",
      storage,
      nowIso: () => "2026-11-26T08:05:00.000Z",
    });
    expect(successAttempt.status).toBe("migrated");
    expect(successAttempt.migrated).toBe(true);
    expect(successAttempt.sourcePreserved).toBe(true);

    // Cible écrite et vérifiée avec ownerUid mis à jour + métadonnées de migration
    const targetParsed = JSON.parse(storage.getItem(targetKeys.current)!);
    expect(targetParsed.project.ownerUid).toBe(UUID_USER_A);
    expect(targetParsed.project.migratedFromLocalUid).toBe(localUid);
    expect(targetParsed.project.migratedAt).toBe("2026-11-26T08:05:00.000Z");

    // Source `local-...` ET `pdi.localUid.v1` intégralement préservées (jamais supprimées)
    expect(storage.getItem(sourceKeys.current)).toBe(sourceRaw);
    expect(storage.getItem(ISOMETRIC_LOCAL_UID_STORAGE_KEY)).toBe(localUid);

    // Marqueur d'idempotence présent et cohérent
    const marker = JSON.parse(storage.getItem(markerKey)!);
    expect(marker.status).toBe("copied_source_preserved");
    expect(marker.fromLocalUid).toBe(localUid);
    expect(marker.targetUuid).toBe(UUID_USER_A);

    // 3. Si l'utilisateur supprime plus tard volontairement sa cible, le marqueur d'idempotence empêche une résurrection involontaire
    storage.removeItem(targetKeys.current);
    const idempotentSkip = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_USER_A,
      projectId: "default",
      storage,
    });
    expect(idempotentSkip.status).toBe("skipped_already_migrated");
    expect(storage.getItem(targetKeys.current)).toBeNull();
  });

  it("T-ISO-04 : Interdiction absolue d'écrasement d'une sauvegarde cible existante (+ rejet JSON invalide / ownerUid différent)", () => {
    const storage = new MemoryStorage();
    const localUid = "local-old999";
    storage.setItem(ISOMETRIC_LOCAL_UID_STORAGE_KEY, localUid);

    const sourceKeys = buildIsometricAutosaveKeys(localUid, "proj-42");
    const targetKeys = buildIsometricAutosaveKeys(UUID_USER_A, "proj-42");

    const sourceSnapshot = buildRepresentativeCadSnapshot(localUid, "Ancien Brouillon Local");
    const existingTargetSnapshot = buildRepresentativeCadSnapshot(UUID_USER_A, "Projet Officiel Cible");
    const existingTargetRaw = JSON.stringify(existingTargetSnapshot);

    storage.setItem(sourceKeys.current, JSON.stringify(sourceSnapshot));
    storage.setItem(targetKeys.current, existingTargetRaw);

    const res = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_USER_A,
      projectId: "proj-42",
      storage,
    });
    expect(res.status).toBe("skipped_target_exists");
    expect(res.migrated).toBe(false);
    // La sauvegarde cible existante est STRICTEMENT inchangée
    expect(storage.getItem(targetKeys.current)).toBe(existingTargetRaw);
    // La source locale est également préservée
    expect(storage.getItem(sourceKeys.current)).toBe(JSON.stringify(sourceSnapshot));

    // Cas supplémentaire 1 : ownerUid incohérent dans la source -> rejeté
    const wrongOwnerKeys = buildIsometricAutosaveKeys(localUid, "proj-wrong-owner");
    const wrongOwnerSnapshot = buildRepresentativeCadSnapshot(UUID_USER_B, "Appartient à B");
    storage.setItem(wrongOwnerKeys.current, JSON.stringify(wrongOwnerSnapshot));
    const mismatchRes = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_USER_A,
      projectId: "proj-wrong-owner",
      storage,
    });
    expect(mismatchRes.status).toBe("skipped_owner_mismatch");
    expect(
      storage.getItem(buildIsometricAutosaveKeys(UUID_USER_A, "proj-wrong-owner").current)
    ).toBeNull();

    // Cas supplémentaire 2 : JSON corrompu -> rejeté sans écrire ni altérer la source
    const corruptKeys = buildIsometricAutosaveKeys(localUid, "proj-corrupt");
    storage.setItem(corruptKeys.current, "{invalid-json::");
    const corruptRes = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_USER_A,
      projectId: "proj-corrupt",
      storage,
    });
    expect(corruptRes.status).toBe("skipped_invalid_source_json");
    expect(storage.getItem(corruptKeys.current)).toBe("{invalid-json::");
    expect(
      storage.getItem(buildIsometricAutosaveKeys(UUID_USER_A, "proj-corrupt").current)
    ).toBeNull();
  });

  it("T-ISO-05 : Isolation stricte entre utilisateurs A et B lors de la déconnexion et du changement de session", () => {
    const storage = new MemoryStorage();
    const sessionStore = new MemoryStorage();

    // 1. Session Utilisateur A
    const profileA = makeProfile(UUID_USER_A, "user.a@orthogonal.dz", "Utilisateur A");
    syncVerifiedUserProfileCache(profileA, { storage, dispatchEvent: false });
    expect(resolveCanonicalIsometricUserUid({ storage, sandboxMode: false })).toBe(UUID_USER_A);

    const keysA = buildIsometricAutosaveKeys(UUID_USER_A, "default");
    const snapshotA = buildRepresentativeCadSnapshot(UUID_USER_A, "Projet Confidentiel A");
    storage.setItem(keysA.current, JSON.stringify(snapshotA));

    // 2. Déconnexion de A : purge complète des caches d'identité (les données CAO de A restent isolées sous UUID A)
    purgeLocalAuthCaches({ preservePendingState: false, storage, sessionStore });
    expect(readVerifiedUserProfileFromCache({ storage })).toBeNull();
    expect(storage.getItem("pdi.user.profile.v1")).toBeNull();
    expect(storage.getItem("pdi.userProfile.v1")).toBeNull();

    // 3. Connexion Utilisateur B
    const profileB = makeProfile(UUID_USER_B, "user.b@orthogonal.dz", "Utilisateur B");
    syncVerifiedUserProfileCache(profileB, { storage, dispatchEvent: false });
    expect(resolveCanonicalIsometricUserUid({ storage, sandboxMode: false })).toBe(UUID_USER_B);

    // Transition A -> B impose un reset en mémoire (zéro fuite) sans rechargement brutal
    const transitionAB = resolveIsometricIdentityTransition(UUID_USER_A, UUID_USER_B);
    expect(transitionAB).toEqual({
      action: "switch_in_place",
      requiresInMemoryReset: true,
    });

    const keysB = buildIsometricAutosaveKeys(UUID_USER_B, "default");
    expect(keysB.current).not.toBe(keysA.current);
    expect(storage.getItem(keysB.current)).toBeNull();
    // La sauvegarde de A reste intacte et inaccessible depuis la clé de B
    expect(JSON.parse(storage.getItem(keysA.current)!).project.name).toBe("Projet Confidentiel A");
  });

  it("T-ISO-06 : Intégrité bit-à-bit de toutes les données CAO avant/après migration (nodes, segments, lines, dimensions, cad2dEntities, cad2dLayers, projectSetup, viewport)", () => {
    const storage = new MemoryStorage();
    const localUid = "local-cadintegrity01";
    storage.setItem(ISOMETRIC_LOCAL_UID_STORAGE_KEY, localUid);

    const sourceKeys = buildIsometricAutosaveKeys(localUid, "proj-cad-full");
    const targetKeys = buildIsometricAutosaveKeys(UUID_SUPER_ADMIN, "proj-cad-full");

    const originalSnapshot = buildRepresentativeCadSnapshot(localUid, "Unité Compression GNL-04");
    storage.setItem(sourceKeys.current, JSON.stringify(originalSnapshot));

    const result = migrateLocalIsometricAutosaveToCanonicalUuid({
      canonicalUuid: UUID_SUPER_ADMIN,
      projectId: "proj-cad-full",
      storage,
      nowIso: () => "2026-11-26T09:00:00.000Z",
    });

    expect(result.status).toBe("migrated");
    const migratedSnapshot = JSON.parse(storage.getItem(targetKeys.current)!);

    // Vérification stricte de chaque sous-structure CAO métier
    expect(migratedSnapshot.model.nodes).toEqual(originalSnapshot.model.nodes);
    expect(migratedSnapshot.model.segments).toEqual(originalSnapshot.model.segments);
    expect(migratedSnapshot.model.lines).toEqual(originalSnapshot.model.lines);
    expect(migratedSnapshot.model.dimensions).toEqual(originalSnapshot.model.dimensions);
    expect(migratedSnapshot.model.cad2dEntities).toEqual(originalSnapshot.model.cad2dEntities);
    expect(migratedSnapshot.model.cad2dLayers).toEqual(originalSnapshot.model.cad2dLayers);
    expect(migratedSnapshot.project.projectSetup).toEqual(originalSnapshot.project.projectSetup);
    expect(migratedSnapshot.workspace.projectSetup).toEqual(originalSnapshot.workspace.projectSetup);
    expect(migratedSnapshot.workspace.viewport).toEqual(originalSnapshot.workspace.viewport);
    expect(migratedSnapshot.workspace).toEqual(originalSnapshot.workspace);
    expect(migratedSnapshot.model).toEqual(originalSnapshot.model);

    // Seuls project.ownerUid et les métadonnées explicites de migration ont changé
    const { ownerUid: _origOwner, ...originalProjectRest } = originalSnapshot.project;
    const {
      ownerUid: migratedOwner,
      migratedFromLocalUid,
      migratedAt,
      ...migratedProjectRest
    } = migratedSnapshot.project;

    expect(migratedOwner).toBe(UUID_SUPER_ADMIN);
    expect(migratedFromLocalUid).toBe(localUid);
    expect(migratedAt).toBe("2026-11-26T09:00:00.000Z");
    expect(migratedProjectRest).toEqual(originalProjectRest);
  });
});
