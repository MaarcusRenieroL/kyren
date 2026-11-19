"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { SlaBadge } from "./sla-badge";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { PageHeader } from "@zentro/ui/components/page-header";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";
import { toast, toastError } from "@zentro/ui/index";

import { SuggestedArticles } from "./suggested-articles";

import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";

import { useAsyncData } from "~/src/lib/use-async-data";

import {
  awayLabel,
  isMissing,
  messageOf,
  priorityLabels,
  statusLabels,
} from "./labels";

type Ticket = inferRouterOutputs<AppRouter>["tickets"]["get"];
type People = inferRouterOutputs<AppRouter>["tickets"]["assignees"];

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function TicketDetail({ id }: { id: string }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"reply" | "note">("reply");
  const [taskKey, setTaskKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
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
    } catch (error) {
      toastError(failure, messageOf(error));
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
                } catch (error) {
                  toastError("Could not delete the ticket", messageOf(error));
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
                disabled={summarizing}
                onClick={async () => {
                  setSummarizing(true);

                  try {
                    const result = await trpc.tickets.summarize.mutate({
                      id: ticket.id,
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

          {ticket.description ? (
            <section
              aria-label="Original request"
              className="rounded-xl border border-line p-4 text-sm whitespace-pre-wrap text-ink"
            >
              {ticket.description}
            </section>
          ) : null}

          <p className="text-xs text-ink-2">
            Customer link (no sign-in needed):{" "}
            <code className="break-all rounded bg-sunken px-1">
              {typeof window === "undefined"
                ? ""
                : `${window.location.origin}/support/${ticket.portalToken}`}
            </code>
          </p>
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

          {ticket.canReply ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await trpc.tickets.reply.mutate({
                    id: ticket.id,
                    kind,
                    body,
                  });
                  setBody("");
                }, "Could not send");
              }}
            >
              <div
                role="radiogroup"
                aria-label="Reply type"
                className="flex gap-1"
              >
                {(["reply", "note"] as const).map((value) => (
                  <button
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
                  </button>
                ))}
              </div>
              {kind === "reply" ? (
                <SuggestedArticles
                  subject={ticket.subject}
                  onInsert={(text) =>
                    setBody((current) =>
                      current ? `${current}\n\n${text}` : text,
                    )
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
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-ink-2">Status</span>
            <NativeSelect
              aria-label="Status"
              disabled={!ticket.canUpdate || busy}
              value={ticket.status}
              onChange={(e) =>
                void update({ status: e.target.value as "open" })
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-ink-2">Priority</span>
            <NativeSelect
              aria-label="Priority"
              disabled={!ticket.canUpdate || busy}
              value={ticket.priority}
              onChange={(e) =>
                void update({ priority: e.target.value as "normal" })
              }
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-ink-2">Assignee</span>
            <NativeSelect
              aria-label="Assignee"
              disabled={!ticket.canUpdate || busy}
              value={ticket.assigneeMemberId ?? ""}
              onChange={(e) =>
                void update({ assigneeMemberId: e.target.value || null })
              }
            >
              <option value="">Unassigned</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {awayLabel(person.awayUntil)
                    ? ` (${awayLabel(person.awayUntil)})`
                    : ""}
                </option>
              ))}
            </NativeSelect>
            {awayLabel(ticket.assigneeAwayUntil) ? (
              <span role="status" className="text-xs text-warning-text">
                The assignee is {awayLabel(ticket.assigneeAwayUntil)}. Consider
                reassigning this ticket.
              </span>
            ) : null}
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-ink-2">Linked task</span>
            {ticket.linkedTask ? (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-ink">
                  <span className="font-mono text-xs">
                    {ticket.linkedTask.key}
                  </span>{" "}
                  {ticket.linkedTask.name}
                </span>
                {ticket.canUpdate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          trpc.tickets.linkTask.mutate({
                            id: ticket.id,
                            taskKey: null,
                          }),
                        "Could not unlink the task",
                      )
                    }
                  >
                    Unlink
                  </Button>
                ) : null}
              </div>
            ) : ticket.canUpdate ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await trpc.tickets.linkTask.mutate({
                      id: ticket.id,
                      taskKey: taskKey.trim(),
                    });
                    setTaskKey("");
                  }, "Could not link the task");
                }}
              >
                <Input
                  aria-label="Task key"
                  placeholder="ZEN-61"
                  value={taskKey}
                  onChange={(e) => setTaskKey(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy || !taskKey.trim()}
                >
                  Link
                </Button>
              </form>
            ) : (
              <span className="text-ink-3">None</span>
            )}
          </div>

          {ticket.category ? (
            <p className="text-ink-2">
              Category: <span className="text-ink">{ticket.category}</span>
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
