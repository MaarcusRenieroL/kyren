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
} from "@kyren/db/drizzle";
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
} from "@kyren/db/schema";
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

export const calendarSeriesProcedures = {
  skipOccurrence: procedure(
    "calendar.view",
    ["calendar.event_updated"],
    ["calendar.manage_own", "calendar.manage_any"],
  )
    .input(z.object({ id: uuid, startsAt: z.coerce.date() }))
    .mutation(async ({ ctx, input }) => {
      const event = await manageable(ctx, input.id);
      const start = assertOccurrence(event, input.startsAt);

      await ctx.db.transaction(async (tx) => {
        await skipDay(tx, event.id, start);
        await ctx.audit.record(tx, {
          action: "calendar.event_updated",
          target: { id: event.id, label: event.title },
          metadata: { skipped: start },
        });
      });

      return { id: event.id };
    }),

  /**
   * Changes one occurrence only: it leaves the series and becomes an event of
   * its own with the new details, in one step.
   */
  detachOccurrence: procedure(
    "calendar.view",
    ["calendar.event_updated", "calendar.event_created"],
    ["calendar.manage_own", "calendar.manage_any"],
  )
    .input(z.object({ id: uuid, startsAt: z.coerce.date(), data: eventInput }))
    .mutation(async ({ ctx, input }) => {
      const event = await manageable(ctx, input.id);
      const start = assertOccurrence(event, input.startsAt);

      const id = await ctx.db.transaction(async (tx) => {
        await skipDay(tx, event.id, start);

        const [row] = await tx
          .insert(calendarEvents)
          .values({
            ...input.data,
            // A single event now, on the series' own clock.
            repeat: null,
            repeatUntil: null,
            timeZone: event.timeZone,
            organizationId: ctx.activeOrganization.id,
            // Still the series owner's event, whoever moved it.
            createdByMemberId: event.createdByMemberId,
          })
          .returning({ id: calendarEvents.id });

        await ctx.audit.record(tx, {
          action: "calendar.event_updated",
          target: { id: event.id, label: event.title },
          metadata: { detached: start, into: row!.id },
        });
        await ctx.audit.record(tx, {
          action: "calendar.event_created",
          target: { id: row!.id, label: input.data.title },
        });

        return row!.id;
      });

      return { id };
    }),

  /**
   * Changes an occurrence and every one after it: the series stops the day
   * before, and a new series with the new details carries on from there.
   * From the first occurrence it is the same as changing the whole series.
   */
  splitSeries: procedure(
    "calendar.view",
    ["calendar.event_updated", "calendar.event_created"],
    ["calendar.manage_own", "calendar.manage_any"],
  )
    .input(z.object({ id: uuid, startsAt: z.coerce.date(), data: eventInput }))
    .mutation(async ({ ctx, input }) => {
      const event = await manageable(ctx, input.id);
      const day = assertOccurrence(event, input.startsAt);
      const data = { ...input.data, timeZone: undefined };

      assertUntil(data, event.timeZone);

      if (day === occurrenceDay(event, event.startsAt)) {
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
      }

      const id = await ctx.db.transaction(async (tx) => {
        const ended = await endSeriesBefore(tx, event.id, day);
        const [row] = await tx
          .insert(calendarEvents)
          .values({
            ...data,
            timeZone: event.timeZone,
            // Days already taken out of the series stay out.
            skipped: ended.skipped.filter((skipped) => skipped >= day),
            organizationId: ctx.activeOrganization.id,
            createdByMemberId: event.createdByMemberId,
          })
          .returning({ id: calendarEvents.id });

        await ctx.audit.record(tx, {
          action: "calendar.event_updated",
          target: { id: event.id, label: event.title },
          metadata: { endsBefore: day, continuedBy: row!.id },
        });
        await ctx.audit.record(tx, {
          action: "calendar.event_created",
          target: { id: row!.id, label: input.data.title },
        });

        return row!.id;
      });

      return { id };
    }),

  /**
   * Deletes an occurrence and every one after it. From the first occurrence
   * that is the whole series.
   */
  endSeries: procedure(
    "calendar.view",
    ["calendar.event_updated", "calendar.event_deleted"],
    ["calendar.manage_own", "calendar.manage_any"],
  )
    .input(z.object({ id: uuid, startsAt: z.coerce.date() }))
    .mutation(async ({ ctx, input }) => {
      const event = await manageable(ctx, input.id);
      const day = assertOccurrence(event, input.startsAt);
      const first = day === occurrenceDay(event, event.startsAt);

      await ctx.db.transaction(async (tx) => {
        if (first) {
          await tx
            .delete(calendarEvents)
            .where(eq(calendarEvents.id, event.id));
          await ctx.audit.record(tx, {
            action: "calendar.event_deleted",
            target: { id: event.id, label: event.title },
          });

          return;
        }

        await endSeriesBefore(tx, event.id, day);
        await ctx.audit.record(tx, {
          action: "calendar.event_updated",
          target: { id: event.id, label: event.title },
          metadata: { endsBefore: day },
        });
      });

      return { id: event.id };
    }),

  remove: procedure(
    "calendar.view",
    ["calendar.event_deleted"],
    ["calendar.manage_own", "calendar.manage_any"],
  )
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const event = await manageable(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        await tx.delete(calendarEvents).where(eq(calendarEvents.id, event.id));
        await ctx.audit.record(tx, {
          action: "calendar.event_deleted",
          target: { id: event.id, label: event.title },
        });
      });

      return { id: event.id };
    }),
};
