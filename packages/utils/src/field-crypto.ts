import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field-level encryption for text a database leak must not reveal, such as the
 * private reason on a leave request. AES-256-GCM, a fresh random nonce per
 * value, and the tag makes any change to the stored text fail loudly.
 *
 * The key is FIELD_ENCRYPTION_KEY: 32 random bytes, base64 (for example
 * `openssl rand -base64 32`). Without it values are stored as plain text so
 * development works; values already encrypted can then no longer be read.
 * Server only (uses node:crypto), so it is not exported from the package index.
 */
const PREFIX = "enc:v1:";

function key() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;

  if (!raw) return null;

  const bytes = Buffer.from(raw, "base64");

  if (bytes.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return bytes;
}

export function encryptField(value: string | null) {
  if (value === null) return null;

  const secret = key();

  if (!secret) return value;

  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, nonce);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return `${PREFIX}${Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64")}`;
}

/** Text saved before encryption was switched on is returned as it is. */
export function decryptField(stored: string | null) {
  if (stored === null || !stored.startsWith(PREFIX)) return stored;

  const secret = key();

  if (!secret) {
    throw new Error(
      "This value is encrypted, but FIELD_ENCRYPTION_KEY is not set.",
    );
  }

  const bytes = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret,
    bytes.subarray(0, 12),
  );

  decipher.setAuthTag(bytes.subarray(12, 28));

  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
