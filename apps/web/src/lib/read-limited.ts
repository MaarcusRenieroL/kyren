export class BodyTooLargeError extends Error {
  constructor() {
    super("The request body is too large.");
  }
}

/**
 * Reads a request body, giving up as soon as it passes `max` bytes. The
 * `Content-Length` header is not trusted: a client can lie about it or send
 * the body in chunks, so the bytes themselves are counted as they arrive.
 */
export async function readLimited(request: Request, max: number) {
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;

    size += value.length;

    if (size > max) {
      void reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
}
