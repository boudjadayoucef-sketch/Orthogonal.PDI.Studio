/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : GESTIONNAIRE DE SCÈNE 3D, ORBITE & RENDU HAUTE FIDÉLITÉ
 * Caméra anti-clipping (near 0.01, logarithmicDepthBuffer), orbite fluide avec focus double-clic,
 * pipeline d'éclairage industriel multi-sources et détection intelligente d'équipements.
 * Version : 021C-ULTRA (07 Septembre 2026)
 */

import * as THREE from "three";
import { createPdi3dMaterialPalette, type MaterialPalette } from "./pdi3dMaterials";
import { Pdi3dGeometryFactory, getPipeStandardDimensions } from "./pdi3dGeometryFactory";
import type {
  Viewer3dOptions,
  Viewer3dDataPayload,
  Selected3dEntity,
  CameraViewPreset,
  CameraProjectionType,
} from "./types3d";

export class Pdi3dSceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraPerspective: THREE.PerspectiveCamera;
  private cameraOrthographic: THREE.OrthographicCamera;
  private activeCamera: THREE.Camera;
  private materials: MaterialPalette;
  private factory: Pdi3dGeometryFactory;

  // Modèle et géométrie
  private modelRoot: THREE.Group;
  private groundGroup: THREE.Group = new THREE.Group();
  private worldOriginGroup: THREE.Group = new THREE.Group();
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private shadowPlane: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private mousePos: THREE.Vector2;

  // Contrôles d'orbite et moteur cinématique fluide
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private spherical: THREE.Spherical = new THREE.Spherical(15, Math.PI / 3, Math.PI / 4);
  private isDragging: boolean = false;
  private isPanning: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private animationFrameId: number | null = null;
  private autoRotateSpeed: number = 0.005;

  // Moteur cinématique de navigation continue (Amortissement / Inertie ultra-fluide)
  private panVelocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  private orbitVelocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  private zoomVelocity: number = 0;
  public keysDown: Set<string> = new Set();
  private isFirstBuild: boolean = true;

  // Cible d'amortissement cinématique
  private currentSpherical: THREE.Spherical = new THREE.Spherical(15, Math.PI / 3, Math.PI / 4);
  private currentTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // État des options
  private currentOptions: Viewer3dOptions;
  private currentData: Viewer3dDataPayload | null = null;
  private onEntitySelected?: (entity: Selected3dEntity | null) => void;
  private onEntityHover?: (entity: Selected3dEntity | null) => void;

  constructor(
    container: HTMLElement,
    options: Viewer3dOptions,
    onEntitySelected?: (entity: Selected3dEntity | null) => void,
    onEntityHover?: (entity: Selected3dEntity | null) => void
  ) {
    this.container = container;
    this.currentOptions = { ...options };
    this.onEntitySelected = onEntitySelected;
    this.onEntityHover = onEntityHover;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Moteur de Rendu WebGL2 Haute Performance avec Logarithmic Depth Buffer (anti-clipping total)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.replaceChildren(this.renderer.domElement);

    // 2. Scène
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f18); // Fond sombre technique PD&I

    // 3. Caméras optimisées anti-clipping haute résolution (Near: 0.005m = 5mm pour inspection ultra-rapprochée des soudures, cadrans et brides sans perte de détail)
    const aspect = width / height;
    this.cameraPerspective = new THREE.PerspectiveCamera(45, aspect, 0.005, 3500);
    const orthoFrustum = 8;
    this.cameraOrthographic = new THREE.OrthographicCamera(
      (-orthoFrustum * aspect) / 2,
      (orthoFrustum * aspect) / 2,
      orthoFrustum / 2,
      -orthoFrustum / 2,
      0.005,
      3500
    );

    this.activeCamera =
      options.projection === "orthographic" ? this.cameraOrthographic : this.cameraPerspective;

    // 4. Matériaux et Usine géométrique
    this.materials = createPdi3dMaterialPalette();
    this.factory = new Pdi3dGeometryFactory(this.materials);
    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    this.raycaster = new THREE.Raycaster();
    this.mousePos = new THREE.Vector2();

    this.setupLighting();
    this.setupEnvironment();
    this.bindEvents();
    this.updateCameraPosition();
    this.startRenderLoop();
  }

  private createTextSprite(text: string, bgColor: string, textColor: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = bgColor;
      if (ctx.roundRect) ctx.roundRect(6, 6, 308, 60, 12);
      else ctx.fillRect(6, 6, 308, 60);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = textColor;
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = "bold 26px 'Space Grotesk', monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 160, 36);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.9, 0.45, 1);
    return sprite;
  }

  private setupLighting(): void {
    // 1. Lumière d'ambiance hémisphérique douce
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 2. Lumière directionnelle principale (Key Light) avec ombres douces
    const mainDirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainDirLight.position.set(25, 35, 25);
    mainDirLight.castShadow = true;
    mainDirLight.shadow.mapSize.width = 2048;
    mainDirLight.shadow.mapSize.height = 2048;
    mainDirLight.shadow.camera.near = 0.1;
    mainDirLight.shadow.camera.far = 200;
    const d = 30;
    mainDirLight.shadow.camera.left = -d;
    mainDirLight.shadow.camera.right = d;
    mainDirLight.shadow.camera.top = d;
    mainDirLight.shadow.camera.bottom = -d;
    mainDirLight.shadow.bias = -0.0003;
    mainDirLight.shadow.radius = 2.5;
    this.scene.add(mainDirLight);

    // 3. Lumière de débouchage bleutée (Fill Light)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
    fillLight.position.set(-25, 15, -20);
    this.scene.add(fillLight);

    // 4. Lumière de contre-jour (Rim Light) pour faire ressortir les contours métalliques
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(0, -10, 30);
    this.scene.add(rimLight);
  }

  private setupEnvironment(): void {
    // 1. Grille infinie calquée sur le repère isométrique 2D (Système métrique réel, Z=0)
    this.groundGroup = new THREE.Group();
    this.scene.add(this.groundGroup);

    if (this.currentOptions.showGroundGrid) {
      // Grille fine de précision (100m x 100m avec pas de 1m)
      const fineGrid = new THREE.GridHelper(100, 100, 0x0284c7, 0x1e293b);
      fineGrid.position.y = 0;
      this.groundGroup.add(fineGrid);

      // Grille majeure d'atelier (200m x 200m avec trame tous les 5m)
      const majorGrid = new THREE.GridHelper(200, 40, 0x38bdf8, 0x0f172a);
      majorGrid.position.y = -0.004;
      this.groundGroup.add(majorGrid);
    }

    // 2. Repère d'Origine Absolu (0, 0, 0) et Axes Cartésiens Industriels
    this.worldOriginGroup = new THREE.Group();
    this.scene.add(this.worldOriginGroup);

    if (this.currentOptions.showCompassAxes) {
      // Disque au sol cible d'origine (0, 0, 0)
      const originDiscGeom = new THREE.RingGeometry(0.08, 0.45, 32);
      const originDiscMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const originDisc = new THREE.Mesh(originDiscGeom, originDiscMat);
      originDisc.rotation.x = -Math.PI / 2;
      originDisc.position.y = 0.002;
      this.worldOriginGroup.add(originDisc);

      // Flèche Axe Est (+X) - Rouge / Ambre
      const dirX = new THREE.Vector3(1, 0, 0);
      const arrowX = new THREE.ArrowHelper(dirX, new THREE.Vector3(0, 0.01, 0), 3.5, 0xef4444, 0.6, 0.25);
      this.worldOriginGroup.add(arrowX);
      const labelX = this.createTextSprite("EST (+X)", "rgba(15, 23, 42, 0.85)", "#ef4444");
      labelX.position.set(4.4, 0.4, 0);
      this.worldOriginGroup.add(labelX);

      // Flèche Axe Nord (+Y CAD / +Z Three.js) - Vert Émeraude
      const dirZ = new THREE.Vector3(0, 0, 1);
      const arrowZ = new THREE.ArrowHelper(dirZ, new THREE.Vector3(0, 0.01, 0), 3.5, 0x10b981, 0.6, 0.25);
      this.worldOriginGroup.add(arrowZ);
      const labelZ = this.createTextSprite("NORD (+Y)", "rgba(15, 23, 42, 0.85)", "#10b981");
      labelZ.position.set(0, 0.4, 4.4);
      this.worldOriginGroup.add(labelZ);

      // Flèche Axe Élévation (+Z CAD / +Y Three.js) - Bleu Cyan Vertical
      const dirY = new THREE.Vector3(0, 1, 0);
      const arrowY = new THREE.ArrowHelper(dirY, new THREE.Vector3(0, 0, 0), 3.5, 0x06b6d4, 0.6, 0.25);
      this.worldOriginGroup.add(arrowY);
      const labelY = this.createTextSprite("ÉLÉVATION (+Z)", "rgba(15, 23, 42, 0.85)", "#06b6d4");
      labelY.position.set(0, 4.3, 0);
      this.worldOriginGroup.add(labelY);
    }

    // 3. Plan d'ombre douce et récepteur sol (200m x 200m)
    const shadowPlaneGeom = new THREE.PlaneGeometry(200, 200);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    this.shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = -0.01;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);
  }

  /**
   * Construit la tuyauterie solide et les équipements à partir des données
   */
  public buildModel(data: Viewer3dDataPayload, options?: Partial<Viewer3dOptions>): void {
    this.currentData = data;
    if (options) this.currentOptions = { ...this.currentOptions, ...options };

    // Vider le modèle existant
    while (this.modelRoot.children.length > 0) {
      const obj = this.modelRoot.children[0];
      this.modelRoot.remove(obj);
    }

    const { nodes, segments, welds, spools, supports } = data;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const segMap = new Map(segments.map((s) => [s.id, s]));

    // Repère CAD Tuyauterie -> Repère Three.js : X = Est, Y = Élévation (Haut), Z = Nord
    const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, y);

    // 1. Construction des tubes extrudés (Segments) & Raccords en ligne (Fittings)
    for (const seg of segments) {
      const fromNode = nodeMap.get(seg.fromNodeId);
      const toNode = nodeMap.get(seg.toNodeId);
      if (!fromNode || !toNode) continue;

      const attachedSpool = spools.find((sp) => sp.segmentIds.includes(seg.id));
      const spoolId = attachedSpool?.id;
      const spoolColor = attachedSpool?.color;

      if (
        this.currentOptions.selectedSpoolId &&
        this.currentOptions.selectedSpoolId !== "all" &&
        spoolId !== this.currentOptions.selectedSpoolId
      ) {
        continue;
      }

      let mat: THREE.Material;
      if (this.currentOptions.selectedEntityId === seg.id) {
        mat = this.materials.highlightSelected;
      } else if (this.currentOptions.shadingMode === "color_by_spool") {
        mat = this.materials.getSpoolMaterial(spoolId, spoolColor, "color_by_spool");
      } else if (this.currentOptions.shadingMode === "color_by_service") {
        mat = this.materials.getServiceMaterial(seg.service || seg.lineFunction, "color_by_service");
      } else if (this.currentOptions.shadingMode === "wireframe") {
        mat = this.materials.wireframeMat;
      } else {
        mat =
          seg.material?.includes("316") || seg.material?.includes("Inox")
            ? this.materials.stainlessSteel
            : this.materials.carbonSteel;
      }

      let p1 = toThree(fromNode.x, fromNode.y, fromNode.z);
      let p2 = toThree(toNode.x, toNode.y, toNode.z);
      const segVec = new THREE.Vector3().subVectors(p2, p1);
      const segLen = segVec.length();
      const normDir = segLen > 0.0001 ? segVec.clone().normalize() : new THREE.Vector3(1, 0, 0);

      // Calcul des dégagements aux extrémités pour que les coudes, tés et brides soient nets et visibles
      const fromEqType = (fromNode.equipmentType || "").toLowerCase();
      const toEqType = (toNode.equipmentType || "").toLowerCase();

      const fromIsElbow = fromEqType.includes("coude") || fromEqType.includes("elbow");
      const toIsElbow = toEqType.includes("coude") || toEqType.includes("elbow");

      const fromIsTee = fromNode.type === "tee" || fromEqType.includes("te");
      const toIsTee = toNode.type === "tee" || toEqType.includes("te");

      const dimsFrom = getPipeStandardDimensions(fromNode.dn || seg.dn);
      const dimsTo = getPipeStandardDimensions(toNode.dn || seg.dn);

      const bendRFrom = Math.max(0.04, (dimsFrom.odM / 2) * 3.0);
      const bendRTo = Math.max(0.04, (dimsTo.odM / 2) * 3.0);
      const teeOffsetFrom = Math.max(0.06, (dimsFrom.odM / 2) * 2.0);
      const teeOffsetTo = Math.max(0.06, (dimsTo.odM / 2) * 2.0);

      let trimFrom = 0;
      if (fromIsElbow) trimFrom = bendRFrom;
      else if (fromIsTee) trimFrom = teeOffsetFrom;

      let trimTo = 0;
      if (toIsElbow) trimTo = bendRTo;
      else if (toIsTee) trimTo = teeOffsetTo;

      if (trimFrom + trimTo < segLen * 0.85) {
        if (trimFrom > 0) p1 = p1.clone().addScaledVector(normDir, trimFrom);
        if (trimTo > 0) p2 = p2.clone().addScaledVector(normDir, -trimTo);
      }

      // Tube cylindrique solide extrudé
      const pipeMesh = this.factory.createPipeCylinder(p1, p2, seg.dn, mat, {
        id: seg.id,
        tag: seg.tag || `SEG-${seg.id.slice(0, 6)}`,
        dn: seg.dn,
        material: seg.material,
        schedule: seg.spec || "40",
        spoolId,
        spoolColor,
        service: seg.service || "Gaz / Procédé",
        pressureClass: seg.pressureClass || seg.pn || "Class 300",
        lengthM: seg.length || segLen,
      });

      this.modelRoot.add(pipeMesh);

      // Raccords en ligne (Inline Fittings : brides, vannes, clapets)
      if (seg.fittings && Array.isArray(seg.fittings)) {
        for (const fit of seg.fittings) {
          let alpha = 0.5;
          if (typeof fit.localPosition === "number" && fit.localPosition >= 0 && fit.localPosition <= 1) {
            alpha = fit.localPosition;
          } else if (typeof fit.cumulativePosition === "number" && segLen > 0.01) {
            alpha = Math.max(0.05, Math.min(0.95, fit.cumulativePosition / segLen));
          }
          const fitPos = new THREE.Vector3().lerpVectors(p1, p2, alpha);
          const fitDn = fit.dn || seg.dn;

          if (fit.type === "clapet" || fit.type === "clapet_bille" || fit.type.includes("clapet")) {
            const clapet = this.factory.createCheckValveMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Clapet anti-retour DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(clapet);
          } else if (fit.type === "soupape" || fit.type.includes("soupape")) {
            const psv = this.factory.createSafetyValveMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Soupape de sécurité DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(psv);
          } else if (fit.type === "vanne_boisseau") {
            const bv = this.factory.createBallValveMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Vanne boisseau DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(bv);
          } else if (fit.type === "vanne_papillon") {
            const bfv = this.factory.createButterflyValveMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Vanne papillon DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(bfv);
          } else if (fit.type === "robinet_pointeau") {
            const nv = this.factory.createNeedleValveMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Robinet pointeau DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(nv);
          } else if (fit.type.includes("vanne") || fit.type.includes("robinet")) {
            const valve = this.factory.createValveMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Vanne DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(valve);
          } else if (fit.type === "bride_pleine") {
            const blind = this.factory.createBlindFlangeMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Bride pleine DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(blind);
          } else if (fit.type === "jmi") {
            const jmi = this.factory.createInsulatingJointMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Joint Isolant JMI DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(jmi);
          } else if (fit.type.includes("bride") || fit.type === "joint") {
            const flange = this.factory.createFlangeMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Bride DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(flange);
          } else if (fit.type.includes("filtre") || fit.type.includes("strainer")) {
            const filter = this.factory.createFilterMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Filtre DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(filter);
          } else if (fit.type === "diaphragme" || fit.type.includes("debit")) {
            const orifice = this.factory.createFlowmeterOrificeMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Diaphragme Débitmètre DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(orifice);
          } else if ((fit.type as string) === "manometre" || (fit.type as string) === "prise_pression") {
            const pi = this.factory.createPressureGaugeMesh(fitPos, new THREE.Vector3(0, 1, 0), fitDn, {
              id: fit.id,
              label: fit.label || `Manomètre PI DN${fitDn}`,
              spoolId,
            });
            this.modelRoot.add(pi);
          } else if ((fit.type as string) === "thermometre") {
            const ti = this.factory.createThermometerMesh(fitPos, new THREE.Vector3(0, 1, 0), fitDn, {
              id: fit.id,
              label: fit.label || `Thermomètre TI DN${fitDn}`,
              spoolId,
            });
            this.modelRoot.add(ti);
          } else if ((fit.type as string) === "purge" || (fit.type as string) === "event") {
            const vent = this.factory.createVentDrainMesh(fitPos, new THREE.Vector3(0, 1, 0), fitDn, mat, {
              id: fit.id,
              label: fit.label || (fit.type === "purge" ? `Purge DN${fitDn}` : `Évent DN${fitDn}`),
              spoolId,
            });
            this.modelRoot.add(vent);
          } else if ((fit.type as string) === "massif_beton_gc") {
            const pad = this.factory.createCivilPadMesh(new THREE.Vector3(fitPos.x, 0, fitPos.z), 1.0, 1.0, 0.3, {
              id: fit.id,
              label: fit.label || "Massif Béton GC",
            });
            this.modelRoot.add(pad);
          } else if ((fit.type as string) === "traversee_murale_gc") {
            const wallGroup = new THREE.Group();
            const wallGeom = new THREE.BoxGeometry(0.3, 1.2, 1.2);
            const wallMesh = new THREE.Mesh(wallGeom, (this.materials as any).concretePad || this.materials.carbonSteel);
            wallGroup.add(wallMesh);

            const sleeveGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.4, 24);
            const sleeveMesh = new THREE.Mesh(sleeveGeom, this.materials.supportSteel);
            sleeveMesh.rotation.z = Math.PI / 2;
            wallGroup.add(sleeveMesh);

            wallGroup.position.copy(fitPos);
            wallGroup.userData = {
              isPdiEntity: true,
              entityType: "genie_civil",
              label: fit.label || "Traversée Murale GC",
              id: fit.id,
            };
            this.modelRoot.add(wallGroup);
          } else if (fit.type === "fond_bombe") {
            const cap = this.factory.createPipeCapMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Fond bombé DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(cap);
          } else if (fit.type.includes("reduction") || fit.type.includes("reduc")) {
            const red = this.factory.createReducerMesh(fitPos, normDir, fitDn, Math.max(15, Math.round(fitDn * 0.7)), false, mat, {
              id: fit.id,
              label: fit.label || `Réduction DN${fitDn}`,
              spoolId,
            });
            this.modelRoot.add(red);
          } else if (fit.type.includes("te")) {
            const teeGroup = new THREE.Group();
            const mainGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 24);
            const mainMesh = new THREE.Mesh(mainGeom, mat);
            mainMesh.rotation.z = Math.PI / 2;
            const branchGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 24);
            const branchMesh = new THREE.Mesh(branchGeom, mat);
            branchMesh.position.y = 0.11;
            teeGroup.add(mainMesh);
            teeGroup.add(branchMesh);
            teeGroup.position.copy(fitPos);
            teeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), normDir);
            teeGroup.userData = { isPdiEntity: true, entityType: "fitting", label: fit.label || `Té DN${fitDn}`, id: fit.id, dn: fitDn, spoolId };
            this.modelRoot.add(teeGroup);
          } else if (fit.type.includes("coude")) {
            const elbow = this.factory.createElbowMesh(fitPos, normDir, new THREE.Vector3(0, 1, 0), fitDn, mat, {
              id: fit.id,
              label: fit.label || `Coude DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(elbow);
          } else {
            // Fallback universel pour tout composant ou raccord en ligne
            const genFlange = this.factory.createFlangeMesh(fitPos, normDir, fitDn, mat, {
              id: fit.id,
              label: fit.label || `Composant DN${fitDn}`,
              dn: fitDn,
              spoolId,
            });
            this.modelRoot.add(genFlange);
          }
        }
      }
    }

    // 2. Construction des raccords & équipements aux nœuds
    const nodeConnMap = new Map<string, Array<{ seg: typeof segments[0]; otherNodeId: string; dir: THREE.Vector3 }>>();
    for (const seg of segments) {
      const fN = nodeMap.get(seg.fromNodeId);
      const tN = nodeMap.get(seg.toNodeId);
      if (!fN || !tN) continue;
      const vFrom = toThree(fN.x, fN.y, fN.z);
      const vTo = toThree(tN.x, tN.y, tN.z);
      const d1 = new THREE.Vector3().subVectors(vTo, vFrom).normalize();
      const d2 = d1.clone().negate();

      if (!nodeConnMap.has(seg.fromNodeId)) nodeConnMap.set(seg.fromNodeId, []);
      nodeConnMap.get(seg.fromNodeId)!.push({ seg, otherNodeId: seg.toNodeId, dir: d1 });

      if (!nodeConnMap.has(seg.toNodeId)) nodeConnMap.set(seg.toNodeId, []);
      nodeConnMap.get(seg.toNodeId)!.push({ seg, otherNodeId: seg.fromNodeId, dir: d2 });
    }

    for (const node of nodes) {
      const pos = toThree(node.x, node.y, node.z);
      const dn = node.dn || 100;
      let mat = this.materials.carbonSteel;
      if (this.currentOptions.selectedEntityId === node.id) {
        mat = this.materials.highlightSelected;
      }
      const conns = nodeConnMap.get(node.id) || [];
      const eqType = (node.equipmentType || "").toLowerCase();
      const nodeType = (node.type || "").toLowerCase();
      const nodeName = (node.name || "").toLowerCase();
      const eqLabel = (node.equipmentLabel || node.reference || "").toLowerCase();
      const eqTag = (node.tag || "").toLowerCase();
      const rot = node.rotation || 0;

      const isPump =
        eqType.includes("pompe") ||
        eqType.includes("pump") ||
        eqLabel.includes("pompe") ||
        eqLabel.includes("pump") ||
        eqTag.includes("pompe") ||
        eqTag.includes("pump") ||
        nodeName.startsWith("pompe") ||
        nodeName.startsWith("pump_") ||
        nodeName.includes("pompe");

      const isVessel =
        eqType.includes("ballon") ||
        eqType.includes("cuve") ||
        eqType.includes("reservoir") ||
        eqType.includes("vessel") ||
        eqType.includes("capacite") ||
        eqLabel.includes("ballon") ||
        eqLabel.includes("cuve") ||
        eqLabel.includes("reservoir") ||
        eqLabel.includes("vessel") ||
        eqTag.includes("ballon") ||
        eqTag.includes("cuve") ||
        nodeName.startsWith("ballon") ||
        nodeName.startsWith("cuve") ||
        nodeName.startsWith("reservoir") ||
        nodeName.startsWith("vessel") ||
        nodeName.includes("ballon") ||
        nodeName.includes("cuve") ||
        nodeName.includes("reservoir");

      const isExchanger =
        eqType.includes("echangeur") ||
        eqType.includes("condenseur") ||
        eqType.includes("reboiler") ||
        eqType.includes("exchanger") ||
        eqLabel.includes("echangeur") ||
        eqLabel.includes("exchanger") ||
        eqTag.includes("echangeur") ||
        nodeName.startsWith("echangeur") ||
        nodeName.includes("echangeur");

      const isFilter =
        eqType.includes("filtre") ||
        eqType.includes("tamis") ||
        eqType.includes("strainer") ||
        eqLabel.includes("filtre") ||
        eqLabel.includes("strainer") ||
        nodeName.startsWith("filtre") ||
        nodeName.includes("filtre");

      const isPigTrap =
        eqType.includes("gare") ||
        eqType.includes("trap") ||
        nodeType === "gare_depart" ||
        nodeType === "gare_arrivee" ||
        nodeName.startsWith("gare") ||
        nodeName.includes("gare_");

      if (node.type === "tee" || eqType.startsWith("te_") || eqType.includes("tee")) {
        // Té 3D orienté selon les directions réelles des tronçons connectés
        const teeGroup = new THREE.Group();
        const pipeR = Math.max(0.025, (dn / 1000) / 2);
        const mainLen = Math.max(0.24, pipeR * 5);
        const branchLen = Math.max(0.14, pipeR * 3);

        let runDir = new THREE.Vector3(1, 0, 0);
        let branchDir = new THREE.Vector3(0, 1, 0);

        if (conns.length >= 2) {
          // Chercher les deux branches colinéaires opposées formant la ligne principale (run)
          let bestPair = [0, 1];
          let bestDot = 1;
          for (let ci = 0; ci < conns.length; ci++) {
            for (let cj = ci + 1; cj < conns.length; cj++) {
              const d = conns[ci].dir.dot(conns[cj].dir);
              if (d < bestDot) {
                bestDot = d;
                bestPair = [ci, cj];
              }
            }
          }
          if (bestDot < -0.3) {
            runDir = conns[bestPair[0]].dir.clone().normalize();
            // Trouver la branche restante
            const branchConn = conns.find((_, idx) => idx !== bestPair[0] && idx !== bestPair[1]);
            if (branchConn) {
              branchDir = branchConn.dir.clone().normalize();
            } else {
              branchDir = new THREE.Vector3(0, 1, 0).cross(runDir).normalize();
              if (branchDir.lengthSq() < 0.1) branchDir = new THREE.Vector3(0, 0, 1).cross(runDir).normalize();
            }
          } else {
            runDir = conns[0].dir.clone().normalize();
            branchDir = conns[1] ? conns[1].dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
          }
        }

        const mainGeom = new THREE.CylinderGeometry(pipeR * 1.04, pipeR * 1.04, mainLen, 24);
        const mainMesh = new THREE.Mesh(mainGeom, mat);
        mainMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), runDir);

        const branchGeom = new THREE.CylinderGeometry(pipeR * 1.02, pipeR * 1.02, branchLen, 24);
        const branchMesh = new THREE.Mesh(branchGeom, mat);
        branchMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), branchDir);
        branchMesh.position.copy(branchDir.clone().multiplyScalar(branchLen / 2));

        teeGroup.add(mainMesh);
        teeGroup.add(branchMesh);
        teeGroup.position.copy(pos);
        teeGroup.userData = { isPdiEntity: true, entityType: "node", label: node.equipmentLabel || node.name || `Té DN${dn}`, id: node.id, dn };
        this.modelRoot.add(teeGroup);
      } else if (isPump) {
        // Pompe centrifuge 3D ultra-détaillée
        const pump = this.factory.createPumpMesh(pos, rot, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Pompe DN${dn}`,
          dn,
        });
        this.modelRoot.add(pump);
      } else if (isVessel) {
        // Ballon / Réservoir 3D haute fidélité
        const isVertical = !eqType.includes("horiz") && !nodeName.includes("horiz");
        const vessel = this.factory.createVesselMesh(pos, rot, isVertical, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Capacité/Ballon DN${dn}`,
          dn,
        });
        this.modelRoot.add(vessel);
      } else if (isExchanger) {
        // Échangeur de chaleur TEMA 3D
        const hex = this.factory.createHeatExchangerMesh(pos, rot, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Échangeur DN${dn}`,
          dn,
        });
        this.modelRoot.add(hex);
      } else if (isFilter) {
        // Filtre Y / panier 3D
        const flowDir = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const filter = this.factory.createFilterMesh(pos, flowDir, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Filtre DN${dn}`,
          dn,
        });
        this.modelRoot.add(filter);
      } else if (isPigTrap) {
        // Gare de raclage 3D
        const flowDir = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const isLauncher = nodeType === "gare_depart" || eqType.includes("depart") || nodeName.includes("depart");
        const pigTrap = this.factory.createPigTrapMesh(pos, flowDir, isLauncher, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || (isLauncher ? `Gare départ DN${dn}` : `Gare arrivée DN${dn}`),
          dn,
        });
        this.modelRoot.add(pigTrap);
      } else if (eqType.includes("clapet")) {
        // Clapet anti-retour 3D
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const clapet = this.factory.createCheckValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Clapet DN${dn}`,
          dn,
        });
        this.modelRoot.add(clapet);
      } else if (eqType.includes("soupape")) {
        // Soupape de sécurité 3D
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(0, 1, 0);
        const psv = this.factory.createSafetyValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Soupape DN${dn}`,
          dn,
        });
        this.modelRoot.add(psv);
      } else if (eqType.includes("boisseau")) {
        // Vanne boisseau sphérique 3D
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const bv = this.factory.createBallValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Vanne boisseau DN${dn}`,
          dn,
        });
        this.modelRoot.add(bv);
      } else if (eqType.includes("papillon")) {
        // Vanne papillon 3D
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const bfv = this.factory.createButterflyValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Vanne papillon DN${dn}`,
          dn,
        });
        this.modelRoot.add(bfv);
      } else if (eqType.includes("pointeau")) {
        // Robinet pointeau 3D
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const nv = this.factory.createNeedleValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Robinet pointeau DN${dn}`,
          dn,
        });
        this.modelRoot.add(nv);
      } else if (eqType.includes("vanne") || eqType.includes("robinet")) {
        // Vanne / Robinetterie 3D standard
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const valve = this.factory.createValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Vanne DN${dn}`,
          dn,
        });
        this.modelRoot.add(valve);
      } else if (eqType === "bride_pleine") {
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const blind = this.factory.createBlindFlangeMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Bride pleine DN${dn}`,
          dn,
        });
        this.modelRoot.add(blind);
      } else if (eqType === "jmi") {
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const jmi = this.factory.createInsulatingJointMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Joint Isolant JMI DN${dn}`,
          dn,
        });
        this.modelRoot.add(jmi);
      } else if (eqType.includes("bride") || eqType === "joint") {
        // Bride / Joint isolant 3D
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const flange = this.factory.createFlangeMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Bride DN${dn}`,
          dn,
        });
        this.modelRoot.add(flange);
      } else if (eqType.includes("manometre") || eqType.includes("pression")) {
        const pi = this.factory.createPressureGaugeMesh(pos, new THREE.Vector3(0, 1, 0), dn, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Manomètre PI DN${dn}`,
        });
        this.modelRoot.add(pi);
      } else if (eqType.includes("thermometre")) {
        const ti = this.factory.createThermometerMesh(pos, new THREE.Vector3(0, 1, 0), dn, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Thermomètre TI DN${dn}`,
        });
        this.modelRoot.add(ti);
      } else if (eqType.includes("purge") || eqType.includes("event")) {
        const vent = this.factory.createVentDrainMesh(pos, new THREE.Vector3(0, 1, 0), dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Purge/Évent DN${dn}`,
        });
        this.modelRoot.add(vent);
      } else if (eqType.includes("reduction")) {
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const red = this.factory.createReducerMesh(pos, norm, dn, Math.max(15, Math.round(dn * 0.7)), false, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Réducteur DN${dn}`,
        });
        this.modelRoot.add(red);
      } else if (nodeType === "entree_poste" || nodeType === "sortie_poste") {
        // Entrée / Sortie de poste 3D avec bride et massif GC
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(0, 1, 0);
        const flange = this.factory.createFlangeMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.name || (nodeType === "entree_poste" ? `Entrée poste DN${dn}` : `Sortie poste DN${dn}`),
          dn,
        });
        this.modelRoot.add(flange);
        const pad = this.factory.createCivilPadMesh(new THREE.Vector3(pos.x, 0, pos.z), 0.9, 0.9, 0.22, {
          id: `pad_${node.id}`,
          label: `Massif GC ${node.name || "Entrée/Sortie"}`,
        });
        this.modelRoot.add(pad);
      } else if (eqType === "massif_beton_gc" || eqType.includes("massif") || eqType.includes("beton")) {
        const pad = this.factory.createCivilPadMesh(new THREE.Vector3(pos.x, 0, pos.z), 1.0, 1.0, 0.3, {
          id: node.id,
          label: node.name || "Massif Béton GC",
        });
        if (rot) pad.rotation.y = (rot * Math.PI) / 180;
        this.modelRoot.add(pad);
      } else if (eqType === "traversee_murale_gc" || eqType.includes("traversee") || eqType.includes("murale")) {
        const wallGroup = new THREE.Group();
        const wallGeom = new THREE.BoxGeometry(0.3, 1.2, 1.2);
        const wallMesh = new THREE.Mesh(wallGeom, (this.materials as any).concretePad || this.materials.carbonSteel);
        wallGroup.add(wallMesh);

        const sleeveGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.4, 24);
        const sleeveMesh = new THREE.Mesh(sleeveGeom, this.materials.supportSteel);
        sleeveMesh.rotation.z = Math.PI / 2;
        wallGroup.add(sleeveMesh);

        wallGroup.position.copy(pos);
        if (rot) wallGroup.rotation.y = (rot * Math.PI) / 180;
        wallGroup.userData = {
          isPdiEntity: true,
          entityType: "genie_civil",
          label: node.name || "Traversée Murale GC",
          id: node.id,
        };
        this.modelRoot.add(wallGroup);
      } else if (eqType.includes("coude") || eqType.includes("elbow") || conns.length === 2) {
        // Détecter un coude à 90°, 45° ou changement de direction d'angle au nœud
        if (conns.length >= 2) {
          const inDir = conns[0].dir.clone().negate();
          const outDir = conns[1].dir.clone();
          const dot = inDir.dot(outDir);
          if (dot < 0.98 || eqType.includes("coude") || eqType.includes("elbow")) {
            const elbow = this.factory.createElbowMesh(pos, inDir, outDir, dn, mat, {
              id: `elbow_${node.id}`,
              label: node.equipmentLabel || node.name || `Coude DN${dn}`,
              nodeId: node.id,
            });
            this.modelRoot.add(elbow);
          }
        } else if (eqType.includes("coude") || eqType.includes("elbow")) {
          const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
          const elbow = this.factory.createElbowMesh(pos, norm.clone().negate(), norm, dn, mat, {
            id: `elbow_${node.id}`,
            label: node.equipmentLabel || node.name || `Coude DN${dn}`,
            nodeId: node.id,
          });
          this.modelRoot.add(elbow);
        }
      } else if (node.equipmentType) {
        const norm = conns[0] ? conns[0].dir : new THREE.Vector3(1, 0, 0);
        const valve = this.factory.createValveMesh(pos, norm, dn, mat, {
          id: node.id,
          label: node.equipmentLabel || node.name || `Équipement ${node.equipmentType} DN${dn}`,
          dn,
        });
        this.modelRoot.add(valve);
      }
    }

    // 3. Construction des soudures 3D (Weld Rings) avec alignement vectoriel
    if (this.currentOptions.showWelds) {
      for (const weld of welds) {
        if (
          this.currentOptions.selectedSpoolId &&
          this.currentOptions.selectedSpoolId !== "all" &&
          weld.spoolId !== this.currentOptions.selectedSpoolId
        ) {
          continue;
        }

        const weldPos = toThree(weld.worldPos.x, weld.worldPos.y, weld.worldPos.z);
        
        let weldNorm = new THREE.Vector3(1, 0, 0);
        const attachedSeg = segMap.get(weld.segmentId);
        if (attachedSeg) {
          const fN = nodeMap.get(attachedSeg.fromNodeId);
          const tN = nodeMap.get(attachedSeg.toNodeId);
          if (fN && tN) {
            const v1 = toThree(fN.x, fN.y, fN.z);
            const v2 = toThree(tN.x, tN.y, tN.z);
            const dir = new THREE.Vector3().subVectors(v2, v1);
            if (dir.lengthSq() > 0.0001) weldNorm = dir.normalize();
          }
        }

        const weldMesh = this.factory.createWeldRingMesh(
          weldPos,
          weldNorm,
          weld.dn,
          weld.location,
          {
            id: weld.id,
            weldNumber: weld.weldNumber,
            location: weld.location,
            spoolId: weld.spoolId,
            wpsRef: weld.wpsRef || weld.wpsNumber,
            ndtRequired: weld.ndtRequired,
            ndtStatus: weld.ndtStatus,
          }
        );
        this.modelRoot.add(weldMesh);
      }
    }

    // 4. Construction des supports 3D MSS SP-58
    if (this.currentOptions.showSupports && supports) {
      for (const sup of supports) {
        const seg = segMap.get(sup.segmentId);
        const dn = seg?.dn || 100;
        const supPos = toThree(sup.worldPos.x, sup.worldPos.y, sup.worldPos.z);
        const supMesh = this.factory.createSupportMesh(sup, supPos, dn);
        this.modelRoot.add(supMesh);
      }
    }

    // 5. Projection du Volume Extrudé (Skid Industriel / Chambre Technique), Zones Intérieur/Extérieur & Traversées de Paroi
    const env = data.envelope;
    const isEnvelopeActive = env && env.active !== false;
    const shouldShowEnvelope = isEnvelopeActive && this.currentOptions.showVolumeEnvelope !== false;

    if (shouldShowEnvelope && env) {
      // Construction de la structure volumétrique 3D (Parois, ossature IPE, dalle/caillebotis)
      const volumeMesh = this.factory.createVolumeEnvelopeMesh(env, {
        showSolidWalls: false,
        wireframe: false,
      });
      this.modelRoot.add(volumeMesh);

      // Calcul des traversées de paroi étanches (Link-Seal) et détection des zones int/ext
      if (this.currentOptions.showWallCrossings !== false) {
        const xMin = env.x;
        const xMax = env.x + env.length;
        const yMin = env.y;
        const yMax = env.y + env.width;
        const zMin = env.z;
        const zMax = env.z + env.height;

        const isInside = (x: number, y: number, z: number) =>
          x >= xMin - 0.001 && x <= xMax + 0.001 &&
          y >= yMin - 0.001 && y <= yMax + 0.001 &&
          z >= zMin - 0.001 && z <= zMax + 0.001;

        const eps = 0.02;

        for (const seg of segments) {
          const fn = nodeMap.get(seg.fromNodeId);
          const tn = nodeMap.get(seg.toNodeId);
          if (!fn || !tn) continue;

          const p1 = { x: fn.x, y: fn.y, z: fn.z };
          const p2 = { x: tn.x, y: tn.y, z: tn.z };
          const in1 = isInside(p1.x, p1.y, p1.z);
          const in2 = isInside(p2.x, p2.y, p2.z);

          // Si le segment franchit une frontière ou relie intérieur et extérieur
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dz = p2.z - p1.z;

          const checkPlane = (
            valA: number,
            valB: number,
            planeVal: number,
            axis: "X" | "Y" | "Z",
            planeName: string,
            normVec: THREE.Vector3
          ) => {
            if (Math.abs(valB - valA) < 0.0001) return;
            const t = (planeVal - valA) / (valB - valA);
            if (t >= -0.001 && t <= 1.001) {
              const ix = p1.x + t * dx;
              const iy = p1.y + t * dy;
              const iz = p1.z + t * dz;

              // Vérifier si l'intersection tombe dans le rectangle de la face
              const withinX = (axis === "X") || (ix >= xMin - eps && ix <= xMax + eps);
              const withinY = (axis === "Y") || (iy >= yMin - eps && iy <= yMax + eps);
              const withinZ = (axis === "Z") || (iz >= zMin - eps && iz <= zMax + eps);

              if (withinX && withinY && withinZ) {
                const threePos = toThree(ix, iy, iz);
                const isExit = in1 && !in2;

                const crossingGroup = this.factory.createWallCrossingMesh({
                  x: threePos.x,
                  y: threePos.y,
                  z: threePos.z,
                  plane: planeName,
                  axis,
                  normal: normVec,
                  dn: seg.dn || 100,
                  segmentId: seg.id,
                  lineNumber: seg.tag,
                  isExit,
                });
                this.modelRoot.add(crossingGroup);
              }
            }
          };

          // 1. Paroi Ouest (-X) et Paroi Est (+X)
          checkPlane(p1.x, p2.x, xMin, "X", "Paroi Ouest (-X)", new THREE.Vector3(-1, 0, 0));
          checkPlane(p1.x, p2.x, xMax, "X", "Paroi Est (+X)", new THREE.Vector3(1, 0, 0));

          // 2. Paroi Sud (-Y) et Paroi Nord (+Y)
          checkPlane(p1.y, p2.y, yMin, "Y", "Paroi Sud (-Y)", new THREE.Vector3(0, 0, -1));
          checkPlane(p1.y, p2.y, yMax, "Y", "Paroi Nord (+Y)", new THREE.Vector3(0, 0, 1));

          // 3. Dalle Sol (-Z) et Dalle Plafond (+Z)
          checkPlane(p1.z, p2.z, zMin, "Z", "Dalle Sol (-Z)", new THREE.Vector3(0, -1, 0));
          checkPlane(p1.z, p2.z, zMax, "Z", "Plafond (+Z)", new THREE.Vector3(0, 1, 0));
        }
      }
    }

    // Cadrage automatique uniquement au premier chargement ou si explicitement demandé (évite la perte de zoom lors des mises à jour)
    if (this.isFirstBuild || options?.forceAutoFit) {
      this.fitToExtents();
      this.isFirstBuild = false;
    }
  }

  /**
   * Recadre la caméra sur l'ensemble de la tuyauterie
   */
  public fitToExtents(): void {
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    if (box.isEmpty()) return;

    box.getCenter(this.target);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 2);

    this.spherical.radius = maxDim * 1.7;
    this.currentSpherical.copy(this.spherical);
    this.currentTarget.copy(this.target);
    this.updateCameraPosition();
  }

  /**
   * Centre la caméra sur un point cible précis (ex. double clic sur un élément)
   */
  public focusOnPoint(point: THREE.Vector3, distance?: number): void {
    this.target.copy(point);
    if (distance) {
      this.spherical.radius = Math.max(0.2, distance);
    }
    this.updateCameraPosition();
  }

  /**
   * Applique un preset de vue standard d'ingénierie
   */
  public setViewPreset(preset: CameraViewPreset): void {
    const r = this.spherical.radius;
    switch (preset) {
      case "iso_sw":
        this.spherical.set(r, Math.PI / 3, Math.PI / 4);
        break;
      case "iso_se":
        this.spherical.set(r, Math.PI / 3, (3 * Math.PI) / 4);
        break;
      case "iso_ne":
        this.spherical.set(r, Math.PI / 3, (5 * Math.PI) / 4);
        break;
      case "iso_nw":
        this.spherical.set(r, Math.PI / 3, (7 * Math.PI) / 4);
        break;
      case "top":
        this.spherical.set(r, 0.001, 0); // Vue de dessus pure
        break;
      case "front":
        this.spherical.set(r, Math.PI / 2, 0); // Vue de face X-Z
        break;
      case "side":
        this.spherical.set(r, Math.PI / 2, Math.PI / 2); // Vue latérale Y-Z
        break;
    }
    this.updateCameraPosition();
  }

  /**
   * Bascule entre projection perspective et orthographique
   */
  public setProjection(type: CameraProjectionType): void {
    this.currentOptions.projection = type;
    this.activeCamera = type === "orthographic" ? this.cameraOrthographic : this.cameraPerspective;
    this.handleResize();
    this.updateCameraPosition();
  }

  /**
   * Navigation latérale et horizontale fluide (Panoramique caméra avec impulsion cinématique)
   * deltaX : gauche (-1) / droite (+1)
   * deltaY : bas (-1) / haut (+1)
   */
  public panLateral(deltaX: number, deltaY: number, stepMultiplier: number = 1): void {
    this.panVelocity.x += deltaX * 0.18 * stepMultiplier;
    this.panVelocity.y += deltaY * 0.18 * stepMultiplier;
  }

  /**
   * Rotation orbitale au clavier avec impulsion cinématique
   * deltaTheta : rotation azimutale horizontale (gauche / droite)
   * deltaPhi : rotation polaire verticale (haut / bas)
   */
  public rotateOrbital(deltaTheta: number, deltaPhi: number): void {
    this.orbitVelocity.x += deltaTheta * 0.4;
    this.orbitVelocity.y += deltaPhi * 0.4;
  }

  /**
   * Zoom progressif avec impulsion cinématique
   */
  public zoomStep(factor: number): void {
    const delta = factor < 1 ? -0.12 : 0.12;
    this.zoomVelocity += delta;
  }

  /**
   * Méthodes de contrôle continu pour le D-Pad ou boutons maintenus (aucun à-coup)
   */
  public startPanContinuous(dx: number, dy: number, speedMultiplier: number = 1): void {
    this.panVelocity.x = dx * 0.3 * speedMultiplier;
    this.panVelocity.y = dy * 0.3 * speedMultiplier;
  }

  public stopPanContinuous(): void {
    this.panVelocity.set(0, 0);
  }

  public startOrbitContinuous(dTheta: number, dPhi: number): void {
    this.orbitVelocity.x = dTheta * 0.04;
    this.orbitVelocity.y = dPhi * 0.04;
  }

  public stopOrbitContinuous(): void {
    this.orbitVelocity.set(0, 0);
  }

  public startZoomContinuous(dir: number): void {
    this.zoomVelocity = dir * 0.06;
  }

  public stopZoomContinuous(): void {
    this.zoomVelocity = 0;
  }

  public onKeyDown(e: KeyboardEvent): void {
    this.keysDown.add(e.key);
  }

  public onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.key);
  }

  private updateCameraPosition(): void {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.activeCamera.position.copy(this.target).add(offset);
    this.activeCamera.lookAt(this.target);

    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      const frustumSize = this.spherical.radius;
      const aspect = this.container.clientWidth / (this.container.clientHeight || 1);
      this.activeCamera.left = (-frustumSize * aspect) / 2;
      this.activeCamera.right = (frustumSize * aspect) / 2;
      this.activeCamera.top = frustumSize / 2;
      this.activeCamera.bottom = -frustumSize / 2;
      this.activeCamera.updateProjectionMatrix();
    }
  }

  private bindEvents(): void {
    const el = this.renderer.domElement;

    el.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.isPanning = e.button === 2 || e.shiftKey;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
      this.isPanning = false;
    });

    el.addEventListener("contextmenu", (e) => e.preventDefault());

    el.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        if (this.isPanning) {
          // Panoramique fluide
          const panSpeed = Math.max(0.0005, this.spherical.radius * 0.0012);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.activeCamera.quaternion);
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.activeCamera.quaternion);
          this.target.addScaledVector(right, -deltaX * panSpeed);
          this.target.addScaledVector(up, deltaY * panSpeed);
        } else {
          // Rotation orbitale
          this.spherical.theta -= deltaX * 0.0055;
          this.spherical.phi = Math.max(0.005, Math.min(Math.PI - 0.005, this.spherical.phi - deltaY * 0.0055));
        }

        this.updateCameraPosition();
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      } else {
        this.checkHover(e);
      }
    });

    // Zoom molette haute résolution avec pas progressif et borne minimum de 0.05m
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.08 : 0.925;
        this.spherical.radius = Math.max(0.05, Math.min(300, this.spherical.radius * factor));
        this.updateCameraPosition();
      },
      { passive: false }
    );

    el.addEventListener("click", (e) => {
      this.checkClick(e);
    });

    // Double clic : focus automatique sur le composant cliqué
    el.addEventListener("dblclick", (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mousePos, this.activeCamera);
      const intersects = this.raycaster.intersectObjects(this.modelRoot.children, true);
      const hit = intersects.find((i) => i.object.userData?.isPdiEntity);
      if (hit) {
        this.focusOnPoint(hit.point, Math.max(0.8, this.spherical.radius * 0.5));
      }
    });

    window.addEventListener("resize", () => this.handleResize());
  }

  private checkHover(e: MouseEvent): void {
    if (!this.onEntityHover) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mousePos, this.activeCamera);
    const intersects = this.raycaster.intersectObjects(this.modelRoot.children, true);

    const hit = intersects.find((i) => i.object.userData?.isPdiEntity);
    if (hit) {
      const u = hit.object.userData;
      this.onEntityHover({
        type: u.entityType,
        id: u.id || "elem",
        label: u.tag || u.label || u.weldNumber || "Composant tuyauterie",
        dn: u.dn,
        odMm: u.odMm,
        thicknessMm: u.thicknessMm,
        material: u.material,
        schedule: u.schedule,
        spoolId: u.spoolId,
        spoolColor: u.spoolColor,
        service: u.service,
        pressureClass: u.pressureClass,
        lengthM: u.lengthM,
        wallCrossingInfo:
          u.entityType === "wall_crossing"
            ? {
                plane: u.plane,
                axis: u.axis,
                coord: u.axis === "X" ? hit.point.x : u.axis === "Y" ? hit.point.z : hit.point.y,
                segmentId: u.segmentId,
                dn: u.dn,
                sleeveType: u.sleeveType || "Fourreau étanche Link-Seal",
              }
            : undefined,
        worldPos: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      });
    } else {
      this.onEntityHover(null);
    }
  }

  private checkClick(e: MouseEvent): void {
    if (!this.onEntitySelected) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mousePos, this.activeCamera);
    const intersects = this.raycaster.intersectObjects(this.modelRoot.children, true);

    const hit = intersects.find((i) => i.object.userData?.isPdiEntity);
    if (hit) {
      const u = hit.object.userData;
      this.onEntitySelected({
        type: u.entityType,
        id: u.id || "elem",
        label: u.tag || u.label || u.weldNumber || "Composant",
        dn: u.dn,
        odMm: u.odMm,
        thicknessMm: u.thicknessMm,
        material: u.material,
        schedule: u.schedule,
        spoolId: u.spoolId,
        spoolColor: u.spoolColor,
        service: u.service,
        pressureClass: u.pressureClass,
        lengthM: u.lengthM,
        weldInfo:
          u.entityType === "weld"
            ? {
                weldNumber: u.weldNumber,
                location: u.location,
                wpsRef: u.wpsRef,
                ndtRequired: u.ndtRequired,
                ndtStatus: u.ndtStatus,
              }
            : undefined,
        supportInfo:
          u.entityType === "support"
            ? {
                tag: u.tag,
                typeCode: u.typeCode,
                typeLabelFr: u.typeLabelFr,
                standard: u.standard,
                designLoadKn: u.designLoadKn,
              }
            : undefined,
        wallCrossingInfo:
          u.entityType === "wall_crossing"
            ? {
                plane: u.plane,
                axis: u.axis,
                coord: u.axis === "X" ? hit.point.x : u.axis === "Y" ? hit.point.z : hit.point.y,
                segmentId: u.segmentId,
                dn: u.dn,
                sleeveType: u.sleeveType || "Fourreau étanche Link-Seal",
              }
            : undefined,
        worldPos: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      });
    } else {
      this.onEntitySelected(null);
    }
  }

  public handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height);
    const aspect = width / height;

    this.cameraPerspective.aspect = aspect;
    this.cameraPerspective.updateProjectionMatrix();

    const frustumSize = this.spherical.radius;
    this.cameraOrthographic.left = (-frustumSize * aspect) / 2;
    this.cameraOrthographic.right = (frustumSize * aspect) / 2;
    this.cameraOrthographic.top = frustumSize / 2;
    this.cameraOrthographic.bottom = -frustumSize / 2;
    this.cameraOrthographic.updateProjectionMatrix();
  }

  public setAutoRotate(enabled: boolean): void {
    this.currentOptions.autoRotate = enabled;
  }

  public setShadingMode(mode: Viewer3dOptions["shadingMode"]): void {
    this.currentOptions.shadingMode = mode;
    if (this.currentData) {
      this.buildModel(this.currentData);
    }
  }

  public setSelectedSpoolId(spoolId: string | null): void {
    this.currentOptions.selectedSpoolId = spoolId;
    if (this.currentData) {
      this.buildModel(this.currentData);
    }
  }

  public setSelectedEntityId(entityId: string | null): void {
    this.currentOptions.selectedEntityId = entityId;
    if (this.currentData) {
      this.buildModel(this.currentData);
    }
  }

  private startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      let hasMoved = false;

      // Traitement des touches de clavier maintenues (Navigation continue sans à-coups)
      if (this.keysDown.has("ArrowLeft")) {
        if (this.keysDown.has("Shift")) {
          this.orbitVelocity.x -= 0.0035;
        } else {
          const mult = this.keysDown.has("Control") || this.keysDown.has("Alt") ? 2.5 : 1;
          this.panVelocity.x -= 0.016 * mult;
        }
        hasMoved = true;
      }
      if (this.keysDown.has("ArrowRight")) {
        if (this.keysDown.has("Shift")) {
          this.orbitVelocity.x += 0.0035;
        } else {
          const mult = this.keysDown.has("Control") || this.keysDown.has("Alt") ? 2.5 : 1;
          this.panVelocity.x += 0.016 * mult;
        }
        hasMoved = true;
      }
      if (this.keysDown.has("ArrowUp")) {
        if (this.keysDown.has("Shift")) {
          this.orbitVelocity.y -= 0.0028;
        } else if (this.keysDown.has("Control")) {
          this.zoomVelocity -= 0.012;
        } else {
          const mult = this.keysDown.has("Alt") ? 2.5 : 1;
          this.panVelocity.y += 0.016 * mult;
        }
        hasMoved = true;
      }
      if (this.keysDown.has("ArrowDown")) {
        if (this.keysDown.has("Shift")) {
          this.orbitVelocity.y += 0.0028;
        } else if (this.keysDown.has("Control")) {
          this.zoomVelocity += 0.012;
        } else {
          const mult = this.keysDown.has("Alt") ? 2.5 : 1;
          this.panVelocity.y -= 0.016 * mult;
        }
        hasMoved = true;
      }

      // Application des vitesses cinématiques avec amortissement / friction exponentielle
      if (Math.abs(this.panVelocity.x) > 0.0001 || Math.abs(this.panVelocity.y) > 0.0001) {
        const panSpeed = Math.max(0.04, this.spherical.radius * 0.04);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.activeCamera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.activeCamera.quaternion);
        this.target.addScaledVector(right, this.panVelocity.x * panSpeed);
        this.target.addScaledVector(up, this.panVelocity.y * panSpeed);
        this.panVelocity.multiplyScalar(0.82); // Amortissement fluide
        hasMoved = true;
      }

      if (Math.abs(this.orbitVelocity.x) > 0.0001 || Math.abs(this.orbitVelocity.y) > 0.0001) {
        this.spherical.theta += this.orbitVelocity.x;
        this.spherical.phi = Math.max(0.005, Math.min(Math.PI - 0.005, this.spherical.phi + this.orbitVelocity.y));
        this.orbitVelocity.multiplyScalar(0.82); // Amortissement fluide
        hasMoved = true;
      }

      if (Math.abs(this.zoomVelocity) > 0.0001) {
        this.spherical.radius = Math.max(0.05, Math.min(400, this.spherical.radius * (1 + this.zoomVelocity)));
        this.zoomVelocity *= 0.82;
        hasMoved = true;
      }

      if (this.currentOptions.autoRotate && !this.isDragging) {
        this.spherical.theta += this.autoRotateSpeed;
        hasMoved = true;
      }

      if (hasMoved) {
        this.updateCameraPosition();
      }

      // Suivi dynamique infini de la grille calquée sur le repère isométrique
      if (this.groundGroup) {
        this.groundGroup.position.x = Math.round(this.target.x / 5) * 5;
        this.groundGroup.position.z = Math.round(this.target.z / 5) * 5;
      }

      this.renderer.render(this.scene, this.activeCamera);
    };
    animate();
  }

  /**
   * Capture une capture d'écran PNG haute résolution avec Watermark inaltérable
   */
  public takeSnapshotPng(projectName: string = "Projet Tuyauterie"): string {
    this.renderer.render(this.scene, this.activeCamera);
    const canvas = this.renderer.domElement;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = canvas.width;
    outCanvas.height = canvas.height;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/png");

    ctx.drawImage(canvas, 0, 0);

    // Bandeau technique en bas
    ctx.fillStyle = "rgba(10, 15, 24, 0.88)";
    ctx.fillRect(0, outCanvas.height - 42, outCanvas.width, 42);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillText("ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS 3D", 20, outCanvas.height - 16);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`${projectName} · ASME B31.3 / B16.9 / TEMA · Rendu 3D Solide Extrudé`, outCanvas.width - 420, outCanvas.height - 16);

    return outCanvas.toDataURL("image/png");
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

