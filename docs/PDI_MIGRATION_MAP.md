# PD&I migration map

## Goal

Extract the isometric product from the GUIDE application into an autonomous PD&I application while keeping the GUIDE repository unchanged.

## Current state

The `pdi-foundation` branch is a migration workspace based on the GUIDE codebase. `src/App.tsx` is still the portal shell and must not be treated as the final PD&I application.

## Target boundary

### Move to PD&I
- isometric editor UI and rendering
- piping/isometric domain types
- geometry and connectivity logic
- components/fittings/symbols used by the isometric editor
- dimensions, annotations, welds and viewport state
- project/isometric serialization
- DXF import/export adapters
- AI assistant integration
- photo/sketch recognition workflows

### Keep in GUIDE
- fascicule/documentation navigation
- calculators unrelated to piping/isometrics
- general guide content
- GUIDE-specific dashboards and portal modules

### Rebuild in PD&I
- authentication/profile shell
- organizations and project permissions
- PD&I dashboard
- project browser
- settings
- standalone `App.tsx`

## Canonical data flow

`Photo / Sketch / DXF -> Observation/Raw CAD -> Canonical Piping JSON -> Isometric Model -> SVG/Canvas/DXF/PDF`

The AI agent should reason over skills and invoke deterministic geometry/CAD tools. It must not invent engineering geometry in prose.

## Migration rule

Do not copy historical patch scripts into the new product. Use them only as migration/reference material and extract the final behavior into maintained modules.
