/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : FABRIQUE GÉOMÉTRIQUE 3D SOLIDE HAUTE FIDÉLITÉ
 * Modélisation physique haute tessellation des tubes, coudes, brides, vannes,
 * équipements industriels complexes (pompes, cuves, échangeurs, filtres, gares de raclage)
 * et massifs de Génie Civil selon les normes ASME B16.9, ASME B16.5, ASME B36.10M, TEMA et MSS SP-58.
 * Version : 021C-ULTRA (07 Septembre 2026)
 */

import * as THREE from "three";
import { TROUVAY_CAUVIN_CATALOG } from "../catalog/trouvayCauvinCatalog";
import type { MaterialPalette } from "./pdi3dMaterials";
import type { IsoPipingSupport } from "../isometric/supports/pdiMssSupportEngine";

export interface PipeDimensions {
  odM: number;
  idM: number;
  thicknessM: number;
  dn: number;
}

export function getPipeStandardDimensions(dn: number): PipeDimensions {
  const catalogEntry = TROUVAY_CAUVIN_CATALOG.coude_90?.dimensions?.find((d) => d.dn === dn);
  let odMm = catalogEntry?.odMm;
  if (!odMm) {
    if (dn <= 15) odMm = 21.3;
    else if (dn <= 20) odMm = 26.7;
    else if (dn <= 25) odMm = 33.4;
    else if (dn <= 40) odMm = 48.3;
    else if (dn <= 50) odMm = 60.3;
    else if (dn <= 80) odMm = 88.9;
    else if (dn <= 100) odMm = 114.3;
    else if (dn <= 150) odMm = 168.3;
    else if (dn <= 200) odMm = 219.1;
    else if (dn <= 250) odMm = 273.0;
    else if (dn <= 300) odMm = 323.8;
    else if (dn <= 400) odMm = 406.4;
    else if (dn <= 500) odMm = 508.0;
    else odMm = dn * 1.1;
  }

  const thicknessMm = catalogEntry?.thicknessMm || Math.max(3.2, odMm * 0.05);
  const odM = odMm * 0.001;
  const thicknessM = thicknessMm * 0.001;
  const idM = Math.max(0.005, odM - 2 * thicknessM);

  return { odM, idM, thicknessM, dn };
}

export class Pdi3dGeometryFactory {
  private materials: MaterialPalette;

  constructor(materials: MaterialPalette) {
    this.materials = materials;
  }

  /**
   * Crée un tube solide cylindrique extrudé haute tessellation entre deux points 3D
   */
  public createPipeCylinder(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const length = dir.length();
    if (length < 0.001) return new THREE.Mesh();

    const dims = getPipeStandardDimensions(dn);
    const radius = dims.odM / 2;

    // 48 segments radiaux pour une courbure soignée
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 48, 1, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Positionner au point milieu
    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(midPoint);

    // Aligner l'axe Y du cylindre sur la direction p1 -> p2
    const yAxis = new THREE.Vector3(0, 1, 0);
    const normDir = dir.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(yAxis, normDir);
    mesh.quaternion.copy(quaternion);

    mesh.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "segment",
      dn,
      odMm: dims.odM * 1000,
      thicknessMm: dims.thicknessM * 1000,
      lengthM: length,
    };

    return mesh;
  }

  /**
   * Crée un coude torique haute résolution (Standard 1.5D Long Radius ASME B16.9)
   */
  public createElbowMesh(
    center: THREE.Vector3,
    inVec: THREE.Vector3,
    outVec: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const radius = dims.odM / 2;
    const bendRadius = Math.max(0.04, radius * 3.0); // Standard 1.5D Long Radius ASME B16.9

    if (inVec && outVec && inVec.lengthSq() > 0.0001 && outVec.lengthSq() > 0.0001) {
      const dirIn = inVec.clone().normalize();
      const dirOut = outVec.clone().normalize();
      const pStart = center.clone().addScaledVector(dirIn, -bendRadius);
      const pEnd = center.clone().addScaledVector(dirOut, bendRadius);

      const curve = new THREE.QuadraticBezierCurve3(pStart, center, pEnd);
      // Tessellation augmentée : 32 segments longitudinaux, 32 radiaux
      const tubeGeom = new THREE.TubeGeometry(curve, 32, radius, 32, false);
      const tubeMesh = new THREE.Mesh(tubeGeom, material);
      tubeMesh.castShadow = true;
      tubeMesh.receiveShadow = true;
      tubeMesh.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "coude", dn };
      group.add(tubeMesh);
    } else {
      const geom = new THREE.SphereGeometry(radius * 1.05, 32, 32);
      const sphereMesh = new THREE.Mesh(geom, material);
      sphereMesh.position.copy(center);
      sphereMesh.castShadow = true;
      sphereMesh.receiveShadow = true;
      sphereMesh.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "coude", dn };
      group.add(sphereMesh);
    }

    return group;
  }

  /**
   * Crée une bride normalisée avec collerette à souder (Welding Neck), face surélevée RF et boulonnerie ASME B16.5
   */
  public createFlangeMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const flangeR = pipeR * 1.85;
    const flangeThickness = Math.max(0.018, dims.odM * 0.22);
    const neckLength = Math.max(0.025, dims.odM * 0.4);

    const localAssembly = new THREE.Group();

    // 1. Collerette à souder conique (Welding Neck Hub)
    const hubGeom = new THREE.CylinderGeometry(pipeR * 1.25, pipeR, neckLength, 36);
    const hubMesh = new THREE.Mesh(hubGeom, material);
    hubMesh.position.y = -neckLength / 2;
    hubMesh.castShadow = true;
    localAssembly.add(hubMesh);

    // 2. Disque de bride principal
    const discGeom = new THREE.CylinderGeometry(flangeR, flangeR, flangeThickness, 48);
    const discMesh = new THREE.Mesh(discGeom, material);
    discMesh.position.y = flangeThickness / 2;
    discMesh.castShadow = true;
    discMesh.receiveShadow = true;
    localAssembly.add(discMesh);

    // 3. Face surélevée (Raised Face 2mm standard ASME)
    const rfGeom = new THREE.CylinderGeometry(pipeR * 1.35, pipeR * 1.35, flangeThickness * 0.15, 36);
    const rfMesh = new THREE.Mesh(rfGeom, this.materials.gasket);
    rfMesh.position.y = flangeThickness + (flangeThickness * 0.15) / 2;
    localAssembly.add(rfMesh);

    // 4. Couronne de boulons / goujons hexagonaux avec écrous ASME B18.2.1
    const boltCount = dn <= 40 ? 4 : dn <= 100 ? 8 : dn <= 200 ? 12 : dn <= 350 ? 16 : 20;
    const boltCircleR = (pipeR * 1.35 + flangeR) * 0.5;
    const boltRadius = Math.max(0.005, dims.odM * 0.05);

    const boltGroup = new THREE.Group();
    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2;
      const bx = Math.cos(angle) * boltCircleR;
      const bz = Math.sin(angle) * boltCircleR;

      // Tige filetée
      const studGeom = new THREE.CylinderGeometry(boltRadius, boltRadius, flangeThickness * 1.6, 12);
      const studMesh = new THREE.Mesh(studGeom, this.materials.anchorBolts);
      studMesh.position.set(bx, flangeThickness / 2, bz);
      studMesh.castShadow = true;
      boltGroup.add(studMesh);

      // Écrou hexagonal supérieur
      const nutGeom = new THREE.CylinderGeometry(boltRadius * 1.6, boltRadius * 1.6, boltRadius * 1.2, 6);
      const nutTop = new THREE.Mesh(nutGeom, this.materials.flangeBolts);
      nutTop.position.set(bx, flangeThickness + boltRadius * 0.6, bz);
      nutTop.castShadow = true;
      boltGroup.add(nutTop);

      // Écrou hexagonal inférieur
      const nutBot = new THREE.Mesh(nutGeom, this.materials.flangeBolts);
      nutBot.position.set(bx, -boltRadius * 0.6, bz);
      nutBot.castShadow = true;
      boltGroup.add(nutBot);
    }
    localAssembly.add(boltGroup);

    // Orientation selon la normale de la ligne
    const yAxis = new THREE.Vector3(0, 1, 0);
    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      localAssembly.quaternion.setFromUnitVectors(yAxis, norm);
    }
    localAssembly.position.copy(position);

    group.add(localAssembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "bride" };
    return group;
  }

  /**
   * Crée une vanne industrielle 3D haute fidélité (Chapeau boulonné, tige montante, volant à rayons & brides)
   */
  public createValveMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyLength = Math.max(0.14, dims.odM * 2.8);

    const valveAssembly = new THREE.Group();

    // 1. Corps de vanne forgé / moulé à double cône et renflement central
    const bodyGeom = new THREE.CylinderGeometry(pipeR * 1.5, pipeR * 1.5, bodyLength * 0.75, 32);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.materials.valveBody);
    bodyMesh.rotation.z = Math.PI / 2;
    bodyMesh.castShadow = true;
    valveAssembly.add(bodyMesh);

    // Brides d'extrémité de vanne
    const fR = pipeR * 1.8;
    const flg1 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.02, 32), material);
    flg1.rotation.z = Math.PI / 2;
    flg1.position.x = -bodyLength * 0.38;
    valveAssembly.add(flg1);

    const flg2 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.02, 32), material);
    flg2.rotation.z = Math.PI / 2;
    flg2.position.x = bodyLength * 0.38;
    valveAssembly.add(flg2);

    // 2. Chapeau de vanne (Bonnet) avec bride de chapeau boulonnée
    const bonnetFlangeGeom = new THREE.CylinderGeometry(pipeR * 1.4, pipeR * 1.4, 0.025, 24);
    const bonnetFlange = new THREE.Mesh(bonnetFlangeGeom, this.materials.valveBody);
    bonnetFlange.position.y = pipeR * 1.3;
    valveAssembly.add(bonnetFlange);

    const bonnetGeom = new THREE.CylinderGeometry(pipeR * 0.7, pipeR * 1.2, bodyLength * 0.6, 24);
    const bonnetMesh = new THREE.Mesh(bonnetGeom, this.materials.valveBody);
    bonnetMesh.position.y = pipeR * 1.3 + bodyLength * 0.3;
    bonnetMesh.castShadow = true;
    valveAssembly.add(bonnetMesh);

    // 3. Presse-étoupe et tige montante en acier inoxydable
    const stemHeight = bodyLength * 1.4;
    const stemGeom = new THREE.CylinderGeometry(pipeR * 0.22, pipeR * 0.22, stemHeight, 18);
    const stemMesh = new THREE.Mesh(stemGeom, this.materials.stainlessSteel);
    stemMesh.position.y = stemHeight / 2 + pipeR * 0.8;
    stemMesh.castShadow = true;
    valveAssembly.add(stemMesh);

    // 4. Volant de manœuvre ergonomique rouge sécurité
    const wheelR = bodyLength * 0.6;
    const wheelGeom = new THREE.TorusGeometry(wheelR, pipeR * 0.16, 16, 32);
    const wheelMesh = new THREE.Mesh(wheelGeom, this.materials.valveHandwheel);
    wheelMesh.rotation.x = Math.PI / 2;
    wheelMesh.position.y = stemHeight + pipeR * 0.8;
    wheelMesh.castShadow = true;
    valveAssembly.add(wheelMesh);

    // Moyeu et rayons métalliques
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.35, pipeR * 0.35, 0.03, 16), this.materials.valveHandwheel);
    hub.position.y = stemHeight + pipeR * 0.8;
    valveAssembly.add(hub);

    const spokeGeom = new THREE.CylinderGeometry(pipeR * 0.07, pipeR * 0.07, wheelR * 2, 10);
    const spoke1 = new THREE.Mesh(spokeGeom, this.materials.valveHandwheel);
    spoke1.rotation.z = Math.PI / 2;
    spoke1.position.y = stemHeight + pipeR * 0.8;
    const spoke2 = new THREE.Mesh(spokeGeom, this.materials.valveHandwheel);
    spoke2.rotation.x = Math.PI / 2;
    spoke2.position.y = stemHeight + pipeR * 0.8;
    valveAssembly.add(spoke1);
    valveAssembly.add(spoke2);

    // Aligner avec la direction d'écoulement
    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      const xAxis = new THREE.Vector3(1, 0, 0);
      valveAssembly.quaternion.setFromUnitVectors(xAxis, norm);
    }
    valveAssembly.position.copy(position);

    group.add(valveAssembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "vanne" };
    return group;
  }

  /**
   * Crée un cordon de soudure 3D circulaire haute précision (Weld Bead ASME B31.3)
   */
  public createWeldRingMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    location: "shop" | "field" | "golden",
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const beadRadius = Math.max(0.004, dims.odM * 0.045);

    const mat =
      location === "golden"
        ? this.materials.weldGolden
        : location === "field"
        ? this.materials.weldField
        : this.materials.weldShop;

    // 24 segments tubulaires et 36 radiaux pour un cordon net
    const geom = new THREE.TorusGeometry(pipeR * 1.012, beadRadius, 18, 36);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;

    const zAxis = new THREE.Vector3(0, 0, 1);
    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      mesh.quaternion.setFromUnitVectors(zAxis, norm);
    }
    mesh.position.copy(position);

    mesh.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "weld",
      location,
      dn,
    };

    return mesh;
  }

  /**
   * Crée un support de tuyauterie 3D MSS SP-58 (Patin acier, étrier U-bolt, massif béton et platine)
   */
  public createSupportMesh(
    support: IsoPipingSupport,
    pipePos: THREE.Vector3,
    dn: number
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const shoeHeight = Math.max(0.08, pipeR * 1.3);
    const shoeLength = Math.max(0.22, dims.odM * 1.9);

    // 1. Patin de glissement en acier (Pipe Shoe MSS SP-58 Type 39)
    const shoeGeom = new THREE.BoxGeometry(dims.odM * 1.25, shoeHeight, shoeLength);
    const shoeMesh = new THREE.Mesh(shoeGeom, this.materials.supportSteel);
    shoeMesh.position.set(pipePos.x, pipePos.y - (pipeR + shoeHeight / 2), pipePos.z);
    shoeMesh.castShadow = true;
    group.add(shoeMesh);

    // 2. Collier ou étrier U-Bolt (MSS SP-58 Type 24)
    const uboltGeom = new THREE.TorusGeometry(pipeR * 1.06, 0.008, 14, 28, Math.PI);
    const uboltMesh = new THREE.Mesh(uboltGeom, this.materials.flangeBolts);
    uboltMesh.position.set(pipePos.x, pipePos.y, pipePos.z);
    group.add(uboltMesh);

    // 3. Massif de fondation béton et montant métallique
    if (pipePos.y > 0.25) {
      const padHeight = 0.16;
      const padWidth = 0.5;
      const padMesh = this.createCivilPadMesh(new THREE.Vector3(pipePos.x, 0, pipePos.z), padWidth, padWidth, padHeight);
      group.add(padMesh);

      const columnHeight = pipePos.y - (pipeR + shoeHeight) - padHeight;
      if (columnHeight > 0.04) {
        // Profilé en I ou poteau tubulaire
        const colGeom = new THREE.BoxGeometry(0.09, columnHeight, 0.09);
        const colMesh = new THREE.Mesh(colGeom, this.materials.supportSteel);
        colMesh.position.set(pipePos.x, padHeight + columnHeight / 2, pipePos.z);
        colMesh.castShadow = true;
        group.add(colMesh);

        // Platine d'ancrage avec boulons
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.18), this.materials.supportSteel);
        basePlate.position.set(pipePos.x, padHeight + 0.008, pipePos.z);
        group.add(basePlate);
      }
    }

    group.userData = {
      isPdiEntity: true,
      entityType: "support",
      tag: support.tag,
      typeCode: support.type,
      typeLabelFr: support.comments || `Support MSS ${support.type}`,
      standard: "MSS SP-58",
      designLoadKn: support.customLoads?.fz ? Math.abs(support.customLoads.fz) : 5,
    };

    return group;
  }

  /**
   * Crée une pompe centrifuge industrielle 3D ultra-détaillée :
   * Corps à volute, buse d'aspiration & refoulement à brides boulonnées, lanterne d'accouplement,
   * moteur électrique avec ailettes de refroidissement (cooling ribs), capot ventilateur, boîte à bornes et skid acier.
   */
  public createPumpMesh(
    position: THREE.Vector3,
    orientationDeg: number,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const scale = Math.max(0.7, (dn / 100) * 0.85);

    const pumpAssembly = new THREE.Group();

    // 1. Bâti support / Skid profilé acier lourd
    const skidW = 0.7 * scale;
    const skidL = 1.4 * scale;
    const skidH = 0.12 * scale;
    const skidGeom = new THREE.BoxGeometry(skidW, skidH, skidL);
    const skidMesh = new THREE.Mesh(skidGeom, this.materials.supportSteel);
    skidMesh.position.set(0, skidH / 2, 0);
    skidMesh.castShadow = true;
    pumpAssembly.add(skidMesh);

    // Pieds d'ancrage du skid
    const boltPadGeom = new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 0.04 * scale, 12);
    const corners = [
      [-skidW * 0.42, -skidL * 0.42],
      [skidW * 0.42, -skidL * 0.42],
      [-skidW * 0.42, skidL * 0.42],
      [skidW * 0.42, skidL * 0.42],
    ];
    for (const [cx, cz] of corners) {
      const bp = new THREE.Mesh(boltPadGeom, this.materials.anchorBolts);
      bp.position.set(cx, skidH + 0.02 * scale, cz);
      pumpAssembly.add(bp);
    }

    // 2. Corps de pompe / Volute en colimaçon (Casing Volute)
    const voluteR = 0.32 * scale;
    const voluteH = 0.28 * scale;
    const voluteCenterY = skidH + voluteR + 0.05 * scale;
    const voluteCenterZ = 0.3 * scale;

    const voluteGeom = new THREE.CylinderGeometry(voluteR, voluteR * 1.08, voluteH, 36);
    const voluteMesh = new THREE.Mesh(voluteGeom, this.materials.equipmentPump);
    voluteMesh.rotation.z = Math.PI / 2;
    voluteMesh.position.set(0, voluteCenterY, voluteCenterZ);
    voluteMesh.castShadow = true;
    pumpAssembly.add(voluteMesh);

    // Flasque de fermeture de volute avec couronne de boulons
    const casingRing = new THREE.Mesh(
      new THREE.TorusGeometry(voluteR * 0.95, 0.02 * scale, 12, 32),
      this.materials.flangeBolts
    );
    casingRing.rotation.y = Math.PI / 2;
    casingRing.position.set(-voluteH / 2 - 0.01 * scale, voluteCenterY, voluteCenterZ);
    pumpAssembly.add(casingRing);

    // 3. Lanterne d'accouplement & palier de pompe (Bearing Bracket)
    const lanternL = 0.25 * scale;
    const lanternR = 0.16 * scale;
    const lanternGeom = new THREE.CylinderGeometry(lanternR * 0.9, lanternR * 1.1, lanternL, 24);
    const lanternMesh = new THREE.Mesh(lanternGeom, this.materials.valveBody);
    lanternMesh.rotation.x = Math.PI / 2;
    lanternMesh.position.set(0, voluteCenterY, voluteCenterZ - voluteH / 2 - lanternL / 2);
    lanternMesh.castShadow = true;
    pumpAssembly.add(lanternMesh);

    // 4. Moteur électrique industriel haute efficacité avec ailettes (Cooling Ribs)
    const motorR = 0.24 * scale;
    const motorL = 0.55 * scale;
    const motorZ = voluteCenterZ - voluteH / 2 - lanternL - motorL / 2;

    const motorGeom = new THREE.CylinderGeometry(motorR, motorR, motorL, 32);
    const motorMesh = new THREE.Mesh(motorGeom, this.materials.equipmentMotor);
    motorMesh.rotation.x = Math.PI / 2;
    motorMesh.position.set(0, voluteCenterY, motorZ);
    motorMesh.castShadow = true;
    pumpAssembly.add(motorMesh);

    // Ailettes longitudinales de refroidissement du moteur (8 ailettes rayonnantes)
    const ribCount = 10;
    for (let i = 0; i < ribCount; i++) {
      const ribAngle = (i / ribCount) * Math.PI * 2;
      const ribW = 0.012 * scale;
      const ribH = 0.035 * scale;
      const ribGeom = new THREE.BoxGeometry(ribW, ribH, motorL * 0.85);
      const ribMesh = new THREE.Mesh(ribGeom, this.materials.equipmentMotor);
      const rx = Math.cos(ribAngle) * (motorR + ribH / 2);
      const ry = voluteCenterY + Math.sin(ribAngle) * (motorR + ribH / 2);
      ribMesh.position.set(rx, ry, motorZ);
      ribMesh.rotation.z = ribAngle;
      pumpAssembly.add(ribMesh);
    }

    // Capot de ventilateur arrière du moteur (Fan Shroud)
    const shroudR = motorR * 1.02;
    const shroudL = 0.12 * scale;
    const shroudGeom = new THREE.CylinderGeometry(shroudR, shroudR * 0.9, shroudL, 28);
    const shroudMesh = new THREE.Mesh(shroudGeom, this.materials.valveBody);
    shroudMesh.rotation.x = Math.PI / 2;
    shroudMesh.position.set(0, voluteCenterY, motorZ - motorL / 2 - shroudL / 2);
    shroudMesh.castShadow = true;
    pumpAssembly.add(shroudMesh);

    // Boîte à bornes électrique supérieure (Terminal Box)
    const tbGeom = new THREE.BoxGeometry(0.14 * scale, 0.12 * scale, 0.16 * scale);
    const tbMesh = new THREE.Mesh(tbGeom, this.materials.valveHandwheel);
    tbMesh.position.set(motorR * 0.85, voluteCenterY + motorR * 0.85, motorZ);
    tbMesh.castShadow = true;
    pumpAssembly.add(tbMesh);

    // Anneau de levage moteur (Eyebolt)
    const eyeGeom = new THREE.TorusGeometry(0.03 * scale, 0.007 * scale, 12, 20);
    const eyeMesh = new THREE.Mesh(eyeGeom, this.materials.flangeBolts);
    eyeMesh.position.set(0, voluteCenterY + motorR + 0.04 * scale, motorZ);
    pumpAssembly.add(eyeMesh);

    // 5. Buse d'aspiration axiale (Suction Nozzle) avec bride boulonnée ASME B16.5
    const sucLength = 0.22 * scale;
    const sucGeom = new THREE.CylinderGeometry(pipeR * 1.15, pipeR * 1.15, sucLength, 32);
    const sucMesh = new THREE.Mesh(sucGeom, this.materials.equipmentPump);
    sucMesh.rotation.x = Math.PI / 2;
    sucMesh.position.set(0, voluteCenterY, voluteCenterZ + voluteH / 2 + sucLength / 2);
    sucMesh.castShadow = true;
    pumpAssembly.add(sucMesh);

    const sucFlange = this.createFlangeMesh(
      new THREE.Vector3(0, voluteCenterY, voluteCenterZ + voluteH / 2 + sucLength),
      new THREE.Vector3(0, 0, 1),
      dn,
      this.materials.equipmentPump
    );
    pumpAssembly.add(sucFlange);

    // 6. Buse de refoulement verticale (Discharge Nozzle) avec bride boulonnée
    const disLength = 0.26 * scale;
    const disGeom = new THREE.CylinderGeometry(pipeR, pipeR, disLength, 32);
    const disMesh = new THREE.Mesh(disGeom, this.materials.equipmentPump);
    disMesh.position.set(0, voluteCenterY + voluteR + disLength / 2, voluteCenterZ);
    disMesh.castShadow = true;
    pumpAssembly.add(disMesh);

    const disFlange = this.createFlangeMesh(
      new THREE.Vector3(0, voluteCenterY + voluteR + disLength, voluteCenterZ),
      new THREE.Vector3(0, 1, 0),
      dn,
      this.materials.equipmentPump
    );
    pumpAssembly.add(disFlange);

    // Massif GC sous le skid
    const pad = this.createCivilPadMesh(
      new THREE.Vector3(0, 0, 0),
      skidW * 1.25,
      skidL * 1.2,
      0.18 * scale
    );
    pumpAssembly.add(pad);

    pumpAssembly.rotation.y = (orientationDeg * Math.PI) / 180;
    pumpAssembly.position.copy(position);
    group.add(pumpAssembly);

    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "equipment",
      equipmentType: "pompe",
      label: userData.label || `Pompe DN${dn}`,
    };

    return group;
  }

  /**
   * Crée un ballon / capacité sous pression / réservoir 3D haute fidélité (ASME Sec VIII Div 1) :
   * Corps virole cylindrique, fonds bombés 2:1 ellipsoïdaux (Dished Heads), jupe de supportage avec
   * trous d'accès et goussets d'ancrage (ou berceaux Zick horizontaux), piquages à brides, trou d'homme (Manhole DN500)
   * avec potence de manutention (Davit Arm) et niveaux à glace.
   */
  public createVesselMesh(
    position: THREE.Vector3,
    orientationDeg: number,
    isVertical: boolean,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const scale = Math.max(0.85, (dn / 100) * 1.1);
    const vesselR = 0.65 * scale;
    const vesselH = 2.0 * scale;

    const vesselAssembly = new THREE.Group();

    if (isVertical) {
      // 1. Jupe de supportage (Cylindrical Support Skirt) avec couronne d'ancrage
      const skirtH = 0.65 * scale;
      const skirtGeom = new THREE.CylinderGeometry(vesselR * 1.01, vesselR * 1.04, skirtH, 48, 1, true);
      const skirtMesh = new THREE.Mesh(skirtGeom, this.materials.supportSteel);
      skirtMesh.position.set(0, skirtH / 2, 0);
      skirtMesh.castShadow = true;
      vesselAssembly.add(skirtMesh);

      // Couronne d'ancrage au sol avec goussets
      const baseRing = new THREE.Mesh(
        new THREE.CylinderGeometry(vesselR * 1.15, vesselR * 1.15, 0.03 * scale, 48),
        this.materials.supportSteel
      );
      baseRing.position.set(0, 0.015 * scale, 0);
      vesselAssembly.add(baseRing);

      // Trou d'homme d'accès jupe
      const skirtAccess = new THREE.Mesh(
        new THREE.TorusGeometry(0.18 * scale, 0.02 * scale, 12, 24),
        this.materials.flangeBolts
      );
      skirtAccess.position.set(0, skirtH * 0.5, vesselR * 1.02);
      vesselAssembly.add(skirtAccess);

      // 2. Fond inférieur ellipsoïdal 2:1
      const headBotGeom = new THREE.SphereGeometry(vesselR, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const headBot = new THREE.Mesh(headBotGeom, this.materials.equipmentVessel);
      headBot.rotation.x = Math.PI;
      headBot.position.set(0, skirtH + vesselR * 0.45, 0);
      headBot.scale.set(1, 0.5, 1); // Ratio 2:1 ellipsoïdal
      headBot.castShadow = true;
      vesselAssembly.add(headBot);

      // 3. Virole cylindrique principale (Cylindrical Shell)
      const shellGeom = new THREE.CylinderGeometry(vesselR, vesselR, vesselH, 48);
      const shellMesh = new THREE.Mesh(shellGeom, this.materials.equipmentVessel);
      shellMesh.position.set(0, skirtH + vesselR * 0.45 + vesselH / 2, 0);
      shellMesh.castShadow = true;
      shellMesh.receiveShadow = true;
      vesselAssembly.add(shellMesh);

      // 4. Fond supérieur ellipsoïdal 2:1
      const headTop = new THREE.Mesh(headBotGeom, this.materials.equipmentVessel);
      headTop.position.set(0, skirtH + vesselR * 0.45 + vesselH, 0);
      headTop.scale.set(1, 0.5, 1);
      headTop.castShadow = true;
      vesselAssembly.add(headTop);

      // 5. Trou d'homme latéral DN500 (Manhole 20") avec bride pleine et potence
      const mhY = skirtH + vesselR * 0.45 + vesselH * 0.35;
      const mhNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * scale, 0.22 * scale, 0.35 * scale, 32),
        this.materials.equipmentVessel
      );
      mhNozzle.rotation.z = Math.PI / 2;
      mhNozzle.position.set(vesselR + 0.175 * scale, mhY, 0);
      vesselAssembly.add(mhNozzle);

      const mhFlange = this.createFlangeMesh(
        new THREE.Vector3(vesselR + 0.35 * scale, mhY, 0),
        new THREE.Vector3(1, 0, 0),
        250,
        this.materials.equipmentVessel
      );
      vesselAssembly.add(mhFlange);

      // 6. Piquages de procédé à brides (Nozzles)
      // Piquage sommet (Vapeur / Gaz)
      const topNozzleY = skirtH + vesselR * 0.45 + vesselH + vesselR * 0.5;
      const topNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(pipeR, pipeR, 0.3 * scale, 24),
        this.materials.equipmentVessel
      );
      topNozzle.position.set(0, topNozzleY + 0.15 * scale, 0);
      vesselAssembly.add(topNozzle);
      const topFlange = this.createFlangeMesh(
        new THREE.Vector3(0, topNozzleY + 0.3 * scale, 0),
        new THREE.Vector3(0, 1, 0),
        dn,
        this.materials.equipmentVessel
      );
      vesselAssembly.add(topFlange);

      // Piquage d'entrée latéral
      const inNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(pipeR, pipeR, 0.35 * scale, 24),
        this.materials.equipmentVessel
      );
      inNozzle.rotation.z = -Math.PI / 2;
      inNozzle.position.set(-vesselR - 0.175 * scale, skirtH + vesselR * 0.45 + vesselH * 0.75, 0);
      vesselAssembly.add(inNozzle);
      const inFlange = this.createFlangeMesh(
        new THREE.Vector3(-vesselR - 0.35 * scale, skirtH + vesselR * 0.45 + vesselH * 0.75, 0),
        new THREE.Vector3(-1, 0, 0),
        dn,
        this.materials.equipmentVessel
      );
      vesselAssembly.add(inFlange);

      // Piquages niveau à glace (Level Gauge Bridle)
      const lgBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, vesselH * 0.5, 12),
        this.materials.equipmentSightGlass
      );
      lgBar.position.set(vesselR * 0.75, skirtH + vesselR * 0.45 + vesselH * 0.5, vesselR * 0.75);
      vesselAssembly.add(lgBar);

      // Massif béton circulaire sous la jupe
      const pad = this.createCivilPadMesh(new THREE.Vector3(0, 0, 0), vesselR * 2.5, vesselR * 2.5, 0.2 * scale);
      vesselAssembly.add(pad);
    } else {
      // RÉSERVOIR HORIZONTAL (Horizontal Pressure Drum / Bullet)
      const drumCenterY = vesselR + 0.45 * scale;
      const drumL = vesselH * 1.3;

      // 1. Virole horizontale
      const shellGeom = new THREE.CylinderGeometry(vesselR, vesselR, drumL, 48);
      const shellMesh = new THREE.Mesh(shellGeom, this.materials.equipmentVessel);
      shellMesh.rotation.z = Math.PI / 2;
      shellMesh.position.set(0, drumCenterY, 0);
      shellMesh.castShadow = true;
      vesselAssembly.add(shellMesh);

      // 2. Fonds bombés gauche et droit
      const headGeom = new THREE.SphereGeometry(vesselR, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const headLeft = new THREE.Mesh(headGeom, this.materials.equipmentVessel);
      headLeft.rotation.z = -Math.PI / 2;
      headLeft.position.set(-drumL / 2, drumCenterY, 0);
      headLeft.scale.set(0.5, 1, 1);
      headLeft.castShadow = true;
      vesselAssembly.add(headLeft);

      const headRight = new THREE.Mesh(headGeom, this.materials.equipmentVessel);
      headRight.rotation.z = Math.PI / 2;
      headRight.position.set(drumL / 2, drumCenterY, 0);
      headRight.scale.set(0.5, 1, 1);
      headRight.castShadow = true;
      vesselAssembly.add(headRight);

      // 3. Berceaux de supportage Zick (Saddle Supports)
      const saddleW = vesselR * 2.3;
      const saddleH = 0.45 * scale;
      const sadX = drumL * 0.32;

      for (const sx of [-sadX, sadX]) {
        const sadGeom = new THREE.BoxGeometry(0.2 * scale, saddleH, saddleW);
        const sadMesh = new THREE.Mesh(sadGeom, this.materials.supportSteel);
        sadMesh.position.set(sx, saddleH / 2, 0);
        sadMesh.castShadow = true;
        vesselAssembly.add(sadMesh);

        // Plaque de renfort berceau (Wear Plate)
        const wpGeom = new THREE.CylinderGeometry(vesselR * 1.02, vesselR * 1.02, 0.22 * scale, 32, 1, false, 0, Math.PI);
        const wpMesh = new THREE.Mesh(wpGeom, this.materials.supportSteel);
        wpMesh.rotation.z = Math.PI / 2;
        wpMesh.rotation.y = Math.PI / 2;
        wpMesh.position.set(sx, drumCenterY, 0);
        vesselAssembly.add(wpMesh);

        // Massif GC sous chaque berceau
        const pad = this.createCivilPadMesh(new THREE.Vector3(sx, 0, 0), 0.5 * scale, saddleW * 1.2, 0.18 * scale);
        vesselAssembly.add(pad);
      }

      // 4. Trou d'homme supérieur DN500
      const mhNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * scale, 0.22 * scale, 0.3 * scale, 32),
        this.materials.equipmentVessel
      );
      mhNozzle.position.set(0, drumCenterY + vesselR + 0.15 * scale, 0);
      vesselAssembly.add(mhNozzle);
      const mhFlange = this.createFlangeMesh(
        new THREE.Vector3(0, drumCenterY + vesselR + 0.3 * scale, 0),
        new THREE.Vector3(0, 1, 0),
        250,
        this.materials.equipmentVessel
      );
      vesselAssembly.add(mhFlange);

      // 5. Piquages entrée / sortie à brides
      const pInNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(pipeR, pipeR, 0.25 * scale, 24),
        this.materials.equipmentVessel
      );
      pInNozzle.position.set(-drumL * 0.25, drumCenterY + vesselR + 0.125 * scale, 0);
      vesselAssembly.add(pInNozzle);
      const pInFlg = this.createFlangeMesh(
        new THREE.Vector3(-drumL * 0.25, drumCenterY + vesselR + 0.25 * scale, 0),
        new THREE.Vector3(0, 1, 0),
        dn,
        this.materials.equipmentVessel
      );
      vesselAssembly.add(pInFlg);
    }

    vesselAssembly.rotation.y = (orientationDeg * Math.PI) / 180;
    vesselAssembly.position.copy(position);
    group.add(vesselAssembly);

    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "equipment",
      equipmentType: isVertical ? "ballon_vertical" : "reservoir_horizontal",
      label: userData.label || `Capacité sous pression DN${dn}`,
    };

    return group;
  }

  /**
   * Crée un échangeur de chaleur multitubulaire TEMA 3D haute fidélité :
   * Calandre principale (Shell), boîte de distribution à chapeau boulonné (Channel Head Type BEM/AES),
   * plaque tubulaire fixe avec couronne de goujons (Stationary Tube Sheet), calotte arrière flottante,
   * piquages calandre/tubes avec brides et berceaux de supportage (Saddles).
   */
  public createHeatExchangerMesh(
    position: THREE.Vector3,
    orientationDeg: number,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const scale = Math.max(0.75, (dn / 100) * 0.95);
    const shellR = 0.48 * scale;
    const shellL = 2.4 * scale;
    const centerY = shellR + 0.4 * scale;

    const hexAssembly = new THREE.Group();

    // 1. Calandre principale (Shell) en acier carbone
    const shellGeom = new THREE.CylinderGeometry(shellR, shellR, shellL, 48);
    const shellMesh = new THREE.Mesh(shellGeom, this.materials.equipmentExchanger);
    shellMesh.rotation.z = Math.PI / 2;
    shellMesh.position.set(0, centerY, 0);
    shellMesh.castShadow = true;
    hexAssembly.add(shellMesh);

    // 2. Plaque tubulaire principale (Stationary Tube Sheet Flange)
    const tsR = shellR * 1.35;
    const tsThickness = 0.08 * scale;
    const tsGeom = new THREE.CylinderGeometry(tsR, tsR, tsThickness, 48);
    const tsMesh = new THREE.Mesh(tsGeom, this.materials.carbonSteel);
    tsMesh.rotation.z = Math.PI / 2;
    tsMesh.position.set(-shellL / 2 - tsThickness / 2, centerY, 0);
    tsMesh.castShadow = true;
    hexAssembly.add(tsMesh);

    // Couronne de boulons plaque tubulaire
    const boltRing = new THREE.Mesh(
      new THREE.TorusGeometry((shellR + tsR) * 0.5, 0.015 * scale, 12, 32),
      this.materials.flangeBolts
    );
    boltRing.rotation.y = Math.PI / 2;
    boltRing.position.set(-shellL / 2 - tsThickness / 2, centerY, 0);
    hexAssembly.add(boltRing);

    // 3. Boîte de distribution avant (Front Channel Bonnet Type A/B)
    const channelL = 0.55 * scale;
    const channelGeom = new THREE.CylinderGeometry(shellR * 1.05, shellR * 1.05, channelL, 36);
    const channelMesh = new THREE.Mesh(channelGeom, this.materials.equipmentExchanger);
    channelMesh.rotation.z = Math.PI / 2;
    channelMesh.position.set(-shellL / 2 - tsThickness - channelL / 2, centerY, 0);
    channelMesh.castShadow = true;
    hexAssembly.add(channelMesh);

    // Couvercle plat boulonné de boîte (Channel Cover)
    const coverGeom = new THREE.CylinderGeometry(tsR, tsR, 0.05 * scale, 48);
    const coverMesh = new THREE.Mesh(coverGeom, this.materials.equipmentExchanger);
    coverMesh.rotation.z = Math.PI / 2;
    coverMesh.position.set(-shellL / 2 - tsThickness - channelL - 0.025 * scale, centerY, 0);
    hexAssembly.add(coverMesh);

    // 4. Calotte arrière (Rear Floating Head Cover)
    const rearCapGeom = new THREE.SphereGeometry(shellR, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    const rearCap = new THREE.Mesh(rearCapGeom, this.materials.equipmentExchanger);
    rearCap.rotation.z = Math.PI / 2;
    rearCap.position.set(shellL / 2, centerY, 0);
    rearCap.scale.set(0.6, 1, 1);
    rearCap.castShadow = true;
    hexAssembly.add(rearCap);

    // 5. Piquages de procédé calandre (Shell Nozzles) & boîte (Tube Nozzles)
    const dims = getPipeStandardDimensions(dn);
    const pR = dims.odM / 2;

    // Entrée côté calandre (Shell Inlet)
    const sIn = new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.22 * scale, 24), this.materials.equipmentExchanger);
    sIn.position.set(-shellL * 0.28, centerY + shellR + 0.11 * scale, 0);
    hexAssembly.add(sIn);
    const sInFlg = this.createFlangeMesh(
      new THREE.Vector3(-shellL * 0.28, centerY + shellR + 0.22 * scale, 0),
      new THREE.Vector3(0, 1, 0),
      dn,
      this.materials.equipmentExchanger
    );
    hexAssembly.add(sInFlg);

    // Sortie côté calandre (Shell Outlet)
    const sOut = new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.22 * scale, 24), this.materials.equipmentExchanger);
    sOut.position.set(shellL * 0.28, centerY - shellR - 0.11 * scale, 0);
    hexAssembly.add(sOut);

    // Entrée/Sortie côté tubes (Channel Tube Nozzles)
    const tIn = new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.22 * scale, 24), this.materials.equipmentExchanger);
    tIn.position.set(-shellL / 2 - channelL * 0.5, centerY + shellR + 0.11 * scale, 0);
    hexAssembly.add(tIn);
    const tInFlg = this.createFlangeMesh(
      new THREE.Vector3(-shellL / 2 - channelL * 0.5, centerY + shellR + 0.22 * scale, 0),
      new THREE.Vector3(0, 1, 0),
      dn,
      this.materials.equipmentExchanger
    );
    hexAssembly.add(tInFlg);

    // 6. Berceaux de supportage (Saddle Supports fixe et glissant)
    const sadW = shellR * 2.2;
    const sadH = 0.4 * scale;
    const sadX = shellL * 0.3;

    for (const sx of [-sadX, sadX]) {
      const sadGeom = new THREE.BoxGeometry(0.18 * scale, sadH, sadW);
      const sadMesh = new THREE.Mesh(sadGeom, this.materials.supportSteel);
      sadMesh.position.set(sx, sadH / 2, 0);
      sadMesh.castShadow = true;
      hexAssembly.add(sadMesh);

      const pad = this.createCivilPadMesh(new THREE.Vector3(sx, 0, 0), 0.45 * scale, sadW * 1.2, 0.16 * scale);
      hexAssembly.add(pad);
    }

    hexAssembly.rotation.y = (orientationDeg * Math.PI) / 180;
    hexAssembly.position.copy(position);
    group.add(hexAssembly);

    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "equipment",
      equipmentType: "echangeur",
      label: userData.label || `Échangeur TEMA DN${dn}`,
    };

    return group;
  }

  /**
   * Crée un filtre industriel en Y (Y-Strainer) haute fidélité :
   * Corps moulé avec bossage de renfort, chambre de panier filtrant à 45°, chapeau boulonné (Bolted Cover)
   * avec goujons et bouchon de purge / vidange (NPT Blow-off Drain Plug), et brides normalisées ASME B16.5.
   */
  public createFilterMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyL = Math.max(0.22, dims.odM * 3.0);

    const assembly = new THREE.Group();

    // 1. Corps droit principal
    const mainGeom = new THREE.CylinderGeometry(pipeR * 1.35, pipeR * 1.35, bodyL * 0.75, 32);
    const mainMesh = new THREE.Mesh(mainGeom, this.materials.valveBody);
    mainMesh.rotation.z = Math.PI / 2;
    mainMesh.castShadow = true;
    assembly.add(mainMesh);

    // Brides d'extrémité ASME B16.5
    const fR = pipeR * 1.85;
    const flg1 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.025, 32), material);
    flg1.rotation.z = Math.PI / 2;
    flg1.position.x = -bodyL * 0.38;
    assembly.add(flg1);

    const flg2 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.025, 32), material);
    flg2.rotation.z = Math.PI / 2;
    flg2.position.x = bodyL * 0.38;
    assembly.add(flg2);

    // 2. Branche oblique de tamis à 45° (Y-Chamber)
    const branchL = bodyL * 0.85;
    const branchR = pipeR * 1.25;
    const branchGeom = new THREE.CylinderGeometry(branchR * 0.95, branchR * 1.15, branchL, 28);
    const branchMesh = new THREE.Mesh(branchGeom, this.materials.valveBody);
    branchMesh.rotation.z = Math.PI / 4;
    branchMesh.position.set(branchL * 0.22, -branchL * 0.32, 0);
    branchMesh.castShadow = true;
    assembly.add(branchMesh);

    // 3. Couvercle boulonné de panier (Bolted Bonnet Cover)
    const capR = branchR * 1.45;
    const capThickness = 0.035;
    const capGeom = new THREE.CylinderGeometry(capR, capR, capThickness, 24);
    const capMesh = new THREE.Mesh(capGeom, this.materials.valveBody);
    capMesh.rotation.z = Math.PI / 4;
    capMesh.position.set(branchL * 0.52, -branchL * 0.62, 0);
    capMesh.castShadow = true;
    assembly.add(capMesh);

    // Couronne de goujons de fermeture
    const capBolts = new THREE.Mesh(
      new THREE.TorusGeometry(capR * 0.8, 0.008, 10, 20),
      this.materials.flangeBolts
    );
    capBolts.rotation.x = Math.PI / 2;
    capBolts.rotation.y = Math.PI / 4;
    capBolts.position.set(branchL * 0.53, -branchL * 0.63, 0);
    assembly.add(capBolts);

    // 4. Bouchon de vidange fileté en laiton (Drain Plug)
    const plugGeom = new THREE.CylinderGeometry(pipeR * 0.3, pipeR * 0.3, 0.04, 6);
    const plugMesh = new THREE.Mesh(plugGeom, this.materials.equipmentBrass);
    plugMesh.rotation.z = Math.PI / 4;
    plugMesh.position.set(branchL * 0.56, -branchL * 0.66, 0);
    assembly.add(plugMesh);

    // Flèche d'écoulement moulée sur le corps
    const arrowGeom = new THREE.ConeGeometry(pipeR * 0.25, pipeR * 0.6, 8);
    const arrowMesh = new THREE.Mesh(arrowGeom, this.materials.flangeBolts);
    arrowMesh.rotation.z = -Math.PI / 2;
    arrowMesh.position.set(0, pipeR * 1.4, 0);
    assembly.add(arrowMesh);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);
    group.add(assembly);

    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "equipment",
      equipmentType: "filtre",
      label: userData.label || `Filtre Y DN${dn}`,
    };

    return group;
  }

  /**
   * Crée une gare de racleur (Pig Launcher / Receiver Trap) haute fidélité :
   * Baril surdimensionné (Major Barrel), réduction excentrique/concnétrique vers la ligne de procédé (Minor Barrel),
   * porte à ouverture rapide (Quick Opening Closure QOC avec poignée de verrouillage et charnière),
   * piquages de kicker / bypass, manomètre et purge, et berceaux d'ancrage avec massif GC.
   */
  public createPigTrapMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    isLauncher: boolean,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const barrelR = pipeR * 1.65;
    const trapLength = Math.max(1.6, dims.odM * 12);
    const scale = Math.max(0.8, dn / 100);

    const assembly = new THREE.Group();

    // 1. Baril principal surdimensionné (Major Barrel)
    const majorL = trapLength * 0.6;
    const barrelGeom = new THREE.CylinderGeometry(barrelR, barrelR, majorL, 36);
    const barrelMesh = new THREE.Mesh(barrelGeom, this.materials.carbonSteel);
    barrelMesh.rotation.z = Math.PI / 2;
    barrelMesh.position.set(trapLength * 0.2, 0, 0);
    barrelMesh.castShadow = true;
    assembly.add(barrelMesh);

    // 2. Réduction conique vers le diamètre nominal (Eccentric/Concentric Reducer)
    const redL = trapLength * 0.25;
    const redGeom = new THREE.CylinderGeometry(barrelR, pipeR, redL, 32);
    const redMesh = new THREE.Mesh(redGeom, this.materials.carbonSteel);
    redMesh.rotation.z = Math.PI / 2;
    redMesh.position.set(-trapLength * 0.225, 0, 0);
    redMesh.castShadow = true;
    assembly.add(redMesh);

    // 3. Tronçon de raccordement nominal (Minor Barrel Neck)
    const neckL = trapLength * 0.15;
    const neckGeom = new THREE.CylinderGeometry(pipeR, pipeR, neckL, 32);
    const neckMesh = new THREE.Mesh(neckGeom, this.materials.carbonSteel);
    neckMesh.rotation.z = Math.PI / 2;
    neckMesh.position.set(-trapLength * 0.425, 0, 0);
    assembly.add(neckMesh);

    // Bride de raccordement procédé
    const inFlg = this.createFlangeMesh(
      new THREE.Vector3(-trapLength * 0.5, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      dn,
      this.materials.carbonSteel
    );
    assembly.add(inFlg);

    // 4. Porte à ouverture rapide (Quick Opening Closure QOC)
    const qocR = barrelR * 1.25;
    const qocDoor = new THREE.Mesh(
      new THREE.CylinderGeometry(qocR, qocR, 0.12 * scale, 36),
      this.materials.flangeBolts
    );
    qocDoor.rotation.z = Math.PI / 2;
    qocDoor.position.set(trapLength * 0.5 + 0.06 * scale, 0, 0);
    qocDoor.castShadow = true;
    assembly.add(qocDoor);

    // Poignée de verrouillage et charnière QOC
    const handleGeom = new THREE.TorusGeometry(0.12 * scale, 0.02 * scale, 12, 24, Math.PI);
    const handleMesh = new THREE.Mesh(handleGeom, this.materials.valveHandwheel);
    handleMesh.rotation.y = Math.PI / 2;
    handleMesh.position.set(trapLength * 0.5 + 0.14 * scale, 0, 0);
    assembly.add(handleMesh);

    // 5. Piquages Kicker / Bypass et Évent / Purge
    const kickNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(pipeR * 0.6, pipeR * 0.6, 0.3 * scale, 20),
      this.materials.carbonSteel
    );
    kickNozzle.position.set(trapLength * 0.3, barrelR + 0.15 * scale, 0);
    assembly.add(kickNozzle);

    const kickFlg = this.createFlangeMesh(
      new THREE.Vector3(trapLength * 0.3, barrelR + 0.3 * scale, 0),
      new THREE.Vector3(0, 1, 0),
      Math.round(dn * 0.5),
      this.materials.carbonSteel
    );
    assembly.add(kickFlg);

    // Piquage manomètre avec vanne pointeau
    const pgNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.15 * scale, 12),
      this.materials.stainlessSteel
    );
    pgNozzle.position.set(trapLength * 0.1, barrelR + 0.075 * scale, 0);
    assembly.add(pgNozzle);

    // 6. Berceaux de supportage métallique et massifs GC
    const sadW = barrelR * 2.2;
    const sadH = 0.35 * scale;
    for (const sx of [trapLength * 0.05, trapLength * 0.35]) {
      const sadMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.15 * scale, sadH, sadW),
        this.materials.supportSteel
      );
      sadMesh.position.set(sx, -barrelR - sadH / 2 + 0.05 * scale, 0);
      sadMesh.castShadow = true;
      assembly.add(sadMesh);

      const pad = this.createCivilPadMesh(
        new THREE.Vector3(sx, -barrelR - sadH, 0),
        0.4 * scale,
        sadW * 1.25,
        0.16 * scale
      );
      assembly.add(pad);
    }

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);
    group.add(assembly);

    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "equipment",
      equipmentType: isLauncher ? "gare_depart" : "gare_arrivee",
      label: userData.label || (isLauncher ? `Gare départ racleur DN${dn}` : `Gare arrivée racleur DN${dn}`),
    };

    return group;
  }

  /**
   * Crée un massif ou dalle de Génie Civil (GC) en béton armé avec chanfrein 45°,
   * platines métalliques intégrées et tiges d'ancrage galvanisées.
   */
  public createCivilPadMesh(
    position: THREE.Vector3,
    width = 1.0,
    length = 1.0,
    height = 0.2,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();

    // Bloc béton avec chanfrein supérieur
    const geom = new THREE.BoxGeometry(width, height, length);
    const mesh = new THREE.Mesh(geom, this.materials.concretePad);
    mesh.position.set(0, height / 2, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);

    // Liseré chanfrein technique
    const chamferGeom = new THREE.BoxGeometry(width * 1.002, 0.015, length * 1.002);
    const chamferMesh = new THREE.Mesh(chamferGeom, this.materials.supportSteel);
    chamferMesh.position.set(0, height - 0.008, 0);
    group.add(chamferMesh);

    group.position.set(position.x, position.y, position.z);

    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "genie_civil",
      label: userData.label || "Massif béton Génie Civil",
    };

    return group;
  }

  /**
   * Crée un clapet anti-retour 3D (Check Valve ASME B16.34 / API 6D)
   * Corps renflé asymétrique, bossage d'axe de battant supérieur, brides boulonnées et flèche de sens d'écoulement.
   */
  public createCheckValveMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyL = Math.max(0.16, dims.odM * 2.4);

    const assembly = new THREE.Group();

    // 1. Corps principal moulé à profil ventru
    const bodyGeom = new THREE.CylinderGeometry(pipeR * 1.45, pipeR * 1.45, bodyL * 0.72, 32);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.materials.valveBody);
    bodyMesh.rotation.z = Math.PI / 2;
    bodyMesh.castShadow = true;
    assembly.add(bodyMesh);

    // Brides d'extrémité
    const fR = pipeR * 1.8;
    const flg1 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.022, 32), material);
    flg1.rotation.z = Math.PI / 2;
    flg1.position.x = -bodyL * 0.36;
    assembly.add(flg1);

    const flg2 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.022, 32), material);
    flg2.rotation.z = Math.PI / 2;
    flg2.position.x = bodyL * 0.36;
    assembly.add(flg2);

    // 2. Chapeau supérieur d'inspection du battant (Hinge Pin Cover)
    const capGeom = new THREE.CylinderGeometry(pipeR * 0.9, pipeR * 1.1, bodyL * 0.35, 24);
    const capMesh = new THREE.Mesh(capGeom, this.materials.valveBody);
    capMesh.position.y = pipeR * 1.25;
    capMesh.castShadow = true;
    assembly.add(capMesh);

    const capCover = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.15, pipeR * 1.15, 0.02, 24), this.materials.flangeBolts);
    capCover.position.y = pipeR * 1.25 + bodyL * 0.18;
    assembly.add(capCover);

    // Flèche indicatrice de sens d'écoulement gravée
    const arrowGeom = new THREE.ConeGeometry(pipeR * 0.35, bodyL * 0.25, 8);
    const arrowMesh = new THREE.Mesh(arrowGeom, this.materials.equipmentYellowLever);
    arrowMesh.rotation.z = -Math.PI / 2;
    arrowMesh.position.set(0, 0, pipeR * 1.46);
    assembly.add(arrowMesh);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "clapet", dn };
    return group;
  }

  /**
   * Crée une soupape de sécurité 3D haute pression (PSV API 526)
   * Corps d'angle à 90°, lanterne à ressort à boudin visible (Spring Cage), chapeau et buse de décharge latérale.
   */
  public createSafetyValveMesh(
    position: THREE.Vector3,
    inflowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const valveH = Math.max(0.35, dims.odM * 4.2);

    const assembly = new THREE.Group();

    // 1. Corps inférieur d'angle
    const baseGeom = new THREE.CylinderGeometry(pipeR * 1.35, pipeR * 1.5, pipeR * 2.2, 28);
    const baseMesh = new THREE.Mesh(baseGeom, this.materials.valveBody);
    baseMesh.position.y = pipeR * 1.1;
    baseMesh.castShadow = true;
    assembly.add(baseMesh);

    // Bride d'entrée inférieure
    const inFlg = this.createFlangeMesh(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), dn, material);
    assembly.add(inFlg);

    // Buse et bride d'échappement / décharge latérale (Angle discharge)
    const dischargeDn = Math.round(dn * 1.5);
    const outDims = getPipeStandardDimensions(dischargeDn);
    const outR = outDims.odM / 2;
    const outL = pipeR * 2.8;

    const outNozzle = new THREE.Mesh(new THREE.CylinderGeometry(outR, outR, outL, 24), this.materials.valveBody);
    outNozzle.rotation.z = -Math.PI / 2;
    outNozzle.position.set(outL / 2, pipeR * 1.1, 0);
    assembly.add(outNozzle);

    const outFlg = this.createFlangeMesh(new THREE.Vector3(outL, pipeR * 1.1, 0), new THREE.Vector3(1, 0, 0), dischargeDn, material);
    assembly.add(outFlg);

    // 2. Cage de ressort (Spring Bonnet) avec colonnettes
    const cageH = valveH * 0.5;
    const cageY = pipeR * 2.2 + cageH / 2;
    const cageR = pipeR * 1.25;

    // Colonnettes de cage
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, cageH, 12), this.materials.carbonSteel);
      col.position.set(Math.cos(angle) * cageR * 0.9, cageY, Math.sin(angle) * cageR * 0.9);
      assembly.add(col);
    }

    // Ressort hélicoïdal à boudin au centre
    const springGeom = new THREE.CylinderGeometry(cageR * 0.65, cageR * 0.65, cageH * 0.9, 16);
    const springMesh = new THREE.Mesh(springGeom, this.materials.valveHandwheel);
    springMesh.position.set(0, cageY, 0);
    assembly.add(springMesh);

    // 3. Chapeau supérieur et levier de test de décharge manuel
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.8, pipeR * 1.1, pipeR * 1.5, 24), this.materials.valveBody);
    topCap.position.y = pipeR * 2.2 + cageH + pipeR * 0.75;
    assembly.add(topCap);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, valveH * 0.35, 10), this.materials.equipmentYellowLever);
    lever.rotation.z = Math.PI / 3;
    lever.position.set(valveH * 0.1, pipeR * 2.2 + cageH + pipeR * 1.2, 0);
    assembly.add(lever);

    const norm = inflowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "soupape", dn };
    return group;
  }

  /**
   * Crée une vanne à boisseau sphérique 3D (Ball Valve API 6D) avec levier quart de tour jaune
   */
  public createBallValveMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyL = Math.max(0.14, dims.odM * 2.2);

    const assembly = new THREE.Group();

    // 1. Corps central sphérique monobloc / 3 pièces
    const ballSphere = new THREE.Mesh(new THREE.SphereGeometry(pipeR * 1.45, 32, 24), this.materials.valveBody);
    ballSphere.castShadow = true;
    assembly.add(ballSphere);

    // Brides d'extrémité
    const fR = pipeR * 1.8;
    const flg1 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.022, 32), material);
    flg1.rotation.z = Math.PI / 2;
    flg1.position.x = -bodyL * 0.38;
    assembly.add(flg1);

    const flg2 = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, 0.022, 32), material);
    flg2.rotation.z = Math.PI / 2;
    flg2.position.x = bodyL * 0.38;
    assembly.add(flg2);

    // 2. Tige d'entraînement et presse-étoupe
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.3, pipeR * 0.3, pipeR * 1.2, 16), this.materials.stainlessSteel);
    stem.position.y = pipeR * 1.5;
    assembly.add(stem);

    // 3. Levier ergonomique quart de tour jaune/ambre API 6D
    const leverL = Math.max(0.2, bodyL * 1.4);
    const leverGeom = new THREE.BoxGeometry(leverL, 0.015, pipeR * 0.5);
    const leverMesh = new THREE.Mesh(leverGeom, this.materials.equipmentYellowLever);
    leverMesh.position.set(leverL / 2 - pipeR * 0.3, pipeR * 2.1, 0);
    leverMesh.castShadow = true;
    assembly.add(leverMesh);

    // Poignée caoutchouc antidérapante
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.28, pipeR * 0.28, leverL * 0.45, 16), this.materials.gasket);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(leverL * 0.72, pipeR * 2.1, 0);
    assembly.add(grip);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "vanne_boisseau", dn };
    return group;
  }

  /**
   * Crée une vanne papillon 3D (Butterfly Valve API 609 Type Lug/Wafer) avec levier bleu à gâchette
   */
  public createButterflyValveMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyW = Math.max(0.045, dims.odM * 0.45); // Étroit entre-brides

    const assembly = new THREE.Group();

    // Corps wafer avec oreilles de centrage (Lug holes)
    const bodyGeom = new THREE.CylinderGeometry(pipeR * 1.6, pipeR * 1.6, bodyW, 36);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.materials.valveBody);
    bodyMesh.rotation.z = Math.PI / 2;
    bodyMesh.castShadow = true;
    assembly.add(bodyMesh);

    // Disque papillon intérieur orientable inox
    const discGeom = new THREE.CylinderGeometry(pipeR * 0.92, pipeR * 0.92, 0.012, 28);
    const discMesh = new THREE.Mesh(discGeom, this.materials.stainlessSteel);
    discMesh.rotation.y = Math.PI / 6; // Légèrement ouvert pour le réalisme 3D
    assembly.add(discMesh);

    // Tige et presse-étoupe
    const stemH = pipeR * 1.6;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.22, pipeR * 0.22, stemH, 16), this.materials.stainlessSteel);
    stem.position.y = pipeR * 1.5;
    assembly.add(stem);

    // Platine crantée de verrouillage (Notched Throttling Plate)
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.8, pipeR * 0.8, 0.01, 24), this.materials.supportSteel);
    plate.position.y = pipeR * 1.5 + stemH / 2;
    assembly.add(plate);

    // Levier bleu sécurité avec gâchette
    const leverL = Math.max(0.22, dims.odM * 2.0);
    const leverMesh = new THREE.Mesh(new THREE.BoxGeometry(leverL, 0.018, pipeR * 0.45), this.materials.equipmentBlueLever);
    leverMesh.position.set(leverL / 2, pipeR * 1.5 + stemH / 2 + 0.015, 0);
    assembly.add(leverMesh);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "vanne_papillon", dn };
    return group;
  }

  /**
   * Crée un robinet pointeau forgé 3D (Needle Valve 6000#)
   */
  public createNeedleValveMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyL = Math.max(0.09, dims.odM * 1.8);

    const assembly = new THREE.Group();

    // Corps forgé hexagonal
    const bodyGeom = new THREE.CylinderGeometry(pipeR * 1.25, pipeR * 1.25, bodyL, 6);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.materials.stainlessSteel);
    bodyMesh.rotation.z = Math.PI / 2;
    assembly.add(bodyMesh);

    // Tige filetée fine
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.2, pipeR * 0.2, pipeR * 1.8, 12), this.materials.stainlessSteel);
    stem.position.y = pipeR * 1.2;
    assembly.add(stem);

    // Poignée barrette en T (T-Bar Handle)
    const tbar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, pipeR * 2.2, 12), this.materials.valveHandwheel);
    tbar.rotation.z = Math.PI / 2;
    tbar.position.y = pipeR * 2.1;
    assembly.add(tbar);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "robinet_pointeau", dn };
    return group;
  }

  /**
   * Crée un réducteur concentrique ou excentrique 3D (ASME B16.9)
   */
  public createReducerMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dnLarge: number,
    dnSmall: number,
    isEccentric = false,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dimsL = getPipeStandardDimensions(dnLarge);
    const dimsS = getPipeStandardDimensions(dnSmall);
    const rL = dimsL.odM / 2;
    const rS = dimsS.odM / 2;
    const length = Math.max(0.12, (dimsL.odM - dimsS.odM) * 2.5 + 0.06);

    const assembly = new THREE.Group();

    // Cône de transition
    const coneGeom = new THREE.CylinderGeometry(rS, rL, length, 48);
    const coneMesh = new THREE.Mesh(coneGeom, material);
    coneMesh.rotation.z = Math.PI / 2;

    if (isEccentric) {
      // Fond plat aligné sur la génératrice basse (BOP Flat On Bottom)
      coneMesh.position.y = (rL - rS) / 2;
    }

    coneMesh.castShadow = true;
    coneMesh.receiveShadow = true;
    assembly.add(coneMesh);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = {
      ...userData,
      isPdiEntity: true,
      entityType: "fitting",
      fittingType: isEccentric ? "reduction_excentrique" : "reduction_concentrique",
      dnLarge,
      dnSmall,
    };
    return group;
  }

  /**
   * Crée un manomètre industriel de pression 3D (Pressure Gauge PI)
   * Cadran blanc gradué haute netteté, aiguille indicatrice rouge, vitre de protection,
   * siphon queue de cochon / col de cygne et robinet pointeau d'isolement.
   */
  public createPressureGaugeMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const gaugeR = 0.065; // Diamètre cadran 100mm standard

    const assembly = new THREE.Group();

    // 1. Piquage weldolet / bossage fileté sur la génératrice
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.045, 16), this.materials.stainlessSteel);
    nozzle.position.y = pipeR + 0.022;
    assembly.add(nozzle);

    // 2. Robinet pointeau d'isolement manométrique
    const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6), this.materials.stainlessSteel);
    valveBody.position.y = pipeR + 0.065;
    assembly.add(valveBody);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.035, 8), this.materials.valveHandwheel);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, pipeR + 0.065, 0.018);
    assembly.add(handle);

    // 3. Tube de raccordement / Siphon en spirale
    const siphonH = 0.07;
    const siphon = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, siphonH, 12), this.materials.copperBrass);
    siphon.position.y = pipeR + 0.085 + siphonH / 2;
    assembly.add(siphon);

    const gaugeCenterY = pipeR + 0.085 + siphonH + gaugeR;

    // 4. Boîtier de manomètre en inox poli
    const caseGeom = new THREE.CylinderGeometry(gaugeR, gaugeR, 0.035, 36);
    const caseMesh = new THREE.Mesh(caseGeom, this.materials.stainlessSteel);
    caseMesh.rotation.x = Math.PI / 2;
    caseMesh.position.set(0, gaugeCenterY, 0);
    caseMesh.castShadow = true;
    assembly.add(caseMesh);

    // 5. Cadran blanc émaillé
    const dialGeom = new THREE.CircleGeometry(gaugeR * 0.9, 32);
    const dialMesh = new THREE.Mesh(dialGeom, this.materials.gaugeDial);
    dialMesh.position.set(0, gaugeCenterY, 0.018);
    assembly.add(dialMesh);

    // 6. Aiguille indicatrice rouge
    const needleGeom = new THREE.BoxGeometry(0.003, gaugeR * 0.72, 0.002);
    const needleMesh = new THREE.Mesh(needleGeom, this.materials.gaugeNeedle);
    needleMesh.position.set(0, gaugeCenterY + gaugeR * 0.32, 0.02);
    needleMesh.rotation.z = -Math.PI / 5;
    assembly.add(needleMesh);

    // 7. Vitre transparente de protection
    const glassGeom = new THREE.CircleGeometry(gaugeR * 0.94, 32);
    const glassMesh = new THREE.Mesh(glassGeom, this.materials.equipmentSightGlass);
    glassMesh.position.set(0, gaugeCenterY, 0.022);
    assembly.add(glassMesh);

    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "instrument", instrumentType: "manometre", label: "Manomètre PI" };
    return group;
  }

  /**
   * Crée un thermomètre industriel avec doigt de gant 3D (Thermowell & Temperature Gauge TI)
   */
  public createThermometerMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const dialR = 0.055;

    const assembly = new THREE.Group();

    // Doigt de gant traversant
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, pipeR * 2.2, 16), this.materials.stainlessSteel);
    well.position.y = pipeR * 0.4;
    assembly.add(well);

    const headY = pipeR + 0.12;

    // Boîtier orientable
    const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(dialR, dialR, 0.03, 32), this.materials.stainlessSteel);
    caseMesh.rotation.x = Math.PI / 2;
    caseMesh.position.set(0, headY, 0);
    assembly.add(caseMesh);

    // Cadran et aiguille
    const dialMesh = new THREE.Mesh(new THREE.CircleGeometry(dialR * 0.9, 28), this.materials.gaugeDial);
    dialMesh.position.set(0, headY, 0.016);
    assembly.add(dialMesh);

    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.0025, dialR * 0.7, 0.002), this.materials.gaugeNeedle);
    needle.position.set(0, headY + dialR * 0.3, 0.018);
    assembly.add(needle);

    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "instrument", instrumentType: "thermometre", label: "Thermomètre TI" };
    return group;
  }

  /**
   * Crée un diaphragme de mesure ou débitmètre 3D (Orifice Flange Plate ASME MFC-3M)
   * Brides porte-diaphragme avec prises de pression d'angle et transmetteur DP.
   */
  public createFlowmeterOrificeMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const fR = pipeR * 1.9;

    const assembly = new THREE.Group();

    // 2 brides porte-diaphragme rapprochées
    const flg1 = this.createFlangeMesh(new THREE.Vector3(-0.03, 0, 0), new THREE.Vector3(-1, 0, 0), dn, material);
    const flg2 = this.createFlangeMesh(new THREE.Vector3(0.03, 0, 0), new THREE.Vector3(1, 0, 0), dn, material);
    assembly.add(flg1);
    assembly.add(flg2);

    // Plaque diaphragme intercalée avec languette d'identification
    const tabGeom = new THREE.BoxGeometry(0.008, pipeR * 2.8, 0.02);
    const tabMesh = new THREE.Mesh(tabGeom, this.materials.stainlessSteel);
    tabMesh.position.set(0, pipeR * 1.4, 0);
    assembly.add(tabMesh);

    // Transmetteur de débit différentiel (DP Flow Transmitter)
    const transBox = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.09), this.materials.equipmentMotor);
    transBox.position.set(0, pipeR * 2.4, 0);
    assembly.add(transBox);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "diaphragme", dn };
    return group;
  }

  /**
   * Crée un purgeur de condensat 3D (Steam Trap)
   */
  public createSteamTrapMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyL = Math.max(0.12, dims.odM * 1.6);

    const assembly = new THREE.Group();

    // Capsule thermodynamique à disque / cloche inversée
    const domeGeom = new THREE.SphereGeometry(pipeR * 1.3, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeom, this.materials.stainlessSteel);
    domeMesh.position.y = pipeR * 0.3;
    assembly.add(domeMesh);

    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.3, pipeR * 1.3, bodyL * 0.4, 24), this.materials.valveBody);
    baseMesh.position.y = -bodyL * 0.15;
    assembly.add(baseMesh);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "purge", dn };
    return group;
  }

  /**
   * Crée une bride pleine 3D (Blind Flange ASME B16.5)
   */
  public createBlindFlangeMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const flangeR = pipeR * 1.85;
    const thickness = Math.max(0.024, dims.odM * 0.28);

    const assembly = new THREE.Group();

    // Disque plein massif sans alésage
    const discMesh = new THREE.Mesh(new THREE.CylinderGeometry(flangeR, flangeR, thickness, 48), material);
    discMesh.castShadow = true;
    assembly.add(discMesh);

    // Poignée de levage / manutention pour gros diamètres
    if (dn >= 150) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 10, 20, Math.PI), this.materials.flangeBolts);
      handle.position.set(0, thickness / 2 + 0.035, 0);
      assembly.add(handle);
    }

    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "bride_pleine", dn };
    return group;
  }

  /**
   * Crée un joint monobloc isolant 3D (JMI / Monolithic Insulating Joint)
   * Protection cathodique haute tension avec bague centrale diélectrique et manchons en résine.
   */
  public createInsulatingJointMesh(
    position: THREE.Vector3,
    flowDir: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const bodyL = Math.max(0.24, dims.odM * 2.8);

    const assembly = new THREE.Group();

    // Corps forgé externe renflé
    const bodyGeom = new THREE.CylinderGeometry(pipeR * 1.45, pipeR * 1.45, bodyL * 0.65, 36);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.materials.carbonSteel);
    bodyMesh.rotation.z = Math.PI / 2;
    assembly.add(bodyMesh);

    // Bague centrale diélectrique jaune/orange sécurité
    const ringGeom = new THREE.CylinderGeometry(pipeR * 1.48, pipeR * 1.48, bodyL * 0.12, 36);
    const ringMesh = new THREE.Mesh(ringGeom, this.materials.insulationOrange);
    ringMesh.rotation.z = Math.PI / 2;
    assembly.add(ringMesh);

    // Embouts soudés chanfreinés
    const end1 = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR * 1.25, bodyL * 0.18, 32), material);
    end1.rotation.z = Math.PI / 2;
    end1.position.x = -bodyL * 0.41;
    assembly.add(end1);

    const end2 = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.25, pipeR, bodyL * 0.18, 32), material);
    end2.rotation.z = Math.PI / 2;
    end2.position.x = bodyL * 0.41;
    assembly.add(end2);

    const norm = flowDir.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "jmi", dn };
    return group;
  }

  /**
   * Crée un fond bombé ou cap de fermeture 3D (Pipe Cap ASME B16.9)
   */
  public createPipeCapMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;

    const assembly = new THREE.Group();
    const capGeom = new THREE.SphereGeometry(pipeR, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMesh = new THREE.Mesh(capGeom, material);
    capMesh.scale.set(1, 0.6, 1);
    assembly.add(capMesh);

    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "fond_bombe", dn };
    return group;
  }

  /**
   * Crée une purge ou évent de ligne 3D (Drain / Vent Assembly)
   */
  public createVentDrainMesh(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    dn: number,
    material: THREE.Material,
    userData: Record<string, any> = {}
  ): THREE.Object3D {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(dn);
    const pipeR = dims.odM / 2;
    const branchR = Math.max(0.015, pipeR * 0.35);

    const assembly = new THREE.Group();

    // Tube vertical de purge / évent
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(branchR, branchR, pipeR * 1.6, 16), material);
    pipe.position.y = pipeR * 0.8;
    assembly.add(pipe);

    // Petit robinet d'isolement
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(branchR * 1.5, branchR * 1.5, branchR * 2.2, 6), this.materials.stainlessSteel);
    valve.position.y = pipeR * 1.6 + branchR;
    assembly.add(valve);

    const lever = new THREE.Mesh(new THREE.BoxGeometry(branchR * 3.5, 0.005, 0.01), this.materials.equipmentYellowLever);
    lever.position.set(branchR * 1.2, pipeR * 1.6 + branchR * 1.8, 0);
    assembly.add(lever);

    // Bouchon borgne fileté de sécurité (Bull Plug)
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(branchR * 1.2, branchR * 1.2, branchR * 1.2, 6), this.materials.flangeBolts);
    plug.position.y = pipeR * 1.6 + branchR * 2.8;
    assembly.add(plug);

    const norm = normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    }
    assembly.position.copy(position);

    group.add(assembly);
    group.userData = { ...userData, isPdiEntity: true, entityType: "fitting", fittingType: "purge", dn };
    return group;
  }

  /**
   * Crée un sprite de texte 3D haute lisibilité pour les annotations d'enveloppe et traversées
   */
  public createBillboardTextSprite(
    text: string,
    subText?: string,
    bgColor: string = "rgba(10, 15, 24, 0.88)",
    textColor: string = "#38bdf8",
    borderColor: string = "#0284c7"
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = bgColor;
      if (ctx.roundRect) ctx.roundRect(4, 4, 376, 88, 12);
      else ctx.fillRect(4, 4, 376, 88);
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = borderColor;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = "bold 22px 'Space Grotesk', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 192, subText ? 34 : 48);

      if (subText) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 15px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillText(subText, 192, 64);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  /**
   * Crée la projection tridimensionnelle solide et structurée d'un Volume / Skid industriel ou Chambre Technique
   * Modélise les parois transparentes, l'ossature métallique IPE, le caillebotis de sol, les poteaux cornières et les repères
   */
  public createVolumeEnvelopeMesh(
    env: {
      length: number;
      width: number;
      height: number;
      x: number;
      y: number;
      z: number;
      preset?: string;
      active?: boolean;
    },
    options: {
      showSolidWalls?: boolean;
      wireframe?: boolean;
      opacity?: number;
    } = {}
  ): THREE.Group {
    const root = new THREE.Group();

    const len = Math.max(0.2, env.length);   // Axe X (Longueur)
    const wid = Math.max(0.2, env.width);    // Axe Y CAD -> Axe Z Three.js (Largeur)
    const hgt = Math.max(0.2, env.height);   // Axe Z CAD -> Axe Y Three.js (Hauteur d'extrusion)

    // Centre Three.js (X = x + len/2, Y = z + hgt/2, Z = y + wid/2)
    const cx = env.x + len / 2;
    const cy = env.z + hgt / 2;
    const cz = env.y + wid / 2;

    const isSkid = !env.preset || env.preset.includes("skid") || env.preset === "custom";
    const isRoom = env.preset?.includes("local") || env.preset?.includes("chambre") || env.preset?.includes("bureau");

    // 1. Boîte volumétrique principale semi-transparente (Confinement d'espace)
    const boxGeom = new THREE.BoxGeometry(len, hgt, wid);
    const wallMat = options.showSolidWalls ? this.materials.volumeWallSolid : this.materials.volumeWallGlass;
    const boxMesh = new THREE.Mesh(boxGeom, wallMat);
    boxMesh.position.set(cx, cy, cz);
    boxMesh.userData = {
      isPdiEntity: true,
      entityType: "volume_envelope",
      label: isRoom ? "Chambre Technique (Local Clôturé)" : "Châssis & Enveloppe Skid Industriel",
      preset: env.preset || "skid",
      dimensions: `${len.toFixed(2)}m × ${wid.toFixed(2)}m × H=${hgt.toFixed(2)}m`,
      origin: `X0=${env.x.toFixed(2)}m, Y0=${env.y.toFixed(2)}m, Z0=${env.z.toFixed(2)}m`,
    };
    root.add(boxMesh);

    // 2. Arêtes filaires lumineuses d'extrusion (Bordures de volume)
    const edgesGeom = new THREE.EdgesGeometry(boxGeom);
    const edgesLine = new THREE.LineSegments(edgesGeom, this.materials.volumeEdgeLine);
    edgesLine.position.set(cx, cy, cz);
    root.add(edgesLine);

    // 3. Structure physique selon la nature du volume (Châssis Skid Métallique ou Génie Civil)
    if (isSkid) {
      // Structure métallique Skid : Longérons et Traverses en profilés IPE (Acier structurel)
      const beamHeight = Math.min(0.18, Math.max(0.08, len * 0.025));
      const beamWidth = beamHeight * 0.55;
      const baseElevation = env.z + beamHeight / 2;

      // Longérons périphériques X (Bas Sud et Bas Nord)
      const xBeamGeom = new THREE.BoxGeometry(len, beamHeight, beamWidth);
      const xBeamSud = new THREE.Mesh(xBeamGeom, this.materials.skidSteelBeam);
      xBeamSud.position.set(cx, baseElevation, env.y + beamWidth / 2);
      xBeamSud.castShadow = true;
      root.add(xBeamSud);

      const xBeamNord = new THREE.Mesh(xBeamGeom, this.materials.skidSteelBeam);
      xBeamNord.position.set(cx, baseElevation, env.y + wid - beamWidth / 2);
      xBeamNord.castShadow = true;
      root.add(xBeamNord);

      // Traverses périphériques Z (Bas Ouest et Bas Est)
      const zBeamGeom = new THREE.BoxGeometry(beamWidth, beamHeight, wid);
      const zBeamOuest = new THREE.Mesh(zBeamGeom, this.materials.skidSteelBeam);
      zBeamOuest.position.set(env.x + beamWidth / 2, baseElevation, cz);
      zBeamOuest.castShadow = true;
      root.add(zBeamOuest);

      const zBeamEst = new THREE.Mesh(zBeamGeom, this.materials.skidSteelBeam);
      zBeamEst.position.set(env.x + len - beamWidth / 2, baseElevation, cz);
      zBeamEst.castShadow = true;
      root.add(zBeamEst);

      // Traverses intermédiaires de renfort sous appareils et tuyauterie
      const crossBeamCount = Math.max(1, Math.floor(len / 1.6));
      for (let i = 1; i <= crossBeamCount; i++) {
        const xPos = env.x + (i * len) / (crossBeamCount + 1);
        const crossBeam = new THREE.Mesh(zBeamGeom, this.materials.skidSteelBeam);
        crossBeam.position.set(xPos, baseElevation, cz);
        crossBeam.castShadow = true;
        root.add(crossBeam);
      }

      // Poteaux d'angle verticaux (Cornières / Montants de structure Skid)
      const postGeom = new THREE.BoxGeometry(beamWidth * 1.1, hgt, beamWidth * 1.1);
      const cornerOffsets = [
        [env.x + beamWidth / 2, env.y + beamWidth / 2],
        [env.x + len - beamWidth / 2, env.y + beamWidth / 2],
        [env.x + beamWidth / 2, env.y + wid - beamWidth / 2],
        [env.x + len - beamWidth / 2, env.y + wid - beamWidth / 2],
      ];

      cornerOffsets.forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeom, this.materials.skidSteelBeam);
        post.position.set(px, cy, pz);
        post.castShadow = true;
        root.add(post);

        // Oreille de levage / Pad eye au sommet de chaque poteau pour manutention Skid
        const eyeGeom = new THREE.TorusGeometry(0.045, 0.015, 12, 24);
        const eyeMesh = new THREE.Mesh(eyeGeom, this.materials.equipmentBrass);
        eyeMesh.position.set(px, env.z + hgt + 0.04, pz);
        eyeMesh.rotation.y = Math.PI / 4;
        root.add(eyeMesh);
      });

      // Cadre supérieur de couronnement Skid
      const topElevation = env.z + hgt - beamHeight / 2;
      const topXSud = new THREE.Mesh(xBeamGeom, this.materials.skidSteelBeam);
      topXSud.position.set(cx, topElevation, env.y + beamWidth / 2);
      root.add(topXSud);

      const topXNord = new THREE.Mesh(xBeamGeom, this.materials.skidSteelBeam);
      topXNord.position.set(cx, topElevation, env.y + wid - beamWidth / 2);
      root.add(topXNord);

      const topZOuest = new THREE.Mesh(zBeamGeom, this.materials.skidSteelBeam);
      topZOuest.position.set(env.x + beamWidth / 2, topElevation, cz);
      root.add(topZOuest);

      const topZEst = new THREE.Mesh(zBeamGeom, this.materials.skidSteelBeam);
      topZEst.position.set(env.x + len - beamWidth / 2, topElevation, cz);
      root.add(topZEst);

      // Caillebotis / Plancher d'atelier métallique de base
      const floorGeom = new THREE.PlaneGeometry(len - beamWidth * 2, wid - beamWidth * 2);
      const floorMesh = new THREE.Mesh(floorGeom, this.materials.skidFloorPlate);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(cx, env.z + beamHeight, cz);
      floorMesh.receiveShadow = true;
      root.add(floorMesh);
    } else {
      // Structure Chambre Technique / Local Confiné : Dalle béton armé et plafond
      const slabThick = 0.16;

      // Radier / Dalle de sol en béton armé
      const floorSlabGeom = new THREE.BoxGeometry(len + 0.3, slabThick, wid + 0.3);
      const floorSlab = new THREE.Mesh(floorSlabGeom, this.materials.concretePad);
      floorSlab.position.set(cx, env.z - slabThick / 2, cz);
      floorSlab.receiveShadow = true;
      root.add(floorSlab);

      // Dalle de plafond supérieure
      const roofSlabGeom = new THREE.BoxGeometry(len + 0.3, slabThick, wid + 0.3);
      const roofSlab = new THREE.Mesh(roofSlabGeom, this.materials.concretePad);
      roofSlab.position.set(cx, env.z + hgt + slabThick / 2, cz);
      roofSlab.castShadow = true;
      root.add(roofSlab);
    }

    // 4. Cartouche flottant 3D d'identification au coin supérieur
    const title = isRoom
      ? `CHAMBRE TECHNIQUE (${len.toFixed(1)}m × ${wid.toFixed(1)}m)`
      : `SKID INDUSTRIEL ASME (${len.toFixed(1)}m × ${wid.toFixed(1)}m)`;
    const subtitle = `Volume Extrudé H=${hgt.toFixed(1)}m · Origine (X0=${env.x.toFixed(1)}, Y0=${env.y.toFixed(1)})`;
    const labelSprite = this.createBillboardTextSprite(
      title,
      subtitle,
      "rgba(10, 15, 24, 0.92)",
      isRoom ? "#38bdf8" : "#f59e0b",
      isRoom ? "#0284c7" : "#d97706"
    );
    labelSprite.position.set(env.x + len + 0.2, env.z + hgt + 0.45, env.y + wid + 0.2);
    root.add(labelSprite);

    return root;
  }

  /**
   * Crée une traversée de paroi étanche 3D (Fourreau métallique, manchette souple Link-Seal et bride de serrage)
   * Générée au point précis d'intersection entre un tube et une paroi de volume/skid
   */
  public createWallCrossingMesh(crossing: {
    x: number;       // Coordonnée X Three.js
    y: number;       // Coordonnée Y Three.js (Élévation)
    z: number;       // Coordonnée Z Three.js (Nord)
    plane: string;   // "Paroi Ouest (-X)", "Paroi Est (+X)", "Paroi Sud (-Y)", "Paroi Nord (+Y)", "Sol (-Z)", "Plafond (+Z)"
    axis: "X" | "Y" | "Z";
    normal: THREE.Vector3;
    dn: number;
    segmentId: string;
    lineNumber?: string;
    label?: string;
    isExit?: boolean;
  }): THREE.Group {
    const group = new THREE.Group();
    const dims = getPipeStandardDimensions(crossing.dn);
    const pipeR = dims.odM / 2;
    const sleeveR = pipeR + 0.035; // Fourreau élargi de +35mm de rayon pour le joint Link-Seal
    const sleeveLen = 0.28;        // Épaisseur de la paroi / traversée

    // 1. Fourreau métallique extérieur scellé dans la paroi
    const sleeveGeom = new THREE.CylinderGeometry(sleeveR, sleeveR, sleeveLen, 32);
    const sleeveMesh = new THREE.Mesh(sleeveGeom, this.materials.wallSleeveSteel);
    sleeveMesh.castShadow = true;
    sleeveMesh.receiveShadow = true;

    // 2. Joint d'étanchéité annulaire haute visibilité (Élastomère orange sécurité Link-Seal)
    const sealGeom = new THREE.RingGeometry(pipeR * 1.02, sleeveR * 0.98, 32);
    const sealFront = new THREE.Mesh(sealGeom, this.materials.wallSleeveGasket);
    sealFront.position.y = sleeveLen / 2 + 0.001;
    sealFront.rotation.x = -Math.PI / 2;

    const sealBack = new THREE.Mesh(sealGeom, this.materials.wallSleeveGasket);
    sealBack.position.y = -sleeveLen / 2 - 0.001;
    sealBack.rotation.x = Math.PI / 2;

    // 3. Collerette / Bride métallique de serrage mural avec boulons
    const collarGeom = new THREE.CylinderGeometry(sleeveR * 1.25, sleeveR * 1.25, 0.02, 32);
    const collarMesh = new THREE.Mesh(collarGeom, this.materials.supportSteel);
    collarMesh.position.y = sleeveLen / 2;

    const sleeveAssembly = new THREE.Group();
    sleeveAssembly.add(sleeveMesh);
    sleeveAssembly.add(sealFront);
    sleeveAssembly.add(sealBack);
    sleeveAssembly.add(collarMesh);

    // Orientation du fourreau selon la normale à la paroi
    const yAxis = new THREE.Vector3(0, 1, 0);
    const norm = crossing.normal.clone().normalize();
    if (norm.lengthSq() > 0.0001) {
      sleeveAssembly.quaternion.setFromUnitVectors(yAxis, norm);
    }

    sleeveAssembly.position.set(crossing.x, crossing.y, crossing.z);
    group.add(sleeveAssembly);

    // 4. Cartouche indicateur flottant au-dessus de la traversée
    const planeName = crossing.plane || "Traversée Paroi";
    const dirTag = crossing.isExit ? "OUTLET" : "INLET";
    const tagText = `${planeName} [${dirTag}] · DN${crossing.dn}`;
    const coordText = `Pos: (${crossing.x.toFixed(2)}, ${crossing.z.toFixed(2)}, EL.+${crossing.y.toFixed(2)}m)`;
    const sprite = this.createBillboardTextSprite(
      tagText,
      coordText,
      "rgba(15, 23, 42, 0.90)",
      "#38bdf8",
      "#0284c7"
    );
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.set(crossing.x + norm.x * 0.15, crossing.y + 0.35, crossing.z + norm.z * 0.15);
    group.add(sprite);

    group.userData = {
      isPdiEntity: true,
      entityType: "wall_crossing",
      label: `Traversée de paroi étanche DN${crossing.dn} (${crossing.plane})`,
      plane: crossing.plane,
      axis: crossing.axis,
      dn: crossing.dn,
      segmentId: crossing.segmentId,
      sleeveType: "Fourreau Acier avec Presse-Étoupe Link-Seal",
      worldPos: { x: crossing.x, y: crossing.y, z: crossing.z },
    };

    return group;
  }
}


