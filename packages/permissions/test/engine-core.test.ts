import { describe, expect, it } from "vitest";

import { can, check, checkProjectVisibility, getCatalogKeys } from "../src";
import {
  ORG,
  OTHER_PROJECT,
  OTHER_TEAM,
  OTHER_USER,
  PROJECT,
  TEAM,
  USER,
  assign,
  customRole,
  override,
  snapshot,
} from "./helpers";

describe("owners", () => {
  it("can do everything, including owner-only keys", () => {
    const owner = snapshot({ baseRole: "owner" });

    for (const key of getCatalogKeys()) {
      expect(can(owner, key), key).toBe(true);
    }
  });

  it("see private projects and cannot be denied", () => {
    const owner = snapshot({
      baseRole: "owner",
      overrides: [override("projects.view", "deny")],
    });

    expect(
      can(owner, "tasks.view", {
        project: { id: PROJECT, teamId: null, visibility: "private" },
      }),
    ).toBe(true);
  });
});

describe("users without roles", () => {
  it("are denied everything", () => {
    const stranger = snapshot({ baseRole: null });

    for (const key of getCatalogKeys()) {
      expect(can(stranger, key), key).toBe(false);
    }
  });
});

describe("base roles", () => {
  it("admin can do everything except owner-only keys", () => {
    const admin = snapshot({ baseRole: "admin" });

    expect(can(admin, "roles.create")).toBe(true);
    expect(can(admin, "projects.create")).toBe(true);
    expect(can(admin, "org.delete")).toBe(false);
    expect(check(admin, "org.ownership.transfer").reasons[0]!.kind).toBe(
      "owner_only",
    );
  });

  it("member gets the member defaults", () => {
    const member = snapshot();

    expect(can(member, "tasks.create")).toBe(true);
    expect(can(member, "docs.trash_any")).toBe(true);
    expect(can(member, "projects.create")).toBe(false);
    expect(can(member, "members.invite")).toBe(false);
  });

  it("owner-only keys stay denied even when a role or override grants them", () => {
    const granted = snapshot({
      extraRoles: [customRole("evil", ["org.delete"])],
      assignments: [assign("evil", "organization", ORG)],
      overrides: [override("org.delete", "allow")],
    });

    expect(can(granted, "org.delete")).toBe(false);
  });
});

describe("union of roles", () => {
  it("grants a permission when any applicable role grants it", () => {
    const user = snapshot({
      extraRoles: [
        customRole("a", ["projects.create"]),
        customRole("b", ["teams.create"]),
      ],
      assignments: [
        assign("a", "organization", ORG),
        assign("b", "organization", ORG),
      ],
    });

    expect(can(user, "projects.create")).toBe(true);
    expect(can(user, "teams.create")).toBe(true);
    expect(can(user, "teams.delete")).toBe(false);
  });

  it("explains which role granted it", () => {
    const user = snapshot({
      extraRoles: [customRole("Project creator", ["projects.create"])],
      assignments: [assign("Project creator", "organization", ORG)],
    });

    expect(check(user, "projects.create").reasons[0]!.message).toContain(
      "Project creator",
    );
  });
});

describe("overrides", () => {
  it("deny beats a role grant", () => {
    const user = snapshot({
      overrides: [override("tasks.create", "deny")],
    });

    expect(can(user, "tasks.create")).toBe(false);
    expect(check(user, "tasks.create").reasons[0]!.kind).toBe("override");
  });

  it("deny beats an allow override", () => {
    const user = snapshot({
      overrides: [
        override("projects.create", "allow"),
        override("projects.create", "deny"),
      ],
    });

    expect(can(user, "projects.create")).toBe(false);
  });

  it("allow adds a permission", () => {
    const user = snapshot({
      overrides: [override("projects.create", "allow")],
    });

    expect(can(user, "projects.create")).toBe(true);
  });

  it("applies team and project overrides only to matching resources", () => {
    const user = snapshot({
      overrides: [
        override("tasks.create", "deny", "project", PROJECT),
        override("teams.update", "allow", "team", TEAM),
      ],
    });
    const inProject = (id: string) => ({
      project: { id, teamId: null, visibility: "organization" as const },
    });

    expect(can(user, "tasks.create", inProject(PROJECT))).toBe(false);
    expect(can(user, "tasks.create", inProject(OTHER_PROJECT))).toBe(true);
    expect(can(user, "teams.update", { teamId: TEAM })).toBe(true);
    expect(can(user, "teams.update", { teamId: OTHER_TEAM })).toBe(false);
    expect(can(user, "teams.update")).toBe(false);
  });

  it("an organization deny applies everywhere", () => {
    const user = snapshot({ overrides: [override("tasks.create", "deny")] });

    expect(
      can(user, "tasks.create", {
        project: { id: PROJECT, teamId: null, visibility: "organization" },
      }),
    ).toBe(false);
  });
});

describe("scope inheritance", () => {
  it("applies an organization assignment everywhere", () => {
    const user = snapshot({
      baseRole: "member",
      extraRoles: [customRole("lead", ["projects.update"])],
      assignments: [assign("lead", "organization", ORG)],
    });

    expect(
      can(user, "projects.update", {
        project: { id: PROJECT, teamId: null, visibility: "organization" },
      }),
    ).toBe(true);
  });

  it("applies a team assignment only to resources of that team", () => {
    const user = snapshot({
      teamIds: [TEAM],
      assignments: [assign("system-team_lead", "team", TEAM, "team")],
    });

    expect(can(user, "teams.members.manage", { teamId: TEAM })).toBe(true);
    expect(can(user, "teams.members.manage", { teamId: OTHER_TEAM })).toBe(
      false,
    );
    expect(can(user, "teams.members.manage")).toBe(false);
  });

  it("applies a project assignment only to that project", () => {
    const user = snapshot({
      baseRole: "member",
      assignments: [assign("system-project_lead", "project", PROJECT)],
    });
    const project = (id: string) => ({
      project: { id, teamId: null, visibility: "organization" as const },
    });

    expect(can(user, "projects.update", project(PROJECT))).toBe(true);
    expect(can(user, "projects.update", project(OTHER_PROJECT))).toBe(false);
  });

  it("ignores a role at a scope the permission cannot be granted at", () => {
    const user = snapshot({
      extraRoles: [customRole("odd", ["projects.create"], "team")],
      assignments: [assign("odd", "team", TEAM)],
      teamIds: [TEAM],
    });

    // projects.create is organization-scope only.
    expect(can(user, "projects.create", { teamId: TEAM })).toBe(false);
  });

  it("applies team principal assignments to team members", () => {
    const user = snapshot({
      teamIds: [TEAM],
      extraRoles: [customRole("team-wide", ["projects.update"])],
      assignments: [assign("team-wide", "organization", ORG, "team")],
    });

    expect(can(user, "projects.update")).toBe(true);
  });
});

describe("own and any", () => {
  const owned = (ownerUserId: string) => ({ ownerUserId });

  it("lets update_own apply only to the owner's items", () => {
    const user = snapshot({
      extraRoles: [customRole("own", ["tasks.update_own"])],
      baseRole: null,
      assignments: [assign("own", "organization", ORG)],
    });

    expect(can(user, "tasks.update_own", owned(USER))).toBe(true);
    expect(can(user, "tasks.update_own", owned(OTHER_USER))).toBe(false);
    expect(can(user, "tasks.update_any")).toBe(false);
  });

  it("treats update_any as implying update_own", () => {
    const user = snapshot({
      baseRole: null,
      extraRoles: [customRole("any", ["tasks.update_any"])],
      assignments: [assign("any", "organization", ORG)],
    });

    expect(can(user, "tasks.update_own", owned(OTHER_USER))).toBe(true);
    expect(can(user, "tasks.update_any")).toBe(true);
  });

  it("denies both when update_any is denied", () => {
    const user = snapshot({
      overrides: [override("tasks.update_any", "deny")],
    });

    expect(can(user, "tasks.update_own", owned(USER))).toBe(false);
    expect(can(user, "tasks.update_any")).toBe(false);
  });

  it("explains an own-only grant on someone else's item", () => {
    const user = snapshot({
      baseRole: null,
      extraRoles: [customRole("own", ["docs.trash_own"])],
      assignments: [assign("own", "organization", ORG)],
    });

    expect(
      check(user, "docs.trash_own", owned(OTHER_USER)).reasons[0]!.kind,
    ).toBe("own");
  });
});
