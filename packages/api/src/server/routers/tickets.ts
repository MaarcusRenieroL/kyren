import { router } from "../trpc";
import { ticketQueriesProcedures } from "./tickets/queries";
import { ticketMutationsProcedures } from "./tickets/mutations";
import { ticketSettingsProcedures } from "./tickets/settings";

export {
  ticketStatuses,
  assignmentModes,
  ticketPriorities,
  ticketViews,
} from "./tickets/types";

export const ticketsRouter = router({
  ...ticketQueriesProcedures,
  ...ticketMutationsProcedures,
  ...ticketSettingsProcedures,
});
