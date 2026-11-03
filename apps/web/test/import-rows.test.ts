import { describe, expect, it } from "vitest";

import { parseTaskCsv } from "../src/components/tasks/import-rows";

describe("parseTaskCsv", () => {
  it("reads common column names and values", () => {
    const { rows, warnings, error } = parseTaskCsv(
      'Title,Status,Priority,Due Date,Details\nShip it,In progress,High,2030-01-02,"a, b"\nPlain,,,,',
    );

    expect(error).toBeNull();
    expect(warnings).toEqual([]);
    expect(rows).toEqual([
      {
        name: "Ship it",
        status: "in-progress",
        priority: "high",
        dueAt: "2030-01-02",
        description: "a, b",
      },
      {
        name: "Plain",
        status: "todo",
        priority: "medium",
        dueAt: undefined,
        description: undefined,
      },
    ]);
  });

  it("falls back and warns on values it does not understand", () => {
    const { rows, warnings } = parseTaskCsv(
      "name,status,priority,due\nOdd,stuck,huge,tomorrow\n,todo,low,",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "todo", priority: "medium" });
    expect(warnings.join(" ")).toMatch(/status/);
    expect(warnings.join(" ")).toMatch(/priority/);
    expect(warnings.join(" ")).toMatch(/due date/);
    expect(warnings.join(" ")).toMatch(/Line 3: no name/);
  });

  it("explains an unusable file", () => {
    expect(parseTaskCsv("foo,bar\n1,2").error).toMatch(/Name/);
    expect(parseTaskCsv("name\n").error).toMatch(/no tasks/);
    expect(
      parseTaskCsv(
        `name\n${Array.from({ length: 201 }, (_, i) => `t${i}`).join("\n")}`,
      ).error,
    ).toMatch(/200/);
  });
});
