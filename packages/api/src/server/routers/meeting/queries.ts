import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lt } from "@kyren/db/drizzle";
import { meetingAttendees, meetings, members, users } from "@kyren/db/schema";
import { z } from "zod";

import { aiAvailable, askClaude } from "../../chat-ai";
import { actionItemsOf } from "../../meeting-actions";
import { projectFromInput } from "../../resources";
import { mailMeeting } from "../../meeting-mail";
import { sendDueMeetingRemindersLazily } from "../../meeting-reminders";
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";
import type { TRPCContext } from "../../../types";
import { taskRouter } from "../task";
import { uuid } from "../../zod-common";

const MAX_ATTENDEES = 100;
const MAX_NOTES = 20_000;

const procedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "calendar", audit });

/** Where the video room lives. Jitsi needs no account; set MEETING_BASE_URL to use your own. */
function joinUrl(slug: string) {
  const configured = process.env.MEETING_BASE_URL?.replace(/\/+$/, "");
  const base =
    configured && configured.startsWith("https://")
      ? configured
      : "https://meet.jit.si";

  return `${base}/kyren-${slug}`;
}

/** A meeting the person organizes or is invited to; anything else does not exist for them. */
async function visible(ctx: OrganizationContext, id: string) {
  const [meeting] = await ctx.db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.id, id),
        eq(meetings.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);
  const [invited] = meeting
    ? await ctx.db
        .select({ id: meetingAttendees.id })
        .from(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, meeting.id),
            eq(meetingAttendees.userId, ctx.user.id),
          ),
        )
        .limit(1)
    : [];

  if (!meeting || (!invited && meeting.organizerUserId !== ctx.user.id)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found." });
  }

  return meeting;
}


export const meetingQueriesProcedures = {
  list: procedure("calendar.view")
    .input(z.object({ when: z.enum(["upcoming", "past"]) }))
    .query(async ({ ctx, input }) => {
      await sendDueMeetingRemindersLazily(ctx.db);

      const now = new Date();
      // Meetings last at most 8 hours, so that bounds what can still be running.
      const earliestRunning = new Date(now.getTime() - 480 * 60_000);
      const rows = await ctx.db
        .select({
          id: meetings.id,
          title: meetings.title,
          startsAt: meetings.startsAt,
          durationMinutes: meetings.durationMinutes,
          status: meetings.status,
          response: meetingAttendees.response,
        })
        .from(meetings)
        .innerJoin(
          meetingAttendees,
          and(
            eq(meetingAttendees.meetingId, meetings.id),
            eq(meetingAttendees.userId, ctx.user.id),
          ),
        )
        .where(
          and(
            eq(meetings.organizationId, ctx.activeOrganization.id),
            input.when === "upcoming"
              ? gte(meetings.startsAt, earliestRunning)
              : lt(meetings.startsAt, now),
          ),
        )
        .orderBy(
          input.when === "upcoming"
            ? asc(meetings.startsAt)
            : desc(meetings.startsAt),
        )
        .limit(200)
        .then((found) =>
          found.filter((row) => {
            // A meeting counts as upcoming until its slot is over.
            const ends = row.startsAt.getTime() + row.durationMinutes * 60_000;

            return input.when === "upcoming"
              ? ends >= now.getTime()
              : ends < now.getTime();
          }),
        );

      return rows;
    }),

  /** The person's meetings starting in a window, for the calendar grid. */
  between: procedure("calendar.view")
    .input(
      z
        .object({ from: z.string().datetime(), to: z.string().datetime() })
        .refine(
          (range) =>
            Date.parse(range.to) > Date.parse(range.from) &&
            Date.parse(range.to) - Date.parse(range.from) <= 62 * 86_400_000,
          { message: "Pick a range of up to two months." },
        ),
    )
    .query(async ({ ctx, input }) =>
      ctx.db
        .select({
          id: meetings.id,
          title: meetings.title,
          startsAt: meetings.startsAt,
          durationMinutes: meetings.durationMinutes,
          status: meetings.status,
          response: meetingAttendees.response,
        })
        .from(meetings)
        .innerJoin(
          meetingAttendees,
          and(
            eq(meetingAttendees.meetingId, meetings.id),
            eq(meetingAttendees.userId, ctx.user.id),
          ),
        )
        .where(
          and(
            eq(meetings.organizationId, ctx.activeOrganization.id),
            // Meetings last at most 8 hours, so one that began up to then
            // before the window may still run into it.
            gte(
              meetings.startsAt,
              new Date(Date.parse(input.from) - 480 * 60_000),
            ),
            lt(meetings.startsAt, new Date(input.to)),
          ),
        )
        .orderBy(asc(meetings.startsAt))
        .limit(500),
    ),

  get: procedure("calendar.view")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const meeting = await visible(ctx, input.id);
      const attendees = await ctx.db
        .select({
          userId: meetingAttendees.userId,
          name: users.name,
          response: meetingAttendees.response,
        })
        .from(meetingAttendees)
        .innerJoin(users, eq(users.id, meetingAttendees.userId))
        .where(eq(meetingAttendees.meetingId, meeting.id))
        .orderBy(asc(users.name));

      return {
        /** Whether "Recap with AI" can work here. */
        aiAvailable: await aiAvailable(ctx.db, ctx.activeOrganization.id),
        id: meeting.id,
        title: meeting.title,
        agenda: meeting.agenda,
        startsAt: meeting.startsAt,
        durationMinutes: meeting.durationMinutes,
        status: meeting.status,
        notes: meeting.notes,
        summary: meeting.summary,
        actionItems: actionItemsOf(meeting.summary),
        organizerUserId: meeting.organizerUserId,
        joinUrl: joinUrl(meeting.roomSlug),
        attendees,
      };
    }),

};
