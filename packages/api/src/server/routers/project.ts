import { router } from "../trpc";
import { projectCreateProcedures } from "./project/create";
import { projectQueriesProcedures } from "./project/queries";
import { projectUpdateProcedures } from "./project/update";
import { projectLifecycleProcedures } from "./project/lifecycle";
import { projectAccessProcedures } from "./project/access";
import { projectDependenciesProcedures } from "./project/dependencies";

export const projectRouter = router({
  ...projectCreateProcedures,
  ...projectQueriesProcedures,
  ...projectUpdateProcedures,
  ...projectLifecycleProcedures,
  ...projectAccessProcedures,
  ...projectDependenciesProcedures,
});
