import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("single-choice polls", () => {
  it("keep one vote per person when votes arrive together", async () => {
    const org = await world.org("Poll race");
    const o = await world.userIn(org, "owner", "Poll Owner");
    const a = await world.userIn(org, "member", "Poll Voter");
    const owner = await world.caller(o.user, org);
    const voter = await world.caller(a.user, org);
    const channel = await owner.chat.create({
      name: "polls",
      memberIds: [a.member.id],
    });
    const { messageId } = await owner.chat.createPoll({
      channelId: channel.id,
      question: "Where?",
      options: ["A", "B", "C"],
    });
    const poll = (
      await owner.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.id === messageId)!.poll!;

    await Promise.allSettled([
      voter.chat.votePoll({ pollId: poll.id, optionIndex: 0 }),
      voter.chat.votePoll({ pollId: poll.id, optionIndex: 1 }),
      voter.chat.votePoll({ pollId: poll.id, optionIndex: 2 }),
      voter.chat.votePoll({ pollId: poll.id, optionIndex: 2 }),
    ]);

    const after = (
      await owner.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.id === messageId)!.poll!;

    expect(after.total).toBeLessThanOrEqual(1);
  });
});
