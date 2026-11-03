import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a file uploads and shows usage; an oversized body is refused", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "files",
    orgName: uniqueName("Files org"),
  });
  await page.goto("/files");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from the e2e test"),
  });

  await expect(page.getByText("notes.txt").first()).toBeVisible();
  await expect(page.getByText(/used\./)).toBeVisible();

  // 27 MB is over the 25 MB limit, however the request is shaped.
  const status = await page.evaluate(async () => {
    const body = new FormData();

    body.append(
      "file",
      new File([new Uint8Array(27 * 1024 * 1024)], "big.bin", {
        type: "application/octet-stream",
      }),
    );
    body.append("library", "1");

    return (await fetch("/api/files", { method: "POST", body })).status;
  });

  expect(status).toBe(413);
});
