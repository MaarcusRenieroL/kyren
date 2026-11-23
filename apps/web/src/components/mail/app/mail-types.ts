import {
  FileEditIcon,
  InboxIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@kyren/api/server";

export type Outputs = inferRouterOutputs<AppRouter>["mail"];
export type Row = Outputs["list"]["items"][number];
export type Conversation = Outputs["get"];
export type Folder = "inbox" | "starred" | "sent" | "drafts" | "trash";

export const folders: { id: Folder; label: string; icon: typeof InboxIcon }[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "starred", label: "Starred", icon: StarIcon },
  { id: "sent", label: "Sent", icon: SendIcon },
  { id: "drafts", label: "Drafts", icon: FileEditIcon },
  { id: "trash", label: "Trash", icon: Trash2Icon },
];

export const emptyCopy: Record<Folder, string> = {
  inbox: "Nothing in your inbox. New messages show up here.",
  starred: "Star a message to find it again quickly.",
  sent: "Messages you send appear here.",
  drafts: "Unfinished messages are kept here.",
  trash: "Deleted messages stay here until you remove them for good.",
};

export const stamp = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const reason = (error: unknown) =>
  error instanceof Error ? error.message : undefined;

export const quote = (name: string, at: string, body: string) =>
  `\n\nOn ${stamp.format(new Date(at))}, ${name} wrote:\n${body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}`;
