export type Person = {
  memberId: string;
  name: string;
  email: string;
  isMe?: boolean;
  presence?: "active" | "away" | "offline";
};

export type Draft = { body: string; fileIds: string[] };

/** A `/command` in the message box. */
export type SlashCommand = {
  name: string;
  usage: string;
  description: string;
  /** Runs with the text after the command, mentions as <@id>. */
  run: (args: string) => Promise<void> | void;
};

export type PendingFile = {
  key: string;
  name: string;
  size: number;
  mimeType: string;
  progress: number;
  id?: string;
  error?: string;
  previewUrl?: string;
};

export type Trigger = {
  kind: "mention" | "link" | "emoji";
  query: string;
  start: number;
};

export type LinkResult = {
  kind: "task" | "doc" | "project";
  label: string;
  hint: string;
  insert: string;
};

export type Option =
  | { kind: "person"; person: Person }
  | { kind: "group"; id: string; note: string }
  | { kind: "link"; result: LinkResult }
  | { kind: "emoji"; name: string; glyph?: string; url?: string }
  | { kind: "command"; command: SlashCommand };

export const composerEmoji = [
  "👍",
  "👀",
  "✅",
  "🎉",
  "🙏",
  "😄",
  "🤔",
  "🔥",
  "❤️",
  "🚀",
  "😅",
  "👏",
];

export const laterChoices: Array<[string, () => Date]> = [
  ["In 30 minutes", () => new Date(Date.now() + 30 * 60_000)],
  ["In 1 hour", () => new Date(Date.now() + 60 * 60_000)],
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
    "Monday at 9:00",
    () => {
      const date = new Date();
      date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
      date.setHours(9, 0, 0, 0);
      return date;
    },
  ],
];

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
export function localInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
