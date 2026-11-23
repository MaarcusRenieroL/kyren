import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@kyren/auth", () => ({ auth: {} }));
vi.mock("~/src/lib/paths", () => ({ paths: {} }));

const { protectedPrefixes } = await import("../src/proxy");

describe("the sign-in proxy", () => {
  it("covers every workspace page folder, so no module is reachable signed out", () => {
    const root = path.join(__dirname, "../src/app/(workspace)");
    const folders = readdirSync(root).filter((name) =>
      statSync(path.join(root, name)).isDirectory(),
    );
    const covered = protectedPrefixes.map((entry) => entry.split("/")[1]);

    expect(folders.length).toBeGreaterThan(10);
    expect(folders.filter((name) => !covered.includes(name))).toEqual([]);
  });
});
