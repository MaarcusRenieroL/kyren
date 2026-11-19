import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  eq,
  gt,
  sql,
  isNotNull,
  isNull,
  lt,
  or,
} from "@zentro/db/drizzle";
import { calendarEvents, members, users } from "@zentro/db/schema";
import { z } from "zod";

import { holdsOwn } from "../access";
import { currentMemberId } from "../chat";
import {
  occurrenceDay,
  occurrences,
  repeatKinds,
  type RepeatKind,
} from "../recurrence";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";
import { isoDate } from "../zod-common";
import { safeTimeZone, zonedDay } from "../../time-zone";

const DAY = 86_400_000;
/** The longest span one list call may cover: a six-week month grid and its edges. */
const MAX_RANGE_DAYS = 62;
/** One-off events, repeating series and occurrences one list call returns. */
const MAX_EVENTS = 1000;
const MAX_SERIES = 2000;
const MAX_ITEMS = 5000;

const uuid = z.string().uuid();
export const eventColors = [
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "gray",
] as const;

const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, {
    module: "calendar",
    audit,
    also,
  });

const eventInput = z
  .object({
    title: z.string().trim().min(1, "Give the event a title.").max(200),
    description: z.string().trim().max(5000).nullable().default(null),
    location: z.string().trim().max(300).nullable().default(null),
    color: z.enum(eventColors).default("blue"),
    allDay: z.boolean().default(false),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    repeat: z.enum(repeatKinds).nullable().default(null),
    repeatUntil: isoDate.nullable().default(null),
    /**
     * The creator's IANA zone; repeats and "until" follow its clock. Kept from
     * creation: an edit from another zone does not move the series.
     */
    timeZone: z.string().max(64).optional(),
  })
  .refine((value) => value.endsAt >= value.startsAt, {
    message: "The event can't end before it starts.",
    path: ["endsAt"],
  })
  .refine((value) => value.repeat !== null || value.repeatUntil === null, {
    message: "Pick how often it repeats.",
    path: ["repeat"],
  });

/** "Until" is a day on the series' own clock, and can't come before its start. */
function assertUntil(
  value: { startsAt: Date; allDay: boolean; repeatUntil: string | null },
  timeZone: string,
) {
  if (
    value.repeatUntil &&
    value.repeatUntil <
      zonedDay(value.startsAt, value.allDay ? "UTC" : timeZone)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "It can't stop repeating before it starts.",
    });
  }
}

/**
 * The local day of a real, not yet skipped occurrence of this series (how
 * skips are kept), or BAD_REQUEST.
 */
function assertOccurrence(
  event: typeof calendarEvents.$inferSelect,
  startsAt: Date,
) {
  const real =
    event.repeat &&
    occurrences(
      {
        startsAt: event.startsAt,
        endsAt: event.startsAt,
        repeat: event.repeat as RepeatKind,
        repeatUntil: event.repeatUntil,
        timeZone: event.allDay ? "UTC" : event.timeZone,
        skipped: event.skipped,
      },
      new Date(startsAt.getTime() - 1),
      new Date(startsAt.getTime() + 1),
      2,
    ).some((start) => start.getTime() === startsAt.getTime());

  if (!real) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That is not an event in this series.",
    });
  }

  return occurrenceDay(event, startsAt);
}

/**
 * Takes one day out of a series, once: two requests at the same moment can't
 * both take the same day (the second finds it already gone).
 */
async function skipDay(
  tx: Pick<OrganizationContext["db"], "update">,
  id: string,
  day: string,
) {
  const [row] = await tx
    .update(calendarEvents)
    .set({
      skipped: sql`array_append(${calendarEvents.skipped}, ${day})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(calendarEvents.id, id),
        sql`not (${day} = any(${calendarEvents.skipped}))`,
      ),
    )
    .returning({ id: calendarEvents.id });

  if (!row) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That event has already been changed.",
    });
  }
}

/** The calendar day before `day` (both YYYY-MM-DD). */
function dayBefore(day: string) {
  const date = new Date(`${day}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

/**
 * Stops a series before `day`, so that day and the ones after leave it. Only
 * if the series still reached that day: two splits at the same moment can't
 * both cut it (the second finds it already ended).
 */
async function endSeriesBefore(
  tx: Pick<OrganizationContext["db"], "update">,
  id: string,
  day: string,
) {
  const [row] = await tx
    .update(calendarEvents)
    .set({ repeatUntil: dayBefore(day), updatedAt: new Date() })
    .where(
      and(
        eq(calendarEvents.id, id),
        or(
          isNull(calendarEvents.repeatUntil),
          sql`${calendarEvents.repeatUntil} >= ${day}::date`,
        ),
      ),
    )
    .returning({ skipped: calendarEvents.skipped });

  if (!row) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That event has already been changed.",
    });
  }

  return row;
}

async function manageable(ctx: OrganizationContext, id: string) {
  const memberId = await currentMemberId(ctx);
  const [event] = await ctx.db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, id),
        eq(calendarEvents.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
  }

  const mine = event.createdByMemberId === memberId;
  const allowed = mine
    ? (await holdsOwn(ctx, "calendar.manage_own")) ||
      (await ctx.permissions.can("calendar.manage_any"))
    : await ctx.permissions.can("calendar.manage_any");

  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only change events you created.",
    });
  }

  return event;
}

export const calendarRouter = router({
  /** Events that overlap the given range. */
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
});
