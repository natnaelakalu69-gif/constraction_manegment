ALTER TABLE "workers" ADD COLUMN "trade" varchar(80) DEFAULT 'General Laborer' NOT NULL;--> statement-breakpoint
UPDATE "workers" SET "trade" = "position" WHERE "position" IN ('Mason', 'Carpenter', 'Electrician', 'Plumber', 'Steel Fixer', 'Welder', 'Painter', 'Rigger', 'Operator', 'General Laborer', 'Tiler', 'Roofer', 'Scaffolder', 'HVAC Technician', 'Surveyor', 'Heavy Equipment Mechanic', 'Foreman', 'Site Supervisor', 'Safety Officer');--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "site" varchar(150);--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "work_line" varchar(80);--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "employment_type" varchar(20) DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "daily_wage" integer;