import { hit, portalReply, portalView } from "@zentro/api/server";
import { db } from "@zentro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

async function limited(token: string, scope: string, max: number) {
  const result = await hit(db, `portal-${scope}:${token.slice(0, 16)}`, {
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

/** The requester's view of their ticket. Unknown links look the same as missing ones. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const blocked = await limited(token, "read", 60);

  if (blocked) return blocked;

  const view = await portalView(db, token);

  return view
    ? Response.json(view, { headers: noStore })
    : Response.json({ error: "Not found" }, { status: 404, headers: noStore });
}

/** The requester's answer. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const blocked = await limited(token, "write", 10);

  if (blocked) return blocked;

  const raw = await request.text();

  if (raw.length > 64 * 1024) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }

  let body = "";

  try {
    const parsed = JSON.parse(raw) as { body?: unknown };

    body = typeof parsed.body === "string" ? parsed.body : "";
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const result = await portalReply(
    db as unknown as Parameters<typeof portalReply>[0],
    token,
    body,
  );

  return result.ok
    ? Response.json({ ok: true }, { headers: noStore })
    : Response.json({ error: "Not found" }, { status: 404, headers: noStore });
}
