"use client";

import { useState, type FC } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import { toastError } from "@kyren/ui/index";
import { useTrpcClient } from "@kyren/api/react";

type TicketAiSummaryProps = {
  ticketId: string;
  aiAvailable: boolean;
};

export const TicketAiSummary: FC<TicketAiSummaryProps> = ({
  ticketId,
  aiAvailable,
}) => {
  const trpc = useTrpcClient();
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  return (
    <section aria-label="AI summary" className="flex flex-col gap-2">
      {summary ? (
        <p className="rounded-xl bg-sunken p-4 text-sm whitespace-pre-wrap text-ink">
          {summary}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={summarizing || !aiAvailable}
          title={
            aiAvailable
              ? undefined
              : "An administrator needs to turn on AI for this workspace."
          }
          onClick={async () => {
            setSummarizing(true);
            try {
              const result = await trpc.tickets.summarize.mutate({
                id: ticketId,
              });
              setSummary(result.summary);
            } catch (error) {
              toastError(error, "Could not summarize this ticket.");
            } finally {
              setSummarizing(false);
            }
          }}
        >
          {summarizing ? "Summarizing…" : "Summarize with AI"}
        </Button>
      </div>
    </section>
  );
};
