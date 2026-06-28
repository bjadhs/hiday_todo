CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"todo_id" text NOT NULL,
	"project_id" text NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint NOT NULL,
	"duration_seconds" integer NOT NULL
);
