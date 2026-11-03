CREATE TABLE "webhookEndpoint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"createdByUserId" uuid,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '["*"]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhookDelivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpointId" uuid NOT NULL,
	"organizationId" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp DEFAULT now() NOT NULL,
	"responseStatus" integer,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deliveredAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "webhookEndpoint" ADD CONSTRAINT "webhookEndpoint_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhookEndpoint" ADD CONSTRAINT "webhookEndpoint_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhookDelivery" ADD CONSTRAINT "webhookDelivery_endpointId_webhookEndpoint_id_fk" FOREIGN KEY ("endpointId") REFERENCES "public"."webhookEndpoint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhookDelivery" ADD CONSTRAINT "webhookDelivery_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_endpoint_org_idx" ON "webhookEndpoint" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "webhook_delivery_due_idx" ON "webhookDelivery" USING btree ("status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "webhook_delivery_endpoint_idx" ON "webhookDelivery" USING btree ("endpointId","createdAt");
