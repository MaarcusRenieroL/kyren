import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

async function adminsOrg(label: string) {
  const org = await world.org(label);
  const o = await world.userIn(org, "owner", `${label} owner`);
  const a = await world.userIn(org, "admin", `${label} admin A`);
  const b = await world.userIn(org, "admin", `${label} admin B`);
  const m = await world.userIn(org, "member", `${label} member`);

  return {
    owner: await world.caller(o.user, org),
    adminA: await world.caller(a.user, org),
    adminB: b,
    member: m,
  };
}

describe("admins can't act on each other; the owner can", () => {
  it("an admin can't remove another admin, but can remove a member", async () => {
    const { owner, adminA, adminB, member } = await adminsOrg("Peer removal");

    await expect(
      adminA.member.remove({ memberId: adminB.member.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      adminA.member.remove({ memberId: member.member.id }),
    ).resolves.toBeDefined();
    await expect(
      owner.member.remove({ memberId: adminB.member.id }),
    ).resolves.toBeDefined();
  });

  it("an admin can't edit or reset the Admin role, which would change every admin", async () => {
    const { owner, adminA } = await adminsOrg("Admin role edit");
    const adminRole = (await owner.permissions.roles.list()).find(
      (role) => role.systemKey === "admin",
    )!;
    const narrowed = adminRole.permissions.filter(
      (key) => key !== "members.remove",
    );

    await expect(
      adminA.permissions.roles.update({
        id: adminRole.id,
        permissions: narrowed,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      adminA.permissions.roles.resetSystem({ systemKey: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // The owner can, and an admin can still edit the Member role.
    await expect(
      owner.permissions.roles.update({
        id: adminRole.id,
        permissions: narrowed,
      }),
    ).resolves.toBeDefined();

    const memberRole = (await adminA.permissions.roles.list()).find(
      (role) => role.systemKey === "member",
    )!;

    await expect(
      adminA.permissions.roles.update({
        id: memberRole.id,
        permissions: memberRole.permissions,
      }),
    ).resolves.toBeDefined();
  });

  it("a member given a custom role with members.remove still can't remove an admin", async () => {
    const org = await world.org("Remover role");
    const o = await world.userIn(org, "owner", "Remover owner");
    const a = await world.userIn(org, "admin", "Remover admin");
    const r = await world.userIn(org, "member", "Remover member");
    const other = await world.userIn(org, "member", "Remover target");
    const role = await world.role(org, {
      name: "Can remove people",
      permissions: ["members.view", "members.remove"],
    });

    await world.assign(
      org,
      role.id,
      { type: "user", id: r.user.id },
      { type: "organization", id: org.id },
    );

    const remover = await world.caller(r.user, org);

    await expect(
      remover.member.remove({ memberId: a.member.id }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only an owner can remove an admin.",
    });
    await expect(
      remover.member.remove({ memberId: o.member.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      remover.member.remove({ memberId: other.member.id }),
    ).resolves.toBeDefined();
  });
});
