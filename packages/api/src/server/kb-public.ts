import { and, asc, desc, eq, isNull } from "@zentro/db/drizzle";
import { kbArticles, organizations } from "@zentro/db/schema";

import type { db as database } from "@zentro/db";

import { ticketsOpenToPublic } from "./tickets-public";

type Db = typeof database;

const live = (organizationId: string) =>
  and(
    eq(kbArticles.organizationId, organizationId),
    eq(kbArticles.status, "published"),
    eq(kbArticles.audience, "public"),
    isNull(kbArticles.deletedAt),
  );

const organizationBySlug = async (db: Db, slug: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return null;

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org || !(await ticketsOpenToPublic(db, org.id))) return null;

  return org;
};

/** The titles of an organization's public help centre, or null if there is no such organization. */
export async function publicArticles(db: Db, orgSlug: string) {
  const org = await organizationBySlug(db, orgSlug);

  if (!org) return null;

  return db
    .select({
      slug: kbArticles.slug,
      title: kbArticles.title,
      updatedAt: kbArticles.updatedAt,
    })
    .from(kbArticles)
    .where(live(org.id))
    .orderBy(asc(kbArticles.title));
}

/** One published public article, or null. Drafts and internal articles never come back. */
export async function publicArticle(db: Db, orgSlug: string, slug: string) {
  const org = await organizationBySlug(db, orgSlug);

  if (!org) return null;

  const [article] = await db
    .select({
      slug: kbArticles.slug,
      title: kbArticles.title,
      body: kbArticles.body,
      updatedAt: kbArticles.updatedAt,
    })
    .from(kbArticles)
    .where(and(live(org.id), eq(kbArticles.slug, slug)))
    .orderBy(desc(kbArticles.updatedAt))
    .limit(1);

  return article ? { ...article, organization: org.name } : null;
}
