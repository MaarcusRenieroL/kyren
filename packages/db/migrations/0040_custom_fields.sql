CREATE TABLE "customField" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_org_name_unique" ON "customField" ("organizationId", lower("name"));
--> statement-breakpoint
CREATE TABLE "customFieldValue" (
	"taskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
	"fieldId" uuid NOT NULL REFERENCES "customField"("id") ON DELETE CASCADE,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customFieldValue_taskId_fieldId_pk" PRIMARY KEY ("taskId", "fieldId")
);
--> statement-breakpoint
CREATE INDEX "custom_field_value_field_idx" ON "customFieldValue" ("fieldId");
