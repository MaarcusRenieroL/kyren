ALTER TABLE "file" ADD COLUMN "source" text DEFAULT 'chat' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslip" ADD COLUMN "bonusSetByMemberId" uuid;
--> statement-breakpoint
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_bonusSetByMemberId_member_id_fk" FOREIGN KEY ("bonusSetByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
