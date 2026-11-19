CREATE TABLE "compensationChange" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"employeeId" uuid NOT NULL,
	"annualSalary" integer NOT NULL,
	"currency" text NOT NULL,
	"changedByMemberId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compensationChange" ADD CONSTRAINT "compensationChange_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compensationChange" ADD CONSTRAINT "compensationChange_employeeId_employee_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compensationChange" ADD CONSTRAINT "compensationChange_changedByMemberId_member_id_fk" FOREIGN KEY ("changedByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "compensation_change_employee_idx" ON "compensationChange" USING btree ("employeeId","createdAt");
--> statement-breakpoint
-- History starts with each salary as it stands today; who set it is unknown.
INSERT INTO "compensationChange" ("organizationId", "employeeId", "annualSalary", "currency", "createdAt")
SELECT "organizationId", "employeeId", "annualSalary", "currency", "updatedAt" FROM "compensation";
