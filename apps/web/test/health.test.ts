import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@kyren/db", () => ({ db: { execute } }));
vi.mock("@kyren/db/drizzle", () => ({ sql: () => "select 1" }));

const { GET } = await import("../src/app/api/health/route");

describe("GET /api/health", () => {
  beforeEach(() => {
    execute.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("answers ok when the database responds", async () => {
    execute.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 without leaking the database error", async () => {
    execute.mockRejectedValue(new Error("password authentication failed"));

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toBe(JSON.stringify({ status: "unavailable" }));
    expect(text).not.toContain("password");
  });
});
