# PD&I SaaS foundation

This directory defines the autonomous SaaS boundary for the future PD&I product.

## Product boundary

PD&I must not depend on the PLAN-PDI-GUIDE application, its navigation, or its application state. The Guide may link to PD&I as an external client, but PD&I owns its own identity, organizations, projects, licensing, storage, and application state.

## Planned domains

- `auth/` — account and session lifecycle
- `organizations/` — companies, members, roles and seats
- `licensing/` — trials, subscriptions, activation keys and feature entitlements
- `projects/` — project ownership and access control
- `storage/` — project files and Piping JSON persistence
- `billing/` — future subscription/billing integration
- `admin/` — support and license administration

## Core rule

The UI must consume product services through explicit interfaces. Licensing and authorization must be enforced server-side; frontend feature flags are only presentation hints.

## Future deployment

The application is intended to be developed in AI Studio and published independently of the Guide. The exact authentication, database, billing and hosting providers remain replaceable behind service interfaces.
