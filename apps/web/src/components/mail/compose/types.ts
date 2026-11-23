import { apiPath } from "~/src/lib/paths";

export type Person = { id: string; name: string; email: string; isMe: boolean };

export type ComposeDraft = {
  id?: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  replyToId?: string;
  files?: Attachment[];
};

export type Attachment = { id: string; name: string; size: number };

/** At most this many files go with one message (the server's limit too). */
export const MAX_FILES = 10;

export async function uploadAttachment(file: File): Promise<Attachment> {
  const body = new FormData();
  body.append("file", file);
  body.append("mail", "1");

  const response = await fetch(apiPath("/api/files"), {
    method: "POST",
    body,
  });
  const saved = (await response.json()) as { id?: string; error?: string };

  if (!response.ok || !saved.id) {
    throw new Error(saved.error ?? `Could not upload ${file.name}.`);
  }

  return { id: saved.id, name: file.name, size: file.size };
}
