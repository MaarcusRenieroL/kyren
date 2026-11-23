import { chatPollsProcedures } from "./chat-social/polls";
import { chatEmojisProcedures } from "./chat-social/emojis";

export const chatSocialProcedures = {
  ...chatPollsProcedures,
  ...chatEmojisProcedures,
};
