# PD&I — Foundation / Migration Plan

This branch is the foundation for extracting the Isometrics (PD&I) product from the Guide application.

## Product boundary

PD&I is an autonomous application. The Guide remains the portal and documentation/calculation platform.

## Architecture

```text
Guide
  └── PD&I link ──► autonomous PD&I app
                         │
                         ├── Auth / Profile
                         ├── Projects
                         ├── Piping model
                         ├── Isometric editor
                         ├── JSON persistence
                         ├── DXF import/export
                         ├── AI assistant
                         └── Photo reconstruction
                                      │
                                      ▼
                              piping-design-skill
```

## Extraction rules

- Do not copy the Guide shell, documentation, calculators, or unrelated modules into the PD&I product architecture.
- Preserve the current isometric behavior while extracting it from the monolithic application.
- Treat the existing isometric project format as a migration source, not as the final public API.
- Keep geometry and engineering validation deterministic; AI selects operations and interprets uncertain inputs.
- The canonical future model is the Piping JSON model defined by `piping-design-skill`.

## Initial modules

```text
src/pdi/
  model/          canonical application model adapters
  geometry/       deterministic geometry helpers
  isometric/      editor and rendering extraction
  cad/            DXF adapters
  ai/             agent/tool integration
  projects/       project persistence
  auth/           profile and access boundaries
```

## Migration stages

1. Inventory current IsometrieModule dependencies.
2. Extract pure types/model and persistence adapters.
3. Extract geometry and validation.
4. Extract editor/rendering.
5. Add project/auth shell.
6. Add DXF JSON adapters.
7. Connect `piping-design-skill` MCP tools.
8. Add photo-to-piping reconstruction.
9. Replace the Guide PD&I button with an external application link after the autonomous app is deployable.

## Safety rule

The `main` branch of this repository remains untouched by this extraction work. The Guide repository is also not modified by this branch.
