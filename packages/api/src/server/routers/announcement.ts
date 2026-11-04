import { desc } from "@zentro/db/drizzle";
import { platformAnnouncements } from "@zentro/db/schema";

import { authenticatedProcedure, router } from "../trpc";
import { liveAnnouncementsCondition } from "./platform-ops";

export const announcementRouter = router({
  /** What the platform is telling everyone right now (shown as a banner). */
  active: authenticatedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: platformAnnouncements.id,
        title: platformAnnouncements.title,
        body: platformAnnouncements.body,
        severity: platformAnnouncements.severity,
      })
      .from(platformAnnouncements)
      .where(liveAnnouncementsCondition())
      .orderBy(desc(platformAnnouncements.startsAt))
      .limit(5),
  ),
});
