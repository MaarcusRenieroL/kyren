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

describe("project visibility", () => {
  const project = (
    visibility: "organization" | "team" | "private",
    teamId: string | null = TEAM,
  ) => ({ id: PROJECT, teamId, visibility });

  it("organization: anyone who can view projects sees it", () => {
    expect(
      checkProjectVisibility(snapshot(), project("organization")).allowed,
    ).toBe(true);
  });

  it("organization: not visible without projects.view", () => {
    const user = snapshot({
      overrides: [override("projects.view", "deny")],
    });

    expect(checkProjectVisibility(user, project("organization")).allowed).toBe(
      false,
    );
  });

  it("team: visible to team members, not to outsiders", () => {
    expect(
      checkProjectVisibility(snapshot({ teamIds: [TEAM] }), project("team"))
        .allowed,
    ).toBe(true);
    expect(checkProjectVisibility(snapshot(), project("team")).allowed).toBe(
      false,
    );
  });

  it("team: visible with a project assignment or view_private", () => {
    const assigned = snapshot({
      assignments: [assign("system-project_viewer", "project", PROJECT)],
    });
    const privileged = snapshot({
      extraRoles: [customRole("peek", ["projects.view_private"])],
      assignments: [assign("peek", "organization", ORG)],
    });

    expect(checkProjectVisibility(assigned, project("team")).allowed).toBe(
      true,
    );
    expect(checkProjectVisibility(privileged, project("team")).allowed).toBe(
      true,
    );
  });

  it("private: only with a project assignment or view_private", () => {
    const member = snapshot({ teamIds: [TEAM] });
    const assigned = snapshot({
      assignments: [assign("system-project_viewer", "project", PROJECT)],
    });
    const admin = snapshot({ baseRole: "admin" });

    expect(checkProjectVisibility(member, project("private")).allowed).toBe(
      false,
    );
    expect(checkProjectVisibility(assigned, project("private")).allowed).toBe(
      true,
    );
    // Admin = everything but owner-only, which includes projects.view_private.
    expect(checkProjectVisibility(admin, project("private")).allowed).toBe(
      true,
    );
  });

  it("gates tasks and docs inside a hidden project", () => {
    const member = snapshot();

    expect(can(member, "tasks.view", { project: project("private") })).toBe(
      false,
    );
    expect(can(member, "docs.create", { project: project("private") })).toBe(
      false,
    );
    expect(
      can(member, "tasks.view", { project: project("organization") }),
    ).toBe(true);
  });

  it("a project viewer role is read-only inside the project", () => {
    const viewer = snapshot({
      baseRole: null,
      assignments: [assign("system-project_viewer", "project", PROJECT)],
    });
    const scope = { project: project("private") };

    expect(can(viewer, "tasks.view", scope)).toBe(true);
    expect(can(viewer, "docs.view", scope)).toBe(true);
    expect(can(viewer, "tasks.create", scope)).toBe(false);
    expect(can(viewer, "docs.update_any", scope)).toBe(false);
  });

  it("a project lead can manage the project it leads", () => {
    const lead = snapshot({
      assignments: [assign("system-project_lead", "project", PROJECT)],
    });
    const scope = { project: project("private") };

    expect(can(lead, "projects.update", scope)).toBe(true);
    expect(can(lead, "projects.members.manage", scope)).toBe(true);
    expect(can(lead, "projects.delete", scope)).toBe(false);
  });

  it("a deny on projects.view hides the project even from assigned users", () => {
    const user = snapshot({
      assignments: [assign("system-project_viewer", "project", PROJECT)],
      overrides: [override("projects.view", "deny", "project", PROJECT)],
    });

    expect(checkProjectVisibility(user, project("organization")).allowed).toBe(
      false,
    );
  });

  it("tasks and docs without a project follow organization-level permissions", () => {
    expect(can(snapshot(), "tasks.view")).toBe(true);
    expect(can(snapshot({ baseRole: null }), "tasks.view")).toBe(false);
  });
});

describe("properties", () => {
  const keys = getCatalogKeys();

  it("adding a deny never increases access", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;

      return seed / 2147483647;
    };
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(random() * items.length)]!;

    for (let round = 0; round < 200; round++) {
      const base = snapshot({
        baseRole: pick(["owner", "admin", "member", null] as const),
        teamIds: random() > 0.5 ? [TEAM] : [],
        extraRoles: [customRole("x", [pick(keys), pick(keys), pick(keys)])],
        assignments: random() > 0.5 ? [assign("x", "organization", ORG)] : [],
        overrides: random() > 0.7 ? [override(pick(keys), "allow")] : [],
      });
      const denied = {
        ...base,
        overrides: [...base.overrides, override(pick(keys), "deny")],
      };
      const resource = {
        project:
          random() > 0.5
            ? {
                id: PROJECT,
                teamId: TEAM,
                visibility: pick(["organization", "team", "private"] as const),
              }
            : null,
        ownerUserId: random() > 0.5 ? USER : OTHER_USER,
      };

      for (const key of keys) {
        if (can(denied, key, resource)) {
          expect(can(base, key, resource), `${key} round ${round}`).toBe(true);
        }
      }
    }
  });

  it("adding an allow never reduces access", () => {
    const base = snapshot();
    const allowed = {
      ...base,
      overrides: [override("projects.create", "allow")],
    };

    for (const key of keys) {
      if (can(base, key)) {
        expect(can(allowed, key), key).toBe(true);
      }
    }
  });
});
