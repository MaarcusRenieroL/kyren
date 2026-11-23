import { router } from "../trpc";
import { goalsObjectivesProcedures } from "./goals/objectives";
import { goalsKeyResultsProcedures } from "./goals/key-results";

export const goalsRouter = router({
  ...goalsObjectivesProcedures,
  ...goalsKeyResultsProcedures,
});
