import { afterAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { docs, organizations } from "@kyren/db/schema";

import { sharedDoc } from "../src/server/doc-share";
import { forgetOrganizationStatus } from "../src/server/platform-policy";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("sharing a doc by link", () => {
  it("shows a cleaned, read-only copy to anyone with the link while it is on", async () => {
    const org = await world.org("Doc share");
    const o = await world.userIn(org, "owner", "Share Owner");
    const owner = await world.caller(o.user, org);
    const doc = await world.doc(org, {
      title: "Launch plan",
      content:
        '<h2>Plan</h2><p onclick="steal()">Ship it</p><script>steal()</script>' +
        "<table><tbody><tr><td>Q1</td><td>Beta</td></tr></tbody></table>",
    });

    expect(await owner.docs.shareLink({ id: doc.id })).toEqual({
      shared: false,
      canManage: true,
      token: null,
    });

    const { token } = await owner.docs.setShare({ id: doc.id, enabled: true });
    const page = await sharedDoc(db, token!);

    expect(page).toMatchObject({
      title: "Launch plan",
      organization: org.name,
    });
    expect(page!.html).toContain("<h2>Plan</h2>");
    expect(page!.html).toContain("<td>Beta</td>");
    expect(page!.html).not.toContain("script");
    expect(page!.html).not.toContain("onclick");

    // Turning it on again keeps the link; off kills it; on again is a new one.
    expect(
      (await owner.docs.setShare({ id: doc.id, enabled: true })).token,
    ).toBe(token);
    await owner.docs.setShare({ id: doc.id, enabled: false });
    expect(await sharedDoc(db, token!)).toBeNull();

    const { token: fresh } = await owner.docs.setShare({
      id: doc.id,
      enabled: true,
    });

    expect(fresh).not.toBe(token);
    expect(await sharedDoc(db, token!)).toBeNull();
    expect(await sharedDoc(db, fresh!)).not.toBeNull();
    expect(await sharedDoc(db, "not a token")).toBeNull();
  });

  it("goes dark when the doc is trashed, Docs is off, or the organization is suspended", async () => {
    const org = await world.org("Doc share dark");
    const owner = await world.caller(
      (await world.userIn(org, "owner", "Dark Owner")).user,
      org,
    );
    const doc = await world.doc(org, { content: "<p>Hi</p>" });
    const { token } = await owner.docs.setShare({ id: doc.id, enabled: true });

    await world.setModule(org, "docs", false);
    expect(await sharedDoc(db, token!)).toBeNull();
    await world.setModule(org, "docs", true);

    await db
      .update(organizations)
      .set({ suspendedAt: new Date() })
      .where(eq(organizations.id, org.id));
    forgetOrganizationStatus(org.id);
    expect(await sharedDoc(db, token!)).toBeNull();
    await db
      .update(organizations)
      .set({ suspendedAt: null })
      .where(eq(organizations.id, org.id));
    forgetOrganizationStatus(org.id);

    expect(await sharedDoc(db, token!)).not.toBeNull();
    await db
      .update(docs)
      .set({ deletedAt: new Date() })
      .where(eq(docs.id, doc.id));
    expect(await sharedDoc(db, token!)).toBeNull();
  });

  it("is managed only by people who may edit the doc, in its own organization", async () => {
    const org = await world.org("Doc share rights");
    const o = await world.userIn(org, "owner", "Rights Owner");
    const m = await world.userIn(org, "member", "Reader");
    const owner = await world.caller(o.user, org);
    const doc = await world.doc(org, { content: "<p>Notes</p>" });

    await owner.docs.setShare({ id: doc.id, enabled: true });
    await world.override(org, m.user, "docs.update_own", "deny");
    await world.override(org, m.user, "docs.update_any", "deny");

    const reader = await world.caller(m.user, org);

    // They can see it is shared, but not the link, and can't change it.
    expect(await reader.docs.shareLink({ id: doc.id })).toEqual({
      shared: true,
      canManage: false,
      token: null,
    });
    await expect(
      reader.docs.setShare({ id: doc.id, enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const other = await world.org("Doc share elsewhere");
    const stranger = await world.caller(
      (await world.userIn(other, "owner", "Stranger")).user,
      other,
    );

    await expect(
      stranger.docs.setShare({ id: doc.id, enabled: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
