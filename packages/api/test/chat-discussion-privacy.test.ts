import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("a private channel linked to a project stays private", () => {
  let owner: Caller;
  let arjun: Caller;
  let projectId: string;
  let secretId: string;

  beforeAll(async () => {
    const org = await world.org("Discussion privacy");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Arjun");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    projectId = (await world.project(org, { taskKeyPrefix: "DP" })).id;
    await owner.chat.send({
      channelId: (
        await (async () => {
          const secret = await owner.chat.create({
            name: "falcon-leads",
            visibility: "private",
            link: { type: "project", id: projectId },
          });

          secretId = secret.id;

          return secret;
        })()
      ).id,
      body: "layoffs next week",
    });
  });

  it("does not reveal it to someone who is not in it", async () => {
    const view = await arjun.chat.discussion({
      type: "project",
      id: projectId,
    });

    expect(view).toEqual({ exists: false, title: expect.any(String) });
  });

  it("does not add them to it when they open the discussion", async () => {
    const result = await arjun.chat.discuss({ type: "project", id: projectId });

    expect(result.channelId).not.toBe(secretId);
    await expect(
      arjun.chat.messages({ channelId: secretId }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/),
    });
  });

  it("still shows it to a member of the channel", async () => {
    const view = await owner.chat.discussion({
      type: "project",
      id: projectId,
    });

    expect(view).toMatchObject({ exists: true, channelId: secretId });
  });
});
