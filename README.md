# Construction Site Attendance Management System

A final-year project using Next.js, Node.js API routes, TypeScript, PostgreSQL and Drizzle ORM.

## Requirements
- Node.js 20+
- PostgreSQL 14+

## Setup

1. Create a PostgreSQL database named `construction_attendance`.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`.
4. Run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000

## API

GET/POST `/api/workers`
GET/PUT/DELETE `/api/workers/:id`

GET/POST `/api/sites`
GET/PUT/DELETE `/api/sites/:id`

GET/POST `/api/attendance?date=YYYY-MM-DD`

GET `/api/reports/daily?date=YYYY-MM-DD`

POST `/api/auth/login`

## Notes

This is a working foundation. For production, replace the simple SHA-256 password handling with Argon2/bcrypt and add full authorization middleware, CSRF protection, audit logs, validation, pagination and secure user provisioning.
