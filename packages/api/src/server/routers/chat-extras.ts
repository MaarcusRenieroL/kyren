import { chatSavedProcedures } from "./chat-saved";
import { chatReadingProcedures } from "./chat-reading";
import { chatChannelToolProcedures } from "./chat-channel-tools";
import { chatSocialProcedures } from "./chat-social";
import { chatFeedAiProcedures } from "./chat-feed-ai";

/** Chat features beyond sending messages, grouped by area in their own files. */
export const chatExtraProcedures = {
  ...chatSavedProcedures,
  ...chatReadingProcedures,
  ...chatChannelToolProcedures,
  ...chatSocialProcedures,
  ...chatFeedAiProcedures,
};
