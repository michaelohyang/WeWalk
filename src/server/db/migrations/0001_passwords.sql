ALTER TABLE "members" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "failed_logins" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "locked_until" timestamp with time zone;