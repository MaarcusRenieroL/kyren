import { TRPCError } from "@trpc/server";
import { and, eq, isNull, ne, or, sql } from "@kyren/db/drizzle";
import {
  accounts,
  apiKeys,
  chatMessages,
  docComments,
  docs,
  employees,
  leaveRequests,
  meetingAttendees,
  meetings,
  members,
  sessions,
  taskComments,
  taskTimeLogs,
  tasks,
  ticketMessages,
  tickets,
  twoFactors,
  users,
  verifications,
} from "@kyren/db/schema";

import type { db as database } from "@kyren/db";

import { removeMemberAccess } from "@kyren/auth";

import { isUnderHold } from "../retention";

type Db = typeof database;

const REMOVED = "[removed]";

/** Everything the organization holds about one member, as plain data. Never secrets. */
export async function exportMemberData(
  db: Db,
  input: { organizationId: string; memberId: string },
) {
  const { organizationId, memberId } = input;
  const [row] = await db
    .select({
      userId: members.userId,
      role: members.role,
      joinedAt: members.createdAt,
      name: users.name,
      email: users.email,
      accountCreatedAt: users.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(eq(members.id, memberId), eq(members.organizationId, organizationId)),
    )
    .limit(1);

  if (!row) throw new TRPCError({ code: "NOT_FOUND" });

  const inOrg = (column: Parameters<typeof eq>[0]) =>
    eq(column, organizationId);

  const [
    taskRows,
    commentRows,
    timeRows,
    ticketRows,
    ticketMessageRows,
    chatRows,
    docRows,
    employeeRows,
    meetingRows,
  ] = await Promise.all([
    db
      .select({
        key: tasks.key,
        name: tasks.name,
        status: tasks.status,
        priority: tasks.priority,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(
        and(
          inOrg(tasks.organizationId),
          or(
            eq(tasks.assignedToMemberId, memberId),
            eq(tasks.createdByMemberId, memberId),
          ),
        ),
      ),
    db
      .select({ body: taskComments.body, at: taskComments.createdAt })
      .from(taskComments)
      .where(
        and(
          inOrg(taskComments.organizationId),
          eq(taskComments.authorMemberId, memberId),
          isNull(taskComments.deletedAt),
        ),
      ),
    db
      .select({
        minutes: taskTimeLogs.durationMinutes,
        note: taskTimeLogs.note,
        at: taskTimeLogs.createdAt,
      })
      .from(taskTimeLogs)
      .where(
        and(
          inOrg(taskTimeLogs.organizationId),
          eq(taskTimeLogs.memberId, memberId),
        ),
      ),
    db
      .select({
        subject: tickets.subject,
        status: tickets.status,
        at: tickets.createdAt,
      })
      .from(tickets)
      .where(
        and(
          inOrg(tickets.organizationId),
          eq(tickets.createdByMemberId, memberId),
        ),
      ),
    db
      .select({
        body: ticketMessages.body,
        kind: ticketMessages.kind,
        at: ticketMessages.createdAt,
      })
      .from(ticketMessages)
      .where(
        and(
          inOrg(ticketMessages.organizationId),
          eq(ticketMessages.authorMemberId, memberId),
        ),
      ),
    db
      .select({ body: chatMessages.body, at: chatMessages.createdAt })
      .from(chatMessages)
      .where(
        and(
          inOrg(chatMessages.organizationId),
          eq(chatMessages.authorMemberId, memberId),
          eq(chatMessages.kind, "message"),
          isNull(chatMessages.deletedAt),
        ),
      ),
    db
      .select({ title: docs.title, at: docs.createdAt })
      .from(docs)
      .where(
        and(inOrg(docs.organizationId), eq(docs.createdByMemberId, memberId)),
      ),
    db
      .select()
      .from(employees)
      .where(
        and(inOrg(employees.organizationId), eq(employees.memberId, memberId)),
      ),
    db
      .select({
        title: meetings.title,
        startsAt: meetings.startsAt,
        response: meetingAttendees.response,
      })
      .from(meetingAttendees)
      .innerJoin(meetings, eq(meetings.id, meetingAttendees.meetingId))
      .where(
        and(
          inOrg(meetings.organizationId),
          eq(meetingAttendees.userId, row.userId),
        ),
      ),
  ]);

  const employee = employeeRows[0] ?? null;
  const leave = employee
    ? await db
        .select({
          type: leaveRequests.type,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
          days: leaveRequests.days,
          status: leaveRequests.status,
        })
        .from(leaveRequests)
        .where(eq(leaveRequests.employeeId, employee.id))
    : [];

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: row.name,
      email: row.email,
      createdAt: row.accountCreatedAt,
    },
    membership: { role: row.role, joinedAt: row.joinedAt },
    employee: employee
      ? {
          name: employee.name,
          email: employee.email,
          jobTitle: employee.jobTitle,
          department: employee.department,
          location: employee.location,
          status: employee.status,
          startDate: employee.startDate,
          endDate: employee.endDate,
        }
      : null,
    leave,
    tasks: taskRows,
    comments: commentRows,
    timeLogs: timeRows,
    tickets: ticketRows,
    ticketMessages: ticketMessageRows,
    chatMessages: chatRows,
    docs: docRows,
    meetings: meetingRows,
  };
}
