ALTER TABLE "plan_items" ADD COLUMN "deleted_at" bigint;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "deleted_at" bigint;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "deleted_at" bigint;