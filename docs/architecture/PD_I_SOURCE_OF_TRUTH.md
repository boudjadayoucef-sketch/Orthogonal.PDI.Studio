# PD&I — Source of Truth & Architecture Diagnostic (Patch 001)

## Executive Summary
This diagnostic documents the active runtime architecture, coordinate pipeline, model boundaries, and business flows for PD&I in Google AI Studio. 

---

## 1. Environment & Workspace Facts

- **Git / Branch State**: Containerized AI Studio workspace. Git directory is not hosted inside the local sub-container (`fatal: not a git repository`). Upstream tracked branch is `main`.
- **Package Manager & Tooling**: `npm` with Node.js ESM + `vite` 6.2.3, `@tailwindcss/vite` 4.1.14, `react` 19.0.1.
- **Build / Lint Commands**:
  - Dev: `tsx server.ts`
  - Build: `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
  - Lint / Typecheck: `tsc --noEmit`
- **Application Entry Point**: `/src/main.tsx` -> `/src/App.tsx` -> `/src/pdi/app/PdiUnifiedApp.tsx`.
- **Routing & Module Dispatch**:
  - Global Router: Custom event dispatch via `window.dispatchEvent(new CustomEvent("pdi:navigate", { detail: "home" | "isometric" | ... }))`.
  - In `PdiUnifiedApp.tsx`, selecting `"isometric"` mounts `<PdiIsometricEditor />`.
  - `<PdiIsometricEditor />` directly instantiates `<IsometrieModuleV48d />` (`src/pdi/isometric/engine/IsometrieModuleV48d.tsx`).
- **Active Renderer**: SVG vector canvas (`viewBox="0 0 620 400"`) managed by `IsometrieModuleV48d.tsx`.

---

## 2. Active Runtime Model vs Canonical Model

### The Split
There are two distinct model worlds in the repository:
1. **Canonical Model Boundary (`src/pdi/model/index.ts`)**:
   - Declares `PdiIsometricModel`, `PipingLine`, `IsoNode` (with `IsoPoint3D position`), and `IsoSegment` (`from`, `to`, `componentType`).
   - Pure structural schema designed for export/agent interoperability.
2. **Active Runtime Model (`IsometrieModuleV48d.tsx`)**:
   - Holds the live in-memory state:
     - `nodes`: `IsoNode[]` (`id`, `name`, `x`, `y`, `z`, `type`, `equipmentType`, `rotation`, `ports: IsoPort[]`, etc.)
     - `segments`: `IsoSegment[]` (`id`, `fromNodeId`, `fromPortId`, `toNodeId`, `toPortId`, `dn`, `pn`, `material`, `length`, `fittings: IsoFitting[]`, `lineId`)
     - `dimensions`: `IsoDimension[]` (`id`, `type`, `a: IsoDimensionAnchor`, `b: IsoDimensionAnchor`, `label`, `offset`, `unit`)
     - `viewport`: `{ zoom: number; panX: number; panY: number }`
     - `projectJoints`: `PipingJoint[]` dynamically derived from nodes & segments (`deriveProjectJoints`) generating weld numbers `W001`, `W002`, etc.

### Comparison Matrix

| Concern | Canonical Model (`src/pdi/model/index.ts`) | V4.8d Runtime (`IsometrieModuleV48d.tsx`) | Actual Source of Truth | Risk / Status |
| :--- | :--- | :--- | :--- | :--- |
| **Node** | `id`, `position: {x,y,z}`, `kind` | `id`, `name`, `x`, `y`, `z`, `type`, `equipmentType`, `ports: IsoPort[]`, `rotation` | **V4.8d Runtime** | Low (V4.8d is richer, holds equipment & ports) |
| **Segment** | `id`, `from`, `to`, `nominalDiameter` | `id`, `fromNodeId`, `fromPortId`, `toNodeId`, `toPortId`, `dn`, `pn`, `length`, `fittings: IsoFitting[]` | **V4.8d Runtime** | High if converted without preserving fittings/ports |
| **Fittings** | Nested under `componentType` | `IsoFitting[]` inside segments (`localPosition`, `cumulativePosition`, `orientation`, `dn`) | **V4.8d Runtime** | Medium |
| **Equipment** | `kind: 'equipment-port'` | `IsoNode` with `equipmentType`, `ports`, `rotation`, `bendDirection` | **V4.8d Runtime** | V4.8d treats equipment as full topology nodes |
| **Ports** | Not defined explicitly | `IsoPort[]` with relative `(dx, dy, dz)`, `connectionType`, `endPreparation` | **V4.8d Runtime** | Essential for weld generation |
| **Topology** | Implicit graph | Explicit node/port graph with `validateProjectGraph` and `normalizedGraphPorts` | **V4.8d Runtime** | Active graph integrity engine |
| **Welds** | Not defined | Dynamically generated `PipingJoint[]` with `W00x` sequential numbering | **V4.8d Runtime** | Welds are computed from joint types (butt/socket/fillet) |
| **Dimensions** | Not defined | `IsoDimension[]` anchored to nodes/ports with SVG extension lines and labels | **V4.8d Runtime** | Full CAD dimension engine |
| **Viewport** | None | `{ zoom, panX, panY }` | **V4.8d Runtime** | Camera pan/zoom state |
| **BOM / Métré** | None | `materialRows()` + cumulative distance calculation + weight/volume formulas | **V4.8d Runtime** | Calculated deterministically from segment DN and length |
| **Persistence** | `PdiIsometricModel` JSON | `IsoProjectFileV474` JSON (`schemaVersion: "4.7.4"`) | **V4.8d Runtime** | Serializes full nodes, segments, lines, dimensions, workspace |

---

## 3. Duplicate Implementation Matrix

| Feature / Symbol | Canonical File | Active V4.8d Implementation | Classification |
| :--- | :--- | :--- | :--- |
| `isoProject` / `isoUnproject` | `src/pdi/isometric/isoProjection.ts` | `isoProjectV4`, `isoUnprojectV4` in `IsometrieModuleV48d.tsx` | **ACTIVE BUT DUPLICATED** (`isoProjection.ts` is unused by V4.8d; V4.8d uses internal scale 28*zoom + center (310,210)) |
| Snapping Math | `snapToIsoAxis` in `isoProjection.ts` | `snapIsoV4` + dynamic reticle in `IsometrieModuleV48d.tsx` | **ACTIVE IN V4.8D** (`isoProjection.ts` unused) |
| Model JSON Schema | `src/pdi/model/serialization.ts` (`schemaVersion: "1.0"`) | `exportProjectJson` / `importProjectJson` (`schemaVersion: "4.7.4"`) | **ACTIVE IN V4.8D** (`serialization.ts` unused by active UI) |
| Workspace Shell | `IsoWorkspace.tsx` / `IsoProfessionalWorkspace.tsx` | `IsometrieModuleV48d.tsx` | **LEGACY / UNUSED** (`IsoProfessionalWorkspace.tsx` is an older wrapper) |
| Home Navigation | Top-bar in `PdiUnifiedApp.tsx` | `pdiIsoUxRuntimePatch.js` + V48d native home button | **ACTIVE (PARTIALLY REDUNDANT)** |

---

## 4. Coordinate & Transformation Diagnostic

### Mathematical Coordinate Pipeline
1. **Pointer Event**: User clicks canvas -> `(clientX, clientY)`.
2. **DOM to SVG ViewBox**:
   ```ts
   const ctm = svg.getScreenCTM();
   const pt = svg.createSVGPoint();
   pt.x = clientX; pt.y = clientY;
   const transformed = pt.matrixTransform(ctm.inverse());
   // Result: (sx, sy) in [0..620, 0..400]
   ```
3. **SVG ViewBox to 3D World (Isometric 30° Unprojection)**:
   ```ts
   const scale = Math.max(1, 28 * zoom);
   const a = Math.PI / 6; // 30°
   const u = (sx - 310 - panX) / (Math.cos(a) * scale);
   const v = (sy + targetZ * scale - 210 - panY) / (Math.sin(a) * scale);
   const worldX = (u + v) / 2;
   const worldY = (v - u) / 2;
   const worldZ = targetZ;
   ```
4. **Snapping**:
   - Point snap: if cursor within 14px of node/port screen projection -> locks to exact node/port `(x, y, z)`.
   - Grid snap: `snapIsoV4(worldX, isoSnapStep)`.
5. **Model Storage**: Stored as real world meters `(x, y, z)`.
6. **World to SVG Rendering (Projection)**:
   ```ts
   const scale = 28 * zoom;
   const a = Math.PI / 6;
   const screenX = 310 + panX + (x - y) * Math.cos(a) * scale;
   const screenY = 210 + panY + (x + y) * Math.sin(a) * scale - z * scale;
   ```

### Why Offset Drift Occurred Previously
- When the SVG was resized without `getScreenCTM().inverse()`, aspect ratio bounding caused mismatch between bounding box percentage vs actual SVG matrix.
- `getScreenCTM().inverse()` provides matrix accuracy regardless of container padding, sidebar width, or screen DPI.

---

## 5. Engineering Flow Traces

### Library Insertion & Weld Generation Flow
1. User selects pipe segment `seg-1` (connecting `node-A` to `node-B`).
2. User double-clicks library fitting (e.g., `vanne_passage_total`).
3. `insertEquipmentNode(seg-1, "vanne_passage_total", 0.5, label)`:
   - Calculates mid-point coordinates: `wx = (nodeA.x + nodeB.x)/2`, `wy = (nodeA.y + nodeB.y)/2`, `wz = (nodeA.z + nodeB.z)/2`.
   - Creates new `IsoNode` with `equipmentType: "vanne_passage_total"` and 2 default ports.
   - Splits original segment into:
     - Segment 1: `nodeA (port 1)` -> `newNode (port 0)`
     - Segment 2: `newNode (port 1)` -> `nodeB (port 0)`
   - Computes lengths and calls `commitGraph(nextNodes, nextSegments)`.
4. `deriveProjectJoints(nextNodes, nextSegments)`:
   - Detects butt weld connections between pipe segments and valve ports.
   - Automatically generates welds `W001`, `W002`, etc.
5. `materialRows()` and `cumulativeData()`:
   - Recomputes total linear meters, steel weight per DN diameter spec, test volume, and BOM table.

---

## 6. Answers to the 19 Acceptance Questions

1. **Which branch is being compiled?** Tracked default `main` in AI Studio container.
2. **Which component renders ISO?** `src/pdi/isometric/PdiIsometricEditor.tsx`.
3. **Which engine renders ISO?** `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` (`IsometrieModule`).
4. **Which model stores real piping objects?** Internal V4.8d graph model (`nodes: IsoNode[]`, `segments: IsoSegment[]`).
5. **Which model is serialized?** `IsoProjectFileV474` (`schemaVersion: "4.7.4"`).
6. **Where does insertion happen?** In `insertEquipmentNode`, `insertTeeNode`, `insertBendNode`, `dropEquipmentOnCanvas` inside `IsometrieModuleV48d.tsx`.
7. **Where are ports created?** In `defaultEquipmentPorts()`, `defaultFreeNodePorts()`, `normalizedGraphPorts()` in `IsometrieModuleV48d.tsx`.
8. **Where is topology updated?** In `commitGraph()`, `recalcSegmentLengths()`, `validateProjectGraph()`.
9. **Where are W00x welds generated?** In `deriveProjectJoints(nodes, segments)` in `IsometrieModuleV48d.tsx`.
10. **Where is selection stored?** In React state: `selectedNodeId`, `selectedNodeIds`, `selectedSegmentId`, `selectedSegmentIds`, `selectedFitting`, `selectedDimensionId`.
11. **Where is snap calculated?** Inside `pointerMove` via `portWorldPosition`, `segmentEndpoints`, `isoUnprojectV4`, and `snapIsoV4`.
12. **Where is screen->world calculated?** In `isoUnprojectV4()` using `getSvgCoordinates(clientX, clientY, svgRef.current)`.
13. **Where are X/Y/Z stored?** On each `IsoNode` as `{ x: number, y: number, z: number }`.
14. **Where are dimensions stored?** In `dimensions: IsoDimension[]` state in `IsometrieModuleV48d.tsx`.
15. **Where is BOM calculated?** In `cumulativeData()`, `materialRows()`, `totalLength`, `totalWeight`, `totalVolume`, `hydrotest` in `IsometrieModuleV48d.tsx`.
16. **Which code is legacy?** `src/pdi/isometric/IsoWorkspace.tsx`, `src/pdi/isometric/IsoProfessionalWorkspace.tsx`.
17. **Which code is active?** `IsometrieModuleV48d.tsx`, `PdiIsometricEditor.tsx`, `PdiUnifiedApp.tsx`.
18. **Which code is duplicated?** Mathematical projections in `src/pdi/isometric/isoProjection.ts` vs `isoProjectV4` in `IsometrieModuleV48d.tsx`.
19. **What is the authoritative Source of Truth?** The in-memory state and graph engine of **`IsometrieModuleV48d.tsx`**.
