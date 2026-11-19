import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

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
  await registerWithOrganization(page, {
    label: "files-folders",
    orgName: uniqueName("Files folders org"),
  });
  await page.goto("/files");

  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Contracts");
  await page.getByLabel("Folder name").press("Enter");
  // A new folder opens, and uploads land in it.
  await expect(page.getByRole("heading", { name: "Contracts" })).toBeVisible();
  await expect(page.getByText("This folder is empty")).toBeVisible();

  await page.getByLabel("Files to upload").setInputFiles({
    name: "lease.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("the lease"),
  });
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toBeVisible();

  // Back at the top of the library, filed files sit in their folder.
  await page.getByRole("button", { name: "Library" }).click();
  const folders = page.getByRole("list", { name: "Folders" });

  await expect(
    folders.getByRole("button", { name: /Contracts\s*1/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toHaveCount(0);

  await folders.getByRole("button", { name: /Contracts/ }).click();
  await page.getByLabel("Move lease.txt").selectOption({ label: "No folder" });
  await expect(page.getByText("This folder is empty")).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(
    page.getByRole("link", { name: "lease.txt", exact: true }),
  ).toBeVisible();
  await expect(folders.getByRole("button", { name: /Contracts/ })).toHaveCount(
    0,
  );
});
