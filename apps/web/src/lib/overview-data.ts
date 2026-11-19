import { db } from "@zentro/db";
import {
  and,
  asc,
  countDistinct,
  eq,
  gte,
  isNull,
  lt,
  sql,
} from "@zentro/db/drizzle";
import {
  docs,
  members,
  projects,
  sessions,
  tasks,
  teams,
} from "@zentro/db/schema";
import { zonedDate, zonedMidnight } from "~/src/lib/time-zone";

export type OverviewRow = {
  id: string;
  name: string;
  href: string;
  open: number;
  doneWeek: number;
  overdue: number;
  total: number;
  done: number;
};

export type OverviewData = {
  kpis: {
    doneWeek: number;
    donePrevWeek: number;
    open: number;
    openSinceMonday: number;
    overdue: number;
    overdueSinceMonday: number;
    docsWeek: number;
    docsPrevWeek: number;
    activePeople: number;
    activePrevWeek: number;
    people: number;
  };
  /** Seven days ending today, oldest first. */
  days: Array<{ key: string; letter: string; today: boolean }>;
  heatmap: Array<{ id: string; name: string; counts: number[]; total: number }>;
  projects: OverviewRow[];
  teams: OverviewRow[];
};

const letters = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The organization's numbers for Overview: this week against last, where the
 * work is piling up, and who finished what on which day.
 */
export async function getOverviewData(input: {
  organizationId: string;
  enabledModules: Set<string>;
  /** The viewer's IANA zone, already checked with `safeTimeZone`. */
  timeZone: string;
}): Promise<OverviewData> {
  const { organizationId, timeZone } = input;
  // Days are the viewer's days, not the server's.
  const now = new Date();
  const today = zonedDate(now, timeZone);
  const todayWeekday = new Date(
    Date.UTC(today.year, today.month - 1, today.day),
  ).getUTCDay();
  const tomorrowStart = zonedMidnight(timeZone, now, -1);
  const weekStart = zonedMidnight(timeZone, now, 6);
  const prevWeekStart = zonedMidnight(timeZone, now, 13);
  const monday = zonedMidnight(timeZone, now, (todayWeekday + 6) % 7);

  const hasTasks = input.enabledModules.has("tasks");
  const hasDocs = input.enabledModules.has("docs");
  const liveTask = and(
    eq(tasks.organizationId, organizationId),
    isNull(tasks.deletedAt),
    isNull(tasks.archivedAt),
  );
  const isOpen = sql`${tasks.status} <> 'done'`;
  const isOverdue = sql`${tasks.status} <> 'done' and ${tasks.dueAt} < now()`;
  // Raw SQL gets dates as UTC text: the driver would send server-local time,
  // and these columns hold UTC wall time.
  const at = (date: Date) => sql`${date.toISOString()}::timestamp`;
  const doneSince = (from: Date) =>
    sql`${tasks.status} = 'done' and ${tasks.completedAt} >= ${at(from)}`;
  const n = (expression: ReturnType<typeof sql>) =>
    sql<number>`count(*) filter (where ${expression})`.mapWith(Number);

  const [taskTotals, docTotals, peopleRows, activeRows, teamList] =
    await Promise.all([
      hasTasks
        ? db
            .select({
              open: n(isOpen),
              openSinceMonday: n(
                sql`${isOpen} and ${tasks.createdAt} >= ${at(monday)}`,
              ),
              overdue: n(isOverdue),
              overdueSinceMonday: n(
                sql`${isOverdue} and ${tasks.dueAt} >= ${at(monday)}`,
              ),
              doneWeek: n(doneSince(weekStart)),
              donePrevWeek: n(
                sql`${tasks.status} = 'done' and ${tasks.completedAt} >= ${at(prevWeekStart)} and ${tasks.completedAt} < ${at(weekStart)}`,
              ),
            })
            .from(tasks)
            .where(liveTask)
        : [],
      hasDocs
        ? db
            .select({
              week: sql<number>`count(*) filter (where ${docs.updatedAt} >= ${at(weekStart)})`.mapWith(
                Number,
              ),
              prev: sql<number>`count(*) filter (where ${docs.updatedAt} >= ${at(prevWeekStart)} and ${docs.updatedAt} < ${at(weekStart)})`.mapWith(
                Number,
              ),
            })
            .from(docs)
            .where(
              and(
                eq(docs.organizationId, organizationId),
                isNull(docs.deletedAt),
              ),
            )
        : [],
      db
        .select({ userId: members.userId })
        .from(members)
        .where(eq(members.organizationId, organizationId)),
      db
        .select({
          week: countDistinct(
            sql`case when ${sessions.updatedAt} >= ${at(weekStart)} then ${sessions.userId} end`,
          ),
          prev: countDistinct(
            sql`case when ${sessions.updatedAt} >= ${at(prevWeekStart)} and ${sessions.updatedAt} < ${at(weekStart)} then ${sessions.userId} end`,
          ),
        })
        .from(sessions)
        .innerJoin(
          members,
          and(
            eq(members.userId, sessions.userId),
            eq(members.organizationId, organizationId),
          ),
        )
        .where(gte(sessions.updatedAt, prevWeekStart)),
      db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(
          and(
            eq(teams.organizationId, organizationId),
            isNull(teams.archivedAt),
          ),
        )
        .orderBy(asc(teams.name)),
    ]);

  const breakdown = (column: typeof tasks.projectId | typeof tasks.teamId) =>
    db
      .select({
        id: column,
        open: n(isOpen),
        overdue: n(isOverdue),
        doneWeek: n(doneSince(weekStart)),
        total: sql<number>`count(*)`.mapWith(Number),
        done: n(sql`${tasks.status} = 'done'`),
      })
      .from(tasks)
      .where(liveTask)
      .groupBy(column);

  const [projectList, byProject, byTeam, doneDays] = hasTasks
    ? await Promise.all([
        db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
          })
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, organizationId),
              isNull(projects.deletedAt),
              isNull(projects.archivedAt),
            ),
          )
          .orderBy(asc(projects.name)),
        breakdown(tasks.projectId),
        breakdown(tasks.teamId),
        db
          .select({
            teamId: tasks.teamId,
            day: sql<string>`to_char((${tasks.completedAt} at time zone 'UTC') at time zone ${timeZone}, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(tasks)
          .where(
            and(
              liveTask,
              eq(tasks.status, "done"),
              gte(tasks.completedAt, weekStart),
              lt(tasks.completedAt, tomorrowStart),
            ),
          )
          .groupBy(tasks.teamId, sql`2`),
      ])
    : [[], [], [], []];

  const days = Array.from({ length: 7 }, (_, index) => {
    // Calendar arithmetic only: a UTC date stands in for the viewer's date.
    const date = new Date(
      Date.UTC(today.year, today.month - 1, today.day - 6 + index),
    );

    return {
      key: date.toISOString().slice(0, 10),
      letter: letters[date.getUTCDay()]!,
      today: index === 6,
    };
  });
  const rowFor = (teamId: string | null) =>
    days.map(
      (day) =>
        doneDays.find((row) => row.teamId === teamId && row.day === day.key)
          ?.count ?? 0,
    );
  const heatmap = teamList.map((team) => {
    const counts = rowFor(team.id);

    return {
      id: team.id,
      name: team.name,
      counts,
      total: counts.reduce((sum, value) => sum + value, 0),
    };
  });
  const loose = rowFor(null);

  if (loose.some(Boolean)) {
    heatmap.push({
      id: "none",
      name: "No team",
      counts: loose,
      total: loose.reduce((sum, value) => sum + value, 0),
    });
  }

  const zero = { open: 0, overdue: 0, doneWeek: 0, total: 0, done: 0 };
  const memberIds = peopleRows.map((row) => row.userId);
  const totals = taskTotals[0];

  return {
    kpis: {
      doneWeek: totals?.doneWeek ?? 0,
      donePrevWeek: totals?.donePrevWeek ?? 0,
      open: totals?.open ?? 0,
      openSinceMonday: totals?.openSinceMonday ?? 0,
      overdue: totals?.overdue ?? 0,
      overdueSinceMonday: totals?.overdueSinceMonday ?? 0,
      docsWeek: docTotals[0]?.week ?? 0,
      docsPrevWeek: docTotals[0]?.prev ?? 0,
      activePeople: memberIds.length ? Number(activeRows[0]?.week ?? 0) : 0,
      activePrevWeek: memberIds.length ? Number(activeRows[0]?.prev ?? 0) : 0,
      people: memberIds.length,
    },
    days,
    heatmap,
    projects: projectList.map((project) => ({
      ...zero,
      ...byProject.find((row) => row.id === project.id),
      id: project.id,
      name: project.name,
      href: `/projects/${project.slug}`,
    })),
    teams: teamList.map((team) => ({
      ...zero,
      ...byTeam.find((row) => row.id === team.id),
      id: team.id,
      name: team.name,
      href: `/settings/organization/teams/${team.id}`,
    })),
  };
}
