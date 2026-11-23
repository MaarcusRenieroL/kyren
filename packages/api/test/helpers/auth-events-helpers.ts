import { randomUUID } from "node:crypto";
import { auth } from "@kyren/auth";
import { db } from "@kyren/db";
import { and, asc, eq, like } from "@kyren/db/drizzle";
import { activityEvents, members, users } from "@kyren/db/schema";
import { expect } from "vitest";

import { type TestOrg, type World } from "./world";

export const password = "A-long-enough-password-1";
export const baseUrl = "http://localhost:3000/api/auth";

export function clientHeaders(extra: Record<string, string> = {}) {
  return new Headers({
    "content-type": "application/json",
    origin: "http://localhost:3000",
    "x-forwarded-for": "198.51.100.23, 10.1.1.1",
    "user-agent": "AuthTest/2.0",
    ...extra,
  });
}

export async function call(
  path: string,
  body: unknown,
  headers = clientHeaders(),
  method = "POST",
) {
  return auth.handler(
    new Request(`${baseUrl}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
  );
}

export function cookieOf(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export async function eventsOf(org: TestOrg, prefix: string) {
  return db
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.organizationId, org.id),
        like(activityEvents.action, `${prefix}%`),
      ),
    )
    .orderBy(asc(activityEvents.createdAt));
}

/** A real account, created through sign-up, that belongs to `org`. */
export async function account(world: World, org: TestOrg) {
  const email = `auth-${randomUUID().slice(0, 8)}@example.test`;
  const response = await call("/sign-up/email", {
    email,
    password,
    name: "Auth Person",
  });

  expect(response.status).toBe(200);

  const [user] = await db.select().from(users).where(eq(users.email, email));

  world.trackUser(user!.id);
  await db
    .insert(members)
    .values({ organizationId: org.id, userId: user!.id, role: "member" });

  return { email, id: user!.id };
}
