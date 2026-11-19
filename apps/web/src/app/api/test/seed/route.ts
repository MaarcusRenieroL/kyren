import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { auth } from "@zentro/auth";
import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { users } from "@zentro/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const seedPassword = "E2e-pass-12345";

function notFound() {
  return new Response(null, { status: 404 });
}

/** Compares in constant time so the secret can't be guessed byte by byte. */
function sameSecret(given: string | null, secret: string) {
  const expected = Buffer.from(secret);
  const actual = Buffer.from(given ?? "");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createVerifiedUser(label: string, tag: string) {
  const email = `${label}-${tag}@example.test`;
  const name = `${label} ${tag}`;
  const { user } = await auth.api.signUpEmail({
    body: { name, email, password: seedPassword },
  });

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, user.id));

  return { id: user.id, email, name, password: seedPassword };
}

/**
 * Test-only seed for the E2E suite: a verified owner, a verified member and
 * an organization with its system roles. Answers 404 unless `E2E_SEED_SECRET`
 * is set and sent in `x-seed-secret`, and always on a production deployment.
 * The E2E server is a production build (`next start`), so NODE_ENV cannot be
 * the gate; the deployment environment is.
 */
export async function POST(request: Request) {
  const secret = process.env.E2E_SEED_SECRET;

  if (
    !secret ||
    process.env.VERCEL_ENV === "production" ||
    !sameSecret(request.headers.get("x-seed-secret"), secret)
  ) {
    return notFound();
  }

  const tag = randomUUID().slice(0, 8);
  const owner = await createVerifiedUser("owner", tag);
  const member = await createVerifiedUser("member", tag);
  const slug = `e2e-${tag}-${randomBytes(2).toString("hex")}`;
  const organization = await auth.api.createOrganization({
    body: { name: `E2E Org ${tag}`, slug, userId: owner.id },
  });

  await auth.api.addMember({
    body: {
      userId: member.id,
      organizationId: organization.id,
      role: "member",
    },
  });

  return Response.json(
    { orgId: organization.id, slug, owner, member },
    { headers: { "Cache-Control": "no-store" } },
  );
}
