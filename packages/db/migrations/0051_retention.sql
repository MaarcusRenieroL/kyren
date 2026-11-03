CREATE TABLE "retentionPolicy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"dataType" text NOT NULL,
	"days" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "retentionPolicy_organization_type_unique" ON "retentionPolicy" USING btree ("organizationId","dataType");
--> statement-breakpoint
CREATE INDEX "retentionPolicy_organization_idx" ON "retentionPolicy" USING btree ("organizationId");
--> statement-breakpoint
CREATE TABLE "legalHold" (
	"organizationId" uuid PRIMARY KEY NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"reason" text NOT NULL,
	"setByMemberId" uuid REFERENCES "member"("id") ON DELETE SET NULL,
	"setAt" timestamp DEFAULT now() NOT NULL
);
