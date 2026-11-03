import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { forgetIpPolicy, ipMatches } from "../src/server/ip-policy";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("matching an address against a range", () => {
  it("handles IPv4 ranges, single addresses and IPv4-mapped IPv6", () => {
    expect(ipMatches("203.0.113.9", "203.0.113.0/24")).toBe(true);
    expect(ipMatches("203.0.114.9", "203.0.113.0/24")).toBe(false);
    expect(ipMatches("198.51.100.7", "198.51.100.7")).toBe(true);
    expect(ipMatches("198.51.100.8", "198.51.100.7/32")).toBe(false);
    expect(ipMatches("::ffff:203.0.113.9", "203.0.113.0/24")).toBe(true);
    expect(ipMatches("10.1.2.3", "0.0.0.0/0")).toBe(true);
  });

  it("handles IPv6 ranges and refuses nonsense", () => {
    expect(ipMatches("2001:db8::1", "2001:db8::/32")).toBe(true);
    expect(ipMatches("2001:db9::1", "2001:db8::/32")).toBe(false);
    expect(ipMatches("not-an-ip", "203.0.113.0/24")).toBe(false);
    expect(ipMatches("203.0.113.9", "203.0.113.0/99")).toBe(false);
    expect(ipMatches("203.0.113.9", "garbage")).toBe(false);
  });
});

describe("organization IP allow-list", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let office: Caller;
  let home: Caller;
  let member: Caller;
  let other: Caller;
  let entryId: string;

  beforeAll(async () => {
    org = await world.org("IP access");

    const o = await world.userIn(org, "owner", "Ip Owner");
    const m = await world.userIn(org, "member", "Ip Member");
    const elsewhere = await world.org("IP elsewhere");
    const x = await world.userIn(elsewhere, "owner", "Ip Outsider");

    office = await world.caller(o.user, org, {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    home = await world.caller(o.user, org, {
      headers: { "x-forwarded-for": "198.51.100.77" },
    });
    member = await world.caller(m.user, org, {
      headers: { "x-forwarded-for": "198.51.100.77" },
    });
    other = await world.caller(x.user, elsewhere, {
      headers: { "x-forwarded-for": "198.51.100.77" },
    });
  });

  it("lets only people who manage it see or change it, and checks the range", async () => {
    await expect(member.ipAccess.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      member.ipAccess.add({ cidr: "203.0.113.0/24", label: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      office.ipAccess.add({ cidr: "nonsense", label: "x" }),
    ).rejects.toBeDefined();

    const added = await office.ipAccess.add({
      cidr: "203.0.113.0/24",
      label: "Office",
    });

    entryId = added.id;
    expect((await office.ipAccess.get()).yourIp).toBe("203.0.113.5");
  });

  it("will not switch on unless the person's own address is allowed", async () => {
    await expect(
      home.ipAccess.setEnabled({ enabled: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await office.ipAccess.get()).enabled).toBe(false);
  });

  it("then lets in only the allowed addresses, in this organization only", async () => {
    await office.ipAccess.setEnabled({ enabled: true });
    forgetIpPolicy(org.id);

    expect((await office.ipAccess.get()).enabled).toBe(true);
    await expect(home.ipAccess.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(member.task.getTasksByOrgId()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // Another organization is unaffected.
    expect((await other.privacy.exportMine()).profile.name).toBe("Ip Outsider");
  });

  it("refuses to remove the range that covers the person doing it", async () => {
    await expect(office.ipAccess.remove({ id: entryId })).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
  });

  it("lets everyone back in once it is switched off", async () => {
    await office.ipAccess.setEnabled({ enabled: false });
    forgetIpPolicy(org.id);

    expect((await home.ipAccess.get()).enabled).toBe(false);
    await home.ipAccess.remove({ id: entryId });
    expect((await home.ipAccess.get()).entries).toEqual([]);
  });
});
