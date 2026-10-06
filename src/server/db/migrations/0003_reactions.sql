CREATE TABLE "reactions" (
	"review_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_review_id_member_id_kind_pk" PRIMARY KEY("review_id","member_id","kind"),
	CONSTRAINT "reactions_kind_known" CHECK (kind in ('fire', 'hundred', 'laugh', 'disagree'))
);
--> statement-breakpoint
ALTER TABLE "reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;