import { router } from "../trpc";
import { calendarQueriesProcedures } from "./calendar/queries";
import { calendarEventsProcedures } from "./calendar/events";
import { calendarSeriesProcedures } from "./calendar/series";

export const calendarRouter = router({
  ...calendarQueriesProcedures,
  ...calendarEventsProcedures,
  ...calendarSeriesProcedures,
});
