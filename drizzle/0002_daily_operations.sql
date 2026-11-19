CREATE TABLE "daily_follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"report_id" integer,
	"project_id" integer,
	"site_id" integer,
	"issue" text NOT NULL,
	"action" text NOT NULL,
	"assigned_to" varchar(180),
	"due_date" date,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_plan_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"task" text NOT NULL,
	"deadline" date,
	"assignee" varchar(180),
	"required_resources" text,
	"status" varchar(30) DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"project_id" integer,
	"site_id" integer,
	"plan_date" date NOT NULL,
	"supervisor_name" varchar(180) NOT NULL,
	"required_resources" text,
	"notes" text,
	"status" "approval_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_site_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"project_id" integer,
	"site_id" integer,
	"plan_id" integer,
	"report_date" date NOT NULL,
	"supervisor_name" varchar(180) NOT NULL,
	"completed_work" text NOT NULL,
	"progress_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"photos" text,
	"challenges" text,
	"delays" text,
	"status" "approval_state" DEFAULT 'submitted' NOT NULL,
	"review_notes" text,
	"reviewed_by" varchar(180),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "safety_inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"project_id" integer,
	"site_id" integer,
	"inspection_date" date NOT NULL,
	"inspector_name" varchar(180) NOT NULL,
	"hazards" text,
	"incidents_observed" text,
	"corrective_actions" text,
	"status" "approval_state" DEFAULT 'submitted' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "daily_follow_ups" ADD CONSTRAINT "daily_follow_ups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_follow_ups" ADD CONSTRAINT "daily_follow_ups_report_id_daily_site_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."daily_site_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_follow_ups" ADD CONSTRAINT "daily_follow_ups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_follow_ups" ADD CONSTRAINT "daily_follow_ups_site_id_project_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."project_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD CONSTRAINT "daily_plan_tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD CONSTRAINT "daily_plan_tasks_plan_id_daily_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_site_id_project_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."project_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_site_reports" ADD CONSTRAINT "daily_site_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_site_reports" ADD CONSTRAINT "daily_site_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_site_reports" ADD CONSTRAINT "daily_site_reports_site_id_project_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."project_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_site_reports" ADD CONSTRAINT "daily_site_reports_plan_id_daily_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_inspections" ADD CONSTRAINT "safety_inspections_site_id_project_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."project_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_follow_ups_report_idx" ON "daily_follow_ups" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "daily_follow_ups_company_status_idx" ON "daily_follow_ups" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "daily_plan_tasks_plan_idx" ON "daily_plan_tasks" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "daily_plans_company_date_idx" ON "daily_plans" USING btree ("company_id","plan_date");--> statement-breakpoint
CREATE INDEX "daily_plans_project_idx" ON "daily_plans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "daily_site_reports_company_date_idx" ON "daily_site_reports" USING btree ("company_id","report_date");--> statement-breakpoint
CREATE INDEX "daily_site_reports_plan_idx" ON "daily_site_reports" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "safety_inspections_company_date_idx" ON "safety_inspections" USING btree ("company_id","inspection_date");--> statement-breakpoint
CREATE INDEX "safety_inspections_site_idx" ON "safety_inspections" USING btree ("site_id");