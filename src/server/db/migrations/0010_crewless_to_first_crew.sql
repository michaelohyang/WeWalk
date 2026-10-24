-- One time: anyone in no crew joins the first crew. Before this release the app quietly added
-- crewless members to it on sign-in; the only people it could find were those who signed up
-- through older code while the crews release deployed. From now on, someone in no crew (they
-- left their last one) goes to /welcome instead.
INSERT INTO "crew_members" ("crew_id", "member_id", "role")
SELECT '00000000-0000-4000-8000-00000000c4e1', "id", 'member' FROM "members" m
WHERE NOT EXISTS (SELECT 1 FROM "crew_members" cm WHERE cm."member_id" = m."id");
