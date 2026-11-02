import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "zentro-storage-"));
  vi.stubEnv("FILE_STORAGE_DIR", dir);
  vi.stubEnv("FILE_STORAGE", "local");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

async function driver() {
  vi.resetModules();

  return (await import("../src/lib/storage")).storage();
}

describe("local storage", () => {
  it("round-trips a file", async () => {
    const files = await driver();

    await files.put("org/a.txt", Buffer.from("hi"), "text/plain");

    expect((await files.get("org/a.txt"))?.body.toString()).toBe("hi");
  });

  it("returns null only for a file that does not exist", async () => {
    expect(await (await driver()).get("org/missing.txt")).toBeNull();
  });

  it("does not hide real failures as a missing file", async () => {
    await mkdir(path.join(dir, "org/folder"), { recursive: true });
    await writeFile(path.join(dir, "org/folder/x"), "x");

    // Reading a directory is an I/O error, not "not found".
    await expect((await driver()).get("org/folder")).rejects.toThrow();
  });

  it("refuses keys that leave the storage folder", async () => {
    const files = await driver();

    await expect(files.get("../outside")).rejects.toThrow("Bad file key");
    await expect(
      files.put("../../escape", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow("Bad file key");
  });
});
