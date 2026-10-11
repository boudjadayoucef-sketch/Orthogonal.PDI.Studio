/**
 * Canonical PD&I model boundary.
 *
 * These types are intentionally independent from the Guide UI. They are the
 * stable contract that the editor, persistence, CAD adapters and AI agents
 * will consume.
 */

export type IsoNodeId = string;
export type IsoSegmentId = string;
export type PipingLineId = string;

export interface IsoPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface IsoNode {
  id: IsoNodeId;
  position: IsoPoint3D;
  label?: string;
  kind?: 'point' | 'equipment-port' | 'branch' | 'weld' | 'component-port';
}

export interface IsoSegment {
  id: IsoSegmentId;
  lineId: PipingLineId;
  from: IsoNodeId;
  to: IsoNodeId;
  nominalDiameter?: number;
  nominalDiameterUnit?: 'mm' | 'in';
  componentType?:
    | 'pipe'
    | 'elbow'
    | 'tee'
    | 'reducer'
    | 'flange'
    | 'valve'
    | 'cap'
    | 'instrument'
    | 'other';
  metadata?: Record<string, unknown>;
}

export interface PipingLine {
  id: PipingLineId;
  tag?: string;
  service?: string;
  specification?: string;
  material?: string;
  nodes: IsoNode[];
  segments: IsoSegment[];
  metadata?: Record<string, unknown>;
}

export interface PdiIsometricModel {
  schemaVersion: '1.0';
  projectId?: string;
  lines: PipingLine[];
  metadata?: Record<string, unknown>;
}

export function createEmptyPdiModel(projectId?: string): PdiIsometricModel {
  return {
    schemaVersion: '1.0',
    projectId,
    lines: [],
  };
}

// ARCH-03: Universal Model Exports
export * from "./pdiUniversalEntity";
export * from "./pdiUniversalAdapter";

// ARCH-04: Project, Document & Workspace Context Exports
export * from "./pdiProjectContext";
export * from "./pdiProjectAdapter";

// ARCH-05: Technical Workflow P&ID → Piping → Isometric
export * from "./pdiTechnicalWorkflow";
export * from "./pdiTechnicalWorkflowAdapter";

// ARCH-06: Component Selection + Catalog + Compatibility
export * from "./pdiCatalogComponent";
export * from "./pdiCatalogSelectionAdapter";

// ARCH-07: Client Neutral Architecture & Industrialization Boundary
export * from "./pdiIndustrialArchitecture";
export * from "./pdiIndustrialArchitectureAdapter";

// ARCH-08: Multi-Domain Engineering Architecture
export * from "../engineering";


