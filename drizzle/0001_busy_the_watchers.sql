CREATE TYPE "public"."batch_run_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "batch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "batch_run_status" DEFAULT 'queued' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_plan_id_content_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."content_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_runs_plan_idx" ON "batch_runs" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "batch_runs_client_started_idx" ON "batch_runs" USING btree ("client_id","started_at");