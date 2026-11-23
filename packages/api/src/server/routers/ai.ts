import { router } from "../trpc";
import { aiSearchProcedures } from "./ai/search";
import { aiTasksSprintsProcedures } from "./ai/tasks-sprints";
import { aiTicketsProcedures } from "./ai/tickets";
import { aiDocsProcedures } from "./ai/docs";

export const aiRouter = router({
  ...aiSearchProcedures,
  ...aiTasksSprintsProcedures,
  ...aiTicketsProcedures,
  ...aiDocsProcedures,
});
