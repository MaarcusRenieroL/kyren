import { describe, expect, it } from "vitest";

import { readLimited, BodyTooLargeError } from "../src/lib/read-limited";

const request = (body: BodyInit, headers: HeadersInit = {}) =>
  new Request("http://localhost/api/files", {
    method: "POST",
    body,
    headers,
  });

describe("readLimited", () => {
  it("returns the body when it fits", async () => {
    const bytes = await readLimited(request("hello"), 100);

    expect(Buffer.from(bytes).toString()).toBe("hello");
  });

  it("stops reading once the limit is passed, whatever the header says", async () => {
    // The declared length lies; the real body is larger than the limit.
    await expect(
      readLimited(request("x".repeat(500), { "content-length": "5" }), 100),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("refuses a body with no size at all when asked to", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(50));
        controller.enqueue(new Uint8Array(80));
        controller.close();
      },
    });
    const chunked = new Request("http://localhost/api/files", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);

    await expect(readLimited(chunked, 100)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it("returns an empty body for a request without one", async () => {
    const bytes = await readLimited(
      new Request("http://localhost/api/files", { method: "POST" }),
      100,
    );

    expect(bytes.length).toBe(0);
  });
});
