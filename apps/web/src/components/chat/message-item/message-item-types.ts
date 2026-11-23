import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@kyren/api/server";

type Outputs = inferRouterOutputs<AppRouter>;
export type MessageView = Outputs["chat"]["messages"]["messages"][number];
export type AttachmentView = MessageView["attachments"][number];

/** A message that has not reached the server yet. */
export type LocalState = "sending" | "queued" | "failed";

export type MessageActions = {
  onReply?: (message: MessageView) => void;
  onReact: (message: MessageView, emoji: string) => void;
  onPin?: (message: MessageView) => void;
  onEdit?: (message: MessageView, body: string) => Promise<void> | void;
  onDelete?: (message: MessageView) => void;
  onCreateTask?: (message: MessageView) => void;
  onOpenFile: (file: AttachmentView, all: AttachmentView[]) => void;
  onRetry?: (message: MessageView) => void;
  onDiscard?: (message: MessageView) => void;
  onSave?: (message: MessageView, saved: boolean) => void;
  /** Remind the caller at a time, or null to clear the reminder. */
  onRemind?: (message: MessageView, at: Date | null) => void;
  onMarkUnread?: (message: MessageView) => void;
  onForward?: (message: MessageView) => void;
  onVote?: (pollId: string, index: number) => void;
  onClosePoll?: (pollId: string) => void;
  /** Translated text for a message, or a rejection with the reason. */
  onTranslate?: (message: MessageView, language: string) => Promise<string>;
  /** Start a doc from this message and its thread. */
  onMakeDoc?: (message: MessageView) => void;
};

export const quickReactions = ["👍", "✅", "👀", "🎉", "🙏"];

export const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  "in-progress": "In progress",
  review: "Review",
  done: "Done",
};

export const presenceDot: Record<string, string> = {
  active: "bg-success",
  away: "bg-warning",
  offline: "border border-ink-3 bg-surface",
};

export const reminderChoices: Array<[string, () => Date]> = [
  ["In 20 minutes", () => new Date(Date.now() + 20 * 60_000)],
  ["In 1 hour", () => new Date(Date.now() + 60 * 60_000)],
  ["In 3 hours", () => new Date(Date.now() + 3 * 60 * 60_000)],
  [
    "Tomorrow at 9:00",
    () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return date;
    },
  ],
  [
    "Next Monday at 9:00",
    () => {
      const date = new Date();
      date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
      date.setHours(9, 0, 0, 0);
      return date;
    },
  ],
];

export const languages = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Hindi",
  "Japanese",
  "Chinese",
];
