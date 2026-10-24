-- One time, for anything older code wrote while the crews release deployed (it knew one crew):
-- members in no crew join the first crew, and reviews and check-ins shared with no crew are
-- shared with it. Until now the app read those as the first crew's on the fly; from now on a
-- member in no crew goes to /welcome, and a post shared with no crew (its author left them all)
-- is seen by nobody.
INSERT INTO "crew_members" ("crew_id", "member_id", "role")
SELECT '00000000-0000-4000-8000-00000000c4e1', "id", 'member' FROM "members" m
WHERE NOT EXISTS (SELECT 1 FROM "crew_members" cm WHERE cm."member_id" = m."id");--> statement-breakpoint
INSERT INTO "review_crews" ("review_id", "crew_id")
SELECT "id", '00000000-0000-4000-8000-00000000c4e1' FROM "reviews" r
WHERE NOT EXISTS (SELECT 1 FROM "review_crews" rc WHERE rc."review_id" = r."id");--> statement-breakpoint
INSERT INTO "checkin_crews" ("checkin_id", "crew_id")
SELECT "id", '00000000-0000-4000-8000-00000000c4e1' FROM "checkins" c
WHERE NOT EXISTS (SELECT 1 FROM "checkin_crews" cc WHERE cc."checkin_id" = c."id");
