-- Stations get an integer key; the old text id becomes `slug` (still unique, still the URL).
-- Reviews and check-ins are repointed from the text id to the integer one, keeping every row.
-- Hand-written: the generated version would cast text ids to integers and fail.
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_station_id_stations_id_fk";--> statement-breakpoint
ALTER TABLE "checkins" DROP CONSTRAINT "checkins_station_id_stations_id_fk";--> statement-breakpoint
ALTER TABLE "stations" DROP CONSTRAINT "stations_pkey";--> statement-breakpoint
ALTER TABLE "stations" DROP CONSTRAINT "stations_id_slug";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "id" TO "slug";--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_slug_format" CHECK ("stations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "id" integer GENERATED ALWAYS AS IDENTITY (sequence name "stations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "station_key" integer;--> statement-breakpoint
UPDATE "reviews" SET "station_key" = "stations"."id" FROM "stations" WHERE "stations"."slug" = "reviews"."station_id";--> statement-breakpoint
DROP INDEX "reviews_one_per_member_station";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "station_id";--> statement-breakpoint
ALTER TABLE "reviews" RENAME COLUMN "station_key" TO "station_id";--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "station_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_member_station" ON "reviews" USING btree ("station_id","member_id");--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "station_key" integer;--> statement-breakpoint
UPDATE "checkins" SET "station_key" = "stations"."id" FROM "stations" WHERE "stations"."slug" = "checkins"."station_id";--> statement-breakpoint
DROP INDEX "checkins_one_per_member_station_day";--> statement-breakpoint
ALTER TABLE "checkins" DROP COLUMN "station_id";--> statement-breakpoint
ALTER TABLE "checkins" RENAME COLUMN "station_key" TO "station_id";--> statement-breakpoint
ALTER TABLE "checkins" ALTER COLUMN "station_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_one_per_member_station_day" ON "checkins" USING btree ("station_id","member_id","visited_on");
