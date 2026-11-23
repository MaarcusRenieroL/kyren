import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { enabled: false, message: "" };

vi.mock("@kyren/api/server", () => ({ maintenanceState: async () => state }));
vi.mock("@kyren/db", () => ({ db: {} }));

const { maintenanceResponse } = await import("../src/lib/maintenance");

describe("maintenance response for routes that accept changes", () => {
  beforeEach(() => {
    state.enabled = false;
    state.message = "";
  });

  it("lets requests through when maintenance is off", async () => {
    await expect(maintenanceResponse()).resolves.toBeNull();
  });

  it("answers 503 with a retry hint and the operator's message when on", async () => {
    state.enabled = true;
    state.message = "Back at noon";

    const response = await maintenanceResponse();

    expect(response?.status).toBe(503);
    expect(response?.headers.get("retry-after")).toBe("300");
    await expect(response?.json()).resolves.toEqual({ error: "Back at noon" });
  });

  it("falls back to a plain message when none was set", async () => {
    state.enabled = true;

    const body = await (await maintenanceResponse())?.json();

    expect(body.error).toMatch(/maintenance/i);
  });
});
