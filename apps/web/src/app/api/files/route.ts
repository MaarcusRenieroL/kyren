import { appRouter } from "@zentro/api/server";
import { MAX_FILE_BYTES } from "@zentro/api/server";
import { TRPCError } from "@trpc/server";

import { createRequestContext } from "~/src/lib/request-context";
import { maintenanceResponse } from "~/src/lib/maintenance";
import { BodyTooLargeError, readLimited } from "~/src/lib/read-limited";
import { verifiedMimeType } from "~/src/lib/file-type";
import { newStorageKey, storage } from "~/src/lib/storage";

export const runtime = "nodejs";

// Only what a browser can show or a person would reasonably share; nothing
// is ever executed, and downloads are served with nosniff.
function imageSize(bytes: Buffer, mime: string) {
  try {
    if (mime === "image/png" && bytes.length > 24) {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }

    if (mime === "image/gif" && bytes.length > 10) {
      return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
    }

    if (mime === "image/jpeg") {
      let offset = 2;

      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) break;

        const marker = bytes[offset + 1]!;

        if (marker >= 0xc0 && marker <= 0xc3) {
          return {
            height: bytes.readUInt16BE(offset + 5),
            width: bytes.readUInt16BE(offset + 7),
          };
        }

        offset += 2 + bytes.readUInt16BE(offset + 2);
      }
    }
  } catch {
    // Layout hints are optional.
  }

  return { width: null, height: null };
}

export async function POST(request: Request) {
  const paused = await maintenanceResponse();

  if (paused) return paused;

  const ctx = await createRequestContext(request);
  const caller = appRouter.createCaller(ctx);
  const declared = Number(request.headers.get("content-length") ?? 0);

  // Refuse oversized bodies before they are buffered into memory.
  if (declared > MAX_FILE_BYTES + 1024 * 1024) {
    return Response.json(
      { error: "Files can be up to 25 MB." },
      { status: 413 },
    );
  }

  // Count the bytes as they arrive; the header above is only a hint.
  let form: FormData | null = null;

  try {
    const bytes = await readLimited(request, MAX_FILE_BYTES + 1024 * 1024);

    form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.from(bytes),
    })
      .formData()
      .catch(() => null);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return Response.json(
        { error: "Files can be up to 25 MB." },
        { status: 413 },
      );
    }

    throw error;
  }

  const file = form?.get("file");
  // The Files library has its own permission and does not need Chat.
  const library = form?.get("library") === "1";
  // A mail attachment needs the right to send mail, and stays out of Files.
  const mail = !library && form?.get("mail") === "1";
  const folder = form?.get("folderId");
  const folderId =
    library && typeof folder === "string" && folder ? folder : null;

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Choose a file to upload." },
      { status: 400 },
    );
  }

  try {
    await (library
      ? caller.files.libraryAuthorize({ size: file.size || 1 })
      : mail
        ? caller.files.mailAuthorize({ size: file.size || 1 })
        : caller.files.authorizeUpload({ size: file.size || 1 }));

    const bytes = Buffer.from(await file.arrayBuffer());

    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      return Response.json(
        { error: "Files can be up to 25 MB." },
        { status: 413 },
      );
    }

    // A claimed image or PDF must really be one before it is ever shown.
    const mimeType = verifiedMimeType(bytes, file.type);
    const key = newStorageKey(ctx.activeOrganization!.id, file.name);
    const { width, height } = imageSize(bytes, mimeType);

    await storage().put(key, bytes, mimeType);

    const register = library
      ? caller.files.libraryRegister
      : mail
        ? caller.files.mailRegister
        : caller.files.register;
    const saved = await register({
      name: file.name.slice(0, 255) || "file",
      mimeType,
      size: bytes.length,
      width,
      height,
      storageKey: key,
      folderId,
    }).catch(async (error: unknown) => {
      // Do not leave an unreferenced object behind.
      await storage()
        .remove(key)
        .catch(() => undefined);

      throw error;
    });

    return Response.json({
      id: saved.id,
      name: file.name,
      mimeType,
      size: bytes.length,
      width,
      height,
      url: `/api/files/${saved.id}`,
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      const status =
        error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "PAYLOAD_TOO_LARGE"
              ? 413
              : 400;

      return Response.json({ error: error.message }, { status });
    }

    console.error("File upload failed", error);

    return Response.json(
      { error: "Could not upload the file." },
      { status: 500 },
    );
  }
}
