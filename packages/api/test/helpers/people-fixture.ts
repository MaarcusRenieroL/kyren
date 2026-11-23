import { World } from "./world";

export async function setupPeopleOrg(world: World, name: string) {
  const org = await world.org(name);
  const { user: owner } = await world.userIn(org, "owner", `${name} owner`);
  const { user: member, member: memberRow } = await world.userIn(
    org,
    "member",
    `${name} member`,
  );

  return {
    org,
    asOwner: await world.caller(owner, org),
    asMember: await world.caller(member, org),
    memberId: memberRow.id,
  };
}

export const person = (memberId: string | null, name = "Pat Member") => ({
  name,
  email: null,
  jobTitle: "Engineer",
  department: null,
  location: null,
  status: "active" as const,
  startDate: null,
  endDate: null,
  managerId: null,
  memberId,
});
