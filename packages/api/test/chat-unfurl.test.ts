import { describe, expect, it } from "vitest";

import { isPrivateAddress, isSafeUrl } from "../src/server/chat-unfurl";

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
