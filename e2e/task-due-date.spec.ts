import { expect, test } from "./fixtures";
import {
  query,
  registerWithOrganization,
  trpcMutation,
  uniqueName,
} from "./helpers";

test.use({ timezoneId: "America/Los_Angeles" });

test("a due date means that day where the person is, not in UTC @tasks", async ({
  page,
}) => {
  const orgName = uniqueName("Due org");

  await registerWithOrganization(page, { label: "due", orgName });
  await trpcMutation(page, "project.createProject", {
    name: "Due project",
    slug: "due-project",
    description: "",
  });

  const name = uniqueName("Ship it");

  await page.goto("/tasks");
  await page.getByRole("button", { name: "Create task" }).first().click();

  const dialog = page.getByRole("dialog");

  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Task name").fill(name);
  await dialog.getByLabel("Due date").fill("2030-06-20");
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  // The end of 20 June in Los Angeles (UTC-7 in summer), not midnight UTC.
  // Read as UTC text: the column holds UTC wall time.
  const [task] = await query<{ due: string }>(
    `select to_char(t."dueAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') as due
       from task t join organization o on o.id = t."organizationId"
      where o.name = $1 and t.name = $2`,
    [orgName, name],
  );

  expect(task!.due).toBe("2030-06-21T06:59:59.999");
});
