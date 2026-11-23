import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { projects } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

type Caller = Awaited<ReturnType<World["caller"]>>;

let org: TestOrg;
let owner: TestUser;
let as: Caller;

beforeAll(async () => {
  org = await world.org("Flows-Projects");
  const created = await world.userIn(org, "owner", "Flow Owner");

  owner = created.user;
  as = await world.caller(owner, org);
});

afterAll(() => world.cleanup());

describe("projects", () => {
  it("creates a project with a task key prefix derived from the slug", async () => {
    const project = await as.project.createProject({
      name: "Launch OS",
      slug: "launch-os",
      description: "Ship it",
    });

    expect(project).toMatchObject({
      name: "Launch OS",
      slug: "launch-os",
      taskKeyPrefix: "LO",
      status: "active",
      organizationId: org.id,
      createdById: owner.id,
    });
  });

  it("gives a second project with the same initials a unique prefix", async () => {
    const project = await as.project.createProject({
      name: "Landing Office",
      slug: "landing-office",
      description: "",
    });

    expect(project.taskKeyPrefix).toBe("LO2");
  });

  it("reads a project by slug and lists it", async () => {
    const detail = await as.project.getProjectBySlug({ slug: "launch-os" });
    const list = await as.project.getProjectsByOrgId();

    expect(detail.name).toBe("Launch OS");
    expect(list.map((project) => project.slug)).toContain("launch-os");
  });

  it("rejects a duplicate slug in the same organization", async () => {
    await expect(
      as.project.createProject({
        name: "Again",
        slug: "launch-os",
        description: "",
      }),
    ).rejects.toBeDefined();
  });

  it("renames and re-slugs a project", async () => {
    await as.project.createProject({
      name: "Old name",
      slug: "old-name",
      description: "",
    });

    await as.project.updateProjectBySlug({
      currentSlug: "old-name",
      name: "New name",
      slug: "new-name",
      description: "updated",
    });

    const detail = await as.project.getProjectBySlug({ slug: "new-name" });

    expect(detail.name).toBe("New name");
    await expect(
      as.project.getProjectBySlug({ slug: "old-name" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("archives a project", async () => {
    await as.project.createProject({
      name: "To archive",
      slug: "to-archive",
      description: "",
    });
    await as.project.archiveProject({ slug: "to-archive" });

    const [row] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, org.id),
          eq(projects.slug, "to-archive"),
        ),
      );

    expect(row!.archivedAt).not.toBeNull();
    expect(row!.status).not.toBe("active");
  });

  it("deletes a project and hides it from the list", async () => {
    await as.project.createProject({
      name: "To delete",
      slug: "to-delete",
      description: "",
    });
    await as.project.deleteProject({ slug: "to-delete" });

    const list = await as.project.getProjectsByOrgId();

    expect(list.map((project) => project.slug)).not.toContain("to-delete");
    await expect(
      as.project.getProjectBySlug({ slug: "to-delete" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
