CREATE TABLE "intakeForm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"fields" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"token" text DEFAULT replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "intakeForm_token_unique" UNIQUE ("token")
);
--> statement-breakpoint
CREATE INDEX "intakeForm_organization_idx" ON "intakeForm" USING btree ("organizationId");
