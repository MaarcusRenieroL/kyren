"use client";

import { useRef, useState, type FormEvent } from "react";
import { PaperclipIcon, XIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";
import { Input } from "@zentro/ui/shadcn/input";
import { Label } from "@zentro/ui/shadcn/label";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { fileSize } from "~/src/components/chat/message-body";
import {
  type Attachment,
  type ComposeDraft,
  type Person,
  MAX_FILES,
  uploadAttachment,
} from "./types";
import { Recipients } from "./recipients-input";

export function ComposeForm({
  draft,
  people,
  onSend,
  onKeep,
  onDiscard,
}: {
  draft: ComposeDraft;
  people: Person[];
  onSend: (draft: ComposeDraft) => Promise<void>;
  onKeep: (draft: ComposeDraft) => Promise<void>;
  onDiscard: () => void;
}) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [showCc, setShowCc] = useState(draft.cc.length > 0);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [files, setFiles] = useState<Attachment[]>(draft.files ?? []);
  const [uploading, setUploading] = useState(0);
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = (): ComposeDraft => ({
    id: draft.id,
    replyToId: draft.replyToId,
    to,
    cc,
    subject,
    body,
    files,
  });

  const hasContent = Boolean(
    to.length || cc.length || subject.trim() || body.trim() || files.length,
  );

  async function attach(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (picker.current) picker.current.value = "";
    if (!chosen.length) return;
    if (files.length + chosen.length > MAX_FILES) {
      setError(`A message can carry at most ${MAX_FILES} files.`);
      return;
    }

    setError(null);
    setUploading((n) => n + chosen.length);

    for (const file of chosen) {
      try {
        const saved = await uploadAttachment(file);
        setFiles((curr) => [...curr, saved]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Could not upload ${file.name}.`,
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSend(current());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      if (hasContent) await onKeep(current());
      else onDiscard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the draft.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle>{draft.replyToId ? "Reply" : "New message"}</DialogTitle>
        <DialogDescription>
          Only the people you add can read this message.
        </DialogDescription>
      </DialogHeader>

      <Recipients label="To" value={to} people={people} onChange={setTo} />
      {showCc ? (
        <Recipients label="Cc" value={cc} people={people} onChange={setCc} />
      ) : (
        <Button
          variant="custom"
          type="button"
          className="self-start text-xs text-ink-2 underline"
          onClick={() => setShowCc(true)}
        >
          Add Cc
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mail-subject">Subject</Label>
        <Input
          id="mail-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mail-body">Message</Label>
        <Textarea
          id="mail-body"
          rows={10}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          appearance="native"
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label="Files to attach"
          onChange={(event) => void attach(event.target.files)}
        />
        {files.length ? (
          <ul aria-label="Attachments" className="flex flex-wrap gap-1.5">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs"
              >
                <PaperclipIcon className="size-3" aria-hidden />
                <span className="max-w-48 truncate">{file.name}</span>
                <span className="text-ink-3">{fileSize(file.size)}</span>
                <Button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setFiles((curr) =>
                      curr.filter((item) => item.id !== file.id),
                    )
                  }
                >
                  <XIcon className="size-3" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={busy || uploading > 0 || files.length >= MAX_FILES}
          onClick={() => picker.current?.click()}
        >
          <PaperclipIcon aria-hidden />
          {uploading ? "Uploading…" : "Attach files"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          className="mr-auto"
          disabled={busy}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || uploading > 0}
          onClick={() => void close()}
        >
          {hasContent ? "Save draft" : "Close"}
        </Button>
        <Button type="submit" disabled={busy || uploading > 0}>
          {busy ? "Sending…" : "Send"}
        </Button>
      </DialogFooter>
    </form>
  );
}
