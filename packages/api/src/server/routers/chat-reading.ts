import { chatReadingStateProcedures } from "./chat-reading/state";
import { chatReadingThreadsProcedures } from "./chat-reading/threads";

export const chatReadingProcedures = {
  ...chatReadingStateProcedures,
  ...chatReadingThreadsProcedures,
};
