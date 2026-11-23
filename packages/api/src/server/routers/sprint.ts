import { router } from "../trpc";
import { sprintLifecycleProcedures } from "./sprint/lifecycle";
import { sprintPlanningProcedures } from "./sprint/planning";

export const sprintRouter = router({
  ...sprintLifecycleProcedures,
  ...sprintPlanningProcedures,
});
