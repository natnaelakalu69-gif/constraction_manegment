CREATE TABLE "attendance_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"shift_id" integer,
	"late_after_minutes" integer DEFAULT 15 NOT NULL,
	"early_leave_after_minutes" integer DEFAULT 15 NOT NULL,
	"overtime_starts_after_minutes" integer DEFAULT 480 NOT NULL,
	"standard_hours_per_day" numeric(5, 2) DEFAULT '8' NOT NULL,
	"mark_absent_after_minutes" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wage_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"currency" varchar(3) DEFAULT 'ETB' NOT NULL,
	"regular_hours_per_day" numeric(5, 2) DEFAULT '8' NOT NULL,
	"overtime_multiplier" numeric(5, 2) DEFAULT '1.5' NOT NULL,
	"payment_frequency" varchar(30) DEFAULT 'weekly' NOT NULL,
	"default_daily_rate" numeric(16, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attendance_rules" ADD CONSTRAINT "attendance_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_rules" ADD CONSTRAINT "attendance_rules_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_settings" ADD CONSTRAINT "wage_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_rules_company_name_unique" ON "attendance_rules" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "attendance_rules_company_active_idx" ON "attendance_rules" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "wage_settings_company_name_unique" ON "wage_settings" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "wage_settings_company_active_idx" ON "wage_settings" USING btree ("company_id","is_active");