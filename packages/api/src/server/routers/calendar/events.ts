import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
} from "@zentro/db/drizzle";
import {
  calendarEvents,
  chatChannels,
  employees,
  leaveRequests,
  meetingAttendees,
  meetings,
  members,
  tasks,
  users,
} from "@zentro/db/schema";
import { z } from "zod";
import { holdsOwn } from "../../access";
import { currentMemberId, readableChannelIds } from "../../chat";
import { safeTimeZone, zonedDay, zonedDayStart } from "../../../time-zone";
import { isoDate } from "../../zod-common";
import {
  DAY,
  MAX_RANGE_DAYS,
  MAX_EVENTS,
  MAX_SERIES,
  MAX_ITEMS,
  uuid,
  procedure,
  eventInput,
  assertUntil,
  assertOccurrence,
  skipDay,
  dayBefore,
  endSeriesBefore,
  manageable,
} from "./helpers";
import {
  occurrenceDay,
  occurrences,
  repeatKinds,
  type RepeatKind,
} from "../../recurrence";

export const calendarEventsProcedures = {
  create: procedure("calendar.create", ["calendar.event_created"])
    .input(eventInput)
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const timeZone = safeTimeZone(input.timeZone);

      assertUntil(input, timeZone);

      const id = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(calendarEvents)
          .values({
            ...input,
            timeZone,
            organizationId: ctx.activeOrganization.id,
            createdByMemberId: memberId,
          })
          .returning({ id: calendarEvents.id });

        await ctx.audit.record(tx, {
          action: "calendar.event_created",
          target: { id: row!.id, label: input.title },
        });

        return row!.id;
      });

      return { id };
    }),

  update: procedure(
    "calendar.view",
    ["calendar.event_updated"],
    ["calendar.manage_own", "calendar.manage_any"],
  )
    .input(z.object({ id: uuid, data: eventInput }))
    .mutation(async ({ ctx, input }) => {
      const event = await manageable(ctx, input.id);
      // The series keeps its creator's clock, whoever edits it.
      const data = { ...input.data, timeZone: undefined };

      assertUntil(data, event.timeZone);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(calendarEvents)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(calendarEvents.id, event.id));
        await ctx.audit.record(tx, {
          action: "calendar.event_updated",
          target: { id: event.id, label: input.data.title },
        });
      });

      return { id: event.id };
    }),

  /** Takes one occurrence out of a repeating series; the rest stay. */
};
