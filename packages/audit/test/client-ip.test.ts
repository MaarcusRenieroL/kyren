import { afterEach, describe, expect, it } from "vitest";

import { clientIpFrom, clientIpHeaders } from "../src/server";

const headers = (values: Record<string, string>) => new Headers(values);

describe("client address", () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADERS;
  });

  it("reads the platform headers in order by default", () => {
    expect(
      clientIpFrom(
        headers({
          "x-vercel-forwarded-for": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1, 10.0.0.1",
        }),
      ),
    ).toBe("203.0.113.7");
    expect(
      clientIpFrom(headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })),
    ).toBe("198.51.100.1");
    expect(clientIpFrom(headers({}))).toBeNull();
  });

  it("behind your own proxy, trusts only the header it is told to", () => {
    process.env.CLIENT_IP_HEADERS = "X-Real-IP";

    expect(clientIpHeaders()).toEqual(["x-real-ip"]);
    // A client sending its own forwarding headers changes nothing.
    expect(
      clientIpFrom(
        headers({
          "x-vercel-forwarded-for": "1.1.1.1",
          "x-forwarded-for": "2.2.2.2",
          "x-real-ip": "203.0.113.9",
        }),
      ),
    ).toBe("203.0.113.9");
    expect(clientIpFrom(headers({ "x-forwarded-for": "2.2.2.2" }))).toBeNull();
  });
});
