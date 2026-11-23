import { afterAll, describe, expect, it } from "vitest";

import {
  forbidden,
  notFound,
  setMemberRole,
} from "./helpers/scoped-access-helpers";
import { World, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("own-resource permissions", () => {
  async function build() {
    const org = await world.org("Own resources");
    const owner = await world.userIn(org, "owner", "Ola Owner");
    const author = await world.userIn(org, "member", "Ann Author");
    const bystander = await world.userIn(org, "member", "Bo Bystander");
    const editor = await world.userIn(org, "member", "Eli Editor");

    await setMemberRole(world, org, [
      "projects.view",
      "tasks.view",
      "tasks.create",
      "tasks.update_own",
      "tasks.delete_own",
      "docs.view",
      "docs.create",
      "docs.update_own",
      "docs.trash_own",
      "docs.restore",
    ]);

    const anyRole = await world.role(org, {
      name: "Edit anything",
      permissions: [
        "tasks.update_any",
        "tasks.delete_any",
        "docs.update_any",
        "docs.trash_any",
      ],
    });

    await world.assign(
      org,
      anyRole.id,
      { type: "user", id: editor.user.id },
      { type: "organization", id: org.id },
    );

    const project = await world.project(org, { taskKeyPrefix: "OW" });
    const asAuthor = await world.caller(author.user, org);
    const asOwner = await world.caller(owner.user, org);
    const mine = await asAuthor.task.createTask({
      projectId: project.id,
      name: "Mine",
    });
    const theirs = await asOwner.task.createTask({
      projectId: project.id,
      name: "Theirs",
    });
    const myDoc = await asAuthor.docs.create({
      projectId: project.id,
      title: "My doc",
      slug: "my-own-doc",
    });
    const theirDoc = await asOwner.docs.create({
      projectId: project.id,
      title: "Their doc",
      slug: "their-own-doc",
    });

    return {
      org,
      project,
      owner,
      author,
      bystander,
      editor,
      mine,
      theirs,
      myDoc,
      theirDoc,
      asAuthor,
    };
  }

  it("returns who created a task and a doc", async () => {
    const { asAuthor, mine, theirs, myDoc, owner, author } = await build();

    expect(
      (await asAuthor.task.getTaskByKey({ key: mine.key }))?.createdByUserId,
    ).toBe(author.user.id);
    expect(
      (await asAuthor.task.getTaskByKey({ key: theirs.key }))?.createdByUserId,
    ).toBe(owner.user.id);
    expect(
      (await asAuthor.docs.getById({ id: myDoc.id })).createdByUserId,
    ).toBe(author.user.id);
    expect(
      (await asAuthor.docs.getBySlug({ slug: "their-own-doc" }))
        .createdByUserId,
    ).toBe(owner.user.id);
    expect(
      (await asAuthor.docs.getAll({})).map((doc) => [
        doc.slug,
        doc.createdByUserId,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["my-own-doc", author.user.id],
        ["their-own-doc", owner.user.id],
      ]),
    );
  });

  it("answers _own permissions for the item's creator only", async () => {
    const { org, project, author, owner, bystander, editor } = await build();
    const check = async (user: TestUser, ownerUserId?: string) =>
      (
        await (
          await world.caller(user, org)
        ).permissions.check({ projectId: project.id, ownerUserId })
      ).permissions;

    const asCreator = await check(author.user, author.user.id);
    const asOther = await check(author.user, owner.user.id);
    const noOwner = await check(author.user);

    for (const key of [
      "tasks.update_own",
      "tasks.delete_own",
      "docs.update_own",
      "docs.trash_own",
    ]) {
      expect(asCreator[key], `${key} on own item`).toBe(true);
      expect(asOther[key], `${key} on someone else's item`).toBe(false);
      expect(noOwner[key], `${key} with no owner`).toBe(false);
    }

    expect(
      (await check(bystander.user, author.user.id))["tasks.update_own"],
    ).toBe(false);

    const any = await check(editor.user, owner.user.id);

    expect(any["tasks.update_any"]).toBe(true);
    expect(any["docs.trash_any"]).toBe(true);
    expect(asCreator["tasks.update_any"]).toBe(false);
  });

  it("enforces _own on tasks", async () => {
    const { org, author, editor, mine, theirs } = await build();
    const own = await world.caller(author.user, org);
    const any = await world.caller(editor.user, org);

    await expect(
      own.task.updateTaskByKey({ key: mine.key, name: "Renamed" }),
    ).resolves.toMatchObject({ name: "Renamed" });
    await expect(
      own.task.updateTaskByKey({ key: theirs.key, name: "Hijack" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      own.task.deleteTaskByKey({ key: theirs.key }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      any.task.updateTaskByKey({ key: theirs.key, name: "Edited by any" }),
    ).resolves.toMatchObject({ name: "Edited by any" });
    await expect(any.task.deleteTaskByKey({ key: mine.key })).resolves.toEqual(
      expect.objectContaining({ key: mine.key }),
    );
    await expect(
      own.task.deleteTaskByKey({ key: theirs.key }),
    ).rejects.toMatchObject(forbidden);
  });

  it("enforces _own on docs", async () => {
    const { org, author, editor, myDoc, theirDoc } = await build();
    const own = await world.caller(author.user, org);
    const any = await world.caller(editor.user, org);

    await expect(
      own.docs.updateDocTitle({ id: myDoc.id, title: "Mine, edited" }),
    ).resolves.toMatchObject({ title: "Mine, edited" });
    await expect(
      own.docs.updateDocTitle({ id: theirDoc.id, title: "Hijack" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      own.docs.updateDocContent({ id: theirDoc.id, content: "x" }),
    ).rejects.toMatchObject(forbidden);
    await expect(own.docs.delete({ id: theirDoc.id })).rejects.toMatchObject(
      forbidden,
    );
    await expect(
      any.docs.updateDocContent({ id: theirDoc.id, content: "by any" }),
    ).resolves.toMatchObject({ content: "by any" });
    await expect(any.docs.delete({ id: myDoc.id })).resolves.toMatchObject({
      id: myDoc.id,
    });
    await expect(own.docs.delete({ id: theirDoc.id })).rejects.toMatchObject(
      forbidden,
    );
    await expect(own.docs.delete({ id: myDoc.id })).rejects.toMatchObject(
      notFound,
    );
  });
});
