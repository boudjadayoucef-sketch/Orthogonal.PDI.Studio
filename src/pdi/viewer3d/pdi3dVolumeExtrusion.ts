/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * PALIER 019S+ (ÉTAPE 3/3) — EXTRUSION 3D GÉNÉRIQUE DES VOLUMES.
 *
 * Remplace la limite de Pdi3dGeometryFactory.createVolumeEnvelopeMesh
 * (qui ne sait construire qu'un THREE.BoxGeometry, donc un pavé droit) par
 * une extrusion THREE.ExtrudeGeometry à partir du profil 2D libre d'un
 * PdiVolume (voir src/pdi/model/pdiVolumeModel.ts). Ça débloque :
 *   - des formes de volume quelconques (L, T, coins coupés...) ;
 *   - des ouvertures/vides réels (trémie, passage) via les "holes" du
 *     THREE.Shape, soustraits nativement par l'extrusion ;
 *   - une fosse/fondation en creux via une hauteur d'extrusion négative.
 *
 * Limite assumée à ce stade : une ouverture traverse toute la hauteur du
 * volume porteur (pas de CSG bornée en élévation). Une baie à mi-hauteur
 * de paroi reste à traiter par une vraie CSG (ex: three-bvh-csg), prévue
 * comme étape suivante et non comme régression de cette étape.
 *
 * Convention de repère (identique au reste du viewer3d, voir
 * pdi3dGeometryFactory.createVolumeEnvelopeMesh) : Three.X = CAD X,
 * Three.Z = CAD Y, Three.Y = élévation CAD Z. Un profil 2D est dessiné en
 * CAD (x, y) ; la vérification empirique (THREE.ExtrudeGeometry +
 * rotateX(-90°)) montre qu'il faut construire le THREE.Shape avec
 * (x, -y) pour que Three.Z retombe exactement sur CAD Y après rotation.
 */

import * as THREE from "three";
import type { MaterialPalette } from "./pdi3dMaterials";
import { PdiPoint2D, PdiVolume } from "../model/pdiVolumeModel";

/** Fonction d'étiquette optionnelle, même signature que Pdi3dGeometryFactory.createBillboardTextSprite. */
export type CreateLabelSpriteFn = (
  text: string,
  subText?: string,
  bgColor?: string,
  textColor?: string,
  borderColor?: string
) => THREE.Sprite;

export interface ConstruireVolumeExtrudeOptions {
  showSolidWalls?: boolean;
  wireframe?: boolean;
  opacity?: number;
  /** Espacement cible (m) entre deux traverses de renfort d'un skid métallique. */
  espacementTraverseM?: number;
  creerEtiquette?: CreateLabelSpriteFn;
}

function pointVersShape(shape: THREE.Shape | THREE.Path, p: PdiPoint2D, premier: boolean) {
  // (x, -y) : voir note de repère en tête de fichier — validé empiriquement.
  if (premier) shape.moveTo(p.x, -p.y);
  else shape.lineTo(p.x, -p.y);
}

function construireShapeAvecOuvertures(volume: PdiVolume): THREE.Shape {
  const shape = new THREE.Shape();
  volume.profil2D.forEach((p, i) => pointVersShape(shape, p, i === 0));
  shape.closePath();

  for (const ouverture of volume.ouvertures) {
    const trou = new THREE.Path();
    ouverture.profil2D.forEach((p, i) => pointVersShape(trou, p, i === 0));
    trou.closePath();
    shape.holes.push(trou);
  }
  return shape;
}

/** Extrude un THREE.Shape sur `hauteur` (signée) et le remet d'aplomb (Z shape -> Y monde). */
function extruderEtRedresser(shape: THREE.Shape, hauteur: number): THREE.ExtrudeGeometry {
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: hauteur,
    bevelEnabled: false,
    steps: 1,
  });
  geom.rotateX(-Math.PI / 2);
  return geom;
}

/** Longueur totale du périmètre d'un profil fermé (somme des arêtes consécutives). */
function perimetreProfil2D(points: PdiPoint2D[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Ajoute l'ossature métallique d'un skid (poutres périphériques + poteaux
 * d'angle + caillebotis) en suivant le périmètre RÉEL du profil 2D, au lieu
 * du rectangle fixe de l'ancienne implémentation. Poutres et poteaux sont
 * des THREE.BoxGeometry orientés par quaternion le long de chaque arête.
 */
function ajouterOssatureSkid(
  root: THREE.Group,
  volume: PdiVolume,
  materials: MaterialPalette,
  shapeFootprint: THREE.Shape
): void {
  const pts = volume.profil2D;
  if (pts.length < 3) return;

  const perimetre = perimetreProfil2D(pts);
  // Section de poutre proportionnelle à l'échelle du volume (même heuristique que l'ancien code : 2.5% d'une dimension de référence).
  const beamHeight = Math.min(0.18, Math.max(0.08, (perimetre / pts.length) * 0.08));
  const beamWidth = beamHeight * 0.55;
  const baseElevation = volume.origineZ + beamHeight / 2;
  const topElevation = volume.origineZ + volume.hauteurExtrusion - beamHeight / 2;

  const yAxis = new THREE.Vector3(0, 1, 0);

  const ajouterPoutrePeripherique = (p1: PdiPoint2D, p2: PdiPoint2D, elevation: number) => {
    const longueur = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (longueur < 1e-3) return;
    const geom = new THREE.BoxGeometry(longueur, beamHeight, beamWidth);
    const mesh = new THREE.Mesh(geom, materials.skidSteelBeam);
    const mx = (p1.x + p2.x) / 2;
    const mz = (p1.y + p2.y) / 2; // CAD Y -> Three Z
    mesh.position.set(mx, elevation, mz);
    // Oriente la poutre (axe local X) le long de l'arête (dx, 0, dz).
    const dir = new THREE.Vector3(p2.x - p1.x, 0, p2.y - p1.y).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    mesh.castShadow = true;
    root.add(mesh);
  };

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    ajouterPoutrePeripherique(a, b, baseElevation);
    ajouterPoutrePeripherique(a, b, topElevation);
  }

  // Poteaux d'angle verticaux à chaque sommet du profil.
  const postGeom = new THREE.BoxGeometry(beamWidth * 1.1, Math.abs(volume.hauteurExtrusion), beamWidth * 1.1);
  const cy = volume.origineZ + volume.hauteurExtrusion / 2;
  pts.forEach((p) => {
    const post = new THREE.Mesh(postGeom, materials.skidSteelBeam);
    post.position.set(p.x, cy, p.y);
    post.castShadow = true;
    root.add(post);

    const eyeGeom = new THREE.TorusGeometry(0.045, 0.015, 12, 24);
    const eyeMesh = new THREE.Mesh(eyeGeom, materials.equipmentBrass);
    eyeMesh.position.set(p.x, volume.origineZ + volume.hauteurExtrusion + 0.04, p.y);
    eyeMesh.rotation.y = Math.PI / 4;
    root.add(eyeMesh);
  });

  // Caillebotis / plancher : fine extrusion du MÊME profil (suit donc la forme réelle, pas juste un rectangle).
  const floorGeom = extruderEtRedresser(shapeFootprint, beamHeight * 0.4);
  const floorMesh = new THREE.Mesh(floorGeom, materials.skidFloorPlate);
  floorMesh.position.set(0, volume.origineZ + beamHeight, 0);
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  void yAxis; // conservé pour lisibilité/symétrie avec d'autres fabriques du module ; pas utilisé directement ici.
}

/** Ajoute les marqueurs des points d'ancrage tuyauterie définis sur le volume. */
function ajouterPointsAncrage(root: THREE.Group, volume: PdiVolume, materials: MaterialPalette): void {
  volume.pointsAncrage.forEach((ancrage) => {
    const geom = new THREE.SphereGeometry(0.035, 16, 16);
    const mesh = new THREE.Mesh(geom, materials.equipmentBrass);
    mesh.position.set(ancrage.position.x, ancrage.position.z, ancrage.position.y);
    mesh.userData = {
      isPdiEntity: true,
      entityType: "point_ancrage",
      label: `Point d'ancrage (${ancrage.type})${ancrage.dnMax ? ` · DN max ${ancrage.dnMax}` : ""}`,
      ancrageId: ancrage.id,
    };
    root.add(mesh);
  });
}

/**
 * Construit le maillage 3D d'un PdiVolume par extrusion de son profil 2D.
 * Remplace, pour un volume donné, Pdi3dGeometryFactory.createVolumeEnvelopeMesh.
 */
export function construireMaillageVolumeExtrude(
  volume: PdiVolume,
  materials: MaterialPalette,
  options: ConstruireVolumeExtrudeOptions = {}
): THREE.Group {
  const root = new THREE.Group();
  if (!volume.actif) return root;

  const shape = construireShapeAvecOuvertures(volume);
  const geom = extruderEtRedresser(shape, volume.hauteurExtrusion);
  geom.computeVertexNormals();

  const estFosse = volume.kind === "fosse_fondation";
  const estLocal = volume.kind === "local_technique";
  const estVide = volume.kind === "vide_interieur";

  // 1. Volume principal : parois vitrées/solides pour un skid ou local, matière béton pour une fosse,
  //    quasi invisible (juste le contour) pour un vide intérieur qui ne sert qu'à marquer un passage.
  const materiauPrincipal = estFosse
    ? materials.concretePad
    : options.showSolidWalls
      ? materials.volumeWallSolid
      : materials.volumeWallGlass;

  const mesh = new THREE.Mesh(geom, materiauPrincipal);
  mesh.position.set(0, volume.origineZ, 0);
  mesh.userData = {
    isPdiEntity: true,
    entityType: "volume_extrude",
    kind: volume.kind,
    label: volume.nomFr,
    origine: `Z0=${volume.origineZ.toFixed(2)}m`,
    hauteur: `${volume.hauteurExtrusion.toFixed(2)}m`,
  };
  if (!estVide) {
    mesh.receiveShadow = true;
    mesh.castShadow = !estFosse;
    root.add(mesh);
  }

  // 2. Arêtes filaires (toujours visibles, y compris pour un vide, afin de voir où se trouve le passage).
  const edgesGeom = new THREE.EdgesGeometry(geom);
  const edgesLine = new THREE.LineSegments(edgesGeom, materials.volumeEdgeLine);
  edgesLine.position.set(0, volume.origineZ, 0);
  root.add(edgesLine);

  // 3. Structure physique selon la nature du volume.
  if (volume.kind === "skid_metallique") {
    ajouterOssatureSkid(root, volume, materials, shape);
  } else if (estLocal || estFosse) {
    // Dalle de fond + (pour un local) dalle de couverture, en suivant le profil réel.
    const slabThick = 0.16;
    const dalleGeom = extruderEtRedresser(shape, slabThick);
    const dalleBase = new THREE.Mesh(dalleGeom, materials.concretePad);
    dalleBase.position.set(0, volume.origineZ - slabThick, 0);
    dalleBase.receiveShadow = true;
    root.add(dalleBase);

    if (estLocal) {
      const dalleHaut = new THREE.Mesh(dalleGeom.clone(), materials.concretePad);
      dalleHaut.position.set(0, volume.origineZ + volume.hauteurExtrusion, 0);
      dalleHaut.castShadow = true;
      root.add(dalleHaut);
    }
  }

  // 4. Points d'ancrage tuyauterie définis sur ce volume.
  ajouterPointsAncrage(root, volume, materials);

  // 5. Étiquette flottante (si un créateur de sprite a été fourni par l'appelant).
  if (options.creerEtiquette) {
    const bary = volume.profil2D.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const n = volume.profil2D.length || 1;
    const cx = bary.x / n;
    const cy = bary.y / n;
    const titre = volume.nomFr;
    const soustitre = `Volume extrudé H=${volume.hauteurExtrusion.toFixed(1)}m`;
    const sprite = options.creerEtiquette(
      titre,
      soustitre,
      "rgba(10, 15, 24, 0.92)",
      estFosse ? "#f87171" : estLocal ? "#38bdf8" : "#f59e0b",
      estFosse ? "#991b1b" : estLocal ? "#0284c7" : "#d97706"
    );
    sprite.position.set(cx, volume.origineZ + volume.hauteurExtrusion + 0.45, cy);
    root.add(sprite);
  }

  return root;
}
