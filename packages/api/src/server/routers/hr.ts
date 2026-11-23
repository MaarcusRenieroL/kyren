import { router } from "../trpc";
import { hrDirectoryProcedures } from "./hr/directory";
import { hrImportProcedures } from "./hr/import";
import { hrEmployeeProcedures } from "./hr/employees";
import { hrLeaveQueriesProcedures } from "./hr/leave-queries";
import { hrLeaveMutationsProcedures } from "./hr/leave-mutations";

export { countWeekdays, employeeStatuses, leaveTypes } from "./hr/types";
export { currentEmployee } from "./hr/employees";

export const hrRouter = router({
  ...hrDirectoryProcedures,
  ...hrImportProcedures,
  ...hrEmployeeProcedures,
  ...hrLeaveQueriesProcedures,
  ...hrLeaveMutationsProcedures,
});
