-- Fails loudly if a person is already in an organization twice; merge those by hand first.
DROP INDEX IF EXISTS "member_org_user_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_unique" ON "member" USING btree ("organizationId","userId");
