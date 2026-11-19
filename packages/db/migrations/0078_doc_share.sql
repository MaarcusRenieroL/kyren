ALTER TABLE "doc" ADD COLUMN "shareToken" text;
--> statement-breakpoint
ALTER TABLE "doc" ADD COLUMN "sharedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "doc" ADD COLUMN "sharedByMemberId" uuid;
--> statement-breakpoint
ALTER TABLE "doc" ADD CONSTRAINT "doc_sharedByMemberId_member_id_fk" FOREIGN KEY ("sharedByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "doc_share_token_idx" ON "doc" USING btree ("shareToken");
