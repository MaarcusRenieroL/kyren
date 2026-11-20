import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.fn();
const onConflictDoNothing = vi.fn();

vi.mock("@zentro/db", () => ({
  db: {
    insert: () => ({
      values: (rows: unknown) => {
        values(rows);
        return { onConflictDoNothing };
      },
    }),
  },
}));
vi.mock("@zentro/db/schema", () => ({ emailSuppressions: {} }));

const { POST } = await import("../src/app/api/email/events/route");

const secret = `whsec_${Buffer.from("webhook-secret-bytes").toString("base64")}`;

function signed(event: unknown, at = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(event);
  const signature = createHmac(
    "sha256",
    Buffer.from(secret.replace("whsec_", ""), "base64"),
  )
    .update(`msg_1.${at}.${body}`)
    .digest("base64");

  return new Request("http://local/api/email/events", {
    method: "POST",
    body,
    headers: {
      "svix-id": "msg_1",
      "svix-timestamp": String(at),
      "svix-signature": `v1,${signature}`,
    },
  });
}

describe("POST /api/email/events", () => {
  beforeEach(() => {
    values.mockReset();
    process.env.RESEND_WEBHOOK_SECRET = secret;
  });

  it("puts a hard-bounced address on the suppression list", async () => {
    const response = await POST(
      signed({
        type: "email.bounced",
        data: { to: ["Gone@Example.com"], bounce: { type: "Permanent" } },
      }),
    );

    expect(response.status).toBe(204);
    expect(values).toHaveBeenCalledWith([
      { email: "gone@example.com", reason: "bounced" },
    ]);
  });

  it("suppresses a spam complaint, but not a temporary bounce", async () => {
    await POST(signed({ type: "email.complained", data: { to: ["a@b.co"] } }));
    expect(values).toHaveBeenCalledWith([
      { email: "a@b.co", reason: "complained" },
    ]);

    values.mockReset();
    await POST(
      signed({
        type: "email.bounced",
        data: { to: ["full@b.co"], bounce: { type: "Transient" } },
      }),
    );
    expect(values).not.toHaveBeenCalled();
  });

  it("refuses unsigned, wrongly signed and replayed events", async () => {
    const event = { type: "email.complained", data: { to: ["x@y.co"] } };
    const unsigned = new Request("http://local/api/email/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
    const forged = signed(event);

    forged.headers.set("svix-signature", "v1,AAAA");

    expect((await POST(unsigned)).status).toBe(401);
    expect((await POST(forged)).status).toBe(401);
    expect(
      (await POST(signed(event, Math.floor(Date.now() / 1000) - 3600))).status,
    ).toBe(401);
    expect(values).not.toHaveBeenCalled();
  });
});
