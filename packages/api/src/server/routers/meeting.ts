import { router } from "../trpc";
import { meetingQueriesProcedures } from "./meeting/queries";
import { meetingMutationsProcedures } from "./meeting/mutations";

export const meetingRouter = router({
  ...meetingQueriesProcedures,
  ...meetingMutationsProcedures,
});
