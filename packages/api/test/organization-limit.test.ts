import { auth } from "@kyren/auth";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const create = async (headers: Headers, slug: string) =>
  auth.api.createOrganization({
    headers,
    body: { name: slug, slug },
  });

const slug = (label: string) =>
  `${label}-${Math.random().toString(36).slice(2, 10)}`;

describe("how many organizations one person can start", () => {
  it("stops an owner of ten at the eleventh", async () => {
    const founder = await world.user("Serial Founder");

    for (let index = 0; index < 9; index += 1) {
      await world.member(await world.org(`Owned ${index}`), founder, "owner");
    }

    // A combined role still makes them an owner.
    await world.member(
      await world.org("Owned combined"),
      founder,
      "owner,admin" as "owner",
    );

    await expect(
      create(await world.sessionHeaders(founder), slug("eleventh")),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("doesn't count organizations someone was only invited into", async () => {
    const joiner = await world.user("Busy Joiner");

    for (let index = 0; index < 10; index += 1) {
      await world.member(await world.org(`Joined ${index}`), joiner, "member");
    }

    const created = await create(
      await world.sessionHeaders(joiner),
      slug("mine"),
    );

    expect(created?.id).toBeTruthy();
    world.trackOrg(created!.id);
  });
});
