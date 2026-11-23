import { router } from "../trpc";
import { notificationListProcedure } from "./notification/list";
import { notificationPreferencesProcedures } from "./notification/preferences";

export { notificationKinds, type NotificationKind, type InboxItem } from "./notification/types";

export const notificationRouter = router({
  list: notificationListProcedure,
  ...notificationPreferencesProcedures,
});
