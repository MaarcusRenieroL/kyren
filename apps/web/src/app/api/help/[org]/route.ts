import { hit, publicArticle, publicArticles } from "@zentro/api/server";
import { db } from "@zentro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The public help centre as JSON: the list, or one article with `?slug=`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org } = await params;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await hit(db, `help:${ip}`, { max: 120, windowMs: 60_000 });

  if (!limit.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const slug = new URL(request.url).searchParams.get("slug");
  const found = slug
    ? await publicArticle(db, org, slug)
    : await publicArticles(db, org);

  return found
    ? Response.json(found)
    : Response.json({ error: "Not found" }, { status: 404 });
}
