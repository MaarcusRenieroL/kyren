import { auth, disabledOrganizationPaths } from "@zentro/auth";
import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { members, sessions } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { callAuth as call } from "./helpers/auth-call";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Endpoint = { path?: string; options?: { method?: string | string[] } };

const registered = Object.entries(auth.api as Record<string, Endpoint>).map(
  ([name, endpoint]) => ({ name, path: endpoint.path }),
);

const openOrganizationEndpoints: Record<string, string> = {
  "/organization/create":
    "Anyone verified may start their own organization and becomes its owner; nothing existing is touched.",
  "/organization/check-slug": "Reports whether a slug is free.",
  "/organization/list": "Lists only the caller's own organizations.",
  "/organization/set-active":
    "Better Auth requires the caller to be a member of the organization.",
  "/organization/accept-invitation":
    "Better Auth requires the invitation to be addressed to the caller's email.",
  "/organization/reject-invitation":
    "Better Auth requires the invitation to be addressed to the caller's email.",
  "/organization/leave":
    "Removes only the caller; the last owner cannot leave, and the access that came with the membership is cleared by an after-hook.",
};

const organizationRoutes = registered.filter((endpoint) =>
  endpoint.path?.startsWith("/organization/"),
);

describe("every organization endpoint is classified", () => {
  it("is disabled over HTTP or explicitly allowed", () => {
    for (const { name, path } of organizationRoutes) {
      const classified =
        disabledOrganizationPaths.includes(path!) ||
        path! in openOrganizationEndpoints;

      expect(classified, `${name} (${path}) is not classified`).toBe(true);
    }
  });

  it("keeps the allow list free of endpoints that no longer exist", () => {
    const paths = new Set(organizationRoutes.map((route) => route.path));

    for (const path of Object.keys(openOrganizationEndpoints)) {
      expect(paths.has(path), path).toBe(true);
    }
  });

  it("has no HTTP route for addMember or the other server-only calls", async () => {
    const serverOnly = registered
      .filter((endpoint) => endpoint.path === undefined)
      .map((endpoint) => endpoint.name)
      .sort();

    expect(serverOnly).toContain("addMember");

    const org = await world.org("Server only");
    const { user } = await world.userIn(org, "member");
    const other = await world.user("Not a member");
    const headers = await world.sessionHeaders(user, org);
    const response = await call(headers, "POST", "/organization/add-member", {
      userId: other.id,
      role: "owner",
      organizationId: org.id,
    });

    expect(response.status).toBe(404);
    expect(
      await db.select().from(members).where(eq(members.userId, other.id)),
    ).toHaveLength(0);
  });

  it("answers 404 for has-permission, whose answers ignore our permissions", async () => {
    const org = await world.org("Has permission");
    const { user } = await world.userIn(org, "member");
    const response = await call(
      await world.sessionHeaders(user, org),
      "POST",
      "/organization/has-permission",
      { permissions: { organization: ["delete"] } },
    );

    expect(response.status).toBe(404);
  });
});

describe("set-active, create and list", () => {
  let org: TestOrg;
  let foreign: TestOrg;
  let user: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    org = await world.org("Mine");
    foreign = await world.org("Not mine");
    user = (await world.userIn(org, "member")).user;
    outsider = (await world.userIn(foreign, "owner")).user;
  });

  it("refuses to activate an organization the user does not belong to", async () => {
    const headers = await world.sessionHeaders(user, org);
    const response = await call(headers, "POST", "/organization/set-active", {
      organizationId: foreign.id,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));

    expect(session?.activeOrganizationId).not.toBe(foreign.id);
  });

  it("activates one the user belongs to", async () => {
    const headers = await world.sessionHeaders(user);
    const response = await call(headers, "POST", "/organization/set-active", {
      organizationId: org.id,
    });

    expect(response.status).toBe(200);
  });

  it("does not let update-session point the session at another organization", async () => {
    const headers = await world.sessionHeaders(user, org);
    const response = await call(headers, "POST", "/update-session", {
      activeOrganizationId: foreign.id,
    });

    expect(response.status).toBe(404);

    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));

    expect(rows.every((row) => row.activeOrganizationId !== foreign.id)).toBe(
      true,
    );
  });

  it("lists only the caller's own organizations", async () => {
    const response = await call(
      await world.sessionHeaders(user, org),
      "GET",
      "/organization/list",
    );
    const body = (await response.json()) as Array<{ id: string }>;

    expect(body.map((item) => item.id)).toEqual([org.id]);
    expect(outsider.id).not.toBe(user.id);
  });

  it("creates an organization owned by the caller, ignoring a forged userId", async () => {
    const victim = await world.user("Victim");
    const headers = await world.sessionHeaders(user);
    const response = await call(headers, "POST", "/organization/create", {
      name: "Fresh start",
      slug: `fresh-${Math.random().toString(36).slice(2, 10)}`,
      userId: victim.id,
    });

    expect(response.status).toBe(200);

    const created = (await response.json()) as { id: string };

    world.trackOrg(created.id);

    const rows = await db
      .select()
      .from(members)
      .where(eq(members.organizationId, created.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: user.id, role: "owner" });
  });

  it("cannot create an organization on a slug that is taken", async () => {
    const response = await call(
      await world.sessionHeaders(user),
      "POST",
      "/organization/create",
      { name: "Takeover", slug: org.slug },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);

    const rows = await db
      .select()
      .from(members)
      .where(eq(members.organizationId, org.id));

    expect(rows.filter((row) => row.role === "owner")).toHaveLength(0);
  });
});
