import { chatFeedProcedures } from "./chat-feed-ai/feed";
import { chatAiProcedures } from "./chat-feed-ai/ai";

export const chatFeedAiProcedures = {
  ...chatFeedProcedures,
  ...chatAiProcedures,
};
