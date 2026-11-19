import { describe, expect, it } from "vitest";

import { verifiedMimeType } from "../src/lib/file-type";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string"
        ? [...value].map((char) => char.charCodeAt(0))
        : [value],
    ),
  );

describe("verifiedMimeType", () => {
  it("keeps a claim the first bytes back up", () => {
    expect(
      verifiedMimeType(
        bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0),
        "image/png",
      ),
    ).toBe("image/png");
    expect(verifiedMimeType(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(
      "image/jpeg",
    );
    expect(verifiedMimeType(bytes("GIF89a"), "image/gif")).toBe("image/gif");
    expect(
      verifiedMimeType(bytes("RIFF", 0, 0, 0, 0, "WEBP"), "image/webp"),
    ).toBe("image/webp");
    expect(verifiedMimeType(bytes("%PDF-1.7"), "application/pdf")).toBe(
      "application/pdf",
    );
    expect(verifiedMimeType(bytes("hello"), "text/plain; charset=utf-8")).toBe(
      "text/plain",
    );
  });

  it("downloads anything dressed up as a type that would be shown in place", () => {
    // An HTML page claiming to be a PNG, and a binary claiming to be text.
    expect(verifiedMimeType(bytes("<html><script>"), "image/png")).toBe(
      "application/octet-stream",
    );
    expect(verifiedMimeType(bytes("MZ", 0, 0x90), "text/plain")).toBe(
      "application/octet-stream",
    );
    expect(verifiedMimeType(bytes("<svg"), "application/pdf")).toBe(
      "application/octet-stream",
    );
  });

  it("passes other types through, since they always download", () => {
    expect(verifiedMimeType(bytes("PK"), "application/zip")).toBe(
      "application/zip",
    );
    expect(verifiedMimeType(bytes("x"), "")).toBe("application/octet-stream");
    expect(verifiedMimeType(bytes("x"), "Image/SVG+XML")).toBe("image/svg+xml");
  });
});
