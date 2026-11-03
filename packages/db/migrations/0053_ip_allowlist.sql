ALTER TABLE "organization" ADD COLUMN "ipAllowlistEnabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "ipAllowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"cidr" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ipAllowlist_organization_idx" ON "ipAllowlist" USING btree ("organizationId");
