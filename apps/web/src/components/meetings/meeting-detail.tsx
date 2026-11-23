"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { PageHeader } from "@kyren/ui/components/page-header";
import { Button } from "@kyren/ui/shadcn/button";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { toastError, toastSuccess } from "@kyren/ui/index";

import { useCurrentUserId } from "~/src/components/permissions/permission-provider";
import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import { useAsyncData } from "~/src/lib/use-async-data";
import { recapActionItems } from "./recap";
import { ActionItems } from "./action-items";

const when = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const answers = ["yes", "maybe", "no"] as const;

/** How an attendee's answer reads in the list. */
const answerLabel: Record<string, string> = {
  yes: "Going",
  maybe: "Maybe",
  no: "Not going",
  invited: "Not answered",
};

/** One meeting: the join link, who is coming, shared notes and the AI recap. */
export function MeetingDetail({ id }: { id: string }) {
  const trpc = useTrpcClient();
  const userId = useCurrentUserId();
  const meeting = useAsyncData(
    () => trpc.meeting.get.query({ id }),
    [trpc, id],
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  usePageCrumb(`/calendar/meetings/${id}`, meeting.data?.title ?? "Meeting");

  useEffect(() => {
    if (meeting.data) setNotes(meeting.data.notes ?? "");
  }, [meeting.data?.id]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);

    try {
      await action();
      meeting.reload();
    } catch (error) {
      toastError(error, `Could not ${label}.`);
    } finally {
      setBusy(null);
    }
  }

  if (meeting.status === "error") {
    return (
      <div className="p-6">
        <EmptyState
          title="Meeting not found"
          description="It may have been removed, or you were not invited."
        />
        <Link href="/calendar/meetings" className="text-sm underline">
          Back to meetings
        </Link>
      </div>
    );
  }

  const data = meeting.data;

  if (!data) return <div className="p-6 text-sm text-ink-2">Loading…</div>;

  const mine = data.attendees.find(
    (person) => person.userId === userId,
  )?.response;

  const canceled = data.status === "canceled";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
      <Link
        href="/calendar/meetings"
        className="flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back to meetings
      </Link>

      <PageHeader
        title={data.title}
        description={`${when.format(new Date(data.startsAt))} · ${data.durationMinutes} min${canceled ? " · Canceled" : ""}`}
        actions={
          canceled ? undefined : (
            <Button asChild>
              <a href={data.joinUrl} target="_blank" rel="noopener noreferrer">
                Join video call
              </a>
            </Button>
          )
        }
      />

      {data.agenda ? (
        <section aria-label="Agenda" className="tile px-5 py-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Agenda</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-2">
            {data.agenda}
          </p>
        </section>
      ) : null}

      <section aria-label="Attendees" className="tile px-5 py-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Who is coming</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {data.attendees.map((person) => (
            <li key={person.userId} className="flex justify-between">
              <span>{person.name}</span>
              <span className="text-ink-3">
                {answerLabel[person.response] ?? person.response}
              </span>
            </li>
          ))}
        </ul>
        {canceled ? null : (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-ink-2">Your answer:</span>
            {answers.map((response) => (
              <Button
                key={response}
                size="sm"
                variant={mine === response ? "secondary" : "outline"}
                aria-pressed={mine === response}
                disabled={busy !== null}
                onClick={() =>
                  void run("answer", () =>
                    trpc.meeting.respond.mutate({ id, response }),
                  )
                }
              >
                {response === "yes"
                  ? "Yes"
                  : response === "no"
                    ? "No"
                    : "Maybe"}
              </Button>
            ))}
          </div>
        )}
      </section>

      <section
        aria-label="Notes"
        className="tile flex flex-col gap-2 px-5 py-4"
      >
        <h2 className="text-sm font-semibold text-ink">Shared notes</h2>
        <Textarea
          aria-label="Meeting notes"
          rows={8}
          value={notes}
          maxLength={20000}
          disabled={canceled}
          onChange={(event) => setNotes(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={canceled || busy !== null}
            onClick={() =>
              void run("save the notes", async () => {
                await trpc.meeting.saveNotes.mutate({ id, notes });
                toastSuccess("Notes saved");
              })
            }
          >
            Save notes
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              canceled || busy !== null || !notes.trim() || !data.aiAvailable
            }
            title={
              data.aiAvailable
                ? undefined
                : "An administrator needs to turn on AI for this workspace."
            }
            onClick={() =>
              void run("write the recap", async () => {
                await trpc.meeting.saveNotes.mutate({ id, notes });
                await trpc.meeting.summarize.mutate({ id });
              })
            }
          >
            Recap with AI
          </Button>
        </div>
        {data.summary ? (
          <div className="mt-2 rounded-lg bg-sunken p-3">
            <h3 className="mb-1 text-xs font-semibold text-ink-2">AI recap</h3>
            <p className="whitespace-pre-wrap text-sm text-ink">
              {data.summary}
            </p>
          </div>
        ) : null}
        {canceled ? null : (
          <ActionItems meetingId={id} items={recapActionItems(data.summary)} />
        )}
      </section>

      {canceled ? null : (
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Cancel this meeting for everyone?")) return;
              void run("cancel the meeting", () =>
                trpc.meeting.cancel.mutate({ id }),
              );
            }}
          >
            Cancel meeting
          </Button>
        </div>
      )}
    </div>
  );
}
