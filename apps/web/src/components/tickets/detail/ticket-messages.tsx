"use client";

import type { FC } from "react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { toastSuccess } from "@zentro/ui/index";
import { copyText } from "~/src/lib/clipboard";
import { dateFormat, type Ticket } from "./types";

type TicketMessagesProps = {
  ticket: Ticket;
  portalLink: string;
};

export const TicketMessages: FC<TicketMessagesProps> = ({
  ticket,
  portalLink,
}) => {
  return (
    <>
      {ticket.description ? (
        <section
          aria-label="Original request"
          className="rounded-xl border border-line p-4 text-sm whitespace-pre-wrap text-ink"
        >
          {ticket.description}
        </section>
      ) : null}

      <p className="text-xs text-ink-2">
        The customer can follow this ticket without signing in:
      </p>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          aria-label="Customer link"
          className="h-8 font-mono text-xs"
          value={portalLink}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void copyText(portalLink).then((done) => {
              if (done) toastSuccess("Customer link copied");
            })
          }
        >
          Copy
        </Button>
      </div>

      <ol className="flex flex-col gap-3">
        {ticket.messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-xl border p-4 ${
              message.kind === "note"
                ? "border-dashed border-line-strong bg-tint-sun"
                : "border-line"
            }`}
          >
            <p className="mb-1 text-xs text-ink-2">
              <span className="font-medium text-ink">{message.author}</span>
              {message.kind === "note"
                ? " · internal note"
                : message.kind === "inbound"
                  ? " · by email"
                  : " · reply"}{" "}
              · {dateFormat.format(new Date(message.createdAt))}
            </p>
            <p className="text-sm whitespace-pre-wrap text-ink">
              {message.body}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
};
