/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * UNAUTHORIZED COPYING, REVERSE ENGINEERING OR DISTRIBUTION IS STRICTLY PROHIBITED.
 */
// PATCH 012 — grid metrics cleanup
// PATCH 011 — neutral CAD colors infinite grid no bottom metrics
// PATCH 007e — compact floating props landing restore
// PD&I PATCH 007e — workspace space/grid/home corrections
// PD&I PATCH 007d — ISO fullscreen is the main PD&I workspace
// PD&I PATCH 007c — ISO is the main workspace; home is handled by PdiUnifiedApp
// PD&I PATCH 007b — ISO embedded by default, public logo handled by SaaS shell
// PD&I PATCH 007a — shell SaaS branding/fullscreen wording reviewed
// PD&I PATCH 003 — V4.8d restored
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
// PATCH 017J : identite de cartouche parametrable (R15).
import { pdiCompanyName, pdiStandardsNote } from "../../branding/pdiBranding";
// PATCH 017P : precision geometrique (accroche a priorites, axes ISO, QA).
import {
  PDI_SNAP_TOL_PX,
  pdiRound3,
  pdiSnapValue,
  pdiSnapDirectionIso,
  pdiFindCoincidentNodes,
  pdiAuditGraph,
} from "./pdiPrecision017P";
import { pdiReorientPorts, pdiTolViewBox } from "./pdiPorts017P2";
import { pdiIsoAxisDirs017P3, pdiNodeRadius017P3, pdiNodeHasFaceOffset017P3, PDI_METRE_CONVENTION_017P3 } from "./pdiAxes017P3";
import { performUniversalAlign, performUniversalParallel, performObjectAlign, performObjectParallel, extractEntityAnchors, type PdiAnchorPoint } from "./pdiAlignParallel017Q";
import { PDI_PATCH_VERSION } from "../../pdiVersion";
import {
  PDI_ISO_ANGLE_017I2,
  PDI_ISO_COS_017I2,
  PDI_ISO_SIN_017I2,
  getProjectionAxes as getProjectionAxesEngine,
  isoProjectV4 as isoProjectV4Engine,
  isoUnprojectV4 as isoUnprojectV4Engine,
} from "../core/isoProjectionEngine";
import { generateDxfFile } from "../serialization/dxfSerialization";
import { pdiGlyphScale017P5 } from "./pdiGlyphes017P5";
// PATCH 017P9 : source unique des anomalies (11 codes, un seul module).
import { pdiUnifyAnomalies017P9, pdiAnomalieKind017P9, pdiAnomalieLibelle017P9 } from "./pdiAnomalies017P9";
// PATCH 017P10 : regles de validation de saisie (un seul endroit).
import { pdiValiderLongueur017P10, pdiValiderDn017P10, pdiEcartAccrochage017P10 } from "./pdiSaisie017P10";
// PATCH 017M : registre unique des commandes, source du ruban.
import { PDI_ONGLETS_RUBAN_017M, PDI_INVITE_COMMANDE_017M, pdiGroupesOnglet017M, pdiEntreesGroupe017M } from "./pdiRegistreCommandes.v1";
import { PDI_CLASSES_B165_017K3, PDI_DESIGNATIONS_PN_017K3, PDI_CLASSE_PAR_DEFAUT_017K3, pdiClasseDeSpec017K3, pdiMateriauDeSpec017K3, pdiClasseConforme017K3, pdiMessageDerogation017K3 } from "./pdiClassePression017K3";
import { defaultIsometricNormativeBridge } from "../../normative/integration/isometricNormativeBridge";
import type { PdiEntreeRuban017M } from "./pdiRegistreCommandes.v1";
import { isoState } from "../core/isoProjectionState";
import { pdiSignExportData } from "../../core/pdiWatermark";
import { useIsoInjection } from "./useIsoInjection";
import { IsoPrintModal } from "../../impression/IsoPrintModal";
import { generateIsoDrawingSvg, type BomRow } from "../../impression/isoSvgGenerator";
import { DEFAULT_PRINT_CONFIG } from "../../impression/isoSheetStandards";
import { IsoWeldSpoolModal } from "../../welding/IsoWeldSpoolModal";
import { Iso3DViewerModal } from "../../viewer3d/Iso3DViewerModal";
import {
  deriveSpoolsAndWelds,
  WeldSpoolResult,
  PdiWeldEntry,
  PdiSpoolEntry,
} from "../../welding/isoWeldSpoolEngine";
import {
  TROUVAY_CAUVIN_CATALOG,
  getComponentVignetteSvg,
} from "../../catalog/trouvayCauvinCatalog";
import {
  UnitSystem,
  formatLength,
  formatPressure,
  formatMass,
  formatTemperature,
  parsePdiValue,
} from "../../units/pdiUnitSystem";
import {
  LineSegment2D,
  intersectSegments2D,
  intersectRayWithSegment,
  cad2dTrimLine,
  cad2dExtendLine,
  cad2dOffsetLine,
  cad2dOffsetCircle,
  cad2dOffsetPolygon,
  cad2dFilletLines,
  cad2dScaleEntity,
  cad2dScaleNodes,
} from "../../cad2d/cad2dModifyEngine";
import {
  IsoPipingSupport,
  MssSupportCode,
  MSS_SUPPORT_CATALOG,
  projectSupportOnSegment,
  computeCivilMto,
  verifyPipingSpans,
} from "../supports/pdiMssSupportEngine";
import { IsoSupportRenderer } from "../supports/IsoSupportRenderer";
import { PdiSupportCivilPanel } from "../supports/PdiSupportCivilPanel";
import { PdiRotationButton15 } from "../ui/PdiRotationButton15";
import { PdiCanvasToolbarControls16 } from "../ui/PdiCanvasToolbarControls16";
import { auth } from "../../../lib/firebase";
import {
  PDI_LOGO_HORIZONTAL_SRC,
  PDI_LOGO_SQUARE_SRC,
  PDI_LOGO_HORIZONTAL_DATA_URL,
  PDI_LOGO_SQUARE_DATA_URL,
} from "../../../assets/pdiLogos";
import PdiBrandMark from "../../app/PdiBrandMark";
// V4.8d_DIMENSIONS_ALIGNMENT : logos PD & I réels haute définition.

import {
  Compass, Plus, Trash2, Printer, FileText, Layers, Ruler,
  RefreshCw, Maximize2, ZoomIn, ZoomOut, Move, Pencil, Save,
  X, GitBranch, Settings2, CircleDot, Flame, Waypoints, Info, Hand, MousePointer2, Undo2, Redo2,
  ChevronLeft, ChevronRight, SlidersHorizontal, Disc, CornerDownRight, GitFork, ArrowRightLeft,
  Eye, EyeOff, Crosshair, Check, Copy, Scissors, RotateCw, RotateCcw, PanelRightClose, PanelRightOpen,
  Circle, Spline, FolderOpen, Download, LayoutGrid, Magnet, Type, Square, Hexagon, Slash, Disc3,
  Minimize2, Triangle, Clipboard, CopyPlus, Terminal, CornerDownLeft, ChevronDown, Anchor, Sparkles, Box,
  SplitSquareVertical, Tv2, Monitor, FileSpreadsheet, HelpCircle
} from "lucide-react";
import { generateComplexIndustrialIsoDemo } from "../demo/pdiComplexIsoDemo";
import { generateChambreTechniqueDemo, generateSkidFiltrationDemo } from "../demo/pdiNewDemos";
import { PdiWorkspaceConfigModal } from "../../workspace/PdiWorkspaceConfigModal";
import { pdiWorkspaceBus } from "../../workspace/pdiWorkspaceChannel";
import type {
  PdiWorkspaceConfig,
  PdiWorkspaceState,
  PdiWorkspaceSelectionState,
  PdiWorkspaceModelSnapshot,
  PdiWorkspaceViewId,
} from "../../workspace/types";

import {
  TriangleType,
  ArcCreationMode,
  CadCommandItem,
  AUTOCAD_COMMANDS,
  searchCadCommands,
  PDI_PLANT3D_COMMAND_TABLE,
  buildEquilateralTriangle,
  buildRightTriangle,
  buildIsoscelesTriangle,
  buildRegularPolygon,
  buildAutocadRectangle,
  calculate3PointArc,
  cadDist,
  cadAngleDeg,
} from "./CadAutocadEngine";
import { CadCommandLineBar } from "../components/CadCommandLineBar";
import { IsoRibbonBar } from "../ui/IsoRibbonBar";
import { IsoCommandDock } from "../ui/IsoCommandDock";
import { CadShapeToolbar } from "../components/CadShapeToolbar";
import {
  PDI_DEFAULT_PROJECT_SETUP,
  pdiActiveFormat,
  pdiBuildTag,
  pdiFindSpec,
  pdiNextTagNumber,
  pdiSpecAllowsDn,
  pdiValidateTag,
} from "./pdiTagging";
import type { PdiProjectSetup } from "./pdiTagging";
import { AxisCursorOverlay } from "../../shared/AxisCursorOverlay";
// PATCH 017K2
import { pdiAlert } from "../../ui/PdiNotice";
import { PdiUniversalPropertyInspector } from "../ui/PdiUniversalPropertyInspector";
import {
  nodeToUniversalEntity,
  segmentToUniversalEntity,
  fittingToUniversalEntity,
  cad2dToUniversalEntity,
  supportToUniversalEntity,
} from "../../model/pdiUniversalAdapter";
import type { PdiUniversalEntity } from "../../model/pdiUniversalEntity";

import {
  type IsoNodeType,
  type IsoNode,
  type IsoFittingType,
  type IsoFitting,
  type IsoSegment,
  type PipingLine,
  type Cad2dEntityType,
  type Cad2dPoint,
  type Cad2dEntity,
  type CadDraftSession,
  type Cad2dLayer,
  type JointConnectionType,
  type PipingJoint,
  type GraphIssue,
  type IsoDimensionAnchor,
  type IsoDimension,
  type IsoProjectFileV474,
  type IsoEquipmentType,
  type IsoPortRole,
  type IsoPort,
  type DiameterSpec,
  DIAMETERS,
  DIAMETER_BY_DN,
  FITTING_LABELS,
  FITTING_TYPES,
} from "../types/isoGraphTypes";

import {
  DEFAULT_LINE_ID,
  pdiUid as uid,
  pdiClamp as clamp,
  pdiDia as dia,
  EQUIPMENT_NODE_TYPES,
  isEquipmentNode,
  equipmentLabel,
  elbowAngle,
  defaultFreeNodePorts,
  makeNode,
  makeFitting,
  defaultEquipmentPorts,
  equipmentPortConnectionType,
  makeEquipmentNode,
  pointOnSegment,
  portByIndex,
  availablePortId,
  portWorldPosition,
  segmentEndpoints,
  rotateWorldPoint,
  downstreamNodeIds,
  inferJointType,
  isWeldableConnection,
  deriveProjectJoints,
  validateProjectGraph,
  normalizedGraphPorts,
  cloneSegmentBetween,
  migrateLegacyFittings,
  cumulativeData,
  reorderFittings,
  materialRows,
  getFittingSvgGraphic,
} from "../core/IsoTopologyGraph";

export type {
  IsoNodeType,
  IsoNode,
  IsoFittingType,
  IsoFitting,
  IsoSegment,
  PipingLine,
  Cad2dEntityType,
  Cad2dPoint,
  Cad2dEntity,
  CadDraftSession,
  Cad2dLayer,
  JointConnectionType,
  PipingJoint,
  GraphIssue,
  IsoDimensionAnchor,
  IsoDimension,
  IsoProjectFileV474,
  IsoEquipmentType,
  IsoPortRole,
  IsoPort,
  DiameterSpec,
};
export {
  DIAMETERS,
  DIAMETER_BY_DN,
  FITTING_LABELS,
  FITTING_TYPES,
};


/* === ISO V4.3 ROBUST UX PATCH === */
  /* === ISO V4.4 TECHNIQUE UX PATCH === */

/* === ISO V4 PATCH === */

type IsoDrawMode = "select" | "node" | "segment" | "coude" | "te" | "dimension";



const getInitialYawPitchForMode = (mode: string, currentYaw?: number, currentPitch?: number) => {
  if (mode === "top") return { yaw: 0, pitch: Math.PI / 2 - 0.01 };
  if (mode === "front") return { yaw: 0, pitch: 0.02 };
  if (mode === "side") return { yaw: Math.PI / 2, pitch: 0.02 };
  if (mode === "iso") return { yaw: -Math.PI / 4, pitch: Math.PI / 6 };
  return { yaw: currentYaw ?? -Math.PI / 4, pitch: currentPitch ?? Math.PI / 6 };
};

const getProjectionAxes = (mode: string = isoState.viewMode, yaw: number = isoState.yaw, pitch: number = isoState.pitch) =>
  getProjectionAxesEngine(mode, yaw, pitch);

const isoProjectV4 = (x: number, y: number, z: number = 0, zoom: number = 1, panX: number = 0, panY: number = 0, mode?: string, yaw?: number, pitch?: number) =>
  isoProjectV4Engine(x, y, z, zoom, panX, panY, mode, yaw, pitch, undefined, isoState.viewMode, isoState.yaw, isoState.pitch, isoState.modelCenter);

const isoUnprojectV4 = (sx: number, sy: number, zoom: number, panX: number, panY: number, targetZ: number = 0, mode?: string, yaw?: number, pitch?: number) =>
  isoUnprojectV4Engine(
    sx, sy, zoom, panX, panY, targetZ, mode, isoState.viewMode,
    yaw, pitch, isoState.yaw, isoState.pitch, undefined, isoState.modelCenter
  );

const getSvgCoordinates = (clientX:number, clientY:number, svg:SVGSVGElement|null) => {
  if (!svg) return { sx: 310, sy: 200 };
  const ctm = svg.getScreenCTM();
  if (ctm) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { sx: transformed.x, sy: transformed.y };
  }
  const r = svg.getBoundingClientRect();
  return {
    sx: (clientX - r.left) * (620 / (r.width || 1)),
    sy: (clientY - r.top) * (400 / (r.height || 1)),
  };
};

const snapIsoV4=(v:number,step:number)=>step>0?Math.round(v/step)*step:v;

const isBendV4=(t:IsoFittingType)=>
  t==="coude_90"||t==="coude_45"||t==="coude_30"||t==="coude_22_5";

const bendOffsetV4=(t:IsoFittingType,dn:number)=>{
  const base=Math.max(.6,Math.min(3,dn/100));
  if(t==="coude_90")return base;
  if(t==="coude_45")return base*.75;
  if(t==="coude_30")return base*.55;
  return base*.4;
};

const isoPolylineV4=(s:IsoSegment,a:IsoNode,b:IsoNode,zoom:number,panX:number,panY:number, mode?: string, yaw?: number, pitch?: number)=>{
  // V4.6.1_NATIVE_POLYLINE : tube droit entre les faces des ports.
  const endpoints=segmentEndpoints(s,[a,b],[s]);
  const from=endpoints?.from||a,to=endpoints?.to||b;
  return [
    isoProjectV4(from.x,from.y,from.z || 0,zoom,panX,panY, mode, yaw, pitch),
    isoProjectV4(to.x,to.y,to.z || 0,zoom,panX,panY, mode, yaw, pitch)
  ];
};

const isoPathV4=(points:Array<{x:number;y:number}>)=>
  points.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

function lineSegmentIntersectsBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  if ((p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY) ||
      (p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY)) {
    return true;
  }
  if (Math.max(p1.x, p2.x) < minX || Math.min(p1.x, p2.x) > maxX ||
      Math.max(p1.y, p2.y) < minY || Math.min(p1.y, p2.y) > maxY) {
    return false;
  }
  const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  const intersect = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    d: { x: number; y: number },
  ) =>
    ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);

  const tl = { x: minX, y: minY };
  const tr = { x: maxX, y: minY };
  const br = { x: maxX, y: maxY };
  const bl = { x: minX, y: maxY };

  return intersect(p1, p2, tl, tr) ||
         intersect(p1, p2, tr, br) ||
         intersect(p1, p2, br, bl) ||
         intersect(p1, p2, bl, tl);
}



// V4.7.3_ANNOTATION_ENGINE : placement partagé éditeur / impression.
// V4.8b_VERTICAL_TOOLBAR_DECLUTTER : annotations compactes et collision renforcée.
const compactIsoLabel=(value:string,maxLength=30)=>value.length>maxLength?`${value.slice(0,maxLength-1)}…`:value;
type IsoAnnotationPlacement={id:string;x:number;y:number;anchorX:number;anchorY:number;width:number;height:number};
function buildIsoAnnotationLayout(nodes:IsoNode[],segments:IsoSegment[],joints:PipingJoint[],viewport:{zoom:number;panX:number;panY:number;viewMode?:string;yaw?:number;pitch?:number}){
  const result=new Map<string,IsoAnnotationPlacement>();
  const occupied:Array<{x:number;y:number;width:number;height:number}>=[];
  const overlaps=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>Math.abs(a.x-b.x)<(a.width+b.width)/2+3&&Math.abs(a.y-b.y)<(a.height+b.height)/2+3;
  const add=(id:string,anchorX:number,anchorY:number,width:number,height:number,candidates:Array<{x:number;y:number}>)=>{
    const scoreCandidate=(candidate:{x:number;y:number})=>{
      const current={...candidate,width,height};
      const overlapPenalty=occupied.reduce((score,box)=>{
        const overlapX=Math.max(0,(current.width+box.width)/2-Math.abs(current.x-box.x));
        const overlapY=Math.max(0,(current.height+box.height)/2-Math.abs(current.y-box.y));
        return score+overlapX*overlapY;
      },0);
      return overlapPenalty+Math.hypot(candidate.x-anchorX,candidate.y-anchorY)*0.03;
    };
    const chosen=candidates.find(candidate=>!occupied.some(box=>overlaps({...candidate,width,height},box)))||
      [...candidates].sort((a,b)=>scoreCandidate(a)-scoreCandidate(b))[0]||{x:anchorX,y:anchorY};
    const placement={id,x:chosen.x,y:chosen.y,anchorX,anchorY,width,height};
    occupied.push(placement);result.set(id,placement);
  };
  const project=(point:{x:number;y:number;z?:number})=>isoProjectV4(point.x,point.y,point.z || 0,viewport.zoom,viewport.panX,viewport.panY,viewport.viewMode,viewport.yaw,viewport.pitch);
  // Réserver le cœur des équipements avant de placer les textes.
  nodes.forEach((node)=>{
    const p=project(node);
    occupied.push({x:p.x,y:p.y,width:node.equipmentType?38:18,height:node.equipmentType?38:18});
  });
  joints.filter(joint=>joint.weldNumber).sort((a,b)=>(a.weldNumber||"").localeCompare(b.weldNumber||"")).forEach((joint,index)=>{
    const node=nodes.find(item=>item.id===joint.nodeId);if(!node)return;
    const anchor=project(portWorldPosition(node,joint.portId, nodes, segments)),center=project(node);
    const dx=anchor.x-center.x,dy=anchor.y-center.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,px=-uy,py=ux;
    add(`weld:${joint.id}`,anchor.x,anchor.y,34,11,[
      {x:anchor.x+ux*18+px*8,y:anchor.y+uy*18+py*8},
      {x:anchor.x+ux*18-px*8,y:anchor.y+uy*18-py*8},
      {x:anchor.x+px*(18+index%2*8),y:anchor.y+py*(18+index%2*8)},
      {x:anchor.x-px*(18+index%2*8),y:anchor.y-py*(18+index%2*8)}
    ]);
  });
  nodes.forEach((node,index)=>{
    const anchor=project(node),text=compactIsoLabel(node.equipmentType?equipmentLabel(node):node.name,30);
    const labelWidth=Math.min(172,Math.max(38,text.length*5.3+14));
    const nearDistance=Math.max(42,labelWidth/2+24);
    const candidates:Array<{x:number;y:number}>=[];
    [nearDistance,nearDistance+24,nearDistance+48,nearDistance+76].forEach((radius,ring)=>{
      const phase=(index%4)*Math.PI/8+ring*Math.PI/10;
      for(let step=0;step<8;step++){
        const angle=phase+step*Math.PI/4;
        candidates.push({x:anchor.x+Math.cos(angle)*radius,y:anchor.y+Math.sin(angle)*Math.max(24,radius*.55)});
      }
    });
    add(`node:${node.id}`,anchor.x,anchor.y,labelWidth,18,candidates);
  });
  segments.forEach((segment,index)=>{
    const endpoints=segmentEndpoints(segment,nodes,segments);if(!endpoints)return;
    const a=project(endpoints.from),b=project(endpoints.to),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len;
    const width=138;
    const ux=dx/len,uy=dy/len;
    const candidates:Array<{x:number;y:number}>=[];
    [22,38,56,78].forEach((offset,ring)=>{
      candidates.push({x:mx+px*offset,y:my+py*offset});
      candidates.push({x:mx-px*offset,y:my-py*offset});
      candidates.push({x:mx+ux*(32+ring*18)+px*offset,y:my+uy*(32+ring*18)+py*offset});
      candidates.push({x:mx-ux*(32+ring*18)-px*offset,y:my-uy*(32+ring*18)-py*offset});
    });
    add(`segment:${segment.id}`,mx,my,width,20,candidates);
  });
  return result;
}

// V4.7.4_PERSISTENCE_ENGINE — format stable et migrations héritées.
// Anciennes clés globales : conservées mais jamais chargées automatiquement.
const UNSCOPED_AUTOSAVE_CURRENT_KEY = "isometrie.autosave.v474.current";
const UNSCOPED_AUTOSAVE_PREVIOUS_KEY = "isometrie.autosave.v474.previous";
const UNSCOPED_AUTOSAVE_V47_KEY = "isometrie.autosave.v47";
const UNSCOPED_AUTOSAVE_CORRUPT_KEY = "isometrie.autosave.v474.corrupt";

export function migrateProjectFileV474(value:unknown, fallbackOwnerUid = ""):IsoProjectFileV474 {
  if(!value||typeof value!=="object")throw new Error("Fichier projet vide ou invalide");
  const raw=value as any,sourceModel=raw.model||raw;
  if(!Array.isArray(sourceModel.nodes)||!Array.isArray(sourceModel.segments))throw new Error("Le projet ne contient pas de graphe valide");
  let sourceNodes:IsoNode[]=sourceModel.nodes.map((node:IsoNode)=>{
    const ports=node.ports?.length?node.ports:(node.equipmentType?defaultEquipmentPorts(node.equipmentType):defaultFreeNodePorts());
    return {...node,ports:ports.map(port=>node.equipmentType?{...port,connectionType:port.connectionType||equipmentPortConnectionType(node.equipmentType!,port.index)}:{...port})};
  });
  let sourceSegments:IsoSegment[]=sourceModel.segments.map((segment:IsoSegment)=>({...segment,fittings:Array.isArray(segment.fittings)?segment.fittings:[]}));
  const sourceDimensions: IsoDimension[] = Array.isArray(sourceModel.dimensions)
    ? sourceModel.dimensions
        .filter((dimension: any) => dimension?.a?.nodeId && dimension?.b?.nodeId)
        .map((dimension: any) => ({
          id: dimension.id || uid("dim"),
          type: dimension.type || "distance",
          a: dimension.a,
          b: dimension.b,
          label: dimension.label,
          offset: dimension.offset || { x: 0, y: -24 },
          unit: dimension.unit || "m",
          locked: !dimension.locked,
        }))
    : [];
  const legacy=migrateLegacyFittings(sourceNodes,sourceSegments);
  const normalized=normalizedGraphPorts(legacy.nodes,legacy.segments);
  const fallbackLine:PipingLine={id:DEFAULT_LINE_ID,lineNumber:"",service:"",dn:100,nps:'4"',material:"",pressureClass:PDI_CLASSE_PAR_DEFAUT_017K3,schedule:"40",designPressure:40,color:"#9CA3AF"};
  let sourceLines:Array<PipingLine>=Array.isArray(sourceModel.lines)&&sourceModel.lines.length?sourceModel.lines:[fallbackLine];
  if(normalized.segments.some(segment=>(segment.lineId||DEFAULT_LINE_ID)===DEFAULT_LINE_ID)&&!sourceLines.some(line=>line.id===DEFAULT_LINE_ID))sourceLines=[...sourceLines,fallbackLine];
  const sourceWorkspace=raw.workspace||raw.settings||{};
  const now=new Date().toISOString();
  return {
    schemaVersion:"4.7.4",exportedAt:raw.exportedAt||now,
    project:{id:raw.project?.id||uid("project"),ownerUid:String(raw.project?.ownerUid||fallbackOwnerUid||""),name:raw.project?.name||"Projet isométrique",wilaya:raw.project?.wilaya||"",pressDesign:Number(raw.project?.pressDesign)||40,createdAt:raw.project?.createdAt||now,updatedAt:now,unitSystem:raw.project?.unitSystem==="imperial"?"imperial":"metric"},
    model:{lines:sourceLines.map(line=>({...line})),nodes: normalized.nodes, segments: normalized.segments, dimensions: sourceDimensions },
    workspace:{showGrid:sourceWorkspace.showGrid!==false,showDimensions:sourceWorkspace.showDimensions!==false,showPipeLabels:sourceWorkspace.showPipeLabels!==false,showLabels:sourceWorkspace.showLabels!==false,showWelds:sourceWorkspace.showWelds!==false,isoSnapStep:Number(sourceWorkspace.isoSnapStep)||.5,viewport:{zoom:Number(sourceWorkspace.viewport?.zoom)||1,panX:Number(sourceWorkspace.viewport?.panX)||0,panY:Number(sourceWorkspace.viewport?.panY)||0}}
  };
}

// PATCH 017F1 : le moteur recoit le projet actif de l onglet.
function IsometrieModule(props: { projectId?: string }) {
  const projectId = props?.projectId;
  // V4.7.4e_PROFILE_SCOPED_STORAGE : identité et clés par profil.
  // V4.7.4f_PLATFORM_PROFILE_FALLBACK : Firebase Auth reste prioritaire,
  // puis le profil applicatif validé par App.tsx est utilisé en mode fallback.
  const readPlatformProfileUid=()=>{
    try{
      const raw=localStorage.getItem("pdi.userProfile.v1")||localStorage.getItem("pdi_user_profile");
      if(!raw)return null;
      const profile=JSON.parse(raw);
      return typeof profile?.uid==="string"&&profile.uid.trim()?profile.uid.trim():null;
    }catch{return null;}
  };
  // PATCH 017E : identite locale de secours.
  // Sans compte Firebase ni profil plateforme, autosavePrefix restait vide et
  // TOUTE sauvegarde locale etait desactivee : le dessin disparaissait a F5.
  const readLocalFallbackUid=()=>{
    try{
      const existing=localStorage.getItem("pdi.localUid.v1");
      if(existing&&existing.trim())return existing.trim();
      const generated="local-"+Math.random().toString(36).slice(2,10)+Date.now().toString(36);
      localStorage.setItem("pdi.localUid.v1",generated);
      return generated;
    }catch{return "local-session";}
  };
  const resolveStableUid=()=>auth.currentUser?.uid||readPlatformProfileUid()||readLocalFallbackUid();
  const initialAuthUidRef=useRef<string|null>(resolveStableUid());
  const authSeenRef=useRef(false);
  const [authReady,setAuthReady]=useState(false);
  const [userUid,setUserUid]=useState<string|null>(resolveStableUid());
  useEffect(()=>{
    const syncIdentity=()=>{
      const nextUid=resolveStableUid();
      if(authSeenRef.current&&initialAuthUidRef.current!==nextUid){
        // Le cache du profil précédent ne doit jamais rester monté sous le nouveau compte.
        window.location.reload();
        return;
      }
      authSeenRef.current=true;
      initialAuthUidRef.current=nextUid;
      setUserUid(nextUid);
      setAuthReady(true);
    };
    const unsubscribe=onAuthStateChanged(auth,syncIdentity);
    const timer=window.setInterval(syncIdentity,1000);
    window.addEventListener("focus",syncIdentity);
    return()=>{unsubscribe();window.clearInterval(timer);window.removeEventListener("focus",syncIdentity);};
  },[]);
  // PATCH 017F1 : isolation par projet. Chaque onglet ISO ecrit dans sa propre
  // cle locale, donc un nouvel onglet demarre sur un plan vierge et deux
  // projets ne se recouvrent plus jamais.
  const activeProjectKey=(projectId&&projectId.trim())?projectId.trim():"default";
  const autosavePrefix=userUid?`isometrie.autosave.v474.user.${userUid}.project.${activeProjectKey}`:"";
  const AUTOSAVE_CURRENT_KEY=autosavePrefix?`${autosavePrefix}.current`:"";
  const AUTOSAVE_PREVIOUS_KEY=autosavePrefix?`${autosavePrefix}.previous`:"";
  const AUTOSAVE_LEGACY_KEY=autosavePrefix?`${autosavePrefix}.legacy`:"";
  const AUTOSAVE_CORRUPT_KEY=autosavePrefix?`${autosavePrefix}.corrupt`:"";

  // IMPORTANT: aucun P01/P02/P03 par défaut.
  const [nodes,setNodesRaw]=useState<IsoNode[]>([]);
  const [segments,setSegmentsRaw]=useState<IsoSegment[]>([]);
  const [lines,setLinesRaw]=useState<PipingLine[]>([{id:DEFAULT_LINE_ID,lineNumber:"",service:"",dn:100,nps:'4"',material:"",pressureClass:PDI_CLASSE_PAR_DEFAUT_017K3,schedule:"40",designPressure:40,color:"#9CA3AF"}]);
  const importProjectRef=useRef<HTMLInputElement>(null);
  const [dimensions, setDimensionsRaw] = useState<IsoDimension[]>([]);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const isSpacePressedRef = useRef(false);

  // PATCH 007 — real 2D geometry foundation.
  const [cad2dEntities, setCad2dEntitiesRaw] = useState<Cad2dEntity[]>([]);
  const [cad2dLayers, setCad2dLayersRaw] = useState<Cad2dLayer[]>([
    { id: "axes_tuyauterie", name: "Axes tuyauterie", color: "#9CA3AF", visible: true, locked: false },
    { id: "annotations", name: "Annotations", color: "#9CA3AF", visible: true, locked: false },
    { id: "import_cad", name: "Import CAD / fond plan", color: "#888888", visible: true, locked: false },
  ]);
  const [selectedCad2dIds, setSelectedCad2dIds] = useState<string[]>([]);
  const [cad2dDraftTool, setCad2dDraftTool] = useState<Cad2dEntityType | null>(null);

  // AutoCAD Interactive Draft Session & State
  const [cadDraftSession, setCadDraftSession] = useState<CadDraftSession | null>(null);
  // PATCH 016B : session de commande guidee (deplacer / copier / rotation) avec apercu.
  const [guidedCmd, setGuidedCmd] = useState<null | {
    type: "move" | "copy" | "rotate";
    step: "base" | "target";
    base?: { x: number; y: number; z: number };
    preview?: { x: number; y: number; z: number };
  }>(null);
  // 017Q : Point d'ancrage actif de référence pour les opérations Align / Parallel
  const [activeAnchor, setActiveAnchor] = useState<PdiAnchorPoint | null>(null);

  // PALIER 2B : session de commande géométrique interactive (TRIM, EXTEND, OFFSET, FILLET, SCALE, CHAMFER)
  const [cad2dModifySession, setCad2dModifySession] = useState<null | {
    mode: "trim" | "extend" | "offset" | "fillet" | "chamfer" | "scale";
    step: number;
    offsetDist: number;
    filletRadius: number;
    scaleFactor: number;
    basePoint?: Cad2dPoint;
    firstEntityId?: string;
    firstSegmentId?: string;
    firstLine?: LineSegment2D;
  }>(null);
  const cad2dModifySessionRef = useRef(cad2dModifySession);
  useEffect(() => {
    cad2dModifySessionRef.current = cad2dModifySession;
  }, [cad2dModifySession]);
  const applyScaleWithFactorRef = useRef<(factor: number, bp?: Cad2dPoint) => void>(() => {});
  const handleCad2dModifyPointerDownRef = useRef<(clickPt: Cad2dPoint, target?: Element) => boolean>(() => false);

  // PALIER 2C : SUPPORTS NORMALISÉS MSS SP-58 & GÉNIE CIVIL
  const [supports, setSupportsRaw] = useState<IsoPipingSupport[]>([]);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [activeSupportTypeToPlace, setActiveSupportTypeToPlace] = useState<MssSupportCode | null>(null);

  // Focus & Halo rectangulaire sur section en erreur / anomalie
  const [activeErrorHighlight, setActiveErrorHighlight] = useState<{
    id: string;
    kind: "segment" | "node" | "support";
    code?: string;
    message?: string;
    timestamp: number;
  } | null>(null);

  // ENVELOPE SPATIALE & SKID VOLUME INTEGRATION BY EXTRUSION
  const [envelopeActive, setEnvelopeActive] = useState<boolean>(true);
  const [envelopeLength, setEnvelopeLength] = useState<number>(6.0); // m
  const [envelopeWidth, setEnvelopeWidth] = useState<number>(4.0); // m
  const [envelopeHeight, setEnvelopeHeight] = useState<number>(3.0); // m (extrusion)
  const [envelopeX, setEnvelopeX] = useState<number>(-1.0); // origin
  const [envelopeY, setEnvelopeY] = useState<number>(-1.0); // origin
  const [envelopeZ, setEnvelopeZ] = useState<number>(0.0); // origin
  const [envelopeWireframe, setEnvelopeWireframe] = useState<boolean>(false);
  const [envelopeOpacity, setEnvelopeOpacity] = useState<number>(0.12);
  const [envelopePreset, setEnvelopePreset] = useState<string>("skid_filtration");

  // Effect to apply presets
  useEffect(() => {
    if (envelopePreset === "skid_filtration") {
      setEnvelopeLength(6.0); setEnvelopeWidth(4.0); setEnvelopeHeight(3.0);
      setEnvelopeX(-1.0); setEnvelopeY(-1.0); setEnvelopeZ(0.0);
    } else if (envelopePreset === "local_compresseur") {
      setEnvelopeLength(4.5); setEnvelopeWidth(3.0); setEnvelopeHeight(2.5);
      setEnvelopeX(-0.5); setEnvelopeY(-0.5); setEnvelopeZ(0.0);
    } else if (envelopePreset === "chambre_vanne") {
      setEnvelopeLength(3.0); setEnvelopeWidth(3.0); setEnvelopeHeight(2.0);
      setEnvelopeX(0.0); setEnvelopeY(0.0); setEnvelopeZ(0.0);
    } else if (envelopePreset === "corridor_asme") {
      setEnvelopeLength(10.0); setEnvelopeWidth(2.0); setEnvelopeHeight(4.0);
      setEnvelopeX(-2.0); setEnvelopeY(-1.0); setEnvelopeZ(0.0);
    }
  }, [envelopePreset]);

  // Containment checkers
  const checkEnvelopeContainment = (x: number, y: number, z: number) => {
    if (!envelopeActive) return true;
    const minX = envelopeX;
    const maxX = envelopeX + envelopeLength;
    const minY = envelopeY;
    const maxY = envelopeY + envelopeWidth;
    const minZ = envelopeZ;
    const maxZ = envelopeZ + envelopeHeight;
    // Tolerance of 0.001 to prevent floating-point rounding errors
    return x >= (minX - 0.001) && x <= (maxX + 0.001) &&
           y >= (minY - 0.001) && y <= (maxY + 0.001) &&
           z >= (minZ - 0.001) && z <= (maxZ + 0.001);
  };

  const outOfEnvelopeNodes = useMemo(() => {
    if (!envelopeActive) return [];
    return nodes.filter(n => !checkEnvelopeContainment(n.x, n.y, n.z || 0));
  }, [nodes, envelopeActive, envelopeX, envelopeLength, envelopeY, envelopeWidth, envelopeZ, envelopeHeight]);

  const outOfEnvelopeSupports = useMemo(() => {
    if (!envelopeActive) return [];
    return supports.filter(s => !checkEnvelopeContainment(s.worldPos.x, s.worldPos.y, s.worldPos.z || 0));
  }, [supports, envelopeActive, envelopeX, envelopeLength, envelopeY, envelopeWidth, envelopeZ, envelopeHeight]);

  const totalEnvelopeIssues = outOfEnvelopeNodes.length + outOfEnvelopeSupports.length;

  const [autocadCmdInput, setAutocadCmdInput] = useState("");
  const [autocadCmdHistory, setAutocadCmdHistory] = useState<string[]>([]);
  const [autocadHistoryIdx, setAutocadHistoryIdx] = useState(-1);
  const [autocadSuggestions, setAutocadSuggestions] = useState<CadCommandItem[]>([]);
  const [autocadActiveIdx, setAutocadActiveIdx] = useState(0);
  // PATCH 017M : invite lue dans le registre (vocabulaire tuyauterie).
  const [autocadPrompt, setAutocadPrompt] = useState(PDI_INVITE_COMMANDE_017M);
  const [commandPromptHidden, setCommandPromptHidden] = useState<boolean>(() => {
    try { return window.localStorage.getItem("pdi.commandPromptHidden.v1") === "1"; } catch { return false; }
  });
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState<boolean>(() => {
    try { return window.localStorage.getItem("pdi.keyboardShortcutsEnabled.v1") === "1"; } catch { return false; }
  });
  const [workspaceVisualStyle, setWorkspaceVisualStyle] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("pdi.workspaceVisualStyle.v1") || "{}");
      return {
        pipeStrokeScale: Number.isFinite(Number(saved.pipeStrokeScale)) ? Math.min(3, Math.max(0.35, Number(saved.pipeStrokeScale))) : 1,
        cad2dStrokeScale: Number.isFinite(Number(saved.cad2dStrokeScale)) ? Math.min(3, Math.max(0.35, Number(saved.cad2dStrokeScale))) : 1,
        defaultPipeColor: typeof saved.defaultPipeColor === "string" ? saved.defaultPipeColor : "#0EA5E9",
        defaultCadColor: typeof saved.defaultCadColor === "string" ? saved.defaultCadColor : "#E5E7EB",
        colorByService: Boolean(saved.colorByService),
      };
    } catch { return { pipeStrokeScale: 1, cad2dStrokeScale: 1, defaultPipeColor: "#0EA5E9", defaultCadColor: "#E5E7EB", colorByService: false }; }
  });
  const pipeStrokeScale = workspaceVisualStyle.pipeStrokeScale;
  const colorByService = workspaceVisualStyle.colorByService;
  const setColorByService = (val: boolean | ((prev: boolean) => boolean)) => {
    setWorkspaceVisualStyle(prev => ({
      ...prev,
      colorByService: typeof val === "function" ? val(prev.colorByService) : val
    }));
  };
  const [triangleMenuOpen, setTriangleMenuOpen] = useState(false);
  const [arcMenuOpen, setArcMenuOpen] = useState(false);
  const [polygonSidesCount, setPolygonSidesCount] = useState(6);
  const [polygonSidesModalOpen, setPolygonSidesModalOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem("pdi.pipeStrokeScale.v1", String(pipeStrokeScale)); } catch {}
  }, [pipeStrokeScale]);
  useEffect(() => {
    try { window.localStorage.setItem("pdi.commandPromptHidden.v1", commandPromptHidden ? "1" : "0"); } catch {}
  }, [commandPromptHidden]);
  useEffect(() => {
    try { window.localStorage.setItem("pdi.keyboardShortcutsEnabled.v1", keyboardShortcutsEnabled ? "1" : "0"); } catch {}
  }, [keyboardShortcutsEnabled]);
  useEffect(() => {
    try { window.localStorage.setItem("pdi.workspaceVisualStyle.v1", JSON.stringify(workspaceVisualStyle)); } catch {}
  }, [workspaceVisualStyle]);

  // PATCH 017A : Project Setup PD&I persistant (projet, format de tag, services, specs).
  const [projectSetup, setProjectSetup] = useState<PdiProjectSetup>(() => {
    try {
      const raw = window.localStorage.getItem("pdi.projectSetup.v1");
      if (raw) return { ...PDI_DEFAULT_PROJECT_SETUP, ...JSON.parse(raw) };
    } catch {}
    return PDI_DEFAULT_PROJECT_SETUP;
  });
  const [projectSetupOpen, setProjectSetupOpen] = useState(false);
  // PATCH 017C : affichage des tags sur le plan + gestionnaire de donnees.
  const [tagDisplay, setTagDisplay] = useState<boolean>(() => {
    try { return window.localStorage.getItem("pdi.tagDisplay.v1") === "1"; } catch { return false; }
  });
  const [dataManagerOpen, setDataManagerOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem("pdi.tagDisplay.v1", tagDisplay ? "1" : "0"); } catch {}
  }, [tagDisplay]);
  useEffect(() => {
    try { window.localStorage.setItem("pdi.projectSetup.v1", JSON.stringify(projectSetup)); } catch {}
  }, [projectSetup]);

  // PATCH 017Q4-A: Saisie native intégrée au Dispatcher Clavier Central Unifié (voir onGlobalKeyDown)
  const setPipeStrokeScale = (value: number) => setWorkspaceVisualStyle((prev) => ({ ...prev, pipeStrokeScale: Math.min(3, Math.max(0.35, Number(value) || 1)) }));
  const setCad2dStrokeScale = (value: number) => setWorkspaceVisualStyle((prev) => ({ ...prev, cad2dStrokeScale: Math.min(3, Math.max(0.35, Number(value) || 1)) }));
  const setDefaultPipeColor = (value: string) => setWorkspaceVisualStyle((prev) => ({ ...prev, defaultPipeColor: value || prev.defaultPipeColor }));
  const setDefaultCadColor = (value: string) => setWorkspaceVisualStyle((prev) => ({ ...prev, defaultCadColor: value || prev.defaultCadColor }));

  const autocadCmdInputRef = useRef<HTMLInputElement>(null);
  const longPressTimeoutRef = useRef<any>(null);

  const makeCad2dId = (type: Cad2dEntityType) => `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const addCad2dEntity = (entity: Omit<Cad2dEntity, "id">) => {
    const next: Cad2dEntity = { id: makeCad2dId(entity.type), visible: true, locked: false, ...entity };
    setCad2dEntities((prev) => [...prev, next]);
    setSelectedCad2dIds([next.id]);
    setStatusMessage(`Objet 2D ${entity.type} créé · ID réel ${next.id}`);
    return next;
  };
  const prepareCad2dTool = (tool: Cad2dEntityType, subType?: TriangleType | ArcCreationMode, sides?: number) => {
    startCadDraft(tool, subType, sides);
  };

  const startCadDraft = (
    tool: CadDraftSession["tool"],
    subType?: TriangleType | ArcCreationMode,
    sides: number = 6
  ) => {
    setInteractionMode("select");
    setIsoDrawMode("select");
    setCad2dDraftTool(null);
    setCadDraftSession({
      tool,
      subType,
      sides: tool === "polygon" ? sides : (tool === "triangle" ? 3 : undefined),
      step: 0,
      points: [],
      currentLengthInput: "",
      currentWidthInput: "",
      currentAngleInput: "",
      currentRadiusInput: "",
      mouseWorld: { x: 0, y: 0 },
    });
    if (tool === "rectangle") {
      setAutocadPrompt("RECTANGLE [Étape 1/2] : Cliquez le 1er point (ou orientez et tapez la longueur)");
      setStatusMessage("RECTANGLE : Cliquez le 1er point");
    } else if (tool === "triangle") {
      const sub = subType || "equilateral";
      setAutocadPrompt(`TRIANGLE [${sub.toUpperCase()}] : Spécifiez le 1er point`);
      setStatusMessage(`TRIANGLE (${sub}) : Spécifiez le 1er point`);
    } else if (tool === "polygon") {
      setAutocadPrompt(`POLYGONE [${sides} côtés] : Cliquez le centre du polygone`);
      setStatusMessage(`POLYGONE (${sides} côtés) : Cliquez le centre`);
    } else if (tool === "arc") {
      const sub = subType || "3points";
      setAutocadPrompt(sub === "3points" ? "ARC [3 Points] : Cliquez le Point 1 (Début)" : "ARC [Centre-Rayon] : Cliquez le Centre");
      setStatusMessage(`ARC (${sub}) : Spécifiez le 1er point`);
    } else if (tool === "paste_target") {
      setAutocadPrompt("COLLER : Cliquez à l'écran sur le point d'insertion souhaité");
      setStatusMessage("COLLER : Cliquez où positionner");
    } else if (tool === "move_target") {
      setAutocadPrompt("DEPLACER : Cliquez le point de destination");
      setStatusMessage("DEPLACER : Cliquez la destination");
    } else {
      setAutocadPrompt(`${tool.toUpperCase()} : Cliquez dans le plan pour tracer`);
      setStatusMessage(`${tool.toUpperCase()} prêt · cliquez dans le plan`);
    }
  };

  const cancelCadDraft = () => {
    setCadDraftSession(null);
    setCad2dDraftTool(null);
    setCad2dModifySession(null);
    setAutocadPrompt("Prêt. " + PDI_INVITE_COMMANDE_017M);
    setStatusMessage("Action CAO réinitialisée");
  };

  const applyNumericDraftInput = (val1: number, val2?: number) => {
    if (cad2dModifySession) {
      if (cad2dModifySession.mode === "offset") {
        setCad2dModifySession({ ...cad2dModifySession, offsetDist: val1 });
        setAutocadPrompt(`DÉCALER : Distance réglée à ${val1} m. Cliquez l'élément à décaler.`);
        setStatusMessage(`Distance de décalage fixée à ${val1} m`);
        return;
      }
      if (cad2dModifySession.mode === "fillet" || cad2dModifySession.mode === "chamfer") {
        setCad2dModifySession({ ...cad2dModifySession, filletRadius: val1 });
        const lbl = cad2dModifySession.mode === "fillet" ? "RACCORD" : "CHANFREIN";
        setAutocadPrompt(`${lbl} : Rayon réglé à ${val1} m. Cliquez le premier segment.`);
        setStatusMessage(`Rayon fixé à ${val1} m`);
        return;
      }
      if (cad2dModifySession.mode === "scale") {
        applyScaleWithFactorRef.current?.(val1, cad2dModifySession.basePoint);
        return;
      }
    }
    if (!cadDraftSession) return;
    const sess = cadDraftSession;
    if (sess.tool === "rectangle") {
      if (sess.step === 1 && sess.points.length >= 1) {
        const p1 = sess.points[0];
        const angle = sess.mouseWorld ? Math.atan2(sess.mouseWorld.y - p1.y, sess.mouseWorld.x - p1.x) : 0;
        const p2 = { x: Number((p1.x + Math.cos(angle) * val1).toFixed(3)), y: Number((p1.y + Math.sin(angle) * val1).toFixed(3)) };
        if (val2 !== undefined && val2 > 0) {
          const rect = buildAutocadRectangle(p1, p2, val1, undefined, val2);
          addCad2dEntity({
            type: "polygon",
            layerId: "axes_tuyauterie",
            color: "#9CA3AF",
            points: rect.points,
            closed: true,
            lineWeight: 1.5,
            metadata: { intent: "draft", source: "autocad_rect", length: rect.length, width: rect.width },
          });
          setCadDraftSession(null);
          setAutocadPrompt(`Rectangle créé (${val1}m × ${val2}m)`);
          setStatusMessage(`Rectangle créé (${val1}m × ${val2}m)`);
          return;
        }
        setCadDraftSession({
          ...sess,
          step: 2,
          points: [p1, p2],
          length: val1,
        });
        setAutocadPrompt(`RECTANGLE [Étape 2/2] : Longueur = ${val1}m fixée. Spécifiez la largeur par souris ou tapez la largeur.`);
        setStatusMessage(`Longueur fixée (${val1}m) · Spécifiez la largeur`);
      } else if (sess.step === 2 && sess.points.length >= 2) {
        const p1 = sess.points[0];
        const p2 = sess.points[1];
        const rect = buildAutocadRectangle(p1, p2, sess.length || cadDist(p1, p2), sess.mouseWorld, val1);
        addCad2dEntity({
          type: "polygon",
          layerId: "axes_tuyauterie",
          color: "#9CA3AF",
          points: rect.points,
          closed: true,
          lineWeight: 1.5,
          metadata: { intent: "draft", source: "autocad_rect", length: rect.length, width: rect.width },
        });
        setCadDraftSession(null);
        setAutocadPrompt(`Rectangle créé (${rect.length}m × ${rect.width}m)`);
        setStatusMessage(`Rectangle créé (${rect.length}m × ${rect.width}m)`);
      }
    } else if (sess.tool === "polygon") {
      const center = sess.points[0] || sess.center || { x: 0, y: 0 };
      const radius = val1;
      const pts = buildRegularPolygon(center, { x: center.x + radius, y: center.y }, sess.sides || 6);
      addCad2dEntity({
        type: "polygon",
        layerId: "axes_tuyauterie",
        color: "#9CA3AF",
        points: pts,
        closed: true,
        lineWeight: 1.5,
        metadata: { intent: "draft", source: "polygon", sides: sess.sides || 6, radius },
      });
      setCadDraftSession(null);
      setAutocadPrompt(`Polygone régulier (${sess.sides || 6} côtés, Rayon = ${radius}m) créé`);
      setStatusMessage(`Polygone régulier (${sess.sides || 6} côtés) créé`);
    } else if (sess.tool === "triangle") {
      const p1 = sess.points[0] || { x: 0, y: 0 };
      const sub = sess.subType || "equilateral";
      let pts: Cad2dPoint[] = [];
      if (sub === "equilateral") {
        pts = buildEquilateralTriangle(p1, { x: p1.x + val1, y: p1.y });
      } else if (sub === "rectangle") {
        pts = buildRightTriangle(p1, { x: p1.x + val1, y: p1.y }, val2 || val1 * 0.75);
      } else if (sub === "isocele") {
        pts = buildIsoscelesTriangle(p1, { x: p1.x + val1, y: p1.y }, val2 || val1 * 0.86);
      }
      addCad2dEntity({
        type: "polygon",
        layerId: "axes_tuyauterie",
        color: "#9CA3AF",
        points: pts,
        closed: true,
        lineWeight: 1.5,
        metadata: { intent: "draft", source: "triangle", subType: sub },
      });
      setCadDraftSession(null);
      setAutocadPrompt(`Triangle ${sub} créé`);
      setStatusMessage(`Triangle ${sub} créé`);
    } else if (sess.tool === "arc") {
      const center = sess.points[0] || { x: 0, y: 0 };
      const radius = val1;
      const angle = val2 || 90;
      addCad2dEntity({
        type: "arc",
        layerId: "import_cad",
        color: "#9CA3AF",
        center,
        radius,
        startAngle: 0,
        endAngle: angle,
        lineWeight: 1.5,
      });
      setCadDraftSession(null);
      setAutocadPrompt(`Arc (Rayon = ${radius}m, Angle = ${angle}°) créé`);
      setStatusMessage(`Arc créé`);
    }
  };

  // PATCH 007b — 2D manipulation and properties.
  const selectedCad2dEntity = cad2dEntities.find((entity) => selectedCad2dIds.includes(entity.id)) || null;

  // PATCH 007e — palette propriétés CAD / ISO flottante et déplaçable.
  const [cadPropsOpen, setCadPropsOpen] = useState(true);
  const [cadPropsPos, setCadPropsPos] = useState({ x: 96, y: 120 });
  const [railFlyout, setRailFlyout] = useState<"polygon" | "triangle" | "arc" | "shapes" | null>(null);
  const [inlineEditTextId, setInlineEditTextId] = useState<string | null>(null);

  const startCadPropsPointerDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const initialPos = { ...cadPropsPos };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      setCadPropsPos({
        x: Math.max(8, Math.min(initialPos.x + dx, (typeof window !== "undefined" ? window.innerWidth : 1000) - 260)),
        y: Math.max(54, Math.min(initialPos.y + dy, (typeof window !== "undefined" ? window.innerHeight : 800) - 280)),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const finishPolylineDraft = () => {
    if (cadDraftSession?.tool === "polyline" && cadDraftSession.points && cadDraftSession.points.length >= 2) {
      const newEntity = addCad2dEntity({
        type: "polyline",
        layerId: "axes_tuyauterie",
        color: "#9CA3AF",
        points: cadDraftSession.points,
        metadata: { intent: "draft", source: "polyline" },
      });
      setCadDraftSession(null);
      if (newEntity) setSelectedCad2dIds([newEntity.id]);
      setAutocadPrompt(`Polyligne validée (${cadDraftSession.points.length} sommets).`);
      setStatusMessage(`Polyligne créée · ${cadDraftSession.points.length} points`);
    }
  };

  // PATCH 007d — 2D mouse resize modular properties.
  const cad2dPointerRef = useRef<{
    mode: "move" | "grip";
    entityIds: string[];
    grip?: string;
    startX: number;
    startY: number;
    startWorld: Cad2dPoint;
    snapshot: Cad2dEntity[];
  } | null>(null);

  const cad2dApplyDelta = (entity: Cad2dEntity, dx: number, dy: number, grip?: string): Cad2dEntity => {
    if (!grip || grip === "body") {
      return {
        ...entity,
        points: entity.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        center: entity.center ? { x: entity.center.x + dx, y: entity.center.y + dy } : entity.center,
      };
    }
    if (entity.type === "line" && entity.points && entity.points.length >= 2) {
      const points = entity.points.map((p) => ({ ...p }));
      if (grip === "start") points[0] = { x: points[0].x + dx, y: points[0].y + dy };
      if (grip === "end") points[1] = { x: points[1].x + dx, y: points[1].y + dy };
      return { ...entity, points };
    }
    if ((entity.type === "polyline" || entity.type === "polygon" || entity.type === "triangle" || entity.type === "rectangle") && entity.points && entity.points.length && grip.startsWith("v:")) {
      const idx = Number(grip.slice(2));
      const points = entity.points.map((p, i) => (i === idx ? { x: p.x + dx, y: p.y + dy } : { ...p }));
      return { ...entity, points };
    }
    if (entity.type === "circle" && entity.center) {
      if (grip === "center") return { ...entity, center: { x: entity.center.x + dx, y: entity.center.y + dy } };
      if (grip === "radius") {
        const nextRadius = Math.max(0.05, (entity.radius || 1) + dx);
        return { ...entity, radius: nextRadius };
      }
    }
    if (entity.type === "arc" && entity.center) {
      if (grip === "center") return { ...entity, center: { x: entity.center.x + dx, y: entity.center.y + dy } };
      if (grip === "radius") {
        const nextRadius = Math.max(0.05, (entity.radius || 1) + dx);
        return { ...entity, radius: nextRadius };
      }
    }
    if (entity.type === "text" && entity.points && entity.points[0]) {
      return { ...entity, points: [{ x: entity.points[0].x + dx, y: entity.points[0].y + dy }, ...(entity.points.slice(1) || [])] };
    }
    return entity;
  };

  const startCad2dPointer = (event: React.PointerEvent, entityId: string, grip: string = "body") => {
    if (cad2dModifySessionRef.current) {
      event.stopPropagation();
      const w = screenToIsoWorld(event as unknown as React.PointerEvent<SVGSVGElement>);
      handleCad2dModifyPointerDownRef.current({ x: w.x, y: w.y }, event.target as Element);
      return;
    }
    event.stopPropagation();
    pushHistory();
    const w = screenToIsoWorld(event as unknown as React.PointerEvent<SVGSVGElement>);
    const ids = selectedCad2dIds.includes(entityId) ? selectedCad2dIds : [entityId];
    setSelectedCad2dIds(ids);
    cad2dPointerRef.current = {
      mode: grip === "body" ? "move" : "grip",
      entityIds: ids,
      grip,
      startX: event.clientX,
      startY: event.clientY,
      startWorld: { x: w.x, y: w.y },
      snapshot: cad2dEntities.map((entity) => ({
        ...entity,
        points: entity.points?.map((p) => ({ ...p })),
        center: entity.center ? { ...entity.center } : entity.center,
      })),
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setStatusMessage(grip === "body" ? "Déplacement souris 2D" : `Grip 2D · ${grip}`);
  };

  const updateCad2dPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = cad2dPointerRef.current;
    if (!drag) return false;
    const w = screenToIsoWorld(event);
    const rawDx = w.x - drag.startWorld.x;
    const rawDy = w.y - drag.startWorld.y;
    const dx = isoSnapStep > 0 ? snapIsoV4(rawDx, isoSnapStep) : rawDx;
    const dy = isoSnapStep > 0 ? snapIsoV4(rawDy, isoSnapStep) : rawDy;
    const ids = new Set(drag.entityIds);
    setCad2dEntitiesRaw(drag.snapshot.map((entity) => ids.has(entity.id) && !entity.locked ? cad2dApplyDelta(entity, dx, dy, drag.grip) : entity));
    return true;
  };

  const endCad2dPointer = () => {
    if (!cad2dPointerRef.current) return;
    cad2dPointerRef.current = null;
    setStatusMessage("Modification souris 2D validée");
  };

  const rotateSelectedCad2d = (angleDeg: number) => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => prev.map((entity) => {
      if (!ids.has(entity.id) || entity.locked) return entity;
      const rot = ((entity.rotation || 0) + angleDeg) % 360;
      return { ...entity, rotation: rot };
    }));
    setStatusMessage(`Rotation 2D · ${angleDeg > 0 ? "+" : ""}${angleDeg}°`);
  };

  const scaleSelectedCad2d = (factor: number) => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => prev.map((entity) => {
      if (!ids.has(entity.id) || entity.locked) return entity;
      if (entity.radius) {
        return { ...entity, radius: Math.max(0.1, Number((entity.radius * factor).toFixed(2))) };
      }
      if (entity.fontSize) {
        return { ...entity, fontSize: Math.max(6, Math.round((entity.fontSize || 16) * factor)) };
      }
      if (entity.points && entity.points.length >= 2) {
        const cx = entity.points.reduce((sum, p) => sum + p.x, 0) / entity.points.length;
        const cy = entity.points.reduce((sum, p) => sum + p.y, 0) / entity.points.length;
        const points = entity.points.map((p) => ({
          x: cx + (p.x - cx) * factor,
          y: cy + (p.y - cy) * factor,
        }));
        return { ...entity, points };
      }
      return entity;
    }));
    setStatusMessage(`Échelle 2D · x${factor}`);
  };

  const mirrorSelectedCad2dX = () => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => prev.map((entity) => {
      if (!ids.has(entity.id) || entity.locked) return entity;
      if (entity.points && entity.points.length) {
        const cx = entity.points.reduce((sum, p) => sum + p.x, 0) / entity.points.length;
        const points = entity.points.map((p) => ({ x: 2 * cx - p.x, y: p.y }));
        return { ...entity, points };
      }
      return entity;
    }));
    setStatusMessage("Miroir horizontal 2D");
  };

  const bringSelectedCad2dFront = () => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => {
      const rest = prev.filter((e) => !ids.has(e.id));
      const sel = prev.filter((e) => ids.has(e.id));
      return [...rest, ...sel];
    });
    setStatusMessage("Objet(s) 2D mis au premier plan");
  };

  const sendSelectedCad2dBack = () => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => {
      const rest = prev.filter((e) => !ids.has(e.id));
      const sel = prev.filter((e) => ids.has(e.id));
      return [...sel, ...rest];
    });
    setStatusMessage("Objet(s) 2D mis à l'arrière-plan");
  };

  const setSelectedCad2dLocked = (locked: boolean) => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => prev.map((entity) => ids.has(entity.id) ? { ...entity, locked } : entity));
    setStatusMessage(locked ? "Objet(s) 2D verrouillé(s)" : "Objet(s) 2D déverrouillé(s)");
  };

  const updateCad2dEntity = (id: string, patch: Partial<Cad2dEntity>) => {
    setCad2dEntities((prev) => prev.map((entity) => entity.id === id ? { ...entity, ...patch } : entity));
  };

  const moveSelectedCad2d = (dx: number, dy: number) => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => prev.map((entity) => {
      if (!ids.has(entity.id) || entity.locked) return entity;
      return {
        ...entity,
        points: entity.points?.map((point) => ({ x: point.x + dx, y: point.y + dy })),
        center: entity.center ? { x: entity.center.x + dx, y: entity.center.y + dy } : entity.center,
      };
    }));
    setStatusMessage(`Déplacement 2D · ${selectedCad2dIds.length} objet(s)`);
  };

  const duplicateSelectedCad2d = () => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    const clones = cad2dEntities.filter((entity) => ids.has(entity.id)).map((entity) => ({
      ...entity,
      id: makeCad2dId(entity.type),
      points: entity.points?.map((point) => ({ x: point.x + isoSnapStep, y: point.y + isoSnapStep })),
      center: entity.center ? { x: entity.center.x + isoSnapStep, y: entity.center.y + isoSnapStep } : entity.center,
    }));
    setCad2dEntities((prev) => [...prev, ...clones]);
    setSelectedCad2dIds(clones.map((entity) => entity.id));
    setStatusMessage(`${clones.length} objet(s) 2D dupliqué(s) · nouveaux IDs`);
  };

  const deleteSelectedCad2d = () => {
    if (!selectedCad2dIds.length) return;
    const ids = new Set(selectedCad2dIds);
    setCad2dEntities((prev) => prev.filter((entity) => !ids.has(entity.id)));
    setSelectedCad2dIds([]);
    setStatusMessage("Objet(s) 2D supprimé(s)");
  };


  type IsoHistorySnapshot = {
    nodes: IsoNode[];
    segments: IsoSegment[];
    lines: PipingLine[];
    dimensions: IsoDimension[];
    cad2dEntities?: Cad2dEntity[];
    cad2dLayers?: Cad2dLayer[];
    supports?: IsoPipingSupport[];
  };

  const cloneGraph = (
    ns: IsoNode[],
    ss: IsoSegment[],
    ls: PipingLine[],
    ds: IsoDimension[] = dimensions,
    c2d: Cad2dEntity[] = cad2dEntities,
    c2dLayers: Cad2dLayer[] = cad2dLayers,
    sups: IsoPipingSupport[] = supports,
  ): IsoHistorySnapshot => ({
    nodes: ns.map((n) => ({
      ...n,
      ports: n.ports?.map((port) => ({
        ...port,
        connectedSegmentIds: port.connectedSegmentIds ? [...port.connectedSegmentIds] : undefined,
      })),
    })),
    segments: ss.map((s) => ({ ...s, fittings: s.fittings.map((f) => ({ ...f })) })),
    lines: ls.map((line) => ({ ...line })),
    dimensions: ds.map((dimension) => ({
      ...dimension,
      a: { ...dimension.a },
      b: { ...dimension.b },
      offset: dimension.offset ? { ...dimension.offset } : undefined,
    })),
    cad2dEntities: c2d.map((ent) => ({
      ...ent,
      points: ent.points ? ent.points.map((p) => ({ ...p })) : undefined,
      center: ent.center ? { ...ent.center } : undefined,
      metadata: ent.metadata ? { ...ent.metadata } : undefined,
    })),
    cad2dLayers: c2dLayers.map((l) => ({ ...l })),
    supports: sups.map((sup) => ({
      ...sup,
      civilSpec: { ...sup.civilSpec },
      customLoads: sup.customLoads ? { ...sup.customLoads } : undefined,
    })),
  });
  const historyRef = useRef<IsoHistorySnapshot[]>([]);
  const redoRef = useRef<IsoHistorySnapshot[]>([]);
  const historyBusyRef = useRef(false);

  const pushHistory = () => {
    if (historyBusyRef.current) return;
    const snap = cloneGraph(nodes, segments, lines, dimensions, cad2dEntities, cad2dLayers, supports);
    const h = historyRef.current;
    const last = h[h.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
    h.push(snap);
    if (h.length > 60) h.shift();
    redoRef.current = [];
  };
  const setNodes=(next:IsoNode[]|((prev:IsoNode[])=>IsoNode[]))=>{
    if(!historyBusyRef.current)pushHistory();
    setNodesRaw(next);
  };
  const setSegments=(next:IsoSegment[]|((prev:IsoSegment[])=>IsoSegment[]))=>{
    if(!historyBusyRef.current)pushHistory();
    setSegmentsRaw(next);
  };
  const setLines = (
    next: PipingLine[] | ((prev: PipingLine[]) => PipingLine[]),
  ) => {
    if (!historyBusyRef.current) pushHistory();
    setLinesRaw(next);
  };
  const setDimensions = (
    next: IsoDimension[] | ((prev: IsoDimension[]) => IsoDimension[]),
  ) => {
    if (!historyBusyRef.current) pushHistory();
    setDimensionsRaw(next);
  };
  const setCad2dEntities = (
    next: Cad2dEntity[] | ((prev: Cad2dEntity[]) => Cad2dEntity[]),
  ) => {
    if (!historyBusyRef.current) pushHistory();
    setCad2dEntitiesRaw(next);
  };
  const setCad2dLayers = (
    next: Cad2dLayer[] | ((prev: Cad2dLayer[]) => Cad2dLayer[]),
  ) => {
    if (!historyBusyRef.current) pushHistory();
    setCad2dLayersRaw(next);
  };
  const setSupports = (
    next: IsoPipingSupport[] | ((prev: IsoPipingSupport[]) => IsoPipingSupport[]),
  ) => {
    if (!historyBusyRef.current) pushHistory();
    setSupportsRaw(next);
  };
  const commitGraph = (
    nextNodes: IsoNode[],
    nextSegments: IsoSegment[],
    nextLines: PipingLine[] = lines,
    nextDimensions: IsoDimension[] = dimensions,
    nextCad2d: Cad2dEntity[] = cad2dEntities,
    nextCad2dLayers: Cad2dLayer[] = cad2dLayers,
    nextSupports: IsoPipingSupport[] = supports,
  ) => {
    if (!historyBusyRef.current) pushHistory();
    historyBusyRef.current = true;
    // PATCH 017P2 : les faces suivent la geometrie reelle et les coudes
    // sont ramenes sur l angle normalise le plus proche.
    const pdiReor = pdiReorientPorts(nextNodes, nextSegments, { adaptElbows: true });
    const updatedSupports = (nextSupports || []).map(s => {
      const seg = nextSegments.find(sg => sg.id === s.segmentId);
      if (!seg) return s;
      const fn = pdiReor.nodes.find(n => n.id === seg.fromNodeId);
      const tn = pdiReor.nodes.find(n => n.id === seg.toNodeId);
      if (!fn || !tn) return s;
      const t = s.tRatio ?? 0.5;
      const wx = Number((fn.x + t * (tn.x - fn.x)).toFixed(3));
      const wy = Number((fn.y + t * (tn.y - fn.y)).toFixed(3));
      const wz = Number(((fn.z || 0) + t * ((tn.z || 0) - (fn.z || 0))).toFixed(3));
      return {
        ...s,
        worldPos: { x: wx, y: wy, z: wz },
        elevationZ: wz,
      };
    });
    setNodesRaw(pdiReor.nodes);
    setSegmentsRaw(nextSegments);
    setLinesRaw(nextLines);
    setDimensionsRaw(nextDimensions);
    setCad2dEntitiesRaw(nextCad2d);
    setCad2dLayersRaw(nextCad2dLayers);
    setSupportsRaw(updatedSupports);
    setTimeout(() => {
      historyBusyRef.current = false;
    }, 0);
  };
  const [selectedSegmentId,setSelectedSegmentId]=useState<string|null>(null);
  const [selectedNodeId,setSelectedNodeId]=useState<string|null>(null);
  const [interactionMode,setInteractionMode]=useState<"main"|"select"|"orbit">("select");
  // V4.6 — poste de travail
  // PATCH 017F1B : plus d ouverture automatique des panneaux a l ouverture
  // d une session. L etat choisi par l utilisateur est memorise.
  const [leftPanelOpen,setLeftPanelOpen]=useState<boolean>(()=>{
    try{return window.localStorage.getItem("pdi.leftPanelOpen.v1")==="1";}catch{return false;}
  });
  // 007d: l'ISO plein écran est le workspace principal de PD&I.
  const [workspaceFullscreen,setWorkspaceFullscreen]=useState(true);
  // V4.8_DARK_WORKSPACE_STUDIO : shell CAO plein écran limité à PD & I.
  const [studioLayout,setStudioLayout]=useState<"design"|"data"|"control">("design");
  useEffect(() => {
    if (!workspaceFullscreen) return;
    // V4.8d1_WORKSPACE_CAO_FIXED : le navigateur ne scrolle plus la page.
    // La molette est réservée au zoom/pan de la zone de travail.
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyHeight = document.body.style.height;
    const previousHtmlHeight = document.documentElement.style.height;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.height = "100vh";
    document.documentElement.style.height = "100vh";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.height = previousBodyHeight;
      document.documentElement.style.height = previousHtmlHeight;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [workspaceFullscreen]);
  const [shortcutsOpen,setShortcutsOpen]=useState(false);
  const [commandPaletteOpen,setCommandPaletteOpen]=useState(false);
  const [aboutOpen,setAboutOpen]=useState(false);
  const [printModalOpen,setPrintModalOpen]=useState(false);
  const [weldSpoolModalOpen, setWeldSpoolModalOpen] = useState(false);
  const [solid3dViewerOpen, setSolid3dViewerOpen] = useState(false);
  const [workspaceConfigModalOpen, setWorkspaceConfigModalOpen] = useState(false);
  const [workspaceConfig, setWorkspaceConfig] = useState<PdiWorkspaceConfig>(() => {
    return (
      pdiWorkspaceBus.readConfig() || {
        mode: "single_screen",
        profile: "conception_3d",
        screen1View: "iso",
        screen2View: "3d",
        syncSelection: true,
        syncModel: true,
        syncCamera: true,
        autoOpenSecondaryWindow: false,
      }
    );
  });
  const [isSecondaryConnected, setIsSecondaryConnected] = useState<boolean>(() => pdiWorkspaceBus.isSecondaryWindowConnected());
  const [colorBySpool, setColorBySpool] = useState(false);
  const [activeSpoolFilter, setActiveSpoolFilter] = useState<string | null>(null);
  const [weldOverrides, setWeldOverrides] = useState<Record<string, Partial<PdiWeldEntry>>>({});
  const [printWeldMapMode, setPrintWeldMapMode] = useState(false);
  const [libraryQuery,setLibraryQuery]=useState("");
  const [libraryRightOpen, setLibraryRightOpen] = useState(true);
  const [libraryCategoryTab, setLibraryCategoryTab] = useState<"all"|"vannes"|"raccords"|"brides"|"equipements"|"gc"|"trouvay"|"trigo2d">("all");
  const [draggedEquipmentType,setDraggedEquipmentType]=useState<IsoFittingType|null>(null);
  const [statusMessage,setStatusMessage]=useState("Prêt");
  const [selectedNodeIds,setSelectedNodeIds]=useState<string[]>([]);
  // PATCH 017Q4-A: Unification de l'état de sélection - selectedNodeIds est la source de vérité unique.
  useEffect(() => {
    const primaryId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;
    if (selectedNodeId !== primaryId) {
      setSelectedNodeId(primaryId);
    }
  }, [selectedNodeIds]);
  const [selectedSegmentIds,setSelectedSegmentIds]=useState<string[]>([]);
  const [selectedFittingIds,setSelectedFittingIds]=useState<string[]>([]);
  const [selectedFitting,setSelectedFitting]=useState<{segmentId:string;fittingId:string}|null>(null);
  useEffect(()=>{
    if(!segments.length) return;
    const legacy=segments.some(s=>s.fittings.length);
    const migrated=legacy?migrateLegacyFittings(nodes,segments):{nodes,segments,changed:false};
    const normalized=normalizedGraphPorts(migrated.nodes,migrated.segments);
    if(migrated.changed||normalized.changed){
      historyBusyRef.current=true;
      setNodesRaw(normalized.nodes);
      setSegmentsRaw(normalized.segments);
      setTimeout(()=>{historyBusyRef.current=false;},0);
    }
  },[segments.length]);
  const dragSelectionRef=useRef<{
    startScreen: { x: number; y: number };
    start: { x: number; y: number; z: number };
    nodes: Map<string, { x: number; y: number; z: number }>;
    isDragging: boolean;
    clickedEntity?: {
      type: "node" | "segment" | "support";
      id: string;
      wasAlreadySelected: boolean;
      additive: boolean;
    };
  } | null>(null);
  const dragChangedRef=useRef(false);
  const lastEquipmentDropRef=useRef<{key:string;at:number}|null>(null);

  // State curseur trièdre pendant le déplacement (SKETCH-DETECT-08 / PARTIE 2)
  const [axisCursorEnabled, setAxisCursorEnabled] = useState<boolean>(false);
  const [dragCursorPos, setDragCursorPos] = useState<{ x: number; y: number } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "node" | "segment" | "fitting" | "canvas" | "cad2d";
    id?: string;
    data?: any;
  } | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<{
    type: "node" | "segment" | "fitting" | "port";
    id: string;
    label?: string;
  } | null>(null);
  const [activeSnap, setActiveSnap] = useState<{
    kind: "PORT" | "ENDPOINT" | "MIDPOINT" | "AXIS" | "GRID";
    label: string;
    worldPos: { x: number; y: number; z: number };
    screenPos: { x: number; y: number };
  } | null>(null);

  const [projectName,setProjectName]=useState("Schéma isométrique tuyauterie gaz");
  const [wilaya,setWilaya]=useState("Site Central / Région Industrielle");
  const [pressDesign,setPressDesign]=useState(40);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [showGrid,setShowGrid]=useState(true);
  const [showDimensions,setShowDimensions]=useState(true);
  // V4.7.3b_PIPE_LABEL_LAYER : calque indépendant des cartouches pipeline.
  const [showPipeLabels,setShowPipeLabels]=useState(true);
  const [showLabels,setShowLabels]=useState(true);
  const [showWelds,setShowWelds]=useState(true);
  const projectIdRef=useRef(uid("project"));
  const projectCreatedAtRef=useRef(new Date().toISOString());
  const [recoveryCandidate,setRecoveryCandidate]=useState<IsoProjectFileV474|null>(null);
  const [recoveryChecked,setRecoveryChecked]=useState(false);
  const [recoverySource,setRecoverySource]=useState<"current"|"previous"|"legacy"|null>(null);
  const [recoveryFailure,setRecoveryFailure]=useState<string|null>(null);
  // V4.7.4c_DIRTY_BASELINE : ne sauver que les changements réels.
  const autosaveBaselineRef=useRef<string|null>(null);
  const [saveState,setSaveState]=useState<"idle"|"modified"|"autosaved"|"error">("idle");
  const [lastSavedAt,setLastSavedAt]=useState<string|null>(null);
  const [topbarProfileOpen, setTopbarProfileOpen] = useState(false);

  const [viewportRaw, setViewportRaw] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
    viewMode: "iso",
    yaw: -Math.PI / 4,
    pitch: Math.PI / 6
  });

  const viewport = viewportRaw;

  const projEnvelope = useMemo(() => {
    const corners = [
      { x: envelopeX, y: envelopeY, z: envelopeZ }, // 0: bottom-back-left
      { x: envelopeX + envelopeLength, y: envelopeY, z: envelopeZ }, // 1: bottom-back-right
      { x: envelopeX + envelopeLength, y: envelopeY + envelopeWidth, z: envelopeZ }, // 2: bottom-front-right
      { x: envelopeX, y: envelopeY + envelopeWidth, z: envelopeZ }, // 3: bottom-front-left
      { x: envelopeX, y: envelopeY, z: envelopeZ + envelopeHeight }, // 4: top-back-left
      { x: envelopeX + envelopeLength, y: envelopeY, z: envelopeZ + envelopeHeight }, // 5: top-back-right
      { x: envelopeX + envelopeLength, y: envelopeY + envelopeWidth, z: envelopeZ + envelopeHeight }, // 6: top-front-right
      { x: envelopeX, y: envelopeY + envelopeWidth, z: envelopeZ + envelopeHeight }, // 7: top-front-left
    ];

    return corners.map(c => isoProjectV4(c.x, c.y, c.z, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch));
  }, [envelopeX, envelopeLength, envelopeY, envelopeWidth, envelopeZ, envelopeHeight, viewport]);

  const setViewport = (next: any | ((prev: any) => any)) => {
    setViewportRaw(prev => {
      const computed = typeof next === "function" ? next(prev) : next;
      return {
        viewMode: prev.viewMode || "iso",
        yaw: prev.yaw ?? -Math.PI / 4,
        pitch: prev.pitch ?? Math.PI / 6,
        ...computed
      };
    });
  };

  // Synchronously update projection globals during render for real-time camera updates
  isoState.viewMode = viewport.viewMode || "iso";
  isoState.yaw = viewport.yaw ?? -Math.PI / 4;
  isoState.pitch = viewport.pitch ?? Math.PI / 6;

  if (nodes.length > 0) {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (let i = 0; i < nodes.length; i++) {
      sumX += nodes[i].x;
      sumY += nodes[i].y;
      sumZ += nodes[i].z || 0;
    }
    isoState.modelCenter = {
      x: sumX / nodes.length,
      y: sumY / nodes.length,
      z: sumZ / nodes.length
    };
  } else {
    isoState.modelCenter = { x: 0, y: 0, z: 0 };
  }

  const orbitDrag = useRef<{ x: number; y: number; startYaw: number; startPitch: number } | null>(null);
  const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const rightClickStartRef = useRef<{ x: number; y: number } | null>(null);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const touchPinchStateRef = useRef<{
    initialDist: number;
    initialZoom: number;
    centerSx: number;
    centerSy: number;
    initialPanX: number;
    initialPanY: number;
    initialMidClientX: number;
    initialMidClientY: number;
  } | null>(null);

  const [nodeName,setNodeName]=useState("Nouveau point");
  const [nodeType,setNodeType]=useState<IsoNodeType>("normal");

  const [fromNode,setFromNode]=useState("");
  const [toNode,setToNode]=useState("");
  const [newDN,setNewDN]=useState(150);
  const [newPN,setNewPN]=useState(()=>pdiClasseDeSpec017K3(projectSetup));  // 017K3 : la spec fixe la classe, pas une valeur en dur.
  const [newLength,setNewLength]=useState(3);
  const [newMaterial,setNewMaterial]=useState(()=>pdiMateriauDeSpec017K3(projectSetup));  // 017K3 : materiau lu dans la spec.
  const [newSegmentColor,setNewSegmentColor]=useState("#0284c7");
  const [newSourceName,setNewSourceName]=useState("");

  const [fitType,setFitType]=useState<IsoFittingType>("vanne_passage_total");
  const [fitLabel,setFitLabel]=useState(FITTING_LABELS.vanne_passage_total);
  const [fitPos,setFitPos]=useState(.5);

  const [edit,setEdit]=useState<{segmentId:string;fitting:IsoFitting}|null>(null);
  const svgRef=useRef<SVGSVGElement>(null);

  // === ISO V4 : édition graphique & sélections ===
  const [isoDrawMode,setIsoDrawMode]=useState<IsoDrawMode>("select");
  const [drawStartNodeId,setDrawStartNodeId]=useState<string|null>(null);
  const [tubeHoverWorld, setTubeHoverWorld] = useState<{ x: number; y: number; z: number } | null>(null);
  const [gcVisibleEditor,setGcVisibleEditor]=useState(true);
  const [isoSnapStep,setIsoSnapStep]=useState(.25);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapPorts, setSnapPorts] = useState(true);
  const [snapEndpoints, setSnapEndpoints] = useState(true);
  const [snapMidpoints, setSnapMidpoints] = useState(true);
  const [snapGrid, setSnapGrid] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(()=>{
    try{return window.localStorage.getItem("pdi.rightPanelOpen.v1")==="1";}catch{return false;}
  });
  const [autoHideRightPanel, setAutoHideRightPanel] = useState(false);
  // PATCH 017F1B : memorisation de l etat des deux panneaux.
  useEffect(()=>{
    try{window.localStorage.setItem("pdi.leftPanelOpen.v1",leftPanelOpen?"1":"0");}catch{}
  },[leftPanelOpen]);
  useEffect(()=>{
    try{window.localStorage.setItem("pdi.rightPanelOpen.v1",rightPanelOpen?"1":"0");}catch{}
  },[rightPanelOpen]);
  const [rightPanelHovered, setRightPanelHovered] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"properties" | "bom" | "dimensions" | "snap" | "layers" | "supports" | "volume">("properties");
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);
  // PATCH 004b : selection multiple de cotations. selectedDimensionId reste la
  // cotation ACTIVE (aucun panneau existant n'est casse) ; selectedDimensionIds
  // porte la selection reelle.
  const [selectedDimensionIds, setSelectedDimensionIds] = useState<string[]>([]);
  const [dragNodeId,setDragNodeId]=useState<string|null>(null);
  const [dragFittingInfo,setDragFittingInfo]=useState<{segmentId:string;fittingId:string}|null>(null);
  const [nodeZ, setNodeZ] = useState<number>(0);
  const [branchDrawing, setBranchDrawing] = useState<{fromNodeId:string; fromPortId?:string; handleIndex?:number; currentWorldPos:{x:number;y:number;z:number}}|null>(null);
  const [dimensionPick, setDimensionPick] = useState<IsoDimensionAnchor | null>(null);

  // 017Q : Wizards interactifs par étapes pour Aligner et Rendre parallèle selon objet & orientation
  const [alignWizard, setAlignWizard] = useState<{
    step: 1 | 2 | 3;
    refSegmentId?: string;
    refNodeId?: string;
    refLabel?: string;
    targetSegmentId?: string;
    targetNodeId?: string;
    targetNodeIds?: string[];
    targetLabel?: string;
  } | null>(null);

  const [parallelWizard, setParallelWizard] = useState<{
    step: 1 | 2;
    refSegmentId?: string;
    refLabel?: string;
  } | null>(null);

  // ===== PATCH 004 : edition professionnelle =====
  // Menu contextuel (clic droit) et panneau de proprietes.
  const [ctxMenu,setCtxMenu]=useState<{x:number;y:number}|null>(null);
  const [propsOpen,setPropsOpen]=useState(false);
  // Un geste souris = une seule entree d'historique (operation logique).
  const gestureDirtyRef=useRef(false);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    additive: boolean;
    baselineNodeIds: string[];
    baselineSegIds: string[];
    // PATCH 004b : base de reference des cotations pour le Shift+rectangle.
    baselineDimIds: string[];
    baselineCad2dIds: string[];
    active: boolean;
  } | null>(null);
  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const [propertiesActiveTab, setPropertiesActiveTab] = useState<"all" | "segments" | "nodes" | "fittings" | "bom" | "welds" | "general">("all");
  const [propertiesSearch, setPropertiesSearch] = useState("");
  // PATCH 004b : le presse-papiers transporte aussi les cotations internes.
  const clipboardRef = useRef<{ nodes: IsoNode[]; segments: IsoSegment[]; dimensions: IsoDimension[] } | null>(null);

  // ===== CORE TUBE & SEGMENT CREATION ENGINE =====
  const createSegmentFromNodes = (
    fromId: string,
    toId: string,
    fromPortId?: string,
    toPortId?: string
  ): string | null => {
    if (!fromId || !toId || fromId === toId) {
      setStatusMessage("Impossible de créer un tube : veuillez désigner deux nœuds distincts.");
      return null;
    }
    const a = nodes.find((n) => n.id === fromId);
    const b = nodes.find((n) => n.id === toId);
    if (!a || !b) {
      setStatusMessage("Nœud introuvable pour la création du tube.");
      return null;
    }

    // Vérifier si un tronçon existe déjà entre ces 2 nœuds
    const existing = segments.find(
      (s) =>
        (s.fromNodeId === fromId && s.toNodeId === toId) ||
        (s.fromNodeId === toId && s.toNodeId === fromId),
    );
    if (existing) {
      setSelectedSegmentId(existing.id);
      setSelectedSegmentIds([existing.id]);
      setStatusMessage(`Un tronçon (${existing.tag || "DN" + existing.dn}) relie déjà ces deux nœuds.`);
      setAutocadPrompt(`Tronçon existant sélectionné : ${a.name} ➔ ${b.name} (${existing.tag || existing.id})`);
      return existing.id;
    }

    // Initialiser les ports si absents
    let nextNodes = [...nodes];
    let nodeA = a;
    let nodeB = b;
    if (!nodeA.ports || nodeA.ports.length === 0) {
      nodeA = { ...nodeA, ports: defaultFreeNodePorts() };
      nextNodes = nextNodes.map((n) => (n.id === nodeA.id ? nodeA : n));
    }
    if (!nodeB.ports || nodeB.ports.length === 0) {
      nodeB = { ...nodeB, ports: defaultFreeNodePorts() };
      nextNodes = nextNodes.map((n) => (n.id === nodeB.id ? nodeB : n));
    }

    const length = Math.max(
      0.05,
      Math.hypot(nodeB.x - nodeA.x, nodeB.y - nodeA.y, (nodeB.z || 0) - (nodeA.z || 0)),
    );
    const resolvedFromPortId =
      fromPortId || availablePortId(nodeA, segments, 1) || nodeA.ports?.[0]?.id || "p0";
    const resolvedToPortId =
      toPortId || availablePortId(nodeB, segments, 0) || nodeB.ports?.[0]?.id || "p0";

    const seg: IsoSegment = {
      id: uid("seg"),
      fromNodeId: fromId,
      fromPortId: resolvedFromPortId,
      toNodeId: toId,
      toPortId: resolvedToPortId,
      lineId: DEFAULT_LINE_ID,
      dn: newDN,
      pn: newPN,
      material: newMaterial,
      length: Number(length.toFixed(3)),
      type: Math.abs((nodeB.z || 0) - (nodeA.z || 0)) > 0.05 ? "riser" : "straight",
      fittings: [],
      color: newSegmentColor,
      sourceName: newSourceName.trim() || `${dia(newDN).inch} — Pipeline`,
      tag: `${newDN}-L-${segments.length + 1}`,
      service: "PROC",
      spec: "PMS-01",
    };

    const nextSegments = [...segments, seg];
    commitGraph(nextNodes, nextSegments);
    setSelectedSegmentId(seg.id);
    setSelectedSegmentIds([seg.id]);
    setSelectedFitting(null);
    setSelectedNodeId(toId);
    setSelectedNodeIds([toId]);
    setStatusMessage(`Tube DN${newDN} créé avec succès entre ${nodeA.name} et ${nodeB.name} (L = ${length.toFixed(2)}m)`);
    setAutocadPrompt(`Tube créé : ${nodeA.name} ➔ ${nodeB.name} (DN${newDN}, L=${length.toFixed(2)}m, tag: ${seg.tag})`);
    return seg.id;
  };

  const createTubeFromSelection = (): string | null => {
    if (selectedNodeIds.length === 2) {
      return createSegmentFromNodes(selectedNodeIds[0], selectedNodeIds[1]);
    } else if (selectedNodeIds.length > 2) {
      let lastId: string | null = null;
      for (let i = 0; i < selectedNodeIds.length - 1; i++) {
        lastId = createSegmentFromNodes(selectedNodeIds[i], selectedNodeIds[i + 1]);
      }
      return lastId;
    } else if (selectedNodeIds.length === 1) {
      setIsoDrawMode("segment");
      setInteractionMode("select");
      setDrawStartNodeId(selectedNodeIds[0]);
      const n = nodes.find((item) => item.id === selectedNodeIds[0]);
      setStatusMessage(`Point 1 fixé (${n?.name || selectedNodeIds[0]}). Cliquez sur le deuxième nœud d'arrivée pour créer le tube (ou Échap).`);
      setAutocadPrompt(`TUBE [Étape 2/2] : Cliquez sur le deuxième nœud d'arrivée (${n?.name || selectedNodeIds[0]} ➔ ?)`);
      return null;
    } else {
      setIsoDrawMode("segment");
      setInteractionMode("select");
      setDrawStartNodeId(null);
      setStatusMessage("Mode Tube actif · Cliquez sur le premier nœud de départ");
      setAutocadPrompt("TUBE [Étape 1/2] : Cliquez sur le premier nœud de départ");
      return null;
    }
  };

  const handleNodeClickForTube = (id: string) => {
    if (!drawStartNodeId) {
      setDrawStartNodeId(id);
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
      const n = nodes.find((item) => item.id === id);
      setStatusMessage(`Point 1 fixé (${n?.name || id}). Cliquez sur le 2ème nœud d'arrivée pour créer le tube (ou Échap).`);
      setAutocadPrompt(`TUBE [Étape 2/2] : Cliquez sur le deuxième nœud pour relier avec ${n?.name || id}`);
    } else {
      if (drawStartNodeId === id) {
        setStatusMessage("Point de départ déjà sélectionné. Cliquez sur un autre nœud pour créer le tube.");
        return;
      }
      const createdId = createSegmentFromNodes(drawStartNodeId, id);
      if (createdId) {
        setDrawStartNodeId(id); // Chaînage continu comme dans AutoCAD / Plant 3D
      }
    }
  };

  // PATCH 017Q4-A: Gestionnaire de clavier unifié délégué au Dispatcher Central Unifié (onGlobalKeyDown)

  const cumulative=useMemo(()=>cumulativeData(nodes,segments),[nodes,segments]);
  const totalLength=useMemo(()=>segments.reduce((a,s)=>a+s.length,0),[segments]);
  const totalWeight=useMemo(()=>segments.reduce((a,s)=>a+s.length*dia(s.dn).weight,0),[segments]);
  const totalVolume=useMemo(()=>segments.reduce((a,s)=>{
    const d=Math.max(1,dia(s.dn).od-14)/1000;
    return a+Math.PI*(d/2)**2*s.length*1000;
  },0),[segments]);
  const hydrotest=pressDesign*1.5;
  const projectJoints=useMemo(()=>deriveProjectJoints(nodes,segments),[nodes,segments]);
  // PATCH 017I2 : projection des noeuds stockee dans un Float32Array.
  // Un objet {x,y} par noeud et par rendu saturait le ramasse-miettes ;
  // ici deux flottants contigus par noeud, recalcules seulement quand les
  // noeuds ou le viewport changent.
  const projCacheStats017I2 = useRef({ count: 0, bytes: 0, ms: 0, builds: 0 });
  const nodeById017I2 = useMemo(() => {
    const m = new Map<string, IsoNode>();
    for (let i = 0; i < nodes.length; i += 1) m.set(nodes[i].id, nodes[i]);
    return m;
  }, [nodes]);
  const nodeProjection017I2 = useMemo(() => {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const buffer = new Float32Array(nodes.length * 2);
    const index = new Map<string, number>();
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      const p = isoProjectV4(n.x, n.y, n.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
      buffer[i * 2] = p.x;
      buffer[i * 2 + 1] = p.y;
      index.set(n.id, i);
    }
    const t1 = typeof performance !== "undefined" ? performance.now() : 0;
    projCacheStats017I2.current = {
      count: nodes.length,
      bytes: buffer.byteLength,
      ms: Number((t1 - t0).toFixed(3)),
      builds: projCacheStats017I2.current.builds + 1,
    };
    return { buffer, index };
  }, [nodes, viewport.zoom, viewport.panX, viewport.panY, viewport.yaw, viewport.pitch, viewport.viewMode]);
  const projectNodeCached017I2 = (node: IsoNode) => {
    const i = nodeProjection017I2.index.get(node.id);
    if (i === undefined) return isoProjectV4(node.x, node.y, node.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
    return { x: nodeProjection017I2.buffer[i * 2], y: nodeProjection017I2.buffer[i * 2 + 1] };
  };
  const editorAnnotationMap = useMemo(
    () => buildIsoAnnotationLayout(nodes, segments, projectJoints, viewport),
    [nodes, segments, projectJoints, viewport.zoom, viewport.panX, viewport.panY, viewport.yaw, viewport.pitch, viewport.viewMode]
  );
  // PATCH 017P9 : le graphe d anomalies est desormais l union des deux jeux
  // de regles. Bandeau, panneau Controle du reseau, volet Anomalies et barre
  // d etat lisent tous cette seule liste.
  const graphIssues=useMemo(()=>pdiUnifyAnomalies017P9(validateProjectGraph(nodes,segments,lines),nodes,segments,(codeSpec:string,dn:number)=>{const so=pdiFindSpec(projectSetup,codeSpec);return so?pdiSpecAllowsDn(so,dn):true;}),[nodes,segments,lines,projectSetup]);
  const graphErrorCount=graphIssues.filter(i=>i.severity==="error").length;
  const graphWarningCount=graphIssues.filter(i=>i.severity==="warning").length;

  const resetView = (
    overrideNodes?: IsoNode[] | unknown,
    overrideSegments?: IsoSegment[],
    overrideDimensions?: IsoDimension[],
    overrideCad2d?: Cad2dEntity[],
    overrideViewMode?: string
  ) => {
    const activeNodes = Array.isArray(overrideNodes) ? overrideNodes : nodes;
    const activeSegments = Array.isArray(overrideSegments) ? overrideSegments : segments;
    const activeDimensions = Array.isArray(overrideDimensions) ? overrideDimensions : dimensions;
    const activeCad2d = Array.isArray(overrideCad2d) ? overrideCad2d : cad2dEntities;

    const targetMode = overrideViewMode || viewport.viewMode || "iso";
    const initialYP = getInitialYawPitchForMode(targetMode, viewport.yaw, viewport.pitch);
    const targetYaw = targetMode === "iso" ? -Math.PI / 4 : (targetMode === "top" ? 0 : (targetMode === "front" ? 0 : (targetMode === "side" ? Math.PI / 2 : (viewport.yaw ?? initialYP.yaw))));
    const targetPitch = targetMode === "iso" ? Math.PI / 6 : (targetMode === "top" ? Math.PI / 2 - 0.01 : (targetMode === "front" ? 0.02 : (targetMode === "side" ? 0.02 : (viewport.pitch ?? initialYP.pitch))));
    const currentAxes = getProjectionAxes(targetMode, targetYaw, targetPitch);

    let sumX = 0, sumY = 0, sumZ = 0;
    if (activeNodes.length > 0) {
      for (let i = 0; i < activeNodes.length; i++) {
        sumX += activeNodes[i].x;
        sumY += activeNodes[i].y;
        sumZ += activeNodes[i].z || 0;
      }
      isoState.modelCenter = {
        x: sumX / activeNodes.length,
        y: sumY / activeNodes.length,
        z: sumZ / activeNodes.length
      };
    }

    // Collect all base world projection points from nodes, segments, cad2d, dimensions
    const basePoints: Array<{ x: number; y: number }> = [];

    const projectPointBase = (x: number, y: number, z: number = 0) => {
      const sz = typeof z === "number" && !isNaN(z) ? z : 0;
      const sx = typeof x === "number" && !isNaN(x) ? x : 0;
      const sy = typeof y === "number" && !isNaN(y) ? y : 0;
      let rx = sx;
      let ry = sy;
      let rz = sz;
      if (targetMode === "free") {
        rx = sx - isoState.modelCenter.x;
        ry = sy - isoState.modelCenter.y;
        rz = sz - isoState.modelCenter.z;
      }
      return {
        x: (rx * currentAxes.dx_x + ry * currentAxes.dx_y + rz * currentAxes.dx_z) * 28,
        y: (rx * currentAxes.dy_x + ry * currentAxes.dy_y + rz * currentAxes.dy_z) * 28
      };
    };

    // 1) Graph Nodes
    for (const n of activeNodes) {
      basePoints.push(projectPointBase(n.x, n.y, n.z || 0));
    }

    // 2) Segments endpoints
    for (const s of activeSegments) {
      const ep = segmentEndpoints(s, activeNodes, activeSegments);
      if (ep) {
        basePoints.push(projectPointBase(ep.from.x, ep.from.y, ep.from.z || 0));
        basePoints.push(projectPointBase(ep.to.x, ep.to.y, ep.to.z || 0));
      }
    }

    // 3) CAD 2D Entities
    for (const entity of activeCad2d) {
      if (entity.visible === false) continue;
      const z = entity.metadata?.elevationZ || 0;
      if (entity.points) {
        for (const p of entity.points) {
          basePoints.push(projectPointBase(p.x, p.y, z));
        }
      }
      if (entity.center) {
        const c = projectPointBase(entity.center.x, entity.center.y, z);
        const r = (entity.radius || 1) * 18;
        basePoints.push({ x: c.x - r, y: c.y - r });
        basePoints.push({ x: c.x + r, y: c.y + r });
      }
    }

    // 4) Dimensions
    for (const d of activeDimensions) {
      const aw = resolveDimensionAnchor(d.a);
      const bw = resolveDimensionAnchor(d.b);
      if (aw) basePoints.push(projectPointBase(aw.x, aw.y, aw.z || 0));
      if (bw) basePoints.push(projectPointBase(bw.x, bw.y, bw.z || 0));
    }

    if (basePoints.length === 0) {
      setViewport({ zoom: 1, panX: 0, panY: 0, viewMode: targetMode, yaw: targetYaw, pitch: targetPitch });
      setStatusMessage("Vue recentrée (origine 0,0,0)");
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of basePoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const midBaseX = (minX + maxX) / 2;
    const midBaseY = (minY + maxY) / 2;

    const availW = 620 - 90;
    const availH = 400 - 70;

    let fitZoom = 1;
    if (spanX > 5 || spanY > 5) {
      fitZoom = Math.min(availW / spanX, availH / spanY);
      fitZoom = clamp(fitZoom, 0.05, 12);
    }

    const panX = Math.round(-midBaseX * fitZoom);
    const panY = Math.round(-midBaseY * fitZoom);

    setViewport({
      zoom: Number(fitZoom.toFixed(3)),
      panX,
      panY,
      viewMode: targetMode,
      yaw: targetYaw,
      pitch: targetPitch
    });
    setStatusMessage(`Vue ajustée au modèle (${Math.round(fitZoom * 100)}%)`);
  };
  const zoomIn=()=>setViewport(v=>{
    const nextZoom = clamp(v.zoom * 1.25, 0.02, 100);
    const factor = nextZoom / v.zoom;
    const panX = (310 - 310) - (310 - 310 - v.panX) * factor;
    const panY = (200 - 210) - (200 - 210 - v.panY) * factor;
    return { zoom: Number(nextZoom.toFixed(3)), panX: Math.round(panX), panY: Math.round(panY) };
  });
  const zoomOut=()=>setViewport(v=>{
    const nextZoom = clamp(v.zoom / 1.25, 0.02, 100);
    const factor = nextZoom / v.zoom;
    const panX = (310 - 310) - (310 - 310 - v.panX) * factor;
    const panY = (200 - 210) - (200 - 210 - v.panY) * factor;
    return { zoom: Number(nextZoom.toFixed(3)), panX: Math.round(panX), panY: Math.round(panY) };
  });

  // PATCH 004 : application d'un instantane, partagee par undo et redo (incluant éléments 2D et supports).
  const applyGraphSnapshot=(snap: IsoHistorySnapshot)=>{
    historyBusyRef.current=true;
    setNodesRaw(snap.nodes);
    setSegmentsRaw(snap.segments);
    setLinesRaw(snap.lines);
    setDimensionsRaw(snap.dimensions || []);
    if (snap.cad2dEntities !== undefined) {
      setCad2dEntitiesRaw(snap.cad2dEntities);
    }
    if (snap.cad2dLayers !== undefined) {
      setCad2dLayersRaw(snap.cad2dLayers);
    }
    if (snap.supports !== undefined) {
      setSupportsRaw(snap.supports);
    }
    setSelectedNodeIds([]);
    setSelectedSegmentIds([]);
    setSelectedFittingIds([]);
    setSelectedCad2dIds([]);
    setSelectedSupportId(null);
    setSelectedNodeId(null);
    setSelectedSegmentId(null);
    setSelectedFitting(null);
    setCtxMenu(null);
    setTimeout(()=>{historyBusyRef.current=false;},0);
  };

  const undoGraph=()=>{
    const h=historyRef.current;
    if(!h.length) {
      setStatusMessage("Rien à annuler");
      return;
    }
    const snap=h.pop();
    if(!snap)return;
    // On memorise l'etat courant pour pouvoir refaire.
    redoRef.current.push(cloneGraph(nodes,segments,lines,dimensions,cad2dEntities,cad2dLayers,supports));
    if(redoRef.current.length>60)redoRef.current.shift();
    applyGraphSnapshot(snap);
    setStatusMessage("Annulation effectuée (Ctrl+Z)");
  };

  const redoGraph=()=>{
    const r=redoRef.current;
    if(!r.length) {
      setStatusMessage("Rien à rétablir");
      return;
    }
    const snap=r.pop();
    if(!snap)return;
    historyRef.current.push(cloneGraph(nodes,segments,lines,dimensions,cad2dEntities,cad2dLayers,supports));
    applyGraphSnapshot(snap);
    setStatusMessage("Rétablissement effectué (Ctrl+Y)");
  };

  const toggleNodeSelection=(id:string,additive:boolean)=>{
    selectNodeV44(id,additive);
  };

  const selectFitting=(segmentId:string,fittingId:string)=>{
    selectFittingV44(segmentId,fittingId,false);
  };

  // PATCH 017P : une seule regle d accroche pour tout le moteur.
  const snapBranchWorld=(w:{x:number;y:number;z:number})=>pdiCreatePoint(w);


  const segmentGeomLength=(s:IsoSegment,ns:IsoNode[],ss:IsoSegment[]=[])=>{
    const endpoints=segmentEndpoints(s,ns,ss);
    if(!endpoints)return s.length||0;
    return Math.max(.05,Math.hypot(endpoints.to.x-endpoints.from.x,endpoints.to.y-endpoints.from.y,endpoints.to.z-endpoints.from.z));
  };

  const recalcSegmentLengths=(ns:IsoNode[],ss:IsoSegment[])=>
    ss.map(s=>({...s,length:Number(segmentGeomLength(s,ns,ss).toFixed(3))}));

  const selectedCount=selectedNodeIds.length+selectedSegmentIds.length+selectedFittingIds.length;

  const executeObjectAlign = (scaleMode: "keep" | "match") => {
    if (!alignWizard) return;
    const { refSegmentId, refNodeId, targetSegmentId, targetNodeId } = alignWizard;
    const res = performObjectAlign({
      nodes,
      segments,
      refSegmentId,
      refNodeId,
      targetSegmentId,
      targetNodeId,
      scaleMode,
    });
    setStatusMessage(res.message);
    setAutocadPrompt(res.message);
    setAlignWizard(null);
    if (!res.success) return;
    commitGraph(res.nextNodes, recalcSegmentLengths(res.nextNodes, segments));
  };

  const executeObjectParallel = (refSegId: string, targetSegId: string) => {
    const res = performObjectParallel({
      nodes,
      segments,
      refSegmentId: refSegId,
      targetSegmentId: targetSegId,
      pivotAnchor: "from",
    });
    setStatusMessage(res.message);
    setAutocadPrompt(res.message);
    if (!res.success) return;
    commitGraph(res.nextNodes, recalcSegmentLengths(res.nextNodes, segments));
  };

  const startAlignWizard = () => {
    if (selectedSegmentIds.length >= 2) {
      const targetSegId = selectedSegmentIds[0];
      const refSegId = selectedSegmentIds[1];
      const sT = segments.find((s) => s.id === targetSegId);
      const sR = segments.find((s) => s.id === refSegId);
      setParallelWizard(null);
      setAlignWizard({
        step: 3,
        refSegmentId: refSegId,
        refLabel: sR?.tag ? `Tube ${sR.tag}` : `Tube Réf`,
        targetSegmentId: targetSegId,
        targetLabel: sT?.tag ? `Tube ${sT.tag}` : `Tube Cible`,
      });
      setStatusMessage("Alignement : 2 tronçons détectés. Choisissez si vous gardez l'échelle ou prenez celle de la référence.");
      return;
    }
    if (selectedSegmentIds.length === 1 && selectedNodeIds.length >= 1) {
      const refSegId = selectedSegmentIds[0];
      const targetNId = selectedNodeIds[0];
      const sR = segments.find((s) => s.id === refSegId);
      const nT = nodes.find((n) => n.id === targetNId);
      setParallelWizard(null);
      setAlignWizard({
        step: 3,
        refSegmentId: refSegId,
        refLabel: sR?.tag ? `Tube ${sR.tag}` : `Tube Réf`,
        targetNodeId: targetNId,
        targetNodeIds: selectedNodeIds,
        targetLabel: selectedNodeIds.length > 1 ? `${selectedNodeIds.length} nœuds` : (nT?.name || "Organe Cible"),
      });
      setStatusMessage("Alignement : Organe et Tube détectés. Choisissez l'échelle pour appliquer l'alignement.");
      return;
    }
    if (selectedNodeIds.length >= 2) {
      const targetNId = selectedNodeIds[0];
      const refNId = selectedNodeIds[1];
      const nT = nodes.find((n) => n.id === targetNId);
      const nR = nodes.find((n) => n.id === refNId);
      setParallelWizard(null);
      setAlignWizard({
        step: 3,
        refNodeId: refNId,
        refLabel: nR?.name || `Nœud ${refNId}`,
        targetNodeId: targetNId,
        targetNodeIds: selectedNodeIds.slice(0, 1),
        targetLabel: nT?.name || `Nœud ${targetNId}`,
      });
      setStatusMessage("Alignement : 2 nœuds/organes détectés. Choisissez si vous gardez l'échelle ou prenez celle de la référence.");
      return;
    }
    setParallelWizard(null);
    setAlignWizard({ step: 1 });
    setStatusMessage("ALIGNEMENT [Étape 1/3] : Cliquez sur l'objet ou tronçon de RÉFÉRENCE (qui donne l'axe & l'orientation).");
    setAutocadPrompt("ALIGN [Étape 1/3] : Cliquez sur l'objet ou tronçon de RÉFÉRENCE (ou Échap pour annuler)");
  };

  const startParallelWizard = () => {
    if (selectedSegmentIds.length >= 2) {
      const targetSegId = selectedSegmentIds[0];
      const refSegId = selectedSegmentIds[selectedSegmentIds.length - 1];
      executeObjectParallel(refSegId, targetSegId);
      return;
    }
    setAlignWizard(null);
    setParallelWizard({ step: 1 });
    setStatusMessage("PARALLÈLE [Étape 1/2] : Cliquez sur le tronçon de RÉFÉRENCE (qui donne l'orientation exacte).");
    setAutocadPrompt("PARALLEL [Étape 1/2] : Cliquez sur le tronçon de RÉFÉRENCE (ou Échap pour annuler)");
  };

  const clearSelection=()=>{
    setSelectedNodeId(null);
    setSelectedSegmentId(null);
    setSelectedNodeIds([]);
    setSelectedSegmentIds([]);
    setSelectedFittingIds([]);
    setSelectedFitting(null);
    setSelectedDimensionId(null);
    setSelectedDimensionIds([]);
    setSelectedSupportId(null);
    setActiveErrorHighlight(null);
  };

  const focusAndHighlightError = (
    targetId: string,
    kind: "segment" | "node" | "support" = "node",
    issueInfo?: { code?: string; message?: string }
  ) => {
    let targetWorldPos: { x: number; y: number; z: number } | null = null;
    let effectiveKind: "segment" | "node" | "support" = kind;

    const seg = segments.find(s => s.id === targetId);
    if (kind === "segment" || seg) {
      if (seg) {
        effectiveKind = "segment";
        selectSegmentV44(seg.id, false);
        const a = nodes.find(n => n.id === seg.fromNodeId);
        const b = nodes.find(n => n.id === seg.toNodeId);
        if (a && b) {
          targetWorldPos = {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            z: ((a.z || 0) + (b.z || 0)) / 2,
          };
        } else if (a) {
          targetWorldPos = { x: a.x, y: a.y, z: a.z || 0 };
        }
      }
    }

    if (!targetWorldPos) {
      const node = nodes.find(n => n.id === targetId);
      if (node) {
        effectiveKind = "node";
        selectNodeV44(node.id, false);
        targetWorldPos = { x: node.x, y: node.y, z: node.z || 0 };
      }
    }

    if (!targetWorldPos) {
      const sup = supports.find(s => s.id === targetId);
      if (sup) {
        effectiveKind = "support";
        setSelectedSupportId(sup.id);
        targetWorldPos = { x: sup.worldPos.x, y: sup.worldPos.y, z: sup.worldPos.z || 0 };
      }
    }

    if (targetWorldPos) {
      // Zoom automatique sur la section concernée et recentrage
      const targetZoom = Math.max(viewport.zoom, 2.0);
      const scale = 28 * targetZoom;
      const axes = getProjectionAxes(viewport.viewMode, viewport.yaw, viewport.pitch);

      let rx = targetWorldPos.x;
      let ry = targetWorldPos.y;
      let rz = targetWorldPos.z || 0;
      if (viewport.viewMode === "free") {
        rx = targetWorldPos.x - (isoState.modelCenter.x || 0);
        ry = targetWorldPos.y - (isoState.modelCenter.y || 0);
        rz = (targetWorldPos.z || 0) - (isoState.modelCenter.z || 0);
      }

      const projX = (rx * axes.dx_x + ry * axes.dx_y + rz * axes.dx_z) * scale;
      const projY = (rx * axes.dy_x + ry * axes.dy_y + rz * axes.dy_z) * scale;

      const newPanX = Math.round(310 - 310 - projX);
      const newPanY = Math.round(200 - 210 - projY);

      setViewport(v => ({
        ...v,
        zoom: targetZoom,
        panX: newPanX,
        panY: newPanY,
      }));

      setActiveErrorHighlight({
        id: targetId,
        kind: effectiveKind,
        code: issueInfo?.code || "ERREUR",
        message: issueInfo?.message || "Anomalie détectée sur cet élément",
        timestamp: Date.now(),
      });

      setStatusMessage(`Focus anomalie [${issueInfo?.code || "ERREUR"}] : Zoom et halo appliqués sur la section concernée.`);
      setRightPanelOpen(true);
      setRightPanelTab("properties");
    }
  };

  const selectNodeV44=(id:string,additive:boolean)=>{
    if (alignWizard && alignWizard.step === 1) {
      const n = nodes.find((item) => item.id === id);
      const label = n?.name || id;
      setAlignWizard({
        step: 2,
        refNodeId: id,
        refLabel: `Nœud ${label}`,
      });
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
      setStatusMessage(`Référence sélectionnée : Nœud ${label}. Cliquez sur l'OBJET À ALIGNER (tronçon ou équipement).`);
      setAutocadPrompt(`ALIGN [Étape 2/3] : Cliquez sur l'OBJET À ALIGNER`);
      return;
    }
    if (alignWizard && alignWizard.step === 2) {
      if (id === alignWizard.refNodeId) {
        setStatusMessage("L'objet cible ne peut pas être le même que l'objet de référence.");
        return;
      }
      const n = nodes.find((item) => item.id === id);
      const label = n?.name || id;
      setAlignWizard((prev) => ({
        ...prev!,
        step: 3,
        targetNodeId: id,
        targetLabel: n?.equipmentType ? `${FITTING_LABELS[n.equipmentType] || "Équipement"} ${label}` : `Nœud ${label}`,
      }));
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
      setStatusMessage(`Cible : ${label}. Choisissez l'échelle pour finaliser l'alignement.`);
      setAutocadPrompt(`ALIGN [Étape 3/3] : Choisissez si vous gardez l'échelle ou prenez l'échelle de la référence.`);
      return;
    }

    if(additive){
      setSelectedNodeIds(prev=>{
        const exists=prev.includes(id);
        const next=exists?prev.filter(x=>x!==id):[...prev,id];
        setSelectedNodeId(next.length?next[next.length-1]:null);
        return next;
      });
    }else{
      setSelectedNodeIds([id]);
      setSelectedNodeId(id);
      setSelectedSegmentIds([]);
      setSelectedSegmentId(null);
      setSelectedFittingIds([]);
      setSelectedFitting(null);
      setSelectedDimensionId(null);
    }
  };

  const selectSegmentV44=(id:string,additive:boolean)=>{
    if (alignWizard && alignWizard.step === 1) {
      const s = segments.find((item) => item.id === id);
      const a = nodes.find((n) => n.id === s?.fromNodeId);
      const b = nodes.find((n) => n.id === s?.toNodeId);
      const label = s?.tag ? `Tube ${s.tag}` : `Tube ${a?.name || "?"} ➔ ${b?.name || "?"}`;
      setAlignWizard({
        step: 2,
        refSegmentId: id,
        refLabel: label,
      });
      setSelectedSegmentId(id);
      setSelectedSegmentIds([id]);
      setStatusMessage(`Référence sélectionnée : ${label}. Cliquez sur l'OBJET À ALIGNER.`);
      setAutocadPrompt(`ALIGN [Étape 2/3] : Cliquez sur l'OBJET À ALIGNER`);
      return;
    }
    if (alignWizard && alignWizard.step === 2) {
      if (id === alignWizard.refSegmentId) {
        setStatusMessage("L'objet à aligner ne peut pas être le même que le tronçon de référence.");
        return;
      }
      const s = segments.find((item) => item.id === id);
      const a = nodes.find((n) => n.id === s?.fromNodeId);
      const b = nodes.find((n) => n.id === s?.toNodeId);
      const label = s?.tag ? `Tube ${s.tag}` : `Tube ${a?.name || "?"} ➔ ${b?.name || "?"}`;
      setAlignWizard((prev) => ({
        ...prev!,
        step: 3,
        targetSegmentId: id,
        targetLabel: label,
      }));
      setSelectedSegmentId(id);
      setSelectedSegmentIds([id]);
      setStatusMessage(`Objet cible : ${label}. Choisissez l'échelle pour finaliser l'alignement.`);
      setAutocadPrompt(`ALIGN [Étape 3/3] : Conserver l'échelle d'origine ou adopter l'échelle du tube référence ?`);
      return;
    }

    if (parallelWizard && parallelWizard.step === 1) {
      const s = segments.find((item) => item.id === id);
      const a = nodes.find((n) => n.id === s?.fromNodeId);
      const b = nodes.find((n) => n.id === s?.toNodeId);
      const label = s?.tag ? `Tube ${s.tag}` : `Tube ${a?.name || "?"} ➔ ${b?.name || "?"}`;
      setParallelWizard({
        step: 2,
        refSegmentId: id,
        refLabel: label,
      });
      setSelectedSegmentId(id);
      setSelectedSegmentIds([id]);
      setStatusMessage(`Référence : ${label}. Cliquez sur le tronçon À RENDRE PARALLÈLE.`);
      setAutocadPrompt(`PARALLEL [Étape 2/2] : Cliquez sur le tronçon À RENDRE PARALLÈLE`);
      return;
    }
    if (parallelWizard && parallelWizard.step === 2) {
      if (id === parallelWizard.refSegmentId) {
        setStatusMessage("Le tronçon à orienter ne peut pas être le même que le tronçon de référence.");
        return;
      }
      executeObjectParallel(parallelWizard.refSegmentId!, id);
      setParallelWizard(null);
      return;
    }

    if(additive){
      setSelectedSegmentIds(prev=>{
        const exists=prev.includes(id);
        const next=exists?prev.filter(x=>x!==id):[...prev,id];
        setSelectedSegmentId(next.length?next[next.length-1]:null);
        return next;
      });
    }else{
      setSelectedSegmentIds([id]);
      setSelectedSegmentId(id);
      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      setSelectedFittingIds([]);
      setSelectedFitting(null);
      setSelectedDimensionId(null);
    }
  };

  const selectFittingV44=(segmentId:string,fittingId:string,additive:boolean)=>{
    if(additive){
      setSelectedFittingIds(prev=>{
        const exists=prev.includes(fittingId);
        const next=exists?prev.filter(x=>x!==fittingId):[...prev,fittingId];
        setSelectedFitting(next.length?{segmentId,fittingId:next[next.length-1]}:null);
        return next;
      });
    }else{
      setSelectedFittingIds([fittingId]);
      setSelectedFitting({segmentId,fittingId});
      setSelectedSegmentId(segmentId);
      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      setSelectedSegmentIds([]);
      setSelectedDimensionId(null);
    }
  };

  const selectDimensionV44=(id:string,additive:boolean)=>{
    if(!additive){
      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      setSelectedSegmentIds([]);
      setSelectedSegmentId(null);
      setSelectedFittingIds([]);
      setSelectedFitting(null);
    }
    // PATCH 004b : Shift / Ctrl / Cmd ajoute ou retire la cotation de la selection.
    const nextDimensionIds = additive
      ? (selectedDimensionIds.includes(id)
          ? selectedDimensionIds.filter((x) => x !== id)
          : [...selectedDimensionIds, id])
      : [id];
    setSelectedDimensionIds(nextDimensionIds);
    setSelectedDimensionId(
      nextDimensionIds.length ? nextDimensionIds[nextDimensionIds.length - 1] : null,
    );
  };

  // V4.7.2b_HEAL_INLINE_DELETE : retirer un organe inline reconstitue le tube.
  const deleteSelection = () => {
    const nodeSet = new Set(selectedNodeIds);
    const segSet = new Set(selectedSegmentIds);
    const fitSet = new Set(selectedFittingIds);
    // PATCH 004b — CORRECTIF du Patch 004. Le 004 supprimait la cotation par
    // setDimensions(), puis appelait commitGraph() en lui repassant l'etat
    // "dimensions" NON rafraichi : la cotation supprimee etait reintroduite, et
    // une seule suppression produisait DEUX entrees d'historique. La suppression
    // passe desormais par un seul chemin logique : commitGraph.
    const dimSet = new Set<string>(
      selectedDimensionIds.length
        ? selectedDimensionIds
        : selectedDimensionId
          ? [selectedDimensionId]
          : [],
    );
    const hasDim = dimSet.size > 0;
    if (!nodeSet.size && !segSet.size && !fitSet.size && !hasDim) return;

    if (nodeSet.size || segSet.size || fitSet.size) {
      const nextNodes = nodes.filter((n) => !nodeSet.has(n.id));
      let nextSegments = segments
        .filter((segment) => !segSet.has(segment.id))
        .map((segment) => ({
          ...segment,
          fittings: segment.fittings.filter((fitting) => !fitSet.has(fitting.id)),
        }));
      let healedInlineEquipment = false;

      // Une suppression simple d'un équipement à deux ports est l'inverse exact
      // de son insertion : deux tronçons deviennent un seul tronçon.
      if (nodeSet.size === 1) {
        const nodeId = [...nodeSet][0];
        const node = nodes.find((item) => item.id === nodeId);
        const incident = nextSegments.filter(
          (segment) => segment.fromNodeId === nodeId || segment.toNodeId === nodeId,
        );
        if (node?.equipmentType && incident.length === 2) {
          const incoming = incident.find((segment) => segment.toNodeId === nodeId);
          const outgoing = incident.find((segment) => segment.fromNodeId === nodeId);
          const first = incoming || incident[0];
          const second = outgoing || incident.find((segment) => segment.id !== first.id)!;
          const firstExternal =
            first.toNodeId === nodeId
              ? { nodeId: first.fromNodeId, portId: first.fromPortId }
              : { nodeId: first.toNodeId, portId: first.toPortId };
          const secondExternal =
            second.fromNodeId === nodeId
              ? { nodeId: second.toNodeId, portId: second.toPortId }
              : { nodeId: second.fromNodeId, portId: second.fromPortId };
          const compatible =
            firstExternal.nodeId !== secondExternal.nodeId &&
            first.dn === second.dn &&
            (first.lineId || DEFAULT_LINE_ID) === (second.lineId || DEFAULT_LINE_ID);
          nextSegments = nextSegments.filter(
            (segment) => !incident.some((item) => item.id === segment.id),
          );
          if (compatible) {
            const mergedSeed: IsoSegment = {
              ...first,
              id: uid("seg"),
              fromNodeId: firstExternal.nodeId,
              fromPortId: firstExternal.portId,
              toNodeId: secondExternal.nodeId,
              toPortId: secondExternal.portId,
              lineId: first.lineId || second.lineId || DEFAULT_LINE_ID,
              fittings: [],
            };
            const merged = {
              ...mergedSeed,
              length: Number(segmentGeomLength(mergedSeed, nextNodes).toFixed(3)),
            };
            nextSegments.push(merged);
            healedInlineEquipment = true;
          }
        } else {
          nextSegments = nextSegments.filter(
            (segment) =>
              !nodeSet.has(segment.fromNodeId) && !nodeSet.has(segment.toNodeId),
          );
        }
      } else {
        nextSegments = nextSegments.filter(
          (segment) =>
            !nodeSet.has(segment.fromNodeId) && !nodeSet.has(segment.toNodeId),
        );
      }

    // PATCH 004 : aucune cotation ne doit survivre a son noeud/port support.
    const survivingNodeIds = new Set(nextNodes.map((n) => n.id));
    // PATCH 004b : 1) on retire les cotations explicitement selectionnees,
    // 2) puis les cotations devenues orphelines. Aucune topologie orpheline.
    const keptDimensions = dimensions.filter((dimension) => !dimSet.has(dimension.id));
    const nextDimensions = keptDimensions.filter(
      (dimension) =>
        survivingNodeIds.has(dimension.a.nodeId) &&
        survivingNodeIds.has(dimension.b.nodeId),
    );
    const orphanDimensionCount = keptDimensions.length - nextDimensions.length;
    commitGraph(
      nextNodes,
      recalcSegmentLengths(nextNodes, nextSegments),
      lines,
      nextDimensions,
    );
    setCtxMenu(null);
    // PATCH 004b : un seul message final. Le 004 ecrivait le message des cotations
    // orphelines puis l'ecrasait immediatement par le message generique.
    setStatusMessage(
      [
        healedInlineEquipment
          ? "Équipement supprimé · tube reconstitué"
          : "Sélection supprimée",
        dimSet.size ? `${dimSet.size} cotation(s) supprimée(s)` : "",
        orphanDimensionCount > 0
          ? `${orphanDimensionCount} cotation(s) orpheline(s) retirée(s)`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
    } else if (hasDim) {
      // PATCH 004b : suppression de cotations seules, meme chemin logique,
      // une seule entree d'historique.
      commitGraph(
        nodes,
        segments,
        lines,
        dimensions.filter((dimension) => !dimSet.has(dimension.id)),
      );
      setCtxMenu(null);
      setStatusMessage(`${dimSet.size} cotation(s) supprimée(s)`);
    }
    clearSelection();
  };

  // ================= PATCH 004 : presse-papiers et edition =================

  // Sous-graphe coherent : les noeuds selectionnes et uniquement les tubes
  // dont LES DEUX extremites sont selectionnees (jamais de tube pendant).
  // PATCH 004b : cotations entierement contenues dans une selection de noeuds.
  // Une cotation dont une seule ancre est selectionnee n'est jamais copiee :
  // aucune cotation orpheline ne peut etre creee par le presse-papiers.
  const selectionDimensions=(selNodes:IsoNode[])=>{
    const ids=new Set(selNodes.map(n=>n.id));
    return dimensions.filter(d=>ids.has(d.a.nodeId)&&ids.has(d.b.nodeId)).map(d=>({...d}));
  };

  const selectionSubGraph=()=>{
    const ids=new Set(selectedNodeIds);
    const pickedNodes=nodes.filter(n=>ids.has(n.id));
    const pickedSegments=segments.filter(s=>ids.has(s.fromNodeId)&&ids.has(s.toNodeId));
    return {nodes:pickedNodes,segments:pickedSegments};
  };

  // Re-identification complete : nouveaux IDs noeuds, ports, tubes et organes.
  const cloneSubGraphWithNewIds=(source:{nodes:IsoNode[];segments:IsoSegment[];dimensions?:IsoDimension[]},offset:{x:number;y:number;z:number})=>{
    const nodeIdMap=new Map<string,string>();
    const portIdMap=new Map<string,string>();
    const clonedNodes:IsoNode[]=source.nodes.map(n=>{
      const newId=uid("node");
      nodeIdMap.set(n.id,newId);
      const ports=(n.ports||[]).map(p=>{
        const newPortId=uid("port");
        portIdMap.set(p.id,newPortId);
        return {...p,id:newPortId};
      });
      return {...n,id:newId,ports:ports.length?ports:n.ports};
    });
    const clonedSegments:IsoSegment[]=source.segments.map(s=>({
      ...s,
      id:uid("seg"),
      fromNodeId:nodeIdMap.get(s.fromNodeId)||s.fromNodeId,
      toNodeId:nodeIdMap.get(s.toNodeId)||s.toNodeId,
      fromPortId:s.fromPortId?(portIdMap.get(s.fromPortId)||undefined):undefined,
      toPortId:s.toPortId?(portIdMap.get(s.toPortId)||undefined):undefined,
      fittings:s.fittings.map(f=>({...f,id:uid("fit")})),
    }));
    // Aucun offset arbitraire : reutilisation de snapIsoV4 (L619) et du pas actif.
    const movedNodes=clonedNodes.map(n=>({
      ...n,
      x:snapIsoV4(n.x+offset.x,isoSnapStep),
      y:snapIsoV4(n.y+offset.y,isoSnapStep),
      z:Number((n.z+offset.z).toFixed(3)),
    }));
    // PATCH 004b : cotations clonees avec NOUVEAUX IDs et ancres remappees
    // (noeud et port), en reutilisant les tables de correspondance existantes.
    const clonedDimensions:IsoDimension[]=(source.dimensions||[])
      .filter(d=>nodeIdMap.has(d.a.nodeId)&&nodeIdMap.has(d.b.nodeId))
      .map(d=>({
        ...d,
        id:uid("dim"),
        a:{...d.a,nodeId:nodeIdMap.get(d.a.nodeId) as string,portId:d.a.portId?(portIdMap.get(d.a.portId)||d.a.portId):d.a.portId},
        b:{...d.b,nodeId:nodeIdMap.get(d.b.nodeId) as string,portId:d.b.portId?(portIdMap.get(d.b.portId)||d.b.portId):d.b.portId},
      }));
    return {nodes:movedNodes,segments:clonedSegments,dimensions:clonedDimensions,nodeIdMap};
  };

  const copySelection=()=>{
    const sub=selectionSubGraph();
    if(!sub.nodes.length){setStatusMessage("Rien à copier");return;}
    const copiedDimensions=selectionDimensions(sub.nodes);
    clipboardRef.current={nodes:sub.nodes.map(n=>({...n})),segments:sub.segments.map(s=>({...s,fittings:s.fittings.map(f=>({...f}))})),dimensions:copiedDimensions};
    setStatusMessage(`${sub.nodes.length} élément(s) copié(s)${copiedDimensions.length?` · ${copiedDimensions.length} cotation(s)`:""}`);
    setCtxMenu(null);
  };

  const cutSelection=()=>{
    const sub=selectionSubGraph();
    if(!sub.nodes.length){setStatusMessage("Rien à couper");return;}
    clipboardRef.current={nodes:sub.nodes.map(n=>({...n})),segments:sub.segments.map(s=>({...s,fittings:s.fittings.map(f=>({...f}))})),dimensions:selectionDimensions(sub.nodes)};
    deleteSelection();
    setStatusMessage(`${sub.nodes.length} élément(s) coupé(s)`);
  };

  const cad2dClipboardRef = useRef<Cad2dEntity[]>([]);

  const copyCad2dSelection = () => {
    const selected = cad2dEntities.filter((e) => selectedCad2dIds.includes(e.id));
    if (!selected.length) return false;
    cad2dClipboardRef.current = selected.map((e) => ({
      ...e,
      points: e.points?.map((p) => ({ ...p })),
      center: e.center ? { ...e.center } : undefined,
    }));
    setStatusMessage(`${selected.length} objet(s) 2D copié(s) dans le presse-papiers`);
    return true;
  };

  const pasteClipboardAtWorldPoint = (targetPoint: Cad2dPoint) => {
    let pastedCount = 0;
    // 1. Coller les objets 2D si présents dans le tampon
    if (cad2dClipboardRef.current && cad2dClipboardRef.current.length > 0) {
      const buffer = cad2dClipboardRef.current;
      let origX = 0, origY = 0;
      const first = buffer[0];
      if (first.center) {
        origX = first.center.x;
        origY = first.center.y;
      } else if (first.points && first.points.length > 0) {
        origX = first.points[0].x;
        origY = first.points[0].y;
      }
      const dx = targetPoint.x - origX;
      const dy = targetPoint.y - origY;
      const newEntities = buffer.map((item) => {
        const nextId = makeCad2dId(item.type);
        return {
          ...item,
          id: nextId,
          points: item.points?.map((p) => ({ x: Number((p.x + dx).toFixed(3)), y: Number((p.y + dy).toFixed(3)) })),
          center: item.center ? { x: Number((item.center.x + dx).toFixed(3)), y: Number((item.center.y + dy).toFixed(3)) } : undefined,
        };
      });
      setCad2dEntities((prev) => [...prev, ...newEntities]);
      setSelectedCad2dIds(newEntities.map((e) => e.id));
      pastedCount += newEntities.length;
    }

    // 2. Coller les nœuds & tronçons tuyauterie 3D
    const buffer3d = clipboardRef.current;
    if (buffer3d && buffer3d.nodes && buffer3d.nodes.length > 0) {
      const firstNode = buffer3d.nodes[0];
      const dx = targetPoint.x - firstNode.x;
      const dy = targetPoint.y - firstNode.y;
      const cloned = cloneSubGraphWithNewIds(buffer3d, { x: dx, y: dy, z: 0 });
      const normalized = normalizedGraphPorts([...nodes, ...cloned.nodes], [...segments, ...cloned.segments]);
      const nextNodes = normalized.nodes;
      const nextSegments = normalized.segments;
      const pastedDimensions = cloned.dimensions || [];
      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, nextSegments), lines, [...dimensions, ...pastedDimensions]);
      setSelectedNodeIds(cloned.nodes.map((n) => n.id));
      setSelectedSegmentIds([]);
      setSelectedFittingIds([]);
      setSelectedNodeId(cloned.nodes[0]?.id || null);
      pastedCount += cloned.nodes.length;
    }

    if (pastedCount > 0) {
      setStatusMessage(`${pastedCount} élément(s) collé(s) au point (${targetPoint.x.toFixed(2)}, ${targetPoint.y.toFixed(2)})`);
      setAutocadPrompt(`Éléments collés au point (${targetPoint.x.toFixed(2)}, ${targetPoint.y.toFixed(2)})`);
    } else {
      setStatusMessage("Presse-papiers vide. Rien à coller.");
      setAutocadPrompt("Presse-papiers vide. Sélectionnez des éléments et tapez COPIER.");
    }
  };

  // ----- PATCH 017Q : FONCTIONS D'ÉDITION INDUSTRIELLE ASSOCIER (SPOOL) ET DISSOCIER -----
  const associateSelectionToSpool = (targetSpoolName?: string) => {
    const affectedSegIds = new Set<string>(selectedSegmentIds);
    if (selectedNodeIds.length > 0) {
      segments.forEach((s) => {
        if (selectedNodeIds.includes(s.fromNodeId) && selectedNodeIds.includes(s.toNodeId)) {
          affectedSegIds.add(s.id);
        }
      });
    }

    const totalCount = affectedSegIds.size + selectedNodeIds.length;
    if (totalCount === 0) {
      setStatusMessage("Sélectionnez au moins un tronçon ou nœud pour créer ou associer un spool (Ctrl+G)");
      setAutocadPrompt("ASSOCIER : Aucun élément sélectionné. Sélectionnez des tronçons et relancez (Ctrl+G).");
      return;
    }

    let spoolId = targetSpoolName?.trim();
    if (!spoolId) {
      const existing = segments.find((s) => affectedSegIds.has(s.id) && s.spoolNumber && s.spoolNumber !== "NONE")?.spoolNumber ||
                       nodes.find((n) => selectedNodeIds.includes(n.id) && n.spoolNumber && n.spoolNumber !== "NONE")?.spoolNumber;
      if (existing) {
        spoolId = existing;
      } else {
        const usedSpools = new Set<string>();
        segments.forEach((s) => { if (s.spoolNumber && s.spoolNumber !== "NONE") usedSpools.add(s.spoolNumber); });
        nodes.forEach((n) => { if (n.spoolNumber && n.spoolNumber !== "NONE") usedSpools.add(n.spoolNumber); });
        let idx = 1;
        while (usedSpools.has(`SP-${String(idx).padStart(2, "0")}`)) {
          idx++;
        }
        spoolId = `SP-${String(idx).padStart(2, "0")}`;
      }
    }

    const nextSegs = segments.map((seg) => {
      if (affectedSegIds.has(seg.id)) {
        return {
          ...seg,
          spoolNumber: spoolId,
          fabricationLocation: "shop" as const,
        };
      }
      return seg;
    });

    const nextNodes = nodes.map((node) => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          spoolNumber: spoolId,
          fabricationLocation: "shop" as const,
        };
      }
      return node;
    });

    commitGraph(nextNodes, recalcSegmentLengths(nextNodes, nextSegs));
    setColorBySpool(true);

    const msg = `Sous-ensemble associé au Spool ${spoolId} (${affectedSegIds.size} tronçon(s), ${selectedNodeIds.length} nœud(s))`;
    setStatusMessage(msg);
    setAutocadPrompt(`COMMANDE [ASSOCIER] : ${msg}. Affichage couleur par spool activé.`);
  };

  const dissociateSelectionFromSpool = () => {
    const affectedSegIds = new Set<string>(selectedSegmentIds);
    const totalCount = affectedSegIds.size + selectedNodeIds.length;
    if (totalCount === 0) {
      setStatusMessage("Sélectionnez les éléments à dissocier du Spool (Ctrl+Shift+G)");
      setAutocadPrompt("DISSOCIER : Aucun élément sélectionné. Sélectionnez des tronçons ou nœuds et relancez (Ctrl+Shift+G).");
      return;
    }

    const nextSegs = segments.map((seg) => {
      if (affectedSegIds.has(seg.id)) {
        return {
          ...seg,
          spoolNumber: "NONE",
          fabricationLocation: undefined,
        };
      }
      return seg;
    });

    const nextNodes = nodes.map((node) => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          spoolNumber: "NONE",
          fabricationLocation: undefined,
        };
      }
      return node;
    });

    commitGraph(nextNodes, recalcSegmentLengths(nextNodes, nextSegs));

    const msg = `${affectedSegIds.size + selectedNodeIds.length} élément(s) dissocié(s) du spool (tronçon(s) indépendant(s))`;
    setStatusMessage(msg);
    setAutocadPrompt(`COMMANDE [DISSOCIER] : ${msg}.`);
  };

  const selectWholeSpool = (spoolId?: string) => {
    if (!spoolId || spoolId === "NONE") return;
    const segs = segments.filter((s) => s.spoolNumber === spoolId).map((s) => s.id);
    const nids = nodes.filter((n) => n.spoolNumber === spoolId).map((n) => n.id);
    setSelectedSegmentIds(segs);
    setSelectedSegmentId(segs[0] || null);
    setSelectedNodeIds(nids);
    setSelectedNodeId(nids[0] || null);
    setStatusMessage(`Spool ${spoolId} sélectionné (${segs.length} tronçon(s), ${nids.length} nœud(s))`);
    setAutocadPrompt(`SÉLECTION : Tous les éléments du Spool ${spoolId} sélectionnés.`);
  };

  // ----- PATCH 017A : moteur de tagging industriel -----
  const activeTagFormat = pdiActiveFormat(projectSetup);
  const defaultService = projectSetup.services[0] ? projectSetup.services[0].code : "HC";
  const defaultSpec = projectSetup.specs[0] ? projectSetup.specs[0].code : "CS150";

  // PATCH 017F2B : refus d edition rendu visible.
  // segEditError017F2B porte le message affiche dans la carte du troncon.
  // segEditRev017F2B est un compteur de revision : il entre dans la key des
  // champs non controles (DN, Longueur) pour les remonter apres un refus et
  // ainsi effacer la saisie invalide restee a l ecran.
  const [segEditError017F2B, setSegEditError017F2B] = useState<string>("");
  const [segEditRev017F2B, setSegEditRev017F2B] = useState<number>(0);
  const pdiRejectSegmentEdit017F2B = (message: string) => {
    setSegEditError017F2B(message);
    setSegEditRev017F2B((n) => n + 1);
    setStatusMessage(message);
    setAutocadPrompt(message);
  };

  // PATCH 017P10 : contrepartie du refus, qui manquait totalement.
  // segEditError017F2B n etait jamais remis a vide : le message rouge
  // restait affiche apres correction et contredisait les quatre points
  // d affichage unifies par le 017P9. Toute edition acceptee l efface.
  const pdiAcceptSegmentEdit017P10 = (notice?: string) => {
    setSegEditError017F2B("");
    if (notice) {
      setStatusMessage(notice);
      setAutocadPrompt(notice);
    }
  };

  // PATCH 017F2 : edition en place d un troncon depuis l inspecteur, refusee
  // si la spec du projet n admet pas le diametre demande.
  const applySegmentEdit017F2 = (
    id: string,
    patch: { dn?: number; service?: string; spec?: string; length?: number }
  ) => {
    const target = segments.find((s) => s.id === id);
    if (!target) return;
    const nextDn = patch.dn != null && Number.isFinite(patch.dn) ? Math.round(patch.dn) : Number(target.dn);
    // PATCH 017P10 : le message nomme le champ reellement en cause et dit
    // ce qui est conserve. Regle ecrite dans pdiSaisie017P10.
    const controleDn017P10 = pdiValiderDn017P10(nextDn);
    if (!controleDn017P10.ok) {
      pdiRejectSegmentEdit017F2B(controleDn017P10.message || "DN refuse");
      return;
    }
    const nextSpecCode = patch.spec != null ? patch.spec : (target.spec || "");
    const specObj = nextSpecCode ? pdiFindSpec(projectSetup, nextSpecCode) : undefined;
    if (specObj && !pdiSpecAllowsDn(specObj, nextDn)) {
      // PATCH 017F2B : refus visible + resynchronisation du champ saisi.
      pdiRejectSegmentEdit017F2B(
        "Refuse : DN" + nextDn + " hors plage. La spec " + specObj.code +
          " n admet que DN" + specObj.minDn + " a DN" + specObj.maxDn
      );
      return;
    }
    // PATCH 017P10 : les controles sont passes, on efface le message rouge.
    pdiAcceptSegmentEdit017P10();
    const anySpec = specObj as any;
    setSegments((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const updated: any = { ...s, dn: nextDn };
      if (patch.service != null) updated.service = patch.service || undefined;
      if (patch.spec != null) {
        updated.spec = patch.spec || undefined;
        if (anySpec && anySpec.material) updated.material = anySpec.material;
        if (anySpec && anySpec.pressureClass) updated.pressureClass = anySpec.pressureClass;
      }
      if (patch.length != null && Number.isFinite(patch.length) && patch.length > 0) updated.length = patch.length;
      // PATCH 017F2B : le tag industriel doit suivre le DN / service / spec.
      // Avant : DN300 restait tague 150-HC-001-CS150 (partie diametre figee).
      if (s.tag) {
        const svc = String(updated.service || defaultService).toUpperCase();
        const sp = String(updated.spec || defaultSpec).toUpperCase();
        const known = prev.map((x) => x.tag || "");
        const num = s.tagNumber || pdiNextTagNumber(known, svc, nextDn, activeTagFormat);
        updated.tagNumber = num;
        updated.tagFormatName = activeTagFormat.name;
        updated.tag = pdiBuildTag(
          { nominalDiameter: nextDn, service: svc, number: num, spec: sp },
          activeTagFormat
        );
      }
      return updated;
    }));
    // PATCH 017F2B : edition acceptee, le message de refus est efface.
    setSegEditError017F2B("");
    setStatusMessage("Troncon " + (target.tag || id) + " mis a jour vers DN" + nextDn);
  };

  const targetSegmentIds = () => {
    if (selectedSegmentIds.length > 0) return selectedSegmentIds;
    if (selectedSegmentId) return [selectedSegmentId];
    return [];
  };

  const applyTagToSelection = (service?: string, spec?: string) => {
    const ids = targetSegmentIds();
    if (ids.length === 0) {
      setAutocadPrompt("TAG : selectionnez au moins un troncon de tuyauterie.");
      return;
    }
    setSegments(prev => {
      const known = prev.map(x => x.tag || "").filter(t => t.length > 0);
      let offset = 0;
      return prev.map(s => {
        if (!ids.includes(s.id)) return s;
        const svc = (service || s.service || defaultService).toUpperCase();
        const sp = (spec || s.spec || defaultSpec).toUpperCase();
        const num = s.tagNumber || (pdiNextTagNumber(known, svc, s.dn, activeTagFormat) + offset);
        offset += 1;
        const specObj = pdiFindSpec(projectSetup, sp);
        const tag = pdiBuildTag({ nominalDiameter: s.dn, service: svc, number: num, spec: sp }, activeTagFormat);
        known.push(tag);
        return {
          ...s,
          service: svc,
          spec: sp,
          tagNumber: num,
          tagFormatName: activeTagFormat.name,
          tag,
          material: specObj ? specObj.material : s.material,
          pressureClass: specObj ? specObj.pressureClass : s.pressureClass,
        };
      });
    });
    setAutocadPrompt("TAG : " + ids.length + " troncon(s) tagge(s) au format " + activeTagFormat.name + ".");
    setStatusMessage("Tagging applique (" + ids.length + ")");
  };

  const autoTagAllSegments = () => {
    setSegments(prev => {
      const known: string[] = [];
      return prev.map(s => {
        const svc = (s.service || defaultService).toUpperCase();
        const sp = (s.spec || defaultSpec).toUpperCase();
        const num = pdiNextTagNumber(known, svc, s.dn, activeTagFormat);
        const specObj = pdiFindSpec(projectSetup, sp);
        const tag = pdiBuildTag({ nominalDiameter: s.dn, service: svc, number: num, spec: sp }, activeTagFormat);
        known.push(tag);
        return { ...s, service: svc, spec: sp, tagNumber: num, tagFormatName: activeTagFormat.name, tag, material: specObj ? specObj.material : s.material, pressureClass: specObj ? specObj.pressureClass : s.pressureClass };
      });
    });
    setAutocadPrompt("AUTOTAG : tous les troncons ont recu un tag " + activeTagFormat.name + ".");
  };

  const tagIssues = segments.filter(s => s.tag && !pdiValidateTag(s.tag, segments.map(x => x.tag || ""), activeTagFormat).ok).length;

  // PATCH 017C : renumerotation en serie des tags, par service.
  const renumberTags = (serviceFilter?: string, startAt?: number) => {
    const svcFilter = serviceFilter ? serviceFilter.toUpperCase() : "";
    const start = startAt && startAt > 0 ? Math.floor(startAt) : 1;
    let touched = 0;
    setSegments(prev => {
      const counters = new Map<string, number>();
      return prev.map(s => {
        const svc = (s.service || defaultService).toUpperCase();
        if (svcFilter && svc !== svcFilter) return s;
        const sp = (s.spec || defaultSpec).toUpperCase();
        const next = counters.has(svc) ? (counters.get(svc) as number) + 1 : start;
        counters.set(svc, next);
        touched += 1;
        const specObj = pdiFindSpec(projectSetup, sp);
        const tag = pdiBuildTag({ nominalDiameter: s.dn, service: svc, number: next, spec: sp }, activeTagFormat);
        return {
          ...s,
          service: svc,
          spec: sp,
          tagNumber: next,
          tagFormatName: activeTagFormat.name,
          tag,
          material: specObj ? specObj.material : s.material,
          pressureClass: specObj ? specObj.pressureClass : s.pressureClass,
        };
      });
    });
    setAutocadPrompt(
      "RENUMBER : " + (svcFilter ? "service " + svcFilter : "tous services") +
      ", numerotation a partir de " + start + " (" + touched + " troncon(s))."
    );
    setStatusMessage("Renumerotation des tags effectuee");
  };

  // =========================================================================
  // ÉTAPE B : PLAN DE SOUDAGE & CARNET DE SPOOLS (ASME B31.3 / ISO 14692)
  // =========================================================================
  const rawWeldSpoolData = useMemo(() => {
    return deriveSpoolsAndWelds(nodes, segments);
  }, [nodes, segments]);

  const weldSpoolData: WeldSpoolResult = useMemo(() => {
    if (Object.keys(weldOverrides).length === 0) return rawWeldSpoolData;
    const updatedWelds = rawWeldSpoolData.welds.map((w) => {
      const ov = weldOverrides[w.id];
      return ov ? { ...w, ...ov } : w;
    });
    const shopWelds = updatedWelds.filter((w) => w.location === "shop").length;
    const fieldWelds = updatedWelds.filter((w) => w.location === "field").length;
    const goldenWelds = updatedWelds.filter((w) => w.location === "golden").length;
    const rtWelds = updatedWelds.filter((w) => w.cndRequired?.rt || (w.ndtRequired && w.ndtRequired.includes("RT"))).length;
    return {
      ...rawWeldSpoolData,
      welds: updatedWelds,
      summary: {
        ...rawWeldSpoolData.summary,
        totalWelds: updatedWelds.length,
        shopWelds,
        fieldWelds,
        goldenWelds,
        rtWelds,
      },
    };
  }, [rawWeldSpoolData, weldOverrides]);

  const handleUpdateWeld = useCallback((weldId: string, updates: Partial<PdiWeldEntry>) => {
    setWeldOverrides((prev) => ({
      ...prev,
      [weldId]: { ...prev[weldId], ...updates },
    }));
  }, []);

  const handleOpenPrintModalFromWeld = useCallback((mode: "weldMap") => {
    setPrintWeldMapMode(mode === "weldMap");
    setPrintModalOpen(true);
  }, []);

  const segmentStrokeColor = (seg: IsoSegment) => {
    if (colorBySpool && weldSpoolData) {
      const spool = weldSpoolData.spools.find((sp) => sp.segmentIds.includes(seg.id));
      if (spool) {
        if (activeSpoolFilter && activeSpoolFilter !== spool.id) {
          return "#334155";
        }
        return spool.color;
      }
    }
    if (colorByService && seg.service) {
      const sv = projectSetup.services.find(x => x.code === seg.service);
      if (sv) return sv.color;
    }
    return seg.color || workspaceVisualStyle.defaultPipeColor;
  };

  // =========================================================================
  // PALIER 2B : GÉOMÉTRIE TRANSACTIONNELLE 2D CAD (TRIM, EXTEND, OFFSET, FILLET, SCALE, CHAMFER, HACHURE)
  // =========================================================================

  const distPointToSegment = (p: Cad2dPoint, a: Cad2dPoint, b: Cad2dPoint): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };

  const findNearestLineOrSegment = (clickPt: Cad2dPoint, maxDist: number = 0.8) => {
    let bestEntity: { ent: Cad2dEntity; line: LineSegment2D; dist: number } | null = null;
    let bestPipe: { seg: IsoSegment; fn: IsoNode; tn: IsoNode; line: LineSegment2D; dist: number } | null = null;

    // 1. Chercher dans cad2dEntities
    for (const ent of cad2dEntities) {
      if (ent.visible === false) continue;
      if (ent.type === "line" && ent.points && ent.points.length >= 2) {
        const lineSeg: LineSegment2D = { p1: ent.points[0], p2: ent.points[1] };
        const d = distPointToSegment(clickPt, lineSeg.p1, lineSeg.p2);
        if (d <= maxDist && (!bestEntity || d < bestEntity.dist)) {
          bestEntity = { ent, line: lineSeg, dist: d };
        }
      } else if ((ent.type === "polyline" || ent.type === "polygon" || ent.type === "rectangle" || ent.type === "triangle") && ent.points && ent.points.length >= 2) {
        for (let i = 0; i < ent.points.length - 1; i++) {
          const lineSeg: LineSegment2D = { p1: ent.points[i], p2: ent.points[i + 1] };
          const d = distPointToSegment(clickPt, lineSeg.p1, lineSeg.p2);
          if (d <= maxDist && (!bestEntity || d < bestEntity.dist)) {
            bestEntity = { ent, line: lineSeg, dist: d };
          }
        }
      }
    }

    // 2. Chercher dans les tronçons de tuyauterie ISO
    for (const seg of segments) {
      const fn = nodes.find((n) => n.id === seg.fromNodeId);
      const tn = nodes.find((n) => n.id === seg.toNodeId);
      if (!fn || !tn) continue;
      const lineSeg: LineSegment2D = { p1: { x: fn.x, y: fn.y }, p2: { x: tn.x, y: tn.y } };
      const d = distPointToSegment(clickPt, lineSeg.p1, lineSeg.p2);
      if (d <= maxDist && (!bestPipe || d < bestPipe.dist)) {
        bestPipe = { seg, fn, tn, line: lineSeg, dist: d };
      }
    }

    if (bestEntity && bestPipe) {
      return bestEntity.dist <= bestPipe.dist ? { type: "cad2d" as const, ...bestEntity } : { type: "pipe" as const, ...bestPipe };
    }
    if (bestEntity) return { type: "cad2d" as const, ...bestEntity };
    if (bestPipe) return { type: "pipe" as const, ...bestPipe };
    return null;
  };

  const collectAllDrawingSegments = (excludeId?: string): LineSegment2D[] => {
    const list: LineSegment2D[] = [];
    // 2D entities
    for (const ent of cad2dEntities) {
      if (ent.id === excludeId || ent.visible === false) continue;
      if (ent.type === "line" && ent.points && ent.points.length >= 2) {
        list.push({ p1: ent.points[0], p2: ent.points[1] });
      } else if (ent.points && ent.points.length >= 2) {
        for (let i = 0; i < ent.points.length - 1; i++) {
          list.push({ p1: ent.points[i], p2: ent.points[i + 1] });
        }
        if (ent.closed || ent.type !== "polyline") {
          list.push({ p1: ent.points[ent.points.length - 1], p2: ent.points[0] });
        }
      }
    }
    // ISO piping segments
    for (const seg of segments) {
      if (seg.id === excludeId) continue;
      const fn = nodes.find((n) => n.id === seg.fromNodeId);
      const tn = nodes.find((n) => n.id === seg.toNodeId);
      if (fn && tn) {
        list.push({ p1: { x: fn.x, y: fn.y }, p2: { x: tn.x, y: tn.y } });
      }
    }
    return list;
  };

  const applyScaleWithFactor = (factor: number, basePoint?: Cad2dPoint) => {
    pushHistory();
    let bp = basePoint;
    if (!bp) {
      let sumX = 0, sumY = 0, count = 0;
      for (const id of selectedCad2dIds) {
        const ent = cad2dEntities.find((e) => e.id === id);
        if (ent?.points) {
          for (const p of ent.points) { sumX += p.x; sumY += p.y; count++; }
        } else if (ent?.center) {
          sumX += ent.center.x; sumY += ent.center.y; count++;
        }
      }
      for (const id of selectedNodeIds) {
        const n = nodes.find((node) => node.id === id);
        if (n) { sumX += n.x; sumY += n.y; count++; }
      }
      bp = count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
    }

    if (selectedCad2dIds.length > 0) {
      const selSet = new Set(selectedCad2dIds);
      setCad2dEntities((prev) =>
        prev.map((ent) => (selSet.has(ent.id) ? cad2dScaleEntity(ent, bp!, factor) : ent))
      );
    }

    if (selectedNodeIds.length > 0) {
      const nextNodes = cad2dScaleNodes(nodes, selectedNodeIds, bp, factor, isoSnapStep);
      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
    }

    setCad2dModifySession(null);
    setStatusMessage(`Échelle ${factor}× appliquée`);
    setAutocadPrompt(`ÉCHELLE : Facteur ${factor}× appliqué par rapport au point (${bp.x.toFixed(2)}, ${bp.y.toFixed(2)}).`);
  };
  applyScaleWithFactorRef.current = applyScaleWithFactor;

  const startCad2dScaleCommand = (arg?: string) => {
    const factor = arg ? Number(arg) : undefined;
    const hasSelection = selectedCad2dIds.length > 0 || selectedNodeIds.length > 0;

    if (!hasSelection) {
      setAutocadPrompt("ÉCHELLE (SCALE) : Sélectionnez d'abord un ou plusieurs éléments sur le plan.");
      setStatusMessage("Sélectionnez des éléments avant d'appliquer l'échelle");
      return;
    }

    if (factor && Number.isFinite(factor) && factor > 0) {
      applyScaleWithFactor(factor);
      return;
    }

    setCad2dModifySession({
      mode: "scale",
      step: 0,
      offsetDist: 0.5,
      filletRadius: 0.5,
      scaleFactor: 1.5,
    });
    setAutocadPrompt("ÉCHELLE (SCALE) : Cliquez le point de base pour l'homothétie (ou tapez le facteur ex: 1.5).");
    setStatusMessage("Échelle : point de base attendu");
  };

  const startCad2dModifyCommand = (mode: "trim" | "extend" | "offset" | "fillet" | "chamfer", arg?: string) => {
    let dist = 0.5;
    let rad = 0.5;

    if (arg) {
      const parsed = parsePdiValue(arg, "length", unitSystem);
      const val = parsed.valid && parsed.valueInMeters > 0 ? parsed.valueInMeters : Number(arg);
      if (Number.isFinite(val) && val > 0) {
        if (mode === "offset") dist = val;
        if (mode === "fillet" || mode === "chamfer") rad = val;
      }
    }

    setCad2dModifySession({
      mode,
      step: 0,
      offsetDist: dist,
      filletRadius: rad,
      scaleFactor: 1.5,
    });

    if (mode === "trim") {
      setAutocadPrompt("AJUSTER (TRIM) : Cliquez sur le segment à découper à l'intersection avec une frontière. [Échap pour quitter]");
      setStatusMessage("Ajuster : cliquez sur le segment à tronquer");
    } else if (mode === "extend") {
      setAutocadPrompt("PROLONGER (EXTEND) : Cliquez vers l'extrémité du segment à prolonger vers la limite la plus proche. [Échap pour quitter]");
      setStatusMessage("Prolonger : cliquez le segment à étendre");
    } else if (mode === "offset") {
      setAutocadPrompt(`DÉCALER (OFFSET) : Distance = ${dist} m. Cliquez l'élément à décaler.`);
      setStatusMessage(`Décaler : distance ${dist} m`);
    } else if (mode === "fillet" || mode === "chamfer") {
      const lbl = mode === "fillet" ? "RACCORD" : "CHANFREIN";
      setAutocadPrompt(`${lbl} : Rayon = ${rad} m. Cliquez le premier segment.`);
      setStatusMessage(`${lbl} : premier segment attendu`);
    }
  };

  const applyHatchToSelection = (patternArg?: string) => {
    const allowed = ["ansi31", "ansi32", "dots", "solid", "none"];
    const targetPattern = patternArg && allowed.includes(patternArg.toLowerCase())
      ? (patternArg.toLowerCase() as any)
      : undefined;

    const closedSelected = cad2dEntities.filter((e) =>
      selectedCad2dIds.includes(e.id) && ["rectangle", "polygon", "triangle", "circle"].includes(e.type)
    );

    if (closedSelected.length === 0) {
      setAutocadPrompt("HACHURE (HATCH) : Sélectionnez d'abord un rectangle, polygone ou cercle fermé.");
      setStatusMessage("Sélectionnez un contour fermé pour hachurer");
      return;
    }

    pushHistory();
    setCad2dEntities((prev) =>
      prev.map((ent) => {
        if (!selectedCad2dIds.includes(ent.id)) return ent;
        const current = ent.hatchPattern || "none";
        const nextPat = targetPattern || (current === "none" ? "ansi31" : current === "ansi31" ? "ansi32" : current === "ansi32" ? "dots" : current === "dots" ? "solid" : "none");
        return { ...ent, hatchPattern: nextPat };
      })
    );

    setStatusMessage("Motif de hachure appliqué");
    setAutocadPrompt("HACHURE : Motif appliqué aux formes fermées sélectionnées.");
  };

  const handleCad2dModifyPointerDown = (clickPt: Cad2dPoint, target?: Element): boolean => {
    const sess = cad2dModifySessionRef.current;
    if (!sess) return false;

    const nearest = findNearestLineOrSegment(clickPt, 0.8);

    // 1. TRIM
    if (sess.mode === "trim") {
      if (!nearest) {
        setAutocadPrompt("AJUSTER (TRIM) : Cliquez sur un segment de tuyauterie ou ligne 2D à découper.");
        return true;
      }

      const allCutters = collectAllDrawingSegments(nearest.type === "cad2d" ? nearest.ent.id : nearest.seg.id);
      if (allCutters.length === 0) {
        setAutocadPrompt("AJUSTER : Aucune frontière de coupe présente dans le plan.");
        setStatusMessage("Aucun couteau disponible");
        return true;
      }

      if (nearest.type === "cad2d") {
        const ent = nearest.ent;
        if (ent.type === "line" && ent.points && ent.points.length >= 2) {
          const lineSeg = { p1: ent.points[0], p2: ent.points[1] };
          const trimmed = cad2dTrimLine(lineSeg, allCutters, clickPt);
          if (!trimmed || trimmed.length === 0) {
            setAutocadPrompt("AJUSTER : Ce segment ne croise aucune frontière de coupe au point cliqué.");
            setStatusMessage("Aucune intersection sécante trouvée");
            return true;
          }
          pushHistory();
          updateCad2dEntity(ent.id, { points: [trimmed[0].p1, trimmed[0].p2] });
          for (let i = 1; i < trimmed.length; i++) {
            const { id: _ignoredId, ...restEnt } = ent;
            addCad2dEntity({
              ...restEnt,
              points: [trimmed[i].p1, trimmed[i].p2],
            });
          }
          setAutocadPrompt("AJUSTER : Segment ajusté. Cliquez un autre segment ou Échap pour terminer.");
          setStatusMessage("Segment 2D ajusté à l'intersection");
          return true;
        } else {
          setAutocadPrompt("AJUSTER : Seuls les segments linéaires peuvent être ajustés.");
          return true;
        }
      } else {
        const { seg, fn, tn } = nearest;
        const lineSeg = { p1: { x: fn.x, y: fn.y }, p2: { x: tn.x, y: tn.y } };
        const trimmed = cad2dTrimLine(lineSeg, allCutters, clickPt);
        if (!trimmed || trimmed.length === 0) {
          setAutocadPrompt("AJUSTER : Ce tronçon ne croise aucune arête sécante.");
          setStatusMessage("Aucune intersection sécante");
          return true;
        }
        pushHistory();
        const cutPoint = trimmed[0].p2;
        const newNodeId = uid("node");
        const newNode: IsoNode = {
          id: newNodeId,
          name: `N-TRIM-${nodes.length + 1}`,
          x: Number(cutPoint.x.toFixed(3)),
          y: Number(cutPoint.y.toFixed(3)),
          z: fn.z,
          type: "normal",
          ports: [],
        };
        const nextNodes = [...nodes, newNode];
        const nextSegments = segments.map((s) =>
          s.id === seg.id ? { ...s, toNodeId: newNodeId } : s
        );
        commitGraph(nextNodes, recalcSegmentLengths(nextNodes, nextSegments));
        setAutocadPrompt("AJUSTER : Tronçon de tuyauterie ajusté. Cliquez un autre segment ou Échap.");
        setStatusMessage("Tronçon de tuyauterie ajusté");
        return true;
      }
    }

    // 2. EXTEND
    if (sess.mode === "extend") {
      if (!nearest) {
        setAutocadPrompt("PROLONGER (EXTEND) : Cliquez vers l'extrémité d'un segment à prolonger.");
        return true;
      }

      const boundaries = collectAllDrawingSegments(nearest.type === "cad2d" ? nearest.ent.id : nearest.seg.id);
      if (boundaries.length === 0) {
        setAutocadPrompt("PROLONGER : Aucune limite de frontière présente dans le plan.");
        return true;
      }

      if (nearest.type === "cad2d") {
        const ent = nearest.ent;
        if (ent.type === "line" && ent.points && ent.points.length >= 2) {
          const lineSeg = { p1: ent.points[0], p2: ent.points[1] };
          const res = cad2dExtendLine(lineSeg, boundaries, clickPt);
          if (!res) {
            setAutocadPrompt("PROLONGER : Aucune arête frontière trouvée dans la direction du segment.");
            setStatusMessage("Aucune limite sécante");
            return true;
          }
          pushHistory();
          updateCad2dEntity(ent.id, { points: [res.updatedLine.p1, res.updatedLine.p2] });
          setAutocadPrompt("PROLONGER : Segment prolongé. Cliquez un autre segment ou Échap.");
          setStatusMessage("Segment 2D prolongé jusqu'à la limite");
          return true;
        } else {
          setAutocadPrompt("PROLONGER : Seuls les segments linéaires peuvent être prolongés.");
          return true;
        }
      } else {
        const { seg, fn, tn } = nearest;
        const lineSeg = { p1: { x: fn.x, y: fn.y }, p2: { x: tn.x, y: tn.y } };
        const res = cad2dExtendLine(lineSeg, boundaries, clickPt);
        if (!res) {
          setAutocadPrompt("PROLONGER : Aucune arête frontière dans l'axe de ce tronçon.");
          return true;
        }
        pushHistory();
        const extendedEnd = res.extendedEnd;
        const targetNodeId = extendedEnd === "p1" ? fn.id : tn.id;
        const newCoord = extendedEnd === "p1" ? res.updatedLine.p1 : res.updatedLine.p2;
        const nextNodes = nodes.map((n) =>
          n.id === targetNodeId
            ? { ...n, x: Number(newCoord.x.toFixed(3)), y: Number(newCoord.y.toFixed(3)) }
            : n
        );
        commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
        setAutocadPrompt("PROLONGER : Tronçon prolongé. Cliquez un autre segment ou Échap.");
        setStatusMessage("Tronçon de tuyauterie prolongé");
        return true;
      }
    }

    // 3. OFFSET
    if (sess.mode === "offset") {
      if (sess.step === 0) {
        if (!nearest) {
          const closedEnt = cad2dEntities.find((e) => {
            if (e.visible === false) return false;
            if (e.type === "circle" && e.center) {
              return cadDist(e.center, clickPt) <= (e.radius || 1) + 0.5;
            }
            return false;
          });
          if (closedEnt) {
            setCad2dModifySession({ ...sess, step: 1, firstEntityId: closedEnt.id });
            setAutocadPrompt(`DÉCALER : Cliquez du côté où décaler (intérieur ou extérieur, distance ${sess.offsetDist} m).`);
            setStatusMessage(`Cercle sélectionné · Distance ${sess.offsetDist} m`);
            return true;
          }
          setAutocadPrompt("DÉCALER (OFFSET) : Cliquez sur l'élément (ligne, cercle ou tube) à décaler.");
          return true;
        }
        if (nearest.type === "cad2d") {
          setCad2dModifySession({ ...sess, step: 1, firstEntityId: nearest.ent.id });
          setAutocadPrompt(`DÉCALER : Cliquez du côté où décaler la parallèle (distance active : ${sess.offsetDist} m).`);
          setStatusMessage(`Élément 2D sélectionné · Distance ${sess.offsetDist} m`);
          return true;
        } else {
          setCad2dModifySession({ ...sess, step: 1, firstSegmentId: nearest.seg.id });
          setAutocadPrompt(`DÉCALER : Cliquez du côté où décaler la tuyauterie (distance active : ${sess.offsetDist} m).`);
          setStatusMessage(`Tronçon sélectionné · Distance ${sess.offsetDist} m`);
          return true;
        }
      } else {
        if (sess.firstEntityId) {
          const ent = cad2dEntities.find((e) => e.id === sess.firstEntityId);
          if (!ent) {
            setCad2dModifySession(null);
            return true;
          }
          pushHistory();
          const { id: _ignoredId, ...restEnt } = ent;
          if (ent.type === "line" && ent.points && ent.points.length >= 2) {
            const off = cad2dOffsetLine(ent.points[0], ent.points[1], sess.offsetDist, clickPt);
            addCad2dEntity({
              ...restEnt,
              points: [off.p1, off.p2],
            });
            setStatusMessage(`Parallèle créée à ${sess.offsetDist} m`);
          } else if (ent.type === "circle" && ent.center) {
            const off = cad2dOffsetCircle(ent.center, ent.radius || 1, sess.offsetDist, clickPt);
            addCad2dEntity({
              ...restEnt,
              center: off.center,
              radius: off.radius,
            });
            setStatusMessage(`Cercle concentrique créé`);
          } else if ((ent.type === "rectangle" || ent.type === "polygon" || ent.type === "triangle") && ent.points) {
            const offPoints = cad2dOffsetPolygon(ent.points, sess.offsetDist, clickPt);
            addCad2dEntity({
              ...restEnt,
              points: offPoints,
            });
            setStatusMessage(`Polygone décalé créé`);
          }
          setCad2dModifySession({ ...sess, step: 0, firstEntityId: undefined, firstSegmentId: undefined });
          setAutocadPrompt("DÉCALER : Élément décalé. Cliquez un autre objet à décaler ou Échap pour quitter.");
          return true;
        } else if (sess.firstSegmentId) {
          const seg = segments.find((s) => s.id === sess.firstSegmentId);
          const fn = seg ? nodes.find((n) => n.id === seg.fromNodeId) : null;
          const tn = seg ? nodes.find((n) => n.id === seg.toNodeId) : null;
          if (!seg || !fn || !tn) {
            setCad2dModifySession(null);
            return true;
          }
          pushHistory();
          const off = cad2dOffsetLine({ x: fn.x, y: fn.y }, { x: tn.x, y: tn.y }, sess.offsetDist, clickPt);
          const newFnId = uid("node");
          const newTnId = uid("node");
          const newFn: IsoNode = {
            id: newFnId,
            name: `${fn.name}-OFF`,
            x: Number(off.p1.x.toFixed(3)),
            y: Number(off.p1.y.toFixed(3)),
            z: fn.z,
            type: fn.type,
            ports: [],
          };
          const newTn: IsoNode = {
            id: newTnId,
            name: `${tn.name}-OFF`,
            x: Number(off.p2.x.toFixed(3)),
            y: Number(off.p2.y.toFixed(3)),
            z: tn.z,
            type: tn.type,
            ports: [],
          };
          const newSeg: IsoSegment = {
            ...seg,
            id: uid("seg"),
            fromNodeId: newFnId,
            toNodeId: newTnId,
            length: seg.length,
            fittings: [],
          };
          const nextNodes = [...nodes, newFn, newTn];
          const nextSegments = [...segments, newSeg];
          commitGraph(nextNodes, recalcSegmentLengths(nextNodes, nextSegments));
          setCad2dModifySession({ ...sess, step: 0, firstEntityId: undefined, firstSegmentId: undefined });
          setAutocadPrompt("DÉCALER : Tronçon de tuyauterie parallèle créé. Cliquez un autre objet ou Échap.");
          setStatusMessage(`Tuyauterie parallèle créée à ${sess.offsetDist} m`);
          return true;
        }
      }
    }

    // 4. FILLET / CHAMFER
    if (sess.mode === "fillet" || sess.mode === "chamfer") {
      if (sess.step === 0) {
        if (!nearest) {
          setAutocadPrompt("RACCORD : Cliquez sur le premier segment à raccorder.");
          return true;
        }
        setCad2dModifySession({
          ...sess,
          step: 1,
          firstEntityId: nearest.type === "cad2d" ? nearest.ent.id : undefined,
          firstSegmentId: nearest.type === "pipe" ? nearest.seg.id : undefined,
          firstLine: nearest.line,
        });
        setAutocadPrompt(`RACCORD : Premier segment sélectionné. Cliquez sur le deuxième segment (Rayon: ${sess.filletRadius} m).`);
        setStatusMessage(`Premier segment sélectionné · Rayon ${sess.filletRadius} m`);
        return true;
      } else {
        if (!nearest || !sess.firstLine) {
          setAutocadPrompt("RACCORD : Cliquez sur le deuxième segment à raccorder.");
          return true;
        }
        const res = cad2dFilletLines(sess.firstLine, nearest.line, sess.filletRadius);
        if (!res) {
          setAutocadPrompt("RACCORD : Impossible de raccorder ces deux segments (lignes parallèles ou sans intersection).");
          setStatusMessage("Raccordement impossible");
          return true;
        }
        pushHistory();
        if (sess.firstEntityId) {
          updateCad2dEntity(sess.firstEntityId, { points: [res.trimmedSeg1.p1, res.trimmedSeg1.p2] });
        }
        if (nearest.type === "cad2d") {
          updateCad2dEntity(nearest.ent.id, { points: [res.trimmedSeg2.p1, res.trimmedSeg2.p2] });
        }
        addCad2dEntity({
          type: "arc",
          layerId: "axes_tuyauterie",
          color: "#38bdf8",
          center: res.arc.center,
          radius: res.arc.radius,
          startAngle: res.arc.startAngle,
          endAngle: res.arc.endAngle,
          metadata: { intent: "draft", source: "fillet" },
        });
        setCad2dModifySession(null);
        setAutocadPrompt("RACCORD : Raccordement tangentiel créé avec succès.");
        setStatusMessage(`Raccord tangentiel R=${sess.filletRadius} m créé`);
        return true;
      }
    }

    // 5. SCALE
    if (sess.mode === "scale") {
      if (sess.step === 0) {
        setCad2dModifySession({ ...sess, step: 1, basePoint: clickPt });
        setAutocadPrompt(`ÉCHELLE : Point de base fixé à (${clickPt.x.toFixed(2)}, ${clickPt.y.toFixed(2)}). Tapez le facteur (ex: 2) puis Entrée, ou cliquez un point de référence.`);
        setStatusMessage("Point de base fixé · Entrez le facteur d'échelle");
        return true;
      } else {
        const bp = sess.basePoint || { x: 0, y: 0 };
        const d = Math.hypot(clickPt.x - bp.x, clickPt.y - bp.y);
        const factor = Math.max(0.1, Number((d / 1.0).toFixed(2)));
        applyScaleWithFactor(factor, bp);
        return true;
      }
    }

    return false;
  };
  handleCad2dModifyPointerDownRef.current = handleCad2dModifyPointerDown;

  const executeCadCommand = (cmdInput: CadCommandItem | string) => {

    // PATCH 016A style commands : LW/EPAISSEUR/COLOR/STYLE + raccourcis ON/OFF.
    const rawCommandText = typeof cmdInput === "string" ? cmdInput.trim() : cmdInput.name;
    const rawParts = rawCommandText.split(/\s+/).filter(Boolean);
    const rawVerb = (rawParts[0] || "").toLowerCase();
    const rawArg = rawParts[1];
    const colorMap: Record<string, string> = { cyan: "#0EA5E9", bleu: "#0EA5E9", blue: "#0EA5E9", rouge: "#EF4444", red: "#EF4444", vert: "#22C55E", green: "#22C55E", jaune: "#FACC15", yellow: "#FACC15", blanc: "#E5E7EB", white: "#E5E7EB", gris: "#9CA3AF", gray: "#9CA3AF", grey: "#9CA3AF" };
    if (["lw", "lineweight", "epaisseur", "épaisseur"].includes(rawVerb)) {
      const value = Math.min(3, Math.max(0.35, Number(rawArg || "1")));
      setPipeStrokeScale(value);
      setCad2dStrokeScale(value);
      setAutocadPrompt(`COMMANDE [${rawVerb.toUpperCase()}] : épaisseur globale réglée à ${value.toFixed(2)}×.`);
      setStatusMessage(`Épaisseur globale ${value.toFixed(2)}×`);
      return;
    }
    if (["color", "couleur"].includes(rawVerb)) {
      const color = colorMap[(rawArg || "").toLowerCase()] || rawArg;
      if (color && /^#?[0-9a-f]{6}$/i.test(color)) {
        const normalized = color.startsWith("#") ? color : `#${color}`;
        setDefaultPipeColor(normalized);
        setDefaultCadColor(normalized);
        setAutocadPrompt(`COMMANDE [COULEUR] : couleur active ${normalized}.`);
        setStatusMessage(`Couleur active ${normalized}`);
        return;
      }
      if (color && color.startsWith("#")) {
        setDefaultPipeColor(color);
        setDefaultCadColor(color);
        setAutocadPrompt(`COMMANDE [COULEUR] : couleur active ${color}.`);
        return;
      }
      setAutocadPrompt("COMMANDE [COULEUR] : indiquez cyan, rouge, vert, jaune, blanc, gris ou #RRGGBB.");
      return;
    }
    const normalizedCmdString = rawCommandText.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      ["workspace", "work", "wor", "ws", "wspace", "espacetravail", "espace", "esp", "multiscreen", "multiecran", "multi_ecran", "doubleecran", "double_ecran", "double", "ecran", "ecrans", "ecran2", "deuxiemeecran", "2emeecran", "moniteur", "moniteurs", "dualscreen", "displays", "screen2", "secondscreen", "secondecran"].includes(rawVerb) ||
      normalizedCmdString.includes("workspace") ||
      normalizedCmdString.includes("doubleecran") ||
      normalizedCmdString.includes("multiecran") ||
      normalizedCmdString.includes("ecran2") ||
      normalizedCmdString.includes("deuxiemeecran")
    ) {
      setWorkspaceConfigModalOpen(true);
      setAutocadPrompt("COMMANDE [WORKSPACE] : Configuration de l'espace de travail et multi-écran.");
      setStatusMessage("Espace de travail & Multi-écran");
      return;
    }
    if (
      ["casttv", "cast", "caster", "tv", "smarttv", "projeter", "projection", "chromecast", "airplay", "miracast", "screencast", "androidtv", "tele", "television"].includes(rawVerb) ||
      normalizedCmdString.includes("cast") ||
      normalizedCmdString.includes("chromecast") ||
      normalizedCmdString.includes("smarttv") ||
      normalizedCmdString.includes("projeter")
    ) {
      setWorkspaceConfigModalOpen(true);
      setAutocadPrompt("COMMANDE [CASTTV] : Projection sans fil et Cast vers Smart TV Android / Chromecast.");
      setStatusMessage("Caster / Projeter sur Smart TV");
      return;
    }
    // COMMANDES ENVELOPPE DE VOLUME ET SKID INDUSTRIEL PAR EXTRUSION
    if (["volume_panel", "volume", "skid", "enveloppe", "cadrage"].includes(rawVerb)) {
      setRightPanelOpen(true);
      setRightPanelTab("volume");
      setEnvelopeActive(true);
      setAutocadPrompt("COMMANDE [VOLUME] : Ouverture du panneau de gestion du volume et skid d'intégration.");
      setStatusMessage("Panneau Volume Skid ouvert");
      return;
    }
    if (["volume_extrude", "extruder", "extrude", "ext"].includes(rawVerb)) {
      setRightPanelOpen(true);
      setRightPanelTab("volume");
      setEnvelopeActive(true);
      if (rawArg) {
        const h = Math.max(0.5, Number(rawArg) || 2.5);
        setEnvelopeHeight(h);
        setAutocadPrompt(`COMMANDE [EXTRUDE] : Enveloppe de travail extrudée à H = ${h.toFixed(2)} m.`);
        setStatusMessage(`Extrusion Z = ${h.toFixed(2)} m`);
      } else {
        setAutocadPrompt("COMMANDE [EXTRUDE] : Définissez la hauteur d'extrusion sous plafond dans le panneau droit.");
      }
      return;
    }
    if (["volume_toggle", "vtoggle", "gabarit"].includes(rawVerb)) {
      setEnvelopeActive(prev => {
        const next = !prev;
        setAutocadPrompt(`COMMANDE [VOLUME_TOGGLE] : Affichage de l'enveloppe ${next ? "ACTIVÉ" : "DÉSACTIVÉ"}.`);
        setStatusMessage(`Enveloppe ${next ? "visible" : "masquée"}`);
        return next;
      });
      return;
    }
    if (["volume_check", "vcheck", "confinement"].includes(rawVerb)) {
      setRightPanelOpen(true);
      setRightPanelTab("volume");
      const issuesCount = outOfEnvelopeNodes.length + outOfEnvelopeSupports.length;
      setAutocadPrompt(`COMMANDE [VOLUME_CHECK] : Contrôle lancé. ${issuesCount === 0 ? "Aucun dépassement de gabarit détecté." : `${issuesCount} élément(s) hors limites détecté(s).`}`);
      return;
    }

    if (["deplacer", "deplace", "move", "m", "translation"].includes(rawVerb)) {
      startGuidedCommand("move");
      return;
    }
    if (["copie", "copier", "copy", "co", "cp"].includes(rawVerb)) {
      startGuidedCommand("copy");
      return;
    }
    if (["rotation", "rotate", "ro", "tourner"].includes(rawVerb)) {
      startGuidedCommand("rotate");
      return;
    }
    if (["demo", "complexe", "exemple", "sample", "projet_demo", "modele"].includes(rawVerb)) {
      loadPresetDemoComplexe();
      return;
    }
    if (["demo_ct", "democt", "chambre", "chambre_technique"].includes(rawVerb)) {
      loadPresetChambreTechnique();
      return;
    }
    if (["demo_skid", "demoskid", "skid_filtration", "skid_demo"].includes(rawVerb)) {
      loadPresetSkidFiltration();
      return;
    }

    // PATCH 017Q : Commandes d'association (Spool / Groupe) et dissociation
    if (["associer", "assoc", "grouper", "group", "g", "spool", "ass"].includes(rawVerb)) {
      associateSelectionToSpool(rawArg);
      return;
    }
    if (["dissocier", "dissoc", "degrouper", "ungroup", "ung", "unspool", "diss"].includes(rawVerb)) {
      dissociateSelectionFromSpool();
      return;
    }

    // PALIER 2B : Commandes de modification géométrique transactionnelle (TRIM, EXTEND, OFFSET, FILLET, SCALE, CHAMFER, HATCH)
    if (["echelle", "scale", "sc"].includes(rawVerb)) {
      startCad2dScaleCommand(rawArg);
      return;
    }
    if (["ajuster", "trim", "tr", "couper"].includes(rawVerb)) {
      startCad2dModifyCommand("trim");
      return;
    }
    if (["prolonger", "extend", "ex"].includes(rawVerb)) {
      startCad2dModifyCommand("extend");
      return;
    }
    if (["decaler", "offset", "o"].includes(rawVerb)) {
      startCad2dModifyCommand("offset", rawArg);
      return;
    }
    if (["raccord", "fillet", "f", "conge"].includes(rawVerb)) {
      startCad2dModifyCommand("fillet", rawArg);
      return;
    }
    if (["chanfrein", "chamfer", "cha"].includes(rawVerb)) {
      startCad2dModifyCommand("chamfer", rawArg);
      return;
    }
    if (["hachure", "hatch", "h"].includes(rawVerb)) {
      applyHatchToSelection(rawArg);
      return;
    }
    if (["text", "texte", "mtext", "dt"].includes(rawVerb)) {
      startCadDraft("text");
      return;
    }

    // PALIER 2C : Commandes de supportage MSS SP-58 et Génie Civil
    if (["support", "sup", "mss"].includes(rawVerb)) {
      setActiveSupportTypeToPlace("mss_type_35");
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("COMMANDE [SUPPORT] : Cliquez sur un tronçon pour insérer un support MSS SP-58 (Échap pour annuler).");
      setStatusMessage("Cliquez un tronçon pour placer le support MSS SP-58");
      return;
    }
    if (["pointfixe", "anchor", "ancrage"].includes(rawVerb)) {
      setActiveSupportTypeToPlace("mss_type_57");
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("COMMANDE [POINT FIXE] : Cliquez un tronçon pour placer un point fixe rigide MSS Type 57.");
      setStatusMessage("Cliquez un tronçon pour placer le point fixe");
      return;
    }
    if (["guide", "glissiere"].includes(rawVerb)) {
      setActiveSupportTypeToPlace("mss_type_35");
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("COMMANDE [GUIDE] : Cliquez un tronçon pour placer un guide coulissant MSS Type 35.");
      setStatusMessage("Cliquez un tronçon pour placer le guide coulissant");
      return;
    }
    if (["pendard", "hanger", "tige"].includes(rawVerb)) {
      setActiveSupportTypeToPlace("mss_type_1");
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("COMMANDE [PENDARD] : Cliquez un tronçon pour placer un pendard simple réglable MSS Type 1.");
      setStatusMessage("Cliquez un tronçon pour placer le pendard");
      return;
    }
    if (["patin", "shoe"].includes(rawVerb)) {
      setActiveSupportTypeToPlace("mss_type_39");
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("COMMANDE [PATIN] : Cliquez un tronçon pour placer un patin soudé MSS Type 39.");
      setStatusMessage("Cliquez un tronçon pour placer le patin soudé");
      return;
    }
    if (["ressort", "spring"].includes(rawVerb)) {
      setActiveSupportTypeToPlace("mss_type_51");
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("COMMANDE [RESSORT] : Cliquez un tronçon pour placer un support à ressort variable MSS Type 51.");
      setStatusMessage("Cliquez un tronçon pour placer la boîte à ressort");
      return;
    }
    if (["verifspan", "span", "portee", "portées"].includes(rawVerb)) {
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("VÉRIFICATION DES PORTÉES : calcul ASME B31.3 Table 321.1.3 exécuté sur tous les tronçons.");
      setStatusMessage("Portées ASME B31.3 vérifiées");
      return;
    }
    if (["gc", "geniecivil", "mto_gc"].includes(rawVerb)) {
      setRightPanelOpen(true);
      setRightPanelTab("supports");
      setAutocadPrompt("GÉNIE CIVIL : récapitulatif platines, ancrages EN 1992-4 et massifs béton.");
      setStatusMessage("Panneau Génie Civil affiché");
      return;
    }

    // PATCH 017A : commandes de tagging et Project Setup.
    if (["projectsetup", "ps", "setup", "projet"].includes(rawVerb)) {
      setProjectSetupOpen(true);
      setAutocadPrompt("PROJECT SETUP : configuration projet, formats de tag, services et specs.");
      return;
    }
    if (["tagformat", "tf"].includes(rawVerb)) {
      setProjectSetupOpen(true);
      setAutocadPrompt("TAG FORMAT ACTIF : " + activeTagFormat.name + " (" + activeTagFormat.parts.map(p => p.field).join(" " + activeTagFormat.separator + " ") + ").");
      return;
    }
    if (["tag"].includes(rawVerb)) {
      applyTagToSelection(rawParts[1], rawParts[2]);
      return;
    }
    if (["service", "fluide"].includes(rawVerb)) {
      if (!rawArg) { setAutocadPrompt("SERVICE : indiquez un code (" + projectSetup.services.map(s => s.code).join(", ") + ")."); return; }
      applyTagToSelection(rawArg, undefined);
      return;
    }
    if (["spec", "classe"].includes(rawVerb)) {
      if (!rawArg) { setAutocadPrompt("SPEC : indiquez un code (" + projectSetup.specs.map(s => s.code).join(", ") + ")."); return; }
      applyTagToSelection(undefined, rawArg);
      return;
    }
    if (["autotag"].includes(rawVerb)) {
      autoTagAllSegments();
      return;
    }
    if (["colorbyservice", "couleurservice", "cbs"].includes(rawVerb)) {
      const on = ["on", "1", "oui", "true"].includes((rawArg || "").toLowerCase());
      const off = ["off", "0", "non", "false"].includes((rawArg || "").toLowerCase());
      const next = off ? false : on ? true : !colorByService;
      setColorByService(next);
      setAutocadPrompt("COULEUR PAR SERVICE : " + (next ? "ON" : "OFF") + ".");
      return;
    }
    // PATCH 017F1 : inspecteur cible de l element selectionne (Regle 8).
    if (["props", "pr", "proprietes", "propriete", "properties"].includes(rawVerb)) {
      setRightPanelOpen(true);
      setRightPanelTab("properties");
      const totalSelected = selectedNodeIds.length + selectedSegmentIds.length + selectedFittingIds.length;
      setAutocadPrompt(totalSelected === 0
        ? "PROPS : selectionnez un element sur le plan pour inspecter ses proprietes."
        : "PROPS : inspecteur ouvert sur " + totalSelected + " element(s).");
      setStatusMessage("Inspecteur de proprietes ouvert");
      return;
    }
    // PATCH 017C : affichage des tags, renumerotation, gestionnaire de donnees.
    if (["tagdisplay", "td", "affichetag", "tagon"].includes(rawVerb)) {
      const arg = (rawArg || "").toLowerCase();
      const on = ["on", "1", "oui", "true"].includes(arg);
      const off = ["off", "0", "non", "false"].includes(arg);
      const next = off ? false : on ? true : !tagDisplay;
      setTagDisplay(next);
      setAutocadPrompt("AFFICHAGE DES TAGS : " + (next ? "ON" : "OFF") + ".");
      setStatusMessage("Tags sur le plan " + (next ? "affiches" : "masques"));
      return;
    }
    if (["renumber", "rn", "renumeroter"].includes(rawVerb)) {
      const first = (rawParts[1] || "").toUpperCase();
      const isNumberFirst = first !== "" && !isNaN(Number(first));
      const svc = isNumberFirst ? undefined : (first || undefined);
      const start = isNumberFirst ? Number(first) : Number(rawParts[2] || "1");
      renumberTags(svc, isNaN(start) ? 1 : start);
      return;
    }
    if (["datamanager", "dm", "donnees", "tableau"].includes(rawVerb)) {
      setDataManagerOpen(true);
      setAutocadPrompt("DATA MANAGER : liste des elements tagges du projet.");
      return;
    }
    if (["style"].includes(rawVerb)) {
      setAutocadPrompt(`STYLE ACTIF : tube ${workspaceVisualStyle.pipeStrokeScale.toFixed(2)}× ${workspaceVisualStyle.defaultPipeColor}, 2D ${workspaceVisualStyle.cad2dStrokeScale.toFixed(2)}× ${workspaceVisualStyle.defaultCadColor}.`);
      return;
    }
    if (["shortcuts", "raccourcis", "raccourci"].includes(rawVerb)) {
      const next = ["on", "1", "oui", "true"].includes((rawArg || "").toLowerCase());
      const off = ["off", "0", "non", "false"].includes((rawArg || "").toLowerCase());
      setKeyboardShortcutsEnabled(off ? false : next ? true : !keyboardShortcutsEnabled);
      setAutocadPrompt(`RACCOURCIS CLAVIER : ${off ? "OFF" : next ? "ON" : !keyboardShortcutsEnabled ? "ON" : "OFF"}.`);
      return;
    }
    // 017Q : Commandes AutoCAD ALIGN / AX / AY / AZ / AT et PARALLEL / REDRESSER
    if (["align", "al", "aligner", "alignement", "aligne"].includes(rawVerb)) {
      startAlignWizard();
      return;
    }
    if (["ax", "ay", "az", "alignerx", "alignery", "alignerz", "alignx", "aligny", "alignz"].includes(rawVerb)) {
      const axis = (rawVerb.endsWith("y") || (rawArg && rawArg.toLowerCase() === "y")) ? "y"
        : (rawVerb.endsWith("z") || (rawArg && rawArg.toLowerCase() === "z")) ? "z"
        : "x";
      alignSelectedNodesAxis(axis);
      setAutocadPrompt(`COMMANDE [ALIGN] : Alignement selon l'axe monde ${axis.toUpperCase()} exécuté.`);
      return;
    }
    if (["at", "eqsurtube", "alignertube", "alignonsurface"].includes(rawVerb)) {
      alignSelectedEquipmentOnTube();
      return;
    }
    if (["parallel", "par", "parallele", "//", "rendreparallele"].includes(rawVerb)) {
      startParallelWizard();
      return;
    }
    if (["iso", "redresser", "redresseriso", "straighten"].includes(rawVerb)) {
      redressIsoSelection();
      return;
    }
    if (["tube", "t", "pipe", "troncon", "tronçon", "canalisation", "relier", "connect", "joint"].includes(rawVerb)) {
      createTubeFromSelection();
      return;
    }
    let cmdId = typeof cmdInput === "string" ? cmdInput.trim().toLowerCase() : (cmdInput?.id ? cmdInput.id.toLowerCase() : "");
    if (typeof cmdInput === "string") {
      const match = AUTOCAD_COMMANDS.find(
        (c) =>
          (c.id || "").toLowerCase() === cmdId ||
          (c.name || "").toLowerCase() === cmdId ||
          c.aliases?.some((a) => (a || "").toLowerCase() === cmdId),
      );
      if (match) cmdId = match.id;
    }

    const cmdName = typeof cmdInput === "string" ? cmdInput : cmdInput.name;
    setAutocadCmdHistory((prev) => [cmdName, ...prev.filter((h) => h !== cmdName)].slice(0, 30));
    setAutocadCmdInput("");
    setAutocadSuggestions([]);

    if (cmdId === "demo") {
      loadPresetDemoComplexe();
      return;
    } else if (cmdId === "workspace") {
      setWorkspaceConfigModalOpen(true);
      setAutocadPrompt("COMMANDE [WORKSPACE] : Configuration de l'espace de travail et multi-écran.");
      setStatusMessage("Espace de travail & Multi-écran");
      return;
    } else if (cmdId === "casttv") {
      setWorkspaceConfigModalOpen(true);
      setAutocadPrompt("COMMANDE [CASTTV] : Projection sans fil et Cast vers Smart TV Android / Chromecast.");
      setStatusMessage("Caster / Projeter sur Smart TV");
      return;
    } else if (cmdId === "copy") {
      const hasCad = copyCad2dSelection();
      const sub = selectionSubGraph();
      if (sub.nodes.length) {
        copySelection();
      }
      if (hasCad || sub.nodes.length) {
        setAutocadPrompt("COMMANDE [COPIER] : Sélection copiée. Tapez COLLER pour insérer au clic souris.");
        setStatusMessage("Sélection copiée · Prêt pour COLLER");
      } else {
        setAutocadPrompt("COMMANDE [COPIER] : Aucun élément sélectionné. Sélectionnez d'abord des objets.");
        setStatusMessage("Sélectionnez des éléments avant de copier");
      }
    } else if (cmdId === "paste") {
      startCadDraft("paste_target");
    } else if (cmdId === "move") {
      startCadDraft("move_target");
    } else if (cmdId === "rectangle") {
      startCadDraft("rectangle");
    } else if (cmdId === "triangle") {
      startCadDraft("triangle", "equilateral");
    } else if (cmdId === "polygon") {
      startCadDraft("polygon", undefined, polygonSidesCount);
    } else if (cmdId === "arc") {
      startCadDraft("arc", "3points");
    } else if (cmdId === "circle") {
      startCadDraft("circle");
    } else if (cmdId === "line") {
      startCadDraft("line");
    } else if (cmdId === "polyline") {
      startCadDraft("polyline");
    } else if (cmdId === "text") {
      startCadDraft("text");
    } else if (cmdId === "dimension") {
      setIsoDrawMode("dimension");
      setInteractionMode("select");
      setDimensionPick(null);
      setAutocadPrompt("COMMANDE [COTATION] : Cliquez sur le premier ancrage puis le deuxième.");
      setStatusMessage("Outil Cotation actif");
    } else if (cmdId === "delete") {
      if (selectedCad2dIds.length) deleteSelectedCad2d();
      else deleteSelection();
      setAutocadPrompt("COMMANDE [EFFACER] : Éléments sélectionnés supprimés.");
    } else if (cmdId === "rotate") {
      if (selectedCad2dIds.length) rotateSelectedCad2d(15);
      else rotateSelectedEquipment(15);
      setAutocadPrompt("COMMANDE [ROTATION] : Rotation de 15° appliquée.");
    } else if (cmdId === "duplicate") {
      if (selectedCad2dIds.length) duplicateSelectedCad2d();
      else duplicateSelection();
      setAutocadPrompt("COMMANDE [DUPLIQUER] : Éléments dupliqués avec succès.");
    } else if (cmdId === "mirror") {
      if (selectedCad2dIds.length) mirrorSelectedCad2dX();
      else {
        if (selectedNodeIds.length) {
          const ids = new Set(selectedNodeIds);
          const selNodes = nodes.filter((n) => ids.has(n.id));
          const minX = Math.min(...selNodes.map((n) => n.x)), maxX = Math.max(...selNodes.map((n) => n.x));
          const cx = (minX + maxX) / 2;
          const nextNodes = nodes.map((n) => (ids.has(n.id) ? { ...n, x: snapIsoV4(2 * cx - n.x, isoSnapStep) } : n));
          commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
        }
      }
      setAutocadPrompt("COMMANDE [MIROIR] : Symétrie miroir appliquée.");
      setStatusMessage("Symétrie miroir appliquée");
    } else if (cmdId === "scale") {
      startCad2dScaleCommand();
    } else if (cmdId === "trim") {
      startCad2dModifyCommand("trim");
    } else if (cmdId === "extend") {
      startCad2dModifyCommand("extend");
    } else if (cmdId === "offset") {
      startCad2dModifyCommand("offset");
    } else if (cmdId === "fillet") {
      startCad2dModifyCommand("fillet");
    } else if (cmdId === "chamfer") {
      startCad2dModifyCommand("chamfer");
    } else if (cmdId === "hatch") {
      applyHatchToSelection();
    } else if (cmdId === "undo") {
      undoGraph();
      setAutocadPrompt("COMMANDE [ANNULER] : Action annulée.");
    } else if (cmdId === "redo") {
      redoGraph();
      setAutocadPrompt("COMMANDE [RETABLIR] : Action rétablie.");
    } else if (cmdId === "zoom_all") {
      resetView();
      setAutocadPrompt("COMMANDE [ZOOM] : Vue recentrée sur l'étendue du projet.");
    } else if (cmdId === "grid") {
      setShowGrid((v) => !v);
      setAutocadPrompt("COMMANDE [GRILLE] : Visibilité de la grille inversée.");
    } else if (cmdId === "pipe") {
      createTubeFromSelection();
    } else if (cmdId === "node") {
      setIsoDrawMode("node");
      setInteractionMode("select");
      setAutocadPrompt("COMMANDE [NOEUD] : Cliquez dans le plan pour créer un nœud.");
      setStatusMessage("Création de nœud");
    } else if (cmdId === "tee") {
      setIsoDrawMode("te");
      setInteractionMode("select");
      setAutocadPrompt("COMMANDE [TE] : Cliquez sur un tube ou dans le plan pour insérer un Té.");
      setStatusMessage("Insertion de Té");
    } else if (cmdId === "elbow") {
      setIsoDrawMode("coude");
      setInteractionMode("select");
      setAutocadPrompt("COMMANDE [COUDE] : Cliquez pour insérer un coude.");
      setStatusMessage("Insertion de coude");
    } else if (cmdId === "valve") {
      setIsoDrawMode("coude");
      setAutocadPrompt("COMMANDE [VANNE] : Sélectionner l'équipement vanne.");
    } else if (cmdId === "bom") {
      setRightPanelOpen(true);
      setRightPanelTab("bom");
      setAutocadPrompt("COMMANDE [BOM] : Nomenclature et métré des tuyauteries affichés.");
    } else if (cmdId === "properties") {
      setRightPanelOpen(true);
      setRightPanelTab("properties");
      setAutocadPrompt("COMMANDE [PROPRIETES] : Inspecteur de propriétés ouvert.");
    } else if (cmdId === "save") {
      // PATCH 017I : sauvegarde locale immediate, sans attendre l autosauvegarde.
      try {
        const snapshot017I = buildProjectFileV474();
        if (AUTOSAVE_CURRENT_KEY) {
          const previous017I = localStorage.getItem(AUTOSAVE_CURRENT_KEY);
          if (previous017I && AUTOSAVE_PREVIOUS_KEY) localStorage.setItem(AUTOSAVE_PREVIOUS_KEY, previous017I);
          localStorage.setItem(AUTOSAVE_CURRENT_KEY, JSON.stringify(snapshot017I));
        }
        autosaveBaselineRef.current = persistenceFingerprint(snapshot017I);
        const hh017I = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastSavedAt(hh017I);
        setSaveState("autosaved");
        setAutocadPrompt("COMMANDE [SAUVER] : projet enregistre localement a " + hh017I + ".");
        setStatusMessage("Sauvegarde locale effectuee a " + hh017I);
      } catch (err017I) {
        setSaveState("error");
        setAutocadPrompt("COMMANDE [SAUVER] : echec de la sauvegarde locale. Espace de stockage sature ?");
      }
    } else if (cmdId === "restore") {
      // PATCH 017I : reutilise la modale de recuperation existante.
      try {
        const raw017I = AUTOSAVE_CURRENT_KEY ? localStorage.getItem(AUTOSAVE_CURRENT_KEY) : null;
        const fallback017I = AUTOSAVE_PREVIOUS_KEY ? localStorage.getItem(AUTOSAVE_PREVIOUS_KEY) : null;
        const chosen017I = raw017I || fallback017I;
        if (!chosen017I) {
          setAutocadPrompt("COMMANDE [RESTAURER] : aucune sauvegarde locale disponible pour ce projet.");
        } else {
          setRecoveryCandidate(JSON.parse(chosen017I));
          setRecoverySource(raw017I ? "current" : "previous");
          setAutocadPrompt("COMMANDE [RESTAURER] : sauvegarde trouvee, confirmez la restauration.");
        }
      } catch (err017I) {
        setAutocadPrompt("COMMANDE [RESTAURER] : sauvegarde locale illisible.");
      }
    } else if (cmdId === "perf") {
      // PATCH 017I2 : mesure reelle, pour comparer avant et apres optimisation.
      const st017I2 = projCacheStats017I2.current;
      setAutocadPrompt(
        "COMMANDE [PERF] : " + st017I2.count + " noeud(s) en cache Float32Array, " +
        st017I2.bytes + " octets, " + st017I2.builds + " reprojection(s), " +
        "derniere en " + st017I2.ms + " ms.",
      );
      setStatusMessage("PERF : cache " + st017I2.bytes + " octets, " + st017I2.ms + " ms");
    } else {
      const plant3dCommand = PDI_PLANT3D_COMMAND_TABLE?.find((item) =>
        (item.id || "").toLowerCase() === cmdId ||
        (item.command || "").toLowerCase() === cmdId ||
        item.aliases?.some((alias) => (alias || "").toLowerCase() === cmdId),
      );
      if (plant3dCommand) {
        if (plant3dCommand.id === "datamanager" || plant3dCommand.id === "bom") {
          setRightPanelOpen(true);
          setRightPanelTab("bom");
        }
        if (plant3dCommand.id === "plantisoview" || plant3dCommand.id === "plantisoquick") {
          setIsoMode("planche");
        }
        if (plant3dCommand.id === "pan") {
          setInteractionMode("main");
        }
        if (plant3dCommand.id === "zoom" || plant3dCommand.id === "regen") {
          resetView();
        }
        setAutocadPrompt(`COMMANDE [${plant3dCommand.command}] : ${plant3dCommand.pdiAction}. Statut: ${plant3dCommand.readiness}.`);
        setStatusMessage(`${plant3dCommand.command} — ${plant3dCommand.description}`);
      } else {
        setAutocadPrompt(`Commande inconnue : "${cmdId}". Essayez COPIE, MOVE, COUDE, BOM, PLANTPIPEADD, DATAMANAGER...`);
      }
    }
  };

  const pasteClipboard=()=>{
    const buffer=clipboardRef.current;
    if(!buffer||!buffer.nodes.length){setStatusMessage("Presse-papiers vide");return;}
    const step=Math.max(isoSnapStep,.25);
    const cloned=cloneSubGraphWithNewIds(buffer,{x:step,y:step,z:0});
    // Ports et lineId canonises par la fonction metier existante normalizedGraphPorts.
    const normalized=normalizedGraphPorts([...nodes,...cloned.nodes],[...segments,...cloned.segments]);
    const nextNodes=normalized.nodes;
    const nextSegments=normalized.segments;
    // PATCH 004b : cotations clonees ajoutees dans la MEME operation logique.
    const pastedDimensions=cloned.dimensions||[];
    commitGraph(nextNodes,recalcSegmentLengths(nextNodes,nextSegments),lines,[...dimensions,...pastedDimensions]);
    setSelectedNodeIds(cloned.nodes.map(n=>n.id));
    setSelectedSegmentIds([]);
    setSelectedFittingIds([]);
    setSelectedNodeId(cloned.nodes[0]?.id||null);
    setSelectedDimensionIds(pastedDimensions.map(d=>d.id));
    setSelectedDimensionId(pastedDimensions.length?pastedDimensions[pastedDimensions.length-1].id:null);
    setStatusMessage(`${cloned.nodes.length} élément(s) collé(s)${pastedDimensions.length?` · ${pastedDimensions.length} cotation(s)`:""} · nouveaux IDs`);
    setCtxMenu(null);
  };

  const duplicateSelection=()=>{
    const sub=selectionSubGraph();
    if(!sub.nodes.length){setStatusMessage("Rien à dupliquer");return;}
    const step=Math.max(isoSnapStep,.25);
    const cloned=cloneSubGraphWithNewIds({...sub,dimensions:selectionDimensions(sub.nodes)},{x:step,y:step,z:0});
    const normalized=normalizedGraphPorts([...nodes,...cloned.nodes],[...segments,...cloned.segments]);
    const nextNodes=normalized.nodes;
    const nextSegments=normalized.segments;
    // PATCH 004b : cotations dupliquees dans la MEME operation logique.
    const duplicatedDimensions=cloned.dimensions||[];
    commitGraph(nextNodes,recalcSegmentLengths(nextNodes,nextSegments),lines,[...dimensions,...duplicatedDimensions]);
    setSelectedNodeIds(cloned.nodes.map(n=>n.id));
    setSelectedSegmentIds([]);
    setSelectedFittingIds([]);
    setSelectedNodeId(cloned.nodes[0]?.id||null);
    setSelectedDimensionIds(duplicatedDimensions.map(d=>d.id));
    setSelectedDimensionId(duplicatedDimensions.length?duplicatedDimensions[duplicatedDimensions.length-1].id:null);
    setStatusMessage(`${cloned.nodes.length} élément(s) dupliqué(s)${duplicatedDimensions.length?` · ${duplicatedDimensions.length} cotation(s)`:""} · nouveaux IDs`);
    setCtxMenu(null);
  };

  // Deplacement clavier : une touche = une operation logique = un undo.
  // ----- PATCH 016B : commandes guidees avec apercu -----
  const guidedSelectionNodeIds = () => {
    const ids = new Set<string>(selectedNodeIds);
    if (selectedSegmentIds.length) {
      segments.filter(sg => selectedSegmentIds.includes(sg.id)).forEach(sg => { ids.add(sg.fromNodeId); ids.add(sg.toNodeId); });
    }
    return Array.from(ids);
  };

  const startGuidedCommand = (type: "move" | "copy" | "rotate") => {
    const ids = guidedSelectionNodeIds();
    const hasAny = ids.length > 0 || Boolean(selectedSupportId) || selectedCad2dIds.length > 0;
    if (!hasAny) {
      setAutocadPrompt("Selectionnez d'abord un ou plusieurs elements (nœuds, tronçons, supports MSS ou entités 2D), puis relancez la commande.");
      setStatusMessage("Aucune selection pour la commande guidee");
      return;
    }
    setGuidedCmd({ type, step: "base" });
    const label = type === "move" ? "DEPLACER" : type === "copy" ? "COPIE" : "ROTATION";
    setAutocadPrompt(`[${label}] Specifiez le point de base (clic sur le plan). Echap pour annuler.`);
    setStatusMessage(`${label} : point de base attendu`);
  };

  const cancelGuidedCommand = () => {
    if (!guidedCmd) return;
    setGuidedCmd(null);
    setAutocadPrompt("Commande guidee annulee. Aucune modification appliquee.");
  };

  const guidedDelta = (base: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) => ({
    dx: snapIsoV4(target.x - base.x, isoSnapStep),
    dy: snapIsoV4(target.y - base.y, isoSnapStep),
  });

  const guidedAngle = (base: { x: number; y: number }, target: { x: number; y: number }) =>
    Math.atan2(target.y - base.y, target.x - base.x);

  const applyGuidedCommand = (target: { x: number; y: number; z: number }) => {
    if (!guidedCmd || !guidedCmd.base) return;
    const ids = guidedSelectionNodeIds();
    const hasAny = ids.length > 0 || Boolean(selectedSupportId) || selectedCad2dIds.length > 0;
    if (!hasAny) { setGuidedCmd(null); return; }
    const base = guidedCmd.base;

    if (guidedCmd.type === "move") {
      const { dx, dy } = guidedDelta(base, target);
      executeUniversalMove(dx, dy, 0);
      setAutocadPrompt(`[DEPLACER] Applique : dX ${dx.toFixed(2)} m, dY ${dy.toFixed(2)} m.`);
    } else if (guidedCmd.type === "copy") {
      const { dx, dy } = guidedDelta(base, target);
      const stamp = Date.now().toString(36);
      const idMap = new Map<string, string>();
      const clonedNodes = nodes.filter(n => ids.includes(n.id)).map((n, i) => {
        const newId = `${n.id}-c${stamp}${i}`;
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          name: `${n.name}-C`,
          x: snapIsoV4(n.x + dx, isoSnapStep),
          y: snapIsoV4(n.y + dy, isoSnapStep),
        };
      });
      const clonedSegments = segments
        .filter(sg => idMap.has(sg.fromNodeId) && idMap.has(sg.toNodeId))
        .map((sg, i) => ({
          ...sg,
          id: `${sg.id}-c${stamp}${i}`,
          fromNodeId: idMap.get(sg.fromNodeId)!,
          toNodeId: idMap.get(sg.toNodeId)!,
          fittings: Array.isArray(sg.fittings) ? sg.fittings.map(f => ({ ...f })) : [],
        }));
      const nextNodes = [...nodes, ...clonedNodes];
      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, [...segments, ...clonedSegments]));
      setSelectedNodeIds(clonedNodes.map(n => n.id));
      setAutocadPrompt(`[COPIE] ${clonedNodes.length} noeud(s) et ${clonedSegments.length} troncon(s) copies.`);
    } else {
      const angle = guidedAngle(base, target);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const nextNodes = nodes.map(n => {
        if (!ids.includes(n.id)) return n;
        const rx = n.x - base.x, ry = n.y - base.y;
        return {
          ...n,
          x: snapIsoV4(base.x + rx * cos - ry * sin, isoSnapStep),
          y: snapIsoV4(base.y + rx * sin + ry * cos, isoSnapStep),
        };
      });
      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
      setAutocadPrompt(`[ROTATION] Applique : ${(angle * 180 / Math.PI).toFixed(1)} deg autour du point de base.`);
    }
    setGuidedCmd(null);
  };

  // Le clic sur le plan alimente la commande guidee avant tout autre comportement.
  const handleGuidedPointerDown = (world: { x: number; y: number; z: number }) => {
    if (!guidedCmd) return false;
    if (guidedCmd.step === "base") {
      setGuidedCmd({ ...guidedCmd, step: "target", base: world, preview: world });
      const label = guidedCmd.type === "move" ? "DEPLACER" : guidedCmd.type === "copy" ? "COPIE" : "ROTATION";
      setAutocadPrompt(guidedCmd.type === "rotate"
        ? `[${label}] Bougez la souris pour l'angle puis cliquez pour appliquer. Echap pour annuler.`
        : `[${label}] Specifiez le point de destination puis cliquez pour appliquer. Echap pour annuler.`);
      return true;
    }
    applyGuidedCommand(world);
    return true;
  };

  const guidedPreviewNodes = (() => {
    if (!guidedCmd || guidedCmd.step !== "target" || !guidedCmd.base || !guidedCmd.preview) return [];
    const ids = guidedSelectionNodeIds();
    const base = guidedCmd.base, target = guidedCmd.preview;
    if (guidedCmd.type === "rotate") {
      const angle = guidedAngle(base, target);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      return nodes.filter(n => ids.includes(n.id)).map(n => {
        const rx = n.x - base.x, ry = n.y - base.y;
        return { ...n, x: base.x + rx * cos - ry * sin, y: base.y + rx * sin + ry * cos };
      });
    }
    const { dx, dy } = guidedDelta(base, target);
    return nodes.filter(n => ids.includes(n.id)).map(n => ({ ...n, x: n.x + dx, y: n.y + dy }));
  })();

  // PATCH 017Q3-UNIFY-CORE : Fonction centrale unifiée de déplacement géométrique transactionnel.
  // Déplace de manière cohérente les entités CAD 2D, les supports MSS SP-58,
  // et les sous-ensembles de tuyauterie (nœuds sélectionnés + extrémités des tronçons sélectionnés).
  const executeUniversalMove = (dx: number, dy: number, dz: number = 0) => {
    let movedAnything = false;

    // 1. Déplacement des entités CAD 2D si sélectionnées
    if (selectedCad2dIds.length > 0) {
      moveSelectedCad2d(dx, dy);
      movedAnything = true;
    }

    // 2. Déplacement des supports MSS SP-58 si sélectionnés
    if (selectedSupportId) {
      setSupports(prev => prev.map(s => {
        if (s.id !== selectedSupportId) return s;
        const currentPos = s.worldPos || { x: 0, y: 0, z: 0 };
        const newWorldX = snapIsoV4(currentPos.x + dx, isoSnapStep);
        const newWorldY = snapIsoV4(currentPos.y + dy, isoSnapStep);
        const newWorldZ = Number(((currentPos.z || 0) + dz).toFixed(3));

        let t = s.tRatio ?? 0.5;
        let distM = s.distanceFromFromNodeM ?? 0;
        const seg = segments.find(sg => sg.id === s.segmentId);
        if (seg) {
          const fn = nodes.find(n => n.id === seg.fromNodeId);
          const tn = nodes.find(n => n.id === seg.toNodeId);
          if (fn && tn) {
            const segDx = tn.x - fn.x;
            const segDy = tn.y - fn.y;
            const segDz = (tn.z || 0) - (fn.z || 0);
            const segDistSq = segDx * segDx + segDy * segDy + segDz * segDz;
            if (segDistSq > 0.0001) {
              const cdx = newWorldX - fn.x;
              const cdy = newWorldY - fn.y;
              const cdz = newWorldZ - (fn.z || 0);
              t = Math.max(0.01, Math.min(0.99, (cdx * segDx + cdy * segDy + cdz * segDz) / segDistSq));
              distM = Number((t * seg.length).toFixed(3));
            }
          }
        }
        return {
          ...s,
          tRatio: t,
          distanceFromFromNodeM: distM,
          worldPos: {
            x: newWorldX,
            y: newWorldY,
            z: newWorldZ,
          },
          elevationZ: newWorldZ,
        };
      }));
      movedAnything = true;
    }

    // 3. Déplacement des nœuds et tronçons sélectionnés (avec recalcul géométrique et commitGraph)
    const nodeIdsToMove = new Set<string>(selectedNodeIds);
    selectedSegmentIds.forEach(sid => {
      const seg = segments.find(s => s.id === sid);
      if (seg) {
        nodeIdsToMove.add(seg.fromNodeId);
        nodeIdsToMove.add(seg.toNodeId);
      }
    });

    if (nodeIdsToMove.size > 0) {
      const nextNodes = nodes.map(n => {
        if (!nodeIdsToMove.has(n.id)) return n;
        return {
          ...n,
          x: snapIsoV4(n.x + dx, isoSnapStep),
          y: snapIsoV4(n.y + dy, isoSnapStep),
          z: Number(((n.z || 0) + dz).toFixed(3)),
        };
      });
      const nextSegments = recalcSegmentLengths(nextNodes, segments);
      commitGraph(nextNodes, nextSegments);
      setStatusMessage(`Déplacement ${dz ? "Z" : "XY"} de ${nodeIdsToMove.size} élément(s)`);
      movedAnything = true;
    }

    return movedAnything;
  };

  const moveSelection = (dx: number, dy: number, dz: number = 0) => executeUniversalMove(dx, dy, dz);
  const universalMove = (dx: number, dy: number, dz: number = 0) => executeUniversalMove(dx, dy, dz);

  // Ecriture protegee d'une coordonnee : jamais NaN, jamais de perte de topologie.
  const setNodeCoordinate=(id:string,axis:"x"|"y"|"z",raw:string)=>{
    const value=Number(String(raw).replace(",","."));
    if(!Number.isFinite(value)){setStatusMessage("Valeur refusée : coordonnée non numérique");return;}
    const nextNodes=nodes.map(n=>n.id===id?{...n,[axis]:Number(value.toFixed(3))}:n);
    commitGraph(nextNodes,recalcSegmentLengths(nextNodes,segments));
  };

  // Champs descriptifs : aucun impact sur le graphe (ports/tubes intacts).
  const setNodeMeta=(id:string,patch:Partial<IsoNode>)=>{
    const safe={...patch};
    delete (safe as any).id;
    delete (safe as any).ports;
    delete (safe as any).x;
    delete (safe as any).y;
    delete (safe as any).z;
    commitGraph(nodes.map(n=>n.id===id?{...n,...safe}:n),segments);
  };

  // Menu contextuel : la cible sous le curseur devient la selection courante.
  const openIsoContextMenu=(e:React.MouseEvent<SVGSVGElement>)=>{
    e.preventDefault();
    if (rightClickStartRef.current) {
      const dist = Math.hypot(e.clientX - rightClickStartRef.current.x, e.clientY - rightClickStartRef.current.y);
      rightClickStartRef.current = null;
      if (dist > 5) return;
    }
    const target=e.target as Element;
    const fitEl=target.closest("[data-iso-fitting='true']");
    const nodeEl=target.closest("[data-iso-node='true']");
    const segEl=target.closest("[data-iso-segment='true']");
    const additive=e.shiftKey;
    if(fitEl){
      const sid=fitEl.getAttribute("data-segment-id")||"";
      const fid=fitEl.getAttribute("data-fitting-id")||"";
      if(!selectedFittingIds.includes(fid))selectFittingV44(sid,fid,additive);
    }else if(nodeEl){
      const id=nodeEl.getAttribute("data-node-id")||"";
      if(!selectedNodeIds.includes(id))selectNodeV44(id,additive);
    }else if(segEl){
      const id=segEl.getAttribute("data-segment-id")||"";
      if(!selectedSegmentIds.includes(id))selectSegmentV44(id,additive);
    }else{
      clearSelection();
    }
    setCtxMenu({x:e.clientX,y:e.clientY});
  };

  const setSegmentLength=(id:string,value:number)=>{
    // PATCH 017P10 : refus explicite au lieu du plancher silencieux.
    // Avant : Math.max(.05,Number(value)||.05) transformait une saisie 0 en
    // 0,05 sans rien dire, puis l accrochage donnait parfois 0,15.
    const controle017P10=pdiValiderLongueur017P10(value);
    if(!controle017P10.ok){
      pdiRejectSegmentEdit017F2B(controle017P10.message||"Longueur refusee");
      return;
    }
    const desired=controle017P10.valeur;
    const s=segments.find(x=>x.id===id);
    if(!s)return;
    const a=nodes.find(n=>n.id===s.fromNodeId),b=nodes.find(n=>n.id===s.toNodeId);
    if(!a||!b)return;
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    const current=Math.hypot(dx,dy,dz);
    const ux=current>.0001?dx/current:1,uy=current>.0001?dy/current:0,uz=current>.0001?dz/current:0;
    const nextNodes=nodes.map(n=>n.id===b.id?{...n,x:a.x+ux*desired,y:a.y+uy*desired,z:a.z+uz*desired}:n);
    // PATCH 017P10 : on regarde ce que l accrochage a REELLEMENT applique,
    // et on le dit au lieu de laisser l utilisateur deviner.
    const nextSegments017P10=recalcSegmentLengths(nextNodes,segments);
    const obtenu017P10=nextSegments017P10.find(x=>x.id===id);
    pdiAcceptSegmentEdit017P10(obtenu017P10?pdiEcartAccrochage017P10(desired,Number(obtenu017P10.length)):"");
    commitGraph(nextNodes,nextSegments017P10);
  };

  const beginNodeDrag=(e:React.PointerEvent<any>,id:string,additive:boolean)=>{
    if (alignWizard) {
      selectNodeV44(id, false);
      return;
    }
    if (parallelWizard) {
      selectNodeV44(id, false);
      return;
    }
    const alreadySelected = selectedNodeIds.includes(id);
    const ids = additive
      ? (alreadySelected ? selectedNodeIds : [...selectedNodeIds, id])
      : (alreadySelected ? selectedNodeIds : [id]);
    if(additive) selectNodeV44(id,true); else if(!alreadySelected) selectNodeV44(id,false);

    const nodeIdsToMove = new Set<string>(ids);
    // Déplacer également les nœuds des tronçons sélectionnés
    selectedSegmentIds.forEach(sid => {
      const s = segments.find(x => x.id === sid);
      if (s) {
        nodeIdsToMove.add(s.fromNodeId);
        nodeIdsToMove.add(s.toNodeId);
      }
    });

    const start=screenToIsoWorld(e, nodeZ || 0);
    const positions=new Map<string,{x:number;y:number;z:number}>();
    nodes.forEach(n=>{if(nodeIdsToMove.has(n.id))positions.set(n.id,{x:n.x,y:n.y,z:n.z});});
    dragSelectionRef.current={
      startScreen: { x: e.clientX, y: e.clientY },
      start,
      nodes: positions,
      isDragging: false,
      clickedEntity: { type: "node", id, wasAlreadySelected: alreadySelected, additive },
    };
    dragChangedRef.current=false;
    setDragNodeId(id);
    try {
      (svgRef.current || e.currentTarget).setPointerCapture(e.pointerId);
    } catch {}
  };

  const beginSegmentDrag=(e:React.PointerEvent<any>,id:string,additive:boolean)=>{
    if (alignWizard) {
      selectSegmentV44(id, false);
      return;
    }
    if (parallelWizard) {
      selectSegmentV44(id, false);
      return;
    }
    const alreadySelected = selectedSegmentIds.includes(id);
    const segIds = additive
      ? (alreadySelected ? selectedSegmentIds : [...selectedSegmentIds, id])
      : (alreadySelected ? selectedSegmentIds : [id]);
    if(additive) selectSegmentV44(id,true); else if(!alreadySelected) selectSegmentV44(id,false);

    const nodeIdsToMove = new Set<string>();
    segIds.forEach(sid => {
      const s = segments.find(x => x.id === sid);
      if (s) {
        nodeIdsToMove.add(s.fromNodeId);
        nodeIdsToMove.add(s.toNodeId);
      }
    });
    selectedNodeIds.forEach(nid => nodeIdsToMove.add(nid));

    const start=screenToIsoWorld(e, nodeZ || 0);
    const positions=new Map<string,{x:number;y:number;z:number}>();
    nodes.forEach(n=>{if(nodeIdsToMove.has(n.id))positions.set(n.id,{x:n.x,y:n.y,z:n.z});});
    dragSelectionRef.current={
      startScreen: { x: e.clientX, y: e.clientY },
      start,
      nodes: positions,
      isDragging: false,
      clickedEntity: { type: "segment", id, wasAlreadySelected: alreadySelected, additive },
    };
    dragChangedRef.current=false;
    setDragNodeId(id);
    try {
      (svgRef.current || e.currentTarget).setPointerCapture(e.pointerId);
    } catch {}
  };

  const beginSupportDrag = (e: React.PointerEvent<any>, id: string, additive: boolean = false) => {
    setSelectedSupportId(id);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedSegmentId(null);
    setSelectedSegmentIds([]);
    setSelectedFitting(null);
    setSelectedFittingIds([]);
    setSelectedDimensionId(null);
    setSelectedDimensionIds([]);
    setSelectedCad2dIds([]);
    setRightPanelOpen(true);
    setRightPanelTab("supports");

    const sup = supports.find(s => s.id === id);
    if (!sup) return;

    const start = screenToIsoWorld(e, sup.worldPos.z || nodeZ || 0);
    dragSelectionRef.current = {
      startScreen: { x: e.clientX, y: e.clientY },
      start,
      nodes: new Map(),
      isDragging: false,
      clickedEntity: { type: "support", id, wasAlreadySelected: true, additive },
    };
    dragChangedRef.current = false;
    setDragNodeId(id);
    try {
      if (svgRef.current) {
        svgRef.current.setPointerCapture(e.pointerId);
      } else if (e.currentTarget?.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch {}
  };


  // PATCH 017Q4-A: Dispatcher Clavier Unifié Central (Central Unified Keyboard Dispatcher)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (solid3dViewerOpen || weldSpoolModalOpen || printModalOpen) return;
      if (!e.key) return;

      const key = (e.key || "").toLowerCase();
      const target = e.target as HTMLElement | null;
      const isInput = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || (target as any).isContentEditable));

      // 1. Touche Échap globale (Universal Escape)
      if (e.key === "Escape") {
        if (isInput && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setAutocadCmdInput("");
        setGuidedCmd(null);
        setCad2dModifySession(null);
        setActiveSupportTypeToPlace(null);
        setAlignWizard(null);
        setParallelWizard(null);
        setBranchDrawing(null);
        setDrawStartNodeId(null);
        setDragNodeId(null);
        setDragFittingInfo(null);
        setTubeHoverWorld(null);
        dragSelectionRef.current = null;
        clearSelection();
        setIsoDrawMode("select");
        setInteractionMode("select");
        setContextMenu(null);
        setCtxMenu(null);
        setMarquee(null);
        setPropertiesModalOpen(false);
        setCommandPaletteOpen(false);
        setShortcutsOpen(false);
        setCadPropsOpen(false);
        setRailFlyout(null);
        setRightPanelOpen(false);
        setLeftPanelOpen(false);
        setInlineEditTextId(null);
        setEdit(null);
        if (cadDraftSession) cancelCadDraft();
        setCad2dDraftTool(null);
        setSelectedCad2dIds([]);
        setStatusMessage("Panneaux fermés · Outils et sélections réinitialisés");
        setAutocadPrompt("Prêt.");
        return;
      }

      // 2. Traitement si le focus est sur un champ de texte / saisie
      if (isInput) {
        if ((e.ctrlKey || e.metaKey) && e.key === "F1") {
          e.preventDefault();
          setRubanReplie017M((v) => !v);
        }
        return;
      }

      // 3. Saisie directe de commandes style AutoCAD quand les raccourcis à 1 touche sont OFF
      if (!keyboardShortcutsEnabled) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (autocadCmdInput.trim()) executeCadCommand(autocadCmdInput.trim());
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          setAutocadCmdInput((prev) => prev.slice(0, -1));
          return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setAutocadCmdInput((prev) => prev + e.key);
          setCommandPromptHidden(false);
          setTimeout(() => (document.getElementById("cad-command-input") as HTMLInputElement | null)?.focus(), 0);
          return;
        }
      }

      // 4. Raccourcis système avec modificateurs (Ctrl / Cmd)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "F1") { e.preventDefault(); setRubanReplie017M((v) => !v); return; }
        if (e.key === "1") {
          e.preventDefault();
          setRightPanelOpen(true);
          setRightPanelTab("properties");
          setStatusMessage("Inspecteur de propriétés ouvert");
          return;
        }
        if (key === "s") { e.preventDefault(); exportProjectJson(); return; }
        if (key === "o") { e.preventDefault(); importProjectRef.current?.click(); return; }
        if (key === "k") { e.preventDefault(); setCommandPaletteOpen((v) => !v); return; }
        if (key === "a") {
          e.preventDefault();
          setSelectedNodeIds(nodes.map((n) => n.id));
          setSelectedSegmentIds(segments.map((s) => s.id));
          setSelectedCad2dIds(cad2dEntities.map((c) => c.id));
          setStatusMessage(`Tout sélectionné (${nodes.length} nœuds, ${segments.length} tronçons, ${cad2dEntities.length} dessins 2D)`);
          return;
        }
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redoGraph(); else undoGraph();
          return;
        }
        if (key === "y") { e.preventDefault(); redoGraph(); return; }
        if (key === "c") { e.preventDefault(); universalCopy(); return; }
        if (key === "x") { e.preventDefault(); cutSelection(); return; }
        if (key === "v") { e.preventDefault(); startCadDraft("paste_target"); return; }
        if (key === "d") { e.preventDefault(); universalDuplicate(); return; }
        if (key === "g") {
          e.preventDefault();
          if (e.shiftKey) dissociateSelectionFromSpool(); else associateSelectionToSpool();
          return;
        }
        if (key === "u") { e.preventDefault(); dissociateSelectionFromSpool(); return; }
      }

      // 5. Suppressions (Delete / Backspace / Suppr)
      if (e.key === "Delete" || e.key === "Backspace" || e.key === "Suppr") {
        e.preventDefault();
        universalDelete();
        return;
      }

      // 6. Validation de tracé polyline
      if ((e.key === "Enter" || e.key === " ") && cadDraftSession?.tool === "polyline") {
        e.preventDefault();
        finishPolylineDraft();
        return;
      }

      // Space pour navigation panoramique instantanée
      if (e.code === "Space") {
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || (activeEl as HTMLElement).isContentEditable);
        if (!isInput && (!cadDraftSession || cadDraftSession.tool !== "polyline")) {
          e.preventDefault();
          if (!isSpacePressedRef.current) {
            isSpacePressedRef.current = true;
            setIsSpaceDown(true);
          }
          return;
        }
      }

      // 7. Focus rapide sur la ligne de commande (':' ou '/')
      if (e.key === ":" || e.key === "/") {
        e.preventDefault();
        const cmdInput = document.getElementById("cad-command-input") as HTMLInputElement | null;
        if (cmdInput) { cmdInput.focus(); cmdInput.select(); }
        return;
      }

      // 8. Déplacement au clavier unifié (Flèches directionnelles)
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const hasSelection = selectedNodeIds.length > 0 || selectedSegmentIds.length > 0 || selectedCad2dIds.length > 0 || Boolean(selectedSupportId);
        if (hasSelection) {
          const step = (e.shiftKey ? isoSnapStep * 4 : isoSnapStep) || 0.25;
          if (e.altKey) {
            if (e.key === "ArrowUp") executeUniversalMove(0, 0, step);
            if (e.key === "ArrowDown") executeUniversalMove(0, 0, -step);
          } else {
            if (e.key === "ArrowLeft") executeUniversalMove(-step, 0, 0);
            if (e.key === "ArrowRight") executeUniversalMove(step, 0, 0);
            if (e.key === "ArrowUp") executeUniversalMove(0, -step, 0);
            if (e.key === "ArrowDown") executeUniversalMove(0, step, 0);
          }
        } else {
          const panStep = e.shiftKey ? 80 : 35;
          let dx = 0, dy = 0;
          if (e.key === "ArrowLeft") dx = panStep;
          if (e.key === "ArrowRight") dx = -panStep;
          if (e.key === "ArrowUp") dy = panStep;
          if (e.key === "ArrowDown") dy = -panStep;
          setViewport((vp) => ({ ...vp, panX: vp.panX + dx, panY: vp.panY + dy }));
        }
        return;
      }

      // 9. Raccourcis outils 1 touche (quand keyboardShortcutsEnabled === true)
      if (keyboardShortcutsEnabled) {
        if (key === "v") { setInteractionMode("select"); setIsoDrawMode("select"); setStatusMessage("Outil Sélection"); return; }
        if (key === "h") { e.preventDefault(); setInteractionMode("main"); setStatusMessage("Outil Main (Déplacement)"); return; }
        if (key === "o") { setInteractionMode("orbit"); setStatusMessage("Outil Orbite 3D Libres (Glissez le clic gauche)"); return; }
        if (key === "n") { setIsoDrawMode("node"); setInteractionMode("select"); setStatusMessage("Création de nœud"); return; }
        if (key === "t") { e.preventDefault(); createTubeFromSelection(); return; }
        if (key === "e") { setIsoDrawMode("te"); setInteractionMode("select"); setStatusMessage("Création de Té"); return; }
        if (key === "c") { setIsoDrawMode("coude"); setInteractionMode("select"); setStatusMessage("Insertion de coude"); return; }
        if (key === "3" || (e.altKey && key === "3")) { setSolid3dViewerOpen(true); setStatusMessage("Vue 3D Solide Extrudée"); return; }
        if (key === "r") { e.preventDefault(); universalRotate(e.shiftKey ? -15 : 15); return; }
        if (key === "f") {
          if (selectedNodeIds.some((id) => nodes.find((n) => n.id === id)?.equipmentType)) {
            e.preventDefault();
            flipSelectedEquipment();
          } else {
            resetView();
            setStatusMessage("Vue recentrée");
          }
          return;
        }
        if (key === "g") { setShowGrid((v) => !v); return; }
        if (key === "d") { setShowDimensions((v) => !v); return; }
        if (key === "l") { setShowLabels((v) => !v); return; }
        if (key === "0") { resetView(); setStatusMessage("Vue recentrée"); return; }
        if (key === "+" || key === "=") { zoomIn(); return; }
        if (key === "-") { zoomOut(); return; }
        if (key === "?") { setShortcutsOpen(true); return; }
        if (key === "p") { printPlanSheet(); return; }
      }
    };

    const onGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        setIsSpaceDown(false);
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown, true);
    window.addEventListener("keyup", onGlobalKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown, true);
      window.removeEventListener("keyup", onGlobalKeyUp, true);
    };
  }, [
    solid3dViewerOpen, weldSpoolModalOpen, printModalOpen, keyboardShortcutsEnabled, autocadCmdInput,
    guidedCmd, cad2dModifySession, activeSupportTypeToPlace, cadDraftSession,
    nodes, segments, cad2dEntities, selectedNodeIds, selectedSegmentIds, selectedCad2dIds, selectedSupportId,
    isoSnapStep
  ]);

  // PATCH 017I : la molette est ecoutee en natif avec { passive: false }.
  // React enregistre "wheel" en passif : preventDefault y est ignore et
  // declenche l avertissement console. L ecoute native corrige les deux.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheelNative017I = (ev: WheelEvent) => {
      ev.preventDefault();
      wheel(ev as unknown as React.WheelEvent<SVGSVGElement>);
    };
    el.addEventListener("wheel", onWheelNative017I, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative017I);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));

    // 1) Trackpad Pinch-to-zoom (Browser sets ctrlKey or metaKey during pinch gestures)
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = Math.pow(1.008, -e.deltaY);
      setViewport((v) => {
        const nextZoom = clamp(v.zoom * zoomFactor, 0.02, 100);
        const factor = nextZoom / v.zoom;
        const panX = (sx - 310) - (sx - 310 - v.panX) * factor;
        const panY = (sy - 210) - (sy - 210 - v.panY) * factor;
        return { zoom: Number(nextZoom.toFixed(3)), panX: Math.round(panX), panY: Math.round(panY) };
      });
      return;
    }

    // 2) Shift + Wheel = Horizontal pan
    if (e.shiftKey) {
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      setViewport((v) => ({ ...v, panX: Math.round(v.panX - delta) }));
      return;
    }

    // 3) Physical Mouse Wheel Zoom:
    // When rolling the physical mouse wheel, deltaMode is 1 (lines) or deltaY is discrete steps with negligible deltaX.
    // In CAD standard UX (AutoCAD, Plant 3D), wheel scrolling zooms centered at cursor!
    const isMouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 30 && Math.abs(e.deltaX) === 0);
    if (isMouseWheel) {
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setViewport((v) => {
        const nextZoom = clamp(v.zoom * zoomFactor, 0.02, 100);
        const factor = nextZoom / v.zoom;
        const panX = (sx - 310) - (sx - 310 - v.panX) * factor;
        const panY = (sy - 210) - (sy - 210 - v.panY) * factor;
        return { zoom: Number(nextZoom.toFixed(3)), panX: Math.round(panX), panY: Math.round(panY) };
      });
      return;
    }

    // 4) Trackpad Two-Finger Pan:
    if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
      setViewport((v) => ({
        ...v,
        panX: Math.round(v.panX - e.deltaX),
        panY: Math.round(v.panY - e.deltaY),
      }));
    }
  };
  const pointerDown=(e:React.PointerEvent<SVGSVGElement>)=>{
    activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Multi-touch gestures (Pinch-to-zoom & two-finger pan on touchscreens / tablets / phones)
    if (activePointersRef.current.size >= 2) {
      const pts = Array.from(activePointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.max(1, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
      const midClientX = (p1.clientX + p2.clientX) / 2;
      const midClientY = (p1.clientY + p2.clientY) / 2;
      const { sx, sy } = getSvgCoordinates(midClientX, midClientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
      touchPinchStateRef.current = {
        initialDist: dist,
        initialZoom: viewport.zoom,
        centerSx: sx,
        centerSy: sy,
        initialPanX: viewport.panX,
        initialPanY: viewport.panY,
        initialMidClientX: midClientX,
        initialMidClientY: midClientY,
      };
      drag.current = null;
      marqueeRef.current = null;
      setMarquee(null);
      setDragNodeId(null);
      return;
    }

    const target=e.target as Element;
    if (target.closest("[data-pdi-viewcube='true']")) {
      // Let ViewCube handle its own click events directly
      return;
    }

    const isOrbitModeActive = interactionMode === "orbit";
    const isModifierOrbit = (e.shiftKey || e.altKey) && interactionMode !== "main" && !isSpacePressedRef.current;
    const isNodeOrSegment = target.closest(".pdi-node") || target.closest(".pdi-segment") || target.closest(".pdi-fitting") || target.closest("[data-iso-port='true']");

    // Pan gestures: Hand tool, Space held down, Middle click (1), Right click (2), or Shift/Ctrl drag in orbit mode
    const isPanMode = interactionMode === "main" || isSpacePressedRef.current;
    const isModifierPan = (e.button === 1) || (e.button === 2) || (isOrbitModeActive && (e.shiftKey || e.ctrlKey));

    if (isPanMode || isModifierPan) {
      if (e.button === 2) {
        rightClickStartRef.current = { x: e.clientX, y: e.clientY };
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, px: viewport.panX, py: viewport.panY };
      return;
    }

    const isOrbitStart = 
      (isOrbitModeActive && e.button === 0) ||
      (e.button === 0 && isModifierOrbit && !isNodeOrSegment);

    if (isOrbitStart) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const initAngles = getInitialYawPitchForMode(viewport.viewMode, viewport.yaw, viewport.pitch);
      orbitDrag.current = {
        x: e.clientX,
        y: e.clientY,
        startYaw: initAngles.yaw,
        startPitch: initAngles.pitch
      };
      setViewport(v => ({ ...v, viewMode: "free", yaw: initAngles.yaw, pitch: initAngles.pitch }));
      return;
    }

    const additive=e.ctrlKey||e.metaKey||e.shiftKey;
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));

    // PATCH 016B guided pointer down : la commande guidee capture le clic.
    if (guidedCmd) {
      const guidedWorld = isoUnprojectV4(sx, sy, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
      if (handleGuidedPointerDown({ x: guidedWorld.x, y: guidedWorld.y, z: guidedWorld.z ?? (nodeZ || 0) })) {
        e.preventDefault();
        return;
      }
    }

    // PALIER 2B : la commande géométrique interactive (TRIM, EXTEND, OFFSET, FILLET, SCALE, CHAMFER) capture le clic.
    if (cad2dModifySession) {
      const modifyWorld = isoUnprojectV4(sx, sy, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
      if (handleCad2dModifyPointerDown({ x: modifyWorld.x, y: modifyWorld.y }, target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (isoDrawMode === "dimension") {
      const anchor = anchorFromTarget(target);
      if (anchor) {
        handleDimensionAnchorPick(anchor);
        e.stopPropagation();
        return;
      }
      setStatusMessage("Cotation : cliquez un nœud ou un port");
      return;
    }

    // Cotation sélectionnable
    const dimEl=target.closest("[data-iso-dimension='true']");
    if(dimEl){
      const dimId=dimEl.getAttribute("data-dimension-id");
      if(dimId){
        selectDimensionV44(dimId,additive);
        setRightPanelTab("dimensions");
        e.stopPropagation();
        return;
      }
    }

    // Port du Té avant le nœud parent.
    const portEl=target.closest("[data-iso-port='true']");
    if(portEl){
      const nodeId=portEl.getAttribute("data-port-node-id");
      const portIdx=Number(portEl.getAttribute("data-port-idx")||"1");
      if(nodeId){
        selectNodeV44(nodeId,additive);
        const node=nodes.find(n=>n.id===nodeId);
        const portCible=portByIndex(node,portIdx);const portOccupe=!!portCible&&segments.some(s=>s.fromPortId===portCible.id||s.toPortId===portCible.id);if(portOccupe){setStatusMessage("PORT OCCUPE : ce port porte deja une soudure. Aucune branche creee. Choisissez un port libre.");e.stopPropagation();return;}setBranchDrawing({fromNodeId:nodeId,fromPortId:portCible?.id,handleIndex:portIdx,currentWorldPos:screenToIsoWorld(e)});
        e.currentTarget.setPointerCapture(e.pointerId);
        e.stopPropagation();
        return;
      }
    }

    const fittingEl=target.closest("[data-iso-fitting='true']");
    if(fittingEl){
      const segmentId=fittingEl.getAttribute("data-segment-id")||"";
      const fittingId=fittingEl.getAttribute("data-fitting-id")||"";
      if(segmentId&&fittingId){
        selectFittingV44(segmentId,fittingId,additive);
        e.currentTarget.setPointerCapture(e.pointerId);
        e.stopPropagation();
        return;
      }
    }

    // PALIER 2C : Support MSS SP-58 sélectionnable
    const supEl = target.closest("[data-iso-support='true']");
    if (supEl) {
      const supId = supEl.getAttribute("data-support-id");
      if (supId) {
        setSelectedSupportId(supId);
        setRightPanelOpen(true);
        setRightPanelTab("supports");
        const supObj = supports.find((s) => s.id === supId);
        if (supObj) {
          setStatusMessage(`Support sélectionné : ${supObj.tag} (${MSS_SUPPORT_CATALOG[supObj.type]?.labelFr || supObj.type})`);
        }
        e.stopPropagation();
        return;
      }
    }

    // PALIER 2C : Placement interactif de support MSS SP-58 sur tronçon
    if (activeSupportTypeToPlace) {
      const segEl = target.closest("[data-iso-segment='true']");
      const clickedSegId = segEl?.getAttribute("data-segment-id");
      let targetSegment = segments.find((s) => s.id === clickedSegId);
      if (!targetSegment) {
        const hit = findSegmentAtScreen(sx, sy);
        if (hit) {
          targetSegment = segments.find((s) => s.id === hit.id);
        }
      }

      if (targetSegment) {
        const fromNode = nodes.find((n) => n.id === targetSegment.fromNodeId);
        const toNode = nodes.find((n) => n.id === targetSegment.toNodeId);
        if (fromNode && toNode) {
          const worldPos = isoUnprojectV4(sx, sy, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
          const newSup = projectSupportOnSegment(
            targetSegment,
            fromNode,
            toNode,
            { x: worldPos.x, y: worldPos.y },
            activeSupportTypeToPlace,
            supports.length
          );
          setSupports((prev) => [...prev, newSup]);
          setSelectedSupportId(newSup.id);
          setRightPanelOpen(true);
          setRightPanelTab("supports");
          setStatusMessage(`Support ${newSup.tag} placé avec succès`);
          setAutocadPrompt(`Support ${newSup.tag} inséré sur tronçon DN${targetSegment.dn} à ${newSup.distanceFromFromNodeM.toFixed(2)}m.`);
          setActiveSupportTypeToPlace(null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } else {
        setStatusMessage("Cliquez directement sur un tronçon de tuyauterie pour y ancrer le support.");
        return;
      }
    }

    const segmentEl=target.closest("[data-iso-segment='true']");
    if(segmentEl){
      const id=segmentEl.getAttribute("data-segment-id")||"";
      if(id){
        if(isoDrawMode==="coude"){
          createElbowFromPointer(e);e.stopPropagation();return;
        }
        if(isoDrawMode==="te"){
          createTeeFromPointer(e);e.stopPropagation();return;
        }
        if(isoDrawMode==="node"){
          createNodeFromPointer(e);e.stopPropagation();return;
        }
        if(isoDrawMode==="segment"){
          createSegmentFromPointer(e);e.stopPropagation();return;
        }
        beginSegmentDrag(e,id,additive);
        e.stopPropagation();
        return;
      }
    }

    const nodeEl=target.closest("[data-iso-node='true']");
    if(nodeEl){
      const id=nodeEl.getAttribute("data-node-id");
      if(id){
        if(isoDrawMode==="segment"){
          createSegmentFromPointer(e);e.stopPropagation();return;
        }
        if(isoDrawMode==="te"){
          setBranchDrawing({fromNodeId:id,currentWorldPos:screenToIsoWorld(e)});
          e.currentTarget.setPointerCapture(e.pointerId);
          e.stopPropagation();return;
        }
        beginNodeDrag(e,id,additive);
        e.stopPropagation();
        return;
      }
    }

    if (cadDraftSession) {
      const w = screenToIsoWorld(e);
      const pt: Cad2dPoint = { x: snapIsoV4(w.x, isoSnapStep), y: snapIsoV4(w.y, isoSnapStep) };
      const sess = cadDraftSession;

      if (sess.tool === "paste_target") {
        pasteClipboardAtWorldPoint(pt);
        setCadDraftSession(null);
        e.stopPropagation();
        return;
      }

      if (sess.tool === "move_target") {
        if (sess.step === 0) {
          setCadDraftSession({ ...sess, step: 1, points: [pt] });
          setAutocadPrompt("DEPLACER [Étape 2/2] : Cliquez le point de destination");
          setStatusMessage("DEPLACER : Cliquez la destination");
        } else {
          const fromPt = sess.points[0];
          const dx = pt.x - fromPt.x;
          const dy = pt.y - fromPt.y;
          executeUniversalMove(dx, dy, 0);
          setCadDraftSession(null);
          setAutocadPrompt(`Déplacement terminé (dx: ${dx.toFixed(2)}, dy: ${dy.toFixed(2)})`);
          setStatusMessage("Déplacement validé");
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "rectangle") {
        if (sess.step === 0) {
          setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
          setAutocadPrompt("RECTANGLE [Étape 1/2] : Déplacez la souris pour orienter le côté 1 et cliquez (ou saisissez la longueur)");
          setStatusMessage("RECTANGLE : Cliquez le point 2 du 1er côté");
        } else if (sess.step === 1) {
          const p1 = sess.points[0];
          const length = cadDist(p1, pt);
          if (length <= 0.001) return;
          setCadDraftSession({ ...sess, step: 2, points: [p1, pt], mouseWorld: pt });
          setAutocadPrompt("RECTANGLE [Étape 2/2] : Déplacez la souris pour la largeur et cliquez pour valider");
          setStatusMessage("RECTANGLE : Cliquez pour valider la largeur");
        } else if (sess.step === 2) {
          const p1 = sess.points[0];
          const p2 = sess.points[1];
          const rect = buildAutocadRectangle(p1, p2, sess.length || cadDist(p1, p2), pt);
          addCad2dEntity({
            type: "polygon",
            layerId: "axes_tuyauterie",
            color: "#9CA3AF",
            points: rect.points,
            length: rect.length,
            width: rect.width,
            closed: true,
            metadata: { intent: "draft", source: "rectangle", length: rect.length, width: rect.width },
          });
          setCadDraftSession(null);
          setAutocadPrompt(`Rectangle créé (${rect.length.toFixed(2)} m × ${rect.width.toFixed(2)} m). Prêt.`);
          setStatusMessage(`Rectangle créé · L: ${rect.length.toFixed(2)}m · l: ${rect.width.toFixed(2)}m`);
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "triangle") {
        const sub = sess.subType || "equilateral";
        if (sub === "equilateral") {
          if (sess.step === 0) {
            setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE ÉQUILATÉRAL : Cliquez le 2e point (définit la base et la taille)");
          } else {
            const p1 = sess.points[0];
            const triPts = buildEquilateralTriangle(p1, pt);
            const sideLen = cadDist(p1, pt);
            addCad2dEntity({
              type: "polygon",
              layerId: "axes_tuyauterie",
              color: "#9CA3AF",
              points: triPts,
              subType: "equilateral",
              length: sideLen,
              closed: true,
              metadata: { intent: "draft", source: "triangle_equilateral", sideLength: sideLen },
            });
            setCadDraftSession(null);
            setAutocadPrompt(`Triangle équilatéral créé (côté: ${sideLen.toFixed(2)} m).`);
            setStatusMessage(`Triangle équilatéral créé · Côté: ${sideLen.toFixed(2)}m`);
          }
        } else if (sub === "rectangle") {
          if (sess.step === 0) {
            setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE RECTANGLE [Étape 1/2] : Cliquez le 2e point (Base)");
          } else if (sess.step === 1) {
            setCadDraftSession({ ...sess, step: 2, points: [sess.points[0], pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE RECTANGLE [Étape 2/2] : Cliquez le 3e point pour la hauteur");
          } else {
            const p1 = sess.points[0];
            const p2 = sess.points[1];
            const triPts = buildRightTriangle(p1, p2, 0, pt);
            const baseLen = cadDist(p1, p2);
            const h = cadDist(p2, pt);
            addCad2dEntity({
              type: "polygon",
              layerId: "axes_tuyauterie",
              color: "#9CA3AF",
              points: triPts,
              subType: "rectangle",
              length: baseLen,
              height: h,
              closed: true,
              metadata: { intent: "draft", source: "triangle_rectangle", baseLength: baseLen, height: h },
            });
            setCadDraftSession(null);
            setAutocadPrompt(`Triangle rectangle créé (base: ${baseLen.toFixed(2)} m, hauteur: ${h.toFixed(2)} m).`);
            setStatusMessage(`Triangle rectangle créé · Base: ${baseLen.toFixed(2)}m · H: ${h.toFixed(2)}m`);
          }
        } else if (sub === "isocele") {
          if (sess.step === 0) {
            setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE ISOCÈLE [Étape 1/2] : Cliquez le 2e point de base");
          } else if (sess.step === 1) {
            setCadDraftSession({ ...sess, step: 2, points: [sess.points[0], pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE ISOCÈLE [Étape 2/2] : Cliquez le sommet pour la hauteur");
          } else {
            const p1 = sess.points[0];
            const p2 = sess.points[1];
            const triPts = buildIsoscelesTriangle(p1, p2, 0, pt);
            const baseLen = cadDist(p1, p2);
            const h = cadDist(p2, pt);
            addCad2dEntity({
              type: "polygon",
              layerId: "axes_tuyauterie",
              color: "#9CA3AF",
              points: triPts,
              subType: "isocele",
              length: baseLen,
              height: h,
              closed: true,
              metadata: { intent: "draft", source: "triangle_isocele", baseLength: baseLen, height: h },
            });
            setCadDraftSession(null);
            setAutocadPrompt(`Triangle isocèle créé (base: ${baseLen.toFixed(2)} m, hauteur: ${h.toFixed(2)} m).`);
            setStatusMessage(`Triangle isocèle créé · Base: ${baseLen.toFixed(2)}m · H: ${h.toFixed(2)}m`);
          }
        } else {
          if (sess.step === 0) {
            setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE 3 POINTS [Étape 1/3] : Cliquez le 2e point");
          } else if (sess.step === 1) {
            setCadDraftSession({ ...sess, step: 2, points: [sess.points[0], pt], mouseWorld: pt });
            setAutocadPrompt("TRIANGLE 3 POINTS [Étape 2/3] : Cliquez le 3e point");
          } else {
            const p1 = sess.points[0];
            const p2 = sess.points[1];
            const p3 = pt;
            addCad2dEntity({
              type: "polygon",
              layerId: "axes_tuyauterie",
              color: "#9CA3AF",
              points: [p1, p2, p3, p1],
              subType: "3points",
              closed: true,
              metadata: { intent: "draft", source: "triangle_3points" },
            });
            setCadDraftSession(null);
            setAutocadPrompt("Triangle 3 points créé.");
            setStatusMessage("Triangle 3 points créé");
          }
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "polygon") {
        const sides = sess.sides || 6;
        if (sess.step === 0) {
          setCadDraftSession({ ...sess, step: 1, center: pt, mouseWorld: pt });
          setAutocadPrompt(`POLYGONE [${sides} côtés] : Cliquez le rayon / premier sommet`);
        } else {
          const center = sess.center || sess.points[0] || pt;
          const polyPts = buildRegularPolygon(center, pt, sides);
          const r = cadDist(center, pt);
          addCad2dEntity({
            type: "polygon",
            layerId: "axes_tuyauterie",
            color: "#9CA3AF",
            points: polyPts,
            sides,
            radius: r,
            closed: true,
            metadata: { intent: "draft", source: "polygon", sides, radius: r },
          });
          setCadDraftSession(null);
          setAutocadPrompt(`Polygone ${sides} côtés créé (rayon: ${r.toFixed(2)} m).`);
          setStatusMessage(`Polygone régulier ${sides} côtés créé · R: ${r.toFixed(2)}m`);
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "arc") {
        const sub = sess.subType || "3points";
        if (sub === "3points") {
          if (sess.step === 0) {
            setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
            setAutocadPrompt("ARC [3 Points] : Cliquez le Point 2 (point de passage)");
          } else if (sess.step === 1) {
            setCadDraftSession({ ...sess, step: 2, points: [sess.points[0], pt], mouseWorld: pt });
            setAutocadPrompt("ARC [3 Points] : Cliquez le Point 3 (fin de l'arc)");
          } else {
            const p1 = sess.points[0];
            const p2 = sess.points[1];
            const p3 = pt;
            const arcData = calculate3PointArc(p1, p2, p3);
            if (arcData) {
              addCad2dEntity({
                type: "arc",
                layerId: "axes_tuyauterie",
                color: "#9CA3AF",
                center: arcData.center,
                radius: arcData.radius,
                startAngle: arcData.startAngle,
                endAngle: arcData.endAngle,
                subType: "3points",
                metadata: { intent: "draft", source: "arc_3points" },
              });
              setAutocadPrompt(`Arc 3 points créé (rayon: ${arcData.radius.toFixed(2)} m).`);
              setStatusMessage(`Arc 3 points créé · R: ${arcData.radius.toFixed(2)}m`);
            } else {
              setAutocadPrompt("Points alignés : impossible de former un arc.");
            }
            setCadDraftSession(null);
          }
        } else {
          if (sess.step === 0) {
            setCadDraftSession({ ...sess, step: 1, center: pt, mouseWorld: pt });
            setAutocadPrompt("ARC [Centre-Rayon-Angle] : Cliquez le point de départ de l'arc");
          } else if (sess.step === 1) {
            const center = sess.center!;
            const sa = cadAngleDeg(center, pt);
            setCadDraftSession({ ...sess, step: 2, points: [pt], currentAngleInput: String(sa), mouseWorld: pt });
            setAutocadPrompt("ARC [Centre-Rayon-Angle] : Cliquez le point final pour l'angle d'ouverture");
          } else {
            const center = sess.center!;
            const startPt = sess.points[0];
            const r = cadDist(center, startPt);
            const sa = cadAngleDeg(center, startPt);
            const ea = cadAngleDeg(center, pt);
            addCad2dEntity({
              type: "arc",
              layerId: "axes_tuyauterie",
              color: "#9CA3AF",
              center,
              radius: r,
              startAngle: sa,
              endAngle: ea,
              subType: "center_radius_angle",
              metadata: { intent: "draft", source: "arc_center_radius_angle" },
            });
            setCadDraftSession(null);
            setAutocadPrompt(`Arc créé (Rayon: ${r.toFixed(2)} m, ${sa.toFixed(0)}° à ${ea.toFixed(0)}°).`);
            setStatusMessage(`Arc créé · R: ${r.toFixed(2)}m`);
          }
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "line") {
        if (sess.step === 0) {
          setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
          setAutocadPrompt("LIGNE : Cliquez le point d'arrivée");
        } else {
          addCad2dEntity({
            type: "line",
            layerId: "axes_tuyauterie",
            color: "#9CA3AF",
            points: [sess.points[0], pt],
            metadata: { intent: "draft", source: "line" },
          });
          setCadDraftSession(null);
          setAutocadPrompt("Ligne créée.");
          setStatusMessage("Ligne créée");
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "circle") {
        if (sess.step === 0) {
          setCadDraftSession({ ...sess, step: 1, center: pt, mouseWorld: pt });
          setAutocadPrompt("CERCLE : Cliquez pour fixer le rayon");
        } else {
          const center = sess.center!;
          const r = Math.max(0.1, cadDist(center, pt));
          addCad2dEntity({
            type: "circle",
            layerId: "axes_tuyauterie",
            color: "#9CA3AF",
            center,
            radius: r,
            metadata: { intent: "draft", source: "circle" },
          });
          setCadDraftSession(null);
          setAutocadPrompt(`Cercle créé (rayon: ${r.toFixed(2)} m).`);
          setStatusMessage(`Cercle créé · R: ${r.toFixed(2)}m`);
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "polyline") {
        if (sess.step === 0) {
          setCadDraftSession({ ...sess, step: 1, points: [pt], mouseWorld: pt });
          setAutocadPrompt("POLYLIGNE : Cliquez pour ajouter des sommets. Entrée, Double-clic ou clic sur le 1er point pour terminer.");
          setStatusMessage("Polyligne : 1er point placé");
        } else {
          const firstPt = sess.points[0];
          const isCloseToStart = sess.points.length >= 3 && cadDist(pt, firstPt) < (0.35 / viewport.zoom);
          if (isCloseToStart) {
            const finalPts = [...sess.points];
            const newEntity = addCad2dEntity({
              type: "polyline",
              layerId: "axes_tuyauterie",
              color: "#9CA3AF",
              points: finalPts,
              metadata: { intent: "draft", source: "polyline", closed: true },
            });
            setCadDraftSession(null);
            if (newEntity) setSelectedCad2dIds([newEntity.id]);
            setAutocadPrompt(`Polyligne fermée créée (${finalPts.length} sommets).`);
            setStatusMessage(`Polyligne fermée · ${finalPts.length} points`);
          } else {
            const newPts = [...sess.points, pt];
            setCadDraftSession({ ...sess, points: newPts, mouseWorld: pt });
            setAutocadPrompt(`POLYLIGNE : ${newPts.length} sommets. Cliquez le point suivant (Entrée / Double-clic pour valider)`);
            setStatusMessage(`Polyligne : ${newPts.length} points`);
          }
        }
        e.stopPropagation();
        return;
      }

      if (sess.tool === "text") {
        const newEntity = addCad2dEntity({
          type: "text",
          layerId: "annotations",
          color: "#f43f5e",
          points: [pt],
          text: "Texte CAD",
          fontSize: 16,
          metadata: { intent: "annotation", source: "text" },
        });
        setCadDraftSession(null);
        if (newEntity) {
          setSelectedCad2dIds([newEntity.id]);
          setInlineEditTextId(newEntity.id);
          setCadPropsOpen(true);
        }
        setAutocadPrompt("Texte créé. Saisissez votre texte directement ou dans PROPS.");
        setStatusMessage("Texte CAD créé");
        e.stopPropagation();
        return;
      }
    }

    if (cad2dDraftTool) {
      const w = screenToIsoWorld(e);
      const point = { x: snapIsoV4(w.x, isoSnapStep), y: snapIsoV4(w.y, isoSnapStep) };
      if (cad2dDraftTool === "line") {
        addCad2dEntity({ type: "line", layerId: "axes_tuyauterie", color: "#9CA3AF", points: [point, { x: point.x + 2, y: point.y }] });
      } else if (cad2dDraftTool === "polyline") {
        addCad2dEntity({ type: "polyline", layerId: "axes_tuyauterie", color: "#9CA3AF", points: [point, { x: point.x + 1, y: point.y + 1 }, { x: point.x + 2, y: point.y }] });
      } else if (cad2dDraftTool === "circle") {
        addCad2dEntity({ type: "circle", layerId: "import_cad", color: "#9CA3AF", center: point, radius: 1 });
      } else if (cad2dDraftTool === "arc") {
        addCad2dEntity({ type: "arc", layerId: "import_cad", color: "#9CA3AF", center: point, radius: 1, startAngle: 0, endAngle: 90 });
      } else if (cad2dDraftTool === "text") {
        addCad2dEntity({ type: "text", layerId: "annotations", color: "#9CA3AF", points: [point], text: "Texte" });
      }
      setCad2dDraftTool(null);
      e.stopPropagation();
      return;
    }

    if(isoDrawMode==="segment"){
      createSegmentFromPointer(e);e.stopPropagation();return;
    }
    if(isoDrawMode==="coude"){
      createElbowFromPointer(e);e.stopPropagation();return;
    }
    if(isoDrawMode==="te"){
      createTeeFromPointer(e);e.stopPropagation();return;
    }
    if(isoDrawMode==="node"){
      createNodeFromPointer(e);e.stopPropagation();return;
    }

    if(interactionMode==="select" && isoDrawMode==="select"){
      marqueeRef.current = {
        startX: sx,
        startY: sy,
        additive,
        baselineNodeIds: additive ? [...selectedNodeIds] : [],
        baselineSegIds: additive ? [...selectedSegmentIds] : [],
        baselineDimIds: additive ? [...selectedDimensionIds] : [],
        baselineCad2dIds: additive ? [...selectedCad2dIds] : [],
        active: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    clearSelection();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current={x:e.clientX,y:e.clientY,px:viewport.panX,py:viewport.panY};
  };

  const pointerMove=(e:React.PointerEvent<SVGSVGElement>)=>{
    if (orbitDrag.current) {
      const cur = orbitDrag.current;
      const dx = e.clientX - cur.x;
      const dy = e.clientY - cur.y;
      const nextYaw = cur.startYaw + dx * 0.007;
      const nextPitch = clamp(cur.startPitch - dy * 0.007, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
      setViewport(v => ({
        ...v,
        viewMode: "free",
        yaw: nextYaw,
        pitch: nextPitch
      }));
      return;
    }

    if (drag.current && (interactionMode === "main" || isSpacePressedRef.current || e.buttons === 4 || e.buttons === 2 || interactionMode === "orbit")) {
      const cur = drag.current;
      const dx = e.clientX - cur.x, dy = e.clientY - cur.y;
      setViewport(v => ({ ...v, panX: cur.px + dx, panY: cur.py + dy }));
      return;
    }

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // 2-finger multi-touch gesture processing (pinch-to-zoom & two-finger pan)
    if (activePointersRef.current.size >= 2 && touchPinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.max(1, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
      const midClientX = (p1.clientX + p2.clientX) / 2;
      const midClientY = (p1.clientY + p2.clientY) / 2;
      const st = touchPinchStateRef.current;
      const scale = dist / (st.initialDist || 1);
      const nextZoom = clamp(st.initialZoom * scale, 0.02, 100);
      const factor = nextZoom / st.initialZoom;
      const deltaPanX = midClientX - st.initialMidClientX;
      const deltaPanY = midClientY - st.initialMidClientY;
      const panX = (st.centerSx - 310) - (st.centerSx - 310 - st.initialPanX) * factor + deltaPanX;
      const panY = (st.centerSy - 210) - (st.centerSy - 210 - st.initialPanY) * factor + deltaPanY;
      setViewport({
        zoom: Number(nextZoom.toFixed(3)),
        panX: Math.round(panX),
        panY: Math.round(panY),
      });
      return;
    }

    // PATCH 016B guided pointer move : mise a jour de l'apercu avant application.
    if (guidedCmd && guidedCmd.step === "target") {
      const { sx: gsx, sy: gsy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
      const gw = isoUnprojectV4(gsx, gsy, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
      setGuidedCmd(prev => (prev ? { ...prev, preview: { x: gw.x, y: gw.y, z: gw.z ?? (nodeZ || 0) } } : prev));
    }

    if (updateCad2dPointer(e)) return;
    if (cadDraftSession) {
      // PATCH 017P2 : ce que l on voit est ce qui sera cree.
      const pt = pdiCreatePoint(screenToIsoWorld(e));
      setCadDraftSession((prev) => (prev ? { ...prev, mouseWorld: pt } : null));
    }
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));

    if(marqueeRef.current){
      const m = marqueeRef.current;
      const dist = Math.hypot(sx - m.startX, sy - m.startY);
      if (!m.active && dist < 5) {
        return;
      }
      m.active = true;
      setMarquee({ startX: m.startX, startY: m.startY, currentX: sx, currentY: sy });

      const minX = Math.min(m.startX, sx), maxX = Math.max(m.startX, sx);
      const minY = Math.min(m.startY, sy), maxY = Math.max(m.startY, sy);
      const isCrossing = sx < m.startX;

      // PATCH 017I2 : lecture du cache Float32Array au lieu de reprojeter.
      const boxedNodeIds = nodes.filter(n => {
        const p = projectNodeCached017I2(n);
        return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      }).map(n => n.id);

      const boxedSegIds = segments.filter(s => {
        // PATCH 017I2 : recherche indexee, plus de balayage complet par troncon.
        const a = nodeById017I2.get(s.fromNodeId);
        const b = nodeById017I2.get(s.toNodeId);
        if (!a || !b) return false;
        const ep = segmentEndpoints(s, nodes, segments);
        const pa = ep ? isoProjectV4(ep.from.x, ep.from.y, ep.from.z, viewport.zoom, viewport.panX, viewport.panY) : isoProjectV4(a.x, a.y, a.z || 0, viewport.zoom, viewport.panX, viewport.panY);
        const pb = ep ? isoProjectV4(ep.to.x, ep.to.y, ep.to.z, viewport.zoom, viewport.panX, viewport.panY) : isoProjectV4(b.x, b.y, b.z || 0, viewport.zoom, viewport.panX, viewport.panY);
        if (isCrossing) {
          return lineSegmentIntersectsBox(pa, pb, minX, minY, maxX, maxY);
        } else {
          return pa.x >= minX && pa.x <= maxX && pa.y >= minY && pa.y <= maxY &&
                 pb.x >= minX && pb.x <= maxX && pb.y >= minY && pb.y <= maxY;
        }
      }).map(s => s.id);

      const finalNodeIds = m.additive ? Array.from(new Set([...m.baselineNodeIds, ...boxedNodeIds])) : boxedNodeIds;
      const finalSegIds = m.additive ? Array.from(new Set([...m.baselineSegIds, ...boxedSegIds])) : boxedSegIds;

      setSelectedNodeIds(finalNodeIds);
      setSelectedNodeId(finalNodeIds.length ? finalNodeIds[finalNodeIds.length - 1] : null);
      setSelectedSegmentIds(finalSegIds);
      setSelectedSegmentId(finalSegIds.length ? finalSegIds[finalSegIds.length - 1] : null);
      setSelectedFittingIds([]);
      setSelectedFitting(null);

      // PATCH 004b : le rectangle capture aussi les cotations. Aucune geometrie
      // recodee : resolveDimensionAnchor + isoProjectV4 + lineSegmentIntersectsBox,
      // et le meme offset de trace que le rendu.
      const boxedDimIds = dimensions.filter((d) => {
        const aw = resolveDimensionAnchor(d.a);
        const bw = resolveDimensionAnchor(d.b);
        if (!aw || !bw) return false;
        const off = d.offset || { x: 0, y: -24 };
        const pa = isoProjectV4(aw.x, aw.y, aw.z, viewport.zoom, viewport.panX, viewport.panY);
        const pb = isoProjectV4(bw.x, bw.y, bw.z, viewport.zoom, viewport.panX, viewport.panY);
        const qa = { x: pa.x + off.x, y: pa.y + off.y };
        const qb = { x: pb.x + off.x, y: pb.y + off.y };
        if (isCrossing) return lineSegmentIntersectsBox(qa, qb, minX, minY, maxX, maxY);
        return (
          qa.x >= minX && qa.x <= maxX && qa.y >= minY && qa.y <= maxY &&
          qb.x >= minX && qb.x <= maxX && qb.y >= minY && qb.y <= maxY
        );
      }).map((d) => d.id);

      // Capture aussi les éléments CAO 2D (lignes, polylignes, cercles, arcs, textes)
      const boxedCad2dIds = cad2dEntities.filter((entity) => {
        if (entity.locked) return false;
        const elev = entity.metadata?.elevationZ || 0;
        if (entity.type === "line" && entity.points && entity.points.length >= 2) {
          const p1 = isoProjectV4(entity.points[0].x, entity.points[0].y, elev, viewport.zoom, viewport.panX, viewport.panY);
          const p2 = isoProjectV4(entity.points[1].x, entity.points[1].y, elev, viewport.zoom, viewport.panX, viewport.panY);
          if (isCrossing) return lineSegmentIntersectsBox(p1, p2, minX, minY, maxX, maxY);
          return p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY &&
                 p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY;
        }
        if ((entity.type === "polyline" || entity.type === "polygon" || entity.type === "triangle" || entity.type === "rectangle") && entity.points && entity.points.length >= 2) {
          const projPts = entity.points.map(pt => isoProjectV4(pt.x, pt.y, elev, viewport.zoom, viewport.panX, viewport.panY));
          if (isCrossing) {
            for (let i = 0; i < projPts.length - 1; i++) {
              if (lineSegmentIntersectsBox(projPts[i], projPts[i + 1], minX, minY, maxX, maxY)) return true;
            }
            return projPts.some(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
          } else {
            return projPts.every(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
          }
        }
        if ((entity.type === "circle" || entity.type === "arc") && entity.center) {
          const c = isoProjectV4(entity.center.x, entity.center.y, elev, viewport.zoom, viewport.panX, viewport.panY);
          const r = (entity.radius || 1) * 18 * viewport.zoom;
          if (isCrossing) {
            return c.x + r >= minX && c.x - r <= maxX && c.y + r >= minY && c.y - r <= maxY;
          } else {
            return c.x - r >= minX && c.x + r <= maxX && c.y - r >= minY && c.y + r <= maxY;
          }
        }
        if (entity.type === "text" && entity.points && entity.points[0]) {
          const pt = isoProjectV4(entity.points[0].x, entity.points[0].y, elev, viewport.zoom, viewport.panX, viewport.panY);
          return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
        }
        return false;
      }).map((entity) => entity.id);

      const finalDimIds = m.additive
        ? Array.from(new Set([...m.baselineDimIds, ...boxedDimIds]))
        : boxedDimIds;
      setSelectedDimensionIds(finalDimIds);
      setSelectedDimensionId(finalDimIds.length ? finalDimIds[finalDimIds.length - 1] : null);

      const finalCad2dIds = m.additive
        ? Array.from(new Set([...(m.baselineCad2dIds || []), ...boxedCad2dIds]))
        : boxedCad2dIds;
      setSelectedCad2dIds(finalCad2dIds);
      return;
    }

    // PATCH 017P2 : la tolerance est convertie du viewBox vers les pixels reels.
    const pdiTolScale = (t: number) => pdiTolViewBox(t, svgRef.current ? svgRef.current.getBoundingClientRect().width : 0);
    // Detection du snap le plus proche (Port, Endpoint, Midpoint, Grid)
    let detectedSnap: { kind: "PORT"|"ENDPOINT"|"MIDPOINT"|"AXIS"|"GRID"; label: string; worldPos: { x: number; y: number; z: number }; screenPos: { x: number; y: number } } | null = null;
    if (snapEnabled) {
      if (snapPorts) {
        for (const node of nodes) {
          if (node.ports) {
            for (const port of node.ports) {
              const wp = portWorldPosition(node, port.id, nodes, segments);
              const sp = isoProjectV4(wp.x, wp.y, wp.z, viewport.zoom, viewport.panX, viewport.panY);
              if (Math.hypot(sp.x - sx, sp.y - sy) < pdiTolScale(PDI_SNAP_TOL_PX.PORT)) {
                detectedSnap = { kind: "PORT", label: `PORT ${node.name} [${port.role || port.index}]`, worldPos: wp, screenPos: sp };
                break;
              }
            }
          }
          if (detectedSnap) break;
        }
      }
      if (!detectedSnap && snapEndpoints) {
        for (const node of nodes) {
          const np = isoProjectV4(node.x, node.y, node.z, viewport.zoom, viewport.panX, viewport.panY);
          if (Math.hypot(np.x - sx, np.y - sy) < pdiTolScale(PDI_SNAP_TOL_PX.ENDPOINT)) {
            detectedSnap = { kind: "ENDPOINT", label: `POINT ${node.name} (Z=${node.z || 0}m)`, worldPos: { x: node.x, y: node.y, z: node.z || 0 }, screenPos: np };
            break;
          }
        }
      }
      if (!detectedSnap && snapMidpoints) {
        for (const seg of segments) {
          const ep = segmentEndpoints(seg, nodes, segments);
          if (ep) {
            const mx = (ep.from.x + ep.to.x) / 2, my = (ep.from.y + ep.to.y) / 2, mz = (ep.from.z + ep.to.z) / 2;
            const sp = isoProjectV4(mx, my, mz, viewport.zoom, viewport.panX, viewport.panY);
            if (Math.hypot(sp.x - sx, sp.y - sy) < pdiTolScale(PDI_SNAP_TOL_PX.MIDPOINT)) {
              detectedSnap = { kind: "MIDPOINT", label: `MILIEU ${seg.sourceName || "Tube"}`, worldPos: { x: mx, y: my, z: mz }, screenPos: sp };
              break;
            }
          }
        }
      }
      if (!detectedSnap && snapGrid && isoSnapStep > 0) {
        const w = isoUnprojectV4(sx, sy, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
        const gx = snapIsoV4(w.x, isoSnapStep);
        const gy = snapIsoV4(w.y, isoSnapStep);
        const gp = isoProjectV4(gx, gy, nodeZ || 0, viewport.zoom, viewport.panX, viewport.panY);
        if (Math.hypot(gp.x - sx, gp.y - sy) < pdiTolScale(PDI_SNAP_TOL_PX.GRID)) {
          detectedSnap = { kind: "GRID", label: `GRILLE (${gx.toFixed(2)}, ${gy.toFixed(2)})`, worldPos: { x: gx, y: gy, z: nodeZ || 0 }, screenPos: gp };
        }
      }
    }
    setActiveSnap(detectedSnap);

    if (isoDrawMode === "segment" && drawStartNodeId) {
      const w = screenToIsoWorld(e, nodeZ || 0);
      const targetPos = detectedSnap ? detectedSnap.worldPos : pdiCreatePoint(w);
      setTubeHoverWorld(targetPos);
    }

    if(branchDrawing){
      const w=screenToIsoWorld(e);
      const targetPos = detectedSnap ? detectedSnap.worldPos : { x: snapIsoV4(w.x, isoSnapStep), y: snapIsoV4(w.y, isoSnapStep), z: nodeZ || 0 };
      setBranchDrawing(prev=>prev?{...prev,currentWorldPos:targetPos}:null);
      return;
    }
    if(dragNodeId){
      const ds=dragSelectionRef.current;
      if(ds){
        const screenDist = Math.hypot(e.clientX - ds.startScreen.x, e.clientY - ds.startScreen.y);
        // Seuil d'initiation du déplacement (deadzone 4px) pour ne pas confondre un clic avec un déplacement
        if (!ds.isDragging && screenDist < 4) {
          return;
        }
        ds.isDragging = true;
        if (axisCursorEnabled) {
          setDragCursorPos({ x: sx, y: sy });
        }

        const now=screenToIsoWorld(e, nodeZ || 0);

        if (ds.clickedEntity?.type === "support") {
          const supId = ds.clickedEntity.id;
          const sup = supports.find(s => s.id === supId);
          if (sup) {
            const hitSeg = findSegmentAtScreen(sx, sy);
            const targetSeg = hitSeg ? segments.find(s => s.id === hitSeg.id) : segments.find(s => s.id === sup.segmentId);
            if (targetSeg) {
              const fn = nodes.find(n => n.id === targetSeg.fromNodeId);
              const tn = nodes.find(n => n.id === targetSeg.toNodeId);
              if (fn && tn) {
                const segDx = tn.x - fn.x;
                const segDy = tn.y - fn.y;
                const segDz = (tn.z || 0) - (fn.z || 0);
                const segDistSq = segDx * segDx + segDy * segDy + segDz * segDz;
                let t = 0.5;
                if (segDistSq > 0.0001) {
                  const cdx = now.x - fn.x;
                  const cdy = now.y - fn.y;
                  const cdz = (now.z || 0) - (fn.z || 0);
                  t = Math.max(0.01, Math.min(0.99, (cdx * segDx + cdy * segDy + cdz * segDz) / segDistSq));
                }
                const worldX = Number((fn.x + t * segDx).toFixed(3));
                const worldY = Number((fn.y + t * segDy).toFixed(3));
                const worldZ = Number(((fn.z || 0) + t * segDz).toFixed(3));
                const distM = Number((t * targetSeg.length).toFixed(3));

                const nextSupports = supports.map(s => s.id === supId ? {
                  ...s,
                  segmentId: targetSeg.id,
                  tRatio: t,
                  distanceFromFromNodeM: distM,
                  worldPos: { x: worldX, y: worldY, z: worldZ },
                  elevationZ: worldZ
                } : s);

                if (!gestureDirtyRef.current) {
                  pushHistory();
                  redoRef.current = [];
                  gestureDirtyRef.current = true;
                }
                dragChangedRef.current = true;
                setSupportsRaw(nextSupports);
              }
            } else {
              const targetX = snapEnabled ? snapIsoV4(now.x, isoSnapStep) : pdiRound3(now.x);
              const targetY = snapEnabled ? snapIsoV4(now.y, isoSnapStep) : pdiRound3(now.y);
              const targetZ = pdiRound3(now.z);
              const nextSupports = supports.map(s => s.id === supId ? {
                ...s,
                worldPos: { x: targetX, y: targetY, z: targetZ },
                elevationZ: targetZ
              } : s);
              if (!gestureDirtyRef.current) {
                pushHistory();
                redoRef.current = [];
                gestureDirtyRef.current = true;
              }
              dragChangedRef.current = true;
              setSupportsRaw(nextSupports);
            }
          }
          return;
        }

        const dx=now.x-ds.start.x,dy=now.y-ds.start.y,dz=now.z-ds.start.z;
        const snapStep = snapEnabled ? isoSnapStep : 0;
        const nextNodes=nodes.map(n=>{
          const p=ds.nodes.get(n.id);
          if(!p)return n;
          const targetX = p.x + dx;
          const targetY = p.y + dy;
          const targetZ = p.z + dz;
          return {
            ...n,
            x: snapStep > 0 ? snapIsoV4(targetX, snapStep) : pdiRound3(targetX),
            y: snapStep > 0 ? snapIsoV4(targetY, snapStep) : pdiRound3(targetY),
            z: pdiRound3(targetZ)
          };
        });
        if(JSON.stringify(nextNodes)!==JSON.stringify(nodes)){
          // PATCH 004 : l'instantane est pris UNE fois au debut du geste,
          // puis on ecrit en direct (setters bruts) pour ne pas empiler
          // un undo par mouvement de souris.
          if(!gestureDirtyRef.current){
            pushHistory();
            redoRef.current=[];
            gestureDirtyRef.current=true;
          }
          dragChangedRef.current=true;
          setNodesRaw(nextNodes);
          setSegmentsRaw(recalcSegmentLengths(nextNodes,segments));
        }
      }
      return;
    }
    if(dragFittingInfo && interactionMode==="select"){
      if (axisCursorEnabled) {
        setDragCursorPos({ x: sx, y: sy });
      }
      const hit=findSegmentAtScreen(sx,sy);
      if(hit&&hit.id===dragFittingInfo.segmentId){
        if(!gestureDirtyRef.current){
          pushHistory();
          redoRef.current=[];
          gestureDirtyRef.current=true;
        }
        setSegmentsRaw(prev=>prev.map(s=>s.id===hit.id?{...s,fittings:s.fittings.map(f=>f.id===dragFittingInfo.fittingId?{...f,localPosition:hit.t}:f)}:s));
      }
      return;
    }
    const cur=drag.current;if(!cur)return;
    const dx=e.clientX-cur.x,dy=e.clientY-cur.y;
    setViewport(v=>({...v,panX:cur.px+dx,panY:cur.py+dy}));
  };

  const pointerUp=(e?:React.PointerEvent<SVGSVGElement>)=>{
    if (orbitDrag.current) {
      orbitDrag.current = null;
    }
    if (e) {
      activePointersRef.current.delete(e.pointerId);
    } else {
      activePointersRef.current.clear();
    }
    if (activePointersRef.current.size < 2) {
      touchPinchStateRef.current = null;
    }
    endCad2dPointer();
    if(marqueeRef.current){
      const m = marqueeRef.current;
      if (m.active) {
        const total = selectedNodeIds.length + selectedSegmentIds.length + selectedDimensionIds.length + selectedCad2dIds.length;
        if (total > 0) {
          const parts: string[] = [];
          if (selectedNodeIds.length) parts.push(`${selectedNodeIds.length} nœud(s)`);
          if (selectedSegmentIds.length) parts.push(`${selectedSegmentIds.length} tronçon(s)`);
          if (selectedDimensionIds.length) parts.push(`${selectedDimensionIds.length} cotation(s)`);
          if (selectedCad2dIds.length) parts.push(`${selectedCad2dIds.length} objet(s) 2D`);
          setStatusMessage(`Sélection multiple : ${parts.join(", ")}`);
        } else {
          setStatusMessage("Zone vide sélectionnée");
        }
      } else {
        if (!m.additive) {
          clearSelection();
        }
      }
      marqueeRef.current = null;
      setMarquee(null);
    }
    if(marquee){
      setMarquee(null);
    }
    if(branchDrawing&&e){
      const w=screenToIsoWorld(e);
      const target=e.target as Element;
      const nodeEl=target.closest("[data-iso-node='true']");
      let targetId=nodeEl?.getAttribute("data-node-id");
      if(!targetId){
        const near=nodes.map(n=>({n,d:Math.hypot(n.x-w.x,n.y-w.y)})).filter(x=>x.n.id!==branchDrawing.fromNodeId).sort((a,b)=>a.d-b.d)[0];
        if(near&&near.d<1.5)targetId=near.n.id;
      }
      if(targetId&&targetId!==branchDrawing.fromNodeId){
        const targetPortEl=target.closest("[data-iso-port=\'true\']");
        const targetPortIndex=Number(targetPortEl?.getAttribute("data-port-idx")||"0");
        const targetNode=nodes.find(n=>n.id===targetId);
        createSegmentFromNodes(branchDrawing.fromNodeId,targetId,branchDrawing.fromPortId,portByIndex(targetNode,targetPortIndex)?.id);
      }else{
        // PATCH 017P : le piquage respecte l accroche active.
        const sw=pdiCreatePoint(w);
        const newN=makeNode(`Piquage N${nodes.length+1}`,sw.x,sw.y,sw.z,"normal");
        const nextNodes=[...nodes,newN];
        setNodes(nextNodes);
        const a=nodes.find(n=>n.id===branchDrawing.fromNodeId);
        if(a){
          const length=Math.max(.05,Math.hypot(newN.x-a.x,newN.y-a.y,newN.z-a.z));
          const segment:IsoSegment={id:uid("seg"),fromNodeId:a.id,fromPortId:branchDrawing.fromPortId||availablePortId(a,segments,1),toNodeId:newN.id,toPortId:availablePortId(newN,segments,0),lineId:DEFAULT_LINE_ID,dn:newDN,pn:newPN,material:newMaterial,length,type:Math.abs(newN.z-a.z)>.05?"riser":"branch",fittings:[],color:newSegmentColor,sourceName:newSourceName.trim()||`${dia(newDN).inch} — Pipeline`};
          setSegments(prev=>[...prev,segment]);
          setSelectedSegmentId(segment.id);
        }
      }
    }
    const ds = dragSelectionRef.current;
    if (ds) {
      if (!ds.isDragging && ds.clickedEntity) {
        // Clic simple sans glissement : si l'élément était déjà dans une multi-sélection et sans touche additive, on isole la sélection sur cet élément
        if (ds.clickedEntity.wasAlreadySelected && !ds.clickedEntity.additive) {
          if (ds.clickedEntity.type === "node") {
            selectNodeV44(ds.clickedEntity.id, false);
          } else if (ds.clickedEntity.type === "segment") {
            selectSegmentV44(ds.clickedEntity.id, false);
          }
        }
      } else if (ds.isDragging && dragChangedRef.current) {
        setSegments(prev=>recalcSegmentLengths(nodes,prev));
      }
    }
    drag.current=null;
    dragSelectionRef.current=null;
    dragChangedRef.current=false;
    // PATCH 004 : le prochain geste ouvrira une nouvelle entree d'historique.
    gestureDirtyRef.current=false;
    setDragNodeId(null);
    setDragFittingInfo(null);
    setBranchDrawing(null);
    setDragCursorPos(null);
  };

  const addNode=()=>{
    const n=makeNode(nodeName.trim()||"Nouveau point",nodes.length*4,0,0,nodeType);
    setNodes(v=>[...v,n]); setSelectedNodeId(n.id);
    if(!fromNode)setFromNode(n.id); else if(!toNode)setToNode(n.id);
    setNodeName("Nouveau point");
  };
  const removeNode=(id:string)=>{
    // PATCH 004 : suppression unitaire alignee sur deleteSelection.
    const nextNodes=nodes.filter(n=>n.id!==id);
    const nextSegments=segments.filter(s=>s.fromNodeId!==id&&s.toNodeId!==id);
    const nextDimensions=dimensions.filter(d=>d.a.nodeId!==id&&d.b.nodeId!==id);
    commitGraph(nextNodes,recalcSegmentLengths(nextNodes,nextSegments),lines,nextDimensions);
    if(selectedNodeId===id)setSelectedNodeId(null);
    setSelectedNodeIds(prev=>prev.filter(x=>x!==id));
    setCtxMenu(null);
  };
  const renameNode=(id:string,name:string)=>
    setNodes(v=>v.map(n=>n.id===id?{...n,name}:n));

  const rotateSelectedEquipment=(delta:number)=>{
    if (selectedFitting && selectedSegmentId) {
      setSegments(v => v.map(s => s.id === selectedSegmentId ? {
        ...s,
        fittings: s.fittings.map(f => f.id === selectedFitting.fittingId ? {
          ...f,
          orientation: ((((f.orientation || 0) + delta) % 360) + 360) % 360
        } : f)
      } : s));
      setStatusMessage(`Rotation raccord ${delta > 0 ? "+" : ""}${delta}°`);
      return;
    }
    const targetNodeIds = selectedNodeIds.length ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []);
    if (!targetNodeIds.length) {
      setStatusMessage("Sélectionnez un équipement ou un nœud pour le pivoter (R)");
      return;
    }

    // Calcul du barycentre (centroid) des nœuds de la sélection
    const selectedNodesObj = nodes.filter(n => targetNodeIds.includes(n.id));
    const cx = selectedNodesObj.reduce((sum, n) => sum + n.x, 0) / (selectedNodesObj.length || 1);
    const cy = selectedNodesObj.reduce((sum, n) => sum + n.y, 0) / (selectedNodesObj.length || 1);
    const pivot = { x: cx, y: cy, z: 0 };

    const nextNodes = nodes.map(n => {
      if (!targetNodeIds.includes(n.id)) return n;

      // Si plusieurs nœuds sont sélectionnés ensemble, ils pivotent géométriquement autour du centre de gravité commun.
      // Si un seul nœud / équipement est sélectionné, sa position spatiale (x, y) reste fixe et seule sa rotation propre change.
      const rotatedPt = selectedNodesObj.length > 1 ? rotateWorldPoint(n, pivot, delta) : n;

      let rotation = ((((n.rotation || 0) + delta) % 360) + 360) % 360;
      let branchAngle = n.branchAngle;

      const hasBranch = n.type === "tee" || n.type === "piquage" || (n.ports && n.ports.some(p => p.role === "branch" || p.role === "aux" || p.index >= 2));
      if (hasBranch || n.branchAngle !== undefined) {
        branchAngle = ((((n.branchAngle !== undefined ? n.branchAngle : -90) + delta) % 360) + 360) % 360;
      }

      return {
        ...n,
        x: Number(rotatedPt.x.toFixed(4)),
        y: Number(rotatedPt.y.toFixed(4)),
        rotation,
        branchAngle
      };
    });

    // PATCH 017P : rotation transactionnelle. La commande refuse de valider
    // si elle a fait varier le nombre de noeuds (cause des noeuds et tubes
    // fantomes observes) et signale toute anomalie geometrique residuelle.
    if (nextNodes.length !== nodes.length) {
      setStatusMessage("Rotation refusée : le nombre de nœuds a changé");
      return;
    }
    const rotationAudit = pdiAuditGraph(nextNodes, segments);
    commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
    setStatusMessage(`Rotation ${delta > 0 ? "+" : ""}${delta}° (R)${rotationAudit ? " · contrôle : " + rotationAudit : ""}`);
  };
  const flipSelectedEquipment=()=>{
    const selected=nodes.filter(n=>selectedNodeIds.includes(n.id)&&n.equipmentType);
    if(!selected.length)return;
    let nextNodes=nodes.map(n=>({...n}));
    selected.forEach(equipment=>{
      const bend=equipment.equipmentType?elbowAngle(equipment.equipmentType):0;
      if(!bend){nextNodes=nextNodes.map(n=>n.id===equipment.id?{...n,mirrored:!n.mirrored}:n);return;}
      const direction=equipment.bendDirection||1;
      const outgoing=segments.find(segment=>segment.fromNodeId===equipment.id);
      if(!outgoing){nextNodes=nextNodes.map(n=>n.id===equipment.id?{...n,bendDirection:(-direction) as 1|-1}:n);return;}
      const downstream=downstreamNodeIds(outgoing.toNodeId,segments,outgoing.id);
      const delta=-2*bend*direction;
      nextNodes=nextNodes.map(n=>{
        if(n.id===equipment.id)return {...n,bendDirection:(-direction) as 1|-1};
        if(!downstream.has(n.id))return n;
        const q=rotateWorldPoint(n,equipment,delta);
        return {...n,x:q.x,y:q.y,z:q.z,rotation:((((n.rotation||0)+delta)%360)+360)%360};
      });
    });
    commitGraph(nextNodes,recalcSegmentLengths(nextNodes,segments));
    setStatusMessage("Orientation équipement inversée");
  };

  const universalRotate = (delta: number) => {
    if (selectedCad2dIds.length > 0) {
      rotateSelectedCad2d(delta);
      return;
    }
    if (selectedFitting && selectedSegmentId) {
      rotateSelectedEquipment(delta);
      return;
    }
    if (selectedNodeIds.length > 0 || selectedNodeId) {
      rotateSelectedEquipment(delta);
      return;
    }
    if (selectedSegmentIds.length > 0 || selectedSegmentId) {
      const segId = selectedSegmentIds[0] || selectedSegmentId;
      setSegments(prev => prev.map(s => {
        if (s.id !== segId) return s;
        return {
          ...s,
          fromNodeId: s.toNodeId,
          toNodeId: s.fromNodeId,
          fromPortId: s.toPortId,
          toPortId: s.fromPortId,
        };
      }));
      setStatusMessage("Sens d'écoulement du tronçon inversé");
      return;
    }
    setStatusMessage("Sélectionnez un élément pour le pivoter (R)");
  };

  const universalDelete = () => {
    let count = 0;
    if (selectedCad2dIds.length > 0) {
      count += selectedCad2dIds.length;
      deleteSelectedCad2d();
    }
    if (selectedSupportId) {
      setSupports(prev => prev.filter(s => s.id !== selectedSupportId));
      setSelectedSupportId(null);
      count++;
    }
    if (selectedNodeIds.length > 0 || selectedSegmentIds.length > 0 || selectedFittingIds.length > 0 || selectedDimensionIds.length > 0 || selectedDimensionId) {
      count += selectedNodeIds.length + selectedSegmentIds.length + selectedFittingIds.length + selectedDimensionIds.length;
      deleteSelection();
    }
    if (count > 0) {
      setStatusMessage(`${count} élément(s) supprimé(s)`);
    }
  };

  const universalCopy = () => {
    let copied = false;
    if (selectedCad2dIds.length > 0) {
      copyCad2dSelection();
      copied = true;
    }
    if (selectedNodeIds.length > 0 || selectedSegmentIds.length > 0) {
      copySelection();
      copied = true;
    }
    if (!copied) {
      setStatusMessage("Rien à copier");
    }
  };

  const universalDuplicate = () => {
    if (selectedCad2dIds.length > 0) {
      duplicateSelectedCad2d();
    }
    if (selectedNodeIds.length > 0 || selectedSegmentIds.length > 0) {
      duplicateSelection();
    }
  };

  // PATCH 017K3 : signaler une classe qui s ecarte de la spec du projet.
  // On n interdit pas la derogation : une rupture de spec est legitime dans
  // un projet reel. On la rend visible, conformement au principe des
  // specifications de tuyauterie ou la classe appartient a la ligne.
  const pdiSignalerClasse017K3 = (classe: string) => {
    if (pdiClasseConforme017K3(classe, projectSetup)) return;
    setStatusMessage(
      pdiMessageDerogation017K3(classe, pdiClasseDeSpec017K3(projectSetup)),
    );
  };

  const addSegment=()=>{
    if(!fromNode||!toNode||fromNode===toNode)return;
    const a=nodes.find(n=>n.id===fromNode),b=nodes.find(n=>n.id===toNode);
    const s:IsoSegment={
      id:uid("seg"),fromNodeId:fromNode,fromPortId:availablePortId(a,segments,1),toNodeId:toNode,toPortId:availablePortId(b,segments,0),lineId:DEFAULT_LINE_ID,dn:newDN,
      pn:newPN,material:newMaterial,length:Math.max(.05,newLength),
      type:a&&b&&a.z!==b.z?"riser":"straight",fittings:[],color:newSegmentColor,sourceName:newSourceName.trim()||`${dia(newDN).inch} — Pipeline`
    };
    const normSegDecision=defaultIsometricNormativeBridge.checkSegment(s,{legacyProjectSetup:projectSetup});
    if(normSegDecision.status==="INCOMPATIBLE"||normSegDecision.status==="INVALID"){setStatusMessage(normSegDecision.message);}
    setSegments(v=>[...v,s]);setSelectedSegmentId(s.id);
  };
  const removeSegment=(id:string)=>{
    setSegments(v=>v.filter(s=>s.id!==id));
    if(selectedSegmentId===id)setSelectedSegmentId(null);
  };

  const insertEquipmentNode=(segmentId:string,type:IsoFittingType,position:number,label?:string)=>{
    const s=segments.find(x=>x.id===segmentId);
    if(!s)return null;
    const a=nodes.find(n=>n.id===s.fromNodeId),b=nodes.find(n=>n.id===s.toNodeId);
    if(!a||!b)return null;
    const t=clamp(position,0,1);
    const p=pointOnSegment(a,b,t);
    const baseAngle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    const n=makeEquipmentNode(type,label?.trim()||FITTING_LABELS[type],p.x,p.y,p.z,s.dn,baseAngle);
    const normNodeDecision=defaultIsometricNormativeBridge.checkNode(n,{legacyProjectSetup:projectSetup});
    if(normNodeDecision.status==="INCOMPATIBLE"||normNodeDecision.status==="INVALID"){setStatusMessage(normNodeDecision.message);}
    const bend=elbowAngle(type);
    const downstream=bend?downstreamNodeIds(b.id,segments,s.id):new Set<string>();
    const movedNodes=nodes.map(node=>{
      if(!bend||!downstream.has(node.id))return node;
      const q=rotateWorldPoint(node,p,bend);
      return {...node,x:q.x,y:q.y,z:q.z,rotation:(node.rotation||0)+bend};
    });
    const movedB=movedNodes.find(node=>node.id===b.id)||b;
    const l1=Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z);
    const l2=Math.hypot(movedB.x-p.x,movedB.y-p.y,movedB.z-p.z);
    const s1={...cloneSegmentBetween(s,a.id,n.id,l1,s.type),fromPortId:s.fromPortId,toPortId:portByIndex(n,0)?.id};
    const s2={...cloneSegmentBetween(s,n.id,b.id,l2,s.type),fromPortId:portByIndex(n,1)?.id,toPortId:s.toPortId};
    const nextNodes=[...movedNodes,n];
    const nextSegments=recalcSegmentLengths(nextNodes,[...segments.filter(x=>x.id!==s.id),s1,s2]);
    commitGraph(nextNodes,nextSegments);
    setSelectedNodeId(n.id);
    setSelectedNodeIds([n.id]);
    setSelectedSegmentId(s2.id);
    setSelectedFitting(null);
    return n.id;
  };

  const addFitting=()=>{
    if(!selectedSegmentId)return;
    insertEquipmentNode(selectedSegmentId,fitType,fitPos,fitLabel);
  };
  const removeFitting=(sid:string,fid:string)=>{
    setSegments(v=>v.map(s=>s.id===sid?{...s,fittings:s.fittings.filter(f=>f.id!==fid)}:s));
    if(edit?.fitting.id===fid)setEdit(null);
  };
  const saveEdit=()=>{
    if(!edit)return;
    setSegments(v=>v.map(s=>{
      if(s.id!==edit.segmentId)return s;
      const start=cumulative.starts.get(s.fromNodeId)||0;
      return {...s,fittings:s.fittings.map(f=>f.id===edit.fitting.id
        ? {...edit.fitting,localPosition:clamp(edit.fitting.localPosition,0,1),
           cumulativePosition:start+s.length*clamp(edit.fitting.localPosition,0,1)}
        : f)};
    }));
    setEdit(null);
  };

  const iso=(n:IsoNode)=>isoProjectV4(n.x,n.y,n.z || 0,viewport.zoom,viewport.panX,viewport.panY,viewport.viewMode,viewport.yaw,viewport.pitch);

  const screenToIsoWorld=(e:React.PointerEvent<any>, targetZ:number = nodeZ || 0)=>{
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
    return isoUnprojectV4(sx, sy, viewport.zoom, viewport.panX, viewport.panY, targetZ);
  };

  // PATCH 017P : point de creation. Avant ce patch la creation d un noeud
  // ignorait activeSnap et ne retenait que la grille : impossible de poser
  // un noeud exactement sur un port, une extremite ou un milieu de tube.
  const pdiCreatePoint = (w: { x: number; y: number; z?: number }) => {
    if (snapEnabled && activeSnap) {
      return {
        x: pdiRound3(activeSnap.worldPos.x),
        y: pdiRound3(activeSnap.worldPos.y),
        z: pdiRound3(activeSnap.worldPos.z),
      };
    }
    const step = snapEnabled && snapGrid ? isoSnapStep : 0;
    return {
      x: pdiSnapValue(w.x, step),
      y: pdiSnapValue(w.y, step),
      z: pdiRound3(nodeZ || 0),
    };
  };

  
  // === V4.8d COTATIONS & ALIGNEMENT ===
  const anchorFromTarget = (target: Element): IsoDimensionAnchor | null => {
    const cadGripEl = target.closest("[data-cad2d-grip='true']");
    if (cadGripEl) {
      const entityId = cadGripEl.getAttribute("data-entity-id") || "";
      const gripType = cadGripEl.getAttribute("data-grip-type") || "";
      const pointIdxStr = cadGripEl.getAttribute("data-point-idx");
      const pointIndex = pointIdxStr !== null ? Number(pointIdxStr) : undefined;
      return { kind: "cad2d", entityId, pointType: gripType, pointIndex };
    }

    const portEl = target.closest("[data-iso-port='true']");
    if (portEl) {
      const nodeId = portEl.getAttribute("data-port-node-id") || "";
      const portIdx = Number(portEl.getAttribute("data-port-idx") || "0");
      const node = nodes.find((n) => n.id === nodeId);
      const portId = portByIndex(node, portIdx)?.id;
      if (nodeId) return { kind: "port", nodeId, portId };
    }
    const nodeEl = target.closest("[data-iso-node='true']");
    const nodeId = nodeEl?.getAttribute("data-node-id") || "";
    return nodeId ? { kind: "node", nodeId } : null;
  };

  const resolveDimensionAnchor = (anchor: IsoDimensionAnchor) => {
    if (anchor.kind === "cad2d") {
      const entity = cad2dEntities.find((e) => e.id === anchor.entityId);
      if (!entity) return null;
      const elevationZ = entity.metadata?.elevationZ || 0;
      if (anchor.pointType === "center" && entity.center) {
        return { x: entity.center.x, y: entity.center.y, z: elevationZ };
      }
      if (anchor.pointIndex !== undefined && entity.points && entity.points[anchor.pointIndex]) {
        const pt = entity.points[anchor.pointIndex];
        return { x: pt.x, y: pt.y, z: elevationZ };
      }
      if (entity.center) return { x: entity.center.x, y: entity.center.y, z: elevationZ };
      if (entity.points && entity.points[0]) return { x: entity.points[0].x, y: entity.points[0].y, z: elevationZ };
      return null;
    }
    const node = nodes.find((n) => n.id === anchor.nodeId);
    if (!node) return null;
    if (anchor.kind === "port" && anchor.portId) return portWorldPosition(node, anchor.portId, nodes, segments);
    return { x: node.x, y: node.y, z: node.z || 0 };
  };

  const dimensionRenderItems = useMemo(
    () =>
      dimensions
        .map((dimension) => {
          const a = resolveDimensionAnchor(dimension.a);
          const b = resolveDimensionAnchor(dimension.b);
          if (!a || !b) return null;
          const p1 = isoProjectV4(a.x, a.y, a.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
          const p2 = isoProjectV4(b.x, b.y, b.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
          const rawOffset = dimension.offset || { x: 0, y: -24 };

          const dx2d = p2.x - p1.x;
          const dy2d = p2.y - p1.y;
          const segLen2d = Math.hypot(dx2d, dy2d);

          let offX = rawOffset.x;
          let offY = rawOffset.y;

          if (segLen2d > 1) {
            // Screen-space perpendicular normal vector
            let nx = -dy2d / segLen2d;
            let ny = dx2d / segLen2d;

            const dist = Math.hypot(rawOffset.x, rawOffset.y) || 24;

            if (rawOffset.x === 0) {
              const sign = rawOffset.y < 0 ? -1 : 1;
              if (ny * sign < 0) {
                nx = -nx;
                ny = -ny;
              }
              offX = nx * Math.abs(rawOffset.y);
              offY = ny * Math.abs(rawOffset.y);
            } else {
              const dot = nx * rawOffset.x + ny * rawOffset.y;
              if (dot < 0) {
                nx = -nx;
                ny = -ny;
              }
              offX = nx * dist;
              offY = ny * dist;
            }
          }

          const q1 = { x: p1.x + offX, y: p1.y + offY };
          const q2 = { x: p2.x + offX, y: p2.y + offY };
          const mid = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 };

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const value =
            dimension.type === "deltaX"
              ? Math.abs(dx)
              : dimension.type === "deltaY"
                ? Math.abs(dy)
                : dimension.type === "deltaZ"
                  ? Math.abs(dz)
                  : Math.hypot(dx, dy, dz);
          const displayValue =
            dimension.unit === "mm"
              ? `${Math.round(value * 1000)} mm`
              : dimension.unit === "in" || dimension.unit === "ft-in"
                ? formatLength(value, "imperial")
                : formatLength(value, unitSystem);
          return {
            ...dimension,
            p1,
            p2,
            q1,
            q2,
            mid,
            displayValue: dimension.label || displayValue,
          };
        })
        .filter(Boolean) as Array<
        IsoDimension & {
          p1: { x: number; y: number };
          p2: { x: number; y: number };
          q1: { x: number; y: number };
          q2: { x: number; y: number };
          mid: { x: number; y: number };
          displayValue: string;
        }
      >,
    [dimensions, nodes, cad2dEntities, viewport.zoom, viewport.panX, viewport.panY, viewport.yaw, viewport.pitch, viewport.viewMode, unitSystem],
  );

  const handleDimensionAnchorPick = (anchor: IsoDimensionAnchor) => {
    if (!dimensionPick) {
      setDimensionPick(anchor);
      if (anchor.kind !== "cad2d" && anchor.nodeId) {
        setSelectedNodeIds([anchor.nodeId]);
        setSelectedNodeId(anchor.nodeId);
      }
      setStatusMessage("Cotation : choisir le second ancrage");
      return;
    }

    const isSame =
      dimensionPick.kind === anchor.kind &&
      (anchor.kind === "cad2d"
        ? dimensionPick.entityId === anchor.entityId &&
          dimensionPick.pointType === anchor.pointType &&
          dimensionPick.pointIndex === anchor.pointIndex
        : dimensionPick.nodeId === anchor.nodeId && dimensionPick.portId === anchor.portId);

    if (isSame) {
      setStatusMessage("Cotation : choisir deux ancrages différents");
      return;
    }

    const dimension: IsoDimension = {
      id: uid("dim"),
      type: "distance",
      a: dimensionPick,
      b: anchor,
      offset: { x: 0, y: -26 - (dimensions.length % 4) * 12 },
      unit: "m",
    };
    setDimensions((prev) => [...prev, dimension]);
    setDimensionPick(null);
    if (dimensionPick.kind !== "cad2d" && dimensionPick.nodeId && anchor.kind !== "cad2d" && anchor.nodeId) {
      setSelectedNodeIds([dimensionPick.nodeId, anchor.nodeId]);
      setSelectedNodeId(anchor.nodeId);
    }
    setShowDimensions(true);
    setStatusMessage("Cotation ajoutée");
  };

  const alignSelectedNodesAxis = (axis: "x" | "y" | "z") => {
    // 017Q : Alignement universel direct (2 objets, 3 objets, N objets)
    // Fonctionne sur nœuds, tronçons ou mixte, avec prise en compte de l'ancrage actif.
    const res = performUniversalAlign({
      axis,
      nodes,
      segments,
      selectedNodeIds,
      selectedSegmentIds,
      activeAnchor,
      snapGrid: snapEnabled && snapGrid,
      snapStep: isoSnapStep,
    });

    setStatusMessage(res.message);
    if (!res.success) return;
    if (res.movedNodeCount > 0) {
      commitGraph(res.nextNodes, recalcSegmentLengths(res.nextNodes, segments));
    }
  };

  const alignSelectedEquipmentOnTube = () => {
    const equipment = nodes.find((node) => selectedNodeIds.includes(node.id) && node.equipmentType);
    const segmentId = selectedSegmentIds[selectedSegmentIds.length - 1] || selectedSegmentId;
    const segment = segments.find((item) => item.id === segmentId);
    if (!equipment || !segment) {
      setStatusMessage("Aligner sur tube : sélectionner un équipement et un tube de référence");
      return;
    }
    const a = nodes.find((node) => node.id === segment.fromNodeId);
    const b = nodes.find((node) => node.id === segment.toNodeId);
    if (!a || !b) return;
    const vx = b.x - a.x, vy = b.y - a.y, vz = b.z - a.z;
    const l2 = vx * vx + vy * vy + vz * vz || 1;
    const t = clamp(((equipment.x - a.x) * vx + (equipment.y - a.y) * vy + (equipment.z - a.z) * vz) / l2, 0, 1);
    const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
    const nextNodes = nodes.map((node) =>
      node.id === equipment.id
        ? {
            ...node,
            x: Number((a.x + vx * t).toFixed(3)),
            y: Number((a.y + vy * t).toFixed(3)),
            z: Number((a.z + vz * t).toFixed(3)),
            rotation: ((((angle % 360) + 360) % 360)),
          }
        : node,
    );
    commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
    setStatusMessage("Équipement aligné graphiquement sur le tube — réseau non modifié");
  };

  const makeSelectedSegmentsParallel = (pivotAnchor: "from" | "to" | "midpoint" = "from") => {
    // 017Q : Parallélisme universel direct (2 tronçons, 3 tronçons, N tronçons)
    // avec choix d'ancrage pivot et préservation rigoureuse de la longueur de tube.
    const res = performUniversalParallel({
      nodes,
      segments,
      selectedSegmentIds,
      pivotAnchor,
      snapToIsoAxis: true,
      preserveDirectionSense: true,
    });

    setStatusMessage(res.message);
    if (!res.success) return;
    if (res.affectedSegmentCount > 0) {
      commitGraph(res.nextNodes, recalcSegmentLengths(res.nextNodes, segments));
    }
  };

  const redressIsoSelection = () => {
    const ids = selectedSegmentIds.length ? selectedSegmentIds : selectedSegmentId ? [selectedSegmentId] : [];
    if (!ids.length) {
      setStatusMessage("Redresser ISO : sélectionner un ou plusieurs tubes");
      return;
    }
    let nextNodes = nodes.map((node) => ({ ...node }));
    ids.forEach((segmentId) => {
      const segment = segments.find((item) => item.id === segmentId);
      if (!segment) return;
      const a = nextNodes.find((node) => node.id === segment.fromNodeId);
      const b = nextNodes.find((node) => node.id === segment.toNodeId);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const length = Math.max(0.05, Math.hypot(dx, dy, dz));
      const abs = { x: Math.abs(dx), y: Math.abs(dy), z: Math.abs(dz) };
      let nx = 0, ny = 0, nz = 0;
      if (abs.z >= abs.x && abs.z >= abs.y) nz = dz >= 0 ? 1 : -1;
      else if (abs.x >= abs.y) nx = dx >= 0 ? 1 : -1;
      else ny = dy >= 0 ? 1 : -1;
      nextNodes = nextNodes.map((node) =>
        node.id === b.id
          ? {
              ...node,
              x: Number((a.x + nx * length).toFixed(3)),
              y: Number((a.y + ny * length).toFixed(3)),
              z: Number((a.z + nz * length).toFixed(3)),
            }
          : node,
      );
    });
    commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
    setStatusMessage("Redressement ISO appliqué : axes 30° / 150° / vertical");
  };

  const removeSelectedDimensions = () => {
    if (!dimensions.length) return;
    setDimensions((prev) => prev.slice(0, -1));
    setStatusMessage("Dernière cotation supprimée");
  };

  const findSegmentAtScreen=(sx:number,sy:number)=>{
    let best:{id:string;t:number;distance:number}|null=null;
    for(const s of segments){
      const a=nodes.find(n=>n.id===s.fromNodeId),b=nodes.find(n=>n.id===s.toNodeId);
      if(!a||!b)continue;
      const p1=iso(a),p2=iso(b),dx=p2.x-p1.x,dy=p2.y-p1.y,l2=dx*dx+dy*dy;
      if(!l2)continue;
      const t=clamp(((sx-p1.x)*dx+(sy-p1.y)*dy)/l2,0,1);
      const qx=p1.x+t*dx,qy=p1.y+t*dy,distance=Math.hypot(sx-qx,sy-qy);
      if(distance<16&&(!best||distance<best.distance))best={id:s.id,t,distance};
    }
    return best;
  };

  const createTeeFromPointer=(e:React.PointerEvent<SVGSVGElement>)=>{
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
    const hit = findSegmentAtScreen(sx, sy);
    if (hit) {
      const seg = segments.find(s => s.id === hit.id);
      const id = insertEquipmentNode(hit.id, "te_egal", hit.t, "Té DN" + (seg?.dn || newDN));
      setStatusMessage("Té inséré et connecté sur le tronçon");
      return id;
    }
    const w = screenToIsoWorld(e, nodeZ || 0);
    const node = makeEquipmentNode("te_egal", `Té N${nodes.length + 1}`, pdiCreatePoint(w).x, pdiCreatePoint(w).y, pdiCreatePoint(w).z, newDN, 0);
    const nextNodes = [...nodes, node];
    commitGraph(nextNodes, segments);
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
    setStatusMessage("Té créé (3 ports) — tirer depuis le port 3 (dérivation) pour créer la branche");
    return node.id;
  };

  const createNodeFromPointer=(e:React.PointerEvent<SVGSVGElement>)=>{
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
    const hit = findSegmentAtScreen(sx, sy);
    if (hit) {
      const s = segments.find(x => x.id === hit.id);
      if (s) {
        const a = nodes.find(n => n.id === s.fromNodeId);
        const b = nodes.find(n => n.id === s.toNodeId);
        if (a && b) {
          const t = clamp(hit.t, 0, 1);
          const p = pointOnSegment(a, b, t);
          const newNode = makeNode(`N${nodes.length + 1}`, Number(p.x.toFixed(3)), Number(p.y.toFixed(3)), Number(p.z.toFixed(3)), "normal");
          const l1 = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
          const l2 = Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z);
          const s1 = { ...cloneSegmentBetween(s, a.id, newNode.id, l1, s.type), fromPortId: s.fromPortId, toPortId: availablePortId(newNode, [], 0) };
          const s2 = { ...cloneSegmentBetween(s, newNode.id, b.id, l2, s.type), fromPortId: availablePortId(newNode, [], 1), toPortId: s.toPortId };
          const nextNodes = [...nodes, newNode];
          const nextSegments = recalcSegmentLengths(nextNodes, [...segments.filter(x => x.id !== s.id), s1, s2]);
          commitGraph(nextNodes, nextSegments);
          setSelectedNodeId(newNode.id);
          setSelectedNodeIds([newNode.id]);
          setStatusMessage("Point inséré sur le tronçon existant");
          return newNode.id;
        }
      }
    }
    const w = screenToIsoWorld(e, nodeZ || 0);
    const n = makeNode(`N${nodes.length + 1}`, pdiCreatePoint(w).x, pdiCreatePoint(w).y, pdiCreatePoint(w).z, "normal");
    const nextNodes = [...nodes, n];
    commitGraph(nextNodes, segments);
    setSelectedNodeId(n.id);
    setSelectedNodeIds([n.id]);
    setStatusMessage(`Nœud N${nodes.length + 1} créé à (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, Z=${n.z.toFixed(2)}m)`);
    return n.id;
  };


  const elbowOrientationFromSegment = (segmentId: string | null, fallback = 0) => {
    if (!segmentId) return fallback;
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) return fallback;
    const a = nodes.find((node) => node.id === segment.fromNodeId);
    const b = nodes.find((node) => node.id === segment.toNodeId);
    if (!a || !b) return fallback;
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return Number((((angle % 360) + 360) % 360).toFixed(1));
  };

  const createElbowFromPointer=(e:React.PointerEvent<SVGSVGElement>)=>{
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
    const hit = findSegmentAtScreen(sx, sy);
    if (hit) {
      const seg = segments.find(s => s.id === hit.id);
      const id = insertEquipmentNode(hit.id, "coude_90", hit.t, "Coude 90° DN" + (seg?.dn || newDN));
      const orient = elbowOrientationFromSegment(hit.id, 0);
      setNodes(prev => prev.map(n => n.id === id ? { ...n, rotation: orient } : n));
      setStatusMessage(`Coude 90° inséré sur le tronçon — orientation ${Math.round(orient)}°`);
      return id;
    }
    const w = screenToIsoWorld(e, nodeZ || 0);
    const node = makeEquipmentNode("coude_90", `Coude 90° N${nodes.length + 1}`, pdiCreatePoint(w).x, pdiCreatePoint(w).y, pdiCreatePoint(w).z, newDN, elbowOrientationFromSegment(selectedSegmentId, 0));
    const nextNodes = [...nodes, node];
    commitGraph(nextNodes, segments);
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
    setStatusMessage("Coude 90° placé — raccorder ses ports");
    return node.id;
  };

  // createSegmentFromNodes is implemented at core module level

  const createSegmentFromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const nodeEl = target.closest("[data-iso-node='true']");
    const clickedNodeId = nodeEl?.getAttribute("data-node-id");

    const portEl = target.closest("[data-iso-port='true']");
    const portNodeId = portEl?.getAttribute("data-port-node-id");
    const portIdx = portEl ? Number(portEl.getAttribute("data-port-idx") || "0") : undefined;

    let targetNodeId = clickedNodeId || portNodeId;
    let targetPortId: string | undefined = undefined;

    const w = screenToIsoWorld(e, nodeZ || 0);
    const pt = activeSnap ? activeSnap.worldPos : pdiCreatePoint(w);

    // Si clic sur un segment en mode tube : couper le segment pour insérer un nœud de dérivation
    if (!targetNodeId) {
      const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
      const hit = findSegmentAtScreen(sx, sy);
      if (hit) {
        const seg = segments.find(s => s.id === hit.id);
        if (seg) {
          const a = nodes.find(n => n.id === seg.fromNodeId);
          const b = nodes.find(n => n.id === seg.toNodeId);
          if (a && b) {
            const t = clamp(hit.t, 0, 1);
            const p = pointOnSegment(a, b, t);
            const insNode = makeNode(`N${nodes.length + 1}`, Number(p.x.toFixed(3)), Number(p.y.toFixed(3)), Number(p.z.toFixed(3)), "normal");
            const l1 = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
            const l2 = Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z);
            const s1 = { ...cloneSegmentBetween(seg, a.id, insNode.id, l1, seg.type), fromPortId: seg.fromPortId, toPortId: availablePortId(insNode, [], 0) };
            const s2 = { ...cloneSegmentBetween(seg, insNode.id, b.id, l2, seg.type), fromPortId: availablePortId(insNode, [], 1), toPortId: seg.toPortId };
            const nextNodes = [...nodes, insNode];
            const nextSegments = recalcSegmentLengths(nextNodes, [...segments.filter(x => x.id !== seg.id), s1, s2]);
            commitGraph(nextNodes, nextSegments);
            targetNodeId = insNode.id;
          }
        }
      }
    }

    // Snap de proximité aux nœuds existants
    if (!targetNodeId) {
      const snapDist = 0.4 / viewport.zoom;
      const nearby = nodes.find(
        (n) => Math.hypot(n.x - pt.x, n.y - pt.y, (n.z || 0) - (pt.z || 0)) < snapDist
      );
      if (nearby) {
        targetNodeId = nearby.id;
      }
    }

    // Si toujours aucun nœud existant : en créer un nouveau aux coordonnées mondes
    if (!targetNodeId) {
      const newNode = makeNode(
        `N${nodes.length + 1}`,
        Number(pt.x.toFixed(3)),
        Number(pt.y.toFixed(3)),
        Number((pt.z ?? (nodeZ || 0)).toFixed(3)),
        "normal"
      );
      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      targetNodeId = newNode.id;
    }

    // Étape 1 : Si pas de départ défini, ce nœud est le départ
    if (!drawStartNodeId) {
      setDrawStartNodeId(targetNodeId);
      setSelectedNodeId(targetNodeId);
      setSelectedNodeIds([targetNodeId]);
      setStatusMessage(`Point 1 fixé (${nodes.find(n => n.id === targetNodeId)?.name || targetNodeId}). Cliquez le point 2 pour créer le tube (ou Échap).`);
      setAutocadPrompt("TUBE [Étape 2/2] : Cliquez le point d'arrivée pour créer le tube");
      return targetNodeId;
    }

    // Étape 2 : Création du tube entre drawStartNodeId et targetNodeId
    if (drawStartNodeId === targetNodeId) {
      setStatusMessage("Point de départ déjà sélectionné. Cliquez sur un autre nœud pour créer le tube.");
      return;
    }

    const createdSegId = createSegmentFromNodes(drawStartNodeId, targetNodeId);
    if (createdSegId) {
      setDrawStartNodeId(targetNodeId); // Chaînage immédiat pour continuité du tracé
    }
    return createdSegId;
  };

  const insertGraphicFitting=(segmentId:string,type:IsoFittingType,position:number)=>{
    insertEquipmentNode(segmentId,type,position,FITTING_LABELS[type]);
  };

  const handleNodeV4Click=(id:string)=>{
    if (alignWizard) {
      selectNodeV44(id, false);
      return;
    }
    if(isoDrawMode==="segment"){
      handleNodeClickForTube(id);
      return;
    }
    if(isoDrawMode==="te"){
      if(!drawStartNodeId){setDrawStartNodeId(id);setSelectedNodeId(id);return;}
      createSegmentFromNodes(drawStartNodeId,id);
      setDrawStartNodeId(null);
      return;
    }
    setSelectedNodeId(id);
  };

  const loadPresetPoste=()=>{
    const a=makeNode("Entrée poste",0,0,0,"entree_poste");
    const b=makeNode("Sortie poste",12,0,0,"sortie_poste");
    const s:IsoSegment={id:uid("seg"),fromNodeId:a.id,toNodeId:b.id,dn:150,pn:"PN40",
      material:"Acier API 5L Gr. B",length:12,type:"straight",fittings:[
        makeFitting("jmi",.08,150),makeFitting("vanne_passage_total",.12,150)
      ]};
    commitGraph([a,b], [s]); setFromNode(a.id); setToNode(b.id);
    setSelectedSegmentId(s.id); resetView();
  };

  const loadPresetGare=()=>{
    const a=makeNode('Entrée gazoduc DN700 (28")',0,0,0,"entree_poste");
    const b=makeNode("Té de piquage",6,0,0,"piquage");
    const c=makeNode("Gare racleur départ",8,3,.8,"gare_depart");
    const d=makeNode("Sas racleur",14,3,.8,"gare_depart");
    const s1:IsoSegment={id:uid("seg"),fromNodeId:a.id,toNodeId:b.id,dn:700,pn:"Class 600",
      material:"Acier API 5L X52",length:6,type:"straight",
      fittings:[makeFitting("vanne_passage_total",.45,700),makeFitting("te_reduit",.95,700)]};
    const s2:IsoSegment={id:uid("seg"),fromNodeId:b.id,toNodeId:c.id,dn:600,pn:"Class 600",
      material:"Acier API 5L X52",length:3.5,type:"riser",
      fittings:[makeFitting("coude_90",.8,600),makeFitting("piquage",.3,600)]};
    const s3:IsoSegment={id:uid("seg"),fromNodeId:c.id,toNodeId:d.id,dn:600,pn:"Class 600",
      material:"Acier API 5L X52",length:6,type:"straight",
      fittings:[makeFitting("gare_racleur_depart",.25,600),makeFitting("event",.7,600)]};
    commitGraph([a,b,c,d], [s1,s2,s3]); setFromNode(a.id); setToNode(b.id);
    setSelectedSegmentId(s1.id); resetView();
  };

  const loadPresetDemoComplexe = () => {
    const demo = generateComplexIndustrialIsoDemo();
    commitGraph(
      demo.nodes,
      demo.segments,
      demo.lines,
      demo.dimensions,
      demo.cad2dEntities,
      cad2dLayers,
      demo.supports
    );
    setCad2dLayers(demo.cad2dLayers);
    setFromNode(demo.nodes[0]?.id || "");
    setToNode(demo.nodes[demo.nodes.length - 1]?.id || "");
    setSelectedSegmentId(demo.segments[0]?.id || null);
    setSelectedSupportId(demo.supports[0]?.id || null);
    setStatusMessage("✨ Démo Industrielle Complète chargée : Réseau 3D, By-Pass, 26 raccords, 10 supports MSS SP-58 / GC, cotations et cartouche.");
    setAutocadPrompt("COMMANDE [DEMO] : Réseau complet chargé (ASME B31.3 / MSS SP-58). Inspectez les onglets BOM, Supports & GC.");
    setTimeout(() => {
      resetView();
    }, 60);
  };

  const loadPresetChambreTechnique = () => {
    const demo = generateChambreTechniqueDemo();
    commitGraph(
      demo.nodes,
      demo.segments,
      demo.lines,
      demo.dimensions,
      demo.cad2dEntities,
      cad2dLayers,
      demo.supports
    );
    setCad2dLayers(demo.cad2dLayers);
    setFromNode(demo.nodes[0]?.id || "");
    setToNode(demo.nodes[demo.nodes.length - 1]?.id || "");
    setSelectedSegmentId(demo.segments[0]?.id || null);
    setSelectedSupportId(demo.supports[0]?.id || null);
    setEnvelopeActive(demo.envelopeActive);
    setEnvelopeLength(demo.envelopeLength);
    setEnvelopeWidth(demo.envelopeWidth);
    setEnvelopeHeight(demo.envelopeHeight);
    setEnvelopeX(demo.envelopeX);
    setEnvelopeY(demo.envelopeY);
    setEnvelopeZ(demo.envelopeZ);
    setEnvelopePreset(demo.envelopePreset);
    setStatusMessage("✨ Démo Chambre Technique chargée : 2 lignes d'eau glacée parallèles DN100 (Aller/Retour), vannes, manomètres, supports et cotations.");
    setAutocadPrompt("COMMANDE [DEMO_CT] : Chambre Technique chargée. Le gabarit d'espace représente le local.");
    setTimeout(() => {
      resetView();
    }, 60);
  };

  const loadPresetSkidFiltration = () => {
    const demo = generateSkidFiltrationDemo();
    commitGraph(
      demo.nodes,
      demo.segments,
      demo.lines,
      demo.dimensions,
      demo.cad2dEntities,
      cad2dLayers,
      demo.supports
    );
    setCad2dLayers(demo.cad2dLayers);
    setFromNode(demo.nodes[0]?.id || "");
    setToNode(demo.nodes[demo.nodes.length - 1]?.id || "");
    setSelectedSegmentId(demo.segments[0]?.id || null);
    setSelectedSupportId(demo.supports[0]?.id || null);
    setEnvelopeActive(demo.envelopeActive);
    setEnvelopeLength(demo.envelopeLength);
    setEnvelopeWidth(demo.envelopeWidth);
    setEnvelopeHeight(demo.envelopeHeight);
    setEnvelopeX(demo.envelopeX);
    setEnvelopeY(demo.envelopeY);
    setEnvelopeZ(demo.envelopeZ);
    setEnvelopePreset(demo.envelopePreset);
    setStatusMessage("✨ Démo Skid de Filtration chargée : 3 lignes parallèles DN150 (WN Flanges, réducteurs, vannes, patins mss_type_39, cotations).");
    setAutocadPrompt("COMMANDE [DEMO_SKID] : Skid de filtration conforme à isometrie.png chargé.");
    setTimeout(() => {
      resetView();
    }, 60);
  };

  const printIso=()=>{
    const w=window.open("","_blank");if(!w)return;
    const rows=segments.map((s,i)=>`<tr>
      <td style="font-weight:bold;color:#0284c7;">${i+1}</td>
      <td><b>${nodes.find(n=>n.id===s.fromNodeId)?.name||""}</b> → <b>${nodes.find(n=>n.id===s.toNodeId)?.name||""}</b></td>
      <td><span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-weight:bold;">DN${s.dn} (${dia(s.dn).inch})</span></td>
      <td><b>${s.pn}</b></td>
      <td>${s.material}</td>
      <td style="font-weight:bold;color:#0f172a;">${s.length.toFixed(2)} m</td>
      <td style="font-weight:bold;color:#d97706;">${(s.length*dia(s.dn).weight).toFixed(1)} kg</td>
    </tr>`).join("");
    w.document.write(`<!doctype html><html><head><title>Isométrie mécanique — ${projectName}</title>
      <style>
        @page{size:A4 landscape;margin:8mm}
        @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } }
        body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:15px;background:#fff;-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
        h1{color:#0369a1;font-size:18px;border-bottom:2px solid #0284c7;padding-bottom:6px;margin-bottom:8px;}
        .meta{background:#f0f9ff;border:1px solid #0284c7;border-radius:8px;padding:10px;margin-bottom:15px;display:flex;justify-content:space-between;font-size:11px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;}
        th{background:#0369a1;color:white;font-weight:bold;}
        tr:nth-child(even){background:#f8fafc;}
      </style>
      </head><body>
      <h1>${pdiCompanyName()} — SCHÉMA ISOMÉTRIQUE MÉCANIQUE</h1>
      <div class="meta">
        <div><b>Projet :</b> ${projectName} | <b>Région :</b> ${wilaya}</div>
        <div><b>Pression :</b> ${formatPressure(pressDesign, unitSystem)} | <b>Épreuve :</b> ${formatPressure(hydrotest, unitSystem)}</div>
        <div><b>Longueur totale :</b> ${formatLength(totalLength, unitSystem)} | <b>Poids :</b> ${formatMass(totalWeight, unitSystem)} | <b>Convention :</b> ${PDI_METRE_CONVENTION_017P3}</div>
      </div>
      <table><thead><tr><th>N°</th><th>Liaison / Tronçon</th><th>Diamètre</th><th>Classe</th><th>Matériau</th><th>Longueur</th><th>Poids</th></tr></thead><tbody>${rows}</tbody></table>
      <script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
    w.document.close();
  };

  const selected=segments.find(s=>s.id===selectedSegmentId);

  const [isoMode,setIsoMode] = useState<"editor"|"planche">("editor");
  const [gcUnderlay,setGcUnderlay] = useState<string|null>(null);
  const [gcUnderlayName,setGcUnderlayName] = useState("");
  const [gcOpacity,setGcOpacity] = useState(.28);
  const [gcScale,setGcScale] = useState(1);
  const [gcX,setGcX] = useState(0);
  const [gcY,setGcY] = useState(0);
  const [planPage,setPlanPage] = useState<1|2>(1);

  const onGcFile = (file?: File) => {
    if(!file) return;
    if(!/^image\/(png|jpeg|jpg|svg\+xml)$/.test(file.type)) {
      void pdiAlert("Pour la sous-couche V1, exporter le fond GC en PNG/JPG/SVG depuis Croquis/CAD.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setGcUnderlay(String(reader.result || "")); setGcUnderlayName(file.name); };
    reader.readAsDataURL(file);
  };

  const moveFitting = (segmentId:string, fittingId:string, direction:-1|1) => {
    setSegments(prev => prev.map(seg => {
      if(seg.id !== segmentId) return seg;
      const idx=seg.fittings.findIndex(f=>f.id===fittingId), next=idx+direction;
      if(idx<0 || next<0 || next>=seg.fittings.length) return seg;
      const fittings=reorderFittings(seg.fittings,idx,next);
      return {...seg,fittings};
    }));
  };
  const moveFittingTo = (segmentId:string, fittingId:string, targetIndex:number) => {
    setSegments(prev => prev.map(seg => {
      if(seg.id!==segmentId) return seg;
      const idx=seg.fittings.findIndex(f=>f.id===fittingId);
      if(idx<0) return seg;
      return {...seg,fittings:reorderFittings(seg.fittings,idx,clamp(targetIndex,0,seg.fittings.length-1))};
    }));
  };
  const planRows = useMemo(()=>materialRows(nodes,segments),[nodes,segments]);

  const printBomRows: BomRow[] = useMemo(() => {
    return planRows.map((r, i) => ({
      index: i + 1,
      designation: r.designation,
      dn: r.dn,
      inch: r.inch,
      qty: r.qty,
      unit: r.unit,
      length: r.length || 0,
      reference: r.source || "STD",
      fittingType: r.fittingType,
    }));
  }, [planRows]);

  const printPlanSheet = () => {
    setPrintModalOpen(true);
  };

  // -------------------------------------------------------------
  // PD&I 017Q3 : Multi-Screen Foundation Synchronization Logic
  // -------------------------------------------------------------
  const activeUniversalEntity = useMemo<PdiUniversalEntity | null>(() => {
    if (selectedCad2dIds.length === 1) {
      const cad = cad2dEntities.find((c) => c.id === selectedCad2dIds[0]);
      if (cad) return cad2dToUniversalEntity(cad);
    }
    if (selectedSupportId) {
      const sup = supports.find((s) => s.id === selectedSupportId);
      if (sup) {
        const parentSeg = segments.find((seg) => seg.id === sup.segmentId);
        return supportToUniversalEntity(sup, parentSeg);
      }
    }
    if (selectedFitting) {
      const seg = segments.find((s) => s.id === selectedFitting.segmentId);
      const fit = seg?.fittings.find((f) => f.id === selectedFitting.fittingId);
      if (fit && seg) return fittingToUniversalEntity(fit, seg);
    }
    if (selectedSegmentIds.length === 1) {
      const seg = segments.find((s) => s.id === selectedSegmentIds[0]);
      if (seg) {
        const fromN = nodes.find((n) => n.id === seg.fromNodeId);
        const toN = nodes.find((n) => n.id === seg.toNodeId);
        return segmentToUniversalEntity(seg, fromN, toN);
      }
    }
    const targetNodeId = selectedNodeIds[0] || selectedFittingIds[0];
    if (targetNodeId) {
      const node = nodes.find((n) => n.id === targetNodeId);
      if (node) return nodeToUniversalEntity(node, segments);
    }
    return null;
  }, [selectedCad2dIds, cad2dEntities, selectedSupportId, supports, selectedFitting, selectedSegmentIds, segments, selectedNodeIds, selectedFittingIds, nodes]);

  // Initialisation du bus et gestion des réceptions multi-écrans
  useEffect(() => {
    pdiWorkspaceBus.setRole(true);
    const unbindConn = pdiWorkspaceBus.onConnectionChange((connected) => {
      setIsSecondaryConnected(connected);
    });

    const unbindMsg = pdiWorkspaceBus.subscribe((msg) => {
      if (msg.type === "PDI_WS_HELLO_SECONDARY") {
        setIsSecondaryConnected(true);
        const fullState: PdiWorkspaceState = {
          mode: workspaceConfig.mode,
          profile: workspaceConfig.profile,
          screen1View: workspaceConfig.screen1View,
          screen2View: workspaceConfig.screen2View,
          selection: {
            selectedNodeId: selectedNodeIds[0] || null,
            selectedSegmentId: selectedSegmentIds[0] || null,
            selectedSupportId: selectedSupportId || null,
            selectedComponentId: selectedFittingIds[0] || null,
            selectedWeldId: null,
            selectedSpoolId: activeSpoolFilter || null,
            selectedType: selectedSegmentIds.length ? "segment" : selectedNodeIds.length ? "node" : selectedSupportId ? "support" : null,
            timestamp: Date.now(),
          },
          activeEntity: activeUniversalEntity || null,
          modelSnapshot: {
            projectName,
            projectId: projectId || projectIdRef.current,
            unitSystem: unitSystem === "imperial" ? "imperial" : "metric",
            nodes,
            segments,
            supports,
            welds: weldSpoolData.welds,
            spools: weldSpoolData.spools,
            bomRows: printBomRows,
            updatedAt: new Date().toISOString(),
          },
          displayPreferences: {
            theme: "dark",
            showGrid: showGrid,
            showDimensions: showDimensions,
            showWelds: showWelds,
            showSupports: true,
            showTags: tagDisplay,
          },
          secondaryConnected: true,
          lastUpdateTimestamp: Date.now(),
        };
        pdiWorkspaceBus.broadcastFullState(fullState, "primary");
        pdiWorkspaceBus.broadcastModelUpdate(fullState.modelSnapshot, "primary");
      } else if (msg.type === "PDI_WS_SELECTION_CHANGE" && msg.sender === "secondary") {
        if (msg.selection) {
          if (msg.selection.selectedNodeId) {
            setSelectedNodeIds([msg.selection.selectedNodeId]);
            setSelectedSegmentIds([]);
            setSelectedSupportId(null);
            setSelectedFitting(null);
          } else if (msg.selection.selectedSegmentId) {
            setSelectedSegmentIds([msg.selection.selectedSegmentId]);
            setSelectedNodeIds([]);
            setSelectedSupportId(null);
            setSelectedFitting(null);
          } else if (msg.selection.selectedSupportId) {
            setSelectedSupportId(msg.selection.selectedSupportId);
            setSelectedNodeIds([]);
            setSelectedSegmentIds([]);
            setSelectedFitting(null);
          } else if (msg.selection.selectedSpoolId) {
            setActiveSpoolFilter(msg.selection.selectedSpoolId);
          }
        }
      } else if (msg.type === "PDI_WS_ENTITY_MODIFY" && msg.sender === "secondary" && msg.entity) {
        const ent = msg.entity;
        if (ent.identity?.id) {
          setSegmentsRaw((prev) =>
            prev.map((s) => (s.id === ent.identity.id ? { ...s, dn: ent.dn?.dn || s.dn, material: ent.material?.grade || s.material } : s))
          );
          setNodesRaw((prev) =>
            prev.map((n) => (n.id === ent.identity.id ? { ...n, type: (ent.identity.type as any) || n.type } : n))
          );
        }
      } else if (msg.type === "PDI_WS_CHANGE_VIEW") {
        if (msg.screen2View) {
          setWorkspaceConfig((prev) => ({ ...prev, screen2View: msg.screen2View }));
          if (msg.screen2View === "spool") setRubanOnglet017M("donnees");
          else if (msg.screen2View === "bom") setRubanOnglet017M("donnees");
          else if (msg.screen2View === "properties") setRubanOnglet017M("edition");
          else if (msg.screen2View === "library") setRubanOnglet017M("insertion");
          else if (msg.screen2View === "3d") setRubanOnglet017M("trois_d");
        }
      }
    });

    return () => {
      unbindConn();
      unbindMsg();
    };
  }, [nodes, segments, supports, weldSpoolData, selectedNodeIds, selectedSegmentIds, selectedSupportId, activeSpoolFilter, projectName, projectId, unitSystem, printBomRows, showGrid, showDimensions, showWelds, tagDisplay, workspaceConfig, activeUniversalEntity]);

  // Diffusion de la sélection dès qu'elle change dans l'ISO
  useEffect(() => {
    const selState: PdiWorkspaceSelectionState = {
      selectedNodeId: selectedNodeIds[0] || null,
      selectedSegmentId: selectedSegmentIds[0] || null,
      selectedSupportId: selectedSupportId || null,
      selectedComponentId: selectedFittingIds[0] || null,
      selectedWeldId: null,
      selectedSpoolId: activeSpoolFilter || null,
      selectedType: selectedSegmentIds.length ? "segment" : selectedNodeIds.length ? "node" : selectedSupportId ? "support" : null,
      timestamp: Date.now(),
    };
    pdiWorkspaceBus.broadcastSelection(selState, activeUniversalEntity || null, "primary");
  }, [selectedNodeIds, selectedSegmentIds, selectedSupportId, selectedFittingIds, activeSpoolFilter, activeUniversalEntity]);

  // Diffusion automatique de l'instantané du modèle (uniquement lors de modifications réelles du modèle)
  useEffect(() => {
    if (nodes.length === 0 && !recoveryChecked) {
      return;
    }
    const snapshot: PdiWorkspaceModelSnapshot = {
      projectName,
      projectId: projectId || projectIdRef.current,
      unitSystem: unitSystem === "imperial" ? "imperial" : "metric",
      nodes,
      segments,
      supports,
      welds: weldSpoolData.welds,
      spools: weldSpoolData.spools,
      bomRows: printBomRows,
      updatedAt: new Date().toISOString(),
    };
    pdiWorkspaceBus.saveStateSnapshot({
      mode: workspaceConfig.mode,
      profile: workspaceConfig.profile,
      screen1View: workspaceConfig.screen1View,
      screen2View: workspaceConfig.screen2View,
      selection: {
        selectedNodeId: selectedNodeIds[0] || null,
        selectedSegmentId: selectedSegmentIds[0] || null,
        selectedSupportId: selectedSupportId || null,
        selectedComponentId: selectedFittingIds[0] || null,
        selectedWeldId: null,
        selectedSpoolId: activeSpoolFilter || null,
        selectedType: null,
        timestamp: Date.now(),
      },
      activeEntity: activeUniversalEntity || null,
      modelSnapshot: snapshot,
      displayPreferences: {
        theme: "dark",
        showGrid: showGrid,
        showDimensions: showDimensions,
        showWelds: showWelds,
        showSupports: true,
        showTags: tagDisplay,
      },
      secondaryConnected: isSecondaryConnected,
      lastUpdateTimestamp: Date.now(),
    });

    pdiWorkspaceBus.broadcastModelUpdate(snapshot, "primary");
  }, [nodes, segments, supports, weldSpoolData, printBomRows, projectName, projectId, unitSystem, recoveryChecked]);


  const buildProjectFileV474=():IsoProjectFileV474=>{
    const now=new Date().toISOString();
    return {schemaVersion:"4.7.4",exportedAt:now,project:{id:projectIdRef.current,ownerUid:userUid||"",name:projectName,wilaya,pressDesign,createdAt:projectCreatedAtRef.current,updatedAt:now,unitSystem},model:{lines,nodes,segments,dimensions,supports,spools:weldSpoolData.spools,welds:weldSpoolData.welds,cad2d:{layers:cad2dLayers,entities:cad2dEntities}},workspace:{showGrid,showDimensions,showPipeLabels,showLabels,showWelds,isoSnapStep,viewport}};
  };

  const applyProjectSnapshot=(snapshot:IsoProjectFileV474,label:string)=>{
    const issues=validateProjectGraph(snapshot.model.nodes,snapshot.model.segments,snapshot.model.lines);
    const blocking=issues.filter(issue=>issue.severity==="error");
    if(blocking.length)throw new Error(`${blocking.length} erreur(s) bloquante(s): ${blocking.slice(0,3).map(issue=>issue.code).join(", ")}`);
    historyBusyRef.current=true;
    setNodesRaw(snapshot.model.nodes);setSegmentsRaw(snapshot.model.segments);setLinesRaw(snapshot.model.lines);
    setDimensionsRaw(snapshot.model.dimensions || []);
    setSupportsRaw(snapshot.model.supports || []);
    setSelectedSupportId(null);
    setCad2dLayers(snapshot.model.cad2d?.layers || [
      { id: "axes_tuyauterie", name: "Axes tuyauterie", color: "#9CA3AF", visible: true, locked: false },
      { id: "annotations", name: "Annotations", color: "#9CA3AF", visible: true, locked: false },
      { id: "import_cad", name: "Import CAD / fond plan", color: "#888888", visible: true, locked: false },
    ]);
    setCad2dEntities(snapshot.model.cad2d?.entities || []);
    setSelectedCad2dIds([]);
    projectIdRef.current=snapshot.project.id;projectCreatedAtRef.current=snapshot.project.createdAt;
    setProjectName(snapshot.project.name);setWilaya(snapshot.project.wilaya);setPressDesign(snapshot.project.pressDesign);
    if (snapshot.project.unitSystem) setUnitSystem(snapshot.project.unitSystem);
    setShowGrid(snapshot.workspace.showGrid);setShowDimensions(snapshot.workspace.showDimensions);setShowPipeLabels(snapshot.workspace.showPipeLabels);setShowLabels(snapshot.workspace.showLabels);setShowWelds(snapshot.workspace.showWelds);setIsoSnapStep(snapshot.workspace.isoSnapStep);setViewport(snapshot.workspace.viewport);
    clearSelection();setTimeout(()=>{historyBusyRef.current=false;},0);setStatusMessage(label);
  };

  const exportCivilMtoCsv=()=>{
    if (!supports.length) {
      void pdiAlert("Aucun support n'est actuellement présent sur le plan.");
      return;
    }
    const headers = "TAG,TYPE_MSS,STANDARD,DN_TUBE,DISTANCE_M,ELEVATION_Z_M,PLATINE_L_MM,PLATINE_W_MM,PLATINE_T_MM,NUANCE_ACIER,POIDS_PLATINE_KG,GOUJONS_TYPE,DIAMETRE_ANCRAGE,NB_GOUJONS,PROFONDEUR_MM,MASSIF_TYPE,BETON_L_M,BETON_W_M,BETON_H_M,VOL_BETON_M3,CLASSE_BETON\n";
    const rows = supports.map((s) => {
      const def = MSS_SUPPORT_CATALOG[s.type];
      const seg = segments.find((sg) => sg.id === s.segmentId);
      const c = s.civilSpec;
      return `"${s.tag}","${def?.labelFr || s.type}","MSS SP-58 Type ${def?.mssStandardNumber || 0}",${seg?.dn || 100},${s.distanceFromFromNodeM.toFixed(2)},${s.elevationZ.toFixed(2)},${c.basePlateLengthMm},${c.basePlateWidthMm},${c.basePlateThicknessMm},"${c.steelGrade}",${c.calculatedPlateWeightKg.toFixed(2)},"${c.anchorType}","${c.anchorDiameter}",${c.anchorCount},${c.anchorEmbedmentDepthMm},"${c.foundationType}",${c.foundationLengthM.toFixed(2)},${c.foundationWidthM.toFixed(2)},${c.foundationHeightM.toFixed(2)},${c.calculatedConcreteVolumeM3.toFixed(3)},"${c.concreteGrade}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdi_supports_gc_${projectName.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "projet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("MTO Supportage & Génie Civil exporté en CSV");
  };

  const exportProjectJson=()=>{
    const currentProject = buildProjectFileV474();
    const payload=pdiSignExportData(currentProject);
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=`${projectName.replace(/[^a-z0-9]+/gi,"_").toLowerCase()||"projet_iso"}_v474.json`;a.click();URL.revokeObjectURL(url);
    setSaveState("autosaved");setLastSavedAt(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));setStatusMessage("Téléchargement du projet JSON démarré");
  };



  const exportProjectAsDxf = () => {
    const dxfContent = generateDxfFile(nodes, segments);
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = projectName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "plan_tuyauterie";
    a.href = url;
    a.download = `${safeTitle}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Projet exporté en DXF");
  };

  const getSvgMarkupForExport = () => {
    const paperConfig = {
      ...DEFAULT_PRINT_CONFIG,
      documentTitle: projectName,
      companyName: "PD&I",
    };
    const res = generateIsoDrawingSvg(
      nodes,
      segments,
      dimensions,
      projectJoints,
      printBomRows,
      paperConfig,
      supports,
      cad2dEntities,
      weldSpoolData
    );
    return res.svgMarkup;
  };

  const exportProjectAsSvg = () => {
    const markup = getSvgMarkupForExport();
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = projectName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "plan_tuyauterie";
    a.href = url;
    a.download = `${safeTitle}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Projet exporté en SVG");
  };

  const exportProjectAsRaster = (type: "png" | "jpeg") => {
    const markup = getSvgMarkupForExport();
    const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1684;
      canvas.height = 1191;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (type === "jpeg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL(type === "png" ? "image/png" : "image/jpeg", 0.95);
        const a = document.createElement("a");
        const safeTitle = projectName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "plan_tuyauterie";
        a.href = dataUrl;
        a.download = `${safeTitle}.${type}`;
        a.click();
        setStatusMessage(`Projet exporté en ${type.toUpperCase()}`);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      exportProjectAsSvg();
    };
    img.src = url;
  };

  const importProjectJson=(file?:File)=>{
    if(!file)return;
    const effectiveUid = userUid || resolveStableUid() || "local-session";
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const rawContent = String(reader.result || "");
        if (!rawContent.trim()) {
          throw new Error("Fichier vide");
        }
        const parsed = JSON.parse(rawContent);
        const migrated = migrateProjectFileV474(parsed, effectiveUid);
        const snapshot: IsoProjectFileV474 = {
          ...migrated,
          project: {
            ...migrated.project,
            ownerUid: effectiveUid,
          },
        };
        applyProjectSnapshot(snapshot, `Projet ${snapshot.schemaVersion} chargé`);
        void pdiAlert(`Import terminé\n\n${snapshot.model.nodes.length} nœuds\n${snapshot.model.segments.length} tronçons\n${snapshot.model.lines.length} ligne(s)\n\nMigration et validation réussies.`);
      } catch(error) {
        // En cas d'erreur ou d'invalidation, le projet courant reste STRICTEMENT intact. Aucune démo n'est chargée.
        void pdiAlert(`Import impossible: ${error instanceof Error ? error.message : "fichier invalide"}`);
      }
    };
    reader.readAsText(file);
  };

  const persistenceFingerprint=(snapshot:IsoProjectFileV474)=>JSON.stringify({
    project:{id:snapshot.project.id,ownerUid:snapshot.project.ownerUid,name:snapshot.project.name,wilaya:snapshot.project.wilaya,pressDesign:snapshot.project.pressDesign,createdAt:snapshot.project.createdAt},
    model:snapshot.model,
    workspace:snapshot.workspace,
  });

  useEffect(()=>{
    if(!authReady)return;
    setRecoveryCandidate(null);setRecoverySource(null);setRecoveryFailure(null);setRecoveryChecked(false);
    // Le projet vide affiché au démarrage devient la référence non modifiée.
    autosaveBaselineRef.current=persistenceFingerprint(buildProjectFileV474());
    if(!userUid){
      setSaveState("error");setStatusMessage("Autosauvegarde suspendue · utilisateur non identifié");setRecoveryChecked(true);return;
    }
    // PATCH 017F1 : migration unique de l ancienne archive globale du profil
    // vers le projet par defaut, pour ne perdre aucun plan existant.
    try{
      if(activeProjectKey==="default"&&!localStorage.getItem(AUTOSAVE_CURRENT_KEY)){
        const legacyScoped=localStorage.getItem(`isometrie.autosave.v474.user.${userUid}.current`);
        if(legacyScoped)localStorage.setItem(AUTOSAVE_CURRENT_KEY,legacyScoped);
      }
    }catch{}
    let invalidFound=false;
    const tryLoad=(raw:string|null,source:"current"|"previous"|"legacy",storageKey:string)=>{
      if(!raw)return null;
      try{
        const snapshot=migrateProjectFileV474(JSON.parse(raw),userUid);
        if(snapshot.project.ownerUid!==userUid)throw new Error("Archive appartenant à un autre profil");
        // Un snapshot 0/0 créé automatiquement n'est pas une session récupérable.
        if(snapshot.model.nodes.length===0&&snapshot.model.segments.length===0){
          localStorage.removeItem(storageKey);
          return null;
        }
        return {snapshot,source};
      }catch{
        invalidFound=true;
        if(source==="current")localStorage.setItem(AUTOSAVE_CORRUPT_KEY,raw);
        return null;
      }
    };
    const currentRaw=localStorage.getItem(AUTOSAVE_CURRENT_KEY);
    let recovered=tryLoad(currentRaw,"current",AUTOSAVE_CURRENT_KEY);
    if(!recovered&&currentRaw)setStatusMessage("Sauvegarde actuelle inutilisable · recherche de la précédente");
    if(!recovered)recovered=tryLoad(localStorage.getItem(AUTOSAVE_PREVIOUS_KEY),"previous",AUTOSAVE_PREVIOUS_KEY);
    if(recovered&&recovered.source==="current"){
      // PATCH 017E : la session courante est restauree silencieusement.
      // Auparavant il fallait confirmer une fenetre de recuperation, donc un
      // simple F5 affichait un plan vide.
      try{
        applyProjectSnapshot(recovered.snapshot,"Session restauree automatiquement");
        autosaveBaselineRef.current=persistenceFingerprint(recovered.snapshot);
        setSaveState("autosaved");
      }catch{
        setRecoveryCandidate(recovered.snapshot);setRecoverySource(recovered.source);
      }
    }else if(recovered){
      setRecoveryCandidate(recovered.snapshot);setRecoverySource(recovered.source);
      if(recovered.source==="previous")setStatusMessage("Sauvegarde précédente récupérée");
    }else if(invalidFound){
      setRecoveryFailure("Aucune sauvegarde locale valide n’a pu être récupérée.");
      setSaveState("error");setStatusMessage("Archives locales illisibles · autosauvegarde suspendue");
    }else{
      setSaveState("idle");
      const legacyExists=[UNSCOPED_AUTOSAVE_CURRENT_KEY,UNSCOPED_AUTOSAVE_PREVIOUS_KEY,UNSCOPED_AUTOSAVE_V47_KEY,UNSCOPED_AUTOSAVE_CORRUPT_KEY].some(key=>Boolean(localStorage.getItem(key)));
      setStatusMessage(legacyExists?"Nouvelle session prête · archive globale ignorée":"Nouvelle session prête");
    }
    setRecoveryChecked(true);
  },[authReady,userUid]);

  useEffect(()=>{
    if(!authReady||!userUid||!recoveryChecked||recoveryCandidate||recoveryFailure)return;
    const snapshot=buildProjectFileV474();
    const fingerprint=persistenceFingerprint(snapshot);
    if(autosaveBaselineRef.current===null){autosaveBaselineRef.current=fingerprint;return;}
    if(fingerprint===autosaveBaselineRef.current){
      if(!localStorage.getItem(AUTOSAVE_CURRENT_KEY))setSaveState("idle");
      return;
    }
    setSaveState("modified");
    const timer=setTimeout(()=>{try{
      const serialized=JSON.stringify(snapshot),previous=localStorage.getItem(AUTOSAVE_CURRENT_KEY);
      if(previous&&previous!==serialized)localStorage.setItem(AUTOSAVE_PREVIOUS_KEY,previous);
      localStorage.setItem(AUTOSAVE_CURRENT_KEY,serialized);
      autosaveBaselineRef.current=fingerprint;
      const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
      setLastSavedAt(time);setSaveState("autosaved");
    }catch{setSaveState("error");}},700);
    return()=>clearTimeout(timer);
  }, [authReady, userUid, recoveryChecked, recoveryCandidate, recoveryFailure, projectName, wilaya, pressDesign, lines, nodes, segments, dimensions, cad2dEntities, cad2dLayers, projectSetup, showGrid, showDimensions, showPipeLabels, showLabels, showWelds, isoSnapStep, viewport, workspaceVisualStyle]);

  // PATCH 017E : sauvegarde immediate avant fermeture ou rechargement (F5).
  // L autosauvegarde differee de 700 ms pouvait perdre les dernieres actions.
  useEffect(()=>{
    if(!authReady||!userUid||!recoveryChecked||recoveryCandidate||recoveryFailure)return;
    const flush=()=>{
      try{
        const snapshot=buildProjectFileV474();
        if(snapshot.model.nodes.length===0&&snapshot.model.segments.length===0)return;
        const serialized=JSON.stringify(snapshot);
        const previous=localStorage.getItem(AUTOSAVE_CURRENT_KEY);
        if(previous&&previous!==serialized)localStorage.setItem(AUTOSAVE_PREVIOUS_KEY,previous);
        localStorage.setItem(AUTOSAVE_CURRENT_KEY,serialized);
      }catch{}
    };
    const onVisibility=()=>{if(document.visibilityState==="hidden")flush();};
    window.addEventListener("beforeunload",flush);
    window.addEventListener("pagehide",flush);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      window.removeEventListener("beforeunload",flush);
      window.removeEventListener("pagehide",flush);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[authReady,userUid,recoveryChecked,recoveryCandidate,recoveryFailure,projectName,lines,nodes,segments,dimensions,cad2dEntities,cad2dLayers,projectSetup,viewport]);

  // ÉTAPE 5 : Passerelle d'injection Croquis/Scan A4-A3 -> Éditeur ISO via useIsoInjection
  useIsoInjection({
    onCommit: (payload: any, sourceName?: string) => {
      if (!payload) return;
      const nodesToCommit: IsoNode[] = payload.nodes || [];
      const segmentsToCommit: IsoSegment[] = payload.segments || [];
      const linesToCommit: PipingLine[] = payload.lines || lines;
      const dimensionsToCommit: IsoDimension[] = payload.dimensions || [];
      const cadEntities = payload.cad2d?.entities || [];
      const cadLayers = payload.cad2d?.layers || cad2dLayers;
      const supportsToCommit: IsoPipingSupport[] = payload.supports || [];

      if (nodesToCommit.length > 0) {
        commitGraph(
          nodesToCommit,
          segmentsToCommit,
          linesToCommit,
          dimensionsToCommit,
          cadEntities,
          cadLayers,
          supportsToCommit
        );

        if (payload.name || sourceName) {
          setProjectName(payload.name || sourceName || "Projet Isométrique");
        }
        setShowDimensions(true);
        setShowPipeLabels(true);
        setShowWelds(true);
        setShowGrid(true);

        setTimeout(() => {
          resetView(nodesToCommit, segmentsToCommit, dimensionsToCommit, cadEntities);
        }, 50);

        setTimeout(() => {
          resetView(nodesToCommit, segmentsToCommit, dimensionsToCommit, cadEntities);
        }, 250);

        if (payload.open3d !== false) {
          setTimeout(() => {
            setSolid3dViewerOpen(true);
          }, 250);
        }

        setStatusMessage("✅ Isométrie 2D cotée & Vue 3D solide générées depuis le croquis A4/A3");
      }
    },
  });

  const runWorkspaceCommand=(action:()=>void,label:string)=>{action();setCommandPaletteOpen(false);setStatusMessage(label);};

  // PATCH 006 — universal CAD toolbar.
  // Outils universels préparés sans créer de second moteur 2D : les actions non
  // encore reliées au graphe V4.8d affichent un état explicite, pas une fausse logique.
  const cadToolPrepared = (label: string) => {
    setInteractionMode("select");
    setIsoDrawMode("select");
    setStatusMessage(`${label} préparé · moteur 2D canonique prévu patch 007`);
  };
  const selectedEquipmentNodes=nodes.filter(n=>selectedNodeIds.includes(n.id)&&n.equipmentType);
  const libraryItems=FITTING_TYPES.filter(t=>(FITTING_LABELS[t]+" "+t).toLowerCase().includes(libraryQuery.toLowerCase()));

  const dropEquipmentOnCanvas=(e:React.DragEvent<SVGSVGElement>)=>{
    e.preventDefault();
    const raw=e.dataTransfer.getData("application/x-iso-equipment")||e.dataTransfer.getData("text/plain");
    if(!FITTING_TYPES.includes(raw as IsoFittingType))return;
    const type=raw as IsoFittingType;
    const { sx, sy } = getSvgCoordinates(e.clientX, e.clientY, svgRef.current || (e.currentTarget as unknown as SVGSVGElement));
    const hit=findSegmentAtScreen(sx,sy);
    const dropKey=`${type}:${hit?.id||"canvas"}:${Math.round((hit?.t||0)*100)}`;
    const previousDrop=lastEquipmentDropRef.current;
    if(previousDrop&&previousDrop.key===dropKey&&Date.now()-previousDrop.at<600)return;
    lastEquipmentDropRef.current={key:dropKey,at:Date.now()};
    if(hit){
      insertEquipmentNode(hit.id,type,hit.t,FITTING_LABELS[type]);
      setStatusMessage(`${FITTING_LABELS[type]} intégré au réseau`);
    }else{
      const world=isoUnprojectV4(sx,sy,viewport.zoom,viewport.panX,viewport.panY, nodeZ || 0);
      const node=makeEquipmentNode(type,FITTING_LABELS[type],snapIsoV4(world.x,isoSnapStep),snapIsoV4(world.y,isoSnapStep),nodeZ||0,newDN,0);
      const nextNodes = [...nodes, node];
      commitGraph(nextNodes, segments);
      setSelectedNodeId(node.id);setSelectedNodeIds([node.id]);
      setStatusMessage(`${FITTING_LABELS[type]} placé — raccorder ses ports`);
    }
    setDraggedEquipmentType(null);
  };

  // V4.8d1_WORKSPACE_CAO_MENU : menus type logiciel CAO.
  const cadMenuGroups: Array<{
    title: string;
    items: Array<{ label: string; hint?: string; run: () => void; disabled?: boolean }>;
  }> = [
    {
      title: "Fichier",
      items: [
        { label: "✦ Nouveau projet", hint: "Choix", run: () => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "launcher" })) },
        { label: "⌂ Retour Accueil", hint: "Home", run: () => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "home" })) },
        { label: "◈ Présentation Landing", hint: "Ouverture", run: () => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "landing" })) },
        { label: "✨ Démo Industrielle Complète (ASME/MSS)", hint: "DEMO", run: loadPresetDemoComplexe },
        { label: "Exemple poste", hint: "charger", run: loadPresetPoste },
        { label: "Exemple gare racleur", hint: "charger", run: loadPresetGare },
        { label: "🏠 Démo Chambre Technique d'Eau Glacée", hint: "DEMO_CT", run: loadPresetChambreTechnique },
        { label: "⚙️ Démo Skid de Filtration Parallèle", hint: "DEMO_SKID", run: loadPresetSkidFiltration },
        { label: "📋 BOM / Tableau global", hint: "BOM", run: () => { setRightPanelOpen(true); setRightPanelTab("bom"); } },
        { label: "Ouvrir JSON", hint: "import", run: () => importProjectRef.current?.click() },
        { label: "Sauver JSON", hint: "export", run: exportProjectJson },
        { label: "⎋ Déconnexion", hint: "Logout", run: () => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "logout" })) },
      ],
    },
    {
      title: "Édition",
      items: [
        { label: "Annuler", hint: "Ctrl+Z", run: undoGraph },
        { label: "Rétablir", hint: "Ctrl+Y", run: redoGraph },
        { label: "Copier", hint: "Ctrl+C", run: copySelection, disabled: !selectedCount },
        { label: "Couper", hint: "Ctrl+X", run: cutSelection, disabled: !selectedCount },
        { label: "Coller", hint: "Ctrl+V", run: () => pasteClipboard() },
        { label: "Dupliquer", hint: "Ctrl+D", run: duplicateSelection, disabled: !selectedCount },
        { label: "Tout sélectionner", hint: "Ctrl+A", run: () => { setSelectedNodeIds(nodes.map(n=>n.id)); setSelectedSegmentIds(segments.map(s=>s.id)); } },
        { label: "Supprimer sélection", hint: "Suppr", run: deleteSelection, disabled: !selectedCount },
        { label: "Désélectionner", hint: "Esc", run: clearSelection },
        { label: "Associer en Spool", hint: "Ctrl+G", run: () => associateSelectionToSpool(), disabled: !selectedCount },
        { label: "Dissocier du Spool", hint: "Ctrl+Shift+G", run: () => dissociateSelectionFromSpool(), disabled: !selectedCount },
      ],
    },
    {
      title: "Affichage",
      items: [
        { label: "Zoom +", hint: "+", run: zoomIn },
        { label: "Zoom -", hint: "-", run: zoomOut },
        { label: "Ajuster/recentrer", hint: "Fit / 0", run: resetView },
        { label: showGrid ? "Masquer grille" : "Afficher grille", hint: "G", run: () => setShowGrid((v) => !v) },
        { label: showPipeLabels ? "Masquer pipelines" : "Afficher pipelines", run: () => setShowPipeLabels((v) => !v) },
        { label: showWelds ? "Masquer soudures" : "Afficher soudures", run: () => setShowWelds((v) => !v) },
        {
          label: "📺 Double Écran & Projection Smart TV...",
          hint: "WORKSPACE",
          run: () => {
            setWorkspaceConfigModalOpen(true);
            setStatusMessage("Espace de travail & Multi-écran / Smart TV");
          },
        },
        {
          label: "🚀 Lancer Écran 2 Dédié (3D Solide / Spools / BOM)",
          hint: "SCREEN2",
          run: () => {
            pdiWorkspaceBus.openSecondaryWindow("3d");
            setStatusMessage("Écran 2 ouvert dans une fenêtre dédiée synchrone");
          },
        },
      ],
    },
    {
      title: "Précision",
      items: [
        {
          label: unitSystem === "metric"
            ? "✓ Système Métrique SI (m, mm, bar, kg, °C)"
            : "Activer Système Métrique SI (m, mm, bar, kg, °C)",
          hint: "SI (m/bar)",
          run: () => {
            setUnitSystem("metric");
            setStatusMessage("SYSTÈME MÉTRIQUE ACTIVÉ (ISO 80000 / SI : m, mm, bar, kg, °C)");
          },
        },
        {
          label: unitSystem === "imperial"
            ? "✓ Système Impérial US (ft-in, psi, lbs, °F)"
            : "Activer Système Impérial US (ft-in, psi, lbs, °F)",
          hint: "US (ft/psi)",
          run: () => {
            setUnitSystem("imperial");
            setStatusMessage("SYSTÈME IMPÉRIAL ACTIVÉ (ASME / US Customary : ft-in, psi, lbs, °F)");
          },
        },
        {
          label: `Basculer Unités : ${unitSystem === "metric" ? "Métrique (m) → Impérial (ft)" : "Impérial (ft) → Métrique (m)"}`,
          hint: "UNITS",
          run: () => {
            const next = unitSystem === "metric" ? "imperial" : "metric";
            setUnitSystem(next);
            setStatusMessage(
              next === "imperial"
                ? "SYSTÈME IMPÉRIAL ACTIVÉ (ASME / US Customary : ft-in, psi, lbs, °F)"
                : "SYSTÈME MÉTRIQUE ACTIVÉ (ISO 80000 / SI : m, mm, bar, kg, °C)"
            );
          },
        },
        {
          label: snapEnabled ? "✓ Désactiver Accrochage / Magnétisme (SNAP)" : "Activer Accrochage / Magnétisme (SNAP)",
          hint: "F9",
          run: () => {
            setSnapEnabled((v) => {
              const next = !v;
              setStatusMessage(next ? "Accrochage SNAP ACTIVÉ" : "Accrochage SNAP DÉSACTIVÉ");
              return next;
            });
          },
        },
        {
          label: "Accrochage Grille : 10 mm",
          hint: "10mm",
          run: () => { setIsoSnapStep(0.01); setStatusMessage("Pas d'accrochage fixé à 10 mm"); },
        },
        {
          label: "Accrochage Grille : 50 mm",
          hint: "50mm",
          run: () => { setIsoSnapStep(0.05); setStatusMessage("Pas d'accrochage fixé à 50 mm"); },
        },
        {
          label: "Accrochage Grille : 100 mm",
          hint: "100mm",
          run: () => { setIsoSnapStep(0.1); setStatusMessage("Pas d'accrochage fixé à 100 mm"); },
        },
        {
          label: "Redresser sélection ISO orthogonale",
          hint: "ISO",
          run: redressIsoSelection,
          disabled: selectedSegmentIds.length < 1,
        },
      ],
    },
    {
      title: "Dessin",
      items: [
        { label: "Sélection (Boîte / Clic)", hint: "V", run: () => { setInteractionMode("select"); setIsoDrawMode("select"); } },
        { label: "Main / Pan", hint: "H / Espace", run: () => setInteractionMode("main") },
        { label: axisCursorEnabled ? "Curseur Trièdre (Actif)" : "Curseur Trièdre (Inactif)", hint: "TRIÈDRE", run: () => setAxisCursorEnabled((v) => !v) },
        { label: "Nœud / Point", hint: "N", run: () => { setInteractionMode("select"); setIsoDrawMode("node"); } },
        { label: "Tube / Tronçon", hint: "T", run: () => { setInteractionMode("select"); setIsoDrawMode("segment"); } },
        { label: "Té de dérivation", hint: "E", run: () => { setInteractionMode("select"); setIsoDrawMode("te"); } },
        { label: "Coude 90°", hint: "C", run: () => { setInteractionMode("select"); setIsoDrawMode("coude"); } },
      ],
    },
    {
      title: "Cotation",
      items: [
        { label: "Créer cotation", hint: "M", run: () => { setInteractionMode("select"); setIsoDrawMode("dimension"); setDimensionPick(null); } },
        { label: showDimensions ? "Masquer cotations" : "Afficher cotations", hint: "D", run: () => setShowDimensions((v) => !v) },
        { label: "Supprimer dernière cote", hint: "⌫", run: removeSelectedDimensions, disabled: dimensions.length === 0 },
      ],
    },
    {
      title: "Alignement",
      items: [
        { label: "Aligner sur objet & orientation (AL)", hint: "ALIGN", run: startAlignWizard },
        { label: "Rendre parallèle par référence (//)", hint: "//", run: startParallelWizard },
        { label: "Aligner X (Monde)", hint: "AX", run: () => alignSelectedNodesAxis("x") },
        { label: "Aligner Y (Monde)", hint: "AY", run: () => alignSelectedNodesAxis("y") },
        { label: "Aligner Z (Monde)", hint: "AZ", run: () => alignSelectedNodesAxis("z") },
        { label: "Équipement sur tube", hint: "AT", run: alignSelectedEquipmentOnTube },
        { label: "Redresser ISO", hint: "ISO", run: redressIsoSelection, disabled: selectedSegmentIds.length < 1 },
      ],
    },
    {
      title: "Insertion",
      items: [
        { label: leftPanelOpen ? "Masquer bibliothèque" : "Afficher bibliothèque", hint: "⧉", run: () => setLeftPanelOpen((v) => !v) },
        { label: "Vanne par défaut", run: () => { setFitType("vanne_passage_total"); setFitLabel(FITTING_LABELS.vanne_passage_total); setLeftPanelOpen(true); } },
      ],
    },
    {
      title: "Supportage",
      items: [
        { label: "Panneau Supports & GC", hint: "SUP", run: () => { setRightPanelOpen(true); setRightPanelTab("supports"); } },
        { label: "Placer Guide MSS Type 35", hint: "GUIDE", run: () => { setActiveSupportTypeToPlace("mss_type_35"); setRightPanelOpen(true); setRightPanelTab("supports"); setStatusMessage("Cliquez un tronçon pour placer le guide coulissant"); } },
        { label: "Placer Point Fixe Type 57", hint: "ANCHOR", run: () => { setActiveSupportTypeToPlace("mss_type_57"); setRightPanelOpen(true); setRightPanelTab("supports"); setStatusMessage("Cliquez un tronçon pour placer le point fixe"); } },
        { label: "Placer Pendard MSS Type 1", hint: "HANGER", run: () => { setActiveSupportTypeToPlace("mss_type_1"); setRightPanelOpen(true); setRightPanelTab("supports"); setStatusMessage("Cliquez un tronçon pour placer le pendard"); } },
        { label: "Placer Patin MSS Type 39", hint: "SHOE", run: () => { setActiveSupportTypeToPlace("mss_type_39"); setRightPanelOpen(true); setRightPanelTab("supports"); setStatusMessage("Cliquez un tronçon pour placer le patin soudé"); } },
        { label: "Exporter MTO Génie Civil (CSV)", hint: "CSV", run: exportCivilMtoCsv, disabled: supports.length === 0 },
      ],
    },
    {
      title: "Soudage & Spools",
      items: [
        { label: "Plan de Soudage & Carnet de Spools", hint: "WELD", run: () => setWeldSpoolModalOpen(true) },
        { label: colorBySpool ? "Désactiver coloration Spools" : "Coloration par Spool (SP-01, SP-02...)", hint: "SP", run: () => setColorBySpool((v) => !v) },
        { label: showWelds ? "Masquer repères soudures" : "Afficher repères soudures (W01...)", hint: "W", run: () => setShowWelds((v) => !v) },
      ],
    },
    {
      title: "Impression",
      items: [
        { label: "Planche ISO A3", hint: "A3", run: () => setIsoMode((v) => (v === "editor" ? "planche" : "editor")) },
        { label: "Imprimer feuille", hint: "⎙ / P", run: printPlanSheet },
        { label: "Imprimer Plan de Soudage (Weld Map)", hint: "WM", run: () => { setPrintWeldMapMode(true); setPrintModalOpen(true); } },
      ],
    },
    {
      title: "Outils",
      items: [
        { label: "📋 BOM / Tableau global", hint: "BOM", run: () => { setRightPanelOpen(true); setRightPanelTab("bom"); } },
        { label: "Contrôle réseau", hint: graphErrorCount ? `${graphErrorCount} erreur(s)` : "OK", run: () => { setStudioLayout("control"); setLeftPanelOpen(true); setStatusMessage(graphIssues.length?`CONTROLE RESEAU : ${graphErrorCount} erreur(s), ${graphWarningCount} alerte(s) - ${graphIssues.slice(0,3).map(issue=>issue.code+" "+issue.message).join(" ; ")}`:"CONTROLE RESEAU : graphe valide, aucune anomalie detectee."); } },
        { label: "Palette commandes", hint: "Ctrl+K", run: () => setCommandPaletteOpen(true) },
        { label: "Raccourcis clavier", hint: "?", run: () => setShortcutsOpen(true) },
      ],
    },
  ];

  // PATCH 017M : etat du ruban (Mega-Menu style GitHub). Replié par défaut pour maximiser l'espace de dessin.
  const [rubanOnglet017M, setRubanOnglet017M] = useState<string>("dessin");
  const [rubanAnchorLeft, setRubanAnchorLeft] = useState<number | undefined>(undefined);

  // Synchronisation avec l'Espace de Travail & Skid (Volume Extrudé)
  useEffect(() => {
    if (rubanOnglet017M === "volume") {
      setRightPanelOpen(true);
      setRightPanelTab("volume");
      setEnvelopeActive(true);
    }
  }, [rubanOnglet017M]);
  const [rubanReplie017M, setRubanReplie017M] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("pdi.ribbon.collapsed.v1");
      return saved !== null ? saved === "1" : true;
    }
    catch { return true; }
  });
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("pdi.rail.collapsed.v1") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("pdi.ribbon.collapsed.v1", rubanReplie017M ? "1" : "0"); }
    catch { /* stockage indisponible : le ruban reste utilisable */ }
  }, [rubanReplie017M]);
  useEffect(() => {
    try {
      localStorage.setItem("pdi.rail.collapsed.v1", railCollapsed ? "1" : "0");
      window.dispatchEvent(new CustomEvent("pdi:rail-toggle", { detail: { collapsed: railCollapsed } }));
    }
    catch { /* ignore */ }
  }, [railCollapsed]);
  // PATCH 017Q4-A: Ctrl+F1 est désormais géré par le Dispatcher Clavier Central Unifié (onGlobalKeyDown)

  // PATCH 017M : resolution de l action. Le registre designe une entree de
  // menu par (groupe, index) ; on reutilise la fermeture existante telle
  // quelle. Aucune des 47 actions n est reecrite : c est ce qui rend le
  // passage au ruban sans risque pour le code qui fonctionne.
  const pdiCibleRuban017M = (
    entree: PdiEntreeRuban017M,
  ): { label: string; hint?: string; run: () => void; disabled?: boolean } | undefined => {
    // Direct handlers for Open and Save JSON
    if (entree.id === "fichier.ouvrir") {
      return {
        label: "Ouvrir JSON",
        hint: "Ouvrir et charger un fichier projet JSON",
        run: () => importProjectRef.current?.click(),
      };
    }
    if (entree.id === "fichier.sauver") {
      return {
        label: "Sauver JSON",
        hint: "Télécharger le projet courant en JSON (Ctrl+S)",
        run: exportProjectJson,
      };
    }
    // Direct export handlers
    if (entree.id === "fichier.export.pdf") {
      return {
        label: "Export PDF",
        hint: "Générer et imprimer le plan normalisé ISO A3 sous format PDF",
        run: () => {
          setPrintWeldMapMode(false);
          setPrintModalOpen(true);
        }
      };
    }
    if (entree.id === "fichier.export.dxf") {
      return {
        label: "Export DXF",
        hint: "Exporter les coordonnées de tuyauterie 3D au format standard DXF pour AutoCAD/SolidWorks",
        run: exportProjectAsDxf
      };
    }
    if (entree.id === "fichier.export.png") {
      return {
        label: "Export PNG",
        hint: "Générer et télécharger une image haute définition au format PNG",
        run: () => exportProjectAsRaster("png")
      };
    }
    if (entree.id === "fichier.export.jpeg") {
      return {
        label: "Export JPEG",
        hint: "Générer et télécharger une image haute définition au format JPEG",
        run: () => exportProjectAsRaster("jpeg")
      };
    }
    if (entree.id === "fichier.export.svg") {
      return {
        label: "Export SVG",
        hint: "Exporter le plan vectoriel ISO au format SVG standard",
        run: exportProjectAsSvg
      };
    }
    if (entree.id === "edition.associer" || entree.id === "edition.grouper") {
      return {
        label: "Associer en Spool",
        hint: "Associer la sélection en sous-ensemble Spool (Ctrl+G)",
        run: () => associateSelectionToSpool(),
        disabled: !selectedCount,
      };
    }
    if (entree.id === "edition.dissocier") {
      return {
        label: "Dissocier du Spool",
        hint: "Dissocier les éléments sélectionnés du Spool (Ctrl+Shift+G)",
        run: () => dissociateSelectionFromSpool(),
        disabled: !selectedCount,
      };
    }

    // Commandes d'alignement & précision (Résolution directe 100% fiable)
    if (entree.id === "precision.aligner" || entree.id === "edition.aligner") {
      return {
        label: "Aligner",
        hint: "Aligner sur un objet & son orientation de référence (AL)",
        run: startAlignWizard,
      };
    }
    if (entree.id === "precision.parallele") {
      return {
        label: "Rendre parallèle",
        hint: "Rendre les tronçons sélectionnés parallèles par référence (//)",
        run: startParallelWizard,
      };
    }
    if (entree.id === "precision.alignerx") {
      return {
        label: "Aligner X",
        hint: "Aligner les éléments sélectionnés sur l'axe monde X (AX)",
        run: () => alignSelectedNodesAxis("x"),
      };
    }
    if (entree.id === "precision.alignery") {
      return {
        label: "Aligner Y",
        hint: "Aligner les éléments sélectionnés sur l'axe monde Y (AY)",
        run: () => alignSelectedNodesAxis("y"),
      };
    }
    if (entree.id === "precision.alignerz") {
      return {
        label: "Aligner Z",
        hint: "Aligner les éléments sélectionnés sur l'axe monde Z (AZ)",
        run: () => alignSelectedNodesAxis("z"),
      };
    }
    if (entree.id === "precision.eqsurtube") {
      return {
        label: "Équipement sur tube",
        hint: "Aligner l'équipement sélectionné sur l'axe du tube support (AT)",
        run: alignSelectedEquipmentOnTube,
      };
    }
    if (entree.id === "precision.redresser") {
      return {
        label: "Redresser ISO",
        hint: "Redresser les tronçons sur les axes isométriques stricts (ISO)",
        run: redressIsoSelection,
        disabled: selectedSegmentIds.length < 1,
      };
    }

    // PATCH 017M2 : deux origines d action possibles.
    // 1. source = { menu, index } : action historique du moteur, reutilisee
    //    telle quelle, sans reecriture.
    if (entree.source) {
      const groupe = cadMenuGroups.find((g) => g.title === entree.source!.menu);
      if (!groupe) return undefined;
      return groupe.items[entree.source!.index];
    }
    // 2. commande : on passe par executeCadCommand, exactement comme si
    //    l utilisateur avait tape la commande au clavier. Le ruban et la ligne
    //    de commande partagent ainsi UNE seule voie d execution.
    if (entree.commande) {
      const cmd017M2 = entree.commande;
      return {
        label: entree.nomFr,
        hint: "Equivaut a taper " + cmd017M2 + " dans la ligne de commande",
        run: () => executeCadCommand(cmd017M2),
      };
    }
    return undefined;
  };
  const pdiInfobulleRuban017M = (entree: PdiEntreeRuban017M, indice?: string) => {
    const base = entree.nomFr + " / " + entree.nomEn
      + (entree.raccourci ? "  [" + entree.raccourci + "]" : "")
      + (indice ? "  (" + indice + ")" : "");
    return entree.etat === "grise"
      ? base + "\nPrevu au jalon : " + (entree.jalon || "a definir")
      : base;
  };

  return <div
      data-pdi-studio="v4.8d1"
      className={`${workspaceFullscreen ? `fixed inset-0 z-[9999] overflow-hidden bg-[#000000] px-2 pb-2 pt-[56px] ${railCollapsed ? "pl-[56px]" : "pl-[166px]"}` : "w-full"} pdi-studio-root ${workspaceFullscreen ? "h-screen" : "space-y-3"} animate-fade-in`} style={{ "--pdi-command-reserved-bottom": (!propertiesModalOpen && !commandPromptHidden) ? "44px" : "0px" } as React.CSSProperties} /* PATCH 017D */
    >
      <style>{`
        [data-pdi-studio]{--pdi-bg:#000000;--pdi-panel:#0E0E12;--pdi-panel2:#18181B;--pdi-line:#27272A;--pdi-text:#FFFFFF;--pdi-muted:#A1A1AA;--pdi-blue:#3F3F46;--pdi-cyan:#FFFFFF;--pdi-select:#F59E0B;background:var(--pdi-bg)!important;color:var(--pdi-text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        [data-pdi-studio].pdi-studio-root{padding-left:${railCollapsed ? "56px" : "166px"}!important;padding-top:56px!important}
        @media(max-width:900px){[data-pdi-studio].pdi-studio-root{padding-left:8px!important}}
        [data-pdi-studio] .bg-white,[data-pdi-studio] .bg-slate-50,[data-pdi-studio] .bg-slate-100{background-color:var(--pdi-panel)!important;color:var(--pdi-text)!important}
        [data-pdi-studio] .border-slate-200,[data-pdi-studio] .border-slate-300{border-color:var(--pdi-line)!important}
        [data-pdi-studio] .text-slate-900,[data-pdi-studio] .text-slate-800,[data-pdi-studio] .text-slate-700{color:var(--pdi-text)!important}
        [data-pdi-studio] .text-slate-600,[data-pdi-studio] .text-slate-500{color:var(--pdi-muted)!important}
        [data-pdi-studio] .pdi-library-card{background:#0E0E12!important;color:#FFFFFF!important;border-color:#27272A!important}
        [data-pdi-studio] .pdi-library-card:hover{background:#18181B!important;color:#fff!important;border-color:rgba(255,255,255,.3)!important}
        [data-pdi-studio] .pdi-library-card.active{background:#27272A!important;color:#fff!important;border-color:#71717A!important;box-shadow:0 0 0 1px #71717A}
        [data-pdi-studio] .pdi-brand-logo{display:block;height:40px;width:auto;max-width:280px;object-fit:contain;object-position:left center;filter:drop-shadow(0 2px 8px rgba(0,0,0,.6))}
        [data-pdi-studio] .pdi-about-logo{display:block;width:min(280px,76vw);height:min(280px,76vw);max-width:100%;margin:0 auto;border-radius:18px;object-fit:contain;background:#050507;border:1px solid rgba(255,255,255,.15);padding:10px;box-shadow:0 20px 50px rgba(0,0,0,.8)}
        @media(max-width:900px){[data-pdi-studio] .pdi-brand-logo{height:32px;max-width:180px}}
        [data-pdi-studio] .pdi-library-card.dragging{background:#27272A!important;border-color:#F59E0B!important}
        [data-pdi-studio] .pdi-status-docked{backdrop-filter:blur(12px);background:rgba(0,0,0,.96)!important}
        @media(max-width:900px){[data-pdi-studio] .pdi-status-docked{left:0!important}[data-pdi-studio] .pdi-brand-logo{width:170px;height:42px;min-width:170px}[data-pdi-studio] .pdi-brand-subtitle{display:none}}
        [data-pdi-studio] input,[data-pdi-studio] select,[data-pdi-studio] textarea{background:#09090B!important;color:var(--pdi-text)!important;border-color:var(--pdi-line)!important}
        [data-pdi-studio] button{transition:background-color .15s ease,border-color .15s ease,color .15s ease,transform .08s ease}
        [data-pdi-studio] button:active{transform:translateY(1px)}
        [data-pdi-studio] .pdi-studio-topbar{background:#08080A;border-bottom:1px solid rgba(255,255,255,.08);box-shadow:0 8px 24px rgba(0,0,0,.45)}
        [data-pdi-studio] .pdi-studio-rail{background:#060709;border-right:1px solid rgba(255,255,255,.08);box-shadow:8px 0 24px rgba(0,0,0,.4)}
        [data-pdi-studio] .pdi-rail-group-title{width:100%;font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:#71717A;font-weight:900;text-align:center;padding:4px 2px 2px 2px;border-top:1px solid rgba(255,255,255,.08);margin-top:3px}
        [data-pdi-studio] .pdi-rail-tool-btn{height:28px;width:100%;border-radius:6px;border:1px solid rgba(255,255,255,.08);background:#0E0E12;color:#D4D4D8;font-size:9.5px;font-weight:700;display:flex;align-items:center;gap:5px;padding:0 5px;cursor:pointer;white-space:nowrap;transition:all .12s ease;overflow:hidden}
        [data-pdi-studio] .pdi-rail-tool-btn:hover:not(:disabled){background:#1C1D24;color:#FFFFFF;border-color:rgba(255,255,255,.24);transform:translateX(1px)}
        [data-pdi-studio] .pdi-rail-tool-btn.active{background:#1E293B;color:#FFFFFF;border-color:#38BDF8;box-shadow:0 0 10px rgba(56,189,248,0.25)}
        [data-pdi-studio] .pdi-rail-tool-btn.danger:hover:not(:disabled){background:#450A0A;color:#FECACA;border-color:#DC2626}
        [data-pdi-studio] .pdi-cad-menubar{display:flex;align-items:center;gap:2px;min-width:0;overflow:visible}
        [data-pdi-studio] .pdi-cad-menu{position:relative}
        [data-pdi-studio] .pdi-cad-menu-trigger{height:28px;padding:0 10px;border-radius:6px;color:#A1A1AA;background:transparent;font-size:11px;font-weight:900;white-space:nowrap}
        [data-pdi-studio] .pdi-cad-menu:hover .pdi-cad-menu-trigger{background:#18181B;color:white}
        [data-pdi-studio] .pdi-cad-menu-panel{display:none;position:absolute;top:30px;left:0;min-width:210px;max-height:70vh;overflow:auto;z-index:10050;background:#09090B;border:1px solid #27272A;border-radius:10px;padding:6px;box-shadow:0 18px 45px rgba(0,0,0,.6)}
        [data-pdi-studio] .pdi-cad-float-props{position:fixed;width:218px;z-index:10070;background:#0E0E12;border:1px solid #27272A;border-radius:8px;box-shadow:0 18px 44px rgba(0,0,0,.7);color:#A1A1AA;font-size:10px;overflow:hidden;user-select:none}
        [data-pdi-studio] .pdi-cad-float-head{height:27px;display:flex;align-items:center;gap:7px;background:#050507;border-bottom:1px solid #27272A;padding:0 7px;cursor:move;color:#FFFFFF;letter-spacing:.08em}
        [data-pdi-studio] .pdi-cad-float-head b{font-size:9px}.pdi-cad-float-head span{margin-left:auto;color:#71717A;font-size:9px;text-transform:uppercase}.pdi-cad-float-head button{width:18px;height:18px;border:0;background:#18181B;color:#A1A1AA;border-radius:4px;cursor:pointer}
        [data-pdi-studio] .pdi-cad-float-body{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:7px;background:#0E0E12;max-height:210px;overflow:auto}
        [data-pdi-studio] .pdi-cad-float-body label{display:flex;flex-direction:column;gap:2px;color:#71717A;font-size:8px;font-weight:800;text-transform:uppercase}.pdi-cad-float-body label.wide{grid-column:1/-1}
        [data-pdi-studio] .pdi-cad-float-body input,[data-pdi-studio] .pdi-cad-float-body select{height:22px;min-width:0;border-radius:4px;background:#050507!important;border:1px solid #27272A!important;color:#FFFFFF!important;font-size:10px;padding:0 5px}
        [data-pdi-studio] .pdi-cad-float-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:6px;background:#09090B;border-top:1px solid #27272A}.pdi-cad-float-actions button,.pdi-cad-props-tab{height:22px;border-radius:4px;border:1px solid #27272A;background:#18181B;color:#FFFFFF;font-size:9px;font-weight:900;cursor:pointer}.pdi-cad-float-actions button:hover,.pdi-cad-props-tab:hover{background:#27272A;color:white}.pdi-cad-props-tab{position:fixed;z-index:10069;width:62px;background:#09090B}

        [data-pdi-studio] .pdi-cad-menu:hover .pdi-cad-menu-panel{display:block}
        [data-pdi-studio] .pdi-cad-menu-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:7px;padding:7px 8px;color:#FFFFFF;background:transparent;text-align:left;font-size:11px;font-weight:800}
        [data-pdi-studio] .pdi-cad-menu-item:hover:not(:disabled){background:#27272A;color:white}
        [data-pdi-studio] .pdi-cad-menu-item:disabled{opacity:.38;cursor:not-allowed}
        [data-pdi-studio] .pdi-cad-menu-hint{font-size:9px;color:#71717A;font-weight:900}
        [data-pdi-studio] .pdi-cad-props-mini{background:#0E0E12;border:1px solid #27272A;border-left:3px solid #71717A;border-radius:8px;color:#A1A1AA;font-size:10px;box-shadow:0 8px 22px rgba(0,0,0,.5);overflow:hidden}
        [data-pdi-studio] .pdi-cad-props-head{height:30px;display:flex;align-items:center;justify-content:space-between;padding:0 9px;background:#09090B;border-bottom:1px solid #27272A;color:#FFFFFF;font-size:10px;letter-spacing:.08em}
        [data-pdi-studio] .pdi-cad-props-mini details{border-bottom:1px solid #18181B}
        [data-pdi-studio] .pdi-cad-props-mini summary{cursor:pointer;padding:7px 9px;color:#71717A;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:8px;background:#050507}
        [data-pdi-studio] .pdi-props-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px}
        [data-pdi-studio] .pdi-props-grid label{display:flex;flex-direction:column;gap:3px;color:#71717A;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
        [data-pdi-studio] .pdi-props-grid label.wide{grid-column:1/-1}
        [data-pdi-studio] .pdi-props-grid input,[data-pdi-studio] .pdi-props-grid select{height:24px;border-radius:4px;padding:0 6px;font-size:10px;background:#050507!important;border:1px solid #27272A!important;color:#FFFFFF!important}
        [data-pdi-studio] .pdi-props-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;padding:8px}
        [data-pdi-studio] .pdi-props-actions button{height:24px;border-radius:4px;background:#18181B;color:#FFFFFF;border:1px solid #27272A;font-size:9px;font-weight:900}
        [data-pdi-studio] .pdi-props-actions button:hover{background:#27272A;color:white}
        [data-pdi-studio] .pdi-props-actions button.danger{background:#7F1D1D;color:#FECACA;border-color:#B91C1C}

        [data-pdi-studio] .pdi-studio-rail{background:#050507;border-right:1px solid rgba(255,255,255,.08);box-shadow:8px 0 24px rgba(0,0,0,.4)}
        [data-pdi-studio] .pdi-rail-button{width:38px;height:38px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#A1A1AA;background:#0E0E12;font-weight:700;font-size:13px;cursor:pointer}
        [data-pdi-studio] .pdi-rail-button:hover{border-color:rgba(255,255,255,.3);color:#FFFFFF;background:#18181B}
        [data-pdi-studio] .pdi-rail-button.active{color:white;background:#27272A;border-color:#71717A;box-shadow:0 0 12px rgba(0,0,0,0.6)}
        /* RUBAN CAD INDUSTRIEL & LISTES VERTICALES ERGONOMIQUES */
        [data-pdi-studio] .pdi-cad-ribbon{display:flex;align-items:stretch;gap:8px;padding:4px 10px;min-height:92px;background:#09090B;border-bottom:1px solid #27272A;box-shadow:0 8px 20px rgba(0,0,0,.45);overflow-x:auto}
        [data-pdi-studio] .pdi-ribbon-group{display:flex;flex-direction:column;justify-content:space-between;align-items:stretch;border-right:1px solid #27272A;padding-right:8px;margin-right:2px;flex-shrink:0}
        [data-pdi-studio] .pdi-ribbon-group-title{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#71717A;font-weight:900;text-align:center;padding-top:2px;border-top:1px solid rgba(255,255,255,.06);margin-top:2px}
        [data-pdi-studio] .pdi-ruban-boutons{display:flex;flex-direction:column;gap:3px}
        [data-pdi-studio] .pdi-ruban-boutons.multi-col{display:grid;grid-template-rows:repeat(3,24px);grid-auto-flow:column;gap:3px 6px}
        [data-pdi-studio] .pdi-ruban-boutons.single-col{display:flex;flex-direction:column;gap:3px}
        [data-pdi-studio] .pdi-ribbon-btn{height:24px;padding:0 8px;border-radius:5px;border:1px solid #27272A;background:#141418;color:#E4E4E7;font-size:10.5px;font-weight:700;display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all .15s ease}
        [data-pdi-studio] .pdi-ribbon-btn:hover:not(:disabled){background:#27272A;color:#FFFFFF;border-color:rgba(255,255,255,.28);transform:translateX(1px)}
        [data-pdi-studio] .pdi-ribbon-btn:active:not(:disabled){background:#3F3F46}
        [data-pdi-studio] .pdi-ribbon-btn:disabled{opacity:.4;cursor:not-allowed;background:#0E0E12;color:#71717A;border-color:#18181B}
        [data-pdi-studio] .pdi-ribbon-icon{font-size:12px;display:inline-flex;align-items:center;justify-content:center;color:#38BDF8}
        [data-pdi-studio] .pdi-ribbon-label{flex:1;text-align:left}
        /* PATCH 017M : ruban a 9 onglets. */
        [data-pdi-studio] .pdi-ruban-onglet{height:26px;padding:0 11px;border-radius:6px 6px 0 0;color:#71717A;background:transparent;font-size:11px;font-weight:900;white-space:nowrap;border:1px solid transparent;border-bottom:0}
        [data-pdi-studio] .pdi-ruban-onglet:hover{background:#141418;color:#FFFFFF}
        [data-pdi-studio] .pdi-ruban-onglet.actif{background:#09090B;color:#FFFFFF;border-color:#27272A}
        @media(max-width:900px){[data-pdi-studio] .pdi-cad-ribbon{display:none!important}}

        [data-pdi-studio] ::-webkit-scrollbar{width:8px;height:8px}[data-pdi-studio] ::-webkit-scrollbar-track{background:#000000}[data-pdi-studio] ::-webkit-scrollbar-thumb{background:#27272A;border:2px solid #000000;border-radius:8px}
        @media(max-width:900px){
          [data-pdi-studio].pdi-studio-root{padding-left:8px!important;padding-right:8px!important;padding-top:116px!important}
          [data-pdi-studio] .pdi-studio-rail{display:none!important}
          [data-pdi-studio] .pdi-brand-subtitle{display:none}
          [data-pdi-studio] .pdi-cad-menubar{display:none!important}
          [data-pdi-studio] .pdi-cad-ribbon{left:0!important}
          [data-pdi-studio] .pdi-cad-menu-trigger{font-size:10px;padding:0 8px}
          [data-pdi-studio] .pdi-brand-logo{height:28px!important;width:auto!important;max-width:150px!important}
        }
        @media(max-width:1200px){[data-pdi-studio] .pdi-cad-menu-trigger{padding:0 7px;font-size:10px}}

        [data-pdi-studio] .pdi-compact-metrics, [data-pdi-studio] .pdi-metric-card{min-height:52px!important;padding:8px 10px!important;border-radius:14px!important}
        [data-pdi-studio] .pdi-compact-metrics h3, [data-pdi-studio] .pdi-metric-card h3{font-size:9px!important;margin:0!important}
        [data-pdi-studio] .pdi-compact-metrics strong, [data-pdi-studio] .pdi-metric-card strong{font-size:18px!important;line-height:1!important}

        /* PATCH 012 — suppress bottom metric cards/status requested */
        [data-pdi-studio] .pdi-status-docked,
        [data-pdi-studio] .pdi-bottom-meter,
        [data-pdi-studio] [class*="bottom-meter"],
        [data-pdi-studio] [class*="metric"],
        [data-pdi-studio] [class*="meter"]{display:none!important}
        [data-pdi-studio] .pdi-status-docked{display:none!important}
        [data-pdi-studio] .pdi-command-dock-015{font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        [data-pdi-studio] .pdi-v48d-primary-workspace svg,
        [data-pdi-studio] .pdi-v48d-primary-workspace .rounded-\[28px\],
        [data-pdi-studio] .pdi-v48d-primary-workspace [class*="rounded"]{border-width:1px!important}
        [data-pdi-studio] .pdi-v48d-primary-workspace{border-width:1px!important}
        [data-pdi-studio] .pdi-v48d-primary-workspace{padding-bottom:var(--pdi-command-reserved-bottom,0px)!important}
        @media(max-width:900px){[data-pdi-studio] .pdi-command-dock-015{left:8px!important;right:8px!important;bottom:8px!important}.pdi-command-dock-015 label{display:none!important}}
        [data-pdi-studio] svg{background-color:#000000!important;background-image:radial-gradient(circle at center,rgba(255,255,255,.04) 0,transparent 55%)!important}
      `}</style>
      {workspaceFullscreen&&<>
        <header className="pdi-studio-topbar fixed left-0 right-0 top-0 z-[10008] h-[54px] px-3 flex items-center justify-between gap-3 text-white">
          <div className="flex items-center min-w-0 gap-2.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "home" }))}
              className="shrink-0 rounded-lg border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs font-black text-white hover:border-white/30 hover:bg-zinc-800 flex items-center justify-center shadow-sm transition-all"
              title="Retour à l'accueil PD&I"
              aria-label="Accueil"
            >
              <span className="text-base leading-none">⌂</span>
            </button>
            <div className="h-6 w-px bg-zinc-800"/>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="shrink-0 rounded-lg border border-white/10 bg-black/60 px-2 py-1 transition-all hover:border-white/25 hover:bg-black/90 flex items-center"
              title="À propos de PD&I"
            >
              <PdiBrandMark variant="horizontal" size="sm" maxHeight={36} />
            </button>
          </div>
            {/* Menubar avec menu déroulant vertical GitHub / VS Code style (Photo 2) */}
            <nav className="pdi-cad-menubar hidden md:flex flex-1 justify-center items-center min-w-0 max-w-2xl mx-auto px-1 overflow-x-auto no-scrollbar gap-1" aria-label="Onglets du ruban PD & I">
              {PDI_ONGLETS_RUBAN_017M.map((onglet) => {
                const isOpen = rubanOnglet017M === onglet.id && !rubanReplie017M;
                return (
                  <button
                    key={onglet.id}
                    id={`pdi-tab-${onglet.id}`}
                    type="button"
                    onClick={(e) => {
                      if (isOpen) {
                        setRubanReplie017M(true);
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setRubanAnchorLeft(rect.left);
                        setRubanOnglet017M(onglet.id);
                        setRubanReplie017M(false);

                        // Diffusion automatique du changement de vue vers l'écran secondaire
                        let vReq: PdiWorkspaceViewId = "3d";
                        const tabKey = onglet.id as string;
                        if (tabKey === "donnees") vReq = "bom";
                        else if (tabKey === "edition") vReq = "properties";
                        else if (tabKey === "insertion") vReq = "library";
                        else if (tabKey === "trois_d" || tabKey === "affichage") vReq = "3d";

                        pdiWorkspaceBus.broadcastChangeView(vReq, "primary");
                        setWorkspaceConfig((prev) => ({ ...prev, screen2View: vReq }));
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!rubanReplie017M && rubanOnglet017M !== onglet.id) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setRubanAnchorLeft(rect.left);
                        setRubanOnglet017M(onglet.id);
                      }
                    }}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 select-none ${
                      isOpen
                        ? "bg-[#161B22] text-white border border-[#30363D] shadow-sm shadow-black"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent"
                    }`}
                    title={`${onglet.nomFr} / ${onglet.nomEn} (Cliquer pour ouvrir le menu)`}
                  >
                    <span>{onglet.nomFr}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-cyan-400" : "text-zinc-500"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xl:flex items-center gap-2 bg-zinc-900/90 border border-zinc-800/90 rounded-md px-2.5 py-1 text-[10px] font-mono shrink-0 shadow-inner">
              <span className="text-zinc-300 font-bold">{nodes.length} <span className="text-zinc-500 font-sans hidden 2xl:inline">nœuds</span><span className="text-zinc-500 2xl:hidden">N</span></span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300 font-bold">{segments.length} <span className="text-zinc-500 font-sans hidden 2xl:inline">tronçons</span><span className="text-zinc-500 2xl:hidden">T</span></span>
              <span className="text-zinc-600">•</span>
              <button
                type="button"
                title={graphIssues.length ? graphIssues.slice(0, 8).map(issue => (issue.severity === "error" ? "ERREUR : " : "ALERTE : ") + issue.message).join("\n") : "Aucune anomalie de reseau detectee."}
                onClick={() => {
                  setStudioLayout("control");
                  setLeftPanelOpen(true);
                  setStatusMessage(graphErrorCount ? `CONTROLE RESEAU : ${graphErrorCount} erreur(s) - ${graphIssues.filter(issue=>issue.severity==="error").slice(0,3).map(issue=>issue.message).join(" ; ")}` : graphWarningCount ? `CONTROLE RESEAU : ${graphWarningCount} alerte(s) - ${graphIssues.slice(0,3).map(issue=>issue.message).join(" ; ")}` : "CONTROLE RESEAU : graphe valide, aucune anomalie.");
                }}
                className={graphErrorCount ? "text-red-400 font-bold underline decoration-dotted cursor-pointer flex items-center gap-1" : graphWarningCount ? "text-amber-300 font-bold underline decoration-dotted cursor-pointer flex items-center gap-1" : "text-emerald-400 font-bold cursor-pointer flex items-center gap-1"}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${graphErrorCount ? "bg-red-500 animate-ping" : graphWarningCount ? "bg-amber-400" : "bg-emerald-400"}`} />
                <span>{graphErrorCount ? `${graphErrorCount} err` : graphWarningCount ? `${graphWarningCount} alerte(s)` : "OK"}</span>
              </button>
            </div>
            <button onClick={()=>setCommandPaletteOpen(true)} className="h-8 px-2.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700 text-[10px] font-black shrink-0" title="Palette commandes">⌘K</button>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setTopbarProfileOpen(v => !v)}
                className="h-8 px-2.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0"
                title="Profil Youcef"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span className="font-bold text-slate-100">Youcef</span>
                <span className="text-[10px] text-zinc-400">▾</span>
              </button>
              {topbarProfileOpen && (
                <div
                  className="fixed right-3 top-[50px] z-[10010] w-64 rounded-xl border border-white/15 bg-[#0D0D10]/98 backdrop-blur-md p-1.5 shadow-2xl text-xs flex flex-col gap-0.5"
                  onClick={() => setTopbarProfileOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                    <p className="font-bold text-white truncate flex items-center justify-between">
                      <span>Youcef</span>
                      <span className="text-[10px] font-mono font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 rounded px-1.5 py-0.5">Patch {PDI_PATCH_VERSION}</span>
                    </p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">Version active • Tout implémenté</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadPresetDemoComplexe();
                      setTopbarProfileOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-900 border border-purple-500/50 text-white hover:border-purple-400 font-bold transition-all flex items-center justify-between shadow-sm mb-1"
                  >
                    <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse"/> Démo 3D Industrielle</span>
                    <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded border border-purple-400/40 font-mono">ASME/MSS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "launcher" }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white font-bold transition-all flex items-center justify-between"
                  >
                    <span>✦ Nouveau projet</span>
                    <span className="text-[10px] text-zinc-400">Choix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "home" }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white font-bold transition-all"
                  >
                    ⌂ Accueil PD&I
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "profile" }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white font-bold transition-all"
                  >
                    👤 Voir mon profil
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "projects" }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white font-bold transition-all"
                  >
                    📁 Mes projets
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "landing" }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white font-bold transition-all"
                  >
                    ◈ Présentation Landing
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "logout" }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/40 hover:text-red-300 font-bold transition-all flex items-center justify-between"
                  >
                    <span>⎋ Déconnexion</span>
                    <span className="text-[10px] text-red-400/70">Accueil</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* Menu déroulant vertical GitHub / VS Code style (Photo 2) */}
        <IsoRibbonBar
          collapsed={
            rubanReplie017M ||
            workspaceConfigModalOpen ||
            solid3dViewerOpen ||
            weldSpoolModalOpen ||
            propertiesModalOpen ||
            dataManagerOpen ||
            projectSetupOpen ||
            commandPaletteOpen ||
            shortcutsOpen
          }
          activeTab={rubanOnglet017M}
          anchorLeft={rubanAnchorLeft}
          resolveTarget={pdiCibleRuban017M}
          resolveTooltip={pdiInfobulleRuban017M}
          onExecute={(name) => setStatusMessage(`Outil activé : ${name}`)}
          onClose={() => setRubanReplie017M(true)}
          onSelectTab={(tabId) => {
            setRubanOnglet017M(tabId);
            setRubanReplie017M(false);
          }}
          onOpenPalette={() => setCommandPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          quickActions={[
            {
              id: "demo",
              title: "Démo Industrielle Complète",
              subtitle: "Charger réseau 3D complet avec vannes, bypass et GC",
              badge: "✨ DÉMO",
              icon: <Sparkles className="w-4 h-4 text-yellow-300" />,
              onClick: loadPresetDemoComplexe,
            },
            {
              id: "biblio",
              title: "Bibliothèque de tuyauterie",
              subtitle: "Ouvrir le catalogue vannes, brides et accessoires",
              icon: <Layers className="w-4 h-4 text-amber-400" />,
              onClick: () => setLeftPanelOpen(true),
            },
            {
              id: "bom",
              title: "Nomenclature & Spécification (BOM)",
              subtitle: "Consulter la liste du matériel et caractéristiques tuyauterie",
              icon: <FileText className="w-4 h-4 text-emerald-400" />,
              onClick: () => { setRightPanelOpen(true); setRightPanelTab("properties"); },
            },
            {
              id: "planche",
              title: "Mode Planche / Cartouche ISO",
              subtitle: "Bascule vers la vue planche d'impression normalisée",
              icon: <Maximize2 className="w-4 h-4 text-blue-400" />,
              onClick: () => setIsoMode(v => v === "editor" ? "planche" : "editor"),
            },
            {
              id: "print",
              title: "Imprimer Isométrie (PDF)",
              subtitle: "Générer le tracé vectoriel au format d'impression (P)",
              icon: <Printer className="w-4 h-4 text-cyan-400" />,
              onClick: printPlanSheet,
            },
            {
              id: "fit",
              title: "Recentrer et cadrer la vue",
              subtitle: "Ajuster le zoom et centrer tout le réseau (Touche 0)",
              icon: <RotateCw className="w-4 h-4 text-purple-400" />,
              onClick: resetView,
            },
          ]}
        />
        <aside className={`pdi-studio-rail fixed bottom-0 left-0 top-[54px] z-[10005] ${railCollapsed ? "w-[50px] px-1" : "w-[158px] px-1.5"} py-2 flex flex-col items-center gap-1 overflow-y-auto no-scrollbar transition-all duration-200 border-r border-zinc-800/80 bg-[#09090B]`}>
          {/* Bouton de repli du rail pour maximiser l'espace de dessin */}
          <button
            type="button"
            onClick={() => setRailCollapsed(v => !v)}
            className="w-full py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-bold flex items-center justify-center gap-1 border border-zinc-800 shrink-0 mb-0.5 transition-all"
            title={railCollapsed ? "Déplier la barre d'outils" : "Replier pour maximiser l'espace de dessin"}
          >
            {railCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />}
            {!railCollapsed && <span className="text-[9px]">Plein écran</span>}
          </button>

          {/* Bouton DÉMO RAPIDE en tête de rail */}
          <button
            type="button"
            title="✨ Charger la Démo Industrielle Complète (Réseau 3D, By-Pass, MSS SP-58, GC)"
            onClick={loadPresetDemoComplexe}
            className={`w-full py-1.5 ${railCollapsed ? "px-1" : "px-2"} rounded-lg bg-gradient-to-r from-purple-700 via-indigo-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white flex items-center justify-center gap-1.5 shadow-md border border-purple-400/50 text-[10px] font-black transition-all active:scale-95 shrink-0 mb-0.5`}
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse shrink-0" />
            {!railCollapsed && <span>CHARGER DÉMO</span>}
          </button>

          {/* GROUPE 1 : OUTILS DE POINTAGE */}
          {!railCollapsed ? (
            <div className="pdi-rail-group-title">Outils de pointage</div>
          ) : (
            <div className="w-full h-px bg-zinc-800 my-0.5" />
          )}
          <div className={`w-full grid ${railCollapsed ? "grid-cols-1" : "grid-cols-2"} gap-1`}>
            <button
              type="button"
              title="Sélection éléments (V)"
              onClick={() => { setInteractionMode("select"); setIsoDrawMode("select"); setCad2dDraftTool(null); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${interactionMode === "select" && isoDrawMode === "select" && !cad2dDraftTool ? "active" : ""}`}
            >
              <MousePointer2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Sélect.</span>}
            </button>
            <button
              type="button"
              title="Main / Pan vue canevas (H / Espace)"
              onClick={() => setInteractionMode("main")}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${interactionMode === "main" ? "active" : ""}`}
            >
              <Hand className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Main</span>}
            </button>
            <button
              type="button"
              title={axisCursorEnabled ? "Désactiver le curseur trièdre pendant le déplacement" : "Activer le curseur trièdre pendant le déplacement"}
              onClick={() => setAxisCursorEnabled((v) => !v)}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${axisCursorEnabled ? "active" : ""}`}
            >
              <Move className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Trièdre {axisCursorEnabled ? "ON" : "OFF"}</span>}
            </button>
            <button
              type="button"
              title="Rotation Caméra 3D Libres (O / Shift+Glisser)"
              onClick={() => { setInteractionMode("orbit"); setStatusMessage("Outil Orbite 3D : Glissez le clic gauche pour faire tourner la caméra autour du modèle"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${interactionMode === "orbit" ? "active" : ""}`}
            >
              <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Orbite</span>}
            </button>
            <button
              type="button"
              title="Copier sélection (Ctrl+D)"
              onClick={() => selectedCad2dIds.length ? duplicateSelectedCad2d() : duplicateSelection()}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Copie</span>}
            </button>
            <button
              type="button"
              title="Échelle / Homothétie (Scale)"
              onClick={() => { if (selectedCad2dIds.length) scaleSelectedCad2d(1.1); else startCad2dScaleCommand(); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Maximize2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Scale</span>}
            </button>
            <button
              type="button"
              title="Déplacer éléments (Move)"
              onClick={() => startCadDraft("move_target")}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Move className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Dépl.</span>}
            </button>
            <button
              type="button"
              title="Pivoter 15° (R / Maj+R)"
              onClick={() => { if (selectedCad2dIds.length) rotateSelectedCad2d(15); else rotateSelectedEquipment(15); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <RotateCw className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Rot. 15°</span>}
            </button>
            <button
              type="button"
              title="Supprimer la sélection (Suppr / Backspace)"
              onClick={() => selectedCad2dIds.length ? deleteSelectedCad2d() : deleteSelection()}
              className={`pdi-rail-tool-btn danger ${railCollapsed ? "col-span-1 justify-center p-1" : "col-span-2 justify-center"} text-red-400`}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              {!railCollapsed && <span>Supprimer</span>}
            </button>
          </div>

          {/* GROUPE 2 : ÉLÉMENTS TUYAUTERIE */}
          {!railCollapsed ? (
            <div className="pdi-rail-group-title">Élément tuyauterie</div>
          ) : (
            <div className="w-full h-px bg-zinc-800 my-0.5" />
          )}
          <div className={`w-full grid ${railCollapsed ? "grid-cols-1" : "grid-cols-2"} gap-1`}>
            <button
              type="button"
              title="Créer un Nœud (N)"
              onClick={() => { setInteractionMode("select"); setIsoDrawMode("node"); setCad2dDraftTool(null); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isoDrawMode === "node" ? "active" : ""}`}
            >
              <CircleDot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Nœud</span>}
            </button>
            <button
              type="button"
              title="Créer un Tube (T)"
              onClick={() => { setInteractionMode("select"); setIsoDrawMode("segment"); setCad2dDraftTool(null); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isoDrawMode === "segment" ? "active" : ""}`}
            >
              <Spline className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Tube</span>}
            </button>
            <button
              type="button"
              title="Insérer Coude (C)"
              onClick={() => { setInteractionMode("select"); setIsoDrawMode("coude"); setCad2dDraftTool(null); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isoDrawMode === "coude" ? "active" : ""}`}
            >
              <CornerDownRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Coude</span>}
            </button>
            <button
              type="button"
              title="Insérer Dérivation Té (E)"
              onClick={() => { setInteractionMode("select"); setIsoDrawMode("te"); setCad2dDraftTool(null); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isoDrawMode === "te" ? "active" : ""}`}
            >
              <GitFork className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Té</span>}
            </button>
            <button
              type="button"
              title="Support MSS SP-58 & Génie Civil (SUP)"
              onClick={() => {
                setRightPanelOpen(true);
                setRightPanelTab("supports");
                if (!activeSupportTypeToPlace) {
                  setActiveSupportTypeToPlace("mss_type_35");
                  setStatusMessage("Mode placement actif : cliquez un tronçon pour implanter un support");
                  setAutocadPrompt("COMMANDE [SUPPORT] : Cliquez un tronçon de tuyauterie pour y ancrer le support (Échap pour annuler).");
                } else {
                  setActiveSupportTypeToPlace(null);
                  setStatusMessage("Mode placement de support désactivé");
                }
              }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${rightPanelTab === "supports" || activeSupportTypeToPlace ? "active" : ""}`}
            >
              <Anchor className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Support</span>}
            </button>
            <button
              type="button"
              title="Cotations & Dimensions (M / DIM)"
              onClick={() => {
                setInteractionMode("select");
                setIsoDrawMode("dimension");
                setCad2dDraftTool(null);
                setDimensionPick(null);
                setRightPanelOpen(true);
                setRightPanelTab("dimensions");
              }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isoDrawMode === "dimension" ? "active" : ""}`}
            >
              <Ruler className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Cotes</span>}
            </button>
          </div>

          {/* GROUPE 3 : DESSIN 2D (CAO) */}
          {!railCollapsed ? (
            <div className="pdi-rail-group-title">Dessin 2D (CAO)</div>
          ) : (
            <div className="w-full h-px bg-zinc-800 my-0.5" />
          )}
          <div className={`w-full grid ${railCollapsed ? "grid-cols-1" : "grid-cols-2"} gap-1`}>
            <button
              type="button"
              title="Ligne 2D (CAD)"
              onClick={() => { setRailFlyout(null); startCadDraft("line"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${cadDraftSession?.tool === "line" ? "active" : ""}`}
            >
              <Slash className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Ligne</span>}
            </button>
            <button
              type="button"
              title="Polyligne 2D (CAD)"
              onClick={() => { setRailFlyout(null); startCadDraft("polyline"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${cadDraftSession?.tool === "polyline" ? "active" : ""}`}
            >
              <Spline className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Poly.</span>}
            </button>
            <button
              type="button"
              title="Rectangle (2 clics diagonale)"
              onClick={() => { setRailFlyout(null); startCadDraft("rectangle"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${cadDraftSession?.tool === "rectangle" ? "active" : ""}`}
            >
              <Square className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Rect.</span>}
            </button>
            <button
              type="button"
              title="Triangle CAD (Équilatéral, Rectangle, Isocèle)"
              onClick={() => setRailFlyout(v => v === "triangle" ? null : "triangle")}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${railFlyout === "triangle" || cadDraftSession?.tool === "triangle" ? "active" : ""}`}
            >
              <Triangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Triang. ▾</span>}
            </button>
            <button
              type="button"
              title="Polygone Régulier (3 à 12+ côtés)"
              onClick={() => setRailFlyout(v => v === "polygon" ? null : "polygon")}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${railFlyout === "polygon" || cadDraftSession?.tool === "polygon" ? "active" : ""}`}
            >
              <Hexagon className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              {!railCollapsed && <span className="truncate">Polyg. ▾</span>}
            </button>
            <button
              type="button"
              title="Cercle 2D (Centre + Rayon)"
              onClick={() => { setRailFlyout(null); startCadDraft("circle"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${cadDraftSession?.tool === "circle" ? "active" : ""}`}
            >
              <Circle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Cercle</span>}
            </button>
            <button
              type="button"
              title="Arc 2D (3 Points ou Centre-Angle)"
              onClick={() => setRailFlyout(v => v === "arc" ? null : "arc")}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${railFlyout === "arc" || cadDraftSession?.tool === "arc" ? "active" : ""}`}
            >
              <Disc3 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              {!railCollapsed && <span className="truncate">Arc ▾</span>}
            </button>
            <button
              type="button"
              title="Texte & Annotation 2D"
              onClick={() => { setRailFlyout(null); startCadDraft("text"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${cadDraftSession?.tool === "text" ? "active" : ""}`}
            >
              <Type className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Texte</span>}
            </button>
            <button
              type="button"
              title="Hachure CAD (Hatch)"
              onClick={() => applyHatchToSelection()}
              className={`pdi-rail-tool-btn ${railCollapsed ? "col-span-1 justify-center p-1" : "col-span-2 justify-center"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              {!railCollapsed && <span>Hachure</span>}
            </button>
          </div>

          {/* GROUPE 4 : SYSTÈME & PROJET */}
          {!railCollapsed ? (
            <div className="pdi-rail-group-title">Système & Projet</div>
          ) : (
            <div className="w-full h-px bg-zinc-800 my-0.5" />
          )}
          <div className={`w-full grid ${railCollapsed ? "grid-cols-1" : "grid-cols-2"} gap-1`}>
            <button
              type="button"
              title="Annuler (Ctrl+Z)"
              onClick={undoGraph}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Undo2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Annul.</span>}
            </button>
            <button
              type="button"
              title="Rétablir (Ctrl+Y)"
              onClick={redoGraph}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Redo2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Rétab.</span>}
            </button>
            <button
              type="button"
              title="Espace de travail Multi-Écran (WORKSPACE)"
              onClick={() => setWorkspaceConfigModalOpen(true)}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isSecondaryConnected ? "bg-cyan-950/60 border-cyan-500/60 text-cyan-300" : ""}`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Multi-Écran</span>}
            </button>
            <button
              type="button"
              title="Inspecteur Technique (Panneau gauche)"
              onClick={() => setLeftPanelOpen(v => !v)}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${leftPanelOpen ? "active" : ""}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Inspecteur</span>}
            </button>
            <button
              type="button"
              title="Bibliothèque composants (Catalogue droit)"
              onClick={() => setLibraryRightOpen(v => !v)}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${libraryRightOpen ? "active" : ""}`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Biblio</span>}
            </button>
            <button
              type="button"
              title="Propriétés & BOM (F2)"
              onClick={() => { setRightPanelOpen(true); setRightPanelTab("properties"); }}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${rightPanelOpen && rightPanelTab === "properties" ? "active" : ""}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Propri.</span>}
            </button>
            <button
              type="button"
              title="Mode Planche ISO"
              onClick={() => setIsoMode(v => v === "editor" ? "planche" : "editor")}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""} ${isoMode === "planche" ? "active" : ""}`}
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Planche</span>}
            </button>
            <button
              type="button"
              title="Plan de Soudage & Carnet de Spools (Weld Map ASME B31.3)"
              onClick={() => setWeldSpoolModalOpen(true)}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Soudage</span>}
            </button>
            <button
              type="button"
              title="Imprimer Isométrie (P)"
              onClick={printPlanSheet}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Impr.</span>}
            </button>
            <button
              type="button"
              title="Recentrer et ajuster la vue (Touche 0 / Fit)"
              onClick={resetView}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Ajuster</span>}
            </button>
            <button
              type="button"
              title="Sauvegarder JSON (Ctrl+S)"
              onClick={exportProjectJson}
              className={`pdi-rail-tool-btn ${railCollapsed ? "justify-center p-1" : ""}`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!railCollapsed && <span className="truncate">Sauver</span>}
            </button>
            <button
              type="button"
              title="Ouvrir fichier JSON"
              onClick={() => importProjectRef.current?.click()}
              className={`pdi-rail-tool-btn ${railCollapsed ? "col-span-1 justify-center p-1" : "col-span-2 justify-center"} text-blue-300`}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              {!railCollapsed && <span>Ouvrir JSON</span>}
            </button>
          </div>

          <div className="flex-1" />
          <button
            type="button"
            title="Aide & Raccourcis (?)"
            onClick={() => setShortcutsOpen(true)}
            className={`pdi-rail-tool-btn w-full justify-center mt-1 text-zinc-400 hover:text-white ${railCollapsed ? "p-1" : ""}`}
          >
            <Info className="w-3.5 h-3.5 shrink-0" />
            {!railCollapsed && <span>Raccourcis (?)</span>}
          </button>
        </aside>

        {/* Flyout extension line/bar from the column */}
        {railFlyout && (
          <div
            className={`fixed ${railCollapsed ? "left-[54px]" : "left-[164px]"} top-[160px] z-[10015] bg-[#0E131B] border border-cyan-500/50 rounded-2xl shadow-2xl p-3 text-white w-72 animate-in fade-in slide-in-from-left-2 duration-150`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {railFlyout === "polygon" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Hexagon className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-black uppercase text-cyan-300">Polygone Régulier</span>
                  </div>
                  <button type="button" onClick={() => setRailFlyout(null)} className="text-slate-400 hover:text-white text-xs px-1">✕</button>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Nombre de côtés :</label>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[3, 4, 5, 6, 8, 10, 12].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setPolygonSidesCount(n);
                          startCadDraft("polygon", undefined, n);
                          setRailFlyout(null);
                        }}
                        className={`py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                          polygonSidesCount === n
                            ? "bg-cyan-600 text-white border-cyan-400 shadow"
                            : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {n === 3 ? "3 (Tri)" : n === 4 ? "4 (Carré)" : n === 5 ? "5 (Penta)" : n === 6 ? "6 (Hexa)" : n === 8 ? "8 (Octo)" : `${n}`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={3}
                      max={64}
                      value={polygonSidesCount}
                      onChange={(e) => setPolygonSidesCount(Math.max(3, Math.min(64, Number(e.target.value) || 3)))}
                      className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-cyan-300 outline-none text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        startCadDraft("polygon", undefined, polygonSidesCount);
                        setRailFlyout(null);
                      }}
                      className="flex-1 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-black shadow-md transition-all"
                    >
                      Tracer ({polygonSidesCount} côtés)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {railFlyout === "triangle" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Triangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase text-amber-300">Triangle CAD</span>
                  </div>
                  <button type="button" onClick={() => setRailFlyout(null)} className="text-slate-400 hover:text-white text-xs px-1">✕</button>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => { startCadDraft("triangle", "equilateral"); setRailFlyout(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
                  >
                    ▲ Équilatéral (Côtés égaux)
                  </button>
                  <button
                    type="button"
                    onClick={() => { startCadDraft("triangle", "rectangle"); setRailFlyout(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
                  >
                    📐 Rectangle (Angle droit 90°)
                  </button>
                  <button
                    type="button"
                    onClick={() => { startCadDraft("triangle", "isocele"); setRailFlyout(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
                  >
                    🔺 Isocèle (2 côtés égaux)
                  </button>
                  <button
                    type="button"
                    onClick={() => { startCadDraft("triangle", "3pts"); setRailFlyout(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
                  >
                    ✦ 3 Points libres
                  </button>
                </div>
              </div>
            )}

            {railFlyout === "arc" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Disc3 className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-black uppercase text-sky-300">Arc CAD</span>
                  </div>
                  <button type="button" onClick={() => setRailFlyout(null)} className="text-slate-400 hover:text-white text-xs px-1">✕</button>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => { startCadDraft("arc", "3points"); setRailFlyout(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-sky-600 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
                  >
                    ⌒ 3 Points (AutoCAD classique)
                  </button>
                  <button
                    type="button"
                    onClick={() => { startCadDraft("arc", "center_radius_angle"); setRailFlyout(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-sky-600 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
                  >
                    ◐ Centre + Rayon + Angle
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </>}
      {aboutOpen && (
        <div className="fixed inset-0 z-[10030] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => setAboutOpen(false)}>
          <div className="w-[min(480px,94vw)] rounded-2xl border border-slate-700 bg-[#11151B] p-6 text-center shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <PdiBrandMark variant="square" size="lg" className="pdi-about-logo flex items-center justify-center" />
            </div>
            <h3 className="mt-3 text-lg font-black text-white">PD &amp; I — Pipeline Design &amp; Isometrics</h3>
            <p className="mt-1 text-xs font-bold text-white tracking-wide">Powered by ORTHOGONAL - ENG</p>
            <p className="mt-4 text-[11px] text-slate-400">© 2026 ORTHOGONAL - ENG. All rights reserved.</p>
            <p className="text-[10px] text-slate-500">Version 4.8d1</p>
            <button onClick={() => setAboutOpen(false)} className="mt-5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-black text-white hover:bg-blue-500 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}
    {recoveryCandidate&&<div className="fixed inset-0 z-[10020] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-[min(520px,94vw)] bg-white rounded-2xl border shadow-2xl p-5"><div className="text-[10px] font-black uppercase text-blue-600">Récupération V4.7.4</div><h3 className="text-lg font-black mt-1">{recoverySource==="previous"?"Sauvegarde précédente récupérée":"Projet autosauvegardé détecté"}</h3><p className="text-xs text-slate-600 mt-2">{recoveryCandidate.project.name} · {recoveryCandidate.model.nodes.length} nœuds · {recoveryCandidate.model.segments.length} tronçons</p><div className="flex flex-wrap justify-end gap-2 mt-5"><button onClick={()=>{if(recoverySource==="previous")localStorage.removeItem(AUTOSAVE_CURRENT_KEY);autosaveBaselineRef.current=persistenceFingerprint(buildProjectFileV474());setRecoveryCandidate(null);setRecoverySource(null);setStatusMessage("Récupération ignorée · archive précédente conservée")}} className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold">Ignorer</button><button onClick={()=>{localStorage.removeItem(AUTOSAVE_CURRENT_KEY);localStorage.removeItem(AUTOSAVE_PREVIOUS_KEY);localStorage.removeItem(AUTOSAVE_LEGACY_KEY);localStorage.removeItem(AUTOSAVE_CORRUPT_KEY);autosaveBaselineRef.current=persistenceFingerprint(buildProjectFileV474());setRecoveryCandidate(null);setRecoverySource(null);setRecoveryFailure(null);setStatusMessage("Sauvegarde locale supprimée")}} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-bold">Supprimer</button><button onClick={()=>{try{// V4.7.4d_RESTORE_CLEAN : restaurer n'est pas une modification.
autosaveBaselineRef.current=persistenceFingerprint(recoveryCandidate);
if(recoverySource==="previous"||recoverySource==="legacy"){localStorage.setItem(AUTOSAVE_CURRENT_KEY,JSON.stringify(recoveryCandidate));}
applyProjectSnapshot(recoveryCandidate,recoverySource==="previous"?"Sauvegarde précédente restaurée":"Projet autosauvegardé restauré");
const restoredTime=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
setLastSavedAt(restoredTime);setSaveState("autosaved");setRecoveryCandidate(null);setRecoverySource(null);}catch(error){void pdiAlert(error instanceof Error?error.message:"Restauration impossible")}}} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-black">Restaurer</button></div></div></div>}
    {recoveryFailure&&<div className="fixed inset-0 z-[10021] bg-slate-950/75 flex items-center justify-center p-4"><div className="w-[min(520px,94vw)] bg-white rounded-2xl border shadow-2xl p-5"><div className="text-[10px] font-black uppercase text-red-600">Récupération bloquée</div><h3 className="text-lg font-black mt-1">Archives locales illisibles</h3><p className="text-xs text-slate-600 mt-2">{recoveryFailure} Une copie de la sauvegarde actuelle a été placée en quarantaine. Aucune autosauvegarde ne sera écrite avant ton choix.</p><div className="flex flex-wrap justify-end gap-2 mt-5"><button onClick={()=>{autosaveBaselineRef.current=persistenceFingerprint(buildProjectFileV474());setRecoveryFailure(null);setStatusMessage("Nouvelle session autorisée")}} className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold">Continuer sans restaurer</button><button onClick={()=>{localStorage.removeItem(AUTOSAVE_CURRENT_KEY);localStorage.removeItem(AUTOSAVE_PREVIOUS_KEY);localStorage.removeItem(AUTOSAVE_LEGACY_KEY);localStorage.removeItem(AUTOSAVE_CORRUPT_KEY);setRecoveryFailure(null);setStatusMessage("Archives locales supprimées")}} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-black">Supprimer les archives</button></div></div></div>}
    {commandPaletteOpen&&<div className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex justify-center pt-[12vh]" onMouseDown={()=>setCommandPaletteOpen(false)}><div className="w-[min(560px,92vw)] h-fit bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden" onMouseDown={e=>e.stopPropagation()}><div className="px-4 py-3 border-b border-slate-700"><div className="text-[10px] font-black text-cyan-400 uppercase">Palette de commandes · Ctrl+K</div><div className="text-sm font-bold mt-1 text-slate-100">Choisir une action</div></div><div className="p-2 grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => runWorkspaceCommand(loadPresetDemoComplexe, "Démo Industrielle Complète")}
                className="col-span-2 p-3 text-left rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-pink-900 hover:from-purple-800 hover:to-indigo-800 text-white border border-purple-400/50 shadow-lg flex items-center justify-between transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse shrink-0" />
                  <div>
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      <span className="text-yellow-300">DEMO</span> · Démo Industrielle Complète 3D
                    </div>
                    <div className="text-[10px] text-purple-200/80 font-normal mt-0.5">
                      Réseau 3D, By-Pass, 26 raccords, 10 supports MSS SP-58 &amp; GC, cotations
                    </div>
                  </div>
                </div>
                <span className="text-[10px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded border border-purple-400/40 font-mono font-bold shrink-0">
                  ASME / MSS
                </span>
              </button>
              <button
                onClick={() => runWorkspaceCommand(() => setSolid3dViewerOpen(true), "Vue 3D Solide Extrudée")}
                className="col-span-2 p-3 text-left rounded-xl bg-gradient-to-r from-blue-950 via-cyan-950 to-slate-900 hover:from-blue-900 hover:to-cyan-900 text-cyan-200 border border-cyan-700/60 shadow-lg flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Box className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-cyan-100 flex items-center gap-1.5">
                      Vue 3D Solide Extrudée &amp; Contrôle d'Orbite
                    </div>
                    <div className="text-[10px] text-slate-300 font-normal mt-0.5">
                      Rendu solide temps-réel, spools colorés, soudures 3D, inspection &amp; snapshot HD
                    </div>
                  </div>
                </div>
                <span className="text-[10px] bg-cyan-800/40 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-mono font-bold shrink-0">
                  3D / Touche 3
                </span>
              </button>
              <button type="button" onClick={()=>runWorkspaceCommand(()=>setIsoDrawMode("segment"),"Outil Tube")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>T</b> · Nouveau tube</button><button type="button" onClick={()=>runWorkspaceCommand(()=>setIsoDrawMode("node"),"Outil Nœud")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>N</b> · Nouveau nœud</button><button type="button" onClick={()=>runWorkspaceCommand(resetView,"Vue recentrée")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>F</b> · Recentrer</button><button type="button" onClick={()=>runWorkspaceCommand(exportProjectJson,"Projet exporté")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>Ctrl+S</b> · Sauver JSON</button><button type="button" onClick={()=>runWorkspaceCommand(()=>importProjectRef.current?.click(),"Ouvrir JSON")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>Ctrl+O</b> · Ouvrir JSON</button><button type="button" onClick={()=>runWorkspaceCommand(()=>setShortcutsOpen(true),"Aide raccourcis")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>?</b> · Raccourcis</button><button type="button" onClick={()=>runWorkspaceCommand(printPlanSheet,"Impression A3")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>P</b> · Imprimer</button>
              <button
                onClick={() =>
                  runWorkspaceCommand(
                    () => {
                      setIsoDrawMode("dimension");
                      setInteractionMode("select");
                      setDimensionPick(null);
                    },
                    "Outil cotation",
                  )
                }
                className="p-3 text-left rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-100 border border-cyan-800"
              >
                <b>M</b> · Cotation 2 ancrages
              </button>
              <button
                onClick={() =>
                  runWorkspaceCommand(
                    () => {
                      setActiveSupportTypeToPlace("mss_type_35");
                      setRightPanelOpen(true);
                      setRightPanelTab("supports");
                      setStatusMessage("Cliquez sur un tronçon pour implanter le support");
                    },
                    "Placer support MSS SP-58",
                  )
                }
                className="p-3 text-left rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-100 border border-indigo-800"
              >
                <b>SUP</b> · Support MSS SP-58 / GC
              </button>
              <button onClick={() => runWorkspaceCommand(startAlignWizard, "Aligner par objet")} className="p-3 text-left rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-100 border border-cyan-800"><b>AL</b> · Aligner sur objet & échelle</button>
              <button onClick={() => runWorkspaceCommand(startParallelWizard, "Parallèle")} className="p-3 text-left rounded-xl bg-amber-950 hover:bg-amber-900 text-amber-100 border border-amber-800"><b>//</b> · Rendre parallèle</button>
              <button onClick={() => runWorkspaceCommand(() => alignSelectedNodesAxis("x"), "Alignement X")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>AX</b> · Aligner X (Monde)</button>
              <button onClick={() => runWorkspaceCommand(() => alignSelectedNodesAxis("y"), "Alignement Y")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>AY</b> · Aligner Y (Monde)</button>
              <button onClick={() => runWorkspaceCommand(() => alignSelectedNodesAxis("z"), "Alignement Z")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>AZ</b> · Aligner Z (Monde)</button>
              <button onClick={() => runWorkspaceCommand(alignSelectedEquipmentOnTube, "Aligner sur tube")} className="p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"><b>AT</b> · Équipement sur tube</button>
              <button onClick={() => runWorkspaceCommand(redressIsoSelection, "Redresser ISO")} className="p-3 text-left rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-100 border border-emerald-800"><b>ISO</b> · Redresser ISO</button>
              <button onClick={() => runWorkspaceCommand(removeSelectedDimensions, "Cotation supprimée")} className="p-3 text-left rounded-xl bg-red-950 hover:bg-red-900 text-red-100 border border-red-800"><b>⌫</b> · Suppr. dernière cote</button></div></div></div>}
    {shortcutsOpen && (
      <div className="fixed inset-0 z-[10001] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onMouseDown={() => setShortcutsOpen(false)}>
        <div className="bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-700 w-[min(780px,95vw)] p-6 max-h-[90vh] flex flex-col gap-4 overflow-hidden" onMouseDown={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-100 tracking-wide uppercase">Tableau de Guide &amp; Raccourcis PDI CAO</h3>
                <p className="text-[11px] text-slate-400">Normes ASME B31.3 · ISO 14692 · MSS SP-58 · Vue 3D &amp; Soudures</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShortcutsOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors"
              title="Masquer le tableau de guide (Hide)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Masquer (Hide)</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto pr-1 text-xs max-h-[60vh]">
            {[
              ["V", "Sélection"],
              ["H / Espace", "Outil Main (Pan)"],
              ["N", "Nouveau Nœud"],
              ["T", "Nouveau Tube"],
              ["E", "Nouveau Té"],
              ["C", "Nouveau Coude"],
              ["3 / Alt+3", "Vue 3D Solide Extrudée"],
              ["W", "Afficher/Masquer Soudures (Wxxx)"],
              ["SP", "Coloration Spools Préfab"],
              ["MSS", "Supports MSS SP-58"],
              ["R / Shift+R", "Rotation Organe (±15°)"],
              ["G / #", "Grille Isométrique"],
              ["D / ⇔", "Afficher/Masquer Cotes"],
              ["M", "Cotation 2 Ancrages"],
              ["Aa / L", "Labels & Annotations"],
              ["F / 0", "Recentrer la Vue (Fit)"],
              ["+ / −", "Zoom Avant / Arrière"],
              ["Suppr", "Supprimer Sélection"],
              ["Ctrl+Z", "Annuler la Dernière Action"],
              ["Ctrl+S", "Exporter Projet JSON"],
              ["Ctrl+K", "Palette de Commandes"],
              ["P", "Impression Planche A3"],
              ["Échap", "Annuler l’outil en cours"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 transition-colors">
                <kbd className="px-2 py-1 bg-slate-950 border border-slate-700 text-cyan-300 rounded-lg font-mono font-black text-[11px] shadow-sm shrink-0">
                  {k}
                </kbd>
                <span className="text-slate-200 font-medium truncate">{v}</span>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Raccourci rapide pour ce guide : Touche <b className="text-emerald-400 font-mono">?</b></span>
            <button
              type="button"
              onClick={() => setShortcutsOpen(false)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition-colors"
            >
              Fermer le guide
            </button>
          </div>
        </div>
      </div>
    )}

    <IsoPrintModal
      isOpen={printModalOpen}
      onClose={() => {
        setPrintModalOpen(false);
        setPrintWeldMapMode(false);
      }}
      projectName={projectName}
      wilaya={wilaya}
      pressDesign={pressDesign}
      hydrotest={hydrotest}
      nodes={nodes}
      segments={segments}
      dimensions={dimensions}
      joints={projectJoints}
      bomRows={printBomRows}
      initialUnitSystem={unitSystem}
      supports={supports}
      cad2dEntities={cad2dEntities}
      selectedNodeIds={selectedNodeIds}
      selectedSegmentIds={selectedSegmentIds}
      selectedSupportId={selectedSupportId}
      selectedCad2dIds={selectedCad2dIds}
      weldSpoolData={weldSpoolData}
      initialWeldMapMode={printWeldMapMode}
    />

    <IsoWeldSpoolModal
      isOpen={weldSpoolModalOpen}
      onClose={() => setWeldSpoolModalOpen(false)}
      weldSpoolData={weldSpoolData}
      onUpdateWeld={handleUpdateWeld}
      onOpenPrintModal={handleOpenPrintModalFromWeld}
      activeSpoolFilter={activeSpoolFilter}
      onSelectSpool={setActiveSpoolFilter}
      onOpen3DViewer={(spoolId) => {
        if (spoolId) setActiveSpoolFilter(spoolId);
        setWeldSpoolModalOpen(false);
        setSolid3dViewerOpen(true);
      }}
      onSwitchToIso={() => {
        setWeldSpoolModalOpen(false);
        setSolid3dViewerOpen(false);
      }}
    />

    <Iso3DViewerModal
      isOpen={solid3dViewerOpen}
      onClose={() => setSolid3dViewerOpen(false)}
      data={{
        nodes,
        segments,
        welds: weldSpoolData.welds,
        spools: weldSpoolData.spools,
        supports,
        projectName,
        activeUnitSystem: unitSystem === "imperial" ? "imperial" : "metric",
        envelope: {
          active: envelopeActive,
          length: envelopeLength,
          width: envelopeWidth,
          height: envelopeHeight,
          x: envelopeX,
          y: envelopeY,
          z: envelopeZ,
          preset: envelopePreset,
        },
      }}
      onSwitchToIso={() => {
        setSolid3dViewerOpen(false);
        setWeldSpoolModalOpen(false);
      }}
      onSwitchToWeldMap={() => {
        setSolid3dViewerOpen(false);
        setWeldSpoolModalOpen(true);
      }}
    />

    <PdiWorkspaceConfigModal
      isOpen={workspaceConfigModalOpen}
      onClose={() => setWorkspaceConfigModalOpen(false)}
      config={workspaceConfig}
      onSaveConfig={(newCfg) => {
        setWorkspaceConfig(newCfg);
        pdiWorkspaceBus.saveConfig(newCfg);
      }}
      isSecondaryConnected={isSecondaryConnected}
      onOpenSecondaryWindow={(view) => {
        pdiWorkspaceBus.openSecondaryWindow(view);
      }}
      onCloseSecondaryWindow={() => {
        pdiWorkspaceBus.closeSecondaryWindow();
      }}
    />

    <div className={`${workspaceFullscreen?"hidden":""} bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white shadow-lg`}>
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <div className="flex gap-2 mb-2">
            <span className="bg-blue-500/20 text-blue-300 border border-blue-400/40 text-[10px] font-black px-2 py-1 rounded-full">ÉDITEUR MÉCANIQUE</span>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2 py-1 rounded-full">ISO 30°</span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1"><Box className="w-3 h-3 text-cyan-400"/> VUE 3D SOLIDE</span>
          </div>
          <h2 className="text-2xl font-black">Concepteur & Schéma Isométrique de Tuyauterie</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Éditeur libre : aucune chaîne P01/P02 imposée. Créez vos nœuds, tronçons,
            branches, postes, piquages et équipements ; les positions sont cumulatives.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSolid3dViewerOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all border border-cyan-400/30 active:scale-95"
            title="Visualiser le réseau complet en 3D Solide Extrudé & Orbite (Raccourci : Touche 3)"
          >
            <Box className="w-4 h-4 text-cyan-200" /> Vue 3D Solide
          </button>
          <button
            type="button"
            onClick={loadPresetDemoComplexe}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all border border-purple-400/30 active:scale-95"
            title="Charger la Démo 3D complète avec géométrie extrudée, 26 raccords, 10 supports MSS et les 3 Rendus Synchronisés"
          >
            <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse"/> Démo 3D (3 Rendus : ISO · Soudure · 3D)
          </button>
          <button
            type="button"
            onClick={() => setWeldSpoolModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all border border-amber-400/30 active:scale-95"
            title="Plan de Soudage & Carnet de Spools (Weld Map ASME B31.3)"
          >
            <Flame className="w-4 h-4 text-amber-200" /> Plan de Soudage ({weldSpoolData.spools.length} Spools / {weldSpoolData.welds.length} Soudures)
          </button>
          <button type="button" onClick={loadPresetPoste} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-200 rounded-xl text-xs font-black transition-colors">
            <Flame className="inline w-4 h-4 mr-1 text-orange-400"/> Exemple poste
          </button>
          <button type="button" onClick={loadPresetGare} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-200 rounded-xl text-xs font-black transition-colors">
            <Waypoints className="inline w-4 h-4 mr-1 text-cyan-400"/> Exemple gare racleur
          </button>
          <button
            type="button"
            onClick={loadPresetChambreTechnique}
            className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all border border-teal-400/30 active:scale-95"
            title="Charger la Démo de Chambre Technique d'Eau Glacée (Local fermé confiné)"
          >
            <Box className="w-4 h-4 text-emerald-200" /> Démo Chambre Technique
          </button>
          <button
            type="button"
            onClick={loadPresetSkidFiltration}
            className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all border border-sky-400/30 active:scale-95"
            title="Charger la Démo de Skid de Filtration conforme à isometrie.png (3 lignes parallèles DN150)"
          >
            <LayoutGrid className="w-4 h-4 text-sky-200" /> Démo Skid Filtration (isometrie.png)
          </button>
          <button type="button" onClick={printPlanSheet} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors">
            <Printer className="inline w-4 h-4 mr-1"/> Imprimer
          </button>
        </div>
      </div>
    </div>

    {/* BANC D'ESSAI TRIPODE : TESTEUR DES 3 RENDUS (ISO 2D, PLAN SOUDAGE & 3D SOLIDE EXTRUDÉE) */}
    <div className={`${workspaceFullscreen?"hidden":""} bg-gradient-to-r from-slate-950 via-[#0a1120] to-[#0c182c] border border-cyan-500/30 rounded-2xl px-4 py-2.5 text-white shadow-xl flex flex-wrap items-center justify-between gap-3`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/40 shrink-0">
          <Sparkles className="w-4 h-4 text-cyan-200" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-300">Banc d'Essai · 3 Rendus Synchronisés</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-700/50">ASME B31.3 / ISO 14692</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Comparez le réseau sous ses 3 projections normées : <b>1. Isométrie 2D</b>, <b>2. Plan de Soudage & Spools</b> et <b>3. Modélisation 3D Solide Extrudée</b>.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setWeldSpoolModalOpen(false);
            setSolid3dViewerOpen(false);
            setStatusMessage("Rendu 1 Actif : Schéma Isométrique 2D (ISO 30°)");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm ${
            !weldSpoolModalOpen && !solid3dViewerOpen
              ? "bg-blue-600 text-white ring-2 ring-blue-400 shadow-blue-900/40"
              : "bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
          }`}
          title="Rendu 1 : Vue Isométrique Vectorielle 2D (Cotations, Symboles, Cartouche ISO)"
        >
          <span>📐 1. Vue Isométrique 2D</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSolid3dViewerOpen(false);
            setWeldSpoolModalOpen(true);
            setStatusMessage("Rendu 2 Actif : Plan de Soudage & Carnet de Spools (Weld Map)");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm ${
            weldSpoolModalOpen
              ? "bg-amber-600 text-white ring-2 ring-amber-400 shadow-amber-900/40"
              : "bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 hover:text-white border border-amber-800/60"
          }`}
          title="Rendu 2 : Plan de Soudage & Carnet de Spools (Weld Map, Shop/Field Welds, CND)"
        >
          <Flame className="w-3.5 h-3.5 text-amber-300" />
          <span>🔥 2. Plan Soudage & Spools ({weldSpoolData.welds.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setWeldSpoolModalOpen(false);
            setSolid3dViewerOpen(true);
            setStatusMessage("Rendu 3 Actif : Vue 3D Solide Extrudée & Orbite");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm ${
            solid3dViewerOpen
              ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white ring-2 ring-cyan-400 shadow-cyan-900/40"
              : "bg-gradient-to-r from-cyan-950/60 to-blue-950/60 text-cyan-200 hover:text-white border border-cyan-500/40"
          }`}
          title="Rendu 3 : Tuyauterie 3D Solide Extrudée (Three.js Orbit, tubes solides, coudes, brides, vannes, soudures 3D & supports)"
        >
          <Box className="w-3.5 h-3.5 text-cyan-300" />
          <span>🧊 3. Vue 3D Solide Extrudée</span>
        </button>

        <button
          type="button"
          onClick={() => {
            loadPresetDemoComplexe();
            setStatusMessage("✨ Démo Tuyauterie 3D Extrudée chargée : Testez les 3 Rendus Synchronisés !");
          }}
          className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white flex items-center gap-1.5 shadow-md border border-purple-400/40 active:scale-95 ml-1"
          title="Recharger la Démo Industrielle Complète avec Géométrie 3D, By-Pass et 3 Rendus"
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
          <span>Charger Démo 3D</span>
        </button>
      </div>
    </div>

    <div className={`${workspaceFullscreen?"hidden":"sticky"} top-2 z-40 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-sm px-2 py-2 flex-wrap items-center justify-between gap-2 ${workspaceFullscreen?"":"flex"}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLeftPanelOpen(v => !v)}
          className={`h-9 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${leftPanelOpen ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}
          title="Panneau d'Inspection (Géométrie, nœuds, tronçons à gauche)"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Inspecteur</span>
        </button>
        <button
          type="button"
          onClick={() => setLibraryRightOpen(v => !v)}
          className={`h-9 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${libraryRightOpen ? "bg-amber-600 text-white shadow-sm" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}
          title="Bibliothèque de Tuyauterie & Catalogue CAO (à droite)"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Bibliothèque</span>
        </button>
        <button onClick={()=>{setInteractionMode("select");setIsoDrawMode("select")}} className={`h-9 px-3 rounded-lg text-xs font-black ${interactionMode==="select"&&isoDrawMode==="select"?"bg-blue-600 text-white":"bg-slate-100"}`}>V Sélection</button>
        <button onClick={()=>setInteractionMode("main")} className={`h-9 px-3 rounded-lg text-xs font-black ${interactionMode==="main"?"bg-cyan-600 text-white":"bg-slate-100"}`}>H Main</button>
        <button onClick={()=>setIsoDrawMode("segment")} className="h-9 px-3 rounded-lg bg-slate-100 text-xs font-black">T Tube</button>
        <button onClick={()=>setIsoDrawMode("node")} className="h-9 px-3 rounded-lg bg-slate-100 text-xs font-black">N Nœud</button>
        <button onClick={()=>setIsoDrawMode("te")} className="h-9 px-3 rounded-lg bg-slate-100 text-xs font-black">E Té</button>
        <button
          type="button"
          onClick={()=>setSolid3dViewerOpen(true)}
          title="Vue 3D Solide Extrudée & Orbite (Raccourci : 3)"
          className="h-9 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Box className="w-4 h-4 text-cyan-200"/> 3D Solide
        </button>
      </div>
      <div className="flex items-center gap-1"><button type="button" onClick={undoGraph} className="h-9 px-3 rounded-lg bg-slate-100 text-xs font-black">↶ Ctrl+Z</button><button type="button" onClick={exportProjectJson} className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-black">Sauver JSON</button><input ref={importProjectRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>{importProjectJson(e.target.files?.[0]);e.currentTarget.value=""}}/><button type="button" onClick={()=>importProjectRef.current?.click()} className="h-9 px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">Ouvrir JSON</button><button type="button" onClick={()=>setCommandPaletteOpen(true)} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-black">Ctrl+K</button><button type="button" onClick={()=>setShortcutsOpen(true)} className="h-9 w-9 rounded-lg bg-slate-100 font-black">?</button><button type="button" onClick={()=>setWorkspaceFullscreen(v=>!v)} className="h-9 px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">{workspaceFullscreen?"Retour accueil":"Mode focus"}</button></div>
    </div>

        {isoMode==="planche" && <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4 mb-4">
          <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase flex gap-2"><Layers className="w-4 h-4 text-blue-600"/>Sous-couche Génie Civil</h3><span className="text-[9px] text-slate-500">PNG / JPG / SVG</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400"><input type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" className="hidden" onChange={e=>onGcFile(e.target.files?.[0])}/><Plus className="mx-auto w-5 h-5 text-blue-600"/><span className="block text-[10px] font-black mt-1">Charger le fond GC</span><span className="block text-[9px] text-slate-500">{gcUnderlayName||"Exporter le fond Croquis/CAD en image"}</span></label>
            <div className="space-y-2"><label className="text-[10px] font-bold block">Opacité : {Math.round(gcOpacity*100)}%</label><input type="range" min="0" max="1" step=".01" value={gcOpacity} onChange={e=>setGcOpacity(Number(e.target.value))} className="w-full"/><label className="text-[10px] font-bold block">Échelle : {gcScale.toFixed(2)}×</label><input type="range" min=".5" max="2" step=".01" value={gcScale} onChange={e=>setGcScale(Number(e.target.value))} className="w-full"/><div className="grid grid-cols-2 gap-2"><input type="number" value={gcX} onChange={e=>setGcX(Number(e.target.value)||0)} className="border rounded px-2 py-1 text-[10px]" placeholder="Décalage X"/><input type="number" value={gcY} onChange={e=>setGcY(Number(e.target.value)||0)} className="border rounded px-2 py-1 text-[10px]" placeholder="Décalage Y"/></div></div>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setPlanPage(1)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${planPage===1?"bg-blue-600 text-white":"bg-slate-100"}`}>Planche 1</button><button type="button" onClick={()=>setPlanPage(2)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${planPage===2?"bg-blue-600 text-white":"bg-slate-100"}`}>Planche 2</button><button type="button" onClick={printPlanSheet} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-900 text-white"><Printer className="inline w-3 h-3 mr-1"/>Imprimer A3 paysage</button></div>
        </div>}

    <div className={`${workspaceFullscreen ? "h-[calc(100vh-104px)] overflow-hidden" : ""} grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch`}>

      <div className={`${leftPanelOpen?"lg:col-span-3":"hidden"} ${workspaceFullscreen ? "h-full min-h-0 overflow-y-auto pr-1" : "space-y-3 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1"} space-y-3`}>
        {/* En-tête de la barre latérale gauche : Inspecteur Technique */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 rounded-2xl border border-slate-700/80 p-3 shadow-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/90 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="truncate">
              <h3 className="text-xs font-black uppercase text-slate-100 tracking-wide">
                Inspecteur Technique
              </h3>
              <p className="text-[9px] text-slate-400 truncate">
                Géométrie, nœuds & tronçons
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLeftPanelOpen(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/50 border border-slate-700 hover:border-red-500/60 text-slate-300 hover:text-red-300 text-[10px] font-black transition-all cursor-pointer shrink-0"
            title="Masquer / Fermer le panneau d'inspection (Hide)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fermer</span>
          </button>
        </div>

        {/* BOUTON ROTATION +/- 15° DÉDIÉ AVEC APPUI PROLONGÉ */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-700/80 p-2.5 shadow-lg space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <span className="flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-cyan-400" />
              Rotation Équipement / Objet
            </span>
            <span className="text-[9px] text-cyan-400 font-mono">±15°</span>
          </div>
          <PdiRotationButton15
            onRotate={(angle) => universalRotate(angle)}
            onFlip={() => flipSelectedEquipment()}
          />
        </div>

        {/* PATCH 007d — Propriétés 2D compactes style CAD */}
        {selectedCad2dEntity && (
          <div className="pdi-cad-props-mini mb-3">
            <div className="pdi-cad-props-head">
              <b>{selectedCad2dEntity.type.toUpperCase()}</b>
              <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">{selectedCad2dIds.length} sel.</span>
            </div>
            <details open className="border-b border-slate-800">
              <summary>Général</summary>
              <div className="pdi-props-grid">
                <label>Calque
                  <select value={selectedCad2dEntity.layerId} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{layerId:e.target.value})}>
                    {cad2dLayers.map(layer=><option key={layer.id} value={layer.id}>{layer.name}</option>)}
                  </select>
                </label>
                <label>Couleur
                  <input type="color" value={selectedCad2dEntity.color} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{color:e.target.value})}/>
                </label>
                <label>Épaisseur
                  <input type="number" min="0.5" step="0.5" value={selectedCad2dEntity.lineWeight || 1.5} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{lineWeight:Number(e.target.value)||1.5})}/>
                </label>
                <label>Type de ligne
                  <select value={selectedCad2dEntity.lineType || "continuous"} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{lineType:e.target.value as Cad2dEntity["lineType"]})}>
                    <option value="continuous">Continu</option>
                    <option value="dashed">Tirets</option>
                    <option value="center">Axe</option>
                    <option value="hidden">Caché</option>
                  </select>
                </label>
                <label>Opacité
                  <input type="number" min="0.1" max="1" step="0.05" value={selectedCad2dEntity.opacity ?? 1} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{opacity:Number(e.target.value)||1})}/>
                </label>
                <label>Rotation (°)
                  <input type="number" step="1" value={selectedCad2dEntity.rotation || 0} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{rotation:Number(e.target.value)||0})}/>
                </label>
                {(selectedCad2dEntity.type === "circle" || selectedCad2dEntity.type === "arc") && (
                  <label>Rayon (m)
                    <input type="number" step="0.1" value={selectedCad2dEntity.radius || 1} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{radius:Number(e.target.value)||1})}/>
                  </label>
                )}
                <label>Intention
                  <select value={selectedCad2dEntity.metadata?.intent || "draft"} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{metadata:{...(selectedCad2dEntity.metadata||{}),intent:e.target.value as any}})}>
                    <option value="draft">Draft</option>
                    <option value="pipe_axis">Axe tuyauterie</option>
                    <option value="equipment">Équipement</option>
                    <option value="annotation">Annotation</option>
                  </select>
                </label>
              </div>
            </details>
            {selectedCad2dEntity.type === "text" && (
              <details open className="border-b border-slate-800">
                <summary>Texte</summary>
                <div className="pdi-props-grid">
                  <label className="wide">Contenu
                    <input value={selectedCad2dEntity.text || ""} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{text:e.target.value})}/>
                  </label>
                  <label>Taille (px)
                    <input type="number" min="6" max="96" value={selectedCad2dEntity.fontSize || 14} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{fontSize:Number(e.target.value)||14})}/>
                  </label>
                  <label>Police
                    <select value={selectedCad2dEntity.fontFamily || "Arial"} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{fontFamily:e.target.value})}>
                      <option>Arial</option>
                      <option>Inter</option>
                      <option>JetBrains Mono</option>
                      <option>Georgia</option>
                      <option>Times New Roman</option>
                      <option>Courier New</option>
                    </select>
                  </label>
                  <label>Graisse
                    <select value={String(selectedCad2dEntity.fontWeight || "900")} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{fontWeight:e.target.value})}>
                      <option value="400">Normal</option>
                      <option value="700">Bold</option>
                      <option value="900">Black</option>
                    </select>
                  </label>
                  <label>Alignement
                    <select value={selectedCad2dEntity.textAlign || "left"} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{textAlign:e.target.value as Cad2dEntity["textAlign"]})}>
                      <option value="left">Gauche</option>
                      <option value="center">Centre</option>
                      <option value="right">Droite</option>
                    </select>
                  </label>
                </div>
              </details>
            )}
            <details open>
              <summary>Actions CAD</summary>
              <div className="pdi-props-actions">
                <button type="button" onClick={()=>rotateSelectedCad2d(15)}>Rot+15°</button>
                <button type="button" onClick={()=>rotateSelectedCad2d(-15)}>Rot-15°</button>
                <button type="button" onClick={()=>scaleSelectedCad2d(1.1)}>Scale+10%</button>
                <button type="button" onClick={()=>scaleSelectedCad2d(0.9)}>Scale-10%</button>
                <button type="button" onClick={mirrorSelectedCad2dX}>Miroir</button>
                <button type="button" onClick={duplicateSelectedCad2d}>Dupliquer</button>
                <button type="button" onClick={bringSelectedCad2dFront}>Premier plan</button>
                <button type="button" onClick={sendSelectedCad2dBack}>Arrière plan</button>
                <button type="button" onClick={()=>setSelectedCad2dLocked(!selectedCad2dEntity.locked)}>{selectedCad2dEntity.locked?"Déverrouiller":"Verrouiller"}</button>
                <button type="button" onClick={deleteSelectedCad2d} className="danger">Supprimer</button>
              </div>
            </details>
          </div>
        )}

        {/* CAD Property Inspector for active selection */}
        {(() => {
          const selectedSeg = segments.find(s => s.id === selectedSegmentId || selectedSegmentIds.includes(s.id));
          const selectedNd = nodes.find(n => n.id === selectedNodeId || selectedNodeIds.includes(n.id));
          if (selectedSeg) {
            return (
              <div className="bg-slate-900 border-2 border-blue-500/70 rounded-2xl p-3 shadow-lg space-y-2.5 text-white">
                <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-black uppercase text-blue-300">Propriétés Tronçon</h3>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-bold">
                    DN{selectedSeg.dn} ({dia(selectedSeg.dn).inch})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Pipeline / Source</label>
                    <input
                      value={selectedSeg.sourceName || ""}
                      onChange={e => setSegments(prev => prev.map(s => s.id === selectedSeg.id ? { ...s, sourceName: e.target.value } : s))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white focus:ring-1 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Longueur (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={selectedSeg.length}
                      onChange={e => setSegmentLength(selectedSeg.id, Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-cyan-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Diamètre</label>
                    <select
                      value={selectedSeg.dn}
                      onChange={e => setSegments(prev => prev.map(s => s.id === selectedSeg.id ? { ...s, dn: Number(e.target.value) } : s))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold text-white outline-none"
                    >
                      {DIAMETERS.map(([dn, inch, od]) => (
                        <option key={dn} value={dn}>DN{dn} ({inch})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Classe PN</label>
                    <select
                      value={selectedSeg.pn}
                      onChange={e => setSegments(prev => prev.map(s => s.id === selectedSeg.id ? { ...s, pn: e.target.value } : s))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold text-white outline-none"
                    >
                      <option>Class 150</option>
                      <option>Class 300</option>
                      <option>Class 400</option>
                      <option>Class 600</option>
                      <option>Class 900</option>
                      <option>Class 1500</option>
                      <option>Class 2500</option>
                      <option>PN16</option>
                      <option>PN40</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Couleur</label>
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">
                      <input
                        type="color"
                        value={selectedSeg.color || "#0284c7"}
                        onChange={e => setSegments(prev => prev.map(s => s.id === selectedSeg.id ? { ...s, color: e.target.value } : s))}
                        className="h-5 w-6 p-0 border-0 bg-transparent cursor-pointer"
                      />
                      <span className="text-[9px] font-mono text-slate-300 uppercase">{selectedSeg.color || "#0284c7"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => insertGraphicFitting(selectedSeg.id, "vanne_passage_total", 0.5)}
                    className="flex-1 py-1 bg-sky-800/80 hover:bg-sky-700 text-sky-200 rounded text-[9px] font-black"
                  >
                    + Vanne
                  </button>
                  <button
                    type="button"
                    onClick={() => insertGraphicFitting(selectedSeg.id, "coude_90", 0.5)}
                    className="flex-1 py-1 bg-amber-800/80 hover:bg-amber-700 text-amber-200 rounded text-[9px] font-black"
                  >
                    + Coude
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsoDrawMode("te"); setStatusMessage("Cliquez pour placer le Té"); }}
                    className="flex-1 py-1 bg-purple-800/80 hover:bg-purple-700 text-purple-200 rounded text-[9px] font-black"
                  >
                    + Té
                  </button>
                </div>
              </div>
            );
          }
          if (selectedNd) {
            return (
              <div className="bg-slate-900 border-2 border-amber-500/70 rounded-2xl p-3 shadow-lg space-y-2.5 text-white">
                <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <CircleDot className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase text-amber-300">
                      {selectedNd.equipmentType ? equipmentLabel(selectedNd) : "Propriétés Point"}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800 font-bold">
                    {selectedNd.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Nom / Repère</label>
                    <input
                      value={selectedNd.name}
                      onChange={e => renameNode(selectedNd.id, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white focus:ring-1 focus:ring-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Coordonnées X / Y</label>
                    <div className="text-xs font-mono text-cyan-300 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700">
                      {selectedNd.x.toFixed(1)} , {selectedNd.y.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Élévation Z (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedNd.z || 0}
                      onChange={e => setNodes(prev => prev.map(n => n.id === selectedNd.id ? { ...n, z: Number(e.target.value) || 0 } : n))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-amber-300 outline-none"
                    />
                  </div>
                </div>
                {selectedNd.equipmentType && (
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => rotateSelectedEquipment(-15)}
                      className="rounded border border-slate-700 bg-slate-800 py-1 text-[10px] font-black text-slate-200 hover:bg-slate-700"
                    >
                      −15°
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateSelectedEquipment(15)}
                      className="rounded border border-slate-700 bg-slate-800 py-1 text-[10px] font-black text-slate-200 hover:bg-slate-700"
                    >
                      +15°
                    </button>
                    <button
                      type="button"
                      onClick={flipSelectedEquipment}
                      className="rounded border border-amber-600/80 bg-amber-950/60 py-1 text-[10px] font-black text-amber-300 hover:bg-amber-900"
                    >
                      Inverser
                    </button>
                  </div>
                )}
              </div>
            );
          }
          return null;
        })()}



        {selectedEquipmentNodes.length>0&&<div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase">Orientation équipement</h3><span className="text-[9px] text-cyan-300">{selectedEquipmentNodes.length} sélectionné(s)</span></div><div className="text-[10px] text-slate-400 truncate">{selectedEquipmentNodes.map(e=>equipmentLabel(e)).join(", ")}</div><div className="grid grid-cols-3 gap-1"><button onClick={()=>rotateSelectedEquipment(-15)} className="rounded border border-slate-600 bg-slate-800 py-2 text-[10px] font-black">−15°</button><button onClick={()=>rotateSelectedEquipment(15)} className="rounded border border-slate-600 bg-slate-800 py-2 text-[10px] font-black">+15°</button><button onClick={flipSelectedEquipment} className="rounded border border-amber-600 bg-amber-950/40 py-2 text-[10px] font-black text-amber-300">Inverser</button></div><div className="text-[9px] text-slate-500">R / Maj+R : rotation · F : inverser</div></div>}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase">Contrôle du réseau</h3>
            <span className={`text-[10px] font-black ${graphErrorCount?"text-red-600":graphWarningCount?"text-amber-600":"text-emerald-600"}`}>
              {graphErrorCount} erreur(s) · {graphWarningCount} avert.
            </span>
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
            {!graphIssues.length ? (
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold">✓ Graphe cohérent</div>
            ) : (
              graphIssues.slice(0, 12).map(issue => {
                const targetId = issue.entityId || issue.id;
                const kind = pdiAnomalieKind017P9(issue, nodes);
                return (
                  <div
                    key={issue.id}
                    onClick={() => {
                      focusAndHighlightError(targetId, kind === "segment" ? "segment" : "node", {
                        code: issue.code,
                        message: issue.message,
                      });
                    }}
                    className={`p-2 rounded-lg text-[10px] cursor-pointer hover:ring-1 hover:ring-amber-500 transition-all ${issue.severity === "error" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                  >
                    <b>{issue.code}</b> · {issue.message}
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-2 text-[9px] text-slate-500">
            {projectJoints.length} joint(s) détecté(s), dont {projectJoints.filter(j=>j.weldNumber).length} soudure(s) potentielle(s).
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-black uppercase border-b pb-2 flex gap-2"><FileText className="w-4 h-4 text-blue-600"/>Informations cartouche</h3>
          <input value={projectName} onChange={e=>setProjectName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs font-bold"/>
          <div className="grid grid-cols-2 gap-2">
            <input value={wilaya} onChange={e=>setWilaya(e.target.value)} className="border rounded-lg px-3 py-2 text-xs font-bold"/>
            <input type="number" value={pressDesign} onChange={e=>setPressDesign(Number(e.target.value)||16)} className="border rounded-lg px-3 py-2 text-xs font-mono font-bold"/>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-black uppercase border-b pb-2 flex gap-2"><CircleDot className="w-4 h-4 text-blue-600"/>Ajouter un nœud</h3>
          <input value={nodeName} onChange={e=>setNodeName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs font-bold" placeholder="Nom du nœud"/>
          <div className="grid grid-cols-2 gap-2">
            <select value={nodeType} onChange={e=>setNodeType(e.target.value as IsoNodeType)} className="w-full border rounded-lg px-3 py-2 text-xs font-bold">
              <option value="normal">Nœud normal</option><option value="entree_poste">Entrée poste</option><option value="sortie_poste">Sortie poste</option>
              <option value="piquage">Point de piquage</option><option value="tee">Té de dérivation</option><option value="gare_depart">Gare racleur départ</option><option value="gare_arrivee">Gare racleur arrivée</option>
            </select>
            <div>
              <label className="text-[9px] font-bold block text-slate-500">Z / Élévation (m)</label>
              <input type="number" step="0.1" value={nodeZ} onChange={e=>setNodeZ(Number(e.target.value)||0)} className="w-full border rounded-lg px-2 py-1 text-xs font-mono font-bold" placeholder="0.00"/>
            </div>
          </div>
          <button type="button" onClick={addNode} className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-black"><Plus className="inline w-4 h-4 mr-1"/>Ajouter le nœud</button>
          {!nodes.length&&<p className="text-[10px] text-slate-500">Aucun nœud initial. Vous choisissez entièrement l&apos;entrée et la sortie.</p>}
        </div>

        {!!nodes.length&&<div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-black uppercase border-b pb-2">Nœuds ({nodes.length})</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {nodes.map(n=><div key={n.id} onClick={()=>{toggleNodeSelection(n.id,false);setSelectedFitting(null)}} className={`p-2 rounded-lg border flex gap-2 items-center flex-wrap ${selectedNodeIds.includes(n.id)?"border-amber-400 bg-amber-50 ring-1 ring-amber-300":"border-slate-200"}`}>
              <CircleDot className="w-3 h-3 text-blue-600 shrink-0"/>
              <input value={n.name} onChange={e=>renameNode(n.id,e.target.value)} className="flex-1 min-w-[90px] bg-transparent text-[11px] font-bold outline-none"/>
              <span className="text-[9px] text-slate-400">{n.type}</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-500">Z:</span>
                <input type="number" step="0.1" value={n.z || 0} onChange={e=>setNodes(prev=>prev.map(x=>x.id===n.id?{...x,z:Number(e.target.value)||0}:x))} className="w-14 border rounded px-1 py-0.5 text-[10px] font-mono font-bold bg-white"/>
              </div>
              <button type="button" onClick={e=>{e.stopPropagation();removeNode(n.id)}} className="text-red-500"><Trash2 className="w-3 h-3"/></button>
            </div>)}
          </div>
        </div>}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-black uppercase border-b pb-2 flex gap-2"><GitBranch className="w-4 h-4 text-blue-600"/>Ajouter un tronçon</h3>
          <div className="grid grid-cols-2 gap-2">
            <input value={newSourceName} onChange={e=>setNewSourceName(e.target.value)} className="col-span-2 border rounded-lg px-2 py-2 text-[11px] font-bold" placeholder={"Nom du pipeline ou de la source"}/>
            <select value={fromNode} onChange={e=>setFromNode(e.target.value)} className="border rounded-lg px-2 py-2 text-[11px] font-bold"><option value="">Nœud origine</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select>
            <select value={toNode} onChange={e=>setToNode(e.target.value)} className="border rounded-lg px-2 py-2 text-[11px] font-bold"><option value="">Nœud extrémité</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select>
            <select value={newDN} onChange={e=>setNewDN(Number(e.target.value))} className="border rounded-lg px-2 py-2 text-[11px] font-bold">{DIAMETERS.map(([dn,inch,od])=><option key={dn} value={dn}>DN{dn} — {inch} — Ø {od} mm</option>)}</select>
            <input type="number" min=".05" step=".05" value={newLength} onChange={e=>{const v=Number(e.target.value);setNewLength(Number.isFinite(v)?v:0);}} className="border rounded-lg px-2 py-2 text-[11px] font-mono font-bold"/>
            <select value={newPN} onChange={e=>{setNewPN(e.target.value);pdiSignalerClasse017K3(e.target.value);}} className="border rounded-lg px-2 py-2 text-[11px] font-bold"><option>Class 150</option><option>Class 300</option><option>Class 400</option><option>Class 600</option><option>Class 900</option><option>Class 1500</option><option>Class 2500</option><option>PN16</option><option>PN40</option></select>
            <select value={newMaterial} onChange={e=>setNewMaterial(e.target.value)} className="border rounded-lg px-2 py-2 text-[11px] font-bold"><option>Acier API 5L Gr. B</option><option>Acier API 5L X42</option><option>Acier API 5L X52</option><option>PE100 SDR11</option></select>
            <label className="flex items-center gap-2 border rounded-lg px-2 py-2 text-[11px] font-bold"><span>Couleur</span><input type="color" value={newSegmentColor} onChange={e=>setNewSegmentColor(e.target.value)} className="h-6 w-8 p-0 border-0 bg-transparent"/></label>
          </div>
          <button type="button" disabled={!fromNode||!toNode} onClick={addSegment} className="w-full py-2 bg-blue-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-black"><Plus className="inline w-4 h-4 mr-1"/>Ajouter le tronçon</button>
        </div>

        {selected&&<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-black uppercase text-amber-900 border-b border-amber-200 pb-2 flex gap-2"><Settings2 className="w-4 h-4 text-amber-600"/>Ajouter un équipement</h3>
          <select value={fitType} onChange={e=>{const t=e.target.value as IsoFittingType;setFitType(t);setFitLabel(FITTING_LABELS[t])}} className="w-full border border-amber-300 rounded-lg px-2 py-2 text-xs font-bold">
            {FITTING_TYPES.map(t=><option key={t} value={t}>{FITTING_LABELS[t]}</option>)}
          </select>
          <input value={fitLabel} onChange={e=>setFitLabel(e.target.value)} className="w-full border border-amber-300 rounded-lg px-2 py-2 text-xs font-bold"/>
          <div><label className="text-[10px] font-bold text-amber-900">Position locale sur le tronçon</label>
            <input type="range" min="0" max="1" step=".01" value={fitPos} onChange={e=>setFitPos(Number(e.target.value))} className="w-full"/>
            <div className="flex justify-between text-[10px] font-mono"><span>Début</span><strong>{Math.round(fitPos*100)}%</strong><span>Fin</span></div>
          </div>
          <button type="button" onClick={addFitting} className="w-full py-2 bg-amber-600 text-white rounded-xl text-xs font-black"><Plus className="inline w-4 h-4 mr-1"/>Insérer l&apos;équipement</button>
          <p className="text-[10px] text-amber-800">Le pourcentage sert uniquement à positionner l&apos;organe sur son tronçon. La nomenclature utilise ensuite la distance cumulative en mètres.</p>
        </div>}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-black uppercase border-b pb-2 flex gap-2"><Layers className="w-4 h-4 text-blue-600"/>Chaîne mécanique ({segments.length})</h3>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {!segments.length&&<div className="text-[11px] text-slate-500 p-3 bg-slate-50 rounded-lg">Aucun tronçon. Créez les nœuds puis reliez-les.</div>}
            {segments.map((s,i)=>{
              const start=cumulative.starts.get(s.fromNodeId)||0,end=start+s.length;
              const from=nodes.find(n=>n.id===s.fromNodeId)?.name||"?";
              const to=nodes.find(n=>n.id===s.toNodeId)?.name||"?";
              return <div key={s.id} onClick={()=>selectSegmentV44(s.id,false)} className={`rounded-xl border p-3 cursor-pointer ${selectedSegmentIds.includes(s.id)||selectedSegmentId===s.id?"border-blue-400 bg-blue-50 ring-2 ring-blue-200":"border-slate-200 bg-slate-50"}`}>
                <div className="flex justify-between gap-2"><span className="text-[11px] font-black">#{i+1} — DN{s.dn} {dia(s.dn).inch}</span><button type="button" onClick={e=>{e.stopPropagation();removeSegment(s.id)}} className="text-red-500"><Trash2 className="w-3.5 h-3.5"/></button></div>
                <div className="text-[10px] font-black" style={{color:s.color||"#0284c7"}}>{s.sourceName||`Pipeline ${dia(s.dn).inch}`}</div>
                <div className="text-[10px] text-slate-500">{from} → {to}</div>
                <div className="mt-1 text-[10px] font-mono text-slate-700">{[s.sourceName||`Pipeline ${dia(s.dn).inch}`, ...( [nodes.find(n=>n.id===s.fromNodeId),nodes.find(n=>n.id===s.toNodeId)].filter((n): n is IsoNode=>!!n&&!!n.equipmentType).map(n=>equipmentLabel(n)) )].join(" → ")}</div>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <div className="text-[10px] font-mono text-blue-800">Cumul : {start.toFixed(3)} → {end.toFixed(3)} m</div>
                  <div className="flex items-center gap-1 text-[9px] font-bold"><span>L=</span><input type="number" min=".05" step=".01" value={s.length} onClick={e=>e.stopPropagation()} onChange={e=>setSegmentLength(s.id,Number(e.target.value))} className="w-20 border rounded px-1 py-1 text-[10px] font-mono font-bold bg-white"/><span>m</span></div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] font-bold">Couleur</span>
                  <input type="color" value={s.color||"#9CA3AF"} onClick={e=>e.stopPropagation()} onChange={e=>setSegments(prev=>prev.map(x=>x.id===s.id?{...x,color:e.target.value}:x))} className="h-6 w-8 p-0 border rounded bg-white"/>
                  <input value={s.sourceName||""} onClick={e=>e.stopPropagation()} onChange={e=>setSegments(prev=>prev.map(x=>x.id===s.id?{...x,sourceName:e.target.value}:x))} className="flex-1 border rounded px-2 py-1 text-[10px] font-bold bg-white" placeholder={"Pipeline source"}/>
                </div>

                {s.fittings.map((f,fi)=>{
                  const cp=cumulative.fittings.get(f.id)||0;
                  return <div key={f.id} className="mt-2 bg-white border rounded-lg p-2"><div className="flex items-center gap-1"><span className="text-[9px] font-mono text-slate-400 w-4">{fi+1}</span><button type="button" disabled={fi===0} onClick={e=>{e.stopPropagation();moveFitting(s.id,f.id,-1)}} className="px-1.5 py-1 rounded bg-slate-100 disabled:opacity-30 text-[10px]" title="Remonter">↑</button><button type="button" disabled={fi===s.fittings.length-1} onClick={e=>{e.stopPropagation();moveFitting(s.id,f.id,1)}} className="px-1.5 py-1 rounded bg-slate-100 disabled:opacity-30 text-[10px]" title="Descendre">↓</button><button type="button" onClick={e=>{e.stopPropagation();moveFittingTo(s.id,f.id,0)}} className="px-1.5 py-1 rounded bg-blue-50 text-blue-700 text-[9px]" title="Mettre en tête">TÊTE</button><span className="flex-1 text-[10px] font-bold">{f.label}</span><span className="text-[9px] font-mono text-slate-500">{cp.toFixed(3)} m</span><button type="button" onClick={e=>{e.stopPropagation();setEdit({segmentId:s.id,fitting:{...f,cumulativePosition:cp}})}} className="text-blue-600"><Pencil className="w-3 h-3"/></button><button type="button" onClick={e=>{e.stopPropagation();removeFitting(s.id,f.id)}} className="text-red-500"><Trash2 className="w-3 h-3"/></button></div></div>
                })}

              </div>
            })}
          </div>
        </div>
      </div>

      <div className={`${leftPanelOpen && (rightPanelOpen && !autoHideRightPanel) ? "lg:col-span-6" : leftPanelOpen || (rightPanelOpen && !autoHideRightPanel) ? "lg:col-span-9" : "lg:col-span-12"} ${workspaceFullscreen ? "h-full min-h-0 flex flex-col" : ""}`}>
        <div className={`${workspaceFullscreen ? "h-full min-h-0 flex-1 flex flex-col overflow-hidden" : ""} bg-slate-900 rounded-3xl border-2 border-slate-800 p-2.5 shadow-2xl`}>
          <div className="flex flex-wrap justify-between gap-2 text-white border-b border-slate-800 pb-2.5 mb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewport(v => ({ ...v, zoom: 1 }))}
                className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 active:bg-blue-600 px-2 py-1 rounded text-slate-200 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
                title="Cliquer pour réinitialiser le zoom à 100%"
              >
                {Math.round(viewport.zoom * 100)}%
              </button>
            </div>
            <div className="w-full xl:w-auto min-w-0 flex flex-wrap justify-start xl:justify-end items-center gap-1">

            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={()=>setIsoMode("editor")} className={`px-2 py-1 rounded text-[9px] font-black ${isoMode==="editor"?"bg-blue-600":"bg-slate-700"}`}>ÉDITEUR</button>
              <button type="button" onClick={()=>setIsoMode("planche")} className={`px-2 py-1 rounded text-[9px] font-black ${isoMode==="planche"?"bg-blue-600":"bg-slate-700"}`}>PLANCHE ISO</button>
              <button
                type="button"
                onClick={() => setSolid3dViewerOpen(true)}
                className="px-2.5 py-1 rounded text-[9px] font-black tracking-wide flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/50 shadow-md shadow-cyan-900/30 active:scale-95 cursor-pointer"
                title="Ouvrir la Vue 3D Solide Extrudée (Raccourci: touche 3 ou V, ou commande 3D)"
              >
                <Box className="w-3 h-3 text-cyan-200" />
                <span>VUE 3D</span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-mono">3</span>
              </button>
            </div>

            {/* View Mode Buttons */}
            <div className="flex shrink-0 items-center gap-0.5 border border-slate-800 rounded-lg p-0.5 bg-slate-950">
              <button 
                type="button" 
                onClick={() => resetView(undefined, undefined, undefined, undefined, "iso")} 
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${viewport.viewMode === "iso" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`} 
                title="Projection Isométrique standard (3D)"
              >
                ISO
              </button>
              <button 
                type="button" 
                onClick={() => resetView(undefined, undefined, undefined, undefined, "top")} 
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${viewport.viewMode === "top" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`} 
                title="Vue de Dessus (Plan horizontal X-Y)"
              >
                TOP
              </button>
              <button 
                type="button" 
                onClick={() => resetView(undefined, undefined, undefined, undefined, "front")} 
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${viewport.viewMode === "front" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`} 
                title="Vue de Face / Élévation (Plan X-Z)"
              >
                FACE
              </button>
              <button 
                type="button" 
                onClick={() => resetView(undefined, undefined, undefined, undefined, "side")} 
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${viewport.viewMode === "side" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`} 
                title="Vue de Profil / Côté (Plan Y-Z)"
              >
                CÔTÉ
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setInteractionMode("orbit");
                  setViewport(v => ({ ...v, viewMode: "free" }));
                  setStatusMessage("Mode Orbite 3D activé (Glissez avec le clic gauche)");
                }} 
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all flex items-center gap-1 ${interactionMode === "orbit" || viewport.viewMode === "free" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`} 
                title="Activer la rotation 3D libre autour du modèle (Raccourci: O / Shift+Glisser)"
              >
                <Compass className="w-2.5 h-2.5 text-purple-300" />
                ORBITE
              </button>
              {viewport.viewMode === "free" && (
                <span className="px-1.5 py-0.5 text-[8px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded font-mono uppercase">
                  ORBIT
                </span>
              )}
            </div>

              <select value={isoSnapStep} onChange={e=>setIsoSnapStep(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-zinc-300 font-mono" title="Pas d'accrochage">
                <option value=".25">Snap 0,25 m</option><option value=".5">Snap 0,50 m</option><option value="1">Snap 1,00 m</option>
              </select>

              <div className="flex shrink-0 items-center gap-0.5 border border-slate-800 rounded-lg p-0.5 bg-slate-950">
                <button type="button" onClick={()=>setShowGrid(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${showGrid ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`} title="Afficher la grille (#)">#</button>
                <button type="button" onClick={()=>setGcVisibleEditor(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${gcVisibleEditor?"bg-cyan-600 text-white":"bg-slate-800 text-slate-400"}`} title="Afficher le génie civil (GC)">GC</button>
                <button type="button" onClick={()=>setShowDimensions(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${showDimensions ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`} title="Afficher les cotes (⇔)">⇔</button>
                <button type="button" onClick={()=>setShowPipeLabels(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${showPipeLabels?"bg-cyan-600 text-white":"bg-slate-800 text-slate-400"}`} title="Labels des tuyauteries (PL)">PL</button>
                <button type="button" onClick={()=>setShowWelds(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${showWelds?"bg-amber-600 text-white":"bg-slate-800 text-slate-400"}`} title="Afficher les soudures Wxxx (W)">W</button>
                <button type="button" onClick={()=>setColorBySpool(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${colorBySpool?"bg-purple-600 text-white":"bg-slate-800 text-slate-400"}`} title="Coloration par Spool (SP)">SP</button>
                <button type="button" onClick={()=>setWeldSpoolModalOpen(true)} className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300" title="Carnet de Spools & Soudures (Weld Map)"><Flame className="w-3 h-3 inline"/></button>
                <button type="button" onClick={()=>setShowLabels(v=>!v)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${showLabels ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`} title="Afficher les annotations (Aa)">Aa</button>
                <button
                  type="button"
                  onClick={() => {
                    setRightPanelOpen(v => {
                      if (!v) { setRightPanelTab("supports"); return true; }
                      if (rightPanelTab === "supports") return false;
                      setRightPanelTab("supports");
                      return true;
                    });
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${rightPanelOpen && rightPanelTab === "supports" ? "bg-purple-600 text-white shadow-sm" : "bg-slate-800 text-purple-300 hover:bg-slate-700"}`}
                  title="Supports de tuyauterie MSS SP-58 (MSS / Hide)"
                >
                  MSS
                </button>
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(v => !v)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${shortcutsOpen ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-800 text-slate-300 hover:text-emerald-300 hover:bg-slate-700"}`}
                  title="Tableau de Guide & Raccourcis (Guide / Hide)"
                >
                  GUIDE
                </button>
              </div>

              <PdiCanvasToolbarControls16
                onZoomOut={zoomOut}
                onZoomIn={zoomIn}
                onClearSelection={() => {
                  setSelectedNodeIds([]);
                  setSelectedNodeId(null);
                  setSelectedFitting(null);
                  setSelectedSegmentIds([]);
                  setSelectedSegmentId(null);
                }}
                onResetView={resetView}
              />
            </div>
          </div>

          <div className={`${workspaceFullscreen ? "flex-1 min-h-0 h-full flex flex-col" : ""} bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative`}>
            <div
              className={"pdi-save-badge-017i absolute top-2 right-2 z-[60] pointer-events-none select-none rounded-lg border px-2 py-1 text-[10px] font-black shadow-lg bg-slate-900/85 " + (saveState === "error" ? "border-red-600 text-red-300" : saveState === "modified" ? "border-amber-500 text-amber-300" : saveState === "autosaved" ? "border-emerald-600 text-emerald-300" : "border-slate-700 text-slate-400")}
              title="Etat de la sauvegarde locale du projet actif"
            >
              {saveState === "modified"
                ? "● Modifications non sauvegardees"
                : saveState === "autosaved"
                  ? "● Autosauvegarde" + (lastSavedAt ? " a " + lastSavedAt : "")
                  : saveState === "error"
                    ? "● Erreur de sauvegarde"
                    : "○ Pret"}
            </div>
            {selectedNodeIds.length === 2 && (
              <div className="absolute top-2 left-2 z-[60] flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-emerald-500/80 rounded-xl px-3 py-1.5 shadow-xl">
                <span className="text-xs font-bold text-emerald-400">2 nœuds sélectionnés</span>
                <button
                  type="button"
                  onClick={createTubeFromSelection}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg flex items-center gap-1.5 shadow transition-colors"
                >
                  <span>🔗</span> Créer le tube (T)
                </button>
              </div>
            )}
            {isoDrawMode === "segment" && !selectedNodeIds.length && (
              <div className="absolute top-2 left-2 z-[60] flex items-center gap-2 bg-slate-900/95 backdrop-blur border border-cyan-500/80 rounded-xl px-3 py-1.5 shadow-xl">
                <span className="text-xs font-bold text-cyan-300">
                  {drawStartNodeId
                    ? `Point 1 : ${nodes.find(n => n.id === drawStartNodeId)?.name || drawStartNodeId} ➔ Cliquez le 2ème nœud`
                    : "Mode Tube : Cliquez le 1er nœud de départ"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsoDrawMode("select");
                    setDrawStartNodeId(null);
                    setStatusMessage("Mode Tube quitté");
                  }}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded border border-slate-700 ml-1"
                >
                  Échap
                </button>
              </div>
            )}

            {/* Guide Info-Bulle ALIGNEMENT par rapport à un objet & orientation (Positionné à droite) */}
            {alignWizard && (
              <div className="absolute top-12 right-4 z-[60] flex flex-col gap-2.5 bg-slate-900/95 backdrop-blur-md border-2 border-cyan-500/90 rounded-2xl p-3.5 shadow-2xl max-w-sm sm:max-w-md animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-700 text-cyan-400 text-xs font-mono font-black tracking-wide">📐 GUIDE ALIGN</span>
                    <span className="text-xs font-black text-cyan-300">
                      {alignWizard.step === 1 && "1/3 : Objet Référence"}
                      {alignWizard.step === 2 && "2/3 : Objet à Aligner"}
                      {alignWizard.step === 3 && "3/3 : Choix Échelle"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAlignWizard(null);
                      setStatusMessage("Alignement masqué / annulé");
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 text-[11px] font-bold rounded-lg border border-slate-700 hover:border-red-600 transition-colors"
                    title="Masquer le guide d'alignement (Hide)"
                  >
                    ✕ Masquer (Hide)
                  </button>
                </div>

                {alignWizard.step === 1 && (
                  <div className="text-xs text-slate-200">
                    <p className="font-bold text-cyan-200">Cliquez sur l'objet ou tronçon de <b className="text-white underline decoration-cyan-400 decoration-2">RÉFÉRENCE</b>.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Cet objet fournira l'axe de projection et l'orientation exacte (sans être contraint aux axes X/Y/Z du monde).</p>
                  </div>
                )}

                {alignWizard.step === 2 && (
                  <div className="text-xs text-slate-200 space-y-1.5">
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <span>✓ Référence choisie :</span>
                      <span className="font-bold text-white bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">{alignWizard.refLabel}</span>
                    </div>
                    <p className="font-bold text-cyan-200">Cliquez sur l'<b className="text-white underline decoration-cyan-400 decoration-2">OBJET À ALIGNER</b> (tronçon ou équipement).</p>
                    <p className="text-[11px] text-slate-400">Il sera repositionné sur la droite support de la référence et orienté selon son angle.</p>
                  </div>
                )}

                {alignWizard.step === 3 && (
                  <div className="text-xs text-slate-200 space-y-2.5">
                    <div className="space-y-1 text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-emerald-400">Réf : <b className="text-white">{alignWizard.refLabel}</b></div>
                      <div className="text-cyan-400">Cible : <b className="text-white">{alignWizard.targetLabel}</b></div>
                    </div>
                    <p className="font-bold text-amber-300 text-xs">
                      Souhaitez-vous conserver la dimension/longueur de l'objet cible ou prendre l'échelle exacte de la référence ?
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => executeObjectAlign("keep")}
                        className="flex-1 py-2 px-3 bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 text-white font-black rounded-xl shadow text-xs transition-all text-center"
                      >
                        Garder même échelle
                      </button>
                      <button
                        type="button"
                        onClick={() => executeObjectAlign("match")}
                        className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-black rounded-xl shadow text-xs transition-all text-center"
                      >
                        Prendre échelle référence
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guide Info-Bulle RENDRE PARALLÈLE selon un tronçon de référence (Positionné à droite) */}
            {parallelWizard && (
              <div className="absolute top-12 right-4 z-[60] flex flex-col gap-2.5 bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/90 rounded-2xl p-3.5 shadow-2xl max-w-sm sm:max-w-md animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-950 border border-amber-700 text-amber-400 text-xs font-mono font-black tracking-wide">⚡ GUIDE //</span>
                    <span className="text-xs font-black text-amber-300">
                      {parallelWizard.step === 1 && "1/2 : Réf."}
                      {parallelWizard.step === 2 && "2/2 : À Orienter"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParallelWizard(null);
                      setStatusMessage("Parallélisme masqué / annulé");
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 text-[11px] font-bold rounded-lg border border-slate-700 hover:border-red-600 transition-colors"
                    title="Masquer le guide de parallélisme (Hide)"
                  >
                    ✕ Masquer (Hide)
                  </button>
                </div>

                {parallelWizard.step === 1 && (
                  <div className="text-xs text-slate-200">
                    <p className="font-bold text-amber-200">Cliquez sur le tronçon de <b className="text-white underline decoration-amber-400 decoration-2">RÉFÉRENCE</b>.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Son vecteur directeur exact sera copié sans aucune contrainte aux axes cartésiens globaux.</p>
                  </div>
                )}

                {parallelWizard.step === 2 && (
                  <div className="text-xs text-slate-200 space-y-1.5">
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <span>✓ Réf :</span>
                      <span className="font-bold text-white bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">{parallelWizard.refLabel}</span>
                    </div>
                    <p className="font-bold text-amber-200">Cliquez sur le tronçon <b className="text-white underline decoration-amber-400 decoration-2">À RENDRE PARALLÈLE</b>.</p>
                    <p className="text-[11px] text-slate-400">Le tronçon conservera rigoureusement sa longueur et s'orientera en parallèle parfait avec la référence.</p>
                  </div>
                )}
              </div>
            )}

            <svg ref={svgRef} viewBox="0 0 620 400" className={`${workspaceFullscreen ? "h-full w-full flex-1" : (commandPromptHidden ? "h-[clamp(600px,88vh,1400px)]" : "h-[clamp(560px,78vh,1000px)]")} w-full select-none touch-none ${isSpaceDown || interactionMode === "main" ? "cursor-grab active:cursor-grabbing" : (interactionMode === "orbit" || viewport.viewMode === "free" ? "cursor-move" : (isoDrawMode === "select" ? "cursor-default" : "cursor-crosshair"))}`}
              onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
              onContextMenu={openIsoContextMenu}
              onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="copy"}} onDrop={dropEquipmentOnCanvas}>
              {draggedEquipmentType&&<g pointerEvents="none"><rect x="8" y="8" width="250" height="28" rx="7" fill="#052e16" stroke="#22c55e"/><text x="20" y="26" fill="#86efac" fontSize="10" fontWeight="bold">Déposer sur un tube pour l’intégrer · ailleurs pour le placer</text></g>}
              <defs>
                <marker id="isoArrowV2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#38bdf8"/></marker>
                {/* PALIER 2B — Hachures normalisées ISO / ASME ANSI31, ANSI32, DOTS */}
                <pattern id="cadHatchAnsi31" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" strokeWidth="1.2" />
                </pattern>
                <pattern id="cadHatchAnsi32" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="12" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="0" y1="0" x2="12" y2="0" stroke="#94a3b8" strokeWidth="1" />
                </pattern>
                <pattern id="cadHatchDots" width="8" height="8" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#94a3b8" />
                  <circle cx="6" cy="6" r="1" fill="#94a3b8" />
                </pattern>
              </defs>
              {gcVisibleEditor && gcUnderlay && <g pointerEvents="none"><image href={gcUnderlay} x={60+gcX} y={45+gcY} width={500*gcScale} height={300*gcScale} opacity={gcOpacity} preserveAspectRatio="none"/></g>}

              {/* PATCH 012 — Stable AutoCAD-like infinite grid */}
              <defs>
                <pattern id="pdiGridMinor" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${viewport.panX % 24} ${viewport.panY % 24})`}>
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#334155" strokeWidth="0.45" opacity="0.42" />
                </pattern>
                <pattern id="pdiGridMajor" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform={`translate(${viewport.panX % 120} ${viewport.panY % 120})`}>
                  <rect width="120" height="120" fill="url(#pdiGridMinor)" />
                  <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#64748b" strokeWidth="0.85" opacity="0.42" />
                </pattern>
              </defs>
               {showGrid && <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#pdiGridMajor)" opacity="0.88" pointerEvents="none" />}

              {/* ENVELOPE SPATIALE EXTRUDÉE (VOLUME DE TRAVAIL) */}
              {envelopeActive && projEnvelope.length === 8 && (
                <g key="skid-volume-envelope" pointerEvents="none">
                  {/* Faces translucides du volume extrudé */}
                  {!envelopeWireframe && (
                    <g opacity={envelopeOpacity}>
                      {/* Face de dessous */}
                      <polygon
                        points={`${projEnvelope[0].x},${projEnvelope[0].y} ${projEnvelope[1].x},${projEnvelope[1].y} ${projEnvelope[2].x},${projEnvelope[2].y} ${projEnvelope[3].x},${projEnvelope[3].y}`}
                        fill="#0284c7"
                        stroke="none"
                      />
                      {/* Face de dessus */}
                      <polygon
                        points={`${projEnvelope[4].x},${projEnvelope[4].y} ${projEnvelope[5].x},${projEnvelope[5].y} ${projEnvelope[6].x},${projEnvelope[6].y} ${projEnvelope[7].x},${projEnvelope[7].y}`}
                        fill="#38bdf8"
                        stroke="none"
                      />
                      {/* Face Gauche (0 -> 3 -> 7 -> 4) */}
                      <polygon
                        points={`${projEnvelope[0].x},${projEnvelope[0].y} ${projEnvelope[3].x},${projEnvelope[3].y} ${projEnvelope[7].x},${projEnvelope[7].y} ${projEnvelope[4].x},${projEnvelope[4].y}`}
                        fill="#0369a1"
                        stroke="none"
                      />
                      {/* Face Droite (1 -> 2 -> 6 -> 5) */}
                      <polygon
                        points={`${projEnvelope[1].x},${projEnvelope[1].y} ${projEnvelope[2].x},${projEnvelope[2].y} ${projEnvelope[6].x},${projEnvelope[6].y} ${projEnvelope[5].x},${projEnvelope[5].y}`}
                        fill="#0369a1"
                        stroke="none"
                      />
                      {/* Face Fond (0 -> 1 -> 5 -> 4) */}
                      <polygon
                        points={`${projEnvelope[0].x},${projEnvelope[0].y} ${projEnvelope[1].x},${projEnvelope[1].y} ${projEnvelope[5].x},${projEnvelope[5].y} ${projEnvelope[4].x},${projEnvelope[4].y}`}
                        fill="#0c4a6e"
                        stroke="none"
                      />
                      {/* Face Devant (3 -> 2 -> 6 -> 7) */}
                      <polygon
                        points={`${projEnvelope[3].x},${projEnvelope[3].y} ${projEnvelope[2].x},${projEnvelope[2].y} ${projEnvelope[6].x},${projEnvelope[6].y} ${projEnvelope[7].x},${projEnvelope[7].y}`}
                        fill="#0c4a6e"
                        stroke="none"
                      />
                    </g>
                  )}

                  {/* Arêtes structurales du Skid (Le Châssis métallique en orange/cyan vif) */}
                  <g stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.65">
                    {/* Cadre bas */}
                    <line x1={projEnvelope[0].x} y1={projEnvelope[0].y} x2={projEnvelope[1].x} y2={projEnvelope[1].y} />
                    <line x1={projEnvelope[1].x} y1={projEnvelope[1].y} x2={projEnvelope[2].x} y2={projEnvelope[2].y} />
                    <line x1={projEnvelope[2].x} y1={projEnvelope[2].y} x2={projEnvelope[3].x} y2={projEnvelope[3].y} />
                    <line x1={projEnvelope[3].x} y1={projEnvelope[3].y} x2={projEnvelope[0].x} y2={projEnvelope[0].y} />

                    {/* Cadre haut */}
                    <line x1={projEnvelope[4].x} y1={projEnvelope[4].y} x2={projEnvelope[5].x} y2={projEnvelope[5].y} stroke="#f59e0b" strokeWidth="1.5" />
                    <line x1={projEnvelope[5].x} y1={projEnvelope[5].y} x2={projEnvelope[6].x} y2={projEnvelope[6].y} stroke="#f59e0b" strokeWidth="1.5" />
                    <line x1={projEnvelope[6].x} y1={projEnvelope[6].y} x2={projEnvelope[7].x} y2={projEnvelope[7].y} stroke="#f59e0b" strokeWidth="1.5" />
                    <line x1={projEnvelope[7].x} y1={projEnvelope[7].y} x2={projEnvelope[4].x} y2={projEnvelope[4].y} stroke="#f59e0b" strokeWidth="1.5" />

                    {/* Poteaux verticaux d'extrusion */}
                    <line x1={projEnvelope[0].x} y1={projEnvelope[0].y} x2={projEnvelope[4].x} y2={projEnvelope[4].y} />
                    <line x1={projEnvelope[1].x} y1={projEnvelope[1].y} x2={projEnvelope[5].x} y2={projEnvelope[5].y} />
                    <line x1={projEnvelope[2].x} y1={projEnvelope[2].y} x2={projEnvelope[6].x} y2={projEnvelope[6].y} />
                    <line x1={projEnvelope[3].x} y1={projEnvelope[3].y} x2={projEnvelope[7].x} y2={projEnvelope[7].y} />
                  </g>

                  {/* Indicateurs textuels de hauteur et dimensions sur le Skid */}
                  <g transform={`translate(${projEnvelope[6].x + 10} ${projEnvelope[6].y - 10})`}>
                    <rect x="-4" y="-12" width="135" height="24" rx="4" fill="#09090b" stroke="#f59e0b" strokeWidth="1" />
                    <text x="6" y="4" fill="#fde68a" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                      H={envelopeHeight.toFixed(1)}m (Extrusion)
                    </text>
                  </g>
                  <g transform={`translate(${projEnvelope[2].x + 10} ${projEnvelope[2].y + 10})`}>
                    <rect x="-4" y="-12" width="135" height="24" rx="4" fill="#09090b" stroke="#38bdf8" strokeWidth="1" />
                    <text x="6" y="4" fill="#bae6fd" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                      {envelopeLength.toFixed(1)}m × {envelopeWidth.toFixed(1)}m
                    </text>
                  </g>
                </g>
              )}

              {/* Apercu fantome de la commande guidee - ligne pleine nette */}
              {guidedPreviewNodes.length > 0 && (
                <g className="pdi-guided-preview-016b" pointerEvents="none">
                  {segments.filter(sg => guidedPreviewNodes.some(n => n.id === sg.fromNodeId) && guidedPreviewNodes.some(n => n.id === sg.toNodeId)).map(sg => {
                    const a = guidedPreviewNodes.find(n => n.id === sg.fromNodeId)!;
                    const b = guidedPreviewNodes.find(n => n.id === sg.toNodeId)!;
                    const pa = isoProjectV4(a.x, a.y, a.z || 0, viewport.zoom, viewport.panX, viewport.panY);
                    const pb = isoProjectV4(b.x, b.y, b.z || 0, viewport.zoom, viewport.panX, viewport.panY);
                    return <line key={`gp-${sg.id}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#0ea5e9" strokeWidth="2" opacity="0.9" />;
                  })}
                  {guidedPreviewNodes.map(n => {
                    const p = isoProjectV4(n.x, n.y, n.z || 0, viewport.zoom, viewport.panX, viewport.panY);
                    return <circle key={`gpn-${n.id}`} cx={p.x} cy={p.y} r="5" fill="none" stroke="#0ea5e9" strokeWidth="1.6" />;
                  })}
                  {guidedCmd?.base && (() => {
                    const pb = isoProjectV4(guidedCmd.base!.x, guidedCmd.base!.y, guidedCmd.base!.z || 0, viewport.zoom, viewport.panX, viewport.panY);
                    return <g><circle cx={pb.x} cy={pb.y} r="4" fill="#22d3ee" /><text x={pb.x + 8} y={pb.y - 6} fill="#22d3ee" fontSize="8" fontWeight="bold">BASE</text></g>;
                  })()}
                </g>
              )}


              {/* Visualisation Référence en cours (ALIGN / PARALLEL) */}
              {(alignWizard?.refSegmentId || parallelWizard?.refSegmentId) && (() => {
                const refSegId = alignWizard?.refSegmentId || parallelWizard?.refSegmentId;
                const seg = segments.find(s => s.id === refSegId);
                if (!seg) return null;
                const a = nodes.find(n => n.id === seg.fromNodeId);
                const b = nodes.find(n => n.id === seg.toNodeId);
                if (!a || !b) return null;
                const pa = iso(a);
                const pb = iso(b);
                return (
                  <g pointerEvents="none" className="pdi-align-ref-highlight">
                    <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#10b981" strokeWidth="12" strokeOpacity="0.45" strokeLinecap="round" />
                    <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 3" />
                  </g>
                );
              })()}
              {alignWizard?.refNodeId && (() => {
                const n = nodes.find(item => item.id === alignWizard.refNodeId);
                if (!n) return null;
                const p = iso(n);
                return (
                  <g pointerEvents="none" className="pdi-align-ref-node-highlight">
                    <circle cx={p.x} cy={p.y} r="18" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="4 3" strokeOpacity="0.85" />
                    <circle cx={p.x} cy={p.y} r="5" fill="#34d399" />
                  </g>
                );
              })()}

              <g>
                {segments.map(s=>{
                  const a=nodes.find(n=>n.id===s.fromNodeId),b=nodes.find(n=>n.id===s.toNodeId);
                  if(!a||!b)return null;
                  const endpoints=segmentEndpoints(s,nodes,segments);
                  const p1=endpoints?isoProjectV4(endpoints.from.x,endpoints.from.y,endpoints.from.z || 0,viewport.zoom,viewport.panX,viewport.panY,viewport.viewMode,viewport.yaw,viewport.pitch):iso(a);
                  const p2=endpoints?isoProjectV4(endpoints.to.x,endpoints.to.y,endpoints.to.z || 0,viewport.zoom,viewport.panX,viewport.panY,viewport.viewMode,viewport.yaw,viewport.pitch):iso(b),sel=s.id===selectedSegmentId||selectedSegmentIds.includes(s.id);
                  const width=clamp((s.dn/25)*pipeStrokeScale,2,24),mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2;
                  const dimensionAnnotation=editorAnnotationMap.get(`segment:${s.id}`);
                  return <g key={s.id} data-iso-object="true" data-iso-segment="true" data-segment-id={s.id} style={{isolation:"isolate"}}
                    onPointerDown={e=>{
                      if (isoDrawMode !== "select" || activeSupportTypeToPlace) {
                        // Let the event propagate to the SVG pointerDown for insertion / dimension tools
                        return;
                      }
                      e.stopPropagation();
                      beginSegmentDrag(e,s.id,e.ctrlKey||e.metaKey||e.shiftKey);
                    }}
                    onContextMenu={(e)=>{
                      e.preventDefault();
                      e.stopPropagation();
                      selectSegmentV44(s.id, false);
                      setContextMenu({ x: e.clientX, y: e.clientY, type: "segment", id: s.id });
                    }}
                    onPointerEnter={()=>setHoveredEntity({ type: "segment", id: s.id })}
                    onPointerLeave={()=>setHoveredEntity(null)}>
                    {(() => { const pts=isoPolylineV4(s,a,b,viewport.zoom,viewport.panX,viewport.panY,viewport.viewMode,viewport.yaw,viewport.pitch); const path=isoPathV4(pts); return <>
                      {/* Zone de clic élargie invisible pour sélection précise sans empiéter sur les voisins */}
                      <path d={path} stroke="#000000" strokeOpacity="0.001" strokeWidth={Math.max(width + 6, 11)} strokeLinecap="round" fill="none" pointerEvents="all" className="cursor-pointer" />
                      {sel&&<path d={path} stroke="#38bdf8" strokeWidth={width+5} strokeOpacity=".16" strokeLinecap="round" strokeLinejoin="round" fill="none"/>}
                      {hoveredEntity?.type==="segment"&&hoveredEntity.id===s.id&&!sel&&<path d={path} stroke="#67e8f9" strokeWidth={width+3} strokeOpacity=".12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>}
                      <path d={path} stroke={segmentStrokeColor(s)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </>; })()}
                    {/* PATCH 017C : tag industriel affiche sur le plan aéré a distance du tube */}
                    {tagDisplay && s.tag && viewport.zoom > 0.35 && (
                      <text x={mx} y={my - (width / 2) - 12} fill="#fcd34d" fontSize="9" fontWeight="bold"
                        textAnchor="middle" paintOrder="stroke" stroke="#0f172a" strokeWidth="3" pointerEvents="none">
                        {s.tag}
                      </text>
                    )}
                    {showPipeLabels && s.length >= 0.25 && viewport.zoom >= 0.35 && (
                      <g pointerEvents="none" transform={`translate(${mx} ${my})`}>
                        <rect
                          x="-26"
                          y="-7.5"
                          width="52"
                          height="15"
                          rx="3"
                          fill="#020617"
                          fillOpacity="0.9"
                          stroke="#0891b2"
                          strokeWidth="0.8"
                          className="shadow-sm"
                        />
                        <text
                          x="0"
                          y="3"
                          fill="#38bdf8"
                          fontSize="7"
                          fontWeight="900"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          DN{s.dn} ({Math.round(s.length * 1000)}mm)
                        </text>
                      </g>
                    )}
                    {isoDrawMode==="coude"&&<g data-iso-object="true" transform={`translate(${mx} ${my})`} onClick={e=>{e.stopPropagation();insertGraphicFitting(s.id,fitType.startsWith("coude")?fitType:"coude_90",.5)}} style={{cursor:"crosshair"}}><circle r="14" fill="#f59e0b" fillOpacity=".18" stroke="#fbbf24" strokeDasharray="3 2"/><path d="M-7 7 Q-7 -7 7 -7" stroke="#fbbf24" strokeWidth="2.5" fill="none"/></g>}
                    {false&&s.fittings.map(f=>{
                      const x=p1.x+(p2.x-p1.x)*f.localPosition,y=p1.y+(p2.y-p1.y)*f.localPosition;
                      const isFitSel=selectedFittingIds.includes(f.id)||selectedFitting?.fittingId===f.id;
                       const angle=Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI;
                       return <g key={f.id} data-iso-object="true" data-iso-fitting="true" data-segment-id={s.id} data-fitting-id={f.id} transform={`translate(${x} ${y})`} onPointerDown={e=>{e.stopPropagation();selectFittingV44(s.id,f.id,e.ctrlKey||e.metaKey||e.shiftKey);setDragFittingInfo({segmentId:s.id,fittingId:f.id});e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);}} onDoubleClick={e=>{e.stopPropagation();setEdit({segmentId:s.id,fitting:{...f,cumulativePosition:cumulative.fittings.get(f.id)||0}});}}>
                        {isFitSel&&<circle r="17" fill="#ffffff" stroke="#ffffff" strokeWidth="4" opacity=".28"/>}
                        <circle r="13" fill="#ffffff" stroke={isFitSel?"#facc15":"#ffffff"} strokeWidth={isFitSel?2.5:1.5}/>
                        <g transform={`rotate(${angle})`} dangerouslySetInnerHTML={{ __html: getFittingSvgGraphic(f.type, false) }} />
                        {showLabels&&<text x="0" y="21" fill="#e2e8f0" fontSize="7" fontWeight="bold" textAnchor="middle" paintOrder="stroke" stroke="#0f172a" strokeWidth="2">{f.label}</text>}
                      </g>
                    })}
                  </g>
                })}

                {nodes.map(n=>{
                  const p=iso(n);
                  const isTee = n.type === "tee" && !n.equipmentType;
                  const isEquip = !!n.equipmentType;
                  const isSel = selectedNodeIds.includes(n.id) || n.id === selectedNodeId;
                  const isHov = hoveredEntity?.type === "node" && hoveredEntity.id === n.id;
                  const fill = n.type==="entree_poste"?"#22c55e":n.type==="sortie_poste"?"#ef4444":isTee?"#8b5cf6":"#0284c7";
                  const nativePorts=(n.ports||[]).map(port=>{const w=portWorldPosition(n,port.id,nodes,segments),sp=isoProjectV4(w.x,w.y,w.z || 0,viewport.zoom,viewport.panX,viewport.panY,viewport.viewMode,viewport.yaw,viewport.pitch);return {...port,sx:sp.x-p.x,sy:sp.y-p.y};});
                  const p0=nativePorts.find(port=>port.index===0),p1=nativePorts.find(port=>port.index===1);

                  // Calcul topologique rigoureux de l'alignement axial et de l'orientation des coudes
                  const connSegs = segments.filter(s => s.fromNodeId === n.id || s.toNodeId === n.id);
                  let pAdjA: { x: number; y: number } | null = null;
                  let pAdjB: { x: number; y: number } | null = null;
                  if (connSegs.length >= 1) {
                    const otherId0 = connSegs[0].fromNodeId === n.id ? connSegs[0].toNodeId : connSegs[0].fromNodeId;
                    const other0 = nodes.find(item => item.id === otherId0);
                    if (other0) pAdjA = iso(other0);
                  }
                  if (connSegs.length >= 2) {
                    const otherId1 = connSegs[1].fromNodeId === n.id ? connSegs[1].toNodeId : connSegs[1].fromNodeId;
                    const other1 = nodes.find(item => item.id === otherId1);
                    if (other1) pAdjB = iso(other1);
                  }

                  const isBend = !!n.equipmentType && elbowAngle(n.equipmentType) > 0;
                  let elbowPathD = "";
                  if (isBend && pAdjA && pAdjB) {
                    const dxA = pAdjA.x - p.x, dyA = pAdjA.y - p.y;
                    const lenA = Math.hypot(dxA, dyA) || 1;
                    const dxB = pAdjB.x - p.x, dyB = pAdjB.y - p.y;
                    const lenB = Math.hypot(dxB, dyB) || 1;
                    const rElbow = Math.min(14, Math.min(lenA, lenB) * 0.35);
                    const pArcA = { x: (dxA / lenA) * rElbow, y: (dyA / lenA) * rElbow };
                    const pArcB = { x: (dxB / lenB) * rElbow, y: (dyB / lenB) * rElbow };
                    elbowPathD = `M ${pArcA.x.toFixed(2)} ${pArcA.y.toFixed(2)} Q 0 0 ${pArcB.x.toFixed(2)} ${pArcB.y.toFixed(2)}`;
                  }

                  // PATCH 017Q3-C : Respecter node.rotation comme transformation locale de l'équipement.
                  // L'orientation automatique déduite des tronçons sert de valeur par défaut uniquement si n.rotation est indéfini.
                  let equipAngle = n.rotation != null ? n.rotation : 0;
                  if (n.rotation == null) {
                    if (p0 && p1 && (Math.abs(p1.sx - p0.sx) > 0.5 || Math.abs(p1.sy - p0.sy) > 0.5)) {
                      equipAngle = (Math.atan2(p1.sy - p0.sy, p1.sx - p0.sx) * 180) / Math.PI;
                    } else if (pAdjA && pAdjB) {
                      const sIn = connSegs.find(s => s.toNodeId === n.id);
                      const sOut = connSegs.find(s => s.fromNodeId === n.id);
                      if (sIn && sOut) {
                        const nIn = nodes.find(item => item.id === sIn.fromNodeId);
                        const nOut = nodes.find(item => item.id === sOut.toNodeId);
                        if (nIn && nOut) {
                          const ptIn = iso(nIn), ptOut = iso(nOut);
                          equipAngle = Math.atan2(ptOut.y - ptIn.y, ptOut.x - ptIn.x) * 180 / Math.PI;
                        } else {
                          equipAngle = Math.atan2(pAdjB.y - pAdjA.y, pAdjB.x - pAdjA.x) * 180 / Math.PI;
                        }
                      } else {
                        equipAngle = Math.atan2(pAdjB.y - pAdjA.y, pAdjB.x - pAdjA.x) * 180 / Math.PI;
                      }
                    } else if (pAdjA) {
                      const s0 = connSegs[0];
                      if (s0.toNodeId === n.id) {
                        equipAngle = Math.atan2(p.y - pAdjA.y, p.x - pAdjA.x) * 180 / Math.PI;
                      } else {
                        equipAngle = Math.atan2(pAdjA.y - p.y, pAdjA.x - p.x) * 180 / Math.PI;
                      }
                    }
                  }

                  const angle = isBend ? 0 : equipAngle;
                  const kGlyph=pdiGlyphScale017P5(nativePorts);
                  const branchPort=nativePorts.find(port=>port.role==="branch");
                  const nodeAnnotation=editorAnnotationMap.get(`node:${n.id}`);
                  return <g key={n.id} data-iso-object="true" data-iso-node="true" data-node-id={n.id} transform={`translate(${p.x} ${p.y})`}
                    onClick={e=>{
                      if (isoDrawMode === "segment") {
                        e.stopPropagation();
                        handleNodeClickForTube(n.id);
                      }
                    }}
                    onPointerDown={e=>{
                      const target = e.target as Element;
                      const portEl = target.closest("[data-iso-port='true']");
                      if (portEl) {
                        const nodeId = portEl.getAttribute("data-port-node-id");
                        const portIdx = Number(portEl.getAttribute("data-port-idx") || "1");
                        if (nodeId) {
                          e.stopPropagation();
                          selectNodeV44(nodeId, e.ctrlKey || e.metaKey || e.shiftKey);
                          const node = nodes.find(item => item.id === nodeId);
                          const portCible = portByIndex(node, portIdx);
                          const portOccupe = !!portCible && segments.some(s => s.fromPortId === portCible.id || s.toPortId === portCible.id);
                          if (portOccupe) {
                            setStatusMessage("PORT OCCUPÉ : ce port porte déjà une soudure.");
                            return;
                          }
                          setBranchDrawing({ fromNodeId: nodeId, fromPortId: portCible?.id, handleIndex: portIdx, currentWorldPos: screenToIsoWorld(e) });
                          try {
                            (svgRef.current || e.currentTarget).setPointerCapture(e.pointerId);
                          } catch {}
                          return;
                        }
                      }
                      if (isoDrawMode === "segment") {
                        e.stopPropagation();
                        handleNodeClickForTube(n.id);
                        return;
                      }
                      if (isoDrawMode !== "select") {
                        // Let the event propagate for dimension, tee, or branch drawings
                        return;
                      }
                      e.stopPropagation();
                      beginNodeDrag(e,n.id,e.ctrlKey||e.metaKey||e.shiftKey);
                    }}
                    onPointerEnter={()=>setHoveredEntity({ type: "node", id: n.id })}
                    onPointerLeave={()=>setHoveredEntity(null)}
                    onContextMenu={(e)=>{
                      e.preventDefault();
                      e.stopPropagation();
                      if (!selectedNodeIds.includes(n.id)) {
                        toggleNodeSelection(n.id, false);
                      }
                      setContextMenu({ x: e.clientX, y: e.clientY, type: "node", id: n.id });
                    }}>
                    {/* Zone de clic invisible calibrée pour sélection ultra-précise */}
                    <circle r={Math.max(8, Math.min(16, 7 * Math.sqrt(Math.min(kGlyph, 2.5))))} fill="#000000" fillOpacity="0.001" pointerEvents="all" className="cursor-pointer" />
                    {isEquip ? (
                      <g>
                        {isSel&&(()=>{
                          const selHalf = Math.max(9, Math.min(17, 8 * Math.sqrt(Math.min(kGlyph, 2.5))));
                          const selSize = selHalf * 2;
                          return <rect x={-selHalf} y={-selHalf} width={selSize} height={selSize} rx="3" fill="none" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3 2"/>;
                        })()}
                        {isHov&&!isSel&&(()=>{
                          const selHalf = Math.max(8.5, Math.min(16, 7.5 * Math.sqrt(Math.min(kGlyph, 2.5))));
                          const selSize = selHalf * 2;
                          return <rect x={-selHalf} y={-selHalf} width={selSize} height={selSize} rx="3" fill="none" stroke="#67e8f9" strokeWidth="1" strokeDasharray="2 2"/>;
                        })()}
                        {isBend ? (
                          <path d={elbowPathD || (p0 && p1 ? `M ${p0.sx} ${p0.sy} Q 0 0 ${p1.sx} ${p1.sy}` : "M -6 6 Q -6 -6 6 -6")} stroke="#f59e0b" strokeWidth={Math.max(3.2, ((n.dn || 100) / 25) * pipeStrokeScale)} fill="none" strokeLinecap="round" />
                        ) : branchPort ? (
                          <g data-pdi-te="017p8">
                            <circle r={pdiNodeRadius017P3(viewport.zoom,isSel,isHov)+2} fill="#052e16" stroke={isSel?"#facc15":"#22c55e"} strokeWidth={2}/>
                            {nativePorts.map(port=>(<line key={`teq-branche-${port.id}`} x1="0" y1="0" x2={port.sx} y2={port.sy} stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/>))}
                          </g>
                        ) : (
                          <g>
                            {nativePorts.map(port=>(<line key={`patte-${port.id}`} x1="0" y1="0" x2={port.sx} y2={port.sy} stroke="#64748b" strokeWidth="1.6" strokeLinecap="round"/>))}
                            <g transform={`rotate(${angle}) scale(${kGlyph} ${n.mirrored?-kGlyph:kGlyph})`} dangerouslySetInnerHTML={{__html:getFittingSvgGraphic(n.equipmentType!,false)}}/>
                          </g>
                        )}
                        {nativePorts.map(port=>{
                          const joint=projectJoints.find(item=>item.nodeId===n.id&&item.portId===port.id);
                          const connected=!!joint;
                          const weldAnnotation=joint?editorAnnotationMap.get(`weld:${joint.id}`):undefined;
                          if (connected) {
                            if(!joint?.weldNumber||!showWelds)return null;
                            return <g key={port.id} pointerEvents="none">
                              <circle cx={port.sx} cy={port.sy} r="3.4" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.4"/>
                              <path d={`M ${port.sx-3} ${port.sy-3} L ${port.sx+3} ${port.sy+3} M ${port.sx+3} ${port.sy-3} L ${port.sx-3} ${port.sy+3}`} stroke="#fbbf24" strokeWidth="1"/>
                            </g>;
                          }
                          return <g key={port.id} data-iso-port="true" data-port-node-id={n.id} data-port-idx={String(port.index)} className="cursor-crosshair"><circle cx={port.sx} cy={port.sy} r={port.role==="branch"?4:3} fill={connected?"#0f172a":port.role==="branch"?"#22c55e":"#8b5cf6"} stroke={connected?"#fbbf24":"#ffffff"} strokeWidth="1"/></g>;
                        })}
                      </g>
                    ) : isTee ? (
                      <g>
                        <circle r={pdiNodeRadius017P3(viewport.zoom,isSel,isHov)+2} fill="#1e1b4b" stroke={isSel?"#facc15":"#a78bfa"} strokeWidth={2}/>
                        {nativePorts.length?nativePorts.map(port=>(<line key={`te-branche-${port.id}`} x1="0" y1="0" x2={port.sx} y2={port.sy} stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>)):(<path d="M -10 0 L 10 0 M 0 0 L 0 -12" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>)}
                        {nativePorts.map(port=>{const jointTe=projectJoints.find(item=>item.nodeId===n.id&&item.portId===port.id);if(jointTe)return <g key={port.id} pointerEvents="none"><circle cx={port.sx} cy={port.sy} r="3.4" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.4"/></g>;return <g key={port.id} data-iso-port="true" data-port-node-id={n.id} data-port-idx={String(port.index)} className="cursor-crosshair"><circle cx={port.sx} cy={port.sy} r={port.role==="branch"?4:3} fill={port.role==="branch"?"#22c55e":"#8b5cf6"} stroke="#ffffff" strokeWidth={port.role==="branch"?1.5:1}/></g>;})}
                      </g>
                    ) : (
                      <circle r={pdiNodeRadius017P3(viewport.zoom,isSel,isHov)} fill={fill} stroke={isSel?"#facc15":"#e0f2fe"} strokeWidth={isSel?2:1.5}/>
                    )}
                    {showLabels&&(viewport.zoom>=0.5||isEquip||isSel)&&(()=>{
                          const bend = n.equipmentType ? elbowAngle(n.equipmentType) : 0;
                          const angleSuffix = bend ? ` (${bend}°)` : n.branchAngle !== undefined ? ` (${n.branchAngle}°)` : n.rotation ? ` (R=${n.rotation}°)` : "";
                          const fullLabel=`${isEquip?equipmentLabel(n):n.name}${angleSuffix}${n.z?` (Z=${n.z}m)`:""}`;
                          const displayLabel=compactIsoLabel(fullLabel,30);
                          const lx=(nodeAnnotation?.x??p.x+42)-p.x,ly=(nodeAnnotation?.y??p.y-18)-p.y;
                          const lw=Math.min(172,Math.max(38,displayLabel.length*5.3+14));
                          return <>
                            <line x1="0" y1="0" x2={lx} y2={ly} stroke="#64748b" strokeWidth=".7" strokeDasharray="3 3" pointerEvents="none"/>
                            <g transform={`translate(${lx} ${ly})`} pointerEvents="none">
                              <rect x={-lw/2} y="-10" width={lw} height="17" rx="4" fill="#020617" fillOpacity=".9" stroke={isEquip?"#a16207":"#334155"} strokeWidth=".7"/>
                              <title>{fullLabel}</title>
                              <text x="0" y="2" textAnchor="middle" fill={isEquip?"#fde68a":isTee?"#c4b5fd":"#cbd5e1"} fontSize="8" fontWeight="bold">{displayLabel}</text>
                            </g>
                          </>;
                        })()}
                  </g>
                })}

                {/* CALQUE SOUDURES INDUSTRIELLES & REPÈRES Wxxx (ASME B31.3 / ISO 14692) */}
                {showWelds && (
                  <g data-iso-layer="welds">
                    {weldSpoolData.welds.map((weld) => {
                      const wp = isoProjectV4(weld.worldPos.x, weld.worldPos.y, weld.worldPos.z, viewport.zoom, viewport.panX, viewport.panY);
                      const isField = weld.location === "field";
                      const isGolden = weld.location === "golden";
                      const strokeCol = isGolden ? "#f59e0b" : isField ? "#ef4444" : "#38bdf8";
                      const fillCol = isGolden ? "#78350f" : isField ? "#450a0a" : "#082f49";
                      const isHov = hoveredEntity?.type === ("node" as any) && hoveredEntity.id === weld.id;
                      const weldLabel = weld.weldNumber || weld.id;
                      const badgeW = Math.max(20, weldLabel.length * 5.8 + 8);

                      return (
                        <g
                          key={weld.id}
                          transform={`translate(${wp.x}, ${wp.y})`}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWeldSpoolModalOpen(true);
                          }}
                          onPointerEnter={() => setHoveredEntity({ type: "node" as any, id: weld.id, label: `${weld.id} (${weld.location})` })}
                          onPointerLeave={() => setHoveredEntity(null)}
                        >
                          {/* Halo au survol */}
                          {isHov && (
                            <circle r="13" fill={strokeCol} fillOpacity="0.25" stroke={strokeCol} strokeWidth="1" strokeDasharray="2 2" />
                          )}

                          {/* Symbole ASME selon type */}
                          {isGolden ? (
                            <g>
                              <polygon points="0,-7 7,0 0,7 -7,0" fill={fillCol} stroke={strokeCol} strokeWidth="1.8" />
                              <polygon points="0,-3.5 3.5,0 0,3.5 -3.5,0" fill="#fbbf24" />
                            </g>
                          ) : isField ? (
                            <g>
                              <circle r="5.5" fill={fillCol} stroke={strokeCol} strokeWidth="1.8" />
                              <circle r="2.5" fill="#ef4444" />
                              <line x1="0" y1="-5.5" x2="0" y2="-12" stroke="#ef4444" strokeWidth="1.2" />
                              <polygon points="0,-12 5,-9.5 0,-7" fill="#ef4444" />
                            </g>
                          ) : (
                            <g>
                              <circle r="4.8" fill={fillCol} stroke={strokeCol} strokeWidth="1.5" />
                              <line x1="-3" y1="-3" x2="3" y2="3" stroke={strokeCol} strokeWidth="1" />
                              <line x1="3" y1="-3" x2="-3" y2="3" stroke={strokeCol} strokeWidth="1" />
                            </g>
                          )}

                          {/* Étiquette Wxxx */}
                          {viewport.zoom >= 0.4 && (
                            <g transform="translate(8, -8)" pointerEvents="none">
                              <rect
                                x="-1"
                                y="-8"
                                width={badgeW}
                                height="12"
                                rx="3"
                                fill="#020617"
                                fillOpacity="0.88"
                                stroke={strokeCol}
                                strokeWidth="0.8"
                              />
                              <text
                                x={badgeW / 2 - 1}
                                y="1"
                                textAnchor="middle"
                                fill={strokeCol}
                                fontSize="7.5"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                {weldLabel}
                              </text>
                            </g>
                          )}

                          <title>{`${weld.id} · Soudure ${weld.location.toUpperCase()} · DN${weld.dn} · Spool: ${weld.spoolId || "Chantier"} · WPS: ${weld.wpsNumber} · CND: ${weld.ndtRequired}`}</title>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Live Branch Preview during dragging */}
                {branchDrawing && (() => {
                  const fromN = nodes.find(n => n.id === branchDrawing.fromNodeId);
                  if (!fromN) return null;
                  const start=portWorldPosition(fromN,branchDrawing.fromPortId,nodes,segments);
                  const p1 = isoProjectV4(start.x,start.y,start.z,viewport.zoom,viewport.panX,viewport.panY);
                  const p2 = isoProjectV4(branchDrawing.currentWorldPos.x, branchDrawing.currentWorldPos.y, branchDrawing.currentWorldPos.z, viewport.zoom, viewport.panX, viewport.panY);
                  return (
                    <g pointerEvents="none">
                      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#22c55e" strokeWidth="2.5" strokeDasharray="5 3" />
                      <circle cx={p2.x} cy={p2.y} r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                      <text x={p2.x + 10} y={p2.y - 5} fill="#4ade80" fontSize="9" fontWeight="bold">Nouvelle branche (relâcher pour valider)</text>
                    </g>
                  );
                })()}

                {/* Live Tube Preview during drawing (Rubber Band) */}
                {drawStartNodeId && isoDrawMode === "segment" && (() => {
                  const fromN = nodes.find(n => n.id === drawStartNodeId);
                  if (!fromN) return null;
                  const p1 = isoProjectV4(fromN.x, fromN.y, fromN.z || 0, viewport.zoom, viewport.panX, viewport.panY);
                  const targetWorld = activeSnap ? activeSnap.worldPos : (tubeHoverWorld || { x: fromN.x + 2, y: fromN.y, z: fromN.z || 0 });
                  const p2 = isoProjectV4(targetWorld.x, targetWorld.y, targetWorld.z || 0, viewport.zoom, viewport.panX, viewport.panY);
                  const lengthM = Math.hypot(targetWorld.x - fromN.x, targetWorld.y - fromN.y, (targetWorld.z || 0) - (fromN.z || 0));
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  return (
                    <g pointerEvents="none">
                      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#0284c7" strokeWidth="3" strokeDasharray="6 3" />
                      <circle cx={p1.x} cy={p1.y} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx={p2.x} cy={p2.y} r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                      <rect x={midX - 45} y={midY - 22} width="90" height="20" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="1" />
                      <text x={midX} y={midY - 8} textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        DN{newDN} · {lengthM.toFixed(2)}m
                      </text>
                    </g>
                  );
                })()}

                {/* PATCH 007d — real 2D geometry with drag, grips & lineTypes */}
                <g data-cad2d-layer="true">
                  {cad2dEntities.filter((entity) => entity.visible !== false).map((entity) => {
                    const selected = selectedCad2dIds.includes(entity.id);
                    const stroke = selected ? "#fbbf24" : entity.color;
                    const strokeDash = entity.lineType === "dashed" ? "6 3" : entity.lineType === "center" ? "10 3 2 3" : entity.lineType === "hidden" ? "3 3" : undefined;
                    const common = {
                      stroke,
                      strokeWidth: selected ? 2.5 * workspaceVisualStyle.cad2dStrokeScale : ((entity.lineWeight || 1.5) * workspaceVisualStyle.cad2dStrokeScale),
                      strokeDasharray: strokeDash,
                      opacity: entity.opacity ?? 1,
                      fill: "none",
                      vectorEffect: "non-scaling-stroke" as const,
                      style: { cursor: "move" },
                      onPointerDown: (event: React.PointerEvent) => startCad2dPointer(event, entity.id, "body"),
                      onClick: (event: React.MouseEvent) => {
                        event.stopPropagation();
                        setSelectedCad2dIds(event.shiftKey || event.ctrlKey || event.metaKey
                          ? (selected ? selectedCad2dIds.filter((id) => id !== entity.id) : [...selectedCad2dIds, entity.id])
                          : [entity.id]);
                        setStatusMessage(`Objet 2D sélectionné · ${entity.type} · ${entity.id}`);
                      },
                      onDoubleClick: (event: React.MouseEvent) => {
                        event.stopPropagation();
                        setSelectedCad2dIds([entity.id]);
                        if (entity.type === "text") {
                          setInlineEditTextId(entity.id);
                        }
                        setCadPropsOpen(true);
                      },
                      onContextMenu: (event: React.MouseEvent) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedCad2dIds([entity.id]);
                        setContextMenu({ x: event.clientX, y: event.clientY, type: "cad2d", id: entity.id });
                      },
                    };
                    if (entity.type === "line" && entity.points && entity.points.length >= 2) {
                      const a = isoProjectV4(entity.points[0].x, entity.points[0].y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                      const b = isoProjectV4(entity.points[1].x, entity.points[1].y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                      return <line key={entity.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />;
                    }
                    if ((entity.type === "polyline" || entity.type === "polygon" || entity.type === "triangle" || entity.type === "rectangle") && entity.points && entity.points.length > 0) {
                      const d = entity.points.map((p, i) => {
                        const pp = isoProjectV4(p.x, p.y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                        return `${i ? "L" : "M"} ${pp.x} ${pp.y}`;
                      }).join(" ") + (entity.closed || entity.type !== "polyline" ? " Z" : "");
                      const hatchFill = entity.hatchPattern === "ansi31"
                        ? "url(#cadHatchAnsi31)"
                        : entity.hatchPattern === "ansi32"
                        ? "url(#cadHatchAnsi32)"
                        : entity.hatchPattern === "dots"
                        ? "url(#cadHatchDots)"
                        : entity.hatchPattern === "solid"
                        ? (entity.fill || (selected ? "#fbbf2433" : "#38bdf833"))
                        : (entity.fill || (entity.type !== "polyline" && selected ? "#fbbf2415" : "none"));
                      return <path key={entity.id} d={d} {...common} fill={hatchFill} />;
                    }
                    if (entity.type === "circle" && entity.center && entity.radius) {
                      const c = isoProjectV4(entity.center.x, entity.center.y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                      const hatchFill = entity.hatchPattern === "ansi31"
                        ? "url(#cadHatchAnsi31)"
                        : entity.hatchPattern === "ansi32"
                        ? "url(#cadHatchAnsi32)"
                        : entity.hatchPattern === "dots"
                        ? "url(#cadHatchDots)"
                        : entity.hatchPattern === "solid"
                        ? (entity.fill || (selected ? "#fbbf2433" : "#38bdf833"))
                        : (entity.fill || "none");
                      return <circle key={entity.id} cx={c.x} cy={c.y} r={entity.radius * 18 * viewport.zoom} {...common} fill={hatchFill} />;
                    }
                    if (entity.type === "arc" && entity.center && entity.radius) {
                      const c = isoProjectV4(entity.center.x, entity.center.y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                      const r = entity.radius * 18 * viewport.zoom;
                      const sa = ((entity.startAngle || 0) * Math.PI) / 180;
                      const ea = ((entity.endAngle || 90) * Math.PI) / 180;
                      const x1 = c.x + r * Math.cos(sa);
                      const y1 = c.y + r * Math.sin(sa);
                      const x2 = c.x + r * Math.cos(ea);
                      const y2 = c.y + r * Math.sin(ea);
                      const largeArc = Math.abs((entity.endAngle || 90) - (entity.startAngle || 0)) > 180 ? 1 : 0;
                      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
                      return <path key={entity.id} d={d} {...common} />;
                    }
                    if (entity.type === "text" && entity.points && entity.points[0]) {
                      const p = isoProjectV4(entity.points[0].x, entity.points[0].y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                      const fSize = entity.fontSize || 14;
                      const fFamily = entity.fontFamily || "Arial";
                      const fWeight = entity.fontWeight || "900";
                      const tAnchor = entity.textAlign === "center" ? "middle" : entity.textAlign === "right" ? "end" : "start";
                      const isInlineEditing = inlineEditTextId === entity.id;
                      return (
                        <g key={entity.id} onPointerDown={(event) => startCad2dPointer(event, entity.id, "body")} onClick={common.onClick} onDoubleClick={common.onDoubleClick} onContextMenu={common.onContextMenu} style={common.style} transform={`translate(${p.x} ${p.y}) rotate(${entity.rotation || 0})`}>
                          <rect x="-4" y={-fSize - 2} width={Math.max(48, (entity.text || "Texte").length * (fSize * 0.58))} height={fSize + 8} rx="3" fill={selected ? "#fbbf24" : "#020617"} fillOpacity={selected ? .18 : .55} stroke={stroke} strokeOpacity=".55" />
                          {isInlineEditing ? (
                            <foreignObject x="-4" y={-fSize - 4} width={Math.max(120, (entity.text || "Texte").length * (fSize * 0.7) + 30)} height={fSize + 14}>
                              <input
                                autoFocus
                                type="text"
                                value={entity.text || ""}
                                onChange={(e) => updateCad2dEntity(entity.id, { text: e.target.value })}
                                onBlur={() => setInlineEditTextId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Escape") {
                                    e.stopPropagation();
                                    setInlineEditTextId(null);
                                  }
                                }}
                                className="w-full h-full bg-black/90 border border-cyan-400 text-cyan-200 font-bold px-1 rounded outline-none"
                                style={{ fontSize: `${fSize}px`, fontFamily: fFamily }}
                              />
                            </foreignObject>
                          ) : (
                            <text x="0" y="0" fill={stroke} fontSize={fSize} fontFamily={fFamily} fontWeight={fWeight} textAnchor={tAnchor} pointerEvents="none">{entity.text || "Texte"}</text>
                          )}
                        </g>
                      );
                    }
                    return null;
                  })}
                </g>
                <g data-cad2d-grips="true">
                  {cad2dEntities.filter((entity) => (selectedCad2dIds.includes(entity.id) || isoDrawMode === "dimension") && !entity.locked).flatMap((entity) => {
                    const mkGrip = (p: Cad2dPoint, grip: string, i: number) => {
                      const pp = isoProjectV4(p.x, p.y, entity.metadata?.elevationZ || 0, viewport.zoom, viewport.panX, viewport.panY);
                      const isDimMode = isoDrawMode === "dimension";
                      const fill = isDimMode ? "#22c55e" : "#fbbf24";
                      return (
                        <rect
                          key={`${entity.id}-${grip}-${i}`}
                          data-cad2d-grip="true"
                          data-entity-id={entity.id}
                          data-grip-type={grip}
                          data-point-idx={i}
                          x={pp.x - 5}
                          y={pp.y - 5}
                          width="10"
                          height="10"
                          fill={fill}
                          stroke="#020617"
                          strokeWidth="1.5"
                          pointerEvents="all"
                          style={{ cursor: isDimMode ? "crosshair" : grip === "radius" ? "ew-resize" : "crosshair" }}
                          onPointerDown={(event) => {
                            if (isDimMode) {
                              // Dimension picker handled via anchorFromTarget
                              return;
                            }
                            startCad2dPointer(event, entity.id, grip);
                          }}
                        />
                      );
                    };
                    if (entity.type === "line" && entity.points && entity.points.length >= 2) {
                      return [mkGrip(entity.points[0], "start", 0), mkGrip(entity.points[1], "end", 1)];
                    }
                    if ((entity.type === "polyline" || entity.type === "polygon" || entity.type === "triangle" || entity.type === "rectangle") && entity.points && entity.points.length) {
                      return entity.points.map((p, i) => mkGrip(p, `v:${i}`, i));
                    }
                    if (entity.type === "circle" && entity.center) {
                      return [mkGrip(entity.center, "center", 0), mkGrip({ x: entity.center.x + (entity.radius || 1), y: entity.center.y }, "radius", 1)];
                    }
                    if (entity.type === "arc" && entity.center) {
                      return [mkGrip(entity.center, "center", 0), mkGrip({ x: entity.center.x + (entity.radius || 1), y: entity.center.y }, "radius", 1)];
                    }
                    if (entity.type === "text" && entity.points && entity.points[0]) {
                      return [mkGrip(entity.points[0], "text", 0)];
                    }
                    return [];
                  })}
                </g>

                {/* User Dimensions (Interactive CAD Cotations) */}
                {showDimensions && dimensionRenderItems.map((dimItem) => {
                  const p1 = dimItem.p1;
                  const p2 = dimItem.p2;
                  const q1 = dimItem.q1;
                  const q2 = dimItem.q2;
                  const mx = dimItem.mid.x;
                  const my = dimItem.mid.y;
                  const label = dimItem.displayValue;
                  const isDimSel = selectedDimensionId === dimItem.id || selectedDimensionIds.includes(dimItem.id);

                  return (
                    <g
                      key={dimItem.id}
                      data-iso-object="true"
                      data-iso-dimension="true"
                      data-dimension-id={dimItem.id}
                      className="cursor-pointer select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDimensionV44(dimItem.id, e.shiftKey || e.ctrlKey || e.metaKey);
                        setRightPanelOpen(true);
                        setRightPanelTab("dimensions");
                        setStatusMessage(`Cotation sélectionnée : ${label}`);
                      }}
                    >
                      {/* Extension lines from points */}
                      <line x1={p1.x} y1={p1.y} x2={q1.x} y2={q1.y} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.75" />
                      <line x1={p2.x} y1={p2.y} x2={q2.x} y2={q2.y} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.75" />
                      {/* Main dimension line */}
                      <line x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} stroke={isDimSel ? "#38bdf8" : "#0891b2"} strokeWidth={isDimSel ? "2.2" : "1.5"} />
                      {/* End ticks / arrows */}
                      <circle cx={q1.x} cy={q1.y} r={isDimSel ? 3.5 : 2.5} fill="#ffffff" stroke={isDimSel ? "#38bdf8" : "#0891b2"} strokeWidth="1.5" />
                      <circle cx={q2.x} cy={q2.y} r={isDimSel ? 3.5 : 2.5} fill="#ffffff" stroke={isDimSel ? "#38bdf8" : "#0891b2"} strokeWidth="1.5" />
                      {/* Dimension label pill */}
                      <g transform={`translate(${mx} ${my})`}>
                        <rect
                          x={-(label.length * 4.2 + 8)}
                          y="-9"
                          width={label.length * 8.4 + 16}
                          height="18"
                          rx="4"
                          fill="#020617"
                          stroke={isDimSel ? "#38bdf8" : "#0891b2"}
                          strokeWidth={isDimSel ? "1.5" : "1"}
                          className="shadow-md"
                        />
                        <text x="0" y="3.5" textAnchor="middle" fill={isDimSel ? "#7dd3fc" : "#22d3ee"} fontSize="8.5" fontWeight="900" fontFamily="monospace">
                          {label}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* PALIER 2C : Rendu des supports industriels MSS SP-58 / SP-69 */}
                <IsoSupportRenderer
                  supports={supports}
                  selectedSupportId={selectedSupportId}
                  onSelectSupport={(id) => {
                    setSelectedSupportId(id);
                    setRightPanelOpen(true);
                    setRightPanelTab("supports");
                  }}
                  onPointerDownSupport={(id, e) => {
                    beginSupportDrag(e, id);
                  }}
                  projectFn={(x, y, z) => isoProjectV4(x, y, z, viewport.zoom, viewport.panX, viewport.panY)}
                  zoom={viewport.zoom}
                />

                {/* Active Snap Reticle Indicator */}
                {activeSnap && (
                  <g pointerEvents="none" transform={`translate(${activeSnap.screenPos.x} ${activeSnap.screenPos.y})`}>
                    <circle r="8" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="3 2" />
                    <circle r="2.5" fill="#22d3ee" />
                  </g>
                )}
                {/* Marquee Selection Rectangle */}
                {marquee && (
                  <rect
                    x={Math.min(marquee.startX, marquee.currentX)}
                    y={Math.min(marquee.startY, marquee.currentY)}
                    width={Math.max(1, Math.abs(marquee.currentX - marquee.startX))}
                    height={Math.max(1, Math.abs(marquee.currentY - marquee.startY))}
                    fill={marquee.currentX < marquee.startX ? "#22c55e" : "#38bdf8"}
                    fillOpacity="0.18"
                    stroke={marquee.currentX < marquee.startX ? "#16a34a" : "#0284c7"}
                    strokeWidth="1.2"
                    strokeDasharray={marquee.currentX < marquee.startX ? "4 3" : undefined}
                    pointerEvents="none"
                  />
                )}
                {/* Live AutoCAD Drafting Ghost Preview */}
                {cadDraftSession && (() => {
                  const sess = cadDraftSession;
                  const mw = sess.mouseWorld || { x: 0, y: 0 };
                  const mScreen = isoProjectV4(mw.x, mw.y, 0, viewport.zoom, viewport.panX, viewport.panY);

                  if (sess.tool === "rectangle") {
                    if (sess.step === 1 && sess.points.length >= 1) {
                      const p1 = sess.points[0];
                      const s1 = isoProjectV4(p1.x, p1.y, 0, viewport.zoom, viewport.panX, viewport.panY);
                      const len = cadDist(p1, mw);
                      const mx = (s1.x + mScreen.x) / 2;
                      const my = (s1.y + mScreen.y) / 2;
                      return (
                        <g pointerEvents="none">
                          <line x1={s1.x} y1={s1.y} x2={mScreen.x} y2={mScreen.y} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />
                          <circle cx={s1.x} cy={s1.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                          <circle cx={mScreen.x} cy={mScreen.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                          <g transform={`translate(${mx} ${my - 12})`}>
                            <rect x="-35" y="-9" width="70" height="18" rx="4" fill="#020617" fillOpacity="0.9" stroke="#f59e0b" strokeWidth="1" />
                            <text x="0" y="3.5" textAnchor="middle" fill="#fde68a" fontSize="9" fontWeight="bold" fontFamily="monospace">
                              L = {len.toFixed(2)} m
                            </text>
                          </g>
                        </g>
                      );
                    } else if (sess.step === 2 && sess.points.length >= 2) {
                      const p1 = sess.points[0];
                      const p2 = sess.points[1];
                      const rect = buildAutocadRectangle(p1, p2, sess.length || cadDist(p1, p2), mw);
                      const sps = rect.points.map(p => isoProjectV4(p.x, p.y, 0, viewport.zoom, viewport.panX, viewport.panY));
                      const d = sps.map((sp, i) => `${i ? "L" : "M"} ${sp.x} ${sp.y}`).join(" ") + " Z";
                      return (
                        <g pointerEvents="none">
                          <path d={d} fill="#f59e0b1f" stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="5 3" />
                          {sps.map((sp, i) => (
                            <circle key={i} cx={sp.x} cy={sp.y} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                          ))}
                          <g transform={`translate(${mScreen.x + 12} ${mScreen.y - 12})`}>
                            <rect x="-4" y="-12" width="105" height="22" rx="4" fill="#020617" fillOpacity="0.95" stroke="#f59e0b" strokeWidth="1" />
                            <text x="4" y="2" fill="#fde68a" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                              {rect.length.toFixed(2)}m × {rect.width.toFixed(2)}m
                            </text>
                          </g>
                        </g>
                      );
                    }
                  }

                  if (sess.tool === "triangle") {
                    if (sess.points.length >= 1) {
                      const p1 = sess.points[0];
                      const sub = sess.subType || "equilateral";
                      let pts: Cad2dPoint[] = [];
                      if (sub === "equilateral") {
                        pts = buildEquilateralTriangle(p1, mw);
                      } else if (sub === "rectangle") {
                        pts = buildRightTriangle(p1, mw, 0, mw);
                      } else if (sub === "isocele") {
                        pts = buildIsoscelesTriangle(p1, mw, 0, mw);
                      } else if (sub === "3pts") {
                        if (sess.step === 1) {
                          const s1 = isoProjectV4(p1.x, p1.y, 0, viewport.zoom, viewport.panX, viewport.panY);
                          return (
                            <g pointerEvents="none">
                              <line x1={s1.x} y1={s1.y} x2={mScreen.x} y2={mScreen.y} stroke="#f97316" strokeWidth="2" strokeDasharray="4 3" />
                              <circle cx={s1.x} cy={s1.y} r="5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                              <circle cx={mScreen.x} cy={mScreen.y} r="5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            </g>
                          );
                        } else if (sess.step === 2 && sess.points.length >= 2) {
                          pts = [sess.points[0], sess.points[1], mw, sess.points[0]];
                        }
                      }
                      if (pts.length > 0) {
                        const sps = pts.map(p => isoProjectV4(p.x, p.y, 0, viewport.zoom, viewport.panX, viewport.panY));
                        const d = sps.map((sp, i) => `${i ? "L" : "M"} ${sp.x} ${sp.y}`).join(" ") + " Z";
                        return (
                          <g pointerEvents="none">
                            <path d={d} fill="#f973161f" stroke="#f97316" strokeWidth="2.2" strokeDasharray="4 3" />
                            {sps.map((sp, i) => (
                              <circle key={i} cx={sp.x} cy={sp.y} r="4.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            ))}
                            <g transform={`translate(${mScreen.x + 12} ${mScreen.y - 12})`}>
                              <rect x="-4" y="-10" width="85" height="18" rx="4" fill="#020617" fillOpacity="0.95" stroke="#f97316" strokeWidth="1" />
                              <text x="4" y="2" fill="#fed7aa" fontSize="8" fontWeight="bold" fontFamily="monospace">
                                Triangle {sub}
                              </text>
                            </g>
                          </g>
                        );
                      }
                    }
                  }

                  if (sess.tool === "polygon") {
                    if (sess.points.length >= 1) {
                      const center = sess.points[0];
                      const sides = sess.sides || 6;
                      const pts = buildRegularPolygon(center, mw, sides);
                      const sps = pts.map(p => isoProjectV4(p.x, p.y, 0, viewport.zoom, viewport.panX, viewport.panY));
                      const sc = isoProjectV4(center.x, center.y, 0, viewport.zoom, viewport.panX, viewport.panY);
                      const d = sps.map((sp, i) => `${i ? "L" : "M"} ${sp.x} ${sp.y}`).join(" ") + " Z";
                      const radius = cadDist(center, mw);
                      return (
                        <g pointerEvents="none">
                          <path d={d} fill="#a855f71f" stroke="#a855f7" strokeWidth="2.2" strokeDasharray="4 3" />
                          <line x1={sc.x} y1={sc.y} x2={mScreen.x} y2={mScreen.y} stroke="#c084fc" strokeWidth="1.2" strokeDasharray="3 2" />
                          <circle cx={sc.x} cy={sc.y} r="5" fill="#a855f7" stroke="#ffffff" strokeWidth="1.5" />
                          {sps.map((sp, i) => (
                            <circle key={i} cx={sp.x} cy={sp.y} r="4" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                          ))}
                          <g transform={`translate(${mScreen.x + 12} ${mScreen.y - 12})`}>
                            <rect x="-4" y="-10" width="95" height="18" rx="4" fill="#020617" fillOpacity="0.95" stroke="#a855f7" strokeWidth="1" />
                            <text x="4" y="2" fill="#e9d5ff" fontSize="8" fontWeight="bold" fontFamily="monospace">
                              N={sides} &bull; R={radius.toFixed(2)}m
                            </text>
                          </g>
                        </g>
                      );
                    }
                  }

                  if (sess.tool === "arc") {
                    if (sess.subType === "3points") {
                      if (sess.step === 1 && sess.points.length >= 1) {
                        const s1 = isoProjectV4(sess.points[0].x, sess.points[0].y, 0, viewport.zoom, viewport.panX, viewport.panY);
                        return (
                          <g pointerEvents="none">
                            <line x1={s1.x} y1={s1.y} x2={mScreen.x} y2={mScreen.y} stroke="#0ea5e9" strokeWidth="2" strokeDasharray="4 3" />
                            <circle cx={s1.x} cy={s1.y} r="5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
                            <circle cx={mScreen.x} cy={mScreen.y} r="5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
                          </g>
                        );
                      } else if (sess.step === 2 && sess.points.length >= 2) {
                        const arcData = calculate3PointArc(sess.points[0], sess.points[1], mw);
                        if (arcData) {
                          const c = isoProjectV4(arcData.center.x, arcData.center.y, 0, viewport.zoom, viewport.panX, viewport.panY);
                          const r = arcData.radius * 18 * viewport.zoom;
                          const sa = (arcData.startAngle * Math.PI) / 180;
                          const ea = (arcData.endAngle * Math.PI) / 180;
                          const x1 = c.x + r * Math.cos(sa);
                          const y1 = c.y + r * Math.sin(sa);
                          const x2 = c.x + r * Math.cos(ea);
                          const y2 = c.y + r * Math.sin(ea);
                          const largeArc = Math.abs(arcData.endAngle - arcData.startAngle) > 180 ? 1 : 0;
                          const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
                          return (
                            <g pointerEvents="none">
                              <path d={d} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="4 3" />
                              <circle cx={c.x} cy={c.y} r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
                              <circle cx={x1} cy={y1} r="4.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1" />
                              <circle cx={x2} cy={y2} r="4.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1" />
                            </g>
                          );
                        }
                      }
                    }
                  }

                  if (sess.tool === "paste_target") {
                    return (
                      <g pointerEvents="none" transform={`translate(${mScreen.x} ${mScreen.y})`}>
                        <circle r="16" fill="#10b98122" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
                        <line x1="-12" y1="0" x2="12" y2="0" stroke="#10b981" strokeWidth="1.5" />
                        <line x1="0" y1="-12" x2="0" y2="12" stroke="#10b981" strokeWidth="1.5" />
                        <g transform="translate(18 -12)">
                          <rect x="-4" y="-12" width="130" height="22" rx="4" fill="#020617" fillOpacity="0.95" stroke="#10b981" strokeWidth="1.2" />
                          <text x="4" y="2" fill="#a7f3d0" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                            CLIQUEZ POUR COLLER ICI
                          </text>
                        </g>
                      </g>
                    );
                  }

                  return null;
                })()}

                {/* Palier 2B : Indicateur visuel de modification géométrique active */}
                {cad2dModifySession && (
                  <g pointerEvents="none" transform="translate(20 30)">
                    <rect x="0" y="0" width="340" height="26" rx="6" fill="#0f172a" fillOpacity="0.92" stroke="#f59e0b" strokeWidth="1.2" />
                    <circle cx="14" cy="13" r="4" fill="#f59e0b" />
                    <text x="26" y="17" fill="#fef3c7" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                      MODIF 2D [{cad2dModifySession.mode.toUpperCase()}] : Étape {cad2dModifySession.step} (Échap pour annuler)
                    </text>
                  </g>
                )}

                {/* HALO RECTANGULAIRE LUMINEUX & BADGE FLOTTANT SUR SECTION EN ERREUR */}
                {activeErrorHighlight && (() => {
                  const h = activeErrorHighlight;
                  let box: { x: number; y: number; w: number; h: number } | null = null;
                  const label = h.code ? `${h.code} : ${h.message || ""}` : (h.message || "Anomalie détectée");

                  if (h.kind === "segment") {
                    const seg = segments.find(s => s.id === h.id);
                    if (seg) {
                      const a = nodes.find(n => n.id === seg.fromNodeId);
                      const b = nodes.find(n => n.id === seg.toNodeId);
                      if (a && b) {
                        const pa = isoProjectV4(a.x, a.y, a.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
                        const pb = isoProjectV4(b.x, b.y, b.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
                        const pad = 24;
                        const minX = Math.min(pa.x, pb.x) - pad;
                        const maxX = Math.max(pa.x, pb.x) + pad;
                        const minY = Math.min(pa.y, pb.y) - pad;
                        const maxY = Math.max(pa.y, pb.y) + pad;
                        box = { x: minX, y: minY, w: Math.max(maxX - minX, 52), h: Math.max(maxY - minY, 44) };
                      }
                    }
                  } else if (h.kind === "support") {
                    const sup = supports.find(s => s.id === h.id);
                    if (sup) {
                      const p = isoProjectV4(sup.worldPos.x, sup.worldPos.y, sup.worldPos.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
                      box = { x: p.x - 30, y: p.y - 30, w: 60, h: 60 };
                    }
                  } else {
                    const node = nodes.find(n => n.id === h.id);
                    if (node) {
                      const p = isoProjectV4(node.x, node.y, node.z || 0, viewport.zoom, viewport.panX, viewport.panY, viewport.viewMode, viewport.yaw, viewport.pitch);
                      box = { x: p.x - 28, y: p.y - 28, w: 56, h: 56 };
                    }
                  }

                  if (!box) return null;

                  const bracketLen = Math.min(12, Math.min(box.w, box.h) / 3);

                  return (
                    <g key="error-halo-overlay" className="animate-in fade-in duration-200">
                      {/* Halo rectangulaire lumineux pulsant */}
                      <rect
                        x={box.x - 4}
                        y={box.y - 4}
                        width={box.w + 8}
                        height={box.h + 8}
                        rx="10"
                        fill="#ef4444"
                        fillOpacity="0.16"
                        stroke="#f87171"
                        strokeWidth="1.5"
                        strokeOpacity="0.6"
                      />
                      <rect
                        x={box.x}
                        y={box.y}
                        width={box.w}
                        height={box.h}
                        rx="6"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="6 3"
                      />
                      {/* Coins CAD de précision (Brackets) */}
                      <path d={`M${box.x} ${box.y + bracketLen} L${box.x} ${box.y} L${box.x + bracketLen} ${box.y}`} fill="none" stroke="#fca5a5" strokeWidth="3" />
                      <path d={`M${box.x + box.w - bracketLen} ${box.y} L${box.x + box.w} ${box.y} L${box.x + box.w} ${box.y + bracketLen}`} fill="none" stroke="#fca5a5" strokeWidth="3" />
                      <path d={`M${box.x} ${box.y + box.h - bracketLen} L${box.x} ${box.y + box.h} L${box.x + bracketLen} ${box.y + box.h}`} fill="none" stroke="#fca5a5" strokeWidth="3" />
                      <path d={`M${box.x + box.w - bracketLen} ${box.y + box.h} L${box.x + box.w} ${box.y + box.h} L${box.x + box.w} ${box.y + box.h - bracketLen}`} fill="none" stroke="#fca5a5" strokeWidth="3" />

                      {/* Badge / Pill flottant au-dessus du rectangle */}
                      <g transform={`translate(${box.x + box.w / 2} ${Math.max(16, box.y - 14)})`}>
                        <path d="M-5 0 L5 0 L0 5 Z" fill="#b91c1c" />
                        <rect
                          x={-Math.min(160, Math.max(60, label.length * 3.8 + 20))}
                          y="-20"
                          width={Math.min(320, Math.max(120, label.length * 7.6 + 40))}
                          height="20"
                          rx="5"
                          fill="#7f1d1d"
                          stroke="#ef4444"
                          strokeWidth="1.2"
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                        />
                        <text
                          x="0"
                          y="-6.5"
                          textAnchor="middle"
                          fill="#fef2f2"
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          ⚠️ {label.length > 40 ? label.slice(0, 38) + "…" : label}
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </g>

              {(() => {
                const axes = getProjectionAxes(viewport.viewMode, viewport.yaw, viewport.pitch);
                const dynamicAxisDirs = [
                  { key: "X", sx: axes.dx_x, sy: axes.dy_x, color: "#ef4444" },
                  { key: "Y", sx: axes.dx_y, sy: axes.dy_y, color: "#22c55e" },
                  { key: "Z", sx: axes.dx_z, sy: axes.dy_z, color: "#3b82f6" },
                ];
                return (
                  <g transform="translate(566 44)" style={{ cursor: "pointer", userSelect: "none" }} data-pdi-viewcube="true">
                    {/* Ring helper */}
                    <circle r="32" fill="#0f172a" fillOpacity="0.5" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                    {dynamicAxisDirs.map(a => {
                      const len = Math.hypot(a.sx, a.sy);
                      const lx = len > 0.05 ? (a.sx / len) * 32 : 0;
                      const ly = len > 0.05 ? (a.sy / len) * 32 : 0;
                      return (
                        <g 
                          key={a.key} 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (a.key === "X") {
                              resetView(undefined, undefined, undefined, undefined, "front");
                            } else if (a.key === "Y") {
                              resetView(undefined, undefined, undefined, undefined, "side");
                            } else if (a.key === "Z") {
                              resetView(undefined, undefined, undefined, undefined, "top");
                            }
                          }}
                          className="group"
                        >
                          <circle cx={a.sx * 22} cy={a.sy * 22} r="8" fill="transparent" />
                          <line 
                            x1="0" 
                            y1="0" 
                            x2={a.sx * 22} 
                            y2={a.sy * 22} 
                            stroke={a.color} 
                            strokeWidth={viewport.viewMode === "free" ? "2.5" : "1.8"} 
                            strokeLinecap="round" 
                          />
                          <text 
                            x={lx} 
                            y={ly + 3} 
                            fill={a.color} 
                            fontSize="9" 
                            fontWeight="bold" 
                            textAnchor="middle"
                          >
                            {a.key}
                          </text>
                        </g>
                      );
                    })}
                    {/* Center point to reset view */}
                    <circle 
                      r="3.5" 
                      fill="#e2e8f0" 
                      stroke="#475569" 
                      strokeWidth="1.2"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetView(undefined, undefined, undefined, undefined, "iso");
                      }}
                    />
                  </g>
                );
              })()}

              {/* Curseur Trièdre pendant le déplacement d'un élément (SKETCH-DETECT-08 / PARTIE 2) */}
              {axisCursorEnabled && dragCursorPos && (dragNodeId || dragFittingInfo) && (
                <AxisCursorOverlay x={dragCursorPos.x} y={dragCursorPos.y} inSvg={true} />
              )}
            </svg>

            {/* Interactive CAD Context Menu & Floating PROPS */}
            {selectedCad2dEntity && cadPropsOpen && (
              <div className="pdi-cad-float-props" style={{ left: cadPropsPos.x, top: cadPropsPos.y }} onMouseDown={(e)=>e.stopPropagation()}>
                <div className="pdi-cad-float-head" onPointerDown={startCadPropsPointerDrag}>
                  <b>PROPRIÉTÉS CAD</b><span>{selectedCad2dEntity.type}</span><button onClick={()=>setCadPropsOpen(false)}>×</button>
                </div>
                <div className="pdi-cad-float-body">
                  <label>Layer<select value={selectedCad2dEntity.layerId} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{layerId:e.target.value})}>{cad2dLayers.map(layer=><option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
                  <label>Couleur<input type="color" value={selectedCad2dEntity.color} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{color:e.target.value})}/></label>
                  <label>Ligne<select value={selectedCad2dEntity.lineType || "continuous"} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{lineType:e.target.value as Cad2dEntity["lineType"]})}><option value="continuous">Continue</option><option value="dashed">Tirets</option><option value="center">Axe</option><option value="hidden">Cachée</option></select></label>
                  <label>Épaisseur<input type="number" min="0.5" step="0.5" value={selectedCad2dEntity.lineWeight || 1.5} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{lineWeight:Number(e.target.value)||1.5})}/></label>
                  {selectedCad2dEntity.type === "text" && <>
                    <label className="wide">Texte<input value={selectedCad2dEntity.text || ""} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{text:e.target.value})}/></label>
                    <label>Taille<input type="number" min="6" max="96" value={selectedCad2dEntity.fontSize || 16} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{fontSize:Number(e.target.value)||16})}/></label>
                    <label>Police<select value={selectedCad2dEntity.fontFamily || "Arial"} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{fontFamily:e.target.value})}><option>Arial</option><option>Inter</option><option>JetBrains Mono</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option></select></label>
                  </>}
                  <label>Rotation (°)<input type="number" step="1" value={selectedCad2dEntity.rotation || 0} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{rotation:Number(e.target.value)||0})}/></label>
                  <label>Opacité<input type="number" min="0.1" max="1" step="0.05" value={selectedCad2dEntity.opacity ?? 1} onChange={e=>updateCad2dEntity(selectedCad2dEntity.id,{opacity:Number(e.target.value)||1})}/></label>
                </div>
                <div className="pdi-cad-float-actions">
                  <button onClick={duplicateSelectedCad2d} title="Dupliquer">Dupliquer</button>
                  <button onClick={()=>rotateSelectedCad2d(15)} title="Rotation +15°">Rot +15°</button>
                  <button onClick={()=>scaleSelectedCad2d(1.1)} title="Agrandir +10%">Échelle +</button>
                  <button onClick={deleteSelectedCad2d} className="text-red-400" title="Supprimer">Suppr</button>
                </div>
              </div>
            )}
            {selectedCad2dEntity && !cadPropsOpen && <button className="pdi-cad-props-tab" onClick={()=>setCadPropsOpen(true)} style={{ left: cadPropsPos.x, top: cadPropsPos.y }}>PROPS</button>}

            {/* Barre d'action rapide flottante Tuyauterie, Spools & Alignement */}
            {!contextMenu && (selectedSegmentIds.length > 0 || selectedNodeIds.length > 0) && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl rounded-full px-4 py-1.5 flex items-center gap-2 text-xs text-white pointer-events-auto animate-fade-in max-w-[95vw] overflow-x-auto"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700/80 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-bold text-[11px] text-cyan-200">
                    {selectedSegmentIds.length + selectedNodeIds.length} sélectionné(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => associateSelectionToSpool()}
                  className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full font-bold flex items-center gap-1.5 shadow transition-all hover:scale-105 active:scale-95 shrink-0"
                  title="Associer les éléments sélectionnés dans un Spool / Tronçon d'atelier (Ctrl+G)"
                >
                  <span>⚭</span>
                  <span>Associer Spool</span>
                  <span className="text-[10px] text-blue-200 font-mono opacity-80">Ctrl+G</span>
                </button>
                <button
                  type="button"
                  onClick={() => dissociateSelectionFromSpool()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full font-medium flex items-center gap-1.5 transition-all shrink-0"
                  title="Dissocier du Spool (Ctrl+Shift+G)"
                >
                  <span>⚮</span>
                  <span>Dissocier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorBySpool((v) => !v)}
                  className={`px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                    colorBySpool
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Activer / Désactiver la coloration automatique par Spool"
                >
                  <span>🎨</span>
                  <span>Couleur</span>
                </button>

                <div className="w-px h-4 bg-slate-700 mx-0.5 shrink-0" />

                {/* Actions rapides d'alignement */}
                <button
                  type="button"
                  onClick={startAlignWizard}
                  className="px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 rounded-full font-bold flex items-center gap-1 shadow transition-all hover:scale-105 active:scale-95 shrink-0"
                  title="Aligner sur un objet & orientation de référence (AL)"
                >
                  <span>📐</span>
                  <span>Aligner (AL)</span>
                </button>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-full px-1.5 py-0.5 shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold mr-0.5">Axe:</span>
                  <button
                    type="button"
                    onClick={() => alignSelectedNodesAxis("x")}
                    className="px-1.5 py-0.5 bg-red-900/60 hover:bg-red-600 text-red-200 hover:text-white rounded text-[10px] font-mono font-bold transition-all"
                    title="Aligner sur l'axe monde X (AX)"
                  >
                    X
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedNodesAxis("y")}
                    className="px-1.5 py-0.5 bg-emerald-900/60 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded text-[10px] font-mono font-bold transition-all"
                    title="Aligner sur l'axe monde Y (AY)"
                  >
                    Y
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedNodesAxis("z")}
                    className="px-1.5 py-0.5 bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white rounded text-[10px] font-mono font-bold transition-all"
                    title="Aligner sur l'axe monde Z (AZ)"
                  >
                    Z
                  </button>
                </div>
                {selectedSegmentIds.length >= 2 && (
                  <button
                    type="button"
                    onClick={startParallelWizard}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-full font-bold flex items-center gap-1 transition-all shrink-0"
                    title="Rendre les tronçons parallèles par référence (//)"
                  >
                    <span>∥</span>
                    <span>Parallèle</span>
                  </button>
                )}
                {selectedSegmentIds.length >= 1 && (
                  <button
                    type="button"
                    onClick={redressIsoSelection}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white rounded-full font-medium flex items-center gap-1 transition-all shrink-0"
                    title="Redresser les tronçons sur les axes isométriques stricts (ISO)"
                  >
                    <span>⬡</span>
                    <span>Redresser</span>
                  </button>
                )}

                <div className="w-px h-4 bg-slate-700 mx-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => clearSelection()}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors shrink-0"
                  title="Désélectionner (Échap)"
                >
                  ✕
                </button>
              </div>
            )}

            {contextMenu && (
              <div
                className="fixed z-[10005] bg-slate-900/95 backdrop-blur border border-slate-700 shadow-2xl rounded-xl py-1 min-w-[210px] text-xs text-slate-200"
                style={{ left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 220), top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 600) - 300) }}
                onMouseDown={e => e.stopPropagation()}
              >
                {contextMenu.type === "cad2d" && (() => {
                  const ent = cad2dEntities.find(e => e.id === contextMenu.id);
                  if (!ent) return null;
                  return (
                    <>
                      <div className="px-3 py-1 text-[10px] font-black uppercase text-amber-400 border-b border-slate-800 flex justify-between">
                        <span>Élément CAD 2D</span>
                        <span className="font-mono text-slate-400">{ent.type}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCadPropsOpen(true); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-amber-300 font-bold"
                      >
                        <span>⚙️</span> Panneau Propriétés (PROPS)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRightPanelOpen(true); setRightPanelTab("properties"); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-cyan-300"
                      >
                        <span>📋</span> Grand Tableau des Propriétés (F2)
                      </button>
                      {ent.type === "text" && (
                        <button
                          type="button"
                          onClick={() => { setInlineEditTextId(ent.id); setContextMenu(null); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-emerald-300"
                        >
                          <span>✏️</span> Éditer le texte (Double-clic)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { rotateSelectedCad2d(15); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span>🔄</span> Rotation +15° (R)
                      </button>
                      <button
                        type="button"
                        onClick={() => { rotateSelectedCad2d(-15); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span>🔄</span> Rotation −15° (Maj+R)
                      </button>
                      <button
                        type="button"
                        onClick={() => { duplicateSelectedCad2d(); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span>📑</span> Dupliquer (Ctrl+D)
                      </button>
                      <div className="h-px bg-slate-800 my-1" />
                      <button
                        type="button"
                        onClick={() => { deleteSelectedCad2d(); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2"
                      >
                        <span>🗑️</span> Supprimer (Suppr)
                      </button>
                    </>
                  );
                })()}

                {contextMenu.type === "segment" && (
                  <>
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-blue-400 border-b border-slate-800 flex justify-between">
                      <span>Tronçon</span>
                      <span className="font-mono text-slate-400">DN{segments.find(s=>s.id===contextMenu.id)?.dn}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { if (contextMenu.id) insertGraphicFitting(contextMenu.id, "vanne_passage_total", 0.5); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2"
                    >
                      <span>➕</span> Insérer Vanne (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (contextMenu.id) insertGraphicFitting(contextMenu.id, "coude_90", 0.5); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-amber-600 hover:text-white flex items-center gap-2"
                    >
                      <span>➕</span> Insérer Coude 90°
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsoDrawMode("te"); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-purple-600 hover:text-white flex items-center gap-2"
                    >
                      <span>➕</span> Insérer Té de dérivation
                    </button>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { setRightPanelOpen(true); setRightPanelTab("properties"); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-amber-300"
                    >
                      <span>📋</span> Liste & Propriétés...
                    </button>
                    <button
                      type="button"
                      onClick={() => { copySelection(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>📄</span> Copier (Ctrl+C)
                    </button>
                    <button
                      type="button"
                      onClick={() => { duplicateSelection(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>📑</span> Dupliquer (Ctrl+D)
                    </button>
                    {(() => {
                      const currentSeg = segments.find(s => s.id === contextMenu.id);
                      if (currentSeg?.spoolNumber && currentSeg.spoolNumber !== "NONE") {
                        return (
                          <button
                            type="button"
                            onClick={() => { selectWholeSpool(currentSeg.spoolNumber); setContextMenu(null); }}
                            className="w-full text-left px-3 py-1.5 hover:bg-cyan-700 hover:text-white flex items-center gap-2 text-cyan-300 font-semibold"
                          >
                            <span>🔍</span> Sélectionner tout le Spool {currentSeg.spoolNumber}
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button
                      type="button"
                      onClick={() => { associateSelectionToSpool(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 text-blue-300 font-bold"
                    >
                      <span>⚭</span> Associer en Spool (Ctrl+G)
                    </button>
                    <button
                      type="button"
                      onClick={() => { dissociateSelectionFromSpool(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                    >
                      <span>⚮</span> Dissocier du Spool (Ctrl+Shift+G)
                    </button>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { startAlignWizard(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-emerald-600 hover:text-white flex items-center gap-2 text-emerald-300"
                    >
                      <span>📐</span> Aligner sur objet (AL)
                    </button>
                    <button
                      type="button"
                      onClick={() => { startParallelWizard(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-cyan-300"
                    >
                      <span>∥</span> Rendre parallèle (//)
                    </button>
                    <button
                      type="button"
                      onClick={() => { redressIsoSelection(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-purple-300"
                    >
                      <span>⬡</span> Redresser ISO (ISO)
                    </button>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { if (contextMenu.id) removeSegment(contextMenu.id); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2"
                    >
                      <span>🗑️</span> Supprimer ce tronçon
                    </button>
                  </>
                )}

                {contextMenu.type === "node" && (
                  <>
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-amber-400 border-b border-slate-800 flex justify-between">
                      <span>Point / Nœud</span>
                      <span className="font-mono text-slate-400">{nodes.find(n=>n.id===contextMenu.id)?.name}</span>
                    </div>
                    {selectedNodeIds.length === 2 ? (
                      <button
                        type="button"
                        onClick={() => {
                          createSegmentFromNodes(selectedNodeIds[0], selectedNodeIds[1]);
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-2 text-xs"
                      >
                        <span>🔗</span> Créer le tube entre les 2 nœuds (T)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const nId = contextMenu.id || selectedNodeId || selectedNodeIds[0];
                          if (nId) {
                            setIsoDrawMode("segment");
                            setInteractionMode("select");
                            setDrawStartNodeId(nId);
                            const nd = nodes.find(n => n.id === nId);
                            setStatusMessage(`Point 1 fixé (${nd?.name || nId}). Cliquez sur le deuxième nœud d'arrivée pour créer le tube.`);
                            setAutocadPrompt(`TUBE [Étape 2/2] : Cliquez sur le deuxième nœud d'arrivée (${nd?.name || nId} ➔ ?)`);
                          }
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-emerald-600/50 text-emerald-300 hover:text-white flex items-center gap-2"
                      >
                        <span>🔗</span> Tracer un tube depuis ce nœud (T)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { rotateSelectedEquipment(15); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>🔄</span> Rotation +15° (R)
                    </button>
                    <button
                      type="button"
                      onClick={() => { rotateSelectedEquipment(-15); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>🔄</span> Rotation −15° (Maj+R)
                    </button>
                    <button
                      type="button"
                      onClick={() => { flipSelectedEquipment(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>🔀</span> Inverser / Miroir (F)
                    </button>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { setRightPanelOpen(true); setRightPanelTab("properties"); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-amber-300"
                    >
                      <span>📋</span> Liste & Propriétés (Z/Élévation)...
                    </button>
                    <button
                      type="button"
                      onClick={() => { copySelection(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>📄</span> Copier (Ctrl+C)
                    </button>
                    <button
                      type="button"
                      onClick={() => { duplicateSelection(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>📑</span> Dupliquer (Ctrl+D)
                    </button>
                    {(() => {
                      const currentNode = nodes.find(n => n.id === contextMenu.id);
                      if (currentNode?.spoolNumber && currentNode.spoolNumber !== "NONE") {
                        return (
                          <button
                            type="button"
                            onClick={() => { selectWholeSpool(currentNode.spoolNumber); setContextMenu(null); }}
                            className="w-full text-left px-3 py-1.5 hover:bg-cyan-700 hover:text-white flex items-center gap-2 text-cyan-300 font-semibold"
                          >
                            <span>🔍</span> Sélectionner tout le Spool {currentNode.spoolNumber}
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button
                      type="button"
                      onClick={() => { associateSelectionToSpool(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 text-blue-300 font-bold"
                    >
                      <span>⚭</span> Associer en Spool (Ctrl+G)
                    </button>
                    <button
                      type="button"
                      onClick={() => { dissociateSelectionFromSpool(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                    >
                      <span>⚮</span> Dissocier du Spool (Ctrl+Shift+G)
                    </button>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { startAlignWizard(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-emerald-600 hover:text-white flex items-center gap-2 text-emerald-300"
                    >
                      <span>📐</span> Aligner sur objet (AL)
                    </button>
                    <div className="px-3 py-1 flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Aligner axe:</span>
                      <button
                        type="button"
                        onClick={() => { alignSelectedNodesAxis("x"); setContextMenu(null); }}
                        className="px-2 py-0.5 bg-red-950 hover:bg-red-800 text-red-200 rounded text-[10px] font-bold"
                      >
                        X
                      </button>
                      <button
                        type="button"
                        onClick={() => { alignSelectedNodesAxis("y"); setContextMenu(null); }}
                        className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-800 text-emerald-200 rounded text-[10px] font-bold"
                      >
                        Y
                      </button>
                      <button
                        type="button"
                        onClick={() => { alignSelectedNodesAxis("z"); setContextMenu(null); }}
                        className="px-2 py-0.5 bg-blue-950 hover:bg-blue-800 text-blue-200 rounded text-[10px] font-bold"
                      >
                        Z
                      </button>
                    </div>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { if (contextMenu.id) removeNode(contextMenu.id); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2"
                    >
                      <span>🗑️</span> Supprimer ce point
                    </button>
                  </>
                )}

                {contextMenu.type === "canvas" && (
                  <>
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">Espace ISO</div>
                    <button
                      type="button"
                      onClick={() => { setRightPanelOpen(true); setRightPanelTab("properties"); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-amber-300 font-bold"
                    >
                      <span>📋</span> Liste & Tableau des Propriétés (F2)
                    </button>
                    <div className="h-px bg-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { pasteClipboard(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>📋</span> Coller (Ctrl+V)
                    </button>
                    <button
                      type="button"
                      onClick={() => { undoGraph(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>↶</span> Annuler (Ctrl+Z)
                    </button>
                    <button
                      type="button"
                      onClick={() => { redoGraph(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>↷</span> Rétablir (Ctrl+Y)
                    </button>
                    <button
                      type="button"
                      onClick={() => { resetView(); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>⌖</span> Recentrer la vue (0 / F)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowGrid(v => !v); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>#</span> Basculer la grille
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDimensions(v => !v); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <span>⇔</span> Basculer cotations
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ================= PATCH 004 : menu contextuel ================= */}
            {ctxMenu && (
              <div
                style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:9999}}
                className="bg-slate-900/95 backdrop-blur border border-slate-700 text-slate-100 text-xs rounded-xl shadow-2xl p-1 w-56 flex flex-col gap-0.5"
                onClick={e=>e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-800 flex justify-between">
                  <span>PD&amp;I &middot; &Eacute;dition</span>
                  <button type="button" onClick={()=>setCtxMenu(null)} className="hover:text-white">&times;</button>
                </div>
                {selectedNodeIds.length>0 ? (
                  <>
                    <button type="button" onClick={copySelection} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between"><span>Copier</span><span className="text-slate-400">Ctrl+C</span></button>
                    <button type="button" onClick={cutSelection} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between"><span>Couper</span><span className="text-slate-400">Ctrl+X</span></button>
                    <button type="button" onClick={duplicateSelection} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between"><span>Dupliquer</span><span className="text-slate-400">Ctrl+D</span></button>
                    <button type="button" onClick={deleteSelection} className="px-2 py-1 hover:bg-red-600 rounded text-left text-red-300 flex justify-between"><span>Supprimer</span><span className="text-slate-400">Suppr</span></button>
                    <div className="h-px bg-slate-800 my-0.5" />
                    <button type="button" onClick={()=>{setPropsOpen(true);setCtxMenu(null);}} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between font-bold text-amber-300"><span>Propri&eacute;t&eacute;s</span><span>P</span></button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={!clipboardRef.current?.nodes.length} onClick={pasteClipboard} className="px-2 py-1 hover:bg-blue-600 disabled:opacity-40 rounded text-left flex justify-between"><span>Coller</span><span className="text-slate-400">Ctrl+V</span></button>
                    <button type="button" onClick={undoGraph} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between"><span>Annuler</span><span className="text-slate-400">Ctrl+Z</span></button>
                    <button type="button" onClick={redoGraph} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between"><span>R&eacute;tablir</span><span className="text-slate-400">Ctrl+Y</span></button>
                    <button type="button" onClick={()=>{resetView();setCtxMenu(null);}} className="px-2 py-1 hover:bg-blue-600 rounded text-left flex justify-between"><span>Recentrer la vue</span><span>0</span></button>
                  </>
                )}
              </div>
            )}

            {/* ================= PATCH 004 : panneau de proprietes ================= */}
            {propsOpen && (
              <div className="absolute top-3 right-3 z-30 w-80 bg-slate-900/95 backdrop-blur border border-slate-700 text-slate-100 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <strong className="text-xs font-black uppercase text-amber-300">Propri&eacute;t&eacute;s &middot; S&eacute;lection</strong>
                  <button
                    type="button"
                    onClick={() => setPropsOpen(false)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold border border-slate-700 transition-colors"
                    title="Masquer les propriétés (Hide)"
                  >
                    <X className="w-3 h-3" />
                    <span>Masquer</span>
                  </button>
                </div>
                {selectedNodeIds.length===0 && (
                  <p className="text-[11px] text-slate-400">S&eacute;lectionnez au moins un n&oelig;ud pour modifier ses coordonn&eacute;es et propri&eacute;t&eacute;s.</p>
                )}
                {selectedNodeIds.length===1 && (()=>{
                  const node=nodes.find(n=>n.id===selectedNodeIds[0]);
                  if(!node)return null;
                  return (
                    <div className="flex flex-col gap-2 text-xs">
                      <div><label className="text-[10px] text-slate-400 font-bold">Nom</label>
                        <input value={node.name} onChange={e=>setNodeMeta(node.id,{name:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"/>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div><label className="text-[10px] text-slate-400 font-bold">X (m)</label>
                          <input type="number" step={isoSnapStep} value={node.x} onChange={e=>setNodeCoordinate(node.id,"x",e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs font-mono"/>
                        </div>
                        <div><label className="text-[10px] text-slate-400 font-bold">Y (m)</label>
                          <input type="number" step={isoSnapStep} value={node.y} onChange={e=>setNodeCoordinate(node.id,"y",e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs font-mono"/>
                        </div>
                        <div><label className="text-[10px] text-slate-400 font-bold">&Eacute;l&eacute;vation Z</label>
                          <input type="number" step={isoSnapStep} value={node.z} onChange={e=>setNodeCoordinate(node.id,"z",e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs font-mono"/>
                        </div>
                      </div>
                      <div><label className="text-[10px] text-slate-400 font-bold">Ligne de tuyauterie</label>
                        <select value={node.lineId||DEFAULT_LINE_ID} onChange={e=>setNodeMeta(node.id,{lineId:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs">
                          {lines.map(l=><option key={l.id} value={l.id}>{l.lineNumber} — {l.service}</option>)}
                        </select>
                      </div>
                      {node.equipmentType && (
                        <div><label className="text-[10px] text-slate-400 font-bold">Libell&eacute; organe</label>
                          <input value={node.equipmentLabel||""} placeholder={FITTING_LABELS[node.equipmentType]} onChange={e=>setNodeMeta(node.id,{equipmentLabel:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"/>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-800 flex justify-between">
                        <button type="button" onClick={()=>removeNode(node.id)} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white text-[11px] font-bold">Supprimer ce n&oelig;ud</button>
                        <button type="button" onClick={duplicateSelection} className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white text-[11px] font-bold">Dupliquer</button>
                      </div>
                    </div>
                  );
                })()}
                {selectedNodeIds.length>1 && (
                  <div className="flex flex-col gap-2 text-xs">
                    <p className="text-[11px] text-cyan-300 font-bold">{selectedNodeIds.length} n&oelig;uds s&eacute;lectionn&eacute;s</p>
                    {selectedNodeIds.length === 2 && (
                      <button
                        type="button"
                        onClick={createTubeFromSelection}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow text-xs transition-colors"
                      >
                        <span>🔗</span> Créer un tube entre ces 2 nœuds (T)
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400">D&eacute;placement group&eacute; par fl&egrave;ches clavier (Shift = x4, Alt = Z) ou boutons :</p>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <button type="button" onClick={()=>moveSelection(0,-isoSnapStep,0)} className="bg-slate-800 hover:bg-slate-700 py-1 rounded text-[11px]">&uarr; Nord</button>
                      <button type="button" onClick={()=>moveSelection(0,isoSnapStep,0)} className="bg-slate-800 hover:bg-slate-700 py-1 rounded text-[11px]">&darr; Sud</button>
                      <button type="button" onClick={()=>moveSelection(-isoSnapStep,0,0)} className="bg-slate-800 hover:bg-slate-700 py-1 rounded text-[11px]">&larr; Ouest</button>
                      <button type="button" onClick={()=>moveSelection(isoSnapStep,0,0)} className="bg-slate-800 hover:bg-slate-700 py-1 rounded text-[11px]">&rarr; Est</button>
                      <button type="button" onClick={()=>moveSelection(0,0,isoSnapStep)} className="bg-slate-800 hover:bg-slate-700 py-1 rounded text-[11px] font-mono text-cyan-300">+Z</button>
                      <button type="button" onClick={()=>moveSelection(0,0,-isoSnapStep)} className="bg-slate-800 hover:bg-slate-700 py-1 rounded text-[11px] font-mono text-cyan-300">-Z</button>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between">
                      <button type="button" onClick={deleteSelection} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white text-[11px] font-bold">Supprimer la s&eacute;lection</button>
                      <button type="button" onClick={duplicateSelection} className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white text-[11px] font-bold">Dupliquer le groupe</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================= BARRE LATÉRALE DROITE : BIBLIOTHÈQUE & SOUS-FAMILLES ================= */}
            {libraryRightOpen && (
              <div className="absolute top-3 right-3 z-20 w-88 md:w-96 bg-slate-900/95 backdrop-blur border border-slate-700 text-slate-100 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 max-h-[88vh] overflow-hidden">
                {/* Header Bibliothèque */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <strong className="text-xs font-black uppercase text-cyan-300">Bibliothèque & Catalogue CAO</strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                      DN {newDN} · Z {nodeZ}m
                    </span>
                    <button
                      type="button"
                      onClick={() => setLibraryRightOpen(false)}
                      className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold border border-slate-700 transition-colors"
                      title="Masquer la bibliothèque (Hide)"
                    >
                      <X className="w-3 h-3" />
                      <span>Masquer</span>
                    </button>
                  </div>
                </div>

                {/* Barre de recherche */}
                <div className="relative">
                  <input
                    value={libraryQuery}
                    onChange={e => setLibraryQuery(e.target.value)}
                    placeholder="Rechercher vanne, coude, pompe, massif, ASTM, carré…"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
                  />
                  {libraryQuery && (
                    <button
                      type="button"
                      onClick={() => setLibraryQuery("")}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-white text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Onglets Sous-Familles */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-bold border-b border-slate-800 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("all")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "all" ? "bg-cyan-500 text-slate-950 font-black" : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Toutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("vannes")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "vannes" ? "bg-cyan-500 text-slate-950 font-black" : "bg-slate-800/80 text-cyan-300 hover:bg-slate-800"
                    }`}
                  >
                    🚰 Vannes
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("raccords")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "raccords" ? "bg-amber-500 text-slate-950 font-black" : "bg-slate-800/80 text-amber-300 hover:bg-slate-800"
                    }`}
                  >
                    🔄 Raccords
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("brides")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "brides" ? "bg-emerald-500 text-slate-950 font-black" : "bg-slate-800/80 text-emerald-300 hover:bg-slate-800"
                    }`}
                  >
                    🔘 Brides
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("equipements")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "equipements" ? "bg-purple-500 text-slate-950 font-black" : "bg-slate-800/80 text-purple-300 hover:bg-slate-800"
                    }`}
                  >
                    🏭 Équipements 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("gc")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "gc" ? "bg-emerald-500 text-slate-950 font-black" : "bg-slate-800/80 text-emerald-300 hover:bg-slate-800"
                    }`}
                  >
                    🏗️ Génie Civil / SP-58
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("trouvay")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "trouvay" ? "bg-blue-500 text-white font-black" : "bg-slate-800/80 text-blue-300 hover:bg-slate-800"
                    }`}
                  >
                    📦 Specs Internationales
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryCategoryTab("trigo2d")}
                    className={`px-2 py-1 rounded whitespace-nowrap transition-all ${
                      libraryCategoryTab === "trigo2d" ? "bg-rose-500 text-white font-black" : "bg-slate-800/80 text-rose-300 hover:bg-slate-800"
                    }`}
                  >
                    📐 Trigonométrie 2D
                  </button>
                </div>

                {/* Grille des éléments filtrés */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[60vh]">
                  {/* SOUS-FAMILLE : TRIGONOMÉTRIE 2D (Carré, Rectangle, Triangle, Cercle, Axe avec points d'ancrage) */}
                  {(libraryCategoryTab === "all" || libraryCategoryTab === "trigo2d") && !libraryQuery && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-rose-300">
                        <span>📐 Formes Trigonométriques 2D (Points d&apos;ancrage sur coins)</span>
                        <span className="text-[8px] text-slate-400">Clic pour insérer</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
                            const w = 2.0;
                            const h = 2.0;
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const polyEntity: Cad2dEntity = {
                              id: `cad_carre_${Date.now()}`,
                              type: "polygon",
                              layerId: "GENIE_CIVIL",
                              color: "#F43F5E",
                              lineWeight: 2,
                              points: [
                                { x, y },
                                { x: x + w, y },
                                { x: x + w, y: y + h },
                                { x, y: y + h },
                              ],
                              center: { x: x + w / 2, y: y + h / 2 },
                              width: w,
                              height: h,
                              metadata: { intent: "draft", subType: "carre_trig", elevationZ: nodeZ || 0 },
                            };
                            setCad2dEntitiesRaw(prev => [...prev, polyEntity]);
                            setSelectedCad2dIds([polyEntity.id]);
                            setStatusMessage("Carré 2D inséré avec 4 ancrages de coins");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-rose-400 text-left flex flex-col justify-between transition-all group"
                        >
                          <span className="text-[9px] font-bold text-rose-400 uppercase">Carré 2D</span>
                          <span className="text-[11px] font-bold text-white">Carré 2.0 × 2.0m</span>
                          <span className="text-[8px] text-slate-400">4 coins ancrables</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
                            const w = 3.0;
                            const h = 1.5;
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const polyEntity: Cad2dEntity = {
                              id: `cad_rect_${Date.now()}`,
                              type: "polygon",
                              layerId: "GENIE_CIVIL",
                              color: "#F43F5E",
                              lineWeight: 2,
                              points: [
                                { x, y },
                                { x: x + w, y },
                                { x: x + w, y: y + h },
                                { x, y: y + h },
                              ],
                              center: { x: x + w / 2, y: y + h / 2 },
                              width: w,
                              height: h,
                              metadata: { intent: "draft", subType: "rectangle_trig", elevationZ: nodeZ || 0 },
                            };
                            setCad2dEntitiesRaw(prev => [...prev, polyEntity]);
                            setSelectedCad2dIds([polyEntity.id]);
                            setStatusMessage("Rectangle 2D inséré avec 4 ancrages de coins");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-rose-400 text-left flex flex-col justify-between transition-all group"
                        >
                          <span className="text-[9px] font-bold text-rose-400 uppercase">Rectangle 2D</span>
                          <span className="text-[11px] font-bold text-white">Rect 3.0 × 1.5m</span>
                          <span className="text-[8px] text-slate-400">4 coins ancrables</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
                            const base = 2.0;
                            const height = 1.8;
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const triEntity: Cad2dEntity = {
                              id: `cad_tri_${Date.now()}`,
                              type: "polygon",
                              layerId: "GENIE_CIVIL",
                              color: "#F43F5E",
                              lineWeight: 2,
                              points: [
                                { x, y },
                                { x: x + base, y },
                                { x: x + base / 2, y: y + height },
                              ],
                              center: { x: x + base / 2, y: y + height / 3 },
                              width: base,
                              height: height,
                              metadata: { intent: "draft", subType: "triangle_trig", elevationZ: nodeZ || 0 },
                            };
                            setCad2dEntitiesRaw(prev => [...prev, triEntity]);
                            setSelectedCad2dIds([triEntity.id]);
                            setStatusMessage("Triangle 2D inséré avec 3 sommets ancrables");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-rose-400 text-left flex flex-col justify-between transition-all group"
                        >
                          <span className="text-[9px] font-bold text-rose-400 uppercase">Triangle 2D</span>
                          <span className="text-[11px] font-bold text-white">Triangle Base 2m</span>
                          <span className="text-[8px] text-slate-400">3 sommets ancrables</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const circleEntity: Cad2dEntity = {
                              id: `cad_circ_${Date.now()}`,
                              type: "circle",
                              layerId: "GENIE_CIVIL",
                              color: "#F43F5E",
                              lineWeight: 2,
                              center: { x, y },
                              radius: 1.0,
                              points: [{ x, y }],
                              metadata: { intent: "draft", subType: "cercle_trig", elevationZ: nodeZ || 0 },
                            };
                            setCad2dEntitiesRaw(prev => [...prev, circleEntity]);
                            setSelectedCad2dIds([circleEntity.id]);
                            setStatusMessage("Cercle 2D inséré avec centre et quadrants ancrables");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-rose-400 text-left flex flex-col justify-between transition-all group"
                        >
                          <span className="text-[9px] font-bold text-rose-400 uppercase">Cercle 2D</span>
                          <span className="text-[11px] font-bold text-white">Cercle R = 1.0m</span>
                          <span className="text-[8px] text-slate-400">Centre & 4 quadrants</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SOUS-FAMILLE : GÉNIE CIVIL (GC) & SUPPORTS MSS SP-58 */}
                  {(libraryCategoryTab === "all" || libraryCategoryTab === "gc") && !libraryQuery && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-300">
                        <span>🏗️ Ouvrages Génie Civil (GC) & Fondations Hydrocarbures</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Massif Béton GC", x, y, 0, 100, 0);
                            (gcNode as any).equipmentType = "massif_beton_gc";
                            (gcNode as any).equipmentLabel = "Massif Béton 1.2×1.2m";
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Massif béton Génie Civil inséré au sol (Z=0)");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Massif Fondation</span>
                          <span className="text-[11px] font-bold text-white">Massif GC 1.2×1.2m</span>
                          <span className="text-[8px] text-slate-400">Fondation béton Z=0</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Butée Béton GC", x, y, 0, newDN, 0);
                            (gcNode as any).equipmentType = "butee_ancrage_gc";
                            (gcNode as any).equipmentLabel = `Massif de Butée DN${newDN} (Coude/Piquage)`;
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Massif de butée béton armé inséré");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Massif Butée</span>
                          <span className="text-[11px] font-bold text-white">Butée d'Ancrage</span>
                          <span className="text-[8px] text-slate-400">Reprise poussée dynamique</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Traversée Murale GC", x, y, nodeZ || 0, newDN, 0);
                            (gcNode as any).equipmentType = "traversee_murale_gc";
                            (gcNode as any).equipmentLabel = `Fourreau Traversée DN${newDN}`;
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Traversée murale / Fourreau Génie Civil inséré");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Fourreau / Mur</span>
                          <span className="text-[11px] font-bold text-white">Traversée Murale</span>
                          <span className="text-[8px] text-slate-400">Fourreau étanche GC</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Caniveau Béton GC", x, y, 0, newDN, 0);
                            (gcNode as any).equipmentType = "caniveau_beton_gc";
                            (gcNode as any).equipmentLabel = "Caniveau Béton avec Dalle";
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Caniveau technique béton armé inséré");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Caniveau Technique</span>
                          <span className="text-[11px] font-bold text-white">Caniveau Béton BA</span>
                          <span className="text-[8px] text-slate-400">Tranchée béton avec dallettes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Fourreau Route GC", x, y, -0.8, newDN, 0);
                            (gcNode as any).equipmentType = "fourreau_route_gc";
                            (gcNode as any).equipmentLabel = `Fourreau Sous Voirie DN${Math.round(newDN * 1.5)}`;
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Fourreau de protection sous chaussée/piste inséré (Z=-0.8m)");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Traversée Route</span>
                          <span className="text-[11px] font-bold text-white">Fourreau Chaussée</span>
                          <span className="text-[8px] text-slate-400">Gaine acier de protection</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Chambre de Vanne GC", x, y, 0, newDN, 0);
                            (gcNode as any).equipmentType = "regard_vanne_gc";
                            (gcNode as any).equipmentLabel = "Chambre de Vannes Enterrée";
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Regard / Chambre de vannes en béton armé inséré");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Regard / Chambre</span>
                          <span className="text-[11px] font-bold text-white">Chambre de Vannes</span>
                          <span className="text-[8px] text-slate-400">Cuve béton fermée / tampons</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Portique Pipe-Rack GC", x, y, 0, newDN, 0);
                            (gcNode as any).equipmentType = "portique_rack_gc";
                            (gcNode as any).equipmentLabel = "Portique Pipe-Rack Acier/Béton";
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Portique de charpente / Pipe-Rack inséré");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Charpente / Rack</span>
                          <span className="text-[11px] font-bold text-white">Portique Pipe-Rack</span>
                          <span className="text-[8px] text-slate-400">Poutre HEA + massifs</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, 0);
                            const x = snapIsoV4(world.x, isoSnapStep);
                            const y = snapIsoV4(world.y, isoSnapStep);
                            const gcNode = makeEquipmentNode("pompe_centrifuge" as any, "Clôture Poste GC", x, y, 0, 0, 0);
                            (gcNode as any).equipmentType = "cloture_securite_gc";
                            (gcNode as any).equipmentLabel = "Longrine & Clôture de Sécurité";
                            setNodes(prev => [...prev, gcNode]);
                            setSelectedNodeId(gcNode.id);
                            setSelectedNodeIds([gcNode.id]);
                            setStatusMessage("Longrine et clôture de sécurité du poste insérée");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-emerald-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">Clôture Poste</span>
                          <span className="text-[11px] font-bold text-white">Longrine Clôture</span>
                          <span className="text-[8px] text-slate-400">Béton armé + barreaudage</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SOUS-FAMILLE : SPÉCIFICATIONS INTERNATIONALES (ASME / API / DIN) */}
                  {(libraryCategoryTab === "all" || libraryCategoryTab === "trouvay") && !libraryQuery && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-blue-300">
                        <span>📦 Spécifications Internationales (ASTM / ASME / API)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setNewDN(100);
                            setNewPN("Class 150");
                            setStatusMessage("Standard International : Tube ASTM A106 Gr.B DN100 Sch.STD sélectionné");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-blue-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-blue-400 uppercase">Tube Acier ASTM</span>
                          <span className="text-[11px] font-bold text-white">ASTM A106 Gr.B</span>
                          <span className="text-[8px] text-slate-400">Sans soudure Sch 40/STD</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setNewDN(150);
                            setNewPN("Class 300");
                            setStatusMessage("Standard International : Bride ASME B16.5 Cl.300 WN sélectionnée");
                          }}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-blue-400 text-left flex flex-col justify-between transition-all"
                        >
                          <span className="text-[9px] font-bold text-blue-400 uppercase">Bride Forgée ASME</span>
                          <span className="text-[11px] font-bold text-white">ASME B16.5 Cl.300</span>
                          <span className="text-[8px] text-slate-400">Collerette à souder (WN)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* GRILLE COMPLÈTE DES ORGANES & ROBINETTERIE */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {libraryItems
                      .filter(t => {
                        if (libraryCategoryTab === "all") return true;
                        const isValve = t.includes("vanne") || t.includes("soupape") || t.includes("clapet") || t.includes("robinet");
                        const isBend = t.startsWith("coude");
                        const isFlange = t.includes("bride") || t === "jmi";
                        const isEq = t.includes("pompe") || t.includes("ballon") || t.includes("echangeur") || t.includes("filtre") || t.includes("gare");
                        if (libraryCategoryTab === "vannes") return isValve;
                        if (libraryCategoryTab === "raccords") return isBend || t.startsWith("te_") || t.includes("reduction");
                        if (libraryCategoryTab === "brides") return isFlange;
                        if (libraryCategoryTab === "equipements") return isEq;
                        return true;
                      })
                      .map(t => {
                        const isValve = t.includes("vanne") || t.includes("soupape") || t.includes("clapet");
                        const isBend = t.startsWith("coude");
                        const isFlange = t.includes("bride") || t === "jmi";
                        const cat = isValve ? "VANNE" : isBend ? "COUDE" : isFlange ? "BRIDE" : "ÉQUIPEMENT";
                        const catColor = isValve ? "text-cyan-400" : isBend ? "text-amber-400" : isFlange ? "text-emerald-400" : "text-purple-400";
                        const svgGraphic = getFittingSvgGraphic(t, false);

                        return (
                          <button
                            key={t}
                            type="button"
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData("application/x-iso-equipment", t);
                              e.dataTransfer.setData("text/plain", t);
                              e.dataTransfer.effectAllowed = "copy";
                              setDraggedEquipmentType(t);
                              setStatusMessage(`Glisser ${FITTING_LABELS[t]} sur le dessin`);
                            }}
                            onDragEnd={() => setDraggedEquipmentType(null)}
                            onClick={() => {
                              setFitType(t);
                              setFitLabel(FITTING_LABELS[t]);
                              setStatusMessage(`${FITTING_LABELS[t]} sélectionné (double-clic pour insérer)`);
                            }}
                            onDoubleClick={() => {
                              if (selectedSegmentId) {
                                insertEquipmentNode(selectedSegmentId, t, 0.5, FITTING_LABELS[t]);
                                setStatusMessage(`${FITTING_LABELS[t]} inséré sur le tronçon sélectionné`);
                              } else if (selectedSegmentIds.length) {
                                insertEquipmentNode(selectedSegmentIds[0], t, 0.5, FITTING_LABELS[t]);
                                setStatusMessage(`${FITTING_LABELS[t]} inséré sur le tronçon sélectionné`);
                              } else {
                                const world = isoUnprojectV4(310, 200, viewport.zoom, viewport.panX, viewport.panY, nodeZ || 0);
                                const node = makeEquipmentNode(t, FITTING_LABELS[t], snapIsoV4(world.x, isoSnapStep), snapIsoV4(world.y, isoSnapStep), nodeZ || 0, newDN, 0);
                                const nextNodes = [...nodes, node];
                                commitGraph(nextNodes, segments);
                                setSelectedNodeId(node.id);
                                setSelectedNodeIds([node.id]);
                                setStatusMessage(`${FITTING_LABELS[t]} inséré au centre du plan`);
                              }
                            }}
                            className={`pdi-library-card relative group p-2 rounded-xl border flex flex-col justify-between text-left transition-all ${
                              fitType === t ? "active" : ""
                            } ${draggedEquipmentType === t ? "dragging" : ""}`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className={`text-[8px] font-black uppercase tracking-wider ${catColor}`}>{cat}</span>
                              <div className="w-5 h-5 flex items-center justify-center shrink-0 opacity-80 group-hover:opacity-100">
                                <svg viewBox="-18 -18 36 36" className="w-4 h-4 overflow-visible">
                                  <g dangerouslySetInnerHTML={{ __html: svgGraphic }} />
                                </svg>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-100 leading-snug line-clamp-2">{FITTING_LABELS[t]}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
</div>

          {/* PROPERTIES & LIST TABLE MODAL */}
          {propertiesModalOpen && (
            <div className="pdi-modal-backdrop fixed inset-0 z-[10020] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
              <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📋</span>
                    <div>
                      <h2 className="text-sm font-black uppercase text-white tracking-wide">Tableau des Propriétés & Nomenclature (BOM)</h2>
                      <p className="text-[10px] text-slate-400">Consultation et édition directe des nœuds (X, Y, Z / Élévation), tronçons et accessoires</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPropertiesModalOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/60">
                  <button
                    type="button"
                    onClick={() => setPropertiesActiveTab("all")}
                    className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${propertiesActiveTab === "all" ? "bg-slate-900 text-cyan-300 border-t-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Vue Globale
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertiesActiveTab("general")}
                    className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${propertiesActiveTab === "general" ? "bg-cyan-950 text-cyan-300 border-t-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Général
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertiesActiveTab("nodes")}
                    className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${propertiesActiveTab === "nodes" ? "bg-slate-900 text-cyan-300 border-t-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Nœuds & Élévations Z ({nodes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertiesActiveTab("segments")}
                    className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${propertiesActiveTab === "segments" ? "bg-slate-900 text-cyan-300 border-t-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Tronçons & Tuyauterie ({segments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertiesActiveTab("fittings")}
                    className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${propertiesActiveTab === "fittings" ? "bg-slate-900 text-cyan-300 border-t-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Équipements & Vannes ({segments.reduce((acc, s) => acc + s.fittings.length, 0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertiesActiveTab("bom")}
                    className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${propertiesActiveTab === "bom" ? "bg-slate-900 text-cyan-300 border-t-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Nomenclature Matérielle (BOM)
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {propertiesActiveTab === "general" && (
                    <div className="space-y-4 max-w-md">
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">Paramètres de l&apos;application</h3>
                        
                        <div className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-900/50 transition-colors">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-100 block">Raccourcis clavier</span>
                            <span className="text-[10px] text-slate-500">Permet d&apos;utiliser les touches A, S, G, etc. pour les outils.</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const next = !keyboardShortcutsEnabled;
                              setKeyboardShortcutsEnabled(next);
                              try { window.localStorage.setItem("pdi.keyboardShortcutsEnabled.v1", next ? "1" : "0"); } catch {}
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${keyboardShortcutsEnabled ? "bg-cyan-600" : "bg-slate-700"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${keyboardShortcutsEnabled ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-900/50 transition-colors">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-100 block">Barre de commande</span>
                            <span className="text-[10px] text-slate-500">Afficher ou masquer la barre de commande AutoCAD.</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const next = !commandPromptHidden;
                              setCommandPromptHidden(next);
                              try { window.localStorage.setItem("pdi.commandPromptHidden.v1", next ? "1" : "0"); } catch {}
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${!commandPromptHidden ? "bg-cyan-600" : "bg-slate-700"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!commandPromptHidden ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-900/50 transition-colors">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-100 block">Couleur par service</span>
                            <span className="text-[10px] text-slate-500">Coloration automatique des tubes selon le fluide (CBS).</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setColorByService(!colorByService)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${colorByService ? "bg-cyan-600" : "bg-slate-700"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${colorByService ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {(propertiesActiveTab === "all" || propertiesActiveTab === "nodes") && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">● Tableau des Nœuds & Élévations (Z)</h3>
                        <span className="text-[10px] text-slate-400 font-mono">Modifiez X, Y ou Z directement dans les champs</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[9px] border-b border-slate-800 font-bold">
                            <tr>
                              <th className="p-2.5">ID / Nom</th>
                              <th className="p-2.5">Type / Équipement</th>
                              <th className="p-2.5">X (m)</th>
                              <th className="p-2.5">Y (m)</th>
                              <th className="p-2.5 text-cyan-300">Z / Élévation (m)</th>
                              <th className="p-2.5">Rotation</th>
                              <th className="p-2.5">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {nodes.map(n => (
                              <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="p-2">
                                  <input
                                    value={n.name}
                                    onChange={e => renameNode(n.id, e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-sans font-bold text-white w-32 focus:border-cyan-400 outline-none"
                                  />
                                </td>
                                <td className="p-2 font-sans text-xs">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                                    {n.equipmentType ? equipmentLabel(n) : n.type}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={n.x}
                                    onChange={e => {
                                      const nextNodes = nodes.map(x => x.id === n.id ? { ...x, x: Number(e.target.value) || 0 } : x);
                                      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
                                    }}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-20 outline-none focus:border-cyan-400"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={n.y}
                                    onChange={e => {
                                      const nextNodes = nodes.map(x => x.id === n.id ? { ...x, y: Number(e.target.value) || 0 } : x);
                                      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
                                    }}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-20 outline-none focus:border-cyan-400"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={n.z ?? 0}
                                    onChange={e => {
                                      const nextNodes = nodes.map(x => x.id === n.id ? { ...x, z: Number(e.target.value) || 0 } : x);
                                      commitGraph(nextNodes, recalcSegmentLengths(nextNodes, segments));
                                    }}
                                    className="bg-cyan-950/60 border border-cyan-700/80 rounded px-2 py-1 text-xs text-cyan-300 font-bold w-20 outline-none focus:border-cyan-400"
                                  />
                                </td>
                                <td className="p-2 text-slate-400">
                                  {n.equipmentType ? `${Math.round(n.rotation || 0)}°` : "—"}
                                </td>
                                <td className="p-2">
                                  <button
                                    type="button"
                                    onClick={() => removeNode(n.id)}
                                    className="px-2 py-1 rounded bg-red-950/60 border border-red-800/80 hover:bg-red-900 text-red-300 text-[10px] font-sans font-bold"
                                  >
                                    Supprimer
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(propertiesActiveTab === "all" || propertiesActiveTab === "segments") && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider">● Tableau des Tronçons de Tuyauterie</h3>
                        <span className="text-[10px] text-slate-400 font-mono">Modifiez DN, PN, Longueur et Source</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[9px] border-b border-slate-800 font-bold">
                            <tr>
                              <th className="p-2.5">N° / Source</th>
                              <th className="p-2.5">De → Vers</th>
                              <th className="p-2.5">DN (Pouces)</th>
                              <th className="p-2.5">Classe PN</th>
                              <th className="p-2.5">Matériau</th>
                              <th className="p-2.5 text-cyan-300">Longueur (m)</th>
                              <th className="p-2.5">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {segments.map((s, idx) => {
                              const fromNodeName = nodes.find(n => n.id === s.fromNodeId)?.name || "Inconnu";
                              const toNodeName = nodes.find(n => n.id === s.toNodeId)?.name || "Inconnu";
                              return (
                                <tr key={s.id} className="hover:bg-slate-800/40 transition-colors font-mono">
                                  <td className="p-2">
                                    <input
                                      value={s.sourceName || ""}
                                      onChange={e => setSegments(prev => prev.map(x => x.id === s.id ? { ...x, sourceName: e.target.value } : x))}
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-sans font-bold text-white w-40 outline-none focus:border-cyan-400"
                                      placeholder={`Pipeline #${idx + 1}`}
                                    />
                                  </td>
                                  <td className="p-2 font-sans text-xs text-slate-300">
                                    {fromNodeName} → {toNodeName}
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={s.dn}
                                      onChange={e => setSegments(prev => prev.map(x => x.id === s.id ? { ...x, dn: Number(e.target.value) } : x))}
                                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white outline-none"
                                    >
                                      {DIAMETERS.map(([dn, inch]) => (
                                        <option key={dn} value={dn}>DN{dn} ({inch})</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={s.pn}
                                      onChange={e => setSegments(prev => prev.map(x => x.id === s.id ? { ...x, pn: e.target.value } : x))}
                                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white outline-none"
                                    >
                                      <option>Class 150</option>
                                      <option>Class 300</option>
                                      <option>Class 400</option>
                                      <option>Class 600</option>
                                      <option>Class 900</option>
                                      <option>Class 1500</option>
                                      <option>Class 2500</option>
                                      <option>PN16</option>
                                      <option>PN40</option>
                                    </select>
                                  </td>
                                  <td className="p-2 font-sans text-[10px] text-slate-300">
                                    {s.material || "Acier API 5L Gr. B"}
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="0.05"
                                      min="0.05"
                                      value={s.length}
                                      onChange={e => setSegmentLength(s.id, Number(e.target.value))}
                                      className="bg-cyan-950/60 border border-cyan-700/80 rounded px-2 py-1 text-xs text-cyan-300 font-bold w-20 outline-none focus:border-cyan-400"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <button
                                      type="button"
                                      onClick={() => removeSegment(s.id)}
                                      className="px-2 py-1 rounded bg-red-950/60 border border-red-800/80 hover:bg-red-900 text-red-300 text-[10px] font-sans font-bold"
                                    >
                                      Supprimer
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(propertiesActiveTab === "all" || propertiesActiveTab === "fittings") && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">● Accessoires, Vannes & Robinetterie</h3>
                        <span className="text-[10px] text-slate-400 font-mono">Position cumulée et désignation</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[9px] border-b border-slate-800 font-bold">
                            <tr>
                              <th className="p-2.5">Cumul (m)</th>
                              <th className="p-2.5">Équipement / Label</th>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">DN</th>
                              <th className="p-2.5">Réf. fabricant</th>
                              <th className="p-2.5">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {segments.flatMap(s => s.fittings.map(f => ({ f, s, p: cumulative.fittings.get(f.id) || 0 }))).map(row => (
                              <tr key={row.f.id} className="hover:bg-slate-800/40 transition-colors font-mono">
                                <td className="p-2 text-cyan-300 font-bold">{row.p.toFixed(3)} m</td>
                                <td className="p-2 font-sans font-bold text-white">{row.f.label}</td>
                                <td className="p-2 font-sans text-xs text-slate-300">{FITTING_LABELS[row.f.type] || row.f.type}</td>
                                <td className="p-2">DN{row.f.dn || row.s.dn}</td>
                                <td className="p-2 text-slate-400">{row.f.reference || "Non défini"}</td>
                                <td className="p-2 font-sans">
                                  <button
                                    type="button"
                                    onClick={() => setEdit({ segmentId: row.s.id, fitting: { ...row.f, cumulativePosition: row.p } })}
                                    className="px-2 py-1 rounded bg-blue-950/60 border border-blue-800/80 hover:bg-blue-900 text-blue-300 text-[10px] font-bold mr-1.5"
                                  >
                                    Éditer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeFitting(row.s.id, row.f.id)}
                                    className="px-2 py-1 rounded bg-red-950/60 border border-red-800/80 hover:bg-red-900 text-red-300 text-[10px] font-bold"
                                  >
                                    Supprimer
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(propertiesActiveTab === "all" || propertiesActiveTab === "bom") && (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">● Synthèse Nomenclature Matérielle (BOM)</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Longueur Totale Tube</span>
                          <strong className="text-lg font-mono text-cyan-300">{formatLength(totalLength, unitSystem)}</strong>
                          <span data-pdi-metre="017p3-bom" className="text-[8px] text-slate-500 block normal-case leading-tight mt-1">{PDI_METRE_CONVENTION_017P3}</span>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Poids Acier Estimé</span>
                          <strong className="text-lg font-mono text-amber-300">{formatMass(totalWeight, unitSystem)}</strong>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Volume d'Épreuve</span>
                          <strong className="text-lg font-mono text-emerald-300">{totalVolume.toFixed(1)} L</strong>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Pression d'Épreuve</span>
                          <strong className="text-lg font-mono text-red-400">{formatPressure(hydrotest, unitSystem)}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Projet : <span className="text-white font-bold">{projectName}</span> · <span className="font-mono text-cyan-300">{nodes.length}</span> points · <span className="font-mono text-cyan-300">{segments.length}</span> tronçons
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," +
                          "TYPE,NOM/LABEL,X,Y,Z,DN,PN,LONGUEUR\n" +
                          nodes.map(n => `NOEUD,"${n.name}",${n.x},${n.y},${n.z || 0},,,`).join("\n") + "\n" +
                          segments.map(s => `TRONCON,"${s.sourceName || "Tube"}",,,,${s.dn},${s.pn},${s.length}`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `pdi_properties_${projectName.replace(/\s+/g, "_")}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setStatusMessage("Tableau exporté en CSV");
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <span>📥</span> Exporter CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setPropertiesModalOpen(false)}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom space maximized for workspace */}
        </div>

        {/* Espace bas libéré pour maximiser la hauteur du canvas */}
      </div>

      {/* Right Collapsible Detail Bar with Auto-Hide support */}
      <div
        className={`${
          autoHideRightPanel
            ? `fixed right-2 top-[58px] bottom-3 z-[10006] w-[340px] max-w-[calc(100vw-100px)] transition-all duration-300 ease-in-out ${
                rightPanelHovered || rightPanelOpen
                  ? "translate-x-0 opacity-100 shadow-2xl"
                  : "translate-x-[calc(100%-14px)] opacity-60 hover:opacity-100 hover:translate-x-0"
              }`
            : rightPanelOpen
            ? "lg:col-span-3 space-y-3"
            : "hidden"
        } ${workspaceFullscreen && !autoHideRightPanel ? "h-full min-h-0 overflow-y-auto pl-1" : !autoHideRightPanel ? "space-y-3 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pl-1" : "h-full overflow-y-auto"}`}
        onMouseEnter={() => autoHideRightPanel && setRightPanelHovered(true)}
        onMouseLeave={() => autoHideRightPanel && setRightPanelHovered(false)}
      >
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-xl text-white space-y-3">
          {/* Header with tabs & auto-hide toggle & close button */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => setRightPanelTab("bom")}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${rightPanelTab === "bom" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                BOM
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab("dimensions")}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${rightPanelTab === "dimensions" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                Cotations ({dimensions.length})
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab("snap")}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${rightPanelTab === "snap" ? "bg-amber-600 text-white shadow-sm" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                Snap
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab("properties")}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${rightPanelTab === "properties" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                Propriétés
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab("supports")}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${rightPanelTab === "supports" ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/50" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                Supports ({supports.length})
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab("volume")}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${rightPanelTab === "volume" ? "bg-orange-600 text-white shadow-sm ring-1 ring-orange-400/50" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                Volume Skid ({envelopeActive ? "Actif" : "Inactif"})
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAutoHideRightPanel(v => !v)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                  autoHideRightPanel
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                title={autoHideRightPanel ? "Désactiver l'auto-hide (Épingler en panneau fixe)" : "Activer l'auto-hide (Masquage automatique au repos pour libérer l'espace)"}
              >
                {autoHideRightPanel ? <Minimize2 className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="text-[9px]">{autoHideRightPanel ? "Auto" : "Fixe"}</span>
              </button>
              <button
                type="button"
                onClick={() => { setRightPanelOpen(false); setRightPanelHovered(false); }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                title="Fermer le panneau latéral"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TAB: BOM */}
          {rightPanelTab === "bom" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Longueur totale</span>
                  <strong className="text-cyan-300 font-mono text-sm">{formatLength(totalLength, unitSystem)}</strong>
                  <span data-pdi-metre="017p3-panneau" className="text-[7px] text-slate-500 block normal-case leading-tight">{PDI_METRE_CONVENTION_017P3}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Poids acier</span>
                  <strong className="text-amber-300 font-mono text-sm">{formatMass(totalWeight, unitSystem)}</strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Vol. épreuve</span>
                  <strong className="text-emerald-300 font-mono text-sm">{totalVolume.toFixed(1)} L</strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Pression épreuve</span>
                  <strong className="text-red-400 font-mono text-sm">{hydrotest.toFixed(1)} bar</strong>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-2 space-y-1.5 max-h-56 overflow-y-auto">
                <div className="text-[9px] font-black uppercase text-slate-400 flex justify-between">
                  <span>Équipements & Raccords</span>
                  <span>{segments.reduce((acc, s) => acc + s.fittings.length, 0)} items</span>
                </div>
                {segments.flatMap(s => s.fittings.map(f => ({ f, s, p: cumulative.fittings.get(f.id) || 0 }))).sort((a, b) => a.p - b.p).map(row => (
                  <div key={row.f.id} className="flex items-center justify-between text-[10px] p-1.5 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-slate-700">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-100 truncate block">{row.f.label}</span>
                      <span className="text-[8px] text-cyan-400 font-mono">DN{row.f.dn || row.s.dn} · {row.p.toFixed(2)}m</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEdit({ segmentId: row.s.id, fitting: { ...row.f, cumulativePosition: row.p } })}
                      className="text-slate-400 hover:text-cyan-300 p-1"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const csvContent = "data:text/csv;charset=utf-8," +
                    "TYPE,NOM/LABEL,X,Y,Z,DN,PN,LONGUEUR\n" +
                    nodes.map(n => `NOEUD,"${n.name}",${n.x},${n.y},${n.z || 0},,,`).join("\n") + "\n" +
                    segments.map(s => `TRONCON,"${s.sourceName || "Tube"}",,,,${s.dn},${s.pn},${s.length}`).join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `pdi_bom_${projectName.replace(/\s+/g, "_")}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setStatusMessage("Nomenclature exportée en CSV");
                }}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5"
              >
                <span>📥</span> Exporter Nomenclature CSV
              </button>
            </div>
          )}

          {/* TAB: DIMENSIONS */}
          {rightPanelTab === "dimensions" && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-cyan-300 uppercase">Cotations personnalisées</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsoDrawMode("dimension");
                    setInteractionMode("select");
                    setStatusMessage("Cliquez sur 2 points/ports pour créer une cotation");
                  }}
                  className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[9px] font-black flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Nouvelle
                </button>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {dimensions.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-[10px]">
                    Aucune cotation active. Cliquez sur <b>"Nouvelle"</b> ou l'outil <b>"Cotation"</b> dans la barre d'outils.
                  </div>
                ) : (
                  dimensions.map(dim => {
                    const isSel = selectedDimensionId === dim.id;
                    return (
                      <div
                        key={dim.id}
                        onClick={() => setSelectedDimensionId(dim.id)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          isSel ? "bg-cyan-950/60 border-cyan-500 shadow-md" : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-white font-mono">{dim.label || "Cotation automatique"}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                const cycleUnits: Array<"m" | "mm" | "ft-in" | "in"> = ["m", "mm", "ft-in", "in"];
                                setDimensions(prev => prev.map(d => {
                                  if (d.id !== dim.id) return d;
                                  const curIdx = cycleUnits.indexOf(d.unit || "m");
                                  const nextUnit = cycleUnits[(curIdx + 1) % cycleUnits.length];
                                  return { ...d, unit: nextUnit };
                                }));
                              }}
                              className="px-1.5 py-0.5 bg-slate-800 text-[8px] font-bold rounded text-slate-300 uppercase"
                            >
                              {dim.unit || "m"}
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setDimensions(prev => prev.filter(d => d.id !== dim.id));
                                if (selectedDimensionId === dim.id) setSelectedDimensionId(null);
                              }}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Supprimer la cotation"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {isSel && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <div>
                              <label className="text-[8px] text-slate-400 block mb-0.5 font-bold">Libellé personnalisé</label>
                              <input
                                value={dim.label || ""}
                                placeholder="Texte auto (ex: 2.50 m)"
                                onChange={e => setDimensions(prev => prev.map(d => d.id === dim.id ? { ...d, label: e.target.value } : d))}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[8px] text-slate-400 block mb-0.5 font-bold">Décalage Y</label>
                                <input
                                  type="number"
                                  value={dim.offset?.y || -24}
                                  onChange={e => {
                                    const y = Number(e.target.value);
                                    setDimensions(prev => prev.map(d => d.id === dim.id ? { ...d, offset: { ...(d.offset || { x: 0, y: -24 }), y } } : d));
                                  }}
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-mono text-cyan-300"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] text-slate-400 block mb-0.5 font-bold">Décalage X</label>
                                <input
                                  type="number"
                                  value={dim.offset?.x || 0}
                                  onChange={e => {
                                    const x = Number(e.target.value);
                                    setDimensions(prev => prev.map(d => d.id === dim.id ? { ...d, offset: { ...(d.offset || { x: 0, y: -24 }), x } } : d));
                                  }}
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-mono text-cyan-300"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: SNAP */}
          {rightPanelTab === "snap" && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-black text-amber-300 uppercase flex items-center gap-1.5">
                  <Magnet className="w-3.5 h-3.5" /> Accrochage magnétique
                </span>
                <button
                  type="button"
                  onClick={() => setSnapEnabled(v => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${snapEnabled ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400"}`}
                >
                  {snapEnabled ? "ACTIF" : "DÉSACTIVÉ"}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 block">Pas d'accrochage grille</label>
                <div className="grid grid-cols-4 gap-1">
                  {[0.1, 0.25, 0.5, 1.0].map(step => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setIsoSnapStep(step)}
                      className={`py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${isoSnapStep === step ? "bg-amber-950/80 border-amber-500 text-amber-300" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"}`}
                    >
                      {step.toFixed(2)} m
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <label className="text-[9px] font-bold text-slate-400 block">Cibles magnétiques</label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 cursor-pointer">
                  <input type="checkbox" checked={snapPorts} onChange={e => setSnapPorts(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0" />
                  <span className="text-[10px] font-bold text-slate-200">Ports & piquages d'équipements</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 cursor-pointer">
                  <input type="checkbox" checked={snapEndpoints} onChange={e => setSnapEndpoints(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0" />
                  <span className="text-[10px] font-bold text-slate-200">Extrémités de tronçons (nœuds)</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 cursor-pointer">
                  <input type="checkbox" checked={snapMidpoints} onChange={e => setSnapMidpoints(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0" />
                  <span className="text-[10px] font-bold text-slate-200">Milieux de tuyauterie (50%)</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 cursor-pointer">
                  <input type="checkbox" checked={snapGrid} onChange={e => setSnapGrid(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0" />
                  <span className="text-[10px] font-bold text-slate-200">Accrochage sur grille isométrique</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB: PROPERTIES */}
          {rightPanelTab === "properties" && (
            <div className="space-y-3 text-xs">
              {/* Panneau Universel d'Inspection et d'Édition CAO (PdiUniversalPropertyInspector) */}
              {(() => {
                const totalSel = selectedNodeIds.length + selectedSegmentIds.length + selectedFittingIds.length + selectedCad2dIds.length;
                if (totalSel > 1) {
                  return (
                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-800/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-[10px] font-black text-cyan-400 uppercase">Sélection Multiple</span>
                        <span className="font-mono text-cyan-300 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">{totalSel} éléments</span>
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-300">
                        {selectedNodeIds.length > 0 && <div className="flex justify-between"><span>Nœuds / Équipements :</span><span className="font-bold text-amber-300">{selectedNodeIds.length}</span></div>}
                        {selectedSegmentIds.length > 0 && <div className="flex justify-between"><span>Tronçons :</span><span className="font-bold text-blue-300">{selectedSegmentIds.length}</span></div>}
                        {selectedFittingIds.length > 0 && <div className="flex justify-between"><span>Organes / Raccords :</span><span className="font-bold text-emerald-300">{selectedFittingIds.length}</span></div>}
                        {selectedCad2dIds.length > 0 && <div className="flex justify-between"><span>Dessins 2D :</span><span className="font-bold text-purple-300">{selectedCad2dIds.length}</span></div>}
                      </div>
                      {selectedNodeIds.length === 2 && selectedSegmentIds.length === 0 && (
                        <button
                          type="button"
                          onClick={createTubeFromSelection}
                          className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow text-xs transition-colors"
                        >
                          <span>🔗</span> Créer un tube entre les 2 nœuds (T)
                        </button>
                      )}
                      <div className="pt-1.5 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => associateSelectionToSpool()}
                          className="w-full py-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow text-xs transition-colors"
                          title="Associer les éléments en un sous-ensemble Spool (Ctrl+G)"
                        >
                          <span>⚭</span> Associer en Spool (Ctrl+G)
                        </button>
                        <button
                          type="button"
                          onClick={() => dissociateSelectionFromSpool()}
                          className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold rounded-lg flex items-center justify-center gap-2 border border-slate-700 text-xs transition-colors"
                          title="Dissocier les éléments du Spool (Ctrl+Shift+G)"
                        >
                          <span>⚮</span> Dissocier du Spool (Ctrl+Shift+G)
                        </button>

                        {/* Outils d'alignement */}
                        <button
                          type="button"
                          onClick={startAlignWizard}
                          className="w-full py-1.5 px-3 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white font-bold rounded-lg flex items-center justify-center gap-2 border border-emerald-700/60 text-xs transition-colors"
                          title="Aligner sur un objet & orientation de référence (AL)"
                        >
                          <span>📐</span> Aligner sur objet (AL)
                        </button>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => alignSelectedNodesAxis("x")}
                            className="py-1 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 rounded text-[10px] font-bold"
                            title="Aligner sur l'axe monde X (AX)"
                          >
                            Axe X (AX)
                          </button>
                          <button
                            type="button"
                            onClick={() => alignSelectedNodesAxis("y")}
                            className="py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-200 rounded text-[10px] font-bold"
                            title="Aligner sur l'axe monde Y (AY)"
                          >
                            Axe Y (AY)
                          </button>
                          <button
                            type="button"
                            onClick={() => alignSelectedNodesAxis("z")}
                            className="py-1 bg-blue-950/80 hover:bg-blue-900 border border-blue-800/80 text-blue-200 rounded text-[10px] font-bold"
                            title="Aligner sur l'axe monde Z (AZ)"
                          >
                            Axe Z (AZ)
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex gap-1.5">
                        <button
                          type="button"
                          onClick={universalDelete}
                          className="flex-1 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 text-[10px] font-bold"
                        >
                          Supprimer tout
                        </button>
                        <button
                          type="button"
                          onClick={clearSelection}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                        >
                          Désélectionner
                        </button>
                      </div>
                    </div>
                  );
                }

                // Résolution de l'entité universelle sélectionnée
                let universalEntity: PdiUniversalEntity | null = null;

                // A. Objet CAO 2D
                if (selectedCad2dIds.length === 1) {
                  const cad = cad2dEntities.find(c => c.id === selectedCad2dIds[0]);
                  if (cad) universalEntity = cad2dToUniversalEntity(cad);
                }

                // B. Support MSS SP-58
                if (!universalEntity && selectedSupportId) {
                  const sup = supports.find(s => s.id === selectedSupportId);
                  if (sup) {
                    const parentSeg = segments.find(seg => seg.id === sup.segmentId);
                    universalEntity = supportToUniversalEntity(sup, parentSeg);
                  }
                }

                // C. Raccord en ligne (fitting)
                if (!universalEntity && selectedFitting) {
                  const seg = segments.find(s => s.id === selectedFitting.segmentId);
                  const fit = seg?.fittings.find(f => f.id === selectedFitting.fittingId);
                  if (fit && seg) universalEntity = fittingToUniversalEntity(fit, seg);
                }

                // D. Tronçon / Tube
                if (!universalEntity) {
                  const seg = segments.find(s => s.id === selectedSegmentId || selectedSegmentIds.includes(s.id));
                  if (seg) {
                    const fromN = nodes.find(n => n.id === seg.fromNodeId);
                    const toN = nodes.find(n => n.id === seg.toNodeId);
                    universalEntity = segmentToUniversalEntity(seg, fromN, toN);
                  }
                }

                // E. Nœud / Équipement / Vanne / Té / Coude
                if (!universalEntity) {
                  const targetNodeId = selectedNodeId || selectedNodeIds[0] || selectedFittingIds[0];
                  const nd = nodes.find(n => n.id === targetNodeId);
                  if (nd) {
                    const linked = segments.filter(s => s.fromNodeId === nd.id || s.toNodeId === nd.id);
                    universalEntity = nodeToUniversalEntity(nd, linked);
                  }
                }

                if (universalEntity) {
                  return (
                    <PdiUniversalPropertyInspector
                      entity={universalEntity}
                      onChange={(updated) => {
                        if (updated.identity.category === "cad2d") {
                          setCad2dEntities(prev => prev.map(c => c.id === updated.identity.id ? {
                            ...c,
                            text: updated.identity.name || c.text,
                            layerId: updated.specific.cad2d?.layerId || c.layerId,
                            color: updated.specific.cad2d?.strokeColor || c.color,
                            lineWeight: updated.specific.cad2d?.strokeWidth || c.lineWeight,
                            lineType: (updated.specific.cad2d?.strokeDash as any) || c.lineType,
                            fill: updated.specific.cad2d?.fillColor || c.fill,
                            fillOpacity: updated.specific.cad2d?.fillOpacity ?? c.fillOpacity,
                            hatchPattern: updated.specific.cad2d?.hatchPattern || c.hatchPattern,
                            rotation: updated.geometry.rotation != null ? updated.geometry.rotation : c.rotation,
                            length: updated.geometry.length != null ? updated.geometry.length : c.length,
                            width: updated.geometry.width != null ? updated.geometry.width : c.width,
                            radius: updated.geometry.radius != null ? updated.geometry.radius : c.radius,
                          } : c));
                        } else if (updated.identity.category === "support") {
                          setSupports(prev => prev.map(s => s.id === updated.identity.id ? {
                            ...s,
                            tag: updated.tag.fullTag || s.tag,
                            type: (updated.specific.support?.mssType as any) || s.type,
                            orientationAngleDeg: updated.geometry.rotation != null ? updated.geometry.rotation : s.orientationAngleDeg,
                          } : s));
                        } else if (updated.identity.category === "fitting" && selectedFitting) {
                          const nextSegments = segments.map(s => s.id === selectedFitting.segmentId ? {
                            ...s,
                            fittings: s.fittings.map(f => f.id === updated.identity.id ? {
                              ...f,
                              label: updated.identity.name,
                              dn: updated.dn.dn,
                              reference: updated.documentation.catalogRef,
                              manufacturer: updated.documentation.manufacturer,
                            } : f),
                          } : s);
                          commitGraph(nodes, nextSegments);
                        } else if (updated.identity.category === "pipe") {
                          const nextSegments = segments.map(s => s.id === updated.identity.id ? {
                            ...s,
                            sourceName: updated.identity.name,
                            tag: updated.tag.fullTag,
                            dn: updated.dn.dn,
                            pn: updated.pn.rating,
                            material: updated.material.grade,
                            schedule: updated.material.schedule,
                            service: updated.service.code,
                            spec: updated.spec.pmsCode,
                            length: updated.geometry.length != null ? updated.geometry.length : s.length,
                            insulation: updated.specific.pipe?.insulation || s.insulation,
                            spoolNumber: updated.fabrication?.spoolNumber || s.spoolNumber,
                            fabricationLocation: (updated.fabrication?.location as any) || s.fabricationLocation,
                          } : s);
                          commitGraph(nodes, nextSegments);
                        } else {
                          // Nœud / Équipement / Vanne / Té / Coude (PATCH 017Q3-UNIFY-CORE : mutation transactionnelle avec recalcul des segments)
                          const nextNodes = nodes.map(n => n.id === updated.identity.id ? {
                            ...n,
                            name: updated.identity.name,
                            dn: updated.dn.dn,
                            reducedDn: updated.dn.reducedDn,
                            pn: updated.pn.rating,
                            material: updated.material.grade,
                            schedule: updated.material.schedule,
                            service: updated.service.code,
                            spec: updated.spec.pmsCode,
                            tag: updated.tag.fullTag,
                            reference: updated.documentation.catalogRef,
                            manufacturer: updated.documentation.manufacturer,
                            x: updated.geometry.x,
                            y: updated.geometry.y,
                            z: updated.geometry.z,
                            rotation: updated.geometry.rotation,
                            branchAngle: updated.geometry.branchAngle,
                            spoolNumber: updated.fabrication?.spoolNumber || n.spoolNumber,
                            fabricationLocation: (updated.fabrication?.location as any) || n.fabricationLocation,
                          } : n);
                          const nextSegments = recalcSegmentLengths(nextNodes, segments);
                          commitGraph(nextNodes, nextSegments);
                        }
                      }}
                      onClose={() => clearSelection()}
                      onDelete={() => universalDelete()}
                      onRotate={(delta) => universalRotate(delta)}
                      onDuplicate={() => universalDuplicate()}
                    />
                  );
                }

                return (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                    <div className="text-slate-400 text-xs font-bold">Aucun élément sélectionné</div>
                    <div className="text-slate-500 text-[11px] leading-relaxed">
                      Cliquez sur un tube, une vanne, un té, un coude, un support MSS ou un dessin 2D pour inspecter et modifier ses propriétés universelles.
                    </div>
                  </div>
                );
              })()}

              {/* Volet Anomalies & Spécification */}
              {(() => {
                const issues: Array<{ id: string; kind: "segment" | "node"; label: string }> =
                  graphIssues.map((issue) => ({
                    id: issue.entityId || issue.id,
                    kind: pdiAnomalieKind017P9(issue, nodes),
                    label: pdiAnomalieLibelle017P9(issue),
                  }));
                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-[10px] font-black text-amber-300 uppercase">Contrôle de Spécification & Anomalies</span>
                      <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded border ${issues.length === 0 ? "text-emerald-300 border-emerald-800 bg-emerald-950" : "text-amber-300 border-amber-800 bg-amber-950"}`}>
                        {issues.length}
                      </span>
                    </div>
                    {issues.length === 0 && (
                      <div className="text-[11px] text-emerald-300 font-bold">Aucune anomalie détectée · Conforme aux specs.</div>
                    )}
                    {issues.slice(0, 20).map((issue, idx) => (
                      <button
                        key={issue.kind + issue.id + String(idx)}
                        type="button"
                        onClick={() => {
                          const originalIssue = graphIssues.find(gi => (gi.entityId || gi.id) === issue.id);
                          focusAndHighlightError(issue.id, issue.kind, {
                            code: originalIssue?.code || "SPEC",
                            message: issue.label,
                          });
                        }}
                        className="w-full text-left px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-600 text-[10px] font-bold text-slate-300"
                      >
                        <span className="text-amber-300">{issue.label}</span>
                        <span className="font-mono text-slate-500"> · {issue.id}</span>
                      </button>
                    ))}
                    {issues.length > 20 && (
                      <div className="text-[10px] text-slate-500 font-bold">... et {issues.length - 20} autre(s).</div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: SUPPORTS MSS SP-58 & GÉNIE CIVIL */}
          {rightPanelTab === "supports" && (
            <PdiSupportCivilPanel
              supports={supports}
              segments={segments}
              nodes={nodes}
              selectedSupportId={selectedSupportId}
              unitSystem={unitSystem}
              onSelectSupport={(id) => setSelectedSupportId(id)}
              onUpdateSupport={(id, patch) => {
                setSupports((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
                );
              }}
              onDeleteSupport={(id) => {
                setSupports((prev) => prev.filter((s) => s.id !== id));
                if (selectedSupportId === id) setSelectedSupportId(null);
                setStatusMessage("Support supprimé");
              }}
              onAddSupportClick={() => {
                setActiveSupportTypeToPlace("mss_type_35");
                setStatusMessage("Cliquez sur un tronçon pour implanter le support MSS SP-58");
                setAutocadPrompt("COMMANDE [SUPPORT] : Cliquez un tronçon de tuyauterie pour y ancrer le support (Échap pour annuler).");
              }}
              onExportCivilCsv={exportCivilMtoCsv}
            />
          )}

          {/* TAB: ESPACE & ENVELOPPE EXTRUDÉE */}
          {rightPanelTab === "volume" && (
            <div className="space-y-4 text-xs animate-fade-in">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-orange-400">Enveloppe de Travail 3D</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={envelopeActive}
                      onChange={(e) => setEnvelopeActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:bg-orange-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:width-3 after:transition-all peer-checked:after:translate-x-4"></div>
                    <span className="ml-2 text-[10px] font-bold text-slate-300">Activer</span>
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Définit un gabarit d'intégration physique modélisé par extrusion. La tuyauterie doit être installée à l'intérieur de ces limites géométriques.
                </p>
              </div>

              {envelopeActive && (
                <>
                  {/* PRESETS DE SKIDS / LOCAUX */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Gabarit d'Espace Prédéfini</label>
                    <select
                      value={envelopePreset}
                      onChange={(e) => setEnvelopePreset(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-100"
                    >
                      <option value="skid_filtration">Skid de Filtration ASME (6.0m × 4.0m × H=3.0m)</option>
                      <option value="local_compresseur">Local Technique Compresseurs (4.5m × 3.0m × H=2.5m)</option>
                      <option value="chambre_vanne">Chambre de Vanne de Sectionnement (3.0m × 3.0m × H=2.0m)</option>
                      <option value="corridor_asme">Corridor Technique / Passerelle (10.0m × 2.0m × H=4.0m)</option>
                      <option value="custom">Gabarit Personnalisé (Saisie manuelle)</option>
                    </select>
                  </div>

                  {/* PARAMÈTRES GÉOMÉTRIQUES DU SKID */}
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[9px] font-black text-cyan-300 uppercase block tracking-wider">Cotes d'Extrusion & Limites (m)</span>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Longueur (X)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={envelopeLength}
                          onChange={(e) => {
                            setEnvelopeLength(Math.max(1, Number(e.target.value) || 1));
                            setEnvelopePreset("custom");
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Largeur (Y)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={envelopeWidth}
                          onChange={(e) => {
                            setEnvelopeWidth(Math.max(1, Number(e.target.value) || 1));
                            setEnvelopePreset("custom");
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Hauteur (Z)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={envelopeHeight}
                          onChange={(e) => {
                            setEnvelopeHeight(Math.max(1, Number(e.target.value) || 1));
                            setEnvelopePreset("custom");
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-orange-400 font-black font-mono text-[10px]"
                          title="Hauteur d'extrusion verticale de l'enveloppe"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-slate-900 pt-2">
                      <div>
                        <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Origine X</label>
                        <input
                          type="number"
                          step="0.5"
                          value={envelopeX}
                          onChange={(e) => {
                            setEnvelopeX(Number(e.target.value) || 0);
                            setEnvelopePreset("custom");
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-300 font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Origine Y</label>
                        <input
                          type="number"
                          step="0.5"
                          value={envelopeY}
                          onChange={(e) => {
                            setEnvelopeY(Number(e.target.value) || 0);
                            setEnvelopePreset("custom");
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-300 font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Origine Z</label>
                        <input
                          type="number"
                          step="0.5"
                          value={envelopeZ}
                          onChange={(e) => {
                            setEnvelopeZ(Number(e.target.value) || 0);
                            setEnvelopePreset("custom");
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-300 font-mono text-[10px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* VISUALISATION ET OPACITÉ */}
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Style d'Affichage du Volume</span>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-300">
                      <span>Rendu solide translucide</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!envelopeWireframe}
                          onChange={(e) => setEnvelopeWireframe(!e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:bg-cyan-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:width-3 after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>
                    </div>

                    {!envelopeWireframe && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8.5px] text-slate-400">
                          <span>Translucidité de l'enveloppe</span>
                          <span className="font-mono text-cyan-300">{Math.round(envelopeOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="0.4"
                          step="0.01"
                          value={envelopeOpacity}
                          onChange={(e) => setEnvelopeOpacity(Number(e.target.value))}
                          className="w-full h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* RAPPORT DE CONFINEMENT & GABARIT */}
                  <div className={`p-3 rounded-xl border ${totalEnvelopeIssues > 0 ? "bg-red-950/40 border-red-900/60" : "bg-emerald-950/40 border-emerald-900/60"} space-y-2`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{totalEnvelopeIssues > 0 ? "⚠️" : "✓"}</span>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${totalEnvelopeIssues > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        Contrôle Géométrique de l'Espace
                      </span>
                    </div>

                    {totalEnvelopeIssues === 0 ? (
                      <p className="text-[10px] text-slate-300 leading-normal">
                        Intégration conforme ! L'intégralité du réseau de tuyauterie et des supports est parfaitement confinée à l'intérieur du volume extrudé.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-300 leading-normal">
                          Dépassement détecté ! {totalEnvelopeIssues} élément(s) sortent de l'enveloppe autorisée.
                        </p>
                        <div className="max-h-24 overflow-y-auto space-y-1 border-t border-red-900/40 pt-1">
                          {outOfEnvelopeNodes.map(n => (
                            <div key={n.id} className="flex items-center justify-between text-[9px] bg-red-950/60 p-1.5 rounded">
                              <span className="font-bold text-red-200 truncate">{n.name} (Hors limite)</span>
                              <button
                                onClick={() => focusAndHighlightError(n.id, "node", { code: "GABARIT", message: "Nœud hors Skid !" })}
                                className="px-1.5 py-0.5 bg-red-800 text-white rounded font-bold hover:bg-red-700"
                              >
                                Localiser
                              </button>
                            </div>
                          ))}
                          {outOfEnvelopeSupports.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-[9px] bg-red-950/60 p-1.5 rounded">
                              <span className="font-bold text-red-200 truncate">Support {s.tag} (Hors limite)</span>
                              <button
                                onClick={() => focusAndHighlightError(s.id, "support", { code: "GABARIT", message: "Support hors Skid !" })}
                                className="px-1.5 py-0.5 bg-red-800 text-white rounded font-bold hover:bg-red-700"
                              >
                                Localiser
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {edit&&<div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex justify-between items-center"><h3 className="font-black text-slate-800">Modifier l&apos;équipement</h3><button type="button" onClick={()=>setEdit(null)}><X/></button></div>
        <select value={edit.fitting.type} onChange={e=>{const t=e.target.value as IsoFittingType;setEdit(v=>v?{...v,fitting:{...v.fitting,type:t,label:FITTING_LABELS[t]}}:v)}} className="w-full border rounded-lg p-2 text-sm font-bold">{FITTING_TYPES.map(t=><option key={t} value={t}>{FITTING_LABELS[t]}</option>)}</select>
        <input value={edit.fitting.label} onChange={e=>setEdit(v=>v?{...v,fitting:{...v.fitting,label:e.target.value}}:v)} className="w-full border rounded-lg p-2 text-sm"/>
        <div><label className="text-xs font-bold">Position sur le tronçon</label><input type="range" min="0" max="1" step=".01" value={edit.fitting.localPosition} onChange={e=>setEdit(v=>v?{...v,fitting:{...v.fitting,localPosition:Number(e.target.value)}}:v)} className="w-full"/><div className="text-right font-mono text-xs">{(edit.fitting.localPosition*100).toFixed(0)}%</div></div>
        <div className="grid grid-cols-2 gap-2">
          <select value={edit.fitting.dn||selected?.dn||150} onChange={e=>setEdit(v=>v?{...v,fitting:{...v.fitting,dn:Number(e.target.value)}}:v)} className="border rounded-lg p-2 text-sm">{DIAMETERS.map(([dn,inch])=><option key={dn} value={dn}>DN{dn} — {inch}</option>)}</select>
          <input value={edit.fitting.reference||""} onChange={e=>setEdit(v=>v?{...v,fitting:{...v.fitting,reference:e.target.value}}:v)} className="border rounded-lg p-2 text-sm" placeholder="Référence fabricant"/>
        </div>
        {isBendV4(edit.fitting.type)&&<div>
          <label className="text-xs font-bold">Orientation du coude : {Math.round(((edit.fitting.orientation??0)%360+360)%360)}°</label>
          <input type="range" min="0" max="360" step="1" value={((edit.fitting.orientation??0)%360+360)%360} onChange={e=>setEdit(v=>v?{...v,fitting:{...v.fitting,orientation:Number(e.target.value)}}:v)} className="w-full"/>
          <div className="flex justify-between text-[9px] font-mono text-slate-500"><span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>360°</span></div>
        </div>}
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>setEdit(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold">Annuler</button><button type="button" onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"><Save className="inline w-4 h-4 mr-1"/>Enregistrer</button></div>
      </div>
    </div>}



    {/* PATCH 017C : Data Manager - vue tabulaire des elements tagges */}
    {dataManagerOpen && <div className="fixed inset-0 z-[10065] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setDataManagerOpen(false)}>
      <div className="w-full max-w-5xl max-h-[86vh] overflow-auto rounded-2xl border border-cyan-600/50 bg-slate-950 p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <div className="text-sm font-black text-cyan-300 uppercase">Data Manager PD&amp;I</div>
            <div className="text-[10px] text-slate-400">{segments.filter(s => s.tag).length}/{segments.length} troncon(s) tagge(s) · {tagIssues} anomalie(s) · format {activeTagFormat.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={autoTagAllSegments} className="px-3 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/70 text-amber-200 text-[10px] font-black">Tagger tout</button>
            <button type="button" onClick={() => renumberTags(undefined, 1)} className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-black">Renumeroter</button>
            <button type="button" onClick={() => setDataManagerOpen(false)} className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black">Fermer</button>
          </div>
        </div>
        <div className="overflow-auto rounded-xl border border-slate-800">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left px-2 py-1.5 font-black uppercase text-[9px]">Tag</th>
                <th className="text-left px-2 py-1.5 font-black uppercase text-[9px]">DN</th>
                <th className="text-left px-2 py-1.5 font-black uppercase text-[9px]">Service</th>
                <th className="text-left px-2 py-1.5 font-black uppercase text-[9px]">Spec</th>
                <th className="text-left px-2 py-1.5 font-black uppercase text-[9px]">Materiau</th>
                <th className="text-left px-2 py-1.5 font-black uppercase text-[9px]">Classe</th>
                <th className="text-right px-2 py-1.5 font-black uppercase text-[9px]">Longueur (m)</th>
              </tr>
            </thead>
            <tbody>
              {segments.map(s => (
                <tr key={s.id}
                  onClick={() => { selectSegmentV44(s.id, false); setDataManagerOpen(false); }}
                  className="border-t border-slate-800 hover:bg-slate-900/70 cursor-pointer">
                  <td className="px-2 py-1 font-mono font-bold text-amber-300">{s.tag || "-"}</td>
                  <td className="px-2 py-1 text-slate-200">DN{s.dn}</td>
                  <td className="px-2 py-1 text-cyan-300 font-bold">{s.service || "-"}</td>
                  <td className="px-2 py-1 text-slate-300">{s.spec || "-"}</td>
                  <td className="px-2 py-1 text-slate-400">{s.material || "-"}</td>
                  <td className="px-2 py-1 text-slate-400">{s.pressureClass || "-"}</td>
                  <td className="px-2 py-1 text-right text-slate-200">{(s.length || 0).toFixed(3)}</td>
                </tr>
              ))}
              {segments.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-slate-500">Aucun troncon dans le plan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-slate-500">Clic sur une ligne : selection du troncon sur le plan. Cette table est la base directe du futur export BOM.</div>
      </div>
    </div>}

    {/* PATCH 017B : modal Project Setup repositionne au niveau racine */}
    {/* PATCH 017A : Project Setup PD&I */}
    {projectSetupOpen && <div className="fixed inset-0 z-[10060] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setProjectSetupOpen(false)}>
      <div className="w-full max-w-3xl max-h-[86vh] overflow-auto rounded-2xl border border-cyan-600/50 bg-slate-950 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <div className="text-sm font-black text-cyan-300 uppercase">Project Setup PD&amp;I</div>
            <div className="text-[10px] text-slate-500">Projet, formats de tag, services et specs — base du BOM et du 3D</div>
          </div>
          <button type="button" onClick={() => setProjectSetupOpen(false)} className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-black">Fermer</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase">Nom du projet</span>
            <input value={projectSetup.projectName} onChange={e => setProjectSetup(p => ({ ...p, projectName: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-white outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase">Code projet</span>
            <input value={projectSetup.projectCode} onChange={e => setProjectSetup(p => ({ ...p, projectCode: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono font-bold text-cyan-300 outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase">Client</span>
            <input value={projectSetup.client} onChange={e => setProjectSetup(p => ({ ...p, client: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-white outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase">Standard</span>
            <select value={projectSetup.standard} onChange={e => setProjectSetup(p => ({ ...p, standard: e.target.value as "ANSI" | "DIN" }))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-white outline-none">
              <option value="ANSI">ANSI</option>
              <option value="DIN">DIN</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-amber-700/50 bg-slate-900/60 p-3 space-y-2">
          <div className="text-[10px] font-black text-amber-300 uppercase">Format de tag actif</div>
          <div className="flex items-center gap-2">
            <select value={projectSetup.tagFormatName} onChange={e => setProjectSetup(p => ({ ...p, tagFormatName: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-white outline-none">
              {projectSetup.formats.map(f => (<option key={f.name} value={f.name}>{f.name}</option>))}
            </select>
            <span className="font-mono text-[11px] text-amber-200 font-bold">
              {activeTagFormat.parts.map(p => p.field).join(" " + activeTagFormat.separator + " ")}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">Exemple : <span className="font-mono text-amber-300 font-bold">100-HC-001-CS300</span></div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={autoTagAllSegments} className="px-3 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/70 text-amber-200 text-[10px] font-black">Tagger tous les troncons</button>
            <span className="text-[10px] text-slate-500">{segments.filter(s => s.tag).length}/{segments.length} tagges · {tagIssues} anomalie(s)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="text-[10px] font-black text-cyan-300 uppercase mb-1.5">Services / fluides</div>
            <div className="space-y-1 max-h-48 overflow-auto">
              {projectSetup.services.map(sv => (
                <div key={sv.code} className="flex items-center justify-between text-[10px] text-slate-300">
                  <span className="font-mono font-bold" style={{ color: sv.color }}>{sv.code}</span>
                  <span className="text-slate-400">{sv.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="text-[10px] font-black text-cyan-300 uppercase mb-1.5">Specs tuyauterie</div>
            <div className="space-y-1 max-h-48 overflow-auto">
              {projectSetup.specs.map(sp => (
                <div key={sp.code} className="flex items-center justify-between text-[10px] text-slate-300">
                  <span className="font-mono font-bold text-cyan-300">{sp.code}</span>
                  <span className="text-slate-400">{sp.material} · {sp.pressureClass} · DN{sp.minDn}-{sp.maxDn}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>}

    {/* PATCH 017D / PALIER 0 : ligne de commande compacte isolée */}
    <IsoCommandDock
      hidden={commandPromptHidden}
      modalOpen={propertiesModalOpen}
      cmdInput={autocadCmdInput}
      setCmdInput={setAutocadCmdInput}
      prompt={autocadPrompt}
      onExecuteCommand={(cmd) => executeCadCommand(cmd)}
      cadDraftSession={cadDraftSession}
      onCancelDraft={cancelCadDraft}
      onApplyNumericInput={applyNumericDraftInput}
      panelOffset={railCollapsed ? "60px" : "168px"}
    />
    {/* PATCH 017D : bouton de restauration de la ligne de commande */}
    {!propertiesModalOpen && commandPromptHidden && <button type="button" onClick={() => setCommandPromptHidden(false)} className={`pdi-cmd-restore-017d fixed bottom-2 z-[10030] rounded-lg border border-cyan-500/40 bg-slate-950/95 px-3 py-1.5 text-[11px] font-black text-cyan-200 shadow-xl transition-all duration-200 ${railCollapsed ? "left-[60px]" : "left-[168px]"}`} title="Afficher la ligne de commande (HIDE)">⌨ Commande</button>}

    <div className={`hidden pdi-status-docked ${workspaceFullscreen?"fixed bottom-0 left-[166px] right-0 z-[10008] rounded-none":"sticky bottom-2 z-40 rounded-xl"} bg-slate-950 text-slate-200 border border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] shadow-lg`}><div className="flex gap-4"><b className="text-emerald-400">● {statusMessage}</b><span className={saveState==="error"?"text-red-400":saveState==="modified"?"text-amber-300":"text-cyan-300"}>{saveState==="modified"?"Modifications non sauvegardées":saveState==="autosaved"?`Autosauvegardé${lastSavedAt?` à ${lastSavedAt}`:""}`:saveState==="error"?"Erreur de sauvegarde":""}</span><span>{nodes.length} nœuds</span><span>{segments.length} tronçons</span><span>{selectedCount} sélectionné(s)</span><span>{selectedCad2dIds.length} objet(s) 2D</span><span className={graphErrorCount?"text-red-400":"text-emerald-400"}>{graphErrorCount?`${graphErrorCount} erreur(s) réseau`:"Graphe valide"}</span><span>{projectJoints.length} joints</span></div><div className="flex gap-3"><span>Outil: <b>{interactionMode==="main"?"MAIN":isoDrawMode.toUpperCase()}</b></span><span>Snap {isoSnapStep} m</span><span>Zoom {Math.round(viewport.zoom*100)}%</span><span>Ctrl+K commandes · ? aide</span></div></div>
  </div>;
}

export { IsometrieModule };
export default IsometrieModule;
