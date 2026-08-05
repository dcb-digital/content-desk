ALTER TYPE "public"."generation_action" ADD VALUE 'page_package';--> statement-breakpoint
ALTER TABLE "generation_logs" ALTER COLUMN "est_cost_usd" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "generation_logs" ALTER COLUMN "est_cost_usd" DROP NOT NULL;