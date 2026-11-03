import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  isBreachedPassword,
  passwordFieldFor,
} from "../src/lib/breached-password";

function rangeFor(password: string, count: number) {
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  return {
    prefix: sha.slice(0, 5),
    body: `${sha.slice(5)}:${count}\r\nAAAAA:2`,
  };
}

describe("isBreachedPassword", () => {
  it("is true when the hash suffix is in the range response", async () => {
    const { prefix, body } = rangeFor("Password123", 9000);
    const fetcher = vi.fn(async (url: string) => {
      expect(url.endsWith(`/range/${prefix}`)).toBe(true);
      return new Response(body);
    });

    expect(await isBreachedPassword("Password123", fetcher)).toBe(true);
  });

  it("sends only the first five hash characters", async () => {
    const fetcher = vi.fn(async () => new Response("AAAAA:1"));

    await isBreachedPassword("a-long-unique-phrase-4812", fetcher);

    const url = String(fetcher.mock.calls[0]?.[0]);
    expect(url).not.toContain("a-long-unique-phrase");
    expect(url.split("/range/")[1]).toHaveLength(5);
  });

  it("is false for padding-only matches and unseen passwords", async () => {
    const { prefix } = rangeFor("zq-unseen-91", 0);
    const fetcher = vi.fn(async () => new Response(`ABCDE:0\r\n${prefix}:3`));

    expect(await isBreachedPassword("zq-unseen-91", fetcher)).toBe(false);
  });

  it("lets the user through when the service is down", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });

    expect(await isBreachedPassword("anything", fetcher)).toBe(false);
  });
});

describe("passwordFieldFor", () => {
  it("names the field each password endpoint carries", () => {
    expect(passwordFieldFor("/sign-up/email")).toBe("password");
    expect(passwordFieldFor("/change-password")).toBe("newPassword");
    expect(passwordFieldFor("/reset-password")).toBe("newPassword");
    expect(passwordFieldFor("/sign-in/email")).toBeNull();
  });
});
