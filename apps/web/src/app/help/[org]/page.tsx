import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publicArticles } from "@zentro/api/server";
import { db } from "@zentro/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Help centre" };

export default async function HelpCentre({
  params,
}: Readonly<{ params: Promise<{ org: string }> }>) {
  const { org } = await params;
  const articles = await publicArticles(db, org);

  if (!articles) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink">Help centre</h1>
      {articles.length === 0 ? (
        <p className="mt-6 text-sm text-ink-2">No articles yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/help/${org}/${article.slug}`}
                className="block px-4 py-3 text-sm text-ink hover:bg-sunken"
              >
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
