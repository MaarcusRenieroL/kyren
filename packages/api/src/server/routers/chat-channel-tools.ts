import { chatChannelStatusProcedures } from "./chat-channel-tools/status";
import { chatChannelToolsProcedures } from "./chat-channel-tools/tools";

export const chatChannelToolProcedures = {
  ...chatChannelStatusProcedures,
  ...chatChannelToolsProcedures,
};
