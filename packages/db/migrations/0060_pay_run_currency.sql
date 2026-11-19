ALTER TABLE "payRun" ADD COLUMN "currency" text;
--> statement-breakpoint
UPDATE "payRun" SET "currency" = coalesce((SELECT min("payslip"."currency") FROM "payslip" WHERE "payslip"."payRunId" = "payRun"."id"), 'USD');
--> statement-breakpoint
ALTER TABLE "payRun" ALTER COLUMN "currency" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "pay_run_period_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "pay_run_period_unique" ON "payRun" USING btree ("organizationId","periodStart","periodEnd","currency");
