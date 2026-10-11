/**
 * PDI NORMATIVE ENGINE & PROJECT / WORKSPACE UNIFICATION — ARCH-04 TEST SUITE
 * Reference: ARCH-04 (Project / Workspace / Data Unification)
 *
 * Test suite verifying:
 * - ProjectContext as root aggregate
 * - Document as engineering deliverable holder
 * - WorkspaceContext as UI/presentation context only (never business authority)
 * - IsoProjectFileV474 backward compatibility (schemaVersion "4.7.4")
 * - Universal Model integration without duplication
 * - Non-regression of ARCH-01, ARCH-02, ARCH-03, NORM-01..14
 */

import {
  createProjectContext,
  createDocument,
  createWorkspaceContext,
  createDefaultProjectBundle,
  isoProjectFileV474ToProjectBundle,
  projectBundleToIsoProjectFileV474,
  serializeProjectBundleToV474Json,
  deserializeProjectBundleFromV474Json,
  deriveUniversalEntitiesFromDocument,
  applyUniversalEntityToDocument,
  extractEditorGraphFromDocument,
  updateDocumentFromEditorGraph,
  adaptLegacyAdminProjectToProjectContext,
  toWorkspaceChannelState,
  validateProjectContext,
  validateDocument,
  validateWorkspaceContext,
  isValidStableId,
} from "../../model/pdiProjectAdapter";
import type {
  PdiProjectContext,
  PdiDocument,
  PdiWorkspaceContext,
} from "../../model/pdiProjectContext";
import type {
  IsoNode,
  IsoSegment,
  IsoProjectFileV474,
} from "../../isometric/types/isoGraphTypes";
import { runArch01IsometricNormativeBridgeTests } from "./arch01IsometricNormativeBridgeTests";
import { runArch02PmsAuthorityUnificationTests } from "./arch02PmsAuthorityUnificationTests";
import { runArch03UniversalModelTests } from "./arch03UniversalModelTests";
import type { Project as LegacyAdminProject } from "../../../components/project-management/types";

export interface Arch04TestResult {
  readonly success: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly results: readonly string[];
  readonly failures: readonly string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ARCH-04 ASSERTION FAILED] ${message}`);
  }
}

export function runArch04ProjectWorkspaceDataTests(): Arch04TestResult {
  const results: string[] = [];
  const failures: string[] = [];
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  function runTest(testName: string, fn: () => void): void {
    testsRun++;
    try {
      fn();
      testsPassed++;
      results.push(`[PASS] ${testName}`);
    } catch (err: unknown) {
      testsFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`[FAIL] ${testName} — ${msg}`);
      failures.push(`${testName}: ${msg}`);
    }
  }

  // =========================================================================
  // TEST 01: Project possède un identifiant stable
  // =========================================================================
  runTest("TEST 01 [ARCH-04]: Project possède un identifiant stable (projectId)", () => {
    const proj = createProjectContext({
      projectId: "PROJ_STABLE_001",
      projectName: "Projet Hassi Messaoud Phase 2",
      wilaya: "Ouargla",
    });

    assert(proj.projectId === "PROJ_STABLE_001", "projectId doit être conservé exactement");
    assert(typeof proj.projectId === "string" && proj.projectId.length > 0, "projectId valide");
    const val = validateProjectContext(proj);
    assert(val.valid === true, `Validation projet échouée: ${val.errors.join(", ")}`);
  });

  // =========================================================================
  // TEST 02: Document possède un identifiant stable
  // =========================================================================
  runTest("TEST 02 [ARCH-04]: Document possède un identifiant stable (documentId)", () => {
    const doc = createDocument({
      documentId: "DOC_ISO_101",
      projectId: "PROJ_STABLE_001",
      title: "Iso Collecteur Gaz 24\"",
    });

    assert(doc.documentId === "DOC_ISO_101", "documentId doit être conservé exactement");
    assert(doc.projectId === "PROJ_STABLE_001", "projectId doit être conservé");
    const val = validateDocument(doc);
    assert(val.valid === true, `Validation document échouée: ${val.errors.join(", ")}`);
  });

  // =========================================================================
  // TEST 03: Workspace référence un projectId
  // =========================================================================
  runTest("TEST 03 [ARCH-04]: Workspace référence un projectId et activeDocumentId", () => {
    const ws = createWorkspaceContext({
      workspaceId: "WS_MAIN_01",
      projectId: "PROJ_STABLE_001",
      activeDocumentId: "DOC_ISO_101",
      mode: "dual_screen",
      profile: "conception_3d",
    });

    assert(ws.workspaceId === "WS_MAIN_01", "workspaceId conservé");
    assert(ws.projectId === "PROJ_STABLE_001", "projectId référencé");
    assert(ws.activeDocumentId === "DOC_ISO_101", "activeDocumentId référencé");
    const val = validateWorkspaceContext(ws);
    assert(val.valid === true, `Validation workspace échouée: ${val.errors.join(", ")}`);
  });

  // =========================================================================
  // TEST 04: Workspace ne devient pas source de vérité métier
  // =========================================================================
  runTest("TEST 04 [ARCH-04]: Workspace ne devient pas source de vérité métier (séparation stricte présentation / métier)", () => {
    const bundle = createDefaultProjectBundle({
      projectId: "PROJ_SEPARATION",
      projectName: "Projet Test Séparation",
    });

    // Modification d'affichage ou de sélection dans le workspace
    const updatedWs: PdiWorkspaceContext = {
      ...bundle.workspace,
      mode: "dual_screen",
      screen2View: "3d",
      selection: {
        ...bundle.workspace.selection,
        selectedNodeId: "NODE_FAKE_UI_SELECTED",
        selectedType: "valve",
      },
      editorSettings: {
        ...bundle.workspace.editorSettings,
        viewport: { zoom: 2.5, panX: 100, panY: -50 },
      },
    };

    const doc = bundle.documents.get(bundle.project.activeDocumentId)!;
    // Le document n'a subi aucune modification et ne dépend pas de la sélection UI
    assert(doc.model.nodes.length === 0, "Le modèle document reste intact");
    assert(updatedWs.selection.selectedNodeId === "NODE_FAKE_UI_SELECTED", "La sélection UI reste dans le workspace");
    assert(updatedWs.editorSettings.viewport.zoom === 2.5, "Le zoom viewport reste dans le workspace");
  });

  // =========================================================================
  // TEST 05: Document appartient à un projet
  // =========================================================================
  runTest("TEST 05 [ARCH-04]: Document appartient à un projet (contrat de rattachement)", () => {
    let errorCaught = false;
    try {
      createDocument({
        documentId: "DOC_ORPHAN",
        projectId: "" as any, // ProjectId vide interdit
      });
    } catch {
      errorCaught = true;
    }
    assert(errorCaught === true, "Un document sans projectId valide doit être rejeté");

    const validDoc = createDocument({
      documentId: "DOC_VALID",
      projectId: "PROJ_PARENT",
    });
    assert(validDoc.projectId === "PROJ_PARENT", "Rattachement projectId vérifié");
  });

  // =========================================================================
  // TEST 06: IsoProjectFileV474 reste compatible (schemaVersion: "4.7.4")
  // =========================================================================
  runTest("TEST 06 [ARCH-04]: IsoProjectFileV474 reste 100% compatible (schemaVersion '4.7.4')", () => {
    const bundle = createDefaultProjectBundle({
      projectId: "PROJ_V474",
      projectName: "Projet Gaz 4.7.4",
    });

    const file = projectBundleToIsoProjectFileV474(bundle);
    assert(file.schemaVersion === "4.7.4", `schemaVersion attendue '4.7.4', reçu: ${file.schemaVersion}`);
    assert(file.project.id === "PROJ_V474", "ID de projet conservé");
    assert(file.project.name === "Projet Gaz 4.7.4", "Nom de projet conservé");
    assert(Array.isArray(file.model.nodes), "model.nodes est un tableau");
    assert(Array.isArray(file.model.segments), "model.segments est un tableau");
    assert(typeof file.workspace.viewport.zoom === "number", "workspace.viewport préservé");
  });

  // =========================================================================
  // TEST 07: Project -> Document fonctionne
  // =========================================================================
  runTest("TEST 07 [ARCH-04]: Project -> Document fonctionne (résolution du document actif)", () => {
    const bundle = createDefaultProjectBundle({
      projectId: "PROJ_LOOKUP",
      projectName: "Projet Lookup",
    });

    const activeDocRef = bundle.project.documents.find((d) => d.documentId === bundle.project.activeDocumentId);
    assert(activeDocRef !== undefined, "Référence du document actif trouvée dans project.documents");
    const activeDoc = bundle.documents.get(bundle.project.activeDocumentId);
    assert(activeDoc !== undefined, "Document actif trouvé dans bundle.documents");
    assert(activeDoc?.documentId === bundle.project.activeDocumentId, "ID du document actif cohérent");
  });

  // =========================================================================
  // TEST 08: Document -> Isometric Editor fonctionne
  // =========================================================================
  runTest("TEST 08 [ARCH-04]: Document -> Isometric Editor fonctionne (extraction et mise à jour du graphe)", () => {
    const node1: IsoNode = { id: "N1", name: "Node 1", x: 0, y: 0, z: 0, type: "normal", dn: 100 };
    const node2: IsoNode = { id: "N2", name: "Node 2", x: 10, y: 0, z: 0, type: "normal", dn: 100 };
    const seg1: IsoSegment = { id: "S1", fromNodeId: "N1", toNodeId: "N2", type: "straight", length: 10, dn: 100, pn: "Class 150", material: "A106", fittings: [] };

    const doc = createDocument({
      documentId: "DOC_EDITOR_TEST",
      projectId: "PROJ_EDITOR",
      model: {
        nodes: [node1, node2],
        segments: [seg1],
      },
    });

    const editorGraph = extractEditorGraphFromDocument(doc);
    assert(editorGraph.nodes.length === 2, "2 nœuds extraits pour l'éditeur");
    assert(editorGraph.segments.length === 1, "1 segment extrait pour l'éditeur");

    // L'éditeur met à jour un nœud
    editorGraph.nodes[0].x = 5;
    const updatedDoc = updateDocumentFromEditorGraph(doc, { nodes: editorGraph.nodes });
    assert(updatedDoc.model.nodes[0].x === 5, "Nœud mis à jour dans le nouveau document");
    assert(doc.model.nodes[0].x === 0, "Document initial non muté");
  });

  // =========================================================================
  // TEST 09: IsoNode/IsoSegment conservent leur identité
  // =========================================================================
  runTest("TEST 09 [ARCH-04]: IsoNode/IsoSegment conservent leur identité", () => {
    const node: IsoNode = { id: "N_ID_999", name: "Vanne", x: 1, y: 2, z: 3, type: "normal" };
    const seg: IsoSegment = { id: "S_ID_888", fromNodeId: "N_ID_999", toNodeId: "N2", type: "straight", length: 4, dn: 50, pn: "Class 300", material: "A105", fittings: [] };

    const doc = createDocument({
      documentId: "DOC_IDENTITY",
      projectId: "PROJ_ID",
      model: { nodes: [node], segments: [seg] },
    });

    const file = projectBundleToIsoProjectFileV474({
      project: createProjectContext({ projectId: "PROJ_ID", activeDocumentId: "DOC_IDENTITY" }),
      documents: new Map([[doc.documentId, doc]]),
      workspace: createWorkspaceContext({ projectId: "PROJ_ID", activeDocumentId: "DOC_IDENTITY" }),
    });

    assert(file.model.nodes[0].id === "N_ID_999", "Node ID conservé");
    assert(file.model.segments[0].id === "S_ID_888", "Segment ID conservé");
  });

  // =========================================================================
  // TEST 10: Universal Entity conserve son identité
  // =========================================================================
  runTest("TEST 10 [ARCH-04]: Universal Entity conserve son identité (deriveUniversalEntitiesFromDocument)", () => {
    const node: IsoNode = { id: "N_UE_TEST", name: "Vanne UE", x: 0, y: 0, z: 0, type: "normal", equipmentType: "vanne_passage_total" };
    const doc = createDocument({
      documentId: "DOC_UE",
      projectId: "PROJ_UE",
      model: { nodes: [node] },
    });

    const universalEntities = deriveUniversalEntitiesFromDocument(doc);
    assert(universalEntities.length === 1, "1 entité universelle extraite");
    assert(universalEntities[0].identity.id === "N_UE_TEST", "entityId universel identique au nodeId");
    assert(universalEntities[0].identity.projectId === "PROJ_UE", "projectId rattaché à l'entité universelle");
  });

  // =========================================================================
  // TEST 11: Project ne duplique pas l'identité Universal Entity
  // =========================================================================
  runTest("TEST 11 [ARCH-04]: Project ne duplique pas l'identité Universal Entity (unicité stricte)", () => {
    const node: IsoNode = { id: "NODE_1", name: "N1", x: 0, y: 0, z: 0, type: "normal" };
    const seg: IsoSegment = { id: "SEG_1", fromNodeId: "NODE_1", toNodeId: "NODE_2", type: "straight", length: 1, dn: 50, pn: "PN16", material: "P235", fittings: [] };

    const doc = createDocument({
      documentId: "DOC_UNIQUE",
      projectId: "PROJ_UNIQUE",
      model: { nodes: [node], segments: [seg] },
    });

    const universalEntities = deriveUniversalEntitiesFromDocument(doc);
    const ids = universalEntities.map((e) => e.identity.id);
    const uniqueIds = new Set(ids);
    assert(uniqueIds.size === ids.length, "Chaque entité universelle a un ID unique sans duplication");
  });

  // =========================================================================
  // TEST 12: Workspace ne crée pas d'entité métier
  // =========================================================================
  runTest("TEST 12 [ARCH-04]: Workspace ne crée pas d'entité métier", () => {
    const ws = createWorkspaceContext({
      projectId: "PROJ_12",
      activeDocumentId: "DOC_12",
      selection: {
        selectedNodeId: "NEW_SELECTION",
      },
    });

    const channelState = toWorkspaceChannelState(
      ws,
      createDocument({ documentId: "DOC_12", projectId: "PROJ_12" }),
      createProjectContext({ projectId: "PROJ_12" })
    );

    assert(channelState.modelSnapshot.nodes.length === 0, "Le snapshot broadcast ne fabrique pas de nœuds à partir de la sélection");
    assert(channelState.selection.selectedNodeId === "NEW_SELECTION", "Sélection conservée sans altérer le modèle");
  });

  // =========================================================================
  // TEST 13: Save/serialize conserve projectId
  // =========================================================================
  runTest("TEST 13 [ARCH-04]: Save/serialize conserve projectId", () => {
    const bundle = createDefaultProjectBundle({
      projectId: "PROJ_SERIALIZE_13",
      projectName: "Projet Sérialisation 13",
    });

    const json = serializeProjectBundleToV474Json(bundle);
    const parsed = JSON.parse(json);
    assert(parsed.project.id === "PROJ_SERIALIZE_13", `projectId conservé dans le JSON, reçu: ${parsed.project.id}`);
  });

  // =========================================================================
  // TEST 14: Load/deserialize conserve projectId
  // =========================================================================
  runTest("TEST 14 [ARCH-04]: Load/deserialize conserve projectId", () => {
    const jsonStr = JSON.stringify({
      schemaVersion: "4.7.4",
      project: { id: "PROJ_DESERIALIZE_14", name: "Projet 14", ownerUid: "USER_A" },
      model: { nodes: [], segments: [] },
      workspace: {},
    });

    const bundle = deserializeProjectBundleFromV474Json(jsonStr);
    assert(bundle.project.projectId === "PROJ_DESERIALIZE_14", "projectId désérialisé fidèlement");
    assert(bundle.project.projectName === "Projet 14", "projectName désérialisé fidèlement");
  });

  // =========================================================================
  // TEST 15: Save/load conserve documentId
  // =========================================================================
  runTest("TEST 15 [ARCH-04]: Save/load conserve documentId", () => {
    const bundle = createDefaultProjectBundle({
      projectId: "PROJ_DOC_15",
      activeDocumentId: "DOC_CUSTOM_15",
    });

    const json = serializeProjectBundleToV474Json(bundle);
    const loadedBundle = deserializeProjectBundleFromV474Json(json);
    assert(loadedBundle.project.activeDocumentId === "DOC_CUSTOM_15", `activeDocumentId conservé au cycle save/load, reçu: ${loadedBundle.project.activeDocumentId}`);
    assert(loadedBundle.documents.has("DOC_CUSTOM_15"), "Document accessible dans le bundle rechargé");
  });

  // =========================================================================
  // TEST 16: Aucune boucle de synchronisation (Idempotence)
  // =========================================================================
  runTest("TEST 16 [ARCH-04]: Aucune boucle de synchronisation (déterminisme et idempotence)", () => {
    const bundle1 = createDefaultProjectBundle({
      projectId: "PROJ_IDEMPOTENT",
      projectName: "Projet Idempotence",
    });

    const file1 = projectBundleToIsoProjectFileV474(bundle1);
    const bundle2 = isoProjectFileV474ToProjectBundle(file1);
    const file2 = projectBundleToIsoProjectFileV474(bundle2);

    assert(file1.project.id === file2.project.id, "projectId invariant");
    assert(file1.project.documentId === file2.project.documentId, "documentId invariant");
    assert(file1.project.workspaceId === file2.project.workspaceId, "workspaceId invariant");
    assert(file1.schemaVersion === file2.schemaVersion, "schemaVersion invariante");
  });

  // =========================================================================
  // TEST 17: Aucune mutation involontaire des sources
  // =========================================================================
  runTest("TEST 17 [ARCH-04]: Aucune mutation involontaire des sources", () => {
    const rawInputFile: IsoProjectFileV474 = Object.freeze({
      schemaVersion: "4.7.4",
      exportedAt: "2026-10-05T00:00:00.000Z",
      project: Object.freeze({
        id: "PROJ_FROZEN",
        ownerUid: "OWNER_FROZEN",
        name: "Frozen Project",
        wilaya: "Adrar",
        pressDesign: 50,
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
      }) as any,
      model: Object.freeze({
        lines: Object.freeze([]) as any,
        nodes: Object.freeze([{ id: "N_FROZEN", name: "NF", x: 0, y: 0, z: 0, type: "normal" }]) as any,
        segments: Object.freeze([]) as any,
      }) as any,
      workspace: Object.freeze({
        showGrid: true,
        showDimensions: true,
        showPipeLabels: true,
        showLabels: true,
        showWelds: true,
        isoSnapStep: 0.5,
        viewport: Object.freeze({ zoom: 1, panX: 0, panY: 0 }) as any,
      }) as any,
    });

    const snapBefore = JSON.stringify(rawInputFile);
    const bundle = isoProjectFileV474ToProjectBundle(rawInputFile);
    const snapAfter = JSON.stringify(rawInputFile);

    assert(snapBefore === snapAfter, "L'objet source IsoProjectFileV474 n'a subi aucune mutation");
    assert(bundle.project.projectId === "PROJ_FROZEN", "Bundle projet généré correctement");
  });

  // =========================================================================
  // TEST 18: Ancien IsoProjectFileV474 accepté et migré fidèlement
  // =========================================================================
  runTest("TEST 18 [ARCH-04]: Ancien IsoProjectFileV474 / structure minimale acceptée et migrée", () => {
    // Structure legacy sans project.documentId ou workspace explicite
    const legacyMinimal = {
      model: {
        nodes: [{ id: "N_LEGACY", name: "Ancien Noeud", x: 10, y: 20, z: 30, type: "normal" }],
        segments: [{ id: "S_LEGACY", fromNodeId: "N_LEGACY", toNodeId: "N_OTHER", type: "straight", length: 5, dn: 80, pn: "PN16", material: "Acier", fittings: [] }],
      },
    };

    const bundle = isoProjectFileV474ToProjectBundle(legacyMinimal, { fallbackOwnerUid: "MIGRATED_USER" });
    assert(isValidStableId(bundle.project.projectId), "projectId généré pour fichier minimal");
    assert(isValidStableId(bundle.project.activeDocumentId), "activeDocumentId généré");
    assert(bundle.documents.size === 1, "Document créé avec le modèle minimal");
    assert(bundle.documents.get(bundle.project.activeDocumentId)!.model.nodes[0].id === "N_LEGACY", "Nœud legacy préservé");
  });

  // =========================================================================
  // TEST 19: Aucune donnée normative inventée
  // =========================================================================
  runTest("TEST 19 [ARCH-04]: Aucune donnée normative inventée (maintien des règles ARCH-03)", () => {
    const node: IsoNode = {
      id: "NODE_PURE_GEO",
      name: "Point géométrique pur",
      x: 0,
      y: 0,
      z: 0,
      type: "normal",
      dn: 100,
    };
    const doc = createDocument({
      documentId: "DOC_PURE",
      projectId: "PROJ_PURE",
      model: { nodes: [node] },
    });

    const ue = deriveUniversalEntitiesFromDocument(doc)[0];
    assert(ue.pn.rating === undefined, "pn.rating doit être undefined (pas de Class 150 inventé)");
    assert(ue.material.grade === undefined, "material.grade doit être undefined");
    assert(ue.spec.pmsCode === undefined, "pmsCode doit être undefined");
    assert(ue.dn.inch === undefined, "inch doit être undefined (ARCH-03-FIX-02 respecté)");
    assert(ue.dn.outerDiameterMm === undefined, "outerDiameterMm doit être undefined");
  });

  // =========================================================================
  // TEST 20: Aucune promotion normative
  // =========================================================================
  runTest("TEST 20 [ARCH-04]: Aucune promotion normative (ProjectContext ne s'auto-déclare jamais conforme)", () => {
    const proj = createProjectContext({
      projectId: "PROJ_NORM_SAFETY",
      projectName: "Projet Sans Auto-Certification",
    });

    assert((proj as any).status === undefined, "ProjectContext ne possède pas de champ 'status' auto-certifié");
    assert((proj as any).isCompliant === undefined, "ProjectContext ne possède pas de champ 'isCompliant'");
    assert((proj as any).qualificationStatus === undefined, "ProjectContext ne s'auto-qualifie pas");
  });

  // =========================================================================
  // TEST 21: Non-régression complète ARCH-01
  // =========================================================================
  runTest("TEST 21 [ARCH-04]: Non-régression complète de la suite ARCH-01", () => {
    const res = runArch01IsometricNormativeBridgeTests();
    assert(res.success === true, `Suite ARCH-01 échouée (${res.testsFailed} échecs)`);
    assert(res.testsRun >= 15, `Suite ARCH-01 doit exécuter au moins 15 tests (exécuté ${res.testsRun})`);
  });

  // =========================================================================
  // TEST 22: Non-régression complète ARCH-02
  // =========================================================================
  runTest("TEST 22 [ARCH-04]: Non-régression complète de la suite ARCH-02", () => {
    const res = runArch02PmsAuthorityUnificationTests();
    assert(res.success === true, `Suite ARCH-02 échouée (${res.testsFailed} échecs)`);
    assert(res.testsRun >= 20, `Suite ARCH-02 doit exécuter au moins 20 tests (exécuté ${res.testsRun})`);
  });

  // =========================================================================
  // TEST 23: Non-régression complète ARCH-03
  // =========================================================================
  runTest("TEST 23 [ARCH-04]: Non-régression complète de la suite ARCH-03", () => {
    const res = runArch03UniversalModelTests();
    assert(res.success === true, `Suite ARCH-03 échouée (${res.testsFailed} échecs)`);
    assert(res.testsRun >= 34, `Suite ARCH-03 doit exécuter au moins 34 tests (exécuté ${res.testsRun})`);
  });

  // =========================================================================
  // TEST 24: Adapter Option B pour Project Management legacy
  // =========================================================================
  runTest("TEST 24 [ARCH-04]: Adapter Option B pour module de gestion administrative legacy", () => {
    const legacyAdmin: LegacyAdminProject = {
      id: "LEGACY_ADMIN_001",
      name: "Gazoduc 28 pouces Hassi R'Mel - Arzew",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      chefDeProjetUid: "USER_CHEF_01",
      identity: {
        region: "Ouest",
        pole: "Arzew",
        wilaya: "Oran",
        district: "Zone Industrielle",
        phase: "Travaux",
        cadreInscription: "Programme National",
        planificationComment: "En cours",
        structureChargee: "Direction Projets",
        caracteristiques: {
          diametre: "28\"",
          longueur: "120 km",
          pression: "70",
          typeTuyau: "API 5L X70",
        },
      },
      planning: {
        etudeStart: "2025-01-01",
        etudeEnd: "2025-06-01",
        travauxStart: "2025-07-01",
        travauxEnd: "2026-12-31",
        essaisStart: "2026-11-01",
        essaisEnd: "2026-12-15",
        gazStart: "2026-12-20",
        gazEnd: "2026-12-31",
      },
      etudeAutorisation: {
        statutEtude: "Approuvée",
        datePermisConstruire: "2025-05-01",
        statutPermisConstruire: "Reçu",
        statutArreteServitude: "Signé & Publié",
        arreteServitudeRef: "AS-2025-88",
        expertiseFonciere: {
          gefDesignated: true,
          gefIdentity: "Cabinet Topo",
          acquisitionDemandEstablished: true,
          acquisitionComment: "Finalisé",
        },
      },
      travauxPlanification: {
        avancementPhysique: 65,
        essaisReglementaires: {
          epreuveResistance: "Non faite",
          epreuveEtancheite: "Non faite",
          organismeControleur: "VERITAL",
        },
        controleQualiteChecklist: {
          abaqueSoudageValide: true,
          radiographieCND: true,
          enrobageVerifie: true,
          litPoseSableux: true,
          protectionCathodique: true,
        },
      },
      miseEnGazArchive: {
        statutMiseEnGaz: "Non planifiée",
        dateEffectiveMiseEnGaz: "",
        documentsArchives: [],
      },
    };

    const projCtx = adaptLegacyAdminProjectToProjectContext(legacyAdmin);
    assert(projCtx.projectId === "LEGACY_ADMIN_001", "ID de projet administratif mappé");
    assert(projCtx.projectName === "Gazoduc 28 pouces Hassi R'Mel - Arzew", "Nom mappé");
    assert(projCtx.metadata.wilaya === "Oran", "Wilaya mappée");
    assert(projCtx.metadata.pressDesign === 70, "Pression de calcul 70 bar mappée");
    assert(projCtx.metadata.legacyAdminProjectId === "LEGACY_ADMIN_001", "Référence admin conservée");
  });

  // =========================================================================
  // TEST 25 [ARCH-04-FIX-01]: createProjectContext sans pressDesign -> undefined
  // =========================================================================
  runTest("TEST 25 [ARCH-04-FIX-01]: createProjectContext sans pressDesign produit undefined (pas de 40 bar inventé)", () => {
    const proj1 = createProjectContext({
      projectName: "Projet Sans Pression",
      wilaya: "Adrar",
    });
    assert(proj1.metadata.pressDesign === undefined, "pressDesign absent doit être undefined");

    const proj2 = createProjectContext({
      projectName: "Projet Null Pression",
      pressDesign: undefined,
    });
    assert(proj2.metadata.pressDesign === undefined, "pressDesign: undefined doit rester undefined");
  });

  // =========================================================================
  // TEST 26 [ARCH-04-FIX-01]: createProjectContext avec pressDesign explicite
  // =========================================================================
  runTest("TEST 26 [ARCH-04-FIX-01]: createProjectContext avec pressDesign explicite conserve la valeur exacte", () => {
    const proj = createProjectContext({
      projectName: "Gazoduc Haute Pression",
      pressDesign: 64,
    });
    assert(proj.metadata.pressDesign === 64, "pressDesign de 64 bar doit être conservé exactement");

    const projZero = createProjectContext({
      projectName: "Ligne Gravitaire",
      pressDesign: 0,
    });
    assert(projZero.metadata.pressDesign === 0, "pressDesign de 0 bar doit être conservé");
  });

  // =========================================================================
  // TEST 27 [ARCH-04-FIX-01]: isoProjectFileV474ToProjectBundle sans pressDesign -> undefined
  // =========================================================================
  runTest("TEST 27 [ARCH-04-FIX-01]: isoProjectFileV474ToProjectBundle sans pressDesign produit metadata.pressDesign === undefined", () => {
    const rawSnapshot = {
      schemaVersion: "4.7.4",
      project: {
        id: "PROJ_RAW_NO_PRESS",
        name: "Projet Importé Brut",
        wilaya: "Ghardaïa",
        // pas de pressDesign
      },
      model: { nodes: [], segments: [] },
      workspace: {},
    };

    const bundle = isoProjectFileV474ToProjectBundle(rawSnapshot);
    assert(bundle.project.metadata.pressDesign === undefined, "pressDesign absent dans snapshot doit donner undefined");
  });

  // =========================================================================
  // TEST 28 [ARCH-04-FIX-01]: isoProjectFileV474ToProjectBundle avec pressDesign explicite
  // =========================================================================
  runTest("TEST 28 [ARCH-04-FIX-01]: isoProjectFileV474ToProjectBundle avec pressDesign explicite le conserve fidèlement", () => {
    const rawSnapshot = {
      schemaVersion: "4.7.4",
      project: {
        id: "PROJ_RAW_80",
        name: "Projet Importé 80 bar",
        wilaya: "In Salah",
        pressDesign: 80,
      },
      model: { nodes: [], segments: [] },
      workspace: {},
    };

    const bundle = isoProjectFileV474ToProjectBundle(rawSnapshot);
    assert(bundle.project.metadata.pressDesign === 80, "pressDesign de 80 bar doit être fidèlement conservé");
  });

  // =========================================================================
  // TEST 29 [ARCH-04-FIX-01]: projectBundleToIsoProjectFileV474 sans pressDesign
  // =========================================================================
  runTest("TEST 29 [ARCH-04-FIX-01]: projectBundleToIsoProjectFileV474 sans pressDesign produit pressDesign === undefined", () => {
    const bundle = createDefaultProjectBundle({
      projectId: "PROJ_EXP_NOPRESS",
      projectName: "Export Sans Pression",
    });

    const file = projectBundleToIsoProjectFileV474(bundle);
    assert(file.project.pressDesign === undefined, "file.project.pressDesign doit être undefined");
  });

  // =========================================================================
  // TEST 30 [ARCH-04-FIX-01]: adaptLegacyAdminProjectToProjectContext sans pression ou invalide
  // =========================================================================
  runTest("TEST 30 [ARCH-04-FIX-01]: adaptLegacyAdminProjectToProjectContext ne fabrique pas de pression par défaut", () => {
    const legacyNoPress = {
      id: "LEGACY_NO_PRESS",
      name: "Projet Administratif Sans Pression",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      chefDeProjetUid: "USER_CHEF_02",
      identity: {
        region: "Centre",
        pole: "Alger",
        wilaya: "Alger",
        district: "Port",
        phase: "Étude" as const,
        cadreInscription: "National",
        planificationComment: "",
        structureChargee: "DPE",
        caracteristiques: {
          diametre: "16\"",
          longueur: "10 km",
          pression: "",
          typeTuyau: "API 5L X52",
        },
      },
    } as unknown as LegacyAdminProject;

    const projCtx1 = adaptLegacyAdminProjectToProjectContext(legacyNoPress);
    assert(projCtx1.metadata.pressDesign === undefined, "pressDesign doit être undefined si absent");

    const legacyInvalidPress: LegacyAdminProject = {
      ...legacyNoPress,
      id: "LEGACY_INVALID_PRESS",
      identity: {
        ...legacyNoPress.identity!,
        caracteristiques: {
          ...legacyNoPress.identity?.caracteristiques!,
          pression: "Non Spécifiée / Inconnue",
        },
      },
    };

    const projCtx2 = adaptLegacyAdminProjectToProjectContext(legacyInvalidPress);
    assert(projCtx2.metadata.pressDesign === undefined, "pressDesign doit être undefined si non numérique");
  });

  return Object.freeze({
    success: testsFailed === 0 && testsRun >= 30,
    testsRun,
    testsPassed,
    testsFailed,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
