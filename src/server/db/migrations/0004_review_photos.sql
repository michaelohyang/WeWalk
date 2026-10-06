ALTER TABLE "reviews" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_photo_url_length" CHECK (char_length("reviews"."photo_url") <= 500);