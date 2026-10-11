/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : MATÉRIAUX & SHADERS 3D PBR INDUSTRIELS
 * Référentiels : ASME B31.3, ISO 14692, ASTM A106, AISI 316.
 * Version : 021C-ETAPE-C (05 Septembre 2026)
 */

import * as THREE from "three";
import type { RenderShadingMode } from "./types3d";

export interface MaterialPalette {
  carbonSteel: THREE.MeshStandardMaterial;
  stainlessSteel: THREE.MeshStandardMaterial;
  flangeBolts: THREE.MeshStandardMaterial;
  valveBody: THREE.MeshStandardMaterial;
  valveHandwheel: THREE.MeshStandardMaterial;
  gasket: THREE.MeshStandardMaterial;
  weldShop: THREE.MeshStandardMaterial;
  weldField: THREE.MeshStandardMaterial;
  weldGolden: THREE.MeshStandardMaterial;
  supportSteel: THREE.MeshStandardMaterial;
  concretePad: THREE.MeshStandardMaterial;
  highlightSelected: THREE.MeshStandardMaterial;
  highlightHover: THREE.MeshStandardMaterial;
  wireframeMat: THREE.MeshBasicMaterial;
  equipmentMotor: THREE.MeshStandardMaterial;
  equipmentPump: THREE.MeshStandardMaterial;
  equipmentBrass: THREE.MeshStandardMaterial;
  equipmentVessel: THREE.MeshStandardMaterial;
  equipmentExchanger: THREE.MeshStandardMaterial;
  equipmentSightGlass: THREE.MeshPhysicalMaterial;
  anchorBolts: THREE.MeshStandardMaterial;
  equipmentYellowLever: THREE.MeshStandardMaterial;
  equipmentBlueLever: THREE.MeshStandardMaterial;
  gaugeDial: THREE.MeshStandardMaterial;
  gaugeNeedle: THREE.MeshStandardMaterial;
  copperBrass: THREE.MeshStandardMaterial;
  insulationOrange: THREE.MeshStandardMaterial;
  volumeWallGlass: THREE.MeshPhysicalMaterial;
  volumeWallSolid: THREE.MeshStandardMaterial;
  volumeEdgeLine: THREE.LineBasicMaterial;
  skidSteelBeam: THREE.MeshStandardMaterial;
  skidFloorPlate: THREE.MeshStandardMaterial;
  wallSleeveSteel: THREE.MeshStandardMaterial;
  wallSleeveGasket: THREE.MeshStandardMaterial;
  wallCrossingGlow: THREE.MeshBasicMaterial;
  getSpoolMaterial: (spoolId?: string, spoolColor?: string, mode?: RenderShadingMode) => THREE.Material;
  getServiceMaterial: (service?: string, mode?: RenderShadingMode) => THREE.Material;
}

const SPOOL_COLOR_PALETTE = [
  "#38bdf8", // Sky blue
  "#34d399", // Emerald
  "#fbbf24", // Amber
  "#f472b6", // Rose
  "#a78bfa", // Purple
  "#fb923c", // Orange
  "#2dd4bf", // Teal
  "#818cf8", // Indigo
  "#f87171", // Red coral
  "#a3e635", // Lime
];

export function createPdi3dMaterialPalette(): MaterialPalette {
  const carbonSteel = new THREE.MeshStandardMaterial({
    color: 0x334155, // Deep Slate steel
    metalness: 0.88,
    roughness: 0.28,
    envMapIntensity: 1.2,
  });

  const stainlessSteel = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1, // Bright stainless 316L
    metalness: 0.95,
    roughness: 0.18,
    envMapIntensity: 1.5,
  });

  const flangeBolts = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.18,
  });

  const valveBody = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.75,
    roughness: 0.35,
  });

  const valveHandwheel = new THREE.MeshStandardMaterial({
    color: 0xdc2626, // Industrial safety red
    metalness: 0.35,
    roughness: 0.4,
  });

  const gasket = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
    metalness: 0.05,
  });

  const weldShop = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.45,
    metalness: 0.65,
    roughness: 0.35,
  });

  const weldField = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    emissive: 0xbe123c,
    emissiveIntensity: 0.55,
    metalness: 0.65,
    roughness: 0.35,
  });

  const weldGolden = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.65,
    metalness: 0.85,
    roughness: 0.25,
  });

  const supportSteel = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.8,
    roughness: 0.35,
  });

  const concretePad = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.95,
    metalness: 0.02,
  });

  const highlightSelected = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00d0f0,
    emissiveIntensity: 0.85,
    metalness: 0.5,
    roughness: 0.15,
  });

  const highlightHover = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    metalness: 0.4,
    roughness: 0.25,
  });

  const wireframeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
  });

  const equipmentMotor = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Industrial Electric Blue
    metalness: 0.65,
    roughness: 0.32,
  });

  const equipmentPump = new THREE.MeshStandardMaterial({
    color: 0x0f766e, // Industrial Process Teal / Dark Green
    metalness: 0.72,
    roughness: 0.38,
  });

  const equipmentBrass = new THREE.MeshStandardMaterial({
    color: 0xd97706, // Brass / Bronze
    metalness: 0.9,
    roughness: 0.25,
  });

  const equipmentVessel = new THREE.MeshStandardMaterial({
    color: 0x334155, // Heavy Pressure Vessel Slate
    metalness: 0.82,
    roughness: 0.3,
  });

  const equipmentExchanger = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a, // Exchanger Blue
    metalness: 0.78,
    roughness: 0.32,
  });

  const equipmentSightGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.85,
    ior: 1.5,
    transparent: true,
    opacity: 0.75,
  });

  const anchorBolts = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9, // Bright zinc-plated
    metalness: 0.95,
    roughness: 0.15,
  });

  const equipmentYellowLever = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Industrial safety amber/yellow for quarter-turn ball valves
    metalness: 0.45,
    roughness: 0.35,
  });

  const equipmentBlueLever = new THREE.MeshStandardMaterial({
    color: 0x2563eb, // Cobalt blue for butterfly / control handles
    metalness: 0.45,
    roughness: 0.35,
  });

  const gaugeDial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.2,
  });

  const gaugeNeedle = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Indicator red
    metalness: 0.3,
    roughness: 0.2,
  });

  const copperBrass = new THREE.MeshStandardMaterial({
    color: 0xb45309, // Polished brass/bronze
    metalness: 0.92,
    roughness: 0.22,
  });

  const insulationOrange = new THREE.MeshStandardMaterial({
    color: 0xea580c, // Thermal jacket orange / safety
    metalness: 0.3,
    roughness: 0.5,
  });

  const volumeWallGlass = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.14,
    roughness: 0.25,
    transmission: 0.55,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const volumeWallSolid = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.22,
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const volumeEdgeLine = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    linewidth: 2,
    transparent: true,
    opacity: 0.85,
  });

  const skidSteelBeam = new THREE.MeshStandardMaterial({
    color: 0x334155, // Heavy IPE steel channel
    metalness: 0.85,
    roughness: 0.3,
  });

  const skidFloorPlate = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.6,
  });

  const wallSleeveSteel = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.88,
    roughness: 0.22,
  });

  const wallSleeveGasket = new THREE.MeshStandardMaterial({
    color: 0xf97316, // High-visibility safety orange elastomer seal
    emissive: 0xc2410c,
    emissiveIntensity: 0.35,
    metalness: 0.2,
    roughness: 0.6,
  });

  const wallCrossingGlow = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    wireframe: true,
  });

  const spoolCache = new Map<string, THREE.MeshStandardMaterial>();
  const serviceCache = new Map<string, THREE.MeshStandardMaterial>();

  const getSpoolMaterial = (spoolId?: string, spoolColor?: string, mode: RenderShadingMode = "color_by_spool") => {
    if (mode === "wireframe") return wireframeMat;
    if (mode === "realistic") return carbonSteel;
    const key = spoolId || "SP-00";
    if (spoolCache.has(key)) return spoolCache.get(key)!;

    let hex = spoolColor;
    if (!hex) {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) % SPOOL_COLOR_PALETTE.length;
      }
      hex = SPOOL_COLOR_PALETTE[Math.abs(hash)];
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      metalness: 0.65,
      roughness: 0.38,
      bumpScale: 0.05,
    });
    spoolCache.set(key, mat);
    return mat;
  };

  const getServiceMaterial = (service?: string, mode: RenderShadingMode = "color_by_service") => {
    if (mode === "wireframe") return wireframeMat;
    if (mode === "realistic") return carbonSteel;
    const key = (service || "default").toLowerCase();
    if (serviceCache.has(key)) return serviceCache.get(key)!;

    let col = 0x0284c7; // Default Blue Gaz/Procédé
    if (key.includes("eau") || key.includes("water")) col = 0x10b981; // Green
    else if (key.includes("vapeur") || key.includes("steam")) col = 0xf59e0b; // Amber
    else if (key.includes("condensat")) col = 0xeab308; // Yellow
    else if (key.includes("huile") || key.includes("oil") || key.includes("hydro")) col = 0xd97706; // Ochre
    else if (key.includes("incendie") || key.includes("fire")) col = 0xef4444; // Red
    else if (key.includes("air") || key.includes("azote") || key.includes("n2")) col = 0x06b6d4; // Cyan

    const mat = new THREE.MeshStandardMaterial({
      color: col,
      metalness: 0.7,
      roughness: 0.35,
    });
    serviceCache.set(key, mat);
    return mat;
  };

  return {
    carbonSteel,
    stainlessSteel,
    flangeBolts,
    valveBody,
    valveHandwheel,
    gasket,
    weldShop,
    weldField,
    weldGolden,
    supportSteel,
    concretePad,
    highlightSelected,
    highlightHover,
    wireframeMat,
    equipmentMotor,
    equipmentPump,
    equipmentBrass,
    equipmentVessel,
    equipmentExchanger,
    equipmentSightGlass,
    anchorBolts,
    equipmentYellowLever,
    equipmentBlueLever,
    gaugeDial,
    gaugeNeedle,
    copperBrass,
    insulationOrange,
    volumeWallGlass,
    volumeWallSolid,
    volumeEdgeLine,
    skidSteelBeam,
    skidFloorPlate,
    wallSleeveSteel,
    wallSleeveGasket,
    wallCrossingGlow,
    getSpoolMaterial,
    getServiceMaterial,
  };
}
