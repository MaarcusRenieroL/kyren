import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportError, resetErrorThrottle } from "../src/server/error-report";

describe("error reporting", () => {
  const fetchMock = vi.fn(async () => new Response("ok"));

  beforeEach(() => {
    resetErrorThrottle();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs the error and posts it to the webhook when one is set", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/errors");
    await reportError("jobs", new Error("disk full"), { kind: "mail" });

    expect(console.error).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(url).toBe("https://hooks.example/errors");
    expect(String(init.body)).toContain("disk full");
    expect(String(init.body)).toContain("jobs");
  });

  it("only logs when no webhook is set", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "");
    await reportError("jobs", new Error("x"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the same error at most once a minute", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/errors");
    await reportError("jobs", new Error("same"));
    await reportError("jobs", new Error("same"));
    await reportError("jobs", new Error("different"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never throws, even when the webhook is down, and keeps secrets out", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/errors");
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(
      reportError("jobs", new Error("token=abc123secret"), {
        password: "hunter2",
      }),
    ).resolves.toBeUndefined();

    fetchMock.mockClear();
    resetErrorThrottle();
    await reportError("jobs", new Error("boom"), { password: "hunter2" });
    expect(
      String(
        (fetchMock.mock.calls[0] as unknown[])[1]
          ? ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body
          : "",
      ),
    ).not.toContain("hunter2");
  });
});
