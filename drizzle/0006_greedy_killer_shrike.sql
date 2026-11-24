ALTER TABLE "workers" ALTER COLUMN "employment_type" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "workers" ALTER COLUMN "employment_type" SET DEFAULT 'All Trades';--> statement-breakpoint
UPDATE "workers"
SET "employment_type" = CASE
  WHEN "trade" IN ('Mason', 'Carpenter', 'Electrician', 'Plumber', 'Steel Fixer', 'Welder', 'Painter', 'Rigger', 'Operator', 'General Laborer', 'Tiler', 'Roofer', 'Scaffolder', 'HVAC Technician', 'Surveyor', 'Heavy Equipment Mechanic', 'Foreman', 'Site Supervisor', 'Safety Officer') THEN "trade"
  WHEN "position" IN ('Mason', 'Carpenter', 'Electrician', 'Plumber', 'Steel Fixer', 'Welder', 'Painter', 'Rigger', 'Operator', 'General Laborer', 'Tiler', 'Roofer', 'Scaffolder', 'HVAC Technician', 'Surveyor', 'Heavy Equipment Mechanic', 'Foreman', 'Site Supervisor', 'Safety Officer') THEN "position"
  ELSE 'All Trades'
END
WHERE "employment_type" NOT IN ('All Trades', 'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Steel Fixer', 'Welder', 'Painter', 'Rigger', 'Operator', 'General Laborer', 'Tiler', 'Roofer', 'Scaffolder', 'HVAC Technician', 'Surveyor', 'Heavy Equipment Mechanic', 'Foreman', 'Site Supervisor', 'Safety Officer', 'Other', 'Custom type');