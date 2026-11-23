import { router } from "../../trpc";
import { assignmentMutationProcedures } from "./assignments-mutations";
import { assignmentQueryProcedures } from "./assignments-queries";

export const assignmentsRouter = router({
  ...assignmentQueryProcedures,
  ...assignmentMutationProcedures,
});
