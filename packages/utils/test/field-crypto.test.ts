import { afterEach, describe, expect, it } from "vitest";

import { decryptField, encryptField } from "../src/field-crypto";

const keyA = Buffer.alloc(32, 1).toString("base64");
const keyB = Buffer.alloc(32, 2).toString("base64");

afterEach(() => {
  delete process.env.FIELD_ENCRYPTION_KEY;
});

describe("encrypting a sensitive field", () => {
  it("round-trips, never stores the text, and differs every time", () => {
    process.env.FIELD_ENCRYPTION_KEY = keyA;

    const first = encryptField("Chemotherapy appointment");
    const second = encryptField("Chemotherapy appointment");

    expect(first).toMatch(/^enc:v1:/);
    expect(first).not.toContain("Chemotherapy");
    expect(first).not.toBe(second);
    expect(decryptField(first)).toBe("Chemotherapy appointment");
  });

  it("passes null through and still reads text saved before encryption existed", () => {
    process.env.FIELD_ENCRYPTION_KEY = keyA;

    expect(encryptField(null)).toBeNull();
    expect(decryptField(null)).toBeNull();
    expect(decryptField("an old plain note")).toBe("an old plain note");
  });

  it("refuses a tampered value or the wrong key instead of returning garbage", () => {
    process.env.FIELD_ENCRYPTION_KEY = keyA;

    const stored = encryptField("private")!;
    const bytes = Buffer.from(stored.slice("enc:v1:".length), "base64");

    // Flip one bit of the ciphertext itself.
    bytes[bytes.length - 1] = bytes.at(-1)! ^ 1;

    const tampered = `enc:v1:${bytes.toString("base64")}`;

    expect(() => decryptField(tampered)).toThrow();

    process.env.FIELD_ENCRYPTION_KEY = keyB;
    expect(() => decryptField(stored)).toThrow();
  });

  it("stores plain text when no key is set, but cannot read encrypted text without one", () => {
    process.env.FIELD_ENCRYPTION_KEY = keyA;

    const stored = encryptField("secret")!;

    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(encryptField("plain")).toBe("plain");
    expect(() => decryptField(stored)).toThrow(/key/i);
  });

  it("rejects a key of the wrong size", () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(8).toString("base64");

    expect(() => encryptField("x")).toThrow(/32 bytes/);
  });
});
