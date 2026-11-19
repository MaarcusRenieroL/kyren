import { expect, test } from "./fixtures";
import { registerWithOrganization, trpcMutation, uniqueName } from "./helpers";

test("a deleted task can be found in the trash and restored @tasks", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "task-trash",
    orgName: uniqueName("Trash org"),
  });

  const project = await trpcMutation<{ id: string }>(
    page,
    "project.createProject",
    { name: "Trash project", slug: "trash-project", description: "" },
  );
  const task = await trpcMutation<{ key: string }>(page, "task.createTask", {
    projectId: project.id,
    name: "Deleted by mistake",
  });

  await trpcMutation(page, "task.deleteTaskByKey", { key: task.key });

  await page.goto("/tasks");
  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deleted tasks" }),
  ).toBeVisible();
  await expect(page.getByText("Deleted by mistake")).toBeVisible();

  await page.getByRole("button", { name: `Restore ${task.key}` }).click();
  await expect(page.getByText("Nothing here.", { exact: false })).toBeVisible();

  await page.goto(`/tasks/${task.key}`);
  await expect(page.getByText("Deleted by mistake").first()).toBeVisible();
});
