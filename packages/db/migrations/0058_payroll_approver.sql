ALTER TABLE "payRun" ADD COLUMN "approvedByMemberId" uuid;
--> statement-breakpoint
ALTER TABLE "payRun" ADD CONSTRAINT "payRun_approvedByMemberId_member_id_fk" FOREIGN KEY ("approvedByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
