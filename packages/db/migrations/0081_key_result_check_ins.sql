CREATE TABLE "keyResultCheckIn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyResultId" uuid NOT NULL,
	"memberId" uuid,
	"value" double precision NOT NULL,
	"confidence" text NOT NULL,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "keyResultCheckIn_confidence_check" CHECK ("confidence" in ('on_track', 'at_risk', 'off_track'))
);
--> statement-breakpoint
ALTER TABLE "keyResultCheckIn" ADD CONSTRAINT "keyResultCheckIn_keyResultId_keyResult_id_fk" FOREIGN KEY ("keyResultId") REFERENCES "public"."keyResult"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "keyResultCheckIn" ADD CONSTRAINT "keyResultCheckIn_memberId_member_id_fk" FOREIGN KEY ("memberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "keyResultCheckIn_result_idx" ON "keyResultCheckIn" USING btree ("keyResultId","createdAt");
