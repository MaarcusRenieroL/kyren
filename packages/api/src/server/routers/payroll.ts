import { router } from "../trpc";
import { payrollSalariesProcedures } from "./payroll/salaries";
import { payrollPayslipsProcedures } from "./payroll/payslips";
import { payrollRunsCreateProcedures } from "./payroll/runs-create";
import { payrollRunsLifecycleProcedures } from "./payroll/runs-lifecycle";
import { payrollExportProcedures } from "./payroll/export";

export { computePay } from "./payroll/types";

export const payrollRouter = router({
  ...payrollSalariesProcedures,
  ...payrollPayslipsProcedures,
  ...payrollRunsCreateProcedures,
  ...payrollRunsLifecycleProcedures,
  ...payrollExportProcedures,
});
