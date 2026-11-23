"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { SlaBadge } from "./sla-badge";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { PageHeader } from "@kyren/ui/components/page-header";
import { Button } from "@kyren/ui/shadcn/button";
import { toast, toastError } from "@kyren/ui/index";

import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import { useAsyncData } from "~/src/lib/use-async-data";
import { isMissing, messageOf } from "./labels";
import { apiPath } from "~/src/lib/paths";

import { dateFormat, type People, type Ticket } from "./detail/types";
import { TicketAiSummary } from "./detail/ticket-ai-summary";
import { TicketMessages } from "./detail/ticket-messages";
import { TicketReplyForm } from "./detail/ticket-reply-form";
import { TicketSidebar } from "./detail/ticket-sidebar";

export function TicketDetail({ id }: { id: string }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const { data, status, error, reload } = useAsyncData(async () => {
    const [ticket, people] = await Promise.all([
      trpc.tickets.get.query({ id }),
      trpc.tickets.assignees.query(),
    ]);

    return { ticket, people };
  }, [trpc, id]);

  const ticket: Ticket | null = data?.ticket ?? null;
  const people: People = data?.people ?? [];

  usePageCrumb(`/tickets/${id}`, ticket?.ref ?? "Ticket");

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true);
    try {
      await action();
      reload();
    } catch (err) {
      toastError(failure, messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (status === "error" && !isMissing(error)) {
    return (
      <div className="p-6">
        <EmptyState
          title="The ticket did not load"
          description="Check your connection and try again."
          action={<Button onClick={reload}>Retry</Button>}
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-6">
        <EmptyState
          title="Ticket not found"
          description="It may have been deleted."
          action={
            <Button asChild>
              <Link href="/tickets">Back to tickets</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!ticket) {
    return (
      <p role="status" className="p-6 text-sm text-ink-2">
        Loading ticket…
      </p>
    );
  }

  const update = (
    changes: Partial<{
      status: "open" | "pending" | "resolved" | "spam";
      priority: "low" | "normal" | "high" | "urgent";
      assigneeMemberId: string | null;
    }>,
  ) =>
    run(
      () => trpc.tickets.update.mutate({ id: ticket.id, ...changes }),
      "Could not update the ticket",
    );

  const portalLink =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${apiPath(`/support/${ticket.portalToken}`)}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        breadcrumbs={
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1 text-sm text-ink-2 hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Tickets
          </Link>
        }
        title={ticket.subject}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-ink-3">{ticket.ref}</span>
            <SlaBadge label="Answer" clock={ticket.sla.response} alwaysShow />
            <SlaBadge
              label="Resolve"
              clock={ticket.sla.resolution}
              alwaysShow
            />
          </span>
        }
        description={`${ticket.requesterName}${ticket.requesterEmail ? ` · ${ticket.requesterEmail}` : ""} · opened ${dateFormat.format(new Date(ticket.createdAt))}`}
        actions={
          ticket.canDelete ? (
            <Button
              variant="ghost"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Delete ${ticket.ref}? This cannot be undone.`,
                  )
                )
                  return;
                try {
                  await trpc.tickets.remove.mutate({ id: ticket.id });
                  toast.success("Ticket deleted");
                  router.push("/tickets");
                } catch (err) {
                  toastError("Could not delete the ticket", messageOf(err));
                }
              }}
            >
              <Trash2Icon aria-hidden />
              Delete
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <TicketAiSummary
            ticketId={ticket.id}
            aiAvailable={ticket.aiAvailable}
          />

          <TicketMessages ticket={ticket} portalLink={portalLink} />

          {ticket.canReply ? (
            <TicketReplyForm
              ticket={ticket}
              busy={busy}
              onSendReply={(kind, body) =>
                run(async () => {
                  await trpc.tickets.reply.mutate({
                    id: ticket.id,
                    kind,
                    body,
                  });
                }, "Could not send")
              }
            />
          ) : null}
        </div>

        <TicketSidebar
          ticket={ticket}
          people={people}
          busy={busy}
          onUpdate={update}
          onLinkTask={(taskKey) =>
            run(
              () =>
                trpc.tickets.linkTask.mutate({
                  id: ticket.id,
                  taskKey,
                }),
              taskKey
                ? "Could not link the task"
                : "Could not unlink the task",
            )
          }
        />
      </div>
    </div>
  );
}
