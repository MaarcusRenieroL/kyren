ALTER TABLE "payRun" ADD COLUMN "kind" text DEFAULT 'regular' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "pay_run_period_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "pay_run_period_unique" ON "payRun" USING btree ("organizationId","periodStart","periodEnd","currency") WHERE "payRun"."kind" = 'regular';
