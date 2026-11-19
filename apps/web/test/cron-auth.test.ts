import { beforeEach, describe, expect, it, vi } from "vitest";

const runChatJobs = vi.fn();
const maintenanceState = vi.fn();

vi.mock("@zentro/api/server", () => ({ runChatJobs, maintenanceState }));
vi.mock("@zentro/db", () => ({ db: {} }));

const { GET } = await import("../src/app/api/cron/chat/route");

const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/chat", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("GET /api/cron/chat", () => {
  beforeEach(() => {
    runChatJobs.mockReset().mockResolvedValue({ ran: true });
    maintenanceState.mockReset().mockResolvedValue({ enabled: false });
    process.env.CRON_SECRET = "s3cret-value";
  });

  it("refuses when no secret is configured", async () => {
    delete process.env.CRON_SECRET;

    expect((await call("Bearer undefined")).status).toBe(401);
    expect(runChatJobs).not.toHaveBeenCalled();
  });

  it("refuses a missing, wrong, shorter or longer token", async () => {
    for (const header of [
      undefined,
      "Bearer nope",
      "Bearer s3cret-valu",
      "Bearer s3cret-value-extra",
      "s3cret-value",
    ]) {
      expect((await call(header)).status).toBe(401);
    }

    expect(runChatJobs).not.toHaveBeenCalled();
  });

  it("runs the jobs for the right token", async () => {
    const response = await call("Bearer s3cret-value");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ran: true });
  });

  it("waits while the platform is in maintenance", async () => {
    maintenanceState.mockResolvedValue({ enabled: true, message: "" });

    const response = await call("Bearer s3cret-value");

    expect(response.status).toBe(503);
    expect(runChatJobs).not.toHaveBeenCalled();
  });
});
