import type { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@kyren/ui/index";
import type { useTrpcClient } from "@kyren/api/react";
import type { Draft, SlashCommand } from "../composer";
import { untilLabel } from "../message-body";
import type { MessageView } from "../message-item";
import {
  parseWhen,
  plainText,
  slugOf,
  type ChannelData,
} from "./channel-view-types";

export function useChannelCommands({
  channelId,
  full,
  trpc,
  router,
  sidebar,
  refresh,
  setNewTask,
  setPoll,
  setSummary,
}: {
  channelId: string | undefined;
  full: ChannelData | null;
  trpc: ReturnType<typeof useTrpcClient>;
  router: ReturnType<typeof useRouter>;
  sidebar: { refresh: () => void };
  refresh: () => Promise<void>;
  setNewTask: (task: string | null) => void;
  setPoll: (poll: { question: string; options?: string[] } | null) => void;
  setSummary: (open: boolean) => void;
}) {
  const postPlain = async (body: string) => {
    if (!channelId) return;

    await trpc.chat.send.mutate({
      channelId,
      body,
      clientId: crypto.randomUUID(),
      fileIds: [],
    });
    await refresh();
    void sidebar.refresh();
  };

  /** Starts a doc from a message and its thread, then opens it. */
  const makeDoc = async (message: MessageView) => {
    try {
      const replies =
        message.replies && message.replies.count > 0
          ? (await trpc.chat.thread.query({ messageId: message.id })).replies
          : [];
      const first = plainText(message.body, message.names).split("\n")[0] ?? "";
      const title = first.trim().slice(0, 80) || "Notes from chat";
      const where = full?.kind === "dm" ? "a direct message" : `#${full?.name}`;
      const line = (entry: MessageView) =>
        `**${entry.author?.name ?? "Someone"}** (${new Date(entry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}): ${plainText(entry.body, entry.names)}`;
      const content = [
        `# ${title}`,
        `_From ${where}. ${window.location.origin}/chat/${full?.kind === "dm" ? `dm/${channelId}` : full?.name}?m=${message.id}_`,
        "",
        line(message),
        ...replies.map(line),
      ].join("\n\n");
      const slug = slugOf(title);

      await trpc.docs.create.mutate({ title, content, slug });
      toastSuccess("Doc created");
      router.push(`/docs/${slug}`);
    } catch (error) {
      toastError(error, "Could not create the doc");
    }
  };

  const schedule = async (draft: Draft, at: Date) => {
    if (!channelId) return;

    try {
      await trpc.chat.schedule.mutate({
        channelId,
        body: draft.body,
        sendAt: at,
      });
      toastSuccess(`Scheduled for ${untilLabel(at)}`);
      void sidebar.refresh();
    } catch (error) {
      toastError(error, "Could not schedule the message");
    }
  };

  const commands: SlashCommand[] = [
    {
      name: "task",
      usage: "<title>",
      description: "Create a task",
      run: (args) => setNewTask(args),
    },
    {
      name: "doc",
      usage: "<title>",
      description: "Create a doc and share it here",
      run: async (args) => {
        const title = args || "Untitled";
        const slug = slugOf(title);

        await trpc.docs.create.mutate({ title, content: "", slug });
        await postPlain(
          `Created a doc: ${window.location.origin}/docs/${slug}`,
        );
        toastSuccess("Doc created and shared");
      },
    },
    {
      name: "poll",
      usage: "Question | option | option",
      description: "Ask the channel to vote",
      run: async (args) => {
        const [question = "", ...options] = args
          .split("|")
          .map((part) => part.trim());
        const filled = options.filter(Boolean);

        if (question && filled.length >= 2 && channelId) {
          await trpc.chat.createPoll.mutate({
            channelId,
            question,
            options: filled.slice(0, 8),
          });
          await refresh();
        } else {
          setPoll({ question, options: filled.length ? filled : undefined });
        }
      },
    },
    {
      name: "huddle",
      usage: "",
      description: "Start a video huddle",
      run: async () => {
        if (!channelId) return;

        const { url } = await trpc.chat.startHuddle.mutate({ channelId });

        await refresh();
        window.open(url, "_blank", "noopener");
      },
    },
    {
      name: "summarize",
      usage: "",
      description: "Summarize recent messages",
      run: () => setSummary(true),
    },
    {
      name: "schedule",
      usage: "<30m|2h|tomorrow|monday> <message>",
      description: "Send a message later",
      run: async (args) => {
        const [when = "", ...rest] = args.split(/\s+/);
        const at = parseWhen(when);
        const body = rest.join(" ").trim();

        if (!at || !body || !channelId) {
          throw new Error(
            "Use /schedule 30m <message>, or 2h, tomorrow, monday.",
          );
        }

        await trpc.chat.schedule.mutate({ channelId, body, sendAt: at });
        toastSuccess(`Scheduled for ${untilLabel(at)}`);
        void sidebar.refresh();
      },
    },
    {
      name: "status",
      usage: "<emoji> <text>",
      description: "Set your status",
      run: async (args) => {
        const match = /^(\p{Extended_Pictographic}\S*)?\s*(.*)$/u.exec(args);

        await trpc.chat.statusSet.mutate({
          emoji: match?.[1] ?? null,
          text: match?.[2]?.trim() || null,
          clearInMinutes: null,
          dndMinutes: null,
        });
        toastSuccess(args ? "Status updated" : "Status cleared");
      },
    },
    {
      name: "dnd",
      usage: "<30m|2h|off>",
      description: "Pause notifications",
      run: async (args) => {
        const until = parseWhen(args);

        await trpc.chat.statusSet.mutate({
          emoji: null,
          text: null,
          clearInMinutes: null,
          dndMinutes:
            args === "off" || !until
              ? 0
              : Math.max(
                  1,
                  Math.round((until.getTime() - Date.now()) / 60_000),
                ),
        });
        await sidebar.refresh();
        toastSuccess(
          args === "off" || !until
            ? "Do not disturb is off"
            : "Do not disturb is on",
        );
      },
    },
    {
      name: "assign",
      usage: "[TASK-KEY] @person",
      description: "Assign a task",
      run: async (args) => {
        const key =
          /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/.exec(args)?.[0] ??
          (full?.link?.type === "task" ? full.link.key : null);
        const who = /<@([0-9a-f-]{36})>/.exec(args)?.[1];

        if (!key || !who) throw new Error("Use /assign MA-6 @person.");

        await trpc.task.updateTaskByKey.mutate({
          key,
          assignedToMemberId: who,
        });
        toastSuccess(`${key} assigned`);
        await postPlain(
          `assigned ${key} to ${args.replace(/\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/, "").trim()}`,
        );
      },
    },
    {
      name: "done",
      usage: "[TASK-KEY]",
      description: "Mark a task done",
      run: async (args) => {
        const key =
          /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/.exec(args)?.[0] ??
          (full?.link?.type === "task" ? full.link.key : null);

        if (!key) throw new Error("Use /done MA-6.");

        await trpc.task.updateTaskByKey.mutate({ key, status: "done" });
        toastSuccess(`${key} marked done`);
      },
    },
    {
      name: "shrug",
      usage: "[message]",
      description: "Add ¯\\_(ツ)_/¯",
      run: (args) => postPlain(`${args} ¯\\_(ツ)_/¯`.trim()),
    },
  ];

  return {
    commands,
    schedule,
    makeDoc,
    postPlain,
  };
}
