import { createServer, type AddressInfo, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { scanBytes, scannerAddress } from "../src/lib/virus-scan";

const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

// A stand-in for clamd: decodes INSTREAM chunks and flags the EICAR string.
function fakeClamd(reply?: string) {
  const received: Buffer[] = [];
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let headerSeen = false;

    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);

      if (!headerSeen) {
        const end = buffer.indexOf(0);

        if (end < 0) return;
        expect(buffer.subarray(0, end).toString()).toBe("zINSTREAM");
        buffer = buffer.subarray(end + 1);
        headerSeen = true;
      }

      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);

        if (size === 0) {
          const body = Buffer.concat(received).toString("latin1");

          socket.end(
            (reply ??
              (body.includes("EICAR-STANDARD")
                ? "stream: Eicar-Test-Signature FOUND"
                : "stream: OK")) + "\0",
          );

          return;
        }

        if (buffer.length < 4 + size) return;
        received.push(buffer.subarray(4, 4 + size));
        buffer = buffer.subarray(4 + size);
      }
    });
  });

  return new Promise<{ server: Server; port: number; received: Buffer[] }>(
    (resolve) =>
      server.listen(0, "127.0.0.1", () =>
        resolve({
          server,
          port: (server.address() as AddressInfo).port,
          received,
        }),
      ),
  );
}

let open: Server | null = null;

afterEach(() => {
  open?.close();
  open = null;
});

describe("virus scanning", () => {
  it("is off unless CLAMAV_ADDRESS is set, and rejects a malformed one", () => {
    expect(scannerAddress(undefined)).toBeNull();
    expect(scannerAddress("")).toBeNull();
    expect(scannerAddress("clamav:3310")).toEqual({
      host: "clamav",
      port: 3310,
    });
    expect(() => scannerAddress("clamav")).toThrow(/host:port/);
    expect(() => scannerAddress(":3310")).toThrow(/host:port/);
  });

  it("passes a clean file and streams every byte in chunks", async () => {
    const clamd = await fakeClamd();
    const bytes = Buffer.alloc(200_000, 7);

    open = clamd.server;

    await expect(
      scanBytes(bytes, { host: "127.0.0.1", port: clamd.port }),
    ).resolves.toEqual({ clean: true });
    expect(Buffer.concat(clamd.received).equals(bytes)).toBe(true);
    expect(clamd.received.length).toBeGreaterThan(1);
  });

  it("names the signature of an infected file", async () => {
    const clamd = await fakeClamd();

    open = clamd.server;

    await expect(
      scanBytes(Buffer.from(EICAR), { host: "127.0.0.1", port: clamd.port }),
    ).resolves.toEqual({ clean: false, signature: "Eicar-Test-Signature" });
  });

  it("fails, rather than passing the file, on an odd answer or no scanner", async () => {
    const clamd = await fakeClamd("INSTREAM size limit exceeded. ERROR");

    open = clamd.server;

    await expect(
      scanBytes(Buffer.from("hi"), { host: "127.0.0.1", port: clamd.port }),
    ).rejects.toThrow(/size limit/);

    await expect(
      scanBytes(Buffer.from("hi"), { host: "127.0.0.1", port: 1 }),
    ).rejects.toThrow();
  });
});
