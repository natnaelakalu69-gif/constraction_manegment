# Database schema

`enterprise.ts` defines the first company-scoped domain schema. `../schema.ts` is the legacy attendance schema retained during migration. Drizzle loads both; the generated migration establishes both sets of tables from a clean database. Do not delete legacy tables until application routes are migrated and existing data has been backfilled and verified.

Schema conventions: company ownership on business records; `created_at`/`updated_at`/nullable `deleted_at` on mutable records; append-only inventory and audit ledgers; explicit money/quantity precision; scoped unique keys and query indexes. Application services must still enforce matching company IDs across related rows: ordinary foreign keys do not alone guarantee tenant consistency. The data migration and stronger composite tenant constraints are scheduled alongside domain service implementation.

Generated migrations are under repository-root `drizzle/`. Generate with `npm run db:generate`, review the SQL, then apply only against a backed-up target with `npm run db:migrate`. Never apply the generated baseline blindly to an existing database: this initial migration creates legacy and enterprise tables and is intended for a clean database. Production migration adoption needs a reviewed baseline/data migration plan.
