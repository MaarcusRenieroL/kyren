import { chatSavedItemsProcedures } from "./chat-saved/items";
import { chatDraftsScheduleProcedures } from "./chat-saved/drafts-and-schedule";

export const chatSavedProcedures = {
  ...chatSavedItemsProcedures,
  ...chatDraftsScheduleProcedures,
};
