CREATE TABLE "checkin_hides" (
	"checkin_id" uuid NOT NULL,
	"crew_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkin_hides_checkin_id_crew_id_pk" PRIMARY KEY("checkin_id","crew_id")
);
--> statement-breakpoint
ALTER TABLE "checkin_hides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "crew_bans" (
	"crew_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crew_bans_crew_id_member_id_pk" PRIMARY KEY("crew_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "crew_bans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_id" uuid NOT NULL,
	"reporter_id" uuid,
	"author_id" uuid NOT NULL,
	"review_id" uuid,
	"checkin_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_one_target" CHECK (num_nonnulls("reports"."review_id", "reports"."checkin_id") = 1),
	CONSTRAINT "reports_status_known" CHECK (status in ('open', 'hidden', 'removed', 'dismissed')),
	CONSTRAINT "reports_reason_length" CHECK (char_length("reports"."reason") <= 300)
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_hides" (
	"review_id" uuid NOT NULL,
	"crew_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_hides_review_id_crew_id_pk" PRIMARY KEY("review_id","crew_id")
);
--> statement-breakpoint
ALTER TABLE "review_hides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkin_hides" ADD CONSTRAINT "checkin_hides_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_hides" ADD CONSTRAINT "checkin_hides_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_bans" ADD CONSTRAINT "crew_bans_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_bans" ADD CONSTRAINT "crew_bans_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_members_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_hides" ADD CONSTRAINT "review_hides_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_hides" ADD CONSTRAINT "review_hides_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_open_crew_idx" ON "reports" USING btree ("crew_id") WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "reports_one_open_per_reporter" ON "reports" USING btree ("crew_id","reporter_id",coalesce("review_id", "checkin_id")) WHERE "reports"."status" = 'open';