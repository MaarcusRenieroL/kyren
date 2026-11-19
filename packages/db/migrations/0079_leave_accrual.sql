ALTER TABLE "employee" ADD COLUMN "annualLeaveAccrual" text DEFAULT 'upfront' NOT NULL;
--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_annual_leave_accrual_check" CHECK ("annualLeaveAccrual" IN ('upfront', 'monthly'));
