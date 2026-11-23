import { mentionedMemberIds } from "../../chat";
import { taskKeysIn } from "../../mentions";
import { externalUrls } from "../../chat-unfurl";
import { type OrganizationContext } from "../../trpc";
import { excerptOf, internalRefsIn, messageLinksIn } from "./refs";
import { loadHydrationData } from "./hydrate-loader";
import {
  type ChatEntityRef,
  type ChatMessageView,
  type Row,
} from "./types";

/** Everything a message needs on screen, for a batch of rows at once. */
export async function hydrateMessages(
  ctx: OrganizationContext,
  rows: Row[],
  memberId: string,
  options: { withReplies?: boolean } = {},
): Promise<ChatMessageView[]> {
  if (!rows.length) return [];

  const data = await loadHydrationData(ctx, rows, memberId, options);
  const {
    reactionRows,
    attachmentRows,
    replyRows,
    profiles,
    createdLinks,
    taskRows,
    readableIds,
    savedRows,
    pollRows,
    forwardRows,
    previewRows,
    entityMap,
    voteRows,
    voterProfiles,
    forwardAuthors,
  } = data;

  const nameOf = (id: string) => profiles.get(id)?.name ?? "Someone";

  return rows.map((row) => {
    const deleted = Boolean(row.deletedAt);
    const reactions = new Map<
      string,
      { emoji: string; count: number; mine: boolean; names: string[] }
    >();

    for (const reaction of reactionRows) {
      if (reaction.messageId !== row.id) continue;

      const entry = reactions.get(reaction.emoji) ?? {
        emoji: reaction.emoji,
        count: 0,
        mine: false,
        names: [],
      };

      entry.count += 1;
      entry.mine ||= reaction.memberId === memberId;
      entry.names.push(nameOf(reaction.memberId));
      reactions.set(reaction.emoji, entry);
    }

    const reply = replyRows.find((entry) => entry.parentId === row.id);
    const author = row.authorMemberId
      ? profiles.get(row.authorMemberId)
      : undefined;

    return {
      id: row.id,
      channelId: row.channelId,
      parentId: row.parentId,
      clientId: row.clientId,
      kind: (row.kind ?? "message") as ChatMessageView["kind"],
      meta: row.meta ?? null,
      author: author
        ? {
            memberId: author.memberId,
            name: author.name,
            presence: author.presence,
            status: author.status,
          }
        : null,
      saved: (() => {
        const saved = savedRows.find((entry) => entry.messageId === row.id);

        return saved ? { remindAt: saved.remindAt } : null;
      })(),
      poll: (() => {
        const poll = pollRows.find((entry) => entry.messageId === row.id);

        if (!poll || deleted) return null;

        const votes = voteRows.filter((vote) => vote.pollId === poll.id);

        return {
          id: poll.id,
          question: poll.question,
          multiple: poll.multiple,
          closed: Boolean(poll.closedAt),
          total: new Set(votes.map((vote) => vote.memberId)).size,
          options: poll.options.map((label, index) => {
            const forOption = votes.filter(
              (vote) => vote.optionIndex === index,
            );

            return {
              label,
              votes: forOption.length,
              mine: forOption.some((vote) => vote.memberId === memberId),
              voters: forOption
                .map((vote) => voterProfiles.get(vote.memberId)?.name)
                .filter((name): name is string => Boolean(name))
                .slice(0, 8),
            };
          }),
        };
      })(),
      forwarded: (() => {
        const source = forwardRows.find(
          (entry) => entry.id === row.forwardedFromId,
        );

        if (!source || source.deletedAt || !readableIds.has(source.channelId)) {
          return null;
        }

        return {
          id: source.id,
          channelId: source.channelId,
          channelName: source.channelName,
          authorName:
            (source.authorMemberId
              ? forwardAuthors.get(source.authorMemberId)?.name
              : null) ?? "Someone",
          excerpt: excerptOf(source.body),
        };
      })(),
      entities: deleted
        ? []
        : [
            ...messageLinksIn(row.body).map((id) =>
              entityMap.get(`messages:${id}`),
            ),
            ...internalRefsIn(row.body).map((ref) =>
              entityMap.get(`${ref.kind}:${ref.key}`),
            ),
          ].filter((entry): entry is ChatEntityRef => entry !== undefined),
      links: deleted
        ? []
        : externalUrls(row.body)
            .map((url) => previewRows.find((entry) => entry.url === url))
            .filter((entry) => entry !== undefined && entry.title !== null)
            .map((entry) => ({
              url: entry!.url,
              title: entry!.title,
              description: entry!.description,
              image: entry!.image,
              siteName: entry!.siteName,
            })),
      mine: row.authorMemberId === memberId,
      body: deleted ? "" : row.body,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      deleted,
      pinned: Boolean(row.pinnedAt),
      names: Object.fromEntries(
        mentionedMemberIds(row.body).map((id) => [id, nameOf(id)]),
      ),
      reactions: deleted ? [] : [...reactions.values()],
      attachments: deleted
        ? []
        : attachmentRows
            .filter((entry) => entry.messageId === row.id)
            .map((entry) => ({
              id: entry.id,
              name: entry.name,
              mimeType: entry.mimeType,
              size: entry.size,
              width: entry.width,
              height: entry.height,
              url: `/api/files/${entry.id}`,
            })),
      tasks: deleted
        ? []
        : [
            ...taskKeysIn(row.body).map((key) =>
              taskRows.find((task) => task.key === key),
            ),
            ...createdLinks
              .filter((link) => link.messageId === row.id)
              .map((link) => taskRows.find((task) => task.id === link.taskId)),
          ]
            .filter((task) => task !== undefined)
            .filter(
              (task, index, all) =>
                all.findIndex((other) => other.id === task.id) === index,
            ),
      replies:
        options.withReplies && reply
          ? {
              count: reply.count,
              lastAt: reply.lastAt,
              people: reply.people.filter(Boolean).map(nameOf).slice(0, 3),
            }
          : options.withReplies
            ? { count: 0, lastAt: null, people: [] }
            : null,
    };
  });
}
