import { clientIpFrom } from "@kyren/audit/server";
import { hit, publicForm, submitIntake } from "@kyren/api/server";
import { maintenanceResponse } from "~/src/lib/maintenance";
import { db } from "@kyren/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

async function limited(request: Request, token: string, max: number) {
  const ip = clientIpFrom(request.headers) ?? "unknown";
  const result = await hit(db, `intake:${token.slice(0, 16)}:${ip}`, {
    max,
    windowMs: 60_000,
  });

  return result.allowed
    ? null
    : Response.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            ...noStore,
            "retry-after": String(result.retryAfterSeconds),
          },
        },
      );
}

/** The form's questions. Unknown, switched-off and malformed links all look the same. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const blocked = await limited(request, token, 60);

  if (blocked) return blocked;

  const form = await publicForm(db, token);

  return form
    ? Response.json(form, { headers: noStore })
    : Response.json({ error: "Not found" }, { status: 404, headers: noStore });
}

/** A submission: `{ answers: { f1: "…" }, website: "" }`. `website` is a trap for bots. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const paused = await maintenanceResponse();

  if (paused) return paused;
  const blocked = await limited(request, token, 10);

  if (blocked) return blocked;

  const raw = await request.text();

  if (raw.length > 64 * 1024) {
    return Response.json(
      { error: "Too large" },
      { status: 413, headers: noStore },
    );
  }

  let body: { answers?: unknown; website?: unknown };

  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return Response.json(
      { error: "Expected JSON" },
      { status: 400, headers: noStore },
    );
  }

  // Real people never see or fill this field; bots fill every field.
  if (typeof body.website === "string" && body.website.trim()) {
    return Response.json({ ok: true, ref: "SUP-0" }, { headers: noStore });
  }

  const answers =
    body.answers &&
    typeof body.answers === "object" &&
    !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : {};
  const result = await submitIntake(
    db as unknown as Parameters<typeof submitIntake>[0],
    token,
    answers,
  );

  if (result.ok) return Response.json(result, { headers: noStore });

  return Response.json(result, {
    status: result.errors.form ? 404 : 422,
    headers: noStore,
  });
}
