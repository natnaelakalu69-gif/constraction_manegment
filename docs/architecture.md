# Architecture and implementation plan

## System boundaries

The application is a modular monolith: one Next.js deployment serves the responsive React UI and versioned REST endpoints. Domain modules are isolated by feature and communicate through application services, not by importing another feature's persistence internals. PostgreSQL is the system of record; Drizzle owns schema and migrations. This keeps deployment operationally simple while preserving a path to extract high-load domains later.

```text
Browser
  └── Next.js UI (src/app, features, components)
        └── /api/v1 REST routes (controllers → middleware → validators)
              └── application services → repositories → Drizzle
                    └── PostgreSQL
```

External integrations (object storage, email, AI provider) must be behind adapters and configured by environment. File bytes should not be stored in PostgreSQL. AI requests use the authenticated principal and scoped application services; generated SQL is not executed. Mutations are separate operations and require permission checks and explicit confirmation for sensitive actions.

## Layer ownership

- `src/app`: Next.js routes, layouts, pages, and API route adapters only.
- `src/components`: shared presentational UI and navigation.
- `src/features/<domain>`: domain UI, hooks, API client functions, and view models.
- `src/server/api`: versioned REST route registration/adapters and response conventions.
- `src/server/controllers`: HTTP input/output translation; no business rules.
- `src/server/services`: business rules, permission decisions, and transaction orchestration.
- `src/server/repositories`: database access; all tenant-scoped queries take company context.
- `src/server/middleware`: authentication, authorization, request IDs, rate limits, and error boundary.
- `src/server/validators`: request schemas and normalization.
- `src/db/schema`: normalized domain schemas; `src/db` retains connection/configuration.
- `drizzle/`: generated immutable migration artifacts; never hand-edit generated migrations.
- `tests`: unit, API/integration, and security/workflow tests.

## Domain modules

Company & access (companies, branches, departments, positions, users, roles, permissions); projects & sites (projects, sites, sections, members); workforce (employees, day labor, assignments, shifts); attendance & leave; work planning & progress; materials, procurement & inventory ledger; equipment; contractors & contracts; budget, costs & payments; safety; quality; documents; tasks/workflows; reporting; notifications; audit; AI command center.

Each domain owns its validators, service, repository, controller/API adapter, tests, and UI feature. Cross-domain workflows call services through explicit interfaces and use database transactions for atomic state transitions. Audit records are written in the same transaction for sensitive mutations.

## Data and security invariants

- Every business record belongs to a company, directly or through a company-owned parent. Company scope is derived from the verified session, never trusted from request JSON.
- Roles are configurable through role-permission records; authorization is permission-based and checked at the service boundary as well as the API boundary.
- Passwords use a modern adaptive hash; sessions are opaque, expiring, revocable, and stored server-side. Secrets are environment-only.
- Validate at the boundary, parameterize database operations via Drizzle, return a stable error envelope, and do not expose database/provider details.
- Use soft deletion for long-lived business records where retention/audit rules require it; immutable ledger and audit history is never hard-deleted by normal application operations.
- Store money as fixed-precision decimal values with explicit currency. Quantities use decimal precision and units. Dates/times are interpreted in the company's configured timezone.
- Inventory and financial balances are derived from append-only transactions or controlled posting workflows, not mutable client-provided totals.

## API conventions

All endpoints are under `/api/v1`. JSON responses use `{ "data": ..., "meta": ... }` on success and `{ "error": { "code": "...", "message": "...", "requestId": "...", "details": [...] } }` on failure. Collections use `page`, `pageSize`, `sort`, filters, and `q`; server limits page size. Use 401 for unauthenticated, 403 for forbidden, 404 for absent/inaccessible scoped records, 409 for state conflicts, 422 for validation, and 500 with a request ID for unexpected failures. Mutating endpoints support idempotency where retries could create duplicate financial/inventory events.

## Repository map

```text
src/
  app/                 Next.js pages and REST route adapters
  components/          Shared UI
  features/            Feature-oriented frontend modules
  hooks/               Shared React hooks
  lib/                 Shared browser-safe utilities
  server/
    api/v1/             Versioned endpoint adapters
    controllers/        HTTP boundary
    middleware/         Auth, permissions, errors, request context
    repositories/       Persistence adapters
    services/           Business workflows
    validators/         Input validation
    utils/              Server-only helpers
    types/              Server contracts
  db/
    schema/             Domain schema modules
    migrations/         Migration configuration/metadata
    seed/               Deterministic development seed
  types/                Shared API/UI types
tests/
  unit/                 Isolated business rule tests
  integration/          PostgreSQL-backed repository/workflow tests
  api/                  REST and authorization tests
```

## Delivery phases

Phase 1 establishes this structure and architecture. Later phases implement the schema/migrations, authentication and configurable RBAC, organization/project/workforce domains, attendance, production, inventory, equipment, procurement/contracts, finance, safety/quality, reporting/dashboard, AI, then security hardening and deployment. A module is not considered complete until persistence, validation, authorization, UI/API integration, and relevant tests exist. Features not implemented in the current phase must not be represented as production-ready.

## Explicit decisions

- Start with a modular monolith rather than microservices; split only with measured operational need.
- Use Next.js route handlers as the REST transport boundary, keeping business logic independent of them.
- Keep generated schema migrations in `drizzle/`; `src/db/migrations` contains migration runner/support only.
- Tenant isolation is mandatory from the first schema migration. Row-level PostgreSQL security may be added as defense in depth, but cannot replace application authorization.
- The existing attendance-focused schema/UI is retained temporarily for continuity and will be migrated incrementally in Phase 2 onward. Existing SHA-256 password/session code is known to be insufficient for production and must not be deployed; Phase 3 replaces it before auth is considered complete.
