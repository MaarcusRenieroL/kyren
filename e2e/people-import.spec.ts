import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues } from "./people-helpers";

test("people import from a CSV file and re-uploading skips duplicates @hr", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "people-import",
    orgName: uniqueName("People import org"),
  });

  const csv = Buffer.from(
    "Name,Email,Job title\nAna Lee,ana@example.com,Designer\nBo Chen,bo@example.com,Engineer\n",
  );

  async function upload() {
    await page.goto("/hr/import");
    await page.getByLabel("CSV file").setInputFiles({
      name: "people.csv",
      mimeType: "text/csv",
      buffer: csv,
    });
    await expect(page.getByText("people.csv: 2 people ready.")).toBeVisible();
    await page.getByRole("button", { name: "Import people" }).click();
    await expect(page).toHaveURL(/\/hr$/);
  }

  await page.goto("/hr/import");
  await expectNoSeriousA11yIssues(page, "people import");

  await upload();
  await expect(page.getByText("Ana Lee").first()).toBeVisible();
  await expect(page.getByText("Bo Chen").first()).toBeVisible();

  await upload();
  await expect(page.getByText("Ana Lee")).toHaveCount(1);
});
