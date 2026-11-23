import { router } from "../trpc";
import { assignmentsRouter } from "./permissions/assignments";
import { permissionEvaluationProcedures } from "./permissions/evaluation";
import { logRouter } from "./permissions/log";
import { overridesRouter } from "./permissions/overrides";
import { rolesRouter } from "./permissions/roles";

export const permissionsRouter = router({
  ...permissionEvaluationProcedures,
  roles: rolesRouter,
  assignments: assignmentsRouter,
  overrides: overridesRouter,
  log: logRouter,
});
