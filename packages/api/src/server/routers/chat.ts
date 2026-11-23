import { chatChannelCoreProcedures } from "./chat/channels";
import { chatChannelMutationProcedures } from "./chat/channels-mutations";
import { chatDmProcedures } from "./chat/dm";
import { chatMemberProcedures } from "./chat/members";
import { chatSidebarProcedures } from "./chat/sidebar";

export const chatChannelProcedures = {
  ...chatSidebarProcedures,
  ...chatChannelCoreProcedures,
  ...chatChannelMutationProcedures,
  ...chatMemberProcedures,
  ...chatDmProcedures,
};
