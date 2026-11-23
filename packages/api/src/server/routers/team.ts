import { router } from "../trpc";
import { teamQueriesProcedures } from "./team/queries";
import { teamWorkloadProcedures } from "./team/workload";
import { teamMutationsProcedures } from "./team/mutations";
import { teamMembersProcedures } from "./team/members";

export const teamRouter = router({
  ...teamQueriesProcedures,
  ...teamWorkloadProcedures,
  ...teamMutationsProcedures,
  ...teamMembersProcedures,
});
