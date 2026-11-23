import { World } from "./world";

export async function setupChatLinking(world: World) {
  const org = await world.org("Linking");
  const o = await world.userIn(org, "owner", "Priya Raman");
  const m = await world.userIn(org, "member", "Arjun Mehta");
  const x = await world.userIn(org, "member", "Meera Iyer");

  const owner = await world.caller(o.user, org);
  const member = await world.caller(m.user, org);
  const outsider = await world.caller(x.user, org);
  const memberId = m.member.id;
  const project = await owner.project.createProject({
    name: "Billing",
    slug: "billing-link",
    description: "",
  });
  const projectId = project.id;
  const task = await owner.task.createTask({
    projectId,
    name: "Fix proration",
  });
  const doc = await world.doc(org, {
    title: "Pricing spec",
    slug: "pricing-spec",
  });

  return {
    org,
    owner,
    member,
    outsider,
    memberId,
    projectId,
    task,
    doc,
  };
}
