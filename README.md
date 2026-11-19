# Construction Management & Workforce Management System

A modular, multi-company construction operations platform built with Next.js, React, TypeScript, PostgreSQL, and Drizzle ORM. The target scope includes project/site operations, workforce and attendance, production, inventory, equipment, procurement, commercial controls, safety, quality, documents, reporting, and permission-aware AI assistance.

> **Delivery status:** Phases 1–2 are underway/completed for architecture and the initial company-scoped Drizzle schema/migration. Application behavior remains the original attendance-focused foundation; the schema is not yet wired to complete enterprise workflows. This is not a complete enterprise system and must not be treated as production-ready. See [docs/architecture.md](docs/architecture.md) for boundaries, security invariants, API conventions, and phased delivery.

## Architecture

The planned deployment is a modular monolith. Next.js hosts the UI and `/api/v1` REST boundary; controllers delegate to domain services, which use repositories backed by Drizzle/PostgreSQL. Business rules and authorization live in services, not UI components or route handlers. Domain modules own their validation and tests. See [docs/architecture.md](docs/architecture.md).

## Requirements

- Node.js 20 or later
- PostgreSQL 14 or later
- npm

## Current setup

```bash
cp .env.example .env
# Set DATABASE_URL to a PostgreSQL database you control
npm install
npm run dev
```

Open http://localhost:3000. The currently implemented basic routes are documented below. Database migration commands are available via `npm run db:generate` and `npm run db:migrate`; the existing schema is a legacy attendance foundation, not yet the normalized target model.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Legacy session configuration; replace with a strong random secret. Current auth implementation is not production-grade. |

Never commit `.env` or secrets. Production configuration will be completed alongside authentication and deployment phases.

## Current API surface

- `POST /api/auth/login`
- `GET/POST /api/workers`, `GET/PUT/DELETE /api/workers/:id`
- `GET/POST /api/sites`, `GET/PUT/DELETE /api/sites/:id`
- `GET/POST /api/attendance?date=YYYY-MM-DD`, `DELETE /api/attendance?id=…`
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET /api/reports/daily-operations?date=YYYY-MM-DD` — combined attendance, plans, progress, materials, safety and outstanding issues
- `GET /api/reports/period?period=daily|weekly|monthly|yearly&date=YYYY-MM-DD` — aggregated operations report for the range containing the anchor date (weekly = Mon–Sun, monthly = calendar month, yearly = calendar year; end date is exclusive; yearly trend buckets by month)
- `GET/POST /api/modules/:resource` for `projects`, `work-packages`, `progress-records`, `budgets`, `project-costs`, `materials`, `inventory-transactions`, `equipment`, `equipment-usage`, `safety-incidents`, `quality-inspections`, `quality-defects`, `daily-plans`, `daily-plan-tasks`, `daily-site-reports`, `daily-follow-ups`, and `safety-inspections`
- `PATCH /api/modules/:resource/:id` updates any editable field on every module resource listed above (per-resource field whitelist); `daily-site-reports` also sets `reviewedAt` when status becomes `approved` or `rejected`
- `DELETE /api/modules/:resource/:id` deletes a record company-scoped; referenced records return HTTP 409
- `GET/POST /api/roles` — role snapshot and role creation; `PATCH/DELETE /api/roles/:id` for custom roles (default roles allow description edits only, and cannot be deleted)
- `POST/PATCH/DELETE /api/roles/permissions[/:id]` and `POST/PATCH/DELETE /api/roles/users[/:id]` for permissions and users; `POST/DELETE /api/roles/grants` for grants. Default permissions cannot be deleted.

These legacy endpoints are not yet the planned `/api/v1` API and do not satisfy the full security, validation, pagination, or RBAC requirements. They will be migrated in subsequent phases.

The management screens provide per-record **Edit** and **Delete** actions: the generic module screens load the selected row into the form and save with `PATCH`, while Workers, Sites, Roles & access, Attendance, and Daily reports use inline edit forms and save with `PUT`/`PATCH`. Every delete asks for confirmation first. The daily workflow pages are:

- `/daily-plans` — the project manager creates a plan and assigns tasks, deadlines, supervisors/assignees and required resources.
- `/attendance` — the supervisor records present, absent and late workers.
- `/daily-reports` — the supervisor submits completed work, progress %, photos and challenges; the manager approves reports, records delays and assigns follow-up actions.
- `/materials` — the materials manager records receipts/issues and sees received, issued and remaining stock.
- `/safety` — the safety officer records hazards, incidents observed and corrective actions.
- `/daily-summary` — operations reports with a period selector: **Daily** shows the detailed daily report (attendance, plans, progress, materials, safety and outstanding issues), while **Weekly**, **Monthly** and **Yearly** show aggregated metrics and trends for the selected range.
- `/roles` — create roles and permissions, grant permissions to roles, create app users, and assign roles to users. Standard roles (Admin, Project Manager, Site Supervisor, Materials Manager, Safety Officer) and their permission grants are seeded on first use.

All enterprise records are scoped to the first company in the database; a default company is created automatically on first use because company switching is not implemented yet.

## Planned development commands

Available scripts are listed in `package.json`. Type checking and linting: `npm run typecheck`, `npm run lint`; application build: `npm run build`. Database commands: `npm run db:generate`, `npm run db:migrate`. Test, seed, Docker, backup, and full production deployment workflows are scheduled for later phases and are not claimed complete.

## Roles and AI

The `/roles` page provides a company-scoped role catalog: roles, permissions, permission grants and user-role assignments can be managed there. These definitions are **not yet enforced** by the existing endpoints or UI, and the login flow still uses the legacy `users` table. AI is planned to call authorized application services only; it will not execute model-generated SQL. Sensitive writes require permission and confirmation. Permission enforcement, a full production auth flow, and AI command execution remain planned work.

## Security and operations

The current password helper uses SHA-256 and the session implementation is not a secure production session system. **Do not expose this version to production or use real personal/financial data.** Phase 3 replaces authentication before auth can be considered complete. Full CSRF/rate limiting/audit and deployment hardening remain scheduled work.

Database backup/recovery, migration rollback strategy, object storage, and Docker deployment instructions will be documented when those workflows are implemented. Keep encrypted, tested backups outside the application host and verify restore procedures before production use.
