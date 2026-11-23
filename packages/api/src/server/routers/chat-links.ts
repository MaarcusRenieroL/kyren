import { chatLinksSearchProcedures } from "./chat-links/search";
import { chatLinksDiscussionProcedures } from "./chat-links/discussion";
import { chatLinksFileDiscussionsProcedures } from "./chat-links/file-discussions";

export const chatLinkProcedures = {
  ...chatLinksSearchProcedures,
  ...chatLinksDiscussionProcedures,
  ...chatLinksFileDiscussionsProcedures,
};
