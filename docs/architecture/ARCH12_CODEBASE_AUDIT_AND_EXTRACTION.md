# ARCH-12 — REAL CODEBASE AUDIT & FIRST SAFE MODULAR EXTRACTION (ARCH-12-FIX-01)

**Repository:** `boudjadayoucef-sketch/Orthogonal-PDI-studio-`  
**Branch:** `main`  
**Starting Commit:** `88d8ff01714853b08267a0c430758a081d773fb5` (`ARCH-11-FIX-01`)  
**Current Commit Examined:** `a4a736a806647865a239ed563f95683a22d98a1c`  
**Task ID:** `ARCH-12` (Fix 01 Documentation & Finalization)

---

## 1. EXECUTIVE SUMMARY

`ARCH-12` initiates the modularization roadmap for **Orthogonal PD&I Studio** with:
1. **Phase A — Real Codebase Audit & Dependency Map:** An empirical inspection of the 5 largest production modules, exact measured line/byte counts, runtime entry points, cross-module dependencies, and prior unintegrated partial files (`isoGraphTypes.ts`, `IsoTopologyGraph.ts`).
2. **Phase B — First Safe Production-Code Extraction:** Extraction and integration of Isometric 3D Graph Types, Constants, Topological Graph Validation, Port Geometry, Legacy Migration, and Line BOM Calculation engine from `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` into:
   - `src/pdi/isometric/types/isoGraphTypes.ts`
   - `src/pdi/isometric/core/IsoTopologyGraph.ts`

`IsometrieModuleV48d.tsx` imports and re-exports these symbols cleanly, reducing `IsometrieModuleV48d.tsx` without changing any runtime behavior, public exports, or UI behavior.

---

## 2. PHASE A — REAL CODEBASE AUDIT & DEPENDENCY MAP

### 2.1 Measured File Sizes (Empirical Audit Comparison)

| File Path | Role in Runtime | Measured Line / Byte Count | Status |
| :--- | :--- | :--- | :--- |
| `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` | Core 3D Isometric Editor, Canvas Renderer, Export & Inspector Engine | **14,422 lines / 776,770 B (~759 KB)** | Active Core Engine |
| `src/components/Calculators.tsx` | Multi-disciplinary Engineering Calculators UI & local helper formulas | **10,247 lines / 574,634 B (~561 KB)** | Active UI Module |
| `src/pdi/app/PdiUnifiedApp.tsx` | Primary Unified Application Shell, Project Hub, Navigation & Workspace Host | **1,999 lines / 102,961 B (~101 KB)** | Primary Runtime Entry Shell (`App.tsx`) |
| `src/pdi/workspace/PdiSecondaryWorkspaceApp.tsx` | Legacy/Secondary Workspace Host | **825 lines / 35,752 B (~35 KB)** | Secondary / Non-Primary Shell |
| `src/pdi/sketch/SketchToIsoModule.tsx` | 2D Sketch-to-Isometric Recognition & Conversion Module | **1,181 lines / 46,454 B (~45 KB)** | Active Feature Module |
| `src/pdi/isometric/core/IsoTopologyGraph.ts` | Extracted Topological Graph Core Engine | **894 lines / 29,747 B (~29 KB)** | Upgraded & Tested Core Module |
| `src/pdi/isometric/types/isoGraphTypes.ts` | Extracted Isometric Graph & Domain Types | **426 lines / 12,192 B (~12 KB)** | Upgraded & Tested Core Module |

---

### 2.2 Functional Classification: Pure vs. Dependent Functions

To maintain absolute architectural rigor, functions extracted into `IsoTopologyGraph.ts` are categorized explicitly:

1. **Purely Deterministic / Mathematical Functions (No Side Effects, No External State):**
   - `pdiClamp(v, min, max)`, `pdiDia(dn)`
   - `elbowAngle(type)`
   - `pointOnSegment(a, b, t)`
   - `rotateWorldPoint(point, pivot, angleDeg)`
   - `downstreamNodeIds(startId, segments, excludedSegmentId)`
   - `inferJointType(node, portId)`
   - `isWeldableConnection(type)`
   - `reorderFittings(list, fromIndex, toIndex)`
   - `cloneSegmentBetween(s, fromNodeId, toNodeId, length, type)`

2. **Functions Depending on Generated Identifiers (`pdiUid`):**
   - `pdiUid(prefix)` (uses `Date.now()` and `Math.random()`, yielding unique IDs for newly created nodes, ports, or fittings)
   - `defaultFreeNodePorts()`
   - `makeNode(...)`
   - `makeFitting(...)`
   - `defaultEquipmentPorts(...)`
   - `makeEquipmentNode(...)`

3. **Functions Depending on External Data Catalogs (`TROUVAY_CAUVIN_CATALOG` / `DIAMETER_BY_DN`):**
   - `materialRows(nodes, segments)` (queries `TROUVAY_CAUVIN_CATALOG` and `DIAMETER_BY_DN` to build BOM material rows)
   - `getFittingSvgGraphic(type, isPrint)` (queries `trouvayCauvinCatalog.ts` for SVG vignettes)

---

## 3. PHASE B — FIRST SAFE MODULAR EXTRACTION

### 3.1 What Was Extracted & Consolidated

1. **`src/pdi/isometric/types/isoGraphTypes.ts`**:
   - Core graph and domain types: `IsoNodeType`, `IsoFittingType`, `JointConnectionType`, `IsoPort`, `PipingJoint`, `IsoNode`, `IsoSegment`, `IsoFitting`, `PipingLine`, `GraphIssue`.
   - Normative/physical lookup tables & constants: `FITTING_TYPES`, `FITTING_LABELS`, `JOINT_Connection_TYPES`, `DIAMETER_BY_DN`, `WALL_BY_SCHEDULE`, `ISO_GRAPH_LIMITS`.

2. **`src/pdi/isometric/core/IsoTopologyGraph.ts`**:
   - Topological calculation, port geometry, joint derivation, project graph validation, legacy migration, cumulative distance, and BOM generation engine.

3. **Backward-Compatible Re-exports**:
   - `IsometrieModuleV48d.tsx` re-exports extracted types and constants to guarantee zero breaking changes for external callers (`PdiIsometricEditor.tsx`, `isoSvgGenerator.ts`, etc.).

---

## 4. VALIDATION RESULTS (ARCH-12-FIX-01)

The following verification steps were executed on the current codebase (`a4a736a806647865a239ed563f95683a22d98a1c`):

1. **Vitest Unit Test Suite (`npx vitest run`)**:
   - **Result:** **14/14 test suites passed successfully (100% green)**, including:
     - `src/pdi/isometric/tests/arch12IsoTopologyExtractionTests.spec.ts` (8 tests)
     - `src/pdi/normative/tests/arch11B31_8PipelineReadinessTests.spec.ts`
     - `src/pdi/normative/tests/arch10PipelineEngineeringModelTests.spec.ts`
     - `src/pdi/normative/tests/arch09MultiCodeResolverTests.spec.ts`
     - `src/pdi/normative/tests/arch08MultiDomainArchitectureTests.spec.ts`
     - `src/pdi/normative/tests/arch07IndustrialArchitectureTests.spec.ts`
     - `src/pdi/normative/tests/normativeGlobalIntegrationTests.spec.ts`

2. **TypeScript Linter (`npx tsc --noEmit`)**:
   - **Result:** **PASSED WITH ZERO ERRORS**.

3. **Production Build (`npm run build`)**:
   - **Result:** **BUILD SUCCEEDED SUCCESSFULLY**.

---

## 5. CONCLUSION & STATUS

- Normative rules, qualified formulas, B31.8/B31.12 calculation engines, and UI bindings remain untouched and intact.
- No direct commit or push has been performed.

**ARCH-12: VALIDATED**
