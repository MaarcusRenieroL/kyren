import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dir = path.join(__dirname, "../migrations");
const journal = JSON.parse(
  readFileSync(path.join(dir, "meta/_journal.json"), "utf8"),
) as { entries: { idx: number; tag: string; when: number }[] };

describe("migration journal", () => {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();

  it("lists every migration file, in order, with no gaps", () => {
    expect(journal.entries.map((entry) => entry.tag)).toEqual(files);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      files.map((_, index) => index),
    );
  });

  it("numbers files consecutively", () => {
    expect(files.map((name) => Number(name.slice(0, 4)))).toEqual(
      files.map((_, index) => index),
    );
  });

  it("has strictly increasing timestamps, which drizzle uses to pick what to run", () => {
    const whens = journal.entries.map((entry) => entry.when);

    expect(whens).toEqual([...whens].sort((a, b) => a - b));
    expect(new Set(whens).size).toBe(whens.length);
  });
});
