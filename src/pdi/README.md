# PD&I Core Boundary

This directory is the extraction boundary for the autonomous Piping Design & Isometrics application.

The current Guide is the migration source. New code should depend on `src/pdi` rather than on the Guide-level `App.tsx`.

## Target boundaries

- `model/` — canonical piping/isometric model adapters
- `geometry/` — deterministic geometry operations
- `isometric/` — editor/rendering implementation
- `cad/` — DXF import/export adapters
- `ai/` — integration with `piping-design-skill`
- `projects/` — project persistence
- `auth/` — profile/access boundaries

The first implementation pass will extract existing isometric types and behavior before changing UI behavior.
