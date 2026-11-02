CREATE UNIQUE INDEX "pay_run_period_unique" ON "payRun" USING btree ("organizationId","periodStart","periodEnd");--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_run_employee_unique" ON "payslip" USING btree ("payRunId","employeeId");--> statement-breakpoint
ALTER TABLE "compensation" ADD CONSTRAINT "compensation_salary_check" CHECK ("annualSalary" >= 0);--> statement-breakpoint
ALTER TABLE "payRun" ADD CONSTRAINT "pay_run_rate_check" CHECK ("deductionRateBps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "payRun" ADD CONSTRAINT "pay_run_status_check" CHECK ("status" in ('draft', 'approved', 'paid'));--> statement-breakpoint
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_amounts_check" CHECK ("base" >= 0 and "bonus" >= 0 and "deductions" >= 0 and "net" >= 0);
