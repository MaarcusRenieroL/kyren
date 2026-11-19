CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_org_user_idx" ON "member" USING btree ("organizationId","userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_user_idx" ON "member" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_org_idx" ON "invitation" USING btree ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" USING btree ("userId");
