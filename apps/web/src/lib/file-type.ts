/** Types the browser is allowed to show in place; everything else downloads. */
export const INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

const starts = (bytes: Uint8Array, signature: number[], at = 0) =>
  signature.every((byte, index) => bytes[at + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** Whether the first bytes are what a file of this inline type begins with. */
const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) =>
    starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (b) => starts(b, [0xff, 0xd8, 0xff]),
  "image/gif": (b) => starts(b, ascii("GIF87a")) || starts(b, ascii("GIF89a")),
  "image/webp": (b) => starts(b, ascii("RIFF")) && starts(b, ascii("WEBP"), 8),
  "application/pdf": (b) => starts(b, ascii("%PDF-")),
  // Text has no NUL bytes; a binary renamed .txt does.
  "text/plain": (b) => !b.subarray(0, 8192).includes(0),
};

/**
 * The type to store for an upload. The browser's claim is trusted only as far
 * as it is harmless: a type that would be shown in place must match the
 * file's first bytes, or it is stored as plain binary and downloads instead.
 */
export function verifiedMimeType(bytes: Uint8Array, claimed: string) {
  const type = claimed.split(";")[0]!.trim().toLowerCase();

  if (!type) return "application/octet-stream";

  const matches = signatures[type];

  if (matches && !matches(bytes)) return "application/octet-stream";

  return type;
}
