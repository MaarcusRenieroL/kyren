import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@kyren/db", () => ({ db: { execute } }));
vi.mock("@kyren/db/drizzle", () => ({ sql: () => "select" }));

const { GET } = await import("../src/app/api/health/deep/route");

const ask = (authorization?: string) =>
  GET(
    new Request("http://local/api/health/deep", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("GET /api/health/deep", () => {
  beforeEach(() => {
    execute.mockReset();
    process.env.CRON_SECRET = "monitor-secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("is hidden from anyone without the cron secret", async () => {
    expect((await ask()).status).toBe(404);
    expect((await ask("Bearer wrong")).status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
  });

  it("reports stuck and failed background jobs", async () => {
    execute.mockResolvedValue({ rows: [{ stuck: 2, dead: 1 }] });

    const response = await ask("Bearer monitor-secret");

    expect(await response.json()).toEqual({
      status: "degraded",
      database: "ok",
      jobs: { stuck: 2, dead: 1 },
    });
  });

  it("says the database is down without its error text", async () => {
    execute.mockRejectedValue(new Error("password authentication failed"));

    const response = await ask("Bearer monitor-secret");

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("password");
  });
});
