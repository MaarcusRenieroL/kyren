import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues } from "./people-helpers";

test("an admin makes an API key, reads data with it, and revoking it cuts access @admin", async ({
  page,
  request,
}) => {
  await registerWithOrganization(page, {
    label: "keys",
    orgName: uniqueName("Keys org"),
  });
  await page.goto("/admin/api-keys");
  await expect(page.getByText("No keys yet.")).toBeVisible();
  await expectNoSeriousA11yIssues(page, "API keys");

  await page.getByLabel("Key name").fill("Zapier");
  await page.getByRole("button", { name: "Create key" }).click();

  const key = (await page.getByLabel("New API key").textContent()) ?? "";

  expect(key).toMatch(/^zk_live_/);

  const headers = { Authorization: `Bearer ${key}` };
  const ok = await request.get("/api/v1/projects", { headers });

  expect(ok.status()).toBe(200);
  expect(await ok.json()).toHaveProperty("data");

  expect((await request.get("/api/v1/projects")).status()).toBe(401);
  expect(
    (
      await request.get("/api/v1/projects", {
        headers: { Authorization: "Bearer zk_live_wrong" },
      })
    ).status(),
  ).toBe(401);
  expect((await request.get("/api/v1/nothing", { headers })).status()).toBe(
    404,
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Revoke Zapier" }).click();
  await expect(page.getByText("No keys yet.")).toBeVisible();

  expect((await request.get("/api/v1/projects", { headers })).status()).toBe(
    401,
  );
});
