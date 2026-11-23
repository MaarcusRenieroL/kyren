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
} from "@kyren/db/drizzle";
import { calendarEvents, members, users } from "@kyren/db/schema";
import { z } from "zod";

import { holdsOwn } from "../../access";
import { currentMemberId } from "../../chat";
import {
  occurrenceDay,
  occurrences,
  repeatKinds,
  type RepeatKind,
} from "../../recurrence";
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";
import { isoDate } from "../../zod-common";
import { safeTimeZone, zonedDay } from "../../../time-zone";

export const DAY = 86_400_000;
/** The longest span one list call may cover: a six-week month grid and its edges. */
export const MAX_RANGE_DAYS = 62;
/** One-off events, repeating series and occurrences one list call returns. */
export const MAX_EVENTS = 1000;
export const MAX_SERIES = 2000;
export const MAX_ITEMS = 5000;

export const uuid = z.string().uuid();
export const eventColors = [
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "gray",
] as const;

export const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, {
    module: "calendar",
    audit,
    also,
  });

export const eventInput = z
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
export function assertUntil(
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
export function assertOccurrence(
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
export async function skipDay(
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
export function dayBefore(day: string) {
  const date = new Date(`${day}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

/**
 * Stops a series before `day`, so that day and the ones after leave it. Only
 * if the series still reached that day: two splits at the same moment can't
 * both cut it (the second finds it already ended).
 */
export async function endSeriesBefore(
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

export async function manageable(ctx: OrganizationContext, id: string) {
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
