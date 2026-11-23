import { router } from "../../trpc";
import { roleMutationProcedures } from "./roles-mutations";
import { roleQueryProcedures } from "./roles-queries";

export const rolesRouter = router({
  ...roleQueryProcedures,
  ...roleMutationProcedures,
});
