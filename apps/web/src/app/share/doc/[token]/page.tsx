import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@zentro/db";
import { sharedDoc } from "@zentro/api/server";

// A private link: keep it out of search engines and out of Referer headers.
export const metadata: Metadata = {
  title: "Shared doc",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

/** A doc someone shared by link: read-only, already cleaned on the server. */
export default async function SharedDocPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const doc = await sharedDoc(db, token);

  if (!doc) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-line pb-6">
        <p className="text-sm text-ink-2">
          Shared from {doc.organization} · read-only · updated{" "}
          {doc.updatedAt.toLocaleDateString(undefined, { dateStyle: "medium" })}
        </p>
        <h1 className="text-3xl font-semibold text-ink">{doc.title}</h1>
      </header>
      <article
        className="docs-editor-content"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />
    </main>
  );
}
