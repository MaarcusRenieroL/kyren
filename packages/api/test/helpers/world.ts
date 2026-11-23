import { randomUUID } from "node:crypto";

import { db } from "@zentro/db";
import {
  docs,
  invitations,
  members,
  organizationModules,
  organizations,
  projects,
  tasks,
  teams,
  users,
} from "@zentro/db/schema";
import { type AuditContext } from "../../src/server/audit";

import {
  anonymousCaller,
  createOrgCaller,
  createSessionCaller,
  createSessionHeaders,
} from "./callers";
import { cleanupWorld } from "./cleanup";
import {
  createCustomRole,
  createPermissionOverride,
  createRoleAssignment,
  getSystemRoleId,
} from "./world-roles";
import type { Role, TestMember, TestOrg, TestUser } from "./world-types";

export type { Role, TestMember, TestOrg, TestUser };

const suffix = () => randomUUID().slice(0, 8);

/**
 * Creates rows directly through Drizzle and removes everything it created in
 * `cleanup()`. Deleting users and organizations cascades to the rest, so test
 * files stay independent even though they share one database.
 */
export class World {
  private userIds: string[] = [];
  private orgIds: string[] = [];

  trackOrg(id: string) {
    this.orgIds.push(id);
  }

  trackUser(id: string) {
    this.userIds.push(id);
  }

  async user(name = "Test User"): Promise<TestUser> {
    const id = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        id,
        name,
        email: `${id}@example.test`,
        emailVerified: true,
      })
      .returning();

    this.userIds.push(id);

    return user!;
  }

  async org(name = "Test Org"): Promise<TestOrg> {
    const [org] = await db
      .insert(organizations)
      .values({ name, slug: `org-${suffix()}` })
      .returning();

    this.orgIds.push(org!.id);

    return org!;
  }

  async member(
    org: TestOrg,
    user: TestUser,
    role: Role = "member",
  ): Promise<TestMember> {
    const [member] = await db
      .insert(members)
      .values({ organizationId: org.id, userId: user.id, role })
      .returning();

    return member!;
  }

  async userIn(org: TestOrg, role: Role, name = `${role} user`) {
    const user = await this.user(name);
    const member = await this.member(org, user, role);

    return { user, member };
  }

  async project(
    org: TestOrg,
    values: Partial<typeof projects.$inferInsert> = {},
  ) {
    const key = suffix();
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: `Project ${key}`,
        slug: `project-${key}`,
        taskKeyPrefix: "PA",
        ...values,
      })
      .returning();

    return project!;
  }

  async task(
    org: TestOrg,
    project: typeof projects.$inferSelect,
    values: Partial<typeof tasks.$inferInsert> = {},
  ) {
    const taskNumber = values.taskNumber ?? 1;
    const [task] = await db
      .insert(tasks)
      .values({
        organizationId: org.id,
        projectId: project.id,
        name: "Task",
        taskNumber,
        key: `${project.taskKeyPrefix}-${taskNumber}`,
        ...values,
      })
      .returning();

    return task!;
  }

  async doc(org: TestOrg, values: Partial<typeof docs.$inferInsert> = {}) {
    const key = suffix();
    const [doc] = await db
      .insert(docs)
      .values({
        organizationId: org.id,
        title: `Doc ${key}`,
        slug: `doc-${key}`,
        content: "",
        ...values,
      })
      .returning();

    return doc!;
  }

  async team(org: TestOrg, values: Partial<typeof teams.$inferInsert> = {}) {
    const [team] = await db
      .insert(teams)
      .values({ organizationId: org.id, name: `Team ${suffix()}`, ...values })
      .returning();

    return team!;
  }

  async setModule(org: TestOrg, moduleId: string, enabled: boolean) {
    await db
      .insert(organizationModules)
      .values({ organizationId: org.id, moduleId, enabled })
      .onConflictDoUpdate({
        target: [
          organizationModules.organizationId,
          organizationModules.moduleId,
        ],
        set: { enabled },
      });
  }

  async sessionHeaders(user: TestUser, org?: TestOrg) {
    return createSessionHeaders(user, org);
  }

  async systemRoleId(org: TestOrg, systemKey: string) {
    return getSystemRoleId(org, systemKey);
  }

  async role(
    org: TestOrg,
    values: {
      name: string;
      scope?: "organization" | "team" | "project";
      permissions: string[];
    },
  ) {
    return createCustomRole(org, values);
  }

  async assign(
    org: TestOrg,
    roleId: string,
    principal: { type: "user" | "team"; id: string },
    scope: { type: "organization" | "team" | "project"; id: string },
  ) {
    return createRoleAssignment(org, roleId, principal, scope);
  }

  async override(
    org: TestOrg,
    user: TestUser,
    permission: string,
    effect: "allow" | "deny",
    scope: { type: "organization" | "team" | "project"; id: string } = {
      type: "organization",
      id: org.id,
    },
  ) {
    return createPermissionOverride(org, user, permission, effect, scope);
  }

  async caller(
    user: TestUser,
    org: TestOrg,
    options: {
      memberOrder?: "asc" | "desc";
      headers?: Record<string, string>;
      wrapAudit?: (audit: AuditContext) => AuditContext;
      sessionAgeMs?: number;
    } = {},
  ) {
    return createOrgCaller(user, org, options);
  }

  anonymousCaller() {
    return anonymousCaller();
  }

  sessionCaller(
    user: TestUser,
    options: { sessionAgeMs?: number; ip?: string } = {},
  ) {
    return createSessionCaller(user, options);
  }

  async invitation(
    org: TestOrg,
    inviter: TestUser,
    values: Partial<typeof invitations.$inferInsert> & { email: string },
  ) {
    const [invitation] = await db
      .insert(invitations)
      .values({
        organizationId: org.id,
        inviterId: inviter.id,
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 86_400_000),
        ...values,
      })
      .returning();

    return invitation!;
  }

  async cleanup() {
    await cleanupWorld(this.orgIds, this.userIds);
    this.orgIds = [];
    this.userIds = [];
  }
}

export { anonymousCaller };
