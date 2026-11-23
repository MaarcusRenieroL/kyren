import { router } from "../trpc";
import { taskCreateProcedures } from "./task/create";
import { taskLifecycleProcedures } from "./task/lifecycle";
import { taskOverviewProcedures } from "./task/overview";
import { taskQueryProcedures } from "./task/queries";
import { taskSubtaskProcedures } from "./task/subtasks";
import { taskUpdateProcedures } from "./task/update";

export const taskRouter = router({
  ...taskCreateProcedures,
  ...taskSubtaskProcedures,
  ...taskQueryProcedures,
  ...taskOverviewProcedures,
  ...taskUpdateProcedures,
  ...taskLifecycleProcedures,
});
