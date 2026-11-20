import { connect } from "node:net";

/**
 * Optional virus scanning of uploads with a self-hosted ClamAV daemon
 * (clamd). Set CLAMAV_ADDRESS to "host:port" (deploy/README.md) to turn it
 * on; unset, uploads are not scanned. Once it is on, an upload that cannot
 * be scanned is refused rather than stored unchecked.
 */
export type ScanResult = { clean: true } | { clean: false; signature: string };

export type ScannerAddress = { host: string; port: number };

const CHUNK = 64 * 1024;
const TIMEOUT_MS = 30_000;

export function scannerAddress(
  value = process.env.CLAMAV_ADDRESS,
): ScannerAddress | null {
  if (!value) return null;

  const at = value.lastIndexOf(":");
  const port = Number(value.slice(at + 1));

  if (at < 1 || !Number.isInteger(port) || port <= 0) {
    throw new Error("CLAMAV_ADDRESS must look like host:port.");
  }

  return { host: value.slice(0, at), port };
}

/** Streams the bytes to clamd (INSTREAM) and reads its verdict. */
export function scanBytes(
  bytes: Buffer,
  address: ScannerAddress,
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = connect(address.port, address.host);
    let reply = "";

    socket.setTimeout(TIMEOUT_MS, () =>
      socket.destroy(new Error("The virus scanner did not answer in time.")),
    );
    socket.on("error", reject);
    socket.on("data", (data) => {
      reply += data.toString("utf8");
      // clamd ends its one-line verdict with a NUL.
      if (reply.includes("\0")) socket.end();
    });
    socket.on("close", () => {
      const answer = reply.replace(/\0/g, "").trim();
      const found = /^stream: (.+) FOUND$/.exec(answer);

      if (answer === "stream: OK") resolve({ clean: true });
      else if (found) resolve({ clean: false, signature: found[1]! });
      else reject(new Error(`The virus scanner answered "${answer}".`));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");

      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        const chunk = bytes.subarray(offset, offset + CHUNK);
        const size = Buffer.alloc(4);

        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }

      socket.write(Buffer.alloc(4));
    });
  });
}

/** Null when scanning is off; otherwise clamd's verdict. Throws if it fails. */
export async function scanUpload(bytes: Buffer): Promise<ScanResult | null> {
  const address = scannerAddress();

  return address ? scanBytes(bytes, address) : null;
}
