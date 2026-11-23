import { router } from "../trpc";
import { memberQueriesProcedures } from "./member/queries";
import { memberMutationsProcedures } from "./member/mutations";

export const memberRouter = router({
  ...memberQueriesProcedures,
  ...memberMutationsProcedures,
});
