import { describe, expect, it } from "vitest";

import {
  dueFromDateInput,
  getDateInputValue,
} from "../src/features/tasks/components/task-detail/task-detail-utils";

describe("due dates picked in a date input", () => {
  it("mean the end of that day in the viewer's own time", () => {
    const due = dueFromDateInput("2030-06-20")!;

    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([
      2030, 5, 20,
    ]);
    expect([due.getHours(), due.getMinutes()]).toEqual([23, 59]);
  });

  it("show the same local day back in the input", () => {
    expect(getDateInputValue(dueFromDateInput("2030-06-20"))).toBe(
      "2030-06-20",
    );
    expect(getDateInputValue(null)).toBe("");
  });

  it("refuse a malformed value instead of guessing", () => {
    expect(dueFromDateInput("")).toBeNull();
    expect(dueFromDateInput("June 20")).toBeNull();
  });
});
