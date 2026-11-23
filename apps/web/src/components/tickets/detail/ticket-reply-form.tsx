"use client";

import { useState, type FC, type FormEvent } from "react";
import { Button } from "@zentro/ui/shadcn/button";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { SavedReplyPicker } from "./../saved-replies";
import { SuggestedArticles } from "./../suggested-articles";
import type { Ticket } from "./types";

type TicketReplyFormProps = {
  ticket: Ticket;
  busy: boolean;
  onSendReply: (kind: "reply" | "note", body: string) => Promise<void>;
};

export const TicketReplyForm: FC<TicketReplyFormProps> = ({
  ticket,
  busy,
  onSendReply,
}) => {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"reply" | "note">("reply");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSendReply(kind, body);
    setBody("");
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <div role="radiogroup" aria-label="Reply type" className="flex gap-1">
        {(["reply", "note"] as const).map((value) => (
          <Button
            variant="custom"
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-lg px-3 py-1 text-sm ${
              kind === value
                ? "bg-sunken font-medium text-ink"
                : "text-ink-2 hover:bg-sunken"
            }`}
          >
            {value === "reply" ? "Reply" : "Internal note"}
          </Button>
        ))}
      </div>
      {kind === "reply" ? (
        <SavedReplyPicker
          customer={ticket.requesterName}
          ticket={ticket.subject}
          onInsert={(text) =>
            setBody((current) => (current ? `${current}\n\n${text}` : text))
          }
        />
      ) : null}
      {kind === "reply" ? (
        <SuggestedArticles
          subject={ticket.subject}
          onInsert={(text) =>
            setBody((current) => (current ? `${current}\n\n${text}` : text))
          }
        />
      ) : null}
      <Textarea
        aria-label={kind === "reply" ? "Reply" : "Internal note"}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          kind === "reply"
            ? "Write to the requester"
            : "Only your team sees this"
        }
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !body.trim()}>
          {kind === "reply" ? "Send reply" : "Add note"}
        </Button>
      </div>
    </form>
  );
};
