import {
  apiKeyCaller,
  authenticateApiKey,
  bearerToken,
} from "@kyren/api/server";
import { db } from "@kyren/db";
import { hit } from "@kyren/db/rate-limit";
import { TRPCError } from "@trpc/server";

// Read-only public API. Each key acts as the person who made it.
const readers = {
  tasks: (caller: NonNullable<Awaited<ReturnType<typeof apiKeyCaller>>>) =>
    caller.task.getTasksByOrgId({}),
  projects: (caller: NonNullable<Awaited<ReturnType<typeof apiKeyCaller>>>) =>
    caller.project.getProjectsByOrgId(),
} as const;

const json = (body: unknown, status: number, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const token = bearerToken(request.headers);
  const owner = token ? await authenticateApiKey(db, token) : null;

  if (!owner) {
    return json({ error: "Invalid or missing API key." }, 401, {
      "WWW-Authenticate": "Bearer",
    });
  }

  const limit = await hit(db, `api-key:${owner.keyId}`, {
    max: 120,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return json({ error: "Too many requests." }, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  if (!(resource in readers)) {
    return json({ error: "Unknown resource." }, 404);
  }

  const caller = await apiKeyCaller(owner, request.headers);

  if (!caller) return json({ error: "Invalid or missing API key." }, 401);

  try {
    const data = await readers[resource as keyof typeof readers](caller);

    return json({ data }, 200);
  } catch (error) {
    if (error instanceof TRPCError) {
      const status = error.code === "FORBIDDEN" ? 403 : 400;

      return json({ error: error.message }, status);
    }

    console.error("API request failed", error);

    return json({ error: "Something went wrong." }, 500);
  }
}
