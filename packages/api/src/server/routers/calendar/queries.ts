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
  sql,
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

export const calendarQueriesProcedures = {
  list: procedure("calendar.view", undefined, [
    "calendar.manage_own",
    "calendar.manage_any",
  ])
    .input(
      z
        .object({ from: z.coerce.date(), to: z.coerce.date() })
        .refine(
          (value) =>
            value.to > value.from &&
            value.to.getTime() - value.from.getTime() <= MAX_RANGE_DAYS * DAY,
          { message: `Pick a range of up to ${MAX_RANGE_DAYS} days.` },
        ),
    )
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const any = await ctx.permissions.can("calendar.manage_any");
      const own = await holdsOwn(ctx, "calendar.manage_own");

      const columns = { event: calendarEvents, creator: users.name };
      const scoped = and(
        eq(calendarEvents.organizationId, ctx.activeOrganization.id),
        lt(calendarEvents.startsAt, input.to),
      );
      // One-off events and repeating series are fetched apart, so old series
      // that never end cannot crowd the range's own events out of the limit.
      const [single, series] = await Promise.all([
        ctx.db
          .select(columns)
          .from(calendarEvents)
          .leftJoin(members, eq(members.id, calendarEvents.createdByMemberId))
          .leftJoin(users, eq(users.id, members.userId))
          .where(
            and(
              scoped,
              isNull(calendarEvents.repeat),
              gt(calendarEvents.endsAt, input.from),
            ),
          )
          .orderBy(asc(calendarEvents.startsAt))
          .limit(MAX_EVENTS),
        ctx.db
          .select(columns)
          .from(calendarEvents)
          .leftJoin(members, eq(members.id, calendarEvents.createdByMemberId))
          .leftJoin(users, eq(users.id, members.userId))
          .where(
            and(
              scoped,
              isNotNull(calendarEvents.repeat),
              or(
                isNull(calendarEvents.repeatUntil),
                // "Until" is a local day, which west of UTC ends up to a day
                // after the UTC date; its last occurrence may also run on
                // past it by its own length.
                sql`${calendarEvents.repeatUntil} >= (${input.from.toISOString()}::timestamp - (${calendarEvents.endsAt} - ${calendarEvents.startsAt}) - interval '1 day')::date`,
              ),
            ),
          )
          .orderBy(asc(calendarEvents.startsAt))
          .limit(MAX_SERIES),
      ]);
      const rows = [...single, ...series];

      return (
        rows
          .flatMap(({ event, creator }) => {
            const base = {
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              color: event.color,
              allDay: event.allDay,
              repeat: event.repeat as RepeatKind | null,
              repeatUntil: event.repeatUntil,
              createdBy: creator ?? null,
              canManage: any || (own && event.createdByMemberId === memberId),
              // The series' own first dates, which the editor changes.
              seriesStartsAt: event.startsAt.toISOString(),
              seriesEndsAt: event.endsAt.toISOString(),
            };
            const length = event.endsAt.getTime() - event.startsAt.getTime();
            const starts = event.repeat
              ? occurrences(
                  {
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                    repeat: event.repeat as RepeatKind,
                    repeatUntil: event.repeatUntil,
                    // All-day events are stored on UTC days.
                    timeZone: event.allDay ? "UTC" : event.timeZone,
                    skipped: event.skipped,
                  },
                  input.from,
                  input.to,
                  // At most one a day: daily is the most often a series repeats.
                  MAX_RANGE_DAYS + 2,
                )
              : [event.startsAt];

            return starts.map((start) => ({
              ...base,
              startsAt: start.toISOString(),
              endsAt: new Date(start.getTime() + length).toISOString(),
            }));
          })
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          // One response stays bounded however many series repeat in it.
          .slice(0, MAX_ITEMS)
      );
    }),

};
