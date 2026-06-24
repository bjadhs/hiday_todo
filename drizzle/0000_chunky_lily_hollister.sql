CREATE TABLE "plan_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"start_minutes" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"project_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"project_id" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"day_period" text,
	"date" text,
	"kanban_status" text DEFAULT 'next' NOT NULL,
	"created_at" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
