import { db } from "@kyren/db";
import {
  activityEvents,
  docComments,
  taskComments,
  teamMembers,
} from "@kyren/db/schema";
import { type World } from "./world";

export type ScenarioConfig = {
  label: string;
  visibility: "private" | "team";
  teamMemberSees: boolean;
};

export async function setupProjectVisibility(
  world: World,
  scenario: ScenarioConfig,
) {
  const org = await world.org(`Visibility ${scenario.label}`);
  const owner = await world.userIn(org, "owner", "Olive Owner");
  const out = await world.userIn(org, "member", "Otto Outsider");
  const mem = await world.userIn(org, "member", "Mia Member");
  const tm = await world.userIn(org, "member", "Tess Team");

  const ownerUser = owner.user;
  const outsiderUser = out.user;
  const memberUser = mem.user;
  const teamUser = tm.user;

  const team = await world.team(org);

  await db.insert(teamMembers).values({
    organizationId: org.id,
    teamId: team.id,
    memberId: tm.member.id,
  });

  const open = await world.project(org, { taskKeyPrefix: "OP" });
  const hidden = await world.project(org, {
    taskKeyPrefix: "HP",
    visibility: scenario.visibility,
    teamId: scenario.visibility === "team" ? team.id : null,
  });

  const slug = hidden.slug;
  const projectId = hidden.id;
  const taskKey = "HP-1";
  const openDocSlug = "open-doc";

  const dueSoon = new Date(Date.now() + 2 * 86_400_000);
  const overdue = new Date(Date.now() - 2 * 86_400_000);

  await world.task(org, open, {
    taskNumber: 1,
    name: "Open task",
    createdByMemberId: owner.member.id,
  });
  const task = await world.task(org, hidden, {
    taskNumber: 1,
    name: "Hidden task",
    dueAt: dueSoon,
    createdByMemberId: owner.member.id,
    assignedToMemberId: out.member.id,
  });

  await world.task(org, hidden, {
    taskNumber: 2,
    name: "Hidden overdue task",
    dueAt: overdue,
    createdByMemberId: owner.member.id,
  });

  await db.insert(activityEvents).values({
    organizationId: org.id,
    actorUserId: owner.user.id,
    action: "task.status_changed",
    targetType: "task",
    targetId: task.id,
    targetLabel: task.key,
    projectId: hidden.id,
    metadata: { changes: [{ field: "status", from: "todo", to: "done" }] },
  });
  await db.insert(taskComments).values({
    organizationId: org.id,
    taskId: task.id,
    authorMemberId: owner.member.id,
    body: "secret task comment",
  });

  await world.doc(org, {
    title: "Open doc",
    slug: openDocSlug,
    createdByMemberId: owner.member.id,
  });
  const doc = await world.doc(org, {
    projectId: hidden.id,
    title: "Hidden doc",
    slug: "hidden-doc",
    content: "needle in the hidden doc",
    createdByMemberId: owner.member.id,
  });

  const docId = doc.id;
  const docSlug = doc.slug;
  const trashedSlug = "hidden-trashed";
  const outsiderDocSlug = "hidden-by-outsider";

  await world.doc(org, {
    projectId: hidden.id,
    title: "Trashed hidden doc",
    slug: trashedSlug,
    deletedAt: new Date(),
    createdByMemberId: owner.member.id,
  });

  await world.doc(org, {
    projectId: hidden.id,
    title: "Outsider's own doc",
    slug: outsiderDocSlug,
    createdByMemberId: out.member.id,
  });

  const [comment] = await db
    .insert(docComments)
    .values({
      organizationId: org.id,
      docId: doc.id,
      authorMemberId: owner.member.id,
      body: "secret doc comment",
    })
    .returning();

  const commentId = comment!.id;

  await world.assign(
    org,
    await world.systemRoleId(org, "project_viewer"),
    { type: "user", id: mem.user.id },
    { type: "project", id: hidden.id },
  );

  const outsider = await world.caller(out.user, org);
  const member = await world.caller(mem.user, org);
  const teamMember = await world.caller(tm.user, org);

  return {
    org,
    ownerUser,
    outsiderUser,
    memberUser,
    teamUser,
    outsider,
    member,
    teamMember,
    slug,
    projectId,
    taskKey,
    docId,
    docSlug,
    trashedSlug,
    commentId,
    outsiderDocSlug,
    openDocSlug,
  };
}
