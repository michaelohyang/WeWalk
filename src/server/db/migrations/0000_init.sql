CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"member_id" uuid NOT NULL,
	"visited_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_note_length" CHECK (char_length("checkins"."note") <= 400)
);
--> statement-breakpoint
ALTER TABLE "checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "links_purpose_known" CHECK (purpose in ('pair', 'recover'))
);
--> statement-breakpoint
ALTER TABLE "links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"member_id" uuid NOT NULL,
	"visited_on" date NOT NULL,
	"coffee" smallint,
	"wifi" smallint,
	"booths" smallint,
	"light" smallint,
	"noise" smallint,
	"seating" smallint,
	"bathrooms" smallint,
	"lunch" smallint,
	"vibe" smallint,
	"hot_take" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_has_a_score" CHECK (num_nonnulls(coffee, wifi, booths, light, noise, seating, bathrooms, lunch, vibe) > 0),
	CONSTRAINT "reviews_coffee_range" CHECK (coffee between 1 and 5),
	CONSTRAINT "reviews_wifi_range" CHECK (wifi between 1 and 5),
	CONSTRAINT "reviews_booths_range" CHECK (booths between 1 and 5),
	CONSTRAINT "reviews_light_range" CHECK (light between 1 and 5),
	CONSTRAINT "reviews_noise_range" CHECK (noise between 1 and 5),
	CONSTRAINT "reviews_seating_range" CHECK (seating between 1 and 5),
	CONSTRAINT "reviews_bathrooms_range" CHECK (bathrooms between 1 and 5),
	CONSTRAINT "reviews_lunch_range" CHECK (lunch between 1 and 5),
	CONSTRAINT "reviews_vibe_range" CHECK (vibe between 1 and 5),
	CONSTRAINT "reviews_hot_take_length" CHECK (char_length("reviews"."hot_take") <= 120),
	CONSTRAINT "reviews_body_length" CHECK (char_length("reviews"."body") <= 1200)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"neighborhood" text NOT NULL,
	"area" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stations_area_known" CHECK (area in ('uptown', 'midtown', 'flatiron', 'downtown', 'brooklyn')),
	CONSTRAINT "stations_id_slug" CHECK ("stations"."id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "stations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_one_per_member_station_day" ON "checkins" USING btree ("station_id","member_id","visited_on");--> statement-breakpoint
CREATE INDEX "checkins_member_idx" ON "checkins" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "devices_member_idx" ON "devices" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_name_key_unique" ON "members" USING btree ("name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "members_one_owner" ON "members" USING btree ("is_owner") WHERE "members"."is_owner";--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_member_station" ON "reviews" USING btree ("station_id","member_id");--> statement-breakpoint
CREATE INDEX "reviews_member_idx" ON "reviews" USING btree ("member_id");