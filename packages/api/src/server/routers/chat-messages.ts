import { plainBody } from "../chat";
import { chatMessageActionProcedures } from "./chat-messages/actions";
import { chatMessageQueryProcedures } from "./chat-messages/queries";
import { chatMessageSearchProcedures } from "./chat-messages/search";
import { chatMessageSendProcedures } from "./chat-messages/send";

export const chatMessageProcedures = {
  ...chatMessageQueryProcedures,
  ...chatMessageSendProcedures,
  ...chatMessageActionProcedures,
  ...chatMessageSearchProcedures,
};

export { plainBody };
export { internalRefsIn, messageLinksIn } from "./chat-messages/refs";
export { hydrateMessages } from "./chat-messages/hydrate";
export type {
  ChatAttachment,
  ChatEntityRef,
  ChatLinkPreview,
  ChatMessageView,
  ChatPollView,
  ChatTaskRef,
} from "./chat-messages/types";
