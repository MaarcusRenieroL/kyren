import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lt } from "@zentro/db/drizzle";
import { meetingAttendees, meetings, members, users } from "@zentro/db/schema";
import { z } from "zod";

import { aiAvailable, askClaude } from "../chat-ai";
import { actionItemsOf } from "../meeting-actions";
import { projectFromInput } from "../resources";
import { mailMeeting } from "../meeting-mail";
import { sendDueMeetingRemindersLazily } from "../meeting-reminders";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";
import type { TRPCContext } from "../../types";
import { taskRouter } from "./task";
import { uuid } from "../zod-common";

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

  return `${base}/zentro-${slug}`;
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

export const meetingRouter = router({
  /** The person's meetings: upcoming (still running or ahead) or past. */
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

  create: procedure("calendar.create", ["meeting.scheduled"])
    .input(
      z.object({
        title: z.string().trim().min(1, "Give the meeting a title.").max(200),
        agenda: z.string().trim().max(5000).optional(),
        startsAt: z.coerce.date(),
        durationMinutes: z.number().int().min(5).max(480),
        attendeeUserIds: z.array(uuid).max(MAX_ATTENDEES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.startsAt.getTime() < Date.now() - 5 * 60_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a time that has not passed.",
        });
      }

      const invitees = [...new Set(input.attendeeUserIds)].filter(
        (id) => id !== ctx.user.id,
      );

      if (invitees.length) {
        const found = await ctx.db
          .select({ userId: members.userId })
          .from(members)
          .where(
            and(
              eq(members.organizationId, ctx.activeOrganization.id),
              inArray(members.userId, invitees),
            ),
          );

        if (found.length !== invitees.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You can only invite people from this organization.",
          });
        }
      }

      const result = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(meetings)
          .values({
            organizationId: ctx.activeOrganization.id,
            organizerUserId: ctx.user.id,
            title: input.title,
            agenda: input.agenda || null,
            startsAt: input.startsAt,
            durationMinutes: input.durationMinutes,
            roomSlug: randomBytes(12).toString("hex"),
          })
          .returning({ id: meetings.id });

        await tx
          .insert(meetingAttendees)
          .values([
            { meetingId: created!.id, userId: ctx.user.id, response: "yes" },
            ...invitees.map((userId) => ({ meetingId: created!.id, userId })),
          ]);
        await ctx.audit.record(tx, {
          action: "meeting.scheduled",
          target: { id: created!.id, label: input.title },
        });

        return { id: created!.id };
      });

      const [row] = await ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.id, result.id));

      await mailMeeting(ctx.db, row!, "invite");

      return result;
    }),

  /** An invitee's answer. */
  respond: procedure("calendar.view")
    .input(z.object({ id: uuid, response: z.enum(["yes", "no", "maybe"]) }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await visible(ctx, input.id);

      await ctx.db
        .update(meetingAttendees)
        .set({ response: input.response })
        .where(
          and(
            eq(meetingAttendees.meetingId, meeting.id),
            eq(meetingAttendees.userId, ctx.user.id),
          ),
        );

      return { ok: true };
    }),

  /** Shared notes anyone in the meeting can write. */
  saveNotes: procedure("calendar.view")
    .input(z.object({ id: uuid, notes: z.string().max(MAX_NOTES) }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await visible(ctx, input.id);

      if (meeting.status === "canceled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This meeting was canceled.",
        });
      }

      await ctx.db
        .update(meetings)
        .set({ notes: input.notes })
        .where(eq(meetings.id, meeting.id));

      return { ok: true };
    }),

  /** Only the organizer cancels. */
  cancel: procedure("calendar.view", ["meeting.canceled"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await visible(ctx, input.id);

      if (meeting.organizerUserId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the organizer can cancel the meeting.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(meetings)
          .set({ status: "canceled" })
          .where(eq(meetings.id, meeting.id));
        await ctx.audit.record(tx, {
          action: "meeting.canceled",
          target: { id: meeting.id, label: meeting.title },
        });
      });
      await mailMeeting(ctx.db, meeting, "cancel");

      return { ok: true };
    }),

  /**
   * Makes a task for each action item in a project the person may add tasks
   * to. Each task goes through the normal task creation, so keys, permissions
   * and audit entries are the same as when it is created by hand.
   */
  createTasks: permissionProcedure("tasks.create", projectFromInput, {
    module: "tasks",
  })
    .input(
      z.object({
        id: uuid,
        projectId: uuid,
        titles: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await visible(ctx, input.id);
      const tasksApi = taskRouter.createCaller(ctx as unknown as TRPCContext);
      const keys: string[] = [];

      for (const name of input.titles) {
        const task = await tasksApi.createTask({
          projectId: input.projectId,
          name,
          description: `From the meeting "${meeting.title}".`,
        });

        keys.push(task.key);
      }

      return { keys };
    }),

  /** Turns the notes into a short recap with decisions and action items. */
  summarize: procedure("calendar.view", ["ai.used"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await visible(ctx, input.id);

      if (!meeting.notes?.trim()) {
        ctx.audit.skipped("ai.used");

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Write some notes first.",
        });
      }

      const summary = await askClaude(
        ctx,
        "summarize a meeting",
        "You write concise meeting recaps. Reply with: a two-sentence summary, then 'Decisions:' and 'Action items:' as short bullet lists, naming owners when the notes do. Use only what the notes say.",
        `Meeting: ${meeting.title}\n\nNotes:\n${meeting.notes}`,
      );

      if (!summary) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "AI notes need an administrator to turn on AI (and ANTHROPIC_API_KEY to be set).",
        });
      }

      await ctx.db
        .update(meetings)
        .set({ summary })
        .where(eq(meetings.id, meeting.id));

      return { summary };
    }),
});
