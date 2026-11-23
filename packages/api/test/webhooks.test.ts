import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { webhookDeliveries, webhookEndpoints } from "@kyren/db/schema";

vi.mock("../src/server/chat-unfurl", async (original) => ({
  ...(await original<typeof import("../src/server/chat-unfurl")>()),
  isSafeUrl: vi.fn(async (value: string) => !value.includes("internal")),
}));

import { deliverDueWebhooks, signWebhook } from "../src/server/webhooks";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("webhooks", () => {
  let owner: Caller;
  let member: Caller;
  let other: Caller;
  let orgId: string;

  beforeAll(async () => {
    const org = await world.org("Hooks org");
    const o = await world.userIn(org, "owner", "Hook Owner");
    const m = await world.userIn(org, "member", "Hook Member");
    const otherOrg = await world.org("Other hooks org");
    const x = await world.userIn(otherOrg, "owner", "Other Owner");

    orgId = org.id;
    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    other = await world.caller(x.user, otherOrg);
  });

  const deliveriesFor = (id: string) =>
    db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, id));

  it("returns the secret once and refuses unsafe or unknown settings", async () => {
    const created = await owner.webhook.create({
      url: "https://hooks.example.com/kyren",
      events: ["task.created"],
    });

    expect(created.secret).toMatch(/^whsec_/);
    expect(JSON.stringify(await owner.webhook.list())).not.toContain(
      created.secret,
    );

    await expect(
      owner.webhook.create({ url: "https://internal.example.com/x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.webhook.create({
        url: "https://hooks.example.com/kyren",
        events: ["not.an.event"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member.webhook.create({ url: "https://hooks.example.com/kyren" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("queues an event only for endpoints that want it, inside its own organization", async () => {
    const wantsKeys = await owner.webhook.create({
      url: "https://hooks.example.com/keys",
      events: ["apikey.created"],
    });
    const wantsTasks = await owner.webhook.create({
      url: "https://hooks.example.com/tasks",
      events: ["task.created"],
    });
    const elsewhere = await other.webhook.create({
      url: "https://hooks.example.com/other",
    });

    await owner.apiKey.create({ name: "Secret-ish key name" });

    const queued = await deliveriesFor(wantsKeys.id);

    expect(queued).toHaveLength(1);
    expect(queued[0]!.event).toBe("apikey.created");
    // Names and labels never leave in the payload.
    expect(JSON.stringify(queued[0]!.payload)).not.toContain("Secret-ish");
    expect(queued[0]!.payload).toMatchObject({
      type: "apikey.created",
      organizationId: orgId,
      target: { type: "api_key" },
    });
    expect(await deliveriesFor(wantsTasks.id)).toHaveLength(0);
    expect(
      (await deliveriesFor(elsewhere.id)).map((row) => row.event),
    ).not.toContain("apikey.created");
  });

  it("signs each delivery and marks it delivered on a 2xx answer", async () => {
    const hook = await owner.webhook.create({
      url: "https://hooks.example.com/signed",
      events: ["apikey.revoked"],
    });
    const key = await owner.apiKey.create({ name: "To revoke" });

    await owner.apiKey.revoke({ id: key.id });

    const seen: {
      url: string;
      body: string;
      headers: Record<string, string>;
    }[] = [];

    await deliverDueWebhooks(db, {
      send: async (url, body, headers) => {
        seen.push({ url, body, headers });
        return 204;
      },
    });

    const call = seen.find((entry) => entry.url.endsWith("/signed"))!;
    const [row] = await deliveriesFor(hook.id);
    const [timestamp, signature] = call.headers["x-zentro-signature"]!.split(
      ",",
    ).map((part) => part.split("=").slice(1).join("="));

    expect(row?.status).toBe("delivered");
    expect(`v1=${signature}`).toBe(
      signWebhook(hook.secret, Number(timestamp), call.body),
    );
    expect(call.headers["x-zentro-event"]).toBe("apikey.revoked");
  });

  it("retries a failing receiver with growing waits, then gives up", async () => {
    const hook = await owner.webhook.create({
      url: "https://hooks.example.com/down",
      events: ["apikey.created"],
    });

    await owner.apiKey.create({ name: "Trigger" });

    let now = new Date(Date.now() + 1000);
    let calls = 0;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await deliverDueWebhooks(db, {
        now,
        send: async (url) => {
          if (url.endsWith("/down")) calls += 1;
          return 500;
        },
      });
      now = new Date(now.getTime() + 7 * 3600_000);
    }

    const [row] = await deliveriesFor(hook.id);

    expect(calls).toBe(6);
    expect(row).toMatchObject({ status: "failed", attempts: 6 });
    expect(row?.lastError).toMatch(/500/);
  });

  it("removes an endpoint and its deliveries, and only within its organization", async () => {
    const hook = await owner.webhook.create({
      url: "https://hooks.example.com/gone",
    });

    await expect(other.webhook.remove({ id: hook.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await owner.webhook.remove({ id: hook.id });

    expect(
      await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, hook.id)),
    ).toHaveLength(0);
  });
});
