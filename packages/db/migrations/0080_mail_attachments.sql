CREATE TABLE "mailAttachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" uuid NOT NULL,
	"fileId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mailAttachment" ADD CONSTRAINT "mailAttachment_messageId_mailMessage_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."mailMessage"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mailAttachment" ADD CONSTRAINT "mailAttachment_fileId_file_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "mail_attachment_message_idx" ON "mailAttachment" USING btree ("messageId");
--> statement-breakpoint
CREATE INDEX "mail_attachment_file_idx" ON "mailAttachment" USING btree ("fileId");
