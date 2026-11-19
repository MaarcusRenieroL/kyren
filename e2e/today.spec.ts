import { expect, test } from "./fixtures";
import {
  query,
  registerWithOrganization,
  trpcMutation,
  uniqueName,
} from "./helpers";

const stateOf = async (orgName: string, key: string) => {
  const [row] = await query<{ status: string; logs: number; timers: number }>(
    `select t.status,
            (select count(*)::int from "taskTimeLog" l where l."taskId" = t.id) as logs,
            (select count(*)::int from "runningTimer" r where r."taskId" = t.id) as timers
       from task t join organization o on o.id = t."organizationId"
      where o.name = $1 and t.key = $2`,
    [orgName, key],
  );

  return row!;
};

test("Start runs a timer, Pause logs the time and keeps the task in progress, Done closes both @dashboard", async ({
  page,
}) => {
  const orgName = uniqueName("Today timer");

  await registerWithOrganization(page, { label: "today", orgName });

  const [me] = await query<{ id: string }>(
    `select m.id from member m join organization o on o.id = m."organizationId"
      where o.name = $1`,
    [orgName],
  );
  const project = await trpcMutation<{ id: string }>(
    page,
    "project.createProject",
    { name: "Focus project", slug: "focus-project", description: "" },
  );
  const task = await trpcMutation<{ key: string }>(page, "task.createTask", {
    projectId: project.id,
    name: "Write the launch note",
    assignedToMemberId: me!.id,
  });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Write the launch note" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("Not started")).toBeVisible();

  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page.getByRole("main").getByText(/Running since/)).toBeVisible();
  await expect
    .poll(() => stateOf(orgName, task.key))
    .toMatchObject({ status: "in-progress", timers: 1, logs: 0 });

  // Pausing is not "not started": the task stays in progress, the time is kept.
  await page.getByRole("button", { name: /^Pause/ }).click();
  await expect(
    page.getByRole("main").getByText("In progress, timer paused"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Resume/ })).toBeVisible();
  await expect
    .poll(() => stateOf(orgName, task.key))
    .toMatchObject({ status: "in-progress", timers: 0, logs: 1 });

  // Still paused after a reload: the state comes from the server.
  await page.reload();
  await expect(
    page.getByRole("main").getByText("In progress, timer paused"),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Resume/ }).click();
  await expect(page.getByRole("main").getByText(/Running since/)).toBeVisible();
  await page.getByRole("button", { name: /^Mark done/ }).click();
  await expect
    .poll(() => stateOf(orgName, task.key))
    .toMatchObject({ status: "done", timers: 0, logs: 2 });
});
