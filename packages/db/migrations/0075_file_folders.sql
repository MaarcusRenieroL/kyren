CREATE TABLE "fileFolder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"name" text NOT NULL,
	"createdByMemberId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fileFolder" ADD CONSTRAINT "fileFolder_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fileFolder" ADD CONSTRAINT "fileFolder_createdByMemberId_member_id_fk" FOREIGN KEY ("createdByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "file_folder_org_name_idx" ON "fileFolder" USING btree ("organizationId",lower("name"));
--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "folderId" uuid;
--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_folderId_fileFolder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."fileFolder"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "file_folder_idx" ON "file" USING btree ("folderId");
