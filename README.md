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
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. Migrations `0003`–`0005` add the task, payroll, expense and settings tables/columns plus the expanded workforce registration fields. `npm run db:seed` creates the default sign-in account if it does not already exist. Deployed environments also create it automatically on the first sign-in with the default credentials, so Vercel does not need a separate seed step. The currently implemented routes are documented below.

## Sign in

All pages and API routes require a session. The seeded default credentials are:

| Username | Password |
| --- | --- |
| `admin` | `12345678` |

Use **Log out** in the top bar to end the session. The username is stored in the legacy `users.email` column; set `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_NAME` in the deployment environment (or before running `npm run db:seed`) to change the defaults.

## Workforce registration

The **Workforce** page registers workers with these fields: Worker ID (4+ digits), Full name, Department, Site, Work line / team, Employment type, Phone, Daily wage (ETB) and Status. The **Employment type** field is a typeable dropdown: choose one of the suggested values or type your own. The suggestions are:

All Trades, Mason, Carpenter, Electrician, Plumber, Steel Fixer, Welder, Painter, Rigger, Operator, General Laborer, Tiler, Roofer, Scaffolder, HVAC Technician, Surveyor, Heavy Equipment Mechanic, Foreman, Site Supervisor, Safety Officer and Other.

The workers table has a matching employment type filter, with **All Trades** showing every worker. Saved custom types are added to both the suggestions and the filter. The selected or typed value is also mirrored into the worker's legacy trade/position fields for attendance and reports.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Legacy session configuration; replace with a strong random secret. Current auth implementation is not production-grade. |

Never commit `.env` or secrets. Production configuration will be completed alongside authentication and deployment phases.

## Current API surface

- `POST /api/auth/login` — accepts `username` (or `email`) and `password`
- `GET /api/auth/me` — current signed-in user
- `POST /api/auth/logout` — ends the session
- `GET/POST /api/workers`, `GET/PUT/DELETE /api/workers/:id`
- `GET/POST /api/sites`, `GET/PUT/DELETE /api/sites/:id`
- `GET/POST /api/attendance?date=YYYY-MM-DD`, `DELETE /api/attendance?id=…`
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET /api/reports/daily-operations?date=YYYY-MM-DD` — combined attendance, plans, progress, materials, safety and outstanding issues
- `GET /api/reports/period?period=daily|weekly|monthly|yearly&date=YYYY-MM-DD` — aggregated operations report for the range containing the anchor date (weekly = Mon–Sun, monthly = calendar month, yearly = calendar year; end date is exclusive; yearly trend buckets by month)
- `GET /api/reports/executive?date=YYYY-MM-DD` — portfolio KPIs (projects, sites, workforce) plus all four period reports in one response
- `GET/POST /api/modules/:resource` for `projects`, `work-packages`, `progress-records`, `budgets`, `project-costs`, `materials`, `inventory-transactions`, `equipment`, `equipment-usage`, `safety-incidents`, `quality-inspections`, `quality-defects`, `daily-plans`, `daily-plan-tasks`, `daily-site-reports`, `daily-follow-ups`, `safety-inspections`, `workforce`, `teams`, `team-members`, `work-tasks`, `day-labor-wages`, `wage-payments`, `sites`, `departments`, `shifts`, `attendance-rules`, `wage-settings`, `suppliers`, `purchase-requests`, `purchase-orders`, `material-receipts`, `contract-documents`, `project-documents`, `drawings`, `permits`, `safety-documents`, and `delivery-documents`
- `GET/PATCH /api/settings/company` — company identity, registration details, reporting currency and timezone for the current workspace
- `GET /api/notifications?date=YYYY-MM-DD` — live alerts for late workers, absences, open safety incidents, materials below minimum stock, and due/overdue tasks (`date` defaults to today)
- `PATCH /api/modules/:resource/:id` updates any editable field on every module resource listed above (per-resource field whitelist); `daily-site-reports` also sets `reviewedAt` when status becomes `approved` or `rejected`; wage edits recalculate net pay, and payment edits/deletes resynchronise the wage's paid amount and status
- `DELETE /api/modules/:resource/:id` deletes a record company-scoped; referenced records return HTTP 409
- `GET /api/reports/expenses?projectId=…` — budget vs actual by cost code, expense-type totals and overall utilization (`projectId` is optional)
- `GET/POST /api/roles` — role snapshot and role creation; `PATCH/DELETE /api/roles/:id` for custom roles (default roles allow description edits only, and cannot be deleted)
- `POST/PATCH/DELETE /api/roles/permissions[/:id]` and `POST/PATCH/DELETE /api/roles/users[/:id]` for permissions and users; `POST/DELETE /api/roles/grants` for grants. Default permissions cannot be deleted.

These legacy endpoints are not yet the planned `/api/v1` API and do not satisfy the full security, validation, pagination, or RBAC requirements. They will be migrated in subsequent phases.

The management screens provide per-record **Edit** and **Delete** actions: the generic module screens load the selected row into the form and save with `PATCH`, while Workers, Sites, Roles & access, Attendance, and Daily reports use inline edit forms and save with `PUT`/`PATCH`. Every delete asks for confirmation first.

Record lists are paginated at **10 rows per page** with **Previous** / **Next** buttons and a page-number box. Pagination is shared by generic module tables, workers, sites, attendance, follow-ups, notifications, task board, role assignments, payroll summaries, expense details and material stock summaries. The daily workflow pages are:

- `/daily-plans` — the project manager creates a plan and assigns tasks, deadlines, supervisors/assignees and required resources.
- `/tasks` — create teams, assign workers to teams, assign tasks to a worker or team, set supervisor/deadline/priority, and move tasks through Pending → In Progress → Completed on the task board.
- `/payroll` — maintain worker daily rates, calculate daily labor wages (days × rate + overtime − deductions), record payments and review paid/unpaid balances and payment history.
- `/expenses` — record material, labor, equipment and other project expenses against budgets, and review budget vs actual cost by cost code and expense type.
- `/attendance` — the supervisor records present, absent and late workers.
- `/daily-reports` — the supervisor submits completed work, progress %, photos and challenges; the manager approves reports, records delays and assigns follow-up actions.
- `/materials` — the materials manager records receipts/issues and sees received, issued and remaining stock.
- `/safety` — the safety officer records hazards, incidents observed and corrective actions.
- `/daily-summary` — operations reports with a period selector: **Daily** shows the detailed daily report (attendance, plans, progress, materials, safety and outstanding issues), while **Weekly**, **Monthly** and **Yearly** show aggregated metrics and trends for the selected range.
- `/executive-summary` — executive summary with portfolio KPIs, a four-period comparison table, CSS bar charts and current outstanding items.
- `/roles` — create roles and permissions, grant permissions to roles, create app users, and assign roles to users. Standard roles (Admin, Project Manager, Site Supervisor, Materials Manager, Safety Officer) and their permission grants are seeded on first use.
- `/settings` — edit company settings and maintain projects/sites, departments, work shifts, attendance rules and wage settings. The newest active wage configuration supplies the regular hours and overtime multiplier used when payroll records are created or edited.
- `/notifications` — inbox of live alerts for late workers, absences, safety incidents, material shortages and task deadlines, with a header badge showing unread count. Alerts are derived from current records, so they clear when the underlying issue is resolved. Read state is stored in the browser until per-user accounts are wired in.
- `/procurement` — manage suppliers, raise purchase requests, issue purchase orders and record received materials. Receipts are inventory transactions, so they immediately update the material stock summary and low-stock notifications.
- `/documents` — maintain one document register split into Contracts, Project documents, Drawings, Permits, Safety documents and Delivery documents. Each section has its own category-scoped endpoint, so records cannot move between categories through the API. The form stores document metadata (title, project, storage key/link, MIME type, size and version); binary file upload is not implemented yet.

Both report pages include **Download CSV** and **Print / Save PDF** controls. CSV files are UTF-8 with a BOM for spreadsheet compatibility; printing uses a report-only layout that hides the app navigation and buttons.

All enterprise records are scoped to the first company in the database; a default company is created automatically on first use because company switching is not implemented yet.

## Planned development commands

Available scripts are listed in `package.json`. Type checking and linting: `npm run typecheck`, `npm run lint`; application build: `npm run build`. Database commands: `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`. Test, Docker, backup, and full production deployment workflows are scheduled for later phases and are not claimed complete.

## Roles and AI

The `/roles` page provides a company-scoped role catalog: roles, permissions, permission grants and user-role assignments can be managed there. These definitions are **not yet enforced** by the existing endpoints or UI, and the login flow still uses the legacy `users` table. AI is planned to call authorized application services only; it will not execute model-generated SQL. Sensitive writes require permission and confirmation. Permission enforcement, a full production auth flow, and AI command execution remain planned work.

## Security and operations

The current password helper uses SHA-256 and the session implementation is not a secure production session system. **Do not expose this version to production or use real personal/financial data.** Phase 3 replaces authentication before auth can be considered complete. Full CSRF/rate limiting/audit and deployment hardening remain scheduled work.

Database backup/recovery, migration rollback strategy, object storage, and Docker deployment instructions will be documented when those workflows are implemented. Keep encrypted, tested backups outside the application host and verify restore procedures before production use.
