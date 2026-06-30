CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;