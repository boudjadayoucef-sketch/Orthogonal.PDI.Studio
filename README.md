# Orthogonal PD&I Studio

> **Plant Design & Industrial (PD&I) Engineering Platform**  
> A modular, multi-domain industrial engineering application for piping systems, pipelines, packaged process skids, and industrial equipment.

---

## 1. Overview

**Orthogonal PD&I Studio** is a browser-based, high-performance industrial engineering and piping isometric drafting platform. It integrates deterministic engineering rules, multi-domain model representations, automated Bill of Materials (BOM/MTO), normative compliance engines, and interactive 2D/3D visualization into a single unified engineering workspace.

The platform is designed around strict industrial separation of concerns:
- **Client-Neutral Core**: Fully decoupled from any single operating organization, client entity, or proprietary schema.
- **Multi-Domain Foundation**: Native representation of **Piping**, **Pipeline**, **Package / Skid**, and **Equipment** disciplines under a shared common model.
- **Deterministic Normative Architecture**: Traceable evidence records and deterministic calculation bridges. Active normative verification for process piping (ASME B31.3, ASME B16.5, ASME B16.9) with extensible reference architectures for cross-country pipeline and equipment codes.

---

## 2. Multi-Domain Architecture (ARCH-08)

Orthogonal PD&I Studio implements a tiered, multi-domain architecture ensuring that engineering domains share common geometry and quantification engines while maintaining their distinct technical constraints.

```text
                     PD&I ENGINEERING PLATFORM
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
          PIPELINE             PIPING           PACKAGE/SKID
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                             EQUIPMENT
                                 │
                                 ▼
                     COMMON ENGINEERING MODEL
                        (PdiUniversalEntity)
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
          GEOMETRY           NORMATIVE          QUANTIFICATION
             │                   │                   │
          2D / 3D          CODES / RULES           BOM/MTO
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                            DELIVERABLES
               (Isometrics, Spool Sheets, BoQ, DXF/PDF)
```

### Engineering Domains & Implementation Maturity

| Domain | Scope | Applicable Standards & Reference Codes | Implementation Status & Capabilities |
| :--- | :--- | :--- | :--- |
| **PIPING** | In-plant process and utility piping within battery limits | **ASME B31.3**, ASME B16.5, ASME B16.9 | **Active Core Implementation**: Interactive 3D/orthogonal routing, dimensional catalogs, flange pressure-temperature matrices, fabrication spooling, weld ledger, and physical MTO/BOM extraction. *(Stress verification interfaces planned).* |
| **PIPELINE** | Cross-country and regional hydrocarbon & fluid transmission | ASME B31.8, ASME B31.12 (Hydrogen), API 5L *(Reference Codes)* | **Roadmap / Reference Architecture**: Registered domain boundary with typed projection schemas. Route alignment, pipeline wall thickness calculations, and sectionalizing valve rules are architectural foundations under development. |
| **PACKAGE / SKID** | Packaged process skids, multi-line skids & modular units | Multi-discipline skid codes & battery limits interfaces *(Reference Codes)* | **Roadmap / Architectural Foundation**: Registered domain boundary with tie-in definitions. Volume envelope bounding boxes and transport weight quantification are planned capabilities. |
| **EQUIPMENT** | Mechanical equipment, pressure vessels, storage tanks | ASME Section VIII, API 650, TEMA *(Reference Codes)* | **Roadmap / Architectural Foundation**: Registered domain boundary with equipment nozzle interfaces. Nozzle orientation checks and vessel anchor interfaces are planned capabilities. |

---

## 3. Architectural Principles

### 3.1 Common Engineering Model (`PdiUniversalEntity`)
All engineering disciplines project their components (pipes, fittings, flanges, valves, instruments, equipment nozzles) onto a single canonical entity model. Domain-specific attributes are attached as typed projections without creating duplicate, divergent models.

### 3.2 Client Neutrality & Industrial Isolation (ARCH-07)
The platform engine is strictly client-neutral:
- **Layer 1: Common Engineering Model** (`PdiUniversalEntity`) — Zero external or organizational dependencies.
- **Layer 2: Normative Authority & Codes** — Verified engineering data, dimensions, and rating matrices.
- **Layer 3: Physical Quantification (MTO/BOM)** — Calculates physical quantities without commercial assumptions.
- **Layer 4: Commercial Layer (Price Book & BoQ)** — Dynamic, client-configurable costing isolated from the engineering core.
- **Layer 5: Organization & Client Profile** — Neutral default profile, dynamic branding, zero hardcoded legacy client identifiers.

### 3.3 Normative Evidence & Determinism
Every normative decision (wall thickness calculation, pressure-temperature rating validation, component dimensional compatibility) is tracked through immutable evidence records and reproducible calculation bridges.

---

## 4. Key Platform Features

- **Interactive 2D / 3D Canvas**: Real-time isometric drafting, 3D spatial navigation, orthogonal axis snapping, and dimension editing.
- **Technical Workflow Integration**: Coordinated flow from P&ID schematic parameters to 3D piping routing and automated isometric deliverable generation.
- **Automated Spool & Weld Management**: Generation of fabrication spools, weld IDs, NDT requirements, and workshop cut-lists.
- **BOM & BoQ Engine**: Real-time extraction of physical material take-offs (MTO) and priced Bills of Quantities (BoQ) with multi-currency support.
- **Deliverables Generation**: One-click generation of PDF isometric production drawings, DXF CAD files, and structured JSON project exports.

---

## 5. Getting Started

### Prerequisites
- **Node.js**: `20.x` or higher
- **npm**: `10.x` or higher

### Installation

```bash
# Clone repository
git clone https://github.com/boudjadayoucef-sketch/Orthogonal-PDI-studio-.git
cd Orthogonal-PDI-studio-

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

Launches the application development server at `http://localhost:3000`.

### Production Build

```bash
npm run build
```

Compiles the frontend assets via Vite and creates the Node.js production server bundle in `dist/`.

To launch the built server:
```bash
npm start
```

---

## 6. Testing & Architectural Validation

The platform includes automated architectural and normative test suites using **Vitest**:

```bash
# Run all architectural and normative tests once
npm test

# Run tests in watch mode during development
npm run test:watch

# Validate TypeScript type-checking across the codebase
npm run lint
```

### Verified Test Suites
- **ARCH-08 Multi-Domain Architecture Suite**: Domain registry, boundary validations, capability orthogonality, non-duplication enforcement.
- **ARCH-07 Industrial Architecture Suite**: Client neutrality, commercial boundary isolation, layer integrity, audit ledger.
- **NORM-01..14 Global Normative Integration Suite**: End-to-end normative compatibility, component resolution, traceability, and evidence registry.
- **ARCH-01..06 Suites**: Universal model, isometric normative bridge, technical workflow, and component selection compatibility.

---

## 7. Normative Framework & Compliance Disclosure

Orthogonal PD&I Studio incorporates a formal normative architecture and cryptographic/ledger-based evidence tracking across engineering decisions. Modules and standards exist at distinct maturity levels:

- **Active Verification Engines**: Process piping dimensional lookups, flange pressure-temperature ratings, and component compatibility against verified tables (ASME B31.3, ASME B16.5, ASME B16.9).
- **Architectural Reference Standards**: Domain standards registered in the platform ontology (ASME B31.8, ASME B31.12, ASME Section VIII, API 650, TEMA) define boundary interfaces, type contracts, and roadmap specifications. Their presence in the registry reflects architectural support rather than certified autonomous engineering calculation engines.
- **Engineering Responsibility**: The software provides computational assistance and drafting automation. All engineering outputs must be reviewed and stamped by qualified professional engineers before fabrication or field installation.
