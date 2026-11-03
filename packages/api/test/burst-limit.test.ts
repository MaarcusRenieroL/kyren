import { afterEach, describe, expect, it } from "vitest";
import { enforceBurstLimit, resetBurstLimits } from "../src/server/burst-limit";

describe("burst limit", () => {
  afterEach(() => {
    delete process.env.API_MUTATIONS_PER_MINUTE;
    delete process.env.API_QUERIES_PER_MINUTE;
    resetBurstLimits();
  });

  it("refuses calls past the per-minute ceiling for one user only", () => {
    process.env.API_MUTATIONS_PER_MINUTE = "3";
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) enforceBurstLimit("a", "mutation", now);

    expect(() => enforceBurstLimit("a", "mutation", now)).toThrow(
      /Too many requests/,
    );
    expect(() => enforceBurstLimit("b", "mutation", now)).not.toThrow();
  });

  it("counts queries and mutations separately and resets after a minute", () => {
    process.env.API_MUTATIONS_PER_MINUTE = "1";
    process.env.API_QUERIES_PER_MINUTE = "1";
    const now = 2_000_000;

    enforceBurstLimit("a", "mutation", now);
    enforceBurstLimit("a", "query", now);
    expect(() => enforceBurstLimit("a", "query", now)).toThrow();
    expect(() => enforceBurstLimit("a", "query", now + 61_000)).not.toThrow();
  });
});
