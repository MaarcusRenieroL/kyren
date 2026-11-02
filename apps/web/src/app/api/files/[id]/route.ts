import { TRPCError } from "@trpc/server";
import { appRouter } from "@zentro/api/server";
import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { files } from "@zentro/db/schema";

import { createRequestContext } from "~/src/lib/request-context";
import { storage } from "~/src/lib/storage";

export const runtime = "nodejs";

// Shown inline; everything else (SVG, HTML, unknown) downloads instead.
const inline = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await createRequestContext(request);

  if (!ctx.user) return new Response("Not signed in", { status: 401 });

  try {
    // The caller can open it only when this resolves.
    await appRouter.createCaller(ctx).files.get({ id });
  } catch (error) {
    // Hide files the caller may not see; surface real faults as errors.
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      return new Response("Not found", { status: 404 });
    }

    console.error("File lookup failed", { id, error });

    return new Response("Could not open the file", { status: 500 });
  }

  const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  const object = file ? await storage().get(file.storageKey) : null;

  if (!file || !object) return new Response("Not found", { status: 404 });

  const asInline = inline.has(file.mimeType);

  return new Response(new Uint8Array(object.body), {
    headers: {
      "Content-Type": asInline ? file.mimeType : "application/octet-stream",
      "Content-Length": String(object.body.length),
      "Content-Disposition": `${asInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
