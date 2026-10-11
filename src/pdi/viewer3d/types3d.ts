/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : VUE 3D EXTRUDÉE SOLIDE & ORBITE — TYPES & CONTRATS
 * Référentiels : ASME B31.3, ASME B16.9, ASME B16.5, MSS SP-58.
 * Version : 021C-ETAPE-C (05 Septembre 2026)
 */

import type { IsoNode, IsoSegment } from "../isometric/types/isoGraphTypes";
import type { PdiWeldEntry, PdiSpoolEntry } from "../welding/isoWeldSpoolEngine";
import type { IsoPipingSupport } from "../isometric/supports/pdiMssSupportEngine";

export type RenderShadingMode =
  | "realistic"       // PBR Acier industriel avec reflets métalliques
  | "color_by_spool"  // Coloration par sous-ensemble préfabriqué (Spools SP-01, SP-02...)
  | "color_by_service"// Coloration selon fluide / service (Gaz, Eau, Vapeur, Hydrocarbure)
  | "wireframe"       // Mode filaire technique / X-Ray
  | "inspection";     // Mode diagnostic (contrôle CND & tolérances)

export type CameraViewPreset =
  | "iso_sw"   // Isométrique Sud-Ouest (Standard ASME B31.3)
  | "iso_se"   // Isométrique Sud-Est
  | "iso_ne"   // Isométrique Nord-Est
  | "iso_nw"   // Isométrique Nord-Ouest
  | "top"      // Vue de dessus (Planimétrie)
  | "front"    // Vue de face (Élévation X-Z)
  | "side";    // Vue latérale (Profil Y-Z)

export type CameraProjectionType = "perspective" | "orthographic";

export interface VolumeEnvelopeSpec3d {
  active: boolean;
  length: number; // m
  width: number;  // m
  height: number; // m (extrusion)
  x: number;      // origin X
  y: number;      // origin Y
  z: number;      // origin Z
  preset?: string;
  wireframe?: boolean;
  opacity?: number;
}

export interface Viewer3dOptions {
  shadingMode: RenderShadingMode;
  projection: CameraProjectionType;
  showWelds: boolean;
  showSupports: boolean;
  showDimensions: boolean;
  showGroundGrid: boolean;
  showCompassAxes: boolean;
  showVolumeEnvelope?: boolean;
  showWallCrossings?: boolean;
  autoRotate: boolean;
  clippingPlaneEnabled: boolean;
  clippingZPercent: number; // 0 à 100%
  selectedSpoolId?: string | null;
  selectedEntityId?: string | null;
  ambientOcclusion: boolean;
  bloomHighlights: boolean;
  wallThicknessVisible: boolean;
  forceAutoFit?: boolean;
}

export interface Selected3dEntity {
  type: "segment" | "node" | "fitting" | "weld" | "support" | "spool" | "wall_crossing" | "volume_envelope";
  id: string;
  label: string;
  dn?: number;
  nps?: string;
  odMm?: number;
  thicknessMm?: number;
  material?: string;
  schedule?: string;
  spoolId?: string;
  spoolColor?: string;
  service?: string;
  pressureClass?: string;
  lengthM?: number;
  weightKg?: number;
  weldInfo?: {
    weldNumber: string;
    location: string;
    wpsRef: string;
    ndtRequired: string;
    ndtStatus: string;
  };
  supportInfo?: {
    tag: string;
    typeCode: string;
    typeLabelFr: string;
    standard: string;
    designLoadKn?: number;
  };
  wallCrossingInfo?: {
    plane: string;
    axis: "X" | "Y" | "Z";
    coord: number;
    segmentId: string;
    dn: number;
    sleeveType: string;
  };
  worldPos?: { x: number; y: number; z: number };
}

export interface Viewer3dDataPayload {
  nodes: IsoNode[];
  segments: IsoSegment[];
  welds: PdiWeldEntry[];
  spools: PdiSpoolEntry[];
  supports: IsoPipingSupport[];
  projectName?: string;
  activeUnitSystem?: "metric" | "imperial";
  envelope?: VolumeEnvelopeSpec3d;
}
