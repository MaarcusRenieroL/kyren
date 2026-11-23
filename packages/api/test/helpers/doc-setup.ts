import { World } from "./world";

export async function setupDocTest(world: World, label: string) {
  const org = await world.org(label);
  const o = await world.userIn(org, "owner", "Owner");
  const a = await world.userIn(org, "admin", "Admin");
  const m = await world.userIn(org, "member", "Member");
  const doc = await world.doc(org, { content: "start" });

  return {
    org,
    doc,
    users: { owner: o.user, admin: a.user, member: m.user },
    owner: await world.caller(o.user, org),
    admin: await world.caller(a.user, org),
    member: await world.caller(m.user, org),
  };
}
