import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { orgId, type MemberInfo, type SeedContext, type SeedMembers } from "./context";

export async function seedOrgAndTeams(): Promise<SeedContext> {
  const [existingOrg] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId));

  if (!existingOrg) {
    throw new Error(`Organization ${orgId} not found in database!`);
  }

  await db
    .update(schema.organizations)
    .set({
      name: "Acme Group",
      slug: "acme-group",
      updatedAt: new Date(),
    })
    .where(eq(schema.organizations.id, orgId));
  console.log("✅ Updated organization to 'Acme Group' (slug: acme-group)");

  const allModules = [
    "dashboard",
    "settings",
    "projects",
    "tasks",
    "docs",
    "chat",
    "files",
    "calendar",
    "whiteboards",
    "mail",
    "tickets",
    "hr",
    "payroll",
    "admin",
  ];
  await db
    .delete(schema.organizationModules)
    .where(eq(schema.organizationModules.organizationId, orgId));
  await db.insert(schema.organizationModules).values(
    allModules.map((moduleId) => ({
      organizationId: orgId,
      moduleId,
      enabled: true,
    })),
  );
  console.log("✅ Enabled all 14 modules in organizationModules");

  const membersList = await db
    .select({
      member: schema.members,
      user: schema.users,
    })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.organizationId, orgId));

  const memberMap = new Map<string, MemberInfo>();
  for (const row of membersList) {
    const key =
      (row.user.email ? row.user.email.split("@")[0] : null) ||
      row.user.name.toLowerCase().split(" ")[0] ||
      "user";
    memberMap.set(key, {
      memberId: row.member.id,
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
    });
  }

  const members: SeedMembers = {
    priya: memberMap.get("priya")!,
    daniel: memberMap.get("daniel")!,
    meilin: memberMap.get("meilin")!,
    tomas: memberMap.get("tomas")!,
    sofia: memberMap.get("sofia")!,
    jamal: memberMap.get("jamal")!,
    ravi: memberMap.get("ravi")!,
    hannah: memberMap.get("hannah")!,
  };

  console.log(
    `✅ Loaded ${memberMap.size} Acme members: Priya, Daniel, Mei Lin, Tomás, Sofia, Jamal, Ravi, Hannah`,
  );

  const existingTeams = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.organizationId, orgId));

  const teamMap = new Map<string, string>();
  for (const t of existingTeams) {
    teamMap.set(t.name, t.id);
  }

  if (!teamMap.has("Product & Growth")) {
    const [t] = await db
      .insert(schema.teams)
      .values({
        organizationId: orgId,
        name: "Product & Growth",
        color: "amber",
        description:
          "Product discovery, analytics, user research, and PLG experiments",
      })
      .returning({ id: schema.teams.id });
    teamMap.set("Product & Growth", t!.id);

    if (members.jamal) {
      await db
        .insert(schema.teamMembers)
        .values({
          organizationId: orgId,
          teamId: t!.id,
          memberId: members.jamal.memberId,
        })
        .onConflictDoNothing();
    }
  }

  const projectsList = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.organizationId, orgId));

  const websiteProject =
    projectsList.find((p) => p.slug === "website-redesign") || projectsList[0]!;
  const mobileProject =
    projectsList.find((p) => p.slug === "mobile-app") || projectsList[1]!;

  return {
    orgId,
    members,
    memberMap,
    teamMap,
    websiteProject,
    mobileProject,
  };
}
