CREATE TYPE "public"."assignee_type" AS ENUM('worker', 'team');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('material', 'labor', 'equipment', 'other');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."wage_payment_status" AS ENUM('unpaid', 'partial', 'paid');--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"worker_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wage_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"wage_id" integer NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"method" varchar(40) DEFAULT 'cash' NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"project_id" integer,
	"site_id" integer,
	"title" varchar(200) NOT NULL,
	"description" text,
	"assignee_type" "assignee_type" DEFAULT 'worker' NOT NULL,
	"worker_id" integer,
	"team_id" integer,
	"supervisor_name" varchar(180) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"supervisor_name" varchar(180),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "day_labor_wages" ADD COLUMN "overtime_hours" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_labor_wages" ADD COLUMN "overtime_rate" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_labor_wages" ADD COLUMN "payment_status" "wage_payment_status" DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_labor_wages" ADD COLUMN "paid_amount" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_labor_wages" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "day_labor_wages" ADD COLUMN "payment_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "project_costs" ADD COLUMN "expense_category" "expense_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_work_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."work_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_worker_id_workforce_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workforce"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_payments" ADD CONSTRAINT "wage_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_payments" ADD CONSTRAINT "wage_payments_wage_id_day_labor_wages_id_fk" FOREIGN KEY ("wage_id") REFERENCES "public"."day_labor_wages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_payments" ADD CONSTRAINT "wage_payments_recorded_by_app_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_site_id_project_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."project_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_worker_id_workforce_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workforce"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_team_id_work_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."work_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_teams" ADD CONSTRAINT "work_teams_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_worker_unique" ON "team_members" USING btree ("team_id","worker_id");--> statement-breakpoint
CREATE INDEX "team_members_company_idx" ON "team_members" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wage_payments_wage_idx" ON "wage_payments" USING btree ("wage_id");--> statement-breakpoint
CREATE INDEX "wage_payments_company_date_idx" ON "wage_payments" USING btree ("company_id","payment_date");--> statement-breakpoint
CREATE INDEX "work_tasks_company_status_idx" ON "work_tasks" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "work_tasks_deadline_idx" ON "work_tasks" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "work_tasks_worker_idx" ON "work_tasks" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "work_tasks_team_idx" ON "work_tasks" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_teams_company_code_unique" ON "work_teams" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "day_labor_wages_company_status_idx" ON "day_labor_wages" USING btree ("company_id","payment_status");--> statement-breakpoint
CREATE INDEX "day_labor_wages_worker_idx" ON "day_labor_wages" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "project_costs_expense_category_idx" ON "project_costs" USING btree ("company_id","expense_category");