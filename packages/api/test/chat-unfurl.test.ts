import { describe, expect, it, vi } from "vitest";

import {
  isPrivateAddress,
  isSafeUrl,
  safeLookup,
} from "../src/server/chat-unfurl";

const resolved = vi.hoisted(() => ({ addresses: [] as string[] }));

vi.mock("node:dns", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:dns")>();
  const mocked = {
    ...original,
    lookup: (
      _host: string,
      _options: unknown,
      callback: (
        error: null,
        addresses: Array<{ address: string; family: number }>,
      ) => void,
    ) =>
      callback(
        null,
        resolved.addresses.map((address) => ({
          address,
          family: address.includes(":") ? 6 : 4,
        })),
      ),
  };

  return { ...mocked, default: mocked };
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.8.8.8",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "192.0.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "0:0:0:0:0:0:0:1",
    "fe80::1",
    "fd12:3456::1",
    "fc00::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a00:1",
    "::ffff:169.254.169.254",
    // Tunnels and translators that carry an IPv4 address inside an IPv6 one.
    "64:ff9b::a9fe:a9fe",
    "64:ff9b::7f00:1",
    "2002:7f00:1::1",
    "2002:a9fe:a9fe::1",
    "2001::1",
  ])("blocks %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "100.63.0.1",
    "93.184.216.34",
    "2606:4700:4700::1111",
  ])("allows %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("isSafeUrl", () => {
  it.each([
    "http://localhost/",
    "http://app.localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[0:0:0:0:0:0:0:1]/",
    "http://169.254.169.254/latest/meta-data",
    "http://2130706433/",
    "http://0x7f.1/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "http://user:pw@8.8.8.8/",
    "http://8.8.8.8:8080/",
    "not a url",
  ])("rejects %s", async (url) => {
    expect(await isSafeUrl(url)).toBe(false);
  });

  it("accepts a public address", async () => {
    expect(await isSafeUrl("https://8.8.8.8/")).toBe(true);
  });
});

describe("safeLookup", () => {
  const run = (addresses: string[]) =>
    new Promise<{ error: Error | null; result: unknown }>((resolve) => {
      resolved.addresses = addresses;
      safeLookup("example.test", { all: true }, (error, result) =>
        resolve({ error, result }),
      );
    });

  it("passes public addresses through", async () => {
    const { error, result } = await run(["93.184.216.34"]);

    expect(error).toBeNull();
    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("refuses the connection when any answer is private, at connect time", async () => {
    // A name that answered publicly during the check can answer privately now.
    for (const addresses of [
      ["169.254.169.254"],
      ["93.184.216.34", "10.0.0.5"],
      ["::ffff:127.0.0.1"],
    ]) {
      const { error } = await run(addresses);

      expect(error?.message).toMatch(/not allowed/i);
    }
  });
});
