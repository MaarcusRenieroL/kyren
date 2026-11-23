import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("signed-out uploads are rejected before parsing the file @files", async ({
  request,
}) => {
  const response = await request.post("/api/files", { data: "invalid form" });

  expect(response.status()).toBe(401);
});

test("a file uploads and shows usage; an oversized body is refused @files", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "files",
    orgName: uniqueName("Files org"),
  });
  await page.goto("/files");

  await page.getByLabel("Files to upload").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from the e2e test"),
  });

  const table = page.getByRole("table", { name: "Files" });
  await expect(
    table.getByRole("link", { name: "notes.txt", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/used\./)).toBeVisible();

  await table.getByRole("button", { name: "Name", exact: true }).click();
  await expect(
    table.getByRole("columnheader", { name: "Name" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page.getByRole("button", { name: "View columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Size" }).click();
  await expect(table.getByRole("columnheader", { name: "Size" })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");

  const search = page.getByRole("textbox", { name: "Search files" });
  await search.fill("does-not-exist");
  await expect(table.getByText("No files match")).toBeVisible();
  await search.clear();
  await expect(
    table.getByRole("link", { name: "notes.txt", exact: true }),
  ).toBeVisible();

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

test("a file pretending to be an image downloads instead of showing @files", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "files-type",
    orgName: uniqueName("Files type org"),
  });
  await page.goto("/files");

  const served = await page.evaluate(async () => {
    const upload = async (name: string, type: string, body: BlobPart) => {
      const form = new FormData();

      form.append("file", new File([body], name, { type }));
      form.append("library", "1");

      const saved = (await (
        await fetch("/api/files", { method: "POST", body: form })
      ).json()) as { url: string; mimeType: string };
      const response = await fetch(saved.url);

      return {
        stored: saved.mimeType,
        type: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
      };
    };
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
    ]);

    return {
      fake: await upload(
        "cat.png",
        "image/png",
        "<html><script>alert(1)</script>",
      ),
      real: await upload("dot.png", "image/png", png),
    };
  });

  expect(served.fake.stored).toBe("application/octet-stream");
  expect(served.fake.disposition).toMatch(/^attachment/);
  expect(served.real.stored).toBe("image/png");
  expect(served.real.disposition).toMatch(/^inline/);
});

test("files go into folders, move out again, and survive the folder's deletion @files", async ({
  page,
}) => {
  const { email } = await registerWithOrganization(page, {
    label: "files-folders",
    orgName: uniqueName("Files folders org"),
  });
  await page.goto("/files");

  const foldersMenu = page.getByRole("button", {
    name: "Folders",
    exact: true,
  });
  await foldersMenu.click();
  await page.getByRole("menuitem", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Contracts");
  await page.getByLabel("Folder name").press("Enter");
  // A new folder opens, and uploads land in it.
  await expect(page.getByRole("heading", { name: "Contracts" })).toBeVisible();
  await expect(page.getByText("This folder is empty")).toBeVisible();

  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["the lease"], "lease.txt", { type: "text/plain" }),
    );
    return data;
  });
  await page.getByRole("heading", { name: "Contracts" }).dispatchEvent("drop", {
    dataTransfer: transfer,
  });
  await transfer.dispose();
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toBeVisible();

  // Back at the top of the library, filed files sit in their folder.
  await page.getByRole("button", { name: "Library" }).click();
  await foldersMenu.click();
  await expect(
    page.getByRole("menuitem", { name: /Contracts\s*1/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Uploaded by" }).click();
  await page
    .getByRole("textbox", { name: "Search workspace members" })
    .fill(email);
  await page.getByRole("option").filter({ hasText: email }).click();
  await page.getByRole("combobox", { name: "Folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Search folders" }).fill("contract");
  await page.getByRole("option", { name: "Contracts" }).click();
  await page.getByRole("button", { name: /^Uploaded from,/ }).click();
  await page.locator('[data-today="true"] button').click();
  await page.getByRole("button", { name: /^Uploaded through,/ }).click();
  await page.locator('[data-today="true"] button').click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters (4)" }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toHaveCount(0);

  await foldersMenu.click();
  await page.getByRole("menuitem", { name: /Contracts/ }).click();
  await page.getByRole("combobox", { name: "Move lease.txt" }).click();
  await page.getByRole("option", { name: "No folder" }).click();
  await expect(page.getByText("This folder is empty")).toBeVisible();

  await page.getByRole("button", { name: "Delete folder" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toBeVisible();
  await foldersMenu.click();
  await expect(page.getByRole("menuitem", { name: /Contracts/ })).toHaveCount(
    0,
  );
});
