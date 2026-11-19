import { expect, test } from "./fixtures";
import {
  query,
  registerWithOrganization,
  trpcMutation,
  uniqueName,
} from "./helpers";

const zone = "Pacific/Kiritimati"; // UTC+14: its day is never the server's.

test.use({ timezoneId: zone });

test("Today counts work done since the viewer's midnight, not the server's @dashboard", async ({
  page,
}) => {
  const orgName = uniqueName("Zone org");

  await registerWithOrganization(page, { label: "zone", orgName });

  const [me] = await query<{ id: string }>(
    `select m.id from member m join organization o on o.id = m."organizationId"
      where o.name = $1`,
    [orgName],
  );
  const project = await trpcMutation<{ id: string }>(
    page,
    "project.createProject",
    { name: "Zone project", slug: "zone-project", description: "" },
  );
  const finish = async (name: string) => {
    const task = await trpcMutation<{ id: string; key: string }>(
      page,
      "task.createTask",
      { projectId: project.id, name, assignedToMemberId: me!.id },
    );

    await trpcMutation(page, "task.updateTaskByKey", {
      key: task.key,
      status: "done",
    });

    return task;
  };
  const late = await finish("Finished late last night");
  const early = await finish("Finished just after midnight");
  await trpcMutation(page, "task.createTask", {
    projectId: project.id,
    name: "Still open",
    assignedToMemberId: me!.id,
  });

  // Put the two completions either side of midnight in the viewer's zone.
  // Kiritimati is a fixed UTC+14 with no DST, so its midnight is plain math,
  // worked out here without the app's own helper.
  const offset = 14 * 60 * 60 * 1000;
  const local = new Date(Date.now() + offset);
  const midnight =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    offset;
  const stamp = (at: number) => new Date(at).toISOString().replace("Z", "");
  const backdate = (taskId: string, at: number) =>
    query(
      `update "activityEvent" set "createdAt" = $1::timestamp
        where "targetId" = $2 and action = 'task.status_changed'`,
      [stamp(at), taskId],
    );

  await backdate(late.id, midnight - 60_000);
  await backdate(early.id, midnight + 60_000);

  await page.goto("/dashboard");

  // The browser hands its zone to the server, which then counts one task.
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find((c) => c.name === "zentro-tz")
          ?.value,
    )
    .toBe(encodeURIComponent(zone));
  await expect(
    page.getByRole("img", { name: /^1 of \d+ done$/ }),
  ).toBeVisible();
});
