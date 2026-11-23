import { db } from "@kyren/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDashboardData } from "../../../apps/web/src/lib/dashboard-data";
import { loadPermissionSnapshot } from "../src/server/permissions";
import { setupProjectVisibility } from "./helpers/project-visibility-setup";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const notFound = { code: "NOT_FOUND" };
const scenario = {
  label: "team",
  visibility: "team" as const,
  teamMemberSees: true,
};

type Context = Awaited<ReturnType<typeof setupProjectVisibility>>;

describe("team project visibility", () => {
  let ctx: Context;

  beforeAll(async () => {
    ctx = await setupProjectVisibility(world, scenario);
  });

  const hiddenFrom = (label: string) =>
    label === "outsider" ||
    (label === "team member" && !scenario.teamMemberSees);

  describe.each([["outsider"], ["team member"], ["project member"]] as const)(
    "as the %s",
    (label) => {
      const caller = () =>
        label === "outsider"
          ? ctx.outsider
          : label === "team member"
            ? ctx.teamMember
            : ctx.member;
      const user = () =>
        label === "outsider"
          ? ctx.outsiderUser
          : label === "team member"
            ? ctx.teamUser
            : ctx.memberUser;
      const hidden = hiddenFrom(label);

      it("project list and detail", async () => {
        const ids = (await caller().project.getProjectsByOrgId()).map(
          (project) => project.id,
        );

        expect(ids.includes(ctx.projectId)).toBe(!hidden);

        if (hidden) {
          await expect(
            caller().project.getProjectBySlug({ slug: ctx.slug }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().project.getAccess({ slug: ctx.slug }),
          ).rejects.toMatchObject(notFound);
        } else {
          await expect(
            caller().project.getProjectBySlug({ slug: ctx.slug }),
          ).resolves.toMatchObject({ slug: ctx.slug });
        }
      });

      it("task list and calendar data", async () => {
        const tasks = await caller().task.getTasksByOrgId({});
        const keys = tasks.map((task) => task.key);

        expect(keys).toContain("OP-1");
        expect(keys.includes("HP-1")).toBe(!hidden);
        expect(keys.includes("HP-2")).toBe(!hidden);
        expect(
          tasks.some((task) => task.projectSlug === ctx.slug && task.due),
        ).toBe(!hidden);
      });

      it("task detail by key", async () => {
        const detail = await caller().task.getTaskByKey({ key: ctx.taskKey });

        if (hidden) {
          expect(detail).toBeUndefined();
          await expect(
            caller().task.getTaskByKey({ key: "NOPE-99" }),
          ).resolves.toEqual(detail);
        } else {
          expect(detail).toMatchObject({ key: ctx.taskKey });
        }
      });

      it("task overview", async () => {
        const overview = await caller().task.getOverview();
        const everything = [
          ...overview.assignedToMe,
          ...overview.overdue,
          ...overview.recentlyUpdated,
        ].map((task) => task.key);

        expect(everything.some((key) => key.startsWith("HP-"))).toBe(!hidden);
        expect(
          overview.activity.some((event) => event.taskKey.startsWith("HP-")),
        ).toBe(!hidden);

        const total = overview.byStatus.reduce(
          (sum, row) => sum + row.count,
          0,
        );

        expect(total).toBe(hidden ? 1 : 3);
        expect(overview.counts.overdue).toBe(hidden ? 0 : 1);
      });

      it("task comments and activity", async () => {
        if (hidden) {
          await expect(
            caller().comment.getTaskComments({ taskKey: ctx.taskKey }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().activity.getTaskActivityEvents({ taskKey: ctx.taskKey }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().comment.createTaskComment({
              taskKey: ctx.taskKey,
              body: "hello",
            }),
          ).rejects.toMatchObject(notFound);
        } else {
          const comments = await caller().comment.getTaskComments({
            taskKey: ctx.taskKey,
          });

          expect(comments.map((comment) => comment.body)).toContain(
            "secret task comment",
          );
          expect(
            (
              await caller().activity.getTaskActivityEvents({
                taskKey: ctx.taskKey,
              })
            ).length,
          ).toBeGreaterThan(0);
        }
      });

      it("docs list, recent, my docs and trash", async () => {
        const all = (await caller().docs.getAll({})).map((doc) => doc.slug);
        const trash = (
          await caller().docs.getAll({ includeDeleted: true })
        ).map((doc) => doc.slug);

        expect(all).toContain(ctx.openDocSlug);
        expect(all.includes(ctx.docSlug)).toBe(!hidden);
        expect(trash.includes(ctx.trashedSlug)).toBe(!hidden);

        const mine = (await caller().docs.getAll({})).filter(
          (doc) => doc.createdByUserId === ctx.outsiderUser.id,
        );

        expect(mine.map((doc) => doc.slug).includes(ctx.outsiderDocSlug)).toBe(
          label === "outsider" ? false : !hidden,
        );

        const recent = (await caller().docs.getAll({})).slice(0, 10);

        expect(recent.some((doc) => doc.slug === ctx.docSlug)).toBe(!hidden);
        expect(user().id).toBeTruthy();
      });

      it("doc detail by slug and id", async () => {
        if (hidden) {
          await expect(
            caller().docs.getBySlug({ slug: ctx.docSlug }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().docs.getById({ id: ctx.docId }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().docs.updateDocTitle({ id: ctx.docId, title: "x" }),
          ).rejects.toMatchObject(notFound);
        } else {
          await expect(
            caller().docs.getBySlug({ slug: ctx.docSlug }),
          ).resolves.toMatchObject({ slug: ctx.docSlug });
        }
      });

      it("doc search", async () => {
        const byBody = await caller().docs.search({ query: "needle" });
        const byProject = await caller().docs.search({ query: "Project" });
        const slugs = [...byBody, ...byProject].map((doc) => doc.slug);

        expect(slugs.includes(ctx.docSlug)).toBe(!hidden);
        expect(
          (await caller().docs.search({ query: "", includeDeleted: true }))
            .map((doc) => doc.slug)
            .includes(ctx.trashedSlug),
        ).toBe(!hidden);
      });

      it("doc comments", async () => {
        if (hidden) {
          await expect(
            caller().docs.getComments({ docId: ctx.docId }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().docs.createComment({ docId: ctx.docId, body: "hello" }),
          ).rejects.toMatchObject(notFound);
          await expect(
            caller().docs.resolveComment({ id: ctx.commentId }),
          ).rejects.toMatchObject(notFound);
        } else {
          expect(
            (await caller().docs.getComments({ docId: ctx.docId })).map(
              (comment) => comment.body,
            ),
          ).toContain("secret doc comment");
        }
      });

      it("dashboard counts and my tasks", async () => {
        const snapshot = await loadPermissionSnapshot(
          db,
          ctx.org.id,
          user().id,
        );
        const dashboard = await getDashboardData({
          organizationId: ctx.org.id,
          userId: user().id,
          enabledModules: new Set(["projects", "tasks", "docs"]),
          snapshot,
          timeZone: "UTC",
        });
        const stat = (name: string) =>
          dashboard.workspaceStats.find((item) => item.label === name)?.value;

        expect(stat("Projects")).toBe(hidden ? 1 : 2);
        expect(stat("Open tasks")).toBe(hidden ? 1 : 3);
        expect(stat("Docs")).toBe(hidden ? 1 : 3);
        expect(dashboard.tasks.map((task) => task.title)).not.toContain(
          hidden ? "Hidden task" : "never",
        );
        expect(
          dashboard.recentWork.some((item) => item.title.includes("Hidden")),
        ).toBe(!hidden);
        expect(
          dashboard.recentActivity.some((item) => item.action.includes("HP-1")),
        ).toBe(!hidden);
      });

      it("my tasks on the dashboard", async () => {
        const snapshot = await loadPermissionSnapshot(
          db,
          ctx.org.id,
          ctx.outsiderUser.id,
        );
        const dashboard = await getDashboardData({
          organizationId: ctx.org.id,
          userId: ctx.outsiderUser.id,
          enabledModules: new Set(["projects", "tasks", "docs"]),
          snapshot,
          timeZone: "UTC",
        });

        expect(dashboard.tasks.map((task) => task.title)).not.toContain(
          "Hidden task",
        );
      });

      it("teams pages show no project data", async () => {
        const teams = await caller().team.getAll();

        expect(teams.length).toBeGreaterThan(0);

        for (const team of teams) {
          expect(JSON.stringify(team)).not.toContain(ctx.slug);
          expect(Object.keys(team)).not.toContain("projects");
        }
      });
    },
  );
});
