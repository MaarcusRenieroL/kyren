import { db } from "@kyren/db";
import { and, eq, sql } from "@kyren/db/drizzle";
import { jobs } from "@kyren/db/schema";
import { type MentionMail } from "../../src/server/chat-mention-mail";
import { World } from "./world";

export async function setupChatMentionTest(world: World, sent: MentionMail[]) {
  const org = await world.org(`Mention mail ${Date.now()}`);
  const p = await world.userIn(org, "owner", "Priya Raman");
  const a = await world.userIn(org, "member", "Arjun Mehta");
  const m = await world.userIn(org, "member", "Meera Iyer");

  const priya = await world.caller(p.user, org);
  const arjun = await world.caller(a.user, org);
  const priyaId = p.member.id;
  const arjunId = a.member.id;
  const meeraId = m.member.id;
  const channel = await priya.chat.create({
    name: `launch-${Date.now()}`,
    memberIds: [arjunId],
  });

  return {
    org,
    priya,
    arjun,
    priyaId,
    arjunId,
    meeraId,
    channel,
  };
}

export async function queuedMentionJob(messageId: string) {
  return db
    .select({ payload: jobs.payload, runAt: jobs.runAt })
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "chat_mention_mail"),
        sql`${jobs.payload} ->> 'messageId' = ${messageId}`,
      ),
    );
}
