import Link from "next/link";
import { notFound } from "next/navigation";

import { publicArticle } from "@zentro/api/server";
import { db } from "@zentro/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<{ org: string; slug: string }> }>) {
  const { org, slug } = await params;
  const article = await publicArticle(db, org, slug);

  return { title: article?.title ?? "Help centre" };
}

export default async function HelpArticle({
  params,
}: Readonly<{ params: Promise<{ org: string; slug: string }> }>) {
  const { org, slug } = await params;
  const article = await publicArticle(db, org, slug);

  if (!article) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/help/${org}`} className="text-sm text-ink-2 underline">
        {article.organization} help centre
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink">{article.title}</h1>
      {/* Plain text, escaped by React; line breaks are kept. */}
      <div className="mt-6 whitespace-pre-wrap text-sm leading-6 text-ink">
        {article.body}
      </div>
    </main>
  );
}
